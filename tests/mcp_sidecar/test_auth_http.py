from __future__ import annotations

import asyncio
import tempfile
import unittest
from pathlib import Path
from urllib.parse import parse_qs, urlsplit

import httpx
from mcp.server.auth.provider import TokenError
from mcp.server.auth.provider import RegistrationError
from mcp.shared.auth import OAuthClientInformationFull

from sapd_wiki.local_mcp.auth import (
    ACCESS_TOKEN_TTL_SECONDS,
    LocalOAuthProvider,
    OAuthProviderConfig,
    SCOPE,
    pkce_challenge,
)
from sapd_wiki.local_mcp.control_store import ControlStore
from sapd_wiki.local_mcp.transport import build_transport_app


class FakeKnowledgeService:
    def _result(self) -> dict[str, object]:
        return {
            "contract_version": "sapd-mcp-tools-v1",
            "source_channel": "sapd_wiki",
            "knowledge_version": "knowledge-v1",
            "policy_version": "policy-v1",
            "identity_version": "identity-v1",
            "grant_version": "grant-v1",
            "content_trust": "untrusted_reference",
            "data": {"items": []},
            "page": {"next_cursor": None, "has_more": False},
            "warnings": [],
            "correlation_id": "correlation-1",
        }

    def search_knowledge(self, **_kwargs: object) -> dict[str, object]:
        return self._result()

    def get_knowledge_object(self, **_kwargs: object) -> dict[str, object]:
        return self._result()

    def get_related_knowledge(self, **_kwargs: object) -> dict[str, object]:
        return self._result()

    def get_source_evidence(self, **_kwargs: object) -> dict[str, object]:
        return self._result()

    def get_knowledge_version(self) -> dict[str, object]:
        return self._result()


def client_registration(client_id: str) -> OAuthClientInformationFull:
    return OAuthClientInformationFull(
        client_id=client_id,
        redirect_uris=["http://127.0.0.1/callback"],
        token_endpoint_auth_method="none",
        grant_types=["authorization_code", "refresh_token"],
        response_types=["code"],
        scope=SCOPE,
        client_name=client_id,
    )


