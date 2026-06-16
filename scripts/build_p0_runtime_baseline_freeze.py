#!/usr/bin/env python3
"""Freeze the current P0 frontend runtime JSON baseline.

This script records hashes, copies only the explicitly scoped runtime baseline
files into worker-verify, and writes governance reports. It intentionally does
not mutate SQLite, rebuild JSON packages, run ETL, or touch source Excel /
Draw.io / SVG files.
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
OUT_DIR = ROOT / "data" / "exports" / "worker-verify" / "p0-runtime-baseline-freeze"
FILES_DIR = OUT_DIR / "files"

RUNTIME_JSON_FILES = [
    "frontend/capability-browser/public/data/maintenance-knowledge.json",
    "frontend/capability-browser/public/data/maintenance-index.json",
    "frontend/capability-browser/public/data/maintenance/measures.json",
    "frontend/capability-browser/public/data/management-knowledge.json",
    "frontend/capability-browser/public/data/capability-tree.json",
    "frontend/capability-browser/public/data/capability-workbench.json",
    "frontend/capability-browser/public/data/lifecycle-workbench.json",
    "frontend/capability-browser/public/data/environment-workbench.json",
    "frontend/capability-browser/generated/environmentBasemap.node-details.json",
    "frontend/capability-browser/generated/environmentBasemap.semantic.json",
    "frontend/capability-browser/public/data/standards-data.json",
    "frontend/capability-browser/public/data/standards-index.json",
]

RUNTIME_JSON_DIRS = [
    "frontend/capability-browser/public/data/standards",
]

FRONTEND_CODE_FILES = [
    "frontend/capability-browser/dataClient.js",
    "frontend/capability-browser/viewModels.js",
    "frontend/capability-browser/app.js",
    "frontend/capability-browser/components/AppShell.js",
    "frontend/capability-browser/components/CapabilityLocalRelationMap.js",
    "frontend/capability-browser/components/StandardFrameworkTable.js",
    "frontend/capability-browser/index.html",
]

AUDIT_GUARD_FILES = [
    "scripts/frontend_content_smoke_check.mjs",
    "scripts/frontend_smoke_check.mjs",
    "scripts/audit_dictionary_standard_baseline_integrity.py",
    "scripts/audit_protected_baseline_no_regression.py",
    "scripts/audit_json_package_boundary.py",
    "scripts/audit_capability_standard_mapping_canonicalization.mjs",
    "scripts/reconcile_p0_source_of_truth.py",
    "src/sapd_wiki/cli.py",
    "src/sapd_wiki/exports.py",
    "src/sapd_wiki/parsers.py",
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

SQLITE_PATH = "data/database/sapd_wiki.sqlite3"

CONFIRMED_LIFECYCLE_MEASURES = [
    "应用程序威胁建模",
    "制品安全加固",
    "IaC代码安全测试",
    "数据销毁",
]

CONFIRMED_CANONICAL_STANDARDS = [
    "GB/T 22239-2019 网络安全等级保护基本要求 第三级",
    "NIST Cybersecurity Framework 2.0",
    "ISO/IEC 27001:2022",
    "DSP Secure Controls Framework (SCF) - 2026",
    "CIS Controls v8.1.2",
    "CRF Safeguards Core Edition v2026",
    "NIST SP 800-53 Rev.5",
]

SQLITE_PROTECTED_TYPES = [
    "work_function_layer",
    "work_function",
    "security_work",
    "process_reference",
    "application_system_type",
    "standard_control",
]


def now_iso() -> str:
    return datetime.now(timezone.utc).astimezone().isoformat(timespec="seconds")


def rel(path: Path) -> str:
    return path.relative_to(ROOT).as_posix()


def read_json(path: Path) -> Any:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError:
        return None


def listify(value: Any) -> list[Any]:
    return value if isinstance(value, list) else []


def mapping(value: Any) -> dict[str, Any]:
    return value if isinstance(value, dict) else {}


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def ensure_out_dir() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    FILES_DIR.mkdir(parents=True, exist_ok=True)


def collect_manifest_paths() -> tuple[list[tuple[str, str]], list[dict[str, str]]]:
    rows: list[tuple[str, str]] = []
    missing: list[dict[str, str]] = []

    for group, files in [
        ("frontend_runtime_json", RUNTIME_JSON_FILES),
        ("frontend_key_code", FRONTEND_CODE_FILES),
        ("audit_guard_script", AUDIT_GUARD_FILES),
        ("governance_document", GOVERNANCE_FILES),
    ]:
        for item in files:
            if (ROOT / item).exists():
                rows.append((group, item))
            else:
                missing.append({"group": group, "path": item})

    for directory in RUNTIME_JSON_DIRS:
        base = ROOT / directory
        if not base.exists():
            missing.append({"group": "frontend_runtime_json", "path": directory})
            continue
        for path in sorted(base.rglob("*")):
            if path.is_file():
                rows.append(("frontend_runtime_json", rel(path)))

    deduped: dict[str, str] = {}
    for group, item in rows:
        deduped[item] = group
    return sorted((group, item) for item, group in deduped.items()), missing


def copy_and_hash(paths: list[tuple[str, str]]) -> list[dict[str, Any]]:
    entries: list[dict[str, Any]] = []
    for group, item in paths:
        source = ROOT / item
        target = FILES_DIR / item
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source, target)
        stat = source.stat()
        entries.append(
            {
                "group": group,
                "path": item,
                "snapshotPath": rel(target),
                "sha256": sha256_file(source),
                "sizeBytes": stat.st_size,
            }
        )
    return entries


def relationship_group_count(workbench: dict[str, Any], group_id: str) -> int:
    for group in listify(workbench.get("relationshipGroups")):
        if group.get("id") == group_id:
            if isinstance(group.get("count"), (int, float)):
                return int(group["count"])
            return len(listify(group.get("relationIds")))
    return 0


def sqlite_boundary() -> dict[str, Any]:
    db_path = ROOT / SQLITE_PATH
    result: dict[str, Any] = {
        "path": SQLITE_PATH,
        "exists": db_path.exists(),
        "isCompleteExportSource": False,
        "protectedTypeCounts": {},
        "risk": "当前 SQLite 仍不完整，不可作为字典 / 标准 / 生命周期 / 能力管理映射完整导出源。",
    }
    if not db_path.exists():
        return result

    result.update({"sha256": sha256_file(db_path), "sizeBytes": db_path.stat().st_size})
    try:
        with sqlite3.connect(db_path) as conn:
            table_names = {
                row[0]
                for row in conn.execute("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'").fetchall()
            }
            item_table = "knowledge_items" if "knowledge_items" in table_names else "knowledge_item" if "knowledge_item" in table_names else ""
            for object_type in SQLITE_PROTECTED_TYPES:
                if not item_table:
                    result["protectedTypeCounts"][object_type] = None
                    continue
                try:
                    count = conn.execute(f'SELECT COUNT(*) FROM "{item_table}" WHERE type = ?', (object_type,)).fetchone()[0]
                    result["protectedTypeCounts"][object_type] = int(count)
                except sqlite3.Error:
                    result["protectedTypeCounts"][object_type] = None
    except sqlite3.Error as error:
        result["sqliteError"] = str(error)
    return result


def build_counts() -> dict[str, Any]:
    data_root = ROOT / "frontend" / "capability-browser" / "public" / "data"
    maintenance = mapping(read_json(data_root / "maintenance-knowledge.json"))
    maintenance_index = mapping(read_json(data_root / "maintenance-index.json"))
    measures = mapping(read_json(data_root / "maintenance" / "measures.json"))
    processes = mapping(read_json(data_root / "maintenance" / "processes.json"))
    work_functions = mapping(read_json(data_root / "maintenance" / "work-functions.json"))
    capability_workbench = mapping(read_json(data_root / "capability-workbench.json"))
    lifecycle_workbench = mapping(read_json(data_root / "lifecycle-workbench.json"))
    standards_data = mapping(read_json(data_root / "standards-data.json"))
    standards_index = mapping(read_json(data_root / "standards-index.json"))

    measure_names = [str(item.get("name") or item.get("title") or "") for item in listify(measures.get("security_technical_measures"))]
    standards_names = [str(item.get("title") or item.get("name") or "") for item in listify(standards_data.get("frameworks"))]

    counts = {
        "securityWorks": len(listify(maintenance.get("security_works"))),
        "securityProcesses": len(listify(processes.get("security_processes"))),
        "workFunctionLayers": len(listify(work_functions.get("work_function_layers"))),
        "securityTechnicalMeasures": len(listify(measures.get("security_technical_measures"))),
        "standards": {
            "frameworks": int(mapping(standards_data.get("stats")).get("frameworks") or len(listify(standards_data.get("frameworks")))),
            "controls": int(mapping(standards_index.get("stats")).get("controls") or mapping(standards_data.get("stats")).get("controls") or 0),
        },
        "managementMapping": relationship_group_count(capability_workbench, "management-mapping"),
        "standardMapping": relationship_group_count(capability_workbench, "standard-mapping"),
        "lifecycle": {
            "relations": int(mapping(mapping(lifecycle_workbench.get("meta")).get("stats")).get("relations") or 0),
        },
        "maintenanceIndex": mapping(maintenance_index.get("section_counts")),
        "confirmedLifecycleMeasures": [
            {"name": name, "present": name in measure_names} for name in CONFIRMED_LIFECYCLE_MEASURES
        ],
        "confirmedCanonicalStandards": [
            {"title": title, "present": title in standards_names} for title in CONFIRMED_CANONICAL_STANDARDS
        ],
    }
    counts["acceptance"] = {
        "frontendFrozenJsonIsRuntimeBaseline": True,
        "pageRuntimeRecovered": True,
        "sqliteIsCompleteExportSource": False,
        "oi140HemostasisComplete": True,
        "oi140SourceOfTruthReconciliationClosed": False,
        "allConfirmedLifecycleMeasuresPresent": all(item["present"] for item in counts["confirmedLifecycleMeasures"]),
        "allConfirmedCanonicalStandardsPresent": all(item["present"] for item in counts["confirmedCanonicalStandards"]),
    }
    return counts


def write_json(path: Path, payload: Any) -> None:
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def md_table(rows: list[list[Any]]) -> list[str]:
    if not rows:
        return []
    width = len(rows[0])
    return [
        "| " + " | ".join(str(value) for value in rows[0]) + " |",
        "| " + " | ".join("---" for _ in range(width)) + " |",
        *["| " + " | ".join(str(value).replace("|", "\\|") for value in row) + " |" for row in rows[1:]],
    ]


def write_manifest_md(manifest: dict[str, Any]) -> None:
    grouped: dict[str, list[dict[str, Any]]] = {}
    for entry in manifest["files"]:
        grouped.setdefault(entry["group"], []).append(entry)
    lines = [
        "# P0 Runtime Baseline Manifest",
        "",
        f"- 生成时间：`{manifest['generatedAt']}`",
        "- 冻结口径：当前前端冻结 JSON 是运行基线；当前 SQLite 不是完整导出源。",
        f"- 文件总数：`{manifest['summary']['fileCount']}`",
        f"- 缺失项数量：`{len(manifest['missingFiles'])}`",
        f"- 正式数据修改：`{manifest['scope']['modifiedFormalData']}`",
        f"- SQLite 修改：`{manifest['scope']['modifiedSqlite']}`",
        "",
        "## 缺失项",
        "",
    ]
    if manifest["missingFiles"]:
        lines.extend(md_table([["group", "path"], *[[item["group"], item["path"]] for item in manifest["missingFiles"]]]))
    else:
        lines.append("无。")
    lines.extend(["", "## 文件 Hash", ""])
    for group, entries in grouped.items():
        lines.extend([f"### {group}", ""])
        lines.extend(md_table([["path", "sha256", "size"], *[[item["path"], item["sha256"], item["sizeBytes"]] for item in entries]]))
        lines.append("")
    (OUT_DIR / "runtime-baseline-manifest.md").write_text("\n".join(lines).rstrip() + "\n", encoding="utf-8")


def write_counts_reports(counts: dict[str, Any]) -> None:
    write_json(OUT_DIR / "runtime-baseline-counts.json", counts)
    lines = [
        "# P0 Runtime Baseline Counts",
        "",
        "## 关键计数",
        "",
        *md_table(
            [
                ["指标", "当前值"],
                ["securityWorks", counts["securityWorks"]],
                ["securityProcesses", counts["securityProcesses"]],
                ["workFunctionLayers", counts["workFunctionLayers"]],
                ["securityTechnicalMeasures", counts["securityTechnicalMeasures"]],
                ["standards.frameworks", counts["standards"]["frameworks"]],
                ["standards.controls", counts["standards"]["controls"]],
                ["managementMapping", counts["managementMapping"]],
                ["standardMapping", counts["standardMapping"]],
                ["lifecycle.relations", counts["lifecycle"]["relations"]],
            ]
        ),
        "",
        "## 已确认生命周期来源安全技术措施",
        "",
        *md_table([["名称", "是否存在"], *[[item["name"], item["present"]] for item in counts["confirmedLifecycleMeasures"]]]),
        "",
        "## 已确认 canonical 标准名称",
        "",
        *md_table([["名称", "是否存在"], *[[item["title"], item["present"]] for item in counts["confirmedCanonicalStandards"]]]),
        "",
        "## 运行基线结论",
        "",
        "- 前端冻结 JSON：当前可运行基线，已人工基本通过。",
        "- 页面运行态：恢复完成。",
        "- 当前 SQLite：仍不完整，不能作为完整导出源。",
        "- `OI-140`：P0 止血完成，但 SQLite Source-of-Truth Reconciliation 未关闭。",
    ]
    (OUT_DIR / "runtime-baseline-counts.md").write_text("\n".join(lines) + "\n", encoding="utf-8")


def write_risk_boundary(sqlite: dict[str, Any]) -> None:
    payload = {
        "status": "ready",
        "generatedAt": now_iso(),
        "runtimeBaseline": "当前前端冻结 JSON 可作为运行基线。",
        "sqliteBoundary": sqlite,
        "rules": [
            "当前 SQLite 仍缺 6 类受保护基线。",
            "当前 SQLite 不可作为完整导出源。",
            "禁止从当前 SQLite 重导字典 / 标准 / LC / 能力管理映射正式 JSON。",
            "后续 SQLite 修复必须走 Source-of-Truth Reconciliation。",
            "后续原始数据修改必须走单独变更流程。",
            "当前快照不是数据永久正确的证明，而是当前运行态已人工基本通过的冻结点。",
        ],
        "forbidden": [
            "全量导入",
            "全量导出",
            "全量恢复",
            "core reset",
            "从不完整 SQLite 生成正式包",
            "用业务映射反向改字典 / 标准",
            "忽略 Excel merged ranges",
        ],
    }
    write_json(OUT_DIR / "runtime-baseline-risk-boundary.json", payload)
    lines = [
        "# P0 Runtime Baseline Risk Boundary",
        "",
        "## 当前结论",
        "",
        "1. 当前前端冻结 JSON 可作为运行基线。",
        "2. 当前 SQLite 仍缺 6 类受保护基线。",
        "3. 当前 SQLite 不可作为完整导出源。",
        "4. 禁止从当前 SQLite 重导字典 / 标准 / LC / 能力管理映射正式 JSON。",
        "5. 后续 SQLite 修复必须走 Source-of-Truth Reconciliation。",
        "6. 后续原始数据修改必须走单独变更流程。",
        "7. 当前快照不是“数据永久正确”的证明，而是“当前运行态已人工基本通过”的冻结点。",
        "",
        "## SQLite 保护类型计数",
        "",
        *md_table([["type", "count"], *[[key, value] for key, value in sqlite.get("protectedTypeCounts", {}).items()]]),
        "",
        "## 禁止事项",
        "",
        *[f"- {item}" for item in payload["forbidden"]],
    ]
    (OUT_DIR / "runtime-baseline-risk-boundary.md").write_text("\n".join(lines) + "\n", encoding="utf-8")


def write_change_procedure() -> None:
    lines = [
        "# Future Source Data Change Procedure",
        "",
        "后续每次原始数据修改都必须走以下流程：",
        "",
        "1. 用户明确提出修改项。",
        "2. 明确修改的原始表 / 字段 / 关系。",
        "3. 判断是否影响 Protected Baseline。",
        "4. 判断是否影响 Workbench Projection。",
        "5. 只读审计当前状态。",
        "6. 生成候选导入 / 候选 JSON / 候选 workbench。",
        "7. 生成 normalized diff。",
        "8. 人工确认。",
        "9. 备份当前正式数据。",
        "10. 定向替换。",
        "11. 执行内容级 smoke。",
        "12. 更新 runtime baseline manifest。",
        "",
        "## 禁止事项",
        "",
        "- 全量导入。",
        "- 全量导出。",
        "- 全量恢复。",
        "- 从不完整 SQLite 生成正式包。",
        "- 用业务映射反向改字典 / 标准。",
        "- 忽略 Excel merged ranges；合并单元格是业务关系边界。",
        "- 新增复杂导入条件判断，除非先形成明确业务规则和审计样例。",
        "",
        "## 分拆边界",
        "",
        "- Protected Baseline：字典、标准 / 框架、生命周期知识基线，只能由用户明确授权后定向修改。",
        "- Workbench Projection：能力、生命周期、环境等页面投影，只能由确认后的数据变更定向重建。",
        "- SQLite Source-of-Truth：当前仍未完成 reconciliation，修复前不得作为完整导出源。",
    ]
    (OUT_DIR / "future-source-data-change-procedure.md").write_text("\n".join(lines) + "\n", encoding="utf-8")


def main() -> None:
    ensure_out_dir()
    paths, missing = collect_manifest_paths()
    entries = copy_and_hash(paths)
    counts = build_counts()
    sqlite = sqlite_boundary()
    generated_at = now_iso()

    manifest = {
        "status": "ready",
        "generatedAt": generated_at,
        "scope": {
            "name": "P0 Recovery Runtime Baseline Freeze 1.0",
            "modifiedFormalData": False,
            "modifiedSqlite": False,
            "rebuiltJsonFromSqlite": False,
            "fullPublicDataExport": False,
            "browserStarted": False,
        },
        "summary": {
            "fileCount": len(entries),
            "missingFileCount": len(missing),
            "outputDirectory": rel(OUT_DIR),
        },
        "missingFiles": missing,
        "files": entries,
        "countsReport": "data/exports/worker-verify/p0-runtime-baseline-freeze/runtime-baseline-counts.json",
        "riskBoundary": "data/exports/worker-verify/p0-runtime-baseline-freeze/runtime-baseline-risk-boundary.json",
        "futureSourceDataChangeProcedure": "data/exports/worker-verify/p0-runtime-baseline-freeze/future-source-data-change-procedure.md",
        "sqliteBoundary": sqlite,
    }

    write_json(OUT_DIR / "runtime-baseline-manifest.json", manifest)
    write_manifest_md(manifest)
    write_counts_reports(counts)
    write_risk_boundary(sqlite)
    write_change_procedure()

    print(json.dumps({
        "result": "pass",
        "outputDirectory": rel(OUT_DIR),
        "fileCount": len(entries),
        "missingFileCount": len(missing),
        "counts": {
            "securityWorks": counts["securityWorks"],
            "securityProcesses": counts["securityProcesses"],
            "workFunctionLayers": counts["workFunctionLayers"],
            "securityTechnicalMeasures": counts["securityTechnicalMeasures"],
            "standardsControls": counts["standards"]["controls"],
            "managementMapping": counts["managementMapping"],
            "standardMapping": counts["standardMapping"],
            "lifecycleRelations": counts["lifecycle"]["relations"],
            "standardsFrameworks": counts["standards"]["frameworks"],
        },
        "sqliteIsCompleteExportSource": False,
    }, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
