#!/usr/bin/env python3
"""Audit environment module/service/system relations against the module catalog.

This script is read-only for official data. It compares source-derived
normalized rows from ``作用域-安全技术服务-安全技术模块映射`` with the source
``安全技术模块清单`` sheet, preserving merged-cell evidence in both inputs.
"""

from __future__ import annotations

import json
from collections import defaultdict
from datetime import datetime
from pathlib import Path
from typing import Any

from openpyxl import load_workbook
from openpyxl.utils import get_column_letter

from audit_scope_service_module_mapping import (
    OUTPUT_DIR,
    PROJECT_ROOT,
    as_text,
    is_empty_security_system_value,
    service_child_relation_entries,
    service_payload,
    split_relation_titles,
)
from sapd_wiki.transformers import is_blank_or_placeholder, split_multivalue_text


WORKBOOK_PATH = PROJECT_ROOT / "data/raw-samples/wiki sample.xlsx"
MODULE_CATALOG_SHEET = "安全技术模块清单"
NORMALIZED_ROWS_PATH = OUTPUT_DIR / "scope-service-module-mapping-normalized-rows.json"
SCOPE_AUDIT_PATH = OUTPUT_DIR / "scope-service-module-mapping-reimport-audit.json"
WORKBENCH_PATH = PROJECT_ROOT / "frontend/capability-browser/public/data/environment-workbench.json"

AUDIT_JSON_OUT = OUTPUT_DIR / "environment-module-catalog-consistency-audit.json"
AUDIT_MD_OUT = OUTPUT_DIR / "environment-module-catalog-consistency-audit.md"
REVIEW_ROWS_OUT = OUTPUT_DIR / "environment-module-catalog-consistency-review-rows.json"

CATALOG_FIELD_COLUMNS = {
    "B": "securitySystemCategory",
    "C": "securitySystem",
    "D": "securityTechnologyModule",
    "F": "securityTechnicalService",
    "G": "product",
}


def load_json(path: Path, default: Any = None) -> Any:
    if not path.exists():
        return default
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")


def merged_index_for_sheet(ws) -> dict[str, dict[str, Any]]:
    index: dict[str, dict[str, Any]] = {}
    for merged_range in sorted(ws.merged_cells.ranges, key=lambda item: (item.min_row, item.min_col, item.max_row, item.max_col)):
        top_left = ws.cell(merged_range.min_row, merged_range.min_col)
        payload = {
            "range": str(merged_range),
            "topLeft": top_left.coordinate,
            "topLeftValue": as_text(top_left.value),
            "rowSpan": merged_range.max_row - merged_range.min_row + 1,
            "columnSpan": merged_range.max_col - merged_range.min_col + 1,
        }
        for row_index in range(merged_range.min_row, merged_range.max_row + 1):
            for column_index in range(merged_range.min_col, merged_range.max_col + 1):
                index[f"{get_column_letter(column_index)}{row_index}"] = payload
    return index


def catalog_cell(ws, merged_index: dict[str, dict[str, Any]], row_index: int, column_letter: str) -> dict[str, Any]:
    cell = ws[f"{column_letter}{row_index}"]
    merged = merged_index.get(cell.coordinate)
    value = merged["topLeftValue"] if merged else as_text(cell.value)
    return {
        "value": value,
        "sourceCell": cell.coordinate,
        "mergedRange": merged["range"] if merged else None,
        "topLeft": merged["topLeft"] if merged else cell.coordinate,
    }


def service_key(value: Any) -> str:
    service = service_payload(value)
    return service.get("code") or service.get("title") or as_text(value)


def split_catalog_services(value: Any) -> list[str]:
    services: list[str] = []
    for line in split_multivalue_text(value, split_on_ideographic_comma=False):
        item = as_text(line)
        if item and not is_blank_or_placeholder(item):
            services.append(item)
    return list(dict.fromkeys(services))


