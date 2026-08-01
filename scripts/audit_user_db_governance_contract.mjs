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
  macosWrapper: "apps/macos/SAPDWiki/Sources/SAPDWiki/main.swift",
  design: "docs/06-implementation/user-database-governance-and-stable-key-design.md",
  openIssues: "docs/06-implementation/open-issues.md",
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
  'parsed.path.startswith("/api/v1/user/notes/")',
  'request_path.startswith("/api/v1/user/workspaces")',
  "def ensure_user_workspace_tables",
  "def list_workspaces",
  "def create_workspace",
  "def add_workspace_item",
  "def delete_workspace_item",
  "def delete_workspace",
  "create_workspace",
  "upsert_workspace_item",
  'request_path.startswith("/api/v1/user/data-baskets")',
  "def ensure_user_data_basket_tables",
  "def list_data_baskets",
  "def create_data_basket",
  "def add_data_basket_item",
  "def delete_data_basket_item",
  "def delete_data_basket",
  "create_data_basket",
  "upsert_data_basket_item",
  'request_path.startswith("/api/v1/user/export-profiles")',
  'request_path.startswith("/api/v1/user/exports")',
  "def ensure_user_export_tables",
  "def list_export_profiles",
  "def create_export_profile",
  "def delete_export_profile",
  "def create_export_preview",
  "def execute_export_job",
  "def get_export_job",
  "def export_job_download_path",
  "def send_download",
  "create_export_profile",
  "create_export_preview",
  "execute_export_job",
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
  "不无备份、无确认地迁移真实用户库",
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
if "user_data_basket_items" in tables and "target_ref" in columns.get("user_data_basket_items", []):
    target_refs.extend([row[0] for row in connection.execute("SELECT target_ref FROM user_data_basket_items WHERE target_ref IS NOT NULL")])

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
  const macosWrapper = readProjectFile(files.macosWrapper);
  const design = readProjectFile(files.design);
  const openIssues = readProjectFile(files.openIssues);
  const openIssuesHistory = readProjectFile("docs/05-archive/open-issues-history/2026-06.md");
  const issueLedger = `${openIssues}\n${openIssuesHistory}`;
  const completedMigrationEvidence =
    /适用范围：[\s\S]*DB-11[\s\S]*DB-2/.test(design) &&
    /本轮已完成[\s\S]*真实库 apply/.test(design) &&
    /\|\s*8\s*\|\s*OI-135 真实库 apply\s*\|\s*已完成\s*\|/.test(design);

  addCheck(checks, "current_schema_version_is_0_3", createUserDb.includes('DEFAULT_SCHEMA_VERSION = "user_schema_0.3"'));
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
  addCheck(
    checks,
    "macos_wrapper_uses_user_selected_data_root",
    macosWrapper.includes('private static let dataRootFolderName = "SAPDWiki"') &&
      macosWrapper.includes('private static let dataRootKey = "SAPDWiki.DataRootPath"') &&
      macosWrapper.includes('private static let importDirectoryKey = "SAPDWiki.ImportDirectoryPath"') &&
      macosWrapper.includes('private static let downloadDirectoryKey = "SAPDWiki.DownloadDirectoryPath"') &&
      macosWrapper.includes('settings.dataRoot.appendingPathComponent("Runtime", isDirectory: true)') &&
      macosWrapper.includes('defaultDownloadDirectory(for dataRoot: URL)') &&
      macosWrapper.includes('defaultImportDirectory(for dataRoot: URL)') &&
      macosWrapper.includes('dataRoot.appendingPathComponent("import", isDirectory: true)') &&
      macosWrapper.includes('dataRoot.appendingPathComponent("export", isDirectory: true)'),
  );
  addCheck(
    checks,
    "macos_wrapper_seeds_user_db_only_when_missing",
    macosWrapper.includes("private func seedUserDataIfNeeded") &&
      macosWrapper.includes("let targetExists = fileManager.fileExists(atPath: targetDB.path)") &&
      macosWrapper.includes("guard !targetExists else") &&
      macosWrapper.includes("user-db-reuse") &&
      macosWrapper.includes("copyItem(at: sourceDB, to: targetDB)") &&
      macosWrapper.includes("user-db-created-from-template"),
  );
  addCheck(
    checks,
    "macos_wrapper_writes_runtime_preferences",
    macosWrapper.includes('object["app_data_root"] = settings.dataRoot.path') &&
      macosWrapper.includes('object["import_dir"] = settings.importDirectory.path') &&
      macosWrapper.includes('object["download_dir"] = settings.downloadDirectory.path') &&
      macosWrapper.includes('object["runtime_root"] = runtimeRoot.path') &&
      macosWrapper.includes('object["user_database_path"] = runtimeRoot') &&
      macosWrapper.includes("prepare-runtime config-updated"),
  );
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
    /OI-135\s*\|\s*(设计完成 \/ 待确认|临时库 smoke 通过 \/ 真实迁移待确认|正式迁移脚本完成 \/ 真实库 apply 待显式确认|正式迁移脚本完成 \/ stable_ref 重复待治理 \/ 真实库 apply 待显式确认|基础库 clean candidate 完成 \/ 用户库 legacy target_ref 待治理 \/ 真实库 apply 待显式确认|基础库 clean candidate 完成 \/ 用户库 target_ref 迁移 dry-run 通过 \/ 真实库 apply 待显式确认|真实库 apply 已完成 \/ 自动验证通过 \/ 待用户确认关闭)/.test(openIssues) ||
      /## OI-135：[\s\S]*?- 状态：已关闭/.test(issueLedger),
  );
  addCheck(
    checks,
    "db_11_completion_evidence_present",
    completedMigrationEvidence,
  );
  addCheck(
    checks,
    "db_2_completion_evidence_present",
    completedMigrationEvidence,
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
      addCheck(checks, "db_schema_version_is_0_3", args.requireV03 ? db.schemaVersion === "user_schema_0.3" : true, {
        schemaVersion: db.schemaVersion,
        expected: "user_schema_0.3",
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
