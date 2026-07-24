"""Transactional certificate lifecycle for the local MCP identity."""

from __future__ import annotations

import json
import os
import secrets
from dataclasses import asdict, dataclass, replace
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any, Callable

from .certificate_identity import (
    CertificateIdentityError,
    CertificateIdentityManifest,
    CertificateIdentityStore,
)
from .certificate_trust import (
    CertificateTrustError,
    CurrentUserTrustAdapter,
    ManagedTrustTarget,
)
from .profile_lock import ProfileLockError, ProfileWriterLock
from .tls import (
    SecretTransportAttestation,
    TLSIdentityError,
    create_server_ssl_context,
)


JOURNAL_SCHEMA_VERSION = 1
RETIRING_WINDOW_HOURS = 24
_PHASES = frozenset(
    {
        "planned",
        "staged",
        "new_trust_installed",
        "switched",
        "validated",
        "retiring",
        "completed",
    }
)
_ACTIONS = frozenset(
    {
        "certificate_provision",
        "certificate_rotate",
        "certificate_repair_trust",
        "certificate_reset",
    }
)
_JOURNAL_KEYS = frozenset(
    {
        "schema_version",
        "operation_id",
        "action",
        "profile",
        "phase",
        "old_generation_id",
        "new_generation_id",
        "started_at",
        "updated_at",
        "old_generation_retained_until",
        "cleanup_pending",
        "client_restart_required",
        "recovery_required",
        "last_error_code",
        "outcome",
        "trust_snapshot_before",
        "trust_snapshot_after",
    }
)


class CertificateLifecycleError(RuntimeError):
    def __init__(self, code: str) -> None:
        super().__init__(code)
        self.code = code


def _utc_now() -> datetime:
    return datetime.now(UTC)


def _iso(value: datetime) -> str:
    return value.astimezone(UTC).isoformat().replace("+00:00", "Z")


def _parse_iso(value: str) -> datetime:
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except (TypeError, ValueError) as exc:
        raise CertificateLifecycleError("CERTIFICATE_JOURNAL_INVALID") from exc
    if parsed.tzinfo is None:
        raise CertificateLifecycleError("CERTIFICATE_JOURNAL_INVALID")
    return parsed.astimezone(UTC)


