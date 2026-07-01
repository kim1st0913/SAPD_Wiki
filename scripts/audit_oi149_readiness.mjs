import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const ROOT = process.cwd();
const DEFAULT_URL = "http://127.0.0.1:5173";
const CANDIDATE_DIR = path.join(ROOT, "data/exports/worker-verify/oi-149-p4-json-split-candidate");
const FORMAL_SPLIT_MANIFEST = path.join(ROOT, "frontend/capability-browser/public/data/oi149-split-manifest.json");
const FORMAL_DATA_DIR = path.join(ROOT, "frontend/capability-browser/public/data");
const REQUIRED_RUNTIME_FILES = [
  "oi149-split-manifest.json",
  "capability/index.json",
  "environment/navigator.json",
  "lifecycle/index.json",
  "maintenance/index.json",
  "shared-lookups/service-module-index.json",
  "standards/index.json",
];
const REQUIRED_LEGACY_FALLBACK_FILES = [
  "capability-tree.json",
  "capability-workbench.json",
  "environment-workbench.json",
  "lifecycle-workbench.json",
  "maintenance-knowledge.json",
  "shared-lookups.json",
  "standards-index.json",
];

function hasFlag(name) {
  return process.argv.includes(name);
}

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] || fallback : fallback;
}

function normalizeOutput(value) {
  return String(value || "").trim();
}

