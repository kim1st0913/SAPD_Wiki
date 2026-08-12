from __future__ import annotations

import copy
import hashlib
import json
import sqlite3
import tempfile
import unittest
from contextlib import closing
from pathlib import Path
from unittest import mock

from sapd_wiki import api_server
from sapd_wiki.projection_contract import (
    UI_PROJECTION_SUITE_VERSION,
    ProjectionManifestError,
    SemanticDigestError,
    build_release_projection_identity,
    load_projection_identity,
    parent_source_db_sha256,
    semantic_digest,
)


FOCUS_ID = "72cd12e2-f784-4775-8b3f-6d3ed4e7d398"
FOCUS_CODE = "T-AS.AD-01"
FOCUS_REF = "base:capability_focus:capability_focus::T-AS.AD-01"
SERVICE_REF = (
    "base:security_technical_service:security_technical_service:hash:c8b5b2e777f26589"
)
RELATION_REF = "base_relation:supports_focus:supports_focus:hash:5f86315cf45d128c"


class CapabilityFocusProjectionTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temporary = tempfile.TemporaryDirectory(
            prefix="sapd-capability-focus-projection-"
        )
        self.root = Path(self.temporary.name)
        self.base_database = self.root / "sapd_wiki.sqlite3"
        self.manifest = self.root / "base-manifest.json"
        self._create_base_fixture()
        artifact_sha256 = hashlib.sha256(self.base_database.read_bytes()).hexdigest()
        self.manifest.write_text(
            json.dumps(
                {
                    **build_release_projection_identity(
                        base_database=self.base_database,
                        artifact_db_sha256=artifact_sha256,
                    ),
                    "base_database": {
                        "schema_version": "content-query-schema-v1",
                        "sha256": artifact_sha256,
                    },
                    "content_asset_database": {
                        "sha256": "a" * 64,
                    },
                },
                ensure_ascii=False,
            ),
            encoding="utf-8",
        )
        self.original_paths = {
            "base_db": api_server.BASE_DB_PATH,
            "content_query_db": api_server.CONTENT_QUERY_DB_PATH,
            "content_asset_db": api_server.CONTENT_ASSET_DB_PATH,
            "user_db": api_server.USER_DB_PATH,
            "data_root": api_server.DATA_PACKAGE_ROOT,
            "export_dir": api_server.USER_EXPORT_DIR,
            "import_dir": api_server.USER_IMPORT_DIR,
            "app_data_root": api_server.APP_DATA_ROOT,
            "runtime_label": api_server.RUNTIME_LABEL,
        }
        api_server.configure_runtime_paths(
            base_db=self.base_database,
            content_query_db=self.base_database,
            user_db=self.root / "empty-user.sqlite3",
            app_data_root=self.root,
            runtime_label="capability-focus-projection-test",
            ephemeral_user_state=True,
        )

    def tearDown(self) -> None:
        api_server.configure_runtime_paths(
            **self.original_paths,
            ephemeral_user_state=False,
        )
        self.temporary.cleanup()

    def _create_base_fixture(self) -> None:
        with closing(sqlite3.connect(self.base_database)) as connection:
            connection.executescript(
                """
                CREATE TABLE knowledge_items (
                    id TEXT PRIMARY KEY,
                    type TEXT NOT NULL,
                    code TEXT,
                    title TEXT NOT NULL,
                    description TEXT,
                    category TEXT,
                    status TEXT NOT NULL DEFAULT 'active',
                    metadata_json TEXT,
                    stable_ref TEXT
                );
                CREATE TABLE knowledge_relations (
                    id TEXT PRIMARY KEY,
                    source_item_id TEXT NOT NULL,
                    target_item_id TEXT NOT NULL,
                    relation_type TEXT NOT NULL,
                    relation_label TEXT,
                    confidence TEXT NOT NULL DEFAULT 'exact',
                    metadata_json TEXT,
                    stable_ref TEXT
                );
                CREATE TABLE source_files (id TEXT PRIMARY KEY);
                CREATE TABLE source_references (id TEXT PRIMARY KEY);
                CREATE TABLE content_schema_meta (
                    key TEXT PRIMARY KEY,
                    value TEXT NOT NULL
                );
                INSERT INTO content_schema_meta VALUES (
                    'base_database_sha256',
                    '1c9d7c70574585df43656dec2c869faec6a6d1d2bb807352e534d567015b1400'
                );
                """
            )
            connection.executemany(
                """
                INSERT INTO knowledge_items (
                    id, type, code, title, description, category,
                    status, metadata_json, stable_ref
                ) VALUES (?, ?, ?, ?, ?, ?, 'active', '{}', ?)
                """,
                (
                    (
                        "00000000-0000-4000-8000-000000000001",
                        "capability_focus",
                        "T-AS.AD-00",
                        "不应被默认选择的对象",
                        "negative control",
                        "安全架构",
                        "base:capability_focus:capability_focus::T-AS.AD-00",
                    ),
                    (
                        FOCUS_ID,
                        "capability_focus",
                        FOCUS_CODE,
                        "遵循安全设计原则对网络安全架构进行设计和管控",
                        "",
                        "安全架构",
                        FOCUS_REF,
                    ),
                    (
                        "0fd95cca-0394-4ed1-b5cd-82bd2efc335f",
                        "security_technical_service",
                        "I-AP&T-AS.AD-01",
                        "应用架构管控",
                        "",
                        "应用安全",
                        SERVICE_REF,
                    ),
                ),
            )
            connection.execute(
                """
                INSERT INTO knowledge_relations (
                    id, source_item_id, target_item_id, relation_type,
                    confidence, metadata_json, stable_ref
                ) VALUES (?, ?, ?, 'supports_focus', 'exact', '{}', ?)
                """,
                (
                    "3f1ff121-12ec-4d60-87c6-c78a71f350e6",
                    "0fd95cca-0394-4ed1-b5cd-82bd2efc335f",
                    FOCUS_ID,
                    RELATION_REF,
                ),
            )
            connection.commit()

    def _response(self) -> dict:
        return api_server.capability_focus_projection_response(
            {"id": [FOCUS_ID], "code": [FOCUS_CODE]}
        )

    @staticmethod
    def _route(query: dict[str, list[str]]) -> tuple[int, dict]:
        captured: list[tuple[int, dict]] = []
        handler = object.__new__(api_server.SapdWikiRequestHandler)
        handler._send_json = lambda payload, status=200: captured.append(
            (status, payload)
        )
        handler._handle_api("/api/v1/projections/capability-focus", query)
        return captured[0]

    def test_exact_focus_and_formal_relation_triple_are_projected(self) -> None:
        payload = self._response()

        self.assertEqual(
            payload["contract_version"],
            UI_PROJECTION_SUITE_VERSION,
        )
        self.assertEqual(payload["data"]["focus"]["id"], FOCUS_ID)
        self.assertEqual(payload["data"]["focus"]["code"], FOCUS_CODE)
        self.assertEqual(
            payload["data"]["targetRef"],
            f"capability_focus:{FOCUS_ID}",
        )
        self.assertEqual(
            payload["data"]["security_technical_services"][0]["code"],
            "I-AP&T-AS.AD-01",
        )
        self.assertEqual(
            payload["data"]["security_technical_services"][0]["id"],
            "0fd95cca-0394-4ed1-b5cd-82bd2efc335f",
        )
        self.assertEqual(
            payload["data"]["security_technical_services"][0]["targetRef"],
            "security_technical_service:0fd95cca-0394-4ed1-b5cd-82bd2efc335f",
        )
        self.assertEqual(
            payload["data"]["relations"],
            [
                {
                    "relation_ref": RELATION_REF,
                    "relation_type": "supports_focus",
                    "source_ref": SERVICE_REF,
                    "target_ref": FOCUS_REF,
                    "confidence": "exact",
                }
            ],
        )
        self.assertEqual(
            payload["data"]["counts"],
            {
                "focus": 1,
                "security_technical_services": 1,
                "supports_focus": 1,
            },
        )
        self.assertEqual(
            set(payload["identity"]),
            {
                "knowledge_version",
                "database_schema_version",
                "artifact_db_sha256",
                "parent_source_db_sha256",
                "projection_contract_version",
                "content_asset_sha256",
            },
        )

    def test_wrong_code_never_falls_back_to_first_object(self) -> None:
        with self.assertRaises(KeyError):
            api_server.capability_focus_projection_response(
                {"id": [FOCUS_ID], "code": ["T-AS.AD-00"]}
            )

    def test_wrong_id_or_code_returns_404_through_http_route(self) -> None:
        cases = {
            "wrong_id": {
                "id": ["00000000-0000-4000-8000-000000000002"],
                "code": [FOCUS_CODE],
            },
            "wrong_code": {"id": [FOCUS_ID], "code": ["T-AS.AD-00"]},
        }
        for label, query in cases.items():
            with self.subTest(label=label):
                status, payload = self._route(query)
                self.assertEqual(status, 404)
                self.assertEqual(payload["data"]["error"], "not_found")

    def test_old_manifest_missing_projection_identity_returns_503(self) -> None:
        manifest = json.loads(self.manifest.read_text(encoding="utf-8"))
        manifest.pop("knowledge_version")
        manifest.pop("parent_source_db_sha256")
        manifest.pop("projection_contract_version")
        self.manifest.write_text(json.dumps(manifest), encoding="utf-8")
        api_server.configure_runtime_paths(
            base_db=self.base_database,
            content_query_db=self.base_database,
            app_data_root=self.root,
            runtime_label="capability-focus-old-manifest-test",
            ephemeral_user_state=True,
        )

        status, payload = self._route({"id": [FOCUS_ID], "code": [FOCUS_CODE]})

        self.assertEqual(status, 503)
        self.assertEqual(
            payload["data"]["error"],
            "projection_identity_unavailable",
        )

    def test_loader_rejects_projection_suite_version_mismatch(self) -> None:
        manifest = json.loads(self.manifest.read_text(encoding="utf-8"))
        manifest["projection_contract_version"] = "sapd-ui-projection-v0"
        self.manifest.write_text(json.dumps(manifest), encoding="utf-8")

        with self.assertRaisesRegex(
            ProjectionManifestError,
            "does not match runtime",
        ):
            load_projection_identity(self.manifest)

    def test_parent_source_reader_closes_connection_after_success(self) -> None:
        connection = mock.Mock()
        connection.execute.return_value.fetchone.return_value = ("b" * 64,)
        with mock.patch(
            "sapd_wiki.projection_contract.sqlite3.connect",
            return_value=connection,
        ):
            value = parent_source_db_sha256(self.base_database)

        self.assertEqual(value, "b" * 64)
        connection.close.assert_called_once_with()

    def test_parent_source_reader_closes_connection_after_query_error(self) -> None:
        connection = mock.Mock()
        connection.execute.side_effect = sqlite3.OperationalError("query failed")
        with (
            mock.patch(
                "sapd_wiki.projection_contract.sqlite3.connect",
                return_value=connection,
            ),
            self.assertRaisesRegex(
                ProjectionManifestError,
                "parent/source provenance is unavailable",
            ),
        ):
            parent_source_db_sha256(self.base_database)

        connection.close.assert_called_once_with()

    def test_api_route_reuses_cached_manifest_and_never_hashes_full_database(self) -> None:
        captured: list[tuple[int, dict]] = []
        handler = object.__new__(api_server.SapdWikiRequestHandler)
        handler._send_json = lambda payload, status=200: captured.append((status, payload))

        with (
            mock.patch.object(
                api_server,
                "load_projection_identity",
                wraps=api_server.load_projection_identity,
            ) as manifest_loader,
            mock.patch(
                "sapd_wiki.local_mcp.base_query_service._sha256_file",
                side_effect=AssertionError("full database hashing is forbidden"),
            ) as full_hash,
            mock.patch.object(
                api_server,
                "read_data_package",
                side_effect=AssertionError("public/data fallback is forbidden"),
            ) as json_fallback,
        ):
            for _request in range(2):
                handler._handle_api(
                    "/api/v1/projections/capability-focus",
                    {"id": [FOCUS_ID], "code": [FOCUS_CODE]},
                )

        self.assertEqual([status for status, _payload in captured], [200, 200])
        self.assertEqual(manifest_loader.call_count, 1)
        full_hash.assert_not_called()
        json_fallback.assert_not_called()
        self.assertEqual(
            captured[0][1]["semantic_digest"],
            captured[1][1]["semantic_digest"],
        )

    def test_projection_source_has_no_default_or_legacy_data_owner(self) -> None:
        source = (
            Path(api_server.__file__).with_name("capability_focus_projection.py")
        ).read_text(encoding="utf-8")
        self.assertNotIn("public/data", source)
        self.assertNotIn("rows[0]", source)
        self.assertNotIn("BaseKnowledgeQueryService.create", source)


