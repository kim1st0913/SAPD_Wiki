from __future__ import annotations

import csv
import hashlib
import json
import re
import shutil
import sqlite3
import zipfile
from datetime import datetime
from pathlib import Path
from typing import Any
from xml.etree import ElementTree as ET

from .paths import PROJECT_ROOT, resolve_project_path
from .queries import item_counts_by_type, relation_counts_by_type, table_counts
from .transformers import is_blank_or_placeholder, service_parts, split_multivalue_text, split_scope_values


DEFAULT_EXPORT_DIR = PROJECT_ROOT / "data" / "exports"

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
    "development_product_component",
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
    "uses_development_product_component",
    "uses_product",
    "has_component",
    "implements_service",
    "part_of_system",
    "maps_to_product",
    "deployed_in_environment",
)

STAKEHOLDER_LAYERS = ("决策层", "管理层", "执行层", "监督层")

SCENE_TECHNICAL_MAPPING_SHEET = "作用域-安全技术服务-安全技术模块映射"
TECHNICAL_MEASURE_SOURCE_COLUMN = "安全技术模块/措施"
XLSX_MAIN_NS = "http://schemas.openxmlformats.org/spreadsheetml/2006/main"
XLSX_REL_NS = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
XLSX_PACKAGE_REL_NS = "http://schemas.openxmlformats.org/package/2006/relationships"
XLSX_NS = {
    "m": XLSX_MAIN_NS,
    "r": XLSX_REL_NS,
    "pr": XLSX_PACKAGE_REL_NS,
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


def _brief_item(item: dict[str, Any] | None, source_refs: dict[str, list[dict[str, Any]]]) -> dict[str, Any] | None:
    if not item:
        return None
    return {
        "id": item["id"],
        "type": item["type"],
        "code": item.get("code"),
        "title": item["title"],
        "description": item.get("description"),
        "category": item.get("category"),
        "sources": source_refs.get(item["id"], [])[:8],
    }


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
        "title": item["title"],
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
        if capability_id:
            for relation in capability_process_groups.get(capability_id, []):
                process_group_id = relation["target_item_id"]
                if process_group_id not in items:
                    continue
                if any(existing_key[0] == process_group_id for existing_key in mappings):
                    continue
                key = (process_group_id, None)
                mappings.setdefault(
                    key,
                    {
                        "process_group": _brief_item(items[process_group_id], refs),
                        "process_reference": None,
                        "activities": [],
                        "activity_status": "missing",
                        "activity_status_label": "待补充",
                        "missing_activity": True,
                        "stakeholders": make_stakeholders(focus_id),
                        "sources": _combine_sources(
                            relation_refs.get(relation["id"]),
                            refs.get(process_group_id),
                        ),
                    },
                )
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
    if style == "measure_note" or was_note_wrapper or name.upper().startswith("N/A"):
        return None, "pending"
    return None, "normal"


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

    inherited_values = {"B": "", "C": "", "D": "", "E": "", "H": ""}
    inherited_sources: dict[str, dict[str, Any]] = {}
    source_columns = {
        "B": "信息化环境",
        "C": "environment_segment",
        "D": "信息化对象",
        "E": "作用域",
        "H": "安全系统",
    }
    candidates: list[dict[str, Any]] = []
    for row_number in sorted(rows):
        row = rows[row_number]
        for column in ("B", "C", "D", "E", "H"):
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

        if not inherited_values["B"] or not inherited_values["D"]:
            continue
        measure_cell = row.get("G", {})
        style = _technical_measure_style(measure_cell.get("fill", {}))
        if not style:
            continue
        raw_measure = measure_cell.get("value")
        if is_blank_or_placeholder(raw_measure):
            continue
        for name, was_note_wrapper in _split_measure_names(raw_measure):
            category, status = _measure_category_status(name, style, was_note_wrapper)
            service_cell = row.get("F", {})
            sources = _combine_sources(
                [_source_payload(row_number, TECHNICAL_MEASURE_SOURCE_COLUMN, measure_cell.get("cell"), raw_measure)],
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
                    "scope_raw": inherited_values["E"],
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


def _stable_measure_id(name: str, category: str | None) -> str:
    digest = hashlib.sha1(f"{name}\0{category or ''}".encode("utf-8")).hexdigest()[:16]
    return f"security_technical_measure:{digest}"


def _build_security_technical_measures(
    conn: sqlite3.Connection,
    items: dict[str, dict[str, Any]],
    refs: dict[str, list[dict[str, Any]]],
) -> list[dict[str, Any]]:
    technical_services = {item_id: item for item_id, item in items.items() if item["type"] == "security_technical_service"}
    scopes = {item_id: item for item_id, item in items.items() if item["type"] == "scope_type"}
    focuses = {item_id: item for item_id, item in items.items() if item["type"] == "capability_focus"}
    service_by_code = {item["code"]: item_id for item_id, item in technical_services.items() if item.get("code")}
    service_by_title = {_normalize_measure_name(item["title"]): item_id for item_id, item in technical_services.items()}
    scope_by_code = {item["code"]: item_id for item_id, item in scopes.items() if item.get("code")}
    scope_by_title = {_normalize_measure_name(item["title"]): item_id for item_id, item in scopes.items()}
    focus_by_code = {item["code"]: item_id for item_id, item in focuses.items() if item.get("code")}

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
                "sources": [],
            },
        )
        entry["statuses"].add(candidate["status"])
        entry["sources"] = _combine_sources(entry["sources"], candidate["sources"], limit=50)

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

    payloads = []
    for (name, category), entry in grouped.items():
        service_ids = _sort_source_ids(technical_services, list(entry["service_ids"]))
        scope_ids = _sort_source_ids(scopes, list(entry["scope_ids"]))
        focus_ids = _sort_source_ids(focuses, list(entry["focus_ids"]))
        service_names = [technical_services[item_id]["title"] for item_id in service_ids]
        service_names.extend(sorted(set(entry["service_names"]) - set(service_names)))
        scope_names = [scopes[item_id]["title"] for item_id in scope_ids]
        scope_names.extend(sorted(set(entry["scope_names"]) - set(scope_names)))
        focus_names = [focuses[item_id]["title"] for item_id in focus_ids]
        focus_names.extend(sorted(set(entry["focus_names"]) - set(focus_names)))
        status = "pending" if "pending" in entry["statuses"] or not service_names or not scope_names else "normal"
        payloads.append(
            {
                "id": _stable_measure_id(name, category),
                "name": name,
                "category": category,
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
    assets = {item_id: item for item_id, item in items.items() if item["type"] == "asset"}
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
    work_function_layers = []
    for layer_id, layer_payload in sorted(
        layer_payloads.items(),
        key=lambda row: _layer_sort_key(layer_items_for_sort.get(row[0], ensure_virtual_layer(row[0]))),
    ):
        groups_for_layer = list(group_payloads_by_layer.get(layer_id, {}).values())
        for group in groups_for_layer:
            group["functions"] = sorted(group["functions"], key=lambda item: (item.get("code") or "", item["title"]))
        layer_payload["groups"] = sorted(groups_for_layer, key=lambda item: item["title"])
        work_function_layers.append(layer_payload)

    gbt_42446_references = [
        _brief_item(item, refs) or {}
        for item in _sort_item_rows(list(gbt_refs.values()))
    ]
    gartner_role_payloads = [
        _brief_item(item, refs) or {}
        for item in _sort_item_rows(list(gartner_roles.values()))
    ]
    asset_payloads = []
    for item in _sort_item_rows(list(assets.values())):
        metadata = _metadata(item)
        source_refs = refs.get(item["id"], [])
        first_ref = source_refs[0] if source_refs else {}
        asset_path = metadata.get("public_path") or metadata.get("path") or metadata.get("file_path")
        if asset_path:
            source_path = resolve_project_path(asset_path)
            if source_path.exists() and output.parent.name == "data" and output.parent.parent.name == "public":
                asset_dir = output.parent / "assets"
                asset_dir.mkdir(parents=True, exist_ok=True)
                copied_path = asset_dir / source_path.name
                if source_path.resolve() != copied_path.resolve():
                    shutil.copyfile(source_path, copied_path)
                frontend_root = output.parent.parent.parent
                asset_path = f"./{copied_path.relative_to(frontend_root).as_posix()}"
        asset_payloads.append(
            {
                "id": item["id"],
                "title": item["title"],
                "type": metadata.get("asset_type") or metadata.get("type") or "image",
                "source_sheet": metadata.get("source_sheet") or first_ref.get("sheet"),
                "path": asset_path,
                "sources": source_refs[:8],
            }
        )

    domain_by_title = {item["title"]: item_id for item_id, item in process_domains.items()}
    group_by_title = {item["title"]: item_id for item_id, item in process_groups.items()}
    process_domain_payloads: dict[str, dict[str, Any]] = {}
    process_groups_by_domain: dict[str, dict[str, dict[str, Any]]] = {}

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

    for domain_id in process_domains:
        ensure_process_domain(domain_id)

    for group_id, group in process_groups.items():
        domain_id = process_group_to_domain.get(group_id) or find_process_domain_id(group)
        ensure_process_group(domain_id, group_id, group["title"])

    for reference_id, reference in process_references.items():
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
        key=lambda row: (1 if str(row[0]).startswith("virtual:") else 0, row[1].get("code") or "", row[1]["title"]),
    ):
        groups_for_domain = list(process_groups_by_domain.get(domain_id, {}).values())
        for group in groups_for_domain:
            group["references"] = sorted(group["references"], key=lambda item: (item.get("code") or "", item["title"]))
        domain_payload["groups"] = sorted(groups_for_domain, key=lambda item: item["title"])
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

    scope_payloads = []
    for item in _sort_item_rows(list(scope_types.values())):
        payload_item = _brief_item(item, refs) or {}
        metadata = _metadata(item)
        payload_item["scenario"] = metadata.get("scenario") or item.get("category")
        payload_item["services"] = brief_many(technical_services, services_by_scope.get(item["id"], []))
        payload_item["information_objects"] = brief_many(information_objects, objects_by_scope.get(item["id"], []))
        scope_payloads.append(payload_item)

    module_payloads = []
    for item in _sort_item_rows(list(technology_modules.values())):
        payload_item = _brief_item(item, refs) or {}
        payload_item["services"] = brief_many(technical_services, services_by_module.get(item["id"], []))
        payload_item["systems"] = brief_many(security_systems, systems_by_module.get(item["id"], []))
        payload_item["products"] = brief_many(products, products_by_module.get(item["id"], []))
        payload_item["environments"] = brief_many(information_environments, environments_by_module.get(item["id"], []))
        module_payloads.append(payload_item)
    service_module_index, _service_module_index_by_id = _build_service_module_index(conn)
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
                if not scoped_service_ids:
                    scoped_service_ids = service_ids_for_object
                service_payloads = []
                for service_id in sort_source_ids(technical_services, scoped_service_ids):
                    if service_id not in technical_services:
                        continue
                    service_payload = _brief_item(technical_services[service_id], refs) or {}
                    service_payload["mapping_sources"] = _combine_sources(
                        *(
                            relation_sources(service_id, "protects_object", current_object_id)
                            for current_object_id in object_ids
                        ),
                        relation_sources(service_id, "applies_to_scope", scope_id),
                    )
                    module_payloads_for_service = []
                    for module_id in sort_source_ids(technology_modules, modules_by_service.get(service_id, [])):
                        if module_id not in technology_modules:
                            continue
                        module_environment_ids = environments_by_module.get(module_id, [])
                        if module_environment_ids and environment_id not in module_environment_ids:
                            continue
                        module_payload = _brief_item(technology_modules[module_id], refs) or {}
                        module_payload["mapping_sources"] = relation_sources(module_id, "implements_service", service_id)
                        module_payload["systems"] = brief_many(security_systems, systems_by_module.get(module_id, []))
                        module_payload["products"] = brief_many(products, products_by_module.get(module_id, []))
                        module_payloads_for_service.append(module_payload)
                    service_payload["modules"] = module_payloads_for_service
                    service_payload["module_count"] = len(module_payloads_for_service)
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
            "process_domains": len(process_domains),
            "process_groups": len(process_groups),
            "process_references": len(process_references),
            "process_activity_missing": sum(
                1
                for reference_id in process_references
                if not activities_by_process_reference.get(reference_id)
            ),
            "gbt_42446_references": len(gbt_42446_references),
            "gartner_roles": len(gartner_role_payloads),
            "scope_types": len(scope_payloads),
            "security_technology_modules": len(module_payloads),
            "security_technical_measures": len(security_technical_measures),
            "service_module_index": len(service_module_index),
            "information_environments": len(environment_scope_tree),
            "information_objects": sum(len(environment["objects"]) for environment in environment_scope_tree),
            "environment_scope_mappings": sum(environment["scope_mapping_count"] for environment in environment_scope_tree),
            "environment_service_mappings": sum(environment["service_count"] for environment in environment_scope_tree),
            "environment_module_mappings": sum(environment["module_count"] for environment in environment_scope_tree),
            "assets": len(asset_payloads),
        },
        "work_function_layers": work_function_layers,
        "security_processes": security_processes,
        "gbt_42446_references": gbt_42446_references,
        "gartner_roles": gartner_role_payloads,
        "scope_types": scope_payloads,
        "security_technology_modules": module_payloads,
        "security_technical_measures": security_technical_measures,
        "service_module_index": service_module_index,
        "environment_scope_tree": environment_scope_tree,
        "assets": asset_payloads,
    }
    _write_json(output, payload)
    return {"count": len(work_function_layers), "files": [str(output)], "stats": payload["stats"]}


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
    development_product_components = {item_id: item for item_id, item in items.items() if item["type"] == "development_product_component"}
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
    product_components_by_process: dict[str, list[str]] = {}
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
        elif relation_type == "uses_development_product_component" and target_type == "development_product_component":
            if source_type == "lifecycle_process":
                product_components_by_process.setdefault(source_id, []).append(target_id)
        elif relation_type == "uses_product" and source_type == "lifecycle_process" and target_type == "product":
            product_components_by_process.setdefault(source_id, []).append(target_id)
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

    def lifecycle_process_payload(process_id: str) -> dict[str, Any]:
        process = lifecycle_processes[process_id]
        metadata = _metadata(process)
        lifecycle_type = metadata.get("lifecycle_type")
        payload = detailed_item(process) or {}
        payload["lifecycle_type"] = lifecycle_type
        payload["order"] = metadata.get("order")

        if lifecycle_type == "application_security_development":
            payload["goal"] = metadata.get("goal") or process.get("description")
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
                detailed_item(technical_measures[measure_id])
                for measure_id in sort_lifecycle_items(technical_measures, measures_by_process.get(process_id, []))
                if measure_id in technical_measures
            ]
            payload["development_product_components"] = _brief_many(
                development_product_components,
                product_components_by_process.get(process_id, []),
                refs,
            )
            payload["security_activity_count"] = len(payload["security_activities"])
            payload["policy_requirement_count"] = len(payload["policy_requirements"])
            payload["technical_service_count"] = len(payload["technical_services"])
            payload["technology_module_count"] = len(payload["technology_modules"])
            payload["technical_measure_count"] = len(payload["technical_measures"])
            payload["development_product_component_count"] = len(payload["development_product_components"])
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
                detailed_item(technical_measures[measure_id])
                for measure_id in sort_lifecycle_items(technical_measures, measures_by_process.get(process_id, []))
                if measure_id in technical_measures
            ]
            payload["scene_count"] = len(payload["scenes"])
            payload["technical_service_count"] = len(payload["technical_services"])
            payload["technology_module_count"] = len(payload["technology_modules"])
            payload["technical_measure_count"] = len(payload["technical_measures"])
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

    application_system_payloads = []
    for system_type_id in _sort_source_ids(application_system_types, list(application_system_types.keys())):
        system_payload = detailed_item(application_system_types[system_type_id]) or {}
        system_payload["components"] = _brief_many(
            application_components,
            components_by_system_type.get(system_type_id, []),
            refs,
        )
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
            "development_product_components": len(development_product_components),
            "security_technical_measures": len(technical_measures),
            "service_module_index": len(service_module_index),
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
            "development_product_components": [
                detailed_item(development_product_components[item_id])
                for item_id in _sort_source_ids(development_product_components, list(development_product_components.keys()))
            ],
            "security_technical_measures": [
                detailed_item(technical_measures[item_id])
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
        "service_module_index": service_module_index,
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
    management = _read_frontend_json("management-knowledge.json")
    generated_at = capability_tree.get("generated_at") or management.get("generated_at") or conn.execute("SELECT datetime('now') AS now").fetchone()["now"]
    page = {
        "route": "/capability-mapping",
        "pageType": "capability-mapping-workbench",
        "priority": "P1",
        "subject": "capability / capability_focus",
        "title": "安全能力映射",
        "description": "以安全能力和关注点为主语，展示技术视角、管理视角、流程、标准、模块、作用域和来源证据引用。",
    }
    payload = _empty_workbench(page, generated_at, ["capability-tree.json", "management-knowledge.json"])
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
    service_index = _service_index_by_key(_wb_list(management.get("service_module_index")))
    measures = _wb_list(management.get("security_technical_measures"))

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
        _wb_group("standard-mapping", "标准 / 框架映射", ["maps_to_standard"], relations),
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
    payload["compatibility"]["warnings"] = [
        "capability-workbench.json 当前由 capability-tree.json 与 management-knowledge.json 的既有前端投影整理生成。",
        "标准 / 框架映射关系组已预留；当前旧数据包尚未提供稳定标准控制项投影。",
    ]
    output = resolve_project_path(output_path)
    output.parent.mkdir(parents=True, exist_ok=True)
    _write_json(output, payload)
    return {"count": len(relations), "files": [str(output)], "stats": stats}


def export_environment_workbench(
    conn: sqlite3.Connection,
    *,
    output_path: str | Path,
) -> dict[str, Any]:
    management = _read_frontend_json("management-knowledge.json")
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
    payload = _empty_workbench(page, generated_at, ["management-knowledge.json", "capability-tree.json"])
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
    measures = _wb_list(management.get("security_technical_measures"))

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
                            _wb_add_relation(relations, seen_relations, "part_of_system", module_obj, system_obj, label="属于系统")
                        for product in _wb_list(module.get("products")):
                            product_obj = _wb_add_object(objects, evidence_refs, product, "product", fallback_name="未命名产品")
                            _wb_add_relation(relations, seen_relations, "maps_to_product", module_obj, product_obj, label="映射产品")
                    for measure in measures:
                        if isinstance(measure, dict) and _measure_matches_service(measure, service):
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
        "environment-workbench.json 当前主要由 management-knowledge.json.environment_scope_tree 整理生成。",
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
    generated_at = lifecycle.get("generated_at") or conn.execute("SELECT datetime('now') AS now").fetchone()["now"]
    page = {
        "route": "/development-security/lc-ap",
        "pageType": "domain-module",
        "priority": "P3",
        "subject": "LC-AP lifecycle controlled projection",
        "title": "LC-AP 开发安全生命周期专项关系投影",
        "description": "以 LC-AP 阶段和活动为主语，展示受控的活动、控制点、能力、关注点、服务、模块和来源证据引用。",
    }
    payload = _empty_workbench(page, generated_at, ["lifecycle-knowledge.json", "capability-tree.json"])
    objects: dict[str, dict[str, dict[str, Any]]] = {key: {} for key in (
        "lifecycle_domain",
        "lifecycle_stage",
        "lifecycle_activity",
        "lifecycle_control",
        "lifecycle_requirement",
        "capability",
        "capability_focus",
        "security_technical_service",
        "security_technology_module",
    )}
    relations: list[dict[str, Any]] = []
    seen_relations: set[tuple[str, str, str]] = set()
    evidence_refs: dict[str, dict[str, Any]] = {}
    capability_by_code, focus_by_code = _capability_lookups(capability_tree)
    app_security = lifecycle.get("application_security_development") or {}
    service_index = _service_index_by_key(_wb_list(lifecycle.get("service_module_index")))
    domain_item = {
        "id": "lifecycle_domain:LC-AP",
        "code": "LC-AP",
        "title": "开发安全生命周期",
        "description": "LC-AP 开发安全生命周期受控专项关系投影。",
        "status": "active",
    }
    domain_obj = _wb_add_object(objects, evidence_refs, domain_item, "lifecycle_domain")
    navigator_children: list[dict[str, Any]] = []
    default_stage_id = None

    for process in _wb_list(app_security.get("processes")):
        stage_obj = _wb_add_object(objects, evidence_refs, process, "lifecycle_stage", fallback_name="未命名阶段")
        default_stage_id = default_stage_id or stage_obj["id"]
        _wb_add_relation(relations, seen_relations, "belongs_to", stage_obj, domain_obj, label="属于生命周期")
        navigator_children.append(_wb_navigator_node(process, "lifecycle_stage"))
        for activity in _wb_list(process.get("main_activities")):
            activity_obj = _wb_add_object(objects, evidence_refs, activity, "lifecycle_activity", fallback_name="未命名活动")
            _wb_add_relation(relations, seen_relations, "contains_activity", stage_obj, activity_obj, label="包含主要活动")
        for control in _wb_list(process.get("security_activities")):
            control_obj = _wb_add_object(objects, evidence_refs, control, "lifecycle_control", fallback_name="未命名控制点")
            _wb_add_relation(relations, seen_relations, "contains_control", stage_obj, control_obj, label="包含安全控制")
        for requirement in _wb_list(process.get("policy_requirements")):
            requirement_obj = _wb_add_object(objects, evidence_refs, requirement, "lifecycle_requirement", fallback_name="未命名要求")
            _wb_add_relation(relations, seen_relations, "belongs_to", requirement_obj, stage_obj, label="属于阶段")
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
        for service_obj_id, service in services_by_key.items():
            service_obj = objects["security_technical_service"].get(service_obj_id)
            index_entry = _matched_service_index(service_index, service)
            for module in _wb_list(index_entry.get("modules")):
                module_obj = _wb_add_object(objects, evidence_refs, module, "security_technology_module", fallback_name="未命名模块")
                _wb_add_relation(relations, seen_relations, "implemented_by_module", service_obj, module_obj, label="由模块实现", evidence_refs=_wb_collect_evidence(evidence_refs, service, module, index_entry))

    payload["navigator"] = {
        "defaultSelectedStageId": default_stage_id,
        "tree": [_wb_navigator_node(domain_item, "lifecycle_domain", navigator_children)],
        "grouping": ["lifecycle_domain", "lifecycle_stage", "lifecycle_activity", "lifecycle_control", "lifecycle_requirement"],
    }
    payload["objects"] = objects
    payload["relations"] = relations
    payload["evidenceRefs"] = sorted(evidence_refs.values(), key=lambda item: item["id"])
    payload["relationshipGroups"] = [
        _wb_group("lifecycle-stage", "生命周期阶段", ["belongs_to"], relations),
        _wb_group("activity-control", "活动 / 控制点", ["contains_activity", "contains_control"], relations),
        _wb_group("capability-mapping", "能力映射", ["maps_to_capability"], relations),
        _wb_group("focus-mapping", "关注点映射", ["maps_to_focus"], relations),
        _wb_group("service-module", "服务 / 模块关联", ["maps_to_service", "implemented_by_module"], relations),
    ]
    stats = _wb_stats(objects, relations, evidence_refs)
    payload["overview"] = {
        "defaultObjectId": default_stage_id,
        "object_type": "lifecycle_stage",
        "stats": stats,
    }
    payload["meta"]["stats"] = stats
    payload["compatibility"]["warnings"] = [
        "lifecycle-workbench.json 当前仅承载 LC-AP 开发安全生命周期受控专项关系投影。",
        "部分能力 / 关注点映射根据服务编码受控派生，后续可由独立 export 关系替代。",
        "data_lifecycle 仍保留在 lifecycle-knowledge.json 过渡包中，本投影不扩展为完整开发安全模块。",
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
        export_capability_workbench(conn, output_path=base_dir / "capability-workbench.json"),
        export_environment_workbench(conn, output_path=base_dir / "environment-workbench.json"),
        export_lifecycle_workbench(conn, output_path=base_dir / "lifecycle-workbench.json"),
    ]
    files = [file for result in results for file in result.get("files", [])]
    stats = {
        "capability_workbench_relations": results[0].get("stats", {}).get("relations", 0),
        "environment_workbench_relations": results[1].get("stats", {}).get("relations", 0),
        "lifecycle_workbench_relations": results[2].get("stats", {}).get("relations", 0),
    }
    return {"count": sum(stats.values()), "files": files, "stats": stats}


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
