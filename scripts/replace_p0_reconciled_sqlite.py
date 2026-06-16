#!/usr/bin/env python3
"""Replace current SQLite with the approved P0 reconciled candidate.

This script is deliberately narrow:
- backup current SQLite first;
- verify backup/current/candidate hashes before replacement;
- replace only data/database/sapd_wiki.sqlite3;
- verify runtime-baseline frontend JSON hashes are unchanged;
- write replacement and hash-check reports under worker-verify.

It never exports frontend JSON, never runs bootstrap, and never touches source
Excel, Draw.io, generated frontend JSON, or UI files.
"""

from __future__ import annotations

import hashlib
import json
import shutil
import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
CURRENT_DB = ROOT / "data/database/sapd_wiki.sqlite3"
CANDIDATE_DB = ROOT / "data/exports/worker-verify/p0-source-of-truth-reconciliation-1.1/protected-baseline-reconciled-candidate.sqlite"
RECON_11_REPORT = ROOT / "data/exports/worker-verify/p0-source-of-truth-reconciliation-1.1/source-of-truth-reconciliation-1.1-report.json"
RUNTIME_MANIFEST = ROOT / "data/exports/worker-verify/p0-runtime-baseline-freeze/runtime-baseline-manifest.json"
OUT_DIR = ROOT / "data/exports/worker-verify/p0-source-of-truth-reconciliation-1.2"
BACKUP_DIR = OUT_DIR / "pre-replacement-backup"

PROTECTED_TYPES = [
    "work_function_layer",
    "work_function",
    "security_work",
    "process_reference",
    "application_system_type",
    "standard_control",
]

FORMAL_JSON_HASH_CHECKS = [
    "frontend/capability-browser/public/data/maintenance-knowledge.json",
    "frontend/capability-browser/public/data/maintenance-index.json",
    "frontend/capability-browser/public/data/maintenance/measures.json",
    "frontend/capability-browser/public/data/capability-tree.json",
    "frontend/capability-browser/public/data/capability-workbench.json",
    "frontend/capability-browser/public/data/lifecycle-workbench.json",
    "frontend/capability-browser/public/data/environment-workbench.json",
    "frontend/capability-browser/generated/environmentBasemap.node-details.json",
    "frontend/capability-browser/generated/environmentBasemap.semantic.json",
    "frontend/capability-browser/public/data/standards-data.json",
    "frontend/capability-browser/public/data/standards-index.json",
]


def now_iso() -> str:
    return datetime.now(timezone.utc).astimezone().isoformat(timespec="seconds")


def rel(path: Path) -> str:
    return path.relative_to(ROOT).as_posix()


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def read_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def protected_counts(db_path: Path) -> dict[str, int | None]:
    counts: dict[str, int | None] = {}
    with sqlite3.connect(db_path) as conn:
        tables = {
            row[0]
            for row in conn.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").fetchall()
        }
        table = "knowledge_items" if "knowledge_items" in tables else "knowledge_item" if "knowledge_item" in tables else ""
        for item_type in PROTECTED_TYPES:
            if not table:
                counts[item_type] = None
                continue
            counts[item_type] = int(conn.execute(f'SELECT COUNT(*) FROM "{table}" WHERE type=?', (item_type,)).fetchone()[0])
    return counts


def manifest_hash_by_path() -> dict[str, str]:
    manifest = read_json(RUNTIME_MANIFEST)
    return {
        str(item["path"]): str(item["sha256"])
        for item in manifest.get("files", [])
        if item.get("path") and item.get("sha256")
    }


def formal_json_hash_check() -> dict[str, Any]:
    manifest_hashes = manifest_hash_by_path()
    rows = []
    for relative in FORMAL_JSON_HASH_CHECKS:
        path = ROOT / relative
        current_hash = sha256_file(path) if path.exists() else None
        baseline_hash = manifest_hashes.get(relative)
        rows.append(
            {
                "path": relative,
                "exists": path.exists(),
                "currentSha256": current_hash,
                "runtimeBaselineSha256": baseline_hash,
                "matchesRuntimeBaseline": bool(current_hash and baseline_hash and current_hash == baseline_hash),
            }
        )
    return {
        "status": "pass" if all(item["matchesRuntimeBaseline"] for item in rows) else "issues_found",
        "checkedAt": now_iso(),
        "checks": rows,
    }


def md_table(rows: list[list[Any]]) -> list[str]:
    if not rows:
        return []
    return [
        "| " + " | ".join(str(value) for value in rows[0]) + " |",
        "| " + " | ".join("---" for _ in rows[0]) + " |",
        *["| " + " | ".join(str(value).replace("|", "\\|") for value in row) + " |" for row in rows[1:]],
    ]


def write_hash_check_markdown(report: dict[str, Any]) -> None:
    lines = [
        "# Post Replacement JSON Hash Check",
        "",
        f"- status: `{report['status']}`",
        f"- checkedAt: `{report['checkedAt']}`",
        "",
        *md_table(
            [
                ["path", "matches", "currentSha256", "runtimeBaselineSha256"],
                *[
                    [item["path"], item["matchesRuntimeBaseline"], item["currentSha256"], item["runtimeBaselineSha256"]]
                    for item in report["checks"]
                ],
            ]
        ),
    ]
    (OUT_DIR / "post-replacement-json-hash-check.md").write_text("\n".join(lines) + "\n", encoding="utf-8")


