#!/usr/bin/env python3
from __future__ import annotations

import argparse
import base64
import hashlib
import json
import sqlite3
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterable


PROJECT_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_DB = PROJECT_ROOT / "data" / "database" / "sapd_wiki.sqlite3"
DEFAULT_USER_DB = PROJECT_ROOT / "data" / "user" / "sapd_wiki_user.sqlite3"
APPROVED_CUTOFF = "2026-07-05 13:36:35"
REVIEWING_JOB_IDS = (
    "ecdcd493-7b2b-474c-b53a-072760d46460",
    "3e828d78-98dc-48c3-95e0-56383b55714a",
)

EXPECTED_BEFORE = {
    "knowledge_items": 4678,
    "knowledge_relations": 7757,
    "source_references": 194074,
    "import_jobs": 29,
    "staging_items": 12994,
    "staging_relations": 37335,
    "review_decisions": 48003,
}
EXPECTED_DELETE = {
    "review_decisions": 48003,
    "staging_relations": 37335,
    "staging_items": 12994,
}
FORMAL_TABLES = (
    "knowledge_items",
    "knowledge_relations",
    "source_files",
    "source_references",
    "change_logs",
)
BACKUP_COUNT_TABLES = FORMAL_TABLES + (
    "import_jobs",
    "staging_items",
    "staging_relations",
    "review_decisions",
)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Safely remove approved and abandoned import staging/review payloads.",
    )
    parser.add_argument("--db", default=str(DEFAULT_DB), help="SQLite database path.")
    parser.add_argument(
        "--user-db",
        default=str(DEFAULT_USER_DB),
        help="User database observed for no-write verification.",
    )
    parser.add_argument("--backup", help="Verified pre-cleanup SQLite backup path.")
    parser.add_argument("--report", help="Optional JSON report path.")
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Apply the cleanup. Without this flag, perform a read-only dry-run.",
    )
    parser.add_argument(
        "--allow-project-db-write",
        action="store_true",
        help="Required with --apply for the real project database.",
    )
    parser.add_argument(
        "--vacuum",
        action="store_true",
        help="After a successful cleanup, compact the same database in place.",
    )
    return parser.parse_args()


def resolve_path(value: str) -> Path:
    path = Path(value).expanduser()
    if not path.is_absolute():
        path = PROJECT_ROOT / path
    return path.resolve()


def connect_read_only(path: Path) -> sqlite3.Connection:
    connection = sqlite3.connect(f"{path.as_uri()}?mode=ro", uri=True)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA query_only=ON")
    return connection


def connect_read_write(path: Path) -> sqlite3.Connection:
    connection = sqlite3.connect(str(path), timeout=30)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA busy_timeout=30000")
    connection.execute("PRAGMA foreign_keys=ON")
    return connection


def quote_identifier(value: str) -> str:
    return '"' + value.replace('"', '""') + '"'


def scalar(connection: sqlite3.Connection, sql: str, params: Iterable[Any] = ()) -> Any:
    row = connection.execute(sql, tuple(params)).fetchone()
    if row is None:
        raise RuntimeError(f"query returned no row: {sql}")
    return row[0]


def table_count(connection: sqlite3.Connection, table: str) -> int:
    return int(scalar(connection, f"SELECT COUNT(*) FROM {quote_identifier(table)}"))


def table_counts(connection: sqlite3.Connection, tables: Iterable[str]) -> dict[str, int]:
    return {table: table_count(connection, table) for table in tables}


def normalize_value(value: Any) -> Any:
    if isinstance(value, bytes):
        return {"bytes_b64": base64.b64encode(value).decode("ascii")}
    return value


