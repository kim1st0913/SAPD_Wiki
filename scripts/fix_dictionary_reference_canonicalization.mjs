#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const PROJECT_ROOT = process.cwd();
const DATA_ROOT = path.join(PROJECT_ROOT, "frontend", "capability-browser", "public", "data");
const APPLY = process.argv.includes("--apply");

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function normalizeText(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function arrayOf(value) {
  return Array.isArray(value) ? value : [];
}

function listJsonFiles(directory) {
  const rows = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    const relative = path.relative(DATA_ROOT, absolute).split(path.sep).join("/");
    if (entry.isDirectory()) {
      if (relative === "source-evidence" || relative.startsWith("source-evidence/")) continue;
      rows.push(...listJsonFiles(absolute));
    } else if (entry.isFile() && entry.name.endsWith(".json")) {
      rows.push(absolute);
    }
  }
  return rows.sort();
}

function buildScopeAuthority() {
  const payload = readJson(path.join(DATA_ROOT, "maintenance", "scopes.json"));
  const byId = new Map();
  const byCode = new Map();
  const byTitle = new Map();
  for (const scope of arrayOf(payload.scope_types)) {
    const canonical = {
      id: normalizeText(scope.id),
      type: "scope_type",
      code: normalizeText(scope.code),
      title: normalizeText(scope.title || scope.name),
      name: normalizeText(scope.name || scope.title),
      description: scope.description || "",
      category: scope.category || scope.scenario || "",
      status: scope.status || "",
    };
    if (canonical.id) byId.set(canonical.id, canonical);
    if (canonical.code) byCode.set(canonical.code, canonical);
    if (canonical.title) byTitle.set(canonical.title, canonical);
    if (canonical.name) byTitle.set(canonical.name, canonical);
  }
  return { byId, byCode, byTitle };
}

function canonicalForScopeReference(record, authority) {
  if (!record || typeof record !== "object" || Array.isArray(record)) return null;
  const type = record.type || record.object_type || record.objectType;
  if (type !== "scope_type") return null;
  return (
    authority.byId.get(normalizeText(record.id)) ||
    authority.byCode.get(normalizeText(record.code)) ||
    authority.byTitle.get(normalizeText(record.title || record.name)) ||
    null
  );
}

function canonicalizeObject(record, authority, stats) {
  const canonical = canonicalForScopeReference(record, authority);
  if (canonical) {
    const before = JSON.stringify(record);
    record.id = canonical.id || record.id || "";
    record.type = "scope_type";
    record.code = canonical.code || record.code || "";
    record.title = canonical.title || record.title || record.name || "";
    if ("name" in record || record.name !== undefined) record.name = canonical.name || canonical.title || record.name || record.title || "";
    if ("description" in record && !record.description) record.description = canonical.description || "";
    if ("category" in record) record.category = canonical.category || record.category || "";
    if ("status" in record && !record.status) record.status = canonical.status || "";
    if (JSON.stringify(record) !== before) stats.scopeObjectsUpdated += 1;
  }

  const ids = arrayOf(record.related_scope_ids).map(normalizeText);
  if (ids.length && Array.isArray(record.related_scope_names)) {
    const nextNames = record.related_scope_names.map((name, index) => {
      const canonicalScope = authority.byId.get(ids[index]);
      return canonicalScope?.title || name;
    });
    if (JSON.stringify(nextNames) !== JSON.stringify(record.related_scope_names)) {
      record.related_scope_names = nextNames;
      stats.relatedScopeNamesUpdated += 1;
    }
  }
}

function walk(value, authority, stats) {
  if (Array.isArray(value)) {
    for (const item of value) walk(item, authority, stats);
    return;
  }
  if (!value || typeof value !== "object") return;
  canonicalizeObject(value, authority, stats);
  for (const child of Object.values(value)) walk(child, authority, stats);
}

function main() {
  const authority = buildScopeAuthority();
  const files = listJsonFiles(DATA_ROOT);
  const changedFiles = [];
  const stats = {
    mode: APPLY ? "apply" : "dry-run",
    filesScanned: files.length,
    filesChanged: 0,
    scopeObjectsUpdated: 0,
    relatedScopeNamesUpdated: 0,
    changedFiles: [],
  };

  for (const filePath of files) {
    const before = fs.readFileSync(filePath, "utf8");
    const payload = JSON.parse(before);
    const fileStats = { scopeObjectsUpdated: 0, relatedScopeNamesUpdated: 0 };
    walk(payload, authority, fileStats);
    const after = `${JSON.stringify(payload, null, 2)}\n`;
    if (after === before) continue;
    const relative = path.relative(PROJECT_ROOT, filePath).split(path.sep).join("/");
    changedFiles.push(relative);
    stats.scopeObjectsUpdated += fileStats.scopeObjectsUpdated;
    stats.relatedScopeNamesUpdated += fileStats.relatedScopeNamesUpdated;
    if (APPLY) fs.writeFileSync(filePath, after, "utf8");
  }

  stats.filesChanged = changedFiles.length;
  stats.changedFiles = changedFiles.slice(0, 50);
  console.log(JSON.stringify(stats, null, 2));
}

main();
