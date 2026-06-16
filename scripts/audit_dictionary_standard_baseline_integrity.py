from __future__ import annotations

import argparse
import json
import sqlite3
from datetime import datetime
from pathlib import Path
from typing import Any


PROJECT_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_DATA_DIR = PROJECT_ROOT / "frontend" / "capability-browser" / "public" / "data"
DEFAULT_OUTPUT_DIR = PROJECT_ROOT / "data" / "exports" / "worker-verify"
DEFAULT_DB_PATH = PROJECT_ROOT / "data" / "database" / "sapd_wiki.sqlite3"


PROTECTED_TOP_LEVEL_KEYS = {
    "work_function_layers",
    "security_works",
    "security_processes",
    "gbt_42446_references",
    "gartner_roles",
    "standard_frameworks",
    "standard_controls",
    "frameworks",
}


STANDARD_SPLITS = {
    "mlps_level_3": "standards/mlps-level-3.json",
    "cis_csc_v8": "standards/cis-csc-v8.json",
    "nist_csf_2_core": "standards/nist-csf-2/csf-core.json",
    "nist_csf_2_tiers": "standards/nist-csf-2/csf-tiers.json",
    "iso_27001_2022": "standards/iso-27001-2022.json",
    "dsp_scf_2026_controls": "standards/dsp-level-2/dsp-scf-controls-2026.json",
    "dsp_scf_2026_maturity": "standards/dsp-level-2/dsp-scf-maturity-2026.json",
    "crf_safeguards_core_2026": "standards/crf/crf-safeguards-core-2026.json",
    "crf_maturity_model_2026": "standards/crf/crf-maturity-model-2026.json",
    "nist_800_53_rev5": "standards/nist-800-53-rev5.json",
}


def read_json(path: Path, errors: list[dict[str, Any]]) -> dict[str, Any]:
    if not path.exists():
        errors.append({"code": "missing_file", "path": str(path)})
        return {}
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except Exception as exc:
        errors.append({"code": "invalid_json", "path": str(path), "message": str(exc)})
        return {}
    if not isinstance(value, dict):
        errors.append({"code": "invalid_json_root", "path": str(path), "actualType": type(value).__name__})
        return {}
    return value


def list_count(value: Any) -> int:
    return len(value) if isinstance(value, list) else 0


def nested(data: dict[str, Any], *keys: str) -> Any:
    current: Any = data
    for key in keys:
        if not isinstance(current, dict):
            return None
        current = current.get(key)
    return current


def require_positive(
    errors: list[dict[str, Any]],
    counts: dict[str, int],
    key: str,
    value: int,
    *,
    source: str,
) -> None:
    counts[key] = value
    if value <= 0:
        errors.append({"code": "empty_required_baseline", "key": key, "source": source, "count": value})


def count_standard_rows(payload: dict[str, Any]) -> int:
    rows = list_count(payload.get("rows"))
    tabs = payload.get("tabs")
    if isinstance(tabs, list):
        rows += sum(list_count(tab.get("rows")) for tab in tabs if isinstance(tab, dict))
    return rows


def iter_standard_data_paths(payload: dict[str, Any]) -> list[str]:
    paths: list[str] = []
    for framework in payload.get("frameworks") or []:
        if not isinstance(framework, dict):
            continue
        if framework.get("dataPath"):
            paths.append(str(framework.get("dataPath")))
        for tab in framework.get("tabs") or []:
            if isinstance(tab, dict) and tab.get("dataPath"):
                paths.append(str(tab.get("dataPath")))
    return paths


def audit_standard_data_paths(
    *,
    errors: list[dict[str, Any]],
    data_dir: Path,
    package_name: str,
    payload: dict[str, Any],
) -> None:
    for data_path in iter_standard_data_paths(payload):
        if data_path.startswith("/") or data_path.startswith("file:"):
            errors.append(
                {
                    "code": "absolute_standard_data_path",
                    "package": package_name,
                    "dataPath": data_path,
                    "message": "标准 / 框架索引不得指向本机绝对路径，否则浏览器页面会持续加载或空白。",
                }
            )
            continue
        if not data_path.startswith("./public/data/"):
            errors.append(
                {
                    "code": "invalid_standard_data_path_prefix",
                    "package": package_name,
                    "dataPath": data_path,
                }
            )
            continue
        local_path = data_dir / data_path.removeprefix("./public/data/")
        if not local_path.exists():
            errors.append(
                {
                    "code": "missing_standard_split_path",
                    "package": package_name,
                    "dataPath": data_path,
                    "resolvedPath": str(local_path),
                }
            )


