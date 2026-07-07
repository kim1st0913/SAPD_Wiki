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
  return source.slice(start, end > start ? end : start + 1800);
}

function argValue(name) {
  const index = process.argv.indexOf(name);
  if (index < 0) return "";
  return process.argv[index + 1] || "";
}

function facetCategoryCount(data, label) {
  const categories = Array.isArray(data?.facets?.categories) ? data.facets.categories : [];
  const matched = categories.find((row) => row?.label === label);
  return Number(matched?.count || 0);
}

const appJs = read("frontend/capability-browser/app.js");
const dataClientJs = read("frontend/capability-browser/dataClient.js");
const indexHtml = read("frontend/capability-browser/index.html");
const stylesCss = read("frontend/capability-browser/styles.css");
const focusScopeServiceMatrixJs = read("frontend/capability-browser/components/FocusScopeServiceMatrix.js");
const technicalServiceMaintenanceTableJs = read("frontend/capability-browser/components/TechnicalServiceMaintenanceTable.js");
const applicationSecurityLifecycleJs = read("frontend/capability-browser/components/ApplicationSecurityLifecycle.js");
const standardFrameworkTableJs = read("frontend/capability-browser/components/StandardFrameworkTable.js");
const apiServerPy = read("src/sapd_wiki/api_server.py");
const globalSearchContract = read("docs/06-implementation/global-search-contract-2026-07-05.md");
const apiAddSearchItem = snippet(apiServerPy, "def _add_search_item(", "def _add_navigation_search_items");
const apiCapabilityRelation = snippet(apiServerPy, "def add_capability_relation_item(", "for service_id, focus_ids");
const appCapabilityRelation = snippet(appJs, "const pushCapabilityRelation =", "for (const [serviceId, focusIds]");
const apiMaintenance = snippet(apiServerPy, "def _add_maintenance_search_items(", "def _add_environment_search_items");
const appMaintenance = snippet(appJs, "function flattenMaintenanceSearchItems(", "function flattenLifecycleSearchItems");

const ensurePackages = snippet(appJs, "async function ensureGlobalSearchPackages()", "async function ensureGlobalSearchStandardDetails()");
const ensureStandards = snippet(appJs, "async function ensureGlobalSearchStandardDetails()", "function buildGlobalSearchResults(query)");
const runGlobalSearch = snippet(appJs, "async function runGlobalSearch()", "function clearGlobalSearchPanel");
const searchPageClick = snippet(appJs, 'const submit = event.target.closest("[data-search-page-submit]")', '$("capabilitySearchInput")');

