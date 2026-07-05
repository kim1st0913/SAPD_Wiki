#!/usr/bin/env python3
from __future__ import annotations

import json
import sys
from collections import defaultdict
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "frontend/capability-browser/public/data"

TARGET_MODULE_SERVICES = {
    "数据水印溯源": {
        "I-DI&T-PD.DP-01 数据内容水印",
        "I-AP&T-PD.DP-01 应用页面水印",
        "I-OS&T-PD.DP-01 操作系统屏幕水印",
    },
    "数据脱敏(去标识化)": {
        "I-AP&T-PD.DP-02 应用动态数据脱敏",
        "I-NT&T-PD.DP-02 网络动态数据脱敏",
        "I-DI&T-PD.DP-02 静态数据脱敏",
    },
}
TARGET_SERVICE_CODES = {service.split(" ", 1)[0] for services in TARGET_MODULE_SERVICES.values() for service in services}
SERVICE_TO_REQUIRED_MODULE = {
    "I-DI&T-PD.DP-01": "数据水印溯源",
    "I-AP&T-PD.DP-01": "数据水印溯源",
    "I-OS&T-PD.DP-01": "数据水印溯源",
    "I-AP&T-PD.DP-02": "数据脱敏(去标识化)",
    "I-NT&T-PD.DP-02": "数据脱敏(去标识化)",
    "I-DI&T-PD.DP-02": "数据脱敏(去标识化)",
}
EXPECTED_CAPABILITY_FOCUS = {
    "I-DI&T-PD.DP-01": "T-PD.DP-01",
    "I-AP&T-PD.DP-01": "T-PD.DP-01",
    "I-OS&T-PD.DP-01": "T-PD.DP-01",
    "I-AP&T-PD.DP-02": "T-PD.DP-02",
    "I-NT&T-PD.DP-02": "T-PD.DP-02",
    "I-DI&T-PD.DP-02": "T-PD.DP-02",
}
EXPECTED_LCDT_STAGE_SERVICES = {
    "DT-04": {
        "I-AP&T-PD.DP-01",
        "I-DI&T-PD.DP-01",
        "I-OS&T-PD.DP-01",
        "I-AP&T-PD.DP-02",
        "I-DI&T-PD.DP-02",
        "I-NT&T-PD.DP-02",
    },
    "DT-05": {
        "I-AP&T-PD.DP-01",
        "I-DI&T-PD.DP-01",
        "I-OS&T-PD.DP-01",
        "I-AP&T-PD.DP-02",
        "I-NT&T-PD.DP-02",
        "I-DI&T-PD.DP-02",
    },
}
EXPECTED_LCDT_POLICY_ROWS = {
    ("DT-04", "脱敏", 7): {"I-NT&T-PD.DP-02", "I-AP&T-PD.DP-02", "I-DI&T-PD.DP-02"},
    ("DT-04", "水印", 8): {"I-AP&T-PD.DP-01", "I-OS&T-PD.DP-01", "I-DI&T-PD.DP-01"},
    ("DT-05", "脱敏", 5): {"I-DI&T-PD.DP-02", "I-NT&T-PD.DP-02", "I-AP&T-PD.DP-02"},
    ("DT-05", "水印", 7): {"I-DI&T-PD.DP-01", "I-AP&T-PD.DP-01", "I-OS&T-PD.DP-01"},
}


def read_json(relative_path: str) -> dict[str, Any]:
    return json.loads((DATA_DIR / relative_path).read_text(encoding="utf-8"))


def service_display(service: dict[str, Any]) -> str:
    return " ".join(str(service.get(key) or "").strip() for key in ("code", "title")).strip()


def object_values(workbench: dict[str, Any], object_type: str) -> list[dict[str, Any]]:
    values = workbench.get("objects", {}).get(object_type, {})
    if isinstance(values, dict):
        return list(values.values())
    if isinstance(values, list):
        return values
    return []


def object_index(workbench: dict[str, Any]) -> dict[str, dict[str, Any]]:
    index: dict[str, dict[str, Any]] = {}
    for values in workbench.get("objects", {}).values():
        if isinstance(values, dict):
            index.update(values)
        elif isinstance(values, list):
            index.update({item.get("id"): item for item in values if isinstance(item, dict) and item.get("id")})
    return index


def module_services_from_modules_payload(payload: dict[str, Any]) -> dict[str, set[str]]:
    result: dict[str, set[str]] = {}
    for module in payload.get("security_technology_modules", []):
        title = module.get("title")
        if title in TARGET_MODULE_SERVICES:
            result[title] = {service_display(service) for service in module.get("services", [])}
    return result


