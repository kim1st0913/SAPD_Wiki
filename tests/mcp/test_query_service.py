from __future__ import annotations

import tempfile
import unittest
from pathlib import Path

from support import (
    MANIFEST_DIGEST,
    build_synthetic_base,
    create_service,
    request_context,
)
from sapd_wiki.local_mcp.errors import (
    InvalidInputError,
    ObjectNotAvailableError,
    ResponseTooLargeError,
)


class QueryServiceTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name)
        self.database = build_synthetic_base(self.root)
        self.service = create_service(self.root, self.database)
        self.addCleanup(self.service.close)
        self.request = request_context()

    def test_search_filters_hidden_before_page_and_returns_explicit_dtos(self) -> None:
        response = self.service.search_knowledge(
            "common",
            request=self.request,
        ).to_dict()
        items = response["data"]["items"]
        self.assertEqual(len(items), 3)
        self.assertFalse(any("Hidden" in item["display_name"] for item in items))
        self.assertFalse(
            {"effective_sensitive_level", "ai_use_policy"} & set(items[0])
        )
        self.assertEqual(response["content_trust"], "untrusted_reference")
        self.assertEqual(response["source_channel"], "sapd_wiki")

    def test_search_uses_hmac_keyset_pagination(self) -> None:
        first = self.service.search_knowledge(
            "common",
            request=self.request,
            limit=1,
        ).to_dict()
        self.assertTrue(first["page"]["has_more"])
        self.assertTrue(first["page"]["next_cursor"])
        second = self.service.search_knowledge(
            "common",
            request=self.request,
            limit=1,
            cursor=first["page"]["next_cursor"],
        ).to_dict()
        self.assertNotEqual(
            first["data"]["items"][0]["canonical_ref"],
            second["data"]["items"][0]["canonical_ref"],
        )

    def test_get_object_public_summary_and_metadata_only(self) -> None:
        public = self.service.get_knowledge_object(
            "fixture://objects/public-a",
            request=self.request,
        ).to_dict()["data"]
        metadata = self.service.get_knowledge_object(
            "fixture://objects/public-b",
            request=self.request,
        ).to_dict()["data"]
        self.assertEqual(public["ai_summary"], "Synthetic common summary Alpha.")
        self.assertNotIn("ai_summary", metadata)
        self.assertEqual(metadata["display_name"], "Synthetic common Beta")

    def test_hidden_and_missing_objects_have_the_same_error(self) -> None:
        errors = []
        for canonical_ref in (
            "fixture://objects/hidden-a",
            "fixture://objects/missing-a",
        ):
            with self.subTest(canonical_ref=canonical_ref):
                with self.assertRaises(ObjectNotAvailableError) as caught:
                    self.service.get_knowledge_object(
                        canonical_ref,
                        request=self.request,
                    )
                errors.append((caught.exception.code, str(caught.exception)))
        self.assertEqual(errors[0], errors[1])

    def test_related_hides_relation_with_hidden_endpoint(self) -> None:
        response = self.service.get_related_knowledge(
            "fixture://objects/public-a",
            "both",
            request=self.request,
        ).to_dict()
        relations = response["data"]["items"]
        self.assertEqual(len(relations), 2)
        self.assertFalse(any("hidden" in row["relation_ref"] for row in relations))
        self.assertEqual(
            {row["relation_ref"] for row in relations},
            {
                "fixture://relations/a-to-b",
                "fixture://relations/a-to-c",
            },
        )

    def test_evidence_forces_no_excerpt_and_exposes_no_path(self) -> None:
        response = self.service.get_source_evidence(
            "fixture://objects/public-a",
            include_excerpt=False,
            request=self.request,
        ).to_dict()
        evidence = response["data"]["items"][0]
        self.assertFalse(evidence["excerpt_included"])
        self.assertEqual(evidence["source_basis"], "fixture-only")
        self.assertFalse({"path", "local_path", "reviewed_by_principal"} & set(evidence))
        with self.assertRaises(InvalidInputError):
            self.service.get_source_evidence(
                "fixture://objects/public-a",
                include_excerpt=True,
                request=self.request,
            )

    def test_version_has_no_host_user_or_database_path(self) -> None:
        response = self.service.get_knowledge_version(
            request=self.request,
        ).to_dict()
        self.assertEqual(response["data"]["manifest_digest"], MANIFEST_DIGEST)
        serialized = str(response)
        self.assertNotIn(str(self.root), serialized)
        self.assertNotIn("sqlite3", serialized)
        self.assertNotIn("username", serialized)

    def test_invalid_query_limit_ref_scope_and_control_characters_fail(self) -> None:
        invalid_calls = [
            lambda: self.service.search_knowledge("", request=self.request),
            lambda: self.service.search_knowledge(
                "common",
                request=self.request,
                limit=16,
            ),
            lambda: self.service.search_knowledge(
                "bad\x00query",
                request=self.request,
            ),
            lambda: self.service.get_knowledge_object(
                "https://example.test/object",
                request=self.request,
            ),
            lambda: self.service.get_knowledge_version(
                request=request_context(scope="wrong.scope"),
            ),
        ]
        for call in invalid_calls:
            with self.subTest(call=call):
                with self.assertRaises(InvalidInputError):
                    call()

    def test_tool_character_limit_fails_without_truncation(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            database = build_synthetic_base(root, large_summary=True)
            with create_service(root, database) as service:
                with self.assertRaises(ResponseTooLargeError):
                    service.get_knowledge_object(
                        "fixture://objects/public-a",
                        request=request_context(),
                    )


if __name__ == "__main__":
    unittest.main()
