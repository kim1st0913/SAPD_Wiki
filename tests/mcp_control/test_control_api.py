from __future__ import annotations

from copy import deepcopy
import json
from pathlib import Path
import secrets
import sys
import unittest

SRC_ROOT = Path(__file__).resolve().parents[2] / "src"
sys.path.insert(0, str(SRC_ROOT))

from sapd_wiki.local_mcp.control_api import ControlApi
from sapd_wiki.local_mcp.control_models import (
    NATIVE_CONFIRMATION_HEADER,
    SESSION_HEADER,
    GatewayActionError,
)
from sapd_wiki.local_mcp.control_service import ControlService


HOST = "127.0.0.1:5173"
ORIGIN = "http://127.0.0.1:5173"
SESSION = "synthetic-session-value"
NATIVE_CAPABILITY = "C" * 48


def api_certificate() -> dict:
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


def api_snapshot() -> dict:
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
        "certificate": api_certificate(),
        "clients": [],
        "audit": {
            "enabled": True,
            "state": "ready",
            "retention_days": 30,
            "retention_bytes": 20 * 1024 * 1024,
            "event_count": 0,
            "last_event_at": None,
            "recent_events": [],
        },
        "diagnostics": {
            "overall_state": "ready",
            "last_checked_at": None,
            "checks": [],
        },
    }


