from __future__ import annotations

from copy import deepcopy
from pathlib import Path
import sys
import unittest

SRC_ROOT = Path(__file__).resolve().parents[2] / "src"
sys.path.insert(0, str(SRC_ROOT))

from sapd_wiki.local_mcp.control_models import (
    ControlError,
    GatewayActionError,
    ResponsePolicyViolation,
    assert_safe_response,
)
from sapd_wiki.local_mcp.control_service import ControlService, SupervisorGateway


NATIVE_CAPABILITY = "N" * 48


def sample_certificate() -> dict:
    return {
        "schema_version": 1,
        "state": "not_configured",
        "reason_code": None,
        "managed_by_app": True,
        "profile": "dev",
        "install_id_suffix": None,
        "generation_id": None,
        "subject": "127.0.0.1",
        "san": ["127.0.0.1"],
        "ca_display_name": None,
        "ca_fingerprint_sha256": None,
        "server_fingerprint_sha256": None,
        "valid_from": None,
        "valid_until": None,
        "remaining_days": None,
        "trust_scope": "current_user",
        "trust_backend": "fake_current_user_trust",
        "secret_backend": "in_memory_test_only",
        "trust_policy": "ssl_loopback_only",
        "trust_verified_at": None,
        "last_rotated_at": None,
        "operation": None,
        "cleanup_pending": False,
        "client_restart_required": False,
        "old_generation_retained_until": None,
        "next_action": "certificate_provision",
    }


def sample_snapshot() -> dict:
    return {
        "state_version": 0,
        "status": {
            "desired_state": "disabled",
            "service_state": "stopped",
            "authorization_state": "no_clients",
            "activity_state": "never",
            "knowledge_state": "ready",
            "audit_state": "ready",
            "last_success_at": None,
            "recoverable_error": None,
        },
        "settings": {
            "enabled": False,
            "configured_port": 18775,
            "release_channel": "stable",
            "canonical_resource": "https://127.0.0.1:18775/mcp",
            "control_capabilities": {
                "service_control": True,
                "client_revocation": True,
                "audit_clear": True,
                "native_reset_confirmation": True,
            },
        },
        "certificate": sample_certificate(),
        "clients": [
            {
                "client_id": "client-0001",
                "display_name": "Synthetic Codex",
                "trust_state": "verified",
                "scopes": ["sapd.base.public.summary.read"],
                "authorized_at": "2026-07-23T01:00:00Z",
                "last_used_at": None,
                "policy_version": "policy-v1",
                "status": "authorized",
            }
        ],
        "audit": {
            "enabled": True,
            "state": "ready",
            "retention_days": 30,
            "retention_bytes": 20 * 1024 * 1024,
            "event_count": 4,
            "last_event_at": "2026-07-23T01:02:00Z",
            "recent_events": [
                {
                    "occurred_at": "2026-07-23T01:02:00Z",
                    "event_type": "TOOL_CALL",
                    "client_id": "client-0001",
                    "tool_name": "search_knowledge",
                    "result_code": "OK",
                    "returned_count": 3,
                    "duration_ms": 18,
                }
            ],
        },
        "diagnostics": {
            "overall_state": "ready",
            "last_checked_at": "2026-07-23T01:03:00Z",
            "checks": [
                {
                    "check_id": "runtime",
                    "status": "pass",
                    "error_code": None,
                    "recovery_action": None,
                }
            ],
        },
    }


