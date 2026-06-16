#!/usr/bin/env python3
"""Audit the P0 capability work / standard binding recovery content."""

from __future__ import annotations

import json
from datetime import datetime
from pathlib import Path
from typing import Any


PROJECT_ROOT = Path(__file__).resolve().parents[1]
DATA_ROOT = PROJECT_ROOT / "frontend/capability-browser/public/data"
REPORT_ROOT = PROJECT_ROOT / "data/exports/worker-verify"
RECOVERY_ROOT = REPORT_ROOT / "p0-capability-work-binding-recovery"
REPORT_JSON = REPORT_ROOT / "p0-capability-work-binding-audit.json"
REPORT_MD = REPORT_ROOT / "p0-capability-work-binding-audit.md"


def load_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def list_of(value: Any) -> list[Any]:
    return value if isinstance(value, list) else []


def workbench_counts(workbench: dict[str, Any]) -> dict[str, int]:
    stats = ((workbench.get("meta") or {}).get("stats") or {}) if isinstance(workbench, dict) else {}
    return {key: int(value or 0) for key, value in stats.items() if isinstance(value, int)}


def relationship_counts(workbench: dict[str, Any]) -> dict[str, int]:
    result: dict[str, int] = {}
    for group in list_of(workbench.get("relationshipGroups")):
        group_id = str(group.get("id") or "").strip()
        if not group_id:
            continue
        result[group_id] = int(group.get("count") or len(list_of(group.get("relationIds"))))
    return result


def focus_binding_counts(capability_tree: dict[str, Any]) -> dict[str, int]:
    counts = {"focuses": 0, "securityWorkFocuses": 0, "processMappingFocuses": 0}

    def visit(node: dict[str, Any]) -> None:
        if not isinstance(node, dict):
            return
        if node.get("type") == "capability_focus":
            counts["focuses"] += 1
            if list_of(node.get("security_works")):
                counts["securityWorkFocuses"] += 1
            if list_of(node.get("process_mappings")):
                counts["processMappingFocuses"] += 1
        for key in ("domains", "capabilities", "focuses", "children"):
            for child in list_of(node.get(key)):
                visit(child)

    for category in list_of(capability_tree.get("categories")):
        visit(category)
    return counts


def required_positive(label: str, value: int, errors: list[str]) -> int:
    if value <= 0:
        errors.append(f"{label} is empty")
    return value


