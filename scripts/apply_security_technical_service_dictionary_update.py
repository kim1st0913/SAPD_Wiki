#!/usr/bin/env python3
from __future__ import annotations

import json
import shutil
import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from audit_security_technical_service_dictionary_update import DB_PATH, OUT_DIR, ROOT, audit, load_json, text, write_json
from build_security_technical_service_update_candidate import CANDIDATE_DIR, build_candidate


def now_stamp() -> str:
    return datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")


def now_sql() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).strftime("%Y-%m-%d %H:%M:%S")


def backup_file(path: Path, backup_root: Path) -> dict[str, str]:
    rel = path.relative_to(ROOT)
    target = backup_root / rel
    target.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(path, target)
    return {"path": str(rel), "backupPath": str(target.relative_to(ROOT))}


def load_candidate_services() -> list[dict[str, Any]]:
    diff = load_json(OUT_DIR / "security-technical-service-dictionary-diff.json")
    return diff["candidateServices"]


def read_metadata(value: Any) -> dict[str, Any]:
    if not value:
        return {}
    try:
        parsed = json.loads(value)
    except json.JSONDecodeError:
        return {}
    return parsed if isinstance(parsed, dict) else {}


def sqlite_source_defaults(con: sqlite3.Connection) -> tuple[str | None, str | None]:
    row = con.execute(
        """
        select source_file_id, source_hash, count(*) as count
        from knowledge_items
        where type='security_technical_service'
        group by source_file_id, source_hash
        order by count desc
        limit 1
        """
    ).fetchone()
    if not row:
        return None, None
    return row[0], row[1]


def apply_sqlite(candidate_services: list[dict[str, Any]]) -> dict[str, Any]:
    con = sqlite3.connect(DB_PATH)
    con.row_factory = sqlite3.Row
    updated = 0
    inserted = 0
    source_file_id, source_hash = sqlite_source_defaults(con)
    timestamp = now_sql()
    try:
        for service in candidate_services:
            service_id = text(service.get("id"))
            code = text(service.get("code"))
            title = text(service.get("title"))
            category = text(service.get("category"))
            row = con.execute("select * from knowledge_items where id=?", (service_id,)).fetchone()
            if row:
                metadata = read_metadata(row["metadata_json"])
                metadata.update(service.get("metadata") or {})
                metadata["category"] = category
                metadata["scope_code"] = category
                metadata["object_key"] = f"security_technical_service::{code}"
                con.execute(
                    """
                    update knowledge_items
                    set code=?, title=?, description=?, category=?, metadata_json=?, updated_at=?
                    where id=?
                    """,
                    (
                        code,
                        title,
                        service.get("description"),
                        category,
                        json.dumps(metadata, ensure_ascii=False, sort_keys=True),
                        timestamp,
                        service_id,
                    ),
                )
                updated += 1
            else:
                metadata = dict(service.get("metadata") or {})
                metadata["category"] = category
                metadata["scope_code"] = category
                metadata["object_key"] = f"security_technical_service::{code}"
                metadata["source_count"] = 1
                con.execute(
                    """
                    insert into knowledge_items (
                        id, type, code, title, description, category, status, parent_id,
                        source_file_id, source_hash, metadata_json, created_at, updated_at
                    ) values (?, 'security_technical_service', ?, ?, ?, ?, 'active', null, ?, ?, ?, ?, ?)
                    """,
                    (
                        service_id,
                        code,
                        title,
                        service.get("description"),
                        category,
                        source_file_id,
                        source_hash,
                        json.dumps(metadata, ensure_ascii=False, sort_keys=True),
                        timestamp,
                        timestamp,
                    ),
                )
                inserted += 1
        con.commit()
        count = con.execute("select count(*) from knowledge_items where type='security_technical_service'").fetchone()[0]
    finally:
        con.close()
    return {"updated": updated, "inserted": inserted, "sqliteServiceCount": count}


def apply_candidate() -> dict[str, Any]:
    candidate = load_json(OUT_DIR / "security-technical-service-update-candidate.json") if (OUT_DIR / "security-technical-service-update-candidate.json").exists() else build_candidate()
    if candidate.get("status") != "ready_for_apply":
        raise SystemExit(json.dumps({"status": "blocked", "reason": "candidate_not_ready_for_apply", "candidateStatus": candidate.get("status"), "blockers": candidate.get("blockers", [])}, ensure_ascii=False, indent=2))

    backup_root = OUT_DIR / "backups" / now_stamp()
    backups = []
    changed_files = [item for item in candidate.get("files", []) if item.get("changed")]
    for item in changed_files:
        target = ROOT / item["path"]
        candidate_path = ROOT / item["candidatePath"]
        backups.append(backup_file(target, backup_root))
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(candidate_path, target)

    db_backup = backup_file(DB_PATH, backup_root)
    sqlite_result = apply_sqlite(load_candidate_services())
    post_audit = audit(post_apply=True)
    result = {
        "status": "applied",
        "backupRoot": str(backup_root.relative_to(ROOT)),
        "backups": backups,
        "databaseBackup": db_backup,
        "copiedFileCount": len(changed_files),
        "sqlite": sqlite_result,
        "postAudit": post_audit,
    }
    write_json(OUT_DIR / "security-technical-service-update-apply-result.json", result)
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return result


if __name__ == "__main__":
    apply_candidate()
