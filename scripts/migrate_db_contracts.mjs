#!/usr/bin/env node

import { copyFileSync, existsSync, mkdirSync, statSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const projectRoot = path.resolve(path.dirname(__filename), "..");

const DEFAULT_USER_DB = "data/user/sapd_wiki_user.sqlite3";
const DEFAULT_BASE_DB_CANDIDATES = ["data/base/sapd_wiki_base.sqlite3", "data/database/sapd_wiki.sqlite3"];
const DEFAULT_WORK_DIR = "/private/tmp/sapd-wiki-db-contract-migration";
const PROJECT_DATA_DIRS = ["data/user", "data/database", "data/base"].map((item) => path.join(projectRoot, item));

function usage() {
  return `
Usage:
  node scripts/migrate_db_contracts.mjs [--dry-run] [--apply]
    [--scope both|user|base]
    [--user-db <path>] [--base-db <path>]
    [--work-dir <path>] [--backup-dir <path>]
    [--confirm-project-db-write]
    [--json]

Default mode is --dry-run. It copies the selected SQLite DBs to a temporary
directory, applies the migration to those copies only, and reports the result.

--apply writes to the selected DB paths after creating backups. If any selected
DB is under data/user, data/database, or data/base, --apply also requires
--confirm-project-db-write.

This script covers:
  - user_schema_0.3 table creation and schema metadata update
  - user target_ref migration from legacy base UUID refs to stable refs
  - base stable_key / stable_ref / public_id promotion
  - base_id_redirects table and stable key indexes
`.trim();
}

function parseArgs(argv) {
  const args = {
    mode: "dry-run",
    scope: "both",
    userDb: DEFAULT_USER_DB,
    baseDb: "",
    workDir: DEFAULT_WORK_DIR,
    backupDir: "",
    confirmProjectDbWrite: false,
    json: false,
    help: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") {
      args.help = true;
    } else if (arg === "--json") {
      args.json = true;
    } else if (arg === "--dry-run") {
      args.mode = "dry-run";
    } else if (arg === "--apply") {
      args.mode = "apply";
    } else if (arg === "--confirm-project-db-write") {
      args.confirmProjectDbWrite = true;
    } else if (arg === "--scope") {
      args.scope = argv[++index] || "";
      if (!["both", "user", "base"].includes(args.scope)) throw new Error("--scope must be both, user, or base");
    } else if (arg === "--user-db") {
      args.userDb = argv[++index] || "";
      if (!args.userDb) throw new Error("--user-db requires a path");
    } else if (arg === "--base-db") {
      args.baseDb = argv[++index] || "";
      if (!args.baseDb) throw new Error("--base-db requires a path");
    } else if (arg === "--work-dir") {
      args.workDir = argv[++index] || "";
      if (!args.workDir) throw new Error("--work-dir requires a path");
    } else if (arg === "--backup-dir") {
      args.backupDir = argv[++index] || "";
      if (!args.backupDir) throw new Error("--backup-dir requires a path");
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return args;
}

function resolvePath(inputPath) {
  return path.isAbsolute(inputPath) ? path.normalize(inputPath) : path.join(projectRoot, inputPath);
}

function displayPath(absolutePath) {
  if (!absolutePath) return null;
  const relative = path.relative(projectRoot, absolutePath);
  return relative && !relative.startsWith("..") && !path.isAbsolute(relative) ? relative : absolutePath;
}

function firstExisting(candidates) {
  for (const candidate of candidates) {
    const absolutePath = resolvePath(candidate);
    if (existsSync(absolutePath)) return absolutePath;
  }
  return resolvePath(candidates[0]);
}

function isInside(childPath, parentPath) {
  const relative = path.relative(parentPath, childPath);
  return Boolean(relative) && !relative.startsWith("..") && !path.isAbsolute(relative);
}

function isProjectDataDb(dbPath) {
  return PROJECT_DATA_DIRS.some((dir) => dbPath === dir || isInside(dbPath, dir));
}

function timestamp() {
  return new Date().toISOString().replace(/[-:]/g, "").replace(/\..+$/, "Z");
}

function selectedTargets(args) {
  const targets = [];
  if (args.scope === "both" || args.scope === "user") {
    targets.push({ kind: "user", source: resolvePath(args.userDb) });
  }
  if (args.scope === "both" || args.scope === "base") {
    targets.push({ kind: "base", source: args.baseDb ? resolvePath(args.baseDb) : firstExisting(DEFAULT_BASE_DB_CANDIDATES) });
  }
  return targets;
}

function assertTargets(targets) {
  for (const target of targets) {
    if (!existsSync(target.source)) throw new Error(`${target.kind} db not found: ${displayPath(target.source)}`);
    if (!statSync(target.source).isFile()) throw new Error(`${target.kind} db is not a file: ${displayPath(target.source)}`);
  }
}

function prepareDryRunTargets(targets, workDir, stamp) {
  mkdirSync(workDir, { recursive: true });
  return targets.map((target) => {
    const copyPath = path.join(workDir, `${path.basename(target.source, ".sqlite3")}.${target.kind}.${stamp}.dry-run.sqlite3`);
    copyFileSync(target.source, copyPath);
    return { ...target, target: copyPath, backup: null, writesProjectDb: false };
  });
}

function defaultBackupDir(targets, args) {
  if (args.backupDir) return resolvePath(args.backupDir);
  if (targets.some((target) => isProjectDataDb(target.source))) {
    return path.join(projectRoot, "data/database/backups/db-contract-migrations");
  }
  return path.join(resolvePath(args.workDir), "backups");
}

function prepareApplyTargets(targets, args, stamp) {
  const projectTargets = targets.filter((target) => isProjectDataDb(target.source));
  if (projectTargets.length && !args.confirmProjectDbWrite) {
    throw new Error(
      `--apply targets project data DBs (${projectTargets.map((target) => displayPath(target.source)).join(", ")}). ` +
        "Pass --confirm-project-db-write after reviewing the dry-run output.",
    );
  }
  const backupDir = defaultBackupDir(targets, args);
  mkdirSync(backupDir, { recursive: true });
  return targets.map((target) => {
    const backup = path.join(backupDir, `${path.basename(target.source)}.before-db-contract-${stamp}.bak.sqlite3`);
    copyFileSync(target.source, backup);
    return { ...target, target: target.source, backup, writesProjectDb: isProjectDataDb(target.source) };
  });
}

function runPythonMigration(preparedTargets, args) {
  const userTarget = preparedTargets.find((target) => target.kind === "user")?.target || "";
  const preparedBaseTarget = preparedTargets.find((target) => target.kind === "base")?.target || "";
  const baseLookupTarget = preparedBaseTarget || (args.baseDb ? resolvePath(args.baseDb) : firstExisting(DEFAULT_BASE_DB_CANDIDATES));
  const shouldMigrateBase = preparedTargets.some((target) => target.kind === "base");
  const python = String.raw`
import datetime
import hashlib
import json
import os
import re
import sqlite3
import sys
import uuid

user_db = sys.argv[1]
base_db = sys.argv[2]
should_migrate_base = sys.argv[3] == "1"

def now():
    return datetime.datetime.now(datetime.UTC).replace(microsecond=0).isoformat().replace("+00:00", "Z")

def columns(connection, table):
    if not table_exists(connection, table):
        return []
    return [row[1] for row in connection.execute(f"PRAGMA table_info({table})").fetchall()]

def table_exists(connection, table):
    return connection.execute(
        "SELECT 1 FROM sqlite_master WHERE type='table' AND name=?",
        (table,),
    ).fetchone() is not None

def add_column(connection, table, column, declaration):
    if not table_exists(connection, table):
        return False
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

def is_uuid_like(value):
    return re.match(r"^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$", str(value or ""), re.I) is not None

def is_page_target_ref(value):
    ref = str(value or "")
    return (
        ":v2:" in ref
        or re.match(r"^base:security_guide:/guides/", ref) is not None
        or re.match(r"^base:security_guide_slide:guide:", ref) is not None
        or ref.startswith("page:")
    )

def is_stable_base_ref(value):
    ref = str(value or "")
    if is_page_target_ref(ref):
        return False
    if not re.match(r"^base:[^:]+:.+", ref):
        return False
    if re.match(r"^base:[^:]+:[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$", ref, re.I):
        return False
    return True

def is_stable_base_relation_ref(value):
    ref = str(value or "")
    return re.match(r"^base_relation:[^:]+:.+", ref) is not None and not is_uuid_like(ref.split(":")[-1])

def legacy_ref_parts(value):
    ref = str(value or "").strip()
    if not ref or is_page_target_ref(ref) or ref.startswith("user:") or ref.startswith("user_relation:"):
        return None
    if is_stable_base_ref(ref) or is_stable_base_relation_ref(ref):
        return None
    match = re.match(r"^base:([0-9a-f-]{36})$", ref, re.I)
    if match and is_uuid_like(match.group(1)):
        return {"kind": "item", "object_type": "", "uuid": match.group(1)}
    match = re.match(r"^base:([^:]+):([0-9a-f-]{36})$", ref, re.I)
    if match and is_uuid_like(match.group(2)):
        return {"kind": "item", "object_type": match.group(1), "uuid": match.group(2)}
    match = re.match(r"^base_relation:([^:]+):([0-9a-f-]{36})$", ref, re.I)
    if match and is_uuid_like(match.group(2)):
        return {"kind": "relation", "relation_type": match.group(1), "uuid": match.group(2)}
    return None

def item_stable_ref_from_row(row):
    stable_ref = row.get("stable_ref")
    if stable_ref:
        return stable_ref
    metadata = parse_metadata(row.get("metadata_json"))
    raw_key = metadata.get("stable_key") or metadata.get("object_key") or row.get("code") or row.get("title") or row.get("id")
    item_type = row.get("type") or "knowledge_item"
    return f"base:{item_type}:{stable_slug(raw_key, item_type)}"

def relation_stable_ref_from_row(row):
    stable_ref = row.get("stable_ref")
    if stable_ref:
        return stable_ref
    metadata = parse_metadata(row.get("metadata_json"))
    relation_type = row.get("relation_type") or "relation"
    raw_key = metadata.get("stable_key") or metadata.get("relation_key") or f"{row.get('source_item_id')}:{relation_type}:{row.get('target_item_id')}"
    return f"base_relation:{relation_type}:{stable_slug(raw_key, relation_type)}"

def load_base_ref_maps(path):
    maps = {"items": {}, "relations": {}}
    if not path or not os.path.exists(path):
        return maps
    connection = sqlite3.connect(path)
    connection.row_factory = sqlite3.Row
    if table_exists(connection, "knowledge_items"):
        item_columns = columns(connection, "knowledge_items")
        selected = [column for column in ("id", "type", "code", "title", "metadata_json", "stable_ref") if column in item_columns]
        if selected:
            for row in connection.execute("SELECT " + ",".join(selected) + " FROM knowledge_items").fetchall():
                item = dict(row)
                item_id = item.get("id")
                if item_id:
                    maps["items"][item_id] = {
                        "type": item.get("type") or "",
                        "stable_ref": item_stable_ref_from_row(item),
                    }
    if table_exists(connection, "knowledge_relations"):
        relation_columns = columns(connection, "knowledge_relations")
        selected = [column for column in ("id", "source_item_id", "target_item_id", "relation_type", "metadata_json", "stable_ref") if column in relation_columns]
        if selected:
            for row in connection.execute("SELECT " + ",".join(selected) + " FROM knowledge_relations").fetchall():
                relation = dict(row)
                relation_id = relation.get("id")
                if relation_id:
                    maps["relations"][relation_id] = {
                        "relation_type": relation.get("relation_type") or "",
                        "stable_ref": relation_stable_ref_from_row(relation),
                    }
    connection.close()
    return maps

def resolve_legacy_target_ref(ref, base_maps):
    parts = legacy_ref_parts(ref)
    if not parts:
        return None
    if parts["kind"] == "item":
        item = base_maps["items"].get(parts["uuid"])
        if not item:
            return {"status": "pending", "new_ref": None, "reason": "missing_base_item"}
        if parts.get("object_type") and item.get("type") and parts["object_type"] != item["type"]:
            return {"status": "pending", "new_ref": None, "reason": "object_type_mismatch"}
        return {"status": "applied", "new_ref": item["stable_ref"], "reason": "base_item_uuid_to_stable_ref"}
    relation = base_maps["relations"].get(parts["uuid"])
    if not relation:
        return {"status": "pending", "new_ref": None, "reason": "missing_base_relation"}
    if parts.get("relation_type") and relation.get("relation_type") and parts["relation_type"] != relation["relation_type"]:
        return {"status": "pending", "new_ref": None, "reason": "relation_type_mismatch"}
    return {"status": "applied", "new_ref": relation["stable_ref"], "reason": "base_relation_uuid_to_stable_ref"}

def safe_insert_change_log(connection, action, target_ref, payload):
    if not table_exists(connection, "user_change_logs"):
        return False
    change_columns = columns(connection, "user_change_logs")
    values = {
        "id": str(uuid.uuid4()),
        "target_ref": target_ref,
        "action": action,
        "payload_json": json.dumps(payload, ensure_ascii=False),
        "created_at": now(),
    }
    insert_columns = [column for column in values if column in change_columns]
    if not insert_columns:
        return False
    placeholders = ",".join("?" for _ in insert_columns)
    connection.execute(
        f"INSERT INTO user_change_logs({','.join(insert_columns)}) VALUES({placeholders})",
        [values[column] for column in insert_columns],
    )
    return True

def insert_target_ref_migration(connection, old_ref, new_ref, redirect_type, affected_table, affected_id, status, applied_at):
    if not table_exists(connection, "user_target_ref_migrations"):
        return False
    migration_id = public_id("utr", f"{affected_table}:{affected_id}:{old_ref}:{new_ref or ''}:{status}")
    connection.execute(
        """
        INSERT OR IGNORE INTO user_target_ref_migrations(
            id, old_target_ref, new_target_ref, redirect_type, affected_table, affected_id, status, created_at, applied_at
        ) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (migration_id, old_ref, new_ref, redirect_type, affected_table, str(affected_id), status, now(), applied_at),
    )
    return True

def migrate_user_target_refs(connection, base_maps):
    contracts = [
        ("user_notes", "target_ref"),
        ("user_favorites", "target_ref"),
        ("user_item_tags", "target_ref"),
        ("user_change_logs", "target_ref"),
        ("user_custom_relations", "source_ref"),
        ("user_custom_relations", "target_ref"),
        ("user_workspace_items", "target_ref"),
        ("user_data_basket_items", "target_ref"),
        ("user_export_jobs", "source_ref"),
        ("user_capability_model_nodes", "source_ref"),
        ("user_capability_model_relations", "target_ref"),
        ("user_import_staging_items", "target_ref"),
        ("user_import_staging_relations", "source_ref"),
        ("user_import_staging_relations", "target_ref"),
        ("user_review_decisions", "target_ref"),
    ]
    summary = {
        "scannedRefs": 0,
        "legacyRefsFound": 0,
        "updatedRefs": 0,
        "pendingRefs": 0,
        "conflictRefs": 0,
        "migrationRowsInserted": 0,
        "changeLogInserted": False,
        "samples": [],
    }
    for table, column in contracts:
        if not table_exists(connection, table) or column not in columns(connection, table):
            continue
        table_columns = columns(connection, table)
        id_expr = "id" if "id" in table_columns else "rowid"
        rows = connection.execute(f"SELECT rowid AS _rowid, {id_expr} AS _id, {column} AS _ref FROM {table} WHERE {column} IS NOT NULL").fetchall()
        for row in rows:
            summary["scannedRefs"] += 1
            old_ref = str(row["_ref"] or "").strip()
            resolution = resolve_legacy_target_ref(old_ref, base_maps)
            if not resolution:
                continue
            summary["legacyRefsFound"] += 1
            affected_table = f"{table}.{column}"
            affected_id = row["_id"]
            new_ref = resolution.get("new_ref")
            status = resolution["status"]
            applied_at = None
            if new_ref:
                try:
                    connection.execute(f"UPDATE {table} SET {column}=? WHERE rowid=?", (new_ref, row["_rowid"]))
                    summary["updatedRefs"] += 1
                    applied_at = now()
                except sqlite3.IntegrityError:
                    status = "conflict"
                    new_ref = None
                    summary["conflictRefs"] += 1
            else:
                summary["pendingRefs"] += 1
            insert_target_ref_migration(
                connection,
                old_ref,
                new_ref,
                "stable_ref" if status == "applied" else resolution.get("reason") or "unresolved",
                affected_table,
                affected_id,
                status,
                applied_at,
            )
            summary["migrationRowsInserted"] += 1
            if len(summary["samples"]) < 10:
                summary["samples"].append(
                    {
                        "table": affected_table,
                        "id": str(affected_id),
                        "oldRef": old_ref,
                        "newRef": new_ref,
                        "status": status,
                        "reason": resolution.get("reason"),
                    }
                )
    if summary["legacyRefsFound"]:
        summary["changeLogInserted"] = safe_insert_change_log(
            connection,
            "user_target_ref_migration",
            "user:migration:target_ref",
            summary,
        )
    return summary

def migrate_user_db(path, base_maps):
    if not path:
        return None
    connection = sqlite3.connect(path)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys = ON")
    created = []
    ddl = {
        "user_workspaces": """
            CREATE TABLE IF NOT EXISTS user_workspaces (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                description TEXT,
                status TEXT NOT NULL DEFAULT 'active',
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
        """,
        "user_workspace_items": """
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
        "user_data_baskets": """
            CREATE TABLE IF NOT EXISTS user_data_baskets (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                description TEXT,
                status TEXT NOT NULL DEFAULT 'active',
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
        """,
        "user_data_basket_items": """
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
        "user_export_profiles": """
            CREATE TABLE IF NOT EXISTS user_export_profiles (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                export_type TEXT NOT NULL,
                config_json TEXT NOT NULL,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
        """,
        "user_export_jobs": """
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
        "user_capability_models": """
            CREATE TABLE IF NOT EXISTS user_capability_models (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                description TEXT,
                status TEXT NOT NULL DEFAULT 'draft',
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
        """,
        "user_capability_model_nodes": """
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
            )
        """,
        "user_capability_model_relations": """
            CREATE TABLE IF NOT EXISTS user_capability_model_relations (
                id TEXT PRIMARY KEY,
                model_id TEXT NOT NULL,
                source_node_id TEXT NOT NULL,
                target_ref TEXT NOT NULL,
                relation_type TEXT NOT NULL,
                payload_json TEXT,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
        """,
        "user_import_staging_items": """
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
            )
        """,
        "user_import_staging_relations": """
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
            )
        """,
        "user_review_decisions": """
            CREATE TABLE IF NOT EXISTS user_review_decisions (
                id TEXT PRIMARY KEY,
                target_ref TEXT NOT NULL,
                decision_type TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'pending',
                note TEXT,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
        """,
        "user_target_ref_migrations": """
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
    change_log_inserted = safe_insert_change_log(
        connection,
        "user_schema_0_3_migration",
        "user:schema:user_schema_0.3",
        {"createdTables": created},
    )
    target_ref_migration = migrate_user_target_refs(connection, base_maps)
    connection.commit()
    table_count = connection.execute("SELECT COUNT(*) FROM sqlite_master WHERE type='table'").fetchone()[0]
    schema_version = None
    if table_exists(connection, "user_meta"):
        row = connection.execute("SELECT value FROM user_meta WHERE key='schema_version'").fetchone()
        schema_version = row[0] if row else None
    connection.close()
    return {
        "createdTables": created,
        "tableCount": table_count,
        "schemaVersion": schema_version,
        "changeLogInserted": change_log_inserted,
        "targetRefMigration": target_ref_migration,
    }

def migrate_base_db(path):
    if not path:
        return None
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
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
    """)
    if table_exists(connection, "knowledge_items"):
        connection.execute("CREATE UNIQUE INDEX IF NOT EXISTS idx_knowledge_items_stable_ref ON knowledge_items(stable_ref)")
        connection.execute("CREATE INDEX IF NOT EXISTS idx_knowledge_items_stable_key ON knowledge_items(type, stable_key)")
    if table_exists(connection, "knowledge_relations"):
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
    "base": migrate_base_db(base_db) if should_migrate_base else None,
}
base_ref_maps = load_base_ref_maps(base_db)
summary["user"] = migrate_user_db(user_db, base_ref_maps)
print(json.dumps(summary, ensure_ascii=False, indent=2))
`;

  const completed = spawnSync("python3", ["-c", python, userTarget, baseLookupTarget, shouldMigrateBase ? "1" : "0"], {
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

  const stamp = timestamp();
  const targets = selectedTargets(args);
  assertTargets(targets);
  const workDir = resolvePath(args.workDir);
  const preparedTargets =
    args.mode === "apply" ? prepareApplyTargets(targets, args, stamp) : prepareDryRunTargets(targets, workDir, stamp);
  const migration = runPythonMigration(preparedTargets, args);

  const output = {
    result: "pass",
    mode: args.mode,
    scope: args.scope,
    writesPerformed: args.mode === "apply",
    writesPerformedOnProjectDatabases: preparedTargets.some((target) => target.writesProjectDb),
    confirmProjectDbWrite: args.confirmProjectDbWrite,
    inputs: Object.fromEntries(targets.map((target) => [target.kind, displayPath(target.source)])),
    targets: Object.fromEntries(preparedTargets.map((target) => [target.kind, displayPath(target.target)])),
    backups: Object.fromEntries(preparedTargets.map((target) => [target.kind, target.backup ? displayPath(target.backup) : null])),
    migration,
  };

  if (args.json) {
    console.log(JSON.stringify(output, null, 2));
    return;
  }

  console.log(`result=${output.result}`);
  console.log(`mode=${output.mode}`);
  console.log(`scope=${output.scope}`);
  console.log(`writesPerformed=${output.writesPerformed}`);
  console.log(`writesPerformedOnProjectDatabases=${output.writesPerformedOnProjectDatabases}`);
  for (const [kind, target] of Object.entries(output.targets)) console.log(`${kind}Target=${target}`);
  for (const [kind, backup] of Object.entries(output.backups)) {
    if (backup) console.log(`${kind}Backup=${backup}`);
  }
  if (migration.user) {
    console.log(`userSchemaVersion=${migration.user.schemaVersion}`);
    console.log(`userV03CreatedTables=${migration.user.createdTables.length}`);
    console.log(`userTargetRefsUpdated=${migration.user.targetRefMigration?.updatedRefs || 0}`);
    console.log(`userTargetRefsPending=${migration.user.targetRefMigration?.pendingRefs || 0}`);
  }
  if (migration.base) {
    console.log(`baseAddedColumns=${migration.base.addedColumns.length}`);
    console.log(`knowledgeItemsUpdated=${migration.base.knowledgeItemsUpdated}`);
    console.log(`knowledgeRelationsUpdated=${migration.base.knowledgeRelationsUpdated}`);
    console.log(`baseIdRedirectsRows=${migration.base.baseIdRedirectsRows}`);
  }
}

main();
