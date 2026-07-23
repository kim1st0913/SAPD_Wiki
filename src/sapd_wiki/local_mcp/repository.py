"""Named, policy-aware read queries over the synthetic base."""

from __future__ import annotations

import sqlite3
from collections.abc import Iterable

from .errors import PolicyBlockedError, RuntimeBoundaryError
from .models import KnowledgeRecord, KnowledgeRelation, KnowledgeVersions
from .readonly_runtime import ReadOnlyRuntimeContext


VISIBLE_OBJECT_PREDICATE = """
canonical_ref LIKE 'fixture://%'
AND effective_sensitive_level = 'public'
AND ai_use_policy IN ('public_summary', 'metadata_only')
"""


def _record(row: sqlite3.Row) -> KnowledgeRecord:
    return KnowledgeRecord(
        canonical_ref=str(row["canonical_ref"]),
        object_type=str(row["object_type"]),
        display_name=str(row["display_name"]),
        effective_sensitive_level=str(row["effective_sensitive_level"]),
        ai_use_policy=str(row["ai_use_policy"]),
        ai_summary=str(row["ai_summary"]) if row["ai_summary"] is not None else None,
        summary_version=int(row["summary_version"]) if row["summary_version"] is not None else None,
        summary_hash=str(row["summary_hash"]) if row["summary_hash"] is not None else None,
    )


def _like_literal(value: str) -> str:
    return value.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


