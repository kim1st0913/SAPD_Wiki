import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const ROOT = process.cwd();
const DATA_DIR = path.join(ROOT, "frontend/capability-browser/public/data");
const OUT_DIR = path.join(ROOT, "data/exports/worker-verify/oi-149-p4-json-split-candidate");
const CANDIDATE_DATA_DIR = path.join(OUT_DIR, "public-data");

const FIRST_SCREEN_BUDGET_KB = 1024;
const DETAIL_PROJECTION_BUDGET_KB = 1536;

const FORBIDDEN_UI_KEYS = new Set([
  "sheet",
  "row",
  "column",
  "raw_value",
  "source_file",
  "import_id",
  "source_id",
  "source_ref",
  "source_label",
  "debug",
  "raw",
  "metadata",
  "intermediate",
  "generated_at",
  "sources",
  "sourceRows",
  "sourceCells",
  "payload",
  "workerVerifyType",
  "objectMergedRange",
  "scopeMergedRange",
  "serviceMergedRange",
  "moduleMergedRange",
  "measureMergedRange",
]);

const SOURCE_PACKAGES = {
  "capability-tree": "capability-tree.json",
  "capability-workbench": "capability-workbench.json",
  "environment-workbench": "environment-workbench.json",
  "maintenance-index": "maintenance-index.json",
  "maintenance-knowledge": "maintenance-knowledge.json",
  "shared-lookups": "shared-lookups.json",
  "lifecycle-workbench": "lifecycle-workbench.json",
  "standards-index": "standards-index.json",
};

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(DATA_DIR, relativePath), "utf8"));
}

function writeJson(relativePath, value) {
  const filePath = path.join(CANDIDATE_DATA_DIR, relativePath);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  return filePath;
}

function sha256File(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

function sizeKb(filePath) {
  return Math.round((fs.statSync(filePath).size / 1024) * 10) / 10;
}

function safeName(value) {
  return String(value || "unknown").replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 140);
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function asObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function compactText(value, limit = 360) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  return text.length > limit ? `${text.slice(0, limit)}...` : text;
}

function sanitizeUiValue(value) {
  if (Array.isArray(value)) {
    return value.map(sanitizeUiValue).filter((item) => item !== undefined);
  }
  if (!value || typeof value !== "object") return value;
  const result = {};
  for (const [key, child] of Object.entries(value)) {
    if (FORBIDDEN_UI_KEYS.has(key)) continue;
    const sanitized = sanitizeUiValue(child);
    if (sanitized !== undefined) result[key] = sanitized;
  }
  return result;
}

function objectSummary(item, options = {}) {
  if (!item || typeof item !== "object") return null;
  const summary = {
    id: item.id || "",
    type: item.type || "",
    code: item.code || "",
    title: item.title || item.name || "",
    name: item.name || item.title || "",
    category: item.category || "",
    status: item.status || "",
  };
  if (item.contextKey) summary.contextKey = item.contextKey;
  if (item.text) summary.text = item.text;
  if (options.includeDescription && item.description) {
    summary.description = compactText(item.description, 720);
  }
  return sanitizeUiValue(summary);
}

function relationSummary(item) {
  return sanitizeUiValue({
    id: item.id || "",
    type: item.type || "",
    sourceId: item.sourceId || "",
    sourceType: item.sourceType || "",
    targetId: item.targetId || "",
    targetType: item.targetType || "",
    label: item.label || "",
    status: item.status || "",
    confidence: item.confidence || "",
    objectContextKey: item.objectContextKey || "",
    evidenceRefCount: asArray(item.evidenceRefs).length,
  });
}

function treeSummary(node) {
  return sanitizeUiValue({
    id: node.id || "",
    type: node.type || "",
    code: node.code || "",
    name: node.name || node.title || "",
    title: node.title || node.name || "",
    children: asArray(node.children).map(treeSummary),
  });
}

function flattenTree(nodes, ancestors = []) {
  const result = [];
  for (const node of asArray(nodes)) {
    const current = { node, ancestors };
    result.push(current);
    result.push(...flattenTree(node.children, [...ancestors, node]));
  }
  return result;
}

