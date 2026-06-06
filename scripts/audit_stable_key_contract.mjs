#!/usr/bin/env node

import { existsSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const projectRoot = path.resolve(path.dirname(__filename), "..");

const DEFAULT_BASE_DB_CANDIDATES = [
  "data/base/sapd_wiki_base.sqlite3",
  "data/database/sapd_wiki.sqlite3",
];
const DEFAULT_USER_DB_CANDIDATES = ["data/user/sapd_wiki_user.sqlite3"];
const REQUIRED_REDIRECT_COLUMNS = [
  "id",
  "old_ref",
  "new_ref",
  "redirect_type",
  "release_version",
  "confidence",
  "note",
  "created_at",
];
const REQUIRED_REDIRECT_TYPES = ["rename", "merge", "split", "deprecated"];
const ALLOWED_REDIRECT_TYPES = [...REQUIRED_REDIRECT_TYPES, "retype"];
const TARGET_REF_TABLES = [
  { table: "user_notes", columns: ["target_ref"] },
  { table: "user_favorites", columns: ["target_ref"] },
  { table: "user_item_tags", columns: ["target_ref"] },
  { table: "user_change_logs", columns: ["target_ref"] },
  { table: "user_custom_relations", columns: ["source_ref", "target_ref"] },
];

function usage() {
  return `
Usage:
  node scripts/audit_stable_key_contract.mjs [--base-db <path>] [--user-db <path>] [--json]

Checks the read-only stable_key / deterministic ID / base_id_redirects contract.

Options:
  --base-db <path>   Base SQLite DB to inspect. Defaults to the first existing
                     path in data/base/sapd_wiki_base.sqlite3,
                     data/database/sapd_wiki.sqlite3.
  --user-db <path>   Optional user SQLite DB for target_ref sampling. Defaults
                     to data/user/sapd_wiki_user.sqlite3 when present.
  --json             Print JSON only. The default output is also JSON.
  --help             Show this help.
`.trim();
}

function parseArgs(argv) {
  const args = { json: false, baseDb: null, userDb: null, help: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") {
      args.help = true;
    } else if (arg === "--json") {
      args.json = true;
    } else if (arg === "--base-db") {
      args.baseDb = argv[++index];
      if (!args.baseDb) throw new Error("--base-db requires a path");
    } else if (arg === "--user-db") {
      args.userDb = argv[++index];
      if (!args.userDb) throw new Error("--user-db requires a path");
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return args;
}

function resolveProjectPath(inputPath) {
  if (!inputPath) return null;
  return path.isAbsolute(inputPath) ? path.normalize(inputPath) : path.join(projectRoot, inputPath);
}

function displayPath(absolutePath) {
  if (!absolutePath) return null;
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

function addIssue(issues, severity, type, message, details = {}) {
  issues.push({ severity, type, message, ...details });
}

function hasFatalIssue(issues) {
  return issues.some((issue) => issue.severity === "error");
}

function parseMetadata(raw) {
  if (!raw || typeof raw !== "string") return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function stableKeyFromRow(row) {
  for (const key of ["stable_key", "stable_ref", "public_stable_key"]) {
    if (typeof row[key] === "string" && row[key].trim()) return row[key].trim();
  }
  const metadata = parseMetadata(row.metadata_json);
  for (const key of ["stable_key", "stableRef", "stable_ref"]) {
    if (typeof metadata[key] === "string" && metadata[key].trim()) return metadata[key].trim();
  }
  return "";
}

function deterministicPublicIdFromRow(row) {
  for (const key of ["public_id", "deterministic_id"]) {
    if (typeof row[key] === "string" && row[key].trim()) return row[key].trim();
  }
  const metadata = parseMetadata(row.metadata_json);
  for (const key of ["public_id", "deterministic_id", "publicId", "deterministicId"]) {
    if (typeof metadata[key] === "string" && metadata[key].trim()) return metadata[key].trim();
  }
  return "";
}

function candidateKeyFromRow(row, metadataKeys) {
  const stableKey = stableKeyFromRow(row);
  if (stableKey) return stableKey;
  if (typeof row.code === "string" && row.code.trim()) return row.code.trim();
  const metadata = parseMetadata(row.metadata_json);
  for (const key of metadataKeys) {
    if (typeof metadata[key] === "string" && metadata[key].trim()) return metadata[key].trim();
  }
  return "";
}

function isUuidLike(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ""));
}

function isStableBaseRef(value) {
  const ref = String(value || "");
  if (isPageTargetRef(ref)) return false;
  if (!/^base:[^:]+:.+/.test(ref)) return false;
  if (/^base:[^:]+:[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(ref)) return false;
  return true;
}

function isStableBaseRelationRef(value) {
  const ref = String(value || "");
  return /^base_relation:[^:]+:.+/.test(ref) && !isUuidLike(ref.split(":").at(-1));
}

function isLegacyBaseRef(value) {
  const ref = String(value || "");
  if (/^base:[^:]+$/.test(ref)) return true;
  return /^base:[^:]+:[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(ref);
}

function isPageTargetRef(value) {
  const ref = String(value || "");
  return (
    ref.includes(":v2:") ||
    /^base:security_guide:\/guides\//.test(ref) ||
    /^base:security_guide_slide:guide:/.test(ref) ||
    /^page:/.test(ref)
  );
}

function looksLikeStableKey(value) {
  const key = String(value || "").trim();
  if (!key || isUuidLike(key)) return false;
  if (/\s/.test(key)) return false;
  return /^[A-Za-z0-9][A-Za-z0-9._:#/-]*$/.test(key);
}

function duplicateCounts(rows, keyFn) {
  const counts = new Map();
  for (const row of rows) {
    const key = keyFn(row);
    if (!key) continue;
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return [...counts.entries()]
    .filter(([, count]) => count > 1)
    .slice(0, 10)
    .map(([key, count]) => ({ key, count }));
}

function runSqliteProbe(dbPath, mode) {
  const probe = String.raw`
import json
import sqlite3
import sys
from pathlib import Path
from urllib.parse import quote

db_path = Path(sys.argv[1]).resolve()
mode = sys.argv[2]
uri = "file:" + quote(str(db_path), safe="/:") + "?mode=ro"

def table_exists(connection, table_name):
    row = connection.execute(
        "SELECT 1 FROM sqlite_master WHERE type='table' AND name=?",
        (table_name,),
    ).fetchone()
    return row is not None

def table_columns(connection, table_name):
    if not table_exists(connection, table_name):
        return []
    return [row[1] for row in connection.execute(f"PRAGMA table_info({table_name})").fetchall()]

def fetch_rows(connection, table_name, columns):
    if not table_exists(connection, table_name):
        return []
    available = table_columns(connection, table_name)
    selected = [column for column in columns if column in available]
    if not selected:
        return []
    sql = "SELECT " + ", ".join(selected) + f" FROM {table_name}"
    return [dict(zip(selected, row)) for row in connection.execute(sql).fetchall()]

def count_table(connection, table_name):
    if not table_exists(connection, table_name):
        return None
    return connection.execute(f"SELECT COUNT(*) FROM {table_name}").fetchone()[0]

connection = sqlite3.connect(uri, uri=True)
connection.execute("PRAGMA query_only = ON")
connection.execute("PRAGMA foreign_keys = ON")

tables = [row[0] for row in connection.execute(
    "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
).fetchall()]

result = {"path": str(db_path), "tables": tables, "columns": {}, "counts": {}}

for table_name in tables:
    result["columns"][table_name] = table_columns(connection, table_name)
    result["counts"][table_name] = count_table(connection, table_name)

if mode == "base":
    result["knowledge_items"] = fetch_rows(
        connection,
        "knowledge_items",
        ["id", "type", "code", "title", "status", "stable_key", "stable_ref", "public_id", "deterministic_id", "metadata_json"],
    )
    result["knowledge_relations"] = fetch_rows(
        connection,
        "knowledge_relations",
        [
            "id",
            "source_item_id",
            "target_item_id",
            "relation_type",
            "stable_key",
            "stable_ref",
            "public_id",
            "deterministic_id",
            "metadata_json",
        ],
    )
    result["base_id_redirects"] = fetch_rows(
        connection,
        "base_id_redirects",
        ["id", "old_ref", "new_ref", "redirect_type", "release_version", "confidence", "note", "created_at"],
    )
elif mode == "user":
    target_tables = ["user_notes", "user_favorites", "user_item_tags", "user_change_logs", "user_custom_relations"]
    result["target_refs"] = []
    for table_name in target_tables:
        if not table_exists(connection, table_name):
            continue
        columns = table_columns(connection, table_name)
        for column in ["target_ref", "source_ref"]:
            if column not in columns:
                continue
            for (value,) in connection.execute(
                f"SELECT {column} FROM {table_name} WHERE {column} IS NOT NULL AND trim({column}) != ''"
            ).fetchall():
                result["target_refs"].append({"table": table_name, "column": column, "ref": value})

print(json.dumps(result, ensure_ascii=False))
`;

  const completed = spawnSync("python3", ["-c", probe, dbPath, mode], {
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

function summarizeStableKeys(rows, kind) {
  const explicitRows = rows.filter((row) => stableKeyFromRow(row));
  const candidateRows = rows.filter((row) =>
    candidateKeyFromRow(row, kind === "relation" ? ["relation_key", "object_key"] : ["object_key"]),
  );
  const deterministicPublicIdRows = rows.filter((row) => {
    const publicId = deterministicPublicIdFromRow(row);
    return publicId && !isUuidLike(publicId) && looksLikeStableKey(publicId);
  });
  const invalidStableKeys = explicitRows
    .filter((row) => !looksLikeStableKey(stableKeyFromRow(row)))
    .slice(0, 10)
    .map((row) => ({ id: row.id, stable_key: stableKeyFromRow(row), type: row.type || row.relation_type || null }));
  const invalidDeterministicPublicIds = rows
    .filter((row) => {
      const publicId = deterministicPublicIdFromRow(row);
      return publicId && (isUuidLike(publicId) || !looksLikeStableKey(publicId));
    })
    .slice(0, 10)
    .map((row) => ({
      id: row.id,
      public_id: deterministicPublicIdFromRow(row),
      type: row.type || row.relation_type || null,
    }));

  return {
    total: rows.length,
    explicitStableKeyCount: explicitRows.length,
    candidateStableKeyCount: candidateRows.length,
    deterministicPublicIdCount: deterministicPublicIdRows.length,
    explicitStableKeyCoverage: rows.length ? explicitRows.length / rows.length : 0,
    candidateStableKeyCoverage: rows.length ? candidateRows.length / rows.length : 0,
    deterministicPublicIdCoverage: rows.length ? deterministicPublicIdRows.length / rows.length : 0,
    uuidIdCount: rows.filter((row) => isUuidLike(row.id)).length,
    invalidStableKeys,
    invalidDeterministicPublicIds,
  };
}

function auditBaseDatabase(baseDb) {
  const issues = [];
  const checks = [];

  if (!existsSync(baseDb)) {
    addIssue(issues, "error", "missing_base_db", "基础库文件不存在。", { path: displayPath(baseDb) });
    return { checks, issues, metrics: {} };
  }

  let snapshot;
  try {
    snapshot = runSqliteProbe(baseDb, "base");
  } catch (error) {
    addIssue(issues, "error", "base_db_read_failed", "基础库只读打开或查询失败。", {
      path: displayPath(baseDb),
      detail: error.message,
    });
    return { checks, issues, metrics: {} };
  }

  const tables = new Set(snapshot.tables);
  for (const table of ["knowledge_items", "knowledge_relations"]) {
    if (!tables.has(table)) {
      addIssue(issues, "error", "missing_base_table", `基础库缺少 ${table} 表。`, { table });
    }
  }

  const itemColumns = new Set(snapshot.columns.knowledge_items || []);
  const relationColumns = new Set(snapshot.columns.knowledge_relations || []);
  const itemRows = snapshot.knowledge_items || [];
  const relationRows = snapshot.knowledge_relations || [];
  const itemStable = summarizeStableKeys(itemRows, "item");
  const relationStable = summarizeStableKeys(relationRows, "relation");

  if (!itemColumns.has("stable_key") && !itemColumns.has("stable_ref")) {
    addIssue(issues, "error", "missing_item_stable_key_column", "knowledge_items 缺少显式 stable_key / stable_ref 字段。");
  }
  if (!relationColumns.has("stable_key") && !relationColumns.has("stable_ref")) {
    addIssue(issues, "error", "missing_relation_stable_key_column", "knowledge_relations 缺少显式 stable_key / stable_ref 字段。");
  }
  if (itemRows.length && itemStable.explicitStableKeyCount !== itemRows.length) {
    addIssue(issues, "error", "item_stable_key_incomplete", "基础对象 stable_key 覆盖率不足 100%。", {
      total: itemRows.length,
      explicitStableKeyCount: itemStable.explicitStableKeyCount,
      candidateStableKeyCount: itemStable.candidateStableKeyCount,
    });
  }
  if (relationRows.length && relationStable.explicitStableKeyCount !== relationRows.length) {
    addIssue(issues, "error", "relation_stable_key_incomplete", "基础关系 stable_key 覆盖率不足 100%。", {
      total: relationRows.length,
      explicitStableKeyCount: relationStable.explicitStableKeyCount,
      candidateStableKeyCount: relationStable.candidateStableKeyCount,
    });
  }
  if (itemRows.length && itemStable.deterministicPublicIdCount !== itemRows.length) {
    addIssue(issues, "error", "item_public_id_incomplete", "knowledge_items 缺少 100% deterministic public_id / deterministic_id。内部 UUID id 可暂保留，但必须有稳定对外 ID。", {
      uuidIdCount: itemStable.uuidIdCount,
      total: itemRows.length,
      deterministicPublicIdCount: itemStable.deterministicPublicIdCount,
    });
  }
  if (relationRows.length && relationStable.deterministicPublicIdCount !== relationRows.length) {
    addIssue(issues, "error", "relation_public_id_incomplete", "knowledge_relations 缺少 100% deterministic public_id / deterministic_id。内部 UUID id 可暂保留，但必须有稳定对外 ID。", {
      uuidIdCount: relationStable.uuidIdCount,
      total: relationRows.length,
      deterministicPublicIdCount: relationStable.deterministicPublicIdCount,
    });
  }

  for (const issue of itemStable.invalidStableKeys) {
    addIssue(issues, "error", "invalid_item_stable_key", "基础对象 stable_key 为空、像 UUID 或包含空白 / 非稳定字符。", issue);
  }
  for (const issue of relationStable.invalidStableKeys) {
    addIssue(issues, "error", "invalid_relation_stable_key", "基础关系 stable_key 为空、像 UUID 或包含空白 / 非稳定字符。", issue);
  }
  for (const issue of itemStable.invalidDeterministicPublicIds) {
    addIssue(issues, "error", "invalid_item_public_id", "基础对象 public_id / deterministic_id 为空、像 UUID 或包含空白 / 非稳定字符。", issue);
  }
  for (const issue of relationStable.invalidDeterministicPublicIds) {
    addIssue(issues, "error", "invalid_relation_public_id", "基础关系 public_id / deterministic_id 为空、像 UUID 或包含空白 / 非稳定字符。", issue);
  }

  const duplicateItemStableKeys = duplicateCounts(itemRows, (row) => {
    const stableKey = stableKeyFromRow(row);
    return stableKey ? `${row.type || ""}:${stableKey}` : "";
  });
  const duplicateRelationStableKeys = duplicateCounts(relationRows, (row) => {
    const stableKey = stableKeyFromRow(row);
    return stableKey ? `${row.relation_type || ""}:${stableKey}` : "";
  });
  if (duplicateItemStableKeys.length) {
    addIssue(issues, "error", "duplicate_item_stable_key", "基础对象 stable_key 在同一 type 下重复。", {
      samples: duplicateItemStableKeys,
    });
  }
  if (duplicateRelationStableKeys.length) {
    addIssue(issues, "error", "duplicate_relation_stable_key", "基础关系 stable_key 在同一 relation_type 下重复。", {
      samples: duplicateRelationStableKeys,
    });
  }

  const redirectAudit = auditRedirects(snapshot);
  issues.push(...redirectAudit.issues);

  checks.push(
    {
      name: "base_database_readonly_open",
      ok: true,
      detail: displayPath(baseDb),
    },
    {
      name: "knowledge_items_stable_key_coverage",
      ok: itemRows.length > 0 && itemStable.explicitStableKeyCount === itemRows.length,
      metrics: itemStable,
    },
    {
      name: "knowledge_relations_stable_key_coverage",
      ok: relationRows.length > 0 && relationStable.explicitStableKeyCount === relationRows.length,
      metrics: relationStable,
    },
    {
      name: "deterministic_public_id",
      ok:
        itemRows.length > 0 &&
        relationRows.length > 0 &&
        itemStable.deterministicPublicIdCount === itemRows.length &&
        relationStable.deterministicPublicIdCount === relationRows.length,
      metrics: {
        itemUuidIdCount: itemStable.uuidIdCount,
        relationUuidIdCount: relationStable.uuidIdCount,
        itemDeterministicPublicIdCount: itemStable.deterministicPublicIdCount,
        relationDeterministicPublicIdCount: relationStable.deterministicPublicIdCount,
      },
    },
    redirectAudit.check,
  );

  return {
    checks,
    issues,
    metrics: {
      tables: snapshot.counts,
      knowledgeItems: itemStable,
      knowledgeRelations: relationStable,
      baseIdRedirects: redirectAudit.metrics,
    },
  };
}

function auditRedirects(snapshot) {
  const issues = [];
  const columns = new Set(snapshot.columns.base_id_redirects || []);
  const rows = snapshot.base_id_redirects || [];
  if (!snapshot.tables.includes("base_id_redirects")) {
    addIssue(issues, "error", "missing_base_id_redirects", "基础库缺少 base_id_redirects 表。");
    return {
      issues,
      check: { name: "base_id_redirects_contract", ok: false, metrics: { exists: false } },
      metrics: { exists: false, rows: 0, redirectTypes: {} },
    };
  }

  const missingColumns = REQUIRED_REDIRECT_COLUMNS.filter((column) => !columns.has(column));
  if (missingColumns.length) {
    addIssue(issues, "error", "base_id_redirects_missing_columns", "base_id_redirects 表缺少必要字段。", {
      missingColumns,
    });
  }

  const redirectTypes = {};
  for (const row of rows) {
    const type = String(row.redirect_type || "");
    redirectTypes[type] = (redirectTypes[type] || 0) + 1;
    if (!ALLOWED_REDIRECT_TYPES.includes(type)) {
      addIssue(issues, "error", "invalid_redirect_type", "base_id_redirects.redirect_type 使用了未定义类型。", {
        id: row.id,
        redirect_type: row.redirect_type,
      });
    }
    if (!isStableBaseRef(row.old_ref) && !isStableBaseRelationRef(row.old_ref)) {
      addIssue(issues, "error", "invalid_redirect_old_ref", "base_id_redirects.old_ref 必须是 stable base/base_relation ref。", {
        id: row.id,
        old_ref: row.old_ref,
      });
    }
    if (type !== "deprecated" && (!row.new_ref || (!isStableBaseRef(row.new_ref) && !isStableBaseRelationRef(row.new_ref)))) {
      addIssue(issues, "error", "invalid_redirect_new_ref", "rename / merge / split / retype 必须提供 stable new_ref。", {
        id: row.id,
        redirect_type: row.redirect_type,
        new_ref: row.new_ref,
      });
    }
    if (type === "deprecated" && row.new_ref) {
      addIssue(issues, "warning", "deprecated_redirect_has_new_ref", "deprecated 通常不应提供 new_ref；如有替代对象，应考虑 rename / merge / retype。", {
        id: row.id,
        new_ref: row.new_ref,
      });
    }
  }

  const missingTypes = REQUIRED_REDIRECT_TYPES.filter((type) => !redirectTypes[type]);
  if (missingTypes.length) {
    addIssue(issues, "warning", "redirect_type_coverage_incomplete", "base_id_redirects 尚未覆盖 rename / merge / split / deprecated 全部示例类型。", {
      missingTypes,
    });
  }

  const duplicateOldRefs = duplicateCounts(rows, (row) => {
    if (String(row.redirect_type || "") === "split") return "";
    return row.old_ref || "";
  });
  if (duplicateOldRefs.length) {
    addIssue(issues, "error", "duplicate_redirect_old_ref", "非 split redirect 不应有多个相同 old_ref。", {
      samples: duplicateOldRefs,
    });
  }

  return {
    issues,
    check: {
      name: "base_id_redirects_contract",
      ok: !hasFatalIssue(issues),
      metrics: {
        exists: true,
        rows: rows.length,
        redirectTypes,
        missingColumns,
        requiredTypes: REQUIRED_REDIRECT_TYPES,
      },
    },
    metrics: {
      exists: true,
      rows: rows.length,
      redirectTypes,
      missingColumns,
    },
  };
}

function auditUserTargetRefs(userDb) {
  const issues = [];
  const checks = [];
  const metrics = {
    exists: existsSync(userDb),
    totalRefs: 0,
    stableBaseRefs: 0,
    stableBaseRelationRefs: 0,
    legacyBaseRefs: 0,
    userRefs: 0,
    pageRefs: 0,
    otherRefs: 0,
    byTable: {},
    samples: [],
  };

  if (!existsSync(userDb)) {
    addIssue(issues, "warning", "missing_user_db", "未找到用户库，跳过 target_ref 抽样。", { path: displayPath(userDb) });
    checks.push({ name: "user_target_ref_sampling", ok: true, skipped: true, detail: "user db missing" });
    return { checks, issues, metrics };
  }

  let snapshot;
  try {
    snapshot = runSqliteProbe(userDb, "user");
  } catch (error) {
    addIssue(issues, "warning", "user_db_read_failed", "用户库只读打开或查询失败，跳过 target_ref 抽样。", {
      path: displayPath(userDb),
      detail: error.message,
    });
    checks.push({ name: "user_target_ref_sampling", ok: true, skipped: true, detail: "user db read failed" });
    return { checks, issues, metrics };
  }

  const refs = snapshot.target_refs || [];
  metrics.totalRefs = refs.length;
  for (const item of refs) {
    const ref = String(item.ref || "");
    const tableKey = `${item.table}.${item.column}`;
    metrics.byTable[tableKey] = (metrics.byTable[tableKey] || 0) + 1;
    if (isPageTargetRef(ref)) {
      metrics.pageRefs += 1;
    } else if (isStableBaseRef(ref)) {
      metrics.stableBaseRefs += 1;
    } else if (isStableBaseRelationRef(ref)) {
      metrics.stableBaseRelationRefs += 1;
    } else if (isLegacyBaseRef(ref)) {
      metrics.legacyBaseRefs += 1;
      if (metrics.samples.length < 10) metrics.samples.push(item);
    } else if (/^user:[^:]+:.+/.test(ref) || /^user_relation:[^:]+:.+/.test(ref)) {
      metrics.userRefs += 1;
    } else {
      metrics.otherRefs += 1;
      if (metrics.samples.length < 10) metrics.samples.push(item);
    }
  }

  if (metrics.legacyBaseRefs > 0) {
    addIssue(issues, "error", "legacy_base_target_refs", "用户库仍存在旧 base target_ref；后续应通过 stable ref / redirect 迁移。", {
      count: metrics.legacyBaseRefs,
      samples: metrics.samples.filter((item) => isLegacyBaseRef(item.ref)).slice(0, 5),
    });
  }
  if (metrics.otherRefs > 0) {
    addIssue(issues, "warning", "non_base_target_refs", "用户库存在非 base/user/page 格式引用；可能是批注 v2 坐标或旧格式，需要单独归一。", {
      count: metrics.otherRefs,
      samples: metrics.samples.filter((item) => !isLegacyBaseRef(item.ref)).slice(0, 5),
    });
  }
  if (metrics.pageRefs > 0) {
    addIssue(issues, "warning", "page_target_refs_require_contextual_resolver", "用户库存在 v2 / 指南 / 幻灯片页面锚点；这些不是基础对象 stable ref，后续必须保留页面上下文解析器。", {
      count: metrics.pageRefs,
    });
  }

  for (const contract of TARGET_REF_TABLES) {
    if (!snapshot.tables.includes(contract.table)) continue;
    const columns = new Set(snapshot.columns[contract.table] || []);
    for (const column of contract.columns) {
      if (!columns.has(column)) {
        addIssue(issues, "warning", "target_ref_column_missing", `${contract.table}.${column} 不存在，target_ref 抽样覆盖不完整。`, {
          table: contract.table,
          column,
        });
      }
    }
  }

  checks.push({
    name: "user_target_ref_sampling",
    ok: metrics.legacyBaseRefs === 0,
    metrics,
  });
  return { checks, issues, metrics };
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

  const baseDb = args.baseDb ? resolveProjectPath(args.baseDb) : firstExisting(DEFAULT_BASE_DB_CANDIDATES);
  const userDb = args.userDb ? resolveProjectPath(args.userDb) : firstExisting(DEFAULT_USER_DB_CANDIDATES);
  const baseAudit = auditBaseDatabase(baseDb);
  const userAudit = auditUserTargetRefs(userDb);
  const issues = [...baseAudit.issues, ...userAudit.issues];
  const checks = [...baseAudit.checks, ...userAudit.checks];
  const result = {
    result: hasFatalIssue(issues) ? "fail" : "pass",
    contract: "stable_key / deterministic ID / base_id_redirects",
    inputs: {
      baseDb: displayPath(baseDb),
      userDb: displayPath(userDb),
    },
    checked: {
      baseDbExists: existsSync(baseDb),
      userDbExists: existsSync(userDb),
      checks: checks.length,
      errors: issues.filter((issue) => issue.severity === "error").length,
      warnings: issues.filter((issue) => issue.severity === "warning").length,
    },
    checks,
    metrics: {
      base: baseAudit.metrics,
      userTargetRefs: userAudit.metrics,
    },
    issues,
  };

  console.log(JSON.stringify(result, null, 2));
  if (result.result !== "pass") process.exit(1);
}

main();
