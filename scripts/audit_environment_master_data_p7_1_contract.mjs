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
import vm from "node:vm";

const root = resolve(import.meta.dirname, "..");
const outputRoot = resolve(root, "data/exports/worker-verify/plan-env-md");
const readJson = (path) => JSON.parse(readFileSync(path, "utf8"));
const sha256 = (path) =>
  createHash("sha256").update(readFileSync(path)).digest("hex");
const latestReportDir = readdirSync(outputRoot)
  .filter((name) => /^p7-1-\d{8}T\d{6}Z$/.test(name))
  .map((name) => resolve(outputRoot, name))
  .filter(
    (path) =>
      statSync(path).isDirectory()
      && existsSync(resolve(path, "p7-1-definition-apply.json")),
  )
  .sort()
  .at(-1);
assert.ok(latestReportDir, "P7.1 formal apply evidence is required");

const report = readJson(resolve(latestReportDir, "p7-1-definition-apply.json"));
const adjudicationPath = resolve(
  root,
  "docs/01-architecture/contracts/environment-master-data/v1/"
    + "environment-and-object-definition-adjudication.p7-1.json",
);
const adjudication = readJson(adjudicationPath);
const dictionaryPath = resolve(
  root,
  "frontend/capability-browser/public/data/environment-dictionary.json",
);
const dictionary = readJson(dictionaryPath);
const componentPath = resolve(
  root,
  "frontend/capability-browser/components/EnvironmentObjectDirectoryTable.js",
);
const componentSource = readFileSync(componentPath, "utf8");
const appSource = readFileSync(
  resolve(root, "frontend/capability-browser/app.js"),
  "utf8",
);
const viewModelsSource = readFileSync(
  resolve(root, "frontend/capability-browser/viewModels.js"),
  "utf8",
);
const styles = readFileSync(
  resolve(root, "frontend/capability-browser/p1-reference-tables.css"),
  "utf8",
);
const index = readFileSync(
  resolve(root, "frontend/capability-browser/index.html"),
  "utf8",
);

assert.equal(
  adjudication.schema_version,
  "environment-and-object-definition-adjudication-p7-1-v1",
);
assert.equal(adjudication.status, "frozen");
assert.equal(adjudication.definition_method.source_text_claim, false);
assert.equal(adjudication.definition_method.runtime_inference, false);
assert.equal(adjudication.entries.length, 61);
assert.equal(
  new Set(adjudication.entries.map((entry) => entry.code)).size,
  61,
);
assert.equal(
  adjudication.entries.filter(
    (entry) => entry.type === "information_environment",
  ).length,
  10,
);
assert.equal(
  adjudication.entries.filter(
    (entry) => entry.type === "information_object",
  ).length,
  51,
);
for (const entry of adjudication.entries) {
  assert.ok(entry.definition.trim(), `${entry.code} definition missing`);
  assert.ok(entry.decision_note.trim(), `${entry.code} decision note missing`);
}

assert.equal(
  report.schema_version,
  "environment-master-data-p7-1-definition-apply-v1",
);
assert.equal(report.phase, "P7.1");
assert.equal(report.formal_apply_authorized, true);
assert.deepEqual(report.apply.first, {
  definitions_updated: 61,
  change_logs_created: 61,
});
assert.deepEqual(report.apply.repeat, {
  definitions_updated: 0,
  change_logs_created: 0,
});
assert.deepEqual(report.apply.definitions_by_type, {
  environment_segment_type: 16,
  information_environment: 10,
  information_object: 51,
});
assert.equal(report.rehearsal.independent_restore_test, "pass");
assert.equal(report.recovery.created_before_apply, true);
assert.equal(report.recovery.rollback_triggered, false);
assert.equal(report.protected_boundaries.master_identity_unchanged, true);
assert.equal(report.protected_boundaries.relationships_unchanged, true);
assert.equal(report.protected_boundaries.source_references_unchanged, true);
assert.equal(report.protected_boundaries.user_database_unchanged, true);
assert.equal(report.protected_boundaries.source_workbook_unchanged, true);
assert.equal(
  sha256(dictionaryPath),
  report.dictionary.sha256,
  "current dictionary must match P7.1 evidence",
);
assert.equal(
  sha256(adjudicationPath),
  report.adjudication.sha256,
  "definition adjudication must match P7.1 evidence",
);

