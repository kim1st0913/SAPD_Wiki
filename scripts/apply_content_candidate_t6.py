#!/usr/bin/env python3
"""Apply the T1-T5 content candidates to the formal read-only databases."""

from __future__ import annotations

import argparse
import fcntl
import hashlib
import json
import os
import shutil
import socket
import sqlite3
import time
from contextlib import closing
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
WORK_ROOT = (
    ROOT / "data/exports/worker-verify/base-content-unified-query"
).resolve()
DEFAULT_QUERY_CANDIDATE = (
    WORK_ROOT / "candidate/sapd_wiki.content-candidate.sqlite3"
)
DEFAULT_ASSET_CANDIDATE = (
    WORK_ROOT / "candidate/sapd_content_assets.candidate.sqlite3"
)
DEFAULT_FORMAL_QUERY = ROOT / "data/database/sapd_wiki.sqlite3"
DEFAULT_FORMAL_ASSET = ROOT / "data/database/sapd_content_assets.sqlite3"
DEFAULT_USER_DB = ROOT / "data/user/sapd_wiki_user.sqlite3"
DEFAULT_T5_REPORT = WORK_ROOT / "reports/t5-offline-bundle-report.json"
DEFAULT_OUTPUT_ROOT = WORK_ROOT / "formal-apply"
APPLY_CONFIRMATION = "APPLY_BASE_CONTENT_UNIFIED_QUERY_T6"
RESTORE_CONFIRMATION = "RESTORE_BASE_CONTENT_UNIFIED_QUERY_T6"


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def file_state(path: Path) -> dict[str, Any]:
    return {
        "path": str(path.resolve()),
        "exists": path.is_file(),
        "bytes": path.stat().st_size if path.is_file() else 0,
        "sha256": sha256_file(path) if path.is_file() else None,
    }


