from __future__ import annotations

import base64
import hashlib
import json
import re
import time

from typing import Any

import anyio
from mcp.server.auth.settings import (
    AuthSettings,
    ClientRegistrationOptions,
    RevocationOptions,
)
from mcp.server.fastmcp import FastMCP
from mcp.server.transport_security import TransportSecuritySettings
from mcp.shared.version import SUPPORTED_PROTOCOL_VERSIONS
from starlette.applications import Starlette
from starlette.requests import Request
from starlette.responses import JSONResponse, Response
from starlette.routing import Route
from starlette.types import ASGIApp, Message, Receive, Scope, Send

from .audit import AuditLogger
from .auth import LocalOAuthProvider, SCOPE
from .mcp_tools import KnowledgeService, SERVER_INSTRUCTIONS, register_tools


PROTOCOL_VERSION = "2025-11-25"
ACCEPTED_PROTOCOL_VERSIONS = frozenset(SUPPORTED_PROTOCOL_VERSIONS)
MAX_HEADER_BYTES = 8_192
MAX_REQUEST_BYTES = 32_768
MAX_RESPONSE_BYTES = 65_536
MAX_CONCURRENT_REQUESTS = 4
REQUEST_TIMEOUT_SECONDS = 30
_PKCE_VERIFIER = re.compile(r"^[A-Za-z0-9._~-]{43,128}$")


async def _json_response(
    scope: Scope,
    receive: Receive,
    send: Send,
    status: int,
    payload: dict[str, Any],
    *,
    headers: list[tuple[bytes, bytes]] | None = None,
) -> None:
    body = json.dumps(
        payload,
        ensure_ascii=True,
        separators=(",", ":"),
        sort_keys=True,
    ).encode("utf-8")
    response_headers = [
        (b"content-type", b"application/json"),
        (b"content-length", str(len(body)).encode("ascii")),
        (b"cache-control", b"no-store"),
    ]
    response_headers.extend(headers or [])
    await send(
        {
            "type": "http.response.start",
            "status": status,
            "headers": response_headers,
        }
    )
    await send({"type": "http.response.body", "body": body})


