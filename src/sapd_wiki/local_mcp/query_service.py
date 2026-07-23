"""Transport-agnostic implementation of the five read-only knowledge capabilities."""

from __future__ import annotations

import json
import unicodedata
from pathlib import Path
from typing import Any, Mapping

from .contracts import ContractBundle, load_contracts
from .cursor import CursorCodec, CursorContext
from .errors import (
    InvalidInputError,
    ObjectNotAvailableError,
    PolicyBlockedError,
    ResponseTooLargeError,
)
from .evidence import EvidenceResolver
from .identity import IdentityResolver
from .models import Page, RequestContext, ServiceResponse
from .policy import AiExposurePolicy
from .readonly_runtime import ConnectFactory, ConnectObserver, ReadOnlyRuntimeContext
from .repository import BaseKnowledgeRepository


SORT_VERSION = "fixture-canonical-ref-v1"


def _normalized_text(
    value: Any,
    *,
    maximum: int,
    allow_empty: bool = False,
) -> str:
    if not isinstance(value, str):
        raise InvalidInputError("input must be a string")
    normalized = unicodedata.normalize("NFKC", value).strip()
    if any(unicodedata.category(character).startswith("C") for character in normalized):
        raise InvalidInputError("control characters are forbidden")
    if not allow_empty and not normalized:
        raise InvalidInputError("empty input is forbidden")
    if len(normalized) > maximum:
        raise InvalidInputError("input exceeds the character limit")
    return normalized


