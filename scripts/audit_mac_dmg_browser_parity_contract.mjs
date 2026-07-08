#!/usr/bin/env node
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const projectRoot = path.resolve(path.dirname(__filename), "..");
const args = new Set(process.argv.slice(2));
const strictCurrentSource = args.has("--strict-current-source");

function read(relativePath) {
  return readFileSync(path.join(projectRoot, relativePath), "utf8");
}

function sha256File(filePath) {
  return createHash("sha256").update(readFileSync(filePath)).digest("hex");
}

function add(checks, id, ok, detail = {}) {
  checks.push({ id, ok: Boolean(ok), ...detail });
}

function warn(warnings, id, detail = {}) {
  warnings.push({ id, ...detail });
}

const files = {
  buildAndRun: "apps/macos/SAPDWiki/script/build_and_run.sh",
  packageDmg: "apps/macos/SAPDWiki/script/package_dmg.sh",
  macWrapper: "apps/macos/SAPDWiki/Sources/SAPDWiki/main.swift",
  macReadme: "apps/macos/SAPDWiki/README.md",
  buildZipBundle: "scripts/build_zip_bundle.py",
  contract: "docs/09-delivery/mac-dmg-browser-parity-contract.md",
};

const buildAndRun = read(files.buildAndRun);
const packageDmg = read(files.packageDmg);
const macWrapper = read(files.macWrapper);
const macReadme = read(files.macReadme);
const buildZipBundle = read(files.buildZipBundle);
const contract = read(files.contract);

const checks = [];
const warnings = [];

add(checks, "frontend_source_is_capability_browser", buildAndRun.includes("frontend/capability-browser"), {
  file: files.buildAndRun,
});
add(checks, "base_db_source_is_project_sqlite", buildAndRun.includes("data/database/sapd_wiki.sqlite3"), {
  file: files.buildAndRun,
});

const backendHashInputs = [
  "run_local_server.py",
  "check_bundle_runtime.py",
  "create_user_db.py",
  "export_diagnostics.py",
  "package_backend_pyinstaller.py",
  "src\" / \"sapd_wiki",
];
add(checks, "backend_hash_covers_runtime_inputs", backendHashInputs.every((item) => buildAndRun.includes(item)), {
  missing: backendHashInputs.filter((item) => !buildAndRun.includes(item)),
});
add(checks, "external_backend_requires_explicit_opt_in", buildAndRun.includes("SAPD_WIKI_ALLOW_EXTERNAL_BACKEND") && buildAndRun.includes("emergency diagnostics only"), {
  file: files.buildAndRun,
});
add(checks, "runtime_fingerprint_covers_frontend_config_base_backend", [
  "SAPD-Wiki-Backend",
  "app\" / \"frontend-dist",
  "config",
  "data\" / \"base",
  "diagnostics",
].every((item) => buildAndRun.includes(item)), {
  file: files.buildAndRun,
});

add(checks, "dmg_runtime_uses_wkwebview_wrapper_not_system_browser", [
  "WKWebViewConfiguration",
  "WKWebView(frame: .zero",
  "webView?.load(URLRequest(url: url))",
  "\"--no-browser\"",
].every((item) => macWrapper.includes(item)), {
  file: files.macWrapper,
});

if (!macWrapper.includes("WKUIDelegate")) {
  warn(warnings, "wkwebview_has_no_explicit_ui_delegate", {
    file: files.macWrapper,
    impact: "JavaScript alert/confirm, target=_blank, file panels, and some browser UI behaviors are not equivalent to Safari/Chrome unless bridged explicitly.",
  });
}
if (!macWrapper.includes("WKDownload") && !macWrapper.includes("decidePolicyFor navigationResponse")) {
  warn(warnings, "wkwebview_has_no_explicit_download_delegate", {
    file: files.macWrapper,
    impact: "Browser-native downloads are not guaranteed to behave like a system browser; backend-saved exports are safer than anchor downloads.",
  });
}
if (!macWrapper.includes("toggleFullScreen") && !macWrapper.includes("enterFullScreenMode")) {
  warn(warnings, "wrapper_has_no_explicit_fullscreen_bridge", {
    file: files.macWrapper,
    impact: "DOM Fullscreen API and native window fullscreen are not a single verified contract in the DMG wrapper.",
  });
}

add(checks, "dmg_builds_license_and_no_license_by_default", packageDmg.includes('DMG_VARIANT="${SAPD_WIKI_DMG_VARIANT:-all}"') && packageDmg.includes('build_variant "license"') && packageDmg.includes('build_variant "no-license"'), {
  file: files.packageDmg,
});
add(checks, "dmg_uses_build_and_run_build_per_variant", packageDmg.includes('SAPD_WIKI_LICENSE_MODE="$license_mode" "$SCRIPT_DIR/build_and_run.sh" build'), {
  file: files.packageDmg,
});
add(checks, "dmg_resigns_staged_app_after_readme_mutation", packageDmg.includes("write_runtime_readme") && packageDmg.includes("resign_staged_app"), {
  file: files.packageDmg,
});
add(checks, "dmg_created_with_hdiutil", packageDmg.includes("hdiutil create"), {
  file: files.packageDmg,
});

add(checks, "bundle_copies_frontend_base_and_creates_empty_user_db", [
  "copy_tree(args.frontend_dist.resolve()",
  "sapd_wiki_base.sqlite3",
  "initialize_user_db",
  "sapd_wiki_user.sqlite3",
].every((item) => buildZipBundle.includes(item)), {
  file: files.buildZipBundle,
});
add(checks, "bundle_manifest_records_user_schema", buildZipBundle.includes('"user_database"') && buildZipBundle.includes('"schema_version": args.user_schema_version'), {
  file: files.buildZipBundle,
});

