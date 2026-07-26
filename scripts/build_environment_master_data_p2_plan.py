#!/usr/bin/env python3
from __future__ import annotations

import argparse
import csv
import hashlib
import json
import sqlite3
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_P1_REPORT = (
    ROOT
    / "data/exports/worker-verify/plan-env-md/p1-20260725T154921Z/p1-inventory.json"
)
DEFAULT_BASE_DB = ROOT / "data/database/sapd_wiki.sqlite3"
DEFAULT_USER_DB = ROOT / "data/user/sapd_wiki_user.sqlite3"
DEFAULT_WORKBOOK = ROOT / "data/raw-samples/wiki sample.xlsx"
DEFAULT_WORKBENCH = (
    ROOT / "frontend/capability-browser/public/data/environment-workbench.json"
)
DEFAULT_BASEMAP = (
    ROOT / "frontend/capability-browser/generated/environmentBasemap.semantic.json"
)
DEFAULT_P0_CONTRACT = (
    ROOT
    / "docs/01-architecture/contracts/environment-master-data/v1/environment-master-data.contract.json"
)
DEFAULT_ADJUDICATION = (
    ROOT
    / "docs/01-architecture/contracts/environment-master-data/v1/environment-segment-type-adjudication.p2.json"
)
DEFAULT_OUTPUT_ROOT = ROOT / "data/exports/worker-verify/plan-env-md"
SCENE_SHEET = "作用域-安全技术服务-安全技术模块映射"


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def iso_utc(value: datetime) -> str:
    return value.replace(microsecond=0).isoformat().replace("+00:00", "Z")


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def read_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, value: Any) -> None:
    path.write_text(
        json.dumps(value, ensure_ascii=False, indent=2, sort_keys=False) + "\n",
        encoding="utf-8",
    )


def write_csv(path: Path, fieldnames: list[str], rows: list[dict[str, Any]]) -> None:
    with path.open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        for row in rows:
            writer.writerow(
                {
                    field: (
                        json.dumps(row.get(field), ensure_ascii=False, sort_keys=True)
                        if isinstance(row.get(field), (list, dict))
                        else row.get(field, "")
                    )
                    for field in fieldnames
                }
            )


def connect_read_only(path: Path) -> sqlite3.Connection:
    connection = sqlite3.connect(f"{path.resolve().as_uri()}?mode=ro", uri=True)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA query_only = ON")
    return connection


def stable_public_id(prefix: str, stable_ref: str) -> str:
    return f"{prefix}_{hashlib.sha256(stable_ref.encode('utf-8')).hexdigest()[:16]}"


def input_paths(args: argparse.Namespace) -> dict[str, Path]:
    return {
        "base_database": Path(args.base_db).resolve(),
        "user_database": Path(args.user_db).resolve(),
        "source_workbook": Path(args.source_workbook).resolve(),
        "environment_workbench": Path(args.environment_workbench).resolve(),
        "environment_basemap_semantic": Path(args.environment_basemap).resolve(),
        "p0_contract": Path(args.p0_contract).resolve(),
        "p1_report": Path(args.p1_report).resolve(),
        "p2_adjudication": Path(args.adjudication).resolve(),
    }


def require_input_integrity(
    paths: dict[str, Path],
    p1_report: dict[str, Any],
) -> dict[str, str]:
    for label, path in paths.items():
        if not path.is_file():
            raise FileNotFoundError(f"{label} 不存在：{path}")

    hashes = {label: sha256_file(path) for label, path in paths.items()}
    p1_hashes = p1_report["input_integrity"]["hashes_after"]
    expected = {
        "base_database": p1_hashes["base_database"],
        "user_database": p1_hashes["user_database"],
        "environment_workbench": p1_hashes["environment_workbench"],
        "environment_basemap_semantic": p1_hashes["environment_basemap_semantic"],
        "p0_contract": p1_hashes["p0_contract"],
    }
    mismatches = {
        label: {"expected": digest, "actual": hashes[label]}
        for label, digest in expected.items()
        if hashes[label] != digest
    }
    if mismatches:
        raise ValueError(f"P1 基线哈希已变化，P2停止：{json.dumps(mismatches, ensure_ascii=False)}")
    return hashes


