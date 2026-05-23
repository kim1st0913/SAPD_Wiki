from __future__ import annotations

import json
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
    source_references_created: int
    warnings: list[str]

    def to_dict(self) -> dict[str, Any]:
        return {
            "import_job_id": self.import_job_id,
            "items_created": self.items_created,
            "items_updated": self.items_updated,
            "items_deprecated": self.items_deprecated,
            "relations_created": self.relations_created,
            "source_references_created": self.source_references_created,
            "warnings": self.warnings,
        }


def _loads(value: str | None, default: Any) -> Any:
    if not value:
        return default
    return json.loads(value)


def _dumps(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, sort_keys=True)


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


def _write_source_refs(
    conn: sqlite3.Connection,
    *,
    target_type: str,
    target_id: str,
    source_file_id: str,
    source_hash: str,
    source_refs: list[dict[str, Any]],
) -> int:
    count = 0
    for source in source_refs[:20]:
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
                target_type,
                target_id,
                source_file_id,
                source.get("source_sheet"),
                source.get("source_row"),
                source.get("source_column"),
                source.get("source_cell"),
                source.get("raw_value"),
                source_hash,
            ),
        )
        count += 1
    return count


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


def _deprecate_stale_items(
    conn: sqlite3.Connection,
    *,
    import_job_id: str,
    source_file_path: str | None,
    current_item_keys: set[str],
    current_item_types: set[str],
    source_sheets: set[str],
) -> int:
    if not source_file_path or not current_item_keys or not current_item_types or not source_sheets:
        return 0

    type_placeholders = ", ".join("?" for _ in current_item_types)
    sheet_placeholders = ", ".join("?" for _ in source_sheets)
    params = [
        *sorted(current_item_types),
        *sorted(source_sheets),
        source_file_path,
        source_file_path,
        source_file_path,
        *sorted(source_sheets),
    ]
    candidates = conn.execute(
        f"""
        SELECT DISTINCT item.id, item.type, item.code, item.title, item.status, item.metadata_json
        FROM knowledge_items AS item
        LEFT JOIN source_files AS item_source ON item_source.id = item.source_file_id
        JOIN source_references AS refs
          ON refs.target_type = 'item'
         AND refs.target_id = item.id
        JOIN source_files AS ref_source ON ref_source.id = refs.source_file_id
        WHERE item.status = 'active'
          AND item.type IN ({type_placeholders})
          AND refs.source_sheet IN ({sheet_placeholders})
          AND (item_source.file_path = ? OR ref_source.file_path = ?)
          AND NOT EXISTS (
              SELECT 1
              FROM source_references AS other_refs
              JOIN source_files AS other_ref_source ON other_ref_source.id = other_refs.source_file_id
              WHERE other_refs.target_type = 'item'
                AND other_refs.target_id = item.id
                AND other_ref_source.file_path = ?
                AND other_refs.source_sheet NOT IN ({sheet_placeholders})
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


def approve_import(conn: sqlite3.Connection, import_job_id: str) -> ApproveSummary:
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
        raise ValueError(f"Import job not found: {import_job_id}")

    item_map: dict[str, str] = {}
    items_created = 0
    items_updated = 0
    source_refs_created = 0
    warnings: list[str] = []
    current_item_keys: set[str] = set()
    current_item_types: set[str] = set()

    staging_items = conn.execute(
        "SELECT * FROM staging_items WHERE import_job_id = ? AND validation_status != 'error'",
        (import_job_id,),
    ).fetchall()

    for row in staging_items:
        metadata = _loads(row["metadata_json"], {})
        item_key = _item_key_from_row(row)
        item_id = _validated_matched_item_id(conn, row["matched_item_id"], item_key) or _find_item_by_key(
            conn,
            item_key,
            include_deprecated=True,
        )
        if item_id:
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
        source_refs_created += _write_source_refs(
            conn,
            target_type="item",
            target_id=item_id,
            source_file_id=job["source_file_id"],
            source_hash=job["file_hash"],
            source_refs=source_refs,
        )
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
    staging_relations = conn.execute(
        "SELECT * FROM staging_relations WHERE import_job_id = ? AND validation_status != 'error'",
        (import_job_id,),
    ).fetchall()
    for row in staging_relations:
        source_item_id = item_map.get(row["source_item_key"]) or _find_item_by_key(conn, row["source_item_key"])
        target_item_id = item_map.get(row["target_item_key"]) or _find_item_by_key(conn, row["target_item_key"])
        if not source_item_id or not target_item_id:
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
        existing = conn.execute(
            """
            SELECT id FROM knowledge_relations
            WHERE source_item_id = ? AND target_item_id = ? AND relation_type = ?
            LIMIT 1
            """,
            (source_item_id, target_item_id, row["relation_type"]),
        ).fetchone()
        if existing:
            relation_id = existing["id"]
            metadata = _loads(row["metadata_json"], {})
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
            metadata = _loads(row["metadata_json"], {})
            relation_id = str(uuid.uuid4())
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
        source_refs_created += _write_source_refs(
            conn,
            target_type="relation",
            target_id=relation_id,
            source_file_id=job["source_file_id"],
            source_hash=job["file_hash"],
            source_refs=source_refs,
        )
        _record_review_decision(
            conn,
            import_job_id=import_job_id,
            staging_type="relation",
            staging_id=row["id"],
            decision="approve",
        )

    items_deprecated = 0
    if _has_blocking_validations(job):
        warnings.append("本次导入存在 error/blocking 校验信息，已跳过旧对象自动停用。")
    else:
        items_deprecated = _deprecate_stale_items(
            conn,
            import_job_id=import_job_id,
            source_file_path=job["source_file_path"],
            current_item_keys=current_item_keys,
            current_item_types=current_item_types,
            source_sheets=_source_sheets_from_staging(staging_items),
        )

    conn.execute(
        """
        UPDATE import_jobs
        SET status = 'approved', finished_at = datetime('now')
        WHERE id = ?
        """,
        (import_job_id,),
    )
    return ApproveSummary(
        import_job_id=import_job_id,
        items_created=items_created,
        items_updated=items_updated,
        items_deprecated=items_deprecated,
        relations_created=relations_created,
        source_references_created=source_refs_created,
        warnings=warnings,
    )
