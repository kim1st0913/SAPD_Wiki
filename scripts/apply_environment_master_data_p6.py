#!/usr/bin/env python3
from __future__ import annotations

import argparse
import csv
import fcntl
import hashlib
import json
import os
import shutil
import socket
import sqlite3
import subprocess
import tempfile
import traceback
from pathlib import Path
from typing import Any

from audit_environment_master_data_p1_inventory import (
    load_base_inventory,
    user_reference_inventory,
)
from export_environment_dictionary_p4_shadow import (
    DEFAULT_ANALYTICS_SUMMARY,
    DEFAULT_BASEMAP_NODE_DETAILS,
    DEFAULT_ENVIRONMENT_DATA_ROOT,
    DEFAULT_PUBLIC_PACKAGE,
    add_explicit_route_ids,
    atomic_write_json,
    sha256_tree,
    validate_p4_package,
)
from rehearse_environment_master_data_p3_migration import (
    DEFAULT_BASE_DB,
    DEFAULT_BASEMAP,
    DEFAULT_OUTPUT_ROOT,
    DEFAULT_P2_OUTPUT,
    DEFAULT_USER_DB,
    DEFAULT_WORKBENCH,
    DEFAULT_WORKBOOK,
    apply_plan,
    candidate_dictionary,
    connect_database,
    iso_utc,
    load_plan,
    logical_snapshot,
    protected_apply_hashes,
    read_json,
    sha256_file,
    sqlite_backup,
    table_hash,
    utc_now,
    validate_applied_state,
)


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_P3_OUTPUT = (
    ROOT / "data/exports/worker-verify/plan-env-md/p3-20260725T162703Z"
)
DEFAULT_P4_OUTPUT = (
    ROOT / "data/exports/worker-verify/plan-env-md/p4-20260725T164302Z"
)
DEFAULT_P5_OUTPUT = (
    ROOT / "data/exports/worker-verify/plan-env-md/p5-20260725T170159Z"
)
DEFAULT_SCHEMA = (
    ROOT
    / "docs/01-architecture/contracts/environment-master-data/v1/"
    "environment-dictionary.schema.json"
)
DEFAULT_INDEX_HTML = ROOT / "frontend/capability-browser/index.html"
CONFIRMATION = "PLAN-ENV-MD-P6-FORMAL-APPLY"
EXPECTED_PRE_APPLY_HASHES = {
    "base_database": "68a3fea58388963ac6752c6a9e82606ea7b9860c16ea9f9312bbb1bedf01e58e",
    "user_database": "0e3db1224b4c2044bcd0dfe4a7fbe9e3e5a28cf081a8ab1ff0b2622030c0af81",
    "source_workbook": "8127291446b44000e1390b269ad727f17cae0a04cdc7c0ea3dc1310f460e890f",
    "environment_workbench": "60072c6e1a66ef093d4c1bffb60b0cd57a0d0bcf79d37939dd8fc98fb0c79ed5",
    "environment_basemap_semantic": "81cfe79defb674bbfa2a0f13109dbbffa274b5783cf9343411d534dc881ae681",
}
PROTECTED_FILE_PATHS = {
    "user_database": DEFAULT_USER_DB,
    "source_workbook": DEFAULT_WORKBOOK,
    "environment_workbench": DEFAULT_WORKBENCH,
    "environment_basemap_semantic": DEFAULT_BASEMAP,
    "environment_basemap_node_details": DEFAULT_BASEMAP_NODE_DETAILS,
    "analytics_summary": DEFAULT_ANALYTICS_SUMMARY,
}


def write_json(path: Path, value: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(value, ensure_ascii=False, indent=2, sort_keys=False) + "\n",
        encoding="utf-8",
    )


def json_hash(value: Any) -> str:
    payload = json.dumps(
        value,
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
        default=str,
    ).encode("utf-8")
    return hashlib.sha256(payload).hexdigest()


def file_record(path: Path, *, relative_to: Path = ROOT) -> dict[str, Any]:
    return {
        "path": str(path.resolve().relative_to(relative_to.resolve())),
        "sha256": sha256_file(path),
        "bytes": path.stat().st_size,
    }


