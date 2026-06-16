#!/usr/bin/env python3
"""Audit formal JSON package boundaries after the P0 baseline incident.

The audit is intentionally narrow and low-noise. It checks package layering
rules that should never be violated, without trying to validate business
mapping correctness.
"""

from __future__ import annotations

import argparse
import json
from datetime import datetime
from pathlib import Path
from typing import Any


PROJECT_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_DATA_DIR = PROJECT_ROOT / "frontend" / "capability-browser" / "public" / "data"
DEFAULT_GENERATED_DIR = PROJECT_ROOT / "frontend" / "capability-browser" / "generated"
DEFAULT_OUTPUT_DIR = PROJECT_ROOT / "data" / "exports" / "worker-verify"

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

WORKBENCH_FILES = [
    "capability-workbench.json",
    "environment-workbench.json",
    "lifecycle-workbench.json",
]

PROTECTED_BASELINE_FILES = [
    "maintenance-knowledge.json",
    "maintenance-index.json",
    "lifecycle-knowledge.json",
    "standards-index.json",
    "standards-data.json",
]

FORMAL_PACKAGE_FILES = [
    *WORKBENCH_FILES,
    "capability-tree.json",
    *PROTECTED_BASELINE_FILES,
]

REVIEW_ONLY_KEYS = {
    "sourceCells",
    "mergedRanges",
    "reviewRows",
    "triageCategory",
    "issueTypes",
    "workerVerify",
}


def read_json(path: Path, errors: list[dict[str, Any]]) -> Any:
    if not path.exists():
        errors.append({"code": "missing_file", "path": str(path)})
        return None
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception as exc:
        errors.append({"code": "invalid_json", "path": str(path), "message": str(exc)})
        return None


def iter_keys(value: Any, prefix: str = ""):
    if isinstance(value, dict):
        for key, child in value.items():
            path = f"{prefix}.{key}" if prefix else str(key)
            yield path, key
            yield from iter_keys(child, path)
    elif isinstance(value, list):
        for index, child in enumerate(value[:200]):
            yield from iter_keys(child, f"{prefix}[{index}]")


def iter_standard_data_paths(value: Any) -> list[str]:
    paths: list[str] = []
    if not isinstance(value, dict):
        return paths
    for framework in value.get("frameworks") or []:
        if not isinstance(framework, dict):
            continue
        if framework.get("dataPath"):
            paths.append(str(framework.get("dataPath")))
        for tab in framework.get("tabs") or []:
            if isinstance(tab, dict) and tab.get("dataPath"):
                paths.append(str(tab.get("dataPath")))
    return paths


