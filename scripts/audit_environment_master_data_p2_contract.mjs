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
      .filter((name) => /^p2-\d{8}T\d{6}Z$/.test(name))
      .map((name) => resolve(outputRoot, name))
      .filter((path) => statSync(path).isDirectory() && existsSync(resolve(path, "p2-plan.json")))
      .sort()
      .at(-1);
assert.ok(reportDir, "P2 report directory is required");

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
  "instance-of-plan.csv",
  "instance-of-plan.json",
  "manifest.json",
  "master-code-allocation.csv",
  "master-data-decision-manifest.p2.json",
  "p2-plan.json",
  "p2-plan.md",
  "p2-reimport-verification.json",
  "p2-reimport-verification.md",
];
for (const name of requiredOutputs) {
  assert.ok(existsSync(resolve(reportDir, name)), `missing P2 output: ${name}`);
}

const adjudicationPath = resolve(
  root,
  "docs/01-architecture/contracts/environment-master-data/v1/environment-segment-type-adjudication.p2.json",
);
const decisionSchema = readJson(
  resolve(
    root,
    "docs/01-architecture/contracts/environment-master-data/v1/master-data-decision-manifest.schema.json",
  ),
);
const adjudication = readJson(adjudicationPath);
const plan = readJson(resolve(reportDir, "p2-plan.json"));
const decisions = readJson(resolve(reportDir, "master-data-decision-manifest.p2.json"));
const instancePlan = readJson(resolve(reportDir, "instance-of-plan.json"));
const reimport = readJson(resolve(reportDir, "p2-reimport-verification.json"));
const manifest = readJson(resolve(reportDir, "manifest.json"));

assert.equal(adjudication.schema_version, "environment-segment-type-adjudication-p2-v1");
assert.equal(adjudication.phase, "P2");
assert.equal(adjudication.status, "frozen");
assert.equal(adjudication.formal_apply_authorized, false);
assert.equal(adjudication.entries.length, 16);
assert.equal(adjudication.decision_policy.runtime_title_inference, false);

const adjudicationCodes = adjudication.entries.map((entry) => entry.code);
assert.deepEqual(
  adjudicationCodes,
  Array.from({ length: 16 }, (_, index) => `ES-${String(index + 1).padStart(3, "0")}`),
);
for (const field of ["planned_id", "stable_key", "stable_ref", "public_id", "canonical_title"]) {
  const values = adjudication.entries.map((entry) => entry[field]);
  assert.equal(values.length, new Set(values).size, `duplicate adjudication ${field}`);
}
const adjudicatedContextRefs = adjudication.entries.flatMap(
  (entry) => entry.context_segment_refs,
);
assert.equal(adjudicatedContextRefs.length, 29);
assert.equal(new Set(adjudicatedContextRefs).size, 29);
for (const entry of adjudication.entries) {
  assert.equal(entry.decision, "create");
  assert.ok(entry.definition);
  assert.ok(entry.decision_note);
  assert.ok(Array.isArray(entry.aliases));
  assert.ok(entry.context_segment_refs.length >= 1);
}
assert.deepEqual(
  adjudication.entries.find((entry) => entry.code === "ES-008").aliases,
  ["大数据平台", "数据中台"],
);

assert.equal(plan.schema_version, "environment-master-data-p2-plan-v1");
assert.equal(plan.phase, "P2");
assert.equal(plan.gate.result, "ready_for_p3_temp_apply");
assert.deepEqual(plan.gate.blockers, []);
assert.equal(plan.gate.formal_apply_authorized, false);
assert.deepEqual(plan.gate.master_counts, {
  information_environment: 10,
  environment_segment_type: 16,
  information_object: 51,
});
assert.equal(plan.gate.master_code_count, 77);
assert.equal(plan.gate.existing_master_code_backfill_count, 61);
assert.equal(plan.gate.new_segment_type_count, 16);
assert.equal(plan.gate.unnumbered_context_instance_count_by_design, 29);
assert.equal(plan.gate.instance_of_plan_count, 29);
assert.equal(plan.input_integrity.protected_inputs_unchanged, true);

assert.equal(decisions.schema_version, "environment-master-data-decision-manifest-v1");
assert.equal(decisions.run_id, plan.run_id);
assert.equal(decisions.entries.length, 77);
const entrySchema = decisionSchema.$defs.decisionEntry;
const requiredEntryFields = new Set(entrySchema.required);
const allowedEntryFields = new Set(Object.keys(entrySchema.properties));
const counts = Object.create(null);
const codes = [];
for (const entry of decisions.entries) {
  counts[entry.master_type] = (counts[entry.master_type] || 0) + 1;
  codes.push(entry.code);
  assert.deepEqual(
    [...requiredEntryFields].filter((field) => !(field in entry)),
    [],
    `missing decision fields for ${entry.code}`,
  );
  assert.deepEqual(
    Object.keys(entry).filter((field) => !allowedEntryFields.has(field)),
    [],
    `unexpected decision fields for ${entry.code}`,
  );
  assert.match(entry.code, /^(IE|ES|IO)-\d{3}$/);
  assert.ok(entry.stable_ref);
  assert.ok(entry.public_id);
  assert.ok(entry.canonical_title);
  assert.ok(Array.isArray(entry.aliases));
  assert.ok(Array.isArray(entry.context_evidence_refs));
  assert.ok(entry.context_evidence_refs.length >= 1);
  assert.ok(!["merge_review", "split_review", "hold"].includes(entry.decision));
}
assert.deepEqual({ ...counts }, {
  information_environment: 10,
  environment_segment_type: 16,
  information_object: 51,
});
assert.equal(codes.length, new Set(codes).size);
assert.equal(csvDataRowCount(resolve(reportDir, "master-code-allocation.csv")), 77);