class TransportContractMiddleware:
    """Enforces the frozen stateless loopback HTTP profile before FastMCP."""

    def __init__(
        self,
        app: ASGIApp,
        *,
        canonical_host: str,
        canonical_origin: str,
        concurrent_requests: int = MAX_CONCURRENT_REQUESTS,
        timeout_seconds: float = REQUEST_TIMEOUT_SECONDS,
    ) -> None:
        self.app = app
        self.canonical_host = canonical_host
        self.canonical_origin = canonical_origin
        self._semaphore = anyio.Semaphore(concurrent_requests)
        self.timeout_seconds = timeout_seconds

    @staticmethod
    def _headers(scope: Scope) -> dict[str, str]:
        return {
            key.decode("latin-1").lower(): value.decode("latin-1")
            for key, value in scope.get("headers", [])
        }

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return
        headers = self._headers(scope)
        header_size = sum(
            len(key) + len(value) + 4 for key, value in scope.get("headers", [])
        )
        if header_size > MAX_HEADER_BYTES:
            await _json_response(
                scope, receive, send, 431, {"error": "REQUEST_HEADERS_TOO_LARGE"}
            )
            return
        if scope.get("scheme") != "https":
            await _json_response(
                scope, receive, send, 400, {"error": "TLS_REQUIRED"}
            )
            return
        if headers.get("host") != self.canonical_host:
            await _json_response(
                scope, receive, send, 421, {"error": "CANONICAL_HOST_REQUIRED"}
            )
            return
        origin = headers.get("origin")
        if origin is not None and origin != self.canonical_origin:
            await _json_response(
                scope, receive, send, 403, {"error": "ORIGIN_MISMATCH"}
            )
            return
        path = scope.get("path", "")
        method = scope.get("method", "")
        if path == "/mcp" and method in {"GET", "DELETE"}:
            await _json_response(
                scope,
                receive,
                send,
                405,
                {"error": "METHOD_NOT_ALLOWED"},
                headers=[(b"allow", b"POST")],
            )
            return
        if path == "/mcp":
            accept = headers.get("accept", "")
            if (
                "text/event-stream" in accept
                and "application/json" not in accept
            ):
                await _json_response(
                    scope, receive, send, 406, {"error": "SSE_NOT_SUPPORTED"}
                )
                return
            version = headers.get("mcp-protocol-version")
            if version is not None and version not in ACCEPTED_PROTOCOL_VERSIONS:
                await _json_response(
                    scope,
                    receive,
                    send,
                    400,
                    {"error": "PROTOCOL_VERSION_UNSUPPORTED"},
                )
                return
        body_messages: list[Message] = []
        body_size = 0
        while True:
            message = await receive()
            body_messages.append(message)
            if message["type"] != "http.request":
                break
            body_size += len(message.get("body", b""))
            if body_size > MAX_REQUEST_BYTES:
                await _json_response(
                    scope, receive, send, 413, {"error": "REQUEST_TOO_LARGE"}
                )
                return
            if not message.get("more_body", False):
                break
        next_message = 0

        async def replay_receive() -> Message:
            nonlocal next_message
            if next_message < len(body_messages):
                message = body_messages[next_message]
                next_message += 1
                return message
            return {"type": "http.disconnect"}

        if path != "/mcp":
            await self.app(scope, replay_receive, send)
            return
        if self._semaphore.value == 0:
            await _json_response(
                scope, replay_receive, send, 429, {"error": "RATE_LIMITED"}
            )
            return
        response_start: Message | None = None
        response_body = bytearray()
        response_finished = False
        response_overflow = False

        async def limited_send(message: Message) -> None:
            nonlocal response_start, response_finished, response_overflow
            if message["type"] == "http.response.start":
                response_start = message
                return
            if message["type"] != "http.response.body":
                return
            response_body.extend(message.get("body", b""))
            if len(response_body) > MAX_RESPONSE_BYTES:
                response_overflow = True
            if message.get("more_body", False):
                return
            response_finished = True
            if response_overflow:
                await _json_response(
                    scope,
                    replay_receive,
                    send,
                    500,
                    {"error": "RESPONSE_TOO_LARGE"},
                )
                return
            if response_start is None:
                await _json_response(
                    scope,
                    replay_receive,
                    send,
                    500,
                    {"error": "TRANSPORT_RESPONSE_INVALID"},
                )
                return
            await send(response_start)
            await send(
                {
                    "type": "http.response.body",
                    "body": bytes(response_body),
                    "more_body": False,
                }
            )

        async with self._semaphore:
            try:
                with anyio.fail_after(self.timeout_seconds):
                    await self.app(scope, replay_receive, limited_send)
                    if not response_finished:
                        await _json_response(
                            scope,
                            replay_receive,
                            send,
                            500,
                            {"error": "TRANSPORT_RESPONSE_INCOMPLETE"},
                        )
            except TimeoutError:
                await _json_response(
                    scope, replay_receive, send, 504, {"error": "REQUEST_TIMEOUT"}
                )


