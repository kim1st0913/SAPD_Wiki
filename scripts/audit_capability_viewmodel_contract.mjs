#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import vm from "node:vm";

const DEFAULT_BASE_URL = "http://127.0.0.1:5173";

const cases = [
  { code: "T", objectType: "capability_category", expectedLocalRelationMapSource: "backend_projection" },
  { code: "T-AS", objectType: "capability_domain", expectedLocalRelationMapSource: "backend_projection" },
  { code: "T-AS.AD", objectType: "capability", expectedLocalRelationMapSource: "backend_projection" },
  { code: "T-AS.AD-01", objectType: "capability_focus", expectedLocalRelationMapSource: "backend_projection", minStandardControls: 1 },
  { code: "T-PD.PP", objectType: "capability", expectedLocalRelationMapSource: "backend_projection", expectedSecurityWorkByFocus: { "T-PD.PP-01": "边界防护策略持续管理", "T-PD.PP-02": "边界防护策略持续管理", "T-PD.PP-03": "边界防护策略持续管理" } },
  { code: "T-PD.PP-02", objectType: "capability_focus", expectedLocalRelationMapSource: "backend_projection", expectedSecurityWorkByFocus: { "T-PD.PP-02": "边界防护策略持续管理" } },
  { code: "T-PD.PP-03", objectType: "capability_focus", expectedLocalRelationMapSource: "backend_projection", expectedSecurityWorkByFocus: { "T-PD.PP-03": "边界防护策略持续管理" } },
  { code: "T-PD.AC-01", objectType: "capability_focus", expectedLocalRelationMapSource: "backend_projection", minStandardControls: 1 },
  { code: "T-OF", objectType: "capability_domain", expectedLocalRelationMapSource: "backend_projection" },
  { code: "T-OF.AT", objectType: "capability", expectedLocalRelationMapSource: "backend_projection" },
  { code: "T-OF.AT-02", objectType: "capability_focus", expectedLocalRelationMapSource: "backend_projection" },
  { code: "G-SP.SM-02", objectType: "capability_focus", expectedLocalRelationMapSource: "backend_projection" },
];

const forbiddenMainKeys = new Set([
  "sheet",
  "row",
  "column",
  "raw_value",
  "source_file",
  "import_id",
  "source_id",
  "source_ref",
  "source_label",
  "debug",
  "raw",
  "metadata",
  "intermediate",
  "generated_at",
]);

function argValue(name, fallback) {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function unwrapEnvelope(payload) {
  return payload && typeof payload === "object" && Object.prototype.hasOwnProperty.call(payload, "data") ? payload.data : payload;
}

function list(value) {
  return Array.isArray(value) ? value : [];
}

function text(value) {
  return value == null ? "" : String(value);
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function keysMatch(left, right) {
  const leftKeys = [left?.id, left?.code].map(text).filter(Boolean);
  const rightKeys = [right?.id, right?.code].map(text).filter(Boolean);
  return leftKeys.some((key) => rightKeys.includes(key));
}

function titleOf(item) {
  return text(item?.title || item?.name || item?.code).trim();
}

function statsCount(payload, key) {
  const candidates = [
    payload?.stats?.[key],
    payload?.maintenance_index?.stats?.[key],
    payload?.maintenanceIndex?.stats?.[key],
  ];
  for (const candidate of candidates) {
    const number = Number(candidate);
    if (Number.isFinite(number) && number > 0) return number;
  }
  return 0;
}

function findForbiddenKey(value, path = "") {
  if (!value || typeof value !== "object") return null;
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      const found = findForbiddenKey(value[index], `${path}[${index}]`);
      if (found) return found;
    }
    return null;
  }
  for (const [key, nested] of Object.entries(value)) {
    const nextPath = path ? `${path}.${key}` : key;
    if (forbiddenMainKeys.has(key)) return nextPath;
    const found = findForbiddenKey(nested, nextPath);
    if (found) return found;
  }
  return null;
}

function flattenCapabilityItems(capabilityTree) {
  const rows = [];
  for (const category of list(capabilityTree?.categories)) {
    rows.push({ ...category, type: category.type || "capability_category" });
    for (const domain of list(category.domains)) {
      rows.push({ ...domain, type: domain.type || "capability_domain" });
      for (const capability of list(domain.capabilities)) {
        rows.push({ ...capability, type: capability.type || "capability" });
        for (const focus of list(capability.focuses)) rows.push({ ...focus, type: focus.type || "capability_focus" });
      }
    }
  }
  return rows;
}

function capabilityCodeForItem(item) {
  const code = text(item?.code).trim();
  if (code) return code;
  if (item?.type === "capability_category") {
    const titleParts = text(item?.title || item?.name).trim().split(/\s+/);
    return titleParts[titleParts.length - 1] || "";
  }
  return "";
}

function findCapabilityItem(capabilityTree, item) {
  return flattenCapabilityItems(capabilityTree).find((row) => row.type === item.objectType && capabilityCodeForItem(row) === item.code);
}

