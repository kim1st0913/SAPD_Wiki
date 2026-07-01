#!/usr/bin/env node

const DEFAULT_URL = "http://127.0.0.1:5173/";
const MARKER = "SAPD批注回归测试";

const COVERAGE_MATRIX = [
  { route: "/capability-mapping", label: "安全能力映射", anchors: ["page", "object", "row", "field"] },
  { route: "/environment-mapping", label: "信息化环境安全能力映射", anchors: ["page", "object", "field"] },
  { route: "/development-security", label: "LC-AP安全开发生命周期", anchors: ["page", "object", "field"] },
  { route: "/data-security", label: "LC-DT数据生命周期安全", anchors: ["page", "object", "field"] },
  { route: "/knowledge/technical", label: "知识库字典", anchors: ["page", "object", "row", "field"] },
  { route: "/standards/iso-27001-2022", label: "安全标准 / 框架", anchors: ["page", "object", "row", "field"] },
  { route: "/guides/security-architecture-design", label: "安全指南 / 幻灯片", anchors: ["page", "object"] },
];

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

function normalizedAnchorType(note = {}) {
  const type = text(note.anchor_type).trim();
  if (type === "value") return "field";
  if (type) return type;
  const ref = text(note.target_ref).trim();
  if (ref.startsWith("base:field_value:")) return "field";
  if (ref.startsWith("base:table_row:")) return "row";
  if (ref.startsWith("page:")) return "page";
  return "object";
}

function cloneFixtureFromNote(note, label, anchorType) {
  return {
    target_ref: note.target_ref,
    body: `${MARKER}：${label} / ${anchorType} / ${text(note.object_title || note.page_title || note.target_ref).trim()}`,
    status: "todo",
    page_route: note.page_route,
    page_title: note.page_title || label,
    anchor_type: note.anchor_type || anchorType,
    object_type: note.object_type || (anchorType === "page" ? "page" : "object"),
    object_title: note.object_title || note.page_title || label,
    tags: [MARKER, label, anchorType],
  };
}

function pageFixture(route, label) {
  return {
    target_ref: `page:${route}`,
    body: `${MARKER}：${label} / page / 页面级测试批注`,
    status: "todo",
    page_route: route,
    page_title: label,
    anchor_type: "page",
    object_type: "page",
    object_title: label,
    tags: [MARKER, label, "page"],
  };
}

function buildFixtures(notes) {
  const byRouteAnchor = new Map();
  for (const note of notes) {
    const route = canonicalRoute(note.page_route);
    const anchor = normalizedAnchorType(note);
    const key = `${route}::${anchor}`;
    if (!byRouteAnchor.has(key)) byRouteAnchor.set(key, note);
  }
  const fixtures = [];
  for (const item of COVERAGE_MATRIX) {
    fixtures.push(pageFixture(item.route, item.label));
    for (const anchor of item.anchors.filter((value) => value !== "page")) {
      const note = byRouteAnchor.get(`${canonicalRoute(item.route)}::${anchor}`);
      if (note) fixtures.push(cloneFixtureFromNote(note, item.label, anchor));
    }
  }
  const seen = new Set();
  return fixtures.filter((fixture) => {
    const key = [fixture.page_route, fixture.anchor_type, fixture.target_ref, fixture.body].join("::");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function localSessionToken(baseUrl) {
  const health = await fetchJson(new URL("/api/v1/health", baseUrl));
  return text(health?.data?.session_token || health?.session_token).trim();
}

async function createNote(baseUrl, token, payload) {
  return fetchJson(new URL("/api/v1/user/notes", baseUrl), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-SAPD-Session-Token": token,
    },
    body: JSON.stringify(payload),
  });
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

async function main() {
  const baseUrl = argValue("--url", DEFAULT_URL);
  const apply = hasFlag("--apply");
  const cleanup = hasFlag("--cleanup");
  const confirmed = hasFlag("--confirm-user-notes-test-data");
  const envelope = await fetchJson(new URL("/api/v1/user/notes", baseUrl));
  const notes = notesFromEnvelope(envelope);

  if (cleanup) {
    if (!confirmed) throw new Error("清理测试批注必须显式传入 --confirm-user-notes-test-data。");
    const token = await localSessionToken(baseUrl);
    const targets = notes.filter((note) => text(note.body).startsWith(MARKER));
    const deleted = [];
    for (const note of targets) deleted.push({ id: note.id, result: await deleteNote(baseUrl, token, note.id) });
    console.log(JSON.stringify({ result: "pass", mode: "cleanup", marker: MARKER, deleted_count: deleted.length, deleted }, null, 2));
    return;
  }

  const fixtures = buildFixtures(notes);
  const report = {
    result: "pass",
    mode: apply ? "apply" : "dry_run",
    marker: MARKER,
    source_note_count: notes.length,
    fixture_count: fixtures.length,
    coverage: fixtures.reduce((acc, fixture) => {
      const route = canonicalRoute(fixture.page_route);
      if (!acc[route]) acc[route] = {};
      acc[route][fixture.anchor_type] = (acc[route][fixture.anchor_type] || 0) + 1;
      return acc;
    }, {}),
    fixtures,
  };

  if (apply) {
    if (!confirmed) throw new Error("写入测试批注必须显式传入 --confirm-user-notes-test-data。");
    const token = await localSessionToken(baseUrl);
    const created = [];
    for (const fixture of fixtures) created.push(await createNote(baseUrl, token, fixture));
    report.created_count = created.length;
    report.created = created;
  }

  console.log(JSON.stringify(report, null, 2));
}

main().catch((error) => {
  console.error(JSON.stringify({ result: "fail", error: error.message }, null, 2));
  process.exit(1);
});
