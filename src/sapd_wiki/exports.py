from __future__ import annotations

import csv
import json
import shutil
import sqlite3
from pathlib import Path
from typing import Any

from .paths import PROJECT_ROOT, resolve_project_path
from .queries import item_counts_by_type, relation_counts_by_type, table_counts


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

STAKEHOLDER_LAYERS = ("决策层", "管理层", "执行层", "监督层")


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
) -> dict[str, Any]:
    export_dir = _ensure_dir(output_dir)
    params: tuple[Any, ...] = ()
    where = ""
    if relation_type:
        where = "WHERE relation.relation_type = ?"
        params = (relation_type,)
    rows = conn.execute(
        f"""
        SELECT relation.id, relation.relation_type, relation.relation_label, relation.confidence,
               source.type AS source_type, source.code AS source_code, source.title AS source_title,
               target.type AS target_type, target.code AS target_code, target.title AS target_title,
               relation.source_file_id, relation.import_job_id, relation.metadata_json,
               relation.created_at, relation.updated_at
        FROM knowledge_relations AS relation
        JOIN knowledge_items AS source ON source.id = relation.source_item_id
        JOIN knowledge_items AS target ON target.id = relation.target_item_id
        {where}
        ORDER BY relation.relation_type, source.type, source.code, source.title, target.type, target.code, target.title
        """,
        params,
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
                "target_type",
                "target_code",
                "target_title",
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
    refs = _source_reference_map(conn, "item")
    relation_refs = _source_reference_map(conn, "relation")

    children_by_parent: dict[str, list[str]] = {}
    services_by_focus: dict[str, list[str]] = {}
    scopes_by_service: dict[str, list[str]] = {}
    capability_process_groups: dict[str, list[dict[str, Any]]] = {}
    focus_process_refs: dict[str, list[dict[str, Any]]] = {}
    process_group_by_reference: dict[str, str] = {}
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
        elif relation_type == "applies_to_scope":
            scopes_by_service.setdefault(source_id, []).append(target_id)
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
            mappings[key] = {
                "process_group": _brief_item(items.get(process_group_id), refs),
                "process_reference": _brief_item(items[process_reference_id], refs),
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
                key = (process_group_id, None)
                mappings.setdefault(
                    key,
                    {
                        "process_group": _brief_item(items[process_group_id], refs),
                        "process_reference": None,
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

    def make_focus(focus_id: str) -> dict[str, Any]:
        linked_focus_ids.add(focus_id)
        services = []
        for service_id in sort_ids(services_by_focus.get(focus_id, [])):
            service = _item_payload(items[service_id], refs)
            service["scopes"] = [
                _item_payload(items[scope_id], refs)
                for scope_id in sort_ids(scopes_by_service.get(service_id, []))
                if scope_id in items
            ]
            services.append(service)
        payload = _item_payload(items[focus_id], refs)
        payload["services"] = services
        payload["service_count"] = len(services)
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


def _item_counts_for_types(conn: sqlite3.Connection, item_types: tuple[str, ...]) -> dict[str, int]:
    counts = item_counts_by_type(conn)
    return {item_type: counts.get(item_type, 0) for item_type in item_types}


def _relation_counts_for_types(conn: sqlite3.Connection, relation_types: tuple[str, ...]) -> dict[str, int]:
    rows = conn.execute(
        f"""
        SELECT relation.relation_type, COUNT(*) AS count
        FROM knowledge_relations AS relation
        JOIN knowledge_items AS source ON source.id = relation.source_item_id
        JOIN knowledge_items AS target ON target.id = relation.target_item_id
        WHERE relation.relation_type IN ({", ".join("?" for _ in relation_types)})
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


def export_management_knowledge(
    conn: sqlite3.Connection,
    *,
    output_path: str | Path,
) -> dict[str, Any]:
    """Export second-batch management knowledge for the local frontend."""

    output = resolve_project_path(output_path)
    output.parent.mkdir(parents=True, exist_ok=True)

    items = _active_items(conn, SECOND_BATCH_ITEM_TYPES)
    refs = _source_reference_map(conn, "item")
    relations = _relation_rows(conn, SECOND_BATCH_RELATION_TYPES)

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
    stakeholders_by_process: dict[str, list[str]] = {}

    for relation in relations:
        source_id = relation["source_item_id"]
        target_id = relation["target_item_id"]
        relation_type = relation["relation_type"]
        source_type = relation["source_type"]
        target_type = relation["target_type"]
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
        elif relation_type == "stakeholder_by" and source_type == "process_reference" and target_type == "work_function":
            stakeholders_by_process.setdefault(source_id, []).append(target_id)

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

    payload = {
        "generated_at": conn.execute("SELECT datetime('now') AS now").fetchone()["now"],
        "stats": {
            "work_function_layers": len(work_function_layers),
            "work_functions": len(functions),
            "process_domains": len(process_domains),
            "process_groups": len(process_groups),
            "process_references": len(process_references),
            "gbt_42446_references": len(gbt_42446_references),
            "gartner_roles": len(gartner_role_payloads),
            "assets": len(asset_payloads),
        },
        "work_function_layers": work_function_layers,
        "security_processes": security_processes,
        "gbt_42446_references": gbt_42446_references,
        "gartner_roles": gartner_role_payloads,
        "assets": asset_payloads,
    }
    _write_json(output, payload)
    return {"count": len(work_function_layers), "files": [str(output)], "stats": payload["stats"]}


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
