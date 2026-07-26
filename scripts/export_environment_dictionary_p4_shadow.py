#!/usr/bin/env python3
from __future__ import annotations

import argparse
import hashlib
import json
import os
import tempfile
from pathlib import Path
from typing import Any

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
    read_json,
    sha256_file,
    sqlite_backup,
    utc_now,
    validate_applied_state,
    validate_candidate_dictionary,
)


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_P3_OUTPUT = (
    ROOT / "data/exports/worker-verify/plan-env-md/p3-20260725T162703Z"
)
DEFAULT_PUBLIC_PACKAGE = (
    ROOT
    / "frontend/capability-browser/public/data/environment-dictionary.json"
)
DEFAULT_ENVIRONMENT_DATA_ROOT = (
    ROOT / "frontend/capability-browser/public/data/environment"
)
DEFAULT_BASEMAP_NODE_DETAILS = (
    ROOT
    / "frontend/capability-browser/generated/environmentBasemap.node-details.json"
)
DEFAULT_ANALYTICS_SUMMARY = (
    ROOT / "frontend/capability-browser/public/data/analytics-summary.json"
)


def write_json(path: Path, value: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(value, ensure_ascii=False, indent=2, sort_keys=False) + "\n",
        encoding="utf-8",
    )


def atomic_write_json(path: Path, value: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    handle = tempfile.NamedTemporaryFile(
        mode="w",
        encoding="utf-8",
        prefix=f".{path.name}.",
        suffix=".tmp",
        dir=path.parent,
        delete=False,
    )
    temporary_path = Path(handle.name)
    try:
        with handle:
            json.dump(value, handle, ensure_ascii=False, indent=2, sort_keys=False)
            handle.write("\n")
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(temporary_path, path)
    finally:
        if temporary_path.exists():
            temporary_path.unlink()


def sha256_tree(path: Path) -> dict[str, Any]:
    files = []
    digest = hashlib.sha256()
    for child in sorted(candidate for candidate in path.rglob("*") if candidate.is_file()):
        relative = child.relative_to(path).as_posix()
        file_hash = sha256_file(child)
        files.append(
            {
                "path": relative,
                "sha256": file_hash,
                "bytes": child.stat().st_size,
            }
        )
        digest.update(relative.encode("utf-8"))
        digest.update(b"\0")
        digest.update(file_hash.encode("ascii"))
        digest.update(b"\n")
    return {
        "path": str(path.relative_to(ROOT)),
        "file_count": len(files),
        "tree_sha256": digest.hexdigest(),
        "files": files,
    }


def protected_snapshot(paths: dict[str, Path]) -> dict[str, Any]:
    snapshot = {
        name: {
            "path": str(path.relative_to(ROOT)),
            "sha256": sha256_file(path),
            "bytes": path.stat().st_size,
        }
        for name, path in paths.items()
    }
    snapshot["environment_data_tree"] = sha256_tree(
        DEFAULT_ENVIRONMENT_DATA_ROOT
    )
    return snapshot


def validate_prerequisites(
    p2_output: Path,
    p3_output: Path,
    protected_before: dict[str, Any],
) -> tuple[dict[str, Any], dict[str, Any]]:
    p3_report = read_json(p3_output / "p3-migration-rehearsal.json")
    if p3_report.get("gate") != {
        "result": "ready_for_p4_shadow_export",
        "blockers": [],
        "formal_apply_authorized": False,
    }:
        raise ValueError("P3门禁未进入 ready_for_p4_shadow_export")
    if p3_report.get("source_p2_run_id") != p2_output.name:
        raise ValueError("P3来源P2运行目录与当前输入不一致")
    if p3_report.get("formal_apply_authorized") is not False:
        raise ValueError("P3必须保持 formal_apply_authorized=false")
    expected = p3_report["protected_inputs"]["hashes_after"]
    for label in (
        "base_database",
        "user_database",
        "source_workbook",
        "environment_workbench",
        "environment_basemap_semantic",
    ):
        actual = protected_before[label]["sha256"]
        if actual != expected[label]:
            raise ValueError(
                f"P3后受保护输入漂移：{label} expected={expected[label]} actual={actual}"
            )
    return load_plan(p2_output), p3_report


def add_explicit_route_ids(
    connection: Any,
    package: dict[str, Any],
) -> dict[str, int]:
    rows = connection.execute(
        """
        SELECT id, stable_ref
        FROM knowledge_items
        WHERE type IN (
          'information_environment',
          'environment_segment',
          'environment_object',
          'information_object'
        )
        """
    ).fetchall()
    ids_by_ref = {row["stable_ref"]: row["id"] for row in rows}
    counts = {
        "environment_id": 0,
        "segment_id": 0,
        "object_id": 0,
    }
    for relation in package["usage_relations"]:
        route_params = dict(relation.get("route_params") or {})
        for ref_field, id_field in (
            ("environment_ref", "environment_id"),
            ("segment_ref", "segment_id"),
            ("object_ref", "object_id"),
        ):
            stable_ref = relation.get(ref_field)
            if not stable_ref:
                continue
            object_id = ids_by_ref.get(stable_ref)
            if not object_id:
                raise ValueError(
                    f"关系导航目标无法解析：{relation['relation_ref']} {ref_field}={stable_ref}"
                )
            route_params[id_field] = object_id
            counts[id_field] += 1
        relation["route_params"] = route_params
    return counts


def validate_p4_package(package: dict[str, Any]) -> dict[str, Any]:
    result = validate_candidate_dictionary(package)
    blockers = list(result["blockers"])
    route_id_counts = {
        "environment_id": 0,
        "segment_id": 0,
        "object_id": 0,
    }
    for relation in package["usage_relations"]:
        params = relation.get("route_params") or {}
        if relation.get("environment_ref") and not params.get("environment_id"):
            blockers.append(
                f"缺少显式environment_id：{relation['relation_ref']}"
            )
        if relation.get("segment_ref") and not params.get("segment_id"):
            blockers.append(f"缺少显式segment_id：{relation['relation_ref']}")
        if relation.get("object_ref") and not params.get("object_id"):
            blockers.append(f"缺少显式object_id：{relation['relation_ref']}")
        for field in route_id_counts:
            if params.get(field):
                route_id_counts[field] += 1
    master_records = (
        package["information_environments"]
        + package["environment_segment_types"]
        + package["information_objects"]
    )
    for field in ("id", "stable_ref", "public_id", "code"):
        if len({row[field] for row in master_records}) != len(master_records):
            blockers.append(f"主数据{field}不唯一")
    if package.get("data_state") != "ready":
        blockers.append("P4影子包必须处于ready状态")
    if package.get("source_package_versions", {}).get("phase") != "P4-shadow-export":
        blockers.append("P4影子包phase错误")
    result.update(
        {
            "result": "pass" if not blockers else "blocked",
            "blockers": blockers,
            "route_id_counts": route_id_counts,
            "master_record_count": len(master_records),
        }
    )
    return result


def manifest_for(directory: Path, names: list[str], run_id: str) -> dict[str, Any]:
    return {
        "schema_version": "environment-master-data-p4-manifest-v1",
        "run_id": run_id,
        "formal_apply_authorized": False,
        "files": [
            {
                "path": name,
                "sha256": sha256_file(directory / name),
                "bytes": (directory / name).stat().st_size,
            }
            for name in names
        ],
    }


def main() -> int:
    parser = argparse.ArgumentParser(
        description="在P3临时apply结果上生成环境主数据P4影子字典包。"
    )
    parser.add_argument("--p2-output", type=Path, default=DEFAULT_P2_OUTPUT)
    parser.add_argument("--p3-output", type=Path, default=DEFAULT_P3_OUTPUT)
    parser.add_argument("--output-root", type=Path, default=DEFAULT_OUTPUT_ROOT)
    parser.add_argument(
        "--public-package",
        type=Path,
        default=DEFAULT_PUBLIC_PACKAGE,
    )
    args = parser.parse_args()

    now = utc_now()
    generated_at = iso_utc(now)
    run_id = f"p4-{now.strftime('%Y%m%dT%H%M%SZ')}"
    output_dir = args.output_root.resolve() / run_id
    if output_dir.exists():
        raise ValueError(f"P4输出目录已存在：{output_dir}")
    output_dir.mkdir(parents=True)

    protected_paths = {
        "base_database": DEFAULT_BASE_DB,
        "user_database": DEFAULT_USER_DB,
        "source_workbook": DEFAULT_WORKBOOK,
        "environment_workbench": DEFAULT_WORKBENCH,
        "environment_basemap_semantic": DEFAULT_BASEMAP,
        "environment_basemap_node_details": DEFAULT_BASEMAP_NODE_DETAILS,
        "analytics_summary": DEFAULT_ANALYTICS_SUMMARY,
    }
    for label, path in protected_paths.items():
        if not path.is_file():
            raise FileNotFoundError(f"缺少受保护输入：{label} {path}")
    protected_before = protected_snapshot(protected_paths)
    plan_data, p3_report = validate_prerequisites(
        args.p2_output.resolve(),
        args.p3_output.resolve(),
        protected_before,
    )

    with tempfile.TemporaryDirectory(prefix="sapd-env-md-p4-") as temp_dir:
        temp_database = Path(temp_dir) / "sapd_wiki.p4.sqlite3"
        sqlite_backup(DEFAULT_BASE_DB, temp_database)
        connection = connect_database(temp_database)
        try:
            apply_result = apply_plan(connection, plan_data)
            apply_validation = validate_applied_state(connection, plan_data)
            if apply_validation["result"] != "pass":
                raise ValueError(
                    f"P4临时apply校验失败：{apply_validation['blockers']}"
                )
            package = candidate_dictionary(
                connection,
                plan_data,
                generated_at,
            )
            package["source_package_versions"] = {
                "plan": "PLAN-ENV-MD",
                "phase": "P4-shadow-export",
                "p2_run_id": plan_data["plan"]["run_id"],
                "p3_run_id": p3_report["run_id"],
                "p3_manifest_sha256": sha256_file(
                    args.p3_output.resolve() / "manifest.json"
                ),
            }
            route_id_counts = add_explicit_route_ids(connection, package)
            package_validation = validate_p4_package(package)
            if package_validation["result"] != "pass":
                raise ValueError(
                    f"P4字典包校验失败：{package_validation['blockers']}"
                )
        finally:
            connection.close()

    atomic_write_json(args.public_package.resolve(), package)
    write_json(output_dir / "environment-dictionary.json", package)
    if sha256_file(args.public_package.resolve()) != sha256_file(
        output_dir / "environment-dictionary.json"
    ):
        raise ValueError("公开影子包与P4证据副本不一致")

    protected_after = protected_snapshot(protected_paths)
    protected_unchanged = protected_after == protected_before
    if not protected_unchanged:
        raise ValueError("P4受保护输入在影子导出期间发生变化")

    compatibility = {
        "schema_version": "environment-master-data-p4-compatibility-v1",
        "run_id": run_id,
        "protected_inputs_unchanged": protected_unchanged,
        "hashes_before": protected_before,
        "hashes_after": protected_after,
        "legacy_contract": {
            "information_environments": 10,
            "environment_segment_contexts": 29,
            "environment_object_contexts": 67,
        },
        "formal_database_modified": False,
        "user_database_modified": False,
        "source_workbook_modified": False,
        "existing_environment_packages_replaced": False,
    }
    write_json(output_dir / "compatibility-hashes.json", compatibility)

    report = {
        "schema_version": "environment-master-data-p4-shadow-export-v1",
        "plan_id": "PLAN-ENV-MD",
        "phase": "P4",
        "run_id": run_id,
        "generated_at": generated_at,
        "source_p2_run_id": plan_data["plan"]["run_id"],
        "source_p3_run_id": p3_report["run_id"],
        "formal_apply_authorized": False,
        "temporary_database": {
            "created_with_sqlite_backup": True,
            "retained": False,
        },
        "apply": {
            "result": apply_result,
            "validation": apply_validation,
        },
        "shadow_package": {
            "path": str(args.public_package.resolve().relative_to(ROOT)),
            "sha256": sha256_file(args.public_package.resolve()),
            "validation": package_validation,
            "route_id_counts": route_id_counts,
            "additive_output": True,
        },
        "protected_inputs": {
            "unchanged": protected_unchanged,
            "hashes_before": protected_before,
            "hashes_after": protected_after,
        },
        "gate": {
            "result": "ready_for_p5_shadow_frontend",
            "blockers": [],
            "formal_apply_authorized": False,
        },
    }
    write_json(output_dir / "p4-shadow-export.json", report)
    (output_dir / "p4-shadow-export.md").write_text(
        "\n".join(
            [
                "# 环境主数据 P4 影子导出",
                "",
                f"- 运行：`{run_id}`",
                f"- 来源 P3：`{p3_report['run_id']}`",
                "- 正式 apply：未授权、未执行",
                "- 影子字典：新增 `frontend/capability-browser/public/data/environment-dictionary.json`",
                "- 主数据：信息化环境 10、环境子类 16、信息化对象 51",
                "- 上下文：环境子类 29、环境对象 67",
                "- 使用关系：106",
                "- 现有环境树、拆分投影、底图、分析摘要：哈希未变化",
                "- 门禁：`ready_for_p5_shadow_frontend`",
                "",
            ]
        ),
        encoding="utf-8",
    )
    output_names = [
        "compatibility-hashes.json",
        "environment-dictionary.json",
        "p4-shadow-export.json",
        "p4-shadow-export.md",
    ]
    write_json(
        output_dir / "manifest.json",
        manifest_for(output_dir, output_names, run_id),
    )
    print(
        json.dumps(
            {
                "result": "pass",
                "run_id": run_id,
                "output_dir": str(output_dir),
                "package": str(args.public_package.resolve()),
                "gate": report["gate"]["result"],
            },
            ensure_ascii=False,
            indent=2,
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
