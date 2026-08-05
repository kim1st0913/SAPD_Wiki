from __future__ import annotations

import argparse
import base64
import hashlib
import ipaddress
import json
import os
import re
import secrets
import signal
import shutil
import sqlite3
import tempfile
import time
import uuid
from contextlib import closing, contextmanager
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Lock
from typing import Any
from urllib.parse import parse_qs, unquote, urlparse

from .content_asset_service import (
    ASSET_HASH_PATTERN,
    ContentAssetError,
    ContentAssetNotFound,
    ContentAssetRangeError,
    ContentAssetService,
    parse_http_byte_range,
)
from .local_mcp.base_query_service import SCOPE, BaseKnowledgeQueryService
from .local_mcp.dev_supervisor import DevSidecarSupervisor
from .local_mcp.errors import McpCoreError
from .local_mcp.models import RequestContext
from .local_mcp.web_control import build_dev_control_api

from .maturity import (
    build_maturity_workspace,
    calculate_maturity_assessment,
    create_maturity_report_snapshot,
    export_maturity_score_exchange,
    export_maturity_template_exchange,
    import_maturity_score_exchange,
    import_maturity_template_exchange,
    validate_maturity_template,
)
from .paths import DEFAULT_DB_PATH, PROJECT_ROOT, resolve_project_path


