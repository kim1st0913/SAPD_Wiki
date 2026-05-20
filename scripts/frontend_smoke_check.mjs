#!/usr/bin/env node
// Lightweight Chrome headless smoke check. It prints a short JSON summary only.

import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const PAGE_TO_VIEW = {
  overview: "overview",
  capability: "capabilities",
  capabilities: "capabilities",
  environment: "environment",
  lifecycle: "dev-lifecycle",
  "dev-lifecycle": "dev-lifecycle",
  standards: "maintenance",
  maintenance: "maintenance",
};

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url} returned ${response.status}`);
  return response.json();
}

async function waitForTarget(port, timeoutMs = 5000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const targets = await fetchJson(`http://127.0.0.1:${port}/json`);
      const page = targets.find((target) => target.type === "page") || targets[0];
      if (page?.webSocketDebuggerUrl) return page;
    } catch {
      await sleep(200);
    }
  }
  throw new Error("Chrome DevTools target not available");
}

function sendFactory(ws) {
  let nextId = 1;
  const pending = new Map();
  ws.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    if (pending.has(message.id)) {
      const waiter = pending.get(message.id);
      pending.delete(message.id);
      if (message.error) waiter.reject(new Error(`${message.error.message}: ${message.error.data || ""}`));
      else waiter.resolve(message.result);
    }
  });
  return (method, params = {}) =>
    new Promise((resolve, reject) => {
      const id = nextId++;
      pending.set(id, { resolve, reject });
      ws.send(JSON.stringify({ id, method, params }));
    });
}

async function main() {
  const pageName = argValue("--page", "overview");
  const view = PAGE_TO_VIEW[pageName] || pageName;
  const baseUrl = argValue("--url", "http://127.0.0.1:5173/");
  const width = Number(argValue("--width", "1440"));
  const height = Number(argValue("--height", "1000"));
  const port = Number(argValue("--debug-port", "9333"));
  const chromePath = argValue("--chrome", "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome");
  const userDataDir = join(tmpdir(), `sapd-smoke-${Date.now()}`);
  mkdirSync(userDataDir, { recursive: true });

  const chrome = spawn(chromePath, [
    "--headless=new",
    "--disable-gpu",
    "--no-first-run",
    `--user-data-dir=${userDataDir}`,
    `--remote-debugging-port=${port}`,
    baseUrl,
  ], { stdio: "ignore" });

  const issues = [];
  try {
    const target = await waitForTarget(port);
    const ws = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => {
      ws.addEventListener("open", resolve, { once: true });
      ws.addEventListener("error", reject, { once: true });
    });
    ws.addEventListener("message", (event) => {
      const message = JSON.parse(event.data);
      if (message.method === "Runtime.exceptionThrown") {
        issues.push({ type: "exception", text: message.params?.exceptionDetails?.text || "exception" });
      }
      if (message.method === "Log.entryAdded" && ["error", "warning"].includes(message.params?.entry?.level)) {
        issues.push({ type: message.params.entry.level, text: message.params.entry.text || "" });
      }
    });
    const send = sendFactory(ws);
    const evaluate = async (expression, awaitPromise = false) => {
      const result = await send("Runtime.evaluate", { expression, awaitPromise, returnByValue: true });
      if (result.exceptionDetails) throw new Error(result.exceptionDetails.text || "Runtime.evaluate failed");
      return result.result.value;
    };

    await send("Page.enable");
    await send("Runtime.enable");
    await send("Log.enable");
    await send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: false });
    await sleep(1200);
    await evaluate(`if (typeof setActiveView === "function") setActiveView(${JSON.stringify(view)});`);
    if (pageName === "standards") {
      await evaluate(`document.querySelector('[data-source-page="standards"]')?.click?.();`);
    }
    await sleep(1200);

    const metrics = await evaluate(`(() => {
      const workspace = document.querySelector('.workspace-stage');
      return {
        activeView: document.body.dataset.activeView || '',
        title: document.title,
        bodyOverflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        workspaceOverflowX: workspace ? workspace.scrollWidth - workspace.clientWidth : null,
        capabilityMap: Boolean(document.querySelector('.capability-local-relation-map, .relation-network-graph')),
        standardTable: Boolean(document.querySelector('.standard-framework-table, .standard-framework-page')),
        environmentTree: Boolean(document.querySelector('.environment-tree')),
        lifecycleLane: Boolean(document.querySelector('.lifecycle-lane')),
        mappingDrawerOpen: document.querySelector('.mapping-detail-drawer')?.open ?? null,
        evidenceDrawerOpen: document.querySelector('.capability-evidence-drawer')?.open ?? null
      };
    })()`);
    const screenshot = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
    const screenshotPath = join(tmpdir(), `sapd-${pageName}-smoke.png`);
    writeFileSync(screenshotPath, Buffer.from(screenshot.data, "base64"));
    ws.close();
    const blockingIssues = issues.filter((issue) => issue.type === "exception" || (issue.type === "error" && !/favicon|File not found/i.test(issue.text)));
    const summary = {
      page: pageName,
      url: baseUrl,
      metrics,
      consoleIssues: blockingIssues.length,
      screenshot: screenshotPath,
      result: blockingIssues.length || metrics.bodyOverflowX > 2 ? "fail" : "pass",
    };
    console.log(JSON.stringify(summary, null, 2));
    process.exitCode = summary.result === "pass" ? 0 : 1;
  } finally {
    chrome.kill("SIGTERM");
  }
}

main().catch((error) => {
  console.error(JSON.stringify({ result: "fail", error: error.message }, null, 2));
  process.exit(1);
});
