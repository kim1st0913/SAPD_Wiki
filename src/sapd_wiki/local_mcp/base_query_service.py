"""Read-only MCP projection over the configured SAPD base knowledge database."""

from __future__ import annotations

import hashlib
import json
import re
import unicodedata
from pathlib import Path
from typing import Any, Mapping

from .cursor import CursorCodec, CursorContext
from .errors import (
    InvalidInputError,
    ObjectNotAvailableError,
    PolicyBlockedError,
    ResponseTooLargeError,
    RuntimeBoundaryError,
)
from .models import KnowledgeVersions, Page, RequestContext, ServiceResponse
from .readonly_runtime import ConnectFactory, ConnectObserver, FormalBaseRuntimeContext


SCOPE = "sapd.base.knowledge.read"
POLICY_VERSION = "base-all-business-content-v1"
IDENTITY_VERSION = "base-stable-ref-v1"
SORT_VERSION = "base-canonical-ref-v1"
CONTRACT_VERSION = "sapd-mcp-tools-v1"
SOURCE_CHANNEL = "sapd_wiki"
CONTENT_TRUST = "untrusted_reference"
RESPONSE_BYTES = 65_536
_CONTRACT_PATH = (
    Path(__file__).resolve().parents[3]
    / "docs"
    / "01-architecture"
    / "contracts"
    / "mcp"
    / "base-knowledge"
    / "v1"
    / "base-knowledge-access.contract.json"
)
_ABSOLUTE_POSIX_PATH = re.compile(r"^/(?:Users|home|private|var|etc|tmp|opt)/")
_ABSOLUTE_WINDOWS_PATH = re.compile(r"^[A-Za-z]:[\\/]")
_HARD_DENIED_METADATA_KEYS = frozenset(
    {
        "id",
        "object_key",
        "source_count",
        "parent_id",
        "source_file_id",
        "import_job_id",
        "raw_value",
        "path",
        "file_path",
        "file_name",
        "local_path",
        "absolute_path",
        "preview_path",
        "created_at",
        "updated_at",
        "generated_at",
        "ignored_source_columns",
        "canonical_runtime_id",
        "sync_task",
        "sync_time",
        "synced_from",
        "category_repair_time",
        "category_repaired_from",
        "category_repaired_to",
        "metadata_category_repair_time",
        "metadata_category_repaired_from",
        "metadata_category_repaired_to",
        "drawiocellid",
        "parentcellid",
        "sourcecellid",
        "targetcellid",
        "style",
        "medianames",
        "debug",
        "credential",
        "secret",
        "token",
        "password",
        "user_content",
    }
)
_TOOL_LIMITS: Mapping[str, tuple[int, int, int]] = {
    "search_knowledge": (8, 15, 12_000),
    "get_knowledge_object": (1, 1, 16_000),
    "get_related_knowledge": (15, 30, 12_000),
    "get_source_evidence": (8, 15, 8_000),
    "get_knowledge_version": (1, 1, 2_000),
}


