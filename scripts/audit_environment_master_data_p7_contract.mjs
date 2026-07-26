#!/usr/bin/env node

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { resolve } from "node:path";
import vm from "node:vm";

const root = resolve(import.meta.dirname, "..");
const outputRoot = resolve(root, "data/exports/worker-verify/plan-env-md");
const p71Dir = readdirSync(outputRoot)
  .filter((name) => /^p7-1-\d{8}T\d{6}Z$/.test(name))
  .map((name) => resolve(outputRoot, name))
  .filter(
    (path) =>
      statSync(path).isDirectory()
      && existsSync(resolve(path, "p7-1-definition-apply.json")),
  )
  .sort()
  .at(-1);
if (p71Dir) {
  execFileSync(
    "node",
    [resolve(root, "scripts/audit_environment_master_data_p7_1_contract.mjs")],
    { stdio: "inherit" },
  );
  process.exit(0);
}
const args = process.argv.slice(2);
const hasFlag = (name) => args.includes(name);
const argValue = (name, fallback = "") => {
  const index = args.indexOf(name);
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
};
const writeReport = hasFlag("--write-report");
const knownBaselineSearchFailure = hasFlag(
  "--known-baseline-global-search-smoke",
);
const baseUrl = argValue("--url", "").replace(/\/+$/, "");
const readJson = (path) => JSON.parse(readFileSync(path, "utf8"));
const sha256 = (path) =>
  createHash("sha256").update(readFileSync(path)).digest("hex");
const latestEvidenceDir = (phase, evidenceName) =>
  readdirSync(outputRoot)
    .filter((name) => new RegExp(`^${phase}-\\d{8}T\\d{6}Z$`).test(name))
    .map((name) => resolve(outputRoot, name))
    .filter(
      (path) =>
        statSync(path).isDirectory()
        && existsSync(resolve(path, evidenceName)),
    )
    .sort()
    .at(-1);

const p5Dir = latestEvidenceDir("p5", "p5-shadow-frontend.json");
const p6Dir = latestEvidenceDir("p6", "p6-formal-apply.json");
assert.ok(p5Dir, "P7 requires P5 evidence");
assert.ok(p6Dir, "P7 requires P6 evidence");
const p5 = readJson(resolve(p5Dir, "p5-shadow-frontend.json"));
const p6 = readJson(resolve(p6Dir, "p6-formal-apply.json"));
assert.equal(p5.feature_switch.default_enabled, false);
assert.equal(p5.feature_switch.enabled_mode_validated, true);
assert.equal(p5.feature_switch.disabled_mode_validated, true);
assert.equal(p6.gate.result, "ready_for_p7_controlled_switch");
assert.equal(p6.recovery.independent_restore_test, "pass");

const indexPath = resolve(root, "frontend/capability-browser/index.html");
const indexHtml = readFileSync(indexPath, "utf8");
assert.match(
  indexHtml,
  /environmentMasterDictionary:\s*true/,
  "P7 must enable environmentMasterDictionary",
);
const recoveryIndex = readFileSync(
  resolve(p6Dir, "recovery/frontend/index.before-p6.html"),
  "utf8",
);
assert.match(
  recoveryIndex,
  /environmentMasterDictionary:\s*false/,
  "P6 recovery package must retain the disabled feature state",
);

const protectedFiles = {
  user_database: "data/user/sapd_wiki_user.sqlite3",
  source_workbook: "data/raw-samples/wiki sample.xlsx",
  environment_workbench:
    "frontend/capability-browser/public/data/environment-workbench.json",
  environment_basemap_semantic:
    "frontend/capability-browser/generated/environmentBasemap.semantic.json",
  environment_basemap_node_details:
    "frontend/capability-browser/generated/environmentBasemap.node-details.json",
  analytics_summary:
    "frontend/capability-browser/public/data/analytics-summary.json",
  environment_dictionary:
    "frontend/capability-browser/public/data/environment-dictionary.json",
};
assert.equal(
  sha256(resolve(root, "data/database/sapd_wiki.sqlite3")),
  p6.database.sha256_after,
  "P7 must not mutate the formal base database",
);
for (const [key, relativePath] of Object.entries(protectedFiles)) {
  assert.equal(
    sha256(resolve(root, relativePath)),
    p6.preflight.input_hashes[key].sha256,
    `P7 protected input drift: ${key}`,
  );
}
for (const entry of p6.preflight.input_hashes.environment_data_tree.files) {
  assert.equal(
    sha256(
      resolve(
        root,
        "frontend/capability-browser/public/data/environment",
        entry.path,
      ),
    ),
    entry.sha256,
    `P7 protected environment projection drift: ${entry.path}`,
  );
}

