#!/usr/bin/env python3
from __future__ import annotations

import hashlib
import json
from copy import deepcopy
from pathlib import Path
from typing import Any

from audit_security_technical_service_dictionary_update import (
    FORMAL_PACKAGES,
    OUT_DIR,
    ROOT,
    audit,
    choose_canonical_for_reference,
    index_by,
    load_json,
    text,
    write_json,
    write_md,
)


CANDIDATE_DIR = OUT_DIR / "candidate-package"
SKIP_KEYS = {"source", "sources", "sourceCells", "evidenceRefs", "sourceReferences", "rawValue", "raw_value"}


def simple_service(service: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": service.get("id"),
        "type": "security_technical_service",
        "code": service.get("code"),
        "title": service.get("title"),
        "description": service.get("description"),
        "category": service.get("category"),
    }


def service_with_metadata(service: dict[str, Any]) -> dict[str, Any]:
    item = simple_service(service)
    metadata = service.get("metadata")
    if metadata:
        item["metadata"] = metadata
    return item


def file_sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def payload_sha256(payload: Any) -> str:
    data = json.dumps(payload, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode("utf-8")
    return hashlib.sha256(data).hexdigest()


def load_diff() -> dict[str, Any]:
    return load_json(OUT_DIR / "security-technical-service-dictionary-diff.json")


def build_scope_map(maintenance: dict[str, Any]) -> dict[str, dict[str, Any]]:
    return {
        text(scope.get("code")): {
            key: deepcopy(value)
            for key, value in scope.items()
            if key != "services"
        }
        for scope in maintenance.get("scope_types", [])
        if text(scope.get("code"))
    }


def build_service_entry(candidate: dict[str, Any], current_entries_by_id: dict[str, dict[str, Any]], include_sources: bool) -> dict[str, Any]:
    service_id = text(candidate.get("id"))
    base = deepcopy(current_entries_by_id.get(service_id, {}))
    base_service = deepcopy(base.get("service") if isinstance(base.get("service"), dict) else {})
    base_service.update(simple_service(candidate))
    if include_sources:
        source = candidate.get("source")
        sources = deepcopy(base_service.get("sources") or base.get("sources") or [])
        if source and not sources:
            sources = [source]
        if sources:
            base_service["sources"] = sources
            base["sources"] = deepcopy(sources)
    else:
        base_service = {key: base_service.get(key) for key in ("id", "type", "code", "title", "description", "category")}
    base["service"] = base_service
    base.setdefault("scopes", [])
    base.setdefault("modules", [])
    base.setdefault("module_count", len(base.get("modules") or []))
    base.setdefault("system_count", 0)
    base.setdefault("product_count", 0)
    base.setdefault("environment_count", 0)
    return base


def replace_service_catalog(payload: dict[str, Any], candidate_services: list[dict[str, Any]], include_sources: bool) -> None:
    current_entries = payload.get("security_technical_services", [])
    by_id = {}
    for entry in current_entries:
        service = entry.get("service") if isinstance(entry, dict) else None
        if isinstance(service, dict) and text(service.get("id")):
            by_id[text(service.get("id"))] = entry
    payload["security_technical_services"] = [
        build_service_entry(candidate, by_id, include_sources)
        for candidate in candidate_services
    ]
    payload.setdefault("stats", {})["security_technical_services"] = len(candidate_services)
    if "section_counts" in payload:
        payload["section_counts"]["services"] = len(candidate_services)
    for section in payload.get("sections", []):
        if section.get("id") == "services":
            section["count"] = len(candidate_services)


def replace_scope_services(payload: dict[str, Any], candidate_services: list[dict[str, Any]]) -> None:
    by_scope: dict[str, list[dict[str, Any]]] = {}
    for service in candidate_services:
        by_scope.setdefault(text(service.get("category")), []).append(simple_service(service))
    for scope in payload.get("scope_types", []):
        code = text(scope.get("code"))
        if code in by_scope or "services" in scope:
            scope["services"] = deepcopy(by_scope.get(code, []))


def canonical_indexes(candidate_services: list[dict[str, Any]]) -> tuple[dict[str, dict[str, Any]], dict[str, list[dict[str, Any]]]]:
    by_code = index_by(candidate_services, "code")
    by_title: dict[str, list[dict[str, Any]]] = {}
    for service in candidate_services:
        by_title.setdefault(text(service.get("title")), []).append(service)
    return by_code, by_title


def transform_service_references(
    node: Any,
    candidate_by_code: dict[str, dict[str, Any]],
    candidate_by_title: dict[str, list[dict[str, Any]]],
    scope_map: dict[str, dict[str, Any]],
    skip: bool = False,
) -> Any:
    if isinstance(node, list):
        return [transform_service_references(item, candidate_by_code, candidate_by_title, scope_map, skip) for item in node]
    if not isinstance(node, dict):
        return node

    if node.get("type") == "security_technical_service" and not skip:
        canonical, status, _choices = choose_canonical_for_reference(
            {"id": node.get("id"), "code": node.get("code"), "title": node.get("title") or node.get("name")},
            candidate_by_code,
            candidate_by_title,
        )
        if canonical and status in {"code_matched", "code_matched_title_stale", "title_unique_code_changed", "title_matched"}:
            updated = deepcopy(node)
            for key, value in simple_service(canonical).items():
                updated[key] = value
            if "name" in updated:
                updated["name"] = canonical.get("title")
            metadata = updated.get("metadata")
            if isinstance(metadata, dict):
                metadata["category"] = canonical.get("category")
                metadata["scope_code"] = canonical.get("category")
                metadata["object_key"] = f"security_technical_service::{canonical.get('code')}"
            return updated

    updated = {}
    for key, value in node.items():
        updated[key] = transform_service_references(
            value,
            candidate_by_code,
            candidate_by_title,
            scope_map,
            skip or key in SKIP_KEYS,
        )

    for services_key, ids_key, names_key in [
        ("related_services", "related_service_ids", "related_service_names"),
        ("services", "service_ids", "service_names"),
    ]:
        services = updated.get(services_key)
        if isinstance(services, list) and services and all(isinstance(item, dict) and item.get("type") == "security_technical_service" for item in services):
            if ids_key in updated:
                updated[ids_key] = [item.get("id") for item in services if item.get("id")]
            if names_key in updated:
                updated[names_key] = [item.get("title") for item in services if item.get("title")]
            if "service_count" in updated:
                updated["service_count"] = len(services)

    scope = updated.get("scope")
    services = updated.get("services")
    if isinstance(scope, dict) and isinstance(services, list) and services:
        categories = {text(item.get("category")) for item in services if isinstance(item, dict) and item.get("type") == "security_technical_service"}
        categories.discard("")
        if len(categories) == 1:
            category = next(iter(categories))
            if category in scope_map and text(scope.get("code")) != category:
                updated["scope"] = deepcopy(scope_map[category])
    return updated


def update_counts(payload: dict[str, Any], candidate_services: list[dict[str, Any]]) -> None:
    count = len(candidate_services)
    if isinstance(payload.get("stats"), dict) and "security_technical_services" in payload["stats"]:
        payload["stats"]["security_technical_services"] = count
    if isinstance(payload.get("section_counts"), dict) and "services" in payload["section_counts"]:
        payload["section_counts"]["services"] = count
    for section in payload.get("sections", []) if isinstance(payload.get("sections"), list) else []:
        if section.get("id") == "services":
            section["count"] = count


def build_candidate() -> dict[str, Any]:
    audit_result = audit()
    diff = load_diff()
    candidate_services = diff["candidateServices"]
    candidate_by_code, candidate_by_title = canonical_indexes(candidate_services)
    maintenance = load_json(ROOT / "frontend/capability-browser/public/data/maintenance-knowledge.json")
    scope_map = build_scope_map(maintenance)
    CANDIDATE_DIR.mkdir(parents=True, exist_ok=True)

    files = []
    for package in FORMAL_PACKAGES:
        if not package.exists():
            continue
        payload = load_json(package)
        transformed = transform_service_references(payload, candidate_by_code, candidate_by_title, scope_map)
        rel = package.relative_to(ROOT)
        if rel.as_posix() == "frontend/capability-browser/public/data/maintenance-knowledge.json":
            replace_service_catalog(transformed, candidate_services, include_sources=True)
            replace_scope_services(transformed, candidate_services)
        elif rel.as_posix() == "frontend/capability-browser/public/data/maintenance/services.json":
            replace_service_catalog(transformed, candidate_services, include_sources=False)
        update_counts(transformed, candidate_services)
        changed = payload != transformed
        target = CANDIDATE_DIR / rel
        write_json(target, transformed)
        files.append(
            {
                "path": str(rel),
                "candidatePath": str(target.relative_to(ROOT)),
                "beforeSha256": file_sha256(package),
                "afterSha256": payload_sha256(transformed),
                "changed": changed,
            }
        )

    blockers = []
    if audit_result.get("requiresUserConfirmationCount"):
        blockers.append("dictionary_diff_requires_user_confirmation")
    reference_impact = audit_result.get("referenceImpact", {})
    if reference_impact.get("unknownServiceReferenceCount") or reference_impact.get("ambiguousReferenceCount"):
        blockers.append("reference_resolution_issue")
    candidate_payload = {
        "version": 1,
        "status": "ready_for_apply" if not blockers else "needs_user_confirmation",
        "blockers": blockers,
        "auditSummary": audit_result,
        "sourceServiceCount": len(candidate_services),
        "targetServiceCount": 160,
        "files": files,
        "sqlitePlan": diff["sqliteDiff"],
        "diff": {
            "addedServices": diff["diff"]["addedServices"],
            "renamedServicesBySameId": diff["diff"]["renamedServicesBySameId"],
            "codeChangedServicesBySameName": diff["diff"]["codeChangedServicesBySameName"],
            "removedServices": diff["diff"]["removedServices"],
        },
    }
    write_json(OUT_DIR / "security-technical-service-update-candidate.json", candidate_payload)
    lines = ["# 安全技术服务字典更新候选包", "", f"- `status`: {candidate_payload['status']}", f"- `sourceServiceCount`: {len(candidate_services)}", ""]
    lines.extend(["## 字典变化", ""])
    for change in candidate_payload["diff"]["codeChangedServicesBySameName"]:
        lines.append(f"- 编码迁移：`{change['oldCode']}` -> `{change['newCode']}` {change['title']}")
    for change in candidate_payload["diff"]["renamedServicesBySameId"]:
        lines.append(f"- 同编码改名：`{change['code']}` {change['oldTitle']} -> {change['newTitle']}")
    for service in candidate_payload["diff"]["addedServices"]:
        lines.append(f"- 新增：`{service['code']}` {service['title']}")
    lines.extend(["", "## 候选文件", ""])
    for item in files:
        marker = "changed" if item["changed"] else "unchanged"
        lines.append(f"- `{item['path']}`: {marker}")
    write_md(OUT_DIR / "security-technical-service-update-candidate.md", "\n".join(lines))
    print(json.dumps(candidate_payload, ensure_ascii=False, indent=2))
    return candidate_payload


if __name__ == "__main__":
    build_candidate()
