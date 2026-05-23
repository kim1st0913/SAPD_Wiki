from __future__ import annotations

import argparse
import json
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any
from urllib.parse import parse_qs, urlparse

from .paths import PROJECT_ROOT, resolve_project_path


DATA_PACKAGES = {
    "capability": "frontend/capability-browser/public/data/capability-tree.json",
    "capability-workbench": "frontend/capability-browser/public/data/capability-workbench.json",
    "environment-workbench": "frontend/capability-browser/public/data/environment-workbench.json",
    "lifecycle-workbench": "frontend/capability-browser/public/data/lifecycle-workbench.json",
    "maintenance": "frontend/capability-browser/public/data/maintenance-knowledge.json",
    "shared-lookups": "frontend/capability-browser/public/data/shared-lookups.json",
    "lifecycle": "frontend/capability-browser/public/data/lifecycle-knowledge.json",
    "content": "frontend/capability-browser/public/data/content-views.json",
    "security-architecture-design-guide": "frontend/capability-browser/public/data/guides/security-architecture-design.json",
    "data-security-design-guide": "frontend/capability-browser/public/data/guides/data-security-design.json",
    "standards": "frontend/capability-browser/public/data/standards-index.json",
    "standards-index": "frontend/capability-browser/public/data/standards-index.json",
}

MAINTENANCE_SECTIONS = (
    "scopes",
    "processes",
    "work-functions",
    "security-works",
    "modules",
    "measures",
    "lcap-references",
    "references",
)


def _list(value: Any) -> list[Any]:
    return value if isinstance(value, list) else []


def _read_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def _data_package_path(name: str) -> Path:
    if name not in DATA_PACKAGES:
        raise KeyError(name)
    return resolve_project_path(DATA_PACKAGES[name])


def read_data_package(name: str) -> dict[str, Any]:
    if name == "standards":
        return read_standards_compat_package()
    path = _data_package_path(name)
    if not path.exists():
        return {"generated_at": None, "stats": {}, "__data_state": "missing_file"}
    data = _read_json(path)
    if isinstance(data, dict):
        return data
    return {"generated_at": None, "items": data}


def _frontend_data_path(data_path: Any) -> Path | None:
    if not data_path:
        return None
    normalized = str(data_path).strip()
    if not normalized:
        return None
    if normalized.startswith("./"):
        normalized = normalized[2:]
    if normalized.startswith("public/data/"):
        normalized = f"frontend/capability-browser/{normalized}"
    return resolve_project_path(normalized)


def _read_split_payload(data_path: Any) -> dict[str, Any] | None:
    path = _frontend_data_path(data_path)
    if not path or not path.exists():
        return None
    payload = _read_json(path)
    return payload if isinstance(payload, dict) else None


def read_standards_compat_package() -> dict[str, Any]:
    path = _data_package_path("standards-index")
    if not path.exists():
        return {"generated_at": None, "stats": {}, "__data_state": "missing_file"}
    index = _read_json(path)
    if not isinstance(index, dict):
        return {"generated_at": None, "stats": {}, "__data_state": "invalid_file"}

    frameworks: list[dict[str, Any]] = []
    for framework in _list(index.get("frameworks")):
        if not isinstance(framework, dict):
            continue
        assembled = dict(framework)
        payload = _read_split_payload(assembled.get("dataPath"))
        if payload:
            assembled.update(payload)
            assembled["loaded"] = True
        elif _list(assembled.get("tabs")):
            tabs: list[dict[str, Any]] = []
            for tab in _list(assembled.get("tabs")):
                if not isinstance(tab, dict):
                    continue
                assembled_tab = dict(tab)
                tab_payload = _read_split_payload(assembled_tab.get("dataPath"))
                if tab_payload:
                    assembled_tab.update(tab_payload)
                    assembled_tab["loaded"] = True
                tabs.append(assembled_tab)
            assembled["tabs"] = tabs
            assembled["loaded"] = True
        frameworks.append(assembled)

    return {
        **index,
        "package_type": "standards-full-compat",
        "frameworks": frameworks,
    }