def table_fingerprint(connection: sqlite3.Connection, table: str) -> dict[str, Any]:
    table_info = connection.execute(
        f"PRAGMA table_info({quote_identifier(table)})",
    ).fetchall()
    if not table_info:
        raise RuntimeError(f"table not found: {table}")
    columns = [str(row[1]) for row in table_info]
    primary_key = [
        str(row[1])
        for row in sorted(table_info, key=lambda row: int(row[5]) or 10_000)
        if int(row[5]) > 0
    ]
    order_by = primary_key or columns
    selected = ", ".join(quote_identifier(column) for column in columns)
    ordered = ", ".join(quote_identifier(column) for column in order_by)
    cursor = connection.execute(
        f"SELECT {selected} FROM {quote_identifier(table)} ORDER BY {ordered}",
    )
    digest = hashlib.sha256()
    count = 0
    for row in cursor:
        payload = [normalize_value(value) for value in tuple(row)]
        digest.update(
            json.dumps(payload, ensure_ascii=False, separators=(",", ":")).encode("utf-8"),
        )
        digest.update(b"\n")
        count += 1
    return {"rows": count, "sha256": digest.hexdigest()}


def formal_fingerprints(connection: sqlite3.Connection) -> dict[str, dict[str, Any]]:
    return {table: table_fingerprint(connection, table) for table in FORMAL_TABLES}


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def file_state(path: Path, include_hash: bool = True) -> dict[str, Any]:
    stat = path.stat()
    result: dict[str, Any] = {
        "path": str(path),
        "size": stat.st_size,
        "mtime_ns": stat.st_mtime_ns,
    }
    if include_hash:
        result["sha256"] = sha256_file(path)
    return result


def pragma_integrity(connection: sqlite3.Connection) -> str:
    return str(scalar(connection, "PRAGMA integrity_check"))


def foreign_key_violations(connection: sqlite3.Connection) -> int:
    return int(scalar(connection, "SELECT COUNT(*) FROM pragma_foreign_key_check"))


def placeholders(values: Iterable[Any]) -> str:
    values = tuple(values)
    return ",".join("?" for _ in values)


def collect_cleanup_jobs(connection: sqlite3.Connection) -> dict[str, Any]:
    approved_rows = connection.execute(
        """
        SELECT id, status, started_at
        FROM import_jobs
        WHERE status = 'approved' AND started_at <= ?
        ORDER BY started_at, id
        """,
        (APPROVED_CUTOFF,),
    ).fetchall()
    reviewing_rows = connection.execute(
        f"""
        SELECT id, status, started_at
        FROM import_jobs
        WHERE id IN ({placeholders(REVIEWING_JOB_IDS)})
        ORDER BY started_at, id
        """,
        REVIEWING_JOB_IDS,
    ).fetchall()
    approved_ids = [str(row["id"]) for row in approved_rows]
    reviewing_by_id = {str(row["id"]): row for row in reviewing_rows}
    if len(approved_ids) != 27:
        raise RuntimeError(f"approved job count changed: expected 27, found {len(approved_ids)}")
    if set(reviewing_by_id) != set(REVIEWING_JOB_IDS):
        raise RuntimeError("reviewing job allowlist no longer exists exactly")
    wrong_status = [
        job_id
        for job_id, row in reviewing_by_id.items()
        if str(row["status"]) != "reviewing"
    ]
    if wrong_status:
        raise RuntimeError(f"reviewing job status changed: {wrong_status}")

    status_counts = {
        str(row["status"]): int(row["count"])
        for row in connection.execute(
            "SELECT status, COUNT(*) AS count FROM import_jobs GROUP BY status",
        )
    }
    if status_counts != {"approved": 27, "reviewing": 2}:
        raise RuntimeError(f"import job status baseline changed: {status_counts}")

    job_ids = approved_ids + list(REVIEWING_JOB_IDS)
    marker = placeholders(job_ids)
    payload_counts = {
        table: int(
            scalar(
                connection,
                f"SELECT COUNT(*) FROM {quote_identifier(table)} WHERE import_job_id IN ({marker})",
                job_ids,
            ),
        )
        for table in EXPECTED_DELETE
    }
    if payload_counts != EXPECTED_DELETE:
        raise RuntimeError(
            f"cleanup payload changed: expected {EXPECTED_DELETE}, found {payload_counts}",
        )
    return {
        "approved_ids": approved_ids,
        "reviewing_ids": list(REVIEWING_JOB_IDS),
        "all_ids": job_ids,
        "status_counts": status_counts,
        "payload_counts": payload_counts,
    }


