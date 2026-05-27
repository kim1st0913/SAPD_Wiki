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
    return valueOf(item.title || item.name || item.serviceName || item.scopeName || item.standard || item.code || item.id, fallback);
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

  function contextualStableId(prefix, contextId, item, fallback) {
    const itemKey = item?.id || item?.code || item?.serviceCode || item?.scopeCode || item?.title || item?.name || fallback;
    return stableId(prefix, { id: `${contextId}:${itemKey || fallback}` }, fallback);
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

  function evenlySample(items, limit) {
    const rows = list(items);
    if (!Number.isFinite(limit) || rows.length <= limit) return rows;
    if (limit <= 0) return [];
    if (limit === 1) return rows.slice(0, 1);
    const step = (rows.length - 1) / (limit - 1);
    return Array.from({ length: limit }, (_, index) => rows[Math.round(index * step)]).filter(Boolean);
  }

  function graphScopeOf(focus = {}) {
    const type = text(focus.type);
    if (type === "capability_category") return "category";
    if (type === "capability_domain") return "domain";
    if (type === "capability") return "capability";
    return "focus";
  }

  function graphLimits(scope) {
    const presets = {
      category: {
        technicalRows: 16,
        servicesPerRow: 2,
        modulesPerRow: 1,
        managementRows: 12,
        worksPerRow: 2,
        functionsPerRow: 4,
        processGroupsPerRow: 1,
        processesPerRow: 2,
        activitiesPerRow: 1,
        standards: 4,
        controlsPerStandard: 2,
      },
      domain: {
        technicalRows: 24,
        servicesPerRow: 2,
        modulesPerRow: 2,
        managementRows: 16,
        worksPerRow: 3,
        functionsPerRow: 5,
        processGroupsPerRow: 2,
        processesPerRow: 2,
        activitiesPerRow: 2,
        standards: 4,
        controlsPerStandard: 3,
      },
      capability: {
        technicalRows: 36,
        servicesPerRow: 3,
        modulesPerRow: 2,
        managementRows: 24,
        worksPerRow: 3,
        functionsPerRow: 7,
        processGroupsPerRow: 2,
        processesPerRow: 3,
        activitiesPerRow: 2,
        standards: 5,
        controlsPerStandard: 4,
      },
      focus: {
        technicalRows: Infinity,
        servicesPerRow: 4,
        modulesPerRow: 4,
        managementRows: Infinity,
        worksPerRow: 4,
        functionsPerRow: 10,
        processGroupsPerRow: 3,
        processesPerRow: 5,
        activitiesPerRow: 4,
        standards: Infinity,
        controlsPerStandard: Infinity,
      },
    };
    return presets[scope] || presets.focus;
  }

  function compactFocusRowFocus(row = {}) {
    return row.focus || row;
  }

  function focusCodePrefix(focus = {}) {
    const code = entityCode(focus) || text(focus.code);
    const match = code.match(/^(.+)-\d+$/);
    return match?.[1] || code || "未编码能力";
  }

  function focusRowsFromInputs(focusOverview = {}, technicalRows = [], managementRows = [], standardRows = []) {
    const byId = new Map();
    const addFocus = (focus, path = null) => {
      if (!focus?.id && !focus?.code && !focus?.title && !focus?.name) return;
      const id = focus.id || focus.code || focus.title || focus.name;
      if (!byId.has(id)) byId.set(id, { focus, path });
      else if (path && !byId.get(id).path) byId.get(id).path = path;
    };
    list(focusOverview.rows).forEach((row) => addFocus(compactFocusRowFocus(row), row.path));
    list(technicalRows).forEach((row) => addFocus(row.focus));
    list(managementRows).forEach((row) => addFocus(row.focus));
    list(standardRows).forEach((row) => addFocus(row.focus));
    return [...byId.values()];
  }

  function capabilityFromFocusRow(row = {}) {
    const focus = compactFocusRowFocus(row);
    const capability = row.path?.capability;
    return {
      id: capability?.id || capability?.code || focusCodePrefix(focus),
      code: capability?.code || focusCodePrefix(focus),
      title: capability?.title || capability?.name || focusCodePrefix(focus),
    };
  }

  function domainFromFocusRow(row = {}) {
    const focus = compactFocusRowFocus(row);
    const domain = row.path?.domain;
    const focusCode = entityCode(focus) || text(focus.code);
    const domainCode = focusCode.split(".")[0] || "";
    return {
      id: domain?.id || domain?.code || domainCode || "未编码L1",
      code: domain?.code || domainCode || "",
      title: domain?.title || domain?.name || domainCode || "待补充L1",
    };
  }

  function rowsByFocus(rows = []) {
    const grouped = new Map();
    for (const row of list(rows)) {
      const focus = row.focus || {};
      const id = focus.id || focus.code || focus.title || focus.name;
      if (!id) continue;
      if (!grouped.has(id)) grouped.set(id, []);
      grouped.get(id).push(row);
    }
    return grouped;
  }

  function buildGraphResponse(nodes, edges, stats = {}) {
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
        ...stats,
      },
    };
  }

  function buildCategoryStructureGraph({ nodes, edges, focusId, focusOverview, technicalRows, managementRows, standardRows }) {
    const focusRows = focusRowsFromInputs(focusOverview, technicalRows, managementRows, standardRows);
    const domainNodes = new Map();
    const capabilityNodes = new Map();
    focusRows.forEach((row) => {
      const domain = domainFromFocusRow(row);
      const capability = capabilityFromFocusRow(row);
      const domainId = stableId("domain_overview", domain, `domain:${domain.code || domain.title}`);
      if (!domainNodes.has(domainId)) {
        const domainNode = addNode(nodes, {
          id: domainId,
          label: entityTitle(domain, "L1能力域"),
          type: "domain_overview",
          group: "capability",
          weight: 5.2,
          meta: { code: entityCode(domain) || domain.code || "", hierarchyDepth: 1 },
        });
        domainNodes.set(domainId, domainNode);
        addEdge(edges, { source: focusId, target: domainNode.id, type: "category_to_domain", weight: 2.4 });
      }
      const capabilityId = stableId("capability_overview", capability, `capability:${capability.code || capability.title}`);
      if (!capabilityNodes.has(capabilityId)) {
        const capabilityNode = addNode(nodes, {
          id: capabilityId,
          label: entityTitle(capability, "能力"),
          type: "capability_overview",
          group: "capability",
          weight: 4.8,
          meta: { code: entityCode(capability) || capability.code || "", hierarchyDepth: 2 },
        });
        capabilityNodes.set(capabilityId, capabilityNode);
        addEdge(edges, { source: domainId, target: capabilityNode.id, type: "domain_to_capability", weight: 1.6 });
      }
    });
    return buildGraphResponse(nodes, edges, {
      strategy: "category_structure",
      graphScope: "category",
      domainCount: domainNodes.size,
      capabilityCount: capabilityNodes.size,
      focusCount: 0,
    });
  }

  function buildDomainStructureGraph({ nodes, edges, focusId, focusOverview, technicalRows, managementRows, standardRows }) {
    const focusRows = focusRowsFromInputs(focusOverview, technicalRows, managementRows, standardRows);
    const capabilityNodes = new Map();
    const focusNodes = new Map();
    focusRows.forEach((row) => {
      const focus = compactFocusRowFocus(row);
      const capability = capabilityFromFocusRow(row);
      const capabilityId = stableId("capability_overview", capability, `capability:${capability.code || capability.title}`);
      if (!capabilityNodes.has(capabilityId)) {
        const capabilityNode = addNode(nodes, {
          id: capabilityId,
          label: entityTitle(capability, "L2能力"),
          type: "capability_overview",
          group: "capability",
          weight: 5,
          meta: { code: entityCode(capability) || capability.code || "", hierarchyDepth: 1 },
        });
        capabilityNodes.set(capabilityId, capabilityNode);
        addEdge(edges, { source: focusId, target: capabilityNode.id, type: "domain_to_capability", weight: 2.1 });
      }
      const focusNode = addNode(nodes, {
        id: stableId("focus_overview", focus, `focus:${entityTitle(focus)}`),
        label: entityTitle(focus, "关注点"),
        type: "focus_overview",
        group: "focus",
        weight: 2.2,
        meta: { code: entityCode(focus), hierarchyDepth: 2 },
      });
      focusNodes.set(focusNode.id, focusNode);
      addEdge(edges, { source: capabilityId, target: focusNode.id, type: "capability_to_focus", weight: 1.3 });
    });
    return buildGraphResponse(nodes, edges, {
      strategy: "domain_structure",
      graphScope: "domain",
      capabilityCount: capabilityNodes.size,
      focusCount: focusNodes.size,
    });
  }

  function buildFocusMappingOverviewGraph({ nodes, edges, focusId, graphScope, focusOverview, technicalRows, managementRows, standardRows }) {
    const focusRows = focusRowsFromInputs(focusOverview, technicalRows, managementRows, standardRows);
    const technicalByFocus = rowsByFocus(technicalRows);
    const managementByFocus = rowsByFocus(managementRows);
    const standardByFocus = rowsByFocus(standardRows);
    focusRows.forEach((row) => {
      const focus = compactFocusRowFocus(row);
      const rowFocusId = focus.id || focus.code || focus.title || focus.name;
      if (!rowFocusId) return;
      const contextId = keyPart(rowFocusId || entityTitle(focus));
      const focusNode = addNode(nodes, {
        id: stableId("focus_overview", focus, `focus:${entityTitle(focus)}`),
        label: entityTitle(focus, "关注点"),
        type: "focus_overview",
        group: "focus",
        weight: 3,
        meta: { code: entityCode(focus), hierarchyDepth: 1, radius: 44 },
      });
      addEdge(edges, { source: focusId, target: focusNode.id, type: "capability_to_focus", weight: 2 });

      const techRows = technicalByFocus.get(rowFocusId) || [];
      const scopes = unique(techRows.map((techRow) => techRow.scope).filter(hasBusinessLabel), (item) => item.id || item.code || entityTitle(item));
      if (scopes.length) {
        const technicalViewNode = addNode(nodes, {
          id: stableId("view_technical", { id: `${focusNode.id}:technical`, title: "技术视角" }, `technical-view:${focusNode.id}`),
          label: "技术视角",
          type: "view_technical",
          group: "technical",
          weight: 2.6,
          meta: { hierarchyDepth: 2, radius: 38 },
        });
        addEdge(edges, { source: focusNode.id, target: technicalViewNode.id, type: "focus_to_technical_view", weight: 1.4 });
        scopes.forEach((scope) => {
          const scopeNode = addNode(nodes, {
            id: contextualStableId("scope", contextId, scope, `scope:${entityTitle(scope)}`),
            label: entityTitle(scope, "作用域"),
            type: "scope",
            group: "technical",
            weight: 2.1,
            meta: { code: entityCode(scope), hierarchyDepth: 3, parentFocusId: focusNode.id, radius: 8 },
          });
          addEdge(edges, { source: technicalViewNode.id, target: scopeNode.id, type: "view_to_scope", weight: 1.1 });
        });
      }

      for (const managementRow of managementByFocus.get(rowFocusId) || []) {
        const securityWorks = unique(list(managementRow.securityWorks).filter(hasBusinessLabel), (item) => item.id || item.code || entityTitle(item));
        if (!securityWorks.length) continue;
        const managementViewNode = addNode(nodes, {
          id: stableId("view_management", { id: `${focusNode.id}:management`, title: "管理视角" }, `management-view:${focusNode.id}`),
          label: "管理视角",
          type: "view_management",
          group: "management",
          weight: 2.6,
          meta: { hierarchyDepth: 2, radius: 38 },
        });
        addEdge(edges, { source: focusNode.id, target: managementViewNode.id, type: "focus_to_management_view", weight: 1.4 });
        securityWorks.forEach((work) => {
          const workNode = addNode(nodes, {
            id: contextualStableId("security_work", contextId, work, `work:${entityTitle(work)}`),
            label: entityTitle(work, "安全工作"),
            type: "security_work",
            group: "management",
            weight: 2.1,
            meta: { code: entityCode(work), hierarchyDepth: 3, parentFocusId: focusNode.id, radius: 8 },
          });
          addEdge(edges, { source: managementViewNode.id, target: workNode.id, type: "view_to_work", weight: 1.1 });
        });
      }

      const standards = unique(
        (standardByFocus.get(rowFocusId) || []).flatMap((standardRow) => list(standardRow.standards)).filter(hasBusinessLabel),
        (item) => item.id || item.code || entityTitle(item),
      );
      if (standards.length) {
        const standardViewNode = addNode(nodes, {
          id: stableId("view_standard", { id: `${focusNode.id}:standard`, title: "标准 / 框架" }, `standard-view:${focusNode.id}`),
          label: "标准 / 框架",
          type: "view_standard",
          group: "standard",
          weight: 2.6,
          meta: { hierarchyDepth: 2, radius: 42 },
        });
        addEdge(edges, { source: focusNode.id, target: standardViewNode.id, type: "focus_to_standard_view", weight: 1.4 });
        standards.forEach((standard) => {
          const standardCode = entityCode(standard) || keyPart(standard.standard || standard.title || standard.name);
          const standardNode = addNode(nodes, {
            id: contextualStableId("standard_status", contextId, { ...standard, code: standardCode }, `standard:${entityTitle(standard)}`),
            label: entityTitle(standard, "标准 / 框架"),
            type: "standard_status",
            group: "standard",
            weight: 2.1,
            meta: { code: standardCode, hierarchyDepth: 3, parentFocusId: focusNode.id, radius: 8 },
          });
          addEdge(edges, { source: standardViewNode.id, target: standardNode.id, type: "standard_view_to_standard_status", weight: 1.1 });
        });
      }
    });
    return buildGraphResponse(nodes, edges, {
      strategy: "focus_mapping_overview",
      graphScope,
      focusCount: focusRows.length,
      technicalRows: technicalRows.length,
      managementRows: managementRows.length,
      standardRows: standardRows.length,
    });
  }

  function technicalRowsFromLocalMap(localRelationMap = {}) {
    return list(localRelationMap.technical?.scopeServicePairs)
      .filter((pair) => hasBusinessLabel({ id: pair.serviceId || pair.serviceCode, code: pair.serviceCode, title: pair.serviceName || pair.serviceTitle }))
      .map((pair) => ({
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

  function hasTechnicalGraphRelation(row = {}) {
    return list(row.services).some(hasBusinessLabel);
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
    const radiusByType = {
      view_technical: 38,
      view_management: 38,
      view_standard: 42,
    };
    const node = addNode(nodes, {
      id,
      label,
      type,
      group,
      weight: 6,
      meta: { radius: radiusByType[type] },
    });
    addEdge(edges, { source: focusId, target: node.id, type: "focus_to_view", weight: 4 });
    return node;
  }

  function buildLocalRelationGraphModel({ currentFocus, currentCapability, focusOverview, localRelationMap, technicalMappingRows, managementMappingRows, standardRows } = {}) {
    const nodes = new Map();
    const edges = new Map();
    const focus = currentFocus || localRelationMap?.focus || {};
    const graphScope = graphScopeOf(focus);
    const limits = graphLimits(graphScope);
    const focusId = stableId("current", focus, "current-focus");
    addNode(nodes, {
      id: focusId,
      label: entityTitle(focus, "当前关注点"),
      type: graphScope === "capability" ? "current_capability" : "current_focus",
      group: "current",
      weight: 10,
      isCurrent: true,
      meta: {
        code: entityCode(focus),
        currentTitle: entityTitle(focus, "当前能力"),
        currentCode: entityCode(focus),
        hierarchyDepth: 0,
        capability: entityTitle(currentCapability, ""),
        capabilityCode: entityCode(currentCapability),
        tag: "能力-关注点",
      },
    });

    const allTechRows = (list(technicalMappingRows).length ? list(technicalMappingRows) : technicalRowsFromLocalMap(localRelationMap)).filter(hasTechnicalGraphRelation);
    const allManagementRows = list(managementMappingRows).length ? list(managementMappingRows) : managementRowsFromLocalMap(localRelationMap);
    const standards = list(standardRows).length ? list(standardRows) : list(localRelationMap?.standards?.frameworks || localRelationMap?.standardFrameworks);
    if (graphScope === "category") {
      return buildCategoryStructureGraph({ nodes, edges, focusId, focusOverview, technicalRows: allTechRows, managementRows: allManagementRows, standardRows: standards });
    }
    if (graphScope === "domain") {
      return buildDomainStructureGraph({ nodes, edges, focusId, focusOverview, technicalRows: allTechRows, managementRows: allManagementRows, standardRows: standards });
    }
    if (graphScope === "capability") {
      return buildFocusMappingOverviewGraph({ nodes, edges, focusId, graphScope, focusOverview, technicalRows: allTechRows, managementRows: allManagementRows, standardRows: standards });
    }

    const techRows = evenlySample(allTechRows, limits.technicalRows);
    if (techRows.length) {
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
        for (const service of list(row.services).slice(0, limits.servicesPerRow)) {
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
          for (const module of list(row.modules).filter(hasBusinessLabel).slice(0, limits.modulesPerRow)) {
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
    }

    const managementRows = evenlySample(allManagementRows, limits.managementRows);
    const managementView = addViewNode(nodes, edges, focusId, "view:management", "管理视角", "view_management", "management");
    const activeFunctionLayerKeys = new Set();
    let hasSecurityWorks = false;
    let hasProcessData = false;
    managementRows.forEach((row) => {
      if (list(row.securityWorks).some(hasBusinessLabel)) hasSecurityWorks = true;
      if (list(row.processGroups).some(hasBusinessLabel) || list(row.processReferences).some(hasBusinessLabel) || list(row.activities).some(hasBusinessLabel)) {
        hasProcessData = true;
      }
      unique(list(row.stakeholders).filter(hasBusinessLabel), (item) => `${layerKeyOf(item)}:${item.id || item.code || entityTitle(item)}`)
        .slice(0, limits.functionsPerRow)
        .forEach((item) => activeFunctionLayerKeys.add(layerKeyOf(item)));
    });
    const functionRoot = activeFunctionLayerKeys.size
      ? addNode(nodes, { id: "management-root:functions", label: "安全职能", type: "management_function_root", group: "management", weight: 4.6, meta: {} })
      : null;
    const workRoot = hasSecurityWorks
      ? addNode(nodes, { id: "management-root:works", label: "安全工作", type: "management_work_root", group: "management", weight: 4.2, meta: {} })
      : null;
    const processRoot = hasProcessData
      ? addNode(nodes, { id: "management-root:processes", label: "流程", type: "management_process_root", group: "management", weight: 4.2, meta: {} })
      : null;
    if (functionRoot) addEdge(edges, { source: managementView.id, target: functionRoot.id, type: "view_to_management_function_root", weight: 2 });
    if (workRoot) addEdge(edges, { source: managementView.id, target: workRoot.id, type: "view_to_management_work_root", weight: 2 });
    if (processRoot) addEdge(edges, { source: managementView.id, target: processRoot.id, type: "view_to_management_process_root", weight: 2 });
    const layerNodes = Object.fromEntries(
      LAYERS.filter((layer) => activeFunctionLayerKeys.has(layer.key)).map((layer) => {
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
      const works = unique(list(row.securityWorks).filter(hasBusinessLabel), (item) => item.id || item.code || entityTitle(item)).slice(0, limits.worksPerRow);
      const functions = unique(list(row.stakeholders).filter(hasBusinessLabel), (item) => `${layerKeyOf(item)}:${item.id || item.code || entityTitle(item)}`).slice(0, limits.functionsPerRow);
      const processGroups = unique(list(row.processGroups).filter(hasBusinessLabel), (item) => item.id || item.code || entityTitle(item)).slice(0, limits.processGroupsPerRow);
      const processes = unique(list(row.processReferences).filter(hasBusinessLabel), (item) => item.id || item.code || entityTitle(item)).slice(0, limits.processesPerRow);
      const activities = unique(list(row.activities).filter(hasBusinessLabel), (item) => item.id || item.code || entityTitle(item)).slice(0, limits.activitiesPerRow);
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
        const layerNode = layerNodes[layer];
        if (layerNode) addEdge(edges, { source: layerNode.id, target: functionNode.id, type: "layer_to_function", weight: 1.2 });
      });
      l2Nodes.forEach((l2Node) => addEdge(edges, { source: processRoot.id, target: l2Node.id, type: "management_process_root_to_l2", weight: 1.5 }));
      l2Nodes.forEach((l2Node) => l3Nodes.forEach((l3Node) => addEdge(edges, { source: l2Node.id, target: l3Node.id, type: "process_l2_to_l3", weight: 1.2 })));
      l3Nodes.forEach((l3Node) => l4Nodes.forEach((l4Node) => addEdge(edges, { source: l3Node.id, target: l4Node.id, type: "process_l3_to_l4", weight: 1 })));
    }

    if (standards.length) {
      const standardView = addViewNode(nodes, edges, focusId, "view:standard", "标准 / 框架", "view_standard", "standard");
      standards.slice(0, limits.standards).forEach((standard) => {
        const standardCode = entityCode(standard) || keyPart(standard.standard || standard.title || standard.name);
        const standardNode = addNode(nodes, {
          id: stableId("standard_status", { ...standard, code: standardCode }, `standard:${entityTitle(standard)}`),
          label: entityTitle(standard, "标准 / 框架"),
          type: "standard_status",
          group: "standard",
          weight: 2,
          meta: { code: standardCode, radius: 24 },
        });
        addEdge(edges, { source: standardView.id, target: standardNode.id, type: "view_to_standard_status", weight: 1.4 });
        list(standard.controls).filter(hasBusinessLabel).slice(0, limits.controlsPerStandard).forEach((control) => {
          const controlNode = addNode(nodes, {
            id: stableId("standard_control", control, `control:${standardCode}:${entityTitle(control)}`),
            label: entityTitle(control, "条款 / 控制项"),
            type: "standard_control",
            group: "standard",
            weight: 1.4,
            meta: { code: entityCode(control), framework: standardCode, radius: 8 },
          });
          addEdge(edges, { source: standardNode.id, target: controlNode.id, type: "standard_to_control", weight: 0.9 });
        });
      });
    }

    addDecorativeNetwork(nodes, edges);

    return buildGraphResponse(nodes, edges, {
        graphScope,
        limited: graphScope !== "focus" || allTechRows.length !== techRows.length || allManagementRows.length !== managementRows.length,
        technicalRows: techRows.length,
        technicalRowsTotal: allTechRows.length,
        managementRows: managementRows.length,
        managementRowsTotal: allManagementRows.length,
    });
  }

  models.buildLocalRelationGraphModel = buildLocalRelationGraphModel;
})();
