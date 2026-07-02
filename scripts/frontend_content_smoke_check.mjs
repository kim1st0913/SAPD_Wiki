#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { join } from "node:path";
import vm from "node:vm";

const PROJECT_ROOT = process.cwd();
const DATA_ROOT = join(PROJECT_ROOT, "frontend/capability-browser/public/data");
const DEFAULT_BASE_URL = "http://127.0.0.1:5173";

const capabilityCases = [
  { objectType: "capability_category", objectId: "T", minManagementRows: 1, minStandardControls: 1 },
  { objectType: "capability_domain", objectId: "T-AS", minManagementRows: 1, minStandardControls: 1 },
  { objectType: "capability_domain", objectId: "G-SP", minManagementRows: 1 },
  { objectType: "capability", objectId: "T-AS.AD", minManagementRows: 1, minStandardControls: 1 },
  { objectType: "capability_focus", objectId: "T-AS.AD-01", minManagementRows: 1, minStandardControls: 1 },
  { objectType: "capability_focus", objectId: "T-PD.PP-02", minManagementRows: 1, expectedSecurityWork: "边界防护策略持续管理" },
];

const technicalServiceVisibilityCases = [
  { code: "I-DI&T-AS.AD-01", title: "数据分库分表", expectedGroup: "I-DI 数据与信息", expectedFocus: "网络安全体系架构管控能力 / 遵循安全设计原则对网络安全架构进行设计和管控", expectedModuleMeasureColumn: "数据安全存储", expectedPositionInGroup: 1 },
  { code: "I-NT&T-AS.AD-01", title: "网络平面及区域划分", expectedGroup: "I-NT 网络", expectedFocus: "网络安全体系架构管控能力 / 遵循安全设计原则对网络安全架构进行设计和管控", expectedPositionInGroup: 1 },
  { code: "I-AP&T-AS.AD-01", title: "应用架构管控", expectedGroup: "I-AP 软件应用", expectedFocus: "网络安全体系架构管控能力 / 遵循安全设计原则对网络安全架构进行设计和管控", expectedPositionInGroup: 1 },
  { code: "I-OS&T-AS.AD-01", title: "主机/终端安全工作区划分", expectedGroup: "I-OS 操作系统（主机/终端）", expectedFocus: "网络安全体系架构管控能力 / 遵循安全设计原则对网络安全架构进行设计和管控", expectedPositionInGroup: 1 },
  { code: "I-PE&T-AS.AD-01", title: "物理区域分区", expectedGroup: "I-PE 物理环境", expectedFocus: "网络安全体系架构管控能力 / 遵循安全设计原则对网络安全架构进行设计和管控", expectedPositionInGroup: 1 },
];

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function hasFlag(name) {
  return process.argv.includes(name);
}

function list(value) {
  return Array.isArray(value) ? value : [];
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function readJson(relativePath) {
  return JSON.parse(readFileSync(join(DATA_ROOT, relativePath), "utf8"));
}

function resolveDataPath(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (raw.startsWith("./public/data/")) return raw.slice("./public/data/".length);
  if (raw.startsWith("public/data/")) return raw.slice("public/data/".length);
  return raw;
}

function readFrontendFile(relativePath) {
  return readFileSync(join(PROJECT_ROOT, "frontend/capability-browser", relativePath), "utf8");
}

function text(value) {
  return value == null ? "" : String(value).trim();
}

function htmlToText(html) {
  return String(html || "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
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

function renderTechnicalServiceTable(viewModel, search = "") {
  const localStore = new Map();
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
  vm.createContext(context);
  vm.runInContext(readFrontendFile("components/TechnicalServiceMaintenanceTable.js"), context, { filename: "TechnicalServiceMaintenanceTable.js" });
  const renderer = context.window.sapdComponents.TechnicalServiceMaintenanceTable;
  assert(renderer?.render, "TechnicalServiceMaintenanceTable.render is unavailable");
  return renderer.render({
    rows: viewModel.rows,
    scopeGroups: viewModel.serviceScopeGroups,
    selectedId: "",
    emptyState: viewModel.emptyState,
    search,
  });
}

function renderCapabilityDirectoryTable(viewModel, search = "") {
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
        },
      },
    },
  };
  context.window.window = context.window;
  vm.createContext(context);
  vm.runInContext(readFrontendFile("components/CapabilityDirectoryMaintenanceTable.js"), context, { filename: "CapabilityDirectoryMaintenanceTable.js" });
  const renderer = context.window.sapdComponents.CapabilityDirectoryMaintenanceTable;
  assert(renderer?.render, "CapabilityDirectoryMaintenanceTable.render is unavailable");
  return renderer.render({
    rows: viewModel.rows,
    capabilityGroups: viewModel.capabilityGroups,
    selectedId: "",
    emptyState: viewModel.emptyState,
    search,
  });
}

function unwrapEnvelope(payload) {
  return payload && typeof payload === "object" && Object.prototype.hasOwnProperty.call(payload, "data") ? payload.data : payload;
}

function groupCount(workbench, groupId) {
  const group = list(workbench.relationshipGroups).find((item) => item.id === groupId);
  return Number(group?.count ?? list(group?.relationIds).length ?? 0);
}

