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
from sapd_wiki.local_mcp.models import RequestContext


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
                '{"inclusion_status":"approved"}',
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
                "安全越来越成为价值交付的质量保障要素。",
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


if __name__ == "__main__":
    unittest.main()
