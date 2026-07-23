from __future__ import annotations

import unittest

from sapd_wiki.local_mcp.lifecycle import (
    InstanceIdentity,
    LifecycleError,
    decide_lease_recovery,
    fixed_profile_port,
    stable_identity_matches,
)
from sapd_wiki.local_mcp.state import RuntimeState


def identity(**changes: object) -> InstanceIdentity:
    values: dict[str, object] = {
        "os_user": "fixture-user",
        "installation_id": "installation-1",
        "runtime_id": "runtime-1",
        "release_channel": "dev",
        "app_version": "1.0.0",
        "instance_id": "instance-1",
        "pid": 101,
        "process_start_time": 1000,
        "executable_content_hash": "a" * 64,
        "configured_port": 28775,
        "lease_epoch": 4,
        "created_at": 1000.0,
        "heartbeat_time": 1001.0,
    }
    values.update(changes)
    return InstanceIdentity(**values)


class RuntimeStateTests(unittest.TestCase):
    def test_six_dimensions_and_monotonic_state_version(self) -> None:
        initial = RuntimeState()
        self.assertEqual(
            set(initial.dimensions()),
            {
                "desired_state",
                "service_state",
                "authorization_state",
                "activity_state",
                "knowledge_state",
                "audit_state",
            },
        )
        enabled = initial.enable()
        self.assertEqual(enabled.state_version, initial.state_version + 1)
        unchanged = enabled.transition(
            desired_state=enabled.desired_state,
            service_state=enabled.service_state,
        )
        self.assertEqual(unchanged.state_version, enabled.state_version)

    def test_unsafe_ipc_blocks_service_and_knowledge(self) -> None:
        blocked = RuntimeState().enable().block_secret_transport()
        self.assertEqual(blocked.service_state, "error")
        self.assertEqual(blocked.knowledge_state, "blocked")
        self.assertEqual(blocked.secret_transport_state, "blocked")
        self.assertEqual(blocked.error_code, "KEY_PASSPHRASE_IPC_UNSAFE")


class LifecycleTests(unittest.TestCase):
    def test_owner_ignores_heartbeat_freshness_only(self) -> None:
        expected = identity(heartbeat_time=1001.0)
        stale = identity(heartbeat_time=1.0)
        self.assertTrue(stable_identity_matches(expected, stale))
        decision = decide_lease_recovery(expected, stale)
        self.assertEqual(decision.action, "reuse")
        self.assertFalse(decision.may_terminate_observed_process)

        pid_reuse = identity(process_start_time=999)
        self.assertFalse(stable_identity_matches(expected, pid_reuse))
        ambiguous = decide_lease_recovery(expected, pid_reuse)
        self.assertEqual(ambiguous.action, "diagnose_do_not_kill")
        self.assertFalse(ambiguous.may_terminate_observed_process)

        different = decide_lease_recovery(expected, identity(pid=202))
        self.assertEqual(different.action, "conflict_do_not_kill")
        self.assertFalse(different.may_terminate_observed_process)

    def test_fixed_ports_have_no_random_fallback(self) -> None:
        self.assertEqual(fixed_profile_port("stable"), 18775)
        self.assertEqual(fixed_profile_port("beta"), 18776)
        self.assertEqual(fixed_profile_port("dev"), 28775)
        with self.assertRaises(LifecycleError) as context:
            fixed_profile_port("random")
        self.assertEqual(context.exception.code, "PROFILE_UNKNOWN")


if __name__ == "__main__":
    unittest.main()

