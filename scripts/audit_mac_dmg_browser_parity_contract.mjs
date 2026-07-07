#!/usr/bin/env node
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const projectRoot = path.resolve(path.dirname(__filename), "..");
const args = new Set(process.argv.slice(2));

function read(relativePath) {
  return readFileSync(path.join(projectRoot, relativePath), "utf8");
}

function add(checks, id, ok, detail = {}) {
  checks.push({ id, ok: Boolean(ok), ...detail });
}

const files = {
  buildAndRun: "apps/macos/SAPDWiki/script/build_and_run.sh",
  packageDmg: "apps/macos/SAPDWiki/script/package_dmg.sh",
  macReadme: "apps/macos/SAPDWiki/README.md",
  buildZipBundle: "scripts/build_zip_bundle.py",
  contract: "docs/09-delivery/mac-dmg-browser-parity-contract.md",
};

const buildAndRun = read(files.buildAndRun);
const packageDmg = read(files.packageDmg);
const macReadme = read(files.macReadme);
const buildZipBundle = read(files.buildZipBundle);
const contract = read(files.contract);

const checks = [];

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

const failed = checks.filter((check) => !check.ok);
const output = {
  result: failed.length ? "fail" : "pass",
  failed: failed.map((check) => check.id),
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
}

if (failed.length) process.exit(1);
