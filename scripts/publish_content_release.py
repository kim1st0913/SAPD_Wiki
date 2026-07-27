#!/usr/bin/env python3
"""Prepare, build, verify, apply, accept, and roll back content releases."""

from __future__ import annotations

import argparse
import fcntl
import hashlib
import json
import os
import shutil
import socket
import sqlite3
import subprocess
import sys
import tempfile
from contextlib import closing, contextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_RELEASE_MANIFEST = ROOT / "config/content-release-manifest.v2.json"
DEFAULT_FORMAL_QUERY = ROOT / "data/database/sapd_wiki.sqlite3"
DEFAULT_FORMAL_ASSET = ROOT / "data/database/sapd_content_assets.sqlite3"
DEFAULT_USER_DB = ROOT / "data/user/sapd_wiki_user.sqlite3"
RELEASE_ROOT = (
    ROOT
    / "data/exports/worker-verify/base-content-unified-query/releases"
).resolve()
BUILDER = ROOT / "scripts/build_content_candidate.py"
PUBLISHER = Path(__file__).resolve()
LOGICAL_QUERY_TABLES = {
    "content_documents": "stable_ref",
    "content_fragments": "stable_ref",
    "content_relations": "stable_ref",
    "content_bindings": "id",
    "content_source_evidence": "id",
}
LOGICAL_ASSET_TABLES = {
    "content_assets": "asset_hash",
    "document_assets": "id",
}
PROTECTED_BASE_TABLES = (
    "knowledge_items",
    "knowledge_relations",
    "source_references",
)
TRANSITIONS = {
    "prepared": {"built"},
    "built": {"built", "verification_pending"},
    "verification_pending": {"built", "gated", "blocked"},
    "blocked": {"built", "verification_pending"},
    "gated": {"built", "verification_pending", "applying"},
    "applying": {"applied", "gated"},
    "applied": {"accepted", "rolling_back"},
    "accepted": {"rolling_back"},
    "rolling_back": {"rolled_back", "applied"},
    "rolled_back": set(),
}


@contextmanager
def exclusive_lock(path: Path):
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("a+", encoding="utf-8") as handle:
        fcntl.flock(handle.fileno(), fcntl.LOCK_EX)
        try:
            yield
        finally:
            fcntl.flock(handle.fileno(), fcntl.LOCK_UN)


def run_locked(function):
    def wrapped(args: argparse.Namespace):
        run_dir = bounded_release_dir(args.release_id)
        with exclusive_lock(run_dir / ".release.lock"):
            return function(args)
    return wrapped


def canonical_json(value: Any) -> str:
    return json.dumps(
        value,
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
    )


def read_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def file_state(path: Path) -> dict[str, Any]:
    return {
        "exists": path.is_file(),
        "bytes": path.stat().st_size if path.is_file() else 0,
        "sha256": sha256_file(path) if path.is_file() else None,
    }


def bounded_release_dir(release_id: str) -> Path:
    if (
        len(release_id) != 64
        or any(character not in "0123456789abcdef" for character in release_id)
    ):
        raise ValueError("release id must be a full lowercase SHA-256")
    run_dir = (RELEASE_ROOT / release_id).resolve()
    if RELEASE_ROOT not in run_dir.parents:
        raise ValueError("release directory escaped the controlled root")
    return run_dir


