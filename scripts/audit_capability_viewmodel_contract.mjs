#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import vm from "node:vm";

const DEFAULT_BASE_URL = "http://127.0.0.1:5173";

const cases = [
  { code: "T", objectType: "capability_category", expectedLocalRelationMapSource: "viewmodel_fallback" },
  { code: "T-AS", objectType: "capability_domain", expectedLocalRelationMapSource: "viewmodel_fallback" },
  { code: "T-AS.AD", objectType: "capability", expectedLocalRelationMapSource: "viewmodel_fallback" },
  { code: "T-AS.AD-01", objectType: "capability_focus", expectedLocalRelationMapSource: "backend_projection", minStandardControls: 1 },
  { code: "T-PD.PP", objectType: "capability", expectedLocalRelationMapSource: "viewmodel_fallback", expectedSecurityWorkByFocus: { "T-PD.PP-01": "边界防护策略持续管理", "T-PD.PP-02": "边界防护策略持续管理", "T-PD.PP-03": "边界防护策略持续管理" } },
  { code: "T-PD.PP-02", objectType: "capability_focus", expectedLocalRelationMapSource: "backend_projection", expectedSecurityWorkByFocus: { "T-PD.PP-02": "边界防护策略持续管理" } },
  { code: "T-PD.PP-03", objectType: "capability_focus", expectedLocalRelationMapSource: "backend_projection", expectedSecurityWorkByFocus: { "T-PD.PP-03": "边界防护策略持续管理" } },
  { code: "T-OF", objectType: "capability_domain", expectedLocalRelationMapSource: "viewmodel_fallback" },
  { code: "T-OF.AT", objectType: "capability", expectedLocalRelationMapSource: "viewmodel_fallback" },
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

function validateRowsStayInsideSelection(item, rows, selectedFocusIds, label) {
  for (const row of rows) {
    assert(selectedFocusIds.has(row?.focus?.id), `${item.code}: ${label} row escaped selected focus set with focus=${row?.focus?.id || ""}`);
  }
}

function validateMainDisplayBoundary(item, viewModel) {
  const boundaryObjects = {
    selectedCapability: viewModel.selectedCapability,
    relationshipSummary: viewModel.relationshipSummary,
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
  };
}

async function main() {
  const baseUrl = argValue("--url", DEFAULT_BASE_URL).replace(/\/$/, "");
  const viewModels = await loadViewModels();
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
    checked.push(validateViewModel(item, target, projection, viewModel, new Set(focusIdsForItem(capabilityTree, target))));
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
