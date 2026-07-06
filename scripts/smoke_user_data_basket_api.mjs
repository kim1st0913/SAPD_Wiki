#!/usr/bin/env node
import { createHash } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";

const repoRoot = process.cwd();
const tmpRoot = path.join(os.tmpdir(), `sapd-user-data-basket-api-${Date.now()}-${Math.random().toString(16).slice(2)}`);

function fail(message, detail = undefined) {
  const suffix = detail === undefined ? "" : ` ${JSON.stringify(detail, null, 2)}`;
  throw new Error(`${message}${suffix}`);
}

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: repoRoot,
      stdio: ["ignore", "pipe", "pipe"],
      ...options,
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
      } else {
        reject(new Error(`${command} ${args.join(" ")} exited ${code}\n${stdout}\n${stderr}`));
      }
    });
  });
}

async function sha256File(filePath) {
  const data = await readFile(filePath);
  return createHash("sha256").update(data).digest("hex");
}

async function waitForState(statePath) {
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    try {
      return JSON.parse(await readFile(statePath, "utf8"));
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 150));
    }
  }
  fail("runtime-state.json was not written");
}

async function requestJson(url, options = {}) {
  const response = await fetch(url, options);
  const text = await response.text();
  let json;
  try {
    json = JSON.parse(text || "{}");
  } catch {
    fail("response was not JSON", { url, status: response.status, text });
  }
  return { response, json };
}

function forbiddenExportKeys(value) {
  const forbidden = new Set([
    "sheet",
    "row",
    "column",
    "raw_value",
    "source_file",
    "import_id",
    "source_id",
    "source_ref",
    "source_label",
    "debug",
    "raw",
    "metadata",
    "intermediate",
    "generated_at",
  ]);
  const found = new Set();
  function walk(node) {
    if (Array.isArray(node)) {
      node.forEach(walk);
      return;
    }
    if (!node || typeof node !== "object") return;
    for (const [key, child] of Object.entries(node)) {
      if (forbidden.has(key)) found.add(key);
      walk(child);
    }
  }
  walk(value);
  return [...found].sort();
}