const checks = [
  {
    id: "api_route_exists",
    ok: apiServerPy.includes('path == "/api/v1/search-index"') && apiServerPy.includes("search_index_payload("),
    message: "api_server.py must expose /api/v1/search-index.",
  },
  {
    id: "api_index_uses_runtime_cache",
    ok: apiServerPy.includes("_SEARCH_INDEX_CACHE") && apiServerPy.includes("_search_source_signature"),
    message: "search index must use a runtime cache keyed by source package mtimes/sizes.",
  },
  {
    id: "api_index_cleans_internal_display_ids",
    ok:
      apiServerPy.includes("def _clean_search_display_text") &&
      apiServerPy.includes("def _is_internal_search_code") &&
      apiServerPy.includes("_INTERNAL_SEARCH_TITLE_PREFIX_RE") &&
      apiServerPy.includes('"code": normalized_code') &&
      apiServerPy.includes('"title": display_title'),
    message: "search index must keep internal object IDs for targeting but remove them from user-facing titles/codes.",
  },
  {
    id: "api_index_routes_module_and_measure_tabs",
    ok:
      apiServerPy.includes('"/knowledge/technical-modules"') &&
      apiServerPy.includes('"/knowledge/technical-measures"') &&
      appJs.includes('route: "/knowledge/technical-modules"') &&
      appJs.includes('route: "/knowledge/technical-measures"'),
    message: "search index must route security modules and measures to their concrete maintenance tabs for reliable reveal.",
  },
  {
    id: "frontend_fallback_dictionary_results_have_stable_target_ref",
    ok:
      appJs.includes('objectType: "security_technology_module"') &&
      appJs.includes('objectType: "security_technical_measure"') &&
      appJs.includes("function maintenanceSearchTargetRef") &&
      appMaintenance.includes("targetRef: maintenanceSearchTargetRef(objectType, id)") &&
      appMaintenance.includes("objectType,") &&
      appMaintenance.includes("objectId: id"),
    message: "frontend fallback maintenance search results must carry objectType/objectId/targetRef so activation reveals the exact row instead of only opening a tab.",
  },
  {
    id: "api_index_routes_gbt_reference_tab",
    ok:
      apiServerPy.includes('"gbt_42446_references", "GB/T 42446 任务", "/standards/workforce-reference"') &&
      apiServerPy.includes('"gartner_roles", "Gartner 岗位参考", "/standards/workforce-reference"') &&
      !apiServerPy.includes('"gbt_42446_references", "GB/T 42446 任务", "/knowledge/role-references"') &&
      appJs.includes('route: "/standards/workforce-reference"') &&
      appJs.includes('normalized.standardFramework = "workforce-reference-standards"') &&
      appJs.includes('normalized.standardTableId = "gbt-42446-classification"') &&
      appJs.includes('normalized.standardTableId = "gartner-work-roles"'),
    message: "GB/T 42446 and Gartner search results must open the Workforce reference standards page.",
  },
  {
    id: "api_index_covers_lifecycle_detail_cells",
    ok:
      apiServerPy.includes('read_data_package("lifecycle")') &&
      apiServerPy.includes('"development_technical_modules", "development_technical_module", "开发技术模块"') &&
      apiServerPy.includes('"development_technical_services", "development_technical_service", "开发技术服务"') &&
      apiServerPy.includes('"technical_services", "security_technical_service", "安全技术服务"') &&
      apiServerPy.includes('"technology_modules", "security_technology_module", "安全技术模块"') &&
      apiServerPy.includes('"technical_measures", "security_technical_measure", "安全技术措施"') &&
      apiServerPy.includes('target_ref=f"{object_type}:{process_id}:{child_id}"') &&
      apiServerPy.includes("object_id=process_id"),
    message: "search index must include lifecycle process detail cells and route them to their owning LC stage/process.",
  },
  {
    id: "api_index_covers_lcdt_policy_matrix_rows",
    ok:
      apiServerPy.includes('process.get("data_policy_rows")') &&
      apiServerPy.includes('target_ref=f"lifecycle_policy_row:{process_id}:{row_id}"') &&
      apiServerPy.includes('target_ref=f"lifecycle_policy_relation:{relation_type}:{process_id}:{row_id}:{child_id}"') &&
      apiServerPy.includes('"selected_process_id": process_id') &&
      apiServerPy.includes('type_label="数据重要程度安全策略矩阵"') &&
      apiServerPy.includes('"LC-DT 矩阵安全技术模块"'),
    message: "global search must index LC-DT data policy matrix rows and row-level service/module targets, not only lifecycle stages.",
  },
  {
    id: "api_index_has_business_coverage_aliases",
    ok:
      apiServerPy.includes("_SEARCH_QUERY_ALIASES") &&
      apiServerPy.includes("GB/T 42446-2023") &&
      apiServerPy.includes("Gartner 工作岗位参考") &&
      apiServerPy.includes("ArchiMate 3.2") &&
      apiServerPy.includes("_identity_search") &&
      apiServerPy.includes("_content_search") &&
      apiServerPy.includes("_context_search"),
    message: "search index must include user-facing business aliases and type labels, not only object titles.",
  },
  {
    id: "api_index_separates_identity_content_and_context_channels",
    ok:
      apiServerPy.includes("def _search_match_details") &&
      apiServerPy.includes("identity = str(item.get(\"_identity_search\")") &&
      apiServerPy.includes("content = str(item.get(\"_content_search\")") &&
      apiServerPy.includes("context = str(item.get(\"_context_search\")") &&
      apiServerPy.includes("if normalized_query and any(_search_is_identity_match(row) for row in rows):") &&
      apiServerPy.includes("rows = [row for row in rows if not _search_is_weak_match(row)]"),
    message: "global search must separate identity/content/context match channels and prune weak full-text/context matches when identity matches exist.",
  },
  {
    id: "api_index_reads_wrapped_technical_services",
    ok:
      apiServerPy.includes('field == "security_technical_services"') &&
      apiServerPy.includes('item.get("service")') &&
      apiServerPy.includes("_SEARCH_BUSINESS_ALIASES_BY_CODE") &&
      !apiServerPy.includes('"I-AP&T-PD.DP-01": "应用页面水印"') &&
      !apiServerPy.includes('"I-DI&T-PD.DP-01": "应用页面水印"') &&
      !apiServerPy.includes('"应用页面水印": "数据内容水印"') &&
      !appJs.includes('"I-AP&T-PD.DP-01": "应用页面水印"') &&
      !appJs.includes('应用页面水印: ["数据内容水印"]') &&
      appJs.includes("GLOBAL_SEARCH_BUSINESS_ALIASES_BY_CODE") &&
      appJs.includes('section.key === "security_technical_services" && item?.service'),
    message: "search index must read wrapped maintenance service rows through real service.code/title without carrying watermark search aliases.",
  },
  {
    id: "api_index_covers_environment_relation_nodes",
    ok:
      apiServerPy.includes('workbench.get("environment_scope_tree")') &&
      apiServerPy.includes('relation_type="security_technical_service"') &&
      apiServerPy.includes('relation_type="security_technology_module"') &&
      apiServerPy.includes('relation_type="security_technical_measure"') &&
      apiServerPy.includes('relation_type="security_system"') &&
      apiServerPy.includes('object_type="information_object"') &&
      apiServerPy.includes('"selected_environment_id"') &&
      apiServerPy.includes('"selected_environment_segment_id"') &&
      apiServerPy.includes('"selected_environment_object_id"') &&
      appJs.includes("pushRelation(service, \"环境安全技术服务\"") &&
      appJs.includes("selectedEnvironmentObjectId: objectId") &&
      appJs.includes("function environmentSelectionForObjectId") &&
      appJs.includes("function environmentSearchValueTargetElement"),
    message: "global search must index environment relation nodes and route them to their owning information object.",
  },
  {
    id: "environment_non_service_relation_search_does_not_inherit_service_terms",
    ok:
      apiAddSearchItem.includes("search_subtitle: bool = True") &&
      apiAddSearchItem.includes('subtitle if search_subtitle else ""') &&
      apiServerPy.includes('search_text=_search_compact(item.get("description"), item.get("category"))') &&
      apiServerPy.includes("search_subtitle=False") &&
      appJs.includes("searchText: compactSearchText(code, title, businessSearchAliasesForCode(code), item.description, item.category)"),
    message: "environment relation search rows must use display subtitles only for context; relation matching must come from the title object itself.",
  },
  {
    id: "capability_relation_search_does_not_inherit_focus_terms",
    ok:
      apiCapabilityRelation.includes('search_text=_search_compact(item.get("description"), item.get("summary"))') &&
      apiCapabilityRelation.includes("search_subtitle=False") &&
      !apiCapabilityRelation.includes('search_text=_search_compact(item.get("description"), item.get("summary"), focus, trail)') &&
      appCapabilityRelation.includes("searchText: compactSearchText(code, title, item.description, item.summary, globalSearchBusinessAliasesForCode(code))") &&
      !appCapabilityRelation.includes("item.description, item.summary, trail"),
    message: "capability relation rows must not inherit parent capability/focus terms such as 密码 into child service/module/measure search text.",
  },
  {
    id: "maintenance_catalog_search_does_not_inherit_related_objects",
    ok:
      apiMaintenance.includes('search_text=_search_compact(entity.get("description"), entity.get("summary"), entity.get("definition"))') &&
      !apiMaintenance.includes('item.get("modules"), item.get("systems"), item.get("products"), item.get("environments")') &&
      appMaintenance.includes("searchText: compactSearchText(code, title, businessSearchAliasesForCode(code), entity.description, entity.definition, entity.summary)") &&
      !appMaintenance.includes("item.modules, item.systems, item.products, item.environments"),
    message: "maintenance catalog rows must not be searchable through related modules/systems/products/environments; related objects belong in context views, not main result matching.",
  },
  {
    id: "api_index_covers_capability_relation_nodes",
    ok:
      apiServerPy.includes('read_data_package("capability-workbench")') &&
      apiServerPy.includes('"capability-workbench"') &&
      apiServerPy.includes('relation_type == "supports_focus"') &&
      apiServerPy.includes('relation_type == "implemented_by_module"') &&
      apiServerPy.includes('relation_type == "has_measure"') &&
      apiServerPy.includes('"selected_capability_id"') &&
      apiServerPy.includes('target_ref=f"capability_relation:{relation_type}:{focus_id}:{item_id}"') &&
      appJs.includes("function capabilitySearchValueTargetElement") &&
      appJs.includes("selected_capability_id") &&
      appJs.includes("capability_relation:") &&
      appJs.includes("flattenCapabilitySearchItems(state.capability, state.capabilityWorkbench)"),
    message: "global search must index capability relation nodes and route them to their owning focus without using aliases.",
  },
  {
    id: "management_service_exact_code_keeps_dictionary_and_capability_targets",
    ok:
      !apiServerPy.includes("def _prefer_capability_relation_search_results") &&
      !appJs.includes("function preferCapabilityRelationSearchResults") &&
      apiServerPy.includes('"/knowledge/technical-services", "security_technical_service"') &&
      apiServerPy.includes('target_ref=f"capability_relation:{relation_type}:{focus_id}:{item_id}"') &&
      appJs.includes("capability_relation:${relationType}") &&
      appJs.includes('relationType: "security_technical_service"'),
    message: "source-defined M-* -00 exact-code search must keep both the dictionary definition target and the capability relation target.",
  },
  {
    id: "capability_relation_search_targets_technical_table_anchor",
    ok:
      appJs.includes("function capabilityRelationTabForSearchResult") &&
      appJs.includes('return "technical"') &&
      appJs.includes("state.activeCapabilityRelationTab = capabilityRelationTab") &&
      appJs.includes("state.lastCapabilityRelationSelectionId = result.selectedCapabilityId") &&
      appJs.includes("data-capability-relation-target-ref") &&
      focusScopeServiceMatrixJs.includes("function capabilityRelationAnchorAttrs") &&
      focusScopeServiceMatrixJs.includes("capability_relation:${relationType}:${focusId}:${objectId}") &&
      focusScopeServiceMatrixJs.includes('relationType: "security_technical_service"') &&
      indexHtml.includes("oi188-relation-target-anchor-20260706-1"),
    message: "capability_relation search results must open the matching relation tab and reveal a table chip by target_ref, not a graph/text fallback.",
  },
  {
    id: "lcdt_policy_matrix_search_targets_exact_anchor",
    ok:
      applicationSecurityLifecycleJs.includes("function dataPolicyRowTargetRef") &&
      applicationSecurityLifecycleJs.includes("function dataPolicyRelationTargetRef") &&
      applicationSecurityLifecycleJs.includes("data-lifecycle-target-ref") &&
      appJs.includes("function findLifecycleSearchTargetByRef") &&
      appJs.includes('"data-lifecycle-target-ref"') &&
      appJs.includes("function lifecycleDataPolicyOccurrenceMatches") &&
      appJs.includes("lifecycle_policy_relation:${relationType}") &&
      indexHtml.includes("oi189-lcdt-policy-anchor-20260706-1"),
    message: "LC-DT policy matrix search must reveal exact row/chip anchors by target_ref for local and global search.",
  },
  {
    id: "technical_service_dictionary_search_reveals_selected_row",
    ok:
      technicalServiceMaintenanceTableJs.includes("groupHasSelectedService") &&
      technicalServiceMaintenanceTableJs.includes("groupHasSelectedService || expandAll") &&
      technicalServiceMaintenanceTableJs.includes("if (!selectedId) scheduleScrollRestore()") &&
      indexHtml.includes("oi188-selected-row-expand-20260706-1"),
    message: "technical service dictionary search activation must expand the selected service group and avoid restoring stale scroll over the selected row.",
  },
  {
    id: "capability_tree_search_uses_own_fields_not_parent_trail",
    ok:
      apiServerPy.includes("search_subtitle=False") &&
      appJs.includes("searchText: compactSearchText(code, title, item.description)") &&
      !appJs.includes("searchText: compactSearchText(code, title, item.description, trail)"),
    message: "capability tree rows must not be searchable only through parent trail labels.",
  },
  {
    id: "frontend_environment_global_search_reveals_catalog",
    ok:
      appJs.includes("function revealEnvironmentCatalogSelection") &&
      appJs.includes('const root = $("environmentTree")') &&
      appJs.includes('"data-environment-object-id"') &&
      appJs.includes("state.environmentCatalogCollapsed = false") &&
      appJs.includes("revealEnvironmentCatalogSelection(result)") &&
      appJs.indexOf("revealEnvironmentCatalogSelection(result)") > appJs.indexOf("renderEnvironment();"),
    message: "environment global-search activation must scroll the left catalog selection as well as the right-side relation node.",
  },
  {
    id: "api_index_supports_light_fuzzy_matching",
    ok:
      apiServerPy.includes("def _search_query_variants") &&
      apiServerPy.includes("def _search_plain") &&
      apiServerPy.includes("def _search_damerau_distance_at_most_one") &&
      apiServerPy.includes("def _search_fuzzy_token_match") &&
      apiServerPy.includes("_search_fuzzy_token_match(variants[0], title, code, target_text, identity)"),
    message: "search index must support controlled normalization and light fuzzy matching for codes, aliases, and common typos.",
  },
  {
    id: "frontend_fallback_separates_identity_content_and_context_channels",
    ok:
      appJs.includes("function globalSearchMatchDetails") &&
      appJs.includes("matchKind: \"content_contains\"") &&
      appJs.includes("function isGlobalSearchIdentityMatch") &&
      appJs.includes("function isGlobalSearchWeakMatch") &&
      appJs.includes("rows.some(isGlobalSearchIdentityMatch)") &&
      appJs.includes("rows.filter(isGlobalSearchWeakMatch).forEach((row) => dropRows.add(row))"),
    message: "frontend fallback global search must mirror backend identity-first relevance pruning.",
  },
  {
    id: "api_index_returns_match_context",
    ok:
      apiServerPy.includes("def _search_match_context") &&
      apiServerPy.includes('public_item["match_context"] = match_context') &&
      appJs.includes("matchContext: displayResult.matchContext") &&
      appJs.includes("result.matchContext || result.match_context"),
    message: "search index results must expose a bounded user-facing match context for result snippets.",
  },
  {
    id: "frontend_search_result_semantic_dedupe",
    ok:
      appJs.includes("function globalSearchResultDedupKey") &&
      appJs.includes("function globalSearchSemanticTargetKey") &&
      appJs.includes("const semanticKey = globalSearchSemanticTargetKey(result)") &&
      appJs.includes("const [targetType, ...targetParts] = targetRef.split(\":\")") &&
      appJs.indexOf("if (semanticKey) return semanticKey;") > appJs.indexOf("const semanticKey = globalSearchSemanticTargetKey(result)") &&
      appJs.indexOf('return ["visible", type, route, title, subtitle]') > appJs.indexOf("if (semanticKey) return semanticKey;") &&
      appJs.includes("const key = globalSearchResultDedupKey(displayResult)") &&
      appJs.includes("selectedMaintenanceId") &&
      appJs.includes("selectedCapabilityId") &&
      appJs.includes("targetRef") &&
      appJs.includes("objectType") &&
      appJs.includes("objectId"),
    message: "frontend search result merge must dedupe API and fallback rows by stable semantic target before visible path text.",
  },
  {
    id: "frontend_search_result_noise_pruning",
    ok:
      appJs.includes("function pruneGlobalSearchResultsForQuery") &&
      appJs.includes("function globalSearchVisibleDedupeKey") &&
      appJs.includes("function isLifecycleContainerSearchResult") &&
      appJs.includes("function isLifecycleNonContextResult") &&
      appJs.includes("chooseMoreSpecificGlobalSearchResult") &&
      appJs.includes("exactLifecycleRoutes.has(route)") &&
      appJs.includes("isLifecycleNonContextResult(result)") &&
      appJs.includes("mergeGlobalSearchResults(indexedResults, buildGlobalSearchResults(query, resultLimit), query, resultLimit)") &&
      indexHtml.includes("global-search-result-prune-20260703-1") &&
      indexHtml.includes("oi154-page-search-nav-20260703-1"),
    message: "frontend search result merge must prune display duplicates and lifecycle parent-container hits after API/fallback merge.",
  },
  {
    id: "frontend_search_results_show_context",
    ok:
      appJs.includes("function globalSearchResultMetaLine") &&
      appJs.includes("function globalSearchResultSnippetLabel") &&
      appJs.includes("function highlightSearchText") &&
      appJs.includes("命中：") &&
      appJs.includes("globalSearchResultMetaLine(result)") &&
      appJs.includes("globalSearchResultSnippetLabel(result, query)") &&
      appJs.includes("highlightSearchText(globalSearchResultSnippetLabel(result, query), query)") &&
      stylesCss.includes(".global-search-snippet-mark"),
    message: "global search result rows must show route/type context, the matched snippet, and a visible query highlight.",
  },
  {
    id: "frontend_global_search_panel_shows_context_preview",
    ok:
      appJs.includes("const metaLine = globalSearchResultMetaLine(result)") &&
      appJs.includes("const snippet = globalSearchResultSnippetLabel(result, query)") &&
      appJs.includes("<em>${highlightSearchText(snippet, query)}</em>") &&
      stylesCss.includes(".global-search-result-main em"),
    message: "global search preview panel must include result context and highlighted snippet, not only title/subtitle.",
  },
  {
    id: "api_index_does_not_build_standards_full_compat",
    ok: !snippet(apiServerPy, "def _add_standard_search_items", "def _add_content_search_items").includes('read_data_package("standards")'),
    message: "search index must use standards-index, not standards full compat with all detail tables.",
  },
  {
    id: "global_search_indexes_standard_detail_rows",
    ok:
      apiServerPy.includes("STANDARD_SEARCH_CODE_FIELDS") &&
      apiServerPy.includes('"Safeguard ID"') &&
      apiServerPy.includes('"SCF编号"') &&
      apiServerPy.includes('"保障措施描述"') &&
      apiServerPy.includes('"SCF控制项"') &&
      apiServerPy.includes("def _standard_detail_payloads") &&
      apiServerPy.includes('object_type="standard_control"') &&
      apiServerPy.includes("def _dedupe_search_results") &&
      apiServerPy.includes("def _spread_standard_search_results") &&
      apiServerPy.includes('"standardFramework": framework_id') &&
      apiServerPy.includes('"standardTableId": table_id') &&
      apiServerPy.includes('"selectedMaintenanceId": row_id') &&
      appJs.includes('values?.["Safeguard ID"]') &&
      appJs.includes('values?.["SCF编号"]') &&
      appJs.includes('objectType === "standard_control"') &&
      appJs.includes('targetRef.startsWith("standard_control:")') &&
      appJs.includes("function standardSearchTargetElement") &&
      standardFrameworkTableJs.includes("selectedRowIncludedFromOverflow") &&
      standardFrameworkTableJs.includes("data-standard-target-ref") &&
      standardFrameworkTableJs.includes("data-standard-row-code") &&
      standardFrameworkTableJs.includes("standard_control:${activeFrameworkId}:${tableId}:${rowId}"),
    message: "global search must index standards/framework detail rows and carry row-level reveal fields.",
  },
  {
    id: "global_search_standard_results_reveal_exact_row",
    ok:
      appJs.includes("function globalSearchPageRevealOptions") &&
      appJs.includes('targetAttribute: "data-standard-row-id"') &&
      appJs.includes("queuePageSearchReveal(activationQuery, searchScopeForCurrentState(), globalSearchPageRevealOptions(result))") &&
      snippet(appJs, "function renderMaintenance()", "function maintenanceHeaderSummary").includes("flushPageSearchReveal();") &&
      standardFrameworkTableJs.includes('tableId: activeTableId || activeFrameworkId || "standard"'),
    message: "standard/framework search activation must carry exact row reveal options and flush after lazy table rendering instead of falling back to text-only positioning.",
  },
  {
    id: "global_search_frontend_standard_fallback_uses_api_identity",
    ok:
      appJs.includes("standardTableId: tableId || frameworkId") &&
      appJs.includes("targetRef: `standard_control:${frameworkId}:${tableId || frameworkId}:${id}`") &&
      appJs.includes('objectType: "standard_control", objectId: id') &&
      appJs.includes("mergeGlobalSearchResults(indexedResults, buildGlobalSearchResults(query, resultLimit), query, resultLimit)"),
    message: "frontend fallback standard-control results must use the same standard_control target_ref/object identity as the API index so fallback rows dedupe with API rows instead of creating a second SCF-home result.",
  },
  {
    id: "global_search_panel_result_pointerdown_activation",
    ok:
      appJs.includes('document.addEventListener("pointerdown"') &&
      appJs.includes('event.target.closest("[data-global-search-result]")') &&
      appJs.includes("activateGlobalSearchResult(result)") &&
      appJs.includes('const resultButton = event.target.closest("[data-global-search-result]")'),
    message: "topbar global search results must activate on pointerdown before focus/overlay teardown can clear the result payload.",
  },
  {
    id: "global_search_counts_use_facets_not_result_window",
    ok:
      apiServerPy.includes("def _search_result_facets") &&
      apiServerPy.includes('"facets": facets') &&
      apiServerPy.includes('"by_category": facets["by_category"]') &&
      appJs.includes("globalSearchResultStats") &&
      appJs.includes("function normalizeGlobalSearchStats") &&
      appJs.includes("GLOBAL_SEARCH_PAGE_RESULT_LIMIT = 120") &&
      appJs.includes("globalSearchCategoryCount(resultStats, state.globalSearchPageFilter") &&
      appJs.includes("const activeTotal = hasQuery ? globalSearchCategoryCount") &&
      globalSearchContract.includes("全量命中计数") &&
      globalSearchContract.includes("当前返回 / 展示窗口") &&
      globalSearchContract.includes("facets.categories"),
    message: "global search counts must come from API facets, not from the current returned result window.",
  },
  {
    id: "global_search_result_page_pagination_and_sticky_context",
    ok:
      appJs.includes("GLOBAL_SEARCH_PAGE_SIZE = 20") &&
      appJs.includes("globalSearchPageIndex") &&
      appJs.includes("globalSearchPageRequestSeq") &&
      appJs.includes("async function runGlobalSearchPage") &&
      appJs.includes("const offset = (pageIndex - 1) * GLOBAL_SEARCH_PAGE_SIZE") &&
      appJs.includes("searchIndexPayloadForQuery(query, GLOBAL_SEARCH_PAGE_SIZE, { offset, category })") &&
      apiServerPy.includes("def search_index_payload(query: str = \"\", limit: int = 80, offset: int = 0, category: str = \"\")") &&
      apiServerPy.includes("window_rows[safe_offset:safe_offset + safe_limit]") &&
      apiServerPy.includes('"window": {') &&
      dataClientJs.includes("queryParams.set(\"offset\", String(offset))") &&
      dataClientJs.includes("queryParams.set(\"category\", category)") &&
      appJs.includes("function renderGlobalSearchPagination") &&
      appJs.includes("data-search-page-page") &&
      appJs.includes("data-search-page-jump") &&
      appJs.includes("state.globalSearchPageIndex = 1") &&
      stylesCss.includes(".global-search-page-sticky") &&
      stylesCss.includes("position: sticky") &&
      stylesCss.includes(".global-search-pagination") &&
      stylesCss.includes(".global-search-pagination.is-top") &&
      stylesCss.includes(".global-search-pagination-jump") &&
      indexHtml.includes("oi181-search-results-memory-offset-20260705-1") &&
      globalSearchContract.includes("每页 `20` 条分页展示") &&
      globalSearchContract.includes("sticky 固定上下文栏"),
    message: "global search result page must paginate by API offset windows, expose top/bottom pagination and jump-to-page, and keep query/facet context sticky without changing search rules.",
  },
  {
    id: "global_search_page_history_and_preview_are_isolated",
    ok:
      appJs.includes("globalSearchPageRequestSeq") &&
      appJs.includes("++state.globalSearchPageRequestSeq") &&
      appJs.includes("++state.globalSearchRequestSeq") &&
      appJs.includes("searchHistoryKindForInput") &&
      appJs.includes("SEARCH_HISTORY_MAX_ITEMS = 10") &&
      appJs.includes("SEARCH_HISTORY_COLLAPSED_ITEMS = 5") &&
      appJs.includes("data-search-history-clear") &&
      appJs.includes("data-search-history-remove") &&
      appJs.includes("data-search-history-expand") &&
      appJs.includes("id=\"searchPageQueryInput\"") &&
      indexHtml.includes("data-search-history-kind=\"global\"") &&
      globalSearchContract.includes("预览面板和结果页搜索请求必须使用独立加载状态"),
    message: "global search preview, search page loading, and custom search-history memory must be isolated and explicitly controlled.",
  },
  {
    id: "global_search_history_commits_loaded_queries_immediately",
    ok:
      appJs.includes("function rememberCommittedSearchQuery") &&
      appJs.includes("function commitLoadedSearchHistoryForInput") &&
      appJs.includes("function globalSearchQueryHasLoaded") &&
      appJs.includes("rememberCommittedSearchQuery(\"global\", query)") &&
      appJs.includes("refreshSearchHistoryPanelForKind(targetKind)") &&
      appJs.includes("clearSearchHistoryCommitTimersForKind(targetKind)") &&
      globalSearchContract.includes("已经执行并完成加载的查询必须立即进入搜索历史") &&
      globalSearchContract.includes("不得只依赖输入防抖"),
    message: "executed global-search queries must be committed to custom history immediately and refresh an open history panel.",
  },
  {
    id: "global_search_pagination_controls_keep_text_width",
    ok:
      appJs.includes("global-search-pagination-button is-boundary") &&
      stylesCss.includes(".global-search-pagination-button.is-boundary") &&
      stylesCss.includes(".global-search-page-results > .pane-head .global-search-pagination-button") &&
      stylesCss.includes("white-space: nowrap") &&
      globalSearchContract.includes("文字命令按钮") &&
      globalSearchContract.includes("不得继承 30px 图标按钮宽度"),
    message: "search pagination prev/next controls must keep stable text-button width inside pane headers.",
  },
  {
    id: "local_search_history_scopes_are_domain_specific",
    ok:
      appJs.includes("SEARCH_HISTORY_INPUT_SELECTOR") &&
      appJs.includes("function searchHistoryKindForInput") &&
      appJs.includes("function sourceSearchHistoryKind") &&
      appJs.includes('capability: "安全能力页搜索记录"') &&
      appJs.includes('environment: "信息化环境页搜索记录"') &&
      appJs.includes('"lc-ap": "LC-AP 页搜索记录"') &&
      appJs.includes('"lc-dt": "LC-DT 页搜索记录"') &&
      appJs.includes('knowledge: "知识库页搜索记录"') &&
      appJs.includes('standards: "标准 / 框架页搜索记录"') &&
      appJs.includes('"workbench-issues": "Issue 筛选记录"') &&
      appJs.includes("#environmentSearchInput") &&
      appJs.includes("#devLifecycleStageSearch") &&
      appJs.includes("#dataLifecycleStageSearch") &&
      appJs.includes("#sourceSearchInput") &&
      appJs.includes("#workbenchIssueSearchInput") &&
      appJs.includes('id="workbenchIssueSearchInput"') &&
      appJs.includes('autocomplete="off" data-search-history-kind="workbench-issues" data-review-filter-control="search"') &&
      appJs.includes("scheduleSearchHistoryCommit(event.target, event.target.value)") &&
      appJs.includes("scheduleSearchHistoryCommit(filterControl, filterControl.value)") &&
      indexHtml.includes('data-search-history-kind="capability"') &&
      indexHtml.includes('data-search-history-kind="lc-ap"') &&
      indexHtml.includes('data-search-history-kind="lc-dt"') &&
      read("frontend/capability-browser/components/EnvironmentLocalRelationMap.js").includes('autocomplete="off" data-search-history-kind="environment"') &&
      globalSearchContract.includes("按业务域隔离") &&
      globalSearchContract.includes("工作台 Issue 使用 `workbench-issues`"),
    message: "local page-search inputs must disable native browser autocomplete while keeping custom history scoped by business domain.",
  },
  {
    id: "search_index_quality_probe_audit_exists",
    ok:
      fs.existsSync(path.join(ROOT, "scripts/audit_search_index_quality_probes.py")) &&
      read("scripts/audit_search_index_quality_probes.py").includes("SEARCH_INDEX_COVERAGE_MATRIX") &&
      read("scripts/audit_search_index_quality_probes.py").includes("coverage_{slug}_click_locator") &&
      read("scripts/audit_search_index_quality_probes.py").includes("coverage_{slug}_counterexample") &&
      globalSearchContract.includes("python3 scripts/audit_search_index_quality_probes.py"),
    message: "global search must have a semantic quality probe audit for domain coverage, click locators, counterexamples, windowing, weak-hit pruning, and field boundaries.",
  },
  {
    id: "data_client_search_index_method",
    ok: dataClientJs.includes('searchIndex: "/api/v1/search-index"') && dataClientJs.includes("async getSearchIndex(params = {})"),
    message: "dataClient must expose getSearchIndex() against /api/v1/search-index.",
  },
  {
    id: "global_search_uses_index",
    ok:
      appJs.includes("function normalizeGlobalSearchIndexResult") &&
      appJs.includes("function searchIndexPayloadFromEnvelope") &&
      appJs.includes("async function searchIndexPayloadForQuery") &&
      appJs.includes("async function searchIndexResultsForQuery") &&
      runGlobalSearch.includes("searchIndexPayloadForQuery(query, resultLimit)") &&
      runGlobalSearch.includes("const indexedResults = indexedPayload.results"),
    message: "runGlobalSearch must query the lightweight search index before rendering results.",
  },
  {
    id: "frontend_unwraps_search_index_envelope",
    ok:
      appJs.includes("function searchIndexPayloadFromEnvelope") &&
      appJs.includes("secondLayer?.data") &&
      appJs.includes("Array.isArray(secondLayer.data.results)") &&
      appJs.includes("const payload = searchIndexPayloadFromEnvelope(envelope)"),
    message: "frontend search page must unwrap both API and dataClient envelopes before reading results.",
  },
  {
    id: "global_search_no_full_package_preload",
    ok:
      !ensurePackages.includes("loadDataPackage(") &&
      !ensurePackages.includes("Promise.all") &&
      !ensurePackages.includes("environmentWorkbench") &&
      !ensurePackages.includes("maintenanceKnowledge") &&
      !ensurePackages.includes("capabilityWorkbench") &&
      !ensureStandards.includes("getStandardFramework") &&
      !ensureStandards.includes("loadDataPackage("),
    message: "global search input stage must not preload full workbench, maintenance, environment, or standards detail packages.",
  },
  {
    id: "global_search_keeps_loaded_fallback",
    ok: runGlobalSearch.includes("mergeGlobalSearchResults(indexedResults, buildGlobalSearchResults(query, resultLimit), query, resultLimit)"),
    message: "global search should keep current loaded-data fallback while using search index first.",
  },
  {
    id: "global_search_result_page_uses_same_index_flow",
    ok:
      appJs.includes("function renderSearchPage()") &&
      appJs.includes("runGlobalSearchPage()") &&
      appJs.includes("globalSearchPageWindowMatches") &&
      appJs.includes("state.globalSearchPageLoading") &&
      appJs.includes("function openGlobalSearchPage") &&
      indexHtml.includes('id="searchWorkspace"'),
    message: "global search result page must use its own page-window loader without triggering full package preloads or cancelling preview search.",
  },
  {
    id: "global_search_result_row_direct_activation",
    ok:
      appJs.includes("function globalSearchPageResultForKey") &&
      appJs.includes("data-search-page-result") &&
      appJs.includes("const result = globalSearchPageResultForKey(row.dataset.searchPageResult)") &&
      appJs.includes("activateGlobalSearchResult(result)") &&
      !appJs.includes("每页 20 条，点击任一结果进入定位") &&
      !appJs.includes("data-search-page-open-result") &&
      !appJs.includes("打开定位") &&
      !stylesCss.includes(".global-search-page-row-action"),
    message: "search result page rows must be the only visible activation target and the old explanatory header text must not return.",
  },
  {
    id: "global_search_page_clicks_capture_before_shell_handlers",
    ok:
      searchPageClick.includes("event.preventDefault();") &&
      searchPageClick.includes("event.stopPropagation();") &&
      searchPageClick.includes("const row = event.target.closest(\"[data-search-page-result]\")") &&
      searchPageClick.includes("const result = globalSearchPageResultForKey(row.dataset.searchPageResult)") &&
      searchPageClick.includes("activateGlobalSearchResult(result)") &&
      searchPageClick.includes("}, true);"),
    message: "search result page row clicks must run in capture phase before global shell click handlers can swallow them.",
  },
  {
    id: "global_search_page_uses_compact_apple_queue",
    ok:
      stylesCss.includes("width: min(1180px, 100%);") &&
      stylesCss.includes(".global-search-page-row::after") &&
      stylesCss.includes("grid-template-columns: 96px minmax(0, 1fr) 24px") &&
      stylesCss.includes("linear-gradient(180deg") &&
      stylesCss.includes("rgba(247, 250, 254, 0.92)"),
    message: "search result page should use the compact Apple shell single-action result queue layout.",
  },
  {
    id: "global_search_low_hit_page_uses_compact_density",
    ok:
      appJs.includes("const compactPage = hasQuery && !isLoading && activeTotal > 0 && activeTotal <= 3") &&
      appJs.includes('global-search-page ${compactPage ? "is-compact" : ""}') &&
      stylesCss.includes(".global-search-page.is-compact") &&
      stylesCss.includes(".global-search-page.is-compact .global-search-page-toolbar") &&
      stylesCss.includes(".global-search-page.is-compact .global-search-page-results"),
    message: "low-hit global search pages must collapse the oversized search/facet area and bring the result queue into view.",
  },
  {
    id: "global_search_page_workspace_scrolls_inside_shell",
    ok:
      stylesCss.includes(".global-search-page-workspace") &&
      stylesCss.includes(".app-shell-integrated .global-search-page-workspace") &&
      stylesCss.includes("overflow: auto") &&
      indexHtml.includes("global-search-scroll-20260703-1") &&
      indexHtml.includes("global-search-row-only-20260703-1"),
    message: "search result page workspace must be an explicit scroll container inside the locked app shell.",
  },
  {
    id: "global_search_activation_uses_result_target_text",
    ok:
      appJs.includes("function cleanGlobalSearchDisplayText") &&
      appJs.includes("function sanitizeGlobalSearchResult") &&
      appJs.includes("return cleanGlobalSearchDisplayText(result.targetText || result.title || result.code || state.globalSearch);") &&
      appJs.includes("clearDestinationSearchForGlobalActivation(result.route)") &&
      !appJs.includes("setScopedSearch(activationQuery)") &&
      !appJs.includes("state.devLifecycleStageSearch = activationQuery") &&
      !appJs.includes("state.dataLifecycleStageSearch = activationQuery") &&
      !appJs.includes("if (activationQuery) state.globalSearch = activationQuery;"),
    message: "search result activation must use the clicked result target text for reveal while preserving the original global query and without writing local page filters.",
  },
  {
    id: "cache_busted",
    ok:
      indexHtml.includes("dataClient.js?v=") &&
      indexHtml.includes("search-index-20260630-1") &&
      indexHtml.includes("global-search-scroll-20260703-1") &&
      indexHtml.includes("global-search-row-only-20260703-1") &&
      indexHtml.includes("global-search-local-isolation-20260703-1") &&
      indexHtml.includes("global-search-result-prune-20260703-1") &&
      indexHtml.includes("oi175-standards-detail-search-20260705-1") &&
      indexHtml.includes("oi176-global-search-counts-20260705-1") &&
      indexHtml.includes("oi182-search-history-pagination-20260705-1") &&
      indexHtml.includes("oi184-search-index-quality-20260705-1") &&
      indexHtml.includes("app.js?v="),
    message: "index.html must cache-bust dataClient.js and app.js for search-index changes.",
  },
];

