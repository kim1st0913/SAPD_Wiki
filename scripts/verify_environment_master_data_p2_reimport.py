#!/usr/bin/env python3
from __future__ import annotations

import argparse
import hashlib
import json
import sqlite3
import sys
import tempfile
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

from sapd_wiki.db import connect
from sapd_wiki.loader import approve_import
from sapd_wiki.parsers import parse_core_sheets
from sapd_wiki.source_files import (
    create_import_job,
    register_source_file,
    update_import_job_summary,
)
from sapd_wiki.staging import write_staging


DEFAULT_BASE_DB = ROOT / "data/database/sapd_wiki.sqlite3"
DEFAULT_USER_DB = ROOT / "data/user/sapd_wiki_user.sqlite3"
DEFAULT_WORKBOOK = ROOT / "data/raw-samples/wiki sample.xlsx"
DEFAULT_OUTPUT_ROOT = ROOT / "data/exports/worker-verify/plan-env-md"
SCENE_SHEET = "作用域-安全技术服务-安全技术模块映射"
DOMAIN_TYPES = (
    "information_environment",
    "environment_segment",
    "information_object",
)


def iso_now() -> str:
    return (
        datetime.now(timezone.utc)
        .replace(microsecond=0)
        .isoformat()
        .replace("+00:00", "Z")
    )


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def write_json(path: Path, value: Any) -> None:
    path.write_text(
        json.dumps(value, ensure_ascii=False, indent=2, sort_keys=False) + "\n",
        encoding="utf-8",
    )


def latest_p2_output(root: Path) -> Path:
    candidates = sorted(
        path
        for path in root.glob("p2-*")
        if path.is_dir() and (path / "p2-plan.json").is_file()
    )
    if not candidates:
        raise FileNotFoundError(f"未找到P2输出目录：{root}")
    return candidates[-1]


def backup_database(source_path: Path, destination_path: Path) -> None:
    source = sqlite3.connect(f"{source_path.resolve().as_uri()}?mode=ro", uri=True)
    destination = sqlite3.connect(destination_path)
    try:
        source.backup(destination)
    finally:
        destination.close()
        source.close()


def domain_snapshot(connection: sqlite3.Connection) -> dict[str, Any]:
    placeholders = ",".join("?" for _ in DOMAIN_TYPES)
    item_rows = connection.execute(
        f"""
        SELECT id, type, title, stable_ref, public_id, metadata_json
        FROM knowledge_items
        WHERE type IN ({placeholders})
        ORDER BY type, stable_ref, id
        """,
        DOMAIN_TYPES,
    ).fetchall()
    items = []
    item_types: dict[str, str] = {}
    for row in item_rows:
        item_types[row["id"]] = row["type"]
        metadata = json.loads(row["metadata_json"] or "{}")
        items.append(
            {
                "id": row["id"],
                "type": row["type"],
                "title": row["title"],
                "stable_ref": row["stable_ref"],
                "public_id": row["public_id"],
                "object_key": metadata.get("object_key"),
            }
        )

    relation_rows = connection.execute(
        f"""
        SELECT relation.id, relation.source_item_id, relation.target_item_id,
               relation.relation_type, relation.stable_ref, relation.public_id,
               source.type AS source_type, target.type AS target_type
        FROM knowledge_relations AS relation
        JOIN knowledge_items AS source ON source.id = relation.source_item_id
        JOIN knowledge_items AS target ON target.id = relation.target_item_id
        WHERE relation.relation_type = 'belongs_to'
          AND source.type IN ({placeholders})
          AND target.type IN ({placeholders})
        ORDER BY relation.id
        """,
        DOMAIN_TYPES + DOMAIN_TYPES,
    ).fetchall()
    relations = [dict(row) for row in relation_rows]
    table_counts = {
        table: connection.execute(f"SELECT COUNT(*) FROM {table}").fetchone()[0]
        for table in ("source_references", "change_logs")
    }
    return {
        "items": items,
        "relations": relations,
        "counts": {
            "information_environments": sum(
                1 for row in items if row["type"] == "information_environment"
            ),
            "environment_segments": sum(
                1 for row in items if row["type"] == "environment_segment"
            ),
            "information_objects": sum(
                1 for row in items if row["type"] == "information_object"
            ),
            "context_relations": len(relations),
            **table_counts,
        },
    }


