"""Platform secret custody contracts.

The fake adapters model binding rules for portable tests.  Production Windows
uses DPAPI in CurrentUser scope; its encrypted blobs are still treated as
sensitive App-owned state and must live below a separately protected runtime
root.
"""

from __future__ import annotations

import os
import re
import subprocess
from collections.abc import MutableMapping
from dataclasses import dataclass
from hashlib import sha256
from pathlib import Path
from typing import Protocol

from .path_security import (
    PathSecurityError,
    assert_secure_regular_file,
    atomic_write_secure,
    ensure_secure_directory,
)


_REFERENCE_RE = re.compile(
    r"^sapd-wiki-mcp:"
    r"(?P<install>[0-9a-f]{64}):"
    r"(?P<profile>[a-z][a-z0-9-]{1,31}):"
    r"(?P<generation>[A-Za-z0-9_-]{16,96}):server-key$"
)


class SecretCustodyError(RuntimeError):
    def __init__(self, code: str) -> None:
        super().__init__(code)
        self.code = code


TRANSIENT_SECRET_CUSTODY_CODES = frozenset(
    {
        "SECRET_BACKEND_UNAVAILABLE",
        "SECRET_STORE_UNAVAILABLE",
    }
)
KEYCHAIN_TEMPORARY_FAILURE_RETURN_CODES = frozenset({36, 51})


def is_transient_secret_custody_error(error: BaseException) -> bool:
    return (
        isinstance(error, SecretCustodyError)
        and error.code in TRANSIENT_SECRET_CUSTODY_CODES
    )


class FakeBoundPlatformSecretProvider:
    """In-memory provider with install/profile/generation/device binding."""

    backend = "in_memory_test_only"
    scope = "current_user"
    persistent = False
    local_machine = False

    def __init__(
        self,
        *,
        platform_contract: str,
        device_binding: str,
    ) -> None:
        if platform_contract not in {"macos_keychain", "windows_dpapi"}:
            raise ValueError("unsupported fake platform contract")
        if not isinstance(device_binding, str) or len(device_binding) < 16:
            raise ValueError("device_binding must be an opaque stable test value")
        self.platform_contract = platform_contract
        self.device_binding = device_binding
        self.synchronizable = False
        self.this_device_only = platform_contract == "macos_keychain"
        self.current_user_only = True
        self.uses_local_machine_scope = False
        self._values: MutableMapping[str, tuple[str, bytes]] = {}

    @staticmethod
    def _validate_reference(reference: str) -> str:
        if not isinstance(reference, str) or not _REFERENCE_RE.fullmatch(reference):
            raise SecretCustodyError("SECRET_REFERENCE_BINDING_INVALID")
        return reference

    def get_secret(self, reference: str) -> bytes | None:
        key = self._validate_reference(reference)
        stored = self._values.get(key)
        if stored is None:
            return None
        stored_device, value = stored
        if stored_device != self.device_binding:
            raise SecretCustodyError("SECRET_DEVICE_BINDING_MISMATCH")
        return bytes(value)

    def put_secret(self, reference: str, secret: bytes) -> None:
        key = self._validate_reference(reference)
        if not isinstance(secret, bytes) or len(secret) < 32:
            raise SecretCustodyError("SECRET_VALUE_INVALID")
        self._values[key] = (self.device_binding, bytes(secret))

    def delete_secret(self, reference: str) -> None:
        key = self._validate_reference(reference)
        self._values.pop(key, None)

    def simulate_device_change(self, device_binding: str) -> None:
        if not isinstance(device_binding, str) or len(device_binding) < 16:
            raise ValueError("device_binding must be an opaque stable test value")
        self.device_binding = device_binding


class FakeMacOSDataProtectionKeychainProvider(
    FakeBoundPlatformSecretProvider
):
    accessibility = "WhenUnlockedThisDeviceOnly"

    def __init__(self, *, device_binding: str) -> None:
        super().__init__(
            platform_contract="macos_keychain",
            device_binding=device_binding,
        )


