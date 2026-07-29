#!/usr/bin/env node

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const readText = (path) => readFileSync(resolve(root, path), "utf8");
const readJson = (path) => JSON.parse(readFileSync(resolve(root, path), "utf8"));

const contractPath = "docs/01-architecture/contracts/environment-master-data/v1/environment-master-data.contract.json";
const dictionarySchemaPath = "docs/01-architecture/contracts/environment-master-data/v1/environment-dictionary.schema.json";
const decisionSchemaPath = "docs/01-architecture/contracts/environment-master-data/v1/master-data-decision-manifest.schema.json";
const dictionaryFixturePath = "tests/fixtures/environment-master-data/v1/environment-dictionary.valid.json";
const decisionFixturePath = "tests/fixtures/environment-master-data/v1/master-data-decision-manifest.valid.json";

const contract = readJson(contractPath);
const dictionarySchema = readJson(dictionarySchemaPath);
const decisionSchema = readJson(decisionSchemaPath);
const dictionaryFixture = readJson(dictionaryFixturePath);
const decisionFixture = readJson(decisionFixturePath);
const apiFieldContract = readText("docs/01-architecture/api-field-contract.md");
const packageInventory = readText("docs/05-archive/architecture-retired-2026-07/api-offline-package-contract-inventory.md");
const implementationPlan = readText("docs/05-archive/implementation-completed-2026-07/environment-master-data-dictionary-plan-2026-07-25.md");
const taskPlan = readText("task_plan.md");
const scriptsReadme = readText("scripts/README.md");

assert.equal(contract.contract_id, "SAPD-ENVIRONMENT-MASTER-DATA-v1");
assert.equal(contract.status, "p0_frozen");
assert.equal(contract.scope.formal_apply_authorized, false);
assert.equal(contract.scope.initial_release_mode, "read_only_dictionary");
assert.equal(contract.authority.frontend_canonicalization_allowed, false);
assert.equal(contract.authority.baseline_parity_required_before_candidate_generation, true);

const objectTypes = Object.fromEntries(contract.object_types.map((entry) => [entry.type, entry]));
assert.deepEqual(
  Object.keys(objectTypes).sort(),
  ["environment_segment_type", "information_environment", "information_object"],
);
assert.equal(objectTypes.information_environment.ui_label, "信息化环境");
assert.equal(objectTypes.environment_segment_type.ui_label, "环境子类");
assert.equal(objectTypes.information_object.ui_label, "信息化对象");
assert.equal(objectTypes.information_environment.observed_baseline_count, 10);
assert.equal(objectTypes.environment_segment_type.observed_title_candidate_count, 16);
assert.equal(objectTypes.environment_segment_type.observed_context_instance_count, 29);
assert.equal(objectTypes.environment_segment_type.target_count_policy, "p2_adjudicated_from_title_clusters_may_merge_or_split");
assert.equal(objectTypes.environment_segment_type.target_count_upper_bound, 29);
assert.equal(objectTypes.information_object.observed_baseline_count, 51);

assert.equal(contract.context_grains.environment_segment.observed_baseline_count, 29);
assert.equal(contract.context_grains.environment_object_context.observed_baseline_count, 67);
assert.equal(
  contract.context_grains.environment_segment.identity_match,
  "type_plus_environment_identity_or_qualifier_plus_normalized_title",
);

assert.equal(contract.identity_contract.code_allocation.fill_empty_code_only, true);
assert.equal(contract.identity_contract.code_allocation.runtime_derivation_forbidden, true);
assert.ok(contract.identity_contract.code_backfill_must_not_change.includes("stable_ref"));
assert.ok(contract.identity_contract.code_backfill_must_not_change.includes("metadata.object_key"));

assert.equal(contract.relation_contract.new_relation.relation_type, "instance_of");
assert.equal(contract.relation_contract.new_relation.source_type, "environment_segment");
assert.equal(contract.relation_contract.new_relation.target_type, "environment_segment_type");
assert.equal(contract.relation_contract.new_relation.source_cardinality, "exactly_one");
assert.equal(contract.relation_contract.new_relation.expected_relation_count_at_current_baseline, 29);
assert.deepEqual(contract.relation_contract.new_relation.unique_key, ["source_item_id", "relation_type"]);
assert.equal(contract.relation_contract.direct_object_to_environment_allowed, true);
assert.equal(contract.relation_contract.synthetic_segment_creation_forbidden, true);

assert.equal(contract.dictionary_projection_contract.schema_version, "environment-dictionary-v1");
assert.equal(contract.dictionary_projection_contract.api_endpoint, "GET /api/v1/environments/dictionary");
assert.equal(contract.frontend_contract.write_actions_enabled, false);
assert.equal(contract.frontend_contract.default_category_state, "collapsed");
assert.equal(contract.frontend_contract.legacy_fallback.frontend_deduplication_forbidden, true);
assert.equal(contract.compatibility_contract.feature_switch_required, true);