def current_feature_flag() -> bool:
    text = DEFAULT_INDEX_HTML.read_text(encoding="utf-8")
    marker = "environmentMasterDictionary:"
    for line in text.splitlines():
        if marker not in line:
            continue
        value = line.split(marker, 1)[1].split(",", 1)[0].strip()
        if value == "false":
            return False
        if value == "true":
            return True
    raise ValueError("无法解析 environmentMasterDictionary 功能开关")


def port_is_open(port: int) -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as handle:
        handle.settimeout(0.2)
        return handle.connect_ex(("127.0.0.1", port)) == 0


def generic_database_snapshot(path: Path) -> dict[str, Any]:
    connection = connect_database(path, read_only=True)
    try:
        tables = [
            str(row["name"])
            for row in connection.execute(
                """
                SELECT name
                FROM sqlite_master
                WHERE type='table' AND name NOT LIKE 'sqlite_%'
                ORDER BY name
                """
            )
        ]
        return {
            "integrity_check": connection.execute(
                "PRAGMA integrity_check"
            ).fetchone()[0],
            "foreign_key_check": [
                list(row) for row in connection.execute("PRAGMA foreign_key_check")
            ],
            "user_version": connection.execute("PRAGMA user_version").fetchone()[0],
            "counts": {
                table: connection.execute(
                    f'SELECT COUNT(*) FROM "{table}"'
                ).fetchone()[0]
                for table in tables
            },
            "hashes": {table: table_hash(connection, table) for table in tables},
        }
    finally:
        connection.close()


def base_snapshots(path: Path) -> tuple[dict[str, Any], dict[str, str]]:
    connection = connect_database(path, read_only=True)
    try:
        return logical_snapshot(connection), protected_apply_hashes(connection)
    finally:
        connection.close()


def user_references(
    base_path: Path,
    user_path: Path,
    basemap_path: Path,
) -> dict[str, Any]:
    base_connection = connect_database(base_path, read_only=True)
    user_connection = connect_database(user_path, read_only=True)
    try:
        base = load_base_inventory(base_connection)
        basemap = read_json(basemap_path)
        return user_reference_inventory(user_connection, base, basemap)
    finally:
        user_connection.close()
        base_connection.close()


def relation_ledger(path: Path) -> list[dict[str, Any]]:
    connection = connect_database(path, read_only=True)
    try:
        evidence_by_relation: dict[str, list[dict[str, Any]]] = {}
        for row in connection.execute(
            """
            SELECT id, target_id, source_file_id, source_sheet, source_row,
                   source_column, source_cell, raw_value, source_hash, created_at
            FROM source_references
            WHERE target_type='relation'
            ORDER BY target_id, id
            """
        ):
            evidence_by_relation.setdefault(row["target_id"], []).append(dict(row))
        rows = []
        for row in connection.execute(
            """
            SELECT id, source_item_id, target_item_id, relation_type, relation_label,
                   confidence, source_file_id, import_job_id, metadata_json,
                   created_at, updated_at, stable_key, stable_ref, public_id
            FROM knowledge_relations
            ORDER BY id
            """
        ):
            relation = dict(row)
            evidence = evidence_by_relation.get(relation["id"], [])
            rows.append(
                {
                    "id": relation["id"],
                    "stable_ref": relation["stable_ref"],
                    "relation_sha256": json_hash(relation),
                    "source_evidence_count": len(evidence),
                    "source_evidence_sha256": json_hash(evidence),
                }
            )
        return rows
    finally:
        connection.close()


def manifest_files(directory: Path) -> list[dict[str, Any]]:
    files = []
    for path in sorted(candidate for candidate in directory.rglob("*") if candidate.is_file()):
        relative = path.relative_to(directory).as_posix()
        files.append(
            {
                "path": relative,
                "sha256": sha256_file(path),
                "bytes": path.stat().st_size,
            }
        )
    return files


def verify_manifest(directory: Path, files: list[dict[str, Any]]) -> None:
    for entry in files:
        path = directory / entry["path"]
        if not path.is_file():
            raise ValueError(f"恢复包文件缺失：{entry['path']}")
        if sha256_file(path) != entry["sha256"]:
            raise ValueError(f"恢复包文件哈希不一致：{entry['path']}")


def copy_file(source: Path, destination: Path) -> None:
    destination.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(source, destination)


