#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const SEMANTIC_PATH = "frontend/capability-browser/generated/environmentBasemap.semantic.json";
const WORKBENCH_PATH = "frontend/capability-browser/public/data/environment-workbench.json";
const OUTPUT_PATH = "frontend/capability-browser/generated/environmentBasemap.node-details.json";

const DETAILS_VERSION = "environment-basemap-node-detail-semantics-3.1";
const EVIDENCE_REF_LIMIT = 120;
const EVIDENCE_RECORD_LIMIT = 40;

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function uniqueStrings(values) {
  return [...new Set(values.filter(Boolean))];
}

function cleanText(value) {
  return value == null ? "" : String(value).trim();
}

function splitLines(value) {
  return cleanText(value)
    .split(/\n+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function objectName(object) {
  return object?.name || object?.title || object?.label || "";
}

function objectSortKey(object) {
  return [object.objectName || "", object.objectCode || "", object.objectId || ""].join("|");
}

function compactObject(object) {
  if (!object) return null;
  return {
    objectType: object.type || "",
    objectId: object.id || "",
    objectCode: object.code || "",
    objectName: objectName(object),
  };
}

function compactNode(node) {
  const contextLabels = contextLabelsForNode(node);
  const contextPath = uniqueStrings([
    ...contextLabels,
    node.objectName || node.label || "",
  ]);
  return {
    mxId: node.mxId || "",
    label: node.label || "",
    bindStatus: node.bindStatus || "",
    drawioType: node.drawioType || "",
    iconType: node.iconType || "",
    detailType: detailTypeForNode(node),
    objectSubtype: objectSubtypeForNode(node),
    objectType: node.objectType || node.drawioObjectType || "",
    objectId: node.objectId || "",
    objectCode: node.objectCode || "",
    objectName: node.objectName || "",
    contextPath,
    contextPathText: contextPath.join(" / "),
    bindingReason: node.bindingReason || "",
  };
}

function compactEvidence(evidence, evidenceId) {
  return {
    evidenceId: evidence?.id || evidenceId || "",
    kind: evidence?.kind || "",
    status: evidence?.status || "",
  };
}

function compactSemanticSource(source = {}) {
  return {
    file: source.file || "",
    page: source.page || "",
    pageName: source.pageName || "",
    parser: source.parser || "",
  };
}

const CONTEXT_IGNORE_LABELS = new Set(["IT", "OT", "客户"]);
const OBJECT_CATEGORY_LABELS = new Set([
  "PC终端",
  "移动终端",
  "业务应用",
  "大数据平台/数据中台",
  "工作负载",
  "网络",
  "应用及数据",
  "人员",
  "管理平台",
  "运维管理终端",
  "容器",
]);

const ENVIRONMENT_ALIAS = new Map([
  ["园区网", "园区"],
  ["工业控制网络", "工厂"],
]);

function displayEnvironmentName(name) {
  return ENVIRONMENT_ALIAS.get(name) || name || "";
}

function objectSubtypeForNode(node = {}) {
  const drawioType = node.drawioType || "";
  const label = node.label || "";
  if (/边界/.test(label) || drawioType === "network_boundary") return "网络边界";
  if (drawioType === "actor") return "人员";
  if (drawioType === "device") return "设备";
  if (drawioType === "system_software") return "系统软件";
  if (drawioType === "application_component") return "软件应用";
  if (drawioType === "data_object") return "数据对象";
  if (drawioType === "communication_network") return "通信网络";
  if (drawioType === "node") return "节点";
  return "";
}

function contextLabelsForNode(node = {}) {
  return asArray(node.contextLabels)
    .map(cleanText)
    .filter((label) => label && !CONTEXT_IGNORE_LABELS.has(label));
}

function dedupeObjects(objects) {
  const byKey = new Map();
  for (const object of objects.filter(Boolean)) {
    const key = `${object.objectType}:${object.objectId}`;
    if (!byKey.has(key)) byKey.set(key, object);
  }
  return [...byKey.values()].sort((a, b) => objectSortKey(a).localeCompare(objectSortKey(b), "zh-Hans-CN"));
}

function dedupeById(items) {
  const byId = new Map();
  for (const item of items.filter(Boolean)) {
    const key = item.id || item.objectId;
    if (key && !byId.has(key)) byId.set(key, item);
  }
  return [...byId.values()];
}

function buildIndexes(workbench) {
  const objectsById = new Map();
  const evidenceById = new Map();
  const relationsBySource = new Map();
  const relationsByTarget = new Map();

  for (const objects of Object.values(workbench.objects || {})) {
    for (const object of Object.values(objects || {})) {
      if (object?.id) objectsById.set(object.id, object);
    }
  }

  for (const evidence of asArray(workbench.evidenceRefs)) {
    if (evidence?.id) evidenceById.set(evidence.id, evidence);
  }

  for (const relation of asArray(workbench.relations)) {
    if (relation?.sourceId) {
      if (!relationsBySource.has(relation.sourceId)) relationsBySource.set(relation.sourceId, []);
      relationsBySource.get(relation.sourceId).push(relation);
    }
    if (relation?.targetId) {
      if (!relationsByTarget.has(relation.targetId)) relationsByTarget.set(relation.targetId, []);
      relationsByTarget.get(relation.targetId).push(relation);
    }
  }

  return { objectsById, evidenceById, relationsBySource, relationsByTarget };
}

function fromSource(index, sourceId, relationType, targetType = "") {
  return asArray(index.relationsBySource.get(sourceId)).filter((relation) => {
    if (relationType && relation.type !== relationType) return false;
    if (targetType && relation.targetType !== targetType) return false;
    return true;
  });
}

function toTarget(index, targetId, relationType, sourceType = "") {
  return asArray(index.relationsByTarget.get(targetId)).filter((relation) => {
    if (relationType && relation.type !== relationType) return false;
    if (sourceType && relation.sourceType !== sourceType) return false;
    return true;
  });
}

function relationTargets(index, sourceId, relationType, targetType = "") {
  return fromSource(index, sourceId, relationType, targetType)
    .map((relation) => index.objectsById.get(relation.targetId))
    .filter(Boolean);
}

function relationSources(index, targetId, relationType, sourceType = "") {
  return toTarget(index, targetId, relationType, sourceType)
    .map((relation) => index.objectsById.get(relation.sourceId))
    .filter(Boolean);
}

function createEvidenceCollector(index) {
  const evidenceRefs = new Set();

  function addRefs(refs) {
    for (const ref of asArray(refs)) {
      if (ref) evidenceRefs.add(ref);
    }
  }

  function addObject(object) {
    addRefs(object?.evidenceRefs);
  }

  function addRelations(relations) {
    for (const relation of asArray(relations)) addRefs(relation.evidenceRefs);
  }

  function build() {
    const refs = [...evidenceRefs].sort();
    const limitedRefs = refs.slice(0, EVIDENCE_REF_LIMIT);
    return {
      evidenceRefs: limitedRefs,
      totalEvidenceRefs: refs.length,
      evidenceRefsTruncated: refs.length > limitedRefs.length,
      evidenceRecords: limitedRefs
        .slice(0, EVIDENCE_RECORD_LIMIT)
        .map((ref) => compactEvidence(index.evidenceById.get(ref), ref)),
    };
  }

  return { addObject, addRelations, build };
}

function serviceSummary(service, index, evidenceCollector) {
  const moduleRelations = fromSource(index, service.id, "implemented_by_module", "security_technology_module");
  const fallbackModuleRelations = toTarget(index, service.id, "implements_service", "security_technology_module");
  const selectedModuleRelations = moduleRelations.length ? moduleRelations : fallbackModuleRelations;
  const measureRelations = fromSource(index, service.id, "has_measure", "security_technical_measure");
  const capabilityRelations = fromSource(index, service.id, "supports_capability", "capability");
  const focusRelations = fromSource(index, service.id, "supports_focus", "capability_focus");

  evidenceCollector.addObject(service);
  evidenceCollector.addRelations(selectedModuleRelations);
  evidenceCollector.addRelations(measureRelations);
  evidenceCollector.addRelations(capabilityRelations);
  evidenceCollector.addRelations(focusRelations);

  const modules = dedupeObjects(
    selectedModuleRelations
      .map((relation) => index.objectsById.get(moduleRelations.length ? relation.targetId : relation.sourceId))
      .filter(Boolean)
      .map((module) => {
        evidenceCollector.addObject(module);
        const systemRelations = fromSource(index, module.id, "part_of_system", "security_system");
        const productRelations = fromSource(index, module.id, "maps_to_product", "product");
        evidenceCollector.addRelations(systemRelations);
        evidenceCollector.addRelations(productRelations);
        return {
          ...compactObject(module),
          systems: dedupeObjects(systemRelations.map((relation) => compactObject(index.objectsById.get(relation.targetId)))),
          products: dedupeObjects(productRelations.map((relation) => compactObject(index.objectsById.get(relation.targetId)))),
        };
      }),
  );

  const measures = dedupeObjects(
    measureRelations.map((relation) => {
      const measure = index.objectsById.get(relation.targetId);
      evidenceCollector.addObject(measure);
      return compactObject(measure);
    }),
  );
  const securitySystems = dedupeObjects(modules.flatMap((module) => asArray(module.systems)));

  return {
    ...compactObject(service),
    modules,
    measures,
    securitySystems,
  };
}

function serviceAppliesToScope(service, scopeId, index) {
  return fromSource(index, service.id, "applies_to_scope", "scope_type").some((relation) => relation.targetId === scopeId);
}

function compactEmbeddedObject(object) {
  if (!object) return null;
  return {
    objectType: object.type || "",
    objectId: object.id || "",
    objectCode: object.code || "",
    objectName: object.title || object.name || object.text || object.raw || "",
  };
}

function compactEmbeddedService(service) {
  const systems = dedupeObjects(asArray(service.securitySystems).map(compactEmbeddedObject).filter(Boolean));
  return {
    ...compactEmbeddedObject(service),
    modules: dedupeObjects(
      asArray(service.modules)
        .map((module) => ({
          ...compactEmbeddedObject(module),
          systems,
        }))
        .filter((module) => module.objectName || module.objectId),
    ),
    measures: dedupeObjects(asArray(service.measures).map(compactEmbeddedObject).filter(Boolean)),
    securitySystems: systems,
  };
}

function buildEmbeddedScopeMappings(informationObjectIds, index, evidenceCollector) {
  const mappings = [];
  for (const informationObjectId of uniqueStrings(informationObjectIds)) {
    const informationObject = index.objectsById.get(informationObjectId);
    if (!informationObject || !asArray(informationObject.scope_mappings).length) continue;
    evidenceCollector.addObject(informationObject);
    for (const mapping of asArray(informationObject.scope_mappings)) {
      const services = dedupeObjects(asArray(mapping.services).map(compactEmbeddedService).filter(Boolean));
      const modules = dedupeObjects(services.flatMap((service) => asArray(service.modules)));
      const measures = dedupeObjects(services.flatMap((service) => asArray(service.measures)));
      const securitySystems = dedupeObjects(services.flatMap((service) => asArray(service.securitySystems)));
      mappings.push({
        informationObject: compactObject(informationObject),
        scope: compactEmbeddedObject(mapping.scope),
        services,
        modules,
        measures,
        securitySystems,
      });
    }
  }

  return mappings.sort((a, b) => {
    const aKey = `${a.informationObject?.objectName || ""}|${a.scope?.objectCode || ""}|${a.scope?.objectName || ""}`;
    const bKey = `${b.informationObject?.objectName || ""}|${b.scope?.objectCode || ""}|${b.scope?.objectName || ""}`;
    return aKey.localeCompare(bKey, "zh-Hans-CN");
  });
}

function buildScopeMappings(informationObjectIds, index, evidenceCollector) {
  const embeddedMappings = buildEmbeddedScopeMappings(informationObjectIds, index, evidenceCollector);
  if (embeddedMappings.length) return embeddedMappings;

  const mappings = [];

  for (const informationObjectId of uniqueStrings(informationObjectIds)) {
    const informationObject = index.objectsById.get(informationObjectId);
    if (!informationObject) continue;
    evidenceCollector.addObject(informationObject);

    const scopeRelations = fromSource(index, informationObject.id, "applies_to_scope", "scope_type");
    const protectRelations = toTarget(index, informationObject.id, "protects_object", "security_technical_service");
    const protectedServices = dedupeById(protectRelations.map((relation) => index.objectsById.get(relation.sourceId)));

    evidenceCollector.addRelations(scopeRelations);
    evidenceCollector.addRelations(protectRelations);

    for (const scopeRelation of scopeRelations) {
      const scope = index.objectsById.get(scopeRelation.targetId);
      if (!scope) continue;
      evidenceCollector.addObject(scope);

      const servicesForScope = protectedServices.filter((service) => serviceAppliesToScope(service, scope.id, index));
      const services = dedupeObjects(servicesForScope.map((service) => serviceSummary(service, index, evidenceCollector)));
      const modules = dedupeObjects(services.flatMap((service) => asArray(service.modules)));
      const measures = dedupeObjects(services.flatMap((service) => asArray(service.measures)));
      const securitySystems = dedupeObjects(services.flatMap((service) => asArray(service.securitySystems)));

      mappings.push({
        informationObject: compactObject(informationObject),
        scope: compactObject(scope),
        services,
        modules,
        measures,
        securitySystems,
      });
    }
  }

  return mappings.sort((a, b) => {
    const aKey = `${a.informationObject?.objectName || ""}|${a.scope?.objectCode || ""}|${a.scope?.objectName || ""}`;
    const bKey = `${b.informationObject?.objectName || ""}|${b.scope?.objectCode || ""}|${b.scope?.objectName || ""}`;
    return aKey.localeCompare(bKey, "zh-Hans-CN");
  });
}

function collectRelatedCapabilities(scopeMappings, index) {
  const serviceIds = uniqueStrings(
    scopeMappings.flatMap((mapping) => asArray(mapping.services).map((service) => service.objectId)),
  );
  const capabilities = [];
  const capabilityFocuses = [];

  for (const serviceId of serviceIds) {
    capabilities.push(...fromSource(index, serviceId, "supports_capability", "capability").map((relation) => compactObject(index.objectsById.get(relation.targetId))));
    capabilityFocuses.push(...fromSource(index, serviceId, "supports_focus", "capability_focus").map((relation) => compactObject(index.objectsById.get(relation.targetId))));
  }

  return {
    capabilities: dedupeObjects(capabilities),
    capabilityFocuses: dedupeObjects(capabilityFocuses),
  };
}

function isBoundaryLabel(label = "") {
  return /边界|内部网络|骨干节点/.test(label);
}

function detailTypeForNode(node = {}, object = null) {
  const drawioType = node.drawioType || "";
  const objectType = object?.type || node.objectType || node.drawioObjectType || "";
  const label = node.label || "";

  if (node.bindStatus === "ignored") return "ignored";
  if (drawioType === "network_boundary" || isBoundaryLabel(label)) {
    return objectType === "scope_type" ? "security_scope" : "network_boundary";
  }
  if (objectType === "information_object") return "information_object";
  if (drawioType === "actor" || objectType === "actor") return "actor";
  if (objectType === "information_environment") {
    if (/数据中心机房/.test(label)) return "environment_container";
    return "environment";
  }
  if (objectType === "environment_segment") {
    if (OBJECT_CATEGORY_LABELS.has(label) || OBJECT_CATEGORY_LABELS.has(objectName(object))) return "environment_object_category";
    return "environment_segment";
  }
  if (drawioType === "communication_network") return "communication_network";
  if (["application_component", "system_software", "device", "node", "data_object"].includes(drawioType)) return "internal_component";
  if (/网络周界|IT|OT/.test(label)) return "environment_category";
  return objectType || drawioType || "unknown";
}

function isInternalDetailType(detailType) {
  return detailType === "internal_component";
}

function shouldExposeDirectScopeGroups(detailType) {
  return ["information_object", "network_boundary", "security_scope", "communication_network"].includes(detailType);
}

function summarizeScopeGroups(scopeGroups) {
  const scopes = dedupeObjects(scopeGroups.map((group) => group.scope));
  const services = dedupeObjects(scopeGroups.flatMap((group) => asArray(group.services)));
  const modules = dedupeObjects(scopeGroups.flatMap((group) => asArray(group.modules)));
  const measures = dedupeObjects(scopeGroups.flatMap((group) => asArray(group.measures)));
  const securitySystems = dedupeObjects(scopeGroups.flatMap((group) => asArray(group.securitySystems)));
  return {
    scopeCount: scopes.length,
    serviceCount: services.length,
    moduleCount: modules.length,
    measureCount: measures.length,
    securitySystemCount: securitySystems.length,
  };
}

function compactObjectsByIds(ids, index) {
  return dedupeObjects(uniqueStrings(ids).map((id) => compactObject(index.objectsById.get(id))).filter(Boolean));
}

function boundaryObjects(objects) {
  return dedupeObjects(objects.filter((object) => isBoundaryLabel(object.objectName || object.objectCode || "")));
}

function scoreEnvironmentForLabels(environment, labels) {
  const name = objectName(environment);
  const displayName = displayEnvironmentName(name);
  let score = 0;
  if (labels.includes(name)) score += 6;
  if (displayName && labels.includes(displayName)) score += 6;
  if (name === "园区网" && labels.includes("园区")) score += 6;
  if (name === "工业控制网络" && labels.includes("工厂")) score += 6;
  if (/云数据中心|传统数据中心/.test(name) && labels.includes(name)) score += 5;
  if (/数据中心/.test(name) && labels.includes("数据中心机房")) score += 2;
  if (/远程办公接入|分支机构/.test(name) && labels.includes(name)) score += 5;
  return score;
}

function contextForEnvironment(environment, labels = []) {
  const envName = objectName(environment);
  if (/云数据中心|传统数据中心/.test(envName) || labels.includes("数据中心机房")) {
    return {
      environmentName: "数据中心机房",
      segmentName: envName,
    };
  }
  return {
    environmentName: displayEnvironmentName(envName),
    segmentName: "",
  };
}

function chooseSegmentContext(object, index, labels, evidenceCollector) {
  const segmentRelations = toTarget(index, object.id, "contains_object", "environment_segment");
  evidenceCollector.addRelations(segmentRelations);
  const candidates = [];
  for (const relation of segmentRelations) {
    const segment = index.objectsById.get(relation.sourceId);
    if (!segment) continue;
    evidenceCollector.addObject(segment);
    const environmentRelations = toTarget(index, segment.id, "contains_segment", "information_environment");
    evidenceCollector.addRelations(environmentRelations);
    const environments = environmentRelations.map((envRelation) => index.objectsById.get(envRelation.sourceId)).filter(Boolean);
    for (const environment of environments) {
      evidenceCollector.addObject(environment);
      const segmentName = objectName(segment);
      let score = scoreEnvironmentForLabels(environment, labels);
      if (labels.includes(segmentName)) score += 5;
      if (!labels.length) score += 1;
      candidates.push({ segment, environment, score });
    }
  }
  candidates.sort((a, b) => b.score - a.score || objectName(a.environment).localeCompare(objectName(b.environment), "zh-Hans-CN"));
  return candidates[0] || null;
}

function buildContextPath({ environmentName, segmentName, objectCategoryName, informationObjectName, internalComponentName }) {
  const path = [];
  path.push(environmentName || "待补充");
  const category = objectCategoryName || segmentName;
  if (category) path.push(category);
  if (informationObjectName) path.push(informationObjectName);
  if (internalComponentName && internalComponentName !== informationObjectName) path.push(internalComponentName);
  return uniqueStrings(path);
}

function hierarchyContext(node, object, index, evidenceCollector) {
  const labels = contextLabelsForNode(node);
  if (object.type === "information_environment") {
    const segmentRelations = fromSource(index, object.id, "contains_segment", "environment_segment");
    evidenceCollector.addObject(object);
    evidenceCollector.addRelations(segmentRelations);
    const environmentContext = contextForEnvironment(object, labels);

    const segments = dedupeObjects(
      segmentRelations.map((relation) => {
        const segment = index.objectsById.get(relation.targetId);
        evidenceCollector.addObject(segment);
        return compactObject(segment);
      }),
    );
    const informationObjectIds = [];
    for (const segment of segments) {
      const objectRelations = fromSource(index, segment.objectId, "contains_object", "information_object");
      evidenceCollector.addRelations(objectRelations);
      informationObjectIds.push(...objectRelations.map((relation) => relation.targetId));
    }
    return {
      ...environmentContext,
      environment: compactObject(object),
      segments,
      informationObject: null,
      informationObjectIds: uniqueStrings(informationObjectIds),
      childInformationObjects: compactObjectsByIds(informationObjectIds, index),
    };
  }

  if (object.type === "environment_segment") {
    const environmentRelations = toTarget(index, object.id, "contains_segment", "information_environment");
    const objectRelations = fromSource(index, object.id, "contains_object", "information_object");
    evidenceCollector.addObject(object);
    evidenceCollector.addRelations(environmentRelations);
    evidenceCollector.addRelations(objectRelations);

    const environments = dedupeObjects(environmentRelations.map((relation) => compactObject(index.objectsById.get(relation.sourceId))));
    for (const environment of environments) evidenceCollector.addObject(index.objectsById.get(environment.objectId));
    const selectedEnvironment = environments
      .map((environment) => index.objectsById.get(environment.objectId))
      .filter(Boolean)
      .sort((a, b) => scoreEnvironmentForLabels(b, labels) - scoreEnvironmentForLabels(a, labels))[0];
    const environmentContext = contextForEnvironment(selectedEnvironment || index.objectsById.get(environments[0]?.objectId), labels);

    return {
      ...environmentContext,
      objectCategoryName: node.label && node.label !== objectName(object) ? node.label : objectName(object),
      environment: compactObject(selectedEnvironment) || environments[0] || null,
      segments: [compactObject(object)].filter(Boolean),
      informationObject: null,
      informationObjectIds: uniqueStrings(objectRelations.map((relation) => relation.targetId)),
      childInformationObjects: compactObjectsByIds(objectRelations.map((relation) => relation.targetId), index),
    };
  }

  if (object.type === "information_object") {
    evidenceCollector.addObject(object);
    const [contextEnvironmentName, contextSegmentName] = cleanText(object.contextKey)
      .split("||")
      .map(cleanText);
    if (contextEnvironmentName && contextSegmentName) {
      return {
        environmentName: contextEnvironmentName,
        objectCategoryName: contextSegmentName,
        environment: null,
        segments: asArray(object.segments).map(compactEmbeddedObject).filter(Boolean),
        informationObject: compactObject(object),
        informationObjectIds: [object.id],
        childInformationObjects: [],
      };
    }

    const selected = chooseSegmentContext(object, index, labels, evidenceCollector);
    const segment = selected?.segment || null;
    const environment = selected?.environment || null;
    const environmentContext = contextForEnvironment(environment, labels);
    const objectCategoryName =
      labels.find((label) => OBJECT_CATEGORY_LABELS.has(label) && label !== objectName(object)) ||
      objectName(segment) ||
      "";

    return {
      ...environmentContext,
      objectCategoryName,
      environment: compactObject(environment),
      segments: [compactObject(segment)].filter(Boolean),
      informationObject: compactObject(object),
      informationObjectIds: [object.id],
      childInformationObjects: [],
    };
  }

  return {
    environment: null,
    segments: [],
    informationObject: object.type === "information_object" ? compactObject(object) : null,
    informationObjectIds: [],
    childInformationObjects: [],
    environmentName: "待补充",
    objectCategoryName: "",
  };
}

function buildDetail(node, index, issues) {
  const object = index.objectsById.get(node.objectId);
  if (!object) {
    issues.push({
      type: "missingDetail",
      mxId: node.mxId || "",
      label: node.label || "",
      objectType: node.objectType || "",
      objectId: node.objectId || "",
      message: "Bound basemap node objectId was not found in environment-workbench objects.",
    });
    return null;
  }

  const evidenceCollector = createEvidenceCollector(index);
  const context = hierarchyContext(node, object, index, evidenceCollector);
  const detailType = detailTypeForNode(node, object);
  const allContextScopeGroups = buildScopeMappings(context.informationObjectIds, index, evidenceCollector);
  const directScopeGroups = shouldExposeDirectScopeGroups(detailType)
    ? buildScopeMappings(object.type === "information_object" ? [object.id] : [], index, evidenceCollector)
    : [];
  const directKeys = new Set(directScopeGroups.map((group) => `${group.informationObject?.objectId || ""}:${group.scope?.objectId || ""}`));
  const inheritedScopeGroups = allContextScopeGroups.filter(
    (group) => !directKeys.has(`${group.informationObject?.objectId || ""}:${group.scope?.objectId || ""}`),
  );
  const directSummary = summarizeScopeGroups(directScopeGroups);
  const inheritedSummary = summarizeScopeGroups(inheritedScopeGroups);
  const contextPath = buildContextPath({
    environmentName: context.environmentName,
    segmentName: context.segmentName,
    objectCategoryName: context.objectCategoryName,
    informationObjectName: detailType === "information_object" || detailType === "network_boundary" || detailType === "security_scope" ? objectName(object) : "",
  });
  const summary = {
    directScopeCount: directSummary.scopeCount,
    directServiceCount: directSummary.serviceCount,
    directModuleCount: directSummary.moduleCount,
    directMeasureCount: directSummary.measureCount,
    directSecuritySystemCount: directSummary.securitySystemCount,
    inheritedScopeCount: inheritedSummary.scopeCount,
    inheritedServiceCount: inheritedSummary.serviceCount,
    inheritedModuleCount: inheritedSummary.moduleCount,
    inheritedMeasureCount: inheritedSummary.measureCount,
    inheritedSecuritySystemCount: inheritedSummary.securitySystemCount,
    scopeCount: directSummary.scopeCount,
    serviceCount: directSummary.serviceCount,
    moduleCount: directSummary.moduleCount,
    measureCount: directSummary.measureCount,
    securitySystemCount: directSummary.securitySystemCount,
    childInformationObjectCount: context.childInformationObjects.length,
    inheritedScopeGroupCount: inheritedScopeGroups.length,
    directScopeGroupCount: directScopeGroups.length,
  };

  return {
    mxId: node.mxId || "",
    label: node.label || "",
    bindStatus: node.bindStatus || "",
    drawioType: node.drawioType || "",
    iconType: node.iconType || "",
    detailType,
    objectSubtype: objectSubtypeForNode(node),
    objectType: object.type || node.objectType || "",
    objectId: object.id || node.objectId || "",
    objectCode: object.code || node.objectCode || "",
    objectName: objectName(object) || node.objectName || "",
    objectContextKey: object.contextKey || "",
    matchedObjectContextKey: object.contextKey || "",
    contextPath,
    contextPathText: contextPath.join(" / "),
    environmentName: context.environmentName || "",
    objectCategoryName: context.objectCategoryName || context.segmentName || "",
    independentModeling: !isInternalDetailType(detailType),
    detailNote: isInternalDetailType(detailType)
      ? "该元素按底图内部组成元素展示，不展开继承的安全技术服务 / 模块 / 措施清单。"
      : "",
    environment: context.environment,
    segments: context.segments,
    informationObject: context.informationObject,
    childInformationObjects: context.childInformationObjects,
    relatedBoundaries: boundaryObjects(context.childInformationObjects),
    summary,
    directScopeGroups,
    inheritedScopeGroups,
    scopeMappings: directScopeGroups,
    inheritedScopeMappingsCount: inheritedScopeGroups.length,
    relatedCapabilities: collectRelatedCapabilities(directScopeGroups, index),
    sourceEvidence: evidenceCollector.build(),
  };
}

function buildProjection(semantic, workbench) {
  const index = buildIndexes(workbench);
  const nodeDetailsByMxId = {};
  const ignoredNodes = [];
  const issues = [];
  const nodes = asArray(semantic.nodes);
  const boundNodes = nodes.filter((node) => node.bindStatus === "bound");

  for (const node of nodes) {
    if (node.bindStatus === "ignored") {
      ignoredNodes.push(compactNode(node));
      continue;
    }
    if (node.bindStatus !== "bound") {
      issues.push({
        type: "unsupportedBindStatus",
        mxId: node.mxId || "",
        label: node.label || "",
        bindStatus: node.bindStatus || "",
        message: "Only bound nodes receive node details in projection 1.0.",
      });
      continue;
    }

    const detail = buildDetail(node, index, issues);
    if (detail) nodeDetailsByMxId[node.mxId] = detail;
  }

  const missingDetailNodes = issues.filter((issue) => issue.type === "missingDetail").length;
  const detailReadyNodes = Object.keys(nodeDetailsByMxId).length;
  const detailTypeDistribution = {};
  const internalComponentNodes = [];
  const unknownDetailNodes = [];
  for (const detail of Object.values(nodeDetailsByMxId)) {
    detailTypeDistribution[detail.detailType] = (detailTypeDistribution[detail.detailType] || 0) + 1;
    if (isInternalDetailType(detail.detailType)) {
      internalComponentNodes.push({
        mxId: detail.mxId,
        label: detail.label,
        detailType: detail.detailType,
        objectType: detail.objectType,
        objectName: detail.objectName,
      });
    }
    if (detail.detailType === "unknown") {
      unknownDetailNodes.push({ mxId: detail.mxId, label: detail.label, objectType: detail.objectType });
    }
  }
  for (const node of ignoredNodes) {
    detailTypeDistribution[node.detailType] = (detailTypeDistribution[node.detailType] || 0) + 1;
  }

  return {
    source: {
      version: DETAILS_VERSION,
      semanticPath: SEMANTIC_PATH,
      workbenchPath: WORKBENCH_PATH,
      semanticSource: compactSemanticSource(semantic.source),
      workbenchVersion: workbench.meta?.version || "",
      workbenchViewModelVersion: workbench.meta?.viewModelVersion || "",
      workbenchPage: {
        route: workbench.page?.route || "",
        title: workbench.page?.title || "",
        pageType: workbench.page?.pageType || "",
      },
    },
    stats: {
      semanticNodes: nodes.length,
      semanticEdges: asArray(semantic.edges).length,
      boundNodes: boundNodes.length,
      ignoredNodes: ignoredNodes.length,
      candidateNodes: nodes.filter((node) => node.bindStatus === "candidate").length,
      unboundNodes: nodes.filter((node) => node.bindStatus === "unbound").length,
      detailReadyNodes,
      missingDetailNodes,
      nodeDetails: detailReadyNodes,
      workbenchObjects: index.objectsById.size,
      workbenchRelations: asArray(workbench.relations).length,
      detailTypeDistribution,
      informationObjectNodes: detailTypeDistribution.information_object || 0,
      environmentContainerNodes: detailTypeDistribution.environment_container || 0,
      environmentSegmentNodes: detailTypeDistribution.environment_segment || 0,
      securityScopeNodes: detailTypeDistribution.security_scope || 0,
      networkBoundaryNodes: detailTypeDistribution.network_boundary || 0,
      internalComponentNodes: internalComponentNodes.length,
      actorNodes: detailTypeDistribution.actor || 0,
      ignoredNodesByDetailType: detailTypeDistribution.ignored || 0,
      unknownDetailNodes: unknownDetailNodes.length,
    },
    detailProjectionReport: {
      detailTypeDistribution,
      internalComponentNodes,
      unknownDetailNodes,
      note:
        "Detail Projection 2.0 separates visual/detail types from business objectType. Internal component nodes do not expose inherited service/module/measure lists by default.",
    },
    nodeDetailsByMxId,
    ignoredNodes,
    issues,
  };
}

function main() {
  const semantic = readJson(SEMANTIC_PATH);
  const workbench = readJson(WORKBENCH_PATH);
  const projection = buildProjection(semantic, workbench);
  writeJson(OUTPUT_PATH, projection);
  console.log(
    JSON.stringify(
      {
        output: OUTPUT_PATH,
        semanticNodes: projection.stats.semanticNodes,
        semanticEdges: projection.stats.semanticEdges,
        boundNodes: projection.stats.boundNodes,
        ignoredNodes: projection.stats.ignoredNodes,
        detailReadyNodes: projection.stats.detailReadyNodes,
        missingDetailNodes: projection.stats.missingDetailNodes,
        detailTypeDistribution: projection.stats.detailTypeDistribution,
        issues: projection.issues.length,
      },
      null,
      2,
    ),
  );
}

main();