const readmeRequiredSnippets = [
  "用户选择父级保存位置",
  "SAPDWiki/Runtime",
  "已有用户库默认复用",
  "user_schema_0.3",
];
const readmeForbiddenSnippets = [
  "~/Library/Application Support/SAPD Wiki/Runtime",
  "Runtime 指纹变化时",
  "重新 seed 空用户库",
];
add(checks, "mac_readme_matches_selected_runtime_root_contract", readmeRequiredSnippets.every((item) => macReadme.includes(item)) && readmeForbiddenSnippets.every((item) => !macReadme.includes(item)), {
  file: files.macReadme,
  missing: readmeRequiredSnippets.filter((item) => !macReadme.includes(item)),
  forbiddenPresent: readmeForbiddenSnippets.filter((item) => macReadme.includes(item)),
});

const requiredContractSnippets = [
  "必须一致",
  "允许差异",
  "当前流程差异",
  "可接受",
  "不可接受",
  "5173",
  "DMG Runtime",
  "license",
  "no-license",
  "user_schema_0.3",
];
add(checks, "contract_documents_parity_and_difference_rules", requiredContractSnippets.every((item) => contract.includes(item)), {
  file: files.contract,
  missing: requiredContractSnippets.filter((item) => !contract.includes(item)),
});

const interactionContractSnippets = [
  "交互验收矩阵",
  "架构分层差异",
  "全屏控件",
  "按钮可点性",
  "显示异常",
  "同包多机差异",
  "Runtime 指纹",
  "前端文件哈希",
];
add(checks, "contract_documents_runtime_interaction_audit_matrix", interactionContractSnippets.every((item) => contract.includes(item)), {
  file: files.contract,
  missing: interactionContractSnippets.filter((item) => !contract.includes(item)),
});

const frontendParityFiles = [
  "index.html",
  "app.js",
  "styles.css",
  "components/EnvironmentBasemapViewer.js",
];
const stagingRuntimeRoots = [
  "apps/macos/SAPDWiki/dist/dmg-staging-license/SAPD Wiki.app/Contents/Resources/Runtime",
  "apps/macos/SAPDWiki/dist/dmg-staging-no-license/SAPD Wiki.app/Contents/Resources/Runtime",
]
  .map((relativePath) => path.join(projectRoot, relativePath))
  .filter((runtimeRoot) => existsSync(runtimeRoot));

const sourceFrontendRoot = path.join(projectRoot, "frontend/capability-browser");
const frontendDrift = [];
for (const runtimeRoot of stagingRuntimeRoots) {
  const stagedFrontendRoot = path.join(runtimeRoot, "app/frontend-dist");
  for (const relativePath of frontendParityFiles) {
    const sourceFile = path.join(sourceFrontendRoot, relativePath);
    const stagedFile = path.join(stagedFrontendRoot, relativePath);
    if (!existsSync(stagedFile)) {
      frontendDrift.push({ runtimeRoot: path.relative(projectRoot, runtimeRoot), file: relativePath, reason: "missing_in_staging" });
      continue;
    }
    const sourceHash = sha256File(sourceFile);
    const stagedHash = sha256File(stagedFile);
    if (sourceHash !== stagedHash) {
      frontendDrift.push({
        runtimeRoot: path.relative(projectRoot, runtimeRoot),
        file: relativePath,
        sourceHash,
        stagedHash,
      });
    }
  }
}
if (strictCurrentSource) {
  add(checks, "latest_dmg_staging_frontend_matches_current_source", frontendDrift.length === 0, {
    skipped: stagingRuntimeRoots.length === 0,
    drift: frontendDrift,
  });
} else if (frontendDrift.length) {
  warn(warnings, "latest_dmg_staging_frontend_differs_from_current_source", {
    skipped: stagingRuntimeRoots.length === 0,
    drift: frontendDrift,
    impact: "This is a release freshness warning, not proof of the historical Web-vs-DMG root cause. Use --strict-current-source only immediately after a build when staging is expected to equal the current workspace.",
  });
}

const variantFrontendDrift = [];
if (stagingRuntimeRoots.length >= 2) {
  const [firstRoot, ...otherRoots] = stagingRuntimeRoots;
  for (const runtimeRoot of otherRoots) {
    for (const relativePath of frontendParityFiles) {
      const firstFile = path.join(firstRoot, "app/frontend-dist", relativePath);
      const nextFile = path.join(runtimeRoot, "app/frontend-dist", relativePath);
      if (!existsSync(firstFile) || !existsSync(nextFile)) continue;
      const firstHash = sha256File(firstFile);
      const nextHash = sha256File(nextFile);
      if (firstHash !== nextHash) {
        variantFrontendDrift.push({
          left: path.relative(projectRoot, firstRoot),
          right: path.relative(projectRoot, runtimeRoot),
          file: relativePath,
          leftHash: firstHash,
          rightHash: nextHash,
        });
      }
    }
  }
}
add(checks, "license_and_no_license_staging_frontend_match", variantFrontendDrift.length === 0, {
  skipped: stagingRuntimeRoots.length < 2,
  drift: variantFrontendDrift,
});

const failed = checks.filter((check) => !check.ok);
const output = {
  result: failed.length ? "fail" : "pass",
  failed: failed.map((check) => check.id),
  warnings,
  checks,
};

if (args.has("--json")) {
  console.log(JSON.stringify(output, null, 2));
} else {
  console.log(`result=${output.result}`);
  for (const check of checks) {
    const missing = check.missing?.length ? ` missing=${check.missing.join(",")}` : "";
    console.log(`check=${check.id} ok=${check.ok}${missing}`);
  }
  for (const warning of warnings) {
    console.log(`warning=${warning.id}`);
  }
}

if (failed.length) process.exit(1);
