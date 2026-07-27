"""One-shot, instance-bound parent-to-Sidecar secret delivery.

The Web C0-B implementation deliberately uses an unnamed local socket pair.
Only the spawned child receives the inheritable endpoint. No passphrase,
certificate path, secret reference, nonce, or generation is placed in argv,
the environment, a named socket, or a regular file.
"""

from __future__ import annotations

import base64
import ctypes
import json
import multiprocessing.connection
import os
import re
import secrets
import socket
import stat
import subprocess
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Callable, Protocol

from .tls import (
    KEY_PASSPHRASE_IPC_UNSAFE,
    SecretTransportAttestation,
    TLSIdentityError,
)


PROTOCOL_VERSION = 1
MAX_FRAME_BYTES = 32 * 1024
DEFAULT_TIMEOUT_SECONDS = 5.0
_TOKEN_RE = re.compile(r"^[A-Za-z0-9:_-]{16,160}$")


def _unsafe() -> TLSIdentityError:
    return TLSIdentityError(KEY_PASSPHRASE_IPC_UNSAFE)


def _require_token(value: object) -> str:
    if not isinstance(value, str) or not _TOKEN_RE.fullmatch(value):
        raise _unsafe()
    return value


def _require_closed_object(
    value: object,
    *,
    required: frozenset[str],
) -> dict[str, object]:
    if not isinstance(value, dict) or set(value) != required:
        raise _unsafe()
    return value


def _send_frame(channel: _FrameStream, payload: dict[str, object]) -> None:
    try:
        encoded = json.dumps(
            payload,
            ensure_ascii=True,
            sort_keys=True,
            separators=(",", ":"),
        ).encode("utf-8")
    except (TypeError, ValueError) as exc:
        raise _unsafe() from exc
    if not encoded or len(encoded) > MAX_FRAME_BYTES:
        raise _unsafe()
    frame = len(encoded).to_bytes(4, "big") + encoded
    try:
        channel.sendall(frame)
    except OSError as exc:
        raise _unsafe() from exc


def _recv_exact(channel: _FrameStream, size: int) -> bytes:
    chunks: list[bytes] = []
    remaining = size
    while remaining:
        try:
            chunk = channel.recv(remaining)
        except (OSError, TimeoutError) as exc:
            raise _unsafe() from exc
        if not chunk:
            raise _unsafe()
        chunks.append(chunk)
        remaining -= len(chunk)
    return b"".join(chunks)


def _recv_frame(channel: _FrameStream) -> dict[str, object]:
    size = int.from_bytes(_recv_exact(channel, 4), "big")
    if not 1 <= size <= MAX_FRAME_BYTES:
        raise _unsafe()
    try:
        decoded = json.loads(_recv_exact(channel, size).decode("utf-8"))
    except (UnicodeError, json.JSONDecodeError) as exc:
        raise _unsafe() from exc
    if not isinstance(decoded, dict):
        raise _unsafe()
    return decoded


def _current_uid() -> int:
    if not hasattr(os, "getuid") or not hasattr(os, "geteuid"):
        raise _unsafe()
    uid = os.getuid()
    euid = os.geteuid()
    if uid != euid or uid < 0:
        raise _unsafe()
    return uid


