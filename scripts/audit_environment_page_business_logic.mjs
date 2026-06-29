#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const REVIEW_ROWS_PATH = path.join(ROOT, "data/exports/worker-verify/environment-module-catalog-consistency-review-rows.json");
const WORKBENCH_PATH = path.join(ROOT, "frontend/capability-browser/public/data/environment-workbench.json");
const REPORT_PATH = path.join(ROOT, "data/exports/worker-verify/environment-page-business-logic-audit.json");

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJson(filePath, payload) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

function list(value) {
  return Array.isArray(value) ? value : [];
}

function text(value) {
  return value == null ? "" : String(value).trim();
}

function relationValue(value) {
  const raw = text(value);
  if (!raw || raw === "/" || raw === "-" || raw === "—") return "";
  if (["N/A", "NA", "NULL"].includes(raw.toUpperCase())) return "";
  return raw;
}

function keyOf(...parts) {
  return parts.map(text).join("||");
}

function serviceCode(raw) {
  return text(raw).split(/\s+/)[0];
}

function entityTitle(item) {
  return text(item?.title || item?.name || item);
}

function uniqueTitles(items) {
  return [...new Set(list(items).map(entityTitle).filter(Boolean))].sort((a, b) => a.localeCompare(b, "zh-Hans-CN"));
}

function targetSystems(target) {
  return uniqueTitles([...(target?.systems || []), ...(target?.securitySystems || []), ...(target?.linkedSystems || [])]);
}

function serviceSystems(service) {
  return uniqueTitles([...(service?.securitySystems || []), ...(service?.systems || []), ...(service?.linkedSystems || [])]);
}

function addSystem(row, system) {
  const value = relationValue(system);
  if (value) row.expectedSystems.add(value);
}

function buildExpectedTargetRelations(reviewRows) {
  const expected = new Map();
  for (const row of reviewRows) {
    const kind = text(row.childType);
    if (!["module", "measure"].includes(kind)) continue;
    const targetTitle = text(row.securityTechnologyModuleOrMeasure);
    const contextKey = text(row.objectContextKey);
    const code = text(row.securityTechnicalServiceKey || serviceCode(row.securityTechnicalService));
    if (!contextKey || !code || !targetTitle) continue;
    const key = keyOf(contextKey, code, kind, targetTitle);
    if (!expected.has(key)) {
      expected.set(key, {
        key,
        kind,
        objectContextKey: contextKey,
        serviceCode: code,
        serviceTitle: text(row.securityTechnicalService),
        targetTitle,
        expectedSystems: new Set(),
        sourceRows: [],
      });
    }
    const item = expected.get(key);
    addSystem(item, row.securitySystem);
    if (row.excelRow != null && !item.sourceRows.includes(row.excelRow)) item.sourceRows.push(row.excelRow);
  }
  return expected;
}

function buildActualTargetRelations(workbench) {
  const actual = new Map();
  const contextKeys = new Set();
  const duplicateContextKeys = [];
  const jsonWarnings = [];
  let serviceCount = 0;
  let moduleTargetCount = 0;
  let measureTargetCount = 0;

  for (const environment of list(workbench.environment_scope_tree)) {
    for (const object of list(environment.objects)) {
      const contextKey = text(object.contextKey);
      if (contextKeys.has(contextKey)) duplicateContextKeys.push(contextKey);
      if (contextKey) contextKeys.add(contextKey);
      for (const mapping of list(object.scope_mappings)) {
        for (const service of list(mapping.services)) {
          serviceCount += 1;
          const code = text(service.code || serviceCode(service.raw));
          const inheritedSystems = serviceSystems(service);
          for (const module of list(service.modules)) {
            moduleTargetCount += 1;
            const targetTitle = text(module.title);
            const ownSystems = targetSystems(module);
            const key = keyOf(contextKey, code, "module", targetTitle);
            actual.set(key, {
              key,
              kind: "module",
              objectContextKey: contextKey,
              serviceCode: code,
              targetTitle,
              ownSystems,
              serviceSystems: inheritedSystems,
              pageSystems: ownSystems,
              nestedMeasures: list(module.measures).length,
            });
            if (list(module.measures).length) jsonWarnings.push({ type: "module_has_nested_measures", key, nestedMeasures: list(module.measures).length });
          }
          for (const measure of list(service.measures)) {
            measureTargetCount += 1;
            const targetTitle = text(measure.title);
            const ownSystems = targetSystems(measure);
            const key = keyOf(contextKey, code, "measure", targetTitle);
            actual.set(key, {
              key,
              kind: "measure",
              objectContextKey: contextKey,
              serviceCode: code,
              targetTitle,
              ownSystems,
              serviceSystems: inheritedSystems,
              pageSystems: ownSystems,
              nestedMeasures: 0,
            });
            const systems = uniqueTitles(measure.systems);
            const securitySystems = uniqueTitles(measure.securitySystems);
            const crossFieldDuplicate = systems.filter((system) => securitySystems.includes(system));
            if (crossFieldDuplicate.length) jsonWarnings.push({ type: "target_system_duplicated_across_fields", key, systems: crossFieldDuplicate });
          }
        }
      }
    }
  }
  return {
    actual,
    stats: {
      objectContextCount: contextKeys.size,
      duplicateContextKeyCount: duplicateContextKeys.length,
      serviceCount,
      moduleTargetCount,
      measureTargetCount,
    },
    duplicateContextKeys,
    jsonWarnings,
  };
}