function collectDescendants(node, predicate) {
  const result = [];
  function walk(item) {
    if (!item) return;
    if (!predicate || predicate(item)) result.push(item);
    for (const child of asArray(item.children)) walk(child);
  }
  walk(node);
  return result;
}

function objectIndexes(objects) {
  const byId = new Map();
  for (const [type, group] of Object.entries(asObject(objects))) {
    for (const item of Object.values(asObject(group))) {
      byId.set(item.id, { ...item, type: item.type || type });
    }
  }
  return byId;
}

function closureFromRelations(relations, seedIds, rounds = 2, relationFilter = () => true) {
  const ids = new Set(seedIds);
  const selectedRelations = new Map();
  for (let round = 0; round < rounds; round += 1) {
    const snapshot = new Set(ids);
    let changed = false;
    for (const relation of relations) {
      if (!relationFilter(relation)) continue;
      const hit = snapshot.has(relation.sourceId) || snapshot.has(relation.targetId);
      if (!hit) continue;
      selectedRelations.set(relation.id || `${relation.type}:${relation.sourceId}:${relation.targetId}`, relation);
      for (const id of [relation.sourceId, relation.targetId]) {
        if (id && !ids.has(id)) {
          ids.add(id);
          changed = true;
        }
      }
    }
    if (!changed) break;
  }
  return { ids, relations: [...selectedRelations.values()] };
}

function addRelationToProjection(relation, relationMap, idSet) {
  if (!relation) return;
  relationMap.set(relation.id || `${relation.type}:${relation.sourceId}:${relation.targetId}`, relation);
  if (relation.sourceId) idSet.add(relation.sourceId);
  if (relation.targetId) idSet.add(relation.targetId);
}

function capabilityDirectedProjection(relations, focusIds, hierarchyIds) {
  const focusSet = new Set(focusIds);
  const serviceIds = new Set();
  const workOrProcessIds = new Set();
  const relationMap = new Map();
  const ids = new Set([...focusIds, ...hierarchyIds]);

  for (const relation of relations) {
    if (relation.type === "belongs_to" && (hierarchyIds.has(relation.sourceId) || hierarchyIds.has(relation.targetId))) {
      addRelationToProjection(relation, relationMap, ids);
      continue;
    }
    if (relation.type === "supports_focus" && focusSet.has(relation.targetId)) {
      serviceIds.add(relation.sourceId);
      addRelationToProjection(relation, relationMap, ids);
      continue;
    }
    if (["maps_to_work", "maps_to_process", "maps_to_standard"].includes(relation.type) && focusSet.has(relation.sourceId)) {
      if (["maps_to_work", "maps_to_process"].includes(relation.type)) workOrProcessIds.add(relation.targetId);
      addRelationToProjection(relation, relationMap, ids);
    }
  }

  for (const relation of relations) {
    if (["applies_to_scope", "implemented_by_module", "has_measure"].includes(relation.type) && serviceIds.has(relation.sourceId)) {
      addRelationToProjection(relation, relationMap, ids);
      continue;
    }
    if (relation.type === "stakeholder_by" && (workOrProcessIds.has(relation.sourceId) || workOrProcessIds.has(relation.targetId))) {
      addRelationToProjection(relation, relationMap, ids);
    }
  }

  return { ids, relations: [...relationMap.values()] };
}

function groupedObjectsForIds(objectsById, ids, selectedId = "") {
  const grouped = {};
  for (const id of ids) {
    const item = objectsById.get(id);
    if (!item) continue;
    grouped[item.type] ||= {};
    grouped[item.type][id] = objectSummary(item, { includeDescription: id === selectedId });
  }
  return grouped;
}

function flattenEvidenceRefs(workbench) {
  return {
    packageType: "oi-149-candidate-evidence",
    dataState: "candidate",
    note: "候选 evidence 包仅用于 P4 拆包评估；正式 UI 首屏 / projection 不应直接加载该文件。",
    evidenceRefs: asArray(workbench.evidenceRefs),
  };
}

