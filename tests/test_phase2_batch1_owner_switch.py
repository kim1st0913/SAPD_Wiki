from __future__ import annotations

import subprocess
import unittest
from pathlib import Path

from sapd_wiki.capability_maintenance_projection import (
    CapabilityMaintenanceProjectionService,
)
from sapd_wiki.projection_contract import (
    ProjectionIdentity,
    UI_PROJECTION_SUITE_VERSION,
)


ROOT = Path(__file__).resolve().parents[1]
BASE_DATABASE = ROOT / "data" / "database" / "sapd_wiki.sqlite3"
FOCUS_ID = "72cd12e2-f784-4775-8b3f-6d3ed4e7d398"
FOCUS_CODE = "T-AS.AD-01"
FORMAL_SHA256 = "188f20efed31631f1f53219d4d8ef6f5e8c4fa5f2f07309b6bbe185994cf3680"
CONTENT_ASSET_SHA256 = "adaa19bf1fb641eb6e54da74b33b3f0510126ed9208d0d97ed565398db05bce6"


class Phase2Batch1OwnerSwitchTests(unittest.TestCase):
    def setUp(self) -> None:
        identity = ProjectionIdentity(
            knowledge_version=f"base-{FORMAL_SHA256[:16]}",
            database_schema_version="content-query-schema-v1",
            artifact_db_sha256=FORMAL_SHA256,
            parent_source_db_sha256="30d14679c7d8b7743fba129af38afde7b943bcdd707ff7b8a57bce5146f54c9e",
            projection_contract_version=UI_PROJECTION_SUITE_VERSION,
            content_asset_sha256=CONTENT_ASSET_SHA256,
        )
        self.service = CapabilityMaintenanceProjectionService(
            base_database=BASE_DATABASE,
            identity=identity,
        )

    def test_formal_projection_has_explicit_focus_and_53_measure_relations(self) -> None:
        catalog = self.service.capability_catalog()["data"]
        self.assertIsNone(catalog["selected"])
        view = self.service.capability_view(
            object_type="capability_focus",
            object_id=FOCUS_ID,
            code=FOCUS_CODE,
        )["data"]
        self.assertEqual(view["selected"]["id"], FOCUS_ID)
        self.assertEqual(view["selected"]["code"], FOCUS_CODE)
        service_ids = {
            service["id"]
            for row in view["technicalMappingRows"]
            for service in row["services"]
        }
        self.assertEqual(len(service_ids), 6)

        lookup_rows = self.service.shared_lookups()["data"]["service_module_index"]
        self.assertEqual(sum(len(row["measures"]) for row in lookup_rows), 53)
        for service_code in ("I-AP&T-AS.IA-02", "I-US&T-AS.IA-02"):
            row = next(item for item in lookup_rows if item["service"]["code"] == service_code)
            self.assertIn("应用系统自身认证模块", {item["title"] for item in row["measures"]})

    def test_node_owner_switch_contract_and_fail_closed_negatives(self) -> None:
        completed = subprocess.run(
            ["node", "scripts/audit_phase2_batch1_owner_switch_contract.mjs"],
            cwd=ROOT,
            check=False,
            capture_output=True,
            text=True,
            timeout=30,
        )
        self.assertEqual(completed.returncode, 0, completed.stdout + completed.stderr)
        self.assertIn('"status": "pass"', completed.stdout)
        self.assertIn('"fixture_public_data_requests": []', completed.stdout)


if __name__ == "__main__":
    unittest.main()