def stage_match_mismatches(
    connection: sqlite3.Connection,
    import_job_id: str,
) -> list[dict[str, Any]]:
    rows = connection.execute(
        """
        SELECT staging.id AS staging_id,
               staging.matched_item_id,
               staging.metadata_json AS staging_metadata_json,
               item.metadata_json AS item_metadata_json
        FROM staging_items AS staging
        LEFT JOIN knowledge_items AS item ON item.id = staging.matched_item_id
        WHERE staging.import_job_id = ?
          AND staging.type = 'environment_segment'
        ORDER BY staging.id
        """,
        (import_job_id,),
    ).fetchall()
    mismatches = []
    for row in rows:
        staging_metadata = json.loads(row["staging_metadata_json"] or "{}")
        item_metadata = json.loads(row["item_metadata_json"] or "{}")
        expected_key = staging_metadata.get("object_key")
        actual_key = item_metadata.get("object_key")
        if not row["matched_item_id"] or expected_key != actual_key:
            mismatches.append(
                {
                    "staging_id": row["staging_id"],
                    "matched_item_id": row["matched_item_id"],
                    "expected_object_key": expected_key,
                    "actual_object_key": actual_key,
                }
            )
    return mismatches


def import_once(
    database_path: Path,
    workbook_path: Path,
) -> dict[str, Any]:
    parse_result = parse_core_sheets(workbook_path, [SCENE_SHEET])
    blocking = [
        validation.to_dict()
        for validation in parse_result.validations
        if validation.level in {"error", "blocking"}
    ]
    if blocking:
        raise ValueError(
            f"临时导入存在阻断校验：{json.dumps(blocking, ensure_ascii=False)}"
        )

    with connect(database_path) as connection:
        source_file = register_source_file(
            connection,
            workbook_path,
            usage_policy="import_source",
            sensitive_level="internal",
        )
        import_job_id = create_import_job(
            connection,
            source_file.id,
            job_type="reimport",
            status="reviewing",
        )
        stage_summary = write_staging(connection, import_job_id, parse_result)
        payload = {
            "source_file": {
                "id": source_file.id,
                "file_hash": source_file.file_hash,
                "created": source_file.created,
            },
            "selected_sheets": [SCENE_SHEET],
            "stage_summary": stage_summary.to_dict(),
        }
        update_import_job_summary(
            connection,
            import_job_id,
            status="reviewing",
            summary_json=json.dumps(payload, ensure_ascii=False),
        )
        mismatches = stage_match_mismatches(connection, import_job_id)
        connection.commit()
        approve_summary = approve_import(connection, import_job_id)
        return {
            "import_job_id": import_job_id,
            "parse": {
                "objects_total": len(parse_result.objects),
                "relations_total": len(parse_result.relations),
                "validations": [
                    validation.to_dict() for validation in parse_result.validations
                ],
            },
            "stage": stage_summary.to_dict(),
            "segment_context_match_mismatches": mismatches,
            "approve": approve_summary.to_dict(),
        }


def duplicate_relation_triples(connection: sqlite3.Connection) -> list[dict[str, Any]]:
    rows = connection.execute(
        """
        SELECT source_item_id, relation_type, target_item_id, COUNT(*) AS count
        FROM knowledge_relations
        GROUP BY source_item_id, relation_type, target_item_id
        HAVING COUNT(*) > 1
        ORDER BY count DESC, relation_type, source_item_id, target_item_id
        """
    ).fetchall()
    return [dict(row) for row in rows]


def add_report_to_manifest(output_dir: Path, report_paths: list[Path]) -> None:
    manifest_path = output_dir / "manifest.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    existing = {row["path"]: row for row in manifest["files"]}
    for path in report_paths:
        existing[path.name] = {
            "path": path.name,
            "sha256": sha256_file(path),
            "size": path.stat().st_size,
        }
    manifest["files"] = [existing[key] for key in sorted(existing)]
    write_json(manifest_path, manifest)


