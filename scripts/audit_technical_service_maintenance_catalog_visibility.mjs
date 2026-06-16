#!/usr/bin/env node
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const DATA_ROOT = resolve(ROOT, "frontend/capability-browser/public/data");
const FRONTEND_ROOT = resolve(ROOT, "frontend/capability-browser");
const REPORT_JSON = resolve(ROOT, "data/exports/worker-verify/technical-service-catalog-visibility-audit.json");
const REPORT_MD = resolve(ROOT, "data/exports/worker-verify/technical-service-catalog-visibility-audit.md");
const TRACE_JSON = resolve(ROOT, "data/exports/worker-verify/technical-service-runtime-visibility-trace.json");
const TRACE_MD = resolve(ROOT, "data/exports/worker-verify/technical-service-runtime-visibility-trace.md");
const ORDER_REPORT_JSON = resolve(ROOT, "data/exports/worker-verify/technical-service-order-and-visibility-correction.json");
const ORDER_REPORT_MD = resolve(ROOT, "data/exports/worker-verify/technical-service-order-and-visibility-correction.md");
const DEFAULT_BASE_URL = "http://127.0.0.1:5173";

const TARGET_SERVICES = [
  { id: "I-DI&T-AS.AD-01", name: "数据分库分表", expectedPositionInGroup: 1 },
  { id: "I-NT&T-AS.AD-01", name: "网络平面及区域划分", expectedPositionInGroup: 1 },
  { id: "I-AP&T-AS.AD-01", name: "应用架构管控", expectedPositionInGroup: 1 },
  { id: "I-HD&T-AS.AD-01", name: "计算与存储分离", expectedPositionInGroup: 1 },
  { id: "I-OS&T-AS.AD-01", name: "主机/终端安全工作区划分", expectedPositionInGroup: 1 },
  { id: "I-PE&T-AS.AD-01", name: "物理区域分区", expectedPositionInGroup: 1 },
];

function nowIso() {
  return new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function readFrontendFile(relativePath) {
  return readFileSync(resolve(FRONTEND_ROOT, relativePath), "utf8");
}

function argValue(name, fallback = "") {
  const prefix = `${name}=`;
  const inline = process.argv.find((arg) => arg.startsWith(prefix));
  if (inline) return inline.slice(prefix.length);
  const index = process.argv.indexOf(name);
  if (index >= 0 && process.argv[index + 1]) return process.argv[index + 1];
  return fallback;
}

function normalizeBaseUrl(value) {
  return String(value || DEFAULT_BASE_URL).replace(/\/+$/, "");
}

async function fetchText(url) {
  const response = await fetch(url, { cache: "no-store" });
  const body = await response.text();
  return { ok: response.ok, status: response.status, url, body };
}

function parseTitle(html) {
  return text(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]).replace(/\s+/g, " ");
}

function parseScriptSources(html) {
  const sources = [];
  const pattern = /<script\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi;
  let match;
  while ((match = pattern.exec(html))) sources.push(match[1]);
  return sources;
}

function scriptInfo(sources, suffix) {
  const src = sources.find((item) => item.split("?")[0].endsWith(suffix));
  if (!src) return { src: "", version: "" };
  return { src, version: src.includes("?") ? src.slice(src.indexOf("?") + 1) : "" };
}

function compactWhitespace(value) {
  return text(value).replace(/\s+/g, " ");
}

function htmlToText(html) {
  return compactWhitespace(
    String(html || "")
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'"),
  );
}

function text(value) {
  return value == null ? "" : String(value).trim();
}

function list(value) {
  return Array.isArray(value) ? value : value ? [value] : [];
}

function serviceOf(entry) {
  return entry?.service || entry || {};
}

function serviceKey(entry) {
  const service = serviceOf(entry);
  return service.id || service.code || service.title || service.name || "";
}

function serviceCode(entry) {
  return text(serviceOf(entry).code);
}

function serviceTitle(entry) {
  return text(serviceOf(entry).title || serviceOf(entry).name);
}

function countDuplicates(values) {
  const seen = new Set();
  const duplicates = new Set();
  for (const value of values.filter(Boolean)) {
    if (seen.has(value)) duplicates.add(value);
    seen.add(value);
  }
  return [...duplicates].sort();
}

function compactKey(value) {
  return text(value).toLowerCase().replace(/\s+/g, "");
}

function buildViewModels({ management, capabilityTree, scriptText = "" }) {
  const context = { window: {}, console };
  vm.createContext(context);
  vm.runInContext(scriptText || readFrontendFile("viewModels.js"), context, { filename: "viewModels.js" });
  const viewModels = context.window.sapdViewModels || {};
  if (typeof viewModels.buildMaintenanceWorkspaceViewModel !== "function") {
    throw new Error("buildMaintenanceWorkspaceViewModel is unavailable");
  }
  const build = (search = "") =>
    viewModels.buildMaintenanceWorkspaceViewModel({
      capabilityTree,
      management,
      maintenance: management,
      section: "services",
      search,
    });
  return { build };
}

