#!/usr/bin/env python3
"""Build a replacement-candidate bundle for environment reimport verification.

The bundle is written under data/exports/worker-verify only. It does not replace
frontend/capability-browser/public/data/environment-workbench.json or generated
node-details in-place.
"""

from __future__ import annotations

import argparse
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

from verify_environment_reimport_candidate_downstream import (  # noqa: E402
    build_basemap_shadow_diff,
    build_matrix_rows,
    build_shadow,
    load_json,
    object_context_key,
    relation_key,
    stable_id,
    text,
    unique_by_id,
    write_json,
)

OUTPUT_DIR = PROJECT_ROOT / "data" / "exports" / "worker-verify"
BUNDLE_DIR = OUTPUT_DIR / "environment-reimport-replacement-bundle"
CURRENT_WORKBENCH = PROJECT_ROOT / "frontend" / "capability-browser" / "public" / "data" / "environment-workbench.json"
CURRENT_NODE_DETAILS = PROJECT_ROOT / "frontend" / "capability-browser" / "generated" / "environmentBasemap.node-details.json"
SEMANTIC_PATH = PROJECT_ROOT / "frontend" / "capability-browser" / "generated" / "environmentBasemap.semantic.json"

DETAIL_VERSION = "environment-basemap-node-details-reimport-replacement-candidate-v1"
TARGET_NODE_NAMES = {
    "PC终端设备",
    "PC终端操作系统",
    "PC终端软件应用",
    "移动终端软件应用",
    "业务应用",
    "应用及数据",
    "园区网出口边界",
    "园区出口边界",
    "互联网入口边界",
    "容器",
}


def entity_to_detail_object(entity: dict[str, Any] | None, fallback_type: str = "") -> dict[str, str] | None:
    if not entity:
        return None
    return {
        "objectType": text(entity.get("type") or fallback_type),
        "objectId": text(entity.get("id")),
        "objectCode": text(entity.get("code")),
        "objectName": text(entity.get("title") or entity.get("name") or entity.get("objectName")),
    }


def list_to_object_map(items: list[dict[str, Any]]) -> dict[str, dict[str, Any]]:
    return {text(item.get("id")): item for item in items if text(item.get("id"))}


def replacement_objects(shadow: dict[str, Any]) -> dict[str, dict[str, dict[str, Any]]]:
    buckets: dict[str, dict[str, dict[str, Any]]] = defaultdict(dict)

    def add(item: dict[str, Any] | None) -> None:
        if not item:
            return
        item_id = text(item.get("id"))
        item_type = text(item.get("type") or "unknown")
        if item_id:
            buckets[item_type][item_id] = {key: value for key, value in item.items() if key != "_mappingKey"}

    for env in shadow.get("environment_scope_tree", []):
        add({key: env.get(key) for key in ("id", "type", "title")})
        for obj in env.get("objects", []):
            add(obj)
            for segment in obj.get("segments", []):
                add(segment)
            for mapping in obj.get("scope_mappings", []):
                add(mapping.get("scope"))
                for service in mapping.get("services", []):
                    add({key: service.get(key) for key in ("id", "type", "code", "title", "raw")})
                    for module in service.get("modules", []):
                        add(module)
                        for system in module.get("systems", []) or module.get("securitySystems", []):
                            add(system)
                    for measure in service.get("measures", []):
                        add(measure)
                        for system in measure.get("systems", []) or measure.get("securitySystems", []):
                            add(system)
                    for system in service.get("securitySystems", []):
                        add(system)
    return dict(buckets)