function countFocusBindings(capabilityTree) {
  const counts = { focuses: 0, securityWorkFocuses: 0, processMappingFocuses: 0 };
  const visit = (node) => {
    if (!node || typeof node !== "object") return;
    if (node.type === "capability_focus") {
      counts.focuses += 1;
      if (list(node.security_works).length) counts.securityWorkFocuses += 1;
      if (list(node.process_mappings).length) counts.processMappingFocuses += 1;
    }
    for (const key of ["domains", "capabilities", "focuses", "children"]) {
      for (const child of list(node[key])) visit(child);
    }
  };
  for (const category of list(capabilityTree.categories)) visit(category);
  return counts;
}

function validateLocalPackages() {
  const indexHtml = readFrontendFile("index.html");
  const maintenance = readJson("maintenance-knowledge.json");
  const maintenanceIndex = readJson("maintenance-index.json");
  const securityWorks = readJson("maintenance/security-works.json");
  const technicalMeasures = readJson("maintenance/measures.json");
  const processes = readJson("maintenance/processes.json");
  const workFunctions = readJson("maintenance/work-functions.json");
  const capabilityTree = readJson("capability-tree.json");
  const capabilityWorkbench = readJson("capability-workbench.json");
  const standards = readJson("standards-data.json");
  const nistCsfCore = readJson("standards/nist-csf-2/csf-core.json");
  const iso27001 = readJson("standards/iso-27001-2022.json");
  const dspScf = readJson("standards/dsp-level-2/dsp-scf-controls-2026.json");
  const cisCsc = readJson("standards/cis-csc-v8.json");
  const lifecycle = readJson("lifecycle-knowledge.json");
  const lifecycleWorkbench = readJson("lifecycle-workbench.json");

  const focusBindings = countFocusBindings(capabilityTree);
  const workbenchCounts = capabilityWorkbench.meta?.stats || {};
  const relationshipCounts = {
    managementMapping: groupCount(capabilityWorkbench, "management-mapping"),
    processMapping: groupCount(capabilityWorkbench, "process-mapping"),
    standardMapping: groupCount(capabilityWorkbench, "standard-mapping"),
  };

  const cacheVersion = "p0-baseline-canonical-correction-20260615-1";
  const technicalServiceOrderVisibilityVersion = "technical-service-order-visibility-20260615-2";
  const searchStateIsolationVersion = "global-search-20260617-9";
  const globalSearchVersion = "global-search-20260617-9";
  assert(indexHtml.includes(`dataClient.js?v=${cacheVersion}`), "index.html does not cache-bust dataClient.js for P0 capability work recovery");
  assert(indexHtml.includes(`viewModels.js?v=${searchStateIsolationVersion}`), "index.html does not cache-bust viewModels.js for search state isolation fix");
  assert(indexHtml.includes(`StandardRoleReferenceTable.js?v=${cacheVersion}`), "index.html does not cache-bust security work table component for P0 capability work recovery");
  assert(indexHtml.includes(`app.js?v=${globalSearchVersion}`), "index.html does not cache-bust app.js for global search implementation");
  assert(indexHtml.includes(`AppShell.js?v=${globalSearchVersion}`), "index.html does not cache-bust AppShell.js for global search implementation");
  assert(indexHtml.includes(`styles.css?v=${globalSearchVersion}`), "index.html does not cache-bust styles.css for global search implementation");
  assert(indexHtml.includes(`ApplicationSecurityLifecycle.js?v=${globalSearchVersion}`), "index.html does not cache-bust ApplicationSecurityLifecycle.js for lifecycle search implementation");
  assert(indexHtml.includes(`StandardFrameworkTable.js?v=${globalSearchVersion}`), "index.html does not cache-bust StandardFrameworkTable.js for standard search reveal anchors");
  assert(indexHtml.includes(`TechnicalServiceMaintenanceTable.js?v=${technicalServiceOrderVisibilityVersion}`), "index.html does not cache-bust TechnicalServiceMaintenanceTable.js for technical service order visibility fix");
  assert(indexHtml.includes("CapabilityDirectoryMaintenanceTable.js?v=capability-directory-definitions-20260702-1"), "index.html does not cache-bust CapabilityDirectoryMaintenanceTable.js for L0/L1 definition display");
  const viewModelsSource = readFrontendFile("viewModels.js");
  const appSource = readFrontendFile("app.js");
  const lifecycleComponentSource = readFrontendFile("components/ApplicationSecurityLifecycle.js");
  const stylesSource = readFrontendFile("styles.css");
  const technicalServiceComparator = viewModelsSource.match(/function compareTechnicalServiceRows\([\s\S]*?\n  \}/)?.[0] || "";
  assert(!/\b(?:sortOrder|sourceOrder|order)\b[\s\S]{0,80}\|\|\s*(?:999999|Infinity|0|null)/.test(technicalServiceComparator), "technical service comparator must not use truthy OR fallback for order fields");
  assert(viewModelsSource.includes("function lifecycleWorkbenchStageSearchText"), "lifecycle stage search must build text from stage cell content");
  assert(viewModelsSource.includes("uses_development_technical_module"), "lifecycle stage search must include development technical module workbench relations");
  assert(appSource.includes('["development_technical_modules", "开发技术模块"]'), "global search must index LC-AP development technical modules");
  assert(appSource.includes("search: state.devLifecycleStageSearch"), "LC-AP local search must use dedicated lifecycle search state");
  assert(lifecycleComponentSource.includes("row.searchText"), "lifecycle navigation search must include stage searchText");
  assert(lifecycleComponentSource.includes("lifecycle-search-mark"), "lifecycle search must visibly highlight matched cell text");
  assert(stylesSource.includes(".lifecycle-search-mark") && stylesSource.includes("annotationGlowSweep"), "lifecycle search highlight must reuse the annotation highlight visual baseline");
  assert(stylesSource.includes(".global-search-target-highlight") && stylesSource.includes("annotationSoftPulse"), "global search target highlight must reuse the annotation active highlight visual baseline");
  assert(appSource.includes("function lifecycleSearchValueTargetElement"), "global search result activation must prefer lifecycle matched values");
  assert(appSource.includes("function globalSearchTextTargetElement"), "global search result activation must fall back to current-page text targets");
  assert(appSource.includes("function activeGlobalSearchRootElement"), "global search text fallback must be scoped to the active workspace");
  assert(appSource.includes("return globalSearchTextTargetElement(result);"), "global search target resolution must not stop at route-only activation");
  assert(appSource.includes("function queuePageSearchReveal") && appSource.includes("function revealPageSearchTarget"), "page search boxes must queue content-level reveal after rendering");
  assert(appSource.includes("page-search-target-highlight") && stylesSource.includes(".page-search-target-highlight"), "page search matches must use a visible target highlight");
  assert(appSource.includes("queuePageSearchReveal(event.target.value, \"development-security\")") && appSource.includes("queuePageSearchReveal(event.target.value, \"data-security\")"), "LC-AP and LC-DT page search boxes must reveal matched content");
  assert(appSource.includes("clearGlobalSearchPanel({ keepQuery: true })") && appSource.includes("setScopedSearch(activationQuery)"), "global search activation must keep the search query and pass it to page search");
  assert(appSource.includes("data-standard-row-text") && readFrontendFile("components/StandardFrameworkTable.js").includes("data-standard-row-text"), "standard/framework search must expose row-level anchors for clause reveal");
  assert(indexHtml.includes('id="globalSearchActionButton"'), "global search shortcut affordance must be an actionable button");

  assert(list(maintenance.security_works).length > 0, "maintenance-knowledge.security_works is empty");
  validateTechnicalMeasures({ maintenance, technicalMeasures, maintenanceIndex });
  assert(list(securityWorks.security_works).length > 0, "maintenance/security-works.json is empty");
  assert(list(processes.security_processes).length > 0, "maintenance/processes.json is empty");
  assert(list(workFunctions.work_function_layers).length > 0, "maintenance/work-functions.json is empty");
  assert((maintenanceIndex.section_counts || {})["security-works"] > 0, "maintenance-index security-works count is empty");
  assert(focusBindings.focuses === 91, `capability-tree focus count changed: ${focusBindings.focuses}`);
  assert(focusBindings.securityWorkFocuses === 91, `security work focus bindings incomplete: ${focusBindings.securityWorkFocuses}`);
  assert(focusBindings.processMappingFocuses >= 89, `process mapping focus bindings incomplete: ${focusBindings.processMappingFocuses}`);
  assert(Number(workbenchCounts.security_work || 0) > 0, "capability-workbench has no security_work objects");
  assert(Number(workbenchCounts.work_function || 0) > 0, "capability-workbench has no work_function objects");
  assert(Number(workbenchCounts.standard_control || 0) > 0, "capability-workbench has no standard_control objects");
  assert(relationshipCounts.managementMapping > 0, "capability-workbench management-mapping group is empty");
  assert(relationshipCounts.processMapping > 0, "capability-workbench process-mapping group is empty");
  assert(relationshipCounts.standardMapping > 0, "capability-workbench standard-mapping group is empty");
  assert(Number(standards.stats?.controls || 0) > 0, "standards-data controls are empty");
  assert(list(nistCsfCore.rows).length > 0, "NIST CSF 2.0 split rows are empty");
  assert(list(iso27001.rows).length > 0, "ISO/IEC 27001:2022 split rows are empty");
  assert(list(dspScf.rows).length > 0, "DSP SCF split rows are empty");
  assert(list(cisCsc.rows).length > 0, "CIS CSC v8 split rows are empty");
  assert(Number(lifecycle.stats?.application_processes || 0) > 0, "LC-AP lifecycle processes are empty");
  assert(Number(lifecycle.stats?.data_processes || 0) > 0, "LC-DT lifecycle processes are empty");
  assert(Number(lifecycleWorkbench.meta?.stats?.relations || 0) > 0, "lifecycle-workbench relations are empty");
  const lcapProcesses = list(lifecycle?.application_security_development?.processes);
  const lifecycleJiraProcess = lcapProcesses.find((process) =>
    list(process?.development_technical_modules).some((module) => text(module?.title || module?.name) === "Jira"),
  );
  assert(lifecycleJiraProcess, "LC-AP source package must contain Jira in development technical modules");

  const viewModelSmoke = validateSecurityWorkViewModel({ capabilityTree, maintenance });
  const technicalServiceSmoke = validateTechnicalServiceCatalogViewModel({ capabilityTree, maintenance });
  const capabilityDirectoryDefinitionSmoke = validateCapabilityDirectoryDefinitions({ capabilityTree, maintenance });
  const standardCanonicalSmoke = validateCapabilityStandardCanonicalization({
    capabilityTree,
    capabilityWorkbench,
    standards: loadAllStandardFrameworkRows(standards),
  });

  return {
    maintenance: {
      securityWorks: list(maintenance.security_works).length,
      splitSecurityWorks: list(securityWorks.security_works).length,
      securityTechnicalMeasures: list(maintenance.security_technical_measures).length,
      splitSecurityTechnicalMeasures: list(technicalMeasures.security_technical_measures).length,
      securityProcesses: list(processes.security_processes).length,
      workFunctionLayers: list(workFunctions.work_function_layers).length,
    },
    capability: {
      focusBindings,
      objects: {
        securityWork: Number(workbenchCounts.security_work || 0),
        workFunction: Number(workbenchCounts.work_function || 0),
        processGroup: Number(workbenchCounts.process_group || 0),
        processReference: Number(workbenchCounts.process_reference || 0),
        standardControl: Number(workbenchCounts.standard_control || 0),
      },
      relationshipCounts,
    },
    standards: {
      frameworks: Number(standards.stats?.frameworks || 0),
      controls: Number(standards.stats?.controls || 0),
      nistCsfCoreRows: list(nistCsfCore.rows).length,
      iso27001Rows: list(iso27001.rows).length,
      dspScfRows: list(dspScf.rows).length,
      cisCscRows: list(cisCsc.rows).length,
    },
    lifecycle: {
      applicationProcesses: Number(lifecycle.stats?.application_processes || 0),
      dataProcesses: Number(lifecycle.stats?.data_processes || 0),
      relations: Number(lifecycleWorkbench.meta?.stats?.relations || 0),
    },
    viewModels: {
      ...viewModelSmoke,
      technicalServiceCatalogVisibility: technicalServiceSmoke,
      capabilityDirectoryDefinitions: capabilityDirectoryDefinitionSmoke,
      capabilityStandardCanonicalization: standardCanonicalSmoke,
    },
  };
}

