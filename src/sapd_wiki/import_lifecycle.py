from __future__ import annotations

import hashlib
import json
import os
import sqlite3
from contextlib import closing
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from .paths import DEFAULT_DB_PATH, PROJECT_ROOT, resolve_project_path


INTERMEDIATE_TABLES = (
    "review_decisions",
    "staging_relations",
    "staging_items",
)
FORMAL_TABLES = (
    "knowledge_items",
    "knowledge_relations",
    "source_references",
    "change_logs",
)
FINALIZABLE_STATUSES = {"approved", "rejected", "failed"}


class ImportFinalizeError(ValueError):
    def __init__(self, code: str, message: str) -> None:
        self.code = code
        super().__init__(f"{code}: {message}")


def require_project_database_write_permission(
    db_path: str | Path,
    *,
    allowed: bool,
) -> Path:
    resolved = resolve_project_path(db_path).resolve()
    if resolved == DEFAULT_DB_PATH.resolve() and not allowed:
        raise ValueError(
            "--allow-project-db-write is required for the real project database"
        )
    return resolved


def _loads(value: str | None) -> dict[str, Any]:
    if not value:
        return {}
    loaded = json.loads(value)
    return loaded if isinstance(loaded, dict) else {}


def _dumps(value: Any, *, indent: int | None = None) -> str:
    return json.dumps(
        value,
        ensure_ascii=False,
        sort_keys=True,
        indent=indent,
        separators=(",", ":") if indent is None else None,
    )


def _connect_readonly(db_path: Path) -> sqlite3.Connection:
    if not db_path.is_file():
        raise FileNotFoundError(f"Database not found: {db_path}")
    connection: sqlite3.Connection | None = None
    try:
        connection = sqlite3.connect(f"{db_path.resolve().as_uri()}?mode=ro", uri=True)
        connection.row_factory = sqlite3.Row
        connection.execute("PRAGMA query_only = ON")
        connection.execute("PRAGMA foreign_keys = ON")
        return connection
    except Exception:
        if connection is not None:
            connection.close()
        raise


def _connect_write(db_path: Path) -> sqlite3.Connection:
    if not db_path.is_file():
        raise FileNotFoundError(f"Database not found: {db_path}")
    connection: sqlite3.Connection | None = None
    try:
        connection = sqlite3.connect(db_path, timeout=30.0)
        connection.row_factory = sqlite3.Row
        connection.execute("PRAGMA foreign_keys = ON")
        connection.execute("PRAGMA busy_timeout = 30000")
        return connection
    except Exception:
        if connection is not None:
            connection.close()
        raise


def _job_row(
    connection: sqlite3.Connection,
    import_job_id: str,
) -> sqlite3.Row:
    row = connection.execute(
        """
        SELECT id, status, summary_json, started_at, finished_at
        FROM import_jobs
        WHERE id = ?
        """,
        (import_job_id,),
    ).fetchone()
    if row is None:
        raise ImportFinalizeError(
            "IMPORT_JOB_NOT_FOUND",
            f"Import job not found: {import_job_id}",
        )
    return row


def _cleanup_record(summary: dict[str, Any]) -> dict[str, Any]:
    lifecycle = summary.get("import_lifecycle")
    if not isinstance(lifecycle, dict):
        return {}
    cleanup = lifecycle.get("intermediate_cleanup")
    return cleanup if isinstance(cleanup, dict) else {}


def _intermediate_counts(
    connection: sqlite3.Connection,
    import_job_id: str,
) -> dict[str, int]:
    return {
        table: int(
            connection.execute(
                f"SELECT COUNT(*) FROM {table} WHERE import_job_id = ?",
                (import_job_id,),
            ).fetchone()[0]
        )
        for table in INTERMEDIATE_TABLES
    }


def _table_digest(connection: sqlite3.Connection, table: str) -> str:
    columns = [
        row["name"]
        for row in connection.execute(f"PRAGMA table_info({table})").fetchall()
    ]
    if not columns:
        raise ImportFinalizeError(
            "IMPORT_SCHEMA_MISSING",
            f"Required table is missing: {table}",
        )
    order_column = "id" if "id" in columns else columns[0]
    digest = hashlib.sha256()
    for row in connection.execute(
        f"SELECT {', '.join(columns)} FROM {table} ORDER BY {order_column}"
    ):
        digest.update(
            _dumps([row[column] for column in columns]).encode("utf-8")
        )
        digest.update(b"\n")
    return digest.hexdigest()


