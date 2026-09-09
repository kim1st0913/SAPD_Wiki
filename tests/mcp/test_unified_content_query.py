from __future__ import annotations

import asyncio
import hashlib
import json
import sqlite3
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

from mcp.server.fastmcp import FastMCP

from sapd_wiki.local_mcp.base_query_service import (
    SCOPE,
    BaseKnowledgeQueryService,
)
from sapd_wiki.local_mcp.dev_fixture import create_dev_formal_base
from sapd_wiki.local_mcp.core_adapter import CoreKnowledgeServiceAdapter
from sapd_wiki.local_mcp.mcp_tools import ToolRegistrar
from sapd_wiki.local_mcp.models import RequestContext
from sapd_wiki.local_mcp.errors import PolicyBlockedError


ROOT = Path(__file__).resolve().parents[2]
QUERY_SCHEMA = ROOT / "config/sql/content-query-schema-v1.sql"
DOCUMENT_REF = "base:content_document:test-value-chain"
FRAGMENT_REF = f"{DOCUMENT_REF}:slide:001"
CONTENT_RELATION_REF = f"{DOCUMENT_REF}:contains:slide:001"
BASE_RELATION_REF = "fixture://relations/a-to-b"


def sha256_file(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def request_context() -> RequestContext:
    return RequestContext(
        client_id="unified-content-client",
        grant_version="unified-content-grant",
        scope=SCOPE,
        correlation_id="unified-content-correlation",
    )


def add_content_projection(database: Path) -> None:
    connection = sqlite3.connect(database)
    try:
        connection.executescript(QUERY_SCHEMA.read_text(encoding="utf-8"))
        timestamp = "2026-07-26T21:30:00+08:00"
        connection.execute(
            """
            INSERT INTO content_documents(
              id, stable_ref, document_key, title, format, semantic_source,
              parser, ocr_policy, logical_file_name, source_asset_hash,
              manifest_id, manifest_version, metadata_json, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                "content-document-a",
                DOCUMENT_REF,
                "test-value-chain",
                "价值链安全指南",
                "pptx",
                1,
                "presentationml",
                "image-only-slide-fallback",
                "value-chain-security-guide.pptx",
                "a" * 64,
                "test-content-manifest",
                "1.0.0",
                json.dumps(
                    {
                        "inclusion_status": "approved",
                        "source_refs": ["fixture://source/value-chain"],
                        "edition_role": "source_snapshot",
                        "category_code": "architecture",
                    }
                ),
                timestamp,
                timestamp,
            ),
        )
        connection.execute(
            """
            INSERT INTO content_fragments(
              id, stable_ref, document_id, fragment_type, ordinal, title,
              body, notes, source_locator, extraction_status, content_hash,
              metadata_json, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                "content-fragment-a",
                FRAGMENT_REF,
                "content-document-a",
                "pptx_slide",
                1,
                "从价值链角度看安全的角色",
                "ftsbodyonlytoken 安全越来越成为价值交付的质量保障要素。",
                "",
                "pptx-slide:1",
                "ocr_reviewed",
                "b" * 64,
                json.dumps(
                    {
                        "businessTerm": "value delivery",
                        "drawioCellId": "must-not-leak",
                        "style": "must-not-leak",
                    },
                    ensure_ascii=False,
                ),
                timestamp,
                timestamp,
            ),
        )
        connection.executemany(
            """
            INSERT INTO content_bindings(
              id, content_ref, knowledge_ref, binding_type, confidence,
              status, metadata_json, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            [
                (
                    "binding-active-exact",
                    DOCUMENT_REF,
                    "fixture://objects/public-a",
                    "defines",
                    "exact",
                    "active",
                    '{"basis":"reviewed"}',
                    timestamp,
                    timestamp,
                ),
                (
                    "binding-active-manual",
                    DOCUMENT_REF,
                    "fixture://objects/public-c",
                    "describes",
                    "manual",
                    "active",
                    '{"basis":"manual-review"}',
                    timestamp,
                    timestamp,
                ),
                (
                    "binding-active-candidate",
                    DOCUMENT_REF,
                    "fixture://objects/public-b",
                    "elaborates",
                    "candidate",
                    "active",
                    '{}',
                    timestamp,
                    timestamp,
                ),
                (
                    "binding-rejected-exact",
                    DOCUMENT_REF,
                    "fixture://objects/public-b",
                    "provides_rule",
                    "exact",
                    "rejected",
                    '{}',
                    timestamp,
                    timestamp,
                ),
                (
                    "binding-superseded-manual",
                    DOCUMENT_REF,
                    "fixture://objects/public-b",
                    "provides_metric",
                    "manual",
                    "superseded",
                    '{}',
                    timestamp,
                    timestamp,
                ),
            ],
        )
        connection.execute(
            """
            INSERT INTO content_relations(
              id, stable_ref, source_ref, target_ref, relation_type,
              relation_label, ordinal, metadata_json, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                "content-relation-a",
                CONTENT_RELATION_REF,
                DOCUMENT_REF,
                FRAGMENT_REF,
                "contains",
                "contains slide",
                1,
                "{}",
                timestamp,
                timestamp,
            ),
        )
        connection.executemany(
            """
            INSERT INTO content_source_evidence(
              id, target_ref, source_asset_hash, source_locator,
              extraction_method, evidence_hash, metadata_json, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            [
                (
                    "content-evidence-fragment",
                    FRAGMENT_REF,
                    "a" * 64,
                    "pptx-slide:1",
                    "tesseract-ocr-reviewed",
                    "c" * 64,
                    "{}",
                    timestamp,
                ),
                (
                    "content-evidence-relation",
                    CONTENT_RELATION_REF,
                    "a" * 64,
                    "pptx-slide:1",
                    "presentationml-relation",
                    "d" * 64,
                    "{}",
                    timestamp,
                ),
            ],
        )
        connection.execute(
            """
            INSERT INTO source_references(
              id, target_type, target_id, source_file_id,
              source_sheet, source_row, source_column, source_cell,
              raw_value, source_hash, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                "evidence-relation-a-b",
                "relation",
                "relation-a-b",
                "source-a",
                "Relations",
                3,
                "Relation",
                "A3",
                "raw relation evidence must not be returned",
                "e" * 64,
                timestamp,
            ),
        )
        connection.commit()
    finally:
        connection.close()


class UnifiedContentQueryTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temporary = tempfile.TemporaryDirectory(prefix="sapd-unified-content-")
        self.addCleanup(self.temporary.cleanup)
        self.database = create_dev_formal_base(Path(self.temporary.name))
        add_content_projection(self.database)
        self.before_hash = sha256_file(self.database)
        self.service = BaseKnowledgeQueryService.create(
            base_database=self.database,
            cursor_key=b"unified-content-cursor-" + (b"x" * 32),
        )
        self.addCleanup(self.service.close)
        self.request = request_context()

    def test_search_and_exact_read_cover_content_document_and_fragment(self) -> None:
        search = self.service.search_knowledge(
            "价值链",
            request=self.request,
        ).to_dict()["data"]["items"]
        self.assertEqual(
            [item["canonical_ref"] for item in search],
            [DOCUMENT_REF, FRAGMENT_REF],
        )

        document = self.service.get_knowledge_object(
            DOCUMENT_REF,
            request=self.request,
        ).to_dict()["data"]
        self.assertEqual(document["object_type"], "content_document")
        self.assertEqual(document["logical_file_name"], "value-chain-security-guide.pptx")

        fragment = self.service.get_knowledge_object(
            FRAGMENT_REF,
            request=self.request,
        ).to_dict()["data"]
        self.assertEqual(fragment["object_type"], "pptx_slide")
        self.assertIn("价值交付", fragment["description"])
        self.assertEqual(fragment["business_metadata"]["businessTerm"], "value delivery")
        serialized = json.dumps(fragment, ensure_ascii=False)
        self.assertNotIn("must-not-leak", serialized)
        self.assertNotIn("metadata_json", serialized)

    def test_search_uses_fts_without_reading_fragment_payload_or_document_assets(
        self,
    ) -> None:
        reads: list[tuple[str | None, str | None]] = []

        def audit_read(
            action: int,
            table: str | None,
            column: str | None,
            database: str | None,
            source: str | None,
        ) -> int:
            del database, source
            if action == sqlite3.SQLITE_READ:
                reads.append((table, column))
            return sqlite3.SQLITE_OK

        connection = self.service.repository._connection
        connection.set_authorizer(audit_read)
        try:
            response = self.service.search_knowledge(
                "ftsbodyonlytoken",
                object_types=["content_section"],
                request=self.request,
            ).to_dict()
        finally:
            connection.set_authorizer(None)

        self.assertEqual(
            [item["canonical_ref"] for item in response["data"]["items"]],
            [FRAGMENT_REF],
        )
        forbidden_reads = {
            ("content_fragments", "body"),
            ("content_fragments", "notes"),
            ("content_fragments", "source_locator"),
            ("content_fragments", "content_hash"),
            ("content_documents", "parser"),
            ("content_documents", "ocr_policy"),
            ("content_documents", "source_asset_hash"),
        }
        self.assertFalse(forbidden_reads & set(reads), reads)
        serialized = json.dumps(response, ensure_ascii=False)
        self.assertNotIn("ftsbodyonlytoken", serialized)
        self.assertNotIn("pptx-slide:1", serialized)
        self.assertNotIn("b" * 64, serialized)

    def test_content_search_filters_support_source_edition_category_and_alias_type(self) -> None:
        response = self.service.search_knowledge(
            "价值链",
            object_types=["content_document"],
            category_codes=["architecture"],
            source_refs=["fixture://source/value-chain"],
            edition_roles=["source_snapshot"],
            statuses=["approved"],
            request=self.request,
        ).to_dict()["data"]
        self.assertEqual(response["total_count"], 1)
        self.assertEqual(response["items"][0]["canonical_ref"], DOCUMENT_REF)
        section = self.service.search_knowledge(
            "价值链",
            object_types=["content_section"],
            request=self.request,
        ).to_dict()["data"]
        self.assertEqual(section["total_count"], 1)
        self.assertEqual(section["items"][0]["canonical_ref"], FRAGMENT_REF)

    def test_content_relation_and_relation_ref_are_directly_readable(self) -> None:
        related = self.service.get_related_knowledge(
            DOCUMENT_REF,
            "outgoing",
            request=self.request,
        ).to_dict()["data"]["items"]
        self.assertEqual([item["relation_ref"] for item in related], [CONTENT_RELATION_REF])
        direct = self.service.get_related_knowledge(
            CONTENT_RELATION_REF,
            "both",
            request=self.request,
        ).to_dict()["data"]["items"]
        self.assertEqual(direct, related)

    def test_active_exact_manual_bindings_are_opt_in_and_candidate_states_are_hidden(self) -> None:
        legacy = self.service.get_related_knowledge(
            DOCUMENT_REF,
            "outgoing",
            request=self.request,
        ).to_dict()["data"]["items"]
        self.assertEqual([item["relation_ref"] for item in legacy], [CONTENT_RELATION_REF])

        bindings = self.service.get_related_knowledge(
            DOCUMENT_REF,
            "outgoing",
            include_bindings=True,
            relation_types=["defines", "describes", "elaborates", "provides_rule", "provides_metric"],
            request=self.request,
        ).to_dict()["data"]["items"]
        self.assertEqual(
            {(item["binding_type"], item["confidence"]) for item in bindings},
            {("defines", "exact"), ("describes", "manual")},
        )
        self.assertTrue(all(item["relation_owner"] == "content_binding" for item in bindings))
        serialized = json.dumps(bindings, ensure_ascii=False)
        for forbidden in ("candidate", "rejected", "superseded", "binding-active"):
            self.assertNotIn(forbidden, serialized)

    def test_dangling_active_binding_fails_closed_at_startup(self) -> None:
        isolated_root = Path(self.temporary.name) / "dangling-binding"
        isolated_root.mkdir()
        database = create_dev_formal_base(isolated_root)
        add_content_projection(database)
        connection = sqlite3.connect(database)
        connection.execute(
            """
            INSERT INTO content_bindings(
              id, content_ref, knowledge_ref, binding_type, confidence,
              status, metadata_json, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                "dangling-active",
                DOCUMENT_REF,
                "sok:missing:knowledge-object",
                "defines",
                "exact",
                "active",
                "{}",
                "2026-07-26T21:30:00+08:00",
                "2026-07-26T21:30:00+08:00",
            ),
        )
        connection.commit()
        connection.close()
        before = sha256_file(database)
        with self.assertRaises(PolicyBlockedError):
            BaseKnowledgeQueryService.create(
                base_database=database,
                cursor_key=b"dangling-binding-" + (b"x" * 32),
            )
        self.assertEqual(sha256_file(database), before)

    def test_related_object_type_filter_and_cursor_bind_all_conditions(self) -> None:
        filtered = self.service.get_related_knowledge(
            DOCUMENT_REF,
            "outgoing",
            include_bindings=True,
            relation_types=["defines", "describes"],
            object_types=["fixture_internal_knowledge"],
            request=self.request,
        ).to_dict()["data"]["items"]
        self.assertEqual([item["binding_type"] for item in filtered], ["describes"])

        first = self.service.get_related_knowledge(
            DOCUMENT_REF,
            "outgoing",
            include_bindings=True,
            limit=1,
            request=self.request,
        ).to_dict()
        self.assertTrue(first["page"]["has_more"])
        with self.assertRaises(Exception) as raised:
            self.service.get_related_knowledge(
                DOCUMENT_REF,
                "outgoing",
                include_bindings=True,
                relation_types=["defines"],
                limit=1,
                cursor=first["page"]["next_cursor"],
                request=self.request,
            )
        self.assertEqual(getattr(raised.exception, "code", None), "CURSOR_STALE")

    def test_content_and_base_relation_provenance_are_queryable(self) -> None:
        fragment_evidence = self.service.get_source_evidence(
            FRAGMENT_REF,
            include_excerpt=False,
            request=self.request,
        ).to_dict()["data"]["items"]
        self.assertEqual(fragment_evidence[0]["file_name"], "value-chain-security-guide.pptx")
        self.assertEqual(
            fragment_evidence[0]["extraction_method"],
            "tesseract-ocr-reviewed",
        )
        relation_evidence = self.service.get_source_evidence(
            CONTENT_RELATION_REF,
            include_excerpt=False,
            request=self.request,
        ).to_dict()["data"]["items"]
        self.assertEqual(
            relation_evidence[0]["extraction_method"],
            "presentationml-relation",
        )
        base_relation_evidence = self.service.get_source_evidence(
            BASE_RELATION_REF,
            include_excerpt=False,
            request=self.request,
        ).to_dict()["data"]["items"]
        self.assertEqual(base_relation_evidence[0]["source_sheet"], "Relations")
        self.assertNotIn("raw relation evidence", str(base_relation_evidence))

    def test_fts_allows_only_its_required_readonly_pragma(self) -> None:
        data_version = self.service.runtime.connection.execute(
            "PRAGMA data_version"
        ).fetchone()
        self.assertIsNotNone(data_version)
        with self.assertRaises(sqlite3.DatabaseError):
            self.service.runtime.connection.execute("PRAGMA user_version").fetchone()

    def tearDown(self) -> None:
        try:
            self.service.close()
        finally:
            self.assertEqual(sha256_file(self.database), self.before_hash)


class McpV11AdapterAndSchemaTests(unittest.TestCase):
    class _Response:
        def __init__(self, payload: dict[str, object]) -> None:
            self.payload = payload

        def to_dict(self) -> dict[str, object]:
            return self.payload

    class _Core:
        scope = SCOPE
        versions = SimpleNamespace(policy_version="policy-v1")

        def __init__(self) -> None:
            self.calls: list[tuple[str, dict[str, object]]] = []

        def search_knowledge(self, query: str, **kwargs: object):
            self.calls.append(("search_knowledge", {"query": query, **kwargs}))
            return McpV11AdapterAndSchemaTests._Response({"ok": True})

        def get_related_knowledge(
            self,
            canonical_ref: str,
            direction: str,
            **kwargs: object,
        ):
            self.calls.append(
                (
                    "get_related_knowledge",
                    {
                        "canonical_ref": canonical_ref,
                        "direction": direction,
                        **kwargs,
                    },
                )
            )
            return McpV11AdapterAndSchemaTests._Response({"ok": True})

    class _LegacyToolService:
        def __init__(self) -> None:
            self.calls: list[tuple[str, dict[str, object]]] = []

        @staticmethod
        def _payload() -> dict[str, object]:
            return {
                "contract_version": "sapd-mcp-tools-v1",
                "source_channel": "sapd_wiki",
                "knowledge_version": "legacy-knowledge-v1",
                "policy_version": "legacy-policy-v1",
                "identity_version": "legacy-identity-v1",
                "grant_version": "legacy-grant-v1",
                "content_trust": "untrusted_reference",
                "data": {"items": []},
                "page": {"next_cursor": None, "has_more": False},
                "warnings": [],
                "correlation_id": "legacy-correlation",
            }

        def search_knowledge(self, *, query: str, limit: int, cursor: str | None):
            self.calls.append(
                (
                    "search_knowledge",
                    {"query": query, "limit": limit, "cursor": cursor},
                )
            )
            return self._payload()

        def get_related_knowledge(
            self,
            *,
            canonical_ref: str,
            direction: str,
            limit: int,
            cursor: str | None,
        ):
            self.calls.append(
                (
                    "get_related_knowledge",
                    {
                        "canonical_ref": canonical_ref,
                        "direction": direction,
                        "limit": limit,
                        "cursor": cursor,
                    },
                )
            )
            return self._payload()

    @staticmethod
    def _token():
        return SimpleNamespace(
            client_id="adapter-client",
            scopes=[SCOPE],
            claims={"grant_version": "grant-v1", "policy_version": "policy-v1"},
        )

    def test_core_adapter_forwards_v11_filters_and_preserves_legacy_defaults(self) -> None:
        core = self._Core()
        adapter = CoreKnowledgeServiceAdapter(core)  # type: ignore[arg-type]
        with patch(
            "sapd_wiki.local_mcp.core_adapter.get_access_token",
            return_value=self._token(),
        ):
            asyncio.run(
                adapter.search_knowledge(
                    query="保护对象",
                    limit=8,
                    cursor=None,
                    object_types=["security_operations_concept"],
                    category_codes=["overview"],
                    source_refs=["sok-source:overall-framework"],
                    statuses=["active"],
                    edition_roles=["integrated_edition"],
                )
            )
            asyncio.run(
                adapter.get_related_knowledge(
                    canonical_ref="base:object:test",
                    direction="both",
                    limit=15,
                    cursor=None,
                    relation_types=["operationalizes_capability"],
                    include_bindings=True,
                    object_types=["capability_focus"],
                )
            )
            asyncio.run(
                adapter.search_knowledge(query="legacy", limit=8, cursor=None)
            )
        search_call = core.calls[0][1]
        self.assertEqual(search_call["object_types"], ["security_operations_concept"])
        self.assertEqual(search_call["source_refs"], ["sok-source:overall-framework"])
        related_call = core.calls[1][1]
        self.assertTrue(related_call["include_bindings"])
        self.assertEqual(related_call["object_types"], ["capability_focus"])
        legacy_call = core.calls[2][1]
        self.assertNotIn("object_types", legacy_call)
        self.assertNotIn("source_refs", legacy_call)

    def test_tool_schema_keeps_exactly_five_readonly_tools_and_advertises_filters(self) -> None:
        server = FastMCP("wp3-schema-test")
        ToolRegistrar(server, SimpleNamespace()).register()
        tools = server._tool_manager._tools
        self.assertEqual(
            list(tools),
            [
                "search_knowledge",
                "get_knowledge_object",
                "get_related_knowledge",
                "get_source_evidence",
                "get_knowledge_version",
            ],
        )
        search_schema = tools["search_knowledge"].parameters
        related_schema = tools["get_related_knowledge"].parameters
        self.assertFalse(search_schema["additionalProperties"])
        self.assertFalse(related_schema["additionalProperties"])
        self.assertTrue(
            {
                "object_types",
                "category_codes",
                "source_refs",
                "statuses",
                "edition_roles",
            }
            <= set(search_schema["properties"])
        )
        self.assertTrue(
            {"relation_types", "include_bindings", "object_types"}
            <= set(related_schema["properties"])
        )
        for tool in tools.values():
            self.assertTrue(tool.annotations.readOnlyHint)
            self.assertFalse(tool.annotations.destructiveHint)

    def test_tool_boundary_legacy_calls_do_not_pass_new_optional_keywords(self) -> None:
        service = self._LegacyToolService()
        server = FastMCP("wp3-legacy-call-test")
        ToolRegistrar(server, service).register()  # type: ignore[arg-type]
        tools = server._tool_manager._tools
        asyncio.run(tools["search_knowledge"].fn(query="legacy"))
        asyncio.run(
            tools["get_related_knowledge"].fn(
                canonical_ref="base:object:legacy"
            )
        )
        self.assertEqual(
            service.calls,
            [
                (
                    "search_knowledge",
                    {"query": "legacy", "limit": 8, "cursor": None},
                ),
                (
                    "get_related_knowledge",
                    {
                        "canonical_ref": "base:object:legacy",
                        "direction": "both",
                        "limit": 15,
                        "cursor": None,
                    },
                ),
            ],
        )


if __name__ == "__main__":
    unittest.main()
