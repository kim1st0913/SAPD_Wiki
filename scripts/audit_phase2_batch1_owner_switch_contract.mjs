#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { performance } from "node:perf_hooks";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dataClientPath = path.join(repoRoot, "frontend/capability-browser/dataClient.js");
const appPath = path.join(repoRoot, "frontend/capability-browser/app.js");
const viewModelsPath = path.join(repoRoot, "frontend/capability-browser/viewModels.js");
const tc010Path = path.join(repoRoot, "scripts/audit_capability_viewmodel_contract.mjs");
const dataClientSource = fs.readFileSync(dataClientPath, "utf8");
const appSource = fs.readFileSync(appPath, "utf8");
const viewModelsSource = fs.readFileSync(viewModelsPath, "utf8");
const tc010Source = fs.readFileSync(tc010Path, "utf8");

const expectedEndpoints = [
  "/api/v1/projections/capability-catalog",
  "/api/v1/projections/capability-view",
  "/api/v1/projections/capability-locator",
  "/api/v1/projections/maintenance",
  "/api/v1/projections/shared-lookups",
];
expectedEndpoints.forEach((endpoint) => assert(dataClientSource.includes(endpoint), `missing projection endpoint: ${endpoint}`));

function publicMethodBody(name) {
  const match = dataClientSource.match(new RegExp(`async ${name}\\([^]*?\\n    \\},`));
  assert(match, `dataClient method not found: ${name}`);
  return match[0];
}

for (const name of [
  "getCapabilityTree",
  "getCapabilityWorkbench",
  "getCapabilityWorkspaceInitial",
  "getCapabilityMatrix",
  "getCapabilityRelationships",
  "getCapabilityWorkspaceProjection",
  "getCapabilityWorkspaceView",
  "locateCapability",
  "getMaintenanceKnowledge",
  "getMaintenanceIndex",
  "getMaintenanceSection",
  "getSharedLookups",
]) {
  const body = publicMethodBody(name);
  assert(!body.includes("fetchPackage("), `${name} must not read a business package`);
  assert(!body.includes("fetchJsonPath("), `${name} must not read public/data paths`);
  assert(!body.includes("fallback"), `${name} must fail closed instead of falling back`);
}

assert(!appSource.includes('./public/data/capability/index.json'), "Issue locator must not scan the split capability index");
assert(!appSource.includes("findCapabilityProjectionForAnnotationValue"), "Issue locator must not scan projection payload text");
assert(appSource.includes("locateCapability?.({ targetRef: note?.target_ref })"), "Issue locator must use the exact projection locator API");
assert(!appSource.includes("navigationRows.find(rowMatchesDirectly) || navigationRows[0]"), "capability search must not substitute the first row");
assert(!viewModelsSource.includes("defaultCapabilitySelection"), "capability ViewModel must not infer a default object");
assert(viewModelsSource.includes('status: flattenCapabilities(capabilityTree).length ? "no_selection" : "empty"'), "capability no-selection state is missing");
assert(viewModelsSource.includes('status: selectableRows.length ? "no_selection" : "empty"'), "maintenance no-selection state is missing");
assert(dataClientSource.includes("function capabilityInitialProjectionFromCatalog(catalog)"), "capability catalog UI adapter is missing");
assert(dataClientSource.includes('mode: "initial_projection"'), "capability catalog adapter must mark the UI initial projection schema");
assert(dataClientSource.includes("sourceMode,"), "capability catalog adapter must preserve the API provenance mode");
assert(!dataClientSource.includes('compatibility?.mode === "sqlite_projection"'), "sqlite_projection must not be globally treated as initial_projection");

for (const retiredTc010Owner of [
  '"/api/v1/data-packages/capability"',
  '"/api/v1/data-packages/maintenance"',
  '"/api/v1/data-packages/shared-lookups"',
  '"/api/v1/capabilities/workspace-initial"',
  '"/api/v1/capabilities/workspace-view',
]) {
  assert(!tc010Source.includes(retiredTc010Owner), `TC-010 still contains retired owner request: ${retiredTc010Owner}`);
}
assert(tc010Source.includes("window.sapdDataClient"), "TC-010 must load the public dataClient owner");
assert(tc010Source.includes("dataClient.getCapabilityWorkspaceView({"), "TC-010 must request explicit capability views through dataClient");
assert(tc010Source.includes("nonProjectionBusinessOwnerRequests.length === 0"), "TC-010 must fail when any business request bypasses projection APIs");

for (const unchangedEndpoint of [
  "/api/v1/environments/dictionary",
  "/api/v1/data-packages/lifecycle",
  "/api/v1/data-packages/content",
  "/api/v1/data-packages/standards-index",
]) {
  assert(dataClientSource.includes(unchangedEndpoint), `unmigrated owner unexpectedly removed: ${unchangedEndpoint}`);
}

