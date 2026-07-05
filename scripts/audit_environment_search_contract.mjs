import fs from "node:fs";
import vm from "node:vm";

const viewModelsSource = fs.readFileSync("frontend/capability-browser/viewModels.js", "utf8");
const dataClientSource = fs.readFileSync("frontend/capability-browser/dataClient.js", "utf8");
const environmentTreeSource = fs.readFileSync("frontend/capability-browser/components/EnvironmentTree.js", "utf8");
const environmentLocalRelationMapSource = fs.readFileSync("frontend/capability-browser/components/EnvironmentLocalRelationMap.js", "utf8");
const environmentScopeServiceMatrixSource = fs.readFileSync("frontend/capability-browser/components/EnvironmentScopeServiceMatrix.js", "utf8");
const environmentBasemapViewerSource = fs.readFileSync("frontend/capability-browser/components/EnvironmentBasemapViewer.js", "utf8");
const appSource = fs.readFileSync("frontend/capability-browser/app.js", "utf8");
const stylesSource = fs.readFileSync("frontend/capability-browser/styles.css", "utf8");

function snippet(source, startNeedle, endNeedle) {
  const start = source.indexOf(startNeedle);
  if (start < 0) return "";
  const end = source.indexOf(endNeedle, start + startNeedle.length);
  return source.slice(start, end > start ? end : start + 1400);
}

