#!/usr/bin/env node

import assert from "node:assert/strict";
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
const outputRoot = resolve(
  root,
  "data/exports/worker-verify/plan-env-md",
);
const read = (path) => readFileSync(resolve(root, path), "utf8");
const dictionary = JSON.parse(
  read("frontend/capability-browser/public/data/environment-dictionary.json"),
);
const workbench = JSON.parse(
  read("frontend/capability-browser/public/data/environment-workbench.json"),
);
const viewModelsSource = read("frontend/capability-browser/viewModels.js");
const componentSource = read(
  "frontend/capability-browser/components/EnvironmentObjectDirectoryTable.js",
);
const dataClientSource = read("frontend/capability-browser/dataClient.js");
const app = read("frontend/capability-browser/app.js");
const index = read("frontend/capability-browser/index.html");
const styles = read("frontend/capability-browser/p1-reference-tables.css");

const viewModelSandbox = { window: {} };
vm.runInNewContext(viewModelsSource, viewModelSandbox, {
  filename: "viewModels.js",
});
const viewModels = viewModelSandbox.window.sapdViewModels;

const master = viewModels.buildEnvironmentMasterDictionaryViewModel({
  dictionary,
  search: "",
});
assert.equal(master.directoryMode, "master_dictionary");
assert.equal(master.rows.length, 77);
assert.equal(master.masterCategories.length, 3);
assert.deepEqual(
  Array.from(master.masterCategories, (row) => row.type),
  [
    "information_environment",
    "environment_segment_type",
    "information_object",
  ],
);
assert.deepEqual(
  JSON.parse(JSON.stringify(master.summary)),
  {
    totalEnvironments: 10,
    totalSegmentTypes: 16,
    totalObjects: 51,
    totalSegmentContexts: 29,
    totalObjectContexts: 67,
  },
);
assert.deepEqual(
  Array.from(master.masterCategories, (category) => category.records.length),
  [10, 16, 51],
);
assert.deepEqual(
  Array.from(master.masterCategories, (category) => category.contextCount),
  [10, 29, 67],
);
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

const searched = viewModels.buildEnvironmentMasterDictionaryViewModel({
  dictionary,
  search: "API网关层",
});
assert.equal(searched.rows.length, 1);
assert.equal(searched.masterCategories.length, 1);
assert.equal(searched.masterCategories[0].type, "information_object");
assert.equal(searched.rows[0].title, "API网关层");
assert.equal(searched.rows[0].searchContextMatch, true);

const environments =
  workbench.environment_scope_tree || workbench.environmentScopeTree || [];
const fallbackDisabled = viewModels.buildEnvironmentDirectoryWithFallback({
  dictionary,
  management: { environment_scope_tree: environments },
  search: "",
  enabled: false,
});
assert.equal(fallbackDisabled.directoryMode, "legacy_fallback");
assert.equal(fallbackDisabled.fallbackReason, "feature_disabled");
assert.match(fallbackDisabled.compatibilityNotice, /尚未启用/);
assert.equal(fallbackDisabled.summary.totalEnvironments, 10);
assert.equal(fallbackDisabled.summary.totalSegments, 29);
assert.equal(fallbackDisabled.summary.totalObjects, 51);
assert.equal(fallbackDisabled.summary.totalContextRows, 67);

const fallbackMissing = viewModels.buildEnvironmentDirectoryWithFallback({
  dictionary: { __data_state: "missing_file" },
  management: { environment_scope_tree: environments },
  search: "",
  enabled: true,
});
assert.equal(fallbackMissing.directoryMode, "legacy_fallback");
assert.equal(fallbackMissing.fallbackReason, "missing_file");
assert.match(fallbackMissing.compatibilityNotice, /不是主数据去重统计/);
assert.equal(fallbackMissing.rows.length, 67);

const fallbackSchema = viewModels.buildEnvironmentDirectoryWithFallback({
  dictionary: { ...dictionary, schema_version: "future-version" },
  management: { environment_scope_tree: environments },
  search: "",
  enabled: true,
});
assert.equal(fallbackSchema.directoryMode, "legacy_fallback");
assert.equal(fallbackSchema.fallbackReason, "schema_incompatible");
assert.match(fallbackSchema.compatibilityNotice, /schema 不兼容/);
assert.equal(fallbackSchema.rows.length, 67);

const emptyDictionary = {
  ...dictionary,
  data_state: "empty",
  master_counts: {
    information_environments: 0,
    environment_segment_types: 0,
    information_objects: 0,
  },
  context_counts: {
    environment_segments: 0,
    environment_object_contexts: 0,
  },
  information_environments: [],
  environment_segment_types: [],
  information_objects: [],
  usage_relations: [],
};
const emptyMaster = viewModels.buildEnvironmentDirectoryWithFallback({
  dictionary: emptyDictionary,
  management: { environment_scope_tree: environments },
  search: "",
  enabled: true,
});
assert.equal(emptyMaster.directoryMode, "master_dictionary");
assert.equal(emptyMaster.dataState, "empty");
assert.equal(emptyMaster.rows.length, 0);
assert.match(emptyMaster.emptyState, /当前为空/);

