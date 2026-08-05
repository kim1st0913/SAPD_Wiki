#!/usr/bin/env python3
"""Create the ZIP alpha user database.

This script only initializes the writable user database for a ZIP bundle. It
does not read or modify the read-only base database.
"""

from __future__ import annotations

import argparse
import json
import sqlite3
import uuid
from contextlib import closing
from pathlib import Path


DEFAULT_SCHEMA_VERSION = "user_schema_0.3"


SCHEMA_SQL = """
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

SCHEMA_V03_SQL = """
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


def ensure_user_note_columns(connection: sqlite3.Connection) -> None:
    rows = connection.execute("PRAGMA table_info(user_notes)").fetchall()
    existing = {row[1] for row in rows}
    for column, definition in USER_NOTE_COLUMNS.items():
        if column not in existing:
            connection.execute(f"ALTER TABLE user_notes ADD COLUMN {column} {definition}")


def read_existing_schema_version(connection: sqlite3.Connection) -> str | None:
    try:
        row = connection.execute("SELECT value FROM user_meta WHERE key = 'schema_version'").fetchone()
    except sqlite3.Error:
        return None
    return str(row[0]) if row and row[0] else None


def initialize_user_db(db_path: Path, schema_version: str, *, record_change_log: bool = True) -> None:
    db_path.parent.mkdir(parents=True, exist_ok=True)
    with closing(sqlite3.connect(db_path)) as connection, connection:
        previous_schema_version = read_existing_schema_version(connection)
        connection.executescript(SCHEMA_SQL)
        connection.executescript(SCHEMA_V03_SQL)
        ensure_user_note_columns(connection)
        connection.execute(
            """
            INSERT INTO user_meta(key, value, updated_at)
            VALUES ('schema_version', ?, CURRENT_TIMESTAMP)
            ON CONFLICT(key) DO UPDATE SET
              value = excluded.value,
              updated_at = CURRENT_TIMESTAMP
            """,
            (schema_version,),
        )
        connection.execute(
            """
            INSERT INTO user_meta(key, value, updated_at)
            VALUES ('created_by', 'sapd-wiki-zip-alpha', CURRENT_TIMESTAMP)
            ON CONFLICT(key) DO NOTHING
            """
        )
        connection.execute(
            """
            INSERT INTO user_schema_migrations(version)
            VALUES (?)
            ON CONFLICT(version) DO NOTHING
            """,
            (schema_version,),
        )
        if record_change_log or previous_schema_version != schema_version:
            action = "initialize_user_db" if previous_schema_version in {None, schema_version} else "migrate_user_schema"
            payload = {
                "schema_version": schema_version,
                "previous_schema_version": previous_schema_version,
            }
            connection.execute(
                """
                INSERT INTO user_change_logs(id, action, target_ref, payload_json)
                VALUES (?, ?, NULL, ?)
                """,
                (str(uuid.uuid4()), action, json.dumps(payload, ensure_ascii=False)),
            )


def main() -> int:
    parser = argparse.ArgumentParser(description="Create sapd_wiki_user.sqlite3 for a ZIP bundle.")
    parser.add_argument("db_path", type=Path, help="Target user database path.")
    parser.add_argument("--schema-version", default=DEFAULT_SCHEMA_VERSION)
    args = parser.parse_args()

    initialize_user_db(args.db_path, args.schema_version)
    print(f"created_or_verified={args.db_path}")
    print(f"schema_version={args.schema_version}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
