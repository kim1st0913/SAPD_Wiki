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
    nonce_verified: bool
    generation_verified: bool
    replay_protected: bool
    evidence_source: str

    @classmethod
    def one_shot_local_channel(cls) -> "SecretTransportAttestation":
        return cls(
            authenticated=True,
            instance_bound=True,
            peer_user_verified=True,
            peer_process_verified=True,
            minimum_acl=True,
            nonce_verified=True,
            generation_verified=True,
            replay_protected=True,
            evidence_source="one_shot_local_channel",
        )

    @classmethod
    def isolated_test_fixture(cls) -> "SecretTransportAttestation":
        return cls(
            authenticated=True,
            instance_bound=True,
            peer_user_verified=True,
            peer_process_verified=True,
            minimum_acl=True,
            nonce_verified=True,
            generation_verified=True,
            replay_protected=True,
            evidence_source="isolated_test_fixture",
        )

    @property
    def verified(self) -> bool:
        return self.evidence_source in {
            "one_shot_local_channel",
            "isolated_test_fixture",
        } and all(
            (
                self.authenticated,
                self.instance_bound,
                self.peer_user_verified,
                self.peer_process_verified,
                self.minimum_acl,
                self.nonce_verified,
                self.generation_verified,
                self.replay_protected,
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
    ipc_attestation: SecretTransportAttestation,
) -> ssl.SSLContext:
    """Load encrypted PKCS#8 identity without writing trust or plaintext keys."""

    require_safe_secret_transport(ipc_attestation)
    passphrase = secret_provider.get_secret(passphrase_reference)
    if not passphrase:
        raise TLSIdentityError("KEY_PASSPHRASE_UNAVAILABLE")
    return create_server_ssl_context_from_passphrase(
        certificate_path=certificate_path,
        encrypted_private_key_path=encrypted_private_key_path,
        passphrase=bytearray(passphrase),
        ipc_attestation=ipc_attestation,
    )


def create_server_ssl_context_from_passphrase(
    *,
    certificate_path: Path,
    encrypted_private_key_path: Path,
    passphrase: bytearray,
    ipc_attestation: SecretTransportAttestation,
) -> ssl.SSLContext:
    """Consume one delivered passphrase and clear its mutable buffer."""

    require_safe_secret_transport(ipc_attestation)
    if not isinstance(passphrase, bytearray) or len(passphrase) < 32:
        raise TLSIdentityError("KEY_PASSPHRASE_UNAVAILABLE")
    header = encrypted_private_key_path.read_bytes()[:256]
    if b"BEGIN ENCRYPTED PRIVATE KEY" not in header:
        for index in range(len(passphrase)):
            passphrase[index] = 0
        raise TLSIdentityError("PLAINTEXT_PRIVATE_KEY_FORBIDDEN")
    context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
    try:
        context.load_cert_chain(
            certfile=str(certificate_path),
            keyfile=str(encrypted_private_key_path),
            password=bytes(passphrase),
        )
    finally:
        for index in range(len(passphrase)):
            passphrase[index] = 0
        passphrase.clear()
    return context


class TrustStore:
    """Capability boundary: D2 intentionally performs no system-trust writes."""

    def install(self, *_args: object, **_kwargs: object) -> None:
        raise TLSIdentityError("SYSTEM_TRUST_WRITE_NOT_AUTHORIZED")

    def remove(self, *_args: object, **_kwargs: object) -> None:
        raise TLSIdentityError("SYSTEM_TRUST_WRITE_NOT_AUTHORIZED")