def _formal_fingerprints(
    connection: sqlite3.Connection,
) -> dict[str, str]:
    return {
        table: _table_digest(connection, table)
        for table in FORMAL_TABLES
    }


def _finalize_plan(
    connection: sqlite3.Connection,
    import_job_id: str,
) -> dict[str, Any]:
    job = _job_row(connection, import_job_id)
    summary = _loads(job["summary_json"])
    cleanup = _cleanup_record(summary)
    counts = _intermediate_counts(connection, import_job_id)
    if cleanup.get("status") == "completed":
        if any(counts.values()):
            raise ImportFinalizeError(
                "IMPORT_FINALIZE_STATE_DRIFT",
                "Cleanup is marked completed but intermediate rows exist",
            )
        return {
            "result": "already_finalized",
            "import_job_id": import_job_id,
            "job_status": job["status"],
            "delete_counts": counts,
            "formal_fingerprints": _formal_fingerprints(connection),
            "cleanup": cleanup,
        }
    if job["status"] not in FINALIZABLE_STATUSES:
        raise ImportFinalizeError(
            "IMPORT_JOB_NOT_FINALIZABLE",
            f"Import job {import_job_id} cannot be finalized from status={job['status']}",
        )
    return {
        "result": "ready",
        "import_job_id": import_job_id,
        "job_status": job["status"],
        "delete_counts": counts,
        "formal_fingerprints": _formal_fingerprints(connection),
        "cleanup": cleanup,
    }


def _write_recovery_package(
    run_dir: Path,
    *,
    connection: sqlite3.Connection,
    db_path: Path,
    plan: dict[str, Any],
) -> dict[str, Any]:
    run_dir.mkdir(parents=True, exist_ok=False)
    files: list[dict[str, Any]] = []
    for table in INTERMEDIATE_TABLES:
        output = run_dir / f"{table}.json"
        rows = [
            dict(row)
            for row in connection.execute(
                f"SELECT * FROM {table} WHERE import_job_id = ? ORDER BY id",
                (plan["import_job_id"],),
            ).fetchall()
        ]
        content = _dumps(rows, indent=2) + "\n"
        output.write_text(content, encoding="utf-8")
        files.append(
            {
                "table": table,
                "path": output.name,
                "rows": len(rows),
                "sha256": hashlib.sha256(content.encode("utf-8")).hexdigest(),
            }
        )
    job = _job_row(connection, plan["import_job_id"])
    manifest = {
        "schema_version": "import-finalize-recovery-v1",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "database": str(db_path),
        "import_job_id": plan["import_job_id"],
        "job_status": plan["job_status"],
        "job_summary_json": job["summary_json"],
        "state": "prepared",
        "delete_counts": plan["delete_counts"],
        "formal_fingerprints": plan["formal_fingerprints"],
        "files": files,
    }
    manifest_path = run_dir / "manifest.json"
    manifest_path.write_text(_dumps(manifest, indent=2) + "\n", encoding="utf-8")
    return {
        "directory": str(run_dir),
        "manifest": str(manifest_path),
        "files": files,
    }


def _mark_recovery_manifest(path: Path, state: str, **details: Any) -> None:
    manifest = json.loads(path.read_text(encoding="utf-8"))
    manifest.update(
        {
            "state": state,
            "updated_at": datetime.now(timezone.utc).isoformat(),
            **details,
        }
    )
    temporary = path.with_suffix(".json.tmp")
    temporary.write_text(_dumps(manifest, indent=2) + "\n", encoding="utf-8")
    os.replace(temporary, path)


