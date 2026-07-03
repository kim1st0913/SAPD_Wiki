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

const appJs = read("frontend/capability-browser/app.js");
const dataClientJs = read("frontend/capability-browser/dataClient.js");
const indexHtml = read("frontend/capability-browser/index.html");
const stylesCss = read("frontend/capability-browser/styles.css");
const apiServerPy = read("src/sapd_wiki/api_server.py");

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
    id: "api_index_has_business_coverage_aliases",
    ok:
      apiServerPy.includes("_SEARCH_QUERY_ALIASES") &&
      apiServerPy.includes("GB/T 42446-2023") &&
      apiServerPy.includes("Gartner 工作岗位参考") &&
      apiServerPy.includes("ArchiMate 3.2") &&
      apiServerPy.includes("_search_compact(type_label, normalized_code, normalized_title, subtitle, search_text, aliases)"),
    message: "search index must include user-facing business aliases and type labels, not only object titles.",
  },
  {
    id: "api_index_supports_light_fuzzy_matching",
    ok:
      apiServerPy.includes("def _search_query_variants") &&
      apiServerPy.includes("def _search_plain") &&
      apiServerPy.includes("def _search_damerau_distance_at_most_one") &&
      apiServerPy.includes("def _search_fuzzy_token_match") &&
      apiServerPy.includes("_search_fuzzy_token_match(variants[0], title, code, haystack)"),
    message: "search index must support controlled normalization and light fuzzy matching for codes, aliases, and common typos.",
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
      appJs.includes("mergeGlobalSearchResults(indexedResults, buildGlobalSearchResults(query), query)") &&
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
    id: "data_client_search_index_method",
    ok: dataClientJs.includes('searchIndex: "/api/v1/search-index"') && dataClientJs.includes("async getSearchIndex(params = {})"),
    message: "dataClient must expose getSearchIndex() against /api/v1/search-index.",
  },
  {
    id: "global_search_uses_index",
    ok:
      appJs.includes("function normalizeGlobalSearchIndexResult") &&
      appJs.includes("function searchIndexPayloadFromEnvelope") &&
      appJs.includes("async function searchIndexResultsForQuery") &&
      runGlobalSearch.includes("searchIndexResultsForQuery(query)"),
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
    ok: runGlobalSearch.includes("mergeGlobalSearchResults(indexedResults, buildGlobalSearchResults(query), query)"),
    message: "global search should keep current loaded-data fallback while using search index first.",
  },
  {
    id: "global_search_result_page_uses_same_index_flow",
    ok:
      appJs.includes("function renderSearchPage()") &&
      appJs.includes("runGlobalSearch({ panel: false })") &&
      appJs.includes("state.globalSearchLoadedQuery !== query") &&
      appJs.includes("function openGlobalSearchPage") &&
      indexHtml.includes('id="searchWorkspace"'),
    message: "global search result page must reuse runGlobalSearch without triggering full package preloads.",
  },
  {
    id: "global_search_result_row_direct_activation",
    ok:
      appJs.includes("function globalSearchPageResultForKey") &&
      appJs.includes("data-search-page-result") &&
      appJs.includes("const result = globalSearchPageResultForKey(row.dataset.searchPageResult)") &&
      appJs.includes("activateGlobalSearchResult(result)") &&
      appJs.includes("点击任一结果进入定位") &&
      !appJs.includes("data-search-page-open-result") &&
      !appJs.includes("打开定位") &&
      !stylesCss.includes(".global-search-page-row-action"),
    message: "search result page rows must be the only visible activation target.",
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
    const technicalTabRouteIssues = results
      .filter((result) => result?.object_type === "security_technical_measure" || result?.object_type === "security_technology_module")
      .filter((result) => {
        if (result.object_type === "security_technical_measure") return result.route !== "/knowledge/technical-measures";
        return result.route !== "/knowledge/technical-modules";
      })
      .map((result) => ({ title: result.title, object_type: result.object_type, route: result.route }));
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
      const key = [result?.type_label || result?.typeLabel || result?.type, result?.route, result?.object_id || result?.id, result?.title].join("::");
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
        id: "runtime_lifecycle_measure_term",
        query: "数据销毁",
        match: (result) => /数据销毁/.test(`${result?.title || ""} ${result?.target_text || ""}`),
      },
    ];
    for (const coverageCase of coverageCases) {
      const coverageEndpoint = `${url.replace(/\/$/, "")}/api/v1/search-index?q=${encodeURIComponent(coverageCase.query)}&limit=40`;
      const coverageResponse = await fetch(coverageEndpoint, { cache: "no-store" });
      const coveragePayload = await coverageResponse.json();
      const coverageData = coveragePayload?.data || coveragePayload;
      const coverageResults = Array.isArray(coverageData?.results) ? coverageData.results : [];
      const matched = coverageResults.filter(coverageCase.match);
      checks.push({
        id: coverageCase.id,
        ok: coverageResponse.ok && matched.length > 0,
        message: `runtime search-index must cover business query "${coverageCase.query}".`,
        detail: {
          status: coverageResponse.status,
          resultCount: coverageResults.length,
          matched: matched.slice(0, 5).map((result) => ({ title: result.title, route: result.route, typeLabel: result.typeLabel || result.type_label, target_ref: result.target_ref })),
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