def create_envelope(data: Any, warnings: list[str] | None = None) -> dict[str, Any]:
    warning_list = warnings or []
    generated_at = data.get("generated_at") if isinstance(data, dict) else None
    return {
        "meta": {
            "version": "v1",
            "generated_at": generated_at,
            "data_version": generated_at,
            "warnings_count": len(warning_list),
        },
        "data": data,
        "warnings": warning_list,
    }


def _title_of(value: Any, fallback: str = "未命名") -> str:
    if not value:
        return fallback
    if isinstance(value, dict):
        return str(value.get("title") or value.get("name") or value.get("code") or value.get("id") or fallback)
    return str(value)


def _identity_of(value: Any, fallback: str = "unknown") -> str:
    if isinstance(value, dict):
        return str(value.get("id") or value.get("name") or value.get("title") or value.get("code") or fallback).strip()
    return str(value or fallback).strip()


def _entity_key(value: Any) -> str:
    if isinstance(value, dict):
        return str(value.get("id") or value.get("code") or value.get("title") or value.get("name") or "").strip()
    return str(value or "").strip()


def _unique_by(items: list[Any], key_name: str | None = None) -> list[Any]:
    rows: list[Any] = []
    seen: set[str] = set()
    for item in items:
        if key_name and isinstance(item, dict):
            key = str(item.get(key_name) or "").strip()
        else:
            key = _entity_key(item)
        if not key or key in seen:
            continue
        seen.add(key)
        rows.append(item)
    return rows


def _compact_entity(item: Any, fallback: str = "未命名") -> dict[str, Any] | None:
    if not isinstance(item, dict):
        return None
    return {
        "id": item.get("id") or item.get("code") or _title_of(item, fallback),
        "type": item.get("type") or item.get("object_type") or "",
        "code": item.get("code") or "",
        "title": _title_of(item, fallback),
        "name": item.get("name") or "",
        "description": item.get("description") or item.get("summary") or "",
        "layer": item.get("layer") or "",
        "status": item.get("status") or item.get("state") or "",
    }


def _compact_stakeholder(stakeholder: Any, layer: str = "") -> dict[str, Any] | None:
    compact = _compact_entity(stakeholder, "未命名职能")
    if compact is not None:
        compact["layer"] = layer or compact.get("layer") or ""
    return compact


def _service_identity(service: Any) -> str:
    return _identity_of(service, _title_of(service, "未命名服务"))


def _is_applicable_service(service: Any) -> bool:
    identity = _service_identity(service)
    title = _title_of(service, "")
    normalized = f"{identity} {title}".strip().lower()
    return bool(normalized) and normalized not in {"/", "n/a", "na", "none", "not applicable", "无", "不适用"}


def _entity_tokens(item: Any) -> list[str]:
    if not isinstance(item, dict):
        return [str(item).strip()] if item else []
    return [str(item.get(key) or "").strip() for key in ("id", "code", "title", "name") if str(item.get(key) or "").strip()]


def _entity_token_matches(left: Any, right: Any) -> bool:
    left_tokens = set(_entity_tokens(left))
    right_tokens = set(_entity_tokens(right))
    return bool(left_tokens and right_tokens and left_tokens.intersection(right_tokens))


def _service_module_index(management: dict[str, Any], service: dict[str, Any]) -> dict[str, Any] | None:
    for entry in _list(management.get("service_module_index")):
        entry_service = entry.get("service") or {}
        if service.get("id") and entry_service.get("id") == service.get("id"):
            return entry
        if service.get("code") and entry_service.get("code") == service.get("code"):
            return entry
        if service.get("title") and entry_service.get("title") == service.get("title"):
            return entry
    return None


def _modules_for_services(management: dict[str, Any], services: list[dict[str, Any]]) -> list[dict[str, Any]]:
    modules: list[dict[str, Any]] = []
    for service in services:
        entry = _service_module_index(management, service) or {}
        modules.extend(_list(entry.get("modules")))
    return _unique_by(modules)


