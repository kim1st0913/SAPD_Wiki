#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const projectRoot = path.resolve(path.dirname(__filename), "..");

const args = parseArgs(process.argv.slice(2));

const files = {
  createUserDb: "scripts/create_user_db.py",
  runLocalServer: "scripts/run_local_server.py",
  design: "docs/06-implementation/user-database-governance-and-stable-key-design.md",
  openIssues: "docs/06-implementation/open-issues.md",
  taskPlan: "task_plan.md",
};

const currentTables = [
  "user_meta",
  "user_favorites",
  "user_notes",
  "user_tags",
  "user_item_tags",
  "user_custom_items",
  "user_custom_relations",
  "user_import_jobs",
  "user_change_logs",
  "user_schema_migrations",
];

const userNotesColumns = [
  "id",
  "target_ref",
  "body",
  "status",
  "page_route",
  "page_title",
  "anchor_type",
  "object_type",
  "object_title",
  "tags_json",
  "created_at",
  "updated_at",
];

const allowedStatuses = ["todo", "reviewing", "waiting_confirm", "confirmed", "closed", "deferred"];

const v03Tables = [
  "user_workspaces",
  "user_workspace_items",
  "user_data_baskets",
  "user_data_basket_items",
  "user_export_profiles",
  "user_export_jobs",
  "user_capability_models",
  "user_capability_model_nodes",
  "user_capability_model_relations",
  "user_import_staging_items",
  "user_import_staging_relations",
  "user_review_decisions",
  "user_target_ref_migrations",
];

const requiredApiSnippets = [
  'parsed.path == "/api/v1/user/favorites"',
  'parsed.path == "/api/v1/user/notes"',
  'parsed.path not in {"/api/v1/user/favorites", "/api/v1/user/notes"}',
  'parsed.path.startswith("/api/v1/user/notes/")',
  "def do_PATCH",
  "def do_DELETE",
  "X-SAPD-Session-Token",
];

const requiredDesignSnippets = [
  "base:<object_type>:<stable_key>",
  "user:<object_type>:<id>",
  "base_id_redirects",
  "user_target_ref_migrations",
  "user_schema_0.3",
  "user_favorites",
  "read model",
  "不直接改前端",
  "不迁移真实用户库",
];

function parseArgs(argv) {
  const parsed = {
    db: "",
    requireV03: false,
    json: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--db") {
      parsed.db = argv[index + 1] || "";
      index += 1;
    } else if (arg === "--require-v03") {
      parsed.requireV03 = true;
    } else if (arg === "--json") {
      parsed.json = true;
    } else if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return parsed;
}

function printHelp() {
  console.log(`Usage:
  node scripts/audit_user_db_governance_contract.mjs [--db path/to/sapd_wiki_user.sqlite3] [--require-v03] [--json]

Checks the user DB governance contract without modifying files or SQLite data.

Default mode checks repository design/code contracts only.
--db runs an additional read-only SQLite inspection.
--require-v03 makes missing user_schema_0.3 tables fail instead of warn.`);
}

function readProjectFile(relativePath) {
  return readFileSync(path.join(projectRoot, relativePath), "utf8");
}

function addCheck(checks, id, ok, detail = {}) {
  checks.push({ id, ok: Boolean(ok), ...detail });
}

function includesAll(source, values) {
  return values.every((value) => source.includes(value));
}

