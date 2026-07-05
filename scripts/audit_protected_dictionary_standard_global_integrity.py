#!/usr/bin/env python3
from __future__ import annotations

import json
import os
import re
import subprocess
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "frontend" / "capability-browser" / "public" / "data"
GENERATED_DIR = ROOT / "frontend" / "capability-browser" / "generated"
OUT_DIR = ROOT / "data" / "exports" / "worker-verify" / "protected-dictionary-standard-global-audit"

PLACEHOLDERS = {"", "/", "\\", "n/a", "na", "none", "null", "待补充", "暂无", "未编号", "待确认"}
HEADER_LIKE = {
    "id",
    "编号",
    "序号",
    "名称",
    "标题",
    "安全技术服务",
    "安全技术模块",
    "安全技术措施",
    "安全系统",
    "控制编号",
    "控制名称",
}
FORBIDDEN_DATA_PATH_PARTS = ("/private/", "/Users/", "C:\\", "file://")
NON_BUSINESS_KEYS = {
    "debug",
    "raw",
    "raw_value",
    "rawValue",
    "sourceRow",
    "sourceRows",
    "source_file",
    "sourceFile",
    "import_id",
    "source_id",
    "source_ref",
    "source_label",
    "intermediate",
}

EXPECTED_FRAMEWORK_TITLES = {
    "GB-T-22239-2019-L3": "GB/T 22239-2019 网络安全等级保护基本要求 第三级",
    "NIST-CSF-2.0": "NIST Cybersecurity Framework 2.0",
    "ISO-IEC-27001-2022": "ISO/IEC 27001:2022",
    "DSP-SCF-2026": "DSP Secure Controls Framework (SCF) - 2026",
    "CIS-CSC-V8.1.2": "CIS Controls v8.1.2",
    "CRF-SAFEGUARDS-CORE-2026": "CRF Safeguards Core Edition v2026",
    "NIST-800-53-REV5": "NIST SP 800-53 Rev.5",
}

OLD_SERVICE_CODE_MAP = {
    f"I-OS&T-AS.DS-0{i}": f"I-AP&T-AS.DS-0{i}" for i in range(1, 7)
}
OLD_SERVICE_NAME_BY_CODE = {
    "I-DI&T-PD.DP-01": {"old": "应用页面水印", "canonical": "数据内容水印"},
    "I-DI&T-PD.DP-02": {"old": "应用动态数据脱敏", "canonical": "静态数据脱敏"},
}
REQUIRED_MEASURES = {"应用程序威胁建模", "制品安全加固", "IaC代码安全测试", "数据销毁"}
SERVICE_CODE_RE = re.compile(r"\b(?:(?:ALL|I-[A-Z]{2})&T-[A-Z]{2}\.[A-Z]{2}-\d{2}|M-[A-Z]{2}\.[A-Z]{2}-00)\b")

FORMAL_RUNTIME_FILES = [
    "maintenance-knowledge.json",
    "maintenance-index.json",
    "maintenance/services.json",
    "maintenance/modules.json",
    "maintenance/measures.json",
    "maintenance/scopes.json",
    "maintenance/processes.json",
    "maintenance/security-works.json",
    "maintenance/work-functions.json",
    "maintenance/references.json",
    "management-knowledge.json",
    "shared-lookups.json",
    "capability-tree.json",
    "capability-workbench.json",
    "lifecycle-knowledge.json",
    "lifecycle-workbench.json",
    "environment-workbench.json",
    "standards-data.json",
    "standards-index.json",
]


def now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def text(value: Any) -> str:
    return "" if value is None else str(value).replace("\xa0", " ").replace("\u3000", " ").strip()


def norm(value: Any) -> str:
    return re.sub(r"\s+", " ", text(value)).strip()


def canonical_text(value: Any) -> str:
    return re.sub(r"[\s\-_:/|,，、（）()]+", "", norm(value).lower())


def read_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def write_text(path: Path, content: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content.rstrip() + "\n", encoding="utf-8")


def rel(path: Path) -> str:
    return path.relative_to(ROOT).as_posix()


def list_value(value: Any) -> list[Any]:
    return value if isinstance(value, list) else []


def dict_value(value: Any) -> dict[str, Any]:
    return value if isinstance(value, dict) else {}


def object_title(item: dict[str, Any]) -> str:
    return norm(item.get("title") or item.get("name") or item.get("label") or item.get("displayName"))


def object_code(item: dict[str, Any]) -> str:
    return norm(item.get("code") or item.get("frameworkCode") or item.get("originalControlId") or item.get("controlId"))


def object_id(item: dict[str, Any]) -> str:
    return norm(item.get("id") or item.get("key"))


def walk_json(value: Any, path: str = "$"):
    yield path, value
    if isinstance(value, dict):
        for key, child in value.items():
            yield from walk_json(child, f"{path}.{key}")
    elif isinstance(value, list):
        for index, child in enumerate(value):
            yield from walk_json(child, f"{path}[{index}]")


def collect_typed_objects(value: Any, wanted_type: str | None = None) -> list[dict[str, Any]]:
    records: list[dict[str, Any]] = []
    for _, node in walk_json(value):
        if isinstance(node, dict) and isinstance(node.get("type"), str):
            if wanted_type is None or node.get("type") == wanted_type:
                records.append(node)
    return records


def unique_by_id_or_title(records: list[dict[str, Any]]) -> list[dict[str, Any]]:
    seen = set()
    result = []
    for item in records:
        key = object_id(item) or f"{object_code(item)}::{object_title(item)}"
        if key in seen:
            continue
        seen.add(key)
        result.append(item)
    return result