class BaseKnowledgeRepository:
    """Expose only fixed SELECT statements; adapters cannot submit SQL."""

    def __init__(self, runtime: ReadOnlyRuntimeContext) -> None:
        self._runtime = runtime

    @property
    def _connection(self) -> sqlite3.Connection:
        return self._runtime.connection

    def object_types(self) -> frozenset[str]:
        try:
            rows = self._connection.execute(
                """
                SELECT DISTINCT object_type
                FROM knowledge_objects
                ORDER BY object_type
                """
            ).fetchall()
        except sqlite3.Error as exc:
            raise RuntimeBoundaryError("synthetic object types query failed") from exc
        return frozenset(str(row[0]) for row in rows)

    def relation_types(self) -> frozenset[str]:
        try:
            rows = self._connection.execute(
                """
                SELECT DISTINCT relation_type
                FROM knowledge_relations
                ORDER BY relation_type
                """
            ).fetchall()
        except sqlite3.Error as exc:
            raise RuntimeBoundaryError("synthetic relation types query failed") from exc
        return frozenset(str(row[0]) for row in rows)

    def versions(self) -> KnowledgeVersions:
        try:
            rows = self._connection.execute(
                """
                SELECT knowledge_version, policy_version, identity_version, manifest_digest
                FROM knowledge_versions
                """
            ).fetchall()
        except sqlite3.Error as exc:
            raise RuntimeBoundaryError("synthetic version query failed") from exc
        if len(rows) != 1:
            raise PolicyBlockedError("synthetic knowledge version is invalid")
        row = rows[0]
        versions = KnowledgeVersions(
            knowledge_version=str(row["knowledge_version"]),
            policy_version=str(row["policy_version"]),
            identity_version=str(row["identity_version"]),
            manifest_digest=str(row["manifest_digest"]),
        )
        if not (
            versions.knowledge_version.startswith("fixture-")
            and versions.policy_version.startswith("fixture-")
            and versions.identity_version.startswith("fixture-")
            and versions.manifest_digest.startswith("sha256:")
        ):
            raise PolicyBlockedError("non-synthetic version metadata is forbidden")
        return versions

    def search_visible(
        self,
        *,
        query: str,
        allowed_object_types: Iterable[str],
        after_ref: str,
        limit: int,
    ) -> list[KnowledgeRecord]:
        object_types = tuple(sorted(set(allowed_object_types)))
        if not object_types:
            raise PolicyBlockedError("object allowlist is empty")
        placeholders = ",".join("?" for _ in object_types)
        literal = f"%{_like_literal(query)}%"
        sql = f"""
            SELECT
                canonical_ref, object_type, display_name,
                effective_sensitive_level, ai_use_policy,
                ai_summary, summary_version, summary_hash
            FROM knowledge_objects
            WHERE {VISIBLE_OBJECT_PREDICATE}
              AND object_type IN ({placeholders})
              AND canonical_ref > ?
              AND (
                    lower(display_name) LIKE lower(?) ESCAPE '\\'
                 OR lower(COALESCE(ai_summary, '')) LIKE lower(?) ESCAPE '\\'
              )
            ORDER BY canonical_ref
            LIMIT ?
        """
        try:
            rows = self._connection.execute(
                sql,
                (*object_types, after_ref, literal, literal, limit),
            ).fetchall()
        except sqlite3.Error as exc:
            raise RuntimeBoundaryError("synthetic search query failed") from exc
        return [_record(row) for row in rows]

    def get_visible_object(
        self,
        canonical_ref: str,
        *,
        allowed_object_types: Iterable[str],
    ) -> KnowledgeRecord | None:
        object_types = tuple(sorted(set(allowed_object_types)))
        if not object_types:
            raise PolicyBlockedError("object allowlist is empty")
        placeholders = ",".join("?" for _ in object_types)
        sql = f"""
            SELECT
                canonical_ref, object_type, display_name,
                effective_sensitive_level, ai_use_policy,
                ai_summary, summary_version, summary_hash
            FROM knowledge_objects
            WHERE {VISIBLE_OBJECT_PREDICATE}
              AND object_type IN ({placeholders})
              AND canonical_ref = ?
        """
        try:
            row = self._connection.execute(sql, (*object_types, canonical_ref)).fetchone()
        except sqlite3.Error as exc:
            raise RuntimeBoundaryError("synthetic object query failed") from exc
        return _record(row) if row is not None else None

    def related_visible(
        self,
        *,
        canonical_ref: str,
        direction: str,
        allowed_object_types: Iterable[str],
        allowed_relation_types: Iterable[str],
        after_ref: str,
        limit: int,
    ) -> list[KnowledgeRelation]:
        object_types = tuple(sorted(set(allowed_object_types)))
        relation_types = tuple(sorted(set(allowed_relation_types)))
        if not object_types or not relation_types:
            raise PolicyBlockedError("relation or object allowlist is empty")
        object_placeholders = ",".join("?" for _ in object_types)
        relation_placeholders = ",".join("?" for _ in relation_types)
        direction_sql = {
            "outgoing": "r.source_ref = ?",
            "incoming": "r.target_ref = ?",
            "both": "(r.source_ref = ? OR r.target_ref = ?)",
        }[direction]
        direction_params: tuple[str, ...] = (
            (canonical_ref, canonical_ref) if direction == "both" else (canonical_ref,)
        )
        sql = f"""
            SELECT r.relation_ref, r.relation_type, r.source_ref, r.target_ref
            FROM knowledge_relations AS r
            JOIN knowledge_objects AS source ON source.canonical_ref = r.source_ref
            JOIN knowledge_objects AS target ON target.canonical_ref = r.target_ref
            WHERE {direction_sql}
              AND r.relation_ref LIKE 'fixture://%'
              AND r.relation_type IN ({relation_placeholders})
              AND r.relation_ref > ?
              AND source.canonical_ref LIKE 'fixture://%'
              AND target.canonical_ref LIKE 'fixture://%'
              AND source.effective_sensitive_level = 'public'
              AND target.effective_sensitive_level = 'public'
              AND source.ai_use_policy IN ('public_summary', 'metadata_only')
              AND target.ai_use_policy IN ('public_summary', 'metadata_only')
              AND source.object_type IN ({object_placeholders})
              AND target.object_type IN ({object_placeholders})
            ORDER BY r.relation_ref
            LIMIT ?
        """
        params = (
            *direction_params,
            *relation_types,
            after_ref,
            *object_types,
            *object_types,
            limit,
        )
        try:
            rows = self._connection.execute(sql, params).fetchall()
        except sqlite3.Error as exc:
            raise RuntimeBoundaryError("synthetic relation query failed") from exc
        return [
            KnowledgeRelation(
                relation_ref=str(row["relation_ref"]),
                relation_type=str(row["relation_type"]),
                source_ref=str(row["source_ref"]),
                target_ref=str(row["target_ref"]),
            )
            for row in rows
        ]
