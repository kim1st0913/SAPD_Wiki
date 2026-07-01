import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const ROOT = process.cwd();
const DEFAULT_CANDIDATE_DIR = path.join(ROOT, "data/exports/worker-verify/oi-149-p4-json-split-candidate");
const TARGET_DATA_DIR = path.join(ROOT, "frontend/capability-browser/public/data");
const CONFIRM_FLAG = "--confirm-oi149-public-data-write";
const ALLOWED_PREFIXES = [
  "capability/",
  "environment/",
  "lifecycle/",
  "maintenance/",
  "shared-lookups/",
  "standards/",
];
const REQUIRED_RUNTIME_FILES = [
  "oi149-split-manifest.json",
  "capability/index.json",
  "environment/navigator.json",
  "lifecycle/index.json",
  "maintenance/index.json",
  "shared-lookups/service-module-index.json",
  "standards/index.json",
];

function hasFlag(name) {
  return process.argv.includes(name);
}

function argValue(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] || "" : "";
}

function timestamp() {
  return new Date().toISOString().replace(/[-:.]/g, "").replace("T", "T").slice(0, 15) + "Z";
}

function relativeToRoot(filePath) {
  return path.relative(ROOT, filePath).split(path.sep).join("/");
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function sha256File(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

function sizeKb(filePath) {
  return Math.round((fs.statSync(filePath).size / 1024) * 10) / 10;
}

function fail(message, detail = {}) {
  console.error(JSON.stringify({ result: "fail", message, ...detail }, null, 2));
  process.exit(1);
}

function normalizeRelativePath(relativePath) {
  const raw = String(relativePath || "").replace(/\\/g, "/");
  const normalized = path.posix.normalize(raw);
  if (!normalized || normalized === "." || normalized.startsWith("../") || path.posix.isAbsolute(normalized)) {
    throw new Error(`Unsafe relative path: ${relativePath}`);
  }
  if (!normalized.endsWith(".json")) {
    throw new Error(`Only JSON files can be applied: ${relativePath}`);
  }
  const allowed = normalized === "oi149-split-manifest.json" || ALLOWED_PREFIXES.some((prefix) => normalized.startsWith(prefix));
  if (!allowed) {
    throw new Error(`Path is outside OI-149 split apply boundary: ${relativePath}`);
  }
  return normalized;
}

function safeJoin(root, relativePath) {
  const normalized = normalizeRelativePath(relativePath);
  const filePath = path.resolve(root, ...normalized.split("/"));
  const rootPath = path.resolve(root);
  if (filePath !== rootPath && !filePath.startsWith(`${rootPath}${path.sep}`)) {
    throw new Error(`Path escapes root: ${relativePath}`);
  }
  return filePath;
}

function listJsonFiles(rootDir, baseDir = rootDir) {
  const result = [];
  if (!fs.existsSync(rootDir)) return result;
  for (const name of fs.readdirSync(rootDir)) {
    const filePath = path.join(rootDir, name);
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      result.push(...listJsonFiles(filePath, baseDir));
    } else if (stat.isFile() && name.endsWith(".json")) {
      result.push(path.relative(baseDir, filePath).split(path.sep).join("/"));
    }
  }
  return result;
}

function unique(values) {
  return [...new Set(values)];
}

function readPreviousSplitFiles() {
  const manifestPath = path.join(TARGET_DATA_DIR, "oi149-split-manifest.json");
  if (!fs.existsSync(manifestPath)) return [];
  const manifest = readJson(manifestPath);
  if (manifest?.contract !== "oi149-p4-split-v1") return [];
  const paths = Array.isArray(manifest.files) ? manifest.files.map((file) => file.path).filter(Boolean) : [];
  return unique(["oi149-split-manifest.json", ...paths].map(normalizeRelativePath));
}

function validateCandidate(candidateDir) {
  const candidatePublicDataDir = path.join(candidateDir, "public-data");
  const manifestPath = path.join(candidateDir, "candidate-manifest.json");
  const readinessPath = path.join(candidateDir, "candidate-readiness.json");
  const runtimeManifestPath = path.join(candidatePublicDataDir, "oi149-split-manifest.json");

  if (!fs.existsSync(candidateDir)) fail("Candidate directory does not exist.", { candidateDir: relativeToRoot(candidateDir) });
  if (!fs.existsSync(candidatePublicDataDir)) fail("Candidate public-data directory does not exist.", { candidatePublicDataDir: relativeToRoot(candidatePublicDataDir) });
  if (!fs.existsSync(manifestPath)) fail("candidate-manifest.json is missing.", { manifestPath: relativeToRoot(manifestPath) });
  if (!fs.existsSync(readinessPath)) fail("candidate-readiness.json is missing.", { readinessPath: relativeToRoot(readinessPath) });
  if (!fs.existsSync(runtimeManifestPath)) fail("oi149-split-manifest.json is missing from candidate public-data.", { runtimeManifestPath: relativeToRoot(runtimeManifestPath) });

  const manifest = readJson(manifestPath);
  const readiness = readJson(readinessPath);
  const runtimeManifest = readJson(runtimeManifestPath);
  if (manifest?.packageType !== "oi-149-p4-json-split-candidate-manifest") {
    fail("Candidate manifest packageType is not OI-149 P4.", { packageType: manifest?.packageType });
  }
  if (manifest.formalPublicDataModified !== false) {
    fail("Candidate manifest must be generated before formal public data modification.", {
      formalPublicDataModified: manifest.formalPublicDataModified,
    });
  }
  if (readiness.result !== "pass" || manifest.audit?.result !== "pass") {
    fail("Candidate readiness must be pass before apply.", {
      readinessResult: readiness.result,
      manifestAuditResult: manifest.audit?.result,
    });
  }
  if (runtimeManifest?.contract !== "oi149-p4-split-v1" || runtimeManifest?.dataState !== "ready") {
    fail("Runtime split manifest is not ready.", {
      contract: runtimeManifest?.contract,
      dataState: runtimeManifest?.dataState,
    });
  }

  const candidateFiles = listJsonFiles(candidatePublicDataDir).map(normalizeRelativePath).sort();
  const candidateFileSet = new Set(candidateFiles);
  const missingRuntimeFiles = REQUIRED_RUNTIME_FILES.filter((file) => !candidateFileSet.has(file));
  if (missingRuntimeFiles.length) {
    fail("Required runtime split files are missing.", { missingRuntimeFiles });
  }

  const listedFiles = Array.isArray(manifest.files) ? manifest.files.map((file) => normalizeRelativePath(file.path)).sort() : [];
  const missingListedFiles = listedFiles.filter((file) => !candidateFileSet.has(file));
  const unlistedCandidateFiles = candidateFiles.filter((file) => !new Set(listedFiles).has(file));
  if (missingListedFiles.length || unlistedCandidateFiles.length) {
    fail("Candidate file manifest does not match public-data files.", {
      missingListedFiles: missingListedFiles.slice(0, 20),
      unlistedCandidateFiles: unlistedCandidateFiles.slice(0, 20),
    });
  }

  return {
    candidatePublicDataDir,
    manifest,
    readiness,
    runtimeManifest,
    candidateFiles,
  };
}

function buildPlan(candidatePublicDataDir, candidateFiles) {
  const previousSplitFiles = readPreviousSplitFiles();
  const candidateSet = new Set(candidateFiles);
  const staleFiles = previousSplitFiles.filter((file) => !candidateSet.has(file));
  const targetExistingFiles = candidateFiles.filter((file) => fs.existsSync(safeJoin(TARGET_DATA_DIR, file)));
  const backupFiles = unique([...targetExistingFiles, ...staleFiles.filter((file) => fs.existsSync(safeJoin(TARGET_DATA_DIR, file)))]).sort();

  const writeOperations = candidateFiles.map((file) => {
    const sourcePath = safeJoin(candidatePublicDataDir, file);
    const targetPath = safeJoin(TARGET_DATA_DIR, file);
    const existedBefore = fs.existsSync(targetPath);
    return {
      path: file,
      action: existedBefore ? "overwrite" : "create",
      existedBefore,
      sizeKB: sizeKb(sourcePath),
      candidateSha256: sha256File(sourcePath),
      previousSha256: existedBefore ? sha256File(targetPath) : null,
    };
  });

  const staleOperations = staleFiles.map((file) => {
    const targetPath = safeJoin(TARGET_DATA_DIR, file);
    return {
      path: file,
      action: "remove_stale",
      existedBefore: fs.existsSync(targetPath),
      previousSha256: fs.existsSync(targetPath) ? sha256File(targetPath) : null,
    };
  });

  return {
    candidateFileCount: candidateFiles.length,
    previousSplitFileCount: previousSplitFiles.length,
    writeOperations,
    staleOperations,
    backupFiles,
  };
}

function applyPlan(candidatePublicDataDir, plan, backupDir) {
  const backupPublicDataDir = path.join(backupDir, "public-data");
  for (const file of plan.backupFiles) {
    const sourcePath = safeJoin(TARGET_DATA_DIR, file);
    const backupPath = safeJoin(backupPublicDataDir, file);
    fs.mkdirSync(path.dirname(backupPath), { recursive: true });
    fs.copyFileSync(sourcePath, backupPath);
  }

  for (const operation of plan.staleOperations) {
    if (!operation.existedBefore) continue;
    fs.unlinkSync(safeJoin(TARGET_DATA_DIR, operation.path));
  }

  for (const operation of plan.writeOperations) {
    const sourcePath = safeJoin(candidatePublicDataDir, operation.path);
    const targetPath = safeJoin(TARGET_DATA_DIR, operation.path);
    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
    fs.copyFileSync(sourcePath, targetPath);
  }
}

function rollbackInstructions(report) {
  return [
    "Do not delete legacy full JSON packages; they are the runtime fallback.",
    `Backup directory: ${report.backupDir || "(dry-run only)"}`,
    "To roll back an applied run, restore files listed in backupFiles from backupDir/public-data to frontend/capability-browser/public/data.",
    "For writeOperations where existedBefore=false, remove that newly-created split file if it should not remain active.",
    "Re-run frontend_content_smoke_check, audit_json_package_boundary, check_github_data_boundary, and dev_server_guard status after rollback.",
  ];
}

function writeMarkdownReport(filePath, report) {
  const lines = [
    "# OI-149 P4 Formal Apply Report",
    "",
    `- result: \`${report.result}\``,
    `- mode: \`${report.mode}\``,
    `- writesPerformed: \`${report.writesPerformed}\``,
    `- formalPublicDataModified: \`${report.formalPublicDataModified}\``,
    `- candidateFileCount: \`${report.candidateFileCount}\``,
    `- wouldWriteCount: \`${report.wouldWriteCount}\``,
    `- wouldRemoveStaleCount: \`${report.wouldRemoveStaleCount}\``,
    `- backupFileCount: \`${report.backupFileCount}\``,
    `- backupDir: \`${report.backupDir || ""}\``,
    "",
    "## Rollback",
    "",
    ...rollbackInstructions(report).map((line) => `- ${line}`),
    "",
  ];
  fs.writeFileSync(filePath, `${lines.join("\n")}\n`, "utf8");
}

function main() {
  const mode = hasFlag("--apply") ? "apply" : "dry-run";
  if (mode === "apply" && !hasFlag(CONFIRM_FLAG)) {
    fail("Formal public data apply requires explicit confirmation flag.", {
      requiredFlag: CONFIRM_FLAG,
      example: `node scripts/apply_oi149_split_candidate.mjs --apply ${CONFIRM_FLAG}`,
    });
  }

  const candidateDir = path.resolve(argValue("--candidate-dir") || DEFAULT_CANDIDATE_DIR);
  const applyTimestamp = timestamp();
  const backupDir = path.join(candidateDir, "formal-apply-backups", applyTimestamp);
  const reportDir = path.join(candidateDir, "formal-apply-reports");
  const reportJsonPath = path.join(reportDir, `oi149-p4-apply-${applyTimestamp}.json`);
  const reportMdPath = path.join(reportDir, `oi149-p4-apply-${applyTimestamp}.md`);
  const { candidatePublicDataDir, manifest, readiness, runtimeManifest, candidateFiles } = validateCandidate(candidateDir);
  const plan = buildPlan(candidatePublicDataDir, candidateFiles);
  const report = {
    packageType: "oi-149-p4-formal-apply-report",
    result: mode === "apply" ? "apply_pass" : "dry_run_pass",
    mode,
    generatedAt: new Date().toISOString(),
    candidateDir: relativeToRoot(candidateDir),
    targetDataDir: relativeToRoot(TARGET_DATA_DIR),
    backupDir: mode === "apply" ? relativeToRoot(backupDir) : relativeToRoot(backupDir),
    requiredConfirmFlag: CONFIRM_FLAG,
    writesPerformed: mode === "apply",
    formalPublicDataModified: mode === "apply",
    candidateFileCount: plan.candidateFileCount,
    previousSplitFileCount: plan.previousSplitFileCount,
    wouldWriteCount: plan.writeOperations.length,
    wouldOverwriteCount: plan.writeOperations.filter((operation) => operation.action === "overwrite").length,
    wouldCreateCount: plan.writeOperations.filter((operation) => operation.action === "create").length,
    wouldRemoveStaleCount: plan.staleOperations.filter((operation) => operation.existedBefore).length,
    backupFileCount: plan.backupFiles.length,
    backupFiles: plan.backupFiles,
    sampleWriteOperations: plan.writeOperations.slice(0, 20),
    sampleStaleOperations: plan.staleOperations.slice(0, 20),
    candidateReadiness: {
      result: readiness.result,
      maxFirstScreenKB: readiness.budgets?.maxFirstScreenKB,
      maxDetailProjectionKB: readiness.budgets?.maxDetailProjectionKB,
      fieldBoundaryFailures: readiness.fieldBoundary?.failures?.length || 0,
    },
    runtimeManifest: {
      contract: runtimeManifest.contract,
      capabilityIndexPath: runtimeManifest.domains?.capability?.indexPath,
      environmentNavigatorPath: runtimeManifest.domains?.environment?.navigatorPath,
    },
    sourcePackages: manifest.sourcePackages || {},
  };
  report.rollbackInstructions = rollbackInstructions(report);

  if (mode === "apply") {
    applyPlan(candidatePublicDataDir, plan, backupDir);
    writeJson(reportJsonPath, report);
    writeMarkdownReport(reportMdPath, report);
    report.reportJsonPath = relativeToRoot(reportJsonPath);
    report.reportMdPath = relativeToRoot(reportMdPath);
  }

  console.log(JSON.stringify(report, null, 2));
}

main();