def flatten_process_references(processes_payload: dict[str, Any]) -> list[dict[str, Any]]:
    refs: list[dict[str, Any]] = []
    for process in list_value(processes_payload.get("security_processes")):
        for group in list_value(dict_value(process).get("groups")):
            refs.extend([r for r in list_value(dict_value(group).get("references")) if isinstance(r, dict)])
    return unique_by_id_or_title(refs)


def flatten_application_components(lifecycle_payload: dict[str, Any]) -> list[dict[str, Any]]:
    app = dict_value(lifecycle_payload.get("application_security_development"))
    components: list[dict[str, Any]] = []
    for system_type in list_value(app.get("application_system_types")):
        components.extend([c for c in list_value(dict_value(system_type).get("components")) if isinstance(c, dict)])
    return unique_by_id_or_title(components)


def flatten_service_records(payload: dict[str, Any]) -> list[dict[str, Any]]:
    records: list[dict[str, Any]] = []
    for row in list_value(payload.get("security_technical_services")):
        if isinstance(row, dict):
            service = dict_value(row.get("service"))
            records.append(service or row)
    return unique_by_id_or_title(records)


def flatten_security_systems(*payloads: dict[str, Any]) -> list[dict[str, Any]]:
    systems: list[dict[str, Any]] = []
    for payload in payloads:
        systems.extend(collect_typed_objects(payload, "security_system"))
    return unique_by_id_or_title(systems)


def dictionary_sources() -> dict[str, dict[str, Any]]:
    maintenance = read_json(DATA_DIR / "maintenance-knowledge.json")
    scopes = read_json(DATA_DIR / "maintenance" / "scopes.json")
    services = read_json(DATA_DIR / "maintenance" / "services.json")
    modules = read_json(DATA_DIR / "maintenance" / "modules.json")
    measures = read_json(DATA_DIR / "maintenance" / "measures.json")
    processes = read_json(DATA_DIR / "maintenance" / "processes.json")
    security_works = read_json(DATA_DIR / "maintenance" / "security-works.json")
    work_functions = read_json(DATA_DIR / "maintenance" / "work-functions.json")
    references = read_json(DATA_DIR / "maintenance" / "references.json")
    lifecycle = read_json(DATA_DIR / "lifecycle-knowledge.json")
    capability_tree = read_json(DATA_DIR / "capability-tree.json")

    app = dict_value(lifecycle.get("application_security_development"))
    return {
        "安全能力清单": {"source": "capability-tree.json", "records": collect_typed_objects(capability_tree, "capability")},
        "安全能力关注点": {"source": "capability-tree.json", "records": collect_typed_objects(capability_tree, "capability_focus")},
        "安全能力作用域目录": {"source": "maintenance/scopes.json", "records": list_value(scopes.get("scope_types"))},
        "安全技术服务清单": {"source": "maintenance/services.json", "records": flatten_service_records(services)},
        "安全技术模块清单": {"source": "maintenance/modules.json", "records": list_value(modules.get("security_technology_modules"))},
        "安全技术措施清单": {"source": "maintenance/measures.json", "records": list_value(measures.get("security_technical_measures"))},
        "安全系统清单": {"source": "maintenance/modules.json + maintenance/services.json", "records": flatten_security_systems(modules, services)},
        "安全管理工作清单": {"source": "maintenance/security-works.json", "records": list_value(security_works.get("security_works"))},
        "安全流程清单": {"source": "maintenance/processes.json", "records": list_value(processes.get("security_processes"))},
        "流程参考清单": {"source": "maintenance/processes.json", "records": flatten_process_references(processes)},
        "安全职能层级": {"source": "maintenance/work-functions.json", "records": list_value(work_functions.get("work_function_layers"))},
        "安全职能清单": {"source": "maintenance/work-functions.json", "records": collect_typed_objects(work_functions, "work_function")},
        "应用系统类型": {"source": "lifecycle-knowledge.json", "records": list_value(app.get("application_system_types"))},
        "应用系统目录": {"source": "lifecycle-knowledge.json", "records": flatten_application_components(lifecycle)},
        "GB/T 42446-2023 参考": {"source": "maintenance/references.json", "records": list_value(references.get("gbt_42446_references"))},
        "Gartner 岗位参考": {"source": "maintenance/references.json", "records": list_value(references.get("gartner_roles"))},
        "维护总包-安全技术服务": {"source": "maintenance-knowledge.json", "records": flatten_service_records(maintenance)},
        "维护总包-安全技术模块": {"source": "maintenance-knowledge.json", "records": list_value(maintenance.get("security_technology_modules"))},
        "维护总包-安全技术措施": {"source": "maintenance-knowledge.json", "records": list_value(maintenance.get("security_technical_measures"))},
    }


def duplicate_groups(values: list[str]) -> list[dict[str, Any]]:
    counter = Counter([value for value in values if value])
    return [{"value": key, "count": count} for key, count in sorted(counter.items()) if count > 1]


