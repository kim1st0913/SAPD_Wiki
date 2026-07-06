#!/usr/bin/env node
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const NORMALIZED_ROWS_PATH = path.join(ROOT, "data/exports/worker-verify/scope-service-module-mapping-normalized-rows.json");
const WORKBENCH_PATH = path.join(ROOT, "frontend/capability-browser/public/data/environment-workbench.json");
const REPORT_PATH = path.join(ROOT, "data/exports/worker-verify/environment-target-system-relations-audit.json");
const BACKUP_ROOT = path.join(ROOT, "data/exports/worker-verify/environment-target-system-relations-formal-apply-backups");

const shouldApply = process.argv.includes("--apply");

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJson(filePath, payload) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

function timestamp() {
  return new Date().toISOString().replace(/[-:.]/g, "").replace("T", "T").slice(0, 15) + "Z";
}

function backupWorkbench() {
  const backupPath = path.join(BACKUP_ROOT, `environment-workbench.before-target-system-relations-${timestamp()}.json`);
  fs.mkdirSync(path.dirname(backupPath), { recursive: true });
  fs.copyFileSync(WORKBENCH_PATH, backupPath);
  return backupPath;
}

function text(value) {
  return value == null ? "" : String(value).trim();
}

function list(value) {
  return Array.isArray(value) ? value : [];
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

function uniqueSystemEntities(items) {
  const byTitle = new Map();
  for (const item of items || []) {
    const title = text(item?.title || item?.name || item);
    if (!title) continue;
    const current = byTitle.get(title);
    const currentIsShadow = String(current?.id || "").startsWith("shadow:");
    const nextIsConcrete = item && typeof item === "object" && !String(item.id || "").startsWith("shadow:");
    if (!current || (currentIsShadow && nextIsConcrete)) byTitle.set(title, item);
  }
  return [...byTitle.values()];
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

function contextKeysForObject(environment, object) {
  const explicitContextKey = text(object?.contextKey);
  if (explicitContextKey) return [explicitContextKey];
  return list(object?.segments)
    .map((segment) => keyOf(environment?.title, segment?.title, object?.title))
    .filter((key) => key.replace(/\|/g, ""));
}

function workbenchObjects(workbench) {
  const objects = new Map();
  for (const environment of list(workbench.environment_scope_tree)) {
    for (const object of list(environment.objects)) {
      const contextKeys = contextKeysForObject(environment, object);
      for (const contextKey of contextKeys) {
        objects.set(contextKey, object);
      }
    }
  }
  return objects;
}

function matchingServices(object, expectation) {
  const services = [];
  for (const mapping of list(object?.scope_mappings)) {
    for (const service of list(mapping.services)) {
      if (text(service.code) === expectation.serviceCode || serviceCode(service.raw) === expectation.serviceCode) services.push(service);
    }
  }
  return services;
}

function matchingTargets(service, expectation) {
  const bucket = expectation.kind === "module" ? service?.modules : service?.measures;
  return list(bucket).filter((target) => text(target.title || target.name) === expectation.targetTitle);
}

function cleanDuplicateSecuritySystems(target) {
  target.systems = uniqueSystemEntities(target.systems || []);
  const systems = systemTitles(target.systems);
  const remaining = uniqueEntities(target.securitySystems || []).filter((system) => !systems.includes(text(system.title || system.name || system)));
  if (remaining.length) target.securitySystems = remaining;
  else delete target.securitySystems;
}

function objectTemplates(workbench, type) {
  const items = Object.values(workbench?.objects?.[type] || {});
  const byTitle = new Map();
  for (const item of items) {
    const title = text(item?.title || item?.name);
    if (title && !byTitle.has(title)) byTitle.set(title, item);
  }
  return byTitle;
}

function systemTemplates(workbench) {
  return objectTemplates(workbench, "security_system");
}

function sourceRefs(expectation) {
  return expectation.sourceRows.map((row) => ({
    sheet: "作用域-安全技术服务-安全技术模块映射",
    row,
    column: "安全技术模块/措施",
    cell: `G${row}`,
    raw_value: expectation.targetTitle,
  }));
}

function resolveExpectedSystems(systemTemplateByTitle, expectedSystems) {
  return expectedSystems.map((system) => {
    const title = text(system.title || system.name || system);
    return systemTemplateByTitle.get(title) || system;
  });
}

function targetTemplate(workbench, expectation) {
  const type = expectation.kind === "module" ? "security_technology_module" : "security_technical_measure";
  return objectTemplates(workbench, type).get(expectation.targetTitle);
}

function makeTarget(workbench, expectation, expectedSystems) {
  const type = expectation.kind === "module" ? "security_technology_module" : "security_technical_measure";
  const template = targetTemplate(workbench, expectation) || {};
  const target = {
    id: template.id || stableId(type, expectation.targetTitle),
    type,
    code: template.code ?? "",
    title: template.title || template.name || expectation.targetTitle,
    name: template.name || template.title || expectation.targetTitle,
    description: template.description || null,
    category: template.category || null,
    status: template.status || "normal",
    evidenceRefs: template.evidenceRefs || [],
    mapping_sources: sourceRefs(expectation),
  };
  if (expectedSystems.length) {
    target.systems = uniqueSystemEntities(expectedSystems);
    target.systemSourceRows = [...expectation.sourceRows].sort((a, b) => Number(a) - Number(b));
  }
  return target;
}

function targetRelationKey(contextKey, service, kind, target) {
  return keyOf(contextKey, text(service?.code || serviceCode(service?.raw)), kind, text(target?.title || target?.name));
}

function collectUnexpectedTargets(workbench, expectations) {
  const rows = [];
  for (const environment of list(workbench.environment_scope_tree)) {
    for (const object of list(environment.objects)) {
      const contextKeys = contextKeysForObject(environment, object);
      if (!contextKeys.length) continue;
      for (const mapping of list(object.scope_mappings)) {
        for (const service of list(mapping.services)) {
          for (const [kind, bucketName] of [
            ["module", "modules"],
            ["measure", "measures"],
          ]) {
            for (const target of list(service[bucketName])) {
              const matchingContextKey = contextKeys.find((contextKey) => expectations.has(targetRelationKey(contextKey, service, kind, target)));
              if (matchingContextKey) continue;
              rows.push({
                key: targetRelationKey(contextKeys[0], service, kind, target),
                kind,
                objectContextKeys: contextKeys,
                informationEnvironment: text(environment.title || environment.name),
                informationObject: text(object.title || object.name),
                scope: text(mapping?.scope?.title || mapping?.scope?.name || mapping?.scope?.code),
                serviceCode: text(service?.code || serviceCode(service?.raw)),
                serviceTitle: text(service?.title || service?.name),
                targetTitle: text(target?.title || target?.name),
              });
            }
          }
        }
      }
    }
  }
  return rows;
}

function pruneUnexpectedTargets(workbench, expectations) {
  let prunedUnexpectedTargets = 0;
  for (const environment of list(workbench.environment_scope_tree)) {
    for (const object of list(environment.objects)) {
      const contextKeys = contextKeysForObject(environment, object);
      if (!contextKeys.length) continue;
      for (const mapping of list(object.scope_mappings)) {
        for (const service of list(mapping.services)) {
          for (const [kind, bucketName, countName] of [
            ["module", "modules", "module_count"],
            ["measure", "measures", "measure_count"],
          ]) {
            const before = list(service[bucketName]);
            const after = before.filter((target) => contextKeys.some((contextKey) => expectations.has(targetRelationKey(contextKey, service, kind, target))));
            if (after.length !== before.length) {
              service[bucketName] = after;
              service[countName] = after.length;
              prunedUnexpectedTargets += before.length - after.length;
            }
          }
        }
      }
    }
  }
  return prunedUnexpectedTargets;
}

function auditAndApply(workbench, expectations) {
  const objects = workbenchObjects(workbench);
  const systemTemplateByTitle = systemTemplates(workbench);
  let unexpectedTargetRows = collectUnexpectedTargets(workbench, expectations);
  const prunedUnexpectedTargets = shouldApply ? pruneUnexpectedTargets(workbench, expectations) : 0;
  if (shouldApply && prunedUnexpectedTargets) unexpectedTargetRows = collectUnexpectedTargets(workbench, expectations);
  const rows = [];
  let patchedTargets = 0;
  let patchedSystems = 0;
  let cleanedDuplicateFields = 0;
  let createdTargets = 0;
  let createdTargetsWithSystems = 0;

  for (const expectation of [...expectations.values()].sort((a, b) => a.key.localeCompare(b.key, "zh-Hans-CN"))) {
    const object = objects.get(expectation.contextKey);
    const services = matchingServices(object, expectation);
    const expectedSystems = [...expectation.expectedSystems.values()];
    const resolvedExpectedSystems = resolveExpectedSystems(systemTemplateByTitle, expectedSystems);
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
          target.systems = uniqueSystemEntities([...(target.systems || []), ...resolvedExpectedSystems]);
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

    if (shouldApply && !matchedTargetCount && services.length) {
      const bucketName = expectation.kind === "module" ? "modules" : "measures";
      for (const service of services) {
        const bucket = list(service[bucketName]);
        if (bucket.some((target) => text(target.title || target.name) === expectation.targetTitle)) continue;
        bucket.push(makeTarget(workbench, expectation, resolvedExpectedSystems));
        service[bucketName] = bucket;
        if (expectation.kind === "module") service.module_count = bucket.length;
        else service.measure_count = bucket.length;
        createdTargets += 1;
        if (resolvedExpectedSystems.length) createdTargetsWithSystems += 1;
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
      unexpectedTargetKeys: unexpectedTargetRows.length,
      patchedTargets,
      patchedSystems,
      createdTargets,
      createdTargetsWithSystems,
      prunedUnexpectedTargets,
      cleanedDuplicateFields,
    },
    rows,
    unexpectedTargetRows,
  };
}

const normalizedRows = readJson(NORMALIZED_ROWS_PATH);
const workbench = readJson(WORKBENCH_PATH);
const expectations = sourceExpectations(normalizedRows);
const report = auditAndApply(workbench, expectations);

if (shouldApply) {
  const backupPath = backupWorkbench();
  report.formalApply = {
    workbenchModified: true,
    backupPath: path.relative(ROOT, backupPath),
  };
  writeJson(WORKBENCH_PATH, workbench);
} else {
  report.formalApply = {
    workbenchModified: false,
    backupPath: "",
  };
}
writeJson(REPORT_PATH, report);

console.log(JSON.stringify(report.summary, null, 2));
