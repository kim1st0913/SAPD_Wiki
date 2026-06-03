import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();

function readText(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8");
}

function readJson(relativePath) {
  return JSON.parse(readText(relativePath));
}

function contractBlock(source, name) {
  const start = source.indexOf(`const ${name}`);
  if (start < 0) return "";
  const end = source.indexOf("};", start);
  return end < 0 ? source.slice(start) : source.slice(start, end + 2);
}

function includesAll(source, values) {
  return values.every((value) => source.includes(value));
}

const appJs = readText("frontend/capability-browser/app.js");
const viewModelsJs = readText("frontend/capability-browser/viewModels.js");
const standardFrameworkTableJs = readText("frontend/capability-browser/components/StandardFrameworkTable.js");
const standardsIndex = readJson("frontend/capability-browser/public/data/standards-index.json");

const issues = [];
const maintenanceContract = contractBlock(appJs, "MAINTENANCE_PAGE_LOAD_CONTRACT");

if (!maintenanceContract) {
  issues.push({
    severity: "error",
    type: "missing_contract",
    message: "app.js 缺少 MAINTENANCE_PAGE_LOAD_CONTRACT。",
  });
}

const requiredMaintenanceChecks = [
  {
    page: "work-functions",
    values: ['"work-functions"', '"references"', '"processes"'],
    reason: "安全职能清单需要 references 和 processes 补齐 Gartner 与流程反向关系。",
  },
  {
    page: "references",
    values: ['"references"', '"work-functions"', '"processes"'],
    reason: "岗位 / 职能参考页需要 work-functions 和 processes 补齐反向映射。",
  },
  {
    page: "services",
    values: ['"services"', '"scopes"', '"modules"', '"measures"', '"capability"'],
    reason: "安全技术服务页需要作用域、模块、措施和能力包补齐关系展示。",
  },
  {
    page: "modules",
    values: ['"modules"', '"services"', '"scopes"', '"sharedLookups"'],
    reason: "安全技术模块页需要服务、作用域和 shared lookups 补齐关系展示。",
  },
];

for (const check of requiredMaintenanceChecks) {
  if (!includesAll(maintenanceContract, check.values)) {
    issues.push({
      severity: "error",
      type: "maintenance_contract_incomplete",
      page: check.page,
      message: check.reason,
    });
  }
}

const viewModelFieldExpectations = [
  {
    field: "security_processes",
    requiredContractValues: ['"processes"'],
  },
  {
    field: "gartner_roles",
    requiredContractValues: ['"references"'],
  },
  {
    field: "work_function_layers",
    requiredContractValues: ['"work-functions"'],
  },
  {
    field: "security_technical_measures",
    requiredContractValues: ['"measures"'],
  },
];

for (const expectation of viewModelFieldExpectations) {
  if (viewModelsJs.includes(expectation.field) && !includesAll(maintenanceContract, expectation.requiredContractValues)) {
    issues.push({
      severity: "error",
      type: "viewmodel_field_without_contract",
      field: expectation.field,
      message: `ViewModel 读取 ${expectation.field}，但加载契约未覆盖对应分片。`,
    });
  }
}

if (/sapdDataClient|getStandardFrameworkTable/.test(standardFrameworkTableJs)) {
  issues.push({
    severity: "error",
    type: "component_fetch",
    file: "frontend/capability-browser/components/StandardFrameworkTable.js",
    message: "标准 / 框架表格组件不得直接调用 dataClient；应由 app.js 统一加载。",
  });
}

if (!appJs.includes("activeStandardTableId") || !appJs.includes("ensureStandardFrameworkTableLoaded")) {
  issues.push({
    severity: "error",
    type: "standard_table_loader_missing",
    message: "app.js 缺少标准 / 框架 active table 状态或统一 table loader。",
  });
}

if (!appJs.includes('if (!state.loadedPackages.has("capability")) state.capability = capabilityTreeFromWorkbench(data);')) {
  issues.push({
    severity: "error",
    type: "capability_initial_overwrites_full_tree",
    message: "capabilityInitial / capabilityWorkbench 轻量树不得覆盖已加载的完整 capability-tree，否则安全能力清单描述会回退为待补充。",
  });
}

if (!appJs.includes("maintenancePackagesForPage") || !appJs.includes("ensureMaintenancePackageLoaded(missingMaintenancePackageName)")) {
  issues.push({
    severity: "error",
    type: "maintenance_required_package_self_heal_missing",
    message: "知识库维护页缺少必需数据包时必须由 renderMaintenance 主动触发加载，不能只依赖路由外层补加载。",
  });
}

if (!appJs.includes("activeTableLoading") || !appJs.includes("standardTableHasRows(activeTable)")) {
  issues.push({
    severity: "error",
    type: "standard_active_table_loading_guard_missing",
    message: "标准 / 框架 active tab 数据未加载完成时必须显示加载态，不能把暂时空表渲染成真实空数据。",
  });
}

const frameworks = Array.isArray(standardsIndex.frameworks) ? standardsIndex.frameworks : [];
for (const framework of frameworks) {
  const hasFrameworkPath = Boolean(framework.dataPath);
  const tabs = Array.isArray(framework.tabs) ? framework.tabs : [];
  if (!hasFrameworkPath && !tabs.length) {
    issues.push({
      severity: "error",
      type: "standard_framework_without_data_path",
      framework: framework.id,
      message: "标准 / 框架索引条目缺少 dataPath 或 tabs。",
    });
  }
  for (const tab of tabs) {
    if (!tab.dataPath) {
      issues.push({
        severity: "error",
        type: "standard_tab_without_data_path",
        framework: framework.id,
        table: tab.id,
        message: "标准 / 框架 tab 缺少 dataPath，无法纳入统一按需加载。",
      });
    }
  }
}

const result = {
  result: issues.some((issue) => issue.severity === "error") ? "fail" : "pass",
  checked: {
    maintenanceContract: Boolean(maintenanceContract),
    standardFrameworks: frameworks.length,
    standardTabs: frameworks.reduce((sum, framework) => sum + (Array.isArray(framework.tabs) ? framework.tabs.length : 0), 0),
    componentFetchForbidden: true,
  },
  issues,
};

console.log(JSON.stringify(result, null, 2));

if (result.result !== "pass") process.exit(1);