function writeBudgeted(relativePath, value, records, options = {}) {
  const filePath = writeJson(relativePath, value);
  records.push({
    path: relativePath,
    sizeKB: sizeKb(filePath),
    category: options.category || "candidate",
    budgetKB: options.budgetKB || null,
    budgetStatus: options.budgetKB ? (sizeKb(filePath) <= options.budgetKB ? "pass" : "fail") : "not_applicable",
    firstScreen: Boolean(options.firstScreen),
    detailProjection: Boolean(options.detailProjection),
    evidence: Boolean(options.evidence),
  });
  return filePath;
}

function buildCapabilityCandidate(records) {
  const tree = readJson("capability-tree.json");
  const workbench = readJson("capability-workbench.json");
  const objectsById = objectIndexes(workbench.objects);
  const treeRows = flattenTree(workbench.navigator?.tree || []);
  const projectionIndex = [];

  for (const row of treeRows) {
    const focusIds = collectDescendants(row.node, (item) => item.type === "capability_focus").map((item) => item.id);
    const hierarchyIds = new Set([row.node.id, ...row.ancestors.map((item) => item.id)]);
    const { ids, relations } = capabilityDirectedProjection(asArray(workbench.relations), focusIds, hierarchyIds);
    const projection = {
      packageType: "oi-149-capability-object-projection-candidate",
      dataState: "candidate",
      selected: objectSummary(objectsById.get(row.node.id) || row.node, { includeDescription: true }),
      ancestorIds: row.ancestors.map((item) => item.id),
      focusIds,
      focusCount: focusIds.length,
      objects: groupedObjectsForIds(objectsById, ids, row.node.id),
      relations: relations.map(relationSummary),
      relationCount: relations.length,
    };
    if (focusIds.length > 50) {
      const standardControls = projection.objects.standard_control || {};
      const standardRelationCount = projection.relations.filter((relation) => relation.type === "maps_to_standard").length;
      delete projection.objects.standard_control;
      projection.relations = projection.relations.filter((relation) => relation.type !== "maps_to_standard");
      projection.relationCount = projection.relations.length;
      projection.deferred = {
        reason: "上层能力概览超过对象详情预算，标准控制项明细按子能力 / 关注点 projection 延迟加载。",
        standardControlCount: Object.keys(standardControls).length,
        standardRelationCount,
      };
    }
    const relativePath = `capability/projections/${safeName(row.node.id)}.json`;
    writeBudgeted(relativePath, projection, records, {
      category: "capabilityProjection",
      detailProjection: true,
      budgetKB: DETAIL_PROJECTION_BUDGET_KB,
    });
    projectionIndex.push({
      id: row.node.id,
      type: row.node.type,
      code: row.node.code || "",
      title: row.node.name || row.node.title || "",
      focusCount: focusIds.length,
      path: relativePath,
    });
  }

  const index = {
    packageType: "oi-149-capability-index-candidate",
    dataState: "candidate",
    stats: sanitizeUiValue({ ...tree.stats, ...(workbench.meta?.stats || {}) }),
    defaultSelectedFocusId: workbench.navigator?.defaultSelectedFocusId || "",
    tree: asArray(workbench.navigator?.tree).map(treeSummary),
    projections: projectionIndex,
  };
  writeBudgeted("capability/index.json", index, records, {
    category: "capabilityIndex",
    firstScreen: true,
    budgetKB: FIRST_SCREEN_BUDGET_KB,
  });
  writeBudgeted("capability/evidence.json", flattenEvidenceRefs(workbench), records, {
    category: "capabilityEvidence",
    evidence: true,
  });
}

function environmentContextIndex(workbench) {
  const byContextKey = new Map();
  for (const item of Object.values(asObject(workbench.objects?.information_object))) {
    if (item.contextKey) byContextKey.set(item.contextKey, item);
  }
  const scopeTreeByContextKey = new Map();
  for (const env of asArray(workbench.environment_scope_tree)) {
    for (const object of asArray(env.objects)) {
      if (object.contextKey) scopeTreeByContextKey.set(object.contextKey, object);
    }
  }
  return { byContextKey, scopeTreeByContextKey };
}

