#!/usr/bin/env python3
from __future__ import annotations

import argparse
import fcntl
import hashlib
import json
import shutil
import socket
import sqlite3
import tempfile
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from export_environment_dictionary_p4_shadow import (
    add_explicit_route_ids,
    atomic_write_json,
)
from rehearse_environment_master_data_p3_migration import (
    candidate_dictionary,
    connect_database,
    load_plan,
    sha256_file,
    sqlite_backup,
)


ROOT = Path(__file__).resolve().parents[1]
BASE_DB = ROOT / "data/database/sapd_wiki.sqlite3"
USER_DB = ROOT / "data/user/sapd_wiki_user.sqlite3"
SOURCE_WORKBOOK = ROOT / "data/raw-samples/wiki sample.xlsx"
PUBLIC_DICTIONARY = (
    ROOT / "frontend/capability-browser/public/data/environment-dictionary.json"
)
ADJUDICATION = (
    ROOT
    / "docs/01-architecture/contracts/environment-master-data/v1/"
    "environment-and-object-definition-adjudication.p7-1.json"
)
P2_OUTPUT = ROOT / "data/exports/worker-verify/plan-env-md/p2-20260725T161109Z"
OUTPUT_ROOT = ROOT / "data/exports/worker-verify/plan-env-md"
CONFIRMATION = "PLAN-ENV-MD-P7-1-DEFINITION-APPLY"
CHANGE_NAMESPACE = uuid.UUID("10db9d8c-2695-4fb4-b2fd-f17ef64d6fcb")


def now_utc() -> datetime:
    return datetime.now(timezone.utc).replace(microsecond=0)


def iso_utc(value: datetime) -> str:
    return value.isoformat().replace("+00:00", "Z")


def write_json(path: Path, value: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(value, ensure_ascii=False, indent=2, sort_keys=False) + "\n",
        encoding="utf-8",
    )


def read_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def port_is_open(port: int) -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as handle:
        handle.settimeout(0.2)
        return handle.connect_ex(("127.0.0.1", port)) == 0


def file_state(path: Path) -> dict[str, Any]:
    return {
        "path": str(path.relative_to(ROOT)),
        "sha256": sha256_file(path),
        "bytes": path.stat().st_size,
    }


def query_digest(connection: sqlite3.Connection, sql: str) -> dict[str, Any]:
    rows = [dict(row) for row in connection.execute(sql)]
    payload = json.dumps(
        rows,
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
    ).encode("utf-8")
    return {
        "count": len(rows),
        "sha256": hashlib.sha256(payload).hexdigest(),
    }


def protected_database_state(connection: sqlite3.Connection) -> dict[str, Any]:
    return {
        "integrity_check": connection.execute(
            "PRAGMA integrity_check"
        ).fetchone()[0],
        "foreign_key_issues": len(
            connection.execute("PRAGMA foreign_key_check").fetchall()
        ),
        "master_identity": query_digest(
            connection,
            """
            SELECT id, stable_ref, public_id, type, code, title, status
            FROM knowledge_items
            WHERE type IN (
              'information_environment',
              'environment_segment_type',
              'information_object'
            )
            ORDER BY type, code
            """,
        ),
        "environment_relationships": query_digest(
            connection,
            """
            SELECT id, stable_ref, source_item_id, target_item_id,
                   relation_type, relation_label, confidence,
                   source_file_id, import_job_id, metadata_json,
                   created_at, updated_at, stable_key, public_id
            FROM knowledge_relations
            ORDER BY id
            """,
        ),
        "source_references": query_digest(
            connection,
            """
            SELECT id, target_type, target_id, source_file_id, source_sheet,
                   source_row, source_column, source_cell, raw_value,
                   source_hash, created_at
            FROM source_references
            ORDER BY id
            """,
        ),
    }