DATA_PACKAGES = {
    "analytics-summary": "frontend/capability-browser/public/data/analytics-summary.json",
    "capability": "frontend/capability-browser/public/data/capability-tree.json",
    "capability-workbench": "frontend/capability-browser/public/data/capability-workbench.json",
    "environment-dictionary": "frontend/capability-browser/public/data/environment-dictionary.json",
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

DEFAULT_FRONTEND_PUBLIC_DATA_ROOT = (PROJECT_ROOT / "frontend" / "capability-browser" / "public" / "data").resolve()
DEFAULT_FRONTEND_STATIC_DIR = (PROJECT_ROOT / "frontend" / "capability-browser").resolve()
DEFAULT_USER_DB_PATH = (PROJECT_ROOT / "data" / "user" / "sapd_wiki_user.sqlite3").resolve()
DEFAULT_CONTENT_ASSET_DB_PATH = (
    PROJECT_ROOT / "data" / "database" / "sapd_content_assets.sqlite3"
).resolve()
DEFAULT_USER_EXPORT_DIR = (PROJECT_ROOT / "data" / "exports").resolve()
DEFAULT_USER_IMPORT_DIR = (PROJECT_ROOT / "data" / "import").resolve()
DEFAULT_APP_DATA_ROOT = PROJECT_ROOT.resolve()
RESERVED_STABLE_PREVIEW_PORT = 5173
MCP_CONTROL_BODY_LIMIT = 8192
DATA_PACKAGE_ROOT = DEFAULT_FRONTEND_PUBLIC_DATA_ROOT
BASE_DB_PATH = DEFAULT_DB_PATH.resolve()
CONTENT_QUERY_DB_PATH = BASE_DB_PATH
CONTENT_ASSET_DB_PATH: Path | None = None
USER_DB_PATH = DEFAULT_USER_DB_PATH
USER_EXPORT_DIR = DEFAULT_USER_EXPORT_DIR
USER_IMPORT_DIR = DEFAULT_USER_IMPORT_DIR
APP_DATA_ROOT = DEFAULT_APP_DATA_ROOT
APP_DISPLAY_VERSION = "0.2.0"
USER_STATE_EPHEMERAL = False
_EPHEMERAL_USER_DB_URI = ""
_EPHEMERAL_USER_DB_KEEPER: sqlite3.Connection | None = None
_EPHEMERAL_USER_ARTIFACTS: tempfile.TemporaryDirectory[str] | None = None
_EPHEMERAL_PREVIOUS_EXPORT_DIR: Path | None = None
_EPHEMERAL_USER_DB_LOCK = Lock()
_MATURITY_REPORT_MANIFEST_LOCKS: dict[str, Lock] = {}
_MATURITY_REPORT_MANIFEST_LOCKS_GUARD = Lock()
_CONTENT_CURSOR_KEY = secrets.token_bytes(32)
MATURITY_REPORT_ARTIFACT_SCHEMA = "sapd-maturity-report-artifact-v1"
RUNTIME_LABEL = "stable"
USER_SCHEMA_VERSION = "user_schema_0.3"
LOCAL_API_AUTH_HEADER = "X-SAPD-Session-Token"
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

CREATE INDEX IF NOT EXISTS idx_user_notes_page_route_updated ON user_notes(page_route, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_notes_target_ref ON user_notes(target_ref);
CREATE INDEX IF NOT EXISTS idx_user_notes_page_target ON user_notes(page_route, target_ref);
CREATE INDEX IF NOT EXISTS idx_user_notes_anchor_type ON user_notes(anchor_type);
CREATE INDEX IF NOT EXISTS idx_user_notes_object_type ON user_notes(object_type);
CREATE INDEX IF NOT EXISTS idx_user_notes_status ON user_notes(status);

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

USER_SCHEMA_V03_SQL = """
CREATE TABLE IF NOT EXISTS user_workspaces (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

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
);

CREATE TABLE IF NOT EXISTS user_data_baskets (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

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
);

CREATE TABLE IF NOT EXISTS user_export_profiles (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  export_type TEXT NOT NULL,
  config_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

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
);

CREATE TABLE IF NOT EXISTS user_capability_models (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS user_capability_model_nodes (
  id TEXT PRIMARY KEY,
  model_id TEXT NOT NULL,
  parent_id TEXT,
  source_ref TEXT,
  node_type TEXT NOT NULL,
  code TEXT,
  title TEXT NOT NULL,
  description TEXT,
  payload_json TEXT,
  sort_order INTEGER,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS user_capability_model_relations (
  id TEXT PRIMARY KEY,
  model_id TEXT NOT NULL,
  source_node_id TEXT NOT NULL,
  target_ref TEXT NOT NULL,
  relation_type TEXT NOT NULL,
  payload_json TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS user_import_staging_items (
  id TEXT PRIMARY KEY,
  import_job_id TEXT NOT NULL,
  target_ref TEXT,
  item_type TEXT NOT NULL,
  action_type TEXT NOT NULL DEFAULT 'create',
  payload_json TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS user_import_staging_relations (
  id TEXT PRIMARY KEY,
  import_job_id TEXT NOT NULL,
  source_ref TEXT NOT NULL,
  target_ref TEXT NOT NULL,
  relation_type TEXT NOT NULL,
  action_type TEXT NOT NULL DEFAULT 'create',
  payload_json TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS user_review_decisions (
  id TEXT PRIMARY KEY,
  target_ref TEXT NOT NULL,
  decision_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  note TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS user_target_ref_migrations (
  id TEXT PRIMARY KEY,
  old_target_ref TEXT NOT NULL,
  new_target_ref TEXT,
  redirect_type TEXT NOT NULL,
  affected_table TEXT NOT NULL,
  affected_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  applied_at TEXT
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


def ensure_user_note_columns(connection: sqlite3.Connection) -> None:
    rows = connection.execute("PRAGMA table_info(user_notes)").fetchall()
    existing = {row[1] for row in rows}
    for column, definition in USER_NOTE_COLUMNS.items():
        if column not in existing:
            connection.execute(f"ALTER TABLE user_notes ADD COLUMN {column} {definition}")
    for statement in USER_NOTE_INDEX_SQL:
        connection.execute(statement)


def _list(value: Any) -> list[Any]:
    return value if isinstance(value, list) else []


_DATA_PACKAGE_CACHE: dict[str, tuple[tuple[int, int], dict[str, Any] | list[Any] | Any]] = {}


def _package_cache_key(path: Path) -> tuple[int, int]:
    stat = path.stat()
    return (stat.st_size, int(stat.st_mtime_ns))


def _read_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def _relative_data_package_path(configured_path: str) -> Path | None:
    normalized = str(configured_path or "").strip()
    if not normalized:
        return None
    prefixes = (
        "frontend/capability-browser/public/data/",
        "public/data/",
    )
    for prefix in prefixes:
        if normalized.startswith(prefix):
            relative = Path(normalized.removeprefix(prefix))
            if relative.is_absolute() or any(part in {"", ".", ".."} for part in relative.parts):
                return None
            return relative
    return None


def _data_package_path(name: str) -> Path:
    if name not in DATA_PACKAGES:
        raise KeyError(name)
    relative = _relative_data_package_path(DATA_PACKAGES[name])
    if relative is not None:
        return (DATA_PACKAGE_ROOT / relative).resolve()
    return resolve_project_path(DATA_PACKAGES[name])


def read_data_package(name: str) -> dict[str, Any]:
    if name == "standards":
        return read_standards_compat_package()
    path = _data_package_path(name)
    if not path.exists():
        return {"generated_at": None, "stats": {}, "__data_state": "missing_file"}
    cache_key = _package_cache_key(path)
    cached = _DATA_PACKAGE_CACHE.get(name)
    if cached and cached[0] == cache_key:
        return cached[1] if isinstance(cached[1], dict) else {"generated_at": None, "items": cached[1]}
    data = _read_json(path)
    _DATA_PACKAGE_CACHE[name] = (cache_key, data)
    if isinstance(data, dict):
        return data
    return {"generated_at": None, "items": data}


def dashboard_knowledge_summary() -> dict[str, Any]:
    """Return small, source-backed counts for the overview without exposing raw workbench packages."""
    environment_path = (DATA_PACKAGE_ROOT / "environment" / "navigator.json").resolve()
    environment = _read_json(environment_path) if environment_path.exists() else {}
    capability = read_data_package("capability-workbench")
    environment_dictionary = read_data_package("environment-dictionary")
    lifecycle = read_data_package("lifecycle-workbench")
    lifecycle_knowledge = read_data_package("lifecycle")
    maintenance = read_data_package("maintenance")
    maintenance_index = read_data_package("maintenance-index")
    standards = read_data_package("standards-index")
    content = read_data_package("content")
    environment_stats = environment.get("stats", {}) if isinstance(environment, dict) else {}
    capability_stats = capability.get("meta", {}).get("stats", {}) if isinstance(capability, dict) else {}
    lifecycle_knowledge_stats = lifecycle_knowledge.get("stats", {}) if isinstance(lifecycle_knowledge, dict) else {}
    maintenance_stats = maintenance.get("stats", {}) if isinstance(maintenance, dict) else {}
    maintenance_counts = maintenance_index.get("section_counts", {}) if isinstance(maintenance_index, dict) else {}
    standards_stats = standards.get("stats", {}) if isinstance(standards, dict) else {}
    content_stats = content.get("stats", {}) if isinstance(content, dict) else {}
    environment_master_counts = environment_dictionary.get("master_counts", {}) if isinstance(environment_dictionary, dict) else {}
    environment_master_total = sum(
        int(environment_master_counts.get(key) or 0)
        for key in ("information_environments", "environment_segment_types", "information_objects")
    )
    lifecycle_domains = {
        str(node.get("code") or node.get("id") or ""): len(_list(node.get("children")))
        for node in _list(lifecycle.get("navigator", {}).get("tree"))
        if isinstance(node, dict)
    }
    missing = not environment or lifecycle.get("__data_state") == "missing_file" or content.get("__data_state") == "missing_file"
    return {
        "generated_at": max(
            [str(value) for value in (lifecycle.get("meta", {}).get("generated_at"), content.get("generated_at")) if value],
            default=None,
        ),
        "data_state": "missing_file" if missing else "ready",
        "environment": {
            "information_environments": int(environment_stats.get("information_environment") or 0),
            "environment_segment_types": int(environment_master_counts.get("environment_segment_types") or 0),
            "information_objects": int(environment_stats.get("information_object") or 0),
            "scope_types": int(environment_stats.get("scope_type") or 0),
        },
        "catalog": {
            "capabilities": int(capability_stats.get("capability") or 0),
            "scope_types": int(maintenance_counts.get("scopes") or maintenance_stats.get("scope_types") or 0),
            "environment_master_records": environment_master_total,
            "technical_services": int(maintenance_counts.get("services") or maintenance_stats.get("security_technical_services") or 0),
            "technical_modules": int(maintenance_counts.get("modules") or maintenance_stats.get("security_technology_modules") or 0),
            "technical_measures": int(maintenance_counts.get("measures") or maintenance_stats.get("security_technical_measures") or 0),
            "security_works": int(maintenance_counts.get("security-works") or maintenance_stats.get("security_works") or 0),
            "security_processes": int(maintenance_counts.get("processes") or maintenance_stats.get("security_processes") or 0),
            "application_system_types": int(lifecycle_knowledge_stats.get("application_system_types") or 0),
            "application_components": int(lifecycle_knowledge_stats.get("application_components") or 0),
            "work_functions": int(maintenance_stats.get("work_functions") or 0),
            "workforce_references": int(maintenance_counts.get("references") or 0),
            "standard_frameworks": int(standards_stats.get("frameworks") or 0),
        },
        "lifecycles": {
            "lc_ap_stages": int(lifecycle_domains.get("LC-AP") or lifecycle_domains.get("lifecycle_domain:LC-AP") or 0),
            "lc_dt_stages": int(lifecycle_domains.get("LC-DT") or lifecycle_domains.get("lifecycle_domain:LC-DT") or 0),
        },
        "content": {
            "html_documents": int(content_stats.get("html_documents") or 0),
            "slide_decks": sum(
                1
                for row in _list(content.get("html_documents"))
                if isinstance(row, dict) and str(row.get("view_type") or "") == "slide_deck"
            ),
            "diagram_views": int(content_stats.get("diagram_views") or 0),
            "guide_pages": int(content_stats.get("guide_pages") or 0),
        },
    }


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
    path = (DATA_PACKAGE_ROOT / relative).resolve()
    try:
        path.relative_to(DATA_PACKAGE_ROOT)
    except ValueError:
        return None
    return path


def configure_runtime_paths(
    *,
    base_db: str | Path | None = None,
    content_query_db: str | Path | None = None,
    content_asset_db: str | Path | None = None,
    user_db: str | Path | None = None,
    data_root: str | Path | None = None,
    export_dir: str | Path | None = None,
    import_dir: str | Path | None = None,
    app_data_root: str | Path | None = None,
    app_version: str | None = None,
    runtime_label: str | None = None,
    ephemeral_user_state: bool = False,
) -> None:
    global BASE_DB_PATH, CONTENT_QUERY_DB_PATH, CONTENT_ASSET_DB_PATH
    global USER_DB_PATH, DATA_PACKAGE_ROOT, USER_EXPORT_DIR, RUNTIME_LABEL
    global USER_IMPORT_DIR, APP_DATA_ROOT, APP_DISPLAY_VERSION
    global USER_STATE_EPHEMERAL, _EPHEMERAL_USER_DB_URI, _EPHEMERAL_USER_ARTIFACTS
    global _EPHEMERAL_PREVIOUS_EXPORT_DIR
    leaving_ephemeral_export_dir = _EPHEMERAL_PREVIOUS_EXPORT_DIR
    close_ephemeral_user_state()
    USER_STATE_EPHEMERAL = bool(ephemeral_user_state)
    _EPHEMERAL_USER_DB_URI = (
        f"file:sapd-wiki-web-dev-{secrets.token_hex(12)}?mode=memory&cache=shared"
        if USER_STATE_EPHEMERAL
        else ""
    )
    _EPHEMERAL_USER_ARTIFACTS = (
        tempfile.TemporaryDirectory(prefix="sapd-wiki-web-dev-artifacts-")
        if USER_STATE_EPHEMERAL
        else None
    )
    if USER_STATE_EPHEMERAL:
        _EPHEMERAL_PREVIOUS_EXPORT_DIR = leaving_ephemeral_export_dir or USER_EXPORT_DIR
        USER_EXPORT_DIR = (Path(_EPHEMERAL_USER_ARTIFACTS.name) / "exports").resolve()
    elif export_dir:
        USER_EXPORT_DIR = resolve_project_path(export_dir).resolve()
        _EPHEMERAL_PREVIOUS_EXPORT_DIR = None
    elif leaving_ephemeral_export_dir is not None:
        USER_EXPORT_DIR = leaving_ephemeral_export_dir
        _EPHEMERAL_PREVIOUS_EXPORT_DIR = None
    if base_db:
        BASE_DB_PATH = resolve_project_path(base_db).resolve()
    CONTENT_QUERY_DB_PATH = (
        resolve_project_path(content_query_db).resolve()
        if content_query_db
        else BASE_DB_PATH
    )
    CONTENT_ASSET_DB_PATH = (
        resolve_project_path(content_asset_db).resolve()
        if content_asset_db
        else None
    )
    if user_db and not USER_STATE_EPHEMERAL:
        USER_DB_PATH = resolve_project_path(user_db).resolve()
    if data_root:
        DATA_PACKAGE_ROOT = resolve_project_path(data_root).resolve()
    if import_dir:
        USER_IMPORT_DIR = resolve_project_path(import_dir).resolve()
    if app_data_root:
        APP_DATA_ROOT = resolve_project_path(app_data_root).resolve()
    if app_version:
        APP_DISPLAY_VERSION = str(app_version).strip() or APP_DISPLAY_VERSION
    if runtime_label:
        RUNTIME_LABEL = str(runtime_label).strip() or RUNTIME_LABEL
    _DATA_PACKAGE_CACHE.clear()


def maturity_workspace_project_profile() -> str:
    return "delivery" if RUNTIME_LABEL == "bundle" else "development"


USER_EXPORT_CATEGORY_DIRS = {
    "maturity-reports": "maturity-reports",
    "maturity-scores": "maturity-scores",
    "maturity-templates": "maturity-templates",
    "issues": "issues",
    "diagnostics": "diagnostics",
}


def _user_export_segment(value: Any, fallback: str) -> str:
    normalized = re.sub(r'[\\/:*?"<>|\x00-\x1f]+', "-", str(value or "").strip())
    normalized = re.sub(r"\s+", "-", normalized).strip(". -")
    return normalized[:96] or fallback


def sanitize_user_export_file_name(value: Any, fallback: str = "sapd-export") -> str:
    original = Path(str(value or "")).name
    safe_name = _user_export_segment(original, fallback)
    suffix = Path(original).suffix
    if suffix and not safe_name.lower().endswith(suffix.lower()):
        safe_name = f"{safe_name}{suffix}"
    return safe_name


def _user_export_identity_segment(value: Any, fallback: str = "project") -> str:
    raw = str(value or "").strip()
    if re.fullmatch(r"[A-Za-z0-9._-]{1,32}", raw) and raw not in {".", ".."}:
        return raw
    normalized = _user_export_segment(raw, fallback)
    digest = hashlib.sha256(raw.encode("utf-8")).hexdigest()[:10]
    prefix = normalized[: 32 - len(digest) - 1].rstrip(".-") or fallback
    return f"{prefix}-{digest}"


def _user_export_timestamp() -> str:
    return time.strftime("%Y-%m-%d_%H%M%S", time.localtime())


def _resolve_user_export_directory(path: Path, root: Path, *, label: str) -> Path:
    resolved_root = root.resolve()
    resolved_path = path.resolve()
    try:
        resolved_path.relative_to(resolved_root)
    except ValueError as error:
        raise RuntimeError(f"{label} escapes configured export root: {path}") from error
    return resolved_path


def _user_export_project_directory(category: str, project: dict[str, Any] | None = None) -> Path:
    category_name = USER_EXPORT_CATEGORY_DIRS.get(str(category or "").strip())
    if not category_name:
        raise ValueError("unsupported export category")
    export_root = USER_EXPORT_DIR.resolve()
    directory = _resolve_user_export_directory(
        export_root / category_name,
        export_root,
        label="export category path",
    )
    if project:
        project_id = _user_export_identity_segment(project.get("id"), "project")
        project_name = _user_export_segment(project.get("name"), "成熟度评估项目")
        category_root = directory
        try:
            directory = (category_root / f"{project_name}__{project_id}").resolve()
            directory.relative_to(category_root)
        except ValueError as error:
            raise RuntimeError(
                f"export project path escapes configured export category: {category_root}"
            ) from error
    directory.mkdir(parents=True, exist_ok=True)
    return directory


def _write_unique_user_export(directory: Path, file_name: str, content: str | bytes) -> Path:
    safe_name = sanitize_user_export_file_name(file_name)
    stem = Path(safe_name).stem
    suffix = Path(safe_name).suffix
    for counter in range(1, 10_000):
        candidate = directory / (safe_name if counter == 1 else f"{stem}-{counter}{suffix}")
        try:
            if isinstance(content, bytes):
                with candidate.open("xb") as handle:
                    handle.write(content)
            else:
                with candidate.open("x", encoding="utf-8") as handle:
                    handle.write(content)
            return candidate
        except FileExistsError:
            continue
        except Exception:
            candidate.unlink(missing_ok=True)
            raise
    raise RuntimeError("unable to allocate a unique export file")


def _user_export_result(output_path: Path, *, category: str, extra: dict[str, Any] | None = None) -> dict[str, Any]:
    return {
        "ok": True,
        "dataState": "ready",
        "data_state": "ready",
        "category": category,
        "fileName": output_path.name,
        "file_name": output_path.name,
        "outputPath": str(output_path),
        "output_path": str(output_path),
        "downloadDir": str(USER_EXPORT_DIR),
        "download_dir": str(USER_EXPORT_DIR),
        "relativePath": output_path.relative_to(USER_EXPORT_DIR).as_posix(),
        "byteCount": output_path.stat().st_size,
        "byte_count": output_path.stat().st_size,
        **(extra or {}),
    }


def maturity_report_storage_root() -> Path:
    """Keep report history inside the active user-state boundary.

    The macOS wrapper relocates USER_DB_PATH into the user-selected Runtime,
    while isolated Web/test runtimes use a disposable temporary directory.
    """

    if USER_STATE_EPHEMERAL:
        if _EPHEMERAL_USER_ARTIFACTS is None:
            raise RuntimeError("ephemeral user artifact storage is unavailable")
        storage_root = Path(_EPHEMERAL_USER_ARTIFACTS.name) / "maturity-reports"
    else:
        storage_root = USER_DB_PATH.parent / "maturity-reports"
    if storage_root.is_symlink():
        raise RuntimeError(f"maturity report storage root must not be a symbolic link: {storage_root}")
    return storage_root.resolve()


def _maturity_artifact_segment(value: Any, fallback: str) -> str:
    normalized = re.sub(r"[^A-Za-z0-9._-]+", "-", str(value or "").strip()).strip(".-")
    return normalized[:96] or fallback


def _maturity_project_segment(project_id: str) -> str:
    raw = str(project_id or "").strip()
    normalized = re.sub(r"[^A-Za-z0-9._-]+", "-", raw).strip(".-")
    digest = hashlib.sha256(raw.encode("utf-8")).hexdigest()[:12]
    prefix = (normalized[:83] or "assessment-project")[:83]
    return f"{prefix}-{digest}"


def _maturity_resolve_within(path: Path, root: Path, *, label: str) -> Path:
    if path.is_symlink():
        raise RuntimeError(f"{label} must not be a symbolic link: {path}")
    resolved_root = root.resolve()
    resolved_path = path.resolve()
    try:
        resolved_path.relative_to(resolved_root)
    except ValueError as error:
        raise RuntimeError(f"{label} escapes maturity report storage: {path}") from error
    return resolved_path


def _valid_maturity_manifest_entry(project_id: str, project_root: Path, item: Any) -> bool:
    if not isinstance(item, dict):
        return False
    artifact_id = str(item.get("artifactId") or "")
    report_id = str(item.get("reportId") or "")
    created_at = str(item.get("createdAt") or "")
    if (
        item.get("schemaVersion") != MATURITY_REPORT_ARTIFACT_SCHEMA
        or item.get("projectId") != project_id
        or not report_id
        or not created_at
        or artifact_id in {".", ".."}
        or not re.fullmatch(r"[A-Za-z0-9._-]{1,160}", artifact_id)
    ):
        return False
    expected_path = (project_root / "artifacts" / artifact_id).resolve()
    storage_parent = maturity_report_storage_root().parent
    try:
        expected_relative = expected_path.relative_to(storage_parent).as_posix()
    except ValueError:
        return False
    return str(item.get("relativePath") or "") == expected_relative


def _maturity_project_root(project_id: str) -> Path:
    storage_root = maturity_report_storage_root()
    current_root = _maturity_resolve_within(
        storage_root / _maturity_project_segment(project_id),
        storage_root,
        label="maturity report project path",
    )
    legacy_root = _maturity_resolve_within(
        storage_root / _maturity_artifact_segment(project_id, "assessment-project"),
        storage_root,
        label="maturity report legacy project path",
    )
    current_manifest_path = _maturity_resolve_within(
        current_root / "manifest.json",
        current_root,
        label="maturity report manifest path",
    )
    legacy_manifest_path = _maturity_resolve_within(
        legacy_root / "manifest.json",
        legacy_root,
        label="maturity report legacy manifest path",
    )
    if current_manifest_path.is_file():
        return current_root
    if legacy_root == current_root or not legacy_manifest_path.is_file():
        return current_root
    try:
        legacy_manifest = json.loads(legacy_manifest_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        raise RuntimeError(f"maturity report legacy manifest is unreadable: {legacy_manifest_path}") from error
    if not isinstance(legacy_manifest, dict) or not isinstance(legacy_manifest.get("projectId"), str):
        raise RuntimeError(f"maturity report legacy manifest has an invalid schema: {legacy_manifest_path}")
    return legacy_root if legacy_manifest.get("projectId") == project_id else current_root


def _read_maturity_report_manifest(project_id: str) -> dict[str, Any]:
    project_root = _maturity_project_root(project_id)
    manifest_path = _maturity_resolve_within(
        project_root / "manifest.json",
        project_root,
        label="maturity report manifest path",
    )
    if not manifest_path.is_file():
        return {"schemaVersion": MATURITY_REPORT_ARTIFACT_SCHEMA, "projectId": project_id, "artifacts": []}
    try:
        payload = json.loads(manifest_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        raise RuntimeError(f"maturity report manifest is unreadable: {manifest_path}") from error
    entries = payload.get("artifacts") if isinstance(payload, dict) else None
    if (
        not isinstance(payload, dict)
        or payload.get("schemaVersion") != MATURITY_REPORT_ARTIFACT_SCHEMA
        or payload.get("projectId") != project_id
        or not isinstance(entries, list)
        or any(not _valid_maturity_manifest_entry(project_id, project_root, item) for item in entries)
        or len({str(item.get("artifactId")) for item in entries}) != len(entries)
    ):
        raise RuntimeError(f"maturity report manifest has an invalid schema: {manifest_path}")
    return {
        "schemaVersion": MATURITY_REPORT_ARTIFACT_SCHEMA,
        "projectId": project_id,
        "artifacts": entries,
    }


def _maturity_report_manifest_lock(project_segment: str) -> Lock:
    with _MATURITY_REPORT_MANIFEST_LOCKS_GUARD:
        return _MATURITY_REPORT_MANIFEST_LOCKS.setdefault(project_segment, Lock())


@contextmanager
def _maturity_report_file_lock(handle, *, platform_name: str | None = None):
    if (platform_name or os.name) == "nt":
        import msvcrt

        handle.seek(0, os.SEEK_END)
        if handle.tell() == 0:
            handle.write(b"\0")
            handle.flush()
        handle.seek(0)
        msvcrt.locking(handle.fileno(), msvcrt.LK_LOCK, 1)
        try:
            yield
        finally:
            handle.seek(0)
            msvcrt.locking(handle.fileno(), msvcrt.LK_UNLCK, 1)
    else:
        import fcntl

        fcntl.flock(handle.fileno(), fcntl.LOCK_EX)
        try:
            yield
        finally:
            fcntl.flock(handle.fileno(), fcntl.LOCK_UN)


@contextmanager
def _maturity_report_process_lock(project_root: Path):
    """Serialize manifest updates across backend/App processes sharing one Runtime."""

    project_root.mkdir(parents=True, exist_ok=True)
    lock_path = _maturity_resolve_within(
        project_root / "manifest.lock",
        project_root,
        label="maturity report lock path",
    )
    with lock_path.open("a+b") as handle:
        with _maturity_report_file_lock(handle):
            yield


def persist_maturity_report_artifact(report: dict[str, Any], payload: dict[str, Any]) -> dict[str, Any]:
    project = payload.get("project") if isinstance(payload.get("project"), dict) else {}
    project_id = str(project.get("id") or "").strip()
    if not project_id:
        raise ValueError("project.id is required for report persistence")
    if not str(report.get("html") or "").strip() or not str(report.get("markdown") or "").strip():
        raise ValueError("generated report is missing HTML or Markdown content")

    project_root = _maturity_project_root(project_id)
    project_segment = project_root.name
    report_id = str(report.get("id") or "maturity-report").strip()
    created_at = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    artifact_suffix = f"-{time.strftime('%Y%m%d-%H%M%SZ', time.gmtime())}-{uuid.uuid4().hex[:8]}"
    artifact_prefix = _maturity_artifact_segment(report_id, "maturity-report")[: 96 - len(artifact_suffix)].rstrip(".-") or "maturity-report"
    artifact_id = f"{artifact_prefix}{artifact_suffix}"
    storage_root = maturity_report_storage_root()
    artifacts_root = _maturity_resolve_within(
        project_root / "artifacts",
        project_root,
        label="maturity report artifacts path",
    )
    artifact_root = _maturity_resolve_within(
        artifacts_root / artifact_id,
        artifacts_root,
        label="maturity report artifact path",
    )
    relative_path = artifact_root.relative_to(storage_root.parent).as_posix()
    persistence = {
        "schemaVersion": MATURITY_REPORT_ARTIFACT_SCHEMA,
        "mode": "local_user_artifact",
        "projectId": project_id,
        "reportId": report_id,
        "artifactId": artifact_id,
        "createdAt": created_at,
        "relativePath": relative_path,
    }
    persisted_report = {**report, "persistence": persistence}
    with _maturity_report_manifest_lock(project_segment):
        with _maturity_report_process_lock(project_root):
            manifest = _read_maturity_report_manifest(project_id)
            temporary_manifest: Path | None = None
            artifact_created = False
            try:
                artifact_root.mkdir(parents=True, exist_ok=False)
                artifact_created = True
                report_html_path = _maturity_resolve_within(artifact_root / "report.html", artifact_root, label="maturity report HTML path")
                report_markdown_path = _maturity_resolve_within(artifact_root / "report.md", artifact_root, label="maturity report Markdown path")
                report_json_path = _maturity_resolve_within(artifact_root / "report.json", artifact_root, label="maturity report JSON path")
                report_html_path.write_text(str(report.get("html") or ""), encoding="utf-8")
                report_markdown_path.write_text(str(report.get("markdown") or ""), encoding="utf-8")
                report_json_path.write_text(json.dumps(persisted_report, ensure_ascii=False, indent=2), encoding="utf-8")
                manifest_entry = {
                    **persistence,
                    "operation": str(payload.get("operation") or "create"),
                    "generatedAt": str(report.get("generatedAt") or ""),
                    "formal": bool(report.get("formal")),
                    "fileNames": report.get("fileNames") if isinstance(report.get("fileNames"), dict) else {},
                    "htmlBytes": report_html_path.stat().st_size,
                    "markdownBytes": report_markdown_path.stat().st_size,
                }
                manifest["artifacts"].append(manifest_entry)
                manifest_path = project_root / "manifest.json"
                temporary_manifest = project_root / f"manifest-{uuid.uuid4().hex}.tmp"
                temporary_manifest.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
                temporary_manifest.replace(manifest_path)
            except Exception:
                if temporary_manifest is not None:
                    temporary_manifest.unlink(missing_ok=True)
                if artifact_created and artifact_root.exists():
                    shutil.rmtree(artifact_root)
                raise
    return persisted_report


def create_and_persist_maturity_report(payload: dict[str, Any]) -> dict[str, Any]:
    report = create_maturity_report_snapshot(payload)
    if report.get("ok") is not True:
        return report
    return persist_maturity_report_artifact(report, payload)


def load_maturity_report_artifact(
    *,
    project_id: str,
    artifact_id: str = "",
    report_id: str = "",
    input_hash: str = "",
    result_hash: str = "",
) -> dict[str, Any]:
    normalized_project_id = str(project_id or "").strip()
    if not normalized_project_id:
        raise ValueError("project_id is required")
    manifest = _read_maturity_report_manifest(normalized_project_id)
    artifacts = manifest["artifacts"]
    project_root = _maturity_project_root(normalized_project_id)
    artifacts_root = _maturity_resolve_within(
        project_root / "artifacts",
        project_root,
        label="maturity report artifacts path",
    )

    def read_selected(selected: dict[str, Any]) -> dict[str, Any]:
        artifact_segment = str(selected.get("artifactId") or "")
        if artifact_segment in {".", ".."} or not re.fullmatch(r"[A-Za-z0-9._-]{1,160}", artifact_segment):
            return {"ok": False, "dataState": "invalid", "error": "invalid_report_artifact"}
        try:
            artifact_root = _maturity_resolve_within(
                artifacts_root / artifact_segment,
                artifacts_root,
                label="maturity report artifact path",
            )
            report_path = _maturity_resolve_within(
                artifact_root / "report.json",
                artifact_root,
                label="maturity report JSON path",
            )
        except RuntimeError:
            return {"ok": False, "dataState": "invalid", "error": "invalid_report_artifact_path"}
        if not report_path.is_file():
            return {"ok": False, "dataState": "missing", "error": "report_artifact_file_missing"}
        try:
            report = json.loads(report_path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            return {"ok": False, "dataState": "invalid", "error": "report_artifact_unreadable"}
        if not isinstance(report, dict):
            return {"ok": False, "dataState": "invalid", "error": "report_artifact_invalid"}
        persistence = report.get("persistence") if isinstance(report.get("persistence"), dict) else {}
        selected_report_id = str(selected.get("reportId") or "")
        if (
            persistence.get("projectId") != normalized_project_id
            or persistence.get("artifactId") != artifact_segment
            or persistence.get("reportId") != selected_report_id
        ):
            return {"ok": False, "dataState": "invalid", "error": "report_artifact_identity_mismatch"}
        report_id_value = str(report.get("id") or "")
        if report_id_value and report_id_value != selected_report_id:
            return {"ok": False, "dataState": "invalid", "error": "report_artifact_identity_mismatch"}
        report_model = report.get("reportModel") if isinstance(report.get("reportModel"), dict) else {}
        report_project = report_model.get("project") if isinstance(report_model.get("project"), dict) else {}
        report_project_id = str(report_project.get("id") or "")
        if report_project_id and report_project_id != normalized_project_id:
            return {"ok": False, "dataState": "invalid", "error": "report_artifact_identity_mismatch"}
        return report

    def matches_result_version(report: dict[str, Any]) -> bool:
        report_model = report.get("reportModel") if isinstance(report.get("reportModel"), dict) else {}
        result_snapshot = report_model.get("resultSnapshot") if isinstance(report_model.get("resultSnapshot"), dict) else {}
        calculation_run = result_snapshot.get("calculationRun") if isinstance(result_snapshot.get("calculationRun"), dict) else {}
        report_version = report_model.get("resultVersion") if isinstance(report_model.get("resultVersion"), dict) else {}
        input_matches = not input_hash or str(calculation_run.get("inputHash") or "") == input_hash
        result_matches = not result_hash or (
            str(calculation_run.get("resultHash") or "") == result_hash
            and str(report_version.get("resultHash") or "") == result_hash
        )
        return report.get("ok") is True and report.get("formal") is True and input_matches and result_matches

    selected = None
    if artifact_id:
        selected = next((item for item in reversed(artifacts) if str(item.get("artifactId") or "") == artifact_id), None)
        if selected and report_id and str(selected.get("reportId") or "") != report_id:
            return {"ok": False, "dataState": "invalid", "error": "report_artifact_selector_mismatch"}
    elif report_id:
        selected = next((item for item in reversed(artifacts) if str(item.get("reportId") or "") == report_id), None)
    if artifact_id or report_id:
        if not selected:
            return {"ok": False, "dataState": "missing", "error": "report_artifact_not_found"}
        if not (input_hash or result_hash):
            return read_selected(selected)
        selected_report = read_selected(selected)
        if selected_report.get("ok") is not True:
            return selected_report
        if matches_result_version(selected_report):
            return selected_report
        if input_hash and result_hash:
            selected_artifact_id = str(selected.get("artifactId") or "")
            for candidate in reversed(artifacts):
                if str(candidate.get("artifactId") or "") == selected_artifact_id:
                    continue
                candidate_report = read_selected(candidate)
                report_model = (
                    candidate_report.get("reportModel")
                    if isinstance(candidate_report.get("reportModel"), dict)
                    else {}
                )
                candidate_project = (
                    report_model.get("project")
                    if isinstance(report_model.get("project"), dict)
                    else {}
                )
                if (
                    candidate_project.get("id") == normalized_project_id
                    and matches_result_version(candidate_report)
                ):
                    return candidate_report
        return {"ok": False, "dataState": "missing", "error": "report_artifact_version_mismatch"}
    if input_hash or result_hash:
        for candidate in reversed(artifacts):
            report = read_selected(candidate)
            if matches_result_version(report):
                return report
    elif artifacts:
        selected = artifacts[-1]
    if not selected:
        return {"ok": False, "dataState": "missing", "error": "report_artifact_not_found"}
    return read_selected(selected)


def _persist_maturity_workbook_export(
    result: dict[str, Any],
    *,
    category: str,
    project: dict[str, Any] | None,
    business_name: str,
    suffix_label: str,
) -> dict[str, Any]:
    if result.get("ok") is not True:
        return result
    package = result.get("package") if isinstance(result.get("package"), dict) else {}
    encoded = str(package.get("workbookBase64") or "")
    if not encoded:
        raise ValueError("generated workbook is missing binary content")
    try:
        workbook_bytes = base64.b64decode(encoded, validate=True)
    except (ValueError, TypeError) as exc:
        raise ValueError("generated workbook content is invalid") from exc
    directory = _user_export_project_directory(category, project)
    safe_name = _user_export_segment(business_name, "成熟度评估")
    output_path = _write_unique_user_export(
        directory,
        f"{_user_export_timestamp()}_{safe_name}_{suffix_label}.xlsx",
        workbook_bytes,
    )
    export_result = _user_export_result(output_path, category=category)
    return {**result, **export_result, "export": export_result}


def export_maturity_score_exchange_for_runtime(payload: dict[str, Any]) -> dict[str, Any]:
    result = export_maturity_score_exchange(payload)
    if payload.get("saveToConfiguredDirectory") is not True:
        return result
    project = payload.get("project") if isinstance(payload.get("project"), dict) else {}
    return _persist_maturity_workbook_export(
        result,
        category="maturity-scores",
        project=project,
        business_name=str(project.get("name") or "成熟度评估"),
        suffix_label="评分表",
    )


def export_maturity_template_exchange_for_runtime(payload: dict[str, Any]) -> dict[str, Any]:
    result = export_maturity_template_exchange(payload)
    if payload.get("saveToConfiguredDirectory") is not True:
        return result
    template = payload.get("template") if isinstance(payload.get("template"), dict) else payload
    return _persist_maturity_workbook_export(
        result,
        category="maturity-templates",
        project=None,
        business_name=str(template.get("name") or "成熟度模板"),
        suffix_label="业务模板",
    )


def export_maturity_report_file(payload: dict[str, Any]) -> dict[str, Any]:
    project = payload.get("project") if isinstance(payload.get("project"), dict) else {}
    project_id = str(project.get("id") or payload.get("projectId") or "").strip()
    report = load_maturity_report_artifact(
        project_id=project_id,
        artifact_id=str(payload.get("artifactId") or "").strip(),
        report_id=str(payload.get("reportId") or "").strip(),
        input_hash=str(payload.get("inputHash") or "").strip(),
        result_hash=str(payload.get("resultHash") or "").strip(),
    )
    if report.get("ok") is not True:
        return report
    report_format = str(payload.get("format") or "html").strip().lower()
    if report_format not in {"html", "markdown"}:
        raise ValueError("report format must be html or markdown")
    report_model = report.get("reportModel") if isinstance(report.get("reportModel"), dict) else {}
    report_project = report_model.get("project") if isinstance(report_model.get("project"), dict) else {}
    normalized_project = {
        "id": project_id or report_project.get("id"),
        "name": project.get("name") or report_project.get("name") or "成熟度评估项目",
    }
    content_key = "html" if report_format == "html" else "markdown"
    extension = "html" if report_format == "html" else "md"
    content = str(report.get(content_key) or "")
    if not content.strip():
        raise ValueError(f"generated report is missing {report_format} content")
    directory = _user_export_project_directory("maturity-reports", normalized_project)
    project_name = _user_export_segment(normalized_project.get("name"), "成熟度评估项目")
    output_path = _write_unique_user_export(
        directory,
        f"{_user_export_timestamp()}_{project_name}_评估报告.{extension}",
        content,
    )
    persistence = report.get("persistence") if isinstance(report.get("persistence"), dict) else {}
    return _user_export_result(
        output_path,
        category="maturity-reports",
        extra={
            "format": report_format,
            "projectId": normalized_project.get("id"),
            "reportId": report.get("id"),
            "artifactId": persistence.get("artifactId"),
        },
    )


def _display_runtime_path(path: Path) -> str:
    resolved = path.resolve()
    try:
        return str(resolved.relative_to(PROJECT_ROOT))
    except ValueError:
        return str(resolved)


def _read_split_payload(data_path: Any) -> dict[str, Any] | None:
    path = _frontend_data_path(data_path)
    if not path or not path.exists():
        return None
    payload = _read_json(path)
    return payload if isinstance(payload, dict) else None


def _standards_detail_paths() -> list[tuple[str, Path]]:
    index_path = _data_package_path("standards-index")
    if not index_path.exists():
        return []
    try:
        index = _read_json(index_path)
    except Exception:
        return []
    paths: dict[str, Path] = {}
    for framework in _list(index.get("frameworks") if isinstance(index, dict) else []):
        if not isinstance(framework, dict):
            continue
        candidates = [framework.get("dataPath")]
        candidates.extend(tab.get("dataPath") for tab in _list(framework.get("tabs")) if isinstance(tab, dict))
        for data_path in candidates:
            path = _frontend_data_path(data_path)
            if not path:
                continue
            try:
                key = path.relative_to(DATA_PACKAGE_ROOT).as_posix()
            except ValueError:
                continue
            paths[key] = path
    return sorted(paths.items())


def read_standards_compat_package() -> dict[str, Any]:
    path = _data_package_path("standards-index")
    if not path.exists():
        return {"generated_at": None, "stats": {}, "__data_state": "missing_file"}
    cache_key = _package_cache_key(path)
    cached = _DATA_PACKAGE_CACHE.get("standards:compat")
    if cached and cached[0] == cache_key:
        return cached[1] if isinstance(cached[1], dict) else {"generated_at": None, "stats": {}, "__data_state": "invalid_file"}
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

    payload = {
        **index,
        "package_type": "standards-full-compat",
        "frameworks": frameworks,
    }
    _DATA_PACKAGE_CACHE["standards:compat"] = (cache_key, payload)
    return payload


SEARCH_INDEX_SOURCE_PACKAGES = (
    "capability",
    "capability-workbench",
    "environment-workbench",
    "lifecycle-workbench",
    "maintenance-index",
    "maintenance-scopes",
    "maintenance-services",
    "maintenance-modules",
    "maintenance-measures",
    "maintenance-processes",
    "maintenance-work-functions",
    "maintenance-references",
    "content",
    "standards-index",
)
_SEARCH_INDEX_CACHE: tuple[tuple[tuple[str, int, int], ...], dict[str, Any]] | None = None
_INTERNAL_SEARCH_HEX_ID_RE = re.compile(r"^(?:[a-z][a-z0-9_]*:)?[0-9a-f]{12,}$", re.IGNORECASE)
_INTERNAL_SEARCH_UUID_RE = re.compile(r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$", re.IGNORECASE)
_INTERNAL_SEARCH_TITLE_PREFIX_RE = re.compile(
    r"^(?:(?:[a-z][a-z0-9_]*:)?[0-9a-f]{12,}|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\s+",
    re.IGNORECASE,
)
_SEARCH_TOKEN_RE = re.compile(r"[a-z0-9][a-z0-9._-]{1,}|[\u4e00-\u9fa5]{2,}", re.IGNORECASE)
_SEARCH_QUERY_ALIASES = {
    "mima": "密码",
    "mi ma": "密码",
    "jiagou": "架构",
    "jia gou": "架构",
    "fengxian": "风险",
    "feng xian": "风险",
    "renliziyuan": "人力资源",
    "ren li zi yuan": "人力资源",
    "lingxinren": "零信任",
    "ling xin ren": "零信任",
}
_SEARCH_BUSINESS_ALIASES_BY_CODE: dict[str, str] = {}


def _search_source_signature() -> tuple[tuple[str, int, int], ...]:
    signature: list[tuple[str, int, int]] = []
    for name in SEARCH_INDEX_SOURCE_PACKAGES:
        path = _data_package_path(name)
        if not path.exists():
            signature.append((name, -1, -1))
            continue
        size, mtime_ns = _package_cache_key(path)
        signature.append((name, size, mtime_ns))
    for key, path in _standards_detail_paths():
        if not path.exists():
            signature.append((f"standards-detail:{key}", -1, -1))
            continue
        size, mtime_ns = _package_cache_key(path)
        signature.append((f"standards-detail:{key}", size, mtime_ns))
    return tuple(signature)


def _search_text(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, dict):
        return " ".join(str(value.get(key) or "") for key in ("code", "title", "name", "description", "summary"))
    if isinstance(value, list):
        return " ".join(_search_text(item) for item in value)
    return str(value)


def _search_compact(*values: Any) -> str:
    return " ".join(_search_text(value).strip() for value in values if _search_text(value).strip()).replace("\n", " ").strip()


def _search_plain(value: Any) -> str:
    return re.sub(r"[^a-z0-9\u4e00-\u9fa5]+", "", str(value or "").strip().lower())


def _search_query_variants(query: Any) -> list[str]:
    normalized = str(query or "").strip().lower()
    if not normalized:
        return []
    compact = _search_plain(normalized)
    variants = [normalized]
    if compact and compact != normalized:
        variants.append(compact)
    for key in (normalized, compact):
        alias = _SEARCH_QUERY_ALIASES.get(key)
        if alias:
            variants.append(alias.lower())
            variants.append(_search_plain(alias))
    return list(dict.fromkeys(value for value in variants if value))


def _search_damerau_distance_at_most_one(left: str, right: str) -> bool:
    if left == right:
        return True
    if not left or not right or abs(len(left) - len(right)) > 1:
        return False
    if len(left) == len(right):
        diffs = [index for index, (a, b) in enumerate(zip(left, right)) if a != b]
        if len(diffs) == 1:
            return True
        return len(diffs) == 2 and diffs[1] == diffs[0] + 1 and left[diffs[0]] == right[diffs[1]] and left[diffs[1]] == right[diffs[0]]
    if len(left) > len(right):
        left, right = right, left
    index = 0
    mismatches = 0
    for char in right:
        if index < len(left) and left[index] == char:
            index += 1
        else:
            mismatches += 1
            if mismatches > 1:
                return False
    return True


def _search_fuzzy_token_match(query: str, *values: Any) -> bool:
    compact_query = _search_plain(query)
    if len(compact_query) < 4 or not re.fullmatch(r"[a-z0-9]+", compact_query):
        return False
    haystack = " ".join(str(value or "").lower() for value in values)
    for token in _SEARCH_TOKEN_RE.findall(haystack):
        compact_token = _search_plain(token)
        if 4 <= len(compact_token) <= 48 and _search_damerau_distance_at_most_one(compact_query, compact_token):
            return True
    return False


def _search_contains(value: Any, normalized: str, compact: str) -> bool:
    text_value = str(value or "").lower()
    compact_value = _search_plain(text_value)
    return bool((normalized and normalized in text_value) or (compact and compact in compact_value))


def _search_startswith(value: Any, normalized: str, compact: str) -> bool:
    text_value = str(value or "").lower()
    compact_value = _search_plain(text_value)
    return bool((normalized and text_value.startswith(normalized)) or (compact and compact_value.startswith(compact)))


def _search_exact(value: Any, normalized: str, compact: str) -> bool:
    text_value = str(value or "").lower()
    compact_value = _search_plain(text_value)
    return bool(text_value == normalized or (compact and compact_value == compact))


def _search_match_details(item: dict[str, Any], query: str) -> tuple[int, str]:
    variants = _search_query_variants(query)
    if not variants:
        return 1, "empty"
    title = str(item.get("title") or "").lower()
    code = str(item.get("code") or "").lower()
    target_text = str(item.get("target_text") or "").lower()
    identity = str(item.get("_identity_search") or "").lower()
    content = str(item.get("_content_search") or "").lower()
    context = str(item.get("_context_search") or "").lower()
    for normalized in variants:
        compact = _search_plain(normalized)
        if _search_exact(code, normalized, compact):
            return 130, "code_exact"
        if _search_exact(title, normalized, compact) or _search_exact(target_text, normalized, compact):
            return 120, "title_exact"
        if _search_startswith(code, normalized, compact):
            return 105, "code_prefix"
        if _search_startswith(title, normalized, compact) or _search_startswith(target_text, normalized, compact):
            return 100, "title_prefix"
        if _search_contains(code, normalized, compact):
            return 90, "code_contains"
        if _search_contains(title, normalized, compact) or _search_contains(target_text, normalized, compact):
            return 80, "title_contains"
        if _search_contains(identity, normalized, compact):
            return 72, "identity_contains"
        if _search_contains(content, normalized, compact):
            return 42, "content_contains"
        if _search_contains(context, normalized, compact):
            return 24, "context_contains"
    if _search_fuzzy_token_match(variants[0], title, code, target_text, identity):
        return 34, "identity_fuzzy"
    if _search_fuzzy_token_match(variants[0], content):
        return 24, "content_fuzzy"
    return 0, "none"


def _workforce_slug(value: Any, fallback: str = "item") -> str:
    normalized = re.sub(r"[^\w\u4e00-\u9fa5-]+", "-", str(value or "").strip())
    normalized = normalized.strip("-")[:72]
    return normalized or fallback


def _gbt_task_name_from_title(title: Any) -> str:
    value = str(title or "").strip()
    parts = [part.strip() for part in re.split(r"[-－—]", value) if part.strip()]
    return "-".join(parts[1:]) if len(parts) > 1 else value


def _workforce_reference_row_id(field: str, item: dict[str, Any], index: int, title: str) -> str:
    if field == "gbt_42446_references":
        category = str(item.get("category") or "").strip()
        task = _gbt_task_name_from_title(title)
        return f"gbt-42446-classification-{_workforce_slug(category, 'category')}-{_workforce_slug(task, f'task-{index + 1}')}-{index + 1}"
    if field == "gartner_roles":
        category = str(item.get("category") or "").strip()
        return f"gartner-work-role-{_workforce_slug(category, 'category')}-{_workforce_slug(title, f'role-{index + 1}')}-{index + 1}"
    return str(item.get("id") or item.get("code") or title or f"{field}:{index}").strip()


def _search_business_aliases_for_item(item: dict[str, Any]) -> str:
    code = str(item.get("code") or "").strip()
    return _SEARCH_BUSINESS_ALIASES_BY_CODE.get(code, "")


def _is_internal_search_code(value: Any) -> bool:
    normalized = str(value or "").strip()
    if not normalized:
        return False
    return bool(_INTERNAL_SEARCH_UUID_RE.match(normalized) or _INTERNAL_SEARCH_HEX_ID_RE.match(normalized))


def _clean_search_display_text(value: Any) -> str:
    normalized = str(value or "").strip()
    while normalized:
        cleaned = _INTERNAL_SEARCH_TITLE_PREFIX_RE.sub("", normalized).strip()
        if cleaned == normalized:
            break
        normalized = cleaned
    return normalized


def _search_score(item: dict[str, Any], query: str) -> int:
    score, _match_kind = _search_match_details(item, query)
    return score


def _search_is_identity_match(item: dict[str, Any]) -> bool:
    return str(item.get("match_kind") or "").startswith(("code_", "title_", "identity_")) and int(item.get("score") or 0) >= 72


def _search_is_weak_match(item: dict[str, Any]) -> bool:
    match_kind = str(item.get("match_kind") or "")
    return match_kind.startswith(("content_", "context_")) or int(item.get("score") or 0) < 72


def _search_match_context(item: dict[str, Any], query: str) -> str:
    variants = _search_query_variants(query)
    if not variants:
        return ""
    _score, match_kind = _search_match_details(item, query)
    if match_kind.startswith(("code_", "title_", "identity_")):
        source = _search_compact(item.get("code"), item.get("title"), item.get("target_text"), item.get("_identity_search"))
    elif match_kind.startswith("content_"):
        source = _search_compact(item.get("_content_search"), item.get("title"), item.get("target_text"))
    elif match_kind.startswith("context_"):
        source = _search_compact(item.get("_context_search"), item.get("title"), item.get("target_text"))
    else:
        source = _search_compact(item.get("target_text"), item.get("_identity_search"), item.get("_content_search"), item.get("_context_search"))
    compact = _clean_search_display_text(re.sub(r"\s+", " ", source).strip())
    if not compact:
        return ""
    lower = compact.lower()
    match_index = -1
    match_length = 0
    for variant in variants:
        if not variant:
            continue
        index = lower.find(variant.lower())
        if index >= 0:
            match_index = index
            match_length = len(variant)
            break
    if match_index < 0:
        return compact[:180]
    start = max(0, match_index - 54)
    end = min(len(compact), match_index + match_length + 96)
    prefix = "..." if start > 0 else ""
    suffix = "..." if end < len(compact) else ""
    return f"{prefix}{compact[start:end]}{suffix}"


def _add_search_item(
    rows: list[dict[str, Any]],
    seen: set[str],
    *,
    item_id: Any,
    item_type: str,
    type_label: str,
    title: str,
    route: str,
    code: str = "",
    subtitle: str = "",
    target_ref: str = "",
    target_text: str = "",
    object_type: str = "",
    object_id: str = "",
    search_text: Any = "",
    aliases: Any = "",
    extra_fields: dict[str, Any] | None = None,
    search_subtitle: bool = True,
) -> None:
    raw_title = str(title or code or item_id or "").strip()
    raw_code = str(code or "").strip()
    normalized_title = _clean_search_display_text(raw_title)
    normalized_code = "" if _is_internal_search_code(raw_code) else raw_code
    normalized_id = str(item_id or object_id or target_ref or normalized_title).strip()
    normalized_route = str(route or "").strip()
    if not normalized_id and not normalized_title and not normalized_code:
        return
    key = f"{item_type}:{normalized_route}:{normalized_id}:{normalized_title}"
    if key in seen:
        return
    seen.add(key)
    display_title = " ".join(part for part in (normalized_code, normalized_title) if part)
    display_target_text = _clean_search_display_text(target_text or normalized_title or normalized_code)
    identity_search = _search_compact(normalized_code, normalized_title, display_target_text, aliases)
    content_search = _search_compact(search_text)
    context_search = _search_compact(subtitle if search_subtitle else "")
    row = {
        "id": normalized_id,
        "type": item_type,
        "typeLabel": type_label,
        "title": display_title,
        "code": normalized_code,
        "subtitle": str(subtitle or "").strip(),
        "route": normalized_route,
        "target_ref": str(target_ref or f"{object_type or item_type}:{normalized_id}").strip(),
        "target_text": display_target_text,
        "object_type": str(object_type or item_type).strip(),
        "object_id": str(object_id or normalized_id).strip(),
        "_identity_search": identity_search,
        "_content_search": content_search,
        "_context_search": context_search,
        "_search": _search_compact(type_label, identity_search, content_search, context_search),
    }
    if extra_fields:
        row.update({key: value for key, value in extra_fields.items() if value not in (None, "")})
    rows.append(row)


def _add_navigation_search_items(rows: list[dict[str, Any]], seen: set[str]) -> None:
    for item in (
        ("/", "Dashboard 首页", "总览 / 工作台入口 / 全局导航"),
        ("/search", "全局搜索", "跨能力、环境、生命周期、知识库和标准检索"),
        ("/workbench", "工作台", "Issue 清单 / 成熟度评估"),
        ("/workbench/annotations", "Issue 清单", "集中处理 Issue、状态、导出和复核"),
        ("/workbench/maturity", "成熟度评估", "评估项目 / 评分 / 报告"),
        ("/capability-mapping", "安全能力映射", "安全能力 / 安全关注点 / 技术与管理映射"),
        ("/environment-mapping", "信息化环境安全能力映射", "环境 / 子类 / 信息化对象 / 安全技术"),
        ("/development-security", "LC-AP安全开发生命周期", "应用安全开发生命周期"),
        ("/data-security", "LC-DT数据生命周期安全", "数据生命周期安全"),
        ("/knowledge/technical-services", "安全技术服务清单", "知识库字典"),
        ("/standards/mlps-level-3", "安全标准 / 框架", "标准控制项索引"),
        ("/standards/workforce-reference", "人力资源 Workforce 参考标准", "GB/T 42446-2023 / Gartner 工作岗位参考"),
        ("/guides/security-architecture-design", "安全指南", "指南 / 幻灯片"),
        ("/guides/security-architecture-modeling-language", "安全架构建模语言", "ArchiMate 3.2 企业架构建模标准 / 安全架构元素图例"),
        ("/guides/data-security-design", "数据安全设计方法", "数据安全设计方法 / 幻灯片"),
        ("/guides/light-planning", "轻规划", "轻规划设计报告模板 / 幻灯片"),
    ):
        route, title, subtitle = item
        _add_search_item(rows, seen, item_id=route, item_type="navigation", type_label="导航", title=title, route=route, subtitle=subtitle, target_ref=f"route:{route}", target_text=title, object_type="route", object_id=route)


def _add_capability_search_items(rows: list[dict[str, Any]], seen: set[str]) -> None:
    capability = read_data_package("capability")
    capability_workbench = read_data_package("capability-workbench")
    type_labels = {
        "capability_category": "能力分类",
        "capability_domain": "能力域",
        "capability": "安全能力",
        "capability_focus": "安全关注点",
    }
    trails_by_id: dict[str, list[str]] = {}

    def capability_label(item: dict[str, Any]) -> str:
        code = str(item.get("code") or "").strip()
        title = _title_of(item, "")
        return " ".join(part for part in (code, title) if part).strip() or title

    def visit(item: dict[str, Any], object_type: str, trail: list[str]) -> None:
        title = _title_of(item, "")
        code = str(item.get("code") or "").strip()
        item_id = str(item.get("id") or code or title).strip()
        subtitle = " / ".join(part for part in trail if part)
        _add_search_item(
            rows,
            seen,
            item_id=item_id,
            item_type="capability",
            type_label=type_labels.get(object_type, "安全能力"),
            title=title,
            code=code,
            subtitle=subtitle,
            route="/capability-mapping",
            target_ref=f"{object_type}:{item_id}",
            target_text=title,
            object_type=object_type,
            object_id=item_id,
            search_text=item.get("description") or item.get("summary"),
            search_subtitle=False,
        )
        next_trail = [*trail, capability_label(item)]
        if item_id:
            trails_by_id[item_id] = next_trail
        for domain in _list(item.get("domains")):
            if isinstance(domain, dict):
                visit(domain, "capability_domain", next_trail)
        for cap in _list(item.get("capabilities")):
            if isinstance(cap, dict):
                visit(cap, "capability", next_trail)
        for focus in _list(item.get("focuses")):
            if isinstance(focus, dict):
                visit(focus, "capability_focus", next_trail)

    for category in _list(capability.get("categories")):
        if isinstance(category, dict):
            visit(category, "capability_category", [])
    for focus in _list(capability.get("unlinked_focuses")):
        if isinstance(focus, dict):
            visit(focus, "capability_focus", ["未挂接关注点"])

    objects = capability_workbench.get("objects") if isinstance(capability_workbench.get("objects"), dict) else {}
    relations = [relation for relation in _list(capability_workbench.get("relations")) if isinstance(relation, dict)]

    def object_by_type(object_type: str, object_id: str) -> dict[str, Any] | None:
        rows_by_id = objects.get(object_type) if isinstance(objects.get(object_type), dict) else {}
        value = rows_by_id.get(object_id)
        return value if isinstance(value, dict) else None

    def add_mapping(mapping: dict[str, set[str]], key: str, value: str) -> None:
        if key and value:
            mapping.setdefault(key, set()).add(value)

    service_focus_ids: dict[str, set[str]] = {}
    service_module_ids: dict[str, set[str]] = {}
    service_measure_ids: dict[str, set[str]] = {}
    for relation in relations:
        relation_type = str(relation.get("type") or "").strip()
        source_type = str(relation.get("sourceType") or relation.get("source_type") or "").strip()
        target_type = str(relation.get("targetType") or relation.get("target_type") or "").strip()
        source_id = str(relation.get("sourceId") or relation.get("source_id") or "").strip()
        target_id = str(relation.get("targetId") or relation.get("target_id") or "").strip()
        if relation_type == "supports_focus" and source_type == "security_technical_service" and target_type == "capability_focus":
            add_mapping(service_focus_ids, source_id, target_id)
        elif relation_type == "implemented_by_module" and source_type == "security_technical_service" and target_type == "security_technology_module":
            add_mapping(service_module_ids, source_id, target_id)
        elif relation_type == "has_measure" and source_type == "security_technical_service" and target_type == "security_technical_measure":
            add_mapping(service_measure_ids, source_id, target_id)

    def add_capability_relation_item(
        *,
        item: dict[str, Any],
        focus_id: str,
        relation_type: str,
        type_label: str,
        object_type: str,
    ) -> None:
        focus = object_by_type("capability_focus", focus_id) or {}
        title = _title_of(item, "")
        code = str(item.get("code") or "").strip()
        item_id = str(item.get("id") or code or title).strip()
        if not item_id or not (title or code):
            return
        trail = trails_by_id.get(focus_id) or ([capability_label(focus)] if focus else [])
        _add_search_item(
            rows,
            seen,
            item_id=f"{focus_id}:{relation_type}:{item_id}",
            item_type="capability",
            type_label=type_label,
            title=title,
            code=code,
            subtitle=" / ".join(part for part in trail if part),
            route="/capability-mapping",
            target_ref=f"capability_relation:{relation_type}:{focus_id}:{item_id}",
            target_text=title,
            object_type=object_type,
            object_id=item_id,
            search_text=_search_compact(item.get("description"), item.get("summary")),
            aliases=_search_business_aliases_for_item(item),
            extra_fields={"selected_capability_id": focus_id},
            search_subtitle=False,
        )

    for service_id, focus_ids in service_focus_ids.items():
        service = object_by_type("security_technical_service", service_id)
        if not service:
            continue
        for focus_id in sorted(focus_ids):
            add_capability_relation_item(
                item=service,
                focus_id=focus_id,
                relation_type="security_technical_service",
                type_label="能力安全技术服务",
                object_type="security_technical_service",
            )
            for module_id in sorted(service_module_ids.get(service_id, set())):
                module = object_by_type("security_technology_module", module_id)
                if module:
                    add_capability_relation_item(
                        item=module,
                        focus_id=focus_id,
                        relation_type="security_technology_module",
                        type_label="能力安全技术模块",
                        object_type="security_technology_module",
                    )
            for measure_id in sorted(service_measure_ids.get(service_id, set())):
                measure = object_by_type("security_technical_measure", measure_id)
                if measure:
                    add_capability_relation_item(
                        item=measure,
                        focus_id=focus_id,
                        relation_type="security_technical_measure",
                        type_label="能力安全技术措施",
                        object_type="security_technical_measure",
                    )


def _add_maintenance_search_items(rows: list[dict[str, Any]], seen: set[str]) -> None:
    sections = [
        ("maintenance-scopes", "scope_types", "作用域", "/knowledge/scopes", "scope_type"),
        ("maintenance-services", "security_technical_services", "安全技术服务", "/knowledge/technical-services", "security_technical_service"),
        ("maintenance-modules", "security_technology_modules", "安全技术模块", "/knowledge/technical-modules", "security_technology_module"),
        ("maintenance-measures", "security_technical_measures", "安全技术措施", "/knowledge/technical-measures", "security_technical_measure"),
        ("maintenance-processes", "security_processes", "安全流程", "/knowledge/management-workflows", "security_process"),
        ("maintenance-work-functions", "work_function_layers", "安全职能", "/knowledge/functions", "work_function"),
        ("maintenance-references", "gbt_42446_references", "GB/T 42446 任务", "/standards/workforce-reference", "gbt_42446_task_reference"),
        ("maintenance-references", "gartner_roles", "Gartner 岗位参考", "/standards/workforce-reference", "work_role_reference"),
    ]
    for package_name, field, type_label, route, object_type in sections:
        payload = read_data_package(package_name)
        items = _list(payload.get(field))
        if field == "work_function_layers":
            items = [item for layer in items for group in _list(layer.get("groups")) for item in _list(group.get("functions"))]
        elif field == "security_processes":
            items = [reference for domain in items for group in _list(domain.get("groups")) for reference in _list(group.get("references"))]
        for index, item in enumerate(items):
            if not isinstance(item, dict):
                continue
            entity = item.get("service") if field == "security_technical_services" and isinstance(item.get("service"), dict) else item
            title = _title_of(entity, "")
            code = str(entity.get("code") or entity.get("id") or "").strip()
            item_id = _workforce_reference_row_id(field, entity, index, title) if field in {"gbt_42446_references", "gartner_roles"} else str(entity.get("id") or code or title or f"{field}:{index}").strip()
            target_ref = item_id if item_id.startswith(f"{object_type}:") else f"{object_type}:{item_id}"
            aliases = ""
            if field == "gbt_42446_references":
                aliases = "GB/T 42446 GB/T 42446-2023 网络安全从业人员能力基本要求 人力资源 Workforce 参考标准 工作任务 任务定义 工作类别分类"
            elif field == "gartner_roles":
                aliases = "Gartner 工作岗位参考 Gartner Role 人力资源 Workforce 参考标准 岗位 角色 职位"
            aliases = _search_compact(aliases, _search_business_aliases_for_item(entity))
            _add_search_item(
                rows,
                seen,
                item_id=item_id,
                item_type="maintenance",
                type_label=type_label,
                title=title,
                code=code,
                subtitle=_search_compact(entity.get("category"), item.get("category"), item.get("group"), item.get("layer"), item.get("scopes")),
                route=route,
                target_ref=target_ref,
                target_text=title,
                object_type=object_type,
                object_id=item_id,
                search_text=_search_compact(entity.get("description"), entity.get("summary"), entity.get("definition")),
                aliases=aliases,
            )


def _add_environment_search_items(rows: list[dict[str, Any]], seen: set[str]) -> None:
    workbench = read_data_package("environment-workbench")

    def visit(node: dict[str, Any], trail: list[str]) -> None:
        title = _title_of(node, "")
        item_id = str(node.get("id") or node.get("code") or title).strip()
        object_type = str(node.get("type") or "").strip() or "environment_object"
        type_label = {
            "information_environment": "信息化环境",
            "environment_segment": "环境子类",
            "information_object": "信息化对象",
        }.get(object_type, "信息化环境")
        _add_search_item(
            rows,
            seen,
            item_id=item_id,
            item_type="environment",
            type_label=type_label,
            title=title,
            code=str(node.get("code") or "").strip(),
            subtitle=" / ".join(part for part in trail if part),
            route="/environment-mapping",
            target_ref=f"{object_type}:{item_id}",
            target_text=title,
            object_type=object_type,
            object_id=item_id,
            search_text=node.get("description") or "",
        )
        next_trail = [*trail, title]
        for child in _list(node.get("children")):
            if isinstance(child, dict):
                visit(child, next_trail)

    for node in _list((workbench.get("navigator") or {}).get("tree")):
        if isinstance(node, dict):
            visit(node, [])

    def relation_id(item: dict[str, Any], fallback: str) -> str:
        return str(item.get("id") or item.get("code") or item.get("title") or item.get("name") or fallback).strip()

    def add_relation_item(
        item: dict[str, Any],
        *,
        relation_type: str,
        type_label: str,
        environment: dict[str, Any],
        object_row: dict[str, Any],
        scope: dict[str, Any],
        service: dict[str, Any] | None = None,
    ) -> None:
        object_id = relation_id(object_row, "")
        relation_item_id = relation_id(item, type_label)
        if not object_id or not relation_item_id:
            return
        environment_title = _title_of(environment, "")
        object_title = _title_of(object_row, "")
        segment_title = _search_compact(object_row.get("segments"))
        segment_id = ""
        for segment in _list(object_row.get("segments")):
            if isinstance(segment, dict):
                segment_id = relation_id(segment, "")
                if segment_id:
                    break
        scope_title = _title_of(scope, "")
        service_title = _title_of(service, "") if service else ""
        location_subtitle = " / ".join(part for part in (environment_title, segment_title, object_title, scope_title) if part)
        subtitle = " / ".join(part for part in (location_subtitle, service_title) if part)
        code = str(item.get("code") or "").strip()
        title = _title_of(item, "")
        _add_search_item(
            rows,
            seen,
            item_id=f"{object_id}:{relation_type}:{relation_item_id}",
            item_type="environment",
            type_label=type_label,
            title=title,
            code=code,
            subtitle=subtitle,
            route="/environment-mapping",
            target_ref=f"{relation_type}:{object_id}:{relation_item_id}",
            target_text=title,
            object_type="information_object",
            object_id=object_id,
            search_text=_search_compact(item.get("description"), item.get("category")),
            aliases=_search_business_aliases_for_item(item),
            search_subtitle=False,
            extra_fields={
                "selected_environment_id": relation_id(environment, ""),
                "selected_environment_segment_id": segment_id,
                "selected_environment_object_id": object_id,
            },
        )

    def add_relation_systems(
        systems: list[Any],
        *,
        environment: dict[str, Any],
        object_row: dict[str, Any],
        scope: dict[str, Any],
        service: dict[str, Any] | None = None,
    ) -> None:
        for system in systems:
            if isinstance(system, dict):
                add_relation_item(system, relation_type="security_system", type_label="安全系统", environment=environment, object_row=object_row, scope=scope, service=service)

    for environment in _list(workbench.get("environment_scope_tree")):
        if not isinstance(environment, dict):
            continue
        for object_row in _list(environment.get("objects")):
            if not isinstance(object_row, dict):
                continue
            for mapping in _list(object_row.get("scope_mappings")):
                if not isinstance(mapping, dict):
                    continue
                scope = mapping.get("scope") if isinstance(mapping.get("scope"), dict) else {}
                for service in _list(mapping.get("services")):
                    if not isinstance(service, dict):
                        continue
                    add_relation_item(service, relation_type="security_technical_service", type_label="环境安全技术服务", environment=environment, object_row=object_row, scope=scope)
                    for module in _list(service.get("modules")):
                        if not isinstance(module, dict):
                            continue
                        add_relation_item(module, relation_type="security_technology_module", type_label="环境安全技术模块", environment=environment, object_row=object_row, scope=scope, service=service)
                        add_relation_systems([*_list(module.get("securitySystems")), *_list(module.get("systems")), *_list(module.get("linkedSystems"))], environment=environment, object_row=object_row, scope=scope, service=service)
                    for measure in _list(service.get("measures")):
                        if not isinstance(measure, dict):
                            continue
                        add_relation_item(measure, relation_type="security_technical_measure", type_label="环境安全技术措施", environment=environment, object_row=object_row, scope=scope, service=service)
                        add_relation_systems([*_list(measure.get("securitySystems")), *_list(measure.get("systems")), *_list(measure.get("linkedSystems"))], environment=environment, object_row=object_row, scope=scope, service=service)
                    for node in _list(service.get("relationNodes")):
                        if not isinstance(node, dict):
                            continue
                        label = "环境安全技术措施" if str(node.get("relationKind") or node.get("kind") or node.get("objectKind") or "").find("measure") >= 0 or "措施" in _title_of(node, "") else "环境安全技术模块"
                        relation_type = "security_technical_measure" if label.endswith("措施") else "security_technology_module"
                        add_relation_item(node, relation_type=relation_type, type_label=label, environment=environment, object_row=object_row, scope=scope, service=service)
                        add_relation_systems([*_list(node.get("securitySystems")), *_list(node.get("systems")), *_list(node.get("linkedSystems"))], environment=environment, object_row=object_row, scope=scope, service=service)
                    add_relation_systems([*_list(service.get("securitySystems")), *_list(service.get("systems")), *_list(service.get("linkedSystems"))], environment=environment, object_row=object_row, scope=scope, service=service)


def _add_lifecycle_search_items(rows: list[dict[str, Any]], seen: set[str]) -> None:
    workbench = read_data_package("lifecycle-workbench")
    lifecycle = read_data_package("lifecycle")

    def visit(node: dict[str, Any], route: str, trail: list[str]) -> None:
        title = _title_of(node, "")
        item_id = str(node.get("id") or node.get("code") or title).strip()
        object_type = str(node.get("type") or "").strip() or "lifecycle_stage"
        if object_type in {"lifecycle_stage", "lifecycle_process"}:
            _add_search_item(
                rows,
                seen,
                item_id=item_id,
                item_type="lifecycle",
                type_label="生命周期阶段",
                title=title,
                code=str(node.get("code") or "").strip(),
                subtitle=" / ".join(part for part in trail if part),
                route=route,
                target_ref=f"{object_type}:{item_id}",
                target_text=title,
                object_type=object_type,
                object_id=item_id,
                search_text=node.get("description") or "",
            )
        next_route = route
        if str(node.get("code") or "").strip().startswith("DT-") or str(node.get("id") or "").strip().startswith("lifecycle_domain:LC-DT"):
            next_route = "/data-security"
        elif str(node.get("code") or "").strip().startswith("AP-") or str(node.get("id") or "").strip().startswith("lifecycle_domain:LC-AP"):
            next_route = "/development-security"
        for child in _list(node.get("children")):
            if isinstance(child, dict):
                visit(child, next_route, [*trail, title])

    for node in _list((workbench.get("navigator") or {}).get("tree")):
        if isinstance(node, dict):
            route = "/data-security" if "LC-DT" in str(node.get("id") or node.get("code") or "") else "/development-security"
            visit(node, route, [])

    def add_process_detail_items(process: dict[str, Any], route: str, process_label: str) -> None:
        process_id = str(process.get("id") or process.get("code") or process.get("title") or "").strip()
        process_title = _title_of(process, "")
        if not process_id:
            return
        detail_sections = (
            ("main_activities", "lifecycle_activity", "阶段主要活动"),
            ("security_activities", "lifecycle_control", "安全活动"),
            ("policy_requirements", "lifecycle_requirement", "安全策略要求"),
            ("development_types", "software_development_type", "软件开发模式"),
            ("scenes", "lifecycle_scene", "数据处理子场景"),
            ("technical_services", "security_technical_service", "安全技术服务"),
            ("technology_modules", "security_technology_module", "安全技术模块"),
            ("technical_measures", "security_technical_measure", "安全技术措施"),
            ("development_technical_services", "development_technical_service", "开发技术服务"),
            ("development_technical_modules", "development_technical_module", "开发技术模块"),
        )
        for field_name, object_type, type_label in detail_sections:
            for index, item in enumerate(_list(process.get(field_name))):
                if not isinstance(item, dict):
                    continue
                title = _title_of(item, "")
                code = str(item.get("code") or "").strip()
                if not title and not code:
                    continue
                child_id = str(item.get("id") or item.get("code") or title or f"{field_name}:{index}").strip()
                _add_search_item(
                    rows,
                    seen,
                    item_id=f"{process_id}:{field_name}:{child_id}",
                    item_type="lifecycle",
                    type_label=type_label,
                    title=title,
                    code=code,
                    subtitle=" / ".join(part for part in (process_label, process_title) if part),
                    route=route,
                    target_ref=f"{object_type}:{process_id}:{child_id}",
                    target_text=title,
                    object_type=object_type,
                    object_id=process_id,
                    search_text=_search_compact(item.get("description"), item.get("category"), process_title, process.get("description")),
                )
        for row_index, row in enumerate(_list(process.get("data_policy_rows"))):
            if not isinstance(row, dict):
                continue
            row_id = str(row.get("id") or f"data-policy-row:{row_index + 1}").strip()
            row_title = _search_compact(row.get("category"), row.get("sequence")) or "数据重要程度安全策略"
            policy_text = _search_compact(
                *[
                    _search_compact(
                        policy.get("level"),
                        policy.get("label"),
                        policy.get("code"),
                        policy.get("text"),
                        policy.get("reference"),
                        policy.get("status"),
                    )
                    for policy in _list(row.get("policies"))
                    if isinstance(policy, dict)
                ]
            )
            services = [item for item in _list(row.get("technical_services")) if isinstance(item, dict)]
            modules = [
                item
                for item in _list(row.get("module_or_measure_items") or row.get("technology_modules") or row.get("technical_measures"))
                if isinstance(item, dict)
            ]
            row_search_text = _search_compact(
                policy_text,
                *[_search_compact(item.get("code"), _title_of(item, ""), item.get("description"), item.get("category")) for item in services],
                *[
                    _search_compact(item.get("code"), _title_of(item, ""), item.get("description"), item.get("category"), item.get("objectKind"))
                    for item in modules
                ],
            )
            row_subtitle = " / ".join(part for part in (process_label, process_title, row_title) if part)
            _add_search_item(
                rows,
                seen,
                item_id=f"{process_id}:data_policy_row:{row_id}",
                item_type="lifecycle",
                type_label="数据重要程度安全策略矩阵",
                title=row_title,
                route=route,
                subtitle=row_subtitle,
                target_ref=f"lifecycle_policy_row:{process_id}:{row_id}",
                target_text=row_title,
                object_type="lifecycle_policy_row",
                object_id=process_id,
                search_text=row_search_text,
                extra_fields={
                    "selected_process_id": process_id,
                },
            )

            def add_policy_relation_item(item: dict[str, Any], relation_type: str, type_label: str) -> None:
                child_id = str(item.get("id") or item.get("code") or item.get("title") or item.get("name") or type_label).strip()
                title = _title_of(item, "")
                code = str(item.get("code") or "").strip()
                if not child_id or not (title or code):
                    return
                _add_search_item(
                    rows,
                    seen,
                    item_id=f"{process_id}:data_policy_relation:{relation_type}:{row_id}:{child_id}",
                    item_type="lifecycle",
                    type_label=type_label,
                    title=title,
                    code=code,
                    subtitle=row_subtitle,
                    route=route,
                    target_ref=f"lifecycle_policy_relation:{relation_type}:{process_id}:{row_id}:{child_id}",
                    target_text=title,
                    object_type=relation_type,
                    object_id=process_id,
                    search_text=_search_compact(item.get("description"), item.get("category"), item.get("objectKind")),
                    aliases=_search_business_aliases_for_item(item),
                    extra_fields={
                        "selected_process_id": process_id,
                    },
                    search_subtitle=False,
                )

            for service in services:
                add_policy_relation_item(service, "security_technical_service", "LC-DT 矩阵安全技术服务")
            for module in modules:
                object_kind = str(module.get("objectKind") or module.get("object_kind") or "").strip()
                relation_type = "security_technical_measure" if "措施" in object_kind else "security_technology_module"
                type_label = "LC-DT 矩阵安全技术措施" if relation_type == "security_technical_measure" else "LC-DT 矩阵安全技术模块"
                add_policy_relation_item(module, relation_type, type_label)

    app_lifecycle = lifecycle.get("application_security_development") or {}
    for process in _list(app_lifecycle.get("processes")):
        if isinstance(process, dict):
            add_process_detail_items(process, "/development-security", "LC-AP 阶段")
    data_lifecycle = lifecycle.get("data_lifecycle") or {}
    for process in _list(data_lifecycle.get("processes")):
        if isinstance(process, dict):
            add_process_detail_items(process, "/data-security", "LC-DT 过程")


STANDARD_SEARCH_CODE_FIELDS = (
    "Safeguard ID",
    "SCF编号",
    "控制项",
    "控制编号",
    "控制ID",
    "控制项ID",
    "保护措施编号",
    "等保控制项",
    "编号",
    "ID",
)
STANDARD_SEARCH_TITLE_FIELDS = (
    "SCF控制项",
    "保障措施描述",
    "控制项名称",
    "安全控制项名称",
    "控制名称",
    "等保三级控制要求",
    "名称",
    "描述",
    "保障措施域",
    "SCF域",
)
STANDARD_SEARCH_CONTEXT_FIELDS = (
    "保障措施分类",
    "保障措施域",
    "CRF成熟度等级",
    "保障措施系统",
    "SCF域",
    "策略原则",
    "策略意图",
    "NIST CSF功能分组",
    "等级保护",
    "等保要求",
    "等保控制项",
    "关联安全能力/关注点",
)


def _standard_row_values(row: Any) -> dict[str, Any]:
    if not isinstance(row, dict):
        return {}
    values = row.get("values")
    return values if isinstance(values, dict) else row


def _standard_pick(values: dict[str, Any], *fields: str) -> str:
    for field in fields:
        value = str(values.get(field) or "").strip()
        if value:
            return value
    return ""


def _standard_row_code(row: dict[str, Any], values: dict[str, Any]) -> str:
    for field in ("controlId", "controlCode", "code"):
        value = str(row.get(field) or "").strip()
        if value:
            return value
    return _standard_pick(values, *STANDARD_SEARCH_CODE_FIELDS)


def _standard_row_title(row: dict[str, Any], values: dict[str, Any], code: str, index: int) -> str:
    for field in ("title", "name"):
        value = str(row.get(field) or "").strip()
        if value:
            return value
    return _standard_pick(values, *STANDARD_SEARCH_TITLE_FIELDS) or code or f"标准控制项 {index + 1}"


def _standard_detail_payloads(framework: dict[str, Any]) -> list[dict[str, Any]]:
    payloads: list[dict[str, Any]] = []
    framework_payload = _read_split_payload(framework.get("dataPath"))
    if framework_payload:
        payloads.append(framework_payload)
    for tab in _list(framework.get("tabs")):
        if not isinstance(tab, dict):
            continue
        tab_payload = _read_split_payload(tab.get("dataPath"))
        if tab_payload:
            payloads.append({**tab, **tab_payload})
    return payloads


def _add_standard_search_items(rows: list[dict[str, Any]], seen: set[str]) -> None:
    standards = read_data_package("standards-index")
    for framework in _list(standards.get("frameworks")):
        if not isinstance(framework, dict):
            continue
        framework_id = str(framework.get("id") or "").strip()
        title = _title_of(framework, framework_id)
        route = str(framework.get("route") or f"/standards/{framework_id}").strip()
        _add_search_item(
            rows,
            seen,
            item_id=framework_id,
            item_type="standard",
            type_label="标准 / 框架",
            title=title,
            code=str(framework.get("frameworkCode") or framework_id).strip(),
            subtitle=_search_compact(framework.get("totalRows") and f"{framework.get('totalRows')} 条控制项"),
            route=route,
            target_ref=f"standard_framework:{framework_id}",
            target_text=title,
            object_type="standard_framework",
            object_id=framework_id,
            search_text=framework.get("columns"),
        )
        for tab in _list(framework.get("tabs")):
            if not isinstance(tab, dict):
                continue
            tab_id = str(tab.get("id") or tab.get("title") or "").strip()
            tab_title = _title_of(tab, tab_id)
            _add_search_item(
                rows,
                seen,
                item_id=tab_id,
                item_type="standard",
                type_label="标准表",
                title=tab_title,
                code=framework.get("frameworkCode") or framework_id,
                subtitle=title,
                route=route,
                target_ref=f"standard_table:{framework_id}:{tab_id}",
                target_text=tab_title,
                object_type="standard_table",
                object_id=tab_id,
                search_text=tab.get("columns"),
            )
        for table in _standard_detail_payloads(framework):
            table_id = str(table.get("id") or framework_id or "").strip()
            table_title = _title_of(table, table_id)
            table_route = str(table.get("route") or route).strip()
            for index, row in enumerate(_list(table.get("rows"))):
                if not isinstance(row, dict):
                    continue
                values = _standard_row_values(row)
                code = _standard_row_code(row, values)
                row_title = _standard_row_title(row, values, code, index)
                row_id = str(row.get("id") or f"{framework_id}:{table_id}:{index}").strip()
                if not row_id or not (row_title or code):
                    continue
                _add_search_item(
                    rows,
                    seen,
                    item_id=row_id,
                    item_type="standard",
                    type_label="标准控制项",
                    title=row_title,
                    code=code,
                    subtitle=_search_compact(title, table_title, _standard_pick(values, *STANDARD_SEARCH_CONTEXT_FIELDS)),
                    route=table_route,
                    target_ref=f"standard_control:{framework_id}:{table_id}:{row_id}",
                    target_text=row_title,
                    object_type="standard_control",
                    object_id=row_id,
                    search_text=_search_compact(list(values.values())),
                    extra_fields={
                        "standardFramework": framework_id,
                        "standardTableId": table_id,
                        "selectedMaintenanceId": row_id,
                    },
                )


def _add_content_search_items(rows: list[dict[str, Any]], seen: set[str]) -> None:
    content = read_data_package("content")
    for field, type_label in (("html_documents", "HTML 文档"), ("diagram_views", "图示"), ("guide_pages", "指南")):
        for item in _list(content.get(field)):
            if not isinstance(item, dict):
                continue
            item_id = str(item.get("id") or item.get("route") or item.get("title") or "").strip()
            title = _title_of(item, item_id)
            route = str(item.get("route") or f"/guides/{item_id}").strip()
            _add_search_item(
                rows,
                seen,
                item_id=item_id,
                item_type="content",
                type_label=type_label,
                title=title,
                subtitle=_search_compact(item.get("category"), item.get("view_type")),
                route=route,
                target_ref=f"content:{item_id}",
                target_text=title,
                object_type="content",
                object_id=item_id,
                search_text=_search_compact(item.get("summary"), item.get("description")),
            )


def build_search_index() -> dict[str, Any]:
    global _SEARCH_INDEX_CACHE
    signature = _search_source_signature()
    if _SEARCH_INDEX_CACHE and _SEARCH_INDEX_CACHE[0] == signature:
        return _SEARCH_INDEX_CACHE[1]
    rows: list[dict[str, Any]] = []
    seen: set[str] = set()
    _add_navigation_search_items(rows, seen)
    _add_capability_search_items(rows, seen)
    _add_maintenance_search_items(rows, seen)
    _add_environment_search_items(rows, seen)
    _add_lifecycle_search_items(rows, seen)
    _add_standard_search_items(rows, seen)
    _add_content_search_items(rows, seen)
    generated_at_values = [
        str(read_data_package(name).get("generated_at") or "")
        for name in ("capability", "environment-workbench", "lifecycle-workbench", "maintenance-index", "standards-index", "content")
    ]
    payload = {
        "generated_at": max((value for value in generated_at_values if value), default=None),
        "data_state": "ready",
        "package_type": "runtime-search-index",
        "items": rows,
        "stats": {
            "items": len(rows),
            "source_packages": len(SEARCH_INDEX_SOURCE_PACKAGES),
            "contract": "oi-149-search-index-p1",
        },
    }
    _SEARCH_INDEX_CACHE = (signature, payload)
    return payload


def _search_result_dedupe_key(item: dict[str, Any]) -> tuple[str, str, str] | None:
    if str(item.get("object_type") or "") != "standard_control":
        return None
    route = str(item.get("route") or "").strip()
    code = _search_plain(item.get("code") or "")
    title = _search_plain(item.get("target_text") or item.get("title") or "")
    identity = code or title
    if not route or not identity:
        return None
    return ("standard_control", route, identity)


def _dedupe_search_results(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    deduped: list[dict[str, Any]] = []
    seen: set[tuple[str, str, str]] = set()
    for row in rows:
        key = _search_result_dedupe_key(row)
        if key and key in seen:
            continue
        if key:
            seen.add(key)
        deduped.append(row)
    return deduped


def _spread_standard_search_results(rows: list[dict[str, Any]], limit: int) -> list[dict[str, Any]]:
    standard_routes = {
        str(row.get("route") or "").strip()
        for row in rows
        if str(row.get("object_type") or "") == "standard_control" and str(row.get("route") or "").strip()
    }
    if len(standard_routes) < 2:
        return rows
    per_route_cap = max(10, min(24, int(limit or 40) // 2 + 4))
    primary: list[dict[str, Any]] = []
    overflow: list[dict[str, Any]] = []
    route_counts: dict[str, int] = {}
    for row in rows:
        if str(row.get("object_type") or "") != "standard_control":
            primary.append(row)
            continue
        route = str(row.get("route") or "").strip()
        route_counts[route] = route_counts.get(route, 0) + 1
        if route and route_counts[route] > per_route_cap:
            overflow.append(row)
            continue
        primary.append(row)
    return primary + overflow


SEARCH_RESULT_CATEGORY_ORDER = ("全部", "安全能力", "信息化环境", "生命周期", "知识库", "标准 / 框架", "指南", "工作台", "其他")


def _search_result_category(item: dict[str, Any]) -> str:
    route = str(item.get("route") or "").strip()
    if route == "/capability-mapping":
        return "安全能力"
    if route == "/environment-mapping":
        return "信息化环境"
    if route in {"/development-security", "/data-security"}:
        return "生命周期"
    if route.startswith("/knowledge/"):
        return "知识库"
    if route.startswith("/standards"):
        return "标准 / 框架"
    if route.startswith("/guides/"):
        return "指南"
    if route.startswith("/workbench"):
        return "工作台"
    return "其他"


def _search_result_facets(rows: list[dict[str, Any]], limit: int, offset: int = 0) -> dict[str, Any]:
    category_counts: dict[str, int] = {"全部": len(rows)}
    for row in rows:
        category = _search_result_category(row)
        category_counts[category] = category_counts.get(category, 0) + 1
    categories = [
        {"label": label, "count": category_counts.get(label, 0)}
        for label in SEARCH_RESULT_CATEGORY_ORDER
        if label == "全部" or category_counts.get(label, 0) > 0
    ]
    returned = max(0, min(len(rows), offset + limit) - offset)
    return {
        "total": len(rows),
        "returned": returned,
        "limit": limit,
        "offset": offset,
        "truncated": offset + returned < len(rows),
        "categories": categories,
        "by_category": {label: count for label, count in category_counts.items() if count > 0},
    }


def search_index_payload(query: str = "", limit: int = 80, offset: int = 0, category: str = "") -> dict[str, Any]:
    index = build_search_index()
    normalized_query = str(query or "").strip()
    safe_limit = max(1, min(int(limit or 80), 120))
    safe_offset = max(0, int(offset or 0))
    normalized_category = str(category or "").strip()
    rows: list[dict[str, Any]] = []
    for item in _list(index.get("items")):
        if not isinstance(item, dict):
            continue
        score, match_kind = _search_match_details(item, normalized_query)
        if normalized_query and score <= 0:
            continue
        public_item = {key: value for key, value in item.items() if key not in {"_search", "_identity_search", "_content_search", "_context_search"}}
        public_item["score"] = score
        public_item["match_kind"] = match_kind
        match_context = _search_match_context(item, normalized_query)
        if match_context:
            public_item["match_context"] = match_context
        rows.append(public_item)
    if normalized_query and any(_search_is_identity_match(row) for row in rows):
        rows = [row for row in rows if not _search_is_weak_match(row)]
    rows.sort(key=lambda item: (-int(item.get("score") or 0), str(item.get("typeLabel") or ""), str(item.get("title") or "")))
    rows = _spread_standard_search_results(_dedupe_search_results(rows), safe_limit)
    facets = _search_result_facets(rows, safe_limit, safe_offset)
    if normalized_category and normalized_category != "全部":
        window_rows = [row for row in rows if _search_result_category(row) == normalized_category]
    else:
        window_rows = rows
    window_total = len(window_rows)
    result_rows = window_rows[safe_offset:safe_offset + safe_limit]
    return {
        "generated_at": index.get("generated_at"),
        "data_state": index.get("data_state") or "ready",
        "package_type": index.get("package_type") or "runtime-search-index",
        "query": normalized_query,
        "category": normalized_category,
        "offset": safe_offset,
        "results": result_rows,
        "facets": facets,
        "window": {
            "category": normalized_category,
            "offset": safe_offset,
            "limit": safe_limit,
            "returned": len(result_rows),
            "total": window_total,
            "truncated": safe_offset + len(result_rows) < window_total,
        },
        "stats": {
            **(index.get("stats") or {}),
            "returned": len(result_rows),
            "matched": facets["total"],
            "limit": safe_limit,
            "offset": safe_offset,
            "truncated": safe_offset + len(result_rows) < window_total,
            "by_category": facets["by_category"],
        },
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


def is_json_content_type(value: str) -> bool:
    return value.split(";", 1)[0].strip().lower() == "application/json"


def is_loopback_host(value: str) -> bool:
    host = str(value or "").strip().strip("[]").lower()
    if host == "localhost":
        return True
    try:
        return ipaddress.ip_address(host).is_loopback
    except ValueError:
        return False


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


def is_allowed_loopback_origin(value: str, port: int) -> bool:
    raw_value = str(value or "").strip()
    if not raw_value:
        return True
    parsed = urlparse(raw_value)
    try:
        parsed_port = parsed.port or (443 if parsed.scheme == "https" else 80)
    except ValueError:
        return False
    return parsed.scheme == "http" and parsed_port == port and is_loopback_host(parsed.hostname or "")


def _initialize_user_schema(connection: sqlite3.Connection) -> None:
    connection.executescript(USER_SCHEMA_SQL)
    connection.executescript(USER_SCHEMA_V03_SQL)
    ensure_user_note_columns(connection)
    connection.execute(
        """
        INSERT INTO user_meta(key, value, updated_at)
        VALUES ('schema_version', ?, CURRENT_TIMESTAMP)
        ON CONFLICT(key) DO UPDATE SET
          value = excluded.value,
          updated_at = CURRENT_TIMESTAMP
        WHERE user_meta.value <> excluded.value
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


def ensure_user_db() -> None:
    global _EPHEMERAL_USER_DB_KEEPER
    if USER_STATE_EPHEMERAL:
        with _EPHEMERAL_USER_DB_LOCK:
            if _EPHEMERAL_USER_DB_KEEPER is None:
                connection = sqlite3.connect(
                    _EPHEMERAL_USER_DB_URI,
                    uri=True,
                    check_same_thread=False,
                )
                try:
                    _initialize_user_schema(connection)
                    connection.commit()
                except Exception:
                    connection.close()
                    raise
                _EPHEMERAL_USER_DB_KEEPER = connection
        return
    USER_DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    with closing(sqlite3.connect(USER_DB_PATH)) as connection, connection:
        _initialize_user_schema(connection)


def close_ephemeral_user_state() -> None:
    global _EPHEMERAL_USER_DB_KEEPER, _EPHEMERAL_USER_ARTIFACTS
    with _EPHEMERAL_USER_DB_LOCK:
        if _EPHEMERAL_USER_DB_KEEPER is not None:
            _EPHEMERAL_USER_DB_KEEPER.close()
            _EPHEMERAL_USER_DB_KEEPER = None
        if _EPHEMERAL_USER_ARTIFACTS is not None:
            _EPHEMERAL_USER_ARTIFACTS.cleanup()
            _EPHEMERAL_USER_ARTIFACTS = None


@contextmanager
def user_db_connection():
    ensure_user_db()
    connection = (
        sqlite3.connect(_EPHEMERAL_USER_DB_URI, uri=True)
        if USER_STATE_EPHEMERAL
        else sqlite3.connect(USER_DB_PATH)
    )
    try:
        connection.row_factory = sqlite3.Row
        connection.execute("PRAGMA foreign_keys = ON")
        with connection:
            yield connection
    finally:
        connection.close()


def runtime_health_payload(*, mcp_runtime_id: str | None = None) -> dict[str, Any]:
    schema_version = None
    user_ready = _EPHEMERAL_USER_DB_KEEPER is not None if USER_STATE_EPHEMERAL else USER_DB_PATH.exists()
    if USER_STATE_EPHEMERAL:
        schema_version = USER_SCHEMA_VERSION if user_ready else None
    else:
        try:
            if user_ready:
                with closing(sqlite3.connect(USER_DB_PATH)) as connection, connection:
                    row = connection.execute("SELECT value FROM user_meta WHERE key='schema_version'").fetchone()
                    schema_version = row[0] if row else None
        except sqlite3.Error:
            user_ready = False
            schema_version = None
    return {
        "status": "ok",
        "app": "SAPD Wiki",
        "app_version": APP_DISPLAY_VERSION,
        "mode": "local-api",
        "runtime": {
            "label": RUNTIME_LABEL,
            "runtime_id": mcp_runtime_id,
            "base_database": {
                "path": _display_runtime_path(BASE_DB_PATH),
                "exists": BASE_DB_PATH.exists(),
                "bytes": BASE_DB_PATH.stat().st_size if BASE_DB_PATH.exists() else 0,
            },
            "content_query_database": {
                "path": _display_runtime_path(CONTENT_QUERY_DB_PATH),
                "exists": CONTENT_QUERY_DB_PATH.exists(),
                "bytes": (
                    CONTENT_QUERY_DB_PATH.stat().st_size
                    if CONTENT_QUERY_DB_PATH.exists()
                    else 0
                ),
            },
            "content_asset_database": {
                "path": (
                    _display_runtime_path(CONTENT_ASSET_DB_PATH)
                    if CONTENT_ASSET_DB_PATH is not None
                    else None
                ),
                "exists": bool(
                    CONTENT_ASSET_DB_PATH is not None
                    and CONTENT_ASSET_DB_PATH.exists()
                ),
                "bytes": (
                    CONTENT_ASSET_DB_PATH.stat().st_size
                    if CONTENT_ASSET_DB_PATH is not None
                    and CONTENT_ASSET_DB_PATH.exists()
                    else 0
                ),
            },
            "user_database": {
                "path": "memory://isolated-web-dev" if USER_STATE_EPHEMERAL else _display_runtime_path(USER_DB_PATH),
                "ready": user_ready,
                "schema_version": schema_version,
                "persistent": not USER_STATE_EPHEMERAL,
            },
            "data_root": {
                "path": _display_runtime_path(DATA_PACKAGE_ROOT),
                "exists": DATA_PACKAGE_ROOT.exists(),
            },
            "export_directory": {
                "path": _display_runtime_path(USER_EXPORT_DIR),
                "exists": USER_EXPORT_DIR.exists(),
            },
            "import_directory": {
                "path": _display_runtime_path(USER_IMPORT_DIR),
                "exists": USER_IMPORT_DIR.exists(),
            },
            "app_data_root": {
                "path": _display_runtime_path(APP_DATA_ROOT),
                "exists": APP_DATA_ROOT.exists(),
            },
            "runtime_root": {
                "path": _display_runtime_path(APP_DATA_ROOT / "Runtime"),
                "exists": (APP_DATA_ROOT / "Runtime").exists(),
            },
            "settings_paths": {
                "data_root": str(APP_DATA_ROOT),
                "import_directory": str(USER_IMPORT_DIR),
                "download_directory": str(USER_EXPORT_DIR),
                "runtime_root": str(APP_DATA_ROOT / "Runtime"),
                "user_home": str(Path.home().resolve()),
            },
        },
        "auth": {
            "writes_require_token": True,
            "header": LOCAL_API_AUTH_HEADER,
        },
        "license": {
            "state": "open",
            "display_text": "开发环境",
            "activated": True,
            "can_skip": True,
        },
    }


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


def user_notes_export_payload() -> dict[str, Any]:
    notes = [note for note in list_user_notes({}).get("notes", []) if isinstance(note, dict)]

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
        "export_created_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "data_state": "ready",
        "contains_user_note_body": True,
        "privacy_note": "本导出包含用户批注正文，仅在需要反馈问题时主动分享。",
        "source": {
            "project_root": str(PROJECT_ROOT),
            "user_database": str(USER_DB_PATH),
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


def _markdown_value(value: Any, fallback: str = "未设置") -> str:
    text = str(value or "").replace("\r\n", "\n").replace("\r", "\n").strip()
    return text or fallback


def _markdown_inline(value: Any, fallback: str = "未设置") -> str:
    return " / ".join(_markdown_value(value, fallback).splitlines()) or fallback


def _markdown_count_lines(counts: Any, label_map: dict[str, str] | None = None) -> list[str]:
    if not isinstance(counts, dict) or not counts:
        return ["- 无"]
    lines = []
    for key, count in counts.items():
        label = label_map.get(key, key) if label_map else key
        lines.append(f"- {label}：{count}")
    return lines


def _markdown_note_body(value: Any) -> str:
    body = _markdown_value(value, "（无正文）")
    return "\n".join(f"> {line}" if line else ">" for line in body.splitlines())


def user_notes_export_markdown(payload: dict[str, Any]) -> str:
    summary = payload.get("summary") if isinstance(payload.get("summary"), dict) else {}
    source = payload.get("source") if isinstance(payload.get("source"), dict) else {}
    notes = [note for note in _list(payload.get("notes")) if isinstance(note, dict)]
    lines = [
        "# SAPD Wiki 批注导出",
        "",
        f"- 导出时间：{_markdown_inline(payload.get('export_created_at'))}",
        f"- 批注数量：{summary.get('note_count', len(notes))}",
        "- 隐私提醒：本文件包含用户批注正文，仅在需要反馈问题时主动分享。",
        "",
        "## 导出来源",
        "",
        f"- 项目目录：{_markdown_inline(source.get('project_root'))}",
        f"- 用户数据库：{_markdown_inline(source.get('user_database'))}",
        "",
        "## 汇总",
        "",
        "### 按状态",
        "",
        *_markdown_count_lines(summary.get("by_status"), USER_NOTE_STATUS_LABELS),
        "",
        "### 按页面",
        "",
        *_markdown_count_lines(summary.get("by_page_route")),
        "",
        "### 按锚点类型",
        "",
        *_markdown_count_lines(summary.get("by_anchor_type"), USER_NOTE_ANCHOR_LABELS),
        "",
        "### 按对象类型",
        "",
        *_markdown_count_lines(summary.get("by_object_type")),
        "",
        "## 批注清单",
        "",
    ]
    if not notes:
        lines.append("暂无批注。")
        return "\n".join(lines).rstrip() + "\n"
    for index, note in enumerate(notes, start=1):
        status = _markdown_inline(note.get("status") or "todo")
        status_label = USER_NOTE_STATUS_LABELS.get(status, status)
        anchor_type = _markdown_inline(note.get("anchor_type") or "object")
        anchor_label = USER_NOTE_ANCHOR_LABELS.get(anchor_type, anchor_type)
        page_title = _markdown_inline(note.get("page_title"))
        page_route = _markdown_inline(note.get("page_route"))
        object_title = _markdown_inline(note.get("object_title"))
        object_type = _markdown_inline(note.get("object_type"))
        target_ref = _markdown_inline(note.get("target_ref"))
        tags = "、".join(_markdown_inline(tag) for tag in _list(note.get("tags"))) or "无"
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
                f"- 创建时间：{_markdown_inline(note.get('created_at'))}",
                f"- 更新时间：{_markdown_inline(note.get('updated_at'))}",
                "",
                "批注正文：",
                "",
                _markdown_note_body(note.get("body")),
                "",
            ]
        )
    return "\n".join(lines).rstrip() + "\n"


def user_notes_export_file_name() -> str:
    return f"user-notes-export-{time.strftime('%Y%m%d-%H%M%SZ', time.gmtime())}.md"


def save_markdown_export(payload: dict[str, Any]) -> dict[str, Any]:
    content = str(payload.get("content") or "")
    if not content.strip():
        raise ValueError("content is required")
    raw_prefix = str(payload.get("filename_prefix") or "sapd-export").strip()
    category = str(payload.get("category") or "issues").strip()
    directory = _user_export_project_directory(category)
    requested_name = str(payload.get("filename") or "").strip()
    output_path = _write_unique_user_export(
        directory,
        requested_name or f"{raw_prefix}-{time.strftime('%Y%m%d-%H%M%SZ', time.gmtime())}.md",
        content,
    )
    return _user_export_result(output_path, category=category, extra={"export_type": "markdown"})


def save_user_notes_export(payload: dict[str, Any] | None = None) -> dict[str, Any]:
    payload = payload or user_notes_export_payload()
    result = save_markdown_export(
        {
            "filename_prefix": "user-notes-export",
            "category": "issues",
            "content": user_notes_export_markdown(payload),
        }
    )
    return {
        **result,
        "export_type": "user_notes",
        "note_count": payload["summary"]["note_count"],
    }


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


def _process_tree_from_management_rows(management_rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    groups: dict[str, dict[str, Any]] = {}
    for row in management_rows:
        activities = [
            {
                "id": activity.get("id") or activity.get("code") or _title_of(activity, "待确认活动"),
                "code": activity.get("code") or "",
                "name": _title_of(activity, "待确认活动"),
                "description": activity.get("description") or activity.get("summary") or "",
                "status": activity.get("status") or activity.get("state") or "",
            }
            for activity in _list(row.get("activities"))
            if isinstance(activity, dict)
        ]
        for process_group in _list(row.get("processGroups")):
            if not isinstance(process_group, dict):
                continue
            group_key = _entity_key(process_group) or _title_of(process_group, "待确认流程组")
            group = groups.setdefault(
                group_key,
                {
                    "l2ProcessGroup": _compact_entity(process_group, "待确认流程组"),
                    "l3Processes": [],
                    "_l3Index": {},
                },
            )
            for process_reference in _list(row.get("processReferences")):
                if not isinstance(process_reference, dict):
                    continue
                process_key = _entity_key(process_reference) or f"{group_key}:{_title_of(process_reference, '待确认流程')}"
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
                process["activities"] = _unique_by([*process["activities"], *activities])
    rows: list[dict[str, Any]] = []
    for group in groups.values():
        group.pop("_l3Index", None)
        rows.append(group)
    return rows


def _capability_aggregate_local_relation_map(
    selected_item: dict[str, Any],
    object_type: str,
    technical_rows: list[dict[str, Any]],
    management_rows: list[dict[str, Any]],
    standard_rows: list[dict[str, Any]],
) -> dict[str, Any]:
    focus_entity = _compact_projection_object(selected_item, object_type)
    scope_service_pairs: list[dict[str, Any]] = []
    service_links_by_id: dict[str, dict[str, Any]] = {}
    for row in technical_rows:
        status = str(row.get("status") or "").strip() or "unknown"
        services = _list(row.get("services"))
        candidate_services = _list(row.get("candidateServices"))
        row_services = services or candidate_services
        if not row_services:
            scope_service_pairs.append(_compact_scope_service_pair(row, None, status))
            continue
        for service in row_services:
            if not isinstance(service, dict):
                continue
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

    work_functions_by_layer = _empty_work_functions_by_layer()
    for stakeholder in [stakeholder for row in management_rows for stakeholder in _list(row.get("stakeholders"))]:
        if not isinstance(stakeholder, dict):
            continue
        layer = _layer_key(stakeholder.get("layer") or "")
        work_functions_by_layer[layer].append(stakeholder)
    for key, layer_rows in work_functions_by_layer.items():
        work_functions_by_layer[key] = _unique_by(layer_rows)

    return {
        "focus": focus_entity,
        "technical": {
            "scopeServicePairs": scope_service_pairs,
            "serviceModuleMeasureLinks": [
                {
                    **link,
                    "scopes": [_compact_entity(scope, "未命名作用域") for scope in _list(link["scopes"]) if scope],
                    "modules": _list(link["modules"]),
                    "measures": _list(link["measures"]),
                }
                for link in service_links_by_id.values()
            ],
        },
        "management": {
            "securityWorks": _unique_by([work for row in management_rows for work in _list(row.get("securityWorks"))]),
            "workFunctionsByLayer": work_functions_by_layer,
            "processTree": _process_tree_from_management_rows(management_rows),
        },
        "standards": {
            "frameworks": _unique_by([framework for row in standard_rows for framework in _list(row.get("standards"))]),
            "controls": _unique_by([control for row in standard_rows for control in _list(row.get("controls"))]),
        },
        "sourceEvidence": [],
    }


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
    is_focus_projection = normalized_object_type == "capability_focus"
    local_relation_maps: list[dict[str, Any]] = []
    if is_focus_projection:
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
    aggregate_local_relation_map = (
        _capability_aggregate_local_relation_map(selected_item, normalized_object_type, technical_rows, management_rows, standard_rows)
        if selected_item and is_focus_projection
        else None
    )
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
        "localRelationMap": aggregate_local_relation_map,
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


def _content_request_context() -> RequestContext:
    return RequestContext(
        client_id="sapd-web-app",
        grant_version="same-origin-read-v1",
        scope=SCOPE,
        correlation_id=f"web-{uuid.uuid4()}",
    )


def _content_limit(query: dict[str, list[str]], default: int) -> int:
    raw_value = (query.get("limit") or [str(default)])[0]
    try:
        return int(raw_value)
    except (TypeError, ValueError) as exc:
        raise ValueError("limit must be an integer") from exc


def content_knowledge_response(
    path: str,
    query: dict[str, list[str]],
) -> dict[str, Any]:
    """Dispatch the same five read-only operations used by the formal MCP."""

    request = _content_request_context()
    with BaseKnowledgeQueryService.create(
        base_database=CONTENT_QUERY_DB_PATH,
        cursor_key=_CONTENT_CURSOR_KEY,
    ) as service:
        if path == "/api/v1/knowledge/search":
            return service.search_knowledge(
                (query.get("q") or [""])[0],
                request=request,
                limit=_content_limit(query, 8),
                cursor=(query.get("cursor") or [None])[0],
            ).to_dict()
        if path == "/api/v1/knowledge/object":
            return service.get_knowledge_object(
                unquote((query.get("canonical_ref") or [""])[0]),
                request=request,
            ).to_dict()
        if path == "/api/v1/knowledge/related":
            return service.get_related_knowledge(
                unquote((query.get("canonical_ref") or [""])[0]),
                (query.get("direction") or ["both"])[0],
                request=request,
                limit=_content_limit(query, 15),
                cursor=(query.get("cursor") or [None])[0],
            ).to_dict()
        if path == "/api/v1/knowledge/evidence":
            return service.get_source_evidence(
                unquote((query.get("canonical_ref") or [""])[0]),
                include_excerpt=False,
                request=request,
                limit=_content_limit(query, 8),
                cursor=(query.get("cursor") or [None])[0],
            ).to_dict()
        if path == "/api/v1/knowledge/version":
            return service.get_knowledge_version(request=request).to_dict()
    raise KeyError(path)


def content_asset_list_response(query: dict[str, list[str]]) -> dict[str, Any]:
    if CONTENT_ASSET_DB_PATH is None:
        raise ContentAssetError("content asset database is not configured")
    service = ContentAssetService(CONTENT_ASSET_DB_PATH)
    role_value = (query.get("asset_role") or query.get("role") or [None])[0]
    items = service.list_assets(
        owner_ref=unquote((query.get("owner_ref") or [""])[0]),
        asset_role=str(role_value) if role_value else None,
        limit=_content_limit(query, 50),
    )
    return {
        "contract_version": "sapd-content-asset-api-v1",
        "content_trust": "untrusted_reference",
        "data": {"items": items},
    }


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
        parsed = urlparse(self.path)
        if parsed.path.startswith("/api/v1/") and not self._require_api_host():
            return
        self.send_response(204)
        self.end_headers()

    def do_GET(self) -> None:
        parsed = urlparse(self.path)
        if parsed.path.startswith("/api/v1/"):
            if not self._require_api_host():
                return
            if parsed.path.startswith("/api/v1/mcp/"):
                self._handle_mcp_control(
                    "GET",
                    parsed.path,
                    parse_qs(parsed.query, keep_blank_values=True),
                )
                return
            if parsed.path == "/api/v1/content/assets/by-owner":
                self._serve_content_asset_by_owner(parse_qs(parsed.query))
                return
            asset_match = re.fullmatch(
                r"/api/v1/content/assets/([0-9a-fA-F]{64})",
                parsed.path,
            )
            if asset_match:
                self._serve_content_asset(asset_match.group(1).lower())
                return
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
        if parsed.path.startswith("/api/v1/mcp/"):
            self._handle_mcp_control("POST", parsed.path)
            return
        supported_paths = {
            "/api/v1/user/favorites",
            "/api/v1/user/notes",
            "/api/v1/user/exports/markdown",
            "/api/v1/maturity/calculate",
            "/api/v1/maturity/template/validate",
            "/api/v1/maturity/report",
            "/api/v1/maturity/report/export",
            "/api/v1/maturity/score/export",
            "/api/v1/maturity/score/import",
            "/api/v1/maturity/template/export",
            "/api/v1/maturity/template/import",
        }
        if parsed.path not in supported_paths:
            self._send_json(create_envelope({"error": "not_found", "path": parsed.path}), status=404)
            return
        if not self._require_user_write_boundary():
            return
        try:
            payload = self._read_json_body()
            if parsed.path == "/api/v1/user/notes":
                self._send_json(create_envelope(create_user_note(payload)))
            elif parsed.path == "/api/v1/user/favorites":
                self._send_json(create_envelope(upsert_user_favorite(payload)))
            elif parsed.path == "/api/v1/user/exports/markdown":
                self._send_json(create_envelope(save_markdown_export(payload)))
            elif parsed.path == "/api/v1/maturity/calculate":
                self._send_json(create_envelope(calculate_maturity_assessment(payload)))
            elif parsed.path == "/api/v1/maturity/template/validate":
                self._send_json(create_envelope(validate_maturity_template(payload.get("template") or payload)))
            elif parsed.path == "/api/v1/maturity/score/export":
                self._send_json(create_envelope(export_maturity_score_exchange_for_runtime(payload)))
            elif parsed.path == "/api/v1/maturity/score/import":
                self._send_json(create_envelope(import_maturity_score_exchange(payload)))
            elif parsed.path == "/api/v1/maturity/template/export":
                self._send_json(create_envelope(export_maturity_template_exchange_for_runtime(payload)))
            elif parsed.path == "/api/v1/maturity/template/import":
                self._send_json(create_envelope(import_maturity_template_exchange(payload)))
            elif parsed.path == "/api/v1/maturity/report/export":
                self._send_json(create_envelope(export_maturity_report_file(payload)))
            else:
                self._send_json(create_envelope(create_and_persist_maturity_report(payload)))
        except ValueError as exc:
            self._send_json(create_envelope({"error": "bad_request", "message": str(exc)}), status=400)
        except Exception as exc:
            self._send_json(create_envelope({"error": "server_error", "message": str(exc), "path": parsed.path}), status=500)

    def do_PATCH(self) -> None:
        parsed = urlparse(self.path)
        if not parsed.path.startswith("/api/v1/user/notes/"):
            self._send_json(create_envelope({"error": "not_found", "path": parsed.path}), status=404)
            return
        if not self._require_user_write_boundary():
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
        if not self._require_user_write_boundary():
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

    def _send_json_download(self, payload: Any, file_name: str, status: int = 200) -> None:
        encoded = json.dumps(payload, ensure_ascii=False, indent=2).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(encoded)))
        self.send_header("Content-Disposition", f'attachment; filename="{file_name}"')
        self.end_headers()
        self.wfile.write(encoded)

    def _send_text_download(self, content: str, file_name: str, content_type: str = "text/plain; charset=utf-8", status: int = 200) -> None:
        encoded = content.encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(encoded)))
        self.send_header("Content-Disposition", f'attachment; filename="{file_name}"')
        self.end_headers()
        self.wfile.write(encoded)

    def _serve_content_asset(self, asset_hash: str) -> None:
        if CONTENT_ASSET_DB_PATH is None:
            self._send_json(
                create_envelope(
                    {
                        "error": "service_unavailable",
                        "message": "content asset database is not configured",
                    }
                ),
                status=503,
            )
            return
        try:
            service = ContentAssetService(CONTENT_ASSET_DB_PATH)
            metadata = service.asset_metadata(asset_hash)
            byte_range = parse_http_byte_range(
                self.headers.get("Range"),
                int(metadata["byte_count"]),
            )
            partial = self.headers.get("Range") is not None
            self.send_response(206 if partial else 200)
            self.send_header("Content-Type", str(metadata["mime_type"]))
            self.send_header("Content-Length", str(byte_range.length))
            self.send_header("Accept-Ranges", "bytes")
            self.send_header("ETag", f'"sha256-{asset_hash}"')
            file_name = re.sub(
                r"[^A-Za-z0-9._-]+",
                "-",
                str(metadata["logical_file_name"]),
            ).strip(".-") or f"{asset_hash}.bin"
            self.send_header("Content-Disposition", f'inline; filename="{file_name}"')
            if partial:
                self.send_header(
                    "Content-Range",
                    f"bytes {byte_range.start}-{byte_range.end}/{byte_range.total}",
                )
            self.end_headers()
            service.stream_asset(asset_hash, self.wfile, byte_range)
        except ContentAssetNotFound:
            self._send_json(
                create_envelope({"error": "not_found", "message": "asset is unavailable"}),
                status=404,
            )
        except ContentAssetRangeError:
            self.send_response(416)
            self.send_header("Content-Range", "bytes */*")
            self.send_header("Content-Length", "0")
            self.end_headers()
        except ContentAssetError as exc:
            self._send_json(
                create_envelope({"error": "server_error", "message": str(exc)}),
                status=500,
            )

    def _serve_content_asset_by_owner(
        self,
        query: dict[str, list[str]],
    ) -> None:
        if CONTENT_ASSET_DB_PATH is None:
            self._send_json(
                create_envelope(
                    {
                        "error": "service_unavailable",
                        "message": "content asset database is not configured",
                    }
                ),
                status=503,
            )
            return
        try:
            service = ContentAssetService(CONTENT_ASSET_DB_PATH)
            metadata = service.asset_for_owner(
                owner_ref=unquote((query.get("owner_ref") or [""])[0]),
                asset_role=str(
                    (query.get("asset_role") or ["original"])[0]
                ).strip(),
            )
            self._serve_content_asset(str(metadata["asset_hash"]))
        except ContentAssetNotFound:
            self._send_json(
                create_envelope(
                    {"error": "not_found", "message": "asset is unavailable"}
                ),
                status=404,
            )
        except ContentAssetError as exc:
            self._send_json(
                create_envelope({"error": "bad_request", "message": str(exc)}),
                status=400,
            )

    def _api_port(self) -> int:
        return int(getattr(self.server, "server_port", self.server.server_address[1]))

    def _session_token(self) -> str:
        return str(getattr(self.server, "sapd_session_token", ""))

    def _send_api_forbidden(self, message: str) -> None:
        self._send_json(create_envelope({"error": "forbidden", "message": message}), status=403)

    def _require_api_host(self) -> bool:
        if is_allowed_host_header(self.headers.get("Host", ""), self._api_port()):
            return True
        self._send_api_forbidden("invalid Host header")
        return False

    def _require_user_write_boundary(self, *, require_json_content_type: bool = True) -> bool:
        if not self._require_api_host():
            return False
        if require_json_content_type and not is_json_content_type(self.headers.get("Content-Type", "")):
            self._send_json(
                create_envelope({"error": "unsupported_media_type", "message": "writes require Content-Type: application/json"}),
                status=415,
            )
            return False
        token = self.headers.get(LOCAL_API_AUTH_HEADER, "").strip()
        session_token = self._session_token()
        if not token or not session_token or not secrets.compare_digest(token, session_token):
            self._send_api_forbidden(f"writes require a valid {LOCAL_API_AUTH_HEADER} header")
            return False
        port = self._api_port()
        origin = self.headers.get("Origin", "").strip()
        if origin and not is_allowed_loopback_origin(origin, port):
            self._send_api_forbidden("cross-origin writes are not allowed")
            return False
        referer = self.headers.get("Referer", "").strip()
        if referer and not is_allowed_loopback_origin(referer, port):
            self._send_api_forbidden("cross-origin write referer is not allowed")
            return False
        return True

    def _read_json_body(self) -> dict[str, Any]:
        if not is_json_content_type(self.headers.get("Content-Type", "")):
            raise ValueError("Content-Type must be application/json")
        length = int(self.headers.get("Content-Length", "0"))
        raw = self.rfile.read(length).decode("utf-8") if length else "{}"
        payload = json.loads(raw or "{}")
        if not isinstance(payload, dict):
            raise ValueError("JSON body must be an object")
        return payload

    def _handle_mcp_control(
        self,
        method: str,
        path: str,
        query: dict[str, list[str]] | None = None,
    ) -> None:
        control_api = getattr(self.server, "sapd_mcp_control_api", None)
        if control_api is None:
            self._send_json(
                {
                    "contract_version": "sapd-mcp-control-v1",
                    "error": {
                        "code": "SUPERVISOR_UNAVAILABLE",
                        "message": "The MCP supervisor is unavailable.",
                        "retryable": True,
                        "current_state_version": None,
                    },
                },
                status=503,
            )
            return
        try:
            length = int(self.headers.get("Content-Length", "0") or "0")
        except ValueError:
            length = -1
        if length < 0 or length > MCP_CONTROL_BODY_LIMIT:
            self._send_json(
                {
                    "contract_version": "sapd-mcp-control-v1",
                    "error": {
                        "code": "INVALID_REQUEST",
                        "message": "The MCP control request body is invalid or too large.",
                        "retryable": False,
                        "current_state_version": None,
                    },
                },
                status=413 if length > MCP_CONTROL_BODY_LIMIT else 400,
            )
            return
        body = self.rfile.read(length) if length else None
        response = control_api.dispatch(
            method,
            path,
            {name: value for name, value in self.headers.items()},
            body,
            query,
        )
        encoded = response.json_bytes()
        self.send_response(response.status)
        for name, value in response.headers.items():
            self.send_header(name, value)
        self.send_header("Content-Length", str(len(encoded)))
        self.end_headers()
        self.wfile.write(encoded)

    def _handle_api(self, path: str, query: dict[str, list[str]]) -> None:
        parts = [part for part in path.split("/") if part]
        try:
            if path in {
                "/api/v1/knowledge/search",
                "/api/v1/knowledge/object",
                "/api/v1/knowledge/related",
                "/api/v1/knowledge/evidence",
                "/api/v1/knowledge/version",
            }:
                self._send_json(content_knowledge_response(path, query))
                return
            if path == "/api/v1/content/assets":
                self._send_json(content_asset_list_response(query))
                return
            if path == "/api/v1/health":
                supervisor = getattr(self.server, "sapd_mcp_supervisor", None)
                payload = runtime_health_payload(
                    mcp_runtime_id=(
                        supervisor.runtime_id
                        if supervisor is not None
                        else None
                    )
                )
                payload["auth"]["session_token"] = self._session_token()
                self._send_json(create_envelope(payload))
                return
            if path == "/api/v1/user/favorites":
                self._send_json(create_envelope(list_user_favorites()))
                return
            if path == "/api/v1/user/notes/export":
                should_download = str((query.get("download") or [""])[0]).strip().lower() in {"1", "true", "yes"}
                should_save = str((query.get("save") or [""])[0]).strip().lower() in {"1", "true", "yes"}
                if should_save and not should_download and not self._require_user_write_boundary(require_json_content_type=False):
                    return
                payload = user_notes_export_payload()
                if should_download:
                    self._send_text_download(user_notes_export_markdown(payload), user_notes_export_file_name(), "text/markdown; charset=utf-8")
                elif should_save:
                    self._send_json(create_envelope(save_user_notes_export(payload)))
                else:
                    self._send_json(payload)
                return
            if path == "/api/v1/user/notes":
                self._send_json(create_envelope(list_user_notes(query)))
                return
            if path == "/api/v1/data-packages":
                self._send_json(create_envelope({"packages": [{"name": name, "path": path} for name, path in DATA_PACKAGES.items()]}))
                return
            if path == "/api/v1/dashboard/knowledge-summary":
                self._send_json(create_envelope(dashboard_knowledge_summary()))
                return
            if path == "/api/v1/search-index":
                raw_limit = (query.get("limit") or ["80"])[0]
                raw_offset = (query.get("offset") or ["0"])[0]
                try:
                    limit = int(raw_limit)
                except (TypeError, ValueError):
                    limit = 80
                try:
                    offset = int(raw_offset)
                except (TypeError, ValueError):
                    offset = 0
                self._send_json(create_envelope(search_index_payload(query=(query.get("q") or [""])[0], limit=limit, offset=offset, category=(query.get("category") or [""])[0])))
                return
            if path == "/api/v1/maturity/workspace":
                self._send_json(
                    create_envelope(
                        build_maturity_workspace(
                            read_data_package("capability-workbench"),
                            project_profile=maturity_workspace_project_profile(),
                        )
                    )
                )
                return
            if path == "/api/v1/maturity/reports/artifact":
                self._send_json(
                    create_envelope(
                        load_maturity_report_artifact(
                            project_id=(query.get("project_id") or query.get("projectId") or [""])[0],
                            artifact_id=(query.get("artifact_id") or query.get("artifactId") or [""])[0],
                            report_id=(query.get("report_id") or query.get("reportId") or [""])[0],
                            input_hash=(query.get("input_hash") or query.get("inputHash") or [""])[0],
                            result_hash=(query.get("result_hash") or query.get("resultHash") or [""])[0],
                        )
                    )
                )
                return
            if path == "/api/v1/environments/dictionary":
                self._send_json(
                    create_envelope(read_data_package("environment-dictionary"))
                )
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
        except McpCoreError as exc:
            status = 404 if exc.code == "OBJECT_NOT_AVAILABLE" else 400
            self._send_json(
                create_envelope(
                    {"error": exc.code.lower(), "message": str(exc), "path": path}
                ),
                status=status,
            )
        except ContentAssetError as exc:
            self._send_json(
                create_envelope(
                    {"error": "invalid_asset_request", "message": str(exc), "path": path}
                ),
                status=400,
            )
        except ValueError as exc:
            self._send_json(
                create_envelope(
                    {"error": "bad_request", "message": str(exc), "path": path}
                ),
                status=400,
            )
        except KeyError as exc:
            self._send_json(create_envelope({"error": "not_found", "key": str(exc), "path": path}), status=404)
        except Exception as exc:
            self._send_json(create_envelope({"error": "server_error", "message": str(exc), "path": path}), status=500)


