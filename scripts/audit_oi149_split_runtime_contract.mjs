import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

const ROOT = process.cwd();
const DATA_CLIENT_PATH = path.join(ROOT, "frontend/capability-browser/dataClient.js");
const CANDIDATE_DATA_DIR = path.join(ROOT, "data/exports/worker-verify/oi-149-p4-json-split-candidate/public-data");
const FORMAL_DATA_DIR = path.join(ROOT, "frontend/capability-browser/public/data");
const sourceArgIndex = process.argv.indexOf("--source");
const SOURCE = sourceArgIndex >= 0 ? process.argv[sourceArgIndex + 1] || "candidate" : "candidate";
const DATA_DIR = SOURCE === "formal" ? FORMAL_DATA_DIR : CANDIDATE_DATA_DIR;

if (!["candidate", "formal"].includes(SOURCE)) {
  console.error(JSON.stringify({ result: "fail", message: "--source must be candidate or formal", source: SOURCE }, null, 2));
  process.exit(1);
}

if (!fs.existsSync(path.join(DATA_DIR, "oi149-split-manifest.json"))) {
  console.log(
    JSON.stringify(
      {
        result: "fail",
        source: SOURCE,
        dataDir: path.relative(ROOT, DATA_DIR),
        message: "oi149-split-manifest.json is missing.",
      },
      null,
      2
    )
  );
  process.exit(1);
}

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(DATA_DIR, relativePath), "utf8"));
}

function jsonResponse(payload, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: () => "application/json" },
    json: async () => payload,
  };
}

async function loadDataClientWithFetch(fetchImpl) {
  const context = {
    console,
    fetch: fetchImpl,
    Headers,
    window: {
      location: { protocol: "http:" },
      SAPD_API_BASE: "",
    },
  };
  context.window.window = context.window;
  context.window.fetch = fetchImpl;
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(DATA_CLIENT_PATH, "utf8"), context, { filename: DATA_CLIENT_PATH });
  return context.window.sapdDataClient;
}

async function scenarioSplitPreferred() {
  const calls = [];
  const runtimeManifest = readJson("oi149-split-manifest.json");
  const capabilityIndex = readJson("capability/index.json");
  const client = await loadDataClientWithFetch(async (url) => {
    calls.push(String(url));
    if (url === "./public/data/oi149-split-manifest.json") return jsonResponse(runtimeManifest);
    if (url === "./public/data/capability/index.json") return jsonResponse(capabilityIndex);
    if (url === "/api/v1/capabilities/workspace-initial") return jsonResponse({ shouldNotCall: true });
    return jsonResponse({}, 404);
  });
  const envelope = await client.getCapabilityWorkspaceInitial();
  const data = envelope?.data || {};
  return {
    id: "split_preferred",
    ok:
      data?.meta?.dataSource === "oi149-split-index" &&
      data?.compatibility?.splitContract === "oi149-p4-split-v1" &&
      Array.isArray(data?.navigator?.tree) &&
      data.navigator.tree.length > 0 &&
      calls.includes("./public/data/oi149-split-manifest.json") &&
      calls.includes("./public/data/capability/index.json") &&
      !calls.includes("/api/v1/capabilities/workspace-initial") &&
      !calls.includes("./public/data/capability-workbench.json"),
    calls,
    dataSource: data?.meta?.dataSource,
    treeCount: data?.navigator?.tree?.length || 0,
  };
}

async function scenarioApiFallback() {
  const calls = [];
  const apiInitial = {
    meta: { dataSource: "workspace-initial-api", stats: {} },
    navigator: { tree: [{ id: "api-node", type: "capability_category", title: "API Node", children: [] }] },
    compatibility: { mode: "initial_projection" },
  };
  const client = await loadDataClientWithFetch(async (url) => {
    calls.push(String(url));
    if (url === "./public/data/oi149-split-manifest.json") return jsonResponse({}, 404);
    if (url === "/api/v1/capabilities/workspace-initial") return jsonResponse({ data: apiInitial });
    return jsonResponse({}, 404);
  });
  const envelope = await client.getCapabilityWorkspaceInitial();
  const data = envelope?.data || {};
  return {
    id: "api_fallback_when_manifest_missing",
    ok:
      data?.meta?.dataSource === "workspace-initial-api" &&
      calls.includes("./public/data/oi149-split-manifest.json") &&
      calls.includes("/api/v1/capabilities/workspace-initial") &&
      !calls.includes("./public/data/capability/index.json"),
    calls,
    dataSource: data?.meta?.dataSource,
  };
}