def load_and_validate_adjudication(
    connection: sqlite3.Connection,
) -> dict[str, Any]:
    adjudication = read_json(ADJUDICATION)
    if (
        adjudication.get("schema_version")
        != "environment-and-object-definition-adjudication-p7-1-v1"
        or adjudication.get("status") != "frozen"
        or adjudication.get("definition_method", {}).get("runtime_inference")
        is not False
    ):
        raise ValueError("P7.1定义裁定文件状态或策略错误")
    entries = adjudication.get("entries") or []
    if len(entries) != 61:
        raise ValueError(f"P7.1定义裁定必须为61条，实际{len(entries)}")
    if len({entry["code"] for entry in entries}) != 61:
        raise ValueError("P7.1定义裁定业务编号不唯一")
    if len({entry["stable_ref"] for entry in entries}) != 61:
        raise ValueError("P7.1定义裁定stable_ref不唯一")
    expected_types = {
        "information_environment": 10,
        "information_object": 51,
    }
    actual_types = {
        kind: sum(entry.get("type") == kind for entry in entries)
        for kind in expected_types
    }
    if actual_types != expected_types:
        raise ValueError(f"P7.1定义裁定类型统计错误：{actual_types}")
    for entry in entries:
        if not str(entry.get("definition") or "").strip():
            raise ValueError(f"P7.1定义为空：{entry.get('code')}")
        row = connection.execute(
            """
            SELECT id, type, code, stable_ref, title, description
            FROM knowledge_items
            WHERE code=?
            """,
            (entry["code"],),
        ).fetchone()
        if not row:
            raise ValueError(f"P7.1定义目标不存在：{entry['code']}")
        expected = (
            entry["type"],
            entry["code"],
            entry["stable_ref"],
            entry["canonical_title"],
        )
        actual = (
            row["type"],
            row["code"],
            row["stable_ref"],
            row["title"],
        )
        if actual != expected:
            raise ValueError(
                f"P7.1定义目标身份冲突：{entry['code']} "
                f"expected={expected} actual={actual}"
            )
        existing = str(row["description"] or "").strip()
        target = str(entry["definition"]).strip()
        if existing and existing != target:
            raise ValueError(f"P7.1定义目标已有不同定义：{entry['code']}")
    return adjudication


def definition_change_id(item_id: str) -> str:
    return str(uuid.uuid5(CHANGE_NAMESPACE, f"PLAN-ENV-MD:P7.1:{item_id}"))


def apply_definitions(
    connection: sqlite3.Connection,
    adjudication: dict[str, Any],
    changed_at: str,
) -> dict[str, int]:
    result = {"definitions_updated": 0, "change_logs_created": 0}
    connection.execute("BEGIN IMMEDIATE")
    try:
        for entry in adjudication["entries"]:
            row = connection.execute(
                """
                SELECT id, type, code, stable_ref, title, description
                FROM knowledge_items
                WHERE code=?
                """,
                (entry["code"],),
            ).fetchone()
            target = entry["definition"].strip()
            before = row["description"]
            if str(before or "").strip() != target:
                connection.execute(
                    """
                    UPDATE knowledge_items
                    SET description=?, updated_at=?
                    WHERE id=?
                    """,
                    (target, changed_at, row["id"]),
                )
                result["definitions_updated"] += 1
            log_id = definition_change_id(row["id"])
            log = connection.execute(
                """
                SELECT id, target_type, target_id, change_type,
                       before_json, after_json
                FROM change_logs
                WHERE id=?
                """,
                (log_id,),
            ).fetchone()
            before_json = json.dumps(
                {"description": before},
                ensure_ascii=False,
                sort_keys=True,
            )
            after_json = json.dumps(
                {
                    "description": target,
                    "adjudication": str(ADJUDICATION.relative_to(ROOT)),
                },
                ensure_ascii=False,
                sort_keys=True,
            )
            if not log:
                connection.execute(
                    """
                    INSERT INTO change_logs (
                      id, target_type, target_id, change_type,
                      before_json, after_json, import_job_id, changed_at
                    ) VALUES (?, 'item', ?, 'update', ?, ?, NULL, ?)
                    """,
                    (
                        log_id,
                        row["id"],
                        before_json,
                        after_json,
                        changed_at,
                    ),
                )
                result["change_logs_created"] += 1
            elif (
                log["target_type"] != "item"
                or log["target_id"] != row["id"]
                or log["change_type"] != "update"
                or json.loads(log["after_json"])["description"] != target
            ):
                raise ValueError(f"P7.1审计日志冲突：{entry['code']}")
        connection.commit()
    except Exception:
        connection.rollback()
        raise
    return result