def db_type_counts(db_path: Path, warnings: list[dict[str, Any]]) -> dict[str, int]:
    if not db_path.exists():
        warnings.append({"code": "database_missing", "path": str(db_path)})
        return {}
    with sqlite3.connect(db_path) as conn:
        rows = conn.execute(
            """
            SELECT type, COUNT(*) AS count
            FROM knowledge_items
            WHERE status = 'active'
            GROUP BY type
            """
        ).fetchall()
    return {str(row[0]): int(row[1]) for row in rows}


def audit(data_dir: Path, output_dir: Path, db_path: Path | None = None) -> dict[str, Any]:
    errors: list[dict[str, Any]] = []
    warnings: list[dict[str, Any]] = []
    counts: dict[str, int] = {}

    maintenance = read_json(data_dir / "maintenance-knowledge.json", errors)
    work_functions = read_json(data_dir / "maintenance" / "work-functions.json", errors)
    processes = read_json(data_dir / "maintenance" / "processes.json", errors)
    references = read_json(data_dir / "maintenance" / "references.json", errors)
    services = read_json(data_dir / "maintenance" / "services.json", errors)
    modules = read_json(data_dir / "maintenance" / "modules.json", errors)
    measures = read_json(data_dir / "maintenance" / "measures.json", errors)
    lifecycle = read_json(data_dir / "lifecycle-knowledge.json", errors)
    standards_index = read_json(data_dir / "standards-index.json", errors)
    standards_data = read_json(data_dir / "standards-data.json", errors)

    require_positive(errors, counts, "maintenance.work_function_layers", list_count(maintenance.get("work_function_layers")), source="maintenance-knowledge.json")
    require_positive(errors, counts, "maintenance.security_works", list_count(maintenance.get("security_works")), source="maintenance-knowledge.json")
    require_positive(errors, counts, "maintenance.security_processes", list_count(maintenance.get("security_processes")), source="maintenance-knowledge.json")
    require_positive(errors, counts, "maintenance.gbt_42446_references", list_count(maintenance.get("gbt_42446_references")), source="maintenance-knowledge.json")
    require_positive(errors, counts, "maintenance.gartner_roles", list_count(maintenance.get("gartner_roles")), source="maintenance-knowledge.json")
    require_positive(errors, counts, "maintenance.security_technical_services", list_count(maintenance.get("security_technical_services")), source="maintenance-knowledge.json")
    require_positive(errors, counts, "maintenance.security_technology_modules", list_count(maintenance.get("security_technology_modules")), source="maintenance-knowledge.json")
    require_positive(errors, counts, "maintenance.security_technical_measures", list_count(maintenance.get("security_technical_measures")), source="maintenance-knowledge.json")

    require_positive(errors, counts, "split.work_function_layers", list_count(work_functions.get("work_function_layers")), source="maintenance/work-functions.json")
    security_works = read_json(data_dir / "maintenance" / "security-works.json", errors)
    require_positive(errors, counts, "split.security_works", list_count(security_works.get("security_works")), source="maintenance/security-works.json")
    require_positive(errors, counts, "split.security_processes", list_count(processes.get("security_processes")), source="maintenance/processes.json")
    require_positive(errors, counts, "split.gbt_42446_references", list_count(references.get("gbt_42446_references")), source="maintenance/references.json")
    require_positive(errors, counts, "split.gartner_roles", list_count(references.get("gartner_roles")), source="maintenance/references.json")
    require_positive(errors, counts, "split.security_technical_services", list_count(services.get("security_technical_services")), source="maintenance/services.json")
    require_positive(errors, counts, "split.security_technology_modules", list_count(modules.get("security_technology_modules")), source="maintenance/modules.json")
    require_positive(errors, counts, "split.security_technical_measures", list_count(measures.get("security_technical_measures")), source="maintenance/measures.json")

    application_security_development = nested(lifecycle, "application_security_development") or {}
    require_positive(
        errors,
        counts,
        "lifecycle.application_system_types",
        list_count(application_security_development.get("application_system_types")),
        source="lifecycle-knowledge.json",
    )
    application_system_types = application_security_development.get("application_system_types")
    application_component_count = 0
    if isinstance(application_system_types, list):
        application_component_count = sum(
            list_count(item.get("components")) for item in application_system_types if isinstance(item, dict)
        )
    require_positive(
        errors,
        counts,
        "lifecycle.application_components",
        application_component_count,
        source="lifecycle-knowledge.json",
    )

    require_positive(errors, counts, "standards_index.frameworks", list_count(standards_index.get("frameworks")), source="standards-index.json")
    require_positive(errors, counts, "standards_index.controls", int(nested(standards_index, "stats", "controls") or 0), source="standards-index.json")
    require_positive(errors, counts, "standards_data.frameworks", list_count(standards_data.get("frameworks")), source="standards-data.json")
    audit_standard_data_paths(errors=errors, data_dir=data_dir, package_name="standards-index.json", payload=standards_index)
    audit_standard_data_paths(errors=errors, data_dir=data_dir, package_name="standards-data.json", payload=standards_data)

    for key, relative_path in STANDARD_SPLITS.items():
        payload = read_json(data_dir / relative_path, errors)
        require_positive(errors, counts, f"standards_split.{key}", count_standard_rows(payload), source=relative_path)

    boundary_checks: dict[str, Any] = {}
    for filename in ["environment-workbench.json", "capability-workbench.json", "lifecycle-workbench.json"]:
        payload = read_json(data_dir / filename, errors)
        present = sorted(PROTECTED_TOP_LEVEL_KEYS.intersection(payload.keys()))
        boundary_checks[filename] = {"protectedTopLevelKeysPresent": present}
        if present:
            errors.append({"code": "protected_baseline_mixed_into_workbench", "path": filename, "keys": present})

    database_counts: dict[str, int] = {}
    if db_path is not None:
        database_counts = db_type_counts(db_path, warnings)
        for item_type in [
            "work_function_layer",
            "work_function",
            "security_work",
            "process_reference",
            "application_system_type",
            "standard_control",
        ]:
            if int(database_counts.get(item_type, 0)) <= 0:
                warnings.append(
                    {
                        "code": "current_database_missing_protected_baseline_type",
                        "itemType": item_type,
                        "count": int(database_counts.get(item_type, 0)),
                        "message": "Frontend packages may be restored, but exporting from this database can overwrite them with empty baselines.",
                    }
                )

    status = "pass" if not errors and not warnings else "pass_with_warnings" if not errors else "issues_found"
    report = {
        "generatedAt": datetime.now().isoformat(timespec="seconds"),
        "status": status,
        "dataDir": str(data_dir),
        "counts": counts,
        "boundaryChecks": boundary_checks,
        "databaseCounts": database_counts,
        "errors": errors,
        "warnings": warnings,
    }

    output_dir.mkdir(parents=True, exist_ok=True)
    json_path = output_dir / "dictionary-standard-baseline-integrity-audit.json"
    markdown_path = output_dir / "dictionary-standard-baseline-integrity-audit.md"
    json_path.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")

    lines = [
        "# Dictionary & Standard Baseline Integrity Audit",
        "",
        f"- status: `{status}`",
        f"- errors: `{len(errors)}`",
        f"- warnings: `{len(warnings)}`",
        f"- dataDir: `{data_dir}`",
        "",
        "## Counts",
        "",
    ]
    for key in sorted(counts):
        lines.append(f"- `{key}`: `{counts[key]}`")
    if errors:
        lines.extend(["", "## Errors", ""])
        for item in errors:
            lines.append(f"- `{item.get('code')}`: `{json.dumps(item, ensure_ascii=False)}`")
    if warnings:
        lines.extend(["", "## Warnings", ""])
        for item in warnings:
            lines.append(f"- `{item.get('code')}`: `{json.dumps(item, ensure_ascii=False)}`")
    markdown_path.write_text("\n".join(lines) + "\n", encoding="utf-8")

    report["files"] = {"json": str(json_path), "markdown": str(markdown_path)}
    return report


