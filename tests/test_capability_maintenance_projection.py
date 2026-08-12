from __future__ import annotations

import json
import os
import unittest
from pathlib import Path
from unittest import mock

from sapd_wiki import api_server
from sapd_wiki import capability_maintenance_projection as projection_module
from sapd_wiki.capability_maintenance_projection import (
    CapabilityMaintenanceProjectionService,
    SEMANTIC_RELATION_IDENTITY_FIELDS,
    _deduplicate_semantic_relations,
)
from sapd_wiki.projection_contract import (
    UI_PROJECTION_SUITE_VERSION,
    ProjectionIdentity,
    ProjectionManifestError,
    SemanticDigestError,
)


FOCUS_ID = "72cd12e2-f784-4775-8b3f-6d3ed4e7d398"
FOCUS_CODE = "T-AS.AD-01"
CATEGORY_ID = "94bba6df-c6bc-41b5-ad60-7c6e87a173ac"
DOMAIN_ID = "52656e45-e93d-4cb8-93eb-36a7e14b7655"
CAPABILITY_ID = "99db293b-2029-49ab-b84c-a86b68ada3ce"


def _configured_path(name: str) -> Path | None:
    value = os.environ.get(name, "").strip()
    if not value:
        return None
    path = Path(value).resolve()
    return path if path.exists() else None


BASE_DATABASE = _configured_path("SAPD_BATCH1_BASE_DB")
LEGACY_DATA_ROOT = _configured_path("SAPD_BATCH1_LEGACY_DATA_ROOT")
EXPECTED_MEASURE_COUNT = int(os.environ.get("SAPD_BATCH1_EXPECT_MEASURE_COUNT", "51"))