function annotateEnvironmentNav(nodes, pathParts = [], contextIndex = null) {
  return asArray(nodes).map((node) => {
    const title = node.name || node.title || "";
    const nextPath = [...pathParts, title];
    const result = treeSummary(node);
    if (node.type === "information_object" && nextPath.length >= 3 && contextIndex) {
      const contextKey = `${nextPath[0]}||${nextPath[1]}||${nextPath[2]}`;
      const objectContext = contextIndex.byContextKey.get(contextKey);
      result.contextKey = contextKey;
      result.objectContextId = objectContext?.id || "";
    }
    result.children = annotateEnvironmentNav(node.children, nextPath, contextIndex);
    return result;
  });
}

function flattenEnvironmentNav(nodes, ancestors = []) {
  const result = [];
  for (const node of asArray(nodes)) {
    const nextAncestors = [...ancestors, node];
    result.push({ node, ancestors });
    result.push(...flattenEnvironmentNav(node.children, nextAncestors));
  }
  return result;
}

function environmentObjectContextsForNav(row, contextIndex) {
  const objectNodes = collectDescendants(row.node, (item) => item.type === "information_object");
  const contexts = [];
  for (const objectNode of objectNodes) {
    const titles = [...row.ancestors, row.node]
      .filter((item) => item.type !== "information_object")
      .map((item) => item.name || item.title || "");
    const objectTitle = objectNode.name || objectNode.title || "";
    let contextKey = "";
    if (row.node.type === "information_environment") {
      const segment = objectNode.__segmentTitle || "";
      contextKey = `${titles[0]}||${segment}||${objectTitle}`;
    }
    if (!contextKey) {
      const pathTitles = [...row.ancestors, row.node, objectNode].map((item) => item.name || item.title || "");
      contextKey = `${pathTitles[0]}||${pathTitles[1]}||${objectTitle}`;
    }
    const match = contextIndex.byContextKey.get(contextKey);
    if (match) contexts.push(match);
  }
  return contexts;
}

function collectEnvironmentObjectsUnder(node, ancestors = [], contextIndex) {
  const contexts = [];
  function walk(item, pathItems) {
    if (!item) return;
    if (item.type === "information_object") {
      const titles = pathItems.map((entry) => entry.name || entry.title || "");
      const contextKey = `${titles[0]}||${titles[1]}||${item.name || item.title || ""}`;
      const match = contextIndex.byContextKey.get(contextKey);
      if (match) contexts.push(match);
      return;
    }
    for (const child of asArray(item.children)) walk(child, [...pathItems, item]);
  }
  walk(node, ancestors);
  return contexts;
}

