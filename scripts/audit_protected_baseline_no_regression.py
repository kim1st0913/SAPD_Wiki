from __future__ import annotations

import argparse
import hashlib
import json
from datetime import datetime
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "frontend" / "capability-browser" / "public" / "data"
GENERATED_DIR = ROOT / "frontend" / "capability-browser" / "generated"
OUTPUT_DIR = ROOT / "data" / "exports" / "worker-verify"
RECOVERY_BEFORE_DIR = OUTPUT_DIR / "protected-baseline-recovery-backup" / "frontend-data-20260615"
SECURITY_TECHNICAL_SERVICE_UPDATE_RESULT = (
    OUTPUT_DIR
    / "security-technical-service-update"
    / "security-technical-service-update-apply-result.json"
)
PROTECTED_GLOBAL_REFERENCE_FIX_APPLY_DIR = (
    OUTPUT_DIR
    / "protected-dictionary-standard-global-audit"
    / "formal-apply"
)
CONFIRMED_LIFECYCLE_SECURITY_TECHNICAL_MEASURES = {
    "应用程序威胁建模": "LC-AP 应用安全开发生命周期 R5 / AP-02 架构设计",
    "制品安全加固": "LC-AP 应用安全开发生命周期 R7 / AP-04 集成构建",
    "IaC代码安全测试": "LC-AP 应用安全开发生命周期 R8 / AP-05 测试验证",
    "数据销毁": "LC-DT 数据生命周期 I30 与 LC-DT 安全技术服务、模块、策略映射表 N69/N70",
}


def read_json(path: Path) -> dict[str, Any]:
    if not path.exists():
        return {}
    value = json.loads(path.read_text(encoding="utf-8"))
    return value if isinstance(value, dict) else {}


def sha256(path: Path) -> str | None:
    if not path.exists():
        return None
    h = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def list_count(value: Any) -> int:
    return len(value) if isinstance(value, list) else 0


def item_names(value: Any) -> set[str]:
    if not isinstance(value, list):
        return set()
    return {str(item.get("name") or item.get("title") or "").strip() for item in value if isinstance(item, dict)}


def standard_rows(path: Path) -> int:
    payload = read_json(path)
    rows = list_count(payload.get("rows"))
    tabs = payload.get("tabs")
    if isinstance(tabs, list):
        rows += sum(list_count(tab.get("rows")) for tab in tabs if isinstance(tab, dict))
    return rows


def latest_global_reference_fix_report() -> tuple[dict[str, Any], Path | None]:
    if not PROTECTED_GLOBAL_REFERENCE_FIX_APPLY_DIR.exists():
        return {}, None
    reports = sorted(PROTECTED_GLOBAL_REFERENCE_FIX_APPLY_DIR.glob("*/protected-global-reference-fix-apply-report.json"))
    if not reports:
        return {}, None
    report_path = reports[-1]
    return read_json(report_path), report_path


