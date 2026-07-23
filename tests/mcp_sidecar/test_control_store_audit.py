from __future__ import annotations

import sqlite3
import tempfile
import unittest
from pathlib import Path

from sapd_wiki.local_mcp.audit import AuditEvent, AuditLogger
from sapd_wiki.local_mcp.control_store import ControlStore


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


if __name__ == "__main__":
    unittest.main()