function validateTechnicalMeasures({ maintenance, technicalMeasures, maintenanceIndex }) {
  const expectedMeasureCount = 32;
  const requiredMeasures = ["应用程序威胁建模", "制品安全加固", "IaC代码安全测试", "数据销毁", "API网关", "应用自身数据加解密模块"];
  const maintenanceMeasures = list(maintenance.security_technical_measures);
  const splitMeasures = list(technicalMeasures.security_technical_measures);
  const names = new Set(maintenanceMeasures.map((item) => item.name || item.title).filter(Boolean));
  const splitNames = new Set(splitMeasures.map((item) => item.name || item.title).filter(Boolean));
  assert(maintenanceMeasures.length === expectedMeasureCount, `maintenance-knowledge security_technical_measures should be ${expectedMeasureCount}, got ${maintenanceMeasures.length}`);
  assert(splitMeasures.length === expectedMeasureCount, `maintenance/measures security_technical_measures should be ${expectedMeasureCount}, got ${splitMeasures.length}`);
  assert(Number(maintenance.stats?.security_technical_measures || 0) === expectedMeasureCount, `maintenance-knowledge stats.security_technical_measures should be ${expectedMeasureCount}`);
  assert(Number(technicalMeasures.stats?.security_technical_measures || 0) === expectedMeasureCount, `maintenance/measures stats.security_technical_measures should be ${expectedMeasureCount}`);
  assert(Number(maintenanceIndex.section_counts?.measures || 0) === expectedMeasureCount, `maintenance-index section_counts.measures should be ${expectedMeasureCount}`);
  for (const name of requiredMeasures) {
    assert(names.has(name), `maintenance-knowledge missing confirmed lifecycle measure: ${name}`);
    assert(splitNames.has(name), `maintenance/measures missing confirmed lifecycle measure: ${name}`);
  }
  const duplicateNames = maintenanceMeasures
    .map((item) => item.name || item.title)
    .filter(Boolean)
    .filter((name, index, all) => all.indexOf(name) !== index);
  assert(duplicateNames.length === 0, `security_technical_measures contains duplicate names: ${[...new Set(duplicateNames)].join(", ")}`);
}