def reserved_preview_port_blockers(args: argparse.Namespace) -> list[str]:
    if int(getattr(args, "port", 0)) != RESERVED_STABLE_PREVIEW_PORT:
        return []
    blockers: list[str] = []
    runtime_label = str(getattr(args, "runtime_label", "stable") or "stable").strip()
    if runtime_label != "stable":
        blockers.append("runtime_label must be stable")
    if bool(getattr(args, "ephemeral_user_state", False)):
        blockers.append("ephemeral user state is test-only")
    path_contracts = (
        ("static_dir", getattr(args, "static_dir", None), DEFAULT_FRONTEND_STATIC_DIR),
        ("base_db", getattr(args, "base_db", None) or getattr(args, "db", None), DEFAULT_DB_PATH.resolve()),
        (
            "content_asset_db",
            getattr(args, "content_asset_db", None),
            DEFAULT_CONTENT_ASSET_DB_PATH,
        ),
        ("user_db", getattr(args, "user_db", None), DEFAULT_USER_DB_PATH),
        ("data_root", getattr(args, "data_root", None), DEFAULT_FRONTEND_PUBLIC_DATA_ROOT),
        ("export_dir", getattr(args, "export_dir", None), DEFAULT_USER_EXPORT_DIR),
    )
    for name, value, expected in path_contracts:
        if value and resolve_project_path(value).resolve() != expected:
            blockers.append(f"{name} must use the stable default path")
    if getattr(args, "mcp_runtime_root", None):
        blockers.append("explicit MCP runtime roots are test-only")
    return blockers


