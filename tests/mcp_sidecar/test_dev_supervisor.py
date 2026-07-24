from __future__ import annotations

import http.client
import socket
import ssl
import tempfile
import unittest
from pathlib import Path

from sapd_wiki.local_mcp.control_models import GatewayActionError
from sapd_wiki.local_mcp.dev_supervisor import DevSidecarSupervisor


def free_port() -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as candidate:
        candidate.bind(("127.0.0.1", 0))
        return int(candidate.getsockname()[1])


class DevSupervisorTests(unittest.TestCase):
    def test_real_https_process_starts_stops_and_cleans_owned_root(self) -> None:
        port = free_port()
        supervisor = DevSidecarSupervisor(configured_port=port)
        root = supervisor.runtime_root
        try:
            initial = supervisor.read_snapshot()
            started = supervisor.start_service(
                request_id="request-start-real-0001",
                expected_state_version=initial["state_version"],
            )
            snapshot = supervisor.read_snapshot()
            self.assertEqual(snapshot["status"]["service_state"], "ready")
            self.assertTrue(started["changed"])
            self.assertIsNotNone(supervisor.process)
            self.assertIsNone(supervisor.process.poll())

            context = ssl.create_default_context(
                ssl.Purpose.SERVER_AUTH,
                cafile=supervisor.ca_path,
            )
            connection = http.client.HTTPSConnection(
                "127.0.0.1",
                port,
                timeout=2,
                context=context,
            )
            connection.request("GET", "/.well-known/oauth-protected-resource/mcp")
            response = connection.getresponse()
            payload = response.read()
            connection.close()
            self.assertEqual(response.status, 200, payload)

            repeated = supervisor.start_service(
                request_id="request-start-real-0002",
                expected_state_version=snapshot["state_version"],
            )
            self.assertFalse(repeated["changed"])

            stopped = supervisor.stop_service(
                request_id="request-stop-real-0001",
                expected_state_version=supervisor.read_snapshot()["state_version"],
            )
            self.assertTrue(stopped["changed"])
            self.assertEqual(
                supervisor.read_snapshot()["status"]["service_state"],
                "stopped",
            )
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as probe:
                probe.settimeout(0.4)
                self.assertNotEqual(probe.connect_ex(("127.0.0.1", port)), 0)
        finally:
            supervisor.close()
        self.assertFalse(root.exists())

    def test_external_port_conflict_is_reported_and_listener_is_not_killed(self) -> None:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as external:
            external.bind(("127.0.0.1", 0))
            external.listen(1)
            port = int(external.getsockname()[1])
            supervisor = DevSidecarSupervisor(configured_port=port)
            try:
                with self.assertRaises(GatewayActionError):
                    supervisor.start_service(
                        request_id="request-port-conflict",
                        expected_state_version=0,
                    )
                self.assertEqual(external.getsockname()[1], port)
                self.assertEqual(
                    supervisor.read_snapshot()["status"]["recoverable_error"]["code"],
                    "PORT_IN_USE",
                )
                replacement = free_port()
                recovered = supervisor.update_port(
                    configured_port=replacement,
                    request_id="request-port-conflict-recovery",
                    expected_state_version=supervisor.read_snapshot()["state_version"],
                )
                self.assertTrue(recovered["changed"])
                self.assertEqual(
                    supervisor.read_snapshot()["status"]["service_state"],
                    "stopped",
                )
            finally:
                supervisor.close()

    def test_reserved_stable_preview_port_is_rejected(self) -> None:
        with self.assertRaisesRegex(ValueError, "reserved"):
            DevSidecarSupervisor(configured_port=5173)

    def test_port_update_requires_stopped_service(self) -> None:
        first = free_port()
        second = free_port()
        supervisor = DevSidecarSupervisor(configured_port=first)
        try:
            changed = supervisor.update_port(
                configured_port=second,
                request_id="request-update-port",
                expected_state_version=0,
            )
            self.assertTrue(changed["changed"])
            self.assertEqual(
                supervisor.read_snapshot()["settings"]["canonical_resource"],
                f"https://127.0.0.1:{second}/mcp",
            )
        finally:
            supervisor.close()

    def test_web_reset_is_two_step_stops_service_and_rotates_secrets(self) -> None:
        port = free_port()
        supervisor = DevSidecarSupervisor(configured_port=port)
        try:
            supervisor.start_service(
                request_id="request-start-before-reset",
                expected_state_version=0,
            )
            verifier_path = supervisor.runtime_root / "verifier-key.bin"
            original_verifier = verifier_path.read_bytes()
            prepared = supervisor.prepare_reset(
                audit_disposition="clear",
                request_id="request-prepare-web-reset",
                expected_state_version=supervisor.read_snapshot()["state_version"],
            )
            self.assertEqual(prepared["confirmation_mode"], "web")
            confirmed = supervisor.confirm_web_reset(
                reset_id=prepared["reset_id"],
                request_id="request-confirm-web-reset",
                expected_state_version=prepared["state_version"],
            )
            self.assertTrue(confirmed["changed"])
            self.assertEqual(
                supervisor.read_snapshot()["status"]["service_state"],
                "stopped",
            )
            self.assertFalse(supervisor.ca_path.exists())
            self.assertNotEqual(verifier_path.read_bytes(), original_verifier)
            with self.assertRaises(GatewayActionError):
                supervisor.confirm_web_reset(
                    reset_id=prepared["reset_id"],
                    request_id="request-confirm-web-reset-replay",
                    expected_state_version=confirmed["state_version"],
                )
        finally:
            supervisor.close()


if __name__ == "__main__":
    unittest.main()
