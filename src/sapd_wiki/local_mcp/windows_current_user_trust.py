"""Windows CurrentUser Root trust contract.

The renderer never receives this adapter.  A native/main-process bridge must
enforce ``CurrentUser\\Root`` and reject LocalMachine before executing any
operation.  Automated C0 tests inject a fake bridge; Windows real-store UAT is
part of D2.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime
from hashlib import sha256
from typing import Protocol

from .certificate_trust import (
    CertificateTrustError,
    ManagedTrustTarget,
    TrustInspection,
    TrustSnapshot,
    normalize_fingerprint,
)


@dataclass(frozen=True, slots=True)
class WindowsTrustRecord:
    fingerprint_sha256: str
    display_name: str
    store_location: str
    store_name: str


class WindowsCurrentUserRootBridge(Protocol):
    def list_records(self, *, display_name: str) -> list[WindowsTrustRecord]: ...

    def install_public_ca(self, *, certificate_der: bytes) -> None: ...

    def remove_by_sha256(self, *, fingerprint_sha256: str) -> None: ...


def _iso_now() -> str:
    return datetime.now(UTC).isoformat().replace("+00:00", "Z")


class WindowsCurrentUserRootTrustAdapter:
    backend = "windows_current_user_root"
    scope = "current_user"
    policy = "ssl_loopback_only"

    def __init__(
        self,
        *,
        bridge: WindowsCurrentUserRootBridge,
        mutation_enabled: bool = False,
        managed_fingerprints: set[str] | None = None,
    ) -> None:
        self.bridge = bridge
        self.mutation_enabled = bool(mutation_enabled)
        self._managed_fingerprints = {
            normalize_fingerprint(item) for item in (managed_fingerprints or set())
        }

    @staticmethod
    def _validate_scope(records: list[WindowsTrustRecord]) -> None:
        for record in records:
            if (
                record.store_location != "CurrentUser"
                or record.store_name != "Root"
            ):
                raise CertificateTrustError("CERTIFICATE_TRUST_SCOPE_VIOLATION")

    def _records(self, target: ManagedTrustTarget) -> list[WindowsTrustRecord]:
        records = self.bridge.list_records(display_name=target.display_name)
        self._validate_scope(records)
        return records

    def inspect_target(self, target: ManagedTrustTarget) -> TrustInspection:
        expected = normalize_fingerprint(target.fingerprint_sha256)
        records = self._records(target)
        fingerprints = [
            normalize_fingerprint(item.fingerprint_sha256) for item in records
        ]
        conflicts = [
            item
            for item in fingerprints
            if item != expected and item not in self._managed_fingerprints
        ]
        installed = expected in fingerprints and not conflicts
        return TrustInspection(
            installed=installed,
            conflict=bool(conflicts),
            policy_valid=True,
            conflict_count=len(conflicts),
            backend=self.backend,
            scope=self.scope,
            policy=self.policy,
            verified_at=_iso_now() if installed else None,
            reason_code=(
                "CERTIFICATE_TRUST_CONFLICT"
                if conflicts
                else None
                if installed
                else "CERTIFICATE_TRUST_MISSING"
            ),
        )

    def snapshot(self, target: ManagedTrustTarget) -> TrustSnapshot:
        records = self._records(target)
        canonical = sorted(
            (
                normalize_fingerprint(item.fingerprint_sha256),
                item.store_location,
                item.store_name,
            )
            for item in records
        )
        conflicts = [
            fingerprint
            for fingerprint, _, _ in canonical
            if fingerprint != target.fingerprint_sha256
            and fingerprint not in self._managed_fingerprints
        ]
        return TrustSnapshot(
            backend=self.backend,
            scope=self.scope,
            digest=sha256(repr(canonical).encode("utf-8")).hexdigest(),
            managed_count=sum(
                fingerprint in self._managed_fingerprints
                for fingerprint, _, _ in canonical
            ),
            conflicting_count=len(conflicts),
            captured_at=_iso_now(),
        )

    def install_target(self, target: ManagedTrustTarget) -> bool:
        if not self.mutation_enabled:
            raise CertificateTrustError("CERTIFICATE_TRUST_WRITE_NOT_AUTHORIZED")
        inspection = self.inspect_target(target)
        if inspection.conflict:
            raise CertificateTrustError("CERTIFICATE_TRUST_CONFLICT")
        if inspection.installed:
            return False
        self.bridge.install_public_ca(certificate_der=target.certificate_der)
        if not self.inspect_target(target).installed:
            raise CertificateTrustError("CERTIFICATE_TRUST_VERIFY_FAILED")
        return True

    def remove_target(self, target: ManagedTrustTarget) -> bool:
        if not self.mutation_enabled:
            raise CertificateTrustError("CERTIFICATE_TRUST_WRITE_NOT_AUTHORIZED")
        expected = normalize_fingerprint(target.fingerprint_sha256)
        if expected not in {
            normalize_fingerprint(item.fingerprint_sha256)
            for item in self._records(target)
        }:
            return False
        self.bridge.remove_by_sha256(fingerprint_sha256=expected)
        if expected in {
            normalize_fingerprint(item.fingerprint_sha256)
            for item in self._records(target)
        }:
            raise CertificateTrustError("CERTIFICATE_TRUST_REMOVE_FAILED")
        return True
