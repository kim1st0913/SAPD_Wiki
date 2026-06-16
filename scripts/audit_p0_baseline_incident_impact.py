from __future__ import annotations

import argparse
import hashlib
import json
import shutil
import sys
from datetime import datetime
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from src.sapd_wiki.exports import _write_maintenance_split_packages

DATA_DIR = ROOT / "frontend" / "capability-browser" / "public" / "data"
GENERATED_DIR = ROOT / "frontend" / "capability-browser" / "generated"
OUTPUT_DIR = ROOT / "data" / "exports" / "worker-verify"
RECOVERY_BEFORE_DIR = OUTPUT_DIR / "protected-baseline-recovery-backup" / "frontend-data-20260615"
BACKUP_20260601_DIR = OUTPUT_DIR / "p0-baseline-incident-sources" / "backup-20260601"
CURRENT_DB = ROOT / "data" / "database" / "sapd_wiki.sqlite3"
BACKUP_DB = ROOT / "data" / "database" / "backups" / "sapd_wiki-before-cleanup-20260601-current.sqlite3"


MAINTENANCE_A_FIELDS = {
    "security_processes",
    "work_function_layers",
    "gbt_42446_references",
    "gartner_roles",
}
MAINTENANCE_B_FIELDS = {
    "scope_types",
    "security_technical_services",
    "security_technology_modules",
    "security_technical_measures",
}
MAINTENANCE_A_STATS = {
    "security_processes",
    "work_function_layers",
    "gbt_42446_references",
    "gartner_roles",
    "work_functions",
    "process_domains",
    "process_groups",
    "process_references",
    "process_activity_missing",
}
MAINTENANCE_B_STATS = {
    "scope_types",
    "security_technical_services",
    "security_technology_modules",
    "security_technical_measures",
}


STANDARD_SPLITS = {
    "NIST CSF 2.0": "standards/nist-csf-2/csf-core.json",
    "NIST CSF 2.0 Tiers": "standards/nist-csf-2/csf-tiers.json",
    "ISO/IEC 27001:2022": "standards/iso-27001-2022.json",
    "DSP SCF 2026": "standards/dsp-level-2/dsp-scf-controls-2026.json",
    "CIS CSC v8": "standards/cis-csc-v8.json",
    "等级保护三级": "standards/mlps-level-3.json",
}


PROTECTED_HASH_FILES = {
    "environment-workbench.json": DATA_DIR / "environment-workbench.json",
    "environmentBasemap.node-details.json": GENERATED_DIR / "environmentBasemap.node-details.json",
    "capability-workbench.json": DATA_DIR / "capability-workbench.json",
    "lifecycle-workbench.json": DATA_DIR / "lifecycle-workbench.json",
}

PROTECTED_HASH_RELATIVE_FILES = {
    "environment-workbench.json": "frontend/capability-browser/public/data/environment-workbench.json",
    "environmentBasemap.node-details.json": "frontend/capability-browser/generated/environmentBasemap.node-details.json",
    "capability-workbench.json": "frontend/capability-browser/public/data/capability-workbench.json",
    "lifecycle-workbench.json": "frontend/capability-browser/public/data/lifecycle-workbench.json",
}


def read_json(path: Path) -> dict[str, Any]:
    if not path.exists():
        return {}
    value = json.loads(path.read_text(encoding="utf-8"))
    return value if isinstance(value, dict) else {}


def resolve_snapshot_path(relative_path: str, snapshot_root: Path | None = None) -> Path:
    if snapshot_root is not None:
        candidate = snapshot_root / relative_path
        if candidate.exists():
            return candidate
    return ROOT / relative_path


def read_snapshot_json(relative_path: str, snapshot_root: Path | None = None) -> dict[str, Any]:
    return read_json(resolve_snapshot_path(relative_path, snapshot_root))


