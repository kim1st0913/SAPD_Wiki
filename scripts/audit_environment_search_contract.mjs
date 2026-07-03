import fs from "node:fs";
import vm from "node:vm";

const viewModelsSource = fs.readFileSync("frontend/capability-browser/viewModels.js", "utf8");
const environmentTreeSource = fs.readFileSync("frontend/capability-browser/components/EnvironmentTree.js", "utf8");
const environmentLocalRelationMapSource = fs.readFileSync("frontend/capability-browser/components/EnvironmentLocalRelationMap.js", "utf8");
const appSource = fs.readFileSync("frontend/capability-browser/app.js", "utf8");

function snippet(source, startNeedle, endNeedle) {
  const start = source.indexOf(startNeedle);
  if (start < 0) return "";
  const end = source.indexOf(endNeedle, start + startNeedle.length);
  return source.slice(start, end > start ? end : start + 1400);
}

const environmentInputHandler = snippet(appSource, 'if (event.target?.id !== "environmentSearchInput") return;', '$("devLifecycleStageSearch")?.addEventListener');

const staticChecks = [
  {
    id: "environment_search_indexes_relation_nodes",
    ok:
      viewModelsSource.includes("function buildEnvironmentNavigationTree") &&
      viewModelsSource.includes("environmentObjectRelationNodes") &&
      viewModelsSource.includes("environmentObjectSecuritySystems") &&
      viewModelsSource.includes("environmentObjectSearchValues") &&
      viewModelsSource.includes("environmentObjectMatchesSearch"),
    message: "环境页页面内搜索必须把模块、措施和安全系统纳入对象匹配文本。",
  },
  {
    id: "environment_tree_rows_expose_search_anchors",
    ok:
      environmentTreeSource.includes('data-copy-text="${utils.escapeHtml(copyText)}"') &&
      environmentTreeSource.includes("未找到匹配的信息化环境对象") &&
      environmentTreeSource.includes("请调整页面内搜索条件。"),
    message: "环境树行必须暴露可定位文本，搜索无结果时显示局部空态。",
  },
  {
    id: "environment_search_state_is_scoped",
    ok:
      environmentInputHandler.includes('if (event.target?.id !== "environmentSearchInput") return;') &&
      environmentInputHandler.includes("if (isComposingSearchInput(event)) return;") &&
      environmentInputHandler.includes('state.activeEnvironmentTab = "mapping";') &&
      environmentInputHandler.includes("setScopedSearch(event.target.value)") &&
      environmentInputHandler.includes('queuePageSearchReveal(event.target.value, "environment-mapping")') &&
      environmentInputHandler.includes("renderEnvironment()") &&
      !environmentInputHandler.includes("state.globalSearch"),
    message: "环境页搜索必须写入页面 scope，不能写入顶部全局搜索。",
  },
  {
    id: "environment_search_has_visible_match_navigation",
    ok:
      environmentLocalRelationMapSource.includes("environment-shared-search-rail") &&
      environmentLocalRelationMapSource.includes("renderEnvironmentSearchRail(search)") &&
      environmentLocalRelationMapSource.includes("environment-search-control page-search-control") &&
      !environmentLocalRelationMapSource.includes("source-catalog-tools page-search-control") &&
      environmentLocalRelationMapSource.includes('data-page-search-status="environment-mapping"') &&
      environmentLocalRelationMapSource.includes('data-page-search-step="-1"') &&
      environmentLocalRelationMapSource.includes('data-page-search-step="1"') &&
      environmentLocalRelationMapSource.includes("服务、模块、措施或系统"),
    message: "环境页搜索入口必须位于主工作区搜索栏，并提供命中计数与上一个/下一个控件。",
  },
  {
    id: "environment_search_position_is_workspace_rail",
    ok:
      environmentLocalRelationMapSource.indexOf("environment-shared-search-rail") < environmentLocalRelationMapSource.indexOf("environment-tab-panels") &&
      appSource.includes('queuePageSearchReveal(event.target.value, "environment-mapping")') &&
      fs.readFileSync("frontend/capability-browser/styles.css", "utf8").includes(".environment-shared-search-rail"),
    message: "环境页搜索必须是两种环境 tab 共用的工作区顶部控制带，不得继续挤在左侧对象树或单个映射 tab 里。",
  },
  {
    id: "environment_search_preserves_input_focus",
    ok:
      appSource.includes("SEARCH_COMPOSITION_INPUT_SELECTOR") &&
      appSource.includes("#environmentSearchInput") &&
      environmentInputHandler.includes("const cursor = event.target.selectionStart") &&
      environmentInputHandler.includes('restoreSearchInputFocus("environmentSearchInput", cursor)'),
    message: "环境页搜索重渲染后必须恢复输入焦点和光标，避免无法连续输入。",
  },
  {
    id: "environment_search_empty_keeps_workspace_shell",
    ok:
      appSource.includes('if (!viewModel.selectedEnvironment && !text(state.search).trim())') &&
      environmentLocalRelationMapSource.includes("isSearchEmpty") &&
      environmentLocalRelationMapSource.includes("environment-search-empty") &&
      environmentLocalRelationMapSource.includes("未找到匹配的信息化环境对象。请调整页面内搜索条件。") &&
      appSource.includes("oi154-search-p7-20260703-1"),
    message: "环境页搜索无命中时必须保留搜索栏、对象树和工作区，只显示局部无结果空态。",
  },
];

