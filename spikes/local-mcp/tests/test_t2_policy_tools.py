from __future__ import annotations

import json
import sys
import tempfile
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[3]
M0T = ROOT / "spikes/local-mcp/m0t"
sys.path.insert(0, str(M0T))

from build_synthetic_base import build_synthetic_base  # noqa: E402
from policy_engine import PolicyError, normalize_text  # noqa: E402
from tool_handlers import POLICY_VERSION, ToolError, ToolHandlers  # noqa: E402


class T2PolicyToolTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp = tempfile.TemporaryDirectory(prefix="sapd-m0t-t2-tools-")
        self.test_root = Path(self.temp.name).resolve()
        self.base = self.test_root / "synthetic-base.sqlite3"
        build_synthetic_base(self.test_root, self.base)
        self.handlers = ToolHandlers(
            test_root=self.test_root,
            synthetic_base=self.base,
            cursor_key=b"t2-policy-tool-cursor-key-" + (b"k" * 32),
        )

    def tearDown(self) -> None:
        self.temp.cleanup()

    def call(self, name: str, arguments: dict[str, object]) -> dict[str, object]:
        return self.handlers.call(
            name,
            arguments,
            client_id="fixture-client",
            correlation_id="fixture-correlation",
        )

    def test_definitions_are_five_readonly_closed_schemas(self) -> None:
        definitions = self.handlers.definitions()
        self.assertEqual(len(definitions), 5)
        self.assertTrue(all(item["annotations"]["readOnlyHint"] for item in definitions))
        self.assertTrue(
            all(item["inputSchema"]["additionalProperties"] is False for item in definitions)
        )

    def test_public_summary_metadata_only_and_denied_object(self) -> None:
        public = self.call(
            "get_knowledge_object",
            {"canonical_ref": "fixture://objects/public-a"},
        )
        metadata = self.call(
            "get_knowledge_object",
            {"canonical_ref": "fixture://objects/public-b"},
        )
        self.assertIn("ai_summary", public["data"])
        self.assertNotIn("ai_summary", metadata["data"])
        with self.assertRaises(ToolError) as context:
            self.call(
                "get_knowledge_object",
                {"canonical_ref": "fixture://objects/denied-a"},
            )
        self.assertEqual(context.exception.code, "OBJECT_NOT_AVAILABLE")

    def test_search_filters_hidden_before_page_and_count(self) -> None:
        result = self.call("search_knowledge", {"query": "Synthetic", "limit": 15})
        items = result["data"]["items"]
        self.assertEqual(len(items), 2)
        self.assertNotIn("total", result["data"])
        self.assertNotIn("hidden", json.dumps(result))
        self.assertFalse(result["page"]["has_more"])

    def test_empty_query_control_characters_and_extra_keys_are_rejected(self) -> None:
        for arguments in (
            {"query": ""},
            {"query": "fixture\u0001"},
            {"query": "Synthetic", "unexpected": True},
        ):
            with self.assertRaises(ToolError) as context:
                self.call("search_knowledge", arguments)
            self.assertEqual(context.exception.code, "INVALID_INPUT")
        with self.assertRaises(PolicyError):
            normalize_text("fixture\u0001", maximum=100)

    def test_related_hides_relation_when_one_endpoint_is_denied(self) -> None:
        result = self.call(
            "get_related_knowledge",
            {
                "canonical_ref": "fixture://objects/public-a",
                "direction": "outgoing",
            },
        )
        relations = result["data"]["items"]
        self.assertEqual(len(relations), 1)
        self.assertEqual(
            relations[0]["target_ref"],
            "fixture://objects/public-b",
        )

    def test_evidence_forces_no_excerpt_and_no_path(self) -> None:
        with self.assertRaises(ToolError):
            self.call(
                "get_source_evidence",
                {
                    "canonical_ref": "fixture://objects/public-a",
                    "include_excerpt": True,
                },
            )
        result = self.call(
            "get_source_evidence",
            {
                "canonical_ref": "fixture://objects/public-a",
                "include_excerpt": False,
            },
        )
        serialized = json.dumps(result)
        self.assertNotIn("/" + "Users/", serialized)
        self.assertNotIn("sqlite3", serialized)
        self.assertFalse(result["data"]["items"][0]["excerpt_included"])

    def test_version_has_no_path_host_or_user(self) -> None:
        result = self.call("get_knowledge_version", {})
        serialized = json.dumps(result)
        self.assertEqual(result["data"]["knowledge_version"], "fixture-knowledge-v1")
        for forbidden in ("/", "\\", "localhost", "username", "database"):
            self.assertNotIn(forbidden, serialized)

    def test_cursor_integrity_binding_and_staleness(self) -> None:
        first = self.call("search_knowledge", {"query": "Synthetic", "limit": 1})
        cursor = first["page"]["next_cursor"]
        self.assertTrue(first["page"]["has_more"])
        second = self.call(
            "search_knowledge",
            {"query": "Synthetic", "limit": 1, "cursor": cursor},
        )
        self.assertFalse(second["page"]["has_more"])
        with self.assertRaises(ToolError) as context:
            self.call(
                "search_knowledge",
                {"query": "Synthetic", "limit": 1, "cursor": cursor + "x"},
            )
        self.assertEqual(context.exception.code, "CURSOR_STALE")
        payload = self.handlers._cursor.decode(cursor)
        payload["policy_version"] = POLICY_VERSION + "-changed"
        stale = self.handlers._cursor.encode(payload)
        with self.assertRaises(ToolError) as context:
            self.call(
                "search_knowledge",
                {"query": "Synthetic", "limit": 1, "cursor": stale},
            )
        self.assertEqual(context.exception.code, "CURSOR_STALE")

    def test_response_absolute_limit_fails_closed(self) -> None:
        with self.assertRaises(ToolError) as context:
            self.handlers._base_output(
                data={"oversized": "x" * 70000},
                correlation_id="fixture-correlation",
            )
        self.assertEqual(context.exception.code, "RESPONSE_TOO_LARGE")


if __name__ == "__main__":
    unittest.main()