function buildEnvironmentCandidate(records) {
  const workbench = readJson("environment-workbench.json");
  const objectsById = objectIndexes(workbench.objects);
  const contextIndex = environmentContextIndex(workbench);
  const navRows = flattenEnvironmentNav(workbench.navigator?.tree || []);
  const projectionIndex = [];

  for (const row of navRows) {
    const objectContexts = collectEnvironmentObjectsUnder(row.node, row.ancestors, contextIndex);
    const contextKeys = new Set(objectContexts.map((item) => item.contextKey).filter(Boolean));
    const seedIds = new Set([row.node.id, ...row.ancestors.map((item) => item.id), ...objectContexts.map((item) => item.id)]);
    const relations = asArray(workbench.relations).filter((relation) => {
      return (
        seedIds.has(relation.sourceId) ||
        seedIds.has(relation.targetId) ||
        (relation.objectContextKey && contextKeys.has(relation.objectContextKey))
      );
    });
    for (const relation of relations) {
      if (relation.sourceId) seedIds.add(relation.sourceId);
      if (relation.targetId) seedIds.add(relation.targetId);
    }
    const scopeTreeObjects = [...contextKeys]
      .map((key) => contextIndex.scopeTreeByContextKey.get(key))
      .filter(Boolean)
      .map(sanitizeUiValue);
    const projection = {
      packageType: "oi-149-environment-object-projection-candidate",
      dataState: "candidate",
      selectedNavigation: sanitizeUiValue({
        id: row.node.id,
        type: row.node.type,
        code: row.node.code || "",
        title: row.node.name || row.node.title || "",
      }),
      ancestorNavigation: row.ancestors.map((item) =>
        sanitizeUiValue({ id: item.id, type: item.type, code: item.code || "", title: item.name || item.title || "" })
      ),
      objectContextIds: objectContexts.map((item) => item.id),
      contextKeys: [...contextKeys],
      objects: groupedObjectsForIds(objectsById, seedIds, row.node.id),
      objectScopeTree: scopeTreeObjects,
      relations: relations.map(relationSummary),
      relationCount: relations.length,
    };
    const relativePath = `environment/projections/${safeName(row.node.id)}.json`;
    writeBudgeted(relativePath, projection, records, {
      category: "environmentProjection",
      detailProjection: true,
      budgetKB: DETAIL_PROJECTION_BUDGET_KB,
    });
    projectionIndex.push({
      id: row.node.id,
      type: row.node.type,
      code: row.node.code || "",
      title: row.node.name || row.node.title || "",
      objectContextCount: objectContexts.length,
      path: relativePath,
    });
  }

  const navigator = {
    packageType: "oi-149-environment-navigator-candidate",
    dataState: "candidate",
    stats: sanitizeUiValue(workbench.meta?.stats || {}),
    defaultSelectedObjectId: workbench.navigator?.defaultSelectedObjectId || "",
    tree: annotateEnvironmentNav(workbench.navigator?.tree || [], [], contextIndex),
    projections: projectionIndex,
  };
  writeBudgeted("environment/navigator.json", navigator, records, {
    category: "environmentNavigator",
    firstScreen: true,
    budgetKB: FIRST_SCREEN_BUDGET_KB,
  });
  writeBudgeted("environment/evidence.json", flattenEvidenceRefs(workbench), records, {
    category: "environmentEvidence",
    evidence: true,
  });
}

function buildLifecycleCandidate(records) {
  const workbench = readJson("lifecycle-workbench.json");
  const objectsById = objectIndexes(workbench.objects);
  const navRows = flattenTree(workbench.navigator?.tree || []);
  const projectionIndex = [];

  for (const row of navRows) {
    const stageIds = collectDescendants(row.node, (item) => item.type === "lifecycle_stage").map((item) => item.id);
    const seedIds = new Set([row.node.id, ...row.ancestors.map((item) => item.id), ...stageIds]);
    const { ids, relations } = closureFromRelations(asArray(workbench.relations), seedIds, 2);
    const projection = {
      packageType: "oi-149-lifecycle-process-projection-candidate",
      dataState: "candidate",
      selected: objectSummary(objectsById.get(row.node.id) || row.node, { includeDescription: true }),
      stageIds,
      objects: groupedObjectsForIds(objectsById, ids, row.node.id),
      relations: relations.map(relationSummary),
      relationCount: relations.length,
    };
    const relativePath = `lifecycle/projections/${safeName(row.node.id)}.json`;
    writeBudgeted(relativePath, projection, records, {
      category: "lifecycleProjection",
      detailProjection: true,
      budgetKB: DETAIL_PROJECTION_BUDGET_KB,
    });
    projectionIndex.push({
      id: row.node.id,
      type: row.node.type,
      code: row.node.code || "",
      title: row.node.name || row.node.title || "",
      stageCount: stageIds.length,
      path: relativePath,
    });
  }

  const index = {
    packageType: "oi-149-lifecycle-index-candidate",
    dataState: "candidate",
    stats: sanitizeUiValue(workbench.meta?.stats || {}),
    tree: asArray(workbench.navigator?.tree).map(treeSummary),
    projections: projectionIndex,
  };
  writeBudgeted("lifecycle/index.json", index, records, {
    category: "lifecycleIndex",
    firstScreen: true,
    budgetKB: FIRST_SCREEN_BUDGET_KB,
  });
  writeBudgeted("lifecycle/evidence.json", flattenEvidenceRefs(workbench), records, {
    category: "lifecycleEvidence",
    evidence: true,
  });
}