def replacement_relations(shadow: dict[str, Any]) -> list[dict[str, Any]]:
    relations = []
    for relation in shadow.get("relations", []):
        payload = relation.get("payload") or {}
        relation_type = text(relation.get("type"))
        context_key = text(relation.get("objectContextKey"))
        source_id = ""
        target_id = ""
        source_type = ""
        target_type = ""
        label = relation_type
        if relation_type == "object_scope":
            source_id = stable_id("information_object_context", context_key)
            target_id = text((payload.get("scope") or {}).get("id")) or stable_id("scope_type", text((payload.get("scope") or {}).get("code") or (payload.get("scope") or {}).get("title")))
            source_type = "information_object"
            target_type = "scope_type"
            label = "applies_to_scope"
        elif relation_type == "object_service":
            service = payload.get("service") or {}
            source_id = stable_id("security_technical_service", text(service.get("code") or service.get("title")))
            target_id = stable_id("information_object_context", context_key)
            source_type = "security_technical_service"
            target_type = "information_object"
            label = "protects_object"
        elif relation_type == "service_module":
            service = payload.get("service") or {}
            module = payload.get("module") or {}
            source_id = stable_id("security_technical_service", text(service.get("code") or service.get("title")))
            target_id = stable_id("security_technology_module", text(module.get("title")))
            source_type = "security_technical_service"
            target_type = "security_technology_module"
            label = "implemented_by_module"
        elif relation_type == "service_measure":
            service = payload.get("service") or {}
            measure = payload.get("measure") or {}
            source_id = stable_id("security_technical_service", text(service.get("code") or service.get("title")))
            target_id = stable_id("security_technical_measure", text(measure.get("title")))
            source_type = "security_technical_service"
            target_type = "security_technical_measure"
            label = "has_measure"
        elif relation_type == "module_system":
            module = payload.get("module") or {}
            system = payload.get("securitySystem") or {}
            source_id = stable_id("security_technology_module", text(module.get("title")))
            target_id = stable_id("security_system", text(system.get("title")))
            source_type = "security_technology_module"
            target_type = "security_system"
            label = "part_of_system"
        relations.append(
            {
                "id": text(relation.get("id")),
                "type": label,
                "sourceId": source_id,
                "sourceType": source_type,
                "targetId": target_id,
                "targetType": target_type,
                "label": label,
                "status": "candidate",
                "confidence": 1,
                "evidenceRefs": [],
                "objectContextKey": context_key,
                "sourceRows": relation.get("sourceRows", []),
                "workerVerifyType": relation_type,
                "payload": payload,
            }
        )
    return relations


def build_replacement_workbench(shadow: dict[str, Any], current: dict[str, Any]) -> dict[str, Any]:
    relations = replacement_relations(shadow)
    objects = replacement_objects(shadow)
    return {
        "meta": {
            **(current.get("meta") or {}),
            "version": "environment-workbench-reimport-replacement-candidate-v1",
            "generated_at": datetime.now().isoformat(timespec="seconds"),
            "source": "data/exports/worker-verify/environment-workbench-reimport-candidate.json",
            "replacementStatus": "candidate_bundle_only_not_public",
            "objectInstanceUniqueKey": "informationEnvironment + environmentSegment + informationObject",
            "stats": {
                **((current.get("meta") or {}).get("stats") or {}),
                "environment_count": len(shadow.get("environment_scope_tree", [])),
                "object_context_count": sum(len(env.get("objects", [])) for env in shadow.get("environment_scope_tree", [])),
                "relation_count": len(relations),
            },
        },
        "page": current.get("page"),
        "navigator": current.get("navigator"),
        "overview": shadow.get("overview"),
        "relationshipGroups": current.get("relationshipGroups", []),
        "objects": objects,
        "relations": relations,
        "evidenceRefs": [],
        "compatibility": {
            "mode": "reimport_replacement_candidate",
            "sourcePackages": ["environment-workbench-reimport-candidate.json"],
            "warnings": ["worker-verify bundle only; not written to public/data"],
        },
        "environment_scope_tree": shadow.get("environment_scope_tree", []),
    }


def compact_detail_entity(entity: dict[str, Any] | None, fallback_type: str) -> dict[str, str] | None:
    return entity_to_detail_object(entity, fallback_type)


def detail_service(service: dict[str, Any]) -> dict[str, Any]:
    return {
        **(compact_detail_entity(service, "security_technical_service") or {}),
        "modules": [compact_detail_entity(module, "security_technology_module") for module in service.get("modules", [])],
        "measures": [compact_detail_entity(measure, "security_technical_measure") for measure in service.get("measures", [])],
        "securitySystems": [compact_detail_entity(system, "security_system") for system in service.get("securitySystems", [])],
    }