def git_state() -> dict[str, Any]:
    def run(*args: str) -> str:
        return subprocess.run(
            ["git", *args],
            cwd=ROOT,
            check=True,
            text=True,
            capture_output=True,
        ).stdout

    return {
        "head": run("rev-parse", "HEAD").strip(),
        "branch": run("symbolic-ref", "--short", "HEAD").strip(),
        "status_porcelain": run("status", "--porcelain=v1").splitlines(),
        "tracked_diff_names": run("diff", "--name-only").splitlines(),
        "untracked_names": run(
            "ls-files", "--others", "--exclude-standard"
        ).splitlines(),
        "allowed_p6_writes": [
            "data/database/sapd_wiki.sqlite3",
            "data/exports/worker-verify/plan-env-md/p6-*/",
            "CURRENT_STATE.md",
            "progress.md",
            "findings.md",
            "docs/06-implementation/environment-master-data-dictionary-plan-2026-07-25.md",
        ],
    }


def protected_file_hashes(
    base_path: Path,
    *,
    enforce_pre_apply_baseline: bool,
) -> dict[str, Any]:
    result = {
        "base_database": file_record(base_path),
        **{
            name: file_record(path)
            for name, path in PROTECTED_FILE_PATHS.items()
        },
        "environment_dictionary": file_record(DEFAULT_PUBLIC_PACKAGE),
        "environment_data_tree": sha256_tree(DEFAULT_ENVIRONMENT_DATA_ROOT),
    }
    if enforce_pre_apply_baseline:
        for name, expected in EXPECTED_PRE_APPLY_HASHES.items():
            if result[name]["sha256"] != expected:
                raise ValueError(
                    f"P6前受保护输入漂移：{name} "
                    f"expected={expected} actual={result[name]['sha256']}"
                )
    return result


def validate_phase_gates(
    p2_output: Path,
    p3_output: Path,
    p4_output: Path,
    p5_output: Path,
) -> tuple[dict[str, Any], dict[str, Any], dict[str, Any], dict[str, Any]]:
    plan_data = load_plan(p2_output)
    p3 = read_json(p3_output / "p3-migration-rehearsal.json")
    p4 = read_json(p4_output / "p4-shadow-export.json")
    p5 = read_json(p5_output / "p5-shadow-frontend.json")
    if p3.get("gate", {}).get("result") != "ready_for_p4_shadow_export":
        raise ValueError("P3门禁未通过")
    if p4.get("gate", {}).get("result") != "ready_for_p5_shadow_frontend":
        raise ValueError("P4门禁未通过")
    if p5.get("gate", {}).get("result") != "ready_for_p6_separate_authorization":
        raise ValueError("P5门禁未进入P6单独授权")
    if any(
        report.get("formal_apply_authorized") is not False
        for report in (p3, p4, p5)
    ):
        raise ValueError("P3—P5历史报告的formal_apply状态异常")
    if current_feature_flag() is not False:
        raise ValueError("P6前功能开关必须保持false")
    return plan_data, p3, p4, p5


