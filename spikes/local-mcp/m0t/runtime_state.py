from __future__ import annotations

from dataclasses import dataclass, replace
from typing import Literal

from policy_engine import evaluate_secret_transport


ServiceState = Literal["stopped", "starting", "ready", "stopping", "error"]
KnowledgeState = Literal["ready", "degraded", "blocked"]


@dataclass(frozen=True)
class InstanceIdentity:
    os_user: str
    installation_id: str
    runtime_id: str
    release_channel: str
    app_version: str
    instance_id: str
    pid: int
    process_start_time: int
    executable_content_hash: str
    configured_port: int
    lease_epoch: int
    heartbeat_time: int


@dataclass(frozen=True)
class RuntimeState:
    desired_state: str = "disabled"
    service_state: ServiceState = "stopped"
    authorization_state: str = "no_clients"
    activity_state: str = "never"
    knowledge_state: KnowledgeState = "ready"
    audit_state: str = "ready"
    error_code: str | None = None

    def enable(self) -> "RuntimeState":
        return replace(self, desired_state="enabled", service_state="starting", error_code=None)

    def ready(self) -> "RuntimeState":
        if self.desired_state != "enabled" or self.knowledge_state == "blocked":
            return replace(self, service_state="error", error_code="RUNTIME_NOT_READY")
        return replace(self, service_state="ready", error_code=None)

    def port_conflict(self) -> "RuntimeState":
        return replace(self, service_state="error", error_code="PORT_IN_USE")

    def block_knowledge(self, error_code: str) -> "RuntimeState":
        return replace(
            self,
            service_state="error",
            knowledge_state="blocked",
            error_code=error_code,
        )


def same_instance_owner(left: InstanceIdentity, right: InstanceIdentity) -> bool:
    return left == right


def ownership_action(
    current: InstanceIdentity,
    observed: InstanceIdentity,
) -> str:
    if same_instance_owner(current, observed):
        return "reuse"
    if current.pid == observed.pid:
        return "diagnose_do_not_kill"
    return "conflict_do_not_kill"


def simulate_secret_transport(state: dict[str, bool]) -> RuntimeState:
    result = evaluate_secret_transport(state)
    if result["error_code"] == "NONE":
        return RuntimeState(desired_state="enabled", service_state="ready")
    return RuntimeState(
        desired_state="enabled",
        service_state="error",
        knowledge_state="blocked",
        error_code=result["error_code"],
    )