function readDb(dbPath) {
  const python = String.raw`
import json
import sqlite3
import sys

db_path = sys.argv[1]
connection = sqlite3.connect(f"file:{db_path}?mode=ro", uri=True)
connection.row_factory = sqlite3.Row

def scalar(sql, params=()):
    row = connection.execute(sql, params).fetchone()
    if row is None:
        return None
    return row[0]

tables = [row[0] for row in connection.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")]
columns = {}
for table in tables:
    columns[table] = [row[1] for row in connection.execute(f"PRAGMA table_info({table})")]

schema_version = None
if "user_meta" in tables:
    schema_version = scalar("SELECT value FROM user_meta WHERE key='schema_version'")

target_refs = []
for table in ("user_notes", "user_favorites", "user_item_tags"):
    if table in tables and "target_ref" in columns.get(table, []):
        target_refs.extend([row[0] for row in connection.execute(f"SELECT target_ref FROM {table} WHERE target_ref IS NOT NULL")])

legacy_base_id_refs = [ref for ref in target_refs if ref.startswith("base:") and ref.count(":") == 1]
legacy_object_id_refs = [ref for ref in target_refs if ref.startswith("base:") and ref.count(":") >= 2]
stable_base_refs = [ref for ref in target_refs if ref.startswith("base:") and ref.count(":") >= 2]
user_refs = [ref for ref in target_refs if ref.startswith("user:")]
unknown_refs = [ref for ref in target_refs if not (ref.startswith("base:") or ref.startswith("user:") or ref.startswith("base_relation:") or ref.startswith("user_relation:"))]

favorite_note_count = 0
if "user_favorites" in tables and "note" in columns.get("user_favorites", []):
    favorite_note_count = scalar("SELECT COUNT(*) FROM user_favorites WHERE note IS NOT NULL AND TRIM(note) <> ''") or 0

note_status_counts = {}
if "user_notes" in tables and "status" in columns.get("user_notes", []):
    note_status_counts = {row[0]: row[1] for row in connection.execute("SELECT status, COUNT(*) FROM user_notes GROUP BY status")}

print(json.dumps({
    "tables": tables,
    "columns": columns,
    "schemaVersion": schema_version,
    "targetRefCounts": {
        "total": len(target_refs),
        "legacyBaseId": len(legacy_base_id_refs),
        "legacyObjectIdOrStable": len(legacy_object_id_refs),
        "stableBaseLike": len(stable_base_refs),
        "user": len(user_refs),
        "unknown": len(unknown_refs)
    },
    "unknownTargetRefs": unknown_refs[:20],
    "legacyBaseIdTargetRefs": legacy_base_id_refs[:20],
    "favoriteNoteCount": favorite_note_count,
    "noteStatusCounts": note_status_counts
}, ensure_ascii=False))
`;

  const result = spawnSync("python3", ["-c", python, dbPath], {
    encoding: "utf8",
    maxBuffer: 1024 * 1024,
  });
  if (result.status !== 0) {
    throw new Error((result.stderr || result.stdout || "sqlite inspection failed").trim());
  }
  return JSON.parse(result.stdout);
}

