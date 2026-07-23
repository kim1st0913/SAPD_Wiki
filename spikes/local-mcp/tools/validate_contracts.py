from __future__ import annotations

import importlib.metadata
import json
import re
import sys
from collections import Counter
from pathlib import Path
from typing import Any

from jsonschema import Draft202012Validator, FormatChecker
from jsonschema.exceptions import ValidationError

from canonical_json import (
    CanonicalJsonError,
    assert_t0_json_value,
    compute_fixture_hash,
    compute_fixture_set_hash,
    digest_file,
)


ROOT = Path(__file__).resolve().parents[3]
CONTRACT_ROOT = ROOT / "docs/01-architecture/contracts/mcp/v1"
FIXTURE_ROOT = ROOT / "tests/fixtures/mcp/v1"
FIXTURE_SCOPE_ROOT = ROOT / "tests/fixtures/mcp"
LOCK_PATH = ROOT / "spikes/local-mcp/requirements-m0t.lock"
REPORT_PATH = ROOT / "spikes/local-mcp/evidence/t0-contract-report.json"

REQUIRED_CONTRACTS = {
    "MCP-AUTH-v1",
    "MCP-DATA-POLICY-v1",
    "MCP-RUNTIME-STATE-v1",
    "MCP-PROTOCOL-TOOLS-v1",
}

REQUIRED_COVERAGE = {
    "public-summary",
    "metadata-only",
    "deny",
    "internal",
    "confidential",
    "unknown",
    "relation-allowed",
    "relation-single-hidden",
    "relation-both-hidden",
    "unknown-relation-type",
    "redirect-valid",
    "redirect-target-denied",
    "redirect-cycle",
    "redirect-cross-version",
    "duplicate-name",
    "unknown-object-type",
    "empty-query",
    "request-over-limit",
    "object-too-large",
    "stale-cursor",
    "prompt-injection",
    "control-character",
    "path-uri-sql-injection",
    "policy-signature-failure",
    "manifest-digest-failure",
    "user-store-trap",
    "d0-empty-candidates",
    "d0-empty-types",
    "d0-stale-digest",
    "key-passphrase-ipc-unauthenticated",
    "key-passphrase-ipc-peer-user-mismatch",
    "key-passphrase-ipc-cross-user-readable",
}

UNSAFE_IPC_IDS = {
    "m0t.v1.runtime-secret-transport.key-passphrase-ipc-unauthenticated",
    "m0t.v1.runtime-secret-transport.key-passphrase-ipc-peer-user-mismatch",
    "m0t.v1.runtime-secret-transport.key-passphrase-ipc-cross-user-readable",
}

FORBIDDEN_TEXT_PATTERNS = {
    "absolute_posix_path": re.compile(r"(?<![A-Za-z0-9])/(?:Users|home|private|var|etc|tmp)/"),
    "absolute_windows_path": re.compile(r"(?<![A-Za-z0-9])[A-Za-z]:[\\/]"),
    "openai_style_credential": re.compile(r"\bsk-[A-Za-z0-9_-]{16,}\b"),
    "private_key_material": re.compile(r"-----BEGIN [A-Z ]*PRIVATE KEY-----"),
    "bearer_credential": re.compile(r"\bBearer [A-Za-z0-9._~-]{12,}\b"),
}


class ValidationFailure(RuntimeError):
    pass


def load_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def validate_schema(schema: dict[str, Any], label: str) -> None:
    try:
        Draft202012Validator.check_schema(schema)
    except Exception as exc:
        raise ValidationFailure(f"{label}: invalid Draft 2020-12 schema: {exc}") from exc
    if schema.get("$schema") != "https://json-schema.org/draft/2020-12/schema":
        raise ValidationFailure(f"{label}: unexpected $schema")


def validate_instance(
    instance: Any,
    schema: dict[str, Any],
    label: str,
    *,
    format_checker: bool = False,
) -> None:
    validator = Draft202012Validator(
        schema,
        format_checker=FormatChecker() if format_checker else None,
    )
    errors = sorted(validator.iter_errors(instance), key=lambda item: list(item.path))
    if errors:
        detail = "; ".join(
            f"{'/'.join(map(str, error.path)) or '$'}: {error.message}"
            for error in errors[:8]
        )
        raise ValidationFailure(f"{label}: {detail}")


