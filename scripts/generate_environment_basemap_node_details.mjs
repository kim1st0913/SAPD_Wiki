#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const SEMANTIC_PATH = "frontend/capability-browser/generated/environmentBasemap.semantic.json";
const WORKBENCH_PATH = "frontend/capability-browser/public/data/environment-workbench.json";
const OUTPUT_PATH = "frontend/capability-browser/generated/environmentBasemap.node-details.json";

const DETAILS_VERSION = "environment-basemap-node-detail-projection-1.0";
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
  return {
    mxId: node.mxId || "",
    label: node.label || "",
    bindStatus: node.bindStatus || "",
    objectType: node.objectType || node.drawioObjectType || "",
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

  return {
    ...compactObject(service),
    modules,
    measures,
  };
}

function serviceAppliesToScope(service, scopeId, index) {
  return fromSource(index, service.id, "applies_to_scope", "scope_type").some((relation) => relation.targetId === scopeId);
}

function buildScopeMappings(informationObjectIds, index, evidenceCollector) {
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

      mappings.push({
        informationObject: compactObject(informationObject),
        scope: compactObject(scope),
        services,
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

function hierarchyContext(object, index, evidenceCollector) {
  if (object.type === "information_environment") {
    const segmentRelations = fromSource(index, object.id, "contains_segment", "environment_segment");
    evidenceCollector.addObject(object);
    evidenceCollector.addRelations(segmentRelations);

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
      environment: compactObject(object),
      segments,
      informationObject: null,
      informationObjectIds: uniqueStrings(informationObjectIds),
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

    return {
      environment: environments[0] || null,
      segments: [compactObject(object)].filter(Boolean),
      informationObject: null,
      informationObjectIds: uniqueStrings(objectRelations.map((relation) => relation.targetId)),
    };
  }

  if (object.type === "information_object") {
    const segmentRelations = toTarget(index, object.id, "contains_object", "environment_segment");
    evidenceCollector.addObject(object);
    evidenceCollector.addRelations(segmentRelations);

    const segments = dedupeObjects(segmentRelations.map((relation) => compactObject(index.objectsById.get(relation.sourceId))));
    const environmentRelations = [];
    for (const segment of segments) {
      const parentRelations = toTarget(index, segment.objectId, "contains_segment", "information_environment");
      environmentRelations.push(...parentRelations);
      evidenceCollector.addRelations(parentRelations);
    }
    const environments = dedupeObjects(environmentRelations.map((relation) => compactObject(index.objectsById.get(relation.sourceId))));
    for (const environment of environments) evidenceCollector.addObject(index.objectsById.get(environment.objectId));

    return {
      environment: environments[0] || null,
      segments,
      informationObject: compactObject(object),
      informationObjectIds: [object.id],
    };
  }

  return {
    environment: null,
    segments: [],
    informationObject: object.type === "information_object" ? compactObject(object) : null,
    informationObjectIds: [],
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
  const context = hierarchyContext(object, index, evidenceCollector);
  const scopeMappings = buildScopeMappings(context.informationObjectIds, index, evidenceCollector);

  return {
    mxId: node.mxId || "",
    label: node.label || "",
    bindStatus: node.bindStatus || "",
    objectType: object.type || node.objectType || "",
    objectId: object.id || node.objectId || "",
    objectCode: object.code || node.objectCode || "",
    objectName: objectName(object) || node.objectName || "",
    environment: context.environment,
    segments: context.segments,
    informationObject: context.informationObject,
    scopeMappings,
    relatedCapabilities: collectRelatedCapabilities(scopeMappings, index),
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
        issues: projection.issues.length,
      },
      null,
      2,
    ),
  );
}

main();
