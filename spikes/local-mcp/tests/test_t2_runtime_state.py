from __future__ import annotations

import json
import os
import sys
import tempfile
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[3]
M0T = ROOT / "spikes/local-mcp/m0t"
sys.path.insert(0, str(M0T))

from runtime_state import (  # noqa: E402
    InstanceIdentity,
    RuntimeState,
    ownership_action,
    simulate_secret_transport,
)
from test_certificate import generate_test_certificate  # noqa: E402


def identity(**updates: object) -> InstanceIdentity:
    values = {
        "os_user": "fixture-user",
        "installation_id": "fixture-installation",
        "runtime_id": "fixture-runtime",
        "release_channel": "dev",
        "app_version": "0.0-fixture",
        "instance_id": "fixture-instance",
        "pid": 101,
        "process_start_time": 1000,
        "executable_content_hash": "sha256:" + ("a" * 64),
        "configured_port": 28775,
        "lease_epoch": 1,
        "heartbeat_time": 1001,
    }
    values.update(updates)
    return InstanceIdentity(**values)


class T2RuntimeStateTests(unittest.TestCase):
    def test_enable_ready_and_port_conflict(self) -> None:
        state = RuntimeState()
        self.assertEqual(state.enable().service_state, "starting")
        self.assertEqual(state.enable().ready().service_state, "ready")
        conflict = state.enable().port_conflict()
        self.assertEqual(conflict.service_state, "error")
        self.assertEqual(conflict.error_code, "PORT_IN_USE")

    def test_owner_requires_full_identity_and_never_kills_ambiguously(self) -> None:
        current = identity()
        self.assertEqual(ownership_action(current, identity()), "reuse")
        self.assertEqual(
            ownership_action(current, identity(process_start_time=999)),
            "diagnose_do_not_kill",
        )
        self.assertEqual(
            ownership_action(current, identity(pid=202)),
            "conflict_do_not_kill",
        )

    def test_three_unsafe_ipc_fixtures_block_runtime(self) -> None:
        fixtures = json.loads(
            (
                ROOT / "tests/fixtures/mcp/v1/cases/t0-cases.json"
            ).read_text(encoding="utf-8")
        )
        unsafe = [
            fixture
            for fixture in fixtures
            if fixture["case_class"] == "runtime-secret-transport"
        ]
        self.assertEqual(len(unsafe), 3)
        for fixture in unsafe:
            state = simulate_secret_transport(fixture["input"])
            self.assertEqual(state.service_state, "error")
            self.assertEqual(state.knowledge_state, "blocked")
            self.assertEqual(state.error_code, "KEY_PASSPHRASE_IPC_UNSAFE")

    def test_safe_secret_transport_state_requires_all_checks(self) -> None:
        state = simulate_secret_transport(
            {
                "authenticated": True,
                "instance_bound": True,
                "peer_user_verified": True,
                "peer_process_verified": True,
                "minimum_acl": True,
            }
        )
        self.assertEqual(state.service_state, "ready")
        self.assertEqual(state.knowledge_state, "ready")

    def test_t3_real_state_flags_remain_false(self) -> None:
        profile = json.loads(
            (
                ROOT
                / "docs/01-architecture/contracts/mcp/v1/profiles/MCP-RUNTIME-STATE-v1.contract.json"
            ).read_text(encoding="utf-8")
        )
        self.assertEqual(
            profile["t3_authorization"],
            {
                "real_client_config": False,
                "system_trust_write": False,
                "real_oauth_state": False,
            },
        )

    def test_encrypted_pkcs8_test_key_and_explicit_ca_context(self) -> None:
        with tempfile.TemporaryDirectory(prefix="sapd-m0t-t2-cert-") as raw:
            root = Path(raw).resolve()
            bundle = generate_test_certificate(root)
            key_bytes = bundle.encrypted_private_key_path.read_bytes()
            self.assertIn(b"BEGIN ENCRYPTED PRIVATE KEY", key_bytes)
            self.assertNotIn(b"BEGIN PRIVATE KEY", key_bytes)
            self.assertEqual(bundle.encrypted_private_key_path.stat().st_mode & 0o777, 0o600)
            self.assertIsNotNone(bundle.server_context())
            self.assertIsNotNone(bundle.client_context())
            bundle.clear_passphrase()
            self.assertTrue(all(value == 0 for value in bundle.passphrase))
            self.assertNotIn("PASSPHRASE", os.environ)


if __name__ == "__main__":
    unittest.main()
