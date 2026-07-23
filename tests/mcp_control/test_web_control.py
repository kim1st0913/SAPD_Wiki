from __future__ import annotations

import unittest

from sapd_wiki.local_mcp.web_control import build_browser_control_api


class BrowserControlTests(unittest.TestCase):
    def setUp(self) -> None:
        self.api = build_browser_control_api(
            expected_host="127.0.0.1:5173",
            expected_origin="http://127.0.0.1:5173",
            session_token="fixture-session-token",
        )
        self.headers = {
            "Host": "127.0.0.1:5173",
            "Origin": "http://127.0.0.1:5173",
            "X-SAPD-Session-Token": "fixture-session-token",
        }

    def test_web_projection_is_readable_and_advertises_no_native_capability(self) -> None:
        response = self.api.dispatch(
            "GET",
            "/api/v1/mcp/control-panel",
            self.headers,
        )
        self.assertEqual(response.status, 200)
        self.assertEqual(response.body["contract_version"], "sapd-mcp-control-v1")
        capabilities = response.body["settings"]["control_capabilities"]
        self.assertFalse(any(capabilities.values()))
        self.assertEqual(response.body["clients"], [])

    def test_reads_require_session_and_mutations_require_desktop(self) -> None:
        no_session = dict(self.headers)
        no_session.pop("X-SAPD-Session-Token")
        denied = self.api.dispatch(
            "GET",
            "/api/v1/mcp/control-panel",
            no_session,
        )
        self.assertEqual(denied.status, 401)

        mutation_headers = {
            **self.headers,
            "Content-Type": "application/json",
        }
        mutation = self.api.dispatch(
            "POST",
            "/api/v1/mcp/actions/start",
            mutation_headers,
            {
                "request_id": "request-web-0001",
                "expected_state_version": 0,
            },
        )
        self.assertEqual(mutation.status, 428)
        self.assertEqual(
            mutation.body["error"]["code"],
            "DESKTOP_CAPABILITY_REQUIRED",
        )

    def test_dev_projection_can_start_and_stop_only_the_synthetic_service(self) -> None:
        api = build_browser_control_api(
            expected_host="127.0.0.1:5173",
            expected_origin="http://127.0.0.1:5173",
            session_token="fixture-session-token",
            allow_synthetic_service_control=True,
        )
        mutation_headers = {
            **self.headers,
            "Content-Type": "application/json",
        }
        start = api.dispatch(
            "POST",
            "/api/v1/mcp/actions/start",
            mutation_headers,
            {
                "request_id": "request-start-dev-0001",
                "expected_state_version": 0,
            },
        )
        self.assertEqual(start.status, 200)
        started = api.dispatch(
            "GET",
            "/api/v1/mcp/control-panel",
            self.headers,
        )
        self.assertEqual(started.body["status"]["service_state"], "ready")
        self.assertTrue(started.body["settings"]["enabled"])
        self.assertTrue(
            started.body["settings"]["control_capabilities"]["service_control"]
        )
        self.assertFalse(
            started.body["settings"]["control_capabilities"][
                "native_reset_confirmation"
            ]
        )

        stop = api.dispatch(
            "POST",
            "/api/v1/mcp/actions/stop",
            mutation_headers,
            {
                "request_id": "request-stop-dev-0001",
                "expected_state_version": 1,
            },
        )
        self.assertEqual(stop.status, 200)
        stopped = api.dispatch(
            "GET",
            "/api/v1/mcp/control-panel",
            self.headers,
        )
        self.assertEqual(stopped.body["status"]["service_state"], "stopped")
        self.assertFalse(stopped.body["settings"]["enabled"])


if __name__ == "__main__":
    unittest.main()
