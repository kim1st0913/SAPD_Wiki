from __future__ import annotations

import json
import tempfile
import unittest
from datetime import UTC, datetime, timedelta
from pathlib import Path

from sapd_wiki.local_mcp.certificate_identity import CertificateIdentityStore
from sapd_wiki.local_mcp.certificate_lifecycle import (
    CertificateLifecycle,
    CertificateOperationJournal,
)
from sapd_wiki.local_mcp.certificate_trust import (
    CertificateTrustError,
    FakeCurrentUserTrustAdapter,
)
from sapd_wiki.local_mcp.tls import InMemorySecretProvider


class MutableClock:
    def __init__(self) -> None:
        self.value = datetime(2026, 7, 24, 10, 0, tzinfo=UTC)

    def __call__(self) -> datetime:
        return self.value


class CertificateLifecycleTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temporary = tempfile.TemporaryDirectory()
        self.root = Path(self.temporary.name) / "identity"
        self.clock = MutableClock()
        self.secrets = InMemorySecretProvider()
        self.identity = CertificateIdentityStore(
            self.root,
            secret_provider=self.secrets,
            clock=self.clock,
        )
        self.trust = FakeCurrentUserTrustAdapter()
        self.lifecycle = CertificateLifecycle(
            identity=self.identity,
            trust=self.trust,
            clock=self.clock,
        )

    def tearDown(self) -> None:
        self.temporary.cleanup()

    def test_provision_is_staged_trusted_switched_and_completed(self) -> None:
        journal = self.lifecycle.provision()
        self.assertEqual(journal.phase, "completed")
        self.assertEqual(journal.outcome, "completed")
        active = self.identity.load_manifest()
        self.assertIsNotNone(active)
        self.assertTrue(
            self.trust.inspect_target(self.identity.trust_target(active)).installed
        )
        raw = json.loads(
            (self.root / "operations" / "dev.json").read_text(encoding="utf-8")
        )
        self.assertNotIn("passphrase_reference", repr(raw))
        self.assertNotIn(str(self.root), repr(raw))

    def test_trust_rejection_rolls_back_to_not_configured(self) -> None:
        self.trust.fail_next("CERTIFICATE_TRUST_USER_DENIED")
        with self.assertRaises(CertificateTrustError):
            self.lifecycle.provision()
        self.assertIsNone(self.identity.load_manifest())
        self.assertEqual(self.identity.list_generation_manifests(), [])
        journal = self.lifecycle.operations.load()
        self.assertEqual(journal.phase, "completed")
        self.assertEqual(journal.outcome, "rolled_back")

    def test_rotation_keeps_old_generation_and_trust_until_cleanup(self) -> None:
        self.lifecycle.provision()
        old = self.identity.load_manifest()
        journal = self.lifecycle.rotate()
        new = self.identity.load_manifest()
        self.assertNotEqual(old.generation_id, new.generation_id)
        self.assertEqual(journal.phase, "retiring")
        self.assertTrue(journal.cleanup_pending)
        self.assertIsNotNone(
            self.secrets.get_secret(old.passphrase_reference)
        )
        self.assertTrue(
            self.trust.inspect_target(self.identity.trust_target(old)).installed
        )
        self.clock.value += timedelta(hours=25)
        completed = self.lifecycle.cleanup_due()
        self.assertEqual(completed.phase, "completed")
        self.assertIsNone(self.secrets.get_secret(old.passphrase_reference))
        self.assertEqual(
            [item.generation_id for item in self.identity.list_generation_manifests()],
            [new.generation_id],
        )

    def test_rotation_trust_failure_preserves_old_identity(self) -> None:
        self.lifecycle.provision()
        old = self.identity.load_manifest()
        self.trust.fail_next("CERTIFICATE_TRUST_USER_DENIED")
        with self.assertRaises(CertificateTrustError):
            self.lifecycle.rotate()
        active = self.identity.load_manifest()
        self.assertEqual(active.generation_id, old.generation_id)
        self.assertIsNotNone(self.secrets.get_secret(old.passphrase_reference))
        self.assertTrue(
            self.trust.inspect_target(self.identity.trust_target(old)).installed
        )
        self.assertEqual(
            [item.generation_id for item in self.identity.list_generation_manifests()],
            [old.generation_id],
        )

    def test_interrupted_switched_phase_rolls_back_old_active(self) -> None:
        self.lifecycle.provision()
        old = self.identity.load_manifest()
        staged = self.identity.stage_generation(
            include_loopback_name_constraints=True
        )
        self.trust.install_target(self.identity.trust_target(staged))
        self.identity.activate_generation(staged)
        now = self.clock().isoformat().replace("+00:00", "Z")
        self.lifecycle.operations.save(
            CertificateOperationJournal(
                schema_version=1,
                operation_id="operation:interrupted-switch-test",
                action="certificate_rotate",
                profile="dev",
                phase="switched",
                old_generation_id=old.generation_id,
                new_generation_id=staged.generation_id,
                started_at=now,
                updated_at=now,
                old_generation_retained_until=None,
                cleanup_pending=False,
                client_restart_required=True,
                recovery_required=False,
                last_error_code=None,
                outcome=None,
                trust_snapshot_before=None,
                trust_snapshot_after=None,
            )
        )
        recovered = self.lifecycle.recover()
        self.assertEqual(recovered.phase, "completed")
        self.assertEqual(recovered.outcome, "rolled_back")
        self.assertEqual(
            self.identity.load_manifest().generation_id,
            old.generation_id,
        )
        self.assertEqual(
            [item.generation_id for item in self.identity.list_generation_manifests()],
            [old.generation_id],
        )

    def test_interrupted_pre_switch_phases_keep_old_active(self) -> None:
        for phase in ("planned", "staged", "new_trust_installed"):
            with self.subTest(phase=phase), tempfile.TemporaryDirectory() as temporary:
                clock = MutableClock()
                identity = CertificateIdentityStore(
                    Path(temporary) / "identity",
                    secret_provider=InMemorySecretProvider(),
                    clock=clock,
                )
                trust = FakeCurrentUserTrustAdapter()
                lifecycle = CertificateLifecycle(
                    identity=identity,
                    trust=trust,
                    clock=clock,
                )
                lifecycle.provision()
                old = identity.load_manifest()
                staged = None
                if phase != "planned":
                    staged = identity.stage_generation(
                        include_loopback_name_constraints=True
                    )
                if phase == "new_trust_installed":
                    trust.install_target(identity.trust_target(staged))
                now = clock().isoformat().replace("+00:00", "Z")
                lifecycle.operations.save(
                    CertificateOperationJournal(
                        schema_version=1,
                        operation_id=f"operation:interrupted-{phase}-test",
                        action="certificate_rotate",
                        profile="dev",
                        phase=phase,
                        old_generation_id=old.generation_id,
                        new_generation_id=(
                            staged.generation_id if staged is not None else None
                        ),
                        started_at=now,
                        updated_at=now,
                        old_generation_retained_until=None,
                        cleanup_pending=False,
                        client_restart_required=False,
                        recovery_required=False,
                        last_error_code=None,
                        outcome=None,
                        trust_snapshot_before=None,
                        trust_snapshot_after=None,
                    )
                )
                recovered = lifecycle.recover()
                self.assertEqual(recovered.phase, "completed")
                self.assertEqual(
                    identity.load_manifest().generation_id,
                    old.generation_id,
                )
                self.assertEqual(
                    [
                        item.generation_id
                        for item in identity.list_generation_manifests()
                    ],
                    [old.generation_id],
                )

    def test_cleanup_failure_is_recovery_required_and_retryable(self) -> None:
        self.lifecycle.provision()
        self.lifecycle.rotate()
        self.clock.value += timedelta(hours=25)
        self.trust.fail_next("CERTIFICATE_TRUST_REMOVE_FAILED")
        failed = self.lifecycle.cleanup_due()
        self.assertTrue(failed.recovery_required)
        self.assertEqual(failed.phase, "retiring")
        recovered = self.lifecycle.cleanup_due()
        self.assertFalse(recovered.recovery_required)
        self.assertEqual(recovered.phase, "completed")

    def test_unknown_journal_schema_fails_closed(self) -> None:
        path = self.root / "operations" / "dev.json"
        path.parent.mkdir(mode=0o700, parents=True)
        path.write_text(
            json.dumps({"schema_version": 999}),
            encoding="utf-8",
        )
        path.chmod(0o600)
        with self.assertRaises(Exception) as raised:
            self.lifecycle.operations.load()
        self.assertEqual(
            getattr(raised.exception, "code", None),
            "CERTIFICATE_JOURNAL_SCHEMA_UNSUPPORTED",
        )


if __name__ == "__main__":
    unittest.main()