const focusId = "72cd12e2-f784-4775-8b3f-6d3ed4e7d398";
const focusCode = "T-AS.AD-01";
const focus = { id: focusId, type: "capability_focus", code: focusCode, title: "应用开发安全", targetRef: `capability_focus:${focusId}` };
const projectionIdentity = {
  knowledge_version: "base-188f20efed31631f",
  database_schema_version: "content-query-schema-v1",
  artifact_db_sha256: "1".repeat(64),
  parent_source_db_sha256: "2".repeat(64),
  projection_contract_version: "sapd-ui-projection-v1",
  content_asset_sha256: "3".repeat(64),
};
const catalogRelation = { relation_type: "belongs_to", source_id: focusId, target_id: "capability-1" };
const catalog = {
  data_state: "ready",
  meta: { stats: { capability_category: 1, capability_domain: 1, capability: 1, capability_focus: 1 } },
  navigator: { tree: [{ id: "category-1", type: "capability_category", code: "T", title: "技术", children: [{ id: "domain-1", type: "capability_domain", code: "T-AS", title: "应用安全", children: [{ id: "capability-1", type: "capability", code: "T-AS.AD", title: "应用开发", children: [focus] }] }] }] },
  objects: [focus],
  relations: [catalogRelation],
  selected: null,
  compatibility: { mode: "sqlite_projection", warnings: [] },
};
const services = Array.from({ length: 6 }, (_, index) => ({ id: `service-${index + 1}`, code: `S-${index + 1}`, title: `服务${index + 1}` }));
const capabilityView = {
  selected: focus,
  data_state: "ready",
  graph: { center: focus },
  technicalMappingRows: services.map((service) => ({ focus, services: [service], technologyModules: [], technicalMeasures: [] })),
  managementMappingRows: [],
  standardMappingRows: [],
  localRelationMap: { focus, technical: { serviceModuleMeasureLinks: services.map((service) => ({ serviceId: service.id, measures: [] })) } },
};
const maintenanceIndex = { data_state: "ready", section_counts: { services: 160, modules: 102, measures: 32 }, sections: [{ id: "services" }, { id: "modules" }, { id: "measures" }] };
const maintenanceSection = { data_state: "ready", package_type: "maintenance-section", section_id: "services", security_technical_services: services, stats: { security_technical_services: 160 }, section_counts: maintenanceIndex.section_counts };
const sharedLookups = { data_state: "ready", service_module_index: services.map((service) => ({ service, modules: [], measures: [] })), stats: { service_module_index: 160 } };

const requests = [];
let forcedStatus = 0;
const response = (status, data) => ({ ok: status >= 200 && status < 300, status, async json() { return { contract_version: "sapd-ui-projection-v1", identity: projectionIdentity, semantic_digest: "sha256:fixture", data }; } });
async function fakeFetch(input) {
  const url = String(input);
  requests.push(url);
  assert(!url.includes("public/data"), `migrated owner attempted JSON fallback: ${url}`);
  if (forcedStatus) return response(forcedStatus, { error: forcedStatus === 404 ? "not_found" : "projection_manifest_unavailable" });
  if (url.startsWith("/api/v1/projections/capability-catalog")) return response(200, catalog);
  if (url.startsWith("/api/v1/projections/capability-view")) return response(200, capabilityView);
  if (url.startsWith("/api/v1/projections/capability-locator")) return response(200, { targetRef: focus.targetRef, selected: focus });
  if (url === "/api/v1/projections/maintenance") return response(200, maintenanceIndex);
  if (url.startsWith("/api/v1/projections/maintenance/")) return response(200, maintenanceSection);
  if (url === "/api/v1/projections/shared-lookups") return response(200, sharedLookups);
  throw new Error(`unexpected request: ${url}`);
}

const windowObject = { location: { protocol: "http:" }, SAPD_API_BASE: "" };
const context = vm.createContext({
  window: windowObject,
  fetch: fakeFetch,
  AbortController,
  URLSearchParams,
  Date,
  Map,
  Set,
  console,
  setTimeout,
  clearTimeout,
});
vm.runInContext(dataClientSource, context, { filename: dataClientPath });
const client = windowObject.sapdDataClient;
assert(client, "sapdDataClient was not exported");