assert.equal(dictionarySchema.$schema, "https://json-schema.org/draft/2020-12/schema");
assert.equal(dictionarySchema.additionalProperties, false);
assert.equal(dictionarySchema.properties.schema_version.const, "environment-dictionary-v1");
assert.equal(dictionarySchema.$defs.masterRecord.additionalProperties, false);
assert.equal(dictionarySchema.$defs.usageRelation.additionalProperties, false);

const dictionaryCollections = [
  ["information_environments", "information_environment", /^IE-[0-9]{3}$/],
  ["environment_segment_types", "environment_segment_type", /^ES-[0-9]{3}$/],
  ["information_objects", "information_object", /^IO-[0-9]{3}$/],
];
assert.equal(dictionaryFixture.schema_version, "environment-dictionary-v1");
for (const [collection, expectedType, codePattern] of dictionaryCollections) {
  assert.ok(Array.isArray(dictionaryFixture[collection]));
  for (const record of dictionaryFixture[collection]) {
    assert.equal(record.type, expectedType);
    assert.match(record.code, codePattern);
    assert.ok(record.stable_ref);
    assert.ok(record.public_id);
    assert.ok(Array.isArray(record.aliases));
    assert.ok(record.usage_summary);
  }
}
assert.equal(dictionaryFixture.master_counts.information_environments, dictionaryFixture.information_environments.length);
assert.equal(dictionaryFixture.master_counts.environment_segment_types, dictionaryFixture.environment_segment_types.length);
assert.equal(dictionaryFixture.master_counts.information_objects, dictionaryFixture.information_objects.length);
const fixtureMasterRefs = new Set(
  dictionaryCollections.flatMap(([collection]) => dictionaryFixture[collection].map((record) => record.stable_ref)),
);
for (const usage of dictionaryFixture.usage_relations) {
  assert.ok(fixtureMasterRefs.has(usage.master_ref));
  assert.equal(usage.route, "/environment-mapping");
  assert.ok(usage.context_ref);
}

const forbiddenMainFields = new Set([
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
function assertNoForbiddenFields(value, path = "$") {
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoForbiddenFields(item, `${path}[${index}]`));
    return;
  }
  if (!value || typeof value !== "object") return;
  for (const [key, child] of Object.entries(value)) {
    assert.ok(!forbiddenMainFields.has(key), `forbidden field ${path}.${key}`);
    assertNoForbiddenFields(child, `${path}.${key}`);
  }
}
assertNoForbiddenFields(dictionaryFixture);

assert.equal(decisionSchema.$schema, "https://json-schema.org/draft/2020-12/schema");
assert.equal(decisionSchema.additionalProperties, false);
assert.equal(decisionSchema.$defs.decisionEntry.additionalProperties, false);
assert.equal(decisionFixture.schema_version, "environment-master-data-decision-manifest-v1");

const decisionValues = new Set(contract.decision_manifest_contract.decision_values);
const blockingValues = new Set(contract.decision_manifest_contract.formal_apply_blocking_values);
for (const entry of decisionFixture.entries) {
  assert.ok(decisionValues.has(entry.decision));
  assert.ok(Array.isArray(entry.aliases));
  assert.ok(Array.isArray(entry.context_evidence_refs));
  if (entry.code) assert.match(entry.code, /^(IE|ES|IO)-[0-9]{3}$/);
}
assert.ok(decisionFixture.entries.some((entry) => blockingValues.has(entry.decision)));

assert.ok(apiFieldContract.includes("### 8.3 `GET /api/v1/environments/dictionary`"));
assert.ok(apiFieldContract.includes("environment-dictionary-v1"));
assert.ok(packageInventory.includes("| `/api/v1/environments/dictionary` |"));
assert.ok(implementationPlan.includes("状态：`p8_web_completed_app_dmg_uat_pending`"));
assert.ok(taskPlan.includes("信息化环境主数据 P0—P8 已完成 Web 验收"));
assert.ok(scriptsReadme.includes("`audit_environment_master_data_p0_contract.mjs`"));

console.log(
  JSON.stringify(
    {
      result: "pass",
      contract: contract.contract_id,
      status: contract.status,
      objectTypes: Object.keys(objectTypes).length,
      observedBaseline: {
        informationEnvironments: objectTypes.information_environment.observed_baseline_count,
        environmentSegmentTitleCandidates: objectTypes.environment_segment_type.observed_title_candidate_count,
        environmentSegments: contract.context_grains.environment_segment.observed_baseline_count,
        informationObjects: objectTypes.information_object.observed_baseline_count,
        environmentObjectContexts: contract.context_grains.environment_object_context.observed_baseline_count
      },
      formalApplyAuthorized: contract.scope.formal_apply_authorized,
      fixtureBlockingDecisionDemonstrated: true
    },
    null,
    2,
  ),
);
