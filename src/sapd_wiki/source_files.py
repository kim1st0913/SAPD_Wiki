from __future__ import annotations

import hashlib
import sqlite3
import uuid
from dataclasses import dataclass
from pathlib import Path

from .paths import display_path, resolve_project_path


@dataclass(frozen=True)
class SourceFileRecord:
    id: str
    file_name: str
    file_type: str
    file_path: str
    file_hash: str
    file_size: int
    created: bool


def sha256_file(path: str | Path) -> str:
    resolved = resolve_project_path(path)
    digest = hashlib.sha256()
    with resolved.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def normalized_file_type(path: str | Path) -> str:
    suffix = resolve_project_path(path).suffix.lower().lstrip(".")
    return suffix or "unknown"


def register_source_file(
    conn: sqlite3.Connection,
    path: str | Path,
    *,
    usage_policy: str = "import_source",
    sensitive_level: str = "unknown",
) -> SourceFileRecord:
    resolved = resolve_project_path(path)
    if not resolved.exists():
        raise FileNotFoundError(f"Source file not found: {resolved}")
    if not resolved.is_file():
        raise ValueError(f"Source path is not a file: {resolved}")

    file_hash = sha256_file(resolved)
    file_name = resolved.name
    file_type = normalized_file_type(resolved)
    file_size = resolved.stat().st_size
    stored_path = display_path(resolved)

    existing = conn.execute(
        "SELECT * FROM source_files WHERE file_hash = ?",
        (file_hash,),
    ).fetchone()
    if existing:
        conn.execute(
            """
            UPDATE source_files
            SET usage_policy = ?, sensitive_level = ?, status = 'active',
                updated_at = datetime('now')
            WHERE id = ?
            """,
            (
                usage_policy,
                sensitive_level,
                existing["id"],
            ),
        )
        return SourceFileRecord(
            id=existing["id"],
            file_name=existing["file_name"],
            file_type=existing["file_type"],
            file_path=existing["file_path"],
            file_hash=existing["file_hash"],
            file_size=existing["file_size"],
            created=False,
        )

    source_file_id = str(uuid.uuid4())
    conn.execute(
        """
        INSERT INTO source_files (
          id, file_name, file_type, file_path, file_hash, file_size,
          usage_policy, sensitive_level, status
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active')
        """,
        (
            source_file_id,
            file_name,
            file_type,
            stored_path,
            file_hash,
            file_size,
            usage_policy,
            sensitive_level,
        ),
    )
    return SourceFileRecord(
        id=source_file_id,
        file_name=file_name,
        file_type=file_type,
        file_path=stored_path,
        file_hash=file_hash,
        file_size=file_size,
        created=True,
    )


def create_import_job(
    conn: sqlite3.Connection,
    source_file_id: str,
    *,
    job_type: str = "initial_import",
    status: str = "pending",
) -> str:
    import_job_id = str(uuid.uuid4())
    conn.execute(
        """
        INSERT INTO import_jobs (id, source_file_id, job_type, status)
        VALUES (?, ?, ?, ?)
        """,
        (import_job_id, source_file_id, job_type, status),
    )
    return import_job_id


def update_import_job_summary(
    conn: sqlite3.Connection,
    import_job_id: str,
    *,
    status: str,
    summary_json: str | None = None,
    error_json: str | None = None,
) -> None:
    conn.execute(
        """
        UPDATE import_jobs
        SET status = ?, summary_json = ?, error_json = ?,
            finished_at = CASE
              WHEN ? IN ('approved', 'rejected', 'failed', 'parsed') THEN datetime('now')
              ELSE finished_at
            END
        WHERE id = ?
        """,
        (status, summary_json, error_json, status, import_job_id),
    )