def validate_contract_set() -> tuple[dict[str, str], int]:
    contract_set = load_json(CONTRACT_ROOT / "contract-set.json")
    if contract_set.get("schema_draft") != "https://json-schema.org/draft/2020-12/schema":
        raise ValidationFailure("contract-set: wrong schema draft")
    entries = contract_set.get("profiles", [])
    ids = [entry.get("contract_id") for entry in entries]
    if set(ids) != REQUIRED_CONTRACTS or len(ids) != len(REQUIRED_CONTRACTS):
        raise ValidationFailure("contract-set: four unique required contracts are mandatory")

    digests: dict[str, str] = {}
    schema_count = 0
    for entry in entries:
        contract_id = entry["contract_id"]
        profile_path = CONTRACT_ROOT / entry["profile"]
        schema_path = CONTRACT_ROOT / entry["schema"]
        profile = load_json(profile_path)
        schema = load_json(schema_path)
        validate_schema(schema, str(schema_path.relative_to(ROOT)))
        schema_count += 1
        validate_instance(profile, schema, contract_id)
        if profile["contract_id"] != contract_id:
            raise ValidationFailure(f"{contract_id}: profile id mismatch")
        actual_digest = digest_file(profile_path)
        if actual_digest != entry["digest"]:
            raise ValidationFailure(
                f"{contract_id}: digest mismatch {actual_digest} != {entry['digest']}"
            )
        references = set(profile["references"].values())
        if references != REQUIRED_CONTRACTS - {contract_id}:
            raise ValidationFailure(f"{contract_id}: cross-contract references incomplete")
        digests[contract_id] = actual_digest

    for relative_path in contract_set.get("shared_schemas", {}).values():
        schema_path = CONTRACT_ROOT / relative_path
        validate_schema(load_json(schema_path), str(schema_path.relative_to(ROOT)))
        schema_count += 1

    dependency_lock = (CONTRACT_ROOT / contract_set["dependency_lock"]).resolve()
    if dependency_lock != LOCK_PATH.resolve():
        raise ValidationFailure("contract-set: dependency lock escapes approved location")
    return digests, schema_count


def load_fixtures() -> list[dict[str, Any]]:
    fixtures: list[dict[str, Any]] = []
    for path in sorted(FIXTURE_SCOPE_ROOT.rglob("cases/*.json")):
        payload = load_json(path)
        records = payload if isinstance(payload, list) else [payload]
        if not all(isinstance(record, dict) for record in records):
            raise ValidationFailure(f"{path.relative_to(ROOT)}: fixture record must be object")
        fixtures.extend(records)
    if not fixtures:
        raise ValidationFailure("fixture catalog is empty")
    return fixtures


def scan_synthetic_provenance(fixtures: list[dict[str, Any]]) -> None:
    text = json.dumps(fixtures, ensure_ascii=False, sort_keys=True)
    for label, pattern in FORBIDDEN_TEXT_PATTERNS.items():
        if pattern.search(text):
            raise ValidationFailure(f"fixture provenance scan failed: {label}")
    for fixture in fixtures:
        if fixture.get("contains_real_data") is not False:
            raise ValidationFailure(f"{fixture.get('fixture_id')}: contains_real_data must be false")
        if not str(fixture.get("canonical_ref", "")).startswith("fixture://"):
            raise ValidationFailure(f"{fixture.get('fixture_id')}: canonical_ref is not fixture://")
        provenance = fixture.get("provenance", {})
        if provenance.get("kind") != "hand_authored_synthetic":
            raise ValidationFailure(f"{fixture.get('fixture_id')}: provenance is not synthetic")
        if not str(provenance.get("source_ref", "")).startswith("fixture://"):
            raise ValidationFailure(f"{fixture.get('fixture_id')}: source_ref is not fixture://")


