#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import shutil
import sqlite3
import uuid
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_DB = ROOT / "data" / "database" / "sapd_wiki.sqlite3"
OUT_DIR = ROOT / "data" / "exports" / "worker-verify" / "security-work-merged-cell-grain-fix"
SECURITY_WORK_SHEET = "安全能力-安全工作"


def now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def stamp() -> str:
    return datetime.now().strftime("%Y%m%dT%H%M%S")


def text(value: Any) -> str:
    return "" if value is None else " ".join(str(value).replace("\xa0", " ").split()).strip()


def title_key(value: Any) -> str:
    return "".join(text(value).split())


def object_key_for_title(title: str) -> str:
    return "::".join(["security_work", "", text(title)])


def load_json(value: str | None) -> dict[str, Any]:
    if not value:
        return {}
    try:
        payload = json.loads(value)
    except json.JSONDecodeError:
        return {}
    return payload if isinstance(payload, dict) else {}


def dump_json(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, sort_keys=True)


def write_json(path: Path, value: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def source_position(row: sqlite3.Row) -> tuple[int, str]:
    source_row = row["first_source_row"]
    try:
        row_number = int(source_row)
    except (TypeError, ValueError):
        row_number = 10**9
    return row_number, str(row["id"])


def active_security_work_rows(conn: sqlite3.Connection) -> list[sqlite3.Row]:
    return conn.execute(
        """
        SELECT item.id, item.type, item.code, item.title, item.description, item.category,
               item.status, item.metadata_json,
               MIN(CASE WHEN refs.source_sheet = ? THEN refs.source_row END) AS first_source_row
        FROM knowledge_items AS item
        LEFT JOIN source_references AS refs
          ON refs.target_type = 'item'
         AND refs.target_id = item.id
        WHERE item.type = 'security_work'
          AND item.status = 'active'
        GROUP BY item.id
        ORDER BY item.title, first_source_row, item.id
        """,
        (SECURITY_WORK_SHEET,),
    ).fetchall()


def grouped_security_works(rows: list[sqlite3.Row]) -> list[dict[str, Any]]:
    groups: dict[str, list[sqlite3.Row]] = defaultdict(list)
    for row in rows:
        key = title_key(row["title"])
        if key:
            groups[key].append(row)
    plans = []
    for key, group_rows in sorted(groups.items(), key=lambda item: min(source_position(row) for row in item[1])):
        ordered = sorted(group_rows, key=source_position)
        keeper = ordered[0]
        duplicates = ordered[1:]
        plans.append(
            {
                "key": key,
                "title": text(keeper["title"]),
                "keeperId": keeper["id"],
                "duplicateIds": [row["id"] for row in duplicates],
                "rowCount": len(ordered),
                "firstSourceRow": keeper["first_source_row"],
            }
        )
    return plans


def relation_rows_for_targets(conn: sqlite3.Connection, target_ids: list[str]) -> list[sqlite3.Row]:
    if not target_ids:
        return []
    placeholders = ",".join("?" for _ in target_ids)
    return conn.execute(
        f"""
        SELECT rel.id, rel.source_item_id, rel.target_item_id, rel.relation_type,
               focus.code AS focus_code, focus.title AS focus_title
        FROM knowledge_relations AS rel
        LEFT JOIN knowledge_items AS focus ON focus.id = rel.source_item_id
        WHERE rel.relation_type = 'maps_to_work'
          AND rel.target_item_id IN ({placeholders})
        ORDER BY focus.code, rel.id
        """,
        target_ids,
    ).fetchall()


def dedupe_source_refs(conn: sqlite3.Connection, target_type: str, target_id: str) -> int:
    rows = conn.execute(
        """
        SELECT id, source_file_id, source_sheet, source_row, source_column,
               source_cell, raw_value, source_hash
        FROM source_references
        WHERE target_type = ?
          AND target_id = ?
        ORDER BY created_at, id
        """,
        (target_type, target_id),
    ).fetchall()
    seen: set[tuple[Any, ...]] = set()
    duplicate_ids: list[str] = []
    for row in rows:
        key = (
            row["source_file_id"],
            row["source_sheet"],
            row["source_row"],
            row["source_column"],
            row["source_cell"],
            row["raw_value"],
            row["source_hash"],
        )
        if key in seen:
            duplicate_ids.append(row["id"])
        else:
            seen.add(key)
    if duplicate_ids:
        conn.executemany("DELETE FROM source_references WHERE id = ?", [(item_id,) for item_id in duplicate_ids])
    return len(duplicate_ids)


def normalize_security_work_metadata(metadata: dict[str, Any], title: str) -> dict[str, Any]:
    next_metadata = dict(metadata)
    old_object_key = next_metadata.get("object_key")
    for key in ("capability_focus_code", "capability_category", "capability_domain", "capability"):
        next_metadata.pop(key, None)
    if old_object_key and old_object_key != object_key_for_title(title):
        next_metadata.setdefault("legacy_object_keys", [])
        if isinstance(next_metadata["legacy_object_keys"], list) and old_object_key not in next_metadata["legacy_object_keys"]:
            next_metadata["legacy_object_keys"].append(old_object_key)
    next_metadata["object_key"] = object_key_for_title(title)
    next_metadata["source_grain"] = "security_work_master"
    return next_metadata


def add_change_log(
    conn: sqlite3.Connection,
    *,
    target_type: str,
    target_id: str,
    change_type: str,
    before: dict[str, Any] | None = None,
    after: dict[str, Any] | None = None,
) -> None:
    conn.execute(
        """
        INSERT INTO change_logs (id, target_type, target_id, change_type, before_json, after_json, import_job_id)
        VALUES (?, ?, ?, ?, ?, ?, NULL)
        """,
        (
            str(uuid.uuid4()),
            target_type,
            target_id,
            change_type,
            dump_json(before or {}),
            dump_json(after or {}),
        ),
    )


def apply_plan(conn: sqlite3.Connection, plans: list[dict[str, Any]]) -> dict[str, int]:
    counts = {
        "metadataUpdated": 0,
        "itemsDeprecated": 0,
        "relationsRedirected": 0,
        "duplicateRelationsDeleted": 0,
        "itemSourceRefsReassigned": 0,
        "sourceRefsDeduped": 0,
    }
    id_to_group = {}
    for plan in plans:
        for item_id in [plan["keeperId"], *plan["duplicateIds"]]:
            id_to_group[item_id] = plan

    active_rows = active_security_work_rows(conn)
    for row in active_rows:
        metadata = load_json(row["metadata_json"])
        next_metadata = normalize_security_work_metadata(metadata, row["title"])
        if next_metadata != metadata:
            conn.execute(
                """
                UPDATE knowledge_items
                SET metadata_json = ?, updated_at = datetime('now')
                WHERE id = ?
                """,
                (dump_json(next_metadata), row["id"]),
            )
            counts["metadataUpdated"] += 1

    for plan in plans:
        keeper_id = plan["keeperId"]
        duplicate_ids = plan["duplicateIds"]
        target_ids = [keeper_id, *duplicate_ids]
        for relation in relation_rows_for_targets(conn, target_ids):
            if relation["target_item_id"] == keeper_id:
                continue
            existing = conn.execute(
                """
                SELECT id
                FROM knowledge_relations
                WHERE source_item_id = ?
                  AND target_item_id = ?
                  AND relation_type = ?
                  AND id != ?
                LIMIT 1
                """,
                (relation["source_item_id"], keeper_id, relation["relation_type"], relation["id"]),
            ).fetchone()
            if existing:
                conn.execute(
                    """
                    UPDATE source_references
                    SET target_id = ?
                    WHERE target_type = 'relation'
                      AND target_id = ?
                    """,
                    (existing["id"], relation["id"]),
                )
                conn.execute("DELETE FROM knowledge_relations WHERE id = ?", (relation["id"],))
                counts["duplicateRelationsDeleted"] += 1
                counts["sourceRefsDeduped"] += dedupe_source_refs(conn, "relation", existing["id"])
                add_change_log(
                    conn,
                    target_type="relation",
                    target_id=relation["id"],
                    change_type="deprecate",
                    before={"target_item_id": relation["target_item_id"], "source_item_id": relation["source_item_id"]},
                    after={"reason": "duplicate_after_security_work_master_merge", "kept_relation_id": existing["id"]},
                )
            else:
                conn.execute(
                    """
                    UPDATE knowledge_relations
                    SET target_item_id = ?, updated_at = datetime('now')
                    WHERE id = ?
                    """,
                    (keeper_id, relation["id"]),
                )
                counts["relationsRedirected"] += 1
                add_change_log(
                    conn,
                    target_type="relation",
                    target_id=relation["id"],
                    change_type="update",
                    before={"target_item_id": relation["target_item_id"]},
                    after={"target_item_id": keeper_id, "reason": "security_work_master_merge"},
                )

        for duplicate_id in duplicate_ids:
            duplicate_row = conn.execute(
                "SELECT id, title, status, metadata_json FROM knowledge_items WHERE id = ?",
                (duplicate_id,),
            ).fetchone()
            if not duplicate_row:
                continue
            metadata = load_json(duplicate_row["metadata_json"])
            metadata["merged_into"] = keeper_id
            metadata["merge_reason"] = "security_work_merged_cell_master_grain"
            metadata["source_grain"] = "security_work_relation_row_deprecated"
            conn.execute(
                """
                UPDATE source_references
                SET target_id = ?
                WHERE target_type = 'item'
                  AND target_id = ?
                """,
                (keeper_id, duplicate_id),
            )
            counts["itemSourceRefsReassigned"] += conn.execute("SELECT changes()").fetchone()[0]
            counts["sourceRefsDeduped"] += dedupe_source_refs(conn, "item", keeper_id)
            conn.execute(
                """
                UPDATE knowledge_items
                SET status = 'deprecated',
                    metadata_json = ?,
                    updated_at = datetime('now')
                WHERE id = ?
                """,
                (dump_json(metadata), duplicate_id),
            )
            counts["itemsDeprecated"] += 1
            add_change_log(
                conn,
                target_type="item",
                target_id=duplicate_id,
                change_type="deprecate",
                before={"status": duplicate_row["status"], "title": duplicate_row["title"]},
                after={"status": "deprecated", "merged_into": keeper_id, "reason": "security_work_master_merge"},
            )
    return counts


def package_report(conn: sqlite3.Connection, *, apply: bool, backup_path: Path | None, apply_counts: dict[str, int] | None) -> dict[str, Any]:
    rows = active_security_work_rows(conn)
    plans = [plan for plan in grouped_security_works(rows) if plan["rowCount"] > 1]
    duplicate_item_count = sum(len(plan["duplicateIds"]) for plan in plans)
    relation_count = conn.execute("SELECT COUNT(*) FROM knowledge_relations WHERE relation_type = 'maps_to_work'").fetchone()[0]
    unique_relation_count = conn.execute(
        """
        SELECT COUNT(*)
        FROM (
          SELECT source_item_id, relation_type, target_item_id
          FROM knowledge_relations
          WHERE relation_type = 'maps_to_work'
          GROUP BY source_item_id, relation_type, target_item_id
        )
        """
    ).fetchone()[0]
    return {
        "generatedAt": now_iso(),
        "mode": "apply" if apply else "dry-run",
        "result": "applied" if apply else "dry_run_ready",
        "dbPath": str(DEFAULT_DB.relative_to(ROOT)),
        "backupPath": str(backup_path.relative_to(ROOT)) if backup_path else None,
        "beforeOrCurrent": {
            "activeSecurityWorkRows": len(rows),
            "uniqueSecurityWorkTitles": len({title_key(row["title"]) for row in rows if title_key(row["title"])}),
            "duplicateTitleGroupCount": len(plans),
            "duplicateSecurityWorkItems": duplicate_item_count,
            "mapsToWorkRelations": relation_count,
            "uniqueMapsToWorkRelationTriples": unique_relation_count,
        },
        "plannedMergeGroups": plans,
        "applyCounts": apply_counts or {},
    }


def write_markdown_report(path: Path, report: dict[str, Any]) -> None:
    lines = [
        "# Security Work Merged Cell Grain Fix",
        "",
        f"- mode: `{report['mode']}`",
        f"- result: `{report['result']}`",
        f"- activeSecurityWorkRows: `{report['beforeOrCurrent']['activeSecurityWorkRows']}`",
        f"- uniqueSecurityWorkTitles: `{report['beforeOrCurrent']['uniqueSecurityWorkTitles']}`",
        f"- duplicateTitleGroupCount: `{report['beforeOrCurrent']['duplicateTitleGroupCount']}`",
        f"- duplicateSecurityWorkItems: `{report['beforeOrCurrent']['duplicateSecurityWorkItems']}`",
        f"- mapsToWorkRelations: `{report['beforeOrCurrent']['mapsToWorkRelations']}`",
    ]
    if report.get("backupPath"):
        lines.append(f"- backupPath: `{report['backupPath']}`")
    lines.append("")
    lines.append("| 安全工作 | 当前行数 | 保留 ID | 合并 ID |")
    lines.append("|---|---:|---|---|")
    for group in report.get("initialMergeGroups") or report.get("plannedMergeGroups", []):
        lines.append(
            f"| {group['title']} | {group['rowCount']} | `{group['keeperId']}` | "
            f"{', '.join(f'`{item}`' for item in group['duplicateIds'])} |"
        )
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser(description="Merge security_work master rows created from merged-cell focus relations.")
    parser.add_argument("--db", default=str(DEFAULT_DB), help="SQLite database path.")
    parser.add_argument("--apply", action="store_true", help="Apply changes. Default is dry-run.")
    args = parser.parse_args()

    db_path = Path(args.db)
    if not db_path.is_absolute():
        db_path = ROOT / db_path
    output_dir = OUT_DIR / stamp()
    output_dir.mkdir(parents=True, exist_ok=True)

    backup_path = None
    if args.apply:
        backup_dir = output_dir / "backups"
        backup_dir.mkdir(parents=True, exist_ok=True)
        backup_path = backup_dir / f"{db_path.name}.before-security-work-merged-cell-grain.sqlite3"
        shutil.copy2(db_path, backup_path)

    with sqlite3.connect(db_path) as conn:
        conn.row_factory = sqlite3.Row
        initial = package_report(conn, apply=False, backup_path=backup_path, apply_counts=None)
        plans = initial["plannedMergeGroups"]
        apply_counts = None
        if args.apply and plans:
            with conn:
                apply_counts = apply_plan(conn, plans)
        report = package_report(conn, apply=args.apply, backup_path=backup_path, apply_counts=apply_counts)
        report["initialBefore"] = initial["beforeOrCurrent"]
        report["initialMergeGroups"] = plans

    report_path = output_dir / "security-work-merged-cell-grain-fix-report.json"
    md_path = output_dir / "security-work-merged-cell-grain-fix-report.md"
    write_json(report_path, report)
    write_markdown_report(md_path, report)
    print(json.dumps({**report, "reportPath": str(report_path.relative_to(ROOT))}, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
