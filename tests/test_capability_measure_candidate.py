from __future__ import annotations

import json
import os
import shutil
import sqlite3
import tempfile
import unittest
from pathlib import Path
from unittest import mock

from scripts.apply_capability_measure_candidate import (
    APPLY_CONFIRMATION,
    apply_formal,
)
from scripts.build_capability_measure_candidate import (
    APPROVED_SERVICE_CODES,
    FORMAL_SHA256,
    MEASURE_TITLE,
    SOURCE_SHA256,
    build_candidate,
    sha256_file,
)
from sapd_wiki.capability_maintenance_projection import (
    CapabilityMaintenanceProjectionService,
    _projection_id,
)
from sapd_wiki import api_server
from sapd_wiki.projection_contract import ProjectionIdentity, load_projection_identity


def _configured_path(name: str) -> Path | None:
    value = os.environ.get(name, "").strip()
    if not value:
        return None
    path = Path(value).resolve()
    return path if path.exists() else None


BASE_DATABASE = _configured_path("SAPD_BATCH1_BASE_DB")
SOURCE_WORKBOOK = _configured_path("SAPD_BATCH1_SOURCE_WORKBOOK")
CONTENT_ASSET_DATABASE = _configured_path("SAPD_BATCH1_CONTENT_ASSET_DB")


class CapabilityMeasureApplyGateTests(unittest.TestCase):
    def test_already_applied_formal_is_rejected_before_lock_creation(self) -> None:
        with tempfile.TemporaryDirectory(prefix="sapd-batch1-apply-gate-") as temp_dir:
            root = Path(temp_dir)
            formal = root / "sapd_wiki.sqlite3"
            formal.write_bytes(b"already-applied-artifact")

            with self.assertRaisesRegex(
                ValueError,
                "formal base CAS changed before atomic replacement",
            ):
                apply_formal(
                    root / "unused-bundle",
                    formal,
                    root / "unused-source.xlsx",
                    root / "unused-assets.sqlite3",
                    APPLY_CONFIRMATION,
                )

            self.assertFalse(
                (root / ".phase2-batch1-formal-apply.lock").exists()
            )