function list(value) {
  return Array.isArray(value) ? value : [];
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const environmentInputHandler = snippet(appSource, 'if (event.target?.id !== "environmentSearchInput") return;', '$("devLifecycleStageSearch")?.addEventListener');
const drawioBasemapRenderer = snippet(environmentLocalRelationMapSource, "function renderDrawioBasemap", "function hierarchyNodeKind");
const environmentProjectionFinder = snippet(dataClientSource, "function findEnvironmentProjectionRow", "function environmentProjectionFromSplit");
const capabilityRelationshipsHandler = snippet(dataClientSource, "async getCapabilityRelationships", "async getCapabilityWorkspaceProjection");
const environmentRelationshipsHandler = snippet(dataClientSource, "async getEnvironmentRelationships", "async getMaintenanceScopes");
const projectedLocalRelationMapResolver = snippet(viewModelsSource, "function projectedLocalRelationMapFor", "function workbenchObjectsById");
const capabilitySelectedFocusRowBlock = snippet(viewModelsSource, "const selectedFocusRow =", "const detailRaw =");
const environmentSelectionFinder = snippet(viewModelsSource, "function findEnvironmentSelection", "function buildEnvironmentScopeServiceRows");

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
      environmentInputHandler.includes("setScopedSearch(event.target.value)") &&
      environmentInputHandler.includes('queuePageSearchReveal(event.target.value, "environment-mapping")') &&
      environmentInputHandler.includes("renderEnvironment()") &&
      !environmentInputHandler.includes("activeEnvironmentTab =") &&
      !environmentInputHandler.includes("state.globalSearch"),
    message: "环境页搜索必须写入页面 scope，保留当前环境 tab，不能写入顶部全局搜索。",
  },
  {
    id: "environment_search_input_preserves_active_tab",
    ok:
      environmentLocalRelationMapSource.includes("environment-workspace-control-row page-local-search-toolbar") &&
      environmentLocalRelationMapSource.includes("renderEnvironmentSearchControl(search)") &&
      environmentInputHandler.includes("setScopedSearch(event.target.value)") &&
      !environmentInputHandler.includes('state.activeEnvironmentTab = "mapping"') &&
      !environmentInputHandler.includes("state.activeEnvironmentTab = 'mapping'"),
    message: "环境局部搜索输入时不得强制切到“信息化环境-安全技术”tab。",
  },
  {
    id: "environment_basemap_tab_has_no_local_search",
    ok:
      drawioBasemapRenderer.includes("components.EnvironmentBasemapViewer") &&
      !drawioBasemapRenderer.includes("toolbarSearch") &&
      !drawioBasemapRenderer.includes("renderEnvironmentSearchControl") &&
      environmentBasemapViewerSource.includes("${toolbarLeading || titleBlock}") &&
      environmentBasemapViewerSource.includes("environment-basemap-lab-head-tools"),
    message: "信息化环境视图底图 tab 不得渲染局部搜索；底图工具栏只保留画布操作并居右。",
  },
  {
    id: "environment_search_has_visible_match_navigation",
    ok:
      environmentLocalRelationMapSource.includes("renderEnvironmentSearchControl(search)") &&
      environmentLocalRelationMapSource.includes("environment-search-control page-search-control") &&
      !environmentLocalRelationMapSource.includes("source-catalog-tools page-search-control") &&
      environmentLocalRelationMapSource.includes('data-page-search-status="environment-mapping"') &&
      environmentLocalRelationMapSource.includes('data-page-search-step="-1"') &&
      environmentLocalRelationMapSource.includes('data-page-search-step="1"') &&
      environmentLocalRelationMapSource.includes("服务、模块、措施或系统"),
    message: "环境页搜索入口必须复用统一 page-search-control，并提供命中计数与上一个/下一个控件。",
  },
  {
    id: "environment_search_uses_object_match_queue",
    ok:
      appSource.includes("function environmentSearchObjectMatches") &&
      appSource.includes("function updateEnvironmentPageSearchNavigation") &&
      appSource.includes("function moveEnvironmentPageSearchMatch") &&
      appSource.includes('scope === "environment-mapping" && moveEnvironmentPageSearchMatch') &&
      appSource.includes("updateEnvironmentPageSearchNavigation(viewModel)") &&
      appSource.includes("object?.searchText") &&
      appSource.includes("selectedEnvironmentObjectId = nextMatch.objectId"),
    message: "环境页页面内搜索必须维护跨对象命中队列，不能只依赖当前可见 DOM 的第一条命中。",
  },
  {
    id: "environment_matrix_nodes_expose_copy_text",
    ok:
      environmentScopeServiceMatrixSource.includes('data-copy-text="${utils.escapeHtml(utils.codeTitleOf(row.service))}"') &&
      environmentScopeServiceMatrixSource.includes('data-copy-text="${utils.escapeHtml(utils.codeTitleOf(row.target))}"') &&
      environmentScopeServiceMatrixSource.includes('data-copy-text="${utils.escapeHtml(utils.codeTitleOf(row.system))}"') &&
      environmentScopeServiceMatrixSource.includes('data-copy-text="${utils.escapeHtml(utils.codeTitleOf(node.item))}"'),
    message: "环境右侧矩阵的服务、模块/措施和安全系统节点必须暴露 data-copy-text，供页面内搜索和全局搜索定位。",
  },
  {
    id: "environment_global_search_reveals_left_catalog",
    ok:
      appSource.includes("function revealEnvironmentCatalogSelection") &&
      appSource.includes('const root = $("environmentTree")') &&
      appSource.includes('"data-environment-object-id"') &&
      appSource.includes('"data-environment-segment-id"') &&
      appSource.includes('"data-environment-id"') &&
      appSource.includes("state.environmentCatalogCollapsed = false") &&
      appSource.includes("revealEnvironmentCatalogSelection(result)"),
    message: "全局搜索定位环境关系节点时，必须同步滚动左侧环境对象树到选中对象。",
  },
  {
    id: "environment_search_position_uses_tab_toolbars",
    ok:
      !environmentLocalRelationMapSource.includes("environment-shared-search-rail") &&
      !stylesSource.includes(".environment-shared-search-rail") &&
      !stylesSource.includes(".environment-search-rail") &&
      !drawioBasemapRenderer.includes("toolbarSearch") &&
      !drawioBasemapRenderer.includes("renderEnvironmentSearchControl") &&
      !environmentLocalRelationMapSource.includes("toolbarLeading: renderEnvironmentSearchControl(search)") &&
      environmentLocalRelationMapSource.includes("environment-workspace-control-row page-local-search-toolbar") &&
      environmentBasemapViewerSource.includes("toolbarSearch") &&
      stylesSource.includes(".environment-workspace-control-row") &&
      stylesSource.includes(".environment-workspace-control-row.page-local-search-toolbar") &&
      stylesSource.includes("margin: -12px -12px 0") &&
      stylesSource.includes("--page-local-search-toolbar-height") &&
      stylesSource.includes("--page-local-search-width") &&
      stylesSource.includes(".environment-basemap-lab-toolbar.page-local-search-toolbar") &&
      stylesSource.includes(".environment-workspace-control-row.page-local-search-toolbar .environment-search-control.page-search-control") &&
      appSource.includes('queuePageSearchReveal(event.target.value, "environment-mapping")') &&
      appSource.includes("oi154-search-toolbar-align-20260703-1") &&
      appSource.includes("oi154-basemap-search-remove-20260703-1"),
    message: "环境页搜索必须复用页面内搜索基线；安全技术 tab 保留搜索，底图 tab 删除搜索并将画布操作按钮居右，不得再出现独立共享白条。",
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
    id: "environment_unselected_keeps_workspace_shell",
    ok:
      !appSource.includes('if (!viewModel.selectedEnvironment && !text(state.search).trim())') &&
      environmentLocalRelationMapSource.includes("isSearchEmpty") &&
      environmentLocalRelationMapSource.includes("environment-search-empty") &&
      environmentLocalRelationMapSource.includes("environment-selection-empty") &&
      environmentLocalRelationMapSource.includes("const hasSelection = Boolean(viewModel?.selectedMode)") &&
      environmentLocalRelationMapSource.includes("renderDrawioBasemap()") &&
      environmentLocalRelationMapSource.includes("未找到匹配的信息化环境对象。请调整页面内搜索条件。") &&
      appSource.includes("oi154-search-p8-20260703-1"),
    message: "环境页无默认当前对象时仍必须渲染底图和目录；选择提示只能出现在第二 tab 右侧详情区。",
  },
  {
    id: "explicit_selection_miss_does_not_use_first_row_fallback",
    ok:
      dataClientSource.includes("function environmentProjectionRequestHasTarget") &&
      environmentProjectionFinder.includes("const matched =") &&
      environmentProjectionFinder.includes("return null;") &&
      !environmentProjectionFinder.includes("|| rows[0]") &&
      capabilityRelationshipsHandler.includes("const requestedId = text(id).trim()") &&
      !capabilityRelationshipsHandler.includes("|| rows[0]") &&
      environmentRelationshipsHandler.includes("const requestedId = text(id).trim()") &&
      environmentRelationshipsHandler.includes("const relationshipRows = row ? rows : []") &&
      !environmentRelationshipsHandler.includes("const row = rows[0]") &&
      projectedLocalRelationMapResolver.includes("if (selectedFocusId)") &&
      projectedLocalRelationMapResolver.includes("return null;") &&
      capabilitySelectedFocusRowBlock.includes("const selectedFocusRow = selectedId ? rows.find") &&
      !capabilitySelectedFocusRowBlock.includes("|| rows[0]") &&
      environmentSelectionFinder.includes("if (!query) return null;") &&
      environmentSelectionFinder.includes('selectionSource: "search"') &&
      appSource.includes("const canSyncEnvironmentSelection = viewModel.selectionSource === \"explicit\" || viewModel.selectionSource === \"search\""),
    message: "显式对象 / projection 请求未命中时不能用第一条 rows[0] / maps[0] 伪装当前对象。",
  },
  {
    id: "environment_tab_state_has_single_source",
    ok:
      environmentLocalRelationMapSource.includes('data-environment-active-tab="${escape(normalizedActiveTab)}"') &&
      environmentLocalRelationMapSource.includes("environment-tab-panel-mapping") &&
      environmentLocalRelationMapSource.includes("is-active") &&
      !environmentLocalRelationMapSource.includes('type="radio"') &&
      !environmentLocalRelationMapSource.includes('name="environmentDetailTab"') &&
      !environmentLocalRelationMapSource.includes("environment-tab-input") &&
      appSource.includes('data-environment-tab="${escapeHtml(tab.id)}"') &&
      appSource.includes("state.activeEnvironmentTab = nextEnvironmentTab === \"mapping\" ? \"mapping\" : \"topology\"") &&
      !appSource.includes('event.target?.name !== "environmentDetailTab"') &&
      !appSource.includes("environmentTabMapping") &&
      stylesSource.includes(".environment-tab-panel.is-active") &&
      appSource.includes("oi154-single-tab-state-20260704-1"),
    message: "环境页 tab 只能由页头按钮写入 state.activeEnvironmentTab；组件内部不得再有 radio 状态入口。",
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
            services: [
              {
                id: "service-report",
                code: "I-AP&T-CG.CG-01",
                title: "报表访问控制",
                modules: [
                  {
                    id: "module-report-zero-trust",
                    title: "零信任访问控制台",
                    systems: [{ id: "system-report-zero-trust", title: "零信任访问控制台" }],
                  },
                ],
                measures: [],
              },
            ],
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
const initial = buildSearchViewModel("");

const componentSandbox = {
  window: {
    sapdComponents: {
      utils: {
        list,
        escapeHtml,
        codeTitleOf(item, fallback = "") {
          const code = String(item?.code || "").trim();
          const title = String(item?.title || item?.name || fallback || "").trim();
          return [code, title].filter(Boolean).join(" ");
        },
      },
      EnvironmentBasemapViewer: {
        render() {
          return '<div data-basemap-probe="true"></div>';
        },
      },
      EnvironmentTree: {
        render({ navigationTree } = {}) {
          return `<nav data-environment-tree-probe="${list(navigationTree).length}"></nav>`;
        },
      },
      EnvironmentScopeServiceMatrix: {
        render() {
          return '<div data-environment-matrix-probe="true"></div>';
        },
      },
    },
  },
  console,
};
vm.createContext(componentSandbox);
vm.runInContext(environmentLocalRelationMapSource, componentSandbox, { filename: "EnvironmentLocalRelationMap.js" });
const initialTopologyMarkup = componentSandbox.window.sapdComponents.EnvironmentLocalRelationMap.render({
  viewModel: initial,
  activeTab: "topology",
});
const initialMappingMarkup = componentSandbox.window.sapdComponents.EnvironmentLocalRelationMap.render({
  viewModel: initial,
  activeTab: "mapping",
  search: "",
});

const runtimeChecks = [
  {
    id: "environment_search_selects_object_by_security_system",
    ok: zeroTrust.selectedObject?.id === "obj-api-gateway" && zeroTrust.navigationTree?.[0]?.objects?.length === 2,
    message: "按安全系统搜索时，应切换到包含该系统的首个对象，并保留所有匹配对象供上下切换。",
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
  {
    id: "environment_unselected_initial_state_does_not_select_first_object",
    ok:
      !initial.selectedEnvironment &&
      !initial.selectedObject &&
      Array.isArray(initial.navigationTree) &&
      initial.navigationTree?.[0]?.objects?.length === 2,
    message: "未显式选择且无搜索词时，环境页不得默认选中第一个对象。",
  },
  {
    id: "environment_unselected_initial_render_keeps_basemap_and_catalog",
    ok:
      initialTopologyMarkup.includes('data-basemap-probe="true"') &&
      initialTopologyMarkup.includes('data-environment-active-tab="topology"') &&
      !initialTopologyMarkup.includes("environment-tab-input") &&
      initialMappingMarkup.includes('data-environment-tree-probe="1"') &&
      initialMappingMarkup.includes('data-environment-active-tab="mapping"') &&
      initialMappingMarkup.includes("environment-selection-empty") &&
      !initialMappingMarkup.includes("environment-tab-input") &&
      !initialMappingMarkup.includes("environment-statistics-view"),
    message: "未显式选择且无搜索词时，第一 tab 必须渲染底图，第二 tab 必须保留目录且右侧只显示选择提示。",
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
