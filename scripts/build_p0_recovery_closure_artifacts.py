#!/usr/bin/env python3
"""Build P0 recovery closure snapshot and governance artifacts.

This script is intentionally conservative: it only copies current files into a
worker-verify snapshot and writes review artifacts. It does not rebuild source
data, run ETL, mutate SQLite, or touch raw Excel / Draw.io sources.
"""

from __future__ import annotations

import hashlib
import json
import shutil
import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
WORKER_VERIFY = ROOT / "data" / "exports" / "worker-verify"
SNAPSHOT_DIR = WORKER_VERIFY / "p0-recovery-stable-snapshot"
SNAPSHOT_FILES_DIR = SNAPSHOT_DIR / "files"


PROTECTED_BASELINE_FILES = {
    "frontend/capability-browser/public/data/maintenance-knowledge.json",
    "frontend/capability-browser/public/data/maintenance-index.json",
    "frontend/capability-browser/public/data/lifecycle-knowledge.json",
    "frontend/capability-browser/public/data/standards-data.json",
    "frontend/capability-browser/public/data/standards-index.json",
}

WORKBENCH_PROJECTION_FILES = {
    "frontend/capability-browser/public/data/capability-tree.json",
    "frontend/capability-browser/public/data/capability-workbench.json",
    "frontend/capability-browser/public/data/lifecycle-workbench.json",
    "frontend/capability-browser/public/data/environment-workbench.json",
    "frontend/capability-browser/generated/environmentBasemap.node-details.json",
}

EXPECTED_MAYBE_MISSING = [
    "frontend/capability-browser/public/data/management-knowledge.json",
]

EXPLICIT_FRONTEND_FILES = [
    "frontend/capability-browser/public/data/maintenance-knowledge.json",
    "frontend/capability-browser/public/data/maintenance-index.json",
    "frontend/capability-browser/public/data/management-knowledge.json",
    "frontend/capability-browser/public/data/capability-tree.json",
    "frontend/capability-browser/public/data/capability-workbench.json",
    "frontend/capability-browser/public/data/lifecycle-knowledge.json",
    "frontend/capability-browser/public/data/lifecycle-workbench.json",
    "frontend/capability-browser/public/data/environment-workbench.json",
    "frontend/capability-browser/generated/environmentBasemap.node-details.json",
    "frontend/capability-browser/public/data/standards-data.json",
    "frontend/capability-browser/public/data/standards-index.json",
]

SNAPSHOT_DIRS = [
    "frontend/capability-browser/public/data/maintenance",
    "frontend/capability-browser/public/data/source-evidence/maintenance",
    "frontend/capability-browser/public/data/standards",
]

SCRIPT_FILES = [
    "src/sapd_wiki/cli.py",
    "src/sapd_wiki/exports.py",
    "src/sapd_wiki/parsers.py",
    "scripts/audit_p0_baseline_incident_impact.py",
    "scripts/audit_dictionary_standard_baseline_integrity.py",
    "scripts/audit_protected_baseline_no_regression.py",
    "scripts/audit_p0_capability_work_binding.py",
    "scripts/audit_json_package_boundary.py",
    "scripts/frontend_content_smoke_check.mjs",
    "scripts/frontend_smoke_check.mjs",
]

GOVERNANCE_FILES = [
    "AGENTS.md",
    "CURRENT_STATE.md",
    "progress.md",
    "findings.md",
    "docs/06-implementation/open-issues.md",
    "docs/07-governance/data-governance.md",
    "task_plan.md",
]

SQLITE_FILE = "data/database/sapd_wiki.sqlite3"


def now_iso() -> str:
    return datetime.now(timezone.utc).astimezone().isoformat(timespec="seconds")


def rel(path: Path) -> str:
    return path.relative_to(ROOT).as_posix()


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def read_json(path: Path) -> Any:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return None


def listify(value: Any) -> list[Any]:
    return value if isinstance(value, list) else []


def mapping(value: Any) -> dict[str, Any]:
    return value if isinstance(value, dict) else {}


def compact_counts(value: Any) -> dict[str, int]:
    if not isinstance(value, dict):
        return {}
    return {str(k): int(v) for k, v in value.items() if isinstance(v, (int, float)) and not isinstance(v, bool)}