class KnowledgeQueryService:
    """Own the D1 runtime and expose only contract-shaped read operations."""

    def __init__(
        self,
        *,
        contracts: ContractBundle,
        runtime: ReadOnlyRuntimeContext,
        repository: BaseKnowledgeRepository,
        policy: AiExposurePolicy,
        identity: IdentityResolver,
        evidence: EvidenceResolver,
        cursor: CursorCodec,
    ) -> None:
        self.contracts = contracts
        self.runtime = runtime
        self.repository = repository
        self.policy = policy
        self.identity = identity
        self.evidence = evidence
        self.cursor = cursor
        self.versions = repository.versions()
        if self.versions.policy_version != policy.policy_version:
            raise PolicyBlockedError("policy version does not match synthetic knowledge")
        if self.versions.identity_version != identity.identity_version:
            raise PolicyBlockedError("identity version does not match synthetic knowledge")
        policy.validate_integrity(
            manifest_digest=self.versions.manifest_digest,
            object_types=repository.object_types(),
            relation_types=repository.relation_types(),
        )

    @classmethod
    def create(
        cls,
        *,
        synthetic_root: Path,
        synthetic_base: Path,
        cursor_key: bytes,
        contracts: ContractBundle | None = None,
        policy: AiExposurePolicy | None = None,
        identity: IdentityResolver | None = None,
        evidence: EvidenceResolver | None = None,
        cursor_ttl_seconds: int = 900,
        cursor_clock: Any = None,
        connect_factory: ConnectFactory | None = None,
        connect_observer: ConnectObserver | None = None,
    ) -> "KnowledgeQueryService":
        bundle = contracts or load_contracts()
        runtime_arguments: dict[str, Any] = {
            "synthetic_root": synthetic_root,
            "synthetic_base": synthetic_base,
            "connect_observer": connect_observer,
        }
        if connect_factory is not None:
            runtime_arguments["connect_factory"] = connect_factory
        runtime = ReadOnlyRuntimeContext(**runtime_arguments).open()
        try:
            repository = BaseKnowledgeRepository(runtime)
            versions = repository.versions()
            resolved_policy = policy or AiExposurePolicy.synthetic(
                policy_version=versions.policy_version,
                expected_manifest_digest=versions.manifest_digest,
            )
            resolved_identity = identity or IdentityResolver(
                identity_version=versions.identity_version
            )
            cursor_arguments: dict[str, Any] = {"ttl_seconds": cursor_ttl_seconds}
            if cursor_clock is not None:
                cursor_arguments["clock"] = cursor_clock
            return cls(
                contracts=bundle,
                runtime=runtime,
                repository=repository,
                policy=resolved_policy,
                identity=resolved_identity,
                evidence=evidence or EvidenceResolver(),
                cursor=CursorCodec(cursor_key, **cursor_arguments),
            )
        except Exception:
            runtime.close()
            raise

    def close(self) -> None:
        self.runtime.close()

    def __enter__(self) -> "KnowledgeQueryService":
        return self

    def __exit__(self, _exc_type: Any, _exc: Any, _traceback: Any) -> None:
        self.close()

    def _request(self, request: RequestContext) -> RequestContext:
        if not isinstance(request, RequestContext):
            raise InvalidInputError("request context is required")
        client_id = _normalized_text(request.client_id, maximum=256)
        grant_version = _normalized_text(request.grant_version, maximum=256)
        correlation_id = _normalized_text(request.correlation_id, maximum=256)
        if request.scope != self.contracts.scope:
            raise InvalidInputError("request scope does not match the frozen contract")
        return RequestContext(
            client_id=client_id,
            grant_version=grant_version,
            scope=request.scope,
            correlation_id=correlation_id,
        )

    def _limit(self, tool_name: str, value: int | None) -> int:
        tool = self.contracts.tool(tool_name)
        default = tool.get("default_items")
        maximum = tool.get("max_items")
        limit = default if value is None else value
        if (
            isinstance(limit, bool)
            or not isinstance(limit, int)
            or not isinstance(maximum, int)
            or not 1 <= limit <= maximum
        ):
            raise InvalidInputError(f"{tool_name} limit is outside the contract")
        return limit

    def _cursor_context(
        self,
        *,
        tool: str,
        parameters: Mapping[str, Any],
        request: RequestContext,
    ) -> CursorContext:
        return CursorContext(
            tool=tool,
            normalized_parameters=dict(parameters),
            client=request.client_id,
            grant=request.grant_version,
            scope=request.scope,
            policy_version=self.versions.policy_version,
            knowledge_version=self.versions.knowledge_version,
            identity_version=self.versions.identity_version,
            sort_version=SORT_VERSION,
        )

    def _response(
        self,
        *,
        tool_name: str,
        data: dict[str, Any],
        request: RequestContext,
        page: Page | None = None,
    ) -> ServiceResponse:
        output_contract = self.contracts.protocol_tools.get("output_contract")
        if not isinstance(output_contract, dict):
            raise PolicyBlockedError("output contract is unavailable")
        tool = self.contracts.tool(tool_name)
        text_target = tool.get("text_character_target")
        encoded_data = json.dumps(
            data,
            ensure_ascii=False,
            sort_keys=True,
            separators=(",", ":"),
        )
        if isinstance(text_target, int) and len(encoded_data) > text_target:
            raise ResponseTooLargeError(f"{tool_name} response exceeds its character target")
        response = ServiceResponse(
            contract_version=str(output_contract["contract_version"]),
            source_channel=str(output_contract["source_channel"]),
            knowledge_version=self.versions.knowledge_version,
            policy_version=self.versions.policy_version,
            identity_version=self.versions.identity_version,
            grant_version=request.grant_version,
            content_trust=str(output_contract["content_trust"]),
            data=data,
            page=page or Page(),
            warnings=(),
            correlation_id=request.correlation_id,
        )
        encoded_response = json.dumps(
            response.to_dict(),
            ensure_ascii=False,
            sort_keys=True,
            separators=(",", ":"),
        ).encode("utf-8")
        if len(encoded_response) > self.contracts.response_bytes:
            raise ResponseTooLargeError()
        return response

    def search_knowledge(
        self,
        query: str,
        *,
        request: RequestContext,
        limit: int | None = None,
        cursor: str | None = None,
    ) -> ServiceResponse:
        checked_request = self._request(request)
        normalized_query = _normalized_text(query, maximum=256).casefold()
        checked_limit = self._limit("search_knowledge", limit)
        parameters = {"query": normalized_query, "limit": checked_limit}
        cursor_context = self._cursor_context(
            tool="search_knowledge",
            parameters=parameters,
            request=checked_request,
        )
        after_ref = self.cursor.decode(cursor, cursor_context) if cursor else ""
        rows = self.repository.search_visible(
            query=normalized_query,
            allowed_object_types=self.policy.allowed_object_types,
            after_ref=after_ref,
            limit=checked_limit + 1,
        )
        has_more = len(rows) > checked_limit
        selected = rows[:checked_limit]
        items = [self.policy.project(row).to_dict() for row in selected]
        next_cursor = None
        if has_more and selected:
            next_cursor = self.cursor.encode(
                cursor_context,
                last_sort_key=selected[-1].canonical_ref,
            )
        return self._response(
            tool_name="search_knowledge",
            data={"items": items},
            request=checked_request,
            page=Page(next_cursor=next_cursor, has_more=has_more),
        )

    def get_knowledge_object(
        self,
        canonical_ref: str,
        *,
        request: RequestContext,
    ) -> ServiceResponse:
        checked_request = self._request(request)
        resolved_ref = self.identity.resolve(canonical_ref)
        record = self.repository.get_visible_object(
            resolved_ref,
            allowed_object_types=self.policy.allowed_object_types,
        )
        if record is None:
            raise ObjectNotAvailableError()
        return self._response(
            tool_name="get_knowledge_object",
            data=self.policy.project(record).to_dict(),
            request=checked_request,
        )

    def get_related_knowledge(
        self,
        canonical_ref: str,
        direction: str,
        *,
        request: RequestContext,
        limit: int | None = None,
        cursor: str | None = None,
    ) -> ServiceResponse:
        checked_request = self._request(request)
        resolved_ref = self.identity.resolve(canonical_ref)
        if direction not in {"outgoing", "incoming", "both"}:
            raise InvalidInputError("relation direction is invalid")
        origin = self.repository.get_visible_object(
            resolved_ref,
            allowed_object_types=self.policy.allowed_object_types,
        )
        if origin is None:
            raise ObjectNotAvailableError()
        checked_limit = self._limit("get_related_knowledge", limit)
        parameters = {
            "canonical_ref": resolved_ref,
            "direction": direction,
            "limit": checked_limit,
        }
        cursor_context = self._cursor_context(
            tool="get_related_knowledge",
            parameters=parameters,
            request=checked_request,
        )
        after_ref = self.cursor.decode(cursor, cursor_context) if cursor else ""
        rows = self.repository.related_visible(
            canonical_ref=resolved_ref,
            direction=direction,
            allowed_object_types=self.policy.allowed_object_types,
            allowed_relation_types=self.policy.allowed_relation_types,
            after_ref=after_ref,
            limit=checked_limit + 1,
        )
        has_more = len(rows) > checked_limit
        selected = rows[:checked_limit]
        next_cursor = None
        if has_more and selected:
            next_cursor = self.cursor.encode(
                cursor_context,
                last_sort_key=selected[-1].relation_ref,
            )
        return self._response(
            tool_name="get_related_knowledge",
            data={"items": [relation.to_dict() for relation in selected]},
            request=checked_request,
            page=Page(next_cursor=next_cursor, has_more=has_more),
        )

    def get_source_evidence(
        self,
        canonical_ref: str,
        *,
        include_excerpt: bool,
        request: RequestContext,
        limit: int | None = None,
        cursor: str | None = None,
    ) -> ServiceResponse:
        checked_request = self._request(request)
        resolved_ref = self.identity.resolve(canonical_ref)
        record = self.repository.get_visible_object(
            resolved_ref,
            allowed_object_types=self.policy.allowed_object_types,
        )
        if record is None:
            raise ObjectNotAvailableError()
        checked_limit = self._limit("get_source_evidence", limit)
        if cursor is not None:
            cursor_context = self._cursor_context(
                tool="get_source_evidence",
                parameters={
                    "canonical_ref": resolved_ref,
                    "include_excerpt": include_excerpt,
                    "limit": checked_limit,
                },
                request=checked_request,
            )
            self.cursor.decode(cursor, cursor_context)
        evidence = self.evidence.resolve(
            resolved_ref,
            include_excerpt=include_excerpt,
        )
        return self._response(
            tool_name="get_source_evidence",
            data={"items": [item.to_dict() for item in evidence]},
            request=checked_request,
        )

    def get_knowledge_version(
        self,
        *,
        request: RequestContext,
    ) -> ServiceResponse:
        checked_request = self._request(request)
        return self._response(
            tool_name="get_knowledge_version",
            data=self.versions.to_dict(),
            request=checked_request,
        )