function buildMaintenanceCandidate(records) {
  const index = sanitizeUiValue(readJson("maintenance-index.json"));
  writeBudgeted("maintenance/index.json", {
    packageType: "oi-149-maintenance-index-candidate",
    dataState: "candidate",
    ...index,
  }, records, {
    category: "maintenanceIndex",
    firstScreen: true,
    budgetKB: FIRST_SCREEN_BUDGET_KB,
  });

  const sectionDir = path.join(DATA_DIR, "maintenance");
  for (const fileName of fs.readdirSync(sectionDir).filter((name) => name.endsWith(".json")).sort()) {
    const relative = `maintenance/sections/${fileName}`;
    writeBudgeted(relative, sanitizeUiValue(readJson(`maintenance/${fileName}`)), records, {
      category: "maintenanceSection",
      detailProjection: true,
      budgetKB: DETAIL_PROJECTION_BUDGET_KB,
    });
  }
}

function buildSharedLookupCandidate(records) {
  const shared = readJson("shared-lookups.json");
  const serviceModuleIndex = asArray(shared.service_module_index).map((entry) => sanitizeUiValue(entry));
  writeBudgeted("shared-lookups/service-module-index.json", {
    packageType: "oi-149-shared-lookup-service-module-index-candidate",
    dataState: "candidate",
    stats: { serviceModuleIndex: serviceModuleIndex.length },
    serviceModuleIndex,
  }, records, {
    category: "sharedLookup",
    firstScreen: true,
    budgetKB: FIRST_SCREEN_BUDGET_KB,
  });
}

function buildStandardsCandidate(records) {
  const index = sanitizeUiValue(readJson("standards-index.json"));
  writeBudgeted("standards/index.json", {
    packageType: "oi-149-standards-index-candidate",
    dataState: "candidate",
    ...index,
  }, records, {
    category: "standardsIndex",
    firstScreen: true,
    budgetKB: FIRST_SCREEN_BUDGET_KB,
  });
}

function scanForbiddenKeys(value) {
  const hits = {};
  function walk(item) {
    if (Array.isArray(item)) {
      for (const child of item) walk(child);
      return;
    }
    if (!item || typeof item !== "object") return;
    for (const [key, child] of Object.entries(item)) {
      if (FORBIDDEN_UI_KEYS.has(key)) hits[key] = (hits[key] || 0) + 1;
      walk(child);
    }
  }
  walk(value);
  return hits;
}

function auditGeneratedFiles(records) {
  const fieldBoundaryFailures = [];
  for (const record of records) {
    if (record.evidence) continue;
    const value = JSON.parse(fs.readFileSync(path.join(CANDIDATE_DATA_DIR, record.path), "utf8"));
    const hits = scanForbiddenKeys(value);
    if (Object.keys(hits).length) {
      fieldBoundaryFailures.push({ path: record.path, hits });
    }
  }
  const firstScreenFailures = records.filter((record) => record.firstScreen && record.sizeKB > FIRST_SCREEN_BUDGET_KB);
  const detailProjectionFailures = records.filter(
    (record) => record.detailProjection && record.sizeKB > DETAIL_PROJECTION_BUDGET_KB
  );
  return {
    result: firstScreenFailures.length || detailProjectionFailures.length || fieldBoundaryFailures.length ? "fail" : "pass",
    budgets: {
      firstScreenBudgetKB: FIRST_SCREEN_BUDGET_KB,
      detailProjectionBudgetKB: DETAIL_PROJECTION_BUDGET_KB,
      firstScreenFailures,
      detailProjectionFailures,
      maxFirstScreenKB: Math.max(...records.filter((item) => item.firstScreen).map((item) => item.sizeKB), 0),
      maxDetailProjectionKB: Math.max(...records.filter((item) => item.detailProjection).map((item) => item.sizeKB), 0),
    },
    fieldBoundary: {
      checkedFiles: records.filter((item) => !item.evidence).length,
      skippedEvidenceFiles: records.filter((item) => item.evidence).length,
      failures: fieldBoundaryFailures,
    },
  };
}