def prepare_recovery(
    output_dir: Path,
    base_path: Path,
    user_path: Path,
    p2_output: Path,
    p3_output: Path,
    p4_output: Path,
    p5_output: Path,
    before_hashes: dict[str, Any],
    base_before: dict[str, Any],
    protected_before: dict[str, str],
    user_before: dict[str, Any],
    references_before: dict[str, Any],
    relations_before: list[dict[str, Any]],
    run_id: str,
) -> tuple[Path, Path, dict[str, Any]]:
    recovery = output_dir / "recovery"
    base_backup = recovery / "database/sapd_wiki.before-p6.sqlite3"
    user_backup = recovery / "database/sapd_wiki_user.before-p6.sqlite3"
    base_backup.parent.mkdir(parents=True, exist_ok=True)
    sqlite_backup(base_path, base_backup)
    sqlite_backup(user_path, user_backup)

    copies = {
        DEFAULT_WORKBOOK: recovery / "source/wiki sample.xlsx",
        DEFAULT_WORKBENCH: recovery / "packages/environment-workbench.json",
        DEFAULT_BASEMAP: recovery / "packages/environmentBasemap.semantic.json",
        DEFAULT_BASEMAP_NODE_DETAILS: recovery
        / "packages/environmentBasemap.node-details.json",
        DEFAULT_ANALYTICS_SUMMARY: recovery / "packages/analytics-summary.json",
        DEFAULT_PUBLIC_PACKAGE: recovery
        / "packages/environment-dictionary.before-p6.json",
        DEFAULT_SCHEMA: recovery / "contracts/environment-dictionary.schema.json",
        DEFAULT_INDEX_HTML: recovery / "frontend/index.before-p6.html",
        p2_output / "master-code-allocation.csv": recovery
        / "plans/master-code-allocation.csv",
        p2_output / "instance-of-plan.json": recovery
        / "plans/instance-of-plan.json",
        p2_output / "master-data-decision-manifest.p2.json": recovery
        / "plans/master-data-decision-manifest.p2.json",
        p3_output / "migration-before-after-ledger.csv": recovery
        / "plans/p3-migration-before-after-ledger.csv",
        p4_output / "p4-shadow-export.json": recovery
        / "phase-evidence/p4-shadow-export.json",
        p5_output / "p5-shadow-frontend.json": recovery
        / "phase-evidence/p5-shadow-frontend.json",
    }
    for source, destination in copies.items():
        if not source.is_file():
            raise FileNotFoundError(source)
        copy_file(source, destination)
    shutil.copytree(
        DEFAULT_ENVIRONMENT_DATA_ROOT,
        recovery / "packages/environment",
    )

    write_json(recovery / "snapshots/base-logical-before.json", base_before)
    write_json(
        recovery / "snapshots/protected-apply-hashes-before.json",
        protected_before,
    )
    write_json(recovery / "snapshots/user-logical-before.json", user_before)
    write_json(recovery / "snapshots/user-reference-before.json", references_before)
    write_json(recovery / "snapshots/existing-relations-before.json", relations_before)
    write_json(recovery / "snapshots/git-state-before.json", git_state())

    backup_base_snapshot, _ = base_snapshots(base_backup)
    backup_user_snapshot = generic_database_snapshot(user_backup)
    if backup_base_snapshot != base_before:
        raise ValueError("基础库热备份逻辑快照与P6前状态不一致")
    if backup_user_snapshot != user_before:
        raise ValueError("用户库热备份逻辑快照与P6前状态不一致")

    preflight = {
        "schema_version": "environment-master-data-p6-preflight-v1",
        "run_id": run_id,
        "formal_apply_authorized": True,
        "feature_switch_enabled": current_feature_flag(),
        "ports": {"5173_open": port_is_open(5173), "28775_open": port_is_open(28775)},
        "input_hashes": before_hashes,
        "base_backup": {
            "path": str(base_backup.relative_to(output_dir)),
            "sha256": sha256_file(base_backup),
            "bytes": base_backup.stat().st_size,
            "integrity_check": backup_base_snapshot["integrity_check"],
            "logical_snapshot_matches_source": True,
        },
        "user_backup": {
            "path": str(user_backup.relative_to(output_dir)),
            "sha256": sha256_file(user_backup),
            "bytes": user_backup.stat().st_size,
            "integrity_check": backup_user_snapshot["integrity_check"],
            "logical_snapshot_matches_source": True,
        },
        "environment_tree_backup": {
            "source": before_hashes["environment_data_tree"],
            "backup": sha256_tree(recovery / "packages/environment"),
        },
        "user_reference_summary": {
            "scanned_reference_columns": len(
                references_before["scanned_reference_columns"]
            ),
            "relevant_match_occurrences": references_before[
                "relevant_match_occurrences"
            ],
            "unresolved_domain_references": len(
                references_before["unresolved_domain_references"]
            ),
        },
        "ready": True,
    }
    if preflight["ports"] != {"5173_open": False, "28775_open": False}:
        raise ValueError("P6恢复包建立时5173与28775必须均已停止")
    if preflight["user_reference_summary"]["unresolved_domain_references"]:
        raise ValueError("P6前用户库存在未解析的信息化环境域引用")
    if (
        preflight["environment_tree_backup"]["source"]["tree_sha256"]
        != preflight["environment_tree_backup"]["backup"]["tree_sha256"]
    ):
        raise ValueError("环境拆分投影恢复副本哈希不一致")
    write_json(recovery / "preflight.json", preflight)

    recovery_files = manifest_files(recovery)
    recovery_manifest = {
        "schema_version": "environment-master-data-p6-recovery-manifest-v1",
        "plan_id": "PLAN-ENV-MD",
        "run_id": run_id,
        "created_before_apply": True,
        "formal_apply_authorized": True,
        "files": recovery_files,
    }
    write_json(output_dir / "recovery-manifest.json", recovery_manifest)
    verify_manifest(recovery, recovery_files)
    return base_backup, user_backup, preflight


