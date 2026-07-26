#!/usr/bin/env node

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const args = process.argv.slice(2);
const reportFlag = args.indexOf("--report-dir");
const outputRoot = resolve(root, "data/exports/worker-verify/plan-env-md");
const reportDir = reportFlag >= 0
  ? resolve(root, args[reportFlag + 1])
  : readdirSync(outputRoot)
      .filter((name) => /^p3-\d{8}T\d{6}Z$/.test(name))
      .map((name) => resolve(outputRoot, name))
      .filter(
        (path) =>
          statSync(path).isDirectory()
          && existsSync(resolve(path, "p3-migration-rehearsal.json")),
      )
      .sort()
      .at(-1);
assert.ok(reportDir, "P3 report directory is required");

const readText = (path) => readFileSync(resolve(path), "utf8");
const readJson = (path) => JSON.parse(readText(path));
const sha256 = (path) =>
  createHash("sha256").update(readFileSync(resolve(path))).digest("hex");
const csvDataRowCount = (path) =>
  Math.max(
    0,
    readText(path).replace(/^\uFEFF/, "").trimEnd().split(/\r?\n/).length - 1,
  );

const requiredOutputs = [
  "logical-snapshot-hashes.json",
  "manifest.json",
  "migration-before-after-ledger.csv",
  "p3-migration-rehearsal.json",
  "p3-migration-rehearsal.md",
  "rollback-manifest.json",
];
for (const name of requiredOutputs) {
  assert.ok(existsSync(resolve(reportDir, name)), `missing P3 output: ${name}`);
}
assert.equal(
  existsSync(resolve(reportDir, "environment-dictionary.candidate.json")),
  false,
  "temporary candidate package must not be retained",
);

const report = readJson(resolve(reportDir, "p3-migration-rehearsal.json"));
const snapshots = readJson(resolve(reportDir, "logical-snapshot-hashes.json"));
const rollbackManifest = readJson(resolve(reportDir, "rollback-manifest.json"));
const manifest = readJson(resolve(reportDir, "manifest.json"));

assert.equal(report.schema_version, "environment-master-data-p3-rehearsal-v1");
assert.equal(report.plan_id, "PLAN-ENV-MD");
assert.equal(report.phase, "P3");
assert.match(report.run_id, /^p3-\d{8}T\d{6}Z$/);
assert.match(report.source_p2_run_id, /^p2-\d{8}T\d{6}Z$/);
assert.equal(report.formal_apply_authorized, false);
assert.equal(report.temporary_database.created_with_sqlite_backup, true);
assert.equal(report.temporary_database.retained, false);
assert.equal(
  report.temporary_database.physical_file_hash_used_as_rollback_gate,
  false,
);
assert.deepEqual(report.gate, {
  result: "ready_for_p4_shadow_export",
  blockers: [],
  formal_apply_authorized: false,
});

assert.equal(report.baseline.integrity_check, "ok");
assert.deepEqual(report.baseline.foreign_key_check, []);
assert.deepEqual(report.baseline.domain_counts, {
  information_environments: 10,
  environment_segment_types: 0,
  environment_segments: 29,
  information_objects: 51,
  instance_of_relations: 0,
  environment_object_contexts: 67,
});

const firstApply = {
  codes_backfilled: 61,
  segment_types_created: 16,
  instance_of_created: 29,
  source_references_created: 58,
  change_logs_created: 106,
};
const repeatApply = Object.fromEntries(
  Object.keys(firstApply).map((key) => [key, 0]),
);
assert.deepEqual(report.apply.first, firstApply);
assert.deepEqual(report.apply.repeat, repeatApply);
for (const validation of [
  report.apply.validation,
  report.apply.repeat_validation,
]) {
  assert.equal(validation.result, "pass");
  assert.deepEqual(validation.blockers, []);
  assert.deepEqual(validation.master_counts, {
    information_environment: 10,
    environment_segment_type: 16,
    information_object: 51,
  });
  assert.equal(validation.master_code_count, 77);
  assert.equal(validation.instance_of_count, 29);
  assert.deepEqual(validation.source_cardinality_issues, []);
  assert.deepEqual(validation.orphan_relations, []);
  assert.deepEqual(validation.evidence, {
    segment_type_item_refs: 29,
    instance_of_relation_refs: 29,
  });
}
assert.equal(report.apply.protected_hashes_unchanged, true);
assert.equal(report.apply.repeat_logical_snapshot_unchanged, true);

const packageRehearsal = report.package_rehearsal;
assert.match(packageRehearsal.candidate_sha256, /^[0-9a-f]{64}$/);
assert.equal(packageRehearsal.candidate_retained, false);
assert.equal(packageRehearsal.validation.result, "pass");
assert.deepEqual(packageRehearsal.validation.blockers, []);
assert.deepEqual(packageRehearsal.validation.master_counts, {
  information_environments: 10,
  environment_segment_types: 16,
  information_objects: 51,
});
assert.deepEqual(packageRehearsal.validation.context_counts, {
  environment_segments: 29,
  environment_object_contexts: 67,
});
assert.equal(packageRehearsal.validation.usage_relation_count, 106);
assert.ok(packageRehearsal.validation.evidence_ref_count >= 106);
assert.deepEqual(packageRehearsal.switch_sequence, [
  { environment_master_dictionary_enabled: false },
  { environment_master_dictionary_enabled: true },
  { environment_master_dictionary_enabled: false },
]);
assert.deepEqual(packageRehearsal.rollback, {
  candidate_removed: true,
  fallback_hash_unchanged: true,
});
assert.equal(packageRehearsal.formal_package_modified, false);

