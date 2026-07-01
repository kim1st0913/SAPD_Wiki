#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const DEFAULT_URL = "http://127.0.0.1:5173/";
const KNOWN_ROUTES = new Set([
  "/",
  "/capability-mapping",
  "/environment-mapping",
  "/development-security",
  "/data-security",
  "/guides",
  "/guides/security-architecture-design",
  "/guides/security-architecture-modeling-language",
  "/guides/data-security-design",
  "/guides/light-planning",
  "/knowledge/capabilities",
  "/knowledge/scopes",
  "/knowledge/technical-services",
  "/knowledge/technical",
  "/knowledge/technical-modules",
  "/knowledge/technical-measures",
  "/knowledge/management-workflows",
  "/knowledge/application-systems",
  "/knowledge/functions",
  "/knowledge/gbt-42446",
  "/knowledge/role-references",
  "/standards",
  "/standards/mlps-level-3",
  "/standards/nist-csf-2",
  "/standards/iso-27001-2022",
  "/standards/dsp-level-2",
  "/standards/cis-csc-v8",
  "/standards/crf",
  "/standards/nist-800-53-rev5",
]);

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function hasFlag(name) {
  return process.argv.includes(name);
}

function text(value) {
  return value == null ? "" : String(value);
}

function list(value) {
  return Array.isArray(value) ? value : [];
}

function canonicalRoute(route = "") {
  const normalized = text(route).trim().replace(/[?#].*$/, "").replace(/\/+$/, "") || "/";
  const aliases = {
    "/knowledge/technical-modules": "/knowledge/technical",
    "/knowledge/technical-measures": "/knowledge/technical",
  };
  return aliases[normalized] || normalized;
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, { cache: "no-store", ...options });
  const body = await response.text();
  let json = null;
  try {
    json = body ? JSON.parse(body) : null;
  } catch {
    json = { ok: false, error: body.slice(0, 240) };
  }
  if (!response.ok) throw new Error(`${url} returned HTTP ${response.status}: ${json?.error || body.slice(0, 120)}`);
  return json;
}

function notesFromEnvelope(envelope) {
  return list(envelope?.data?.notes || envelope?.notes);
}

function savedAuditRows(savedAuditPath = "") {
  const auditPath = text(savedAuditPath).trim();
  if (!auditPath) return [];
  const absolute = path.isAbsolute(auditPath) ? auditPath : path.join(ROOT, auditPath);
  const payload = JSON.parse(fs.readFileSync(absolute, "utf8"));
  return list(payload.results);
}

function groupKey(note) {
  return [canonicalRoute(note.page_route), text(note.target_ref).trim(), text(note.body).trim(), text(note.object_title).trim()].join("::");
}

function noteSummary(note) {
  return {
    id: note.id,
    page_route: note.page_route,
    anchor_type: note.anchor_type,
    object_type: note.object_type,
    object_title: note.object_title,
    target_ref: note.target_ref,
    body_preview: text(note.body).replace(/\s+/g, " ").trim().slice(0, 80),
  };
}

function buildAudit(notes, savedRows = []) {
  const duplicateGroups = new Map();
  notes.forEach((note) => {
    const key = groupKey(note);
    if (!duplicateGroups.has(key)) duplicateGroups.set(key, []);
    duplicateGroups.get(key).push(note);
  });
  const savedById = new Map(savedRows.filter((row) => row?.id).map((row) => [text(row.id), row]));
  const savedByOrdinal = new Map(savedRows.filter((row) => row?.ordinal).map((row) => [Number(row.ordinal), row]));
  const invalid = [];
  notes.forEach((note, index) => {
    const id = text(note.id).trim();
    const pageRoute = canonicalRoute(note.page_route);
    const targetRef = text(note.target_ref).trim();
    const body = text(note.body).trim();
    const anchorType = text(note.anchor_type).trim();
    if (!id) invalid.push({ reason: "missing_id", autoCleanupCandidate: false, note: noteSummary(note) });
    if (!pageRoute) invalid.push({ reason: "missing_page_route", autoCleanupCandidate: false, note: noteSummary(note) });
    if (!targetRef) invalid.push({ reason: "missing_target_ref", autoCleanupCandidate: false, note: noteSummary(note) });
    if (!body) invalid.push({ reason: "missing_body", autoCleanupCandidate: false, note: noteSummary(note) });
    if (!anchorType) invalid.push({ reason: "missing_anchor_type", autoCleanupCandidate: false, note: noteSummary(note) });
    if (pageRoute && !KNOWN_ROUTES.has(pageRoute)) invalid.push({ reason: "unknown_page_route", autoCleanupCandidate: false, note: noteSummary(note) });
    const saved = savedById.get(id) || savedByOrdinal.get(index + 1);
    if (saved?.failureReasons?.length) {
      invalid.push({
        reason: "saved_annotation_audit_failed",
        autoCleanupCandidate: false,
        failureReasons: saved.failureReasons,
        note: noteSummary(note),
      });
    }
  });
  const duplicates = [...duplicateGroups.values()]
    .filter((group) => group.length > 1)
    .map((group) => ({
      reason: "duplicate_same_route_target_body",
      autoCleanupCandidate: false,
      count: group.length,
      notes: group.map(noteSummary),
    }));
  return {
    result: invalid.length || duplicates.length ? "review_required" : "pass",
    generated_at: new Date().toISOString(),
    note_count: notes.length,
    invalid_count: invalid.length,
    duplicate_group_count: duplicates.length,
    cleanup_mode: "dry_run",
    invalid,
    duplicates,
  };
}

async function localSessionToken(baseUrl) {
  const health = await fetchJson(new URL("/api/v1/health", baseUrl));
  return text(health?.data?.session_token || health?.session_token).trim();
}

async function deleteNote(baseUrl, token, noteId) {
  return fetchJson(new URL(`/api/v1/user/notes/${encodeURIComponent(noteId)}`, baseUrl), {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
      "X-SAPD-Session-Token": token,
    },
    body: "{}",
  });
}