@unittest.skipUnless(
    BASE_DATABASE is not None and LEGACY_DATA_ROOT is not None,
    "set SAPD_BATCH1_BASE_DB and SAPD_BATCH1_LEGACY_DATA_ROOT for formal parity tests",
)
class CapabilityMaintenanceFormalParityTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.identity = ProjectionIdentity(
            knowledge_version="base-test",
            database_schema_version="content-query-schema-v1",
            artifact_db_sha256="a" * 64,
            parent_source_db_sha256="b" * 64,
            projection_contract_version=UI_PROJECTION_SUITE_VERSION,
            content_asset_sha256="c" * 64,
        )
        cls.service = CapabilityMaintenanceProjectionService(
            base_database=BASE_DATABASE,
            identity=cls.identity,
        )
        cls.legacy_workbench = json.loads(
            (LEGACY_DATA_ROOT / "capability-workbench.json").read_text(
                encoding="utf-8"
            )
        )

    @staticmethod
    def _route(path: str, query: dict[str, list[str]]) -> tuple[int, dict]:
        captured: list[tuple[int, dict]] = []
        handler = object.__new__(api_server.SapdWikiRequestHandler)
        handler._send_json = lambda payload, status=200: captured.append(
            (status, payload)
        )
        handler._handle_api(path, query)
        return captured[0]

    def test_formal_counts_and_golden_focus_contract(self) -> None:
        catalog = self.service.capability_catalog()["data"]
        maintenance = self.service.maintenance_index()["data"]
        focus = self.service.capability_view(
            object_type="capability_focus",
            object_id=FOCUS_ID,
            code=FOCUS_CODE,
        )
        capability = self.service.capability_view(
            object_type="capability",
            object_id=CAPABILITY_ID,
        )

        self.assertEqual(
            catalog["stats"],
            {
                "capability_category": 3,
                "capability_domain": 10,
                "capability": 32,
                "capability_focus": 91,
            },
        )
        self.assertEqual(maintenance["stats"]["security_technical_services"], 160)
        self.assertEqual(maintenance["stats"]["security_technology_modules"], 102)
        self.assertEqual(maintenance["stats"]["security_technical_measures"], 32)
        self.assertEqual(maintenance["stats"]["work_functions"], 86)
        self.assertEqual(focus["data"]["selected"]["id"], FOCUS_ID)
        self.assertEqual(focus["data"]["selected"]["code"], FOCUS_CODE)
        service_ids = {
            service["id"]
            for row in focus["data"]["technicalMappingRows"]
            for service in row["services"]
        }
        supports = {
            (row["source_id"], row["target_id"])
            for row in focus["data"]["relations"]
            if row["relation_type"] == "supports_focus"
        }
        self.assertEqual(len(service_ids), 6)
        self.assertEqual(len(supports), 6)
        self.assertEqual({target for _source, target in supports}, {FOCUS_ID})
        self.assertEqual(
            focus["semantic_digest"],
            "sha256:0ac73317192b9baa16411e257dd6c3578ccb20f2b253af1286d72b69d6e043bf",
        )
        self.assertEqual(
            capability["semantic_digest"],
            "sha256:3ba225cf688d88000231bfb3b838c53fe017b2c9727e9c79b034f41b27ba1cd2",
        )
        self.assertEqual(len(capability["data"]["relations"]), 219)

    def test_maps_to_standard_is_metadata_derived_and_2288_triples_match(self) -> None:
        snapshot = self.service._load_snapshot()
        _rows, projected = self.service._standard_rows(
            snapshot["by_type"]["capability_focus"]
        )
        actual = {(row["source_id"], row["target_id"]) for row in projected}
        expected = {
            (row["sourceId"], row["targetId"])
            for row in self.legacy_workbench["relations"]
            if row["type"] == "maps_to_standard"
        }

        self.assertEqual(len(actual), 2288)
        self.assertEqual(actual, expected)
        self.assertTrue(
            all(
                row["derivation"] == "metadata-derived"
                and row["owner"]
                == "standard_control.metadata_json.related_capability_focus"
                for row in projected
            )
        )

    def test_l0_l1_aggregate_relation_dedup_preserves_unique_triples(self) -> None:
        observed: dict[str, dict[str, object]] = {}
        digest_payloads: dict[str, dict] = {}
        current_case = ""
        original_deduplicate = projection_module._deduplicate_semantic_relations
        original_digest = projection_module.semantic_digest

        def stable_key(relation: dict) -> tuple[str, ...]:
            return tuple(
                str(relation.get(field) or "").strip()
                for field in SEMANTIC_RELATION_IDENTITY_FIELDS
            )

        def capture_deduplicate(relations: list[dict]) -> list[dict]:
            unique = original_deduplicate(relations)
            observed[current_case] = {
                "raw_count": len(relations),
                "raw_keys": {stable_key(relation) for relation in relations},
                "unique_count": len(unique),
                "unique_keys": [stable_key(relation) for relation in unique],
            }
            return unique

        def capture_digest(payload: dict, **kwargs) -> str:
            digest_payloads[current_case] = payload
            return original_digest(payload, **kwargs)

        cases = {
            "l0": (
                "capability_category",
                CATEGORY_ID,
                3417,
                3337,
                (374, 63, 63),
            ),
            "l1": (
                "capability_domain",
                DOMAIN_ID,
                1947,
                1941,
                (189, 27, 27),
            ),
        }
        with (
            mock.patch.object(
                projection_module,
                "_deduplicate_semantic_relations",
                side_effect=capture_deduplicate,
            ),
            mock.patch.object(
                projection_module,
                "semantic_digest",
                side_effect=capture_digest,
            ),
        ):
            for current_case, (
                object_type,
                object_id,
                expected_raw_count,
                expected_unique_count,
                expected_mapping_counts,
            ) in cases.items():
                view = self.service.capability_view(
                    object_type=object_type,
                    object_id=object_id,
                )
                evidence = observed[current_case]
                raw_keys = evidence["raw_keys"]
                unique_keys = evidence["unique_keys"]
                self.assertEqual(evidence["raw_count"], expected_raw_count)
                self.assertEqual(evidence["unique_count"], expected_unique_count)
                self.assertEqual(set(unique_keys), raw_keys)
                self.assertEqual(len(unique_keys), len(set(unique_keys)))
                self.assertEqual(
                    expected_raw_count - expected_unique_count,
                    80 if current_case == "l0" else 6,
                )
                self.assertEqual(view["data"]["selected"]["type"], object_type)
                self.assertEqual(view["data"]["selected"]["id"], object_id)
                self.assertEqual(
                    view["data"]["relations"],
                    digest_payloads[current_case]["relations"],
                )
                self.assertEqual(
                    digest_payloads[current_case]["counts"]["relations"],
                    expected_unique_count,
                )
                self.assertEqual(
                    (
                        len(view["data"]["technicalMappingRows"]),
                        len(view["data"]["managementMappingRows"]),
                        len(view["data"]["standardMappingRows"]),
                    ),
                    expected_mapping_counts,
                )

    def test_relation_sets_match_except_two_unowned_measure_relations(self) -> None:
        snapshot = self.service._load_snapshot()
        actual = {
            (row["relation_type"], row["source_id"], row["target_id"])
            for row in self.service.capability_catalog()["data"]["relations"]
        }
        actual.update(
            {
                (row["relation_type"], row["source_id"], row["target_id"])
                for focus in snapshot["by_type"]["capability_focus"]
                for row in self.service.capability_view(
                    object_type="capability_focus",
                    object_id=str(focus["id"]),
                    code=str(focus["code"]),
                )["data"]["relations"]
            }
        )
        expected = {
            (row["type"], row["sourceId"], row["targetId"])
            for row in self.legacy_workbench["relations"]
            if row["type"]
            in {
                "supports_focus",
                "applies_to_scope",
                "belongs_to",
                "implemented_by_module",
                "has_measure",
                "maps_to_work",
                "maps_to_process",
                "stakeholder_by",
                "maps_to_standard",
            }
        }
        actual_counts = {
            relation_type: sum(row[0] == relation_type for row in actual)
            for relation_type in {row[0] for row in actual}
        }
        self.assertEqual(
            actual_counts,
            {
                "applies_to_scope": 547,
                "belongs_to": 211,
                "has_measure": EXPECTED_MEASURE_COUNT,
                "implemented_by_module": 397,
                "maps_to_process": 89,
                "maps_to_standard": 2288,
                "maps_to_work": 92,
                "stakeholder_by": 521,
                "supports_focus": 160,
            },
        )
        legacy_objects = self.legacy_workbench["objects"]
        missing_measure_pairs = {
            (
                legacy_objects["security_technical_service"][source_id]["code"],
                legacy_objects["security_technical_measure"][target_id]["title"],
            )
            for relation_type, source_id, target_id in expected - actual
            if relation_type == "has_measure"
        }
        expected_missing = (
            {
                ("I-AP&T-AS.IA-02", "应用系统自身认证模块"),
                ("I-US&T-AS.IA-02", "应用系统自身认证模块"),
            }
            if EXPECTED_MEASURE_COUNT == 51
            else set()
        )
        self.assertEqual(missing_measure_pairs, expected_missing)
        self.assertEqual(actual - expected, set())

    def test_http_success_404_503_and_no_legacy_or_full_hash(self) -> None:
        original_path = api_server.CONTENT_QUERY_DB_PATH
        original_cache = api_server._BATCH1_PROJECTION_CACHE
        api_server.CONTENT_QUERY_DB_PATH = BASE_DATABASE
        api_server._BATCH1_PROJECTION_CACHE = None
        try:
            with (
                mock.patch.object(
                    api_server,
                    "_runtime_projection_identity",
                    return_value=self.identity,
                ),
                mock.patch.object(
                    api_server,
                    "read_data_package",
                    side_effect=AssertionError("public/data is forbidden"),
                ) as legacy_reader,
                mock.patch(
                    "sapd_wiki.local_mcp.base_query_service._sha256_file",
                    side_effect=AssertionError("full database hash is forbidden"),
                ) as full_hash,
            ):
                aggregate_views = {
                    (object_type, object_id): self._route(
                        "/api/v1/projections/capability-view",
                        {
                            "object_type": [object_type],
                            "object_id": [object_id],
                        },
                    )
                    for object_type, object_id in (
                        ("capability_category", CATEGORY_ID),
                        ("capability_domain", DOMAIN_ID),
                        ("capability", CAPABILITY_ID),
                        ("capability_focus", FOCUS_ID),
                    )
                }
                success = self._route(
                    "/api/v1/projections/capability-view",
                    {
                        "object_type": ["capability_focus"],
                        "object_id": [FOCUS_ID],
                        "code": [FOCUS_CODE],
                    },
                )
                repeat = self._route(
                    "/api/v1/projections/capability-view",
                    {
                        "object_type": ["capability_focus"],
                        "object_id": [FOCUS_ID],
                        "code": [FOCUS_CODE],
                    },
                )
                missing = self._route(
                    "/api/v1/projections/capability-view",
                    {
                        "object_type": ["capability_focus"],
                        "object_id": ["00000000-0000-4000-8000-000000000000"],
                    },
                )
            for (object_type, object_id), response in aggregate_views.items():
                self.assertEqual(response[0], 200)
                self.assertEqual(
                    response[1]["data"]["selected"]["type"], object_type
                )
                self.assertEqual(
                    response[1]["data"]["selected"]["id"], object_id
                )
            self.assertEqual(success[0], 200)
            self.assertEqual(repeat[0], 200)
            self.assertEqual(
                success[1]["semantic_digest"], repeat[1]["semantic_digest"]
            )
            self.assertEqual(missing[0], 404)
            legacy_reader.assert_not_called()
            full_hash.assert_not_called()

            api_server._BATCH1_PROJECTION_CACHE = None
            with mock.patch.object(
                api_server,
                "_runtime_projection_identity",
                side_effect=ProjectionManifestError("missing identity"),
            ):
                unavailable = self._route(
                    "/api/v1/projections/capability-catalog", {}
                )
            self.assertEqual(unavailable[0], 503)

            missing_database = BASE_DATABASE.with_name(
                "__missing_batch1_base__.sqlite3"
            )
            self.assertFalse(missing_database.exists())
            api_server.CONTENT_QUERY_DB_PATH = missing_database
            api_server._BATCH1_PROJECTION_CACHE = None
            with mock.patch.object(
                api_server,
                "_runtime_projection_identity",
                return_value=self.identity,
            ):
                unavailable_database = self._route(
                    "/api/v1/projections/capability-catalog", {}
                )
            self.assertEqual(unavailable_database[0], 400)
            self.assertEqual(
                unavailable_database[1]["data"]["error"], "policy_blocked"
            )
        finally:
            api_server.CONTENT_QUERY_DB_PATH = original_path
            api_server._BATCH1_PROJECTION_CACHE = original_cache