class FakeApiGateway:
    def __init__(self) -> None:
        self.snapshot = api_snapshot()
        self.calls: list[str] = []
        self.reset_ids = {"reset-api-0001"}
        self.native_capabilities = {NATIVE_CAPABILITY}

    def read_snapshot(self) -> dict:
        return deepcopy(self.snapshot)

    def _action(self, name: str, expected_state_version: int) -> dict:
        if expected_state_version != self.snapshot["state_version"]:
            raise GatewayActionError(
                "STATE_VERSION_CONFLICT",
                current_state_version=self.snapshot["state_version"],
            )
        self.calls.append(name)
        self.snapshot["state_version"] += 1
        return {
            "state_version": self.snapshot["state_version"],
            "result": "completed",
            "changed": True,
        }

    def start_service(self, *, request_id: str, expected_state_version: int) -> dict:
        return self._action("start", expected_state_version)

    def stop_service(self, *, request_id: str, expected_state_version: int) -> dict:
        return self._action("stop", expected_state_version)

    def retry_service(self, *, request_id: str, expected_state_version: int) -> dict:
        return self._action("retry", expected_state_version)

    def update_port(
        self,
        *,
        configured_port: int,
        request_id: str,
        expected_state_version: int,
    ) -> dict:
        del configured_port, request_id
        return self._action("update_port", expected_state_version)

    def decide_authorization(
        self,
        *,
        authorization_request_id: str,
        allow: bool,
        request_id: str,
        expected_state_version: int,
    ) -> dict:
        del authorization_request_id, allow, request_id
        return self._action("decide_authorization", expected_state_version)

    def check_service(self, *, request_id: str, expected_state_version: int) -> dict:
        del request_id
        return self._action("check_service", expected_state_version)

    def revoke_client(
        self,
        *,
        client_id: str,
        request_id: str,
        expected_state_version: int,
    ) -> dict:
        return self._action("revoke_client", expected_state_version)

    def clear_audit(self, *, request_id: str, expected_state_version: int) -> dict:
        return self._action("clear_audit", expected_state_version)

    def prepare_certificate_action(
        self,
        *,
        action: str,
        request_id: str,
        expected_state_version: int,
    ) -> dict:
        del request_id
        result = self._action("prepare_certificate_action", expected_state_version)
        result.update(
            {
                "confirmation_id": "certificate-confirmation-api-0001",
                "expires_at": "2026-07-23T02:00:00Z",
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
        del confirmation_id, request_id
        result = self._action("confirm_certificate_action", expected_state_version)
        result["operation_id"] = "certificate-operation-api-0001"
        return result

    def prepare_reset(
        self,
        *,
        audit_disposition: str,
        request_id: str,
        expected_state_version: int,
    ) -> dict:
        result = self._action("prepare_reset", expected_state_version)
        result.update(
            {
                "reset_id": "reset-api-0001",
                "expires_at": "2026-07-23T02:00:00Z",
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
            reset_id not in self.reset_ids
            or native_confirmation_capability not in self.native_capabilities
        ):
            raise GatewayActionError("NATIVE_CONFIRMATION_INVALID")
        result = self._action("confirm_reset", expected_state_version)
        self.reset_ids.remove(reset_id)
        self.native_capabilities.remove(native_confirmation_capability)
        return result

    def confirm_web_reset(
        self,
        *,
        reset_id: str,
        request_id: str,
        expected_state_version: int,
    ) -> dict:
        del reset_id
        return self._action("confirm_web_reset", expected_state_version)


class ControlApiTests(unittest.TestCase):
    def setUp(self) -> None:
        self.gateway = FakeApiGateway()
        self.api = ControlApi(
            ControlService(self.gateway),
            expected_host=HOST,
            expected_origin=ORIGIN,
            session_verifier=lambda supplied: secrets.compare_digest(supplied, SESSION),
        )

    @staticmethod
    def headers(*, mutation: bool = False, native: bool = False) -> dict[str, str]:
        result = {
            "Host": HOST,
            "Origin": ORIGIN,
            SESSION_HEADER: SESSION,
        }
        if mutation:
            result["Content-Type"] = "application/json; charset=utf-8"
        if native:
            result[NATIVE_CONFIRMATION_HEADER] = NATIVE_CAPABILITY
        return result

    def test_aggregate_and_read_only_endpoints_return_no_store(self) -> None:
        paths = {
            "/api/v1/mcp/control-panel": "status",
            "/api/v1/mcp/status": "data",
            "/api/v1/mcp/settings": "data",
            "/api/v1/mcp/clients": "data",
            "/api/v1/mcp/audit": "data",
            "/api/v1/mcp/diagnostics": "data",
            "/api/v1/mcp/certificate": "data",
        }
        for path, expected_key in paths.items():
            with self.subTest(path=path):
                response = self.api.dispatch("GET", path, self.headers())
                self.assertEqual(response.status, 200)
                self.assertEqual(response.headers["Cache-Control"], "no-store")
                self.assertIn(expected_key, response.body)

    def test_machine_contract_lists_every_route_and_closes_object_schemas(self) -> None:
        contract_path = (
            Path(__file__).resolve().parents[2]
            / "docs/01-architecture/contracts/mcp/control/v1/control-api.contract.json"
        )
        contract = json.loads(contract_path.read_text(encoding="utf-8"))
        routes = {(item["method"], item["path"]) for item in contract["endpoints"]}
        self.assertEqual(
            routes,
            {
                ("GET", "/api/v1/mcp/control-panel"),
                ("GET", "/api/v1/mcp/status"),
                ("GET", "/api/v1/mcp/settings"),
                ("GET", "/api/v1/mcp/clients"),
                ("GET", "/api/v1/mcp/audit"),
                ("GET", "/api/v1/mcp/diagnostics"),
                ("GET", "/api/v1/mcp/certificate"),
                ("POST", "/api/v1/mcp/actions/start"),
                ("POST", "/api/v1/mcp/actions/stop"),
                ("POST", "/api/v1/mcp/actions/retry"),
                ("POST", "/api/v1/mcp/settings/port"),
                ("POST", "/api/v1/mcp/diagnostics/actions/check"),
                ("POST", "/api/v1/mcp/authorization/actions/allow"),
                ("POST", "/api/v1/mcp/authorization/actions/deny"),
                ("POST", "/api/v1/mcp/clients/actions/revoke"),
                ("POST", "/api/v1/mcp/audit/actions/clear"),
                ("POST", "/api/v1/mcp/certificate/actions/prepare"),
                ("POST", "/api/v1/mcp/certificate/actions/confirm"),
                ("POST", "/api/v1/mcp/reset/actions/prepare"),
                ("POST", "/api/v1/mcp/reset/actions/confirm"),
                ("POST", "/api/v1/mcp/reset/actions/confirm-web"),
            },
        )
        def assert_closed_object_schemas(value: object) -> None:
            if isinstance(value, dict):
                if value.get("type") == "object":
                    self.assertIs(value.get("additionalProperties"), False)
                for child in value.values():
                    assert_closed_object_schemas(child)
            elif isinstance(value, list):
                for child in value:
                    assert_closed_object_schemas(child)

        assert_closed_object_schemas(contract["$defs"])

    def test_certificate_prepare_and_confirm_are_closed_mutations(self) -> None:
        prepared = self.api.dispatch(
            "POST",
            "/api/v1/mcp/certificate/actions/prepare",
            self.headers(mutation=True),
            {
                "request_id": "certificate-api-prepare-0001",
                "expected_state_version": 0,
                "action": "certificate_provision",
            },
        )
        self.assertEqual(prepared.status, 200)
        preview = prepared.body["certificate_confirmation"]
        confirmed = self.api.dispatch(
            "POST",
            "/api/v1/mcp/certificate/actions/confirm",
            self.headers(mutation=True),
            {
                "request_id": "certificate-api-confirm-0001",
                "expected_state_version": prepared.body["state_version"],
                "confirmation_id": preview["confirmation_id"],
            },
        )
        self.assertEqual(confirmed.status, 200)
        self.assertEqual(
            confirmed.body["operation_id"], "certificate-operation-api-0001"
        )

    def test_host_origin_and_session_are_exactly_checked(self) -> None:
        cases = [
            ({"Host": "localhost:5173", "Origin": ORIGIN, SESSION_HEADER: SESSION}, 403, "INVALID_HOST"),
            ({"Host": HOST, "Origin": ORIGIN + "/", SESSION_HEADER: SESSION}, 403, "INVALID_ORIGIN"),
            ({"Host": HOST, "Origin": ORIGIN, SESSION_HEADER: SESSION + "x"}, 401, "SESSION_REQUIRED"),
            ({"Host": HOST, "Origin": ORIGIN}, 401, "SESSION_REQUIRED"),
        ]
        for headers, status, code in cases:
            with self.subTest(code=code):
                response = self.api.dispatch("GET", "/api/v1/mcp/status", headers)
                self.assertEqual(response.status, status)
                self.assertEqual(response.body["error"]["code"], code)
                self.assertEqual(response.headers["Cache-Control"], "no-store")

    def test_origin_may_be_absent_for_native_adapter_but_wrong_value_never_matches(self) -> None:
        headers = {"Host": HOST, SESSION_HEADER: SESSION}
        response = self.api.dispatch("GET", "/api/v1/mcp/status", headers)
        self.assertEqual(response.status, 200)

    def test_browser_mutation_requires_exact_origin(self) -> None:
        headers = {
            "Host": HOST,
            SESSION_HEADER: SESSION,
            "Content-Type": "application/json",
        }
        response = self.api.dispatch(
            "POST",
            "/api/v1/mcp/actions/start",
            headers,
            {
                "request_id": "request-origin-required",
                "expected_state_version": 0,
            },
        )
        self.assertEqual(response.status, 403)
        self.assertEqual(response.body["error"]["code"], "INVALID_ORIGIN")

    def test_closed_mutation_body_rejects_unknown_and_duplicate_fields(self) -> None:
        unknown = self.api.dispatch(
            "POST",
            "/api/v1/mcp/actions/start",
            self.headers(mutation=True),
            {
                "request_id": "request-api-0001",
                "expected_state_version": 0,
                "extra": True,
            },
        )
        self.assertEqual(unknown.status, 400)
        self.assertEqual(unknown.body["error"]["code"], "INVALID_REQUEST")

        duplicate = self.api.dispatch(
            "POST",
            "/api/v1/mcp/actions/start",
            self.headers(mutation=True),
            '{"request_id":"request-api-0001","request_id":"request-api-0002","expected_state_version":0}',
        )
        self.assertEqual(duplicate.status, 400)
        self.assertEqual(duplicate.body["error"]["code"], "INVALID_JSON")

    def test_mutation_requires_json_and_is_idempotent(self) -> None:
        body = {
            "request_id": "request-api-start",
            "expected_state_version": 0,
        }
        unsupported = self.api.dispatch(
            "POST",
            "/api/v1/mcp/actions/start",
            {**self.headers(), "Content-Type": "text/plain"},
            body,
        )
        self.assertEqual(unsupported.status, 415)

        first = self.api.dispatch(
            "POST",
            "/api/v1/mcp/actions/start",
            self.headers(mutation=True),
            body,
        )
        second = self.api.dispatch(
            "POST",
            "/api/v1/mcp/actions/start",
            self.headers(mutation=True),
            body,
        )
        self.assertEqual(first.status, 200)
        self.assertEqual(first.body, second.body)
        self.assertEqual(self.gateway.calls, ["start"])

    def test_version_conflict_is_actionable_and_does_not_mutate(self) -> None:
        response = self.api.dispatch(
            "POST",
            "/api/v1/mcp/actions/retry",
            self.headers(mutation=True),
            {
                "request_id": "request-api-stale",
                "expected_state_version": 9,
            },
        )
        self.assertEqual(response.status, 409)
        self.assertEqual(response.body["error"]["code"], "STATE_VERSION_CONFLICT")
        self.assertEqual(response.body["error"]["current_state_version"], 0)
        self.assertEqual(self.gateway.calls, [])

    def test_web_reset_confirm_requires_desktop_capability_and_native_use_is_once_only(self) -> None:
        prepared = self.api.dispatch(
            "POST",
            "/api/v1/mcp/reset/actions/prepare",
            self.headers(mutation=True),
            {
                "request_id": "request-api-prepare",
                "expected_state_version": 0,
                "audit_disposition": "retain",
            },
        )
        self.assertEqual(prepared.status, 200)
        self.assertTrue(prepared.body["reset"]["native_confirmation_required"])
        self.assertNotIn(NATIVE_CONFIRMATION_HEADER, json.dumps(prepared.body))

        confirm_body = {
            "request_id": "request-api-confirm",
            "expected_state_version": 1,
            "reset_id": prepared.body["reset"]["reset_id"],
        }
        web_response = self.api.dispatch(
            "POST",
            "/api/v1/mcp/reset/actions/confirm",
            self.headers(mutation=True),
            confirm_body,
        )
        self.assertEqual(web_response.status, 428)
        self.assertEqual(web_response.body["error"]["code"], "DESKTOP_CAPABILITY_REQUIRED")

        native_response = self.api.dispatch(
            "POST",
            "/api/v1/mcp/reset/actions/confirm",
            self.headers(mutation=True, native=True),
            confirm_body,
        )
        replay = self.api.dispatch(
            "POST",
            "/api/v1/mcp/reset/actions/confirm",
            self.headers(mutation=True, native=True),
            confirm_body,
        )
        self.assertEqual(native_response.status, 200)
        self.assertEqual(native_response.body, replay.body)

        reused_capability = self.api.dispatch(
            "POST",
            "/api/v1/mcp/reset/actions/confirm",
            self.headers(mutation=True, native=True),
            {
                "request_id": "request-api-confirm2",
                "expected_state_version": 2,
                "reset_id": prepared.body["reset"]["reset_id"],
            },
        )
        self.assertEqual(reused_capability.status, 403)
        self.assertEqual(reused_capability.body["error"]["code"], "NATIVE_CONFIRMATION_INVALID")

    def test_sensitive_supervisor_output_is_blocked_without_echo(self) -> None:
        self.gateway.snapshot["diagnostics"]["private_key"] = "secret-material"
        response = self.api.dispatch(
            "GET",
            "/api/v1/mcp/control-panel",
            self.headers(),
        )
        encoded = json.dumps(response.body)
        self.assertEqual(response.status, 500)
        self.assertEqual(response.body["error"]["code"], "RESPONSE_POLICY_VIOLATION")
        self.assertNotIn("secret-material", encoded)
        self.assertNotIn("private_key", encoded)

    def test_method_and_route_fail_closed(self) -> None:
        wrong_method = self.api.dispatch(
            "POST",
            "/api/v1/mcp/status",
            self.headers(mutation=True),
            {},
        )
        missing = self.api.dispatch("GET", "/api/v1/mcp/unknown", self.headers())
        self.assertEqual(wrong_method.status, 405)
        self.assertEqual(missing.status, 404)


if __name__ == "__main__":
    unittest.main()
