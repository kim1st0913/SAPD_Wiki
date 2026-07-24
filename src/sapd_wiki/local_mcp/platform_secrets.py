"""Fake-first platform secret custody contracts for C0-B.

These adapters intentionally keep values in memory. They model the binding
rules required from macOS Data Protection Keychain and Windows DPAPI without
calling either platform or persisting a secret blob.
"""

from __future__ import annotations

import re
import os
import subprocess
from collections.abc import MutableMapping
from dataclasses import dataclass
from pathlib import Path
from typing import Protocol


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


class MacOSWebDevKeychainSecretProvider:
    """Persistent Web-dev custody using the current user's login Keychain.

    Secret bytes travel through a private child stdin pipe, never argv,
    environment variables or an ordinary file.  The signed macOS App replaces
    this development adapter with Data Protection Keychain in D1.
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
            prompt_value = secret.decode("ascii").encode("ascii") + b"\n"
        except UnicodeError as exc:
            raise SecretCustodyError("SECRET_VALUE_INVALID") from exc
        result = self.runner.run(
            (
                "/usr/bin/security",
                "add-generic-password",
                "-a",
                self._account(reference),
                "-s",
                self.service,
                "-U",
                str(self.login_keychain),
                "-w",
            ),
            input_bytes=prompt_value,
        )
        if result.returncode != 0:
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
            raise SecretCustodyError("SECRET_DELETE_FAILED")
