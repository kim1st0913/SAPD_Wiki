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
        JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString(), script: "audit_saved_user_annotations" }, null, 2),
      );
      return () => rmSync(lockDir, { recursive: true, force: true });
    } catch {
      await sleep(500);
    }
  }
  throw new Error("System Chrome smoke lock timeout. Do not run browser checks in parallel.");
}

async function main() {
  const baseUrl = argValue("--url", "http://127.0.0.1:5173/");
  const chromePath = argValue("--chrome", "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome");
  const port = Number(argValue("--debug-port", "9397"));
  const width = Number(argValue("--width", "1800"));
  const height = Number(argValue("--height", "1200"));
  const compact = hasFlag("--compact");
  const debugState = hasFlag("--debug-state");
  const onlyOrdinal = Number(argValue("--only-ordinal", "0"));
  const fromOrdinal = Number(argValue("--from-ordinal", "0"));
  const toOrdinal = Number(argValue("--to-ordinal", "0"));
  const allowSystemChrome = hasFlag("--allow-system-chrome") || process.env.SAPD_ALLOW_SYSTEM_CHROME_SMOKE === "1";
  const noteEnvelope = await fetchJson(new URL("/api/v1/user/notes", baseUrl));
  const notes = Array.isArray(noteEnvelope?.data?.notes) ? noteEnvelope.data.notes : [];
  const auditNotes = notes
    .map((note, index) => ({ note, ordinal: index + 1 }))
    .filter((item) => (onlyOrdinal > 0 ? item.ordinal === onlyOrdinal : true))
    .filter((item) => (fromOrdinal > 0 ? item.ordinal >= fromOrdinal : true))
    .filter((item) => (toOrdinal > 0 ? item.ordinal <= toOrdinal : true));

  if (!allowSystemChrome && chromePath.includes("/Applications/Google Chrome.app/")) {
    console.log(
      JSON.stringify(
        {
          result: "blocked",
          reason: "System Chrome launch requires --allow-system-chrome for saved annotation visual audit.",
          noteCount: notes.length,
        },
        null,
        2,
      ),
    );
    process.exitCode = 2;
    return;
  }

  const releaseChromeLock = chromePath.includes("/Applications/Google Chrome.app/") ? await acquireChromeLaunchLock() : () => {};
  const userDataDir = join(tmpdir(), `sapd-annotation-audit-${Date.now()}`);
  let chrome = null;
  let ws = null;
  let send = null;
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
    send = sendFactory(ws);
    ws.addEventListener("message", (event) => {
      const message = JSON.parse(event.data);
      if (message.method === "Runtime.exceptionThrown") {
        consoleIssues.push({ type: "exception", text: message.params?.exceptionDetails?.text || "exception" });
      }
      if (message.method === "Log.entryAdded" && ["error", "warning"].includes(message.params?.entry?.level)) {
        consoleIssues.push({ type: message.params.entry.level, text: message.params.entry.text || "" });
      }
    });
    const evaluate = async (expression, awaitPromise = false, retry = true) => {
      try {
        const result = await send("Runtime.evaluate", { expression, awaitPromise, returnByValue: true });
        if (result.exceptionDetails) throw new Error(result.exceptionDetails.text || result.exceptionDetails.exception?.description || "Runtime.evaluate failed");
        return result.result.value;
      } catch (error) {
        if (!retry || !/Execution context was destroyed|Cannot find context/i.test(error.message)) throw error;
        await sleep(900);
        return evaluate(expression, awaitPromise, false);
      }
    };

    await send("Page.enable");
    await send("Runtime.enable");
    await send("Log.enable");
    await send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: false });
    await evaluate(`new Promise((resolve) => {
      if (document.readyState === "complete") return resolve(true);
      window.addEventListener("load", () => resolve(true), { once: true });
      setTimeout(() => resolve(false), 8000);
    })`, true);
    await evaluate(`(async () => {
      for (let i = 0; i < 80; i += 1) {
        if (typeof activateRoute === "function" && typeof findAnnotationAnchorElement === "function") return true;
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      return false;
    })()`, true);
    await sleep(900);

    const results = [];
    for (const { note, ordinal } of auditNotes) {
      const audit = await evaluate(
        `(${annotationAuditInPage.toString()})(${JSON.stringify(note)}, ${ordinal}, ${JSON.stringify({ debugState })})`,
        true,
      );
      results.push(audit);
    }

    const isPassed = (item) =>
      !item.failureReasons?.length &&
      item.found &&
      item.visible &&
      item.normalMarkedBeforeLocate &&
      item.normalVisualHighlight &&
      item.normalStripeOk &&
      item.activeAfterJump &&
      item.activeVisualHighlight &&
      item.granularityOk &&
      item.persistentAfterClick &&
      item.unexpectedMarkedCount === 0 &&
      item.drawerPanelOk &&
      item.currentNoteCardOk &&
      item.drawerScrollPreserved &&
      item.locateButtonClicked;
    const technicalFamilyCoverage = results.reduce((acc, item) => {
      if (!item.pageFamily) return acc;
      if (!acc[item.pageFamily]) acc[item.pageFamily] = { notes: 0, passed: 0, failed: 0 };
      acc[item.pageFamily].notes += 1;
      if (isPassed(item)) acc[item.pageFamily].passed += 1;
      else acc[item.pageFamily].failed += 1;
      return acc;
    }, {});
    const summary = {
      result: results.every(isPassed) ? "pass" : "partial",
      noteCount: notes.length,
      auditedNoteCount: auditNotes.length,
      passed: results.filter(isPassed).length,
      failed: results.filter((item) => !isPassed(item)).length,
      technicalFamilyCoverage,
      consoleIssues: consoleIssues.filter((issue) => !/favicon|File not found/i.test(issue.text)).slice(0, 8),
      results,
    };
    if (compact) {
      console.log(
        JSON.stringify(
          {
            result: summary.result,
            noteCount: summary.noteCount,
            auditedNoteCount: summary.auditedNoteCount,
            passed: summary.passed,
            failed: summary.failed,
            technicalFamilyCoverage: summary.technicalFamilyCoverage,
            consoleIssues: summary.consoleIssues,
            failures: results
              .filter((item) => !isPassed(item))
              .map((item) => ({
                ordinal: item.ordinal,
                pageRoute: item.pageRoute,
                anchorType: item.anchorType,
                objectType: item.objectType,
                objectTitle: item.objectTitle,
                failureReasons: item.failureReasons,
                normalVisualHighlight: item.normalVisualHighlight,
                normalStripeOk: item.normalStripeOk,
                activeVisualHighlight: item.activeVisualHighlight,
                anchor: item.anchor,
                debug: item.debug,
                rect: item.afterClickState?.rect || item.activeState?.rect || item.markedState?.rect || null,
              })),
            results: results.map((item) => ({
              ordinal: item.ordinal,
              pageRoute: item.pageRoute,
              pageFamily: item.pageFamily,
              anchorType: item.anchorType,
              objectType: item.objectType,
              objectTitle: item.objectTitle,
              body: item.body,
              found: item.found,
              visible: item.visible,
              normalMarkedBeforeLocate: item.normalMarkedBeforeLocate,
              normalVisualHighlight: item.normalVisualHighlight,
              normalStripeOk: item.normalStripeOk,
              activeAfterJump: item.activeAfterJump,
              activeVisualHighlight: item.activeVisualHighlight,
              granularityOk: item.granularityOk,
              persistentAfterClick: item.persistentAfterClick,
              drawerPanelOk: item.drawerPanelOk,
              currentNoteCardOk: item.currentNoteCardOk,
              drawerScrollPreserved: item.drawerScrollPreserved,
              locateButtonClicked: item.locateButtonClicked,
              unexpectedMarkedCount: item.unexpectedMarkedCount,
              unexpectedMarked: item.unexpectedMarked,
              scope: item.scope,
              failureReasons: item.failureReasons,
              collapsedBeforeLocate: item.collapsedBeforeLocate,
              drawer: item.drawer,
              anchor: item.anchor,
              rect: item.afterClickState?.rect || item.activeState?.rect || item.markedState?.rect || null,
            })),
          },
          null,
          2,
        ),
      );
    } else {
      console.log(JSON.stringify(summary, null, 2));
    }
    process.exitCode = summary.result === "pass" ? 0 : 1;
  } finally {
    try {
      if (send) await send("Browser.close");
    } catch {
      // Browser may already be closed.
    }
    if (chrome) {
      const gracefullyExited = await waitForProcessExit(chrome, 2500);
      if (!gracefullyExited) chrome.kill("SIGTERM");
      const terminated = await waitForProcessExit(chrome, 1000);
      if (!terminated) chrome.kill("SIGKILL");
    }
    try {
      ws?.close?.();
    } catch {
      // Browser.close normally closes the socket first.
    }
    rmSync(userDataDir, { recursive: true, force: true });
    releaseChromeLock();
  }
}

