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
                return 415, "POST writes require Content-Type: application/json"
            token = self.headers.get(AUTH_HEADER, "").strip()
            if not token or not secrets.compare_digest(token, session_token):
                return 403, f"POST writes require a valid {AUTH_HEADER} header"
            port = int(state["port"])
            if not is_allowed_host_header(self.headers.get("Host", ""), port):
                return 403, "invalid Host header"
            origin = self.headers.get("Origin", "").strip()
            if origin and not is_allowed_loopback_origin(origin, port):
                return 403, "cross-origin POST is not allowed"
            referer = self.headers.get("Referer", "").strip()
            if not origin and referer and not is_allowed_loopback_origin(referer, port):
                return 403, "cross-origin POST referer is not allowed"
            return None

        def do_POST(self) -> None:
            parsed = urlparse(self.path)
            try:
                if parsed.path != "/api/v1/user/favorites":
                    self.send_json(404, {"ok": False, "error": "not found"})
                    return
                auth_error = self.validate_write_request()
                if auth_error:
                    status, message = auth_error
                    self.send_json(status, {"ok": False, "error": message})
                    return
                length = int(self.headers.get("Content-Length", "0"))
                payload = json.loads(self.rfile.read(length).decode("utf-8") or "{}")
                self.send_json(200, runtime.add_favorite(payload))
            except ValueError as error:
                self.send_json(400, {"ok": False, "error": str(error)})
            except Exception as error:  # noqa: BLE001
                runtime.logger.write("error", "post failed", path=parsed.path, error=str(error))
                self.send_json(500, {"ok": False, "error": str(error)})

        def do_DELETE(self) -> None:
            parsed = urlparse(self.path)
            try:
                if parsed.path != "/api/v1/user/favorites":
                    self.send_json(404, {"ok": False, "error": "not found"})
                    return
                auth_error = self.validate_write_request()
                if auth_error:
                    status, message = auth_error
                    self.send_json(status, {"ok": False, "error": message})
                    return
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
