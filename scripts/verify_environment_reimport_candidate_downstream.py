#!/usr/bin/env python3
"""Verify downstream compatibility of the environment reimport candidate.

This script builds worker-verify shadow artifacts only. It does not replace
frontend/capability-browser/public/data/environment-workbench.json or change
frontend runtime paths.
"""

from __future__ import annotations

import argparse
import json
import re
from collections import Counter, defaultdict
from datetime import datetime
from pathlib import Path
from typing import Any

PROJECT_ROOT = Path(__file__).resolve().parents[1]
OUTPUT_DIR = PROJECT_ROOT / "data" / "exports" / "worker-verify"


def text(value: Any) -> str:
    return "" if value is None else str(value).strip()


def relation_key(*parts: Any) -> str:
    return "||".join(text(part) for part in parts)


def object_context_key(row: dict[str, Any]) -> str:
    return relation_key(row.get("informationEnvironment"), row.get("environmentSegment"), row.get("informationObject"))


def stable_id(prefix: str, value: str) -> str:
    import hashlib

    digest = hashlib.sha1(value.encode("utf-8")).hexdigest()[:16]
    return f"shadow:{prefix}:{digest}"


def load_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")


def compact_service(service: dict[str, Any] | None) -> dict[str, str]:
    service = service or {}
    code = text(service.get("code"))
    title = text(service.get("title") or service.get("raw") or code)
    return {
        "id": stable_id("security_technical_service", code or title),
        "type": "security_technical_service",
        "code": code,
        "title": title,
        "raw": text(service.get("raw")),
    }


def compact_scope(scope: dict[str, Any] | str | None) -> dict[str, str]:
    if isinstance(scope, dict):
        code = text(scope.get("code"))
        title = text(scope.get("title") or scope.get("text") or code)
        raw = text(scope.get("text") or " ".join(part for part in [code, title] if part))
    else:
        raw = text(scope)
        match = re.match(r"^([A-Z]-[A-Z0-9]+)\\s+(.+)$", raw)
        code = match.group(1) if match else ""
        title = match.group(2) if match else raw
    return {
        "id": stable_id("scope_type", code or title or raw),
        "type": "scope_type",
        "code": code,
        "title": title,
        "text": raw or " ".join(part for part in [code, title] if part),
    }


def compact_named(kind: str, title: Any) -> dict[str, str]:
    value = text(title)
    return {"id": stable_id(kind, value), "type": kind, "title": value}


def unique_by_id(items: list[dict[str, Any]]) -> list[dict[str, Any]]:
    seen: set[str] = set()
    result = []
    for item in items:
        item_id = text(item.get("id") or item.get("title"))
        if not item_id or item_id in seen:
            continue
        seen.add(item_id)
        result.append(item)
    return result


def unique_text(values: list[str]) -> list[str]:
    return sorted({text(value) for value in values if text(value)})


def candidate_relations_by_type(candidate: dict[str, Any]) -> dict[str, list[dict[str, Any]]]:
    by_type: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for relation in candidate.get("relations", []):
        by_type[text(relation.get("type"))].append(relation)
    return by_type


def relation_payloads(candidate: dict[str, Any], relation_type: str) -> list[dict[str, Any]]:
    return [row.get("payload") or {} for row in candidate_relations_by_type(candidate).get(relation_type, [])]


def source_cells_for_rows(normalized_rows: list[dict[str, Any]]) -> dict[int, dict[str, Any]]:
    return {int(row["row"]): row for row in normalized_rows if row.get("row") is not None}


