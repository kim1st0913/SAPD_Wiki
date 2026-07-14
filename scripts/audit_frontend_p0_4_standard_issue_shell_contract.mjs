#!/usr/bin/env node

import { readFile } from "node:fs/promises";

const DEFAULT_BASE_URL = "http://127.0.0.1:5173";

function argValue(name, fallback) {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function read(relativePath) {
  return readFile(new URL(`../${relativePath}`, import.meta.url), "utf8");
}

async function fetchText(baseUrl, pathname) {
  const response = await fetch(new URL(pathname, baseUrl));
  assert(response.ok, `${pathname}: HTTP ${response.status}`);
  return response.text();
}

function sourceSection(source, start, end) {
  const startIndex = source.indexOf(start);
  assert(startIndex >= 0, `missing section start: ${start}`);
  const endIndex = source.indexOf(end, startIndex + start.length);
  assert(endIndex > startIndex, `missing section end: ${end}`);
  return source.slice(startIndex, endIndex);
}

function validateStandardContract(contract, appShell, css) {
  for (const route of contract.standard_contract.deep_routes) {
    assert(appShell.includes(`"${route}"`), `${route}: standard deep route missing from AppShell`);
  }
  assert(appShell.includes(`id: "${contract.standard_contract.domain_id}"`), "standards domain missing from navigation manifest");
  assert(appShell.includes("function syncNavigationGroups"), "standard deep links must reuse shell navigation synchronization");
  assert(appShell.includes("group.open = active;"), "active standards domain is not forced open");
  assert(appShell.includes("activeTarget ||= document.querySelector"), "current standard framework fallback target missing");
  assert(appShell.includes("activeTarget?.scrollIntoView({ block: \"nearest\", inline: \"nearest\", behavior: \"auto\" })"), "current standard framework is not scrolled into view");
  assert(appShell.includes(`const inset = ${contract.standard_contract.active_navigation_inset};`), "standard navigation inset changed");
  assert(appShell.includes("navigation.scrollTop += targetRect.bottom - (navigationRect.bottom - inset);"), "bottom-clipped standard framework correction missing");
  assert(css.includes(`scroll-padding-block: ${contract.standard_contract.active_navigation_inset}px;`), "standard navigation scroll padding missing");
  assert(css.includes(`scroll-margin-block: ${contract.standard_contract.active_navigation_inset}px;`), "current standard framework scroll margin missing");
}

function validateIssueContract(contract, app, css) {
  const issueRender = sourceSection(app, "function renderWorkbenchIssueInspectorContent", "function renderWorkbenchMaturity");
  const issueSelection = sourceSection(app, "function selectWorkbenchReviewItem", "async function saveWorkbenchReviewInspector");
  const checkboxHandler = sourceSection(app, 'if (event.target?.matches?.(".workbench-review-checkbox")', "const filterControl = event.target?.closest");
  const routeActivation = sourceSection(app, "function activateRoute", "function openGlobalSearchPage");
  const keyboardHandler = sourceSection(app, 'document.addEventListener("keydown", (event) => {\n    const reviewItem', 'document.addEventListener(\n    "toggle"');

  assert(app.includes(`if (normalized === "${contract.issue_contract.route}") return "issues";`), "Issue route type missing");
  assert(issueRender.includes(`workbenchIssueById(state.${contract.issue_contract.current_object_key})`), "Issue inspector is not driven by the explicit current object id");
  assert(!issueRender.includes("selectedRows[0]"), "Issue inspector still falls back to the first checked row");
  assert(!issueRender.includes("renderWorkbenchIssueEmptyInspector"), "Issue route still renders a resident empty inspector");
  assert(issueRender.includes('data-review-inspector-open="${inspectorIssue ? "true" : "false"}"'), "Issue layout does not expose conditional inspector state");
  assert(issueRender.includes("inspectorIssue\n            ?"), "Issue inspector is not conditionally rendered");
  assert(issueRender.includes(contract.issue_contract.close_selector.slice(1, -1)), "Issue inspector close action missing");
  assert(issueSelection.includes(`state.${contract.issue_contract.current_object_key} = noteId`), "row activation does not set the explicit Issue id");
  assert(!issueSelection.includes(`state.${contract.issue_contract.batch_selection_key}.add(noteId)`), "opening detail still mutates the batch selection set");
  assert(!checkboxHandler.includes(`state.${contract.issue_contract.current_object_key}`), "batch checkbox still opens or replaces the current Issue detail");
  assert(routeActivation.includes("if (routeChanged && isWorkbenchIssueRoute)"), "entering the Issue route does not clear stale selection");
  assert(routeActivation.includes(`state.${contract.issue_contract.current_object_key} = "";`), "stale Issue current id is not cleared on route entry");
  assert(routeActivation.includes(`state.${contract.issue_contract.batch_selection_key} = new Set();`), "stale Issue batch selection is not cleared on route entry");
  assert(app.includes("function closeWorkbenchReviewInspector"), "Issue inspector close helper missing");
  assert(app.includes("当前 Issue 有未保存修改，请先保存或取消，再关闭详情。"), "dirty inspector close guard missing");
  assert(app.includes("focus({ preventScroll: true })"), "closing Issue detail does not restore row focus");
  for (const key of contract.issue_contract.keyboard_keys) {
    const expected = key === "Space" ? 'event.key !== " "' : key === "Enter" ? 'event.key !== "Enter"' : `event.key === "${key}"`;
    assert(keyboardHandler.includes(expected), `Issue keyboard key missing: ${key}`);
  }
  assert(css.includes(".workbench-issues-route .workbench-prototype-annotation-layout.has-inspector"), "Issue open layout selector missing");
  assert(/\.workbench-issues-route \.workbench-prototype-annotation-layout\s*\{[\s\S]*?grid-template-columns:\s*minmax\(220px, 260px\) 4px minmax\(520px, 1fr\);/.test(css), "Issue initial layout still reserves inspector width");
  assert(/\.workbench-issues-route \.workbench-prototype-annotation-layout\.has-inspector\s*\{[\s\S]*?grid-template-columns:[\s\S]*?minmax\(320px, 380px\);/.test(css), "Issue selected layout does not add the inspector column");
}

async function main() {
  const baseUrl = argValue("--url", DEFAULT_BASE_URL).replace(/\/$/, "");
  const [contractSource, appShell, app, css, runner, readme] = await Promise.all([
    read("config/frontend-p0-4-standard-issue-shell.json"),
    read("frontend/capability-browser/components/AppShell.js"),
    read("frontend/capability-browser/app.js"),
    read("frontend/capability-browser/styles.css"),
    read("scripts/run_project_test_suite.mjs"),
    read("scripts/README.md"),
  ]);
  const contract = JSON.parse(contractSource);
  validateStandardContract(contract, appShell, css);
  validateIssueContract(contract, app, css);
  assert(runner.includes("audit_frontend_p0_4_standard_issue_shell_contract.mjs"), "P0-4 audit is not registered in the project test suite");
  assert(readme.includes("audit_frontend_p0_4_standard_issue_shell_contract.mjs"), "P0-4 audit is not documented in scripts/README.md");

  const [runtimeAppShell, runtimeApp, runtimeCss] = await Promise.all([
    fetchText(baseUrl, "/components/AppShell.js"),
    fetchText(baseUrl, "/app.js"),
    fetchText(baseUrl, "/styles.css"),
  ]);
  validateStandardContract(contract, runtimeAppShell, runtimeCss);
  validateIssueContract(contract, runtimeApp, runtimeCss);

  console.log(JSON.stringify({
    result: "pass",
    contract: contract.version,
    baseUrl,
    standards: {
      deepRouteCount: contract.standard_contract.deep_routes.length,
      domain: contract.standard_contract.domain_id,
      activeNavigationInset: contract.standard_contract.active_navigation_inset,
    },
    issues: {
      route: contract.issue_contract.route,
      initialInspectorWidth: contract.issue_contract.initial_inspector_width,
      explicitCurrentObject: contract.issue_contract.current_object_key,
      batchSelectionIndependent: !contract.issue_contract.batch_selection_opens_detail,
      staleRouteSelectionRestored: contract.issue_contract.old_route_selection_restored,
    },
    forbiddenScope: contract.forbidden_scope,
  }, null, 2));
}

main().catch((error) => {
  console.error(JSON.stringify({ result: "fail", error: error.message }, null, 2));
  process.exit(1);
});
