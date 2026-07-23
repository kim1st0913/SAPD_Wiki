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
import importlib.util
import json
import mimetypes
import os
import re
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

SOURCE_ROOT = Path(__file__).resolve().parents[1] / "src"
if SOURCE_ROOT.exists() and str(SOURCE_ROOT) not in sys.path:
    sys.path.insert(0, str(SOURCE_ROOT))

projection_api_import_error = ""


def load_projection_api_module() -> Any | None:
    global projection_api_import_error

    candidate_roots: list[Path] = []
    frozen_root = getattr(sys, "_MEIPASS", "")
    if frozen_root:
        candidate_roots.append(Path(frozen_root) / "runtime_src")
    candidate_roots.append(SOURCE_ROOT)

    for source_root in candidate_roots:
        package_dir = source_root / "sapd_wiki"
        init_path = package_dir / "__init__.py"
        api_path = package_dir / "api_server.py"
        if not init_path.is_file() or not api_path.is_file():
            continue
        package_name = "_sapd_wiki_projection"
        try:
            package_spec = importlib.util.spec_from_file_location(
                package_name,
                init_path,
                submodule_search_locations=[str(package_dir)],
            )
            if package_spec is None or package_spec.loader is None:
                raise ImportError(f"cannot create package spec for {init_path}")
            package_module = importlib.util.module_from_spec(package_spec)
            sys.modules[package_name] = package_module
            package_spec.loader.exec_module(package_module)

            api_spec = importlib.util.spec_from_file_location(f"{package_name}.api_server", api_path)
            if api_spec is None or api_spec.loader is None:
                raise ImportError(f"cannot create api spec for {api_path}")
            api_module = importlib.util.module_from_spec(api_spec)
            sys.modules[f"{package_name}.api_server"] = api_module
            api_spec.loader.exec_module(api_module)
            return api_module
        except Exception as error:  # noqa: BLE001 - keep trying other bundled/source roots.
            projection_api_import_error = str(error)
    if not projection_api_import_error:
        projection_api_import_error = "src/sapd_wiki/api_server.py not found"
    return None


projection_api = load_projection_api_module()


API_PREFIX = "/api/v1/"
AUTH_HEADER = "X-SAPD-Session-Token"
USER_SCHEMA_VERSION = "user_schema_0.3"
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

USER_NOTE_INDEX_SQL = [
    "CREATE INDEX IF NOT EXISTS idx_user_notes_page_route_updated ON user_notes(page_route, updated_at DESC)",
    "CREATE INDEX IF NOT EXISTS idx_user_notes_target_ref ON user_notes(target_ref)",
    "CREATE INDEX IF NOT EXISTS idx_user_notes_page_target ON user_notes(page_route, target_ref)",
    "CREATE INDEX IF NOT EXISTS idx_user_notes_anchor_type ON user_notes(anchor_type)",
    "CREATE INDEX IF NOT EXISTS idx_user_notes_object_type ON user_notes(object_type)",
    "CREATE INDEX IF NOT EXISTS idx_user_notes_status ON user_notes(status)",
]

USER_NOTE_SELECT_COLUMNS = """
id, target_ref, body, status, page_route, page_title, anchor_type, object_type, object_title, tags_json, created_at, updated_at
"""

USER_NOTE_STATUSES = {"todo", "reviewing", "waiting_confirm", "confirmed", "closed", "deferred"}
USER_NOTE_STATUS_LABELS = {
    "todo": "待处理",
    "reviewing": "处理中",
    "waiting_confirm": "待确认",
    "confirmed": "已确认",
    "closed": "已关闭",
    "deferred": "暂不处理",
}
USER_NOTE_ANCHOR_LABELS = {
    "page": "页面",
    "object": "对象",
    "row": "行",
    "field": "值",
    "relation": "关系",
}
USER_DATA_BASKET_STATUSES = {"active", "draft", "archived"}
USER_WORKSPACE_STATUSES = {"active", "draft", "archived"}
USER_WORKSPACE_ITEM_STATUSES = {"active", "pinned", "reviewing", "closed", "archived"}
USER_EXPORT_TYPES = {"current_view", "workspace", "data_basket", "user_overlay", "full_backup"}
FORBIDDEN_EXPORT_FIELDS = {
    "sheet",
    "row",
    "column",
    "raw_value",
    "source_file",
    "import_id",
    "source_id",
    "source_ref",
    "source_label",
    "debug",
    "raw",
    "metadata",
    "intermediate",
    "generated_at",
}

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

