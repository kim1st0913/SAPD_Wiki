(function () {
  const models = (window.sapdModels = window.sapdModels || {});

  function list(value) {
    return Array.isArray(value) ? value : [];
  }

  function text(value) {
    return value == null ? "" : String(value);
  }

  function titleOf(item, fallback = "待补充") {
    if (!item) return fallback;
    return text(item.title || item.name || item.label || item.code || item.id || fallback).trim() || fallback;
  }

  function codeOf(item) {
    return text(item?.code || "").trim();
  }

  function validBusinessNode(item) {
    const title = titleOf(item, "");
    return Boolean(title && !["/", "待补充", "暂无", "不适用", "未关联"].includes(title));
  }

  function keyPart(value) {
    return text(value)
      .trim()
      .replace(/[^\w\u4e00-\u9fa5.-]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  function stableId(prefix, item, fallback) {
    const id = keyPart(item?.id || item?.code || item?.title || item?.name || fallback);
    return `${prefix}:${id || keyPart(fallback) || "node"}`;
  }

  function addNode(nodes, node) {
    if (!node?.id || nodes.has(node.id)) return nodes.get(node?.id);
    const normalized = {
      label: "待补充",
      type: "empty_state",
      group: "environment",
      weight: 1,
      isCurrent: false,
      isDecorative: false,
      meta: {},
      ...node,
    };
    nodes.set(normalized.id, normalized);
    return normalized;
  }

  function addEntityNode(nodes, item, prefix, type, group, weight = 2.5) {
    if (!validBusinessNode(item)) return null;
    return addNode(nodes, {
      id: stableId(prefix, item, `${prefix}:${titleOf(item)}`),
      label: titleOf(item),
      type,
      group,
      weight,
      meta: { code: codeOf(item) },
    });
  }

  function addEdge(edges, edge) {
    if (!edge?.source || !edge?.target || edge.source === edge.target) return;
    const id = edge.id || `${edge.type || "edge"}:${edge.source}->${edge.target}`;
    if (edges.has(id)) return;
    edges.set(id, { id, type: "environment_link", weight: 1, isDecorative: false, ...edge });
  }

  function unique(items, getKey) {
    const seen = new Set();
    return list(items).filter((item) => {
      const key = getKey(item);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  function allObjectsForSelection(context = {}) {
    if (context.selectionType === "object") return context.selectedObject ? [context.selectedObject] : [];
    return list(context.selectedObjects);
  }

  function objectsForSegment(context = {}, segment = {}) {
    const segmentId = segment?.id || segment?.title;
    return allObjectsForSelection(context).filter((object) =>
      list(object.segments).some((item) => (item.id || item.title) === segmentId),
    );
  }

  function objectById(objects, id) {
    return objects?.[id] || null;
  }

  function relatedTargets(workbenchViewModel, source, relationTypes = [], targetTypes = []) {
    const sourceId = source?.id || source?.code || source?.title;
    if (!sourceId) return [];
    const objects = workbenchViewModel?.objects || {};
    return unique(
      list(workbenchViewModel?.relations)
        .filter((relation) => relationTypes.includes(relation.type) && relation.sourceId === sourceId)
        .map((relation) => objectById(objects[relation.targetType], relation.targetId))
        .filter((item) => item && (!targetTypes.length || targetTypes.includes(item.type))),
      (item) => item.id || item.code || item.title || item.name,
    );
  }

  function capabilityTargets(workbenchViewModel, service) {
    return [
      ...relatedTargets(workbenchViewModel, service, ["supports_capability"], ["capability"]),
      ...relatedTargets(workbenchViewModel, service, ["supports_focus"], ["capability_focus"]),
    ];
  }

  function graphResponse(nodes, edges, stats = {}) {
    const nodeRows = [...nodes.values()];
    const edgeRows = [...edges.values()];
    return {
      nodes: nodeRows,
      edges: edgeRows,
      groups: [
        { key: "environment", label: "环境结构" },
        { key: "technical", label: "技术支撑" },
        { key: "asset", label: "系统 / 产品" },
        { key: "capability", label: "能力关联" },
      ],
      stats: {
        networkTitle: "环境关系图谱",
        networkDescription: "按当前层级展示信息化环境、对象和安全能力支撑关系。",
        ariaLabel: "信息化环境安全能力关系图谱",
        legendItems: [
          { className: "legend-current", label: "当前对象" },
          { className: "legend-environment", label: "环境结构" },
          { className: "legend-technical", label: "技术支撑" },
          { className: "legend-capability", label: "能力关联" },
        ],
        businessNodes: nodeRows.filter((node) => !node.isDecorative).length,
        businessEdges: edgeRows.filter((edge) => !edge.isDecorative).length,
        ...stats,
      },
    };
  }

  function buildEnvironmentStructureGraph({ context, nodes, edges, currentId }) {
    const segmentNodes = new Map();
    const objects = allObjectsForSelection(context);
    for (const segment of list(context.segments)) {
      const segmentNode = addEntityNode(nodes, segment, "environment_segment", "environment_segment", "environment", 4);
      if (!segmentNode) continue;
      segmentNodes.set(segment.id || segment.title, segmentNode);
      addEdge(edges, { source: currentId, target: segmentNode.id, type: "environment_to_segment", weight: 2 });
      for (const object of objectsForSegment(context, segment)) {
        const objectNode = addEntityNode(nodes, object, "information_object", "information_object", "environment", 2.4);
        if (!objectNode) continue;
        addEdge(edges, { source: segmentNode.id, target: objectNode.id, type: "segment_to_object", weight: 1.2 });
      }
    }
    return graphResponse(nodes, edges, {
      strategy: "environment_structure",
      graphScope: "environment",
      note: `E0 结构图：展示当前信息化环境下 ${segmentNodes.size} 个环境子类和 ${objects.length} 个信息化对象，不展开作用域、服务、模块、系统、产品和能力关注点。`,
    });
  }

  function addScopeServiceCapabilityOverview({ nodes, edges, sourceNode, rows, workbenchViewModel, includeObjectNode = false }) {
    for (const row of list(rows)) {
      const parentNode = includeObjectNode && row.object
        ? addEntityNode(nodes, row.object, "information_object", "information_object", "environment", 2.5)
        : sourceNode;
      if (!parentNode) continue;
      if (includeObjectNode) addEdge(edges, { source: sourceNode.id, target: parentNode.id, type: "segment_to_object", weight: 1.2 });
      const scopeNode = addEntityNode(nodes, row.scope, "scope", "scope", "technical", 3);
      if (!scopeNode) continue;
      addEdge(edges, { source: parentNode.id, target: scopeNode.id, type: "object_to_scope", weight: 1.5 });
      for (const service of list(row.services)) {
        const serviceNode = addEntityNode(nodes, service, "technical_service", "technical_service", "technical", 2.4);
        if (!serviceNode) continue;
        addEdge(edges, { source: scopeNode.id, target: serviceNode.id, type: "scope_to_service", weight: 1.2 });
        for (const capability of capabilityTargets(workbenchViewModel, service)) {
          const isFocus = capability.type === "capability_focus";
          const capabilityNode = addEntityNode(nodes, capability, isFocus ? "capability_focus" : "capability", isFocus ? "capability_focus" : "capability", "capability", isFocus ? 1.6 : 2);
          if (!capabilityNode) continue;
          addEdge(edges, { source: serviceNode.id, target: capabilityNode.id, type: isFocus ? "service_to_focus" : "service_to_capability", weight: 0.8 });
        }
      }
    }
  }

  function buildSegmentOverviewGraph({ context, nodes, edges, currentId, workbenchViewModel }) {
    const currentNode = nodes.get(currentId);
    addScopeServiceCapabilityOverview({ nodes, edges, sourceNode: currentNode, rows: context.scopeServiceRows, workbenchViewModel, includeObjectNode: true });
    return graphResponse(nodes, edges, {
      strategy: "environment_segment_overview",
      graphScope: "segment",
      note: `E1 映射概览：展示当前环境子类下 ${list(context.selectedObjects).length} 个对象、${context.summary?.scopeCount || 0} 个作用域、${context.summary?.serviceCount || 0} 个安全技术服务和能力 / 关注点概览；模块、措施、系统和产品仅在具体对象中展开。`,
    });
  }

  function buildObjectFullGraph({ context, nodes, edges, currentId, workbenchViewModel }) {
    const currentNode = nodes.get(currentId);
    for (const segment of list(context.selectedObject?.segments)) {
      const segmentNode = addEntityNode(nodes, segment, "environment_segment", "environment_segment", "environment", 2.5);
      if (segmentNode) addEdge(edges, { source: segmentNode.id, target: currentId, type: "segment_to_object", weight: 1 });
    }
    const environmentNode = addEntityNode(nodes, context.selectedEnvironment, "information_environment", "information_environment", "environment", 3.2);
    if (environmentNode) addEdge(edges, { source: environmentNode.id, target: currentId, type: "environment_to_object", weight: 1.1 });
    addScopeServiceCapabilityOverview({ nodes, edges, sourceNode: currentNode, rows: context.scopeServiceRows, workbenchViewModel, includeObjectNode: false });
    for (const row of list(context.scopeServiceRows)) {
      for (const service of list(row.services)) {
        const serviceNode = addEntityNode(nodes, service, "technical_service", "technical_service", "technical", 2.4);
        if (!serviceNode) continue;
        for (const module of list(row.modules)) {
          const isMeasure = text(module.kind || module.objectKind || module.type).includes("措施") || module.type === "security_technical_measure";
          const moduleNode = addEntityNode(nodes, module, isMeasure ? "technical_measure" : "technical_module", isMeasure ? "technical_measure" : "technical_module", "technical", isMeasure ? 1.6 : 1.9);
          if (!moduleNode) continue;
          addEdge(edges, { source: serviceNode.id, target: moduleNode.id, type: isMeasure ? "service_to_measure" : "service_to_module", weight: 0.9 });
          for (const system of list(module.systems)) {
            const systemNode = addEntityNode(nodes, system, "security_system", "security_system", "asset", 1.5);
            if (systemNode) addEdge(edges, { source: moduleNode.id, target: systemNode.id, type: "module_to_system", weight: 0.7 });
          }
          for (const product of list(module.products)) {
            const productNode = addEntityNode(nodes, product, "product", "product", "asset", 1.4);
            if (productNode) addEdge(edges, { source: moduleNode.id, target: productNode.id, type: "module_to_product", weight: 0.7 });
          }
        }
      }
    }
    return graphResponse(nodes, edges, {
      strategy: "environment_object_full",
      graphScope: "object",
      note: `E2 对象完整图：展示当前信息化对象的 ${context.summary?.scopeCount || 0} 个作用域、${context.summary?.serviceCount || 0} 个服务、${context.summary?.moduleCount || 0} 个模块 / 措施，以及系统、产品和能力 / 关注点关联。`,
    });
  }

  function buildEnvironmentRelationGraphModel({ viewModel } = {}) {
    const context = viewModel?.environmentGraphContext || {};
    const nodes = new Map();
    const edges = new Map();
    const current = context.current || context.selectedObject || context.selectedSegment || context.selectedEnvironment;
    if (!validBusinessNode(current)) return graphResponse(nodes, edges, { strategy: "empty_environment_graph" });
    const currentId = stableId("current_environment", current, "current-environment");
    addNode(nodes, {
      id: currentId,
      label: titleOf(current, "当前对象"),
      type: "current_focus",
      group: "current",
      weight: 10,
      isCurrent: true,
      meta: {
        code: codeOf(current),
        capability: titleOf(current, "当前对象"),
        capabilityCode: codeOf(current),
      },
    });
    const workbenchViewModel = context.workbenchViewModel || viewModel?.workbenchViewModel || {};
    if (context.selectionType === "environment") return buildEnvironmentStructureGraph({ context, nodes, edges, currentId });
    if (context.selectionType === "segment") return buildSegmentOverviewGraph({ context, nodes, edges, currentId, workbenchViewModel });
    return buildObjectFullGraph({ context, nodes, edges, currentId, workbenchViewModel });
  }

  models.buildEnvironmentRelationGraphModel = buildEnvironmentRelationGraphModel;
})();