def _measures_for_services_and_scope(
    management: dict[str, Any],
    services: list[dict[str, Any]],
    scope: dict[str, Any],
) -> list[dict[str, Any]]:
    service_rows = [service for service in services if _is_applicable_service(service)]
    if not service_rows:
        return []
    measures: list[dict[str, Any]] = []
    for measure in _list(management.get("security_technical_measures")):
        related_services = [
            *_list(measure.get("related_services")),
            *_list(measure.get("services")),
            *_list(measure.get("technical_services")),
            *[{"title": title} for title in _list(measure.get("related_service_names"))],
        ]
        related_scopes = [
            *_list(measure.get("applicable_scopes")),
            *_list(measure.get("scopes")),
            *_list(measure.get("scope_types")),
            *[{"title": title} for title in _list(measure.get("related_scope_names"))],
        ]
        service_matched = any(_entity_token_matches(measure_service, service) for measure_service in related_services for service in service_rows)
        scope_matched = not scope or not related_scopes or any(_entity_token_matches(measure_scope, scope) for measure_scope in related_scopes)
        if service_matched and scope_matched:
            measures.append(measure)
    return _unique_by(measures)


def _compact_technical_object(item: dict[str, Any], fallback_kind: str = "安全技术模块") -> dict[str, Any]:
    is_measure = item.get("type") == "security_technical_measure" or bool(item.get("name") or item.get("measureName"))
    return {
        "id": item.get("id") or item.get("code") or item.get("title") or item.get("name") or "",
        "type": item.get("type") or ("security_technical_measure" if is_measure else "security_technology_module"),
        "code": item.get("code") or "",
        "title": item.get("title") or item.get("name") or item.get("measureName") or "未命名",
        "name": item.get("name") or "",
        "objectKind": "安全技术措施" if is_measure else fallback_kind,
        "category": item.get("category") or item.get("kind") or "",
        "status": item.get("status") or "",
    }


def _compact_projection_focus(focus: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": focus.get("id") or "",
        "code": focus.get("code") or "",
        "name": _title_of(focus, ""),
        "description": focus.get("description") or focus.get("summary") or "",
    }


def _source_evidence_key(source: Any) -> str:
    if not isinstance(source, dict):
        return str(source or "")
    return (
        ":".join(
            str(source.get(key) or "")
            for key in ("file", "source_file", "sheet", "row", "cell", "path", "location", "column")
            if source.get(key) is not None
        )
        or json.dumps(source, ensure_ascii=False, sort_keys=True)
    )


def _source_evidence_from_items(items: list[Any]) -> list[dict[str, Any]]:
    sources: list[dict[str, Any]] = []
    for item in items:
        if not isinstance(item, dict):
            continue
        sources.extend(source for source in _list(item.get("sources")) if isinstance(source, dict))
        sources.extend(source for source in _list(item.get("mapping_sources")) if isinstance(source, dict))
    rows: list[dict[str, Any]] = []
    seen: set[str] = set()
    for source in sources:
        key = _source_evidence_key(source)
        if not key or key in seen:
            continue
        seen.add(key)
        rows.append(source)
    return rows


def _compact_scope_service_pair(row: dict[str, Any], service: dict[str, Any] | None, status: str) -> dict[str, Any]:
    scope = row.get("scope") or {}
    return {
        "scopeId": scope.get("id") or "",
        "scopeCode": scope.get("code") or "",
        "scopeName": _title_of(scope, ""),
        "serviceId": service.get("id") if service else "",
        "serviceCode": service.get("code") if service else "",
        "serviceName": _title_of(service, "") if service else "",
        "status": status,
    }