def write_replacement_markdown(report: dict[str, Any]) -> None:
    lines = [
        "# SQLite Replacement Report",
        "",
        f"- status: `{report['status']}`",
        f"- generatedAt: `{report['generatedAt']}`",
        f"- currentSqlitePath: `{report['paths']['currentSqlite']}`",
        f"- candidateSqlitePath: `{report['paths']['candidateSqlite']}`",
        f"- backupSqlitePath: `{report['paths']['backupSqlite']}`",
        "",
        "## Hashes",
        "",
        *md_table(
            [
                ["name", "sha256"],
                ["currentBefore", report["hashes"]["currentBefore"]],
                ["candidate", report["hashes"]["candidate"]],
                ["backup", report["hashes"]["backup"]],
                ["currentAfter", report["hashes"]["currentAfter"]],
            ]
        ),
        "",
        "## Protected Baseline Counts After Replacement",
        "",
        *md_table([["type", "count"], *[[key, value] for key, value in report["protectedCountsAfter"].items()]]),
        "",
        "## Safety",
        "",
        *[f"- {key}: `{value}`" for key, value in report["safety"].items()],
    ]
    (OUT_DIR / "sqlite-replacement-report.md").write_text("\n".join(lines) + "\n", encoding="utf-8")


def main() -> int:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    BACKUP_DIR.mkdir(parents=True, exist_ok=True)

    if not CURRENT_DB.exists():
        raise SystemExit(f"missing current sqlite: {CURRENT_DB}")
    if not CANDIDATE_DB.exists():
        raise SystemExit(f"missing candidate sqlite: {CANDIDATE_DB}")
    if not RECON_11_REPORT.exists():
        raise SystemExit(f"missing 1.1 report: {RECON_11_REPORT}")
    if not RUNTIME_MANIFEST.exists():
        raise SystemExit(f"missing runtime baseline manifest: {RUNTIME_MANIFEST}")

    recon = read_json(RECON_11_REPORT)
    expected_candidate_hash = str(recon.get("candidate", {}).get("sha256") or "")
    current_before = sha256_file(CURRENT_DB)
    candidate_hash = sha256_file(CANDIDATE_DB)
    if candidate_hash != expected_candidate_hash:
        raise SystemExit(
            f"candidate hash mismatch: actual={candidate_hash} expected_from_1.1={expected_candidate_hash}"
        )

    backup_path = BACKUP_DIR / f"sapd_wiki.before-p0-sotr-1.2.{datetime.now().strftime('%Y%m%d-%H%M%S')}.sqlite3"
    shutil.copy2(CURRENT_DB, backup_path)
    backup_hash = sha256_file(backup_path)
    if backup_hash != current_before:
        raise SystemExit(f"backup hash mismatch: backup={backup_hash} currentBefore={current_before}")

    shutil.copy2(CANDIDATE_DB, CURRENT_DB)
    current_after = sha256_file(CURRENT_DB)
    if current_after != candidate_hash:
        raise SystemExit(f"replacement hash mismatch: currentAfter={current_after} candidate={candidate_hash}")

    protected_after = protected_counts(CURRENT_DB)
    hash_check = formal_json_hash_check()
    write_json(OUT_DIR / "post-replacement-json-hash-check.json", hash_check)
    write_hash_check_markdown(hash_check)

    report = {
        "status": "pass",
        "generatedAt": now_iso(),
        "paths": {
            "currentSqlite": rel(CURRENT_DB),
            "candidateSqlite": rel(CANDIDATE_DB),
            "backupSqlite": rel(backup_path),
            "runtimeManifest": rel(RUNTIME_MANIFEST),
            "reconciliation11Report": rel(RECON_11_REPORT),
        },
        "hashes": {
            "currentBefore": current_before,
            "candidate": candidate_hash,
            "expectedCandidateFrom11Report": expected_candidate_hash,
            "backup": backup_hash,
            "currentAfter": current_after,
        },
        "protectedCountsAfter": protected_after,
        "jsonHashCheckStatus": hash_check["status"],
        "safety": {
            "replacedCurrentSqlite": True,
            "backedUpCurrentSqliteBeforeReplacement": True,
            "candidateHashMatched11Report": True,
            "backupHashMatchedCurrentBefore": True,
            "currentAfterHashMatchedCandidate": True,
            "overwrotePublicData": False,
            "ranBootstrapLocalData": False,
            "ranFullPublicDataExport": False,
            "modifiedFrontendUi": False,
            "restoredEnvironmentMappingWriteLine": False,
        },
        "recommendation": {
            "oi140CanCloseAfterPostAuditsPass": True,
            "remainingRisk": "后续如修改原始数据仍必须走 runtime baseline 变更流程；本轮不代表所有业务数据永久正确。",
        },
    }
    write_json(OUT_DIR / "sqlite-replacement-report.json", report)
    write_replacement_markdown(report)
    print(json.dumps({
        "result": "pass",
        "backup": rel(backup_path),
        "currentBefore": current_before,
        "candidate": candidate_hash,
        "currentAfter": current_after,
        "jsonHashCheck": hash_check["status"],
        "protectedCountsAfter": protected_after,
    }, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