def audit() -> dict[str, Any]:
    errors: list[dict[str, Any]] = []
    warnings: list[dict[str, Any]] = []
    approved_hash_changes: list[dict[str, Any]] = []
    current_maintenance = read_json(DATA_DIR / "maintenance-knowledge.json")
    before_maintenance = read_json(RECOVERY_BEFORE_DIR / "maintenance-knowledge.json.broken")
    lifecycle_workbench = read_json(DATA_DIR / "lifecycle-workbench.json")
    recovery_report = read_json(OUTPUT_DIR / "p0-selective-recovery-report.json")

    confirmed_measure_names = set(CONFIRMED_LIFECYCLE_SECURITY_TECHNICAL_MEASURES)
    current_measure_names = item_names(current_maintenance.get("security_technical_measures"))
    expected_measure_count = list_count(before_maintenance.get("security_technical_measures")) + len(confirmed_measure_names)
    counts = {
        "scope_types": list_count(current_maintenance.get("scope_types")),
        "security_technical_services": list_count(current_maintenance.get("security_technical_services")),
        "security_technology_modules": list_count(current_maintenance.get("security_technology_modules")),
        "security_technical_measures": list_count(current_maintenance.get("security_technical_measures")),
        "before_security_technical_measures": list_count(before_maintenance.get("security_technical_measures")),
        "confirmed_lifecycle_security_technical_measures": len(confirmed_measure_names),
        "expected_security_technical_measures": expected_measure_count,
        "security_works": list_count(current_maintenance.get("security_works")),
        "work_function_layers": list_count(current_maintenance.get("work_function_layers")),
        "security_processes": list_count(current_maintenance.get("security_processes")),
        "gbt_42446_references": list_count(current_maintenance.get("gbt_42446_references")),
        "gartner_roles": list_count(current_maintenance.get("gartner_roles")),
        "lifecycle_workbench_relations": list_count(lifecycle_workbench.get("relations")),
        "nist_csf_2_core": standard_rows(DATA_DIR / "standards" / "nist-csf-2" / "csf-core.json"),
        "iso_27001_2022": standard_rows(DATA_DIR / "standards" / "iso-27001-2022.json"),
        "dsp_scf_2026": standard_rows(DATA_DIR / "standards" / "dsp-level-2" / "dsp-scf-controls-2026.json"),
        "cis_csc_v8": standard_rows(DATA_DIR / "standards" / "cis-csc-v8.json"),
        "mlps_level_3": standard_rows(DATA_DIR / "standards" / "mlps-level-3.json"),
    }

    for key in [
        "scope_types",
        "security_technical_services",
        "security_technology_modules",
        "security_works",
        "work_function_layers",
        "security_processes",
        "gbt_42446_references",
        "gartner_roles",
        "lifecycle_workbench_relations",
        "nist_csf_2_core",
        "iso_27001_2022",
        "dsp_scf_2026",
        "cis_csc_v8",
        "mlps_level_3",
    ]:
        if counts[key] <= 0:
            errors.append({"code": "required_count_empty", "key": key, "count": counts[key]})

    missing_confirmed_measures = sorted(confirmed_measure_names - current_measure_names)
    if missing_confirmed_measures:
        errors.append(
            {
                "code": "missing_confirmed_lifecycle_security_technical_measures",
                "missing": missing_confirmed_measures,
            }
        )

    if counts["security_technical_measures"] != expected_measure_count:
        errors.append(
            {
                "code": "unexpected_measure_count",
                "current": counts["security_technical_measures"],
                "expected": expected_measure_count,
                "beforeRestore": counts["before_security_technical_measures"],
                "confirmedLifecycleMeasureCount": len(confirmed_measure_names),
            }
        )

    protected_paths = {
        "environment-workbench.json": DATA_DIR / "environment-workbench.json",
        "environmentBasemap.node-details.json": GENERATED_DIR / "environmentBasemap.node-details.json",
        "capability-workbench.json": DATA_DIR / "capability-workbench.json",
    }
    current_hashes = {name: sha256(path) for name, path in protected_paths.items()}
    service_update_result = read_json(SECURITY_TECHNICAL_SERVICE_UPDATE_RESULT)
    global_reference_fix_result, global_reference_fix_report_path = latest_global_reference_fix_report()
    service_update_paths = {
        item.get("path")
        for item in service_update_result.get("backups", [])
        if isinstance(item, dict)
    }
    expected = recovery_report.get("protectedHashesBefore") if isinstance(recovery_report, dict) else None
    if isinstance(expected, dict):
        for name, current_hash in current_hashes.items():
            if name == "capability-workbench.json":
                continue
            expected_hash = (expected.get(name) or {}).get("currentHash")
            if expected_hash and current_hash != expected_hash:
                protected_rel = str(protected_paths[name].relative_to(ROOT))
                if (
                    service_update_result.get("status") == "applied"
                    and protected_rel in service_update_paths
                    and name == "environment-workbench.json"
                ):
                    approved_hash_changes.append(
                        {
                            "file": name,
                            "previousExpected": expected_hash,
                            "current": current_hash,
                            "approvedBy": "security-technical-service-update-apply-result",
                            "applyResult": str(SECURITY_TECHNICAL_SERVICE_UPDATE_RESULT.relative_to(ROOT)),
                        }
                    )
                    continue
                global_reference_files = {
                    item.get("file")
                    for item in global_reference_fix_result.get("fileReports", [])
                    if isinstance(item, dict) and item.get("changed")
                }
                if (
                    global_reference_fix_result.get("status") == "applied"
                    and protected_rel in global_reference_files
                    and global_reference_fix_report_path is not None
                ):
                    approved_hash_changes.append(
                        {
                            "file": name,
                            "previousExpected": expected_hash,
                            "current": current_hash,
                            "approvedBy": "protected-dictionary-standard-global-reference-fix",
                            "applyResult": str(global_reference_fix_report_path.relative_to(ROOT)),
                        }
                    )
                    continue
                errors.append(
                    {
                        "code": "protected_workbench_hash_changed",
                        "file": name,
                        "expected": expected_hash,
                        "current": current_hash,
                    }
                )
    else:
        warnings.append({"code": "missing_selective_recovery_report", "message": "Cannot compare protected hashes to pre-apply report."})

    status = "pass" if not errors and not warnings else "pass_with_warnings" if not errors else "issues_found"
    report = {
        "generatedAt": datetime.now().isoformat(timespec="seconds"),
        "status": status,
        "counts": counts,
        "protectedHashes": current_hashes,
        "approvedProtectedHashChanges": approved_hash_changes,
        "errors": errors,
        "warnings": warnings,
        "confirmedLifecycleSecurityTechnicalMeasures": CONFIRMED_LIFECYCLE_SECURITY_TECHNICAL_MEASURES,
    }
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    json_path = OUTPUT_DIR / "p0-protected-baseline-guard-report.json"
    md_path = OUTPUT_DIR / "p0-protected-baseline-guard-report.md"
    json_path.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    lines = [
        "# p0-protected-baseline-guard-report",
        "",
        f"- status: `{status}`",
        f"- errors: `{len(errors)}`",
        f"- warnings: `{len(warnings)}`",
        "",
        "## Counts",
        "",
    ]
    for key in sorted(counts):
        lines.append(f"- `{key}`: `{counts[key]}`")
    if errors:
        lines.extend(["", "## Errors", ""])
        for error in errors:
            lines.append(f"- `{error.get('code')}`: `{json.dumps(error, ensure_ascii=False)}`")
    if approved_hash_changes:
        lines.extend(["", "## Approved Protected Hash Changes", ""])
        for change in approved_hash_changes:
            lines.append(f"- `{change.get('file')}`: `{json.dumps(change, ensure_ascii=False)}`")
    if warnings:
        lines.extend(["", "## Warnings", ""])
        for warning in warnings:
            lines.append(f"- `{warning.get('code')}`: `{json.dumps(warning, ensure_ascii=False)}`")
    md_path.write_text("\n".join(lines) + "\n", encoding="utf-8")
    report["files"] = {"json": str(json_path), "markdown": str(md_path)}
    return report


def main() -> int:
    parser = argparse.ArgumentParser(description="Audit protected baseline no-regression after P0 selective recovery.")
    parser.add_argument("--json", action="store_true", help="Print full JSON report.")
    args = parser.parse_args()
    report = audit()
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
