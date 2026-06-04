from __future__ import annotations

import argparse
import json
import sqlite3
import uuid
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any
from urllib.parse import parse_qs, unquote, urlparse

from .paths import PROJECT_ROOT, resolve_project_path


DATA_PACKAGES = {
    "capability": "frontend/capability-browser/public/data/capability-tree.json",
    "capability-workbench": "frontend/capability-browser/public/data/capability-workbench.json",
    "environment-workbench": "frontend/capability-browser/public/data/environment-workbench.json",
    "lifecycle-workbench": "frontend/capability-browser/public/data/lifecycle-workbench.json",
    "maintenance-index": "frontend/capability-browser/public/data/maintenance-index.json",
    "maintenance": "frontend/capability-browser/public/data/maintenance-knowledge.json",
    "maintenance-scopes": "frontend/capability-browser/public/data/maintenance/scopes.json",
    "maintenance-services": "frontend/capability-browser/public/data/maintenance/services.json",
    "maintenance-modules": "frontend/capability-browser/public/data/maintenance/modules.json",
    "maintenance-measures": "frontend/capability-browser/public/data/maintenance/measures.json",
    "maintenance-processes": "frontend/capability-browser/public/data/maintenance/processes.json",
    "maintenance-work-functions": "frontend/capability-browser/public/data/maintenance/work-functions.json",
    "maintenance-references": "frontend/capability-browser/public/data/maintenance/references.json",
    "shared-lookups": "frontend/capability-browser/public/data/shared-lookups.json",
    "lifecycle": "frontend/capability-browser/public/data/lifecycle-knowledge.json",
    "content": "frontend/capability-browser/public/data/content-views.json",
    "security-architecture-design-guide": "frontend/capability-browser/public/data/guides/security-architecture-design.json",
    "data-security-design-guide": "frontend/capability-browser/public/data/guides/data-security-design.json",
    "light-planning-guide": "frontend/capability-browser/public/data/guides/light-planning.json",
    "standards": "frontend/capability-browser/public/data/standards-index.json",
    "standards-index": "frontend/capability-browser/public/data/standards-index.json",
}

MAINTENANCE_SECTIONS = (
    "scopes",
    "services",
    "processes",
    "work-functions",
    "security-works",
    "modules",
    "measures",
    "application-systems",
    "lcap-references",
    "references",
    "standards",
)

FRONTEND_PUBLIC_DATA_ROOT = (PROJECT_ROOT / "frontend" / "capability-browser" / "public" / "data").resolve()
USER_DB_PATH = (PROJECT_ROOT / "data" / "user" / "sapd_wiki_user.sqlite3").resolve()
USER_SCHEMA_VERSION = "user_schema_0.2"
USER_SCHEMA_SQL = """
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS user_meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS user_favorites (
  id TEXT PRIMARY KEY,
  target_ref TEXT NOT NULL,
  note TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(target_ref)
);

CREATE TABLE IF NOT EXISTS user_notes (
  id TEXT PRIMARY KEY,
  target_ref TEXT NOT NULL,
  body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'todo',
  page_route TEXT,
  page_title TEXT,
  anchor_type TEXT NOT NULL DEFAULT 'object',
  object_type TEXT,
  object_title TEXT,
  tags_json TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS user_tags (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  color TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS user_item_tags (
  id TEXT PRIMARY KEY,
  target_ref TEXT NOT NULL,
  tag_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(target_ref, tag_id),
  FOREIGN KEY(tag_id) REFERENCES user_tags(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS user_custom_items (
  id TEXT PRIMARY KEY,
  item_type TEXT NOT NULL,
  title TEXT NOT NULL,
  code TEXT,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  source_ref TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS user_custom_relations (
  id TEXT PRIMARY KEY,
  relation_type TEXT NOT NULL,
  source_ref TEXT NOT NULL,
  target_ref TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS user_import_jobs (
  id TEXT PRIMARY KEY,
  import_type TEXT NOT NULL,
  source_path TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  summary TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS user_change_logs (
  id TEXT PRIMARY KEY,
  action TEXT NOT NULL,
  target_ref TEXT,
  payload_json TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS user_schema_migrations (
  version TEXT PRIMARY KEY,
  applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
"""

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


def ensure_user_note_columns(connection: sqlite3.Connection) -> None:
    rows = connection.execute("PRAGMA table_info(user_notes)").fetchall()
    existing = {row[1] for row in rows}
    for column, definition in USER_NOTE_COLUMNS.items():
        if column not in existing:
            connection.execute(f"ALTER TABLE user_notes ADD COLUMN {column} {definition}")


def _list(value: Any) -> list[Any]:
    return value if isinstance(value, list) else []


def _read_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def _data_package_path(name: str) -> Path:
    if name not in DATA_PACKAGES:
        raise KeyError(name)
    return resolve_project_path(DATA_PACKAGES[name])


def read_data_package(name: str) -> dict[str, Any]:
    if name == "standards":
        return read_standards_compat_package()
    path = _data_package_path(name)
    if not path.exists():
        return {"generated_at": None, "stats": {}, "__data_state": "missing_file"}
    data = _read_json(path)
    if isinstance(data, dict):
        return data
    return {"generated_at": None, "items": data}


def _frontend_data_path(data_path: Any) -> Path | None:
    if not data_path:
        return None
    normalized = str(data_path).strip()
    if not normalized:
        return None
    if normalized.startswith("./"):
        normalized = normalized[2:]
    if "://" in normalized or normalized.startswith(("/", "\\")):
        return None
    if normalized.startswith("public/data/"):
        normalized = normalized.removeprefix("public/data/")
    elif normalized.startswith("frontend/capability-browser/public/data/"):
        normalized = normalized.removeprefix("frontend/capability-browser/public/data/")
    else:
        return None
    relative = Path(normalized)
    if relative.is_absolute() or any(part in {"", ".", ".."} for part in relative.parts):
        return None
    path = (FRONTEND_PUBLIC_DATA_ROOT / relative).resolve()
    try:
        path.relative_to(FRONTEND_PUBLIC_DATA_ROOT)
    except ValueError:
        return None
    return path


def _read_split_payload(data_path: Any) -> dict[str, Any] | None:
    path = _frontend_data_path(data_path)
    if not path or not path.exists():
        return None
    payload = _read_json(path)
    return payload if isinstance(payload, dict) else None


def read_standards_compat_package() -> dict[str, Any]:
    path = _data_package_path("standards-index")
    if not path.exists():
        return {"generated_at": None, "stats": {}, "__data_state": "missing_file"}
    index = _read_json(path)
    if not isinstance(index, dict):
        return {"generated_at": None, "stats": {}, "__data_state": "invalid_file"}

    frameworks: list[dict[str, Any]] = []
    for framework in _list(index.get("frameworks")):
        if not isinstance(framework, dict):
            continue
        assembled = dict(framework)
        payload = _read_split_payload(assembled.get("dataPath"))
        if payload:
            assembled.update(payload)
            assembled["loaded"] = True
        elif _list(assembled.get("tabs")):
            tabs: list[dict[str, Any]] = []
            for tab in _list(assembled.get("tabs")):
                if not isinstance(tab, dict):
                    continue
                assembled_tab = dict(tab)
                tab_payload = _read_split_payload(assembled_tab.get("dataPath"))
                if tab_payload:
                    assembled_tab.update(tab_payload)
                    assembled_tab["loaded"] = True
                tabs.append(assembled_tab)
            assembled["tabs"] = tabs
            assembled["loaded"] = True
        frameworks.append(assembled)

    return {
        **index,
        "package_type": "standards-full-compat",
        "frameworks": frameworks,
    }


def create_envelope(data: Any, warnings: list[str] | None = None) -> dict[str, Any]:
    warning_list = warnings or []
    generated_at = data.get("generated_at") if isinstance(data, dict) else None
    return {
        "meta": {
            "version": "v1",
            "generated_at": generated_at,
            "data_version": generated_at,
            "warnings_count": len(warning_list),
        },
        "data": data,
        "warnings": warning_list,
    }


