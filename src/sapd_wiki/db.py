from __future__ import annotations

import sqlite3
from dataclasses import dataclass
from pathlib import Path

from .paths import DEFAULT_DB_PATH, MIGRATIONS_DIR, resolve_project_path


@dataclass(frozen=True)
class MigrationResult:
    path: Path
    applied: bool


def connect(db_path: str | Path = DEFAULT_DB_PATH) -> sqlite3.Connection:
    resolved = resolve_project_path(db_path)
    resolved.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(resolved)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def ensure_schema_migrations(conn: sqlite3.Connection) -> None:
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS schema_migrations (
          filename TEXT PRIMARY KEY,
          applied_at TEXT NOT NULL DEFAULT (datetime('now'))
        )
        """
    )


def applied_migrations(conn: sqlite3.Connection) -> set[str]:
    ensure_schema_migrations(conn)
    rows = conn.execute("SELECT filename FROM schema_migrations").fetchall()
    return {row["filename"] for row in rows}


def run_migrations(
    db_path: str | Path = DEFAULT_DB_PATH,
    migrations_dir: str | Path = MIGRATIONS_DIR,
) -> list[MigrationResult]:
    migrations_path = resolve_project_path(migrations_dir)
    if not migrations_path.exists():
        raise FileNotFoundError(f"Migrations directory not found: {migrations_path}")

    migration_files = sorted(migrations_path.glob("*.sql"))
    if not migration_files:
        raise FileNotFoundError(f"No migration files found in: {migrations_path}")

    results: list[MigrationResult] = []
    with connect(db_path) as conn:
        ensure_schema_migrations(conn)
        already_applied = applied_migrations(conn)
        for migration in migration_files:
            if migration.name in already_applied:
                results.append(MigrationResult(path=migration, applied=False))
                continue
            sql = migration.read_text(encoding="utf-8")
            conn.executescript(sql)
            conn.execute(
                "INSERT INTO schema_migrations(filename) VALUES (?)",
                (migration.name,),
            )
            results.append(MigrationResult(path=migration, applied=True))
    return results