def audit_dictionary(name: str, source: str, records: list[dict[str, Any]]) -> dict[str, Any]:
    ids = [object_id(item) for item in records]
    codes = [object_code(item) for item in records]
    names = [object_title(item) for item in records]
    invalid = []
    placeholder_values = []
    header_values = []
    id_to_names: dict[str, set[str]] = defaultdict(set)
    name_to_ids: dict[str, set[str]] = defaultdict(set)
    for index, item in enumerate(records):
        item_id = ids[index]
        name_value = names[index]
        code_value = codes[index]
        if item_id:
            id_to_names[item_id].add(name_value)
        if name_value:
            name_to_ids[name_value].add(item_id or code_value)
        for field, value in (("id", item_id), ("code", code_value), ("name", name_value)):
            if canonical_text(value) in PLACEHOLDERS and field != "code":
                placeholder_values.append({"row": index, "field": field, "value": value})
            if norm(value) in HEADER_LIKE:
                header_values.append({"row": index, "field": field, "value": value})
        if not item_id and not name_value:
            invalid.append({"row": index, "reason": "missing_id_and_name"})
    same_id_different_name = [
        {"id": item_id, "names": sorted(values)} for item_id, values in id_to_names.items() if len(values) > 1
    ]
    same_name_different_id = [
        {"name": title, "ids": sorted(values)} for title, values in name_to_ids.items() if len([v for v in values if v]) > 1
    ]
    status = "pass"
    if not records or invalid or duplicate_groups(ids) or same_id_different_name:
        status = "fail"
    elif placeholder_values or header_values or same_name_different_id or duplicate_groups(names):
        status = "warning"
    return {
        "dictionaryName": name,
        "sourcePackage": source,
        "count": len(records),
        "idField": "id",
        "codeField": "code|frameworkCode|originalControlId",
        "nameField": "title|name|label",
        "emptyIdCount": sum(1 for value in ids if not value),
        "emptyNameCount": sum(1 for value in names if not value),
        "duplicateIds": duplicate_groups(ids)[:50],
        "duplicateNames": duplicate_groups(names)[:50],
        "sameIdDifferentName": same_id_different_name[:50],
        "sameNameDifferentId": same_name_different_id[:50],
        "placeholderValues": placeholder_values[:50],
        "headerLikeValues": header_values[:50],
        "invalidRows": invalid[:50],
        "status": status,
    }


def control_code(row: dict[str, Any]) -> str:
    mlps = norm(row.get("等保三级控制要求"))
    match = re.match(r"^(\d+(?:\.\d+)+)", mlps)
    if match:
        return match.group(1)
    csf = norm(row.get("分类标识符说明"))
    match = re.match(r"^([A-Z]{2}\.[A-Z]{2}-\d+)", csf)
    if match:
        return match.group(1)
    candidates = [
        row.get("控制编号"),
        row.get("保护措施编号"),
        row.get("SCF编号"),
        row.get("Safeguard ID"),
        row.get("安全策略编号"),
        row.get("等级编号"),
        row.get("等保控制项"),
        row.get("originalControlId"),
        row.get("original_control_id"),
        row.get("controlId"),
        row.get("code"),
    ]
    for candidate in candidates:
        if norm(candidate):
            return norm(candidate)
    return ""


def control_title(row: dict[str, Any]) -> str:
    return norm(
        row.get("控制名称")
        or row.get("安全控制项")
        or row.get("名称")
        or row.get("SCF控制项")
        or row.get("安全控制项名称")
        or row.get("保障措施描述")
        or re.sub(r"^\d+(?:\.\d+)+", "", norm(row.get("等保三级控制要求"))).strip()
        or re.sub(r"^[A-Z]{2}\.[A-Z]{2}-\d+[:：]?\s*", "", norm(row.get("分类标识符说明"))).strip()
        or row.get("title")
        or row.get("name")
    )


def rows_from_standard_payload(payload: dict[str, Any]) -> list[dict[str, Any]]:
    rows = []
    rows.extend([r for r in list_value(payload.get("rows")) if isinstance(r, dict)])
    for tab in list_value(payload.get("tabs")):
        rows.extend([r for r in list_value(dict_value(tab).get("rows")) if isinstance(r, dict)])
    return rows


def load_standard_rows(framework: dict[str, Any]) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    rows: list[dict[str, Any]] = []
    path_issues = []
    targets = list_value(framework.get("tabs")) or [framework]
    for target in targets:
        target_value = dict_value(target)
        data_path = norm(dict_value(target).get("dataPath"))
        if not data_path:
            path_issues.append({"frameworkId": framework.get("id"), "issue": "missing_dataPath"})
            continue
        if any(part in data_path for part in FORBIDDEN_DATA_PATH_PARTS) or data_path.startswith("/") or data_path.startswith("file:"):
            path_issues.append({"frameworkId": framework.get("id"), "issue": "bad_dataPath", "dataPath": data_path})
            continue
        local = DATA_DIR / data_path.removeprefix("./public/data/").removeprefix("public/data/")
        if not local.exists():
            path_issues.append({"frameworkId": framework.get("id"), "issue": "missing_fragment", "dataPath": data_path})
            continue
        payload = read_json(local)
        for row in rows_from_standard_payload(payload):
            row["_frameworkId"] = framework.get("id")
            row["_frameworkCode"] = framework.get("frameworkCode") or framework.get("code")
            row["_frameworkTitle"] = framework.get("title")
            row["_tabId"] = target_value.get("id") or framework.get("id")
            row["_tabTitle"] = target_value.get("title") or framework.get("title")
            row["_dataPath"] = data_path
            rows.append(row)
    return rows, path_issues


def is_non_control_metadata_row(row: dict[str, Any]) -> bool:
    tab_text = canonical_text(" ".join([norm(row.get("_tabId")), norm(row.get("_tabTitle")), norm(row.get("_dataPath"))]))
    return any(marker in tab_text for marker in ("tier", "tiers", "maturity", "成熟度"))