async function waitForHealth(baseUrl, serverOutputRef) {
  const deadline = Date.now() + 10_000;
  let lastError;
  while (Date.now() < deadline) {
    try {
      const health = await requestJson(`${baseUrl}/api/v1/health`);
      if (health.json.ok) {
        return health;
      }
      lastError = new Error(JSON.stringify(health.json));
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  fail("health endpoint was not reachable", { error: String(lastError?.message || lastError), serverOutput: serverOutputRef() });
}

async function main() {
  let server;
  try {
    const frontendDir = path.join(tmpRoot, "app", "frontend-dist");
    const baseDir = path.join(tmpRoot, "data", "base");
    const userDir = path.join(tmpRoot, "data", "user");
    await mkdir(frontendDir, { recursive: true });
    await mkdir(baseDir, { recursive: true });
    await mkdir(userDir, { recursive: true });
    await mkdir(path.join(tmpRoot, "config"), { recursive: true });
    await mkdir(path.join(tmpRoot, "logs"), { recursive: true });
    await mkdir(path.join(tmpRoot, "diagnostics"), { recursive: true });
    await writeFile(path.join(frontendDir, "index.html"), "<!doctype html><title>SAPD smoke</title>", "utf8");
    await writeFile(path.join(tmpRoot, "SAPD-Wiki-Backend"), "placeholder", "utf8");

    const baseDb = path.join(baseDir, "sapd_wiki_base.sqlite3");
    const userDb = path.join(userDir, "sapd_wiki_user.sqlite3");
    await run("python3", [
      "-c",
      [
        "import sqlite3, sys",
        "conn=sqlite3.connect(sys.argv[1])",
        "conn.execute('CREATE TABLE knowledge_items(id TEXT PRIMARY KEY, title TEXT)')",
        "conn.execute('INSERT INTO knowledge_items(id, title) VALUES (?, ?)', ('base:item:1', 'Smoke Item'))",
        "conn.commit()",
        "conn.close()",
      ].join(";"),
      baseDb,
    ]);
    await run("python3", ["scripts/create_user_db.py", userDb]);

    const preferredPort = 28_000 + Math.floor(Math.random() * 2_000);
    const manifest = {
      app_version: "0.1.0-smoke",
      bundle_type: "zip-alpha",
      platform: "mac-arm64",
      build_time: "2026-06-07T00:00:00Z",
      base_database: {
        file: "sapd_wiki_base.sqlite3",
        sha256: await sha256File(baseDb),
        schema_version: "smoke_base_0.1",
        data_version: "smoke",
      },
      user_database: {
        file: "sapd_wiki_user.sqlite3",
        schema_version: "user_schema_0.3",
      },
      frontend: { dir: "app/frontend-dist" },
      backend: { entry: "SAPD-Wiki-Backend" },
    };
    const config = {
      frontend_dist: "app/frontend-dist",
      base_database: "data/base/sapd_wiki_base.sqlite3",
      user_database: "data/user/sapd_wiki_user.sqlite3",
      host: "127.0.0.1",
      preferred_port: preferredPort,
      fallback_ports: [preferredPort + 1, preferredPort + 2, preferredPort + 3],
      open_browser_on_start: false,
    };
    await writeFile(path.join(baseDir, "base-manifest.json"), JSON.stringify(manifest, null, 2), "utf8");
    await writeFile(path.join(tmpRoot, "config", "app-config.json"), JSON.stringify(config, null, 2), "utf8");

    server = spawn("python3", ["scripts/run_local_server.py", "--bundle-root", tmpRoot, "--no-browser"], {
      cwd: repoRoot,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let serverOutput = "";
    server.stdout.on("data", (chunk) => {
      serverOutput += chunk.toString();
    });
    server.stderr.on("data", (chunk) => {
      serverOutput += chunk.toString();
    });

    const state = await waitForState(path.join(tmpRoot, "logs", "runtime-state.json"));
    const baseUrl = state.url.replace(/\/$/, "");
    const health = await waitForHealth(baseUrl, () => serverOutput);
    const token = health.json.auth?.session_token;
    if (!token) {
      fail("health response did not return session token", health.json);
    }

    const writeHeaders = {
      "Content-Type": "application/json",
      "Origin": baseUrl,
      "X-SAPD-Session-Token": token,
    };

    const rejected = await requestJson(`${baseUrl}/api/v1/user/data-baskets`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: baseUrl },
      body: JSON.stringify({ name: "should fail" }),
    });
    if (rejected.response.status !== 403) {
      fail("write without token should be rejected", { status: rejected.response.status, body: rejected.json });
    }

    const create = await requestJson(`${baseUrl}/api/v1/user/data-baskets`, {
      method: "POST",
      headers: writeHeaders,
      body: JSON.stringify({ name: "导出候选", description: "smoke test" }),
    });
    const basket = create.json.data_basket;
    if (!create.json.ok || !basket?.id) {
      fail("data basket create failed", create.json);
    }

    const listAfterCreate = await requestJson(`${baseUrl}/api/v1/user/data-baskets`);
    if (!listAfterCreate.json.data_baskets?.some((item) => item.id === basket.id && item.item_count === 0)) {
      fail("created data basket was not listed", listAfterCreate.json);
    }

    const addItem = await requestJson(`${baseUrl}/api/v1/user/data-baskets/${encodeURIComponent(basket.id)}/items`, {
      method: "POST",
      headers: writeHeaders,
      body: JSON.stringify({
        target_ref: "base:capability_focus:G-SP.SM-01",
        object_type: "capability_focus",
        object_title: "具有明确的网络安全战略计划与目标",
        payload: { route: "/capability-mapping", source: "smoke" },
      }),
    });
    const item = addItem.json.item;
    if (!addItem.json.ok || !item?.id || item.payload?.source !== "smoke") {
      fail("data basket item upsert failed", addItem.json);
    }

    const items = await requestJson(`${baseUrl}/api/v1/user/data-baskets/${encodeURIComponent(basket.id)}/items`);
    if (items.json.items?.length !== 1 || items.json.items[0].target_ref !== "base:capability_focus:G-SP.SM-01") {
      fail("data basket items list did not contain expected item", items.json);
    }

    const deleteItem = await requestJson(
      `${baseUrl}/api/v1/user/data-baskets/${encodeURIComponent(basket.id)}/items/${encodeURIComponent(item.id)}`,
      {
        method: "DELETE",
        headers: writeHeaders,
        body: "{}",
      },
    );
    if (!deleteItem.json.ok || deleteItem.json.deleted !== 1) {
      fail("data basket item delete failed", deleteItem.json);
    }

    const deleteBasket = await requestJson(`${baseUrl}/api/v1/user/data-baskets/${encodeURIComponent(basket.id)}`, {
      method: "DELETE",
      headers: writeHeaders,
      body: "{}",
    });
    if (!deleteBasket.json.ok || deleteBasket.json.deleted !== 1) {
      fail("data basket delete failed", deleteBasket.json);
    }

    const finalList = await requestJson(`${baseUrl}/api/v1/user/data-baskets`);
    if (finalList.json.data_baskets?.some((item) => item.id === basket.id)) {
      fail("deleted data basket still appears in list", finalList.json);
    }

    const rejectedWorkspace = await requestJson(`${baseUrl}/api/v1/user/workspaces`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: baseUrl },
      body: JSON.stringify({ name: "should fail" }),
    });
    if (rejectedWorkspace.response.status !== 403) {
      fail("workspace write without token should be rejected", { status: rejectedWorkspace.response.status, body: rejectedWorkspace.json });
    }

    const createWorkspace = await requestJson(`${baseUrl}/api/v1/user/workspaces`, {
      method: "POST",
      headers: writeHeaders,
      body: JSON.stringify({ name: "工作台总览", description: "smoke test" }),
    });
    const workspace = createWorkspace.json.workspace;
    if (!createWorkspace.json.ok || !workspace?.id) {
      fail("workspace create failed", createWorkspace.json);
    }

    const listWorkspaces = await requestJson(`${baseUrl}/api/v1/user/workspaces`);
    if (!listWorkspaces.json.workspaces?.some((item) => item.id === workspace.id && item.item_count === 0)) {
      fail("created workspace was not listed", listWorkspaces.json);
    }

    const addWorkspaceItem = await requestJson(`${baseUrl}/api/v1/user/workspaces/${encodeURIComponent(workspace.id)}/items`, {
      method: "POST",
      headers: writeHeaders,
      body: JSON.stringify({
        target_ref: "base:capability_focus:G-SP.SM-01",
        item_status: "pinned",
        sort_order: 1,
        payload: { route: "/capability-mapping", source: "smoke" },
      }),
    });
    const workspaceItem = addWorkspaceItem.json.item;
    if (!addWorkspaceItem.json.ok || !workspaceItem?.id || workspaceItem.item_status !== "pinned" || workspaceItem.payload?.source !== "smoke") {
      fail("workspace item upsert failed", addWorkspaceItem.json);
    }

    const workspaceItems = await requestJson(`${baseUrl}/api/v1/user/workspaces/${encodeURIComponent(workspace.id)}/items`);
    if (workspaceItems.json.items?.length !== 1 || workspaceItems.json.items[0].target_ref !== "base:capability_focus:G-SP.SM-01") {
      fail("workspace items list did not contain expected item", workspaceItems.json);
    }

    const deleteWorkspaceItem = await requestJson(
      `${baseUrl}/api/v1/user/workspaces/${encodeURIComponent(workspace.id)}/items/${encodeURIComponent(workspaceItem.id)}`,
      {
        method: "DELETE",
        headers: writeHeaders,
        body: "{}",
      },
    );
    if (!deleteWorkspaceItem.json.ok || deleteWorkspaceItem.json.deleted !== 1) {
      fail("workspace item delete failed", deleteWorkspaceItem.json);
    }

    const deleteWorkspace = await requestJson(`${baseUrl}/api/v1/user/workspaces/${encodeURIComponent(workspace.id)}`, {
      method: "DELETE",
      headers: writeHeaders,
      body: "{}",
    });
    if (!deleteWorkspace.json.ok || deleteWorkspace.json.deleted !== 1) {
      fail("workspace delete failed", deleteWorkspace.json);
    }

    const rejectedExportProfile = await requestJson(`${baseUrl}/api/v1/user/export-profiles`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: baseUrl },
      body: JSON.stringify({ name: "should fail", export_type: "data_basket" }),
    });
    if (rejectedExportProfile.response.status !== 403) {
      fail("export profile write without token should be rejected", {
        status: rejectedExportProfile.response.status,
        body: rejectedExportProfile.json,
      });
    }

    const createExportProfile = await requestJson(`${baseUrl}/api/v1/user/export-profiles`, {
      method: "POST",
      headers: writeHeaders,
      body: JSON.stringify({
        name: "数据篮 JSON 导出",
        export_type: "data_basket",
        config: {
          format: "json",
          include: ["target_ref", "object_type", "object_title"],
        },
      }),
    });
    const exportProfile = createExportProfile.json.export_profile;
    if (!createExportProfile.json.ok || !exportProfile?.id || exportProfile.config?.format !== "json") {
      fail("export profile create failed", createExportProfile.json);
    }

    const listExportProfiles = await requestJson(`${baseUrl}/api/v1/user/export-profiles`);
    if (!listExportProfiles.json.export_profiles?.some((item) => item.id === exportProfile.id && item.export_type === "data_basket")) {
      fail("created export profile was not listed", listExportProfiles.json);
    }

    const getExportProfile = await requestJson(`${baseUrl}/api/v1/user/export-profiles/${encodeURIComponent(exportProfile.id)}`);
    if (!getExportProfile.json.ok || getExportProfile.json.export_profile?.id !== exportProfile.id) {
      fail("export profile get failed", getExportProfile.json);
    }

    const rejectedForbiddenField = await requestJson(`${baseUrl}/api/v1/user/export-profiles`, {
      method: "POST",
      headers: writeHeaders,
      body: JSON.stringify({
        name: "禁止字段导出",
        export_type: "data_basket",
        config: { include: ["target_ref", "raw_value"] },
      }),
    });
    if (rejectedForbiddenField.response.status !== 400 || !String(rejectedForbiddenField.json.error || "").includes("raw_value")) {
      fail("export profile should reject forbidden fields", {
        status: rejectedForbiddenField.response.status,
        body: rejectedForbiddenField.json,
      });
    }

    const createExportBasket = await requestJson(`${baseUrl}/api/v1/user/data-baskets`, {
      method: "POST",
      headers: writeHeaders,
      body: JSON.stringify({ name: "导出执行数据篮", description: "smoke export" }),
    });
    const exportBasket = createExportBasket.json.data_basket;
    if (!createExportBasket.json.ok || !exportBasket?.id) {
      fail("export basket create failed", createExportBasket.json);
    }

    const addExportItem = await requestJson(`${baseUrl}/api/v1/user/data-baskets/${encodeURIComponent(exportBasket.id)}/items`, {
      method: "POST",
      headers: writeHeaders,
      body: JSON.stringify({
        target_ref: "base:capability_focus:G-SP.EX-01",
        object_type: "capability_focus",
        object_title: "导出执行烟测对象",
        payload: { route: "/capability-mapping", source: "export-smoke" },
      }),
    });
    if (!addExportItem.json.ok || addExportItem.json.item?.payload?.source !== "export-smoke") {
      fail("export basket item create failed", addExportItem.json);
    }

    const createExportPreview = await requestJson(`${baseUrl}/api/v1/user/exports/preview`, {
      method: "POST",
      headers: writeHeaders,
      body: JSON.stringify({
        profile_id: exportProfile.id,
        source_ref: `user:data_basket:${exportBasket.id}`,
      }),
    });
    const exportJob = createExportPreview.json.export_job;
    if (!createExportPreview.json.ok || !exportJob?.id || exportJob.status !== "draft" || exportJob.preview?.field_boundary?.status !== "passed") {
      fail("export preview create failed", createExportPreview.json);
    }

    const getExportJob = await requestJson(`${baseUrl}/api/v1/user/exports/${encodeURIComponent(exportJob.id)}`);
    if (!getExportJob.json.ok || getExportJob.json.export_job?.id !== exportJob.id || getExportJob.json.export_job?.output_path !== null) {
      fail("export job get failed", getExportJob.json);
    }

    const executeExport = await requestJson(`${baseUrl}/api/v1/user/exports`, {
      method: "POST",
      headers: writeHeaders,
      body: JSON.stringify({ job_id: exportJob.id }),
    });
    const completedExportJob = executeExport.json.export_job;
    if (!executeExport.json.ok || completedExportJob?.status !== "completed" || !completedExportJob.output_path) {
      fail("export execute failed", executeExport.json);
    }

    const downloadExport = await requestJson(`${baseUrl}/api/v1/user/exports/${encodeURIComponent(exportJob.id)}/download`);
    if (!downloadExport.response.ok || downloadExport.json.data?.items?.[0]?.payload?.source !== "export-smoke") {
      fail("export download failed", { status: downloadExport.response.status, body: downloadExport.json });
    }
    const forbiddenDownloadedKeys = forbiddenExportKeys(downloadExport.json);
    if (forbiddenDownloadedKeys.length) {
      fail("downloaded export contained forbidden fields", { forbiddenDownloadedKeys, body: downloadExport.json });
    }

    const deleteExportProfile = await requestJson(`${baseUrl}/api/v1/user/export-profiles/${encodeURIComponent(exportProfile.id)}`, {
      method: "DELETE",
      headers: writeHeaders,
      body: "{}",
    });
    if (!deleteExportProfile.json.ok || deleteExportProfile.json.deleted !== 1) {
      fail("export profile delete failed", deleteExportProfile.json);
    }

    console.log(
      JSON.stringify(
        {
          ok: true,
          bundleRoot: tmpRoot,
          port: state.port,
          checks: {
            authRejected: true,
            basketCreated: true,
            itemCreated: true,
            itemDeleted: true,
            basketDeleted: true,
            workspaceAuthRejected: true,
            workspaceCreated: true,
            workspaceItemCreated: true,
            workspaceItemDeleted: true,
            workspaceDeleted: true,
            exportProfileAuthRejected: true,
            exportProfileCreated: true,
            exportProfileListed: true,
            exportProfileForbiddenFieldsRejected: true,
            exportPreviewCreated: true,
            exportJobRead: true,
            exportExecuted: true,
            exportDownloaded: true,
            exportDownloadBoundaryChecked: true,
            exportProfileDeleted: true,
          },
        },
        null,
        2,
      ),
    );
  } finally {
    if (server && server.exitCode === null) {
      server.kill("SIGTERM");
      await new Promise((resolve) => server.once("close", resolve));
    }
    await rm(tmpRoot, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
