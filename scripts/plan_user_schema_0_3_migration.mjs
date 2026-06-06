#!/usr/bin/env node
import { existsSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const projectRoot = path.resolve(path.dirname(__filename), "..");

const args = parseArgs(process.argv.slice(2));
const targetSchemaVersion = "user_schema_0.3";

const v03Tables = [
  {
    name: "user_workspaces",
    purpose: "workspace containers for user review and work queues",
    sql: `CREATE TABLE IF NOT EXISTS user_workspaces (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
)`,
  },
  {
    name: "user_workspace_items",
    purpose: "workspace membership by stable target_ref",
    sql: `CREATE TABLE IF NOT EXISTS user_workspace_items (
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
)`,
  },
  {
    name: "user_data_baskets",
    purpose: "export-ready user baskets",
    sql: `CREATE TABLE IF NOT EXISTS user_data_baskets (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
)`,
  },
  {
    name: "user_data_basket_items",
    purpose: "data basket membership by stable target_ref",
    sql: `CREATE TABLE IF NOT EXISTS user_data_basket_items (
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
)`,
  },
  {
    name: "user_export_profiles",
    purpose: "saved export configurations",
    sql: `CREATE TABLE IF NOT EXISTS user_export_profiles (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  export_type TEXT NOT NULL,
  config_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
)`,
  },
  {
    name: "user_export_jobs",
    purpose: "export previews and execution records",
    sql: `CREATE TABLE IF NOT EXISTS user_export_jobs (
  id TEXT PRIMARY KEY,
  profile_id TEXT,
  export_type TEXT NOT NULL,
  source_ref TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  preview_json TEXT,
  output_path TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
)`,
  },
  {
    name: "user_capability_models",
    purpose: "custom capability model headers",
    sql: `CREATE TABLE IF NOT EXISTS user_capability_models (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
)`,
  },
  {
    name: "user_capability_model_nodes",
    purpose: "custom capability model tree nodes",
    sql: `CREATE TABLE IF NOT EXISTS user_capability_model_nodes (
  id TEXT PRIMARY KEY,
  model_id TEXT NOT NULL,
  parent_id TEXT,
  source_ref TEXT,
  node_type TEXT NOT NULL,
  code TEXT,
  title TEXT NOT NULL,
  description TEXT,
  sort_order INTEGER,
  payload_json TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
)`,
  },
  {
    name: "user_capability_model_relations",
    purpose: "relations from custom capability model nodes",
    sql: `CREATE TABLE IF NOT EXISTS user_capability_model_relations (
  id TEXT PRIMARY KEY,
  model_id TEXT NOT NULL,
  source_node_id TEXT NOT NULL,
  target_ref TEXT NOT NULL,
  relation_type TEXT NOT NULL,
  payload_json TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
)`,
  },
  {
    name: "user_import_staging_items",
    purpose: "user import draft items",
    sql: `CREATE TABLE IF NOT EXISTS user_import_staging_items (
  id TEXT PRIMARY KEY,
  import_job_id TEXT NOT NULL,
  target_ref TEXT,
  item_type TEXT NOT NULL,
  action_type TEXT NOT NULL DEFAULT 'create',
  payload_json TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
)`,
  },
  {
    name: "user_import_staging_relations",
    purpose: "user import draft relations",
    sql: `CREATE TABLE IF NOT EXISTS user_import_staging_relations (
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
)`,
  },
  {
    name: "user_review_decisions",
    purpose: "review decisions for user drafts and unresolved refs",
    sql: `CREATE TABLE IF NOT EXISTS user_review_decisions (
  id TEXT PRIMARY KEY,
  target_ref TEXT NOT NULL,
  decision_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  note TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
)`,
  },
  {
    name: "user_target_ref_migrations",
    purpose: "dry-run and applied target_ref migration records",
    sql: `CREATE TABLE IF NOT EXISTS user_target_ref_migrations (
  id TEXT PRIMARY KEY,
  old_target_ref TEXT NOT NULL,
  new_target_ref TEXT,
  redirect_type TEXT NOT NULL,
  affected_table TEXT NOT NULL,
  affected_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  applied_at TEXT
)`,
  },
];

function parseArgs(argv) {
  const parsed = {
    db: "data/user/sapd_wiki_user.sqlite3",
    json: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--db") {
      parsed.db = argv[index + 1] || "";
      index += 1;
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
  node scripts/plan_user_schema_0_3_migration.mjs [--db data/user/sapd_wiki_user.sqlite3] [--json]

Creates a read-only dry-run plan for user_schema_0.3.
It does not write SQLite data, create tables, or migrate user content.`);
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
    return None if row is None else row[0]

def table_exists(name):
    return scalar("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?", (name,)) is not None

def columns(name):
    if not table_exists(name):
        return []
    return [row[1] for row in connection.execute(f"PRAGMA table_info({name})")]

tables = [row[0] for row in connection.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")]
table_counts = {}
table_columns = {}
for table in tables:
    table_counts[table] = scalar(f"SELECT COUNT(*) FROM {table}") or 0
    table_columns[table] = columns(table)

schema_version = None
if table_exists("user_meta"):
    schema_version = scalar("SELECT value FROM user_meta WHERE key='schema_version'")

schema_migrations = []
if table_exists("user_schema_migrations"):
    schema_migrations = [row[0] for row in connection.execute("SELECT version FROM user_schema_migrations ORDER BY applied_at, version")]

refs = []
for table, cols in {
    "user_notes": ["target_ref"],
    "user_favorites": ["target_ref"],
    "user_item_tags": ["target_ref"],
    "user_change_logs": ["target_ref"],
    "user_custom_relations": ["source_ref", "target_ref"],
}.items():
    if not table_exists(table):
        continue
    existing_cols = set(columns(table))
    for col in cols:
        if col not in existing_cols:
            continue
        for row in connection.execute(f"SELECT id, {col} FROM {table} WHERE {col} IS NOT NULL AND TRIM({col}) <> ''"):
            refs.append({"table": table, "id": row[0], "column": col, "ref": row[1]})

favorite_note_candidates = []
if table_exists("user_favorites") and "note" in columns("user_favorites"):
    for row in connection.execute("SELECT id, target_ref, LENGTH(COALESCE(note,'')) AS note_length, created_at, updated_at FROM user_favorites WHERE note IS NOT NULL AND TRIM(note) <> '' ORDER BY updated_at DESC"):
        favorite_note_candidates.append(dict(row))

note_status_counts = {}
if table_exists("user_notes") and "status" in columns("user_notes"):
    note_status_counts = {row[0]: row[1] for row in connection.execute("SELECT status, COUNT(*) FROM user_notes GROUP BY status")}

print(json.dumps({
    "schemaVersion": schema_version,
    "schemaMigrations": schema_migrations,
    "tables": tables,
    "tableCounts": table_counts,
    "columns": table_columns,
    "refs": refs,
    "favoriteNoteCandidates": favorite_note_candidates,
    "noteStatusCounts": note_status_counts
}, ensure_ascii=False))
`;
  const result = spawnSync("python3", ["-c", python, dbPath], {
    cwd: projectRoot,
    encoding: "utf8",
    maxBuffer: 1024 * 1024 * 4,
  });
  if (result.status !== 0) {
    throw new Error((result.stderr || result.stdout || "sqlite dry-run probe failed").trim());
  }
  return JSON.parse(result.stdout);
}

function classifyRef(ref) {
  const value = String(ref || "");
  if (value.includes(":v2:")) return "page_anchor_v2";
  if (/^base:security_guide_slide:guide:/.test(value)) return "guide_slide_ref";
  if (/^base:security_guide:\/guides\//.test(value)) return "guide_route_ref";
  if (/^base:[^:]+$/.test(value)) return "legacy_base_id";
  if (/^base:[^:]+:[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
    return "legacy_base_uuid";
  }
  if (/^base:[^:]+:.+/.test(value)) return "stable_base_like";
  if (/^user:[^:]+:.+/.test(value)) return "user_ref";
  if (/^base_relation:[^:]+:.+/.test(value)) return "base_relation_ref";
  if (/^user_relation:[^:]+:.+/.test(value)) return "user_relation_ref";
  return "unknown";
}

function riskForKind(kind) {
  if (kind === "legacy_base_id" || kind === "legacy_base_uuid" || kind === "unknown") return "high";
  if (kind === "page_anchor_v2") return "high";
  if (kind === "guide_slide_ref" || kind === "guide_route_ref") return "medium";
  return "low";
}

function actionForKind(kind) {
  if (kind === "page_anchor_v2") return "preserve_contextual_resolver";
  if (kind === "guide_slide_ref" || kind === "guide_route_ref") return "resolve_by_route_and_page";
  if (kind === "legacy_base_id" || kind === "legacy_base_uuid") return "create_pending_target_ref_migration";
  if (kind === "unknown") return "manual_review";
  return "no_action";
}

function summarizeRefs(refs) {
  const byKind = {};
  const byRisk = {};
  const samples = [];
  for (const row of refs) {
    const kind = classifyRef(row.ref);
    const risk = riskForKind(kind);
    byKind[kind] = (byKind[kind] || 0) + 1;
    byRisk[risk] = (byRisk[risk] || 0) + 1;
    if (samples.length < 20 && risk !== "low") {
      samples.push({
        table: row.table,
        column: row.column,
        id: row.id,
        kind,
        risk,
        action: actionForKind(kind),
        ref: row.ref,
      });
    }
  }
  return { total: refs.length, byKind, byRisk, samples };
}

function main() {
  const dbPath = path.isAbsolute(args.db) ? args.db : path.join(projectRoot, args.db);
  const output = {
    result: "pass",
    mode: "dry-run",
    writesPerformed: false,
    targetSchemaVersion,
    input: { db: path.relative(projectRoot, dbPath) || dbPath },
    summary: {},
    plannedSchemaActions: [],
    plannedDataActions: [],
    blockers: [],
    warnings: [],
  };

  if (!existsSync(dbPath)) {
    output.result = "fail";
    output.blockers.push({ type: "missing_user_db", message: "User DB does not exist.", db: output.input.db });
    return print(output);
  }

  const db = readDb(dbPath);
  output.summary = {
    currentSchemaVersion: db.schemaVersion,
    schemaMigrations: db.schemaMigrations,
    userNotes: db.tableCounts.user_notes || 0,
    userFavorites: db.tableCounts.user_favorites || 0,
    userChangeLogs: db.tableCounts.user_change_logs || 0,
    favoriteNoteCandidates: db.favoriteNoteCandidates.length,
    noteStatusCounts: db.noteStatusCounts,
  };

  const existingTables = new Set(db.tables);
  for (const table of v03Tables) {
    output.plannedSchemaActions.push({
      action: existingTables.has(table.name) ? "verify_existing_table" : "create_table",
      table: table.name,
      purpose: table.purpose,
      sql: table.sql,
    });
  }

  output.plannedSchemaActions.push({
    action: "update_user_meta",
    key: "schema_version",
    value: targetSchemaVersion,
  });
  output.plannedSchemaActions.push({
    action: "insert_schema_migration",
    table: "user_schema_migrations",
    version: targetSchemaVersion,
  });
  output.plannedSchemaActions.push({
    action: "insert_change_log",
    table: "user_change_logs",
    operation: "user_schema_0_3_migration",
    note: "Dry-run only in this script; future migration script must write one change log row after successful migration.",
  });

  const refSummary = summarizeRefs(db.refs);
  output.summary.targetRefs = refSummary;

  if (db.favoriteNoteCandidates.length) {
    output.plannedDataActions.push({
      action: "legacy_favorite_note_migration_candidates",
      count: db.favoriteNoteCandidates.length,
      note: "Do not auto-migrate. Create user_notes candidates only after user confirmation.",
      candidates: db.favoriteNoteCandidates.map((row) => ({
        id: row.id,
        target_ref: row.target_ref,
        note_length: row.note_length,
        created_at: row.created_at,
        updated_at: row.updated_at,
      })),
    });
  }

  for (const [kind, count] of Object.entries(refSummary.byKind)) {
    output.plannedDataActions.push({
      action: actionForKind(kind),
      refKind: kind,
      risk: riskForKind(kind),
      count,
    });
  }

  const missingCurrentTables = ["user_meta", "user_favorites", "user_notes", "user_change_logs", "user_schema_migrations"].filter(
    (table) => !existingTables.has(table),
  );
  if (missingCurrentTables.length) {
    output.result = "fail";
    output.blockers.push({ type: "missing_required_current_tables", missing: missingCurrentTables });
  }

  if (db.schemaVersion && db.schemaVersion !== "user_schema_0.2" && db.schemaVersion !== targetSchemaVersion) {
    output.warnings.push({
      type: "unexpected_schema_version",
      currentSchemaVersion: db.schemaVersion,
      expected: ["user_schema_0.2", targetSchemaVersion],
    });
  }

  const highRiskCount = refSummary.byRisk.high || 0;
  if (highRiskCount) {
    output.warnings.push({
      type: "high_risk_refs_require_manual_or_contextual_resolution",
      count: highRiskCount,
    });
  }

  return print(output);
}

function print(output) {
  if (args.json) {
    console.log(JSON.stringify(output, null, 2));
  } else {
    console.log(`result=${output.result}`);
    console.log(`mode=${output.mode}`);
    console.log(`writesPerformed=${output.writesPerformed}`);
    console.log(`currentSchemaVersion=${output.summary.currentSchemaVersion || ""}`);
    console.log(`targetSchemaVersion=${output.targetSchemaVersion}`);
    console.log(`plannedSchemaActions=${output.plannedSchemaActions.length}`);
    console.log(`plannedDataActions=${output.plannedDataActions.length}`);
    for (const warning of output.warnings) console.log(`warning=${warning.type} count=${warning.count ?? ""}`);
    for (const blocker of output.blockers) console.log(`blocker=${blocker.type}`);
    if (output.summary.targetRefs) {
      console.log(`targetRefs=${output.summary.targetRefs.total}`);
      for (const [kind, count] of Object.entries(output.summary.targetRefs.byKind)) {
        console.log(`targetRefKind=${kind} count=${count} action=${actionForKind(kind)}`);
      }
    }
  }
  if (output.result !== "pass") process.exit(1);
}

main();
