#!/usr/bin/env python3
"""Build a clean base DB candidate for OI-135.

The first OI-135 blocker is not that a security work maps to multiple
capability focuses. That is valid. The blocker is old SQLite rows that copied
the same security_work title as multiple knowledge_items objects. This script
keeps one canonical security_work object per runtime-approved title and
redirects/removes duplicate main-object rows in a copied candidate database.
It never writes the project source database.
"""

from __future__ import annotations

import argparse
import datetime as dt
import json
import re
import shutil
import sqlite3
import sys
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_SOURCE_DB = ROOT / "data/database/sapd_wiki.sqlite3"
DEFAULT_RUNTIME_WORKS = ROOT / "frontend/capability-browser/public/data/maintenance/security-works.json"
DEFAULT_OUT_ROOT = ROOT / "data/exports/worker-verify/oi-135-clean-base-candidate"


def now_stamp() -> str:
    return dt.datetime.now(dt.UTC).strftime("%Y%m%dT%H%M%SZ")


def display_path(path: Path) -> str:
    try:
        return str(path.resolve().relative_to(ROOT))
    except ValueError:
        return str(path)


def normalize_title(value: Any) -> str:
    return re.sub(r"\s+", "", str(value or "")).strip()


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Build an OI-135 clean base SQLite candidate.")
    parser.add_argument("--source-db", default=str(DEFAULT_SOURCE_DB), help="Source base SQLite DB. Read-only.")
    parser.add_argument(
        "--runtime-security-works",
        default=str(DEFAULT_RUNTIME_WORKS),
        help="Runtime security works package used as the object authority.",
    )
    parser.add_argument("--out-dir", default="", help="Output directory. Defaults to a timestamped worker-verify dir.")
    parser.add_argument("--json", action="store_true", help="Print JSON only.")
    return parser.parse_args()


def read_runtime_security_work_titles(path: Path) -> dict[str, dict[str, Any]]:
    payload = json.loads(path.read_text(encoding="utf-8"))
    rows = payload.get("security_works")
    if not isinstance(rows, list):
        raise ValueError(f"runtime security works package has no security_works array: {display_path(path)}")
    titles: dict[str, dict[str, Any]] = {}
    duplicate_titles: dict[str, int] = {}
    for row in rows:
        if not isinstance(row, dict):
            continue
        title = row.get("title")
        key = normalize_title(title)
        if not key:
            continue
        if key in titles:
            duplicate_titles[key] = duplicate_titles.get(key, 1) + 1
            continue
        titles[key] = row
    if duplicate_titles:
        raise ValueError(f"runtime security works package has duplicate titles: {sorted(duplicate_titles)}")
    return titles


def rows_to_dicts(cursor: sqlite3.Cursor, sql: str, params: tuple[Any, ...] = ()) -> list[dict[str, Any]]:
    return [dict(row) for row in cursor.execute(sql, params).fetchall()]


def relation_ref_counts(connection: sqlite3.Connection, item_id: str) -> dict[str, int]:
    incoming = connection.execute(
        "SELECT COUNT(*) FROM knowledge_relations WHERE target_item_id=?",
        (item_id,),
    ).fetchone()[0]
    outgoing = connection.execute(
        "SELECT COUNT(*) FROM knowledge_relations WHERE source_item_id=?",
        (item_id,),
    ).fetchone()[0]
    maps_to_work = connection.execute(
        "SELECT COUNT(*) FROM knowledge_relations WHERE target_item_id=? AND relation_type='maps_to_work'",
        (item_id,),
    ).fetchone()[0]
    return {"incoming": int(incoming), "outgoing": int(outgoing), "maps_to_work": int(maps_to_work)}


def choose_canonical(rows: list[dict[str, Any]], runtime_row: dict[str, Any] | None) -> dict[str, Any]:
    runtime_id = str((runtime_row or {}).get("id") or "")

    def score(row: dict[str, Any]) -> tuple[int, int, int, str]:
        row_id = str(row.get("id") or "")
        refs = row.get("_refs") or {}
        return (
            1 if runtime_id and row_id == runtime_id else 0,
            int(refs.get("maps_to_work") or 0),
            int(refs.get("incoming") or 0) + int(refs.get("outgoing") or 0),
            row_id,
        )

    return sorted(rows, key=score, reverse=True)[0]