def audit_dictionary() -> dict[str, Any]:
    sources = {
        "maintenance_knowledge": read_json("maintenance-knowledge.json"),
        "maintenance_modules": read_json("maintenance/modules.json"),
        "maintenance_sections_modules": read_json("maintenance/sections/modules.json"),
    }
    module_services = {name: module_services_from_modules_payload(payload) for name, payload in sources.items()}
    failures = []
    for source_name, modules in module_services.items():
        for module_title, expected in TARGET_MODULE_SERVICES.items():
            actual = modules.get(module_title, set())
            if actual != expected:
                failures.append(
                    {
                        "source": source_name,
                        "module": module_title,
                        "missing": sorted(expected - actual),
                        "extra": sorted(actual - expected),
                    }
                )
    return {
        "moduleServices": {
            source_name: {module: sorted(services) for module, services in modules.items()}
            for source_name, modules in module_services.items()
        },
        "failureCount": len(failures),
        "failures": failures,
    }


def audit_capability() -> dict[str, Any]:
    workbench = read_json("capability-workbench.json")
    by_id = object_index(workbench)
    service_by_code = {item.get("code"): item for item in object_values(workbench, "security_technical_service")}
    focus_by_service: dict[str, set[str]] = defaultdict(set)
    modules_by_service: dict[str, set[str]] = defaultdict(set)

    for relation in workbench.get("relations", []):
        source = by_id.get(relation.get("sourceId"), {})
        target = by_id.get(relation.get("targetId"), {})
        if relation.get("type") == "supports_focus" and source.get("code") in TARGET_SERVICE_CODES:
            focus_by_service[source.get("code")].add(target.get("code") or target.get("title") or "")
        if relation.get("type") == "implemented_by_module" and source.get("code") in TARGET_SERVICE_CODES:
            modules_by_service[source.get("code")].add(target.get("title") or "")

    failures = []
    for code, expected_focus in EXPECTED_CAPABILITY_FOCUS.items():
        if code not in service_by_code:
            failures.append({"service": code, "reason": "missing capability service object"})
        if expected_focus not in focus_by_service.get(code, set()):
            failures.append({"service": code, "reason": "missing expected focus", "expected": expected_focus, "actual": sorted(focus_by_service.get(code, set()))})
        required_module = SERVICE_TO_REQUIRED_MODULE[code]
        if required_module not in modules_by_service.get(code, set()):
            failures.append({"service": code, "reason": "missing required module", "expected": required_module, "actual": sorted(modules_by_service.get(code, set()))})

    return {
        "targetServices": {
            code: {
                "title": service_by_code.get(code, {}).get("title", ""),
                "focuses": sorted(focus_by_service.get(code, set())),
                "modules": sorted(modules_by_service.get(code, set())),
            }
            for code in sorted(TARGET_SERVICE_CODES)
        },
        "failureCount": len(failures),
        "failures": failures,
    }


def audit_environment() -> dict[str, Any]:
    workbench = read_json("environment-workbench.json")
    contexts_by_service: dict[str, list[dict[str, Any]]] = defaultdict(list)
    contexts_by_module: dict[str, list[dict[str, Any]]] = defaultdict(list)

    for environment in workbench.get("environment_scope_tree", []):
        env_title = environment.get("title") or ""
        for info_object in environment.get("objects", []):
            object_title = info_object.get("title") or ""
            segments = [segment.get("title") or "" for segment in info_object.get("segments", [])] or [""]
            for mapping in info_object.get("scope_mappings", []):
                scope_code = (mapping.get("scope") or {}).get("code") or ""
                for service in mapping.get("services", []):
                    code = service.get("code") or ""
                    if code not in TARGET_SERVICE_CODES:
                        continue
                    module_titles = sorted({module.get("title") or "" for module in service.get("modules", []) if module.get("title")})
                    for segment_title in segments:
                        context = {
                            "environment": env_title,
                            "segment": segment_title,
                            "object": object_title,
                            "scope": scope_code,
                            "service": service_display(service),
                            "modules": module_titles,
                        }
                        contexts_by_service[code].append(context)
                        for module_title in module_titles:
                            if module_title in TARGET_MODULE_SERVICES:
                                contexts_by_module[module_title].append(context)

    failures = []
    storage_context = ("云数据中心", "大数据平台/数据中台", "数据存储计算层")
    storage_services = {
        context["service"].split(" ", 1)[0]
        for contexts in contexts_by_service.values()
        for context in contexts
        if (context["environment"], context["segment"], context["object"]) == storage_context
    }
    if "I-NT&T-PD.DP-02" in storage_services:
        failures.append({"reason": "environment object was over-expanded with network desensitization", "context": " / ".join(storage_context)})
    for required in ("I-AP&T-PD.DP-02", "I-DI&T-PD.DP-02"):
        if required not in storage_services:
            failures.append({"reason": "environment object missing expected actual desensitization service", "context": " / ".join(storage_context), "service": required})

    return {
        "contextCountByService": {code: len(contexts) for code, contexts in sorted(contexts_by_service.items())},
        "contextCountByTargetModule": {module: len(contexts) for module, contexts in sorted(contexts_by_module.items())},
        "storageComputeLayerServices": sorted(storage_services),
        "sampleContextsByService": {code: contexts[:8] for code, contexts in sorted(contexts_by_service.items())},
        "failureCount": len(failures),
        "failures": failures,
    }


