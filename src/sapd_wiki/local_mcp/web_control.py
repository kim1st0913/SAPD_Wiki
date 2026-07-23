"""Browser-safe MCP control projection for Web development without a desktop bridge."""

from __future__ import annotations

import secrets
from copy import deepcopy
from threading import RLock
from typing import Any, Mapping

from .control_api import ControlApi
from .control_models import GatewayActionError
from .control_service import ControlService


class BrowserOnlySupervisorGateway:
    """Expose browser state and optionally simulate service control in dev."""

    def __init__(
        self,
        *,
        release_channel: str = "dev",
        configured_port: int = 28775,
        allow_synthetic_service_control: bool = False,
    ) -> None:
        self._allow_synthetic_service_control = allow_synthetic_service_control
        self._lock = RLock()
        self._snapshot = {
            "state_version": 0,
            "status": {
                "desired_state": "disabled",
                "service_state": "stopped",
                "authorization_state": "no_clients",
                "activity_state": "never",
                "knowledge_state": "ready",
                "audit_state": "disabled",
                "last_success_at": None,
                "recoverable_error": None,
            },
            "settings": {
                "enabled": False,
                "configured_port": configured_port,
                "release_channel": release_channel,
                "canonical_resource": f"https://127.0.0.1:{configured_port}/mcp",
                "control_capabilities": {
                    "service_control": allow_synthetic_service_control,
                    "client_revocation": False,
                    "audit_clear": False,
                    "native_reset_confirmation": False,
                },
            },
            "clients": [],
            "audit": {
                "enabled": False,
                "state": "disabled",
                "retention_days": 30,
                "retention_bytes": 20 * 1024 * 1024,
                "event_count": 0,
                "last_event_at": None,
            },
            "diagnostics": {
                "overall_state": "unknown",
                "last_checked_at": None,
                "checks": [
                    {
                        "check_id": "desktop_bridge",
                        "status": "unknown",
                        "error_code": "DESKTOP_CAPABILITY_REQUIRED",
                        "recovery_action": "open_desktop_app",
                    }
                ],
            },
        }

    def read_snapshot(self) -> Mapping[str, Any]:
        with self._lock:
            return deepcopy(self._snapshot)

    def _mutate_service(
        self,
        *,
        expected_state_version: int,
        desired_state: str,
        service_state: str,
    ) -> Mapping[str, Any]:
        if not self._allow_synthetic_service_control:
            raise GatewayActionError("DESKTOP_CAPABILITY_REQUIRED")
        with self._lock:
            current_version = self._snapshot["state_version"]
            if expected_state_version != current_version:
                raise GatewayActionError(
                    "STATE_VERSION_CONFLICT",
                    current_state_version=current_version,
                )
            self._snapshot["state_version"] += 1
            self._snapshot["status"]["desired_state"] = desired_state
            self._snapshot["status"]["service_state"] = service_state
            self._snapshot["status"]["recoverable_error"] = None
            self._snapshot["settings"]["enabled"] = desired_state == "enabled"
            self._snapshot["diagnostics"] = {
                "overall_state": "ready",
                "last_checked_at": None,
                "checks": [
                    {
                        "check_id": "synthetic_runtime",
                        "status": "pass",
                        "error_code": None,
                        "recovery_action": None,
                    }
                ],
            }
            return {
                "state_version": self._snapshot["state_version"],
                "result": "completed",
                "changed": True,
            }

    def start_service(
        self,
        *,
        request_id: str,
        expected_state_version: int,
    ) -> Mapping[str, Any]:
        del request_id
        return self._mutate_service(
            expected_state_version=expected_state_version,
            desired_state="enabled",
            service_state="ready",
        )

    def stop_service(
        self,
        *,
        request_id: str,
        expected_state_version: int,
    ) -> Mapping[str, Any]:
        del request_id
        return self._mutate_service(
            expected_state_version=expected_state_version,
            desired_state="disabled",
            service_state="stopped",
        )

    def retry_service(
        self,
        *,
        request_id: str,
        expected_state_version: int,
    ) -> Mapping[str, Any]:
        del request_id
        return self._mutate_service(
            expected_state_version=expected_state_version,
            desired_state="enabled",
            service_state="ready",
        )

    @staticmethod
    def _desktop_required(**_kwargs: Any) -> Mapping[str, Any]:
        raise GatewayActionError("DESKTOP_CAPABILITY_REQUIRED")

    revoke_client = _desktop_required
    clear_audit = _desktop_required
    prepare_reset = _desktop_required
    confirm_reset = _desktop_required


def build_browser_control_api(
    *,
    expected_host: str,
    expected_origin: str,
    session_token: str,
    release_channel: str = "dev",
    configured_port: int = 28775,
    allow_synthetic_service_control: bool = False,
) -> ControlApi:
    """Create a Web control surface with native operations blocked."""

    if not session_token:
        raise ValueError("session_token is required")
    gateway = BrowserOnlySupervisorGateway(
        release_channel=release_channel,
        configured_port=configured_port,
        allow_synthetic_service_control=allow_synthetic_service_control,
    )
    service = ControlService(gateway)
    return ControlApi(
        service,
        expected_host=expected_host,
        expected_origin=expected_origin,
        session_verifier=lambda supplied: secrets.compare_digest(
            supplied,
            session_token,
        ),
    )