def unique_detail_entities(items: list[dict[str, Any] | None]) -> list[dict[str, Any]]:
    seen: set[str] = set()
    result: list[dict[str, Any]] = []
    for item in items:
        if not item:
            continue
        item_key = text(item.get("objectId") or item.get("objectCode") or item.get("objectName"))
        if not item_key or item_key in seen:
            continue
        seen.add(item_key)
        result.append(item)
    return result


def build_detail_scope_groups_for_object(obj: dict[str, Any]) -> list[dict[str, Any]]:
    groups = []
    for mapping in obj.get("scope_mappings", []):
        services = [detail_service(service) for service in mapping.get("services", [])]
        modules = unique_detail_entities([module for service in services for module in service.get("modules", [])])
        measures = unique_detail_entities([measure for service in services for measure in service.get("measures", [])])
        systems = unique_detail_entities([system for service in services for system in service.get("securitySystems", [])])
        groups.append(
            {
                "informationObject": compact_detail_entity(obj, "information_object"),
                "scope": compact_detail_entity(mapping.get("scope"), "scope_type"),
                "services": services,
                "modules": modules,
                "measures": measures,
                "securitySystems": systems,
            }
        )
    return groups


def summarize_groups(groups: list[dict[str, Any]]) -> dict[str, int]:
    scopes = unique_detail_entities([group.get("scope") for group in groups if group.get("scope")])
    services = unique_detail_entities([service for group in groups for service in group.get("services", [])])
    modules = unique_detail_entities([module for group in groups for module in group.get("modules", [])])
    measures = unique_detail_entities([measure for group in groups for measure in group.get("measures", [])])
    systems = unique_detail_entities([system for group in groups for system in group.get("securitySystems", [])])
    return {
        "scopeCount": len(scopes),
        "serviceCount": len(services),
        "moduleCount": len(modules),
        "measureCount": len(measures),
        "securitySystemCount": len(systems),
    }


def index_shadow_objects(shadow: dict[str, Any]) -> tuple[dict[str, dict[str, Any]], dict[str, list[dict[str, Any]]]]:
    by_context: dict[str, dict[str, Any]] = {}
    by_env_segment: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for env in shadow.get("environment_scope_tree", []):
        env_title = text(env.get("title"))
        for obj in env.get("objects", []):
            context_key = text(obj.get("contextKey"))
            by_context[context_key] = obj
            segment_title = text((obj.get("segments") or [{}])[0].get("title"))
            by_env_segment[relation_key(env_title, segment_title)].append(obj)
    return by_context, by_env_segment


def detail_context_candidates(detail: dict[str, Any]) -> list[str]:
    path = [part.strip() for part in text(detail.get("contextPathText")).split("/") if part.strip()]
    object_name = text(detail.get("objectName") or detail.get("label"))
    env_object_name = text(((detail.get("environment") or {}).get("objectName")))
    env_names = []
    if env_object_name:
        env_names.append(env_object_name)
    if path:
        env_names.append(path[0])
    if "园区" in env_names:
        env_names.append("园区网")
    if "数据中心机房" in env_names:
        env_names.extend(["云数据中心", "传统数据中心"])
    segment_names = []
    if len(path) >= 2:
        segment_names.append(path[-2])
    if text(detail.get("objectCategoryName")):
        segment_names.append(text(detail.get("objectCategoryName")))
    if detail.get("detailType") in {"environment_object_category", "environment_segment"}:
        segment_names.append(object_name)
    candidates = []
    for env_name in dict.fromkeys(env_names):
        for segment_name in dict.fromkeys(segment_names):
            candidates.append(relation_key(env_name, segment_name, object_name))
            if detail.get("detailType") in {"environment_object_category", "environment_segment"}:
                candidates.append(relation_key(env_name, object_name))
    return [candidate for candidate in dict.fromkeys(candidates) if candidate.strip("|")]


def aggregate_segment_groups(objects: list[dict[str, Any]]) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    child_objects = [compact_detail_entity(obj, "information_object") for obj in objects]
    groups = []
    for obj in objects:
        groups.extend(build_detail_scope_groups_for_object(obj))
    return unique_by_id(child_objects), groups