def ensure_user_db() -> None:
    USER_DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    with sqlite3.connect(USER_DB_PATH) as connection:
        connection.executescript(USER_SCHEMA_SQL)
        ensure_user_note_columns(connection)
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
            INSERT INTO user_meta(key, value, updated_at)
            VALUES ('created_by', 'sapd-wiki-local-api', CURRENT_TIMESTAMP)
            ON CONFLICT(key) DO NOTHING
            """
        )
        connection.execute(
            """
            INSERT INTO user_schema_migrations(version)
            VALUES (?)
            ON CONFLICT(version) DO NOTHING
            """,
            (USER_SCHEMA_VERSION,),
        )


def user_db_connection() -> sqlite3.Connection:
    ensure_user_db()
    connection = sqlite3.connect(USER_DB_PATH)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys = ON")
    return connection


def list_user_favorites() -> dict[str, Any]:
    with user_db_connection() as connection:
        rows = connection.execute(
            """
            SELECT id, target_ref, note, created_at, updated_at
            FROM user_favorites
            ORDER BY updated_at DESC
            """
        ).fetchall()
    return {"ok": True, "data_state": "ready", "favorites": [dict(row) for row in rows]}


def upsert_user_favorite(payload: dict[str, Any]) -> dict[str, Any]:
    target_ref = str(payload.get("target_ref") or "").strip()
    if not target_ref:
        raise ValueError("target_ref is required")
    note_value = payload.get("note")
    note = None if note_value is None else str(note_value)
    favorite_id = str(uuid.uuid4())
    change_id = str(uuid.uuid4())
    change_payload = json.dumps({"target_ref": target_ref, "note": note}, ensure_ascii=False)
    with user_db_connection() as connection:
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
    return {"ok": True, "favorite": dict(row) if row else None}


def delete_user_favorite(target_ref: str) -> dict[str, Any]:
    normalized = str(target_ref or "").strip()
    if not normalized:
        raise ValueError("target_ref is required")
    with user_db_connection() as connection:
        cursor = connection.execute("DELETE FROM user_favorites WHERE target_ref = ?", (normalized,))
        deleted = cursor.rowcount
        connection.execute(
            """
            INSERT INTO user_change_logs(id, action, target_ref, payload_json)
            VALUES (?, 'delete_favorite', ?, ?)
            """,
            (str(uuid.uuid4()), normalized, json.dumps({"target_ref": normalized, "deleted": deleted}, ensure_ascii=False)),
        )
    return {"ok": True, "deleted": deleted}


def normalize_note_status(value: Any) -> str:
    status = str(value or "todo").strip() or "todo"
    return status if status in USER_NOTE_STATUSES else "todo"


def normalize_tags_json(value: Any) -> str | None:
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


def note_row_to_dict(row: sqlite3.Row | None) -> dict[str, Any] | None:
    if not row:
        return None
    item = dict(row)
    try:
        item["tags"] = json.loads(item.get("tags_json") or "[]")
    except json.JSONDecodeError:
        item["tags"] = []
    item.pop("tags_json", None)
    return item


def list_user_notes(query: dict[str, list[str]]) -> dict[str, Any]:
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
    with user_db_connection() as connection:
        rows = connection.execute(
            f"""
            SELECT {USER_NOTE_SELECT_COLUMNS}
            FROM user_notes
            {where}
            ORDER BY updated_at DESC
            """,
            params,
        ).fetchall()
    return {"ok": True, "data_state": "ready", "notes": [note_row_to_dict(row) for row in rows]}


def create_user_note(payload: dict[str, Any]) -> dict[str, Any]:
    target_ref = str(payload.get("target_ref") or "").strip()
    body = str(payload.get("body") or "").strip()
    if not target_ref:
        raise ValueError("target_ref is required")
    if not body:
        raise ValueError("body is required")
    note_id = str(uuid.uuid4())
    status = normalize_note_status(payload.get("status"))
    page_route = str(payload.get("page_route") or "").strip() or None
    page_title = str(payload.get("page_title") or "").strip() or None
    anchor_type = str(payload.get("anchor_type") or "object").strip() or "object"
    object_type = str(payload.get("object_type") or "").strip() or None
    object_title = str(payload.get("object_title") or "").strip() or None
    tags_json = normalize_tags_json(payload.get("tags"))
    change_payload = json.dumps(
        {
            "target_ref": target_ref,
            "status": status,
            "page_route": page_route,
            "anchor_type": anchor_type,
            "object_type": object_type,
            "object_title": object_title,
            "tags": json.loads(tags_json or "[]"),
        },
        ensure_ascii=False,
    )
    with user_db_connection() as connection:
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
            (str(uuid.uuid4()), target_ref, change_payload),
        )
    return {"ok": True, "note": note_row_to_dict(row)}


def update_user_note(note_id: str, payload: dict[str, Any]) -> dict[str, Any]:
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
        allowed_fields["status"] = normalize_note_status(payload.get("status"))
    if "tags" in payload:
        allowed_fields["tags_json"] = normalize_tags_json(payload.get("tags"))
    if not allowed_fields:
        raise ValueError("no supported fields to update")
    assignments = ", ".join(f"{field} = ?" for field in allowed_fields)
    values = list(allowed_fields.values())
    with user_db_connection() as connection:
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
    return {"ok": True, "note": note_row_to_dict(row)}


def delete_user_note(note_id: str) -> dict[str, Any]:
    normalized_id = str(note_id or "").strip()
    if not normalized_id:
        raise ValueError("id is required")
    with user_db_connection() as connection:
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
    return {"ok": True, "deleted": deleted}


def _title_of(value: Any, fallback: str = "未命名") -> str:
    if not value:
        return fallback
    if isinstance(value, dict):
        return str(value.get("title") or value.get("name") or value.get("code") or value.get("id") or fallback)
    return str(value)


def _identity_of(value: Any, fallback: str = "unknown") -> str:
    if isinstance(value, dict):
        return str(value.get("id") or value.get("name") or value.get("title") or value.get("code") or fallback).strip()
    return str(value or fallback).strip()


def _entity_key(value: Any) -> str:
    if isinstance(value, dict):
        return str(value.get("id") or value.get("code") or value.get("title") or value.get("name") or "").strip()
    return str(value or "").strip()


def _unique_by(items: list[Any], key_name: str | None = None) -> list[Any]:
    rows: list[Any] = []
    seen: set[str] = set()
    for item in items:
        if key_name and isinstance(item, dict):
            key = str(item.get(key_name) or "").strip()
        else:
            key = _entity_key(item)
        if not key or key in seen:
            continue
        seen.add(key)
        rows.append(item)
    return rows


def _compact_entity(item: Any, fallback: str = "未命名") -> dict[str, Any] | None:
    if not isinstance(item, dict):
        return None
    return {
        "id": item.get("id") or item.get("code") or _title_of(item, fallback),
        "type": item.get("type") or item.get("object_type") or "",
        "code": item.get("code") or "",
        "title": _title_of(item, fallback),
        "name": item.get("name") or "",
        "description": item.get("description") or item.get("summary") or "",
        "layer": item.get("layer") or "",
        "status": item.get("status") or item.get("state") or "",
    }


def _compact_stakeholder(stakeholder: Any, layer: str = "") -> dict[str, Any] | None:
    compact = _compact_entity(stakeholder, "未命名职能")
    if compact is not None:
        compact["layer"] = layer or compact.get("layer") or ""
    return compact


def _service_identity(service: Any) -> str:
    return _identity_of(service, _title_of(service, "未命名服务"))


def _is_applicable_service(service: Any) -> bool:
    identity = _service_identity(service)
    title = _title_of(service, "")
    normalized = f"{identity} {title}".strip().lower()
    return bool(normalized) and normalized not in {"/", "n/a", "na", "none", "not applicable", "无", "不适用"}


def _entity_tokens(item: Any) -> list[str]:
    if not isinstance(item, dict):
        return [str(item).strip()] if item else []
    return [str(item.get(key) or "").strip() for key in ("id", "code", "title", "name") if str(item.get(key) or "").strip()]


def _entity_token_matches(left: Any, right: Any) -> bool:
    left_tokens = set(_entity_tokens(left))
    right_tokens = set(_entity_tokens(right))
    return bool(left_tokens and right_tokens and left_tokens.intersection(right_tokens))


def _service_module_index(management: dict[str, Any], service: dict[str, Any]) -> dict[str, Any] | None:
    for entry in _list(management.get("service_module_index")):
        entry_service = entry.get("service") or {}
        if service.get("id") and entry_service.get("id") == service.get("id"):
            return entry
        if service.get("code") and entry_service.get("code") == service.get("code"):
            return entry
        if service.get("title") and entry_service.get("title") == service.get("title"):
            return entry
    return None


def _modules_for_services(management: dict[str, Any], services: list[dict[str, Any]]) -> list[dict[str, Any]]:
    modules: list[dict[str, Any]] = []
    for service in services:
        entry = _service_module_index(management, service) or {}
        modules.extend(_list(entry.get("modules")))
    return _unique_by(modules)


def _measures_for_services_and_scope(
    management: dict[str, Any],
    services: list[dict[str, Any]],
    scope: dict[str, Any],
) -> list[dict[str, Any]]:
    service_rows = [service for service in services if _is_applicable_service(service)]
    if not service_rows:
        return []
    measures: list[dict[str, Any]] = []
    for measure in _list(management.get("security_technical_measures")):
        related_services = [
            *_list(measure.get("related_services")),
            *_list(measure.get("services")),
            *_list(measure.get("technical_services")),
            *[{"title": title} for title in _list(measure.get("related_service_names"))],
        ]
        related_scopes = [
            *_list(measure.get("applicable_scopes")),
            *_list(measure.get("scopes")),
            *_list(measure.get("scope_types")),
            *[{"title": title} for title in _list(measure.get("related_scope_names"))],
        ]
        service_matched = any(_entity_token_matches(measure_service, service) for measure_service in related_services for service in service_rows)
        scope_matched = not scope or not related_scopes or any(_entity_token_matches(measure_scope, scope) for measure_scope in related_scopes)
        if service_matched and scope_matched:
            measures.append(measure)
    return _unique_by(measures)


def _compact_technical_object(item: dict[str, Any], fallback_kind: str = "安全技术模块") -> dict[str, Any]:
    is_measure = item.get("type") == "security_technical_measure" or bool(item.get("name") or item.get("measureName"))
    return {
        "id": item.get("id") or item.get("code") or item.get("title") or item.get("name") or "",
        "type": item.get("type") or ("security_technical_measure" if is_measure else "security_technology_module"),
        "code": item.get("code") or "",
        "title": item.get("title") or item.get("name") or item.get("measureName") or "未命名",
        "name": item.get("name") or "",
        "objectKind": "安全技术措施" if is_measure else fallback_kind,
        "category": item.get("category") or item.get("kind") or "",
        "status": item.get("status") or "",
    }


def _compact_projection_focus(focus: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": focus.get("id") or "",
        "code": focus.get("code") or "",
        "name": _title_of(focus, ""),
        "description": focus.get("description") or focus.get("summary") or "",
    }


def _source_evidence_key(source: Any) -> str:
    if not isinstance(source, dict):
        return str(source or "")
    return (
        ":".join(
            str(source.get(key) or "")
            for key in ("file", "source_file", "sheet", "row", "cell", "path", "location", "column")
            if source.get(key) is not None
        )
        or json.dumps(source, ensure_ascii=False, sort_keys=True)
    )


def _source_evidence_from_items(items: list[Any]) -> list[dict[str, Any]]:
    sources: list[dict[str, Any]] = []
    for item in items:
        if not isinstance(item, dict):
            continue
        sources.extend(source for source in _list(item.get("sources")) if isinstance(source, dict))
        sources.extend(source for source in _list(item.get("mapping_sources")) if isinstance(source, dict))
    rows: list[dict[str, Any]] = []
    seen: set[str] = set()
    for source in sources:
        key = _source_evidence_key(source)
        if not key or key in seen:
            continue
        seen.add(key)
        rows.append(source)
    return rows


def _compact_scope_service_pair(row: dict[str, Any], service: dict[str, Any] | None, status: str) -> dict[str, Any]:
    scope = row.get("scope") or {}
    return {
        "scopeId": scope.get("id") or "",
        "scopeCode": scope.get("code") or "",
        "scopeName": _title_of(scope, ""),
        "serviceId": service.get("id") if service else "",
        "serviceCode": service.get("code") if service else "",
        "serviceName": _title_of(service, "") if service else "",
        "status": status,
    }


def _layer_key(layer: str) -> str:
    normalized = str(layer or "").strip().lower()
    if normalized in {"decision", "决策层", "网络安全决策层"}:
        return "decision"
    if normalized in {"management", "管理层", "网络安全管理层"}:
        return "management"
    if normalized in {"execution", "执行层", "网络安全执行层"}:
        return "execution"
    if normalized in {"supervision", "监督层", "网络安全监督层"}:
        return "supervision"
    return "unknown"


def _empty_work_functions_by_layer() -> dict[str, list[dict[str, Any]]]:
    return {"decision": [], "management": [], "execution": [], "supervision": [], "unknown": []}


def _process_tree_for_focus(focus: dict[str, Any]) -> list[dict[str, Any]]:
    groups: dict[str, dict[str, Any]] = {}
    for mapping in _list(focus.get("process_mappings")):
        process_group = mapping.get("process_group") or {}
        group_key = _entity_key(process_group) or "unknown"
        group = groups.setdefault(
            group_key,
            {
                "l2ProcessGroup": _compact_entity(process_group, "待确认流程组") or {
                    "id": "unknown",
                    "type": "process_group",
                    "code": "",
                    "title": "待确认流程组",
                    "name": "",
                    "description": "",
                    "layer": "",
                    "status": "",
                },
                "l3Processes": [],
                "_l3Index": {},
            },
        )
        process_reference = mapping.get("process_reference") or {}
        process_key = _entity_key(process_reference) or f"{group_key}:unknown"
        process_index = group["_l3Index"]
        process = process_index.get(process_key)
        if process is None:
            process = {
                "id": process_reference.get("id") or process_key,
                "code": process_reference.get("code") or "",
                "name": _title_of(process_reference, "待确认流程"),
                "description": process_reference.get("description") or process_reference.get("summary") or "",
                "activities": [],
            }
            process_index[process_key] = process
            group["l3Processes"].append(process)
        process["activities"] = _unique_by(
            [
                *process["activities"],
                *[
                    {
                        "id": activity.get("id") or activity.get("code") or _title_of(activity, "待确认活动"),
                        "code": activity.get("code") or "",
                        "name": _title_of(activity, "待确认活动"),
                        "description": activity.get("description") or activity.get("summary") or "",
                        "status": activity.get("status") or activity.get("state") or "",
                    }
                    for activity in _list(mapping.get("activities"))
                    if isinstance(activity, dict)
                ],
            ]
        )
    rows: list[dict[str, Any]] = []
    for group in groups.values():
        group.pop("_l3Index", None)
        rows.append(group)
    return rows


def _all_focuses(capability: dict[str, Any]) -> list[dict[str, Any]]:
    return [
        focus
        for category in _list(capability.get("categories"))
        for domain in _list(category.get("domains"))
        for cap in _list(domain.get("capabilities"))
        for focus in _list(cap.get("focuses"))
    ]


CAPABILITY_OBJECT_TYPES = {
    "category": "capability_category",
    "capability_category": "capability_category",
    "l0": "capability_category",
    "domain": "capability_domain",
    "capability_domain": "capability_domain",
    "l1": "capability_domain",
    "capability": "capability",
    "l2": "capability",
    "focus": "capability_focus",
    "capability_focus": "capability_focus",
    "l3": "capability_focus",
}

CAPABILITY_GRAPH_SCOPES = {
    "capability_category": "category",
    "capability_domain": "domain",
    "capability": "capability",
    "capability_focus": "focus",
}


def _normalize_capability_object_type(object_type: str | None) -> str:
    return CAPABILITY_OBJECT_TYPES.get(str(object_type or "").strip(), "")


def _capability_object_code(item: dict[str, Any], object_type: str = "") -> str:
    code = str(item.get("code") or "").strip()
    if code:
        return code
    if object_type == "capability_category":
        title = _title_of(item, "")
        tail = title.split()[-1] if title.split() else ""
        if tail in {"T", "G", "M"}:
            return tail
    return ""


def _capability_object_matches(item: dict[str, Any], object_id: str | None) -> bool:
    normalized = str(object_id or "").strip()
    if not normalized or not isinstance(item, dict):
        return False
    return normalized in {str(item.get("id") or "").strip(), _capability_object_code(item, str(item.get("type") or ""))}


def _compact_projection_object(item: dict[str, Any], object_type: str) -> dict[str, Any]:
    compact = _compact_entity({**item, "type": object_type}, "未命名能力对象") or {}
    return {
        "id": compact.get("id") or "",
        "type": object_type,
        "code": compact.get("code") or _capability_object_code(item, object_type),
        "name": compact.get("title") or compact.get("name") or "",
        "title": compact.get("title") or compact.get("name") or "",
        "description": compact.get("description") or "",
    }


def _find_capability_projection_object(
    capability: dict[str, Any],
    object_type: str,
    object_id: str | None,
) -> tuple[dict[str, Any] | None, dict[str, Any]]:
    for category in _list(capability.get("categories")):
        category_path = {"category": category}
        if object_type == "capability_category" and _capability_object_matches(category, object_id):
            return category, category_path
        for domain in _list(category.get("domains")):
            domain_path = {**category_path, "domain": domain}
            if object_type == "capability_domain" and _capability_object_matches(domain, object_id):
                return domain, domain_path
            for cap in _list(domain.get("capabilities")):
                capability_path = {**domain_path, "capability": cap}
                if object_type == "capability" and _capability_object_matches(cap, object_id):
                    return cap, capability_path
                for focus in _list(cap.get("focuses")):
                    focus_path = {**capability_path, "focus": focus}
                    if object_type == "capability_focus" and _capability_object_matches(focus, object_id):
                        return focus, focus_path
    return None, {}


def _focuses_for_projection_object(item: dict[str, Any], object_type: str) -> list[dict[str, Any]]:
    if object_type == "capability_category":
        return [
            focus
            for domain in _list(item.get("domains"))
            for cap in _list(domain.get("capabilities"))
            for focus in _list(cap.get("focuses"))
        ]
    if object_type == "capability_domain":
        return [focus for cap in _list(item.get("capabilities")) for focus in _list(cap.get("focuses"))]
    if object_type == "capability":
        return _list(item.get("focuses"))
    if object_type == "capability_focus":
        return [item]
    return []


def _focus_matches(focus: dict[str, Any] | None, focus_id: str | None) -> bool:
    normalized = str(focus_id or "").strip()
    if not normalized or not isinstance(focus, dict):
        return False
    return normalized in {str(focus.get("id") or "").strip(), str(focus.get("code") or "").strip()}


def _stakeholders_from_mappings(process_mappings: list[dict[str, Any]]) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for mapping in process_mappings:
        stakeholders = mapping.get("stakeholders") or {}
        if not isinstance(stakeholders, dict):
            continue
        for layer, layer_stakeholders in stakeholders.items():
            for stakeholder in _list(layer_stakeholders):
                compact = _compact_stakeholder(stakeholder, layer)
                if compact:
                    rows.append(compact)
    return _unique_by(rows)


def _capability_technical_mapping_rows(capability: dict[str, Any], management: dict[str, Any]) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for focus in _all_focuses(capability):
        grouped: dict[str, dict[str, Any]] = {}
        for mapping in _list(focus.get("scope_mappings")):
            scope = mapping.get("scope") or {}
            key = f"{_identity_of(focus, _title_of(focus, '未命名关注点'))}::{_identity_of(scope, _title_of(scope, '未命名作用域'))}"
            group = grouped.setdefault(key, {"focus": focus, "scope": scope, "mappings": [], "services": [], "service_count": 0})
            group["mappings"].append(mapping)
            group["services"].extend([service for service in _list(mapping.get("services")) if _is_applicable_service(service)])
            group["service_count"] += int(mapping.get("service_count") or len(_list(mapping.get("services"))) or 0)
        for group in grouped.values():
            candidate_services = _unique_by(group["services"])
            is_explicit_no_service = any(mapping.get("status") == "no_service" for mapping in group["mappings"]) or not candidate_services
            is_ambiguous = len(candidate_services) > 1
            confirmed_services = [] if is_ambiguous else candidate_services
            modules = [] if is_ambiguous else _modules_for_services(management, confirmed_services)
            measures = [] if is_ambiguous else _measures_for_services_and_scope(management, confirmed_services, group["scope"])
            technology_modules = [_compact_technical_object(module, "安全技术模块") for module in modules]
            technical_measures = [_compact_technical_object({**measure, "type": "security_technical_measure"}, "安全技术措施") for measure in measures]
            status = "ambiguous_service_mapping" if is_ambiguous else "covered" if confirmed_services else "no_service"
            rows.append(
                {
                    "focus": _compact_entity(group["focus"]),
                    "scope": _compact_entity(group["scope"], "未命名作用域"),
                    "services": [_compact_entity(service) for service in confirmed_services],
                    "candidateServices": [_compact_entity(service) for service in candidate_services],
                    "technologyModules": technology_modules,
                    "technicalMeasures": technical_measures,
                    "modules": [*technology_modules, *technical_measures],
                    "serviceCount": group["service_count"] or len(candidate_services),
                    "status": status,
                    "exceptionType": "ambiguous_service_mapping" if is_ambiguous else "",
                    "exceptionMessage": "同一关注点与同一作用域下出现多个候选安全技术服务，需要后端/ETL确认，前端不自动选择。" if is_ambiguous else "",
                    "isExplicitNoService": is_explicit_no_service,
                }
            )
    return rows


def _capability_management_mapping_rows(capability: dict[str, Any]) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for focus in _all_focuses(capability):
        process_mappings = _list(focus.get("process_mappings"))
        security_works = _unique_by(_list(focus.get("security_works")))
        rows.append(
            {
                "focus": _compact_entity(focus),
                "securityWorks": [_compact_entity(work) for work in security_works],
                "stakeholders": _stakeholders_from_mappings(process_mappings),
                "processGroups": [_compact_entity(item) for item in _unique_by([mapping.get("process_group") for mapping in process_mappings]) if item],
                "processReferences": [_compact_entity(item) for item in _unique_by([mapping.get("process_reference") for mapping in process_mappings]) if item],
                "activities": [_compact_entity(item) for item in _unique_by([activity for mapping in process_mappings for activity in _list(mapping.get("activities"))]) if item],
                "activityStatusLabels": _unique_by(
                    [mapping.get("activity_status_label") or ("待补充" if mapping.get("missing_activity") else "暂无") for mapping in process_mappings],
                ),
                "hasMissingActivity": any(mapping.get("missing_activity") or mapping.get("activity_status") == "missing" for mapping in process_mappings),
            }
        )
    return rows


def _capability_local_relation_map(
    focus: dict[str, Any],
    technical_rows: list[dict[str, Any]],
    management_row: dict[str, Any] | None,
) -> dict[str, Any]:
    scope_service_pairs: list[dict[str, Any]] = []
    service_links_by_id: dict[str, dict[str, Any]] = {}
    for row in technical_rows:
        services = _list(row.get("services"))
        candidate_services = _list(row.get("candidateServices"))
        status = str(row.get("status") or "").strip() or "unknown"
        if services:
            for service in services:
                pair = _compact_scope_service_pair(row, service, status)
                scope_service_pairs.append(pair)
                service_key = service.get("id") or service.get("code") or service.get("title") or pair["serviceName"]
                link = service_links_by_id.setdefault(
                    service_key,
                    {
                        "serviceId": service.get("id") or "",
                        "serviceCode": service.get("code") or "",
                        "serviceName": _title_of(service, ""),
                        "scopes": [],
                        "modules": [],
                        "measures": [],
                        "status": status,
                    },
                )
                link["scopes"] = _unique_by([*link["scopes"], row.get("scope")])
                link["modules"] = _unique_by([*link["modules"], *_list(row.get("technologyModules"))])
                link["measures"] = _unique_by([*link["measures"], *_list(row.get("technicalMeasures"))])
                if link["status"] != "covered" or status != "covered":
                    link["status"] = status
        elif status == "ambiguous_service_mapping" and candidate_services:
            for service in candidate_services:
                scope_service_pairs.append(_compact_scope_service_pair(row, service, status))
        else:
            scope_service_pairs.append(_compact_scope_service_pair(row, None, status))

    service_module_measure_links = []
    for link in service_links_by_id.values():
        service_module_measure_links.append(
            {
                **link,
                "scopes": [_compact_entity(scope, "未命名作用域") for scope in _list(link["scopes"]) if scope],
                "modules": _list(link["modules"]),
                "measures": _list(link["measures"]),
            }
        )

    work_functions_by_layer = _empty_work_functions_by_layer()
    for stakeholder in _list((management_row or {}).get("stakeholders")):
        layer = _layer_key(stakeholder.get("layer") or "")
        work_functions_by_layer[layer].append(stakeholder)
    for key, rows in work_functions_by_layer.items():
        work_functions_by_layer[key] = _unique_by(rows)

    evidence_items: list[Any] = [
        focus,
        *_list(focus.get("security_works")),
        *_list(focus.get("scope_mappings")),
        *_list(focus.get("process_mappings")),
    ]
    for mapping in _list(focus.get("scope_mappings")):
        evidence_items.append(mapping.get("scope"))
        evidence_items.extend(_list(mapping.get("services")))
    for mapping in _list(focus.get("process_mappings")):
        evidence_items.append(mapping.get("process_group"))
        evidence_items.append(mapping.get("process_reference"))
        evidence_items.extend(_list(mapping.get("activities")))
        stakeholders = mapping.get("stakeholders") or {}
        if isinstance(stakeholders, dict):
            for layer_stakeholders in stakeholders.values():
                evidence_items.extend(_list(layer_stakeholders))

    source_evidence = _source_evidence_from_items(evidence_items)

    return {
        "focus": _compact_projection_focus(focus),
        "technical": {
            "scopeServicePairs": scope_service_pairs,
            "serviceModuleMeasureLinks": service_module_measure_links,
        },
        "management": {
            "securityWorks": _list((management_row or {}).get("securityWorks")),
            "workFunctionsByLayer": work_functions_by_layer,
            "processTree": _process_tree_for_focus(focus),
        },
        "sourceEvidence": source_evidence,
    }


def _capability_local_relation_maps(
    capability: dict[str, Any],
    technical_rows: list[dict[str, Any]],
    management_rows: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    technical_by_focus: dict[str, list[dict[str, Any]]] = {}
    for row in technical_rows:
        focus_id = (row.get("focus") or {}).get("id") or ""
        technical_by_focus.setdefault(focus_id, []).append(row)
    management_by_focus: dict[str, dict[str, Any]] = {
        (row.get("focus") or {}).get("id") or "": row for row in management_rows
    }
    return [
        _capability_local_relation_map(
            focus,
            technical_by_focus.get(focus.get("id") or "", []),
            management_by_focus.get(focus.get("id") or ""),
        )
        for focus in _all_focuses(capability)
    ]


def _graph_node(item: dict[str, Any], object_type: str, group: str = "capability", weight: int = 1) -> dict[str, Any]:
    selected = _compact_projection_object(item, object_type)
    return {
        "id": selected["id"],
        "type": selected["type"],
        "code": selected["code"],
        "name": selected["name"],
        "label": selected["name"] or selected["code"] or selected["id"],
        "group": group,
        "weight": weight,
    }


def _graph_edge(source: dict[str, Any], target: dict[str, Any], relation_type: str) -> dict[str, Any]:
    return {
        "id": f"{relation_type}:{source.get('id')}->{target.get('id')}",
        "source": source.get("id") or "",
        "target": target.get("id") or "",
        "type": relation_type,
    }


def _capability_projection_graph(
    selected_item: dict[str, Any],
    object_type: str,
    technical_rows: list[dict[str, Any]],
    management_rows: list[dict[str, Any]],
    standard_summary: dict[str, int],
) -> dict[str, Any]:
    center = _graph_node(selected_item, object_type, "current", 10)
    nodes: list[dict[str, Any]] = [center]
    edges: list[dict[str, Any]] = []

    def add_child(parent: dict[str, Any], item: dict[str, Any], child_type: str, relation_type: str, group: str = "capability") -> dict[str, Any]:
        node = _graph_node(item, child_type, group, 3)
        if not any(row["id"] == node["id"] for row in nodes):
            nodes.append(node)
        edges.append(_graph_edge(parent, node, relation_type))
        return node

    if object_type == "capability_category":
        for domain in _list(selected_item.get("domains")):
            domain_node = add_child(center, domain, "capability_domain", "category_to_domain")
            for cap in _list(domain.get("capabilities")):
                add_child(domain_node, cap, "capability", "domain_to_capability")
    elif object_type == "capability_domain":
        for cap in _list(selected_item.get("capabilities")):
            cap_node = add_child(center, cap, "capability", "domain_to_capability")
            for focus in _list(cap.get("focuses")):
                add_child(cap_node, focus, "capability_focus", "capability_to_focus", "focus_overview")
    elif object_type == "capability":
        for focus in _list(selected_item.get("focuses")):
            add_child(center, focus, "capability_focus", "capability_to_focus", "focus_overview")
        for key, label, count in (
            ("technical", "技术视角", len(technical_rows)),
            ("management", "管理视角", len(management_rows)),
            ("standards", "标准 / 框架", standard_summary.get("standard_controls", 0)),
        ):
            if count:
                node = {"id": f"{center['id']}:{key}", "type": f"{key}_overview", "code": "", "name": label, "label": label, "group": key, "weight": 5, "count": count}
                nodes.append(node)
                edges.append(_graph_edge(center, node, f"capability_to_{key}_overview"))
    elif object_type == "capability_focus":
        for key, label, count in (
            ("technical", "技术视角", len(technical_rows)),
            ("management", "管理视角", len(management_rows)),
            ("standards", "标准 / 框架", standard_summary.get("standard_controls", 0)),
        ):
            if count:
                node = {"id": f"{center['id']}:{key}", "type": f"{key}_view", "code": "", "name": label, "label": label, "group": key, "weight": 5, "count": count}
                nodes.append(node)
                edges.append(_graph_edge(center, node, f"focus_to_{key}_view"))

    return {
        "center": center,
        "nodes": nodes,
        "edges": edges,
        "limited": object_type != "capability_focus",
    }


def _standard_summary_for_focus_ids(focus_ids: set[str]) -> dict[str, int]:
    if not focus_ids:
        return {"standard_controls": 0, "standard_frameworks": 0}
    workbench = read_data_package("capability-workbench")
    relations = _list(workbench.get("relations"))
    control_ids = {
        str(row.get("targetId") or "").strip()
        for row in relations
        if row.get("type") == "maps_to_standard" and str(row.get("sourceId") or "").strip() in focus_ids and row.get("targetId")
    }
    framework_ids = {
        str(row.get("targetId") or "").strip()
        for row in relations
        if row.get("type") == "belongs_to_framework" and str(row.get("sourceId") or "").strip() in control_ids and row.get("targetId")
    }
    return {"standard_controls": len(control_ids), "standard_frameworks": len(framework_ids)}


def _capability_standard_mapping_rows_for_focus_ids(focuses: list[dict[str, Any]]) -> list[dict[str, Any]]:
    focus_ids = {str(focus.get("id") or "").strip() for focus in focuses if focus.get("id")}
    if not focus_ids:
        return []
    workbench = read_data_package("capability-workbench")
    objects = workbench.get("objects") or {}
    focus_objects = objects.get("capability_focus") or {}
    controls = objects.get("standard_control") or {}
    frameworks = objects.get("standard_framework") or {}
    frameworks_by_code = {str(item.get("code") or "").strip(): item for item in frameworks.values() if item.get("code")}
    controls_by_focus: dict[str, list[dict[str, Any]]] = {focus_id: [] for focus_id in focus_ids}
    for relation in _list(workbench.get("relations")):
        if relation.get("type") != "maps_to_standard":
            continue
        focus_id = str(relation.get("sourceId") or "").strip()
        if focus_id not in focus_ids:
            continue
        control = controls.get(str(relation.get("targetId") or "").strip())
        if not isinstance(control, dict):
            continue
        compact = _compact_entity(control, "条款 / 控制项") or {}
        compact["frameworkCode"] = control.get("frameworkCode") or ""
        compact["frameworkTitle"] = control.get("frameworkTitle") or ""
        compact["originalControlId"] = control.get("originalControlId") or ""
        controls_by_focus[focus_id].append(compact)

    rows: list[dict[str, Any]] = []
    for focus in focuses:
        focus_id = str(focus.get("id") or "").strip()
        focus_entity = _compact_entity(focus_objects.get(focus_id) or focus, "未命名关注点") or {}
        row_controls = _unique_by(controls_by_focus.get(focus_id, []))
        row_frameworks = _unique_by(
            [
                _compact_entity(frameworks_by_code.get(str(control.get("frameworkCode") or "").strip()) or {"id": control.get("frameworkCode"), "code": control.get("frameworkCode"), "title": control.get("frameworkTitle")}, "标准 / 框架")
                for control in row_controls
                if control.get("frameworkCode")
            ]
        )
        rows.append(
            {
                "id": f"{focus_id}:standard",
                "focus": focus_entity,
                "standards": [framework for framework in row_frameworks if framework],
                "controls": row_controls,
                "dataSource": "capability-workspace-view",
            }
        )
    return rows


def _projection_summary(
    focuses: list[dict[str, Any]],
    technical_rows: list[dict[str, Any]],
    management_rows: list[dict[str, Any]],
    standard_summary: dict[str, int],
) -> dict[str, int]:
    return {
        "focuses": len(focuses),
        "technical_rows": len(technical_rows),
        "management_rows": len(management_rows),
        "standard_controls": standard_summary.get("standard_controls", 0),
        "standard_frameworks": standard_summary.get("standard_frameworks", 0),
    }


def _invalid_capability_projection(object_type: str, object_id: str | None) -> dict[str, Any]:
    return {
        "selected": {
            "id": str(object_id or "").strip(),
            "type": object_type,
            "code": "",
            "name": "",
        },
        "graphScope": CAPABILITY_GRAPH_SCOPES.get(object_type, ""),
        "dataState": "invalid_object",
        "data_state": "invalid_object",
        "graph": {"center": {}, "nodes": [], "edges": [], "limited": True},
        "summary": {},
        "tabs": {},
        "sourceEvidence": [],
        "technicalMappingRows": [],
        "managementMappingRows": [],
        "standardMappingRows": [],
        "localRelationMap": None,
        "localRelationMaps": [],
        "localRelationMapsByFocusId": {},
        "stats": {"technical_rows": 0, "management_rows": 0, "local_relation_maps": 0, "focuses": 0},
    }


def _default_focus_id_from_workbench(workbench: dict[str, Any]) -> str:
    navigator = workbench.get("navigator") or {}
    default_id = navigator.get("defaultSelectedFocusId")
    if default_id:
        return str(default_id)
    stack = list(_list(navigator.get("tree")))
    while stack:
        node = stack.pop(0)
        if node.get("type") == "capability_focus" and node.get("id"):
            return str(node["id"])
        stack.extend(_list(node.get("children")))
    return ""


def capability_workspace_projection(
    focus_id: str | None = None,
    object_type: str | None = None,
    object_id: str | None = None,
) -> dict[str, Any]:
    capability = read_data_package("capability")
    maintenance = read_data_package("maintenance")
    shared_lookups = read_data_package("shared-lookups")
    projection_context = {
        "security_technical_measures": _list(maintenance.get("security_technical_measures")),
        "service_module_index": _list(shared_lookups.get("service_module_index")),
    }
    technical_rows = _capability_technical_mapping_rows(capability, projection_context)
    management_rows = _capability_management_mapping_rows(capability)
    normalized_object_type = _normalize_capability_object_type(object_type)
    selected_item: dict[str, Any] | None = None
    selected_focuses: list[dict[str, Any]] = []
    if normalized_object_type and object_id:
        selected_item, _ = _find_capability_projection_object(capability, normalized_object_type, object_id)
        if not selected_item:
            return _invalid_capability_projection(normalized_object_type, object_id)
        selected_focuses = _focuses_for_projection_object(selected_item, normalized_object_type)
    elif focus_id:
        normalized_object_type = "capability_focus"
        selected_item, _ = _find_capability_projection_object(capability, normalized_object_type, focus_id)
        if not selected_item:
            return _invalid_capability_projection(normalized_object_type, focus_id)
        selected_focuses = [selected_item]

    selected_focus_ids = {str(focus.get("id") or "").strip() for focus in selected_focuses if focus.get("id")}
    if selected_focus_ids:
        technical_rows = [row for row in technical_rows if str((row.get("focus") or {}).get("id") or "").strip() in selected_focus_ids]
        management_rows = [row for row in management_rows if str((row.get("focus") or {}).get("id") or "").strip() in selected_focus_ids]
    local_relation_maps: list[dict[str, Any]] = []
    if not normalized_object_type or normalized_object_type == "capability_focus":
        local_relation_maps = _capability_local_relation_maps(capability, technical_rows, management_rows)
        if selected_focus_ids:
            local_relation_maps = [row for row in local_relation_maps if str((row.get("focus") or {}).get("id") or "").strip() in selected_focus_ids]
    local_relation_maps_by_focus_id: dict[str, dict[str, Any]] = {}
    for row in local_relation_maps:
        focus = row.get("focus", {})
        for key in (focus.get("id"), focus.get("code")):
            normalized_key = str(key or "").strip()
            if normalized_key:
                local_relation_maps_by_focus_id[normalized_key] = row
    standard_summary = _standard_summary_for_focus_ids(selected_focus_ids)
    selected = _compact_projection_object(selected_item, normalized_object_type) if selected_item and normalized_object_type else None
    graph = (
        _capability_projection_graph(selected_item, normalized_object_type, technical_rows, management_rows, standard_summary)
        if selected_item and normalized_object_type
        else {"center": {}, "nodes": [], "edges": [], "limited": True}
    )
    data_state = "ready" if graph.get("nodes") or technical_rows or management_rows or standard_summary.get("standard_controls") else "empty"
    summary = _projection_summary(selected_focuses, technical_rows, management_rows, standard_summary) if selected_item else {}
    standard_rows = _capability_standard_mapping_rows_for_focus_ids(selected_focuses) if selected_item else []
    return {
        "generated_at": capability.get("generated_at") or shared_lookups.get("generated_at") or maintenance.get("generated_at"),
        "contract": "capability-workspace-view",
        "viewModelKind": "capability_object_workspace_view",
        "selected": selected,
        "graphScope": CAPABILITY_GRAPH_SCOPES.get(normalized_object_type, "") if normalized_object_type else "",
        "dataState": data_state,
        "data_state": data_state,
        "graph": graph,
        "summary": summary,
        "tabs": {
            "graph": {"dataState": data_state, "nodeCount": len(_list(graph.get("nodes")))},
            "technical": {"rowCount": len(technical_rows)},
            "management": {"rowCount": len(management_rows)},
            "standards": {"controlCount": standard_summary.get("standard_controls", 0), "frameworkCount": standard_summary.get("standard_frameworks", 0)},
        },
        "sourceEvidence": [],
        "technicalMappingRows": technical_rows,
        "managementMappingRows": management_rows,
        "standardMappingRows": standard_rows,
        "localRelationMap": local_relation_maps[0] if local_relation_maps else None,
        "localRelationMaps": local_relation_maps,
        "localRelationMapsByFocusId": local_relation_maps_by_focus_id,
        "stats": {
            "technical_rows": len(technical_rows),
            "management_rows": len(management_rows),
            "local_relation_maps": len(local_relation_maps),
            "focuses": len(selected_focuses) if selected_focuses else len(_all_focuses(capability)),
            "standard_controls": standard_summary.get("standard_controls", 0),
            "standard_frameworks": standard_summary.get("standard_frameworks", 0),
        },
    }


def capability_workspace_view(object_type: str | None = None, object_id: str | None = None, focus_id: str | None = None) -> dict[str, Any]:
    view = capability_workspace_projection(focus_id=focus_id, object_type=object_type, object_id=object_id)
    view["contract"] = "capability-workspace-view"
    view["viewModelKind"] = "capability_object_workspace_view"
    return view


def capability_workspace_initial_projection() -> dict[str, Any]:
    workbench = read_data_package("capability-workbench")
    focus_id = _default_focus_id_from_workbench(workbench)
    projection = capability_workspace_projection(focus_id=focus_id or None)
    return {
        "generated_at": workbench.get("meta", {}).get("generated_at") or projection.get("generated_at"),
        "data_state": projection.get("data_state") or "ready",
        "meta": workbench.get("meta") or {},
        "page": workbench.get("page") or {},
        "navigator": workbench.get("navigator") or {},
        "overview": workbench.get("overview") or {},
        "relationshipGroups": [],
        "objects": {},
        "relations": [],
        "evidenceRefs": [],
        "compatibility": {
            **(workbench.get("compatibility") or {}),
            "mode": "initial_projection",
            "warnings": ["首屏仅加载能力目录和默认关注点关系，完整矩阵明细按需加载。"],
        },
        "technicalMappingRows": projection.get("technicalMappingRows") or [],
        "managementMappingRows": projection.get("managementMappingRows") or [],
        "localRelationMap": projection.get("localRelationMap"),
        "localRelationMaps": projection.get("localRelationMaps") or [],
        "localRelationMapsByFocusId": projection.get("localRelationMapsByFocusId") or {},
        "stats": {
            **(projection.get("stats") or {}),
            "initial_focus_id": focus_id,
        },
    }


def _maintenance_navigation(capability: dict[str, Any], management: dict[str, Any], lifecycle: dict[str, Any], standards: dict[str, Any]) -> list[dict[str, Any]]:
    process_count = sum(
        len(_list(group.get("references")))
        for domain in _list(management.get("security_processes"))
        for group in _list(domain.get("groups"))
    )
    work_function_count = sum(
        len(_list(group.get("functions")))
        for layer in _list(management.get("work_function_layers"))
        for group in _list(layer.get("groups"))
    )
    security_work_count = sum(
        len(_list(focus.get("security_works")))
        for category in _list(capability.get("categories"))
        for domain in _list(category.get("domains"))
        for cap in _list(domain.get("capabilities"))
        for focus in _list(cap.get("focuses"))
    )
    app_security = lifecycle.get("application_security_development") or {}
    technical_service_count = len(_list(management.get("security_technical_services"))) or len(_list(management.get("service_module_index")))
    application_system_count = len(_list(app_security.get("application_system_types")))
    lcap_reference_count = len(_list(app_security.get("software_development_types"))) + len(_list(app_security.get("application_system_types")))
    reference_count = len(_list(management.get("gbt_42446_references"))) + len(_list(management.get("gartner_roles")))
    standards_count = len(_list(standards.get("frameworks")))
    return [
        {"id": "scopes", "label": "作用域清单", "count": len(_list(management.get("scope_types")))},
        {"id": "services", "label": "安全技术服务清单", "count": technical_service_count},
        {"id": "processes", "label": "流程清单", "count": process_count},
        {"id": "work-functions", "label": "职能清单", "count": work_function_count},
        {"id": "security-works", "label": "安全工作清单", "count": security_work_count},
        {"id": "modules", "label": "安全技术模块清单", "count": len(_list(management.get("security_technology_modules")))},
        {"id": "measures", "label": "安全技术措施清单", "count": len(_list(management.get("security_technical_measures")))},
        {"id": "application-systems", "label": "应用系统目录", "count": application_system_count},
        {"id": "lcap-references", "label": "LC-AP参考数据", "count": lcap_reference_count},
        {"id": "references", "label": "岗位参考页面", "count": reference_count},
        {"id": "standards", "label": "标准/框架清单", "count": standards_count},
    ]


def _security_work_items(capability: dict[str, Any]) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    index = 1
    for category in _list(capability.get("categories")):
        for domain in _list(category.get("domains")):
            for cap in _list(domain.get("capabilities")):
                for focus in _list(cap.get("focuses")):
                    for work in _list(focus.get("security_works")):
                        rows.append(
                            {
                                **work,
                                "index": index,
                                "capability": {"id": cap.get("id"), "code": cap.get("code"), "title": cap.get("title")},
                                "focus": {"id": focus.get("id"), "code": focus.get("code"), "title": focus.get("title")},
                                "focus_code": focus.get("code"),
                                "focus_title": focus.get("title"),
                            }
                        )
                        index += 1
    return rows


def maintenance_payload(section: str) -> dict[str, Any]:
    capability = read_data_package("capability")
    management = read_data_package("maintenance")
    lifecycle = read_data_package("lifecycle")
    standards = read_data_package("standards")
    app_security = lifecycle.get("application_security_development") or {}
    if section == "scopes":
        return {"section": section, "items": _list(management.get("scope_types"))}
    if section == "services":
        services = _list(management.get("security_technical_services"))
        return {
            "section": section,
            "items": services,
            "data_state": "ready" if services else "empty",
            "empty_state": "" if services else "暂无安全技术服务数据，请确认 ETL 是否已导出 security_technical_services。",
        }
    if section == "processes":
        return {"section": section, "items": _list(management.get("security_processes"))}
    if section == "work-functions":
        return {"section": section, "items": _list(management.get("work_function_layers"))}
    if section == "security-works":
        return {"section": section, "items": _security_work_items(capability)}
    if section == "modules":
        return {"section": section, "items": _list(management.get("security_technology_modules"))}
    if section == "measures":
        measures = _list(management.get("security_technical_measures"))
        return {
            "section": section,
            "items": measures,
            "data_state": "ready" if measures else "empty",
            "empty_state": "" if measures else "暂无安全技术措施数据，请确认 ETL 是否已导出 security_technical_measures。",
        }
    if section == "lcap-references":
        return {
            "section": section,
            "software_development_types": _list(app_security.get("software_development_types")),
            "application_system_types": _list(app_security.get("application_system_types")),
        }
    if section == "application-systems":
        rows = _list(app_security.get("application_system_types"))
        return {
            "section": section,
            "items": rows,
            "components": _list(app_security.get("application_components")),
            "data_state": "ready" if rows else "empty",
            "empty_state": "" if rows else "暂无应用系统目录数据，请确认 ETL 是否已导出 application_system_types。",
        }
    if section == "references":
        return {
            "section": section,
            "standards": _list(management.get("gbt_42446_references")),
            "roles": _list(management.get("gartner_roles")),
        }
    if section == "standards":
        return {
            "section": section,
            "frameworks": _list(standards.get("frameworks")),
            "stats": standards.get("stats") if isinstance(standards.get("stats"), dict) else {},
            "data_state": standards.get("data_state") or ("ready" if _list(standards.get("frameworks")) else "empty"),
        }
    raise KeyError(section)


class SapdWikiRequestHandler(SimpleHTTPRequestHandler):
    server_version = "SAPDWikiHTTP/0.1"

    def __init__(self, *args: Any, directory: str | None = None, **kwargs: Any) -> None:
        super().__init__(*args, directory=directory, **kwargs)

    def end_headers(self) -> None:
        # The local preview server is used while editing frontend files. Disable
        # browser caching so a normal refresh always picks up changed JS/CSS/HTML.
        self.send_header("Cache-Control", "no-store, max-age=0, must-revalidate")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()

    def do_OPTIONS(self) -> None:
        self.send_response(204)
        self.end_headers()

    def do_GET(self) -> None:
        parsed = urlparse(self.path)
        if parsed.path.startswith("/api/v1/"):
            self._handle_api(parsed.path, parse_qs(parsed.query))
            return
        if parsed.path not in {"", "/"} and "." not in Path(parsed.path).name:
            index_path = Path(self.directory) / "index.html"
            if index_path.exists():
                self.path = "/index.html"
                super().do_GET()
                return
        super().do_GET()

    def do_POST(self) -> None:
        parsed = urlparse(self.path)
        if parsed.path not in {"/api/v1/user/favorites", "/api/v1/user/notes"}:
            self._send_json(create_envelope({"error": "not_found", "path": parsed.path}), status=404)
            return
        try:
            payload = self._read_json_body()
            if parsed.path == "/api/v1/user/notes":
                self._send_json(create_envelope(create_user_note(payload)))
            else:
                self._send_json(create_envelope(upsert_user_favorite(payload)))
        except ValueError as exc:
            self._send_json(create_envelope({"error": "bad_request", "message": str(exc)}), status=400)
        except Exception as exc:
            self._send_json(create_envelope({"error": "server_error", "message": str(exc), "path": parsed.path}), status=500)

    def do_PATCH(self) -> None:
        parsed = urlparse(self.path)
        if not parsed.path.startswith("/api/v1/user/notes/"):
            self._send_json(create_envelope({"error": "not_found", "path": parsed.path}), status=404)
            return
        try:
            note_id = unquote(parsed.path.rsplit("/", 1)[-1])
            payload = self._read_json_body()
            self._send_json(create_envelope(update_user_note(note_id, payload)))
        except ValueError as exc:
            self._send_json(create_envelope({"error": "bad_request", "message": str(exc)}), status=400)
        except Exception as exc:
            self._send_json(create_envelope({"error": "server_error", "message": str(exc), "path": parsed.path}), status=500)

    def do_DELETE(self) -> None:
        parsed = urlparse(self.path)
        if parsed.path != "/api/v1/user/favorites" and not parsed.path.startswith("/api/v1/user/notes/"):
            self._send_json(create_envelope({"error": "not_found", "path": parsed.path}), status=404)
            return
        try:
            if parsed.path.startswith("/api/v1/user/notes/"):
                note_id = unquote(parsed.path.rsplit("/", 1)[-1])
                self._send_json(create_envelope(delete_user_note(note_id)))
            else:
                query = parse_qs(parsed.query)
                target_ref = unquote((query.get("target_ref") or [""])[0])
                self._send_json(create_envelope(delete_user_favorite(target_ref)))
        except ValueError as exc:
            self._send_json(create_envelope({"error": "bad_request", "message": str(exc)}), status=400)
        except Exception as exc:
            self._send_json(create_envelope({"error": "server_error", "message": str(exc), "path": parsed.path}), status=500)

    def _send_json(self, payload: Any, status: int = 200) -> None:
        encoded = json.dumps(payload, ensure_ascii=False, indent=2).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(encoded)))
        self.end_headers()
        self.wfile.write(encoded)

    def _read_json_body(self) -> dict[str, Any]:
        if self.headers.get("Content-Type", "").split(";", 1)[0].strip().lower() != "application/json":
            raise ValueError("Content-Type must be application/json")
        length = int(self.headers.get("Content-Length", "0"))
        raw = self.rfile.read(length).decode("utf-8") if length else "{}"
        payload = json.loads(raw or "{}")
        if not isinstance(payload, dict):
            raise ValueError("JSON body must be an object")
        return payload

    def _handle_api(self, path: str, query: dict[str, list[str]]) -> None:
        parts = [part for part in path.split("/") if part]
        try:
            if path == "/api/v1/health":
                self._send_json(
                    create_envelope(
                        {
                            "status": "ok",
                            "app": "SAPD Wiki",
                            "mode": "local-api",
                            "auth": {"writes_require_token": False, "header": "X-SAPD-Session-Token", "session_token": None},
                            "user_database": {"ready": True, "schema_version": USER_SCHEMA_VERSION},
                        }
                    )
                )
                return
            if path == "/api/v1/user/favorites":
                self._send_json(create_envelope(list_user_favorites()))
                return
            if path == "/api/v1/user/notes":
                self._send_json(create_envelope(list_user_notes(query)))
                return
            if path == "/api/v1/data-packages":
                self._send_json(create_envelope({"packages": [{"name": name, "path": path} for name, path in DATA_PACKAGES.items()]}))
                return
            if len(parts) == 4 and parts[:3] == ["api", "v1", "data-packages"]:
                self._send_json(create_envelope(read_data_package(parts[3])))
                return
            if path == "/api/v1/capabilities/workspace-initial":
                self._send_json(create_envelope(capability_workspace_initial_projection()))
                return
            if path == "/api/v1/capabilities/workspace-projection":
                focus_id = (query.get("focus_id") or query.get("focusId") or [""])[0] or None
                object_type = (query.get("object_type") or query.get("objectType") or [""])[0] or None
                object_id = (query.get("object_id") or query.get("objectId") or [""])[0] or None
                self._send_json(create_envelope(capability_workspace_projection(focus_id=focus_id, object_type=object_type, object_id=object_id)))
                return
            if path == "/api/v1/capabilities/workspace-view":
                focus_id = (query.get("focus_id") or query.get("focusId") or [""])[0] or None
                object_type = (query.get("object_type") or query.get("objectType") or [""])[0] or None
                object_id = (query.get("object_id") or query.get("objectId") or [""])[0] or None
                self._send_json(create_envelope(capability_workspace_view(focus_id=focus_id, object_type=object_type, object_id=object_id)))
                return
            if path == "/api/v1/maintenance":
                capability = read_data_package("capability")
                management = read_data_package("maintenance")
                lifecycle = read_data_package("lifecycle")
                standards = read_data_package("standards")
                self._send_json(create_envelope({"sections": _maintenance_navigation(capability, management, lifecycle, standards)}))
                return
            if len(parts) == 4 and parts[:3] == ["api", "v1", "maintenance"]:
                section = parts[3]
                self._send_json(create_envelope(maintenance_payload(section)))
                return
            self._send_json(create_envelope({"error": "not_found", "path": path}), status=404)
        except KeyError as exc:
            self._send_json(create_envelope({"error": "not_found", "key": str(exc), "path": path}), status=404)
        except Exception as exc:
            self._send_json(create_envelope({"error": "server_error", "message": str(exc), "path": path}), status=500)


def serve(args: argparse.Namespace) -> None:
    static_dir = resolve_project_path(args.static_dir)
    handler = lambda *handler_args, **kwargs: SapdWikiRequestHandler(*handler_args, directory=str(static_dir), **kwargs)
    server = ThreadingHTTPServer((args.host, args.port), handler)
    url = f"http://{args.host}:{args.port}"
    print(f"SAPD Wiki local API: {url}/api/v1/health")
    print(f"SAPD Wiki frontend:  {url}/")
    print(f"static_dir: {static_dir.relative_to(PROJECT_ROOT) if static_dir.is_relative_to(PROJECT_ROOT) else static_dir}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nserver stopped")
    finally:
        server.server_close()