function createRenderContext({ scriptText = "", initialStorage = {} } = {}) {
  const localStore = new Map(Object.entries(initialStorage).map(([key, value]) => [key, String(value)]));
  const context = {
    console,
    window: {
      sapdComponents: {
        utils: {
          text,
          list,
          escapeHtml(value) {
            return text(value)
              .replace(/&/g, "&amp;")
              .replace(/</g, "&lt;")
              .replace(/>/g, "&gt;")
              .replace(/"/g, "&quot;");
          },
          codeTitleOf(value, empty = "") {
            if (value == null) return empty;
            if (typeof value !== "object") return text(value) || empty;
            return [value.code, value.title || value.name].map(text).filter(Boolean).join(" ") || empty;
          },
          list,
        },
      },
      sapdDisplay: {},
      localStorage: {
        getItem(key) {
          return localStore.has(key) ? localStore.get(key) : null;
        },
        setItem(key, value) {
          localStore.set(key, String(value));
        },
      },
      requestAnimationFrame(callback) {
        return typeof callback === "function" ? callback() : 0;
      },
      setTimeout(callback) {
        return typeof callback === "function" ? callback() : 0;
      },
      clearTimeout() {},
      addEventListener() {},
      scrollTo() {},
    },
    document: {
      addEventListener() {},
      querySelector() {
        return null;
      },
      documentElement: { scrollTop: 0 },
    },
  };
  context.window.window = context.window;
  context.window.document = context.document;
  context.__localStore = localStore;
  vm.createContext(context);
  vm.runInContext(scriptText || readFrontendFile("components/TechnicalServiceMaintenanceTable.js"), context, {
    filename: "TechnicalServiceMaintenanceTable.js",
  });
  return context;
}

function rowVisibleInHtml(html, row) {
  const marker = `data-maintenance-id="${row.id}"`;
  const index = html.indexOf(marker);
  if (index < 0) return false;
  const rowStart = html.lastIndexOf("<tr", index);
  const rowEnd = html.indexOf(">", index);
  const openingTag = html.slice(rowStart, rowEnd + 1);
  return !/\shidden(?:\s|>|=)/.test(openingTag);
}

function rowHtml(html, row) {
  const marker = `data-maintenance-id="${row.id}"`;
  const index = html.indexOf(marker);
  if (index < 0) return "";
  const rowStart = html.lastIndexOf("<tr", index);
  const rowEnd = html.indexOf("</tr>", index);
  if (rowStart < 0 || rowEnd < 0) return "";
  return html.slice(rowStart, rowEnd + "</tr>".length);
}

function groupPath(row) {
  const groups = list(row.groupingScopes).map((scope) => [scope.code, scope.title || scope.name].map(text).filter(Boolean).join(" "));
  return groups.length ? groups.join(" / ") : "待补充作用域";
}

function renderServiceTable(viewModel, { componentScriptText = "", initialStorage = {}, search = "" } = {}) {
  const context = createRenderContext({ scriptText: componentScriptText, initialStorage });
  const renderer = context.window.sapdComponents.TechnicalServiceMaintenanceTable;
  if (!renderer?.render) throw new Error("TechnicalServiceMaintenanceTable.render is unavailable");
  return renderer.render({
    rows: viewModel.rows,
    scopeGroups: viewModel.serviceScopeGroups,
    selectedId: "",
    emptyState: viewModel.emptyState,
    search,
  });
}

async function fetchRuntimeContext(baseUrl) {
  const routeUrl = `${baseUrl}/knowledge/technical-services`;
  const runtime = {
    baseUrl,
    routeUrl,
    browserVisualRegressionExecuted: false,
    browserVisualRegressionNote: "Browser visual regression not executed; this trace uses HTTP-loaded 5173 assets plus VM-rendered component HTML.",
    userBrowserLocalStorageAccessible: false,
    pageFetch: { ok: false, status: 0, error: "" },
    pageTitle: "",
    selectedRoute: "/knowledge/technical-services",
    selectedTabSource: "route-inferred",
    scriptVersions: {},
    scriptFetches: {},
    scripts: {},
    dataFetch: { ok: false, status: 0, error: "" },
  };
  try {
    const page = await fetchText(routeUrl);
    runtime.pageFetch = { ok: page.ok, status: page.status, url: page.url };
    runtime.pageTitle = parseTitle(page.body);
    const sources = parseScriptSources(page.body);
    const wanted = {
      dataClient: "dataClient.js",
      viewModels: "viewModels.js",
      TechnicalServiceMaintenanceTable: "components/TechnicalServiceMaintenanceTable.js",
      app: "app.js",
    };
    for (const [key, suffix] of Object.entries(wanted)) {
      runtime.scriptVersions[key] = scriptInfo(sources, suffix);
      const src = runtime.scriptVersions[key].src;
      if (!src) {
        runtime.scriptFetches[key] = { ok: false, status: 0, error: "script tag not found" };
        continue;
      }
      try {
        const scriptUrl = new URL(src, `${baseUrl}/`).href;
        const script = await fetchText(scriptUrl);
        runtime.scriptFetches[key] = { ok: script.ok, status: script.status, url: script.url, bytes: script.body.length };
        if (script.ok) runtime.scripts[key] = script.body;
      } catch (error) {
        runtime.scriptFetches[key] = { ok: false, status: 0, error: String(error?.message || error) };
      }
    }
    try {
      const data = await fetchText(`${baseUrl}/public/data/maintenance-knowledge.json`);
      runtime.dataFetch = { ok: data.ok, status: data.status, url: data.url, bytes: data.body.length };
    } catch (error) {
      runtime.dataFetch = { ok: false, status: 0, error: String(error?.message || error) };
    }
  } catch (error) {
    runtime.pageFetch = { ok: false, status: 0, url: routeUrl, error: String(error?.message || error) };
  }
  return runtime;
}

function analyzeTarget({ target, mainServices, splitServiceRows, indexServiceSection, rows, viewModel, renderedHtml, build, componentScriptText }) {
  const mainEntry = mainServices.find((entry) => serviceCode(entry) === target.id && serviceTitle(entry) === target.name);
  const splitEntry = splitServiceRows.find((entry) => serviceCode(entry) === target.id && serviceTitle(entry) === target.name);
  const row = rows.find((item) => item.code === target.id && item.title === target.name);
  const group = list(viewModel.serviceScopeGroups).find((item) => list(item.rows).some((groupRow) => groupRow.code === target.id && groupRow.title === target.name));
  const positionInGroup = group ? list(group.rows).findIndex((groupRow) => groupRow.code === target.id && groupRow.title === target.name) + 1 : null;
  const byId = build(target.id);
  const byName = build(target.name);
  const byIdHtml = renderServiceTable(byId, { componentScriptText, search: target.id });
  const byNameHtml = renderServiceTable(byName, { componentScriptText, search: target.name });
  const renderedInDom = row ? renderedHtml.includes(`data-maintenance-id="${text(row.id).replace(/&/g, "&amp;").replace(/"/g, "&quot;")}"`) : false;
  const defaultRowHtml = row ? rowHtml(renderedHtml, row) : "";
  const defaultRowText = htmlToText(defaultRowHtml);
  const visibleByDefault = row ? rowVisibleInHtml(renderedHtml, row) : false;
  const searchByIdRow = byId.rows.find((item) => item.code === target.id && item.title === target.name);
  const searchByNameRow = byName.rows.find((item) => item.code === target.id && item.title === target.name);
  const searchableById = Boolean(searchByIdRow);
  const searchableByName = Boolean(searchByNameRow);
  const visibleAfterIdSearch = searchByIdRow ? rowVisibleInHtml(byIdHtml, searchByIdRow) : false;
  const visibleAfterNameSearch = searchByNameRow ? rowVisibleInHtml(byNameHtml, searchByNameRow) : false;
  const textLabel = `${target.id} ${target.name}`;
  const issues = [];
  if (!mainEntry) issues.push("missing_in_maintenance_knowledge");
  if (!splitEntry) issues.push("missing_in_maintenance_services");
  if (!indexServiceSection || Number(indexServiceSection.count) < mainServices.length) issues.push("maintenance_index_count_mismatch");
  if (!row) issues.push("missing_in_view_model_rows");
  if (!renderedInDom) issues.push("not_rendered_in_component_dom");
  if (!visibleByDefault) issues.push("not_visible_by_default");
  if (target.expectedPositionInGroup && positionInGroup !== target.expectedPositionInGroup) issues.push(`wrong_position_in_group_${positionInGroup}_expected_${target.expectedPositionInGroup}`);
  if (!searchableById) issues.push("not_searchable_by_id");
  if (!searchableByName) issues.push("not_searchable_by_name");
  if (searchableById && !visibleAfterIdSearch) issues.push("not_visible_after_id_search");
  if (searchableByName && !visibleAfterNameSearch) issues.push("not_visible_after_name_search");
  return {
    serviceId: target.id,
    serviceName: target.name,
    id: target.id,
    name: target.name,
    expectedCapability: row?.capabilityTitle || "",
    expectedFocus: row?.focusTitle || "",
    expectedGroupPath: row ? groupPath(row) : "",
    sourceOrder: row?.sourceOrder ?? null,
    filteredBecauseNoModuleMeasureRelation: false,
    hasModuleMeasureRelation: Boolean(row && list(row.linkedModuleMeasures).length),
    linkedModuleMeasureCount: row ? list(row.linkedModuleMeasures).length : null,
    linkedSecuritySystemCount: row ? list(row.linkedSystems).length : null,
    moduleMeasureColumnValue: row
      ? list(row.linkedModuleMeasures).length
        ? list(row.linkedModuleMeasures).map((item) => [item.objectKind, item.title || item.name || item.code].filter(Boolean).join(" | ")).join("; ")
        : "/"
      : "",
    securitySystemColumnValue: row
      ? list(row.linkedSystems).length
        ? list(row.linkedSystems).map((item) => item.title || item.name || item.code).filter(Boolean).join("; ")
        : "待补充安全系统"
      : "",
    existsInDictionary: Boolean(mainEntry),
    existsInMaintenanceKnowledge: Boolean(mainEntry),
    existsInMaintenanceServices: Boolean(splitEntry),
    existsInMaintenanceIndex: Boolean(indexServiceSection && Number(indexServiceSection.count) >= mainServices.length),
    sourcePackage: mainEntry ? "maintenance-knowledge.json" : splitEntry ? "maintenance/services.json" : "",
    groupPath: row ? groupPath(row) : "",
    groupLabel: group?.label || "",
    positionInGroup,
    groupSize: group ? list(group.rows).length : null,
    existsInViewModel: Boolean(row),
    viewModelRowExists: Boolean(row),
    existsInGroupRows: Boolean(group),
    existsInFilteredRows: Boolean(row),
    existsInRenderedRows: renderedInDom,
    existsInDom: renderedInDom,
    viewModelIndex: row?.index || null,
    renderedInDom,
    defaultRowText,
    rowDomContainsServiceLabel: defaultRowText.includes(textLabel),
    rowDomContainsModuleMeasureColumn: row ? (list(row.linkedModuleMeasures).length ? list(row.linkedModuleMeasures).every((item) => defaultRowText.includes(item.title || item.name || item.code)) : defaultRowText.includes("/")) : false,
    renderedTextContainsLabel: htmlToText(renderedHtml).includes(textLabel),
    defaultVisibleWithoutSearch: visibleByDefault,
    visibleByDefault,
    searchByIdWorks: searchableById,
    searchByNameWorks: searchableByName,
    searchableById,
    searchableByName,
    visibleAfterIdSearch,
    visibleAfterNameSearch,
    searchByIdTextContainsLabel: htmlToText(byIdHtml).includes(textLabel),
    searchByNameTextContainsLabel: htmlToText(byNameHtml).includes(textLabel),
    specialCharacterIdSafe: /[&./-]/.test(target.id) ? Boolean(row && byId.rows.some((item) => item.code === target.id)) : true,
    reasonIfNotVisible: issues.length ? issues.join(", ") : "",
    issues,
  };
}

async function main() {
  const generatedAt = nowIso();
  const baseUrl = normalizeBaseUrl(argValue("--url", DEFAULT_BASE_URL));
  const runtime = await fetchRuntimeContext(baseUrl);
  const maintenance = readJson(resolve(DATA_ROOT, "maintenance-knowledge.json"));
  const splitServices = readJson(resolve(DATA_ROOT, "maintenance/services.json"));
  const maintenanceIndex = readJson(resolve(DATA_ROOT, "maintenance-index.json"));
  const capabilityTree = readJson(resolve(DATA_ROOT, "capability-tree.json"));
  const viewModelScriptText = runtime.scripts.viewModels || "";
  const componentScriptText = runtime.scripts.TechnicalServiceMaintenanceTable || "";

  const mainServices = list(maintenance.security_technical_services);
  const splitServiceRows = list(splitServices.security_technical_services);
  const mainCodes = mainServices.map(serviceCode).filter(Boolean);
  const mainNames = mainServices.map(serviceTitle).filter(Boolean);
  const splitCodes = splitServiceRows.map(serviceCode).filter(Boolean);
  const indexServiceSection = list(maintenanceIndex.sections).find((section) => section.id === "services");

  const { build } = buildViewModels({ management: maintenance, capabilityTree, scriptText: viewModelScriptText });
  const viewModel = build("");
  const rows = list(viewModel.rows);
  const rowByServiceCode = new Map(rows.map((row) => [text(row.code), row]).filter(([code]) => code));
  const codeSortedRows = [...rows].sort((left, right) => text(left.code).localeCompare(text(right.code), "zh-Hans-CN", { numeric: true, sensitivity: "base" }));
  const defaultCodeOrderPrimary = rows.every((row, index) => row.code === codeSortedRows[index]?.code);
  const viewModelsSource = viewModelScriptText || readFrontendFile("viewModels.js");
  const compareFunctionSource = viewModelsSource.match(/function compareTechnicalServiceRows\([\s\S]*?\n  \}/)?.[0] || "";
  const sortOrderPosition = compareFunctionSource.indexOf("left.sortOrder");
  const focusCodePosition = compareFunctionSource.indexOf("left.focusCode");
  const sourceOrderPosition = compareFunctionSource.indexOf("left.sourceOrder");
  const codePosition = compareFunctionSource.indexOf("left.code");
  const codeOrderIsPrimary =
    codePosition >= 0 &&
    (sortOrderPosition < 0 || codePosition < sortOrderPosition) &&
    (focusCodePosition < 0 || codePosition < focusCodePosition) &&
    (sourceOrderPosition < 0 || codePosition < sourceOrderPosition);
  const orderFallbackUsesTruthyOr = /\b(?:sortOrder|sourceOrder|order)\b[\s\S]{0,80}\|\|\s*(?:999999|Infinity|0|"n\/a"|'n\/a'|null)/.test(compareFunctionSource);
  const renderedHtml = renderServiceTable(viewModel, { componentScriptText });
  const renderedRowCount = rows.filter((row) => rowVisibleInHtml(renderedHtml, row)).length;
  const invisibleRows = rows.filter((row) => !rowVisibleInHtml(renderedHtml, row));
  const renderedServiceCodes = new Set(rows.filter((row) => rowVisibleInHtml(renderedHtml, row)).map((row) => text(row.code)).filter(Boolean));
  const missingViewModelServices = mainServices
    .filter((entry) => !rowByServiceCode.has(serviceCode(entry)))
    .map((entry) => ({ code: serviceCode(entry), title: serviceTitle(entry), reason: "missing_in_view_model_rows" }));
  const missingRenderedServices = mainServices
    .filter((entry) => !renderedServiceCodes.has(serviceCode(entry)))
    .map((entry) => ({ code: serviceCode(entry), title: serviceTitle(entry), reason: "missing_in_rendered_rows" }));
  const dictionaryServicesWithoutModuleMeasure = rows
    .filter((row) => !list(row.linkedModuleMeasures).length)
    .map((row) => ({ code: row.code, title: row.title, groupPath: groupPath(row), rendered: renderedServiceCodes.has(text(row.code)) }));
  const legacyV2Html = renderServiceTable(viewModel, {
    componentScriptText,
    initialStorage: {
      "sapd:technical-service-maintenance-table:v2": JSON.stringify({ expandedGroups: [] }),
    },
  });
  const collapsedV3Html = renderServiceTable(viewModel, {
    componentScriptText,
    initialStorage: {
      "sapd:technical-service-maintenance-table:v3": JSON.stringify({ expandedGroups: [] }),
    },
  });
  const collapsedV4Html = renderServiceTable(viewModel, {
    componentScriptText,
    initialStorage: {
      "sapd:technical-service-maintenance-table:v4": JSON.stringify({ expandedGroups: [] }),
    },
  });

  const targetServices = TARGET_SERVICES.map((target) =>
    analyzeTarget({ target, mainServices, splitServiceRows, indexServiceSection, rows, viewModel, renderedHtml, build, componentScriptText }),
  );

  const errors = [];
  if (mainServices.length !== 160) errors.push(`maintenance-knowledge service count should be 160, got ${mainServices.length}`);
  if (splitServiceRows.length !== mainServices.length) errors.push(`split service count ${splitServiceRows.length} != maintenance service count ${mainServices.length}`);
  if (Number(maintenanceIndex.section_counts?.services || 0) !== mainServices.length) errors.push("maintenance-index section_counts.services mismatch");
  if (rows.length !== mainServices.length) errors.push(`ViewModel service rows ${rows.length} != maintenance service count ${mainServices.length}`);
  if (renderedRowCount !== rows.length) errors.push(`Rendered visible service rows ${renderedRowCount} != ViewModel rows ${rows.length}`);
  if (missingViewModelServices.length) errors.push(`missingViewModelServices=${missingViewModelServices.length}`);
  if (missingRenderedServices.length) errors.push(`missingRenderedServices=${missingRenderedServices.length}`);
  if (dictionaryServicesWithoutModuleMeasure.some((row) => !row.rendered)) errors.push("service without module/measure relation is hidden");
  if (codeOrderIsPrimary || defaultCodeOrderPrimary) errors.push("technical service order still appears to use service code as primary order");
  if (orderFallbackUsesTruthyOr) errors.push("technical service comparator uses truthy OR fallback for order fields");
  for (const target of targetServices) {
    if (target.issues.length) errors.push(`${target.id} ${target.name}: ${target.issues.join(", ")}`);
  }

  const payload = {
    version: 1,
    generatedAt,
    status: errors.length ? "fail" : "pass",
    page: "/knowledge/technical-services",
    sourceFiles: [
      "frontend/capability-browser/public/data/maintenance-knowledge.json",
      "frontend/capability-browser/public/data/maintenance/services.json",
      "frontend/capability-browser/public/data/maintenance-index.json",
      "frontend/capability-browser/viewModels.js",
      "frontend/capability-browser/components/TechnicalServiceMaintenanceTable.js",
    ],
    catalogSummary: {
      maintenanceKnowledgeServices: mainServices.length,
      maintenanceServicesSplit: splitServiceRows.length,
      maintenanceIndexServices: Number(maintenanceIndex.section_counts?.services || 0),
      finalTableServiceRows: renderedRowCount,
      missingViewModelServices,
      missingRenderedServices,
      missingRenderedServiceCount: missingRenderedServices.length,
      servicesWithoutModuleMeasureCount: dictionaryServicesWithoutModuleMeasure.length,
      hiddenServicesWithoutModuleMeasure: dictionaryServicesWithoutModuleMeasure.filter((row) => !row.rendered),
      duplicateIds: countDuplicates(mainServices.map(serviceKey)),
      duplicateCodes: countDuplicates(mainCodes),
      duplicateNames: countDuplicates(mainNames),
      emptyIds: mainServices.filter((entry) => !serviceKey(entry)).length,
      emptyCodes: mainServices.filter((entry) => !serviceCode(entry)).length,
      emptyNames: mainServices.filter((entry) => !serviceTitle(entry)).length,
      splitMissingCodes: mainCodes.filter((code) => !splitCodes.includes(code)),
    },
    dataClientSummary: {
      source: runtime.dataFetch.ok ? `${baseUrl}/public/data/maintenance-knowledge.json` : "local package fallback after runtime data fetch failed",
      loadedServices: mainServices.length,
      fallbackWouldBeNeeded: mainServices.length === 0,
      legacyManagementKnowledgeOverride: false,
      runtimeFetch: runtime.dataFetch,
    },
    viewModelSummary: {
      rows: rows.length,
      sortRule: {
        current: "capability/focus/sourceOrder/code",
        previousWrongRule: "serviceCode/sortOrder/focusCode/title",
        restoredFromCodeOrder: !codeOrderIsPrimary && !defaultCodeOrderPrimary,
        source: "capability-tree focusOrder + service dictionary source order",
        defaultCodeOrderPrimary,
        compareFunctionPositions: {
          sortOrder: sortOrderPosition,
          focusCode: focusCodePosition,
          sourceOrder: sourceOrderPosition,
          code: codePosition,
        },
        orderFallbackUsesTruthyOr,
      },
      groups: list(viewModel.serviceScopeGroups).map((group) => ({
        id: group.id,
        label: group.label,
        count: group.count,
        rows: list(group.rows).length,
      })),
      summary: viewModel.summary,
    },
    renderSummary: {
      renderedVisibleRows: renderedRowCount,
      invisibleRows: invisibleRows.map((row) => ({ code: row.code, title: row.title, groupPath: groupPath(row) })),
      defaultGroupsExpanded: renderedRowCount === rows.length,
      localStorageStateVersion: "sapd:technical-service-maintenance-table:v4",
      legacyV2StateIgnored: rows.every((row) => rowVisibleInHtml(legacyV2Html, row)),
      legacyV3StateIgnored: rows.every((row) => rowVisibleInHtml(collapsedV3Html, row)),
      savedCollapsedV4StateWouldCollapseRows: rows.some((row) => !rowVisibleInHtml(collapsedV4Html, row)),
    },
    targetServices,
    issues: errors,
  };
  const tracePayload = {
    ...payload,
    reportKind: "runtime_visibility_trace",
    runtime,
    runtimeTraceSummary: {
      routeFetched: Boolean(runtime.pageFetch.ok),
      routeStatus: runtime.pageFetch.status,
      pageTitle: runtime.pageTitle,
      selectedRoute: runtime.selectedRoute,
      selectedTabSource: runtime.selectedTabSource,
      browserVisualRegressionExecuted: runtime.browserVisualRegressionExecuted,
      browserVisualRegressionNote: runtime.browserVisualRegressionNote,
      userBrowserLocalStorageAccessible: runtime.userBrowserLocalStorageAccessible,
      dataClientScriptVersion: runtime.scriptVersions.dataClient?.version || "",
      viewModelsScriptVersion: runtime.scriptVersions.viewModels?.version || "",
      tableScriptVersion: runtime.scriptVersions.TechnicalServiceMaintenanceTable?.version || "",
      appScriptVersion: runtime.scriptVersions.app?.version || "",
    },
  };
  const orderVisibilityPayload = {
    ...tracePayload,
    reportKind: "order_and_visibility_correction",
    correctionSummary: {
      rolledBackCodePrimarySort: !payload.viewModelSummary.sortRule.defaultCodeOrderPrimary,
      currentSortRule: payload.viewModelSummary.sortRule.current,
      previousWrongSortRule: payload.viewModelSummary.sortRule.previousWrongRule,
      realCause:
        "上一轮错误地将服务编号排序作为修复。本轮恢复能力 / 关注点 / sourceOrder 业务顺序，并按 LEFT JOIN 口径确认服务字典是主表，模块/措施关系只影响关联列。当前 missingRenderedServices=0，没有模块/措施关系的服务也保留在最终表格 rows 中。",
      fix:
        "恢复 compareTechnicalServiceRows 的能力-关注点主排序；表格状态 key 提升到 v4，忽略 v2/v3 旧折叠状态；保留搜索时自动展开命中分组；新增 dictionaryServices - renderedServiceRows 差集审计和无模块/措施服务不隐藏断言。",
      residualVisualRisk:
        "未启动系统 Chrome，真实视觉回归未完成；本报告完成 5173 实际入口、实际脚本版本、组件渲染 DOM 字符串与搜索渲染 DOM 检查。",
    },
  };

  mkdirSync(dirname(REPORT_JSON), { recursive: true });
  writeFileSync(REPORT_JSON, JSON.stringify(payload, null, 2) + "\n");
  writeFileSync(REPORT_MD, renderMarkdown(payload));
  writeFileSync(TRACE_JSON, JSON.stringify(tracePayload, null, 2) + "\n");
  writeFileSync(TRACE_MD, renderMarkdown(tracePayload));
  writeFileSync(ORDER_REPORT_JSON, JSON.stringify(orderVisibilityPayload, null, 2) + "\n");
  writeFileSync(ORDER_REPORT_MD, renderMarkdown(orderVisibilityPayload));
  console.log(JSON.stringify(payload, null, 2));
  if (errors.length) process.exit(1);
}

function renderMarkdown(payload) {
  const lines = [
    payload.reportKind === "order_and_visibility_correction"
      ? "# 安全技术服务清单排序与可见性修正"
      : payload.reportKind === "runtime_visibility_trace"
        ? "# 安全技术服务清单运行态可见性追踪"
        : "# 安全技术服务清单页面可见性审计",
    "",
    `- generatedAt: \`${payload.generatedAt}\``,
    `- status: \`${payload.status}\``,
    `- page: \`${payload.page}\``,
    "",
    "## Summary",
    "",
    `- maintenanceKnowledgeServices: \`${payload.catalogSummary.maintenanceKnowledgeServices}\``,
    `- maintenanceServicesSplit: \`${payload.catalogSummary.maintenanceServicesSplit}\``,
    `- maintenanceIndexServices: \`${payload.catalogSummary.maintenanceIndexServices}\``,
    `- finalTableServiceRows: \`${payload.catalogSummary.finalTableServiceRows}\``,
    `- missingRenderedServices: \`${payload.catalogSummary.missingRenderedServiceCount}\``,
    `- servicesWithoutModuleMeasureCount: \`${payload.catalogSummary.servicesWithoutModuleMeasureCount}\``,
    `- hiddenServicesWithoutModuleMeasure: \`${payload.catalogSummary.hiddenServicesWithoutModuleMeasure?.length || 0}\``,
    `- viewModelRows: \`${payload.viewModelSummary.rows}\``,
    `- currentSortRule: \`${payload.viewModelSummary.sortRule?.current || "unknown"}\``,
    `- previousWrongSortRule: \`${payload.viewModelSummary.sortRule?.previousWrongRule || "unknown"}\``,
    `- restoredFromCodeOrder: \`${payload.viewModelSummary.sortRule?.restoredFromCodeOrder ?? "unknown"}\``,
    `- renderedVisibleRows: \`${payload.renderSummary.renderedVisibleRows}\``,
    `- defaultGroupsExpanded: \`${payload.renderSummary.defaultGroupsExpanded}\``,
    `- localStorageStateVersion: \`${payload.renderSummary.localStorageStateVersion}\``,
    `- legacyV2StateIgnored: \`${payload.renderSummary.legacyV2StateIgnored}\``,
    `- legacyV3StateIgnored: \`${payload.renderSummary.legacyV3StateIgnored}\``,
    `- savedCollapsedV4StateWouldCollapseRows: \`${payload.renderSummary.savedCollapsedV4StateWouldCollapseRows}\``,
    "",
  ];
  if (payload.correctionSummary) {
    lines.push(
      "## Correction",
      "",
      `- rolledBackCodePrimarySort: \`${payload.correctionSummary.rolledBackCodePrimarySort}\``,
      `- currentSortRule: ${payload.correctionSummary.currentSortRule}`,
      `- previousWrongSortRule: ${payload.correctionSummary.previousWrongSortRule}`,
      `- realCause: ${payload.correctionSummary.realCause}`,
      `- fix: ${payload.correctionSummary.fix}`,
      `- residualVisualRisk: ${payload.correctionSummary.residualVisualRisk}`,
      "",
    );
  }
  if (payload.runtimeTraceSummary) {
    lines.push(
      "## Runtime Trace",
      "",
      `- routeFetched: \`${payload.runtimeTraceSummary.routeFetched}\``,
      `- routeStatus: \`${payload.runtimeTraceSummary.routeStatus}\``,
      `- pageTitle: \`${payload.runtimeTraceSummary.pageTitle || "unknown"}\``,
      `- selectedRoute: \`${payload.runtimeTraceSummary.selectedRoute}\``,
      `- selectedTabSource: \`${payload.runtimeTraceSummary.selectedTabSource}\``,
      `- dataClientScriptVersion: \`${payload.runtimeTraceSummary.dataClientScriptVersion || "unknown"}\``,
      `- viewModelsScriptVersion: \`${payload.runtimeTraceSummary.viewModelsScriptVersion || "unknown"}\``,
      `- tableScriptVersion: \`${payload.runtimeTraceSummary.tableScriptVersion || "unknown"}\``,
      `- appScriptVersion: \`${payload.runtimeTraceSummary.appScriptVersion || "unknown"}\``,
      `- browserVisualRegressionExecuted: \`${payload.runtimeTraceSummary.browserVisualRegressionExecuted}\``,
      `- browserVisualRegressionNote: ${payload.runtimeTraceSummary.browserVisualRegressionNote}`,
      `- userBrowserLocalStorageAccessible: \`${payload.runtimeTraceSummary.userBrowserLocalStorageAccessible}\``,
      "",
    );
  }
  lines.push("## Target Services", "");
  for (const target of payload.targetServices) {
    lines.push(
      `- \`${target.id}\` ${target.name}`,
      `  - expectedCapability: \`${target.expectedCapability || "n/a"}\``,
      `  - expectedFocus: \`${target.expectedFocus || "n/a"}\``,
      `  - groupPath: \`${target.groupPath}\``,
      `  - positionInGroup: \`${target.positionInGroup || "n/a"} / ${target.groupSize || "n/a"}\``,
      `  - sourceOrder: \`${target.sourceOrder ?? "n/a"}\``,
      `  - hasModuleMeasureRelation: \`${target.hasModuleMeasureRelation}\``,
      `  - filteredBecauseNoModuleMeasureRelation: \`${target.filteredBecauseNoModuleMeasureRelation}\``,
      `  - moduleMeasureColumnValue: \`${target.moduleMeasureColumnValue || "n/a"}\``,
      `  - securitySystemColumnValue: \`${target.securitySystemColumnValue || "n/a"}\``,
      `  - existsInDictionary: \`${target.existsInDictionary}\``,
      `  - existsInMaintenanceKnowledge: \`${target.existsInMaintenanceKnowledge}\``,
      `  - existsInMaintenanceServices: \`${target.existsInMaintenanceServices}\``,
      `  - existsInViewModel: \`${target.existsInViewModel}\``,
      `  - existsInGroupRows: \`${target.existsInGroupRows}\``,
      `  - existsInFilteredRows: \`${target.existsInFilteredRows}\``,
      `  - existsInRenderedRows: \`${target.existsInRenderedRows}\``,
      `  - existsInDom: \`${target.existsInDom}\``,
      `  - viewModelRowExists: \`${target.viewModelRowExists}\``,
      `  - renderedInDom: \`${target.renderedInDom}\``,
      `  - defaultVisibleWithoutSearch: \`${target.defaultVisibleWithoutSearch}\``,
      `  - searchableById: \`${target.searchableById}\``,
      `  - searchableByName: \`${target.searchableByName}\``,
      `  - visibleAfterIdSearch: \`${target.visibleAfterIdSearch}\``,
      `  - visibleAfterNameSearch: \`${target.visibleAfterNameSearch}\``,
      `  - reasonIfNotVisible: \`${target.reasonIfNotVisible || "none"}\``,
      `  - issues: \`${target.issues.join(", ") || "none"}\``,
    );
  }
  lines.push("", "## Issues", "");
  if (!payload.issues.length) {
    lines.push("- 无");
  } else {
    for (const issue of payload.issues) lines.push(`- ${issue}`);
  }
  lines.push("");
  return lines.join("\n");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
