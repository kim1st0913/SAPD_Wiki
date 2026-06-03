#!/usr/bin/env node

const DEFAULT_BASE_URL = "http://127.0.0.1:5173";

const cases = [
  { code: "T", objectType: "capability_category", graphScope: "category" },
  { code: "T-AS", objectType: "capability_domain", graphScope: "domain" },
  { code: "T-AS.AD", objectType: "capability", graphScope: "capability" },
  { code: "T-AS.AD-01", objectType: "capability_focus", graphScope: "focus", minStandardControls: 1 },
  { code: "T-PD.PP", objectType: "capability", graphScope: "capability", expectedSecurityWorkByFocus: { "T-PD.PP-01": "边界防护策略持续管理", "T-PD.PP-02": "边界防护策略持续管理", "T-PD.PP-03": "边界防护策略持续管理" } },
  { code: "T-PD.PP-02", objectType: "capability_focus", graphScope: "focus", expectedSecurityWorkByFocus: { "T-PD.PP-02": "边界防护策略持续管理" } },
  { code: "T-PD.PP-03", objectType: "capability_focus", graphScope: "focus", expectedSecurityWorkByFocus: { "T-PD.PP-03": "边界防护策略持续管理" } },
  { code: "T-OF", objectType: "capability_domain", graphScope: "domain" },
  { code: "T-OF.AT", objectType: "capability", graphScope: "capability" },
  { code: "T-OF.AT-02", objectType: "capability_focus", graphScope: "focus" },
  { code: "G-SP.SM-02", objectType: "capability_focus", graphScope: "focus" },
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

const requiredTopLevelKeys = [
  "contract",
  "selected",
  "graphScope",
  "dataState",
  "graph",
  "summary",
  "tabs",
  "technicalMappingRows",
  "managementMappingRows",
  "standardMappingRows",
  "sourceEvidence",
];

const requiredArrayKeys = ["technicalMappingRows", "managementMappingRows", "standardMappingRows", "sourceEvidence"];

function argValue(name, fallback) {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function unwrapEnvelope(payload) {
  return payload && typeof payload === "object" && Object.prototype.hasOwnProperty.call(payload, "data") ? payload.data : payload;
}

function fail(message) {
  throw new Error(message);
}

function assert(condition, message) {
  if (!condition) fail(message);
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

function summarySignature(data) {
  const summary = data.summary || {};
  return {
    focuses: Number(summary.focuses || 0),
    technical: Number(summary.technical_rows || 0),
    management: Number(summary.management_rows || 0),
    standards: Number(summary.standard_controls || 0),
  };
}

function titleOf(item) {
  return String(item?.title || item?.name || item?.code || "").trim();
}

function validateTabCounts(item, data) {
  const technicalRows = Array.isArray(data.technicalMappingRows) ? data.technicalMappingRows : [];
  const managementRows = Array.isArray(data.managementMappingRows) ? data.managementMappingRows : [];
  const standardRows = Array.isArray(data.standardMappingRows) ? data.standardMappingRows : [];
  const tabTechnical = Number(data.tabs?.technical?.rowCount || 0);
  const tabManagement = Number(data.tabs?.management?.rowCount || 0);
  const tabControls = Number(data.tabs?.standards?.controlCount || 0);
  const rowControls = standardRows.reduce((sum, row) => sum + (Array.isArray(row?.controls) ? row.controls.length : 0), 0);
  assert(tabTechnical === technicalRows.length, `${item.code}: technical tab rowCount=${tabTechnical}, rows=${technicalRows.length}`);
  assert(tabManagement === managementRows.length, `${item.code}: management tab rowCount=${tabManagement}, rows=${managementRows.length}`);
  if (item.objectType === "capability_focus") {
    assert(tabControls === rowControls, `${item.code}: standards tab controlCount=${tabControls}, rowControls=${rowControls}`);
  } else {
    assert(rowControls >= tabControls, `${item.code}: standards rowControls=${rowControls} is smaller than deduped tab controlCount=${tabControls}`);
  }
  if (item.minStandardControls) assert(tabControls >= item.minStandardControls, `${item.code}: standards controlCount=${tabControls}`);
}

function validateExpectedSecurityWorks(item, data) {
  const expected = item.expectedSecurityWorkByFocus || {};
  for (const [focusCode, workTitle] of Object.entries(expected)) {
    const row = (data.managementMappingRows || []).find((candidate) => candidate?.focus?.code === focusCode);
    assert(row, `${item.code}: missing management row for ${focusCode}`);
    const works = (row.securityWorks || []).map(titleOf);
    assert(works.includes(workTitle), `${item.code}: ${focusCode} missing security work ${workTitle}; actual=${works.join("、")}`);
  }
}

function assertParentCoversChild(parent, child, label) {
  for (const key of ["focuses", "technical", "management", "standards"]) {
    assert(parent[key] >= child[key], `${label}: parent ${key}=${parent[key]} is smaller than child ${key}=${child[key]}`);
  }
}

async function fetchProjection(baseUrl, item) {
  const url = new URL("/api/v1/capabilities/workspace-view", baseUrl);
  url.searchParams.set("object_type", item.objectType);
  url.searchParams.set("object_id", item.code);
  const response = await fetch(url);
  assert(response.ok, `${item.code}: HTTP ${response.status}`);
  return unwrapEnvelope(await response.json());
}

function validateProjection(item, data) {
  const selected = data.selected || {};
  const graph = data.graph || {};
  const center = graph.center || {};
  const nodes = Array.isArray(graph.nodes) ? graph.nodes : [];
  const state = data.dataState || data.data_state || "";

  for (const key of requiredTopLevelKeys) {
    assert(Object.prototype.hasOwnProperty.call(data, key), `${item.code}: missing required key ${key}`);
  }
  for (const key of requiredArrayKeys) {
    assert(Array.isArray(data[key]), `${item.code}: ${key} is not an array`);
  }
  assert(state === "ready" || state === "empty", `${item.code}: unexpected dataState=${state}`);
  assert(data.contract === "capability-workspace-view", `${item.code}: contract=${data.contract}`);
  assert(selected.type === item.objectType, `${item.code}: selected.type=${selected.type}`);
  assert(selected.code === item.code, `${item.code}: selected.code=${selected.code}`);
  assert(data.graphScope === item.graphScope, `${item.code}: graphScope=${data.graphScope}`);
  assert(center.id === selected.id, `${item.code}: graph.center.id does not match selected.id`);
  assert(center.type === selected.type, `${item.code}: graph.center.type does not match selected.type`);
  assert(center.code === selected.code, `${item.code}: graph.center.code does not match selected.code`);
  if (state !== "empty") assert(nodes.length > 0, `${item.code}: graph.nodes is empty`);
  if (item.objectType !== "capability_focus") {
    assert(!data.localRelationMap, `${item.code}: non-focus projection returned localRelationMap`);
    assert(!Array.isArray(data.localRelationMaps) || data.localRelationMaps.length === 0, `${item.code}: non-focus projection returned localRelationMaps`);
  }
  validateTabCounts(item, data);
  validateExpectedSecurityWorks(item, data);

  for (const [name, value] of Object.entries({ selected, graph, summary: data.summary || {}, tabs: data.tabs || {} })) {
    const forbidden = findForbiddenKey(value);
    assert(!forbidden, `${item.code}: forbidden main-display key in ${name}.${forbidden}`);
  }
}

async function validateInvalidObject(baseUrl) {
  const item = { code: "NO-SUCH-CAPABILITY", objectType: "capability", graphScope: "capability" };
  const data = await fetchProjection(baseUrl, item);
  const state = data.dataState || data.data_state || "";
  for (const key of requiredTopLevelKeys) {
    assert(Object.prototype.hasOwnProperty.call(data, key), `invalid object: missing required key ${key}`);
  }
  for (const key of requiredArrayKeys) {
    assert(Array.isArray(data[key]), `invalid object: ${key} is not an array`);
    assert(data[key].length === 0, `invalid object: ${key} is not empty`);
  }
  assert(data.contract === "capability-workspace-view", `invalid object: contract=${data.contract}`);
  assert(state === "invalid_object", `invalid object: dataState=${state}`);
  assert((data.graph?.nodes || []).length === 0, "invalid object returned graph nodes");
  assert(!data.localRelationMap, "invalid object returned localRelationMap");
}

async function main() {
  const baseUrl = argValue("--url", DEFAULT_BASE_URL).replace(/\/$/, "");
  const results = new Map();
  for (const item of cases) {
    const data = await fetchProjection(baseUrl, item);
    validateProjection(item, data);
    results.set(item.code, summarySignature(data));
  }

  assertParentCoversChild(results.get("T"), results.get("T-AS"), "T -> T-AS");
  assertParentCoversChild(results.get("T-AS"), results.get("T-AS.AD"), "T-AS -> T-AS.AD");
  assertParentCoversChild(results.get("T-AS.AD"), results.get("T-AS.AD-01"), "T-AS.AD -> T-AS.AD-01");
  assertParentCoversChild(results.get("T-OF"), results.get("T-OF.AT"), "T-OF -> T-OF.AT");
  assertParentCoversChild(results.get("T-OF.AT"), results.get("T-OF.AT-02"), "T-OF.AT -> T-OF.AT-02");

  await validateInvalidObject(baseUrl);

  console.log(
    JSON.stringify(
      {
        result: "pass",
        baseUrl,
        checked: cases.map((item) => `${item.objectType}:${item.code}`),
        invalidObject: "pass",
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