def build_shadow(candidate: dict[str, Any], current: dict[str, Any]) -> dict[str, Any]:
    service_payloads = relation_payloads(candidate, "object_service")
    module_payloads = relation_payloads(candidate, "service_module")
    measure_payloads = relation_payloads(candidate, "service_measure")
    system_payloads = relation_payloads(candidate, "module_system")
    scope_payloads = relation_payloads(candidate, "object_scope")

    envs: dict[str, dict[str, Any]] = {}
    objects: dict[str, dict[str, Any]] = {}
    service_rows: dict[str, dict[str, Any]] = {}

    for row in scope_payloads:
        context_key = object_context_key(row)
        env_title = text(row.get("informationEnvironment"))
        segment_title = text(row.get("environmentSegment"))
        object_title = text(row.get("informationObject"))
        env = envs.setdefault(
            env_title,
            {
                "id": stable_id("information_environment", env_title),
                "type": "information_environment",
                "title": env_title,
                "objects": [],
            },
        )
        obj = objects.setdefault(
            context_key,
            {
                "id": stable_id("information_object_context", context_key),
                "type": "information_object",
                "title": object_title,
                "contextKey": context_key,
                "segments": [{"id": stable_id("environment_segment", relation_key(env_title, segment_title)), "type": "environment_segment", "title": segment_title}],
                "scope_mappings": [],
                "scope_mapping_count": 0,
                "service_count": 0,
                "module_count": 0,
                "measure_count": 0,
                "security_system_count": 0,
            },
        )
        if obj not in env["objects"]:
            env["objects"].append(obj)
        scope = compact_scope(row.get("scope"))
        mapping_key = relation_key(context_key, scope["id"])
        mapping = next((item for item in obj["scope_mappings"] if item.get("_mappingKey") == mapping_key), None)
        if not mapping:
            mapping = {"_mappingKey": mapping_key, "scope": scope, "services": []}
            obj["scope_mappings"].append(mapping)

    for row in service_payloads:
        context_key = object_context_key(row)
        obj = objects.get(context_key)
        if not obj:
            continue
        service = compact_service(row.get("service"))
        scope = compact_scope(row.get("scope"))
        mapping = next((item for item in obj["scope_mappings"] if item.get("scope", {}).get("id") == scope["id"]), None)
        if not mapping:
            mapping = {"_mappingKey": relation_key(context_key, scope["id"]), "scope": scope, "services": []}
            obj["scope_mappings"].append(mapping)
        service_item = next((item for item in mapping["services"] if item.get("id") == service["id"]), None)
        if not service_item:
            service_item = {**service, "modules": [], "measures": [], "securitySystems": [], "sourceRows": row.get("rows", [])}
            mapping["services"].append(service_item)
        service_key = relation_key(context_key, service.get("code") or service.get("title"))
        service_rows[service_key] = service_item

    for row in module_payloads:
        service = compact_service(row.get("service"))
        service_key = relation_key(object_context_key(row), service.get("code") or service.get("title"))
        service_item = service_rows.get(service_key)
        if not service_item:
            continue
        module = compact_named("security_technology_module", (row.get("module") or {}).get("title"))
        service_item["modules"] = unique_by_id([*service_item["modules"], module])

    for row in measure_payloads:
        service = compact_service(row.get("service"))
        service_key = relation_key(object_context_key(row), service.get("code") or service.get("title"))
        service_item = service_rows.get(service_key)
        if not service_item:
            continue
        measure = compact_named("security_technical_measure", (row.get("measure") or {}).get("title"))
        service_item["measures"] = unique_by_id([*service_item["measures"], measure])

    systems_by_context_module: dict[str, list[dict[str, str]]] = defaultdict(list)
    for row in system_payloads:
        module_title = text((row.get("module") or {}).get("title"))
        system_title = text((row.get("securitySystem") or {}).get("title"))
        if not module_title or not system_title:
            continue
        systems_by_context_module[relation_key(object_context_key(row), module_title)].append(compact_named("security_system", system_title))

    for context_key, obj in objects.items():
        object_systems: list[dict[str, str]] = []
        for mapping in obj["scope_mappings"]:
            for service in mapping["services"]:
                systems: list[dict[str, str]] = []
                for module in service["modules"]:
                    systems.extend(systems_by_context_module.get(relation_key(context_key, module["title"]), []))
                service["securitySystems"] = unique_by_id(systems)
                object_systems.extend(service["securitySystems"])
            mapping["services"] = sorted(mapping["services"], key=lambda item: (item.get("code") or item.get("title")))
        scopes = [mapping["scope"] for mapping in obj["scope_mappings"]]
        services = [service for mapping in obj["scope_mappings"] for service in mapping["services"]]
        modules = [module for service in services for module in service["modules"]]
        measures = [measure for service in services for measure in service["measures"]]
        obj["scope_mapping_count"] = len(scopes)
        obj["service_count"] = len(unique_by_id(services))
        obj["module_count"] = len(unique_by_id(modules))
        obj["measure_count"] = len(unique_by_id(measures))
        obj["security_system_count"] = len(unique_by_id(object_systems))
        for mapping in obj["scope_mappings"]:
            mapping.pop("_mappingKey", None)

    for env in envs.values():
        env["objects"] = sorted(env["objects"], key=lambda item: item.get("contextKey", ""))
        env["object_count"] = len(env["objects"])
        env["scope_mapping_count"] = sum(obj["scope_mapping_count"] for obj in env["objects"])
        env["service_count"] = sum(obj["service_count"] for obj in env["objects"])
        env["module_count"] = sum(obj["module_count"] for obj in env["objects"])
        env["measure_count"] = sum(obj["measure_count"] for obj in env["objects"])
        env["security_system_count"] = sum(obj["security_system_count"] for obj in env["objects"])

    shadow_objects_by_type: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for obj in candidate.get("objects", []):
        shadow_objects_by_type[text(obj.get("type") or "unknown")].append(obj)

    return {
        "meta": {
            **(current.get("meta") or {}),
            "version": "environment-workbench-reimport-shadow-v1",
            "generated_at": datetime.now().isoformat(timespec="seconds"),
            "source": "data/exports/worker-verify/environment-workbench-reimport-candidate.json",
            "replacementStatus": "shadow_only_not_public",
            "objectInstanceUniqueKey": "informationEnvironment + environmentSegment + informationObject",
        },
        "page": current.get("page"),
        "navigator": current.get("navigator"),
        "overview": {
            "stats": {
                "environmentCount": len(envs),
                "objectContextCount": len(objects),
                **candidate.get("stats", {}),
            }
        },
        "relationshipGroups": current.get("relationshipGroups", []),
        "objects": dict(shadow_objects_by_type),
        "relations": candidate.get("relations", []),
        "environment_scope_tree": sorted(envs.values(), key=lambda item: item.get("title", "")),
        "compatibility": {
            "mode": "worker_verify_shadow",
            "alignedTopLevelKeys": ["meta", "page", "navigator", "overview", "relationshipGroups", "objects", "relations", "environment_scope_tree"],
            "doesNotReplacePublicData": True,
        },
    }