const componentSandbox = {
  document: {
    addEventListener() {},
    querySelector() {
      return null;
    },
  },
  window: {
    sapdComponents: {
      utils: {
        escapeHtml(value) {
          return String(value ?? "")
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;");
        },
        list(value) {
          return Array.isArray(value) ? value : [];
        },
        text(value) {
          return value == null ? "" : String(value);
        },
      },
    },
  },
};
vm.runInNewContext(componentSource, componentSandbox, {
  filename: "EnvironmentObjectDirectoryTable.js",
});
const renderDirectory =
  componentSandbox.window.sapdComponents.EnvironmentObjectDirectoryTable.render;
const collapsedHtml = renderDirectory({
  masterCategories: master.masterCategories,
  directoryMode: "master_dictionary",
  search: "",
  emptyState: "",
});
assert.equal(
  (collapsedHtml.match(/environment-master-category-row/g) || []).length,
  3,
);
assert.equal(
  (collapsedHtml.match(/environment-master-record-row/g) || []).length,
  77,
);
assert.equal(
  (collapsedHtml.match(/environment-master-context-row/g) || []).length,
  106,
);
assert.equal(
  (collapsedHtml.match(/aria-expanded="true"/g) || []).length,
  0,
  "master categories must default collapsed",
);
assert.ok(collapsedHtml.includes("全部展开"));
assert.ok(collapsedHtml.includes("全部收起"));
assert.ok(collapsedHtml.includes('data-app-route="/environment-mapping"'));
assert.ok(collapsedHtml.includes("data-environment-id="));
assert.ok(collapsedHtml.includes("data-environment-segment-id="));
assert.ok(collapsedHtml.includes("data-environment-object-id="));

const searchedHtml = renderDirectory({
  masterCategories: searched.masterCategories,
  directoryMode: "master_dictionary",
  search: "API网关层",
  emptyState: "",
});
assert.equal(
  (searchedHtml.match(/aria-expanded="true"/g) || []).length,
  2,
  "search must expand matching category and matching context record",
);
const clearedHtml = renderDirectory({
  masterCategories: master.masterCategories,
  directoryMode: "master_dictionary",
  search: "",
  emptyState: "",
});
assert.equal(
  (clearedHtml.match(/aria-expanded="true"/g) || []).length,
  0,
  "clear search must restore expansion state",
);

const legacyHtml = renderDirectory({
  environmentGroups: fallbackDisabled.environmentGroups,
  directoryMode: fallbackDisabled.directoryMode,
  compatibilityNotice: fallbackDisabled.compatibilityNotice,
  search: "",
  selectedId: "",
  emptyState: "",
});
assert.ok(legacyHtml.includes("兼容目录"));
assert.equal((legacyHtml.match(/depth-0/g) || []).length, 10);
assert.equal(
  (legacyHtml.match(/environment-object-directory-row/g) || []).length,
  67,
);

async function dataClientWithFetch({ flag, fetch }) {
  const sandbox = {
    AbortController,
    Headers,
    URLSearchParams,
    clearTimeout,
    console,
    fetch,
    setTimeout,
    window: {
      SAPD_API_BASE: "",
      location: { protocol: "http:" },
      sapdFeatureFlags: { environmentMasterDictionary: flag },
    },
  };
  vm.runInNewContext(dataClientSource, sandbox, {
    filename: "dataClient.js",
  });
  return sandbox.window.sapdDataClient;
}

const apiFailureCalls = [];
const apiFailureClient = await dataClientWithFetch({
  flag: true,
  async fetch(path) {
    apiFailureCalls.push(String(path));
    if (String(path) === "/api/v1/environments/dictionary") {
      throw new Error("simulated API unavailable");
    }
    assert.equal(
      String(path),
      "./public/data/environment-dictionary.json",
      "API failure must fall back to static shadow package",
    );
    return {
      ok: true,
      status: 200,
      async json() {
        return dictionary;
      },
    };
  },
});
assert.equal(apiFailureClient.isEnvironmentMasterDictionaryEnabled(), true);
const apiFailureEnvelope = await apiFailureClient.getEnvironmentDictionary();
assert.equal(apiFailureEnvelope.data.schema_version, "environment-dictionary-v1");
assert.deepEqual(apiFailureCalls, [
  "/api/v1/environments/dictionary",
  "./public/data/environment-dictionary.json",
]);

const missingClient = await dataClientWithFetch({
  flag: true,
  async fetch(path) {
    return {
      ok: false,
      status: 404,
      async json() {
        return {};
      },
    };
  },
});
const missingEnvelope = await missingClient.getEnvironmentDictionary();
assert.equal(missingEnvelope.data.__data_state, "missing_file");
assert.equal(
  viewModels.environmentDictionaryCompatibility(missingEnvelope.data).usable,
  false,
);