def validate_baseline(connection: sqlite3.Connection) -> dict[str, Any]:
    integrity = pragma_integrity(connection)
    if integrity != "ok":
        raise RuntimeError(f"integrity_check failed: {integrity}")
    counts = table_counts(connection, EXPECTED_BEFORE)
    if counts != EXPECTED_BEFORE:
        raise RuntimeError(f"database baseline changed: expected {EXPECTED_BEFORE}, found {counts}")
    violations = foreign_key_violations(connection)
    if violations != 5:
        raise RuntimeError(f"foreign key baseline changed: expected 5, found {violations}")
    jobs = collect_cleanup_jobs(connection)
    return {
        "integrity_check": integrity,
        "foreign_key_violations": violations,
        "table_counts": counts,
        "jobs": jobs,
    }


def validate_backup(
    backup_path: Path,
    current_counts: dict[str, int],
    current_fingerprints: dict[str, dict[str, Any]],
) -> dict[str, Any]:
    if not backup_path.is_file():
        raise RuntimeError(f"backup not found: {backup_path}")
    with connect_read_only(backup_path) as backup:
        integrity = pragma_integrity(backup)
        if integrity != "ok":
            raise RuntimeError(f"backup integrity_check failed: {integrity}")
        counts = table_counts(backup, BACKUP_COUNT_TABLES)
        if counts != current_counts:
            raise RuntimeError(f"backup table counts do not match current database: {counts}")
        fingerprints = formal_fingerprints(backup)
        if fingerprints != current_fingerprints:
            raise RuntimeError("backup formal-table fingerprints do not match current database")
    return {
        "integrity_check": integrity,
        "table_counts": counts,
        "formal_fingerprints": fingerprints,
        "file": file_state(backup_path),
    }


def delete_for_jobs(
    connection: sqlite3.Connection,
    table: str,
    job_ids: list[str],
) -> int:
    marker = placeholders(job_ids)
    cursor = connection.execute(
        f"DELETE FROM {quote_identifier(table)} WHERE import_job_id IN ({marker})",
        job_ids,
    )
    return int(cursor.rowcount)


def apply_cleanup(
    connection: sqlite3.Connection,
    before_fingerprints: dict[str, dict[str, Any]],
) -> dict[str, Any]:
    connection.execute("BEGIN IMMEDIATE")
    try:
        baseline = validate_baseline(connection)
        jobs = baseline["jobs"]
        marker = placeholders(REVIEWING_JOB_IDS)
        updated = connection.execute(
            f"""
            UPDATE import_jobs
            SET status = 'rejected', finished_at = COALESCE(finished_at, datetime('now'))
            WHERE id IN ({marker}) AND status = 'reviewing'
            """,
            REVIEWING_JOB_IDS,
        ).rowcount
        if int(updated) != 2:
            raise RuntimeError(f"reviewing job update count changed: expected 2, found {updated}")

        deleted = {
            table: delete_for_jobs(connection, table, jobs["all_ids"])
            for table in ("review_decisions", "staging_relations", "staging_items")
        }
        if deleted != EXPECTED_DELETE:
            raise RuntimeError(f"deleted row counts changed: expected {EXPECTED_DELETE}, found {deleted}")

        after_counts = table_counts(connection, EXPECTED_BEFORE)
        expected_after = {
            **EXPECTED_BEFORE,
            "staging_items": 0,
            "staging_relations": 0,
            "review_decisions": 0,
        }
        if after_counts != expected_after:
            raise RuntimeError(f"post-cleanup counts invalid: {after_counts}")

        status_counts = {
            str(row["status"]): int(row["count"])
            for row in connection.execute(
                "SELECT status, COUNT(*) AS count FROM import_jobs GROUP BY status",
            )
        }
        if status_counts != {"approved": 27, "rejected": 2}:
            raise RuntimeError(f"post-cleanup job statuses invalid: {status_counts}")

        after_fingerprints = formal_fingerprints(connection)
        if after_fingerprints != before_fingerprints:
            raise RuntimeError("formal-table fingerprints changed inside cleanup transaction")
        violations = foreign_key_violations(connection)
        if violations != 0:
            raise RuntimeError(f"foreign_key_check still reports {violations} violation(s)")
        integrity = pragma_integrity(connection)
        if integrity != "ok":
            raise RuntimeError(f"post-cleanup integrity_check failed: {integrity}")
        connection.commit()
    except Exception:
        connection.rollback()
        raise
    return {
        "updated_reviewing_jobs": int(updated),
        "deleted": deleted,
        "table_counts": after_counts,
        "job_status_counts": status_counts,
        "foreign_key_violations": violations,
        "integrity_check": integrity,
        "formal_fingerprints": after_fingerprints,
    }


