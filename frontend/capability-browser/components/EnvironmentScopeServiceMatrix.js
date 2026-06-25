(function () {
  const components = (window.sapdComponents = window.sapdComponents || {});
  const utils = components.utils;
  const ROW_HEIGHT = 74;
  const NODE_HEIGHT = 56;
  const SERVICE_WIDTH = 322;
  const TARGET_WIDTH = 286;
  const TARGET_GAP = 12;
  const STAGE_PADDING_X = 22;
  const STAGE_PADDING_Y = 58;
  const TARGET_GROUP_GAP = 46;
  const CLUSTER_INSET = 8;

  function serviceKey(item) {
    return item?.code || item?.id || item?.title || item?.name || "";
  }

  function relationNodeKey(item) {
    return [item?.id, item?.code, item?.title, item?.name, item?.objectKind, item?.type].filter(Boolean).join("::");
  }

  function relationNodeKind(node) {
    if (node?.relationKind === "measure") return "安全技术措施";
    return node?.kind || node?.objectKind || "安全技术模块";
  }

  function relationCategory(node) {
    return relationNodeKind(node).includes("措施") ? "measure" : "module";
  }

  function uniqueBy(items, keyFn) {
    const seen = new Set();
    return utils.list(items).filter((item) => {
      const key = keyFn(item);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  function addUnique(items, item, keyFn) {
    if (!item) return;
    const key = keyFn(item);
    if (!key || items.some((row) => keyFn(row) === key)) return;
    items.push(item);
  }

  function scopeCodeFromService(service) {
    const explicit = utils.list(service?.scopes)[0]?.code || utils.list(service?.scopes)[0]?.id || "";
    if (explicit) return explicit;
    const code = service?.code || "";
    return String(code).split("&")[0] || "";
  }

  function scopeTitle(scope) {
    return utils.codeTitleOf(scope || {});
  }

  function fallbackGroupsFromRows(rows) {
    const groups = new Map();
    const serviceScopesByGroup = new Map();
    for (const [index, row] of utils.list(rows).entries()) {
      const object = row.object || { id: `object:${index}`, title: "当前信息化对象" };
      const objectKey = object.id || object.code || object.title || `object:${index}`;
      if (!groups.has(objectKey)) {
        groups.set(objectKey, {
          id: objectKey,
          objectKey,
          environment: row.environment || null,
          object,
          objectTitle: utils.titleOf(object, "当前信息化对象"),
          segments: [],
          scopes: [],
          services: [],
          modules: [],
          edges: [],
          oneToManyCount: 0,
          manyToOneCount: 0,
        });
        serviceScopesByGroup.set(objectKey, new Map());
      }
      const group = groups.get(objectKey);
      if (!group.environment && row.environment) group.environment = row.environment;
      const rowScopes = utils.list(row.scopes).length ? utils.list(row.scopes) : [row.scope];
      group.segments = uniqueBy([...group.segments, ...utils.list(row.segments)], (segment) => segment.id || segment.code || segment.title);
      group.scopes = uniqueBy([...group.scopes, ...rowScopes], (scope) => scope?.code || scope?.id || scope?.title);
      group.services = uniqueBy([...group.services, ...utils.list(row.services)], serviceKey);

      const serviceScopes = serviceScopesByGroup.get(objectKey);
      for (const service of utils.list(row.services)) {
        const key = serviceKey(service);
        if (!serviceScopes.has(key)) serviceScopes.set(key, []);
        for (const scope of rowScopes) addUnique(serviceScopes.get(key), scope, (item) => item?.code || item?.id || item?.title);
      }

      const nodes = utils.list(row.relationNodes).length ? utils.list(row.relationNodes) : [...utils.list(row.modules), ...utils.list(row.measures)];
      group.modules = uniqueBy([...group.modules, ...nodes], relationNodeKey);
      for (const service of utils.list(row.services)) {
        for (const node of nodes) {
          const edge = {
            edgeKey: `${serviceKey(service)}::${relationNodeKey(node)}`,
            serviceKey: serviceKey(service),
            moduleKey: relationNodeKey(node),
            service,
            module: node,
          };
          if (!group.edges.some((item) => item.edgeKey === edge.edgeKey)) group.edges.push(edge);
        }
      }
    }

    return [...groups.values()].map((group) => normalizeGroup(group, serviceScopesByGroup.get(group.objectKey)));
  }

  function normalizeGroup(group, serviceScopeMap = null) {
    const serviceCounts = new Map();
    const targetCounts = new Map();
    for (const edge of utils.list(group.edges)) {
      serviceCounts.set(edge.serviceKey, (serviceCounts.get(edge.serviceKey) || 0) + 1);
      targetCounts.set(edge.moduleKey, (targetCounts.get(edge.moduleKey) || 0) + 1);
    }
    const defaultFocusServiceKey =
      group.defaultFocusServiceKey ||
      [...serviceCounts.entries()].sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0], "zh-Hans-CN"))[0]?.[0] ||
      "";
    const serviceScopes = serviceScopeMap || new Map(utils.list(group.services).map((service) => [serviceKey(service), utils.list(service.scopes)]));
    return {
      ...group,
      defaultFocusServiceKey,
      services: utils.list(group.services).map((service) => {
        const key = serviceKey(service);
        const count = serviceCounts.get(key) || Number(service.relationCount || 0);
        return {
          ...service,
          scopes: serviceScopes.get(key) || utils.list(service.scopes),
          relationCount: count,
          relationType: count > 1 ? "one_to_many" : "one_to_one",
          isDefaultFocus: key === defaultFocusServiceKey,
        };
      }),
      modules: utils.list(group.modules).map((module) => {
        const key = relationNodeKey(module);
        const count = targetCounts.get(key) || Number(module.relationCount || 0);
        return {
          ...module,
          relationCount: count,
          relationType: count > 1 ? "many_to_one" : "one_to_one",
        };
      }),
      oneToManyCount: [...serviceCounts.values()].filter((count) => count > 1).length,
      manyToOneCount: [...targetCounts.values()].filter((count) => count > 1).length,
    };
  }

  function splitServices(services) {
    const left = [];
    const right = [];
    utils.list(services).forEach((service, index) => {
      (index % 2 === 0 ? left : right).push(service);
    });
    return { left, right };
  }

  function targetGroups(targets) {
    const modules = utils.list(targets).filter((target) => relationCategory(target) === "module");
    const measures = utils.list(targets).filter((target) => relationCategory(target) === "measure");
    return [
      { key: "modules", title: "安全技术模块", type: "module", targets: modules },
      { key: "measures", title: "安全技术措施", type: "measure", targets: measures },
    ].filter((group) => group.targets.length);
  }

  function layoutGraph(group) {
    const services = utils.list(group.services);
    const targets = utils.list(group.modules);
    const { left, right } = splitServices(services);
    const groups = targetGroups(targets);
    const serviceRows = Math.max(left.length, right.length, 1);
    const targetRows = groups.reduce((sum, row) => sum + row.targets.length, 0) + Math.max(0, groups.length - 1);
    const graphHeight = Math.max(520, STAGE_PADDING_Y * 2 + Math.max(serviceRows, targetRows) * ROW_HEIGHT);
    const graphWidth = 1120;
    const centerX = graphWidth / 2;
    const leftX = STAGE_PADDING_X;
    const rightX = graphWidth - STAGE_PADDING_X - SERVICE_WIDTH;
    const targetX = centerX - TARGET_WIDTH / 2;
    const serviceStartY = STAGE_PADDING_Y;
    const targetStartY = STAGE_PADDING_Y;
    const servicePositions = new Map();
    const targetPositions = new Map();
    const nodes = [];
    const clusters = [];

    const placeService = (service, index, side) => {
      const key = serviceKey(service);
      const x = side === "left" ? leftX + CLUSTER_INSET : rightX - CLUSTER_INSET;
      const y = serviceStartY + index * ROW_HEIGHT;
      servicePositions.set(key, { x, y, side });
      nodes.push({ kind: "service", side, item: service, key, x, y, width: SERVICE_WIDTH, height: NODE_HEIGHT });
    };
    left.forEach((service, index) => placeService(service, index, "left"));
    right.forEach((service, index) => placeService(service, index, "right"));

    if (left.length) clusters.push({ key: "services-left", label: "安全技术服务", count: `${left.length} 项`, type: "service", side: "left", x: leftX - 12, y: serviceStartY - 46, width: SERVICE_WIDTH + 24, height: left.length * ROW_HEIGHT + 38 });
    if (right.length) clusters.push({ key: "services-right", label: "安全技术服务", count: `${right.length} 项`, type: "service", side: "right", x: rightX - 12, y: serviceStartY - 46, width: SERVICE_WIDTH + 24, height: right.length * ROW_HEIGHT + 38 });

    let targetCursor = targetStartY;
    for (const groupRow of groups) {
      const height = groupRow.targets.length * ROW_HEIGHT + 38;
      clusters.push({ key: groupRow.key, label: groupRow.title, count: `${groupRow.targets.length} 项`, type: groupRow.type, x: targetX - 12, y: targetCursor - 46, width: TARGET_WIDTH + 24, height });
      for (const target of groupRow.targets) {
        const key = relationNodeKey(target);
        const x = targetX + CLUSTER_INSET;
        targetPositions.set(key, { x, y: targetCursor, side: "center" });
        nodes.push({ kind: "target", targetType: groupRow.type, item: target, key, x, y: targetCursor, width: TARGET_WIDTH - CLUSTER_INSET * 2, height: NODE_HEIGHT });
        targetCursor += ROW_HEIGHT;
      }
      targetCursor += TARGET_GROUP_GAP;
    }

    const edges = utils.list(group.edges)
      .map((edge) => {
        const source = servicePositions.get(edge.serviceKey);
        const target = targetPositions.get(edge.moduleKey);
        if (!source || !target) return null;
        const targetNode = targets.find((item) => relationNodeKey(item) === edge.moduleKey);
        const sourceIsLeft = source.side === "left";
        const start = {
          x: sourceIsLeft ? source.x + SERVICE_WIDTH : source.x,
          y: source.y + NODE_HEIGHT / 2,
        };
        const end = {
          x: sourceIsLeft ? target.x : target.x + TARGET_WIDTH,
          y: target.y + NODE_HEIGHT / 2,
        };
        const dx = Math.max(92, Math.abs(end.x - start.x));
        const direction = sourceIsLeft ? 1 : -1;
        return {
          ...edge,
          category: relationCategory(targetNode),
          d: `M ${start.x} ${start.y} C ${start.x + direction * dx * 0.46} ${start.y}, ${end.x - direction * dx * 0.46} ${end.y}, ${end.x} ${end.y}`,
        };
      })
      .filter(Boolean);

    return { graphWidth, graphHeight, nodes, edges, clusters };
  }

  function segmentText(segments) {
    const rows = utils.list(segments).map((segment) => utils.codeTitleOf(segment)).filter(Boolean);
    return rows.length ? rows.join(" / ") : "未定义环境子类";
  }

  function contextPath(group) {
    const environment = utils.titleOf(group.environment, "信息化环境");
    const object = group.objectTitle || utils.titleOf(group.object, "当前信息化对象");
    return [environment, segmentText(group.segments), object].filter(Boolean).join(" - ");
  }

  function renderScopeLegend(scopes, extraClass = "") {
    const rows = utils.list(scopes).filter(Boolean);
    if (!rows.length) return "";
    return `
      <div class="environment-object-graph-legend ${utils.escapeHtml(extraClass)}">
        ${rows
          .map((scope) => `<span class="environment-object-scope-key" data-scope="${utils.escapeHtml(scope.code || scope.id || "")}">${utils.escapeHtml(scopeTitle(scope))}</span>`)
          .join("")}
      </div>
    `;
  }

  function metric(label, value) {
    return `<span><b>${utils.escapeHtml(String(value))}</b>${utils.escapeHtml(label)}</span>`;
  }

  function renderHud(group) {
    return `
      <aside class="environment-object-graph-hud">
        <div class="environment-object-context-line">${utils.escapeHtml(contextPath(group))}</div>
        <div class="environment-object-graph-metrics">
          ${metric("作用域", utils.list(group.scopes).length)}
          ${metric("服务", utils.list(group.services).length)}
          ${metric("模块/措施", utils.list(group.modules).length)}
          ${metric("关系", utils.list(group.edges).length)}
        </div>
      </aside>
    `;
  }

  function renderCluster(cluster) {
    const classNames = [
      "environment-object-graph-cluster",
      cluster.type === "service" ? "is-service-cluster" : "is-module-cluster",
      cluster.side === "left" ? "is-services-left" : "",
    ]
      .filter(Boolean)
      .join(" ");
    return `
      <div class="${classNames}" style="--cluster-x:${cluster.x}px; --cluster-y:${cluster.y}px; --cluster-width:${cluster.width}px; --cluster-height:${cluster.height}px;">
        <span>${utils.escapeHtml(cluster.label)}</span>
        <em>${utils.escapeHtml(cluster.count)}</em>
      </div>
    `;
  }

  function nodeMeta(item, kind) {
    if (kind === "service") {
      const moduleCount = Number(item.relationCount || 0);
      return `关联 ${moduleCount} 个模块/措施`;
    }
    return `关联 ${Number(item.relationCount || 0)} 项服务`;
  }

  function renderNode(node, group, activeServiceKey, activeTargetKeys) {
    const isService = node.kind === "service";
    const active = isService ? node.key === activeServiceKey : activeTargetKeys.has(node.key);
    const muted = activeServiceKey && !active;
    const scopeCode = isService ? scopeCodeFromService(node.item) : "";
    const classNames = [
      "environment-object-graph-node",
      isService ? "environment-object-service-node" : "environment-object-target-node",
      isService && node.side === "left" ? "is-left-service" : "",
      isService && node.side === "right" ? "is-right-service" : "",
      !isService && node.targetType === "module" ? "is-module-node" : "",
      !isService && node.targetType === "measure" ? "is-measure-node" : "",
      active ? "is-active" : "",
      muted ? "is-muted" : "",
    ]
      .filter(Boolean)
      .join(" ");
    const attrs = isService
      ? `data-graph-node-kind="service" data-graph-service-key="${utils.escapeHtml(node.key)}" data-scope="${utils.escapeHtml(scopeCode)}"`
      : `data-graph-node-kind="target" data-graph-module-key="${utils.escapeHtml(node.key)}"`;
    return `
      <button
        type="button"
        class="${classNames}"
        style="--node-x:${node.x}px; --node-y:${node.y}px; --node-width:${node.width}px; --node-height:${node.height}px;"
        data-graph-node-key="${utils.escapeHtml(node.key)}"
        ${attrs}
      >
        <span class="environment-object-node-type">${utils.escapeHtml(isService ? "安全技术服务" : relationNodeKind(node.item))}</span>
        <span class="environment-object-node-title">${utils.escapeHtml(utils.codeTitleOf(node.item))}</span>
        <span class="environment-object-node-meta">${utils.escapeHtml(nodeMeta(node.item, node.kind))}</span>
      </button>
    `;
  }

  function renderEdges(edges, activeServiceKey, activeTargetKeys, graphWidth, graphHeight) {
    return `
      <svg class="environment-object-graph-links" viewBox="0 0 ${graphWidth} ${graphHeight}" aria-hidden="true" focusable="false">
        ${utils
          .list(edges)
          .map((edge) => {
            const active = edge.serviceKey === activeServiceKey || activeTargetKeys.has(edge.moduleKey);
            const muted = activeServiceKey && !active;
            const classNames = [
              edge.category === "measure" ? "is-measure-edge" : "is-module-edge",
              active ? "is-active" : "",
              muted ? "is-muted" : "",
            ]
              .filter(Boolean)
              .join(" ");
            return `<path class="${classNames}" data-edge-service-key="${utils.escapeHtml(edge.serviceKey)}" data-edge-module-key="${utils.escapeHtml(edge.moduleKey)}" d="${utils.escapeHtml(edge.d)}"></path>`;
          })
          .join("")}
      </svg>
    `;
  }

  function renderGraph(group) {
    const normalized = normalizeGroup(group);
    const layout = layoutGraph(normalized);
    const activeServiceKey = "";
    const activeTargetKeys = new Set(utils.list(normalized.edges).filter((edge) => edge.serviceKey === activeServiceKey).map((edge) => edge.moduleKey));
    return `
      <article
        class="environment-object-graph"
        style="--graph-width:${layout.graphWidth}px; --graph-height:${layout.graphHeight}px;"
        data-default-service-key="${utils.escapeHtml(activeServiceKey)}"
      >
        ${renderHud(normalized)}
        ${renderScopeLegend(normalized.scopes, "environment-object-graph-scope-legend")}
        <div class="environment-object-graph-stage">
          ${renderEdges(layout.edges, activeServiceKey, activeTargetKeys, layout.graphWidth, layout.graphHeight)}
          <div class="environment-object-graph-cluster-layer">${layout.clusters.map(renderCluster).join("")}</div>
          ${layout.nodes.map((node) => renderNode(node, normalized, activeServiceKey, activeTargetKeys)).join("")}
        </div>
      </article>
    `;
  }

  function resetFocus(graph) {
    graph.classList.remove("is-live-focus", "is-locked-focus");
    graph.querySelectorAll(".is-active, .is-muted").forEach((item) => item.classList.remove("is-active", "is-muted"));
  }

  function applyFocus(graph, kind, key, locked = false) {
    resetFocus(graph);
    if (!kind || !key) return;
    graph.classList.add("is-live-focus");
    if (locked) graph.classList.add("is-locked-focus");
    const serviceKeys = new Set();
    const moduleKeys = new Set();
    graph.querySelectorAll(".environment-object-graph-links path").forEach((edge) => {
      const edgeServiceKey = edge.getAttribute("data-edge-service-key");
      const edgeModuleKey = edge.getAttribute("data-edge-module-key");
      const active = kind === "service" ? edgeServiceKey === key : edgeModuleKey === key;
      if (active) {
        edge.classList.add("is-active");
        if (edgeServiceKey) serviceKeys.add(edgeServiceKey);
        if (edgeModuleKey) moduleKeys.add(edgeModuleKey);
      } else {
        edge.classList.add("is-muted");
      }
    });
    graph.querySelectorAll("[data-graph-service-key]").forEach((node) => {
      const nodeKey = node.getAttribute("data-graph-service-key");
      if (serviceKeys.has(nodeKey) || (kind === "service" && nodeKey === key)) node.classList.add("is-active");
      else node.classList.add("is-muted");
    });
    graph.querySelectorAll("[data-graph-module-key]").forEach((node) => {
      const nodeKey = node.getAttribute("data-graph-module-key");
      if (moduleKeys.has(nodeKey) || (kind === "target" && nodeKey === key)) node.classList.add("is-active");
      else node.classList.add("is-muted");
    });
  }

  function restoreLockedFocus(graph) {
    const kind = graph.dataset.lockedFocusKind || "";
    const key = graph.dataset.lockedFocusKey || "";
    if (kind && key) applyFocus(graph, kind, key, true);
    else {
      const defaultService = graph.dataset.defaultServiceKey || "";
      if (defaultService) applyFocus(graph, "service", defaultService, false);
      else resetFocus(graph);
    }
  }

  function bindGraphFocus() {
    if (window.__sapdEnvironmentObjectGraphBound || typeof document === "undefined" || !document?.addEventListener) return;
    window.__sapdEnvironmentObjectGraphBound = true;
    document.addEventListener("mouseover", (event) => {
      const node = event.target.closest?.("[data-graph-node-key]");
      const graph = node?.closest?.(".environment-object-graph");
      if (!node || !graph) return;
      const kind = node.getAttribute("data-graph-node-kind") === "service" ? "service" : "target";
      applyFocus(graph, kind, node.getAttribute("data-graph-node-key") || "", false);
    });
    document.addEventListener("mouseout", (event) => {
      const graph = event.target.closest?.(".environment-object-graph");
      if (!graph || graph.contains(event.relatedTarget)) return;
      restoreLockedFocus(graph);
    });
    document.addEventListener("click", (event) => {
      const graph = event.target.closest?.(".environment-object-graph");
      if (!graph) return;
      const node = event.target.closest?.("[data-graph-node-key]");
      if (!node) {
        delete graph.dataset.lockedFocusKind;
        delete graph.dataset.lockedFocusKey;
        restoreLockedFocus(graph);
        return;
      }
      const kind = node.getAttribute("data-graph-node-kind") === "service" ? "service" : "target";
      const key = node.getAttribute("data-graph-node-key") || "";
      graph.dataset.lockedFocusKind = kind;
      graph.dataset.lockedFocusKey = key;
      applyFocus(graph, kind, key, true);
    });
  }

  function render({ rows, groups }) {
    bindGraphFocus();
    const objectGroups = utils.list(groups).length ? utils.list(groups).map((group) => normalizeGroup(group)) : fallbackGroupsFromRows(rows);
    return `
      <section class="semantic-panel environment-mapping-section environment-object-graph-section">
        <div class="environment-object-graph-list">
          ${objectGroups.length ? objectGroups.map(renderGraph).join("") : `<div class="reference-empty">暂无环境映射</div>`}
        </div>
      </section>
    `;
  }

  components.EnvironmentScopeServiceMatrix = { render };
})();
