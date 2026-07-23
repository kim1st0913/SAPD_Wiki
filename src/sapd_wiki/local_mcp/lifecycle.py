from __future__ import annotations

from dataclasses import dataclass, fields
from typing import Literal


PROFILE_PORTS: dict[str, int] = {
    "stable": 18775,
    "beta": 18776,
    "dev": 28775,
}


class LifecycleError(RuntimeError):
    def __init__(self, code: str) -> None:
        super().__init__(code)
        self.code = code


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
    created_at: float
    heartbeat_time: float


_VOLATILE_IDENTITY_FIELDS = frozenset({"heartbeat_time"})


def stable_identity_matches(left: InstanceIdentity, right: InstanceIdentity) -> bool:
    """Compare every stable owner field while ignoring heartbeat freshness."""

    for field in fields(InstanceIdentity):
        if field.name in _VOLATILE_IDENTITY_FIELDS:
            continue
        if getattr(left, field.name) != getattr(right, field.name):
            return False
    return True


OwnershipAction = Literal["reuse", "diagnose_do_not_kill", "conflict_do_not_kill"]


def ownership_action(
    expected: InstanceIdentity,
    observed: InstanceIdentity,
) -> OwnershipAction:
    if stable_identity_matches(expected, observed):
        return "reuse"
    if expected.pid == observed.pid:
        return "diagnose_do_not_kill"
    return "conflict_do_not_kill"


def fixed_profile_port(profile: str) -> int:
    try:
        return PROFILE_PORTS[profile]
    except KeyError as exc:
        raise LifecycleError("PROFILE_UNKNOWN") from exc


def require_fixed_profile_port(profile: str, configured_port: int) -> int:
    expected = fixed_profile_port(profile)
    if configured_port != expected:
        raise LifecycleError("FIXED_PROFILE_PORT_MISMATCH")
    return expected


@dataclass(frozen=True)
class LeaseDecision:
    action: OwnershipAction
    may_terminate_observed_process: bool


def decide_lease_recovery(
    expected: InstanceIdentity,
    observed: InstanceIdentity,
) -> LeaseDecision:
    action = ownership_action(expected, observed)
    return LeaseDecision(
        action=action,
        may_terminate_observed_process=False,
    )

