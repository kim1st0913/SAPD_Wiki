import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const DEFAULT_DIR = path.join(ROOT, "data/exports/worker-verify/oi-149-p4-json-split-candidate");
const FIRST_SCREEN_BUDGET_KB = 1024;
const DETAIL_PROJECTION_BUDGET_KB = 1536;
const FORBIDDEN_UI_KEYS = new Set([
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
  "sources",
  "sourceRows",
  "sourceCells",
  "payload",
  "workerVerifyType",
]);

function argValue(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] || "" : "";
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function sizeKb(filePath) {
  return Math.round((fs.statSync(filePath).size / 1024) * 10) / 10;
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function duplicateValues(values) {
  const counts = new Map();
  for (const value of values.filter(Boolean)) counts.set(value, (counts.get(value) || 0) + 1);
  return [...counts.entries()]
    .filter(([, count]) => count > 1)
    .map(([value, count]) => ({ value, count }));
}

function sampleRows(rows, limit = 10) {
  return rows.slice(0, limit).map((row) => ({
    navOrdinal: row.navOrdinal,
    id: row.id,
    type: row.type,
    title: row.title,
    projectionKey: row.projectionKey,
    projectionPath: row.projectionPath,
  }));
}

function scanForbiddenKeys(value) {
  const hits = {};
  function walk(item) {
    if (Array.isArray(item)) {
      for (const child of item) walk(child);
      return;
    }
    if (!item || typeof item !== "object") return;
    for (const [key, child] of Object.entries(item)) {
      if (FORBIDDEN_UI_KEYS.has(key)) hits[key] = (hits[key] || 0) + 1;
      walk(child);
    }
  }
  walk(value);
  return hits;
}

function listJsonFiles(dir) {
  const result = [];
  for (const name of fs.readdirSync(dir)) {
    const filePath = path.join(dir, name);
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) result.push(...listJsonFiles(filePath));
    if (stat.isFile() && name.endsWith(".json")) result.push(filePath);
  }
  return result;
}

function flattenEnvironmentNavigator(nodes, ancestors = []) {
  const result = [];
  for (const node of asArray(nodes)) {
    result.push({
      id: node.id || "",
      type: node.type || "",
      title: node.title || node.name || "",
      navOrdinal: node.navOrdinal,
      projectionKey: node.projectionKey || "",
      projectionPath: node.projectionPath || "",
      navigationPath: node.navigationPath || [],
      ancestors,
    });
    result.push(...flattenEnvironmentNavigator(node.children, [...ancestors, node]));
  }
  return result;
}

const candidateDir = path.resolve(argValue("--candidate-dir") || DEFAULT_DIR);
const manifestPath = path.join(candidateDir, "candidate-manifest.json");
const readinessPath = path.join(candidateDir, "candidate-readiness.json");
const publicDataDir = path.join(candidateDir, "public-data");

const checks = [];
function addCheck(id, ok, detail = {}) {
  checks.push({ id, ok, detail });
}

addCheck("candidate_dir_exists", fs.existsSync(candidateDir), { candidateDir: path.relative(ROOT, candidateDir) });
addCheck("manifest_exists", fs.existsSync(manifestPath), { path: path.relative(ROOT, manifestPath) });
addCheck("readiness_exists", fs.existsSync(readinessPath), { path: path.relative(ROOT, readinessPath) });
addCheck("public_data_exists", fs.existsSync(publicDataDir), { path: path.relative(ROOT, publicDataDir) });

let manifest = null;
let readiness = null;
if (fs.existsSync(manifestPath)) manifest = readJson(manifestPath);
if (fs.existsSync(readinessPath)) readiness = readJson(readinessPath);