def restore_sqlite(source_backup: Path, destination: Path) -> None:
    source = sqlite3.connect(
        f"{source_backup.resolve().as_uri()}?mode=ro",
        uri=True,
    )
    target = sqlite3.connect(destination)
    try:
        source.backup(target)
    finally:
        target.close()
        source.close()


def write_migration_ledger(
    path: Path,
    plan_data: dict[str, Any],
    connection: sqlite3.Connection,
) -> None:
    rows = []
    for allocation in plan_data["allocations"]:
        row = connection.execute(
            """
            SELECT id, type, code, stable_ref, public_id
            FROM knowledge_items
            WHERE id=?
            """,
            (allocation["database_id"],),
        ).fetchone()
        rows.append(
            {
                "kind": "master_data",
                "planned_id": allocation["database_id"],
                "planned_type": allocation["master_type"],
                "planned_code": allocation["code"],
                "actual_code": row["code"] if row else None,
                "actual_stable_ref": row["stable_ref"] if row else None,
                "result": "matched" if row and row["code"] == allocation["code"] else "mismatch",
            }
        )
    for relation in plan_data["relations"]:
        row = connection.execute(
            """
            SELECT id, relation_type, source_item_id, target_item_id, stable_ref
            FROM knowledge_relations
            WHERE id=?
            """,
            (relation["planned_relation_id"],),
        ).fetchone()
        matched = (
            row
            and row["relation_type"] == "instance_of"
            and row["source_item_id"] == relation["source_item_id"]
            and row["target_item_id"] == relation["target_planned_id"]
            and row["stable_ref"] == relation["stable_ref"]
        )
        rows.append(
            {
                "kind": "instance_of",
                "planned_id": relation["planned_relation_id"],
                "planned_type": "instance_of",
                "planned_code": "",
                "actual_code": "",
                "actual_stable_ref": row["stable_ref"] if row else None,
                "result": "matched" if matched else "mismatch",
            }
        )
    with path.open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(rows[0]))
        writer.writeheader()
        writer.writerows(rows)


def final_manifest(output_dir: Path, run_id: str) -> dict[str, Any]:
    names = [
        "formal-environment-dictionary.json",
        "migration-before-after-ledger.csv",
        "p6-formal-apply.json",
        "p6-formal-apply.md",
        "recovery-manifest.json",
    ]
    return {
        "schema_version": "environment-master-data-p6-manifest-v1",
        "plan_id": "PLAN-ENV-MD",
        "run_id": run_id,
        "files": [
            {
                "path": name,
                "sha256": sha256_file(output_dir / name),
                "bytes": (output_dir / name).stat().st_size,
            }
            for name in names
        ],
    }