def load_existing_master_rows(
    connection: sqlite3.Connection,
    master_type: str,
) -> list[dict[str, Any]]:
    rows = connection.execute(
        """
        SELECT k.id, k.type, k.code, k.title, k.description, k.status,
               k.stable_key, k.stable_ref, k.public_id,
               MIN(
                 CASE WHEN refs.source_sheet = ? THEN refs.source_row END
               ) AS scene_min_row,
               MIN(refs.source_row) AS any_min_row
        FROM knowledge_items AS k
        LEFT JOIN source_references AS refs
          ON refs.target_type = 'item'
         AND refs.target_id = k.id
        WHERE k.type = ?
        GROUP BY k.id
        ORDER BY
          CASE WHEN scene_min_row IS NULL THEN 1 ELSE 0 END,
          scene_min_row,
          any_min_row,
          k.title,
          k.id
        """,
        (SCENE_SHEET, master_type),
    ).fetchall()
    return [dict(row) for row in rows]


def build_existing_entries(
    *,
    rows: list[dict[str, Any]],
    master_type: str,
    code_prefix: str,
    p1_entries: dict[str, dict[str, Any]],
) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    decisions = []
    allocations = []
    for index, row in enumerate(rows, start=1):
        code = f"{code_prefix}-{index:03d}"
        existing_code = str(row.get("code") or "")
        if existing_code and existing_code != code:
            raise ValueError(
                f"既有非空编号冲突：{row['stable_ref']} expected={code} actual={existing_code}"
            )
        stable_ref = str(row.get("stable_ref") or "")
        public_id = str(row.get("public_id") or "")
        stable_key = str(row.get("stable_key") or "")
        if not stable_ref or not public_id or not stable_key:
            raise ValueError(f"既有主数据身份不完整：{row['id']}")
        p1_entry = p1_entries.get(stable_ref)
        if not p1_entry:
            raise ValueError(f"P1裁定清单缺少既有身份：{stable_ref}")
        decisions.append(
            {
                "master_type": master_type,
                "stable_ref": stable_ref,
                "public_id": public_id,
                "code": code,
                "canonical_title": row["title"],
                "aliases": list(p1_entry.get("aliases") or []),
                "definition": row.get("description") or p1_entry.get("definition"),
                "status": row.get("status") or "active",
                "decision": "reuse",
                "decision_note": "复用P1已确认的既有身份，仅规划补齐空业务编号；不改ID或稳定身份。",
                "context_evidence_refs": list(p1_entry["context_evidence_refs"]),
            }
        )
        allocations.append(
            {
                "master_type": master_type,
                "code": code,
                "database_id": row["id"],
                "stable_key": stable_key,
                "stable_ref": stable_ref,
                "public_id": public_id,
                "canonical_title": row["title"],
                "decision": "reuse",
                "source_order": index,
                "scene_min_row": row.get("scene_min_row"),
                "any_min_row": row.get("any_min_row"),
            }
        )
    return decisions, allocations


def build_segment_type_entries(
    adjudication: dict[str, Any],
    p1_groups: dict[str, dict[str, Any]],
) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    decisions = []
    allocations = []
    for index, entry in enumerate(adjudication["entries"], start=1):
        title = entry["canonical_title"]
        p1_group = p1_groups.get(title)
        if not p1_group:
            raise ValueError(f"P1候选组不存在：{title}")
        planned_refs = sorted(entry["context_segment_refs"])
        actual_refs = sorted(
            instance["segment_stable_ref"] for instance in p1_group["instances"]
        )
        if planned_refs != actual_refs:
            raise ValueError(f"环境子类上下文映射与P1不一致：{title}")
        decisions.append(
            {
                "master_type": "environment_segment_type",
                "stable_ref": entry["stable_ref"],
                "public_id": entry["public_id"],
                "code": entry["code"],
                "canonical_title": title,
                "aliases": list(entry["aliases"]),
                "definition": entry["definition"],
                "status": "active",
                "decision": entry["decision"],
                "decision_note": entry["decision_note"],
                "context_evidence_refs": list(p1_group["context_evidence_refs"]),
            }
        )
        allocations.append(
            {
                "master_type": "environment_segment_type",
                "code": entry["code"],
                "database_id": entry["planned_id"],
                "stable_key": entry["stable_key"],
                "stable_ref": entry["stable_ref"],
                "public_id": entry["public_id"],
                "canonical_title": title,
                "decision": entry["decision"],
                "source_order": index,
                "scene_min_row": None,
                "any_min_row": None,
            }
        )
    return decisions, allocations