def collect_files() -> tuple[list[str], list[str]]:
    files = set([SQLITE_FILE, *EXPLICIT_FRONTEND_FILES, *SCRIPT_FILES, *GOVERNANCE_FILES])
    missing = []
    for directory in SNAPSHOT_DIRS:
        base = ROOT / directory
        if not base.exists():
            missing.append(directory)
            continue
        for path in base.rglob("*"):
            if path.is_file():
                files.add(rel(path))
    for path in EXPECTED_MAYBE_MISSING:
        if not (ROOT / path).exists():
            missing.append(path)
    existing = sorted(path for path in files if (ROOT / path).exists())
    return existing, sorted(set(missing))


def classify_file(path: str) -> dict[str, Any]:
    protected = path in PROTECTED_BASELINE_FILES or path.startswith("frontend/capability-browser/public/data/maintenance/") or path.startswith(
        "frontend/capability-browser/public/data/source-evidence/maintenance/"
    ) or path.startswith("frontend/capability-browser/public/data/standards/")
    workbench = path in WORKBENCH_PROJECTION_FILES
    if protected:
        return {
            "dataType": "protected_baseline",
            "protectedBaseline": True,
            "allowFutureModification": False,
            "modificationRule": "只读基线；修改必须用户明确授权，业务模块只能引用或输出 issue。",
        }
    if workbench:
        return {
            "dataType": "workbench_projection",
            "protectedBaseline": False,
            "allowFutureModification": True,
            "modificationRule": "仅允许确认后的定向重建；必须先备份、后 diff、再验证，不得反向写回基线。",
        }
    if path == SQLITE_FILE:
        return {
            "dataType": "sqlite_current_state",
            "protectedBaseline": False,
            "allowFutureModification": False,
            "modificationRule": "当前 SQLite 仍有保护基线缺失风险；不得作为完整字典 / 标准重导来源，修改需用户确认。",
        }
    if path.startswith("scripts/") or path.startswith("src/"):
        return {
            "dataType": "recovery_script",
            "protectedBaseline": False,
            "allowFutureModification": True,
            "modificationRule": "只允许治理、防护和审计类小步修改；修改后必须运行语法检查和相关审计。",
        }
    if path.endswith(".md"):
        return {
            "dataType": "governance_document",
            "protectedBaseline": False,
            "allowFutureModification": True,
            "modificationRule": "允许记录事实、边界和风险；不得把文档结论当作数据修复授权。",
        }
    return {
        "dataType": "snapshot_file",
        "protectedBaseline": False,
        "allowFutureModification": False,
        "modificationRule": "当前快照文件，仅用于恢复和比对。",
    }


def copy_snapshot_files(paths: list[str]) -> list[dict[str, Any]]:
    entries = []
    for item in paths:
        source = ROOT / item
        target = SNAPSHOT_FILES_DIR / item
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source, target)
        stat = source.stat()
        entries.append(
            {
                "path": item,
                "snapshotPath": rel(target),
                "sha256": sha256_file(source),
                "sizeBytes": stat.st_size,
                **classify_file(item),
            }
        )
    return entries


def sqlite_report() -> dict[str, Any]:
    db_path = ROOT / SQLITE_FILE
    if not db_path.exists():
        return {"path": SQLITE_FILE, "exists": False}
    table_counts = {}
    with sqlite3.connect(db_path) as conn:
        conn.row_factory = sqlite3.Row
        rows = conn.execute(
            "SELECT name, type FROM sqlite_master WHERE type IN ('table', 'view') AND name NOT LIKE 'sqlite_%' ORDER BY type, name"
        ).fetchall()
        for row in rows:
            name = row["name"]
            if row["type"] == "table":
                try:
                    table_counts[name] = int(conn.execute(f'SELECT COUNT(*) FROM "{name}"').fetchone()[0])
                except sqlite3.Error:
                    table_counts[name] = None
        protected_types = [
            "work_function_layer",
            "work_function",
            "security_work",
            "process_reference",
            "application_system_type",
            "standard_control",
        ]
        protected_type_counts = {}
        for object_type in protected_types:
            try:
                value = conn.execute("SELECT COUNT(*) FROM knowledge_item WHERE type = ?", (object_type,)).fetchone()[0]
                protected_type_counts[object_type] = int(value)
            except sqlite3.Error:
                protected_type_counts[object_type] = None
    return {
        "path": SQLITE_FILE,
        "exists": True,
        "sha256": sha256_file(db_path),
        "sizeBytes": db_path.stat().st_size,
        "tableCount": len(table_counts),
        "tableCounts": table_counts,
        "protectedTypeCounts": protected_type_counts,
        "risk": "当前 SQLite 仍有 protected baseline 类型缺失警告，不得作为字典 / 标准完整重导来源。",
    }