def project_environment_segment_contexts(
    connection: sqlite3.Connection,
    package: dict[str, Any],
) -> None:
    retained = [
        relation
        for relation in package["usage_relations"]
        if relation.get("master_type") != "information_environment"
    ]
    environment_contexts = []
    for row in connection.execute(
        """
        SELECT relation.stable_ref AS relation_ref,
               environment.stable_ref AS master_ref,
               segment.stable_ref AS context_ref,
               segment.title AS context_title,
               environment.stable_ref AS environment_ref
        FROM knowledge_relations AS relation
        JOIN knowledge_items AS segment
          ON segment.id=relation.source_item_id
         AND segment.type='environment_segment'
        JOIN knowledge_items AS environment
          ON environment.id=relation.target_item_id
         AND environment.type='information_environment'
        WHERE relation.relation_type='belongs_to'
        ORDER BY environment.code, segment.title, segment.stable_ref
        """
    ):
        environment_contexts.append(
            {
                "relation_ref": row["relation_ref"],
                "relation_type": "contains_segment_context",
                "master_ref": row["master_ref"],
                "master_type": "information_environment",
                "context_type": "environment_segment",
                "context_ref": row["context_ref"],
                "context_title": row["context_title"],
                "environment_ref": row["environment_ref"],
                "segment_ref": row["context_ref"],
                "object_ref": None,
                "route": "/environment-mapping",
                "route_params": {
                    "environment_ref": row["environment_ref"],
                    "segment_ref": row["context_ref"],
                },
            }
        )
    package["usage_relations"] = environment_contexts + retained


def build_current_dictionary(
    connection: sqlite3.Connection,
    generated_at: str,
) -> dict[str, Any]:
    plan_data = load_plan(P2_OUTPUT)
    package = candidate_dictionary(connection, plan_data, generated_at)
    project_environment_segment_contexts(connection, package)
    package["source_package_versions"] = {
        "plan": "PLAN-ENV-MD",
        "phase": "P7.1-definition-and-usage-projection",
        "p2_run_id": plan_data["plan"]["run_id"],
        "adjudication": str(ADJUDICATION.relative_to(ROOT)),
    }
    add_explicit_route_ids(connection, package)
    validate_current_dictionary(package)
    return package


def validate_current_dictionary(package: dict[str, Any]) -> dict[str, Any]:
    blockers: list[str] = []
    expected_master_counts = {
        "information_environments": 10,
        "environment_segment_types": 16,
        "information_objects": 51,
    }
    expected_context_counts = {
        "environment_segments": 29,
        "environment_object_contexts": 67,
    }
    if package.get("schema_version") != "environment-dictionary-v1":
        blockers.append("schema_version错误")
    if package.get("master_counts") != expected_master_counts:
        blockers.append(f"主数据统计错误：{package.get('master_counts')}")
    if package.get("context_counts") != expected_context_counts:
        blockers.append(f"上下文统计错误：{package.get('context_counts')}")
    records = (
        package.get("information_environments", [])
        + package.get("environment_segment_types", [])
        + package.get("information_objects", [])
    )
    if len(records) != 77:
        blockers.append(f"主数据记录不是77条：{len(records)}")
    missing_definitions = [
        row.get("code")
        for row in records
        if not str(row.get("description") or "").strip()
    ]
    if missing_definitions:
        blockers.append(f"主数据定义缺失：{missing_definitions}")
    relations = package.get("usage_relations", [])
    if len(relations) != 125:
        blockers.append(f"关联使用投影不是125条：{len(relations)}")
    if len({row.get("relation_ref") for row in relations}) != len(relations):
        blockers.append("关联使用relation_ref不唯一")
    type_counts = {
        kind: sum(row.get("master_type") == kind for row in relations)
        for kind in (
            "information_environment",
            "environment_segment_type",
            "information_object",
        )
    }
    if type_counts != {
        "information_environment": 29,
        "environment_segment_type": 29,
        "information_object": 67,
    }:
        blockers.append(f"关联使用分类统计错误：{type_counts}")
    by_master: dict[str, int] = {}
    for relation in relations:
        by_master[relation.get("master_ref")] = (
            by_master.get(relation.get("master_ref"), 0) + 1
        )
        params = relation.get("route_params") or {}
        if relation.get("environment_ref") and not params.get("environment_id"):
            blockers.append(f"缺少environment_id：{relation.get('relation_ref')}")
        if relation.get("segment_ref") and not params.get("segment_id"):
            blockers.append(f"缺少segment_id：{relation.get('relation_ref')}")
        if relation.get("object_ref") and not params.get("object_id"):
            blockers.append(f"缺少object_id：{relation.get('relation_ref')}")
    expected_environment_counts = [3, 5, 3, 1, 4, 4, 2, 1, 3, 3]
    actual_environment_counts = [
        by_master.get(row["stable_ref"], 0)
        for row in package.get("information_environments", [])
    ]
    if actual_environment_counts != expected_environment_counts:
        blockers.append(
            "信息化环境关联使用统计错误："
            f"{actual_environment_counts}"
        )
    for row in package.get("information_environments", []):
        declared = int(row.get("usage_summary", {}).get("environment_segments") or 0)
        projected = by_master.get(row["stable_ref"], 0)
        if declared != projected:
            blockers.append(
                f"{row.get('code')}子类统计与展开投影不一致："
                f"declared={declared} projected={projected}"
            )
    if blockers:
        raise ValueError("；".join(blockers))
    return {
        "result": "pass",
        "master_records": len(records),
        "definitions": len(records),
        "usage_relations": len(relations),
        "usage_by_master_type": type_counts,
        "environment_context_counts": actual_environment_counts,
    }