const disabledClient = await dataClientWithFetch({
  flag: false,
  async fetch() {
    throw new Error("disabled feature should not be queried by load contract");
  },
});
assert.equal(disabledClient.isEnvironmentMasterDictionaryEnabled(), false);

const featureMatch = index.match(
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
    "P5 historical audit only accepts an enabled switch after valid P7 evidence",
  );
  const p7Evidence = JSON.parse(
    readFileSync(resolve(p7EvidenceDir, "p7-controlled-switch.json"), "utf8"),
  );
  assert.equal(p7Evidence.phase, "P7");
  assert.equal(p7Evidence.feature_switch.enabled, true);
  assert.equal(p7Evidence.source_p5_run_id, "p5-20260725T170159Z");
}
assert.ok(
  dataClientSource.includes(
    'environmentDictionary: "/api/v1/environments/dictionary"',
  ),
);
assert.ok(
  app.includes(
    'requiredPackages: ["environmentDictionary", "environmentWorkbench"]',
  ),
  "enabled mode must load dictionary plus legacy fallback",
);
assert.ok(
  app.includes("viewModels?.environmentDictionaryCompatibility"),
  "runtime must distinguish usable dictionary from fallback states",
);
assert.ok(
  app.includes("state.selectedEnvironmentSegmentId = environmentSegmentId || null"),
  "relationship navigation must set explicit environment selection",
);
assert.ok(
  styles.includes(".environment-directory-compatibility-notice")
    && styles.includes(".environment-master-context-toggle"),
  "master dictionary page styles missing",
);
for (const forbidden of [
  "raw_value",
  "source_file_id",
  "import_job_id",
]) {
  assert.ok(
    !componentSource.includes(forbidden),
    `frontend main surface must not consume raw field: ${forbidden}`,
  );
}

const args = process.argv.slice(2);
const writeReport = args.includes("--write-report");
let reportDir = "";
if (writeReport) {
  const p4RunId = readdirSync(outputRoot)
    .filter((name) => /^p4-\d{8}T\d{6}Z$/.test(name))
    .map((name) => resolve(outputRoot, name))
    .filter(
      (path) =>
        statSync(path).isDirectory()
        && existsSync(resolve(path, "p4-shadow-export.json")),
    )
    .sort()
    .at(-1)
    ?.split("/")
    .at(-1);
  assert.ok(p4RunId, "P5 report requires P4 evidence");
  const now = new Date();
  const runId = `p5-${now.toISOString().replaceAll("-", "").replaceAll(":", "").slice(0, 15)}Z`;
  reportDir = resolve(outputRoot, runId);
  mkdirSync(reportDir, { recursive: false });
  const report = {
    schema_version: "environment-master-data-p5-shadow-frontend-v1",
    plan_id: "PLAN-ENV-MD",
    phase: "P5",
    run_id: runId,
    generated_at: now.toISOString().replace(/\.\d{3}Z$/, "Z"),
    source_p4_run_id: p4RunId,
    formal_apply_authorized: false,
    feature_switch: {
      name: "environmentMasterDictionary",
      default_enabled: false,
      enabled_mode_validated: true,
      disabled_mode_validated: true,
    },
    frontend: {
      route: "/knowledge/environment-objects",
      master_records: 77,
      master_categories: 3,
      usage_relations: 106,
      legacy_context_rows: 67,
      states_validated: [
        "ready",
        "empty",
        "missing_package",
        "api_error_static_fallback",
        "schema_incompatible",
        "feature_disabled",
      ],
      clear_search_restores_previous_expansion: true,
      explicit_relationship_navigation: true,
    },
    protected_data: {
      formal_database_modified: false,
      user_database_modified: false,
      source_workbook_modified: false,
      existing_environment_packages_replaced: false,
    },
    gate: {
      result: "ready_for_p6_separate_authorization",
      blockers: [],
      formal_apply_authorized: false,
    },
  };
  writeFileSync(
    resolve(reportDir, "p5-shadow-frontend.json"),
    `${JSON.stringify(report, null, 2)}\n`,
    "utf8",
  );
  writeFileSync(
    resolve(reportDir, "p5-shadow-frontend.md"),
    [
      "# 环境主数据 P5 影子前端",
      "",
      `- 运行：\`${runId}\``,
      `- 来源 P4：\`${p4RunId}\``,
      "- 功能开关：默认关闭",
      "- 主数据视图：3 类、77 条主数据、106 条关联使用",
      "- 兼容目录：10/29/67 保留",
      "- 状态：ready / empty / missing / API fallback / schema incompatible / disabled 已验证",
      "- 正式 apply：未授权、未执行",
      "- 门禁：`ready_for_p6_separate_authorization`",
      "",
    ].join("\n"),
    "utf8",
  );
}

console.log(
  JSON.stringify(
    {
      result: "pass",
      route: "/knowledge/environment-objects",
      featureDefault: false,
      featureCurrent: currentFeatureEnabled,
      masterRecords: master.rows.length,
      usageRelations: dictionary.usage_relations.length,
      legacyContextRows: fallbackDisabled.rows.length,
      reportDir,
    },
    null,
    2,
  ),
);