def read_module_catalog(workbook_path: Path) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    workbook = load_workbook(workbook_path, read_only=False, data_only=True)
    if MODULE_CATALOG_SHEET not in workbook.sheetnames:
        raise SystemExit(f"Sheet not found: {MODULE_CATALOG_SHEET}")
    ws = workbook[MODULE_CATALOG_SHEET]
    merged_index = merged_index_for_sheet(ws)
    relations: list[dict[str, Any]] = []
    for row_index in range(3, ws.max_row + 1):
        fields = {
            field: catalog_cell(ws, merged_index, row_index, column)
            for column, field in CATALOG_FIELD_COLUMNS.items()
        }
        module_title = as_text(fields["securityTechnologyModule"]["value"])
        system_title = as_text(fields["securitySystem"]["value"])
        category_title = as_text(fields["securitySystemCategory"]["value"])
        service_values = split_catalog_services(fields["securityTechnicalService"]["value"])
        if not module_title or is_blank_or_placeholder(module_title) or not service_values:
            continue
        for service_text in service_values:
            relations.append(
                {
                    "securitySystemCategory": category_title,
                    "securitySystem": system_title,
                    "securityTechnologyModule": module_title,
                    "securityTechnicalService": service_text,
                    "securityTechnicalServiceKey": service_key(service_text),
                    "sourceRow": row_index,
                    "sourceCells": {field: payload["sourceCell"] for field, payload in fields.items()},
                    "mergedRanges": {field: payload["mergedRange"] for field, payload in fields.items() if payload["mergedRange"]},
                }
            )
    return relations, {
        "sheet": MODULE_CATALOG_SHEET,
        "maxRow": ws.max_row,
        "maxColumn": ws.max_column,
        "mergedRangeCount": len(list(ws.merged_cells.ranges)),
    }


def append_index(index: dict[str, set[str]], key: str, value: str) -> None:
    if key and value:
        index[key].add(value)


def build_catalog_indices(relations: list[dict[str, Any]]) -> dict[str, dict[str, list[str]]]:
    system_to_modules: dict[str, set[str]] = defaultdict(set)
    module_to_services: dict[str, set[str]] = defaultdict(set)
    service_to_modules: dict[str, set[str]] = defaultdict(set)
    module_to_systems: dict[str, set[str]] = defaultdict(set)
    service_to_systems: dict[str, set[str]] = defaultdict(set)
    for relation in relations:
        system = as_text(relation.get("securitySystem"))
        module = as_text(relation.get("securityTechnologyModule"))
        service = as_text(relation.get("securityTechnicalServiceKey"))
        append_index(system_to_modules, system, module)
        append_index(module_to_services, module, service)
        append_index(service_to_modules, service, module)
        append_index(module_to_systems, module, system)
        append_index(service_to_systems, service, system)
    return {
        "securitySystemToModules": {key: sorted(values) for key, values in sorted(system_to_modules.items())},
        "securityTechnologyModuleToServices": {key: sorted(values) for key, values in sorted(module_to_services.items())},
        "securityTechnicalServiceToModules": {key: sorted(values) for key, values in sorted(service_to_modules.items())},
        "securityTechnologyModuleToSystems": {key: sorted(values) for key, values in sorted(module_to_systems.items())},
        "securityTechnicalServiceToSystems": {key: sorted(values) for key, values in sorted(service_to_systems.items())},
    }


def measure_titles_from_workbench(workbench: dict[str, Any] | None) -> set[str]:
    titles: set[str] = set()
    if not isinstance(workbench, dict):
        return titles
    objects = workbench.get("objects") or []
    if isinstance(objects, dict):
        objects = objects.values()
    for obj in objects:
        if not isinstance(obj, dict):
            continue
        if as_text(obj.get("type")) == "security_technical_measure":
            title = as_text(obj.get("title") or obj.get("name"))
            if title:
                titles.add(title)
    return titles


