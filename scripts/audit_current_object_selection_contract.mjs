import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

function read(relativePath) {
  return fs.readFileSync(relativePath, "utf8");
}

function loadViewModels() {
  const context = {
    window: {
      sapdDisplay: {},
    },
    console,
  };
  vm.createContext(context);
  vm.runInContext(read("frontend/capability-browser/viewModels.js"), context, { filename: "viewModels.js" });
  assert.equal(typeof context.window.sapdViewModels?.buildCapabilityWorkspaceViewModel, "function");
  assert.equal(typeof context.window.sapdViewModels?.buildApplicationSecurityLifecycleViewModel, "function");
  assert.equal(typeof context.window.sapdViewModels?.buildDataSecurityLifecycleViewModel, "function");
  assert.equal(typeof context.window.sapdViewModels?.buildMaintenanceWorkspaceViewModel, "function");
  return context.window.sapdViewModels;
}

function createCapabilityTree() {
  return {
    categories: [
      {
        id: "cap-cat-tech",
        type: "capability_category",
        code: "T",
        title: "技术能力",
        domains: [
          {
            id: "cap-domain-pd",
            type: "capability_domain",
            code: "T-PD",
            title: "被动防御",
            capabilities: [
              {
                id: "cap-application-protection",
                type: "capability",
                code: "T-PD.AP",
                title: "应用保护",
                focuses: [
                  {
                    id: "focus-app-watermark",
                    type: "capability_focus",
                    code: "T-PD.AP-01",
                    title: "应用页面水印",
                    description: "页面水印能力",
                    scope_mappings: [],
                    process_mappings: [],
                    security_works: [],
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  };
}

function createLifecycle() {
  return {
    application_security_development: {
      processes: [
        {
          id: "lcap-pr-01",
          code: "PR.01",
          order: "PR.01",
          title: "启动与规划",
          description: "开发前规划",
          main_activities: [{ id: "act-plan", title: "规划活动" }],
          security_activities: [],
          policy_requirements: [],
          development_types: [],
          development_technical_services: [],
          development_technical_modules: [],
          technical_services: [],
          technology_modules: [],
          technical_measures: [],
        },
        {
          id: "lcap-pr-07",
          code: "PR.07",
          order: "PR.07",
          title: "发布与运营",
          description: "发布阶段",
          main_activities: [{ id: "act-release", title: "发布评审" }],
          security_activities: [{ id: "sec-release", title: "上线安全检查" }],
          policy_requirements: [],
          development_types: [],
          development_technical_services: [],
          development_technical_modules: [],
          technical_services: [],
          technology_modules: [],
          technical_measures: [],
        },
      ],
    },
    data_lifecycle: {
      processes: [
        {
          id: "lcdt-collect",
          code: "LC-DT-01",
          order: "LC-DT-01",
          title: "数据收集",
          description: "收集数据",
          scenes: [{ id: "scene-collect", title: "采集场景", description: "采集数据" }],
          technical_services: [],
          technology_modules: [],
          technical_measures: [],
          data_policy_rows: [],
        },
        {
          id: "lcdt-provide",
          code: "LC-DT-05",
          order: "LC-DT-05",
          title: "数据提供",
          description: "对外提供数据",
          scenes: [{ id: "scene-provide", title: "接口提供", description: "提供接口" }],
          technical_services: [],
          technology_modules: [],
          technical_measures: [],
          data_policy_rows: [
            {
              id: "policy-provide",
              category: "一般数据",
              sequence: "1",
              policies: [{ level: "L1", text: "提供场景策略" }],
              technical_services: [],
              module_or_measure_items: [],
            },
          ],
        },
      ],
    },
  };
}

function createMaintenanceKnowledge() {
  return {
    scope_types: [
      { id: "scope-cloud", type: "scope_type", code: "SCOPE-01", title: "云平台" },
      { id: "scope-client", type: "scope_type", code: "SCOPE-02", title: "客户端" },
    ],
    section_counts: { scopes: 2 },
  };
}

function runBehaviorChecks() {
  const viewModels = loadViewModels();
  const capabilityTree = createCapabilityTree();
  const lifecycle = createLifecycle();
  const maintenance = createMaintenanceKnowledge();

  const capabilityDefault = viewModels.buildCapabilityWorkspaceViewModel({
    capabilityTree,
    management: {},
    standards: {},
    selectedCapabilityId: "",
    search: "",
    relationshipFilters: {},
  });
  assert.equal(capabilityDefault.selection.status, "default_landing");
  assert.equal(capabilityDefault.selectedCapability.id, "cap-cat-tech");

  const capabilityMiss = viewModels.buildCapabilityWorkspaceViewModel({
    capabilityTree,
    management: {},
    standards: {},
    selectedCapabilityId: "missing-capability",
    search: "",
    relationshipFilters: {},
  });
  assert.equal(capabilityMiss.selection.status, "target_missing");
  assert.equal(capabilityMiss.selectedCapability, null);
  assert.equal(capabilityMiss.localRelationMap, null);

  const devDefault = viewModels.buildApplicationSecurityLifecycleViewModel({
    lifecycle,
    selectedProcessId: "",
    search: "",
  });
  assert.equal(devDefault.selection.status, "default_landing");
  assert.equal(devDefault.relationshipSummary.selectedProcessId, "lcap-pr-01");

  const devMiss = viewModels.buildApplicationSecurityLifecycleViewModel({
    lifecycle,
    selectedProcessId: "missing-pr",
    search: "",
  });
  assert.equal(devMiss.selection.status, "target_missing");
  assert.equal(devMiss.relationshipSummary.selectedProcessId, null);
  assert.equal(devMiss.selectedStage, null);
  assert.match(devMiss.emptyState, /missing-pr/);

  const dataSearchPreview = viewModels.buildDataSecurityLifecycleViewModel({
    lifecycle,
    selectedProcessId: "lcdt-provide",
    search: "提供",
    selectionSource: "page_search",
  });
  assert.equal(dataSearchPreview.selection.status, "search_preview");
  assert.equal(dataSearchPreview.relationshipSummary.selectedProcessId, "lcdt-provide");
  assert.match(dataSearchPreview.selectedStage.title, /数据提供/);

  const dataMiss = viewModels.buildDataSecurityLifecycleViewModel({
    lifecycle,
    selectedProcessId: "missing-dt",
    search: "",
  });
  assert.equal(dataMiss.selection.status, "target_missing");
  assert.equal(dataMiss.relationshipSummary.selectedProcessId, null);
  assert.equal(dataMiss.relationRows.length, 0);

  const maintenanceDefault = viewModels.buildMaintenanceWorkspaceViewModel({
    capabilityTree,
    management: maintenance,
    section: "scopes",
    selectedId: "",
    search: "",
  });
  assert.equal(maintenanceDefault.selection.status, "default_landing");
  assert.equal(maintenanceDefault.selectedId, "scope-cloud");

  const maintenanceMiss = viewModels.buildMaintenanceWorkspaceViewModel({
    capabilityTree,
    management: maintenance,
    section: "scopes",
    selectedId: "missing-scope",
    search: "",
  });
  assert.equal(maintenanceMiss.selection.status, "target_missing");
  assert.equal(maintenanceMiss.selectedId, null);
  assert.match(maintenanceMiss.emptyState, /missing-scope/);
}

function runStaticChecks() {
  const appSource = read("frontend/capability-browser/app.js");
  const viewModelsSource = read("frontend/capability-browser/viewModels.js");
  const focusOverviewSource = read("frontend/capability-browser/components/FocusOverview.js");
  const lifecycleComponentSource = read("frontend/capability-browser/components/ApplicationSecurityLifecycle.js");

  assert.match(viewModelsSource, /function resolveCurrentObjectSelection/);
  assert.match(viewModelsSource, /status: "target_missing"/);
  assert.match(viewModelsSource, /status: "default_landing"/);
  assert.match(viewModelsSource, /status: selectionSource === "page_search" \? "search_preview" : "selected"/);

  assert(!focusOverviewSource.includes("focusOverview.current || rows[0]"), "FocusOverview must not infer current focus from rows[0].");
  assert(!lifecycleComponentSource.includes("relationRows[0]?.stageId"), "Lifecycle relation table must not infer selected stage from the first relation row.");
  assert(!viewModelsSource.includes("selectedRow = selectableRows.find((row) => row.id === selectedId) || selectableRows[0]"), "Maintenance selection must not fall back to selectableRows[0] for explicit targets.");
  assert(!appSource.includes("state.selectedDevProcessId = matchedStages[0].id"), "LC-AP page search must not persist the first search match as business selection.");
  assert(!appSource.includes("state.selectedDataProcessId = matchedStages[0].id"), "LC-DT page search must not persist the first search match as business selection.");
  assert(!appSource.includes("state.selectedContentId = rows[0]?.id || null"), "Content view must not overwrite explicit missing content target with rows[0].");
  assert(!viewModelsSource.includes('"应用页面水印"') || viewModelsSource.includes("title: \"应用页面水印\"") === false, "Search aliases must not special-case 应用页面水印 in viewModels.");
}

runBehaviorChecks();
runStaticChecks();

console.log("current object selection contract ok");
