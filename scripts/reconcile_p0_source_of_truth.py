from __future__ import annotations

import argparse
import json
import shutil
import sqlite3
import sys
from collections import Counter
from datetime import datetime
from pathlib import Path
from typing import Any


PROJECT_ROOT = Path(__file__).resolve().parents[1]
SRC_ROOT = PROJECT_ROOT / "src"
if str(SRC_ROOT) not in sys.path:
    sys.path.insert(0, str(SRC_ROOT))

from sapd_wiki.exports import (  # noqa: E402
    export_capability_tree,
    export_capability_workbench,
    export_lifecycle_knowledge,
    export_lifecycle_workbench,
    export_maintenance_knowledge,
    export_shared_lookups,
    export_standard_frameworks_data,
)


CURRENT_DB = PROJECT_ROOT / "data/database/sapd_wiki.sqlite3"
BACKUP_DB = PROJECT_ROOT / "data/database/backups/sapd_wiki-before-cleanup-20260601-current.sqlite3"
FRONTEND_DATA_DIR = PROJECT_ROOT / "frontend/capability-browser/public/data"
OUTPUT_DIR = PROJECT_ROOT / "data/exports/worker-verify/p0-source-of-truth-reconciliation-1.1"
SNAPSHOT_MANIFEST = PROJECT_ROOT / "data/exports/worker-verify/p0-recovery-stable-snapshot/snapshot-manifest.json"
RUNTIME_BASELINE_MANIFEST = (
    PROJECT_ROOT
    / "data/exports/worker-verify/p0-runtime-baseline-freeze/runtime-baseline-manifest.json"
)

PROTECTED_BASELINE_TYPES = [
    "work_function_layer",
    "work_function",
    "security_work",
    "process_reference",
    "application_system_type",
    "standard_control",
]

RECONCILIATION_SCOPE_TYPES = [
    "application_component",
    "application_system_type",
    "development_technical_module",
    "development_technical_service",
    "gbt_42446_task_reference",
    "lifecycle_activity",
    "lifecycle_process",
    "lifecycle_scene",
    "process_domain",
    "process_group",
    "process_reference",
    "security_activity",
    "security_policy_requirement",
    "security_technical_measure",
    "security_work",
    "software_development_type",
    "standard_control",
    "standard_framework",
    "standard_tier",
    "work_function",
    "work_function_group",
    "work_function_layer",
    "work_role_reference",
    "work_task",
]

MAINTENANCE_FIELDS = [
    "scope_types",
    "security_processes",
    "work_function_layers",
    "security_technical_services",
    "security_technology_modules",
    "security_technical_measures",
    "gbt_42446_references",
    "gartner_roles",
    "security_works",
]

WORKBENCH_RELATION_TYPES = [
    "maps_to_work",
    "maps_to_process",
    "maps_to_standard",
    "belongs_to_framework",
    "implemented_by_module",
    "uses_measure",
    "maps_to_focus",
]

LIFECYCLE_MEASURE_CONFIRMATIONS = [
    {
        "title": "应用程序威胁建模",
        "source": "LC-AP 应用安全开发生命周期",
        "classification": "security_technical_measure",
    },
    {
        "title": "制品安全加固",
        "source": "LC-AP 应用安全开发生命周期",
        "classification": "security_technical_measure",
    },
    {
        "title": "IaC代码安全测试",
        "source": "LC-AP 应用安全开发生命周期",
        "classification": "security_technical_measure",
    },
    {
        "title": "数据销毁",
        "source": "LC-DT 数据生命周期及相关映射表",
        "classification": "security_technical_measure",
    },
]

CONFIRMED_CANONICAL_STANDARDS = [
    "GB/T 22239-2019 网络安全等级保护基本要求 第三级",
    "NIST Cybersecurity Framework 2.0",
    "ISO/IEC 27001:2022",
    "DSP Secure Controls Framework (SCF) - 2026",
    "CIS Controls v8.1.2",
    "CRF Safeguards Core Edition v2026",
    "NIST SP 800-53 Rev.5",
]


def now() -> str:
    return datetime.now().isoformat(timespec="seconds")


def read_json(path: Path) -> Any:
    if not path.exists():
        return None
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")


def norm(value: Any) -> str:
    return " ".join(str(value or "").replace("\u00a0", " ").split()).strip()