def env_entries(normalized_rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    entries: list[dict[str, Any]] = []
    for row in normalized_rows:
        for entry in service_child_relation_entries(row):
            entries.append({**entry, "sourceRow": row})
    return entries


def make_review_row(entry: dict[str, Any], indices: dict[str, dict[str, list[str]]], module_titles: set[str], measure_titles: set[str]) -> dict[str, Any]:
    source_row = entry["sourceRow"]
    service = as_text(entry["securityTechnicalService"])
    child_type = as_text(entry["childType"])
    child_title = as_text(entry["securityTechnologyModuleOrMeasure"])
    system = as_text(entry["securitySystem"])
    allowed_modules = indices["securityTechnicalServiceToModules"].get(service, [])
    allowed_services = indices["securityTechnologyModuleToServices"].get(child_title, [])
    allowed_systems = indices["securityTechnologyModuleToSystems"].get(child_title, [])
    issues: list[dict[str, Any]] = []
    module_service_match: bool | None = None
    system_module_match: bool | None = None

    if child_type == "module":
        module_service_match = service in set(allowed_services)
        if not module_service_match:
            issues.append(
                {
                    "type": "moduleServiceMismatch",
                    "severity": "high",
                    "reason": "环境映射表中出现的模块-服务关系不在安全技术模块清单中",
                }
            )
        if system:
            system_module_match = child_title in set(indices["securitySystemToModules"].get(system, []))
            if not system_module_match:
                issues.append(
                    {
                        "type": "systemModuleMismatch",
                        "severity": "high",
                        "reason": "环境映射表中出现的系统-模块关系不在安全技术模块清单中",
                    }
                )
        if allowed_systems and (not system or system not in set(allowed_systems)):
            issues.append(
                {
                    "type": "securitySystemCoverageOrMismatch",
                    "severity": "review",
                    "allowedSecuritySystemsFromCatalog": allowed_systems,
                    "reason": "安全系统为空或与安全技术模块清单不完全一致，需人工确认",
                }
            )
        if child_title not in module_titles:
            issues.append(
                {
                    "type": "moduleMeasureClassificationIssue",
                    "severity": "review",
                    "reason": "该值被识别为安全技术模块，但未在安全技术模块清单中找到",
                }
            )
    elif child_type == "measure":
        if child_title in module_titles:
            issues.append(
                {
                    "type": "moduleMeasureClassificationIssue",
                    "severity": "review",
                    "reason": "该值被识别为安全技术措施，但名称出现在安全技术模块清单中",
                }
            )
        elif measure_titles and child_title not in measure_titles:
            issues.append(
                {
                    "type": "moduleMeasureClassificationIssue",
                    "severity": "review",
                    "reason": "该值被识别为安全技术措施，但未在当前维护数据的措施集合中找到",
                }
            )

    return {
        "excelRow": source_row.get("row"),
        "objectContextKey": entry["objectContextKey"],
        "environment": entry["environment"],
        "environmentSegment": entry["environmentSegment"],
        "informationObject": entry["informationObject"],
        "declaredScopes": [
            scope.get("code") or scope.get("title") or scope.get("text")
            for scope in source_row.get("scopes", [])
            if scope.get("code") or scope.get("title") or scope.get("text")
        ],
        "securityTechnicalService": entry["securityTechnicalServiceRaw"],
        "securityTechnicalServiceKey": service,
        "childType": child_type,
        "securityTechnologyModuleOrMeasure": child_title,
        "securitySystem": system,
        "catalogMatch": {
            "moduleServiceMatch": module_service_match,
            "systemModuleMatch": system_module_match,
            "allowedModulesFromCatalog": allowed_modules,
            "allowedServicesFromCatalog": allowed_services,
            "allowedSystemsFromCatalog": allowed_systems,
        },
        "issues": issues,
        "sourceCells": source_row.get("sourceCells") or {},
        "mergedRanges": source_row.get("mergedRanges") or {},
    }


def coverage_candidates(review_rows: list[dict[str, Any]], indices: dict[str, dict[str, list[str]]]) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    actual_modules_by_context_service: dict[tuple[str, str], set[str]] = defaultdict(set)
    actual_services_by_context_module: dict[tuple[str, str], set[str]] = defaultdict(set)
    first_row_by_context_service: dict[tuple[str, str], dict[str, Any]] = {}
    first_row_by_context_module: dict[tuple[str, str], dict[str, Any]] = {}
    for row in review_rows:
        if row.get("childType") != "module":
            continue
        context_key = as_text(row.get("objectContextKey"))
        service = as_text(row.get("securityTechnicalServiceKey"))
        module = as_text(row.get("securityTechnologyModuleOrMeasure"))
        actual_modules_by_context_service[(context_key, service)].add(module)
        actual_services_by_context_module[(context_key, module)].add(service)
        first_row_by_context_service.setdefault((context_key, service), row)
        first_row_by_context_module.setdefault((context_key, module), row)

    service_module_gaps: list[dict[str, Any]] = []
    for key, actual_modules in sorted(actual_modules_by_context_service.items()):
        context_key, service = key
        allowed_modules = set(indices["securityTechnicalServiceToModules"].get(service, []))
        missing = sorted(allowed_modules - actual_modules)
        if not missing:
            continue
        first = first_row_by_context_service[key]
        service_module_gaps.append(
            {
                "type": "serviceModuleCoverageGapCandidate",
                "objectContextKey": context_key,
                "securityTechnicalService": service,
                "allowedModulesFromCatalog": sorted(allowed_modules),
                "actualModulesInEnvironmentMapping": sorted(actual_modules),
                "missingModulesCandidate": missing,
                "severity": "review",
                "reason": "安全技术模块清单中该服务关联更多模块；需人工确认环境映射表是否应完整列出",
                "sampleExcelRow": first.get("excelRow"),
            }
        )

    module_service_gaps: list[dict[str, Any]] = []
    for key, actual_services in sorted(actual_services_by_context_module.items()):
        context_key, module = key
        allowed_services = set(indices["securityTechnologyModuleToServices"].get(module, []))
        missing = sorted(allowed_services - actual_services)
        if not missing:
            continue
        first = first_row_by_context_module[key]
        module_service_gaps.append(
            {
                "type": "moduleServiceCoverageGapCandidate",
                "objectContextKey": context_key,
                "securityTechnologyModule": module,
                "allowedServicesFromCatalog": sorted(allowed_services),
                "actualServicesInEnvironmentMapping": sorted(actual_services),
                "missingServicesCandidate": missing,
                "severity": "review",
                "reason": "安全技术模块清单中该模块关联更多服务；需人工确认环境对象是否应包含这些服务",
                "sampleExcelRow": first.get("excelRow"),
            }
        )
    return service_module_gaps, module_service_gaps


def issue_items(review_rows: list[dict[str, Any]], issue_type: str) -> list[dict[str, Any]]:
    items = []
    for row in review_rows:
        for issue in row.get("issues") or []:
            if issue.get("type") == issue_type:
                items.append(
                    {
                        **issue,
                        "excelRow": row.get("excelRow"),
                        "objectContextKey": row.get("objectContextKey"),
                        "securityTechnicalService": row.get("securityTechnicalServiceKey"),
                        "securityTechnologyModuleOrMeasure": row.get("securityTechnologyModuleOrMeasure"),
                        "securitySystem": row.get("securitySystem"),
                    }
                )
    return items


def markdown_table(rows: list[dict[str, Any]], columns: list[tuple[str, str]], limit: int = 20) -> str:
    if not rows:
        return "_无_"
    lines = ["| " + " | ".join(label for _, label in columns) + " |", "| " + " | ".join("---" for _ in columns) + " |"]
    for row in rows[:limit]:
        lines.append("| " + " | ".join(str(row.get(key, "")).replace("\n", "<br>") for key, _ in columns) + " |")
    if len(rows) > limit:
        lines.append(f"| ... | 还有 {len(rows) - limit} 条 |" + " |" * (len(columns) - 2))
    return "\n".join(lines)


def build_markdown(audit: dict[str, Any]) -> str:
    summary = audit["summary"]
    issues = audit["issues"]
    lines = [
        "# Environment Module Catalog Consistency Audit",
        "",
        f"- 生成时间：{audit['generatedAt']}",
        f"- 原始文件：`{audit['workbook']}`",
        f"- 环境映射 normalized rows：`{summary['normalizedRowCount']}`",
        f"- 安全技术模块清单 catalogRelations：`{summary['catalogRelationCount']}`",
        f"- 完整重复关系：`{summary['duplicateExactServiceChildRelationCount']}`",
        f"- 合法服务多下级展开提示：`{summary['repeatedServiceWithDifferentChildrenCount']}`",
        f"- moduleServiceMismatch：`{summary['moduleServiceMismatchCount']}`",
        f"- systemModuleMismatch：`{summary['systemModuleMismatchCount']}`",
        f"- serviceModuleCoverageGapCandidate：`{summary['serviceModuleCoverageGapCandidateCount']}`",
        f"- moduleServiceCoverageGapCandidate：`{summary['moduleServiceCoverageGapCandidateCount']}`",
        f"- securitySystemCoverageOrMismatch：`{summary['securitySystemCoverageOrMismatchCount']}`",
        f"- moduleMeasureClassificationIssue：`{summary['moduleMeasureClassificationIssueCount']}`",
        f"- scopeCompletenessIssues：`{summary['scopeCompletenessIssueCount']}`",
        "",
        "## 样例问题",
        "",
        "### 模块-服务目录不一致",
        "",
        markdown_table(
            issues["moduleServiceMismatch"],
            [("excelRow", "Excel 行"), ("objectContextKey", "对象上下文"), ("securityTechnicalService", "服务"), ("securityTechnologyModuleOrMeasure", "模块")],
            limit=20,
        ),
        "",
        "### 系统-模块目录不一致",
        "",
        markdown_table(
            issues["systemModuleMismatch"],
            [("excelRow", "Excel 行"), ("objectContextKey", "对象上下文"), ("securitySystem", "安全系统"), ("securityTechnologyModuleOrMeasure", "模块")],
            limit=20,
        ),
        "",
        "### 安全系统缺失或错配候选",
        "",
        markdown_table(
            issues["securitySystemCoverageOrMismatch"],
            [("excelRow", "Excel 行"), ("objectContextKey", "对象上下文"), ("securityTechnologyModuleOrMeasure", "模块"), ("securitySystem", "实际系统")],
            limit=20,
        ),
        "",
        "## 结论",
        "",
        "- 本报告只做跨表一致性审计，不自动补齐、替换或修改正式业务数据。",
        "- `repeatedServiceWithDifferentChildren` 属于 1:N 展开的信息提示，不作为高风险错误。",
        "- `serviceModuleCoverageGapCandidate` / `moduleServiceCoverageGapCandidate` 只表示目录覆盖差异候选，需要人工判断环境映射表是否应完整列出。",
    ]
    return "\n".join(lines) + "\n"


def main() -> int:
    catalog_relations, catalog_sheet_summary = read_module_catalog(WORKBOOK_PATH)
    indices = build_catalog_indices(catalog_relations)
    normalized_rows = load_json(NORMALIZED_ROWS_PATH, [])
    scope_audit = load_json(SCOPE_AUDIT_PATH, {}) or {}
    workbench = load_json(WORKBENCH_PATH, {}) or {}
    module_titles = set(indices["securityTechnologyModuleToServices"].keys())
    measure_titles = measure_titles_from_workbench(workbench)
    review_rows = [
        make_review_row(entry, indices, module_titles, measure_titles)
        for entry in env_entries(normalized_rows)
    ]
    service_module_gaps, module_service_gaps = coverage_candidates(review_rows, indices)
    issues = {
        "moduleServiceMismatch": issue_items(review_rows, "moduleServiceMismatch"),
        "systemModuleMismatch": issue_items(review_rows, "systemModuleMismatch"),
        "serviceModuleCoverageGapCandidate": service_module_gaps,
        "moduleServiceCoverageGapCandidate": module_service_gaps,
        "securitySystemCoverageOrMismatch": issue_items(review_rows, "securitySystemCoverageOrMismatch"),
        "moduleMeasureClassificationIssue": issue_items(review_rows, "moduleMeasureClassificationIssue"),
        "scopeCompletenessIssues": scope_audit.get("scopeCompletenessIssues") or [],
    }
    summary = {
        "workbook": str(WORKBOOK_PATH.relative_to(PROJECT_ROOT)),
        "catalogSheet": catalog_sheet_summary,
        "normalizedRowCount": len(normalized_rows),
        "reviewRowCount": len(review_rows),
        "catalogRelationCount": len(catalog_relations),
        "duplicateExactServiceChildRelationCount": len(scope_audit.get("duplicateExactServiceChildRelations") or []),
        "repeatedServiceWithDifferentChildrenCount": len(scope_audit.get("repeatedServiceWithDifferentChildren") or []),
        "moduleServiceMismatchCount": len(issues["moduleServiceMismatch"]),
        "systemModuleMismatchCount": len(issues["systemModuleMismatch"]),
        "serviceModuleCoverageGapCandidateCount": len(service_module_gaps),
        "moduleServiceCoverageGapCandidateCount": len(module_service_gaps),
        "securitySystemCoverageOrMismatchCount": len(issues["securitySystemCoverageOrMismatch"]),
        "moduleMeasureClassificationIssueCount": len(issues["moduleMeasureClassificationIssue"]),
        "scopeCompletenessIssueCount": len(issues["scopeCompletenessIssues"]),
        "hasIusScopeGap": any("I-US" in item.get("missingScopes", []) for item in issues["scopeCompletenessIssues"]),
    }
    audit = {
        "generatedAt": datetime.now().isoformat(timespec="seconds"),
        "workbook": summary["workbook"],
        "summary": summary,
        "catalogRelations": catalog_relations,
        "catalogIndices": indices,
        "duplicateExactServiceChildRelations": scope_audit.get("duplicateExactServiceChildRelations") or [],
        "repeatedServiceWithDifferentChildren": scope_audit.get("repeatedServiceWithDifferentChildren") or [],
        "issues": issues,
        "reviewRowsPath": str(REVIEW_ROWS_OUT.relative_to(PROJECT_ROOT)),
        "conclusion": {
            "formalDataModified": False,
            "formalUiModified": False,
            "notes": "本轮只输出跨表一致性审计和临时核对行，不自动补全 environment-workbench 或 node-details。",
        },
    }
    write_json(AUDIT_JSON_OUT, audit)
    write_json(REVIEW_ROWS_OUT, review_rows)
    AUDIT_MD_OUT.write_text(build_markdown(audit), encoding="utf-8")
    print(json.dumps({"result": "pass", **summary}, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