function validateCapabilityDirectoryDefinitions({ capabilityTree, maintenance }) {
  const context = { window: {}, console };
  vm.createContext(context);
  vm.runInContext(readFrontendFile("viewModels.js"), context, { filename: "viewModels.js" });
  const viewModels = context.window.sapdViewModels || {};
  assert(typeof viewModels.buildMaintenanceWorkspaceViewModel === "function", "buildMaintenanceWorkspaceViewModel is unavailable");
  const viewModel = viewModels.buildMaintenanceWorkspaceViewModel({
    capabilityTree,
    management: maintenance,
    maintenance,
    lifecycle: {},
    standards: {},
    section: "capability-directory",
    search: "安全",
  });
  const renderedText = htmlToText(renderCapabilityDirectoryTable(viewModel, "安全"));
  const category = list(capabilityTree.categories).find((item) => text(item?.title).includes("安全技术能力"));
  const domain = list(category?.domains).find((item) => text(item?.code) === "T-AS");
  assert(text(category?.description), "capability-tree L0 security technology definition is empty");
  assert(text(domain?.description), "capability-tree L1 T-AS definition is empty");
  assert(renderedText.includes(text(category.description).slice(0, 24)), "安全能力清单未渲染 L0 能力分类定义");
  assert(renderedText.includes(text(domain.description).slice(0, 24)), "安全能力清单未渲染 L1 能力域定义");
  assert(renderedText.includes("定义 / 描述"), "安全能力清单表头应为定义 / 描述");
  return {
    category: category?.title || "",
    domain: domain?.code || "",
    renderedCategoryDefinition: true,
    renderedDomainDefinition: true,
  };
}

