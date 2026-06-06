#!/usr/bin/env node

import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const projectRoot = path.resolve(path.dirname(__filename), "..");

const DEFAULT_USER_DB = "data/user/sapd_wiki_user.sqlite3";
const DEFAULT_BASE_DB_CANDIDATES = ["data/base/sapd_wiki_base.sqlite3", "data/database/sapd_wiki.sqlite3"];
const DEFAULT_WORK_DIR = "/private/tmp";
const DEFAULT_USER_COPY = "sapd_wiki_user_schema_0_3_smoke.sqlite3";
const DEFAULT_BASE_COPY = "sapd_wiki_base_stable_key_smoke.sqlite3";

function usage() {
  return `
Usage:
  node scripts/smoke_db_migration_contracts.mjs [--user-db <path>] [--base-db <path>] [--work-dir <path>] [--json]

Copies the current base/user SQLite DBs to /private/tmp by default, applies the
user_schema_0.3 and base stable_key smoke migrations to the copies only, then
prints a compact summary. It never writes the project DB files.
`.trim();
}

function parseArgs(argv) {
  const args = {
    userDb: DEFAULT_USER_DB,
    baseDb: "",
    workDir: DEFAULT_WORK_DIR,
    json: false,
    help: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") {
      args.help = true;
    } else if (arg === "--json") {
      args.json = true;
    } else if (arg === "--user-db") {
      args.userDb = argv[++index] || "";
      if (!args.userDb) throw new Error("--user-db requires a path");
    } else if (arg === "--base-db") {
      args.baseDb = argv[++index] || "";
      if (!args.baseDb) throw new Error("--base-db requires a path");
    } else if (arg === "--work-dir") {
      args.workDir = argv[++index] || "";
      if (!args.workDir) throw new Error("--work-dir requires a path");
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return args;
}

function resolveProjectPath(inputPath) {
  return path.isAbsolute(inputPath) ? path.normalize(inputPath) : path.join(projectRoot, inputPath);
}

function displayPath(absolutePath) {
  const relative = path.relative(projectRoot, absolutePath);
  return relative && !relative.startsWith("..") && !path.isAbsolute(relative) ? relative : absolutePath;
}

function firstExisting(candidates) {
  for (const candidate of candidates) {
    const absolutePath = resolveProjectPath(candidate);
    if (existsSync(absolutePath)) return absolutePath;
  }
  return resolveProjectPath(candidates[0]);
}

function runPythonMigration(userCopy, baseCopy) {
  const python = String.raw`
import datetime
import hashlib
import json
import re
import sqlite3
import sys
import uuid

user_db = sys.argv[1]
base_db = sys.argv[2]

def now():
    return datetime.datetime.utcnow().replace(microsecond=0).isoformat() + "Z"

def columns(connection, table):
    return [row[1] for row in connection.execute(f"PRAGMA table_info({table})").fetchall()]

def table_exists(connection, table):
    return connection.execute(
        "SELECT 1 FROM sqlite_master WHERE type='table' AND name=?",
        (table,),
    ).fetchone() is not None

def add_column(connection, table, column, declaration):
    if column not in columns(connection, table):
        connection.execute(f"ALTER TABLE {table} ADD COLUMN {column} {declaration}")
        return True
    return False

def parse_metadata(raw):
    if not raw:
        return {}
    try:
        value = json.loads(raw)
        return value if isinstance(value, dict) else {}
    except Exception:
        return {}

def stable_slug(raw, fallback_prefix):
    value = str(raw or "").strip()
    if value and re.match(r"^[A-Za-z0-9][A-Za-z0-9._:#/-]*$", value) and not re.search(r"\s", value):
        return value
    digest = hashlib.sha256((value or fallback_prefix).encode("utf-8")).hexdigest()[:16]
    prefix = re.sub(r"[^A-Za-z0-9._:#/-]+", "-", str(fallback_prefix or "object")).strip("-") or "object"
    return f"{prefix}:hash:{digest}"

def public_id(prefix, stable_ref):
    digest = hashlib.sha256(stable_ref.encode("utf-8")).hexdigest()[:16]
    return f"{prefix}_{digest}"

def migrate_user_db(path):
    connection = sqlite3.connect(path)
    connection.execute("PRAGMA foreign_keys = ON")
    created = []
    ddl = {
        "user_workspaces": """
            CREATE TABLE IF NOT EXISTS user_workspaces (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                description TEXT,
                status TEXT NOT NULL DEFAULT 'active',
                sort_order INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )
        """,
        "user_workspace_items": """
            CREATE TABLE IF NOT EXISTS user_workspace_items (
                id TEXT PRIMARY KEY,
                workspace_id TEXT NOT NULL,
                target_ref TEXT NOT NULL,
                item_type TEXT,
                title TEXT,
                note TEXT,
                status TEXT NOT NULL DEFAULT 'active',
                sort_order INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                FOREIGN KEY(workspace_id) REFERENCES user_workspaces(id) ON DELETE CASCADE
            )
        """,
        "user_data_baskets": """
            CREATE TABLE IF NOT EXISTS user_data_baskets (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                description TEXT,
                status TEXT NOT NULL DEFAULT 'active',
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )
        """,
        "user_data_basket_items": """
            CREATE TABLE IF NOT EXISTS user_data_basket_items (
                id TEXT PRIMARY KEY,
                basket_id TEXT NOT NULL,
                target_ref TEXT NOT NULL,
                item_type TEXT,
                title TEXT,
                payload_json TEXT,
                sort_order INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                FOREIGN KEY(basket_id) REFERENCES user_data_baskets(id) ON DELETE CASCADE
            )
        """,
        "user_export_profiles": """
            CREATE TABLE IF NOT EXISTS user_export_profiles (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                format TEXT NOT NULL,
                config_json TEXT,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )
        """,
        "user_export_jobs": """
            CREATE TABLE IF NOT EXISTS user_export_jobs (
                id TEXT PRIMARY KEY,
                profile_id TEXT,
                status TEXT NOT NULL,
                output_path TEXT,
                summary_json TEXT,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )
        """,
        "user_capability_models": """
            CREATE TABLE IF NOT EXISTS user_capability_models (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                description TEXT,
                status TEXT NOT NULL DEFAULT 'draft',
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )
        """,
        "user_capability_model_nodes": """
            CREATE TABLE IF NOT EXISTS user_capability_model_nodes (
                id TEXT PRIMARY KEY,
                model_id TEXT NOT NULL,
                node_ref TEXT NOT NULL,
                parent_ref TEXT,
                node_type TEXT,
                title TEXT,
                payload_json TEXT,
                sort_order INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                FOREIGN KEY(model_id) REFERENCES user_capability_models(id) ON DELETE CASCADE
            )
        """,
        "user_capability_model_relations": """
            CREATE TABLE IF NOT EXISTS user_capability_model_relations (
                id TEXT PRIMARY KEY,
                model_id TEXT NOT NULL,
                source_ref TEXT NOT NULL,
                target_ref TEXT NOT NULL,
                relation_type TEXT NOT NULL,
                payload_json TEXT,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                FOREIGN KEY(model_id) REFERENCES user_capability_models(id) ON DELETE CASCADE
            )
        """,
        "user_import_staging_items": """
            CREATE TABLE IF NOT EXISTS user_import_staging_items (
                id TEXT PRIMARY KEY,
                import_job_id TEXT,
                target_ref TEXT,
                item_type TEXT,
                title TEXT,
                payload_json TEXT,
                review_status TEXT NOT NULL DEFAULT 'waiting_confirm',
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )
        """,
        "user_import_staging_relations": """
            CREATE TABLE IF NOT EXISTS user_import_staging_relations (
                id TEXT PRIMARY KEY,
                import_job_id TEXT,
                source_ref TEXT,
                target_ref TEXT,
                relation_type TEXT,
                payload_json TEXT,
                review_status TEXT NOT NULL DEFAULT 'waiting_confirm',
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )
        """,
        "user_review_decisions": """
            CREATE TABLE IF NOT EXISTS user_review_decisions (
                id TEXT PRIMARY KEY,
                subject_ref TEXT NOT NULL,
                decision TEXT NOT NULL,
                reviewer TEXT,
                note TEXT,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )
        """,
        "user_target_ref_migrations": """
            CREATE TABLE IF NOT EXISTS user_target_ref_migrations (
                id TEXT PRIMARY KEY,
                old_ref TEXT NOT NULL,
                new_ref TEXT,
                migration_type TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'planned',
                evidence_json TEXT,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )
        """,
    }
    existing = set(row[0] for row in connection.execute("SELECT name FROM sqlite_master WHERE type='table'"))
    for table, statement in ddl.items():
        connection.execute(statement)
        if table not in existing:
            created.append(table)
    if table_exists(connection, "user_meta"):
        connection.execute(
            "INSERT INTO user_meta(key, value, updated_at) VALUES('schema_version', 'user_schema_0.3', ?) "
            "ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at",
            (now(),),
        )
    if table_exists(connection, "user_schema_migrations"):
        migration_columns = columns(connection, "user_schema_migrations")
        if "version" in migration_columns:
            connection.execute(
                "INSERT OR IGNORE INTO user_schema_migrations(version, applied_at) VALUES('user_schema_0.3', ?)",
                (now(),),
            )
    if table_exists(connection, "user_change_logs"):
        change_columns = columns(connection, "user_change_logs")
        values = {
            "id": str(uuid.uuid4()),
            "target_ref": "user:schema:user_schema_0.3",
            "action": "user_schema_0_3_migration_smoke",
            "payload_json": json.dumps({"createdTables": created}, ensure_ascii=False),
            "created_at": now(),
        }
        insert_columns = [column for column in values if column in change_columns]
        if insert_columns:
            placeholders = ",".join("?" for _ in insert_columns)
            connection.execute(
                f"INSERT INTO user_change_logs({','.join(insert_columns)}) VALUES({placeholders})",
                [values[column] for column in insert_columns],
            )
    connection.commit()
    table_count = connection.execute("SELECT COUNT(*) FROM sqlite_master WHERE type='table'").fetchone()[0]
    schema_version = None
    if table_exists(connection, "user_meta"):
        row = connection.execute("SELECT value FROM user_meta WHERE key='schema_version'").fetchone()
        schema_version = row[0] if row else None
    connection.close()
    return {"createdTables": created, "tableCount": table_count, "schemaVersion": schema_version}

def migrate_base_db(path):
    connection = sqlite3.connect(path)
    connection.execute("PRAGMA foreign_keys = ON")
    added_columns = []
    for table in ("knowledge_items", "knowledge_relations"):
        for column in ("stable_key", "stable_ref", "public_id"):
            if add_column(connection, table, column, "TEXT"):
                added_columns.append(f"{table}.{column}")
    item_updates = 0
    if table_exists(connection, "knowledge_items"):
        item_columns = columns(connection, "knowledge_items")
        selected = [column for column in ("id", "type", "code", "title", "metadata_json") if column in item_columns]
        for row in connection.execute("SELECT " + ",".join(selected) + " FROM knowledge_items").fetchall():
            item = dict(zip(selected, row))
            metadata = parse_metadata(item.get("metadata_json"))
            raw_key = metadata.get("stable_key") or metadata.get("object_key") or item.get("code") or item.get("title") or item.get("id")
            item_type = item.get("type") or "knowledge_item"
            stable_key = stable_slug(raw_key, item_type)
            stable_ref = f"base:{item_type}:{stable_key}"
            connection.execute(
                "UPDATE knowledge_items SET stable_key=?, stable_ref=?, public_id=? WHERE id=?",
                (stable_key, stable_ref, public_id("ki", stable_ref), item.get("id")),
            )
            item_updates += 1
    relation_updates = 0
    if table_exists(connection, "knowledge_relations"):
        relation_columns = columns(connection, "knowledge_relations")
        selected = [column for column in ("id", "source_item_id", "target_item_id", "relation_type", "metadata_json") if column in relation_columns]
        for row in connection.execute("SELECT " + ",".join(selected) + " FROM knowledge_relations").fetchall():
            relation = dict(zip(selected, row))
            metadata = parse_metadata(relation.get("metadata_json"))
            relation_type = relation.get("relation_type") or "relation"
            raw_key = metadata.get("stable_key") or metadata.get("relation_key") or f"{relation.get('source_item_id')}:{relation_type}:{relation.get('target_item_id')}"
            stable_key = stable_slug(raw_key, relation_type)
            stable_ref = f"base_relation:{relation_type}:{stable_key}"
            connection.execute(
                "UPDATE knowledge_relations SET stable_key=?, stable_ref=?, public_id=? WHERE id=?",
                (stable_key, stable_ref, public_id("kr", stable_ref), relation.get("id")),
            )
            relation_updates += 1
    connection.execute("""
        CREATE TABLE IF NOT EXISTS base_id_redirects (
            id TEXT PRIMARY KEY,
            old_ref TEXT NOT NULL,
            new_ref TEXT,
            redirect_type TEXT NOT NULL,
            release_version TEXT,
            confidence REAL,
            note TEXT,
            created_at TEXT NOT NULL
        )
    """)
    connection.execute("CREATE UNIQUE INDEX IF NOT EXISTS idx_knowledge_items_stable_ref ON knowledge_items(stable_ref)")
    connection.execute("CREATE INDEX IF NOT EXISTS idx_knowledge_items_stable_key ON knowledge_items(type, stable_key)")
    connection.execute("CREATE UNIQUE INDEX IF NOT EXISTS idx_knowledge_relations_stable_ref ON knowledge_relations(stable_ref)")
    connection.execute("CREATE INDEX IF NOT EXISTS idx_knowledge_relations_stable_key ON knowledge_relations(relation_type, stable_key)")
    connection.execute("CREATE INDEX IF NOT EXISTS idx_base_id_redirects_old_ref ON base_id_redirects(old_ref)")
    connection.execute("CREATE INDEX IF NOT EXISTS idx_base_id_redirects_new_ref ON base_id_redirects(new_ref)")
    connection.commit()
    redirects = connection.execute("SELECT COUNT(*) FROM base_id_redirects").fetchone()[0]
    connection.close()
    return {
        "addedColumns": added_columns,
        "knowledgeItemsUpdated": item_updates,
        "knowledgeRelationsUpdated": relation_updates,
        "baseIdRedirectsRows": redirects,
    }

summary = {
    "user": migrate_user_db(user_db),
    "base": migrate_base_db(base_db),
}
print(json.dumps(summary, ensure_ascii=False, indent=2))
`;

  const completed = spawnSync("python3", ["-c", python, userCopy, baseCopy], {
    cwd: projectRoot,
    encoding: "utf8",
    maxBuffer: 1024 * 1024 * 30,
  });
  if (completed.error) throw completed.error;
  if (completed.status !== 0) {
    throw new Error((completed.stderr || completed.stdout || `python3 exited with ${completed.status}`).trim());
  }
  return JSON.parse(completed.stdout);
}

function main() {
  let args;
  try {
    args = parseArgs(process.argv.slice(2));
  } catch (error) {
    console.error(error.message);
    console.error(usage());
    process.exit(2);
  }
  if (args.help) {
    console.log(usage());
    return;
  }

  const userDb = resolveProjectPath(args.userDb);
  const baseDb = args.baseDb ? resolveProjectPath(args.baseDb) : firstExisting(DEFAULT_BASE_DB_CANDIDATES);
  if (!existsSync(userDb)) throw new Error(`user db not found: ${displayPath(userDb)}`);
  if (!existsSync(baseDb)) throw new Error(`base db not found: ${displayPath(baseDb)}`);

  const workDir = path.isAbsolute(args.workDir) ? args.workDir : path.join(projectRoot, args.workDir);
  mkdirSync(workDir, { recursive: true });
  const userCopy = path.join(workDir, DEFAULT_USER_COPY);
  const baseCopy = path.join(workDir, DEFAULT_BASE_COPY);
  copyFileSync(userDb, userCopy);
  copyFileSync(baseDb, baseCopy);

  const migration = runPythonMigration(userCopy, baseCopy);
  const output = {
    result: "pass",
    writesPerformedOnProjectDatabases: false,
    inputs: {
      userDb: displayPath(userDb),
      baseDb: displayPath(baseDb),
    },
    copies: {
      userDb: userCopy,
      baseDb: baseCopy,
    },
    migration,
  };

  if (args.json) {
    console.log(JSON.stringify(output, null, 2));
  } else {
    console.log(`result=${output.result}`);
    console.log(`writesPerformedOnProjectDatabases=${output.writesPerformedOnProjectDatabases}`);
    console.log(`userCopy=${output.copies.userDb}`);
    console.log(`baseCopy=${output.copies.baseDb}`);
    console.log(`userSchemaVersion=${migration.user.schemaVersion}`);
    console.log(`userV03CreatedTables=${migration.user.createdTables.length}`);
    console.log(`baseAddedColumns=${migration.base.addedColumns.length}`);
    console.log(`knowledgeItemsUpdated=${migration.base.knowledgeItemsUpdated}`);
    console.log(`knowledgeRelationsUpdated=${migration.base.knowledgeRelationsUpdated}`);
    console.log(`baseIdRedirectsRows=${migration.base.baseIdRedirectsRows}`);
  }
}

main();
