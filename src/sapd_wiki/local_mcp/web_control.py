"""Browser-safe MCP control projection for Web development without a desktop bridge."""

from __future__ import annotations

import secrets
from copy import deepcopy
from typing import Any, Mapping

from .control_api import ControlApi
from .control_models import GatewayActionError
from .control_service import ControlService


class BrowserOnlySupervisorGateway:
    """Expose honest read state and reject every native mutation fail-closed."""

    def __init__(self, *, release_channel: str = "dev", configured_port: int = 28775) -> None:
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
                    "service_control": False,
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
        return deepcopy(self._snapshot)

    @staticmethod
    def _desktop_required(**_kwargs: Any) -> Mapping[str, Any]:
        raise GatewayActionError("DESKTOP_CAPABILITY_REQUIRED")

    start_service = _desktop_required
    stop_service = _desktop_required
    retry_service = _desktop_required
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
) -> ControlApi:
    """Create a read-capable, mutation-blocked Web control surface."""

    if not session_token:
        raise ValueError("session_token is required")
    gateway = BrowserOnlySupervisorGateway(
        release_channel=release_channel,
        configured_port=configured_port,
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
