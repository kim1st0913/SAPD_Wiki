#!/usr/bin/env node

import net from "node:net";

const PORT = Number(process.env.SAPD_WIKI_PORT || 5173);
const LOOPBACK_HOST = "127.0.0.1";
const BASE_URL = `http://${LOOPBACK_HOST}:${PORT}`;
const AUTH_HEADER = "X-SAPD-Session-Token";

const checks = [];

function addCheck(name, ok, details = {}) {
  checks.push({ name, ok: Boolean(ok), details });
}

function parseHttpStatus(raw) {
  const match = String(raw || "").match(/^HTTP\/\d(?:\.\d)?\s+(\d+)/);
  return match ? Number(match[1]) : 0;
}

function rawHttpRequest({ method = "GET", path = "/", hostHeader = `${LOOPBACK_HOST}:${PORT}`, headers = {}, body = "" }) {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection({ host: LOOPBACK_HOST, port: PORT });
    const chunks = [];
    socket.setTimeout(5000);
    socket.on("connect", () => {
      const rawBody = String(body || "");
      const requestHeaders = {
        Host: hostHeader,
        Connection: "close",
        ...headers,
      };
      if (rawBody && !requestHeaders["Content-Length"]) {
        requestHeaders["Content-Length"] = Buffer.byteLength(rawBody);
      }
      const head = [
        `${method} ${path} HTTP/1.1`,
        ...Object.entries(requestHeaders).map(([key, value]) => `${key}: ${value}`),
        "",
        "",
      ].join("\r\n");
      socket.write(head + rawBody);
    });
    socket.on("data", (chunk) => chunks.push(chunk));
    socket.on("end", () => {
      const raw = Buffer.concat(chunks).toString("utf8");
      resolve({ status: parseHttpStatus(raw), raw });
    });
    socket.on("timeout", () => {
      socket.destroy();
      reject(new Error(`raw HTTP request timed out: ${method} ${path}`));
    });
    socket.on("error", reject);
  });
}

async function fetchJson(path, options = {}) {
  const response = await fetch(`${BASE_URL}${path}`, { cache: "no-store", ...options });
  const text = await response.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  return { status: response.status, ok: response.ok, json, text };
}

async function deleteRegressionNotes(sessionToken) {
  const listResult = await fetchJson("/api/v1/user/notes");
  const notes = Array.isArray(listResult.json?.data?.notes) ? listResult.json.data.notes : [];
  const regressionNotes = notes.filter((note) => {
    return String(note?.target_ref || "").startsWith("page:/oi-145-regression") || String(note?.body || "").includes("OI-145 temporary note");
  });
  for (const note of regressionNotes) {
    if (!note?.id) continue;
    await fetchJson(`/api/v1/user/notes/${encodeURIComponent(note.id)}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json", Origin: BASE_URL, [AUTH_HEADER]: sessionToken },
      body: "{}",
    });
  }
  return regressionNotes.length;
}

const badHost = `attacker.example:${PORT}`;

const badHealth = await rawHttpRequest({ path: "/api/v1/health", hostHeader: badHost });
addCheck("bad_host_health_rejected", badHealth.status === 403, { status: badHealth.status });

const badNotes = await rawHttpRequest({ path: "/api/v1/user/notes", hostHeader: badHost });
addCheck("bad_host_notes_rejected", badNotes.status === 403, { status: badNotes.status });

const badWrite = await rawHttpRequest({
  method: "POST",
  path: "/api/v1/user/notes",
  hostHeader: badHost,
  headers: { "Content-Type": "application/json" },
  body: "{}",
});
addCheck("bad_host_note_write_rejected_before_business_validation", badWrite.status === 403, { status: badWrite.status });

const health = await fetchJson("/api/v1/health");
const auth = health.json?.data?.auth || {};
const sessionToken = auth.session_token || "";
addCheck("loopback_health_returns_write_token", health.status === 200 && auth.writes_require_token === true && auth.header === AUTH_HEADER && sessionToken.length >= 24, {
  status: health.status,
  writes_require_token: auth.writes_require_token,
  header: auth.header,
  token_length: sessionToken.length,
});

const normalNotes = await fetchJson("/api/v1/user/notes");
addCheck("loopback_notes_read_still_available", normalNotes.status === 200, { status: normalNotes.status });

const noTokenWrite = await fetchJson("/api/v1/user/notes", {
  method: "POST",
  headers: { "Content-Type": "application/json", Origin: BASE_URL },
  body: JSON.stringify({ target_ref: "page:/oi-145-regression", body: "CODex regression OI-145 no-token probe" }),
});
addCheck("loopback_note_write_without_token_rejected", noTokenWrite.status === 403, { status: noTokenWrite.status });

let createdNoteId = "";
let deletedStatus = 0;
const createPayload = {
  target_ref: `page:/oi-145-regression/${Date.now()}`,
  body: "CODex regression OI-145 temporary note",
  page_route: "/oi-145-regression",
  page_title: "OI-145 Regression",
  anchor_type: "object",
  object_type: "security-regression",
  object_title: "OI-145 temporary note",
};

if (sessionToken) {
  await deleteRegressionNotes(sessionToken);

  const createResult = await fetchJson("/api/v1/user/notes", {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: BASE_URL, [AUTH_HEADER]: sessionToken },
    body: JSON.stringify(createPayload),
  });
  createdNoteId = createResult.json?.data?.note?.id || "";
  addCheck("loopback_note_write_with_token_still_available", createResult.status === 200 && Boolean(createdNoteId), {
    status: createResult.status,
    created: Boolean(createdNoteId),
  });

  if (createdNoteId) {
    const deleteResult = await fetchJson(`/api/v1/user/notes/${encodeURIComponent(createdNoteId)}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json", Origin: BASE_URL, [AUTH_HEADER]: sessionToken },
      body: "{}",
    });
    deletedStatus = deleteResult.status;
    addCheck("loopback_note_delete_with_token_still_available", deleteResult.status === 200, { status: deleteResult.status });
  } else {
    addCheck("loopback_note_delete_with_token_still_available", false, { status: deletedStatus, skipped: "create_failed" });
  }
} else {
  addCheck("loopback_note_write_with_token_still_available", false, { skipped: "missing_session_token" });
  addCheck("loopback_note_delete_with_token_still_available", false, { skipped: "missing_session_token" });
}

const ok = checks.every((check) => check.ok);
console.log(JSON.stringify({ ok, port: PORT, checks }, null, 2));
if (!ok) {
  process.exitCode = 1;
}