class SemanticDigestTests(unittest.TestCase):
    unordered = {
        "objects": ("canonical_ref",),
        "relations": ("relation_type", "source_ref", "target_ref"),
    }
    ordered = {"stages": ("position", "code")}

    def payload(self) -> dict:
        return {
            "targetRef": f"capability_focus:{FOCUS_ID}",
            "objects": [
                {"canonical_ref": FOCUS_REF, "code": FOCUS_CODE, "title": "focus"},
                {"canonical_ref": SERVICE_REF, "code": "I-AP&T-AS.AD-01", "title": "service"},
            ],
            "relations": [
                {
                    "relation_type": "supports_focus",
                    "source_ref": SERVICE_REF,
                    "target_ref": FOCUS_REF,
                },
                {
                    "relation_type": "documents",
                    "source_ref": FOCUS_REF,
                    "target_ref": "base:content_document:guide",
                },
            ],
            "stages": [
                {"position": 1, "code": "design", "title": "设计"},
                {"position": 2, "code": "build", "title": "建设"},
            ],
            "counts": {"objects": 2, "relations": 2, "stages": 2},
        }

    def digest(self, payload: dict) -> str:
        return semantic_digest(
            payload,
            unordered_collections=self.unordered,
            ordered_collections=self.ordered,
        )

    def test_unordered_sets_are_stable_but_ordered_sequences_are_not_sorted(self) -> None:
        baseline = self.payload()
        reordered_sets = copy.deepcopy(baseline)
        reordered_sets["objects"].reverse()
        reordered_sets["relations"].reverse()
        reordered_sequence = copy.deepcopy(baseline)
        reordered_sequence["stages"].reverse()

        self.assertEqual(self.digest(baseline), self.digest(reordered_sets))
        self.assertNotEqual(self.digest(baseline), self.digest(reordered_sequence))

    def test_fields_counts_and_target_ref_are_digest_inputs(self) -> None:
        baseline = self.payload()
        baseline_digest = self.digest(baseline)
        mutations = {
            "field": lambda item: item["objects"][0].update(title="changed"),
            "count": lambda item: item["counts"].update(objects=3),
            "targetRef": lambda item: item.update(targetRef="capability_focus:changed"),
        }
        for label, mutate in mutations.items():
            with self.subTest(label=label):
                candidate = copy.deepcopy(baseline)
                mutate(candidate)
                self.assertNotEqual(baseline_digest, self.digest(candidate))

    def test_every_list_requires_an_explicit_order_contract(self) -> None:
        with self.assertRaises(SemanticDigestError):
            semantic_digest(
                {"objects": [{"canonical_ref": FOCUS_REF}], "unclassified": []},
                unordered_collections={"objects": ("canonical_ref",)},
                ordered_collections={},
            )


if __name__ == "__main__":
    unittest.main()