def _current_windows_sid() -> str:
    if os.name != "nt":
        raise _unsafe()
    from ctypes import wintypes

    TOKEN_QUERY = 0x0008
    TOKEN_USER = 1

    class SID_AND_ATTRIBUTES(ctypes.Structure):
        _fields_ = [
            ("Sid", wintypes.LPVOID),
            ("Attributes", wintypes.DWORD),
        ]

    class TOKEN_USER_VALUE(ctypes.Structure):
        _fields_ = [("User", SID_AND_ATTRIBUTES)]

    kernel32 = ctypes.WinDLL("kernel32", use_last_error=True)
    advapi32 = ctypes.WinDLL("advapi32", use_last_error=True)
    advapi32.OpenProcessToken.argtypes = (
        wintypes.HANDLE,
        wintypes.DWORD,
        ctypes.POINTER(wintypes.HANDLE),
    )
    advapi32.OpenProcessToken.restype = wintypes.BOOL
    advapi32.GetTokenInformation.argtypes = (
        wintypes.HANDLE,
        ctypes.c_uint,
        ctypes.c_void_p,
        wintypes.DWORD,
        ctypes.POINTER(wintypes.DWORD),
    )
    advapi32.GetTokenInformation.restype = wintypes.BOOL
    advapi32.ConvertSidToStringSidW.argtypes = (
        ctypes.c_void_p,
        ctypes.POINTER(wintypes.LPWSTR),
    )
    advapi32.ConvertSidToStringSidW.restype = wintypes.BOOL
    kernel32.GetCurrentProcess.restype = wintypes.HANDLE
    kernel32.LocalFree.argtypes = (ctypes.c_void_p,)
    kernel32.LocalFree.restype = ctypes.c_void_p
    kernel32.CloseHandle.argtypes = (wintypes.HANDLE,)
    kernel32.CloseHandle.restype = wintypes.BOOL
    token = wintypes.HANDLE()
    if not advapi32.OpenProcessToken(
        kernel32.GetCurrentProcess(),
        TOKEN_QUERY,
        ctypes.byref(token),
    ):
        raise _unsafe()
    try:
        required = wintypes.DWORD()
        advapi32.GetTokenInformation(
            token,
            TOKEN_USER,
            None,
            0,
            ctypes.byref(required),
        )
        if (
            ctypes.get_last_error() != 122
            or required.value <= 0
            or required.value > 64 * 1024
        ):
            raise _unsafe()
        buffer = ctypes.create_string_buffer(required.value)
        if not advapi32.GetTokenInformation(
            token,
            TOKEN_USER,
            buffer,
            required,
            ctypes.byref(required),
        ):
            raise _unsafe()
        token_user = ctypes.cast(
            buffer,
            ctypes.POINTER(TOKEN_USER_VALUE),
        ).contents
        value = wintypes.LPWSTR()
        if not advapi32.ConvertSidToStringSidW(
            token_user.User.Sid,
            ctypes.byref(value),
        ):
            raise _unsafe()
        try:
            sid = str(value.value or "")
        finally:
            kernel32.LocalFree(value)
    finally:
        kernel32.CloseHandle(token)
    if not re.fullmatch(r"S-\d(?:-\d+)+", sid):
        raise _unsafe()
    return sid


def _validate_unnamed_local_socket(channel: socket.socket) -> None:
    if channel.family != socket.AF_UNIX:
        raise _unsafe()
    try:
        info = os.fstat(channel.fileno())
        local_name = channel.getsockname()
        peer_name = channel.getpeername()
    except OSError as exc:
        raise _unsafe() from exc
    if not stat.S_ISSOCK(info.st_mode):
        raise _unsafe()
    if local_name not in {"", b""} or peer_name not in {"", b""}:
        raise _unsafe()


def _validate_private_identity_file(path_value: object) -> Path:
    if not isinstance(path_value, str):
        raise _unsafe()
    path = Path(path_value)
    if not path.is_absolute() or path.is_symlink():
        raise _unsafe()
    if os.name == "nt":
        try:
            from .path_security import PathSecurityError, assert_secure_regular_file

            assert_secure_regular_file(path)
            return path.resolve(strict=True)
        except (OSError, PathSecurityError) as exc:
            raise _unsafe() from exc
    try:
        info = path.stat()
    except OSError as exc:
        raise _unsafe() from exc
    if not stat.S_ISREG(info.st_mode) or info.st_nlink != 1 or info.st_mode & 0o077:
        raise _unsafe()
    return path.resolve(strict=True)


class _FrameStream(Protocol):
    def sendall(self, value: bytes) -> None: ...

    def recv(self, size: int) -> bytes: ...

    def close(self) -> None: ...


class _PipeFrameStream:
    """Present a connected multiprocessing Pipe handle as a bounded byte stream."""

    def __init__(
        self,
        connection: multiprocessing.connection.Connection,
        *,
        timeout_seconds: float,
    ) -> None:
        self._connection = connection
        self._timeout_seconds = timeout_seconds
        self._buffer = bytearray()

    def sendall(self, value: bytes) -> None:
        try:
            self._connection.send_bytes(value)
        except (EOFError, OSError) as exc:
            raise _unsafe() from exc

    def recv(self, size: int) -> bytes:
        if not self._buffer:
            try:
                if not self._connection.poll(self._timeout_seconds):
                    raise _unsafe()
                packet = self._connection.recv_bytes(MAX_FRAME_BYTES + 4)
            except (EOFError, OSError) as exc:
                raise _unsafe() from exc
            self._buffer.extend(packet)
        value = bytes(self._buffer[:size])
        del self._buffer[:size]
        return value

    def close(self) -> None:
        self._connection.close()


