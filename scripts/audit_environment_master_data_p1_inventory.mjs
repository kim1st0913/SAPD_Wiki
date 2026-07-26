#!/usr/bin/env node

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const args = process.argv.slice(2);
const reportDirFlag = args.indexOf("--report-dir");
assert.ok(reportDirFlag >= 0 && args[reportDirFlag + 1], "required: --report-dir <path>");
const reportDir = resolve(root, args[reportDirFlag + 1]);

const readJson = (path) => JSON.parse(readFileSync(resolve(path), "utf8"));
const sha256 = (path) =>
  createHash("sha256").update(readFileSync(resolve(path))).digest("hex");
const csvDataRowCount = (path) => {
  const lines = readFileSync(resolve(path), "utf8").replace(/^\uFEFF/, "").trimEnd().split(/\r?\n/);
  return Math.max(0, lines.length - 1);
};

const requiredOutputs = [
  "environment-segment-title-groups.csv",
  "master-data-decision-manifest.p1.json",
  "master-object-ledger.csv",
  "p1-inventory.json",
  "p1-inventory.md",
  "relationship-ledger.csv",
  "user-reference-audit.json",
  "manifest.json",
];
for (const name of requiredOutputs) {
  assert.ok(existsSync(resolve(reportDir, name)), `missing P1 output: ${name}`);
}

const report = readJson(resolve(reportDir, "p1-inventory.json"));
const outputManifest = readJson(resolve(reportDir, "manifest.json"));
const decisionManifest = readJson(resolve(reportDir, "master-data-decision-manifest.p1.json"));
const userReferences = readJson(resolve(reportDir, "user-reference-audit.json"));

assert.equal(report.schema_version, "environment-master-data-p1-inventory-v1");
assert.equal(report.p0_contract_id, "SAPD-ENVIRONMENT-MASTER-DATA-v1");
assert.equal(report.gate.result, "ready_for_p2_adjudication");
assert.deepEqual(report.gate.blockers, []);
assert.equal(report.gate.formal_apply_authorized, false);

assert.deepEqual(report.counts.database, {
  information_environments: 10,
  environment_segments: 29,
  segment_title_groups: 16,
  information_objects: 51,
  environment_object_contexts: 67,
  segment_environment_relations: 29,
  object_context_relations: 67,
  environment_segment_types: 0,
  instance_of_relations: 0,
});
assert.deepEqual(report.counts.package, {
  information_environments: 10,
  environment_segments: 29,
  information_objects: 51,
  environment_object_contexts: 67,
});

assert.equal(report.identity.missing_identity_total, 0);
assert.equal(report.identity.missing_code_count, 90);
assert.deepEqual(report.identity.duplicate_identity_values, {
  stable_key: [],
  stable_ref: [],
  public_id: [],
});
assert.deepEqual(report.identity.zero_source_evidence_items, []);
assert.deepEqual(report.relationships.orphan_segments, []);
assert.deepEqual(report.relationships.orphan_objects, []);
assert.deepEqual(report.relationships.multi_environment_segments, {});
assert.deepEqual(report.relationships.invalid_relation_endpoints, []);
assert.equal(report.relationships.zero_source_evidence_relation_count, 0);
assert.equal(report.relationships.qualifier_mismatch_count, 0);

for (const [type, differences] of Object.entries(report.package_parity.id_differences)) {
  assert.deepEqual(differences.missing_from_package, [], `${type}: IDs missing from package`);
  assert.deepEqual(differences.extra_in_package, [], `${type}: unexpected package IDs`);
}
assert.deepEqual(report.package_parity.title_mismatches, []);
assert.deepEqual(report.package_parity.contexts_missing_from_package, []);
assert.deepEqual(report.package_parity.contexts_extra_in_package, []);
assert.equal(report.package_parity.package_duplicate_context_count, 0);
assert.deepEqual(report.package_parity.missing_object_evidence_refs, []);

assert.equal(report.segment_title_groups.length, 16);
for (const group of report.segment_title_groups) {
  assert.equal(group.decision, "hold");
  assert.ok(group.context_instance_count >= 1);
  assert.ok(group.context_evidence_refs.length >= 1);
  assert.equal(group.qualifier_mismatch_count, 0);
}

assert.deepEqual(userReferences.unresolved_domain_references, []);
assert.ok(userReferences.relevant_match_occurrences >= 1);
assert.ok(userReferences.resolved_context_anchors.length >= 1);
assert.ok(userReferences.resolved_migration_history.length >= 1);
assert.deepEqual(userReferences, report.user_references);

assert.equal(outputManifest.schema_version, "environment-master-data-p1-output-manifest-v1");
assert.equal(outputManifest.result, "ready_for_p2_adjudication");
assert.equal(outputManifest.formal_apply_authorized, false);
assert.equal(outputManifest.run_id, report.run_id);
assert.deepEqual(
  [...outputManifest.output_files].sort(),
  requiredOutputs.filter((name) => name !== "manifest.json").sort(),
);

assert.equal(decisionManifest.schema_version, "environment-master-data-decision-manifest-v1");
assert.equal(decisionManifest.run_id, report.run_id);
assert.equal(decisionManifest.entries.length, 77);
const decisionCounts = Object.create(null);
for (const entry of decisionManifest.entries) {
  decisionCounts[entry.master_type] = (decisionCounts[entry.master_type] || 0) + 1;
  assert.equal(entry.decision, "hold");
  assert.equal(entry.code, null);
  assert.ok(entry.canonical_title);
  assert.ok(Array.isArray(entry.aliases));
  assert.ok(Array.isArray(entry.context_evidence_refs));
  assert.ok(entry.context_evidence_refs.length >= 1);
  if (entry.master_type === "environment_segment_type") {
    assert.equal(entry.stable_ref, null);
    assert.equal(entry.public_id, null);
  } else {
    assert.ok(entry.stable_ref);
    assert.ok(entry.public_id);
  }
}
assert.deepEqual({ ...decisionCounts }, {
  environment_segment_type: 16,
  information_environment: 10,
  information_object: 51,
});

assert.equal(csvDataRowCount(resolve(reportDir, "master-object-ledger.csv")), 90);
assert.equal(csvDataRowCount(resolve(reportDir, "relationship-ledger.csv")), 96);
assert.equal(csvDataRowCount(resolve(reportDir, "environment-segment-title-groups.csv")), 16);

const inputPaths = {
  base_database: "data/database/sapd_wiki.sqlite3",
  user_database: "data/user/sapd_wiki_user.sqlite3",
  environment_workbench: "frontend/capability-browser/public/data/environment-workbench.json",
  environment_basemap_semantic: "frontend/capability-browser/generated/environmentBasemap.semantic.json",
  p0_contract:
    "docs/01-architecture/contracts/environment-master-data/v1/environment-master-data.contract.json",
};
for (const [key, path] of Object.entries(inputPaths)) {
  assert.equal(
    report.input_integrity.hashes_before[key],
    report.input_integrity.hashes_after[key],
    `${key}: hash changed during P1`,
  );
  assert.equal(sha256(resolve(root, path)), report.input_integrity.hashes_after[key], `${key}: current hash drift`);
}

console.log(
  JSON.stringify(
    {
      result: "pass",
      runId: report.run_id,
      reportDir,
      counts: report.counts,
      candidateGroups: report.segment_title_groups.length,
      decisionEntries: decisionManifest.entries.length,
      relevantUserReferenceOccurrences: userReferences.relevant_match_occurrences,
      unresolvedUserReferences: userReferences.unresolved_domain_references.length,
      formalApplyAuthorized: false,
    },
    null,
    2,
  ),
);
