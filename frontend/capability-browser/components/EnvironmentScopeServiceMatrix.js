(function () {
  const components = (window.sapdComponents = window.sapdComponents || {});
  const utils = components.utils;
  const display = window.sapdDisplay || {};
  const ROW_HEIGHT = 74;
  const NODE_HEIGHT = 56;
  const SERVICE_WIDTH = 322;
  const TARGET_WIDTH = 286;
  const TARGET_GAP = 12;
  const STAGE_PADDING_X = 22;
  const STAGE_PADDING_Y = 58;
  const TARGET_GROUP_GAP = 46;
  const CLUSTER_INSET = 8;
  const scrollTimers = new WeakMap();
  const funnelDrawFrames = new WeakMap();
  const funnelDragState = new WeakMap();

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

  function systemKey(item) {
    return item?.id || item?.code || item?.title || item?.name || "";
  }

  function annotationAttrs(value) {
    return display.annotationValueAttrs?.(utils, value) || "";
  }

  function annotationObjectAttrs(item, { objectType = "knowledge_object", objectLabel = "业务对象", title = "" } = {}) {
    const visibleTitle = title || utils.codeTitleOf(item);
    const textValue = utils.text || ((value) => (value == null ? "" : String(value)));
    const stableKey = textValue(item?.code || item?.id || item?.title || item?.name || visibleTitle).trim();
    if (!stableKey || stableKey === "/") return "";
    const target = {
      targetRef: `base:${objectType}:${stableKey}`,
      objectType,
      objectLabel,
      id: item?.id || stableKey,
      code: item?.code || stableKey,
      title: visibleTitle,
      anchorType: "object",
    };
    return display.annotationTargetAttrs?.(target, { title: visibleTitle }) || "";
  }

  function relationNodeSystems(node) {
    return uniqueBy([...utils.list(node?.securitySystems), ...utils.list(node?.systems), ...utils.list(node?.linkedSystems)], systemKey);
  }

  function commaKeys(values) {
    return utils.list(values).filter(Boolean).join(",");
  }

  function relationCountUnit(count, unit) {
    return `${Number(count || 0)} ${unit}`;
  }

  function clampNumber(value, min, max) {
    const number = Number(value);
    if (!Number.isFinite(number)) return min;
    return Math.min(max, Math.max(min, number));
  }

  function serviceTargetMeta(targets) {
    const moduleCount = utils.list(targets).filter((target) => relationCategory(target) === "module").length;
    const measureCount = utils.list(targets).filter((target) => relationCategory(target) === "measure").length;
    return [
      moduleCount ? relationCountUnit(moduleCount, "模块") : "",
      measureCount ? relationCountUnit(measureCount, "措施") : "",
    ]
      .filter(Boolean)
      .join(" / ") || "无模块/措施";
  }

  function targetServiceMeta(target, serviceCount) {
    const systemCount = relationNodeSystems(target).length;
    return [relationCountUnit(serviceCount, "服务"), systemCount ? relationCountUnit(systemCount, "系统") : ""].filter(Boolean).join(" / ");
  }

  function systemTargetMeta(targets) {
    const moduleCount = utils.list(targets).filter((target) => relationCategory(target) === "module").length;
    const measureCount = utils.list(targets).filter((target) => relationCategory(target) === "measure").length;
    return [
      moduleCount ? `承接 ${relationCountUnit(moduleCount, "模块")}` : "",
      measureCount ? `承接 ${relationCountUnit(measureCount, "措施")}` : "",
    ]
      .filter(Boolean)
      .join(" / ") || "暂无承接";
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
          .map((scope) => {
            const title = scopeTitle(scope);
            return `<span class="environment-object-scope-key" data-scope="${utils.escapeHtml(scope.code || scope.id || "")}"${annotationAttrs(title)}>${utils.escapeHtml(title)}</span>`;
          })
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
        <div class="environment-object-context-line"${annotationAttrs(contextPath(group))}>${utils.escapeHtml(contextPath(group))}</div>
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
        <span class="environment-object-node-title"${annotationAttrs(utils.codeTitleOf(node.item))}>${utils.escapeHtml(utils.codeTitleOf(node.item))}</span>
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

  function renderLegacyGraph(group) {
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

  function scopeLookup(scopes) {
    const lookup = new Map();
    for (const scope of utils.list(scopes)) {
      const key = scope?.code || scope?.id || scope?.title || "";
      if (key && !lookup.has(key)) lookup.set(key, scope);
    }
    return lookup;
  }

  function scopeRowForService(service, scopesByCode) {
    const code = scopeCodeFromService(service);
    const explicitScope = utils.list(service?.scopes)[0];
    const scope = scopesByCode.get(code) || explicitScope || { code, title: code || "未定义作用域" };
    return {
      key: code || scope?.id || scope?.title || "scope:unknown",
      code: code || scope?.code || scope?.id || "",
      title: scopeTitle(scope),
    };
  }

  function buildFunnelModel(group) {
    const services = utils.list(group.services);
    const targets = utils.list(group.modules);
    const targetByKey = new Map(targets.map((target) => [relationNodeKey(target), target]));
    const edgesByService = new Map();
    const servicesByTarget = new Map();
    for (const edge of utils.list(group.edges)) {
      if (!edgesByService.has(edge.serviceKey)) edgesByService.set(edge.serviceKey, []);
      if (!servicesByTarget.has(edge.moduleKey)) servicesByTarget.set(edge.moduleKey, []);
      const target = targetByKey.get(edge.moduleKey);
      if (target) addUnique(edgesByService.get(edge.serviceKey), target, relationNodeKey);
      if (edge.service) addUnique(servicesByTarget.get(edge.moduleKey), edge.service, serviceKey);
    }

    const scopesByCode = scopeLookup(group.scopes);
    const scopeRows = [];
    const scopeRowsByKey = new Map();
    for (const service of services) {
      const key = serviceKey(service);
      const scope = scopeRowForService(service, scopesByCode);
      if (!scopeRowsByKey.has(scope.key)) {
        scopeRowsByKey.set(scope.key, { ...scope, services: [] });
        scopeRows.push(scopeRowsByKey.get(scope.key));
      }
      const serviceTargets = edgesByService.get(key) || [];
      scopeRowsByKey.get(scope.key).services.push({
        service,
        key,
        targetKeys: serviceTargets.map(relationNodeKey),
        meta: serviceTargetMeta(serviceTargets),
      });
    }

    const targetRows = targets.map((target) => {
      const key = relationNodeKey(target);
      return {
        target,
        key,
        category: relationCategory(target),
        systemKeys: relationNodeSystems(target).map(systemKey),
        serviceCount: utils.list(servicesByTarget.get(key)).length || Number(target.relationCount || 0),
      };
    });
    const systems = [];
    const targetsBySystem = new Map();
    for (const target of targets) {
      for (const system of relationNodeSystems(target)) {
        const key = systemKey(system);
        if (!key) continue;
        addUnique(systems, system, systemKey);
        if (!targetsBySystem.has(key)) targetsBySystem.set(key, []);
        addUnique(targetsBySystem.get(key), target, relationNodeKey);
      }
    }
    const systemRows = systems.map((system) => {
      const key = systemKey(system);
      const linkedTargets = targetsBySystem.get(key) || [];
      return {
        system,
        key,
        targetKeys: linkedTargets.map(relationNodeKey),
        meta: systemTargetMeta(linkedTargets),
      };
    });
    return {
      scopeRows: scopeRows.filter((row) => row.services.length),
      moduleTargets: targetRows.filter((target) => target.category === "module"),
      measureTargets: targetRows.filter((target) => target.category === "measure"),
      systems: systemRows,
      defaultFocusKey: group.defaultFocusServiceKey || services.map(serviceKey).find(Boolean) || "",
    };
  }

  function funnelBandStyle(model) {
    const serviceCount = model.scopeRows.reduce((total, row) => total + utils.list(row.services).length, 0);
    const targetCount = model.moduleTargets.length + model.measureTargets.length;
    const systemCount = model.systems.length;
    const serviceWeight = Math.max(serviceCount, targetCount);
    const systemWeight = Math.max(targetCount, systemCount);
    const hasServiceFlow = serviceCount > 0 && targetCount > 0;
    const hasSystemFlow = targetCount > 0 && systemCount > 0;
    const serviceHeight = hasServiceFlow ? clampNumber(150 + serviceWeight * 34, 180, 620) : 0;
    const systemHeight = hasSystemFlow ? clampNumber(132 + systemWeight * 28, 160, 540) : 0;
    const serviceWidth = hasServiceFlow ? clampNumber(44 + serviceWeight * 5, 52, 118) : 0;
    const systemWidth = hasSystemFlow ? clampNumber(36 + systemWeight * 4, 42, 82) : 0;
    const serviceOpacity = hasServiceFlow ? clampNumber(0.18 + serviceWeight * 0.035, 0.2, 0.7) : 0;
    const systemOpacity = hasSystemFlow ? clampNumber(0.14 + systemWeight * 0.03, 0.16, 0.52) : 0;
    return [
      `--funnel-service-band-height:${Math.round(serviceHeight)}px`,
      `--funnel-service-band-width:${Math.round(serviceWidth)}px`,
      `--funnel-service-band-opacity:${serviceOpacity.toFixed(2)}`,
      `--funnel-system-band-height:${Math.round(systemHeight)}px`,
      `--funnel-system-band-width:${Math.round(systemWidth)}px`,
      `--funnel-system-band-opacity:${systemOpacity.toFixed(2)}`,
    ].join(";");
  }

  function renderFunnelService(row) {
    const scopeCode = scopeCodeFromService(row.service);
    return `
      <button
        class="environment-object-funnel-node environment-object-funnel-service"
        type="button"
        data-environment-funnel-node="${utils.escapeHtml(row.key)}"
        data-environment-funnel-targets="${utils.escapeHtml(commaKeys(row.targetKeys))}"
        data-scope="${utils.escapeHtml(scopeCode)}"
        data-annotation-prefer-target="true"
        ${annotationObjectAttrs(row.service, { objectType: "security_technical_service", objectLabel: "安全技术服务", title: utils.codeTitleOf(row.service) })}
      >
        <span class="environment-object-funnel-node-title"${annotationAttrs(utils.codeTitleOf(row.service))}>${utils.escapeHtml(utils.codeTitleOf(row.service))}</span>
        <span class="environment-object-funnel-node-meta">${utils.escapeHtml(row.meta)}</span>
      </button>
    `;
  }

  function renderFunnelScopeGroup(scopeRow) {
    return `
      <section class="environment-object-funnel-scope-group" data-scope="${utils.escapeHtml(scopeRow.code)}">
        <header>
          <span class="environment-object-funnel-scope-title"${annotationAttrs(scopeRow.title)}>${utils.escapeHtml(scopeRow.title)}</span>
          <span class="environment-object-funnel-chip">${utils.escapeHtml(`${scopeRow.services.length} 项`)}</span>
        </header>
        <div class="environment-object-funnel-service-list">
          ${scopeRow.services.map(renderFunnelService).join("")}
        </div>
      </section>
    `;
  }

  function renderFunnelTarget(row) {
    const isMeasure = row.category === "measure";
    return `
      <button
        class="environment-object-funnel-node environment-object-funnel-target ${isMeasure ? "is-measure" : "is-module"}"
        type="button"
        data-environment-funnel-node="${utils.escapeHtml(row.key)}"
        data-environment-funnel-systems="${utils.escapeHtml(commaKeys(row.systemKeys))}"
        data-annotation-prefer-target="true"
        ${annotationObjectAttrs(row.target, {
          objectType: isMeasure ? "security_technical_measure" : "security_technology_module",
          objectLabel: isMeasure ? "安全技术措施" : "安全技术模块",
          title: utils.codeTitleOf(row.target),
        })}
      >
        <span class="environment-object-funnel-node-type">${utils.escapeHtml(isMeasure ? "安全技术措施" : "安全技术模块")}</span>
        <span class="environment-object-funnel-node-title"${annotationAttrs(utils.codeTitleOf(row.target))}>${utils.escapeHtml(utils.codeTitleOf(row.target))}</span>
        <span class="environment-object-funnel-node-meta">${utils.escapeHtml(targetServiceMeta(row.target, row.serviceCount))}</span>
      </button>
    `;
  }

  function renderFunnelZone(title, rows, emptyText, extraClass = "") {
    return `
      <section class="environment-object-funnel-zone ${utils.escapeHtml(extraClass)}">
        <div class="environment-object-funnel-section-head">
          <strong>${utils.escapeHtml(title)}</strong>
          <span class="environment-object-funnel-chip">${utils.escapeHtml(`${rows.length} 项`)}</span>
        </div>
        <div class="environment-object-funnel-zone-list">
          ${rows.length ? rows.map(renderFunnelTarget).join("") : `<span class="reference-empty">${utils.escapeHtml(emptyText)}</span>`}
        </div>
      </section>
    `;
  }

  function renderFunnelSystem(row) {
    return `
      <button
        class="environment-object-funnel-node environment-object-funnel-system"
        type="button"
        data-environment-funnel-node="${utils.escapeHtml(row.key)}"
        data-annotation-prefer-target="true"
        ${annotationObjectAttrs(row.system, { objectType: "security_system", objectLabel: "安全系统", title: utils.codeTitleOf(row.system) })}
      >
        <span class="environment-object-funnel-node-title"${annotationAttrs(utils.codeTitleOf(row.system))}>${utils.escapeHtml(utils.codeTitleOf(row.system))}</span>
        <span class="environment-object-funnel-node-meta">${utils.escapeHtml(row.meta)}</span>
      </button>
    `;
  }

  function renderFunnelGraph(group) {
    const normalized = normalizeGroup(group);
    const model = buildFunnelModel(normalized);
    return `
      <article class="environment-object-graph environment-object-funnel-graph is-funnel-layout" data-default-funnel-key="${utils.escapeHtml(model.defaultFocusKey)}">
        ${renderHud(normalized)}
        ${renderScopeLegend(normalized.scopes, "environment-object-graph-scope-legend")}
        <div class="environment-object-funnel-shell">
          <section class="environment-object-funnel-frame" aria-label="服务汇聚到模块措施和安全系统关系图">
            <div class="environment-object-funnel-viewport">
              <div class="environment-object-funnel-board" style="${utils.escapeHtml(funnelBandStyle(model))}">
                <svg class="environment-object-funnel-edge-layer" aria-hidden="true" focusable="false"></svg>
                <div class="environment-object-funnel-grid">
                  <section class="environment-object-funnel-column">
                    <div class="environment-object-funnel-section-head">
                      <strong>安全技术服务</strong>
                      <span class="environment-object-funnel-chip">按作用域分组</span>
                    </div>
                    <div class="environment-object-funnel-services">
                      ${model.scopeRows.length ? model.scopeRows.map(renderFunnelScopeGroup).join("") : '<div class="reference-empty">暂无安全技术服务。</div>'}
                    </div>
                  </section>
                  <aside class="environment-object-funnel-column">
                    <div class="environment-object-funnel-center-stack">
                      ${renderFunnelZone("安全技术模块", model.moduleTargets, "暂无安全技术模块", "is-module-zone")}
                      ${renderFunnelZone("安全技术措施", model.measureTargets, "暂无安全技术措施", "is-measure-zone")}
                    </div>
                  </aside>
                  <section class="environment-object-funnel-column">
                    <div class="environment-object-funnel-section-head">
                      <strong>安全系统</strong>
                      <span class="environment-object-funnel-chip">${utils.escapeHtml(`${model.systems.length} 项`)}</span>
                    </div>
                    <div class="environment-object-funnel-system-stack">
                      ${model.systems.length ? model.systems.map(renderFunnelSystem).join("") : '<div class="reference-empty">暂无安全系统。</div>'}
                    </div>
                  </section>
                </div>
              </div>
            </div>
          </section>
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
    document.addEventListener(
      "scroll",
      (event) => {
        const graph = event.target?.closest?.(".environment-object-graph");
        if (!graph) return;
        graph.classList.add("is-scrolling");
        if (!graph.classList.contains("is-locked-focus")) resetFocus(graph);
        window.clearTimeout(scrollTimers.get(graph));
        scrollTimers.set(
          graph,
          window.setTimeout(() => {
            graph.classList.remove("is-scrolling");
            restoreLockedFocus(graph);
          }, 90)
        );
      },
      true
    );
    document.addEventListener("mouseover", (event) => {
      const node = event.target.closest?.("[data-graph-node-key]");
      const graph = node?.closest?.(".environment-object-graph");
      if (!node || !graph) return;
      if (graph.classList.contains("is-scrolling")) return;
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

  function funnelNodes(graph) {
    return Array.from(graph?.querySelectorAll?.("[data-environment-funnel-node]") || []);
  }

  function getFunnelNode(graph, key) {
    return funnelNodes(graph).find((node) => node.dataset.environmentFunnelNode === key) || null;
  }

  function funnelKeyList(value) {
    return String(value || "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }

  function buildFunnelEdges(graph) {
    const serviceEdges = Array.from(graph.querySelectorAll(".environment-object-funnel-service")).flatMap((service) => {
      const source = service.dataset.environmentFunnelNode;
      return funnelKeyList(service.dataset.environmentFunnelTargets).map((target) => {
        const targetNode = getFunnelNode(graph, target);
        return {
          source,
          target,
          type: targetNode?.classList.contains("is-measure") ? "measure" : "module",
          phase: "service-target",
        };
      });
    });
    const systemEdges = Array.from(graph.querySelectorAll(".environment-object-funnel-target")).flatMap((target) => {
      const source = target.dataset.environmentFunnelNode;
      return funnelKeyList(target.dataset.environmentFunnelSystems).map((system) => ({
        source,
        target: system,
        type: "system",
        phase: "target-system",
      }));
    });
    return [...serviceEdges, ...systemEdges].filter((edge) => edge.source && edge.target);
  }

  function centerOfFunnel(board, element, side) {
    const rect = element.getBoundingClientRect();
    const base = board.getBoundingClientRect();
    const x = side === "right" ? rect.right - base.left : side === "left" ? rect.left - base.left : rect.left + rect.width / 2 - base.left;
    const y = rect.top + rect.height / 2 - base.top;
    return { x, y };
  }

  function drawFunnelRail(edgeLayer, d, phase, extraClass = "", scope = "") {
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", d);
    path.classList.add("environment-object-funnel-rail", "routing-spine");
    if (extraClass) path.classList.add(extraClass);
    path.dataset.phase = phase;
    if (scope) path.dataset.scope = scope;
    edgeLayer.appendChild(path);
    return path;
  }

  function drawFunnelServiceRails(graph, board, edgeLayer) {
    const base = board.getBoundingClientRect();
    graph.querySelectorAll(".environment-object-funnel-scope-group").forEach((group) => {
      const rect = group.getBoundingClientRect();
      const x = rect.right - base.left + 18;
      const top = rect.top - base.top + 40;
      const bottom = rect.bottom - base.top - 12;
      if (bottom <= top) return;
      drawFunnelRail(edgeLayer, `M ${x} ${top} L ${x} ${bottom}`, "service-target", "", group.dataset.scope || "");
    });
  }

  function drawFunnelSystemRail(graph, board, edgeLayer) {
    const base = board.getBoundingClientRect();
    const targetRect = graph.querySelector(".environment-object-funnel-center-stack")?.getBoundingClientRect();
    const systemRect = graph.querySelector(".environment-object-funnel-system-stack")?.getBoundingClientRect();
    if (!targetRect || !systemRect) return null;
    const x = (targetRect.right + systemRect.left) / 2 - base.left;
    const top = Math.min(targetRect.top, systemRect.top) - base.top + 22;
    const bottom = Math.max(targetRect.bottom, systemRect.bottom) - base.top - 16;
    if (bottom <= top) return null;
    return drawFunnelRail(edgeLayer, `M ${x} ${top} L ${x} ${bottom}`, "target-system", "environment-object-funnel-system-rail");
  }

  function drawFunnelEdges(graph) {
    funnelDrawFrames.delete(graph);
    const board = graph.querySelector(".environment-object-funnel-board");
    const edgeLayer = graph.querySelector(".environment-object-funnel-edge-layer");
    if (!board || !edgeLayer || !graph.isConnected || !board.offsetParent) return;
    const width = board.scrollWidth;
    const height = board.scrollHeight;
    edgeLayer.setAttribute("viewBox", `0 0 ${width} ${height}`);
    edgeLayer.setAttribute("width", width);
    edgeLayer.setAttribute("height", height);
    edgeLayer.innerHTML = "";
    drawFunnelServiceRails(graph, board, edgeLayer);
    const systemRail = drawFunnelSystemRail(graph, board, edgeLayer);
    const systemRailX = systemRail ? Number((systemRail.getAttribute("d") || "").match(/M ([\d.]+)/)?.[1]) : null;
    for (const edge of buildFunnelEdges(graph)) {
      const sourceEl = getFunnelNode(graph, edge.source);
      const targetEl = getFunnelNode(graph, edge.target);
      if (!sourceEl || !targetEl) continue;
      const sourceCenter = centerOfFunnel(board, sourceEl);
      const targetCenter = centerOfFunnel(board, targetEl);
      const sourceIsLeft = sourceCenter.x < targetCenter.x;
      const start = centerOfFunnel(board, sourceEl, sourceIsLeft ? "right" : "left");
      const end = centerOfFunnel(board, targetEl, sourceIsLeft ? "left" : "right");
      const direction = sourceIsLeft ? 1 : -1;
      const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
      const scopeGroup = sourceEl.closest(".environment-object-funnel-scope-group");
      const railX = scopeGroup && edge.phase === "service-target" ? scopeGroup.getBoundingClientRect().right - board.getBoundingClientRect().left + 18 : null;
      if (railX) {
        const railBend = Math.max(58, Math.abs(end.x - railX));
        path.setAttribute(
          "d",
          `M ${start.x} ${start.y} C ${start.x + 18} ${start.y}, ${railX - 18} ${start.y}, ${railX} ${start.y} C ${railX + railBend * 0.45} ${start.y}, ${end.x - railBend * 0.42} ${end.y}, ${end.x} ${end.y}`,
        );
        path.dataset.scope = sourceEl.dataset.scope || "";
      } else if (edge.phase === "target-system" && Number.isFinite(systemRailX)) {
        const railBend = Math.max(48, Math.abs(end.x - systemRailX) * 0.42);
        path.setAttribute(
          "d",
          `M ${start.x} ${start.y} C ${start.x + direction * 28} ${start.y}, ${systemRailX - direction * 24} ${start.y}, ${systemRailX} ${start.y} C ${systemRailX + direction * railBend} ${start.y}, ${end.x - direction * railBend} ${end.y}, ${end.x} ${end.y}`,
        );
      } else {
        const dx = Math.max(72, Math.abs(end.x - start.x));
        path.setAttribute("d", `M ${start.x} ${start.y} C ${start.x + direction * dx * 0.46} ${start.y}, ${end.x - direction * dx * 0.46} ${end.y}, ${end.x} ${end.y}`);
      }
      path.classList.add("environment-object-funnel-edge", `is-${edge.type}`);
      path.dataset.source = edge.source;
      path.dataset.target = edge.target;
      path.dataset.phase = edge.phase;
      edgeLayer.appendChild(path);
    }
    restoreFunnelFocus(graph);
  }

  function scheduleFunnelDraw(graph) {
    if (!graph || funnelDrawFrames.has(graph) || typeof window === "undefined") return;
    funnelDrawFrames.set(graph, window.requestAnimationFrame(() => drawFunnelEdges(graph)));
  }

  function scheduleAllFunnelDraws(root = document) {
    root.querySelectorAll?.(".environment-object-funnel-graph").forEach(scheduleFunnelDraw);
  }

  function resetFunnelFocus(graph) {
    graph.classList.remove("is-funnel-focus", "is-funnel-locked");
    graph.querySelectorAll(".is-active, .is-linked, .is-muted").forEach((node) => node.classList.remove("is-active", "is-linked", "is-muted"));
  }

  function linkedFunnelKeysFor(graph, key) {
    const node = getFunnelNode(graph, key);
    if (!node) return new Set();
    if (node.classList.contains("environment-object-funnel-service")) {
      const targets = funnelKeyList(node.dataset.environmentFunnelTargets);
      const systems = targets.flatMap((target) => funnelKeyList(getFunnelNode(graph, target)?.dataset.environmentFunnelSystems));
      return new Set([...targets, ...systems]);
    }
    if (node.classList.contains("environment-object-funnel-target")) {
      const linkedServices = Array.from(graph.querySelectorAll(".environment-object-funnel-service"))
        .filter((service) => funnelKeyList(service.dataset.environmentFunnelTargets).includes(key))
        .map((service) => service.dataset.environmentFunnelNode);
      const systems = funnelKeyList(node.dataset.environmentFunnelSystems);
      return new Set([...linkedServices, ...systems]);
    }
    if (node.classList.contains("environment-object-funnel-system")) {
      const linkedTargets = Array.from(graph.querySelectorAll(".environment-object-funnel-target"))
        .filter((target) => funnelKeyList(target.dataset.environmentFunnelSystems).includes(key))
        .map((target) => target.dataset.environmentFunnelNode);
      const linkedServices = Array.from(graph.querySelectorAll(".environment-object-funnel-service"))
        .filter((service) => funnelKeyList(service.dataset.environmentFunnelTargets).some((target) => linkedTargets.includes(target)))
        .map((service) => service.dataset.environmentFunnelNode);
      return new Set([...linkedTargets, ...linkedServices]);
    }
    return new Set();
  }

  function applyFunnelFocus(graph, key, locked = false) {
    resetFunnelFocus(graph);
    if (!key) return;
    graph.classList.add("is-funnel-focus");
    if (locked) graph.classList.add("is-funnel-locked");
    graph.dataset.activeFunnelKey = key;
    const linked = linkedFunnelKeysFor(graph, key);
    const activeSet = new Set([key, ...linked]);
    funnelNodes(graph).forEach((node) => {
      const nodeKey = node.dataset.environmentFunnelNode;
      const isActive = nodeKey === key;
      const isLinked = linked.has(nodeKey);
      node.classList.toggle("is-active", isActive);
      node.classList.toggle("is-linked", isLinked);
      node.classList.toggle("is-muted", !isActive && !isLinked);
    });
    graph.querySelectorAll(".environment-object-funnel-edge").forEach((path) => {
      const active = activeSet.has(path.dataset.source) && activeSet.has(path.dataset.target);
      path.classList.toggle("is-active", active);
      path.classList.toggle("is-muted", !active);
    });
    graph.querySelectorAll(".environment-object-funnel-rail[data-scope]").forEach((rail) => {
      const scope = rail.dataset.scope;
      const active = Array.from(graph.querySelectorAll(".environment-object-funnel-service")).some((service) => service.dataset.scope === scope && activeSet.has(service.dataset.environmentFunnelNode));
      rail.classList.toggle("is-active", active);
      rail.classList.toggle("is-muted", !active);
    });
    graph.querySelectorAll(".environment-object-funnel-system-rail").forEach((rail) => {
      const active = Array.from(graph.querySelectorAll('.environment-object-funnel-edge[data-phase="target-system"]')).some((path) => path.classList.contains("is-active"));
      rail.classList.toggle("is-active", active);
      rail.classList.toggle("is-muted", !active);
    });
  }

  function restoreFunnelFocus(graph) {
    const key = graph.dataset.lockedFunnelKey || graph.dataset.activeFunnelKey || graph.dataset.defaultFunnelKey || "";
    if (key) applyFunnelFocus(graph, key, Boolean(graph.dataset.lockedFunnelKey));
    else resetFunnelFocus(graph);
  }

  function bindFunnelFocus() {
    if (window.__sapdEnvironmentObjectFunnelBound || typeof document === "undefined" || !document?.addEventListener) return;
    window.__sapdEnvironmentObjectFunnelBound = true;
    document.addEventListener("mouseover", (event) => {
      const node = event.target.closest?.("[data-environment-funnel-node]");
      const graph = node?.closest?.(".environment-object-funnel-graph");
      if (!node || !graph || funnelDragState.has(graph)) return;
      applyFunnelFocus(graph, node.dataset.environmentFunnelNode || "", false);
    });
    document.addEventListener("mouseout", (event) => {
      const graph = event.target.closest?.(".environment-object-funnel-graph");
      if (!graph || graph.contains(event.relatedTarget)) return;
      restoreFunnelFocus(graph);
    });
    document.addEventListener("click", (event) => {
      const graph = event.target.closest?.(".environment-object-funnel-graph");
      if (!graph) return;
      const node = event.target.closest?.("[data-environment-funnel-node]");
      if (!node) {
        delete graph.dataset.lockedFunnelKey;
        restoreFunnelFocus(graph);
        return;
      }
      graph.dataset.lockedFunnelKey = node.dataset.environmentFunnelNode || "";
      applyFunnelFocus(graph, graph.dataset.lockedFunnelKey, true);
    });
    document.addEventListener("pointerdown", (event) => {
      const viewport = event.target.closest?.(".environment-object-funnel-viewport");
      const graph = viewport?.closest?.(".environment-object-funnel-graph");
      if (!viewport || !graph || event.target.closest("button")) return;
      funnelDragState.set(graph, {
        viewport,
        pointerId: event.pointerId,
        x: event.clientX,
        y: event.clientY,
        left: viewport.scrollLeft,
        top: viewport.scrollTop,
      });
      viewport.setPointerCapture?.(event.pointerId);
    });
    document.addEventListener("pointermove", (event) => {
      const graph = event.target.closest?.(".environment-object-funnel-graph") || Array.from(document.querySelectorAll(".environment-object-funnel-graph")).find((item) => funnelDragState.get(item)?.pointerId === event.pointerId);
      const drag = graph ? funnelDragState.get(graph) : null;
      if (!drag) return;
      drag.viewport.scrollLeft = drag.left - (event.clientX - drag.x);
      drag.viewport.scrollTop = drag.top - (event.clientY - drag.y);
    });
    document.addEventListener("pointerup", (event) => {
      document.querySelectorAll(".environment-object-funnel-graph").forEach((graph) => {
        const drag = funnelDragState.get(graph);
        if (drag?.pointerId === event.pointerId) funnelDragState.delete(graph);
      });
    });
    window.addEventListener("resize", () => scheduleAllFunnelDraws());
  }

  function mount(root = document) {
    bindGraphFocus();
    bindFunnelFocus();
    const mountRoot = root || document;
    scheduleAllFunnelDraws(mountRoot);
    if (document.fonts?.ready) document.fonts.ready.then(() => scheduleAllFunnelDraws(mountRoot));
  }

  function render({ rows, groups, variant = "funnel" }) {
    bindGraphFocus();
    bindFunnelFocus();
    const objectGroups = utils.list(groups).length ? utils.list(groups).map((group) => normalizeGroup(group)) : fallbackGroupsFromRows(rows);
    const renderObjectGraph = variant === "legacy" ? renderLegacyGraph : renderFunnelGraph;
    return `
      <section class="semantic-panel environment-mapping-section environment-object-graph-section">
        <div class="environment-object-graph-list">
          ${objectGroups.length ? objectGroups.map(renderObjectGraph).join("") : `<div class="reference-empty">暂无环境映射</div>`}
        </div>
      </section>
    `;
  }

  components.EnvironmentScopeServiceMatrix = { render, mount };
})();