function focusIdsForItem(capabilityTree, target) {
  const focusIds = [];
  for (const category of list(capabilityTree?.categories)) {
    if (target.type === "capability_category" && category.id === target.id) {
      return list(category.domains).flatMap((domain) => list(domain.capabilities).flatMap((capability) => list(capability.focuses).map((focus) => focus.id)));
    }
    for (const domain of list(category.domains)) {
      if (target.type === "capability_domain" && domain.id === target.id) {
        return list(domain.capabilities).flatMap((capability) => list(capability.focuses).map((focus) => focus.id));
      }
      for (const capability of list(domain.capabilities)) {
        if (target.type === "capability" && capability.id === target.id) {
          return list(capability.focuses).map((focus) => focus.id);
        }
        for (const focus of list(capability.focuses)) {
          if (target.type === "capability_focus" && focus.id === target.id) focusIds.push(focus.id);
        }
      }
    }
  }
  return focusIds;
}

function mergeSharedLookups(maintenance, sharedLookups) {
  const serviceModuleIndex = list(sharedLookups?.service_module_index);
  if (!serviceModuleIndex.length || list(maintenance?.service_module_index).length) return maintenance;
  return {
    ...(maintenance || {}),
    stats: {
      ...(maintenance?.stats || {}),
      service_module_index: serviceModuleIndex.length,
    },
    service_module_index: serviceModuleIndex,
  };
}

async function fetchData(baseUrl, path) {
  const response = await fetch(new URL(path, baseUrl));
  assert(response.ok, `${path}: HTTP ${response.status}`);
  return unwrapEnvelope(await response.json());
}

async function loadViewModels() {
  const source = await readFile("frontend/capability-browser/viewModels.js", "utf8");
  const context = { window: {}, console };
  vm.runInNewContext(source, context, { filename: "frontend/capability-browser/viewModels.js" });
  assert(context.window.sapdViewModels?.buildCapabilityWorkspaceViewModel, "sapdViewModels.buildCapabilityWorkspaceViewModel is unavailable");
  return context.window.sapdViewModels;
}