def _deliver_one_shot(
    channel: _FrameStream,
    *,
    nonce: str,
    used: bool,
    child_pid: int,
    generation_id: str,
    certificate_path: Path,
    encrypted_private_key_path: Path,
    secret_loader: Callable[[], bytes | None],
    principal_source: Callable[[], object],
) -> SecretTransportAttestation:
    if used:
        raise _unsafe()
    generation = _require_token(generation_id)
    if not isinstance(child_pid, int) or child_pid <= 1:
        raise _unsafe()
    principal = principal_source()
    if not isinstance(principal, (int, str)):
        raise _unsafe()
    parent_pid = os.getpid()
    _send_frame(
        channel,
        {
            "message_type": "challenge",
            "protocol_version": PROTOCOL_VERSION,
            "nonce": nonce,
            "generation_id": generation,
            "parent_pid": parent_pid,
            "owner_uid": principal,
        },
    )
    hello = _require_closed_object(
        _recv_frame(channel),
        required=frozenset(
            {
                "message_type",
                "protocol_version",
                "nonce",
                "generation_id",
                "parent_pid",
                "child_pid",
                "child_uid",
            }
        ),
    )
    if (
        hello["message_type"] != "hello"
        or hello["protocol_version"] != PROTOCOL_VERSION
        or hello["nonce"] != nonce
        or hello["generation_id"] != generation
        or hello["parent_pid"] != parent_pid
        or hello["child_pid"] != child_pid
        or hello["child_uid"] != principal
    ):
        raise _unsafe()
    secret_value = secret_loader()
    if not isinstance(secret_value, bytes) or len(secret_value) < 32:
        raise TLSIdentityError("KEY_PASSPHRASE_UNAVAILABLE")
    passphrase = bytearray(secret_value)
    try:
        _send_frame(
            channel,
            {
                "message_type": "secret",
                "protocol_version": PROTOCOL_VERSION,
                "nonce": nonce,
                "generation_id": generation,
                "parent_pid": parent_pid,
                "child_pid": child_pid,
                "owner_uid": principal,
                "certificate_path": str(certificate_path),
                "encrypted_private_key_path": str(encrypted_private_key_path),
                "passphrase_base64": base64.b64encode(passphrase).decode("ascii"),
            },
        )
    finally:
        for index in range(len(passphrase)):
            passphrase[index] = 0
    acknowledgement = _require_closed_object(
        _recv_frame(channel),
        required=frozenset(
            {
                "message_type",
                "protocol_version",
                "nonce",
                "generation_id",
                "child_pid",
            }
        ),
    )
    if (
        acknowledgement["message_type"] != "consumed"
        or acknowledgement["protocol_version"] != PROTOCOL_VERSION
        or acknowledgement["nonce"] != nonce
        or acknowledgement["generation_id"] != generation
        or acknowledgement["child_pid"] != child_pid
    ):
        raise _unsafe()
    return SecretTransportAttestation.one_shot_local_channel()


@dataclass(slots=True)
class ReceivedSecret:
    certificate_path: Path
    encrypted_private_key_path: Path
    generation_id: str
    attestation: SecretTransportAttestation
    _passphrase: bytearray
    _consumed: bool = False

    def consume_passphrase(self) -> bytearray:
        if self._consumed or not self._passphrase:
            raise _unsafe()
        self._consumed = True
        value = self._passphrase
        self._passphrase = bytearray()
        return value

    def close(self) -> None:
        for index in range(len(self._passphrase)):
            self._passphrase[index] = 0
        self._passphrase.clear()
        self._consumed = True