function parseJsonOutput(output) {
  const text = normalizeOutput(output);
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function readJsonIfExists(filePath) {
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function runStep(step) {
  const startedAt = Date.now();
  const child = spawnSync(step.cmd, step.args, {
    cwd: ROOT,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  const durationMs = Date.now() - startedAt;
  const stdout = normalizeOutput(child.stdout);
  const stderr = normalizeOutput(child.stderr);
  const parsed = parseJsonOutput(stdout);
  const ok = child.status === 0 && !child.error;
  return {
    id: step.id,
    title: step.title,
    cmd: [step.cmd, ...step.args].join(" "),
    ok,
    status: child.status,
    durationMs,
    parsed,
    stdoutTail: stdout.length > 4000 ? stdout.slice(-4000) : stdout,
    stderrTail: stderr.length > 4000 ? stderr.slice(-4000) : stderr,
    error: child.error ? String(child.error.message || child.error) : null,
  };
}

function addGate(gates, id, ok, detail = {}) {
  gates.push({ id, ok, detail });
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function writeMarkdown(filePath, report) {
  const lines = [
    "# OI-149 Readiness Report",
    "",
    `- result: \`${report.result}\``,
    `- mode: \`${report.mode}\``,
    `- url: \`${report.url}\``,
    `- generatedAt: \`${report.generatedAt}\``,
    `- commandCount: \`${report.commandCount}\``,
    `- failedCommandCount: \`${report.failedCommands.length}\``,
    `- failedGateCount: \`${report.failedGates.length}\``,
    "",
    "## Gates",
    "",
    ...report.gates.map((gate) => `- ${gate.ok ? "PASS" : "FAIL"} \`${gate.id}\``),
    "",
    "## Commands",
    "",
    ...report.commands.map((command) => `- ${command.ok ? "PASS" : "FAIL"} \`${command.id}\` (${command.durationMs}ms)`),
    "",
  ];
  fs.writeFileSync(filePath, `${lines.join("\n")}\n`, "utf8");
}

function reportPaths(mode, skipRuntime) {
  const suffixParts = [];
  if (mode !== "preapply") suffixParts.push(mode);
  if (skipRuntime) suffixParts.push("offline");
  const suffix = suffixParts.length ? `.${suffixParts.join(".")}` : "";
  return {
    json: path.join(CANDIDATE_DIR, `oi149-readiness-report${suffix}.json`),
    markdown: path.join(CANDIDATE_DIR, `oi149-readiness-report${suffix}.md`),
  };
}

function main() {
  const url = argValue("--url", DEFAULT_URL);
  const mode = argValue("--mode", "preapply");
  const skipRuntime = hasFlag("--skip-runtime");
  const skipBuild = hasFlag("--skip-build");
  if (!["preapply", "postapply"].includes(mode)) {
    console.error(JSON.stringify({ result: "fail", message: "mode must be preapply or postapply", mode }, null, 2));
    process.exit(1);
  }

  const steps = [
    ["check_app", "node", ["--check", "frontend/capability-browser/app.js"], "app.js syntax"],
    ["check_data_client", "node", ["--check", "frontend/capability-browser/dataClient.js"], "dataClient syntax"],
    ["check_annotation_drawer", "node", ["--check", "frontend/capability-browser/components/UserAnnotationDrawer.js"], "annotation drawer syntax"],
    ["check_build_candidate", "node", ["--check", "scripts/build_oi149_split_candidate.mjs"], "candidate builder syntax"],
    ["check_audit_candidate", "node", ["--check", "scripts/audit_oi149_split_candidate.mjs"], "candidate audit syntax"],
    ["check_audit_runtime", "node", ["--check", "scripts/audit_oi149_split_runtime_contract.mjs"], "runtime audit syntax"],
    ["check_apply_candidate", "node", ["--check", "scripts/apply_oi149_split_candidate.mjs"], "apply tool syntax"],
    ["check_lazy_contract", "node", ["--check", "scripts/audit_frontend_lazy_load_contract.mjs"], "lazy contract syntax"],
    ["check_annotation_contract", "node", ["--check", "scripts/audit_user_annotation_contract.mjs"], "annotation contract syntax"],
  ].map(([id, cmd, args, title]) => ({ id, cmd, args, title }));

  if (!skipBuild) {
    steps.push({ id: "build_candidate", cmd: "node", args: ["scripts/build_oi149_split_candidate.mjs"], title: "build split candidate" });
  }
  steps.push(
    { id: "audit_candidate", cmd: "node", args: ["scripts/audit_oi149_split_candidate.mjs"], title: "audit split candidate" },
    {
      id: "audit_runtime_contract",
      cmd: "node",
      args: mode === "postapply" ? ["scripts/audit_oi149_split_runtime_contract.mjs", "--source", "formal"] : ["scripts/audit_oi149_split_runtime_contract.mjs"],
      title: mode === "postapply" ? "audit formal split runtime contract" : "audit split runtime contract",
    },
    { id: "audit_lazy_contract", cmd: "node", args: ["scripts/audit_frontend_lazy_load_contract.mjs"], title: "audit lazy-load contract" },
    { id: "audit_annotation_contract", cmd: "node", args: ["scripts/audit_user_annotation_contract.mjs"], title: "audit annotation fuse contract" },
    { id: "audit_search_state", cmd: "node", args: ["scripts/audit_search_state_isolation.mjs"], title: "audit search state isolation" },
    { id: "audit_route_refresh", cmd: "node", args: ["scripts/audit_frontend_route_refresh_contract.mjs"], title: "audit route refresh contract" }
  );

  if (!skipRuntime) {
    steps.push(
      { id: "audit_capability_viewmodel", cmd: "node", args: ["scripts/audit_capability_viewmodel_contract.mjs", "--url", url], title: "audit capability ViewModel runtime" },
      { id: "audit_global_search_runtime", cmd: "node", args: ["scripts/audit_global_search_index_contract.mjs", "--url", url], title: "audit global search runtime" }
    );
  }

  steps.push(
    { id: "apply_dry_run", cmd: "node", args: ["scripts/apply_oi149_split_candidate.mjs"], title: "formal apply dry-run" },
    { id: "frontend_content_smoke", cmd: "node", args: ["scripts/frontend_content_smoke_check.mjs", "--skip-api"], title: "frontend content smoke" }
  );

  if (!skipRuntime) {
    steps.push(
      { id: "smoke_capability_route", cmd: "node", args: ["scripts/frontend_smoke_check.mjs", "--page", "capability-mapping", "--route", "/capability-mapping", "--url", url], title: "capability route smoke" },
      { id: "smoke_environment_route", cmd: "node", args: ["scripts/frontend_smoke_check.mjs", "--page", "environment-mapping", "--route", "/environment-mapping", "--url", url], title: "environment route smoke" }
    );
  }

  steps.push(
    { id: "audit_json_boundary", cmd: "python3", args: ["scripts/audit_json_package_boundary.py"], title: "JSON package boundary" },
    { id: "check_github_boundary", cmd: "python3", args: ["scripts/check_github_data_boundary.py"], title: "GitHub data boundary" },
    { id: "data_package_summary", cmd: "python3", args: ["scripts/data_package_summary.py", "--package", "all"], title: "formal package summary" },
    { id: "git_diff_check", cmd: "git", args: ["diff", "--check"], title: "git diff whitespace check" }
  );

  if (!skipRuntime) {
    steps.splice(steps.length - 1, 0, { id: "dev_server_status", cmd: "python3", args: ["scripts/dev_server_guard.py", "--status"], title: "5173 server status" });
  }

  const commands = steps.map(runStep);
  const gates = [];
  const failedCommands = commands.filter((command) => !command.ok);
  addGate(gates, "all_commands_pass", failedCommands.length === 0, {
    failed: failedCommands.map((command) => command.id),
  });

  const candidateAudit = commands.find((command) => command.id === "audit_candidate")?.parsed;
  addGate(gates, "candidate_audit_pass", candidateAudit?.result === "pass" && candidateAudit?.failureCount === 0, candidateAudit || {});

  const runtimeAudit = commands.find((command) => command.id === "audit_runtime_contract")?.parsed;
  addGate(gates, "split_runtime_contract_pass", runtimeAudit?.result === "pass" && runtimeAudit?.failureCount === 0, runtimeAudit || {});

  const lazyAudit = commands.find((command) => command.id === "audit_lazy_contract")?.parsed;
  addGate(gates, "lazy_contract_pass", lazyAudit?.result === "pass" && Array.isArray(lazyAudit?.issues) && lazyAudit.issues.length === 0, lazyAudit || {});

  const annotationAudit = commands.find((command) => command.id === "audit_annotation_contract")?.parsed;
  addGate(gates, "annotation_fuse_contract_pass", annotationAudit?.result === "pass" && Array.isArray(annotationAudit?.issues) && annotationAudit.issues.length === 0, annotationAudit || {});

  const applyDryRun = commands.find((command) => command.id === "apply_dry_run")?.parsed;
  addGate(
    gates,
    "formal_apply_dry_run_no_write",
    applyDryRun?.result === "dry_run_pass" && applyDryRun?.writesPerformed === false && applyDryRun?.formalPublicDataModified === false,
    {
      result: applyDryRun?.result,
      writesPerformed: applyDryRun?.writesPerformed,
      formalPublicDataModified: applyDryRun?.formalPublicDataModified,
      candidateFileCount: applyDryRun?.candidateFileCount,
      wouldWriteCount: applyDryRun?.wouldWriteCount,
      wouldOverwriteCount: applyDryRun?.wouldOverwriteCount,
    }
  );

  const formalManifestExists = fs.existsSync(FORMAL_SPLIT_MANIFEST);
  addGate(gates, "formal_split_manifest_state_matches_mode", mode === "postapply" ? formalManifestExists : !formalManifestExists, {
    mode,
    formalSplitManifestExists: formalManifestExists,
    path: path.relative(ROOT, FORMAL_SPLIT_MANIFEST),
  });

  if (mode === "postapply") {
    const formalManifest = readJsonIfExists(FORMAL_SPLIT_MANIFEST);
    const missingRuntimeFiles = REQUIRED_RUNTIME_FILES.filter((relativePath) => !fs.existsSync(path.join(FORMAL_DATA_DIR, relativePath)));
    const missingLegacyFiles = REQUIRED_LEGACY_FALLBACK_FILES.filter((relativePath) => !fs.existsSync(path.join(FORMAL_DATA_DIR, relativePath)));
    addGate(gates, "formal_split_manifest_ready", formalManifest?.contract === "oi149-p4-split-v1" && formalManifest?.dataState === "ready", {
      contract: formalManifest?.contract || null,
      dataState: formalManifest?.dataState || null,
    });
    addGate(gates, "formal_required_split_files_exist", missingRuntimeFiles.length === 0, { missingRuntimeFiles });
    addGate(gates, "legacy_full_packages_retained", missingLegacyFiles.length === 0, { missingLegacyFiles });
  }

  const failedGates = gates.filter((gate) => !gate.ok);
  const report = {
    packageType: "oi-149-readiness-report",
    result: failedCommands.length === 0 && failedGates.length === 0 ? "pass" : "fail",
    mode,
    skipRuntime,
    url,
    generatedAt: new Date().toISOString(),
    commandCount: commands.length,
    failedCommands,
    gates,
    failedGates,
    commands,
  };

  const reports = reportPaths(mode, skipRuntime);
  writeJson(reports.json, report);
  writeMarkdown(reports.markdown, report);
  console.log(
    JSON.stringify(
      {
        result: report.result,
        mode: report.mode,
        url: report.url,
        commandCount: report.commandCount,
        failedCommandCount: report.failedCommands.length,
        failedCommands: report.failedCommands.map((command) => command.id),
        failedGateCount: report.failedGates.length,
        failedGates: report.failedGates.map((gate) => gate.id),
        reportJson: path.relative(ROOT, reports.json),
        reportMarkdown: path.relative(ROOT, reports.markdown),
      },
      null,
      2
    )
  );
  process.exit(report.result === "pass" ? 0 : 1);
}

main();
