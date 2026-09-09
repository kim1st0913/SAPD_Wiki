from __future__ import annotations

import hashlib
import json
import os
import sqlite3
import tempfile
import unittest
from pathlib import Path

from sapd_wiki.local_mcp.base_query_service import (
    SCOPE,
    BaseKnowledgeQueryService,
)
from sapd_wiki.local_mcp.dev_fixture import create_dev_formal_base
from sapd_wiki.local_mcp.errors import (
    CursorStaleError,
    InvalidInputError,
    ObjectNotAvailableError,
    RuntimeBoundaryError,
)
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
MQ_CASES = ROOT / "tests" / "fixtures" / "mcp" / "v1" / "security-operations-mq-cases.json"


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
        self.assertEqual(
            contract["relation_contract"]["binding_row_eligibility"],
            "status_active_and_confidence_exact_or_manual",
        )
        self.assertEqual(
            contract["tool_contract"]["query_contract_version"],
            "1.1.0",
        )
        self.assertTrue(
            contract["tool_contract"]["cursor_binds_all_filters"]
        )
        self.assertFalse(
            contract["tool_contract"]["legacy_defaults"][
                "include_bindings_omitted"
            ]
        )

    def test_mq01_through_mq11_golden_cases_use_only_the_fixed_five_tools(self) -> None:
        fixture = json.loads(MQ_CASES.read_text(encoding="utf-8"))
        cases = fixture["cases"]
        self.assertEqual([case["id"] for case in cases], [f"MQ-{index:02d}" for index in range(1, 12)])
        fixed_tools = {
            "search_knowledge",
            "get_knowledge_object",
            "get_related_knowledge",
            "get_source_evidence",
            "get_knowledge_version",
        }
        self.assertTrue(all(set(case["tools"]) <= fixed_tools for case in cases))
        self.assertEqual(fixture["candidate_counts"]["survey_questions"], 458)
        self.assertEqual(fixture["candidate_counts"]["network_foundation_questions"], 28)
        serialized = json.dumps(fixture, ensure_ascii=False)
        self.assertNotIn("/Users/", serialized)
        self.assertNotIn("/private/", serialized)

    def test_real_wp1h_candidate_remains_ineligible_for_formal_mcp_projection(self) -> None:
        candidate_path_value = os.environ.get("SAPD_WP1H_CANDIDATE_BUNDLE")
        if not candidate_path_value:
            self.skipTest("set SAPD_WP1H_CANDIDATE_BUNDLE for the real candidate canary")
        candidate_path = Path(candidate_path_value)
        fixture = json.loads(MQ_CASES.read_text(encoding="utf-8"))
        self.assertEqual(sha256_file(candidate_path), fixture["candidate_bundle_sha256"])
        candidate = json.loads(candidate_path.read_text(encoding="utf-8"))
        self.assertTrue(candidate["candidate_only"])
        self.assertTrue(candidate["gate1_ready"])
        self.assertFalse(candidate["formal_set_freeze_authorized"])
        self.assertFalse(candidate["formal_apply_authorized"])
        self.assertEqual(candidate["active_projection"]["relations"], [])
        self.assertEqual(candidate["active_projection"]["bindings"], [])
        self.assertEqual(candidate["active_projection"]["figure_descriptions"], [])
        content_projection = candidate.get("content_projection")
        self.assertIsInstance(content_projection, dict)
        self.assertEqual(
            len(candidate["content_sections"]),
            fixture["candidate_counts"]["content_sections"],
        )
        self.assertEqual(
            len(content_projection["section_index"]),
            fixture["candidate_counts"]["content_sections"],
        )
        self.assertEqual(
            len(content_projection["figure_index"]),
            fixture["candidate_counts"]["content_figures_source_only"],
        )
        self.assertEqual(
            len(content_projection["link_index"]),
            fixture["candidate_counts"]["internal_link_occurrences"],
        )
        self.assertEqual(
            len(content_projection["source_gap_projection"]),
            fixture["candidate_counts"]["source_gaps"],
        )
        self.assertEqual(
            candidate["capability_mapping_candidate_count"],
            fixture["candidate_counts"]["capability_mapping_candidates"],
        )
        self.assertEqual(
            sum(
                relation["relation_type"]
                in {
                    "operationalizes_capability",
                    "depends_on_capability",
                    "validates_capability",
                }
                for relation in candidate["relations"]
            ),
            fixture["candidate_counts"]["capability_mapping_candidates"],
        )
        self.assertEqual(
            sum(item["type"] == "survey_question" for item in candidate["items"]),
            fixture["candidate_counts"]["survey_questions"],
        )
        self.assertEqual(
            sum(item["type"] == "content_figure" for item in candidate["items"]),
            fixture["candidate_counts"]["content_figures_source_only"],
        )
        available_refs = {item["canonical_ref"] for item in candidate["items"]}
        available_refs.update(candidate["capability_catalog"]["referenced_targets"])
        for case in fixture["cases"]:
            reference = case.get("candidate_reference_ref")
            if reference:
                self.assertIn(reference, available_refs, case["id"])

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

    def test_search_filters_are_optional_composable_and_counted(self) -> None:
        by_type = self.service.search_knowledge(
            "common",
            object_types=["fixture_internal_knowledge"],
            request=self.request,
        ).to_dict()["data"]
        self.assertEqual(by_type["total_count"], 1)
        self.assertEqual(
            [item["canonical_ref"] for item in by_type["items"]],
            ["fixture://objects/public-c"],
        )
        deprecated = self.service.search_knowledge(
            "common",
            category_codes=["standard"],
            statuses=["deprecated"],
            request=self.request,
        ).to_dict()["data"]
        self.assertEqual(deprecated["total_count"], 1)
        self.assertEqual(deprecated["items"][0]["canonical_ref"], "fixture://objects/public-b")
        with self.assertRaises(InvalidInputError):
            self.service.search_knowledge(
                "common",
                object_types=["not-a-declared-or-present-type"],
                request=self.request,
            )
        with self.assertRaises(InvalidInputError):
            self.service.search_knowledge(
                "common",
                source_refs=["/Users/example/private.xlsx"],
                request=self.request,
            )

    def test_search_source_and_edition_filters_use_business_metadata_only(self) -> None:
        self.service.close()
        connection = sqlite3.connect(self.database)
        connection.execute(
            """
            UPDATE knowledge_items
            SET metadata_json=?
            WHERE id='object-a'
            """,
            (
                json.dumps(
                    {
                        "control_objective": "Protect synthetic identities.",
                        "source_refs": ["fixture://source/overall"],
                        "edition_role": "integrated_edition",
                        "file_path": "/private/synthetic/hidden.xlsx",
                    }
                ),
            ),
        )
        connection.commit()
        connection.close()
        self.before_hash = sha256_file(self.database)
        self.service = BaseKnowledgeQueryService.create(
            base_database=self.database,
            cursor_key=b"base-cursor-key-" + (b"x" * 32),
        )
        filtered = self.service.search_knowledge(
            "common",
            source_refs=["fixture://source/overall"],
            edition_roles=["integrated_edition"],
            request=self.request,
        ).to_dict()["data"]
        self.assertEqual(filtered["total_count"], 1)
        self.assertEqual(filtered["items"][0]["canonical_ref"], "fixture://objects/public-a")
        self.assertNotIn("file_path", json.dumps(filtered))

    def test_filter_conditions_are_bound_into_search_cursor(self) -> None:
        first = self.service.search_knowledge(
            "common",
            object_types=["fixture_standard_control"],
            limit=1,
            request=self.request,
        ).to_dict()
        self.assertTrue(first["page"]["has_more"])
        cursor = first["page"]["next_cursor"]
        with self.assertRaises(CursorStaleError):
            self.service.search_knowledge(
                "common",
                object_types=["fixture_standard_control"],
                statuses=["active"],
                limit=1,
                cursor=cursor,
                request=self.request,
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

    def test_security_operations_namespace_is_valid_but_unavailable_until_applied(self) -> None:
        with self.assertRaises(ObjectNotAvailableError):
            self.service.get_knowledge_object(
                "sok:concept:overall-framework:protected-object-driven-operations",
                request=self.request,
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
