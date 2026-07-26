#!/usr/bin/env node

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  existsSync,
  readFileSync,
  readdirSync,
  statSync,
} from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const args = process.argv.slice(2);
const reportFlag = args.indexOf("--report-dir");
const outputRoot = resolve(root, "data/exports/worker-verify/plan-env-md");
const reportDir = reportFlag >= 0
  ? resolve(root, args[reportFlag + 1])
  : readdirSync(outputRoot)
      .filter((name) => /^p4-\d{8}T\d{6}Z$/.test(name))
      .map((name) => resolve(outputRoot, name))
      .filter(
        (path) =>
          statSync(path).isDirectory()
          && existsSync(resolve(path, "p4-shadow-export.json")),
      )
      .sort()
      .at(-1);
assert.ok(reportDir, "P4 report directory is required");

const readText = (path) => readFileSync(resolve(path), "utf8");
const readJson = (path) => JSON.parse(readText(path));
const sha256 = (path) =>
  createHash("sha256").update(readFileSync(resolve(path))).digest("hex");

const requiredOutputs = [
  "compatibility-hashes.json",
  "environment-dictionary.json",
  "manifest.json",
  "p4-shadow-export.json",
  "p4-shadow-export.md",
];
for (const name of requiredOutputs) {
  assert.ok(existsSync(resolve(reportDir, name)), `missing P4 output: ${name}`);
}

const report = readJson(resolve(reportDir, "p4-shadow-export.json"));
const compatibility = readJson(resolve(reportDir, "compatibility-hashes.json"));
const manifest = readJson(resolve(reportDir, "manifest.json"));
const evidencePackage = readJson(resolve(reportDir, "environment-dictionary.json"));
const p6ReportPath = readdirSync(outputRoot)
  .filter((name) => /^p6-\d{8}T\d{6}Z$/.test(name))
  .map((name) => resolve(outputRoot, name, "p6-formal-apply.json"))
  .filter((path) => existsSync(path))
  .sort()
  .at(-1);
const p6Report = p6ReportPath ? readJson(p6ReportPath) : null;
const publicPackagePath = resolve(
  root,
  "frontend/capability-browser/public/data/environment-dictionary.json",
);
const publicPackage = readJson(publicPackagePath);

assert.equal(report.schema_version, "environment-master-data-p4-shadow-export-v1");
assert.equal(report.plan_id, "PLAN-ENV-MD");
assert.equal(report.phase, "P4");
assert.match(report.run_id, /^p4-\d{8}T\d{6}Z$/);
assert.match(report.source_p2_run_id, /^p2-\d{8}T\d{6}Z$/);
assert.match(report.source_p3_run_id, /^p3-\d{8}T\d{6}Z$/);
assert.equal(report.formal_apply_authorized, false);
assert.deepEqual(report.gate, {
  result: "ready_for_p5_shadow_frontend",
  blockers: [],
  formal_apply_authorized: false,
});
assert.equal(report.temporary_database.created_with_sqlite_backup, true);
assert.equal(report.temporary_database.retained, false);
assert.equal(report.apply.validation.result, "pass");
assert.deepEqual(report.apply.validation.master_counts, {
  information_environment: 10,
  environment_segment_type: 16,
  information_object: 51,
});
assert.equal(report.apply.validation.instance_of_count, 29);
assert.equal(report.shadow_package.additive_output, true);
assert.equal(report.shadow_package.validation.result, "pass");
assert.deepEqual(report.shadow_package.validation.blockers, []);
assert.equal(report.shadow_package.validation.master_record_count, 77);
assert.deepEqual(report.shadow_package.validation.master_counts, {
  information_environments: 10,
  environment_segment_types: 16,
  information_objects: 51,
});
assert.deepEqual(report.shadow_package.validation.context_counts, {
  environment_segments: 29,
  environment_object_contexts: 67,
});
assert.equal(report.shadow_package.validation.usage_relation_count, 106);

assert.deepEqual(publicPackage, evidencePackage, "公开影子包与P4证据副本不一致");
assert.equal(sha256(publicPackagePath), report.shadow_package.sha256);
assert.equal(evidencePackage.schema_version, "environment-dictionary-v1");
assert.equal(evidencePackage.data_state, "ready");
assert.equal(
  evidencePackage.source_package_versions.phase,
  "P4-shadow-export",
);
assert.equal(
  evidencePackage.source_package_versions.p3_run_id,
  report.source_p3_run_id,
);
assert.deepEqual(evidencePackage.master_counts, {
  information_environments: 10,
  environment_segment_types: 16,
  information_objects: 51,
});
assert.deepEqual(evidencePackage.context_counts, {
  environment_segments: 29,
  environment_object_contexts: 67,
});

const collections = [
  ["information_environments", "information_environment", /^IE-\d{3}$/],
  ["environment_segment_types", "environment_segment_type", /^ES-\d{3}$/],
  ["information_objects", "information_object", /^IO-\d{3}$/],
];
const records = [];
for (const [collection, type, pattern] of collections) {
  for (const row of evidencePackage[collection]) {
    assert.equal(row.type, type, `${collection}: type mismatch`);
    assert.match(row.code, pattern, `${collection}: invalid code`);
    assert.ok(row.id && row.stable_ref && row.public_id && row.title);
    assert.ok(Array.isArray(row.aliases));
    assert.ok(["active", "deprecated", "merged"].includes(row.status));
    assert.deepEqual(Object.keys(row.usage_summary).sort(), [
      "environment_object_contexts",
      "environment_segments",
      "information_environments",
      "information_objects",
    ]);
    records.push(row);
  }
}
assert.equal(records.length, 77);
for (const field of ["id", "stable_ref", "public_id", "code"]) {
  assert.equal(
    new Set(records.map((row) => row[field])).size,
    records.length,
    `duplicate master ${field}`,
  );
}