def _remap_oauth_routes(
    app: Starlette,
    provider: LocalOAuthProvider,
    *,
    enable_dcr: bool,
) -> None:
    """mcp 1.28.1 uses root OAuth paths; the frozen contract uses /oauth/*."""

    async def protected_resource_metadata(_request: object) -> JSONResponse:
        issuer = provider.config.issuer_url.rstrip("/")
        return JSONResponse(
            {
                "resource": provider.config.resource_url,
                "authorization_servers": [issuer],
                "scopes_supported": [SCOPE],
                "bearer_methods_supported": ["header"],
            },
            headers={"Cache-Control": "public, max-age=3600"},
        )

    async def metadata(_request: object) -> JSONResponse:
        issuer = provider.config.issuer_url.rstrip("/")
        payload: dict[str, Any] = {
            "issuer": issuer,
            "authorization_endpoint": f"{issuer}/oauth/authorize",
            "token_endpoint": f"{issuer}/oauth/token",
            "revocation_endpoint": f"{issuer}/oauth/revoke",
            "response_types_supported": ["code"],
            "grant_types_supported": ["authorization_code", "refresh_token"],
            "code_challenge_methods_supported": ["S256"],
            "token_endpoint_auth_methods_supported": ["none"],
            "scopes_supported": [SCOPE],
        }
        if enable_dcr:
            payload["registration_endpoint"] = f"{issuer}/oauth/register"
        return JSONResponse(
            payload,
            headers={"Cache-Control": "no-store"},
        )

    async def revoke(request: Request) -> Response:
        form = await request.form()
        client_id = form.get("client_id")
        token_value = form.get("token")
        if not isinstance(client_id, str) or not isinstance(token_value, str):
            return JSONResponse(
                {"error": "invalid_request"},
                status_code=400,
                headers={"Cache-Control": "no-store"},
            )
        client = await provider.get_client(client_id)
        if client is None:
            return JSONResponse(
                {"error": "unauthorized_client"},
                status_code=401,
                headers={"Cache-Control": "no-store"},
            )
        token = await provider.load_access_token(token_value)
        if token is None:
            token = await provider.load_refresh_token(client, token_value)
        if token is not None and token.client_id == client_id:
            await provider.revoke_token(token)
        return Response(
            status_code=200,
            headers={"Cache-Control": "no-store", "Pragma": "no-cache"},
        )

    def token_error(
        error: str,
        description: str,
        *,
        status_code: int = 400,
    ) -> JSONResponse:
        return JSONResponse(
            {"error": error, "error_description": description},
            status_code=status_code,
            headers={"Cache-Control": "no-store", "Pragma": "no-cache"},
        )

    async def token(request: Request) -> Response:
        form = await request.form()
        client_id = form.get("client_id")
        if not isinstance(client_id, str):
            return token_error(
                "unauthorized_client", "client_id is required", status_code=401
            )
        client = await provider.get_client(client_id)
        if client is None or client.token_endpoint_auth_method != "none":
            return token_error(
                "unauthorized_client",
                "public client authentication failed",
                status_code=401,
            )
        grant_type = form.get("grant_type")
        if grant_type == "authorization_code":
            resource = form.get("resource")
            if resource != provider.config.resource_url:
                return token_error("invalid_grant", "resource does not match")
            code = form.get("code")
            redirect_uri = form.get("redirect_uri")
            verifier = form.get("code_verifier")
            if not all(
                isinstance(value, str)
                for value in (code, redirect_uri, verifier)
            ):
                return token_error(
                    "invalid_request",
                    "code, redirect_uri, and code_verifier are required",
                )
            authorization_code = await provider.load_authorization_code(client, code)
            if (
                authorization_code is None
                or authorization_code.expires_at < time.time()
            ):
                return token_error(
                    "invalid_grant", "authorization code is invalid or expired"
                )
            if str(authorization_code.redirect_uri) != redirect_uri:
                return token_error("invalid_grant", "redirect_uri does not match")
            if authorization_code.resource != resource:
                return token_error("invalid_grant", "resource binding does not match")
            if not _PKCE_VERIFIER.fullmatch(verifier):
                return token_error("invalid_grant", "PKCE verifier is invalid")
            challenge = (
                base64.urlsafe_b64encode(
                    hashlib.sha256(verifier.encode("ascii")).digest()
                )
                .decode("ascii")
                .rstrip("=")
            )
            if challenge != authorization_code.code_challenge:
                return token_error("invalid_grant", "PKCE verifier does not match")
            try:
                issued = await provider.exchange_authorization_code(
                    client, authorization_code
                )
            except Exception as exc:
                return token_error(
                    str(getattr(exc, "error", "invalid_grant")),
                    str(getattr(exc, "error_description", "token exchange failed")),
                )
        elif grant_type == "refresh_token":
            refresh_value = form.get("refresh_token")
            if not isinstance(refresh_value, str):
                return token_error("invalid_request", "refresh_token is required")
            refresh_token = await provider.load_refresh_token(client, refresh_value)
            requested_resource = form.get("resource")
            configured_resource = provider.config.resource_url
            resource = (
                refresh_token.resource
                if (
                    requested_resource in (None, "")
                    and refresh_token is not None
                )
                else requested_resource
            )
            resource_matches = (
                resource == configured_resource
                or (
                    isinstance(resource, str)
                    and resource.endswith("/")
                    and resource[:-1] == configured_resource
                )
            )
            if not resource_matches:
                return token_error("invalid_grant", "resource does not match")
            if (
                refresh_token is None
                or (
                    refresh_token.expires_at is not None
                    and refresh_token.expires_at < time.time()
                )
                or refresh_token.resource != configured_resource
            ):
                return token_error("invalid_grant", "refresh token is invalid")
            requested_scope = form.get("scope")
            scopes = (
                str(requested_scope).split(" ")
                if requested_scope is not None
                else refresh_token.scopes
            )
            if scopes != [SCOPE] or scopes != refresh_token.scopes:
                return token_error("invalid_scope", "scope does not match")
            try:
                issued = await provider.exchange_refresh_token(
                    client, refresh_token, scopes
                )
            except Exception as exc:
                return token_error(
                    str(getattr(exc, "error", "invalid_grant")),
                    str(getattr(exc, "error_description", "token exchange failed")),
                )
        else:
            return token_error(
                "unsupported_grant_type", "grant_type is not supported"
            )
        return JSONResponse(
            issued.model_dump(mode="json", exclude_none=True),
            headers={"Cache-Control": "no-store", "Pragma": "no-cache"},
        )

    path_map = {
        "/authorize": "/oauth/authorize",
        "/token": "/oauth/token",
        "/revoke": "/oauth/revoke",
        "/register": "/oauth/register",
    }
    routes: list[Any] = []
    for route in app.router.routes:
        path = getattr(route, "path", None)
        if path == "/.well-known/oauth-authorization-server":
            continue
        if path == "/.well-known/oauth-protected-resource/mcp":
            routes.append(
                Route(
                    path,
                    endpoint=protected_resource_metadata,
                    methods=route.methods,
                )
            )
        elif path in path_map:
            endpoint = {
                "/revoke": revoke,
                "/token": token,
            }.get(path, route.endpoint)
            routes.append(
                Route(
                    path_map[path],
                    endpoint=endpoint,
                    methods=route.methods,
                )
            )
        else:
            routes.append(route)
    routes.insert(
        0,
        Route(
            "/.well-known/oauth-authorization-server",
            endpoint=metadata,
            methods=["GET", "OPTIONS"],
        ),
    )
    app.router.routes = routes