class FakeWindowsDpapiCurrentUserProvider(FakeBoundPlatformSecretProvider):
    dpapi_scope = "CurrentUser"

    def __init__(self, *, device_binding: str) -> None:
        super().__init__(
            platform_contract="windows_dpapi",
            device_binding=device_binding,
        )


class WindowsDpapiNativeApi(Protocol):
    """Narrow injectable boundary around CryptProtectData/CryptUnprotectData."""

    def protect(
        self,
        plaintext: bytes,
        *,
        entropy: bytes,
        scope: str,
        ui_forbidden: bool,
    ) -> bytes: ...

    def unprotect(
        self,
        ciphertext: bytes,
        *,
        entropy: bytes,
        scope: str,
        ui_forbidden: bool,
    ) -> bytes: ...


class CtypesWindowsDpapiNativeApi:
    """ctypes DPAPI bridge that never enables CRYPTPROTECT_LOCAL_MACHINE."""

    current_user_only = True
    uses_local_machine_scope = False

    def __init__(self) -> None:
        if os.name != "nt":
            raise SecretCustodyError("SECRET_BACKEND_UNAVAILABLE")
        try:
            import ctypes
            from ctypes import wintypes

            class DataBlob(ctypes.Structure):
                _fields_ = (
                    ("cbData", wintypes.DWORD),
                    ("pbData", ctypes.POINTER(ctypes.c_ubyte)),
                )

            crypt32 = ctypes.WinDLL("crypt32", use_last_error=True)
            kernel32 = ctypes.WinDLL("kernel32", use_last_error=True)
            crypt32.CryptProtectData.argtypes = (
                ctypes.POINTER(DataBlob),
                wintypes.LPCWSTR,
                ctypes.POINTER(DataBlob),
                ctypes.c_void_p,
                ctypes.c_void_p,
                wintypes.DWORD,
                ctypes.POINTER(DataBlob),
            )
            crypt32.CryptProtectData.restype = wintypes.BOOL
            crypt32.CryptUnprotectData.argtypes = (
                ctypes.POINTER(DataBlob),
                ctypes.c_void_p,
                ctypes.POINTER(DataBlob),
                ctypes.c_void_p,
                ctypes.c_void_p,
                wintypes.DWORD,
                ctypes.POINTER(DataBlob),
            )
            crypt32.CryptUnprotectData.restype = wintypes.BOOL
            kernel32.LocalFree.argtypes = (ctypes.c_void_p,)
            kernel32.LocalFree.restype = ctypes.c_void_p
        except (AttributeError, OSError) as exc:
            raise SecretCustodyError("SECRET_BACKEND_UNAVAILABLE") from exc
        self._ctypes = ctypes
        self._DataBlob = DataBlob
        self._crypt32 = crypt32
        self._kernel32 = kernel32

    @staticmethod
    def _require_contract(*, scope: str, ui_forbidden: bool) -> None:
        if scope != "CurrentUser" or not ui_forbidden:
            raise SecretCustodyError("SECRET_SCOPE_VIOLATION")

    def _blob(self, payload: bytes):
        buffer = (self._ctypes.c_ubyte * len(payload)).from_buffer_copy(payload)
        blob = self._DataBlob(
            len(payload),
            self._ctypes.cast(
                buffer,
                self._ctypes.POINTER(self._ctypes.c_ubyte),
            ),
        )
        return buffer, blob

    def _release(self, blob) -> None:
        if blob.pbData:
            self._kernel32.LocalFree(
                self._ctypes.cast(blob.pbData, self._ctypes.c_void_p)
            )

    def protect(
        self,
        plaintext: bytes,
        *,
        entropy: bytes,
        scope: str,
        ui_forbidden: bool,
    ) -> bytes:
        self._require_contract(scope=scope, ui_forbidden=ui_forbidden)
        data_buffer, data_blob = self._blob(plaintext)
        entropy_buffer, entropy_blob = self._blob(entropy)
        output = self._DataBlob()
        try:
            # CRYPTPROTECT_UI_FORBIDDEN only.  In particular, the
            # CRYPTPROTECT_LOCAL_MACHINE bit is never set.
            succeeded = self._crypt32.CryptProtectData(
                self._ctypes.byref(data_blob),
                "SAPD Wiki MCP secret",
                self._ctypes.byref(entropy_blob),
                None,
                None,
                0x1,
                self._ctypes.byref(output),
            )
            if not succeeded:
                raise SecretCustodyError("SECRET_PROTECT_FAILED")
            return self._ctypes.string_at(output.pbData, output.cbData)
        finally:
            self._ctypes.memset(data_buffer, 0, len(data_buffer))
            self._ctypes.memset(entropy_buffer, 0, len(entropy_buffer))
            self._release(output)

    def unprotect(
        self,
        ciphertext: bytes,
        *,
        entropy: bytes,
        scope: str,
        ui_forbidden: bool,
    ) -> bytes:
        self._require_contract(scope=scope, ui_forbidden=ui_forbidden)
        data_buffer, data_blob = self._blob(ciphertext)
        entropy_buffer, entropy_blob = self._blob(entropy)
        output = self._DataBlob()
        try:
            succeeded = self._crypt32.CryptUnprotectData(
                self._ctypes.byref(data_blob),
                None,
                self._ctypes.byref(entropy_blob),
                None,
                None,
                0x1,
                self._ctypes.byref(output),
            )
            if not succeeded:
                raise SecretCustodyError("SECRET_UNPROTECT_FAILED")
            return self._ctypes.string_at(output.pbData, output.cbData)
        finally:
            self._ctypes.memset(data_buffer, 0, len(data_buffer))
            self._ctypes.memset(entropy_buffer, 0, len(entropy_buffer))
            self._release(output)


