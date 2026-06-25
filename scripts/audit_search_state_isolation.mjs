import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8");
}

function snippet(source, startNeedle, endNeedle) {
  const start = source.indexOf(startNeedle);
  if (start < 0) return "";
  const end = source.indexOf(endNeedle, start + startNeedle.length);
  return source.slice(start, end > start ? end : start + 1200);
}

const appJs = read("frontend/capability-browser/app.js");
const viewModels = read("frontend/capability-browser/viewModels.js");
const indexHtml = read("frontend/capability-browser/index.html");
const appShell = read("frontend/capability-browser/components/AppShell.js");
const lifecycleComponent = read("frontend/capability-browser/components/ApplicationSecurityLifecycle.js");
const standardTable = read("frontend/capability-browser/components/StandardFrameworkTable.js");
const stylesCss = read("frontend/capability-browser/styles.css");

const searchInputHandler = snippet(appJs, '$("searchInput")?.addEventListener("input"', '$("capabilitySearchInput")?.addEventListener("input"');
const capabilityInputHandler = snippet(appJs, '$("capabilitySearchInput")?.addEventListener("input"', 'document.addEventListener("input", (event) => {');
const environmentInputHandler = snippet(appJs, 'if (event.target?.id !== "environmentSearchInput") return;', '$("devLifecycleStageSearch")?.addEventListener');
const sourceInputHandler = snippet(appJs, 'if (event.target?.id !== "sourceSearchInput") return;', "renderMaintenance();");
const devLifecycleInputHandler = snippet(appJs, '$("devLifecycleStageSearch")?.addEventListener("input"', '$("dataLifecycleStageSearch")?.addEventListener("input"');
const dataLifecycleInputHandler = snippet(appJs, '$("dataLifecycleStageSearch")?.addEventListener("input"', '$("environmentTree")?.addEventListener("click"');
const relationFilterHandler = snippet(appJs, 'const input = event.target.closest("[data-relation-filter]");', '$("detail")?.addEventListener("pointerdown"');

