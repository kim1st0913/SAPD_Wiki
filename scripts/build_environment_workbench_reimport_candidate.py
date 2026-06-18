#!/usr/bin/env python3
"""Build an environment-workbench candidate from audited source-sheet relations.

The candidate is written under data/exports/worker-verify only. It never replaces
frontend/capability-browser/public/data/environment-workbench.json.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import sys
from collections import Counter, defaultdict
from datetime import datetime
from pathlib import Path
from typing import Any

PROJECT_ROOT = Path(__file__).resolve().parents[1]
SCRIPTS_DIR = PROJECT_ROOT / "scripts"
if str(SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPTS_DIR))

from audit_environment_module_catalog_consistency import read_module_catalog
from audit_scope_service_module_mapping import compare_relations, current_environment_relations, load_json, relation_identity

OUTPUT_DIR = PROJECT_ROOT / "data" / "exports" / "worker-verify"
NORMALIZED_ROWS_PATH = OUTPUT_DIR / "scope-service-module-mapping-normalized-rows.json"
RELATIONS_PATH = OUTPUT_DIR / "scope-service-module-mapping-relations.json"
AUDIT_PATH = OUTPUT_DIR / "scope-service-module-mapping-reimport-audit.json"
CURRENT_ENVIRONMENT_WORKBENCH = PROJECT_ROOT / "frontend" / "capability-browser" / "public" / "data" / "environment-workbench.json"
DEFAULT_WORKBOOK = PROJECT_ROOT / "data" / "raw-samples" / "wiki sample.xlsx"


def text(value: Any) -> str:
    return "" if value is None else str(value).strip()


def stable_id(*parts: Any) -> str:
    raw = "||".join(text(part) for part in parts)
    digest = hashlib.sha1(raw.encode("utf-8")).hexdigest()[:16]
    prefix = text(parts[0]) if parts else "candidate"
    return f"reimport:{prefix}:{digest}"


def write_json(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")


def relation_key(*parts: Any) -> str:
    return "||".join(text(part) for part in parts)


def object_context_key(row_or_environment: dict[str, Any] | Any, segment: Any = None, information_object: Any = None) -> str:
    if isinstance(row_or_environment, dict):
        return relation_key(row_or_environment.get("informationEnvironment"), row_or_environment.get("environmentSegment"), row_or_environment.get("informationObject"))
    return relation_key(row_or_environment, segment, information_object)


def compact_service(service: dict[str, Any] | None) -> dict[str, Any]:
    service = service or {}
    return {
        "id": stable_id("security_technical_service", service.get("code") or service.get("title")),
        "type": "security_technical_service",
        "code": text(service.get("code")),
        "title": text(service.get("title") or service.get("raw") or service.get("code")),
        "raw": text(service.get("raw")),
        "scopeCode": text(service.get("scopeCode")),
        "capabilityFocusCode": text(service.get("capabilityFocusCode")),
    }


def compact_scope(scope: dict[str, Any] | None) -> dict[str, Any]:
    scope = scope or {}
    code = text(scope.get("code"))
    title = text(scope.get("title") or scope.get("text") or code)
    return {
        "id": stable_id("scope_type", code or title),
        "type": "scope_type",
        "code": code,
        "title": title,
        "text": text(scope.get("text") or " ".join(part for part in [code, title] if part)),
    }


def compact_named(kind: str, title: str, raw: str = "") -> dict[str, Any]:
    return {
        "id": stable_id(kind, title),
        "type": kind,
        "title": text(title),
        "raw": text(raw),
    }


def duplicate_resolution(audit: dict[str, Any]) -> tuple[dict[str, Any], set[str]]:
    resolutions = []
    blocked = set()
    for item in audit.get("duplicateInformationObjectContexts", []):
        merged_ranges = set(item.get("mergedRanges") or [])
        if len(merged_ranges) == 1:
            status = "resolved_by_merged_range"
            reason = "同一 merged range 的自然展开，可进入候选主关系。"
        else:
            status = "blocked"
            reason = "同一完整上下文跨多个 object merged range，无法证明是自然展开，阻断进入候选主关系。"
            blocked.add(text(item.get("contextKey")))
        resolutions.append(
            {
                **item,
                "resolution": status,
                "resolutionReason": reason,
            }
        )
    counts = Counter(item["resolution"] for item in resolutions)
    payload = {
        "generatedAt": datetime.now().isoformat(timespec="seconds"),
        "sourceAudit": str(AUDIT_PATH.relative_to(PROJECT_ROOT)),
        "summary": {
            "totalDuplicateInformationObjectContexts": len(resolutions),
            "blocked": counts.get("blocked", 0),
            "requires_manual_review": counts.get("requires_manual_review", 0),
            "resolved_by_merged_range": counts.get("resolved_by_merged_range", 0),
            "sameNameDifferentContexts": len(audit.get("sameNameDifferentContexts", [])),
        },
        "duplicateInformationObjects": [],
        "duplicateInformationObjectContexts": resolutions,
        "sameNameDifferentContexts": audit.get("sameNameDifferentContexts", []),
    }
    return payload, blocked


def relation_is_blocked(row: dict[str, Any], blocked_contexts: set[str]) -> bool:
    return object_context_key(row) in blocked_contexts


def filtered_relations(relations: dict[str, list[dict[str, Any]]], blocked_contexts: set[str]) -> dict[str, list[dict[str, Any]]]:
    return {
        name: [row for row in rows if not relation_is_blocked(row, blocked_contexts)]
        for name, rows in relations.items()
    }


def authoritative_module_system_relations(relations: dict[str, list[dict[str, Any]]], workbook_path: Path) -> list[dict[str, Any]]:
    catalog_relations, _catalog_summary = read_module_catalog(workbook_path)
    module_systems: dict[str, dict[str, dict[str, Any]]] = defaultdict(dict)
    for item in catalog_relations:
        module_title = text(item.get("securityTechnologyModule"))
        system_title = text(item.get("securitySystem"))
        if not module_title or not system_title:
            continue
        module_systems[module_title][system_title] = {
            "title": system_title,
            "category": text(item.get("securitySystemCategory")),
            "sourceRows": sorted(set(module_systems[module_title].get(system_title, {}).get("sourceRows", []) + [item.get("sourceRow")])),
            "sourceCells": item.get("sourceCells") or {},
            "mergedRanges": item.get("mergedRanges") or {},
        }

    output: dict[str, dict[str, Any]] = {}
    for row in relations.get("serviceModuleRelations", []):
        module_title = text((row.get("module") or {}).get("title"))
        if not module_title:
            continue
        for system_title, system_payload in module_systems.get(module_title, {}).items():
            key = relation_key(row.get("informationEnvironment"), row.get("environmentSegment"), row.get("informationObject"), module_title, system_title)
            payload = output.setdefault(
                key,
                {
                    "informationEnvironment": row.get("informationEnvironment"),
                    "environmentSegment": row.get("environmentSegment"),
                    "informationObject": row.get("informationObject"),
                    "module": {"title": module_title, "raw": (row.get("module") or {}).get("raw", "")},
                    "securitySystem": {"title": system_title, "category": system_payload.get("category", "")},
                    "authoritySource": "安全技术模块清单",
                    "authoritySourceRows": system_payload.get("sourceRows", []),
                    "authoritySourceCells": system_payload.get("sourceCells", {}),
                    "authorityMergedRanges": system_payload.get("mergedRanges", {}),
                    "rows": [],
                },
            )
            for source_row in row.get("rows", []):
                if source_row not in payload["rows"]:
                    payload["rows"].append(source_row)
    return list(output.values())


def candidate_objects_and_rows(relations: dict[str, list[dict[str, Any]]]) -> tuple[list[dict[str, Any]], list[dict[str, Any]], list[dict[str, Any]]]:
    objects: dict[str, dict[str, Any]] = {}
    environment_rows: dict[str, dict[str, Any]] = {}
    scope_service_rows: dict[str, dict[str, Any]] = {}

    def add_object(payload: dict[str, Any]) -> dict[str, Any]:
        obj_id = payload["id"]
        objects[obj_id] = {**objects.get(obj_id, {}), **payload}
        return objects[obj_id]

    for row in relations.get("objectScopeRelations", []):
        env_title = text(row.get("informationEnvironment"))
        segment_title = text(row.get("environmentSegment"))
        object_title = text(row.get("informationObject"))
        context_key = object_context_key(env_title, segment_title, object_title)
        scope = compact_scope(row.get("scope"))
        env = add_object({"id": stable_id("information_environment", env_title), "type": "information_environment", "title": env_title})
        segment = add_object({"id": stable_id("environment_segment", env_title, segment_title), "type": "environment_segment", "title": segment_title, "environmentId": env["id"]})
        info_object = add_object(
            {
                "id": stable_id("information_object_context", env_title, segment_title, object_title),
                "type": "information_object",
                "title": object_title,
                "contextKey": context_key,
                "environmentId": env["id"],
                "segmentId": segment["id"],
            }
        )
        add_object(scope)
        environment_key = context_key
        environment_rows.setdefault(
            environment_key,
            {
                "id": stable_id("environment_row", environment_key),
                "contextKey": context_key,
                "environment": env,
                "segment": segment,
                "object": info_object,
                "scopes": [],
                "services": [],
                "modules": [],
                "measures": [],
                "securitySystems": [],
            },
        )
        if scope["id"] not in {item["id"] for item in environment_rows[environment_key]["scopes"]}:
            environment_rows[environment_key]["scopes"].append(scope)

    service_by_context: dict[str, dict[str, Any]] = {}
    for row in relations.get("objectServiceRelations", []):
        service = compact_service(row.get("service"))
        env_title = text(row.get("informationEnvironment"))
        segment_title = text(row.get("environmentSegment"))
        object_title = text(row.get("informationObject"))
        context_key = object_context_key(env_title, segment_title, object_title)
        add_object(service)
        service_by_context[relation_key(context_key, service.get("code") or service.get("title"))] = service
        if context_key in environment_rows and service["id"] not in {item["id"] for item in environment_rows[context_key]["services"]}:
            environment_rows[context_key]["services"].append(service)

    def ensure_scope_service_row(row: dict[str, Any]) -> dict[str, Any]:
        service = compact_service(row.get("service"))
        context_key = object_context_key(row)
        key = relation_key(context_key, service.get("code") or service.get("title"))
        env_row = environment_rows.setdefault(
            context_key,
            {
                "id": stable_id("environment_row", context_key),
                "contextKey": context_key,
                "environment": {"title": text(row.get("informationEnvironment"))},
                "segment": {"title": text(row.get("environmentSegment"))},
                "object": {"title": text(row.get("informationObject")), "contextKey": context_key},
                "scopes": [],
                "services": [],
                "modules": [],
                "measures": [],
                "securitySystems": [],
            },
        )
        scope_service_rows.setdefault(
            key,
            {
                "id": stable_id("scope_service_row", key),
                "contextKey": context_key,
                "environment": env_row["environment"],
                "segment": env_row["segment"],
                "object": env_row["object"],
                "service": service,
                "modules": [],
                "measures": [],
                "securitySystems": [],
                "sourceRows": [],
            },
        )
        for source_row in row.get("rows", []):
            if source_row not in scope_service_rows[key]["sourceRows"]:
                scope_service_rows[key]["sourceRows"].append(source_row)
        return scope_service_rows[key]

    for row in relations.get("serviceModuleRelations", []):
        module = compact_named("security_technology_module", (row.get("module") or {}).get("title"), (row.get("module") or {}).get("raw", ""))
        add_object(module)
        scope_row = ensure_scope_service_row(row)
        if module["id"] not in {item["id"] for item in scope_row["modules"]}:
            scope_row["modules"].append(module)
        context_key = object_context_key(row)
        if context_key in environment_rows and module["id"] not in {item["id"] for item in environment_rows[context_key]["modules"]}:
            environment_rows[context_key]["modules"].append(module)

    for row in relations.get("serviceMeasureRelations", []):
        measure = compact_named("security_technical_measure", (row.get("measure") or {}).get("title"), (row.get("measure") or {}).get("raw", ""))
        add_object(measure)
        scope_row = ensure_scope_service_row(row)
        if measure["id"] not in {item["id"] for item in scope_row["measures"]}:
            scope_row["measures"].append(measure)
        context_key = object_context_key(row)
        if context_key in environment_rows and measure["id"] not in {item["id"] for item in environment_rows[context_key]["measures"]}:
            environment_rows[context_key]["measures"].append(measure)

    for row in relations.get("moduleSystemRelations", []):
        system = compact_named("security_system", (row.get("securitySystem") or {}).get("title"))
        module_title = text((row.get("module") or {}).get("title"))
        add_object(system)
        context_key = object_context_key(row)
        if context_key in environment_rows and system["id"] not in {item["id"] for item in environment_rows[context_key]["securitySystems"]}:
            environment_rows[context_key]["securitySystems"].append(system)
        for scope_row in scope_service_rows.values():
            if scope_row.get("contextKey") != context_key:
                continue
            if module_title not in {item["title"] for item in scope_row["modules"]}:
                continue
            if system["id"] not in {item["id"] for item in scope_row["securitySystems"]}:
                scope_row["securitySystems"].append(system)

    return list(objects.values()), list(environment_rows.values()), list(scope_service_rows.values())


def candidate_relation_rows(relations: dict[str, list[dict[str, Any]]]) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    relation_specs = {
        "objectScopeRelations": "object_scope",
        "objectServiceRelations": "object_service",
        "serviceModuleRelations": "service_module",
        "serviceMeasureRelations": "service_measure",
        "moduleSystemRelations": "module_system",
    }
    for relation_name, relation_type in relation_specs.items():
        for row in relations.get(relation_name, []):
            identity = relation_identity(relation_name, row)
            rows.append(
                {
                    "id": stable_id("relation", relation_type, identity),
                    "type": relation_type,
                    "identity": identity,
                    "objectContextKey": object_context_key(row),
                    "sourceRows": row.get("rows", []),
                    "payload": row,
                }
            )
    return rows


def relation_set(relations: list[dict[str, Any]], relation_type: str) -> set[str]:
    return {row["identity"] for row in relations if row.get("type") == relation_type}


def diff_current_vs_candidate(candidate: dict[str, Any], current_environment_workbench: dict[str, Any], full_audit: dict[str, Any]) -> dict[str, Any]:
    current_relations = current_environment_relations(current_environment_workbench)
    candidate_relations_by_name = {
        "objectScopeRelations": [row["payload"] for row in candidate["relations"] if row["type"] == "object_scope"],
        "objectServiceRelations": [row["payload"] for row in candidate["relations"] if row["type"] == "object_service"],
        "serviceModuleRelations": [row["payload"] for row in candidate["relations"] if row["type"] == "service_module"],
        "serviceMeasureRelations": [row["payload"] for row in candidate["relations"] if row["type"] == "service_measure"],
        "moduleSystemRelations": [row["payload"] for row in candidate["relations"] if row["type"] == "module_system"],
    }
    comparison = compare_relations(candidate_relations_by_name, current_relations, max_items=500)
    blocked_issues = [issue for issue in candidate.get("issues", []) if issue.get("type") == "blocked_duplicate_information_object_context"]
    risk_level = "high" if blocked_issues or comparison["serviceMeasureRelations"]["unexpectedInCurrentJsonCount"] or comparison["moduleSystemRelations"]["missingInCurrentJsonCount"] else "medium"
    return {
        "generatedAt": datetime.now().isoformat(timespec="seconds"),
        "candidate": "data/exports/worker-verify/environment-workbench-reimport-candidate.json",
        "currentPackage": "frontend/capability-browser/public/data/environment-workbench.json",
        "comparison": comparison,
        "blockedDuplicateObjectContexts": blocked_issues,
        "riskLevel": risk_level,
        "impactedPages": [
            "信息化环境底图浮窗",
            "归纳表格",
            "环境对象详情",
            "技术模块/措施展示",
            "其他依赖 environment-workbench 的信息化环境页面",
        ],
        "trustAnswers": {
            "isCurrentEnvironmentWorkbenchTrusted": False,
            "canFrontendServiceModuleMeasureAnomaliesBeExplainedByImportErrors": True,
            "isPlusNInflationRelatedToDuplicateOrCrossObjectInheritance": bool(full_audit.get("currentJsonComparison", {}).get("crossObjectInheritanceSuspicions") or blocked_issues),
            "isCandidateReadyToReplacePublicPackage": False,
            "missingConfirmationBeforeReplacement": [
                "duplicateInformationObjectContexts 是否需要人工解除阻断",
                "blocked 对象对应页面是否应显示待确认状态或隐藏",
                "candidate 与底图 node-details / semantic 绑定是否需要同步重算",
                "候选包替换后的浏览器视图回归和字段边界验收",
            ],
        },
    }


def markdown_duplicate_report(resolution: dict[str, Any]) -> str:
    lines = [
        "# Duplicate Information Object Resolution Report",
        "",
        f"- 生成时间：{resolution['generatedAt']}",
        f"- 唯一键：`信息化环境 + 环境子类 + 信息化对象`",
        f"- blocked：{resolution['summary']['blocked']}",
        f"- requires_manual_review：{resolution['summary']['requires_manual_review']}",
        f"- resolved_by_merged_range：{resolution['summary']['resolved_by_merged_range']}",
        f"- sameNameDifferentContexts：{resolution['summary']['sameNameDifferentContexts']}",
        "",
        "| 上下文唯一键 | 信息化对象 | resolution | occurrences | merged ranges |",
        "|---|---|---:|---|---|",
    ]
    for item in resolution["duplicateInformationObjectContexts"]:
        lines.append(
            "| {context} | {name} | {status} | {count} | {ranges} |".format(
                context=text(item.get("contextKey")),
                name=text(item.get("informationObject")),
                status=text(item.get("resolution")),
                count=item.get("occurrences", 0),
                ranges="<br>".join(item.get("mergedRanges", [])[:8]),
            )
        )
    if resolution["sameNameDifferentContexts"]:
        lines.extend([
            "",
            "## Same Name Different Contexts",
            "",
            "| 信息化对象 | contexts |",
            "|---|---|",
        ])
        for item in resolution["sameNameDifferentContexts"]:
            lines.append(
                "| {name} | {contexts} |".format(
                    name=text(item.get("informationObject")),
                    contexts="<br>".join(context["contextKey"] for context in item.get("contexts", [])[:12]),
                )
            )
    return "\n".join(lines) + "\n"


def markdown_diff_report(diff: dict[str, Any], candidate: dict[str, Any]) -> str:
    comparison = diff["comparison"]
    lines = [
        "# Environment Workbench Reimport Candidate Diff",
        "",
        f"- 生成时间：{diff['generatedAt']}",
        f"- 替换风险等级：{diff['riskLevel']}",
        f"- 当前正式包是否可信：否",
        f"- 是否建议本轮直接替换正式包：否",
        "",
        "## Candidate Stats",
        "",
    ]
    for key, value in candidate["stats"].items():
        lines.append(f"- {key}: {value}")
    lines.extend(["", "## Relation Diff", ""])
    for name in ("objectScopeRelations", "objectServiceRelations", "serviceModuleRelations", "serviceMeasureRelations", "moduleSystemRelations"):
        item = comparison[name]
        lines.extend(
            [
                f"### {name}",
                "",
                f"- candidate：{item['expectedCount']}",
                f"- current：{item['actualCount']}",
                f"- 当前有、候选无：{item['unexpectedInCurrentJsonCount']}",
                f"- 候选有、当前无：{item['missingInCurrentJsonCount']}",
                "",
            ]
        )
    lines.extend(
        [
            "## Trust Answers",
            "",
            f"- 当前 environment-workbench.json 是否可继续作为可信事实源：否",
            f"- 当前前端服务 / 模块 / 措施异常是否能由导入错误解释：是",
            f"- 当前 +N 服务膨胀是否与重复上下文 / 跨对象继承相关：{'是' if diff['trustAnswers']['isPlusNInflationRelatedToDuplicateOrCrossObjectInheritance'] else '未确认'}",
            f"- 候选包是否足以替换正式包：否，需先确认 duplicate context 策略并做页面回归",
            "",
            "## Impacted Pages",
            "",
        ]
    )
    for page in diff["impactedPages"]:
        lines.append(f"- {page}")
    return "\n".join(lines) + "\n"


def build_candidate(args: argparse.Namespace) -> tuple[dict[str, Any], dict[str, Any], dict[str, Any]]:
    normalized_rows = load_json(PROJECT_ROOT / args.normalized_rows)
    relations = load_json(PROJECT_ROOT / args.relations)
    audit = load_json(PROJECT_ROOT / args.audit)
    current_environment_workbench = load_json(PROJECT_ROOT / args.current_environment_workbench)
    if not isinstance(normalized_rows, list) or not isinstance(relations, dict) or not isinstance(audit, dict) or not isinstance(current_environment_workbench, dict):
        raise SystemExit("Invalid input audit artifacts or current environment workbench package.")

    resolution, blocked_contexts = duplicate_resolution(audit)
    candidate_relations = filtered_relations(relations, blocked_contexts)
    candidate_relations["moduleSystemRelations"] = authoritative_module_system_relations(candidate_relations, PROJECT_ROOT / args.catalog_workbook)
    objects, environment_rows, scope_service_rows = candidate_objects_and_rows(candidate_relations)
    relation_rows = candidate_relation_rows(candidate_relations)
    blocked_rows = [row for row in normalized_rows if object_context_key(row) in blocked_contexts]
    pending_relations = relations.get("pendingRelations", [])

    issues = [
        {
            "type": "blocked_duplicate_information_object_context",
            "severity": "high",
            "contextKey": item["contextKey"],
            "environment": item["environment"],
            "environmentSegment": item["environmentSegment"],
            "informationObject": item["informationObject"],
            "resolution": item["resolution"],
            "reason": item["resolutionReason"],
            "rows": item.get("rows", []),
            "mergedRanges": item.get("mergedRanges", []),
        }
        for item in resolution["duplicateInformationObjectContexts"]
        if item["resolution"] == "blocked"
    ]
    issues.extend(
        {
            "type": "pending_relation",
            "severity": "medium",
            "reason": row.get("reason") or row.get("type") or "待确认关系",
            "rows": row.get("rows", []),
            "payload": row,
        }
        for row in pending_relations
    )
    issues.extend(
        {
            "type": "duplicate_service_in_object_context",
            "severity": row.get("severity", "high"),
            "contextKey": row.get("objectContextKey"),
            "environment": row.get("environment"),
            "environmentSegment": row.get("environmentSegment"),
            "informationObject": row.get("informationObject"),
            "securityTechnicalService": row.get("securityTechnicalService"),
            "rows": row.get("rows", []),
            "mergedRanges": row.get("mergedRanges", []),
            "reason": row.get("reason"),
        }
        for row in audit.get("duplicateServicesInObjectContext", [])
    )
    issues.extend(
        {
            "type": "scope_completeness_issue",
            "severity": row.get("severity", "medium"),
            "contextKey": row.get("objectContextKey"),
            "environment": row.get("environment"),
            "environmentSegment": row.get("environmentSegment"),
            "informationObject": row.get("informationObject"),
            "declaredScopes": row.get("declaredScopes", []),
            "requiredScopesFromServices": row.get("requiredScopesFromServices", []),
            "missingScopes": row.get("missingScopes", []),
            "servicesEvidence": row.get("servicesEvidence", []),
            "reason": row.get("reason"),
        }
        for row in audit.get("scopeCompletenessIssues", [])
    )

    stats = {
        "objectScopeRelations": len(candidate_relations.get("objectScopeRelations", [])),
        "objectServiceRelations": len(candidate_relations.get("objectServiceRelations", [])),
        "serviceModuleRelations": len(candidate_relations.get("serviceModuleRelations", [])),
        "serviceMeasureRelations": len(candidate_relations.get("serviceMeasureRelations", [])),
        "moduleSystemRelations": len(candidate_relations.get("moduleSystemRelations", [])),
        "blockedDuplicateObjectContexts": len(blocked_contexts),
        "sameNameDifferentContexts": len(resolution["sameNameDifferentContexts"]),
        "blockedSourceRows": len(blocked_rows),
        "issues": len(issues),
        "duplicateServicesInObjectContext": len(audit.get("duplicateServicesInObjectContext", [])),
        "scopeCompletenessIssues": len(audit.get("scopeCompletenessIssues", [])),
        "objects": len(objects),
        "environmentRows": len(environment_rows),
        "scopeServiceRows": len(scope_service_rows),
    }
    reimport_stats = {
        "objectScopeRelations": len(relations.get("objectScopeRelations", [])),
        "objectServiceRelations": len(relations.get("objectServiceRelations", [])),
        "serviceModuleRelations": len(relations.get("serviceModuleRelations", [])),
        "serviceMeasureRelations": len(relations.get("serviceMeasureRelations", [])),
        "moduleSystemRelations": len(relations.get("moduleSystemRelations", [])),
    }
    candidate = {
        "meta": {
            "version": "worker-verify-candidate-v1",
            "generatedAt": datetime.now().isoformat(timespec="seconds"),
            "sourceArtifacts": {
                "normalizedRows": args.normalized_rows,
                "relations": args.relations,
                "audit": args.audit,
            },
            "currentPackageCompared": args.current_environment_workbench,
            "replacementStatus": "candidate_only_not_public",
            "objectInstanceUniqueKey": "informationEnvironment + environmentSegment + informationObject",
            "duplicateObjectPolicy": "block_duplicate_context_only; same_name_different_context_is_info",
            "moduleSystemAuthority": "安全技术模块清单",
            "scopeMappingSheetRole": "作用域表只提供对象-服务-模块/措施使用关系；安全技术模块主数据和模块-安全系统归属不从作用域表 H 列生成。",
        },
        "objects": objects,
        "relations": relation_rows,
        "environmentRows": environment_rows,
        "scopeServiceRows": scope_service_rows,
        "issues": issues,
        "stats": stats,
        "reimportStatsBeforeDuplicateBlocking": reimport_stats,
        "blockedDuplicateObjects": [],
        "blockedDuplicateObjectContexts": resolution["duplicateInformationObjectContexts"],
        "sameNameDifferentContexts": resolution["sameNameDifferentContexts"],
    }
    diff = diff_current_vs_candidate(candidate, current_environment_workbench, audit)
    return candidate, resolution, diff


def main() -> int:
    parser = argparse.ArgumentParser(description="Build environment-workbench reimport candidate from worker-verify audit relations.")
    parser.add_argument("--normalized-rows", default="data/exports/worker-verify/scope-service-module-mapping-normalized-rows.json")
    parser.add_argument("--relations", default="data/exports/worker-verify/scope-service-module-mapping-relations.json")
    parser.add_argument("--audit", default="data/exports/worker-verify/scope-service-module-mapping-reimport-audit.json")
    parser.add_argument("--current-environment-workbench", default="frontend/capability-browser/public/data/environment-workbench.json")
    parser.add_argument("--catalog-workbook", default="data/raw-samples/wiki sample.xlsx")
    parser.add_argument("--output-dir", default="data/exports/worker-verify")
    args = parser.parse_args()

    output_dir = PROJECT_ROOT / args.output_dir
    output_dir.mkdir(parents=True, exist_ok=True)
    candidate, resolution, diff = build_candidate(args)

    write_json(output_dir / "duplicate-object-resolution-report.json", resolution)
    write_json(output_dir / "environment-workbench-reimport-candidate.json", candidate)
    write_json(output_dir / "environment-workbench-reimport-candidate-diff.json", diff)
    (output_dir / "duplicate-object-resolution-report.md").write_text(markdown_duplicate_report(resolution), encoding="utf-8")
    (output_dir / "environment-workbench-reimport-candidate-diff.md").write_text(markdown_diff_report(diff, candidate), encoding="utf-8")

    print(
        json.dumps(
            {
                "result": "pass",
                "candidateStats": candidate["stats"],
                "reimportStatsBeforeDuplicateBlocking": candidate["reimportStatsBeforeDuplicateBlocking"],
                "duplicateResolution": resolution["summary"],
                "riskLevel": diff["riskLevel"],
                "isCurrentEnvironmentWorkbenchTrusted": diff["trustAnswers"]["isCurrentEnvironmentWorkbenchTrusted"],
                "isCandidateReadyToReplacePublicPackage": diff["trustAnswers"]["isCandidateReadyToReplacePublicPackage"],
            },
            ensure_ascii=False,
            indent=2,
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
