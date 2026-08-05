from __future__ import annotations

import hashlib
import json
import re
import sqlite3
import uuid
from dataclasses import dataclass
from typing import Any


@dataclass(frozen=True)
class ApproveSummary:
    import_job_id: str
    items_created: int
    items_updated: int
    items_deprecated: int
    relations_created: int
    relations_deleted: int
    source_references_created: int
    source_references_reused: int
    warnings: list[str]

    def to_dict(self) -> dict[str, Any]:
        return {
            "import_job_id": self.import_job_id,
            "items_created": self.items_created,
            "items_updated": self.items_updated,
            "items_deprecated": self.items_deprecated,
            "relations_created": self.relations_created,
            "relations_deleted": self.relations_deleted,
            "source_references_created": self.source_references_created,
            "source_references_reused": self.source_references_reused,
            "warnings": self.warnings,
        }


class ImportApprovalError(ValueError):
    def __init__(self, code: str, message: str) -> None:
        self.code = code
        super().__init__(f"{code}: {message}")


def _loads(value: str | None, default: Any) -> Any:
    if not value:
        return default
    return json.loads(value)


def _dumps(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, sort_keys=True)


def _stable_slug(raw: Any, fallback_prefix: str) -> str:
    value = str(raw or "").strip()
    if (
        value
        and re.match(r"^[A-Za-z0-9][A-Za-z0-9._:#/-]*$", value)
        and not re.search(r"\s", value)
    ):
        return value
    digest = hashlib.sha256((value or fallback_prefix).encode("utf-8")).hexdigest()[:16]
    prefix = re.sub(
        r"[^A-Za-z0-9._:#/-]+",
        "-",
        str(fallback_prefix or "object"),
    ).strip("-") or "object"
    return f"{prefix}:hash:{digest}"


def _public_id(prefix: str, stable_ref: str) -> str:
    digest = hashlib.sha256(stable_ref.encode("utf-8")).hexdigest()[:16]
    return f"{prefix}_{digest}"


def _stable_identity_enabled(conn: sqlite3.Connection, table: str) -> bool:
    required = {"stable_key", "stable_ref", "public_id"}
    columns = {
        row["name"]
        for row in conn.execute(f"PRAGMA table_info({table})").fetchall()
    }
    available = required & columns
    if not available:
        return False
    if available != required:
        missing = ", ".join(sorted(required - available))
        raise ValueError(f"STABLE_IDENTITY_SCHEMA_INCOMPLETE: {table} missing {missing}")
    return True


def _item_stable_identity(row: sqlite3.Row, metadata: dict[str, Any]) -> tuple[str, str, str]:
    item_type = row["type"] or "knowledge_item"
    raw_key = (
        metadata.get("stable_key")
        or metadata.get("object_key")
        or row["code"]
        or row["title"]
        or row["id"]
    )
    stable_key = _stable_slug(raw_key, item_type)
    stable_ref = f"base:{item_type}:{stable_key}"
    return stable_key, stable_ref, _public_id("ki", stable_ref)


def _relation_stable_identity(
    row: sqlite3.Row,
    metadata: dict[str, Any],
    *,
    source_item_id: str,
    target_item_id: str,
) -> tuple[str, str, str]:
    relation_type = row["relation_type"] or "relation"
    raw_key = (
        metadata.get("stable_key")
        or metadata.get("relation_key")
        or f"{source_item_id}:{relation_type}:{target_item_id}"
    )
    stable_key = _stable_slug(raw_key, relation_type)
    stable_ref = f"base_relation:{relation_type}:{stable_key}"
    return stable_key, stable_ref, _public_id("kr", stable_ref)


def _item_key_from_row(row: sqlite3.Row) -> str:
    metadata = _loads(row["metadata_json"], {})
    return metadata.get("object_key") or "::".join([row["type"], row["code"] or "", row["title"]])


def _item_key_from_item(row: sqlite3.Row) -> str:
    metadata = _loads(row["metadata_json"], {})
    return metadata.get("object_key") or "::".join([row["type"], row["code"] or "", row["title"]])