async function annotationAuditInPage(note, ordinal, options = {}) {
  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const waitFrames = () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  const isVisible = (element) => {
    if (!element || !element.isConnected) return false;
    const rect = element.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return false;
    const style = getComputedStyle(element);
    return style.display !== "none" && style.visibility !== "hidden" && Number(style.opacity || 1) !== 0;
  };
  const anchorState = (element) => {
    const cell = element?.closest?.("td, th");
    const row = element?.closest?.("tr");
    const nodes = [element, cell, row].filter(Boolean);
    const has = (attr) => nodes.some((node) => node.getAttribute?.(attr) === "true");
    const styleNode = element || cell || row;
    const style = styleNode ? getComputedStyle(styleNode) : null;
    const rowStyleCell = row?.querySelector?.("td, th") || null;
    const rowCellStyle = rowStyleCell ? getComputedStyle(rowStyleCell) : null;
    const treeTextNode = element?.matches?.(".tree-row, [data-capability-id]")
      ? element.querySelector?.(".node-title, .node-code, strong")
      : element?.closest?.(".tree-row, [data-capability-id]")?.querySelector?.(".node-title, .node-code, strong");
    const treeTextStyle = treeTextNode ? getComputedStyle(treeTextNode) : null;
    const markedTextNode = element?.querySelector?.(".line-text, .relation-chip-text, strong, .node-title, .node-code");
    const markedTextStyle = markedTextNode ? getComputedStyle(markedTextNode) : null;
    const rect = styleNode?.getBoundingClientRect?.();
    return {
      tag: element?.tagName || "",
      className: String(element?.className || ""),
      isRowElement: element?.matches?.("tr") || false,
      isCellElement: element?.matches?.("td, th") || false,
      isTreeElement: element?.matches?.(".tree-row, [data-capability-id]") || false,
      isSlideElement: element?.matches?.(".guide-slide-stage, .guide-thumb") || false,
      isValueElement:
        element?.matches?.('[data-annotation-value="true"], [data-copy-text], .relation-chip, .standard-tooltip-chip, .standard-framework-name, .management-chip, .taxonomy-chip') || false,
      anchorMarked: element?.getAttribute?.("data-user-note-anchor-marked") === "true",
      cellMarked: cell?.getAttribute?.("data-user-note-anchor-cell-marked") === "true",
      rowMarked: row?.getAttribute?.("data-user-note-anchor-row-marked") === "true",
      anchorActive: element?.getAttribute?.("data-user-note-anchor-active") === "true",
      cellActive: cell?.getAttribute?.("data-user-note-anchor-cell-active") === "true",
      rowActive: row?.getAttribute?.("data-user-note-anchor-row-active") === "true",
      anyMarked: has("data-user-note-anchor-marked") || has("data-user-note-anchor-cell-marked") || has("data-user-note-anchor-row-marked"),
      anyActive: has("data-user-note-anchor-active") || has("data-user-note-anchor-cell-active") || has("data-user-note-anchor-row-active"),
      backgroundColor: style?.backgroundColor || "",
      backgroundImage: style?.backgroundImage || "",
      boxShadow: style?.boxShadow || "",
      textDecorationLine: style?.textDecorationLine || "",
      textDecorationColor: style?.textDecorationColor || "",
      textDecorationThickness: style?.textDecorationThickness || "",
      rowCellBackgroundColor: rowCellStyle?.backgroundColor || "",
      rowCellBackgroundImage: rowCellStyle?.backgroundImage || "",
      rowCellBoxShadow: rowCellStyle?.boxShadow || "",
      rowCellTextDecorationLine: rowCellStyle?.textDecorationLine || "",
      rowCellTextDecorationColor: rowCellStyle?.textDecorationColor || "",
      rowCellTextDecorationThickness: rowCellStyle?.textDecorationThickness || "",
      treeTextDecorationLine: treeTextStyle?.textDecorationLine || "",
      treeTextDecorationColor: treeTextStyle?.textDecorationColor || "",
      treeTextDecorationThickness: treeTextStyle?.textDecorationThickness || "",
      markedTextDecorationLine: markedTextStyle?.textDecorationLine || "",
      markedTextDecorationColor: markedTextStyle?.textDecorationColor || "",
      markedTextDecorationThickness: markedTextStyle?.textDecorationThickness || "",
      rect: rect ? { x: Math.round(rect.x), y: Math.round(rect.y), width: Math.round(rect.width), height: Math.round(rect.height) } : null,
    };
  };
  const hasAnnotationAmberInk = (value = "") =>
    /rgba?\((?:185,\s*128,\s*18|21[2-8],\s*16[0-9],\s*(?:18|3[6-9]|40|45))/.test(String(value || ""));
  const hasAnnotationUnderline = (state = {}) => {
    const decorationText = [
      state.textDecorationLine,
      state.textDecorationColor,
      state.textDecorationThickness,
      state.boxShadow,
      state.rowCellTextDecorationLine,
      state.rowCellTextDecorationColor,
      state.rowCellTextDecorationThickness,
      state.treeTextDecorationLine,
      state.treeTextDecorationColor,
      state.treeTextDecorationThickness,
      state.markedTextDecorationLine,
      state.markedTextDecorationColor,
      state.markedTextDecorationThickness,
    ].filter(Boolean).join(" ");
    return /underline/.test(decorationText) && hasAnnotationAmberInk(decorationText);
  };
  const hasYellowAnnotationInk = (state = {}) => {
    const styleText = [
      state.backgroundColor,
      state.backgroundImage,
      state.boxShadow,
      state.textDecorationColor,
      state.textDecorationLine,
      state.textDecorationThickness,
      state.rowCellBackgroundColor,
      state.rowCellBackgroundImage,
      state.rowCellBoxShadow,
      state.rowCellTextDecorationColor,
      state.rowCellTextDecorationLine,
      state.rowCellTextDecorationThickness,
      state.treeTextDecorationColor,
      state.treeTextDecorationLine,
      state.treeTextDecorationThickness,
      state.markedTextDecorationColor,
      state.markedTextDecorationLine,
      state.markedTextDecorationThickness,
    ].filter(Boolean).join(" ");
    return /rgba?\(255,\s*(?:214|220|221|225|230|232|234|245|252),\s*(?:52|58|59|64|70|83|88|92|119|177|210)/.test(styleText) ||
      hasAnnotationAmberInk(styleText) ||
      hasAnnotationUnderline(state);
  };
  const hasBroadBackgroundStripe = (state = {}) => {
    if (state.isTreeElement || state.isSlideElement) return false;
    const rect = state.rect || {};
    const backgroundImage = String(state.backgroundImage || "").trim();
    const backgroundColor = String(state.backgroundColor || "").trim();
    const hasBackgroundInk =
      (backgroundImage && !/^none$/i.test(backgroundImage) && hasYellowAnnotationInk(state)) ||
      /rgba?\(255,\s*(?:214|220|221|225|230|232|234|245|252),\s*(?:52|58|59|64|70|83|88|92|119|177|210)/.test(backgroundColor);
    return Boolean(rect.width > 220 && hasBackgroundInk);
  };
  const anchorSummary = (element) => {
    if (!element) return null;
    const text =
      element.dataset?.annotationTooltip ||
      element.dataset?.copyText ||
      element.getAttribute?.("title") ||
      element.textContent ||
      "";
    return {
      tag: element.tagName,
      className: String(element.className || "").slice(0, 140),
      text: String(text).replace(/\s+/g, " ").trim().slice(0, 180),
      targetRef: element.dataset?.annotationTargetRef || "",
      maintenanceId: element.dataset?.maintenanceId || "",
      capabilityId: element.dataset?.capabilityId || "",
    };
  };
  const normalizedAnchorType = (value = "", targetRef = "") => {
    if (value === "value") return "field";
    if (value) return value;
    if (String(targetRef || "").startsWith("base:field_value:")) return "field";
    if (String(targetRef || "").startsWith("base:table_row:")) return "row";
    return "";
  };
  const compactText = (value = "") =>
    String(value || "")
      .replace(/\u00a0/g, " ")
      .replace(/[｜|]/g, " ")
      .replace(/[：:]/g, " ")
      .replace(/[，,。；;、]/g, " ")
      .replace(/\s+/g, "")
      .trim()
      .toLowerCase();
  const pageFamilyOfNote = () => {
    const route = String(note.page_route || "");
    if (/\/knowledge\/technical-services(?:$|[?#/])/.test(route)) return "technical-services";
    if (/\/knowledge\/technical-measures(?:$|[?#/])/.test(route)) return "technical-measures";
    if (/\/knowledge\/technical(?:$|[?#/])/.test(route)) return "technical";
    return "";
  };
  const isFieldNote = () => normalizedAnchorType(note.anchor_type, note.target_ref) === "field" || note.object_type === "field_value";
  const isRowNote = () => normalizedAnchorType(note.anchor_type, note.target_ref) === "row" || note.object_type === "table_row";
  const drawerElements = () => {
    const drawer = document.querySelector(".user-annotation-drawer");
    const panel = drawer?.querySelector?.(".annotation-drawer-panel") || null;
    const card = Array.from(panel?.querySelectorAll?.(".annotation-note-card[data-user-note-id]") || []).find(
      (element) => String(element.dataset?.userNoteId || "") === String(note.id || ""),
    );
    return { drawer, panel, card };
  };
  const fullyInside = (inner, outer, tolerance = 2) =>
    Boolean(
      inner &&
        outer &&
        inner.top >= outer.top - tolerance &&
        inner.left >= outer.left - tolerance &&
        inner.right <= outer.right + tolerance &&
        inner.bottom <= outer.bottom + tolerance,
    );
  const rectSnapshot = (rect) =>
    rect
      ? {
          x: Math.round(rect.x),
          y: Math.round(rect.y),
          width: Math.round(rect.width),
          height: Math.round(rect.height),
          top: Math.round(rect.top),
          bottom: Math.round(rect.bottom),
          left: Math.round(rect.left),
          right: Math.round(rect.right),
        }
      : null;
  const drawerSnapshot = () => {
    const { drawer, panel, card } = drawerElements();
    const drawerOpen = drawer?.classList?.contains("is-open") || false;
    const panelRect = panel?.getBoundingClientRect?.();
    const cardRect = card?.getBoundingClientRect?.();
    const viewportRect = { top: 0, left: 0, right: window.innerWidth, bottom: window.innerHeight };
    const panelFitsViewport = Boolean(panelRect && fullyInside(panelRect, viewportRect, 2));
    const cardFullyVisibleInPanel = Boolean(cardRect && panelRect && fullyInside(cardRect, panelRect, 6));
    const cardFullyVisibleInViewport = Boolean(cardRect && fullyInside(cardRect, viewportRect, 2));
    return {
      drawerOpen,
      panelExists: Boolean(panel),
      cardExists: Boolean(card),
      panelFitsViewport,
      cardFullyVisibleInPanel,
      cardFullyVisibleInViewport,
      scrollTop: panel ? Math.round(panel.scrollTop) : null,
      scrollHeight: panel ? Math.round(panel.scrollHeight) : null,
      clientHeight: panel ? Math.round(panel.clientHeight) : null,
      cardOffsetTop: card ? Math.round(card.offsetTop) : null,
      panelRect: rectSnapshot(panelRect),
      cardRect: rectSnapshot(cardRect),
    };
  };
  const openDrawerAtCurrentNote = async () => {
    const appState = typeof state !== "undefined" ? state : window.state;
    if (!appState || typeof renderUserAnnotationDrawer !== "function") return drawerSnapshot();
    appState.userAnnotationDrawerOpen = true;
    if (appState.userAnnotationExpandedNoteIds?.add) appState.userAnnotationExpandedNoteIds.add(String(note.id || ""));
    renderUserAnnotationDrawer({ preserveScroll: true });
    await waitFrames();
    await wait(80);
    const { panel, card } = drawerElements();
    if (panel && card) {
      const desiredTop = Math.max(0, card.offsetTop - Math.round(panel.clientHeight * 0.45));
      panel.scrollTop = desiredTop;
      await waitFrames();
    }
    return drawerSnapshot();
  };
  const clickLocateButtonFromDrawer = async () => {
    const { card } = drawerElements();
    const button = card?.querySelector?.("[data-user-note-jump]");
    if (!button) return false;
    button.click();
    return true;
  };
  const markedElementsOnSurface = () =>
    Array.from(
      document.querySelectorAll(
        [
          "[data-user-note-anchor-marked='true']",
          "[data-user-note-anchor-cell-marked='true']",
          "[data-user-note-anchor-row-marked='true']",
        ].join(","),
      ),
    ).filter((element) => !element.closest?.("[data-annotation-drawer], [data-annotation-context-menu]") && isVisible(element));
  const sameAnnotationContext = (candidate, expected, type) => {
    if (!candidate || !expected) return false;
    if (candidate === expected) return true;
    if (type === "field") return false;
    if (type === "row") return candidate.closest?.("tr") && candidate.closest("tr") === expected.closest?.("tr");
    return expected.contains?.(candidate) || candidate.contains?.(expected);
  };
  const unexpectedMarked = () => {
    const pageRoute = note.page_route || "";
    const appState = typeof state !== "undefined" ? state : window.state;
    const pageNotes = Array.isArray(appState?.userNotes)
      ? appState.userNotes.filter((item) => String(item.page_route || "") === pageRoute && !String(item.target_ref || "").startsWith("page:"))
      : [note];
    const expected = pageNotes
      .map((item) => ({ note: item, anchor: typeof findAnnotationAnchorElement === "function" ? findAnnotationAnchorElement(item) : null }))
      .filter((item) => item.anchor);
    return markedElementsOnSurface()
      .filter((element) => {
        const markedText = compactText(element.dataset?.annotationTooltip || element.dataset?.copyText || element.getAttribute?.("title") || element.textContent);
        const matchedByResolvedAnchor = expected.some((item) =>
          sameAnnotationContext(element, item.anchor, normalizedAnchorType(item.note.anchor_type, item.note.target_ref)),
        );
        const matchedBySavedTitle =
          markedText &&
          pageNotes.some((item) => {
            const title = compactText(item.object_title);
            return title && (markedText === title || markedText.includes(title) || title.includes(markedText));
          });
        return !matchedByResolvedAnchor && !matchedBySavedTitle;
      })
      .map(anchorSummary);
  };
  const surfaceStats = () => ({
    route: location.hash || location.pathname,
    activeRoute: (typeof state !== "undefined" ? state : window.state)?.activeRoute || "",
    activeView: (typeof state !== "undefined" ? state : window.state)?.activeView || "",
    targets: document.querySelectorAll("[data-annotation-target-ref]").length,
    values: document.querySelectorAll('[data-annotation-value="true"], [data-copy-text], .relation-chip, .standard-tooltip-chip, .standard-framework-name, .management-chip, .taxonomy-chip').length,
    cells: document.querySelectorAll("td").length,
    capabilityRows: document.querySelectorAll("[data-capability-id]").length,
    maintenanceRows: document.querySelectorAll("[data-maintenance-id]").length,
  });
  const waitForAnnotationSurface = async () => {
    let last = surfaceStats();
    for (let i = 0; i < 80; i += 1) {
      last = surfaceStats();
      if (last.targets + last.values + last.cells + last.capabilityRows + last.maintenanceRows > 0) return last;
      await wait(100);
    }
    return last;
  };
  const waitForNaturalMarkedAnchor = async (initialAnchor) => {
    let anchor = initialAnchor || null;
    let state = anchorState(anchor);
    for (let i = 0; i < 42; i += 1) {
      if (anchor && state.anyMarked) return { anchor, state };
      await wait(120);
      await waitFrames();
      anchor =
        findAnnotationAnchorElement(note) ||
        (typeof resolveAnnotationAnchorElement === "function" ? resolveAnnotationAnchorElement(note) : null) ||
        anchor;
      state = anchorState(anchor);
    }
    return { anchor, state };
  };
  const waitForActiveAnchor = async (initialAnchor) => {
    let anchor = initialAnchor || null;
    let state = anchorState(anchor);
    for (let i = 0; i < 42; i += 1) {
      if (anchor && state.anyActive) return { anchor, state };
      await wait(120);
      await waitFrames();
      anchor =
        findAnnotationAnchorElement(note) ||
        (typeof resolveAnnotationAnchorElement === "function" ? resolveAnnotationAnchorElement(note) : null) ||
        anchor;
      state = anchorState(anchor);
    }
    return { anchor, state };
  };
  const debugSnapshot = () => {
    if (!options.debugState) return null;
    const appState = typeof state !== "undefined" ? state : window.state;
    const selected = typeof capabilityItemById === "function" ? capabilityItemById(appState?.selectedCapabilityId) : null;
    let runtimeViewModel = null;
    let runtimeViewModelError = "";
    try {
      const viewModels = window.sapdViewModels || {};
      const capabilityWorkbenchViewModel =
        viewModels.buildCapabilityWorkbenchViewModel?.({ workbench: appState?.capabilityWorkbench }) || appState?.capabilityWorkbenchViewModel;
      runtimeViewModel = viewModels.buildCapabilityWorkspaceViewModel?.({
        capabilityWorkbench: appState?.capabilityWorkbench,
        capabilityWorkbenchViewModel,
        capabilityTree: appState?.capability,
        capabilityProjection: typeof currentCapabilityObjectView === "function" ? currentCapabilityObjectView() : appState?.capabilityWorkspaceView,
        management: typeof mergeSharedLookups === "function" ? mergeSharedLookups(appState?.maintenanceKnowledge) : appState?.maintenanceKnowledge,
        standards: appState?.standards,
        selectedCapabilityId: appState?.selectedCapabilityId,
        search: appState?.search,
        relationshipFilters: appState?.relationshipFilters,
      });
    } catch (error) {
      runtimeViewModelError = String(error?.message || error);
    }
    const valueSamples = Array.from(document.querySelectorAll(".standard-framework-name, [data-annotation-value='true'], [data-copy-text]"))
      .map((element) => ({
        tag: element.tagName,
        className: String(element.className || "").slice(0, 80),
        text: String(element.dataset?.copyText || element.textContent || "").replace(/\s+/g, " ").trim().slice(0, 120),
      }))
      .filter((item) => item.text)
      .slice(0, 24);
    return {
      hash: location.hash || "",
      activeRoute: appState?.activeRoute || "",
      activeView: appState?.activeView || "",
      selectedCapabilityId: appState?.selectedCapabilityId || "",
      selectedCapabilityCode: selected?.code || "",
      selectedCapabilityType: selected?.type || "",
      selectedCapabilityTitle: selected?.title || "",
      activeCapabilityRelationTab: appState?.activeCapabilityRelationTab || "",
      loadedPackages: Array.from(appState?.loadedPackages || []).slice(0, 20),
      packageLoads: Array.from(appState?.packageLoads?.keys?.() || []).slice(0, 20),
      loadedStandardFrameworks: Object.keys(appState?.standards?.loadedFrameworks || appState?.standards?.loaded_frameworks || {}),
      isoRows: Array.from(
        Object.values(appState?.standards?.loadedFrameworks || appState?.standards?.loaded_frameworks || {})
          .filter((framework) => framework?.id === "iso-27001-2022" || framework?.frameworkCode === "ISO-IEC-27001-2022")
          .flatMap((framework) =>
            (Array.isArray(framework?.tabs) && framework.tabs.length ? framework.tabs : [framework]).flatMap((table) => Array.isArray(table?.rows) ? table.rows : []),
          ),
      ).length,
      focusProjectionLoaded:
        typeof capabilityProjectionHasFocus === "function" && appState?.selectedCapabilityId
          ? capabilityProjectionHasFocus(appState.selectedCapabilityId)
          : null,
      runtimeStandardRows: Array.isArray(runtimeViewModel?.standardMappingRows) ? runtimeViewModel.standardMappingRows.length : null,
      runtimeStandardControls: Array.isArray(runtimeViewModel?.standardMappingRows)
        ? runtimeViewModel.standardMappingRows.reduce((sum, row) => sum + (Array.isArray(row.controls) ? row.controls.length : 0), 0)
        : null,
      runtimeLocalFrameworks: Array.isArray(runtimeViewModel?.localRelationMap?.standards?.frameworks)
        ? runtimeViewModel.localRelationMap.standards.frameworks.map((row) => row.title || row.name || row.code || row.id).slice(0, 8)
        : null,
      runtimeLocalControls: Array.isArray(runtimeViewModel?.localRelationMap?.standards?.controls)
        ? runtimeViewModel.localRelationMap.standards.controls.map((row) => `${row.code || row.originalControlId || ""} ${row.title || row.name || ""}`.trim()).slice(0, 8)
        : null,
      runtimeViewModelError,
      standardFrameworkNameCount: document.querySelectorAll(".standard-framework-name").length,
      standardPanelText: String(document.querySelector(".standard-mapping-section")?.textContent || "").replace(/\s+/g, " ").trim().slice(0, 520),
      valueSamples,
    };
  };
  try {
    if (typeof activateRoute !== "function") throw new Error("activateRoute missing");
    if (typeof findAnnotationAnchorElement !== "function") throw new Error("findAnnotationAnchorElement missing");
    if (note.page_route) {
      activateRoute(note.page_route);
      await wait(560);
    }
    if (typeof ensureUserNotesLoaded === "function") await ensureUserNotesLoaded();
    if (typeof restoreAnnotationContextFromNote === "function") {
      const changed = restoreAnnotationContextFromNote(note);
      if (changed && typeof renderActiveView === "function") renderActiveView();
    }
    if (typeof annotationContextLoadPromiseForNote === "function") {
      await annotationContextLoadPromiseForNote(note);
      if (typeof renderActiveView === "function") renderActiveView();
      await waitFrames();
    }
    const statsBeforeLocate = await waitForAnnotationSurface();
    await waitFrames();

    const visibleBeforeExpand = findAnnotationAnchorElement(note);
    const hiddenBeforeExpand = visibleBeforeExpand ? null : findAnnotationAnchorElement(note, { includeHidden: true });
    const collapsedBeforeLocate = Boolean(!visibleBeforeExpand && hiddenBeforeExpand);
    let anchor = typeof resolveAnnotationAnchorElement === "function" ? resolveAnnotationAnchorElement(note) : visibleBeforeExpand || hiddenBeforeExpand;
    const naturalMarked = await waitForNaturalMarkedAnchor(anchor);
    anchor = naturalMarked.anchor || anchor;
    const markedState = naturalMarked.state;
    const drawerBeforeLocate = await openDrawerAtCurrentNote();
    const locateButtonClicked = await clickLocateButtonFromDrawer();
    let activeWait = { anchor, state: anchorState(anchor) };
    if (locateButtonClicked) {
      await wait(260);
      activeWait = await waitForActiveAnchor(anchor);
    } else if (typeof jumpToUserNote === "function") {
      jumpToUserNote(note.id);
      await wait(260);
      activeWait = await waitForActiveAnchor(anchor);
    }
    const drawerAfterLocate = drawerSnapshot();
    const anchorAfterJump = activeWait.anchor || findAnnotationAnchorElement(note) || anchor;
    const activeState = activeWait.state || anchorState(anchorAfterJump);
    document.querySelector("#appPageHeader, .workspace-stage, body")?.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window }));
    await wait(460);
    await waitFrames();
    const anchorAfterClick = findAnnotationAnchorElement(note) || anchorAfterJump;
    const afterClickState = anchorState(anchorAfterClick);
    const fieldScope = isFieldNote();
    const rowScope = isRowNote();
    const pageScope = String(note.target_ref || "").startsWith("page:") || normalizedAnchorType(note.anchor_type, note.target_ref) === "page";
    const visualScope = !pageScope;
    const activeRect = activeState.rect || {};
    const afterClickRect = afterClickState.rect || {};
    const fieldScopedToRow =
      fieldScope &&
      (activeState.isRowElement ||
        afterClickState.isRowElement ||
        activeState.rowActive ||
        (afterClickRect.width > 900 && afterClickRect.height > 88) ||
        (activeRect.width > 900 && activeRect.height > 88));
    const fieldHasValueMarker = !fieldScope || afterClickState.anchorMarked || afterClickState.isValueElement || afterClickState.isCellElement;
    const granularityOk = rowScope || (!fieldScopedToRow && fieldHasValueMarker);
    const normalMarkedBeforeLocate = markedState.anyMarked;
    const normalVisualHighlight = !visualScope || hasYellowAnnotationInk(markedState);
    const activeVisualHighlight = !visualScope || hasYellowAnnotationInk(activeState);
    const normalStripeOk = !hasBroadBackgroundStripe(markedState);
    const persistentAfterClick = afterClickState.anyMarked;
    const unexpected = unexpectedMarked();
    const pageFamily = pageFamilyOfNote();
    const drawerPanelOk =
      drawerBeforeLocate.panelExists &&
      drawerBeforeLocate.panelFitsViewport &&
      (!drawerAfterLocate.drawerOpen || drawerAfterLocate.panelFitsViewport);
    const currentNoteCardOk =
      drawerBeforeLocate.cardExists &&
      drawerBeforeLocate.cardFullyVisibleInPanel &&
      drawerBeforeLocate.cardFullyVisibleInViewport &&
      (!drawerAfterLocate.drawerOpen || (drawerAfterLocate.cardFullyVisibleInPanel && drawerAfterLocate.cardFullyVisibleInViewport));
    const scrollDelta =
      typeof drawerBeforeLocate.scrollTop === "number" && typeof drawerAfterLocate.scrollTop === "number"
        ? Math.abs(drawerAfterLocate.scrollTop - drawerBeforeLocate.scrollTop)
        : null;
    const shouldPreserveDrawerScroll = Boolean(drawerAfterLocate.drawerOpen && (drawerBeforeLocate.scrollTop || 0) > 24);
    const drawerScrollPreserved = !shouldPreserveDrawerScroll || (scrollDelta !== null && scrollDelta <= 48);
    const failureReasons = [
      !anchorAfterJump ? "not_found" : "",
      anchorAfterJump && !isVisible(anchorAfterJump) ? "not_visible" : "",
      !normalMarkedBeforeLocate ? "normal_highlight_missing" : "",
      !normalVisualHighlight ? "normal_visual_highlight_missing" : "",
      !normalStripeOk ? "normal_visual_stripe_too_wide" : "",
      !activeState.anyActive ? "not_active_after_jump" : "",
      !activeVisualHighlight ? "active_visual_highlight_missing" : "",
      !granularityOk ? "wrong_granularity" : "",
      !persistentAfterClick ? "lost_after_click" : "",
      unexpected.length ? "unexpected_marked" : "",
      !locateButtonClicked ? "locate_button_missing" : "",
      !drawerPanelOk ? "drawer_panel_clipped_or_missing" : "",
      !currentNoteCardOk ? "current_note_card_clipped_or_missing" : "",
      !drawerScrollPreserved ? "drawer_scroll_lost_after_locate" : "",
      pageFamily && !normalMarkedBeforeLocate ? `${pageFamily}_normal_highlight_missing` : "",
      pageFamily && !activeState.anyActive ? `${pageFamily}_locate_highlight_missing` : "",
      pageFamily && !persistentAfterClick ? `${pageFamily}_lost_after_click` : "",
    ].filter(Boolean);
    return {
      ordinal,
      id: note.id,
      pageRoute: note.page_route || "",
      pageFamily,
      anchorType: note.anchor_type || "",
      objectType: note.object_type || "",
      objectTitle: note.object_title || "",
      body: String(note.body || "").replace(/\s+/g, " ").trim().slice(0, 120),
      targetRef: note.target_ref || "",
      found: Boolean(anchorAfterJump),
      visible: isVisible(anchorAfterJump),
      collapsedBeforeLocate,
      normalMarkedBeforeLocate,
      normalVisualHighlight,
      normalStripeOk,
      activeAfterJump: activeState.anyActive,
      activeVisualHighlight,
      granularityOk,
      persistentAfterClick,
      drawerPanelOk,
      currentNoteCardOk,
      drawerScrollPreserved,
      locateButtonClicked,
      unexpectedMarkedCount: unexpected.length,
      unexpectedMarked: unexpected.slice(0, 4),
      failureReasons,
      debug: debugSnapshot(),
      scope: fieldScope ? "field" : rowScope ? "row" : normalizedAnchorType(note.anchor_type, note.target_ref) || "object",
      drawer: {
        beforeLocate: drawerBeforeLocate,
        afterLocate: drawerAfterLocate,
        scrollDelta,
        shouldPreserveDrawerScroll,
      },
      markedState,
      activeState,
      afterClickState,
      statsBeforeLocate,
      anchor: anchorSummary(anchorAfterClick || anchorAfterJump),
    };
  } catch (error) {
    return {
      ordinal,
      id: note.id,
      pageRoute: note.page_route || "",
      pageFamily: pageFamilyOfNote(),
      anchorType: note.anchor_type || "",
      objectType: note.object_type || "",
      objectTitle: note.object_title || "",
      body: String(note.body || "").replace(/\s+/g, " ").trim().slice(0, 120),
      targetRef: note.target_ref || "",
      found: false,
      visible: false,
      normalMarkedBeforeLocate: false,
      normalVisualHighlight: false,
      normalStripeOk: false,
      activeAfterJump: false,
      activeVisualHighlight: false,
      granularityOk: false,
      persistentAfterClick: false,
      drawerPanelOk: false,
      currentNoteCardOk: false,
      drawerScrollPreserved: false,
      locateButtonClicked: false,
      unexpectedMarkedCount: 0,
      failureReasons: ["audit_error"],
      debug: debugSnapshot(),
      error: error.message,
    };
  }
}

main().catch((error) => {
  console.error(JSON.stringify({ result: "fail", error: error.message }, null, 2));
  process.exit(1);
});
