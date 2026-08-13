"""Safe, framework-independent orchestration for the MCP control surface."""

from __future__ import annotations

from collections import OrderedDict
from copy import deepcopy
from hashlib import sha256
import re
from threading import RLock
from typing import Any, Callable, Mapping, Protocol, runtime_checkable

from .control_models import (
    CONTROL_CONTRACT_VERSION,
    ControlError,
    StateVersionConflict,
    assert_safe_response,
    mutation_fingerprint,
    require_bool,
    require_closed_object,
    require_enum,
    require_int,
    require_nullable_string,
    require_string,
    validate_expected_state_version,
    validate_native_capability,
    validate_opaque_id,
    validate_port,
)


@runtime_checkable
class SupervisorGateway(Protocol):
    """Narrow adapter implemented by the native/App-owned supervisor.

    Implementations own process, platform storage, trust and native-confirmation
    state.  Every mutation must atomically compare ``expected_state_version``.
    ``confirm_reset`` must validate and consume the supplied native capability
    exactly once.  No method may return a secret or an internal runtime object.
    """

    def read_snapshot(self) -> Mapping[str, Any]: ...

    def read_audit_page(
        self,
        *,
        page: int,
        page_size: int,
    ) -> Mapping[str, Any]: ...

    def start_service(self, *, request_id: str, expected_state_version: int) -> Mapping[str, Any]: ...

    def stop_service(self, *, request_id: str, expected_state_version: int) -> Mapping[str, Any]: ...

    def retry_service(self, *, request_id: str, expected_state_version: int) -> Mapping[str, Any]: ...

    def update_port(
        self,
        *,
        configured_port: int,
        request_id: str,
        expected_state_version: int,
    ) -> Mapping[str, Any]: ...

    def decide_authorization(
        self,
        *,
        authorization_request_id: str,
        allow: bool,
        request_id: str,
        expected_state_version: int,
    ) -> Mapping[str, Any]: ...

    def check_service(self, *, request_id: str, expected_state_version: int) -> Mapping[str, Any]: ...

    def revoke_client(
        self,
        *,
        client_id: str,
        request_id: str,
        expected_state_version: int,
    ) -> Mapping[str, Any]: ...

    def clear_audit(self, *, request_id: str, expected_state_version: int) -> Mapping[str, Any]: ...

    def prepare_certificate_action(
        self,
        *,
        action: str,
        request_id: str,
        expected_state_version: int,
    ) -> Mapping[str, Any]: ...

    def confirm_certificate_action(
        self,
        *,
        confirmation_id: str,
        request_id: str,
        expected_state_version: int,
    ) -> Mapping[str, Any]: ...

    def prepare_reset(
        self,
        *,
        audit_disposition: str,
        request_id: str,
        expected_state_version: int,
    ) -> Mapping[str, Any]: ...

    def confirm_reset(
        self,
        *,
        reset_id: str,
        native_confirmation_capability: str,
        request_id: str,
        expected_state_version: int,
    ) -> Mapping[str, Any]: ...

    def confirm_web_reset(
        self,
        *,
        reset_id: str,
        request_id: str,
        expected_state_version: int,
    ) -> Mapping[str, Any]: ...


_DESIRED_STATES = frozenset({"disabled", "enabled"})
_SERVICE_STATES = frozenset({"stopped", "starting", "ready", "stopping", "error"})
_RECONNECT_STATES = frozenset({"idle", "scheduled", "recovering"})
_AUTHORIZATION_STATES = frozenset({"no_clients", "pending", "authorized", "revoked", "error"})
_ACTIVITY_STATES = frozenset({"never", "idle", "recent"})
_KNOWLEDGE_STATES = frozenset({"ready", "degraded", "blocked"})
_AUDIT_STATES = frozenset({"disabled", "ready", "degraded"})
_RELEASE_CHANNELS = frozenset({"stable", "beta", "dev"})
_CLIENT_TRUST_STATES = frozenset({"verified", "unverified"})
_CLIENT_STATES = frozenset({"authorized", "revoked"})
_DIAGNOSTIC_STATES = frozenset({"ready", "degraded", "blocked", "unknown"})
_CHECK_STATES = frozenset({"pass", "warning", "fail", "unknown"})
_ACTION_RESULT_STATES = frozenset({"completed", "accepted"})
_RESET_EFFECTS = frozenset(
    {
        "stop_service",
        "revoke_all_clients",
        "delete_managed_trust",
        "delete_managed_secrets",
        "retain_audit",
        "clear_audit",
    }
)
_AUDIT_DISPOSITIONS = frozenset({"retain", "clear"})
_CERTIFICATE_STATES = frozenset(
    {
        "not_configured",
        "valid",
        "expiring",
        "renewal_required",
        "expired",
        "trust_missing",
        "trust_conflict",
        "key_unavailable",
        "clock_invalid",
        "rotating",
        "recovery_required",
        "error",
    }
)
_CERTIFICATE_ACTIONS = frozenset(
    {
        "certificate_provision",
        "certificate_rotate",
        "certificate_repair_trust",
        "certificate_repair_secret_access",
        "certificate_view_details",
        "certificate_reset",
    }
)
_CERTIFICATE_MUTATION_ACTIONS = frozenset(
    {
        "certificate_provision",
        "certificate_rotate",
        "certificate_repair_trust",
        "certificate_repair_secret_access",
    }
)
_CERTIFICATE_EFFECTS = frozenset(
    {
        "create_managed_identity",
        "install_current_user_trust",
        "replace_current_user_trust",
        "repair_current_item_access",
        "preserve_managed_identity",
        "preserve_client_authorization",
    }
)
_FINGERPRINT_RE = re.compile(r"^(?:[0-9A-F]{2}:){31}[0-9A-F]{2}$")


