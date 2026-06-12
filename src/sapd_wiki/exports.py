from __future__ import annotations

import csv
import hashlib
import json
import re
import sqlite3
import tempfile
import zipfile
from datetime import datetime
from pathlib import Path
from typing import Any
from xml.etree import ElementTree as ET

from .excel_reader import _load_openpyxl
from .paths import PROJECT_ROOT, resolve_project_path
from .queries import item_counts_by_type, relation_counts_by_type, table_counts
from .transformers import is_blank_or_placeholder, service_parts, split_multivalue_text, split_scope_values


DEFAULT_EXPORT_DIR = PROJECT_ROOT / "data" / "exports"
GARTNER_WORK_FUNCTION_CANDIDATES_PATH = (
    PROJECT_ROOT / "data" / "exports" / "worker-verify" / "sheet-review-2-2-gartner-to-work-function-candidates.csv"
)

SECOND_BATCH_ITEM_TYPES = (
    "security_work",
    "process_domain",
    "process_group",
    "process_reference",
    "process_activity",
    "work_function_layer",
    "work_function_group",
    "work_function",
    "work_task",
    "gbt_42446_task_reference",
    "work_role_reference",
    "asset",
)

SECOND_BATCH_RELATION_TYPES = (
    "maps_to_work",
    "maps_to_process",
    "belongs_to",
    "has_activity",
    "stakeholder_by",
    "belongs_to_layer",
    "performs_task",
    "maps_to_gbt_task",
)

SOURCE_PAGE_ITEM_TYPES = SECOND_BATCH_ITEM_TYPES + (
    "capability_focus",
    "scope_type",
    "security_technical_service",
    "security_technology_module",
    "security_technical_measure",
    "security_system",
    "product",
    "information_environment",
    "environment_segment",
    "information_object",
)

SOURCE_PAGE_RELATION_TYPES = SECOND_BATCH_RELATION_TYPES + (
    "applies_to_scope",
    "no_service_in_scope",
    "implements_service",
    "part_of_system",
    "maps_to_product",
    "deployed_in_environment",
    "protects_object",
)

SERVICE_MODULE_INDEX_ITEM_TYPES = (
    "scope_type",
    "security_technical_service",
    "security_technology_module",
    "security_system",
    "product",
    "information_environment",
)

SERVICE_MODULE_INDEX_RELATION_TYPES = (
    "applies_to_scope",
    "implements_service",
    "part_of_system",
    "maps_to_product",
    "deployed_in_environment",
)

LIFECYCLE_ITEM_TYPES = (
    "lifecycle_process",
    "lifecycle_activity",
    "lifecycle_scene",
    "security_activity",
    "security_policy_requirement",
    "software_development_type",
    "application_system_type",
    "application_component",
    "development_technical_service",
    "development_technical_module",
    "security_technical_service",
    "security_technology_module",
    "security_technical_measure",
    "product",
)

LIFECYCLE_RELATION_TYPES = (
    "has_scene",
    "maps_to_lifecycle",
    "has_activity",
    "has_main_activity",
    "requires_policy",
    "applies_to_development_type",
    "uses_service",
    "uses_module",
    "uses_measure",
    "uses_development_technical_service",
    "uses_development_technical_module",
    "uses_product",
    "has_component",
    "implements_service",
    "part_of_system",
    "maps_to_product",
    "deployed_in_environment",
)

STAKEHOLDER_LAYERS = ("决策层", "管理层", "执行层", "监督层")

SCENE_TECHNICAL_MAPPING_SHEET = "作用域-安全技术服务-安全技术模块映射"
DATA_LIFECYCLE_POLICY_MAPPING_SHEET = "LC-DT 安全技术服务、模块、策略映射表"
TECHNICAL_MEASURE_SOURCE_COLUMN = "安全技术模块/措施"
MAINTENANCE_KNOWLEDGE_FIELDS = (
    "scope_types",
    "security_processes",
    "work_function_layers",
    "security_technical_services",
    "security_technology_modules",
    "security_technical_measures",
    "gbt_42446_references",
    "gartner_roles",
)
MAINTENANCE_SECTION_CONFIGS = (
    {
        "id": "scopes",
        "title": "作用域清单",
        "fields": ("scope_types",),
        "route": "/knowledge/scopes",
    },
    {
        "id": "services",
        "title": "安全技术服务清单",
        "fields": ("security_technical_services",),
        "route": "/knowledge/technical-services",
    },
    {
        "id": "modules",
        "title": "安全技术模块清单",
        "fields": ("security_technology_modules",),
        "route": "/knowledge/technical",
    },
    {
        "id": "measures",
        "title": "安全技术措施清单",
        "fields": ("security_technical_measures",),
        "route": "/knowledge/technical",
    },
    {
        "id": "processes",
        "title": "流程清单",
        "fields": ("security_processes",),
        "route": "/knowledge/management-workflows",
    },
    {
        "id": "work-functions",
        "title": "职能清单",
        "fields": ("work_function_layers",),
        "route": "/knowledge/functions",
    },
    {
        "id": "references",
        "title": "岗位 / 职能参考",
        "fields": ("gbt_42446_references", "gartner_roles"),
        "route": "/knowledge/role-references",
    },
)
MAINTENANCE_SOURCE_KEYS = {"sources", "sourceEvidence", "mapping_sources"}
MAINTENANCE_INTERNAL_SOURCE_KEYS = {"source_label", "sourceLabel", "source_kind", "sourceKind"}
XLSX_MAIN_NS = "http://schemas.openxmlformats.org/spreadsheetml/2006/main"
XLSX_REL_NS = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
XLSX_PACKAGE_REL_NS = "http://schemas.openxmlformats.org/package/2006/relationships"
XLSX_NS = {
    "m": XLSX_MAIN_NS,
    "r": XLSX_REL_NS,
    "pr": XLSX_PACKAGE_REL_NS,
}
CANONICAL_ITEM_TITLES: dict[tuple[str, str], str] = {
    ("capability", "T-AD.SA"): "态势感知能力",
}


def _ensure_dir(path: str | Path | None) -> Path:
    export_dir = resolve_project_path(path) if path else DEFAULT_EXPORT_DIR
    export_dir.mkdir(parents=True, exist_ok=True)
    return export_dir


def _write_json(path: Path, payload: Any) -> None:
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")