async function loadCapabilityRelationComponent() {
  const source = await readFile("frontend/capability-browser/components/CapabilityLocalRelationMap.js", "utf8");
  const escapeHtml = (value) =>
    text(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  const context = {
    window: {
      sapdDisplay: {},
      sapdComponents: {
        utils: {
          list,
          text,
          escapeHtml,
        },
        LocalRelationNetworkGraph: {
          render: () => '<section class="local-relation-network-graph"><div class="network-graph-canvas"><div class="network-legend"></div><div class="network-graph-actions"></div></div></section>',
        },
      },
      sapdModels: {
        buildLocalRelationGraphModel: () => ({ nodes: [], edges: [] }),
      },
    },
    console,
  };
  vm.runInNewContext(source, context, { filename: "frontend/capability-browser/components/CapabilityLocalRelationMap.js" });
  assert(context.window.sapdComponents?.CapabilityLocalRelationMap?.render, "CapabilityLocalRelationMap.render is unavailable");
  assert(context.window.sapdComponents?.CapabilityLocalRelationMap?.renderTabControls, "CapabilityLocalRelationMap.renderTabControls is unavailable");
  return context.window.sapdComponents.CapabilityLocalRelationMap;
}

async function validateNetworkGraphOverlayContract() {
  const graphSource = await readFile("frontend/capability-browser/components/LocalRelationNetworkGraph.js", "utf8");
  const indexSource = await readFile("frontend/capability-browser/index.html", "utf8");
  const appShellSource = await readFile("frontend/capability-browser/components/AppShell.js", "utf8");
  const appSource = await readFile("frontend/capability-browser/app.js", "utf8");
  const cssSource = await readFile("frontend/capability-browser/styles.css", "utf8");
  const headBlocks = [...cssSource.matchAll(/\.app-shell-integrated \.capability-workbench-head\s*\{[\s\S]*?\n\}/g)].map((match) => match[0]);
  const headBlock = headBlocks.find((block) => block.includes("grid-template-rows: auto;") && block.includes("box-shadow: none;")) || "";
  const headShelfBlock = cssSource.match(/\.app-shell-integrated \.capability-workbench-head::after\s*\{[\s\S]*?\n\}/)?.[0] || "";
  const workspaceSurfaceBlock = cssSource.match(/\.app-shell-integrated \.capability-workspace-surface\s*\{[\s\S]*?\n\}/)?.[0] || "";
  const workspaceControlBlock = cssSource.match(/\.app-shell-integrated \.capability-workspace-control\s*\{[\s\S]*?\n\}/)?.[0] || "";
  const workspaceControlDividerBlock = cssSource.match(/\.app-shell-integrated \.capability-workspace-control::after\s*\{[\s\S]*?\n\}/)?.[0] || "";
  const tabShellBlock = cssSource.match(/\.app-shell-integrated \.capability-view-controls \.capability-title-tabs\s*\{[\s\S]*?\n\}/)?.[0] || "";
  const toolsBlocks = cssSource.match(/\.app-shell-integrated \.capability-workbench-tools\s*\{[\s\S]*?\n\}/g) || [];
  const toolsBlock = toolsBlocks.find((block) => block.includes("width: min(34vw, 430px);")) || "";
  const tabItemBlock = cssSource.match(/\.app-shell-integrated \.capability-map-preview-r2 \.relation-view-tab\s*\{[\s\S]*?\n\}/)?.[0] || "";
  const stageScrollBlock = cssSource.match(/\.app-shell-integrated \.capability-map-preview-r2 \.preview-stage-scroll\s*\{[\s\S]*?\n\}/)?.[0] || "";
  const mapShellBlock = cssSource.match(/\.app-shell-integrated \.capability-map-preview-r2\.capability-local-relation-map\s*\{[\s\S]*?\n\}/)?.[0] || "";
  const relationGraphBlock = cssSource.match(/\.app-shell-integrated \.capability-map-preview-r2 \.summary-panel \.local-relation-network-graph\s*\{[\s\S]*?\n\}/)?.[0] || "";
  const relationCanvasBlock = cssSource.match(/\.app-shell-integrated \.capability-map-preview-r2 \.summary-panel \.network-graph-canvas\s*\{[\s\S]*?\n\}/)?.[0] || "";
  const overviewSummaryShellBlock = cssSource.match(/\.capability-overview-summary-shell\s*\{[\s\S]*?\n\}/)?.[0] || "";
  const overviewSummaryGridBlock = cssSource.match(/\.capability-overview-summary-grid\s*\{[\s\S]*?\n\}/)?.[0] || "";
  const overviewPaneStretchBlock = cssSource.match(/\.capability-overview-summary-grid > \.capability-overview-pane\s*\{[\s\S]*?\n\}/)?.[0] || "";
  const slidingScaleBlock = cssSource.match(/\.capability-sliding-scale-reference\s*\{[\s\S]*?\n\}/)?.[0] || "";
  const slidingScaleImageBlock = cssSource.match(/\.capability-sliding-scale-reference img\s*\{[\s\S]*?\n\}/)?.[0] || "";
  assert(!graphSource.includes('<header class="network-graph-head">'), "LocalRelationNetworkGraph should not render a separate legend/header row");
  assert(/network-graph-canvas[\s\S]*\$\{renderLegend\(model\)\}[\s\S]*network-graph-actions/.test(graphSource), "LocalRelationNetworkGraph should render legend and zoom controls inside the canvas");
  const actionsBlock = cssSource.match(/\.network-graph-actions\s*\{[\s\S]*?\n\}/)?.[0] || "";
  const legendBlock = cssSource.match(/\.network-legend\s*\{[\s\S]*?\n\}/)?.[0] || "";
  assert(actionsBlock.includes("bottom: 12px;"), "network zoom controls should be anchored to the canvas bottom right");
  assert(!actionsBlock.includes("top: 12px;"), "network zoom controls should not stay at the canvas top right");
  assert(legendBlock.includes("position: absolute;"), "network legend should be an overlay inside the canvas");
  assert(legendBlock.includes("top: 14px;") && legendBlock.includes("right: 14px;"), "network legend should be anchored to the canvas top right");
  assert(indexSource.includes('id="capabilityFocusHeader"'), "capability title identity slot should be explicit in index.html");
  assert(indexSource.includes('id="capabilityViewControls"'), "capability view controls should have a dedicated workspace control slot");
  assert(indexSource.includes('class="capability-workspace-surface"'), "capability detail area should be wrapped by the workspace surface");
  assert(indexSource.includes('class="capability-workspace-control"'), "capability tab/search controls should live in the workspace control rail");
  assert(indexSource.includes("AppShell.js?v=") && indexSource.includes("oi159-attached-control-20260702-2"), "AppShell.js should be cache-busted for workspace control tabs");
  assert(appShellSource.includes('id="capabilityViewControls"'), "AppShell capability template should render the workspace control tab slot");
  assert(appShellSource.includes('class="capability-workspace-surface"'), "AppShell capability template should wrap detail in the workspace surface");
  assert(appShellSource.includes('class="capability-workspace-control"'), "AppShell capability template should render the workspace control rail");
  assert(/CapabilityLocalRelationMap\.js\?v=[^"]*oi159-attached-control/.test(appSource), "CapabilityLocalRelationMap dynamic script URL must be cache-busted for workspace control tabs");
  assert(!headBlock.includes('"tabs search";'), "capability header should no longer own tab/search grid areas");
  assert(headBlock.includes("grid-template-columns: minmax(0, 1fr);"), "capability header should only reserve the identity row");
  assert(headBlock.includes("grid-template-rows: auto;"), "capability header should stay a single identity row");
  assert(headBlock.includes("padding: 16px 20px 10px;"), "capability identity header should stay compact above the workspace");
  assert(headBlock.includes("border-bottom: 0;"), "capability header should not keep the old hard divider line");
  assert(headBlock.includes("box-shadow: none;"), "capability identity header should not create another visual shelf");
  assert(headShelfBlock.includes("display: none;"), "capability header shelf divider should be disabled when controls attach to the workspace");
  assert(workspaceSurfaceBlock.includes("grid-template-rows: auto minmax(0, 1fr);"), "capability workspace surface should own the control rail and detail area");
  assert(workspaceSurfaceBlock.includes("border-radius: 26px;"), "capability workspace surface should provide the rounded Apple shell panel");
  assert(workspaceSurfaceBlock.includes("box-shadow:"), "capability workspace surface should carry the panel separation, not the title header");
  assert(workspaceControlBlock.includes("justify-content: space-between;"), "capability workspace control rail should keep the accepted tab/search baseline spacing");
  assert(workspaceControlBlock.includes("overflow: hidden;"), "capability workspace control rail should clip its own top background to avoid half-rendered corner arcs");
  assert(workspaceControlBlock.includes("border-radius: 25px 25px 0 0;"), "capability workspace control rail should align with the surface top corners");
  assert(workspaceControlBlock.includes("backdrop-filter: blur(16px) saturate(138%);"), "capability workspace control rail should use the accepted Apple shell glass treatment");
  assert(workspaceControlDividerBlock.includes("linear-gradient(90deg, transparent"), "workspace control rail should use a soft internal divider");
  assert(!tabShellBlock.includes("position: absolute;"), "capability relation tabs should not be an inset canvas overlay");
  assert(tabShellBlock.includes("max-width: min(58vw, 720px);"), "capability relation tabs should fit the workspace control rail without occupying the full width");
  assert(tabShellBlock.includes("border-radius: 23px;"), "capability relation tabs should use the accepted rounded segmented container");
  assert(tabShellBlock.includes("backdrop-filter: blur(14px) saturate(135%);"), "capability relation tabs should use restrained Apple shell glass treatment");
  assert(toolsBlock.includes("width: min(34vw, 430px);"), "capability search should keep the accepted right-side baseline width");
  assert(toolsBlock.includes("max-width: 430px;"), "capability search should keep the accepted right-side maximum width");
  assert(toolsBlock.includes("min-width: 300px;"), "capability search should keep the accepted desktop minimum width");
  assert(cssSource.includes(".app-shell-integrated .capability-view-controls .capability-title-tabs .relation-view-tab.is-active"), "capability workspace control tabs should have an active state class");
  assert(!tabItemBlock.includes("13px 13px 0 0"), "capability relation tab items should not use old browser-tab top corners");
  assert(stageScrollBlock.includes("grid-template-rows: minmax(0, 1fr);"), "capability relation stage should not reserve a separate tab row");
  assert(stageScrollBlock.includes("padding: 0;"), "capability relation stage should not create an extra inset board");
  assert(stageScrollBlock.includes("background: transparent;"), "capability relation stage should blend into the page surface");
  assert(mapShellBlock.includes("border: 0;") && mapShellBlock.includes("background: transparent;"), "capability relation map shell should not add another framed board");
  assert(relationGraphBlock.includes("border: 0;") && relationGraphBlock.includes("background: transparent;"), "relation graph wrapper should not add an inner framed board");
  assert(relationCanvasBlock.includes("border: 0;"), "relation graph canvas should not draw an inner frame line");
  assert(relationCanvasBlock.includes("box-shadow: none;"), "relation graph canvas should blend into the parent white surface");
  assert(cssSource.includes(".app-shell-integrated .capability-map-preview-r2 .preview-tab-panel:not(.summary-panel)") && cssSource.includes("padding-top: 0;"), "non-graph panels should not reserve space for canvas inset tabs");
  assert(overviewSummaryShellBlock.includes("grid-template-rows: auto minmax(0, 1fr);"), "overview summary shell should reserve a stable content region across levels");
  assert(overviewSummaryGridBlock.includes("align-items: stretch;"), "overview summary lower region should use equal-height panes");
  assert(overviewPaneStretchBlock.includes("height: 100%;") && overviewPaneStretchBlock.includes("min-height: clamp(320px, 38vh, 430px);"), "overview panes should keep a consistent area across L0/L1/L2");
  assert(slidingScaleBlock.includes("border: 0;"), "Sliding Scale image wrapper should not draw an outer frame");
  assert(slidingScaleBlock.includes("background: transparent;") && slidingScaleBlock.includes("box-shadow: none;"), "Sliding Scale image wrapper should sit directly under the five entries");
  assert(slidingScaleImageBlock.includes("width: min(100%, 1050px);") && slidingScaleImageBlock.includes("background: transparent;"), "Sliding Scale image should render as the direct visual asset, not as a framed card");
}

async function validateCapabilityRuntimeStatsContract() {
  const source = await readFile("frontend/capability-browser/app.js", "utf8");
  assert(source.includes('if (state.activeView === "capabilities") return ["capabilityInitial", "maintenanceIndex"];'), "capability route should load maintenanceIndex for overview coverage denominators");
  assert(source.includes("function capabilityManagementForViewModel()"), "capability runtime should merge maintenanceIndex stats for the ViewModel");
  assert(source.includes("management: capabilityManagementForViewModel()"), "capability ViewModel should receive maintenanceIndex-backed management stats");
  assert(source.includes('"maintenanceIndex"') && source.includes("scheduleCapabilityRenderAfterPackageLoad"), "capability page should rerender after maintenanceIndex loads");
}

function validateRowsStayInsideSelection(item, rows, selectedFocusIds, label) {
  for (const row of rows) {
    assert(selectedFocusIds.has(row?.focus?.id), `${item.code}: ${label} row escaped selected focus set with focus=${row?.focus?.id || ""}`);
  }
}

function validateMainDisplayBoundary(item, viewModel) {
  const boundaryObjects = {
    selectedCapability: viewModel.selectedCapability,
    relationshipSummary: viewModel.relationshipSummary,
    capabilityOverview: viewModel.capabilityOverview,
    focusOverviewSelected: viewModel.focusOverview?.selected,
    localRelationMapFocus: viewModel.localRelationMap?.focus,
  };
  for (const [name, value] of Object.entries(boundaryObjects)) {
    const forbidden = findForbiddenKey(value);
    assert(!forbidden, `${item.code}: forbidden main-display key in ${name}.${forbidden}`);
  }
}

function validateViewModel(item, target, projection, viewModel, selectedFocusIds) {
  assert(viewModel.selectedCapability?.type === item.objectType, `${item.code}: selectedCapability.type=${viewModel.selectedCapability?.type}`);
  assert(keysMatch(viewModel.selectedCapability, projection.selected), `${item.code}: selectedCapability does not match workspace-view selected`);
  assert(keysMatch(viewModel.focusOverview?.selected, projection.selected), `${item.code}: focusOverview.selected does not match workspace-view selected`);
  assert(keysMatch(viewModel.localRelationMap?.focus, projection.selected), `${item.code}: localRelationMap.focus does not match workspace-view selected`);
  assert(viewModel.relationshipSummary?.selectedType === item.objectType, `${item.code}: relationshipSummary.selectedType=${viewModel.relationshipSummary?.selectedType}`);
  assert(viewModel.focusOverview?.focusCount === selectedFocusIds.size, `${item.code}: focusOverview.focusCount=${viewModel.focusOverview?.focusCount}, expected=${selectedFocusIds.size}`);
  assert(viewModel.localRelationMapSource === item.expectedLocalRelationMapSource, `${item.code}: localRelationMapSource=${viewModel.localRelationMapSource}`);
  assert(viewModel.capabilityOverview?.selected?.type === item.objectType, `${item.code}: capabilityOverview.selected.type=${viewModel.capabilityOverview?.selected?.type}`);
  assert(keysMatch(viewModel.capabilityOverview?.selected, projection.selected), `${item.code}: capabilityOverview.selected does not match workspace-view selected`);
  assert(viewModel.capabilityOverview?.stats?.focusCount === selectedFocusIds.size, `${item.code}: capabilityOverview.stats.focusCount=${viewModel.capabilityOverview?.stats?.focusCount}, expected=${selectedFocusIds.size}`);
  if (item.objectType === "capability_category" || item.objectType === "capability_domain" || item.objectType === "capability") {
    assert(viewModel.capabilityOverview?.detailPolicy === "overview", `${item.code}: L0/L1/L2 detailPolicy=${viewModel.capabilityOverview?.detailPolicy}`);
    assert(list(viewModel.capabilityOverview?.children).length > 0, `${item.code}: L0/L1/L2 overview children missing`);
  }
  if (item.objectType === "capability_focus") {
    assert(viewModel.capabilityOverview?.detailPolicy === "full_detail", `${item.code}: focus detailPolicy=${viewModel.capabilityOverview?.detailPolicy}`);
  }

  const projectedTechnicalRows = list(projection.technicalMappingRows).filter((row) => selectedFocusIds.has(row?.focus?.id));
  const projectedManagementRows = list(projection.managementMappingRows).filter((row) => selectedFocusIds.has(row?.focus?.id));
  const projectedStandardRows = list(projection.standardMappingRows).filter((row) => selectedFocusIds.has(row?.focus?.id));
  assert(viewModel.technicalMappingRows.length === projectedTechnicalRows.length, `${item.code}: technical row count ${viewModel.technicalMappingRows.length} != ${projectedTechnicalRows.length}`);
  assert(viewModel.managementMappingRows.length === projectedManagementRows.length, `${item.code}: management row count ${viewModel.managementMappingRows.length} != ${projectedManagementRows.length}`);
  assert(viewModel.standardMappingRows.length === projectedStandardRows.length, `${item.code}: standard row count ${viewModel.standardMappingRows.length} != ${projectedStandardRows.length}`);
  const projectionStandardControls = projectedStandardRows.reduce((sum, row) => sum + list(row?.controls).length, 0);
  const viewModelStandardControls = viewModel.standardMappingRows.reduce((sum, row) => sum + list(row?.controls).length, 0);
  assert(viewModelStandardControls === projectionStandardControls, `${item.code}: standard controls ${viewModelStandardControls} != ${projectionStandardControls}`);
  if (item.minStandardControls) assert(viewModelStandardControls >= item.minStandardControls, `${item.code}: standard controls ${viewModelStandardControls}`);

  for (const [focusCode, workTitle] of Object.entries(item.expectedSecurityWorkByFocus || {})) {
    const row = viewModel.managementMappingRows.find((candidate) => candidate?.focus?.code === focusCode);
    assert(row, `${item.code}: missing management row for ${focusCode}`);
    const works = list(row.securityWorks).map(titleOf);
    assert(works.includes(workTitle), `${item.code}: ${focusCode} missing security work ${workTitle}; actual=${works.join("、")}`);
  }

  validateRowsStayInsideSelection(item, viewModel.technicalMappingRows, selectedFocusIds, "technical");
  validateRowsStayInsideSelection(item, viewModel.managementMappingRows, selectedFocusIds, "management");
  validateRowsStayInsideSelection(item, viewModel.standardMappingRows, selectedFocusIds, "standard");
  validateMainDisplayBoundary(item, viewModel);

  return {
    code: item.code,
    selectedId: target.id,
    selectedType: viewModel.selectedCapability.type,
    focusCount: selectedFocusIds.size,
    technicalRows: viewModel.technicalMappingRows.length,
    managementRows: viewModel.managementMappingRows.length,
    standardRows: viewModel.standardMappingRows.length,
    standardControls: viewModelStandardControls,
    localRelationMapSource: viewModel.localRelationMapSource,
    detailPolicy: viewModel.capabilityOverview?.detailPolicy,
  };
}

function validateOverviewRender(item, component, viewModel, management) {
  if (item.objectType !== "capability_category" && item.objectType !== "capability_domain" && item.objectType !== "capability") return null;
  const renderOverview = (activeTab) =>
    component.render({
      localRelationMap: viewModel.localRelationMap,
      focusOverview: viewModel.focusOverview,
      capabilityOverview: viewModel.capabilityOverview,
      activeTab,
      technicalMappingRows: [],
      managementMappingRows: [],
      standardMappingRows: [],
    });
  const renderTitleTabs = (activeTab) => component.renderTabControls(viewModel.localRelationMap, viewModel.capabilityOverview, activeTab);
  const html = renderOverview("summary");
  const summaryActiveHtml = renderOverview("technical");
  const staleTabHtml = renderOverview("management");
  const titleTabsHtml = renderTitleTabs("summary");
  const titleTabsSummaryHtml = renderTitleTabs("technical");
  const focusStripHtml = component.renderFocusStrip(viewModel.localRelationMap, viewModel.focusOverview, viewModel.capabilityOverview);
  assert(/id="capability-relation-tab-summary"[^>]*value="summary" checked/.test(html), `${item.code}: relation graph tab should be default active`);
  assert(/id="capability-relation-tab-technical"[^>]*value="technical" checked/.test(summaryActiveHtml), `${item.code}: overview summary tab cannot be activated`);
  assert(/id="capability-relation-tab-summary"[^>]*value="summary" checked/.test(staleTabHtml), `${item.code}: stale L0/L1 tab state should fall back to relation graph`);
  assert(!summaryActiveHtml.includes('id="capability-relation-tab-management"'), `${item.code}: switched L0/L1/L2 render should still only render two tabs`);
  assert(!summaryActiveHtml.includes('id="capability-relation-tab-standard"'), `${item.code}: switched L0/L1/L2 render should still only render two tabs`);
  assert(summaryActiveHtml.includes("capability-overview-row-list"), `${item.code}: activated overview summary content missing`);
  assert(!summaryActiveHtml.includes("capability-overview-hero"), `${item.code}: activated overview summary should not duplicate the page header hero`);
  assert(!summaryActiveHtml.includes("capability-overview-metrics"), `${item.code}: activated overview summary should not duplicate top-level metric cards`);
  assert(!staleTabHtml.includes('id="capability-relation-tab-management"'), `${item.code}: stale L0/L1/L2 render should not restore management tab`);
  assert(!staleTabHtml.includes('id="capability-relation-tab-standard"'), `${item.code}: stale L0/L1/L2 render should not restore standard tab`);
  assert(!staleTabHtml.includes("original-matrix-panel"), `${item.code}: stale L0/L1/L2 render should not render original matrix panel`);
  assert(html.includes("capability-overview-shell"), `${item.code}: overview shell missing`);
  assert(titleTabsHtml.includes("capability-title-tabs"), `${item.code}: workspace control relation tabs missing`);
  assert(titleTabsHtml.includes(">关系图谱<"), `${item.code}: relation graph tab label missing`);
  assert(titleTabsHtml.includes(">摘要总览<"), `${item.code}: overview summary tab label missing`);
  assert(titleTabsHtml.includes('class="relation-view-tab is-active"') && titleTabsSummaryHtml.includes('for="capability-relation-tab-technical" class="relation-view-tab is-active"'), `${item.code}: workspace control tab active state missing`);
  assert(!focusStripHtml.includes("preview-focus-stats"), `${item.code}: capability title strip should not render ambiguous metric cards`);
  assert(!html.includes("relation-view-tabs preview-tabs"), `${item.code}: relation tabs should not render inside the canvas stage`);
  assert(!html.includes(">覆盖统计<"), `${item.code}: legacy coverage tab label should not render on L0/L1`);
  assert(!html.includes(">下级索引<"), `${item.code}: legacy child index tab label should not render on L0/L1`);
  assert(!html.includes('id="capability-relation-tab-management"'), `${item.code}: L0/L1/L2 should only render two tabs`);
  assert(!html.includes('id="capability-relation-tab-standard"'), `${item.code}: L0/L1/L2 should only render two tabs`);
  assert(html.includes("local-relation-network-graph"), `${item.code}: L0/L1/L2 relation graph tab missing original relation graph`);
  assert(html.includes("network-graph-canvas"), `${item.code}: relation graph canvas missing`);
  assert(/network-graph-canvas[\s\S]*network-legend[\s\S]*network-graph-actions/.test(html), `${item.code}: legend and zoom controls should live inside relation graph canvas`);
  assert(!html.includes("network-graph-head"), `${item.code}: relation graph legend should not occupy a separate header row`);
  assert(/summary-panel[\s\S]*local-relation-network-graph/.test(html), `${item.code}: L0/L1/L2 relation graph is not inside the default summary-panel tab`);
  assert(/technical-panel[\s\S]*capability-overview-shell/.test(html), `${item.code}: L0/L1/L2 overview summary is not inside the second tab`);
  assert(html.includes("capability-overview-brief"), `${item.code}: redesigned overview summary brief missing`);
  assert(html.includes("capability-overview-definition"), `${item.code}: overview selected definition missing`);
  assert(text(viewModel.capabilityOverview?.selected?.description).trim(), `${item.code}: overview selected definition should not be empty`);
  if (item.code === "T") {
    assert(text(viewModel.capabilityOverview?.selected?.description).includes("面向业务系统、信息化环境和数字基础设施"), `${item.code}: L0 definition should use the curated session definition`);
  }
  if (item.code === "T-AS") {
    assert(text(viewModel.capabilityOverview?.selected?.description).includes("在考虑安全的前提下"), `${item.code}: L1 definition should use the curated session definition`);
  }
  if (item.code === "T-AS.AD") {
    assert(text(viewModel.capabilityOverview?.selected?.description).includes("组织依据安全设计原则"), `${item.code}: L2 definition should come from capability dictionary data`);
  }
  assert(html.includes(text(viewModel.capabilityOverview?.selected?.title || "")), `${item.code}: overview selected name missing`);
  assert(!html.includes("阅读摘要"), `${item.code}: overview should not show the old reading summary label`);
  assert(!html.includes("核对信号"), `${item.code}: overview should not show maker-facing review signals`);
  assert(!html.includes("capability-overview-insights"), `${item.code}: overview review signal cards should be removed`);
  assert(!html.includes("块用途："), `${item.code}: overview summary should not use explanatory training labels`);
  assert(!html.includes("统计价值："), `${item.code}: overview summary should not use explanatory training labels`);
  assert(!html.includes("直接下级完整展示"), `${item.code}: overview summary should not explain full child display in page copy`);
  assert(!html.includes("按覆盖负载选择下一步"), `${item.code}: overview summary should not explain workflow in page copy`);
  assert(html.includes("capability-overview-signal-grid"), `${item.code}: overview effective signal grid missing`);
  assert(html.includes("技术覆盖"), `${item.code}: overview technical signal missing`);
  assert(html.includes("管理落地"), `${item.code}: overview management signal missing`);
  assert(html.includes("标准映射"), `${item.code}: overview standard signal missing`);
  assert(html.includes("安全技术服务"), `${item.code}: technical signal should show security technical service count`);
  assert(html.includes("安全技术模块"), `${item.code}: technical signal should show security technology module count`);
  assert(html.includes("安全技术措施"), `${item.code}: technical signal should show security technical measure count`);
  assert(html.includes("职能"), `${item.code}: management signal should show function count`);
  assert(html.includes("流程"), `${item.code}: management signal should show process count`);
  assert(html.includes("标准"), `${item.code}: standard signal should show framework count`);
  assert(html.includes("控制项"), `${item.code}: standard signal should show control count`);
  assert(!html.includes("capability-overview-stat-groups"), `${item.code}: duplicate lower statistic groups should be removed`);
  assert(!html.includes("capability-overview-stat-group"), `${item.code}: duplicate lower statistic cards should be removed`);
  assert(!html.includes("技术视角统计"), `${item.code}: duplicate technical statistic group should be removed`);
  assert(!html.includes("管理视角统计"), `${item.code}: duplicate management statistic group should be removed`);
  const flowHtml = html.match(/<div class="capability-overview-flow">([\s\S]*?)<\/div>/)?.[1] || "";
  assert(!flowHtml.includes("映射"), `${item.code}: overview identity pills should not include mapping count`);
  assert(html.includes("capability-overview-row-list"), `${item.code}: redesigned overview child rows missing`);
  assert(!html.includes("capability-overview-row-signal"), `${item.code}: overview child row should not show technical/management/standard pills`);
  assert(!html.includes("capability-overview-row-definition"), `${item.code}: overview child card should not show dense definitions`);
  assert(!html.includes("<small>下级能力</small>"), `${item.code}: overview child entry label should not consume a separate row`);
  assert(!html.includes("<small>L1 总览</small>"), `${item.code}: overview child card should not show L1 overview label`);
  assert(!html.includes("<small>L2 能力</small>"), `${item.code}: overview child card should not show L2 capability label`);
  for (const child of list(viewModel.capabilityOverview?.children)) {
    assert(html.includes(text(child.code)), `${item.code}: overview child card missing ${child.code}`);
  }
  assert(html.includes("覆盖结构"), `${item.code}: redesigned coverage structure missing`);
  assert(html.includes("capability-overview-coverage-group tone-technical"), `${item.code}: coverage should include technical mapping group`);
  assert(html.includes("capability-overview-coverage-group tone-management"), `${item.code}: coverage should include management mapping group`);
  assert(!html.includes("capability-overview-coverage-group tone-standard"), `${item.code}: coverage should not include standard/framework group`);
  assert(html.includes("capability-overview-coverage-line"), `${item.code}: coverage should render ratio rows`);
  assert(html.includes("安全技术服务"), `${item.code}: coverage should include security technical service ratio`);
  assert(html.includes("安全技术模块"), `${item.code}: coverage should include module ratio`);
  assert(html.includes("安全技术措施"), `${item.code}: coverage should include measure ratio`);
  assert(html.includes("职能"), `${item.code}: coverage should include function ratio`);
  assert(html.includes("流程"), `${item.code}: coverage should include process ratio`);
  assert(html.includes("%"), `${item.code}: coverage should show percentages`);
  for (const group of list(viewModel.capabilityOverview?.coverage)) {
    for (const coverageItem of list(group.items)) {
      const value = Number(coverageItem.value || 0);
      const total = Number(coverageItem.total || 0);
      assert(total > 0 || value === 0, `${item.code}: coverage denominator missing for ${group.key}/${coverageItem.label}: ${value}/${total}`);
      assert(total >= value, `${item.code}: coverage denominator smaller than value for ${group.key}/${coverageItem.label}: ${value}/${total}`);
    }
  }
  if (item.code === "T") {
    const functionCoverage = list(viewModel.capabilityOverview?.coverage)
      .find((group) => group.key === "management")
      ?.items?.find((coverageItem) => coverageItem.label === "职能");
    const processCoverage = list(viewModel.capabilityOverview?.coverage)
      .find((group) => group.key === "management")
      ?.items?.find((coverageItem) => coverageItem.label === "流程");
    assert(Number(functionCoverage?.total) === statsCount(management, "work_functions"), `${item.code}: function coverage denominator should use maintenance work function total`);
    assert(Number(processCoverage?.total) === statsCount(management, "process_references"), `${item.code}: process coverage denominator should use maintenance process reference total`);
  }
  assert(!/\/0<\/b>/.test(html), `${item.code}: coverage should not render non-zero values against /0 denominators`);
  assert(!html.includes("技术 / 管理 / 标准"), `${item.code}: coverage header badge should be removed`);
  const childHeaderHtml = html.match(/<section class="capability-overview-pane capability-overview-children-pane">[\s\S]*?<header>([\s\S]*?)<\/header>/)?.[1] || "";
  const briefHeaderHtml = html.match(/<header class="capability-overview-brief-header">([\s\S]*?)<\/header>/)?.[1] || "";
  assert(!childHeaderHtml.includes("<span"), `${item.code}: child pane count badge should be removed`);
  assert(!briefHeaderHtml.includes("<span"), `${item.code}: overview level badge should be removed`);
  assert(!html.includes("capability-overview-hero"), `${item.code}: overview summary should not duplicate the page header hero`);
  assert(!html.includes("capability-overview-metrics"), `${item.code}: overview summary should not duplicate top-level metric cards`);
  if (item.objectType === "capability") {
    assert(html.includes("关注点入口"), `${item.code}: L2 overview should label child entry as focus entry`);
  }
  if (item.code === "T") {
    assert(html.includes("capability-overview-row-list is-five-up"), `${item.code}: five Sliding Scale entries should render in one row`);
    assert(html.includes("capability-sliding-scale-reference"), `${item.code}: Sliding Scale reference panel missing`);
    assert(!html.includes("滑动标尺参考"), `${item.code}: Sliding Scale image should not render a separate reference title`);
    assert(html.includes("./assets/sliding-scale-page-4.png"), `${item.code}: Sliding Scale page 4 image missing`);
  }
  assert(!html.includes("semantic-mapping-table"), `${item.code}: L0/L1/L2 overview rendered semantic mapping table`);
  assert(!html.includes("preview-mapping-table"), `${item.code}: L0/L1/L2 overview rendered preview mapping table`);
  assert(!html.includes("original-matrix-panel"), `${item.code}: L0/L1/L2 overview rendered original matrix panel`);
  return "overview_two_tab_relation_graph_and_summary";
}

async function main() {
  const baseUrl = argValue("--url", DEFAULT_BASE_URL).replace(/\/$/, "");
  const viewModels = await loadViewModels();
  const relationComponent = await loadCapabilityRelationComponent();
  await validateNetworkGraphOverlayContract();
  await validateCapabilityRuntimeStatsContract();
  const [capabilityTree, maintenance, sharedLookups, capabilityInitial] = await Promise.all([
    fetchData(baseUrl, "/api/v1/data-packages/capability"),
    fetchData(baseUrl, "/api/v1/data-packages/maintenance"),
    fetchData(baseUrl, "/api/v1/data-packages/shared-lookups"),
    fetchData(baseUrl, "/api/v1/capabilities/workspace-initial"),
  ]);
  const management = mergeSharedLookups(maintenance, sharedLookups);
  const capabilityWorkbenchViewModel = viewModels.buildCapabilityWorkbenchViewModel({ workbench: capabilityInitial });
  const checked = [];

  for (const item of cases) {
    const target = findCapabilityItem(capabilityTree, item);
    assert(target, `${item.code}: capability tree item not found`);
    const projection = await fetchData(baseUrl, `/api/v1/capabilities/workspace-view?object_type=${encodeURIComponent(item.objectType)}&object_id=${encodeURIComponent(item.code)}`);
    const viewModel = viewModels.buildCapabilityWorkspaceViewModel({
      capabilityWorkbench: capabilityInitial,
      capabilityWorkbenchViewModel,
      capabilityTree,
      capabilityProjection: projection,
      management,
      selectedCapabilityId: target.id,
      search: "",
      relationshipFilters: {},
    });
    const l0Rows = list(viewModel.navigationTree).filter((row) => row.level === "分类");
    for (const [code, title] of [
      ["T", "安全技术能力"],
      ["G", "安全治理能力"],
      ["M", "安全管理能力"],
    ]) {
      assert(l0Rows.some((row) => row.code === code && row.title === title), `${item.code}: L0 navigation should render ${code} before ${title}`);
    }
    assert(!l0Rows.some((row) => / [TGM]$/.test(text(row.title))), `${item.code}: L0 navigation title should not keep trailing code`);
    const result = validateViewModel(item, target, projection, viewModel, new Set(focusIdsForItem(capabilityTree, target)));
    result.renderPolicy = validateOverviewRender(item, relationComponent, viewModel, management) || "";
    checked.push(result);
  }

  console.log(
    JSON.stringify(
      {
        result: "pass",
        baseUrl,
        checked,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(JSON.stringify({ result: "fail", error: error.message }, null, 2));
  process.exit(1);
});