def validate_fixture_set(
    fixtures: list[dict[str, Any]],
    contract_digests: dict[str, str],
) -> dict[str, Any]:
    fixture_schema = load_json(CONTRACT_ROOT / "schemas/fixture.schema.json")
    validate_schema(fixture_schema, "fixture.schema.json")
    ids: set[str] = set()
    content_hashes: dict[str, str] = {}
    coverage: set[str] = set()
    for fixture in fixtures:
        fixture_id = fixture.get("fixture_id", "<missing>")
        try:
            assert_t0_json_value(fixture)
        except CanonicalJsonError as exc:
            raise ValidationFailure(f"{fixture_id}: {exc}") from exc
        validate_instance(fixture, fixture_schema, fixture_id)
        if fixture_id in ids:
            raise ValidationFailure(f"duplicate fixture_id: {fixture_id}")
        ids.add(fixture_id)
        expected_hash = compute_fixture_hash(fixture)
        if fixture["fixture_hash"] != expected_hash:
            raise ValidationFailure(f"{fixture_id}: fixture_hash mismatch")
        if fixture["fixture_hash"] in content_hashes:
            raise ValidationFailure(
                f"{fixture_id}: hash reused by {content_hashes[fixture['fixture_hash']]}"
            )
        content_hashes[fixture["fixture_hash"]] = fixture_id
        coverage.update(fixture["coverage"])

    missing = REQUIRED_COVERAGE - coverage
    if missing:
        raise ValidationFailure(f"fixture coverage missing: {sorted(missing)}")
    scan_synthetic_provenance(fixtures)

    manifest = load_json(FIXTURE_ROOT / "manifest.json")
    manifest_entries = manifest.get("fixtures", [])
    if manifest_entries != sorted(manifest_entries, key=lambda item: item["fixture_id"]):
        raise ValidationFailure("manifest fixtures are not sorted by fixture_id")
    current_entries = [
        {
            "fixture_id": fixture["fixture_id"],
            "fixture_revision": fixture["fixture_revision"],
            "fixture_hash": fixture["fixture_hash"],
        }
        for fixture in sorted(fixtures, key=lambda item: item["fixture_id"])
    ]
    if manifest_entries != current_entries:
        raise ValidationFailure("manifest fixture entries do not match catalog revisions/hashes")
    if manifest.get("contract_digests") != dict(sorted(contract_digests.items())):
        raise ValidationFailure("manifest contract digests do not match contract-set")
    expected_set_hash = compute_fixture_set_hash(contract_digests, fixtures)
    if manifest.get("fixture_set_hash") != expected_set_hash:
        raise ValidationFailure("manifest fixture_set_hash mismatch")
    return {
        "fixture_count": len(fixtures),
        "coverage": sorted(coverage),
        "fixture_set_hash": expected_set_hash,
    }


def minimal_summary_candidate() -> dict[str, Any]:
    digest = "sha256:" + ("6" * 64)
    return {
        "canonical_ref": "fixture://summary/candidate-a",
        "object_type": "fixture_type",
        "locale": "zh-CN",
        "ai_summary": "Synthetic public summary candidate.",
        "summary_version": 1,
        "summary_hash": digest,
        "review_status": "approved",
        "reviewed_by_role": "fixture_reviewer",
        "reviewed_by_principal": "fixture_principal",
        "reviewed_at": "2026-07-23T00:00:00Z",
        "source_and_license_basis": "Synthetic fixture basis.",
        "source_basis_digest": digest,
        "base_manifest_digest": digest,
        "effective_sensitive_level": "public",
        "ai_use_policy": "public_summary",
        "policy_version": "MCP-DATA-POLICY-v1",
        "release_status": "candidate",
    }


def validate_d0_gate(fixtures: list[dict[str, Any]]) -> None:
    schema = load_json(CONTRACT_ROOT / "schemas/public-summary.schema.json")
    validator = Draft202012Validator(schema, format_checker=FormatChecker())
    digest = "sha256:" + ("7" * 64)
    candidate = minimal_summary_candidate()
    valid_not_ready = {
        "summary_schema_version": "1.0.0",
        "d0_status": "NOT_READY",
        "policy_candidate_digest": digest,
        "proposed_public_summary_types": [],
        "pilot_candidates": [candidate],
    }
    validator.validate(valid_not_ready)

    invalid_empty_candidates = {
        **valid_not_ready,
        "proposed_public_summary_types": ["fixture_type"],
        "d0_status": "PASS",
        "pilot_candidates": [],
    }
    try:
        validator.validate(invalid_empty_candidates)
    except ValidationError:
        pass
    else:
        raise ValidationFailure("D0-Pilot empty candidate set incorrectly passed")

    invalid_empty_types_pass = {**valid_not_ready, "d0_status": "PASS"}
    try:
        validator.validate(invalid_empty_types_pass)
    except ValidationError:
        pass
    else:
        raise ValidationFailure("D0-Pilot empty type set incorrectly passed")

    proposed_types = {"fixture_type", "fixture_other"}
    candidate_types = {candidate["object_type"]}
    if proposed_types <= candidate_types:
        raise ValidationFailure("D0-Pilot representative-type negative control is ineffective")

    by_id = {fixture["fixture_id"]: fixture for fixture in fixtures}
    required = {
        "m0t.v1.data-policy.d0-empty-candidates": ("not_ready", "D0_PILOT_CANDIDATES_EMPTY"),
        "m0t.v1.data-policy.d0-empty-types": ("not_ready", "D0_PILOT_TYPES_EMPTY"),
        "m0t.v1.data-policy.d0-stale-digest": ("stale", "D0_POLICY_DIGEST_STALE"),
    }
    for fixture_id, expected in required.items():
        fixture = by_id.get(fixture_id)
        if fixture is None:
            raise ValidationFailure(f"missing D0 fixture: {fixture_id}")
        if (fixture["expected_policy_decision"], fixture["expected_error"]) != expected:
            raise ValidationFailure(f"{fixture_id}: D0 expected state mismatch")


