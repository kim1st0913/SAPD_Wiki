#!/usr/bin/env node
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const NORMALIZED_ROWS_PATH = path.join(ROOT, "data/exports/worker-verify/scope-service-module-mapping-normalized-rows.json");
const WORKBENCH_PATH = path.join(ROOT, "frontend/capability-browser/public/data/environment-workbench.json");
const REPORT_PATH = path.join(ROOT, "data/exports/worker-verify/environment-target-system-relations-audit.json");

const shouldApply = process.argv.includes("--apply");

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJson(filePath, payload) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
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

function stableId(prefix, value) {
  const digest = crypto.createHash("sha1").update(text(value)).digest("hex").slice(0, 16);
  return `shadow:${prefix}:${digest}`;
}

function keyOf(...parts) {
  return parts.map(text).join("||");
}

function serviceCode(raw) {
  return text(raw).split(/\s+/)[0];
}

function entityKey(item) {
  return text(item?.id || item?.code || item?.title || item?.name);
}

function uniqueEntities(items) {
  const seen = new Set();
  const result = [];
  for (const item of items || []) {
    const key = entityKey(item);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push(item);
  }
  return result;
}

function systemTitles(items) {
  return uniqueEntities(items || []).map((item) => text(item?.title || item?.name || item)).filter(Boolean).sort((a, b) => a.localeCompare(b, "zh-Hans-CN"));
}

function splitTargetTitles(value) {
  const raw = text(value);
  if (!raw) return [];
  return raw
    .split(/\s+\/\s+/)
    .map((item) => text(item))
    .filter(Boolean);
}

function targetTitles(row, kind) {
  if (kind === "module") return splitTargetTitles(row.securityTechnologyModule || row.moduleOrMeasureRaw);
  if (kind === "measure") return splitTargetTitles(row.securityTechnicalMeasure || row.moduleOrMeasureRaw);
  return [];
}

function sourceExpectations(normalizedRows) {
  const expectations = new Map();
  for (const row of normalizedRows) {
    const kind = text(row.moduleOrMeasureKind);
    if (!["module", "measure"].includes(kind)) continue;
    const contextKey = text(row.contextKey) || keyOf(row.informationEnvironment, row.environmentSegment, row.informationObject);
    const code = serviceCode(row.securityTechnicalService);
    const targets = targetTitles(row, kind);
    if (!contextKey || !code || !targets.length) continue;
    for (const target of targets) {
      const key = keyOf(contextKey, code, kind, target);
      if (!expectations.has(key)) {
        expectations.set(key, {
          key,
          kind,
          contextKey,
          informationEnvironment: text(row.informationEnvironment),
          environmentSegment: text(row.environmentSegment),
          informationObject: text(row.informationObject),
          serviceCode: code,
          targetTitle: target,
          expectedSystems: new Map(),
          sourceRows: [],
        });
      }
      const item = expectations.get(key);
      const systemTitle = relationValue(row.securitySystem);
      if (systemTitle) {
        item.expectedSystems.set(systemTitle, {
          id: stableId("security_system", systemTitle),
          type: "security_system",
          title: systemTitle,
        });
      }
      if (row.row != null && !item.sourceRows.includes(row.row)) item.sourceRows.push(row.row);
    }
  }
  return expectations;
}

function workbenchObjects(workbench) {
  const objects = new Map();
  for (const environment of workbench.environment_scope_tree || []) {
    for (const object of environment.objects || []) {
      if (object.contextKey) objects.set(object.contextKey, object);
    }
  }
  return objects;
}

function matchingServices(object, expectation) {
  const services = [];
  for (const mapping of object?.scope_mappings || []) {
    for (const service of mapping.services || []) {
      if (text(service.code) === expectation.serviceCode || serviceCode(service.raw) === expectation.serviceCode) services.push(service);
    }
  }
  return services;
}

function matchingTargets(service, expectation) {
  const bucket = expectation.kind === "module" ? service?.modules : service?.measures;
  return (bucket || []).filter((target) => text(target.title || target.name) === expectation.targetTitle);
}