def rebuild_node_detail(detail: dict[str, Any], shadow_by_context: dict[str, dict[str, Any]], shadow_by_segment: dict[str, list[dict[str, Any]]]) -> dict[str, Any]:
    detail_type = text(detail.get("detailType"))
    replacement = dict(detail)
    replacement["replacementSource"] = "environment-reimport-replacement-bundle"
    replacement["objectContextKeyCandidates"] = detail_context_candidates(detail)

    direct_groups: list[dict[str, Any]] = []
    inherited_groups: list[dict[str, Any]] = []
    child_objects = detail.get("childInformationObjects") or []
    matched_context_key = ""

    if detail_type in {"information_object", "network_boundary", "security_scope", "communication_network"}:
        for candidate in replacement["objectContextKeyCandidates"]:
            if candidate in shadow_by_context:
                matched_context_key = candidate
                direct_groups = build_detail_scope_groups_for_object(shadow_by_context[candidate])
                break
    elif detail_type in {"environment_object_category", "environment_segment"}:
        for candidate in replacement["objectContextKeyCandidates"]:
            segment_key = "||".join(candidate.split("||")[:2])
            if segment_key in shadow_by_segment:
                matched_context_key = segment_key
                child_objects, inherited_groups = aggregate_segment_groups(shadow_by_segment[segment_key])
                break
    elif detail_type in {"environment", "environment_container"}:
        env_name = text(detail.get("environmentName") or ((detail.get("environment") or {}).get("objectName")) or (detail.get("contextPath") or [""])[0])
        env_aliases = [env_name]
        if env_name == "园区":
            env_aliases.append("园区网")
        env_objects = []
        for key, objects in shadow_by_segment.items():
            if key.split("||")[0] in env_aliases:
                env_objects.extend(objects)
        child_objects, inherited_groups = aggregate_segment_groups(env_objects)

    direct_summary = summarize_groups(direct_groups)
    inherited_summary = summarize_groups(inherited_groups)
    replacement["matchedObjectContextKey"] = matched_context_key
    replacement["directScopeGroups"] = direct_groups
    replacement["inheritedScopeGroups"] = inherited_groups
    replacement["scopeMappings"] = direct_groups
    replacement["childInformationObjects"] = child_objects
    replacement["summary"] = {
        **(replacement.get("summary") or {}),
        "directScopeCount": direct_summary["scopeCount"],
        "directServiceCount": direct_summary["serviceCount"],
        "directModuleCount": direct_summary["moduleCount"],
        "directMeasureCount": direct_summary["measureCount"],
        "directSecuritySystemCount": direct_summary["securitySystemCount"],
        "inheritedScopeCount": inherited_summary["scopeCount"],
        "inheritedServiceCount": inherited_summary["serviceCount"],
        "inheritedModuleCount": inherited_summary["moduleCount"],
        "inheritedMeasureCount": inherited_summary["measureCount"],
        "inheritedSecuritySystemCount": inherited_summary["securitySystemCount"],
        "scopeCount": direct_summary["scopeCount"],
        "serviceCount": direct_summary["serviceCount"],
        "moduleCount": direct_summary["moduleCount"],
        "measureCount": direct_summary["measureCount"],
        "securitySystemCount": direct_summary["securitySystemCount"],
        "childInformationObjectCount": len(child_objects),
        "directScopeGroupCount": len(direct_groups),
        "inheritedScopeGroupCount": len(inherited_groups),
    }
    return replacement