@unittest.skipUnless(
    BASE_DATABASE and SOURCE_WORKBOOK and CONTENT_ASSET_DATABASE,
    "set the three SAPD_BATCH1 candidate source paths",
)
class CapabilityMeasureCandidateTests(unittest.TestCase):
    def test_candidate_is_exactly_two_relations_and_recovery_restores_parent(self) -> None:
        formal_sha_before = sha256_file(BASE_DATABASE)
        source_sha_before = sha256_file(SOURCE_WORKBOOK)
        with tempfile.TemporaryDirectory(prefix="sapd-batch1-measure-") as temp_dir:
            output = Path(temp_dir) / "candidate"
            report = build_candidate(
                base_database=BASE_DATABASE,
                workbook=SOURCE_WORKBOOK,
                content_asset_database=CONTENT_ASSET_DATABASE,
                output_dir=output,
            )
            candidate = Path(report["candidate_database"])
            rollback = Path(report["rollback_database"])
            manifest = json.loads(
                Path(report["candidate_manifest"]).read_text(encoding="utf-8")
            )

            self.assertEqual(formal_sha_before, FORMAL_SHA256)
            self.assertEqual(source_sha_before, SOURCE_SHA256)
            self.assertEqual(manifest["parent_source_db_sha256"], FORMAL_SHA256)
            self.assertEqual(manifest["parent_artifact_db_sha256"], FORMAL_SHA256)
            self.assertEqual(manifest["object_delta"], 0)
            self.assertEqual(len(manifest["relation_delta"]), 2)
            self.assertTrue(manifest["source_workbook"]["source_file_id"])
            self.assertTrue(manifest["source_workbook"]["import_job_id"])

            conn = sqlite3.connect(f"file:{candidate}?mode=ro&immutable=1", uri=True)
            try:
                rows = conn.execute(
                    """
                    SELECT service.code, measure.title, relation.relation_type
                    FROM knowledge_relations AS relation
                    JOIN knowledge_items AS service ON service.id=relation.source_item_id
                    JOIN knowledge_items AS measure ON measure.id=relation.target_item_id
                    WHERE relation.relation_type='uses_measure'
                      AND service.type='security_technical_service'
                      AND measure.type='security_technical_measure'
                      AND service.code IN (?, ?)
                      AND measure.title=?
                    ORDER BY service.code
                    """,
                    (*APPROVED_SERVICE_CODES, MEASURE_TITLE),
                ).fetchall()
                self.assertEqual(
                    rows,
                    [
                        ("I-AP&T-AS.IA-02", MEASURE_TITLE, "uses_measure"),
                        ("I-US&T-AS.IA-02", MEASURE_TITLE, "uses_measure"),
                    ],
                )
            finally:
                conn.close()

            identity = load_projection_identity(Path(report["candidate_manifest"]))
            service = CapabilityMaintenanceProjectionService(
                base_database=candidate,
                identity=identity,
            )
            pairs = service._measure_service_pairs()
            snapshot = service._load_snapshot()
            actual = {
                (
                    snapshot["by_ref"][service_ref]["code"],
                    snapshot["by_ref"][measure_ref]["display_name"],
                )
                for service_ref, measure_ref in pairs
            }
            self.assertEqual(len(pairs), 53)
            self.assertTrue(
                {(code, MEASURE_TITLE) for code in APPROVED_SERVICE_CODES}
                <= actual
            )

            baseline_identity = ProjectionIdentity(
                knowledge_version="base-formal-test",
                database_schema_version="content-query-schema-v1",
                artifact_db_sha256=FORMAL_SHA256,
                parent_source_db_sha256="1c9d7c70574585df43656dec2c869faec6a6d1d2bb807352e534d567015b1400",
                projection_contract_version=identity.projection_contract_version,
                content_asset_sha256=identity.content_asset_sha256,
            )
            baseline_service = CapabilityMaintenanceProjectionService(
                base_database=BASE_DATABASE,
                identity=baseline_identity,
            )
            focus = snapshot["by_type_code"][("capability_focus", "T-AS.IA-02")]
            baseline_view = baseline_service.capability_view(
                object_type="capability_focus",
                object_id=focus["id"],
                code=focus["code"],
            )
            candidate_view = service.capability_view(
                object_type="capability_focus",
                object_id=focus["id"],
                code=focus["code"],
            )
            baseline_relations = {
                (row["relation_type"], row["source_id"], row["target_id"])
                for row in baseline_view["data"]["relations"]
            }
            candidate_relations = {
                (row["relation_type"], row["source_id"], row["target_id"])
                for row in candidate_view["data"]["relations"]
            }
            projected_delta = candidate_relations - baseline_relations
            projected_by_id = {
                _projection_id(item): item
                for item in snapshot["by_ref"].values()
            }
            self.assertEqual(
                {
                    (
                        row[0],
                        projected_by_id[row[1]]["code"],
                        projected_by_id[row[2]]["display_name"],
                    )
                    for row in projected_delta
                },
                {("has_measure", code, MEASURE_TITLE) for code in APPROVED_SERVICE_CODES},
            )
            self.assertFalse(baseline_relations - candidate_relations)
            self.assertNotEqual(
                baseline_view["semantic_digest"],
                candidate_view["semantic_digest"],
            )

            original_path = api_server.CONTENT_QUERY_DB_PATH
            original_cache = api_server._BATCH1_PROJECTION_CACHE
            api_server.CONTENT_QUERY_DB_PATH = candidate
            api_server._BATCH1_PROJECTION_CACHE = None
            captured: list[tuple[int, dict]] = []
            handler = object.__new__(api_server.SapdWikiRequestHandler)
            handler._send_json = lambda payload, status=200: captured.append(
                (status, payload)
            )
            try:
                with (
                    mock.patch.object(
                        api_server,
                        "_runtime_projection_identity",
                        return_value=identity,
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
                    handler._handle_api(
                        "/api/v1/projections/capability-view",
                        {
                            "object_type": ["capability_focus"],
                            "object_id": [focus["id"]],
                            "code": [focus["code"]],
                        },
                    )
                self.assertEqual(captured[0][0], 200)
                self.assertEqual(
                    captured[0][1]["semantic_digest"],
                    candidate_view["semantic_digest"],
                )
                legacy_reader.assert_not_called()
                full_hash.assert_not_called()
            finally:
                api_server.CONTENT_QUERY_DB_PATH = original_path
                api_server._BATCH1_PROJECTION_CACHE = original_cache

            rehearsal = output / "rollback-rehearsal.sqlite3"
            shutil.copy2(candidate, rehearsal)
            shutil.copy2(rollback, rehearsal)
            self.assertEqual(sha256_file(rehearsal), FORMAL_SHA256)

        self.assertEqual(sha256_file(BASE_DATABASE), formal_sha_before)
        self.assertEqual(sha256_file(SOURCE_WORKBOOK), source_sha_before)


if __name__ == "__main__":
    unittest.main()