function validateSecurityWorkViewModel({ capabilityTree, maintenance }) {
  const context = { window: {}, console };
  vm.createContext(context);
  vm.runInContext(readFrontendFile("viewModels.js"), context, { filename: "viewModels.js" });
  const viewModels = context.window.sapdViewModels || {};
  assert(typeof viewModels.buildMaintenanceWorkspaceViewModel === "function", "buildMaintenanceWorkspaceViewModel is unavailable");
  const viewModel = viewModels.buildMaintenanceWorkspaceViewModel({
    capabilityTree,
    maintenance,
    section: "security-works",
    search: "",
  });
  const rows = list(viewModel.rows);
  const titleKey = (value) => String(value || "").trim().replace(/\s+/g, "");
  const focusOrderMap = new Map();
  list(capabilityTree.categories).forEach((category) => {
    list(category.domains).forEach((domain) => {
      list(domain.capabilities).forEach((capability) => {
        list(capability.focuses).forEach((focus) => {
          const order = focusOrderMap.size;
          if (text(focus.id)) focusOrderMap.set(`id:${text(focus.id)}`, order);
          if (text(focus.code)) focusOrderMap.set(`code:${text(focus.code)}`, order);
        });
      });
    });
  });
  const focusOrder = (focus) => {
    const byId = focusOrderMap.get(`id:${text(focus?.id)}`);
    if (Number.isFinite(byId)) return byId;
    const byCode = focusOrderMap.get(`code:${text(focus?.code)}`);
    if (Number.isFinite(byCode)) return byCode;
    return Number.MAX_SAFE_INTEGER;
  };
  const rowFocusOrder = (row) => Math.min(...list(row.relatedFocuses).map(focusOrder), Number.MAX_SAFE_INTEGER);
  const expectedLogicalWorks = new Set(list(maintenance.security_works).map((row) => titleKey(row.title || row.name || row.code || row.id)).filter(Boolean));
  const uniqueWorks = new Set(rows.map((row) => titleKey(row.title || row.rawId)).filter(Boolean));
  const navigationSecurityWorks = list(viewModel.navigationItems).find((item) => item.id === "security-works");
  const tabSecurityWorks = list(viewModel.sectionTabs).find((item) => item.id === "security-works");
  assert(rows.length > 0, "security-works ViewModel rows are empty");
  assert(!viewModel.emptyState, `security-works ViewModel returned emptyState: ${viewModel.emptyState}`);
  assert(rows.length === expectedLogicalWorks.size, `security-works ViewModel rows ${rows.length} != logical work count ${expectedLogicalWorks.size}`);
  assert(uniqueWorks.size === expectedLogicalWorks.size, `security-works ViewModel unique works ${uniqueWorks.size} != logical work count ${expectedLogicalWorks.size}`);
  assert(Number(navigationSecurityWorks?.count || 0) === expectedLogicalWorks.size, `security-works navigation count ${navigationSecurityWorks?.count || 0} != logical work count ${expectedLogicalWorks.size}`);
  assert(Number(tabSecurityWorks?.count || 0) === expectedLogicalWorks.size, `security-works tab count ${tabSecurityWorks?.count || 0} != logical work count ${expectedLogicalWorks.size}`);
  const aggregatedNetworkAccessWork = rows.find((row) => row.title === "网络访问控制策略持续管理");
  assert(aggregatedNetworkAccessWork, "security-works ViewModel missing 网络访问控制策略持续管理");
  const networkAccessFocusCodes = new Set(list(aggregatedNetworkAccessWork.relatedFocuses).map((focus) => focus.code));
  assert(networkAccessFocusCodes.has("T-PD.AC-01") && networkAccessFocusCodes.has("T-PD.AC-02"), "网络访问控制策略持续管理 should aggregate T-PD.AC-01 and T-PD.AC-02");
  const displayCodes = rows.map((row) => text(row.displayCode)).filter(Boolean);
  const multiCodeRows = rows.filter((row) => list(row.displayCodes).length !== 1 || list(row.displayCodes)[0] !== row.displayCode);
  assert(displayCodes.length === rows.length, `security-works unique display code missing for ${rows.length - displayCodes.length} rows`);
  assert(new Set(displayCodes).size === displayCodes.length, "security-works display codes should be unique per logical work");
  assert(multiCodeRows.length === 0, `security-works should render one display code per logical work, got ${multiCodeRows.length} multi-code rows`);
  const rowOrders = rows.map(rowFocusOrder);
  const outOfOrderIndex = rowOrders.findIndex((order, index) => index > 0 && order < rowOrders[index - 1]);
  assert(outOfOrderIndex < 0, `security-works rows should follow capability-focus source order, first out-of-order row index=${outOfOrderIndex + 1}`);
  assert(!/SW-T-PD\.AC-\d{2}-\d{2}/.test(aggregatedNetworkAccessWork.displayCode || ""), "网络访问控制策略持续管理 code should not be focus-derived");
  const intrusionRuleWork = rows.find((row) => row.title === "入侵检测规则持续管理");
  assert(intrusionRuleWork, "security-works ViewModel missing 入侵检测规则持续管理");
  assert(!/SW-T-PD\.TP-\d{2}-\d{2}/.test(intrusionRuleWork.displayCode || ""), "入侵检测规则持续管理 code should not be focus-derived");
  return {
    securityWorkRows: rows.length,
    uniqueSecurityWorks: uniqueWorks.size,
    packageSecurityWorkRows: list(maintenance.security_works).length,
    navigationSecurityWorks: Number(navigationSecurityWorks?.count || 0),
    tabSecurityWorks: Number(tabSecurityWorks?.count || 0),
    linkedCapabilities: Number(viewModel.summary?.linkedCapabilities || 0),
    linkedFocuses: Number(viewModel.summary?.linkedFocuses || 0),
    relationRows: Number(viewModel.summary?.relationRows || 0),
  };
}

