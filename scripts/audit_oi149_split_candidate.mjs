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
  const required = [
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
  for (const filePath of files) {
    const relativePath = path.relative(publicDataDir, filePath);
    if (relativePath.endsWith("evidence.json")) continue;
    const hits = scanForbiddenKeys(readJson(filePath));
    if (Object.keys(hits).length) fieldFailures.push({ path: relativePath, hits });
  }
  addCheck("runtime_field_boundary_pass", fieldFailures.length === 0, { fieldFailures });
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
