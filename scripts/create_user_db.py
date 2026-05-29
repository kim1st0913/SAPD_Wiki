#!/usr/bin/env python3
"""Create the ZIP alpha user database.

This script only initializes the writable user database for a ZIP bundle. It
does not read or modify the read-only base database.
"""

from __future__ import annotations

import argparse
import sqlite3
import uuid
from pathlib import Path


DEFAULT_SCHEMA_VERSION = "user_schema_0.1"


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


def initialize_user_db(db_path: Path, schema_version: str) -> None:
    db_path.parent.mkdir(parents=True, exist_ok=True)
    with sqlite3.connect(db_path) as connection:
        connection.executescript(SCHEMA_SQL)
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
        connection.execute(
            """
            INSERT INTO user_change_logs(id, action, target_ref, payload_json)
            VALUES (?, 'initialize_user_db', NULL, ?)
            """,
            (str(uuid.uuid4()), f'{{"schema_version":"{schema_version}"}}'),
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