def audit_standards() -> tuple[dict[str, Any], dict[str, dict[str, Any]]]:
    standards_data = read_json(DATA_DIR / "standards-data.json")
    standards_index = read_json(DATA_DIR / "standards-index.json")
    frameworks = list_value(standards_data.get("frameworks"))
    index_by_id = {norm(item.get("id")): item for item in list_value(standards_index.get("frameworks")) if isinstance(item, dict)}
    bad_data_paths = []
    duplicate_controls = []
    placeholder_controls = []
    non_control_metadata_rows = []
    cross_tab_shared_controls = []
    framework_records = []
    controls_by_key: dict[str, dict[str, Any]] = {}
    controls_by_code: dict[str, set[str]] = defaultdict(set)
    control_tabs_by_key: dict[str, set[str]] = defaultdict(set)
    control_titles_by_key: dict[str, str] = {}
    controls_seen_in_tab: set[str] = set()
    total_controls = 0
    title_issues = []

    for framework in frameworks:
        code = norm(framework.get("frameworkCode") or framework.get("code"))
        title = norm(framework.get("title"))
        expected_title = EXPECTED_FRAMEWORK_TITLES.get(code)
        if expected_title and title != expected_title:
            title_issues.append({"frameworkCode": code, "actual": title, "expected": expected_title})
        index_framework = index_by_id.get(norm(framework.get("id")))
        if index_framework and norm(index_framework.get("title")) != title:
            title_issues.append({"frameworkCode": code, "actual": norm(index_framework.get("title")), "expected": title, "source": "standards-index.json"})
        rows, path_issues = load_standard_rows(framework)
        bad_data_paths.extend(path_issues)
        total_controls += len(rows)
        framework_records.append(
            {
                "id": framework.get("id"),
                "frameworkCode": code,
                "title": title,
                "rowCount": len(rows),
                "dataPath": framework.get("dataPath"),
                "tabCount": len(list_value(framework.get("tabs"))),
            }
        )
        for row_index, row in enumerate(rows):
            control = control_code(row)
            title_value = control_title(row)
            if canonical_text(control) in PLACEHOLDERS or canonical_text(title_value) in PLACEHOLDERS:
                placeholder_item = {
                    "frameworkCode": code,
                    "row": row_index,
                    "control": control,
                    "title": title_value,
                    "tabId": row.get("_tabId"),
                    "tabTitle": row.get("_tabTitle"),
                }
                if is_non_control_metadata_row(row):
                    non_control_metadata_rows.append(placeholder_item)
                    continue
                placeholder_controls.append(
                    placeholder_item
                )
                continue
            key = f"{code}:{control}"
            tab_id = norm(row.get("_tabId")) or "main"
            tab_key = f"{key}:{tab_id}"
            control_tabs_by_key[key].add(tab_id)
            control_titles_by_key.setdefault(key, title_value)
            controls_by_code[key].add(title_value)
            if tab_key in controls_seen_in_tab:
                duplicate_controls.append(
                    {
                        "frameworkCode": code,
                        "control": control,
                        "title": title_value,
                        "tabId": tab_id,
                        "tabTitle": row.get("_tabTitle"),
                    }
                )
            controls_seen_in_tab.add(tab_key)
            controls_by_key.setdefault(key, {"frameworkCode": code, "control": control, "title": title_value})

    for key, tab_ids in sorted(control_tabs_by_key.items()):
        if len(tab_ids) <= 1:
            continue
        code, control = key.split(":", 1)
        cross_tab_shared_controls.append(
            {
                "frameworkCode": code,
                "control": control,
                "title": control_titles_by_key.get(key, ""),
                "tabIds": sorted(tab_ids),
            }
        )

    status = "pass"
    if bad_data_paths or title_issues or not frameworks:
        status = "fail"
    elif duplicate_controls or placeholder_controls or total_controls != int(dict_value(standards_index.get("stats")).get("controls") or total_controls):
        status = "warning"
    return {
        "generatedAt": now_iso(),
        "frameworks": framework_records,
        "frameworkCount": len(frameworks),
        "controlCount": total_controls,
        "expectedIndexControlCount": int(dict_value(standards_index.get("stats")).get("controls") or 0),
        "badDataPaths": bad_data_paths[:100],
        "duplicateControls": duplicate_controls[:100],
        "crossTabSharedControlCodes": cross_tab_shared_controls[:100],
        "crossTabSharedControlCodeCount": len(cross_tab_shared_controls),
        "placeholderControlItems": placeholder_controls[:100],
        "nonControlMetadataRows": non_control_metadata_rows[:100],
        "nonControlMetadataRowCount": len(non_control_metadata_rows),
        "frameworkTitleIssues": title_issues[:100],
        "rawStandardNameGroups": [],
        "status": status,
    }, controls_by_key


def canonical_indexes() -> dict[str, Any]:
    sources = dictionary_sources()
    indexes = {}
    for key, payload in sources.items():
        records = payload["records"]
        indexes[key] = {
            "records": records,
            "ids": {object_id(r): r for r in records if object_id(r)},
            "codes": {object_code(r): r for r in records if object_code(r)},
            "titles": defaultdict(list),
        }
        for record in records:
            title = object_title(record)
            if title:
                indexes[key]["titles"][title].append(record)
    return indexes


def package_class(path: Path) -> str:
    try:
        relative = path.relative_to(DATA_DIR).as_posix()
        if relative.startswith("review/"):
            return "review_artifact"
        if relative.startswith("source-evidence/"):
            return "source_evidence"
        return "formal_runtime" if relative in FORMAL_RUNTIME_FILES or relative.startswith("standards/") else "supporting_data"
    except ValueError:
        if "worker-verify" in path.as_posix():
            return "worker_verify"
        return "generated"


