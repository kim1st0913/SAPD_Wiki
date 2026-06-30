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
const apiServerPy = read("src/sapd_wiki/api_server.py");

const ensurePackages = snippet(appJs, "async function ensureGlobalSearchPackages()", "async function ensureGlobalSearchStandardDetails()");
const ensureStandards = snippet(appJs, "async function ensureGlobalSearchStandardDetails()", "function buildGlobalSearchResults(query)");
const runGlobalSearch = snippet(appJs, "async function runGlobalSearch()", "function clearGlobalSearchPanel");

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
    ok: appJs.includes("function normalizeGlobalSearchIndexResult") && appJs.includes("async function searchIndexResultsForQuery") && runGlobalSearch.includes("searchIndexResultsForQuery(query)"),
    message: "runGlobalSearch must query the lightweight search index before rendering results.",
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
    ok: runGlobalSearch.includes("mergeGlobalSearchResults(indexedResults, buildGlobalSearchResults(query))"),
    message: "global search should keep current loaded-data fallback while using search index first.",
  },
  {
    id: "cache_busted",
    ok: indexHtml.includes("dataClient.js?v=") && indexHtml.includes("search-index-20260630-1") && indexHtml.includes("app.js?v="),
    message: "index.html must cache-bust dataClient.js and app.js for search-index changes.",
  },
];

const url = argValue("--url");
if (url) {
  const endpoint = `${url.replace(/\/$/, "")}/api/v1/search-index?q=${encodeURIComponent("安全")}&limit=40`;
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