def rebuild_node_details(current_details: dict[str, Any], semantic: dict[str, Any], shadow: dict[str, Any], replacement_workbench: dict[str, Any]) -> dict[str, Any]:
    shadow_by_context, shadow_by_segment = index_shadow_objects(shadow)
    node_details = {}
    for mx_id, detail in (current_details.get("nodeDetailsByMxId") or {}).items():
        node_details[mx_id] = rebuild_node_detail(detail, shadow_by_context, shadow_by_segment)

    detail_type_distribution = Counter(detail.get("detailType") for detail in node_details.values())
    ignored_nodes = current_details.get("ignoredNodes", [])
    for node in ignored_nodes:
        detail_type_distribution[node.get("detailType")] += 1
    issues = []
    for node in semantic.get("nodes", []):
        if node.get("bindStatus") == "bound" and node.get("mxId") not in node_details:
            issues.append({"type": "missingReplacementDetail", "mxId": node.get("mxId"), "label": node.get("label")})
    return {
        "source": {
            **(current_details.get("source") or {}),
            "version": DETAIL_VERSION,
            "workbenchPath": "data/exports/worker-verify/environment-reimport-replacement-bundle/environment-workbench.json",
            "workbenchVersion": replacement_workbench.get("meta", {}).get("version", ""),
        },
        "stats": {
            **(current_details.get("stats") or {}),
            "semanticNodes": len(semantic.get("nodes", [])),
            "semanticEdges": len(semantic.get("edges", [])),
            "boundNodes": sum(1 for node in semantic.get("nodes", []) if node.get("bindStatus") == "bound"),
            "ignoredNodes": sum(1 for node in semantic.get("nodes", []) if node.get("bindStatus") == "ignored"),
            "detailReadyNodes": len(node_details),
            "missingDetailNodes": len(issues),
            "nodeDetails": len(node_details),
            "workbenchObjects": sum(len(bucket) for bucket in replacement_workbench.get("objects", {}).values()),
            "workbenchRelations": len(replacement_workbench.get("relations", [])),
            "detailTypeDistribution": dict(detail_type_distribution),
        },
        "detailProjectionReport": {
            "detailTypeDistribution": dict(detail_type_distribution),
            "note": "Replacement candidate node-details rebuilt from reimport shadow contextKey relations. Security systems are carried in directScopeGroups[].securitySystems.",
        },
        "nodeDetailsByMxId": node_details,
        "ignoredNodes": ignored_nodes,
        "issues": issues,
    }


def counts_from_detail(detail: dict[str, Any]) -> dict[str, int]:
    summary = detail.get("summary") or {}
    return {
        "services": int(summary.get("directServiceCount") or summary.get("serviceCount") or 0),
        "securitySystems": int(summary.get("directSecuritySystemCount") or summary.get("securitySystemCount") or 0),
        "modules": int(summary.get("directModuleCount") or summary.get("moduleCount") or 0),
        "measures": int(summary.get("directMeasureCount") or summary.get("measureCount") or 0),
    }


def diff_node_details(current_details: dict[str, Any], replacement_details: dict[str, Any], semantic: dict[str, Any]) -> dict[str, Any]:
    rows = []
    semantic_by_id = {node.get("mxId"): node for node in semantic.get("nodes", [])}
    for mx_id, replacement in sorted((replacement_details.get("nodeDetailsByMxId") or {}).items()):
        name = text(replacement.get("objectName") or replacement.get("label"))
        label = text(replacement.get("label"))
        if name not in TARGET_NODE_NAMES and label not in TARGET_NODE_NAMES:
            continue
        current = (current_details.get("nodeDetailsByMxId") or {}).get(mx_id, {})
        current_counts = counts_from_detail(current)
        replacement_counts = counts_from_detail(replacement)
        rows.append(
            {
                "mxId": mx_id,
                "label": label,
                "objectName": name,
                "detailType": replacement.get("detailType"),
                "contextPathText": replacement.get("contextPathText"),
                "matchedObjectContextKey": replacement.get("matchedObjectContextKey"),
                "current": current_counts,
                "replacement": replacement_counts,
                "currentExtra": {
                    key: max(0, current_counts.get(key, 0) - replacement_counts.get(key, 0))
                    for key in ("services", "securitySystems", "modules", "measures")
                },
                "replacementAdded": {
                    key: max(0, replacement_counts.get(key, 0) - current_counts.get(key, 0))
                    for key in ("services", "securitySystems", "modules", "measures")
                },
                "riskReason": "current counts exceed replacement counts" if any(current_counts.get(key, 0) > replacement_counts.get(key, 0) for key in ("services", "modules", "measures")) else "",
                "semanticNodeFound": mx_id in semantic_by_id,
            }
        )
    return {
        "generatedAt": datetime.now().isoformat(timespec="seconds"),
        "summary": {
            "checkedNodes": len(rows),
            "semanticNodeFound": sum(1 for row in rows if row["semanticNodeFound"]),
            "currentExtraRelationNodes": sum(1 for row in rows if any(row["currentExtra"].values())),
            "replacementAddedSecuritySystemNodes": sum(1 for row in rows if row["replacementAdded"]["securitySystems"] > 0 or row["replacement"]["securitySystems"] > 0),
        },
        "nodes": rows,
    }