assert.equal(dictionary.schema_version, "environment-dictionary-v1");
assert.equal(
  dictionary.source_package_versions.phase,
  "P7.1-definition-and-usage-projection",
);
assert.deepEqual(dictionary.master_counts, {
  information_environments: 10,
  environment_segment_types: 16,
  information_objects: 51,
});
assert.deepEqual(dictionary.context_counts, {
  environment_segments: 29,
  environment_object_contexts: 67,
});
const records = [
  ...dictionary.information_environments,
  ...dictionary.environment_segment_types,
  ...dictionary.information_objects,
];
assert.equal(records.length, 77);
assert.equal(
  records.filter((record) => record.description?.trim()).length,
  77,
  "all 77 master records must have governed definitions",
);
const adjudicatedByCode = new Map(
  adjudication.entries.map((entry) => [entry.code, entry]),
);
for (const record of [
  ...dictionary.information_environments,
  ...dictionary.information_objects,
]) {
  assert.equal(
    record.description,
    adjudicatedByCode.get(record.code)?.definition,
    `${record.code} definition must come from frozen adjudication`,
  );
}

assert.equal(dictionary.usage_relations.length, 125);
assert.equal(
  new Set(dictionary.usage_relations.map((row) => row.relation_ref)).size,
  125,
);
const relationCounts = Object.fromEntries(
  [
    "information_environment",
    "environment_segment_type",
    "information_object",
  ].map((type) => [
    type,
    dictionary.usage_relations.filter((row) => row.master_type === type).length,
  ]),
);
assert.deepEqual(relationCounts, {
  information_environment: 29,
  environment_segment_type: 29,
  information_object: 67,
});
const relationsByMaster = new Map();
for (const relation of dictionary.usage_relations) {
  if (!relationsByMaster.has(relation.master_ref)) {
    relationsByMaster.set(relation.master_ref, []);
  }
  relationsByMaster.get(relation.master_ref).push(relation);
  assert.equal(relation.route, "/environment-mapping");
  if (relation.environment_ref) {
    assert.ok(relation.route_params.environment_id);
  }
  if (relation.segment_ref) {
    assert.ok(relation.route_params.segment_id);
  }
  if (relation.object_ref) {
    assert.ok(relation.route_params.object_id);
  }
}
const environmentContextCounts = dictionary.information_environments.map(
  (record) => relationsByMaster.get(record.stable_ref)?.length || 0,
);
assert.deepEqual(environmentContextCounts, [3, 5, 3, 1, 4, 4, 2, 1, 3, 3]);
for (const record of dictionary.information_environments) {
  const contexts = relationsByMaster.get(record.stable_ref) || [];
  assert.equal(
    contexts.length,
    record.usage_summary.environment_segments,
    `${record.code} expandable contexts must match the summary`,
  );
  for (const context of contexts) {
    assert.equal(context.context_type, "environment_segment");
    assert.equal(context.master_ref, record.stable_ref);
  }
}

const viewModelSandbox = { window: {} };
vm.runInNewContext(viewModelsSource, viewModelSandbox, {
  filename: "viewModels.js",
});
const master =
  viewModelSandbox.window.sapdViewModels
    .buildEnvironmentMasterDictionaryViewModel({ dictionary, search: "" });
assert.equal(master.rows.length, 77);
assert.deepEqual(
  Array.from(master.masterCategories, (category) => category.contextCount),
  [29, 29, 67],
);