function validateTechnicalServiceCatalogViewModel({ capabilityTree, maintenance }) {
  const context = { window: {}, console };
  vm.createContext(context);
  vm.runInContext(readFrontendFile("viewModels.js"), context, { filename: "viewModels.js" });
  const viewModels = context.window.sapdViewModels || {};
  assert(typeof viewModels.buildMaintenanceWorkspaceViewModel === "function", "buildMaintenanceWorkspaceViewModel is unavailable");
  const viewModel = viewModels.buildMaintenanceWorkspaceViewModel({
    capabilityTree,
    maintenance,
    section: "services",
    search: "",
  });
  const rows = list(viewModel.rows);
  const serviceCount = list(maintenance.security_technical_services).length;
  assert(serviceCount === 160, `maintenance-knowledge security_technical_services should be 160, got ${serviceCount}`);
  assert(rows.length === serviceCount, `technical service ViewModel rows ${rows.length} != package services ${serviceCount}`);
  assert(!viewModel.emptyState, `technical service ViewModel returned emptyState: ${viewModel.emptyState}`);
  const codeSortedRows = [...rows].sort((left, right) => String(left.code || "").localeCompare(String(right.code || ""), "zh-Hans-CN", { numeric: true, sensitivity: "base" }));
  const codeOrderMatchesDefault = rows.every((row, index) => row.code === codeSortedRows[index]?.code);
  assert(!codeOrderMatchesDefault, "technical service default rows must not use service code as primary order");
  const groups = list(viewModel.serviceScopeGroups);
  const defaultHtml = renderTechnicalServiceTable(viewModel, "");
  const defaultText = htmlToText(defaultHtml);
  const visibleDefaultRows = rows.filter((row) => rowVisibleInHtml(defaultHtml, row)).length;
  assert(visibleDefaultRows === serviceCount, `technical service rendered visible rows ${visibleDefaultRows} != package services ${serviceCount}`);
  const checks = [];
  for (const target of technicalServiceVisibilityCases) {
    const row = rows.find((item) => item.code === target.code && item.title === target.title);
    assert(row, `technical service ViewModel missing ${target.code} ${target.title}`);
    const group = groups.find((item) => list(item.rows).some((groupRow) => groupRow.code === target.code && groupRow.title === target.title));
    assert(group, `technical service ViewModel did not group ${target.code} ${target.title}`);
    assert((group.label || group.title || group.id) === target.expectedGroup, `technical service group mismatch for ${target.code}: ${group.label || group.title || group.id}`);
    const positionInGroup = list(group.rows).findIndex((groupRow) => groupRow.code === target.code && groupRow.title === target.title) + 1;
    if (target.expectedPositionInGroup) {
      assert(positionInGroup === target.expectedPositionInGroup, `technical service position mismatch for ${target.code}: ${positionInGroup} != ${target.expectedPositionInGroup}`);
    }
    assert(row.ownershipFocuses?.some((item) => item.title === target.expectedFocus), `technical service focus path mismatch for ${target.code}`);
    assert(defaultText.includes(`${target.code} ${target.title}`), `technical service default DOM text missing ${target.code} ${target.title}`);
    const targetRowHtml = rowHtml(defaultHtml, row);
    const targetRowText = htmlToText(targetRowHtml);
    assert(targetRowText.includes(`${target.code} ${target.title}`), `technical service final table row missing ${target.code} ${target.title}`);
    if (list(row.linkedModuleMeasures).length) {
      const expectedRelation = target.expectedModuleMeasureColumn || row.linkedModuleMeasures[0]?.title || row.linkedModuleMeasures[0]?.name || row.linkedModuleMeasures[0]?.code;
      assert(targetRowText.includes(expectedRelation), `technical service module/measure column missing ${expectedRelation} for ${target.code}`);
    } else {
      assert(targetRowText.includes("/"), `technical service without module/measure should show empty relation marker for ${target.code}`);
    }
    const byId = viewModels.buildMaintenanceWorkspaceViewModel({ capabilityTree, maintenance, section: "services", search: target.code });
    const byName = viewModels.buildMaintenanceWorkspaceViewModel({ capabilityTree, maintenance, section: "services", search: target.title });
    assert(list(byId.rows).some((item) => item.code === target.code && item.title === target.title), `technical service search by id failed for ${target.code}`);
    assert(list(byName.rows).some((item) => item.code === target.code && item.title === target.title), `technical service search by name failed for ${target.code}`);
    assert(htmlToText(renderTechnicalServiceTable(byId, target.code)).includes(`${target.code} ${target.title}`), `technical service search-by-id DOM missing ${target.code}`);
    assert(htmlToText(renderTechnicalServiceTable(byName, target.title)).includes(`${target.code} ${target.title}`), `technical service search-by-name DOM missing ${target.code}`);
    checks.push({
      code: target.code,
      title: target.title,
      group: group.label || group.title || group.id,
      focus: row.ownershipFocuses?.[0]?.title || "",
      viewModelIndex: row.index,
      sourceOrder: row.sourceOrder,
      positionInGroup,
      searchableById: true,
      searchableByName: true,
    });
  }
  return {
    packageServices: serviceCount,
    viewModelRows: rows.length,
    renderedVisibleRows: visibleDefaultRows,
    groupCount: groups.length,
    defaultCodeOrderPrimary: codeOrderMatchesDefault,
    targetServices: checks,
  };
}