if (manifest) {
  addCheck("formal_apply_not_required", manifest.formalApplyRequired === false, {
    formalApplyRequired: manifest.formalApplyRequired,
  });
  addCheck("formal_public_data_not_modified", manifest.formalPublicDataModified === false, {
    formalPublicDataModified: manifest.formalPublicDataModified,
  });
  const manifestPaths = asArray(manifest.files).map((file) => file.path);
  const duplicateManifestPaths = duplicateValues(manifestPaths);
  addCheck("manifest_file_paths_unique", duplicateManifestPaths.length === 0, {
    fileCount: manifestPaths.length,
    duplicateCount: duplicateManifestPaths.length,
    duplicates: duplicateManifestPaths.slice(0, 10),
  });
  const required = [
    "oi149-split-manifest.json",
    "capability/index.json",
    "environment/navigator.json",
    "maintenance/index.json",
    "shared-lookups/service-module-index.json",
    "lifecycle/index.json",
    "standards/index.json",
  ];
  for (const relativePath of required) {
    addCheck(`required:${relativePath}`, fs.existsSync(path.join(publicDataDir, relativePath)), { path: relativePath });
  }
  const runtimeManifestPath = path.join(publicDataDir, "oi149-split-manifest.json");
  if (fs.existsSync(runtimeManifestPath)) {
    const runtimeManifest = readJson(runtimeManifestPath);
    addCheck("runtime_split_manifest_contract", runtimeManifest.contract === "oi149-p4-split-v1", {
      contract: runtimeManifest.contract,
      packageType: runtimeManifest.packageType,
    });
    addCheck("runtime_split_manifest_capability_index", runtimeManifest.domains?.capability?.indexPath === "capability/index.json", {
      capability: runtimeManifest.domains?.capability,
    });
    addCheck("runtime_split_manifest_environment_navigator", runtimeManifest.domains?.environment?.navigatorPath === "environment/navigator.json", {
      environment: runtimeManifest.domains?.environment,
    });
  }
}

if (readiness) {
  addCheck("readiness_pass", readiness.result === "pass", { result: readiness.result });
  addCheck("first_screen_budget_pass", (readiness.budgets?.firstScreenFailures || []).length === 0, {
    maxFirstScreenKB: readiness.budgets?.maxFirstScreenKB,
    budgetKB: FIRST_SCREEN_BUDGET_KB,
  });
  addCheck("detail_projection_budget_pass", (readiness.budgets?.detailProjectionFailures || []).length === 0, {
    maxDetailProjectionKB: readiness.budgets?.maxDetailProjectionKB,
    budgetKB: DETAIL_PROJECTION_BUDGET_KB,
  });
  addCheck("field_boundary_pass", (readiness.fieldBoundary?.failures || []).length === 0, {
    checkedFiles: readiness.fieldBoundary?.checkedFiles,
    skippedEvidenceFiles: readiness.fieldBoundary?.skippedEvidenceFiles,
  });
  addCheck("candidate_path_boundary_pass", (readiness.pathBoundary?.duplicatePathFailures || []).length === 0, {
    duplicatePathFailures: readiness.pathBoundary?.duplicatePathFailures || [],
  });
}

