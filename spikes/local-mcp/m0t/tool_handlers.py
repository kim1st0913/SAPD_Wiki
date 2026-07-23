from __future__ import annotations

import base64
import hashlib
import hmac
import json
from pathlib import Path
from typing import Any

from policy_engine import PolicyError, decide_object, normalize_text, project_object
from runtime_probe import ReadOnlyRuntimeProbe, RuntimeProbeError


CONTRACT_VERSION = "sapd-mcp-tools-v1"
KNOWLEDGE_VERSION = "fixture-knowledge-v1"
POLICY_VERSION = "fixture-policy-v1"
IDENTITY_VERSION = "fixture-identity-v1"
GRANT_VERSION = "fixture-grant-v1"
MAX_RESPONSE_BYTES = 65536


class ToolError(ValueError):
    def __init__(self, code: str, message: str) -> None:
        super().__init__(message)
        self.code = code


class CursorCodec:
    def __init__(self, key: bytes) -> None:
        if len(key) < 32:
            raise ValueError("cursor HMAC key must be at least 256 bits")
        self._key = key

    def encode(self, payload: dict[str, Any]) -> str:
        raw = json.dumps(payload, sort_keys=True, separators=(",", ":")).encode("utf-8")
        signature = hmac.new(self._key, raw, hashlib.sha256).digest()
        return base64.urlsafe_b64encode(raw + signature).decode("ascii").rstrip("=")

    def decode(self, cursor: str) -> dict[str, Any]:
        try:
            padding = "=" * (-len(cursor) % 4)
            combined = base64.urlsafe_b64decode(cursor + padding)
        except Exception as exc:
            raise ToolError("CURSOR_STALE", "cursor is invalid") from exc
        if len(combined) <= hashlib.sha256().digest_size:
            raise ToolError("CURSOR_STALE", "cursor is invalid")
        raw = combined[:-hashlib.sha256().digest_size]
        provided = combined[-hashlib.sha256().digest_size :]
        expected = hmac.new(self._key, raw, hashlib.sha256).digest()
        if not hmac.compare_digest(provided, expected):
            raise ToolError("CURSOR_STALE", "cursor integrity failed")
        try:
            payload = json.loads(raw)
        except json.JSONDecodeError as exc:
            raise ToolError("CURSOR_STALE", "cursor payload is invalid") from exc
        return payload