def load_segment_contexts(connection: sqlite3.Connection) -> list[dict[str, Any]]:
    rows = connection.execute(
        """
        SELECT segment.id AS segment_id,
               segment.title AS segment_title,
               segment.stable_ref AS segment_stable_ref,
               segment.public_id AS segment_public_id,
               environment.id AS environment_id,
               environment.title AS environment_title,
               environment.stable_ref AS environment_stable_ref,
               relation.id AS belongs_to_relation_id
        FROM knowledge_items AS segment
        JOIN knowledge_relations AS relation
          ON relation.source_item_id = segment.id
         AND relation.relation_type = 'belongs_to'
        JOIN knowledge_items AS environment
          ON environment.id = relation.target_item_id
         AND environment.type = 'information_environment'
        WHERE segment.type = 'environment_segment'
        ORDER BY segment.stable_ref
        """
    ).fetchall()
    contexts = [dict(row) for row in rows]
    counts: dict[str, int] = {}
    for context in contexts:
        ref = context["segment_stable_ref"]
        counts[ref] = counts.get(ref, 0) + 1
    duplicate_refs = sorted(ref for ref, count in counts.items() if count != 1)
    if duplicate_refs:
        raise ValueError(f"segment→environment 关系不是一对一：{duplicate_refs}")
    if len(contexts) != 29:
        raise ValueError(f"环境子类上下文数量不是29：{len(contexts)}")
    return contexts


def build_instance_of_plan(
    connection: sqlite3.Connection,
    adjudication: dict[str, Any],
) -> list[dict[str, Any]]:
    existing_count = connection.execute(
        "SELECT COUNT(*) FROM knowledge_relations WHERE relation_type = 'instance_of'"
    ).fetchone()[0]
    if existing_count:
        raise ValueError(f"正式库已存在 {existing_count} 条 instance_of，P2停止")

    contexts = load_segment_contexts(connection)
    context_by_ref = {row["segment_stable_ref"]: row for row in contexts}
    target_by_context_ref: dict[str, dict[str, Any]] = {}
    for target in adjudication["entries"]:
        for context_ref in target["context_segment_refs"]:
            if context_ref in target_by_context_ref:
                raise ValueError(f"上下文被多次裁定：{context_ref}")
            target_by_context_ref[context_ref] = target
    if set(context_by_ref) != set(target_by_context_ref):
        raise ValueError("29个环境子类上下文未被裁定清单完整覆盖")

    plan = []
    for source_ref in sorted(context_by_ref):
        context = context_by_ref[source_ref]
        target = target_by_context_ref[source_ref]
        stable_key = (
            f"{context['segment_public_id']}:instance_of:{target['public_id']}"
        )
        stable_ref = f"base_relation:instance_of:{stable_key}"
        plan.append(
            {
                "planned_relation_id": str(
                    uuid.uuid5(uuid.NAMESPACE_URL, stable_ref)
                ),
                "stable_key": stable_key,
                "stable_ref": stable_ref,
                "public_id": stable_public_id("kr", stable_ref),
                "relation_type": "instance_of",
                "relation_label": "实例归属",
                "source_item_id": context["segment_id"],
                "source_stable_ref": context["segment_stable_ref"],
                "source_public_id": context["segment_public_id"],
                "source_title": context["segment_title"],
                "environment_id": context["environment_id"],
                "environment_stable_ref": context["environment_stable_ref"],
                "environment_title": context["environment_title"],
                "target_planned_id": target["planned_id"],
                "target_stable_ref": target["stable_ref"],
                "target_public_id": target["public_id"],
                "target_code": target["code"],
                "target_title": target["canonical_title"],
                "decision": "create",
                "formal_apply_authorized": False,
            }
        )
    return plan


def validate_plan(
    decisions: list[dict[str, Any]],
    allocations: list[dict[str, Any]],
    instance_plan: list[dict[str, Any]],
) -> dict[str, Any]:
    blockers = []
    expected_counts = {
        "information_environment": 10,
        "environment_segment_type": 16,
        "information_object": 51,
    }
    actual_counts = {
        master_type: sum(
            1 for entry in decisions if entry["master_type"] == master_type
        )
        for master_type in expected_counts
    }
    if actual_counts != expected_counts:
        blockers.append(
            f"主数据数量不一致：expected={expected_counts}, actual={actual_counts}"
        )
    for field in ("code", "stable_ref", "public_id"):
        values = [entry[field] for entry in decisions]
        if len(values) != len(set(values)):
            blockers.append(f"裁定清单存在重复 {field}")
    blocking_decisions = [
        entry["code"]
        for entry in decisions
        if entry["decision"] in {"merge_review", "split_review", "hold"}
    ]
    if blocking_decisions:
        blockers.append(f"仍有未完成裁定：{blocking_decisions}")
    if len(allocations) != 77:
        blockers.append(f"编号分配不是77条：{len(allocations)}")
    if len(instance_plan) != 29:
        blockers.append(f"instance_of计划不是29条：{len(instance_plan)}")
    source_refs = [row["source_stable_ref"] for row in instance_plan]
    if len(source_refs) != len(set(source_refs)):
        blockers.append("instance_of计划存在重复来源端")
    return {
        "result": "ready_for_p3_temp_apply" if not blockers else "blocked",
        "blockers": blockers,
        "formal_apply_authorized": False,
        "master_counts": actual_counts,
        "master_code_count": len(allocations),
        "existing_master_code_backfill_count": sum(
            1 for row in allocations if row["decision"] == "reuse"
        ),
        "new_segment_type_count": sum(
            1
            for row in allocations
            if row["master_type"] == "environment_segment_type"
        ),
        "unnumbered_context_instance_count_by_design": 29,
        "instance_of_plan_count": len(instance_plan),
    }


