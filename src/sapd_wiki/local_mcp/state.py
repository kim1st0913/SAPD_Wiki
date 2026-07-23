from __future__ import annotations

from dataclasses import dataclass, replace
from typing import Literal


DesiredState = Literal["disabled", "enabled"]
ServiceState = Literal["stopped", "starting", "ready", "stopping", "error"]
AuthorizationState = Literal[
    "no_clients", "pending", "authorized", "revoked", "error"
]
ActivityState = Literal["never", "idle", "recent"]
KnowledgeState = Literal["ready", "degraded", "blocked"]
AuditState = Literal["disabled", "ready", "degraded"]


@dataclass(frozen=True)
class RuntimeState:
    desired_state: DesiredState = "disabled"
    service_state: ServiceState = "stopped"
    authorization_state: AuthorizationState = "no_clients"
    activity_state: ActivityState = "never"
    knowledge_state: KnowledgeState = "ready"
    audit_state: AuditState = "ready"
    state_version: int = 1
    error_code: str | None = None
    last_success_at: float | None = None
    secret_transport_state: Literal[
        "not_applicable", "ready", "blocked"
    ] = "not_applicable"

    def dimensions(self) -> dict[str, str]:
        return {
            "desired_state": self.desired_state,
            "service_state": self.service_state,
            "authorization_state": self.authorization_state,
            "activity_state": self.activity_state,
            "knowledge_state": self.knowledge_state,
            "audit_state": self.audit_state,
        }

    def transition(self, **changes: object) -> "RuntimeState":
        allowed = {
            "desired_state",
            "service_state",
            "authorization_state",
            "activity_state",
            "knowledge_state",
            "audit_state",
            "error_code",
            "last_success_at",
            "secret_transport_state",
        }
        unknown = set(changes).difference(allowed)
        if unknown:
            raise ValueError(f"unknown runtime state field: {sorted(unknown)}")
        candidate = replace(self, **changes)
        if candidate == self:
            return self
        return replace(candidate, state_version=self.state_version + 1)

    def enable(self) -> "RuntimeState":
        return self.transition(
            desired_state="enabled",
            service_state="starting",
            error_code=None,
        )
    def mark_ready(self) -> "RuntimeState":
        if self.desired_state != "enabled" or self.knowledge_state == "blocked":
            return self.transition(
                service_state="error",
                error_code="RUNTIME_NOT_READY",
            )
        return self.transition(service_state="ready", error_code=None)

    def block_secret_transport(self) -> "RuntimeState":
        return self.transition(
            service_state="error",
            knowledge_state="blocked",
            secret_transport_state="blocked",
            error_code="KEY_PASSPHRASE_IPC_UNSAFE",
        )
