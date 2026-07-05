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
  "mapping_sources",
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

function shortHash(value, length = 12) {
  return crypto.createHash("sha1").update(String(value || "")).digest("hex").slice(0, length);
}

function duplicateValues(values) {
  const counts = new Map();
  for (const value of values.filter(Boolean)) counts.set(value, (counts.get(value) || 0) + 1);
  return [...counts.entries()]
    .filter(([, count]) => count > 1)
    .map(([value, count]) => ({ value, count }));
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

function treeSummary(node, objectsById = null) {
  const item = objectsById?.get?.(node.id) || node;
  const summary = {
    id: node.id || item.id || "",
    type: node.type || item.type || "",
    code: node.code || item.code || "",
    name: node.name || node.title || item.name || item.title || "",
    title: node.title || node.name || item.title || item.name || "",
    children: asArray(node.children).map((child) => treeSummary(child, objectsById)),
  };
  if (item.description) summary.description = compactText(item.description, 720);
  return sanitizeUiValue(summary);
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

function capabilityChildOverview(node) {
  return asArray(node.children).map((child) =>
    sanitizeUiValue({
      id: child.id || "",
      type: child.type || "",
      code: child.code || "",
      title: child.name || child.title || "",
      focusCount: collectDescendants(child, (item) => item.type === "capability_focus").length,
      childCount: asArray(child.children).length,
    })
  );
}

function capabilityCoverageSummary(relations, focusIds) {
  const focusSet = new Set(focusIds);
  const technicalServices = new Set();
  const scopeTypes = new Set();
  const managementWorks = new Set();
  const processReferences = new Set();
  const standardControls = new Set();
  const modules = new Set();
  const measures = new Set();

  for (const relation of relations) {
    if (relation.type === "supports_focus" && focusSet.has(relation.targetId)) technicalServices.add(relation.sourceId);
    if (relation.type === "maps_to_work" && focusSet.has(relation.sourceId)) managementWorks.add(relation.targetId);
    if (relation.type === "maps_to_process" && focusSet.has(relation.sourceId)) processReferences.add(relation.targetId);
    if (relation.type === "maps_to_standard" && focusSet.has(relation.sourceId)) standardControls.add(relation.targetId);
  }
  for (const relation of relations) {
    if (relation.type === "applies_to_scope" && technicalServices.has(relation.sourceId)) scopeTypes.add(relation.targetId);
    if (relation.type === "implemented_by_module" && technicalServices.has(relation.sourceId)) modules.add(relation.targetId);
    if (relation.type === "has_measure" && technicalServices.has(relation.sourceId)) measures.add(relation.targetId);
  }

  return sanitizeUiValue({
    focusCount: focusIds.length,
    technicalServiceCount: technicalServices.size,
    scopeTypeCount: scopeTypes.size,
    managementWorkCount: managementWorks.size,
    processReferenceCount: processReferences.size,
    standardControlCount: standardControls.size,
    moduleCount: modules.size,
    measureCount: measures.size,
  });
}

function capabilityProjectionMode(node, focusIds, relations) {
  if (["capability_category", "capability_domain"].includes(node?.type)) return "overview";
  if (node?.type === "capability" && (focusIds.length > 8 || relations.length > 420)) return "mixed_summary";
  return "detail";
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
    packageType: "oi-149-p4-runtime-evidence",
    dataState: "ready",
    note: "Evidence 包仅用于 P4 拆包后的详情、审计或追溯；正式 UI 首屏 / projection 不应直接加载该文件。",
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
    const detailMode = capabilityProjectionMode(row.node, focusIds, relations);
    const baseProjection = {
      packageType: "oi-149-p4-capability-object-projection",
      dataState: "ready",
      detailMode,
      selected: objectSummary(objectsById.get(row.node.id) || row.node, { includeDescription: true }),
      ancestorIds: row.ancestors.map((item) => item.id),
      focusIds,
      focusCount: focusIds.length,
      childOverview: capabilityChildOverview(row.node),
      coverageSummary: capabilityCoverageSummary(asArray(workbench.relations), focusIds),
    };
    let projection = {
      ...baseProjection,
      objects: groupedObjectsForIds(objectsById, ids, row.node.id),
      relations: relations.map(relationSummary),
      relationCount: relations.length,
    };

    if (detailMode !== "detail") {
      projection = {
        ...baseProjection,
        relationCount: relations.length,
        deferred: {
          reason:
            detailMode === "overview"
              ? "L0 / L1 能力层级只生成总览型 projection；标准控制项、技术映射明细和管理映射明细按 L2 / 关注点延迟加载。"
              : "该 L2 能力明细超过候选阈值，默认生成汇总 projection；关注点 projection 保留完整明细。",
          technicalMappingRows: true,
          managementMappingRows: true,
          standardMappingRows: true,
          standardControls: true,
        },
      };
    } else if (focusIds.length > 50) {
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
      detailMode,
      path: relativePath,
    });
  }

  const index = {
    packageType: "oi-149-p4-capability-index",
    dataState: "ready",
    stats: sanitizeUiValue({ ...tree.stats, ...(workbench.meta?.stats || {}) }),
    defaultSelectedFocusId: workbench.navigator?.defaultSelectedFocusId || "",
    tree: asArray(workbench.navigator?.tree).map((node) => treeSummary(node, objectsById)),
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
  const scopeTreeByContextKey = new Map();
  for (const env of asArray(workbench.environment_scope_tree)) {
    for (const object of asArray(env.objects)) {
      for (const segment of asArray(object.segments)) {
        const contextKey = [env.title, segment.title, object.title].map((item) => String(item || "").trim()).join("||");
        if (!contextKey.replace(/\|/g, "")) continue;
        const contextObject = {
          ...object,
          contextKey,
          environmentId: env.id || "",
          environmentTitle: env.title || "",
          segmentId: segment.id || "",
          segmentTitle: segment.title || "",
          segments: [segment],
        };
        byContextKey.set(contextKey, contextObject);
        scopeTreeByContextKey.set(contextKey, contextObject);
      }
    }
  }
  return { byContextKey, scopeTreeByContextKey };
}

function navTitle(node) {
  return node?.name || node?.title || "";
}

function environmentNavigationPath(row) {
  return [...row.ancestors, row.node].map((item, index) =>
    sanitizeUiValue({
      depth: index,
      id: item.id || "",
      type: item.type || "",
      code: item.code || "",
      title: navTitle(item),
    })
  );
}

function environmentContextIdentity(contextKeys) {
  if (!contextKeys.length) return "no-context";
  if (contextKeys.length === 1) return contextKeys[0];
  return `contexts-${contextKeys.length}-${shortHash(contextKeys.join("|"))}`;
}

function uniqueProjectionKey(rawParts, usedKeys) {
  const raw = rawParts.filter(Boolean).join("__") || "environment-navigation";
  const compactBase = safeName(raw).replace(/^_+|_+$/g, "").slice(0, 100) || "environment-navigation";
  const base = `${compactBase}__${shortHash(raw)}`;
  let key = base;
  let suffix = 2;
  while (usedKeys.has(key)) {
    key = `${base}__${suffix}`;
    suffix += 1;
  }
  usedKeys.add(key);
  return key;
}

function environmentProjectionIdentity(row, navOrdinal, objectContexts, usedKeys) {
  const pathTitles = [...row.ancestors, row.node].map(navTitle);
  const contextKeys = [...new Set(objectContexts.map((item) => item.contextKey).filter(Boolean))].sort();
  const contextPart = environmentContextIdentity(contextKeys);
  const node = row.node || {};
  let rawParts = [node.type || "environment_node", pathTitles.join("||"), node.id || ""];

  if (node.type === "information_environment") {
    rawParts = [node.type, pathTitles[0] || navTitle(node), node.id || ""];
  } else if (node.type === "environment_segment") {
    rawParts = [node.type, pathTitles[0] || "", pathTitles[1] || navTitle(node), contextPart, node.id || ""];
  } else if (node.type === "information_object") {
    rawParts = [node.type, contextPart, node.id || ""];
  }

  const projectionKey = uniqueProjectionKey(rawParts, usedKeys);
  return {
    navOrdinal,
    projectionKey,
    path: `environment/projections/${projectionKey}.json`,
    navigationPath: environmentNavigationPath(row),
    contextKeys,
    objectContextIds: objectContexts.map((item) => item.id).filter(Boolean),
  };
}

function annotateEnvironmentNav(nodes, projectionByOrdinal = new Map(), contextIndex = null, state = { ordinal: 0 }, pathParts = []) {
  return asArray(nodes).map((node) => {
    const title = navTitle(node);
    const nextPath = [...pathParts, title];
    const navOrdinal = state.ordinal;
    state.ordinal += 1;
    const result = treeSummary(node);
    const projection = projectionByOrdinal.get(navOrdinal);
    if (projection) {
      result.navOrdinal = navOrdinal;
      result.projectionKey = projection.projectionKey;
      result.projectionPath = projection.path;
      result.navigationPath = projection.navigationPath;
    }
    if (node.type === "information_object" && nextPath.length >= 3 && contextIndex) {
      const contextKey = projection?.contextKeys?.[0] || `${nextPath[0]}||${nextPath[1]}||${nextPath[2]}`;
      const objectContext = contextIndex.byContextKey.get(contextKey);
      result.contextKey = contextKey;
      result.objectContextId = projection?.objectContextIds?.[0] || objectContext?.id || "";
    }
    result.children = annotateEnvironmentNav(node.children, projectionByOrdinal, contextIndex, state, nextPath);
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
  const projectionByOrdinal = new Map();
  const usedProjectionKeys = new Set();

  navRows.forEach((row, navOrdinal) => {
    const objectContexts = collectEnvironmentObjectsUnder(row.node, row.ancestors, contextIndex);
    const contextKeys = new Set(objectContexts.map((item) => item.contextKey).filter(Boolean));
    const projectionIdentity = environmentProjectionIdentity(row, navOrdinal, objectContexts, usedProjectionKeys);
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
    const projectionRelations =
      row.node?.type === "information_environment"
        ? relations.filter((relation) => ["contains_segment", "contains_object"].includes(relation.type))
        : relations;
    const projection = {
      packageType: "oi-149-p4-environment-object-projection",
      dataState: "ready",
      navOrdinal,
      projectionKey: projectionIdentity.projectionKey,
      projectionPath: projectionIdentity.path,
      navigationPath: projectionIdentity.navigationPath,
      selectedNavigation: sanitizeUiValue({
        id: row.node.id,
        type: row.node.type,
        code: row.node.code || "",
        title: row.node.name || row.node.title || "",
        navOrdinal,
        projectionKey: projectionIdentity.projectionKey,
        projectionPath: projectionIdentity.path,
      }),
      ancestorNavigation: row.ancestors.map((item) =>
        sanitizeUiValue({ id: item.id, type: item.type, code: item.code || "", title: item.name || item.title || "" })
      ),
      objectContextIds: objectContexts.map((item) => item.id),
      contextKeys: [...contextKeys],
      objects: groupedObjectsForIds(objectsById, seedIds, row.node.id),
      objectScopeTree: scopeTreeObjects,
      relations: projectionRelations.map(relationSummary),
      relationCount: projectionRelations.length,
    };
    if (projectionRelations.length !== relations.length) {
      projection.deferred = {
        reason: "顶层环境 projection 保留对象安全映射事实树和结构关系；服务级关系图明细按子类 / 对象 projection 延迟加载。",
        deferredRelationCount: relations.length - projectionRelations.length,
      };
    }
    writeBudgeted(projectionIdentity.path, projection, records, {
      category: "environmentProjection",
      detailProjection: true,
      budgetKB: DETAIL_PROJECTION_BUDGET_KB,
    });
    projectionByOrdinal.set(navOrdinal, projectionIdentity);
    projectionIndex.push({
      navOrdinal,
      id: row.node.id,
      type: row.node.type,
      code: row.node.code || "",
      title: row.node.name || row.node.title || "",
      projectionKey: projectionIdentity.projectionKey,
      navigationPath: projectionIdentity.navigationPath,
      objectContextIds: projectionIdentity.objectContextIds,
      objectContextCount: objectContexts.length,
      path: projectionIdentity.path,
    });
  });

  const navigator = {
    packageType: "oi-149-p4-environment-navigator",
    dataState: "ready",
    stats: sanitizeUiValue(workbench.meta?.stats || {}),
    defaultSelectedObjectId: workbench.navigator?.defaultSelectedObjectId || "",
    tree: annotateEnvironmentNav(workbench.navigator?.tree || [], projectionByOrdinal, contextIndex),
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
      packageType: "oi-149-p4-lifecycle-process-projection",
      dataState: "ready",
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
    packageType: "oi-149-p4-lifecycle-index",
    dataState: "ready",
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
    ...index,
    packageType: "oi-149-p4-maintenance-index",
    dataState: "ready",
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
    packageType: "oi-149-p4-shared-lookup-service-module-index",
    dataState: "ready",
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
    ...index,
    packageType: "oi-149-p4-standards-index",
    dataState: "ready",
  }, records, {
    category: "standardsIndex",
    firstScreen: true,
    budgetKB: FIRST_SCREEN_BUDGET_KB,
  });
}

function writeRuntimeSplitManifest(records, sourcePackages, generatedAt) {
  const runtimeFiles = records.map((record) =>
    sanitizeUiValue({
      path: record.path,
      sizeKB: record.sizeKB,
      category: record.category,
      firstScreen: record.firstScreen,
      detailProjection: record.detailProjection,
    })
  );
  return writeBudgeted("oi149-split-manifest.json", {
    packageType: "oi-149-p4-runtime-split-manifest",
    dataState: "ready",
    contract: "oi149-p4-split-v1",
    generatedAt,
    sourcePackages,
    domains: {
      capability: {
        indexPath: "capability/index.json",
        projectionIndexField: "projections",
        projectionPathBase: "capability/projections",
        runtimeMode: "split-index-first-screen",
        fallback: "capability-workbench.json",
      },
      environment: {
        navigatorPath: "environment/navigator.json",
        projectionIndexField: "projections",
        projectionPathBase: "environment/projections",
        runtimeMode: "candidate-ready",
        fallback: "environment-workbench.json",
      },
      lifecycle: {
        indexPath: "lifecycle/index.json",
        projectionPathBase: "lifecycle/projections",
        runtimeMode: "candidate-ready",
        fallback: "lifecycle-workbench.json",
      },
      maintenance: {
        indexPath: "maintenance/index.json",
        sectionPathBase: "maintenance/sections",
        runtimeMode: "candidate-ready",
        fallback: "maintenance-knowledge.json",
      },
      sharedLookups: {
        serviceModuleIndexPath: "shared-lookups/service-module-index.json",
        runtimeMode: "candidate-ready",
        fallback: "shared-lookups.json",
      },
      standards: {
        indexPath: "standards/index.json",
        runtimeMode: "candidate-ready",
        fallback: "standards-index.json",
      },
    },
    files: runtimeFiles,
  }, records, {
    category: "splitManifest",
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
  const duplicatePathFailures = duplicateValues(records.map((record) => record.path));
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
    result:
      firstScreenFailures.length || detailProjectionFailures.length || fieldBoundaryFailures.length || duplicatePathFailures.length
        ? "fail"
        : "pass",
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
    pathBoundary: {
      duplicatePathFailures,
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
    `- duplicatePathFailures: \`${audit.pathBoundary.duplicatePathFailures.length}\``,
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
  const generatedAt = new Date().toISOString();
  writeRuntimeSplitManifest(records, sourcePackages, generatedAt);
  const audit = auditGeneratedFiles(records);
  const manifest = {
    packageType: "oi-149-p4-json-split-candidate-manifest",
    dataState: "candidate",
    generatedAt,
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
