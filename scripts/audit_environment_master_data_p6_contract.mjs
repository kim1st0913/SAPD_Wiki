#!/usr/bin/env node

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  existsSync,
  readFileSync,
  readdirSync,
  statSync,
} from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const outputRoot = resolve(root, "data/exports/worker-verify/plan-env-md");
const args = process.argv.slice(2);
const reportFlag = args.indexOf("--report-dir");
const reportDir = reportFlag >= 0
  ? resolve(root, args[reportFlag + 1])
  : readdirSync(outputRoot)
      .filter((name) => /^p6-\d{8}T\d{6}Z$/.test(name))
      .map((name) => resolve(outputRoot, name))
      .filter(
        (path) =>
          statSync(path).isDirectory()
          && existsSync(resolve(path, "p6-formal-apply.json")),
      )
      .sort()
      .at(-1);
assert.ok(reportDir, "P6 report directory is required");

const readJson = (path) => JSON.parse(readFileSync(path, "utf8"));
const sha256 = (path) =>
  createHash("sha256").update(readFileSync(path)).digest("hex");

for (const name of [
  "formal-environment-dictionary.json",
  "manifest.json",
  "migration-before-after-ledger.csv",
  "p6-formal-apply.json",
  "p6-formal-apply.md",
  "recovery-manifest.json",
]) {
  assert.ok(existsSync(resolve(reportDir, name)), `missing P6 output: ${name}`);
}

const report = readJson(resolve(reportDir, "p6-formal-apply.json"));
const manifest = readJson(resolve(reportDir, "manifest.json"));
const recoveryManifest = readJson(resolve(reportDir, "recovery-manifest.json"));
assert.equal(report.schema_version, "environment-master-data-p6-formal-apply-v1");
assert.equal(report.plan_id, "PLAN-ENV-MD");
assert.equal(report.phase, "P6");
assert.equal(report.formal_apply_authorized, true);
assert.deepEqual(report.gate, {
  result: "ready_for_p7_controlled_switch",
  blockers: [],
  p7_authorized: false,
});
assert.equal(report.feature_switch.enabled, false);
assert.deepEqual(report.apply.first, {
  codes_backfilled: 61,
  segment_types_created: 16,
  instance_of_created: 29,
  source_references_created: 58,
  change_logs_created: 106,
});
assert.equal(
  Object.values(report.apply.repeat).reduce((sum, value) => sum + value, 0),
  0,
);
assert.equal(report.apply.validation.result, "pass");
assert.deepEqual(report.apply.validation.master_counts, {
  information_environment: 10,
  environment_segment_type: 16,
  information_object: 51,
});
assert.equal(report.apply.validation.master_code_count, 77);
assert.equal(report.apply.validation.instance_of_count, 29);
assert.equal(report.database.protected_existing_rows_unchanged, true);
assert.equal(report.database.old_relation_ids_unchanged, true);
assert.equal(report.user_state.database_sha256_unchanged, true);
assert.equal(report.user_state.logical_snapshot_unchanged, true);
assert.equal(report.user_state.reference_resolution_unchanged, true);
assert.equal(report.user_state.unresolved_domain_references, 0);
assert.equal(report.recovery.independent_restore_test, "pass");
assert.equal(report.recovery.rollback_triggered, false);
assert.equal(report.dictionary_package.regenerated_from_formal_database, true);
assert.equal(report.dictionary_package.matches_p4_shadow_bytes, true);
assert.equal(report.dictionary_package.existing_package_replaced, false);

for (const entry of manifest.files) {
  const path = resolve(reportDir, entry.path);
  assert.ok(existsSync(path), `manifest file missing: ${entry.path}`);
  assert.equal(sha256(path), entry.sha256, `manifest hash mismatch: ${entry.path}`);
}
for (const entry of recoveryManifest.files) {
  const path = resolve(reportDir, "recovery", entry.path);
  assert.ok(existsSync(path), `recovery file missing: ${entry.path}`);
  assert.equal(
    sha256(path),
    entry.sha256,
    `recovery hash mismatch: ${entry.path}`,
  );
}

const publicPackagePath = resolve(
  root,
  "frontend/capability-browser/public/data/environment-dictionary.json",
);
assert.equal(
  sha256(publicPackagePath),
  sha256(resolve(reportDir, "formal-environment-dictionary.json")),
);
assert.equal(sha256(publicPackagePath), report.dictionary_package.sha256);
assert.equal(
  sha256(resolve(root, "data/user/sapd_wiki_user.sqlite3")),
  report.preflight.input_hashes.user_database.sha256,
);
assert.equal(
  sha256(resolve(root, "data/raw-samples/wiki sample.xlsx")),
  report.preflight.input_hashes.source_workbook.sha256,
);
assert.equal(
  sha256(resolve(root, "frontend/capability-browser/public/data/environment-workbench.json")),
  report.preflight.input_hashes.environment_workbench.sha256,
);

const indexHtml = readFileSync(
  resolve(root, "frontend/capability-browser/index.html"),
  "utf8",
);
const featureMatch = indexHtml.match(
  /environmentMasterDictionary:\s*(true|false)/,
);
assert.ok(featureMatch, "environment master dictionary feature switch missing");
const currentFeatureEnabled = featureMatch[1] === "true";
if (currentFeatureEnabled) {
  const p7EvidenceDir = readdirSync(outputRoot)
    .filter((name) => /^p7-\d{8}T\d{6}Z$/.test(name))
    .map((name) => resolve(outputRoot, name))
    .filter(
      (path) =>
        statSync(path).isDirectory()
        && existsSync(resolve(path, "p7-controlled-switch.json")),
    )
    .sort()
    .at(-1);
  assert.ok(
    p7EvidenceDir,
    "P6 historical audit only accepts an enabled switch after valid P7 evidence",
  );
  const p7Evidence = readJson(
    resolve(p7EvidenceDir, "p7-controlled-switch.json"),
  );
  assert.equal(p7Evidence.phase, "P7");
  assert.equal(p7Evidence.source_p6_run_id, report.run_id);
  assert.equal(p7Evidence.feature_switch.enabled, true);
}

const sqliteEvidence = JSON.parse(
  execFileSync(
    "python3",
    [
      "-c",
      "import json,sqlite3,sys; p=sys.argv[1]; c=sqlite3.connect(f'file:{p}?mode=ro',uri=True); r={'integrity':c.execute('pragma integrity_check').fetchone()[0],'foreign_keys':len(c.execute('pragma foreign_key_check').fetchall()),'master':dict(c.execute(\"select type,count(*) from knowledge_items where type in ('information_environment','environment_segment_type','information_object') group by type\").fetchall()),'instance_of':c.execute(\"select count(*) from knowledge_relations where relation_type='instance_of'\").fetchone()[0]}; print(json.dumps(r,sort_keys=True))",
      resolve(root, "data/database/sapd_wiki.sqlite3"),
    ],
    { encoding: "utf8" },
  ),
);
assert.equal(sqliteEvidence.integrity, "ok");
assert.equal(sqliteEvidence.foreign_keys, 0);
assert.deepEqual(sqliteEvidence.master, {
  environment_segment_type: 16,
  information_environment: 10,
  information_object: 51,
});
assert.equal(sqliteEvidence.instance_of, 29);

console.log(
  JSON.stringify(
    {
      result: "pass",
      runId: report.run_id,
      gate: report.gate.result,
      masterCounts: sqliteEvidence.master,
      instanceOf: sqliteEvidence.instance_of,
      recoveryFiles: recoveryManifest.files.length,
      featureDefault: false,
      featureCurrent: currentFeatureEnabled,
    },
    null,
    2,
  ),
);