function cleanDuplicateSecuritySystems(target) {
  const systems = systemTitles(target.systems);
  const remaining = uniqueEntities(target.securitySystems || []).filter((system) => !systems.includes(text(system.title || system.name || system)));
  if (remaining.length) target.securitySystems = remaining;
  else delete target.securitySystems;
}

function auditAndApply(workbench, expectations) {
  const objects = workbenchObjects(workbench);
  const rows = [];
  let patchedTargets = 0;
  let patchedSystems = 0;
  let cleanedDuplicateFields = 0;

  for (const expectation of [...expectations.values()].sort((a, b) => a.key.localeCompare(b.key, "zh-Hans-CN"))) {
    const object = objects.get(expectation.contextKey);
    const services = matchingServices(object, expectation);
    const expectedSystems = [...expectation.expectedSystems.values()];
    const expectedTitles = systemTitles(expectedSystems);
    const actualTitles = new Set();
    const missingTitles = new Set(expectedTitles);
    const unexpectedTitles = new Set();
    let matchedTargetCount = 0;

    for (const service of services) {
      for (const target of matchingTargets(service, expectation)) {
        matchedTargetCount += 1;
        const existing = uniqueEntities([...(target.systems || []), ...(target.securitySystems || []), ...(target.linkedSystems || [])]);
        for (const title of systemTitles(existing)) {
          actualTitles.add(title);
          missingTitles.delete(title);
          if (!expectation.expectedSystems.has(title)) unexpectedTitles.add(title);
        }
        if (shouldApply) {
          const beforeCount = systemTitles(target.systems).length;
          target.systems = uniqueEntities([...(target.systems || []), ...expectedSystems]);
          target.systemSourceRows = [...new Set([...(target.systemSourceRows || []), ...expectation.sourceRows])].sort((a, b) => Number(a) - Number(b));
          const hadDuplicateField = (target.securitySystems || []).some((system) => systemTitles(target.systems).includes(text(system.title || system.name || system)));
          cleanDuplicateSecuritySystems(target);
          if (hadDuplicateField) cleanedDuplicateFields += 1;
          const afterCount = systemTitles(target.systems).length;
          if (afterCount > beforeCount) {
            patchedTargets += 1;
            patchedSystems += afterCount - beforeCount;
          }
        }
      }
    }

    rows.push({
      key: expectation.key,
      kind: expectation.kind,
      objectContextKey: expectation.contextKey,
      serviceCode: expectation.serviceCode,
      targetTitle: expectation.targetTitle,
      sourceRows: expectation.sourceRows,
      expectedSystems: expectedTitles,
      actualSystems: [...actualTitles].sort((a, b) => a.localeCompare(b, "zh-Hans-CN")),
      missingSystems: [...missingTitles].sort((a, b) => a.localeCompare(b, "zh-Hans-CN")),
      unexpectedSystems: [...unexpectedTitles].sort((a, b) => a.localeCompare(b, "zh-Hans-CN")),
      matchedServiceCount: services.length,
      matchedTargetCount,
    });
  }

  return {
    generatedAt: new Date().toISOString(),
    mode: shouldApply ? "apply" : "audit",
    sourceRows: path.relative(ROOT, NORMALIZED_ROWS_PATH),
    workbench: path.relative(ROOT, WORKBENCH_PATH),
    summary: {
      targetRelationKeys: rows.length,
      expectedTargetSystemKeys: rows.filter((row) => row.expectedSystems.length).length,
      missingTargetSystemKeys: rows.filter((row) => row.missingSystems.length).length,
      unexpectedTargetSystemKeys: rows.filter((row) => row.unexpectedSystems.length).length,
      unmatchedTargetKeys: rows.filter((row) => !row.matchedTargetCount).length,
      patchedTargets,
      patchedSystems,
      cleanedDuplicateFields,
    },
    rows,
  };
}

const normalizedRows = readJson(NORMALIZED_ROWS_PATH);
const workbench = readJson(WORKBENCH_PATH);
const expectations = sourceExpectations(normalizedRows);
const report = auditAndApply(workbench, expectations);

if (shouldApply) writeJson(WORKBENCH_PATH, workbench);
writeJson(REPORT_PATH, report);

console.log(JSON.stringify(report.summary, null, 2));