def sha256(path: Path) -> str | None:
    if not path.exists():
        return None
    import hashlib

    digest = hashlib.sha256()
    with path.open("rb") as file:
        for chunk in iter(lambda: file.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def sqlite_connect(path: Path) -> sqlite3.Connection:
    conn = sqlite3.connect(path)
    conn.row_factory = sqlite3.Row
    return conn


def db_type_counts(db_path: Path) -> dict[str, int]:
    with sqlite_connect(db_path) as conn:
        rows = conn.execute(
            """
            SELECT type, COUNT(*) AS count
            FROM knowledge_items
            GROUP BY type
            ORDER BY type
            """
        ).fetchall()
    return {str(row["type"]): int(row["count"]) for row in rows}


def db_relation_counts(db_path: Path) -> dict[str, int]:
    with sqlite_connect(db_path) as conn:
        rows = conn.execute(
            """
            SELECT relation_type, COUNT(*) AS count
            FROM knowledge_relations
            GROUP BY relation_type
            ORDER BY relation_type
            """
        ).fetchall()
    return {str(row["relation_type"]): int(row["count"]) for row in rows}


def db_key_sets(db_path: Path, item_types: list[str]) -> dict[str, set[str]]:
    with sqlite_connect(db_path) as conn:
        rows = conn.execute(
            f"""
            SELECT type, code, title, metadata_json
            FROM knowledge_items
            WHERE type IN ({','.join('?' for _ in item_types)})
            ORDER BY type, code, title
            """,
            item_types,
        ).fetchall()
    result: dict[str, set[str]] = {item_type: set() for item_type in item_types}
    for row in rows:
        metadata = json.loads(row["metadata_json"] or "{}")
        if row["type"] == "standard_control":
            key = "|".join(
                [
                    norm(metadata.get("framework_code")),
                    norm(metadata.get("original_control_id") or row["code"]),
                    norm(row["title"]),
                ]
            )
        else:
            key = "|".join([norm(row["code"]), norm(row["title"])])
        result.setdefault(str(row["type"]), set()).add(key)
    return result


def table_columns(conn: sqlite3.Connection, table_name: str) -> list[str]:
    return [str(row["name"]) for row in conn.execute(f"PRAGMA table_info({table_name})").fetchall()]


def copy_table_rows_from_backup(
    conn: sqlite3.Connection,
    table_name: str,
    where_sql: str = "",
    params: tuple[Any, ...] = (),
) -> int:
    columns = table_columns(conn, table_name)
    quoted = ", ".join(columns)
    placeholders = ", ".join(f"backup.{table_name}.{column}" for column in columns)
    before = int(conn.execute(f"SELECT COUNT(*) FROM main.{table_name}").fetchone()[0])
    conn.execute(
        f"""
        INSERT OR IGNORE INTO main.{table_name} ({quoted})
        SELECT {placeholders}
        FROM backup.{table_name}
        {where_sql}
        """,
        params,
    )
    after = int(conn.execute(f"SELECT COUNT(*) FROM main.{table_name}").fetchone()[0])
    return after - before


def create_candidate_db(current_db: Path, backup_db: Path, candidate_db: Path) -> dict[str, Any]:
    candidate_db.parent.mkdir(parents=True, exist_ok=True)
    if candidate_db.exists():
        candidate_db.unlink()
    shutil.copy2(current_db, candidate_db)

    current_counts = db_type_counts(current_db)
    backup_counts = db_type_counts(backup_db)
    missing_scope_types = [
        item_type
        for item_type in RECONCILIATION_SCOPE_TYPES
        if current_counts.get(item_type, 0) == 0 and backup_counts.get(item_type, 0) > 0
    ]
    protected_missing = [
        item_type
        for item_type in PROTECTED_BASELINE_TYPES
        if current_counts.get(item_type, 0) == 0 and backup_counts.get(item_type, 0) > 0
    ]

    with sqlite_connect(candidate_db) as conn:
        conn.execute(f"ATTACH DATABASE {json.dumps(str(backup_db))} AS backup")
        copied: dict[str, int] = {}
        for table_name in ["source_files", "import_jobs"]:
            if conn.execute("SELECT name FROM sqlite_master WHERE type='table' AND name=?", (table_name,)).fetchone():
                copied[table_name] = copy_table_rows_from_backup(conn, table_name)

        if missing_scope_types:
            placeholders = ",".join("?" for _ in missing_scope_types)
            copied["knowledge_items"] = copy_table_rows_from_backup(
                conn,
                "knowledge_items",
                f"WHERE backup.knowledge_items.type IN ({placeholders})",
                tuple(missing_scope_types),
            )
        else:
            copied["knowledge_items"] = 0

        copied["knowledge_relations"] = copy_table_rows_from_backup(
            conn,
            "knowledge_relations",
            """
            WHERE EXISTS (
                SELECT 1 FROM main.knowledge_items AS source
                WHERE source.id = backup.knowledge_relations.source_item_id
            )
              AND EXISTS (
                SELECT 1 FROM main.knowledge_items AS target
                WHERE target.id = backup.knowledge_relations.target_item_id
            )
            """,
        )

        copied["source_references"] = copy_table_rows_from_backup(
            conn,
            "source_references",
            """
            WHERE (
                backup.source_references.target_type = 'item'
                AND EXISTS (
                    SELECT 1 FROM main.knowledge_items AS item
                    WHERE item.id = backup.source_references.target_id
                )
            )
            OR (
                backup.source_references.target_type = 'relation'
                AND EXISTS (
                    SELECT 1 FROM main.knowledge_relations AS relation
                    WHERE relation.id = backup.source_references.target_id
                )
            )
            """,
        )
        conn.commit()
        conn.execute("DETACH DATABASE backup")

    candidate_counts = db_type_counts(candidate_db)
    return {
        "path": str(candidate_db),
        "sha256": sha256(candidate_db),
        "sourceCurrentDb": str(current_db),
        "sourceBackupDb": str(backup_db),
        "strategy": "copy current SQLite, then insert only missing reconciliation-scope item types from 2026-06-01 backup; never overwrite existing current rows",
        "missingScopeTypesCopiedFromBackup": missing_scope_types,
        "protectedMissingTypesCopiedFromBackup": protected_missing,
        "copiedRows": copied,
        "candidateTypeCounts": candidate_counts,
    }


def export_from_db(db_path: Path, output_dir: Path) -> dict[str, Any]:
    output_dir.mkdir(parents=True, exist_ok=True)
    result: dict[str, Any] = {"sourceDb": str(db_path), "outputDir": str(output_dir), "exports": {}, "errors": []}
    with sqlite_connect(db_path) as conn:
        jobs = [
            ("maintenance", lambda: export_maintenance_knowledge(conn, output_path=output_dir / "maintenance-knowledge.json")),
            ("lifecycle_knowledge", lambda: export_lifecycle_knowledge(conn, output_path=output_dir / "lifecycle-knowledge.json")),
            ("lifecycle_workbench", lambda: export_lifecycle_workbench(conn, output_path=output_dir / "lifecycle-workbench.json")),
            ("standards", lambda: export_standard_frameworks_data(conn, output_path=output_dir / "standards-index.json")),
            ("shared_lookups", lambda: export_shared_lookups(conn, output_path=output_dir / "shared-lookups.json")),
            ("capability_tree", lambda: export_capability_tree(conn, output_path=output_dir / "capability-tree.json")),
            ("capability_workbench", lambda: export_capability_workbench(conn, output_path=output_dir / "capability-workbench.json")),
        ]
        for name, func in jobs:
            try:
                result["exports"][name] = func()
            except Exception as exc:  # keep reconciliation readback going
                result["errors"].append({"export": name, "error": str(exc)})
    result["standardTitlePostprocess"] = canonicalize_exported_standard_titles_from_db(db_path, output_dir)
    return result


def canonicalize_exported_standard_titles_from_db(db_path: Path, output_dir: Path) -> dict[str, Any]:
    """Align isolated standard export titles with standard_framework rows.

    The production exporter still has a few legacy display titles hardcoded.
    Reconciliation must compare the candidate SQLite facts against the runtime
    baseline, so the isolated export is normalized from the source DB's
    `standard_framework` objects. This writes only under worker-verify.
    """

    with sqlite_connect(db_path) as conn:
        rows = conn.execute(
            """
            SELECT code, title
            FROM knowledge_items
            WHERE status = 'active'
              AND type = 'standard_framework'
              AND code IS NOT NULL
            """
        ).fetchall()
    title_by_code = {norm(row["code"]): norm(row["title"]) for row in rows if norm(row["code"]) and norm(row["title"])}
    updates: list[dict[str, str]] = []
    for filename in ["standards-data.json", "standards-index.json"]:
        path = output_dir / filename
        payload = read_json(path)
        if not isinstance(payload, dict):
            continue
        changed = False
        for framework in payload.get("frameworks", []) or []:
            if not isinstance(framework, dict):
                continue
            code = norm(framework.get("frameworkCode") or framework.get("code"))
            title = title_by_code.get(code)
            if not title:
                continue
            before = norm(framework.get("title") or framework.get("name"))
            if before != title:
                framework["title"] = title
                if "name" in framework:
                    framework["name"] = title
                updates.append({"file": filename, "frameworkCode": code, "from": before, "to": title})
                changed = True
        if changed:
            write_json(path, payload)
    return {"updates": updates, "updatedCount": len(updates)}


def copy_runtime_passthrough_files(output_dir: Path) -> list[dict[str, Any]]:
    """Copy unchanged runtime baseline files needed for boundary checks.

    Environment Mapping is intentionally not regenerated in this task. The copy
    below records the frozen runtime baseline in the isolated candidate export
    directory so generic package-boundary audits can still validate layering
    without touching formal public/data.
    """

    copied: list[dict[str, Any]] = []
    for relative in ["environment-workbench.json"]:
        source = FRONTEND_DATA_DIR / relative
        target = output_dir / relative
        if source.exists():
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(source, target)
            copied.append({"path": relative, "source": str(source), "sha256": sha256(source)})
    return copied


def item_key(item: dict[str, Any]) -> str:
    return "|".join([norm(item.get("code")), norm(item.get("title") or item.get("name"))])


def maintenance_metrics(data_dir: Path) -> dict[str, Any]:
    payload = read_json(data_dir / "maintenance-knowledge.json") or {}
    metrics: dict[str, Any] = {"exists": bool(payload), "counts": {}, "keySets": {}}
    for field in MAINTENANCE_FIELDS:
        rows = payload.get(field) if isinstance(payload, dict) else []
        rows = rows if isinstance(rows, list) else []
        metrics["counts"][field] = len(rows)
        metrics["keySets"][field] = sorted({item_key(row) for row in rows if isinstance(row, dict)})
    metrics["stats"] = payload.get("stats", {}) if isinstance(payload, dict) else {}
    return metrics


def resolve_data_path(data_dir: Path, value: Any) -> Path | None:
    text = norm(value)
    if not text:
        return None
    if text.startswith("./public/data/"):
        return data_dir / text.removeprefix("./public/data/")
    if text.startswith("public/data/"):
        return data_dir / text.removeprefix("public/data/")
    path = Path(text)
    if path.is_absolute():
        return path
    return data_dir / path


def standard_row_key(row: dict[str, Any]) -> str:
    candidates = [
        row.get("控制编号"),
        row.get("保护措施编号"),
        row.get("SCF编号"),
        row.get("Safeguard ID"),
        row.get("安全策略编号"),
        row.get("分类标识符"),
        row.get("等级编号"),
        row.get("等保控制项"),
    ]
    first = next((norm(value) for value in candidates if norm(value)), "")
    title = next(
        (
            norm(row.get(field))
            for field in ["控制名称", "名称", "SCF控制项", "安全控制项", "保障措施描述", "分类标识符说明"]
            if norm(row.get(field))
        ),
        "",
    )
    return "|".join([first, title])


def standards_metrics(data_dir: Path) -> dict[str, Any]:
    index = read_json(data_dir / "standards-index.json") or {}
    data = read_json(data_dir / "standards-data.json") or {}
    metrics: dict[str, Any] = {
        "exists": bool(index),
        "stats": index.get("stats", {}) if isinstance(index, dict) else {},
        "frameworks": {},
        "frameworkTitleKeys": [],
        "pathIssues": [],
    }
    if isinstance(data, dict):
        metrics["frameworkTitleKeys"] = sorted(
            {
                "|".join([norm(item.get("frameworkCode")), norm(item.get("title") or item.get("name"))])
                for item in data.get("frameworks", []) or []
                if isinstance(item, dict)
            }
        )
    if not isinstance(index, dict):
        return metrics
    for framework in index.get("frameworks", []) or []:
        framework_id = norm(framework.get("id"))
        if not framework_id:
            continue
        targets = []
        if framework.get("tabs"):
            for tab in framework.get("tabs", []) or []:
                targets.append((norm(tab.get("id")), tab.get("dataPath")))
        else:
            targets.append(("rows", framework.get("dataPath")))
        for tab_id, data_path in targets:
            resolved = resolve_data_path(data_dir, data_path)
            rows: list[dict[str, Any]] = []
            if resolved is None:
                metrics["pathIssues"].append({"framework": framework_id, "tab": tab_id, "issue": "missing_data_path"})
            elif not resolved.exists():
                metrics["pathIssues"].append({"framework": framework_id, "tab": tab_id, "issue": "file_not_found", "path": str(resolved)})
            else:
                payload = read_json(resolved) or {}
                rows = payload.get("rows", []) if isinstance(payload, dict) else []
                rows = rows if isinstance(rows, list) else []
            key = f"{framework_id}/{tab_id}"
            metrics["frameworks"][key] = {
                "rowCount": len(rows),
                "keySet": sorted({standard_row_key(row) for row in rows if isinstance(row, dict)}),
            }
    return metrics


def workbench_metrics(data_dir: Path, filename: str) -> dict[str, Any]:
    payload = read_json(data_dir / filename) or {}
    result: dict[str, Any] = {"exists": bool(payload), "objectCounts": {}, "relationCounts": {}, "relationKeySets": {}}
    if not isinstance(payload, dict):
        return result
    objects = payload.get("objects", {})
    if isinstance(objects, dict):
        result["objectCounts"] = {key: len(value) for key, value in objects.items() if isinstance(value, dict)}
    relations = payload.get("relations", [])
    relations = relations if isinstance(relations, list) else []
    relation_counts = Counter(norm(row.get("type")) for row in relations if isinstance(row, dict))
    result["relationCounts"] = dict(sorted(relation_counts.items()))
    for relation_type in WORKBENCH_RELATION_TYPES:
        keys = {
            "|".join(
                [
                    norm(row.get("type")),
                    norm(row.get("sourceType")),
                    norm(row.get("sourceId")),
                    norm(row.get("targetType")),
                    norm(row.get("targetId")),
                ]
            )
            for row in relations
            if isinstance(row, dict) and norm(row.get("type")) == relation_type
        }
        result["relationKeySets"][relation_type] = sorted(keys)
    return result


def package_metrics(data_dir: Path) -> dict[str, Any]:
    return {
        "maintenance": maintenance_metrics(data_dir),
        "standards": standards_metrics(data_dir),
        "lifecycleWorkbench": workbench_metrics(data_dir, "lifecycle-workbench.json"),
        "capabilityWorkbench": workbench_metrics(data_dir, "capability-workbench.json"),
    }


def relationship_group_count(payload: dict[str, Any], group_id: str) -> int:
    for group in payload.get("relationshipGroups", []) if isinstance(payload, dict) else []:
        if isinstance(group, dict) and group.get("id") == group_id:
            if isinstance(group.get("count"), (int, float)):
                return int(group["count"])
            return len(group.get("relationIds") or [])
    return 0


def baseline_counts(data_dir: Path) -> dict[str, Any]:
    maintenance = read_json(data_dir / "maintenance-knowledge.json") or {}
    measures = read_json(data_dir / "maintenance/measures.json") or {}
    processes = read_json(data_dir / "maintenance/processes.json") or {}
    work_functions = read_json(data_dir / "maintenance/work-functions.json") or {}
    standards_data = read_json(data_dir / "standards-data.json") or {}
    standards_index = read_json(data_dir / "standards-index.json") or {}
    capability_workbench = read_json(data_dir / "capability-workbench.json") or {}
    lifecycle_workbench = read_json(data_dir / "lifecycle-workbench.json") or {}
    standard_names = [
        norm(item.get("title") or item.get("name"))
        for item in standards_data.get("frameworks", [])
        if isinstance(item, dict)
    ]
    measure_names = [
        norm(item.get("title") or item.get("name"))
        for item in measures.get("security_technical_measures", [])
        if isinstance(item, dict)
    ]
    return {
        "securityWorks": len(maintenance.get("security_works") or []),
        "securityProcesses": len(processes.get("security_processes") or []),
        "workFunctionLayers": len(work_functions.get("work_function_layers") or []),
        "applicationSystemTypes": int(((read_json(data_dir / "lifecycle-knowledge.json") or {}).get("stats") or {}).get("application_system_types") or 0),
        "securityTechnicalMeasures": len(measures.get("security_technical_measures") or []),
        "standards": {
            "frameworks": int((standards_data.get("stats") or {}).get("frameworks") or len(standards_data.get("frameworks") or [])),
            "controls": int((standards_index.get("stats") or {}).get("controls") or (standards_data.get("stats") or {}).get("controls") or 0),
        },
        "managementMapping": relationship_group_count(capability_workbench, "management-mapping"),
        "standardMapping": relationship_group_count(capability_workbench, "standard-mapping"),
        "lifecycle": {"relations": int(((lifecycle_workbench.get("meta") or {}).get("stats") or {}).get("relations") or 0)},
        "confirmedLifecycleMeasures": [
            {"title": item["title"], "present": item["title"] in measure_names}
            for item in LIFECYCLE_MEASURE_CONFIRMATIONS
        ],
        "confirmedCanonicalStandards": [
            {"title": title, "present": title in standard_names}
            for title in CONFIRMED_CANONICAL_STANDARDS
        ],
    }


def compare_counts(label: str, left: dict[str, int], right: dict[str, int]) -> dict[str, Any]:
    keys = sorted(set(left) | set(right))
    diffs = [
        {"key": key, "left": int(left.get(key, 0)), "right": int(right.get(key, 0)), "delta": int(left.get(key, 0)) - int(right.get(key, 0))}
        for key in keys
        if int(left.get(key, 0)) != int(right.get(key, 0))
    ]
    return {"label": label, "differenceCount": len(diffs), "differences": diffs}


def compare_key_sets(label: str, left: list[str], right: list[str], sample_limit: int = 20) -> dict[str, Any]:
    left_set = set(left)
    right_set = set(right)
    only_left = sorted(left_set - right_set)
    only_right = sorted(right_set - left_set)
    return {
        "label": label,
        "leftCount": len(left_set),
        "rightCount": len(right_set),
        "onlyLeftCount": len(only_left),
        "onlyRightCount": len(only_right),
        "onlyLeftSample": only_left[:sample_limit],
        "onlyRightSample": only_right[:sample_limit],
        "matches": not only_left and not only_right,
    }


def compare_metrics(left_name: str, left: dict[str, Any], right_name: str, right: dict[str, Any]) -> dict[str, Any]:
    comparisons: list[dict[str, Any]] = []
    for field in MAINTENANCE_FIELDS:
        comparisons.append(
            compare_key_sets(
                f"maintenance.{field}",
                left.get("maintenance", {}).get("keySets", {}).get(field, []),
                right.get("maintenance", {}).get("keySets", {}).get(field, []),
            )
        )
    for key in sorted(
        set(left.get("standards", {}).get("frameworks", {}))
        | set(right.get("standards", {}).get("frameworks", {}))
    ):
        comparisons.append(
            compare_key_sets(
                f"standards.{key}",
                left.get("standards", {}).get("frameworks", {}).get(key, {}).get("keySet", []),
                right.get("standards", {}).get("frameworks", {}).get(key, {}).get("keySet", []),
            )
        )
    comparisons.append(
        compare_key_sets(
            "standards.framework_titles",
            left.get("standards", {}).get("frameworkTitleKeys", []),
            right.get("standards", {}).get("frameworkTitleKeys", []),
        )
    )
    for package_key in ["lifecycleWorkbench", "capabilityWorkbench"]:
        comparisons.append(
            compare_counts(
                f"{package_key}.objects",
                left.get(package_key, {}).get("objectCounts", {}),
                right.get(package_key, {}).get("objectCounts", {}),
            )
        )
        comparisons.append(
            compare_counts(
                f"{package_key}.relations",
                left.get(package_key, {}).get("relationCounts", {}),
                right.get(package_key, {}).get("relationCounts", {}),
            )
        )
        for relation_type in WORKBENCH_RELATION_TYPES:
            comparisons.append(
                compare_key_sets(
                    f"{package_key}.relations.{relation_type}",
                    left.get(package_key, {}).get("relationKeySets", {}).get(relation_type, []),
                    right.get(package_key, {}).get("relationKeySets", {}).get(relation_type, []),
                )
            )
    summary = {
        "countComparisonsWithDiff": sum(1 for item in comparisons if item.get("differenceCount", 0) > 0),
        "keySetComparisonsWithDiff": sum(
            1 for item in comparisons if item.get("onlyLeftCount", 0) > 0 or item.get("onlyRightCount", 0) > 0
        ),
        "totalComparisons": len(comparisons),
    }
    return {"left": left_name, "right": right_name, "summary": summary, "comparisons": comparisons}


def has_absolute_data_path(metrics: dict[str, Any]) -> bool:
    for item in metrics.get("standards", {}).get("pathIssues", []):
        path = str(item.get("path") or item.get("dataPath") or "")
        if path.startswith("/") or path.startswith("file:") or ":\\\\" in path:
            return True
    return False


def audit_candidate_export_boundary(data_dir: Path) -> dict[str, Any]:
    errors: list[dict[str, Any]] = []
    warnings: list[dict[str, Any]] = []
    review_keys = {"sourceCells", "mergedRanges", "reviewRows", "triageCategory", "issueTypes", "workerVerify"}
    protected_top_keys = {"work_function_layers", "security_works", "security_processes", "standard_controls", "frameworks"}
    workbench_files = ["capability-workbench.json", "environment-workbench.json", "lifecycle-workbench.json"]
    protected_files = ["maintenance-knowledge.json", "maintenance-index.json", "lifecycle-knowledge.json", "standards-index.json", "standards-data.json"]

    def iter_keys(value: Any, prefix: str = ""):
        if isinstance(value, dict):
            for key, child in value.items():
                path = f"{prefix}.{key}" if prefix else str(key)
                yield path, key
                yield from iter_keys(child, path)
        elif isinstance(value, list):
            for index, child in enumerate(value[:200]):
                yield from iter_keys(child, f"{prefix}[{index}]")

    for filename in workbench_files:
        payload = read_json(data_dir / filename)
        if not isinstance(payload, dict):
            errors.append({"code": "missing_or_invalid_workbench", "path": filename})
            continue
        present = sorted(protected_top_keys.intersection(payload.keys()))
        if present:
            errors.append({"code": "protected_baseline_mixed_into_workbench", "path": filename, "keys": present})

    for filename in protected_files:
        payload = read_json(data_dir / filename)
        if not isinstance(payload, dict):
            errors.append({"code": "missing_or_invalid_protected_baseline", "path": filename})
            continue
        present = sorted({"relationshipGroups", "objects", "relations", "navigator", "overview"}.intersection(payload.keys()))
        if present:
            errors.append({"code": "workbench_projection_mixed_into_protected_baseline", "path": filename, "keys": present})

    for filename in ["standards-index.json", "standards-data.json"]:
        payload = read_json(data_dir / filename)
        for framework in payload.get("frameworks", []) if isinstance(payload, dict) else []:
            targets = []
            if isinstance(framework, dict):
                if framework.get("dataPath"):
                    targets.append(framework.get("dataPath"))
                targets.extend(tab.get("dataPath") for tab in framework.get("tabs", []) if isinstance(tab, dict))
            for data_path in targets:
                text = norm(data_path)
                if text.startswith("/") or text.startswith("file:") or ":\\\\" in text:
                    errors.append({"code": "absolute_standard_data_path", "path": filename, "dataPath": text})
                elif not text.startswith("./public/data/"):
                    errors.append({"code": "non_relative_standard_data_path", "path": filename, "dataPath": text})
                elif not (data_dir / text.removeprefix("./public/data/")).exists():
                    errors.append({"code": "missing_standard_split_path", "path": filename, "dataPath": text})

    for filename in [*workbench_files, *protected_files, "capability-tree.json"]:
        payload = read_json(data_dir / filename)
        if payload is None:
            continue
        hits = [path for path, key in iter_keys(payload) if key in review_keys][:20]
        if hits:
            errors.append({"code": "review_only_key_in_candidate_export", "path": filename, "sampleKeys": hits})

    status = "pass" if not errors and not warnings else "pass_with_warnings" if not errors else "issues_found"
    return {"status": status, "errors": errors, "warnings": warnings}


def readiness_report(
    candidate_counts: dict[str, Any],
    protected_status: list[dict[str, Any]],
    normalized_diff: dict[str, Any],
    boundary: dict[str, Any],
    candidate_exports: dict[str, Any],
    candidate_metrics: dict[str, Any],
) -> dict[str, Any]:
    blocking: list[dict[str, Any]] = []
    needs_user_confirmation: list[dict[str, Any]] = []

    if boundary["errors"]:
        blocking.append({"code": "candidate_export_boundary_errors", "count": len(boundary["errors"])})
    if candidate_exports.get("errors"):
        needs_user_confirmation.append({"code": "candidate_export_errors", "errors": candidate_exports.get("errors")})
    expected = {
        "securityWorks": 80,
        "securityProcesses": 10,
        "workFunctionLayers": 4,
        "applicationSystemTypes": 3,
        "securityTechnicalMeasures": 30,
        "managementMapping": 613,
        "standardMapping": 4033,
    }
    for key, value in expected.items():
        if int(candidate_counts.get(key, 0)) != value:
            needs_user_confirmation.append({"code": "candidate_count_diff", "key": key, "expected": value, "actual": candidate_counts.get(key)})
    if int(candidate_counts.get("standards", {}).get("controls", 0)) != 4893:
        blocking.append({"code": "standards_controls_not_4893", "actual": candidate_counts.get("standards", {}).get("controls")})
    if int(candidate_counts.get("standards", {}).get("frameworks", 0)) != 7:
        needs_user_confirmation.append({"code": "standards_frameworks_diff", "expected": 7, "actual": candidate_counts.get("standards", {}).get("frameworks")})
    if int(candidate_counts.get("lifecycle", {}).get("relations", 0)) != 542:
        needs_user_confirmation.append({"code": "lifecycle_relations_diff", "expected": 542, "actual": candidate_counts.get("lifecycle", {}).get("relations")})
    if not all(item["present"] for item in candidate_counts.get("confirmedLifecycleMeasures", [])):
        blocking.append({"code": "missing_confirmed_lifecycle_measures", "items": candidate_counts.get("confirmedLifecycleMeasures", [])})
    if not all(item["present"] for item in candidate_counts.get("confirmedCanonicalStandards", [])):
        needs_user_confirmation.append({"code": "missing_confirmed_canonical_standard_names", "items": candidate_counts.get("confirmedCanonicalStandards", [])})
    if candidate_metrics.get("standards", {}).get("pathIssues"):
        blocking.append({"code": "standard_path_issues", "issues": candidate_metrics.get("standards", {}).get("pathIssues")})
    for item in protected_status:
        if item["current"] == 0 and item["backup20260601"] > 0 and item["candidate"] == 0:
            blocking.append({"code": "protected_type_not_reconciled", "itemType": item["itemType"]})
    summary = normalized_diff.get("summary", {})
    if summary.get("countComparisonsWithDiff") or summary.get("keySetComparisonsWithDiff"):
        needs_user_confirmation.append({"code": "normalized_diff_remaining", "summary": summary})

    if blocking:
        status = "blocked"
        recommendation = "不建议进入人工批准替换阶段；需要先解决 blocking 问题。"
    elif needs_user_confirmation:
        status = "not_ready"
        recommendation = "不建议直接替换；需要用户判断 normalized diff 与业务差异。"
    else:
        status = "ready_for_manual_approval"
        recommendation = "可进入人工批准替换阶段；仍不得由脚本自动替换当前 SQLite。"
    return {
        "status": status,
        "recommendation": recommendation,
        "blockingIssues": blocking,
        "needsUserConfirmation": needs_user_confirmation,
        "manualReplacementAllowedByThisRun": False,
        "formalSqliteModified": False,
        "publicDataOverwritten": False,
    }


def comparison_digest(comparison: dict[str, Any], limit: int = 30) -> list[dict[str, Any]]:
    rows = []
    for item in comparison.get("comparisons", []):
        if item.get("differenceCount", 0) or item.get("onlyLeftCount", 0) or item.get("onlyRightCount", 0):
            rows.append(item)
    return rows[:limit]


def write_diff_files(output_dir: Path, stem: str, title: str, comparison: dict[str, Any]) -> None:
    write_json(output_dir / f"{stem}.json", comparison)
    lines = [
        f"# {title}",
        "",
        f"- left: `{comparison['left']}`",
        f"- right: `{comparison['right']}`",
        f"- countComparisonsWithDiff: `{comparison['summary']['countComparisonsWithDiff']}`",
        f"- keySetComparisonsWithDiff: `{comparison['summary']['keySetComparisonsWithDiff']}`",
        f"- totalComparisons: `{comparison['summary']['totalComparisons']}`",
        "",
        "## Difference Digest",
        "",
    ]
    digest = comparison_digest(comparison, limit=40)
    if not digest:
        lines.append("未发现 normalized diff。")
    for item in digest:
        if "differenceCount" in item:
            lines.append(f"- `{item['label']}` count differences: `{item['differenceCount']}`")
            for diff in item.get("differences", [])[:8]:
                lines.append(f"  - `{diff['key']}`: left=`{diff['left']}`, right=`{diff['right']}`, delta=`{diff['delta']}`")
        else:
            lines.append(
                f"- `{item['label']}` key diff: onlyLeft=`{item['onlyLeftCount']}`, onlyRight=`{item['onlyRightCount']}`"
            )
            if item.get("onlyLeftSample"):
                lines.append(f"  - onlyLeft sample: `{item['onlyLeftSample'][:5]}`")
            if item.get("onlyRightSample"):
                lines.append(f"  - onlyRight sample: `{item['onlyRightSample'][:5]}`")
    (output_dir / f"{stem}.md").write_text("\n".join(lines) + "\n", encoding="utf-8")


def write_boundary_files(output_dir: Path, boundary: dict[str, Any]) -> None:
    write_json(output_dir / "candidate-export-boundary-audit.json", boundary)
    lines = [
        "# Candidate Export Boundary Audit",
        "",
        f"- status: `{boundary['status']}`",
        f"- errors: `{len(boundary['errors'])}`",
        f"- warnings: `{len(boundary['warnings'])}`",
        "",
    ]
    if boundary["errors"]:
        lines.extend(["## Errors", ""])
        lines.extend(f"- `{item.get('code')}`: `{json.dumps(item, ensure_ascii=False)}`" for item in boundary["errors"])
    if boundary["warnings"]:
        lines.extend(["## Warnings", ""])
        lines.extend(f"- `{item.get('code')}`: `{json.dumps(item, ensure_ascii=False)}`" for item in boundary["warnings"])
    (output_dir / "candidate-export-boundary-audit.md").write_text("\n".join(lines) + "\n", encoding="utf-8")


def write_readiness_files(output_dir: Path, readiness: dict[str, Any]) -> None:
    write_json(output_dir / "candidate-readiness-for-replacement.json", readiness)
    lines = [
        "# Candidate Readiness For Replacement",
        "",
        f"- status: `{readiness['status']}`",
        f"- recommendation: {readiness['recommendation']}",
        f"- formalSqliteModified: `{readiness['formalSqliteModified']}`",
        f"- publicDataOverwritten: `{readiness['publicDataOverwritten']}`",
        "",
        "## Blocking Issues",
        "",
    ]
    lines.extend([f"- `{item.get('code')}`: `{json.dumps(item, ensure_ascii=False)}`" for item in readiness["blockingIssues"]] or ["无。"])
    lines.extend(["", "## Needs User Confirmation", ""])
    lines.extend(
        [f"- `{item.get('code')}`: `{json.dumps(item, ensure_ascii=False)}`" for item in readiness["needsUserConfirmation"]]
        or ["无。"]
    )
    (output_dir / "candidate-readiness-for-replacement.md").write_text("\n".join(lines) + "\n", encoding="utf-8")


def write_markdown(report: dict[str, Any], path: Path) -> None:
    lines = [
        "# P0 Source-of-Truth Reconciliation 1.1",
        "",
        "## Scope",
        "",
        "- mode: `read-only reconciliation + candidate generation`",
        "- current SQLite is not replaced.",
        "- `frontend/capability-browser/public/data` is not overwritten.",
        "- candidate files are written only under `data/exports/worker-verify/p0-source-of-truth-reconciliation-1.1/`.",
        "",
        "## Inputs",
        "",
        f"- currentDb: `{report['inputs']['currentDb']}`",
        f"- backupDb20260601: `{report['inputs']['backupDb20260601']}`",
        f"- frontendFrozenDataDir: `{report['inputs']['frontendFrozenDataDir']}`",
        f"- recoverySnapshotManifest: `{report['inputs']['recoverySnapshotManifest']}`",
        f"- runtimeBaselineManifest: `{report['inputs']['runtimeBaselineManifest']}`",
        "",
        "## SQLite Type Count Findings",
        "",
    ]
    for item in report["sqliteComparisons"]["protectedBaselineStatus"]:
        lines.append(
            f"- `{item['itemType']}`: current=`{item['current']}`, backup20260601=`{item['backup20260601']}`, candidate=`{item['candidate']}`"
        )
    lines.extend(
        [
            "",
            "## Candidate",
            "",
            f"- candidateDb: `{report['candidate']['path']}`",
            f"- sha256: `{report['candidate']['sha256']}`",
            f"- strategy: {report['candidate']['strategy']}",
            f"- missingScopeTypesCopiedFromBackup: `{len(report['candidate']['missingScopeTypesCopiedFromBackup'])}`",
            f"- protectedMissingTypesCopiedFromBackup: `{len(report['candidate']['protectedMissingTypesCopiedFromBackup'])}`",
            f"- copiedRows: `{report['candidate']['copiedRows']}`",
            "",
            "## Normalized Diff Summary",
            "",
        ]
    )
    for key in ["frontendVsCurrentExport", "frontendVsBackupExport", "frontendVsCandidateExport", "currentExportVsCandidateExport"]:
        comparison = report["normalizedDiffs"][key]
        summary = comparison["summary"]
        lines.extend(
            [
                f"### {key}",
                "",
                f"- countComparisonsWithDiff: `{summary['countComparisonsWithDiff']}`",
                f"- keySetComparisonsWithDiff: `{summary['keySetComparisonsWithDiff']}`",
                f"- totalComparisons: `{summary['totalComparisons']}`",
                "",
            ]
        )
        for item in comparison_digest(comparison, limit=12):
            if "differenceCount" in item:
                lines.append(f"- `{item['label']}` count differences: `{item['differenceCount']}`")
            else:
                lines.append(
                    f"- `{item['label']}` key diff: onlyLeft=`{item['onlyLeftCount']}`, onlyRight=`{item['onlyRightCount']}`"
                )
        lines.append("")
    lines.extend(
        [
            "## Candidate Readiness",
            "",
            f"- status: `{report['candidateReadiness']['status']}`",
            f"- recommendation: {report['candidateReadiness']['recommendation']}",
            "",
            "## Preliminary Conclusions",
            "",
        ]
    )
    for conclusion in report["preliminaryConclusions"]:
        lines.append(f"- {conclusion}")
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")


def build_report(args: argparse.Namespace) -> dict[str, Any]:
    output_dir = Path(args.output_dir).resolve()
    output_dir.mkdir(parents=True, exist_ok=True)
    candidate_db = output_dir / "protected-baseline-reconciled-candidate.sqlite"

    current_counts = db_type_counts(CURRENT_DB)
    backup_counts = db_type_counts(BACKUP_DB)
    current_rel_counts = db_relation_counts(CURRENT_DB)
    backup_rel_counts = db_relation_counts(BACKUP_DB)
    candidate = create_candidate_db(CURRENT_DB, BACKUP_DB, candidate_db)
    candidate_counts = db_type_counts(candidate_db)
    candidate_rel_counts = db_relation_counts(candidate_db)

    exports = {
        "current": export_from_db(CURRENT_DB, output_dir / "exports-current-sqlite"),
        "backup20260601": export_from_db(BACKUP_DB, output_dir / "exports-backup-20260601-sqlite"),
        "candidate": export_from_db(candidate_db, output_dir / "exports-candidate-sqlite"),
    }
    exports["candidate"]["passthroughRuntimeBaselineFiles"] = copy_runtime_passthrough_files(output_dir / "exports-candidate-sqlite")
    metrics = {
        "frontendFrozenJson": package_metrics(FRONTEND_DATA_DIR),
        "currentSqliteExport": package_metrics(output_dir / "exports-current-sqlite"),
        "backup20260601SqliteExport": package_metrics(output_dir / "exports-backup-20260601-sqlite"),
        "candidateSqliteExport": package_metrics(output_dir / "exports-candidate-sqlite"),
    }
    counts = {
        "frontendFrozenJson": baseline_counts(FRONTEND_DATA_DIR),
        "currentSqliteExport": baseline_counts(output_dir / "exports-current-sqlite"),
        "backup20260601SqliteExport": baseline_counts(output_dir / "exports-backup-20260601-sqlite"),
        "candidateSqliteExport": baseline_counts(output_dir / "exports-candidate-sqlite"),
    }

    protected_status = [
        {
            "itemType": item_type,
            "current": current_counts.get(item_type, 0),
            "backup20260601": backup_counts.get(item_type, 0),
            "candidate": candidate_counts.get(item_type, 0),
        }
        for item_type in PROTECTED_BASELINE_TYPES
    ]

    normalized_diffs = {
        "frontendVsCurrentExport": compare_metrics(
            "frontendFrozenJson", metrics["frontendFrozenJson"], "currentSqliteExport", metrics["currentSqliteExport"]
        ),
        "frontendVsBackupExport": compare_metrics(
            "frontendFrozenJson",
            metrics["frontendFrozenJson"],
            "backup20260601SqliteExport",
            metrics["backup20260601SqliteExport"],
        ),
        "frontendVsCandidateExport": compare_metrics(
            "frontendFrozenJson", metrics["frontendFrozenJson"], "candidateSqliteExport", metrics["candidateSqliteExport"]
        ),
        "currentExportVsCandidateExport": compare_metrics(
            "currentSqliteExport", metrics["currentSqliteExport"], "candidateSqliteExport", metrics["candidateSqliteExport"]
        ),
    }
    boundary = audit_candidate_export_boundary(output_dir / "exports-candidate-sqlite")
    readiness = readiness_report(
        counts["candidateSqliteExport"],
        protected_status,
        normalized_diffs["frontendVsCandidateExport"],
        boundary,
        exports["candidate"],
        metrics["candidateSqliteExport"],
    )

    front_vs_candidate = normalized_diffs["frontendVsCandidateExport"]["summary"]
    missing_protected = [item for item in protected_status if item["current"] == 0 and item["backup20260601"] > 0]
    conclusions = [
        "当前 SQLite 不是完整导出源：6 类受保护基线在 current 中为 0，而 2026-06-01 备份和候选库中可补齐。",
        "候选库只是审计产物：它复制 current SQLite 后只插入 current 缺失、backup 存在的 reconciliation 范围对象，不替换正式库。",
        "是否能替换 current SQLite 不能只看 hash；应以 normalized diff 中业务 key、核心计数、关系计数和路径边界为准。",
    ]
    if front_vs_candidate["keySetComparisonsWithDiff"] or front_vs_candidate["countComparisonsWithDiff"]:
        conclusions.append(
            "候选导出与当前前端冻结 JSON 仍存在 normalized diff；当前不应直接替换 current SQLite，应先人工判断差异来源。"
        )
    else:
        conclusions.append("候选导出与当前前端冻结 JSON normalized diff 未发现差异，可进入人工批准替换前评审。")
    conclusions.append(
        "维护包 security_technical_measures 的 4 条差异已按用户确认重新定性：`应用程序威胁建模`、`制品安全加固`、`IaC代码安全测试` 来自 LC-AP，`数据销毁` 来自 LC-DT；这 4 项应纳入安全技术措施，不再作为旧 B 类误恢复风险。"
    )

    report = {
        "generatedAt": now(),
        "task": "P0 Source-of-Truth Reconciliation 1.1",
        "mode": args.mode,
        "inputs": {
            "currentDb": str(CURRENT_DB),
            "currentDbSha256": sha256(CURRENT_DB),
            "backupDb20260601": str(BACKUP_DB),
            "backupDb20260601Sha256": sha256(BACKUP_DB),
            "frontendFrozenDataDir": str(FRONTEND_DATA_DIR),
            "recoverySnapshotManifest": str(SNAPSHOT_MANIFEST) if SNAPSHOT_MANIFEST.exists() else None,
            "runtimeBaselineManifest": str(RUNTIME_BASELINE_MANIFEST) if RUNTIME_BASELINE_MANIFEST.exists() else None,
        },
        "safetyBoundary": {
            "replacedCurrentSqlite": False,
            "overwrotePublicData": False,
            "modifiedFrontendUi": False,
            "modifiedSourceExcelOrSvg": False,
            "outputDir": str(output_dir),
        },
        "sqliteComparisons": {
            "protectedBaselineStatus": protected_status,
            "missingProtectedBaselineTypesInCurrent": missing_protected,
            "currentTypeCounts": current_counts,
            "backup20260601TypeCounts": backup_counts,
            "candidateTypeCounts": candidate_counts,
            "currentRelationCounts": current_rel_counts,
            "backup20260601RelationCounts": backup_rel_counts,
            "candidateRelationCounts": candidate_rel_counts,
        },
        "candidate": candidate,
        "exports": exports,
        "metrics": metrics,
        "counts": counts,
        "normalizedDiffs": normalized_diffs,
        "candidateExportBoundaryAudit": boundary,
        "candidateReadiness": readiness,
        "lifecycleMeasureClassification": {
            "status": "confirmed_include_as_security_technical_measure",
            "notOldBClassOverrestoreRisk": True,
            "frontendFrozenMeasureCountMayBeIncomplete": True,
            "confirmedItems": LIFECYCLE_MEASURE_CONFIRMATIONS,
        },
        "preliminaryConclusions": conclusions,
    }
    return report


def main() -> int:
    parser = argparse.ArgumentParser(description="P0 source-of-truth reconciliation without replacing current SQLite or public data.")
    parser.add_argument("--output-dir", default=str(OUTPUT_DIR), help="Worker-verify output directory.")
    parser.add_argument("--mode", default="candidate-only", choices=["candidate-only"], help="Only generate isolated candidate and reports.")
    args = parser.parse_args()
    report = build_report(args)
    output_dir = Path(args.output_dir).resolve()
    write_json(output_dir / "source-of-truth-reconciliation-1.1-report.json", report)
    write_markdown(report, output_dir / "source-of-truth-reconciliation-1.1-report.md")
    write_diff_files(
        output_dir,
        "current-sqlite-vs-runtime-json-diff",
        "Current SQLite Export vs Runtime JSON Normalized Diff",
        report["normalizedDiffs"]["frontendVsCurrentExport"],
    )
    write_diff_files(
        output_dir,
        "backup-sqlite-vs-runtime-json-diff",
        "Backup SQLite Export vs Runtime JSON Normalized Diff",
        report["normalizedDiffs"]["frontendVsBackupExport"],
    )
    write_diff_files(
        output_dir,
        "candidate-sqlite-vs-runtime-json-normalized-diff",
        "Candidate SQLite Export vs Runtime JSON Normalized Diff",
        report["normalizedDiffs"]["frontendVsCandidateExport"],
    )
    write_boundary_files(output_dir, report["candidateExportBoundaryAudit"])
    write_readiness_files(output_dir, report["candidateReadiness"])
    print(f"status=ready output={output_dir}")
    print(f"candidate={report['candidate']['path']}")
    print(f"candidateReadiness={report['candidateReadiness']['status']}")
    print(
        "frontendVsCandidateDiffs="
        f"{report['normalizedDiffs']['frontendVsCandidateExport']['summary']['keySetComparisonsWithDiff']}"
    )
    print(f"missingProtectedBaselineTypesInCurrent={len(report['sqliteComparisons']['missingProtectedBaselineTypesInCurrent'])}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