let componentClickHandler = null;
const componentSandbox = {
  document: {
    addEventListener(type, handler) {
      if (type === "click") componentClickHandler = handler;
    },
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
const html =
  componentSandbox.window.sapdComponents.EnvironmentObjectDirectoryTable.render({
    masterCategories: master.masterCategories,
    directoryMode: "master_dictionary",
    search: "",
    emptyState: "",
  });
assert.equal(
  (html.match(/environment-master-category-row/g) || []).length,
  3,
);
assert.equal(
  (html.match(/environment-master-record-row/g) || []).length,
  77,
);
assert.equal(
  (html.match(/environment-master-context-row/g) || []).length,
  125,
);
for (const count of environmentContextCounts) {
  assert.ok(html.includes(`展开关联（${count}）`));
}
assert.ok(html.includes("保留所属信息化环境与环境子类的精确上下文"));
assert.ok(html.includes("<th>编号</th>"));
assert.ok(!html.includes("编号 / 状态"));
assert.ok(!html.includes("environment-master-status"));
assert.ok(!html.includes(">有效<"));
assert.ok(!html.includes("主数据分类"));
assert.ok(html.includes('class="environment-master-context-band"'));
assert.ok(html.includes("关联 1/"));
assert.ok(html.includes('colspan="4"'));
assert.ok(html.includes("定位关联映射"));
assert.ok(html.includes('data-environment-target-tab="mapping"'));
assert.ok(!html.includes('class="environment-master-context-title"><span title='));
assert.ok(
  html.includes("网络周界 / 互联网边界"),
  "expanded usage must identify the environment and child context",
);
assert.ok(styles.includes(".environment-master-context-band"));
assert.ok(styles.includes("border-left: 3px solid"));
assert.ok(appSource.includes("routeButton.dataset.environmentTargetTab"));
assert.ok(appSource.includes("environmentTab: options.environmentTab"));
assert.ok(
  appSource.includes(
    'event.target.closest("button, a, input, select, textarea, summary")',
  ),
  "interactive controls inside master rows must not trigger row-selection rerenders",
);
assert.ok(
  styles.includes("grid-template-rows: auto auto minmax(0, 1fr)"),
  "directory must keep notice, toolbar and table in top-aligned tracks",
);
assert.ok(
  styles.includes(
    ".source-local-search-body:has(.environment-object-directory-table.is-master)",
  ),
  "environment directory layout override must outrank the later shared hierarchical selector",
);
assert.ok(
  componentSource.includes('`展开关联（${contexts.length}）`'),
  "expand button count must come from the rendered context collection",
);
assert.equal(typeof componentClickHandler, "function");
const interactionRecordId = "information_environment:IE-001";
const interactionContextRows = [
  { hidden: true },
  { hidden: true },
  { hidden: true },
];
const interactionTable = {
  querySelectorAll(selector) {
    assert.equal(
      selector,
      `[data-master-context-parent="${interactionRecordId}"]`,
    );
    return interactionContextRows;
  },
};
let interactionExpanded = "false";
const interactionToggle = {
  dataset: { environmentMasterRecordToggle: interactionRecordId },
  textContent: "展开关联（3）",
  getAttribute(name) {
    assert.equal(name, "aria-expanded");
    return interactionExpanded;
  },
  setAttribute(name, value) {
    assert.equal(name, "aria-expanded");
    interactionExpanded = value;
  },
  closest(selector) {
    if (selector === "[data-environment-master-record-toggle]") return this;
    if (selector === "table") return interactionTable;
    return null;
  },
};
let prevented = 0;
let stopped = 0;
const interactionEvent = {
  target: interactionToggle,
  preventDefault() {
    prevented += 1;
  },
  stopPropagation() {
    stopped += 1;
  },
};
componentClickHandler(interactionEvent);
assert.equal(interactionExpanded, "true");
assert.equal(interactionToggle.textContent, "收起关联");
assert.ok(interactionContextRows.every((row) => row.hidden === false));
assert.equal(prevented, 1);
assert.equal(stopped, 1);
componentClickHandler(interactionEvent);
assert.equal(interactionExpanded, "false");
assert.equal(interactionToggle.textContent, "展开关联（3）");
assert.ok(interactionContextRows.every((row) => row.hidden === true));
assert.equal(prevented, 2);
assert.equal(stopped, 2);
assert.ok(
  appSource.includes(
    'state.activeEnvironmentTab = options.environmentTab === "mapping" ? "mapping" : "topology"',
  ),
  "relationship deep links must enter the mapping tab instead of the Draw.io topology tab",
);
assert.ok(
  appSource.includes("state.selectedEnvironmentId = environmentId || null")
    && appSource.includes(
      "state.selectedEnvironmentSegmentId = environmentSegmentId || null",
    )
    && appSource.includes(
      "state.selectedEnvironmentObjectId = environmentObjectId || null",
    ),
  "relationship deep links must preserve exact environment, segment and object identity",
);
assert.match(index, /environmentMasterDictionary:\s*true/);

console.log(
  JSON.stringify(
    {
      result: "pass",
      route: "/knowledge/environment-objects",
      masterRecords: records.length,
      definitions: records.length,
      usageRelations: dictionary.usage_relations.length,
      usageByMasterType: relationCounts,
      environmentContextCounts,
      oneClickExpandCollapse: "pass",
      relationshipDeepLinkTarget: "mapping",
      recovery: report.recovery.independent_restore_test,
    },
    null,
    2,
  ),
);
