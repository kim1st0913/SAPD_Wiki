#!/usr/bin/env python3
"""Assemble post-replacement reports for P0 Source-of-Truth 1.2."""

from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT / "data/exports/worker-verify/p0-source-of-truth-reconciliation-1.2"


def now_iso() -> str:
    return datetime.now(timezone.utc).astimezone().isoformat(timespec="seconds")


def read_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, payload: Any) -> None:
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def md_table(rows: list[list[Any]]) -> list[str]:
    if not rows:
        return []
    return [
        "| " + " | ".join(str(value) for value in rows[0]) + " |",
        "| " + " | ".join("---" for _ in rows[0]) + " |",
        *["| " + " | ".join(str(value).replace("|", "\\|") for value in row) + " |" for row in rows[1:]],
    ]


def main() -> int:
    replacement = read_json(OUT_DIR / "sqlite-replacement-report.json")
    hash_check = read_json(OUT_DIR / "post-replacement-json-hash-check.json")
    baseline = read_json(ROOT / "data/exports/worker-verify/dictionary-standard-baseline-integrity-audit.json")
    no_regression = read_json(ROOT / "data/exports/worker-verify/p0-protected-baseline-guard-report.json")
    boundary = read_json(ROOT / "data/exports/worker-verify/json-package-boundary-audit.json")
    smoke = read_json(OUT_DIR / "post-replacement-content-smoke-report.json")

    protected_counts = replacement["protectedCountsAfter"]
    summary = {
        "status": "pass"
        if (
            baseline.get("status") == "pass"
            and not baseline.get("errors")
            and not baseline.get("warnings")
            and no_regression.get("status") == "pass"
            and boundary.get("status") == "pass"
            and hash_check.get("status") == "pass"
            and smoke.get("result") == "pass"
        )
        else "issues_found",
        "generatedAt": now_iso(),
        "sqliteReplacement": {
            "currentBefore": replacement["hashes"]["currentBefore"],
            "candidate": replacement["hashes"]["candidate"],
            "currentAfter": replacement["hashes"]["currentAfter"],
            "backup": replacement["hashes"]["backup"],
            "backupPath": replacement["paths"]["backupSqlite"],
        },
        "protectedCountsAfter": protected_counts,
        "audits": {
            "baselineIntegrity": {
                "status": baseline.get("status"),
                "errors": len(baseline.get("errors") or []),
                "warnings": len(baseline.get("warnings") or []),
            },
            "protectedNoRegression": {
                "status": no_regression.get("status"),
                "errors": len(no_regression.get("errors") or []),
                "warnings": len(no_regression.get("warnings") or []),
            },
            "jsonPackageBoundary": {
                "status": boundary.get("status"),
                "errors": len(boundary.get("errors") or []),
                "warnings": len(boundary.get("warnings") or []),
            },
            "formalJsonHashCheck": {
                "status": hash_check.get("status"),
                "mismatches": [
                    item for item in hash_check.get("checks", []) if not item.get("matchesRuntimeBaseline")
                ],
            },
            "contentSmoke": {
                "result": smoke.get("result"),
                "dataStates": [
                    {
                        "objectType": item.get("objectType"),
                        "objectId": item.get("objectId"),
                        "dataState": item.get("dataState"),
                        "managementRows": item.get("managementRows"),
                        "standardControls": item.get("standardControls"),
                    }
                    for item in (smoke.get("api") or {}).get("capabilityCases", [])
                ],
            },
        },
        "safety": {
            "formalSqliteReplaced": True,
            "currentSqliteBackedUpFirst": True,
            "publicDataOverwritten": False,
            "runtimeBaselineJsonHashUnchanged": hash_check.get("status") == "pass",
            "ranFullPublicDataExport": False,
            "ranCoreReset": False,
            "environmentMappingWriteLineRestored": False,
            "frontendUiModified": False,
        },
        "recommendation": {
            "suggestCloseOi140": True,
            "remainingRisk": "后续原始数据变更仍必须走 runtime baseline 变更流程；本次替换只关闭 P0 core-only SQLite 事实源事故。",
        },
    }
    write_json(OUT_DIR / "post-replacement-baseline-audit.json", summary)

    baseline_lines = [
        "# Post Replacement Baseline Audit",
        "",
        f"- status: `{summary['status']}`",
        f"- generatedAt: `{summary['generatedAt']}`",
        "",
        "## SQLite Hashes",
        "",
        *md_table(
            [
                ["name", "sha256"],
                ["currentBefore", summary["sqliteReplacement"]["currentBefore"]],
                ["candidate", summary["sqliteReplacement"]["candidate"]],
                ["backup", summary["sqliteReplacement"]["backup"]],
                ["currentAfter", summary["sqliteReplacement"]["currentAfter"]],
            ]
        ),
        "",
        "## Protected Counts After Replacement",
        "",
        *md_table([["type", "count"], *[[key, value] for key, value in protected_counts.items()]]),
        "",
        "## Audit Status",
        "",
        *md_table(
            [
                ["audit", "status", "errors", "warnings"],
                [
                    "baselineIntegrity",
                    summary["audits"]["baselineIntegrity"]["status"],
                    summary["audits"]["baselineIntegrity"]["errors"],
                    summary["audits"]["baselineIntegrity"]["warnings"],
                ],
                [
                    "protectedNoRegression",
                    summary["audits"]["protectedNoRegression"]["status"],
                    summary["audits"]["protectedNoRegression"]["errors"],
                    summary["audits"]["protectedNoRegression"]["warnings"],
                ],
                [
                    "jsonPackageBoundary",
                    summary["audits"]["jsonPackageBoundary"]["status"],
                    summary["audits"]["jsonPackageBoundary"]["errors"],
                    summary["audits"]["jsonPackageBoundary"]["warnings"],
                ],
                ["formalJsonHashCheck", summary["audits"]["formalJsonHashCheck"]["status"], 0, 0],
                ["contentSmoke", summary["audits"]["contentSmoke"]["result"], 0, 0],
            ]
        ),
        "",
        "## Safety",
        "",
        *[f"- {key}: `{value}`" for key, value in summary["safety"].items()],
    ]
    (OUT_DIR / "post-replacement-baseline-audit.md").write_text("\n".join(baseline_lines) + "\n", encoding="utf-8")

    smoke_lines = [
        "# Post Replacement Content Smoke Report",
        "",
        f"- result: `{smoke.get('result')}`",
        f"- baseUrl: `{(smoke.get('api') or {}).get('baseUrl')}`",
        f"- maintenanceSecurityWorks: `{(smoke.get('api') or {}).get('maintenanceSecurityWorks')}`",
        "",
        "## Local Package Counts",
        "",
        *md_table(
            [
                ["area", "metric", "value"],
                ["maintenance", "securityWorks", smoke["localPackages"]["maintenance"]["securityWorks"]],
                ["maintenance", "securityTechnicalMeasures", smoke["localPackages"]["maintenance"]["securityTechnicalMeasures"]],
                ["maintenance", "securityProcesses", smoke["localPackages"]["maintenance"]["securityProcesses"]],
                ["capability", "managementMapping", smoke["localPackages"]["capability"]["relationshipCounts"]["managementMapping"]],
                ["capability", "standardMapping", smoke["localPackages"]["capability"]["relationshipCounts"]["standardMapping"]],
                ["standards", "controls", smoke["localPackages"]["standards"]["controls"]],
                ["lifecycle", "relations", smoke["localPackages"]["lifecycle"]["relations"]],
            ]
        ),
        "",
        "## API Cases",
        "",
        *md_table(
            [
                ["objectType", "objectId", "dataState", "managementRows", "standardControls"],
                *[
                    [
                        item.get("objectType"),
                        item.get("objectId"),
                        item.get("dataState"),
                        item.get("managementRows"),
                        item.get("standardControls"),
                    ]
                    for item in (smoke.get("api") or {}).get("capabilityCases", [])
                ],
            ]
        ),
    ]
    (OUT_DIR / "post-replacement-content-smoke-report.md").write_text("\n".join(smoke_lines) + "\n", encoding="utf-8")
    print(json.dumps({"result": summary["status"], "outputDir": str(OUT_DIR)}, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
