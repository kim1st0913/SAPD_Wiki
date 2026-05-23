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

const GUIDE_ROUTE_EXPECTATIONS = {
  "/guides/security-architecture-design": { thumbs: 75 },
  "/guides/data-security-design": { thumbs: 43 },
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

function expectedViewFor(pageName, route) {
  if (route.startsWith("/standards/")) return "maintenance";
  if (route.startsWith("/guides/")) return "content";
  if (pageName === "standards" || pageName === "maintenance") return "maintenance";
  if (pageName === "capability" || pageName === "capabilities") return "capabilities";
  if (pageName === "environment") return "environment";
  if (pageName === "lifecycle" || pageName === "dev-lifecycle") return "dev-lifecycle";
  if (pageName === "content") return "content";
  return PAGE_TO_VIEW[pageName] || pageName;
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
  const route = argValue("--route", "");
  const baseUrl = argValue("--url", "http://127.0.0.1:5173/");
  const width = Number(argValue("--width", "1440"));
  const height = Number(argValue("--height", "1000"));
  const port = Number(argValue("--debug-port", "9333"));
  const chromePath = argValue("--chrome", "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome");
  const guideExpectation = GUIDE_ROUTE_EXPECTATIONS[route] || null;
  const expectedGuidePage21 = guideExpectation ? `第 21 / ${guideExpectation.thumbs} 页` : "";
  const expectedGuidePage22 = guideExpectation ? `第 22 / ${guideExpectation.thumbs} 页` : "";
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
      let result;
      try {
        result = await send("Runtime.evaluate", { expression, awaitPromise, returnByValue: true });
      } catch (error) {
        if (!/Execution context was destroyed/i.test(error.message)) throw error;
        await sleep(400);
        result = await send("Runtime.evaluate", { expression, awaitPromise, returnByValue: true });
      }
      if (result.exceptionDetails) throw new Error(result.exceptionDetails.text || "Runtime.evaluate failed");
      return result.result.value;
    };

    await send("Page.enable");
    await send("Runtime.enable");
    await send("Log.enable");
    await send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: false });
    await evaluate(`new Promise((resolve) => {
      if (document.readyState === "complete") {
        resolve(true);
        return;
      }
      const done = () => resolve(true);
      window.addEventListener("load", done, { once: true });
      setTimeout(done, 6000);
    })`, true);
    await evaluate(`(async () => {
      for (let i = 0; i < 30; i += 1) {
        if (typeof activateRoute === "function" && typeof setActiveView === "function") return true;
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      return false;
    })()`, true);
    await evaluate(`(async () => {
      for (let i = 0; i < 60; i += 1) {
        if (document.body.dataset.activeView) return true;
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      return false;
    })()`, true);
    if (route) {
      await evaluate(`(async () => {
        if (typeof activateRoute === "function") await activateRoute(${JSON.stringify(route)});
      })()`, true);
    } else {
      await evaluate(`(async () => {
        if (typeof setActiveView === "function") await setActiveView(${JSON.stringify(view)});
      })()`, true);
    }
    if (pageName === "standards") {
      await evaluate(`document.querySelector('[data-source-page="standards"]')?.click?.();`);
    }
    const expectedView = expectedViewFor(pageName, route);
    await evaluate(`(async () => {
      for (let i = 0; i < 30; i += 1) {
        if ((document.body.dataset.activeView || "") === ${JSON.stringify(expectedView)}) return true;
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      return false;
    })()`, true);
    if (guideExpectation) {
      await evaluate(`(async () => {
        const waitFrame = () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        for (let i = 0; i < 30; i += 1) {
          if (document.querySelectorAll('.guide-thumb').length === ${guideExpectation.thumbs}) break;
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
        const rail = document.querySelector('#contentNavList');
        if (rail) rail.scrollTop = Math.floor((rail.scrollHeight - rail.clientHeight) * 0.45);
        const beforeClickScrollTop = rail?.scrollTop || 0;
        document.querySelector('[data-content-slide-index="20"]')?.click();
        await waitFrame();
        const afterClickScrollTop = rail?.scrollTop || 0;
        const afterClickPage = document.querySelector('.guide-slide-page')?.textContent || '';
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
        await waitFrame();
        const styleValue = (selector, property) => {
          const element = document.querySelector(selector);
          return element ? getComputedStyle(element)[property] : '';
        };
        window.__sapdGuideInteractionProbe = {
          beforeClickScrollTop,
          afterClickScrollTop,
          clickScrollPreserved: beforeClickScrollTop > 0 && Math.abs(afterClickScrollTop - beforeClickScrollTop) <= 2,
          afterClickPage,
          afterKeyPage: document.querySelector('.guide-slide-page')?.textContent || '',
          overlayOpacityBeforeHover: styleValue('.guide-slide-controls', 'opacity'),
          activeThumbText: document.querySelector('.guide-thumb.active span')?.textContent || '',
          navTitle: document.querySelector('#contentNavTitle')?.textContent || '',
          navTitleTextAlign: styleValue('#contentNavTitle', 'textAlign'),
          navHeadJustify: styleValue('.content-nav-pane > .pane-head', 'justifyContent')
        };
      })()`, true);
      const stagePoint = await evaluate(`(() => {
        const rect = document.querySelector('.guide-slide-stage')?.getBoundingClientRect();
        if (!rect) return null;
        return { x: rect.left + rect.width / 2, y: rect.bottom - 28 };
      })()`);
      if (stagePoint) {
        await send("Input.dispatchMouseEvent", { type: "mouseMoved", x: stagePoint.x, y: stagePoint.y });
        await sleep(260);
        const hoverState = await evaluate(`(() => {
          const controls = document.querySelector('.guide-slide-controls');
          return {
            opacity: controls ? getComputedStyle(controls).opacity : '',
            pointerEvents: controls ? getComputedStyle(controls).pointerEvents : '',
            pageText: document.querySelector('.guide-slide-page')?.textContent || ''
          };
        })()`);
        const stageCenter = await evaluate(`(() => {
          const rect = document.querySelector('.guide-slide-stage')?.getBoundingClientRect();
          if (!rect) return null;
          return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
        })()`);
        if (stageCenter) await send("Input.dispatchMouseEvent", { type: "mouseMoved", x: stageCenter.x, y: stageCenter.y });
        await sleep(180);
        const leaveToSlideState = await evaluate(`(() => {
          const controls = document.querySelector('.guide-slide-controls');
          return {
            opacity: controls ? getComputedStyle(controls).opacity : '',
            pointerEvents: controls ? getComputedStyle(controls).pointerEvents : ''
          };
        })()`);
        await send("Input.dispatchMouseEvent", { type: "mouseMoved", x: 12, y: 12 });
        await sleep(180);
        await evaluate(`(() => {
          const controls = document.querySelector('.guide-slide-controls');
          window.__sapdGuideInteractionProbe = {
            ...(window.__sapdGuideInteractionProbe || {}),
            overlayOpacityAfterHover: ${JSON.stringify(hoverState.opacity)},
            overlayPointerEventsAfterHover: ${JSON.stringify(hoverState.pointerEvents)},
            overlayPageText: ${JSON.stringify(hoverState.pageText)},
            overlayOpacityAfterMoveToSlide: ${JSON.stringify(leaveToSlideState.opacity)},
            overlayPointerEventsAfterMoveToSlide: ${JSON.stringify(leaveToSlideState.pointerEvents)},
            overlayOpacityAfterLeave: controls ? getComputedStyle(controls).opacity : '',
            overlayPointerEventsAfterLeave: controls ? getComputedStyle(controls).pointerEvents : ''
          };
        })()`);
      }
    }
    await sleep(800);

    const metrics = await evaluate(`(() => {
      const workspace = document.querySelector('.workspace-stage');
      const tooltipTrigger = document.querySelector('.standard-tooltip-chip[data-tooltip]');
      let tooltipProbe = {
        trigger: Boolean(tooltipTrigger),
        visible: 0,
        total: document.querySelectorAll('.floating-standard-tooltip').length
      };
      if (tooltipTrigger) {
        tooltipTrigger.dispatchEvent(new PointerEvent('pointerover', { bubbles: true }));
        tooltipTrigger.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
        tooltipProbe = {
          trigger: true,
          visible: [...document.querySelectorAll('.floating-standard-tooltip')].filter((item) => !item.hidden && getComputedStyle(item).display !== 'none').length,
          total: document.querySelectorAll('.floating-standard-tooltip').length
        };
        tooltipTrigger.dispatchEvent(new PointerEvent('pointerout', { bubbles: true, relatedTarget: document.body }));
        tooltipTrigger.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
      }
      return {
        activeView: document.body.dataset.activeView || '',
        title: document.title,
        bodyOverflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        workspaceOverflowX: workspace ? workspace.scrollWidth - workspace.clientWidth : null,
        capabilityMap: Boolean(document.querySelector('.capability-local-relation-map, .relation-network-graph')),
        standardTable: Boolean(document.querySelector('.standard-framework-table, .standard-framework-page')),
        standardGroupRows: document.querySelectorAll('.standard-framework-table .standard-group-row').length,
        standardDataRows: document.querySelectorAll('.standard-framework-table .standard-group-detail, .standard-framework-table .maintenance-data-row').length,
        standardHeaderCells: document.querySelectorAll('.standard-framework-table thead th').length,
        standardColumnHeaders: [...document.querySelectorAll('.standard-framework-table thead th')].map((item) => item.dataset.column || item.textContent.trim()),
        standardHeaderCenterAligned: [...document.querySelectorAll('.standard-framework-table thead th')].every((item) => {
          const style = getComputedStyle(item);
          return style.textAlign === 'center' && style.verticalAlign === 'middle';
        }),
        standardHeaderEmphasis: (() => {
          const headers = [...document.querySelectorAll('.standard-framework-table thead th')];
          return {
            count: headers.length,
            minFontSize: headers.length ? Math.min(...headers.map((item) => Number.parseFloat(getComputedStyle(item).fontSize))) : 0,
            minFontWeight: headers.length ? Math.min(...headers.map((item) => Number.parseInt(getComputedStyle(item).fontWeight, 10) || 0)) : 0
          };
        })(),
        standardDescriptionAligned: (() => {
          const cells = [...document.querySelectorAll('.standard-framework-table td.standard-column-control-description')].filter((item) => item.offsetParent !== null);
          return {
            count: cells.length,
            leftAligned: cells.every((item) => getComputedStyle(item).textAlign === 'left'),
            middleAligned: cells.every((item) => getComputedStyle(item).verticalAlign === 'middle')
          };
        })(),
        standardRelatedColumnMaxWidth: (() => {
          const cells = [...document.querySelectorAll('.standard-framework-table .standard-column-related-focus')].filter((item) => item.offsetParent !== null);
          if (!cells.length) return 0;
          return Math.round(Math.max(...cells.map((item) => item.getBoundingClientRect().width)));
        })(),
        standardSecurityFunctionValues: [...document.querySelectorAll('.standard-framework-table td[data-column="安全功能"]')]
          .filter((item) => item.offsetParent !== null)
          .map((item) => item.textContent.replace(/\\s+/g, ' ').trim())
          .slice(0, 20),
        maintenanceTable: Boolean(document.querySelector('#maintenanceWorkspace .maintenance-data-table, #maintenanceWorkspace .matrix-table, #maintenanceWorkspace .maintenance-table')),
        maintenanceHeaderEmphasis: (() => {
          const headers = [...document.querySelectorAll('#maintenanceWorkspace .maintenance-data-table thead th, #maintenanceWorkspace .matrix-table thead th, #maintenanceWorkspace .maintenance-table thead th')]
            .filter((item) => item.offsetParent !== null);
          return {
            count: headers.length,
            minFontSize: headers.length ? Math.min(...headers.map((item) => Number.parseFloat(getComputedStyle(item).fontSize))) : 0,
            minFontWeight: headers.length ? Math.min(...headers.map((item) => Number.parseInt(getComputedStyle(item).fontWeight, 10) || 0)) : 0,
            centered: headers.every((item) => {
              const style = getComputedStyle(item);
              return style.textAlign === 'center' && style.verticalAlign === 'middle';
            })
          };
        })(),
        environmentTree: Boolean(document.querySelector('.environment-tree')),
        lifecycleLane: Boolean(document.querySelector('.lifecycle-lane')),
        guideSlidePlayer: Boolean(document.querySelector('.guide-slide-player')),
        guideToolbarPresent: Boolean(document.querySelector('.guide-slide-toolbar')),
        pageHeaderActionButtons: document.querySelectorAll('#appPageHeader .page-header-actions button').length,
        guideThumbs: document.querySelectorAll('.guide-thumb').length,
        guideCurrentPage: document.querySelector('.guide-slide-page')?.textContent || '',
        guideImageLoaded: (document.querySelector('.guide-slide-stage img')?.naturalWidth || 0) > 0,
        guideStageBottomGap: (() => {
          const rect = document.querySelector('.guide-slide-stage')?.getBoundingClientRect();
          return rect ? Math.round(window.innerHeight - rect.bottom) : null;
        })(),
        guideImageBottomGap: (() => {
          const rect = document.querySelector('.guide-slide-stage img')?.getBoundingClientRect();
          return rect ? Math.round(window.innerHeight - rect.bottom) : null;
        })(),
        guideStageHasVerticalScroll: (() => {
          const stage = document.querySelector('.guide-slide-stage');
          return stage ? stage.scrollHeight > stage.clientHeight + 1 : null;
        })(),
        guideImageAspectRatio: (() => {
          const rect = document.querySelector('.guide-slide-stage img')?.getBoundingClientRect();
          return rect ? Number((rect.width / rect.height).toFixed(4)) : null;
        })(),
        guideInteractionProbe: window.__sapdGuideInteractionProbe || null,
        emptyStateText: document.querySelector('.content-list .detail-empty')?.textContent?.replace(/\\s+/g, ' ').trim() || '',
        mappingDrawerOpen: document.querySelector('.mapping-detail-drawer')?.open ?? null,
        evidenceDrawerOpen: document.querySelector('.capability-evidence-drawer')?.open ?? null,
        routeFunctionReady: typeof activateRoute === "function",
        viewFunctionReady: typeof setActiveView === "function",
        tooltipProbe
      };
    })()`);
    const screenshot = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
    const screenshotPath = join(tmpdir(), `sapd-${pageName}-smoke.png`);
    writeFileSync(screenshotPath, Buffer.from(screenshot.data, "base64"));
    ws.close();
    const blockingIssues = issues.filter(
      (issue) =>
        issue.type === "exception" ||
        (issue.type === "error" && !/favicon|File not found|Failed to load resource: the server responded with a status of 404/i.test(issue.text)),
    );
    const activeViewMismatch = expectedView && metrics.activeView !== expectedView;
    const pageExpectationFailed =
      activeViewMismatch ||
      (pageName === "standards" && !metrics.standardTable) ||
      (pageName === "standards" && !metrics.standardHeaderCenterAligned) ||
      (pageName === "standards" && metrics.standardHeaderEmphasis?.count > 0 && (metrics.standardHeaderEmphasis.minFontSize < 14 || metrics.standardHeaderEmphasis.minFontWeight < 800)) ||
      (pageName === "standards" &&
        metrics.standardDescriptionAligned?.count > 0 &&
        (!metrics.standardDescriptionAligned.leftAligned || !metrics.standardDescriptionAligned.middleAligned)) ||
      (pageName === "standards" && metrics.standardRelatedColumnMaxWidth > 210) ||
      (route === "/standards/cis-csc-v8" && metrics.standardSecurityFunctionValues.some((item) => /\b(?:Govern|Identify|Protect|Detect|Respond|Recover)\b/i.test(item))) ||
      (route.startsWith("/knowledge/") && !["/knowledge/hype-cycle", "/knowledge/others"].includes(route) && !metrics.maintenanceTable) ||
      (route.startsWith("/knowledge/") &&
        metrics.maintenanceTable &&
        (!metrics.maintenanceHeaderEmphasis.centered ||
          metrics.maintenanceHeaderEmphasis.minFontSize < 14 ||
          metrics.maintenanceHeaderEmphasis.minFontWeight < 800)) ||
      ((pageName === "capability" || pageName === "capabilities") && !metrics.capabilityMap) ||
      (pageName === "environment" && !metrics.environmentTree) ||
      ((pageName === "lifecycle" || pageName === "dev-lifecycle") && !metrics.lifecycleLane) ||
      (pageName === "content" && guideExpectation && !metrics.guideSlidePlayer) ||
      (pageName === "content" && guideExpectation && metrics.guideToolbarPresent) ||
      (pageName === "content" && guideExpectation && metrics.pageHeaderActionButtons !== 0) ||
      (pageName === "content" && guideExpectation && metrics.guideThumbs !== guideExpectation.thumbs) ||
      (pageName === "content" &&
        guideExpectation &&
        (!metrics.guideInteractionProbe?.clickScrollPreserved ||
          metrics.guideInteractionProbe?.afterClickPage !== expectedGuidePage21 ||
          metrics.guideInteractionProbe?.afterKeyPage !== expectedGuidePage22 ||
          metrics.guideInteractionProbe?.activeThumbText !== "22" ||
          metrics.guideInteractionProbe?.navTitle !== "幻灯片目录" ||
          metrics.guideInteractionProbe?.navTitleTextAlign !== "center" ||
          metrics.guideInteractionProbe?.navHeadJustify !== "center" ||
          metrics.guideInteractionProbe?.overlayOpacityBeforeHover !== "0" ||
          Number(metrics.guideInteractionProbe?.overlayOpacityAfterHover || 0) < 0.95 ||
          metrics.guideInteractionProbe?.overlayPointerEventsAfterHover !== "auto" ||
          metrics.guideInteractionProbe?.overlayPageText !== expectedGuidePage22 ||
          metrics.guideInteractionProbe?.overlayOpacityAfterMoveToSlide !== "0" ||
          metrics.guideInteractionProbe?.overlayOpacityAfterLeave !== "0" ||
          metrics.guideInteractionProbe?.overlayPointerEventsAfterLeave !== "auto")) ||
      metrics.tooltipProbe?.visible > 1;
    const summary = {
      page: pageName,
      url: baseUrl,
      metrics,
      consoleIssues: blockingIssues.length,
      consoleIssueSample: blockingIssues.slice(0, 3),
      screenshot: screenshotPath,
      result: blockingIssues.length || metrics.bodyOverflowX > 2 || pageExpectationFailed ? "fail" : "pass",
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