const url = argValue("--url");
if (url) {
  const endpoint = `${url.replace(/\/$/, "")}/api/v1/search-index?q=${encodeURIComponent("架构")}&limit=40`;
  try {
    const response = await fetch(endpoint, { cache: "no-store" });
    const payload = await response.json();
    const data = payload?.data || payload;
    const results = Array.isArray(data?.results) ? data.results : [];
    const serialized = JSON.stringify(data);
    const forbiddenFields = ["sheet", "row", "column", "raw_value", "source_file", "import_id", "debug", "raw", "metadata"];
    const leaked = forbiddenFields.filter((field) => serialized.includes(`"${field}"`));
    checks.push({
      id: "runtime_endpoint_ok",
      ok: response.ok && data?.data_state === "ready" && results.length > 0,
      message: "runtime /api/v1/search-index must return ready results.",
      detail: { status: response.status, resultCount: results.length, dataState: data?.data_state },
    });
    checks.push({
      id: "runtime_payload_budget",
      ok: Buffer.byteLength(serialized, "utf8") < 800 * 1024,
      message: "runtime search-index response for a normal query must stay below 800KB.",
      detail: { bytes: Buffer.byteLength(serialized, "utf8") },
    });
    checks.push({
      id: "runtime_payload_field_boundary",
      ok: leaked.length === 0,
      message: "runtime search-index response must not expose raw provenance/debug fields.",
      detail: { leaked },
    });
    const internalDisplayLeaks = results
      .map((result) => result?.title || "")
      .filter((title) => /^(?:[a-z_]+:)?[0-9a-f]{12,}\s+|^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\s+/i.test(title));
    checks.push({
      id: "runtime_no_internal_title_prefix",
      ok: internalDisplayLeaks.length === 0,
      message: "runtime search-index titles must not expose backend UUID/hash object IDs.",
      detail: { internalDisplayLeaks },
    });
    const broadAiEndpoint = `${url.replace(/\/$/, "")}/api/v1/search-index?q=${encodeURIComponent("人工")}&limit=40`;
    const broadAiResponse = await fetch(broadAiEndpoint, { cache: "no-store" });
    const broadAiPayload = await broadAiResponse.json();
    const broadAiData = broadAiPayload?.data || broadAiPayload;
    const broadAiResults = Array.isArray(broadAiData?.results) ? broadAiData.results : [];
    const returnedStandardCount = broadAiResults.filter((result) => String(result?.route || "").startsWith("/standards")).length;
    const standardFacetCount = facetCategoryCount(broadAiData, "标准 / 框架");
    checks.push({
      id: "runtime_facets_count_broad_query_beyond_return_window",
      ok:
        broadAiResponse.ok &&
        broadAiData?.facets?.total === broadAiData?.stats?.matched &&
        broadAiData?.facets?.returned === broadAiResults.length &&
        broadAiData?.facets?.truncated === true &&
        standardFacetCount > returnedStandardCount &&
        standardFacetCount >= 100,
      message: "runtime broad queries such as 人工 must report total category counts via facets, not the first returned window.",
      detail: {
        status: broadAiResponse.status,
        returned: broadAiResults.length,
        total: broadAiData?.facets?.total,
        returnedStandardCount,
        standardFacetCount,
      },
    });
    const technicalTabRouteIssues = results
      .filter((result) => result?.object_type === "security_technical_measure" || result?.object_type === "security_technology_module")
      .filter((result) => {
        const targetRef = String(result?.target_ref || result?.targetRef || "");
        if (targetRef.startsWith("capability_relation:")) return false;
        const expectedPrefix = result.object_type === "security_technical_measure" ? "security_technical_measure:" : "security_technology_module:";
        return !targetRef.startsWith(expectedPrefix);
      })
      .filter((result) => {
        if (result.object_type === "security_technical_measure") return result.route !== "/knowledge/technical-measures";
        return result.route !== "/knowledge/technical-modules";
      })
      .map((result) => ({ title: result.title, object_type: result.object_type, route: result.route, target_ref: result.target_ref || result.targetRef }));
    checks.push({
      id: "runtime_technical_dictionary_routes_are_specific",
      ok: technicalTabRouteIssues.length === 0,
      message: "runtime technical module/measure search results must open the concrete tab that renders their target rows.",
      detail: { technicalTabRouteIssues },
    });
    const passwordEndpoint = `${url.replace(/\/$/, "")}/api/v1/search-index?q=${encodeURIComponent("密码")}&limit=80`;
    const passwordResponse = await fetch(passwordEndpoint, { cache: "no-store" });
    const passwordPayload = await passwordResponse.json();
    const passwordData = passwordPayload?.data || passwordPayload;
    const passwordResults = Array.isArray(passwordData?.results) ? passwordData.results : [];
    const gbtRouteIssues = passwordResults
      .filter((result) => result?.type_label === "GB/T 42446 任务" || result?.typeLabel === "GB/T 42446 任务")
      .filter((result) => result.route !== "/standards/workforce-reference")
      .map((result) => ({ title: result.title, route: result.route }));
    const passwordKeys = new Map();
    for (const result of passwordResults) {
      const contextId =
        result?.selected_capability_id ||
        result?.selectedCapabilityId ||
        result?.selected_environment_object_id ||
        result?.selectedEnvironmentObjectId ||
        result?.object_id ||
        result?.id;
      const key = [result?.type_label || result?.typeLabel || result?.type, result?.route, contextId, result?.object_id || result?.id, result?.title].join("::");
      passwordKeys.set(key, (passwordKeys.get(key) || 0) + 1);
    }
    const duplicatePasswordResults = [...passwordKeys.entries()].filter(([, count]) => count > 1).map(([key, count]) => ({ key, count }));
    checks.push({
      id: "runtime_gbt_reference_route",
      ok: passwordResponse.ok && gbtRouteIssues.length === 0,
      message: "runtime GB/T reference search results must open /standards/workforce-reference.",
      detail: { status: passwordResponse.status, gbtRouteIssues },
    });
    checks.push({
      id: "runtime_no_duplicate_password_targets",
      ok: duplicatePasswordResults.length === 0,
      message: "runtime search-index should not return exact duplicate target rows for a normal password query.",
      detail: { duplicatePasswordResults },
    });
    const jiraEndpoint = `${url.replace(/\/$/, "")}/api/v1/search-index?q=${encodeURIComponent("jira")}&limit=20`;
    const jiraResponse = await fetch(jiraEndpoint, { cache: "no-store" });
    const jiraPayload = await jiraResponse.json();
    const jiraData = jiraPayload?.data || jiraPayload;
    const jiraResults = Array.isArray(jiraData?.results) ? jiraData.results : [];
    const jiraLifecycleHits = jiraResults.filter((result) => result?.route === "/development-security" && /jira/i.test(`${result?.title || ""} ${result?.target_text || result?.targetText || ""}`));
    checks.push({
      id: "runtime_lifecycle_detail_cell_search",
      ok: jiraResponse.ok && jiraLifecycleHits.length > 0 && jiraLifecycleHits.every((result) => result.object_id && result.object_type && result.target_ref),
      message: "runtime search-index must find LC-AP detail cell values such as Jira and route them to the owning lifecycle stage.",
      detail: {
        status: jiraResponse.status,
        hitCount: jiraLifecycleHits.length,
        hits: jiraLifecycleHits.map((result) => ({ title: result.title, route: result.route, object_type: result.object_type, object_id: result.object_id, target_ref: result.target_ref })),
      },
    });
    const ansibleEndpoint = `${url.replace(/\/$/, "")}/api/v1/search-index?q=${encodeURIComponent("ansible")}&limit=20`;
    const ansibleResponse = await fetch(ansibleEndpoint, { cache: "no-store" });
    const ansiblePayload = await ansibleResponse.json();
    const ansibleData = ansiblePayload?.data || ansiblePayload;
    const ansibleResults = Array.isArray(ansibleData?.results) ? ansibleData.results : [];
    const ansibleLifecycleHits = ansibleResults.filter((result) => result?.route === "/development-security" && /ansible/i.test(`${result?.title || ""} ${result?.target_text || result?.targetText || ""}`));
    checks.push({
      id: "runtime_ansible_exact_lifecycle_hits_are_specific",
      ok:
        ansibleResponse.ok &&
        ansibleLifecycleHits.length === 2 &&
        ansibleLifecycleHits.every((result) => result.object_id && result.object_type === "development_technical_module" && result.target_ref && result.match_context),
      message: "runtime search-index must return only the concrete LC-AP Ansible stage values, with match context.",
      detail: {
        status: ansibleResponse.status,
        hitCount: ansibleLifecycleHits.length,
        hits: ansibleLifecycleHits.map((result) => ({ title: result.title, subtitle: result.subtitle, object_type: result.object_type, object_id: result.object_id, target_ref: result.target_ref, match_context: result.match_context })),
      },
    });
    const outsourceEndpoint = `${url.replace(/\/$/, "")}/api/v1/search-index?q=${encodeURIComponent("外包")}&limit=20`;
    const outsourceResponse = await fetch(outsourceEndpoint, { cache: "no-store" });
    const outsourcePayload = await outsourceResponse.json();
    const outsourceData = outsourcePayload?.data || outsourcePayload;
    const outsourceResults = Array.isArray(outsourceData?.results) ? outsourceData.results : [];
    const contextualOutsourceHits = outsourceResults.filter((result) => /外包/.test(`${result?.match_context || ""}`));
    checks.push({
      id: "runtime_outsource_results_include_match_context",
      ok: outsourceResponse.ok && contextualOutsourceHits.length > 0,
      message: "runtime search-index results for 外包 must include a bounded context snippet explaining the match.",
      detail: {
        status: outsourceResponse.status,
        hitCount: contextualOutsourceHits.length,
        hits: contextualOutsourceHits.slice(0, 5).map((result) => ({ title: result.title, typeLabel: result.typeLabel || result.type_label, subtitle: result.subtitle, match_context: result.match_context })),
      },
    });
    const desensitizationEndpoint = `${url.replace(/\/$/, "")}/api/v1/search-index?q=${encodeURIComponent("数据脱敏")}&limit=80`;
    const desensitizationResponse = await fetch(desensitizationEndpoint, { cache: "no-store" });
    const desensitizationPayload = await desensitizationResponse.json();
    const desensitizationData = desensitizationPayload?.data || desensitizationPayload;
    const desensitizationResults = Array.isArray(desensitizationData?.results) ? desensitizationData.results : [];
    const forbiddenInheritedRelationTitles = ["数据安全防护", "数据安全网关", "云原生数据安全防护"];
    const inheritedRelationHits = desensitizationResults
      .filter((result) => forbiddenInheritedRelationTitles.some((title) => `${result?.title || ""} ${result?.target_text || result?.targetText || ""}`.includes(title)))
      .map((result) => ({ title: result.title, route: result.route, typeLabel: result.typeLabel || result.type_label, target_ref: result.target_ref }));
    const directDesensitizationHits = desensitizationResults.filter((result) => /数据脱敏/.test(`${result?.title || ""} ${result?.target_text || result?.targetText || ""}`));
    checks.push({
      id: "runtime_desensitization_query_stays_on_desensitization_targets",
      ok: desensitizationResponse.ok && directDesensitizationHits.length > 0 && inheritedRelationHits.length === 0,
      message: "runtime query 数据脱敏 must return concrete desensitization targets and must not surface related gateway/security-system/module rows through inherited service context.",
      detail: {
        status: desensitizationResponse.status,
        directHitCount: directDesensitizationHits.length,
        inheritedRelationHits,
      },
    });
    const directPasswordGoldenTitles = ["T-AS.CG 密码服务能力", "密码管理器", "无密码和多因素认证", "网络安全建设-密码技术应用"];
    const directPasswordForbiddenTitles = [
      "API网关",
      "I-AP&T-AS.CG-01 应用层数据加解密",
      "I-AP&T-AS.CG-02 应用程序完整性校验",
      "I-AP&T-AS.IA-02 应用身份认证",
      "T-AS.IA-02 针对不同访问主体执行满足安全需求的身份认证机制",
      "T-AS.IA-04 管理和维护凭证的完整生命周期",
      "特权账号管理",
    ];
    const directPasswordGoldenHits = directPasswordGoldenTitles.filter((title) => passwordResults.some((result) => `${result?.title || ""} ${result?.target_text || result?.targetText || ""}`.includes(title)));
    const directPasswordForbiddenHits = passwordResults
      .filter((result) => directPasswordForbiddenTitles.some((title) => `${result?.title || ""} ${result?.target_text || result?.targetText || ""}`.includes(title)))
      .map((result) => ({ title: result.title, route: result.route, typeLabel: result.typeLabel || result.type_label, target_ref: result.target_ref, match_kind: result.match_kind || result.matchKind }));
    const weakPasswordHits = passwordResults.filter((result) => /^(?:content|context)_/.test(`${result?.match_kind || result?.matchKind || ""}`));
    checks.push({
      id: "runtime_password_query_stays_on_direct_password_targets",
      ok: passwordResponse.ok && directPasswordGoldenHits.length >= 3 && directPasswordForbiddenHits.length === 0 && weakPasswordHits.length === 0,
      message: "runtime query 密码 must be identity-first: direct title/code/name matches stay, broad description/context-only rows are pruned from the main result set.",
      detail: {
        status: passwordResponse.status,
        resultCount: passwordResults.length,
        directPasswordGoldenHits,
        directPasswordForbiddenHits,
        weakPasswordHits: weakPasswordHits.map((result) => ({ title: result.title, match_kind: result.match_kind || result.matchKind })),
      },
    });
    const passwordEscrowEndpoint = `${url.replace(/\/$/, "")}/api/v1/search-index?q=${encodeURIComponent("密码托管")}&limit=20`;
    const passwordEscrowResponse = await fetch(passwordEscrowEndpoint, { cache: "no-store" });
    const passwordEscrowPayload = await passwordEscrowResponse.json();
    const passwordEscrowData = passwordEscrowPayload?.data || passwordEscrowPayload;
    const passwordEscrowResults = Array.isArray(passwordEscrowData?.results) ? passwordEscrowData.results : [];
    const passwordEscrowHits = passwordEscrowResults.filter((result) => /特权账号管理/.test(`${result?.title || ""} ${result?.target_text || result?.targetText || ""}`));
    checks.push({
      id: "runtime_specific_content_query_still_finds_content_targets",
      ok: passwordEscrowResponse.ok && passwordEscrowHits.length > 0 && passwordEscrowHits.every((result) => /^(?:content|title|identity)_/.test(`${result?.match_kind || result?.matchKind || ""}`)),
      message: "specific content queries such as 密码托管 must still find their true content targets after broad weak-match pruning.",
      detail: {
        status: passwordEscrowResponse.status,
        hits: passwordEscrowHits.map((result) => ({ title: result.title, typeLabel: result.typeLabel || result.type_label, match_kind: result.match_kind || result.matchKind })),
      },
    });
    const coverageCases = [
      {
        id: "runtime_workforce_gartner_alias",
        query: "Gartner",
        match: (result) => result?.route === "/standards/workforce-reference" && /Gartner|岗位|角色/i.test(`${result?.title || ""} ${result?.typeLabel || result?.type_label || ""} ${result?.target_text || ""}`),
      },
      {
        id: "runtime_workforce_gbt_alias",
        query: "GB/T 42446",
        match: (result) => result?.route === "/standards/workforce-reference" && /GB\/T 42446|任务|网络安全/i.test(`${result?.title || ""} ${result?.typeLabel || result?.type_label || ""} ${result?.target_text || ""}`),
      },
      {
        id: "runtime_standard_detail_artificial_intelligence",
        query: "人工智能",
        match: (result) =>
          result?.object_type === "standard_control" &&
          /^\/standards\/(?:crf|dsp-level-2)$/.test(result?.route || "") &&
          /人工智能|Artificial Intelligence|AI/.test(`${result?.title || ""} ${result?.target_text || result?.targetText || ""} ${result?.match_context || result?.matchContext || ""}`) &&
          Boolean(result?.standardFramework || result?.standard_framework) &&
          Boolean(result?.standardTableId || result?.standard_table_id) &&
          Boolean(result?.selectedMaintenanceId || result?.selected_maintenance_id || result?.object_id),
      },
      {
        id: "runtime_archimate_navigation_alias",
        query: "ArchiMate",
        match: (result) => result?.route === "/guides/security-architecture-modeling-language",
      },
      {
        id: "runtime_code_separator_normalization",
        query: "t as cg",
        match: (result) => result?.route === "/capability-mapping" && /T-AS\.CG|密码服务能力/i.test(`${result?.title || ""} ${result?.code || ""}`),
      },
      {
        id: "runtime_pinyin_alias_mima",
        query: "mi ma",
        match: (result) => /密码/.test(`${result?.title || ""} ${result?.target_text || ""}`),
      },
      {
        id: "runtime_typo_fuzzy_jira",
        query: "jria",
        match: (result) => /jira/i.test(`${result?.title || ""} ${result?.target_text || ""}`) && result?.route === "/development-security",
      },
      {
        id: "runtime_environment_business_term",
        query: "零信任",
        match: (result) => /零信任/.test(`${result?.title || ""} ${result?.target_text || ""}`),
      },
      {
        id: "runtime_environment_relation_node_zero_trust",
        query: "零信任访问控制台",
        match: (result) => result?.route === "/environment-mapping" && result?.object_type === "information_object" && /^security_technology_module:/.test(result?.target_ref || ""),
      },
      {
        id: "runtime_wrapped_service_code_iap_watermark",
        query: "I-AP&T-PD.DP-01",
        match: (result) => result?.route === "/knowledge/technical-services" && /I-AP&T-PD\.DP-01/.test(`${result?.title || ""} ${result?.code || ""}`),
      },
      {
        id: "runtime_current_service_title_app_page_watermark",
        query: "应用页面水印",
        match: (result) =>
          result?.route === "/knowledge/technical-services" &&
          /I-AP&T-PD\.DP-01/.test(`${result?.title || ""} ${result?.code || ""}`) &&
          /应用页面水印/.test(`${result?.title || ""} ${result?.target_text || ""}`),
        forbiddenMatch: (result) => /I-DI&T-PD\.DP-01|数据内容水印/.test(`${result?.title || ""} ${result?.code || ""} ${result?.target_text || ""}`),
      },
      {
        id: "runtime_current_service_title_app_page_watermark_capability_reference",
        query: "应用页面水印",
        match: (result) =>
          result?.route === "/capability-mapping" &&
          /能力安全技术服务/.test(`${result?.typeLabel || result?.type_label || ""}`) &&
          /I-AP&T-PD\.DP-01/.test(`${result?.title || ""} ${result?.code || ""}`) &&
          /应用页面水印/.test(`${result?.title || ""} ${result?.target_text || ""}`) &&
          Boolean(result?.selected_capability_id || result?.selectedCapabilityId),
        forbiddenMatch: (result) => /I-DI&T-PD\.DP-01|数据内容水印/.test(`${result?.title || ""} ${result?.code || ""} ${result?.target_text || ""}`),
      },
      {
        id: "runtime_lifecycle_measure_term",
        query: "数据销毁",
        match: (result) => /数据销毁/.test(`${result?.title || ""} ${result?.target_text || ""}`),
      },
      {
        id: "runtime_lcdt_policy_matrix_relation_target",
        query: "数据流转监测和泄漏防护",
        match: (result) =>
          result?.route === "/data-security" &&
          /^lifecycle_policy_(row|relation):/.test(result?.target_ref || "") &&
          Boolean(result?.selected_process_id || result?.selectedProcessId || result?.object_id),
      },
      ...["M-PM.PR-00", "M-SA.RM-00", "M-SA.RE-00", "M-SA.CO-00", "M-SE.PE-00", "M-PS.CT-00"].map((query) => ({
        id: `runtime_management_service_dual_target_${query.toLowerCase().replace(/[^a-z0-9]+/g, "_")}`,
        query,
        match: (result) =>
          result?.route === "/capability-mapping" &&
          result?.object_type === "security_technical_service" &&
          result?.code === query &&
          /^capability_relation:security_technical_service:/.test(result?.target_ref || "") &&
          Boolean(result?.selected_capability_id || result?.selectedCapabilityId),
        requiredMatch: (result) => result?.route === "/knowledge/technical-services" && result?.object_type === "security_technical_service" && result?.code === query,
      })),
    ];
    for (const coverageCase of coverageCases) {
      const coverageEndpoint = `${url.replace(/\/$/, "")}/api/v1/search-index?q=${encodeURIComponent(coverageCase.query)}&limit=40`;
      const coverageResponse = await fetch(coverageEndpoint, { cache: "no-store" });
      const coveragePayload = await coverageResponse.json();
      const coverageData = coveragePayload?.data || coveragePayload;
      const coverageResults = Array.isArray(coverageData?.results) ? coverageData.results : [];
      const matched = coverageResults.filter(coverageCase.match);
      const required = coverageCase.requiredMatch ? coverageResults.filter(coverageCase.requiredMatch) : [];
      const forbidden = coverageCase.forbiddenMatch ? coverageResults.filter(coverageCase.forbiddenMatch) : [];
      const firstMatched = coverageCase.firstMatch ? coverageCase.firstMatch(coverageResults[0]) : true;
      const requiredMatched = coverageCase.requiredMatch ? required.length > 0 : true;
      checks.push({
        id: coverageCase.id,
        ok: coverageResponse.ok && matched.length > 0 && requiredMatched && forbidden.length === 0 && firstMatched,
        message: `runtime search-index must cover business query "${coverageCase.query}".`,
        detail: {
          status: coverageResponse.status,
          resultCount: coverageResults.length,
          first: coverageResults[0] ? { title: coverageResults[0].title, route: coverageResults[0].route, typeLabel: coverageResults[0].typeLabel || coverageResults[0].type_label, target_ref: coverageResults[0].target_ref } : null,
          matched: matched.slice(0, 5).map((result) => ({ title: result.title, route: result.route, typeLabel: result.typeLabel || result.type_label, target_ref: result.target_ref })),
          required: required.slice(0, 5).map((result) => ({ title: result.title, route: result.route, typeLabel: result.typeLabel || result.type_label, target_ref: result.target_ref })),
          forbidden: forbidden.slice(0, 5).map((result) => ({ title: result.title, route: result.route, typeLabel: result.typeLabel || result.type_label, target_ref: result.target_ref })),
        },
      });
    }
  } catch (error) {
    checks.push({
      id: "runtime_endpoint_ok",
      ok: false,
      message: "runtime /api/v1/search-index request failed.",
      detail: { error: error?.message || String(error) },
    });
  }
}

const failures = checks.filter((check) => !check.ok);
const report = {
  result: failures.length ? "fail" : "pass",
  checkCount: checks.length,
  failureCount: failures.length,
  failures,
};

console.log(JSON.stringify(report, null, 2));
if (failures.length) process.exitCode = 1;