def dedupe_relations(connection: sqlite3.Connection) -> int:
    duplicate_rows = rows_to_dicts(
        connection,
        """
        SELECT MIN(id) AS keep_id,
               GROUP_CONCAT(id) AS ids,
               source_item_id,
               target_item_id,
               relation_type,
               COALESCE(relation_label, '') AS relation_label,
               COUNT(*) AS count
        FROM knowledge_relations
        GROUP BY source_item_id, target_item_id, relation_type, COALESCE(relation_label, '')
        HAVING COUNT(*) > 1
        """,
    )
    removed = 0
    for row in duplicate_rows:
        keep_id = row["keep_id"]
        ids = [item for item in str(row["ids"] or "").split(",") if item and item != keep_id]
        if not ids:
            continue
        placeholders = ",".join("?" for _ in ids)
        connection.execute(f"DELETE FROM knowledge_relations WHERE id IN ({placeholders})", ids)
        removed += len(ids)
    return removed


def build_candidate(source_db: Path, runtime_works: Path, out_dir: Path) -> dict[str, Any]:
    if not source_db.exists():
        raise FileNotFoundError(f"source db not found: {display_path(source_db)}")
    if not runtime_works.exists():
        raise FileNotFoundError(f"runtime security works package not found: {display_path(runtime_works)}")

    out_dir.mkdir(parents=True, exist_ok=True)
    candidate_db = out_dir / "sapd_wiki_base.clean-candidate.sqlite3"
    shutil.copy2(source_db, candidate_db)

    runtime_titles = read_runtime_security_work_titles(runtime_works)
    connection = sqlite3.connect(candidate_db)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys = OFF")

    security_work_rows = rows_to_dicts(
        connection,
        "SELECT id, type, code, title, status FROM knowledge_items WHERE type='security_work' ORDER BY title, id",
    )
    for row in security_work_rows:
        row["_title_key"] = normalize_title(row.get("title"))
        row["_refs"] = relation_ref_counts(connection, row["id"])

    groups: dict[str, list[dict[str, Any]]] = {}
    for row in security_work_rows:
        groups.setdefault(row["_title_key"], []).append(row)

    duplicate_groups = {title_key: rows for title_key, rows in groups.items() if len(rows) > 1}
    runtime_missing_in_db = sorted(title for title in runtime_titles if title not in groups)
    db_extra_titles = sorted(title for title in groups if title and title not in runtime_titles)

    merge_actions: list[dict[str, Any]] = []
    deleted_ids: list[str] = []
    relation_rewrites = 0
    for title_key, rows in sorted(duplicate_groups.items()):
        canonical = choose_canonical(rows, runtime_titles.get(title_key))
        duplicates = [row for row in rows if row["id"] != canonical["id"]]
        action = {
            "title": canonical.get("title"),
            "titleKey": title_key,
            "canonicalId": canonical["id"],
            "canonicalRefCounts": canonical["_refs"],
            "duplicates": [],
        }
        for duplicate in duplicates:
            dup_id = duplicate["id"]
            duplicate_refs = relation_ref_counts(connection, dup_id)
            incoming_rewrite = duplicate_refs["incoming"]
            outgoing_rewrite = duplicate_refs["outgoing"]
            if incoming_rewrite:
                connection.execute(
                    "UPDATE knowledge_relations SET target_item_id=? WHERE target_item_id=?",
                    (canonical["id"], dup_id),
                )
            if outgoing_rewrite:
                connection.execute(
                    "UPDATE knowledge_relations SET source_item_id=? WHERE source_item_id=?",
                    (canonical["id"], dup_id),
                )
            relation_rewrites += incoming_rewrite + outgoing_rewrite
            connection.execute("DELETE FROM knowledge_items WHERE id=?", (dup_id,))
            deleted_ids.append(dup_id)
            action["duplicates"].append(
                {
                    "id": dup_id,
                    "refCountsBeforeMerge": duplicate_refs,
                    "rewrittenRelations": incoming_rewrite + outgoing_rewrite,
                }
            )
        merge_actions.append(action)

    removed_duplicate_relations = dedupe_relations(connection)
    connection.commit()

    remaining_security_work_rows = rows_to_dicts(
        connection,
        "SELECT id, title FROM knowledge_items WHERE type='security_work' ORDER BY title, id",
    )
    remaining_title_counts: dict[str, int] = {}
    for row in remaining_security_work_rows:
        remaining_title_counts[normalize_title(row["title"])] = remaining_title_counts.get(normalize_title(row["title"]), 0) + 1
    remaining_duplicate_titles = {
        title: count for title, count in sorted(remaining_title_counts.items()) if count > 1
    }
    maps_to_work_count = connection.execute(
        "SELECT COUNT(*) FROM knowledge_relations WHERE relation_type='maps_to_work'",
    ).fetchone()[0]
    security_work_count = connection.execute(
        "SELECT COUNT(*) FROM knowledge_items WHERE type='security_work'",
    ).fetchone()[0]
    knowledge_item_count = connection.execute("SELECT COUNT(*) FROM knowledge_items").fetchone()[0]
    knowledge_relation_count = connection.execute("SELECT COUNT(*) FROM knowledge_relations").fetchone()[0]
    connection.close()

    result = {
        "result": "pass" if not runtime_missing_in_db and not remaining_duplicate_titles else "review",
        "generatedAt": dt.datetime.now(dt.UTC).isoformat(),
        "contract": "oi135_clean_base_security_work_main_object_grain",
        "sourceDb": display_path(source_db),
        "runtimeSecurityWorks": display_path(runtime_works),
        "candidateDb": display_path(candidate_db),
        "authorityRule": "security_work main objects follow runtime security-works package; focus-to-work fan-out remains in maps_to_work relations",
        "counts": {
            "runtimeSecurityWorks": len(runtime_titles),
            "sourceSecurityWorkRows": len(security_work_rows),
            "sourceSecurityWorkUniqueTitles": len(groups),
            "sourceDuplicateTitleGroups": len(duplicate_groups),
            "deletedDuplicateSecurityWorkRows": len(deleted_ids),
            "relationRewrites": relation_rewrites,
            "removedDuplicateRelations": removed_duplicate_relations,
            "candidateKnowledgeItems": knowledge_item_count,
            "candidateKnowledgeRelations": knowledge_relation_count,
            "candidateSecurityWorks": security_work_count,
            "candidateMapsToWorkRelations": int(maps_to_work_count),
            "candidateDuplicateSecurityWorkTitles": len(remaining_duplicate_titles),
        },
        "runtimeMissingInDb": runtime_missing_in_db,
        "dbExtraTitlesNotInRuntime": db_extra_titles,
        "remainingDuplicateSecurityWorkTitles": remaining_duplicate_titles,
        "mergeActions": merge_actions,
    }

    report_json = out_dir / "oi135-clean-base-candidate-report.json"
    report_md = out_dir / "oi135-clean-base-candidate-report.md"
    report_json.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    report_md.write_text(render_markdown(result), encoding="utf-8")
    result["reportJson"] = display_path(report_json)
    result["reportMd"] = display_path(report_md)
    return result