def _is_manual_protected(metadata: dict[str, Any]) -> bool:
    return bool(
        metadata.get("manual_protected")
        or metadata.get("manual_override")
        or metadata.get("manual_edit")
        or metadata.get("source_mode") == "manual"
        or metadata.get("managed_by") == "manual"
    )


def _source_sheets_from_staging(rows: list[sqlite3.Row]) -> set[str]:
    sheets: set[str] = set()
    for row in rows:
        for source in _loads(row["source_reference_json"], []):
            sheet = source.get("source_sheet")
            if sheet:
                sheets.add(sheet)
    return sheets


def _source_sheets_for_import(job: sqlite3.Row, rows: list[sqlite3.Row]) -> set[str]:
    sheets = _source_sheets_from_staging(rows)
    payload = _loads(job["summary_json"], {})
    selected_sheets = payload.get("selected_sheets", [])
    if isinstance(selected_sheets, list):
        sheets.update(
            sheet.strip()
            for sheet in selected_sheets
            if isinstance(sheet, str) and sheet.strip()
        )
    return sheets


def _has_blocking_validations(job: sqlite3.Row) -> bool:
    payload = _loads(job["summary_json"], {})
    validations = payload.get("stage_summary", {}).get("validations", [])
    return any(message.get("level") in {"error", "blocking"} for message in validations)


def _find_item_by_key(conn: sqlite3.Connection, key: str, *, include_deprecated: bool = False) -> str | None:
    where_clause = "" if include_deprecated else "WHERE status = 'active'"
    rows = conn.execute(
        f"SELECT id, type, code, title, metadata_json FROM knowledge_items {where_clause}"
    ).fetchall()
    for row in rows:
        metadata = _loads(row["metadata_json"], {})
        row_key = metadata.get("object_key") or "::".join([row["type"], row["code"] or "", row["title"]])
        if row_key == key:
            return row["id"]
    return None


def _validated_matched_item_id(conn: sqlite3.Connection, matched_item_id: str | None, item_key: str) -> str | None:
    if not matched_item_id:
        return None
    row = conn.execute(
        "SELECT id, type, code, title, metadata_json FROM knowledge_items WHERE id = ?",
        (matched_item_id,),
    ).fetchone()
    if not row:
        return None
    if _item_key_from_item(row) == item_key:
        return matched_item_id
    return None


def _existing_relation_for_upsert(
    conn: sqlite3.Connection,
    *,
    source_item_id: str,
    target_item_id: str,
    relation_type: str,
) -> str | None:
    if relation_type == "instance_of":
        rows = conn.execute(
            """
            SELECT id, target_item_id
            FROM knowledge_relations
            WHERE source_item_id = ? AND relation_type = ?
            """,
            (source_item_id, relation_type),
        ).fetchall()
        if len(rows) > 1:
            raise ValueError(
                f"instance_of 来源端存在多重关系：source_item_id={source_item_id}"
            )
        if rows and rows[0]["target_item_id"] != target_item_id:
            raise ValueError(
                "instance_of 目标变更必须停止并人工裁定："
                f"source_item_id={source_item_id}, "
                f"existing_target_item_id={rows[0]['target_item_id']}, "
                f"requested_target_item_id={target_item_id}"
            )
        return rows[0]["id"] if rows else None

    row = conn.execute(
        """
        SELECT id FROM knowledge_relations
        WHERE source_item_id = ? AND target_item_id = ? AND relation_type = ?
        LIMIT 1
        """,
        (source_item_id, target_item_id, relation_type),
    ).fetchone()
    return row["id"] if row else None