def _load_contract() -> dict[str, Any]:
    try:
        payload = json.loads(_CONTRACT_PATH.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise PolicyBlockedError("base knowledge access contract is unavailable") from exc
    expected = {
        "contract_id": "MCP-BASE-KNOWLEDGE-ACCESS-v1",
        "contract_version": "1.0.0",
        "scope": SCOPE,
        "store": "base_read_only",
        "business_rule": "all_base_knowledge_business_content_is_ai_readable",
    }
    if any(payload.get(key) != value for key, value in expected.items()):
        raise PolicyBlockedError("base knowledge access contract is invalid")
    tool_contract = payload.get("tool_contract")
    exclusions = payload.get("hard_exclusions")
    content_contract = payload.get("content_object_contract")
    relation_contract = payload.get("relation_contract")
    evidence_contract = payload.get("source_evidence_contract")
    version_contract = payload.get("version_contract")
    if (
        not isinstance(tool_contract, dict)
        or tool_contract.get("fixed_readonly_tools") != list(_TOOL_LIMITS)
        or tool_contract.get("direct_sql") is not False
        or tool_contract.get("response_bytes") != RESPONSE_BYTES
        or not isinstance(exclusions, dict)
        or "user_database" not in exclusions.get("stores", [])
        or "arbitrary_sql" not in exclusions.get("capabilities", [])
        or not isinstance(content_contract, dict)
        or content_contract.get("tables")
        != [
            "content_documents",
            "content_fragments",
            "content_fragments_fts",
        ]
        or content_contract.get("optional_when_schema_absent") is not True
        or not isinstance(relation_contract, dict)
        or relation_contract.get("content_table") != "content_relations"
        or relation_contract.get("direct_relation_ref") is not True
        or relation_contract.get("canonical_ref_namespaces")
        != ["base_relation:", "base:content_document:"]
        or not isinstance(evidence_contract, dict)
        or evidence_contract.get("content_table") != "content_source_evidence"
        or evidence_contract.get("supports_relation_ref") is not True
        or not isinstance(version_contract, dict)
        or version_contract.get("base_manifest_digest") != "always"
        or version_contract.get("content_manifest_digest")
        != "when_content_schema_present"
        or version_contract.get("asset_manifest_digest")
        != "metadata_from_query_store_only"
        or version_contract.get("asset_blob_read") is not False
    ):
        raise PolicyBlockedError("base knowledge safety contract is incomplete")
    return payload


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


def _canonical_ref(value: Any) -> str:
    normalized = _normalized_text(value, maximum=1024)
    if not (
        normalized.startswith("base:")
        or normalized.startswith("base_relation:")
        or normalized.startswith("fixture://")
    ):
        raise InvalidInputError("canonical_ref is outside the base knowledge namespace")
    return normalized


def _like_literal(value: str) -> str:
    return value.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


def _fts_query(value: str) -> str:
    tokens = [
        token.replace('"', '""')
        for token in re.split(r"\s+", value)
        if token
    ]
    if not tokens:
        raise InvalidInputError("empty search query is forbidden")
    return " AND ".join(f'"{token}"*' for token in tokens)


def _looks_like_absolute_path(value: str) -> bool:
    return bool(
        _ABSOLUTE_POSIX_PATH.match(value.strip())
        or _ABSOLUTE_WINDOWS_PATH.match(value.strip())
    )


def _business_value(value: Any, *, depth: int = 0) -> Any:
    if depth > 12:
        raise PolicyBlockedError("business metadata nesting is too deep")
    if value is None or isinstance(value, (bool, int, float)):
        return value
    if isinstance(value, str):
        return None if _looks_like_absolute_path(value) else value
    if isinstance(value, list):
        return [
            projected
            for item in value
            if (projected := _business_value(item, depth=depth + 1)) is not None
        ]
    if isinstance(value, dict):
        result: dict[str, Any] = {}
        for raw_key, raw_value in value.items():
            key = str(raw_key)
            if key.casefold() in _HARD_DENIED_METADATA_KEYS:
                continue
            projected = _business_value(raw_value, depth=depth + 1)
            if projected is not None:
                result[key] = projected
        return result
    return str(value)


def _parse_business_metadata(raw: Any) -> dict[str, Any]:
    if raw in (None, "", "null"):
        return {}
    try:
        parsed = json.loads(str(raw))
    except json.JSONDecodeError as exc:
        raise PolicyBlockedError("base knowledge metadata is not valid JSON") from exc
    if not isinstance(parsed, dict):
        raise PolicyBlockedError("base knowledge metadata must be an object")
    projected = _business_value(parsed)
    if not isinstance(projected, dict):
        raise PolicyBlockedError("base knowledge metadata projection failed")
    return projected


def _sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return f"sha256:{digest.hexdigest()}"


class BaseKnowledgeRepository:
    """Fixed parameterized SELECT queries over formal base tables only."""

    _CONTENT_TABLES = frozenset(
        {
            "content_documents",
            "content_fragments",
            "content_relations",
            "content_source_evidence",
            "content_fragments_fts",
        }
    )

    def __init__(self, runtime: FormalBaseRuntimeContext) -> None:
        self._runtime = runtime
        try:
            tables = frozenset(
                str(row[0])
                for row in self._connection.execute(
                    "SELECT name FROM sqlite_schema WHERE type='table'"
                ).fetchall()
            )
        except Exception as exc:
            raise RuntimeBoundaryError("base knowledge schema discovery failed") from exc
        content_tables = tables & self._CONTENT_TABLES
        if content_tables and content_tables != self._CONTENT_TABLES:
            raise PolicyBlockedError("content query schema is incomplete")
        self.content_enabled = content_tables == self._CONTENT_TABLES

    @property
    def _connection(self):
        return self._runtime.connection

    def validate_integrity(self) -> None:
        try:
            objects = self._connection.execute(
                """
                SELECT
                    COUNT(*) AS total,
                    SUM(CASE WHEN stable_ref IS NULL OR trim(stable_ref) = '' THEN 1 ELSE 0 END)
                        AS invalid
                FROM knowledge_items
                """
            ).fetchone()
            relations = self._connection.execute(
                """
                SELECT
                    COUNT(*) AS total,
                    SUM(
                        CASE
                            WHEN r.stable_ref IS NULL OR trim(r.stable_ref) = ''
                              OR source.stable_ref IS NULL OR target.stable_ref IS NULL
                            THEN 1 ELSE 0
                        END
                    ) AS invalid
                FROM knowledge_relations AS r
                LEFT JOIN knowledge_items AS source ON source.id = r.source_item_id
                LEFT JOIN knowledge_items AS target ON target.id = r.target_item_id
                """
            ).fetchone()
        except Exception as exc:
            raise RuntimeBoundaryError("base knowledge integrity query failed") from exc
        if (
            objects is None
            or relations is None
            or int(objects["total"] or 0) < 1
            or int(objects["invalid"] or 0) != 0
            or int(relations["invalid"] or 0) != 0
        ):
            raise PolicyBlockedError("base knowledge stable identity is incomplete")
        if not self.content_enabled:
            return
        try:
            content = self._connection.execute(
                """
                WITH refs AS (
                  SELECT stable_ref FROM content_documents
                  UNION
                  SELECT stable_ref FROM content_fragments
                )
                SELECT
                  (SELECT COUNT(*) FROM content_documents) AS documents,
                  (SELECT COUNT(*) FROM content_fragments) AS fragments,
                  (
                    SELECT COUNT(*)
                    FROM content_relations
                    WHERE source_ref NOT IN (SELECT stable_ref FROM refs)
                       OR target_ref NOT IN (SELECT stable_ref FROM refs)
                  ) AS dangling_relations,
                  (
                    SELECT COUNT(*)
                    FROM content_fragments
                    WHERE extraction_status='ocr_pending'
                  ) AS pending_ocr
                """
            ).fetchone()
        except Exception as exc:
            raise RuntimeBoundaryError("content knowledge integrity query failed") from exc
        if (
            content is None
            or int(content["documents"] or 0) < 1
            or int(content["fragments"] or 0) < 1
            or int(content["dangling_relations"] or 0) != 0
            or int(content["pending_ocr"] or 0) != 0
        ):
            raise PolicyBlockedError("content knowledge projection is incomplete")

    @staticmethod
    def _object(row: Any, *, include_content: bool) -> dict[str, Any]:
        result: dict[str, Any] = {
            "canonical_ref": str(row["stable_ref"]),
            "object_type": str(row["type"]),
            "display_name": str(row["title"]),
            "status": str(row["status"]),
        }
        for field in ("code", "category"):
            if row[field] is not None and str(row[field]).strip():
                result[field] = str(row[field])
        if include_content:
            result["description"] = str(row["description"] or "")
            result["business_metadata"] = _parse_business_metadata(row["metadata_json"])
        return result

    @staticmethod
    def _content_document(row: Any, *, include_content: bool) -> dict[str, Any]:
        metadata = _parse_business_metadata(row["metadata_json"])
        result: dict[str, Any] = {
            "canonical_ref": str(row["stable_ref"]),
            "object_type": "content_document",
            "display_name": str(row["title"]),
            "status": str(metadata.pop("inclusion_status", "approved")),
            "format": str(row["format"]),
            "semantic_source": bool(row["semantic_source"]),
            "logical_file_name": str(row["logical_file_name"]),
        }
        if include_content:
            result.update(
                {
                    "description": "",
                    "parser": str(row["parser"]),
                    "ocr_policy": str(row["ocr_policy"]),
                    "asset_hash": str(row["source_asset_hash"]),
                    "business_metadata": metadata,
                }
            )
        return result

    @staticmethod
    def _content_fragment(row: Any, *, include_content: bool) -> dict[str, Any]:
        result: dict[str, Any] = {
            "canonical_ref": str(row["stable_ref"]),
            "object_type": str(row["fragment_type"]),
            "display_name": str(row["title"] or row["stable_ref"]),
            "status": "available",
            "parent_ref": str(row["document_stable_ref"]),
            "ordinal": int(row["ordinal"]),
            "extraction_status": str(row["extraction_status"]),
        }
        if include_content:
            result.update(
                {
                    "description": str(row["body"] or ""),
                    "notes": str(row["notes"] or ""),
                    "content_location": str(row["source_locator"]),
                    "content_hash": str(row["content_hash"]),
                    "business_metadata": _parse_business_metadata(
                        row["metadata_json"]
                    ),
                }
            )
        return result

    @staticmethod
    def _base_relation(row: Any) -> dict[str, Any]:
        item: dict[str, Any] = {
            "relation_ref": str(row["stable_ref"]),
            "relation_type": str(row["relation_type"]),
            "source_ref": str(row["source_stable_ref"]),
            "target_ref": str(row["target_stable_ref"]),
            "confidence": str(row["confidence"]),
            "business_metadata": _parse_business_metadata(row["metadata_json"]),
        }
        if row["relation_label"] is not None and str(row["relation_label"]).strip():
            item["relation_label"] = str(row["relation_label"])
        return item

    @staticmethod
    def _content_relation(row: Any) -> dict[str, Any]:
        item: dict[str, Any] = {
            "relation_ref": str(row["stable_ref"]),
            "relation_type": str(row["relation_type"]),
            "source_ref": str(row["source_ref"]),
            "target_ref": str(row["target_ref"]),
            "confidence": "exact",
            "business_metadata": _parse_business_metadata(row["metadata_json"]),
        }
        if row["relation_label"] is not None and str(row["relation_label"]).strip():
            item["relation_label"] = str(row["relation_label"])
        if row["ordinal"] is not None:
            item["ordinal"] = int(row["ordinal"])
        return item

    def search(
        self,
        *,
        query: str,
        after_ref: str,
        limit: int,
    ) -> list[dict[str, Any]]:
        literal = f"%{_like_literal(query)}%"
        try:
            base_rows = self._connection.execute(
                """
                SELECT stable_ref, type, code, title, description, category, status, metadata_json
                FROM knowledge_items
                WHERE stable_ref > ?
                  AND (
                        lower(title) LIKE lower(?) ESCAPE '\\'
                     OR lower(COALESCE(code, '')) LIKE lower(?) ESCAPE '\\'
                     OR lower(COALESCE(description, '')) LIKE lower(?) ESCAPE '\\'
                     OR lower(COALESCE(category, '')) LIKE lower(?) ESCAPE '\\'
                     OR lower(COALESCE(metadata_json, '')) LIKE lower(?) ESCAPE '\\'
                  )
                ORDER BY stable_ref
                LIMIT ?
                """,
                (after_ref, literal, literal, literal, literal, literal, limit),
            ).fetchall()
        except Exception as exc:
            raise RuntimeBoundaryError("base knowledge search failed") from exc
        results = [
            self._object(row, include_content=False)
            for row in base_rows
        ]
        if self.content_enabled:
            try:
                document_rows = self._connection.execute(
                    """
                    SELECT
                      stable_ref, title, format, semantic_source, parser,
                      ocr_policy, logical_file_name, source_asset_hash, metadata_json
                    FROM content_documents
                    WHERE stable_ref > ?
                      AND (
                            lower(title) LIKE lower(?) ESCAPE '\\'
                         OR lower(logical_file_name) LIKE lower(?) ESCAPE '\\'
                         OR lower(format) LIKE lower(?) ESCAPE '\\'
                      )
                    ORDER BY stable_ref
                    LIMIT ?
                    """,
                    (after_ref, literal, literal, literal, limit),
                ).fetchall()
                fragment_rows = self._connection.execute(
                    """
                    SELECT
                      fragment.stable_ref,
                      fragment.fragment_type,
                      fragment.title,
                      fragment.body,
                      fragment.notes,
                      fragment.ordinal,
                      fragment.source_locator,
                      fragment.extraction_status,
                      fragment.content_hash,
                      fragment.metadata_json,
                      document.stable_ref AS document_stable_ref
                    FROM content_fragments AS fragment
                    JOIN content_documents AS document
                      ON document.id=fragment.document_id
                    WHERE fragment.stable_ref > ?
                      AND (
                        fragment.rowid IN (
                          SELECT rowid
                          FROM content_fragments_fts
                          WHERE content_fragments_fts MATCH ?
                        )
                        OR lower(COALESCE(fragment.title, ''))
                           LIKE lower(?) ESCAPE '\\'
                        OR lower(COALESCE(fragment.body, ''))
                           LIKE lower(?) ESCAPE '\\'
                        OR lower(COALESCE(fragment.notes, ''))
                           LIKE lower(?) ESCAPE '\\'
                      )
                    ORDER BY fragment.stable_ref
                    LIMIT ?
                    """,
                    (
                        after_ref,
                        _fts_query(query),
                        literal,
                        literal,
                        literal,
                        limit,
                    ),
                ).fetchall()
            except Exception as exc:
                raise RuntimeBoundaryError("content knowledge search failed") from exc
            results.extend(
                self._content_document(row, include_content=False)
                for row in document_rows
            )
            results.extend(
                self._content_fragment(row, include_content=False)
                for row in fragment_rows
            )
        return sorted(
            results,
            key=lambda item: item["canonical_ref"],
        )[:limit]

    def get_object(self, canonical_ref: str) -> dict[str, Any] | None:
        try:
            row = self._connection.execute(
                """
                SELECT stable_ref, type, code, title, description, category, status, metadata_json
                FROM knowledge_items
                WHERE stable_ref = ?
                """,
                (canonical_ref,),
            ).fetchone()
        except Exception as exc:
            raise RuntimeBoundaryError("base knowledge object query failed") from exc
        if row is not None:
            return self._object(row, include_content=True)
        if not self.content_enabled:
            return None
        try:
            document = self._connection.execute(
                """
                SELECT
                  stable_ref, title, format, semantic_source, parser,
                  ocr_policy, logical_file_name, source_asset_hash, metadata_json
                FROM content_documents
                WHERE stable_ref=?
                """,
                (canonical_ref,),
            ).fetchone()
            if document is not None:
                return self._content_document(document, include_content=True)
            fragment = self._connection.execute(
                """
                SELECT
                  fragment.stable_ref,
                  fragment.fragment_type,
                  fragment.title,
                  fragment.body,
                  fragment.notes,
                  fragment.ordinal,
                  fragment.source_locator,
                  fragment.extraction_status,
                  fragment.content_hash,
                  fragment.metadata_json,
                  document.stable_ref AS document_stable_ref
                FROM content_fragments AS fragment
                JOIN content_documents AS document
                  ON document.id=fragment.document_id
                WHERE fragment.stable_ref=?
                """,
                (canonical_ref,),
            ).fetchone()
        except Exception as exc:
            raise RuntimeBoundaryError("content knowledge object query failed") from exc
        return (
            self._content_fragment(fragment, include_content=True)
            if fragment is not None
            else None
        )

    def get_relation(self, relation_ref: str) -> dict[str, Any] | None:
        try:
            base = self._connection.execute(
                """
                SELECT
                  relation.stable_ref,
                  relation.relation_type,
                  relation.relation_label,
                  relation.confidence,
                  relation.metadata_json,
                  source.stable_ref AS source_stable_ref,
                  target.stable_ref AS target_stable_ref
                FROM knowledge_relations AS relation
                JOIN knowledge_items AS source
                  ON source.id=relation.source_item_id
                JOIN knowledge_items AS target
                  ON target.id=relation.target_item_id
                WHERE relation.stable_ref=?
                """,
                (relation_ref,),
            ).fetchone()
        except Exception as exc:
            raise RuntimeBoundaryError("base knowledge relation query failed") from exc
        if base is not None:
            return self._base_relation(base)
        if not self.content_enabled:
            return None
        try:
            content = self._connection.execute(
                """
                SELECT
                  stable_ref, relation_type, relation_label,
                  source_ref, target_ref, ordinal, metadata_json
                FROM content_relations
                WHERE stable_ref=?
                """,
                (relation_ref,),
            ).fetchone()
        except Exception as exc:
            raise RuntimeBoundaryError("content knowledge relation query failed") from exc
        return self._content_relation(content) if content is not None else None

    def related(
        self,
        *,
        canonical_ref: str,
        direction: str,
        after_ref: str,
        limit: int,
    ) -> list[dict[str, Any]]:
        direct_relation = self.get_relation(canonical_ref)
        if direct_relation is not None:
            return (
                [direct_relation]
                if direct_relation["relation_ref"] > after_ref and limit > 0
                else []
            )
        direction_sql = {
            "outgoing": "source.stable_ref = ?",
            "incoming": "target.stable_ref = ?",
            "both": "(source.stable_ref = ? OR target.stable_ref = ?)",
        }[direction]
        direction_params = (
            (canonical_ref, canonical_ref)
            if direction == "both"
            else (canonical_ref,)
        )
        try:
            base_rows = self._connection.execute(
                f"""
                SELECT
                    r.stable_ref,
                    r.relation_type,
                    r.relation_label,
                    r.confidence,
                    r.metadata_json,
                    source.stable_ref AS source_stable_ref,
                    target.stable_ref AS target_stable_ref
                FROM knowledge_relations AS r
                JOIN knowledge_items AS source ON source.id = r.source_item_id
                JOIN knowledge_items AS target ON target.id = r.target_item_id
                WHERE {direction_sql}
                  AND r.stable_ref > ?
                ORDER BY r.stable_ref
                LIMIT ?
                """,
                (*direction_params, after_ref, limit),
            ).fetchall()
        except Exception as exc:
            raise RuntimeBoundaryError("base knowledge relation query failed") from exc
        result = [self._base_relation(row) for row in base_rows]
        if self.content_enabled:
            content_direction_sql = {
                "outgoing": "source_ref = ?",
                "incoming": "target_ref = ?",
                "both": "(source_ref = ? OR target_ref = ?)",
            }[direction]
            try:
                content_rows = self._connection.execute(
                    f"""
                    SELECT
                      stable_ref, relation_type, relation_label,
                      source_ref, target_ref, ordinal, metadata_json
                    FROM content_relations
                    WHERE {content_direction_sql}
                      AND stable_ref > ?
                    ORDER BY stable_ref
                    LIMIT ?
                    """,
                    (*direction_params, after_ref, limit),
                ).fetchall()
            except Exception as exc:
                raise RuntimeBoundaryError(
                    "content knowledge relation query failed"
                ) from exc
            result.extend(self._content_relation(row) for row in content_rows)
        return sorted(result, key=lambda item: item["relation_ref"])[:limit]

    def source_evidence(
        self,
        *,
        canonical_ref: str,
        after_id: str,
        limit: int,
    ) -> list[dict[str, Any]]:
        try:
            base_rows = self._connection.execute(
                """
                SELECT
                    reference.id,
                    file.file_name,
                    file.file_type,
                    reference.source_sheet,
                    reference.source_row,
                    reference.source_column,
                    reference.source_cell,
                    reference.source_hash
                FROM source_references AS reference
                JOIN source_files AS file ON file.id = reference.source_file_id
                WHERE reference.id > ?
                  AND (
                    (
                      reference.target_type='item'
                      AND reference.target_id=(
                        SELECT id FROM knowledge_items WHERE stable_ref=?
                      )
                    )
                    OR
                    (
                      reference.target_type='relation'
                      AND reference.target_id=(
                        SELECT id FROM knowledge_relations WHERE stable_ref=?
                      )
                    )
                  )
                ORDER BY reference.id
                LIMIT ?
                """,
                (after_id, canonical_ref, canonical_ref, limit),
            ).fetchall()
        except Exception as exc:
            raise RuntimeBoundaryError("base knowledge evidence query failed") from exc
        result: list[dict[str, Any]] = []
        for row in base_rows:
            item: dict[str, Any] = {
                "evidence_ref": f"base:evidence:{row['id']}",
                "canonical_ref": canonical_ref,
                "file_name": str(row["file_name"]),
                "file_type": str(row["file_type"]),
                "source_hash": str(row["source_hash"]),
                "excerpt_included": False,
            }
            for field in (
                "source_sheet",
                "source_row",
                "source_column",
                "source_cell",
            ):
                if row[field] is not None and str(row[field]).strip():
                    item[field] = row[field]
            result.append(item)
        if self.content_enabled:
            try:
                content_rows = self._connection.execute(
                    """
                    SELECT
                      evidence.id,
                      evidence.source_asset_hash,
                      evidence.source_locator,
                      evidence.extraction_method,
                      evidence.evidence_hash,
                      document.logical_file_name,
                      document.format
                    FROM content_source_evidence AS evidence
                    LEFT JOIN content_documents AS document
                      ON document.source_asset_hash=evidence.source_asset_hash
                    WHERE evidence.target_ref=?
                      AND evidence.id > ?
                    ORDER BY evidence.id
                    LIMIT ?
                    """,
                    (canonical_ref, after_id, limit),
                ).fetchall()
            except Exception as exc:
                raise RuntimeBoundaryError(
                    "content knowledge evidence query failed"
                ) from exc
            for row in content_rows:
                item = {
                    "evidence_ref": f"base:evidence:{row['id']}",
                    "canonical_ref": canonical_ref,
                    "file_name": str(row["logical_file_name"] or "content-asset"),
                    "file_type": str(row["format"] or "unknown"),
                    "source_hash": str(row["source_asset_hash"]),
                    "content_location": str(row["source_locator"]),
                    "extraction_method": str(row["extraction_method"]),
                    "evidence_hash": str(row["evidence_hash"]),
                    "excerpt_included": False,
                }
                result.append(item)
        return sorted(result, key=lambda item: item["evidence_ref"])[:limit]


class BaseKnowledgeQueryService:
    """Expose the full base knowledge business projection through five read-only tools."""

    scope = SCOPE

    def __init__(
        self,
        *,
        runtime: FormalBaseRuntimeContext,
        repository: BaseKnowledgeRepository,
        cursor: CursorCodec,
        versions: KnowledgeVersions,
    ) -> None:
        self.contract = _load_contract()
        self.runtime = runtime
        self.repository = repository
        self.cursor = cursor
        self.versions = versions
        repository.validate_integrity()

    @classmethod
    def create(
        cls,
        *,
        base_database: Path,
        cursor_key: bytes,
        cursor_ttl_seconds: int = 900,
        cursor_clock: Any = None,
        connect_factory: ConnectFactory | None = None,
        connect_observer: ConnectObserver | None = None,
    ) -> "BaseKnowledgeQueryService":
        runtime_arguments: dict[str, Any] = {
            "base_database": Path(base_database),
            "connect_observer": connect_observer,
        }
        if connect_factory is not None:
            runtime_arguments["connect_factory"] = connect_factory
        runtime = FormalBaseRuntimeContext(**runtime_arguments).open()
        try:
            manifest_digest = _sha256_file(runtime.base_path)
            content_meta: dict[str, str] = {}
            if "content_schema_meta" in {
                str(row[0])
                for row in runtime.connection.execute(
                    """
                    SELECT name
                    FROM sqlite_master
                    WHERE type='table' AND name='content_schema_meta'
                    """
                )
            }:
                content_meta = {
                    str(row["key"]): str(row["value"])
                    for row in runtime.connection.execute(
                        """
                        SELECT key, value
                        FROM content_schema_meta
                        WHERE key IN (
                          'base_database_sha256',
                          'content_manifest_digest',
                          'asset_manifest_digest'
                        )
                        """
                    )
                }
            base_digest_value = content_meta.get("base_database_sha256")
            base_manifest_digest = (
                f"sha256:{base_digest_value.removeprefix('sha256:')}"
                if base_digest_value
                else manifest_digest
            )
            cursor_arguments: dict[str, Any] = {"ttl_seconds": cursor_ttl_seconds}
            if cursor_clock is not None:
                cursor_arguments["clock"] = cursor_clock
            return cls(
                runtime=runtime,
                repository=BaseKnowledgeRepository(runtime),
                cursor=CursorCodec(cursor_key, **cursor_arguments),
                versions=KnowledgeVersions(
                    knowledge_version=f"base-{manifest_digest.removeprefix('sha256:')[:16]}",
                    policy_version=POLICY_VERSION,
                    identity_version=IDENTITY_VERSION,
                    manifest_digest=manifest_digest,
                    base_manifest_digest=base_manifest_digest,
                    content_manifest_digest=content_meta.get(
                        "content_manifest_digest"
                    ),
                    asset_manifest_digest=content_meta.get(
                        "asset_manifest_digest"
                    ),
                ),
            )
        except Exception:
            runtime.close()
            raise

    def close(self) -> None:
        self.runtime.close()

    def __enter__(self) -> "BaseKnowledgeQueryService":
        return self

    def __exit__(self, _exc_type: Any, _exc: Any, _traceback: Any) -> None:
        self.close()

    def _request(self, request: RequestContext) -> RequestContext:
        if not isinstance(request, RequestContext):
            raise InvalidInputError("request context is required")
        if request.scope != self.scope:
            raise InvalidInputError("request scope does not match the base knowledge contract")
        return RequestContext(
            client_id=_normalized_text(request.client_id, maximum=256),
            grant_version=_normalized_text(request.grant_version, maximum=256),
            scope=request.scope,
            correlation_id=_normalized_text(request.correlation_id, maximum=256),
        )

    @staticmethod
    def _limit(tool_name: str, value: int | None) -> int:
        default, maximum, _target = _TOOL_LIMITS[tool_name]
        limit = default if value is None else value
        if (
            isinstance(limit, bool)
            or not isinstance(limit, int)
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
        encoded_data = json.dumps(
            data,
            ensure_ascii=False,
            sort_keys=True,
            separators=(",", ":"),
        )
        target = _TOOL_LIMITS[tool_name][2]
        if len(encoded_data) > target:
            raise ResponseTooLargeError(
                f"{tool_name} response exceeds its character target"
            )
        response = ServiceResponse(
            contract_version=CONTRACT_VERSION,
            source_channel=SOURCE_CHANNEL,
            knowledge_version=self.versions.knowledge_version,
            policy_version=self.versions.policy_version,
            identity_version=self.versions.identity_version,
            grant_version=request.grant_version,
            content_trust=CONTENT_TRUST,
            data=data,
            page=page or Page(),
            warnings=(),
            correlation_id=request.correlation_id,
        )
        if len(
            json.dumps(
                response.to_dict(),
                ensure_ascii=False,
                sort_keys=True,
                separators=(",", ":"),
            ).encode("utf-8")
        ) > RESPONSE_BYTES:
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
        context = self._cursor_context(
            tool="search_knowledge",
            parameters=parameters,
            request=checked_request,
        )
        after_ref = self.cursor.decode(cursor, context) if cursor else ""
        rows = self.repository.search(
            query=normalized_query,
            after_ref=after_ref,
            limit=checked_limit + 1,
        )
        has_more = len(rows) > checked_limit
        selected = rows[:checked_limit]
        next_cursor = (
            self.cursor.encode(context, last_sort_key=selected[-1]["canonical_ref"])
            if has_more and selected
            else None
        )
        return self._response(
            tool_name="search_knowledge",
            data={"items": selected},
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
        resolved_ref = _canonical_ref(canonical_ref)
        item = self.repository.get_object(resolved_ref)
        if item is None:
            raise ObjectNotAvailableError()
        return self._response(
            tool_name="get_knowledge_object",
            data=item,
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
        resolved_ref = _canonical_ref(canonical_ref)
        if direction not in {"outgoing", "incoming", "both"}:
            raise InvalidInputError("relation direction is invalid")
        if (
            self.repository.get_object(resolved_ref) is None
            and self.repository.get_relation(resolved_ref) is None
        ):
            raise ObjectNotAvailableError()
        checked_limit = self._limit("get_related_knowledge", limit)
        parameters = {
            "canonical_ref": resolved_ref,
            "direction": direction,
            "limit": checked_limit,
        }
        context = self._cursor_context(
            tool="get_related_knowledge",
            parameters=parameters,
            request=checked_request,
        )
        after_ref = self.cursor.decode(cursor, context) if cursor else ""
        rows = self.repository.related(
            canonical_ref=resolved_ref,
            direction=direction,
            after_ref=after_ref,
            limit=checked_limit + 1,
        )
        has_more = len(rows) > checked_limit
        selected = rows[:checked_limit]
        next_cursor = (
            self.cursor.encode(context, last_sort_key=selected[-1]["relation_ref"])
            if has_more and selected
            else None
        )
        return self._response(
            tool_name="get_related_knowledge",
            data={"items": selected},
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
        resolved_ref = _canonical_ref(canonical_ref)
        if include_excerpt is not False:
            raise InvalidInputError("source file excerpts are outside the MCP contract")
        if (
            self.repository.get_object(resolved_ref) is None
            and self.repository.get_relation(resolved_ref) is None
        ):
            raise ObjectNotAvailableError()
        checked_limit = self._limit("get_source_evidence", limit)
        parameters = {
            "canonical_ref": resolved_ref,
            "include_excerpt": False,
            "limit": checked_limit,
        }
        context = self._cursor_context(
            tool="get_source_evidence",
            parameters=parameters,
            request=checked_request,
        )
        after_id = self.cursor.decode(cursor, context) if cursor else ""
        rows = self.repository.source_evidence(
            canonical_ref=resolved_ref,
            after_id=after_id,
            limit=checked_limit + 1,
        )
        has_more = len(rows) > checked_limit
        selected = rows[:checked_limit]
        next_cursor = (
            self.cursor.encode(
                context,
                last_sort_key=selected[-1]["evidence_ref"].removeprefix("base:evidence:"),
            )
            if has_more and selected
            else None
        )
        return self._response(
            tool_name="get_source_evidence",
            data={"items": selected},
            request=checked_request,
            page=Page(next_cursor=next_cursor, has_more=has_more),
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