def validate_reserved_preview_runtime(args: argparse.Namespace) -> None:
    blockers = reserved_preview_port_blockers(args)
    if blockers:
        raise ValueError(
            "port 5173 is reserved for the stable SAPD Wiki preview; "
            "use a non-5173 port for fixture, dev, or ephemeral runtimes: "
            + "; ".join(blockers)
        )


def resolve_mcp_python_executable(value: str | Path | None = None) -> Path:
    configured = str(value or os.environ.get("SAPD_WIKI_MCP_PYTHON") or "").strip()
    candidates = []
    if configured:
        candidates.append(resolve_project_path(configured))
    candidates.extend(
        (
            PROJECT_ROOT / ".venv-local-mcp-web" / "bin" / "python",
            PROJECT_ROOT / ".venv-local-mcp-web" / "Scripts" / "python.exe",
        )
    )
    for candidate in candidates:
        if candidate.is_absolute() and candidate.is_file() and os.access(candidate, os.X_OK):
            return candidate
    raise ValueError(
        "isolated MCP Python runtime is unavailable; "
        "create .venv-local-mcp-web with the local-mcp optional dependencies"
    )


def default_mcp_certificate_identity_root() -> Path:
    """Fixed, non-user-configurable identity root for platform integration."""

    if os.name == "nt":
        local_app_data = os.environ.get("LOCALAPPDATA")
        if not local_app_data:
            raise ValueError("LOCALAPPDATA is required for Windows MCP identity")
        return (
            Path(local_app_data)
            / "SAPD Wiki"
            / "LocalMCP"
            / "Certificates"
            / "dev"
        )
    return (
        Path.home()
        / "Library"
        / "Application Support"
        / "SAPD Wiki"
        / "LocalMCP"
        / "Certificates"
        / "dev"
    )