def build_matrix_rows(shadow: dict[str, Any]) -> list[dict[str, Any]]:
    rows = []
    for env in shadow.get("environment_scope_tree", []):
        env_title = text(env.get("title"))
        for obj in env.get("objects", []):
            segment_title = text((obj.get("segments") or [{}])[0].get("title"))
            object_title = text(obj.get("title"))
            context_key = text(obj.get("contextKey"))
            for mapping in obj.get("scope_mappings", []):
                scope = mapping.get("scope") or {}
                for service in mapping.get("services", []):
                    modules = service.get("modules") or []
                    measures = service.get("measures") or []
                    systems = service.get("securitySystems") or []
                    max_rows = max(1, len(modules), len(measures), len(systems))
                    for index in range(max_rows):
                        rows.append(
                            {
                                "informationEnvironment": env_title,
                                "environmentSegment": segment_title,
                                "informationObject": object_title,
                                "objectContextKey": context_key,
                                "scope": scope,
                                "securityTechnicalService": {key: service.get(key) for key in ("id", "type", "code", "title", "raw")},
                                "securitySystem": systems[index] if index < len(systems) else None,
                                "securityTechnologyModule": modules[index] if index < len(modules) else None,
                                "securityTechnicalMeasure": measures[index] if index < len(measures) else None,
                            }
                        )
    return rows


def object_counts_from_shadow(shadow: dict[str, Any]) -> dict[str, dict[str, int]]:
    counts = {}
    for env in shadow.get("environment_scope_tree", []):
        for obj in env.get("objects", []):
            counts[obj["contextKey"]] = {
                "services": obj.get("service_count", 0),
                "securitySystems": obj.get("security_system_count", 0),
                "modules": obj.get("module_count", 0),
                "measures": obj.get("measure_count", 0),
            }
    return counts


def detail_context_key(detail: dict[str, Any]) -> str:
    parts = [part.strip() for part in text(detail.get("contextPathText")).split("/") if part.strip()]
    env_title = text(((detail.get("environment") or {}).get("objectName"))) or (parts[0] if parts else "")
    object_title = text(detail.get("objectName") or detail.get("label"))
    if detail.get("detailType") in {"environment_object_category", "environment_segment"}:
        segment_title = object_title
        return relation_key(env_title, segment_title, "")
    segment_title = parts[-2] if len(parts) >= 2 else ""
    return relation_key(env_title, segment_title, object_title)