async function scenarioEnvironmentSplitNavigator() {
  const calls = [];
  const runtimeManifest = readJson("oi149-split-manifest.json");
  const environmentNavigator = readJson("environment/navigator.json");
  const client = await loadDataClientWithFetch(async (url) => {
    calls.push(String(url));
    if (url === "./public/data/oi149-split-manifest.json") return jsonResponse(runtimeManifest);
    if (url === "./public/data/environment/navigator.json") return jsonResponse(environmentNavigator);
    if (url === "./public/data/environment-workbench.json") return jsonResponse({ shouldNotCall: true });
    return jsonResponse({}, 404);
  });
  const envelope = await client.getEnvironmentNavigator();
  const data = envelope?.data || {};
  return {
    id: "environment_split_navigator_preferred",
    ok:
      data?.dataSource === "oi149-split-environment-navigator" &&
      data?.splitContract === "oi149-p4-split-v1" &&
      Array.isArray(data.environments) &&
      data.environments.length > 0 &&
      Array.isArray(data.projections) &&
      data.projections.length > 0 &&
      calls.includes("./public/data/oi149-split-manifest.json") &&
      calls.includes("./public/data/environment/navigator.json") &&
      !calls.includes("./public/data/environment-workbench.json"),
    calls,
    dataSource: data?.dataSource,
    environmentCount: data?.environments?.length || 0,
    projectionCount: data?.projections?.length || 0,
  };
}

async function scenarioEnvironmentSplitProjection() {
  const calls = [];
  const runtimeManifest = readJson("oi149-split-manifest.json");
  const environmentNavigator = readJson("environment/navigator.json");
  const projectionRow = environmentNavigator.projections?.[0] || {};
  const environmentProjection = readJson(projectionRow.path);
  const client = await loadDataClientWithFetch(async (url) => {
    calls.push(String(url));
    if (url === "./public/data/oi149-split-manifest.json") return jsonResponse(runtimeManifest);
    if (url === "./public/data/environment/navigator.json") return jsonResponse(environmentNavigator);
    if (url === `./public/data/${projectionRow.path}`) return jsonResponse(environmentProjection);
    if (url === "./public/data/environment-workbench.json") return jsonResponse({ shouldNotCall: true });
    return jsonResponse({}, 404);
  });
  const envelope = await client.getEnvironmentWorkspaceProjection({ projectionKey: projectionRow.projectionKey });
  const data = envelope?.data || {};
  return {
    id: "environment_split_projection_preferred",
    ok:
      data?.dataSource === "oi149-split-environment-projection" &&
      data?.splitContract === "oi149-p4-split-v1" &&
      data?.projectionKey === projectionRow.projectionKey &&
      Array.isArray(data.objectScopeTree) &&
      data.objectScopeTree.length > 0 &&
      Array.isArray(data.relations) &&
      data.relations.length > 0 &&
      calls.includes("./public/data/oi149-split-manifest.json") &&
      calls.includes("./public/data/environment/navigator.json") &&
      calls.includes(`./public/data/${projectionRow.path}`) &&
      !calls.includes("./public/data/environment-workbench.json"),
    calls,
    dataSource: data?.dataSource,
    projectionKey: data?.projectionKey,
    objectScopeTreeCount: data?.objectScopeTree?.length || 0,
    relationCount: data?.relations?.length || 0,
  };
}

async function scenarioEnvironmentWorkbenchFallback() {
  const calls = [];
  const environmentWorkbench = {
    meta: { generated_at: "2026-06-30T00:00:00.000Z", stats: { information_environment: 1 } },
    navigator: { tree: [{ id: "env-node", type: "information_environment", title: "Env Node", children: [] }] },
  };
  const client = await loadDataClientWithFetch(async (url) => {
    calls.push(String(url));
    if (url === "./public/data/oi149-split-manifest.json") return jsonResponse({}, 404);
    if (url === "./public/data/environment-workbench.json") return jsonResponse(environmentWorkbench);
    return jsonResponse({}, 404);
  });
  const envelope = await client.getEnvironmentNavigator();
  const data = envelope?.data || {};
  return {
    id: "environment_workbench_fallback_when_manifest_missing",
    ok:
      data?.dataSource === "environment-workbench" &&
      Array.isArray(data.environments) &&
      data.environments.length === 1 &&
      calls.includes("./public/data/oi149-split-manifest.json") &&
      calls.includes("./public/data/environment-workbench.json") &&
      !calls.includes("./public/data/environment/navigator.json"),
    calls,
    dataSource: data?.dataSource,
    environmentCount: data?.environments?.length || 0,
  };
}

async function scenarioEnvironmentProjectionWorkbenchFallback() {
  const calls = [];
  const environmentWorkbench = {
    meta: { generated_at: "2026-06-30T00:00:00.000Z", stats: { information_environment: 1 } },
    objects: { information_environment: { "env-node": { id: "env-node", title: "Env Node" } } },
    relations: [{ id: "rel-1", type: "contains_object", sourceId: "env-node", targetId: "obj-node" }],
    environment_scope_tree: [{ id: "env-node", title: "Env Node", objects: [] }],
  };
  const client = await loadDataClientWithFetch(async (url) => {
    calls.push(String(url));
    if (url === "./public/data/oi149-split-manifest.json") return jsonResponse({}, 404);
    if (url === "./public/data/environment-workbench.json") return jsonResponse(environmentWorkbench);
    return jsonResponse({}, 404);
  });
  const envelope = await client.getEnvironmentWorkspaceProjection({ id: "env-node", type: "information_environment" });
  const data = envelope?.data || {};
  return {
    id: "environment_projection_workbench_fallback_when_manifest_missing",
    ok:
      data?.dataSource === "environment-workbench-fallback" &&
      data?.relationCount === 1 &&
      Array.isArray(data.objectScopeTree) &&
      data.objectScopeTree.length === 1 &&
      calls.includes("./public/data/oi149-split-manifest.json") &&
      calls.includes("./public/data/environment-workbench.json") &&
      !calls.includes("./public/data/environment/navigator.json"),
    calls,
    dataSource: data?.dataSource,
    relationCount: data?.relationCount || 0,
    objectScopeTreeCount: data?.objectScopeTree?.length || 0,
  };
}