class FakeSupervisorGateway:
    def __init__(self) -> None:
        self.snapshot = sample_snapshot()
        self.calls: list[tuple[str, str]] = []
        self.native_capabilities = {NATIVE_CAPABILITY}
        self.prepared_resets = {"reset-0001"}

    def read_snapshot(self) -> dict:
        return deepcopy(self.snapshot)

    def _mutate(self, action: str, request_id: str, expected_state_version: int) -> dict:
        if expected_state_version != self.snapshot["state_version"]:
            raise GatewayActionError(
                "STATE_VERSION_CONFLICT",
                current_state_version=self.snapshot["state_version"],
            )
        self.calls.append((action, request_id))
        self.snapshot["state_version"] += 1
        return {
            "state_version": self.snapshot["state_version"],
            "result": "completed",
            "changed": True,
        }

    def start_service(self, *, request_id: str, expected_state_version: int) -> dict:
        result = self._mutate("start", request_id, expected_state_version)
        self.snapshot["status"]["desired_state"] = "enabled"
        self.snapshot["status"]["service_state"] = "ready"
        self.snapshot["settings"]["enabled"] = True
        return result

    def stop_service(self, *, request_id: str, expected_state_version: int) -> dict:
        result = self._mutate("stop", request_id, expected_state_version)
        self.snapshot["status"]["service_state"] = "stopped"
        return result

    def retry_service(self, *, request_id: str, expected_state_version: int) -> dict:
        return self._mutate("retry", request_id, expected_state_version)

    def update_port(
        self,
        *,
        configured_port: int,
        request_id: str,
        expected_state_version: int,
    ) -> dict:
        result = self._mutate("update_port", request_id, expected_state_version)
        self.snapshot["settings"]["configured_port"] = configured_port
        self.snapshot["settings"]["canonical_resource"] = f"https://127.0.0.1:{configured_port}/mcp"
        return result

    def decide_authorization(
        self,
        *,
        authorization_request_id: str,
        allow: bool,
        request_id: str,
        expected_state_version: int,
    ) -> dict:
        del authorization_request_id, allow
        return self._mutate("decide_authorization", request_id, expected_state_version)

    def check_service(self, *, request_id: str, expected_state_version: int) -> dict:
        return self._mutate("check_service", request_id, expected_state_version)

    def revoke_client(
        self,
        *,
        client_id: str,
        request_id: str,
        expected_state_version: int,
    ) -> dict:
        result = self._mutate("revoke_client", request_id, expected_state_version)
        self.snapshot["clients"] = [
            item for item in self.snapshot["clients"] if item["client_id"] != client_id
        ]
        self.snapshot["status"]["authorization_state"] = "revoked"
        return result

    def clear_audit(self, *, request_id: str, expected_state_version: int) -> dict:
        result = self._mutate("clear_audit", request_id, expected_state_version)
        self.snapshot["audit"]["event_count"] = 0
        self.snapshot["audit"]["last_event_at"] = None
        self.snapshot["audit"]["recent_events"] = []
        return result

    def prepare_certificate_action(
        self,
        *,
        action: str,
        request_id: str,
        expected_state_version: int,
    ) -> dict:
        result = self._mutate(
            "prepare_certificate_action",
            request_id,
            expected_state_version,
        )
        result.update(
            {
                "confirmation_id": "certificate-confirmation-0001",
                "expires_at": "2026-07-23T01:05:00Z",
                "effects": [
                    "create_managed_identity",
                    "install_current_user_trust",
                ],
                "action": action,
                "profile": "dev",
                "expected_ca_fingerprint_sha256": None,
                "confirmation_mode": "web",
            }
        )
        return result

    def confirm_certificate_action(
        self,
        *,
        confirmation_id: str,
        request_id: str,
        expected_state_version: int,
    ) -> dict:
        del confirmation_id
        result = self._mutate(
            "confirm_certificate_action",
            request_id,
            expected_state_version,
        )
        result["operation_id"] = "certificate-operation-0001"
        return result

    def prepare_reset(
        self,
        *,
        audit_disposition: str,
        request_id: str,
        expected_state_version: int,
    ) -> dict:
        result = self._mutate("prepare_reset", request_id, expected_state_version)
        result.update(
            {
                "reset_id": "reset-0001",
                "expires_at": "2026-07-23T01:05:00Z",
                "effects": [
                    "stop_service",
                    "revoke_all_clients",
                    "delete_managed_trust",
                    "delete_managed_secrets",
                    "clear_audit" if audit_disposition == "clear" else "retain_audit",
                ],
            }
        )
        return result

    def confirm_reset(
        self,
        *,
        reset_id: str,
        native_confirmation_capability: str,
        request_id: str,
        expected_state_version: int,
    ) -> dict:
        if (
            reset_id not in self.prepared_resets
            or native_confirmation_capability not in self.native_capabilities
        ):
            raise GatewayActionError("NATIVE_CONFIRMATION_INVALID")
        result = self._mutate("confirm_reset", request_id, expected_state_version)
        self.native_capabilities.remove(native_confirmation_capability)
        self.prepared_resets.remove(reset_id)
        return result

    def confirm_web_reset(
        self,
        *,
        reset_id: str,
        request_id: str,
        expected_state_version: int,
    ) -> dict:
        del reset_id
        return self._mutate(
            "confirm_web_reset",
            request_id,
            expected_state_version,
        )