const sandbox = {
  window: { sapdDisplay: {} },
  console,
};
vm.createContext(sandbox);
vm.runInContext(viewModelsSource, sandbox, { filename: "viewModels.js" });

const fakeEnvironmentScopeTree = [
  {
    id: "env-cloud",
    title: "云数据中心",
    objects: [
      {
        id: "obj-api-gateway",
        title: "API网关层",
        description: "承载 API 接入、网关和应用访问控制。",
        segments: [{ id: "seg-business-app", title: "业务应用" }],
        scope_mappings: [
          {
            scope: { id: "scope-ap", code: "I-AP", title: "软件应用" },
            services: [
              {
                id: "service-app-redundancy",
                code: "I-AP&T-AS.AD-02",
                title: "应用冗余",
                modules: [
                  {
                    id: "module-api-gateway",
                    code: "MOD-API",
                    title: "API网关",
                    systems: [{ id: "system-zero-trust", title: "零信任访问控制台" }],
                  },
                ],
                measures: [
                  {
                    id: "measure-watermark",
                    code: "ME-WM",
                    title: "应用页面水印",
                    systems: [{ id: "system-watermark", title: "应用安全防护" }],
                  },
                ],
              },
            ],
          },
        ],
      },
      {
        id: "obj-report",
        title: "报表服务",
        segments: [{ id: "seg-business-app", title: "业务应用" }],
        scope_mappings: [
          {
            scope: { id: "scope-ap", code: "I-AP", title: "软件应用" },
            services: [{ id: "service-report", code: "I-AP&T-CG.CG-01", title: "报表访问控制", modules: [], measures: [] }],
          },
        ],
      },
    ],
  },
];

function buildSearchViewModel(search) {
  return sandbox.window.sapdViewModels.buildEnvironmentWorkspaceViewModel({
    environmentWorkbench: { __data_state: "ready" },
    environmentWorkbenchViewModel: {
      dataState: "ready",
      environmentScopeTree: fakeEnvironmentScopeTree,
      objects: { information_object: {}, security_technical_measure: {} },
      objectCounts: { information_object: 2 },
      relationCount: 1,
      warnings: [],
    },
    selectedObjectId: "",
    selectedEnvironmentId: "",
    selectedSegmentId: "",
    search,
  });
}

const zeroTrust = buildSearchViewModel("零信任访问控制台");
const measure = buildSearchViewModel("应用页面水印");
const service = buildSearchViewModel("I-AP&T-AS.AD-02");
const missing = buildSearchViewModel("不存在的环境对象");

const runtimeChecks = [
  {
    id: "environment_search_selects_object_by_security_system",
    ok: zeroTrust.selectedObject?.id === "obj-api-gateway" && zeroTrust.navigationTree?.[0]?.objects?.length === 1,
    message: "按安全系统搜索时，应切换到包含该系统的对象。",
  },
  {
    id: "environment_search_selects_object_by_measure",
    ok: measure.selectedObject?.id === "obj-api-gateway" && measure.relationshipSummary?.measureCount === 1,
    message: "按安全技术措施搜索时，应切换到包含该措施的对象。",
  },
  {
    id: "environment_search_selects_object_by_service_code",
    ok: service.selectedObject?.id === "obj-api-gateway" && service.relationshipSummary?.serviceCount === 1,
    message: "按安全技术服务编码搜索时，应切换到包含该服务的对象。",
  },
  {
    id: "environment_search_missing_keeps_local_empty_state",
    ok: !missing.selectedEnvironment && Array.isArray(missing.navigationTree) && missing.navigationTree.length === 0,
    message: "无匹配时应形成局部空态，不伪装成数据包缺失。",
  },
];

const checks = [...staticChecks, ...runtimeChecks];
const failures = checks.filter((check) => !check.ok);
const report = {
  status: failures.length ? "fail" : "pass",
  checkCount: checks.length,
  failureCount: failures.length,
  failures,
};

console.log(JSON.stringify(report, null, 2));
if (failures.length) process.exitCode = 1;
