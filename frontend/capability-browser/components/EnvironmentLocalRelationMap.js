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
      for (const object of utils.list(environment.objects)) objects.add(object.id || object.title);
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

  function renderTopology({ viewModel } = {}) {
    const basemap = renderDrawioBasemap();
    if (basemap) return basemap;
    const tree = utils.list(viewModel?.topologyTree || viewModel?.navigationTree);
    const stats = topologyStats(tree);
    const selectedEnvironmentId = viewModel?.selectedEnvironment?.id || "";
    const selectedSegmentId = viewModel?.selectedSegment?.id || "";
    const selectedObjectId = viewModel?.selectedObject?.id || "";
    return `
      <section class="environment-topology-map">
        <div class="matrix-section-head">
          <div>
            <h3>信息化环境拓扑</h3>
            <p>首页只展示环境对象结构，避免在顶层展开安全作用域、服务、模块和措施。</p>
          </div>
          <div class="environment-graph-status">
            ${statBadge("环境", stats.environmentCount)}
            ${statBadge("环境子类", stats.segmentCount)}
            ${statBadge("对象", stats.objectCount)}
          </div>
        </div>
        <div class="environment-topology-canvas physical-topology-canvas" aria-label="信息化环境与对象网络物理拓扑图">
          <div class="physical-topology-backbone" aria-hidden="true">
            <span>Core Backbone</span>
          </div>
          <div class="environment-topology-root">
            <span class="topology-root-node">
              <strong>信息化环境</strong>
              <em>${escape(stats.environmentCount)} 环境 · ${escape(stats.objectCount)} 对象</em>
            </span>
          </div>
          <div class="environment-topology-grid">
            ${
              tree
                .map(
                  (environment) => `
                    <section class="environment-topology-environment">
                      <button class="environment-topology-node environment-node${selectedClass(environment.id, selectedEnvironmentId)}" type="button" data-environment-id="${escape(environment.id || "")}">
                        <strong>${escape(environment.title || "未命名环境")}</strong>
                        <span>${escape(environment.segmentCount || utils.list(environment.segments).length)} 类 · ${escape(environment.objectCount || utils.list(environment.objects).length)} 对象</span>
                      </button>
                      <div class="environment-topology-segments">
                        ${utils.list(environment.segments).map((segment) => renderSegmentNode(environment, segment, selectedSegmentId, selectedObjectId)).join("")}
                      </div>
                    </section>
                  `,
                )
                .join("") || '<div class="reference-empty">暂无信息化环境拓扑数据。</div>'
            }
          </div>
        </div>
      </section>
    `;
  }

  function renderMappingTab({ viewModel, selectedRowId, selectedEnvironmentId, selectedSegmentId, selectedObjectId, search, expandedIds, catalogCollapsed }) {
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
            components.EnvironmentScopeServiceMatrix?.render({
              rows: viewModel?.scopeServiceRows,
              showObjectColumn: viewModel?.detailPanel?.showObjectColumn,
              selectedRowId,
              grouped: false,
            }) || '<div class="reference-empty">环境映射表组件未加载。</div>'
          }
        </section>
      </div>
    `;
  }

  function renderReviewTab({ reviewData, reviewFilters, selectedReviewRowKey, selectedReviewDirectoryKey } = {}) {
    if (!components.EnvironmentDataReviewTable?.render) {
      return '<div class="reference-empty">环境映射人工核对组件未加载。</div>';
    }
    return components.EnvironmentDataReviewTable.render({
      reviewData,
      filters: reviewFilters,
      selectedRowKey: selectedReviewRowKey,
      selectedDirectoryRelationKey: selectedReviewDirectoryKey,
    });
  }

  function render({ viewModel, selectedRowId = "", selectedEnvironmentId = "", selectedSegmentId = "", selectedObjectId = "", search = "", activeTab = "topology", expandedIds, catalogCollapsed = false, reviewData = null, reviewFilters = {}, selectedReviewRowKey = "", selectedReviewDirectoryKey = "" } = {}) {
    const normalizedActiveTab = activeTab === "mapping" || activeTab === "review" ? activeTab : "topology";
    const showMapping = normalizedActiveTab === "mapping";
    const showReview = normalizedActiveTab === "review";
    return `
      <section class="semantic-panel environment-relation-map environment-tabbed-map">
        <input class="environment-tab-input" id="environmentTabTopology" type="radio" name="environmentDetailTab" ${showMapping || showReview ? "" : "checked"}>
        <input class="environment-tab-input" id="environmentTabMapping" type="radio" name="environmentDetailTab" ${showMapping ? "checked" : ""}>
        <input class="environment-tab-input" id="environmentTabReview" type="radio" name="environmentDetailTab" ${showReview ? "checked" : ""}>
        <div class="environment-tab-panels">
          <div class="environment-tab-panel environment-tab-panel-topology">
            ${renderTopology({ viewModel })}
          </div>
          <div class="environment-tab-panel environment-tab-panel-mapping">
            ${renderMappingTab({ viewModel, selectedRowId, selectedEnvironmentId, selectedSegmentId, selectedObjectId, search, expandedIds, catalogCollapsed })}
          </div>
          <div class="environment-tab-panel environment-tab-panel-review">
            ${renderReviewTab({ reviewData, reviewFilters, selectedReviewRowKey, selectedReviewDirectoryKey })}
          </div>
        </div>
      </section>
    `;
  }

  components.EnvironmentLocalRelationMap = { render };
})();