def audit(data_dir: Path, generated_dir: Path, output_dir: Path) -> dict[str, Any]:
    errors: list[dict[str, Any]] = []
    warnings: list[dict[str, Any]] = []
    checks: dict[str, Any] = {}

    for filename in WORKBENCH_FILES:
        payload = read_json(data_dir / filename, errors)
        if not isinstance(payload, dict):
            continue
        present = sorted(PROTECTED_TOP_LEVEL_KEYS.intersection(payload.keys()))
        checks[f"workbench:{filename}"] = {"protectedTopLevelKeysPresent": present}
        if present:
            errors.append(
                {
                    "code": "protected_baseline_mixed_into_workbench",
                    "path": filename,
                    "keys": present,
                    "message": "Workbench 投影不得携带字典 / 标准基线顶层数组。",
                }
            )

    for filename in PROTECTED_BASELINE_FILES:
        payload = read_json(data_dir / filename, errors)
        if not isinstance(payload, dict):
            continue
        workbench_keys = sorted({"relationshipGroups", "objects", "relations", "navigator", "overview"}.intersection(payload.keys()))
        checks[f"protected:{filename}"] = {"workbenchTopLevelKeysPresent": workbench_keys}
        if workbench_keys:
            errors.append(
                {
                    "code": "workbench_projection_mixed_into_protected_baseline",
                    "path": filename,
                    "keys": workbench_keys,
                    "message": "保护基线不得混入 workbench 投影结构。",
                }
            )

    for filename in ["standards-index.json", "standards-data.json"]:
        payload = read_json(data_dir / filename, errors)
        bad_paths = []
        missing_paths = []
        for data_path in iter_standard_data_paths(payload):
            if data_path.startswith("/") or data_path.startswith("file:"):
                bad_paths.append(data_path)
                continue
            if not data_path.startswith("./public/data/"):
                bad_paths.append(data_path)
                continue
            resolved = data_dir / data_path.removeprefix("./public/data/")
            if not resolved.exists():
                missing_paths.append(data_path)
        checks[f"standardPaths:{filename}"] = {"invalidPaths": bad_paths, "missingPaths": missing_paths}
        if bad_paths:
            errors.append({"code": "invalid_standard_data_path", "path": filename, "dataPaths": bad_paths})
        if missing_paths:
            errors.append({"code": "missing_standard_split_path", "path": filename, "dataPaths": missing_paths})

    review_key_hits = {}
    for filename in FORMAL_PACKAGE_FILES:
        payload = read_json(data_dir / filename, errors)
        if payload is None:
            continue
        hits = []
        for path, key in iter_keys(payload):
            if key in REVIEW_ONLY_KEYS:
                hits.append(path)
                if len(hits) >= 20:
                    break
        review_key_hits[filename] = hits
        if hits:
            errors.append(
                {
                    "code": "review_only_key_in_formal_package",
                    "path": filename,
                    "sampleKeys": hits,
                    "message": "正式数据包不得包含 worker-verify / 人工核对专用字段。",
                }
            )
    checks["reviewOnlyKeyHits"] = review_key_hits

    node_details = read_json(generated_dir / "environmentBasemap.node-details.json", errors)
    if isinstance(node_details, dict):
        stats = node_details.get("stats") if isinstance(node_details.get("stats"), dict) else {}
        checks["environmentBasemap.node-details.json"] = {
            "detailReadyNodes": int(stats.get("detailReadyNodes") or 0),
            "missingDetailNodes": int(stats.get("missingDetailNodes") or 0),
        }
        if int(stats.get("missingDetailNodes") or 0) > 0:
            warnings.append(
                {
                    "code": "environment_basemap_missing_detail_nodes",
                    "missingDetailNodes": int(stats.get("missingDetailNodes") or 0),
                }
            )

    status = "pass" if not errors and not warnings else "pass_with_warnings" if not errors else "issues_found"
    report = {
        "generatedAt": datetime.now().isoformat(timespec="seconds"),
        "status": status,
        "errors": errors,
        "warnings": warnings,
        "checks": checks,
    }
    output_dir.mkdir(parents=True, exist_ok=True)
    json_path = output_dir / "json-package-boundary-audit.json"
    markdown_path = output_dir / "json-package-boundary-audit.md"
    json_path.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    lines = [
        "# JSON Package Boundary Audit",
        "",
        f"- status: `{status}`",
        f"- errors: `{len(errors)}`",
        f"- warnings: `{len(warnings)}`",
        "",
        "## Checks",
        "",
    ]
    for key, value in checks.items():
        lines.append(f"- `{key}`: `{json.dumps(value, ensure_ascii=False)}`")
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
    parser = argparse.ArgumentParser(description="Audit formal JSON package boundaries.")
    parser.add_argument("--data-dir", default=str(DEFAULT_DATA_DIR))
    parser.add_argument("--generated-dir", default=str(DEFAULT_GENERATED_DIR))
    parser.add_argument("--output-dir", default=str(DEFAULT_OUTPUT_DIR))
    parser.add_argument("--json", action="store_true")
    args = parser.parse_args()

    report = audit(Path(args.data_dir), Path(args.generated_dir), Path(args.output_dir))
    if args.json:
        print(json.dumps(report, ensure_ascii=False, indent=2))
    else:
        print(f"audit_status={report['status']}")
        print(f"errors={len(report['errors'])} warnings={len(report['warnings'])}")
        print(f"json={report['files']['json']}")
        print(f"markdown={report['files']['markdown']}")
    return 1 if report["errors"] else 0


if __name__ == "__main__":
    raise SystemExit(main())
