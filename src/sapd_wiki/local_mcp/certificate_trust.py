"""Current-user certificate trust contracts.

The production control plane only accepts validated, App-owned targets.  The
default Web-development adapter is intentionally in memory; platform adapters
must implement the same exact-fingerprint and current-user-only contract.
"""

from __future__ import annotations

import ipaddress
import re
from dataclasses import dataclass
from datetime import UTC, datetime
from hashlib import sha256
from typing import Protocol

from cryptography import x509
from cryptography.exceptions import InvalidSignature
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import padding, rsa
from cryptography.x509.oid import ExtendedKeyUsageOID


_SHA256_FINGERPRINT_RE = re.compile(r"^(?:[0-9A-F]{2}:){31}[0-9A-F]{2}$")
_PROFILE_RE = re.compile(r"^[a-z][a-z0-9-]{1,31}$")
_GENERATION_RE = re.compile(r"^[A-Za-z0-9_-]{16,96}$")


class CertificateTrustError(RuntimeError):
    def __init__(self, code: str) -> None:
        super().__init__(code)
        self.code = code


def normalize_fingerprint(value: str) -> str:
    if not isinstance(value, str):
        raise CertificateTrustError("CERTIFICATE_FINGERPRINT_INVALID")
    normalized = value.upper()
    if not _SHA256_FINGERPRINT_RE.fullmatch(normalized):
        raise CertificateTrustError("CERTIFICATE_FINGERPRINT_INVALID")
    return normalized


def certificate_fingerprint(certificate_der: bytes) -> str:
    try:
        certificate = x509.load_der_x509_certificate(certificate_der)
    except (TypeError, ValueError) as exc:
        raise CertificateTrustError("CERTIFICATE_PUBLIC_DATA_INVALID") from exc
    digest = certificate.fingerprint(hashes.SHA256()).hex().upper()
    return ":".join(digest[index : index + 2] for index in range(0, len(digest), 2))


@dataclass(frozen=True, slots=True)
class ManagedTrustTarget:
    """Validated public trust material; never contains a private key or path."""

    install_id_hash: str
    profile: str
    generation_id: str
    display_name: str
    fingerprint_sha256: str
    certificate_der: bytes
    verification_certificate_der: bytes
    host: str = "127.0.0.1"
    policy: str = "ssl_loopback_only"

    def __post_init__(self) -> None:
        if not re.fullmatch(r"[0-9a-f]{64}", self.install_id_hash):
            raise CertificateTrustError("CERTIFICATE_OWNERSHIP_INVALID")
        if not _PROFILE_RE.fullmatch(self.profile):
            raise CertificateTrustError("CERTIFICATE_OWNERSHIP_INVALID")
        if not _GENERATION_RE.fullmatch(self.generation_id):
            raise CertificateTrustError("CERTIFICATE_OWNERSHIP_INVALID")
        if not self.display_name or len(self.display_name) > 160:
            raise CertificateTrustError("CERTIFICATE_OWNERSHIP_INVALID")
        if self.host != "127.0.0.1" or self.policy != "ssl_loopback_only":
            raise CertificateTrustError("CERTIFICATE_TRUST_POLICY_INVALID")
        expected = normalize_fingerprint(self.fingerprint_sha256)
        actual = certificate_fingerprint(self.certificate_der)
        if expected != actual:
            raise CertificateTrustError("CERTIFICATE_FINGERPRINT_MISMATCH")
        certificate = x509.load_der_x509_certificate(self.certificate_der)
        try:
            constraints = certificate.extensions.get_extension_for_class(
                x509.BasicConstraints
            ).value
        except x509.ExtensionNotFound as exc:
            raise CertificateTrustError("CERTIFICATE_PUBLIC_DATA_INVALID") from exc
        if not constraints.ca or constraints.path_length != 0:
            raise CertificateTrustError("CERTIFICATE_PUBLIC_DATA_INVALID")
        try:
            verification_certificate = x509.load_der_x509_certificate(
                self.verification_certificate_der
            )
            verification_constraints = (
                verification_certificate.extensions.get_extension_for_class(
                    x509.BasicConstraints
                ).value
            )
            subject_alt_name = (
                verification_certificate.extensions.get_extension_for_class(
                    x509.SubjectAlternativeName
                ).value
            )
            extended_key_usage = (
                verification_certificate.extensions.get_extension_for_class(
                    x509.ExtendedKeyUsage
                ).value
            )
        except (TypeError, ValueError, x509.ExtensionNotFound) as exc:
            raise CertificateTrustError("CERTIFICATE_PUBLIC_DATA_INVALID") from exc
        if verification_constraints.ca:
            raise CertificateTrustError("CERTIFICATE_PUBLIC_DATA_INVALID")
        if verification_certificate.issuer != certificate.subject:
            raise CertificateTrustError("CERTIFICATE_PUBLIC_DATA_INVALID")
        if (
            ipaddress.ip_address(self.host)
            not in subject_alt_name.get_values_for_type(x509.IPAddress)
        ):
            raise CertificateTrustError("CERTIFICATE_TRUST_POLICY_INVALID")
        if ExtendedKeyUsageOID.SERVER_AUTH not in extended_key_usage:
            raise CertificateTrustError("CERTIFICATE_TRUST_POLICY_INVALID")
        public_key = certificate.public_key()
        if not isinstance(public_key, rsa.RSAPublicKey):
            raise CertificateTrustError("CERTIFICATE_PUBLIC_DATA_INVALID")
        try:
            public_key.verify(
                verification_certificate.signature,
                verification_certificate.tbs_certificate_bytes,
                padding.PKCS1v15(),
                verification_certificate.signature_hash_algorithm,
            )
        except (InvalidSignature, TypeError, ValueError) as exc:
            raise CertificateTrustError("CERTIFICATE_PUBLIC_DATA_INVALID") from exc

    @property
    def ownership_key(self) -> tuple[str, str, str]:
        return (self.install_id_hash, self.profile, self.generation_id)

    @property
    def public_digest(self) -> str:
        payload = "|".join(
            (
                self.install_id_hash,
                self.profile,
                self.generation_id,
                self.display_name,
                self.fingerprint_sha256,
                certificate_fingerprint(self.verification_certificate_der),
                self.host,
                self.policy,
            )
        )
        return sha256(payload.encode("utf-8")).hexdigest()