const dictionary = readJson(
  resolve(
    root,
    "frontend/capability-browser/public/data/environment-dictionary.json",
  ),
);
assert.equal(dictionary.schema_version, "environment-dictionary-v1");
assert.equal(dictionary.data_state, "ready");
assert.deepEqual(dictionary.master_counts, {
  information_environments: 10,
  environment_segment_types: 16,
  information_objects: 51,
});
assert.deepEqual(dictionary.context_counts, {
  environment_segments: 29,
  environment_object_contexts: 67,
});
assert.equal(dictionary.usage_relations.length, 106);

const viewModelsSource = readFileSync(
  resolve(root, "frontend/capability-browser/viewModels.js"),
  "utf8",
);
const viewModelSandbox = { window: {} };
vm.runInNewContext(viewModelsSource, viewModelSandbox, {
  filename: "viewModels.js",
});
const viewModels = viewModelSandbox.window.sapdViewModels;
const master = viewModels.buildEnvironmentDirectoryWithFallback({
  dictionary,
  management: { environment_scope_tree: [] },
  search: "",
  enabled: true,
});
assert.equal(master.directoryMode, "master_dictionary");
assert.equal(master.rows.length, 77);
assert.equal(master.masterCategories.length, 3);
assert.equal(
  master.masterCategories.reduce(
    (sum, category) =>
      sum
      + category.records.reduce(
        (recordSum, record) => recordSum + record.contexts.length,
        0,
      ),
    0,
  ),
  106,
);
const fallback = viewModels.buildEnvironmentDirectoryWithFallback({
  dictionary,
  management: {
    environment_scope_tree:
      readJson(
        resolve(
          root,
          "frontend/capability-browser/public/data/environment-workbench.json",
        ),
      ).environment_scope_tree || [],
  },
  search: "",
  enabled: false,
});
assert.equal(fallback.directoryMode, "legacy_fallback");
assert.equal(fallback.fallbackReason, "feature_disabled");
assert.equal(fallback.rows.length, 67);

const sqliteEvidence = JSON.parse(
  execFileSync(
    "python3",
    [
      "-c",
      "import json,sqlite3,sys; c=sqlite3.connect(f'file:{sys.argv[1]}?mode=ro',uri=True); print(json.dumps({'integrity':c.execute('pragma integrity_check').fetchone()[0],'foreign_keys':len(c.execute('pragma foreign_key_check').fetchall()),'instance_of':c.execute(\"select count(*) from knowledge_relations where relation_type='instance_of'\").fetchone()[0]}))",
      resolve(root, "data/database/sapd_wiki.sqlite3"),
    ],
    { encoding: "utf8" },
  ),
);
assert.deepEqual(sqliteEvidence, {
  integrity: "ok",
  foreign_keys: 0,
  instance_of: 29,
});

const userHashBeforeRuntime = sha256(
  resolve(root, protectedFiles.user_database),
);
let runtime = null;
if (baseUrl) {
  const fetchData = async (path) => {
    const response = await fetch(`${baseUrl}${path}`, { cache: "no-store" });
    assert.equal(response.status, 200, `${path} must return 200`);
    const payload = await response.json();
    return payload.data || payload;
  };
  const runtimeDictionary = await fetchData(
    "/api/v1/environments/dictionary",
  );
  assert.deepEqual(
    JSON.parse(JSON.stringify(runtimeDictionary.master_counts)),
    dictionary.master_counts,
  );
  assert.deepEqual(
    JSON.parse(JSON.stringify(runtimeDictionary.context_counts)),
    dictionary.context_counts,
  );
  const dashboard = await fetchData("/api/v1/dashboard/knowledge-summary");
  assert.equal(dashboard.data_state, "ready");
  assert.equal(dashboard.environment.information_environments, 10);
  assert.equal(dashboard.environment.information_objects, 51);
  for (const forbiddenCount of [
    "environment_segment_types",
    "environment_segments",
    "environment_object_contexts",
  ]) {
    assert.equal(
      Object.hasOwn(dashboard.environment, forbiddenCount),
      false,
      `Dashboard must not mix master/context count: ${forbiddenCount}`,
    );
  }
  for (const path of ["/api/v1/user/notes", "/api/v1/user/favorites"]) {
    const response = await fetch(`${baseUrl}${path}`, { cache: "no-store" });
    assert.equal(response.status, 200, `${path} must remain readable`);
  }
  runtime = {
    base_url: baseUrl,
    environment_dictionary_status: 200,
    dashboard_status: 200,
    user_notes_status: 200,
    user_favorites_status: 200,
    dashboard_environment: dashboard.environment,
  };
}
assert.equal(
  sha256(resolve(root, protectedFiles.user_database)),
  userHashBeforeRuntime,
  "P7 runtime reads must not mutate the user database",
);