def _write_csv(path: Path, rows: list[dict[str, Any]], fieldnames: list[str]) -> None:
    with path.open("w", newline="", encoding="utf-8-sig") as file:
        writer = csv.DictWriter(file, fieldnames=fieldnames, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(rows)


def _load_json(value: str | None, default: Any) -> Any:
    if not value:
        return default
    return json.loads(value)


def _metadata(row: dict[str, Any]) -> dict[str, Any]:
    return _load_json(row.get("metadata_json"), {})


def _canonical_title(item: dict[str, Any]) -> str:
    code = str(item.get("code") or "").strip()
    item_type = str(item.get("type") or "").strip()
    return CANONICAL_ITEM_TITLES.get((item_type, code), item.get("title") or "")


def _split_catalog_code_title(value: object) -> tuple[str | None, str]:
    text = " ".join(str(value or "").replace("\xa0", " ").split()).strip()
    if not text:
        return None, ""
    match = re.match(r"^([A-Z]{1,3}(?:-[A-Z]{1,3})?(?:-[A-Z]{1,3})?|LC-[A-Z]{2})\s+(.+)$", text)
    if match:
        return match.group(1), match.group(2).strip()
    return None, text


def _source_reference_map(conn: sqlite3.Connection, target_type: str) -> dict[str, list[dict[str, Any]]]:
    refs: dict[str, list[dict[str, Any]]] = {}
    if target_type == "item":
        rows = conn.execute(
            """
            SELECT refs.target_id, refs.source_sheet, refs.source_row, refs.source_column,
                   refs.source_cell, refs.raw_value
            FROM source_references AS refs
            JOIN knowledge_items AS item ON item.id = refs.target_id
            WHERE refs.target_type = ?
              AND (item.source_hash IS NULL OR refs.source_hash = item.source_hash)
            ORDER BY refs.source_sheet, refs.source_row, refs.source_cell
            """,
            (target_type,),
        ).fetchall()
    elif target_type == "relation":
        rows = conn.execute(
            """
            SELECT refs.target_id, refs.source_sheet, refs.source_row, refs.source_column,
                   refs.source_cell, refs.raw_value
            FROM source_references AS refs
            JOIN knowledge_relations AS relation ON relation.id = refs.target_id
            LEFT JOIN source_files AS source_file ON source_file.id = relation.source_file_id
            WHERE refs.target_type = ?
              AND (source_file.file_hash IS NULL OR refs.source_hash = source_file.file_hash)
            ORDER BY refs.source_sheet, refs.source_row, refs.source_cell
            """,
            (target_type,),
        ).fetchall()
    else:
        rows = conn.execute(
            """
            SELECT target_id, source_sheet, source_row, source_column, source_cell, raw_value
            FROM source_references
            WHERE target_type = ?
            ORDER BY source_sheet, source_row, source_cell
            """,
            (target_type,),
        ).fetchall()
    for row in rows:
        refs.setdefault(row["target_id"], []).append(
            {
                "sheet": row["source_sheet"],
                "row": row["source_row"],
                "column": row["source_column"],
                "cell": row["source_cell"],
                "raw_value": row["raw_value"],
            }
        )
    return refs


def _combine_sources(*source_lists: list[dict[str, Any]] | None, limit: int = 12) -> list[dict[str, Any]]:
    seen: set[tuple[Any, ...]] = set()
    combined: list[dict[str, Any]] = []
    for source_list in source_lists:
        for source in source_list or []:
            key = (
                source.get("sheet"),
                source.get("row"),
                source.get("column"),
                source.get("cell"),
                source.get("raw_value"),
            )
            if key in seen:
                continue
            seen.add(key)
            combined.append(source)
            if len(combined) >= limit:
                return combined
    return combined


def _source_rows_for_sheet(
    source_list: list[dict[str, Any]] | None,
    sheet: str,
) -> set[int]:
    rows: set[int] = set()
    for source in source_list or []:
        if source.get("sheet") != sheet:
            continue
        row = source.get("row")
        if isinstance(row, int):
            rows.add(row)
    return rows


def _sources_for_sheet_rows(
    source_list: list[dict[str, Any]] | None,
    sheet: str,
    rows: set[int],
) -> list[dict[str, Any]]:
    if not rows:
        return []
    return [
        source
        for source in source_list or []
        if source.get("sheet") == sheet and source.get("row") in rows
    ]


def _brief_item_sources(item: dict[str, Any], source_refs: dict[str, list[dict[str, Any]]], limit: int = 8) -> list[dict[str, Any]]:
    sources = source_refs.get(item["id"], [])
    if item.get("type") not in {"security_system", "security_technology_module"}:
        return sources[:limit]
    preferred_sheets = ("安全技术模块清单",)
    sheet_rank = {sheet: index for index, sheet in enumerate(preferred_sheets)}

    def sort_key(source: dict[str, Any]) -> tuple[int, int, int, str, str]:
        sheet = str(source.get("sheet") or "")
        try:
            row = int(source.get("row"))
        except (TypeError, ValueError):
            row = 10**9
        return (
            0 if sheet in sheet_rank else 1,
            sheet_rank.get(sheet, len(preferred_sheets)),
            row,
            str(source.get("cell") or ""),
            str(source.get("column") or ""),
        )

    return _combine_sources(sorted(sources, key=sort_key), limit=limit)


def _sort_item_rows(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    def sort_key(item: dict[str, Any]) -> tuple[int, int, str, str]:
        metadata = _metadata(item)
        raw_order = metadata.get("display_order", metadata.get("tree_order"))
        try:
            display_order = int(raw_order)
        except (TypeError, ValueError):
            display_order = 10**9
        return (0 if display_order < 10**9 else 1, display_order, item.get("code") or "", item["title"])

    return sorted(rows, key=sort_key)


def _source_position_key(
    sources: list[dict[str, Any]] | None,
    preferred_sheets: tuple[str, ...] = (),
) -> tuple[int, int, int, str, str]:
    source_rows = sources or []
    if not source_rows:
        return (1, len(preferred_sheets), 10**9, "", "")
    sheet_rank = {sheet: index for index, sheet in enumerate(preferred_sheets)}

    def sort_key(source: dict[str, Any]) -> tuple[int, int, str, str]:
        sheet = str(source.get("sheet") or "")
        row = source.get("row")
        try:
            source_row = int(row)
        except (TypeError, ValueError):
            source_row = 10**9
        return (
            sheet_rank.get(sheet, len(preferred_sheets)),
            source_row,
            str(source.get("cell") or ""),
            str(source.get("column") or ""),
        )

    best = min(source_rows, key=sort_key)
    best_rank, best_row, best_cell, best_column = sort_key(best)
    return (0 if best_rank < len(preferred_sheets) else 1, best_rank, best_row, best_cell, best_column)


def _maintenance_knowledge_payload(management_payload: dict[str, Any]) -> dict[str, Any]:
    stats = {
        field: len(management_payload.get(field) or [])
        for field in MAINTENANCE_KNOWLEDGE_FIELDS
    }
    legacy_stats = management_payload.get("stats") or {}
    for key in ("work_functions", "process_domains", "process_groups", "process_references", "process_activity_missing"):
        if key in legacy_stats:
            stats[key] = legacy_stats[key]
    return {
        "generated_at": management_payload.get("generated_at"),
        "stats": stats,
        **{field: management_payload.get(field) or [] for field in MAINTENANCE_KNOWLEDGE_FIELDS},
    }


def _maintenance_object_id(value: dict[str, Any], fallback: str | None = None) -> str | None:
    candidate = value.get("id") or value.get("code") or value.get("title") or value.get("name") or fallback
    if candidate is None:
        return None
    normalized = str(candidate).strip()
    return normalized or None


def _dedupe_source_evidence(sources: list[dict[str, Any]]) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    seen: set[str] = set()
    for source in sources:
        if not isinstance(source, dict):
            continue
        key = json.dumps(source, ensure_ascii=False, sort_keys=True)
        if key in seen:
            continue
        seen.add(key)
        rows.append(source)
    return rows


def _strip_maintenance_source_evidence(value: Any, evidence_by_id: dict[str, list[dict[str, Any]]], owner_id: str | None = None) -> Any:
    if isinstance(value, list):
        return [_strip_maintenance_source_evidence(item, evidence_by_id, owner_id) for item in value]
    if not isinstance(value, dict):
        return value

    current_id = _maintenance_object_id(value, owner_id)
    cleaned: dict[str, Any] = {}
    for key, child in value.items():
        if key in MAINTENANCE_INTERNAL_SOURCE_KEYS:
            continue
        if key in MAINTENANCE_SOURCE_KEYS:
            if current_id and isinstance(child, list):
                evidence_by_id.setdefault(current_id, []).extend(source for source in child if isinstance(source, dict))
            continue
        cleaned[key] = _strip_maintenance_source_evidence(child, evidence_by_id, current_id)
    return cleaned


def _maintenance_section_count(payload: dict[str, Any], fields: tuple[str, ...]) -> int:
    return sum(len(payload.get(field) or []) for field in fields)


def _write_maintenance_split_packages(output: Path, payload: dict[str, Any]) -> list[str]:
    base_dir = output.parent
    section_dir = base_dir / "maintenance"
    source_dir = base_dir / "source-evidence" / "maintenance"
    section_dir.mkdir(parents=True, exist_ok=True)
    source_dir.mkdir(parents=True, exist_ok=True)

    written_files: list[str] = []
    sections: list[dict[str, Any]] = []
    section_counts: dict[str, int] = {}
    generated_at = payload.get("generated_at")

    for config in MAINTENANCE_SECTION_CONFIGS:
        section_id = str(config["id"])
        fields = tuple(str(field) for field in config["fields"])
        evidence_by_id: dict[str, list[dict[str, Any]]] = {}
        section_payload: dict[str, Any] = {
            "generated_at": generated_at,
            "data_state": "ready",
            "package_type": "maintenance-section",
            "section_id": section_id,
            "section_title": config["title"],
            "stats": {field: len(payload.get(field) or []) for field in fields},
        }
        for field in fields:
            section_payload[field] = _strip_maintenance_source_evidence(payload.get(field) or [], evidence_by_id)

        evidence_payload = {
            "generated_at": generated_at,
            "data_state": "ready",
            "package_type": "maintenance-source-evidence",
            "section_id": section_id,
            "evidenceById": {key: _dedupe_source_evidence(value) for key, value in evidence_by_id.items()},
        }
        count = _maintenance_section_count(payload, fields)
        section_counts[section_id] = count
        if section_id == "references":
            section_counts["references-gbt"] = len(payload.get("gbt_42446_references") or [])
            section_counts["references-gartner"] = len(payload.get("gartner_roles") or [])

        section_filename = f"{section_id}.json"
        evidence_filename = f"{section_id}.sources.json"
        section_path = section_dir / section_filename
        evidence_path = source_dir / evidence_filename
        _write_json(section_path, section_payload)
        _write_json(evidence_path, evidence_payload)
        written_files.extend([str(section_path), str(evidence_path)])

        sections.append(
            {
                "id": section_id,
                "title": config["title"],
                "route": config["route"],
                "fields": list(fields),
                "count": count,
                "dataPath": f"./public/data/maintenance/{section_filename}",
                "sourceEvidencePath": f"./public/data/source-evidence/maintenance/{evidence_filename}",
            }
        )

    index_payload = {
        "generated_at": generated_at,
        "data_state": "ready",
        "package_type": "maintenance-index",
        "stats": payload.get("stats") or {},
        "section_counts": section_counts,
        "sections": sections,
        "compatibility": {
            "legacyPackage": "./public/data/maintenance-knowledge.json",
            "splitStrategy": "index-first-section-on-demand",
            "sourceEvidence": "sidecar",
        },
    }
    index_path = base_dir / "maintenance-index.json"
    _write_json(index_path, index_payload)
    written_files.insert(0, str(index_path))
    return written_files


def _brief_item(item: dict[str, Any] | None, source_refs: dict[str, list[dict[str, Any]]]) -> dict[str, Any] | None:
    if not item:
        return None
    metadata = _metadata(item)
    category = item.get("category") or metadata.get("role_category") or metadata.get("reference_category")
    return {
        "id": item["id"],
        "type": item["type"],
        "code": item.get("code"),
        "title": _canonical_title(item),
        "description": item.get("description"),
        "category": category,
        "sources": _brief_item_sources(item, source_refs),
    }


GBT_42446_TASK_DESCRIPTIONS = {
    "网络安全规划和管理": "指导、制定、监督和执行网络安全战略规划、策略制度和体制机制。综合协调相关人员，采取各类网络安全控制措施，降低并缓解系统安全风险",
    "网络数据安全保护": "针对网络数据收集、存储、使用、加工、传输、提供、公开等环节，采取措施保障网络数据安全",
    "个人信息保护": "针对个人信息收集、存储、使用、加工、传输、提供、公开、删除等环节，采取措施保障个人信息安全",
    "密码技术应用": "运用密码技术，进行信息系统安全密码保障的架构设计、系统集成、检测评估、运维管理、密码咨询等",
    "网络安全需求分析": "依据法律法规、政策标准及业务流程要求，开展符合性需求分析、业务所依赖的信息通信技术（ICT）持续运行需求分析、数据安全需求分析等，定期或在遇到重大网络安全事件时对组织网络安全需求进行复审",
    "网络安全架构设计": "依据网络安全需求分析、ICT 基础设施现状、组织环境和业务特点等，从物理环境、通信网络、计算环境、区域边界等方面进行网络安全架构设计，形成网络安全架构实施方案",
    "网络安全开发": "实现软件、硬件安全架构及功能开发，并对其进行测试、更新和维护",
    "供应链安全管理": "运用供应链安全管理的方法、工具和技术，控制供应链安全风险，管理供应商及网络安全和信息化相关产品和服务的采购",
    "网络安全集成实施": "网络安全项目管理，信息系统安全集成过程中软硬件设备与系统的安装、调试、测试、配置、故障处理和工程实施，以及配合验收交付",
    "网络安全运维": "利用网络安全技术工具，根据网络安全相关标准和制度流程，操作、运行、维护和管理信息系统",
    "网络安全监测和分析": "利用相关技术、工具和情报信息等对目标系统进行安全监测、分析和预警，并提出应对威胁的措施和改进建议",
    "网络安全应急管理": "组织编制网络安全事件应急预案，实施网络安全应急演练，在应对突发/重大网络安全事件时，采取必要的应急处置措施将信息系统和业务恢复到正常状态，并进行事件溯源和调查取证",
    "网络安全审计": "依据审计依据，在规定的审计范围内，监督和评价网络安全控制措施的设计有效性和执行有效性，确定被审计对象满足审计依据的程度，并提出网络安全工作改进的意见和建议",
    "网络安全测试": "对目标系统的脆弱性和防御机制有效性进行验证，发现安全问题并提出改进建议；根据测试依据，识别并测试系统和产品的安全性",
    "网络安全评估": "评估信息系统、业务及相关网络数据等的符合性和面临的网络安全风险，对风险进行识别、分析、评价，提出改进建议",
    "网络安全认证": "对网络安全管理体系、服务、产品等开展认证与审核",
    "电子数据取证": "对电子数据进行提取、固定、恢复、分析等工作",
    "网络安全咨询": "根据组织的安全目标，提供安全规划、设计、实施、运维、管理等方面的政策法规和技术咨询服务",
    "网络安全研究": "研究网络空间安全涉及的学科理论基础和方法论，研究网络安全新兴技术及应用、产业发展趋势，以及网络安全法律法规、政策、标准等",
    "网络安全培训和评价": "开展网络安全培训方案和相关课程的设计、开发和持续改进，实施授课等培训活动，开展评价活动，例如：理论知识考试、技能操作考核、业绩评审、竞赛选拔等",
}


def _gbt_42446_task_description(item: dict[str, Any]) -> str | None:
    title = " ".join(str(item.get("title") or "").split()).strip()
    category = " ".join(str(item.get("category") or "").split()).strip()
    task_title = title
    if category and title.startswith(f"{category}-"):
        task_title = title[len(category) + 1 :]
    return GBT_42446_TASK_DESCRIPTIONS.get(task_title)


def _split_semicolon_values(value: object) -> list[str]:
    return [part.strip() for part in str(value or "").replace("；", ";").split(";") if part.strip()]


def _candidate_work_function_item(value: str) -> dict[str, Any]:
    text = " ".join(str(value or "").split()).strip()
    match = re.match(r"^(\d+)\s+(.+)$", text)
    if match:
        code, title = match.groups()
        return {
            "id": f"work-function-candidate:{code}",
            "type": "work_function",
            "code": code,
            "title": title.strip(),
            "status": "待复核",
        }
    return {
        "id": f"work-function-candidate:{text}",
        "type": "work_function",
        "title": text,
        "status": "待复核",
    }


def _load_gartner_work_function_candidates(path: Path = GARTNER_WORK_FUNCTION_CANDIDATES_PATH) -> dict[tuple[str, str], dict[str, Any]]:
    if not path.exists():
        return {}
    candidates: dict[tuple[str, str], dict[str, Any]] = {}
    with path.open(newline="", encoding="utf-8-sig") as file:
        for row in csv.DictReader(file):
            title = " ".join((row.get("gartner_role_name") or "").split()).strip()
            category = " ".join((row.get("gartner_role_category") or "").split()).strip()
            if not title:
                continue
            candidate_functions = [
                _candidate_work_function_item(value)
                for value in _split_semicolon_values(row.get("candidate_work_functions"))
            ]
            candidates[(title, category)] = {
                "gartner_role_candidate_id": row.get("gartner_role_id") or "",
                "candidate_work_function_layers": _split_semicolon_values(row.get("candidate_work_function_layers")),
                "candidate_work_function_groups": _split_semicolon_values(row.get("candidate_work_function_groups")),
                "candidate_work_functions": candidate_functions,
                "candidate_count": len(candidate_functions),
                "match_basis": row.get("match_basis") or "",
                "confidence_or_rule": row.get("confidence_or_rule") or "",
                "review_status": "待复核",
                "candidate_quality": row.get("candidate_quality") or "",
            }
    return candidates


def _format_count_table(title: str, counts: dict[str, int]) -> str:
    lines = [f"## {title}", "", "| 类型 | 数量 |", "|---|---:|"]
    for key, value in counts.items():
        lines.append(f"| {key} | {value} |")
    return "\n".join(lines)


def latest_approved_import_job_id(conn: sqlite3.Connection) -> str:
    row = conn.execute(
        """
        SELECT id
        FROM import_jobs
        WHERE status = 'approved'
        ORDER BY finished_at DESC, started_at DESC
        LIMIT 1
        """
    ).fetchone()
    if not row:
        raise ValueError("No approved import job found.")
    return row["id"]


def import_job_detail(conn: sqlite3.Connection, import_job_id: str) -> dict[str, Any]:
    row = conn.execute(
        """
        SELECT import_jobs.id, import_jobs.status, import_jobs.job_type,
               import_jobs.started_at, import_jobs.finished_at, import_jobs.summary_json,
               source_files.file_name, source_files.file_path, source_files.file_hash
        FROM import_jobs
        JOIN source_files ON source_files.id = import_jobs.source_file_id
        WHERE import_jobs.id = ?
        """,
        (import_job_id,),
    ).fetchone()
    if not row:
        raise ValueError(f"Import job not found: {import_job_id}")
    result = dict(row)
    result["summary"] = _load_json(result.pop("summary_json"), {})
    return result


def validation_messages(conn: sqlite3.Connection, import_job_id: str) -> list[dict[str, Any]]:
    detail = import_job_detail(conn, import_job_id)
    summary = detail.get("summary", {})
    stage_summary = summary.get("stage_summary", {})
    return list(stage_summary.get("validations", []))


def export_items(
    conn: sqlite3.Connection,
    *,
    output_dir: str | Path | None = None,
    item_type: str | None = None,
    fmt: str = "all",
) -> dict[str, Any]:
    export_dir = _ensure_dir(output_dir)
    params: tuple[Any, ...] = ()
    where = ""
    if item_type:
        where = "WHERE type = ?"
        params = (item_type,)
    rows = conn.execute(
        f"""
        SELECT id, type, code, title, description, category, status,
               source_file_id, source_hash, metadata_json, created_at, updated_at
        FROM knowledge_items
        {where}
        ORDER BY type, code, title
        """,
        params,
    ).fetchall()
    data = [dict(row) for row in rows]
    base_name = f"knowledge-items-{item_type}" if item_type else "knowledge-items"
    written: list[str] = []
    if fmt in {"json", "all"}:
        path = export_dir / f"{base_name}.json"
        _write_json(path, data)
        written.append(str(path))
    if fmt in {"csv", "all"}:
        path = export_dir / f"{base_name}.csv"
        _write_csv(
            path,
            data,
            [
                "id",
                "type",
                "code",
                "title",
                "description",
                "category",
                "status",
                "source_file_id",
                "source_hash",
                "metadata_json",
                "created_at",
                "updated_at",
            ],
        )
        written.append(str(path))
    return {"count": len(data), "files": written}


def export_relations(
    conn: sqlite3.Connection,
    *,
    output_dir: str | Path | None = None,
    relation_type: str | None = None,
    fmt: str = "all",
    include_deprecated: bool = False,
) -> dict[str, Any]:
    export_dir = _ensure_dir(output_dir)
    params: list[Any] = []
    where_clauses: list[str] = []
    if relation_type:
        where_clauses.append("relation.relation_type = ?")
        params.append(relation_type)
    if not include_deprecated:
        where_clauses.append("source.status = 'active'")
        where_clauses.append("target.status = 'active'")
    where = f"WHERE {' AND '.join(where_clauses)}" if where_clauses else ""
    rows = conn.execute(
        f"""
        SELECT relation.id, relation.relation_type, relation.relation_label, relation.confidence,
               source.type AS source_type, source.code AS source_code, source.title AS source_title,
               source.status AS source_status,
               target.type AS target_type, target.code AS target_code, target.title AS target_title,
               target.status AS target_status,
               relation.source_file_id, relation.import_job_id, relation.metadata_json,
               relation.created_at, relation.updated_at
        FROM knowledge_relations AS relation
        JOIN knowledge_items AS source ON source.id = relation.source_item_id
        JOIN knowledge_items AS target ON target.id = relation.target_item_id
        {where}
        ORDER BY relation.relation_type, source.type, source.code, source.title, target.type, target.code, target.title
        """,
        tuple(params),
    ).fetchall()
    data = [dict(row) for row in rows]
    base_name = f"knowledge-relations-{relation_type}" if relation_type else "knowledge-relations"
    written: list[str] = []
    if fmt in {"json", "all"}:
        path = export_dir / f"{base_name}.json"
        _write_json(path, data)
        written.append(str(path))
    if fmt in {"csv", "all"}:
        path = export_dir / f"{base_name}.csv"
        _write_csv(
            path,
            data,
            [
                "id",
                "relation_type",
                "relation_label",
                "confidence",
                "source_type",
                "source_code",
                "source_title",
                "source_status",
                "target_type",
                "target_code",
                "target_title",
                "target_status",
                "source_file_id",
                "import_job_id",
                "metadata_json",
                "created_at",
                "updated_at",
            ],
        )
        written.append(str(path))
    return {"count": len(data), "files": written}


def export_import_summary(
    conn: sqlite3.Connection,
    import_job_id: str,
    *,
    output_dir: str | Path | None = None,
) -> dict[str, Any]:
    export_dir = _ensure_dir(output_dir)
    detail = import_job_detail(conn, import_job_id)
    payload = {
        "import_job": detail,
        "tables": table_counts(conn),
        "items_by_type": item_counts_by_type(conn),
        "relations_by_type": relation_counts_by_type(conn),
        "validations": validation_messages(conn, import_job_id),
    }
    path = export_dir / f"import-summary-{import_job_id[:8]}.json"
    _write_json(path, payload)
    return {"files": [str(path)], "validation_count": len(payload["validations"])}


def write_warning_review(
    conn: sqlite3.Connection,
    import_job_id: str,
    *,
    output_dir: str | Path | None = None,
) -> dict[str, Any]:
    export_dir = _ensure_dir(output_dir)
    rows = []
    for index, message in enumerate(validation_messages(conn, import_job_id), start=1):
        rows.append(
            {
                "index": index,
                "level": message.get("level", ""),
                "sheet": message.get("sheet", ""),
                "row": message.get("row", ""),
                "message": message.get("message", ""),
                "suggested_action": "检查 Excel 原始编码；若业务允许无编码，则补充映射兼容规则",
                "status": "待确认",
            }
        )
    path = export_dir / f"warning-review-{import_job_id[:8]}.csv"
    _write_csv(path, rows, ["index", "level", "sheet", "row", "message", "suggested_action", "status"])
    return {"count": len(rows), "files": [str(path)]}


def write_import_result_report(
    conn: sqlite3.Connection,
    import_job_id: str,
    *,
    output_dir: str | Path | None = None,
    sample_limit: int = 20,
) -> dict[str, Any]:
    export_dir = _ensure_dir(output_dir)
    detail = import_job_detail(conn, import_job_id)
    tables = table_counts(conn)
    item_counts = item_counts_by_type(conn)
    relation_counts = relation_counts_by_type(conn)
    validations = validation_messages(conn, import_job_id)
    sample_items = conn.execute(
        """
        SELECT type, code, title, status
        FROM knowledge_items
        ORDER BY type, code, title
        LIMIT ?
        """,
        (sample_limit,),
    ).fetchall()

    lines = [
        "# Excel 导入结果报告",
        "",
        f"- 导入任务：`{import_job_id}`",
        f"- 状态：`{detail['status']}`",
        f"- 来源文件：`{detail['file_name']}`",
        f"- 开始时间：`{detail['started_at']}`",
        f"- 完成时间：`{detail['finished_at']}`",
        "",
        "## 总体统计",
        "",
        "| 表 | 数量 |",
        "|---|---:|",
    ]
    for key, value in tables.items():
        lines.append(f"| {key} | {value} |")
    lines.extend(["", _format_count_table("对象类型统计", item_counts), "", _format_count_table("关系类型统计", relation_counts), ""])
    lines.extend(["## 样例对象", "", "| 类型 | 编码 | 标题 | 状态 |", "|---|---|---|---|"])
    for row in sample_items:
        lines.append(f"| {row['type']} | {row['code'] or ''} | {row['title']} | {row['status']} |")
    lines.extend(["", "## Warning 清单", ""])
    if validations:
        lines.extend(["| 级别 | Sheet | 行号 | 问题 |", "|---|---|---:|---|"])
        for message in validations:
            lines.append(
                f"| {message.get('level', '')} | {message.get('sheet', '')} | {message.get('row', '')} | {message.get('message', '')} |"
            )
    else:
        lines.append("本次导入没有 warning 或 error。")

    path = export_dir / f"import-result-report-{import_job_id[:8]}.md"
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")
    return {"files": [str(path)], "validation_count": len(validations)}


def _item_payload(item: dict[str, Any], source_refs: dict[str, list[dict[str, Any]]]) -> dict[str, Any]:
    return {
        "id": item["id"],
        "type": item["type"],
        "code": item["code"],
        "title": _canonical_title(item),
        "description": item["description"],
        "category": item["category"],
        "status": item["status"],
        "metadata": _metadata(item),
        "sources": source_refs.get(item["id"], [])[:8],
    }


def export_capability_tree(
    conn: sqlite3.Connection,
    *,
    output_path: str | Path,
) -> dict[str, Any]:
    output = resolve_project_path(output_path)
    output.parent.mkdir(parents=True, exist_ok=True)

    item_rows = conn.execute(
        """
        SELECT id, type, code, title, description, category, status, metadata_json
        FROM knowledge_items
        WHERE status = 'active'
        """
    ).fetchall()
    items = {row["id"]: dict(row) for row in item_rows}
    scope_id_by_code = {
        item["code"]: item_id
        for item_id, item in items.items()
        if item["type"] == "scope_type" and item.get("code")
    }
    refs = _source_reference_map(conn, "item")
    relation_refs = _source_reference_map(conn, "relation")

    children_by_parent: dict[str, list[str]] = {}
    services_by_focus: dict[str, list[str]] = {}
    scopes_by_service: dict[str, list[str]] = {}
    support_relation_by_focus_service: dict[tuple[str, str], str] = {}
    scope_relation_by_service_scope: dict[tuple[str, str], str] = {}
    no_service_scopes_by_focus: dict[str, list[str]] = {}
    no_service_relation_by_focus_scope: dict[tuple[str, str], str] = {}
    capability_process_groups: dict[str, list[dict[str, Any]]] = {}
    focus_process_refs: dict[str, list[dict[str, Any]]] = {}
    process_group_by_reference: dict[str, str] = {}
    activities_by_process_reference: dict[str, list[str]] = {}
    stakeholders_by_source: dict[str, list[dict[str, Any]]] = {}
    work_function_layers: dict[str, str] = {}
    relation_rows = conn.execute(
        """
        SELECT relation.id, relation.source_item_id, relation.target_item_id,
               relation.relation_type, relation.metadata_json,
               source.type AS source_type, target.type AS target_type
        FROM knowledge_relations AS relation
        JOIN knowledge_items AS source ON source.id = relation.source_item_id
        JOIN knowledge_items AS target ON target.id = relation.target_item_id
        WHERE source.status = 'active'
          AND target.status = 'active'
        """
    ).fetchall()
    for row in relation_rows:
        source_id = row["source_item_id"]
        target_id = row["target_item_id"]
        relation_type = row["relation_type"]
        source_type = row["source_type"]
        target_type = row["target_type"]
        if relation_type == "belongs_to":
            children_by_parent.setdefault(target_id, []).append(source_id)
            if source_type == "process_reference" and target_type == "process_group":
                process_group_by_reference[source_id] = target_id
        elif relation_type == "supports_focus":
            services_by_focus.setdefault(target_id, []).append(source_id)
            support_relation_by_focus_service[(target_id, source_id)] = row["id"]
        elif relation_type == "applies_to_scope" and source_type == "security_technical_service" and target_type == "scope_type":
            scopes_by_service.setdefault(source_id, []).append(target_id)
            scope_relation_by_service_scope[(source_id, target_id)] = row["id"]
        elif relation_type == "no_service_in_scope" and source_type == "capability_focus" and target_type == "scope_type":
            no_service_scopes_by_focus.setdefault(source_id, []).append(target_id)
            no_service_relation_by_focus_scope[(source_id, target_id)] = row["id"]
        elif relation_type == "maps_to_process":
            relation = dict(row)
            if source_type == "capability" and target_type == "process_group":
                capability_process_groups.setdefault(source_id, []).append(relation)
            elif source_type == "capability_focus" and target_type == "process_reference":
                focus_process_refs.setdefault(source_id, []).append(relation)
        elif relation_type == "stakeholder_by" and target_type == "work_function":
            stakeholders_by_source.setdefault(source_id, []).append(dict(row))
        elif relation_type == "belongs_to_layer" and source_type == "work_function" and target_type == "work_function_layer":
            work_function_layers[source_id] = target_id
        elif relation_type == "has_activity" and source_type == "process_reference" and target_type == "process_activity":
            activities_by_process_reference.setdefault(source_id, []).append(target_id)

    def sort_ids(ids: list[str]) -> list[str]:
        def sort_key(item_id: str) -> tuple[int, int, str, str]:
            item = items[item_id]
            metadata = _metadata(item)
            raw_order = metadata.get("tree_order")
            try:
                tree_order = int(raw_order)
            except (TypeError, ValueError):
                tree_order = 10**9
            return (0 if tree_order < 10**9 else 1, tree_order, item["code"] or "", item["title"])

        return sorted(set(ids), key=sort_key)

    def authoritative_scope_id_for_service(service_id: str) -> str | None:
        service = items.get(service_id)
        if not service:
            return None
        metadata = _metadata(service)
        scope_code = (
            metadata.get("scope_code")
            or service.get("category")
            or ((service.get("code") or "").split("&", 1)[0] if service.get("code") else None)
        )
        return scope_id_by_code.get(scope_code) if scope_code else None

    linked_focus_ids: set[str] = set()

    def stakeholder_layer(work_function_id: str, relation: dict[str, Any]) -> str:
        relation_metadata = _load_json(relation.get("metadata_json"), {})
        for key in ("stakeholder_layer", "layer", "layer_title", "role_layer", "stakeholder_type"):
            value = relation_metadata.get(key)
            if value:
                value_text = str(value)
                for layer in STAKEHOLDER_LAYERS:
                    if layer in value_text:
                        return layer
        layer_id = work_function_layers.get(work_function_id)
        if layer_id and layer_id in items:
            layer_title = items[layer_id]["title"]
            for layer in STAKEHOLDER_LAYERS:
                if layer in layer_title:
                    return layer
            return layer_title
        work_metadata = _metadata(items.get(work_function_id, {})) if work_function_id in items else {}
        for key in ("layer_title", "function_layer", "职能类"):
            value = work_metadata.get(key)
            if value:
                value_text = str(value)
                for layer in STAKEHOLDER_LAYERS:
                    if layer in value_text:
                        return layer
        return "未分层"

    def make_stakeholders(*source_ids: str) -> dict[str, list[dict[str, Any]]]:
        grouped: dict[str, list[dict[str, Any]]] = {layer: [] for layer in STAKEHOLDER_LAYERS}
        for source_id in source_ids:
            for relation in stakeholders_by_source.get(source_id, []):
                work_function_id = relation["target_item_id"]
                if work_function_id not in items:
                    continue
                layer = stakeholder_layer(work_function_id, relation)
                grouped.setdefault(layer, [])
                payload = _brief_item(items[work_function_id], refs)
                if payload and payload not in grouped[layer]:
                    grouped[layer].append(payload)
        return grouped

    def make_process_mappings(focus_id: str, capability_id: str | None) -> list[dict[str, Any]]:
        mappings: dict[tuple[str | None, str | None], dict[str, Any]] = {}
        for relation in focus_process_refs.get(focus_id, []):
            process_reference_id = relation["target_item_id"]
            if process_reference_id not in items:
                continue
            process_group_id = process_group_by_reference.get(process_reference_id)
            key = (process_group_id, process_reference_id)
            activities = [
                _brief_item(items[activity_id], refs)
                for activity_id in sort_ids(activities_by_process_reference.get(process_reference_id, []))
                if activity_id in items
            ]
            mappings[key] = {
                "process_group": _brief_item(items.get(process_group_id), refs),
                "process_reference": _brief_item(items[process_reference_id], refs),
                "activities": activities,
                "activity_status": "available" if activities else "missing",
                "activity_status_label": "已补充" if activities else "待补充",
                "missing_activity": not activities,
                "stakeholders": make_stakeholders(focus_id, process_reference_id),
                "sources": _combine_sources(
                    relation_refs.get(relation["id"]),
                    refs.get(process_reference_id),
                    refs.get(process_group_id) if process_group_id else None,
                ),
            }
        return sorted(
            mappings.values(),
            key=lambda mapping: (
                (mapping.get("process_group") or {}).get("title") or "",
                (mapping.get("process_reference") or {}).get("title") or "",
            ),
        )

    def make_focus_scope_mappings(focus_id: str, service_ids: list[str]) -> list[dict[str, Any]]:
        mappings: dict[str, dict[str, Any]] = {}
        for service_id in service_ids:
            if service_id not in items:
                continue
            scope_id = authoritative_scope_id_for_service(service_id)
            if not scope_id or scope_id not in items:
                continue
            entry = mappings.setdefault(
                scope_id,
                {
                    "scope": _brief_item(items[scope_id], refs),
                    "services": [],
                    "sources": [],
                    "status": "covered",
                },
            )
            service_payload = _brief_item(items[service_id], refs)
            if service_payload and service_payload not in entry["services"]:
                entry["services"].append(service_payload)
            entry["sources"] = _combine_sources(
                entry["sources"],
                relation_refs.get(support_relation_by_focus_service.get((focus_id, service_id))),
                relation_refs.get(scope_relation_by_service_scope.get((service_id, scope_id))),
                refs.get(scope_id),
            )
        for scope_id in no_service_scopes_by_focus.get(focus_id, []):
            if scope_id not in items or mappings.get(scope_id, {}).get("services"):
                continue
            mappings[scope_id] = {
                "scope": _brief_item(items[scope_id], refs),
                "services": [],
                "sources": _combine_sources(
                    relation_refs.get(no_service_relation_by_focus_scope.get((focus_id, scope_id))),
                    refs.get(scope_id),
                ),
                "status": "no_service",
            }
        results = []
        for scope_id in sort_ids(list(mappings.keys())):
            mapping = mappings[scope_id]
            mapping["service_count"] = len(mapping["services"])
            mapping["status"] = mapping.get("status") or ("covered" if mapping["services"] else "no_service")
            results.append(mapping)
        return results

    def make_focus(focus_id: str) -> dict[str, Any]:
        linked_focus_ids.add(focus_id)
        services = []
        service_ids = sort_ids(services_by_focus.get(focus_id, []))
        for service_id in service_ids:
            service = _item_payload(items[service_id], refs)
            authoritative_scope_id = authoritative_scope_id_for_service(service_id)
            service["scopes"] = [
                _item_payload(items[scope_id], refs)
                for scope_id in sort_ids([authoritative_scope_id] if authoritative_scope_id else [])
                if scope_id in items
            ]
            services.append(service)
        payload = _item_payload(items[focus_id], refs)
        payload["services"] = services
        payload["service_count"] = len(services)
        payload["scope_mappings"] = make_focus_scope_mappings(focus_id, service_ids)
        payload["scope_count"] = len(payload["scope_mappings"])
        capability_id = next(
            (
                parent_id
                for parent_id, child_ids in children_by_parent.items()
                if focus_id in child_ids and parent_id in items and items[parent_id]["type"] == "capability"
            ),
            None,
        )
        payload["security_works"] = [
            _item_payload(items[row["target_item_id"]], refs)
            for row in relation_rows
            if row["relation_type"] == "maps_to_work"
            and row["source_item_id"] == focus_id
            and row["target_item_id"] in items
            and items[row["target_item_id"]]["type"] == "security_work"
        ]
        payload["process_mappings"] = make_process_mappings(focus_id, capability_id)
        return payload

    def make_capability(capability_id: str) -> dict[str, Any]:
        focus_ids = [
            child_id
            for child_id in children_by_parent.get(capability_id, [])
            if child_id in items and items[child_id]["type"] == "capability_focus"
        ]
        payload = _item_payload(items[capability_id], refs)
        payload["focuses"] = [make_focus(focus_id) for focus_id in sort_ids(focus_ids)]
        payload["focus_count"] = len(payload["focuses"])
        payload["service_count"] = sum(focus["service_count"] for focus in payload["focuses"])
        return payload

    def make_domain(domain_id: str) -> dict[str, Any]:
        capability_ids = [
            child_id
            for child_id in children_by_parent.get(domain_id, [])
            if child_id in items and items[child_id]["type"] == "capability"
        ]
        payload = _item_payload(items[domain_id], refs)
        payload["capabilities"] = [make_capability(capability_id) for capability_id in sort_ids(capability_ids)]
        payload["capability_count"] = len(payload["capabilities"])
        payload["focus_count"] = sum(capability["focus_count"] for capability in payload["capabilities"])
        payload["service_count"] = sum(capability["service_count"] for capability in payload["capabilities"])
        return payload

    def make_category(category_id: str) -> dict[str, Any]:
        domain_ids = [
            child_id
            for child_id in children_by_parent.get(category_id, [])
            if child_id in items and items[child_id]["type"] == "capability_domain"
        ]
        payload = _item_payload(items[category_id], refs)
        payload["domains"] = [make_domain(domain_id) for domain_id in sort_ids(domain_ids)]
        payload["domain_count"] = len(payload["domains"])
        payload["capability_count"] = sum(domain["capability_count"] for domain in payload["domains"])
        payload["focus_count"] = sum(domain["focus_count"] for domain in payload["domains"])
        payload["service_count"] = sum(domain["service_count"] for domain in payload["domains"])
        return payload

    category_ids = [
        item_id
        for item_id, item in items.items()
        if item["type"] == "capability_category"
    ]
    categories = [make_category(category_id) for category_id in sort_ids(category_ids)]
    all_focus_ids = [
        item_id
        for item_id, item in items.items()
        if item["type"] == "capability_focus"
    ]
    unlinked_focuses = [
        make_focus(focus_id)
        for focus_id in sort_ids(all_focus_ids)
        if focus_id not in linked_focus_ids
    ]
    payload = {
        "generated_at": conn.execute("SELECT datetime('now') AS now").fetchone()["now"],
        "stats": {
            "categories": len(categories),
            "domains": sum(category["domain_count"] for category in categories),
            "capabilities": sum(category["capability_count"] for category in categories),
            "focuses": sum(category["focus_count"] for category in categories) + len(unlinked_focuses),
            "services": len({item_id for services in services_by_focus.values() for item_id in services}),
            "focus_scope_mappings": sum(
                focus.get("scope_count", 0)
                for category in categories
                for domain in category.get("domains", [])
                for capability in domain.get("capabilities", [])
                for focus in capability.get("focuses", [])
            ),
            "unlinked_focuses": len(unlinked_focuses),
        },
        "categories": categories,
        "unlinked_focuses": unlinked_focuses,
    }
    _write_json(output, payload)
    return {"count": len(categories), "files": [str(output)], "stats": payload["stats"]}


def _active_items(
    conn: sqlite3.Connection,
    item_types: tuple[str, ...] | None = None,
) -> dict[str, dict[str, Any]]:
    params: tuple[Any, ...] = ()
    type_filter = ""
    if item_types:
        placeholders = ", ".join("?" for _ in item_types)
        type_filter = f"AND type IN ({placeholders})"
        params = item_types
    rows = conn.execute(
        f"""
        SELECT id, type, code, title, description, category, status, metadata_json
        FROM knowledge_items
        WHERE status = 'active'
        {type_filter}
        """,
        params,
    ).fetchall()
    return {row["id"]: dict(row) for row in rows}


def _relation_rows(
    conn: sqlite3.Connection,
    relation_types: tuple[str, ...] | None = None,
) -> list[dict[str, Any]]:
    params: tuple[Any, ...] = ()
    type_filter = ""
    if relation_types:
        placeholders = ", ".join("?" for _ in relation_types)
        type_filter = f"WHERE relation.relation_type IN ({placeholders})"
        params = relation_types
    rows = conn.execute(
        f"""
        SELECT relation.id, relation.source_item_id, relation.target_item_id,
               relation.relation_type, relation.relation_label, relation.metadata_json,
               source.type AS source_type, target.type AS target_type
        FROM knowledge_relations AS relation
        JOIN knowledge_items AS source ON source.id = relation.source_item_id
        JOIN knowledge_items AS target ON target.id = relation.target_item_id
        {type_filter}
        {"AND" if type_filter else "WHERE"} source.status = 'active'
          AND target.status = 'active'
        """,
        params,
    ).fetchall()
    return [dict(row) for row in rows]


def _sort_source_ids(source: dict[str, dict[str, Any]], item_ids: list[str]) -> list[str]:
    return [
        item["id"]
        for item in _sort_item_rows([source[item_id] for item_id in set(item_ids) if item_id in source])
    ]


def _brief_many(
    source: dict[str, dict[str, Any]],
    item_ids: list[str],
    refs: dict[str, list[dict[str, Any]]],
) -> list[dict[str, Any]]:
    return [
        _brief_item(source[item_id], refs) or {}
        for item_id in _sort_source_ids(source, item_ids)
        if item_id in source
    ]


def _build_service_module_index(conn: sqlite3.Connection) -> tuple[list[dict[str, Any]], dict[str, dict[str, Any]]]:
    items = _active_items(conn, SERVICE_MODULE_INDEX_ITEM_TYPES)
    refs = _source_reference_map(conn, "item")
    relation_refs = _source_reference_map(conn, "relation")
    relations = _relation_rows(conn, SERVICE_MODULE_INDEX_RELATION_TYPES)

    services = {item_id: item for item_id, item in items.items() if item["type"] == "security_technical_service"}
    modules = {item_id: item for item_id, item in items.items() if item["type"] == "security_technology_module"}
    systems = {item_id: item for item_id, item in items.items() if item["type"] == "security_system"}
    products = {item_id: item for item_id, item in items.items() if item["type"] == "product"}
    environments = {item_id: item for item_id, item in items.items() if item["type"] == "information_environment"}
    scopes = {item_id: item for item_id, item in items.items() if item["type"] == "scope_type"}

    scopes_by_service: dict[str, list[str]] = {}
    modules_by_service: dict[str, list[str]] = {}
    systems_by_module: dict[str, list[str]] = {}
    products_by_module: dict[str, list[str]] = {}
    environments_by_module: dict[str, list[str]] = {}
    relation_sources_by_key: dict[tuple[str, str, str], list[dict[str, Any]]] = {}

    for relation in relations:
        source_id = relation["source_item_id"]
        target_id = relation["target_item_id"]
        relation_type = relation["relation_type"]
        source_type = relation["source_type"]
        target_type = relation["target_type"]
        relation_sources_by_key.setdefault((source_id, relation_type, target_id), [])
        relation_sources_by_key[(source_id, relation_type, target_id)].extend(relation_refs.get(relation["id"], []))
        if relation_type == "applies_to_scope" and source_type == "security_technical_service" and target_type == "scope_type":
            scopes_by_service.setdefault(source_id, []).append(target_id)
        elif relation_type == "implements_service" and source_type == "security_technology_module" and target_type == "security_technical_service":
            modules_by_service.setdefault(target_id, []).append(source_id)
        elif relation_type == "part_of_system" and source_type == "security_technology_module" and target_type == "security_system":
            systems_by_module.setdefault(source_id, []).append(target_id)
        elif relation_type == "maps_to_product" and source_type == "security_technology_module" and target_type == "product":
            products_by_module.setdefault(source_id, []).append(target_id)
        elif relation_type == "deployed_in_environment" and source_type == "security_technology_module" and target_type == "information_environment":
            environments_by_module.setdefault(source_id, []).append(target_id)

    def relation_sources(source_id: str, relation_type: str, target_id: str) -> list[dict[str, Any]]:
        return relation_sources_by_key.get((source_id, relation_type, target_id), [])

    service_module_index = []
    by_service_id: dict[str, dict[str, Any]] = {}
    for service_id in _sort_source_ids(services, list(services.keys())):
        service_payload = _brief_item(services[service_id], refs) or {}
        module_payloads = []
        for module_id in _sort_source_ids(modules, modules_by_service.get(service_id, [])):
            module_payload = _brief_item(modules[module_id], refs) or {}
            module_payload["systems"] = _brief_many(systems, systems_by_module.get(module_id, []), refs)
            module_payload["products"] = _brief_many(products, products_by_module.get(module_id, []), refs)
            module_payload["environments"] = _brief_many(environments, environments_by_module.get(module_id, []), refs)
            module_payload["mapping_sources"] = relation_sources(module_id, "implements_service", service_id)
            module_payloads.append(module_payload)
        payload = {
            "service": service_payload,
            "scopes": _brief_many(scopes, scopes_by_service.get(service_id, []), refs),
            "modules": module_payloads,
            "module_count": len(module_payloads),
            "system_count": sum(len(module.get("systems", [])) for module in module_payloads),
            "product_count": sum(len(module.get("products", [])) for module in module_payloads),
            "environment_count": sum(len(module.get("environments", [])) for module in module_payloads),
            "sources": _combine_sources(
                refs.get(service_id),
                *(relation_sources(service_id, "applies_to_scope", scope_id) for scope_id in scopes_by_service.get(service_id, [])),
            ),
        }
        service_module_index.append(payload)
        by_service_id[service_id] = payload
    return service_module_index, by_service_id


def _shared_lookups_payload(conn: sqlite3.Connection) -> dict[str, Any]:
    service_module_index, _service_module_index_by_id = _build_service_module_index(conn)
    return {
        "generated_at": conn.execute("SELECT datetime('now') AS now").fetchone()["now"],
        "data_state": "ready" if service_module_index else "empty",
        "stats": {
            "service_module_index": len(service_module_index),
        },
        "service_module_index": service_module_index,
    }


def export_shared_lookups(
    conn: sqlite3.Connection,
    *,
    output_path: str | Path,
) -> dict[str, Any]:
    """Export frontend shared lookup data used across workbench projections."""

    output = resolve_project_path(output_path)
    output.parent.mkdir(parents=True, exist_ok=True)
    payload = _shared_lookups_payload(conn)
    _write_json(output, payload)
    return {"count": len(payload["service_module_index"]), "files": [str(output)], "stats": payload["stats"]}


def _item_counts_for_types(conn: sqlite3.Connection, item_types: tuple[str, ...]) -> dict[str, int]:
    rows = conn.execute(
        f"""
        SELECT type, COUNT(*) AS count
        FROM knowledge_items
        WHERE status = 'active'
          AND type IN ({", ".join("?" for _ in item_types)})
        GROUP BY type
        ORDER BY type
        """,
        item_types,
    ).fetchall()
    counts = {row["type"]: row["count"] for row in rows}
    return {item_type: counts.get(item_type, 0) for item_type in item_types}


def _relation_counts_for_types(conn: sqlite3.Connection, relation_types: tuple[str, ...]) -> dict[str, int]:
    rows = conn.execute(
        f"""
        SELECT relation.relation_type, COUNT(*) AS count
        FROM knowledge_relations AS relation
        JOIN knowledge_items AS source ON source.id = relation.source_item_id
        JOIN knowledge_items AS target ON target.id = relation.target_item_id
        WHERE relation.relation_type IN ({", ".join("?" for _ in relation_types)})
          AND source.status = 'active'
          AND target.status = 'active'
          AND (
            source.type IN ({", ".join("?" for _ in SECOND_BATCH_ITEM_TYPES)})
            OR target.type IN ({", ".join("?" for _ in SECOND_BATCH_ITEM_TYPES)})
          )
        GROUP BY relation.relation_type
        ORDER BY relation.relation_type
        """,
        (*relation_types, *SECOND_BATCH_ITEM_TYPES, *SECOND_BATCH_ITEM_TYPES),
    ).fetchall()
    counts = {row["relation_type"]: row["count"] for row in rows}
    return {relation_type: counts.get(relation_type, 0) for relation_type in relation_types}


def _layer_sort_key(item: dict[str, Any]) -> tuple[int, int, str]:
    layer_order = {
        "网络安全决策层": 1,
        "决策层": 1,
        "网络安全管理层": 2,
        "管理层": 2,
        "网络安全执行层": 3,
        "执行层": 3,
        "网络安全监督层": 4,
        "监督层": 4,
    }
    title = item["title"]
    for key, order in layer_order.items():
        if key in title:
            return (0, order, title)
    metadata = _metadata(item)
    try:
        display_order = int(metadata.get("display_order"))
    except (TypeError, ValueError):
        display_order = 10**9
    return (1 if display_order == 10**9 else 0, display_order, title)


def _metadata_value(item: dict[str, Any], keys: tuple[str, ...]) -> str | None:
    metadata = _metadata(item)
    for key in keys:
        value = metadata.get(key)
        if value:
            return str(value)
    return None


def _xlsx_sheet_path(archive: zipfile.ZipFile, sheet_name: str) -> str | None:
    workbook = ET.fromstring(archive.read("xl/workbook.xml"))
    rels = ET.fromstring(archive.read("xl/_rels/workbook.xml.rels"))
    rel_targets = {rel.attrib.get("Id"): rel.attrib.get("Target") for rel in rels}
    rel_id = None
    for sheet in workbook.find("m:sheets", XLSX_NS) or []:
        if sheet.attrib.get("name") == sheet_name:
            rel_id = sheet.attrib.get(f"{{{XLSX_REL_NS}}}id")
            break
    if not rel_id:
        return None
    target = (rel_targets.get(rel_id) or "").replace("\\", "/").lstrip("/")
    if not target:
        return None
    return target if target.startswith("xl/") else f"xl/{target}"


def _xlsx_shared_strings(archive: zipfile.ZipFile) -> list[str]:
    if "xl/sharedStrings.xml" not in archive.namelist():
        return []
    root = ET.fromstring(archive.read("xl/sharedStrings.xml"))
    strings = []
    for item in root.findall("m:si", XLSX_NS):
        strings.append("".join(text.text or "" for text in item.iter(f"{{{XLSX_MAIN_NS}}}t")))
    return strings


def _xlsx_style_fills(archive: zipfile.ZipFile) -> dict[str, dict[str, str]]:
    root = ET.fromstring(archive.read("xl/styles.xml"))
    fill_colors: list[dict[str, str]] = []
    for fill in root.find("m:fills", XLSX_NS) or []:
        pattern = fill.find("m:patternFill", XLSX_NS)
        color = pattern.find("m:fgColor", XLSX_NS) if pattern is not None else None
        fill_colors.append(dict(color.attrib) if color is not None else {})

    styles: dict[str, dict[str, str]] = {}
    for index, style in enumerate(root.find("m:cellXfs", XLSX_NS) or []):
        try:
            fill_id = int(style.attrib.get("fillId", "0"))
        except ValueError:
            fill_id = 0
        styles[str(index)] = fill_colors[fill_id] if fill_id < len(fill_colors) else {}
    return styles


def _xlsx_cell_text(cell: ET.Element, shared_strings: list[str]) -> str:
    cell_type = cell.attrib.get("t")
    if cell_type == "inlineStr":
        inline = cell.find("m:is", XLSX_NS)
        if inline is None:
            return ""
        return "".join(text.text or "" for text in inline.iter(f"{{{XLSX_MAIN_NS}}}t"))
    value = cell.find("m:v", XLSX_NS)
    if value is None or value.text is None:
        return ""
    if cell_type == "s":
        try:
            return shared_strings[int(value.text)]
        except (IndexError, ValueError):
            return ""
    return value.text


def _xlsx_column(cell_ref: str) -> str:
    return re.sub(r"\d+", "", cell_ref)


def _xlsx_row(cell_ref: str) -> int:
    digits = re.sub(r"\D+", "", cell_ref)
    return int(digits) if digits else 0


def _fill_tint_matches(fill: dict[str, str], *, theme: str, tint: float) -> bool:
    if fill.get("theme") != theme:
        return False
    try:
        return abs(float(fill.get("tint", "0")) - tint) < 0.000001
    except ValueError:
        return False


def _technical_measure_style(fill: dict[str, str]) -> str | None:
    if _fill_tint_matches(fill, theme="6", tint=0.5999938962981048):
        return "measure"
    if fill.get("theme") == "0":
        return "measure_note"
    return None


def _normalize_measure_name(value: object) -> str:
    text = " ".join(str(value or "").replace("\xa0", " ").split()).strip()
    note_match = re.fullmatch(r"N/A\s*[（(]\s*(.*?)\s*[）)]", text, flags=re.IGNORECASE)
    if note_match:
        return note_match.group(1).strip()
    return re.sub(r"^(N/A)\s+([（(])", r"\1\2", text, flags=re.IGNORECASE)


def _split_measure_names(value: object) -> list[tuple[str, bool]]:
    text = str(value or "").replace("\xa0", " ").strip()
    text = re.sub(r"(?i)\bN/A\s*[\r\n]+\s*([（(])", r"N/A\1", text)
    return [
        (name, re.match(r"N/A\s*[（(]", part.strip(), flags=re.IGNORECASE) is not None)
        for part in split_multivalue_text(text, split_on_ideographic_comma=False)
        for name in [_normalize_measure_name(part)]
        if name and not is_blank_or_placeholder(name)
    ]


def _measure_category_status(name: str, style: str, was_note_wrapper: bool = False) -> tuple[str | None, str]:
    if name.upper().startswith("N/A"):
        return None, "pending"
    return None, "normal"


def _is_empty_security_system_value(value: object) -> bool:
    text = _normalize_measure_name(value).upper()
    return is_blank_or_placeholder(value) or text in {"N/A", "NA"}


def _scope_value_with_service_scope(scope_raw: object, service_raw: object) -> str:
    scope_text = str(scope_raw or "").strip()
    service_scope = service_parts(service_raw).get("scope_code")
    if not service_scope:
        return scope_text
    scope_codes = {code for code, _title in split_scope_values(scope_text) if code}
    if service_scope in scope_codes:
        return scope_text
    return "\n".join([value for value in [scope_text, service_scope] if value])


def _source_payload(row: int, column: str, cell: str | None, raw_value: object) -> dict[str, Any]:
    return {
        "sheet": SCENE_TECHNICAL_MAPPING_SHEET,
        "row": row,
        "column": column,
        "cell": cell,
        "raw_value": None if raw_value is None else str(raw_value),
    }


def _latest_xlsx_source_paths(conn: sqlite3.Connection) -> list[Path]:
    rows = conn.execute(
        """
        SELECT DISTINCT source_file.file_path, import_job.finished_at, import_job.started_at
        FROM import_jobs AS import_job
        JOIN source_files AS source_file ON source_file.id = import_job.source_file_id
        WHERE import_job.status = 'approved'
          AND source_file.file_type = 'xlsx'
          AND source_file.status = 'active'
        ORDER BY import_job.finished_at DESC, import_job.started_at DESC
        """
    ).fetchall()
    paths: list[Path] = []
    seen: set[Path] = set()
    for row in rows:
        path = resolve_project_path(row["file_path"])
        if path.name.startswith("~$") or path in seen:
            continue
        seen.add(path)
        paths.append(path)
    return paths


def _scene_measure_candidates_from_xlsx(path: Path) -> list[dict[str, Any]]:
    if not path.exists():
        return []
    with zipfile.ZipFile(path) as archive:
        sheet_path = _xlsx_sheet_path(archive, SCENE_TECHNICAL_MAPPING_SHEET)
        if not sheet_path or sheet_path not in archive.namelist():
            return []
        shared_strings = _xlsx_shared_strings(archive)
        style_fills = _xlsx_style_fills(archive)
        root = ET.fromstring(archive.read(sheet_path))

        rows: dict[int, dict[str, dict[str, Any]]] = {}
        for cell in root.findall(".//m:c", XLSX_NS):
            cell_ref = cell.attrib.get("r", "")
            column = _xlsx_column(cell_ref)
            row_number = _xlsx_row(cell_ref)
            if row_number < 3 or column not in {"B", "C", "D", "E", "F", "G", "H"}:
                continue
            rows.setdefault(row_number, {})[column] = {
                "cell": cell_ref,
                "value": _xlsx_cell_text(cell, shared_strings),
                "fill": style_fills.get(cell.attrib.get("s", "0"), {}),
            }

    inherited_values = {"B": "", "C": "", "D": "", "E": "", "G": "", "H": ""}
    inherited_sources: dict[str, dict[str, Any]] = {}
    inherited_fills: dict[str, dict[str, Any]] = {}
    source_columns = {
        "B": "信息化环境",
        "C": "environment_segment",
        "D": "信息化对象",
        "E": "作用域",
        "G": TECHNICAL_MEASURE_SOURCE_COLUMN,
        "H": "安全系统",
    }
    candidates: list[dict[str, Any]] = []
    for row_number in sorted(rows):
        row = rows[row_number]
        if _normalize_measure_name(row.get("D", {}).get("value")):
            inherited_values["G"] = ""
            inherited_sources.pop("G", None)
            inherited_fills.pop("G", None)
            inherited_values["H"] = ""
            inherited_sources.pop("H", None)
            inherited_fills.pop("H", None)
        for column in ("B", "C", "D", "E", "G", "H"):
            raw_value = row.get(column, {}).get("value")
            normalized = _normalize_measure_name(raw_value)
            if normalized:
                inherited_values[column] = raw_value
                inherited_sources[column] = _source_payload(
                    row_number,
                    source_columns[column],
                    row.get(column, {}).get("cell"),
                    raw_value,
                )
                inherited_fills[column] = row.get(column, {}).get("fill", {})

        if not inherited_values["B"] or not inherited_values["D"]:
            continue
        measure_cell = row.get("G", {})
        raw_measure = measure_cell.get("value")
        style = _technical_measure_style(measure_cell.get("fill", {}))
        if is_blank_or_placeholder(raw_measure) and inherited_values["G"]:
            raw_measure = inherited_values["G"]
            style = _technical_measure_style(inherited_fills.get("G", {}))
        if not style and raw_measure and _is_empty_security_system_value(inherited_values.get("H")):
            style = "measure"
        if not style:
            continue
        if is_blank_or_placeholder(raw_measure):
            continue
        for name, was_note_wrapper in _split_measure_names(raw_measure):
            category, status = _measure_category_status(name, style, was_note_wrapper)
            service_cell = row.get("F", {})
            sources = _combine_sources(
                [_source_payload(row_number, TECHNICAL_MEASURE_SOURCE_COLUMN, measure_cell.get("cell") or inherited_sources.get("G", {}).get("cell"), raw_measure)],
                [_source_payload(row_number, "安全技术服务", service_cell.get("cell"), service_cell.get("value"))]
                if service_cell.get("value")
                else None,
                [inherited_sources["E"]] if "E" in inherited_sources else None,
                [inherited_sources["D"]] if "D" in inherited_sources else None,
                limit=20,
            )
            candidates.append(
                {
                    "name": name,
                    "category": category,
                    "status": status,
                    "service_raw": service_cell.get("value"),
                    "scope_raw": _scope_value_with_service_scope(inherited_values["E"], service_cell.get("value")),
                    "sources": sources,
                }
            )
    return candidates


def _security_technical_measure_candidates(conn: sqlite3.Connection) -> list[dict[str, Any]]:
    for path in _latest_xlsx_source_paths(conn):
        candidates = _scene_measure_candidates_from_xlsx(path)
        if candidates:
            return candidates
    return []


def _xlsx_text(value: object) -> str:
    return " ".join(str(value or "").replace("\xa0", " ").split()).strip()


def _data_lifecycle_stage_title(value: object) -> str:
    text = _xlsx_text(value)
    if not text:
        return ""
    return re.sub(r"（[A-Z]{2}）$", "", text).strip()


def _policy_code_and_text(value: object) -> tuple[str, str]:
    text = _xlsx_text(value)
    if not text:
        return "", ""
    match = re.match(r"^([ISNP]\.[A-Z]{2}\.\d{2})\s+(.+)$", text)
    if match:
        return match.group(1), match.group(2).strip()
    return "", text


def _data_policy_source(row_number: int, column_name: str, cell: str | None, raw_value: object) -> dict[str, Any]:
    return {
        "sheet": DATA_LIFECYCLE_POLICY_MAPPING_SHEET,
        "row": row_number,
        "column": column_name,
        "cell": cell,
        "raw_value": None if raw_value is None else str(raw_value),
    }


def _cell_coordinate(cell: Any) -> str | None:
    return getattr(cell, "coordinate", None)


def _data_lifecycle_policy_rows_from_xlsx(
    conn: sqlite3.Connection,
    *,
    technical_services: dict[str, dict[str, Any]],
    technology_modules: dict[str, dict[str, Any]],
    technical_measures: dict[str, dict[str, Any]],
    refs: dict[str, list[dict[str, Any]]],
) -> dict[str, list[dict[str, Any]]]:
    service_by_code = {item.get("code"): item for item in technical_services.values() if item.get("code")}
    module_by_title = {item.get("title"): item for item in technology_modules.values() if item.get("title")}
    measure_by_title = {item.get("title"): item for item in technical_measures.values() if item.get("title")}
    level_columns = (
        {"level": "I", "label": "重要数据", "policy_col": 5, "ref_col": 6, "policy_header": "重要数据安全策略", "ref_header": "参考来源"},
        {"level": "S", "label": "个人敏感数据", "policy_col": 7, "ref_col": 8, "policy_header": "个人敏感数据安全策略", "ref_header": "参考来源"},
        {"level": "N", "label": "非公开数据", "policy_col": 9, "ref_col": 10, "policy_header": "非公开数据安全策略", "ref_header": "参考来源"},
        {"level": "P", "label": "公开数据", "policy_col": 11, "ref_col": 12, "policy_header": "公开数据安全策略", "ref_header": "参考来源"},
    )

    def service_payloads(raw_value: object) -> list[dict[str, Any]]:
        payloads: list[dict[str, Any]] = []
        for value in split_multivalue_text(raw_value):
            parts = service_parts(value)
            item = service_by_code.get(parts.get("code") or "")
            if item:
                payloads.append(_item_payload(item, refs))
            elif parts.get("code") or parts.get("title"):
                payloads.append(
                    {
                        "id": f"security_technical_service:policy:{parts.get('code') or parts.get('title')}",
                        "type": "security_technical_service",
                        "code": parts.get("code"),
                        "title": parts.get("title") or parts.get("code"),
                        "description": None,
                        "category": None,
                        "status": "derived",
                        "metadata": {},
                        "sources": [],
                    }
                )
        return payloads

    def module_or_measure_payloads(raw_value: object) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
        modules: list[dict[str, Any]] = []
        measures: list[dict[str, Any]] = []
        for title in split_multivalue_text(raw_value):
            if title == "\\":
                continue
            measure = measure_by_title.get(title)
            if measure:
                payload = _canonical_security_technical_measure_payload(measure, refs)
                payload["objectKind"] = "安全技术措施"
                measures.append(payload)
                continue
            module = module_by_title.get(title)
            if not module:
                candidates = [item for item_title, item in module_by_title.items() if item_title and item_title.startswith(title)]
                if len(candidates) == 1:
                    module = candidates[0]
            if module:
                payload = _item_payload(module, refs)
                payload["objectKind"] = "安全技术模块"
                modules.append(payload)
                continue
            modules.append(
                {
                    "id": f"security_technology_module:policy:{title}",
                    "type": "security_technology_module",
                    "code": None,
                    "title": title,
                    "description": None,
                    "category": None,
                    "status": "derived",
                    "metadata": {},
                    "sources": [],
                    "objectKind": "安全技术模块",
                }
            )
        return modules, measures

    load_workbook = _load_openpyxl()
    for path in _latest_xlsx_source_paths(conn):
        if not path.exists():
            continue
        workbook = load_workbook(path, read_only=True, data_only=True)
        try:
            if DATA_LIFECYCLE_POLICY_MAPPING_SHEET not in workbook.sheetnames:
                continue
            worksheet = workbook[DATA_LIFECYCLE_POLICY_MAPPING_SHEET]
            rows_by_stage: dict[str, list[dict[str, Any]]] = {}
            last_stage = ""
            last_category = ""
            for row_number, row in enumerate(worksheet.iter_rows(min_row=4), start=4):
                raw_stage = row[1].value if len(row) > 1 else None
                stage = _data_lifecycle_stage_title(raw_stage) or last_stage
                if stage:
                    last_stage = stage
                if not stage:
                    continue
                raw_category = row[2].value if len(row) > 2 else None
                category = _xlsx_text(raw_category) or last_category
                if category:
                    last_category = category
                sequence = _xlsx_text(row[3].value if len(row) > 3 else None)
                service_raw = row[12].value if len(row) > 12 else None
                module_raw = row[13].value if len(row) > 13 else None
                policies: list[dict[str, Any]] = []
                for level in level_columns:
                    policy_cell = row[level["policy_col"] - 1]
                    reference_cell = row[level["ref_col"] - 1]
                    code, text = _policy_code_and_text(policy_cell.value)
                    reference = _xlsx_text(reference_cell.value)
                    policies.append(
                        {
                            "level": level["level"],
                            "label": level["label"],
                            "code": code,
                            "text": text,
                            "reference": reference,
                            "status": "not_applicable" if text == "不涉及" else "applicable",
                            "sources": [
                                _data_policy_source(row_number, level["policy_header"], _cell_coordinate(policy_cell), policy_cell.value),
                                _data_policy_source(row_number, level["ref_header"], _cell_coordinate(reference_cell), reference_cell.value),
                            ],
                        }
                    )
                services = service_payloads(service_raw)
                modules, measures = module_or_measure_payloads(module_raw)
                if not any(policy.get("text") for policy in policies) and not services and not modules and not measures:
                    continue
                rows_by_stage.setdefault(stage, []).append(
                    {
                        "id": f"data-policy:{stage}:{row_number}",
                        "stage": stage,
                        "category": category,
                        "sequence": sequence,
                        "policies": policies,
                        "technical_services": services,
                        "technology_modules": modules,
                        "technical_measures": measures,
                        "module_or_measure_items": modules + measures,
                        "sources": [
                            _data_policy_source(row_number, "阶段", _cell_coordinate(row[1]) if len(row) > 1 else None, raw_stage),
                            _data_policy_source(row_number, "类别", _cell_coordinate(row[2]) if len(row) > 2 else None, raw_category),
                            _data_policy_source(row_number, "安全技术服务", _cell_coordinate(row[12]) if len(row) > 12 else None, service_raw),
                            _data_policy_source(row_number, "安全技术模块", _cell_coordinate(row[13]) if len(row) > 13 else None, module_raw),
                        ],
                    }
                )
            return rows_by_stage
        finally:
            workbook.close()
    return {}


def _scope_catalog_rows_from_xlsx(conn: sqlite3.Connection) -> list[dict[str, Any]]:
    sheet_name = "安全能力作用域目录"
    load_workbook = _load_openpyxl()
    for path in _latest_xlsx_source_paths(conn):
        if not path.exists():
            continue
        workbook = load_workbook(path, read_only=True, data_only=True)
        try:
            if sheet_name not in workbook.sheetnames:
                continue
            worksheet = workbook[sheet_name]
            scenario = ""
            rows: list[dict[str, Any]] = []
            for row_index, row in enumerate(worksheet.iter_rows(min_row=3), start=3):
                raw_scenario = row[1].value
                if str(raw_scenario or "").strip():
                    scenario = " ".join(str(raw_scenario).replace("\xa0", " ").split()).strip()
                raw_scope = row[2].value
                code, title = _split_catalog_code_title(raw_scope)
                if not code and not title:
                    continue
                description = " ".join(str(row[3].value or "").replace("\xa0", " ").split()).strip()
                rows.append(
                    {
                        "row": row_index,
                        "code": code,
                        "title": title,
                        "description": description,
                        "scenario": scenario,
                        "source": {
                            "sheet": sheet_name,
                            "row": row_index,
                            "column": "作用域类型",
                            "cell": row[2].coordinate,
                            "raw_value": "" if raw_scope is None else str(raw_scope),
                        },
                    }
                )
            if rows:
                return rows
        finally:
            workbook.close()
    return []


def _stable_measure_id(name: str, category: str | None) -> str:
    digest = hashlib.sha1(f"{name}\0{category or ''}".encode("utf-8")).hexdigest()[:16]
    return f"security_technical_measure:{digest}"


def _canonical_security_technical_measure_id(item: dict[str, Any]) -> str:
    name = _normalize_measure_name(item.get("title"))
    if not name:
        return item.get("id") or ""
    metadata = _metadata(item)
    category = item.get("category") or metadata.get("category") or None
    return _stable_measure_id(name, category)


def _canonical_security_technical_measure_payload(
    item: dict[str, Any],
    refs: dict[str, list[dict[str, Any]]],
) -> dict[str, Any]:
    payload = _item_payload(item, refs)
    canonical_id = _canonical_security_technical_measure_id(item)
    if canonical_id:
        payload["id"] = canonical_id
    return payload


def _build_security_technical_measures(
    conn: sqlite3.Connection,
    items: dict[str, dict[str, Any]],
    refs: dict[str, list[dict[str, Any]]],
) -> list[dict[str, Any]]:
    technical_services = {item_id: item for item_id, item in items.items() if item["type"] == "security_technical_service"}
    technical_measure_items = {
        item_id: item for item_id, item in items.items() if item["type"] == "security_technical_measure"
    }
    scopes = {item_id: item for item_id, item in items.items() if item["type"] == "scope_type"}
    focuses = {item_id: item for item_id, item in items.items() if item["type"] == "capability_focus"}
    service_by_code = {item["code"]: item_id for item_id, item in technical_services.items() if item.get("code")}
    service_by_title = {_normalize_measure_name(item["title"]): item_id for item_id, item in technical_services.items()}
    scope_by_code = {item["code"]: item_id for item_id, item in scopes.items() if item.get("code")}
    scope_by_title = {_normalize_measure_name(item["title"]): item_id for item_id, item in scopes.items()}
    focus_by_code = {item["code"]: item_id for item_id, item in focuses.items() if item.get("code")}

    def measure_source_label(sources: list[dict[str, Any]]) -> tuple[str, str]:
        source_sheets = {source.get("sheet") for source in sources}
        if "作用域-安全技术服务-安全技术模块映射" in source_sheets:
            return "安全知识措施映射表", "scope_service_module_mapping"
        if any(str(sheet or "").startswith("LC-AP") for sheet in source_sheets):
            return "LC-AP 生命周期措施", "lifecycle_application"
        if any(str(sheet or "").startswith("LC-DT") for sheet in source_sheets):
            return "LC-DT 生命周期措施", "lifecycle_data"
        return "待复核来源", "pending_review"

    grouped: dict[tuple[str, str | None], dict[str, Any]] = {}
    for candidate in _security_technical_measure_candidates(conn):
        key = (candidate["name"], candidate["category"])
        entry = grouped.setdefault(
            key,
            {
                "name": candidate["name"],
                "category": candidate["category"],
                "statuses": set(),
                "service_ids": set(),
                "service_names": set(),
                "scope_ids": set(),
                "scope_names": set(),
                "focus_ids": set(),
                "focus_names": set(),
                "confirmed_measure_ids": set(),
                "sources": [],
                "source_labels": set(),
                "source_kinds": set(),
            },
        )
        entry["statuses"].add(candidate["status"])
        entry["sources"] = _combine_sources(entry["sources"], candidate["sources"], limit=50)
        label, kind = measure_source_label(candidate["sources"])
        entry["source_labels"].add(label)
        entry["source_kinds"].add(kind)

        parts = service_parts(candidate.get("service_raw"))
        service_id = service_by_code.get(parts.get("code") or "") or service_by_title.get(_normalize_measure_name(parts.get("title")))
        if service_id:
            entry["service_ids"].add(service_id)
            entry["service_names"].add(technical_services[service_id]["title"])
        elif parts.get("title"):
            entry["service_names"].add(_normalize_measure_name(parts.get("title")))

        focus_id = focus_by_code.get(parts.get("capability_focus_code") or "")
        if focus_id:
            entry["focus_ids"].add(focus_id)
            entry["focus_names"].add(focuses[focus_id]["title"])

        for scope_code, scope_title in split_scope_values(candidate.get("scope_raw")):
            scope_id = scope_by_code.get(scope_code or "") or scope_by_title.get(_normalize_measure_name(scope_title))
            if scope_id:
                entry["scope_ids"].add(scope_id)
                entry["scope_names"].add(scopes[scope_id]["title"])
            elif scope_title or scope_code:
                entry["scope_names"].add(_normalize_measure_name(scope_title or scope_code))

    for measure_id, measure in technical_measure_items.items():
        name = _normalize_measure_name(measure.get("title"))
        if not name or is_blank_or_placeholder(name):
            continue
        metadata = _metadata(measure)
        category = measure.get("category") or metadata.get("category") or None
        key = (name, category)
        entry = grouped.setdefault(
            key,
            {
                "name": name,
                "category": category,
                "statuses": set(),
                "service_ids": set(),
                "service_names": set(),
                "scope_ids": set(),
                "scope_names": set(),
                "focus_ids": set(),
                "focus_names": set(),
                "confirmed_measure_ids": set(),
                "sources": [],
                "source_labels": set(),
                "source_kinds": set(),
            },
        )
        entry["statuses"].add("normal")
        entry["confirmed_measure_ids"].add(measure_id)
        entry["sources"] = _combine_sources(entry["sources"], refs.get(measure_id, []), limit=50)
        label, kind = measure_source_label(refs.get(measure_id, []))
        entry["source_labels"].add(label)
        entry["source_kinds"].add(kind)

    payloads = []
    for (name, category), entry in grouped.items():
        service_ids = _sort_source_ids(technical_services, list(entry["service_ids"]))
        scope_ids = _sort_source_ids(scopes, list(entry["scope_ids"]))
        focus_ids = _sort_source_ids(focuses, list(entry["focus_ids"]))
        confirmed_measure_ids = _sort_source_ids(technical_measure_items, list(entry["confirmed_measure_ids"]))
        service_names = [technical_services[item_id]["title"] for item_id in service_ids]
        service_names.extend(sorted(set(entry["service_names"]) - set(service_names)))
        scope_names = [scopes[item_id]["title"] for item_id in scope_ids]
        scope_names.extend(sorted(set(entry["scope_names"]) - set(scope_names)))
        focus_names = [focuses[item_id]["title"] for item_id in focus_ids]
        focus_names.extend(sorted(set(entry["focus_names"]) - set(focus_names)))
        status = (
            "pending"
            if "pending" in entry["statuses"] or (not confirmed_measure_ids and (not service_names or not scope_names))
            else "normal"
        )
        if not service_names or not scope_names:
            status = "pending"
        source_labels = sorted(entry["source_labels"]) or ["待复核来源"]
        source_kinds = sorted(entry["source_kinds"]) or ["pending_review"]
        payloads.append(
            {
                "id": _stable_measure_id(name, category),
                "name": name,
                "category": category,
                "source_label": " / ".join(source_labels),
                "source_kind": " / ".join(source_kinds),
                "mapping_status_label": "待补充关联安全技术服务或作用域" if status == "pending" else "正常",
                "related_service_ids": service_ids,
                "related_service_names": service_names,
                "related_services": _brief_many(technical_services, service_ids, refs),
                "related_module_ids": [],
                "related_module_names": [],
                "related_modules": [],
                "related_scope_ids": scope_ids,
                "related_scope_names": scope_names,
                "applicable_scopes": _brief_many(scopes, scope_ids, refs),
                "related_capability_focus_ids": focus_ids,
                "related_capability_focus_names": focus_names,
                "related_focuses": _brief_many(focuses, focus_ids, refs),
                "related_focus_count": len(focus_ids),
                "status": status,
                "sources": entry["sources"],
            }
        )

    def first_measure_source_row(item: dict[str, Any]) -> int:
        rows = [
            source.get("row") or 10**9
            for source in item["sources"]
            if source.get("column") == TECHNICAL_MEASURE_SOURCE_COLUMN
        ]
        return min(rows, default=10**9)

    return sorted(
        payloads,
        key=lambda item: (
            first_measure_source_row(item),
            item["category"] or "",
            item["name"],
        ),
    )


def export_management_knowledge(
    conn: sqlite3.Connection,
    *,
    output_path: str | Path,
) -> dict[str, Any]:
    """Export second-batch management knowledge for the local frontend."""

    output = resolve_project_path(output_path)
    output.parent.mkdir(parents=True, exist_ok=True)

    items = _active_items(conn, SOURCE_PAGE_ITEM_TYPES)
    refs = _source_reference_map(conn, "item")
    relations = _relation_rows(conn, SOURCE_PAGE_RELATION_TYPES)
    relation_refs = _source_reference_map(conn, "relation")

    layers = {item_id: item for item_id, item in items.items() if item["type"] == "work_function_layer"}
    groups = {item_id: item for item_id, item in items.items() if item["type"] == "work_function_group"}
    functions = {item_id: item for item_id, item in items.items() if item["type"] == "work_function"}
    tasks = {item_id: item for item_id, item in items.items() if item["type"] == "work_task"}
    gbt_refs = {item_id: item for item_id, item in items.items() if item["type"] == "gbt_42446_task_reference"}
    gartner_roles = {item_id: item for item_id, item in items.items() if item["type"] == "work_role_reference"}
    process_domains = {item_id: item for item_id, item in items.items() if item["type"] == "process_domain"}
    process_groups = {item_id: item for item_id, item in items.items() if item["type"] == "process_group"}
    process_references = {item_id: item for item_id, item in items.items() if item["type"] == "process_reference"}
    process_activities = {item_id: item for item_id, item in items.items() if item["type"] == "process_activity"}
    scope_types = {item_id: item for item_id, item in items.items() if item["type"] == "scope_type"}
    technical_services = {item_id: item for item_id, item in items.items() if item["type"] == "security_technical_service"}
    technology_modules = {item_id: item for item_id, item in items.items() if item["type"] == "security_technology_module"}
    security_systems = {item_id: item for item_id, item in items.items() if item["type"] == "security_system"}
    products = {item_id: item for item_id, item in items.items() if item["type"] == "product"}
    information_environments = {item_id: item for item_id, item in items.items() if item["type"] == "information_environment"}
    environment_segments = {item_id: item for item_id, item in items.items() if item["type"] == "environment_segment"}
    information_objects = {item_id: item for item_id, item in items.items() if item["type"] == "information_object"}

    coded_function_titles = {
        (item["title"], _metadata(item).get("work_function_layer") or _metadata(item).get("stakeholder_layer"))
        for item in functions.values()
        if item.get("code")
    }
    functions = {
        item_id: item
        for item_id, item in functions.items()
        if item.get("code")
        or (item["title"], _metadata(item).get("work_function_layer") or _metadata(item).get("stakeholder_layer")) not in coded_function_titles
    }

    group_to_layer: dict[str, str] = {}
    function_to_layer: dict[str, str] = {}
    function_to_group: dict[str, str] = {}
    tasks_by_function: dict[str, list[str]] = {}
    gbt_by_function: dict[str, list[str]] = {}
    process_group_to_domain: dict[str, str] = {}
    process_reference_to_group: dict[str, str] = {}
    activities_by_process_reference: dict[str, list[str]] = {}
    stakeholders_by_process: dict[str, list[str]] = {}
    segment_to_environment: dict[str, str] = {}
    object_to_segments: dict[str, list[str]] = {}
    services_by_scope: dict[str, list[str]] = {}
    objects_by_scope: dict[str, list[str]] = {}
    objects_by_environment: dict[str, list[str]] = {}
    scopes_by_object: dict[str, list[str]] = {}
    services_by_object: dict[str, list[str]] = {}
    scopes_by_service: dict[str, list[str]] = {}
    services_by_module: dict[str, list[str]] = {}
    modules_by_service: dict[str, list[str]] = {}
    systems_by_module: dict[str, list[str]] = {}
    products_by_module: dict[str, list[str]] = {}
    environments_by_module: dict[str, list[str]] = {}
    relation_sources_by_key: dict[tuple[str, str, str], list[dict[str, Any]]] = {}

    for relation in relations:
        source_id = relation["source_item_id"]
        target_id = relation["target_item_id"]
        relation_type = relation["relation_type"]
        source_type = relation["source_type"]
        target_type = relation["target_type"]
        relation_sources_by_key.setdefault((source_id, relation_type, target_id), [])
        relation_sources_by_key[(source_id, relation_type, target_id)].extend(relation_refs.get(relation["id"], []))
        if relation_type == "belongs_to_layer" and target_type == "work_function_layer":
            if source_type == "work_function_group":
                group_to_layer[source_id] = target_id
            elif source_type == "work_function":
                function_to_layer[source_id] = target_id
        elif relation_type in {"belongs_to", "belongs_to_group"} and source_type == "work_function" and target_type == "work_function_group":
            function_to_group[source_id] = target_id
        elif relation_type == "performs_task" and source_type == "work_function" and target_type == "work_task":
            tasks_by_function.setdefault(source_id, []).append(target_id)
        elif relation_type == "maps_to_gbt_task" and source_type == "work_function" and target_type == "gbt_42446_task_reference":
            gbt_by_function.setdefault(source_id, []).append(target_id)
        elif relation_type == "belongs_to" and source_type == "process_group" and target_type == "process_domain":
            process_group_to_domain[source_id] = target_id
        elif relation_type == "belongs_to" and source_type == "process_reference" and target_type == "process_group":
            process_reference_to_group[source_id] = target_id
        elif relation_type == "has_activity" and source_type == "process_reference" and target_type == "process_activity":
            activities_by_process_reference.setdefault(source_id, []).append(target_id)
        elif relation_type == "stakeholder_by" and source_type == "process_reference" and target_type == "work_function":
            stakeholders_by_process.setdefault(source_id, []).append(target_id)
        elif relation_type == "belongs_to" and source_type == "environment_segment" and target_type == "information_environment":
            segment_to_environment[source_id] = target_id
        elif relation_type == "belongs_to" and source_type == "information_object":
            if target_type == "information_environment":
                objects_by_environment.setdefault(target_id, []).append(source_id)
            elif target_type == "environment_segment":
                object_to_segments.setdefault(source_id, []).append(target_id)
        elif relation_type == "applies_to_scope" and target_type == "scope_type":
            if source_type == "security_technical_service":
                services_by_scope.setdefault(target_id, []).append(source_id)
                scopes_by_service.setdefault(source_id, []).append(target_id)
            elif source_type == "information_object":
                objects_by_scope.setdefault(target_id, []).append(source_id)
                scopes_by_object.setdefault(source_id, []).append(target_id)
        elif relation_type == "protects_object" and source_type == "security_technical_service" and target_type == "information_object":
            services_by_object.setdefault(target_id, []).append(source_id)
        elif relation_type == "implements_service" and source_type == "security_technology_module" and target_type == "security_technical_service":
            services_by_module.setdefault(source_id, []).append(target_id)
            modules_by_service.setdefault(target_id, []).append(source_id)
        elif relation_type == "part_of_system" and source_type == "security_technology_module" and target_type == "security_system":
            systems_by_module.setdefault(source_id, []).append(target_id)
        elif relation_type == "maps_to_product" and source_type == "security_technology_module" and target_type == "product":
            products_by_module.setdefault(source_id, []).append(target_id)
        elif relation_type == "deployed_in_environment" and source_type == "security_technology_module" and target_type == "information_environment":
            environments_by_module.setdefault(source_id, []).append(target_id)

    layer_by_title = {item["title"]: item_id for item_id, item in layers.items()}
    group_by_layer_title: dict[tuple[str, str], str] = {
        (group_to_layer.get(group_id, ""), group["title"]): group_id
        for group_id, group in groups.items()
    }

    def find_layer_id(item: dict[str, Any]) -> str:
        layer_title = _metadata_value(item, ("layer_title", "function_layer", "职能类"))
        if layer_title:
            for title, layer_id in layer_by_title.items():
                if layer_title == title or layer_title in title or title in layer_title:
                    return layer_id
        return "virtual:layer:未分层"

    def ensure_virtual_layer(layer_id: str) -> dict[str, Any]:
        if layer_id in layers:
            return layers[layer_id]
        return {
            "id": layer_id,
            "type": "work_function_layer",
            "code": None,
            "title": "未分层",
            "description": None,
            "category": None,
            "status": "active",
            "metadata_json": "{}",
        }

    layer_payloads: dict[str, dict[str, Any]] = {}
    group_payloads_by_layer: dict[str, dict[str, dict[str, Any]]] = {}

    def ensure_group(layer_id: str, group_id: str, title: str) -> dict[str, Any]:
        layer_payloads.setdefault(
            layer_id,
            {
                "id": layer_id,
                "title": ensure_virtual_layer(layer_id)["title"],
                "groups": [],
            },
        )
        groups_for_layer = group_payloads_by_layer.setdefault(layer_id, {})
        if group_id not in groups_for_layer:
            groups_for_layer[group_id] = {
                "id": group_id,
                "title": title,
                "functions": [],
            }
        return groups_for_layer[group_id]

    for layer_id, layer in layers.items():
        layer_payloads[layer_id] = {"id": layer_id, "title": layer["title"], "groups": []}
        group_payloads_by_layer.setdefault(layer_id, {})

    for group_id, group in groups.items():
        layer_id = group_to_layer.get(group_id) or find_layer_id(group)
        ensure_group(layer_id, group_id, group["title"])

    for function_id, function in functions.items():
        group_id = function_to_group.get(function_id)
        layer_id = function_to_layer.get(function_id)
        if group_id and group_id in group_to_layer:
            layer_id = group_to_layer[group_id]
        layer_id = layer_id or find_layer_id(function)

        group_title = _metadata_value(function, ("group_title", "function_group", "work_function_group", "职能分组"))
        if not group_id and group_title:
            group_id = group_by_layer_title.get((layer_id, group_title))
        if not group_id:
            group_title = group_title or "未分组"
            group_id = f"virtual:group:{layer_id}:{group_title}"

        group_payload = ensure_group(layer_id, group_id, group_title or groups.get(group_id, {}).get("title", "未分组"))
        function_payload = _brief_item(function, refs) or {}
        function_payload["tasks"] = [
            _brief_item(tasks[task_id], refs)
            for task_id in sorted(set(tasks_by_function.get(function_id, [])), key=lambda item_id: tasks[item_id]["title"])
            if task_id in tasks
        ]
        function_payload["gbt_42446_refs"] = [
            _brief_item(gbt_refs[ref_id], refs)
            for ref_id in sorted(set(gbt_by_function.get(function_id, [])), key=lambda item_id: gbt_refs[item_id]["title"])
            if ref_id in gbt_refs
        ]
        group_payload["functions"].append(function_payload)

    layer_items_for_sort = {**layers, "virtual:layer:未分层": ensure_virtual_layer("virtual:layer:未分层")}
    work_function_source_sheets = ("安全工作职能清单",)

    def work_function_code_order(item: dict[str, Any]) -> tuple[int, int | str]:
        code = item.get("code")
        try:
            return (0, int(code))
        except (TypeError, ValueError):
            return (1, str(code or ""))

    def work_function_source_key(item: dict[str, Any]) -> tuple[Any, ...]:
        return (
            *_source_position_key(refs.get(item.get("id") or ""), work_function_source_sheets),
            item.get("title") or "",
        )

    def work_function_sort_key(item: dict[str, Any]) -> tuple[Any, ...]:
        return (
            *work_function_code_order(item),
            *work_function_source_key(item),
            item.get("code") or "",
            item.get("title") or "",
        )

    def work_function_group_sort_key(group: dict[str, Any]) -> tuple[Any, ...]:
        function_keys = [work_function_source_key(function) for function in group.get("functions", [])]
        if function_keys:
            return (*min(function_keys), group.get("title") or "")
        return (
            *_source_position_key(refs.get(group.get("id") or ""), work_function_source_sheets),
            "",
            group.get("title") or "",
        )

    work_function_layers = []
    for layer_id, layer_payload in sorted(
        layer_payloads.items(),
        key=lambda row: _layer_sort_key(layer_items_for_sort.get(row[0], ensure_virtual_layer(row[0]))),
    ):
        groups_for_layer = list(group_payloads_by_layer.get(layer_id, {}).values())
        for group in groups_for_layer:
            group["functions"] = sorted(group["functions"], key=work_function_sort_key)
        layer_payload["groups"] = sorted(groups_for_layer, key=work_function_group_sort_key)
        work_function_layers.append(layer_payload)

    gbt_42446_references = []
    for item in sorted(
        gbt_refs.values(),
        key=lambda item: (*_source_position_key(refs.get(item.get("id") or ""), ("安全工作职能清单",)), item.get("title") or ""),
    ):
        payload_item = _brief_item(item, refs) or {}
        payload_item["description"] = item.get("description") or _gbt_42446_task_description(item)
        gbt_42446_references.append(payload_item)
    gartner_work_function_candidates = _load_gartner_work_function_candidates()
    gartner_role_payloads = [
        {
            **(_brief_item(item, refs) or {}),
            **gartner_work_function_candidates.get(
                (
                    " ".join((item.get("title") or "").split()).strip(),
                    " ".join(((item.get("category") or _metadata(item).get("role_category") or "")).split()).strip(),
                ),
                {},
            ),
        }
        for item in sorted(
            gartner_roles.values(),
            key=lambda item: (*_source_position_key(refs.get(item.get("id") or ""), ("gartner工作岗位参考",)), item.get("title") or ""),
        )
    ]
    domain_by_title = {item["title"]: item_id for item_id, item in process_domains.items()}
    group_by_title = {item["title"]: item_id for item_id, item in process_groups.items()}
    process_domain_payloads: dict[str, dict[str, Any]] = {}
    process_groups_by_domain: dict[str, dict[str, dict[str, Any]]] = {}
    process_catalog_sheet = "安全职能流程清单（完善L4）"

    def find_process_domain_id(item: dict[str, Any]) -> str:
        domain_title = _metadata_value(item, ("process_domain", "domain_title", "capability_domain"))
        if domain_title:
            for title, domain_id in domain_by_title.items():
                if domain_title == title or domain_title in title or title in domain_title:
                    return domain_id
        return "virtual:process-domain:未分组"

    def ensure_process_domain(domain_id: str) -> dict[str, Any]:
        if domain_id not in process_domain_payloads:
            domain = process_domains.get(domain_id)
            process_domain_payloads[domain_id] = {
                "id": domain_id,
                "code": domain["code"] if domain else None,
                "title": domain["title"] if domain else "未分组",
                "description": domain["description"] if domain else None,
                "category": _metadata(domain).get("process_category") if domain else None,
                "groups": [],
                "sources": refs.get(domain_id, [])[:8],
            }
        process_groups_by_domain.setdefault(domain_id, {})
        return process_domain_payloads[domain_id]

    def ensure_process_group(domain_id: str, group_id: str, group_title: str) -> dict[str, Any]:
        ensure_process_domain(domain_id)
        groups_for_domain = process_groups_by_domain.setdefault(domain_id, {})
        if group_id not in groups_for_domain:
            group = process_groups.get(group_id)
            groups_for_domain[group_id] = {
                "id": group_id,
                "code": group["code"] if group else None,
                "title": group_title,
                "description": group["description"] if group else None,
                "references": [],
                "sources": refs.get(group_id, [])[:8],
            }
        return groups_for_domain[group_id]

    def has_process_catalog_source(item_id: str) -> bool:
        return any(source.get("sheet") == process_catalog_sheet for source in refs.get(item_id, []))

    catalog_process_references = {
        reference_id: reference
        for reference_id, reference in process_references.items()
        if has_process_catalog_source(reference_id)
    }

    for reference_id, reference in sorted(
        catalog_process_references.items(),
        key=lambda row: _source_position_key(refs.get(row[0]), (process_catalog_sheet,)),
    ):
        group_id = process_reference_to_group.get(reference_id)
        if not group_id:
            group_title = _metadata_value(reference, ("process_group", "group_title"))
            if group_title:
                group_id = group_by_title.get(group_title)
        group_title = process_groups.get(group_id, {}).get("title") if group_id else None
        if not group_id:
            group_title = group_title or _metadata_value(reference, ("process_group", "group_title")) or "未分组"
            group_id = f"virtual:process-group:{group_title}"
        domain_id = process_group_to_domain.get(group_id)
        if not domain_id and group_id in process_groups:
            domain_id = find_process_domain_id(process_groups[group_id])
        domain_id = domain_id or find_process_domain_id(reference)
        group_payload = ensure_process_group(domain_id, group_id, group_title or process_groups.get(group_id, {}).get("title", "未分组"))
        reference_payload = _brief_item(reference, refs) or {}
        metadata = _metadata(reference)
        reference_payload["capability_focus_code"] = metadata.get("capability_focus_code")
        reference_payload["activities"] = _brief_many(process_activities, activities_by_process_reference.get(reference_id, []), refs)
        reference_payload["activity_status"] = "available" if reference_payload["activities"] else "missing"
        reference_payload["activity_status_label"] = "已补充" if reference_payload["activities"] else "待补充"
        reference_payload["missing_activity"] = not reference_payload["activities"]
        reference_payload["stakeholders"] = [
            _brief_item(functions[function_id], refs)
            for function_id in sorted(set(stakeholders_by_process.get(reference_id, [])), key=lambda item_id: functions[item_id]["title"] if item_id in functions else "")
            if function_id in functions
        ]
        group_payload["references"].append(reference_payload)

    security_processes = []
    for domain_id, domain_payload in sorted(
        process_domain_payloads.items(),
        key=lambda row: _source_position_key(refs.get(row[0]), (process_catalog_sheet,)),
    ):
        groups_for_domain = list(process_groups_by_domain.get(domain_id, {}).values())
        for group in groups_for_domain:
            group["references"] = sorted(group["references"], key=lambda item: _source_position_key(refs.get(item.get("id") or ""), (process_catalog_sheet,)))
        domain_payload["groups"] = sorted(groups_for_domain, key=lambda item: _source_position_key(refs.get(item.get("id") or ""), (process_catalog_sheet,)))
        security_processes.append(domain_payload)

    def brief_many(source: dict[str, dict[str, Any]], item_ids: list[str]) -> list[dict[str, Any]]:
        return [
            _brief_item(source[item_id], refs) or {}
            for item_id in sorted(set(item_ids), key=lambda value: source[value]["title"] if value in source else "")
            if item_id in source
        ]

    def sort_source_ids(source: dict[str, dict[str, Any]], item_ids: list[str]) -> list[str]:
        return [
            item["id"]
            for item in _sort_item_rows([source[item_id] for item_id in set(item_ids) if item_id in source])
        ]

    def relation_sources(source_id: str, relation_type: str, target_id: str) -> list[dict[str, Any]]:
        return relation_sources_by_key.get((source_id, relation_type, target_id), [])

    def item_sources(item_ids: list[str]) -> list[dict[str, Any]]:
        return _combine_sources(*(refs.get(item_id) for item_id in item_ids))

    def scene_row_sources(source_list: list[dict[str, Any]], rows: set[int]) -> list[dict[str, Any]]:
        return _sources_for_sheet_rows(source_list, SCENE_TECHNICAL_MAPPING_SHEET, rows)

    def scene_rows(source_list: list[dict[str, Any]]) -> set[int]:
        return _source_rows_for_sheet(source_list, SCENE_TECHNICAL_MAPPING_SHEET)

    def scene_module_payloads_for_service(
        service_id: str,
        *,
        environment_id: str,
        service_scene_rows: set[int],
    ) -> list[dict[str, Any]]:
        module_payloads: list[dict[str, Any]] = []
        for module_id in sort_source_ids(technology_modules, modules_by_service.get(service_id, [])):
            if module_id not in technology_modules:
                continue
            module_sources = scene_row_sources(relation_sources(module_id, "implements_service", service_id), service_scene_rows)
            if not module_sources:
                continue
            module_environment_ids = environments_by_module.get(module_id, [])
            if module_environment_ids and environment_id not in module_environment_ids:
                continue
            module_source_rows = scene_rows(module_sources)
            module_payload = _brief_item(technology_modules[module_id], refs) or {}
            module_payload["mapping_sources"] = module_sources
            system_payloads = []
            for system_id in sort_source_ids(security_systems, systems_by_module.get(module_id, [])):
                system_sources = scene_row_sources(relation_sources(module_id, "part_of_system", system_id), module_source_rows)
                if not system_sources:
                    continue
                system_payload = _brief_item(security_systems[system_id], refs) or {}
                system_payload["mapping_sources"] = system_sources
                system_payloads.append(system_payload)
            module_payload["systems"] = system_payloads
            module_payload["products"] = brief_many(products, products_by_module.get(module_id, []))
            module_payloads.append(module_payload)
        return module_payloads

    def scene_measure_payloads_for_service(service_id: str, service_scene_rows: set[int]) -> list[dict[str, Any]]:
        if not service_scene_rows:
            return []
        measure_payloads: list[dict[str, Any]] = []
        for measure in security_technical_measures:
            measure_sources = scene_row_sources(measure.get("sources", []), service_scene_rows)
            if not measure_sources:
                continue
            measure_payload = {
                **measure,
                "type": "security_technical_measure",
                "objectKind": "安全技术措施",
                "kind": "安全技术措施",
                "title": measure.get("title") or measure.get("name"),
                "mapping_sources": measure_sources,
                "sources": measure_sources,
            }
            measure_payloads.append(measure_payload)
        return measure_payloads

    scope_catalog_sheet = "安全能力作用域目录"
    scope_payloads = []
    scope_catalog_rows = _scope_catalog_rows_from_xlsx(conn)
    scope_items_by_code = {item.get("code"): item for item in scope_types.values() if item.get("code")}
    for catalog_row in scope_catalog_rows:
        item = scope_items_by_code.get(catalog_row.get("code") or "")
        if not item:
            continue
        payload_item = _brief_item(item, refs) or {}
        payload_item["code"] = catalog_row.get("code") or payload_item.get("code")
        payload_item["title"] = catalog_row.get("title") or payload_item.get("title")
        payload_item["description"] = catalog_row.get("description") or payload_item.get("description")
        payload_item["category"] = catalog_row.get("scenario") or payload_item.get("category")
        payload_item["sources"] = _combine_sources([catalog_row["source"]], payload_item.get("sources"), limit=8)
        metadata = _metadata(item)
        payload_item["scenario"] = catalog_row.get("scenario") or metadata.get("scenario") or item.get("category")
        payload_item["services"] = brief_many(technical_services, services_by_scope.get(item["id"], []))
        payload_item["information_objects"] = brief_many(information_objects, objects_by_scope.get(item["id"], []))
        scope_payloads.append(payload_item)
    all_scope_item = scope_items_by_code.get("ALL")
    if all_scope_item:
        payload_item = _brief_item(all_scope_item, refs) or {}
        payload_item["code"] = "ALL"
        payload_item["title"] = "全部作用域"
        payload_item["description"] = "虚拟作用域，表示该安全技术服务适用于所有作用域；保留为字典权威值，但不在作用域清单页面显示。"
        payload_item["category"] = "虚拟作用域"
        payload_item["scenario"] = "通用"
        payload_item["display_in_scope_catalog"] = False
        payload_item["authority_only"] = True
        payload_item["services"] = brief_many(technical_services, services_by_scope.get(all_scope_item["id"], []))
        payload_item["information_objects"] = []
        scope_payloads.append(payload_item)

    module_payloads = []
    for item in _sort_item_rows(list(technology_modules.values())):
        payload_item = _brief_item(item, refs) or {}
        payload_item["services"] = brief_many(technical_services, services_by_module.get(item["id"], []))
        payload_item["systems"] = brief_many(security_systems, systems_by_module.get(item["id"], []))
        payload_item["products"] = brief_many(products, products_by_module.get(item["id"], []))
        payload_item["environments"] = brief_many(information_environments, environments_by_module.get(item["id"], []))
        module_payloads.append(payload_item)
    security_technical_services, _service_module_index_by_id = _build_service_module_index(conn)
    security_technical_measures = _build_security_technical_measures(conn, items, refs)

    object_entries_by_environment: dict[str, dict[tuple[str, str, str | None], dict[str, Any]]] = {}

    def add_object_entry(environment_id: str, object_id: str, segment_id: str | None) -> None:
        if environment_id not in information_environments or object_id not in information_objects:
            return
        object_item = information_objects[object_id]
        key = (environment_id, object_item["title"], segment_id)
        entries = object_entries_by_environment.setdefault(environment_id, {})
        entry = entries.setdefault(
            key,
            {
                "primary_id": object_id,
                "object_ids": [],
                "segment_ids": [],
            },
        )
        if object_id not in entry["object_ids"]:
            entry["object_ids"].append(object_id)
        if segment_id and segment_id not in entry["segment_ids"]:
            entry["segment_ids"].append(segment_id)

    for object_id, segment_ids in object_to_segments.items():
        for segment_id in segment_ids:
            add_object_entry(segment_to_environment.get(segment_id, ""), object_id, segment_id)

    for environment_id, object_ids in objects_by_environment.items():
        for object_id in object_ids:
            if object_id not in information_objects:
                continue
            object_title = information_objects[object_id]["title"]
            matching_entries = [
                entry
                for key, entry in object_entries_by_environment.get(environment_id, {}).items()
                if key[1] == object_title
            ]
            if matching_entries:
                for entry in matching_entries:
                    if object_id not in entry["object_ids"]:
                        entry["object_ids"].append(object_id)
                continue
            add_object_entry(environment_id, object_id, None)

    environment_scope_tree = []
    for environment_id in sort_source_ids(information_environments, list(information_environments.keys())):
        environment = information_environments[environment_id]
        environment_payload = _brief_item(environment, refs) or {}
        object_payloads = []
        object_entries = list(object_entries_by_environment.get(environment_id, {}).values())
        object_entries.sort(
            key=lambda entry: (
                information_objects.get(entry["primary_id"], {}).get("title", ""),
                ", ".join(environment_segments.get(segment_id, {}).get("title", "") for segment_id in entry["segment_ids"]),
            )
        )
        for entry in object_entries:
            object_id = entry["primary_id"]
            if object_id not in information_objects:
                continue
            info_object = information_objects[object_id]
            object_payload = _brief_item(info_object, refs) or {}
            object_ids = [item_id for item_id in entry["object_ids"] if item_id in information_objects]
            segment_ids = [item_id for item_id in entry["segment_ids"] if item_id in environment_segments]
            object_payload["sources"] = item_sources(object_ids)
            object_payload["segments"] = brief_many(environment_segments, segment_ids)
            if len(object_ids) > 1:
                object_payload["aliases"] = brief_many(information_objects, object_ids)
            scope_mappings = []
            scope_ids = []
            service_ids_for_object = []
            for current_object_id in object_ids:
                scope_ids.extend(scopes_by_object.get(current_object_id, []))
                service_ids_for_object.extend(services_by_object.get(current_object_id, []))
            for scope_id in sort_source_ids(scope_types, scope_ids):
                if scope_id not in scope_types:
                    continue
                scoped_service_ids = [
                    service_id
                    for service_id in service_ids_for_object
                    if scope_id in scopes_by_service.get(service_id, [])
                ]
                service_payloads = []
                for service_id in sort_source_ids(technical_services, scoped_service_ids):
                    if service_id not in technical_services:
                        continue
                    service_payload = _brief_item(technical_services[service_id], refs) or {}
                    service_object_sources = _combine_sources(
                        *(
                            relation_sources(service_id, "protects_object", current_object_id)
                            for current_object_id in object_ids
                        ),
                    )
                    service_scope_sources = relation_sources(service_id, "applies_to_scope", scope_id)
                    service_payload["mapping_sources"] = _combine_sources(service_object_sources, service_scope_sources)
                    object_service_rows = scene_rows(service_object_sources)
                    scope_service_rows = scene_rows(service_scope_sources)
                    service_scene_rows = object_service_rows.intersection(scope_service_rows) if object_service_rows and scope_service_rows else object_service_rows or scope_service_rows
                    module_payloads_for_service = scene_module_payloads_for_service(
                        service_id,
                        environment_id=environment_id,
                        service_scene_rows=service_scene_rows,
                    )
                    measure_payloads_for_service = scene_measure_payloads_for_service(service_id, service_scene_rows)
                    service_payload["modules"] = module_payloads_for_service
                    service_payload["measures"] = measure_payloads_for_service
                    service_payload["module_count"] = len(module_payloads_for_service)
                    service_payload["measure_count"] = len(measure_payloads_for_service)
                    service_payloads.append(service_payload)
                scope_mappings.append(
                    {
                        "scope": _brief_item(scope_types[scope_id], refs),
                        "services": service_payloads,
                        "service_count": len(service_payloads),
                        "module_count": sum(service["module_count"] for service in service_payloads),
                        "sources": _combine_sources(
                            refs.get(scope_id),
                            *(
                                relation_sources(current_object_id, "applies_to_scope", scope_id)
                                for current_object_id in object_ids
                            ),
                        ),
                    }
                )
            object_payload["scope_mappings"] = scope_mappings
            object_payload["scope_count"] = len(scope_mappings)
            object_payload["service_count"] = sum(mapping["service_count"] for mapping in scope_mappings)
            object_payload["module_count"] = sum(mapping["module_count"] for mapping in scope_mappings)
            object_payloads.append(object_payload)
        environment_payload["objects"] = object_payloads
        environment_payload["object_count"] = len(object_payloads)
        environment_payload["scope_mapping_count"] = sum(item["scope_count"] for item in object_payloads)
        environment_payload["service_count"] = sum(item["service_count"] for item in object_payloads)
        environment_payload["module_count"] = sum(item["module_count"] for item in object_payloads)
        environment_scope_tree.append(environment_payload)

    payload = {
        "generated_at": conn.execute("SELECT datetime('now') AS now").fetchone()["now"],
        "stats": {
            "work_function_layers": len(work_function_layers),
            "work_functions": len(functions),
            "process_domains": len(security_processes),
            "process_groups": sum(len(domain.get("groups", [])) for domain in security_processes),
            "process_references": sum(len(group.get("references", [])) for domain in security_processes for group in domain.get("groups", [])),
            "process_activity_missing": sum(
                1
                for domain in security_processes
                for group in domain.get("groups", [])
                for reference in group.get("references", [])
                if not reference.get("activities")
            ),
            "gbt_42446_references": len(gbt_42446_references),
            "gartner_roles": len(gartner_role_payloads),
            "scope_types": len(scope_payloads),
            "security_technical_services": len(security_technical_services),
            "security_technology_modules": len(module_payloads),
            "security_technical_measures": len(security_technical_measures),
            "information_environments": len(environment_scope_tree),
            "information_objects": sum(len(environment["objects"]) for environment in environment_scope_tree),
            "environment_scope_mappings": sum(environment["scope_mapping_count"] for environment in environment_scope_tree),
            "environment_service_mappings": sum(environment["service_count"] for environment in environment_scope_tree),
            "environment_module_mappings": sum(environment["module_count"] for environment in environment_scope_tree),
        },
        "work_function_layers": work_function_layers,
        "security_processes": security_processes,
        "gbt_42446_references": gbt_42446_references,
        "gartner_roles": gartner_role_payloads,
        "scope_types": scope_payloads,
        "security_technical_services": security_technical_services,
        "security_technology_modules": module_payloads,
        "security_technical_measures": security_technical_measures,
        "environment_scope_tree": environment_scope_tree,
    }
    _write_json(output, payload)
    return {"count": len(work_function_layers), "files": [str(output)], "stats": payload["stats"]}


def export_maintenance_knowledge(
    conn: sqlite3.Connection,
    *,
    output_path: str | Path,
) -> dict[str, Any]:
    """Export page-level maintenance knowledge for the local frontend."""

    output = resolve_project_path(output_path)
    output.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory() as tmp_dir:
        temp_output = Path(tmp_dir) / "management-knowledge.json"
        export_management_knowledge(conn, output_path=temp_output)
        management_payload = json.loads(temp_output.read_text(encoding="utf-8"))
    payload = _maintenance_knowledge_payload(management_payload)
    _write_json(output, payload)
    split_files = _write_maintenance_split_packages(output, payload)
    return {
        "count": sum(len(payload[field]) for field in MAINTENANCE_KNOWLEDGE_FIELDS),
        "files": [str(output), *split_files],
        "stats": payload["stats"],
    }


def export_lifecycle_knowledge(
    conn: sqlite3.Connection,
    *,
    output_path: str | Path,
) -> dict[str, Any]:
    """Export LC-AP and LC-DT lifecycle knowledge for frontend relationship views."""

    output = resolve_project_path(output_path)
    output.parent.mkdir(parents=True, exist_ok=True)

    items = _active_items(conn, LIFECYCLE_ITEM_TYPES)
    refs = _source_reference_map(conn, "item")
    relations = _relation_rows(conn, LIFECYCLE_RELATION_TYPES)
    service_module_index, service_module_by_id = _build_service_module_index(conn)

    lifecycle_processes = {item_id: item for item_id, item in items.items() if item["type"] == "lifecycle_process"}
    lifecycle_activities = {item_id: item for item_id, item in items.items() if item["type"] == "lifecycle_activity"}
    lifecycle_scenes = {item_id: item for item_id, item in items.items() if item["type"] == "lifecycle_scene"}
    security_activities = {item_id: item for item_id, item in items.items() if item["type"] == "security_activity"}
    policy_requirements = {item_id: item for item_id, item in items.items() if item["type"] == "security_policy_requirement"}
    development_types = {item_id: item for item_id, item in items.items() if item["type"] == "software_development_type"}
    application_system_types = {item_id: item for item_id, item in items.items() if item["type"] == "application_system_type"}
    application_components = {item_id: item for item_id, item in items.items() if item["type"] == "application_component"}
    development_technical_services = {item_id: item for item_id, item in items.items() if item["type"] == "development_technical_service"}
    development_technical_modules = {item_id: item for item_id, item in items.items() if item["type"] == "development_technical_module"}
    technical_services = {item_id: item for item_id, item in items.items() if item["type"] == "security_technical_service"}
    technology_modules = {item_id: item for item_id, item in items.items() if item["type"] == "security_technology_module"}
    technical_measures = {item_id: item for item_id, item in items.items() if item["type"] == "security_technical_measure"}
    products = {item_id: item for item_id, item in items.items() if item["type"] == "product"}

    scenes_by_process: dict[str, list[str]] = {}
    main_activities_by_process: dict[str, list[str]] = {}
    services_by_process: dict[str, list[str]] = {}
    modules_by_process: dict[str, list[str]] = {}
    measures_by_process: dict[str, list[str]] = {}
    activities_by_process: dict[str, list[str]] = {}
    policies_by_process: dict[str, list[str]] = {}
    policies_by_activity: dict[str, list[str]] = {}
    development_types_by_process: dict[str, list[str]] = {}
    development_services_by_process: dict[str, list[str]] = {}
    development_modules_by_process: dict[str, list[str]] = {}
    components_by_system_type: dict[str, list[str]] = {}

    for relation in relations:
        source_id = relation["source_item_id"]
        target_id = relation["target_item_id"]
        relation_type = relation["relation_type"]
        source_type = relation["source_type"]
        target_type = relation["target_type"]
        if relation_type == "has_scene" and source_type == "lifecycle_process" and target_type == "lifecycle_scene":
            scenes_by_process.setdefault(source_id, []).append(target_id)
        elif relation_type == "maps_to_lifecycle" and target_type == "lifecycle_process":
            if source_type == "security_technical_service":
                services_by_process.setdefault(target_id, []).append(source_id)
            elif source_type == "security_technology_module":
                modules_by_process.setdefault(target_id, []).append(source_id)
            elif source_type == "security_technical_measure":
                measures_by_process.setdefault(target_id, []).append(source_id)
        elif relation_type == "has_activity" and source_type == "lifecycle_process" and target_type == "security_activity":
            activities_by_process.setdefault(source_id, []).append(target_id)
        elif relation_type == "has_main_activity" and source_type == "lifecycle_process" and target_type == "lifecycle_activity":
            main_activities_by_process.setdefault(source_id, []).append(target_id)
        elif relation_type == "requires_policy" and target_type == "security_policy_requirement":
            if source_type == "lifecycle_process":
                policies_by_process.setdefault(source_id, []).append(target_id)
            elif source_type == "security_activity":
                policies_by_activity.setdefault(source_id, []).append(target_id)
        elif relation_type == "applies_to_development_type" and source_type == "lifecycle_process" and target_type == "software_development_type":
            development_types_by_process.setdefault(source_id, []).append(target_id)
        elif relation_type == "uses_service" and source_type == "lifecycle_process" and target_type == "security_technical_service":
            services_by_process.setdefault(source_id, []).append(target_id)
        elif relation_type == "uses_module" and target_type == "security_technology_module":
            if source_type == "lifecycle_process":
                modules_by_process.setdefault(source_id, []).append(target_id)
        elif relation_type == "uses_measure" and target_type == "security_technical_measure":
            if source_type == "lifecycle_process":
                measures_by_process.setdefault(source_id, []).append(target_id)
        elif relation_type == "uses_development_technical_service" and target_type == "development_technical_service":
            if source_type == "lifecycle_process":
                development_services_by_process.setdefault(source_id, []).append(target_id)
        elif relation_type == "uses_development_technical_module" and target_type == "development_technical_module":
            if source_type == "lifecycle_process":
                development_modules_by_process.setdefault(source_id, []).append(target_id)
        elif relation_type == "uses_product" and source_type == "lifecycle_process" and target_type == "product":
            development_modules_by_process.setdefault(source_id, []).append(target_id)
        elif relation_type == "has_component" and source_type == "application_system_type" and target_type == "application_component":
            components_by_system_type.setdefault(source_id, []).append(target_id)

    def lifecycle_order(item: dict[str, Any]) -> tuple[int, int, str, str]:
        metadata = _metadata(item)
        raw_order = metadata.get("order", metadata.get("display_order"))
        try:
            order = int(float(raw_order))
        except (TypeError, ValueError):
            order = 10**9
        return (0 if order < 10**9 else 1, order, item.get("code") or "", item["title"])

    def sort_lifecycle_items(source: dict[str, dict[str, Any]], item_ids: list[str]) -> list[str]:
        return [
            item["id"]
            for item in sorted(
                [source[item_id] for item_id in set(item_ids) if item_id in source],
                key=lifecycle_order,
            )
        ]

    def detailed_item(item: dict[str, Any] | None) -> dict[str, Any] | None:
        if not item:
            return None
        return _item_payload(item, refs)

    def service_payload(service_id: str) -> dict[str, Any] | None:
        if service_id not in technical_services:
            return None
        payload = detailed_item(technical_services[service_id]) or {}
        payload["service_category"] = _metadata(technical_services[service_id]).get("service_category")
        index_entry = service_module_by_id.get(service_id)
        if index_entry:
            payload["modules"] = index_entry.get("modules", [])
            payload["module_count"] = index_entry.get("module_count", 0)
        else:
            payload["modules"] = []
            payload["module_count"] = 0
        return payload

    data_policy_rows_by_stage = _data_lifecycle_policy_rows_from_xlsx(
        conn,
        technical_services=technical_services,
        technology_modules=technology_modules,
        technical_measures=technical_measures,
        refs=refs,
    )

    def lifecycle_process_payload(process_id: str) -> dict[str, Any]:
        process = lifecycle_processes[process_id]
        metadata = _metadata(process)
        lifecycle_type = metadata.get("lifecycle_type")
        payload = detailed_item(process) or {}
        payload["lifecycle_type"] = lifecycle_type
        payload["order"] = metadata.get("order")

        if lifecycle_type == "application_security_development":
            payload["goal"] = metadata.get("goal") or process.get("description")
            payload["original_business_fields"] = metadata.get("original_business_fields") or {}
            main_activity_ids = main_activities_by_process.get(process_id, [])
            if main_activity_ids:
                payload["main_activities"] = [
                    detailed_item(lifecycle_activities[activity_id])
                    for activity_id in sort_lifecycle_items(lifecycle_activities, main_activity_ids)
                    if activity_id in lifecycle_activities
                ]
            else:
                payload["main_activities"] = metadata.get("main_activities") or []
            activity_payloads = []
            policy_ids: list[str] = list(policies_by_process.get(process_id, []))
            for activity_id in sort_lifecycle_items(security_activities, activities_by_process.get(process_id, [])):
                activity_payload = detailed_item(security_activities[activity_id]) or {}
                activity_policy_ids = policies_by_activity.get(activity_id, [])
                policy_ids.extend(activity_policy_ids)
                activity_payload["policy_requirements"] = [
                    detailed_item(policy_requirements[policy_id])
                    for policy_id in sort_lifecycle_items(policy_requirements, activity_policy_ids)
                    if policy_id in policy_requirements
                ]
                activity_payload["policy_count"] = len(activity_payload["policy_requirements"])
                activity_payloads.append(activity_payload)
            payload["security_activities"] = activity_payloads
            payload["policy_requirements"] = [
                detailed_item(policy_requirements[policy_id])
                for policy_id in sort_lifecycle_items(policy_requirements, policy_ids)
                if policy_id in policy_requirements
            ]
            payload["development_types"] = _brief_many(
                development_types,
                development_types_by_process.get(process_id, []),
                refs,
            )
            payload["technical_services"] = [
                service
                for service in (
                    service_payload(service_id)
                    for service_id in sort_lifecycle_items(technical_services, services_by_process.get(process_id, []))
                )
                if service
            ]
            payload["technology_modules"] = [
                detailed_item(technology_modules[module_id])
                for module_id in sort_lifecycle_items(technology_modules, modules_by_process.get(process_id, []))
                if module_id in technology_modules
            ]
            payload["technical_measures"] = [
                _canonical_security_technical_measure_payload(technical_measures[measure_id], refs)
                for measure_id in sort_lifecycle_items(technical_measures, measures_by_process.get(process_id, []))
                if measure_id in technical_measures
            ]
            payload["development_technical_services"] = _brief_many(
                development_technical_services,
                development_services_by_process.get(process_id, []),
                refs,
            )
            payload["development_technical_modules"] = _brief_many(
                development_technical_modules,
                development_modules_by_process.get(process_id, []),
                refs,
            )
            payload["security_activity_count"] = len(payload["security_activities"])
            payload["policy_requirement_count"] = len(payload["policy_requirements"])
            payload["technical_service_count"] = len(payload["technical_services"])
            payload["technology_module_count"] = len(payload["technology_modules"])
            payload["technical_measure_count"] = len(payload["technical_measures"])
            payload["development_technical_service_count"] = len(payload["development_technical_services"])
            payload["development_technical_module_count"] = len(payload["development_technical_modules"])
        else:
            payload["scenes"] = [
                detailed_item(lifecycle_scenes[scene_id])
                for scene_id in sort_lifecycle_items(lifecycle_scenes, scenes_by_process.get(process_id, []))
                if scene_id in lifecycle_scenes
            ]
            payload["technical_services"] = [
                service
                for service in (
                    service_payload(service_id)
                    for service_id in sort_lifecycle_items(technical_services, services_by_process.get(process_id, []))
                )
                if service
            ]
            payload["technology_modules"] = [
                detailed_item(technology_modules[module_id])
                for module_id in sort_lifecycle_items(technology_modules, modules_by_process.get(process_id, []))
                if module_id in technology_modules
            ]
            payload["technical_measures"] = [
                _canonical_security_technical_measure_payload(technical_measures[measure_id], refs)
                for measure_id in sort_lifecycle_items(technical_measures, measures_by_process.get(process_id, []))
                if measure_id in technical_measures
            ]
            payload["data_policy_rows"] = data_policy_rows_by_stage.get(process.get("title"), [])
            payload["scene_count"] = len(payload["scenes"])
            payload["technical_service_count"] = len(payload["technical_services"])
            payload["technology_module_count"] = len(payload["technology_modules"])
            payload["technical_measure_count"] = len(payload["technical_measures"])
            payload["data_policy_row_count"] = len(payload["data_policy_rows"])
        return payload

    application_process_ids = [
        item_id
        for item_id, item in lifecycle_processes.items()
        if _metadata(item).get("lifecycle_type") == "application_security_development"
    ]
    data_process_ids = [
        item_id
        for item_id, item in lifecycle_processes.items()
        if _metadata(item).get("lifecycle_type") == "data"
    ]

    application_element_sheet = "LC-AP 应用安全开发生命周期元素目录"

    def application_element_key(item_id: str) -> tuple[int, int, int, str, str]:
        return _source_position_key(refs.get(item_id), (application_element_sheet,))

    application_system_payloads = []
    for system_type_id in sorted(application_system_types.keys(), key=application_element_key):
        system_payload = detailed_item(application_system_types[system_type_id]) or {}
        component_ids = sorted(
            [component_id for component_id in components_by_system_type.get(system_type_id, []) if component_id in application_components],
            key=application_element_key,
        )
        system_payload["components"] = [
            detailed_item(application_components[component_id]) or {}
            for component_id in component_ids
        ]
        system_payload["component_count"] = len(system_payload["components"])
        application_system_payloads.append(system_payload)

    payload = {
        "generated_at": conn.execute("SELECT datetime('now') AS now").fetchone()["now"],
        "stats": {
            "application_processes": len(application_process_ids),
            "data_processes": len(data_process_ids),
            "lifecycle_activities": len(lifecycle_activities),
            "lifecycle_scenes": len(lifecycle_scenes),
            "security_activities": len(security_activities),
            "policy_requirements": len(policy_requirements),
            "software_development_types": len(development_types),
            "application_system_types": len(application_system_types),
            "application_components": len(application_components),
            "development_technical_services": len(development_technical_services),
            "development_technical_modules": len(development_technical_modules),
            "security_technical_measures": len(technical_measures),
        },
        "application_security_development": {
            "processes": [
                lifecycle_process_payload(process_id)
                for process_id in sort_lifecycle_items(lifecycle_processes, application_process_ids)
            ],
            "software_development_types": [
                detailed_item(development_types[item_id])
                for item_id in _sort_source_ids(development_types, list(development_types.keys()))
            ],
            "development_technical_services": [
                detailed_item(development_technical_services[item_id])
                for item_id in _sort_source_ids(development_technical_services, list(development_technical_services.keys()))
            ],
            "development_technical_modules": [
                detailed_item(development_technical_modules[item_id])
                for item_id in _sort_source_ids(development_technical_modules, list(development_technical_modules.keys()))
            ],
            "security_technical_measures": [
                _canonical_security_technical_measure_payload(technical_measures[item_id], refs)
                for item_id in _sort_source_ids(technical_measures, list(technical_measures.keys()))
            ],
            "application_system_types": application_system_payloads,
        },
        "data_lifecycle": {
            "processes": [
                lifecycle_process_payload(process_id)
                for process_id in sort_lifecycle_items(lifecycle_processes, data_process_ids)
            ],
        },
    }
    _write_json(output, payload)
    return {"count": len(application_process_ids) + len(data_process_ids), "files": [str(output)], "stats": payload["stats"]}


def export_content_views(
    conn: sqlite3.Connection,
    *,
    output_path: str | Path,
) -> dict[str, Any]:
    """Export the first content-view stub for HTML, Draw.io and PPT pages."""

    output = resolve_project_path(output_path)
    output.parent.mkdir(parents=True, exist_ok=True)

    def file_entry(path: Path) -> dict[str, Any]:
        stat = path.stat()
        rel_path = path.relative_to(PROJECT_ROOT).as_posix()
        return {
            "file_name": path.name,
            "source_path": rel_path,
            "source_file_id": None,
            "updated_at": datetime.fromtimestamp(stat.st_mtime).isoformat(timespec="seconds"),
        }

    raw_samples = PROJECT_ROOT / "data" / "raw-samples"
    guide_specs = [
        {
            "guide_id": "security-architecture-design",
            "package_path": PROJECT_ROOT
            / "frontend"
            / "capability-browser"
            / "public"
            / "data"
            / "guides"
            / "security-architecture-design.json",
            "content": "安全技术架构设计方法（V2.0）",
        },
        {
            "guide_id": "data-security-design",
            "package_path": PROJECT_ROOT
            / "frontend"
            / "capability-browser"
            / "public"
            / "data"
            / "guides"
            / "data-security-design.json",
            "content": "面向业务的数据安全专项设计方法（V2.1）",
        },
        {
            "guide_id": "light-planning",
            "package_path": PROJECT_ROOT
            / "frontend"
            / "capability-browser"
            / "public"
            / "data"
            / "guides"
            / "light-planning.json",
            "content": "轻规划设计报告模版（v0.3）",
        },
    ]
    html_documents: list[dict[str, Any]] = []
    diagram_views: list[dict[str, Any]] = []
    guide_pages: list[dict[str, Any]] = []

    if raw_samples.exists():
        for path in sorted(raw_samples.glob("*.drawio")):
            entry = file_entry(path)
            diagram_views.append(
                {
                    "id": f"diagram:{path.stem}",
                    "title": path.stem,
                    "page_index": 0,
                    "view_type": "drawio",
                    "preview_path": None,
                    "drawio_path": entry["source_path"],
                    "vertex_count": None,
                    "edge_count": None,
                    "source_file_id": entry["source_file_id"],
                    "updated_at": entry["updated_at"],
                    "sources": [entry],
                }
            )
        for path in sorted(raw_samples.glob("*.pptx")):
            entry = file_entry(path)
            guide_pages.append(
                {
                    "id": f"guide:{path.stem}",
                    "slide_number": None,
                    "title": path.stem,
                    "content": "",
                    "note": "PPT 页级内容待转换。",
                    "preview_path": None,
                    "media_count": None,
                    "source_file_id": entry["source_file_id"],
                    "updated_at": entry["updated_at"],
                    "sources": [entry],
                }
            )

    for spec in guide_specs:
        package_path = spec["package_path"]
        if not package_path.exists():
            continue
        with package_path.open("r", encoding="utf-8") as handle:
            guide_package = json.load(handle)
        if guide_package.get("data_state") != "ready":
            continue
        guide_id = guide_package.get("guide_id") or spec["guide_id"]
        source = guide_package.get("source") or {}
        source_path = source.get("source_path")
        source_file = resolve_project_path(source_path) if source_path else None
        source_entry = None
        if source_file and source_file.exists():
            source_entry = file_entry(source_file)
            source_entry["source_hash"] = source.get("source_hash")
            source_entry["file_size_bytes"] = source.get("file_size_bytes")
        slides = guide_package.get("slides") or {}
        package_rel_path = package_path.relative_to(PROJECT_ROOT / "frontend" / "capability-browser").as_posix()
        html_documents.append(
            {
                "id": f"guide:{guide_id}",
                "guide_id": guide_id,
                "route": guide_package.get("route") or f"/guides/{guide_id}",
                "title": guide_package.get("title") or guide_id,
                "category": "安全指南",
                "view_type": "slide_deck",
                "content": spec["content"],
                "note": "本地 PDF 生成的幻灯片视图。",
                "data_path": f"./{package_rel_path}",
                "slide_count": slides.get("count"),
                "slide_width": slides.get("width"),
                "slide_height": slides.get("height"),
                "slide_path_pattern": slides.get("path_pattern"),
                "source_path": source_path,
                "source_hash": source.get("source_hash"),
                "updated_at": guide_package.get("generated_at"),
                "sources": [source_entry] if source_entry else [],
            }
        )

    payload = {
        "generated_at": conn.execute("SELECT datetime('now') AS now").fetchone()["now"],
        "stats": {
            "html_documents": len(html_documents),
            "diagram_views": len(diagram_views),
            "guide_pages": len(guide_pages),
        },
        "html_documents": html_documents,
        "diagram_views": diagram_views,
        "guide_pages": guide_pages,
    }
    _write_json(output, payload)
    return {"count": sum(payload["stats"].values()), "files": [str(output)], "stats": payload["stats"]}


FRONTEND_DATA_DIR = PROJECT_ROOT / "frontend" / "capability-browser" / "public" / "data"
WORKBENCH_TOP_LEVEL_KEYS = (
    "meta",
    "page",
    "navigator",
    "overview",
    "relationshipGroups",
    "objects",
    "relations",
    "evidenceRefs",
    "compatibility",
)


def _frontend_data_path(file_name: str) -> Path:
    return FRONTEND_DATA_DIR / file_name


def _read_frontend_json(file_name: str) -> dict[str, Any]:
    path = _frontend_data_path(file_name)
    if not path.exists():
        return {"generated_at": None, "stats": {}, "__data_state": "missing_file"}
    data = json.loads(path.read_text(encoding="utf-8"))
    return data if isinstance(data, dict) else {"generated_at": None, "items": data}


def _wb_list(value: Any) -> list[Any]:
    return value if isinstance(value, list) else []


def _wb_text(value: Any) -> str:
    return "" if value is None else str(value)


def _wb_title(value: Any, fallback: str = "未命名") -> str:
    if isinstance(value, dict):
        return _wb_text(value.get("title") or value.get("name") or value.get("code") or value.get("id") or fallback)
    return _wb_text(value or fallback)


def _wb_key(value: Any) -> str:
    if isinstance(value, dict):
        return _wb_text(value.get("id") or value.get("code") or value.get("title") or value.get("name")).strip()
    return _wb_text(value).strip()


def _wb_source_ref(source: dict[str, Any]) -> str:
    digest = hashlib.sha1(json.dumps(source, ensure_ascii=False, sort_keys=True).encode("utf-8")).hexdigest()[:16]
    return f"evidence:{digest}"


def _wb_collect_evidence(evidence_refs: dict[str, dict[str, Any]], *items: Any) -> list[str]:
    refs: list[str] = []
    for item in items:
        if not isinstance(item, dict):
            continue
        for source in [*_wb_list(item.get("sources")), *_wb_list(item.get("mapping_sources"))]:
            if not isinstance(source, dict):
                continue
            ref_id = _wb_source_ref(source)
            if ref_id not in evidence_refs:
                evidence_refs[ref_id] = {
                    "id": ref_id,
                    "kind": "source_reference",
                    "status": "available_in_legacy_source_package",
                }
            refs.append(ref_id)
    return sorted(set(refs))


def _wb_compact_object(
    item: Any,
    object_type: str,
    evidence_refs: dict[str, dict[str, Any]],
    *,
    fallback_name: str = "未命名",
    extra: dict[str, Any] | None = None,
) -> dict[str, Any]:
    source = item if isinstance(item, dict) else {"title": item}
    object_id = _wb_key(source) or f"{object_type}:{hashlib.sha1(_wb_title(source, fallback_name).encode('utf-8')).hexdigest()[:12]}"
    payload = {
        "id": object_id,
        "type": object_type,
        "code": _wb_text(source.get("code")).strip(),
        "name": _wb_title(source, fallback_name),
        "title": _wb_title(source, fallback_name),
        "description": _wb_text(source.get("description") or source.get("summary")).strip(),
        "category": _wb_text(source.get("category") or source.get("kind")).strip(),
        "status": _wb_text(source.get("status") or source.get("state")).strip(),
        "evidenceRefs": _wb_collect_evidence(evidence_refs, source),
    }
    if extra:
        payload.update({key: value for key, value in extra.items() if value is not None})
    return payload


def _wb_add_object(
    objects: dict[str, dict[str, dict[str, Any]]],
    evidence_refs: dict[str, dict[str, Any]],
    item: Any,
    object_type: str,
    *,
    fallback_name: str = "未命名",
    extra: dict[str, Any] | None = None,
) -> dict[str, Any]:
    payload = _wb_compact_object(item, object_type, evidence_refs, fallback_name=fallback_name, extra=extra)
    objects.setdefault(object_type, {})
    existing = objects[object_type].get(payload["id"])
    if existing:
        existing["evidenceRefs"] = sorted(set(_wb_list(existing.get("evidenceRefs")) + _wb_list(payload.get("evidenceRefs"))))
        for key, value in payload.items():
            if key not in existing or existing[key] in ("", None) or existing[key] == []:
                existing[key] = value
        return existing
    objects[object_type][payload["id"]] = payload
    return payload


def _wb_add_relation(
    relations: list[dict[str, Any]],
    seen: set[tuple[str, str, str]],
    relation_type: str,
    source: dict[str, Any] | None,
    target: dict[str, Any] | None,
    *,
    label: str = "",
    evidence_refs: list[str] | None = None,
    status: str = "active",
    confidence: str = "explicit",
) -> dict[str, Any] | None:
    if not source or not target:
        return None
    source_id = source.get("id")
    target_id = target.get("id")
    if not source_id or not target_id:
        return None
    key = (source_id, relation_type, target_id)
    if key in seen:
        return None
    seen.add(key)
    relation_id = hashlib.sha1("\0".join(key).encode("utf-8")).hexdigest()[:16]
    relation = {
        "id": f"relation:{relation_id}",
        "type": relation_type,
        "sourceId": source_id,
        "sourceType": source.get("type"),
        "targetId": target_id,
        "targetType": target.get("type"),
        "label": label,
        "status": status,
        "confidence": confidence,
        "evidenceRefs": sorted(set(evidence_refs or [])),
    }
    relations.append(relation)
    return relation


def _wb_group(
    group_id: str,
    title: str,
    relation_types: list[str],
    relations: list[dict[str, Any]],
    *,
    description: str = "",
) -> dict[str, Any]:
    relation_ids = [
        relation["id"]
        for relation in relations
        if relation.get("type") in relation_types
    ]
    return {
        "id": group_id,
        "title": title,
        "description": description,
        "relationTypes": relation_types,
        "relationIds": relation_ids,
        "count": len(relation_ids),
    }


def _wb_stats(objects: dict[str, dict[str, Any]], relations: list[dict[str, Any]], evidence_refs: dict[str, Any]) -> dict[str, int]:
    stats = {object_type: len(rows) for object_type, rows in objects.items()}
    stats["objects"] = sum(stats.values())
    stats["relations"] = len(relations)
    stats["evidenceRefs"] = len(evidence_refs)
    return stats


def _service_index_by_key(service_module_index: list[dict[str, Any]]) -> dict[str, dict[str, Any]]:
    index: dict[str, dict[str, Any]] = {}
    for entry in service_module_index:
        service = entry.get("service") or {}
        for key in {service.get("id"), service.get("code"), service.get("title"), service.get("name")}:
            if key:
                index[str(key)] = entry
    return index


def _matched_service_index(index: dict[str, dict[str, Any]], service: dict[str, Any]) -> dict[str, Any]:
    for key in (service.get("id"), service.get("code"), service.get("title"), service.get("name")):
        if key and str(key) in index:
            return index[str(key)]
    return {}


def _measure_matches_service(measure: dict[str, Any], service: dict[str, Any]) -> bool:
    service_tokens = {token for token in (service.get("id"), service.get("code"), service.get("title"), service.get("name")) if token}
    related_tokens = set(_wb_list(measure.get("related_service_ids")))
    related_tokens.update(_wb_list(measure.get("related_service_names")))
    for related_service in [*_wb_list(measure.get("related_services")), *_wb_list(measure.get("services")), *_wb_list(measure.get("technical_services"))]:
        if isinstance(related_service, dict):
            related_tokens.update(token for token in (related_service.get("id"), related_service.get("code"), related_service.get("title"), related_service.get("name")) if token)
    return bool(service_tokens.intersection(related_tokens))


def _capability_code_from_focus_code(code: str) -> str:
    if "-" not in code:
        return code
    return code.rsplit("-", 1)[0]


def _focus_code_from_service(service: dict[str, Any]) -> str:
    code = _wb_text(service.get("code"))
    if "&" in code:
        return code.split("&", 1)[1]
    return ""


STANDARD_MAPPING_WORKBOOK = PROJECT_ROOT / "data" / "raw-samples" / "wiki sample.xlsx"
STANDARD_MAPPING_SHEET = "安全能力-网络安全制度、框架映射"
STANDARD_MAPPING_COLUMNS = (
    ("ISO-IEC-27001-2022", 7, "ISO 27001:2022"),
    ("NIST-CSF-2.0", 8, "CSF 2.0"),
    ("GB-T-22239-2019-L3", 9, "等级保护3级通用要求"),
    ("CIS-CSC-V8.1.2", 11, "CIS CSC V8"),
    ("CRF-SAFEGUARDS-CORE-2026", 12, "CRF"),
    ("NIST-800-53-REV5", 14, "NIST 800-53 rev5"),
)


def _extract_standard_mapping_ids(framework_code: str, value: Any) -> list[str]:
    text = str(value or "").strip()
    if not text:
        return []
    if framework_code == "NIST-CSF-2.0":
        matches = re.findall(r"\b[A-Z]{2}\.[A-Z]{2}-\d{2}\b", text)
    elif framework_code == "CRF-SAFEGUARDS-CORE-2026":
        matches = re.findall(r"\b[A-Z]{2,4}-\d{2}\b", text)
    elif framework_code == "NIST-800-53-REV5":
        matches = re.findall(r"\b[A-Z]{2}-\d+(?:\(\d+\))?", text)
    else:
        matches = re.findall(r"\b\d+(?:\.\d+)+(?:[a-z])?\b", text, flags=re.IGNORECASE)
    return list(dict.fromkeys(matches))


def _normalize_mapping_control_id(framework_code: str, control_id: str) -> str:
    normalized = str(control_id or "").strip()
    if framework_code == "GB-T-22239-2019-L3":
        return re.sub(r"[a-z]$", "", normalized, flags=re.IGNORECASE)
    return normalized


def _capability_standard_mapping_rows() -> list[dict[str, Any]]:
    if not STANDARD_MAPPING_WORKBOOK.exists():
        return []
    load_workbook = _load_openpyxl()
    workbook = load_workbook(STANDARD_MAPPING_WORKBOOK, read_only=True, data_only=True)
    if STANDARD_MAPPING_SHEET not in workbook.sheetnames:
        workbook.close()
        return []
    worksheet = workbook[STANDARD_MAPPING_SHEET]
    rows: list[dict[str, Any]] = []
    for row_idx in range(5, worksheet.max_row + 1):
        focus_code = _wb_text(worksheet.cell(row_idx, 5).value).strip()
        if not focus_code:
            continue
        for framework_code, col_idx, framework_label in STANDARD_MAPPING_COLUMNS:
            raw_value = _wb_text(worksheet.cell(row_idx, col_idx).value).strip()
            for control_id in _extract_standard_mapping_ids(framework_code, raw_value):
                rows.append(
                    {
                        "focus_code": focus_code,
                        "framework_code": framework_code,
                        "framework_label": framework_label,
                        "control_id": control_id,
                        "normalized_control_id": _normalize_mapping_control_id(framework_code, control_id),
                        "source": {
                            "sheet": STANDARD_MAPPING_SHEET,
                            "row": row_idx,
                            "column": framework_label,
                            "cell": worksheet.cell(row_idx, col_idx).coordinate,
                            "raw_value": raw_value,
                        },
                    }
                )
    workbook.close()
    return rows


def _standard_items_for_workbench(conn: sqlite3.Connection) -> tuple[dict[str, dict[str, Any]], dict[tuple[str, str], dict[str, Any]]]:
    framework_rows = conn.execute(
        """
        SELECT id, code, title, description, category, status
        FROM knowledge_items
        WHERE status = 'active'
          AND type = 'standard_framework'
        """
    ).fetchall()
    frameworks: dict[str, dict[str, Any]] = {}
    for row in framework_rows:
        frameworks[row["code"]] = {
            "id": row["id"],
            "type": "standard_framework",
            "code": row["code"],
            "title": row["title"],
            "description": row["description"],
            "category": row["category"],
            "status": row["status"],
        }

    control_rows = conn.execute(
        """
        SELECT id, code, title, description, category, status, metadata_json
        FROM knowledge_items
        WHERE status = 'active'
          AND type = 'standard_control'
        """
    ).fetchall()
    controls: dict[tuple[str, str], dict[str, Any]] = {}
    for row in control_rows:
        metadata = _load_json(row["metadata_json"], {})
        framework_code = metadata.get("framework_code") or ""
        original_control_id = metadata.get("original_control_id") or ""
        if not framework_code or not original_control_id:
            continue
        controls[(framework_code, original_control_id)] = {
            "id": row["id"],
            "type": "standard_control",
            "code": row["code"],
            "title": row["title"],
            "description": row["description"],
            "category": row["category"],
            "status": row["status"],
            "frameworkCode": framework_code,
            "frameworkTitle": metadata.get("framework_title") or "",
            "originalControlId": original_control_id,
            "related_capability_focus": metadata.get("related_capability_focus") or "",
        }
    return frameworks, controls


def _capability_lookups(capability_tree: dict[str, Any]) -> tuple[dict[str, dict[str, Any]], dict[str, dict[str, Any]]]:
    capabilities: dict[str, dict[str, Any]] = {}
    focuses: dict[str, dict[str, Any]] = {}
    for category in _wb_list(capability_tree.get("categories")):
        for domain in _wb_list(category.get("domains")):
            for capability in _wb_list(domain.get("capabilities")):
                if capability.get("code"):
                    capabilities[capability["code"]] = capability
                for focus in _wb_list(capability.get("focuses")):
                    if focus.get("code"):
                        focuses[focus["code"]] = focus
    return capabilities, focuses


def _wb_navigator_node(item: dict[str, Any], object_type: str, children: list[dict[str, Any]] | None = None) -> dict[str, Any]:
    return {
        "id": _wb_key(item),
        "type": object_type,
        "code": _wb_text(item.get("code")).strip(),
        "name": _wb_title(item),
        "children": children or [],
    }


def _empty_workbench(page: dict[str, Any], generated_at: str | None, source_packages: list[str]) -> dict[str, Any]:
    return {
        "meta": {
            "version": "v1",
            "viewModelVersion": f"{page['pageType']}-1.0",
            "generated_at": generated_at,
            "sourcePackages": source_packages,
            "stats": {},
        },
        "page": page,
        "navigator": {},
        "overview": {},
        "relationshipGroups": [],
        "objects": {},
        "relations": [],
        "evidenceRefs": [],
        "compatibility": {
            "mode": "generated_from_frontend_legacy_packages",
            "sourcePackages": source_packages,
            "warnings": [],
        },
    }


def export_capability_workbench(
    conn: sqlite3.Connection,
    *,
    output_path: str | Path,
) -> dict[str, Any]:
    capability_tree = _read_frontend_json("capability-tree.json")
    shared_lookups = _read_frontend_json("shared-lookups.json")
    maintenance = _read_frontend_json("maintenance-knowledge.json")
    generated_at = capability_tree.get("generated_at") or maintenance.get("generated_at") or shared_lookups.get("generated_at") or conn.execute("SELECT datetime('now') AS now").fetchone()["now"]
    page = {
        "route": "/capability-mapping",
        "pageType": "capability-mapping-workbench",
        "priority": "P1",
        "subject": "capability / capability_focus",
        "title": "安全能力映射",
        "description": "以安全能力和关注点为主语，展示技术视角、管理视角、流程、标准、模块、作用域和来源证据引用。",
    }
    payload = _empty_workbench(page, generated_at, ["capability-tree.json", "shared-lookups.json", "maintenance-knowledge.json"])
    objects: dict[str, dict[str, dict[str, Any]]] = {key: {} for key in (
        "capability_category",
        "capability_domain",
        "capability",
        "capability_focus",
        "scope_type",
        "security_technical_service",
        "security_technology_module",
        "security_technical_measure",
        "security_work",
        "work_function",
        "process_group",
        "process_reference",
        "process_activity",
        "standard_framework",
        "standard_control",
    )}
    relations: list[dict[str, Any]] = []
    seen_relations: set[tuple[str, str, str]] = set()
    evidence_refs: dict[str, dict[str, Any]] = {}
    service_index = _service_index_by_key(_wb_list(shared_lookups.get("service_module_index")))
    measures = _wb_list(maintenance.get("security_technical_measures"))
    _, focus_by_code = _capability_lookups(capability_tree)
    standard_frameworks_by_code, standard_controls_by_key = _standard_items_for_workbench(conn)
    standard_mapping_rows = _capability_standard_mapping_rows()
    standard_mapping_missing_controls: list[dict[str, Any]] = []
    standard_mapping_unmatched_focuses: list[dict[str, Any]] = []
    standard_mapping_source_pairs: set[tuple[str, str, str]] = set()

    navigator_tree: list[dict[str, Any]] = []
    default_focus_id = None
    for category in _wb_list(capability_tree.get("categories")):
        category_obj = _wb_add_object(objects, evidence_refs, category, "capability_category")
        domain_nodes: list[dict[str, Any]] = []
        for domain in _wb_list(category.get("domains")):
            domain_obj = _wb_add_object(objects, evidence_refs, domain, "capability_domain")
            _wb_add_relation(relations, seen_relations, "belongs_to", domain_obj, category_obj, label="属于")
            capability_nodes: list[dict[str, Any]] = []
            for capability in _wb_list(domain.get("capabilities")):
                capability_obj = _wb_add_object(objects, evidence_refs, capability, "capability")
                _wb_add_relation(relations, seen_relations, "belongs_to", capability_obj, domain_obj, label="属于")
                focus_nodes: list[dict[str, Any]] = []
                for focus in _wb_list(capability.get("focuses")):
                    focus_obj = _wb_add_object(objects, evidence_refs, focus, "capability_focus")
                    default_focus_id = default_focus_id or focus_obj["id"]
                    _wb_add_relation(relations, seen_relations, "belongs_to", focus_obj, capability_obj, label="属于")
                    focus_nodes.append(_wb_navigator_node(focus, "capability_focus"))

                    services_by_key: dict[str, dict[str, Any]] = {}
                    for service in _wb_list(focus.get("services")):
                        if not isinstance(service, dict):
                            continue
                        service_obj = _wb_add_object(objects, evidence_refs, service, "security_technical_service", fallback_name="未命名服务")
                        services_by_key[service_obj["id"]] = service
                        _wb_add_relation(
                            relations,
                            seen_relations,
                            "supports_focus",
                            service_obj,
                            focus_obj,
                            label="支撑关注点",
                            evidence_refs=_wb_collect_evidence(evidence_refs, focus, service),
                        )
                    for mapping in _wb_list(focus.get("scope_mappings")):
                        scope = mapping.get("scope") or {}
                        scope_obj = _wb_add_object(objects, evidence_refs, scope, "scope_type", fallback_name="待确认作用域")
                        _wb_add_relation(relations, seen_relations, "applies_to_scope", focus_obj, scope_obj, label="适用作用域")
                        for service in _wb_list(mapping.get("services")):
                            if not isinstance(service, dict):
                                continue
                            service_obj = _wb_add_object(objects, evidence_refs, service, "security_technical_service", fallback_name="未命名服务")
                            services_by_key[service_obj["id"]] = service
                            relation_evidence = _wb_collect_evidence(evidence_refs, mapping, service, scope)
                            _wb_add_relation(relations, seen_relations, "supports_focus", service_obj, focus_obj, label="支撑关注点", evidence_refs=relation_evidence)
                            _wb_add_relation(relations, seen_relations, "applies_to_scope", service_obj, scope_obj, label="适用作用域", evidence_refs=relation_evidence)
                    for service_obj_id, service in services_by_key.items():
                        service_obj = objects["security_technical_service"].get(service_obj_id)
                        index_entry = _matched_service_index(service_index, service)
                        for module in _wb_list(index_entry.get("modules")):
                            module_obj = _wb_add_object(objects, evidence_refs, module, "security_technology_module", fallback_name="未命名模块")
                            _wb_add_relation(
                                relations,
                                seen_relations,
                                "implemented_by_module",
                                service_obj,
                                module_obj,
                                label="由模块实现",
                                evidence_refs=_wb_collect_evidence(evidence_refs, service, module, index_entry),
                            )
                        for measure in measures:
                            if isinstance(measure, dict) and _measure_matches_service(measure, service):
                                measure_obj = _wb_add_object(objects, evidence_refs, measure, "security_technical_measure", fallback_name="未命名措施")
                                _wb_add_relation(
                                    relations,
                                    seen_relations,
                                    "has_measure",
                                    service_obj,
                                    measure_obj,
                                    label="关联措施",
                                    evidence_refs=_wb_collect_evidence(evidence_refs, service, measure),
                                )
                    for work in _wb_list(focus.get("security_works")):
                        work_obj = _wb_add_object(objects, evidence_refs, work, "security_work", fallback_name="未命名安全工作")
                        _wb_add_relation(relations, seen_relations, "maps_to_work", focus_obj, work_obj, label="映射安全工作")
                    for mapping in _wb_list(focus.get("process_mappings")):
                        group = mapping.get("process_group") or {}
                        reference = mapping.get("process_reference") or {}
                        if not reference:
                            continue
                        group_obj = _wb_add_object(objects, evidence_refs, group, "process_group", fallback_name="待确认流程组")
                        reference_obj = _wb_add_object(objects, evidence_refs, reference, "process_reference", fallback_name="待确认流程")
                        _wb_add_relation(relations, seen_relations, "maps_to_process", focus_obj, reference_obj, label="映射流程", evidence_refs=_wb_collect_evidence(evidence_refs, mapping, reference))
                        _wb_add_relation(relations, seen_relations, "belongs_to", reference_obj, group_obj, label="属于流程组")
                        for activity in _wb_list(mapping.get("activities")):
                            activity_obj = _wb_add_object(objects, evidence_refs, activity, "process_activity", fallback_name="待确认活动")
                            _wb_add_relation(relations, seen_relations, "has_activity", reference_obj, activity_obj, label="包含活动")
                        stakeholders = mapping.get("stakeholders") if isinstance(mapping.get("stakeholders"), dict) else {}
                        for layer, layer_items in stakeholders.items():
                            for stakeholder in _wb_list(layer_items):
                                stakeholder_obj = _wb_add_object(
                                    objects,
                                    evidence_refs,
                                    stakeholder,
                                    "work_function",
                                    fallback_name="未命名职能",
                                    extra={"layer": layer},
                                )
                                _wb_add_relation(relations, seen_relations, "stakeholder_by", reference_obj, stakeholder_obj, label="涉及职能")
                capability_nodes.append(_wb_navigator_node(capability, "capability", focus_nodes))
            domain_nodes.append(_wb_navigator_node(domain, "capability_domain", capability_nodes))
        navigator_tree.append(_wb_navigator_node(category, "capability_category", domain_nodes))

    for mapping in standard_mapping_rows:
        standard_mapping_source_pairs.add((mapping["focus_code"], mapping["framework_code"], mapping["normalized_control_id"]))
        focus_item = focus_by_code.get(mapping["focus_code"])
        if not focus_item:
            standard_mapping_unmatched_focuses.append(mapping)
            continue
        focus_obj = objects["capability_focus"].get(_wb_key(focus_item)) or _wb_add_object(objects, evidence_refs, focus_item, "capability_focus")
        framework_item = standard_frameworks_by_code.get(mapping["framework_code"])
        control_item = standard_controls_by_key.get((mapping["framework_code"], mapping["normalized_control_id"]))
        if not control_item:
            standard_mapping_missing_controls.append(mapping)
            continue
        framework_obj = None
        if framework_item:
            framework_obj = _wb_add_object(objects, evidence_refs, framework_item, "standard_framework", fallback_name=mapping["framework_label"])
            _wb_add_relation(relations, seen_relations, "belongs_to_framework", _wb_add_object(objects, evidence_refs, control_item, "standard_control"), framework_obj, label="属于标准框架")
        control_obj = _wb_add_object(
            objects,
            evidence_refs,
            control_item,
            "standard_control",
            extra={
                "frameworkCode": control_item.get("frameworkCode"),
                "frameworkTitle": control_item.get("frameworkTitle"),
                "originalControlId": control_item.get("originalControlId"),
            },
        )
        _wb_add_relation(
            relations,
            seen_relations,
            "maps_to_standard",
            focus_obj,
            control_obj,
            label="映射标准控制项",
            evidence_refs=_wb_collect_evidence(evidence_refs, {"sources": [mapping["source"]]}),
        )

    standard_projection_pairs: set[tuple[str, str, str]] = set()
    for (framework_code, original_control_id), control_item in standard_controls_by_key.items():
        related_codes = _related_capability_focus_codes(control_item.get("related_capability_focus") or "").splitlines()
        for focus_code in related_codes:
            if focus_code:
                standard_projection_pairs.add((focus_code, framework_code, _normalize_mapping_control_id(framework_code, original_control_id)))
    missing_in_standard_projection = sorted(standard_mapping_source_pairs - standard_projection_pairs)
    extra_in_standard_projection = sorted(standard_projection_pairs - standard_mapping_source_pairs)

    payload["navigator"] = {
        "defaultSelectedFocusId": default_focus_id,
        "tree": navigator_tree,
    }
    payload["objects"] = objects
    payload["relations"] = relations
    payload["evidenceRefs"] = sorted(evidence_refs.values(), key=lambda item: item["id"])
    payload["relationshipGroups"] = [
        _wb_group("capability-hierarchy", "能力层级", ["belongs_to"], relations),
        _wb_group("focus-list", "关注点清单", ["belongs_to"], relations),
        _wb_group("technical-mapping", "技术视角映射", ["supports_focus", "applies_to_scope", "implemented_by_module", "has_measure"], relations),
        _wb_group("management-mapping", "管理视角映射", ["maps_to_work", "stakeholder_by"], relations),
        _wb_group("process-mapping", "流程映射", ["maps_to_process", "has_activity"], relations),
        _wb_group("standard-mapping", "标准 / 框架映射", ["maps_to_standard", "belongs_to_framework"], relations),
        _wb_group("module-measure-mapping", "技术模块 / 技术措施映射", ["implemented_by_module", "has_measure"], relations),
        _wb_group("scope-mapping", "作用域映射", ["applies_to_scope"], relations),
    ]
    stats = _wb_stats(objects, relations, evidence_refs)
    payload["overview"] = {
        "defaultObjectId": default_focus_id,
        "object_type": "capability_focus",
        "stats": stats,
    }
    payload["meta"]["stats"] = stats
    payload["meta"]["standardMappingValidation"] = {
        "sourceRows": len(standard_mapping_rows),
        "uniqueSourcePairs": len(standard_mapping_source_pairs),
        "mappedRelations": len([relation for relation in relations if relation.get("type") == "maps_to_standard"]),
        "missingControls": len(standard_mapping_missing_controls),
        "unmatchedFocuses": len(standard_mapping_unmatched_focuses),
        "missingInStandardProjection": len(missing_in_standard_projection),
        "extraInStandardProjection": len(extra_in_standard_projection),
    }
    payload["compatibility"]["warnings"] = [
        "capability-workbench.json 当前由 capability-tree.json、shared-lookups.json、maintenance-knowledge.json 与 capability-first 标准 / 框架映射表整理生成。",
        "标准 / 框架映射以 capability-first 映射表为业务主源，并与标准 Sheet 已投影的关联关注点字段做双向验证。",
    ]
    if standard_mapping_missing_controls:
        payload["compatibility"]["warnings"].append(f"标准映射中有 {len(standard_mapping_missing_controls)} 条控制项未匹配到当前标准主数据。")
    if standard_mapping_unmatched_focuses:
        payload["compatibility"]["warnings"].append(f"标准映射中有 {len(standard_mapping_unmatched_focuses)} 条关注点未匹配到能力树。")
    if missing_in_standard_projection or extra_in_standard_projection:
        payload["compatibility"]["warnings"].append(
            f"标准映射双向验证存在差异：标准页缺少 {len(missing_in_standard_projection)} 条，标准页额外 {len(extra_in_standard_projection)} 条。"
        )
    output = resolve_project_path(output_path)
    output.parent.mkdir(parents=True, exist_ok=True)
    _write_json(output, payload)
    return {"count": len(relations), "files": [str(output)], "stats": stats}


def export_environment_workbench(
    conn: sqlite3.Connection,
    *,
    output_path: str | Path,
) -> dict[str, Any]:
    with tempfile.TemporaryDirectory() as tmp_dir:
        temp_output = Path(tmp_dir) / "management-knowledge.json"
        export_management_knowledge(conn, output_path=temp_output)
        management = json.loads(temp_output.read_text(encoding="utf-8"))
    capability_tree = _read_frontend_json("capability-tree.json")
    generated_at = management.get("generated_at") or conn.execute("SELECT datetime('now') AS now").fetchone()["now"]
    page = {
        "route": "/environment-mapping",
        "pageType": "environment-mapping-workbench",
        "priority": "P1",
        "subject": "information_environment / information_object",
        "title": "信息化环境安全能力映射",
        "description": "以信息化环境和信息化对象为主语，展示对象、作用域、服务、模块、措施、系统、产品和能力关联。",
    }
    payload = _empty_workbench(page, generated_at, ["database", "capability-tree.json", "maintenance-knowledge.json"])
    payload["environment_scope_tree"] = _wb_list(management.get("environment_scope_tree"))
    objects: dict[str, dict[str, dict[str, Any]]] = {key: {} for key in (
        "information_environment",
        "environment_segment",
        "information_object",
        "scope_type",
        "security_technical_service",
        "security_technology_module",
        "security_technical_measure",
        "security_system",
        "product",
        "capability",
        "capability_focus",
    )}
    relations: list[dict[str, Any]] = []
    seen_relations: set[tuple[str, str, str]] = set()
    evidence_refs: dict[str, dict[str, Any]] = {}
    capability_by_code, focus_by_code = _capability_lookups(capability_tree)
    navigator_tree: list[dict[str, Any]] = []
    default_object_id = None

    for environment in _wb_list(management.get("environment_scope_tree")):
        env_obj = _wb_add_object(objects, evidence_refs, environment, "information_environment", fallback_name="未命名环境")
        object_nodes: list[dict[str, Any]] = []
        for info_object in _wb_list(environment.get("objects")):
            object_obj = _wb_add_object(objects, evidence_refs, info_object, "information_object", fallback_name="未命名对象")
            default_object_id = default_object_id or object_obj["id"]
            segments = _wb_list(info_object.get("segments"))
            if segments:
                segment_nodes: list[dict[str, Any]] = []
                for segment in segments:
                    segment_obj = _wb_add_object(objects, evidence_refs, segment, "environment_segment", fallback_name="未命名分段")
                    _wb_add_relation(relations, seen_relations, "contains_segment", env_obj, segment_obj, label="包含分段")
                    _wb_add_relation(relations, seen_relations, "contains_object", segment_obj, object_obj, label="包含对象")
                    segment_nodes.append(_wb_navigator_node(segment, "environment_segment", [_wb_navigator_node(info_object, "information_object")]))
                object_nodes.extend(segment_nodes)
            else:
                _wb_add_relation(relations, seen_relations, "contains_object", env_obj, object_obj, label="包含对象")
                object_nodes.append(_wb_navigator_node(info_object, "information_object"))

            for mapping in _wb_list(info_object.get("scope_mappings")):
                scope = mapping.get("scope") or {}
                scope_obj = _wb_add_object(objects, evidence_refs, scope, "scope_type", fallback_name="待确认作用域")
                _wb_add_relation(relations, seen_relations, "applies_to_scope", object_obj, scope_obj, label="适用作用域", evidence_refs=_wb_collect_evidence(evidence_refs, mapping, scope))
                for service in _wb_list(mapping.get("services")):
                    if not isinstance(service, dict):
                        continue
                    service_obj = _wb_add_object(objects, evidence_refs, service, "security_technical_service", fallback_name="未命名服务")
                    relation_evidence = _wb_collect_evidence(evidence_refs, mapping, service, scope, info_object)
                    _wb_add_relation(relations, seen_relations, "protects_object", service_obj, object_obj, label="保护对象", evidence_refs=relation_evidence)
                    _wb_add_relation(relations, seen_relations, "applies_to_scope", service_obj, scope_obj, label="适用作用域", evidence_refs=relation_evidence)
                    _wb_add_relation(relations, seen_relations, "deployed_in_environment", service_obj, env_obj, label="部署于环境", evidence_refs=relation_evidence)
                    focus_code = _focus_code_from_service(service)
                    if focus_code:
                        focus_item = focus_by_code.get(focus_code) or {"id": f"capability_focus:{focus_code}", "code": focus_code, "title": focus_code, "status": "derived"}
                        focus_obj = _wb_add_object(objects, evidence_refs, focus_item, "capability_focus", fallback_name=focus_code, extra={"status": focus_item.get("status") or "derived"})
                        _wb_add_relation(relations, seen_relations, "supports_focus", service_obj, focus_obj, label="支撑关注点", confidence="derived")
                        capability_code = _capability_code_from_focus_code(focus_code)
                        capability_item = capability_by_code.get(capability_code) or {"id": f"capability:{capability_code}", "code": capability_code, "title": capability_code, "status": "derived"}
                        capability_obj = _wb_add_object(objects, evidence_refs, capability_item, "capability", fallback_name=capability_code, extra={"status": capability_item.get("status") or "derived"})
                        _wb_add_relation(relations, seen_relations, "supports_capability", service_obj, capability_obj, label="支撑能力", confidence="derived")
                    for module in _wb_list(service.get("modules")):
                        module_obj = _wb_add_object(objects, evidence_refs, module, "security_technology_module", fallback_name="未命名模块")
                        module_evidence = _wb_collect_evidence(evidence_refs, service, module)
                        _wb_add_relation(relations, seen_relations, "implements_service", module_obj, service_obj, label="实现服务", evidence_refs=module_evidence)
                        _wb_add_relation(relations, seen_relations, "implemented_by_module", service_obj, module_obj, label="由模块实现", evidence_refs=module_evidence)
                        for system in _wb_list(module.get("systems")):
                            system_obj = _wb_add_object(objects, evidence_refs, system, "security_system", fallback_name="未命名系统")
                            _wb_add_relation(relations, seen_relations, "part_of_system", module_obj, system_obj, label="属于系统", evidence_refs=_wb_collect_evidence(evidence_refs, module, system))
                        for product in _wb_list(module.get("products")):
                            product_obj = _wb_add_object(objects, evidence_refs, product, "product", fallback_name="未命名产品")
                            _wb_add_relation(relations, seen_relations, "maps_to_product", module_obj, product_obj, label="映射产品")
                    for measure in _wb_list(service.get("measures")):
                        if isinstance(measure, dict):
                            measure_obj = _wb_add_object(objects, evidence_refs, measure, "security_technical_measure", fallback_name="未命名措施")
                            _wb_add_relation(relations, seen_relations, "has_measure", service_obj, measure_obj, label="关联措施", evidence_refs=_wb_collect_evidence(evidence_refs, service, measure))
        navigator_tree.append(_wb_navigator_node(environment, "information_environment", object_nodes))

    payload["navigator"] = {
        "defaultSelectedObjectId": default_object_id,
        "tree": navigator_tree,
        "grouping": ["information_environment", "environment_segment", "information_object", "scope_type"],
    }
    payload["objects"] = objects
    payload["relations"] = relations
    payload["evidenceRefs"] = sorted(evidence_refs.values(), key=lambda item: item["id"])
    payload["relationshipGroups"] = [
        _wb_group("environment-object", "环境 / 分段 / 对象", ["contains_segment", "contains_object"], relations),
        _wb_group("object-scope", "对象与作用域", ["applies_to_scope"], relations),
        _wb_group("scope-service", "作用域与安全技术服务", ["protects_object", "applies_to_scope"], relations),
        _wb_group("service-module-measure", "服务与技术模块 / 技术措施", ["implements_service", "implemented_by_module", "has_measure"], relations),
        _wb_group("module-system-product", "模块与安全系统 / 产品", ["part_of_system", "maps_to_product"], relations),
        _wb_group("capability-association", "对象 / 服务与安全能力关联", ["supports_capability", "supports_focus"], relations),
    ]
    stats = _wb_stats(objects, relations, evidence_refs)
    payload["overview"] = {
        "defaultObjectId": default_object_id,
        "object_type": "information_object",
        "stats": stats,
    }
    payload["meta"]["stats"] = stats
    payload["compatibility"]["warnings"] = [
        "environment-workbench.json 当前由数据库中的环境关系和 capability-tree.json 整理生成；不依赖公开发布的 management-knowledge.json。",
        "服务到能力 / 关注点关系部分根据服务编码和 capability-tree.json 进行受控派生，后续可由独立 export 关系替代。",
    ]
    output = resolve_project_path(output_path)
    output.parent.mkdir(parents=True, exist_ok=True)
    _write_json(output, payload)
    return {"count": len(relations), "files": [str(output)], "stats": stats}


def export_lifecycle_workbench(
    conn: sqlite3.Connection,
    *,
    output_path: str | Path,
) -> dict[str, Any]:
    lifecycle = _read_frontend_json("lifecycle-knowledge.json")
    capability_tree = _read_frontend_json("capability-tree.json")
    shared_lookups = _read_frontend_json("shared-lookups.json")
    generated_at = lifecycle.get("generated_at") or conn.execute("SELECT datetime('now') AS now").fetchone()["now"]
    page = {
        "route": "/development-security",
        "pageType": "domain-module",
        "priority": "P3",
        "subject": "LC-AP / LC-DT lifecycle controlled projection",
        "title": "生命周期安全专项关系投影",
        "description": "以 LC-AP 阶段和 LC-DT 数据处理过程为主语，展示受控的活动、场景、服务、模块、措施和来源证据引用。",
    }
    payload = _empty_workbench(page, generated_at, ["lifecycle-knowledge.json", "capability-tree.json", "shared-lookups.json"])
    objects: dict[str, dict[str, dict[str, Any]]] = {key: {} for key in (
        "lifecycle_domain",
        "lifecycle_stage",
        "lifecycle_activity",
        "lifecycle_control",
        "lifecycle_requirement",
        "software_development_type",
        "capability",
        "capability_focus",
        "development_technical_service",
        "development_technical_module",
        "security_technical_service",
        "security_technology_module",
        "security_technical_measure",
    )}
    relations: list[dict[str, Any]] = []
    seen_relations: set[tuple[str, str, str]] = set()
    evidence_refs: dict[str, dict[str, Any]] = {}
    capability_by_code, focus_by_code = _capability_lookups(capability_tree)
    app_security = lifecycle.get("application_security_development") or {}
    service_index = _service_index_by_key(_wb_list(shared_lookups.get("service_module_index")) or _wb_list(lifecycle.get("service_module_index")))
    app_domain_item = {
        "id": "lifecycle_domain:LC-AP",
        "code": "LC-AP",
        "title": "开发安全生命周期",
        "description": "LC-AP 开发安全生命周期受控专项关系投影。",
        "status": "active",
    }
    data_domain_item = {
        "id": "lifecycle_domain:LC-DT",
        "code": "LC-DT",
        "title": "数据生命周期安全",
        "description": "LC-DT 数据生命周期安全受控专项关系投影。",
        "status": "active",
    }
    app_domain_obj = _wb_add_object(objects, evidence_refs, app_domain_item, "lifecycle_domain", extra={"lifecycleType": "application_security_development"})
    data_domain_obj = _wb_add_object(objects, evidence_refs, data_domain_item, "lifecycle_domain", extra={"lifecycleType": "data"})
    app_navigator_children: list[dict[str, Any]] = []
    data_navigator_children: list[dict[str, Any]] = []
    default_stage_id = None
    default_data_stage_id = None

    for process in _wb_list(app_security.get("processes")):
        stage_obj = _wb_add_object(
            objects,
            evidence_refs,
            process,
            "lifecycle_stage",
            fallback_name="未命名阶段",
            extra={
                "lifecycleType": "application_security_development",
                "originalBusinessFields": process.get("original_business_fields")
                or (process.get("metadata").get("original_business_fields") if isinstance(process.get("metadata"), dict) else {})
                or {}
            },
        )
        default_stage_id = default_stage_id or stage_obj["id"]
        _wb_add_relation(relations, seen_relations, "belongs_to", stage_obj, app_domain_obj, label="属于生命周期")
        app_navigator_children.append(_wb_navigator_node(process, "lifecycle_stage"))
        for activity in _wb_list(process.get("main_activities")):
            activity_obj = _wb_add_object(objects, evidence_refs, activity, "lifecycle_activity", fallback_name="未命名活动")
            _wb_add_relation(relations, seen_relations, "contains_activity", stage_obj, activity_obj, label="包含主要活动")
        for control in _wb_list(process.get("security_activities")):
            control_obj = _wb_add_object(objects, evidence_refs, control, "lifecycle_control", fallback_name="未命名控制点")
            _wb_add_relation(relations, seen_relations, "contains_control", stage_obj, control_obj, label="包含安全控制")
        for requirement in _wb_list(process.get("policy_requirements")):
            requirement_obj = _wb_add_object(objects, evidence_refs, requirement, "lifecycle_requirement", fallback_name="未命名要求")
            _wb_add_relation(relations, seen_relations, "belongs_to", requirement_obj, stage_obj, label="属于阶段")
        for development_type in _wb_list(process.get("development_types")):
            development_type_obj = _wb_add_object(
                objects,
                evidence_refs,
                development_type,
                "software_development_type",
                fallback_name="未命名开发模式",
            )
            _wb_add_relation(
                relations,
                seen_relations,
                "applies_to_development_type",
                stage_obj,
                development_type_obj,
                label="适用于开发模式",
                confidence="explicit",
                evidence_refs=_wb_collect_evidence(evidence_refs, process, development_type),
            )
        for development_service in _wb_list(process.get("development_technical_services")):
            development_service_obj = _wb_add_object(
                objects,
                evidence_refs,
                development_service,
                "development_technical_service",
                fallback_name="未命名开发技术服务",
            )
            _wb_add_relation(
                relations,
                seen_relations,
                "uses_development_technical_service",
                stage_obj,
                development_service_obj,
                label="使用开发技术服务",
                confidence="explicit",
                evidence_refs=_wb_collect_evidence(evidence_refs, process, development_service),
            )
        for development_module in _wb_list(process.get("development_technical_modules")):
            development_module_obj = _wb_add_object(
                objects,
                evidence_refs,
                development_module,
                "development_technical_module",
                fallback_name="未命名开发技术模块",
            )
            _wb_add_relation(
                relations,
                seen_relations,
                "uses_development_technical_module",
                stage_obj,
                development_module_obj,
                label="使用开发技术模块",
                confidence="explicit",
                evidence_refs=_wb_collect_evidence(evidence_refs, process, development_module),
            )
        services_by_key: dict[str, dict[str, Any]] = {}
        for service in _wb_list(process.get("technical_services")):
            if not isinstance(service, dict):
                continue
            service_obj = _wb_add_object(objects, evidence_refs, service, "security_technical_service", fallback_name="未命名服务")
            services_by_key[service_obj["id"]] = service
            _wb_add_relation(relations, seen_relations, "maps_to_service", stage_obj, service_obj, label="映射服务", evidence_refs=_wb_collect_evidence(evidence_refs, process, service))
            focus_code = _focus_code_from_service(service)
            if focus_code:
                focus_item = focus_by_code.get(focus_code) or {"id": f"capability_focus:{focus_code}", "code": focus_code, "title": focus_code, "status": "derived"}
                focus_obj = _wb_add_object(objects, evidence_refs, focus_item, "capability_focus", fallback_name=focus_code, extra={"status": focus_item.get("status") or "derived"})
                _wb_add_relation(relations, seen_relations, "maps_to_focus", stage_obj, focus_obj, label="映射关注点", confidence="derived")
                capability_code = _capability_code_from_focus_code(focus_code)
                capability_item = capability_by_code.get(capability_code) or {"id": f"capability:{capability_code}", "code": capability_code, "title": capability_code, "status": "derived"}
                capability_obj = _wb_add_object(objects, evidence_refs, capability_item, "capability", fallback_name=capability_code, extra={"status": capability_item.get("status") or "derived"})
                _wb_add_relation(relations, seen_relations, "maps_to_capability", stage_obj, capability_obj, label="映射能力", confidence="derived")
        for module in _wb_list(process.get("technology_modules")):
            module_obj = _wb_add_object(objects, evidence_refs, module, "security_technology_module", fallback_name="未命名模块")
            _wb_add_relation(relations, seen_relations, "implemented_by_module", stage_obj, module_obj, label="关联模块", confidence="explicit")
        for measure in _wb_list(process.get("technical_measures")):
            measure_obj = _wb_add_object(objects, evidence_refs, measure, "security_technical_measure", fallback_name="未命名措施")
            _wb_add_relation(
                relations,
                seen_relations,
                "uses_measure",
                stage_obj,
                measure_obj,
                label="关联措施",
                confidence="explicit",
                evidence_refs=_wb_collect_evidence(evidence_refs, process, measure),
            )
        for service_obj_id, service in services_by_key.items():
            service_obj = objects["security_technical_service"].get(service_obj_id)
            index_entry = _matched_service_index(service_index, service)
            for module in _wb_list(index_entry.get("modules")):
                module_obj = _wb_add_object(objects, evidence_refs, module, "security_technology_module", fallback_name="未命名模块")
                _wb_add_relation(relations, seen_relations, "implemented_by_module", service_obj, module_obj, label="由模块实现", evidence_refs=_wb_collect_evidence(evidence_refs, service, module, index_entry))

    data_lifecycle = lifecycle.get("data_lifecycle") or {}
    for process in _wb_list(data_lifecycle.get("processes")):
        stage_obj = _wb_add_object(
            objects,
            evidence_refs,
            process,
            "lifecycle_stage",
            fallback_name="未命名数据过程",
            extra={"lifecycleType": "data", "dataPolicyRows": _wb_list(process.get("data_policy_rows"))},
        )
        default_data_stage_id = default_data_stage_id or stage_obj["id"]
        _wb_add_relation(relations, seen_relations, "belongs_to", stage_obj, data_domain_obj, label="属于数据生命周期")
        data_navigator_children.append(_wb_navigator_node(process, "lifecycle_stage"))
        for scene in _wb_list(process.get("scenes")):
            scene_obj = _wb_add_object(
                objects,
                evidence_refs,
                scene,
                "lifecycle_activity",
                fallback_name="未命名数据处理场景",
                extra={"lifecycleType": "data", "objectKind": "数据处理场景"},
            )
            _wb_add_relation(
                relations,
                seen_relations,
                "contains_scene",
                stage_obj,
                scene_obj,
                label="包含数据处理场景",
                evidence_refs=_wb_collect_evidence(evidence_refs, process, scene),
            )
        services_by_key: dict[str, dict[str, Any]] = {}
        for service in _wb_list(process.get("technical_services")):
            if not isinstance(service, dict):
                continue
            service_obj = _wb_add_object(objects, evidence_refs, service, "security_technical_service", fallback_name="未命名服务")
            services_by_key[service_obj["id"]] = service
            _wb_add_relation(
                relations,
                seen_relations,
                "maps_to_service",
                stage_obj,
                service_obj,
                label="映射安全技术服务",
                evidence_refs=_wb_collect_evidence(evidence_refs, process, service),
            )
            focus_code = _focus_code_from_service(service)
            if focus_code:
                focus_item = focus_by_code.get(focus_code) or {"id": f"capability_focus:{focus_code}", "code": focus_code, "title": focus_code, "status": "derived"}
                focus_obj = _wb_add_object(objects, evidence_refs, focus_item, "capability_focus", fallback_name=focus_code, extra={"status": focus_item.get("status") or "derived"})
                _wb_add_relation(relations, seen_relations, "maps_to_focus", stage_obj, focus_obj, label="映射关注点", confidence="derived")
                capability_code = _capability_code_from_focus_code(focus_code)
                capability_item = capability_by_code.get(capability_code) or {"id": f"capability:{capability_code}", "code": capability_code, "title": capability_code, "status": "derived"}
                capability_obj = _wb_add_object(objects, evidence_refs, capability_item, "capability", fallback_name=capability_code, extra={"status": capability_item.get("status") or "derived"})
                _wb_add_relation(relations, seen_relations, "maps_to_capability", stage_obj, capability_obj, label="映射能力", confidence="derived")
        for module in _wb_list(process.get("technology_modules")):
            module_obj = _wb_add_object(objects, evidence_refs, module, "security_technology_module", fallback_name="未命名模块")
            _wb_add_relation(relations, seen_relations, "implemented_by_module", stage_obj, module_obj, label="关联模块", confidence="explicit")
        for measure in _wb_list(process.get("technical_measures")):
            measure_obj = _wb_add_object(objects, evidence_refs, measure, "security_technical_measure", fallback_name="未命名措施")
            _wb_add_relation(
                relations,
                seen_relations,
                "uses_measure",
                stage_obj,
                measure_obj,
                label="关联措施",
                confidence="explicit",
                evidence_refs=_wb_collect_evidence(evidence_refs, process, measure),
            )
        for service_obj_id, service in services_by_key.items():
            service_obj = objects["security_technical_service"].get(service_obj_id)
            index_entry = _matched_service_index(service_index, service)
            for module in _wb_list(index_entry.get("modules")):
                module_obj = _wb_add_object(objects, evidence_refs, module, "security_technology_module", fallback_name="未命名模块")
                _wb_add_relation(relations, seen_relations, "implemented_by_module", service_obj, module_obj, label="由模块实现", evidence_refs=_wb_collect_evidence(evidence_refs, service, module, index_entry))

    payload["navigator"] = {
        "defaultSelectedStageId": default_stage_id,
        "defaultSelectedDataStageId": default_data_stage_id,
        "tree": [
            _wb_navigator_node(app_domain_item, "lifecycle_domain", app_navigator_children),
            _wb_navigator_node(data_domain_item, "lifecycle_domain", data_navigator_children),
        ],
        "grouping": [
            "lifecycle_domain",
            "lifecycle_stage",
            "lifecycle_activity",
            "lifecycle_control",
            "lifecycle_requirement",
            "software_development_type",
            "development_technical_service",
            "development_technical_module",
            "security_technical_measure",
        ],
    }
    payload["objects"] = objects
    payload["relations"] = relations
    payload["evidenceRefs"] = sorted(evidence_refs.values(), key=lambda item: item["id"])
    payload["relationshipGroups"] = [
        _wb_group("lifecycle-stage", "生命周期阶段", ["belongs_to"], relations),
        _wb_group("activity-control", "活动 / 控制点 / 数据场景", ["contains_activity", "contains_control", "contains_scene"], relations),
        _wb_group("development-type", "软件开发模式", ["applies_to_development_type"], relations),
        _wb_group("capability-mapping", "能力映射", ["maps_to_capability"], relations),
        _wb_group("focus-mapping", "关注点映射", ["maps_to_focus"], relations),
        _wb_group("development-technology", "开发技术服务 / 模块", ["uses_development_technical_service", "uses_development_technical_module"], relations),
        _wb_group("service-module", "服务 / 模块关联", ["maps_to_service", "implemented_by_module"], relations),
        _wb_group("stage-measure", "阶段 / 技术措施关联", ["uses_measure"], relations),
    ]
    stats = _wb_stats(objects, relations, evidence_refs)
    payload["overview"] = {
        "defaultObjectId": default_stage_id,
        "object_type": "lifecycle_stage",
        "stats": stats,
    }
    payload["meta"]["stats"] = stats
    payload["compatibility"]["warnings"] = [
        "lifecycle-workbench.json 当前承载 LC-AP 开发安全生命周期和 LC-DT 数据生命周期安全两类受控专项关系投影。",
        "安全技术措施当前按生命周期阶段级关系投影；尚不细化为安全技术服务级关系。",
        "部分能力 / 关注点映射根据服务编码受控派生，后续可由独立 export 关系替代。",
    ]
    output = resolve_project_path(output_path)
    output.parent.mkdir(parents=True, exist_ok=True)
    _write_json(output, payload)
    return {"count": len(relations), "files": [str(output)], "stats": stats}


def export_frontend_workbenches(
    conn: sqlite3.Connection,
    *,
    output_dir: str | Path | None = None,
) -> dict[str, Any]:
    base_dir = resolve_project_path(output_dir) if output_dir else FRONTEND_DATA_DIR
    base_dir.mkdir(parents=True, exist_ok=True)
    results = [
        export_shared_lookups(conn, output_path=base_dir / "shared-lookups.json"),
        export_capability_workbench(conn, output_path=base_dir / "capability-workbench.json"),
        export_environment_workbench(conn, output_path=base_dir / "environment-workbench.json"),
        export_lifecycle_workbench(conn, output_path=base_dir / "lifecycle-workbench.json"),
        export_standard_frameworks_data(conn, output_path=base_dir / "standards-index.json"),
    ]
    files = [file for result in results for file in result.get("files", [])]
    stats = {
        "shared_service_module_index": results[0].get("stats", {}).get("service_module_index", 0),
        "capability_workbench_relations": results[1].get("stats", {}).get("relations", 0),
        "environment_workbench_relations": results[2].get("stats", {}).get("relations", 0),
        "lifecycle_workbench_relations": results[3].get("stats", {}).get("relations", 0),
        "standard_framework_controls": results[4].get("stats", {}).get("controls", 0),
    }
    return {"count": sum(stats.values()), "files": files, "stats": stats}


def _control_sort_key(value: Any) -> tuple[Any, ...]:
    text_value = str(value or "")
    parts: list[Any] = []
    for part in re.split(r"(\d+)", text_value):
        if not part:
            continue
        parts.append(int(part) if part.isdigit() else part)
    return tuple(parts)


def _standard_control_title_without_code(title: str, code: str) -> str:
    normalized_title = str(title or "").strip()
    normalized_code = str(code or "").strip()
    if normalized_code and normalized_title.startswith(normalized_code):
        return normalized_title[len(normalized_code):].strip()
    return normalized_title


def _related_capability_focus_codes(value: Any) -> str:
    text = str(value or "").strip()
    if not text:
        return ""
    codes = re.findall(r"\b[TGM]-[A-Z]{2}\.[A-Z]{2}-\d{2}\b", text)
    if not codes:
        return text
    return "\n".join(dict.fromkeys(codes))


def export_standard_frameworks_data(
    conn: sqlite3.Connection,
    *,
    output_path: str | Path,
) -> dict[str, Any]:
    rows = conn.execute(
        """
        SELECT id, code, title, description, metadata_json
        FROM knowledge_items
        WHERE status = 'active'
          AND type IN ('standard_control', 'standard_tier')
          AND json_extract(metadata_json, '$.framework_code') IN (
            'GB-T-22239-2019-L3',
            'CIS-CSC-V8.1.2',
            'NIST-CSF-2.0',
            'ISO-IEC-27001-2022',
            'DSP-SCF-2026',
            'CRF-SAFEGUARDS-CORE-2026',
            'CRF-MATURITY-MODEL-2026',
            'NIST-800-53-REV5'
          )
        """
    ).fetchall()

    by_framework: dict[str, list[dict[str, Any]]] = {
        "GB-T-22239-2019-L3": [],
        "CIS-CSC-V8.1.2": [],
        "NIST-CSF-2.0:core": [],
        "NIST-CSF-2.0:tiers": [],
        "ISO-IEC-27001-2022": [],
        "DSP-SCF-2026": [],
        "CRF-SAFEGUARDS-CORE-2026": [],
        "CRF-MATURITY-MODEL-2026": [],
        "NIST-800-53-REV5": [],
    }
    for row in rows:
        metadata = _load_json(row["metadata_json"], {})
        framework_code = metadata.get("framework_code")
        original_control_id = metadata.get("original_control_id") or ""
        related_capability_focus = _related_capability_focus_codes(metadata.get("related_capability_focus"))
        if framework_code == "GB-T-22239-2019-L3":
            by_framework[framework_code].append(
                {
                    "sort_key": original_control_id,
                    "等级保护": metadata.get("level") or "",
                    "等保要求": metadata.get("requirement_group") or "",
                    "等保控制项": metadata.get("control_group") or "",
                    "等保三级控制要求": row["description"] or "",
                    "关联安全能力/关注点": related_capability_focus,
                }
            )
        elif framework_code == "CIS-CSC-V8.1.2":
            by_framework[framework_code].append(
                {
                    "sort_key": original_control_id,
                    "安全控制项": metadata.get("cis_control_id") or "",
                    "安全控制项名称": metadata.get("cis_control_name") or "",
                    "控制项描述": metadata.get("cis_control_description") or "",
                    "保护措施编号": original_control_id,
                    "名称": _standard_control_title_without_code(row["title"], original_control_id),
                    "资产类型": metadata.get("asset_type") or "",
                    "实施组": metadata.get("implementation_group") or "",
                    "安全功能": metadata.get("security_function") or "",
                    "描述": row["description"] or "",
                    "关联安全能力/关注点": related_capability_focus,
                }
            )
        elif framework_code == "NIST-CSF-2.0" and metadata.get("standard_section") == "core":
            by_framework["NIST-CSF-2.0:core"].append(
                {
                    "sort_key": metadata.get("display_order") or original_control_id,
                    "功能": metadata.get("function") or "",
                    "分类": metadata.get("category") or "",
                    "分类标识符": metadata.get("category_id") or "",
                    "分类标识符说明": row["description"] or "",
                    "关联安全能力/关注点": related_capability_focus,
                }
            )
        elif framework_code == "NIST-CSF-2.0" and metadata.get("standard_section") == "tiers":
            by_framework["NIST-CSF-2.0:tiers"].append(
                {
                    "sort_key": metadata.get("display_order") or metadata.get("original_tier_id") or "",
                    "层级": metadata.get("tier") or row["title"],
                    "网络安全风险治理（Cybersecurity Risk Governance, GV）": metadata.get("cybersecurity_risk_governance") or "",
                    "网络安全风险管理（Cybersecurity Risk Management, ID/PR/DE/RS/RC）": metadata.get("cybersecurity_risk_management") or "",
                }
            )
        elif framework_code == "ISO-IEC-27001-2022":
            by_framework[framework_code].append(
                {
                    "sort_key": original_control_id,
                    "控制类别": metadata.get("control_category") or "",
                    "控制编号": original_control_id,
                    "控制名称": metadata.get("control_name") or _standard_control_title_without_code(row["title"], original_control_id),
                    "控制描述": row["description"] or "",
                    "控制类型": metadata.get("control_type") or "",
                    "信息安全特性": metadata.get("information_security_properties") or "",
                    "网络安全概念": metadata.get("cybersecurity_concepts") or "",
                    "运营能力": metadata.get("operational_capabilities") or "",
                    "安全域": metadata.get("security_domains") or "",
                    "关联安全能力/关注点": related_capability_focus,
                }
            )
        elif framework_code == "DSP-SCF-2026":
            by_framework[framework_code].append(
                {
                    "sort_key": metadata.get("display_order") or original_control_id,
                    "SCF域": metadata.get("scf_domain") or "",
                    "策略原则": metadata.get("policy_principle") or "",
                    "策略意图": metadata.get("policy_intent") or "",
                    "SCF编号": original_control_id,
                    "SCF控制项": metadata.get("control_name") or _standard_control_title_without_code(row["title"], original_control_id),
                    "SCF控制项描述": row["description"] or "",
                    "安全策略项": metadata.get("security_policy_item") or "",
                    "NIST CSF功能分组": metadata.get("nist_csf_function_grouping") or "",
                    "关联安全能力/关注点": related_capability_focus,
                    "SCR-CMM 0级 未执行": metadata.get("scr_cmm_level_0") or "",
                    "SCR-CMM 1级 非正式执行": metadata.get("scr_cmm_level_1") or "",
                    "SCR-CMM 2级 已计划并跟踪": metadata.get("scr_cmm_level_2") or "",
                    "SCR-CMM 3级 定义良好": metadata.get("scr_cmm_level_3") or "",
                    "SCR-CMM 4级 量化控制": metadata.get("scr_cmm_level_4") or "",
                    "SCR-CMM 5级 持续改进": metadata.get("scr_cmm_level_5") or "",
                }
            )
        elif framework_code == "CRF-SAFEGUARDS-CORE-2026":
            by_framework[framework_code].append(
                {
                    "sort_key": metadata.get("display_order") or original_control_id,
                    "保障措施分类": metadata.get("safeguard_category") or "",
                    "保障措施域": metadata.get("safeguard_domain") or "",
                    "CRF成熟度等级": metadata.get("maturity_level") or "",
                    "Safeguard ID": original_control_id,
                    "保障措施描述": row["description"] or "",
                    "保障措施系统": metadata.get("safeguard_system") or "",
                    "关联安全能力/关注点": related_capability_focus,
                }
            )
        elif framework_code == "CRF-MATURITY-MODEL-2026":
            by_framework[framework_code].append(
                {
                    "sort_key": metadata.get("display_order") or metadata.get("original_tier_id") or "",
                    "等级编号": metadata.get("level_id") or metadata.get("original_tier_id") or "",
                    "成熟度等级": metadata.get("level_name") or "",
                    "英文等级": metadata.get("english_level") or "",
                    "等级定义": metadata.get("definition") or row["description"] or "",
                    "高层特征": metadata.get("characteristics") or "",
                    "边界说明": metadata.get("boundary") or "",
                }
            )
        elif framework_code == "NIST-800-53-REV5":
            english_name = metadata.get("english_name") or _standard_control_title_without_code(row["title"], original_control_id)
            chinese_name = metadata.get("chinese_name") or ""
            security_type = metadata.get("security_type") or ""
            security_type_column = "安全类型（O=组织层面控制，S=系统层面控制，O/S=组织和系统均涉及）"
            by_framework[framework_code].append(
                {
                    "sort_key": metadata.get("display_order") or original_control_id,
                    "安全控制类": metadata.get("control_family") or "",
                    "安全控制": " ".join(
                        value
                        for value in [metadata.get("base_control_id") or "", metadata.get("base_control_name") or ""]
                        if value
                    ),
                    "安全策略编号": original_control_id,
                    "安全控制项": f"{chinese_name}（{english_name}）" if chinese_name and english_name else chinese_name or english_name,
                    "安全级别": metadata.get("baseline_level") or "",
                    security_type_column: security_type,
                    "控制描述": row["description"] or "",
                    "关联安全能力/关注点": related_capability_focus,
                }
            )

    def row_count(framework: dict[str, Any]) -> int:
        return len(framework.get("rows", [])) + sum(len(tab.get("rows", [])) for tab in framework.get("tabs", []))

    def summary_badge(label: str, value: int, unit: str) -> dict[str, Any]:
        return {"label": label, "value": value, "unit": unit, "text": f"{value} {unit}{label}"}

    def unique_count(rows: list[dict[str, Any]], field: str) -> int:
        return len({str(row.get(field) or "").strip() for row in rows if str(row.get(field) or "").strip()})

    frameworks = [
        {
            "id": "mlps-level-3",
            "route": "/standards/mlps-level-3",
            "title": "等级保护三级",
            "frameworkCode": "GB-T-22239-2019-L3",
            "columns": ["等级保护", "等保要求", "等保控制项", "等保三级控制要求", "关联安全能力/关注点"],
            "rows": [
                {key: value for key, value in row.items() if key != "sort_key"}
                for row in sorted(by_framework["GB-T-22239-2019-L3"], key=lambda item: _control_sort_key(item["sort_key"]))
            ],
        },
        {
            "id": "cis-csc-v8",
            "route": "/standards/cis-csc-v8",
            "title": "CIS CSC V8",
            "frameworkCode": "CIS-CSC-V8.1.2",
            "columns": [
                "安全控制项",
                "安全控制项名称",
                "控制项描述",
                "保护措施编号",
                "名称",
                "资产类型",
                "实施组",
                "安全功能",
                "描述",
                "关联安全能力/关注点",
            ],
            "rows": [
                {key: value for key, value in row.items() if key != "sort_key"}
                for row in sorted(by_framework["CIS-CSC-V8.1.2"], key=lambda item: _control_sort_key(item["sort_key"]))
            ],
        },
        {
            "id": "nist-csf-2",
            "route": "/standards/nist-csf-2",
            "title": "NIST CSF 2.0",
            "frameworkCode": "NIST-CSF-2.0",
            "tabs": [
                {
                    "id": "csf-core",
                    "title": "CSF Core",
                    "columns": ["功能", "分类", "分类标识符", "分类标识符说明", "关联安全能力/关注点"],
                    "rows": [
                        {key: value for key, value in row.items() if key != "sort_key"}
                        for row in sorted(by_framework["NIST-CSF-2.0:core"], key=lambda item: _control_sort_key(item["sort_key"]))
                    ],
                },
                {
                    "id": "csf-tiers",
                    "title": "CSF Tiers",
                    "columns": [
                        "层级",
                        "网络安全风险治理（Cybersecurity Risk Governance, GV）",
                        "网络安全风险管理（Cybersecurity Risk Management, ID/PR/DE/RS/RC）",
                    ],
                    "rows": [
                        {key: value for key, value in row.items() if key != "sort_key"}
                        for row in sorted(by_framework["NIST-CSF-2.0:tiers"], key=lambda item: _control_sort_key(item["sort_key"]))
                    ],
                },
            ],
        },
        {
            "id": "iso-27001-2022",
            "route": "/standards/iso-27001-2022",
            "title": "ISO/IEC 27001:2022",
            "frameworkCode": "ISO-IEC-27001-2022",
            "columns": [
                "控制类别",
                "控制编号",
                "控制名称",
                "控制描述",
                "控制类型",
                "信息安全特性",
                "网络安全概念",
                "运营能力",
                "安全域",
                "关联安全能力/关注点",
            ],
            "rows": [
                {key: value for key, value in row.items() if key != "sort_key"}
                for row in sorted(by_framework["ISO-IEC-27001-2022"], key=lambda item: _control_sort_key(item["sort_key"]))
            ],
        },
        {
            "id": "dsp-level-2",
            "route": "/standards/dsp-level-2",
            "title": "DSP Secure Controls Framework (SCF) - 2026",
            "frameworkCode": "DSP-SCF-2026",
            "tabs": [
                {
                    "id": "dsp-scf-controls-2026",
                    "title": "SCF Controls",
                    "columns": [
                        "SCF域",
                        "策略原则",
                        "策略意图",
                        "SCF编号",
                        "SCF控制项",
                        "SCF控制项描述",
                        "NIST CSF功能分组",
                        "关联安全能力/关注点",
                    ],
                    "rows": [
                        {
                            key: value
                            for key, value in row.items()
                            if key
                            not in {
                                "sort_key",
                                "SCR-CMM 0级 未执行",
                                "SCR-CMM 1级 非正式执行",
                                "SCR-CMM 2级 已计划并跟踪",
                                "SCR-CMM 3级 定义良好",
                                "SCR-CMM 4级 量化控制",
                                "SCR-CMM 5级 持续改进",
                                "安全策略项",
                            }
                        }
                        for row in sorted(by_framework["DSP-SCF-2026"], key=lambda item: _control_sort_key(item["sort_key"]))
                    ],
                },
                {
                    "id": "dsp-scf-maturity-2026",
                    "title": "SCF成熟度",
                    "columns": [
                        "SCF域",
                        "SCF编号",
                        "SCF控制项",
                        "SCR-CMM 0级 未执行",
                        "SCR-CMM 1级 非正式执行",
                        "SCR-CMM 2级 已计划并跟踪",
                        "SCR-CMM 3级 定义良好",
                        "SCR-CMM 4级 量化控制",
                        "SCR-CMM 5级 持续改进",
                    ],
                    "rows": [
                        {
                            key: row.get(key, "")
                            for key in [
                                "SCF域",
                                "SCF编号",
                                "SCF控制项",
                                "SCR-CMM 0级 未执行",
                                "SCR-CMM 1级 非正式执行",
                                "SCR-CMM 2级 已计划并跟踪",
                                "SCR-CMM 3级 定义良好",
                                "SCR-CMM 4级 量化控制",
                                "SCR-CMM 5级 持续改进",
                            ]
                        }
                        for row in sorted(by_framework["DSP-SCF-2026"], key=lambda item: _control_sort_key(item["sort_key"]))
                    ],
                },
            ],
        },
        {
            "id": "crf",
            "route": "/standards/crf",
            "title": "CRF",
            "frameworkCode": "CRF-SAFEGUARDS-CORE-2026",
            "tabs": [
                {
                    "id": "crf-safeguards-core-2026",
                    "title": "Core",
                    "columns": [
                        "保障措施分类",
                        "保障措施域",
                        "CRF成熟度等级",
                        "Safeguard ID",
                        "保障措施描述",
                        "保障措施系统",
                        "关联安全能力/关注点",
                    ],
                    "rows": [
                        {key: value for key, value in row.items() if key != "sort_key"}
                        for row in sorted(by_framework["CRF-SAFEGUARDS-CORE-2026"], key=lambda item: _control_sort_key(item["sort_key"]))
                    ],
                },
                {
                    "id": "crf-maturity-model-2026",
                    "title": "成熟度",
                    "columns": ["等级编号", "成熟度等级", "英文等级", "等级定义", "高层特征", "边界说明"],
                    "rows": [
                        {key: value for key, value in row.items() if key != "sort_key"}
                        for row in sorted(by_framework["CRF-MATURITY-MODEL-2026"], key=lambda item: _control_sort_key(item["sort_key"]))
                    ],
                },
            ],
        },
        {
            "id": "nist-800-53-rev5",
            "route": "/standards/nist-800-53-rev5",
            "title": "NIST SP 800-53 Rev.5",
            "frameworkCode": "NIST-800-53-REV5",
            "columns": [
                "安全控制类",
                "安全控制",
                "安全策略编号",
                "安全控制项",
                "安全级别",
                "安全类型（O=组织层面控制，S=系统层面控制，O/S=组织和系统均涉及）",
                "控制描述",
                "关联安全能力/关注点",
            ],
            "rows": [
                {key: value for key, value in row.items() if key != "sort_key"}
                for row in sorted(by_framework["NIST-800-53-REV5"], key=lambda item: _control_sort_key(item["sort_key"]))
            ],
        },
    ]
    frameworks[0]["summaryBadges"] = [
        summary_badge("等保要求", unique_count(frameworks[0]["rows"], "等保要求"), "个"),
        summary_badge("等保控制项", unique_count(frameworks[0]["rows"], "等保控制项"), "个"),
        summary_badge("控制要求", len(frameworks[0]["rows"]), "条"),
    ]
    frameworks[1]["summaryBadges"] = [
        summary_badge("安全控制项", unique_count(frameworks[1]["rows"], "安全控制项"), "个"),
        summary_badge("保护措施", len(frameworks[1]["rows"]), "条"),
    ]
    frameworks[2]["summaryBadges"] = [
        summary_badge("CSF Core", len(frameworks[2]["tabs"][0]["rows"]), "条"),
        summary_badge("CSF Tiers", len(frameworks[2]["tabs"][1]["rows"]), "个"),
    ]
    frameworks[3]["summaryBadges"] = [
        summary_badge("控制类别", unique_count(frameworks[3]["rows"], "控制类别"), "个"),
        summary_badge("控制项", len(frameworks[3]["rows"]), "项"),
    ]
    frameworks[4]["summaryBadges"] = [
        summary_badge("SCF控制项", len(frameworks[4]["tabs"][0]["rows"]), "条"),
        summary_badge("成熟度描述", len(frameworks[4]["tabs"][1]["rows"]), "条"),
    ]
    frameworks[5]["summaryBadges"] = [
        summary_badge("保障措施", len(frameworks[5]["tabs"][0]["rows"]), "条"),
        summary_badge("成熟度等级", len(frameworks[5]["tabs"][1]["rows"]), "个"),
    ]
    frameworks[6]["summaryBadges"] = [
        summary_badge("安全控制类", unique_count(frameworks[6]["rows"], "安全控制类"), "个"),
        summary_badge("安全控制", unique_count(frameworks[6]["rows"], "安全控制"), "项"),
        summary_badge("安全策略", len(frameworks[6]["rows"]), "条"),
    ]

    payload = {
        "generated_at": datetime.now().isoformat(timespec="seconds"),
        "data_state": "ready",
        "stats": {
            "frameworks": len(frameworks),
            "controls": sum(row_count(framework) for framework in frameworks),
            "mlps_level_3_controls": len(frameworks[0]["rows"]),
            "cis_csc_v8_controls": len(frameworks[1]["rows"]),
            "nist_csf_2_core": len(frameworks[2]["tabs"][0]["rows"]),
            "nist_csf_2_tiers": len(frameworks[2]["tabs"][1]["rows"]),
            "iso_27001_2022_controls": len(frameworks[3]["rows"]),
            "dsp_scf_2026_controls": len(frameworks[4]["tabs"][0]["rows"]),
            "dsp_scf_2026_maturity": len(frameworks[4]["tabs"][1]["rows"]),
            "crf_safeguards_core_2026": len(frameworks[5]["tabs"][0]["rows"]),
            "crf_maturity_model_2026": len(frameworks[5]["tabs"][1]["rows"]),
            "nist_800_53_rev5_policies": len(frameworks[6]["rows"]),
        },
        "frameworks": frameworks,
    }
    output = resolve_project_path(output_path)
    output.parent.mkdir(parents=True, exist_ok=True)
    generated_at = payload["generated_at"]
    split_root = output.parent / "standards"
    split_root.mkdir(parents=True, exist_ok=True)
    files: list[str] = []

    def public_data_path(path: Path) -> str:
        try:
            relative = path.relative_to(FRONTEND_DATA_DIR)
            return f"./public/data/{relative.as_posix()}"
        except ValueError:
            return path.as_posix()

    index_frameworks: list[dict[str, Any]] = []
    for framework in frameworks:
        framework_id = str(framework.get("id") or "").strip()
        if not framework_id:
            continue
        common = {key: value for key, value in framework.items() if key not in {"rows", "tabs"}}
        if framework.get("tabs"):
            tab_indexes: list[dict[str, Any]] = []
            framework_dir = split_root / framework_id
            framework_dir.mkdir(parents=True, exist_ok=True)
            for tab in framework["tabs"]:
                tab_id = str(tab.get("id") or "table").strip()
                tab_output = framework_dir / f"{tab_id}.json"
                tab_payload = {
                    "generated_at": generated_at,
                    "data_state": "ready",
                    "frameworkId": framework_id,
                    "frameworkTitle": framework.get("title") or "",
                    "frameworkCode": framework.get("frameworkCode") or "",
                    "route": framework.get("route") or "",
                    **tab,
                    "totalRows": len(tab.get("rows", [])),
                }
                _write_json(tab_output, tab_payload)
                files.append(str(tab_output))
                tab_indexes.append(
                    {
                        key: value
                        for key, value in tab.items()
                        if key != "rows"
                    }
                    | {
                        "totalRows": len(tab.get("rows", [])),
                        "dataPath": public_data_path(tab_output),
                    }
                )
            index_frameworks.append(common | {"tabs": tab_indexes, "split": True})
        else:
            framework_output = split_root / f"{framework_id}.json"
            framework_payload = {
                "generated_at": generated_at,
                "data_state": "ready",
                **framework,
                "totalRows": len(framework.get("rows", [])),
            }
            _write_json(framework_output, framework_payload)
            files.append(str(framework_output))
            index_frameworks.append(
                common
                | {
                    "columns": framework.get("columns", []),
                    "totalRows": len(framework.get("rows", [])),
                    "dataPath": public_data_path(framework_output),
                    "split": True,
                }
            )

    index_payload = {
        "generated_at": generated_at,
        "data_state": "ready",
        "package_type": "standards-index",
        "stats": payload["stats"],
        "frameworks": index_frameworks,
    }
    _write_json(output, index_payload)
    files.insert(0, str(output))
    legacy_output = output.parent / "standards-data.json"
    if legacy_output != output:
        _write_json(legacy_output, index_payload)
        files.append(str(legacy_output))
    return {"count": payload["stats"]["controls"], "files": files, "stats": payload["stats"]}


def _latest_import_job_id_or_none(conn: sqlite3.Connection) -> str | None:
    row = conn.execute(
        """
        SELECT id
        FROM import_jobs
        ORDER BY finished_at DESC, started_at DESC
        LIMIT 1
        """
    ).fetchone()
    return row["id"] if row else None


def _second_batch_validation_messages(
    conn: sqlite3.Connection,
    import_job_id: str | None,
) -> list[dict[str, Any]]:
    if not import_job_id:
        return []
    try:
        messages = validation_messages(conn, import_job_id)
    except ValueError:
        messages = []

    second_batch_sheets = {
        "安全能力-安全工作",
        "安全能力-安全管理元素（high level）",
        "安全职能流程清单（完善L4）",
        "安全工作职能清单",
        "gartner工作岗位参考",
    }
    filtered = [
        message
        for message in messages
        if not message.get("sheet") or message.get("sheet") in second_batch_sheets
    ]

    staging_item_rows = conn.execute(
        f"""
        SELECT 'item' AS staging_type, id, type AS object_type, validation_status, validation_message
        FROM staging_items
        WHERE import_job_id = ?
          AND validation_status != 'ok'
          AND type IN ({", ".join("?" for _ in SECOND_BATCH_ITEM_TYPES)})
        """,
        (import_job_id, *SECOND_BATCH_ITEM_TYPES),
    ).fetchall()
    staging_relation_rows = conn.execute(
        f"""
        SELECT 'relation' AS staging_type, id, relation_type AS object_type, validation_status, validation_message
        FROM staging_relations
        WHERE import_job_id = ?
          AND validation_status != 'ok'
          AND relation_type IN ({", ".join("?" for _ in SECOND_BATCH_RELATION_TYPES)})
        """,
        (import_job_id, *SECOND_BATCH_RELATION_TYPES),
    ).fetchall()
    for row in [*staging_item_rows, *staging_relation_rows]:
        filtered.append(
            {
                "level": row["validation_status"],
                "sheet": "",
                "row": "",
                "message": row["validation_message"],
                "staging_type": row["staging_type"],
                "object_type": row["object_type"],
                "staging_id": row["id"],
            }
        )
    return filtered


def _unmatched_statistics(validations: list[dict[str, Any]]) -> dict[str, int]:
    process_keywords = ("流程", "process")
    function_keywords = ("职能", "function", "stakeholder")
    unmatched_keywords = ("未匹配", "unmatched", "missing", "not found")
    process_count = 0
    function_count = 0
    for validation in validations:
        message = str(validation.get("message") or "").lower()
        if any(keyword in message for keyword in unmatched_keywords):
            if any(keyword in message for keyword in process_keywords):
                process_count += 1
            if any(keyword in message for keyword in function_keywords):
                function_count += 1
    return {
        "unmatched_process_rows": process_count,
        "unmatched_work_function_rows": function_count,
    }


def export_second_batch_summary(
    conn: sqlite3.Connection,
    *,
    output_path: str | Path,
    import_job_id: str | None = None,
) -> dict[str, Any]:
    """Write a machine-readable second-batch export/verification summary."""

    output = resolve_project_path(output_path)
    output.parent.mkdir(parents=True, exist_ok=True)
    resolved_import_job_id = import_job_id or _latest_import_job_id_or_none(conn)
    item_counts = _item_counts_for_types(conn, SECOND_BATCH_ITEM_TYPES)
    relation_counts = _relation_counts_for_types(conn, SECOND_BATCH_RELATION_TYPES)
    validations = _second_batch_validation_messages(conn, resolved_import_job_id)
    payload = {
        "generated_at": conn.execute("SELECT datetime('now') AS now").fetchone()["now"],
        "import_job_id": resolved_import_job_id,
        "items_by_type": item_counts,
        "relations_by_type": relation_counts,
        "stats": {
            "second_batch_items": sum(item_counts.values()),
            "second_batch_relations": sum(relation_counts.values()),
            "validation_count": len(validations),
        },
        "validations": validations,
        "unmatched_statistics": _unmatched_statistics(validations),
        "missing_expected_item_types": [
            item_type for item_type, count in item_counts.items() if count == 0
        ],
        "missing_expected_relation_types": [
            relation_type for relation_type, count in relation_counts.items() if count == 0
        ],
    }
    _write_json(output, payload)
    return {"files": [str(output)], "stats": payload["stats"]}