def _layer_key(layer: str) -> str:
    normalized = str(layer or "").strip().lower()
    if normalized in {"decision", "决策层", "网络安全决策层"}:
        return "decision"
    if normalized in {"management", "管理层", "网络安全管理层"}:
        return "management"
    if normalized in {"execution", "执行层", "网络安全执行层"}:
        return "execution"
    if normalized in {"supervision", "监督层", "网络安全监督层"}:
        return "supervision"
    return "unknown"


def _empty_work_functions_by_layer() -> dict[str, list[dict[str, Any]]]:
    return {"decision": [], "management": [], "execution": [], "supervision": [], "unknown": []}


def _process_tree_for_focus(focus: dict[str, Any]) -> list[dict[str, Any]]:
    groups: dict[str, dict[str, Any]] = {}
    for mapping in _list(focus.get("process_mappings")):
        process_group = mapping.get("process_group") or {}
        group_key = _entity_key(process_group) or "unknown"
        group = groups.setdefault(
            group_key,
            {
                "l2ProcessGroup": _compact_entity(process_group, "待确认流程组") or {
                    "id": "unknown",
                    "type": "process_group",
                    "code": "",
                    "title": "待确认流程组",
                    "name": "",
                    "description": "",
                    "layer": "",
                    "status": "",
                },
                "l3Processes": [],
                "_l3Index": {},
            },
        )
        process_reference = mapping.get("process_reference") or {}
        process_key = _entity_key(process_reference) or f"{group_key}:unknown"
        process_index = group["_l3Index"]
        process = process_index.get(process_key)
        if process is None:
            process = {
                "id": process_reference.get("id") or process_key,
                "code": process_reference.get("code") or "",
                "name": _title_of(process_reference, "待确认流程"),
                "description": process_reference.get("description") or process_reference.get("summary") or "",
                "activities": [],
            }
            process_index[process_key] = process
            group["l3Processes"].append(process)
        process["activities"] = _unique_by(
            [
                *process["activities"],
                *[
                    {
                        "id": activity.get("id") or activity.get("code") or _title_of(activity, "待确认活动"),
                        "code": activity.get("code") or "",
                        "name": _title_of(activity, "待确认活动"),
                        "description": activity.get("description") or activity.get("summary") or "",
                        "status": activity.get("status") or activity.get("state") or "",
                    }
                    for activity in _list(mapping.get("activities"))
                    if isinstance(activity, dict)
                ],
            ]
        )
    rows: list[dict[str, Any]] = []
    for group in groups.values():
        group.pop("_l3Index", None)
        rows.append(group)
    return rows


def _all_focuses(capability: dict[str, Any]) -> list[dict[str, Any]]:
    return [
        focus
        for category in _list(capability.get("categories"))
        for domain in _list(category.get("domains"))
        for cap in _list(domain.get("capabilities"))
        for focus in _list(cap.get("focuses"))
    ]


def _stakeholders_from_mappings(process_mappings: list[dict[str, Any]]) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for mapping in process_mappings:
        stakeholders = mapping.get("stakeholders") or {}
        if not isinstance(stakeholders, dict):
            continue
        for layer, layer_stakeholders in stakeholders.items():
            for stakeholder in _list(layer_stakeholders):
                compact = _compact_stakeholder(stakeholder, layer)
                if compact:
                    rows.append(compact)
    return _unique_by(rows)


