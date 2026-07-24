from __future__ import annotations

import json
import os
import signal
import socket
import subprocess
import tempfile
import time
import unittest
import urllib.error
import urllib.request
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
PYTHON = ROOT / ".venv-local-mcp-web" / "bin" / "python"


def free_port() -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as candidate:
        candidate.bind(("127.0.0.1", 0))
        return int(candidate.getsockname()[1])


def request_json(
    url: str,
    *,
    method: str = "GET",
    headers: dict[str, str] | None = None,
    payload: dict[str, object] | None = None,
) -> dict[str, object]:
    body = None if payload is None else json.dumps(payload).encode("utf-8")
    request = urllib.request.Request(url, data=body, method=method, headers=headers or {})
    with urllib.request.urlopen(request, timeout=2) as response:
        return json.loads(response.read().decode("utf-8"))


class GracefulWebShutdownTests(unittest.TestCase):
    def test_sigterm_stops_owned_sidecar_and_removes_temporary_runtime(self) -> None:
        self.assertTrue(PYTHON.is_file(), "isolated MCP Python runtime is required")
        web_port = free_port()
        mcp_port = free_port()
        existing_roots = set(Path(tempfile.gettempdir()).glob("sapd-mcp-web-*"))
        process = subprocess.Popen(
            [
                str(PYTHON),
                "-m",
                "sapd_wiki.cli",
                "serve",
                "--host",
                "127.0.0.1",
                "--port",
                str(web_port),
                "--runtime-label",
                "dev",
                "--ephemeral-user-state",
                "--mcp-port",
                str(mcp_port),
                "--mcp-python",
                str(PYTHON),
            ],
            cwd=ROOT,
            stdin=subprocess.DEVNULL,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            close_fds=True,
        )
        try:
            health_url = f"http://127.0.0.1:{web_port}/api/v1/health"
            deadline = time.monotonic() + 10
            health: dict[str, object] | None = None
            while time.monotonic() < deadline:
                try:
                    health = request_json(health_url)
                    break
                except (OSError, urllib.error.URLError):
                    time.sleep(0.05)
            self.assertIsNotNone(health, "Web development server did not start")
            token = str(health["data"]["auth"]["session_token"])
            control_url = f"http://127.0.0.1:{web_port}/api/v1/mcp/control-panel"
            snapshot = request_json(
                control_url,
                headers={"X-SAPD-Session-Token": token},
            )
            prepared = request_json(
                f"http://127.0.0.1:{web_port}/api/v1/mcp/certificate/actions/prepare",
                method="POST",
                headers={
                    "Content-Type": "application/json",
                    "Origin": f"http://127.0.0.1:{web_port}",
                    "X-SAPD-Session-Token": token,
                },
                payload={
                    "request_id": "request-graceful-certificate-prepare-0001",
                    "expected_state_version": snapshot["state_version"],
                    "action": "certificate_provision",
                },
            )
            confirmed = request_json(
                f"http://127.0.0.1:{web_port}/api/v1/mcp/certificate/actions/confirm",
                method="POST",
                headers={
                    "Content-Type": "application/json",
                    "Origin": f"http://127.0.0.1:{web_port}",
                    "X-SAPD-Session-Token": token,
                },
                payload={
                    "request_id": "request-graceful-certificate-confirm-0001",
                    "expected_state_version": prepared["state_version"],
                    "confirmation_id": prepared["certificate_confirmation"][
                        "confirmation_id"
                    ],
                },
            )
            current = request_json(
                control_url,
                headers={"X-SAPD-Session-Token": token},
            )
            request_json(
                f"http://127.0.0.1:{web_port}/api/v1/mcp/actions/start",
                method="POST",
                headers={
                    "Content-Type": "application/json",
                    "Origin": f"http://127.0.0.1:{web_port}",
                    "X-SAPD-Session-Token": token,
                },
                payload={
                    "request_id": "request-graceful-shutdown-0001",
                    "expected_state_version": current["state_version"],
                },
            )
            with socket.create_connection(("127.0.0.1", mcp_port), timeout=2):
                pass

            os.kill(process.pid, signal.SIGTERM)
            process.wait(timeout=10)

            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as probe:
                probe.settimeout(0.5)
                self.assertNotEqual(probe.connect_ex(("127.0.0.1", mcp_port)), 0)
            remaining_roots = set(Path(tempfile.gettempdir()).glob("sapd-mcp-web-*"))
            self.assertEqual(remaining_roots - existing_roots, set())
        finally:
            if process.poll() is None:
                process.terminate()
                process.wait(timeout=10)


if __name__ == "__main__":
    unittest.main()