def write_json(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


def readonly_connection(path: Path) -> sqlite3.Connection:
    connection = sqlite3.connect(
        f"file:{path.resolve()}?mode=ro&immutable=1",
        uri=True,
    )
    connection.row_factory = sqlite3.Row
    return connection


def database_integrity(path: Path) -> dict[str, Any]:
    with closing(readonly_connection(path)) as connection:
        foreign_keys = connection.execute("PRAGMA foreign_key_check").fetchall()
        return {
            "integrity_check": connection.execute(
                "PRAGMA integrity_check"
            ).fetchone()[0],
            "foreign_key_violations": len(foreign_keys),
        }


def query_database_state(path: Path) -> dict[str, Any]:
    with closing(readonly_connection(path)) as connection:
        meta = {
            str(row["key"]): str(row["value"])
            for row in connection.execute(
                "SELECT key, value FROM content_schema_meta ORDER BY key"
            )
        }
        return {
            "integrity": database_integrity(path),
            "meta": meta,
            "counts": {
                "knowledge_items": connection.execute(
                    "SELECT COUNT(*) FROM knowledge_items"
                ).fetchone()[0],
                "knowledge_relations": connection.execute(
                    "SELECT COUNT(*) FROM knowledge_relations"
                ).fetchone()[0],
                "content_documents": connection.execute(
                    "SELECT COUNT(*) FROM content_documents"
                ).fetchone()[0],
                "content_fragments": connection.execute(
                    "SELECT COUNT(*) FROM content_fragments"
                ).fetchone()[0],
                "content_relations": connection.execute(
                    "SELECT COUNT(*) FROM content_relations"
                ).fetchone()[0],
                "content_source_evidence": connection.execute(
                    "SELECT COUNT(*) FROM content_source_evidence"
                ).fetchone()[0],
            },
        }


def asset_database_state(path: Path, *, verify_blobs: bool = True) -> dict[str, Any]:
    with closing(readonly_connection(path)) as connection:
        meta = {
            str(row["key"]): str(row["value"])
            for row in connection.execute(
                "SELECT key, value FROM asset_schema_meta ORDER BY key"
            )
        }
        blob_mismatches: list[str] = []
        if verify_blobs:
            for row in connection.execute(
                "SELECT asset_hash, content_bytes FROM content_assets ORDER BY asset_hash"
            ):
                actual = hashlib.sha256(bytes(row["content_bytes"])).hexdigest()
                if actual != str(row["asset_hash"]):
                    blob_mismatches.append(str(row["asset_hash"]))
        return {
            "integrity": database_integrity(path),
            "meta": meta,
            "counts": {
                "content_assets": connection.execute(
                    "SELECT COUNT(*) FROM content_assets"
                ).fetchone()[0],
                "document_assets": connection.execute(
                    "SELECT COUNT(*) FROM document_assets"
                ).fetchone()[0],
                "original_assets": connection.execute(
                    """
                    SELECT COUNT(*)
                    FROM document_assets
                    WHERE asset_role='original'
                    """
                ).fetchone()[0],
            },
            "blob_hash_mismatches": blob_mismatches,
        }


def port_is_open(port: int) -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as client:
        client.settimeout(0.25)
        return client.connect_ex(("127.0.0.1", port)) == 0


def fsync_directory(path: Path) -> None:
    descriptor = os.open(path, os.O_RDONLY)
    try:
        os.fsync(descriptor)
    finally:
        os.close(descriptor)


def atomic_copy(source: Path, target: Path, *, expected_hash: str) -> None:
    target.parent.mkdir(parents=True, exist_ok=True)
    staged = target.parent / f".{target.name}.t6-{os.getpid()}.tmp"
    try:
        shutil.copy2(source, staged)
        with staged.open("rb") as handle:
            os.fsync(handle.fileno())
        if sha256_file(staged) != expected_hash:
            raise ValueError(f"staged database hash mismatch: {target}")
        os.replace(staged, target)
        fsync_directory(target.parent)
    finally:
        staged.unlink(missing_ok=True)


def require_path(path: Path, label: str) -> Path:
    resolved = path.resolve()
    if not resolved.is_file() or resolved.is_symlink():
        raise ValueError(f"{label} must be an existing non-symlink file: {resolved}")
    return resolved


def validate_candidate(
    *,
    query_candidate: Path,
    asset_candidate: Path,
    formal_query: Path,
    t5_report: Path,
) -> dict[str, Any]:
    report = json.loads(t5_report.read_text(encoding="utf-8"))
    if report.get("result") != "pass" or report.get("issues") != []:
        raise ValueError("T5 report is not a clean pass")
    hashes = {
        "query_candidate": sha256_file(query_candidate),
        "asset_candidate": sha256_file(asset_candidate),
        "formal_query_before": sha256_file(formal_query),
    }
    boundary = report.get("databaseBoundary", {}).get("after", {})
    if boundary.get("candidateQuery") != hashes["query_candidate"]:
        raise ValueError("T5 report query candidate hash is stale")
    if boundary.get("candidateAsset") != hashes["asset_candidate"]:
        raise ValueError("T5 report asset candidate hash is stale")
    query_state = query_database_state(query_candidate)
    asset_state = asset_database_state(asset_candidate)
    if (
        query_state["integrity"]["integrity_check"] != "ok"
        or query_state["integrity"]["foreign_key_violations"] != 0
    ):
        raise ValueError("query candidate integrity failed")
    if (
        asset_state["integrity"]["integrity_check"] != "ok"
        or asset_state["integrity"]["foreign_key_violations"] != 0
        or asset_state["blob_hash_mismatches"]
    ):
        raise ValueError("asset candidate integrity or BLOB hash verification failed")
    expected_query_counts = {
        "knowledge_items": 4694,
        "knowledge_relations": 7786,
        "content_documents": 9,
        "content_fragments": 610,
        "content_relations": 685,
        "content_source_evidence": 1304,
    }
    expected_asset_counts = {
        "content_assets": 182,
        "document_assets": 182,
        "original_assets": 9,
    }
    if query_state["counts"] != expected_query_counts:
        raise ValueError(f"query candidate counts changed: {query_state['counts']}")
    if asset_state["counts"] != expected_asset_counts:
        raise ValueError(f"asset candidate counts changed: {asset_state['counts']}")
    query_already_applied = (
        hashes["formal_query_before"] == hashes["query_candidate"]
    )
    if (
        not query_already_applied
        and query_state["meta"].get("base_database_sha256")
        != hashes["formal_query_before"]
    ):
        raise ValueError("query candidate was not built from the current formal database")
    if (
        query_state["meta"].get("asset_manifest_digest")
        != asset_state["meta"].get("asset_manifest_digest")
    ):
        raise ValueError("query and asset candidate manifest digests differ")
    return {
        "hashes": hashes,
        "query": query_state,
        "asset": asset_state,
        "t5_report_sha256": sha256_file(t5_report),
        "query_already_applied": query_already_applied,
    }


def rehearse_restore(
    *,
    output_dir: Path,
    formal_query: Path,
    formal_asset: Path,
    query_backup: Path,
    asset_backup: Path | None,
    before: dict[str, Any],
) -> dict[str, Any]:
    rehearsal = output_dir / "restore-rehearsal"
    rehearsal.mkdir(parents=True, exist_ok=False)
    query_copy = rehearsal / formal_query.name
    asset_copy = rehearsal / formal_asset.name
    shutil.copy2(formal_query, query_copy)
    shutil.copy2(formal_asset, asset_copy)
    shutil.copy2(query_backup, query_copy)
    if asset_backup is not None:
        shutil.copy2(asset_backup, asset_copy)
    else:
        asset_copy.unlink()
    result = {
        "query_restored_sha256": sha256_file(query_copy),
        "asset_restored_state": file_state(asset_copy),
        "pass": (
            sha256_file(query_copy) == before["formal_query"]["sha256"]
            and (
                (
                    asset_backup is not None
                    and asset_copy.is_file()
                    and sha256_file(asset_copy)
                    == before["formal_asset"]["sha256"]
                )
                or (asset_backup is None and not asset_copy.exists())
            )
        ),
    }
    if not result["pass"]:
        raise ValueError("independent restore rehearsal failed")
    return result


def apply(args: argparse.Namespace) -> dict[str, Any]:
    query_candidate = require_path(args.query_candidate, "query candidate")
    asset_candidate = require_path(args.asset_candidate, "asset candidate")
    formal_query = require_path(args.formal_query, "formal query database")
    user_database = require_path(args.user_database, "real user database")
    t5_report = require_path(args.t5_report, "T5 report")
    formal_asset = args.formal_asset.resolve()
    if formal_asset.is_symlink():
        raise ValueError("formal asset database must not be a symlink")
    candidate = validate_candidate(
        query_candidate=query_candidate,
        asset_candidate=asset_candidate,
        formal_query=formal_query,
        t5_report=t5_report,
    )
    before = {
        "formal_query": file_state(formal_query),
        "formal_asset": file_state(formal_asset),
        "real_user": file_state(user_database),
        "query_candidate": file_state(query_candidate),
        "asset_candidate": file_state(asset_candidate),
    }
    query_already_applied = (
        before["formal_query"]["sha256"]
        == before["query_candidate"]["sha256"]
    )
    asset_already_applied = (
        before["formal_asset"]["sha256"]
        == before["asset_candidate"]["sha256"]
    )
    if query_already_applied != asset_already_applied:
        raise ValueError("formal query and asset databases are in a partial T6 state")
    already_applied = query_already_applied and asset_already_applied
    readiness = {
        "candidate": candidate,
        "before": before,
        "ports": {
            "web_5173_open": port_is_open(5173),
            "mcp_28775_open": port_is_open(28775),
        },
        "already_applied": already_applied,
        "confirmation_required": APPLY_CONFIRMATION,
    }
    if not args.apply:
        return {
            "schema_version": "base-content-unified-query-t6-dry-run-v1",
            "mode": "dry_run",
            "result": "ready",
            **readiness,
        }
    if args.confirm_formal_apply != APPLY_CONFIRMATION:
        raise ValueError(
            f"formal apply requires --confirm-formal-apply {APPLY_CONFIRMATION}"
        )
    if already_applied:
        return {
            "schema_version": "base-content-unified-query-t6-idempotent-v1",
            "mode": "apply",
            "result": "already_applied",
            **readiness,
        }
    if any(readiness["ports"].values()):
        raise ValueError("5173 and 28775 must both be closed before formal apply")

    generated = time.strftime("%Y%m%dT%H%M%SZ", time.gmtime())
    run_id = f"t6-{generated}"
    output_dir = args.output_root.resolve() / run_id
    output_dir.mkdir(parents=True, exist_ok=False)
    recovery_dir = output_dir / "recovery/database"
    recovery_dir.mkdir(parents=True)
    query_backup = recovery_dir / "sapd_wiki.before-t6.sqlite3"
    asset_backup = (
        recovery_dir / "sapd_content_assets.before-t6.sqlite3"
        if formal_asset.is_file()
        else None
    )
    atomic_copy(
        formal_query,
        query_backup,
        expected_hash=str(before["formal_query"]["sha256"]),
    )
    if asset_backup is not None:
        atomic_copy(
            formal_asset,
            asset_backup,
            expected_hash=str(before["formal_asset"]["sha256"]),
        )
    write_json(
        recovery_dir / "asset-before-state.json",
        before["formal_asset"],
    )

    lock_path = args.output_root.resolve() / ".t6-formal-apply.lock"
    lock_path.parent.mkdir(parents=True, exist_ok=True)
    committed_query = False
    committed_asset = False
    with lock_path.open("a+", encoding="utf-8") as lock:
        fcntl.flock(lock.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
        try:
            atomic_copy(
                query_candidate,
                formal_query,
                expected_hash=str(before["query_candidate"]["sha256"]),
            )
            committed_query = True
            atomic_copy(
                asset_candidate,
                formal_asset,
                expected_hash=str(before["asset_candidate"]["sha256"]),
            )
            committed_asset = True
            after = {
                "formal_query": file_state(formal_query),
                "formal_asset": file_state(formal_asset),
                "real_user": file_state(user_database),
                "query_candidate": file_state(query_candidate),
                "asset_candidate": file_state(asset_candidate),
            }
            if after["formal_query"]["sha256"] != before["query_candidate"]["sha256"]:
                raise ValueError("formal query hash differs from candidate after apply")
            if after["formal_asset"]["sha256"] != before["asset_candidate"]["sha256"]:
                raise ValueError("formal asset hash differs from candidate after apply")
            if after["real_user"] != before["real_user"]:
                raise ValueError("real user database changed during T6")
            query_after = query_database_state(formal_query)
            asset_after = asset_database_state(formal_asset)
            restore_rehearsal = rehearse_restore(
                output_dir=output_dir,
                formal_query=formal_query,
                formal_asset=formal_asset,
                query_backup=query_backup,
                asset_backup=asset_backup,
                before=before,
            )
            report = {
                "schema_version": "base-content-unified-query-t6-formal-apply-v1",
                "mode": "apply",
                "result": "pass",
                "run_id": run_id,
                "generated_at": generated,
                "formal_apply_authorized": True,
                **readiness,
                "after": after,
                "formal_validation": {
                    "query": query_after,
                    "asset": asset_after,
                    "query_matches_candidate": True,
                    "asset_matches_candidate": True,
                    "real_user_unchanged": True,
                },
                "recovery": {
                    "created_before_apply": True,
                    "query_backup": str(query_backup.relative_to(output_dir)),
                    "asset_backup": (
                        str(asset_backup.relative_to(output_dir))
                        if asset_backup is not None
                        else None
                    ),
                    "asset_before_existed": bool(before["formal_asset"]["exists"]),
                    "independent_restore_rehearsal": restore_rehearsal,
                    "rollback_triggered": False,
                    "restore_command": (
                        "python3 scripts/apply_content_candidate_t6.py "
                        f"--restore-from {output_dir.relative_to(ROOT)} --apply "
                        f"--confirm-formal-restore {RESTORE_CONFIRMATION}"
                    ),
                },
                "gate": {
                    "result": "ready_for_runtime_acceptance",
                    "blockers": [],
                },
            }
            write_json(output_dir / "t6-formal-apply.json", report)
            write_json(
                output_dir / "recovery-manifest.json",
                {
                    "schema_version": "base-content-t6-recovery-manifest-v1",
                    "run_id": run_id,
                    "files": [
                        {
                            **file_state(path),
                            "path": str(path.relative_to(output_dir)),
                        }
                        for path in sorted(recovery_dir.iterdir())
                    ],
                },
            )
            return report
        except Exception:
            if committed_query:
                atomic_copy(
                    query_backup,
                    formal_query,
                    expected_hash=str(before["formal_query"]["sha256"]),
                )
            if committed_asset:
                if asset_backup is not None:
                    atomic_copy(
                        asset_backup,
                        formal_asset,
                        expected_hash=str(before["formal_asset"]["sha256"]),
                    )
                else:
                    formal_asset.unlink(missing_ok=True)
                    fsync_directory(formal_asset.parent)
            raise
        finally:
            fcntl.flock(lock.fileno(), fcntl.LOCK_UN)


def restore(args: argparse.Namespace) -> dict[str, Any]:
    if not args.apply or args.confirm_formal_restore != RESTORE_CONFIRMATION:
        raise ValueError(
            "formal restore requires --apply "
            f"--confirm-formal-restore {RESTORE_CONFIRMATION}"
        )
    run_dir = args.restore_from.resolve()
    if WORK_ROOT not in run_dir.parents or not run_dir.is_dir():
        raise ValueError("restore run must be inside the controlled T6 output root")
    report_path = run_dir / "t6-formal-apply.json"
    report = json.loads(report_path.read_text(encoding="utf-8"))
    if report.get("result") != "pass":
        raise ValueError("T6 apply report is not a pass")
    if port_is_open(5173) or port_is_open(28775):
        raise ValueError("5173 and 28775 must both be closed before formal restore")
    formal_query = args.formal_query.resolve()
    formal_asset = args.formal_asset.resolve()
    user_database = require_path(args.user_database, "real user database")
    user_before = file_state(user_database)
    query_backup = run_dir / report["recovery"]["query_backup"]
    atomic_copy(
        query_backup,
        formal_query,
        expected_hash=str(report["before"]["formal_query"]["sha256"]),
    )
    asset_backup_value = report["recovery"].get("asset_backup")
    if asset_backup_value:
        asset_backup = run_dir / asset_backup_value
        atomic_copy(
            asset_backup,
            formal_asset,
            expected_hash=str(report["before"]["formal_asset"]["sha256"]),
        )
    else:
        formal_asset.unlink(missing_ok=True)
        fsync_directory(formal_asset.parent)
    user_after = file_state(user_database)
    if user_before != user_after:
        raise ValueError("real user database changed during restore")
    return {
        "schema_version": "base-content-unified-query-t6-restore-v1",
        "result": "pass",
        "restored_from": str(run_dir),
        "formal_query": file_state(formal_query),
        "formal_asset": file_state(formal_asset),
        "real_user_unchanged": True,
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--query-candidate", type=Path, default=DEFAULT_QUERY_CANDIDATE)
    parser.add_argument("--asset-candidate", type=Path, default=DEFAULT_ASSET_CANDIDATE)
    parser.add_argument("--formal-query", type=Path, default=DEFAULT_FORMAL_QUERY)
    parser.add_argument("--formal-asset", type=Path, default=DEFAULT_FORMAL_ASSET)
    parser.add_argument("--user-database", type=Path, default=DEFAULT_USER_DB)
    parser.add_argument("--t5-report", type=Path, default=DEFAULT_T5_REPORT)
    parser.add_argument("--output-root", type=Path, default=DEFAULT_OUTPUT_ROOT)
    parser.add_argument("--apply", action="store_true")
    parser.add_argument("--confirm-formal-apply", default="")
    parser.add_argument("--restore-from", type=Path)
    parser.add_argument("--confirm-formal-restore", default="")
    args = parser.parse_args()
    result = restore(args) if args.restore_from else apply(args)
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