def rehearse_on_temporary_copy(
    base_path: Path,
    adjudication: dict[str, Any],
    generated_at: str,
) -> dict[str, Any]:
    with tempfile.TemporaryDirectory(prefix="sapd-env-p7-1-") as temporary:
        temp_root = Path(temporary)
        before_copy = temp_root / "before.sqlite3"
        candidate_copy = temp_root / "candidate.sqlite3"
        restored_copy = temp_root / "restored.sqlite3"
        sqlite_backup(base_path, before_copy)
        sqlite_backup(before_copy, candidate_copy)
        connection = connect_database(candidate_copy)
        try:
            state_before = protected_database_state(connection)
            first = apply_definitions(connection, adjudication, generated_at)
            repeat = apply_definitions(connection, adjudication, generated_at)
            package = build_current_dictionary(connection, generated_at)
            state_after = protected_database_state(connection)
            definition_count = connection.execute(
                """
                SELECT COUNT(*)
                FROM knowledge_items
                WHERE type IN (
                  'information_environment',
                  'environment_segment_type',
                  'information_object'
                )
                  AND trim(coalesce(description, '')) <> ''
                """
            ).fetchone()[0]
        finally:
            connection.close()
        sqlite_backup(before_copy, restored_copy)
        restored = connect_database(restored_copy, read_only=True)
        try:
            restored_state = protected_database_state(restored)
        finally:
            restored.close()
        if state_before != restored_state:
            raise ValueError("P7.1临时恢复副本与变更前逻辑状态不一致")
        if state_before["master_identity"] != state_after["master_identity"]:
            raise ValueError("P7.1临时演练改变了主数据身份")
        for key in ("environment_relationships", "source_references"):
            if state_before[key] != state_after[key]:
                raise ValueError(f"P7.1临时演练改变了受保护数据：{key}")
        if repeat != {"definitions_updated": 0, "change_logs_created": 0}:
            raise ValueError(f"P7.1重复执行非幂等：{repeat}")
        return {
            "result": "pass",
            "first_apply": first,
            "repeat_apply": repeat,
            "all_master_definitions": definition_count,
            "dictionary": validate_current_dictionary(package),
            "independent_restore_test": "pass",
        }