def finalize_import(
    db_path: str | Path,
    import_job_id: str,
    *,
    apply: bool = False,
    output_root: str | Path | None = None,
) -> dict[str, Any]:
    resolved_db = resolve_project_path(db_path).resolve()
    if not apply:
        with closing(_connect_readonly(resolved_db)) as connection, connection:
            plan = _finalize_plan(connection, import_job_id)
        return {
            "schema_version": "import-finalize-v1",
            "mode": "dry-run",
            **plan,
        }

    root = resolve_project_path(
        output_root
        or (
            PROJECT_ROOT
            / "data/exports/worker-verify/import-finalize"
        )
    ).resolve()
    generated = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    run_dir = root / import_job_id / generated
    with closing(_connect_write(resolved_db)) as connection, connection:
        try:
            connection.execute("BEGIN IMMEDIATE")
            plan = _finalize_plan(connection, import_job_id)
            if plan["result"] == "already_finalized":
                connection.rollback()
                recovery_manifest = plan["cleanup"].get("recovery_manifest")
                if recovery_manifest and Path(recovery_manifest).is_file():
                    manifest_path = Path(recovery_manifest)
                    if read_state := json.loads(
                        manifest_path.read_text(encoding="utf-8")
                    ):
                        if read_state.get("state") != "applied":
                            _mark_recovery_manifest(
                                manifest_path,
                                "applied",
                                reconciled_at=datetime.now(
                                    timezone.utc
                                ).isoformat(),
                            )
                return {
                    "schema_version": "import-finalize-v1",
                    "mode": "apply",
                    **plan,
                }

            recovery = _write_recovery_package(
                run_dir,
                connection=connection,
                db_path=resolved_db,
                plan=plan,
            )
            deleted: dict[str, int] = {}
            for table in INTERMEDIATE_TABLES:
                deleted[table] = connection.execute(
                    f"DELETE FROM {table} WHERE import_job_id = ?",
                    (import_job_id,),
                ).rowcount
            if deleted != plan["delete_counts"]:
                raise ImportFinalizeError(
                    "IMPORT_FINALIZE_COUNT_MISMATCH",
                    f"Expected {plan['delete_counts']}, deleted {deleted}",
                )

            formal_after = _formal_fingerprints(connection)
            if formal_after != plan["formal_fingerprints"]:
                raise ImportFinalizeError(
                    "IMPORT_FINALIZE_FORMAL_DATA_CHANGED",
                    "Formal table fingerprints changed during finalize",
                )
            integrity = connection.execute("PRAGMA integrity_check").fetchone()[0]
            foreign_keys = connection.execute("PRAGMA foreign_key_check").fetchall()
            if integrity != "ok" or foreign_keys:
                raise ImportFinalizeError(
                    "IMPORT_FINALIZE_INTEGRITY_FAILED",
                    f"integrity={integrity}, foreign_key_violations={len(foreign_keys)}",
                )

            job = _job_row(connection, import_job_id)
            summary = _loads(job["summary_json"])
            lifecycle = summary.setdefault("import_lifecycle", {})
            lifecycle["intermediate_cleanup"] = {
                "status": "completed",
                "completed_at": datetime.now(timezone.utc).isoformat(),
                "deleted": deleted,
                "recovery_manifest": recovery["manifest"],
                "formal_fingerprints_verified": True,
                "integrity_check": integrity,
                "foreign_key_violations": 0,
            }
            connection.execute(
                "UPDATE import_jobs SET summary_json = ? WHERE id = ?",
                (_dumps(summary), import_job_id),
            )
            _mark_recovery_manifest(
                Path(recovery["manifest"]),
                "committing",
            )
            connection.commit()
        except Exception as error:
            connection.rollback()
            if "recovery" in locals():
                _mark_recovery_manifest(
                    Path(recovery["manifest"]),
                    "rolled_back",
                    error=type(error).__name__,
                )
            raise

    manifest_warning = None
    try:
        _mark_recovery_manifest(
            Path(recovery["manifest"]),
            "applied",
            committed_at=datetime.now(timezone.utc).isoformat(),
        )
    except OSError as error:
        manifest_warning = (
            "database cleanup committed; recovery manifest state update failed: "
            f"{type(error).__name__}"
        )

    return {
        "schema_version": "import-finalize-v1",
        "mode": "apply",
        "result": (
            "finalized_with_recovery_state_warning"
            if manifest_warning
            else "finalized"
        ),
        "import_job_id": import_job_id,
        "job_status": plan["job_status"],
        "deleted": deleted,
        "formal_fingerprints": formal_after,
        "integrity_check": "ok",
        "foreign_key_violations": 0,
        "recovery": recovery,
        "warning": manifest_warning,
    }