def _capability_technical_mapping_rows(capability: dict[str, Any], management: dict[str, Any]) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for focus in _all_focuses(capability):
        grouped: dict[str, dict[str, Any]] = {}
        for mapping in _list(focus.get("scope_mappings")):
            scope = mapping.get("scope") or {}
            key = f"{_identity_of(focus, _title_of(focus, '未命名关注点'))}::{_identity_of(scope, _title_of(scope, '未命名作用域'))}"
            group = grouped.setdefault(key, {"focus": focus, "scope": scope, "mappings": [], "services": [], "service_count": 0})
            group["mappings"].append(mapping)
            group["services"].extend([service for service in _list(mapping.get("services")) if _is_applicable_service(service)])
            group["service_count"] += int(mapping.get("service_count") or len(_list(mapping.get("services"))) or 0)
        for group in grouped.values():
            candidate_services = _unique_by(group["services"])
            is_explicit_no_service = any(mapping.get("status") == "no_service" for mapping in group["mappings"]) or not candidate_services
            is_ambiguous = len(candidate_services) > 1
            confirmed_services = [] if is_ambiguous else candidate_services
            modules = [] if is_ambiguous else _modules_for_services(management, confirmed_services)
            measures = [] if is_ambiguous else _measures_for_services_and_scope(management, confirmed_services, group["scope"])
            technology_modules = [_compact_technical_object(module, "安全技术模块") for module in modules]
            technical_measures = [_compact_technical_object({**measure, "type": "security_technical_measure"}, "安全技术措施") for measure in measures]
            status = "ambiguous_service_mapping" if is_ambiguous else "covered" if confirmed_services else "no_service"
            rows.append(
                {
                    "focus": _compact_entity(group["focus"]),
                    "scope": _compact_entity(group["scope"], "未命名作用域"),
                    "services": [_compact_entity(service) for service in confirmed_services],
                    "candidateServices": [_compact_entity(service) for service in candidate_services],
                    "technologyModules": technology_modules,
                    "technicalMeasures": technical_measures,
                    "modules": [*technology_modules, *technical_measures],
                    "serviceCount": group["service_count"] or len(candidate_services),
                    "status": status,
                    "exceptionType": "ambiguous_service_mapping" if is_ambiguous else "",
                    "exceptionMessage": "同一关注点与同一作用域下出现多个候选安全技术服务，需要后端/ETL确认，前端不自动选择。" if is_ambiguous else "",
                    "isExplicitNoService": is_explicit_no_service,
                }
            )
    return rows


def _capability_management_mapping_rows(capability: dict[str, Any]) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for focus in _all_focuses(capability):
        process_mappings = _list(focus.get("process_mappings"))
        security_works = _unique_by(_list(focus.get("security_works")))
        rows.append(
            {
                "focus": _compact_entity(focus),
                "securityWorks": [_compact_entity(work) for work in security_works],
                "stakeholders": _stakeholders_from_mappings(process_mappings),
                "processGroups": [_compact_entity(item) for item in _unique_by([mapping.get("process_group") for mapping in process_mappings]) if item],
                "processReferences": [_compact_entity(item) for item in _unique_by([mapping.get("process_reference") for mapping in process_mappings]) if item],
                "activities": [_compact_entity(item) for item in _unique_by([activity for mapping in process_mappings for activity in _list(mapping.get("activities"))]) if item],
                "activityStatusLabels": _unique_by(
                    [mapping.get("activity_status_label") or ("待补充" if mapping.get("missing_activity") else "暂无") for mapping in process_mappings],
                ),
                "hasMissingActivity": any(mapping.get("missing_activity") or mapping.get("activity_status") == "missing" for mapping in process_mappings),
            }
        )
    return rows


