"""Bind authenticated MCP requests to the transport-agnostic D1 query core."""

from __future__ import annotations

import secrets
from typing import Any, Literal

from mcp.server.auth.middleware.auth_context import get_access_token

from .auth import SCOPE
from .models import RequestContext
from .query_service import KnowledgeQueryService


class CoreAdapterError(RuntimeError):
    """Stable fail-closed error translated by the MCP Tool boundary."""

    def __init__(self, code: str, message: str) -> None:
        super().__init__(message)
        self.code = code


class CoreKnowledgeServiceAdapter:
    """Inject OAuth client and grant bindings into every D1 query."""

    def __init__(self, core: KnowledgeQueryService) -> None:
        self._core = core

    def _request(self) -> RequestContext:
        token = get_access_token()
        if token is None:
            raise CoreAdapterError("AUTH_REQUIRED", "authenticated MCP context is required")
        if not isinstance(token.client_id, str) or not token.client_id:
            raise CoreAdapterError("AUTH_REQUIRED", "authenticated client identity is missing")
        core_scope = str(getattr(self._core, "scope", SCOPE))
        if token.scopes != [core_scope]:
            raise CoreAdapterError("AUTH_REQUIRED", "authenticated scope is not approved")
        claims = token.claims or {}
        grant_version = claims.get("grant_version")
        policy_version = claims.get("policy_version")
        if not isinstance(grant_version, str) or not grant_version:
            raise CoreAdapterError("POLICY_BLOCKED", "grant version binding is missing")
        if policy_version != self._core.versions.policy_version:
            raise CoreAdapterError("POLICY_BLOCKED", "policy version binding is stale")
        return RequestContext(
            client_id=token.client_id,
            grant_version=grant_version,
            scope=core_scope,
            correlation_id=secrets.token_urlsafe(18),
        )

    async def search_knowledge(
        self,
        *,
        query: str,
        limit: int,
        cursor: str | None,
        object_types: list[str] | None = None,
        category_codes: list[str] | None = None,
        source_refs: list[str] | None = None,
        statuses: list[str] | None = None,
        edition_roles: list[str] | None = None,
    ) -> dict[str, Any]:
        arguments: dict[str, Any] = {
            "request": self._request(),
            "limit": limit,
            "cursor": cursor,
        }
        optional = {
            "object_types": object_types,
            "category_codes": category_codes,
            "source_refs": source_refs,
            "statuses": statuses,
            "edition_roles": edition_roles,
        }
        arguments.update(
            (name, value) for name, value in optional.items() if value is not None
        )
        return self._core.search_knowledge(query, **arguments).to_dict()

    async def get_knowledge_object(
        self,
        *,
        canonical_ref: str,
    ) -> dict[str, Any]:
        return self._core.get_knowledge_object(
            canonical_ref,
            request=self._request(),
        ).to_dict()

    async def get_related_knowledge(
        self,
        *,
        canonical_ref: str,
        direction: Literal["outgoing", "incoming", "both"],
        limit: int,
        cursor: str | None,
        relation_types: list[str] | None = None,
        include_bindings: bool = False,
        object_types: list[str] | None = None,
    ) -> dict[str, Any]:
        arguments: dict[str, Any] = {
            "request": self._request(),
            "limit": limit,
            "cursor": cursor,
        }
        if relation_types is not None:
            arguments["relation_types"] = relation_types
        if include_bindings:
            arguments["include_bindings"] = True
        if object_types is not None:
            arguments["object_types"] = object_types
        return self._core.get_related_knowledge(
            canonical_ref,
            direction,
            **arguments,
        ).to_dict()

    async def get_source_evidence(
        self,
        *,
        canonical_ref: str,
        include_excerpt: Literal[False],
        limit: int,
        cursor: str | None,
    ) -> dict[str, Any]:
        return self._core.get_source_evidence(
            canonical_ref,
            include_excerpt=include_excerpt,
            request=self._request(),
            limit=limit,
            cursor=cursor,
        ).to_dict()

    async def get_knowledge_version(self) -> dict[str, Any]:
        return self._core.get_knowledge_version(
            request=self._request(),
        ).to_dict()