class AuthHTTPTests(unittest.TestCase):
    def test_default_access_token_ttl_is_one_hour(self) -> None:
        self.assertEqual(ACCESS_TOKEN_TTL_SECONDS, 60 * 60)
        self.assertEqual(self.provider.config.access_token_ttl_seconds, 60 * 60)

    def setUp(self) -> None:
        self.temp = tempfile.TemporaryDirectory(prefix="sapd-mcp-auth-")
        self.root = Path(self.temp.name)
        self.store = ControlStore(
            self.root / "control.sqlite3",
            verifier_key=b"v" * 32,
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
        self.provider.register_pre_registered(client_registration("client-a"))
        self.provider.register_pre_registered(client_registration("client-b"))
        self.app = build_transport_app(
            provider=self.provider,
            service=FakeKnowledgeService(),
            canonical_host="127.0.0.1:28775",
            canonical_origin="https://127.0.0.1:28775",
        )

    def tearDown(self) -> None:
        self.store.close()
        self.temp.cleanup()

    async def authorize(
        self,
        client: httpx.AsyncClient,
        *,
        client_id: str,
        callback_port: int,
        verifier: str,
    ) -> dict[str, str]:
        redirect_uri = f"http://127.0.0.1:{callback_port}/callback"
        response = await client.get(
            "/oauth/authorize",
            params={
                "client_id": client_id,
                "redirect_uri": redirect_uri,
                "response_type": "code",
                "code_challenge": pkce_challenge(verifier),
                "code_challenge_method": "S256",
                "state": f"state-{client_id}",
                "scope": SCOPE,
                "resource": "https://127.0.0.1:28775/mcp",
            },
        )
        self.assertEqual(response.status_code, 302, response.text)
        query = parse_qs(urlsplit(response.headers["location"]).query)
        self.assertEqual(query["state"], [f"state-{client_id}"])
        token = await client.post(
            "/oauth/token",
            data={
                "grant_type": "authorization_code",
                "client_id": client_id,
                "code": query["code"][0],
                "redirect_uri": redirect_uri,
                "code_verifier": verifier,
                "resource": "https://127.0.0.1:28775/mcp",
            },
        )
        self.assertEqual(token.status_code, 200, token.text)
        return token.json()

    async def exercise_http_oauth(self) -> None:
        async with self.app.router.lifespan_context(self.app):
            transport = httpx.ASGITransport(app=self.app)
            async with httpx.AsyncClient(
                transport=transport,
                base_url="https://127.0.0.1:28775",
            ) as client:
                resource = await client.get(
                    "/.well-known/oauth-protected-resource/mcp"
                )
                self.assertEqual(resource.status_code, 200)
                self.assertEqual(
                    resource.json()["resource"],
                    "https://127.0.0.1:28775/mcp",
                )
                metadata = await client.get(
                    "/.well-known/oauth-authorization-server"
                )
                self.assertEqual(metadata.status_code, 200)
                self.assertEqual(
                    metadata.json()["code_challenge_methods_supported"],
                    ["S256"],
                )
                verifier = "verifier-" + ("x" * 48)
                issued = await self.authorize(
                    client,
                    client_id="client-a",
                    callback_port=49152,
                    verifier=verifier,
                )
                self.assertNotIn(".", issued["access_token"])
                self.assertEqual(issued["expires_in"], 60 * 60)
                refreshed = await client.post(
                    "/oauth/token",
                    data={
                        "grant_type": "refresh_token",
                        "client_id": "client-a",
                        "refresh_token": issued["refresh_token"],
                        "scope": SCOPE,
                    },
                )
                self.assertEqual(refreshed.status_code, 200, refreshed.text)
                replacement = refreshed.json()
                self.assertEqual(replacement["expires_in"], 60 * 60)
                self.assertNotEqual(
                    replacement["refresh_token"], issued["refresh_token"]
                )
                wrong_resource = await client.post(
                    "/oauth/token",
                    data={
                        "grant_type": "refresh_token",
                        "client_id": "client-a",
                        "refresh_token": replacement["refresh_token"],
                        "scope": SCOPE,
                        "resource": "https://127.0.0.1:28776/mcp",
                    },
                )
                self.assertEqual(wrong_resource.status_code, 400)
                self.assertEqual(
                    wrong_resource.json(),
                    {
                        "error": "invalid_grant",
                        "error_description": "resource does not match",
                    },
                )
                refreshed_with_resource = await client.post(
                    "/oauth/token",
                    data={
                        "grant_type": "refresh_token",
                        "client_id": "client-a",
                        "refresh_token": replacement["refresh_token"],
                        "scope": SCOPE,
                        "resource": "https://127.0.0.1:28775/mcp",
                    },
                )
                self.assertEqual(
                    refreshed_with_resource.status_code,
                    200,
                    refreshed_with_resource.text,
                )
                replacement = refreshed_with_resource.json()
                refreshed_with_empty_resource = await client.post(
                    "/oauth/token",
                    data={
                        "grant_type": "refresh_token",
                        "client_id": "client-a",
                        "refresh_token": replacement["refresh_token"],
                        "scope": SCOPE,
                        "resource": "",
                    },
                )
                self.assertEqual(
                    refreshed_with_empty_resource.status_code,
                    200,
                    refreshed_with_empty_resource.text,
                )
                replacement = refreshed_with_empty_resource.json()
                refreshed_with_trailing_slash = await client.post(
                    "/oauth/token",
                    data={
                        "grant_type": "refresh_token",
                        "client_id": "client-a",
                        "refresh_token": replacement["refresh_token"],
                        "scope": SCOPE,
                        "resource": "https://127.0.0.1:28775/mcp/",
                    },
                )
                self.assertEqual(
                    refreshed_with_trailing_slash.status_code,
                    200,
                    refreshed_with_trailing_slash.text,
                )
                replacement = refreshed_with_trailing_slash.json()
                reused = await client.post(
                    "/oauth/token",
                    data={
                        "grant_type": "refresh_token",
                        "client_id": "client-a",
                        "refresh_token": issued["refresh_token"],
                        "scope": SCOPE,
                        "resource": "https://127.0.0.1:28775/mcp",
                    },
                )
                self.assertEqual(reused.status_code, 400)
                denied = await client.post(
                    "/mcp",
                    headers={
                        "Authorization": f"Bearer {replacement['access_token']}",
                        "Accept": "application/json",
                    },
                    json={
                        "jsonrpc": "2.0",
                        "id": 1,
                        "method": "tools/list",
                        "params": {},
                    },
                )
                self.assertEqual(denied.status_code, 401)

                issued_b = await self.authorize(
                    client,
                    client_id="client-b",
                    callback_port=49153,
                    verifier="verifier-" + ("y" * 48),
                )
                revoked = await client.post(
                    "/oauth/revoke",
                    data={
                        "client_id": "client-b",
                        "token": issued_b["access_token"],
                        "token_type_hint": "access_token",
                    },
                )
                self.assertEqual(revoked.status_code, 200)
                denied_b = await client.post(
                    "/mcp",
                    headers={
                        "Authorization": f"Bearer {issued_b['access_token']}",
                        "Accept": "application/json",
                    },
                    json={
                        "jsonrpc": "2.0",
                        "id": 2,
                        "method": "tools/list",
                        "params": {},
                    },
                )
                self.assertEqual(denied_b.status_code, 401)

    def test_real_asgi_discovery_authorize_token_refresh_and_revoke(self) -> None:
        asyncio.run(self.exercise_http_oauth())

    async def exercise_redirect_failures(self) -> None:
        async with self.app.router.lifespan_context(self.app):
            transport = httpx.ASGITransport(app=self.app)
            async with httpx.AsyncClient(
                transport=transport,
                base_url="https://127.0.0.1:28775",
            ) as client:
                common = {
                    "client_id": "client-a",
                    "response_type": "code",
                    "code_challenge": pkce_challenge("z" * 48),
                    "code_challenge_method": "S256",
                    "state": "state",
                    "scope": SCOPE,
                    "resource": "https://127.0.0.1:28775/mcp",
                }
                wrong_host = await client.get(
                    "/oauth/authorize",
                    params={
                        **common,
                        "redirect_uri": "http://localhost:49152/callback",
                    },
                )
                self.assertEqual(wrong_host.status_code, 400)
                wrong_path = await client.get(
                    "/oauth/authorize",
                    params={
                        **common,
                        "redirect_uri": "http://127.0.0.1:49152/other",
                    },
                )
                self.assertEqual(wrong_path.status_code, 400)
                wrong_resource = await client.get(
                    "/oauth/authorize",
                    params={
                        **common,
                        "redirect_uri": "http://127.0.0.1:49152/callback",
                        "resource": "https://127.0.0.1:28776/mcp",
                    },
                )
                self.assertEqual(wrong_resource.status_code, 302)
                self.assertEqual(
                    parse_qs(urlsplit(wrong_resource.headers["location"]).query)[
                        "error"
                    ],
                    ["invalid_request"],
                )

    def test_redirect_exact_match_loopback_port_exception_and_resource(self) -> None:
        asyncio.run(self.exercise_redirect_failures())

    async def exercise_refresh_security_bindings(self) -> None:
        client = await self.provider.get_client("client-a")
        self.assertIsNotNone(client)
        defaults: dict[str, object] = {
            "resource": "https://127.0.0.1:28775/mcp",
            "instance_id": "instance-1",
            "runtime_id": "runtime-1",
            "grant_version": "grant-v1",
            "policy_version": "policy-v1",
        }
        mismatches = {
            "resource": "https://127.0.0.1:28776/mcp",
            "instance_id": "instance-other",
            "runtime_id": "runtime-other",
            "grant_version": "grant-other",
            "policy_version": "policy-other",
        }
        for index, (field, wrong_value) in enumerate(mismatches.items()):
            bindings = {**defaults, field: wrong_value}
            refresh_value = f"refresh-binding-{index}-" + ("r" * 48)
            access_value = f"access-binding-{index}-" + ("a" * 48)
            self.store.create_token_family(
                family_id=f"family-binding-{index}",
                client_id="client-a",
                scopes=[SCOPE],
                access_token=access_value,
                access_expires_at=9999999999,
                refresh_token=refresh_value,
                refresh_expires_at=9999999999,
                **bindings,
            )
            loaded = await self.provider.load_refresh_token(
                client, refresh_value
            )
            self.assertIsNotNone(loaded)
            with self.assertRaises(TokenError, msg=field):
                await self.provider.exchange_refresh_token(
                    client, loaded, [SCOPE]
                )
            self.assertIsNone(
                self.store.lookup_token(refresh_value, kind="refresh"),
                field,
            )

        expired_refresh = "refresh-expired-" + ("r" * 48)
        self.store.create_token_family(
            family_id="family-expired",
            client_id="client-a",
            scopes=[SCOPE],
            resource=str(defaults["resource"]),
            instance_id=str(defaults["instance_id"]),
            runtime_id=str(defaults["runtime_id"]),
            grant_version=str(defaults["grant_version"]),
            policy_version=str(defaults["policy_version"]),
            access_token="access-expired-" + ("a" * 48),
            access_expires_at=1,
            refresh_token=expired_refresh,
            refresh_expires_at=1,
        )
        loaded_expired = await self.provider.load_refresh_token(
            client, expired_refresh
        )
        self.assertIsNotNone(loaded_expired)
        with self.assertRaises(TokenError):
            await self.provider.exchange_refresh_token(
                client, loaded_expired, [SCOPE]
            )

    def test_refresh_expiry_and_all_security_bindings_fail_closed(self) -> None:
        asyncio.run(self.exercise_refresh_security_bindings())

    async def exercise_token_bindings(self) -> None:
        async with self.app.router.lifespan_context(self.app):
            transport = httpx.ASGITransport(app=self.app)
            async with httpx.AsyncClient(
                transport=transport,
                base_url="https://127.0.0.1:28775",
            ) as client:
                verifier = "binding-verifier-" + ("b" * 48)
                redirect = "http://127.0.0.1:49160/callback"
                authorized = await client.get(
                    "/oauth/authorize",
                    params={
                        "client_id": "client-a",
                        "redirect_uri": redirect,
                        "response_type": "code",
                        "code_challenge": pkce_challenge(verifier),
                        "code_challenge_method": "S256",
                        "state": "binding-state",
                        "scope": SCOPE,
                        "resource": "https://127.0.0.1:28775/mcp",
                    },
                )
                code = parse_qs(
                    urlsplit(authorized.headers["location"]).query
                )["code"][0]
                base_form = {
                    "grant_type": "authorization_code",
                    "client_id": "client-a",
                    "code": code,
                    "redirect_uri": redirect,
                    "code_verifier": verifier,
                }
                missing_resource = await client.post(
                    "/oauth/token", data=base_form
                )
                self.assertEqual(missing_resource.status_code, 400)
                wrong_resource = await client.post(
                    "/oauth/token",
                    data={
                        **base_form,
                        "resource": "https://127.0.0.1:28776/mcp",
                    },
                )
                self.assertEqual(wrong_resource.status_code, 400)
                wrong_redirect = await client.post(
                    "/oauth/token",
                    data={
                        **base_form,
                        "redirect_uri": "http://127.0.0.1:49161/callback",
                        "resource": "https://127.0.0.1:28775/mcp",
                    },
                )
                self.assertEqual(wrong_redirect.status_code, 400)
                wrong_verifier = await client.post(
                    "/oauth/token",
                    data={
                        **base_form,
                        "code_verifier": "wrong-verifier-" + ("w" * 48),
                        "resource": "https://127.0.0.1:28775/mcp",
                    },
                )
                self.assertEqual(wrong_verifier.status_code, 400)
                issued = await client.post(
                    "/oauth/token",
                    data={
                        **base_form,
                        "resource": "https://127.0.0.1:28775/mcp",
                    },
                )
                self.assertEqual(issued.status_code, 200, issued.text)

    def test_token_requires_resource_exact_redirect_and_pkce_s256(self) -> None:
        asyncio.run(self.exercise_token_bindings())

    def test_registration_priority_is_pre_registered_then_cimd_then_dcr(self) -> None:
        self.assertEqual(
            self.provider.select_registration(
                {"pre_registered": True, "CIMD": True, "DCR": True}
            ),
            "pre_registered",
        )
        self.assertEqual(
            self.provider.select_registration(
                {"pre_registered": False, "CIMD": True, "DCR": True}
            ),
            "CIMD",
        )
        self.assertEqual(
            self.provider.select_registration(
                {"pre_registered": False, "CIMD": False, "DCR": True}
            ),
            "DCR",
        )

    def test_registration_mode_marks_dcr_unverified_and_rate_limits_abuse(self) -> None:
        cimd = client_registration("client-cimd")
        self.provider.register_cimd(cimd)
        self.assertEqual(
            self.store.client_registration_mode("client-cimd"),
            "CIMD",
        )

        provider = LocalOAuthProvider(
            self.store,
            self.provider.config,
            authorization_decider=lambda _request: True,
            dcr_limit_per_minute=1,
        )
        dcr = client_registration("client-dcr-0001")
        asyncio.run(provider.register_client(dcr))
        self.assertEqual(
            self.store.client_registration_mode("client-dcr-0001"),
            "DCR",
        )
        with self.assertRaises(RegistrationError):
            asyncio.run(provider.register_client(client_registration("client-dcr-0002")))


if __name__ == "__main__":
    unittest.main()