def _capability_local_relation_map(
    focus: dict[str, Any],
    technical_rows: list[dict[str, Any]],
    management_row: dict[str, Any] | None,
) -> dict[str, Any]:
    scope_service_pairs: list[dict[str, Any]] = []
    service_links_by_id: dict[str, dict[str, Any]] = {}
    for row in technical_rows:
        services = _list(row.get("services"))
        candidate_services = _list(row.get("candidateServices"))
        status = str(row.get("status") or "").strip() or "unknown"
        if services:
            for service in services:
                pair = _compact_scope_service_pair(row, service, status)
                scope_service_pairs.append(pair)
                service_key = service.get("id") or service.get("code") or service.get("title") or pair["serviceName"]
                link = service_links_by_id.setdefault(
                    service_key,
                    {
                        "serviceId": service.get("id") or "",
                        "serviceCode": service.get("code") or "",
                        "serviceName": _title_of(service, ""),
                        "scopes": [],
                        "modules": [],
                        "measures": [],
                        "status": status,
                    },
                )
                link["scopes"] = _unique_by([*link["scopes"], row.get("scope")])
                link["modules"] = _unique_by([*link["modules"], *_list(row.get("technologyModules"))])
                link["measures"] = _unique_by([*link["measures"], *_list(row.get("technicalMeasures"))])
                if link["status"] != "covered" or status != "covered":
                    link["status"] = status
        elif status == "ambiguous_service_mapping" and candidate_services:
            for service in candidate_services:
                scope_service_pairs.append(_compact_scope_service_pair(row, service, status))
        else:
            scope_service_pairs.append(_compact_scope_service_pair(row, None, status))

    service_module_measure_links = []
    for link in service_links_by_id.values():
        service_module_measure_links.append(
            {
                **link,
                "scopes": [_compact_entity(scope, "未命名作用域") for scope in _list(link["scopes"]) if scope],
                "modules": _list(link["modules"]),
                "measures": _list(link["measures"]),
            }
        )

    work_functions_by_layer = _empty_work_functions_by_layer()
    for stakeholder in _list((management_row or {}).get("stakeholders")):
        layer = _layer_key(stakeholder.get("layer") or "")
        work_functions_by_layer[layer].append(stakeholder)
    for key, rows in work_functions_by_layer.items():
        work_functions_by_layer[key] = _unique_by(rows)

    evidence_items: list[Any] = [
        focus,
        *_list(focus.get("security_works")),
        *_list(focus.get("scope_mappings")),
        *_list(focus.get("process_mappings")),
    ]
    for mapping in _list(focus.get("scope_mappings")):
        evidence_items.append(mapping.get("scope"))
        evidence_items.extend(_list(mapping.get("services")))
    for mapping in _list(focus.get("process_mappings")):
        evidence_items.append(mapping.get("process_group"))
        evidence_items.append(mapping.get("process_reference"))
        evidence_items.extend(_list(mapping.get("activities")))
        stakeholders = mapping.get("stakeholders") or {}
        if isinstance(stakeholders, dict):
            for layer_stakeholders in stakeholders.values():
                evidence_items.extend(_list(layer_stakeholders))

    source_evidence = _source_evidence_from_items(evidence_items)

    return {
        "focus": _compact_projection_focus(focus),
        "technical": {
            "scopeServicePairs": scope_service_pairs,
            "serviceModuleMeasureLinks": service_module_measure_links,
        },
        "management": {
            "securityWorks": _list((management_row or {}).get("securityWorks")),
            "workFunctionsByLayer": work_functions_by_layer,
            "processTree": _process_tree_for_focus(focus),
        },
        "sourceEvidence": source_evidence,
    }