def atomic_write_json(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    descriptor, temporary_name = tempfile.mkstemp(
        prefix=f".{path.name}.",
        suffix=".tmp",
        dir=path.parent,
    )
    temporary = Path(temporary_name)
    try:
        with os.fdopen(descriptor, "w", encoding="utf-8") as handle:
            handle.write(json.dumps(payload, ensure_ascii=False, indent=2))
            handle.write("\n")
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(temporary, path)
        fsync_directory(path.parent)
    finally:
        temporary.unlink(missing_ok=True)


def load_state(release_id: str) -> tuple[Path, dict[str, Any]]:
    run_dir = bounded_release_dir(release_id)
    state_path = run_dir / "release-state.json"
    if not state_path.is_file():
        raise FileNotFoundError(f"Release state not found: {state_path}")
    state = read_json(state_path)
    if state.get("release_id") != release_id:
        raise ValueError("release state id mismatch")
    return run_dir, state


def transition(
    run_dir: Path,
    state: dict[str, Any],
    next_status: str,
    **updates: Any,
) -> dict[str, Any]:
    current = state["status"]
    if next_status not in TRANSITIONS.get(current, set()):
        raise ValueError(
            f"invalid content release transition: {current} -> {next_status}"
        )
    state = {
        **state,
        **updates,
        "status": next_status,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    atomic_write_json(run_dir / "release-state.json", state)
    return state


def readonly_connection(path: Path) -> sqlite3.Connection:
    connection = sqlite3.connect(
        f"{path.resolve().as_uri()}?mode=ro",
        uri=True,
    )
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA query_only = ON")
    return connection


def table_exists(connection: sqlite3.Connection, table: str) -> bool:
    return (
        connection.execute(
            "SELECT 1 FROM sqlite_master WHERE type='table' AND name=?",
            (table,),
        ).fetchone()
        is not None
    )


def table_digest(
    connection: sqlite3.Connection,
    table: str,
    *,
    exclude: set[str] | None = None,
) -> str:
    excluded = exclude or set()
    columns = [
        row["name"]
        for row in connection.execute(f"PRAGMA table_info({table})")
        if row["name"] not in excluded
    ]
    order = "id" if "id" in columns else columns[0]
    digest = hashlib.sha256()
    for row in connection.execute(
        f"SELECT {', '.join(columns)} FROM {table} ORDER BY {order}"
    ):
        values = []
        for column in columns:
            value = row[column]
            if isinstance(value, bytes):
                value = hashlib.sha256(value).hexdigest()
            values.append(value)
        digest.update(canonical_json(values).encode("utf-8"))
        digest.update(b"\n")
    return digest.hexdigest()


def logical_rows(
    path: Path,
    tables: dict[str, str],
) -> dict[str, dict[str, str]]:
    if not path.is_file():
        return {table: {} for table in tables}
    result: dict[str, dict[str, str]] = {}
    with closing(readonly_connection(path)) as connection:
        for table, key_column in tables.items():
            if not table_exists(connection, table):
                result[table] = {}
                continue
            columns = [
                row["name"]
                for row in connection.execute(f"PRAGMA table_info({table})")
                if row["name"] not in {"created_at", "updated_at", "content_bytes"}
            ]
            rows: dict[str, str] = {}
            for row in connection.execute(
                f"SELECT {', '.join(columns)} FROM {table} ORDER BY {key_column}"
            ):
                key = str(row[key_column])
                rows[key] = hashlib.sha256(
                    canonical_json([row[column] for column in columns]).encode(
                        "utf-8"
                    )
                ).hexdigest()
            result[table] = rows
    return result


def logical_diff(
    parent: dict[str, dict[str, str]],
    candidate: dict[str, dict[str, str]],
) -> dict[str, Any]:
    result: dict[str, Any] = {}
    for table in sorted(set(parent) | set(candidate)):
        before = parent.get(table, {})
        after = candidate.get(table, {})
        before_keys = set(before)
        after_keys = set(after)
        result[table] = {
            "added": sorted(after_keys - before_keys),
            "removed": sorted(before_keys - after_keys),
            "changed": sorted(
                key
                for key in before_keys & after_keys
                if before[key] != after[key]
            ),
        }
    return result


def database_integrity(path: Path, *, verify_blobs: bool = False) -> dict[str, Any]:
    with closing(readonly_connection(path)) as connection:
        blob_issues: list[str] = []
        if verify_blobs:
            for row in connection.execute(
                "SELECT asset_hash, content_bytes FROM content_assets ORDER BY asset_hash"
            ):
                if hashlib.sha256(bytes(row["content_bytes"])).hexdigest() != row[
                    "asset_hash"
                ]:
                    blob_issues.append(str(row["asset_hash"]))
        return {
            "integrity_check": connection.execute(
                "PRAGMA integrity_check"
            ).fetchone()[0],
            "foreign_key_violations": len(
                connection.execute("PRAGMA foreign_key_check").fetchall()
            ),
            "blob_hash_issues": blob_issues,
        }


def protected_base_digests(path: Path) -> dict[str, str]:
    with closing(readonly_connection(path)) as connection:
        return {
            table: table_digest(connection, table)
            for table in PROTECTED_BASE_TABLES
        }


def resolve_config_path(value: str) -> Path:
    path = Path(value)
    return path.resolve() if path.is_absolute() else (ROOT / path).resolve()


def validate_approved_import_jobs(
    formal_query: Path,
    job_ids: list[str],
) -> list[dict[str, Any]]:
    if not job_ids:
        return []
    with closing(readonly_connection(formal_query)) as connection:
        result = []
        for job_id in job_ids:
            row = connection.execute(
                "SELECT id, status, summary_json FROM import_jobs WHERE id=?",
                (job_id,),
            ).fetchone()
            if row is None or row["status"] != "approved":
                raise ValueError(
                    f"content release input job is not approved: {job_id}"
                )
            summary = json.loads(row["summary_json"] or "{}")
            cleanup = (
                summary.get("import_lifecycle", {})
                .get("intermediate_cleanup", {})
                .get("status")
            )
            result.append(
                {
                    "id": job_id,
                    "status": row["status"],
                    "finalize_status": cleanup or "retained_for_acceptance",
                }
            )
        return result


def prepare(args: argparse.Namespace) -> dict[str, Any]:
    release_manifest_path = Path(args.manifest).resolve()
    release_manifest = read_json(release_manifest_path)
    if (
        release_manifest.get("schema_version") != "content-release-manifest-v2"
        or release_manifest.get("status") != "approved"
        or release_manifest.get("approval", {}).get("status") != "approved"
    ):
        raise ValueError("content release manifest is not approved")
    expected_policy = {
        "build_mode": "full-expected-snapshot-from-current-parent",
        "stable_ref_removal_default": "block",
        "parser_or_format_change_default": "block",
        "manual_content_bindings": "preserve",
        "poster_ocr_forbidden": True,
        "formal_apply_requires_dynamic_confirmation": True,
        "real_user_database_write": "forbidden",
    }
    if release_manifest.get("policy") != expected_policy:
        raise ValueError("content release policy must match the fail-closed contract")
    if release_manifest.get("approval", {}).get("approved_inputs_only") is not True:
        raise ValueError("content release requires approved inputs only")

    content_manifest = resolve_config_path(release_manifest["content_manifest"])
    ocr_review = resolve_config_path(release_manifest["ocr_review"])
    query_schema = resolve_config_path(release_manifest["query_schema"])
    asset_schema = resolve_config_path(release_manifest["asset_schema"])
    formal_query = Path(args.formal_query).resolve()
    formal_asset = Path(args.formal_asset).resolve()
    user_database = Path(args.user_database).resolve()
    for path, label in (
        (release_manifest_path, "release manifest"),
        (content_manifest, "content manifest"),
        (ocr_review, "OCR review"),
        (query_schema, "query schema"),
        (asset_schema, "asset schema"),
        (formal_query, "formal query database"),
        (formal_asset, "formal asset database"),
        (user_database, "user database"),
    ):
        if not path.is_file():
            raise FileNotFoundError(f"{label} not found: {path}")
    content_manifest_payload = read_json(content_manifest)
    if (
        content_manifest_payload.get("status") != "t0_frozen"
        or any(
            document.get("inclusion_status") != "approved"
            for document in content_manifest_payload.get("documents", [])
        )
    ):
        raise ValueError("content source manifest contains an unapproved input")
    if read_json(ocr_review).get("status") != "approved":
        raise ValueError("OCR review manifest is not approved")

    approved_jobs = validate_approved_import_jobs(
        formal_query,
        list(
            release_manifest.get("approval", {}).get(
                "approved_import_jobs",
                [],
            )
        ),
    )
    inputs = {
        "release_manifest_sha256": sha256_file(release_manifest_path),
        "content_manifest_sha256": sha256_file(content_manifest),
        "ocr_review_sha256": sha256_file(ocr_review),
        "query_schema_sha256": sha256_file(query_schema),
        "asset_schema_sha256": sha256_file(asset_schema),
        "importer_sha256": sha256_file(BUILDER),
        "publisher_sha256": sha256_file(PUBLISHER),
        "formal_query_identity": str(formal_query),
        "formal_asset_identity": str(formal_asset),
        "user_database_identity": str(user_database),
        "parent_query_sha256": sha256_file(formal_query),
        "parent_asset_sha256": sha256_file(formal_asset),
        "approved_import_jobs": approved_jobs,
    }
    release_id = hashlib.sha256(
        canonical_json(inputs).encode("utf-8")
    ).hexdigest()
    run_dir = bounded_release_dir(release_id)
    state_path = run_dir / "release-state.json"
    if state_path.is_file():
        state = read_json(state_path)
        if state.get("inputs") != inputs:
            raise ValueError("existing release id has different inputs")
        return state

    input_dir = run_dir / "input"
    candidate_dir = run_dir / "candidate"
    report_dir = run_dir / "reports"
    for directory in (input_dir, candidate_dir, report_dir):
        directory.mkdir(parents=True, exist_ok=True)
    snapshots = {
        "release_manifest": input_dir / "release-manifest.json",
        "content_manifest": input_dir / "content-manifest.json",
        "ocr_review": input_dir / "ocr-review.json",
        "query_schema": input_dir / "query-schema.sql",
        "asset_schema": input_dir / "asset-schema.sql",
    }
    for key, source in (
        ("release_manifest", release_manifest_path),
        ("content_manifest", content_manifest),
        ("ocr_review", ocr_review),
        ("query_schema", query_schema),
        ("asset_schema", asset_schema),
    ):
        shutil.copy2(source, snapshots[key])
    state = {
        "schema_version": "content-release-state-v2",
        "release_id": release_id,
        "status": "prepared",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "inputs": inputs,
        "paths": {
            **{key: str(path) for key, path in snapshots.items()},
            "formal_query": str(formal_query),
            "formal_asset": str(formal_asset),
            "user_database": str(user_database),
            "candidate_query": str(candidate_dir / "sapd_wiki.sqlite3"),
            "candidate_asset": str(
                candidate_dir / "sapd_content_assets.sqlite3"
            ),
            "builder_report": str(report_dir / "build-report.json"),
            "verification_report": str(report_dir / "verify-report.json"),
        },
        "user_database_before": file_state(user_database),
    }
    atomic_write_json(state_path, state)
    return state


def ensure_parent_unchanged(state: dict[str, Any]) -> None:
    query = Path(state["paths"]["formal_query"])
    asset = Path(state["paths"]["formal_asset"])
    if sha256_file(query) != state["inputs"]["parent_query_sha256"]:
        raise ValueError("CONTENT_RELEASE_STALE_PARENT_QUERY")
    if sha256_file(asset) != state["inputs"]["parent_asset_sha256"]:
        raise ValueError("CONTENT_RELEASE_STALE_PARENT_ASSET")


def ensure_inputs_unchanged(state: dict[str, Any]) -> None:
    checks = {
        "release_manifest": "release_manifest_sha256",
        "content_manifest": "content_manifest_sha256",
        "ocr_review": "ocr_review_sha256",
        "query_schema": "query_schema_sha256",
        "asset_schema": "asset_schema_sha256",
    }
    for path_key, hash_key in checks.items():
        if sha256_file(Path(state["paths"][path_key])) != state["inputs"][hash_key]:
            raise ValueError(f"CONTENT_RELEASE_INPUT_CHANGED_{path_key.upper()}")
    if sha256_file(BUILDER) != state["inputs"]["importer_sha256"]:
        raise ValueError("CONTENT_RELEASE_BUILDER_CHANGED")
    if sha256_file(PUBLISHER) != state["inputs"]["publisher_sha256"]:
        raise ValueError("CONTENT_RELEASE_PUBLISHER_CHANGED")


@run_locked
def build(args: argparse.Namespace) -> dict[str, Any]:
    run_dir, state = load_state(args.release_id)
    if state["status"] not in {
        "prepared",
        "built",
        "gated",
        "blocked",
        "verification_pending",
    }:
        raise ValueError(f"release cannot build from {state['status']}")
    ensure_parent_unchanged(state)
    ensure_inputs_unchanged(state)
    command = [
        sys.executable,
        str(BUILDER),
        "--manifest",
        state["paths"]["content_manifest"],
        "--ocr-review",
        state["paths"]["ocr_review"],
        "--query-schema",
        state["paths"]["query_schema"],
        "--asset-schema",
        state["paths"]["asset_schema"],
        "--formal-database",
        state["paths"]["formal_query"],
        "--candidate-query",
        state["paths"]["candidate_query"],
        "--candidate-asset",
        state["paths"]["candidate_asset"],
        "--parent-query-sha256",
        state["inputs"]["parent_query_sha256"],
        "--release-id",
        state["release_id"],
        "--dynamic-expectations",
        "--report",
        state["paths"]["builder_report"],
    ]
    completed = subprocess.run(
        command,
        cwd=ROOT,
        text=True,
        capture_output=True,
    )
    if completed.returncode != 0:
        raise RuntimeError(
            "content candidate build failed:\n"
            + completed.stdout[-4000:]
            + completed.stderr[-4000:]
        )
    builder_report = read_json(Path(state["paths"]["builder_report"]))
    if builder_report.get("result") != "pass":
        raise ValueError("content candidate builder report is not a pass")

    formal_query = Path(state["paths"]["formal_query"])
    formal_asset = Path(state["paths"]["formal_asset"])
    candidate_query = Path(state["paths"]["candidate_query"])
    candidate_asset = Path(state["paths"]["candidate_asset"])
    base_before = protected_base_digests(formal_query)
    base_after = protected_base_digests(candidate_query)
    if base_before != base_after:
        raise ValueError("content build changed protected base knowledge tables")
    diff = {
        "query": logical_diff(
            logical_rows(formal_query, LOGICAL_QUERY_TABLES),
            logical_rows(candidate_query, LOGICAL_QUERY_TABLES),
        ),
        "asset": logical_diff(
            logical_rows(formal_asset, LOGICAL_ASSET_TABLES),
            logical_rows(candidate_asset, LOGICAL_ASSET_TABLES),
        ),
    }
    build_report = {
        "schema_version": "content-release-build-v2",
        "result": "pass",
        "release_id": state["release_id"],
        "parent": {
            "query_sha256": state["inputs"]["parent_query_sha256"],
            "asset_sha256": state["inputs"]["parent_asset_sha256"],
        },
        "candidate": {
            "query_sha256": sha256_file(candidate_query),
            "asset_sha256": sha256_file(candidate_asset),
        },
        "protected_base_digests": base_after,
        "diff": diff,
        "builder_report": state["paths"]["builder_report"],
        "user_database": file_state(Path(state["paths"]["user_database"])),
    }
    report_path = run_dir / "reports/release-build.json"
    atomic_write_json(report_path, build_report)
    return transition(
        run_dir,
        state,
        "built",
        build={
            **build_report,
            "report": str(report_path),
        },
    )


def all_removed(diff: dict[str, Any]) -> list[str]:
    removed: list[str] = []
    for domain, tables in diff.items():
        for table, changes in tables.items():
            removed.extend(
                f"{domain}:{table}:{key}" for key in changes["removed"]
            )
    return removed


def changed_document_contracts(
    formal_query: Path,
    candidate_query: Path,
) -> list[str]:
    def documents(path: Path) -> dict[str, tuple[str, str]]:
        with closing(readonly_connection(path)) as connection:
            return {
                row["stable_ref"]: (row["format"], row["parser"])
                for row in connection.execute(
                    "SELECT stable_ref, format, parser FROM content_documents"
                )
            }

    before = documents(formal_query)
    after = documents(candidate_query)
    return sorted(
        stable_ref
        for stable_ref in set(before) & set(after)
        if before[stable_ref] != after[stable_ref]
    )


@run_locked
def verify(args: argparse.Namespace) -> dict[str, Any]:
    run_dir, state = load_state(args.release_id)
    if state["status"] not in {
        "built",
        "gated",
        "blocked",
        "verification_pending",
    }:
        raise ValueError(f"release cannot verify from {state['status']}")
    ensure_parent_unchanged(state)
    ensure_inputs_unchanged(state)
    if state["status"] != "verification_pending":
        state = transition(
            run_dir,
            state,
            "verification_pending",
            verification=None,
        )
    candidate_query = Path(state["paths"]["candidate_query"])
    candidate_asset = Path(state["paths"]["candidate_asset"])
    query_integrity = database_integrity(candidate_query)
    asset_integrity = database_integrity(
        candidate_asset,
        verify_blobs=True,
    )
    user_state = file_state(Path(state["paths"]["user_database"]))
    removed = all_removed(state["build"]["diff"])
    contract_changes = changed_document_contracts(
        Path(state["paths"]["formal_query"]),
        candidate_query,
    )
    policy = read_json(Path(state["paths"]["release_manifest"]))["policy"]
    removal_approval = None
    if args.removal_approval:
        approval_path = Path(args.removal_approval).resolve()
        removal_approval = read_json(approval_path)
        approved_refs = set(removal_approval.get("approved_refs", []))
        if (
            removal_approval.get("schema_version")
            != "content-release-removal-approval-v1"
            or removal_approval.get("status") != "approved"
            or removal_approval.get("release_id") != state["release_id"]
            or not removal_approval.get("approver")
            or not removal_approval.get("reason")
            or not removal_approval.get("approved_at")
            or not set(removed).issubset(approved_refs)
        ):
            raise ValueError("removal approval is invalid or incomplete")
        removal_approval = {
            **removal_approval,
            "path": str(approval_path),
            "sha256": sha256_file(approval_path),
        }
    blockers: list[str] = []
    if query_integrity != {
        "integrity_check": "ok",
        "foreign_key_violations": 0,
        "blob_hash_issues": [],
    }:
        blockers.append("candidate query integrity failed")
    if asset_integrity != {
        "integrity_check": "ok",
        "foreign_key_violations": 0,
        "blob_hash_issues": [],
    }:
        blockers.append("candidate asset integrity or BLOB verification failed")
    if (
        removed
        and policy.get("stable_ref_removal_default") == "block"
        and removal_approval is None
    ):
        blockers.append(f"stable refs/assets removed without approval: {len(removed)}")
    if (
        contract_changes
        and policy.get("parser_or_format_change_default") == "block"
    ):
        blockers.append(
            f"document parser/format contracts changed: {len(contract_changes)}"
        )
    if user_state != state["user_database_before"]:
        blockers.append("real user database changed")
    report = {
        "schema_version": "content-release-verify-v2",
        "result": "pass" if not blockers else "blocked",
        "release_id": state["release_id"],
        "candidate": state["build"]["candidate"],
        "query_integrity": query_integrity,
        "asset_integrity": asset_integrity,
        "removed": removed,
        "removal_approval": removal_approval,
        "document_contract_changes": contract_changes,
        "user_database_unchanged": user_state == state["user_database_before"],
        "blockers": blockers,
        "next": (
            "ready_to_apply"
            if not blockers
            else "review diff and explicit removal approvals"
        ),
    }
    report_path = Path(state["paths"]["verification_report"])
    atomic_write_json(report_path, report)
    if blockers:
        transition(
            run_dir,
            state,
            "blocked",
            verification={**report, "report": str(report_path)},
        )
        raise ValueError("; ".join(blockers))
    return transition(
        run_dir,
        state,
        "gated",
        verification={**report, "report": str(report_path)},
    )


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


def atomic_copy(source: Path, target: Path, expected_hash: str) -> None:
    target.parent.mkdir(parents=True, exist_ok=True)
    temporary = target.parent / f".{target.name}.content-release-{os.getpid()}.tmp"
    try:
        shutil.copy2(source, temporary)
        with temporary.open("rb") as handle:
            os.fsync(handle.fileno())
        if sha256_file(temporary) != expected_hash:
            raise ValueError("atomic copy hash mismatch")
        os.replace(temporary, target)
        fsync_directory(target.parent)
    finally:
        temporary.unlink(missing_ok=True)


def current_pair(state: dict[str, Any]) -> tuple[str, str]:
    return (
        sha256_file(Path(state["paths"]["formal_query"])),
        sha256_file(Path(state["paths"]["formal_asset"])),
    )


def expected_pair(state: dict[str, Any], kind: str) -> tuple[str, str]:
    if kind == "parent":
        return (
            state["inputs"]["parent_query_sha256"],
            state["inputs"]["parent_asset_sha256"],
        )
    return (
        state["build"]["candidate"]["query_sha256"],
        state["build"]["candidate"]["asset_sha256"],
    )


def restore_pair(
    query_source: Path,
    asset_source: Path,
    state: dict[str, Any],
    kind: str,
) -> None:
    query_hash, asset_hash = expected_pair(state, kind)
    formal_query = Path(state["paths"]["formal_query"])
    formal_asset = Path(state["paths"]["formal_asset"])
    try:
        atomic_copy(query_source, formal_query, query_hash)
        atomic_copy(asset_source, formal_asset, asset_hash)
    except Exception:
        # Never leave a mixed pair after a recoverable Python failure.
        if sha256_file(formal_query) != query_hash:
            atomic_copy(query_source, formal_query, query_hash)
        if sha256_file(formal_asset) != asset_hash:
            atomic_copy(asset_source, formal_asset, asset_hash)
        raise


def pair_is_owned_by_release(
    pair: tuple[str, str],
    state: dict[str, Any],
) -> bool:
    parent = expected_pair(state, "parent")
    candidate = expected_pair(state, "candidate")
    return pair[0] in {parent[0], candidate[0]} and pair[1] in {
        parent[1],
        candidate[1],
    }


def validate_applied_pair(
    state: dict[str, Any],
    user_database: Path,
) -> None:
    if current_pair(state) != expected_pair(state, "candidate"):
        raise ValueError("formal database pair does not match candidate")
    if file_state(user_database) != state["user_database_before"]:
        raise ValueError("real user database changed since prepare")
    query_result = database_integrity(Path(state["paths"]["formal_query"]))
    asset_result = database_integrity(
        Path(state["paths"]["formal_asset"]),
        verify_blobs=True,
    )
    if (
        query_result["integrity_check"] != "ok"
        or query_result["foreign_key_violations"]
        or asset_result["integrity_check"] != "ok"
        or asset_result["foreign_key_violations"]
        or asset_result["blob_hash_issues"]
    ):
        raise ValueError("formal database integrity failed after apply")


def complete_apply(
    run_dir: Path,
    state: dict[str, Any],
    journal_path: Path,
    query_backup: Path,
    asset_backup: Path,
) -> dict[str, Any]:
    formal_query = Path(state["paths"]["formal_query"])
    formal_asset = Path(state["paths"]["formal_asset"])
    user_database = Path(state["paths"]["user_database"])
    validate_applied_pair(state, user_database)
    apply_report = {
        "schema_version": "content-release-apply-v2",
        "result": "pass",
        "release_id": state["release_id"],
        "formal_query": file_state(formal_query),
        "formal_asset": file_state(formal_asset),
        "user_database_unchanged": True,
        "recovery": {
            "query": str(query_backup),
            "asset": str(asset_backup),
            "rollback_confirmation": (
                f"RESTORE_CONTENT_RELEASE_{state['release_id']}"
            ),
        },
        "next": "restart stable Web so immutable MCP runtime reopens the new databases",
    }
    report_path = run_dir / "reports/apply-report.json"
    atomic_write_json(report_path, apply_report)
    applied = transition(
        run_dir,
        state,
        "applied",
        apply={**apply_report, "report": str(report_path)},
        apply_journal=None,
    )
    atomic_write_json(
        journal_path,
        {**read_json(journal_path), "state": "applied"},
    )
    return applied


@run_locked
def apply_release(args: argparse.Namespace) -> dict[str, Any]:
    run_dir, state = load_state(args.release_id)
    if state["status"] not in {"gated", "applying"}:
        raise ValueError(f"release cannot apply from {state['status']}")
    if (
        state["status"] == "gated"
        and (
            state.get("verification", {}).get("result") != "pass"
            or state.get("verification", {}).get("candidate")
            != state.get("build", {}).get("candidate")
        )
    ):
        raise ValueError("release lacks a current passing verification gate")
    expected_confirmation = f"APPLY_CONTENT_RELEASE_{state['release_id']}"
    if args.confirm != expected_confirmation:
        raise ValueError(
            f"formal apply requires --confirm {expected_confirmation}"
        )
    formal_query = Path(state["paths"]["formal_query"])
    formal_asset = Path(state["paths"]["formal_asset"])
    candidate_query = Path(state["paths"]["candidate_query"])
    candidate_asset = Path(state["paths"]["candidate_asset"])
    user_database = Path(state["paths"]["user_database"])
    if formal_query == DEFAULT_FORMAL_QUERY.resolve() and (
        port_is_open(5173) or port_is_open(28775)
    ):
        raise ValueError("5173 and 28775 must both be closed before formal apply")

    ensure_inputs_unchanged(state)
    recovery = run_dir / "recovery"
    recovery.mkdir(parents=True, exist_ok=True)
    query_backup = recovery / "sapd_wiki.before-release.sqlite3"
    asset_backup = recovery / "sapd_content_assets.before-release.sqlite3"
    journal_path = recovery / "apply-journal.json"
    with exclusive_lock(RELEASE_ROOT / ".content-release-apply.lock"):
        if state["status"] == "applying":
            pair = current_pair(state)
            if not pair_is_owned_by_release(pair, state):
                raise ValueError("CONTENT_RELEASE_STALE_NEWER_RELEASE")
            if pair == expected_pair(state, "candidate"):
                return complete_apply(
                    run_dir,
                    state,
                    journal_path,
                    query_backup,
                    asset_backup,
                )
            elif pair == expected_pair(state, "parent"):
                state = transition(run_dir, state, "gated", apply_journal=None)
                raise ValueError("previous apply was compensated; retry apply")
            else:
                restore_pair(query_backup, asset_backup, state, "parent")
                state = transition(run_dir, state, "gated", apply_journal=None)
                raise ValueError("partial apply recovered to parent; retry apply")
        else:
            ensure_parent_unchanged(state)
            if file_state(user_database) != state["user_database_before"]:
                raise ValueError("real user database changed since prepare")
            atomic_copy(
                formal_query,
                query_backup,
                state["inputs"]["parent_query_sha256"],
            )
            atomic_copy(
                formal_asset,
                asset_backup,
                state["inputs"]["parent_asset_sha256"],
            )
            journal = {
                "schema_version": "content-release-apply-journal-v1",
                "release_id": state["release_id"],
                "state": "applying",
                "parent": {
                    "query_sha256": state["inputs"]["parent_query_sha256"],
                    "asset_sha256": state["inputs"]["parent_asset_sha256"],
                },
                "candidate": state["build"]["candidate"],
                "recovery": {
                    "query": str(query_backup),
                    "asset": str(asset_backup),
                },
            }
            atomic_write_json(journal_path, journal)
            state = transition(
                run_dir,
                state,
                "applying",
                apply_journal=str(journal_path),
            )
            try:
                atomic_copy(
                    candidate_query,
                    formal_query,
                    state["build"]["candidate"]["query_sha256"],
                )
                atomic_copy(
                    candidate_asset,
                    formal_asset,
                    state["build"]["candidate"]["asset_sha256"],
                )
                if file_state(user_database) != state["user_database_before"]:
                    raise ValueError("real user database changed during apply")
                if database_integrity(formal_query)["integrity_check"] != "ok":
                    raise ValueError("formal query integrity failed after apply")
                if database_integrity(
                    formal_asset,
                    verify_blobs=True,
                )["blob_hash_issues"]:
                    raise ValueError("formal asset BLOB verification failed after apply")
            except Exception:
                if not pair_is_owned_by_release(current_pair(state), state):
                    raise ValueError("CONTENT_RELEASE_STALE_NEWER_RELEASE")
                restore_pair(query_backup, asset_backup, state, "parent")
                transition(run_dir, state, "gated", apply_journal=None)
                raise
        return complete_apply(
            run_dir,
            state,
            journal_path,
            query_backup,
            asset_backup,
        )


def validate_mcp_evidence(
    evidence: dict[str, Any],
    state: dict[str, Any],
    runtime_report: dict[str, Any] | None = None,
) -> None:
    expected_tools = {
        "search_knowledge",
        "get_knowledge_object",
        "get_related_knowledge",
        "get_source_evidence",
        "get_knowledge_version",
    }
    tool_results = evidence.get("tool_results")
    report_binding_valid = True
    if runtime_report is not None:
        try:
            observed_at = datetime.fromisoformat(
                str(evidence.get("observed_at")).replace("Z", "+00:00")
            )
            applied_at = datetime.fromisoformat(
                str(state.get("updated_at")).replace("Z", "+00:00")
            )
            report_binding_valid = (
                evidence.get("runtime_id")
                == runtime_report.get("runtime", {}).get("runtimeId")
                and evidence.get("client_id")
                in runtime_report.get("mcp", {}).get("authorizedClientIds", [])
                and observed_at.tzinfo is not None
                and observed_at >= applied_at
                and observed_at <= datetime.now(timezone.utc)
            )
        except (TypeError, ValueError):
            report_binding_valid = False
    if (
        evidence.get("schema_version") != "content-release-mcp-five-tools-v1"
        or evidence.get("result") != "pass"
        or evidence.get("release_id") != state["release_id"]
        or evidence.get("query_sha256")
        != state["build"]["candidate"]["query_sha256"]
        or evidence.get("asset_sha256")
        != state["build"]["candidate"]["asset_sha256"]
        or not evidence.get("runtime_id")
        or not evidence.get("client_id")
        or not evidence.get("observed_at")
        or not isinstance(tool_results, dict)
        or set(tool_results) != expected_tools
        or any(
            not isinstance(result, dict)
            or result.get("result") != "pass"
            or not (result.get("result_count") is not None or result.get("digest"))
            for result in tool_results.values()
        )
        or not report_binding_valid
    ):
        raise ValueError("MCP five-tool evidence is not bound to this release")


@run_locked
def accept(args: argparse.Namespace) -> dict[str, Any]:
    run_dir, state = load_state(args.release_id)
    if state["status"] != "applied":
        raise ValueError(f"release cannot accept from {state['status']}")
    report_path = Path(args.runtime_report).resolve()
    report = read_json(report_path)
    report_release_id = (
        report.get("release_id")
        or report.get("releaseId")
        or report.get("contentReleaseId")
    )
    if report.get("result") != "pass" or report_release_id != state["release_id"]:
        raise ValueError("runtime report is not a pass for this release")
    if current_pair(state) != expected_pair(state, "candidate"):
        raise ValueError("formal database pair no longer matches this release")
    boundary = report.get("databaseBoundary", {}).get("before", {})
    if (
        boundary.get("formalQuery")
        != state["build"]["candidate"]["query_sha256"]
        or boundary.get("formalAsset")
        != state["build"]["candidate"]["asset_sha256"]
    ):
        raise ValueError("runtime report database hashes do not match this release")
    mcp_five_tools = (
        report.get("mcpFiveTools")
        or report.get("mcp_five_tools")
        or {}
    )
    validate_mcp_evidence(mcp_five_tools, state, report)
    if file_state(Path(state["paths"]["user_database"])) != state[
        "user_database_before"
    ]:
        raise ValueError("real user database changed before acceptance")
    accepted = {
        "schema_version": "content-release-accept-v2",
        "result": "pass",
        "release_id": state["release_id"],
        "runtime_report": str(report_path),
        "runtime_report_sha256": sha256_file(report_path),
        "accepted_at": datetime.now(timezone.utc).isoformat(),
    }
    report_output = run_dir / "reports/accept-report.json"
    atomic_write_json(report_output, accepted)
    return transition(
        run_dir,
        state,
        "accepted",
        acceptance={**accepted, "report": str(report_output)},
    )


@run_locked
def rollback(args: argparse.Namespace) -> dict[str, Any]:
    run_dir, state = load_state(args.release_id)
    if state["status"] not in {"applied", "accepted", "rolling_back"}:
        raise ValueError(f"release cannot roll back from {state['status']}")
    expected = f"RESTORE_CONTENT_RELEASE_{state['release_id']}"
    if args.confirm != expected:
        raise ValueError(f"rollback requires --confirm {expected}")
    formal_query = Path(state["paths"]["formal_query"])
    formal_asset = Path(state["paths"]["formal_asset"])
    user_database = Path(state["paths"]["user_database"])
    if formal_query == DEFAULT_FORMAL_QUERY.resolve() and (
        port_is_open(5173) or port_is_open(28775)
    ):
        raise ValueError("5173 and 28775 must both be closed before rollback")
    query_backup = Path(state["apply"]["recovery"]["query"])
    asset_backup = Path(state["apply"]["recovery"]["asset"])
    rollback_dir = run_dir / "recovery/rollback"
    rollback_dir.mkdir(parents=True, exist_ok=True)
    query_candidate = rollback_dir / "sapd_wiki.before-rollback.sqlite3"
    asset_candidate = rollback_dir / "sapd_content_assets.before-rollback.sqlite3"
    journal_path = rollback_dir / "rollback-journal.json"
    with exclusive_lock(RELEASE_ROOT / ".content-release-apply.lock"):
        pair = current_pair(state)
        if not pair_is_owned_by_release(pair, state):
            raise ValueError("CONTENT_RELEASE_STALE_NEWER_RELEASE")
        if state["status"] != "rolling_back":
            if pair != expected_pair(state, "candidate"):
                raise ValueError("CONTENT_RELEASE_STALE_ROLLBACK_TARGET")
            atomic_copy(
                formal_query,
                query_candidate,
                state["build"]["candidate"]["query_sha256"],
            )
            atomic_copy(
                formal_asset,
                asset_candidate,
                state["build"]["candidate"]["asset_sha256"],
            )
            atomic_write_json(
                journal_path,
                {
                    "schema_version": "content-release-rollback-journal-v1",
                    "release_id": state["release_id"],
                    "state": "rolling_back",
                },
            )
            state = transition(
                run_dir,
                state,
                "rolling_back",
                rollback_journal=str(journal_path),
            )
        elif pair == expected_pair(state, "parent"):
            pass
        elif pair != expected_pair(state, "candidate"):
            restore_pair(query_candidate, asset_candidate, state, "candidate")
            transition(run_dir, state, "applied", rollback_journal=None)
            raise ValueError("partial rollback compensated to candidate; retry")
        user_before = file_state(user_database)
        try:
            restore_pair(query_backup, asset_backup, state, "parent")
            if file_state(user_database) != user_before:
                raise ValueError("real user database changed during rollback")
        except Exception:
            if not pair_is_owned_by_release(current_pair(state), state):
                raise ValueError("CONTENT_RELEASE_STALE_NEWER_RELEASE")
            restore_pair(query_candidate, asset_candidate, state, "candidate")
            transition(run_dir, state, "applied", rollback_journal=None)
            raise
        report = {
            "schema_version": "content-release-rollback-v2",
            "result": "pass",
            "release_id": state["release_id"],
            "formal_query": file_state(formal_query),
            "formal_asset": file_state(formal_asset),
            "user_database_unchanged": True,
        }
        report_path = run_dir / "reports/rollback-report.json"
        atomic_write_json(report_path, report)
        rolled_back = transition(
            run_dir,
            state,
            "rolled_back",
            rollback={**report, "report": str(report_path)},
            rollback_journal=None,
        )
        atomic_write_json(
            journal_path,
            {**read_json(journal_path), "state": "rolled_back"},
        )
        return rolled_back


def status(args: argparse.Namespace) -> dict[str, Any]:
    _run_dir, state = load_state(args.release_id)
    return state


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Repeatable SAPD content release pipeline."
    )
    subparsers = parser.add_subparsers(dest="command", required=True)

    prepare_parser = subparsers.add_parser("prepare")
    prepare_parser.add_argument(
        "--manifest",
        default=str(DEFAULT_RELEASE_MANIFEST),
    )
    prepare_parser.add_argument(
        "--formal-query",
        default=str(DEFAULT_FORMAL_QUERY),
    )
    prepare_parser.add_argument(
        "--formal-asset",
        default=str(DEFAULT_FORMAL_ASSET),
    )
    prepare_parser.add_argument(
        "--user-database",
        default=str(DEFAULT_USER_DB),
    )
    prepare_parser.set_defaults(func=prepare)

    for command, function in (
        ("build", build),
        ("verify", verify),
        ("status", status),
    ):
        command_parser = subparsers.add_parser(command)
        command_parser.add_argument("--release-id", required=True)
        if command == "verify":
            command_parser.add_argument(
                "--removal-approval",
                default=None,
                help=(
                    "Approved, release-bound JSON allowlist for exact removed refs."
                ),
            )
        command_parser.set_defaults(func=function)

    apply_parser = subparsers.add_parser("apply")
    apply_parser.add_argument("--release-id", required=True)
    apply_parser.add_argument("--confirm", required=True)
    apply_parser.set_defaults(func=apply_release)

    accept_parser = subparsers.add_parser("accept")
    accept_parser.add_argument("--release-id", required=True)
    accept_parser.add_argument("--runtime-report", required=True)
    accept_parser.set_defaults(func=accept)

    rollback_parser = subparsers.add_parser("rollback")
    rollback_parser.add_argument("--release-id", required=True)
    rollback_parser.add_argument("--confirm", required=True)
    rollback_parser.set_defaults(func=rollback)
    return parser


def main() -> int:
    args = build_parser().parse_args()
    result = args.func(args)
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
