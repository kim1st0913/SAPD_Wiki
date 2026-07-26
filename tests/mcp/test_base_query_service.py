from __future__ import annotations

import hashlib
import json
import sqlite3
import tempfile
import unittest
from pathlib import Path

from sapd_wiki.local_mcp.base_query_service import (
    SCOPE,
    BaseKnowledgeQueryService,
)
from sapd_wiki.local_mcp.dev_fixture import create_dev_formal_base
from sapd_wiki.local_mcp.errors import InvalidInputError, RuntimeBoundaryError
from sapd_wiki.local_mcp.models import RequestContext
from sapd_wiki.local_mcp.readonly_runtime import FormalBaseRuntimeContext


ROOT = Path(__file__).resolve().parents[2]
CONTRACT_ROOT = (
    ROOT
    / "docs"
    / "01-architecture"
    / "contracts"
    / "mcp"
    / "base-knowledge"
    / "v1"
)


def sha256_file(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def request_context() -> RequestContext:
    return RequestContext(
        client_id="base-client-a",
        grant_version="base-grant-a",
        scope=SCOPE,
        correlation_id="base-correlation-a",
    )


class BaseKnowledgeQueryServiceTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temporary = tempfile.TemporaryDirectory(prefix="sapd-base-mcp-")
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name)
        self.database = create_dev_formal_base(self.root)
        self.before_hash = sha256_file(self.database)
        self.service = BaseKnowledgeQueryService.create(
            base_database=self.database,
            cursor_key=b"base-cursor-key-" + (b"x" * 32),
        )
        self.addCleanup(self.service.close)
        self.request = request_context()

    def test_contract_schema_and_business_rule_are_machine_valid(self) -> None:
        schema = json.loads(
            (CONTRACT_ROOT / "base-knowledge-access.schema.json").read_text(
                encoding="utf-8"
            )
        )
        contract = json.loads(
            (CONTRACT_ROOT / "base-knowledge-access.contract.json").read_text(
                encoding="utf-8"
            )
        )
        self.assertEqual(
            schema["properties"]["scope"]["const"],
            contract["scope"],
        )
        self.assertEqual(
            schema["properties"]["business_rule"]["const"],
            contract["business_rule"],
        )
        self.assertEqual(contract["scope"], SCOPE)
        self.assertEqual(
            contract["business_rule"],
            "all_base_knowledge_business_content_is_ai_readable",
        )
        self.assertEqual(
            contract["content_object_contract"]["tables"],
            [
                "content_documents",
                "content_fragments",
                "content_fragments_fts",
            ],
        )
        self.assertTrue(contract["relation_contract"]["direct_relation_ref"])
        self.assertTrue(
            contract["source_evidence_contract"]["supports_relation_ref"]
        )

    def test_search_includes_active_deprecated_and_internal_base_knowledge(self) -> None:
        response = self.service.search_knowledge(
            "common",
            request=self.request,
        ).to_dict()
        items = response["data"]["items"]
        self.assertEqual(len(items), 3)
        self.assertEqual(
            {item["status"] for item in items},
            {"active", "deprecated"},
        )
        self.assertIn(
            "fixture_internal_knowledge",
            {item["object_type"] for item in items},
        )
        self.assertFalse(
            any("metadata_json" in item or "source_file_id" in item for item in items)
        )

    def test_get_object_returns_full_business_content_and_sanitizes_technical_fields(
        self,
    ) -> None:
        data = self.service.get_knowledge_object(
            "fixture://objects/public-a",
            request=self.request,
        ).to_dict()["data"]
        self.assertEqual(
            data["description"],
            "Synthetic complete standard content Alpha.",
        )
        self.assertEqual(
            data["business_metadata"]["control_objective"],
            "Protect synthetic identities.",
        )
        serialized = json.dumps(data, ensure_ascii=False)
        for forbidden in (
            "metadata_json",
            "file_path",
            "/private/",
            "never expose",
            "source_file_id",
            "created_at",
        ):
            self.assertNotIn(forbidden, serialized)

    def test_relations_and_source_evidence_are_read_only_safe_projections(self) -> None:
        relations = self.service.get_related_knowledge(
            "fixture://objects/public-a",
            "both",
            request=self.request,
        ).to_dict()["data"]["items"]
        self.assertEqual(len(relations), 2)
        self.assertEqual(
            {item["target_ref"] for item in relations},
            {
                "fixture://objects/public-b",
                "fixture://objects/public-c",
            },
        )
        evidence = self.service.get_source_evidence(
            "fixture://objects/public-a",
            include_excerpt=False,
            request=self.request,
        ).to_dict()["data"]["items"][0]
        self.assertFalse(evidence["excerpt_included"])
        serialized = json.dumps(evidence, ensure_ascii=False)
        self.assertIn("Synthetic Standard.xlsx", serialized)
        self.assertNotIn("Synthetic raw value", serialized)
        self.assertNotIn("/private/", serialized)
        with self.assertRaises(InvalidInputError):
            self.service.get_source_evidence(
                "fixture://objects/public-a",
                include_excerpt=True,
                request=self.request,
            )

    def test_formal_relation_namespace_is_accepted_for_direct_reads(self) -> None:
        self.service.close()
        connection = sqlite3.connect(self.database)
        connection.execute(
            """
            UPDATE knowledge_relations
            SET stable_ref='base_relation:fixture:a-to-b'
            WHERE id='relation-a-b'
            """
        )
        connection.commit()
        connection.close()
        self.before_hash = sha256_file(self.database)
        self.service = BaseKnowledgeQueryService.create(
            base_database=self.database,
            cursor_key=b"base-cursor-key-" + (b"x" * 32),
        )
        direct = self.service.get_related_knowledge(
            "base_relation:fixture:a-to-b",
            "both",
            request=self.request,
        ).to_dict()["data"]["items"]
        self.assertEqual(
            [item["relation_ref"] for item in direct],
            ["base_relation:fixture:a-to-b"],
        )

    def test_runtime_is_immutable_and_rejects_non_business_table_reads(self) -> None:
        runtime_root = self.root / "runtime-boundary"
        runtime_root.mkdir()
        runtime_database = create_dev_formal_base(runtime_root)
        connection = sqlite3.connect(runtime_database)
        connection.execute("CREATE TABLE app_settings(key TEXT PRIMARY KEY, value TEXT)")
        connection.execute("INSERT INTO app_settings VALUES('secret-setting', 'hidden')")
        connection.commit()
        connection.close()
        before = sha256_file(runtime_database)
        runtime = FormalBaseRuntimeContext(base_database=runtime_database).open()
        self.addCleanup(runtime.close)
        with self.assertRaises(sqlite3.DatabaseError):
            runtime.connection.execute("SELECT * FROM app_settings").fetchall()
        with self.assertRaises(sqlite3.DatabaseError):
            runtime.connection.execute(
                "UPDATE knowledge_items SET title = title"
            )
        runtime.close()
        self.assertEqual(sha256_file(runtime_database), before)

    def test_user_store_schema_is_rejected_before_query(self) -> None:
        user_database = self.root / "account.sqlite3"
        connection = sqlite3.connect(user_database)
        connection.executescript(
            """
            CREATE TABLE knowledge_items(id TEXT);
            CREATE TABLE knowledge_relations(id TEXT);
            CREATE TABLE source_files(id TEXT);
            CREATE TABLE source_references(id TEXT);
            CREATE TABLE user_notes(id TEXT);
            """
        )
        connection.close()
        with self.assertRaisesRegex(RuntimeBoundaryError, "user-store"):
            FormalBaseRuntimeContext(base_database=user_database).open()

    def tearDown(self) -> None:
        try:
            self.service.close()
        finally:
            self.assertEqual(sha256_file(self.database), self.before_hash)


if __name__ == "__main__":
    unittest.main()