def runtime_files() -> list[Path]:
    files = []
    for relative in FORMAL_RUNTIME_FILES:
        path = DATA_DIR / relative
        if path.exists():
            files.append(path)
    standards_dir = DATA_DIR / "standards"
    files.extend(sorted(standards_dir.rglob("*.json")) if standards_dir.exists() else [])
    generated = GENERATED_DIR / "environmentBasemap.node-details.json"
    if generated.exists():
        files.append(generated)
    return sorted(dict.fromkeys(files))


def derived_files() -> list[Path]:
    files = []
    review_dir = DATA_DIR / "review"
    if review_dir.exists():
        files.extend(sorted(review_dir.rglob("*.json")))
    return files


def issue(issue_type: str, severity: str, path: Path, json_path: str, current: Any, canonical: Any = "", reason: str = "") -> dict[str, Any]:
    return {
        "issueType": issue_type,
        "severity": severity,
        "packageClass": package_class(path),
        "affectedPackage": rel(path),
        "affectedPath": json_path,
        "currentValue": current,
        "canonicalValue": canonical,
        "reason": reason,
    }


def validate_object_reference(node: dict[str, Any], path: Path, json_path: str, indexes: dict[str, Any], controls: dict[str, dict[str, Any]]) -> list[dict[str, Any]]:
    issues = []
    node_type = norm(node.get("type") or node.get("objectType") or node.get("object_type"))
    title = object_title(node)
    code = object_code(node)
    item_id = object_id(node)
    mapping = {
        "security_technical_service": "安全技术服务清单",
        "security_technology_module": "安全技术模块清单",
        "security_technical_measure": "安全技术措施清单",
        "security_system": "安全系统清单",
        "security_work": "安全管理工作清单",
        "process_reference": "流程参考清单",
        "work_function": "安全职能清单",
        "work_function_layer": "安全职能层级",
        "application_system_type": "应用系统类型",
    }
    if node_type in mapping:
        idx = indexes[mapping[node_type]]
        id_match = bool(item_id and item_id in idx["ids"])
        code_match = bool(code and code in idx["codes"])
        title_matches = idx["titles"].get(title, []) if title else []
        if item_id and not id_match and not code_match and len(title_matches) != 1:
            issues.append(issue(f"unknown_{node_type}_id", "P1-data-integrity", path, json_path, item_id, reason=f"{node_type} id/code/title 未命中 canonical 字典"))
        if code and code_match and title and object_title(idx["codes"][code]) != title:
            issues.append(issue(f"{node_type}_code_name_mismatch", "P2-candidate-fix", path, json_path, f"{code} {title}", f"{code} {object_title(idx['codes'][code])}", "code 命中但名称不一致"))
        if title and not title_matches and not code_match:
            issues.append(issue(f"unknown_{node_type}_name", "P1-data-integrity", path, json_path, title, reason=f"{node_type} 名称未命中 canonical 字典"))
        old_name_rule = OLD_SERVICE_NAME_BY_CODE.get(code)
        if old_name_rule and title == old_name_rule["old"] and node_type == "security_technical_service":
            issues.append(issue("oldServiceName", "P2-candidate-fix", path, json_path, title, old_name_rule["canonical"], "旧安全技术服务名称残留"))
    if node_type == "standard_framework":
        expected = EXPECTED_FRAMEWORK_TITLES.get(code)
        if code and expected and title and title != expected:
            issues.append(issue("rawStandardName", "P2-candidate-fix", path, json_path, title, expected, "标准框架名称不是 canonical title"))
    if node_type == "standard_control":
        framework_code = norm(node.get("frameworkCode") or node.get("category"))
        control = norm(node.get("originalControlId") or node.get("controlId") or code)
        if framework_code and control and f"{framework_code}:{control}" not in controls:
            issues.append(issue("unknownStandardControl", "P1-data-integrity", path, json_path, f"{framework_code}:{control}", reason="标准控制项未命中 standards canonical 控制字典"))
    service_ref_code = norm(node.get("code") or node.get("serviceCode") or node.get("objectCode"))
    service_ref_name = norm(node.get("title") or node.get("name") or node.get("serviceName") or node.get("objectName") or node.get("raw"))
    if service_ref_code:
        if service_ref_code in OLD_SERVICE_CODE_MAP:
            issues.append(issue("oldServiceCode", "P2-candidate-fix", path, json_path, service_ref_code, OLD_SERVICE_CODE_MAP[service_ref_code], "旧服务编号残留"))
        old_name_rule = OLD_SERVICE_NAME_BY_CODE.get(service_ref_code)
        if old_name_rule and old_name_rule["old"] in service_ref_name:
            issues.append(issue("oldServiceName", "P2-candidate-fix", path, json_path, old_name_rule["old"], old_name_rule["canonical"], "旧服务名称残留"))
    return issues


def scan_strings(value: str, path: Path, json_path: str, indexes: dict[str, Any]) -> list[dict[str, Any]]:
    issues = []
    service_codes = indexes["安全技术服务清单"]["codes"]
    for code in SERVICE_CODE_RE.findall(value):
        if code in OLD_SERVICE_CODE_MAP:
            issues.append(issue("oldServiceCode", "P2-candidate-fix", path, json_path, code, OLD_SERVICE_CODE_MAP[code], "旧服务编号残留"))
        elif code not in service_codes:
            issues.append(issue("unknownServiceCode", "P1-data-integrity", path, json_path, code, reason="服务编号未命中安全技术服务字典"))
    service_matches = list(SERVICE_CODE_RE.finditer(value))
    for index, match in enumerate(service_matches):
        code = match.group(0)
        next_start = service_matches[index + 1].start() if index + 1 < len(service_matches) else len(value)
        service_segment = value[match.start():next_start]
        name_rule = OLD_SERVICE_NAME_BY_CODE.get(code)
        if name_rule and name_rule["old"] in service_segment:
            issues.append(issue("oldServiceName", "P2-candidate-fix", path, json_path, name_rule["old"], name_rule["canonical"], "旧服务名称残留"))
    return issues


