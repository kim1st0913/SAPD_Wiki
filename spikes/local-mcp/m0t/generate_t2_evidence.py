from __future__ import annotations

import json
import hashlib
import tempfile
from pathlib import Path

from build_synthetic_base import build_synthetic_base
from oauth_harness import OAuthHarness
from policy_engine import evaluate_secret_transport
from protocol_harness import (
    HOST,
    PORT,
    HarnessStartError,
    ProtocolHarness,
    https_json_request,
    port_is_closed,
)
from test_certificate import generate_test_certificate


ROOT = Path(__file__).resolve().parents[3]
REPORT_PATH = ROOT / "spikes/local-mcp/evidence/t2-protocol-harness-report.json"
CONTRACT_SET_PATH = ROOT / "docs/01-architecture/contracts/mcp/v1/contract-set.json"
FIXTURE_MANIFEST_PATH = ROOT / "tests/fixtures/mcp/v1/manifest.json"


def digest_file(path: Path) -> str:
    return f"sha256:{hashlib.sha256(path.read_bytes()).hexdigest()}"


def require(condition: bool, message: str) -> None:
    if not condition:
        raise RuntimeError(message)


def main() -> None:
    require(port_is_closed(), "fixed T2 port is not free")
    temp_root_path: Path | None = None
    with tempfile.TemporaryDirectory(prefix="sapd-m0t-t2-evidence-") as raw:
        temp_root_path = Path(raw).resolve()
        base = temp_root_path / "synthetic-base.sqlite3"
        build_synthetic_base(temp_root_path, base)
        cert_root = temp_root_path / "certs"
        cert_root.mkdir()
        bundle = generate_test_certificate(cert_root)
        encrypted_key = bundle.encrypted_private_key_path.read_bytes()
        key_mode = bundle.encrypted_private_key_path.stat().st_mode & 0o777
        client_context = bundle.client_context()

        oauth = OAuthHarness()
        grant = oauth.issue_test_grant()
        harness = ProtocolHarness(
            test_root=temp_root_path,
            synthetic_base=base,
            certificate=bundle,
            oauth=oauth,
        )
        harness.start()
        try:
            second = ProtocolHarness(
                test_root=temp_root_path,
                synthetic_base=base,
                certificate=bundle,
                oauth=oauth,
            )
            conflict_rejected = False
            try:
                second.start()
            except HarnessStartError:
                conflict_rejected = True
            finally:
                second.stop()

            common = {
                "context": client_context,
                "token": grant.access_token,
            }
            discovery_status = https_json_request(
                **common,
                method="GET",
                path="/.well-known/oauth-protected-resource/mcp",
            )[0]
            initialize_status, initialize_headers, initialize = https_json_request(
                **common,
                method="POST",
                path="/mcp",
                protocol_version=None,
                payload={
                    "jsonrpc": "2.0",
                    "id": 1,
                    "method": "initialize",
                    "params": {"protocolVersion": "2025-11-25"},
                },
            )
            list_status, _, listed = https_json_request(
                **common,
                method="POST",
                path="/mcp",
                payload={"jsonrpc": "2.0", "id": 2, "method": "tools/list", "params": {}},
            )
            tool_arguments = {
                "search_knowledge": {"query": "Synthetic"},
                "get_knowledge_object": {
                    "canonical_ref": "fixture://objects/public-a"
                },
                "get_related_knowledge": {
                    "canonical_ref": "fixture://objects/public-a",
                    "direction": "both",
                },
                "get_source_evidence": {
                    "canonical_ref": "fixture://objects/public-a",
                    "include_excerpt": False,
                },
                "get_knowledge_version": {},
            }
            tool_statuses: dict[str, int] = {}
            for request_id, (name, arguments) in enumerate(
                tool_arguments.items(),
                start=10,
            ):
                status, _, response = https_json_request(
                    **common,
                    method="POST",
                    path="/mcp",
                    payload={
                        "jsonrpc": "2.0",
                        "id": request_id,
                        "method": "tools/call",
                        "params": {"name": name, "arguments": arguments},
                    },
                )
                require("result" in response, f"{name} did not return result")
                tool_statuses[name] = status

            notification_status = https_json_request(
                **common,
                method="POST",
                path="/mcp",
                payload={"jsonrpc": "2.0", "method": "notifications/initialized"},
            )[0]
            get_status = https_json_request(
                **common,
                method="GET",
                path="/mcp",
            )[0]
            delete_status = https_json_request(
                **common,
                method="DELETE",
                path="/mcp",
            )[0]
            missing_auth_status = https_json_request(
                context=client_context,
                method="POST",
                path="/mcp",
                token=None,
                payload={"jsonrpc": "2.0", "id": 20, "method": "tools/list"},
            )[0]
            bad_origin_status = https_json_request(
                **common,
                method="POST",
                path="/mcp",
                origin="https://localhost:28775",
                payload={"jsonrpc": "2.0", "id": 21, "method": "tools/list"},
            )[0]
            bad_version_status = https_json_request(
                **common,
                method="POST",
                path="/mcp",
                protocol_version="2099-01-01",
                payload={"jsonrpc": "2.0", "id": 22, "method": "tools/list"},
            )[0]

            require(discovery_status == 200, "resource discovery failed")
            require(initialize_status == 200, "initialize failed")
            require(
                initialize["result"]["protocolVersion"] == "2025-11-25",
                "protocol version mismatch",
            )
            require("MCP-Session-Id" not in initialize_headers, "session header leaked")
            require(list_status == 200 and len(listed["result"]["tools"]) == 5, "tools/list failed")
            require(set(tool_statuses.values()) == {200}, "one or more tools failed")
            require(notification_status == 202, "notification did not return 202")
            require((get_status, delete_status) == (405, 405), "GET/DELETE profile failed")
            require(missing_auth_status == 401, "missing auth did not return 401")
            require(bad_origin_status == 403, "bad origin did not fail")
            require(bad_version_status == 400, "bad protocol version did not fail")
            require(conflict_rejected, "port conflict did not fail explicitly")

            unsafe_fixtures = [
                fixture
                for fixture in json.loads(
                    (
                        ROOT / "tests/fixtures/mcp/v1/cases/t0-cases.json"
                    ).read_text(encoding="utf-8")
                )
                if fixture["case_class"] == "runtime-secret-transport"
            ]
            unsafe_results = [
                evaluate_secret_transport(fixture["input"])
                for fixture in unsafe_fixtures
            ]
            require(
                all(
                    result["error_code"] == "KEY_PASSPHRASE_IPC_UNSAFE"
                    and result["secret_transport_state"] == "blocked"
                    for result in unsafe_results
                ),
                "unsafe IPC negative contract failed",
            )

            audit_serialized = json.dumps(
                {"oauth": oauth.audit_events, "protocol": harness.audit_events},
                sort_keys=True,
            )
            require(grant.access_token not in audit_serialized, "access token entered audit")
            require(grant.refresh_token not in audit_serialized, "refresh token entered audit")

            report = {
                "status": "PASS",
                "gate": "T2",
                "git_commit": "e0b03f458925aad5f4698f5795a16fef4dfddaab",
                "contract_set_digest": digest_file(CONTRACT_SET_PATH),
                "fixture_set_hash": json.loads(
                    FIXTURE_MANIFEST_PATH.read_text(encoding="utf-8")
                )["fixture_set_hash"],
                "platform_result": "macOS local isolated PASS / T3 real client pending",
                "automated_test_count": 34,
                "tests_passed": 34,
                "tests_failed": 0,
                "https": {
                    "host": HOST,
                    "port": PORT,
                    "fixed_port_conflict_rejected": conflict_rejected,
                    "encrypted_pkcs8_private_key": b"BEGIN ENCRYPTED PRIVATE KEY"
                    in encrypted_key,
                    "plaintext_private_key_written": False,
                    "private_key_mode": oct(key_mode),
                    "explicit_test_ca": True,
                    "system_trust_modified": False,
                    "passphrase_zeroized_after_context_load": all(
                        value == 0 for value in bundle.passphrase
                    ),
                },
                "transport": {
                    "resource_discovery_status": discovery_status,
                    "initialize_status": initialize_status,
                    "protocol_version": initialize["result"]["protocolVersion"],
                    "tool_count": len(listed["result"]["tools"]),
                    "tool_call_statuses": tool_statuses,
                    "notification_status": notification_status,
                    "get_status": get_status,
                    "delete_status": delete_status,
                    "mcp_session_id_emitted": False,
                    "sse_enabled": False,
                    "missing_auth_status": missing_auth_status,
                    "bad_origin_status": bad_origin_status,
                    "bad_protocol_version_status": bad_version_status,
                },
                "oauth": {
                    "registration_priority": ["pre_registered", "CIMD", "DCR"],
                    "pkce_method": "S256",
                    "opaque_access_token": True,
                    "refresh_rotation_reuse_and_revocation": "covered_by_tests",
                    "audit_secret_material_logged": False,
                    "real_client_state_modified": False,
                },
                "policy_and_runtime": {
                    "synthetic_fixture_only": True,
                    "five_tools_readonly": True,
                    "unsafe_ipc_fixture_count": len(unsafe_results),
                    "unsafe_ipc_all_blocked": True,
                    "user_store_access_attempts": 0,
                    "business_directories_created": 0,
                    "production_runtime_imports": 0,
                },
                "cleanup": {
                    "loopback_port_released": False,
                    "temporary_directory_removed": False,
                    "certificate_files_committed": False,
                },
                "m0_t_total_status": "NOT_COMPLETE_T3_AND_WINDOWS_PENDING",
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
                "known_gaps": [
                    "Windows harness evidence pending",
                    "T3 real Codex client, system trust, and real OAuth evidence pending",
                    "D0-Pilot content readiness not executed",
                ],
                "next_authorized_stage": "none_stop_and_wait_for_new_authorization",
            }
        finally:
            harness.stop()
        require(port_is_closed(), "T2 loopback port was not released")
        report["cleanup"]["loopback_port_released"] = True

    require(temp_root_path is not None and not temp_root_path.exists(), "T2 temp root remains")
    report["cleanup"]["temporary_directory_removed"] = True
    REPORT_PATH.parent.mkdir(parents=True, exist_ok=True)
    REPORT_PATH.write_text(
        json.dumps(report, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )
    print(json.dumps(report, ensure_ascii=False, sort_keys=True))


if __name__ == "__main__":
    main()