assert.equal(evidencePackage.usage_relations.length, 106);
assert.equal(
  new Set(evidencePackage.usage_relations.map((row) => row.relation_ref)).size,
  106,
);
const recordRefs = new Set(records.map((row) => row.stable_ref));
for (const relation of evidencePackage.usage_relations) {
  assert.ok(recordRefs.has(relation.master_ref), "usage relation master missing");
  assert.equal(relation.route, "/environment-mapping");
  assert.ok(relation.context_ref && relation.context_title);
  assert.ok(
    relation.environment_ref
      ? relation.route_params.environment_id
      : true,
    "environment relation requires explicit environment_id",
  );
  assert.ok(
    relation.segment_ref ? relation.route_params.segment_id : true,
    "segment relation requires explicit segment_id",
  );
  assert.ok(
    relation.object_ref ? relation.route_params.object_id : true,
    "object relation requires explicit object_id",
  );
}

const forbidden = new Set([
  "sheet",
  "row",
  "column",
  "raw_value",
  "source_file",
  "source_file_id",
  "import_id",
  "import_job_id",
  "metadata",
]);
function assertNoLeak(value) {
  if (Array.isArray(value)) {
    value.forEach(assertNoLeak);
    return;
  }
  if (!value || typeof value !== "object") return;
  for (const key of Object.keys(value)) {
    assert.ok(!forbidden.has(key), `shadow package leaked field: ${key}`);
    assertNoLeak(value[key]);
  }
}
assertNoLeak(evidencePackage);

assert.equal(
  compatibility.schema_version,
  "environment-master-data-p4-compatibility-v1",
);
assert.equal(compatibility.run_id, report.run_id);
assert.equal(compatibility.protected_inputs_unchanged, true);
assert.deepEqual(compatibility.hashes_after, compatibility.hashes_before);
assert.deepEqual(compatibility.legacy_contract, {
  information_environments: 10,
  environment_segment_contexts: 29,
  environment_object_contexts: 67,
});
assert.equal(compatibility.formal_database_modified, false);
assert.equal(compatibility.user_database_modified, false);
assert.equal(compatibility.source_workbook_modified, false);
assert.equal(compatibility.existing_environment_packages_replaced, false);

for (const item of Object.values(compatibility.hashes_after)) {
  if (item.files) {
    for (const file of item.files) {
      assert.equal(
        sha256(resolve(root, item.path, file.path)),
        file.sha256,
        `protected environment file drift: ${file.path}`,
      );
    }
    continue;
  }
  if (
    item.path === "data/database/sapd_wiki.sqlite3"
    && p6Report
    && p6Report.gate?.result === "ready_for_p7_controlled_switch"
  ) {
    assert.equal(
      p6Report.source_runs.p4,
      report.run_id,
      "P6 formal apply must reference this P4 evidence",
    );
    assert.equal(
      p6Report.preflight.input_hashes.base_database.sha256,
      item.sha256,
      "P6 preflight base hash must equal the P4 protected baseline",
    );
    assert.equal(
      sha256(resolve(root, item.path)),
      p6Report.database.sha256_after,
      "formal base database must match the authorized P6 result",
    );
    continue;
  }
  assert.equal(
    sha256(resolve(root, item.path)),
    item.sha256,
    `protected input drift: ${item.path}`,
  );
}

assert.equal(
  manifest.schema_version,
  "environment-master-data-p4-manifest-v1",
);
assert.equal(manifest.run_id, report.run_id);
assert.equal(manifest.formal_apply_authorized, false);
assert.deepEqual(
  manifest.files.map((row) => row.path),
  [
    "compatibility-hashes.json",
    "environment-dictionary.json",
    "p4-shadow-export.json",
    "p4-shadow-export.md",
  ],
);
for (const file of manifest.files) {
  assert.equal(sha256(resolve(reportDir, file.path)), file.sha256);
}

const api = readText(resolve(root, "src/sapd_wiki/api_server.py"));
assert.ok(
  api.includes(
    '"environment-dictionary": "frontend/capability-browser/public/data/environment-dictionary.json"',
  ),
  "API data package registry missing environment dictionary",
);
assert.ok(
  api.includes('if path == "/api/v1/environments/dictionary":'),
  "dedicated environment dictionary API endpoint missing",
);
assert.ok(
  api.includes('create_envelope(read_data_package("environment-dictionary"))'),
  "environment dictionary API must serve declared package without inference",
);

console.log(
  JSON.stringify(
    {
      result: "pass",
      runId: report.run_id,
      gate: report.gate.result,
      masterCounts: evidencePackage.master_counts,
      contextCounts: evidencePackage.context_counts,
      usageRelations: evidencePackage.usage_relations.length,
      protectedEnvironmentFiles:
        compatibility.hashes_after.environment_data_tree.file_count,
      formalApplyPhase: p6Report ? "P6" : null,
    },
    null,
    2,
  ),
);