assert.equal(instancePlan.schema_version, "environment-master-data-instance-of-plan-v1");
assert.equal(instancePlan.formal_apply_authorized, false);
assert.equal(instancePlan.relations.length, 29);
assert.equal(
  new Set(instancePlan.relations.map((row) => row.source_stable_ref)).size,
  29,
);
assert.equal(
  new Set(instancePlan.relations.map((row) => row.stable_ref)).size,
  29,
);
const targetRefs = new Set(adjudication.entries.map((entry) => entry.stable_ref));
for (const relation of instancePlan.relations) {
  assert.equal(relation.relation_type, "instance_of");
  assert.equal(relation.formal_apply_authorized, false);
  assert.ok(targetRefs.has(relation.target_stable_ref));
}
assert.equal(csvDataRowCount(resolve(reportDir, "instance-of-plan.csv")), 29);

assert.equal(reimport.schema_version, "environment-master-data-p2-reimport-verification-v1");
assert.equal(reimport.phase, "P2");
assert.equal(reimport.gate.result, "pass");
assert.deepEqual(reimport.gate.blockers, []);
assert.equal(reimport.gate.formal_apply_authorized, false);
assert.equal(reimport.temporary_database.retained, false);
assert.equal(reimport.temporary_database.integrity_check, "ok");
assert.equal(reimport.protected_inputs.unchanged, true);
assert.deepEqual(
  {
    information_environments: reimport.baseline.information_environments,
    environment_segments: reimport.baseline.environment_segments,
    information_objects: reimport.baseline.information_objects,
    context_relations: reimport.baseline.context_relations,
  },
  {
    information_environments: 10,
    environment_segments: 29,
    information_objects: 51,
    context_relations: 96,
  },
);
assert.equal(reimport.imports.length, 2);
for (const run of reimport.imports) {
  assert.deepEqual(run.segment_context_match_mismatches, []);
}
for (const field of [
  "items_created",
  "items_deprecated",
  "relations_created",
  "relations_deleted",
]) {
  assert.equal(reimport.imports[1].approve[field], 0, `second import ${field}`);
}
assert.equal(reimport.duplicate_relation_triples.length, 0);
assert.ok(reimport.nonblocking_audit_growth.source_references > 0);
assert.ok(reimport.nonblocking_audit_growth.change_logs > 0);

const manifestRows = new Map(manifest.files.map((row) => [row.path, row]));
for (const name of requiredOutputs.filter((name) => name !== "manifest.json")) {
  const row = manifestRows.get(name);
  assert.ok(row, `manifest missing ${name}`);
  assert.equal(row.sha256, sha256(resolve(reportDir, name)), `manifest hash ${name}`);
  assert.equal(row.size, statSync(resolve(reportDir, name)).size, `manifest size ${name}`);
}

const currentProtectedPaths = {
  base_database: "data/database/sapd_wiki.sqlite3",
  user_database: "data/user/sapd_wiki_user.sqlite3",
  source_workbook: "data/raw-samples/wiki sample.xlsx",
  environment_workbench:
    "frontend/capability-browser/public/data/environment-workbench.json",
  environment_basemap_semantic:
    "frontend/capability-browser/generated/environmentBasemap.semantic.json",
  p0_contract:
    "docs/01-architecture/contracts/environment-master-data/v1/environment-master-data.contract.json",
  p2_adjudication:
    "docs/01-architecture/contracts/environment-master-data/v1/environment-segment-type-adjudication.p2.json",
};
for (const [label, path] of Object.entries(currentProtectedPaths)) {
  assert.equal(
    plan.input_integrity.hashes_after[label],
    sha256(resolve(root, path)),
    `${label}: current hash drift`,
  );
}

const candidatesSource = readText(resolve(root, "src/sapd_wiki/candidates.py"));
const stagingSource = readText(resolve(root, "src/sapd_wiki/staging.py"));
const loaderSource = readText(resolve(root, "src/sapd_wiki/loader.py"));
const parserSource = readText(resolve(root, "src/sapd_wiki/parsers.py"));
const testSource = readText(resolve(root, "tests/test_environment_master_data_p2.py"));
assert.ok(candidatesSource.includes('"environment_segment_type"'));
assert.ok(stagingSource.includes('obj.type == "environment_segment"'));
assert.ok(stagingSource.includes("metadata.get(\"object_key\") == obj.key"));
assert.ok(loaderSource.includes('relation_type == "instance_of"'));
assert.ok(loaderSource.includes("instance_of 目标变更必须停止并人工裁定"));
assert.ok(parserSource.includes("environment_raw != last_environment"));
assert.ok(testSource.includes("EnvironmentSegmentMatchingTests"));
assert.ok(testSource.includes("SceneParserParentResetTests"));
assert.ok(testSource.includes("InstanceOfCardinalityTests"));

console.log(
  JSON.stringify(
    {
      result: "pass",
      runId: plan.run_id,
      reportDir,
      masterCounts: plan.gate.master_counts,
      masterCodes: plan.gate.master_code_count,
      instanceOfPlan: plan.gate.instance_of_plan_count,
      secondImport: {
        itemsCreated: reimport.imports[1].approve.items_created,
        relationsCreated: reimport.imports[1].approve.relations_created,
        relationsDeleted: reimport.imports[1].approve.relations_deleted,
      },
      auditGrowth: reimport.nonblocking_audit_growth,
      formalApplyAuthorized: false,
    },
    null,
    2,
  ),
);