def main() -> int:
    parser = argparse.ArgumentParser(
        description="PLAN-ENV-MD P6 formal apply with verified recovery package."
    )
    parser.add_argument("--base-db", type=Path, default=DEFAULT_BASE_DB)
    parser.add_argument("--user-db", type=Path, default=DEFAULT_USER_DB)
    parser.add_argument("--p2-output", type=Path, default=DEFAULT_P2_OUTPUT)
    parser.add_argument("--p3-output", type=Path, default=DEFAULT_P3_OUTPUT)
    parser.add_argument("--p4-output", type=Path, default=DEFAULT_P4_OUTPUT)
    parser.add_argument("--p5-output", type=Path, default=DEFAULT_P5_OUTPUT)
    parser.add_argument("--output-root", type=Path, default=DEFAULT_OUTPUT_ROOT)
    parser.add_argument("--apply", action="store_true")
    parser.add_argument("--confirm-formal-apply", default="")
    args = parser.parse_args()

    base_path = args.base_db.resolve()
    user_path = args.user_db.resolve()
    p2_output = args.p2_output.resolve()
    p3_output = args.p3_output.resolve()
    p4_output = args.p4_output.resolve()
    p5_output = args.p5_output.resolve()
    plan_data, p3_report, p4_report, p5_report = validate_phase_gates(
        p2_output,
        p3_output,
        p4_output,
        p5_output,
    )
    before_hashes = protected_file_hashes(
        base_path,
        enforce_pre_apply_baseline=True,
    )

    if not args.apply:
        print(
            json.dumps(
                {
                    "result": "dry_run_ready",
                    "formal_apply_executed": False,
                    "required_confirmation": CONFIRMATION,
                    "base_database": str(base_path),
                    "feature_switch_enabled": current_feature_flag(),
                    "pre_apply_hashes": {
                        name: value["sha256"]
                        for name, value in before_hashes.items()
                        if isinstance(value, dict) and "sha256" in value
                    },
                },
                ensure_ascii=False,
                indent=2,
            )
        )
        return 0

    if args.confirm_formal_apply != CONFIRMATION:
        raise ValueError("缺少P6正式apply独立确认值")
    if base_path != DEFAULT_BASE_DB.resolve() or user_path != DEFAULT_USER_DB.resolve():
        raise ValueError("P6正式apply只允许显式项目正式基础库和用户库路径")
    if port_is_open(5173) or port_is_open(28775):
        raise ValueError("P6正式apply前必须停止5173与28775")

    now = utc_now()
    run_id = f"p6-{now.strftime('%Y%m%dT%H%M%SZ')}"
    output_dir = args.output_root.resolve() / run_id
    output_dir.mkdir(parents=True, exist_ok=False)
    lock_path = ROOT / "data/database/plan-env-md-p6.apply.lock"
    lock_path.parent.mkdir(parents=True, exist_ok=True)

    base_before, protected_before = base_snapshots(base_path)
    user_before = generic_database_snapshot(user_path)
    references_before = user_references(base_path, user_path, DEFAULT_BASEMAP)
    relations_before = relation_ledger(base_path)
    base_backup: Path | None = None
    user_backup: Path | None = None
    committed = False
    rollback_result: dict[str, Any] = {
        "triggered": False,
        "base_restored": False,
        "user_restored": False,
        "dictionary_restored": False,
    }

    with lock_path.open("a+", encoding="utf-8") as lock_handle:
        try:
            fcntl.flock(lock_handle.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError as exc:
            raise ValueError("已有PLAN-ENV-MD P6正式写者") from exc
        try:
            base_backup, user_backup, preflight = prepare_recovery(
                output_dir,
                base_path,
                user_path,
                p2_output,
                p3_output,
                p4_output,
                p5_output,
                before_hashes,
                base_before,
                protected_before,
                user_before,
                references_before,
                relations_before,
                run_id,
            )

            connection = connect_database(base_path)
            try:
                connection.execute("PRAGMA busy_timeout=0")
                first_apply = apply_plan(connection, plan_data)
                committed = True
                applied_validation = validate_applied_state(connection, plan_data)
                if applied_validation["result"] != "pass":
                    raise ValueError(
                        f"P6正式apply后数据库校验失败：{applied_validation['blockers']}"
                    )
                repeat_apply = apply_plan(connection, plan_data)
                if any(repeat_apply.values()):
                    raise ValueError(f"P6重复apply不是零写入：{repeat_apply}")
                repeat_validation = validate_applied_state(connection, plan_data)
                if repeat_validation["result"] != "pass":
                    raise ValueError("P6重复apply后数据库校验失败")

                public_package = read_json(DEFAULT_PUBLIC_PACKAGE)
                formal_package = candidate_dictionary(
                    connection,
                    plan_data,
                    public_package["generated_at"],
                )
                formal_package["source_package_versions"] = public_package[
                    "source_package_versions"
                ]
                add_explicit_route_ids(connection, formal_package)
                package_validation = validate_p4_package(formal_package)
                if package_validation["result"] != "pass":
                    raise ValueError(
                        f"P6正式字典校验失败：{package_validation['blockers']}"
                    )
                if formal_package != public_package:
                    raise ValueError(
                        "P6正式库重建字典与已验收P4影子包不一致，禁止替换"
                    )
                write_json(
                    output_dir / "formal-environment-dictionary.json",
                    formal_package,
                )
                write_migration_ledger(
                    output_dir / "migration-before-after-ledger.csv",
                    plan_data,
                    connection,
                )
                base_after = logical_snapshot(connection)
                protected_after = protected_apply_hashes(connection)
            finally:
                connection.close()

            if protected_after != protected_before:
                raise ValueError("P6改变了计划外的既有对象、关系、来源或审计")
            relations_after = relation_ledger(base_path)
            old_relation_map = {row["id"]: row for row in relations_before}
            new_relation_map = {row["id"]: row for row in relations_after}
            changed_old_relations = [
                relation_id
                for relation_id, before in old_relation_map.items()
                if new_relation_map.get(relation_id) != before
            ]
            if changed_old_relations:
                raise ValueError(
                    f"P6改变既有关系逐ID清单：{changed_old_relations[:5]}"
                )

            user_after = generic_database_snapshot(user_path)
            references_after = user_references(base_path, user_path, DEFAULT_BASEMAP)
            if user_after != user_before:
                raise ValueError("P6期间用户库逻辑快照发生变化")
            if references_after != references_before:
                raise ValueError("P6后用户引用解析结果发生变化")
            if references_after["unresolved_domain_references"]:
                raise ValueError("P6后存在未解析的信息化环境域用户引用")

            after_hashes = protected_file_hashes(
                base_path,
                enforce_pre_apply_baseline=False,
            )
            if after_hashes["user_database"] != before_hashes["user_database"]:
                raise ValueError("P6期间用户库物理哈希发生变化")
            for name in (
                "source_workbook",
                "environment_workbench",
                "environment_basemap_semantic",
                "environment_basemap_node_details",
                "analytics_summary",
                "environment_data_tree",
                "environment_dictionary",
            ):
                if after_hashes[name] != before_hashes[name]:
                    raise ValueError(f"P6计划外保护文件变化：{name}")

            with tempfile.TemporaryDirectory(prefix="sapd-env-md-p6-restore-test-") as temp:
                restored_base = Path(temp) / "base.sqlite3"
                restored_user = Path(temp) / "user.sqlite3"
                sqlite_backup(base_backup, restored_base)
                sqlite_backup(user_backup, restored_user)
                restored_base_snapshot, _ = base_snapshots(restored_base)
                restored_user_snapshot = generic_database_snapshot(restored_user)
                if restored_base_snapshot != base_before:
                    raise ValueError("P6基础库恢复包独立恢复测试失败")
                if restored_user_snapshot != user_before:
                    raise ValueError("P6用户库恢复包独立恢复测试失败")

            report = {
                "schema_version": "environment-master-data-p6-formal-apply-v1",
                "plan_id": "PLAN-ENV-MD",
                "phase": "P6",
                "run_id": run_id,
                "generated_at": iso_utc(now),
                "formal_apply_authorized": True,
                "confirmation": CONFIRMATION,
                "source_runs": {
                    "p2": plan_data["plan"]["run_id"],
                    "p3": p3_report["run_id"],
                    "p4": p4_report["run_id"],
                    "p5": p5_report["run_id"],
                },
                "preflight": preflight,
                "apply": {
                    "first": first_apply,
                    "repeat": repeat_apply,
                    "validation": repeat_validation,
                },
                "database": {
                    "path": str(base_path.relative_to(ROOT)),
                    "sha256_before": before_hashes["base_database"]["sha256"],
                    "sha256_after": after_hashes["base_database"]["sha256"],
                    "logical_before": base_before,
                    "logical_after": base_after,
                    "protected_existing_rows_unchanged": True,
                    "old_relation_ids_unchanged": True,
                },
                "dictionary_package": {
                    "path": str(DEFAULT_PUBLIC_PACKAGE.relative_to(ROOT)),
                    "sha256": sha256_file(DEFAULT_PUBLIC_PACKAGE),
                    "validation": package_validation,
                    "regenerated_from_formal_database": True,
                    "matches_p4_shadow_bytes": True,
                    "promoted_in_place": True,
                    "existing_package_replaced": False,
                },
                "user_state": {
                    "database_sha256_unchanged": True,
                    "logical_snapshot_unchanged": True,
                    "reference_resolution_unchanged": True,
                    "relevant_match_occurrences": references_after[
                        "relevant_match_occurrences"
                    ],
                    "unresolved_domain_references": 0,
                },
                "protected_inputs": {
                    "source_workbook_unchanged": True,
                    "environment_workbench_unchanged": True,
                    "environment_data_tree_unchanged": True,
                    "environment_basemap_unchanged": True,
                    "analytics_summary_unchanged": True,
                },
                "recovery": {
                    "manifest": "recovery-manifest.json",
                    "base_backup": str(base_backup.relative_to(output_dir)),
                    "user_backup": str(user_backup.relative_to(output_dir)),
                    "independent_restore_test": "pass",
                    "rollback_triggered": False,
                    "retain_until": "P8发布回归完成并由用户确认归档",
                },
                "feature_switch": {
                    "name": "environmentMasterDictionary",
                    "enabled": current_feature_flag(),
                },
                "gate": {
                    "result": "ready_for_p7_controlled_switch",
                    "blockers": [],
                    "p7_authorized": False,
                },
            }
            write_json(output_dir / "p6-formal-apply.json", report)
            (output_dir / "p6-formal-apply.md").write_text(
                "\n".join(
                    [
                        "# PLAN-ENV-MD P6 正式迁移",
                        "",
                        f"- run_id: `{run_id}`",
                        "- result: `ready_for_p7_controlled_switch`",
                        "- formal_apply_authorized: `true`",
                        f"- base backup: `{report['recovery']['base_backup']}`",
                        f"- user backup: `{report['recovery']['user_backup']}`",
                        "- independent restore test: `pass`",
                        f"- first apply: `{json.dumps(first_apply, ensure_ascii=False)}`",
                        f"- repeat apply mutations: `{sum(repeat_apply.values())}`",
                        "- master data: `10 / 16 / 51`",
                        "- relation contexts: `29 / 67`",
                        "- instance_of: `29`",
                        "- dictionary package: regenerated from formal DB and byte-equal to P4 shadow",
                        "- protected old relations, packages, source workbook and user database: unchanged",
                        "- feature switch: `false`",
                        "- P7: not authorized",
                        "",
                    ]
                ),
                encoding="utf-8",
            )
            write_json(output_dir / "manifest.json", final_manifest(output_dir, run_id))
            print(
                json.dumps(
                    {
                        "result": "pass",
                        "run_id": run_id,
                        "output_dir": str(output_dir),
                        "gate": report["gate"]["result"],
                        "base_sha256_after": after_hashes["base_database"]["sha256"],
                        "feature_switch_enabled": current_feature_flag(),
                    },
                    ensure_ascii=False,
                    indent=2,
                )
            )
            return 0
        except Exception as exc:
            rollback_result["triggered"] = committed
            if committed and base_backup and base_backup.is_file():
                restore_sqlite(base_backup, base_path)
                restored_base, _ = base_snapshots(base_path)
                rollback_result["base_restored"] = restored_base == base_before
            if user_backup and user_backup.is_file():
                if sha256_file(user_path) != before_hashes["user_database"]["sha256"]:
                    restore_sqlite(user_backup, user_path)
                    rollback_result["user_restored"] = (
                        generic_database_snapshot(user_path) == user_before
                    )
            dictionary_backup = (
                output_dir
                / "recovery/packages/environment-dictionary.before-p6.json"
            )
            if (
                dictionary_backup.is_file()
                and sha256_file(DEFAULT_PUBLIC_PACKAGE)
                != before_hashes["environment_dictionary"]["sha256"]
            ):
                atomic_write_json(
                    DEFAULT_PUBLIC_PACKAGE,
                    read_json(dictionary_backup),
                )
                rollback_result["dictionary_restored"] = (
                    sha256_file(DEFAULT_PUBLIC_PACKAGE)
                    == before_hashes["environment_dictionary"]["sha256"]
                )
            failure = {
                "schema_version": "environment-master-data-p6-failure-v1",
                "plan_id": "PLAN-ENV-MD",
                "run_id": run_id,
                "error_type": type(exc).__name__,
                "error": str(exc),
                "traceback": traceback.format_exc(),
                "rollback": rollback_result,
                "feature_switch_enabled": current_feature_flag(),
            }
            write_json(output_dir / "p6-failure.json", failure)
            raise
        finally:
            fcntl.flock(lock_handle.fileno(), fcntl.LOCK_UN)


if __name__ == "__main__":
    raise SystemExit(main())