def _atomic_write(path: Path, payload: bytes) -> None:
    temporary = path.with_name(f".{path.name}.{secrets.token_urlsafe(8)}.tmp")
    descriptor = os.open(temporary, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    try:
        os.write(descriptor, payload)
        os.fsync(descriptor)
    finally:
        os.close(descriptor)
    os.replace(temporary, path)
    os.chmod(path, 0o600)


@dataclass(frozen=True, slots=True)
class CertificateOperationJournal:
    schema_version: int
    operation_id: str
    action: str
    profile: str
    phase: str
    old_generation_id: str | None
    new_generation_id: str | None
    started_at: str
    updated_at: str
    old_generation_retained_until: str | None
    cleanup_pending: bool
    client_restart_required: bool
    recovery_required: bool
    last_error_code: str | None
    outcome: str | None
    trust_snapshot_before: str | None
    trust_snapshot_after: str | None


class CertificateOperationStore:
    def __init__(self, path: Path) -> None:
        self.path = Path(path)
        if not self.path.is_absolute() or self.path.is_symlink():
            raise CertificateLifecycleError("CERTIFICATE_JOURNAL_UNSAFE")

    def load(self) -> CertificateOperationJournal | None:
        if not self.path.exists():
            return None
        if self.path.is_symlink():
            raise CertificateLifecycleError("CERTIFICATE_JOURNAL_UNSAFE")
        info = self.path.stat()
        if info.st_nlink != 1 or info.st_mode & 0o077:
            raise CertificateLifecycleError("CERTIFICATE_JOURNAL_UNSAFE")
        try:
            raw = json.loads(self.path.read_text(encoding="utf-8"))
        except (OSError, UnicodeError, json.JSONDecodeError) as exc:
            raise CertificateLifecycleError("CERTIFICATE_JOURNAL_INVALID") from exc
        if not isinstance(raw, dict):
            raise CertificateLifecycleError("CERTIFICATE_JOURNAL_INVALID")
        if raw.get("schema_version") != JOURNAL_SCHEMA_VERSION:
            raise CertificateLifecycleError("CERTIFICATE_JOURNAL_SCHEMA_UNSUPPORTED")
        if set(raw) != _JOURNAL_KEYS:
            raise CertificateLifecycleError("CERTIFICATE_JOURNAL_INVALID")
        if raw.get("phase") not in _PHASES or raw.get("action") not in _ACTIONS:
            raise CertificateLifecycleError("CERTIFICATE_JOURNAL_INVALID")
        if not isinstance(raw.get("operation_id"), str) or not raw["operation_id"].startswith(
            "operation:"
        ):
            raise CertificateLifecycleError("CERTIFICATE_JOURNAL_INVALID")
        if not isinstance(raw.get("profile"), str) or not raw["profile"]:
            raise CertificateLifecycleError("CERTIFICATE_JOURNAL_INVALID")
        for field in ("started_at", "updated_at"):
            if not isinstance(raw.get(field), str):
                raise CertificateLifecycleError("CERTIFICATE_JOURNAL_INVALID")
            _parse_iso(raw[field])
        if raw.get("old_generation_retained_until") is not None:
            _parse_iso(raw["old_generation_retained_until"])
        for field in (
            "cleanup_pending",
            "client_restart_required",
            "recovery_required",
        ):
            if not isinstance(raw.get(field), bool):
                raise CertificateLifecycleError("CERTIFICATE_JOURNAL_INVALID")
        for field in (
            "old_generation_id",
            "new_generation_id",
            "last_error_code",
            "outcome",
            "trust_snapshot_before",
            "trust_snapshot_after",
        ):
            if raw.get(field) is not None and not isinstance(raw[field], str):
                raise CertificateLifecycleError("CERTIFICATE_JOURNAL_INVALID")
        return CertificateOperationJournal(**raw)

    def save(
        self,
        journal: CertificateOperationJournal,
    ) -> CertificateOperationJournal:
        self.path.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
        os.chmod(self.path.parent, 0o700)
        _atomic_write(
            self.path,
            json.dumps(
                asdict(journal),
                ensure_ascii=True,
                sort_keys=True,
                separators=(",", ":"),
            ).encode("utf-8"),
        )
        return journal


class CertificateLifecycle:
    """Coordinates identity, secret and CurrentUser trust as one transaction."""

    def __init__(
        self,
        *,
        identity: CertificateIdentityStore,
        trust: CurrentUserTrustAdapter,
        clock: Callable[[], datetime] = _utc_now,
    ) -> None:
        self.identity = identity
        self.trust = trust
        self._clock = clock
        self.operations = CertificateOperationStore(
            identity.root / "operations" / f"{identity.profile}.json"
        )
        self._writer_lock = ProfileWriterLock(
            identity.root / "operations" / f"{identity.profile}.lock"
        )

    def _save(
        self,
        journal: CertificateOperationJournal,
        **changes: Any,
    ) -> CertificateOperationJournal:
        return self.operations.save(
            replace(journal, updated_at=_iso(self._clock()), **changes)
        )

    def _begin(
        self,
        *,
        action: str,
        current: CertificateIdentityManifest | None,
        trust_snapshot_before: str | None,
        allow_replace: bool = False,
    ) -> CertificateOperationJournal:
        existing = self.operations.load()
        if (
            existing is not None
            and existing.phase != "completed"
            and not allow_replace
        ):
            raise CertificateLifecycleError("CERTIFICATE_OPERATION_IN_PROGRESS")
        now = _iso(self._clock())
        return self.operations.save(
            CertificateOperationJournal(
                schema_version=JOURNAL_SCHEMA_VERSION,
                operation_id=f"operation:{secrets.token_urlsafe(18)}",
                action=action,
                profile=self.identity.profile,
                phase="planned",
                old_generation_id=(
                    current.generation_id if current is not None else None
                ),
                new_generation_id=None,
                started_at=now,
                updated_at=now,
                old_generation_retained_until=None,
                cleanup_pending=False,
                client_restart_required=False,
                recovery_required=False,
                last_error_code=None,
                outcome=None,
                trust_snapshot_before=trust_snapshot_before,
                trust_snapshot_after=None,
            )
        )

    @staticmethod
    def _error_code(exc: BaseException) -> str:
        code = getattr(exc, "code", None)
        return code if isinstance(code, str) and code else "CERTIFICATE_OPERATION_FAILED"

    def _validate_generation(
        self,
        manifest: CertificateIdentityManifest,
    ) -> None:
        files = self.identity.generation_identity_files(manifest)
        create_server_ssl_context(
            certificate_path=files.server_chain_path,
            encrypted_private_key_path=files.encrypted_private_key_path,
            secret_provider=self.identity.secret_provider,
            passphrase_reference=manifest.passphrase_reference,
            ipc_attestation=SecretTransportAttestation.isolated_test_fixture(),
        )
        inspection = self.trust.inspect_target(self.identity.trust_target(manifest))
        if not inspection.installed:
            raise CertificateLifecycleError(
                inspection.reason_code or "CERTIFICATE_TRUST_VERIFY_FAILED"
            )

    def _snapshot_for(
        self,
        manifest: CertificateIdentityManifest | None,
    ) -> str | None:
        if manifest is None:
            return None
        return self.trust.snapshot(self.identity.trust_target(manifest)).digest

    def snapshot_digest(self) -> str | None:
        return self._snapshot_for(self.identity.load_manifest())

    def provision(self) -> CertificateOperationJournal:
        try:
            with self._writer_lock:
                if self.identity.load_manifest() is not None:
                    raise CertificateLifecycleError("CERTIFICATE_ALREADY_CONFIGURED")
                journal = self._begin(
                    action="certificate_provision",
                    current=None,
                    trust_snapshot_before=None,
                )
                try:
                    staged = self.identity.stage_generation(
                        include_loopback_name_constraints=True
                    )
                    journal = self._save(
                        journal,
                        phase="staged",
                        new_generation_id=staged.generation_id,
                    )
                    target = self.identity.trust_target(staged)
                    self.trust.install_target(target)
                    journal = self._save(
                        journal,
                        phase="new_trust_installed",
                        trust_snapshot_after=self.trust.snapshot(target).digest,
                    )
                    self.identity.activate_generation(staged)
                    journal = self._save(journal, phase="switched")
                    self._validate_generation(staged)
                    journal = self._save(journal, phase="validated")
                    return self._save(
                        journal,
                        phase="completed",
                        outcome="completed",
                    )
                except Exception as exc:
                    self._rollback(journal, self._error_code(exc))
                    raise
        except ProfileLockError as exc:
            raise CertificateLifecycleError(exc.code) from exc

    def rotate(self) -> CertificateOperationJournal:
        try:
            with self._writer_lock:
                current = self.identity.load_manifest()
                if current is None:
                    raise CertificateLifecycleError("CERTIFICATE_NOT_CONFIGURED")
                journal = self._begin(
                    action="certificate_rotate",
                    current=current,
                    trust_snapshot_before=self._snapshot_for(current),
                )
                try:
                    staged = self.identity.stage_generation(
                        include_loopback_name_constraints=True
                    )
                    journal = self._save(
                        journal,
                        phase="staged",
                        new_generation_id=staged.generation_id,
                    )
                    target = self.identity.trust_target(staged)
                    self.trust.install_target(target)
                    journal = self._save(
                        journal,
                        phase="new_trust_installed",
                        trust_snapshot_after=self.trust.snapshot(target).digest,
                    )
                    self.identity.activate_generation(staged)
                    journal = self._save(
                        journal,
                        phase="switched",
                        client_restart_required=True,
                    )
                    self._validate_generation(staged)
                    journal = self._save(journal, phase="validated")
                    retained_until = self._clock() + timedelta(
                        hours=RETIRING_WINDOW_HOURS
                    )
                    return self._save(
                        journal,
                        phase="retiring",
                        cleanup_pending=True,
                        client_restart_required=True,
                        old_generation_retained_until=_iso(retained_until),
                    )
                except Exception as exc:
                    self._rollback(journal, self._error_code(exc))
                    raise
        except ProfileLockError as exc:
            raise CertificateLifecycleError(exc.code) from exc

    def repair_trust(self) -> CertificateOperationJournal:
        try:
            with self._writer_lock:
                current = self.identity.load_manifest()
                if current is None:
                    raise CertificateLifecycleError("CERTIFICATE_NOT_CONFIGURED")
                journal = self._begin(
                    action="certificate_repair_trust",
                    current=current,
                    trust_snapshot_before=self._snapshot_for(current),
                )
                try:
                    target = self.identity.trust_target(current)
                    self.trust.install_target(target)
                    journal = self._save(
                        journal,
                        phase="new_trust_installed",
                        new_generation_id=current.generation_id,
                        trust_snapshot_after=self.trust.snapshot(target).digest,
                    )
                    self._validate_generation(current)
                    journal = self._save(journal, phase="validated")
                    return self._save(
                        journal,
                        phase="completed",
                        outcome="completed",
                    )
                except Exception as exc:
                    return self._save(
                        journal,
                        phase="completed",
                        recovery_required=False,
                        last_error_code=self._error_code(exc),
                        outcome="failed",
                    )
        except ProfileLockError as exc:
            raise CertificateLifecycleError(exc.code) from exc

    def _rollback(
        self,
        journal: CertificateOperationJournal,
        failure_code: str,
    ) -> CertificateOperationJournal:
        try:
            if journal.phase == "planned":
                return self._save(
                    journal,
                    phase="completed",
                    last_error_code=failure_code,
                    outcome="rolled_back",
                )
            new_manifest = (
                self.identity.load_generation_manifest(journal.new_generation_id)
                if journal.new_generation_id is not None
                else None
            )
            if journal.phase in {
                "staged",
                "new_trust_installed",
                "switched",
                "validated",
                "retiring",
            } and new_manifest is not None:
                self.trust.remove_target(self.identity.trust_target(new_manifest))
            if journal.phase in {"switched", "validated", "retiring"}:
                if journal.old_generation_id is None:
                    if journal.new_generation_id is not None:
                        self.identity.clear_active_generation(
                            journal.new_generation_id
                        )
                else:
                    old = self.identity.load_generation_manifest(
                        journal.old_generation_id
                    )
                    if self._clock() >= _parse_iso(old.valid_until):
                        raise CertificateLifecycleError(
                            "CERTIFICATE_ROLLBACK_IDENTITY_EXPIRED"
                        )
                    self.identity.activate_generation(old)
                    self._validate_generation(old)
            if new_manifest is not None:
                self.identity.remove_generation(
                    new_manifest.generation_id,
                    allow_active=True,
                )
            return self._save(
                journal,
                phase="completed",
                cleanup_pending=False,
                client_restart_required=False,
                recovery_required=False,
                last_error_code=failure_code,
                outcome="rolled_back",
            )
        except Exception as rollback_error:
            return self._save(
                journal,
                recovery_required=True,
                last_error_code=self._error_code(rollback_error),
                outcome="recovery_required",
            )

    def recover(self) -> CertificateOperationJournal | None:
        journal = self.operations.load()
        if journal is None or journal.phase == "completed":
            return journal
        try:
            with self._writer_lock:
                journal = self.operations.load()
                if journal is None or journal.phase == "completed":
                    return journal
                if journal.phase in {"validated", "retiring"}:
                    active = self.identity.load_manifest()
                    if (
                        active is None
                        or active.generation_id != journal.new_generation_id
                    ):
                        return self._save(
                            journal,
                            recovery_required=True,
                            last_error_code="CERTIFICATE_ACTIVE_POINTER_MISMATCH",
                            outcome="recovery_required",
                        )
                    self._validate_generation(active)
                    return self.cleanup_due()
                return self._rollback(
                    journal,
                    journal.last_error_code or "CERTIFICATE_OPERATION_INTERRUPTED",
                )
        except ProfileLockError:
            return journal
        except Exception as exc:
            return self._save(
                journal,
                recovery_required=True,
                last_error_code=self._error_code(exc),
                outcome="recovery_required",
            )

    def cleanup_due(
        self,
        *,
        force: bool = False,
    ) -> CertificateOperationJournal | None:
        journal = self.operations.load()
        if journal is None or journal.phase == "completed":
            return journal
        if journal.phase not in {"validated", "retiring"}:
            return journal
        if not force and journal.old_generation_retained_until is not None:
            if self._clock() < _parse_iso(journal.old_generation_retained_until):
                return journal
        old_id = journal.old_generation_id
        try:
            if old_id is not None:
                old = self.identity.load_generation_manifest(old_id)
                self.trust.remove_target(self.identity.trust_target(old))
                self.identity.remove_generation(old_id)
            return self._save(
                journal,
                phase="completed",
                cleanup_pending=False,
                recovery_required=False,
                last_error_code=None,
                outcome="completed",
            )
        except Exception as exc:
            return self._save(
                journal,
                phase="retiring",
                cleanup_pending=True,
                recovery_required=True,
                last_error_code=self._error_code(exc),
                outcome="recovery_required",
            )

    def reset(self) -> CertificateOperationJournal:
        try:
            with self._writer_lock:
                current = self.identity.load_manifest()
                journal = self._begin(
                    action="certificate_reset",
                    current=current,
                    trust_snapshot_before=self._snapshot_for(current),
                    allow_replace=True,
                )
                try:
                    for manifest in self.identity.list_generation_manifests():
                        self.trust.remove_target(self.identity.trust_target(manifest))
                    self.identity.remove()
                    return self._save(
                        journal,
                        phase="completed",
                        outcome="completed",
                    )
                except Exception as exc:
                    return self._save(
                        journal,
                        recovery_required=True,
                        last_error_code=self._error_code(exc),
                        outcome="recovery_required",
                    )
        except ProfileLockError as exc:
            raise CertificateLifecycleError(exc.code) from exc

    def projection(self) -> dict[str, Any]:
        journal = self.operations.load()
        if journal is None or journal.phase == "completed":
            return {
                "operation": None,
                "cleanup_pending": False,
                "client_restart_required": False,
                "old_generation_retained_until": None,
                "forced_state": None,
                "forced_reason_code": None,
                "forced_next_action": None,
            }
        forced_state = "recovery_required" if journal.recovery_required else None
        if forced_state is None and journal.phase not in {"validated", "retiring"}:
            forced_state = "rotating"
        return {
            "operation": {
                "operation_id": journal.operation_id,
                "state": (
                    "failed"
                    if journal.recovery_required
                    else "running"
                ),
                "phase": journal.phase,
            },
            "cleanup_pending": journal.cleanup_pending,
            "client_restart_required": journal.client_restart_required,
            "old_generation_retained_until": journal.old_generation_retained_until,
            "forced_state": forced_state,
            "forced_reason_code": journal.last_error_code,
            "forced_next_action": (
                "certificate_reset" if journal.recovery_required else None
            ),
        }
