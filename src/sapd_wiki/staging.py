from __future__ import annotations

import json
import sqlite3
import uuid
from collections import Counter
from dataclasses import dataclass
from typing import Any

from .candidates import ObjectCandidate, ParseResult, RelationCandidate


@dataclass(frozen=True)
class StageSummary:
    import_job_id: str
    objects_total: int
    objects_staged: int
    relations_total: int
    relations_staged: int
    validations: list[dict[str, Any]]
    object_counts: dict[str, int]
    relation_counts: dict[str, int]

    def to_dict(self) -> dict[str, Any]:
        return {
            "import_job_id": self.import_job_id,
            "objects_total": self.objects_total,
            "objects_staged": self.objects_staged,
            "relations_total": self.relations_total,
            "relations_staged": self.relations_staged,
            "validations": self.validations,
            "object_counts": self.object_counts,
            "relation_counts": self.relation_counts,
        }


def _json(data: Any) -> str:
    return json.dumps(data, ensure_ascii=False, sort_keys=True)


def _merge_objects(objects: list[ObjectCandidate]) -> dict[str, ObjectCandidate]:
    merged: dict[str, ObjectCandidate] = {}
    for obj in objects:
        if not obj.title:
            continue
        existing = merged.get(obj.key)
        if not existing:
            merged[obj.key] = obj
            continue
        existing.sources.extend(obj.sources)
        for key, value in obj.metadata.items():
            if key not in existing.metadata and value is not None:
                existing.metadata[key] = value
        if not existing.description and obj.description:
            existing.description = obj.description
        if not existing.category and obj.category:
            existing.category = obj.category
    return merged


def _merge_relations(relations: list[RelationCandidate]) -> dict[str, RelationCandidate]:
    merged: dict[str, RelationCandidate] = {}
    for rel in relations:
        existing = merged.get(rel.key)
        if not existing:
            merged[rel.key] = rel
            continue
        existing.sources.extend(rel.sources)
        for key, value in rel.metadata.items():
            if key not in existing.metadata and value is not None:
                existing.metadata[key] = value
    return merged


def _match_item(conn: sqlite3.Connection, obj: ObjectCandidate) -> str | None:
    if obj.type == "environment_segment":
        if not obj.qualifier:
            raise ValueError("environment_segment 匹配必须提供信息化环境 qualifier")
        matches = []
        for row in conn.execute(
            """
            SELECT id, metadata_json
            FROM knowledge_items
            WHERE type = ? AND title = ?
            """,
            (obj.type, obj.title),
        ).fetchall():
            metadata = json.loads(row["metadata_json"] or "{}")
            if metadata.get("object_key") == obj.key:
                matches.append(row["id"])
        if len(matches) > 1:
            raise ValueError(f"environment_segment 上下文身份重复：{obj.key}")
        return matches[0] if matches else None
    if obj.code:
        row = conn.execute(
            "SELECT id FROM knowledge_items WHERE type = ? AND code = ? LIMIT 1",
            (obj.type, obj.code),
        ).fetchone()
        if row:
            return row["id"]
    row = conn.execute(
        "SELECT id FROM knowledge_items WHERE type = ? AND title = ? LIMIT 1",
        (obj.type, obj.title),
    ).fetchone()
    return row["id"] if row else None


def write_staging(conn: sqlite3.Connection, import_job_id: str, result: ParseResult) -> StageSummary:
    objects = _merge_objects(result.objects)
    relations = _merge_relations(result.relations)
    object_counts: Counter[str] = Counter()
    relation_counts: Counter[str] = Counter()

    conn.execute("DELETE FROM staging_relations WHERE import_job_id = ?", (import_job_id,))
    conn.execute("DELETE FROM staging_items WHERE import_job_id = ?", (import_job_id,))

    for obj in objects.values():
        matched_item_id = _match_item(conn, obj)
        proposed_action = "update" if matched_item_id else "create"
        source_refs = [source.to_dict() for source in obj.sources]
        metadata = dict(obj.metadata)
        if obj.category and not metadata.get("category"):
            metadata["category"] = obj.category
        metadata["object_key"] = obj.key
        metadata["source_count"] = len(source_refs)
        conn.execute(
            """
            INSERT INTO staging_items (
              id, import_job_id, proposed_action, matched_item_id, type, code, title,
              description, metadata_json, source_reference_json, validation_status,
              validation_message
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ok', NULL)
            """,
            (
                str(uuid.uuid4()),
                import_job_id,
                proposed_action,
                matched_item_id,
                obj.type,
                obj.code,
                obj.title,
                obj.description,
                _json(metadata),
                _json(source_refs),
            ),
        )
        object_counts[obj.type] += 1

    for rel in relations.values():
        source_refs = [source.to_dict() for source in rel.sources]
        metadata = dict(rel.metadata)
        metadata["relation_key"] = rel.key
        metadata["relation_label"] = rel.relation_label
        metadata["confidence"] = rel.confidence
        metadata["source_count"] = len(source_refs)
        validation_status = "ok"
        validation_message = None
        if rel.source_key not in objects or rel.target_key not in objects:
            validation_status = "warning"
            validation_message = "关系端点未在本次候选对象中找到，approve 时会尝试匹配正式库"
        conn.execute(
            """
            INSERT INTO staging_relations (
              id, import_job_id, proposed_action, matched_relation_id,
              source_item_key, target_item_key, relation_type, metadata_json,
              source_reference_json, validation_status, validation_message
            )
            VALUES (?, ?, 'create', NULL, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                str(uuid.uuid4()),
                import_job_id,
                rel.source_key,
                rel.target_key,
                rel.relation_type,
                _json(metadata),
                _json(source_refs),
                validation_status,
                validation_message,
            ),
        )
        relation_counts[rel.relation_type] += 1

    validations = [validation.to_dict() for validation in result.validations]
    return StageSummary(
        import_job_id=import_job_id,
        objects_total=len(result.objects),
        objects_staged=len(objects),
        relations_total=len(result.relations),
        relations_staged=len(relations),
        validations=validations,
        object_counts=dict(sorted(object_counts.items())),
        relation_counts=dict(sorted(relation_counts.items())),
    )