def build_report() -> dict[str, Any]:
    errors: list[str] = []
    capability_tree = load_json(DATA_ROOT / "capability-tree.json")
    capability_workbench = load_json(DATA_ROOT / "capability-workbench.json")
    maintenance = load_json(DATA_ROOT / "maintenance-knowledge.json")
    maintenance_index = load_json(DATA_ROOT / "maintenance-index.json")
    security_works = load_json(DATA_ROOT / "maintenance/security-works.json")
    processes = load_json(DATA_ROOT / "maintenance/processes.json")
    work_functions = load_json(DATA_ROOT / "maintenance/work-functions.json")
    standards = load_json(DATA_ROOT / "standards-data.json")
    lifecycle = load_json(DATA_ROOT / "lifecycle-knowledge.json")
    lifecycle_workbench = load_json(DATA_ROOT / "lifecycle-workbench.json")
    recovery_report = load_json(RECOVERY_ROOT / "p0-capability-work-binding-recovery-report.json") if (RECOVERY_ROOT / "p0-capability-work-binding-recovery-report.json").exists() else {}

    before_dir = RECOVERY_ROOT / "before"
    before_workbench = load_json(before_dir / "capability-workbench.json") if (before_dir / "capability-workbench.json").exists() else {}
    before_maintenance = load_json(before_dir / "maintenance-knowledge.json") if (before_dir / "maintenance-knowledge.json").exists() else {}
    before_tree = load_json(before_dir / "capability-tree.json") if (before_dir / "capability-tree.json").exists() else {}

    current_counts = workbench_counts(capability_workbench)
    current_relationships = relationship_counts(capability_workbench)
    current_focus_bindings = focus_binding_counts(capability_tree)
    before_counts = workbench_counts(before_workbench)
    before_focus_bindings = focus_binding_counts(before_tree) if before_tree else {}

    package_checks = {
        "maintenance.security_works": required_positive("maintenance.security_works", len(list_of(maintenance.get("security_works"))), errors),
        "maintenance.security_processes": required_positive("maintenance.security_processes", len(list_of(maintenance.get("security_processes"))), errors),
        "maintenance.work_function_layers": required_positive("maintenance.work_function_layers", len(list_of(maintenance.get("work_function_layers"))), errors),
        "split.security_works": required_positive("split.security_works", len(list_of(security_works.get("security_works"))), errors),
        "split.security_processes": required_positive("split.security_processes", len(list_of(processes.get("security_processes"))), errors),
        "split.work_function_layers": required_positive("split.work_function_layers", len(list_of(work_functions.get("work_function_layers"))), errors),
        "maintenance_index.security-works": required_positive("maintenance_index.security-works", int((maintenance_index.get("section_counts") or {}).get("security-works") or 0), errors),
        "standards_data.controls": required_positive("standards_data.controls", int((standards.get("stats") or {}).get("controls") or 0), errors),
        "lifecycle.application_processes": required_positive("lifecycle.application_processes", int((lifecycle.get("stats") or {}).get("application_processes") or 0), errors),
        "lifecycle.data_processes": required_positive("lifecycle.data_processes", int((lifecycle.get("stats") or {}).get("data_processes") or 0), errors),
        "lifecycle_workbench.relations": required_positive("lifecycle_workbench.relations", int(((lifecycle_workbench.get("meta") or {}).get("stats") or {}).get("relations") or 0), errors),
    }

    for label, value in {
        "capability_workbench.security_work": current_counts.get("security_work", 0),
        "capability_workbench.work_function": current_counts.get("work_function", 0),
        "capability_workbench.process_group": current_counts.get("process_group", 0),
        "capability_workbench.process_reference": current_counts.get("process_reference", 0),
        "capability_workbench.standard_control": current_counts.get("standard_control", 0),
        "relationship.management-mapping": current_relationships.get("management-mapping", 0),
        "relationship.process-mapping": current_relationships.get("process-mapping", 0),
        "relationship.standard-mapping": current_relationships.get("standard-mapping", 0),
    }.items():
        required_positive(label, value, errors)

    if current_focus_bindings.get("focuses") != 91:
        errors.append(f"capability-tree focus count expected 91, got {current_focus_bindings.get('focuses')}")
    if current_focus_bindings.get("securityWorkFocuses") != 91:
        errors.append(f"security work focus bindings expected 91, got {current_focus_bindings.get('securityWorkFocuses')}")
    if current_focus_bindings.get("processMappingFocuses", 0) < 89:
        errors.append(f"process mapping focus bindings expected at least 89, got {current_focus_bindings.get('processMappingFocuses')}")

    return {
        "auditStatus": "pass" if not errors else "fail",
        "generatedAt": datetime.now().astimezone().isoformat(timespec="seconds"),
        "errors": errors,
        "scope": [
            "/knowledge/management-workflows",
            "/capability-mapping 管理视角",
            "/capability-mapping 标准 / 框架映射",
            "standards split packages",
            "LC-AP / LC-DT lifecycle packages",
        ],
        "rootCauseSummary": [
            "安全工作清单页面缺失是因为维护包未导出 security_works，且安全工作页面只能从 capabilityTree.focus.security_works 派生，导致页面计数为 0。",
            "能力映射管理视角缺失是因为 capability-tree 缺少 focus.security_works / focus.process_mappings，capability-workbench 也缺少 security_work、work_function、process_group、process_reference 投影。",
            "标准 / 框架映射缺失是因为 capability-workbench 缺少 standard_control 与 maps_to_standard 投影；标准清单本身仍在 split packages 中存在。",
        ],
        "recoveryDiscipline": {
            "mode": "selective_recovery_only",
            "sourceBackup": recovery_report.get("sourceBackup"),
            "currentWorkbook": recovery_report.get("currentWorkbook"),
            "notUsed": [
                "bootstrap-local-data --profile core --reset",
                "full SQLite restore",
                "full public/data export",
                "raw Excel writeback",
            ],
        },
        "before": {
            "capabilityWorkbenchObjects": before_counts,
            "focusBindings": before_focus_bindings,
            "maintenanceSecurityWorks": len(list_of(before_maintenance.get("security_works"))),
        },
        "after": {
            "packageChecks": package_checks,
            "capabilityWorkbenchObjects": current_counts,
            "relationshipGroups": current_relationships,
            "focusBindings": current_focus_bindings,
            "standardMappingValidation": recovery_report.get("standardMappingValidation") or {},
        },
        "pageChains": {
            "securityWorkDictionary": {
                "route": "/knowledge/management-workflows",
                "componentExpectation": "SecurityWorkMaintenanceTable / ProcessMaintenanceTable",
                "dataContract": [
                    "maintenance-index.json section security-works",
                    "maintenance/security-works.json",
                    "maintenance/processes.json",
                    "maintenance/work-functions.json",
                    "capability-tree.focus.security_works",
                ],
            },
            "capabilityManagementView": {
                "route": "/capability-mapping",
                "tab": "管理视角",
                "dataContract": [
                    "capability-tree.focus.security_works",
                    "capability-tree.focus.process_mappings",
                    "capability-workbench relationshipGroups management-mapping/process-mapping",
                ],
            },
            "capabilityStandardMapping": {
                "route": "/capability-mapping",
                "tab": "标准 / 框架映射",
                "dataContract": [
                    "capability-workbench.objects.standard_control",
                    "capability-workbench.relationshipGroups.standard-mapping",
                    "standards-data.json and split standards packages",
                ],
            },
        },
    }