def audit_references(indexes: dict[str, Any], controls: dict[str, dict[str, Any]], files: list[Path]) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    issues: list[dict[str, Any]] = []
    scanned = []
    non_business_fields = []
    for path in files:
        try:
            payload = read_json(path)
        except Exception as exc:
            issues.append(issue("invalidJson", "P1-data-integrity", path, "$", str(exc), reason="JSON 读取失败"))
            continue
        scanned.append(rel(path))
        for json_path, node in walk_json(payload):
            if isinstance(node, dict):
                issues.extend(validate_object_reference(node, path, json_path, indexes, controls))
                if package_class(path) in {"formal_runtime", "supporting_data"}:
                    for key in node:
                        if key in NON_BUSINESS_KEYS:
                            non_business_fields.append({"package": rel(path), "path": f"{json_path}.{key}", "key": key})
            elif isinstance(node, str):
                if "service" in json_path.lower() or "安全技术服务" in node or SERVICE_CODE_RE.search(node):
                    issues.extend(scan_strings(node, path, json_path, indexes))
    issues = dedupe_issues(issues)
    meta = {
        "scannedPackageCount": len(scanned),
        "scannedPackages": scanned,
        "nonBusinessFieldSamples": non_business_fields[:100],
        "nonBusinessFieldCount": len(non_business_fields),
    }
    return issues, meta


def audit_governance_guards(indexes: dict[str, Any]) -> list[dict[str, Any]]:
    issues: list[dict[str, Any]] = []
    measures = indexes["安全技术措施清单"]["titles"]
    for measure_name in sorted(REQUIRED_MEASURES):
        if not measures.get(measure_name):
            issues.append(
                issue(
                    "missingConfirmedLifecycleMeasure",
                    "P1-data-integrity",
                    DATA_DIR / "maintenance" / "measures.json",
                    "$.security_technical_measures",
                    measure_name,
                    reason="用户已确认的 4 个生命周期来源安全技术措施必须存在于安全技术措施清单",
                )
            )

    module_records = indexes["安全技术模块清单"]["titles"]
    expected_system = "数据安全管理与运营"
    for module_name in ("知情同意管理", "隐私安全影响评估"):
        records = list(module_records.get(module_name, []))
        if not records:
            issues.append(
                issue(
                    "missingConfirmedDataSecurityModule",
                    "P1-data-integrity",
                    DATA_DIR / "maintenance" / "modules.json",
                    "$.security_technology_modules",
                    module_name,
                    reason="用户已确认该模块应纳入数据安全管理与运营分类链路",
                )
            )
            continue
        has_expected_system = False
        for record in records:
            systems = collect_typed_objects(record, "security_system")
            has_expected_system = has_expected_system or any(object_title(system) == expected_system for system in systems)
        if not has_expected_system:
            issues.append(
                issue(
                    "dataSecurityModuleMissingExpectedSystem",
                    "P2-candidate-fix",
                    DATA_DIR / "maintenance" / "modules.json",
                    "$.security_technology_modules",
                    module_name,
                    expected_system,
                    "用户已指出该模块不应位于未分组安全系统，应归入数据安全管理与运营。",
                )
            )
    return issues


def dedupe_issues(issues: list[dict[str, Any]]) -> list[dict[str, Any]]:
    seen = set()
    result = []
    for item in issues:
        key = (
            item.get("issueType"),
            item.get("severity"),
            item.get("affectedPackage"),
            item.get("affectedPath"),
            str(item.get("currentValue")),
            str(item.get("canonicalValue")),
        )
        if key in seen:
            continue
        seen.add(key)
        result.append(item)
    return result


def candidate_plan(issues: list[dict[str, Any]]) -> list[dict[str, Any]]:
    plan = []
    for index, item in enumerate(issues, start=1):
        severity = item["severity"]
        if severity == "P2-candidate-fix":
            category = "auto_fix_candidate"
            requires = False
            confidence = "high"
            action = "基于 canonical 字典生成候选包和 normalized diff，用户确认后定向替换。"
        elif severity == "P4-derived-only":
            category = "derived_regenerate_only"
            requires = False
            confidence = "high"
            action = "不手工 patch，待正式包修复后重新生成派生产物。"
        elif severity == "P3-review":
            category = "requires_user_confirmation"
            requires = True
            confidence = "medium"
            action = "需要用户确认是否为别名、旧口径或合法同名。"
        elif severity == "P1-data-integrity":
            category = "requires_user_confirmation"
            requires = True
            confidence = "medium"
            action = "先确认事实源和影响范围，再生成候选修复。"
        else:
            category = "do_not_fix"
            requires = False
            confidence = "low"
            action = "只记录，暂不处理。"
        plan.append(
            {
                "issueId": f"PGA-{index:04d}",
                "issueType": item["issueType"],
                "affectedPackage": item["affectedPackage"],
                "affectedPath": item["affectedPath"],
                "currentValue": item.get("currentValue", ""),
                "canonicalValue": item.get("canonicalValue", ""),
                "reason": item.get("reason", ""),
                "confidence": confidence,
                "requiresUserConfirmation": requires,
                "recommendedAction": action,
                "category": category,
                "severity": severity,
            }
        )
    return plan


