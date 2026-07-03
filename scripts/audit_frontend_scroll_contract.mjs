import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8");
}

const stylesCss = read("frontend/capability-browser/styles.css");
const appJs = read("frontend/capability-browser/app.js");
const indexHtml = read("frontend/capability-browser/index.html");

function cssBlocksForSelector(source, selector) {
  const blocks = [];
  const pattern = /([^{}]+)\{([^{}]*)\}/g;
  let match;
  while ((match = pattern.exec(source))) {
    const selectorList = match[1]
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
    if (selectorList.includes(selector)) {
      blocks.push(match[2]);
    }
  }
  return blocks;
}

function blockHasDeclaration(block, property, valuePattern) {
  const pattern = new RegExp(`${property}\\s*:\\s*${valuePattern}\\s*(?:;|$)`);
  return pattern.test(block);
}

function anyBlock(selector, predicate) {
  return cssBlocksForSelector(stylesCss, selector).some(predicate);
}

function check(id, ok, message, detail = undefined) {
  return { id, ok: Boolean(ok), message, ...(detail ? { detail } : {}) };
}

const checks = [
  check(
    "sidebar_expanded_has_single_native_scroll_owner",
    anyBlock(
      ".app-shell-integrated:not(.sidebar-collapsed) .module-tabs.manifest-navigation",
      (block) =>
        blockHasDeclaration(block, "overflow-y", "auto") &&
        blockHasDeclaration(block, "overflow-x", "hidden") &&
        blockHasDeclaration(block, "scrollbar-gutter", "auto"),
    ) &&
      anyBlock(
        ".app-shell-integrated:not(.sidebar-collapsed) .secondary-navigation",
        (block) => blockHasDeclaration(block, "overflow", "visible") && blockHasDeclaration(block, "max-height", "none"),
      ),
    "expanded AppShell sidebar must scroll only on manifest-navigation; secondary-navigation must not create nested scroll.",
  ),
  check(
    "sidebar_expanded_has_no_custom_webkit_scrollbar",
    !stylesCss.includes(".app-shell-integrated:not(.sidebar-collapsed) .module-tabs.manifest-navigation::-webkit-scrollbar"),
    "expanded AppShell sidebar must not use a custom WebKit scrollbar that can add repaint or scroll-jank risk.",
  ),
  check(
    "global_search_workspace_is_single_scroll_owner",
    anyBlock(
      ".global-search-page-workspace",
      (block) =>
        blockHasDeclaration(block, "overflow-x", "hidden") &&
        blockHasDeclaration(block, "overflow-y", "auto") &&
        blockHasDeclaration(block, "overscroll-behavior-y", "contain"),
    ) &&
      anyBlock(
        ".app-shell-integrated .global-search-page-workspace",
        (block) =>
          blockHasDeclaration(block, "overflow-x", "hidden") &&
          blockHasDeclaration(block, "overflow-y", "auto") &&
          blockHasDeclaration(block, "overscroll-behavior-y", "contain"),
      ),
    "global search result page must have exactly one vertical page scroll owner in the locked AppShell.",
  ),
  check(
    "global_search_results_do_not_create_nested_vertical_scroll",
    anyBlock(
      ".global-search-page",
      (block) => blockHasDeclaration(block, "height", "auto") && blockHasDeclaration(block, "min-height", "100%"),
    ) &&
      anyBlock(".global-search-page-layout", (block) => blockHasDeclaration(block, "height", "auto")) &&
      anyBlock(".global-search-page-results", (block) => blockHasDeclaration(block, "grid-template-rows", "auto auto")) &&
      anyBlock(".global-search-page-list", (block) => blockHasDeclaration(block, "overflow", "visible")),
    "global search results must expand in the page scroll; the result list must not be a second vertical scroll container.",
  ),
  check(
    "workbench_issue_route_has_stable_class",
    appJs.includes('class="workbench-route-page workbench-issues-route" aria-label="Issue 清单"'),
    "Issue list route must expose a stable class so scroll ownership can be scoped to this route only.",
  ),
  check(
    "workbench_issue_outer_workspace_only_scrolls_horizontally",
    anyBlock(
      ".app-shell-integrated .workbench-workspace:has(.workbench-issues-route)",
      (block) => blockHasDeclaration(block, "overflow-x", "auto") && blockHasDeclaration(block, "overflow-y", "hidden"),
    ),
    "Issue list workspace must not compete vertically with the three review panes; it may keep horizontal overflow for narrow screens.",
  ),
  check(
    "workbench_issue_layout_fills_available_height",
    anyBlock(
      ".workbench-issues-route",
      (block) =>
        blockHasDeclaration(block, "height", "100%") &&
        blockHasDeclaration(block, "min-height", "0") &&
        blockHasDeclaration(block, "grid-template-rows", "auto auto minmax\\(0, 1fr\\)"),
    ) &&
      anyBlock(
        ".workbench-issues-route .workbench-prototype-annotation-layout",
        (block) =>
          blockHasDeclaration(block, "height", "100%") &&
          blockHasDeclaration(block, "min-height", "0") &&
          blockHasDeclaration(block, "max-height", "none"),
      ),
    "Issue list must size the three-column queue to the available AppShell height instead of using viewport magic numbers.",
  ),
  check(
    "workbench_issue_three_panes_are_the_vertical_scroll_owners",
    anyBlock(
      ".workbench-review-scope",
      (block) =>
        blockHasDeclaration(block, "overflow", "auto") &&
        blockHasDeclaration(block, "max-height", "100%") &&
        blockHasDeclaration(block, "scrollbar-gutter", "stable"),
    ) &&
      anyBlock(
        ".workbench-review-queue",
        (block) =>
          blockHasDeclaration(block, "overflow", "auto") &&
          blockHasDeclaration(block, "max-height", "100%") &&
          blockHasDeclaration(block, "scrollbar-gutter", "stable"),
      ) &&
      anyBlock(
        ".workbench-review-inspector",
        (block) =>
          blockHasDeclaration(block, "overflow", "auto") &&
          blockHasDeclaration(block, "max-height", "100%") &&
          blockHasDeclaration(block, "scrollbar-gutter", "stable"),
      ),
    "Issue list scope, queue, and inspector panes are the intended split-pane vertical scroll owners.",
  ),
  check(
    "standard_table_scroll_is_preserved",
    anyBlock(".standard-framework-table-scroll", (block) => block.includes("overflow: auto")),
    "standard/framework large data table scroll must remain available.",
  ),
  check(
    "annotation_drawer_scroll_is_preserved",
    anyBlock(".annotation-drawer-scroll", (block) => blockHasDeclaration(block, "overflow-y", "auto")),
    "annotation drawer must retain its own vertical scroll.",
  ),
  check(
    "environment_canvas_scroll_is_preserved",
    anyBlock(".environment-object-graph", (block) => block.includes("overflow: auto")) &&
      anyBlock(".environment-object-funnel-viewport", (block) => block.includes("overflow: auto")),
    "environment graph/canvas workspaces may keep intentional local pan/scroll containers.",
  ),
  check(
    "lifecycle_horizontal_tab_scroll_is_preserved",
    anyBlock(".dev-lifecycle-workspace .lifecycle-stage-tabs", (block) => blockHasDeclaration(block, "overflow-x", "auto")),
    "LC-AP horizontal stage tabs must retain horizontal overflow behavior.",
  ),
  check(
    "cache_versions_include_scroll_contract",
    indexHtml.includes("scroll-contract-20260703-1"),
    "index.html must cache-bust the scroll contract changes.",
  ),
];

const failed = checks.filter((item) => !item.ok);

console.log(
  JSON.stringify(
    {
      status: failed.length ? "fail" : "pass",
      checkCount: checks.length,
      failedCount: failed.length,
      failed,
    },
    null,
    2,
  ),
);

if (failed.length) {
  process.exit(1);
}