function writeMarkdown(manifest, audit) {
  const lines = [
    "# OI-149 P4 JSON Split Candidate",
    "",
    "本目录是候选拆包产物，不是正式运行包；本轮没有覆盖 `frontend/capability-browser/public/data/*.json`。",
    "",
    "## Readiness",
    "",
    `- result: \`${audit.result}\``,
    `- firstScreenBudgetKB: \`${audit.budgets.firstScreenBudgetKB}\``,
    `- detailProjectionBudgetKB: \`${audit.budgets.detailProjectionBudgetKB}\``,
    `- maxFirstScreenKB: \`${audit.budgets.maxFirstScreenKB}\``,
    `- maxDetailProjectionKB: \`${audit.budgets.maxDetailProjectionKB}\``,
    `- fieldBoundaryFailures: \`${audit.fieldBoundary.failures.length}\``,
    "",
    "## Candidate Packages",
    "",
    "| package | category | sizeKB | budget | status |",
    "|---|---:|---:|---:|---|",
    ...manifest.files
      .filter((item) => item.firstScreen || item.detailProjection)
      .slice()
      .sort((a, b) => b.sizeKB - a.sizeKB)
      .map((item) => `| \`${item.path}\` | ${item.category} | ${item.sizeKB} | ${item.budgetKB || ""} | ${item.budgetStatus} |`),
    "",
    "## Formal Apply Boundary",
    "",
    "- formalApplyRequired: `false`",
    "- formalPublicDataModified: `false`",
    "- nextStep: 先评审候选结构、预算和页面影响，再决定是否进入 apply 设计。",
    "",
  ];
  fs.writeFileSync(path.join(OUT_DIR, "candidate-readiness.md"), `${lines.join("\n")}\n`, "utf8");
}

function main() {
  fs.rmSync(OUT_DIR, { recursive: true, force: true });
  fs.mkdirSync(CANDIDATE_DATA_DIR, { recursive: true });

  const records = [];
  buildCapabilityCandidate(records);
  buildEnvironmentCandidate(records);
  buildLifecycleCandidate(records);
  buildMaintenanceCandidate(records);
  buildSharedLookupCandidate(records);
  buildStandardsCandidate(records);

  const sourcePackages = Object.fromEntries(
    Object.entries(SOURCE_PACKAGES).map(([name, relativePath]) => {
      const filePath = path.join(DATA_DIR, relativePath);
      return [
        name,
        {
          path: `frontend/capability-browser/public/data/${relativePath}`,
          sizeKB: sizeKb(filePath),
          sha256: sha256File(filePath),
        },
      ];
    })
  );
  const audit = auditGeneratedFiles(records);
  const manifest = {
    packageType: "oi-149-p4-json-split-candidate-manifest",
    dataState: "candidate",
    generatedAt: new Date().toISOString(),
    candidateDir: path.relative(ROOT, OUT_DIR),
    formalApplyRequired: false,
    formalPublicDataModified: false,
    sourcePackages,
    files: records,
    audit,
  };
  fs.writeFileSync(path.join(OUT_DIR, "candidate-manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  fs.writeFileSync(path.join(OUT_DIR, "candidate-readiness.json"), `${JSON.stringify(audit, null, 2)}\n`, "utf8");
  writeMarkdown(manifest, audit);
  console.log(JSON.stringify({
    result: audit.result,
    candidateDir: path.relative(ROOT, OUT_DIR),
    fileCount: records.length,
    maxFirstScreenKB: audit.budgets.maxFirstScreenKB,
    maxDetailProjectionKB: audit.budgets.maxDetailProjectionKB,
    fieldBoundaryFailures: audit.fieldBoundary.failures.length,
  }, null, 2));
  if (audit.result !== "pass") process.exitCode = 1;
}

main();