function writeReport(report, outputPath) {
  const absolute = path.isAbsolute(outputPath) ? outputPath : path.join(ROOT, outputPath);
  fs.mkdirSync(path.dirname(absolute), { recursive: true });
  fs.writeFileSync(absolute, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  return absolute;
}

async function main() {
  const baseUrl = argValue("--url", DEFAULT_URL);
  const savedAuditPath = argValue("--saved-audit", "");
  const outputPath = argValue("--output", "data/exports/worker-verify/user-notes-integrity-audit.json");
  const write = hasFlag("--write-report") || Boolean(outputPath);
  const apply = hasFlag("--apply");
  const confirmed = hasFlag("--confirm-user-notes-cleanup");
  const envelope = await fetchJson(new URL("/api/v1/user/notes", baseUrl));
  const notes = notesFromEnvelope(envelope);
  const report = buildAudit(notes, savedAuditRows(savedAuditPath));

  if (apply) {
    if (!confirmed) throw new Error("清理用户批注必须显式传入 --confirm-user-notes-cleanup。");
    const cleanupIds = report.invalid.filter((item) => item.autoCleanupCandidate).map((item) => item.note?.id).filter(Boolean);
    const token = await localSessionToken(baseUrl);
    const deleted = [];
    for (const noteId of cleanupIds) {
      deleted.push({ id: noteId, result: await deleteNote(baseUrl, token, noteId) });
    }
    report.cleanup_mode = "apply";
    report.deleted = deleted;
  }

  if (write) report.output_path = writeReport(report, outputPath);
  console.log(JSON.stringify(report, null, 2));
  process.exitCode = hasFlag("--strict") && report.result !== "pass" ? 1 : 0;
}

main().catch((error) => {
  console.error(JSON.stringify({ result: "fail", error: error.message }, null, 2));
  process.exit(1);
});