def write_report(path: Path, report: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def main() -> int:
    args = parse_args()
    db_path = resolve_path(args.db)
    user_db_path = resolve_path(args.user_db)
    backup_path = resolve_path(args.backup) if args.backup else None
    report_path = resolve_path(args.report) if args.report else None

    if args.vacuum and not args.apply:
        raise SystemExit("--vacuum requires --apply")
    if args.apply and db_path == DEFAULT_DB.resolve() and not args.allow_project_db_write:
        raise SystemExit("--allow-project-db-write is required for the real project database")
    if args.apply and backup_path is None:
        raise SystemExit("--backup is required with --apply")
    if not db_path.is_file():
        raise SystemExit(f"database not found: {db_path}")
    if not user_db_path.is_file():
        raise SystemExit(f"user database not found: {user_db_path}")

    user_before = file_state(user_db_path)
    database_before = file_state(db_path, include_hash=False)
    with connect_read_only(db_path) as connection:
        baseline = validate_baseline(connection)
        before_fingerprints = formal_fingerprints(connection)
        backup_counts = table_counts(connection, BACKUP_COUNT_TABLES)

    backup_report = None
    if backup_path is not None:
        backup_report = validate_backup(backup_path, backup_counts, before_fingerprints)

    report: dict[str, Any] = {
        "status": "dry_run_ready" if not args.apply else "applying",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "mode": "apply" if args.apply else "dry-run",
        "database": database_before,
        "user_database_before": user_before,
        "baseline": baseline,
        "formal_fingerprints_before": before_fingerprints,
        "backup": backup_report,
        "vacuum_requested": bool(args.vacuum),
    }

    if args.apply:
        size_before = db_path.stat().st_size
        with connect_read_write(db_path) as connection:
            cleanup = apply_cleanup(connection, before_fingerprints)
            if args.vacuum:
                connection.execute("VACUUM")
                connection.execute("ANALYZE")
                connection.execute("PRAGMA optimize")
                connection.commit()
        with connect_read_only(db_path) as connection:
            final_integrity = pragma_integrity(connection)
            final_violations = foreign_key_violations(connection)
            final_counts = table_counts(connection, EXPECTED_BEFORE)
            final_fingerprints = formal_fingerprints(connection)
        user_after = file_state(user_db_path)
        if user_after != user_before:
            raise RuntimeError("user database changed during cleanup")
        if final_integrity != "ok" or final_violations != 0:
            raise RuntimeError(
                f"final database validation failed: integrity={final_integrity}, "
                f"foreign_keys={final_violations}",
            )
        if final_fingerprints != before_fingerprints:
            raise RuntimeError("formal-table fingerprints changed after cleanup maintenance")
        report.update(
            {
                "status": "complete",
                "cleanup": cleanup,
                "final": {
                    "integrity_check": final_integrity,
                    "foreign_key_violations": final_violations,
                    "table_counts": final_counts,
                    "formal_fingerprints": final_fingerprints,
                    "database_size_before": size_before,
                    "database_size_after": db_path.stat().st_size,
                    "database_bytes_reclaimed": size_before - db_path.stat().st_size,
                    "user_database_after": user_after,
                },
            },
        )

    if report_path is not None:
        write_report(report_path, report)
        report["report_path"] = str(report_path)
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (RuntimeError, sqlite3.Error) as exc:
        print(f"cleanup failed: {exc}", file=sys.stderr)
        raise SystemExit(1)