function loadAllStandardFrameworkRows(standards) {
  const loadedFrameworks = {};
  for (const framework of list(standards.frameworks)) {
    const hydrated = { ...framework };
    if (list(framework.tabs).length) {
      hydrated.tabs = list(framework.tabs).map((tab) => ({
        ...tab,
        rows: readJson(resolveDataPath(tab.dataPath)).rows || [],
      }));
    } else if (framework.dataPath) {
      hydrated.rows = readJson(resolveDataPath(framework.dataPath)).rows || [];
    }
    loadedFrameworks[framework.id] = hydrated;
  }
  return { ...standards, loadedFrameworks };
}

function compactKey(value) {
  return String(value || "").trim().toLowerCase().replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "");
}

function standardKey(item = {}) {
  const code = item.frameworkCode || item.code;
  return code ? `code:${compactKey(code)}` : `title:${compactKey(item.frameworkTitle || item.title || item.name || item.id)}`;
}

function controlKey(item = {}) {
  return `${compactKey(item.frameworkCode || item.frameworkTitle)}:${String(item.originalControlId || item.code || item.title || "").trim().toLowerCase().replace(/\s+/g, "")}`;
}

function isPlaceholderControl(item = {}) {
  const normalized = String(item.originalControlId || item.code || "").trim().toLowerCase();
  return !normalized || ["/", "n/a", "na", "none", "null", "待补充", "暂无", "未编号", "待确认"].includes(normalized);
}

function duplicateCount(rows, keyFn) {
  const seen = new Set();
  let duplicates = 0;
  for (const row of list(rows)) {
    const key = keyFn(row);
    if (!key) continue;
    if (seen.has(key)) duplicates += 1;
    seen.add(key);
  }
  return duplicates;
}

function findWorkbenchObjectByCode(workbench, code) {
  for (const group of Object.values(workbench.objects || {})) {
    for (const item of Object.values(group || {})) {
      if (item?.code === code) return item;
    }
  }
  return null;
}