def build_transport_app(
    *,
    provider: LocalOAuthProvider,
    service: KnowledgeService,
    canonical_host: str,
    canonical_origin: str,
    audit: AuditLogger | None = None,
    enable_dcr: bool = False,
) -> Starlette:
    auth_settings = AuthSettings(
        issuer_url=provider.config.issuer_url,
        resource_server_url=provider.config.resource_url,
        required_scopes=[SCOPE],
        client_registration_options=ClientRegistrationOptions(
            enabled=enable_dcr,
            valid_scopes=[SCOPE],
            default_scopes=[SCOPE],
        ),
        revocation_options=RevocationOptions(enabled=True),
    )
    server = FastMCP(
        name="SAPD Wiki",
        instructions=SERVER_INSTRUCTIONS,
        host="127.0.0.1",
        port=int(canonical_host.rsplit(":", 1)[1]),
        streamable_http_path="/mcp",
        json_response=True,
        stateless_http=True,
        auth=auth_settings,
        auth_server_provider=provider,
        transport_security=TransportSecuritySettings(
            enable_dns_rebinding_protection=True,
            allowed_hosts=[canonical_host],
            allowed_origins=[canonical_origin],
        ),
    )
    register_tools(server, service, audit=audit)
    app = server.streamable_http_app()
    _remap_oauth_routes(app, provider, enable_dcr=enable_dcr)
    app.state.fastmcp = server
    app.state.oauth_provider = provider
    app.add_middleware(
        TransportContractMiddleware,
        canonical_host=canonical_host,
        canonical_origin=canonical_origin,
    )
    return app