def render_markdown(result: dict[str, Any]) -> str:
    lines = [
        "# OI-135 Clean Base Candidate Report",
        "",
        f"- Result: `{result['result']}`",
        f"- Candidate DB: `{result['candidateDb']}`",
        f"- Source DB: `{result['sourceDb']}`",
        f"- Runtime authority: `{result['runtimeSecurityWorks']}`",
        "",
        "## Contract",
        "",
        result["authorityRule"],
        "",
        "## Counts",
        "",
    ]
    for key, value in result["counts"].items():
        lines.append(f"- `{key}`: `{value}`")
    lines.extend(["", "## Merge Actions", ""])
    for action in result["mergeActions"]:
        lines.append(f"- `{action['title']}` keep `{action['canonicalId']}`, delete `{len(action['duplicates'])}` duplicate row(s).")
    if not result["mergeActions"]:
        lines.append("- No duplicate security_work main objects found.")
    if result["runtimeMissingInDb"] or result["dbExtraTitlesNotInRuntime"] or result["remainingDuplicateSecurityWorkTitles"]:
        lines.extend(["", "## Review Items", ""])
        if result["runtimeMissingInDb"]:
            lines.append(f"- Runtime titles missing in DB: `{len(result['runtimeMissingInDb'])}`")
        if result["dbExtraTitlesNotInRuntime"]:
            lines.append(f"- DB titles not in runtime package: `{len(result['dbExtraTitlesNotInRuntime'])}`")
        if result["remainingDuplicateSecurityWorkTitles"]:
            lines.append(f"- Remaining duplicate titles: `{len(result['remainingDuplicateSecurityWorkTitles'])}`")
    return "\n".join(lines) + "\n"


def main() -> int:
    args = parse_args()
    source_db = Path(args.source_db).expanduser()
    runtime_works = Path(args.runtime_security_works).expanduser()
    out_dir = Path(args.out_dir).expanduser() if args.out_dir else DEFAULT_OUT_ROOT / now_stamp()
    if not source_db.is_absolute():
        source_db = ROOT / source_db
    if not runtime_works.is_absolute():
        runtime_works = ROOT / runtime_works
    if not out_dir.is_absolute():
        out_dir = ROOT / out_dir
    result = build_candidate(source_db, runtime_works, out_dir)
    if args.json:
        print(json.dumps(result, ensure_ascii=False, indent=2))
    else:
        print(f"result={result['result']}")
        print(f"candidateDb={result['candidateDb']}")
        print(f"reportJson={result['reportJson']}")
        for key, value in result["counts"].items():
            print(f"{key}={value}")
    return 0 if result["result"] == "pass" else 1


if __name__ == "__main__":
    sys.exit(main())