class ToolHandlers:
    def __init__(
        self,
        *,
        test_root: Path,
        synthetic_base: Path,
        cursor_key: bytes,
    ) -> None:
        self._test_root = test_root
        self._synthetic_base = synthetic_base
        self._cursor = CursorCodec(cursor_key)

    @staticmethod
    def definitions() -> list[dict[str, Any]]:
        return [
            {
                "name": "search_knowledge",
                "description": "Search policy-allowed synthetic SAPD knowledge summaries.",
                "inputSchema": {
                    "type": "object",
                    "additionalProperties": False,
                    "required": ["query"],
                    "properties": {
                        "query": {"type": "string", "minLength": 1, "maxLength": 256},
                        "limit": {"type": "integer", "minimum": 1, "maximum": 15},
                        "cursor": {"type": "string", "minLength": 1, "maxLength": 2048},
                    },
                },
                "annotations": {"readOnlyHint": True},
            },
            {
                "name": "get_knowledge_object",
                "description": "Get one exact policy-allowed synthetic knowledge object.",
                "inputSchema": {
                    "type": "object",
                    "additionalProperties": False,
                    "required": ["canonical_ref"],
                    "properties": {
                        "canonical_ref": {
                            "type": "string",
                            "pattern": "^fixture://[a-z0-9./_-]+$",
                            "maxLength": 512,
                        }
                    },
                },
                "annotations": {"readOnlyHint": True},
            },
            {
                "name": "get_related_knowledge",
                "description": "Get visible synthetic relations for one exact object.",
                "inputSchema": {
                    "type": "object",
                    "additionalProperties": False,
                    "required": ["canonical_ref", "direction"],
                    "properties": {
                        "canonical_ref": {
                            "type": "string",
                            "pattern": "^fixture://[a-z0-9./_-]+$",
                            "maxLength": 512,
                        },
                        "direction": {"enum": ["outgoing", "incoming", "both"]},
                        "limit": {"type": "integer", "minimum": 1, "maximum": 30},
                    },
                },
                "annotations": {"readOnlyHint": True},
            },
            {
                "name": "get_source_evidence",
                "description": "Get safe synthetic evidence metadata; excerpts are disabled.",
                "inputSchema": {
                    "type": "object",
                    "additionalProperties": False,
                    "required": ["canonical_ref", "include_excerpt"],
                    "properties": {
                        "canonical_ref": {
                            "type": "string",
                            "pattern": "^fixture://[a-z0-9./_-]+$",
                            "maxLength": 512,
                        },
                        "include_excerpt": {"const": False},
                    },
                },
                "annotations": {"readOnlyHint": True},
            },
            {
                "name": "get_knowledge_version",
                "description": "Get synthetic knowledge, policy, identity, and manifest versions.",
                "inputSchema": {
                    "type": "object",
                    "additionalProperties": False,
                    "properties": {},
                },
                "annotations": {"readOnlyHint": True},
            },
        ]

    @staticmethod
    def _validate_keys(arguments: dict[str, Any], allowed: set[str], required: set[str]) -> None:
        if set(arguments) - allowed or not required <= set(arguments):
            raise ToolError("INVALID_INPUT", "tool arguments do not match closed schema")

    def _query(self, sql: str, parameters: tuple[Any, ...] = ()) -> list[tuple[Any, ...]]:
        try:
            with ReadOnlyRuntimeProbe(
                test_root=self._test_root,
                synthetic_base=self._synthetic_base,
            ) as probe:
                return probe.execute_readonly(sql, parameters)
        except RuntimeProbeError as exc:
            raise ToolError("POLICY_BLOCKED", "synthetic runtime is unavailable") from exc

    def _objects(self) -> list[dict[str, Any]]:
        rows = self._query(
            """
            SELECT
                canonical_ref,
                object_type,
                display_name,
                effective_sensitive_level,
                ai_use_policy,
                ai_summary,
                summary_version,
                summary_hash
            FROM knowledge_objects
            ORDER BY canonical_ref
            """
        )
        keys = (
            "canonical_ref",
            "object_type",
            "display_name",
            "effective_sensitive_level",
            "ai_use_policy",
            "ai_summary",
            "summary_version",
            "summary_hash",
        )
        return [dict(zip(keys, row, strict=True)) for row in rows]

    @staticmethod
    def _visible(row: dict[str, Any]) -> dict[str, Any] | None:
        decision = decide_object(row)
        if not decision.allowed:
            return None
        return project_object(row, decision.projection)

    def _base_output(
        self,
        *,
        data: Any,
        correlation_id: str,
        next_cursor: str | None = None,
        has_more: bool = False,
        warnings: list[str] | None = None,
    ) -> dict[str, Any]:
        output = {
            "contract_version": CONTRACT_VERSION,
            "source_channel": "sapd_wiki",
            "knowledge_version": KNOWLEDGE_VERSION,
            "policy_version": POLICY_VERSION,
            "identity_version": IDENTITY_VERSION,
            "grant_version": GRANT_VERSION,
            "content_trust": "untrusted_reference",
            "data": data,
            "page": {"next_cursor": next_cursor, "has_more": has_more},
            "warnings": warnings or [],
            "correlation_id": correlation_id,
        }
        encoded = json.dumps(output, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
        if len(encoded) > MAX_RESPONSE_BYTES:
            raise ToolError("RESPONSE_TOO_LARGE", "response exceeds 64 KiB")
        return output

    def _search(
        self,
        arguments: dict[str, Any],
        *,
        client_id: str,
        correlation_id: str,
    ) -> dict[str, Any]:
        self._validate_keys(arguments, {"query", "limit", "cursor"}, {"query"})
        try:
            query = normalize_text(str(arguments["query"]), maximum=256).casefold()
        except PolicyError as exc:
            raise ToolError(exc.code, str(exc)) from exc
        limit = arguments.get("limit", 8)
        if isinstance(limit, bool) or not isinstance(limit, int) or not 1 <= limit <= 15:
            raise ToolError("INVALID_INPUT", "limit is outside 1..15")
        offset = 0
        if "cursor" in arguments:
            payload = self._cursor.decode(str(arguments["cursor"]))
            expected = {
                "tool": "search_knowledge",
                "query": query,
                "client_id": client_id,
                "policy_version": POLICY_VERSION,
                "knowledge_version": KNOWLEDGE_VERSION,
                "identity_version": IDENTITY_VERSION,
                "grant_version": GRANT_VERSION,
            }
            if any(payload.get(key) != value for key, value in expected.items()):
                raise ToolError("CURSOR_STALE", "cursor binding is stale")
            offset = payload.get("offset")
            if isinstance(offset, bool) or not isinstance(offset, int) or offset < 0:
                raise ToolError("CURSOR_STALE", "cursor offset is invalid")

        visible: list[dict[str, Any]] = []
        for row in self._objects():
            projection = self._visible(row)
            if projection is None:
                continue
            haystack = f"{projection['display_name']} {projection.get('ai_summary', '')}".casefold()
            if query in haystack:
                visible.append(projection)
        page = visible[offset : offset + limit]
        next_offset = offset + len(page)
        has_more = next_offset < len(visible)
        next_cursor = None
        if has_more:
            next_cursor = self._cursor.encode(
                {
                    "tool": "search_knowledge",
                    "query": query,
                    "client_id": client_id,
                    "policy_version": POLICY_VERSION,
                    "knowledge_version": KNOWLEDGE_VERSION,
                    "identity_version": IDENTITY_VERSION,
                    "grant_version": GRANT_VERSION,
                    "offset": next_offset,
                }
            )
        return self._base_output(
            data={"items": page},
            correlation_id=correlation_id,
            next_cursor=next_cursor,
            has_more=has_more,
        )

    def _get_object(self, arguments: dict[str, Any], correlation_id: str) -> dict[str, Any]:
        self._validate_keys(arguments, {"canonical_ref"}, {"canonical_ref"})
        try:
            canonical_ref = normalize_text(
                str(arguments["canonical_ref"]),
                maximum=512,
            )
        except PolicyError as exc:
            raise ToolError(exc.code, str(exc)) from exc
        if not canonical_ref.startswith("fixture://"):
            raise ToolError("INVALID_INPUT", "canonical_ref must use fixture://")
        row = next(
            (item for item in self._objects() if item["canonical_ref"] == canonical_ref),
            None,
        )
        projection = self._visible(row) if row is not None else None
        if projection is None:
            raise ToolError("OBJECT_NOT_AVAILABLE", "object is not available")
        return self._base_output(data=projection, correlation_id=correlation_id)

    def _related(self, arguments: dict[str, Any], correlation_id: str) -> dict[str, Any]:
        self._validate_keys(
            arguments,
            {"canonical_ref", "direction", "limit"},
            {"canonical_ref", "direction"},
        )
        canonical_ref = normalize_text(str(arguments["canonical_ref"]), maximum=512)
        direction = arguments["direction"]
        if direction not in {"outgoing", "incoming", "both"}:
            raise ToolError("INVALID_INPUT", "direction is invalid")
        limit = arguments.get("limit", 15)
        if isinstance(limit, bool) or not isinstance(limit, int) or not 1 <= limit <= 30:
            raise ToolError("INVALID_INPUT", "limit is outside 1..30")
        objects = {row["canonical_ref"]: row for row in self._objects()}
        origin = self._visible(objects.get(canonical_ref)) if canonical_ref in objects else None
        if origin is None:
            raise ToolError("OBJECT_NOT_AVAILABLE", "object is not available")
        relations = self._query(
            """
            SELECT relation_ref, relation_type, source_ref, target_ref
            FROM knowledge_relations
            ORDER BY relation_ref
            """
        )
        output: list[dict[str, Any]] = []
        seen: set[str] = set()
        for relation_ref, relation_type, source_ref, target_ref in relations:
            matches = (
                (direction in {"outgoing", "both"} and source_ref == canonical_ref)
                or (direction in {"incoming", "both"} and target_ref == canonical_ref)
            )
            if not matches or relation_ref in seen:
                continue
            source = self._visible(objects[source_ref])
            target = self._visible(objects[target_ref])
            if source is None or target is None:
                continue
            seen.add(relation_ref)
            output.append(
                {
                    "relation_ref": relation_ref,
                    "relation_type": relation_type,
                    "source_ref": source_ref,
                    "target_ref": target_ref,
                }
            )
            if len(output) >= limit:
                break
        return self._base_output(
            data={"items": output},
            correlation_id=correlation_id,
            has_more=False,
        )

    def _evidence(self, arguments: dict[str, Any], correlation_id: str) -> dict[str, Any]:
        self._validate_keys(
            arguments,
            {"canonical_ref", "include_excerpt"},
            {"canonical_ref", "include_excerpt"},
        )
        if arguments["include_excerpt"] is not False:
            raise ToolError("INVALID_INPUT", "P0 requires include_excerpt=false")
        object_output = self._get_object(
            {"canonical_ref": arguments["canonical_ref"]},
            correlation_id,
        )
        canonical_ref = object_output["data"]["canonical_ref"]
        return self._base_output(
            data={
                "items": [
                    {
                        "canonical_ref": canonical_ref,
                        "evidence_kind": "hand_authored_synthetic",
                        "source_basis": "fixture-only",
                        "excerpt_included": False,
                    }
                ]
            },
            correlation_id=correlation_id,
        )

    def _version(self, arguments: dict[str, Any], correlation_id: str) -> dict[str, Any]:
        self._validate_keys(arguments, set(), set())
        row = self._query(
            """
            SELECT knowledge_version, policy_version, identity_version, manifest_digest
            FROM knowledge_versions
            """
        )
        if len(row) != 1:
            raise ToolError("POLICY_BLOCKED", "synthetic knowledge version is invalid")
        knowledge, policy, identity, manifest = row[0]
        return self._base_output(
            data={
                "knowledge_version": knowledge,
                "policy_version": policy,
                "identity_version": identity,
                "manifest_digest": manifest,
            },
            correlation_id=correlation_id,
        )

    def call(
        self,
        name: str,
        arguments: dict[str, Any],
        *,
        client_id: str,
        correlation_id: str,
    ) -> dict[str, Any]:
        if not isinstance(arguments, dict):
            raise ToolError("INVALID_INPUT", "arguments must be an object")
        if name == "search_knowledge":
            return self._search(
                arguments,
                client_id=client_id,
                correlation_id=correlation_id,
            )
        if name == "get_knowledge_object":
            return self._get_object(arguments, correlation_id)
        if name == "get_related_knowledge":
            return self._related(arguments, correlation_id)
        if name == "get_source_evidence":
            return self._evidence(arguments, correlation_id)
        if name == "get_knowledge_version":
            return self._version(arguments, correlation_id)
        raise ToolError("INVALID_INPUT", "unknown tool")
