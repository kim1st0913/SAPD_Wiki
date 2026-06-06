#!/usr/bin/env python3
"""Run the SAPD Wiki ZIP alpha local backend.

This script is the source entrypoint for the future platform-native
SAPD-Wiki-Backend executable. It serves static frontend assets and a minimal
local API from a ZIP bundle root. It does not run ETL and does not write to the
read-only base database.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import mimetypes
import os
import signal
import secrets
import sqlite3
import sys
import threading
import time
import uuid
import webbrowser
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any
from urllib.parse import parse_qs, unquote, urlparse

from check_bundle_runtime import check_bundle, is_loopback_host, load_json, safe_bundle_child, sha256_file
from export_diagnostics import export_diagnostics


API_PREFIX = "/api/v1/"
AUTH_HEADER = "X-SAPD-Session-Token"
BASE_ITEM_TABLE_CANDIDATES = [
    "knowledge_items",
    "knowledge_item",
    "capabilities",
    "items",
]

USER_NOTE_COLUMNS = {
    "status": "TEXT NOT NULL DEFAULT 'todo'",
    "page_route": "TEXT",
    "page_title": "TEXT",
    "anchor_type": "TEXT NOT NULL DEFAULT 'object'",
    "object_type": "TEXT",
    "object_title": "TEXT",
    "tags_json": "TEXT",
}

USER_NOTE_SELECT_COLUMNS = """
id, target_ref, body, status, page_route, page_title, anchor_type, object_type, object_title, tags_json, created_at, updated_at
"""

USER_NOTE_STATUSES = {"todo", "reviewing", "waiting_confirm", "confirmed", "closed", "deferred"}
USER_DATA_BASKET_STATUSES = {"active", "draft", "archived"}
USER_WORKSPACE_STATUSES = {"active", "draft", "archived"}
USER_WORKSPACE_ITEM_STATUSES = {"active", "pinned", "reviewing", "closed", "archived"}

USER_WORKSPACE_TABLES = [
    """
    CREATE TABLE IF NOT EXISTS user_workspaces (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        status TEXT NOT NULL DEFAULT 'active',
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS user_workspace_items (
        id TEXT PRIMARY KEY,
        workspace_id TEXT NOT NULL,
        target_ref TEXT NOT NULL,
        item_status TEXT NOT NULL DEFAULT 'active',
        sort_order INTEGER,
        payload_json TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(workspace_id, target_ref),
        FOREIGN KEY(workspace_id) REFERENCES user_workspaces(id) ON DELETE CASCADE
    )
    """,
]

USER_DATA_BASKET_TABLES = [
    """
    CREATE TABLE IF NOT EXISTS user_data_baskets (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        status TEXT NOT NULL DEFAULT 'active',
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS user_data_basket_items (
        id TEXT PRIMARY KEY,
        basket_id TEXT NOT NULL,
        target_ref TEXT NOT NULL,
        object_type TEXT,
        object_title TEXT,
        payload_json TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(basket_id, target_ref),
        FOREIGN KEY(basket_id) REFERENCES user_data_baskets(id) ON DELETE CASCADE
    )
    """,
]

USER_DATA_BASKET_SELECT_COLUMNS = """
id, name, description, status, created_at, updated_at
"""

USER_DATA_BASKET_ITEM_SELECT_COLUMNS = """
id, basket_id, target_ref, object_type, object_title, payload_json, created_at, updated_at
"""

USER_WORKSPACE_SELECT_COLUMNS = """
id, name, description, status, created_at, updated_at
"""

USER_WORKSPACE_ITEM_SELECT_COLUMNS = """
id, workspace_id, target_ref, item_status, sort_order, payload_json, created_at, updated_at
"""


def json_dumps(data: Any) -> bytes:
    return json.dumps(data, ensure_ascii=False, indent=2).encode("utf-8")


def quote_identifier(identifier: str) -> str:
    return '"' + identifier.replace('"', '""') + '"'


def now_iso() -> str:
    return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())


def hash_text(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def is_json_content_type(value: str) -> bool:
    return value.split(";", 1)[0].strip().lower() == "application/json"


def is_allowed_loopback_origin(value: str, port: int) -> bool:
    if not value:
        return True
    parsed = urlparse(value)
    try:
        parsed_port = parsed.port or (443 if parsed.scheme == "https" else 80)
    except ValueError:
        return False
    return parsed.scheme == "http" and parsed_port == port and is_loopback_host(parsed.hostname or "")


def is_allowed_host_header(value: str, port: int) -> bool:
    raw_value = str(value or "").strip()
    if not raw_value:
        return False
    parsed = urlparse(f"//{raw_value}")
    try:
        parsed_port = parsed.port or 80
    except ValueError:
        return False
    return parsed_port == port and is_loopback_host(parsed.hostname or "")


class RuntimeLogger:
    def __init__(self, log_path: Path) -> None:
        self.log_path = log_path
        self.log_path.parent.mkdir(parents=True, exist_ok=True)

    def write(self, level: str, message: str, **context: Any) -> None:
        entry = {"time": now_iso(), "level": level, "message": message, **context}
        with self.log_path.open("a", encoding="utf-8") as handle:
            handle.write(json.dumps(entry, ensure_ascii=False) + "\n")


class BundleRuntime:
    def __init__(self, bundle_root: Path, logger: RuntimeLogger) -> None:
        self.root = bundle_root.resolve()
        self.logger = logger
        self.manifest_path = self.root / "data" / "base" / "base-manifest.json"
        self.config_path = self.root / "config" / "app-config.json"
        self.frontend_dir = self.root / "app" / "frontend-dist"
        self.manifest = load_json(self.manifest_path)
        self.config = load_json(self.config_path)
        base_file = self.manifest["base_database"].get("file", "sapd_wiki_base.sqlite3")
        user_file = self.manifest["user_database"].get("file", "sapd_wiki_user.sqlite3")
        self.base_db = safe_bundle_child(self.root / "data" / "base", base_file, "sapd_wiki_base.sqlite3")
        self.user_db = safe_bundle_child(self.root / "data" / "user", user_file, "sapd_wiki_user.sqlite3")
        self.ensure_user_note_columns()
        self.ensure_user_workspace_tables()
        self.ensure_user_data_basket_tables()

    def ensure_user_note_columns(self) -> None:
        user_uri = self.user_db.resolve().as_uri() + "?mode=rwc"
        with sqlite3.connect(user_uri, uri=True) as connection:
            rows = connection.execute("PRAGMA table_info(user_notes)").fetchall()
            existing = {row[1] for row in rows}
            for column, definition in USER_NOTE_COLUMNS.items():
                if column not in existing:
                    connection.execute(f"ALTER TABLE user_notes ADD COLUMN {column} {definition}")

    def ensure_user_data_basket_tables(self) -> None:
        user_uri = self.user_db.resolve().as_uri() + "?mode=rwc"
        with sqlite3.connect(user_uri, uri=True) as connection:
            connection.execute("PRAGMA foreign_keys = ON")
            for statement in USER_DATA_BASKET_TABLES:
                connection.execute(statement)

    def ensure_user_workspace_tables(self) -> None:
        user_uri = self.user_db.resolve().as_uri() + "?mode=rwc"
        with sqlite3.connect(user_uri, uri=True) as connection:
            connection.execute("PRAGMA foreign_keys = ON")
            for statement in USER_WORKSPACE_TABLES:
                connection.execute(statement)

    def open_connection(self) -> sqlite3.Connection:
        user_uri = self.user_db.resolve().as_uri() + "?mode=rwc"
        base_uri = self.base_db.resolve().as_uri() + "?mode=ro&immutable=1"
        connection = sqlite3.connect(user_uri, uri=True)
        connection.row_factory = sqlite3.Row
        connection.execute("PRAGMA foreign_keys = ON")
        connection.execute("ATTACH DATABASE ? AS base", (base_uri,))
        return connection

    def base_tables(self) -> list[str]:
        with self.open_connection() as connection:
            rows = connection.execute(
                """
                SELECT name
                FROM base.sqlite_schema
                WHERE type = 'table' AND name NOT LIKE 'sqlite_%'
                ORDER BY name
                """
            ).fetchall()
            return [row["name"] for row in rows]

    def base_summary(self) -> dict[str, Any]:
        tables = self.base_tables()
        table_counts: dict[str, int] = {}
        with self.open_connection() as connection:
            for table in tables[:50]:
                try:
                    row = connection.execute(f"SELECT COUNT(*) AS count FROM base.{quote_identifier(table)}").fetchone()
                    table_counts[table] = int(row["count"]) if row else 0
                except sqlite3.Error:
                    table_counts[table] = -1
        return {
            "ok": True,
            "base_database": {
                "file": str(self.base_db.relative_to(self.root)),
                "sha256": sha256_file(self.base_db),
                "schema_version": self.manifest["base_database"].get("schema_version"),
                "data_version": self.manifest["base_database"].get("data_version"),
            },
            "tables": table_counts,
        }

    def base_items(self, limit: int = 20) -> dict[str, Any]:
        tables = self.base_tables()
        table = next((candidate for candidate in BASE_ITEM_TABLE_CANDIDATES if candidate in tables), None)
        if table is None and tables:
            table = tables[0]
        if table is None:
            return {"ok": True, "table": None, "items": []}
        safe_table = quote_identifier(table)
        with self.open_connection() as connection:
            rows = connection.execute(f"SELECT * FROM base.{safe_table} LIMIT ?", (limit,)).fetchall()
            items = [dict(row) for row in rows]
        return {"ok": True, "table": table, "items": items}

    def list_favorites(self) -> dict[str, Any]:
        with self.open_connection() as connection:
            rows = connection.execute(
                """
                SELECT id, target_ref, note, created_at, updated_at
                FROM user_favorites
                ORDER BY updated_at DESC
                """
            ).fetchall()
            return {"ok": True, "favorites": [dict(row) for row in rows]}

    def add_favorite(self, payload: dict[str, Any]) -> dict[str, Any]:
        target_ref = str(payload.get("target_ref", "")).strip()
        note = payload.get("note")
        if not target_ref:
            raise ValueError("target_ref is required")
        favorite_id = str(uuid.uuid4())
        change_id = str(uuid.uuid4())
        change_payload = json.dumps({"target_ref": target_ref, "note": note}, ensure_ascii=False)
        with self.open_connection() as connection:
            connection.execute(
                """
                INSERT INTO user_favorites(id, target_ref, note, created_at, updated_at)
                VALUES (?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                ON CONFLICT(target_ref) DO UPDATE SET
                  note = excluded.note,
                  updated_at = CURRENT_TIMESTAMP
                """,
                (favorite_id, target_ref, note),
            )
            row = connection.execute(
                """
                SELECT id, target_ref, note, created_at, updated_at
                FROM user_favorites
                WHERE target_ref = ?
                """,
                (target_ref,),
            ).fetchone()
            connection.execute(
                """
                INSERT INTO user_change_logs(id, action, target_ref, payload_json)
                VALUES (?, 'upsert_favorite', ?, ?)
                """,
                (change_id, target_ref, change_payload),
            )
        self.logger.write("info", "user favorite upserted", target_ref_sha256=hash_text(target_ref)[:16])
        return {"ok": True, "favorite": dict(row) if row else None}

    def delete_favorite(self, target_ref: str) -> dict[str, Any]:
        normalized = str(target_ref or "").strip()
        if not normalized:
            raise ValueError("target_ref is required")
        with self.open_connection() as connection:
            cursor = connection.execute("DELETE FROM user_favorites WHERE target_ref = ?", (normalized,))
            deleted = cursor.rowcount
            connection.execute(
                """
                INSERT INTO user_change_logs(id, action, target_ref, payload_json)
                VALUES (?, 'delete_favorite', ?, ?)
                """,
                (
                    str(uuid.uuid4()),
                    normalized,
                    json.dumps({"target_ref": normalized, "deleted": deleted}, ensure_ascii=False),
                ),
            )
        self.logger.write("info", "user favorite deleted", target_ref_sha256=hash_text(normalized)[:16], deleted=deleted)
        return {"ok": True, "deleted": deleted}

    def normalize_note_status(self, value: Any) -> str:
        status = str(value or "todo").strip() or "todo"
        return status if status in USER_NOTE_STATUSES else "todo"

    def normalize_tags_json(self, value: Any) -> str | None:
        if value is None:
            return None
        if isinstance(value, str):
            stripped = value.strip()
            if not stripped:
                return None
            try:
                parsed = json.loads(stripped)
            except json.JSONDecodeError:
                parsed = [stripped]
        else:
            parsed = value
        if not isinstance(parsed, list):
            parsed = [parsed]
        tags = [str(item).strip() for item in parsed if str(item).strip()]
        return json.dumps(tags, ensure_ascii=False)

    def note_row_to_dict(self, row: sqlite3.Row | None) -> dict[str, Any] | None:
        if not row:
            return None
        item = dict(row)
        try:
            item["tags"] = json.loads(item.get("tags_json") or "[]")
        except json.JSONDecodeError:
            item["tags"] = []
        item.pop("tags_json", None)
        return item

    def list_notes(self, query: dict[str, list[str]]) -> dict[str, Any]:
        filters: list[str] = []
        params: list[str] = []
        target_ref = str((query.get("target_ref") or [""])[0] or "").strip()
        page_route = str((query.get("page_route") or [""])[0] or "").strip()
        if target_ref:
            filters.append("target_ref = ?")
            params.append(target_ref)
        if page_route:
            filters.append("page_route = ?")
            params.append(page_route)
        where = f"WHERE {' AND '.join(filters)}" if filters else ""
        with self.open_connection() as connection:
            rows = connection.execute(
                f"""
                SELECT {USER_NOTE_SELECT_COLUMNS}
                FROM user_notes
                {where}
                ORDER BY updated_at DESC
                """,
                params,
            ).fetchall()
        return {"ok": True, "data_state": "ready", "notes": [self.note_row_to_dict(row) for row in rows]}

    def add_note(self, payload: dict[str, Any]) -> dict[str, Any]:
        target_ref = str(payload.get("target_ref", "")).strip()
        body = str(payload.get("body") or "").strip()
        if not target_ref:
            raise ValueError("target_ref is required")
        if not body:
            raise ValueError("body is required")
        note_id = str(uuid.uuid4())
        status = self.normalize_note_status(payload.get("status"))
        page_route = str(payload.get("page_route") or "").strip() or None
        page_title = str(payload.get("page_title") or "").strip() or None
        anchor_type = str(payload.get("anchor_type") or "object").strip() or "object"
        object_type = str(payload.get("object_type") or "").strip() or None
        object_title = str(payload.get("object_title") or "").strip() or None
        tags_json = self.normalize_tags_json(payload.get("tags"))
        with self.open_connection() as connection:
            connection.execute(
                """
                INSERT INTO user_notes(id, target_ref, body, status, page_route, page_title, anchor_type, object_type, object_title, tags_json, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                """,
                (note_id, target_ref, body, status, page_route, page_title, anchor_type, object_type, object_title, tags_json),
            )
            row = connection.execute(
                f"""
                SELECT {USER_NOTE_SELECT_COLUMNS}
                FROM user_notes
                WHERE id = ?
                """,
                (note_id,),
            ).fetchone()
            connection.execute(
                """
                INSERT INTO user_change_logs(id, action, target_ref, payload_json)
                VALUES (?, 'create_note', ?, ?)
                """,
                (
                    str(uuid.uuid4()),
                    target_ref,
                    json.dumps({"target_ref": target_ref, "status": status, "page_route": page_route, "anchor_type": anchor_type}, ensure_ascii=False),
                ),
            )
        self.logger.write("info", "user note created", target_ref_sha256=hash_text(target_ref)[:16], status=status)
        return {"ok": True, "note": self.note_row_to_dict(row)}

    def update_note(self, note_id: str, payload: dict[str, Any]) -> dict[str, Any]:
        normalized_id = str(note_id or "").strip()
        if not normalized_id:
            raise ValueError("id is required")
        allowed_fields: dict[str, Any] = {}
        if "body" in payload:
            body = str(payload.get("body") or "").strip()
            if not body:
                raise ValueError("body is required")
            allowed_fields["body"] = body
        if "status" in payload:
            allowed_fields["status"] = self.normalize_note_status(payload.get("status"))
        if "tags" in payload:
            allowed_fields["tags_json"] = self.normalize_tags_json(payload.get("tags"))
        if not allowed_fields:
            raise ValueError("no supported fields to update")
        assignments = ", ".join(f"{field} = ?" for field in allowed_fields)
        values = list(allowed_fields.values())
        with self.open_connection() as connection:
            row_before = connection.execute("SELECT target_ref FROM user_notes WHERE id = ?", (normalized_id,)).fetchone()
            if not row_before:
                return {"ok": False, "error": "not_found", "note": None}
            connection.execute(
                f"""
                UPDATE user_notes
                SET {assignments}, updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
                """,
                [*values, normalized_id],
            )
            row = connection.execute(
                f"""
                SELECT {USER_NOTE_SELECT_COLUMNS}
                FROM user_notes
                WHERE id = ?
                """,
                (normalized_id,),
            ).fetchone()
            connection.execute(
                """
                INSERT INTO user_change_logs(id, action, target_ref, payload_json)
                VALUES (?, 'update_note', ?, ?)
                """,
                (str(uuid.uuid4()), row_before["target_ref"], json.dumps({"id": normalized_id, **allowed_fields}, ensure_ascii=False)),
            )
        self.logger.write("info", "user note updated", note_id=normalized_id, status=allowed_fields.get("status"))
        return {"ok": True, "note": self.note_row_to_dict(row)}

    def delete_note(self, note_id: str) -> dict[str, Any]:
        normalized_id = str(note_id or "").strip()
        if not normalized_id:
            raise ValueError("id is required")
        with self.open_connection() as connection:
            row_before = connection.execute("SELECT target_ref FROM user_notes WHERE id = ?", (normalized_id,)).fetchone()
            cursor = connection.execute("DELETE FROM user_notes WHERE id = ?", (normalized_id,))
            deleted = cursor.rowcount
            connection.execute(
                """
                INSERT INTO user_change_logs(id, action, target_ref, payload_json)
                VALUES (?, 'delete_note', ?, ?)
                """,
                (
                    str(uuid.uuid4()),
                    row_before["target_ref"] if row_before else None,
                    json.dumps({"id": normalized_id, "deleted": deleted}, ensure_ascii=False),
                ),
            )
        self.logger.write("info", "user note deleted", note_id=normalized_id, deleted=deleted)
        return {"ok": True, "deleted": deleted}

    def normalize_workspace_status(self, value: Any) -> str:
        status = str(value or "active").strip() or "active"
        return status if status in USER_WORKSPACE_STATUSES else "active"

    def normalize_workspace_item_status(self, value: Any) -> str:
        status = str(value or "active").strip() or "active"
        return status if status in USER_WORKSPACE_ITEM_STATUSES else "active"

    def normalize_data_basket_status(self, value: Any) -> str:
        status = str(value or "active").strip() or "active"
        return status if status in USER_DATA_BASKET_STATUSES else "active"

    def normalize_payload_json(self, value: Any) -> str | None:
        if value is None:
            return None
        if isinstance(value, str):
            stripped = value.strip()
            if not stripped:
                return None
            try:
                parsed = json.loads(stripped)
            except json.JSONDecodeError:
                parsed = {"text": stripped}
        else:
            parsed = value
        return json.dumps(parsed, ensure_ascii=False)

    def workspace_item_row_to_dict(self, row: sqlite3.Row | None) -> dict[str, Any] | None:
        if not row:
            return None
        item = dict(row)
        try:
            item["payload"] = json.loads(item.get("payload_json") or "null")
        except json.JSONDecodeError:
            item["payload"] = None
        item.pop("payload_json", None)
        return item

    def list_workspaces(self) -> dict[str, Any]:
        with self.open_connection() as connection:
            rows = connection.execute(
                """
                SELECT w.id, w.name, w.description, w.status, w.created_at, w.updated_at,
                       COUNT(i.id) AS item_count
                FROM user_workspaces w
                LEFT JOIN user_workspace_items i ON i.workspace_id = w.id
                GROUP BY w.id
                ORDER BY w.updated_at DESC
                """
            ).fetchall()
        return {"ok": True, "data_state": "ready", "workspaces": [dict(row) for row in rows]}

    def create_workspace(self, payload: dict[str, Any]) -> dict[str, Any]:
        name = str(payload.get("name") or "").strip()
        if not name:
            raise ValueError("name is required")
        workspace_id = str(uuid.uuid4())
        description = str(payload.get("description") or "").strip() or None
        status = self.normalize_workspace_status(payload.get("status"))
        with self.open_connection() as connection:
            connection.execute(
                """
                INSERT INTO user_workspaces(id, name, description, status, created_at, updated_at)
                VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                """,
                (workspace_id, name, description, status),
            )
            row = connection.execute(
                f"""
                SELECT {USER_WORKSPACE_SELECT_COLUMNS}
                FROM user_workspaces
                WHERE id = ?
                """,
                (workspace_id,),
            ).fetchone()
            connection.execute(
                """
                INSERT INTO user_change_logs(id, action, target_ref, payload_json)
                VALUES (?, 'create_workspace', ?, ?)
                """,
                (
                    str(uuid.uuid4()),
                    f"user:workspace:{workspace_id}",
                    json.dumps({"id": workspace_id, "name": name, "status": status}, ensure_ascii=False),
                ),
            )
        self.logger.write("info", "user workspace created", workspace_id=workspace_id, status=status)
        return {"ok": True, "workspace": dict(row) if row else None}

    def delete_workspace(self, workspace_id: str) -> dict[str, Any]:
        normalized_id = str(workspace_id or "").strip()
        if not normalized_id:
            raise ValueError("workspace_id is required")
        with self.open_connection() as connection:
            cursor = connection.execute("DELETE FROM user_workspaces WHERE id = ?", (normalized_id,))
            deleted = cursor.rowcount
            connection.execute(
                """
                INSERT INTO user_change_logs(id, action, target_ref, payload_json)
                VALUES (?, 'delete_workspace', ?, ?)
                """,
                (
                    str(uuid.uuid4()),
                    f"user:workspace:{normalized_id}",
                    json.dumps({"id": normalized_id, "deleted": deleted}, ensure_ascii=False),
                ),
            )
        self.logger.write("info", "user workspace deleted", workspace_id=normalized_id, deleted=deleted)
        return {"ok": True, "deleted": deleted}

    def list_workspace_items(self, workspace_id: str) -> dict[str, Any]:
        normalized_id = str(workspace_id or "").strip()
        if not normalized_id:
            raise ValueError("workspace_id is required")
        with self.open_connection() as connection:
            rows = connection.execute(
                f"""
                SELECT {USER_WORKSPACE_ITEM_SELECT_COLUMNS}
                FROM user_workspace_items
                WHERE workspace_id = ?
                ORDER BY COALESCE(sort_order, 999999), updated_at DESC
                """,
                (normalized_id,),
            ).fetchall()
        return {"ok": True, "data_state": "ready", "items": [self.workspace_item_row_to_dict(row) for row in rows]}

    def add_workspace_item(self, workspace_id: str, payload: dict[str, Any]) -> dict[str, Any]:
        normalized_workspace_id = str(workspace_id or "").strip()
        target_ref = str(payload.get("target_ref") or "").strip()
        if not normalized_workspace_id:
            raise ValueError("workspace_id is required")
        if not target_ref:
            raise ValueError("target_ref is required")
        item_status = self.normalize_workspace_item_status(payload.get("item_status"))
        raw_sort_order = payload.get("sort_order")
        sort_order = int(raw_sort_order) if raw_sort_order not in (None, "") else None
        payload_json = self.normalize_payload_json(payload.get("payload"))
        item_id = str(uuid.uuid4())
        with self.open_connection() as connection:
            workspace = connection.execute("SELECT id FROM user_workspaces WHERE id = ?", (normalized_workspace_id,)).fetchone()
            if not workspace:
                return {"ok": False, "error": "workspace_not_found", "item": None}
            connection.execute(
                """
                INSERT INTO user_workspace_items(id, workspace_id, target_ref, item_status, sort_order, payload_json, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                ON CONFLICT(workspace_id, target_ref) DO UPDATE SET
                  item_status = excluded.item_status,
                  sort_order = excluded.sort_order,
                  payload_json = excluded.payload_json,
                  updated_at = CURRENT_TIMESTAMP
                """,
                (item_id, normalized_workspace_id, target_ref, item_status, sort_order, payload_json),
            )
            connection.execute(
                """
                UPDATE user_workspaces
                SET updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
                """,
                (normalized_workspace_id,),
            )
            row = connection.execute(
                f"""
                SELECT {USER_WORKSPACE_ITEM_SELECT_COLUMNS}
                FROM user_workspace_items
                WHERE workspace_id = ? AND target_ref = ?
                """,
                (normalized_workspace_id, target_ref),
            ).fetchone()
            connection.execute(
                """
                INSERT INTO user_change_logs(id, action, target_ref, payload_json)
                VALUES (?, 'upsert_workspace_item', ?, ?)
                """,
                (
                    str(uuid.uuid4()),
                    target_ref,
                    json.dumps({"workspace_id": normalized_workspace_id, "target_ref": target_ref, "item_status": item_status}, ensure_ascii=False),
                ),
            )
        self.logger.write("info", "user workspace item upserted", workspace_id=normalized_workspace_id, target_ref_sha256=hash_text(target_ref)[:16])
        return {"ok": True, "item": self.workspace_item_row_to_dict(row)}

    def delete_workspace_item(self, workspace_id: str, item_id: str) -> dict[str, Any]:
        normalized_workspace_id = str(workspace_id or "").strip()
        normalized_item_id = str(item_id or "").strip()
        if not normalized_workspace_id:
            raise ValueError("workspace_id is required")
        if not normalized_item_id:
            raise ValueError("item_id is required")
        with self.open_connection() as connection:
            row_before = connection.execute(
                """
                SELECT target_ref
                FROM user_workspace_items
                WHERE workspace_id = ? AND id = ?
                """,
                (normalized_workspace_id, normalized_item_id),
            ).fetchone()
            cursor = connection.execute(
                """
                DELETE FROM user_workspace_items
                WHERE workspace_id = ? AND id = ?
                """,
                (normalized_workspace_id, normalized_item_id),
            )
            deleted = cursor.rowcount
            connection.execute(
                """
                UPDATE user_workspaces
                SET updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
                """,
                (normalized_workspace_id,),
            )
            connection.execute(
                """
                INSERT INTO user_change_logs(id, action, target_ref, payload_json)
                VALUES (?, 'delete_workspace_item', ?, ?)
                """,
                (
                    str(uuid.uuid4()),
                    row_before["target_ref"] if row_before else None,
                    json.dumps({"workspace_id": normalized_workspace_id, "item_id": normalized_item_id, "deleted": deleted}, ensure_ascii=False),
                ),
            )
        self.logger.write("info", "user workspace item deleted", workspace_id=normalized_workspace_id, item_id=normalized_item_id, deleted=deleted)
        return {"ok": True, "deleted": deleted}

    def data_basket_item_row_to_dict(self, row: sqlite3.Row | None) -> dict[str, Any] | None:
        if not row:
            return None
        item = dict(row)
        try:
            item["payload"] = json.loads(item.get("payload_json") or "null")
        except json.JSONDecodeError:
            item["payload"] = None
        item.pop("payload_json", None)
        return item

    def list_data_baskets(self) -> dict[str, Any]:
        with self.open_connection() as connection:
            rows = connection.execute(
                f"""
                SELECT b.id, b.name, b.description, b.status, b.created_at, b.updated_at,
                       COUNT(i.id) AS item_count
                FROM user_data_baskets b
                LEFT JOIN user_data_basket_items i ON i.basket_id = b.id
                GROUP BY b.id
                ORDER BY b.updated_at DESC
                """
            ).fetchall()
        return {"ok": True, "data_state": "ready", "data_baskets": [dict(row) for row in rows]}

    def create_data_basket(self, payload: dict[str, Any]) -> dict[str, Any]:
        name = str(payload.get("name") or "").strip()
        if not name:
            raise ValueError("name is required")
        basket_id = str(uuid.uuid4())
        description = str(payload.get("description") or "").strip() or None
        status = self.normalize_data_basket_status(payload.get("status"))
        with self.open_connection() as connection:
            connection.execute(
                """
                INSERT INTO user_data_baskets(id, name, description, status, created_at, updated_at)
                VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                """,
                (basket_id, name, description, status),
            )
            row = connection.execute(
                f"""
                SELECT {USER_DATA_BASKET_SELECT_COLUMNS}
                FROM user_data_baskets
                WHERE id = ?
                """,
                (basket_id,),
            ).fetchone()
            connection.execute(
                """
                INSERT INTO user_change_logs(id, action, target_ref, payload_json)
                VALUES (?, 'create_data_basket', ?, ?)
                """,
                (
                    str(uuid.uuid4()),
                    f"user:data_basket:{basket_id}",
                    json.dumps({"id": basket_id, "name": name, "status": status}, ensure_ascii=False),
                ),
            )
        self.logger.write("info", "user data basket created", basket_id=basket_id, status=status)
        return {"ok": True, "data_basket": dict(row) if row else None}

    def delete_data_basket(self, basket_id: str) -> dict[str, Any]:
        normalized_id = str(basket_id or "").strip()
        if not normalized_id:
            raise ValueError("basket_id is required")
        with self.open_connection() as connection:
            cursor = connection.execute("DELETE FROM user_data_baskets WHERE id = ?", (normalized_id,))
            deleted = cursor.rowcount
            connection.execute(
                """
                INSERT INTO user_change_logs(id, action, target_ref, payload_json)
                VALUES (?, 'delete_data_basket', ?, ?)
                """,
                (
                    str(uuid.uuid4()),
                    f"user:data_basket:{normalized_id}",
                    json.dumps({"id": normalized_id, "deleted": deleted}, ensure_ascii=False),
                ),
            )
        self.logger.write("info", "user data basket deleted", basket_id=normalized_id, deleted=deleted)
        return {"ok": True, "deleted": deleted}

    def list_data_basket_items(self, basket_id: str) -> dict[str, Any]:
        normalized_id = str(basket_id or "").strip()
        if not normalized_id:
            raise ValueError("basket_id is required")
        with self.open_connection() as connection:
            rows = connection.execute(
                f"""
                SELECT {USER_DATA_BASKET_ITEM_SELECT_COLUMNS}
                FROM user_data_basket_items
                WHERE basket_id = ?
                ORDER BY updated_at DESC
                """,
                (normalized_id,),
            ).fetchall()
        return {"ok": True, "data_state": "ready", "items": [self.data_basket_item_row_to_dict(row) for row in rows]}

    def add_data_basket_item(self, basket_id: str, payload: dict[str, Any]) -> dict[str, Any]:
        normalized_basket_id = str(basket_id or "").strip()
        target_ref = str(payload.get("target_ref") or "").strip()
        if not normalized_basket_id:
            raise ValueError("basket_id is required")
        if not target_ref:
            raise ValueError("target_ref is required")
        object_type = str(payload.get("object_type") or "").strip() or None
        object_title = str(payload.get("object_title") or "").strip() or None
        payload_json = self.normalize_payload_json(payload.get("payload"))
        item_id = str(uuid.uuid4())
        with self.open_connection() as connection:
            basket = connection.execute("SELECT id FROM user_data_baskets WHERE id = ?", (normalized_basket_id,)).fetchone()
            if not basket:
                return {"ok": False, "error": "basket_not_found", "item": None}
            connection.execute(
                """
                INSERT INTO user_data_basket_items(id, basket_id, target_ref, object_type, object_title, payload_json, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                ON CONFLICT(basket_id, target_ref) DO UPDATE SET
                  object_type = excluded.object_type,
                  object_title = excluded.object_title,
                  payload_json = excluded.payload_json,
                  updated_at = CURRENT_TIMESTAMP
                """,
                (item_id, normalized_basket_id, target_ref, object_type, object_title, payload_json),
            )
            connection.execute(
                """
                UPDATE user_data_baskets
                SET updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
                """,
                (normalized_basket_id,),
            )
            row = connection.execute(
                f"""
                SELECT {USER_DATA_BASKET_ITEM_SELECT_COLUMNS}
                FROM user_data_basket_items
                WHERE basket_id = ? AND target_ref = ?
                """,
                (normalized_basket_id, target_ref),
            ).fetchone()
            connection.execute(
                """
                INSERT INTO user_change_logs(id, action, target_ref, payload_json)
                VALUES (?, 'upsert_data_basket_item', ?, ?)
                """,
                (
                    str(uuid.uuid4()),
                    target_ref,
                    json.dumps({"basket_id": normalized_basket_id, "target_ref": target_ref}, ensure_ascii=False),
                ),
            )
        self.logger.write("info", "user data basket item upserted", basket_id=normalized_basket_id, target_ref_sha256=hash_text(target_ref)[:16])
        return {"ok": True, "item": self.data_basket_item_row_to_dict(row)}

    def delete_data_basket_item(self, basket_id: str, item_id: str) -> dict[str, Any]:
        normalized_basket_id = str(basket_id or "").strip()
        normalized_item_id = str(item_id or "").strip()
        if not normalized_basket_id:
            raise ValueError("basket_id is required")
        if not normalized_item_id:
            raise ValueError("item_id is required")
        with self.open_connection() as connection:
            row_before = connection.execute(
                """
                SELECT target_ref
                FROM user_data_basket_items
                WHERE basket_id = ? AND id = ?
                """,
                (normalized_basket_id, normalized_item_id),
            ).fetchone()
            cursor = connection.execute(
                """
                DELETE FROM user_data_basket_items
                WHERE basket_id = ? AND id = ?
                """,
                (normalized_basket_id, normalized_item_id),
            )
            deleted = cursor.rowcount
            connection.execute(
                """
                UPDATE user_data_baskets
                SET updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
                """,
                (normalized_basket_id,),
            )
            connection.execute(
                """
                INSERT INTO user_change_logs(id, action, target_ref, payload_json)
                VALUES (?, 'delete_data_basket_item', ?, ?)
                """,
                (
                    str(uuid.uuid4()),
                    row_before["target_ref"] if row_before else None,
                    json.dumps({"basket_id": normalized_basket_id, "item_id": normalized_item_id, "deleted": deleted}, ensure_ascii=False),
                ),
            )
        self.logger.write("info", "user data basket item deleted", basket_id=normalized_basket_id, item_id=normalized_item_id, deleted=deleted)
        return {"ok": True, "deleted": deleted}


def build_handler(runtime: BundleRuntime, state: dict[str, Any], session_token: str) -> type[BaseHTTPRequestHandler]:
    class LocalHandler(BaseHTTPRequestHandler):
        server_version = "SAPDWikiZIPAlpha/0.1"

        def log_message(self, format: str, *args: Any) -> None:
            runtime.logger.write("info", "http request", client=self.client_address[0], request=format % args)

        def send_json(self, status: int, data: Any) -> None:
            body = json_dumps(data)
            self.send_response(status)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            self.wfile.write(body)

        def send_static(self, path: Path) -> None:
            body = path.read_bytes()
            content_type = mimetypes.guess_type(str(path))[0] or "application/octet-stream"
            self.send_response(200)
            self.send_header("Content-Type", content_type)
            self.send_header("Content-Length", str(len(body)))
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            self.wfile.write(body)

        def resolve_static_path(self, request_path: str) -> Path:
            relative = request_path.lstrip("/") or "index.html"
            candidate = (runtime.frontend_dir / relative).resolve()
            frontend_root = runtime.frontend_dir.resolve()
            if frontend_root not in candidate.parents and candidate != frontend_root:
                return frontend_root / "index.html"
            if candidate.is_file():
                return candidate
            return frontend_root / "index.html"

        def user_data_basket_parts(self, request_path: str) -> list[str]:
            if not request_path.startswith("/api/v1/user/data-baskets"):
                return []
            return [unquote(part) for part in request_path.strip("/").split("/")]

        def user_workspace_parts(self, request_path: str) -> list[str]:
            if not request_path.startswith("/api/v1/user/workspaces"):
                return []
            return [unquote(part) for part in request_path.strip("/").split("/")]

        def do_GET(self) -> None:
            parsed = urlparse(self.path)
            try:
                if parsed.path == "/api/v1/health":
                    port = int(state["port"])
                    if not is_allowed_host_header(self.headers.get("Host", ""), port):
                        self.send_json(403, {"ok": False, "error": "invalid Host header"})
                        return
                    self.send_json(
                        200,
                        {
                            "ok": True,
                            "state": state,
                            "auth": {
                                "writes_require_token": True,
                                "header": AUTH_HEADER,
                                "session_token": session_token,
                            },
                        },
                    )
                    return
                if parsed.path == "/api/v1/base/summary":
                    self.send_json(200, runtime.base_summary())
                    return
                if parsed.path == "/api/v1/base/items":
                    params = parse_qs(parsed.query)
                    limit = int(params.get("limit", ["20"])[0])
                    self.send_json(200, runtime.base_items(limit=max(1, min(limit, 100))))
                    return
                if parsed.path == "/api/v1/user/favorites":
                    self.send_json(200, runtime.list_favorites())
                    return
                if parsed.path == "/api/v1/user/notes":
                    self.send_json(200, runtime.list_notes(parse_qs(parsed.query)))
                    return
                workspace_parts = self.user_workspace_parts(parsed.path)
                if workspace_parts == ["api", "v1", "user", "workspaces"]:
                    self.send_json(200, runtime.list_workspaces())
                    return
                if len(workspace_parts) == 6 and workspace_parts[:4] == ["api", "v1", "user", "workspaces"] and workspace_parts[5] == "items":
                    self.send_json(200, runtime.list_workspace_items(workspace_parts[4]))
                    return
                parts = self.user_data_basket_parts(parsed.path)
                if parts == ["api", "v1", "user", "data-baskets"]:
                    self.send_json(200, runtime.list_data_baskets())
                    return
                if len(parts) == 6 and parts[:4] == ["api", "v1", "user", "data-baskets"] and parts[5] == "items":
                    self.send_json(200, runtime.list_data_basket_items(parts[4]))
                    return
                if parsed.path.startswith(API_PREFIX):
                    self.send_json(404, {"ok": False, "error": "not found", "path": parsed.path})
                    return
                static_path = self.resolve_static_path(parsed.path)
                if not static_path.exists():
                    self.send_json(404, {"ok": False, "error": "frontend index.html not found"})
                    return
                self.send_static(static_path)
            except Exception as error:  # noqa: BLE001 - local server should return useful JSON.
                runtime.logger.write("error", "request failed", path=parsed.path, error=str(error))
                self.send_json(500, {"ok": False, "error": str(error)})

        def do_OPTIONS(self) -> None:
            self.send_response(403)
            self.send_header("Cache-Control", "no-store")
            self.end_headers()

        def validate_write_request(self) -> tuple[int, str] | None:
            if not is_json_content_type(self.headers.get("Content-Type", "")):
                return 415, "writes require Content-Type: application/json"
            token = self.headers.get(AUTH_HEADER, "").strip()
            if not token or not secrets.compare_digest(token, session_token):
                return 403, f"writes require a valid {AUTH_HEADER} header"
            port = int(state["port"])
            if not is_allowed_host_header(self.headers.get("Host", ""), port):
                return 403, "invalid Host header"
            origin = self.headers.get("Origin", "").strip()
            if origin and not is_allowed_loopback_origin(origin, port):
                return 403, "cross-origin writes are not allowed"
            referer = self.headers.get("Referer", "").strip()
            if not origin and referer and not is_allowed_loopback_origin(referer, port):
                return 403, "cross-origin write referer is not allowed"
            return None

        def do_POST(self) -> None:
            parsed = urlparse(self.path)
            try:
                workspace_parts = self.user_workspace_parts(parsed.path)
                is_workspace_create = workspace_parts == ["api", "v1", "user", "workspaces"]
                is_workspace_item_create = len(workspace_parts) == 6 and workspace_parts[:4] == ["api", "v1", "user", "workspaces"] and workspace_parts[5] == "items"
                parts = self.user_data_basket_parts(parsed.path)
                is_data_basket_create = parts == ["api", "v1", "user", "data-baskets"]
                is_data_basket_item_create = len(parts) == 6 and parts[:4] == ["api", "v1", "user", "data-baskets"] and parts[5] == "items"
                if parsed.path not in {"/api/v1/user/favorites", "/api/v1/user/notes"} and not is_workspace_create and not is_workspace_item_create and not is_data_basket_create and not is_data_basket_item_create:
                    self.send_json(404, {"ok": False, "error": "not found"})
                    return
                auth_error = self.validate_write_request()
                if auth_error:
                    status, message = auth_error
                    self.send_json(status, {"ok": False, "error": message})
                    return
                length = int(self.headers.get("Content-Length", "0"))
                payload = json.loads(self.rfile.read(length).decode("utf-8") or "{}")
                if parsed.path == "/api/v1/user/notes":
                    self.send_json(200, runtime.add_note(payload))
                elif is_workspace_create:
                    self.send_json(200, runtime.create_workspace(payload))
                elif is_workspace_item_create:
                    self.send_json(200, runtime.add_workspace_item(workspace_parts[4], payload))
                elif is_data_basket_create:
                    self.send_json(200, runtime.create_data_basket(payload))
                elif is_data_basket_item_create:
                    self.send_json(200, runtime.add_data_basket_item(parts[4], payload))
                else:
                    self.send_json(200, runtime.add_favorite(payload))
            except ValueError as error:
                self.send_json(400, {"ok": False, "error": str(error)})
            except Exception as error:  # noqa: BLE001
                runtime.logger.write("error", "post failed", path=parsed.path, error=str(error))
                self.send_json(500, {"ok": False, "error": str(error)})

        def do_PATCH(self) -> None:
            parsed = urlparse(self.path)
            try:
                if not parsed.path.startswith("/api/v1/user/notes/"):
                    self.send_json(404, {"ok": False, "error": "not found"})
                    return
                auth_error = self.validate_write_request()
                if auth_error:
                    status, message = auth_error
                    self.send_json(status, {"ok": False, "error": message})
                    return
                length = int(self.headers.get("Content-Length", "0"))
                payload = json.loads(self.rfile.read(length).decode("utf-8") or "{}")
                note_id = unquote(parsed.path.rsplit("/", 1)[-1])
                self.send_json(200, runtime.update_note(note_id, payload))
            except ValueError as error:
                self.send_json(400, {"ok": False, "error": str(error)})
            except Exception as error:  # noqa: BLE001
                runtime.logger.write("error", "patch failed", path=parsed.path, error=str(error))
                self.send_json(500, {"ok": False, "error": str(error)})

        def do_DELETE(self) -> None:
            parsed = urlparse(self.path)
            try:
                workspace_parts = self.user_workspace_parts(parsed.path)
                is_workspace_delete = len(workspace_parts) == 5 and workspace_parts[:4] == ["api", "v1", "user", "workspaces"]
                is_workspace_item_delete = len(workspace_parts) == 7 and workspace_parts[:4] == ["api", "v1", "user", "workspaces"] and workspace_parts[5] == "items"
                parts = self.user_data_basket_parts(parsed.path)
                is_data_basket_delete = len(parts) == 5 and parts[:4] == ["api", "v1", "user", "data-baskets"]
                is_data_basket_item_delete = len(parts) == 7 and parts[:4] == ["api", "v1", "user", "data-baskets"] and parts[5] == "items"
                if parsed.path != "/api/v1/user/favorites" and not parsed.path.startswith("/api/v1/user/notes/") and not is_workspace_delete and not is_workspace_item_delete and not is_data_basket_delete and not is_data_basket_item_delete:
                    self.send_json(404, {"ok": False, "error": "not found"})
                    return
                auth_error = self.validate_write_request()
                if auth_error:
                    status, message = auth_error
                    self.send_json(status, {"ok": False, "error": message})
                    return
                if parsed.path.startswith("/api/v1/user/notes/"):
                    note_id = unquote(parsed.path.rsplit("/", 1)[-1])
                    self.send_json(200, runtime.delete_note(note_id))
                elif is_workspace_item_delete:
                    self.send_json(200, runtime.delete_workspace_item(workspace_parts[4], workspace_parts[6]))
                elif is_workspace_delete:
                    self.send_json(200, runtime.delete_workspace(workspace_parts[4]))
                elif is_data_basket_item_delete:
                    self.send_json(200, runtime.delete_data_basket_item(parts[4], parts[6]))
                elif is_data_basket_delete:
                    self.send_json(200, runtime.delete_data_basket(parts[4]))
                else:
                    params = parse_qs(parsed.query)
                    target_ref = unquote((params.get("target_ref") or [""])[0])
                    self.send_json(200, runtime.delete_favorite(target_ref))
            except ValueError as error:
                self.send_json(400, {"ok": False, "error": str(error)})
            except Exception as error:  # noqa: BLE001
                runtime.logger.write("error", "delete failed", path=parsed.path, error=str(error))
                self.send_json(500, {"ok": False, "error": str(error)})

    return LocalHandler


def write_state(root: Path, state: dict[str, Any]) -> None:
    state_path = root / "logs" / "runtime-state.json"
    state_path.write_text(json.dumps(state, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def perform_startup_check(bundle_root: Path, logger: RuntimeLogger) -> dict[str, Any]:
    result = check_bundle(bundle_root, create_user=True)
    startup_path = bundle_root / "logs" / "startup-check-result.json"
    try:
        startup_path.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    except OSError as error:
        logger.write("error", "failed to write startup check result", error=str(error))
    if not result["ok"]:
        failed = [check for check in result["checks"] if not check["ok"]]
        logger.write("error", "startup check failed", failed_checks=failed)
    else:
        logger.write("info", "startup check passed", selected_port=result.get("selected_port"))
    return result


def run_server(bundle_root: Path, no_browser: bool = False) -> int:
    root = bundle_root.resolve()
    log_path = root / "logs" / "runtime.log"
    logger = RuntimeLogger(log_path)
    logger.write("info", "starting SAPD Wiki ZIP alpha backend", bundle_root=str(root))
    result = perform_startup_check(root, logger)
    if not result["ok"]:
        return 2

    runtime = BundleRuntime(root, logger)
    host = str(runtime.config.get("host", "127.0.0.1")).strip() or "127.0.0.1"
    if not is_loopback_host(host):
        logger.write("error", "refusing to bind non-loopback host", host=host)
        return 2
    port = int(result["selected_port"])
    session_token = secrets.token_urlsafe(32)
    state = {
        "started_at": now_iso(),
        "host": host,
        "port": port,
        "url": f"http://{host}:{port}/",
        "platform": runtime.manifest.get("platform"),
        "bundle_root": str(root),
        "base_database": str(runtime.base_db.relative_to(root)),
        "user_database": str(runtime.user_db.relative_to(root)),
    }
    write_state(root, state)
    handler = build_handler(runtime, state, session_token)
    server = ThreadingHTTPServer((host, port), handler)
    logger.write("info", "local server listening", url=state["url"])

    def stop_server(signum: int, _frame: Any) -> None:
        logger.write("info", "shutdown signal received", signal=signum)
        threading.Thread(target=server.shutdown, daemon=True).start()

    signal.signal(signal.SIGTERM, stop_server)
    signal.signal(signal.SIGINT, stop_server)

    if runtime.config.get("open_browser_on_start", True) and not no_browser:
        webbrowser.open(state["url"])
        logger.write("info", "browser open requested", url=state["url"])

    try:
        server.serve_forever()
    finally:
        logger.write("info", "local server stopped")
        server.server_close()
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description="Run SAPD Wiki ZIP alpha local backend.")
    parser.add_argument("--bundle-root", type=Path, default=Path.cwd())
    parser.add_argument("--no-browser", action="store_true", help="Do not open the default browser.")
    parser.add_argument("--check-only", action="store_true", help="Run runtime checks and exit.")
    parser.add_argument("--export-diagnostics", action="store_true", help="Export diagnostics and exit.")
    args = parser.parse_args()

    root = args.bundle_root.resolve()
    logger = RuntimeLogger(root / "logs" / "runtime.log")
    if args.export_diagnostics:
        output = export_diagnostics(root)
        print(f"diagnostics={output}")
        return 0
    if args.check_only:
        result = perform_startup_check(root, logger)
        print(json.dumps(result, ensure_ascii=False, indent=2))
        return 0 if result["ok"] else 1
    return run_server(root, no_browser=args.no_browser)


if __name__ == "__main__":
    if getattr(sys, "frozen", False):
        os.chdir(Path(sys.executable).resolve().parent)
    raise SystemExit(main())
