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

  const ENVIRONMENT_CAPABILITY_PREVIEW_LIMIT = 5;
  const SUBCATEGORY_CAPABILITY_PREVIEW_LIMIT = 6;

  function relationNodeTitle(node, fallback = "未命名能力") {
    return utils.codeTitleOf(node) || node?.title || node?.name || fallback;
  }

  function relationNodeCount(object) {
    return uniqueRelationNodes(utils.list(object?.relationNodes)).length;
  }

  function partitionObjectsCapability(objects) {
    return partitionRelationNodes(utils.list(objects).flatMap((object) => utils.list(object.relationNodes)));
  }

  function scopeKindsFromRows(rows) {
    const scopesByKey = new Map();
    for (const row of utils.list(rows)) {
      const rowScopes = utils.list(row?.scopes).length ? utils.list(row.scopes) : [row?.scope];
      for (const scope of rowScopes) {
        const key = scope?.code || scope?.id || scope?.title || scope?.name;
        if (key && !scopesByKey.has(key)) scopesByKey.set(key, scope);
      }
    }
    return [...scopesByKey.values()];
  }

  function sortObjectsByCapability(objects) {
    return [...utils.list(objects)].sort((left, right) => {
      const countDiff = relationNodeCount(right) - relationNodeCount(left);
      if (countDiff) return countDiff;
      return (left.title || "").localeCompare(right.title || "", "zh-Hans-CN");
    });
  }

  function capabilityFrequency(objects) {
    const rowsByKey = new Map();
    for (const object of utils.list(objects)) {
      for (const node of uniqueRelationNodes(utils.list(object.relationNodes))) {
        const key = relationNodeKey(node) || relationNodeTitle(node);
        if (!key) continue;
        const kind = hierarchyNodeKind(node);
        const row = rowsByKey.get(key) || {
          node,
          kind,
          count: 0,
          title: relationNodeTitle(node),
        };
        row.count += 1;
        rowsByKey.set(key, row);
      }
    }
    return [...rowsByKey.values()].sort((left, right) => right.count - left.count || left.title.localeCompare(right.title, "zh-Hans-CN"));
  }

  function renderStatsBadges(rows) {
    return `
      <div class="environment-statistics-status">
        ${utils.list(rows).map((row) => statBadge(row.label, row.value)).join("")}
      </div>
    `;
  }

  function renderStatsMetricCells(rows) {
    return `
      <div class="environment-statistics-metrics">
        ${utils
          .list(rows)
          .map(
            (row) => `
              <div class="environment-statistics-metric">
                <strong>${escape(row.value)}</strong>
                <span>${escape(row.label)}</span>
              </div>
            `,
          )
          .join("")}
      </div>
    `;
  }

  function renderStatisticsSummary({ kind, title, coverage, metrics }) {
    return `
      <section class="environment-statistics-summary">
        <div class="environment-statistics-summary-head">
          <div class="environment-statistics-summary-title">
            <span class="environment-statistics-badge">${escape(kind)}</span>
            <span>${escape(title)}</span>
          </div>
          <span class="environment-statistics-coverage">${escape(coverage)}</span>
        </div>
        ${renderStatsMetricCells(metrics)}
      </section>
    `;
  }

  function renderStatisticChiplet(row, shortKind = false) {
    const kind = row.kind || hierarchyNodeKind(row.node);
    const label = shortKind ? (kind.includes("措施") ? "措施" : "模块") : kind;
    const target = relationNodeAnnotationTarget(row.node, kind);
    return `
      <span class="environment-statistics-chiplet ${kind.includes("措施") ? "is-measure" : "is-module"}" data-annotation-prefer-target="true" ${annotationTargetAttrs(target, relationNodeTitle(row.node))}>
        <small>${escape(label)}</small>
        <strong>${escape(relationNodeTitle(row.node))}</strong>
      </span>
    `;
  }

  function renderCapabilityChipGrid(rows, limit, emptyText, { shortKind = false, moreLabel = "更多模块/措施" } = {}) {
    const items = utils.list(rows);
    if (!items.length) return `<div class="environment-statistics-empty">${escape(emptyText)}</div>`;
    const visible = items.slice(0, limit);
    const hiddenCount = Math.max(0, items.length - visible.length);
    return `
      <div class="environment-statistics-chip-grid">
        ${visible.map((row) => renderStatisticChiplet(row, shortKind)).join("")}
        ${
          hiddenCount
            ? `<span class="environment-statistics-chiplet is-more"><small>未展开</small><strong>${escape(`+${hiddenCount} ${moreLabel}`)}</strong></span>`
            : ""
        }
      </div>
    `;
  }

  function renderCoverageRows(objects, limit = Number.POSITIVE_INFINITY) {
    const rows = sortObjectsByCapability(objects);
    if (!rows.length) return `<div class="environment-statistics-empty">暂无信息化对象</div>`;
    const visible = Number.isFinite(limit) ? rows.slice(0, limit) : rows;
    const hiddenCount = Math.max(0, rows.length - visible.length);
    const maxCount = Math.max(1, ...rows.map(relationNodeCount));
    return `
      <div class="environment-statistics-coverage-list">
        ${visible
          .map((object) => {
            const count = relationNodeCount(object);
            const width = Math.max(8, Math.round((count / maxCount) * 100));
            return `
              <div class="environment-statistics-coverage-row">
                <span>${escape(object.title || "未命名对象")}</span>
                <span class="environment-statistics-track"><span class="environment-statistics-fill" style="width: ${width}%"></span></span>
                <span>${escape(`${count} 模块/措施`)}</span>
              </div>
            `;
          })
          .join("")}
        ${
          hiddenCount
            ? `<div class="environment-statistics-coverage-row is-more"><span>${escape(`还有 ${hiddenCount} 个对象未展开`)}</span><span>${escape(`+${hiddenCount}`)}</span></div>`
            : ""
        }
      </div>
    `;
  }

  function renderStatisticsPane({ title, count, toneClass, body }) {
    return `
      <section class="environment-statistics-pane ${escape(toneClass || "")}">
        <div class="environment-statistics-pane-head">
          <span>${escape(title)}</span>
          <span>${escape(count)}</span>
        </div>
        ${body}
      </section>
    `;
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

  function annotationTargetAttrs(target, title = "") {
    if (!target?.targetRef) return "";
    return window.sapdDisplay?.annotationTargetAttrs?.(target, { title }) || "";
  }

  function baseAnnotationTarget({ objectType, objectLabel, item, title = "", anchorType = "object" }) {
    const id = utils.text(item?.id || "").trim();
    const code = utils.text(item?.code || item?.serviceCode || item?.scopeCode || "").trim();
    const visibleTitle = title || utils.codeTitleOf(item) || item?.title || item?.name || code || id;
    const stableKey = code || id || visibleTitle;
    if (!stableKey) return null;
    return {
      targetRef: `base:${objectType}:${stableKey}`,
      objectType,
      objectLabel,
      id: id || stableKey,
      code,
      title: visibleTitle,
      anchorType,
    };
  }

  function relationNodeAnnotationTarget(node, kind) {
    return baseAnnotationTarget({
      objectType: kind.includes("措施") ? "security_technical_measure" : "security_technology_module",
      objectLabel: kind.includes("措施") ? "安全技术措施" : "安全技术模块",
      item: node,
      title: utils.codeTitleOf(node),
    });
  }

  function environmentAnnotationTarget(item, objectType, objectLabel, title = "") {
    return baseAnnotationTarget({ objectType, objectLabel, item, title });
  }

  function renderHierarchyModuleNode(node) {
    const kind = hierarchyNodeKind(node);
    const target = relationNodeAnnotationTarget(node, kind);
    return `
      <span
        class="environment-hierarchy-module-node ${kind.includes("措施") ? "is-measure" : "is-module"}"
        data-tooltip="${escape(relationNodeTooltip(node, kind))}"
        aria-label="${escape(relationNodeTooltip(node, kind))}"
        data-annotation-prefer-target="true"
        ${annotationTargetAttrs(target, utils.codeTitleOf(node))}
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
    const target = environmentAnnotationTarget(object, "information_object", "信息化对象", object.title || "未命名对象");
    return `
      <section class="environment-hierarchy-object-card${selectedClass(object.id, selectedObjectId)}" data-environment-id="${escape(environment.id || "")}" data-environment-object-id="${escape(object.id || "")}" data-annotation-prefer-target="true" ${annotationTargetAttrs(target, object.title || "未命名对象")}>
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
    const target = environmentAnnotationTarget(segment, "environment_segment", "环境子类", segment.title || "未定义环境子类");
    return `
      <section class="environment-hierarchy-segment${selectedClass(segment.id, selectedSegmentId)}" data-environment-id="${escape(environment.id || "")}" data-environment-segment-id="${escape(segment.id || "")}" data-annotation-prefer-target="true" ${annotationTargetAttrs(target, segment.title || "未定义环境子类")}>
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
    const target = environmentAnnotationTarget(segment, "environment_segment", "环境子类", segment.title || "未定义环境子类");
    return `
      <section class="environment-hierarchy-segment-flow${selectedClass(segment.id, selectedSegmentId)}" data-environment-id="${escape(environment.id || "")}" data-environment-segment-id="${escape(segment.id || "")}" data-annotation-prefer-target="true" ${annotationTargetAttrs(target, segment.title || "未定义环境子类")}>
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
    const target = environmentAnnotationTarget(environment, "information_environment", "信息化环境", environment.title || "未命名环境");
    return `
      <section class="environment-hierarchy-environment${selectedClass(environment.id, selectedEnvironmentId)}" data-environment-id="${escape(environment.id || "")}" data-annotation-prefer-target="true" ${annotationTargetAttrs(target, environment.title || "未命名环境")}>
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
    const target = environmentAnnotationTarget(object, "information_object", "信息化对象", object.title || "未命名对象");
    return `
      <button class="environment-topology-node object-node${selectedClass(object.id, selectedObjectId)}" type="button" data-environment-id="${escape(environment.id || "")}" data-environment-object-id="${escape(object.id || "")}" data-annotation-prefer-target="true" ${annotationTargetAttrs(target, object.title || "未命名对象")}>
        <strong>${escape(object.title || "未命名对象")}</strong>
        ${badges.length ? `<span>${badges.map(escape).join(" · ")}</span>` : ""}
      </button>
    `;
  }

  function renderSegmentNode(environment, segment, selectedSegmentId, selectedObjectId) {
    const target = environmentAnnotationTarget(segment, "environment_segment", "环境子类", segment.title || "未定义环境子类");
    return `
      <section class="environment-topology-segment">
        <button class="environment-topology-node segment-node${selectedClass(segment.id, selectedSegmentId)}" type="button" data-environment-id="${escape(environment.id || "")}" data-environment-segment-id="${escape(segment.id || "")}" data-annotation-prefer-target="true" ${annotationTargetAttrs(target, segment.title || "未定义环境子类")}>
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

  function renderTopology({ viewModel, search = "", preferBasemap = true } = {}) {
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

  function renderEnvironmentStatisticsSegment(environment, segment) {
    const objects = utils.list(segment.objects);
    const { modules, measures } = partitionObjectsCapability(objects);
    const capabilityRows = capabilityFrequency(objects);
    const capabilityCount = modules.length + measures.length;
    const target = environmentAnnotationTarget(segment, "environment_segment", "环境子类", segment.title || "未定义环境子类");
    return `
      <section class="environment-statistics-row is-subcategory">
        <button class="environment-statistics-entity" type="button" data-environment-id="${escape(environment.id || "")}" data-environment-segment-id="${escape(segment.id || "")}" data-annotation-prefer-target="true" ${annotationTargetAttrs(target, segment.title || "未定义环境子类")}>
          <small>环境子类</small>
          <strong>${escape(segment.title || "未定义环境子类")}</strong>
          <span>${escape(objects.length)} 对象 · ${escape(capabilityCount)} 模块/措施</span>
        </button>
        ${renderStatisticsPane({
          title: "对象覆盖",
          count: `${objects.length} 项`,
          toneClass: "is-module",
          body: renderCoverageRows(objects),
        })}
        ${renderStatisticsPane({
          title: "主要安全技术模块/措施",
          count: `${capabilityCount} 项`,
          toneClass: "is-measure",
          body: renderCapabilityChipGrid(capabilityRows, ENVIRONMENT_CAPABILITY_PREVIEW_LIMIT, "暂无模块/措施", { shortKind: true }),
        })}
      </section>
    `;
  }

  function renderEnvironmentStatistics(viewModel) {
    const tree = scopedHierarchyTree(viewModel);
    const environment = tree[0];
    if (!environment) return `<div class="reference-empty">暂无信息化环境层级数据。</div>`;
    const segments = utils.list(environment.segments);
    const objects = aggregateEnvironmentObjects(segments);
    const { modules, measures } = partitionObjectsCapability(objects);
    const title = environment.title || "未命名环境";
    return `
      <section class="environment-statistics-view is-environment" aria-label="环境统计型层级视图">
        <div class="environment-statistics-head">
          <div>
            <h3>环境层级视图</h3>
            <p>只表达环境、环境子类、信息化对象和安全技术模块 / 措施的统计覆盖。</p>
          </div>
          ${renderStatsBadges([
            { label: "环境", value: 1 },
            { label: "环境子类", value: segments.length },
            { label: "对象", value: objects.length },
          ])}
        </div>
        <div class="environment-statistics-body">
          ${renderStatisticsSummary({
            kind: "信息化环境",
            title,
            coverage: `${segments.length} 子类 · ${objects.length} 对象 · ${modules.length + measures.length} 模块/措施`,
            metrics: [
              { label: "环境子类", value: segments.length },
              { label: "信息化对象", value: objects.length },
              { label: "安全技术模块", value: modules.length },
              { label: "安全技术措施", value: measures.length },
            ],
          })}
          <div class="environment-statistics-section">
            ${segments.map((segment) => renderEnvironmentStatisticsSegment(environment, segment)).join("")}
          </div>
        </div>
      </section>
    `;
  }

  function renderSubcategoryStatisticsObject(environment, object) {
    const { modules, measures } = partitionRelationNodes(object.relationNodes);
    const capabilityCount = modules.length + measures.length;
    const target = environmentAnnotationTarget(object, "information_object", "信息化对象", object.title || "未命名对象");
    return `
      <section class="environment-statistics-row is-object">
        <button class="environment-statistics-entity" type="button" data-environment-id="${escape(environment.id || "")}" data-environment-object-id="${escape(object.id || "")}" data-annotation-prefer-target="true" ${annotationTargetAttrs(target, object.title || "未命名对象")}>
          <small>信息化对象</small>
          <strong>${escape(object.title || "未命名对象")}</strong>
          <span>${escape(object.scopeCount || 0)} 作用域种类 · ${escape(capabilityCount)} 模块/措施</span>
        </button>
        ${renderStatisticsPane({
          title: "安全技术模块",
          count: modules.length,
          toneClass: "is-module",
          body: renderCapabilityChipGrid(
            modules.map((node) => ({ node, kind: "安全技术模块" })),
            SUBCATEGORY_CAPABILITY_PREVIEW_LIMIT,
            "暂无模块",
          ),
        })}
        ${renderStatisticsPane({
          title: "安全技术措施",
          count: measures.length,
          toneClass: "is-measure",
          body: renderCapabilityChipGrid(
            measures.map((node) => ({ node, kind: "安全技术措施" })),
            SUBCATEGORY_CAPABILITY_PREVIEW_LIMIT,
            "暂无措施",
          ),
        })}
      </section>
    `;
  }

  function renderSubcategoryStatistics(viewModel) {
    const tree = scopedHierarchyTree(viewModel);
    const environment = tree[0];
    const segment = utils.list(environment?.segments)[0];
    if (!environment || !segment) return `<div class="reference-empty">暂无环境子类层级数据。</div>`;
    const objects = utils.list(segment.objects);
    const { modules, measures } = partitionObjectsCapability(objects);
    const scopeKindCount = scopeKindsFromRows(viewModel?.scopeServiceRows).length;
    return `
      <section class="environment-statistics-view is-subcategory" aria-label="环境子类统计型层级视图">
        <div class="environment-statistics-head">
          <div>
            <h3>环境子类层级视图</h3>
            <p>只表达当前环境子类、信息化对象和安全技术模块 / 措施，不展开服务级路由。</p>
          </div>
          ${renderStatsBadges([
            { label: "环境", value: 1 },
            { label: "环境子类", value: 1 },
            { label: "对象", value: objects.length },
          ])}
        </div>
        <div class="environment-statistics-body">
          ${renderStatisticsSummary({
            kind: "环境子类",
            title: segment.title || "未定义环境子类",
            coverage: `${objects.length} 对象 · ${modules.length + measures.length} 模块/措施`,
            metrics: [
              { label: "信息化对象", value: objects.length },
              { label: "作用域种类", value: scopeKindCount },
              { label: "安全技术模块", value: modules.length },
              { label: "安全技术措施", value: measures.length },
            ],
          })}
          <div class="environment-statistics-more-row">对象行全量滚动展示；单个对象内模块 / 措施默认展示前 6 个，超出以 +N 收束</div>
          <div class="environment-statistics-section">
            ${objects.length ? objects.map((object) => renderSubcategoryStatisticsObject(environment, object)).join("") : '<div class="reference-empty">暂无信息化对象。</div>'}
          </div>
        </div>
      </section>
    `;
  }

  function renderStatisticsMapping({ viewModel } = {}) {
    return viewModel?.selectedMode === "segment" ? renderSubcategoryStatistics(viewModel) : renderEnvironmentStatistics(viewModel);
  }

  function renderEnvironmentSearchControl(search, extraClass = "") {
    return `
      <div class="environment-search-control page-search-control ${escape(extraClass || "")}" role="search" aria-label="信息化环境页面内搜索">
        <label class="page-search-input-shell" for="environmentSearchInput">
          <span class="capability-search-icon" aria-hidden="true">⌕</span>
          <input id="environmentSearchInput" type="search" value="${escape(search || "")}" placeholder="搜索环境、对象、作用域、服务、模块、措施或系统" autocomplete="off" data-search-history-kind="environment" />
        </label>
        <span class="page-search-match-status" data-page-search-status="environment-mapping" aria-live="polite"></span>
        <button class="page-search-step" type="button" data-page-search-step="-1" data-page-search-scope="environment-mapping" title="上一个匹配" aria-label="上一个匹配">‹</button>
        <button class="page-search-step" type="button" data-page-search-step="1" data-page-search-scope="environment-mapping" title="下一个匹配" aria-label="下一个匹配">›</button>
      </div>
    `;
  }

  function renderMappingTab({ viewModel, selectedRowId, selectedEnvironmentId, selectedSegmentId, selectedObjectId, search, expandedIds, catalogCollapsed, graphVariant = "funnel" }) {
    const showObjectRelations = viewModel?.selectedMode === "object";
    const hasSelection = Boolean(viewModel?.selectedMode);
    const hasSearch = String(search || "").trim().length > 0;
    const isSearchEmpty = hasSearch && !utils.list(viewModel?.navigationTree).length;
    return `
      <div class="environment-mapping-workbench ${catalogCollapsed ? "catalog-collapsed" : ""}">
        <div class="environment-workspace-control-row page-local-search-toolbar">
          ${renderEnvironmentSearchControl(search)}
        </div>
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
          <div id="environmentTree" class="environment-tree" data-environment-tree-scroll>
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
            isSearchEmpty
              ? `<div class="reference-empty environment-search-empty">未找到匹配的信息化环境对象。请调整页面内搜索条件。</div>`
              : !hasSelection
              ? `<div class="reference-empty environment-selection-empty">请选择左侧信息化环境或对象。</div>`
              : showObjectRelations
              ? components.EnvironmentScopeServiceMatrix?.render({
                  rows: viewModel?.scopeServiceRows,
                  groups: viewModel?.scopeServiceGroups,
                  showObjectColumn: viewModel?.detailPanel?.showObjectColumn,
                  selectedRowId,
                  grouped: false,
                  variant: graphVariant,
                }) || '<div class="reference-empty">环境映射表组件未加载。</div>'
              : renderStatisticsMapping({ viewModel })
          }
        </section>
      </div>
    `;
  }

  function render({ viewModel, selectedRowId = "", selectedEnvironmentId = "", selectedSegmentId = "", selectedObjectId = "", search = "", activeTab = "topology", expandedIds, catalogCollapsed = false } = {}) {
    const normalizedActiveTab = activeTab === "mapping" ? "mapping" : "topology";
    const showMapping = normalizedActiveTab === "mapping";
    const graphVariant = "funnel";
    return `
      <section class="semantic-panel environment-relation-map environment-tabbed-map" data-environment-active-tab="${escape(normalizedActiveTab)}">
        <div class="environment-tab-panels">
          <div class="environment-tab-panel ${showMapping ? "environment-tab-panel-mapping" : "environment-tab-panel-topology"} is-active">
            ${
              showMapping
                ? renderMappingTab({ viewModel, selectedRowId, selectedEnvironmentId, selectedSegmentId, selectedObjectId, search, expandedIds, catalogCollapsed, graphVariant })
                : renderTopology({ viewModel, search })
            }
          </div>
        </div>
      </section>
    `;
  }

  components.EnvironmentLocalRelationMap = { render };
})();
