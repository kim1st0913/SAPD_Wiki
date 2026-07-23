from __future__ import annotations

import json
import socket
import sys
import tempfile
import time
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[3]
M0T = ROOT / "spikes/local-mcp/m0t"
sys.path.insert(0, str(M0T))

from build_synthetic_base import build_synthetic_base  # noqa: E402
from oauth_harness import OAuthHarness  # noqa: E402
from protocol_harness import (  # noqa: E402
    HOST,
    PORT,
    PROTOCOL_VERSION,
    HarnessStartError,
    ProtocolHarness,
    https_json_request,
    port_is_closed,
)
from test_certificate import generate_test_certificate  # noqa: E402


class T2TransportTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        if not port_is_closed():
            raise RuntimeError("fixed T2 port 28775 must be free before test")
        cls.temp = tempfile.TemporaryDirectory(prefix="sapd-m0t-t2-transport-")
        cls.test_root = Path(cls.temp.name).resolve()
        cls.base = cls.test_root / "synthetic-base.sqlite3"
        build_synthetic_base(cls.test_root, cls.base)
        cert_root = cls.test_root / "certs"
        cert_root.mkdir()
        cls.bundle = generate_test_certificate(cert_root)
        cls.client_context = cls.bundle.client_context()
        cls.oauth = OAuthHarness()
        cls.grant = cls.oauth.issue_test_grant()
        cls.harness = ProtocolHarness(
            test_root=cls.test_root,
            synthetic_base=cls.base,
            certificate=cls.bundle,
            oauth=cls.oauth,
        )
        cls.harness.start()

    @classmethod
    def tearDownClass(cls) -> None:
        cls.harness.stop()
        cls.temp.cleanup()
        if not port_is_closed():
            raise RuntimeError("fixed T2 port was not released")

    def request(
        self,
        method: str,
        path: str,
        *,
        payload: dict[str, object] | None = None,
        token: str | None = None,
        protocol_version: str | None = PROTOCOL_VERSION,
        origin: str | None = f"https://{HOST}:{PORT}",
        extra_headers: dict[str, str] | None = None,
    ) -> tuple[int, dict[str, str], object]:
        return https_json_request(
            context=self.client_context,
            method=method,
            path=path,
            token=self.grant.access_token if token is None else token,
            payload=payload,
            protocol_version=protocol_version,
            origin=origin,
            extra_headers=extra_headers,
        )

    def test_discovery_metadata(self) -> None:
        status, _, resource = self.request(
            "GET",
            "/.well-known/oauth-protected-resource/mcp",
        )
        self.assertEqual(status, 200)
        self.assertEqual(resource["resource"], "https://127.0.0.1:28775/mcp")
        status, _, server = self.request(
            "GET",
            "/.well-known/oauth-authorization-server",
        )
        self.assertEqual(status, 200)
        self.assertEqual(server["code_challenge_methods_supported"], ["S256"])

    def test_initialize_accepts_missing_protocol_header(self) -> None:
        status, headers, response = self.request(
            "POST",
            "/mcp",
            payload={
                "jsonrpc": "2.0",
                "id": 1,
                "method": "initialize",
                "params": {"protocolVersion": PROTOCOL_VERSION},
            },
            protocol_version=None,
        )
        self.assertEqual(status, 200)
        self.assertEqual(response["result"]["protocolVersion"], PROTOCOL_VERSION)
        self.assertNotIn("MCP-Session-Id", headers)
        self.assertNotIn("text/event-stream", headers.get("Content-Type", ""))

    def test_tools_list_and_call(self) -> None:
        status, _, listed = self.request(
            "POST",
            "/mcp",
            payload={"jsonrpc": "2.0", "id": 2, "method": "tools/list", "params": {}},
        )
        self.assertEqual(status, 200)
        tools = listed["result"]["tools"]
        self.assertEqual(len(tools), 5)
        self.assertTrue(
            all(tool["inputSchema"]["additionalProperties"] is False for tool in tools)
        )
        status, _, called = self.request(
            "POST",
            "/mcp",
            payload={
                "jsonrpc": "2.0",
                "id": 3,
                "method": "tools/call",
                "params": {
                    "name": "search_knowledge",
                    "arguments": {"query": "Synthetic"},
                },
            },
        )
        self.assertEqual(status, 200)
        self.assertFalse(called["result"]["isError"])
        self.assertEqual(
            len(called["result"]["structuredContent"]["data"]["items"]),
            2,
        )

    def test_notification_get_delete_profile(self) -> None:
        status, _, body = self.request(
            "POST",
            "/mcp",
            payload={"jsonrpc": "2.0", "method": "notifications/initialized"},
        )
        self.assertEqual(status, 202)
        self.assertIsNone(body)
        self.assertEqual(self.request("GET", "/mcp")[0], 405)
        self.assertEqual(self.request("DELETE", "/mcp")[0], 405)

    def test_missing_or_revoked_auth_returns_401(self) -> None:
        status, headers, _ = https_json_request(
            context=self.client_context,
            method="POST",
            path="/mcp",
            token=None,
            payload={"jsonrpc": "2.0", "id": 4, "method": "tools/list"},
        )
        self.assertEqual(status, 401)
        self.assertIn("resource_metadata", headers["WWW-Authenticate"])
        revoked = self.oauth.issue_test_grant(client_id="fixture-revoked")
        self.oauth.revoke(revoked.access_token)
        status, _, _ = self.request(
            "POST",
            "/mcp",
            token=revoked.access_token,
            payload={"jsonrpc": "2.0", "id": 5, "method": "tools/list"},
        )
        self.assertEqual(status, 401)

    def test_host_origin_protocol_and_sse_fail_closed(self) -> None:
        payload = {"jsonrpc": "2.0", "id": 6, "method": "tools/list"}
        self.assertEqual(
            self.request(
                "POST",
                "/mcp",
                payload=payload,
                extra_headers={"Host": "localhost:28775"},
            )[0],
            421,
        )
        self.assertEqual(
            self.request(
                "POST",
                "/mcp",
                payload=payload,
                origin="https://localhost:28775",
            )[0],
            403,
        )
        self.assertEqual(
            self.request(
                "POST",
                "/mcp",
                payload=payload,
                protocol_version="2099-01-01",
            )[0],
            400,
        )
        self.assertEqual(
            self.request(
                "POST",
                "/mcp",
                payload=payload,
                extra_headers={"Accept": "text/event-stream"},
            )[0],
            406,
        )

    def test_header_and_body_limits_fail_closed(self) -> None:
        payload = {"jsonrpc": "2.0", "id": 7, "method": "tools/list"}
        self.assertEqual(
            self.request(
                "POST",
                "/mcp",
                payload=payload,
                extra_headers={"X-Fixture-Oversized": "x" * 9000},
            )[0],
            431,
        )
        oversized = {
            "jsonrpc": "2.0",
            "id": 8,
            "method": "tools/call",
            "params": {
                "name": "search_knowledge",
                "arguments": {"query": "x" * 33000},
            },
        }
        self.assertEqual(self.request("POST", "/mcp", payload=oversized)[0], 413)

    def test_fixed_port_conflict_does_not_fallback(self) -> None:
        second = ProtocolHarness(
            test_root=self.test_root,
            synthetic_base=self.base,
            certificate=self.bundle,
            oauth=self.oauth,
        )
        try:
            with self.assertRaises(HarnessStartError):
                second.start()
        finally:
            second.stop()

    def test_cancellation_is_client_owned_and_disconnect_is_not_cancel(self) -> None:
        registry = self.harness.cancellations
        registry.register("fixture-inflight", "fixture-client")
        registry.disconnect("fixture-inflight")
        self.assertFalse(registry.is_cancelled("fixture-inflight"))
        self.assertFalse(registry.cancel("fixture-inflight", "other-client"))
        self.assertTrue(registry.cancel("fixture-inflight", "fixture-client"))
        self.assertTrue(registry.is_cancelled("fixture-inflight"))
        registry.complete("fixture-inflight")

    def test_timeout_and_concurrency_limit_fail_closed(self) -> None:
        original = self.harness.tools.call

        def slow_call(*args: object, **kwargs: object) -> object:
            time.sleep(0.05)
            return original(*args, **kwargs)

        self.harness.tools.call = slow_call
        original_timeout = self.harness.request_timeout_seconds
        self.harness.request_timeout_seconds = 0.001
        try:
            status, _, response = self.request(
                "POST",
                "/mcp",
                payload={
                    "jsonrpc": "2.0",
                    "id": 9,
                    "method": "tools/call",
                    "params": {
                        "name": "get_knowledge_version",
                        "arguments": {},
                    },
                },
            )
            self.assertEqual(status, 200)
            self.assertEqual(response["error"]["data"]["error_code"], "REQUEST_TIMEOUT")
        finally:
            self.harness.tools.call = original
            self.harness.request_timeout_seconds = original_timeout

        acquired = []
        try:
            for _ in range(4):
                acquired.append(self.harness._semaphore.acquire(blocking=False))
            self.assertTrue(all(acquired))
            self.assertEqual(
                self.request(
                    "POST",
                    "/mcp",
                    payload={
                        "jsonrpc": "2.0",
                        "id": 10,
                        "method": "tools/list",
                    },
                )[0],
                429,
            )
        finally:
            for success in acquired:
                if success:
                    self.harness._semaphore.release()

    def test_audit_events_do_not_contain_tokens(self) -> None:
        serialized = json.dumps(self.harness.audit_events, sort_keys=True)
        self.assertNotIn(self.grant.access_token, serialized)
        self.assertNotIn(self.grant.refresh_token, serialized)


if __name__ == "__main__":
    unittest.main()
