from __future__ import annotations

import asyncio
import socket
import ssl
import tempfile
import unittest
from pathlib import Path
from urllib.parse import parse_qs, urlsplit

import httpx

from sapd_wiki.local_mcp.auth import SCOPE, pkce_challenge
from sapd_wiki.local_mcp.dev_supervisor import DevSidecarSupervisor
from sapd_wiki.local_mcp.transport import PROTOCOL_VERSION
from sapd_wiki.local_mcp.web_control import build_dev_control_api


WEB_HOST = "127.0.0.1:5173"
WEB_ORIGIN = "http://127.0.0.1:5173"
WEB_SESSION = "e2e-local-web-session"


def free_port() -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as candidate:
        candidate.bind(("127.0.0.1", 0))
        return int(candidate.getsockname()[1])


class WebDevMcpE2ETests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self) -> None:
        self.temporary = tempfile.TemporaryDirectory(prefix="sapd-mcp-e2e-")
        self.root = Path(self.temporary.name) / "runtime"
        self.port = free_port()
        self.supervisor = DevSidecarSupervisor(
            configured_port=self.port,
            runtime_root=self.root,
            authorization_timeout_seconds=1,
            cleanup_on_close=False,
        )
        self.control = build_dev_control_api(
            expected_host=WEB_HOST,
            expected_origin=WEB_ORIGIN,
            session_token=WEB_SESSION,
            supervisor=self.supervisor,
        )
        initial = self.panel()
        prepared = self.mutate(
            "/api/v1/mcp/certificate/actions/prepare",
            initial["state_version"],
            action="certificate_provision",
        )
        confirmed = self.mutate(
            "/api/v1/mcp/certificate/actions/confirm",
            prepared["state_version"],
            confirmation_id=prepared["certificate_confirmation"][
                "confirmation_id"
            ],
        )
        started = self.mutate(
            "/api/v1/mcp/actions/start",
            self.panel()["state_version"],
        )
        self.assertTrue(started["changed"])
        self.ca_fingerprint = self.panel()["certificate"][
            "ca_fingerprint_sha256"
        ]
        context = ssl.create_default_context(
            ssl.Purpose.SERVER_AUTH,
            cafile=self.supervisor.ca_path,
        )
        context.minimum_version = ssl.TLSVersion.TLSv1_2
        self.client = httpx.AsyncClient(
            base_url=f"https://127.0.0.1:{self.port}",
            verify=context,
            timeout=5,
            follow_redirects=False,
        )

    async def asyncTearDown(self) -> None:
        await self.client.aclose()
        self.supervisor.close()
        self.temporary.cleanup()

    @staticmethod
    def control_headers(*, mutation: bool = False) -> dict[str, str]:
        headers = {
            "Host": WEB_HOST,
            "Origin": WEB_ORIGIN,
            "X-SAPD-Session-Token": WEB_SESSION,
        }
        if mutation:
            headers["Content-Type"] = "application/json"
        return headers

    def panel(self) -> dict:
        response = self.control.dispatch(
            "GET",
            "/api/v1/mcp/control-panel",
            self.control_headers(),
        )
        self.assertEqual(response.status, 200, response.body)
        return dict(response.body)

    def mutate(
        self,
        path: str,
        expected_state_version: int,
        **payload: object,
    ) -> dict:
        response = self.control.dispatch(
            "POST",
            path,
            self.control_headers(mutation=True),
            {
                "request_id": f"e2e:{free_port()}:{expected_state_version}",
                "expected_state_version": expected_state_version,
                **payload,
            },
        )
        self.assertEqual(response.status, 200, response.body)
        return dict(response.body)

    async def register(self) -> str:
        response = await self.client.post(
            "/oauth/register",
            json={
                "client_name": "SAPD owned E2E",
                "redirect_uris": ["http://127.0.0.1/callback"],
                "token_endpoint_auth_method": "none",
                "grant_types": ["authorization_code", "refresh_token"],
                "response_types": ["code"],
                "scope": SCOPE,
            },
        )
        self.assertEqual(response.status_code, 201, response.text)
        payload = response.json()
        self.assertNotIn("client_secret", payload)
        return str(payload["client_id"])

    async def authorize(
        self,
        client_id: str,
        *,
        decision: str | None,
        suffix: str,
    ) -> tuple[httpx.Response, str, str]:
        verifier = f"e2e-{suffix}-" + ("v" * 64)
        redirect_uri = f"http://127.0.0.1:{free_port()}/callback"
        task = asyncio.create_task(
            self.client.get(
                "/oauth/authorize",
                params={
                    "client_id": client_id,
                    "redirect_uri": redirect_uri,
                    "response_type": "code",
                    "code_challenge": pkce_challenge(verifier),
                    "code_challenge_method": "S256",
                    "state": f"state-{suffix}",
                    "scope": SCOPE,
                    "resource": f"https://127.0.0.1:{self.port}/mcp",
                },
            )
        )
        request = None
        for _ in range(200):
            panel = self.panel()
            requests = panel["authorization_requests"]
            if requests:
                request = requests[0]
                break
            await asyncio.sleep(0.01)
        self.assertIsNotNone(request)
        self.assertEqual(request["client_id"], client_id)
        self.assertEqual(request["trust_state"], "unverified")
        self.assertEqual(request["registration_mode"], "DCR")
        if decision is not None:
            self.mutate(
                f"/api/v1/mcp/authorization/actions/{decision}",
                panel["state_version"],
                authorization_request_id=request["request_id"],
            )
        response = await task
        self.assertEqual(response.status_code, 302, response.text)
        return response, verifier, redirect_uri

    async def exchange(
        self,
        client_id: str,
        response: httpx.Response,
        verifier: str,
        redirect_uri: str,
    ) -> dict:
        query = parse_qs(urlsplit(response.headers["location"]).query)
        self.assertEqual(query["state"], [query["state"][0]])
        issued = await self.client.post(
            "/oauth/token",
            data={
                "grant_type": "authorization_code",
                "client_id": client_id,
                "code": query["code"][0],
                "redirect_uri": redirect_uri,
                "code_verifier": verifier,
                "resource": f"https://127.0.0.1:{self.port}/mcp",
            },
        )
        self.assertEqual(issued.status_code, 200, issued.text)
        return issued.json()

    def mcp_headers(self, access_token: str) -> dict[str, str]:
        return {
            "Authorization": f"Bearer {access_token}",
            "Accept": "application/json",
            "MCP-Protocol-Version": PROTOCOL_VERSION,
            "Origin": f"https://127.0.0.1:{self.port}",
        }

    async def mcp_request(
        self,
        access_token: str,
        request_id: int,
        method: str,
        params: dict,
    ) -> httpx.Response:
        return await self.client.post(
            "/mcp",
            headers=self.mcp_headers(access_token),
            json={
                "jsonrpc": "2.0",
                "id": request_id,
                "method": method,
                "params": params,
            },
        )

    async def call_tool(
        self,
        access_token: str,
        request_id: int,
        name: str,
        arguments: dict,
    ) -> dict:
        response = await self.mcp_request(
            access_token,
            request_id,
            "tools/call",
            {"name": name, "arguments": arguments},
        )
        self.assertEqual(response.status_code, 200, response.text)
        result = response.json()["result"]
        self.assertFalse(result["isError"], result)
        payload = result["structuredContent"]
        self.assertEqual(payload["contract_version"], "sapd-mcp-tools-v1")
        self.assertEqual(payload["source_channel"], "sapd_wiki")
        self.assertTrue(payload["knowledge_version"].startswith("base-"))
        self.assertEqual(payload["policy_version"], "base-all-business-content-v1")
        self.assertEqual(payload["identity_version"], "base-stable-ref-v1")
        self.assertEqual(payload["grant_version"], "grant-v1")
        self.assertEqual(payload["content_trust"], "untrusted_reference")
        return payload

    async def test_real_web_control_oauth_five_tools_revoke_timeout_and_stop(self) -> None:
        resource = await self.client.get(
            "/.well-known/oauth-protected-resource/mcp"
        )
        self.assertEqual(resource.status_code, 200)
        self.assertEqual(
            resource.json()["resource"],
            f"https://127.0.0.1:{self.port}/mcp",
        )
        metadata = await self.client.get(
            "/.well-known/oauth-authorization-server"
        )
        self.assertEqual(metadata.status_code, 200)
        self.assertEqual(metadata.json()["code_challenge_methods_supported"], ["S256"])
        self.assertTrue(metadata.json()["registration_endpoint"].endswith("/oauth/register"))

        client_id = await self.register()
        response, verifier, redirect_uri = await self.authorize(
            client_id,
            decision="allow",
            suffix="allow-1",
        )
        issued = await self.exchange(client_id, response, verifier, redirect_uri)
        self.assertNotIn(".", issued["access_token"])

        initialized = await self.mcp_request(
            issued["access_token"],
            1,
            "initialize",
            {
                "protocolVersion": PROTOCOL_VERSION,
                "capabilities": {},
                "clientInfo": {"name": "SAPD owned E2E", "version": "1.0"},
            },
        )
        self.assertEqual(initialized.status_code, 200, initialized.text)
        self.assertEqual(
            initialized.json()["result"]["protocolVersion"],
            PROTOCOL_VERSION,
        )
        self.assertNotIn("mcp-session-id", initialized.headers)
        notification = await self.client.post(
            "/mcp",
            headers=self.mcp_headers(issued["access_token"]),
            json={"jsonrpc": "2.0", "method": "notifications/initialized"},
        )
        self.assertEqual(notification.status_code, 202)

        listed = await self.mcp_request(
            issued["access_token"],
            2,
            "tools/list",
            {},
        )
        self.assertEqual(listed.status_code, 200, listed.text)
        tools = listed.json()["result"]["tools"]
        self.assertEqual(
            {tool["name"] for tool in tools},
            {
                "search_knowledge",
                "get_knowledge_object",
                "get_related_knowledge",
                "get_source_evidence",
                "get_knowledge_version",
            },
        )

        search = await self.call_tool(
            issued["access_token"],
            3,
            "search_knowledge",
            {"query": "Synthetic common", "limit": 8},
        )
        refs = [
            item["canonical_ref"]
            for item in search["data"]["items"]
        ]
        self.assertEqual(
            refs,
            [
                "fixture://objects/public-a",
                "fixture://objects/public-b",
                "fixture://objects/public-c",
            ],
        )
        self.assertIn("fixture_internal_knowledge", {
            item["object_type"] for item in search["data"]["items"]
        })
        self.assertNotIn("metadata_json", search["data"]["items"][1])

        knowledge = await self.call_tool(
            issued["access_token"],
            4,
            "get_knowledge_object",
            {"canonical_ref": "fixture://objects/public-a"},
        )
        self.assertEqual(
            knowledge["data"]["description"],
            "Synthetic complete standard content Alpha.",
        )
        self.assertEqual(
            knowledge["data"]["business_metadata"]["control_objective"],
            "Protect synthetic identities.",
        )
        self.assertNotIn("file_path", str(knowledge))

        related = await self.call_tool(
            issued["access_token"],
            5,
            "get_related_knowledge",
            {
                "canonical_ref": "fixture://objects/public-a",
                "direction": "outgoing",
                "limit": 15,
            },
        )
        self.assertEqual(
            [item["relation_ref"] for item in related["data"]["items"]],
            [
                "fixture://relations/a-to-b",
                "fixture://relations/a-to-c",
            ],
        )

        evidence = await self.call_tool(
            issued["access_token"],
            6,
            "get_source_evidence",
            {
                "canonical_ref": "fixture://objects/public-a",
                "include_excerpt": False,
                "limit": 8,
            },
        )
        self.assertEqual(len(evidence["data"]["items"]), 1)
        self.assertEqual(
            evidence["data"]["items"][0]["file_name"],
            "Synthetic Standard.xlsx",
        )
        self.assertFalse(evidence["data"]["items"][0]["excerpt_included"])
        self.assertNotIn("raw_value", str(evidence))
        self.assertNotIn("/private/", str(evidence))

        version = await self.call_tool(
            issued["access_token"],
            7,
            "get_knowledge_version",
            {},
        )
        self.assertRegex(version["data"]["manifest_digest"], r"^sha256:[0-9a-f]{64}$")

        panel = self.panel()
        client = next(item for item in panel["clients"] if item["client_id"] == client_id)
        self.assertEqual(client["trust_state"], "unverified")
        self.assertIsNotNone(client["last_used_at"])
        self.assertGreaterEqual(panel["audit"]["event_count"], 7)

        refreshed = await self.client.post(
            "/oauth/token",
            data={
                "grant_type": "refresh_token",
                "client_id": client_id,
                "refresh_token": issued["refresh_token"],
                "scope": SCOPE,
                "resource": f"https://127.0.0.1:{self.port}/mcp",
            },
        )
        self.assertEqual(refreshed.status_code, 200, refreshed.text)
        replacement = refreshed.json()
        old_access = await self.mcp_request(
            issued["access_token"],
            8,
            "tools/list",
            {},
        )
        self.assertEqual(old_access.status_code, 401)
        replacement_access = await self.mcp_request(
            replacement["access_token"],
            9,
            "tools/list",
            {},
        )
        self.assertEqual(replacement_access.status_code, 200)

        reused = await self.client.post(
            "/oauth/token",
            data={
                "grant_type": "refresh_token",
                "client_id": client_id,
                "refresh_token": issued["refresh_token"],
                "scope": SCOPE,
                "resource": f"https://127.0.0.1:{self.port}/mcp",
            },
        )
        self.assertEqual(reused.status_code, 400)
        reused_family_access = await self.mcp_request(
            replacement["access_token"],
            10,
            "tools/list",
            {},
        )
        self.assertEqual(reused_family_access.status_code, 401)

        response, verifier, redirect_uri = await self.authorize(
            client_id,
            decision="allow",
            suffix="allow-2",
        )
        reissued = await self.exchange(client_id, response, verifier, redirect_uri)
        panel = self.panel()
        self.mutate(
            "/api/v1/mcp/clients/actions/revoke",
            panel["state_version"],
            client_id=client_id,
        )
        revoked = await self.mcp_request(
            reissued["access_token"],
            11,
            "tools/list",
            {},
        )
        self.assertEqual(revoked.status_code, 401)

        denied, _, _ = await self.authorize(
            client_id,
            decision="deny",
            suffix="deny",
        )
        denied_query = parse_qs(urlsplit(denied.headers["location"]).query)
        self.assertEqual(denied_query["error"], ["access_denied"])

        timed_out, _, _ = await self.authorize(
            client_id,
            decision=None,
            suffix="timeout",
        )
        timeout_query = parse_qs(urlsplit(timed_out.headers["location"]).query)
        self.assertEqual(timeout_query["error"], ["access_denied"])
        self.assertIn("timed out", timeout_query["error_description"][0])

        panel = self.panel()
        stopped = self.mutate(
            "/api/v1/mcp/actions/stop",
            panel["state_version"],
        )
        self.assertTrue(stopped["changed"])
        stopped_panel = self.panel()
        self.assertEqual(stopped_panel["status"]["service_state"], "stopped")
        self.assertTrue(self.supervisor.ca_path.exists())
        self.assertEqual(
            stopped_panel["certificate"]["ca_fingerprint_sha256"],
            self.ca_fingerprint,
        )


if __name__ == "__main__":
    unittest.main()