def default_mcp_runtime_root() -> Path:
    """Persistent current-user Runtime root for MCP lifecycle and authorization."""

    if os.name == "nt":
        local_app_data = os.environ.get("LOCALAPPDATA")
        if not local_app_data:
            raise ValueError("LOCALAPPDATA is required for Windows MCP Runtime")
        return Path(local_app_data) / "SAPD Wiki" / "LocalMCP" / "Runtime" / "dev"
    return (
        Path.home()
        / "Library"
        / "Application Support"
        / "SAPD Wiki"
        / "LocalMCP"
        / "Runtime"
        / "dev"
    )


def serve(args: argparse.Namespace) -> None:
    validate_reserved_preview_runtime(args)
    if not is_loopback_host(str(args.host)):
        raise ValueError("SAPD Wiki Web and MCP control services must bind to a loopback host")
    static_dir = resolve_project_path(args.static_dir)
    configure_runtime_paths(
        base_db=getattr(args, "base_db", None) or getattr(args, "db", None),
        content_query_db=getattr(args, "content_query_db", None),
        content_asset_db=getattr(args, "content_asset_db", None),
        user_db=getattr(args, "user_db", None),
        data_root=getattr(args, "data_root", None),
        export_dir=getattr(args, "export_dir", None),
        import_dir=getattr(args, "import_dir", None),
        app_data_root=getattr(args, "app_data_root", None),
        app_version=getattr(args, "app_version", None),
        runtime_label=getattr(args, "runtime_label", None),
        ephemeral_user_state=bool(getattr(args, "ephemeral_user_state", False)),
    )
    handler = lambda *handler_args, **kwargs: SapdWikiRequestHandler(*handler_args, directory=str(static_dir), **kwargs)
    server = ThreadingHTTPServer((args.host, args.port), handler)
    server.sapd_session_token = secrets.token_urlsafe(32)
    actual_port = int(server.server_address[1])
    expected_host = f"{args.host}:{actual_port}"
    mcp_runtime_root = getattr(args, "mcp_runtime_root", None)
    platform_integration_enabled = bool(
        getattr(args, "mcp_platform_integration", False)
    )
    resolved_mcp_runtime_root = (
        Path(mcp_runtime_root)
        if mcp_runtime_root
        else default_mcp_runtime_root()
        if platform_integration_enabled
        else None
    )
    server.sapd_mcp_supervisor = DevSidecarSupervisor(
        configured_port=int(getattr(args, "mcp_port", 28775)),
        runtime_root=resolved_mcp_runtime_root,
        cleanup_on_close=resolved_mcp_runtime_root is None,
        python_executable=resolve_mcp_python_executable(getattr(args, "mcp_python", None)),
        base_database=CONTENT_QUERY_DB_PATH,
        certificate_identity_root=(
            default_mcp_certificate_identity_root()
            if platform_integration_enabled
            else None
        ),
        platform_integration_enabled=platform_integration_enabled,
        auto_restore_enabled=platform_integration_enabled,
    )
    server.sapd_mcp_control_api = build_dev_control_api(
        expected_host=expected_host,
        expected_origin=f"http://{expected_host}",
        session_token=server.sapd_session_token,
        supervisor=server.sapd_mcp_supervisor,
    )
    url = f"http://{args.host}:{args.port}"
    print(f"SAPD Wiki local API: {url}/api/v1/health")
    print(f"SAPD Wiki frontend:  {url}/")
    print(f"static_dir: {static_dir.relative_to(PROJECT_ROOT) if static_dir.is_relative_to(PROJECT_ROOT) else static_dir}")
    print(f"runtime_label: {RUNTIME_LABEL}")
    print(f"base_db: {_display_runtime_path(BASE_DB_PATH)}")
    print(f"content_query_db: {_display_runtime_path(CONTENT_QUERY_DB_PATH)}")
    print(
        "content_asset_db: disabled"
        if CONTENT_ASSET_DB_PATH is None
        else f"content_asset_db: {_display_runtime_path(CONTENT_ASSET_DB_PATH)}"
    )
    print(
        "user_db: memory://isolated-web-dev"
        if USER_STATE_EPHEMERAL
        else f"user_db: {_display_runtime_path(USER_DB_PATH)}"
    )
    print(f"data_root: {_display_runtime_path(DATA_PACKAGE_ROOT)}")
    print(f"app_data_root: {_display_runtime_path(APP_DATA_ROOT)}")
    print(f"import_dir: {_display_runtime_path(USER_IMPORT_DIR)}")
    print(f"export_dir: {_display_runtime_path(USER_EXPORT_DIR)}")

    def request_graceful_shutdown(_signum: int, _frame: Any) -> None:
        raise KeyboardInterrupt

    previous_signal_handlers: dict[int, Any] = {}
    for signal_number in (signal.SIGINT, signal.SIGTERM):
        try:
            previous_signal_handlers[signal_number] = signal.getsignal(signal_number)
            signal.signal(signal_number, request_graceful_shutdown)
        except ValueError:
            previous_signal_handlers.clear()
            break
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nserver stopped")
    finally:
        server.sapd_mcp_supervisor.close()
        close_ephemeral_user_state()
        server.server_close()
        for signal_number, previous_handler in previous_signal_handlers.items():
            signal.signal(signal_number, previous_handler)
