from __future__ import annotations

import sqlite3
import tempfile
import unittest
from pathlib import Path

from sapd_wiki.local_mcp.audit import AuditEvent, AuditLogger
from sapd_wiki.local_mcp.control_store import ControlStore, ControlStoreError


class ControlStoreAuditTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp = tempfile.TemporaryDirectory(prefix="sapd-mcp-control-")
        self.root = Path(self.temp.name)
        self.path = self.root / "control.sqlite3"
        self.store = ControlStore(self.path, verifier_key=b"k" * 32)

    def tearDown(self) -> None:
        self.store.close()
        self.temp.cleanup()

    def issue_family(self, client_id: str, suffix: str) -> tuple[str, str]:
        access = f"raw-access-{suffix}-" + ("a" * 48)
        refresh = f"raw-refresh-{suffix}-" + ("r" * 48)
        self.store.create_token_family(
            family_id=f"family-{suffix}",
            client_id=client_id,
            scopes=["sapd.base.public.summary.read"],
            resource="https://127.0.0.1:28775/mcp",
            instance_id="instance-1",
            runtime_id="runtime-1",
            grant_version="grant-v1",
            policy_version="policy-v1",
            access_token=access,
            access_expires_at=9999999999,
            refresh_token=refresh,
            refresh_expires_at=9999999999,
        )
        return access, refresh

    def test_only_hmac_token_verifiers_are_persisted(self) -> None:
        access, refresh = self.issue_family("client-a", "a")
        row = self.store.lookup_token(access, kind="access")
        self.assertIsNotNone(row)
        self.assertEqual(len(row["verifier"]), 64)
        connection = sqlite3.connect(self.path)
        persisted = "\n".join(
            str(value)
            for table in ("token_verifiers", "token_families")
            for record in connection.execute(f"SELECT * FROM {table}")
            for value in record
        )
        connection.close()
        self.assertNotIn(access, persisted)
        self.assertNotIn(refresh, persisted)

    def test_refresh_reuse_revokes_only_its_family(self) -> None:
        _, refresh_a = self.issue_family("client-a", "a")
        access_b, _ = self.issue_family("client-b", "b")
        rotated = self.store.rotate_refresh_family(
            refresh_a,
            access_token="replacement-access-" + ("x" * 48),
            access_expires_at=9999999999,
            refresh_token="replacement-refresh-" + ("y" * 48),
            refresh_expires_at=9999999999,
        )
        self.assertFalse(rotated["reused"])
        reused = self.store.rotate_refresh_family(
            refresh_a,
            access_token="never-used-access-" + ("m" * 48),
            access_expires_at=9999999999,
            refresh_token="never-used-refresh-" + ("n" * 48),
            refresh_expires_at=9999999999,
        )
        self.assertTrue(reused["reused"])
        self.assertIsNotNone(self.store.lookup_token(access_b, kind="access"))

    def test_single_client_revoke_preserves_other_client(self) -> None:
        access_a, _ = self.issue_family("client-a", "a")
        access_b, _ = self.issue_family("client-b", "b")
        self.assertEqual(self.store.revoke_client("client-a"), 1)
        self.assertIsNone(self.store.lookup_token(access_a, kind="access"))
        self.assertIsNotNone(self.store.lookup_token(access_b, kind="access"))

    def test_audit_stores_fingerprint_not_query_content_or_path(self) -> None:
        audit = AuditLogger(self.store, period_key=b"p" * 32)
        query = "secret body /Users/example/private/source.xlsx"
        audit.record(
            AuditEvent(
                event_type="TOOL_CALL",
                result_code="OK",
                client_id="client-a",
                tool_name="search_knowledge",
                scope="sapd.base.public.summary.read",
                returned_count=2,
                duration_ms=7,
                correlation_id="correlation-1",
                versions={"knowledge_version": "knowledge-v1"},
            ),
            normalized_query=query,
        )
        rows = self.store.read_audit()
        self.assertEqual(len(rows), 1)
        self.assertRegex(rows[0]["query_fingerprint"], r"^[0-9a-f]{64}$")
        serialized = self.path.read_bytes()
        self.assertNotIn(query.encode(), serialized)
        self.assertNotIn(b"/Users/example/private", serialized)

    def test_audit_count_and_offset_support_fixed_page_reads(self) -> None:
        audit = AuditLogger(self.store, period_key=b"p" * 32)
        for index in range(7):
            audit.record(
                AuditEvent(
                    event_type="TOOL_CALL",
                    result_code="OK",
                    client_id="client-a",
                    tool_name="get_knowledge_version",
                    correlation_id=f"correlation-{index}",
                )
            )
        self.assertEqual(self.store.count_audit(), 7)
        second_page = self.store.read_audit(limit=3, offset=3)
        self.assertEqual(len(second_page), 3)
        self.assertEqual(
            [item["correlation_id"] for item in second_page],
            ["correlation-3", "correlation-2", "correlation-1"],
        )

    def test_audit_prunes_oldest_rows_at_hard_event_limit(self) -> None:
        limited = ControlStore(
            self.root / "limited.sqlite3",
            verifier_key=b"l" * 32,
            audit_max_events=100,
        )
        try:
            audit = AuditLogger(limited, period_key=b"p" * 32)
            for index in range(105):
                audit.record(
                    AuditEvent(
                        event_type="TOOL_CALL",
                        result_code="OK",
                        client_id="client-a",
                        tool_name="get_knowledge_version",
                        correlation_id=f"correlation-{index}",
                    )
                )
            rows = limited.read_audit(limit=1000)
            self.assertEqual(limited.count_audit(), 100)
            self.assertEqual(rows[0]["correlation_id"], "correlation-104")
            self.assertEqual(rows[-1]["correlation_id"], "correlation-5")
        finally:
            limited.close()

    def test_existing_audit_is_pruned_when_store_reopens(self) -> None:
        legacy_path = self.root / "legacy.sqlite3"
        legacy = ControlStore(
            legacy_path,
            verifier_key=b"g" * 32,
            audit_max_events=200,
        )
        try:
            audit = AuditLogger(legacy, period_key=b"p" * 32)
            for index in range(105):
                audit.record(
                    AuditEvent(
                        event_type="TOOL_CALL",
                        result_code="OK",
                        correlation_id=f"legacy-{index}",
                    )
                )
        finally:
            legacy.close()

        reopened = ControlStore(
            legacy_path,
            verifier_key=b"g" * 32,
            audit_max_events=100,
        )
        try:
            rows = reopened.read_audit(limit=1000)
            self.assertEqual(reopened.count_audit(), 100)
            self.assertEqual(rows[0]["correlation_id"], "legacy-104")
            self.assertEqual(rows[-1]["correlation_id"], "legacy-5")
        finally:
            reopened.close()

    def test_audit_prunes_rows_older_than_retention_window(self) -> None:
        now = [1_800_000_000.0]
        retained = ControlStore(
            self.root / "retained.sqlite3",
            verifier_key=b"r" * 32,
            clock=lambda: now[0],
            audit_retention_days=30,
        )
        try:
            audit = AuditLogger(
                retained,
                period_key=b"p" * 32,
                clock=lambda: now[0],
            )
            audit.record(
                AuditEvent(
                    event_type="TOOL_CALL",
                    result_code="OK",
                    correlation_id="expired-event",
                )
            )
            now[0] += 31 * 24 * 60 * 60
            audit.record(
                AuditEvent(
                    event_type="TOOL_CALL",
                    result_code="OK",
                    correlation_id="current-event",
                )
            )
            rows = retained.read_audit()
            self.assertEqual(
                [row["correlation_id"] for row in rows],
                ["current-event"],
            )
        finally:
            retained.close()

    def test_audit_prunes_oldest_rows_at_payload_capacity(self) -> None:
        capacity_limited = ControlStore(
            self.root / "capacity-limited.sqlite3",
            verifier_key=b"c" * 32,
            audit_max_bytes=1024,
        )
        try:
            audit = AuditLogger(capacity_limited, period_key=b"p" * 32)
            for index in range(40):
                audit.record(
                    AuditEvent(
                        event_type="TOOL_CALL",
                        result_code="POLICY_BLOCKED",
                        client_id="client-capacity",
                        tool_name="search_knowledge",
                        scope="sapd.base.knowledge.read",
                        correlation_id=f"capacity-{index}",
                        versions={
                            "knowledge_version": "base-version",
                            "policy_version": "policy-version",
                        },
                    )
                )
            rows = capacity_limited.read_audit(limit=1000)
            self.assertLess(len(rows), 40)
            self.assertEqual(rows[0]["correlation_id"], "capacity-39")
            self.assertLessEqual(
                capacity_limited._audit_payload_bytes_locked(),
                1024,
            )
        finally:
            capacity_limited.close()

    def test_runtime_preferences_round_trip(self) -> None:
        self.assertIsNone(self.store.load_runtime_preferences())
        self.store.save_runtime_preferences(
            desired_state="enabled",
            configured_port=28775,
        )
        self.assertEqual(
            self.store.load_runtime_preferences(),
            {
                "schema_version": 1,
                "desired_state": "enabled",
                "configured_port": 28775,
            },
        )

    def test_invalid_runtime_preferences_fail_closed(self) -> None:
        connection = sqlite3.connect(self.path)
        connection.execute(
            """
            INSERT INTO control_meta(key, value) VALUES('runtime_preferences', ?)
            """,
            ('{"schema_version":1,"desired_state":"enabled","configured_port":80}',),
        )
        connection.commit()
        connection.close()
        with self.assertRaisesRegex(
            ControlStoreError,
            "RUNTIME_PREFERENCES_INVALID",
        ):
            self.store.load_runtime_preferences()


if __name__ == "__main__":
    unittest.main()
