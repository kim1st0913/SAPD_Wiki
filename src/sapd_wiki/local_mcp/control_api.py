"""HTTP-shaped adapter for the framework-independent MCP control service."""

from __future__ import annotations

import json
from typing import Any, Callable, Mapping, Protocol

from .control_models import (
    CONTROL_CONTRACT_VERSION,
    NATIVE_CONFIRMATION_HEADER,
    SESSION_HEADER,
    ControlApiRequest,
    ControlApiResponse,
    ControlError,
    assert_safe_response,
    require_closed_object,
)
from .control_service import ControlService


_READ_ROUTES = {
    "/api/v1/mcp/control-panel": "get_control_panel",
    "/api/v1/mcp/status": "get_status",
    "/api/v1/mcp/settings": "get_settings",
    "/api/v1/mcp/clients": "get_clients",
    "/api/v1/mcp/audit": "get_audit",
    "/api/v1/mcp/diagnostics": "get_diagnostics",
}

_MUTATION_ROUTES = {
    "/api/v1/mcp/actions/start": "start",
    "/api/v1/mcp/actions/stop": "stop",
    "/api/v1/mcp/actions/retry": "retry",
    "/api/v1/mcp/settings/port": "update_port",
    "/api/v1/mcp/diagnostics/actions/check": "check_service",
    "/api/v1/mcp/authorization/actions/allow": "allow_authorization",
    "/api/v1/mcp/authorization/actions/deny": "deny_authorization",
    "/api/v1/mcp/clients/actions/revoke": "revoke_client",
    "/api/v1/mcp/audit/actions/clear": "clear_audit",
    "/api/v1/mcp/reset/actions/prepare": "prepare_reset",
    "/api/v1/mcp/reset/actions/confirm": "confirm_reset",
    "/api/v1/mcp/reset/actions/confirm-web": "confirm_web_reset",
}

_COMMON_MUTATION_FIELDS = frozenset({"request_id", "expected_state_version"})
_JSON_BODY_LIMIT = 8192


class SessionVerifier(Protocol):
    """Verifies a supplied local Web session without exposing the verifier secret."""

    def __call__(self, supplied_session: str) -> bool: ...


