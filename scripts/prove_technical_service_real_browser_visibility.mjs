#!/usr/bin/env node

import { spawn } from "node:child_process";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const OUTPUT_DIR = "data/exports/worker-verify/technical-service-real-browser-proof";
const DEFAULT_URL = "http://127.0.0.1:5173/knowledge/technical-services";
const TARGETS = [
  { id: "I-DI&T-AS.AD-01", name: "数据分库分表" },
  { id: "I-NT&T-AS.AD-01", name: "网络平面及区域划分" },
  { id: "I-AP&T-AS.AD-01", name: "应用架构管控" },
  { id: "I-OS&T-AS.AD-01", name: "主机/终端安全工作区划分" },
  { id: "I-PE&T-AS.AD-01", name: "物理区域分区" },
  { id: "I-HD&T-AS.AD-01", name: "计算与存储分离" },
];

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function hasFlag(name) {
  return process.argv.includes(name);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url} returned ${response.status}`);
  return response.json();
}

async function waitForTarget(port, timeoutMs = 8000) {
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
    if (!pending.has(message.id)) return;
    const waiter = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) waiter.reject(new Error(`${message.error.message}: ${message.error.data || ""}`));
    else waiter.resolve(message.result);
  });
  return (method, params = {}) =>
    new Promise((resolve, reject) => {
      const id = nextId++;
      pending.set(id, { resolve, reject });
      ws.send(JSON.stringify({ id, method, params }));
    });
}

function safeFileId(value) {
  return String(value)
    .replace(/&/g, "_and_")
    .replace(/[^\w.-]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function waitForProcessExit(child, timeoutMs = 2500) {
  if (child.exitCode !== null || child.signalCode !== null) return Promise.resolve(true);
  return new Promise((resolve) => {
    const onExit = () => {
      clearTimeout(timer);
      resolve(true);
    };
    const timer = setTimeout(() => {
      child.off("exit", onExit);
      resolve(false);
    }, timeoutMs);
    child.once("exit", onExit);
  });
}

async function captureScreenshot(send, path) {
  const image = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
  writeFileSync(path, Buffer.from(image.data, "base64"));
}

function markdownTable(rows) {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]);
  const escapeCell = (value) => String(value ?? "").replace(/\|/g, "\\|").replace(/\n/g, " ");
  return [
    `| ${headers.map(escapeCell).join(" | ")} |`,
    `| ${headers.map(() => "---").join(" | ")} |`,
    ...rows.map((row) => `| ${headers.map((key) => escapeCell(row[key])).join(" | ")} |`),
  ].join("\n");
}

async function main() {
  const url = argValue("--url", DEFAULT_URL);
  const chromePath = argValue("--chrome", "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome");
  const port = Number(argValue("--debug-port", "9457"));
  const width = Number(argValue("--width", "1800"));
  const height = Number(argValue("--height", "1200"));
  const outDir = argValue("--out", OUTPUT_DIR);
  const allowSystemChrome = hasFlag("--allow-system-chrome");

  if (!existsSync(chromePath)) throw new Error(`Chrome not found: ${chromePath}`);
  if (chromePath.includes("/Applications/Google Chrome.app/") && !allowSystemChrome) {
    throw new Error("System Chrome proof requires --allow-system-chrome.");
  }

  mkdirSync(outDir, { recursive: true });
  const profileDir = join(tmpdir(), `sapd-tech-service-proof-${Date.now()}`);
  mkdirSync(profileDir, { recursive: true });

  const consoleIssues = [];
  let chrome = null;
  let ws = null;
  let send = null;
  const startedAt = new Date().toISOString();

  try {
    chrome = spawn(
      chromePath,
      [
        "--headless=new",
        "--disable-gpu",
        "--disable-background-networking",
        "--disable-breakpad",
        "--disable-component-update",
        "--disable-crash-reporter",
        "--disable-default-apps",
        "--disable-extensions",
        "--no-first-run",
        "--no-default-browser-check",
        "--metrics-recording-only",
        `--user-data-dir=${profileDir}`,
        `--remote-debugging-port=${port}`,
        `--window-size=${width},${height}`,
        url,
      ],
      { stdio: "ignore" },
    );

    const target = await waitForTarget(port);
    ws = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => {
      ws.addEventListener("open", resolve, { once: true });
      ws.addEventListener("error", reject, { once: true });
    });
    ws.addEventListener("message", (event) => {
      const message = JSON.parse(event.data);
      if (message.method === "Runtime.exceptionThrown") {
        consoleIssues.push({ type: "exception", text: message.params?.exceptionDetails?.text || "exception" });
      }
      if (message.method === "Log.entryAdded" && ["error", "warning"].includes(message.params?.entry?.level)) {
        consoleIssues.push({ type: message.params.entry.level, text: message.params.entry.text || "" });
      }
    });
    send = sendFactory(ws);
    const evaluate = async (expression, awaitPromise = false) => {
      let result = await send("Runtime.evaluate", { expression, awaitPromise, returnByValue: true });
      if (result.exceptionDetails) throw new Error(result.exceptionDetails.text || "Runtime.evaluate failed");
      return result.result.value;
    };

    await send("Page.enable");
    await send("Runtime.enable");
    await send("Log.enable");
    await send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: false });
    await send("Page.navigate", { url });
    await evaluate(`new Promise((resolve) => {
      if (document.readyState === "complete") return resolve(true);
      window.addEventListener("load", () => resolve(true), { once: true });
      setTimeout(() => resolve(false), 8000);
    })`, true);
    await evaluate(`(async () => {
      for (let i = 0; i < 80; i += 1) {
        if (document.querySelector(".technical-service-maintenance-table[data-technical-service-table='true']")) return true;
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      return false;
    })()`, true);
    await sleep(600);

    const pageMeta = await evaluate(`(() => {
      const scripts = [...document.scripts].map((script) => script.src).filter(Boolean);
      const versionOf = (name) => {
        const src = scripts.find((item) => item.includes(name));
        return src ? (new URL(src)).search || "(no query version)" : "";
      };
      const activeNav = [...document.querySelectorAll('[aria-current="page"], .active, [data-active="true"]')]
        .map((node) => node.textContent.replace(/\\s+/g, " ").trim())
        .filter(Boolean)
        .slice(0, 12);
      const localStorageKeys = Object.keys(localStorage)
        .filter((key) => /technical-service/i.test(key))
        .map((key) => ({ key, value: localStorage.getItem(key) }));
      return {
        currentUrl: location.href,
        title: document.title,
        activeView: document.body.dataset.activeView || "",
        currentTabCandidates: activeNav,
        indexHtmlNavigationUrl: performance.getEntriesByType("navigation")[0]?.name || "",
        appJsVersion: versionOf("app.js"),
        viewModelsJsVersion: versionOf("viewModels.js"),
        technicalServiceTableJsVersion: versionOf("TechnicalServiceMaintenanceTable.js"),
        tablePresent: Boolean(document.querySelector(".technical-service-maintenance-table[data-technical-service-table='true']")),
        componentPresent: Boolean(window.sapdComponents?.TechnicalServiceMaintenanceTable?.render),
        localStorageKeys
      };
    })()`);

    const scriptVersion = {
      name: "prove_technical_service_real_browser_visibility.mjs",
      version: "technical-service-real-browser-proof-20260615-1",
    };

    async function setSearch(query) {
      return evaluate(`(async () => {
        const waitFrame = () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        const input = document.querySelector("#searchInput") || [...document.querySelectorAll('input[type="search"], input')]
          .find((item) => /搜索/.test(item.getAttribute("placeholder") || "") && item.offsetParent !== null);
        if (!input) return { ok: false, reason: "search input not found" };
        input.focus();
        input.value = ${JSON.stringify(query)};
        input.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: ${JSON.stringify(query)} }));
        input.dispatchEvent(new Event("change", { bubbles: true }));
        await waitFrame();
        await new Promise((resolve) => setTimeout(resolve, 180));
        return {
          ok: true,
          placeholder: input.getAttribute("placeholder") || "",
          value: input.value
        };
      })()`, true);
    }

    const probeExpression = (target, mode) => `(() => {
      const id = ${JSON.stringify(target.id)};
      const name = ${JSON.stringify(target.name)};
      const table = document.querySelector(".technical-service-maintenance-table[data-technical-service-table='true']");
      const scrollBox = table?.closest(".maintenance-table-scroll") || null;
      const rows = [...document.querySelectorAll(".technical-service-maintenance-table [data-maintenance-id]")];
      const row = rows.find((item) => (item.dataset.maintenanceId || "") === id || item.textContent.includes(id));
      const visibleRows = rows.filter((item) => !item.hidden && getComputedStyle(item).display !== "none");
      const text = row?.textContent?.replace(/\\s+/g, " ").trim() || "";
      const rect = row?.getBoundingClientRect?.();
      const style = row ? getComputedStyle(row) : null;
      const centerX = rect ? Math.max(0, Math.min(window.innerWidth - 1, rect.left + Math.min(rect.width / 2, 420))) : 0;
      const centerY = rect ? Math.max(0, Math.min(window.innerHeight - 1, rect.top + rect.height / 2)) : 0;
      const topElement = row && rect ? document.elementFromPoint(centerX, centerY) : null;
      const topRow = topElement?.closest?.("[data-maintenance-id]");
      const coveredByOverlay = Boolean(row && topElement && topRow !== row && !row.contains(topElement));
      let groupLabel = "";
      if (row) {
        let cursor = row.previousElementSibling;
        while (cursor) {
          if (cursor.matches?.(".service-scope-table-group")) {
            groupLabel = cursor.textContent.replace(/\\s+/g, " ").trim();
            break;
          }
          cursor = cursor.previousElementSibling;
        }
      }
      const rowDisplayed = Boolean(row && !row.hidden && style?.display !== "none" && style?.visibility !== "hidden" && rect.width > 0 && rect.height > 0);
      const rowInViewport = Boolean(rowDisplayed && rect.top >= 0 && rect.left < window.innerWidth && rect.bottom <= window.innerHeight && rect.right > 0);
      return {
        mode: ${JSON.stringify(mode)},
        id,
        name,
        queryValue: document.querySelector("#searchInput")?.value || "",
        rowExists: Boolean(row),
        rowDisplayed,
        rowInViewport,
        rowCoveredByOverlay: coveredByOverlay,
        userCanSee: Boolean(rowDisplayed && rowInViewport && !coveredByOverlay && text.includes(id) && text.includes(name)),
        rowContainsId: text.includes(id),
        rowContainsName: text.includes(name),
        visibleServiceRowCount: visibleRows.length,
        totalServiceRowCount: rows.length,
        rowIndexAllRows: row ? rows.indexOf(row) + 1 : 0,
        rowIndexVisibleRows: row ? visibleRows.indexOf(row) + 1 : 0,
        groupLabel,
        scrollBox: scrollBox
          ? {
              className: scrollBox.className,
              scrollTop: Math.round(scrollBox.scrollTop),
              scrollLeft: Math.round(scrollBox.scrollLeft),
              clientHeight: Math.round(scrollBox.clientHeight),
              scrollHeight: Math.round(scrollBox.scrollHeight),
              overflow: getComputedStyle(scrollBox).overflow,
              overflowY: getComputedStyle(scrollBox).overflowY
            }
          : null,
        rowRect: rect
          ? {
              top: Math.round(rect.top),
              bottom: Math.round(rect.bottom),
              left: Math.round(rect.left),
              right: Math.round(rect.right),
              width: Math.round(rect.width),
              height: Math.round(rect.height)
            }
          : null,
        topElement: topElement
          ? {
              tagName: topElement.tagName,
              className: String(topElement.className || ""),
              text: topElement.textContent.replace(/\\s+/g, " ").trim().slice(0, 120)
            }
          : null,
        rowTextSample: text.slice(0, 260),
        ifNotVisibleReason: row
          ? (!rowDisplayed
              ? "row exists but is not displayed"
              : (!rowInViewport ? "row exists but is outside viewport" : (coveredByOverlay ? "row center is covered by another element" : "")))
          : "row does not exist in DOM"
      };
    })()`;

    async function scrollToDefaultRow(target) {
      return evaluate(`(async () => {
        const waitFrame = () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        const id = ${JSON.stringify(target.id)};
        const row = [...document.querySelectorAll(".technical-service-maintenance-table [data-maintenance-id]")]
          .find((item) => (item.dataset.maintenanceId || "") === id || item.textContent.includes(id));
        if (!row) return false;
        row.hidden = false;
        row.scrollIntoView({ block: "center", inline: "nearest" });
        await waitFrame();
        return true;
      })()`, true);
    }

    const results = [];
    for (const target of TARGETS) {
      const safeId = safeFileId(target.id);

      await setSearch("");
      await setSearch(target.id);
      const searchByIdBefore = await evaluate(probeExpression(target, "search-by-id"));
      if (!searchByIdBefore.rowInViewport) {
        await scrollToDefaultRow(target);
        await sleep(150);
      }
      const searchById = await evaluate(probeExpression(target, "search-by-id"));
      const searchByIdScreenshot = join(outDir, `search-by-id-${safeId}.png`);
      await captureScreenshot(send, searchByIdScreenshot);

      await setSearch("");
      await setSearch(target.name);
      const searchByNameBefore = await evaluate(probeExpression(target, "search-by-name"));
      if (!searchByNameBefore.rowInViewport) {
        await scrollToDefaultRow(target);
        await sleep(150);
      }
      const searchByName = await evaluate(probeExpression(target, "search-by-name"));
      const searchByNameScreenshot = join(outDir, `search-by-name-${safeId}.png`);
      await captureScreenshot(send, searchByNameScreenshot);

      await setSearch("");
      await sleep(240);
      await scrollToDefaultRow(target);
      await sleep(240);
      const defaultRow = await evaluate(probeExpression(target, "default-scroll-to-row"));
      const defaultScreenshot = join(outDir, `default-scroll-to-row-${safeId}.png`);
      await captureScreenshot(send, defaultScreenshot);

      results.push({
        id: target.id,
        name: target.name,
        searchByIdVisibleInScreenshot: Boolean(searchById.userCanSee),
        searchByNameVisibleInScreenshot: Boolean(searchByName.userCanSee),
        defaultRowExists: Boolean(defaultRow.rowExists),
        defaultRowDisplayed: Boolean(defaultRow.rowDisplayed),
        defaultRowInViewportAfterScroll: Boolean(defaultRow.rowInViewport),
        defaultRowCoveredByOverlay: Boolean(defaultRow.rowCoveredByOverlay),
        defaultVisibleInScreenshot: Boolean(defaultRow.userCanSee),
        searchByIdScreenshot,
        searchByNameScreenshot,
        defaultScrollScreenshot: defaultScreenshot,
        searchById,
        searchByName,
        defaultRow,
        ifNotVisibleReason: [searchById, searchByName, defaultRow]
          .map((item) => item.ifNotVisibleReason)
          .filter(Boolean)
          .join("; "),
      });
    }

    const summary = {
      status: results.every(
        (item) =>
          item.searchByIdVisibleInScreenshot &&
          item.searchByNameVisibleInScreenshot &&
          item.defaultRowExists &&
          item.defaultRowDisplayed &&
          item.defaultRowInViewportAfterScroll &&
          !item.defaultRowCoveredByOverlay &&
          item.defaultVisibleInScreenshot,
      )
        ? "pass"
        : "fail",
      startedAt,
      finishedAt: new Date().toISOString(),
      url,
      chromeStarted: true,
      chromePath,
      chromePid: chrome.pid,
      debugPort: port,
      viewport: { width, height },
      outputDir: outDir,
      scriptVersion,
      pageMeta,
      consoleIssues,
      resultCount: results.length,
      results,
    };

    writeFileSync(join(outDir, "technical-service-real-browser-proof.json"), JSON.stringify(summary, null, 2));
    const rows = results.map((item) => ({
      服务编号: item.id,
      服务名称: item.name,
      ID搜索截图可见: item.searchByIdVisibleInScreenshot ? "是" : "否",
      名称搜索截图可见: item.searchByNameVisibleInScreenshot ? "是" : "否",
      默认滚动截图可见: item.defaultVisibleInScreenshot ? "是" : "否",
      默认行序号: item.defaultRow.rowIndexAllRows,
      所在分组: item.defaultRow.groupLabel,
      scrollTop: item.defaultRow.scrollBox?.scrollTop ?? "",
      遮挡: item.defaultRowCoveredByOverlay ? "是" : "否",
      问题原因: item.ifNotVisibleReason || "",
    }));
    const md = [
      "# Technical Service Real Browser Visibility Proof 1.3",
      "",
      `- 状态：${summary.status}`,
      `- URL：${summary.pageMeta.currentUrl}`,
      `- 页面标题：${summary.pageMeta.title}`,
      `- 当前视图：${summary.pageMeta.activeView}`,
      `- app.js：${summary.pageMeta.appJsVersion}`,
      `- viewModels.js：${summary.pageMeta.viewModelsJsVersion}`,
      `- TechnicalServiceMaintenanceTable.js：${summary.pageMeta.technicalServiceTableJsVersion}`,
      `- 脚本版本：${scriptVersion.version}`,
      `- localStorage technical-service keys：${summary.pageMeta.localStorageKeys.length}`,
      "",
      markdownTable(rows),
      "",
      "## 截图清单",
      "",
      ...results.flatMap((item) => [
        `- ${item.id} ID 搜索：${item.searchByIdScreenshot}`,
        `- ${item.id} 名称搜索：${item.searchByNameScreenshot}`,
        `- ${item.id} 默认滚动定位：${item.defaultScrollScreenshot}`,
      ]),
      "",
      "## localStorage",
      "",
      "```json",
      JSON.stringify(summary.pageMeta.localStorageKeys, null, 2),
      "```",
    ].join("\n");
    writeFileSync(join(outDir, "technical-service-real-browser-proof.md"), md);

    console.log(JSON.stringify({
      status: summary.status,
      chromeStarted: true,
      outputDir: outDir,
      results: results.map((item) => ({
        id: item.id,
        searchByIdVisibleInScreenshot: item.searchByIdVisibleInScreenshot,
        searchByNameVisibleInScreenshot: item.searchByNameVisibleInScreenshot,
        defaultVisibleInScreenshot: item.defaultVisibleInScreenshot,
        rowIndexAllRows: item.defaultRow.rowIndexAllRows,
        groupLabel: item.defaultRow.groupLabel,
      })),
    }, null, 2));
    process.exitCode = summary.status === "pass" ? 0 : 1;
  } finally {
    if (ws) ws.close();
    if (chrome) {
      chrome.kill("SIGTERM");
      const exited = await waitForProcessExit(chrome, 2500);
      if (!exited) chrome.kill("SIGKILL");
    }
    rmSync(profileDir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(JSON.stringify({ status: "fail", error: error.message }, null, 2));
  process.exitCode = 1;
});
