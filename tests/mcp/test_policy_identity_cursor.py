from __future__ import annotations

import sqlite3
import tempfile
import unittest
from pathlib import Path

from support import (
    IDENTITY_VERSION,
    MANIFEST_DIGEST,
    POLICY_VERSION,
    build_synthetic_base,
    create_service,
    request_context,
)
from sapd_wiki.local_mcp.cursor import CursorContext
from sapd_wiki.local_mcp.errors import (
    CursorStaleError,
    McpCoreError,
    ObjectNotAvailableError,
    PolicyBlockedError,
)
from sapd_wiki.local_mcp.identity import IdentityRedirect, IdentityResolver
from sapd_wiki.local_mcp.policy import AiExposurePolicy
from sapd_wiki.local_mcp.query_service import SORT_VERSION


class MutableClock:
    def __init__(self, value: float = 1000.0) -> None:
        self.value = value

    def __call__(self) -> float:
        return self.value


class PolicyIdentityCursorTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name)
        self.database = build_synthetic_base(self.root)
        self.clock = MutableClock()
        self.service = create_service(
            self.root,
            self.database,
            cursor_ttl_seconds=30,
            cursor_clock=self.clock,
        )
        self.addCleanup(self.service.close)
        self.request = request_context()

    def _first_cursor(self) -> str:
        response = self.service.search_knowledge(
            "common",
            request=self.request,
            limit=1,
        ).to_dict()
        cursor = response["page"]["next_cursor"]
        self.assertIsInstance(cursor, str)
        return cursor

    def test_cursor_tampering_and_ttl_fail_closed(self) -> None:
        cursor = self._first_cursor()
        with self.assertRaises(CursorStaleError):
            self.service.search_knowledge(
                "common",
                request=self.request,
                limit=1,
                cursor=cursor[:-1] + ("A" if cursor[-1] != "A" else "B"),
            )
        self.clock.value += 31
        with self.assertRaises(CursorStaleError):
            self.service.search_knowledge(
                "common",
                request=self.request,
                limit=1,
                cursor=cursor,
            )

    def test_cursor_binds_parameters_client_grant_and_scope(self) -> None:
        cursor = self._first_cursor()
        stale_calls = [
            lambda: self.service.search_knowledge(
                "Alpha",
                request=self.request,
                limit=1,
                cursor=cursor,
            ),
            lambda: self.service.search_knowledge(
                "common",
                request=self.request,
                limit=2,
                cursor=cursor,
            ),
            lambda: self.service.search_knowledge(
                "common",
                request=request_context(client_id="fixture-client-b"),
                limit=1,
                cursor=cursor,
            ),
            lambda: self.service.search_knowledge(
                "common",
                request=request_context(grant_version="fixture-grant-b"),
                limit=1,
                cursor=cursor,
            ),
        ]
        for call in stale_calls:
            with self.subTest(call=call):
                with self.assertRaises(CursorStaleError):
                    call()
        with self.assertRaises(McpCoreError) as caught:
            self.service.search_knowledge(
                "common",
                request=request_context(scope="fixture.wrong.scope"),
                limit=1,
                cursor=cursor,
            )
        self.assertEqual(caught.exception.code, "INVALID_INPUT")

    def test_cursor_binds_all_frozen_contract_fields(self) -> None:
        context = CursorContext(
            tool="search_knowledge",
            normalized_parameters={"query": "common", "limit": 1},
            client=self.request.client_id,
            grant=self.request.grant_version,
            scope=self.request.scope,
            policy_version=self.service.versions.policy_version,
            knowledge_version=self.service.versions.knowledge_version,
            identity_version=self.service.versions.identity_version,
            sort_version=SORT_VERSION,
        )
        cursor = self.service.cursor.encode(
            context,
            last_sort_key="fixture://objects/public-a",
        )
        mutations = {
            "tool": "get_related_knowledge",
            "policy_version": "fixture-policy-v2",
            "knowledge_version": "fixture-knowledge-v2",
            "identity_version": "fixture-identity-v2",
            "sort_version": "fixture-sort-v2",
        }
        for field, value in mutations.items():
            values = {
                "tool": context.tool,
                "normalized_parameters": context.normalized_parameters,
                "client": context.client,
                "grant": context.grant,
                "scope": context.scope,
                "policy_version": context.policy_version,
                "knowledge_version": context.knowledge_version,
                "identity_version": context.identity_version,
                "sort_version": context.sort_version,
            }
            values[field] = value
            with self.subTest(field=field):
                with self.assertRaises(CursorStaleError):
                    self.service.cursor.decode(cursor, CursorContext(**values))

    def test_policy_signature_manifest_object_and_relation_anomalies_block_startup(self) -> None:
        policies = [
            AiExposurePolicy.synthetic(
                policy_version=POLICY_VERSION,
                expected_manifest_digest=MANIFEST_DIGEST,
                signature_valid=False,
            ),
            AiExposurePolicy.synthetic(
                policy_version=POLICY_VERSION,
                expected_manifest_digest="sha256:" + ("e" * 64),
            ),
        ]
        for policy in policies:
            with self.subTest(policy=policy):
                with self.assertRaises(PolicyBlockedError):
                    create_service(self.root, self.database, policy=policy)

        self.service.close()
        with sqlite3.connect(self.database) as connection:
            connection.execute(
                "UPDATE knowledge_objects SET object_type='unknown_type' WHERE canonical_ref='fixture://objects/hidden-a'"
            )
        with self.assertRaises(PolicyBlockedError) as object_error:
            create_service(self.root, self.database)
        self.assertEqual(object_error.exception.code, "UNKNOWN_OBJECT_TYPE")

    def test_unknown_relation_type_blocks_startup(self) -> None:
        self.service.close()
        with sqlite3.connect(self.database) as connection:
            connection.execute(
                "UPDATE knowledge_relations SET relation_type='unknown_relation' WHERE relation_ref='fixture://relations/a-to-hidden'"
            )
        with self.assertRaises(PolicyBlockedError) as caught:
            create_service(self.root, self.database)
        self.assertEqual(caught.exception.code, "UNKNOWN_RELATION_TYPE")

    def test_identity_redirect_valid_denied_cycle_and_stale(self) -> None:
        valid = IdentityResolver(
            identity_version=IDENTITY_VERSION,
            redirects={
                "fixture://objects/old-a": IdentityRedirect(
                    target_ref="fixture://objects/public-a",
                    source_identity_version=IDENTITY_VERSION,
                    target_identity_version=IDENTITY_VERSION,
                )
            },
        )
        with create_service(self.root, self.database, identity=valid) as service:
            resolved = service.get_knowledge_object(
                "fixture://objects/old-a",
                request=self.request,
            ).to_dict()
            self.assertEqual(
                resolved["data"]["canonical_ref"],
                "fixture://objects/public-a",
            )

        denied = IdentityResolver(
            identity_version=IDENTITY_VERSION,
            redirects={
                "fixture://objects/old-hidden": IdentityRedirect(
                    target_ref="fixture://objects/hidden-a",
                    source_identity_version=IDENTITY_VERSION,
                    target_identity_version=IDENTITY_VERSION,
                )
            },
        )
        with create_service(self.root, self.database, identity=denied) as service:
            with self.assertRaises(ObjectNotAvailableError):
                service.get_knowledge_object(
                    "fixture://objects/old-hidden",
                    request=self.request,
                )

        cycle = IdentityResolver(
            identity_version=IDENTITY_VERSION,
            redirects={
                "fixture://objects/old-a": IdentityRedirect(
                    "fixture://objects/old-b",
                    IDENTITY_VERSION,
                    IDENTITY_VERSION,
                ),
                "fixture://objects/old-b": IdentityRedirect(
                    "fixture://objects/old-a",
                    IDENTITY_VERSION,
                    IDENTITY_VERSION,
                ),
            },
        )
        with create_service(self.root, self.database, identity=cycle) as service:
            with self.assertRaises(PolicyBlockedError) as caught:
                service.get_knowledge_object(
                    "fixture://objects/old-a",
                    request=self.request,
                )
            self.assertEqual(caught.exception.code, "IDENTITY_REDIRECT_CYCLE")

        stale = IdentityResolver(
            identity_version=IDENTITY_VERSION,
            redirects={
                "fixture://objects/old-a": IdentityRedirect(
                    "fixture://objects/public-a",
                    IDENTITY_VERSION,
                    "fixture-identity-v2",
                )
            },
        )
        with create_service(self.root, self.database, identity=stale) as service:
            with self.assertRaises(PolicyBlockedError) as caught:
                service.get_knowledge_object(
                    "fixture://objects/old-a",
                    request=self.request,
                )
            self.assertEqual(caught.exception.code, "IDENTITY_VERSION_STALE")


if __name__ == "__main__":
    unittest.main()