def write_markdown(report: dict[str, Any]) -> str:
    after = report["after"]
    lines = [
        "# P0 Capability & Work Binding Recovery Audit",
        "",
        f"- 审计状态：`{report['auditStatus']}`",
        f"- 生成时间：`{report['generatedAt']}`",
        f"- 恢复模式：`{report['recoveryDiscipline']['mode']}`",
        "",
        "## 核心结论",
        "",
        f"- 安全工作清单：`{after['packageChecks']['maintenance.security_works']}` 条唯一安全工作，拆分包 `security-works` 同步为 `{after['packageChecks']['split.security_works']}` 条。",
        f"- 能力关注点绑定：`{after['focusBindings']['securityWorkFocuses']}/{after['focusBindings']['focuses']}` 个关注点有安全工作绑定，`{after['focusBindings']['processMappingFocuses']}` 个关注点有流程绑定。",
        f"- 管理视角投影：`management-mapping={after['relationshipGroups'].get('management-mapping', 0)}`，`process-mapping={after['relationshipGroups'].get('process-mapping', 0)}`。",
        f"- 标准 / 框架投影：`standard_control={after['capabilityWorkbenchObjects'].get('standard_control', 0)}`，`standard-mapping={after['relationshipGroups'].get('standard-mapping', 0)}`。",
        f"- 标准映射源校验：`mappedRelations={after['standardMappingValidation'].get('mappedRelations', 0)}`，`missingControls={after['standardMappingValidation'].get('missingControls', 0)}`，`unmatchedFocuses={after['standardMappingValidation'].get('unmatchedFocuses', 0)}`。",
        "",
        "## 根因记录",
        "",
    ]
    lines.extend([f"- {item}" for item in report["rootCauseSummary"]])
    lines.extend(
        [
            "",
            "## 纪律边界",
            "",
            "- 本轮只做丢失链路的选择性恢复。",
            "- 未使用全量 core reset、全量 SQLite restore、全量 public/data export。",
            "- 不修改原始 Excel、正式 Environment Mapping 数据包、node-details、SVG、schema 或胶囊样式。",
            "",
            "## 页面链路",
            "",
        ]
    )
    for name, chain in report["pageChains"].items():
        lines.append(f"### {name}")
        lines.append(f"- 路由：`{chain['route']}`")
        if chain.get("tab"):
            lines.append(f"- Tab：`{chain['tab']}`")
        lines.append("- 数据契约：")
        lines.extend([f"  - `{item}`" for item in chain["dataContract"]])
        lines.append("")
    if report["errors"]:
        lines.extend(["## 错误", "", *[f"- {error}" for error in report["errors"]], ""])
    return "\n".join(lines)


def main() -> None:
    report = build_report()
    REPORT_ROOT.mkdir(parents=True, exist_ok=True)
    REPORT_JSON.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    REPORT_MD.write_text(write_markdown(report), encoding="utf-8")
    print(f"audit_status={report['auditStatus']}")
    print(f"errors={len(report['errors'])}")
    print(f"json={REPORT_JSON}")
    print(f"markdown={REPORT_MD}")
    if report["auditStatus"] != "pass":
        raise SystemExit(1)


if __name__ == "__main__":
    main()