def markdown_node_diff(diff: dict[str, Any]) -> str:
    lines = ["# Environment Basemap Node Details Replacement Diff", ""]
    lines.append("| 节点 | matched context | current 服务/系统/模块/措施 | replacement 服务/系统/模块/措施 | 风险 |")
    lines.append("|---|---|---|---|---|")
    for row in diff["nodes"]:
        current = row["current"]
        replacement = row["replacement"]
        lines.append(
            "| {name} | `{key}` | {cs}/{csy}/{cm}/{cme} | {rs}/{rsy}/{rm}/{rme} | {risk} |".format(
                name=row.get("objectName") or row.get("label"),
                key=row.get("matchedObjectContextKey") or "",
                cs=current["services"],
                csy=current["securitySystems"],
                cm=current["modules"],
                cme=current["measures"],
                rs=replacement["services"],
                rsy=replacement["securitySystems"],
                rm=replacement["modules"],
                rme=replacement["measures"],
                risk=row.get("riskReason") or "",
            )
        )
    return "\n".join(lines) + "\n"


def validate_bundle(bundle: dict[str, Any], node_details: dict[str, Any], matrix_rows: list[dict[str, Any]]) -> list[str]:
    errors = []
    relations = bundle.get("relations", [])
    if not all(relation.get("objectContextKey") for relation in relations):
        errors.append("replacement workbench relation missing objectContextKey")
    object_contexts = [
        obj.get("contextKey")
        for env in bundle.get("environment_scope_tree", [])
        for obj in env.get("objects", [])
        if obj.get("contextKey")
    ]
    if len(object_contexts) != len(set(object_contexts)):
        errors.append("duplicate objectContextKey in replacement environment_scope_tree")
    for row in matrix_rows:
        for field in ("securityTechnologyModule", "securityTechnicalMeasure"):
            item = row.get(field) or {}
            title = text(item.get("title") if isinstance(item, dict) else item)
            if title == "/" or title.upper().startswith("N/A"):
                errors.append(f"{field} contains invalid relation value: {title}")
    for detail in (node_details.get("nodeDetailsByMxId") or {}).values():
        for group in detail.get("directScopeGroups", []):
            if "securitySystems" not in group:
                errors.append("node detail scope group missing securitySystems")
                return errors
    return errors


def markdown_bundle_diff(payload: dict[str, Any]) -> str:
    lines = ["# Environment Reimport Replacement Bundle Diff", ""]
    lines.append(f"- generatedAt: {payload['generatedAt']}")
    lines.append(f"- validationErrors: {len(payload['validationErrors'])}")
    lines.append("")
    lines.append("## Stats")
    for key, value in payload["stats"].items():
        lines.append(f"- {key}: {value}")
    lines.append("")
    lines.append("## Notes")
    for note in payload["notes"]:
        lines.append(f"- {note}")
    return "\n".join(lines) + "\n"