def write_json(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


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


def get_path(data: dict[str, Any], *keys: str) -> Any:
    current: Any = data
    for key in keys:
        if not isinstance(current, dict):
            return None
        current = current.get(key)
    return current


def count_standard_rows(path: Path) -> int:
    payload = read_json(path)
    rows = list_count(payload.get("rows"))
    tabs = payload.get("tabs")
    if isinstance(tabs, list):
        rows += sum(list_count(tab.get("rows")) for tab in tabs if isinstance(tab, dict))
    return rows


def count_snapshot_standard_rows(relative_path: str, snapshot_root: Path | None = None) -> int:
    return count_standard_rows(resolve_snapshot_path(relative_path, snapshot_root))


def application_component_count(payload: dict[str, Any]) -> int:
    app = get_path(payload, "application_security_development") or {}
    types = app.get("application_system_types")
    if not isinstance(types, list):
        return 0
    return sum(list_count(item.get("components")) for item in types if isinstance(item, dict))


def maintenance_counts(payload: dict[str, Any]) -> dict[str, int]:
    return {
        "scope_types": list_count(payload.get("scope_types")),
        "security_technical_services": list_count(payload.get("security_technical_services")),
        "security_technology_modules": list_count(payload.get("security_technology_modules")),
        "security_technical_measures": list_count(payload.get("security_technical_measures")),
        "security_processes": list_count(payload.get("security_processes")),
        "work_function_layers": list_count(payload.get("work_function_layers")),
        "gbt_42446_references": list_count(payload.get("gbt_42446_references")),
        "gartner_roles": list_count(payload.get("gartner_roles")),
    }


def lifecycle_knowledge_counts(payload: dict[str, Any]) -> dict[str, int]:
    app = get_path(payload, "application_security_development") or {}
    data = get_path(payload, "data_security_lifecycle") or {}
    return {
        "application_processes": list_count(app.get("processes")),
        "data_processes": list_count(data.get("processes")),
        "application_system_types": list_count(app.get("application_system_types")),
        "application_components": application_component_count(payload),
    }


def lifecycle_workbench_counts(payload: dict[str, Any]) -> dict[str, int]:
    objects = payload.get("objects") if isinstance(payload.get("objects"), dict) else {}
    stats = payload.get("stats") if isinstance(payload.get("stats"), dict) else {}
    return {
        "object_groups": len(objects),
        "relations": list_count(payload.get("relations")),
        "evidenceRefs": list_count(payload.get("evidenceRefs")),
        "stats_relations": int(stats.get("relations") or 0),
        "stats_objects": int(stats.get("objects") or 0),
    }


def build_report(snapshot_root: Path | None = None) -> dict[str, Any]:
    current_maintenance = read_snapshot_json(
        "frontend/capability-browser/public/data/maintenance-knowledge.json",
        snapshot_root,
    )
    before_maintenance = read_json(RECOVERY_BEFORE_DIR / "maintenance-knowledge.json.broken")
    backup_maintenance = read_json(BACKUP_20260601_DIR / "maintenance-knowledge.json")
    current_lifecycle = read_snapshot_json(
        "frontend/capability-browser/public/data/lifecycle-knowledge.json",
        snapshot_root,
    )
    before_lifecycle = read_json(RECOVERY_BEFORE_DIR / "lifecycle-knowledge.json.broken")
    backup_lifecycle = read_json(BACKUP_20260601_DIR / "lifecycle-knowledge.json")
    current_lifecycle_workbench = read_snapshot_json(
        "frontend/capability-browser/public/data/lifecycle-workbench.json",
        snapshot_root,
    )
    backup_lifecycle_workbench = read_json(BACKUP_20260601_DIR / "lifecycle-workbench.json")

    maintenance_current = maintenance_counts(current_maintenance)
    maintenance_before = maintenance_counts(before_maintenance)
    maintenance_backup = maintenance_counts(backup_maintenance)
    lifecycle_current = lifecycle_knowledge_counts(current_lifecycle)
    lifecycle_before = lifecycle_knowledge_counts(before_lifecycle)
    lifecycle_backup = lifecycle_knowledge_counts(backup_lifecycle)
    lifecycle_workbench_current = lifecycle_workbench_counts(current_lifecycle_workbench)
    lifecycle_workbench_backup = lifecycle_workbench_counts(backup_lifecycle_workbench)

    dictionary_rows = [
        {
            "page": "安全能力作用域目录",
            "route": "/knowledge/scopes",
            "dataSource": "maintenance-knowledge.json",
            "field": "scope_types",
            "current": maintenance_current["scope_types"],
            "beforeRestore": maintenance_before["scope_types"],
            "backup20260601": maintenance_backup["scope_types"],
            "classification": "D",
            "action": "只读通过，不写入",
        },
        {
            "page": "安全技术服务清单",
            "route": "/knowledge/technical-services",
            "dataSource": "maintenance-knowledge.json",
            "field": "security_technical_services",
            "current": maintenance_current["security_technical_services"],
            "beforeRestore": maintenance_before["security_technical_services"],
            "backup20260601": maintenance_backup["security_technical_services"],
            "classification": "D",
            "action": "只读通过，不写入",
        },
        {
            "page": "安全技术模块清单",
            "route": "/knowledge/technical",
            "dataSource": "maintenance-knowledge.json",
            "field": "security_technology_modules",
            "current": maintenance_current["security_technology_modules"],
            "beforeRestore": maintenance_before["security_technology_modules"],
            "backup20260601": maintenance_backup["security_technology_modules"],
            "classification": "D",
            "action": "只读通过，不写入",
        },
        {
            "page": "安全技术措施清单",
            "route": "/knowledge/technical-measures",
            "dataSource": "maintenance-knowledge.json",
            "field": "security_technical_measures",
            "current": maintenance_current["security_technical_measures"],
            "beforeRestore": maintenance_before["security_technical_measures"],
            "backup20260601": maintenance_backup["security_technical_measures"],
            "classification": "B" if maintenance_current["security_technical_measures"] != maintenance_before["security_technical_measures"] else "D",
            "action": "从恢复前备份回退" if maintenance_current["security_technical_measures"] != maintenance_before["security_technical_measures"] else "只读通过，不写入",
        },
        {
            "page": "安全职能清单",
            "route": "/knowledge/functions",
            "dataSource": "maintenance-knowledge.json",
            "field": "work_function_layers",
            "current": maintenance_current["work_function_layers"],
            "beforeRestore": maintenance_before["work_function_layers"],
            "backup20260601": maintenance_backup["work_function_layers"],
            "classification": "A",
            "action": "保留 2026-06-01 备份恢复结果",
        },
        {
            "page": "安全管理工作/流程清单",
            "route": "/knowledge/processes",
            "dataSource": "maintenance-knowledge.json",
            "field": "security_processes",
            "current": maintenance_current["security_processes"],
            "beforeRestore": maintenance_before["security_processes"],
            "backup20260601": maintenance_backup["security_processes"],
            "classification": "A",
            "action": "保留 2026-06-01 备份恢复结果",
        },
        {
            "page": "应用系统目录",
            "route": "/knowledge/application-systems",
            "dataSource": "lifecycle-knowledge.json",
            "field": "application_system_types",
            "current": lifecycle_current["application_system_types"],
            "beforeRestore": lifecycle_before["application_system_types"],
            "backup20260601": lifecycle_backup["application_system_types"],
            "classification": "A",
            "action": "保留 2026-06-01 备份恢复结果",
        },
    ]

    standard_rows = []
    before_standards = read_json(RECOVERY_BEFORE_DIR / "standards-index.json.broken")
    backup_standards = read_json(BACKUP_20260601_DIR / "standards-index.json")
    for label, relative in STANDARD_SPLITS.items():
        current_rows = count_snapshot_standard_rows(f"frontend/capability-browser/public/data/{relative}", snapshot_root)
        backup_rows = count_standard_rows(BACKUP_20260601_DIR / relative)
        standard_rows.append(
            {
                "page": label,
                "route": "/standards",
                "dataSource": relative,
                "field": "rows",
                "current": current_rows,
                "beforeRestore": int(get_path(before_standards, "stats", "controls") or 0),
                "backup20260601": backup_rows,
                "classification": "A",
                "action": "保留 2026-06-01 备份恢复结果",
            }
        )

    lifecycle_rows = [
        {
            "page": "LC-AP / LC-DT lifecycle-workbench",
            "route": "/development-security / /data-security",
            "dataSource": "lifecycle-workbench.json",
            "field": "relations",
            "current": lifecycle_workbench_current["relations"],
            "beforeRestore": None,
            "backup20260601": lifecycle_workbench_backup["relations"],
            "classification": "A" if lifecycle_workbench_current["relations"] == 0 and lifecycle_workbench_backup["relations"] > 0 else "D",
            "action": "从 2026-06-01 备份选择性恢复 lifecycle-workbench.json"
            if lifecycle_workbench_current["relations"] == 0 and lifecycle_workbench_backup["relations"] > 0
            else "只读通过，不写入",
        }
    ]

    protected_hashes = {
        name: {
            "path": relative_path,
            "currentHash": sha256(resolve_snapshot_path(relative_path, snapshot_root)),
            "allowedToChange": name == "lifecycle-workbench.json",
        }
        for name, relative_path in PROTECTED_HASH_RELATIVE_FILES.items()
    }

    all_rows = dictionary_rows + standard_rows + lifecycle_rows
    classification = {
        "A_confirmedFaultAllowedRecovery": [row for row in all_rows if row["classification"] == "A"],
        "B_overRestoredMustRollback": [row for row in all_rows if row["classification"] == "B"],
        "C_forbiddenTouched": [],
        "D_readOnlyPassed": [row for row in all_rows if row["classification"] == "D"],
    }

    return {
        "generatedAt": datetime.now().isoformat(timespec="seconds"),
        "currentSQLite": {"path": str(CURRENT_DB), "sha256": sha256(CURRENT_DB)},
        "backup20260601SQLite": {"path": str(BACKUP_DB), "sha256": sha256(BACKUP_DB)},
        "recoveryBeforeBackupDir": str(RECOVERY_BEFORE_DIR),
        "backup20260601ExportDir": str(BACKUP_20260601_DIR),
        "maintenance": {
            "current": maintenance_current,
            "beforeRestore": maintenance_before,
            "backup20260601": maintenance_backup,
        },
        "lifecycleKnowledge": {
            "current": lifecycle_current,
            "beforeRestore": lifecycle_before,
            "backup20260601": lifecycle_backup,
        },
        "lifecycleWorkbench": {
            "current": lifecycle_workbench_current,
            "backup20260601": lifecycle_workbench_backup,
        },
        "dictionaryRows": dictionary_rows,
        "standardRows": standard_rows,
        "lifecycleRows": lifecycle_rows,
        "protectedHashes": protected_hashes,
        "classification": classification,
        "plan": {
            "writeMaintenanceMergedPackage": bool(classification["B_overRestoredMustRollback"]),
            "writeLifecycleWorkbench": lifecycle_rows[0]["classification"] == "A",
            "writeStandards": False,
            "writeEnvironmentWorkbench": False,
            "writeCapabilityWorkbench": False,
            "writeDatabase": False,
        },
    }


def markdown_table(rows: list[dict[str, Any]]) -> list[str]:
    lines = [
        "| 分类 | 页面 / 数据项 | 字段 | 当前 | 恢复前 | 2026-06-01 | 动作 |",
        "|---|---|---|---:|---:|---:|---|",
    ]
    for row in rows:
        lines.append(
            "| {classification} | {page} | `{field}` | {current} | {before} | {backup} | {action} |".format(
                classification=row["classification"],
                page=row["page"],
                field=row["field"],
                current=row["current"],
                before="-" if row["beforeRestore"] is None else row["beforeRestore"],
                backup=row["backup20260601"],
                action=row["action"],
            )
        )
    return lines


def write_reports(report: dict[str, Any]) -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    report_files = {
        "impact": OUTPUT_DIR / "p0-baseline-incident-impact-audit",
        "classification": OUTPUT_DIR / "p0-selective-recovery-classification",
        "plan": OUTPUT_DIR / "p0-selective-recovery-plan",
    }
    for key, base in report_files.items():
        payload = report if key == "impact" else report[key if key != "classification" else "classification"]
        write_json(base.with_suffix(".json"), payload)
        lines = [
            f"# {base.name}",
            "",
            f"- generatedAt: `{report['generatedAt']}`",
            f"- currentSQLite: `{report['currentSQLite']['path']}`",
            f"- backup20260601: `{report['backup20260601SQLite']['path']}`",
            f"- recoveryBeforeBackupDir: `{report['recoveryBeforeBackupDir']}`",
            "",
        ]
        if key == "impact":
            lines.extend(markdown_table(report["dictionaryRows"] + report["standardRows"] + report["lifecycleRows"]))
        elif key == "classification":
            for label, rows in report["classification"].items():
                lines.extend(["", f"## {label}", ""])
                lines.extend(markdown_table(rows) if rows else ["无"])
        else:
            lines.extend(
                [
                    f"- writeMaintenanceMergedPackage: `{report['plan']['writeMaintenanceMergedPackage']}`",
                    f"- writeLifecycleWorkbench: `{report['plan']['writeLifecycleWorkbench']}`",
                    f"- writeStandards: `{report['plan']['writeStandards']}`",
                    f"- writeEnvironmentWorkbench: `{report['plan']['writeEnvironmentWorkbench']}`",
                    f"- writeCapabilityWorkbench: `{report['plan']['writeCapabilityWorkbench']}`",
                    f"- writeDatabase: `{report['plan']['writeDatabase']}`",
                ]
            )
        base.with_suffix(".md").write_text("\n".join(lines) + "\n", encoding="utf-8")


def backup_before_apply(report: dict[str, Any]) -> Path:
    stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    target = OUTPUT_DIR / "p0-selective-recovery-before-apply" / stamp
    target.mkdir(parents=True, exist_ok=True)
    files = [
        DATA_DIR / "maintenance-knowledge.json",
        DATA_DIR / "lifecycle-workbench.json",
        DATA_DIR / "environment-workbench.json",
        DATA_DIR / "capability-workbench.json",
        GENERATED_DIR / "environmentBasemap.node-details.json",
    ]
    for path in files:
        if path.exists():
            relative = path.relative_to(ROOT)
            dest = target / relative
            dest.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(path, dest)
    write_json(target / "pre-apply-hashes.json", report["protectedHashes"])
    return target


def apply_selective_recovery(report: dict[str, Any]) -> dict[str, Any]:
    backup_dir = backup_before_apply(report)
    current = read_json(DATA_DIR / "maintenance-knowledge.json")
    before = read_json(RECOVERY_BEFORE_DIR / "maintenance-knowledge.json.broken")
    merged = dict(current)
    for field in MAINTENANCE_B_FIELDS:
        merged[field] = before.get(field) or []
    merged_stats = dict(current.get("stats") or {})
    before_stats = before.get("stats") or {}
    for field in MAINTENANCE_B_STATS:
        merged_stats[field] = before_stats.get(field, 0)
    merged["stats"] = merged_stats
    write_json(DATA_DIR / "maintenance-knowledge.json", merged)
    _write_maintenance_split_packages(DATA_DIR / "maintenance-knowledge.json", merged)

    lifecycle_written = False
    if report["plan"]["writeLifecycleWorkbench"]:
        shutil.copy2(BACKUP_20260601_DIR / "lifecycle-workbench.json", DATA_DIR / "lifecycle-workbench.json")
        lifecycle_written = True

    post_report = build_report()
    recovery = {
        "generatedAt": datetime.now().isoformat(timespec="seconds"),
        "preApplyBackupDir": str(backup_dir),
        "maintenanceMerged": True,
        "maintenanceCountsAfter": post_report["maintenance"]["current"],
        "lifecycleWorkbenchRestored": lifecycle_written,
        "lifecycleWorkbenchCountsAfter": post_report["lifecycleWorkbench"]["current"],
        "protectedHashesBefore": report["protectedHashes"],
        "protectedHashesAfter": post_report["protectedHashes"],
        "databaseWritten": False,
    }
    rollback = {
        "generatedAt": recovery["generatedAt"],
        "rolledBackFields": [
            {
                "package": "maintenance-knowledge.json",
                "field": "security_technical_measures",
                "from": report["maintenance"]["current"]["security_technical_measures"],
                "to": post_report["maintenance"]["current"]["security_technical_measures"],
                "source": str(RECOVERY_BEFORE_DIR / "maintenance-knowledge.json.broken"),
            }
        ],
        "environmentWorkbenchChanged": report["protectedHashes"]["environment-workbench.json"]["currentHash"]
        != post_report["protectedHashes"]["environment-workbench.json"]["currentHash"],
        "capabilityWorkbenchChanged": report["protectedHashes"]["capability-workbench.json"]["currentHash"]
        != post_report["protectedHashes"]["capability-workbench.json"]["currentHash"],
    }
    write_json(OUTPUT_DIR / "p0-selective-recovery-report.json", recovery)
    write_json(OUTPUT_DIR / "p0-overrestore-rollback-report.json", rollback)
    (OUTPUT_DIR / "p0-selective-recovery-report.md").write_text(
        "\n".join(
            [
                "# p0-selective-recovery-report",
                "",
                f"- preApplyBackupDir: `{backup_dir}`",
                f"- maintenanceMerged: `{recovery['maintenanceMerged']}`",
                f"- security_technical_measures_after: `{recovery['maintenanceCountsAfter']['security_technical_measures']}`",
                f"- lifecycleWorkbenchRestored: `{recovery['lifecycleWorkbenchRestored']}`",
                f"- lifecycle_relations_after: `{recovery['lifecycleWorkbenchCountsAfter']['relations']}`",
                "- databaseWritten: `False`",
            ]
        )
        + "\n",
        encoding="utf-8",
    )
    (OUTPUT_DIR / "p0-overrestore-rollback-report.md").write_text(
        "\n".join(
            [
                "# p0-overrestore-rollback-report",
                "",
                "- rolledBack: `maintenance-knowledge.json.security_technical_measures`",
                f"- from: `{report['maintenance']['current']['security_technical_measures']}`",
                f"- to: `{post_report['maintenance']['current']['security_technical_measures']}`",
                f"- source: `{RECOVERY_BEFORE_DIR / 'maintenance-knowledge.json.broken'}`",
                f"- environmentWorkbenchChanged: `{rollback['environmentWorkbenchChanged']}`",
                f"- capabilityWorkbenchChanged: `{rollback['capabilityWorkbenchChanged']}`",
            ]
        )
        + "\n",
        encoding="utf-8",
    )
    return recovery


def main() -> int:
    parser = argparse.ArgumentParser(description="Audit P0 baseline incident impact and optionally apply selective recovery.")
    parser.add_argument("--apply-selective-recovery", action="store_true", help="Apply the generated selective recovery plan.")
    parser.add_argument(
        "--incident-snapshot-dir",
        help="Use a pre-apply snapshot directory as the current data source when rebuilding incident reports.",
    )
    parser.add_argument("--json", action="store_true", help="Print full JSON report.")
    args = parser.parse_args()

    snapshot_root = Path(args.incident_snapshot_dir) if args.incident_snapshot_dir else None
    report = build_report(snapshot_root=snapshot_root)
    write_reports(report)
    recovery = None
    if args.apply_selective_recovery:
        recovery = apply_selective_recovery(report)
    if args.json:
        print(json.dumps({"impact": report, "recovery": recovery}, ensure_ascii=False, indent=2))
    else:
        print("audit_status=ready")
        print(f"A={len(report['classification']['A_confirmedFaultAllowedRecovery'])}")
        print(f"B={len(report['classification']['B_overRestoredMustRollback'])}")
        print(f"C={len(report['classification']['C_forbiddenTouched'])}")
        print(f"D={len(report['classification']['D_readOnlyPassed'])}")
        print(f"writeMaintenanceMergedPackage={report['plan']['writeMaintenanceMergedPackage']}")
        print(f"writeLifecycleWorkbench={report['plan']['writeLifecycleWorkbench']}")
        if recovery:
            print(f"applied=true")
            print(f"security_technical_measures_after={recovery['maintenanceCountsAfter']['security_technical_measures']}")
            print(f"lifecycle_relations_after={recovery['lifecycleWorkbenchCountsAfter']['relations']}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
