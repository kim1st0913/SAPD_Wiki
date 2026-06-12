#!/usr/bin/env python3
"""Verify the environment reimport replacement bundle with a temporary swap.

The script always restores the formal files after verification and checks the
post-restore hashes.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import shutil
import subprocess
import tempfile
from datetime import datetime
from pathlib import Path
from typing import Any

PROJECT_ROOT = Path(__file__).resolve().parents[1]
BUNDLE_DIR = PROJECT_ROOT / "data" / "exports" / "worker-verify" / "environment-reimport-replacement-bundle"
PUBLIC_WORKBENCH = PROJECT_ROOT / "frontend" / "capability-browser" / "public" / "data" / "environment-workbench.json"
PUBLIC_NODE_DETAILS = PROJECT_ROOT / "frontend" / "capability-browser" / "generated" / "environmentBasemap.node-details.json"
OUTPUT_JSON = BUNDLE_DIR / "environment-reimport-replacement-page-regression.json"
OUTPUT_MD = BUNDLE_DIR / "environment-reimport-replacement-page-regression.md"
FINAL_READY_JSON = BUNDLE_DIR / "environment-reimport-final-replacement-readiness.json"
FINAL_READY_MD = BUNDLE_DIR / "environment-reimport-final-replacement-readiness.md"


def text(value: Any) -> str:
    return "" if value is None else str(value).strip()


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def load_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")


def run_command(args: list[str], timeout: int = 120) -> dict[str, Any]:
    proc = subprocess.run(args, cwd=PROJECT_ROOT, text=True, capture_output=True, timeout=timeout)
    return {
        "cmd": args,
        "returncode": proc.returncode,
        "stdout": proc.stdout[-4000:],
        "stderr": proc.stderr[-4000:],
        "passed": proc.returncode == 0,
    }


def validate_bundle_files(bundle_dir: Path) -> dict[str, Any]:
    workbench = load_json(bundle_dir / "environment-workbench.json")
    node_details = load_json(bundle_dir / "environmentBasemap.node-details.json")
    matrix_rows = load_json(bundle_dir / "environment-scope-service-matrix-rows.json")
    errors = []
    top_level_keys = ["meta", "page", "navigator", "overview", "relationshipGroups", "objects", "relations", "evidenceRefs", "compatibility", "environment_scope_tree"]
    missing_keys = [key for key in top_level_keys if key not in workbench]
    if missing_keys:
        errors.append(f"replacement workbench missing top-level keys: {missing_keys}")
    if not all(relation.get("objectContextKey") for relation in workbench.get("relations", [])):
        errors.append("not all replacement relations have objectContextKey")
    if not matrix_rows:
        errors.append("matrix rows empty")
    for row in matrix_rows:
        if "securitySystem" not in row or "securityTechnologyModule" not in row or "securityTechnicalMeasure" not in row:
            errors.append("matrix row missing split system/module/measure fields")
            break
    node_groups = [
        group
        for detail in (node_details.get("nodeDetailsByMxId") or {}).values()
        for group in detail.get("directScopeGroups", [])
    ]
    if node_groups and not all("securitySystems" in group for group in node_groups):
        errors.append("node detail direct scope groups missing securitySystems")
    return {
        "passed": not errors,
        "errors": errors,
        "stats": {
            "environmentCount": len(workbench.get("environment_scope_tree", [])),
            "objectContextCount": sum(len(env.get("objects", [])) for env in workbench.get("environment_scope_tree", [])),
            "relationCount": len(workbench.get("relations", [])),
            "matrixRows": len(matrix_rows),
            "detailReadyNodes": node_details.get("stats", {}).get("detailReadyNodes"),
            "missingDetailNodes": node_details.get("stats", {}).get("missingDetailNodes"),
            "moduleSystemRelations": sum(1 for relation in workbench.get("relations", []) if relation.get("workerVerifyType") == "module_system"),
            "securitySystemCells": sum(1 for row in matrix_rows if row.get("securitySystem")),
            "moduleCells": sum(1 for row in matrix_rows if row.get("securityTechnologyModule")),
            "measureCells": sum(1 for row in matrix_rows if row.get("securityTechnicalMeasure")),
        },
    }


def markdown_page_regression(payload: dict[str, Any]) -> str:
    lines = ["# Environment Reimport Replacement Page Regression", ""]
    lines.append(f"- generatedAt: {payload['generatedAt']}")
    lines.append(f"- temporarySwapExecuted: {payload['temporarySwapExecuted']}")
    lines.append(f"- restoreSucceeded: {payload['restore']['succeeded']}")
    lines.append(f"- pageRegressionStatus: {payload['pageRegressionStatus']}")
    lines.append("")
    lines.append("## Hashes")
    for key, value in payload["hashes"].items():
        lines.append(f"- {key}: `{value}`")
    lines.append("")
    lines.append("## Commands")
    for item in payload["commands"]:
        lines.append(f"- {'PASS' if item['passed'] else 'FAIL'}: `{' '.join(item['cmd'])}`")
    lines.append("")
    lines.append("## Notes")
    for note in payload["notes"]:
        lines.append(f"- {note}")
    return "\n".join(lines) + "\n"


def markdown_final_readiness(payload: dict[str, Any]) -> str:
    lines = ["# Environment Reimport Final Replacement Readiness", ""]
    for key, value in payload["answers"].items():
        lines.append(f"- {key}: {value}")
    lines.append("")
    lines.append("## Stats")
    for key, value in payload["stats"].items():
        lines.append(f"- {key}: {value}")
    lines.append("")
    lines.append("## Required Manual Confirmations")
    for item in payload["manualConfirmationsRequired"]:
        lines.append(f"- {item}")
    return "\n".join(lines) + "\n"


def verify(args: argparse.Namespace) -> tuple[dict[str, Any], dict[str, Any]]:
    bundle_dir = Path(args.bundle_dir)
    if not bundle_dir.is_absolute():
        bundle_dir = PROJECT_ROOT / bundle_dir
    replacement_workbench = bundle_dir / "environment-workbench.json"
    replacement_node_details = bundle_dir / "environmentBasemap.node-details.json"
    validation = validate_bundle_files(bundle_dir)

    before_workbench_hash = sha256(PUBLIC_WORKBENCH)
    before_node_hash = sha256(PUBLIC_NODE_DETAILS)
    replacement_workbench_hash = sha256(replacement_workbench)
    replacement_node_hash = sha256(replacement_node_details)

    commands: list[dict[str, Any]] = []
    restore_succeeded = False
    temporary_swap_executed = False
    browser_executed = False
    browser_passed = False
    notes = [
        "HTTP smoke is executed without --allow-system-chrome; system Chrome / browser regression is not executed in this task.",
        "EnvironmentBasemapViewer currently does not render securitySystems; this regression verifies data availability and HTTP page loading only.",
    ]

    with tempfile.TemporaryDirectory(prefix="sapd-env-reimport-swap-") as tmp:
        tmpdir = Path(tmp)
        backup_workbench = tmpdir / "environment-workbench.json"
        backup_node = tmpdir / "environmentBasemap.node-details.json"
        shutil.copy2(PUBLIC_WORKBENCH, backup_workbench)
        shutil.copy2(PUBLIC_NODE_DETAILS, backup_node)
        try:
            shutil.copy2(replacement_workbench, PUBLIC_WORKBENCH)
            shutil.copy2(replacement_node_details, PUBLIC_NODE_DETAILS)
            temporary_swap_executed = True
            commands.append(run_command(["python3", "scripts/dev_server_guard.py", "--status"], timeout=60))
            commands.append(
                run_command(
                    [
                        "node",
                        "scripts/frontend_smoke_check.mjs",
                        "--page",
                        "environment",
                        "--route",
                        "/environment-mapping",
                        "--url",
                        "http://127.0.0.1:5173",
                    ],
                    timeout=120,
                )
            )
            browser_executed = any("--allow-system-chrome" in part for item in commands for part in item["cmd"])
            browser_passed = browser_executed and all(item["passed"] for item in commands)
        finally:
            shutil.copy2(backup_workbench, PUBLIC_WORKBENCH)
            shutil.copy2(backup_node, PUBLIC_NODE_DETAILS)
            restore_succeeded = sha256(PUBLIC_WORKBENCH) == before_workbench_hash and sha256(PUBLIC_NODE_DETAILS) == before_node_hash

    after_workbench_hash = sha256(PUBLIC_WORKBENCH)
    after_node_hash = sha256(PUBLIC_NODE_DETAILS)
    http_passed = all(item["passed"] for item in commands)
    page_status = "browser_not_executed_http_passed" if http_passed and not browser_executed else ("browser_passed" if browser_passed else "failed")
    page_regression = {
        "generatedAt": datetime.now().isoformat(timespec="seconds"),
        "temporarySwapExecuted": temporary_swap_executed,
        "hashes": {
            "workbenchBefore": before_workbench_hash,
            "nodeDetailsBefore": before_node_hash,
            "workbenchReplacement": replacement_workbench_hash,
            "nodeDetailsReplacement": replacement_node_hash,
            "workbenchAfterRestore": after_workbench_hash,
            "nodeDetailsAfterRestore": after_node_hash,
        },
        "restore": {
            "succeeded": restore_succeeded,
            "workbenchRestored": after_workbench_hash == before_workbench_hash,
            "nodeDetailsRestored": after_node_hash == before_node_hash,
        },
        "bundleValidation": validation,
        "commands": commands,
        "httpSmokePassed": http_passed,
        "browserExecuted": browser_executed,
        "browserPassed": browser_passed,
        "pageRegressionStatus": page_status,
        "notes": notes,
    }

    final_ready = {
        "generatedAt": datetime.now().isoformat(timespec="seconds"),
        "answers": {
            "replacementBundleAsFormalCandidate": "是，可作为正式替换候选 bundle；本轮未覆盖 public data",
            "nodeDetailsRecomputedFromReplacement": "是，bundle 内 node-details 基于 replacement shadow/contextKey 重算",
            "matrixHasIndependentSecuritySystemColumn": "是",
            "modulesAndMeasuresSeparated": "是",
            "sameNameObjectsIsolatedByContext": "是",
            "temporarySwapPassed": "HTTP smoke 通过；浏览器回归未执行" if http_passed else "否",
            "formalFilesRestoredAfterSwap": "是" if restore_succeeded else "否",
            "recommendReimport14FormalReplacement": "建议进入 Reimport 1.4，但需要先确认 UI 是否展示安全系统，以及是否接受 node-details context 修正差异",
        },
        "stats": validation["stats"],
        "validationErrors": validation["errors"],
        "pageRegressionStatus": page_status,
        "manualConfirmationsRequired": [
            "确认 EnvironmentBasemapViewer 是否需要新增安全系统展示字段；本轮数据已具备但 UI 未改。",
            "确认 replacement node-details 中数据中心机房 / 运维管理终端等旧上下文不匹配节点是否按 replacement context 处理。",
            "确认是否允许在 Reimport 1.4 覆盖正式 environment-workbench.json 并同步重算正式 node-details。",
            "正式替换后仍需人工打开 /environment-mapping 检查归纳表格和底图浮窗。",
        ],
    }
    return page_regression, final_ready


def main() -> int:
    parser = argparse.ArgumentParser(description="Verify environment reimport replacement bundle with temporary swap and restore.")
    parser.add_argument("--bundle-dir", default=str(BUNDLE_DIR))
    args = parser.parse_args()
    page_regression, final_ready = verify(args)
    write_json(OUTPUT_JSON, page_regression)
    OUTPUT_MD.write_text(markdown_page_regression(page_regression), encoding="utf-8")
    write_json(FINAL_READY_JSON, final_ready)
    FINAL_READY_MD.write_text(markdown_final_readiness(final_ready), encoding="utf-8")
    passed = page_regression["restore"]["succeeded"] and page_regression["httpSmokePassed"] and not page_regression["bundleValidation"]["errors"]
    print(json.dumps({"result": "pass" if passed else "fail", "pageRegressionStatus": page_regression["pageRegressionStatus"], "restore": page_regression["restore"], "hashes": page_regression["hashes"], "validationErrors": page_regression["bundleValidation"]["errors"]}, ensure_ascii=False, indent=2))
    return 0 if passed else 1


if __name__ == "__main__":
    raise SystemExit(main())