def _write_source_refs(
    conn: sqlite3.Connection,
    *,
    target_type: str,
    target_id: str,
    source_file_id: str,
    source_hash: str,
    source_refs: list[dict[str, Any]],
) -> tuple[int, int]:
    created = 0
    reused = 0
    for source in source_refs[:20]:
        values = (
            target_type,
            target_id,
            source_file_id,
            source.get("source_sheet"),
            source.get("source_row"),
            source.get("source_column"),
            source.get("source_cell"),
            source.get("raw_value"),
            source_hash,
        )
        existing = conn.execute(
            """
            SELECT id
            FROM source_references
            WHERE target_type = ?
              AND target_id = ?
              AND source_file_id = ?
              AND source_sheet IS ?
              AND source_row IS ?
              AND source_column IS ?
              AND source_cell IS ?
              AND raw_value IS ?
              AND source_hash = ?
            LIMIT 1
            """,
            values,
        ).fetchone()
        if existing:
            reused += 1
            continue
        conn.execute(
            """
            INSERT INTO source_references (
              id, target_type, target_id, source_file_id, source_sheet, source_row,
              source_column, source_cell, raw_value, source_hash
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                str(uuid.uuid4()),
                *values,
            ),
        )
        created += 1
    return created, reused


def _record_review_decision(
    conn: sqlite3.Connection,
    *,
    import_job_id: str,
    staging_type: str,
    staging_id: str,
    decision: str = "approve",
    note: str | None = None,
) -> None:
    existing = conn.execute(
        """
        SELECT id FROM review_decisions
        WHERE import_job_id = ? AND staging_type = ? AND staging_id = ? AND decision = ?
        LIMIT 1
        """,
        (import_job_id, staging_type, staging_id, decision),
    ).fetchone()
    if existing:
        return
    conn.execute(
        """
        INSERT INTO review_decisions (id, import_job_id, staging_type, staging_id, decision, note)
        VALUES (?, ?, ?, ?, ?, ?)
        """,
        (str(uuid.uuid4()), import_job_id, staging_type, staging_id, decision, note),
    )


def _has_other_valid_source_reference(
    conn: sqlite3.Connection,
    *,
    target_type: str,
    target_id: str,
    excluded_source_file_id: str,
) -> bool:
    return conn.execute(
        """
        SELECT 1
        FROM source_references AS refs
        JOIN source_files AS sources ON sources.id = refs.source_file_id
        WHERE refs.target_type = ?
          AND refs.target_id = ?
          AND refs.source_file_id != ?
          AND refs.source_hash = sources.file_hash
        LIMIT 1
        """,
        (target_type, target_id, excluded_source_file_id),
    ).fetchone() is not None


def _deprecate_stale_items(
    conn: sqlite3.Connection,
    *,
    import_job_id: str,
    source_file_id: str,
    source_file_path: str | None,
    current_item_keys: set[str],
    current_item_types: set[str],
    source_sheets: set[str],
) -> int:
    if not source_file_id or not source_file_path or not source_sheets:
        return 0

    sheet_placeholders = ", ".join("?" for _ in source_sheets)
    params = [
        *sorted(source_sheets),
        source_file_id,
        source_file_id,
        *sorted(source_sheets),
    ]
    candidates = conn.execute(
        f"""
        SELECT DISTINCT item.id, item.type, item.code, item.title, item.status,
               item.source_file_id, item.source_hash, item.metadata_json
        FROM knowledge_items AS item
        WHERE item.status = 'active'
          AND EXISTS (
              SELECT 1
              FROM source_references AS current_refs
              JOIN source_files AS current_ref_source
                ON current_ref_source.id = current_refs.source_file_id
              WHERE current_refs.target_type = 'item'
                AND current_refs.target_id = item.id
                AND current_refs.source_sheet IN ({sheet_placeholders})
                AND current_ref_source.id = ?
          )
          AND NOT EXISTS (
              SELECT 1
              FROM source_references AS other_refs
              JOIN source_files AS other_ref_source ON other_ref_source.id = other_refs.source_file_id
              WHERE other_refs.target_type = 'item'
                AND other_refs.target_id = item.id
                AND other_ref_source.id = ?
                AND (
                    other_refs.source_sheet IS NULL
                    OR other_refs.source_sheet NOT IN ({sheet_placeholders})
                )
          )
        """,
        params,
    ).fetchall()

    count = 0
    for row in candidates:
        item_key = _item_key_from_item(row)
        if item_key in current_item_keys:
            continue
        metadata = _loads(row["metadata_json"], {})
        if _is_manual_protected(metadata):
            continue
        if _has_other_valid_source_reference(
            conn,
            target_type="item",
            target_id=row["id"],
            excluded_source_file_id=source_file_id,
        ):
            continue
        conn.execute(
            """
            UPDATE knowledge_items
            SET status = 'deprecated', updated_at = datetime('now')
            WHERE id = ?
            """,
            (row["id"],),
        )
        conn.execute(
            """
            INSERT INTO change_logs (id, target_type, target_id, change_type, before_json, after_json, import_job_id)
            VALUES (?, 'item', ?, 'deprecate', ?, ?, ?)
            """,
            (
                str(uuid.uuid4()),
                row["id"],
                _dumps(
                    {
                        "status": row["status"],
                        "type": row["type"],
                        "code": row["code"],
                        "title": row["title"],
                        "object_key": item_key,
                    }
                ),
                _dumps(
                    {
                        "status": "deprecated",
                        "reason": "not_found_in_same_source_sheet_reimport",
                        "source_file_path": source_file_path,
                        "source_sheets": sorted(source_sheets),
                    }
                ),
                import_job_id,
            ),
        )
        count += 1
    return count


def _delete_stale_relations(
    conn: sqlite3.Connection,
    *,
    import_job_id: str,
    source_file_id: str,
    source_file_path: str | None,
    current_relation_keys: set[tuple[str, str, str]],
    source_sheets: set[str],
) -> int:
    if not source_file_id or not source_file_path or not source_sheets:
        return 0

    sheet_placeholders = ", ".join("?" for _ in source_sheets)
    params = [
        *sorted(source_sheets),
        source_file_id,
        source_file_id,
        *sorted(source_sheets),
    ]
    candidates = conn.execute(
        f"""
        SELECT DISTINCT relation.id, relation.source_item_id, relation.target_item_id,
               relation.relation_type, relation.relation_label, relation.confidence,
               relation.source_file_id, relation.metadata_json
        FROM knowledge_relations AS relation
        WHERE EXISTS (
              SELECT 1
              FROM source_references AS current_refs
              JOIN source_files AS current_ref_source
                ON current_ref_source.id = current_refs.source_file_id
              WHERE current_refs.target_type = 'relation'
                AND current_refs.target_id = relation.id
                AND current_refs.source_sheet IN ({sheet_placeholders})
                AND current_ref_source.id = ?
          )
          AND NOT EXISTS (
              SELECT 1
              FROM source_references AS other_refs
              JOIN source_files AS other_ref_source ON other_ref_source.id = other_refs.source_file_id
              WHERE other_refs.target_type = 'relation'
                AND other_refs.target_id = relation.id
                AND other_ref_source.id = ?
                AND (
                    other_refs.source_sheet IS NULL
                    OR other_refs.source_sheet NOT IN ({sheet_placeholders})
                )
          )
        """,
        params,
    ).fetchall()

    count = 0
    for row in candidates:
        relation_key = (row["source_item_id"], row["relation_type"], row["target_item_id"])
        if relation_key in current_relation_keys:
            continue
        if _has_other_valid_source_reference(
            conn,
            target_type="relation",
            target_id=row["id"],
            excluded_source_file_id=source_file_id,
        ):
            continue
        conn.execute("DELETE FROM source_references WHERE target_type = 'relation' AND target_id = ?", (row["id"],))
        conn.execute("DELETE FROM knowledge_relations WHERE id = ?", (row["id"],))
        conn.execute(
            """
            INSERT INTO change_logs (id, target_type, target_id, change_type, before_json, after_json, import_job_id)
            VALUES (?, 'relation', ?, 'deprecate', ?, ?, ?)
            """,
            (
                str(uuid.uuid4()),
                row["id"],
                _dumps(
                    {
                        "relation_type": row["relation_type"],
                        "relation_label": row["relation_label"],
                        "confidence": row["confidence"],
                        "source_item_id": row["source_item_id"],
                        "target_item_id": row["target_item_id"],
                        "metadata": _loads(row["metadata_json"], {}),
                    }
                ),
                _dumps(
                    {
                        "reason": "not_found_in_same_source_sheet_reimport",
                        "source_file_path": source_file_path,
                        "source_sheets": sorted(source_sheets),
                    }
                ),
                import_job_id,
            ),
        )
        count += 1
    return count


def _approve_import_locked(
    conn: sqlite3.Connection,
    import_job_id: str,
) -> ApproveSummary:
    job = conn.execute(
        """
        SELECT import_jobs.*, source_files.file_hash, source_files.file_path AS source_file_path
        FROM import_jobs
        JOIN source_files ON source_files.id = import_jobs.source_file_id
        WHERE import_jobs.id = ?
        """,
        (import_job_id,),
    ).fetchone()
    if not job:
        raise ImportApprovalError(
            "IMPORT_JOB_NOT_FOUND",
            f"Import job not found: {import_job_id}",
        )
    status = job["status"]
    if status != "reviewing":
        if status == "approved":
            code = "IMPORT_ALREADY_APPROVED"
        elif status in {"pending", "parsed"}:
            code = "IMPORT_NOT_STAGED"
        else:
            code = "IMPORT_JOB_CLOSED"
        raise ImportApprovalError(
            code,
            f"Import job {import_job_id} cannot be approved from status={status}",
        )

    item_map: dict[str, str] = {}
    items_created = 0
    items_updated = 0
    source_refs_created = 0
    source_refs_reused = 0
    warnings: list[str] = []
    current_item_keys: set[str] = set()
    current_item_types: set[str] = set()
    item_stable_identity_enabled = _stable_identity_enabled(conn, "knowledge_items")
    relation_stable_identity_enabled = _stable_identity_enabled(conn, "knowledge_relations")

    staging_items = conn.execute(
        "SELECT * FROM staging_items WHERE import_job_id = ? AND validation_status != 'error'",
        (import_job_id,),
    ).fetchall()

    for row in staging_items:
        metadata = _loads(row["metadata_json"], {})
        stable_identity = (
            _item_stable_identity(row, metadata)
            if item_stable_identity_enabled
            else None
        )
        item_key = _item_key_from_row(row)
        item_id = _validated_matched_item_id(conn, row["matched_item_id"], item_key) or _find_item_by_key(
            conn,
            item_key,
            include_deprecated=True,
        )
        if item_id:
            if stable_identity:
                conn.execute(
                    """
                    UPDATE knowledge_items
                    SET code = COALESCE(?, code),
                        title = ?, description = COALESCE(?, description), category = COALESCE(?, category),
                        status = 'active', source_file_id = ?, source_hash = ?, metadata_json = ?,
                        stable_key = COALESCE(stable_key, ?),
                        stable_ref = COALESCE(stable_ref, ?),
                        public_id = COALESCE(public_id, ?),
                        updated_at = datetime('now')
                    WHERE id = ?
                    """,
                    (
                        row["code"], row["title"], row["description"], metadata.get("category"),
                        job["source_file_id"], job["file_hash"], _dumps(metadata),
                        *stable_identity, item_id,
                    ),
                )
            else:
                conn.execute(
                    """
                    UPDATE knowledge_items
                    SET code = COALESCE(?, code),
                        title = ?, description = COALESCE(?, description), category = COALESCE(?, category),
                        status = 'active',
                        source_file_id = ?,
                        source_hash = ?,
                        metadata_json = ?, updated_at = datetime('now')
                    WHERE id = ?
                    """,
                    (
                        row["code"],
                        row["title"],
                        row["description"],
                        metadata.get("category"),
                        job["source_file_id"],
                        job["file_hash"],
                        _dumps(metadata),
                        item_id,
                    ),
                )
            items_updated += 1
            change_type = "update"
        else:
            item_id = str(uuid.uuid4())
            if stable_identity:
                conn.execute(
                    """
                    INSERT INTO knowledge_items (
                      id, type, code, title, description, category, status, source_file_id,
                      source_hash, metadata_json, stable_key, stable_ref, public_id
                    )
                    VALUES (?, ?, ?, ?, ?, ?, 'active', ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        item_id, row["type"], row["code"], row["title"], row["description"],
                        metadata.get("category"), job["source_file_id"], job["file_hash"],
                        _dumps(metadata), *stable_identity,
                    ),
                )
            else:
                conn.execute(
                    """
                    INSERT INTO knowledge_items (
                      id, type, code, title, description, category, status, source_file_id,
                      source_hash, metadata_json
                    )
                    VALUES (?, ?, ?, ?, ?, ?, 'active', ?, ?, ?)
                    """,
                    (
                        item_id,
                        row["type"],
                        row["code"],
                        row["title"],
                        row["description"],
                        metadata.get("category"),
                        job["source_file_id"],
                        job["file_hash"],
                        _dumps(metadata),
                    ),
                )
            items_created += 1
            change_type = "create"

        item_map[item_key] = item_id
        current_item_keys.add(item_key)
        current_item_types.add(row["type"])
        source_refs = _loads(row["source_reference_json"], [])
        created, reused = _write_source_refs(
            conn,
            target_type="item",
            target_id=item_id,
            source_file_id=job["source_file_id"],
            source_hash=job["file_hash"],
            source_refs=source_refs,
        )
        source_refs_created += created
        source_refs_reused += reused
        conn.execute(
            """
            INSERT INTO change_logs (id, target_type, target_id, change_type, after_json, import_job_id)
            VALUES (?, 'item', ?, ?, ?, ?)
            """,
            (str(uuid.uuid4()), item_id, change_type, _dumps({"staging_item_id": row["id"]}), import_job_id),
        )
        _record_review_decision(
            conn,
            import_job_id=import_job_id,
            staging_type="item",
            staging_id=row["id"],
            decision="approve",
        )

    relations_created = 0
    current_relation_keys: set[tuple[str, str, str]] = set()
    has_unresolved_relations = False
    staging_relations = conn.execute(
        "SELECT * FROM staging_relations WHERE import_job_id = ? AND validation_status != 'error'",
        (import_job_id,),
    ).fetchall()
    for row in staging_relations:
        source_item_id = item_map.get(row["source_item_key"]) or _find_item_by_key(conn, row["source_item_key"])
        target_item_id = item_map.get(row["target_item_key"]) or _find_item_by_key(conn, row["target_item_key"])
        if not source_item_id or not target_item_id:
            has_unresolved_relations = True
            warnings.append(f"关系端点未找到，跳过：{row['relation_type']} {row['source_item_key']} -> {row['target_item_key']}")
            _record_review_decision(
                conn,
                import_job_id=import_job_id,
                staging_type="relation",
                staging_id=row["id"],
                decision="needs_fix",
                note="关系端点未找到",
            )
            continue
        current_relation_keys.add((source_item_id, row["relation_type"], target_item_id))
        existing_relation_id = _existing_relation_for_upsert(
            conn,
            source_item_id=source_item_id,
            target_item_id=target_item_id,
            relation_type=row["relation_type"],
        )
        metadata = _loads(row["metadata_json"], {})
        stable_identity = (
            _relation_stable_identity(
                row,
                metadata,
                source_item_id=source_item_id,
                target_item_id=target_item_id,
            )
            if relation_stable_identity_enabled
            else None
        )
        if existing_relation_id:
            relation_id = existing_relation_id
            if stable_identity:
                conn.execute(
                    """
                    UPDATE knowledge_relations
                    SET relation_label = COALESCE(?, relation_label),
                        confidence = COALESCE(?, confidence), source_file_id = ?,
                        import_job_id = ?, metadata_json = ?,
                        stable_key = COALESCE(stable_key, ?),
                        stable_ref = COALESCE(stable_ref, ?),
                        public_id = COALESCE(public_id, ?),
                        updated_at = datetime('now')
                    WHERE id = ?
                    """,
                    (
                        metadata.get("relation_label"), metadata.get("confidence", "exact"),
                        job["source_file_id"], import_job_id, _dumps(metadata),
                        *stable_identity, relation_id,
                    ),
                )
            else:
                conn.execute(
                    """
                    UPDATE knowledge_relations
                    SET relation_label = COALESCE(?, relation_label),
                        confidence = COALESCE(?, confidence),
                        source_file_id = ?,
                        import_job_id = ?,
                        metadata_json = ?,
                        updated_at = datetime('now')
                    WHERE id = ?
                    """,
                    (
                        metadata.get("relation_label"),
                        metadata.get("confidence", "exact"),
                        job["source_file_id"],
                        import_job_id,
                        _dumps(metadata),
                        relation_id,
                    ),
                )
        else:
            relation_id = str(uuid.uuid4())
            if stable_identity:
                conn.execute(
                    """
                    INSERT INTO knowledge_relations (
                      id, source_item_id, target_item_id, relation_type, relation_label,
                      confidence, source_file_id, import_job_id, metadata_json,
                      stable_key, stable_ref, public_id
                    )
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        relation_id, source_item_id, target_item_id, row["relation_type"],
                        metadata.get("relation_label"), metadata.get("confidence", "exact"),
                        job["source_file_id"], import_job_id, _dumps(metadata), *stable_identity,
                    ),
                )
            else:
                conn.execute(
                    """
                    INSERT INTO knowledge_relations (
                      id, source_item_id, target_item_id, relation_type, relation_label,
                      confidence, source_file_id, import_job_id, metadata_json
                    )
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        relation_id,
                        source_item_id,
                        target_item_id,
                        row["relation_type"],
                        metadata.get("relation_label"),
                        metadata.get("confidence", "exact"),
                        job["source_file_id"],
                        import_job_id,
                        _dumps(metadata),
                    ),
                )
            relations_created += 1
            conn.execute(
                """
                INSERT INTO change_logs (id, target_type, target_id, change_type, after_json, import_job_id)
                VALUES (?, 'relation', ?, 'create', ?, ?)
                """,
                (str(uuid.uuid4()), relation_id, _dumps({"staging_relation_id": row["id"]}), import_job_id),
            )
        source_refs = _loads(row["source_reference_json"], [])
        created, reused = _write_source_refs(
            conn,
            target_type="relation",
            target_id=relation_id,
            source_file_id=job["source_file_id"],
            source_hash=job["file_hash"],
            source_refs=source_refs,
        )
        source_refs_created += created
        source_refs_reused += reused
        _record_review_decision(
            conn,
            import_job_id=import_job_id,
            staging_type="relation",
            staging_id=row["id"],
            decision="approve",
        )

    items_deprecated = 0
    relations_deleted = 0
    if _has_blocking_validations(job):
        warnings.append("本次导入存在 error/blocking 校验信息，已跳过旧对象自动停用。")
    else:
        source_sheets = _source_sheets_for_import(job, staging_items)
        if has_unresolved_relations:
            warnings.append("本次导入存在未解析关系，已跳过旧关系自动删除。")
        else:
            relations_deleted = _delete_stale_relations(
                conn,
                import_job_id=import_job_id,
                source_file_id=job["source_file_id"],
                source_file_path=job["source_file_path"],
                current_relation_keys=current_relation_keys,
                source_sheets=source_sheets,
            )
        items_deprecated = _deprecate_stale_items(
            conn,
            import_job_id=import_job_id,
            source_file_id=job["source_file_id"],
            source_file_path=job["source_file_path"],
            current_item_keys=current_item_keys,
            current_item_types=current_item_types,
            source_sheets=source_sheets,
        )

    violations = conn.execute("PRAGMA foreign_key_check").fetchall()
    if violations:
        raise ValueError(
            f"IMPORT_APPROVAL_FOREIGN_KEY_VIOLATION: {len(violations)} violation(s)"
        )

    summary = ApproveSummary(
        import_job_id=import_job_id,
        items_created=items_created,
        items_updated=items_updated,
        items_deprecated=items_deprecated,
        relations_created=relations_created,
        relations_deleted=relations_deleted,
        source_references_created=source_refs_created,
        source_references_reused=source_refs_reused,
        warnings=warnings,
    )
    job_summary = _loads(job["summary_json"], {})
    job_summary["approval_summary"] = summary.to_dict()
    conn.execute(
        """
        UPDATE import_jobs
        SET status = 'approved', finished_at = datetime('now'), summary_json = ?
        WHERE id = ?
        """,
        (_dumps(job_summary), import_job_id),
    )
    return summary


def approve_import(conn: sqlite3.Connection, import_job_id: str) -> ApproveSummary:
    if conn.in_transaction:
        raise RuntimeError(
            "IMPORT_TRANSACTION_NOT_CLEAN: approve_import requires a clean connection"
        )
    try:
        conn.execute("BEGIN IMMEDIATE")
        summary = _approve_import_locked(conn, import_job_id)
        conn.commit()
        return summary
    except Exception:
        conn.rollback()
        raise