class ParentSecretChannel:
    """Parent endpoint for one spawned child and one secret generation."""

    def __init__(
        self,
        *,
        timeout_seconds: float = DEFAULT_TIMEOUT_SECONDS,
        nonce_source: Callable[[int], bytes] = secrets.token_bytes,
    ) -> None:
        if os.name != "posix":
            raise _unsafe()
        parent, child = socket.socketpair(socket.AF_UNIX, socket.SOCK_STREAM)
        parent.settimeout(timeout_seconds)
        # Keep the inherited endpoint blocking. Socket timeout mode is backed by
        # O_NONBLOCK and is shared by duplicated/inherited descriptors on POSIX.
        # The child installs its own bounded timeout after constructing the
        # socket object in receive_one_shot_secret().
        child.setblocking(True)
        parent.set_inheritable(False)
        child.set_inheritable(True)
        _validate_unnamed_local_socket(parent)
        _validate_unnamed_local_socket(child)
        nonce = nonce_source(32)
        if not isinstance(nonce, bytes) or len(nonce) != 32:
            parent.close()
            child.close()
            raise _unsafe()
        self._parent = parent
        self._child = child
        self._nonce = base64.urlsafe_b64encode(nonce).decode("ascii").rstrip("=")
        self._used = False

    @property
    def child_fd(self) -> int:
        if self._child is None:
            raise _unsafe()
        return self._child.fileno()

    @property
    def endpoint_kind(self) -> str:
        return "posix-fd"

    @property
    def child_endpoint(self) -> int:
        return self.child_fd

    def popen_kwargs(self) -> dict[str, Any]:
        return {"pass_fds": (self.child_fd,)}

    def close_child_copy(self) -> None:
        if self._child is not None:
            self._child.close()
            self._child = None

    def deliver(
        self,
        *,
        child_pid: int,
        generation_id: str,
        certificate_path: Path,
        encrypted_private_key_path: Path,
        secret_loader: Callable[[], bytes | None],
    ) -> SecretTransportAttestation:
        if self._used or self._parent is None or self._child is not None:
            raise _unsafe()
        self._used = True
        try:
            return _deliver_one_shot(
                self._parent,
                nonce=self._nonce,
                used=False,
                child_pid=child_pid,
                generation_id=generation_id,
                certificate_path=certificate_path,
                encrypted_private_key_path=encrypted_private_key_path,
                secret_loader=secret_loader,
                principal_source=_current_uid,
            )
        except TLSIdentityError:
            raise
        except Exception as exc:
            raise _unsafe() from exc
        finally:
            self.close()

    def close(self) -> None:
        self.close_child_copy()
        if self._parent is not None:
            self._parent.close()
            self._parent = None


class WindowsParentSecretChannel:
    """One connected Pipe endpoint inherited by exactly one Windows child."""

    def __init__(
        self,
        *,
        timeout_seconds: float = DEFAULT_TIMEOUT_SECONDS,
        nonce_source: Callable[[int], bytes] = secrets.token_bytes,
        principal_source: Callable[[], object] = _current_windows_sid,
        pipe_factory: Callable[..., tuple[Any, Any]] = (
            multiprocessing.connection.Pipe
        ),
    ) -> None:
        if os.name != "nt" and principal_source is _current_windows_sid:
            raise _unsafe()
        parent, child = pipe_factory(duplex=True)
        try:
            nonce = nonce_source(32)
            if not isinstance(nonce, bytes) or len(nonce) != 32:
                raise _unsafe()
            self._parent = _PipeFrameStream(
                parent,
                timeout_seconds=timeout_seconds,
            )
            self._child = child
            self._nonce = (
                base64.urlsafe_b64encode(nonce).decode("ascii").rstrip("=")
            )
            self._principal_source = principal_source
            self._used = False
            if os.name == "nt":
                os.set_handle_inheritable(self.child_endpoint, True)
        except Exception:
            parent.close()
            child.close()
            raise

    @property
    def endpoint_kind(self) -> str:
        return "windows-handle"

    @property
    def child_endpoint(self) -> int:
        if self._child is None:
            raise _unsafe()
        return int(self._child.fileno())

    def popen_kwargs(self) -> dict[str, Any]:
        if os.name != "nt":
            return {}
        startupinfo = subprocess.STARTUPINFO()
        startupinfo.lpAttributeList = {
            "handle_list": [self.child_endpoint],
        }
        return {"startupinfo": startupinfo}

    def close_child_copy(self) -> None:
        if self._child is not None:
            self._child.close()
            self._child = None

    def deliver(
        self,
        *,
        child_pid: int,
        generation_id: str,
        certificate_path: Path,
        encrypted_private_key_path: Path,
        secret_loader: Callable[[], bytes | None],
    ) -> SecretTransportAttestation:
        if self._used or self._parent is None or self._child is not None:
            raise _unsafe()
        self._used = True
        try:
            return _deliver_one_shot(
                self._parent,
                nonce=self._nonce,
                used=False,
                child_pid=child_pid,
                generation_id=generation_id,
                certificate_path=certificate_path,
                encrypted_private_key_path=encrypted_private_key_path,
                secret_loader=secret_loader,
                principal_source=self._principal_source,
            )
        except TLSIdentityError:
            raise
        except Exception as exc:
            raise _unsafe() from exc
        finally:
            self.close()

    def close(self) -> None:
        self.close_child_copy()
        if self._parent is not None:
            self._parent.close()
            self._parent = None


def create_parent_secret_channel() -> ParentSecretChannel | WindowsParentSecretChannel:
    if os.name == "nt":
        return WindowsParentSecretChannel()
    return ParentSecretChannel()