if (fs.existsSync(publicDataDir)) {
  const files = listJsonFiles(publicDataDir);
  addCheck("candidate_json_files_exist", files.length > 0, { fileCount: files.length });
  const firstScreenFiles = files.filter((filePath) =>
    [
      "capability/index.json",
      "environment/navigator.json",
      "maintenance/index.json",
      "shared-lookups/service-module-index.json",
      "lifecycle/index.json",
      "standards/index.json",
      "oi149-split-manifest.json",
    ].includes(path.relative(publicDataDir, filePath))
  );
  const firstScreenFailures = firstScreenFiles
    .map((filePath) => ({ path: path.relative(publicDataDir, filePath), sizeKB: sizeKb(filePath) }))
    .filter((item) => item.sizeKB > FIRST_SCREEN_BUDGET_KB);
  addCheck("runtime_first_screen_files_under_budget", firstScreenFailures.length === 0, { firstScreenFailures });

  const projectionFailures = files
    .filter((filePath) => path.relative(publicDataDir, filePath).includes("/projections/"))
    .map((filePath) => ({ path: path.relative(publicDataDir, filePath), sizeKB: sizeKb(filePath) }))
    .filter((item) => item.sizeKB > DETAIL_PROJECTION_BUDGET_KB);
  addCheck("runtime_projection_files_under_budget", projectionFailures.length === 0, { projectionFailures });

  const fieldFailures = [];
  const runtimeStateFailures = [];
  for (const filePath of files) {
    const relativePath = path.relative(publicDataDir, filePath);
    const value = readJson(filePath);
    const packageType = String(value?.packageType || value?.package_type || "");
    if (value?.dataState === "candidate" || value?.data_state === "candidate" || packageType.includes("candidate")) {
      runtimeStateFailures.push({
        path: relativePath,
        packageType,
        dataState: value?.dataState || value?.data_state || "",
      });
    }
    if (relativePath.endsWith("evidence.json")) continue;
    const hits = scanForbiddenKeys(value);
    if (Object.keys(hits).length) fieldFailures.push({ path: relativePath, hits });
  }
  addCheck("runtime_public_data_not_candidate_state", runtimeStateFailures.length === 0, {
    failureCount: runtimeStateFailures.length,
    failures: runtimeStateFailures.slice(0, 10),
  });
  addCheck("runtime_field_boundary_pass", fieldFailures.length === 0, { fieldFailures });

  const environmentNavigatorPath = path.join(publicDataDir, "environment/navigator.json");
  if (fs.existsSync(environmentNavigatorPath)) {
    const environmentNavigator = readJson(environmentNavigatorPath);
    const navRows = flattenEnvironmentNavigator(environmentNavigator.tree || []);
    const indexRows = asArray(environmentNavigator.projections);
    const fieldFailures = navRows.filter(
      (row) => !Number.isInteger(row.navOrdinal) || !row.projectionKey || !row.projectionPath
    );
    addCheck("environment_navigator_projection_fields", fieldFailures.length === 0, {
      navRowCount: navRows.length,
      failureCount: fieldFailures.length,
      failures: sampleRows(fieldFailures),
    });

    const duplicateNavigatorPaths = duplicateValues(navRows.map((row) => row.projectionPath));
    addCheck("environment_navigator_projection_paths_unique", duplicateNavigatorPaths.length === 0, {
      navRowCount: navRows.length,
      duplicateCount: duplicateNavigatorPaths.length,
      duplicates: duplicateNavigatorPaths.slice(0, 10),
    });

    const missingProjectionFiles = navRows.filter(
      (row) => row.projectionPath && !fs.existsSync(path.join(publicDataDir, row.projectionPath))
    );
    addCheck("environment_navigator_projection_paths_exist", missingProjectionFiles.length === 0, {
      failureCount: missingProjectionFiles.length,
      failures: sampleRows(missingProjectionFiles),
    });

    const roundtripFailures = [];
    for (const row of navRows) {
      if (!row.projectionPath) continue;
      const projectionPath = path.join(publicDataDir, row.projectionPath);
      if (!fs.existsSync(projectionPath)) continue;
      const projection = readJson(projectionPath);
      if (
        projection.navOrdinal !== row.navOrdinal ||
        projection.projectionKey !== row.projectionKey ||
        projection.projectionPath !== row.projectionPath
      ) {
        roundtripFailures.push({
          navOrdinal: row.navOrdinal,
          navigatorProjectionKey: row.projectionKey,
          projectionProjectionKey: projection.projectionKey,
          navigatorProjectionPath: row.projectionPath,
          projectionProjectionPath: projection.projectionPath,
        });
      }
    }
    addCheck("environment_projection_key_roundtrip", roundtripFailures.length === 0, {
      failureCount: roundtripFailures.length,
      failures: roundtripFailures.slice(0, 10),
    });

    const duplicateIndexPaths = duplicateValues(indexRows.map((row) => row.path));
    addCheck("environment_projection_index_paths_unique", duplicateIndexPaths.length === 0, {
      indexRowCount: indexRows.length,
      duplicateCount: duplicateIndexPaths.length,
      duplicates: duplicateIndexPaths.slice(0, 10),
    });
    addCheck("environment_projection_index_row_count", indexRows.length === navRows.length, {
      navRowCount: navRows.length,
      indexRowCount: indexRows.length,
    });
    const indexByOrdinal = new Map(indexRows.map((row) => [row.navOrdinal, row]));
    const indexMismatchRows = navRows.filter((row) => {
      const indexRow = indexByOrdinal.get(row.navOrdinal);
      return !indexRow || indexRow.path !== row.projectionPath || indexRow.projectionKey !== row.projectionKey;
    });
    addCheck("environment_projection_index_matches_navigator", indexMismatchRows.length === 0, {
      failureCount: indexMismatchRows.length,
      failures: sampleRows(indexMismatchRows),
    });
  }

  const capabilityIndexPath = path.join(publicDataDir, "capability/index.json");
  if (fs.existsSync(capabilityIndexPath)) {
    const capabilityIndex = readJson(capabilityIndexPath);
    const projectionRows = asArray(capabilityIndex.projections);
    const topLevelRows = projectionRows.filter((row) => ["capability_category", "capability_domain"].includes(row.type));
    const topLevelDetailFailures = [];
    for (const row of topLevelRows) {
      const projectionPath = path.join(publicDataDir, row.path || "");
      if (!row.path || !fs.existsSync(projectionPath)) {
        topLevelDetailFailures.push({ code: row.code, type: row.type, reason: "missing_projection_file", path: row.path || "" });
        continue;
      }
      const projection = readJson(projectionPath);
      if (
        projection.detailMode !== "overview" ||
        projection.objects ||
        projection.relations ||
        !projection.deferred?.technicalMappingRows ||
        !projection.deferred?.managementMappingRows ||
        !projection.deferred?.standardMappingRows ||
        !projection.deferred?.standardControls
      ) {
        topLevelDetailFailures.push({
          code: row.code,
          type: row.type,
          detailMode: projection.detailMode,
          hasObjects: Boolean(projection.objects),
          hasRelations: Boolean(projection.relations),
          deferred: projection.deferred || null,
        });
      }
    }
    addCheck("capability_top_level_projections_are_overview_only", topLevelDetailFailures.length === 0, {
      checkedRows: topLevelRows.length,
      failureCount: topLevelDetailFailures.length,
      failures: topLevelDetailFailures.slice(0, 10),
    });

    const focusRows = projectionRows.filter((row) => row.type === "capability_focus");
    const focusDetailFailures = [];
    for (const row of focusRows) {
      const projectionPath = path.join(publicDataDir, row.path || "");
      if (!row.path || !fs.existsSync(projectionPath)) continue;
      const projection = readJson(projectionPath);
      if (projection.detailMode !== "detail" || !projection.objects || !Array.isArray(projection.relations)) {
        focusDetailFailures.push({
          code: row.code,
          detailMode: projection.detailMode,
          hasObjects: Boolean(projection.objects),
          hasRelations: Array.isArray(projection.relations),
        });
      }
    }
    addCheck("capability_focus_projections_keep_detail", focusDetailFailures.length === 0, {
      checkedRows: focusRows.length,
      failureCount: focusDetailFailures.length,
      failures: focusDetailFailures.slice(0, 10),
    });
  }
}

const failures = checks.filter((check) => !check.ok);
const report = {
  result: failures.length ? "fail" : "pass",
  candidateDir: path.relative(ROOT, candidateDir),
  checkCount: checks.length,
  failureCount: failures.length,
  failures,
};
console.log(JSON.stringify(report, null, 2));
if (failures.length) process.exitCode = 1;
