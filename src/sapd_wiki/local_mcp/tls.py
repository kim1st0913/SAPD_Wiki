from __future__ import annotations

import ssl
from collections.abc import MutableMapping
from dataclasses import dataclass
from pathlib import Path
from typing import Protocol


KEY_PASSPHRASE_IPC_UNSAFE = "KEY_PASSPHRASE_IPC_UNSAFE"


class SecretProvider(Protocol):
    def get_secret(self, reference: str) -> bytes | None: ...

    def put_secret(self, reference: str, secret: bytes) -> None: ...

    def delete_secret(self, reference: str) -> None: ...


class InMemorySecretProvider:
    """Test-only provider; production platforms supply Keychain/DPAPI adapters."""

    def __init__(self) -> None:
        self._values: MutableMapping[str, bytes] = {}

    def get_secret(self, reference: str) -> bytes | None:
        value = self._values.get(reference)
        return bytes(value) if value is not None else None

    def put_secret(self, reference: str, secret: bytes) -> None:
        self._values[reference] = bytes(secret)

    def delete_secret(self, reference: str) -> None:
        self._values.pop(reference, None)


@dataclass(frozen=True)
class SecretTransportAttestation:
    authenticated: bool
    instance_bound: bool
    peer_user_verified: bool
    peer_process_verified: bool
    minimum_acl: bool

    @property
    def verified(self) -> bool:
        return all(
            (
                self.authenticated,
                self.instance_bound,
                self.peer_user_verified,
                self.peer_process_verified,
                self.minimum_acl,
            )
        )


class TLSIdentityError(RuntimeError):
    def __init__(self, code: str) -> None:
        super().__init__(code)
        self.code = code


def require_safe_secret_transport(
    attestation: SecretTransportAttestation,
) -> None:
    if not attestation.verified:
        raise TLSIdentityError(KEY_PASSPHRASE_IPC_UNSAFE)


def create_server_ssl_context(
    *,
    certificate_path: Path,
    encrypted_private_key_path: Path,
    secret_provider: SecretProvider,
    passphrase_reference: str,
    ipc_attestation: SecretTransportAttestation | None = None,
) -> ssl.SSLContext:
    """Load encrypted PKCS#8 identity without writing trust or plaintext keys."""

    if ipc_attestation is not None:
        require_safe_secret_transport(ipc_attestation)
    passphrase = secret_provider.get_secret(passphrase_reference)
    if not passphrase:
        raise TLSIdentityError("KEY_PASSPHRASE_UNAVAILABLE")
    header = encrypted_private_key_path.read_bytes()[:256]
    if b"BEGIN ENCRYPTED PRIVATE KEY" not in header:
        raise TLSIdentityError("PLAINTEXT_PRIVATE_KEY_FORBIDDEN")
    context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
    try:
        context.load_cert_chain(
            certfile=str(certificate_path),
            keyfile=str(encrypted_private_key_path),
            password=passphrase.decode("utf-8"),
        )
    finally:
        passphrase_buffer = bytearray(passphrase)
        for index in range(len(passphrase_buffer)):
            passphrase_buffer[index] = 0
    return context


class TrustStore:
    """Capability boundary: D2 intentionally performs no system-trust writes."""

    def install(self, *_args: object, **_kwargs: object) -> None:
        raise TLSIdentityError("SYSTEM_TRUST_WRITE_NOT_AUTHORIZED")

    def remove(self, *_args: object, **_kwargs: object) -> None:
        raise TLSIdentityError("SYSTEM_TRUST_WRITE_NOT_AUTHORIZED")