@dataclass(frozen=True, slots=True)
class TrustSnapshot:
    backend: str
    scope: str
    digest: str
    managed_count: int
    conflicting_count: int
    captured_at: str


@dataclass(frozen=True, slots=True)
class TrustInspection:
    installed: bool
    conflict: bool
    policy_valid: bool = True
    conflict_count: int = 0
    backend: str = "fake_current_user_trust"
    scope: str = "current_user"
    policy: str = "ssl_loopback_only"
    verified_at: str | None = None
    reason_code: str | None = None


class CurrentUserTrustAdapter(Protocol):
    backend: str
    scope: str
    policy: str
    mutation_enabled: bool

    def snapshot(self, target: ManagedTrustTarget) -> TrustSnapshot: ...

    def inspect_target(self, target: ManagedTrustTarget) -> TrustInspection: ...

    def install_target(self, target: ManagedTrustTarget) -> bool: ...

    def remove_target(self, target: ManagedTrustTarget) -> bool: ...


@dataclass(frozen=True, slots=True)
class _FakeTrustEntry:
    ownership_key: tuple[str, str, str] | None
    display_name: str
    fingerprint_sha256: str
    policy: str
    host: str
    scope: str
    installed_at: str


def _now_iso() -> str:
    return datetime.now(UTC).isoformat().replace("+00:00", "Z")