let reportDir = "";
if (writeReport) {
  assert.ok(baseUrl, "--write-report requires --url runtime evidence");
  const now = new Date();
  const runId = `p7-${now.toISOString().replaceAll("-", "").replaceAll(":", "").slice(0, 15)}Z`;
  reportDir = resolve(outputRoot, runId);
  mkdirSync(reportDir, { recursive: false });
  const report = {
    schema_version: "environment-master-data-p7-controlled-switch-v1",
    plan_id: "PLAN-ENV-MD",
    phase: "P7",
    run_id: runId,
    generated_at: now.toISOString().replace(/\.\d{3}Z$/, "Z"),
    source_p5_run_id: p5.run_id,
    source_p6_run_id: p6.run_id,
    feature_switch: {
      name: "environmentMasterDictionary",
      enabled: true,
      rollback_state_available: true,
      rollback_feature_value: false,
      rollback_source:
        "p6-20260726T015418Z/recovery/frontend/index.before-p6.html",
    },
    dictionary: {
      master_counts: dictionary.master_counts,
      context_counts: dictionary.context_counts,
      usage_relations: dictionary.usage_relations.length,
      master_records: master.rows.length,
    },
    compatibility: {
      legacy_fallback_retained: true,
      legacy_context_rows: fallback.rows.length,
      missing_api_and_schema_fallback_validated_by_p5: true,
    },
    protected_inputs: {
      base_database_sha256: p6.database.sha256_after,
      user_database_sha256: userHashBeforeRuntime,
      source_workbook_unchanged: true,
      environment_packages_unchanged: true,
      environment_projection_files_checked:
        p6.preflight.input_hashes.environment_data_tree.files.length,
    },
    database: sqliteEvidence,
    runtime,
    known_baseline_failures: knownBaselineSearchFailure
      ? [
          {
            test: "frontend_content_smoke_check",
            scope: "pre-existing global search merged-result pruning assertion",
            observed_before_p7: true,
            p7_specific_search_tests_required: true,
          },
        ]
      : [],
    release: {
      system_chrome_started: false,
      dmg_built: false,
      app_runtime_validated: false,
    },
    gate: {
      result: "ready_for_p8_web_release_regression",
      rollback_triggered: false,
      p8_dmg_authorized: false,
    },
  };
  const reportJsonPath = resolve(reportDir, "p7-controlled-switch.json");
  const reportMarkdownPath = resolve(reportDir, "p7-controlled-switch.md");
  writeFileSync(
    reportJsonPath,
    `${JSON.stringify(report, null, 2)}\n`,
    "utf8",
  );
  writeFileSync(
    reportMarkdownPath,
    [
      "# PLAN-ENV-MD P7 受控切换",
      "",
      `- run_id: \`${runId}\``,
      "- feature switch: `true`",
      "- master data: `10 / 16 / 51`",
      "- relation contexts: `29 / 67`",
      "- usage relations: `106`",
      "- legacy fallback: retained",
      "- protected base/user/source/packages: unchanged",
      "- runtime dictionary/dashboard/user read endpoints: pass",
      "- system Chrome: not started",
      "- DMG/App: not validated",
      "- gate: `ready_for_p8_web_release_regression`",
      "",
    ].join("\n"),
    "utf8",
  );
  const manifest = {
    schema_version: "environment-master-data-p7-manifest-v1",
    run_id: runId,
    files: [
      {
        path: "p7-controlled-switch.json",
        sha256: sha256(reportJsonPath),
      },
      {
        path: "p7-controlled-switch.md",
        sha256: sha256(reportMarkdownPath),
      },
    ],
  };
  writeFileSync(
    resolve(reportDir, "manifest.json"),
    `${JSON.stringify(manifest, null, 2)}\n`,
    "utf8",
  );
}

console.log(
  JSON.stringify(
    {
      result: "pass",
      featureEnabled: true,
      masterRecords: master.rows.length,
      usageRelations: dictionary.usage_relations.length,
      fallbackRows: fallback.rows.length,
      runtimeChecked: Boolean(runtime),
      reportDir,
    },
    null,
    2,
  ),
);