const checks = [
  {
    id: "global_search_state_exists",
    ok: appJs.includes("globalSearch:") && appJs.includes("pageSearches:") && appJs.includes("function setScopedSearch"),
    message: "app.js must define independent globalSearch and scoped pageSearches.",
  },
  {
    id: "global_search_does_not_write_page_search",
    ok: searchInputHandler.includes("state.globalSearch") && !searchInputHandler.includes("state.search =") && !searchInputHandler.includes("capabilitySearchInput"),
    message: "top global search must not write page search state or capability search input.",
  },
  {
    id: "legacy_global_search_placeholder_is_global",
    ok:
      indexHtml.includes('id="searchInput" type="search" placeholder="全局搜索知识、能力、标准、指南"') &&
      appShell.includes('id="searchInput" type="search" placeholder="全局搜索知识、能力、标准、指南"'),
    message: "global search placeholders must describe global search, not a page filter.",
  },
  {
    id: "capability_search_uses_scoped_search",
    ok: capabilityInputHandler.includes("setScopedSearch(event.target.value)") && !capabilityInputHandler.includes("searchInput"),
    message: "capability page search must use scoped page search and not mirror into global search.",
  },
  {
    id: "environment_search_uses_scoped_search",
    ok: environmentInputHandler.includes("setScopedSearch(event.target.value)"),
    message: "environment page search must use scoped page search.",
  },
  {
    id: "source_search_uses_scoped_search",
    ok: sourceInputHandler.includes("setScopedSearch(event.target.value)"),
    message: "source table search must use scoped page search.",
  },
  {
    id: "lifecycle_searches_use_dedicated_stage_state",
    ok:
      devLifecycleInputHandler.includes("state.devLifecycleStageSearch = event.target.value.trim()") &&
      dataLifecycleInputHandler.includes("state.dataLifecycleStageSearch = event.target.value.trim()") &&
      !devLifecycleInputHandler.includes("state.search") &&
      !dataLifecycleInputHandler.includes("state.search") &&
      indexHtml.includes('id="devLifecycleStageSearch"') &&
      indexHtml.includes('id="dataLifecycleStageSearch"'),
    message: "LC-AP and LC-DT stage searches must use dedicated lifecycle stage search state.",
  },
  {
    id: "relation_filters_use_dedicated_relation_state",
    ok:
      relationFilterHandler.includes("state.relationshipFilters[input.dataset.relationFilter] = input.value") &&
      !relationFilterHandler.includes("state.search") &&
      appJs.includes("data-relation-filter"),
    message: "capability relationship table filters must use relationshipFilters, not global or page search.",
  },
  {
    id: "search_inputs_sync_from_state",
    ok: appJs.includes("function syncSearchInputs()") && appJs.includes("globalInput.value !== state.globalSearch") && appJs.includes("sourceInput.value !== state.search"),
    message: "search inputs must sync from their own state owner.",
  },
  {
    id: "capability_directory_search_empty_state",
    ok: viewModels.includes("未找到匹配的安全能力，请调整搜索条件。"),
    message: "capability directory search empty state must not claim the data package is missing.",
  },
  {
    id: "cache_version_bumped",
    ok:
      indexHtml.includes("viewModels.js?v=global-search-20260617-9") &&
      indexHtml.includes("app.js?v=global-search-20260617-9") &&
      indexHtml.includes("AppShell.js?v=global-search-20260617-9") &&
      indexHtml.includes("ApplicationSecurityLifecycle.js?v=global-search-20260617-9") &&
      indexHtml.includes("styles.css?v=global-search-20260617-9"),
    message: "index.html must bump cache versions for the search-state and global-search fixes.",
  },
  {
    id: "lifecycle_stage_search_indexes_cell_content",
    ok:
      viewModels.includes("function lifecycleWorkbenchStageSearchText") &&
      viewModels.includes("uses_development_technical_module") &&
      viewModels.includes("development_technical_modules") &&
      lifecycleComponent.includes("row.searchText") &&
      lifecycleComponent.includes("lifecycle-search-mark") &&
      lifecycleComponent.includes("searchQuery =") &&
      stylesCss.includes(".lifecycle-search-mark") &&
      stylesCss.includes("annotationGlowSweep") &&
      appJs.includes("search: state.devLifecycleStageSearch") &&
      appJs.includes("search: state.dataLifecycleStageSearch") &&
      appJs.includes("matchesTextQuery(stageQuery, row.title, row.code, row.order, row.searchText)"),
    message: "LC-AP and LC-DT local searches must index stage cell content, including technical services and modules.",
  },
  {
    id: "search_box_ownership_inventory",
    ok:
      appJs.includes("globalSearch:") &&
      appJs.includes("pageSearches:") &&
      appJs.includes("devLifecycleStageSearch:") &&
      appJs.includes("dataLifecycleStageSearch:") &&
      appJs.includes("relationshipFilters:"),
    message: "all known search/filter inputs must have explicit owner state.",
  },
  {
    id: "global_search_has_result_panel",
    ok:
      appJs.includes("function runGlobalSearch()") &&
      appJs.includes("function renderGlobalSearchPanel()") &&
      appJs.includes("function buildGlobalSearchResults(query)") &&
      appJs.includes("data-global-search-result") &&
      appJs.includes("document.body.insertAdjacentHTML") &&
      stylesCss.includes(".global-search-panel"),
    message: "global search must render a body-level result panel backed by a local search index.",
  },
  {
    id: "global_search_can_activate_results",
    ok:
      appJs.includes("function activateGlobalSearchResult(result)") &&
      appJs.includes("activateRoute(result.route)") &&
      appJs.includes("selectedCapabilityId") &&
      appJs.includes("selectedMaintenanceId") &&
      appJs.includes("selectedProcessId"),
    message: "global search results must activate the matching page and selected object when possible.",
  },
  {
    id: "global_search_indexes_lifecycle_cell_content",
    ok:
      appJs.includes('["development_technical_modules", "开发技术模块"]') &&
      appJs.includes('["development_technical_services", "开发技术服务"]') &&
      appJs.includes("useOwnIdAsSelection") &&
      appJs.includes("selectedProcessId: targetProcessId") &&
      appJs.includes("targetText: title"),
    message: "global search must include LC-AP cell-level technical services/modules and route them to the owning stage.",
  },
  {
    id: "global_search_shortcut_control_is_actionable",
    ok:
      indexHtml.includes('id="globalSearchActionButton"') &&
      appShell.includes('id="globalSearchActionButton"') &&
      appJs.includes('$("globalSearchActionButton")?.addEventListener("click"') &&
      stylesCss.includes(".global-search-shortcut"),
    message: "global search shortcut affordance must be a real actionable button, not a decorative keycap.",
  },
  {
    id: "global_search_loads_searchable_packages",
    ok:
      appJs.includes("ensureGlobalSearchPackages") &&
      appJs.includes('"capability"') &&
      appJs.includes('"maintenanceKnowledge"') &&
      appJs.includes('"standards"') &&
      appJs.includes('"lifecycle"') &&
      appJs.includes('"content"'),
    message: "global search must load the searchable package set lazily.",
  },
  {
    id: "global_search_keyboard_shortcut_focuses_input",
    ok: appJs.includes('event.key.toLowerCase() !== "k"') && appJs.includes('const input = $("searchInput")') && appJs.includes("input?.focus()"),
    message: "global search keyboard shortcut must focus the top search input.",
  },
  {
    id: "global_search_results_reveal_target_rows",
    ok:
      appJs.includes("function revealGlobalSearchTarget(result") &&
      appJs.includes("globalSearchTargetElement(result)") &&
      appJs.includes("function lifecycleSearchValueTargetElement") &&
      appJs.includes("function globalSearchTextTargetElement") &&
      appJs.includes("function activeGlobalSearchRootElement") &&
      appJs.includes("scrollIntoView({ block: \"center\"") &&
      appJs.includes("global-search-target-highlight") &&
      stylesCss.includes(".global-search-target-highlight") &&
      stylesCss.includes("annotationSoftPulse"),
    message: "global search result activation must scroll to and highlight the matched row or value when possible.",
  },
  {
    id: "global_search_results_have_text_targets",
    ok:
      appJs.includes("targetText: title") &&
      appJs.includes("targetText: framework.title || framework.id") &&
      appJs.includes("targetText: item.label || item.route") &&
      appJs.includes("targetText: title,") &&
      appJs.includes("return globalSearchTextTargetElement(result);"),
    message: "global search result items must carry targetText and fall back to current-page text anchors.",
  },
  {
    id: "global_search_activation_keeps_query_and_sets_page_search",
    ok:
      appJs.includes("const activationQuery = searchTextForActivatedResult(result)") &&
      appJs.includes("clearGlobalSearchPanel({ keepQuery: true })") &&
      appJs.includes("routeHasPageSearch(result.route)") &&
      appJs.includes("setScopedSearch(activationQuery)") &&
      appJs.includes("queuePageSearchReveal(activationQuery)") &&
      appJs.includes("flushPageSearchReveal();"),
    message: "global search activation must keep the query and hand it to the destination page search for content reveal.",
  },
  {
    id: "standard_framework_search_has_clause_anchors",
    ok:
      standardTable.includes("data-standard-row-text") &&
      standardTable.includes("data-copy-text") &&
      appJs.includes("node.getAttribute?.(\"data-standard-row-text\")") &&
      appJs.includes("\"[data-standard-row-text]\"") &&
      indexHtml.includes("StandardFrameworkTable.js?v=global-search-20260617-9"),
    message: "standard/framework tables must expose row and clause anchors for search reveal.",
  },
  {
    id: "page_search_inputs_reveal_highlight_targets",
    ok:
      appJs.includes("pendingPageSearchReveal") &&
      appJs.includes("function queuePageSearchReveal") &&
      appJs.includes("function pageSearchTextTargetElement") &&
      appJs.includes("function revealPageSearchTarget") &&
      appJs.includes("function flushPageSearchReveal") &&
      appJs.includes("page-search-target-highlight") &&
      appJs.includes("queuePageSearchReveal(event.target.value)") &&
      appJs.includes("queuePageSearchReveal(event.target.value, \"development-security\")") &&
      appJs.includes("queuePageSearchReveal(event.target.value, \"data-security\")") &&
      stylesCss.includes(".page-search-target-highlight") &&
      stylesCss.includes("annotationSoftPulse"),
    message: "page-level search boxes must scroll to and visibly highlight the matched business content.",
  },
];

const failures = checks.filter((check) => !check.ok);
const report = {
  status: failures.length ? "fail" : "pass",
  checkCount: checks.length,
  failureCount: failures.length,
  failures,
};

console.log(JSON.stringify(report, null, 2));
if (failures.length) process.exitCode = 1;