def main() -> int:
    parser = argparse.ArgumentParser(
        description="PLAN-ENV-MD P7.1 定义补充和关联使用投影修复。"
    )
    parser.add_argument("--base-db", type=Path, default=BASE_DB)
    parser.add_argument("--user-db", type=Path, default=USER_DB)
    parser.add_argument("--public-dictionary", type=Path, default=PUBLIC_DICTIONARY)
    parser.add_argument("--apply", action="store_true")
    parser.add_argument("--confirm-formal-apply", default="")
    args = parser.parse_args()

    base_path = args.base_db.resolve()
    user_path = args.user_db.resolve()
    public_path = args.public_dictionary.resolve()
    for path in (
        base_path,
        user_path,
        SOURCE_WORKBOOK,
        public_path,
        ADJUDICATION,
    ):
        if not path.is_file():
            raise FileNotFoundError(path)

    generated = now_utc()
    generated_at = iso_utc(generated)
    connection = connect_database(base_path, read_only=True)
    try:
        adjudication = load_and_validate_adjudication(connection)
    finally:
        connection.close()
    rehearsal = rehearse_on_temporary_copy(
        base_path,
        adjudication,
        generated_at,
    )

    if not args.apply:
        print(
            json.dumps(
                {
                    "mode": "dry_run",
                    "formal_apply_executed": False,
                    "adjudication_entries": len(adjudication["entries"]),
                    "rehearsal": rehearsal,
                    "confirmation_required": CONFIRMATION,
                },
                ensure_ascii=False,
                indent=2,
            )
        )
        return 0

    if args.confirm_formal_apply != CONFIRMATION:
        raise ValueError(
            "P7.1正式写入必须同时传入："
            f"--confirm-formal-apply {CONFIRMATION}"
        )
    if port_is_open(5173):
        raise ValueError("P7.1正式写入前必须停止5173，避免运行态读取半成品")

    run_id = f"p7-1-{generated.strftime('%Y%m%dT%H%M%SZ')}"
    output_dir = OUTPUT_ROOT / run_id
    output_dir.mkdir(parents=True, exist_ok=False)
    recovery = output_dir / "recovery"
    base_backup = recovery / "database/sapd_wiki.before-p7-1.sqlite3"
    user_backup = recovery / "database/sapd_wiki_user.before-p7-1.sqlite3"
    dictionary_backup = recovery / "packages/environment-dictionary.before-p7-1.json"
    adjudication_backup = recovery / "contracts" / ADJUDICATION.name
    base_backup.parent.mkdir(parents=True, exist_ok=True)
    dictionary_backup.parent.mkdir(parents=True, exist_ok=True)
    adjudication_backup.parent.mkdir(parents=True, exist_ok=True)

    lock_path = OUTPUT_ROOT / ".p7-1-definition-apply.lock"
    lock_path.parent.mkdir(parents=True, exist_ok=True)
    with lock_path.open("a+", encoding="utf-8") as lock:
        fcntl.flock(lock.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
        before_files = {
            "base_database": file_state(base_path),
            "user_database": file_state(user_path),
            "source_workbook": file_state(SOURCE_WORKBOOK),
            "environment_dictionary": file_state(public_path),
        }
        before_connection = connect_database(base_path, read_only=True)
        try:
            before_database = protected_database_state(before_connection)
        finally:
            before_connection.close()
        sqlite_backup(base_path, base_backup)
        sqlite_backup(user_path, user_backup)
        shutil.copy2(public_path, dictionary_backup)
        shutil.copy2(ADJUDICATION, adjudication_backup)

        backup_connection = connect_database(base_backup, read_only=True)
        try:
            if protected_database_state(backup_connection) != before_database:
                raise ValueError("P7.1基础库热备份逻辑状态不一致")
        finally:
            backup_connection.close()
        committed = False
        try:
            write_connection = connect_database(base_path)
            try:
                formal_apply = apply_definitions(
                    write_connection,
                    adjudication,
                    generated_at,
                )
                committed = True
                formal_repeat = apply_definitions(
                    write_connection,
                    adjudication,
                    generated_at,
                )
                package = build_current_dictionary(
                    write_connection,
                    generated_at,
                )
                after_database = protected_database_state(write_connection)
                definitions_by_type = {
                    row["type"]: row["count"]
                    for row in write_connection.execute(
                        """
                        SELECT type, COUNT(*) AS count
                        FROM knowledge_items
                        WHERE type IN (
                          'information_environment',
                          'environment_segment_type',
                          'information_object'
                        )
                          AND trim(coalesce(description, '')) <> ''
                        GROUP BY type
                        """
                    )
                }
            finally:
                write_connection.close()
            atomic_write_json(public_path, package)
            if formal_repeat != {
                "definitions_updated": 0,
                "change_logs_created": 0,
            }:
                raise ValueError(f"P7.1正式重复执行非幂等：{formal_repeat}")
            if before_database["master_identity"] != after_database["master_identity"]:
                raise ValueError("P7.1正式写入改变了主数据身份")
            for key in ("environment_relationships", "source_references"):
                if before_database[key] != after_database[key]:
                    raise ValueError(f"P7.1正式写入改变了受保护数据：{key}")
            after_files = {
                "base_database": file_state(base_path),
                "user_database": file_state(user_path),
                "source_workbook": file_state(SOURCE_WORKBOOK),
                "environment_dictionary": file_state(public_path),
            }
            for key in ("user_database", "source_workbook"):
                if before_files[key] != after_files[key]:
                    raise ValueError(f"P7.1受保护文件发生变化：{key}")
            dictionary_validation = validate_current_dictionary(package)
            report = {
                "schema_version": "environment-master-data-p7-1-definition-apply-v1",
                "plan_id": "PLAN-ENV-MD",
                "phase": "P7.1",
                "run_id": run_id,
                "generated_at": generated_at,
                "formal_apply_authorized": True,
                "adjudication": {
                    "path": str(ADJUDICATION.relative_to(ROOT)),
                    "sha256": sha256_file(ADJUDICATION),
                    "entries": len(adjudication["entries"]),
                    "source_text_claim": False,
                },
                "rehearsal": rehearsal,
                "apply": {
                    "first": formal_apply,
                    "repeat": formal_repeat,
                    "definitions_by_type": definitions_by_type,
                },
                "dictionary": {
                    **dictionary_validation,
                    "path": str(public_path.relative_to(ROOT)),
                    "sha256": after_files["environment_dictionary"]["sha256"],
                },
                "protected_boundaries": {
                    "master_identity_unchanged": True,
                    "relationships_unchanged": True,
                    "source_references_unchanged": True,
                    "user_database_unchanged": True,
                    "source_workbook_unchanged": True,
                    "before": before_files,
                    "after": after_files,
                },
                "recovery": {
                    "created_before_apply": True,
                    "base_backup": str(base_backup.relative_to(output_dir)),
                    "user_backup": str(user_backup.relative_to(output_dir)),
                    "dictionary_backup": str(
                        dictionary_backup.relative_to(output_dir)
                    ),
                    "adjudication_backup": str(
                        adjudication_backup.relative_to(output_dir)
                    ),
                    "independent_restore_test": rehearsal[
                        "independent_restore_test"
                    ],
                    "rollback_triggered": False,
                },
                "gate": {
                    "result": "ready_for_p7_1_frontend_acceptance",
                    "blockers": [],
                },
            }
            write_json(output_dir / "p7-1-definition-apply.json", report)
            write_json(output_dir / "environment-dictionary.json", package)
            write_json(
                output_dir / "manifest.json",
                {
                    "schema_version": "environment-master-data-p7-1-manifest-v1",
                    "run_id": run_id,
                    "files": [
                        {
                            **file_state(output_dir / name),
                            "path": name,
                        }
                        for name in (
                            "p7-1-definition-apply.json",
                            "environment-dictionary.json",
                        )
                    ],
                },
            )
        except Exception:
            if committed:
                sqlite_backup(base_backup, base_path)
                shutil.copy2(dictionary_backup, public_path)
            raise
        finally:
            fcntl.flock(lock.fileno(), fcntl.LOCK_UN)

    print(
        json.dumps(
            {
                "result": "pass",
                "run_id": run_id,
                "output_dir": str(output_dir),
                "definitions_updated": formal_apply["definitions_updated"],
                "usage_relations": len(package["usage_relations"]),
                "gate": report["gate"]["result"],
            },
            ensure_ascii=False,
            indent=2,
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