def receive_one_shot_secret(
    inherited_endpoint: int,
    *,
    channel_kind: str | None = None,
    timeout_seconds: float = DEFAULT_TIMEOUT_SECONDS,
    principal_source: Callable[[], object] | None = None,
    parent_pid_source: Callable[[], int] = os.getppid,
    child_pid_source: Callable[[], int] = os.getpid,
) -> ReceivedSecret:
    """Consume one delivery from the single endpoint inherited by this child."""

    if not isinstance(inherited_endpoint, int) or inherited_endpoint <= 2:
        raise _unsafe()
    kind = channel_kind or (
        "windows-handle" if os.name == "nt" else "posix-fd"
    )
    if kind == "posix-fd":
        if os.name != "posix":
            raise _unsafe()
        try:
            socket_channel = socket.socket(fileno=inherited_endpoint)
        except OSError as exc:
            raise _unsafe() from exc
        socket_channel.settimeout(timeout_seconds)
        _validate_unnamed_local_socket(socket_channel)
        channel: _FrameStream = socket_channel
        identity_source = principal_source or _current_uid
    elif kind == "windows-handle":
        if os.name != "nt" and principal_source is None:
            raise _unsafe()
        try:
            connection_type = (
                multiprocessing.connection.PipeConnection
                if os.name == "nt"
                else multiprocessing.connection.Connection
            )
            connection = connection_type(
                inherited_endpoint,
                readable=True,
                writable=True,
            )
        except (OSError, ValueError) as exc:
            raise _unsafe() from exc
        channel = _PipeFrameStream(
            connection,
            timeout_seconds=timeout_seconds,
        )
        identity_source = principal_source or _current_windows_sid
    else:
        raise _unsafe()
    passphrase = bytearray()
    try:
        challenge = _require_closed_object(
            _recv_frame(channel),
            required=frozenset(
                {
                    "message_type",
                    "protocol_version",
                    "nonce",
                    "generation_id",
                    "parent_pid",
                    "owner_uid",
                }
            ),
        )
        nonce = _require_token(challenge["nonce"])
        generation = _require_token(challenge["generation_id"])
        principal = identity_source()
        if not isinstance(principal, (int, str)):
            raise _unsafe()
        parent_pid = parent_pid_source()
        child_pid = child_pid_source()
        if (
            challenge["message_type"] != "challenge"
            or challenge["protocol_version"] != PROTOCOL_VERSION
            or challenge["parent_pid"] != parent_pid
            or challenge["owner_uid"] != principal
        ):
            raise _unsafe()
        _send_frame(
            channel,
            {
                "message_type": "hello",
                "protocol_version": PROTOCOL_VERSION,
                "nonce": nonce,
                "generation_id": generation,
                "parent_pid": parent_pid,
                "child_pid": child_pid,
                "child_uid": principal,
            },
        )
        secret = _require_closed_object(
            _recv_frame(channel),
            required=frozenset(
                {
                    "message_type",
                    "protocol_version",
                    "nonce",
                    "generation_id",
                    "parent_pid",
                    "child_pid",
                    "owner_uid",
                    "certificate_path",
                    "encrypted_private_key_path",
                    "passphrase_base64",
                }
            ),
        )
        if (
            secret["message_type"] != "secret"
            or secret["protocol_version"] != PROTOCOL_VERSION
            or secret["nonce"] != nonce
            or secret["generation_id"] != generation
            or secret["parent_pid"] != parent_pid
            or secret["child_pid"] != child_pid
            or secret["owner_uid"] != principal
        ):
            raise _unsafe()
        try:
            passphrase = bytearray(
                base64.b64decode(
                    str(secret["passphrase_base64"]),
                    validate=True,
                )
            )
        except (ValueError, TypeError) as exc:
            raise _unsafe() from exc
        if len(passphrase) < 32:
            raise _unsafe()
        certificate_path = _validate_private_identity_file(
            secret["certificate_path"]
        )
        encrypted_private_key_path = _validate_private_identity_file(
            secret["encrypted_private_key_path"]
        )
        _send_frame(
            channel,
            {
                "message_type": "consumed",
                "protocol_version": PROTOCOL_VERSION,
                "nonce": nonce,
                "generation_id": generation,
                "child_pid": child_pid,
            },
        )
        return ReceivedSecret(
            certificate_path=certificate_path,
            encrypted_private_key_path=encrypted_private_key_path,
            generation_id=generation,
            attestation=SecretTransportAttestation.one_shot_local_channel(),
            _passphrase=passphrase,
        )
    except TLSIdentityError:
        for index in range(len(passphrase)):
            passphrase[index] = 0
        raise
    except Exception as exc:
        for index in range(len(passphrase)):
            passphrase[index] = 0
        raise _unsafe() from exc
    finally:
        channel.close()