def severity_counts(issues: list[dict[str, Any]]) -> dict[str, int]:
    counter = Counter(item.get("severity", "unknown") for item in issues)
    return {key: counter.get(key, 0) for key in ["P0-blocking", "P1-data-integrity", "P2-candidate-fix", "P3-review", "P4-derived-only"]}


def issue_type_counts(issues: list[dict[str, Any]]) -> dict[str, int]:
    groups = {
        "securityTechnicalService": ["Service", "service"],
        "standardControl": ["Standard", "standard"],
        "moduleOrMeasure": ["module", "measure", "security_technology_module", "security_technical_measure"],
        "securitySystem": ["security_system", "SecuritySystem"],
    }
    result = {}
    for group, hints in groups.items():
        result[group] = sum(1 for item in issues if any(hint in item["issueType"] for hint in hints))
    return result


def md_table(rows: list[dict[str, Any]], columns: list[tuple[str, str]], limit: int = 50) -> str:
    visible = rows[:limit]
    lines = ["| " + " | ".join(label for _, label in columns) + " |", "| " + " | ".join("---" for _ in columns) + " |"]
    for row in visible:
        cells = []
        for key, _ in columns:
            value = row.get(key, "")
            if isinstance(value, (dict, list)):
                value = json.dumps(value, ensure_ascii=False)
            cells.append(str(value).replace("\n", " ")[:240])
        lines.append("| " + " | ".join(cells) + " |")
    if len(rows) > limit:
        lines.append(f"| ... | 仅显示前 {limit} 条，共 {len(rows)} 条 |")
    return "\n".join(lines)


def write_reports(
    baseline: dict[str, Any],
    standards: dict[str, Any],
    runtime: dict[str, Any],
    reference: dict[str, Any],
    plan: list[dict[str, Any]],
    summary: dict[str, Any],
) -> None:
    write_json(OUT_DIR / "global-baseline-integrity-audit.json", baseline)
    write_json(OUT_DIR / "global-standards-framework-audit.json", standards)
    write_json(OUT_DIR / "global-runtime-package-reference-audit.json", runtime)
    write_json(OUT_DIR / "global-reference-integrity-audit.json", reference)
    write_json(OUT_DIR / "candidate-fix-plan.json", plan)
    write_json(OUT_DIR / "summary-for-user-confirmation.json", summary)

    write_text(
        OUT_DIR / "global-baseline-integrity-audit.md",
        "# Global Baseline Integrity Audit\n\n"
        + md_table(
            baseline["dictionaries"],
            [("dictionaryName", "字典"), ("sourcePackage", "来源"), ("count", "数量"), ("status", "状态"), ("emptyIdCount", "空 ID"), ("emptyNameCount", "空名称")],
            limit=100,
        ),
    )
    write_text(
        OUT_DIR / "global-standards-framework-audit.md",
        "# Global Standards Framework Audit\n\n"
        + f"- status: `{standards['status']}`\n- frameworkCount: `{standards['frameworkCount']}`\n- controlCount: `{standards['controlCount']}`\n\n"
        + md_table(standards["frameworks"], [("frameworkCode", "Code"), ("title", "名称"), ("rowCount", "控制项"), ("dataPath", "dataPath")], limit=50),
    )
    write_text(
        OUT_DIR / "global-runtime-package-reference-audit.md",
        "# Global Runtime Package Reference Audit\n\n"
        + f"- scannedPackageCount: `{runtime['scannedPackageCount']}`\n- issueCount: `{runtime['issueCount']}`\n- nonBusinessFieldCount: `{runtime['nonBusinessFieldCount']}`\n\n"
        + md_table(runtime["issues"], [("severity", "级别"), ("issueType", "类型"), ("affectedPackage", "文件"), ("affectedPath", "路径"), ("currentValue", "当前"), ("canonicalValue", "建议")], limit=80),
    )
    write_text(
        OUT_DIR / "global-reference-integrity-audit.md",
        "# Global Reference Integrity Audit\n\n"
        + f"- issueCount: `{reference['issueCount']}`\n- derivedIssueCount: `{reference['derivedIssueCount']}`\n\n"
        + md_table(reference["issues"], [("severity", "级别"), ("issueType", "类型"), ("packageClass", "包类型"), ("affectedPackage", "文件"), ("currentValue", "当前"), ("canonicalValue", "建议")], limit=100),
    )
    write_text(
        OUT_DIR / "candidate-fix-plan.md",
        "# Candidate Fix Plan\n\n"
        + md_table(plan, [("issueId", "ID"), ("category", "类别"), ("severity", "级别"), ("issueType", "类型"), ("affectedPackage", "文件"), ("currentValue", "当前"), ("canonicalValue", "canonical"), ("recommendedAction", "建议")], limit=120),
    )
    lines = [
        "# Summary For User Confirmation",
        "",
        f"- generatedAt: `{summary['generatedAt']}`",
        f"- status: `{summary['status']}`",
        f"- P0-blocking: `{summary['severityCounts']['P0-blocking']}`",
        f"- P1-data-integrity: `{summary['severityCounts']['P1-data-integrity']}`",
        f"- P2-candidate-fix: `{summary['severityCounts']['P2-candidate-fix']}`",
        f"- P3-review: `{summary['severityCounts']['P3-review']}`",
        f"- P4-derived-only: `{summary['severityCounts']['P4-derived-only']}`",
        "",
        "## 必须修复的问题",
        md_table(summary["mustFixTopIssues"], [("severity", "级别"), ("issueType", "类型"), ("affectedPackage", "文件"), ("currentValue", "当前"), ("canonicalValue", "canonical")], limit=30),
        "",
        "## 可自动候选修复的问题",
        md_table(summary["autoFixCandidates"], [("issueId", "ID"), ("issueType", "类型"), ("affectedPackage", "文件"), ("currentValue", "当前"), ("canonicalValue", "canonical")], limit=50),
        "",
        "## 需要用户确认的问题",
        md_table(summary["requiresUserConfirmation"], [("issueId", "ID"), ("issueType", "类型"), ("affectedPackage", "文件"), ("currentValue", "当前"), ("reason", "原因")], limit=50),
        "",
        "## 只需重生成派生产物的问题",
        md_table(summary["derivedRegenerateOnly"], [("issueId", "ID"), ("issueType", "类型"), ("affectedPackage", "文件"), ("currentValue", "当前"), ("canonicalValue", "canonical")], limit=50),
    ]
    write_text(OUT_DIR / "summary-for-user-confirmation.md", "\n\n".join(lines))