def count_json_packages() -> dict[str, Any]:
    maintenance = mapping(read_json(ROOT / "frontend/capability-browser/public/data/maintenance-knowledge.json"))
    capability_tree = mapping(read_json(ROOT / "frontend/capability-browser/public/data/capability-tree.json"))
    capability_workbench = mapping(read_json(ROOT / "frontend/capability-browser/public/data/capability-workbench.json"))
    lifecycle_workbench = mapping(read_json(ROOT / "frontend/capability-browser/public/data/lifecycle-workbench.json"))
    environment_workbench = mapping(read_json(ROOT / "frontend/capability-browser/public/data/environment-workbench.json"))
    standards_index = mapping(read_json(ROOT / "frontend/capability-browser/public/data/standards-index.json"))
    standards_data = mapping(read_json(ROOT / "frontend/capability-browser/public/data/standards-data.json"))
    node_details = read_json(ROOT / "frontend/capability-browser/generated/environmentBasemap.node-details.json")

    focuses = []
    for category in listify(capability_tree.get("categories")):
        for domain in listify(mapping(category).get("domains")):
            for capability in listify(mapping(domain).get("capabilities")):
                focuses.extend(listify(mapping(capability).get("focuses")))
    security_work_focuses = sum(1 for focus in focuses if listify(mapping(focus).get("security_works")))
    process_mapping_focuses = sum(1 for focus in focuses if listify(mapping(focus).get("process_mappings")))

    relationship_counts = {}
    for group in listify(capability_workbench.get("relationshipGroups") or capability_workbench.get("relationship_groups")):
        group_id = mapping(group).get("id") or mapping(group).get("type")
        relationship_counts[str(group_id)] = int(
            mapping(group).get("count")
            or len(listify(mapping(group).get("relationIds")))
            or len(listify(mapping(group).get("relationships")))
            or len(listify(mapping(group).get("relations")))
        )

    standards_split = {}
    standards_dir = ROOT / "frontend/capability-browser/public/data/standards"
    if standards_dir.exists():
        for path in sorted(standards_dir.rglob("*.json")):
            data = read_json(path)
            standards_split[rel(path)] = len(listify(mapping(data).get("rows")))

    if isinstance(node_details, list):
        node_detail_count = len(node_details)
    elif isinstance(node_details, dict):
        node_stats = mapping(node_details.get("stats"))
        node_detail_count = int(
            node_stats.get("detailReadyNodes")
            or node_stats.get("nodeDetails")
            or len(mapping(node_details.get("nodeDetailsByMxId")))
            or len(listify(node_details.get("nodes") or node_details.get("details") or node_details.get("items")))
        )
    else:
        node_detail_count = 0

    return {
        "maintenance": compact_counts(maintenance.get("stats")) | {
            "security_works": len(listify(maintenance.get("security_works"))),
            "security_processes": len(listify(maintenance.get("security_processes"))),
            "work_function_layers": len(listify(maintenance.get("work_function_layers"))),
        },
        "capabilityTree": {
            "focuses": len(focuses),
            "securityWorkFocuses": security_work_focuses,
            "processMappingFocuses": process_mapping_focuses,
        },
        "capabilityWorkbench": {
            "objectCounts": compact_counts(mapping(capability_workbench.get("meta")).get("stats")),
            "relationshipCounts": relationship_counts,
        },
        "lifecycleWorkbench": compact_counts(mapping(lifecycle_workbench.get("meta")).get("stats")),
        "environmentWorkbench": compact_counts(mapping(environment_workbench.get("meta")).get("stats")),
        "environmentBasemapNodeDetails": {"detailReadyNodes": node_detail_count},
        "standards": compact_counts(standards_index.get("stats")) | compact_counts(standards_data.get("stats")),
        "standardsSplitRows": standards_split,
    }


