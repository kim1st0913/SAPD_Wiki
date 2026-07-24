"""One-shot, instance-bound parent-to-Sidecar secret delivery.

The Web C0-B implementation deliberately uses an unnamed local socket pair.
Only the spawned child receives the inheritable endpoint. No passphrase,
certificate path, secret reference, nonce, or generation is placed in argv,
the environment, a named socket, or a regular file.
"""

from __future__ import annotations

import base64
import json
import os
import re
import secrets
import socket
import stat
from dataclasses import dataclass
from pathlib import Path
from typing import Callable

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


def _send_frame(channel: socket.socket, payload: dict[str, object]) -> None:
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


def _recv_exact(channel: socket.socket, size: int) -> bytes:
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


def _recv_frame(channel: socket.socket) -> dict[str, object]:
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
    try:
        info = path.stat()
    except OSError as exc:
        raise _unsafe() from exc
    if not stat.S_ISREG(info.st_mode) or info.st_nlink != 1 or info.st_mode & 0o077:
        raise _unsafe()
    return path.resolve(strict=True)


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
        generation = _require_token(generation_id)
        if not isinstance(child_pid, int) or child_pid <= 1:
            raise _unsafe()
        uid = _current_uid()
        parent_pid = os.getpid()
        try:
            _send_frame(
                self._parent,
                {
                    "message_type": "challenge",
                    "protocol_version": PROTOCOL_VERSION,
                    "nonce": self._nonce,
                    "generation_id": generation,
                    "parent_pid": parent_pid,
                    "owner_uid": uid,
                },
            )
            hello = _require_closed_object(
                _recv_frame(self._parent),
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
                or hello["nonce"] != self._nonce
                or hello["generation_id"] != generation
                or hello["parent_pid"] != parent_pid
                or hello["child_pid"] != child_pid
                or hello["child_uid"] != uid
            ):
                raise _unsafe()
            secret_value = secret_loader()
            if not isinstance(secret_value, bytes) or len(secret_value) < 32:
                raise TLSIdentityError("KEY_PASSPHRASE_UNAVAILABLE")
            passphrase = bytearray(secret_value)
            try:
                _send_frame(
                    self._parent,
                    {
                        "message_type": "secret",
                        "protocol_version": PROTOCOL_VERSION,
                        "nonce": self._nonce,
                        "generation_id": generation,
                        "parent_pid": parent_pid,
                        "child_pid": child_pid,
                        "owner_uid": uid,
                        "certificate_path": str(certificate_path),
                        "encrypted_private_key_path": str(
                            encrypted_private_key_path
                        ),
                        "passphrase_base64": base64.b64encode(passphrase).decode("ascii"),
                    },
                )
            finally:
                for index in range(len(passphrase)):
                    passphrase[index] = 0
            acknowledgement = _require_closed_object(
                _recv_frame(self._parent),
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
                or acknowledgement["nonce"] != self._nonce
                or acknowledgement["generation_id"] != generation
                or acknowledgement["child_pid"] != child_pid
            ):
                raise _unsafe()
            return SecretTransportAttestation.one_shot_local_channel()
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


def receive_one_shot_secret(
    inherited_fd: int,
    *,
    timeout_seconds: float = DEFAULT_TIMEOUT_SECONDS,
) -> ReceivedSecret:
    """Consume one parent delivery from an inherited unnamed local socket."""

    if os.name != "posix" or not isinstance(inherited_fd, int) or inherited_fd <= 2:
        raise _unsafe()
    try:
        channel = socket.socket(fileno=inherited_fd)
    except OSError as exc:
        raise _unsafe() from exc
    channel.settimeout(timeout_seconds)
    passphrase = bytearray()
    try:
        _validate_unnamed_local_socket(channel)
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
        uid = _current_uid()
        parent_pid = os.getppid()
        child_pid = os.getpid()
        if (
            challenge["message_type"] != "challenge"
            or challenge["protocol_version"] != PROTOCOL_VERSION
            or challenge["parent_pid"] != parent_pid
            or challenge["owner_uid"] != uid
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
                "child_uid": uid,
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
            or secret["owner_uid"] != uid
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