def main() -> int:
    parser = argparse.ArgumentParser(description="Build environment reimport replacement candidate bundle.")
    parser.add_argument("--output-dir", default=str(BUNDLE_DIR))
    args = parser.parse_args()
    bundle_dir = Path(args.output_dir)
    if not bundle_dir.is_absolute():
        bundle_dir = PROJECT_ROOT / bundle_dir
    bundle_dir.mkdir(parents=True, exist_ok=True)

    candidate = load_json(OUTPUT_DIR / "environment-workbench-reimport-candidate.json")
    current = load_json(CURRENT_WORKBENCH)
    current_details = load_json(CURRENT_NODE_DETAILS)
    semantic = load_json(SEMANTIC_PATH)
    shadow = build_shadow(candidate, current)
    replacement_workbench = build_replacement_workbench(shadow, current)
    matrix_rows = build_matrix_rows(shadow)
    replacement_details = rebuild_node_details(current_details, semantic, shadow, replacement_workbench)
    node_diff = diff_node_details(current_details, replacement_details, semantic)
    validation_errors = validate_bundle(replacement_workbench, replacement_details, matrix_rows)

    manifest = {
        "generatedAt": datetime.now().isoformat(timespec="seconds"),
        "bundleDir": str(bundle_dir.relative_to(PROJECT_ROOT)),
        "sourceArtifacts": {
            "candidate": "data/exports/worker-verify/environment-workbench-reimport-candidate.json",
            "currentWorkbench": "frontend/capability-browser/public/data/environment-workbench.json",
            "currentNodeDetails": "frontend/capability-browser/generated/environmentBasemap.node-details.json",
            "semantic": "frontend/capability-browser/generated/environmentBasemap.semantic.json",
        },
        "outputs": [
            "environment-workbench.json",
            "environmentBasemap.node-details.json",
            "environment-scope-service-matrix-rows.json",
            "replacement-manifest.json",
            "replacement-bundle-diff.json",
            "replacement-bundle-diff.md",
            "environmentBasemap-node-details-replacement-diff.json",
            "environmentBasemap-node-details-replacement-diff.md",
        ],
        "notPublicData": True,
        "temporarySwapRequiredForPageRegression": True,
        "objectInstanceUniqueKey": "informationEnvironment + environmentSegment + informationObject",
    }
    stats = {
        "environmentCount": len(replacement_workbench.get("environment_scope_tree", [])),
        "objectContextCount": sum(len(env.get("objects", [])) for env in replacement_workbench.get("environment_scope_tree", [])),
        "relationCount": len(replacement_workbench.get("relations", [])),
        "matrixRows": len(matrix_rows),
        "detailReadyNodes": replacement_details.get("stats", {}).get("detailReadyNodes"),
        "missingDetailNodes": replacement_details.get("stats", {}).get("missingDetailNodes"),
        "moduleSystemRelations": sum(1 for relation in replacement_workbench.get("relations", []) if relation.get("workerVerifyType") == "module_system"),
        "securitySystemCells": sum(1 for row in matrix_rows if row.get("securitySystem")),
        "moduleCells": sum(1 for row in matrix_rows if row.get("securityTechnologyModule")),
        "measureCells": sum(1 for row in matrix_rows if row.get("securityTechnicalMeasure")),
    }
    bundle_diff = {
        "generatedAt": datetime.now().isoformat(timespec="seconds"),
        "stats": stats,
        "validationErrors": validation_errors,
        "nodeDetailDiffSummary": node_diff["summary"],
        "notes": [
            "Replacement bundle is generated under worker-verify only and does not replace public data.",
            "Node details are rebuilt from replacement shadow contextKey relations.",
            "EnvironmentBasemapViewer currently does not render securitySystems; data is present in directScopeGroups[].securitySystems for follow-up UI support.",
        ],
    }

    write_json(bundle_dir / "environment-workbench.json", replacement_workbench)
    write_json(bundle_dir / "environmentBasemap.node-details.json", replacement_details)
    write_json(bundle_dir / "environment-scope-service-matrix-rows.json", matrix_rows)
    write_json(bundle_dir / "replacement-manifest.json", manifest)
    write_json(bundle_dir / "replacement-bundle-diff.json", bundle_diff)
    write_json(bundle_dir / "environmentBasemap-node-details-replacement-diff.json", node_diff)
    (bundle_dir / "replacement-bundle-diff.md").write_text(markdown_bundle_diff(bundle_diff), encoding="utf-8")
    (bundle_dir / "environmentBasemap-node-details-replacement-diff.md").write_text(markdown_node_diff(node_diff), encoding="utf-8")

    print(json.dumps({"result": "pass" if not validation_errors else "fail", "stats": stats, "validationErrors": validation_errors}, ensure_ascii=False, indent=2))
    return 1 if validation_errors else 0


if __name__ == "__main__":
    raise SystemExit(main())