def _capability_local_relation_maps(
    capability: dict[str, Any],
    technical_rows: list[dict[str, Any]],
    management_rows: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    technical_by_focus: dict[str, list[dict[str, Any]]] = {}
    for row in technical_rows:
        focus_id = (row.get("focus") or {}).get("id") or ""
        technical_by_focus.setdefault(focus_id, []).append(row)
    management_by_focus: dict[str, dict[str, Any]] = {
        (row.get("focus") or {}).get("id") or "": row for row in management_rows
    }
    return [
        _capability_local_relation_map(
            focus,
            technical_by_focus.get(focus.get("id") or "", []),
            management_by_focus.get(focus.get("id") or ""),
        )
        for focus in _all_focuses(capability)
    ]


def capability_workspace_projection() -> dict[str, Any]:
    capability = read_data_package("capability")
    maintenance = read_data_package("maintenance")
    shared_lookups = read_data_package("shared-lookups")
    projection_context = {
        "security_technical_measures": _list(maintenance.get("security_technical_measures")),
        "service_module_index": _list(shared_lookups.get("service_module_index")),
    }
    technical_rows = _capability_technical_mapping_rows(capability, projection_context)
    management_rows = _capability_management_mapping_rows(capability)
    local_relation_maps = _capability_local_relation_maps(capability, technical_rows, management_rows)
    local_relation_maps_by_focus_id = {
        row["focus"]["id"]: row for row in local_relation_maps if row.get("focus", {}).get("id")
    }
    return {
        "generated_at": capability.get("generated_at") or shared_lookups.get("generated_at") or maintenance.get("generated_at"),
        "data_state": "ready" if technical_rows or management_rows else "empty",
        "technicalMappingRows": technical_rows,
        "managementMappingRows": management_rows,
        "localRelationMap": local_relation_maps[0] if local_relation_maps else None,
        "localRelationMaps": local_relation_maps,
        "localRelationMapsByFocusId": local_relation_maps_by_focus_id,
        "stats": {
            "technical_rows": len(technical_rows),
            "management_rows": len(management_rows),
            "local_relation_maps": len(local_relation_maps),
            "focuses": len(_all_focuses(capability)),
        },
    }


def _maintenance_navigation(capability: dict[str, Any], management: dict[str, Any], lifecycle: dict[str, Any]) -> list[dict[str, Any]]:
    process_count = sum(
        len(_list(group.get("references")))
        for domain in _list(management.get("security_processes"))
        for group in _list(domain.get("groups"))
    )
    work_function_count = sum(
        len(_list(group.get("functions")))
        for layer in _list(management.get("work_function_layers"))
        for group in _list(layer.get("groups"))
    )
    security_work_count = sum(
        len(_list(focus.get("security_works")))
        for category in _list(capability.get("categories"))
        for domain in _list(category.get("domains"))
        for cap in _list(domain.get("capabilities"))
        for focus in _list(cap.get("focuses"))
    )
    app_security = lifecycle.get("application_security_development") or {}
    lcap_reference_count = len(_list(app_security.get("software_development_types"))) + len(_list(app_security.get("application_system_types")))
    reference_count = len(_list(management.get("gbt_42446_references"))) + len(_list(management.get("gartner_roles")))
    return [
        {"id": "scopes", "label": "作用域清单", "count": len(_list(management.get("scope_types")))},
        {"id": "processes", "label": "流程清单", "count": process_count},
        {"id": "work-functions", "label": "职能清单", "count": work_function_count},
        {"id": "security-works", "label": "安全工作清单", "count": security_work_count},
        {"id": "modules", "label": "安全技术模块清单", "count": len(_list(management.get("security_technology_modules")))},
        {"id": "measures", "label": "安全技术措施清单", "count": len(_list(management.get("security_technical_measures")))},
        {"id": "lcap-references", "label": "LC-AP参考数据", "count": lcap_reference_count},
        {"id": "references", "label": "岗位参考页面", "count": reference_count},
    ]


def _security_work_items(capability: dict[str, Any]) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    index = 1
    for category in _list(capability.get("categories")):
        for domain in _list(category.get("domains")):
            for cap in _list(domain.get("capabilities")):
                for focus in _list(cap.get("focuses")):
                    for work in _list(focus.get("security_works")):
                        rows.append(
                            {
                                **work,
                                "index": index,
                                "capability": {"id": cap.get("id"), "code": cap.get("code"), "title": cap.get("title")},
                                "focus": {"id": focus.get("id"), "code": focus.get("code"), "title": focus.get("title")},
                                "focus_code": focus.get("code"),
                                "focus_title": focus.get("title"),
                            }
                        )
                        index += 1
    return rows


def maintenance_payload(section: str) -> dict[str, Any]:
    capability = read_data_package("capability")
    management = read_data_package("maintenance")
    lifecycle = read_data_package("lifecycle")
    app_security = lifecycle.get("application_security_development") or {}
    if section == "scopes":
        return {"section": section, "items": _list(management.get("scope_types"))}
    if section == "processes":
        return {"section": section, "items": _list(management.get("security_processes"))}
    if section == "work-functions":
        return {"section": section, "items": _list(management.get("work_function_layers"))}
    if section == "security-works":
        return {"section": section, "items": _security_work_items(capability)}
    if section == "modules":
        return {"section": section, "items": _list(management.get("security_technology_modules"))}
    if section == "measures":
        measures = _list(management.get("security_technical_measures"))
        return {
            "section": section,
            "items": measures,
            "data_state": "ready" if measures else "empty",
            "empty_state": "" if measures else "暂无安全技术措施数据，请确认 ETL 是否已导出 security_technical_measures。",
        }
    if section == "lcap-references":
        return {
            "section": section,
            "software_development_types": _list(app_security.get("software_development_types")),
            "application_system_types": _list(app_security.get("application_system_types")),
        }
    if section == "references":
        return {
            "section": section,
            "standards": _list(management.get("gbt_42446_references")),
            "roles": _list(management.get("gartner_roles")),
        }
    raise KeyError(section)


class SapdWikiRequestHandler(SimpleHTTPRequestHandler):
    server_version = "SAPDWikiHTTP/0.1"

    def __init__(self, *args: Any, directory: str | None = None, **kwargs: Any) -> None:
        super().__init__(*args, directory=directory, **kwargs)

    def do_OPTIONS(self) -> None:
        self.send_response(204)
        self.end_headers()

    def do_GET(self) -> None:
        parsed = urlparse(self.path)
        if parsed.path.startswith("/api/v1/"):
            self._handle_api(parsed.path, parse_qs(parsed.query))
            return
        super().do_GET()

    def _send_json(self, payload: Any, status: int = 200) -> None:
        encoded = json.dumps(payload, ensure_ascii=False, indent=2).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(encoded)))
        self.end_headers()
        self.wfile.write(encoded)

    def _handle_api(self, path: str, query: dict[str, list[str]]) -> None:
        parts = [part for part in path.split("/") if part]
        try:
            if path == "/api/v1/health":
                self._send_json(create_envelope({"status": "ok", "app": "SAPD Wiki", "mode": "local-api"}))
                return
            if path == "/api/v1/data-packages":
                self._send_json(create_envelope({"packages": [{"name": name, "path": path} for name, path in DATA_PACKAGES.items()]}))
                return
            if len(parts) == 4 and parts[:3] == ["api", "v1", "data-packages"]:
                self._send_json(create_envelope(read_data_package(parts[3])))
                return
            if path == "/api/v1/capabilities/workspace-projection":
                self._send_json(create_envelope(capability_workspace_projection()))
                return
            if path == "/api/v1/maintenance":
                capability = read_data_package("capability")
                management = read_data_package("maintenance")
                lifecycle = read_data_package("lifecycle")
                self._send_json(create_envelope({"sections": _maintenance_navigation(capability, management, lifecycle)}))
                return
            if len(parts) == 4 and parts[:3] == ["api", "v1", "maintenance"]:
                section = parts[3]
                self._send_json(create_envelope(maintenance_payload(section)))
                return
            self._send_json(create_envelope({"error": "not_found", "path": path}), status=404)
        except KeyError as exc:
            self._send_json(create_envelope({"error": "not_found", "key": str(exc), "path": path}), status=404)
        except Exception as exc:
            self._send_json(create_envelope({"error": "server_error", "message": str(exc), "path": path}), status=500)


def serve(args: argparse.Namespace) -> None:
    static_dir = resolve_project_path(args.static_dir)
    handler = lambda *handler_args, **kwargs: SapdWikiRequestHandler(*handler_args, directory=str(static_dir), **kwargs)
    server = ThreadingHTTPServer((args.host, args.port), handler)
    url = f"http://{args.host}:{args.port}"
    print(f"SAPD Wiki local API: {url}/api/v1/health")
    print(f"SAPD Wiki frontend:  {url}/")
    print(f"static_dir: {static_dir.relative_to(PROJECT_ROOT) if static_dir.is_relative_to(PROJECT_ROOT) else static_dir}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nserver stopped")
    finally:
        server.server_close()
