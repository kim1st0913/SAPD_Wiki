from __future__ import annotations

import asyncio
import tempfile
import unittest
from pathlib import Path
from urllib.parse import parse_qs, urlsplit

import httpx
from mcp.shared.auth import OAuthClientInformationFull

from sapd_wiki.local_mcp.auth import (
    LocalOAuthProvider,
    OAuthProviderConfig,
    SCOPE,
    pkce_challenge,
)
from sapd_wiki.local_mcp.control_store import ControlStore
from sapd_wiki.local_mcp.transport import (
    PROTOCOL_VERSION,
    TransportContractMiddleware,
    build_transport_app,
)


class FakeKnowledgeService:
    @staticmethod
    def result(items: list[object] | None = None) -> dict[str, object]:
        return {
            "contract_version": "sapd-mcp-tools-v1",
            "source_channel": "sapd_wiki",
            "knowledge_version": "knowledge-v1",
            "policy_version": "policy-v1",
            "identity_version": "identity-v1",
            "grant_version": "grant-v1",
            "content_trust": "untrusted_reference",
            "data": {"items": items or []},
            "page": {"next_cursor": None, "has_more": False},
            "warnings": [],
            "correlation_id": "correlation-1",
        }

    def search_knowledge(self, **kwargs: object) -> dict[str, object]:
        return self.result([{"display_name": kwargs["query"]}])

    def get_knowledge_object(self, **kwargs: object) -> dict[str, object]:
        return self.result([{"canonical_ref": kwargs["canonical_ref"]}])

    def get_related_knowledge(self, **_kwargs: object) -> dict[str, object]:
        return self.result()

    def get_source_evidence(self, **_kwargs: object) -> dict[str, object]:
        return self.result()

    def get_knowledge_version(self) -> dict[str, object]:
        return self.result()


class TransportTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp = tempfile.TemporaryDirectory(prefix="sapd-mcp-transport-")
        self.store = ControlStore(
            Path(self.temp.name) / "control.sqlite3",
            verifier_key=b"k" * 32,
        )
        self.provider = LocalOAuthProvider(
            self.store,
            OAuthProviderConfig(
                issuer_url="https://127.0.0.1:28775",
                resource_url="https://127.0.0.1:28775/mcp",
                instance_id="instance-1",
                runtime_id="runtime-1",
                policy_version="policy-v1",
            ),
            authorization_decider=lambda _request: True,
        )
        self.provider.register_pre_registered(
            OAuthClientInformationFull(
                client_id="client-a",
                redirect_uris=["http://127.0.0.1/callback"],
                token_endpoint_auth_method="none",
                grant_types=["authorization_code", "refresh_token"],
                response_types=["code"],
                scope=SCOPE,
            )
        )
        self.app = build_transport_app(
            provider=self.provider,
            service=FakeKnowledgeService(),
            canonical_host="127.0.0.1:28775",
            canonical_origin="https://127.0.0.1:28775",
        )

    def tearDown(self) -> None:
        self.store.close()
        self.temp.cleanup()

    async def token(self, client: httpx.AsyncClient) -> str:
        verifier = "transport-verifier-" + ("v" * 48)
        redirect = "http://127.0.0.1:49152/callback"
        authorized = await client.get(
            "/oauth/authorize",
            params={
                "client_id": "client-a",
                "redirect_uri": redirect,
                "response_type": "code",
                "code_challenge": pkce_challenge(verifier),
                "code_challenge_method": "S256",
                "state": "state-1",
                "scope": SCOPE,
                "resource": "https://127.0.0.1:28775/mcp",
            },
        )
        code = parse_qs(
            urlsplit(authorized.headers["location"]).query
        )["code"][0]
        issued = await client.post(
            "/oauth/token",
            data={
                "grant_type": "authorization_code",
                "client_id": "client-a",
                "code": code,
                "redirect_uri": redirect,
                "code_verifier": verifier,
                "resource": "https://127.0.0.1:28775/mcp",
            },
        )
        self.assertEqual(issued.status_code, 200, issued.text)
        return issued.json()["access_token"]

    async def exercise_profile(self) -> None:
        async with self.app.router.lifespan_context(self.app):
            transport = httpx.ASGITransport(app=self.app)
            async with httpx.AsyncClient(
                transport=transport,
                base_url="https://127.0.0.1:28775",
            ) as client:
                access_token = await self.token(client)
                headers = {
                    "Authorization": f"Bearer {access_token}",
                    "Accept": "application/json",
                    "MCP-Protocol-Version": PROTOCOL_VERSION,
                    "Origin": "https://127.0.0.1:28775",
                }
                initialized = await client.post(
                    "/mcp",
                    headers=headers,
                    json={
                        "jsonrpc": "2.0",
                        "id": 1,
                        "method": "initialize",
                        "params": {
                            "protocolVersion": PROTOCOL_VERSION,
                            "capabilities": {},
                            "clientInfo": {
                                "name": "fixture-client",
                                "version": "1.0",
                            },
                        },
                    },
                )
                self.assertEqual(initialized.status_code, 200, initialized.text)
                self.assertEqual(
                    initialized.json()["result"]["protocolVersion"],
                    PROTOCOL_VERSION,
                )
                self.assertNotIn("mcp-session-id", initialized.headers)
                self.assertEqual(
                    initialized.headers["content-type"].split(";")[0],
                    "application/json",
                )
                listed = await client.post(
                    "/mcp",
                    headers=headers,
                    json={
                        "jsonrpc": "2.0",
                        "id": 2,
                        "method": "tools/list",
                        "params": {},
                    },
                )
                self.assertEqual(listed.status_code, 200, listed.text)
                tools = listed.json()["result"]["tools"]
                self.assertEqual(len(tools), 5)
                self.assertTrue(
                    all(
                        tool["inputSchema"]["additionalProperties"] is False
                        for tool in tools
                    )
                )
                self.assertTrue(
                    all(tool["annotations"]["readOnlyHint"] is True for tool in tools)
                )
                called = await client.post(
                    "/mcp",
                    headers=headers,
                    json={
                        "jsonrpc": "2.0",
                        "id": 3,
                        "method": "tools/call",
                        "params": {
                            "name": "search_knowledge",
                            "arguments": {"query": "Synthetic"},
                        },
                    },
                )
                self.assertEqual(called.status_code, 200, called.text)
                result = called.json()["result"]
                self.assertFalse(result["isError"])
                self.assertEqual(
                    result["structuredContent"]["data"]["items"][0][
                        "display_name"
                    ],
                    "Synthetic",
                )
                extra_argument = await client.post(
                    "/mcp",
                    headers=headers,
                    json={
                        "jsonrpc": "2.0",
                        "id": 4,
                        "method": "tools/call",
                        "params": {
                            "name": "search_knowledge",
                            "arguments": {
                                "query": "Synthetic",
                                "unexpected": True,
                            },
                        },
                    },
                )
                self.assertEqual(extra_argument.status_code, 200)
                self.assertTrue(extra_argument.json()["result"]["isError"])
                notification = await client.post(
                    "/mcp",
                    headers=headers,
                    json={
                        "jsonrpc": "2.0",
                        "method": "notifications/initialized",
                    },
                )
                self.assertEqual(notification.status_code, 202)
                self.assertEqual(await notification.aread(), b"")
                self.assertEqual(
                    (await client.get("/mcp", headers=headers)).status_code,
                    405,
                )
                self.assertEqual(
                    (await client.delete("/mcp", headers=headers)).status_code,
                    405,
                )

    def test_stateless_json_fastmcp_profile_and_five_tools(self) -> None:
        asyncio.run(self.exercise_profile())

    async def exercise_security(self) -> None:
        async with self.app.router.lifespan_context(self.app):
            transport = httpx.ASGITransport(app=self.app)
            async with httpx.AsyncClient(
                transport=transport,
                base_url="https://127.0.0.1:28775",
            ) as client:
                payload = {
                    "jsonrpc": "2.0",
                    "id": 1,
                    "method": "tools/list",
                    "params": {},
                }
                unauthorized = await client.post(
                    "/mcp",
                    headers={"Accept": "application/json"},
                    json=payload,
                )
                self.assertEqual(unauthorized.status_code, 401)
                self.assertIn(
                    "resource_metadata",
                    unauthorized.headers["www-authenticate"],
                )
                wrong_host = await client.post(
                    "/mcp",
                    headers={
                        "Host": "localhost:28775",
                        "Accept": "application/json",
                    },
                    json=payload,
                )
                self.assertEqual(wrong_host.status_code, 421)
                wrong_origin = await client.post(
                    "/mcp",
                    headers={
                        "Origin": "https://localhost:28775",
                        "Accept": "application/json",
                    },
                    json=payload,
                )
                self.assertEqual(wrong_origin.status_code, 403)
                wrong_protocol = await client.post(
                    "/mcp",
                    headers={
                        "Accept": "application/json",
                        "MCP-Protocol-Version": "2099-01-01",
                    },
                    json=payload,
                )
                self.assertEqual(wrong_protocol.status_code, 400)
                compatible_protocol = await client.post(
                    "/mcp",
                    headers={
                        "Accept": "application/json",
                        "MCP-Protocol-Version": "2025-06-18",
                    },
                    json=payload,
                )
                self.assertEqual(compatible_protocol.status_code, 401)
                too_large = await client.post(
                    "/mcp",
                    headers={"Accept": "application/json"},
                    content=b"x" * 32769,
                )
                self.assertEqual(too_large.status_code, 413)
                sse = await client.post(
                    "/mcp",
                    headers={"Accept": "text/event-stream"},
                    json=payload,
                )
                self.assertEqual(sse.status_code, 406)

            insecure_transport = httpx.ASGITransport(app=self.app)
            async with httpx.AsyncClient(
                transport=insecure_transport,
                base_url="http://127.0.0.1:28775",
            ) as insecure:
                response = await insecure.get(
                    "/.well-known/oauth-authorization-server"
                )
                self.assertEqual(response.status_code, 400)
                self.assertEqual(response.json()["error"], "TLS_REQUIRED")

    def test_host_origin_tls_protocol_and_limits_fail_closed(self) -> None:
        asyncio.run(self.exercise_security())

    async def exercise_response_limit(self) -> None:
        async def oversized_app(
            _scope: object,
            _receive: object,
            send: object,
        ) -> None:
            await send(
                {
                    "type": "http.response.start",
                    "status": 200,
                    "headers": [(b"content-type", b"application/json")],
                }
            )
            await send(
                {
                    "type": "http.response.body",
                    "body": b"x" * 65537,
                    "more_body": False,
                }
            )

        app = TransportContractMiddleware(
            oversized_app,
            canonical_host="127.0.0.1:28775",
            canonical_origin="https://127.0.0.1:28775",
        )
        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(
            transport=transport,
            base_url="https://127.0.0.1:28775",
        ) as client:
            response = await client.post(
                "/mcp",
                headers={"Accept": "application/json"},
                json={"jsonrpc": "2.0", "id": 1, "method": "tools/list"},
            )
        self.assertEqual(response.status_code, 500)
        self.assertEqual(response.json()["error"], "RESPONSE_TOO_LARGE")
        self.assertLess(len(response.content), 65536)

    def test_response_larger_than_64_kib_fails_before_start(self) -> None:
        asyncio.run(self.exercise_response_limit())


if __name__ == "__main__":
    unittest.main()
