from __future__ import annotations

import re
import sqlite3
from contextlib import closing
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
    conn: sqlite3.Connection | None = None
    try:
        conn = sqlite3.connect(resolved, timeout=30.0)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA busy_timeout = 30000")
        conn.execute("PRAGMA foreign_keys = ON")
        return conn
    except Exception:
        if conn is not None:
            conn.close()
        raise


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


def _execute_migration_sql(conn: sqlite3.Connection, sql: str) -> None:
    """Execute a SQL script without letting it escape the caller's transaction."""
    buffer: list[str] = []

    def execute_statement(statement: str) -> None:
        marker = "-- sapd:add-column-if-missing"
        if marker in statement:
            ddl = "\n".join(
                line for line in statement.splitlines() if marker not in line
            ).strip()
            match = re.fullmatch(
                r"ALTER\s+TABLE\s+([A-Za-z_][A-Za-z0-9_]*)\s+"
                r"ADD\s+COLUMN\s+([A-Za-z_][A-Za-z0-9_]*)\s+(.+?)\s*;?",
                ddl,
                flags=re.IGNORECASE | re.DOTALL,
            )
            if match is None:
                raise sqlite3.OperationalError(
                    "Invalid sapd:add-column-if-missing migration statement"
                )
            table, column = match.group(1), match.group(2)
            existing = {
                str(row["name"])
                for row in conn.execute(f'PRAGMA table_info("{table}")')
            }
            if column in existing:
                return
            statement = ddl
        conn.execute(statement)

    def deny_transaction_control(
        action: int,
        _argument_one: str | None,
        _argument_two: str | None,
        _database: str | None,
        _trigger: str | None,
    ) -> int:
        if action in {sqlite3.SQLITE_TRANSACTION, sqlite3.SQLITE_SAVEPOINT}:
            return sqlite3.SQLITE_DENY
        return sqlite3.SQLITE_OK

    conn.set_authorizer(deny_transaction_control)
    try:
        for character in sql:
            buffer.append(character)
            if character != ";":
                continue
            statement = "".join(buffer)
            if not sqlite3.complete_statement(statement):
                continue
            execute_statement(statement)
            buffer.clear()
        trailing = "".join(buffer).strip()
        if trailing:
            execute_statement(trailing)
    finally:
        conn.set_authorizer(None)


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
    with closing(connect(db_path)) as conn:
        ensure_schema_migrations(conn)
        conn.commit()
        for migration in migration_files:
            sql = migration.read_text(encoding="utf-8")
            try:
                conn.execute("BEGIN IMMEDIATE")
                already_applied = conn.execute(
                    "SELECT 1 FROM schema_migrations WHERE filename = ?",
                    (migration.name,),
                ).fetchone()
                if already_applied:
                    conn.rollback()
                    results.append(MigrationResult(path=migration, applied=False))
                    continue
                _execute_migration_sql(conn, sql)
                conn.execute(
                    "INSERT INTO schema_migrations(filename) VALUES (?)",
                    (migration.name,),
                )
                conn.commit()
            except Exception:
                conn.rollback()
                raise
            results.append(MigrationResult(path=migration, applied=True))
    return results