def validate_unsafe_ipc(fixtures: list[dict[str, Any]]) -> None:
    by_id = {fixture["fixture_id"]: fixture for fixture in fixtures}
    for fixture_id in UNSAFE_IPC_IDS:
        fixture = by_id.get(fixture_id)
        if fixture is None:
            raise ValidationFailure(f"missing unsafe IPC fixture: {fixture_id}")
        if fixture["expected_error"] != "KEY_PASSPHRASE_IPC_UNSAFE":
            raise ValidationFailure(f"{fixture_id}: wrong unsafe IPC error")
        if fixture["expected_runtime_state"] != {
            "service_state": "error",
            "knowledge_state": "blocked",
            "secret_transport_state": "blocked",
        }:
            raise ValidationFailure(f"{fixture_id}: unsafe IPC must be fully BLOCKED")


def parse_dependency_lock() -> dict[str, dict[str, str]]:
    pattern = re.compile(
        r"^([A-Za-z0-9_.-]+)==([^ ]+) --hash=sha256:([0-9a-f]{64})$"
    )
    dependencies: dict[str, dict[str, str]] = {}
    for line in LOCK_PATH.read_text(encoding="utf-8").splitlines():
        if not line or line.startswith("#"):
            continue
        match = pattern.fullmatch(line)
        if not match:
            raise ValidationFailure(f"dependency lock line is not exact+hashed: {line}")
        raw_name, version, wheel_hash = match.groups()
        name = raw_name.lower().replace("_", "-")
        if name in dependencies:
            raise ValidationFailure(f"duplicate dependency lock entry: {name}")
        dependencies[name] = {"version": version, "wheel_sha256": wheel_hash}
    required = {"jsonschema": "4.26.0", "rfc8785": "0.1.4", "mcp": "1.28.1"}
    for name, version in required.items():
        if dependencies.get(name, {}).get("version") != version:
            raise ValidationFailure(f"dependency lock missing {name}=={version}")
        installed = importlib.metadata.version(name)
        if installed != version:
            raise ValidationFailure(f"installed {name}=={installed}, expected {version}")
    return {name: dependencies[name] for name in sorted(required)}


def run_validation(*, write_report: bool = True) -> dict[str, Any]:
    contract_digests, schema_count = validate_contract_set()
    fixtures = load_fixtures()
    fixture_result = validate_fixture_set(fixtures, contract_digests)
    validate_d0_gate(fixtures)
    validate_unsafe_ipc(fixtures)
    dependencies = parse_dependency_lock()

    report = {
        "status": "PASS",
        "gate": "T0",
        "scope": "isolated_contracts_and_synthetic_fixtures_only",
        "contract_count": len(contract_digests),
        "schema_count": schema_count,
        "contract_digests": dict(sorted(contract_digests.items())),
        "fixture_count": fixture_result["fixture_count"],
        "fixture_set_hash": fixture_result["fixture_set_hash"],
        "case_coverage": fixture_result["coverage"],
        "dependencies": dependencies,
        "checks": [
            "draft_2020_12_schema_self_validation",
            "four_profile_schema_validation",
            "cross_contract_reference_validation",
            "profile_digest_binding",
            "fixture_id_revision_hash_validation",
            "rfc_8785_manifest_binding",
            "synthetic_provenance_scan",
            "d0_pilot_nonempty_gate",
            "unsafe_key_passphrase_ipc_blocked",
        ],
        "not_authorized": [
            "push",
            "T3",
            "D0-Pilot data generation",
            "M1",
            "real data",
            "user data",
            "App integration",
            "packaging",
        ],
    }
    if write_report:
        REPORT_PATH.parent.mkdir(parents=True, exist_ok=True)
        REPORT_PATH.write_text(
            json.dumps(report, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
            encoding="utf-8",
        )
    return report


def main() -> int:
    try:
        report = run_validation(write_report=True)
    except (ValidationFailure, CanonicalJsonError, ValidationError) as exc:
        print(json.dumps({"status": "BLOCKED", "gate": "T0", "error": str(exc)}))
        return 1
    print(json.dumps(report, ensure_ascii=False, sort_keys=True))
    return 0


if __name__ == "__main__":
    sys.exit(main())
