from __future__ import annotations

import copy
import json
import sys
import unicodedata
import unittest
from pathlib import Path

from jsonschema import Draft202012Validator
from jsonschema.exceptions import ValidationError


ROOT = Path(__file__).resolve().parents[3]
TOOLS = ROOT / "spikes/local-mcp/tools"
sys.path.insert(0, str(TOOLS))

from canonical_json import CanonicalJsonError, compute_fixture_hash  # noqa: E402
from validate_contracts import (  # noqa: E402
    CONTRACT_ROOT,
    UNSAFE_IPC_IDS,
    load_fixtures,
    run_validation,
)


class T0ContractTests(unittest.TestCase):
    def test_full_t0_validation_passes(self) -> None:
        report = run_validation(write_report=False)
        self.assertEqual(report["status"], "PASS")
        self.assertEqual(report["contract_count"], 4)
        self.assertEqual(report["fixture_count"], 30)

    def test_fixture_hash_excludes_only_top_level_hash(self) -> None:
        fixture = load_fixtures()[0]
        original = compute_fixture_hash(fixture)
        changed_hash_field = copy.deepcopy(fixture)
        changed_hash_field["fixture_hash"] = "sha256:" + ("f" * 64)
        self.assertEqual(compute_fixture_hash(changed_hash_field), original)
        changed_content = copy.deepcopy(fixture)
        changed_content["input"]["synthetic_change"] = 1
        self.assertNotEqual(compute_fixture_hash(changed_content), original)
        changed_nested = copy.deepcopy(fixture)
        changed_nested["input"]["fixture_hash"] = "nested-is-not-excluded"
        self.assertNotEqual(compute_fixture_hash(changed_nested), original)

    def test_non_nfc_and_float_are_rejected(self) -> None:
        fixture = copy.deepcopy(load_fixtures()[0])
        fixture["input"]["non_nfc"] = unicodedata.normalize("NFD", "é")
        with self.assertRaises(CanonicalJsonError):
            compute_fixture_hash(fixture)
        fixture = copy.deepcopy(load_fixtures()[0])
        fixture["input"]["float"] = 1.25
        with self.assertRaises(CanonicalJsonError):
            compute_fixture_hash(fixture)

    def test_d0_pilot_empty_candidates_and_empty_types_cannot_pass(self) -> None:
        schema = json.loads(
            (CONTRACT_ROOT / "schemas/public-summary.schema.json").read_text(encoding="utf-8")
        )
        validator = Draft202012Validator(schema)
        digest = "sha256:" + ("8" * 64)
        with self.assertRaises(ValidationError):
            validator.validate(
                {
                    "summary_schema_version": "1.0.0",
                    "d0_status": "PASS",
                    "policy_candidate_digest": digest,
                    "proposed_public_summary_types": ["fixture_type"],
                    "pilot_candidates": [],
                }
            )
        with self.assertRaises(ValidationError):
            validator.validate(
                {
                    "summary_schema_version": "1.0.0",
                    "d0_status": "PASS",
                    "policy_candidate_digest": digest,
                    "proposed_public_summary_types": [],
                    "pilot_candidates": [{}],
                }
            )

    def test_unsafe_key_passphrase_ipc_is_blocked(self) -> None:
        by_id = {fixture["fixture_id"]: fixture for fixture in load_fixtures()}
        self.assertEqual(set(by_id) & UNSAFE_IPC_IDS, UNSAFE_IPC_IDS)
        for fixture_id in UNSAFE_IPC_IDS:
            fixture = by_id[fixture_id]
            self.assertEqual(fixture["expected_error"], "KEY_PASSPHRASE_IPC_UNSAFE")
            self.assertEqual(fixture["expected_policy_decision"], "blocked")
            self.assertEqual(
                fixture["expected_runtime_state"],
                {
                    "service_state": "error",
                    "knowledge_state": "blocked",
                    "secret_transport_state": "blocked",
                },
            )

    def test_user_store_trap_requires_zero_access(self) -> None:
        fixture = next(
            item
            for item in load_fixtures()
            if item["fixture_id"] == "m0t.v1.user-store-trap.zero-access"
        )
        self.assertTrue(fixture["input"]["sentinel_uri"].startswith("fixture://"))
        self.assertEqual(fixture["expected_side_effects"]["user_store_access_attempts"], 0)


if __name__ == "__main__":
    unittest.main()