class ControlApi:
    """Dispatches a closed local API without depending on an HTTP framework."""

    def __init__(
        self,
        service: ControlService,
        *,
        expected_host: str,
        expected_origin: str,
        session_verifier: SessionVerifier,
        allow_web_reset: bool = False,
    ) -> None:
        if not expected_host or not expected_origin or not callable(session_verifier):
            raise ValueError("expected_host, expected_origin and session_verifier are required")
        self._service = service
        self._expected_host = expected_host
        self._expected_origin = expected_origin
        self._session_verifier = session_verifier
        self._allow_web_reset = bool(allow_web_reset)

    def dispatch(
        self,
        method: str,
        path: str,
        headers: Mapping[str, str],
        body: bytes | str | Mapping[str, Any] | None = None,
    ) -> ControlApiResponse:
        return self.handle(ControlApiRequest(method=method, path=path, headers=headers, body=body))

    def handle(self, request: ControlApiRequest) -> ControlApiResponse:
        try:
            method = request.method.upper() if isinstance(request.method, str) else ""
            path = request.path if isinstance(request.path, str) else ""
            headers = self._validate_request_boundary(
                request.headers,
                require_origin=method == "POST" and path in _MUTATION_ROUTES,
            )

            if path in _READ_ROUTES:
                if method != "GET":
                    raise ControlError("METHOD_NOT_ALLOWED", status=405)
                self._require_empty_body(request.body)
                handler = getattr(self._service, _READ_ROUTES[path])
                return self._success(handler())

            if path in _MUTATION_ROUTES:
                if method != "POST":
                    raise ControlError("METHOD_NOT_ALLOWED", status=405)
                if not self._is_json_content_type(headers.get("content-type", "")):
                    raise ControlError("UNSUPPORTED_MEDIA_TYPE", status=415)
                payload = self._parse_json_object(request.body)
                result = self._dispatch_mutation(_MUTATION_ROUTES[path], payload, headers)
                return self._success(result)

            raise ControlError("NOT_FOUND", status=404)
        except ControlError as exc:
            return self._error(exc)
        except Exception:
            return self._error(ControlError("INTERNAL_ERROR", status=500))

    def _validate_request_boundary(
        self,
        raw_headers: Mapping[str, str],
        *,
        require_origin: bool = False,
    ) -> dict[str, str]:
        if not isinstance(raw_headers, Mapping):
            raise ControlError("INVALID_REQUEST", status=400)
        headers: dict[str, str] = {}
        for raw_name, raw_value in raw_headers.items():
            if not isinstance(raw_name, str) or not isinstance(raw_value, str):
                raise ControlError("INVALID_REQUEST", status=400)
            name = raw_name.casefold()
            if name in headers:
                raise ControlError("INVALID_REQUEST", status=400)
            headers[name] = raw_value

        if headers.get("host") != self._expected_host:
            raise ControlError("INVALID_HOST", status=403)
        origin = headers.get("origin")
        if require_origin and origin is None:
            raise ControlError("INVALID_ORIGIN", status=403)
        if origin is not None and origin != self._expected_origin:
            raise ControlError("INVALID_ORIGIN", status=403)
        supplied_session = headers.get(SESSION_HEADER.casefold(), "")
        if not supplied_session or not self._session_verifier(supplied_session):
            raise ControlError("SESSION_REQUIRED", status=401)
        return headers

    def _dispatch_mutation(
        self,
        action: str,
        payload: Mapping[str, Any],
        headers: Mapping[str, str],
    ) -> dict[str, Any]:
        if action in {"start", "stop", "retry", "check_service", "clear_audit"}:
            source = require_closed_object(payload, required=_COMMON_MUTATION_FIELDS)
            handler: Callable[..., dict[str, Any]] = getattr(self._service, action)
            return handler(
                request_id=source["request_id"],
                expected_state_version=source["expected_state_version"],
            )

        if action == "update_port":
            source = require_closed_object(
                payload,
                required=_COMMON_MUTATION_FIELDS | frozenset({"configured_port"}),
            )
            return self._service.update_port(
                configured_port=source["configured_port"],
                request_id=source["request_id"],
                expected_state_version=source["expected_state_version"],
            )

        if action in {"allow_authorization", "deny_authorization"}:
            source = require_closed_object(
                payload,
                required=_COMMON_MUTATION_FIELDS | frozenset({"authorization_request_id"}),
            )
            return self._service.decide_authorization(
                authorization_request_id=source["authorization_request_id"],
                allow=action == "allow_authorization",
                request_id=source["request_id"],
                expected_state_version=source["expected_state_version"],
            )

        if action == "revoke_client":
            source = require_closed_object(
                payload,
                required=_COMMON_MUTATION_FIELDS | frozenset({"client_id"}),
            )
            return self._service.revoke_client(
                client_id=source["client_id"],
                request_id=source["request_id"],
                expected_state_version=source["expected_state_version"],
            )

        if action == "prepare_reset":
            source = require_closed_object(
                payload,
                required=_COMMON_MUTATION_FIELDS,
                optional=frozenset({"audit_disposition"}),
            )
            return self._service.prepare_reset(
                request_id=source["request_id"],
                expected_state_version=source["expected_state_version"],
                audit_disposition=source.get("audit_disposition", "retain"),
            )

        if action == "confirm_reset":
            source = require_closed_object(
                payload,
                required=_COMMON_MUTATION_FIELDS | frozenset({"reset_id"}),
            )
            native_capability = headers.get(NATIVE_CONFIRMATION_HEADER.casefold(), "")
            return self._service.confirm_reset(
                reset_id=source["reset_id"],
                native_confirmation_capability=native_capability,
                request_id=source["request_id"],
                expected_state_version=source["expected_state_version"],
            )

        if action == "confirm_web_reset":
            if not self._allow_web_reset:
                raise ControlError("DESKTOP_CAPABILITY_REQUIRED", status=428)
            source = require_closed_object(
                payload,
                required=_COMMON_MUTATION_FIELDS
                | frozenset({"reset_id", "confirmation"}),
            )
            return self._service.confirm_web_reset(
                reset_id=source["reset_id"],
                confirmation=source["confirmation"],
                request_id=source["request_id"],
                expected_state_version=source["expected_state_version"],
            )

        raise ControlError("NOT_FOUND", status=404)

    @staticmethod
    def _parse_json_object(body: bytes | str | Mapping[str, Any] | None) -> Mapping[str, Any]:
        if isinstance(body, Mapping):
            if any(not isinstance(key, str) for key in body):
                raise ControlError("INVALID_JSON", status=400)
            return dict(body)

        if body is None:
            raw = b"{}"
        elif isinstance(body, bytes):
            raw = body
        elif isinstance(body, str):
            raw = body.encode("utf-8")
        else:
            raise ControlError("INVALID_JSON", status=400)

        if len(raw) > _JSON_BODY_LIMIT:
            raise ControlError("INVALID_JSON", status=400)
        try:
            text = raw.decode("utf-8")
            value = json.loads(text, object_pairs_hook=ControlApi._closed_pairs)
        except (UnicodeDecodeError, json.JSONDecodeError):
            raise ControlError("INVALID_JSON", status=400) from None
        if not isinstance(value, Mapping):
            raise ControlError("INVALID_JSON", status=400)
        return value

    @staticmethod
    def _closed_pairs(pairs: list[tuple[str, Any]]) -> dict[str, Any]:
        value: dict[str, Any] = {}
        for key, item in pairs:
            if key in value:
                raise ControlError("INVALID_JSON", status=400)
            value[key] = item
        return value

    @staticmethod
    def _require_empty_body(body: bytes | str | Mapping[str, Any] | None) -> None:
        if body is None or body == b"" or body == "":
            return
        raise ControlError("INVALID_REQUEST", status=400)

    @staticmethod
    def _is_json_content_type(value: str) -> bool:
        return value.split(";", 1)[0].strip().casefold() == "application/json"

    @staticmethod
    def _response_headers() -> dict[str, str]:
        return {
            "Content-Type": "application/json; charset=utf-8",
            "Cache-Control": "no-store",
            "Pragma": "no-cache",
            "X-Content-Type-Options": "nosniff",
        }

    @classmethod
    def _success(cls, body: Mapping[str, Any]) -> ControlApiResponse:
        assert_safe_response(body)
        return ControlApiResponse(status=200, headers=cls._response_headers(), body=dict(body))

    @classmethod
    def _error(cls, error: ControlError) -> ControlApiResponse:
        body = {
            "contract_version": CONTROL_CONTRACT_VERSION,
            "error": {
                "code": error.code,
                "message": error.public_message,
                "retryable": error.retryable,
                "current_state_version": error.current_state_version,
            },
        }
        try:
            assert_safe_response(body)
        except ControlError:
            body = {
                "contract_version": CONTROL_CONTRACT_VERSION,
                "error": {
                    "code": "INTERNAL_ERROR",
                    "message": "The local control request could not be completed.",
                    "retryable": False,
                    "current_state_version": None,
                },
            }
        return ControlApiResponse(status=error.status, headers=cls._response_headers(), body=body)
