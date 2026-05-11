from __future__ import annotations

import sqlite3
from typing import Any


def table_counts(conn: sqlite3.Connection) -> dict[str, int]:
    tables = [
        "source_files",
        "import_jobs",
        "knowledge_items",
        "knowledge_relations",
        "source_references",
        "staging_items",
        "staging_relations",
        "review_decisions",
        "change_logs",
    ]
    return {
        table: conn.execute(f"SELECT COUNT(*) AS count FROM {table}").fetchone()["count"]
        for table in tables
    }


def item_counts_by_type(conn: sqlite3.Connection) -> dict[str, int]:
    rows = conn.execute(
        """
        SELECT type, COUNT(*) AS count
        FROM knowledge_items
        GROUP BY type
        ORDER BY type
        """
    ).fetchall()
    return {row["type"]: row["count"] for row in rows}


def relation_counts_by_type(conn: sqlite3.Connection) -> dict[str, int]:
    rows = conn.execute(
        """
        SELECT relation_type, COUNT(*) AS count
        FROM knowledge_relations
        GROUP BY relation_type
        ORDER BY relation_type
        """
    ).fetchall()
    return {row["relation_type"]: row["count"] for row in rows}


def list_items(conn: sqlite3.Connection, item_type: str | None = None, limit: int = 20) -> list[dict[str, Any]]:
    if item_type:
        rows = conn.execute(
            """
            SELECT id, type, code, title, category, status
            FROM knowledge_items
            WHERE type = ?
            ORDER BY code, title
            LIMIT ?
            """,
            (item_type, limit),
        ).fetchall()
    else:
        rows = conn.execute(
            """
            SELECT id, type, code, title, category, status
            FROM knowledge_items
            ORDER BY type, code, title
            LIMIT ?
            """,
            (limit,),
        ).fetchall()
    return [dict(row) for row in rows]


def latest_import_jobs(conn: sqlite3.Connection, limit: int = 10) -> list[dict[str, Any]]:
    rows = conn.execute(
        """
        SELECT import_jobs.id, import_jobs.status, import_jobs.job_type,
               source_files.file_name, import_jobs.started_at, import_jobs.finished_at
        FROM import_jobs
        JOIN source_files ON source_files.id = import_jobs.source_file_id
        ORDER BY import_jobs.started_at DESC
        LIMIT ?
        """,
        (limit,),
    ).fetchall()
    return [dict(row) for row in rows]