class CapabilityMaintenancePhysicalMeasureRelationTests(unittest.TestCase):
    def test_relation_dedup_preserves_order_and_rejects_conflicts(self) -> None:
        first = {
            "relation_ref": "projection:belongs_to:a->b",
            "relation_type": "belongs_to",
            "source_ref": "a",
            "target_ref": "b",
            "owner": "knowledge_relations",
        }
        second = {
            "relation_ref": "projection:stakeholder_by:c->d",
            "relation_type": "stakeholder_by",
            "source_ref": "c",
            "target_ref": "d",
            "owner": "knowledge_relations",
        }
        self.assertEqual(
            _deduplicate_semantic_relations([first, dict(first), second]),
            [first, second],
        )

        conflicting = {**first, "owner": "different-owner"}
        with self.assertRaisesRegex(
            SemanticDigestError,
            "conflicting duplicate semantic relation identity",
        ):
            _deduplicate_semantic_relations([first, conflicting])

    def test_service_uses_measure_is_projected_without_runtime_inference(self) -> None:
        service = CapabilityMaintenanceProjectionService.__new__(
            CapabilityMaintenanceProjectionService
        )
        service._load_snapshot = lambda: {
            "by_type": {
                "security_technical_service": [
                    {
                        "id": "service-record",
                        "canonical_ref": "security_technical_service:service-record",
                        "object_type": "security_technical_service",
                        "code": "I-AP&T-AS.IA-02",
                        "business_metadata": {},
                    }
                ],
                "security_technical_measure": [
                    {
                        "id": "measure-record",
                        "canonical_ref": "security_technical_measure:measure-record",
                        "object_type": "security_technical_measure",
                        "display_name": "应用系统自身认证模块",
                        "business_metadata": {},
                    }
                ],
            },
            "by_ref": {
                "security_technical_service:service-record": {
                    "id": "service-record",
                    "canonical_ref": "security_technical_service:service-record",
                    "object_type": "security_technical_service",
                    "code": "I-AP&T-AS.IA-02",
                    "business_metadata": {},
                },
                "security_technical_measure:measure-record": {
                    "id": "measure-record",
                    "canonical_ref": "security_technical_measure:measure-record",
                    "object_type": "security_technical_measure",
                    "display_name": "应用系统自身认证模块",
                    "business_metadata": {},
                },
            },
            "by_type_code": {},
            "relations": [
                {
                    "relation_type": "uses_measure",
                    "source_ref": "security_technical_service:service-record",
                    "target_ref": "security_technical_measure:measure-record",
                }
            ],
            "lcdt_sources": [],
        }

        self.assertEqual(
            service._measure_service_pairs(),
            {
                (
                    "security_technical_service:service-record",
                    "security_technical_measure:measure-record",
                )
            },
        )

    def test_source_has_no_json_default_or_query_service_hash_lifecycle(self) -> None:
        source = Path(
            "src/sapd_wiki/capability_maintenance_projection.py"
        ).read_text(encoding="utf-8")
        self.assertNotIn("public/data", source)
        self.assertNotIn("rows[0]", source)
        self.assertNotIn("BaseKnowledgeQueryService.create", source)
        self.assertNotIn("_sha256_file", source)


if __name__ == "__main__":
    unittest.main()