def _require_nullable_fingerprint(value: Any) -> str | None:
    if value is None:
        return None
    result = require_string(value, minimum=95, maximum=95)
    if not _FINGERPRINT_RE.fullmatch(result):
        raise ControlError("SNAPSHOT_INVALID", status=502)
    return result

class ControlService:
    """Projects supervisor state and serializes safe, idempotent actions."""

    def __init__(self, gateway: SupervisorGateway, *, idempotency_capacity: int = 512) -> None:
        if idempotency_capacity < 1:
            raise ValueError("idempotency_capacity must be positive")
        self._gateway = gateway
        self._idempotency_capacity = idempotency_capacity
        self._idempotency: OrderedDict[str, tuple[str, dict[str, Any]]] = OrderedDict()
        self._mutation_lock = RLock()

    def get_control_panel(self) -> dict[str, Any]:
        return self._read_projected_snapshot()

    def get_status(self) -> dict[str, Any]:
        snapshot = self._read_projected_snapshot()
        return self._read_envelope(snapshot["state_version"], snapshot["status"])

    def get_settings(self) -> dict[str, Any]:
        snapshot = self._read_projected_snapshot()
        return self._read_envelope(snapshot["state_version"], snapshot["settings"])

    def get_clients(self) -> dict[str, Any]:
        snapshot = self._read_projected_snapshot()
        return self._read_envelope(snapshot["state_version"], snapshot["clients"])

    def get_audit(self, *, page: int = 1, page_size: int = 10) -> dict[str, Any]:
        snapshot = self._read_projected_snapshot()
        if not isinstance(page, int) or isinstance(page, bool) or page < 1:
            raise ControlError("INVALID_REQUEST", status=400)
        if page_size != 10:
            raise ControlError("INVALID_REQUEST", status=400)
        raw_audit = self._gateway.read_audit_page(page=page, page_size=page_size)
        return self._read_envelope(
            snapshot["state_version"],
            self._project_audit(raw_audit),
        )

    def get_diagnostics(self) -> dict[str, Any]:
        snapshot = self._read_projected_snapshot()
        return self._read_envelope(snapshot["state_version"], snapshot["diagnostics"])

    def get_certificate(self) -> dict[str, Any]:
        snapshot = self._read_projected_snapshot()
        return self._read_envelope(snapshot["state_version"], snapshot["certificate"])

    def start(self, *, request_id: str, expected_state_version: int) -> dict[str, Any]:
        return self._simple_mutation(
            "start",
            request_id,
            expected_state_version,
            lambda: self._gateway.start_service(
                request_id=request_id,
                expected_state_version=expected_state_version,
            ),
        )

    def stop(self, *, request_id: str, expected_state_version: int) -> dict[str, Any]:
        return self._simple_mutation(
            "stop",
            request_id,
            expected_state_version,
            lambda: self._gateway.stop_service(
                request_id=request_id,
                expected_state_version=expected_state_version,
            ),
        )

    def retry(self, *, request_id: str, expected_state_version: int) -> dict[str, Any]:
        return self._simple_mutation(
            "retry",
            request_id,
            expected_state_version,
            lambda: self._gateway.retry_service(
                request_id=request_id,
                expected_state_version=expected_state_version,
            ),
        )

    def update_port(
        self,
        *,
        configured_port: int,
        request_id: str,
        expected_state_version: int,
    ) -> dict[str, Any]:
        configured_port = validate_port(configured_port)
        if configured_port < 1024 or configured_port == 5173:
            raise ControlError("INVALID_REQUEST", status=400)
        return self._execute_mutation(
            "update_port",
            request_id,
            expected_state_version,
            {"configured_port": configured_port},
            lambda: self._gateway.update_port(
                configured_port=configured_port,
                request_id=request_id,
                expected_state_version=expected_state_version,
            ),
            self._project_action_result,
        )

    def decide_authorization(
        self,
        *,
        authorization_request_id: str,
        allow: bool,
        request_id: str,
        expected_state_version: int,
    ) -> dict[str, Any]:
        authorization_request_id = validate_opaque_id(authorization_request_id)
        if not isinstance(allow, bool):
            raise ControlError("INVALID_REQUEST", status=400)
        return self._execute_mutation(
            "decide_authorization",
            request_id,
            expected_state_version,
            {
                "authorization_request_id": authorization_request_id,
                "allow": allow,
            },
            lambda: self._gateway.decide_authorization(
                authorization_request_id=authorization_request_id,
                allow=allow,
                request_id=request_id,
                expected_state_version=expected_state_version,
            ),
            self._project_action_result,
        )

    def check_service(
        self,
        *,
        request_id: str,
        expected_state_version: int,
    ) -> dict[str, Any]:
        return self._simple_mutation(
            "check_service",
            request_id,
            expected_state_version,
            lambda: self._gateway.check_service(
                request_id=request_id,
                expected_state_version=expected_state_version,
            ),
        )

    def revoke_client(
        self,
        *,
        client_id: str,
        request_id: str,
        expected_state_version: int,
    ) -> dict[str, Any]:
        client_id = validate_opaque_id(client_id)
        return self._execute_mutation(
            "revoke_client",
            request_id,
            expected_state_version,
            {"client_id": client_id},
            lambda: self._gateway.revoke_client(
                client_id=client_id,
                request_id=request_id,
                expected_state_version=expected_state_version,
            ),
            self._project_action_result,
        )

    def clear_audit(self, *, request_id: str, expected_state_version: int) -> dict[str, Any]:
        return self._simple_mutation(
            "clear_audit",
            request_id,
            expected_state_version,
            lambda: self._gateway.clear_audit(
                request_id=request_id,
                expected_state_version=expected_state_version,
            ),
        )

    def prepare_certificate_action(
        self,
        *,
        action: str,
        request_id: str,
        expected_state_version: int,
    ) -> dict[str, Any]:
        if not isinstance(action, str) or action not in _CERTIFICATE_MUTATION_ACTIONS:
            raise ControlError("INVALID_REQUEST", status=400)
        return self._execute_mutation(
            "prepare_certificate_action",
            request_id,
            expected_state_version,
            {"action": action},
            lambda: self._gateway.prepare_certificate_action(
                action=action,
                request_id=request_id,
                expected_state_version=expected_state_version,
            ),
            self._project_certificate_prepare_result,
        )

    def confirm_certificate_action(
        self,
        *,
        confirmation_id: str,
        request_id: str,
        expected_state_version: int,
    ) -> dict[str, Any]:
        confirmation_id = validate_opaque_id(confirmation_id)
        return self._execute_mutation(
            "confirm_certificate_action",
            request_id,
            expected_state_version,
            {"confirmation_id": confirmation_id},
            lambda: self._gateway.confirm_certificate_action(
                confirmation_id=confirmation_id,
                request_id=request_id,
                expected_state_version=expected_state_version,
            ),
            self._project_action_result,
        )

    def prepare_reset(
        self,
        *,
        request_id: str,
        expected_state_version: int,
        audit_disposition: str = "retain",
    ) -> dict[str, Any]:
        if audit_disposition not in _AUDIT_DISPOSITIONS:
            raise ControlError("INVALID_REQUEST", status=400)
        return self._execute_mutation(
            "prepare_reset",
            request_id,
            expected_state_version,
            {"audit_disposition": audit_disposition},
            lambda: self._gateway.prepare_reset(
                audit_disposition=audit_disposition,
                request_id=request_id,
                expected_state_version=expected_state_version,
            ),
            self._project_reset_prepare_result,
        )

    def confirm_reset(
        self,
        *,
        reset_id: str,
        native_confirmation_capability: str,
        request_id: str,
        expected_state_version: int,
    ) -> dict[str, Any]:
        reset_id = validate_opaque_id(reset_id)
        capability = validate_native_capability(native_confirmation_capability)
        capability_digest = sha256(capability.encode("utf-8")).hexdigest()
        return self._execute_mutation(
            "confirm_reset",
            request_id,
            expected_state_version,
            {
                "reset_id": reset_id,
                "native_confirmation_capability_sha256": capability_digest,
            },
            lambda: self._gateway.confirm_reset(
                reset_id=reset_id,
                native_confirmation_capability=capability,
                request_id=request_id,
                expected_state_version=expected_state_version,
            ),
            self._project_action_result,
        )

    def confirm_web_reset(
        self,
        *,
        reset_id: str,
        confirmation: str,
        request_id: str,
        expected_state_version: int,
    ) -> dict[str, Any]:
        reset_id = validate_opaque_id(reset_id)
        if confirmation != "RESET":
            raise ControlError("INVALID_REQUEST", status=400)
        return self._execute_mutation(
            "confirm_web_reset",
            request_id,
            expected_state_version,
            {"reset_id": reset_id, "confirmation": confirmation},
            lambda: self._gateway.confirm_web_reset(
                reset_id=reset_id,
                request_id=request_id,
                expected_state_version=expected_state_version,
            ),
            self._project_action_result,
        )

    def _simple_mutation(
        self,
        action: str,
        request_id: str,
        expected_state_version: int,
        operation: Callable[[], Mapping[str, Any]],
    ) -> dict[str, Any]:
        return self._execute_mutation(
            action,
            request_id,
            expected_state_version,
            {},
            operation,
            self._project_action_result,
        )

    def _execute_mutation(
        self,
        action: str,
        request_id: str,
        expected_state_version: int,
        parameters: Mapping[str, Any],
        operation: Callable[[], Mapping[str, Any]],
        projector: Callable[[str, str, Mapping[str, Any]], dict[str, Any]],
    ) -> dict[str, Any]:
        request_id = validate_opaque_id(request_id)
        expected_state_version = validate_expected_state_version(expected_state_version)
        fingerprint = mutation_fingerprint(action, expected_state_version, parameters)

        with self._mutation_lock:
            cached = self._idempotency.get(request_id)
            if cached is not None:
                cached_fingerprint, cached_response = cached
                if cached_fingerprint != fingerprint:
                    raise ControlError("REQUEST_ID_REUSED", status=409)
                self._idempotency.move_to_end(request_id)
                return deepcopy(cached_response)

            snapshot = self._read_projected_snapshot()
            current_version = snapshot["state_version"]
            if current_version != expected_state_version:
                raise StateVersionConflict(current_version)

            try:
                raw_result = operation()
            except ControlError:
                raise
            except Exception as exc:
                raise ControlError("SUPERVISOR_UNAVAILABLE", status=503, retryable=True) from exc

            assert_safe_response(raw_result)
            response = projector(action, request_id, raw_result)
            assert_safe_response(response)
            self._idempotency[request_id] = (fingerprint, deepcopy(response))
            self._idempotency.move_to_end(request_id)
            while len(self._idempotency) > self._idempotency_capacity:
                self._idempotency.popitem(last=False)
            return response

    def _read_projected_snapshot(self) -> dict[str, Any]:
        try:
            raw = self._gateway.read_snapshot()
        except ControlError:
            raise
        except Exception as exc:
            raise ControlError("SUPERVISOR_UNAVAILABLE", status=503, retryable=True) from exc
        assert_safe_response(raw)
        return self._project_snapshot(raw)

    @staticmethod
    def _read_envelope(state_version: int, data: Any) -> dict[str, Any]:
        response = {
            "contract_version": CONTROL_CONTRACT_VERSION,
            "state_version": state_version,
            "data": data,
        }
        assert_safe_response(response)
        return response

    @staticmethod
    def _project_snapshot(raw: Mapping[str, Any]) -> dict[str, Any]:
        source = require_closed_object(
            raw,
            required=frozenset(
                {
                    "state_version",
                    "status",
                    "settings",
                    "certificate",
                    "clients",
                    "audit",
                    "diagnostics",
                }
            ),
            optional=frozenset({"authorization_requests"}),
            error_code="SNAPSHOT_INVALID",
        )
        state_version = require_int(source["state_version"])
        status = ControlService._project_status(source["status"])
        settings = ControlService._project_settings(source["settings"])
        certificate = ControlService._project_certificate(source["certificate"])
        clients = ControlService._project_clients(source["clients"])
        authorization_requests = ControlService._project_authorization_requests(
            source.get("authorization_requests", [])
        )
        audit = ControlService._project_audit(source["audit"])
        diagnostics = ControlService._project_diagnostics(source["diagnostics"])
        result = {
            "contract_version": CONTROL_CONTRACT_VERSION,
            "state_version": state_version,
            "status": status,
            "settings": settings,
            "certificate": certificate,
            "authorization_requests": authorization_requests,
            "clients": clients,
            "audit": audit,
            "diagnostics": diagnostics,
        }
        assert_safe_response(result)
        return result

    @staticmethod
    def _project_status(raw: Any) -> dict[str, Any]:
        source = require_closed_object(
            raw,
            required=frozenset(
                {
                    "desired_state",
                    "service_state",
                    "authorization_state",
                    "activity_state",
                    "knowledge_state",
                    "audit_state",
                    "last_success_at",
                    "recoverable_error",
                }
            ),
            optional=frozenset({"reconnect_state", "reconnect_attempt"}),
            error_code="SNAPSHOT_INVALID",
        )
        desired_state = require_enum(source["desired_state"], _DESIRED_STATES)
        service_state = require_enum(source["service_state"], _SERVICE_STATES)
        authorization_state = require_enum(source["authorization_state"], _AUTHORIZATION_STATES)
        activity_state = require_enum(source["activity_state"], _ACTIVITY_STATES)
        knowledge_state = require_enum(source["knowledge_state"], _KNOWLEDGE_STATES)
        audit_state = require_enum(source["audit_state"], _AUDIT_STATES)
        recoverable_error = ControlService._project_recoverable_error(source["recoverable_error"])
        return {
            "desired_state": desired_state,
            "service_state": service_state,
            "reconnect_state": require_enum(
                source.get("reconnect_state", "idle"),
                _RECONNECT_STATES,
            ),
            "reconnect_attempt": require_int(
                source.get("reconnect_attempt", 0),
                minimum=0,
                maximum=1000,
            ),
            "authorization_state": authorization_state,
            "activity_state": activity_state,
            "knowledge_state": knowledge_state,
            "audit_state": audit_state,
            "display_state": ControlService._derive_display_state(
                desired_state,
                service_state,
                authorization_state,
                activity_state,
                knowledge_state,
                audit_state,
                recoverable_error,
            ),
            "last_success_at": require_nullable_string(source["last_success_at"], maximum=64),
            "recoverable_error": recoverable_error,
        }

    @staticmethod
    def _project_recoverable_error(raw: Any) -> dict[str, str] | None:
        if raw is None:
            return None
        source = require_closed_object(
            raw,
            required=frozenset({"code", "recovery_action"}),
            error_code="SNAPSHOT_INVALID",
        )
        return {
            "code": require_string(source["code"], minimum=1, maximum=64),
            "recovery_action": require_string(source["recovery_action"], minimum=1, maximum=64),
        }

    @staticmethod
    def _derive_display_state(
        desired_state: str,
        service_state: str,
        authorization_state: str,
        activity_state: str,
        knowledge_state: str,
        audit_state: str,
        recoverable_error: Mapping[str, str] | None,
    ) -> str:
        if desired_state == "disabled":
            return "disabled"
        if service_state == "starting":
            return "starting"
        if service_state == "stopping":
            return "stopping"
        if service_state == "error" or recoverable_error is not None:
            return "recoverable_error"
        if knowledge_state == "blocked":
            return "knowledge_blocked"
        if knowledge_state == "degraded":
            return "knowledge_degraded"
        if audit_state == "degraded":
            return "audit_degraded"
        if authorization_state in {"no_clients", "pending", "revoked"}:
            return "ready_waiting_authorization"
        if authorization_state == "error":
            return "recoverable_error"
        if activity_state == "recent":
            return "recently_used"
        return "authorized_waiting_use"

    @staticmethod
    def _project_settings(raw: Any) -> dict[str, Any]:
        source = require_closed_object(
            raw,
            required=frozenset(
                {
                    "enabled",
                    "configured_port",
                    "release_channel",
                    "canonical_resource",
                    "control_capabilities",
                }
            ),
            optional=frozenset({"auto_restore"}),
            error_code="SNAPSHOT_INVALID",
        )
        capabilities = require_closed_object(
            source["control_capabilities"],
            required=frozenset(
                {
                    "service_control",
                    "client_revocation",
                    "audit_clear",
                    "native_reset_confirmation",
                }
            ),
            optional=frozenset(
                {
                    "port_configuration",
                    "authorization_decision",
                    "diagnostic_check",
                    "web_reset_confirmation",
                    "certificate_provision",
                    "certificate_rotate",
                    "certificate_repair_trust",
                    "certificate_repair_secret_access",
                    "certificate_view_details",
                    "certificate_reset",
                }
            ),
            error_code="SNAPSHOT_INVALID",
        )
        canonical_resource = require_string(source["canonical_resource"], minimum=1, maximum=256)
        if not canonical_resource.startswith("https://127.0.0.1:") or not canonical_resource.endswith("/mcp"):
            raise ControlError("SNAPSHOT_INVALID", status=502)
        return {
            "enabled": require_bool(source["enabled"]),
            "auto_restore": require_bool(source.get("auto_restore", False)),
            "configured_port": validate_port(source["configured_port"]),
            "release_channel": require_enum(source["release_channel"], _RELEASE_CHANNELS),
            "canonical_resource": canonical_resource,
            "control_capabilities": {
                "service_control": require_bool(capabilities["service_control"]),
                "client_revocation": require_bool(capabilities["client_revocation"]),
                "audit_clear": require_bool(capabilities["audit_clear"]),
                "native_reset_confirmation": require_bool(capabilities["native_reset_confirmation"]),
                "port_configuration": require_bool(capabilities.get("port_configuration", False)),
                "authorization_decision": require_bool(capabilities.get("authorization_decision", False)),
                "diagnostic_check": require_bool(capabilities.get("diagnostic_check", False)),
                "web_reset_confirmation": require_bool(
                    capabilities.get("web_reset_confirmation", False)
                ),
                "certificate_provision": require_bool(
                    capabilities.get("certificate_provision", False)
                ),
                "certificate_rotate": require_bool(
                    capabilities.get("certificate_rotate", False)
                ),
                "certificate_repair_trust": require_bool(
                    capabilities.get("certificate_repair_trust", False)
                ),
                "certificate_repair_secret_access": require_bool(
                    capabilities.get(
                        "certificate_repair_secret_access",
                        False,
                    )
                ),
                "certificate_view_details": require_bool(
                    capabilities.get("certificate_view_details", False)
                ),
                "certificate_reset": require_bool(
                    capabilities.get("certificate_reset", False)
                ),
            },
        }

    @staticmethod
    def _project_certificate(raw: Any) -> dict[str, Any]:
        source = require_closed_object(
            raw,
            required=frozenset(
                {
                    "schema_version",
                    "state",
                    "reason_code",
                    "managed_by_app",
                    "profile",
                    "install_id_suffix",
                    "generation_id",
                    "subject",
                    "san",
                    "ca_display_name",
                    "ca_fingerprint_sha256",
                    "server_fingerprint_sha256",
                    "valid_from",
                    "valid_until",
                    "remaining_days",
                    "trust_scope",
                    "trust_backend",
                    "secret_backend",
                    "trust_policy",
                    "trust_verified_at",
                    "last_rotated_at",
                    "operation",
                    "cleanup_pending",
                    "client_restart_required",
                    "old_generation_retained_until",
                    "next_action",
                }
            ),
            error_code="SNAPSHOT_INVALID",
        )
        san = source["san"]
        if san != ["127.0.0.1"]:
            raise ControlError("SNAPSHOT_INVALID", status=502)
        result = {
            "schema_version": require_int(source["schema_version"], minimum=1, maximum=16),
            "state": require_enum(source["state"], _CERTIFICATE_STATES),
            "reason_code": require_nullable_string(source["reason_code"], maximum=96),
            "managed_by_app": require_bool(source["managed_by_app"]),
            "profile": require_enum(source["profile"], frozenset({"dev", "app"})),
            "install_id_suffix": require_nullable_string(source["install_id_suffix"], maximum=16),
            "generation_id": require_nullable_string(source["generation_id"], maximum=128),
            "subject": require_string(source["subject"], minimum=1, maximum=64),
            "san": ["127.0.0.1"],
            "ca_display_name": require_nullable_string(source["ca_display_name"], maximum=160),
            "ca_fingerprint_sha256": _require_nullable_fingerprint(
                source["ca_fingerprint_sha256"]
            ),
            "server_fingerprint_sha256": _require_nullable_fingerprint(
                source["server_fingerprint_sha256"]
            ),
            "valid_from": require_nullable_string(source["valid_from"], maximum=64),
            "valid_until": require_nullable_string(source["valid_until"], maximum=64),
            "remaining_days": (
                None
                if source["remaining_days"] is None
                else require_int(source["remaining_days"], maximum=4096)
            ),
            "trust_scope": require_enum(
                source["trust_scope"],
                frozenset({"current_user"}),
            ),
            "trust_backend": require_enum(
                source["trust_backend"],
                frozenset(
                    {
                        "fake_current_user_trust",
                        "macos_user_trust",
                        "windows_current_user_root",
                    }
                ),
            ),
            "secret_backend": require_enum(
                source["secret_backend"],
                frozenset(
                    {
                        "in_memory_test_only",
                        "macos_web_dev_keychain",
                        "macos_data_protection_keychain",
                        "windows_dpapi_current_user",
                    }
                ),
            ),
            "trust_policy": require_enum(
                source["trust_policy"],
                frozenset({"ssl_loopback_only"}),
            ),
            "trust_verified_at": require_nullable_string(
                source["trust_verified_at"], maximum=64
            ),
            "last_rotated_at": require_nullable_string(
                source["last_rotated_at"], maximum=64
            ),
            "operation": None,
            "cleanup_pending": require_bool(source["cleanup_pending"]),
            "client_restart_required": require_bool(
                source["client_restart_required"]
            ),
            "old_generation_retained_until": require_nullable_string(
                source["old_generation_retained_until"], maximum=64
            ),
            "next_action": (
                None
                if source["next_action"] is None
                else require_enum(source["next_action"], _CERTIFICATE_ACTIONS)
            ),
        }
        if source["operation"] is not None:
            operation = require_closed_object(
                source["operation"],
                required=frozenset({"operation_id", "state", "phase"}),
                error_code="SNAPSHOT_INVALID",
            )
            result["operation"] = {
                "operation_id": validate_opaque_id(
                    operation["operation_id"], error_code="SNAPSHOT_INVALID"
                ),
                "state": require_enum(
                    operation["state"],
                    frozenset({"planned", "running", "completed", "failed"}),
                ),
                "phase": require_enum(
                    operation["phase"],
                    frozenset(
                        {
                            "planned",
                            "staged",
                            "new_trust_installed",
                            "switched",
                            "validated",
                            "retiring",
                            "completed",
                        }
                    ),
                ),
            }
        return result

    @staticmethod
    def _project_authorization_requests(raw: Any) -> list[dict[str, Any]]:
        if not isinstance(raw, (list, tuple)) or len(raw) > 128:
            raise ControlError("SNAPSHOT_INVALID", status=502)
        result: list[dict[str, Any]] = []
        for item in raw:
            source = require_closed_object(
                item,
                required=frozenset(
                    {
                        "request_id",
                        "client_id",
                        "client_name",
                        "redirect_uri",
                        "scopes",
                        "resource",
                        "policy_version",
                        "created_at",
                        "expires_at",
                        "registration_mode",
                        "trust_state",
                    }
                ),
                error_code="SNAPSHOT_INVALID",
            )
            scopes = source["scopes"]
            if not isinstance(scopes, (list, tuple)) or not 1 <= len(scopes) <= 16:
                raise ControlError("SNAPSHOT_INVALID", status=502)
            redirect_uri = require_string(source["redirect_uri"], minimum=1, maximum=512)
            resource = require_string(source["resource"], minimum=1, maximum=256)
            if not redirect_uri.startswith("http://127.0.0.1:"):
                raise ControlError("SNAPSHOT_INVALID", status=502)
            if not resource.startswith("https://127.0.0.1:") or not resource.endswith("/mcp"):
                raise ControlError("SNAPSHOT_INVALID", status=502)
            result.append(
                {
                    "request_id": validate_opaque_id(source["request_id"], error_code="SNAPSHOT_INVALID"),
                    "client_id": validate_opaque_id(source["client_id"], error_code="SNAPSHOT_INVALID"),
                    "client_name": require_nullable_string(source["client_name"], maximum=128),
                    "redirect_uri": redirect_uri,
                    "scopes": [require_string(scope, minimum=1, maximum=128) for scope in scopes],
                    "resource": resource,
                    "policy_version": require_string(source["policy_version"], minimum=1, maximum=64),
                    "registration_mode": require_enum(
                        source["registration_mode"],
                        frozenset({"pre_registered", "CIMD", "DCR"}),
                    ),
                    "trust_state": require_enum(
                        source["trust_state"],
                        _CLIENT_TRUST_STATES,
                    ),
                    "created_at": require_string(source["created_at"], minimum=1, maximum=64),
                    "expires_at": require_string(source["expires_at"], minimum=1, maximum=64),
                }
            )
        return result

    @staticmethod
    def _project_clients(raw: Any) -> list[dict[str, Any]]:
        if not isinstance(raw, (list, tuple)) or len(raw) > 128:
            raise ControlError("SNAPSHOT_INVALID", status=502)
        result: list[dict[str, Any]] = []
        for item in raw:
            source = require_closed_object(
                item,
                required=frozenset(
                    {
                        "client_id",
                        "display_name",
                        "trust_state",
                        "scopes",
                        "authorized_at",
                        "last_used_at",
                        "policy_version",
                        "status",
                    }
                ),
                error_code="SNAPSHOT_INVALID",
            )
            raw_scopes = source["scopes"]
            if not isinstance(raw_scopes, (list, tuple)) or not 1 <= len(raw_scopes) <= 16:
                raise ControlError("SNAPSHOT_INVALID", status=502)
            scopes = [require_string(scope, minimum=1, maximum=128) for scope in raw_scopes]
            result.append(
                {
                    "client_id": validate_opaque_id(source["client_id"], error_code="SNAPSHOT_INVALID"),
                    "display_name": require_string(source["display_name"], minimum=1, maximum=128),
                    "trust_state": require_enum(source["trust_state"], _CLIENT_TRUST_STATES),
                    "scopes": scopes,
                    "authorized_at": require_string(source["authorized_at"], minimum=1, maximum=64),
                    "last_used_at": require_nullable_string(source["last_used_at"], maximum=64),
                    "policy_version": require_string(source["policy_version"], minimum=1, maximum=64),
                    "status": require_enum(source["status"], _CLIENT_STATES),
                }
            )
        return result

    @staticmethod
    def _project_audit(raw: Any) -> dict[str, Any]:
        source = require_closed_object(
            raw,
            required=frozenset(
                {
                    "enabled",
                    "state",
                    "retention_days",
                    "max_events",
                    "retention_bytes",
                    "display_limit",
                    "event_count",
                    "last_event_at",
                    "page",
                    "page_size",
                    "page_count",
                    "recent_events",
                }
            ),
            error_code="SNAPSHOT_INVALID",
        )
        raw_events = source["recent_events"]
        if not isinstance(raw_events, (list, tuple)) or len(raw_events) > 10:
            raise ControlError("SNAPSHOT_INVALID", status=502)
        recent_events: list[dict[str, Any]] = []
        for item in raw_events:
            event = require_closed_object(
                item,
                required=frozenset(
                    {
                        "occurred_at",
                        "event_type",
                        "client_id",
                        "tool_name",
                        "result_code",
                        "returned_count",
                        "duration_ms",
                    }
                ),
                optional=frozenset(
                    {
                        "first_occurred_at",
                        "last_occurred_at",
                        "occurrence_count",
                    }
                ),
                error_code="SNAPSHOT_INVALID",
            )
            returned_count = event["returned_count"]
            duration_ms = event["duration_ms"]
            occurred_at = require_string(
                event["occurred_at"],
                minimum=1,
                maximum=64,
            )
            recent_events.append(
                {
                    "occurred_at": occurred_at,
                    "first_occurred_at": require_string(
                        event.get("first_occurred_at", occurred_at),
                        minimum=1,
                        maximum=64,
                    ),
                    "last_occurred_at": require_string(
                        event.get("last_occurred_at", occurred_at),
                        minimum=1,
                        maximum=64,
                    ),
                    "occurrence_count": require_int(
                        event.get("occurrence_count", 1),
                        minimum=1,
                        maximum=10,
                    ),
                    "event_type": require_string(event["event_type"], minimum=1, maximum=128),
                    "client_id": require_nullable_string(event["client_id"], maximum=128),
                    "tool_name": require_nullable_string(event["tool_name"], maximum=128),
                    "result_code": require_string(event["result_code"], minimum=1, maximum=128),
                    "returned_count": (
                        None if returned_count is None else require_int(returned_count)
                    ),
                    "duration_ms": (
                        None if duration_ms is None else require_int(duration_ms)
                    ),
                }
            )
        return {
            "enabled": require_bool(source["enabled"]),
            "state": require_enum(source["state"], _AUDIT_STATES),
            "retention_days": require_int(source["retention_days"], maximum=3650),
            "max_events": require_int(source["max_events"], minimum=100, maximum=1_000_000),
            "retention_bytes": require_int(source["retention_bytes"], maximum=2**40),
            "display_limit": require_int(source["display_limit"], minimum=3, maximum=1000),
            "event_count": require_int(source["event_count"]),
            "last_event_at": require_nullable_string(source["last_event_at"], maximum=64),
            "page": require_int(source["page"], minimum=1),
            "page_size": require_int(source["page_size"], minimum=10, maximum=10),
            "page_count": require_int(source["page_count"], minimum=1),
            "recent_events": recent_events,
        }

    @staticmethod
    def _project_diagnostics(raw: Any) -> dict[str, Any]:
        source = require_closed_object(
            raw,
            required=frozenset({"overall_state", "last_checked_at", "checks"}),
            error_code="SNAPSHOT_INVALID",
        )
        raw_checks = source["checks"]
        if not isinstance(raw_checks, (list, tuple)) or len(raw_checks) > 64:
            raise ControlError("SNAPSHOT_INVALID", status=502)
        checks: list[dict[str, Any]] = []
        for item in raw_checks:
            check = require_closed_object(
                item,
                required=frozenset({"check_id", "status", "error_code", "recovery_action"}),
                error_code="SNAPSHOT_INVALID",
            )
            checks.append(
                {
                    "check_id": require_string(check["check_id"], minimum=1, maximum=64),
                    "status": require_enum(check["status"], _CHECK_STATES),
                    "error_code": require_nullable_string(check["error_code"], maximum=64),
                    "recovery_action": require_nullable_string(check["recovery_action"], maximum=64),
                }
            )
        return {
            "overall_state": require_enum(source["overall_state"], _DIAGNOSTIC_STATES),
            "last_checked_at": require_nullable_string(source["last_checked_at"], maximum=64),
            "checks": checks,
        }

    @staticmethod
    def _project_action_result(action: str, request_id: str, raw: Mapping[str, Any]) -> dict[str, Any]:
        source = require_closed_object(
            raw,
            required=frozenset({"state_version", "result", "changed"}),
            optional=frozenset({"operation_id"}),
            error_code="SNAPSHOT_INVALID",
        )
        result = {
            "contract_version": CONTROL_CONTRACT_VERSION,
            "action": action,
            "request_id": request_id,
            "state_version": require_int(source["state_version"]),
            "result": require_enum(source["result"], _ACTION_RESULT_STATES),
            "changed": require_bool(source["changed"]),
        }
        if "operation_id" in source:
            result["operation_id"] = validate_opaque_id(
                source["operation_id"], error_code="SNAPSHOT_INVALID"
            )
        return result

    @staticmethod
    def _project_certificate_prepare_result(
        action: str,
        request_id: str,
        raw: Mapping[str, Any],
    ) -> dict[str, Any]:
        source = require_closed_object(
            raw,
            required=frozenset(
                {
                    "state_version",
                    "result",
                    "changed",
                    "confirmation_id",
                    "expires_at",
                    "effects",
                    "action",
                    "profile",
                    "expected_ca_fingerprint_sha256",
                    "confirmation_mode",
                }
            ),
            error_code="SNAPSHOT_INVALID",
        )
        effects = source["effects"]
        if not isinstance(effects, (list, tuple)) or not 1 <= len(effects) <= 3:
            raise ControlError("SNAPSHOT_INVALID", status=502)
        prepared_action = require_enum(source["action"], _CERTIFICATE_MUTATION_ACTIONS)
        return {
            "contract_version": CONTROL_CONTRACT_VERSION,
            "action": action,
            "request_id": request_id,
            "state_version": require_int(source["state_version"]),
            "result": require_enum(source["result"], _ACTION_RESULT_STATES),
            "changed": require_bool(source["changed"]),
            "certificate_confirmation": {
                "confirmation_id": validate_opaque_id(
                    source["confirmation_id"], error_code="SNAPSHOT_INVALID"
                ),
                "expires_at": require_string(
                    source["expires_at"], minimum=1, maximum=64
                ),
                "effects": [
                    require_enum(effect, _CERTIFICATE_EFFECTS) for effect in effects
                ],
                "action": prepared_action,
                "profile": require_enum(source["profile"], frozenset({"dev", "app"})),
                "expected_ca_fingerprint_sha256": _require_nullable_fingerprint(
                    source["expected_ca_fingerprint_sha256"]
                ),
                "web_confirmation_required": require_enum(
                    source["confirmation_mode"],
                    frozenset({"web"}),
                )
                == "web",
            },
        }

    @staticmethod
    def _project_reset_prepare_result(action: str, request_id: str, raw: Mapping[str, Any]) -> dict[str, Any]:
        source = require_closed_object(
            raw,
            required=frozenset(
                {
                    "state_version",
                    "result",
                    "changed",
                    "reset_id",
                    "expires_at",
                    "effects",
                }
            ),
            optional=frozenset({"confirmation_mode"}),
            error_code="SNAPSHOT_INVALID",
        )
        raw_effects = source["effects"]
        if not isinstance(raw_effects, (list, tuple)) or not 1 <= len(raw_effects) <= len(_RESET_EFFECTS):
            raise ControlError("SNAPSHOT_INVALID", status=502)
        effects = [require_enum(effect, _RESET_EFFECTS) for effect in raw_effects]
        confirmation_mode = require_enum(
            source.get("confirmation_mode", "native"),
            frozenset({"native", "web"}),
        )
        return {
            "contract_version": CONTROL_CONTRACT_VERSION,
            "action": action,
            "request_id": request_id,
            "state_version": require_int(source["state_version"]),
            "result": require_enum(source["result"], _ACTION_RESULT_STATES),
            "changed": require_bool(source["changed"]),
            "reset": {
                "reset_id": validate_opaque_id(source["reset_id"], error_code="SNAPSHOT_INVALID"),
                "expires_at": require_string(source["expires_at"], minimum=1, maximum=64),
                "effects": effects,
                "native_confirmation_required": confirmation_mode == "native",
                "web_confirmation_required": confirmation_mode == "web",
            },
        }