const rollbackActions = {
  source_references_deleted: 58,
  change_logs_deleted: 106,
  instance_of_deleted: 29,
  segment_types_deleted: 16,
  codes_restored: 61,
};
assert.deepEqual(report.rollback.actions, rollbackActions);
assert.equal(report.rollback.logical_snapshot_restored, true);
assert.equal(report.rollback.protected_hashes_restored, true);
assert.deepEqual(report.rollback.snapshot, report.baseline);
assert.deepEqual(report.failure_injection, {
  failpoint: "after_code_backfill_before_commit",
  error: "P3_FAILPOINT_AFTER_CODE_BACKFILL",
  logical_snapshot_restored: true,
});

assert.equal(
  snapshots.schema_version,
  "environment-master-data-p3-logical-snapshots-v1",
);
assert.equal(snapshots.run_id, report.run_id);
assert.equal(snapshots.physical_file_hash_is_not_a_rollback_gate, true);
assert.deepEqual(snapshots.baseline, report.baseline);
assert.deepEqual(snapshots.rolled_back, snapshots.baseline);
assert.deepEqual(snapshots.after_failure_injection, snapshots.baseline);
assert.deepEqual(snapshots.applied.domain_counts, {
  information_environments: 10,
  environment_segment_types: 16,
  environment_segments: 29,
  information_objects: 51,
  instance_of_relations: 29,
  environment_object_contexts: 67,
});
assert.equal(
  snapshots.applied.counts.knowledge_items
    - snapshots.baseline.counts.knowledge_items,
  16,
);
assert.equal(
  snapshots.applied.counts.knowledge_relations
    - snapshots.baseline.counts.knowledge_relations,
  29,
);
assert.equal(
  snapshots.applied.counts.source_references
    - snapshots.baseline.counts.source_references,
  58,
);
assert.equal(
  snapshots.applied.counts.change_logs
    - snapshots.baseline.counts.change_logs,
  106,
);
assert.equal(
  snapshots.applied.hashes.schema,
  snapshots.baseline.hashes.schema,
  "P3 must not change database schema",
);

assert.equal(
  rollbackManifest.schema_version,
  "environment-master-data-p3-rollback-manifest-v1",
);
assert.equal(rollbackManifest.run_id, report.run_id);
assert.equal(rollbackManifest.formal_apply_authorized, false);
assert.equal(rollbackManifest.restore_codes.length, 61);
assert.equal(rollbackManifest.delete_relation_ids.length, 29);
assert.equal(rollbackManifest.delete_item_ids.length, 16);
assert.equal(
  new Set(rollbackManifest.restore_codes.map((row) => row.item_id)).size,
  61,
);
assert.equal(new Set(rollbackManifest.delete_relation_ids).size, 29);
assert.equal(new Set(rollbackManifest.delete_item_ids).size, 16);
assert.ok(
  rollbackManifest.restore_codes.every((row) => row.before_code === null),
);
assert.deepEqual(rollbackManifest.expected_actions, rollbackActions);
assert.equal(
  csvDataRowCount(resolve(reportDir, "migration-before-after-ledger.csv")),
  106,
);

assert.equal(report.protected_inputs.unchanged, true);
assert.deepEqual(
  report.protected_inputs.hashes_after,
  report.protected_inputs.hashes_before,
);
const protectedPaths = {
  base_database: "data/database/sapd_wiki.sqlite3",
  user_database: "data/user/sapd_wiki_user.sqlite3",
  source_workbook: "data/raw-samples/wiki sample.xlsx",
  environment_workbench:
    "frontend/capability-browser/public/data/environment-workbench.json",
  environment_basemap_semantic:
    "frontend/capability-browser/generated/environmentBasemap.semantic.json",
};
for (const [label, path] of Object.entries(protectedPaths)) {
  assert.equal(
    report.protected_inputs.hashes_after[label],
    sha256(resolve(root, path)),
    `${label}: current protected input hash drift`,
  );
}

const p2ManifestPath = resolve(
  outputRoot,
  report.source_p2_run_id,
  "manifest.json",
);
assert.ok(existsSync(p2ManifestPath), "source P2 manifest is missing");
assert.equal(report.p2_manifest_sha256, sha256(p2ManifestPath));

assert.equal(manifest.schema_version, "worker-verify-manifest-v1");
assert.equal(manifest.run_id, report.run_id);
assert.equal(manifest.formal_apply_authorized, false);
const manifestRows = new Map(manifest.files.map((row) => [row.path, row]));
for (const name of requiredOutputs.filter((name) => name !== "manifest.json")) {
  const row = manifestRows.get(name);
  assert.ok(row, `manifest missing ${name}`);
  assert.equal(row.sha256, sha256(resolve(reportDir, name)), `manifest hash ${name}`);
  assert.equal(row.size, statSync(resolve(reportDir, name)).size, `manifest size ${name}`);
}

const source = readText(
  resolve(root, "scripts/rehearse_environment_master_data_p3_migration.py"),
);
for (const requiredText of [
  'connection.execute("BEGIN IMMEDIATE")',
  'formal_apply_authorized": False',
  "TemporaryDirectory",
  "P3_FAILPOINT_AFTER_CODE_BACKFILL",
  '"candidate_retained": False',
  '"formal_package_modified": False',
]) {
  assert.ok(source.includes(requiredText), `P3 source missing: ${requiredText}`);
}

console.log(
  JSON.stringify(
    {
      result: "pass",
      runId: report.run_id,
      reportDir,
      gate: report.gate.result,
      firstApply,
      repeatApply,
      rollback: rollbackActions,
      candidatePackageRetained: false,
      protectedInputsUnchanged: true,
      formalApplyAuthorized: false,
    },
    null,
    2,
  ),
);