def audit_lcap() -> dict[str, Any]:
    lifecycle = read_json("lifecycle-knowledge.json")
    application_payload = lifecycle.get("application_security_development", {})
    text = json.dumps(application_payload, ensure_ascii=False)
    service_hits = {code: text.count(code) for code in sorted(TARGET_SERVICE_CODES)}
    module_hits = {module: text.count(module) for module in sorted(TARGET_MODULE_SERVICES)}
    failures = []
    for code, count in service_hits.items():
        if count:
            failures.append({"service": code, "reason": "target security technical service unexpectedly appears in LC-AP", "count": count})
    for module, count in module_hits.items():
        if count:
            failures.append({"module": module, "reason": "target security technology module unexpectedly appears in LC-AP", "count": count})
    return {
        "targetServiceHits": service_hits,
        "targetModuleHits": module_hits,
        "failureCount": len(failures),
        "failures": failures,
    }


def audit_lcdt() -> dict[str, Any]:
    workbench = read_json("lifecycle-workbench.json")
    by_id = object_index(workbench)
    stage_services: dict[str, set[str]] = defaultdict(set)
    service_modules: dict[str, set[str]] = defaultdict(set)
    for relation in workbench.get("relations", []):
        source = by_id.get(relation.get("sourceId"), {})
        target = by_id.get(relation.get("targetId"), {})
        if relation.get("type") == "maps_to_service" and target.get("code") in TARGET_SERVICE_CODES:
            stage_services[source.get("code") or source.get("title") or ""].add(target.get("code") or "")
        if relation.get("type") == "implemented_by_module" and source.get("code") in TARGET_SERVICE_CODES:
            service_modules[source.get("code") or ""].add(target.get("title") or "")

    lifecycle = read_json("lifecycle-knowledge.json")
    policy_rows: dict[tuple[str, str, int], set[str]] = {}
    policy_details: dict[str, Any] = {}
    for process in lifecycle.get("data_lifecycle", {}).get("processes", []):
        stage_code = process.get("code") or ""
        for row in process.get("data_policy_rows", []):
            key = (stage_code, row.get("category") or "", int(row.get("sequence") or 0))
            services = {service.get("code") or "" for service in row.get("technical_services", []) if service.get("code") in TARGET_SERVICE_CODES}
            if not services:
                continue
            policy_rows[key] = services
            policy_details[" / ".join([stage_code, row.get("category") or "", str(row.get("sequence") or "")])] = {
                "policies": [policy.get("code") for policy in row.get("policies", []) if policy.get("code")],
                "services": [service_display(service) for service in row.get("technical_services", []) if service.get("code") in TARGET_SERVICE_CODES],
                "modules": sorted({module.get("title") or "" for module in row.get("technology_modules", []) if module.get("title")}),
            }

    failures = []
    for stage_code, expected_services in EXPECTED_LCDT_STAGE_SERVICES.items():
        actual = stage_services.get(stage_code, set()) & TARGET_SERVICE_CODES
        if actual != expected_services:
            failures.append({"stage": stage_code, "reason": "LC-DT stage target services mismatch", "missing": sorted(expected_services - actual), "extra": sorted(actual - expected_services)})
    for key, expected_services in EXPECTED_LCDT_POLICY_ROWS.items():
        actual = policy_rows.get(key, set())
        if actual != expected_services:
            failures.append({"policyRow": " / ".join(map(str, key)), "reason": "LC-DT policy row services mismatch", "missing": sorted(expected_services - actual), "extra": sorted(actual - expected_services)})
    return {
        "stageTargetServices": {stage: sorted(services & TARGET_SERVICE_CODES) for stage, services in sorted(stage_services.items()) if services & TARGET_SERVICE_CODES},
        "targetServiceModules": {code: sorted(service_modules.get(code, set())) for code in sorted(TARGET_SERVICE_CODES)},
        "policyRows": policy_details,
        "failureCount": len(failures),
        "failures": failures,
    }


def main() -> int:
    sections = {
        "dictionary": audit_dictionary(),
        "capability": audit_capability(),
        "environment": audit_environment(),
        "lcAp": audit_lcap(),
        "lcDt": audit_lcdt(),
    }
    failures = {
        name: section["failures"]
        for name, section in sections.items()
        if section.get("failureCount")
    }
    result = {"status": "pass" if not failures else "fail", **sections, "failures": failures}
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0 if not failures else 1


if __name__ == "__main__":
    sys.exit(main())