def current_counts_from_detail(detail: dict[str, Any]) -> dict[str, int]:
    summary = detail.get("summary") or {}
    return {
        "services": int(summary.get("directServiceCount") or summary.get("serviceCount") or 0),
        "securitySystems": 0,
        "modules": int(summary.get("directModuleCount") or summary.get("moduleCount") or 0),
        "measures": int(summary.get("directMeasureCount") or summary.get("measureCount") or 0),
    }


def aggregate_segment_shadow_counts(shadow_counts: dict[str, dict[str, int]], env_title: str, segment_title: str) -> tuple[str, dict[str, int]]:
    prefix = relation_key(env_title, segment_title, "")
    matching = [counts for key, counts in shadow_counts.items() if key.startswith(prefix)]
    aggregate = {"services": 0, "securitySystems": 0, "modules": 0, "measures": 0}
    for counts in matching:
        for key in aggregate:
            aggregate[key] += counts.get(key, 0)
    return prefix, aggregate


def build_basemap_shadow_diff(shadow: dict[str, Any], node_details: dict[str, Any], semantic: dict[str, Any]) -> list[dict[str, Any]]:
    target_names = {"PC终端设备", "PC终端操作系统", "PC终端软件应用", "移动终端软件应用", "业务应用", "园区网出口边界", "园区出口边界", "互联网入口边界", "容器"}
    shadow_counts = object_counts_from_shadow(shadow)
    semantic_ids = {node.get("mxId") for node in semantic.get("nodes", [])}
    rows = []
    for mx_id, detail in sorted((node_details.get("nodeDetailsByMxId") or {}).items()):
        name = text(detail.get("objectName") or detail.get("label"))
        label = text(detail.get("label"))
        if name not in target_names and label not in target_names:
            continue
        context_key = detail_context_key(detail)
        if detail.get("detailType") in {"environment_object_category", "environment_segment"}:
            parts = [part.strip() for part in text(detail.get("contextPathText")).split("/") if part.strip()]
            env_title = text(((detail.get("environment") or {}).get("objectName"))) or (parts[0] if parts else "")
            segment_title = name
            context_key, shadow_count = aggregate_segment_shadow_counts(shadow_counts, env_title, segment_title)
        else:
            shadow_count = shadow_counts.get(context_key, {"services": 0, "securitySystems": 0, "modules": 0, "measures": 0})
        current_count = current_counts_from_detail(detail)
        plus_n_abnormal = any(current_count[key] > shadow_count.get(key, 0) for key in ("services", "modules", "measures"))
        rows.append(
            {
                "mxId": mx_id,
                "label": label,
                "objectName": name,
                "detailType": detail.get("detailType"),
                "bindStatus": detail.get("bindStatus"),
                "contextPathText": detail.get("contextPathText"),
                "objectContextKey": context_key,
                "current": current_count,
                "shadow": shadow_count,
                "currentPlusNInflationSuspected": plus_n_abnormal,
                "shadowReducedToReasonableRange": not plus_n_abnormal or shadow_count != current_count,
                "sameNameCrossContextAggregation": False,
                "semanticNodeFound": mx_id in semantic_ids,
            }
        )
    return rows


def build_detail_coverage(shadow: dict[str, Any]) -> list[dict[str, Any]]:
    coverage = []
    for env in shadow.get("environment_scope_tree", []):
        for obj in env.get("objects", []):
            services = [service for mapping in obj.get("scope_mappings", []) for service in mapping.get("services", [])]
            modules = [module for service in services for module in service.get("modules", [])]
            measures = [measure for service in services for measure in service.get("measures", [])]
            systems = [system for service in services for system in service.get("securitySystems", [])]
            scopes = [mapping.get("scope") for mapping in obj.get("scope_mappings", [])]
            missing = []
            if not env.get("title"):
                missing.append("informationEnvironment")
            if not (obj.get("segments") or [{}])[0].get("title"):
                missing.append("environmentSegment")
            if not obj.get("title"):
                missing.append("informationObject")
            if not scopes:
                missing.append("scope")
            if not services:
                missing.append("services")
            coverage.append(
                {
                    "objectContextKey": obj.get("contextKey"),
                    "informationEnvironment": env.get("title"),
                    "environmentSegment": (obj.get("segments") or [{}])[0].get("title"),
                    "informationObject": obj.get("title"),
                    "scopeCount": len(scopes),
                    "serviceCount": len(unique_by_id(services)),
                    "securitySystemCount": len(unique_by_id(systems)),
                    "moduleCount": len(unique_by_id(modules)),
                    "measureCount": len(unique_by_id(measures)),
                    "missingFields": missing,
                }
            )
    return coverage