USER_EXPORT_TABLES = [
    """
    CREATE TABLE IF NOT EXISTS user_export_profiles (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        export_type TEXT NOT NULL,
        config_json TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS user_export_jobs (
        id TEXT PRIMARY KEY,
        profile_id TEXT,
        export_type TEXT NOT NULL,
        source_ref TEXT,
        status TEXT NOT NULL DEFAULT 'draft',
        preview_json TEXT,
        output_path TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
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

USER_EXPORT_PROFILE_SELECT_COLUMNS = """
id, name, export_type, config_json, created_at, updated_at
"""

USER_EXPORT_JOB_SELECT_COLUMNS = """
id, profile_id, export_type, source_ref, status, preview_json, output_path, created_at, updated_at
"""


def json_dumps(data: Any) -> bytes:
    return json.dumps(data, ensure_ascii=False, indent=2).encode("utf-8")


def quote_identifier(identifier: str) -> str:
    return '"' + identifier.replace('"', '""') + '"'


def now_iso() -> str:
    return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())


def markdown_list(value: Any) -> list[Any]:
    return value if isinstance(value, list) else []


def markdown_value(value: Any, fallback: str = "未设置") -> str:
    text = str(value or "").replace("\r\n", "\n").replace("\r", "\n").strip()
    return text or fallback


def markdown_inline(value: Any, fallback: str = "未设置") -> str:
    return " / ".join(markdown_value(value, fallback).splitlines()) or fallback


def markdown_count_lines(counts: Any, label_map: dict[str, str] | None = None) -> list[str]:
    if not isinstance(counts, dict) or not counts:
        return ["- 无"]
    lines = []
    for key, count in counts.items():
        label = label_map.get(key, key) if label_map else key
        lines.append(f"- {label}：{count}")
    return lines


def markdown_note_body(value: Any) -> str:
    body = markdown_value(value, "（无正文）")
    return "\n".join(f"> {line}" if line else ">" for line in body.splitlines())


def user_notes_export_markdown(payload: dict[str, Any]) -> str:
    summary = payload.get("summary") if isinstance(payload.get("summary"), dict) else {}
    source = payload.get("source") if isinstance(payload.get("source"), dict) else {}
    notes = [note for note in markdown_list(payload.get("notes")) if isinstance(note, dict)]
    project_or_bundle = source.get("project_root") or source.get("bundle_root")
    lines = [
        "# SAPD Wiki 批注导出",
        "",
        f"- 导出时间：{markdown_inline(payload.get('export_created_at'))}",
        f"- 批注数量：{summary.get('note_count', len(notes))}",
        "- 隐私提醒：本文件包含用户批注正文，仅在需要反馈问题时主动分享。",
        "",
        "## 导出来源",
        "",
        f"- 项目 / Bundle：{markdown_inline(project_or_bundle)}",
        f"- 用户数据库：{markdown_inline(source.get('user_database'))}",
        "",
        "## 汇总",
        "",
        "### 按状态",
        "",
        *markdown_count_lines(summary.get("by_status"), USER_NOTE_STATUS_LABELS),
        "",
        "### 按页面",
        "",
        *markdown_count_lines(summary.get("by_page_route")),
        "",
        "### 按锚点类型",
        "",
        *markdown_count_lines(summary.get("by_anchor_type"), USER_NOTE_ANCHOR_LABELS),
        "",
        "### 按对象类型",
        "",
        *markdown_count_lines(summary.get("by_object_type")),
        "",
        "## 批注清单",
        "",
    ]
    if not notes:
        lines.append("暂无批注。")
        return "\n".join(lines).rstrip() + "\n"
    for index, note in enumerate(notes, start=1):
        status = markdown_inline(note.get("status") or "todo")
        status_label = USER_NOTE_STATUS_LABELS.get(status, status)
        anchor_type = markdown_inline(note.get("anchor_type") or "object")
        anchor_label = USER_NOTE_ANCHOR_LABELS.get(anchor_type, anchor_type)
        page_title = markdown_inline(note.get("page_title"))
        page_route = markdown_inline(note.get("page_route"))
        object_title = markdown_inline(note.get("object_title"))
        object_type = markdown_inline(note.get("object_type"))
        target_ref = markdown_inline(note.get("target_ref"))
        tags = "、".join(markdown_inline(tag) for tag in markdown_list(note.get("tags"))) or "无"
        title = object_title if object_title != "未设置" else page_title if page_title != "未设置" else target_ref
        lines.extend(
            [
                f"### {index}. {title}",
                "",
                f"- 状态：{status_label}",
                f"- 页面：{page_title}（{page_route}）",
                f"- 锚点：{anchor_label}",
                f"- 对象：{object_title}（{object_type}）",
                f"- 标签：{tags}",
                f"- 目标引用：{target_ref}",
                f"- 创建时间：{markdown_inline(note.get('created_at'))}",
                f"- 更新时间：{markdown_inline(note.get('updated_at'))}",
                "",
                "批注正文：",
                "",
                markdown_note_body(note.get("body")),
                "",
            ]
        )
    return "\n".join(lines).rstrip() + "\n"


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
        self.import_dir = self.resolve_import_dir(self.config.get("import_dir"))
        self.export_dir = self.resolve_export_dir(self.config.get("download_dir"))
        base_file = self.manifest["base_database"].get("file", "sapd_wiki_base.sqlite3")
        user_file = self.manifest["user_database"].get("file", "sapd_wiki_user.sqlite3")
        self.base_db = safe_bundle_child(self.root / "data" / "base", base_file, "sapd_wiki_base.sqlite3")
        self.user_db = safe_bundle_child(self.root / "data" / "user", user_file, "sapd_wiki_user.sqlite3")
        self.ensure_user_note_columns()
        self.ensure_user_workspace_tables()
        self.ensure_user_data_basket_tables()
        self.ensure_user_export_tables()
        self.ensure_user_schema_version()
        self.import_dir.mkdir(parents=True, exist_ok=True)
        for category in ("maturity-templates", "maturity-scores"):
            (self.import_dir / category).mkdir(parents=True, exist_ok=True)
        self.export_dir.mkdir(parents=True, exist_ok=True)
        for category in ("maturity-reports", "maturity-scores", "maturity-templates", "issues", "diagnostics"):
            (self.export_dir / category).mkdir(parents=True, exist_ok=True)

    def resolve_import_dir(self, configured_dir: Any) -> Path:
        raw_value = str(configured_dir or "").strip()
        if not raw_value:
            return self.root.parent / "import"
        candidate = Path(raw_value).expanduser()
        if not candidate.is_absolute():
            candidate = self.root / candidate
        return candidate.resolve()

    def resolve_export_dir(self, configured_dir: Any) -> Path:
        raw_value = str(configured_dir or "").strip()
        if not raw_value:
            return self.root / "data" / "exports"
        candidate = Path(raw_value).expanduser()
        if not candidate.is_absolute():
            candidate = self.root / candidate
        return candidate.resolve()

    def export_category_dir(self, category: str) -> Path:
        normalized = str(category or "").strip()
        allowed = {"maturity-reports", "maturity-scores", "maturity-templates", "issues", "diagnostics"}
        if normalized not in allowed:
            raise ValueError("unsupported export category")
        directory = self.export_dir / normalized
        directory.mkdir(parents=True, exist_ok=True)
        return directory

    def license_status(self) -> dict[str, Any]:
        license_config = self.config.get("license")
        if isinstance(license_config, dict):
            return license_config
        return {
            "state": "unknown",
            "display_text": "授权状态未知",
            "activated": False,
            "can_skip": False,
        }

    def ensure_user_schema_version(self) -> None:
        user_uri = self.user_db.resolve().as_uri() + "?mode=rwc"
        with sqlite3.connect(user_uri, uri=True) as connection:
            connection.execute(
                """
                CREATE TABLE IF NOT EXISTS user_meta (
                    key TEXT PRIMARY KEY,
                    value TEXT NOT NULL,
                    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
                )
                """
            )
            connection.execute(
                """
                CREATE TABLE IF NOT EXISTS user_schema_migrations (
                    version TEXT PRIMARY KEY,
                    applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
                )
                """
            )
            connection.execute(
                """
                INSERT INTO user_meta(key, value, updated_at)
                VALUES ('schema_version', ?, CURRENT_TIMESTAMP)
                ON CONFLICT(key) DO UPDATE SET
                    value = excluded.value,
                    updated_at = CURRENT_TIMESTAMP
                """,
                (USER_SCHEMA_VERSION,),
            )
            connection.execute(
                """
                INSERT INTO user_schema_migrations(version)
                VALUES (?)
                ON CONFLICT(version) DO NOTHING
                """,
                (USER_SCHEMA_VERSION,),
            )

    def ensure_user_note_columns(self) -> None:
        user_uri = self.user_db.resolve().as_uri() + "?mode=rwc"
        with sqlite3.connect(user_uri, uri=True) as connection:
            rows = connection.execute("PRAGMA table_info(user_notes)").fetchall()
            existing = {row[1] for row in rows}
            for column, definition in USER_NOTE_COLUMNS.items():
                if column not in existing:
                    connection.execute(f"ALTER TABLE user_notes ADD COLUMN {column} {definition}")
            for statement in USER_NOTE_INDEX_SQL:
                connection.execute(statement)

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

    def ensure_user_export_tables(self) -> None:
        user_uri = self.user_db.resolve().as_uri() + "?mode=rwc"
        with sqlite3.connect(user_uri, uri=True) as connection:
            connection.execute("PRAGMA foreign_keys = ON")
            for statement in USER_EXPORT_TABLES:
                connection.execute(statement)

    def open_connection(self) -> sqlite3.Connection:
        user_uri = self.user_db.resolve().as_uri() + "?mode=rwc"
        base_uri = self.base_db.resolve().as_uri() + "?mode=ro&immutable=1"
        connection = sqlite3.connect(user_uri, uri=True)
        connection.row_factory = sqlite3.Row
        connection.execute("PRAGMA foreign_keys = ON")
        connection.execute("ATTACH DATABASE ? AS base", (base_uri,))
        return connection

    def open_user_connection(self) -> sqlite3.Connection:
        user_uri = self.user_db.resolve().as_uri() + "?mode=rwc"
        connection = sqlite3.connect(user_uri, uri=True)
        connection.row_factory = sqlite3.Row
        connection.execute("PRAGMA foreign_keys = ON")
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
        with self.open_user_connection() as connection:
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

    def user_notes_export_payload(self) -> dict[str, Any]:
        notes = [note for note in self.list_notes({}).get("notes", []) if isinstance(note, dict)]

        def count_by(field: str) -> dict[str, int]:
            counts: dict[str, int] = {}
            for note in notes:
                key = str(note.get(field) or "未设置").strip() or "未设置"
                counts[key] = counts.get(key, 0) + 1
            return dict(sorted(counts.items(), key=lambda item: (-item[1], item[0])))

        return {
            "ok": True,
            "version": 1,
            "export_type": "user_notes",
            "export_created_at": now_iso(),
            "data_state": "ready",
            "contains_user_note_body": True,
            "privacy_note": "本导出包含用户批注正文，仅在需要反馈问题时主动分享。",
            "source": {
                "bundle_root": self.root.name,
                "user_database": str(self.user_db.relative_to(self.root)),
            },
            "summary": {
                "note_count": len(notes),
                "by_status": count_by("status"),
                "by_page_route": count_by("page_route"),
                "by_anchor_type": count_by("anchor_type"),
                "by_object_type": count_by("object_type"),
            },
            "notes": notes,
        }

    def user_notes_export_file_name(self) -> str:
        return f"user-notes-export-{time.strftime('%Y%m%d-%H%M%SZ', time.gmtime())}.md"

    def export_user_notes_file(self) -> Path:
        payload = self.user_notes_export_payload()
        output_path = self.export_category_dir("issues") / self.user_notes_export_file_name()
        output_path.write_text(user_notes_export_markdown(payload), encoding="utf-8")
        self.logger.write("info", "user notes exported", output_path=str(output_path), note_count=payload["summary"]["note_count"])
        return output_path

    def export_user_notes_file_result(self) -> dict[str, Any]:
        output_path = self.export_user_notes_file()
        payload = self.user_notes_export_payload()
        return {
            "ok": True,
            "data_state": "ready",
            "export_type": "user_notes",
            "file_name": output_path.name,
            "output_path": str(output_path),
            "download_dir": str(self.export_dir),
            "category": "issues",
            "relative_path": output_path.relative_to(self.export_dir).as_posix(),
            "note_count": payload["summary"]["note_count"],
        }

    def save_markdown_export(self, payload: dict[str, Any]) -> dict[str, Any]:
        content = str(payload.get("content") or "")
        if not content.strip():
            raise ValueError("content is required")
        raw_prefix = str(payload.get("filename_prefix") or "sapd-export").strip()
        safe_prefix = re.sub(r"[^A-Za-z0-9._-]+", "-", raw_prefix).strip(".-")[:64] or "sapd-export"
        category = str(payload.get("category") or "issues").strip()
        requested_name = Path(str(payload.get("filename") or "").strip()).name
        file_name = requested_name or f"{safe_prefix}-{time.strftime('%Y%m%d-%H%M%SZ', time.gmtime())}.md"
        output_path = self.export_category_dir(category) / file_name
        if output_path.exists():
            output_path = output_path.with_name(f"{output_path.stem}-{uuid.uuid4().hex[:6]}{output_path.suffix}")
        output_path.write_text(content, encoding="utf-8")
        self.logger.write("info", "markdown export saved", output_path=str(output_path), byte_count=output_path.stat().st_size)
        return {
            "ok": True,
            "data_state": "ready",
            "export_type": "markdown",
            "file_name": output_path.name,
            "output_path": str(output_path),
            "download_dir": str(self.export_dir),
            "category": category,
            "relative_path": output_path.relative_to(self.export_dir).as_posix(),
            "byte_count": output_path.stat().st_size,
        }

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

    def normalize_export_type(self, value: Any) -> str:
        status = str(value or "current_view").strip()
        if status not in USER_EXPORT_TYPES:
            raise ValueError(f"unsupported export_type: {status}")
        return status

    def normalize_export_config_json(self, value: Any) -> str:
        if value is None:
            parsed: Any = {}
        elif isinstance(value, str):
            stripped = value.strip()
            if not stripped:
                parsed = {}
            else:
                try:
                    parsed = json.loads(stripped)
                except json.JSONDecodeError:
                    raise ValueError("config must be a JSON object") from None
        else:
            parsed = value
        if not isinstance(parsed, dict):
            raise ValueError("config must be a JSON object")
        forbidden = self.forbidden_export_fields(parsed)
        if forbidden:
            raise ValueError(f"export config contains forbidden fields: {', '.join(forbidden)}")
        return json.dumps(parsed, ensure_ascii=False)

    def forbidden_export_fields(self, value: Any) -> list[str]:
        found: set[str] = set()

        def walk(node: Any) -> None:
            if isinstance(node, dict):
                for key, child in node.items():
                    normalized_key = str(key).strip()
                    if normalized_key in FORBIDDEN_EXPORT_FIELDS:
                        found.add(normalized_key)
                    walk(child)
            elif isinstance(node, list):
                for item in node:
                    if isinstance(item, str) and item.strip() in FORBIDDEN_EXPORT_FIELDS:
                        found.add(item.strip())
                    walk(item)

        walk(value)
        return sorted(found)

    def export_profile_row_to_dict(self, row: sqlite3.Row | None) -> dict[str, Any] | None:
        if not row:
            return None
        profile = dict(row)
        try:
            profile["config"] = json.loads(profile.get("config_json") or "{}")
        except json.JSONDecodeError:
            profile["config"] = {}
        profile.pop("config_json", None)
        return profile

    def export_job_row_to_dict(self, row: sqlite3.Row | None) -> dict[str, Any] | None:
        if not row:
            return None
        job = dict(row)
        try:
            job["preview"] = json.loads(job.get("preview_json") or "null")
        except json.JSONDecodeError:
            job["preview"] = None
        job.pop("preview_json", None)
        return job

    def list_export_profiles(self) -> dict[str, Any]:
        with self.open_connection() as connection:
            rows = connection.execute(
                f"""
                SELECT {USER_EXPORT_PROFILE_SELECT_COLUMNS}
                FROM user_export_profiles
                ORDER BY updated_at DESC
                """
            ).fetchall()
        return {"ok": True, "data_state": "ready", "export_profiles": [self.export_profile_row_to_dict(row) for row in rows]}

    def get_export_profile(self, profile_id: str) -> dict[str, Any]:
        normalized_id = str(profile_id or "").strip()
        if not normalized_id:
            raise ValueError("profile_id is required")
        with self.open_connection() as connection:
            row = connection.execute(
                f"""
                SELECT {USER_EXPORT_PROFILE_SELECT_COLUMNS}
                FROM user_export_profiles
                WHERE id = ?
                """,
                (normalized_id,),
            ).fetchone()
        return {"ok": bool(row), "data_state": "ready", "export_profile": self.export_profile_row_to_dict(row)}

    def create_export_profile(self, payload: dict[str, Any]) -> dict[str, Any]:
        name = str(payload.get("name") or "").strip()
        if not name:
            raise ValueError("name is required")
        export_type = self.normalize_export_type(payload.get("export_type"))
        config_json = self.normalize_export_config_json(payload.get("config"))
        profile_id = str(uuid.uuid4())
        with self.open_connection() as connection:
            connection.execute(
                """
                INSERT INTO user_export_profiles(id, name, export_type, config_json, created_at, updated_at)
                VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                """,
                (profile_id, name, export_type, config_json),
            )
            row = connection.execute(
                f"""
                SELECT {USER_EXPORT_PROFILE_SELECT_COLUMNS}
                FROM user_export_profiles
                WHERE id = ?
                """,
                (profile_id,),
            ).fetchone()
            connection.execute(
                """
                INSERT INTO user_change_logs(id, action, target_ref, payload_json)
                VALUES (?, 'create_export_profile', ?, ?)
                """,
                (
                    str(uuid.uuid4()),
                    f"user:export_profile:{profile_id}",
                    json.dumps({"id": profile_id, "name": name, "export_type": export_type}, ensure_ascii=False),
                ),
            )
        self.logger.write("info", "user export profile created", profile_id=profile_id, export_type=export_type)
        return {"ok": True, "export_profile": self.export_profile_row_to_dict(row)}

    def delete_export_profile(self, profile_id: str) -> dict[str, Any]:
        normalized_id = str(profile_id or "").strip()
        if not normalized_id:
            raise ValueError("profile_id is required")
        with self.open_connection() as connection:
            cursor = connection.execute("DELETE FROM user_export_profiles WHERE id = ?", (normalized_id,))
            deleted = cursor.rowcount
            connection.execute(
                """
                INSERT INTO user_change_logs(id, action, target_ref, payload_json)
                VALUES (?, 'delete_export_profile', ?, ?)
                """,
                (
                    str(uuid.uuid4()),
                    f"user:export_profile:{normalized_id}",
                    json.dumps({"id": normalized_id, "deleted": deleted}, ensure_ascii=False),
                ),
            )
        self.logger.write("info", "user export profile deleted", profile_id=normalized_id, deleted=deleted)
        return {"ok": True, "deleted": deleted}

    def build_export_preview(self, export_type: str, source_ref: str | None, config: dict[str, Any]) -> dict[str, Any]:
        return {
            "export_type": export_type,
            "source": {
                "ref": source_ref,
                "kind": source_ref.split(":", 1)[0] if source_ref else None,
            },
            "config_keys": sorted(config.keys()),
            "format": config.get("format") or "json",
            "field_boundary": {
                "status": "passed",
                "forbidden_fields": [],
            },
            "file_generation": "not_started",
        }

    def create_export_preview(self, payload: dict[str, Any]) -> dict[str, Any]:
        profile_id = str(payload.get("profile_id") or "").strip() or None
        source_ref = str(payload.get("source_ref") or "").strip() or None
        export_type = self.normalize_export_type(payload.get("export_type"))
        config: dict[str, Any] = {}
        if payload.get("config") is not None:
            config = json.loads(self.normalize_export_config_json(payload.get("config")))
        with self.open_connection() as connection:
            if profile_id:
                profile = connection.execute(
                    f"""
                    SELECT {USER_EXPORT_PROFILE_SELECT_COLUMNS}
                    FROM user_export_profiles
                    WHERE id = ?
                    """,
                    (profile_id,),
                ).fetchone()
                if not profile:
                    return {"ok": False, "error": "export_profile_not_found", "export_job": None}
                profile_dict = self.export_profile_row_to_dict(profile) or {}
                export_type = str(profile_dict.get("export_type") or export_type)
                if not config:
                    config = profile_dict.get("config") or {}
            forbidden = self.forbidden_export_fields(config)
            if forbidden:
                raise ValueError(f"export config contains forbidden fields: {', '.join(forbidden)}")
            preview = self.build_export_preview(export_type, source_ref, config)
            job_id = str(uuid.uuid4())
            connection.execute(
                """
                INSERT INTO user_export_jobs(id, profile_id, export_type, source_ref, status, preview_json, output_path, created_at, updated_at)
                VALUES (?, ?, ?, ?, 'draft', ?, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                """,
                (job_id, profile_id, export_type, source_ref, json.dumps(preview, ensure_ascii=False)),
            )
            row = connection.execute(
                f"""
                SELECT {USER_EXPORT_JOB_SELECT_COLUMNS}
                FROM user_export_jobs
                WHERE id = ?
                """,
                (job_id,),
            ).fetchone()
            connection.execute(
                """
                INSERT INTO user_change_logs(id, action, target_ref, payload_json)
                VALUES (?, 'create_export_preview', ?, ?)
                """,
                (
                    str(uuid.uuid4()),
                    f"user:export_job:{job_id}",
                    json.dumps({"id": job_id, "profile_id": profile_id, "export_type": export_type, "source_ref": source_ref}, ensure_ascii=False),
                ),
            )
        self.logger.write("info", "user export preview created", job_id=job_id, export_type=export_type)
        return {"ok": True, "export_job": self.export_job_row_to_dict(row)}

    def get_export_job(self, job_id: str) -> dict[str, Any]:
        normalized_id = str(job_id or "").strip()
        if not normalized_id:
            raise ValueError("job_id is required")
        with self.open_connection() as connection:
            row = connection.execute(
                f"""
                SELECT {USER_EXPORT_JOB_SELECT_COLUMNS}
                FROM user_export_jobs
                WHERE id = ?
                """,
                (normalized_id,),
            ).fetchone()
        return {"ok": bool(row), "data_state": "ready", "export_job": self.export_job_row_to_dict(row)}

    def export_data_for_source(self, connection: sqlite3.Connection, export_type: str, source_ref: str | None) -> dict[str, Any]:
        if export_type == "data_basket" and source_ref and source_ref.startswith("user:data_basket:"):
            basket_id = source_ref.rsplit(":", 1)[-1]
            basket = connection.execute(
                f"""
                SELECT {USER_DATA_BASKET_SELECT_COLUMNS}
                FROM user_data_baskets
                WHERE id = ?
                """,
                (basket_id,),
            ).fetchone()
            rows = connection.execute(
                f"""
                SELECT {USER_DATA_BASKET_ITEM_SELECT_COLUMNS}
                FROM user_data_basket_items
                WHERE basket_id = ?
                ORDER BY updated_at DESC
                """,
                (basket_id,),
            ).fetchall()
            return {
                "source": dict(basket) if basket else None,
                "items": [self.data_basket_item_row_to_dict(row) for row in rows],
            }
        if export_type == "workspace" and source_ref and source_ref.startswith("user:workspace:"):
            workspace_id = source_ref.rsplit(":", 1)[-1]
            workspace = connection.execute(
                f"""
                SELECT {USER_WORKSPACE_SELECT_COLUMNS}
                FROM user_workspaces
                WHERE id = ?
                """,
                (workspace_id,),
            ).fetchone()
            rows = connection.execute(
                f"""
                SELECT {USER_WORKSPACE_ITEM_SELECT_COLUMNS}
                FROM user_workspace_items
                WHERE workspace_id = ?
                ORDER BY COALESCE(sort_order, 999999), updated_at DESC
                """,
                (workspace_id,),
            ).fetchall()
            return {
                "source": dict(workspace) if workspace else None,
                "items": [self.workspace_item_row_to_dict(row) for row in rows],
            }
        return {"source": None, "items": []}

    def execute_export_job(self, payload: dict[str, Any]) -> dict[str, Any]:
        job_id = str(payload.get("job_id") or "").strip()
        if not job_id:
            raise ValueError("job_id is required")
        with self.open_connection() as connection:
            row = connection.execute(
                f"""
                SELECT {USER_EXPORT_JOB_SELECT_COLUMNS}
                FROM user_export_jobs
                WHERE id = ?
                """,
                (job_id,),
            ).fetchone()
            if not row:
                return {"ok": False, "error": "export_job_not_found", "export_job": None}
            job = self.export_job_row_to_dict(row) or {}
            preview = job.get("preview") or {}
            export_type = str(job.get("export_type") or "current_view")
            source_ref = job.get("source_ref")
            data = self.export_data_for_source(connection, export_type, source_ref)
            output = {
                "version": 1,
                "export_created_at": now_iso(),
                "export_type": export_type,
                "source": {"ref": source_ref},
                "profile_id": job.get("profile_id"),
                "preview": preview,
                "data": data,
            }
            file_name = f"user-export-{job_id}.json"
            output_path = self.export_dir / file_name
            output_path.write_text(json.dumps(output, ensure_ascii=False, indent=2), encoding="utf-8")
            relative_output_path = f"data/exports/{file_name}"
            connection.execute(
                """
                UPDATE user_export_jobs
                SET status = 'completed',
                    output_path = ?,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
                """,
                (relative_output_path, job_id),
            )
            updated = connection.execute(
                f"""
                SELECT {USER_EXPORT_JOB_SELECT_COLUMNS}
                FROM user_export_jobs
                WHERE id = ?
                """,
                (job_id,),
            ).fetchone()
            connection.execute(
                """
                INSERT INTO user_change_logs(id, action, target_ref, payload_json)
                VALUES (?, 'execute_export_job', ?, ?)
                """,
                (
                    str(uuid.uuid4()),
                    f"user:export_job:{job_id}",
                    json.dumps({"id": job_id, "export_type": export_type, "output_path": relative_output_path}, ensure_ascii=False),
                ),
            )
        self.logger.write("info", "user export job completed", job_id=job_id, export_type=export_type)
        return {"ok": True, "export_job": self.export_job_row_to_dict(updated)}

    def export_job_download_path(self, job_id: str) -> Path | None:
        normalized_id = str(job_id or "").strip()
        if not normalized_id:
            raise ValueError("job_id is required")
        with self.open_connection() as connection:
            row = connection.execute(
                """
                SELECT output_path
                FROM user_export_jobs
                WHERE id = ?
                """,
                (normalized_id,),
            ).fetchone()
        output_path = str(row["output_path"] or "").strip() if row else ""
        if not output_path:
            return None
        path = safe_bundle_child(self.root, output_path, f"data/exports/user-export-{normalized_id}.json")
        if not path.is_file():
            return None
        return path


def configure_projection_api(runtime: BundleRuntime) -> None:
    if projection_api is None:
        runtime.logger.write("warning", "projection api module unavailable", error=projection_api_import_error)
        return

    frontend_prefix = "frontend/capability-browser/"

    def resolve_runtime_project_path(value: str | Path) -> Path:
        raw = Path(value)
        if raw.is_absolute():
            return raw
        normalized = raw.as_posix()
        if normalized.startswith(frontend_prefix):
            return (runtime.frontend_dir / normalized.removeprefix(frontend_prefix)).resolve()
        if normalized.startswith("data/user/"):
            return (runtime.root / normalized).resolve()
        return (runtime.root / normalized).resolve()

    projection_api.PROJECT_ROOT = runtime.root.resolve()
    projection_api.resolve_project_path = resolve_runtime_project_path
    frontend_data_root = (runtime.frontend_dir / "public" / "data").resolve()
    if hasattr(projection_api, "configure_runtime_paths"):
        projection_api.configure_runtime_paths(
            base_db=runtime.base_db.resolve(),
            user_db=runtime.user_db.resolve(),
            data_root=frontend_data_root,
            export_dir=runtime.export_dir.resolve(),
            runtime_label="bundle",
        )
    else:
        projection_api.USER_DB_PATH = runtime.user_db.resolve()
        projection_api.DATA_PACKAGE_ROOT = frontend_data_root
        if hasattr(projection_api, "_DATA_PACKAGE_CACHE"):
            projection_api._DATA_PACKAGE_CACHE.clear()
    runtime.logger.write("info", "projection api configured", frontend_data_root=str(frontend_data_root))


def build_handler(runtime: BundleRuntime, state: dict[str, Any], session_token: str) -> type[BaseHTTPRequestHandler]:
    mcp_control_api = None
    if projection_api is not None and hasattr(projection_api, "build_browser_control_api"):
        host = str(state["host"])
        port = int(state["port"])
        expected_host = f"{host}:{port}"
        mcp_control_api = projection_api.build_browser_control_api(
            expected_host=expected_host,
            expected_origin=f"http://{expected_host}",
            session_token=session_token,
            release_channel="stable",
            configured_port=18775,
        )

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

        def handle_mcp_control(self, method: str, path: str) -> None:
            if mcp_control_api is None:
                self.send_json(
                    503,
                    {
                        "contract_version": "sapd-mcp-control-v1",
                        "error": {
                            "code": "SUPERVISOR_UNAVAILABLE",
                            "message": "The MCP supervisor is unavailable.",
                            "retryable": True,
                            "current_state_version": None,
                        },
                    },
                )
                return
            length = int(self.headers.get("Content-Length", "0") or "0")
            body = self.rfile.read(length) if length else None
            response = mcp_control_api.dispatch(
                method,
                path,
                {name: value for name, value in self.headers.items()},
                body,
            )
            encoded = response.json_bytes()
            self.send_response(response.status)
            for name, value in response.headers.items():
                self.send_header(name, value)
            self.send_header("Content-Length", str(len(encoded)))
            self.end_headers()
            self.wfile.write(encoded)

        def send_json_download(self, status: int, data: Any, file_name: str) -> None:
            body = json_dumps(data)
            self.send_response(status)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.send_header("Cache-Control", "no-store")
            self.send_header("Content-Disposition", f'attachment; filename="{file_name}"')
            self.end_headers()
            self.wfile.write(body)

        def send_text_download(self, status: int, content: str, file_name: str, content_type: str = "text/plain; charset=utf-8") -> None:
            body = content.encode("utf-8")
            self.send_response(status)
            self.send_header("Content-Type", content_type)
            self.send_header("Content-Length", str(len(body)))
            self.send_header("Cache-Control", "no-store")
            self.send_header("Content-Disposition", f'attachment; filename="{file_name}"')
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

        def send_download(self, path: Path) -> None:
            body = path.read_bytes()
            content_type = mimetypes.guess_type(str(path))[0] or "application/octet-stream"
            self.send_response(200)
            self.send_header("Content-Type", content_type)
            self.send_header("Content-Length", str(len(body)))
            self.send_header("Cache-Control", "no-store")
            self.send_header("Content-Disposition", f'attachment; filename="{path.name}"')
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

        def user_export_profile_parts(self, request_path: str) -> list[str]:
            if not request_path.startswith("/api/v1/user/export-profiles"):
                return []
            return [unquote(part) for part in request_path.strip("/").split("/")]

        def user_export_parts(self, request_path: str) -> list[str]:
            if not request_path.startswith("/api/v1/user/exports"):
                return []
            return [unquote(part) for part in request_path.strip("/").split("/")]

        def do_GET(self) -> None:
            parsed = urlparse(self.path)
            try:
                if parsed.path.startswith("/api/v1/mcp/"):
                    self.handle_mcp_control("GET", parsed.path)
                    return
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
                            "license": runtime.license_status(),
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
                if projection_api is not None:
                    params = parse_qs(parsed.query)
                    path_parts = [unquote(part) for part in parsed.path.strip("/").split("/") if part]
                    if parsed.path == "/api/v1/dashboard/knowledge-summary":
                        self.send_json(200, projection_api.create_envelope(projection_api.dashboard_knowledge_summary()))
                        return
                    if parsed.path == "/api/v1/maturity/workspace":
                        self.send_json(
                            200,
                            projection_api.create_envelope(
                                projection_api.build_maturity_workspace(
                                    projection_api.read_data_package("capability-workbench"),
                                    project_profile=projection_api.maturity_workspace_project_profile(),
                                )
                            ),
                        )
                        return
                    if parsed.path == "/api/v1/maturity/reports/artifact":
                        self.send_json(
                            200,
                            projection_api.create_envelope(
                                projection_api.load_maturity_report_artifact(
                                    project_id=(params.get("project_id") or params.get("projectId") or [""])[0],
                                    artifact_id=(params.get("artifact_id") or params.get("artifactId") or [""])[0],
                                    report_id=(params.get("report_id") or params.get("reportId") or [""])[0],
                                )
                            ),
                        )
                        return
                    if parsed.path == "/api/v1/data-packages":
                        self.send_json(200, projection_api.create_envelope({"packages": [{"name": name, "path": path} for name, path in projection_api.DATA_PACKAGES.items()]}))
                        return
                    if len(path_parts) == 4 and path_parts[:3] == ["api", "v1", "data-packages"]:
                        package_name = path_parts[3]
                        if package_name not in projection_api.DATA_PACKAGES:
                            self.send_json(404, {"ok": False, "error": "data package not found", "name": package_name})
                            return
                        self.send_json(200, projection_api.create_envelope(projection_api.read_data_package(package_name)))
                        return
                    if parsed.path == "/api/v1/search-index":
                        raw_limit = (params.get("limit") or ["80"])[0]
                        try:
                            limit = int(raw_limit)
                        except (TypeError, ValueError):
                            limit = 80
                        self.send_json(200, projection_api.create_envelope(projection_api.search_index_payload(query=(params.get("q") or [""])[0], limit=limit)))
                        return
                    if parsed.path == "/api/v1/capabilities/workspace-initial":
                        self.send_json(200, projection_api.create_envelope(projection_api.capability_workspace_initial_projection()))
                        return
                    if parsed.path == "/api/v1/capabilities/workspace-projection":
                        focus_id = (params.get("focus_id") or params.get("focusId") or [""])[0] or None
                        object_type = (params.get("object_type") or params.get("objectType") or [""])[0] or None
                        object_id = (params.get("object_id") or params.get("objectId") or [""])[0] or None
                        self.send_json(200, projection_api.create_envelope(projection_api.capability_workspace_projection(focus_id=focus_id, object_type=object_type, object_id=object_id)))
                        return
                    if parsed.path == "/api/v1/capabilities/workspace-view":
                        focus_id = (params.get("focus_id") or params.get("focusId") or [""])[0] or None
                        object_type = (params.get("object_type") or params.get("objectType") or [""])[0] or None
                        object_id = (params.get("object_id") or params.get("objectId") or [""])[0] or None
                        self.send_json(200, projection_api.create_envelope(projection_api.capability_workspace_view(focus_id=focus_id, object_type=object_type, object_id=object_id)))
                        return
                if parsed.path == "/api/v1/user/favorites":
                    self.send_json(200, runtime.list_favorites())
                    return
                if parsed.path == "/api/v1/user/notes/export":
                    port = int(state["port"])
                    if not is_allowed_host_header(self.headers.get("Host", ""), port):
                        self.send_json(403, {"ok": False, "error": "invalid Host header"})
                        return
                    params = parse_qs(parsed.query)
                    payload = runtime.user_notes_export_payload()
                    should_download = str((params.get("download") or [""])[0]).strip().lower() in {"1", "true", "yes"}
                    should_save = str((params.get("save") or [""])[0]).strip().lower() in {"1", "true", "yes"}
                    if should_download:
                        self.send_text_download(200, user_notes_export_markdown(payload), runtime.user_notes_export_file_name(), "text/markdown; charset=utf-8")
                    elif should_save:
                        self.send_json(200, runtime.export_user_notes_file_result())
                    else:
                        self.send_json(200, payload)
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
                export_profile_parts = self.user_export_profile_parts(parsed.path)
                if export_profile_parts == ["api", "v1", "user", "export-profiles"]:
                    self.send_json(200, runtime.list_export_profiles())
                    return
                if len(export_profile_parts) == 5 and export_profile_parts[:4] == ["api", "v1", "user", "export-profiles"]:
                    self.send_json(200, runtime.get_export_profile(export_profile_parts[4]))
                    return
                export_parts = self.user_export_parts(parsed.path)
                if len(export_parts) == 6 and export_parts[:4] == ["api", "v1", "user", "exports"] and export_parts[5] == "download":
                    download_path = runtime.export_job_download_path(export_parts[4])
                    if not download_path:
                        self.send_json(404, {"ok": False, "error": "export output not found"})
                        return
                    self.send_download(download_path)
                    return
                if len(export_parts) == 5 and export_parts[:4] == ["api", "v1", "user", "exports"]:
                    self.send_json(200, runtime.get_export_job(export_parts[4]))
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
                if parsed.path.startswith("/api/v1/mcp/"):
                    self.handle_mcp_control("POST", parsed.path)
                    return
                workspace_parts = self.user_workspace_parts(parsed.path)
                is_workspace_create = workspace_parts == ["api", "v1", "user", "workspaces"]
                is_workspace_item_create = len(workspace_parts) == 6 and workspace_parts[:4] == ["api", "v1", "user", "workspaces"] and workspace_parts[5] == "items"
                parts = self.user_data_basket_parts(parsed.path)
                is_data_basket_create = parts == ["api", "v1", "user", "data-baskets"]
                is_data_basket_item_create = len(parts) == 6 and parts[:4] == ["api", "v1", "user", "data-baskets"] and parts[5] == "items"
                export_profile_parts = self.user_export_profile_parts(parsed.path)
                is_export_profile_create = export_profile_parts == ["api", "v1", "user", "export-profiles"]
                export_parts = self.user_export_parts(parsed.path)
                is_export_preview_create = export_parts == ["api", "v1", "user", "exports", "preview"]
                is_export_execute = export_parts == ["api", "v1", "user", "exports"]
                is_markdown_export = export_parts == ["api", "v1", "user", "exports", "markdown"]
                maturity_write_paths = {
                    "/api/v1/maturity/calculate",
                    "/api/v1/maturity/template/validate",
                    "/api/v1/maturity/report",
                    "/api/v1/maturity/report/export",
                    "/api/v1/maturity/score/export",
                    "/api/v1/maturity/score/import",
                    "/api/v1/maturity/template/export",
                    "/api/v1/maturity/template/import",
                }
                is_maturity_write = parsed.path in maturity_write_paths
                if parsed.path not in {"/api/v1/user/favorites", "/api/v1/user/notes"} and not is_workspace_create and not is_workspace_item_create and not is_data_basket_create and not is_data_basket_item_create and not is_export_profile_create and not is_export_preview_create and not is_export_execute and not is_markdown_export and not is_maturity_write:
                    self.send_json(404, {"ok": False, "error": "not found"})
                    return
                auth_error = self.validate_write_request()
                if auth_error:
                    status, message = auth_error
                    self.send_json(status, {"ok": False, "error": message})
                    return
                length = int(self.headers.get("Content-Length", "0"))
                payload = json.loads(self.rfile.read(length).decode("utf-8") or "{}")
                if is_maturity_write:
                    if projection_api is None:
                        self.send_json(503, {"ok": False, "error": "maturity api unavailable"})
                    elif parsed.path == "/api/v1/maturity/calculate":
                        self.send_json(200, projection_api.create_envelope(projection_api.calculate_maturity_assessment(payload)))
                    elif parsed.path == "/api/v1/maturity/template/validate":
                        self.send_json(200, projection_api.create_envelope(projection_api.validate_maturity_template(payload.get("template") or payload)))
                    elif parsed.path == "/api/v1/maturity/report":
                        self.send_json(200, projection_api.create_envelope(projection_api.create_and_persist_maturity_report(payload)))
                    elif parsed.path == "/api/v1/maturity/report/export":
                        self.send_json(200, projection_api.create_envelope(projection_api.export_maturity_report_file(payload)))
                    elif parsed.path == "/api/v1/maturity/score/export":
                        self.send_json(200, projection_api.create_envelope(projection_api.export_maturity_score_exchange_for_runtime(payload)))
                    elif parsed.path == "/api/v1/maturity/score/import":
                        self.send_json(200, projection_api.create_envelope(projection_api.import_maturity_score_exchange(payload)))
                    elif parsed.path == "/api/v1/maturity/template/export":
                        self.send_json(200, projection_api.create_envelope(projection_api.export_maturity_template_exchange_for_runtime(payload)))
                    else:
                        self.send_json(200, projection_api.create_envelope(projection_api.import_maturity_template_exchange(payload)))
                elif parsed.path == "/api/v1/user/notes":
                    self.send_json(200, runtime.add_note(payload))
                elif is_workspace_create:
                    self.send_json(200, runtime.create_workspace(payload))
                elif is_workspace_item_create:
                    self.send_json(200, runtime.add_workspace_item(workspace_parts[4], payload))
                elif is_data_basket_create:
                    self.send_json(200, runtime.create_data_basket(payload))
                elif is_data_basket_item_create:
                    self.send_json(200, runtime.add_data_basket_item(parts[4], payload))
                elif is_export_profile_create:
                    self.send_json(200, runtime.create_export_profile(payload))
                elif is_export_preview_create:
                    self.send_json(200, runtime.create_export_preview(payload))
                elif is_export_execute:
                    self.send_json(200, runtime.execute_export_job(payload))
                elif is_markdown_export:
                    self.send_json(200, runtime.save_markdown_export(payload))
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
                export_profile_parts = self.user_export_profile_parts(parsed.path)
                is_export_profile_delete = len(export_profile_parts) == 5 and export_profile_parts[:4] == ["api", "v1", "user", "export-profiles"]
                if parsed.path != "/api/v1/user/favorites" and not parsed.path.startswith("/api/v1/user/notes/") and not is_workspace_delete and not is_workspace_item_delete and not is_data_basket_delete and not is_data_basket_item_delete and not is_export_profile_delete:
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
                elif is_export_profile_delete:
                    self.send_json(200, runtime.delete_export_profile(export_profile_parts[4]))
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
    configure_projection_api(runtime)
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
        "import_directory": str(runtime.import_dir),
        "export_directory": str(runtime.export_dir),
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
    parser.add_argument("--export-user-notes", action="store_true", help="Export user notes and exit.")
    args = parser.parse_args()

    root = args.bundle_root.resolve()
    logger = RuntimeLogger(root / "logs" / "runtime.log")
    if args.export_diagnostics:
        output = export_diagnostics(root)
        print(f"diagnostics={output}")
        return 0
    if args.export_user_notes:
        try:
            runtime = BundleRuntime(root, logger)
            output = runtime.export_user_notes_file()
            print(f"user_notes_export={output}")
            return 0
        except Exception as error:  # noqa: BLE001 - command should explain local export failures.
            logger.write("error", "user notes export failed", error=str(error))
            print(f"user_notes_export_error={error}")
            return 2
    if args.check_only:
        result = perform_startup_check(root, logger)
        print(json.dumps(result, ensure_ascii=False, indent=2))
        return 0 if result["ok"] else 1
    return run_server(root, no_browser=args.no_browser)


if __name__ == "__main__":
    if getattr(sys, "frozen", False):
        os.chdir(Path(sys.executable).resolve().parent)
    raise SystemExit(main())