async function scenarioLifecycleSplitPreferredWhenLegacyPackagesAreMissing() {
  const calls = [];
  const runtimeManifest = readJson("oi149-split-manifest.json");
  const lifecycleIndex = readJson("lifecycle/index.json");
  const evidence = readJson("lifecycle/evidence.json");
  const domainRows = lifecycleIndex.projections.filter((row) => row.type === "lifecycle_domain");
  const projectionsByPath = new Map(domainRows.map((row) => [row.path, readJson(row.path)]));
  const client = await loadDataClientWithFetch(async (url) => {
    calls.push(String(url));
    if (url === "./public/data/oi149-split-manifest.json") return jsonResponse(runtimeManifest);
    if (url === "./public/data/lifecycle/index.json") return jsonResponse(lifecycleIndex);
    if (url === "./public/data/lifecycle/evidence.json") return jsonResponse(evidence);
    for (const [projectionPath, projection] of projectionsByPath) {
      if (url === `./public/data/${projectionPath}`) return jsonResponse(projection);
    }
    return jsonResponse({}, 404);
  });
  const envelope = await client.getLifecycleWorkbench();
  const data = envelope?.data || {};
  const stages = Object.values(data.objects?.lifecycle_stage || {});
  const applicationStages = stages.filter((stage) => stage.lifecycleType === "application_security_development");
  const dataStages = stages.filter((stage) => stage.lifecycleType === "data");
  const viewModelContext = {
    window: {
      sapdDisplay: {
        label: (_key, fallback) => fallback,
        relationLabel: () => "",
        state: (_key, fallback) => fallback,
      },
    },
  };
  vm.runInNewContext(
    fs.readFileSync(path.join(ROOT, "frontend/capability-browser/viewModels.js"), "utf8"),
    viewModelContext,
    { filename: "viewModels.js" },
  );
  const lifecycleWorkbenchViewModel = viewModelContext.window.sapdViewModels.buildLifecycleWorkbenchViewModel({ workbench: data });
  const applicationModel = viewModelContext.window.sapdViewModels.buildApplicationSecurityLifecycleViewModel({
    lifecycleWorkbench: data,
    lifecycleWorkbenchViewModel,
    lifecycle: {},
    selectedProcessId: applicationStages[0]?.id,
    search: "",
  });
  return {
    id: "lifecycle_split_preferred_when_legacy_packages_are_missing",
    ok:
      data?.meta?.dataSource === "oi149-split-lifecycle" &&
      data?.compatibility?.splitContract === "oi149-p4-split-v1" &&
      applicationStages.length === 8 &&
      dataStages.length === 7 &&
      applicationModel.stageOverview?.code === "AP-01" &&
      applicationModel.relationRows?.length > 0 &&
      data.relations?.length === lifecycleIndex.stats.relations &&
      data.evidenceRefs?.length === lifecycleIndex.stats.evidenceRefs &&
      !calls.includes("./public/data/lifecycle-workbench.json") &&
      !calls.includes("./public/data/lifecycle-knowledge.json"),
    calls,
    dataSource: data?.meta?.dataSource,
    applicationStageCount: applicationStages.length,
    dataStageCount: dataStages.length,
    applicationRelationRowCount: applicationModel.relationRows?.length || 0,
    relationCount: data.relations?.length || 0,
    evidenceRefCount: data.evidenceRefs?.length || 0,
  };
}

const checks = [
  await scenarioSplitPreferred(),
  await scenarioApiFallback(),
  await scenarioEnvironmentSplitNavigator(),
  await scenarioEnvironmentSplitProjection(),
  await scenarioEnvironmentWorkbenchFallback(),
  await scenarioEnvironmentProjectionWorkbenchFallback(),
  await scenarioLifecycleSplitPreferredWhenLegacyPackagesAreMissing(),
];
const failures = checks.filter((check) => !check.ok);
const result = {
  result: failures.length ? "fail" : "pass",
  source: SOURCE,
  dataDir: path.relative(ROOT, DATA_DIR),
  checkCount: checks.length,
  failureCount: failures.length,
  checks,
};

console.log(JSON.stringify(result, null, 2));
if (failures.length) process.exit(1);