function main() {
  const checks = [];
  const warnings = [];
  const metrics = {};

  for (const [id, relativePath] of Object.entries(files)) {
    addCheck(checks, `file_exists:${id}`, existsSync(path.join(projectRoot, relativePath)), { file: relativePath });
  }

  const missingFiles = checks.filter((check) => check.id.startsWith("file_exists:") && !check.ok);
  if (missingFiles.length) {
    return finish({ checks, warnings, metrics });
  }

  const createUserDb = readProjectFile(files.createUserDb);
  const runLocalServer = readProjectFile(files.runLocalServer);
  const design = readProjectFile(files.design);
  const openIssues = readProjectFile(files.openIssues);
  const taskPlan = readProjectFile(files.taskPlan);

  addCheck(checks, "current_schema_version_is_0_2", createUserDb.includes('DEFAULT_SCHEMA_VERSION = "user_schema_0.2"'));
  addCheck(checks, "current_tables_declared", includesAll(createUserDb, currentTables), {
    expected: currentTables,
    missing: currentTables.filter((table) => !createUserDb.includes(table)),
  });
  addCheck(checks, "user_notes_columns_declared", includesAll(createUserDb, userNotesColumns), {
    expected: userNotesColumns,
    missing: userNotesColumns.filter((column) => !createUserDb.includes(column)),
  });
  addCheck(checks, "user_note_column_backfill_present", createUserDb.includes("ensure_user_note_columns"));
  addCheck(checks, "user_change_log_initialized", createUserDb.includes("initialize_user_db") && createUserDb.includes("user_change_logs"));
  addCheck(checks, "user_write_api_security_present", requiredApiSnippets.every((snippet) => runLocalServer.includes(snippet)), {
    missing: requiredApiSnippets.filter((snippet) => !runLocalServer.includes(snippet)),
  });
  addCheck(checks, "design_required_snippets_present", requiredDesignSnippets.every((snippet) => design.includes(snippet)), {
    missing: requiredDesignSnippets.filter((snippet) => !design.includes(snippet)),
  });
  addCheck(checks, "design_v03_tables_present", includesAll(design, v03Tables), {
    expected: v03Tables,
    missing: v03Tables.filter((table) => !design.includes(table)),
  });
  addCheck(checks, "design_statuses_present", includesAll(design, allowedStatuses), {
    expected: allowedStatuses,
    missing: allowedStatuses.filter((status) => !design.includes(status)),
  });
  addCheck(
    checks,
    "oi_135_design_status_synced",
    /OI-135\s*\|\s*(设计完成 \/ 待确认|临时库 smoke 通过 \/ 真实迁移待确认)/.test(openIssues),
  );
  addCheck(
    checks,
    "db_11_plan_status_synced",
    /DB-11[\s\S]*P0 (设计完成 \/ 待确认|审计脚本完成 \/ migration dry-run 待启动|migration dry-run 完成 \/ 临时库 smoke 待启动|临时库 smoke 通过 \/ 真实迁移待确认)/.test(taskPlan),
  );
  addCheck(
    checks,
    "db_2_plan_status_synced",
    /DB-2[\s\S]*P0 (设计完成 \/ 待确认|审计脚本完成 \/ migration 设计待启动|migration 设计完成 \/ 临时库 smoke 待启动|临时库 smoke 通过 \/ 真实迁移待确认)/.test(taskPlan),
  );

  if (args.db) {
    const dbPath = path.resolve(projectRoot, args.db);
    addCheck(checks, "db_file_exists", existsSync(dbPath), { dbPath });
    if (existsSync(dbPath)) {
      const db = readDb(dbPath);
      metrics.db = db;
      const missingCurrentTables = currentTables.filter((table) => !db.tables.includes(table));
      addCheck(checks, "db_current_tables_present", missingCurrentTables.length === 0, {
        missing: missingCurrentTables,
      });
      const missingNoteColumns = userNotesColumns.filter((column) => !db.columns.user_notes?.includes(column));
      addCheck(checks, "db_user_notes_columns_present", missingNoteColumns.length === 0, {
        missing: missingNoteColumns,
      });
      const missingV03Tables = v03Tables.filter((table) => !db.tables.includes(table));
      addCheck(checks, "db_v03_tables_present", args.requireV03 ? missingV03Tables.length === 0 : true, {
        mode: args.requireV03 ? "required" : "warning_only",
        missing: missingV03Tables,
      });
      const invalidStatuses = Object.keys(db.noteStatusCounts || {}).filter((status) => !allowedStatuses.includes(status));
      addCheck(checks, "db_user_note_statuses_allowed", invalidStatuses.length === 0, {
        invalid: invalidStatuses,
      });
      if (missingV03Tables.length && !args.requireV03) {
        warnings.push(`db_v03_tables_missing_warning=${missingV03Tables.join(",")}`);
      }
      if (db.favoriteNoteCount > 0) {
        warnings.push(`legacy_favorite_notes=${db.favoriteNoteCount}`);
      }
      if (db.targetRefCounts.legacyBaseId > 0) {
        warnings.push(`legacy_base_id_target_refs=${db.targetRefCounts.legacyBaseId}`);
      }
      if (db.targetRefCounts.unknown > 0) {
        warnings.push(`unknown_target_refs=${db.targetRefCounts.unknown}`);
      }
    }
  }

  return finish({ checks, warnings, metrics });
}

function finish(result) {
  const failed = result.checks.filter((check) => !check.ok);
  const output = {
    result: failed.length ? "fail" : "pass",
    failed: failed.map((check) => check.id),
    warnings: result.warnings,
    checks: result.checks,
    metrics: result.metrics,
  };

  if (args.json) {
    console.log(JSON.stringify(output, null, 2));
  } else {
    console.log(`result=${output.result}`);
    for (const warning of output.warnings) console.log(`warning=${warning}`);
    for (const check of output.checks) {
      const detail = check.missing?.length ? ` missing=${check.missing.join(",")}` : "";
      console.log(`check=${check.id} ok=${check.ok}${detail}`);
    }
  }

  if (failed.length) process.exit(1);
}

main();