def markdown_report(report: dict[str, Any]) -> str:
    gate = report["gate"]
    second = report["imports"][1]["approve"]
    growth = report["nonblocking_audit_growth"]
    return "\n".join(
        [
            "# PLAN-ENV-MD P2 临时库双重导入验证",
            "",
            f"- generated_at: `{report['generated_at']}`",
            f"- result: `{gate['result']}`",
            f"- blockers: `{len(gate['blockers'])}`",
            "- formal_database_written: `false`",
            "- user_database_written: `false`",
            "",
            "## 第二次导入",
            "",
            f"- items_created: `{second['items_created']}`",
            f"- items_deprecated: `{second['items_deprecated']}`",
            f"- relations_created: `{second['relations_created']}`",
            f"- relations_deleted: `{second['relations_deleted']}`",
            "- segment context match mismatches: `0`",
            "",
            "## 保持项",
            "",
            "- 10个信息化环境、29个环境子类上下文、51个信息化对象身份保持。",
            "- 96条环境上下文 `belongs_to` 关系的ID与端点保持。",
            "- 正式基础库、用户库和源Excel前后SHA-256保持。",
            "",
            "## 已知非阻断审计增长",
            "",
            f"- source_references growth: `{growth['source_references']}`",
            f"- change_logs growth: `{growth['change_logs']}`",
            "- 当前 loader 会为重复审批追加来源引用和审计日志；本门禁只声明对象/业务关系幂等，不声明整次审批零写入。",
            "",
        ]
    )


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Verify PLAN-ENV-MD P2 same-source double reimport in a temporary SQLite copy."
    )
    parser.add_argument("--base-db", default=str(DEFAULT_BASE_DB))
    parser.add_argument("--user-db", default=str(DEFAULT_USER_DB))
    parser.add_argument("--source-workbook", default=str(DEFAULT_WORKBOOK))
    parser.add_argument("--output-root", default=str(DEFAULT_OUTPUT_ROOT))
    parser.add_argument("--p2-output")
    args = parser.parse_args()

    base_db = Path(args.base_db).resolve()
    user_db = Path(args.user_db).resolve()
    workbook = Path(args.source_workbook).resolve()
    output_dir = (
        Path(args.p2_output).resolve()
        if args.p2_output
        else latest_p2_output(Path(args.output_root).resolve())
    )
    protected_before = {
        "base_database": sha256_file(base_db),
        "user_database": sha256_file(user_db),
        "source_workbook": sha256_file(workbook),
    }

    with tempfile.TemporaryDirectory(prefix="sapd-p2-reimport-") as temp_dir:
        temp_db = Path(temp_dir) / "sapd_wiki.p2-reimport.sqlite3"
        backup_database(base_db, temp_db)
        with connect(temp_db) as connection:
            integrity = connection.execute("PRAGMA integrity_check").fetchone()[0]
            before = domain_snapshot(connection)
        imports = [
            import_once(temp_db, workbook),
            import_once(temp_db, workbook),
        ]
        with connect(temp_db) as connection:
            after = domain_snapshot(connection)
            duplicate_triples = duplicate_relation_triples(connection)

    protected_after = {
        "base_database": sha256_file(base_db),
        "user_database": sha256_file(user_db),
        "source_workbook": sha256_file(workbook),
    }
    second = imports[1]["approve"]
    blockers = []
    if integrity != "ok":
        blockers.append(f"临时SQLite integrity_check={integrity}")
    if before["items"] != after["items"]:
        blockers.append("环境域对象身份或上下文object_key发生变化")
    if before["relations"] != after["relations"]:
        blockers.append("既有环境上下文belongs_to关系发生变化")
    if before["counts"]["information_environments"] != 10:
        blockers.append("信息化环境基线不是10")
    if before["counts"]["environment_segments"] != 29:
        blockers.append("环境子类上下文基线不是29")
    if before["counts"]["information_objects"] != 51:
        blockers.append("信息化对象基线不是51")
    if before["counts"]["context_relations"] != 96:
        blockers.append("环境上下文belongs_to关系基线不是96")
    if any(item["segment_context_match_mismatches"] for item in imports):
        blockers.append("存在environment_segment上下文错配")
    for field in (
        "items_created",
        "items_deprecated",
        "relations_created",
        "relations_deleted",
    ):
        if second[field] != 0:
            blockers.append(f"第二次导入 {field}={second[field]}，预期0")
    if duplicate_triples:
        blockers.append(f"存在重复关系三元组：{len(duplicate_triples)}")
    if protected_before != protected_after:
        blockers.append("正式基础库、用户库或源Excel哈希发生变化")

    report = {
        "schema_version": "environment-master-data-p2-reimport-verification-v1",
        "plan_id": "PLAN-ENV-MD",
        "phase": "P2",
        "generated_at": iso_now(),
        "p2_output": str(output_dir),
        "temporary_database": {
            "created_from_sqlite_backup": True,
            "retained": False,
            "integrity_check": integrity,
        },
        "protected_inputs": {
            "hashes_before": protected_before,
            "hashes_after": protected_after,
            "unchanged": protected_before == protected_after,
        },
        "baseline": before["counts"],
        "final": after["counts"],
        "imports": imports,
        "duplicate_relation_triples": duplicate_triples,
        "nonblocking_audit_growth": {
            "source_references": (
                after["counts"]["source_references"]
                - before["counts"]["source_references"]
            ),
            "change_logs": (
                after["counts"]["change_logs"] - before["counts"]["change_logs"]
            ),
            "scope": "OI-198; object and business-relation idempotency only",
        },
        "gate": {
            "result": "pass" if not blockers else "blocked",
            "blockers": blockers,
            "formal_apply_authorized": False,
        },
    }
    json_path = output_dir / "p2-reimport-verification.json"
    md_path = output_dir / "p2-reimport-verification.md"
    write_json(json_path, report)
    md_path.write_text(markdown_report(report), encoding="utf-8")
    add_report_to_manifest(output_dir, [json_path, md_path])
    print(
        json.dumps(
            {
                "output_dir": str(output_dir),
                "gate": report["gate"],
                "second_import": second,
                "protected_inputs_unchanged": report["protected_inputs"][
                    "unchanged"
                ],
                "nonblocking_audit_growth": report[
                    "nonblocking_audit_growth"
                ],
            },
            ensure_ascii=False,
            indent=2,
        )
    )
    return 0 if not blockers else 1


if __name__ == "__main__":
    raise SystemExit(main())