def markdown_report(plan: dict[str, Any]) -> str:
    gate = plan["gate"]
    return "\n".join(
        [
            "# PLAN-ENV-MD P2 业务裁定与导入修复报告",
            "",
            f"- run_id: `{plan['run_id']}`",
            f"- generated_at: `{plan['generated_at']}`",
            f"- gate: `{gate['result']}`",
            "- formal_apply_authorized: `false`",
            "",
            "## 结果",
            "",
            "- 10 条信息化环境复用既有身份并规划 `IE-001`—`IE-010`。",
            "- 51 条信息化对象复用既有身份并规划 `IO-001`—`IO-051`。",
            "- 16 个环境子类候选全部完成语义裁定，新增类型规划为 `ES-001`—`ES-016`。",
            "- 29 个 `environment_segment` 是上下文实例，不分配主数据编号；每个实例已精确规划一条 `instance_of`。",
            "- 当前总计 77 条主数据业务编号，其中 61 条为既有身份补空编号、16 条为新增类型。",
            "",
            "## 边界",
            "",
            "- 本阶段只写合同、代码、测试和 `worker-verify` 报告。",
            "- 正式基础库、用户库、源 Excel、环境工作台包与底图语义文件保持只读。",
            "- P3 才会在基础库副本执行 apply/重复 apply/rollback；P6 仍需单独授权正式 apply。",
            "",
            "## 门禁",
            "",
            f"- blockers: `{len(gate['blockers'])}`",
            f"- instance_of plan: `{gate['instance_of_plan_count']}`",
            f"- master codes: `{gate['master_code_count']}`",
            "- P1 的“90条缺编号”是当前记录层观察值；P2 明确拆分为 61 条主数据补码与 29 条不编号的上下文实例。",
            "",
        ]
    )


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Build PLAN-ENV-MD P2 adjudication, code allocation, and instance_of plans."
    )
    parser.add_argument("--p1-report", default=str(DEFAULT_P1_REPORT))
    parser.add_argument("--base-db", default=str(DEFAULT_BASE_DB))
    parser.add_argument("--user-db", default=str(DEFAULT_USER_DB))
    parser.add_argument("--source-workbook", default=str(DEFAULT_WORKBOOK))
    parser.add_argument("--environment-workbench", default=str(DEFAULT_WORKBENCH))
    parser.add_argument("--environment-basemap", default=str(DEFAULT_BASEMAP))
    parser.add_argument("--p0-contract", default=str(DEFAULT_P0_CONTRACT))
    parser.add_argument("--adjudication", default=str(DEFAULT_ADJUDICATION))
    parser.add_argument("--output-root", default=str(DEFAULT_OUTPUT_ROOT))
    parser.add_argument("--run-id")
    args = parser.parse_args()

    started = utc_now()
    run_id = args.run_id or f"p2-{started.strftime('%Y%m%dT%H%M%SZ')}"
    output_dir = Path(args.output_root).resolve() / run_id
    output_dir.mkdir(parents=True, exist_ok=False)

    paths = input_paths(args)
    p1_report = read_json(paths["p1_report"])
    hashes_before = require_input_integrity(paths, p1_report)
    p1_manifest_path = paths["p1_report"].parent / "master-data-decision-manifest.p1.json"
    p1_manifest = read_json(p1_manifest_path)
    adjudication = read_json(paths["p2_adjudication"])
    if adjudication.get("formal_apply_authorized") is not False:
        raise ValueError("P2裁定清单必须保持 formal_apply_authorized=false")

    p1_entries = {
        entry["stable_ref"]: entry
        for entry in p1_manifest["entries"]
        if entry.get("stable_ref")
    }
    p1_groups = {
        group["normalized_title"]: group for group in p1_report["segment_title_groups"]
    }

    with connect_read_only(paths["base_database"]) as connection:
        environment_decisions, environment_allocations = build_existing_entries(
            rows=load_existing_master_rows(connection, "information_environment"),
            master_type="information_environment",
            code_prefix="IE",
            p1_entries=p1_entries,
        )
        object_decisions, object_allocations = build_existing_entries(
            rows=load_existing_master_rows(connection, "information_object"),
            master_type="information_object",
            code_prefix="IO",
            p1_entries=p1_entries,
        )
        segment_decisions, segment_allocations = build_segment_type_entries(
            adjudication,
            p1_groups,
        )
        instance_plan = build_instance_of_plan(connection, adjudication)

    decisions = environment_decisions + segment_decisions + object_decisions
    allocations = (
        environment_allocations + segment_allocations + object_allocations
    )
    gate = validate_plan(decisions, allocations, instance_plan)
    generated_at = iso_utc(started)
    decision_manifest = {
        "schema_version": "environment-master-data-decision-manifest-v1",
        "run_id": run_id,
        "generated_at": generated_at,
        "source_baseline": {
            "database_sha256": hashes_before["base_database"],
            "environment_workbench_sha256": hashes_before[
                "environment_workbench"
            ],
        },
        "entries": decisions,
    }
    plan = {
        "schema_version": "environment-master-data-p2-plan-v1",
        "plan_id": "PLAN-ENV-MD",
        "phase": "P2",
        "run_id": run_id,
        "generated_at": generated_at,
        "source_p1_run_id": p1_report["run_id"],
        "input_integrity": {
            "hashes_before": hashes_before,
            "protected_paths": [
                "base_database",
                "user_database",
                "source_workbook",
                "environment_workbench",
                "environment_basemap_semantic",
            ],
        },
        "identity_policy": {
            "master_codes": 77,
            "existing_master_backfills": 61,
            "new_environment_segment_types": 16,
            "context_instances_without_master_code": 29,
            "runtime_derivation_forbidden": True,
        },
        "gate": gate,
    }

    decision_path = output_dir / "master-data-decision-manifest.p2.json"
    allocation_path = output_dir / "master-code-allocation.csv"
    instance_json_path = output_dir / "instance-of-plan.json"
    instance_csv_path = output_dir / "instance-of-plan.csv"
    plan_json_path = output_dir / "p2-plan.json"
    plan_md_path = output_dir / "p2-plan.md"
    write_json(decision_path, decision_manifest)
    write_csv(
        allocation_path,
        [
            "master_type",
            "code",
            "database_id",
            "stable_key",
            "stable_ref",
            "public_id",
            "canonical_title",
            "decision",
            "source_order",
            "scene_min_row",
            "any_min_row",
        ],
        allocations,
    )
    write_json(
        instance_json_path,
        {
            "schema_version": "environment-master-data-instance-of-plan-v1",
            "run_id": run_id,
            "generated_at": generated_at,
            "formal_apply_authorized": False,
            "relations": instance_plan,
        },
    )
    write_csv(
        instance_csv_path,
        list(instance_plan[0].keys()),
        instance_plan,
    )
    hashes_after = {
        label: sha256_file(path) for label, path in paths.items()
    }
    plan["input_integrity"]["hashes_after"] = hashes_after
    plan["input_integrity"]["protected_inputs_unchanged"] = all(
        hashes_before[label] == hashes_after[label]
        for label in plan["input_integrity"]["protected_paths"]
    )
    if not plan["input_integrity"]["protected_inputs_unchanged"]:
        plan["gate"]["result"] = "blocked"
        plan["gate"]["blockers"].append("P2运行期间保护输入发生变化")
    write_json(plan_json_path, plan)
    plan_md_path.write_text(markdown_report(plan), encoding="utf-8")

    output_files = [
        decision_path,
        allocation_path,
        instance_json_path,
        instance_csv_path,
        plan_json_path,
        plan_md_path,
    ]
    manifest = {
        "schema_version": "worker-verify-manifest-v1",
        "run_id": run_id,
        "generated_at": generated_at,
        "formal_apply_authorized": False,
        "files": [
            {
                "path": str(path.relative_to(output_dir)),
                "sha256": sha256_file(path),
                "size": path.stat().st_size,
            }
            for path in output_files
        ],
    }
    write_json(output_dir / "manifest.json", manifest)
    print(
        json.dumps(
            {
                "output_dir": str(output_dir),
                "gate": plan["gate"],
                "protected_inputs_unchanged": plan["input_integrity"][
                    "protected_inputs_unchanged"
                ],
            },
            ensure_ascii=False,
            indent=2,
        )
    )
    return 0 if plan["gate"]["result"] == "ready_for_p3_temp_apply" else 1


if __name__ == "__main__":
    raise SystemExit(main())