def main() -> int:
    parser = argparse.ArgumentParser(description="Audit protected dictionary and standard frontend baseline packages.")
    parser.add_argument("--data-dir", default=str(DEFAULT_DATA_DIR), help="Frontend public/data directory.")
    parser.add_argument("--output-dir", default=str(DEFAULT_OUTPUT_DIR), help="Audit output directory.")
    parser.add_argument("--db", default=str(DEFAULT_DB_PATH), help="Optional current SQLite database path for warning-only checks.")
    parser.add_argument("--no-db-check", action="store_true", help="Skip current database warning checks.")
    parser.add_argument("--json", action="store_true", help="Print full JSON report.")
    args = parser.parse_args()

    db_path = None if args.no_db_check else Path(args.db)
    report = audit(Path(args.data_dir), Path(args.output_dir), db_path)
    if args.json:
        print(json.dumps(report, ensure_ascii=False, indent=2))
    else:
        print(f"audit_status={report['status']}")
        print(f"errors={len(report['errors'])} warnings={len(report['warnings'])}")
        for key in sorted(report["counts"]):
            print(f"{key}={report['counts'][key]}")
        print(f"json={report['files']['json']}")
        print(f"markdown={report['files']['markdown']}")
    return 1 if report["errors"] else 0


if __name__ == "__main__":
    raise SystemExit(main())
