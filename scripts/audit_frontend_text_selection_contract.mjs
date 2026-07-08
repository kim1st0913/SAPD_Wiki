import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8");
}

const appJs = read("frontend/capability-browser/app.js");
const stylesCss = read("frontend/capability-browser/styles.css");
const indexHtml = read("frontend/capability-browser/index.html");

function check(id, ok, message, detail = undefined) {
  return { id, ok: Boolean(ok), message, ...(detail ? { detail } : {}) };
}

function hasAll(source, fragments) {
  return fragments.every((fragment) => source.includes(fragment));
}

const checks = [
  check(
    "text_selection_click_guard_installed",
    hasAll(appJs, [
      "function activeTextSelection()",
      "window.getSelection?.()",
      "function shouldSuppressClickForTextSelection(event)",
      "selectionIntersectsNode(selection, clickableHost)",
      "function suppressClickIfTextSelection(event)",
      "event.stopImmediatePropagation()",
      'document.addEventListener("click", suppressClickIfTextSelection, true)',
    ]),
    "app.js must preserve user text selection by suppressing only the click generated after selecting selectable business text.",
  ),
  check(
    "selection_guard_exempts_form_controls_and_drag_surfaces",
    hasAll(appJs, [
      "TEXT_SELECTION_CLICK_EXEMPT_SELECTOR",
      "input",
      "textarea",
      "select",
      "[data-content-slide-index]",
      "[data-content-slide-step]",
      "TEXT_SELECTION_DRAG_SURFACE_SELECTOR",
      ".workspace-resizer",
      ".network-graph-canvas",
      "[data-environment-basemap-viewport]",
    ]),
    "text selection guard must not break form controls, resizers, graph pan, basemap pan, or poster pan interactions.",
  ),
  check(
    "guide_fullscreen_cleanup_preserves_slide_catalog_clicks",
    hasAll(appJs, [
      "function resetModelingPosterLightboxState()",
      "function exitModelingPosterFullscreenIfActive()",
      "function resetTransientContentOverlaysForRouteChange(nextRoute = \"\")",
      "if (routeChanged) resetTransientContentOverlaysForRouteChange(target.route)",
      "function activateContentSlideThumb(slideThumb, event = null)",
      'const slideThumb = event.target?.closest?.("[data-content-slide-index]")',
      "activateContentSlideThumb(slideThumb, event)",
      "exitPromise.finally(() => renderContent())",
    ]),
    "closing ArchiMate fullscreen must clear modal/drag/fullscreen state, and slide thumbnails must handle clicks before residual global handlers can swallow them.",
  ),
  check(
    "business_text_is_selectable",
    hasAll(stylesCss, [
      ".app-shell-integrated .workspace-stage",
      "-webkit-user-select: text",
      "user-select: text",
      "[data-copy-text]",
      '[data-annotation-value="true"]',
      ".relation-chip",
      ".standard-tooltip-chip",
    ]),
    "main workspace business text, relationship chips, copy text, and annotation values must be selectable.",
  ),
  check(
    "clickable_business_rows_are_selectable",
    hasAll(stylesCss, [
      ".tree-row",
      ".catalog-row",
      ".lifecycle-nav-row",
      ".global-search-result",
      ".global-search-page-result",
      ".workbench-review-item",
      "[data-capability-id]",
      "[data-maintenance-id]",
      "[data-environment-object-id]",
      "[data-search-page-result]",
    ]),
    "clickable business rows and cards must keep their visible text selectable for copy operations.",
  ),
  check(
    "controls_and_drag_surfaces_keep_no_select",
    hasAll(stylesCss, [
      ".workspace-resizer",
      ".relationship-column-resizer",
      ".network-graph-canvas",
      "[data-environment-basemap-viewport]",
      ".modeling-poster-lightbox-scroll",
      "user-select: none",
    ]),
    "drag handles, graph canvases, basemap viewports, and poster pan surfaces must remain non-selectable.",
  ),
  check(
    "cache_busted",
    indexHtml.includes("text-selection-copy-20260703-1") &&
      indexHtml.includes("guide-fullscreen-cleanup-20260708-1"),
    "index.html must cache-bust app.js and styles.css for the text selection fix.",
  ),
];

const failures = checks.filter((item) => !item.ok);
if (failures.length) {
  console.error(JSON.stringify({ result: "fail", failures }, null, 2));
  process.exit(1);
}

console.log(JSON.stringify({ result: "pass", checkCount: checks.length }, null, 2));
