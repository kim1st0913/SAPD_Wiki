#!/usr/bin/env node

import { spawn } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

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
  const response = await fetch(url, { cache: "no-store" });
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
      await sleep(180);
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

async function waitForProcessExit(child, timeoutMs = 2500) {
  if (child.exitCode !== null || child.signalCode !== null) return true;
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

async function acquireChromeLaunchLock(timeoutMs = 120000) {
  const lockDir = join(tmpdir(), "sapd-system-chrome-smoke.lock");
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      mkdirSync(lockDir);
      writeFileSync(
        join(lockDir, "owner.json"),
        JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString(), script: "audit_annotation_drawer_tab" }, null, 2),
      );
      return () => rmSync(lockDir, { recursive: true, force: true });
    } catch {
      await sleep(500);
    }
  }
  throw new Error("System Chrome smoke lock timeout. Do not run browser checks in parallel.");
}

async function runtimeValue(send, expression) {
  const result = await send("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text || "Runtime evaluation failed");
  return result.result?.value;
}

function visibleWidthOf(rect, viewportWidth) {
  if (!rect) return 0;
  return Math.max(0, Math.min(viewportWidth, rect.right) - Math.max(0, rect.left));
}

function drawerVisibleWidth(state) {
  return visibleWidthOf(state?.drawerRect, state?.viewportWidth || 0);
}

function tabVisibleWidth(state) {
  return visibleWidthOf(state?.tabRect, state?.viewportWidth || 0);
}

function panelVisibleWidth(state) {
  return visibleWidthOf(state?.panelRect, state?.viewportWidth || 0);
}

async function snapshot(send) {
  return runtimeValue(
    send,
    `(() => {
      const drawer = document.querySelector(".user-annotation-drawer");
      const tab = document.querySelector(".annotation-drawer-tab");
      const panel = document.querySelector(".annotation-drawer-panel");
      const rectOf = (node) => {
        if (!node) return null;
        const rect = node.getBoundingClientRect();
        return { left: Math.round(rect.left), right: Math.round(rect.right), top: Math.round(rect.top), bottom: Math.round(rect.bottom), width: Math.round(rect.width), height: Math.round(rect.height) };
      };
      const drawerStyle = drawer ? getComputedStyle(drawer) : null;
      const labelStyle = tab?.querySelector(".annotation-tab-label") ? getComputedStyle(tab.querySelector(".annotation-tab-label")) : null;
      return {
        exists: Boolean(drawer && tab && panel),
        isOpen: drawer?.classList.contains("is-open") || false,
        isClosing: drawer?.classList.contains("is-closing") || false,
        hasNotes: drawer?.classList.contains("has-notes") || false,
        tabText: String(tab?.textContent || "").replace(/\\s+/g, " ").trim(),
        tabAriaLabel: tab?.getAttribute("aria-label") || "",
        tabTitle: tab?.getAttribute("title") || "",
        countText: String(tab?.querySelector(".annotation-tab-count")?.textContent || "").trim(),
        labelText: String(tab?.querySelector(".annotation-tab-label")?.textContent || "").trim(),
        labelOpacity: labelStyle?.opacity || "",
        drawerTransform: drawerStyle?.transform || "",
        drawerTransition: drawerStyle?.transition || "",
        drawerRect: rectOf(drawer),
        tabRect: rectOf(tab),
        panelRect: rectOf(panel),
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight
      };
    })()`,
  );
}

async function waitForDrawer(send) {
  return runtimeValue(
    send,
    `new Promise((resolve) => {
      const started = Date.now();
      const tick = () => {
        if (document.querySelector(".user-annotation-drawer .annotation-drawer-tab")) {
          resolve(true);
          return;
        }
        if (Date.now() - started > 5000) {
          resolve(false);
          return;
        }
        setTimeout(tick, 80);
      };
      tick();
    })`,
  );
}

async function mouseMove(send, point) {
  await send("Input.dispatchMouseEvent", { type: "mouseMoved", x: point.x, y: point.y });
}

async function mouseClick(send, point) {
  await send("Input.dispatchMouseEvent", { type: "mousePressed", x: point.x, y: point.y, button: "left", clickCount: 1 });
  await send("Input.dispatchMouseEvent", { type: "mouseReleased", x: point.x, y: point.y, button: "left", clickCount: 1 });
}

function tabVisiblePoint(state) {
  const rect = state.tabRect;
  return {
    x: Math.max(4, Math.min(state.viewportWidth - 8, rect.left + Math.min(14, Math.max(8, rect.width / 3)))),
    y: Math.max(4, Math.min(state.viewportHeight - 8, rect.top + rect.height / 2)),
  };
}

async function main() {
  const baseUrl = argValue("--url", "http://127.0.0.1:5173/");
  const route = argValue("--route", "/capability-mapping");
  const chromePath = argValue("--chrome", "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome");
  const port = Number(argValue("--debug-port", "9451"));
  const width = Number(argValue("--width", "1800"));
  const height = Number(argValue("--height", "1200"));
  const allowSystemChrome = hasFlag("--allow-system-chrome") || process.env.SAPD_ALLOW_SYSTEM_CHROME_SMOKE === "1";

  if (!allowSystemChrome && chromePath.includes("/Applications/Google Chrome.app/")) {
    console.log(JSON.stringify({ result: "blocked", reason: "System Chrome launch requires --allow-system-chrome for drawer tab audit." }, null, 2));
    process.exitCode = 2;
    return;
  }

  const releaseChromeLock = chromePath.includes("/Applications/Google Chrome.app/") ? await acquireChromeLaunchLock() : () => {};
  const userDataDir = join(tmpdir(), `sapd-drawer-tab-audit-${Date.now()}`);
  let chrome = null;
  let ws = null;
  const consoleIssues = [];
  try {
    mkdirSync(userDataDir, { recursive: true });
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
        `--user-data-dir=${userDataDir}`,
        `--remote-debugging-port=${port}`,
        baseUrl,
      ],
      { stdio: "ignore" },
    );

    const target = await waitForTarget(port);
    ws = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => {
      ws.addEventListener("open", resolve, { once: true });
      ws.addEventListener("error", reject, { once: true });
    });
    const send = sendFactory(ws);
    ws.addEventListener("message", (event) => {
      const message = JSON.parse(event.data);
      if (message.method === "Runtime.exceptionThrown") consoleIssues.push({ type: "exception", text: message.params?.exceptionDetails?.text || "exception" });
      if (message.method === "Log.entryAdded" && ["error", "warning"].includes(message.params?.entry?.level)) {
        const entryText = message.params.entry.text || "";
        if (!/File not found|favicon/i.test(entryText)) consoleIssues.push({ type: message.params.entry.level, text: entryText });
      }
    });

    await send("Runtime.enable");
    await send("Log.enable");
    await send("Page.enable");
    await send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: false });
    await send("Page.navigate", { url: new URL(route, baseUrl).toString() });
    await sleep(1200);
    const drawerReady = await waitForDrawer(send);
    const initial = await snapshot(send);
    const hoverPoint = tabVisiblePoint(initial);
    await mouseMove(send, hoverPoint);
    await sleep(520);
    const hover = await snapshot(send);
    await mouseClick(send, hoverPoint);
    await sleep(520);
    const open = await snapshot(send);
    const openPoint = tabVisiblePoint(open);
    await mouseClick(send, openPoint);
    await sleep(180);
    const closing = await snapshot(send);
    await mouseMove(send, { x: Math.max(20, width / 2), y: Math.max(20, height / 2) });
    await sleep(520);
    const closed = await snapshot(send);

    const initialDrawerVisible = drawerVisibleWidth(initial);
    const initialTabVisible = tabVisibleWidth(initial);
    const hoverDrawerVisible = drawerVisibleWidth(hover);
    const hoverTabVisible = tabVisibleWidth(hover);
    const hoverPanelVisible = panelVisibleWidth(hover);
    const openDrawerVisible = drawerVisibleWidth(open);
    const openTabVisible = tabVisibleWidth(open);
    const openTabPanelGap = Math.round((open.panelRect?.left || 0) - (open.tabRect?.right || 0));
    const closedDrawerVisible = drawerVisibleWidth(closed);
    const closedTabVisible = tabVisibleWidth(closed);
    const closedPanelVisible = panelVisibleWidth(closed);
    const failures = [
      !drawerReady ? "drawer_not_ready" : "",
      !initial.exists ? "drawer_dom_missing" : "",
      initial.isOpen ? "drawer_initially_open" : "",
      initialDrawerVisible > 40 ? "collapsed_drawer_too_wide" : "",
      initialTabVisible > 40 ? "collapsed_tab_too_wide" : "",
      !initial.countText ? "tab_count_missing" : "",
      initial.labelText !== "批注" ? "tab_label_missing" : "",
      /^批注\\s*\\d+$/.test(initial.tabText) ? "tab_uses_ambiguous_joined_label" : "",
      !/当前页\s*\d+\s*条批注/.test(initial.tabAriaLabel) ? "tab_aria_count_missing" : "",
      hoverTabVisible < 72 ? "hover_tab_did_not_expand" : "",
      hoverTabVisible > 92 ? "hover_tab_too_separate_or_full" : "",
      hoverPanelVisible > 2 ? "hover_leaked_drawer_panel" : "",
      Number(hover.labelOpacity || 0) < 0.85 ? "hover_label_not_visible" : "",
      !open.isOpen ? "click_did_not_open_drawer" : "",
      openDrawerVisible < 320 ? "open_drawer_not_fully_visible" : "",
      openTabVisible > 44 ? "open_tab_too_wide" : "",
      Math.abs(openTabPanelGap) > 18 ? "open_tab_not_fused_to_panel" : "",
      open.panelRect?.right > open.viewportWidth + 2 ? "open_panel_overflows_viewport" : "",
      !closing.isClosing && closing.isOpen ? "click_close_not_transitioning" : "",
      closed.isOpen ? "click_close_did_not_close_drawer" : "",
      closedDrawerVisible > 40 ? "closed_drawer_too_wide_after_mouse_leave" : "",
      closedTabVisible > 40 ? "closed_tab_too_wide_after_mouse_leave" : "",
      closedPanelVisible > 2 ? "closed_panel_leaked_after_mouse_leave" : "",
      consoleIssues.length ? "console_issues" : "",
    ].filter(Boolean);

    console.log(
      JSON.stringify(
        {
          result: failures.length ? "fail" : "pass",
          route,
          checks: {
            initialDrawerVisible,
            initialTabVisible,
            hoverDrawerVisible,
            hoverTabVisible,
            hoverPanelVisible,
            closedDrawerVisible,
            closedTabVisible,
            closedPanelVisible,
            tabText: initial.tabText,
            tabAriaLabel: initial.tabAriaLabel,
            countText: initial.countText,
            labelText: initial.labelText,
            hoverLabelOpacity: hover.labelOpacity,
            openDrawerVisible,
            openTabVisible,
            openTabPanelGap,
            closingState: { isOpen: closing.isOpen, isClosing: closing.isClosing, drawerVisibleWidth: drawerVisibleWidth(closing), tabVisibleWidth: tabVisibleWidth(closing) },
          },
          consoleIssues,
          failures,
        },
        null,
        2,
      ),
    );
    process.exitCode = failures.length ? 1 : 0;
  } catch (error) {
    console.log(JSON.stringify({ result: "fail", error: error.message || String(error), consoleIssues }, null, 2));
    process.exitCode = 1;
  } finally {
    try {
      if (ws) ws.close();
    } catch {}
    if (chrome) {
      chrome.kill("SIGTERM");
      const exited = await waitForProcessExit(chrome);
      if (!exited) chrome.kill("SIGKILL");
    }
    rmSync(userDataDir, { recursive: true, force: true });
    releaseChromeLock();
  }
}

main();
