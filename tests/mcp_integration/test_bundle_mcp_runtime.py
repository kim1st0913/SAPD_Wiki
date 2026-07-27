from __future__ import annotations

import importlib.util
import io
import json
import sys
import threading
import unittest
import urllib.request
from unittest import mock
from http.server import ThreadingHTTPServer
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]


class _Logger:
    @staticmethod
    def write(_level: str, _message: str, **_context: object) -> None:
        return None


class _Runtime:
    logger = _Logger()


class _ControlResponse:
    status = 200
    headers = {"Content-Type": "application/json; charset=utf-8"}

    @staticmethod
    def json_bytes() -> bytes:
        return json.dumps(
            {
                "contract_version": "sapd-mcp-control-v1",
                "data": {"service_state": "stopped"},
            }
        ).encode("utf-8")


class _ControlApi:
    def __init__(self) -> None:
        self.calls: list[tuple[str, str]] = []

    def dispatch(
        self,
        method: str,
        path: str,
        _headers: dict[str, str],
        _body: bytes | None,
        _query: dict[str, list[str]],
    ) -> _ControlResponse:
        self.calls.append((method, path))
        return _ControlResponse()


class BundleMcpRuntimeTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        scripts_dir = ROOT / "scripts"
        sys.path.insert(0, str(scripts_dir))
        try:
            spec = importlib.util.spec_from_file_location(
                "sapd_bundle_mcp_runtime",
                scripts_dir / "run_local_server.py",
            )
            if spec is None or spec.loader is None:
                raise RuntimeError("bundle server module is unavailable")
            cls.bundle_server = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(cls.bundle_server)
        finally:
            sys.path.remove(str(scripts_dir))

    def test_bundle_handler_forwards_mcp_control_requests(self) -> None:
        control_api = _ControlApi()
        server = ThreadingHTTPServer(
            ("127.0.0.1", 0),
            self.bundle_server.build_handler(
                _Runtime(),
                {"port": 0},
                "bundle-mcp-session",
                mcp_control_api=control_api,
            ),
        )
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        try:
            url = (
                f"http://127.0.0.1:{server.server_address[1]}"
                "/api/v1/mcp/control-panel"
            )
            with urllib.request.urlopen(url, timeout=5) as response:
                payload = json.loads(response.read())
            self.assertEqual(
                payload["contract_version"],
                "sapd-mcp-control-v1",
            )
            self.assertEqual(
                control_api.calls,
                [("GET", "/api/v1/mcp/control-panel")],
            )
        finally:
            server.shutdown()
            server.server_close()
            thread.join(timeout=5)

    def test_electron_bootstrap_is_closed_bounded_and_not_environment_based(self) -> None:
        capability = "A" * 43
        stream = io.TextIOWrapper(
            io.BytesIO(
                json.dumps(
                    {
                        "contract": "sapd-electron-bootstrap-v1",
                        "native_confirmation_capability": capability,
                    }
                ).encode("utf-8")
                + b"\n"
            ),
            encoding="utf-8",
        )
        with mock.patch.object(sys, "stdin", stream):
            self.assertEqual(
                self.bundle_server.read_electron_bootstrap(),
                capability,
            )

        duplicate = io.TextIOWrapper(
            io.BytesIO(
                (
                    '{"contract":"sapd-electron-bootstrap-v1",'
                    '"native_confirmation_capability":"'
                    + capability
                    + '","native_confirmation_capability":"'
                    + capability
                    + '"}\n'
                ).encode("utf-8")
            ),
            encoding="utf-8",
        )
        with mock.patch.object(sys, "stdin", duplicate):
            with self.assertRaisesRegex(ValueError, "duplicate bootstrap key"):
                self.bundle_server.read_electron_bootstrap()


if __name__ == "__main__":
    unittest.main()
