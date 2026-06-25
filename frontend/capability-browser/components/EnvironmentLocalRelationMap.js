(function () {
  const components = (window.sapdComponents = window.sapdComponents || {});
  const utils = components.utils;

  function escape(value) {
    return utils?.escapeHtml ? utils.escapeHtml(value) : String(value ?? "");
  }

  function topologyStats(tree = []) {
    const segments = new Set();
    const objects = new Set();
    for (const environment of utils.list(tree)) {
      for (const segment of utils.list(environment.segments)) segments.add(segment.id || segment.title);
      const environmentObjects = utils.list(environment.objects).length
        ? utils.list(environment.objects)
        : utils.list(environment.segments).flatMap((segment) => utils.list(segment.objects));
      for (const object of environmentObjects) objects.add(object.id || object.title);
    }
    return {
      environmentCount: utils.list(tree).length,
      segmentCount: segments.size,
      objectCount: objects.size,
    };
  }

  function statBadge(label, value) {
    return `<span><strong>${escape(value)}</strong>${escape(label)}</span>`;
  }

  function selectedClass(id, selectedId) {
    return id && selectedId && id === selectedId ? " is-current" : "";
  }

  function renderDrawioBasemap() {
    const viewer = components.EnvironmentBasemapViewer;
    if (!viewer?.render) return "";
    return `
      <section class="environment-basemap-map">
        ${viewer.render({
          rootAttr: "data-environment-basemap-viewer-svg",
          actionsLabel: "信息化环境底图工具",
          title: "",
          subtitle: "",
          showTitle: false,
          showStatus: false,
        })}
      </section>
    `;
  }

  function hierarchyNodeKind(node) {
    if (node?.relationKind === "measure" || node?.objectKind === "安全技术措施" || node?.kind === "安全技术措施") return "安全技术措施";
    return node?.kind || node?.objectKind || "安全技术模块";
  }

  function relationNodeKey(node) {
    return [node?.id, node?.code, node?.title, node?.name, node?.objectKind, node?.type].filter(Boolean).join("::");
  }

  function uniqueRelationNodes(nodes) {
    const seen = new Set();
    return utils.list(nodes).filter((node) => {
      const key = relationNodeKey(node) || utils.codeTitleOf(node);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  function partitionRelationNodes(nodes) {
    const uniqueNodes = uniqueRelationNodes(nodes);
    return {
      modules: uniqueNodes.filter((node) => !hierarchyNodeKind(node).includes("措施")),
      measures: uniqueNodes.filter((node) => hierarchyNodeKind(node).includes("措施")),
    };
  }

  function relationNodeTooltip(node, kind) {
    const title = utils.codeTitleOf(node) || "未命名对象";
    const definition = node?.definition || node?.description || node?.summary || "";
    const dictionaryHint = kind.includes("措施") ? "可在安全技术措施字典中查看完整定义。" : "可在安全技术模块字典中查看完整定义。";
    return [kind, title, definition, dictionaryHint].filter(Boolean).join("\n");
  }

  function renderHierarchyModuleNode(node) {
    const kind = hierarchyNodeKind(node);
    return `
      <span
        class="environment-hierarchy-module-node ${kind.includes("措施") ? "is-measure" : "is-module"}"
        data-tooltip="${escape(relationNodeTooltip(node, kind))}"
        aria-label="${escape(relationNodeTooltip(node, kind))}"
      >
        <em>${escape(kind)}</em>
        <strong>${escape(utils.codeTitleOf(node))}</strong>
      </span>
    `;
  }

  function renderCapabilityZone(label, nodes, emptyText, toneClass) {
    return `
      <section class="environment-hierarchy-capability-zone ${toneClass}">
        <div class="environment-hierarchy-capability-head">
          <span>${escape(label)}</span>
          <b>${escape(utils.list(nodes).length)}</b>
        </div>
        <div class="environment-hierarchy-module-list" aria-label="${escape(label)}">
          ${utils.list(nodes).length ? utils.list(nodes).map(renderHierarchyModuleNode).join("") : `<span class="empty-inline">${escape(emptyText)}</span>`}
        </div>
      </section>
    `;
  }

  function renderHierarchyObjectCard(environment, object, selectedObjectId) {
    const { modules, measures } = partitionRelationNodes(object.relationNodes);
    const relationCount = modules.length + measures.length;
    return `
      <section class="environment-hierarchy-object-card${selectedClass(object.id, selectedObjectId)}" data-environment-id="${escape(environment.id || "")}" data-environment-object-id="${escape(object.id || "")}">
        <button class="environment-hierarchy-object-main" type="button">
          <span>信息化对象</span>
          <strong>${escape(object.title || "未命名对象")}</strong>
          <em>${escape(object.scopeCount || 0)} 作用域 · ${escape(relationCount)} 模块/措施</em>
        </button>
        <div class="environment-hierarchy-capability-panel">
          ${renderCapabilityZone("安全技术模块", modules, "暂无模块", "is-module-zone")}
          ${renderCapabilityZone("安全技术措施", measures, "暂无措施", "is-measure-zone")}
        </div>
      </section>
    `;
  }

  function segmentObjectCount(segment) {
    return utils.list(segment.objects).length;
  }

  function aggregateEnvironmentObjects(segments) {
    const seen = new Set();
    const objects = [];
    for (const segment of utils.list(segments)) {
      for (const object of utils.list(segment.objects)) {
        const key = object.id || object.title;
        if (!key || seen.has(key)) continue;
        seen.add(key);
        objects.push(object);
      }
    }
    return objects;
  }

  function scopedHierarchyTree(viewModel) {
    const tree = utils.list(viewModel?.topologyTree || viewModel?.navigationTree);
    const selectedMode = viewModel?.selectedMode || "";
    const selectedEnvironmentId = viewModel?.selectedEnvironment?.id || "";
    const selectedSegmentId = viewModel?.selectedSegment?.id || "";
    if (selectedMode !== "environment" && selectedMode !== "segment") return tree;
    return tree
      .filter((environment) => !selectedEnvironmentId || environment.id === selectedEnvironmentId)
      .map((environment) => {
        const segments = utils
          .list(environment.segments)
          .filter((segment) => selectedMode !== "segment" || !selectedSegmentId || segment.id === selectedSegmentId);
        const objects = aggregateEnvironmentObjects(segments);
        return {
          ...environment,
          segments,
          objects,
          segmentCount: segments.length,
          objectCount: objects.length,
        };
      })
      .filter((environment) => utils.list(environment.segments).length || selectedMode === "environment");
  }

  function renderHierarchySegment(environment, segment, selectedSegmentId, selectedObjectId) {
    const objectCount = segmentObjectCount(segment);
    const capabilityCount = uniqueRelationNodes(utils.list(segment.objects).flatMap((object) => utils.list(object.relationNodes))).length;
    return `
      <section class="environment-hierarchy-segment${selectedClass(segment.id, selectedSegmentId)}" data-environment-id="${escape(environment.id || "")}" data-environment-segment-id="${escape(segment.id || "")}">
        <div class="environment-hierarchy-track-head">
          <button class="environment-hierarchy-segment-main" type="button">
            <span>环境子类</span>
            <strong>${escape(segment.title || "未定义环境子类")}</strong>
            <em>${escape(objectCount)} 对象 · ${escape(capabilityCount)} 模块/措施</em>
          </button>
        </div>
        <div class="environment-hierarchy-object-list">
          ${utils.list(segment.objects).map((object) => renderHierarchyObjectCard(environment, object, selectedObjectId)).join("")}
        </div>
      </section>
    `;
  }

  function renderHierarchySegmentFlow(environment, segment, selectedSegmentId, selectedObjectId) {
    const objectCount = segmentObjectCount(segment);
    const capabilityCount = uniqueRelationNodes(utils.list(segment.objects).flatMap((object) => utils.list(object.relationNodes))).length;
    return `
      <section class="environment-hierarchy-segment-flow${selectedClass(segment.id, selectedSegmentId)}" data-environment-id="${escape(environment.id || "")}" data-environment-segment-id="${escape(segment.id || "")}">
        <div class="environment-hierarchy-track-head">
          <button class="environment-hierarchy-segment-main" type="button">
            <span>环境子类</span>
            <strong>${escape(segment.title || "未定义环境子类")}</strong>
            <em>${escape(objectCount)} 对象 · ${escape(capabilityCount)} 模块/措施</em>
          </button>
        </div>
        <div class="environment-hierarchy-object-list">
          ${utils.list(segment.objects).map((object) => renderHierarchyObjectCard(environment, object, selectedObjectId)).join("")}
        </div>
      </section>
    `;
  }

  function renderHierarchyEnvironment(environment, selectedEnvironmentId, selectedSegmentId, selectedObjectId) {
    const capabilityCount = uniqueRelationNodes(utils.list(environment.objects).flatMap((object) => utils.list(object.relationNodes))).length;
    return `
      <section class="environment-hierarchy-environment${selectedClass(environment.id, selectedEnvironmentId)}" data-environment-id="${escape(environment.id || "")}">
        <div class="environment-hierarchy-environment-head">
          <button class="environment-hierarchy-environment-main" type="button">
            <span>信息化环境</span>
            <strong>${escape(environment.title || "未命名环境")}</strong>
            <em>${escape(environment.segmentCount || utils.list(environment.segments).length)} 子类 · ${escape(environment.objectCount || utils.list(environment.objects).length)} 对象 · ${escape(capabilityCount)} 模块/措施</em>
          </button>
        </div>
        <div class="environment-hierarchy-segment-list">
          ${utils.list(environment.segments).map((segment) => renderHierarchySegment(environment, segment, selectedSegmentId, selectedObjectId)).join("")}
        </div>
      </section>
    `;
  }

  function renderObjectNode(environment, object, selectedObjectId) {
    const badges = [
      object.scopeCount ? `${object.scopeCount} 作用域` : "",
      object.serviceCount ? `${object.serviceCount} 服务` : "",
      object.moduleCount ? `${object.moduleCount} 模块/措施` : "",
    ].filter(Boolean);
    return `
      <button class="environment-topology-node object-node${selectedClass(object.id, selectedObjectId)}" type="button" data-environment-id="${escape(environment.id || "")}" data-environment-object-id="${escape(object.id || "")}">
        <strong>${escape(object.title || "未命名对象")}</strong>
        ${badges.length ? `<span>${badges.map(escape).join(" · ")}</span>` : ""}
      </button>
    `;
  }

  function renderSegmentNode(environment, segment, selectedSegmentId, selectedObjectId) {
    return `
      <section class="environment-topology-segment">
        <button class="environment-topology-node segment-node${selectedClass(segment.id, selectedSegmentId)}" type="button" data-environment-id="${escape(environment.id || "")}" data-environment-segment-id="${escape(segment.id || "")}">
          <strong>${escape(segment.title || "未定义环境子类")}</strong>
          <span>${escape(utils.list(segment.objects).length)} 个对象</span>
        </button>
        <div class="environment-topology-objects">
          ${utils.list(segment.objects).map((object) => renderObjectNode(environment, object, selectedObjectId)).join("")}
        </div>
      </section>
    `;
  }

  function keyPart(value) {
    return utils
      .text(value)
      .trim()
      .replace(/[^\w\u4e00-\u9fa5.-]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  function graphNodeId(prefix, id) {
    return `${prefix}:${keyPart(id) || prefix}`;
  }

  function addNode(nodes, node) {
    if (!node?.id || nodes.has(node.id)) return;
    nodes.set(node.id, {
      label: "待补充",
      type: "empty_state",
      group: "environment",
      weight: 1,
      isCurrent: false,
      isDecorative: false,
      meta: {},
      ...node,
    });
  }

  function addEdge(edges, edge) {
    if (!edge?.source || !edge?.target || edge.source === edge.target) return;
    const id = edge.id || `${edge.type || "edge"}:${edge.source}->${edge.target}`;
    if (edges.has(id)) return;
    edges.set(id, { id, type: "environment_topology_link", weight: 1, isDecorative: false, ...edge });
  }

  function buildTopologyGraphModel(viewModel) {
    const tree = utils.list(viewModel?.topologyTree || viewModel?.navigationTree);
    const stats = topologyStats(tree);
    const nodes = new Map();
    const edges = new Map();
    const rootId = "environment-topology-root";
    addNode(nodes, {
      id: rootId,
      label: "信息化环境",
      type: "current_focus",
      group: "current",
      weight: 10,
      isCurrent: true,
      meta: {
        code: `${stats.environmentCount} 环境 / ${stats.objectCount} 对象`,
        radius: 70,
      },
    });
    for (const environment of tree) {
      const environmentId = graphNodeId("environment", environment.id || environment.title);
      addNode(nodes, {
        id: environmentId,
        label: environment.title || "未命名环境",
        type: "information_environment",
        group: "environment",
        weight: 4,
        meta: { code: `${environment.segmentCount || utils.list(environment.segments).length} 类 / ${environment.objectCount || utils.list(environment.objects).length} 对象` },
      });
      addEdge(edges, { source: rootId, target: environmentId, type: "topology_root_to_environment", weight: 2 });
      for (const segment of utils.list(environment.segments)) {
        const segmentId = graphNodeId("segment", segment.id || `${environment.id}:${segment.title}`);
        addNode(nodes, {
          id: segmentId,
          label: segment.title || "未定义环境子类",
          type: "environment_segment",
          group: "environment",
          weight: 2.4,
          meta: { code: `${utils.list(segment.objects).length} 对象` },
        });
        addEdge(edges, { source: environmentId, target: segmentId, type: "topology_environment_to_segment", weight: 1.4 });
        for (const object of utils.list(segment.objects)) {
          const objectId = graphNodeId("object", object.id || `${segment.id}:${object.title}`);
          addNode(nodes, {
            id: objectId,
            label: object.title || "未命名对象",
            type: "information_object",
            group: "environment",
            weight: 1.3,
            meta: { code: `${object.scopeCount || 0} 作用域 / ${object.serviceCount || 0} 服务` },
          });
          addEdge(edges, { source: segmentId, target: objectId, type: "topology_segment_to_object", weight: 0.9 });
        }
      }
    }
    return {
      nodes: [...nodes.values()],
      edges: [...edges.values()],
      groups: [
        { key: "current", label: "拓扑总览" },
        { key: "environment", label: "环境与对象" },
      ],
      stats: {
        networkTitle: "信息化环境拓扑图",
        networkDescription: "展示全部信息化环境、环境子类和信息化对象。",
        ariaLabel: "信息化环境与信息化对象全量拓扑图",
        strategy: "category_structure",
        businessNodes: nodes.size,
        businessEdges: edges.size,
        legendItems: [
          { className: "legend-current", label: "拓扑总览 / 当前焦点" },
          { className: "legend-environment", label: "信息化环境" },
          { className: "legend-technical", label: "环境子类 / 对象" },
        ],
        note: `拓扑首页：展示 ${stats.environmentCount} 个信息化环境、${stats.segmentCount} 个环境子类和 ${stats.objectCount} 个信息化对象。`,
      },
    };
  }

  function renderTopology({ viewModel, preferBasemap = true } = {}) {
    const basemap = preferBasemap ? renderDrawioBasemap() : "";
    if (basemap) return basemap;
    const tree = scopedHierarchyTree(viewModel);
    const stats = topologyStats(tree);
    const selectedEnvironmentId = viewModel?.selectedEnvironment?.id || "";
    const selectedSegmentId = viewModel?.selectedSegment?.id || "";
    const selectedObjectId = viewModel?.selectedObject?.id || "";
    const selectedMode = viewModel?.selectedMode || "";
    const isSegmentView = selectedMode === "segment" && selectedSegmentId;
    const title = isSegmentView ? "环境子类层级视图" : "环境层级视图";
    const description = isSegmentView
      ? "只表达当前环境子类、信息化对象和安全技术模块 / 措施。"
      : "只表达环境、环境子类、信息化对象和安全技术模块 / 措施。";
    const layerLabels = isSegmentView ? ["环境子类层", "信息化对象层", "能力层"] : ["环境核心层", "环境子类层", "信息化对象层", "能力层"];
    const segmentFlow = isSegmentView
      ? tree.flatMap((environment) => utils.list(environment.segments).map((segment) => renderHierarchySegmentFlow(environment, segment, selectedSegmentId, selectedObjectId))).join("")
      : "";
    return `
      <section class="environment-hierarchy-view">
        <div class="matrix-section-head">
          <div>
            <h3>${escape(title)}</h3>
            <p>${escape(description)}</p>
          </div>
          <div class="environment-graph-status">
            ${statBadge("环境", stats.environmentCount)}
            ${statBadge("环境子类", stats.segmentCount)}
            ${statBadge("对象", stats.objectCount)}
          </div>
        </div>
        <div class="environment-hierarchy-layer-rail" aria-hidden="true">
          ${layerLabels.map((label) => `<span>${escape(label)}</span>`).join("")}
        </div>
        <div class="environment-hierarchy-canvas" aria-label="环境层级视图">
          ${
            tree.length
              ? isSegmentView
                ? segmentFlow
                : tree.map((environment) => renderHierarchyEnvironment(environment, selectedEnvironmentId, selectedSegmentId, selectedObjectId)).join("")
              : '<div class="reference-empty">暂无信息化环境层级数据。</div>'
          }
        </div>
      </section>
    `;
  }

  function renderMappingTab({ viewModel, selectedRowId, selectedEnvironmentId, selectedSegmentId, selectedObjectId, search, expandedIds, catalogCollapsed }) {
    const showObjectRelations = viewModel?.selectedMode === "object";
    return `
      <div class="environment-mapping-workbench ${catalogCollapsed ? "catalog-collapsed" : ""}">
        <button
          id="expandEnvironmentCatalogTab"
          class="environment-catalog-expand-tab"
          type="button"
          data-toggle-environment-catalog
          aria-label="展开环境对象目录"
          aria-expanded="false"
          ${catalogCollapsed ? "" : "hidden"}
        >
          展开目录
        </button>
        <aside class="environment-tab-tree-pane">
          <div class="pane-head">
            <h2>环境对象树</h2>
            <div class="pane-head-actions">
              <button
                id="toggleEnvironmentCatalog"
                type="button"
                data-toggle-environment-catalog
                title="${catalogCollapsed ? "展开环境对象目录" : "收起环境对象目录"}"
                aria-label="${catalogCollapsed ? "展开环境对象目录" : "收起环境对象目录"}"
                aria-expanded="${catalogCollapsed ? "false" : "true"}"
              >
                ${catalogCollapsed ? "展开" : "收起目录"}
              </button>
            </div>
          </div>
          <div class="source-catalog-tools">
            <input id="environmentSearchInput" type="search" value="${escape(search || "")}" placeholder="搜索环境、对象、作用域、服务或模块" />
          </div>
          <div id="environmentTree" class="environment-tree">
            ${
              components.EnvironmentTree?.render({
                navigationTree: viewModel?.navigationTree,
                selectedEnvironmentId,
                selectedSegmentId,
                selectedObjectId,
                expandedIds,
                search,
              }) || '<div class="reference-empty">环境对象树组件未加载。</div>'
            }
          </div>
        </aside>
        <section class="environment-tab-table-pane">
          ${
            showObjectRelations
              ? components.EnvironmentScopeServiceMatrix?.render({
                  rows: viewModel?.scopeServiceRows,
                  groups: viewModel?.scopeServiceGroups,
                  showObjectColumn: viewModel?.detailPanel?.showObjectColumn,
                  selectedRowId,
                  grouped: false,
                }) || '<div class="reference-empty">环境映射表组件未加载。</div>'
              : renderTopology({ viewModel, preferBasemap: false })
          }
        </section>
      </div>
    `;
  }

  function render({ viewModel, selectedRowId = "", selectedEnvironmentId = "", selectedSegmentId = "", selectedObjectId = "", search = "", activeTab = "topology", expandedIds, catalogCollapsed = false } = {}) {
    const normalizedActiveTab = activeTab === "mapping" ? activeTab : "topology";
    const showMapping = normalizedActiveTab === "mapping";
    return `
      <section class="semantic-panel environment-relation-map environment-tabbed-map">
        <input class="environment-tab-input" id="environmentTabTopology" type="radio" name="environmentDetailTab" ${showMapping ? "" : "checked"}>
        <input class="environment-tab-input" id="environmentTabMapping" type="radio" name="environmentDetailTab" ${showMapping ? "checked" : ""}>
        <div class="environment-tab-panels">
          <div class="environment-tab-panel environment-tab-panel-topology">
            ${renderTopology({ viewModel })}
          </div>
          <div class="environment-tab-panel environment-tab-panel-mapping">
            ${renderMappingTab({ viewModel, selectedRowId, selectedEnvironmentId, selectedSegmentId, selectedObjectId, search, expandedIds, catalogCollapsed })}
          </div>
        </div>
      </section>
    `;
  }

  components.EnvironmentLocalRelationMap = { render };
})();