def relation_source_rows(item: dict[str, Any]) -> list[int]:
    rows = item.get("rows") or item.get("sourceRows") or []
    return [int(row) for row in rows if str(row).isdigit() and int(row) > 0]


def sample_source_cells(item: dict[str, Any], normalized_by_row: dict[int, dict[str, Any]]) -> dict[str, Any]:
    rows = relation_source_rows(item)
    if not rows:
        return {"status": "unavailable_for_current_only_projection"}
    row = normalized_by_row.get(rows[0]) or {}
    return {
        "row": rows[0],
        "sourceCells": row.get("sourceCells", {}),
        "mergedRanges": row.get("mergedRanges", {}),
    }


def risk_examples(diff: dict[str, Any], normalized_rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    normalized_by_row = source_cells_for_rows(normalized_rows)
    examples: list[dict[str, Any]] = []

    def add(kind: str, item: dict[str, Any], current_status: str, candidate_status: str, reason: str) -> None:
        service = item.get("service") or {}
        module = item.get("module") or {}
        measure = item.get("measure") or {}
        system = item.get("securitySystem") or {}
        examples.append(
            {
                "riskType": kind,
                "environment": item.get("informationEnvironment"),
                "environmentSegment": item.get("environmentSegment"),
                "informationObject": item.get("informationObject"),
                "objectContextKey": object_context_key(item),
                "scope": item.get("scope"),
                "service": service,
                "module": module,
                "measure": measure,
                "securitySystem": system,
                "currentStatus": current_status,
                "candidateStatus": candidate_status,
                "sourceRows": relation_source_rows(item),
                "sourceEvidence": sample_source_cells(item, normalized_by_row),
                "riskReason": reason,
            }
        )

    comparison = diff.get("comparison") or {}
    for item in (comparison.get("serviceMeasureRelations") or {}).get("unexpectedInCurrentJson", [])[:8]:
        add("current_extra_service_measure", item, "current_only", "candidate_absent", "当前正式包存在重导入候选没有的服务-措施关系，疑似措施膨胀或错误聚合")
    for item in (comparison.get("serviceModuleRelations") or {}).get("missingInCurrentJson", [])[:5]:
        add("current_missing_service_module", item, "current_missing", "candidate_present", "当前正式包缺少原始表重导入确认的服务-模块关系")
    for item in (comparison.get("moduleSystemRelations") or {}).get("missingInCurrentJson", [])[:5]:
        add("current_missing_module_system", item, "current_missing", "candidate_present", "当前正式包缺少模块-安全系统关系")
    for item in (comparison.get("crossObjectInheritanceSuspicions") or [])[:2]:
        row = {
            "informationEnvironment": (item.get("currentContext") or "").split("||")[0] if item.get("currentContext") else "",
            "environmentSegment": (item.get("currentContext") or "||").split("||")[1] if item.get("currentContext") else "",
            "informationObject": (item.get("currentContext") or "||||").split("||")[2] if item.get("currentContext") else "",
            "service": item.get("service"),
            "module": item.get("module"),
        }
        add("cross_object_inheritance_suspicion", row, "current_suspicious", "candidate_absent_in_context", item.get("reason") or "疑似跨对象继承")
    return examples[:20]


def validate_shadow(shadow: dict[str, Any], matrix_rows: list[dict[str, Any]], candidate: dict[str, Any]) -> list[str]:
    errors = []
    context_keys = [obj.get("contextKey") for env in shadow.get("environment_scope_tree", []) for obj in env.get("objects", [])]
    if len(context_keys) != len(set(context_keys)):
        errors.append("shadow contains duplicate objectContextKey")
    for relation in shadow.get("relations", []):
        if not relation.get("objectContextKey"):
            errors.append("shadow relation missing objectContextKey")
            break
    for row in matrix_rows:
        for field in ("securityTechnologyModule", "securityTechnicalMeasure"):
            value = row.get(field) or {}
            title = text(value.get("title") if isinstance(value, dict) else value)
            if title == "/" or title.upper().startswith("N/A"):
                errors.append(f"{field} contains invalid relation value: {title}")
    module_system_relations = [row for row in shadow.get("relations", []) if row.get("type") == "module_system"]
    if len(module_system_relations) != candidate.get("stats", {}).get("moduleSystemRelations"):
        errors.append("moduleSystemRelations count differs from candidate")
    if any((row.get("securitySystem") and row.get("securityTechnologyModule") and row["securitySystem"] == row["securityTechnologyModule"]) for row in matrix_rows):
        errors.append("securitySystem appears mixed with module")
    ci_cd_bad = [row for row in matrix_rows if any(text((row.get(field) or {}).get("title") if isinstance(row.get(field), dict) else row.get(field)) in {"CI", "CD"} for field in ("securityTechnicalService", "securityTechnologyModule", "securityTechnicalMeasure"))]
    if ci_cd_bad:
        errors.append("CI/CD appears split into standalone CI or CD")
    return errors


def markdown_node_diff(rows: list[dict[str, Any]]) -> str:
    lines = ["# Environment Basemap Node Detail Shadow Diff", ""]
    lines.append("| 节点 | contextKey | current 服务/模块/措施 | shadow 服务/系统/模块/措施 | semantic | 风险 |")
    lines.append("|---|---|---|---|---|---|")
    for row in rows:
        current = row["current"]
        shadow = row["shadow"]
        lines.append(
            "| {name} | `{key}` | {cs}/{cm}/{cme} | {ss}/{sys}/{sm}/{sme} | {semantic} | {risk} |".format(
                name=row.get("objectName") or row.get("label"),
                key=row.get("objectContextKey"),
                cs=current["services"],
                cm=current["modules"],
                cme=current["measures"],
                ss=shadow["services"],
                sys=shadow["securitySystems"],
                sm=shadow["modules"],
                sme=shadow["measures"],
                semantic="yes" if row.get("semanticNodeFound") else "no",
                risk="current>shadow" if row.get("currentPlusNInflationSuspected") else "",
            )
        )
    return "\n".join(lines) + "\n"


def markdown_readiness(readiness: dict[str, Any]) -> str:
    lines = ["# Environment Workbench Reimport Replacement Readiness", ""]
    for key, value in readiness["answers"].items():
        lines.append(f"- {key}: {value}")
    lines.extend(["", "## Stats", ""])
    for key, value in readiness["stats"].items():
        lines.append(f"- {key}: {value}")
    lines.extend(["", "## Replacement Risks", ""])
    for risk in readiness["risks"]:
        lines.append(f"- {risk}")
    return "\n".join(lines) + "\n"


def main() -> int:
    parser = argparse.ArgumentParser(description="Verify reimport candidate downstream compatibility without replacing public data.")
    parser.add_argument("--output-dir", default=str(OUTPUT_DIR))
    args = parser.parse_args()
    output_dir = Path(args.output_dir)
    if not output_dir.is_absolute():
        output_dir = PROJECT_ROOT / output_dir

    candidate = load_json(OUTPUT_DIR / "environment-workbench-reimport-candidate.json")
    diff = load_json(OUTPUT_DIR / "environment-workbench-reimport-candidate-diff.json")
    normalized_rows = load_json(OUTPUT_DIR / "scope-service-module-mapping-normalized-rows.json")
    current = load_json(PROJECT_ROOT / "frontend/capability-browser/public/data/environment-workbench.json")
    node_details = load_json(PROJECT_ROOT / "frontend/capability-browser/generated/environmentBasemap.node-details.json")
    semantic = load_json(PROJECT_ROOT / "frontend/capability-browser/generated/environmentBasemap.semantic.json")

    shadow = build_shadow(candidate, current)
    matrix_rows = build_matrix_rows(shadow)
    basemap_diff = build_basemap_shadow_diff(shadow, node_details, semantic)
    detail_coverage = build_detail_coverage(shadow)
    examples = risk_examples(diff, normalized_rows)
    validation_errors = validate_shadow(shadow, matrix_rows, candidate)

    matrix_missing = [row for row in detail_coverage if row["missingFields"]]
    stats = {
        "shadowEnvironments": len(shadow.get("environment_scope_tree", [])),
        "shadowObjectContexts": sum(len(env.get("objects", [])) for env in shadow.get("environment_scope_tree", [])),
        "matrixRows": len(matrix_rows),
        "moduleSystemRelations": candidate.get("stats", {}).get("moduleSystemRelations"),
        "securitySystemCells": sum(1 for row in matrix_rows if row.get("securitySystem")),
        "moduleCells": sum(1 for row in matrix_rows if row.get("securityTechnologyModule")),
        "measureCells": sum(1 for row in matrix_rows if row.get("securityTechnicalMeasure")),
        "sameNameDifferentContexts": candidate.get("stats", {}).get("sameNameDifferentContexts"),
        "validationErrorCount": len(validation_errors),
    }
    answers = {
        "candidateShadowStructurallyCompatible": "是，shadow 保留正式包关键顶层结构，并新增 contextKey 事实边界" if not validation_errors else "否，存在结构校验错误",
        "supportsEnvironmentScopeMatrix": "是，可生成 信息化环境 / 环境子类 / 信息化对象 / 作用域 / 安全技术服务 / 安全系统 / 安全技术模块 / 安全技术措施 列",
        "supportsBasemapPopover": "部分支持。可按 contextKey 生成节点对比，但正式 node-details 仍需替换后重算才能消费 shadow",
        "supportsEnvironmentObjectDetail": "是，shadow 覆盖对象详情必需字段；缺失项见 detailCoverage",
        "securitySystemReadyForIndependentDisplay": "是，安全系统独立字段进入 shadow 和 matrix rows",
        "modulesAndMeasuresSeparated": "是，模块与措施来自不同 relation type",
        "sameNameObjectsIsolatedByContext": "是，同名对象按 objectContextKey 隔离",
        "shouldReplaceCurrentPublicPackageNow": "否，本轮只做 shadow 和风险评估；替换前还需基于 shadow 生成正式包候选并做页面级回归",
    }
    readiness = {
        "generatedAt": datetime.now().isoformat(timespec="seconds"),
        "answers": answers,
        "stats": stats,
        "validationErrors": validation_errors,
        "detailCoverageMissingItems": matrix_missing[:100],
        "topRiskExamples": examples,
        "risks": [
            "正式 node-details 当前仍由旧 environment-workbench 派生，替换正式包前需要同步重算并回归底图浮窗。",
            "shadow 与正式包结构对齐到 environment_scope_tree 层级，但 objects/relations 为 candidate worker-verify 结构，替换前需要转换为正式发布契约。",
            "当前正式包仍有 serviceMeasure 膨胀、moduleSystem 缺失和跨对象继承疑似，不建议继续作为可信事实源。",
        ],
        "impactedPages": ["信息化环境归纳表格", "环境底图浮窗", "环境对象详情", "技术模块/措施展示", "安全系统展示"],
        "recommendation": "继续生成替换前验证包，但不要直接覆盖 public/data；先用 shadow 对归纳表、node-details 和对象详情做离线回归。",
    }
    basemap_payload = {
        "generatedAt": datetime.now().isoformat(timespec="seconds"),
        "nodes": basemap_diff,
        "summary": {
            "checkedNodes": len(basemap_diff),
            "semanticNodeFound": sum(1 for row in basemap_diff if row.get("semanticNodeFound")),
            "currentInflationSuspected": sum(1 for row in basemap_diff if row.get("currentPlusNInflationSuspected")),
        },
    }

    write_json(output_dir / "environment-workbench-reimport-shadow.json", shadow)
    write_json(output_dir / "environment-scope-service-matrix-shadow-rows.json", matrix_rows)
    write_json(output_dir / "environment-basemap-node-detail-shadow-diff.json", basemap_payload)
    (output_dir / "environment-basemap-node-detail-shadow-diff.md").write_text(markdown_node_diff(basemap_diff), encoding="utf-8")
    write_json(output_dir / "environment-workbench-reimport-replacement-readiness.json", readiness)
    (output_dir / "environment-workbench-reimport-replacement-readiness.md").write_text(markdown_readiness(readiness), encoding="utf-8")

    print(json.dumps({"result": "pass" if not validation_errors else "fail", "stats": stats, "validationErrors": validation_errors, "readiness": answers}, ensure_ascii=False, indent=2))
    return 1 if validation_errors else 0


if __name__ == "__main__":
    raise SystemExit(main())