def write_json(path: Path, value: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def write_text(path: Path, content: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content.strip() + "\n", encoding="utf-8")


def markdown_table(headers: list[str], rows: list[list[Any]]) -> str:
    lines = ["| " + " | ".join(headers) + " |", "| " + " | ".join(["---"] * len(headers)) + " |"]
    for row in rows:
        lines.append("| " + " | ".join(str(value).replace("\n", " ") for value in row) + " |")
    return "\n".join(lines)


def build_boundary(generated_at: str) -> dict[str, Any]:
    return {
        "generatedAt": generated_at,
        "title": "P0 Recovery Modification Boundary",
        "rule": "在用户重新授权前，暂停 Environment Mapping 后续治理、正式 UI 字段对齐、reimport、maturity 和新页面任务。",
        "classes": [
            {
                "id": "A",
                "name": "Protected Baseline，只读基线",
                "objects": [
                    "知识库字典",
                    "安全标准 / 框架",
                    "安全能力清单",
                    "安全能力作用域目录",
                    "安全技术服务清单",
                    "安全技术模块 / 措施清单",
                    "安全管理工作 / 流程清单",
                    "安全职能清单",
                    "应用系统目录",
                    "GB/T 42446-2023",
                    "Gartner 岗位参考",
                    "NIST CSF 2.0",
                    "ISO/IEC 27001:2022",
                    "DSP SCF 2026",
                    "CIS CSC v8",
                    "等级保护三级",
                ],
                "rules": [
                    "业务模块只能引用，不得反向改写。",
                    "不得通过环境映射、能力映射、LC-AP、LC-DT、临时核对表自动修正。",
                    "发现不一致只能输出 issue / audit report。",
                    "修改必须用户明确授权。",
                ],
            },
            {
                "id": "B",
                "name": "Workbench Projection，可重建投影",
                "objects": [
                    "capability-workbench.json",
                    "environment-workbench.json",
                    "lifecycle-workbench.json",
                    "capability-tree.json",
                    "environmentBasemap.node-details.json",
                ],
                "rules": [
                    "只能由确认后的基准数据和映射表定向重建。",
                    "不得全量重建。",
                    "每次重建必须先备份、后 diff、再验证。",
                    "不得写回 A 类基线。",
                ],
            },
            {
                "id": "C",
                "name": "Review / Worker-verify，仅审计临时数据",
                "objects": ["data/exports/worker-verify/*", "frontend/capability-browser/public/data/review/*"],
                "rules": [
                    "可以包含 source row / sourceCells / mergedRanges / debug evidence。",
                    "不得进入正式业务页面。",
                    "不得作为正式事实源。",
                ],
            },
            {
                "id": "D",
                "name": "禁止触碰数据",
                "objects": ["原始 Excel", "Draw.io / SVG", "数据库 schema", "胶囊样式", "maturity / Phase 7 数据"],
                "rules": ["除非用户明确授权，否则不得修改。"],
            },
        ],
    }


def build_root_cause(generated_at: str, counts: dict[str, Any]) -> dict[str, Any]:
    return {
        "generatedAt": generated_at,
        "title": "P0 Baseline Incident Root Cause Analysis",
        "directCauses": [
            "`bootstrap-local-data --profile core --reset` 将当前 SQLite 重置为 core-only。",
            "后续导出导致字典 / 标准 JSON 结构存在但关键数组为空。",
            "`standards-data.json` / `standards-index.json` 中 `dataPath` 出现 `/private/tmp/...` 本机绝对路径，浏览器无法通过 5173 加载标准分片。",
            "页面 smoke 主要检查 HTTP 200，没有检查关键内容非空。",
            "部分页面 `viewModel` / `dataClient` 仍读旧字段或旧投影，导致包有数据但页面仍空。",
        ],
        "deepCauses": [
            "未严格区分 core profile 与完整知识库 profile。",
            "reset 命令缺少 protected baseline guard，事故后才补上。",
            "SQLite、前端 JSON、workbench 投影之间缺少强制完整性检查。",
            "字典 / 标准只读基线边界过去没有被工具强制执行。",
            "JSON 分拆边界缺少专门审计。",
            "内容级 smoke 缺失。",
            "恢复流程一度扩大成全量恢复，导致没问题数据可能被旧备份替代。",
        ],
        "impactScope": [
            {"area": "知识库字典", "status": "页面数据已恢复", "manualValidationNeeded": True, "risk": "需确认当前显示数据与原始来源一致。"},
            {"area": "安全标准 / 框架", "status": "页面加载已恢复", "manualValidationNeeded": True, "risk": "标准控制项映射准确性仍需抽样核对。"},
            {"area": "LC-AP / LC-DT", "status": "smoke 通过", "manualValidationNeeded": True, "risk": "relations=542 是否与原始生命周期表完全一致仍需人工核对。"},
            {"area": "安全能力映射管理视角", "status": "投影恢复", "manualValidationNeeded": True, "risk": "安全工作 / 职能 / 流程是否过度映射仍需抽样。"},
            {"area": "安全能力映射标准映射", "status": "投影恢复", "manualValidationNeeded": True, "risk": "不能把 standards 全量 controls 误认为关注点映射。"},
        ],
        "affectedPackages": [
            "maintenance-knowledge.json",
            "maintenance/*",
            "standards-index.json",
            "standards-data.json",
            "standards/*",
            "lifecycle-workbench.json",
            "capability-tree.json",
            "capability-workbench.json",
        ],
        "affectedScripts": [
            "src/sapd_wiki/cli.py",
            "src/sapd_wiki/exports.py",
            "frontend/capability-browser/dataClient.js",
            "frontend/capability-browser/viewModels.js",
            "scripts/frontend_content_smoke_check.mjs",
        ],
        "mitigationsApplied": [
            "core reset guard",
            "dataPath 相对路径修复",
            "content smoke",
            "security_works 恢复",
            "capability 管理视角 / 标准映射恢复",
            "lifecycle workbench 恢复",
            "protected baseline audit",
            "no-regression audit",
        ],
        "remainingRisks": [
            "当前 SQLite 仍有 warnings，不能作为完整基线直接重导来源。",
            "页面恢复不等于数据准确性确认。",
            "安全能力映射管理视角和标准映射仍需要抽样核对。",
            "标准映射是否完全正确仍需对照原始映射源。",
            "2026-06-01 备份与当前恢复后的前端包差异仍需留档。",
        ],
        "currentKeyCounts": counts,
    }


def build_prevention(generated_at: str) -> dict[str, Any]:
    return {
        "generatedAt": generated_at,
        "title": "P0 Baseline Long-term Prevention Plan",
        "protections": [
            {
                "id": "cli_guard",
                "title": "CLI 防护",
                "requirements": [
                    "`bootstrap-local-data --profile core --reset` 默认阻断 protected baseline 场景。",
                    "允许执行必须显式传入 `--allow-protected-baseline-reset`。",
                    "执行前自动备份当前 SQLite 和正式 JSON。",
                    "reset 后自动运行 baseline integrity audit，audit 失败返回非 0。",
                    "日志中输出强警告。",
                ],
                "currentStatus": "已实现基础阻断；仍需后续补强自动 JSON 备份和失败返回链路的回归测试。",
            },
            {
                "id": "export_guard",
                "title": "导出防护",
                "requirements": [
                    "写入关键 JSON 前读取当前 hash。",
                    "导出后输出前后计数 diff。",
                    "关键数组从非 0 变成 0 时阻断。",
                    "不允许写入本机绝对路径。",
                    "不允许全量导出覆盖不相关模块。",
                    "必须遵守 JSON 分拆原则。",
                ],
                "currentStatus": "已修复 standards dataPath；关键数组非 0 审计已覆盖，导出前后 diff 仍需进一步工具化。",
            },
            {
                "id": "json_boundary_audit",
                "title": "数据包分拆审计",
                "requirements": [
                    "字典数据不得被写入 workbench。",
                    "worker-verify 字段不得进入正式数据包。",
                    "标准数据不得被环境映射覆盖。",
                    "workbench 不得反向写回基准包。",
                    "新增或合并 `scripts/audit_json_package_boundary.py`。",
                ],
                "currentStatus": "本轮已新增 `scripts/audit_json_package_boundary.py` 基础审计；后续可继续扩展更细的跨包引用规则。",
            },
            {
                "id": "content_smoke",
                "title": "内容级 smoke",
                "requirements": [
                    "页面关键计数非 0。",
                    "页面没有 loading 或全页暂无。",
                    "标准页面分片加载成功。",
                    "能力映射管理视角有有效 rows。",
                    "能力映射标准映射有真实映射或明确 issue。",
                    "安全工作清单有安全工作。",
                    "LC-AP / LC-DT 有数据。",
                ],
                "currentStatus": "`scripts/frontend_content_smoke_check.mjs` 已覆盖当前 P0 核心内容。",
            },
            {
                "id": "recovery_workflow",
                "title": "恢复流程防护",
                "requirements": [
                    "先分类。",
                    "再备份。",
                    "再选择性恢复。",
                    "再 diff。",
                    "再内容级验证。",
                    "不得全量恢复。",
                    "区分已确认故障数据、未故障但被动过的数据、禁止触碰数据、只读比对通过数据。",
                ],
                "currentStatus": "本轮快照和边界文件作为新的恢复流程基线。",
            },
        ],
    }


def write_boundary_artifacts(boundary: dict[str, Any]) -> None:
    write_json(WORKER_VERIFY / "p0-recovery-modification-boundary.json", boundary)
    rows = []
    for item in boundary["classes"]:
        rows.append([item["id"], item["name"], "；".join(item["objects"]), "；".join(item["rules"])])
    write_text(
        WORKER_VERIFY / "p0-recovery-modification-boundary.md",
        f"""# P0 恢复后修改边界

生成时间：`{boundary['generatedAt']}`

总规则：{boundary['rule']}

{markdown_table(['类别', '名称', '对象', '规则'], rows)}
""",
    )


def write_root_cause_artifacts(report: dict[str, Any]) -> None:
    write_json(WORKER_VERIFY / "p0-root-cause-analysis.json", report)
    impact_rows = [[item["area"], item["status"], "是" if item["manualValidationNeeded"] else "否", item["risk"]] for item in report["impactScope"]]
    write_text(
        WORKER_VERIFY / "p0-root-cause-analysis.md",
        f"""# P0 数据基线事故根因分析

生成时间：`{report['generatedAt']}`

## 直接原因

{chr(10).join(f'- {item}' for item in report['directCauses'])}

## 深层原因

{chr(10).join(f'- {item}' for item in report['deepCauses'])}

## 影响范围

{markdown_table(['范围', '当前状态', '需人工核对', '剩余风险'], impact_rows)}

## 受影响数据包

{chr(10).join(f'- `{item}`' for item in report['affectedPackages'])}

## 受影响脚本

{chr(10).join(f'- `{item}`' for item in report['affectedScripts'])}

## 已采取措施

{chr(10).join(f'- {item}' for item in report['mitigationsApplied'])}

## 未完成风险

{chr(10).join(f'- {item}' for item in report['remainingRisks'])}
""",
    )


def write_prevention_artifacts(plan: dict[str, Any]) -> None:
    write_json(WORKER_VERIFY / "p0-prevention-plan.json", plan)
    sections = []
    for item in plan["protections"]:
        sections.append(
            f"""## {item['title']}

当前状态：{item['currentStatus']}

{chr(10).join(f'- {req}' for req in item['requirements'])}
"""
        )
    write_text(
        WORKER_VERIFY / "p0-prevention-plan.md",
        f"""# P0 长期防复发方案

生成时间：`{plan['generatedAt']}`

{chr(10).join(sections)}
""",
    )


def write_manual_validation_plan(generated_at: str) -> None:
    write_text(
        WORKER_VERIFY / "p0-post-recovery-manual-validation-plan.md",
        f"""# P0 恢复后人工数据准确性核对计划

生成时间：`{generated_at}`

页面恢复只说明数据链路重新可用，不等于数据准确性已经被人工确认。建议先暂停继续开发，完成以下抽样核对。

## 1. 安全能力映射管理视角

抽样对象：

- `T`
- `T-AS`
- `G-SP`
- 至少 3 个 L2 能力
- 至少 5 个 L3 关注点

核对项：

- 安全工作是否正确；
- 职能是否正确；
- L2 / L3 / L4 流程是否正确；
- 是否有错误“暂无”；
- 是否有过度映射。

## 2. 标准 / 框架映射

抽样对象：

- `T-AS.AD-01`
- `G-SP` 下一个关注点；
- 至少 5 个有标准映射的关注点。

核对项：

- 标准 / 框架来源是否正确；
- 控制项是否与原始映射一致；
- 是否把 standards 全量 controls 误当成映射；
- 是否存在缺失或过度映射。

## 3. 安全工作 / 流程清单

核对项：

- `security_works=80` 是否与原始来源一致；
- `security_processes=10` 是否与原始来源一致；
- `work_function_layers=4` 是否正确；
- 安全工作与流程之间的关系是否正确。

## 4. LC-AP / LC-DT

核对项：

- `lifecycle-workbench relations=542` 是否合理；
- LC-AP / LC-DT 页面展示是否与原始生命周期表一致；
- 是否有全量恢复或回退导致的数据旧化。
""",
    )


def write_manifest(manifest: dict[str, Any]) -> None:
    write_json(SNAPSHOT_DIR / "snapshot-manifest.json", manifest)
    rows = [
        [
            item["path"],
            item["dataType"],
            item["sha256"][:16],
            item["sizeBytes"],
            "是" if item["protectedBaseline"] else "否",
            "是" if item["allowFutureModification"] else "否",
        ]
        for item in manifest["files"]
    ]
    write_text(
        SNAPSHOT_DIR / "snapshot-manifest.md",
        f"""# P0 Recovery Stable Snapshot Manifest

生成时间：`{manifest['generatedAt']}`

快照目录：`{rel(SNAPSHOT_DIR)}`

## 关键计数

```json
{json.dumps(manifest['keyCounts'], ensure_ascii=False, indent=2)}
```

## 缺失但已记录的预期文件

{chr(10).join(f'- `{item}`' for item in manifest['missingExpectedFiles']) if manifest['missingExpectedFiles'] else '- 无'}

## 文件清单

{markdown_table(['路径', '类型', 'SHA-256 前 16 位', '大小', '保护基线', '允许修改'], rows)}
""",
    )


def write_sqlite_report(report: dict[str, Any]) -> None:
    write_json(SNAPSHOT_DIR / "sqlite-report.json", report)
    table_rows = [[name, count] for name, count in sorted(mapping(report.get("tableCounts")).items())]
    protected_rows = [[name, count] for name, count in mapping(report.get("protectedTypeCounts")).items()]
    write_text(
        SNAPSHOT_DIR / "sqlite-report.md",
        f"""# 当前 SQLite 快照报告

路径：`{report.get('path')}`

SHA-256：`{report.get('sha256', '')}`

风险说明：{report.get('risk', '')}

## 保护类型计数

{markdown_table(['类型', '行数'], protected_rows)}

## 表行数

{markdown_table(['表', '行数'], table_rows)}
""",
    )


def main() -> None:
    generated_at = now_iso()
    SNAPSHOT_FILES_DIR.mkdir(parents=True, exist_ok=True)

    files, missing = collect_files()
    file_entries = copy_snapshot_files(files)
    sqlite = sqlite_report()
    counts = count_json_packages()

    manifest = {
        "generatedAt": generated_at,
        "snapshotDirectory": rel(SNAPSHOT_DIR),
        "filesDirectory": rel(SNAPSHOT_FILES_DIR),
        "fileCount": len(file_entries),
        "missingExpectedFiles": missing,
        "sqlite": sqlite,
        "keyCounts": counts,
        "files": file_entries,
        "frozenBoundary": {
            "noFullRecovery": True,
            "noFullExport": True,
            "noRawExcelModification": True,
            "noSvgOrDrawioModification": True,
            "noSchemaModification": True,
            "pauseEnvironmentMapping": True,
        },
    }

    write_manifest(manifest)
    write_sqlite_report(sqlite)
    boundary = build_boundary(generated_at)
    root_cause = build_root_cause(generated_at, counts)
    prevention = build_prevention(generated_at)
    write_boundary_artifacts(boundary)
    write_root_cause_artifacts(root_cause)
    write_prevention_artifacts(prevention)
    write_manual_validation_plan(generated_at)

    print(json.dumps({"result": "pass", "snapshotDirectory": rel(SNAPSHOT_DIR), "fileCount": len(file_entries), "missingExpectedFiles": missing}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
