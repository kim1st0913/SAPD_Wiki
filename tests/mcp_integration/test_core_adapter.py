from __future__ import annotations

import asyncio
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

from tests.mcp.support import (
    POLICY_VERSION,
    build_synthetic_base,
    create_service,
)

from sapd_wiki.local_mcp.core_adapter import (
    CoreAdapterError,
    CoreKnowledgeServiceAdapter,
)
from sapd_wiki.local_mcp.errors import CursorStaleError


def token(*, client_id: str = "fixture-client-a", grant: str = "fixture-grant-a"):
    return SimpleNamespace(
        client_id=client_id,
        scopes=["sapd.base.public.summary.read"],
        claims={
            "grant_version": grant,
            "policy_version": POLICY_VERSION,
        },
    )


class CoreAdapterTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp = tempfile.TemporaryDirectory(prefix="sapd-mcp-integration-")
        self.root = Path(self.temp.name)
        self.database = build_synthetic_base(self.root)
        self.core = create_service(self.root, self.database)
        self.adapter = CoreKnowledgeServiceAdapter(self.core)

    def tearDown(self) -> None:
        self.core.close()
        self.temp.cleanup()

    @staticmethod
    def run_async(awaitable):
        return asyncio.run(awaitable)

    def test_authenticated_adapter_reaches_all_five_core_capabilities(self) -> None:
        with patch("sapd_wiki.local_mcp.core_adapter.get_access_token", return_value=token()):
            search = self.run_async(
                self.adapter.search_knowledge(query="common", limit=2, cursor=None)
            )
            exact = self.run_async(
                self.adapter.get_knowledge_object(
                    canonical_ref="fixture://objects/public-a"
                )
            )
            related = self.run_async(
                self.adapter.get_related_knowledge(
                    canonical_ref="fixture://objects/public-a",
                    direction="both",
                    limit=2,
                    cursor=None,
                )
            )
            evidence = self.run_async(
                self.adapter.get_source_evidence(
                    canonical_ref="fixture://objects/public-a",
                    include_excerpt=False,
                    limit=8,
                    cursor=None,
                )
            )
            version = self.run_async(self.adapter.get_knowledge_version())

        self.assertEqual(len(search["data"]["items"]), 2)
        self.assertEqual(exact["data"]["canonical_ref"], "fixture://objects/public-a")
        self.assertEqual(len(related["data"]["items"]), 2)
        self.assertFalse(evidence["data"]["items"][0]["excerpt_included"])
        self.assertEqual(version["policy_version"], POLICY_VERSION)

    def test_missing_token_and_stale_policy_fail_closed(self) -> None:
        with patch("sapd_wiki.local_mcp.core_adapter.get_access_token", return_value=None):
            with self.assertRaisesRegex(CoreAdapterError, "authenticated"):
                self.run_async(self.adapter.get_knowledge_version())

        stale = token()
        stale.claims["policy_version"] = "fixture-policy-stale"
        with patch("sapd_wiki.local_mcp.core_adapter.get_access_token", return_value=stale):
            with self.assertRaisesRegex(CoreAdapterError, "stale"):
                self.run_async(self.adapter.get_knowledge_version())

    def test_cursor_is_bound_to_authenticated_client_and_grant(self) -> None:
        with patch("sapd_wiki.local_mcp.core_adapter.get_access_token", return_value=token()):
            first = self.run_async(
                self.adapter.search_knowledge(query="common", limit=1, cursor=None)
            )
        cursor = first["page"]["next_cursor"]
        self.assertIsNotNone(cursor)

        with patch(
            "sapd_wiki.local_mcp.core_adapter.get_access_token",
            return_value=token(grant="fixture-grant-b"),
        ):
            with self.assertRaises(CursorStaleError):
                self.run_async(
                    self.adapter.search_knowledge(
                        query="common",
                        limit=1,
                        cursor=cursor,
                    )
                )


if __name__ == "__main__":
    unittest.main()