def run_existing_audit(command: list[str]) -> dict[str, Any]:
    try:
        result = subprocess.run(command, cwd=ROOT, capture_output=True, text=True, check=False, timeout=120)
        return {
            "command": " ".join(command),
            "returncode": result.returncode,
            "stdoutTail": result.stdout[-4000:],
            "stderrTail": result.stderr[-4000:],
        }
    except Exception as exc:
        return {"command": " ".join(command), "returncode": -1, "error": str(exc)}


def main() -> int:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    dictionaries = [audit_dictionary(name, payload["source"], payload["records"]) for name, payload in dictionary_sources().items()]
    baseline = {
        "generatedAt": now_iso(),
        "status": "fail" if any(item["status"] == "fail" for item in dictionaries) else ("warning" if any(item["status"] == "warning" for item in dictionaries) else "pass"),
        "dictionaries": dictionaries,
        "dictionaryCount": len(dictionaries),
    }
    standards, standard_controls = audit_standards()
    indexes = canonical_indexes()

    guard_issues = audit_governance_guards(indexes)
    runtime_issues, runtime_meta = audit_references(indexes, standard_controls, runtime_files())
    runtime_issues = dedupe_issues(guard_issues + runtime_issues)
    derived_issues, derived_meta = audit_references(indexes, standard_controls, derived_files())
    for item in derived_issues:
        item["severity"] = "P4-derived-only"
    all_issues = dedupe_issues(runtime_issues + derived_issues)
    plan = candidate_plan(all_issues)
    counts = severity_counts(all_issues)
    type_counts = issue_type_counts(all_issues)

    existing = [
        run_existing_audit(["python3", "scripts/audit_dictionary_standard_baseline_integrity.py"]),
        run_existing_audit(["python3", "scripts/audit_protected_baseline_no_regression.py"]),
        run_existing_audit(["python3", "scripts/audit_json_package_boundary.py"]),
        run_existing_audit(["node", "scripts/audit_capability_standard_mapping_canonicalization.mjs"]),
        run_existing_audit(["node", "scripts/audit_security_technical_service_reference_integrity.mjs"]),
    ]

    runtime = {
        "generatedAt": now_iso(),
        "issueCount": len(runtime_issues),
        "issues": runtime_issues,
        **runtime_meta,
    }
    reference = {
        "generatedAt": now_iso(),
        "issueCount": len(all_issues),
        "runtimeIssueCount": len(runtime_issues),
        "derivedIssueCount": len(derived_issues),
        "issues": all_issues,
        "runtimeMeta": runtime_meta,
        "derivedMeta": derived_meta,
        "existingAuditResults": existing,
    }
    summary = {
        "generatedAt": now_iso(),
        "status": "ready_for_user_confirmation" if all_issues else "pass",
        "baselineStatus": baseline["status"],
        "standardsStatus": standards["status"],
        "coveredDictionaries": [item["dictionaryName"] for item in dictionaries],
        "coveredFrameworks": [item["title"] for item in standards["frameworks"]],
        "coveredRuntimePackages": runtime_meta["scannedPackages"],
        "severityCounts": counts,
        "issueTypeCounts": type_counts,
        "mustFixTopIssues": [item for item in all_issues if item["severity"] in {"P0-blocking", "P1-data-integrity"}][:30],
        "autoFixCandidates": [item for item in plan if item["category"] == "auto_fix_candidate"][:80],
        "requiresUserConfirmation": [item for item in plan if item["requiresUserConfirmation"]][:80],
        "derivedRegenerateOnly": [item for item in plan if item["category"] == "derived_regenerate_only"][:80],
        "candidateFixPlanPath": rel(OUT_DIR / "candidate-fix-plan.json"),
        "summaryPath": rel(OUT_DIR / "summary-for-user-confirmation.md"),
        "formalDataModified": False,
        "sqliteModified": False,
        "publicDataRegenerated": False,
    }
    write_reports(baseline, standards, runtime, reference, plan, summary)
    print(json.dumps({
        "status": summary["status"],
        "outputDir": rel(OUT_DIR),
        "dictionaryCount": baseline["dictionaryCount"],
        "frameworkCount": standards["frameworkCount"],
        "controlCount": standards["controlCount"],
        "runtimeIssueCount": len(runtime_issues),
        "derivedIssueCount": len(derived_issues),
        "severityCounts": counts,
        "issueTypeCounts": type_counts,
        "candidateFixPlanPath": summary["candidateFixPlanPath"],
        "summaryPath": summary["summaryPath"],
    }, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