function compareExpectedActual(expected, actual) {
  const rows = [];
  let missingTargetCount = 0;
  let missingSystemCount = 0;
  let unexpectedSystemCount = 0;
  let ownTargetSystemMissingCount = 0;

  for (const item of [...expected.values()].sort((a, b) => a.key.localeCompare(b.key, "zh-Hans-CN"))) {
    const actualItem = actual.get(item.key);
    const expectedSystems = [...item.expectedSystems].sort((a, b) => a.localeCompare(b, "zh-Hans-CN"));
    if (!actualItem) {
      missingTargetCount += 1;
      rows.push({
        key: item.key,
        kind: item.kind,
        objectContextKey: item.objectContextKey,
        serviceCode: item.serviceCode,
        targetTitle: item.targetTitle,
        sourceRows: item.sourceRows,
        expectedSystems,
        ownSystems: [],
        pageSystems: [],
        missingSystems: expectedSystems,
        unexpectedSystems: [],
        ownTargetMissingSystems: expectedSystems,
        status: "missing_target",
      });
      continue;
    }
    const pageSystems = actualItem.pageSystems;
    const ownSystems = actualItem.ownSystems;
    const missingSystems = expectedSystems.filter((system) => !pageSystems.includes(system));
    const unexpectedSystems = pageSystems.filter((system) => !expectedSystems.includes(system));
    const ownTargetMissingSystems = expectedSystems.filter((system) => !ownSystems.includes(system));
    if (missingSystems.length) missingSystemCount += 1;
    if (unexpectedSystems.length) unexpectedSystemCount += 1;
    if (ownTargetMissingSystems.length) ownTargetSystemMissingCount += 1;
    if (missingSystems.length || unexpectedSystems.length || ownTargetMissingSystems.length || actualItem.nestedMeasures) {
      rows.push({
        key: item.key,
        kind: item.kind,
        objectContextKey: item.objectContextKey,
        serviceCode: item.serviceCode,
        targetTitle: item.targetTitle,
        sourceRows: item.sourceRows,
        expectedSystems,
        ownSystems,
        serviceSystems: actualItem.serviceSystems,
        pageSystems,
        missingSystems,
        unexpectedSystems,
        ownTargetMissingSystems,
        nestedMeasures: actualItem.nestedMeasures,
        status: missingSystems.length || unexpectedSystems.length ? "page_relation_mismatch" : "json_target_system_not_normalized",
      });
    }
  }

  return {
    summary: {
      expectedTargetKeys: expected.size,
      actualTargetKeys: actual.size,
      missingTargetCount,
      missingSystemCount,
      unexpectedSystemCount,
      ownTargetSystemMissingCount,
      mismatchRows: rows.length,
    },
    rows,
  };
}

const reviewRows = readJson(REVIEW_ROWS_PATH);
const workbench = readJson(WORKBENCH_PATH);
const expected = buildExpectedTargetRelations(reviewRows);
const { actual, stats, duplicateContextKeys, jsonWarnings } = buildActualTargetRelations(workbench);
const comparison = compareExpectedActual(expected, actual);

const report = {
  generatedAt: new Date().toISOString(),
  sourceRows: path.relative(ROOT, REVIEW_ROWS_PATH),
  workbench: path.relative(ROOT, WORKBENCH_PATH),
  result:
    stats.duplicateContextKeyCount ||
    comparison.summary.missingTargetCount ||
    comparison.summary.missingSystemCount ||
    comparison.summary.unexpectedSystemCount ||
    comparison.summary.ownTargetSystemMissingCount ||
    jsonWarnings.length
      ? "fail"
      : "pass",
  stats,
  comparison: comparison.summary,
  duplicateContextKeys,
  jsonWarningCount: jsonWarnings.length,
  jsonWarnings: jsonWarnings.slice(0, 100),
  mismatchRows: comparison.rows.slice(0, 200),
};

writeJson(REPORT_PATH, report);
console.log(JSON.stringify({ result: report.result, stats: report.stats, comparison: report.comparison, jsonWarningCount: report.jsonWarningCount }, null, 2));
