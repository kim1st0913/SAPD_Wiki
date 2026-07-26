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
  dataClient: "frontend/capability-browser/dataClient.js",
  buildZipBundle: "scripts/build_zip_bundle.py",
  bundleServer: "scripts/run_local_server.py",
  apiServer: "src/sapd_wiki/api_server.py",
  maturity: "src/sapd_wiki/maturity.py",
  packageBackend: "scripts/package_backend_pyinstaller.py",
  agents: "AGENTS.md",
  contract: "docs/09-delivery/mac-dmg-browser-parity-contract.md",
  releaseMatrix: "docs/09-delivery/release-acceptance-matrix-0.1.md",
};

const buildAndRun = read(files.buildAndRun);
const packageDmg = read(files.packageDmg);
const macWrapper = read(files.macWrapper);
const macReadme = read(files.macReadme);
const dataClient = read(files.dataClient);
const buildZipBundle = read(files.buildZipBundle);
const bundleServer = read(files.bundleServer);
const apiServer = read(files.apiServer);
const maturity = read(files.maturity);
const packageBackend = read(files.packageBackend);
const agents = read(files.agents);
const contract = read(files.contract);
const releaseMatrix = read(files.releaseMatrix);

const checks = [];
const warnings = [];

add(checks, "frontend_source_is_capability_browser", buildAndRun.includes("frontend/capability-browser"), {
  file: files.buildAndRun,
});
add(checks, "base_db_source_is_project_sqlite", buildAndRun.includes("data/database/sapd_wiki.sqlite3"), {
  file: files.buildAndRun,
});
add(checks, "content_asset_db_is_packaged_when_present", [
  "SAPD_WIKI_CONTENT_ASSET_DB",
  "data/database/sapd_content_assets.sqlite3",
  "--content-asset-db",
].every((item) => buildAndRun.includes(item)) && [
  "sapd_content_assets.sqlite3",
  '"content_asset_database"',
  "args.content_asset_db",
].every((item) => buildZipBundle.includes(item)) && [
  "content_asset_database",
  "ContentAssetService",
].every((item) => bundleServer.includes(item)), {
  files: [files.buildAndRun, files.buildZipBundle, files.bundleServer],
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
if (!macWrapper.includes("WKDownload") && !macWrapper.includes("decidePolicyFor navigationResponse") && !dataClient.includes("saveToConfiguredDirectory")) {
  warn(warnings, "wkwebview_has_no_explicit_download_delegate", {
    file: files.macWrapper,
    impact: "Browser-native downloads are not guaranteed to behave like a system browser; backend-saved exports are safer than anchor downloads.",
  });
}
add(checks, "app_separates_import_export_and_internal_runtime", [
  'defaultImportDirectory(for: dataRoot)',
  '"maturity-reports"',
  '"maturity-scores"',
  '"maturity-templates"',
  '"issues"',
  '"diagnostics"',
  'title: "文件上传路径"',
  'title: "文件下载路径"',
  'title: "Runtime"',
  'object["import_dir"]',
  'object["download_dir"]',
].every((item) => macWrapper.includes(item)) && [
  "saveToConfiguredDirectory",
  "/api/v1/maturity/report/export",
].every((item) => dataClient.includes(item)), {
  files: [files.macWrapper, files.dataClient],
});
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
add(checks, "backend_collects_unified_query_runtime_and_contract", [
  'rglob("*.py")',
  "runtime_src",
  "base-knowledge",
  '"mcp"',
  '"cryptography"',
].every((item) => packageBackend.includes(item)), {
  file: files.packageBackend,
});
add(checks, "bundle_includes_controlled_maturity_report_seed", [
  "SAPD_WIKI_MATURITY_REPORT_SEED",
  "SAPD_WIKI_MATURITY_REPORT_SEED_ARTIFACT",
  "demo-project-002=maturity-report-216c744b314ff70e8cfd-20260718-102008Z-9af11352",
  "data/user/maturity-reports",
].every((item) => buildAndRun.includes(item)) && [
  "maturity_report_seed",
  "maturity_report_seed_artifact",
  "copy_maturity_report_seed",
  'bundle_root / "data" / "user" / "maturity-reports"',
].every((item) => buildZipBundle.includes(item)) && macWrapper.includes("seedMaturityReportsIfNeeded"), {
  files: [files.buildAndRun, files.buildZipBundle, files.macWrapper],
});
add(checks, "maturity_test_package_declares_two_cases_and_one_matching_report", [
  "2 个受控测试案例",
  "1 个已完成、1 个正在进行",
  "1 份与当前评分哈希一致的正式报告",
].every((item) => packageDmg.includes(item)), {
  file: files.packageDmg,
});
add(checks, "bundle_runtime_selects_two_case_delivery_profile", [
  'RUNTIME_LABEL == "bundle"',
  'return "delivery"',
  "project_profile=maturity_workspace_project_profile()",
].every((item) => apiServer.includes(item)) && bundleServer.includes("project_profile=projection_api.maturity_workspace_project_profile()") && [
  'project_profile: str = "development"',
  'normalized_profile == "delivery"',
  '("demo-project-001", "demo-project-002")',
  '"demo-project-005"',
].every((item) => maturity.includes(item)), {
  files: [files.apiServer, files.bundleServer, files.maturity],
});
add(checks, "backend_collects_maturity_xlsx_dependency", [
  "ensure_runtime_dependencies",
  '"--collect-all"',
  '"openpyxl"',
].every((item) => packageBackend.includes(item)), {
  file: files.packageBackend,
});

const readmeRequiredSnippets = [
  "用户选择父级保存位置",
  "SAPDWiki/",
  "import/",
  "export/",
  "Runtime/",
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

const bugRuntimeClassificationSnippets = [
  "Classify Impact Before Changing",
  "shared runtime",
  "data / ETL / package",
  "web-only",
  "app-only",
  "release blocker",
  "Passing at `5173` does not prove the DMG App",
];
add(checks, "agents_documents_bug_runtime_impact_classification", bugRuntimeClassificationSnippets.every((item) => agents.includes(item)), {
  file: files.agents,
  missing: bugRuntimeClassificationSnippets.filter((item) => !agents.includes(item)),
});

const parityBugClassificationSnippets = [
  "Bug 修复影响面分类",
  "后续所有 bug 根因修复都必须先判断运行面",
  "Web 通过不能关闭",
  "包内 Runtime 是否需要重建",
  "release-acceptance-matrix-0.1.md",
];
add(checks, "contract_documents_bug_runtime_impact_classification", parityBugClassificationSnippets.every((item) => contract.includes(item)), {
  file: files.contract,
  missing: parityBugClassificationSnippets.filter((item) => !contract.includes(item)),
});

const requiredReleaseMatrixSnippets = [
  "SAPD Wiki 发布验收对象不是“网页是否能打开”",
  "dev-smoke",
  "pre-dmg",
  "internal-release",
  "public-release",
  "证据目录",
  "退出标准",
  "阻断分级",
  "自动验收闸门",
  "人工验收矩阵",
  "M1-01",
  "M2-01",
  "M3-01",
  "M5-01",
  "M7-01",
  "不做全量笛卡尔积",
];
add(checks, "release_acceptance_matrix_defines_execution_gates", requiredReleaseMatrixSnippets.every((item) => releaseMatrix.includes(item)), {
  file: files.releaseMatrix,
  missing: requiredReleaseMatrixSnippets.filter((item) => !releaseMatrix.includes(item)),
});

const releaseBugClassificationSnippets = [
  "Bug 修复进入发布验收的规则",
  "每个 bug 根因修复都必须先做 Web / App 运行面分类",
  "manual-test-log.md",
  "known-limitations.md",
  "P0 / P1",
];
add(checks, "release_matrix_documents_bug_fix_acceptance_routing", releaseBugClassificationSnippets.every((item) => releaseMatrix.includes(item)), {
  file: files.releaseMatrix,
  missing: releaseBugClassificationSnippets.filter((item) => !releaseMatrix.includes(item)),
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