class ControlServiceTests(unittest.TestCase):
    def setUp(self) -> None:
        self.gateway = FakeSupervisorGateway()
        self.service = ControlService(self.gateway)

    def test_gateway_satisfies_protocol(self) -> None:
        self.assertIsInstance(self.gateway, SupervisorGateway)

    def test_control_panel_is_closed_projection_with_derived_display_state(self) -> None:
        panel = self.service.get_control_panel()
        self.assertEqual(panel["contract_version"], "sapd-mcp-control-v1")
        self.assertEqual(panel["state_version"], 0)
        self.assertEqual(panel["status"]["display_state"], "disabled")
        self.assertEqual(
            set(panel),
            {
                "contract_version",
                "state_version",
                "status",
                "settings",
                "certificate",
                "authorization_requests",
                "clients",
                "audit",
                "diagnostics",
            },
        )

    def test_individual_read_interfaces_share_the_versioned_projection(self) -> None:
        self.assertEqual(self.service.get_status()["data"]["service_state"], "stopped")
        self.assertEqual(self.service.get_settings()["data"]["configured_port"], 18775)
        self.assertEqual(
            self.service.get_certificate()["data"]["state"], "not_configured"
        )
        self.assertEqual(self.service.get_clients()["data"][0]["client_id"], "client-0001")
        self.assertEqual(self.service.get_audit()["data"]["event_count"], 4)
        self.assertEqual(
            self.service.get_audit()["data"]["recent_events"][0]["tool_name"],
            "search_knowledge",
        )
        self.assertEqual(
            self.service.get_diagnostics()["data"]["checks"][0]["check_id"],
            "runtime",
        )

    def test_certificate_operation_projects_transaction_phase(self) -> None:
        self.gateway.snapshot["certificate"].update(
            {
                "state": "valid",
                "operation": {
                    "operation_id": "operation-certificate-0001",
                    "state": "running",
                    "phase": "retiring",
                },
                "cleanup_pending": True,
                "client_restart_required": True,
                "old_generation_retained_until": "2026-07-24T10:00:00Z",
                "next_action": None,
            }
        )
        certificate = self.service.get_certificate()["data"]
        self.assertEqual(certificate["operation"]["phase"], "retiring")
        self.assertTrue(certificate["cleanup_pending"])
        self.assertTrue(certificate["client_restart_required"])

    def test_certificate_prepare_and_confirm_use_shared_idempotency_and_version(self) -> None:
        prepared = self.service.prepare_certificate_action(
            action="certificate_provision",
            request_id="request-certificate-prepare-0001",
            expected_state_version=0,
        )
        self.assertTrue(
            prepared["certificate_confirmation"]["web_confirmation_required"]
        )
        confirmed = self.service.confirm_certificate_action(
            confirmation_id=prepared["certificate_confirmation"]["confirmation_id"],
            request_id="request-certificate-confirm-0001",
            expected_state_version=1,
        )
        self.assertEqual(confirmed["operation_id"], "certificate-operation-0001")

    def test_sensitive_gateway_field_is_rejected_recursively(self) -> None:
        self.gateway.snapshot["diagnostics"]["checks"][0]["access_token"] = "not-returned"
        with self.assertRaises(ResponsePolicyViolation):
            self.service.get_control_panel()

    def test_all_forbidden_response_field_families_are_rejected(self) -> None:
        for key in (
            "token",
            "private_key",
            "passphrase",
            "redirect_query",
            "absolute_path",
            "PID",
            "raw logs",
            "query",
            "knowledge",
            "user content",
        ):
            with self.subTest(key=key), self.assertRaises(ResponsePolicyViolation):
                assert_safe_response({"safe": {key: "not-returned"}})
        with self.assertRaises(ResponsePolicyViolation):
            assert_safe_response({"safe": "/Users/synthetic/private.txt"})

    def test_unknown_gateway_field_fails_closed(self) -> None:
        self.gateway.snapshot["settings"]["extra"] = "not-in-contract"
        with self.assertRaises(ControlError) as raised:
            self.service.get_settings()
        self.assertEqual(raised.exception.code, "SNAPSHOT_INVALID")
        self.assertEqual(raised.exception.status, 502)

    def test_mutation_is_idempotent_for_same_request_and_fingerprint(self) -> None:
        first = self.service.start(
            request_id="request-start-0001",
            expected_state_version=0,
        )
        second = self.service.start(
            request_id="request-start-0001",
            expected_state_version=0,
        )
        self.assertEqual(first, second)
        self.assertEqual(self.gateway.calls, [("start", "request-start-0001")])
        self.assertEqual(first["state_version"], 1)

    def test_request_id_cannot_be_reused_for_another_mutation(self) -> None:
        self.service.start(request_id="request-reuse-0001", expected_state_version=0)
        with self.assertRaises(ControlError) as raised:
            self.service.stop(request_id="request-reuse-0001", expected_state_version=1)
        self.assertEqual(raised.exception.code, "REQUEST_ID_REUSED")

    def test_stale_expected_version_is_rejected_before_gateway_mutation(self) -> None:
        with self.assertRaises(ControlError) as raised:
            self.service.retry(request_id="request-stale-0001", expected_state_version=8)
        self.assertEqual(raised.exception.code, "STATE_VERSION_CONFLICT")
        self.assertEqual(raised.exception.current_state_version, 0)
        self.assertEqual(self.gateway.calls, [])

    def test_actions_are_separate_gateway_commands(self) -> None:
        self.service.start(request_id="request-start-0002", expected_state_version=0)
        self.service.stop(request_id="request-stop-0001", expected_state_version=1)
        self.service.retry(request_id="request-retry-0001", expected_state_version=2)
        self.service.revoke_client(
            client_id="client-0001",
            request_id="request-revoke-001",
            expected_state_version=3,
        )
        self.service.clear_audit(
            request_id="request-audit-0001",
            expected_state_version=4,
        )
        self.assertEqual(
            [name for name, _ in self.gateway.calls],
            ["start", "stop", "retry", "revoke_client", "clear_audit"],
        )

    def test_reset_requires_and_consumes_one_time_native_capability(self) -> None:
        prepared = self.service.prepare_reset(
            request_id="request-prepare-01",
            expected_state_version=0,
            audit_disposition="clear",
        )
        self.assertTrue(prepared["reset"]["native_confirmation_required"])
        self.assertNotIn("native_confirmation_capability", prepared["reset"])

        confirmed = self.service.confirm_reset(
            reset_id=prepared["reset"]["reset_id"],
            native_confirmation_capability=NATIVE_CAPABILITY,
            request_id="request-confirm-01",
            expected_state_version=1,
        )
        replay = self.service.confirm_reset(
            reset_id=prepared["reset"]["reset_id"],
            native_confirmation_capability=NATIVE_CAPABILITY,
            request_id="request-confirm-01",
            expected_state_version=1,
        )
        self.assertEqual(confirmed, replay)

        with self.assertRaises(ControlError) as raised:
            self.service.confirm_reset(
                reset_id=prepared["reset"]["reset_id"],
                native_confirmation_capability=NATIVE_CAPABILITY,
                request_id="request-confirm-02",
                expected_state_version=2,
            )
        self.assertEqual(raised.exception.code, "NATIVE_CONFIRMATION_INVALID")


if __name__ == "__main__":
    unittest.main()