class WindowsDpapiCurrentUserProvider:
    """Persistent current-user-only DPAPI custody for Windows MCP secrets."""

    backend = "windows_dpapi_current_user"
    scope = "current_user"
    dpapi_scope = "CurrentUser"
    persistent = True
    local_machine = False
    synchronizable = False
    current_user_only = True
    uses_local_machine_scope = False

    def __init__(
        self,
        storage_root: Path,
        *,
        native_api: WindowsDpapiNativeApi | None = None,
        mutation_enabled: bool = False,
    ) -> None:
        production_native = native_api is None
        self.native_api = native_api or CtypesWindowsDpapiNativeApi()
        candidate = Path(storage_root)
        try:
            self.storage_root = ensure_secure_directory(
                candidate,
                require_fixed_windows_mcp_root=production_native,
            )
        except (OSError, PathSecurityError) as exc:
            raise SecretCustodyError("SECRET_STORE_UNAVAILABLE") from exc
        self.mutation_enabled = bool(mutation_enabled)

    @staticmethod
    def _reference(reference: str) -> str:
        return FakeBoundPlatformSecretProvider._validate_reference(reference)

    def _blob_path(self, reference: str) -> Path:
        digest = sha256(self._reference(reference).encode("utf-8")).hexdigest()
        return self.storage_root / f"{digest}.dpapi"

    @staticmethod
    def _entropy(reference: str) -> bytes:
        return sha256(
            b"sapd-wiki-mcp:windows-dpapi:v1\0"
            + reference.encode("utf-8")
        ).digest()

    def get_secret(self, reference: str) -> bytes | None:
        reference = self._reference(reference)
        path = self._blob_path(reference)
        if path.is_symlink():
            raise SecretCustodyError("SECRET_STORE_INVALID")
        if not path.exists():
            return None
        try:
            assert_secure_regular_file(path)
            ciphertext = path.read_bytes()
        except PathSecurityError as exc:
            raise SecretCustodyError("SECRET_STORE_INVALID") from exc
        except OSError as exc:
            raise SecretCustodyError("SECRET_STORE_UNAVAILABLE") from exc
        if not ciphertext or len(ciphertext) > 1024 * 1024:
            raise SecretCustodyError("SECRET_VALUE_INVALID")
        try:
            secret = self.native_api.unprotect(
                ciphertext,
                entropy=self._entropy(reference),
                scope=self.dpapi_scope,
                ui_forbidden=True,
            )
        except SecretCustodyError:
            raise
        except Exception:
            raise SecretCustodyError("SECRET_UNPROTECT_FAILED") from None
        if not isinstance(secret, bytes) or len(secret) < 32:
            raise SecretCustodyError("SECRET_VALUE_INVALID")
        return bytes(secret)

    def put_secret(self, reference: str, secret: bytes) -> None:
        if not self.mutation_enabled:
            raise SecretCustodyError("SECRET_WRITE_NOT_AUTHORIZED")
        reference = self._reference(reference)
        if not isinstance(secret, bytes) or not 32 <= len(secret) <= 64 * 1024:
            raise SecretCustodyError("SECRET_VALUE_INVALID")
        try:
            ciphertext = self.native_api.protect(
                secret,
                entropy=self._entropy(reference),
                scope=self.dpapi_scope,
                ui_forbidden=True,
            )
        except SecretCustodyError:
            raise
        except Exception:
            raise SecretCustodyError("SECRET_PROTECT_FAILED") from None
        if not isinstance(ciphertext, bytes) or not ciphertext:
            raise SecretCustodyError("SECRET_PROTECT_FAILED")
        path = self._blob_path(reference)
        if path.is_symlink():
            raise SecretCustodyError("SECRET_STORE_INVALID")
        try:
            if path.exists():
                assert_secure_regular_file(path)
            atomic_write_secure(path, ciphertext)
        except (OSError, PathSecurityError) as exc:
            raise SecretCustodyError("SECRET_WRITE_FAILED") from exc

    def delete_secret(self, reference: str) -> None:
        if not self.mutation_enabled:
            raise SecretCustodyError("SECRET_WRITE_NOT_AUTHORIZED")
        path = self._blob_path(self._reference(reference))
        try:
            if path.is_symlink():
                raise SecretCustodyError("SECRET_STORE_INVALID")
            if path.exists():
                assert_secure_regular_file(path)
            path.unlink(missing_ok=True)
        except (OSError, PathSecurityError) as exc:
            raise SecretCustodyError("SECRET_DELETE_FAILED") from exc


