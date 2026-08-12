from __future__ import annotations

import importlib.util
import io
import json
import sys
import threading
import unittest
import urllib.request
from urllib.error import HTTPError
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

    @staticmethod
    def license_status() -> dict[str, object]:
        return {"state": "open"}


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


class _ProjectionManifestError(RuntimeError):
    pass


class _Batch1ProjectionService:
    def capability_catalog(self) -> dict[str, object]:
        return {"data": {"package_type": "capability-catalog"}}

    def capability_view(
        self,
        *,
        object_type: str,
        object_id: str,
        code: str,
    ) -> dict[str, object]:
        if object_id == "missing":
            raise KeyError(f"{object_type}:{object_id}")
        return {"data": {"selected": {"type": object_type, "id": object_id, "code": code}}}

    def locate_capability(self, **identity: str) -> dict[str, object]:
        return {"data": {"identity": identity}}

    def maintenance_index(self) -> dict[str, object]:
        return {"data": {"package_type": "maintenance-index"}}

    def maintenance_section(self, section: str) -> dict[str, object]:
        if section == "missing":
            raise KeyError(section)
        return {"data": {"section": section}}

    def shared_lookups(self) -> dict[str, object]:
        return {"data": {"package_type": "shared-lookups"}}


class _ProjectionApi:
    ProjectionManifestError = _ProjectionManifestError

    def __init__(self, *, identity_available: bool = True) -> None:
        self.identity_available = identity_available
        self.service = _Batch1ProjectionService()
        self.data_package_reads = 0

    @staticmethod
    def create_envelope(data: object) -> dict[str, object]:
        return {"data": data, "warnings": []}

    @staticmethod
    def capability_focus_projection_response(
        query: dict[str, list[str]],
    ) -> dict[str, object]:
        return {"data": {"query": query}}

    def _runtime_batch1_projection(self) -> _Batch1ProjectionService:
        if not self.identity_available:
            raise self.ProjectionManifestError("projection manifest is unavailable")
        return self.service

    def read_data_package(self, _name: str) -> object:
        self.data_package_reads += 1
        raise AssertionError("Batch 1 projection routes must not read data packages")


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

    def request_with_projection_api(
        self,
        projection_api: _ProjectionApi,
        path: str,
    ) -> tuple[int, dict[str, object]]:
        state = {"port": 0}
        with mock.patch.object(self.bundle_server, "projection_api", projection_api):
            server = ThreadingHTTPServer(
                ("127.0.0.1", 0),
                self.bundle_server.build_handler(
                    _Runtime(),
                    state,
                    "bundle-projection-session",
                ),
            )
            state["port"] = int(server.server_address[1])
            thread = threading.Thread(target=server.serve_forever, daemon=True)
            thread.start()
            try:
                url = f"http://127.0.0.1:{server.server_address[1]}{path}"
                try:
                    with urllib.request.urlopen(url, timeout=5) as response:
                        return response.status, json.loads(response.read())
                except HTTPError as error:
                    try:
                        return error.code, json.loads(error.read())
                    finally:
                        error.close()
            finally:
                server.shutdown()
                server.server_close()
                thread.join(timeout=5)

    def test_bundle_handler_dispatches_batch1_projection_routes_without_json_fallback(
        self,
    ) -> None:
        projection_api = _ProjectionApi()
        cases = {
            "/api/v1/projections/capability-catalog": "capability-catalog",
            "/api/v1/projections/maintenance": "maintenance-index",
            "/api/v1/projections/maintenance/services": "services",
            "/api/v1/projections/shared-lookups": "shared-lookups",
        }
        for path, expected in cases.items():
            with self.subTest(path=path):
                status, payload = self.request_with_projection_api(
                    projection_api,
                    path,
                )
                self.assertEqual(status, 200)
                self.assertIn(expected, json.dumps(payload, ensure_ascii=False))
        self.assertEqual(projection_api.data_package_reads, 0)

    def test_bundle_handler_preserves_batch1_projection_error_contracts(self) -> None:
        projection_api = _ProjectionApi()
        cases = (
            (
                "/api/v1/projections/capability-view?"
                "object_type=capability_focus&object_id=missing",
                404,
                "not_found",
            ),
            ("/api/v1/projections/maintenance/missing", 404, "not_found"),
        )
        for path, expected_status, expected_error in cases:
            with self.subTest(path=path):
                status, payload = self.request_with_projection_api(
                    projection_api,
                    path,
                )
                self.assertEqual(status, expected_status)
                self.assertEqual(payload["data"]["error"], expected_error)
        self.assertEqual(projection_api.data_package_reads, 0)

        unavailable_api = _ProjectionApi(identity_available=False)
        status, payload = self.request_with_projection_api(
            unavailable_api,
            "/api/v1/projections/capability-catalog",
        )
        self.assertEqual(status, 503)
        self.assertEqual(
            payload["data"]["error"],
            "projection_identity_unavailable",
        )
        self.assertEqual(unavailable_api.data_package_reads, 0)

    def test_bundle_health_preserves_legacy_fields_and_projects_runtime_data(
        self,
    ) -> None:
        state = {"port": 0}
        with mock.patch.object(self.bundle_server, "projection_api", None):
            server = ThreadingHTTPServer(
                ("127.0.0.1", 0),
                self.bundle_server.build_handler(
                    _Runtime(),
                    state,
                    "bundle-health-session",
                    mcp_runtime_id="runtime-windows-health-test",
                ),
            )
            state["port"] = int(server.server_address[1])
            thread = threading.Thread(target=server.serve_forever, daemon=True)
            thread.start()
            try:
                url = (
                    f"http://127.0.0.1:{server.server_address[1]}"
                    "/api/v1/health"
                )
                with urllib.request.urlopen(url, timeout=5) as response:
                    payload = json.loads(response.read())
                self.assertTrue(payload["ok"])
                self.assertEqual(payload["data"]["status"], "ok")
                self.assertEqual(
                    payload["data"]["runtime"]["runtime_id"],
                    "runtime-windows-health-test",
                )
                self.assertEqual(
                    payload["data"]["auth"]["session_token"],
                    "bundle-health-session",
                )
                self.assertEqual(payload["auth"], payload["data"]["auth"])
                self.assertEqual(payload["license"], payload["data"]["license"])
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
