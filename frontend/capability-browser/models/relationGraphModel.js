(function () {
  const models = (window.sapdModels = window.sapdModels || {});

  const LAYERS = [
    { key: "decision", label: "决策层" },
    { key: "management", label: "管理层" },
    { key: "execution", label: "执行层" },
    { key: "supervision", label: "监督层" },
  ];

  function list(value) {
    return Array.isArray(value) ? value : [];
  }

  function text(value) {
    return value == null ? "" : String(value);
  }

  function valueOf(value, fallback = "待补充") {
    const normalized = text(value).trim();
    return normalized || fallback;
  }

  function entityTitle(item, fallback = "待补充") {
    if (item == null) return fallback;
    if (typeof item === "string") return valueOf(item, fallback);
    return valueOf(item.title || item.name || item.serviceName || item.scopeName || item.code || item.id, fallback);
  }

  function entityCode(item) {
    return text(item?.code || item?.serviceCode || item?.scopeCode || "").trim();
  }

  function hasBusinessLabel(item) {
    const title = entityTitle(item, "");
    if (!title) return false;
    return !["待补充", "暂无", "无直接投影", "待投影"].includes(title);
  }

  function keyPart(value) {
    return text(value)
      .trim()
      .replace(/[^\w\u4e00-\u9fa5.-]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  function stableId(prefix, item, fallback) {
    const id = keyPart(item?.id || item?.code || item?.serviceCode || item?.scopeCode || item?.title || item?.name || fallback);
    return `${prefix}:${id || keyPart(fallback) || "node"}`;
  }

  function layerKeyOf(item = {}) {
    const layer = text(item.layer || item.layerLabel).trim();
    return LAYERS.find((entry) => entry.key === layer || entry.label === layer)?.key || "unknown";
  }

  function addNode(nodes, node) {
    if (!node?.id || nodes.has(node.id)) return nodes.get(node?.id);
    const normalized = {
      label: "待补充",
      type: "empty_state",
      group: "unknown",
      weight: 1,
      isCurrent: false,
      isDecorative: false,
      meta: {},
      ...node,
    };
    nodes.set(normalized.id, normalized);
    return normalized;
  }

  function addEdge(edges, edge) {
    if (!edge?.source || !edge?.target || edge.source === edge.target) return;
    const id = edge.id || `${edge.type || "edge"}:${edge.source}->${edge.target}`;
    if (edges.has(id)) return;
    edges.set(id, {
      id,
      type: "decorative_link",
      weight: 1,
      isDecorative: false,
      ...edge,
    });
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

  function technicalRowsFromLocalMap(localRelationMap = {}) {
    return list(localRelationMap.technical?.scopeServicePairs).map((pair) => ({
      scope: {
        id: pair.scopeId || pair.scopeCode || pair.scopeName,
        code: pair.scopeCode || "",
        title: pair.scopeName || pair.scopeTitle || "待补充作用域",
      },
      services: [
        {
          id: pair.serviceId || pair.serviceCode || pair.serviceName,
          code: pair.serviceCode || "",
          title: pair.serviceName || pair.serviceTitle || "待补充服务",
        },
      ],
    }));
  }

  function managementRowsFromLocalMap(localRelationMap = {}) {
    const management = localRelationMap.management || {};
    const processTree = list(management.processTree);
    return [
      {
        securityWorks: list(management.securityWorks),
        stakeholders: list(management.workFunctions),
        processGroups: processTree.map((group) => group.l2ProcessGroup || group),
        processReferences: processTree.flatMap((group) => list(group.l3Processes)),
        activities: processTree.flatMap((group) => list(group.l3Processes).flatMap((process) => list(process.activities))),
        hasMissingActivity: processTree.some((group) => list(group.l3Processes).some((process) => !list(process.activities).length)),
      },
    ];
  }

  function addDecorativeNetwork(nodes, edges) {
    const points = [
      [92, 74, 3], [156, 142, 2], [244, 78, 4], [332, 126, 2], [504, 72, 3], [636, 112, 2], [792, 66, 3],
      [1040, 88, 2], [1112, 156, 3], [984, 238, 2], [1124, 306, 4], [1038, 428, 2], [1120, 512, 3],
      [820, 536, 2], [684, 498, 3], [514, 540, 2], [348, 504, 4], [222, 552, 2], [104, 448, 3],
      [176, 332, 2], [294, 382, 3], [420, 452, 2], [560, 404, 3], [744, 392, 2], [906, 342, 3],
      [712, 236, 2], [584, 248, 3], [472, 214, 2], [318, 236, 3], [206, 214, 2], [74, 240, 3],
    ];
    points.forEach(([x, y, weight], index) => {
      addNode(nodes, {
        id: `decorative:${index}`,
        label: "",
        type: "decorative",
        group: "decorative",
        weight,
        isDecorative: true,
        meta: { x, y },
      });
    });
    const pairs = [
      [0, 1], [1, 2], [2, 3], [3, 5], [4, 5], [5, 6], [6, 7], [7, 8], [8, 9], [9, 10],
      [10, 11], [11, 12], [12, 13], [13, 14], [14, 15], [15, 16], [16, 17], [17, 18], [18, 19],
      [19, 20], [20, 21], [21, 22], [22, 23], [23, 24], [24, 25], [25, 26], [26, 27], [27, 28],
      [28, 29], [29, 30], [2, 28], [5, 26], [14, 23], [16, 22], [21, 27],
    ];
    pairs.forEach(([source, target], index) => {
      addEdge(edges, {
        id: `decorative-link:${index}`,
        source: `decorative:${source}`,
        target: `decorative:${target}`,
        type: "decorative_link",
        weight: 0.25,
        isDecorative: true,
      });
    });
  }

  function addViewNode(nodes, edges, focusId, id, label, type, group) {
    const node = addNode(nodes, {
      id,
      label,
      type,
      group,
      weight: 6,
      meta: {},
    });
    addEdge(edges, { source: focusId, target: node.id, type: "focus_to_view", weight: 4 });
    return node;
  }

  function buildLocalRelationGraphModel({ currentFocus, currentCapability, localRelationMap, technicalMappingRows, managementMappingRows, standardRows } = {}) {
    const nodes = new Map();
    const edges = new Map();
    const focus = currentFocus || localRelationMap?.focus || {};
    const focusId = stableId("current", focus, "current-focus");
    addNode(nodes, {
      id: focusId,
      label: entityTitle(focus, "当前关注点"),
      type: "current_focus",
      group: "current",
      weight: 10,
      isCurrent: true,
      meta: {
        code: entityCode(focus),
        capability: entityTitle(currentCapability, ""),
        capabilityCode: entityCode(currentCapability),
        tag: "能力-关注点",
      },
    });

    const techRows = list(technicalMappingRows).length ? list(technicalMappingRows) : technicalRowsFromLocalMap(localRelationMap);
    const technicalView = addViewNode(nodes, edges, focusId, "view:technical", "技术视角", "view_technical", "technical");
    for (const row of techRows) {
      const scope = row.scope || {};
      if (!hasBusinessLabel(scope)) continue;
      const scopeNode = addNode(nodes, {
        id: stableId("scope", scope, `scope:${entityTitle(scope)}`),
        label: entityTitle(scope, "待补充作用域"),
        type: "scope",
        group: "technical",
        weight: 4,
        meta: { code: entityCode(scope) },
      });
      addEdge(edges, { source: technicalView.id, target: scopeNode.id, type: "view_to_scope", weight: 3 });
      for (const service of list(row.services).slice(0, 4)) {
        if (!hasBusinessLabel(service)) continue;
        const serviceNode = addNode(nodes, {
          id: stableId("technical_service", service, `service:${entityTitle(service)}`),
          label: entityTitle(service, "待补充服务"),
          type: "technical_service",
          group: "technical",
          weight: 3,
          meta: { code: entityCode(service) },
        });
        addEdge(edges, { source: scopeNode.id, target: serviceNode.id, type: "scope_to_service", weight: 2 });
        for (const module of list(row.modules).filter(hasBusinessLabel).slice(0, 4)) {
          const objectKind = text(module.objectKind || module.kind || module.type);
          const isMeasure = objectKind.includes("措施") || objectKind.includes("measure");
          const moduleNode = addNode(nodes, {
            id: stableId(isMeasure ? "technical_measure" : "technical_module", module, `${isMeasure ? "measure" : "module"}:${entityTitle(module)}`),
            label: entityTitle(module, isMeasure ? "技术措施" : "技术模块"),
            type: isMeasure ? "technical_measure" : "technical_module",
            group: "technical",
            weight: 1.6,
            meta: { code: entityCode(module) },
          });
          addEdge(edges, { source: serviceNode.id, target: moduleNode.id, type: isMeasure ? "service_to_measure" : "service_to_module", weight: 1 });
        }
      }
    }

    const managementRows = list(managementMappingRows).length ? list(managementMappingRows) : managementRowsFromLocalMap(localRelationMap);
    const managementView = addViewNode(nodes, edges, focusId, "view:management", "管理视角", "view_management", "management");
    const functionRoot = addNode(nodes, { id: "management-root:functions", label: "安全职能", type: "management_function_root", group: "management", weight: 4.6, meta: {} });
    const workRoot = addNode(nodes, { id: "management-root:works", label: "安全工作", type: "management_work_root", group: "management", weight: 4.2, meta: {} });
    const processRoot = addNode(nodes, { id: "management-root:processes", label: "流程", type: "management_process_root", group: "management", weight: 4.2, meta: {} });
    addEdge(edges, { source: managementView.id, target: functionRoot.id, type: "view_to_management_function_root", weight: 2 });
    addEdge(edges, { source: managementView.id, target: workRoot.id, type: "view_to_management_work_root", weight: 2 });
    addEdge(edges, { source: managementView.id, target: processRoot.id, type: "view_to_management_process_root", weight: 2 });
    const layerNodes = Object.fromEntries(
      LAYERS.map((layer) => {
        const node = addNode(nodes, {
          id: `security-function-layer:${layer.key}`,
          label: layer.label,
          type: "security_function_layer",
          group: `management:${layer.key}`,
          weight: 2.4,
          meta: { layer: layer.label },
        });
        addEdge(edges, { source: functionRoot.id, target: node.id, type: "management_function_root_to_layer", weight: 1.5 });
        return [layer.key, node];
      }),
    );
    for (const row of managementRows) {
      const works = unique(list(row.securityWorks).filter(hasBusinessLabel), (item) => item.id || item.code || entityTitle(item)).slice(0, 4);
      const functions = unique(list(row.stakeholders).filter(hasBusinessLabel), (item) => `${layerKeyOf(item)}:${item.id || item.code || entityTitle(item)}`).slice(0, 10);
      const processGroups = unique(list(row.processGroups).filter(hasBusinessLabel), (item) => item.id || item.code || entityTitle(item)).slice(0, 3);
      const processes = unique(list(row.processReferences).filter(hasBusinessLabel), (item) => item.id || item.code || entityTitle(item)).slice(0, 5);
      const activities = unique(list(row.activities).filter(hasBusinessLabel), (item) => item.id || item.code || entityTitle(item)).slice(0, 4);
      const workNodes = works.map((work) =>
        addNode(nodes, {
          id: stableId("security_work", work, `work:${entityTitle(work)}`),
          label: entityTitle(work, "安全工作"),
          type: "security_work",
          group: "management",
          weight: 4,
          meta: { code: entityCode(work) },
        }),
      );
      const functionNodes = functions.map((workFunction) => {
        const layer = layerKeyOf(workFunction);
        const layerDef = LAYERS.find((item) => item.key === layer);
        return addNode(nodes, {
          id: stableId("security_function", workFunction, `function:${layer}:${entityTitle(workFunction)}`),
          label: entityTitle(workFunction, "安全职能"),
          type: "security_function",
          group: `management:${layer}`,
          weight: 3,
          meta: { code: entityCode(workFunction), layer: layerDef?.label || workFunction.layerLabel || "待确认职能" },
        });
      });
      const l2Nodes = processGroups.map((processGroup) =>
        addNode(nodes, {
          id: stableId("process_l2", processGroup, `l2:${entityTitle(processGroup)}`),
          label: entityTitle(processGroup, "L2流程组"),
          type: "process_l2",
          group: "management",
          weight: 3,
          meta: { code: entityCode(processGroup) },
        }),
      );
      const l3Nodes = processes.map((process) =>
        addNode(nodes, {
          id: stableId("process_l3", process, `l3:${entityTitle(process)}`),
          label: entityTitle(process, "L3流程"),
          type: "process_l3",
          group: "management",
          weight: 2,
          meta: { code: entityCode(process) },
        }),
      );
      const l4Nodes = activities.map((activity) =>
        addNode(nodes, {
          id: stableId("process_l4", activity, `l4:${entityTitle(activity)}`),
          label: entityTitle(activity, "L4活动"),
          type: "process_l4",
          group: "management",
          weight: 1.7,
          meta: { code: entityCode(activity) },
        }),
      );
      workNodes.forEach((workNode) => addEdge(edges, { source: workRoot.id, target: workNode.id, type: "management_work_root_to_work", weight: 1.5 }));
      functionNodes.forEach((functionNode) => {
        const layer = layerKeyOf(functionNode.meta);
        const layerNode = layerNodes[layer] || layerNodes.management;
        addEdge(edges, { source: layerNode.id, target: functionNode.id, type: "layer_to_function", weight: 1.2 });
      });
      l2Nodes.forEach((l2Node) => addEdge(edges, { source: processRoot.id, target: l2Node.id, type: "management_process_root_to_l2", weight: 1.5 }));
      l2Nodes.forEach((l2Node) => l3Nodes.forEach((l3Node) => addEdge(edges, { source: l2Node.id, target: l3Node.id, type: "process_l2_to_l3", weight: 1.2 })));
      l3Nodes.forEach((l3Node) => l4Nodes.forEach((l4Node) => addEdge(edges, { source: l3Node.id, target: l4Node.id, type: "process_l3_to_l4", weight: 1 })));
    }

    const standards = list(standardRows).length ? list(standardRows) : list(localRelationMap?.standards?.frameworks || localRelationMap?.standardFrameworks);
    const standardView = addViewNode(nodes, edges, focusId, "view:standard", "标准 / 框架映射", "view_standard", "standard");
    if (standards.length) {
      standards.slice(0, 4).forEach((standard) => {
        const standardNode = addNode(nodes, {
          id: stableId("standard_status", standard, `standard:${entityTitle(standard)}`),
          label: entityTitle(standard, "标准 / 框架"),
          type: "standard_status",
          group: "standard",
          weight: 2,
          meta: { code: entityCode(standard) },
        });
        addEdge(edges, { source: standardView.id, target: standardNode.id, type: "view_to_standard_status", weight: 1.4 });
      });
    } else {
      const standardNode = addNode(nodes, {
        id: "standard-status:pending",
        label: "待投影",
        type: "standard_status",
        group: "standard",
        weight: 1.2,
        meta: {},
      });
      addEdge(edges, { source: standardView.id, target: standardNode.id, type: "view_to_standard_status", weight: 1 });
    }

    addDecorativeNetwork(nodes, edges);

    const nodeRows = [...nodes.values()];
    const edgeRows = [...edges.values()];
    return {
      nodes: nodeRows,
      edges: edgeRows,
      groups: [
        { key: "technical", label: "技术视角" },
        { key: "management", label: "管理视角" },
        { key: "standard", label: "标准 / 框架映射" },
      ],
      stats: {
        businessNodes: nodeRows.filter((node) => !node.isDecorative).length,
        businessEdges: edgeRows.filter((edge) => !edge.isDecorative).length,
        decorativeNodes: nodeRows.filter((node) => node.isDecorative).length,
        decorativeEdges: edgeRows.filter((edge) => edge.isDecorative).length,
        technicalRows: techRows.length,
        managementRows: managementRows.length,
      },
    };
  }

  models.buildLocalRelationGraphModel = buildLocalRelationGraphModel;
})();