@dataclass(frozen=True, slots=True)
class KeychainCommandResult:
    returncode: int
    stdout: bytes
    stderr: bytes


class KeychainCommandRunner(Protocol):
    def run(
        self,
        argv: tuple[str, ...],
        *,
        input_bytes: bytes | None = None,
    ) -> KeychainCommandResult: ...


class SubprocessKeychainCommandRunner:
    def run(
        self,
        argv: tuple[str, ...],
        *,
        input_bytes: bytes | None = None,
    ) -> KeychainCommandResult:
        completed = subprocess.run(
            argv,
            input=input_bytes,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            shell=False,
            check=False,
            timeout=30,
            env={"PATH": "/usr/bin:/bin"},
        )
        return KeychainCommandResult(
            returncode=completed.returncode,
            stdout=completed.stdout[:4096],
            stderr=completed.stderr[:4096],
        )


def _security_interactive_argument(value: str) -> str:
    """Quote a controlled value for ``security -i`` without using argv."""

    if not isinstance(value, str) or any(character in value for character in "\x00\r\n"):
        raise SecretCustodyError("SECRET_VALUE_INVALID")
    return '"' + value.replace("\\", "\\\\").replace('"', '\\"') + '"'


class MacOSWebDevKeychainSecretProvider:
    """Persistent Web-dev custody using the current user's login Keychain.

    Secret bytes travel through a private child stdin pipe, never argv,
    environment variables or an ordinary file.  The current macOS 0.3.0 path
    uses this adapter until a separately authorized native integration exists.
    """

    backend = "macos_web_dev_keychain"
    scope = "current_user"
    persistent = True
    local_machine = False
    synchronizable = False

    def __init__(
        self,
        *,
        runner: KeychainCommandRunner | None = None,
        mutation_enabled: bool = False,
        login_keychain: Path | None = None,
    ) -> None:
        self.runner = runner or SubprocessKeychainCommandRunner()
        self.mutation_enabled = bool(mutation_enabled)
        candidate = login_keychain or (
            Path.home() / "Library" / "Keychains" / "login.keychain-db"
        )
        if not candidate.is_absolute():
            raise SecretCustodyError("SECRET_STORE_INVALID")
        self.login_keychain = candidate
        self.service = "com.sapd-wiki.local-mcp.web-dev"

    @staticmethod
    def _require_platform() -> None:
        if os.name == "nt" or not Path("/usr/bin/security").is_file():
            raise SecretCustodyError("SECRET_BACKEND_UNAVAILABLE")

    @staticmethod
    def _account(reference: str) -> str:
        return FakeBoundPlatformSecretProvider._validate_reference(reference)

    def get_secret(self, reference: str) -> bytes | None:
        self._require_platform()
        result = self.runner.run(
            (
                "/usr/bin/security",
                "find-generic-password",
                "-a",
                self._account(reference),
                "-s",
                self.service,
                "-w",
                str(self.login_keychain),
            )
        )
        if result.returncode == 44:
            return None
        if result.returncode != 0:
            raise SecretCustodyError("SECRET_STORE_UNAVAILABLE")
        value = result.stdout.rstrip(b"\r\n")
        if len(value) < 32:
            raise SecretCustodyError("SECRET_VALUE_INVALID")
        return bytes(value)

    def put_secret(self, reference: str, secret: bytes) -> None:
        self._require_platform()
        if not self.mutation_enabled:
            raise SecretCustodyError("SECRET_WRITE_NOT_AUTHORIZED")
        if not isinstance(secret, bytes) or len(secret) < 32:
            raise SecretCustodyError("SECRET_VALUE_INVALID")
        try:
            secret_text = secret.decode("ascii")
        except UnicodeError as exc:
            raise SecretCustodyError("SECRET_VALUE_INVALID") from exc
        # ``security add-generic-password ... <keychain> -w`` is rejected by
        # the macOS CLI because ``-w`` consumes the next positional value.
        # Supplying the password as a normal ``-w <value>`` argument would
        # expose it in the process list.  The interactive mode accepts the
        # complete command over a private stdin pipe, so neither the secret nor
        # its Keychain reference enters argv, the environment, or a file.
        prompt_value = (
            "add-generic-password "
            f"-a {_security_interactive_argument(self._account(reference))} "
            f"-s {_security_interactive_argument(self.service)} "
            "-U "
            f"-w {_security_interactive_argument(secret_text)} "
            f"{_security_interactive_argument(str(self.login_keychain))}\n"
        ).encode("utf-8")
        result = self.runner.run(
            ("/usr/bin/security", "-i"),
            input_bytes=prompt_value,
        )
        if result.returncode != 0:
            if result.returncode in KEYCHAIN_TEMPORARY_FAILURE_RETURN_CODES:
                raise SecretCustodyError("SECRET_STORE_UNAVAILABLE")
            raise SecretCustodyError("SECRET_WRITE_FAILED")

    def delete_secret(self, reference: str) -> None:
        self._require_platform()
        if not self.mutation_enabled:
            raise SecretCustodyError("SECRET_WRITE_NOT_AUTHORIZED")
        result = self.runner.run(
            (
                "/usr/bin/security",
                "delete-generic-password",
                "-a",
                self._account(reference),
                "-s",
                self.service,
                str(self.login_keychain),
            )
        )
        if result.returncode not in {0, 44}:
            if result.returncode in KEYCHAIN_TEMPORARY_FAILURE_RETURN_CODES:
                raise SecretCustodyError("SECRET_STORE_UNAVAILABLE")
            raise SecretCustodyError("SECRET_DELETE_FAILED")