function validateCapabilityStandardCanonicalization({ capabilityTree, capabilityWorkbench, standards }) {
  const context = { window: {}, console };
  vm.createContext(context);
  vm.runInContext(readFrontendFile("viewModels.js"), context, { filename: "viewModels.js" });
  const viewModels = context.window.sapdViewModels || {};
  assert(typeof viewModels.buildCapabilityWorkspaceViewModel === "function", "buildCapabilityWorkspaceViewModel is unavailable");
  const cases = ["T-PD.PP-01", "T-AS.AD-01", "G-SP"];
  const checks = [];
  for (const code of cases) {
    const selected = findWorkbenchObjectByCode(capabilityWorkbench, code);
    assert(selected?.id, `${code}: capability workbench object not found`);
    const viewModel = viewModels.buildCapabilityWorkspaceViewModel({
      capabilityWorkbench,
      capabilityTree,
      capabilityProjection: null,
      management: {},
      standards,
      selectedCapabilityId: selected.id,
      search: "",
      relationshipFilters: {},
    });
    const frameworks = list(viewModel.localRelationMap?.standards?.frameworks);
    const controls = list(viewModel.localRelationMap?.standards?.controls);
    const dictionaryTitleByCode = new Map(list(standards.frameworks).map((item) => [item.frameworkCode || item.code, item.title || item.name]));
    const duplicateStandards = duplicateCount(frameworks, standardKey);
    const duplicateControls = duplicateCount(controls.filter((item) => !isPlaceholderControl(item)), controlKey);
    const placeholderControls = controls.filter(isPlaceholderControl).length;
    assert(duplicateStandards === 0, `${code}: duplicate canonical standard rows ${duplicateStandards}`);
    assert(duplicateControls === 0, `${code}: duplicate canonical controls ${duplicateControls}`);
    assert(placeholderControls === 0, `${code}: placeholder controls entered official display ${placeholderControls}`);
    for (const framework of frameworks) {
      const frameworkCode = framework.frameworkCode || framework.code;
      const dictionaryTitle = dictionaryTitleByCode.get(frameworkCode);
      if (dictionaryTitle) {
        assert((framework.title || framework.name) === dictionaryTitle, `${code}: standard display name for ${frameworkCode} is not sourced from standards dictionary`);
      }
    }
    checks.push({
      code,
      standards: frameworks.length,
      controls: controls.length,
      duplicateStandards,
      duplicateControls,
      placeholderControls,
    });
  }
  return checks;
}

async function fetchJson(baseUrl, path, searchParams = {}) {
  const url = new URL(path, baseUrl);
  for (const [key, value] of Object.entries(searchParams)) {
    url.searchParams.set(key, value);
  }
  const response = await fetch(url);
  assert(response.ok, `${url.toString()} returned ${response.status}`);
  return unwrapEnvelope(await response.json());
}

function hasExpectedSecurityWork(row, expectedTitle) {
  return list(row.securityWorks).some((item) => String(item?.title || item?.name || "").trim() === expectedTitle);
}

function validateManagementRows(item, rows) {
  assert(rows.length >= item.minManagementRows, `${item.objectId}: management rows ${rows.length} < ${item.minManagementRows}`);
  const rowsMissingSecurityWorks = rows.filter((row) => !list(row.securityWorks).length);
  assert(rowsMissingSecurityWorks.length === 0, `${item.objectId}: ${rowsMissingSecurityWorks.length} management rows have no securityWorks`);
  const rowsWithStakeholders = rows.filter((row) => list(row.stakeholders).length);
  const rowsWithProcesses = rows.filter((row) => list(row.processGroups).length || list(row.processReferences).length);
  assert(rowsWithStakeholders.length > 0, `${item.objectId}: no management row has stakeholders`);
  assert(rowsWithProcesses.length > 0, `${item.objectId}: no management row has process groups or references`);
  if (item.expectedSecurityWork) {
    assert(rows.some((row) => hasExpectedSecurityWork(row, item.expectedSecurityWork)), `${item.objectId}: missing security work ${item.expectedSecurityWork}`);
  }
}

async function validateApiContent(baseUrl) {
  const checks = [];
  await fetchJson(baseUrl, "/api/v1/health");
  const maintenanceSection = await fetchJson(baseUrl, "/api/v1/maintenance/security-works");
  assert(list(maintenanceSection.items).length > 0, "API /maintenance/security-works returned no items");

  for (const item of capabilityCases) {
    const data = await fetchJson(baseUrl, "/api/v1/capabilities/workspace-view", {
      object_type: item.objectType,
      object_id: item.objectId,
    });
    const managementRows = list(data.managementMappingRows);
    const standardControls = Number(data.tabs?.standards?.controlCount || 0);
    validateManagementRows(item, managementRows);
    if (item.minStandardControls) {
      assert(standardControls >= item.minStandardControls, `${item.objectId}: standard controls ${standardControls} < ${item.minStandardControls}`);
    }
    checks.push({
      objectType: item.objectType,
      objectId: item.objectId,
      dataState: data.dataState || data.data_state,
      managementRows: managementRows.length,
      standardControls,
      rowsWithSecurityWorks: managementRows.filter((row) => list(row.securityWorks).length).length,
      rowsWithStakeholders: managementRows.filter((row) => list(row.stakeholders).length).length,
      rowsWithProcesses: managementRows.filter((row) => list(row.processGroups).length || list(row.processReferences).length).length,
    });
  }

  return {
    baseUrl,
    maintenanceSecurityWorks: list(maintenanceSection.items).length,
    capabilityCases: checks,
  };
}

async function main() {
  const baseUrl = argValue("--url", DEFAULT_BASE_URL).replace(/\/$/, "");
  const skipApi = hasFlag("--skip-api");
  const localPackages = validateLocalPackages();
  const api = skipApi ? { skipped: true } : await validateApiContent(baseUrl);
  console.log(JSON.stringify({ result: "pass", localPackages, api }, null, 2));
}

main().catch((error) => {
  console.error(JSON.stringify({ result: "fail", error: error.message }, null, 2));
  process.exit(1);
});
