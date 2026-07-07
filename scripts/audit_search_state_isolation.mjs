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
const environmentLocalRelationMap = read("frontend/capability-browser/components/EnvironmentLocalRelationMap.js");
const environmentBasemapViewer = read("frontend/capability-browser/components/EnvironmentBasemapViewer.js");
const standardTable = read("frontend/capability-browser/components/StandardFrameworkTable.js");
const stylesCss = read("frontend/capability-browser/styles.css");

const searchInputHandler = snippet(appJs, '$("searchInput")?.addEventListener("input"', '$("capabilitySearchInput")?.addEventListener("input"');
const capabilityInputHandler = snippet(appJs, '$("capabilitySearchInput")?.addEventListener("input"', 'document.addEventListener("input", (event) => {');
const environmentInputHandler = snippet(appJs, 'if (event.target?.id !== "environmentSearchInput") return;', '$("devLifecycleStageSearch")?.addEventListener');
const sourceInputHandler = snippet(appJs, 'if (event.target?.id !== "sourceSearchInput") return;', "renderMaintenance();");
const devLifecycleInputHandler = snippet(appJs, '$("devLifecycleStageSearch")?.addEventListener("input"', '$("dataLifecycleStageSearch")?.addEventListener("input"');
const dataLifecycleInputHandler = snippet(appJs, '$("dataLifecycleStageSearch")?.addEventListener("input"', '$("environmentTree")?.addEventListener("click"');
const relationFilterHandler = snippet(appJs, 'const input = event.target.closest("[data-relation-filter]");', '$("detail")?.addEventListener("pointerdown"');
const drawioBasemapRenderer = snippet(environmentLocalRelationMap, "function renderDrawioBasemap", "function hierarchyNodeKind");

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
    ok:
      environmentInputHandler.includes("setScopedSearch(event.target.value)") &&
      !environmentInputHandler.includes("activeEnvironmentTab ="),
    message: "environment page search must use scoped page search and must not force-switch environment tabs.",
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
    id: "page_local_search_uses_shared_visual_baseline",
    ok:
      appShell.includes("capability-workspace-control page-local-search-toolbar") &&
      !appShell.includes("page-header-search") &&
      appJs.includes("function renderSourceLocalSearchToolbar") &&
      appJs.includes("source-local-search-toolbar page-local-search-toolbar") &&
      appJs.includes("sourceSearchPlaceholder(viewModel.section)") &&
      appJs.includes('data-page-search-status="${escapeHtml(scope)}"') &&
      appJs.includes('data-page-search-scope="${escapeHtml(scope)}"') &&
      appJs.includes(".page-local-search-toolbar") &&
      environmentLocalRelationMap.includes("environment-workspace-control-row page-local-search-toolbar") &&
      environmentLocalRelationMap.includes("renderEnvironmentSearchControl(search)") &&
      !drawioBasemapRenderer.includes("toolbarSearch") &&
      !drawioBasemapRenderer.includes("renderEnvironmentSearchControl") &&
      indexHtml.includes("lifecycle-stage-bar page-local-search-toolbar") &&
      indexHtml.includes("oi154-all-local-search-baseline-20260703-1") &&
      indexHtml.includes("oi154-search-toolbar-align-20260703-1") &&
      appJs.includes("oi154-basemap-search-remove-20260703-1") &&
      stylesCss.includes("--page-local-search-toolbar-height") &&
      stylesCss.includes("--page-local-search-width") &&
      stylesCss.includes("all page-local search controls follow the capability mapping baseline") &&
      stylesCss.includes(".app-shell-integrated .capability-workbench-tools.page-search-control") &&
      stylesCss.includes(".app-shell-integrated .source-catalog-tools.page-search-control") &&
      stylesCss.includes(".app-shell-integrated .environment-search-control.page-search-control") &&
      stylesCss.includes(".app-shell-integrated .lifecycle-stage-search.page-search-control") &&
      stylesCss.includes(".source-local-search-toolbar.page-local-search-toolbar") &&
      stylesCss.includes(".source-local-search-body") &&
      stylesCss.includes(".source-local-toolbar-leading .maintenance-shell-head") &&
      stylesCss.includes(".app-shell-integrated .page-search-control #sourceSearchInput") &&
      stylesCss.includes(".app-shell-integrated .page-search-control .page-search-match-status") &&
      stylesCss.includes(".app-shell-integrated .page-search-control .page-search-input-shell > span") &&
      stylesCss.includes(".environment-workspace-control-row.page-local-search-toolbar .environment-search-control.page-search-control") &&
      stylesCss.includes("margin: -12px -12px 0"),
    message: "capability, environment safety-tech, LC, knowledge dictionary, and standards/framework local searches must share one visual baseline; basemap tab must keep only right-aligned canvas actions.",
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
      viewModels.includes("function dataLifecycleStageSearchText") &&
      viewModels.includes("uses_development_technical_module") &&
      viewModels.includes("development_technical_modules") &&
      viewModels.includes("data_policy_rows") &&
      viewModels.includes("row.sequence") &&
      lifecycleComponent.includes("row.searchText") &&
      lifecycleComponent.includes("lifecycle-search-mark") &&
      lifecycleComponent.includes('mode = ""') &&
      lifecycleComponent.includes("暂无 LC-DT 数据安全关系") &&
      lifecycleComponent.includes("searchQuery =") &&
      stylesCss.includes(".lifecycle-search-mark") &&
      stylesCss.includes("annotationGlowSweep") &&
      appJs.includes("search: state.devLifecycleStageSearch") &&
      appJs.includes("search: state.dataLifecycleStageSearch") &&
      appJs.includes('mode: "data"') &&
      appJs.includes("matchesTextQuery(stageQuery, row.title, row.code, row.order, row.searchText)"),
    message: "LC-AP and LC-DT local searches must index stage cell content, including LC-DT policy rows, and render domain-correct empty states.",
  },
  {
    id: "search_box_ownership_inventory",
    ok:
      appJs.includes("globalSearch:") &&
      appJs.includes("pageSearches:") &&
      appJs.includes("pageSearchMatchSets:") &&
      appJs.includes("devLifecycleStageSearch:") &&
      appJs.includes("dataLifecycleStageSearch:") &&
      appJs.includes("workbenchIssueSearch:") &&
      appJs.includes("relationshipFilters:"),
    message: "all known search/filter inputs must have explicit owner state.",
  },
  {
    id: "workbench_issue_search_uses_domain_history_baseline",
    ok:
      appJs.includes("#workbenchIssueSearchInput") &&
      appJs.includes('id="workbenchIssueSearchInput"') &&
      appJs.includes('placeholder="搜索 Issue 标题、内容、页面或对象"') &&
      appJs.includes('autocomplete="off" data-search-history-kind="workbench-issues" data-review-filter-control="search"') &&
      appJs.includes("workbench-review-active-filters") &&
      appJs.includes("workbench-review-filter-chip") &&
      appJs.includes("scheduleSearchHistoryCommit(filterControl, filterControl.value)"),
    message: "workbench Issue search must disable native autocomplete, use its own workbench-issues history scope, and render filter chips.",
  },
  {
    id: "global_search_history_commits_executed_queries",
    ok:
      appJs.includes("function rememberCommittedSearchQuery") &&
      appJs.includes("function commitLoadedSearchHistoryForInput") &&
      appJs.includes("function globalSearchQueryHasLoaded") &&
      appJs.includes("refreshSearchHistoryPanelForKind(targetKind)") &&
      appJs.includes("clearSearchHistoryCommitTimersForKind(targetKind)") &&
      indexHtml.includes("oi182-search-history-pagination-20260705-1"),
    message: "global search history must remember executed/loaded queries immediately instead of relying only on debounced input events.",
  },
  {
    id: "page_search_inputs_preserve_composition_and_focus",
    ok:
      appJs.includes("SEARCH_COMPOSITION_INPUT_SELECTOR") &&
      appJs.includes("function isComposingSearchInput") &&
      appJs.includes("function restoreSearchInputFocus") &&
      appJs.includes('document.addEventListener("compositionstart"') &&
      appJs.includes('document.addEventListener("compositionend"') &&
      capabilityInputHandler.includes("if (isComposingSearchInput(event)) return;") &&
      environmentInputHandler.includes("if (isComposingSearchInput(event)) return;") &&
      sourceInputHandler.includes("if (isComposingSearchInput(event)) return;") &&
      devLifecycleInputHandler.includes("if (isComposingSearchInput(event)) return;") &&
      dataLifecycleInputHandler.includes("if (isComposingSearchInput(event)) return;") &&
      relationFilterHandler.includes("if (isComposingSearchInput(event)) return;"),
    message: "page search inputs must preserve IME/composition typing and restore focus after rerenders.",
  },
  {
    id: "local_search_history_uses_domain_scopes",
    ok:
      appJs.includes("function searchHistoryKindForInput") &&
      appJs.includes("function sourceSearchHistoryKind") &&
      appJs.includes('"workbench-issues": "Issue 筛选记录"') &&
      indexHtml.includes('data-search-history-kind="capability"') &&
      indexHtml.includes('data-search-history-kind="lc-ap"') &&
      indexHtml.includes('data-search-history-kind="lc-dt"') &&
      read("frontend/capability-browser/components/EnvironmentLocalRelationMap.js").includes('data-search-history-kind="environment"'),
    message: "local search history must share the custom component but keep capability/environment/LC/workbench records in separate business-domain scopes.",
  },
  {
    id: "page_search_current_match_is_word_level_with_light_context",
    ok:
      appJs.includes("page-search-current-match") &&
      appJs.includes("function pageSearchContextTarget") &&
      appJs.includes("function markPageSearchTarget") &&
      appJs.includes('context.setAttribute("data-page-search-context", "true")') &&
      appJs.includes('target.setAttribute("data-page-search-current", "true")') &&
      appJs.includes('target.classList.add("page-search-target-highlight")') &&
      stylesCss.includes(".page-search-current-match") &&
      stylesCss.includes(".page-search-current-container") &&
      stylesCss.includes('[data-page-search-context="true"]') &&
      !stylesCss.includes('tr[data-page-search-current="true"] > th') &&
      stylesCss.includes(".lifecycle-search-mark.page-search-current-match"),
    message: "page search must highlight the matched word strongly while using only a light context outline for the surrounding row/card.",
  },
  {
    id: "page_search_scrolls_internal_containers",
    ok:
      appJs.includes("function scrollSearchTargetIntoView") &&
      appJs.includes("node.scrollTop +=") &&
      appJs.includes("node.scrollLeft +=") &&
      appJs.includes("scrollSearchTargetIntoView(target, attempt)"),
    message: "page search reveal must scroll nested workspace panes, not only the document viewport.",
  },
  {
    id: "page_search_uses_business_match_sets",
    ok:
      appJs.includes("function setPageSearchMatchSet") &&
      appJs.includes("function pageSearchMatchSet") &&
      appJs.includes("matchSet ? matchSet.matches.length") &&
      appJs.includes("pending.displayCount") &&
      appJs.includes("pending.targetAttribute") &&
      appJs.includes("pending.targetId"),
    message: "page search counters and navigation must support business-object match sets, not only currently visible DOM text.",
  },
  {
    id: "capability_page_search_has_direct_match_queue",
    ok:
      appJs.includes("function capabilitySearchDirectMatches") &&
      appJs.includes("function updateCapabilityPageSearchNavigation") &&
      appJs.includes("function moveCapabilityPageSearchMatch") &&
      appJs.includes('scope = "capability-mapping"') &&
      appJs.includes('targetAttribute: "data-capability-id"') &&
      appJs.includes("state.pendingPageSearchReveal.targetId = activeMatch.id") &&
      appJs.includes("state.selectedCapabilityId = nextId"),
    message: "capability page search must expose a direct business-row queue and bind the first input match as the reveal target.",
  },
  {
    id: "lifecycle_page_search_uses_occurrence_match_queue",
    ok:
      appJs.includes("function searchQueryOccurrenceCount") &&
      appJs.includes("function lifecycleSearchOccurrenceSources") &&
      appJs.includes("function lifecycleOccurrenceMatches") &&
      appJs.includes("const rows = lifecycleOccurrenceMatches(matchedStages, normalizedQuery)") &&
      appJs.includes("stageId") &&
      appJs.includes("occurrenceIndex") &&
      appJs.includes("const matchSet = pageSearchMatchSet(scope, query)") &&
      appJs.includes("const rows = matchSet?.matches || []") &&
      appJs.includes('"data-lifecycle-target-ref"') &&
      appJs.includes('"data-lifecycle-id"') &&
      appJs.includes("targetId: nextMatch.targetRef || nextId") &&
      appJs.includes("lifecycleOccurrenceIndex") &&
      appJs.includes('const contentRoot = kind === "data" ? $("dataLifecycleMatrix") : $("devLifecycleLane")') &&
      lifecycleComponent.includes('data-lifecycle-kind="dev" data-lifecycle-id="${escapeHtml(row.stageId || "")}"') &&
      appJs.includes("state.selectedDevProcessId = nextId") &&
      appJs.includes("state.selectedDataProcessId = nextId"),
    message: "LC-AP and LC-DT previous/next navigation must count field-level occurrences, not only stage/page rows.",
  },
  {
    id: "global_search_has_result_panel",
    ok:
      appJs.includes("function runGlobalSearch()") &&
      appJs.includes("function renderGlobalSearchPanel()") &&
      appJs.includes("function buildGlobalSearchResults(query, limit = GLOBAL_SEARCH_RESULT_LIMIT)") &&
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
    id: "global_search_uses_lightweight_search_index",
    ok:
      appJs.includes("async function searchIndexResultsForQuery") &&
      appJs.includes("getSearchIndex") &&
      appJs.includes("mergeGlobalSearchResults(indexedResults, buildGlobalSearchResults(query, resultLimit), query, resultLimit)"),
    message: "global search must use the lightweight search index and only merge already-loaded page data.",
  },
  {
    id: "global_search_keyboard_shortcut_focuses_input",
    ok: appJs.includes('event.key.toLowerCase() !== "k"') && appJs.includes('const input = $("searchInput")') && appJs.includes("input?.focus()"),
    message: "global search keyboard shortcut must focus the top search input.",
  },
  {
    id: "global_search_has_result_page_route",
    ok:
      indexHtml.includes('id="searchWorkspace"') &&
      appShell.includes('"/search": { view: "search"') &&
      appShell.includes('search: "/search"') &&
      appJs.includes('if (state.activeView === "search") renderSearchPage();') &&
      appJs.includes('search: "searchWorkspace"') &&
      appJs.includes('function renderSearchPage()') &&
      appJs.includes("function openGlobalSearchPage") &&
      appJs.includes("globalSearchLoadedQuery") &&
      appJs.includes("globalSearchPageRequestSeq") &&
      appJs.includes("runGlobalSearchPage()") &&
      appJs.includes("data-search-page-jump") &&
      appJs.includes("data-search-page-result") &&
      !appJs.includes("data-search-page-open-result") &&
      appJs.includes("function globalSearchPageResultForKey") &&
      appJs.includes("activateGlobalSearchResult(result)") &&
      appJs.includes("openGlobalSearchPage(event.target.value)") &&
      stylesCss.includes(".global-search-filter-strip") &&
      stylesCss.includes(".global-search-pagination.is-top") &&
      !appJs.includes("每页 20 条，点击任一结果进入定位") &&
      !stylesCss.includes(".global-search-page-row-action"),
    message: "global search must expose an independent /search result page with route, workspace, compact filters, API-offset pagination, and direct result-row activation.",
  },
  {
    id: "global_search_page_state_isolated_from_preview",
    ok:
      appJs.includes("globalSearchRequestSeq: 0") &&
      appJs.includes("globalSearchPageRequestSeq: 0") &&
      appJs.includes("++state.globalSearchRequestSeq") &&
      appJs.includes("++state.globalSearchPageRequestSeq") &&
      appJs.includes("state.globalSearchPageLoading") &&
      appJs.includes("state.globalSearchPageResults") &&
      appJs.includes("globalSearchPageWindowMatches"),
    message: "global search preview and result page must not share request cancellation or loaded-window state.",
  },
  {
    id: "search_history_baseline_is_custom_and_domain_scoped",
    ok:
      appJs.includes("SEARCH_HISTORY_STORAGE_KEY") &&
      appJs.includes("SEARCH_HISTORY_MAX_ITEMS = 10") &&
      appJs.includes("SEARCH_HISTORY_COLLAPSED_ITEMS = 5") &&
      appJs.includes("data-search-history-clear") &&
      appJs.includes("data-search-history-remove") &&
      appJs.includes("data-search-history-expand") &&
      appJs.includes("#environmentSearchInput") &&
      indexHtml.includes("data-search-history-kind=\"global\"") &&
      indexHtml.includes("data-search-history-kind=\"capability\"") &&
      read("frontend/capability-browser/components/EnvironmentLocalRelationMap.js").includes('autocomplete="off" data-search-history-kind="environment"'),
    message: "global and local search memory must use one custom component baseline while keeping business-domain history scopes separate.",
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
    id: "global_search_results_prune_display_noise",
    ok:
      appJs.includes("function pruneGlobalSearchResultsForQuery") &&
      appJs.includes("function globalSearchVisibleDedupeKey") &&
      appJs.includes("function isLifecycleContainerSearchResult") &&
      appJs.includes("mergeGlobalSearchResults(indexedResults, buildGlobalSearchResults(query, resultLimit), query, resultLimit)") &&
      indexHtml.includes("global-search-result-prune-20260703-1"),
    message: "global search results must prune display duplicates and lifecycle parent fallback hits after API/fallback merge.",
  },
  {
    id: "global_search_activation_keeps_query_without_local_filtering",
    ok:
      appJs.includes("const activationQuery = searchTextForActivatedResult(result)") &&
      appJs.includes("return cleanGlobalSearchDisplayText(result.targetText || result.title || result.code || state.globalSearch);") &&
      appJs.includes("clearGlobalSearchPanel({ keepQuery: true })") &&
      appJs.includes("clearDestinationSearchForGlobalActivation(result.route)") &&
      appJs.includes("routeHasPageSearch(result.route)") &&
      (appJs.includes("queuePageSearchReveal(activationQuery)") ||
        appJs.includes("queuePageSearchReveal(activationQuery, searchScopeForCurrentState(), globalSearchPageRevealOptions(result))")) &&
      appJs.includes("flushPageSearchReveal();") &&
      !appJs.includes("setScopedSearch(activationQuery)") &&
      !appJs.includes("state.devLifecycleStageSearch = activationQuery") &&
      !appJs.includes("state.dataLifecycleStageSearch = activationQuery") &&
      !appJs.includes("if (activationQuery) state.globalSearch = activationQuery;"),
    message: "global search activation must keep the original query, clear destination local filters, and use targetText only for reveal/highlight.",
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
  {
    id: "page_search_has_match_navigation",
    ok:
      appJs.includes("pageSearchNavigation") &&
      appJs.includes("function pageSearchTargetElements") &&
      appJs.includes("function updatePageSearchControls") &&
      appJs.includes("function movePageSearchMatch") &&
      appJs.includes("function moveLifecyclePageSearchMatch") &&
      appJs.includes("function updateLifecyclePageSearchNavigation") &&
      appJs.includes("[data-page-search-step]") &&
      appJs.includes("pageSearchQueryForScope") &&
      appShell.includes('data-page-search-status="capability-mapping"') &&
      environmentLocalRelationMap.includes('data-page-search-status="environment-mapping"') &&
      indexHtml.includes('data-page-search-status="development-security"') &&
      indexHtml.includes('data-page-search-status="data-security"') &&
      stylesCss.includes(".page-search-match-status") &&
      stylesCss.includes(".page-search-step"),
    message: "page-level search boxes must expose match count and previous/next navigation within their own scope.",
  },
  {
    id: "capability_search_selects_direct_match",
    ok:
      appJs.includes("function resolveCapabilitySelection") &&
      appJs.includes("rowMatchesDirectly") &&
      appJs.includes("state.selectedCapabilityId = nextRow.id") &&
      appJs.includes("state.selectedCapabilityId !== previousSelectedCapabilityId"),
    message: "capability page search must move the selected object to a direct match instead of leaving stale detail content.",
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