class FakeCurrentUserTrustAdapter:
    """Pure-memory CurrentUser adapter with conflict and failure injection."""

    backend = "fake_current_user_trust"
    scope = "current_user"
    policy = "ssl_loopback_only"
    mutation_enabled = True

    def __init__(self) -> None:
        self._entries: list[_FakeTrustEntry] = []
        self._next_failure: str | None = None

    def fail_next(self, code: str) -> None:
        self._next_failure = code

    def _raise_injected_failure(self) -> None:
        code = self._next_failure
        self._next_failure = None
        if code is not None:
            raise CertificateTrustError(code)

    def _matching_owned(self, target: ManagedTrustTarget) -> list[_FakeTrustEntry]:
        return [
            item
            for item in self._entries
            if item.ownership_key == target.ownership_key
        ]

    def _conflicts(self, target: ManagedTrustTarget) -> list[_FakeTrustEntry]:
        return [
            item
            for item in self._entries
            if item.display_name == target.display_name
            and item.fingerprint_sha256 != target.fingerprint_sha256
            and (
                item.ownership_key is None
                or item.ownership_key[:2]
                != (target.install_id_hash, target.profile)
            )
        ]

    def snapshot(self, target: ManagedTrustTarget) -> TrustSnapshot:
        conflicts = self._conflicts(target)
        managed = [
            item
            for item in self._entries
            if item.ownership_key is not None
            and item.ownership_key[:2]
            == (target.install_id_hash, target.profile)
        ]
        canonical = sorted(
            (
                item.scope,
                item.display_name,
                item.fingerprint_sha256,
                item.policy,
                item.host,
                item.ownership_key or ("foreign", "foreign", "foreign"),
            )
            for item in self._entries
        )
        return TrustSnapshot(
            backend=self.backend,
            scope=self.scope,
            digest=sha256(repr(canonical).encode("utf-8")).hexdigest(),
            managed_count=len(managed),
            conflicting_count=len(conflicts),
            captured_at=_now_iso(),
        )

    def inspect_target(self, target: ManagedTrustTarget) -> TrustInspection:
        owned = self._matching_owned(target)
        exact = [
            item
            for item in owned
            if item.fingerprint_sha256 == target.fingerprint_sha256
        ]
        policy_valid = any(
            item.policy == target.policy
            and item.host == target.host
            and item.scope == self.scope
            for item in exact
        )
        conflicts = self._conflicts(target)
        installed = bool(exact) and policy_valid and not conflicts
        reason = None
        if conflicts:
            reason = "CERTIFICATE_TRUST_CONFLICT"
        elif exact and not policy_valid:
            reason = "CERTIFICATE_TRUST_POLICY_INVALID"
        elif not exact:
            reason = "CERTIFICATE_TRUST_MISSING"
        return TrustInspection(
            installed=installed,
            conflict=bool(conflicts),
            policy_valid=policy_valid,
            conflict_count=len(conflicts),
            backend=self.backend,
            scope=self.scope,
            policy=self.policy,
            verified_at=exact[0].installed_at if installed else None,
            reason_code=reason,
        )

    def install_target(self, target: ManagedTrustTarget) -> bool:
        self._raise_injected_failure()
        if not self.mutation_enabled:
            raise CertificateTrustError("CERTIFICATE_TRUST_WRITE_NOT_AUTHORIZED")
        conflicts = self._conflicts(target)
        if conflicts:
            raise CertificateTrustError("CERTIFICATE_TRUST_CONFLICT")
        existing = self._matching_owned(target)
        for item in existing:
            if (
                item.fingerprint_sha256 == target.fingerprint_sha256
                and item.policy == target.policy
                and item.host == target.host
                and item.scope == self.scope
            ):
                return False
        self._entries.append(
            _FakeTrustEntry(
                ownership_key=target.ownership_key,
                display_name=target.display_name,
                fingerprint_sha256=target.fingerprint_sha256,
                policy=target.policy,
                host=target.host,
                scope=self.scope,
                installed_at=_now_iso(),
            )
        )
        if not self.inspect_target(target).installed:
            raise CertificateTrustError("CERTIFICATE_TRUST_VERIFY_FAILED")
        return True

    def remove_target(self, target: ManagedTrustTarget) -> bool:
        self._raise_injected_failure()
        if not self.mutation_enabled:
            raise CertificateTrustError("CERTIFICATE_TRUST_WRITE_NOT_AUTHORIZED")
        conflicts = self._conflicts(target)
        if conflicts:
            raise CertificateTrustError("CERTIFICATE_TRUST_CONFLICT")
        before = len(self._entries)
        self._entries = [
            item
            for item in self._entries
            if not (
                item.ownership_key == target.ownership_key
                and item.fingerprint_sha256 == target.fingerprint_sha256
            )
        ]
        return len(self._entries) != before

    # Compatibility helpers used by older isolated tests.  These records are
    # foreign by definition and may not be silently replaced by managed calls.
    def inspect(self, *, display_name: str, fingerprint_sha256: str) -> TrustInspection:
        fingerprint = normalize_fingerprint(fingerprint_sha256)
        existing = [
            item for item in self._entries if item.display_name == display_name
        ]
        exact = [item for item in existing if item.fingerprint_sha256 == fingerprint]
        conflict = any(item.fingerprint_sha256 != fingerprint for item in existing)
        return TrustInspection(
            installed=bool(exact) and not conflict,
            conflict=conflict,
            conflict_count=sum(
                item.fingerprint_sha256 != fingerprint for item in existing
            ),
            backend=self.backend,
            scope=self.scope,
            policy=self.policy,
            verified_at=exact[0].installed_at if exact and not conflict else None,
            reason_code=(
                "CERTIFICATE_TRUST_CONFLICT"
                if conflict
                else None if exact else "CERTIFICATE_TRUST_MISSING"
            ),
        )

    def install(self, *, display_name: str, fingerprint_sha256: str) -> bool:
        self._raise_injected_failure()
        fingerprint = normalize_fingerprint(fingerprint_sha256)
        existing = [
            item for item in self._entries if item.display_name == display_name
        ]
        if any(item.fingerprint_sha256 != fingerprint for item in existing):
            raise CertificateTrustError("CERTIFICATE_TRUST_CONFLICT")
        if existing:
            return False
        self._entries.append(
            _FakeTrustEntry(
                ownership_key=None,
                display_name=display_name,
                fingerprint_sha256=fingerprint,
                policy=self.policy,
                host="127.0.0.1",
                scope=self.scope,
                installed_at=_now_iso(),
            )
        )
        return True

    def remove(self, *, display_name: str, fingerprint_sha256: str) -> bool:
        self._raise_injected_failure()
        fingerprint = normalize_fingerprint(fingerprint_sha256)
        existing = [
            item for item in self._entries if item.display_name == display_name
        ]
        if any(item.fingerprint_sha256 != fingerprint for item in existing):
            raise CertificateTrustError("CERTIFICATE_TRUST_CONFLICT")
        before = len(self._entries)
        self._entries = [
            item
            for item in self._entries
            if not (
                item.display_name == display_name
                and item.fingerprint_sha256 == fingerprint
            )
        ]
        return len(self._entries) != before

    def add_foreign_record(
        self,
        *,
        display_name: str,
        fingerprint_sha256: str,
        scope: str = "current_user",
        policy: str = "ssl_loopback_only",
        host: str = "127.0.0.1",
    ) -> None:
        self._entries.append(
            _FakeTrustEntry(
                ownership_key=None,
                display_name=display_name,
                fingerprint_sha256=normalize_fingerprint(fingerprint_sha256),
                policy=policy,
                host=host,
                scope=scope,
                installed_at=_now_iso(),
            )
        )

    def simulate_external_removal(self, *, display_name: str) -> None:
        self._entries = [
            item for item in self._entries if item.display_name != display_name
        ]


def target_from_pem(
    *,
    install_id: str,
    profile: str,
    generation_id: str,
    display_name: str,
    fingerprint_sha256: str,
    certificate_pem: bytes,
    verification_certificate_pem: bytes,
) -> ManagedTrustTarget:
    try:
        certificate = x509.load_pem_x509_certificate(certificate_pem)
        verification_certificate = x509.load_pem_x509_certificate(
            verification_certificate_pem
        )
    except (TypeError, ValueError) as exc:
        raise CertificateTrustError("CERTIFICATE_PUBLIC_DATA_INVALID") from exc
    return ManagedTrustTarget(
        install_id_hash=sha256(install_id.encode("utf-8")).hexdigest(),
        profile=profile,
        generation_id=generation_id,
        display_name=display_name,
        fingerprint_sha256=normalize_fingerprint(fingerprint_sha256),
        certificate_der=certificate.public_bytes(serialization.Encoding.DER),
        verification_certificate_der=verification_certificate.public_bytes(
            serialization.Encoding.DER
        ),
    )