await client.getCapabilityTree();
const workbench = await client.getCapabilityWorkbench();
const initial = await client.getCapabilityWorkspaceInitial();
assert.equal(initial.data.selected, null, "catalog must not invent a selected object");
for (const adapted of [workbench.data, initial.data]) {
  assert.equal(adapted.compatibility.mode, "initial_projection", "UI catalog schema mode must be initial_projection");
  assert.equal(adapted.compatibility.sourceMode, "sqlite_projection", "API catalog provenance mode must be preserved");
  assert.deepEqual(adapted.navigator, catalog.navigator, "catalog navigator must be preserved");
  assert.deepEqual(adapted.objects, catalog.objects, "catalog objects must be preserved");
  assert.deepEqual(adapted.relations, catalog.relations, "catalog relations must be preserved");
  assert.deepEqual(adapted.identity, projectionIdentity, "catalog projection identity must be preserved");
  assert.equal(adapted.contract_version, "sapd-ui-projection-v1");
  assert.equal(adapted.semantic_digest, "sha256:fixture");
}
assert.equal(catalog.compatibility.mode, "sqlite_projection", "catalog adapter must not mutate API provenance");
await client.getCapabilityWorkspaceProjection({ objectType: "capability_focus", objectId: focusId, code: focusCode });
await client.getCapabilityWorkspaceView({ objectType: "capability_focus", objectId: focusId });
await client.locateCapability({ targetRef: focus.targetRef });
await client.getMaintenanceIndex();
await client.getMaintenanceSection("services");
await client.getSharedLookups();

for (const status of [404, 503]) {
  forcedStatus = status;
  await assert.rejects(
    client.getCapabilityWorkspaceView({ objectType: "capability_focus", objectId: "missing" }),
    (error) => error?.name === "ProjectionApiError" && error?.status === status,
  );
}
forcedStatus = 0;
assert(requests.every((url) => url.startsWith("/api/v1/projections/")), "migrated request list contains a non-projection owner");

async function liveEvidence(baseUrl) {
  const root = baseUrl.replace(/\/$/, "");
  const paths = [
    "/api/v1/projections/capability-catalog",
    `/api/v1/projections/capability-view?object_type=capability_focus&object_id=${encodeURIComponent(focusId)}&code=${encodeURIComponent(focusCode)}`,
    `/api/v1/projections/capability-locator?target_ref=${encodeURIComponent(focus.targetRef)}`,
    "/api/v1/projections/maintenance",
    "/api/v1/projections/maintenance/services",
    "/api/v1/projections/maintenance/measures",
    "/api/v1/projections/shared-lookups",
  ];
  const results = [];
  for (const requestPath of paths) {
    const started = performance.now();
    const liveResponse = await fetch(`${root}${requestPath}`, { cache: "no-store" });
    const payload = await liveResponse.json();
    assert.equal(liveResponse.status, 200, `${requestPath} returned ${liveResponse.status}`);
    results.push({ path: requestPath, status: liveResponse.status, elapsed_ms: Number((performance.now() - started).toFixed(2)), payload });
  }
  const warmPath = paths[1];
  const warmStarted = performance.now();
  const warmResponse = await fetch(`${root}${warmPath}`, { cache: "no-store" });
  await warmResponse.arrayBuffer();
  assert.equal(warmResponse.status, 200);
  const viewData = results[1].payload.data;
  const uniqueServices = new Set((viewData.technicalMappingRows || []).flatMap((row) => row.services || []).map((item) => item.id));
  assert.equal(viewData.selected.id, focusId);
  assert.equal(uniqueServices.size, 6);
  const lookupRows = results[6].payload.data.service_module_index || [];
  const hasMeasure = lookupRows.reduce((count, row) => count + (row.measures || []).length, 0);
  assert.equal(hasMeasure, 53);
  for (const code of ["I-AP&T-AS.IA-02", "I-US&T-AS.IA-02"]) {
    const row = lookupRows.find((item) => item.service?.code === code);
    assert(row?.measures?.some((item) => item.title === "应用系统自身认证模块"), `missing applied measure relation: ${code}`);
  }
  return {
    requests: results.map(({ path: requestPath, status, elapsed_ms }) => ({ path: requestPath, status, elapsed_ms })),
    warm_capability_view_ms: Number((performance.now() - warmStarted).toFixed(2)),
    focus: { id: viewData.selected.id, code: viewData.selected.code, services: uniqueServices.size },
    maintenance: { has_measure: hasMeasure, services: results[4].payload.data.stats.security_technical_services },
  };
}

const urlArgIndex = process.argv.indexOf("--url");
const live = urlArgIndex >= 0 ? await liveEvidence(process.argv[urlArgIndex + 1]) : null;
console.log(JSON.stringify({
  contract: "phase2-batch1-owner-switch-audit-v1",
  status: "pass",
  fixture_requests: requests,
  fixture_public_data_requests: requests.filter((url) => url.includes("public/data")),
  json_negative_controls: { missing: "not_requested", stale: "not_requested" },
  live,
}, null, 2));
