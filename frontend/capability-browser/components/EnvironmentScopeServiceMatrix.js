(function () {
  const components = (window.sapdComponents = window.sapdComponents || {});
  const utils = components.utils;
  const display = window.sapdDisplay || {};
  const ROW_HEIGHT = 48;
  const NODE_CENTER_Y = 24;
  const CONNECTOR_WIDTH = 150;

  function technicalChipClass(kind) {
    if (display.chipClass) return display.chipClass(kind);
    if (kind.includes("服务")) return "technical-chip service-chip";
    if (kind.includes("模块")) return "technical-chip module-chip";
    if (kind.includes("措施")) return "technical-chip measure-chip";
    if (kind.includes("安全系统")) return "system-chip";
    if (kind.includes("产品")) return "environment-chip";
    return "note-chip";
  }

  function annotationAttrs(value) {
    return display.annotationValueAttrs?.(utils, value) || "";
  }

  function relationNodeKey(item) {
    return [item?.id, item?.code, item?.title, item?.name, item?.objectKind, item?.type].filter(Boolean).join("::");
  }

  function serviceKey(item) {
    return item?.code || item?.id || item?.title || item?.name || "";
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
      const scopeRows = utils.list(row.scopes).length ? utils.list(row.scopes) : [row.scope];
      group.segments = uniqueBy([...group.segments, ...utils.list(row.segments)], (segment) => segment.id || segment.code || segment.title);
      group.scopes = uniqueBy([...group.scopes, ...scopeRows], (scope) => scope?.code || scope?.id || scope?.title);
      group.services = uniqueBy([...group.services, ...utils.list(row.services)], serviceKey);
      const serviceScopes = serviceScopesByGroup.get(objectKey);
      for (const service of utils.list(row.services)) {
        const currentServiceKey = serviceKey(service);
        if (!serviceScopes.has(currentServiceKey)) serviceScopes.set(currentServiceKey, []);
        for (const scope of scopeRows) addUnique(serviceScopes.get(currentServiceKey), scope, (item) => item?.code || item?.id || item?.title);
      }
      const nodes = utils.list(row.relationNodes).length ? utils.list(row.relationNodes) : [...utils.list(row.modules), ...utils.list(row.measures)];
      group.modules = uniqueBy([...group.modules, ...nodes], relationNodeKey);
      for (const service of utils.list(row.services)) {
        for (const module of nodes) {
          const edge = {
            edgeKey: `${serviceKey(service)}::${relationNodeKey(module)}`,
            serviceKey: serviceKey(service),
            moduleKey: relationNodeKey(module),
            service,
            module,
          };
          if (!group.edges.some((item) => item.edgeKey === edge.edgeKey)) group.edges.push(edge);
        }
      }
    }
    return [...groups.values()].map((group) => {
      const serviceCounts = new Map();
      const moduleCounts = new Map();
      for (const edge of group.edges) {
        serviceCounts.set(edge.serviceKey, (serviceCounts.get(edge.serviceKey) || 0) + 1);
        moduleCounts.set(edge.moduleKey, (moduleCounts.get(edge.moduleKey) || 0) + 1);
      }
      const defaultFocusServiceKey = [...serviceCounts.entries()].sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0], "zh-Hans-CN"))[0]?.[0] || "";
      return {
        ...group,
        defaultFocusServiceKey,
        services: group.services.map((service) => {
          const key = serviceKey(service);
          const count = serviceCounts.get(key) || 0;
          return { ...service, scopes: serviceScopesByGroup.get(group.objectKey)?.get(key) || [], relationCount: count, relationType: count > 1 ? "1:N" : "1:1", isDefaultFocus: key === defaultFocusServiceKey };
        }),
        modules: group.modules.map((module) => {
          const key = relationNodeKey(module);
          const count = moduleCounts.get(key) || 0;
          return { ...module, relationCount: count, relationType: count > 1 ? "N:1" : "1:1" };
        }),
        oneToManyCount: [...serviceCounts.values()].filter((count) => count > 1).length,
        manyToOneCount: [...moduleCounts.values()].filter((count) => count > 1).length,
      };
    });
  }

  function scopeChips(scopes) {
    const rows = utils.list(scopes).filter(Boolean);
    if (!rows.length) return `<span class="empty-inline">暂无映射</span>`;
    const value = rows.map((scope) => utils.codeTitleOf(scope)).filter(Boolean).join("\n");
    return `<div class="environment-workbench-scope-chips"${annotationAttrs(value)}>${rows
      .map((scope) => `<span class="environment-workbench-scope-chip">${utils.escapeHtml(utils.codeTitleOf(scope))}</span>`)
      .join("")}</div>`;
  }

  function segmentChips(segments) {
    const rows = utils.list(segments).filter(Boolean);
    if (!rows.length) return `<span class="empty-inline">未定义环境子类</span>`;
    return `<div class="environment-workbench-segment-chips">${rows.map((segment) => `<span>${utils.escapeHtml(utils.codeTitleOf(segment))}</span>`).join("")}</div>`;
  }

  function smallScopeBadges(scopes) {
    const rows = utils.list(scopes).filter(Boolean);
    if (!rows.length) return "";
    return `<div class="environment-workbench-service-scopes">${rows.map((scope) => `<span>${utils.escapeHtml(scope.code || utils.codeTitleOf(scope))}</span>`).join("")}</div>`;
  }

  function relationPill(value) {
    if (!value || value === "1:1") return "";
    return `<span class="environment-workbench-relation-pill">${utils.escapeHtml(value)}</span>`;
  }

  function metric(label, value) {
    return `<span><b>${utils.escapeHtml(String(value))}</b>${utils.escapeHtml(label)}</span>`;
  }

  function renderObjectSummary(group) {
    const object = group.object || {};
    return `
      <aside class="environment-workbench-context">
        <div class="environment-workbench-object-kicker">信息化对象</div>
        <h4>${utils.escapeHtml(group.objectTitle || object.title || "未命名对象")}</h4>
        ${segmentChips(group.segments)}
        <div class="environment-workbench-context-block">
          <span class="environment-workbench-label">作用域</span>
          ${scopeChips(group.scopes)}
        </div>
        <div class="environment-workbench-metrics">
          ${metric("作用域", utils.list(group.scopes).length)}
          ${metric("服务", utils.list(group.services).length)}
          ${metric("模块/措施", utils.list(group.modules).length)}
          ${metric("关系", utils.list(group.edges).length)}
        </div>
      </aside>
    `;
  }

  function renderServiceNode(service, index, defaultFocusServiceKey) {
    const key = serviceKey(service);
    const isDefault = key && key === defaultFocusServiceKey;
    return `
      <button
        type="button"
        class="environment-workbench-node environment-workbench-service-node ${isDefault ? "is-default-focus" : ""}"
        style="grid-row:${index + 1};"
        data-relation-service-key="${utils.escapeHtml(key)}"
      >
        ${smallScopeBadges(service.scopes)}
        <span class="environment-workbench-node-main">
          <span class="relation-chip ${technicalChipClass("安全技术服务")} environment-service-anchor-chip">
            <span class="relation-chip-text">${utils.escapeHtml(utils.codeTitleOf(service))}</span>
          </span>
          ${relationPill(service.relationType)}
        </span>
      </button>
    `;
  }

  function moduleMeta(module) {
    const systems = utils.list(module.securitySystems || module.systems);
    const products = utils.list(module.products);
    const rows = [
      systems.length ? `<span>系统 ${systems.length}</span>` : "",
      products.length ? `<span>产品 ${products.length}</span>` : "",
    ].filter(Boolean);
    return rows.length ? `<div class="environment-workbench-module-meta">${rows.join("")}</div>` : "";
  }

  function renderModuleNode(module, index, activeModuleKeys) {
    const key = relationNodeKey(module);
    const kind = relationNodeKind(module);
    const isDefault = activeModuleKeys.has(key);
    return `
      <button
        type="button"
        class="environment-workbench-node environment-workbench-module-node ${isDefault ? "is-default-focus" : ""}"
        style="grid-row:${index + 1};"
        data-relation-module-key="${utils.escapeHtml(key)}"
      >
        <span class="environment-workbench-node-main">
          <span class="relation-chip ${technicalChipClass(kind)} environment-relation-target-chip">
            <em>${utils.escapeHtml(kind)}</em>
            <span class="relation-chip-text">${utils.escapeHtml(utils.codeTitleOf(module))}</span>
          </span>
          ${relationPill(module.relationType)}
        </span>
        <span class="environment-workbench-link-count">关联 ${utils.escapeHtml(String(module.relationCount || 0))} 项服务</span>
        ${moduleMeta(module)}
      </button>
    `;
  }

  function renderModuleGroups(modules, moduleIndex, activeModuleKeys) {
    const rows = utils.list(modules);
    if (!rows.length) return `<span class="empty-inline">暂无映射</span>`;
    return rows.map((module, index) => renderModuleNode(module, moduleIndex.get(relationNodeKey(module)) ?? index, activeModuleKeys)).join("");
  }

  function renderConnectorLayer(group, serviceIndex, moduleIndex, maxRows, defaultFocusServiceKey) {
    const height = Math.max(maxRows, 1) * ROW_HEIGHT;
    const paths = utils
      .list(group.edges)
      .map((edge) => {
        const leftIndex = serviceIndex.get(edge.serviceKey);
        const rightIndex = moduleIndex.get(edge.moduleKey);
        if (!Number.isFinite(leftIndex) || !Number.isFinite(rightIndex)) return "";
        const y1 = NODE_CENTER_Y + leftIndex * ROW_HEIGHT;
        const y2 = NODE_CENTER_Y + rightIndex * ROW_HEIGHT;
        const isDefault = defaultFocusServiceKey && edge.serviceKey === defaultFocusServiceKey;
        return `<path class="${isDefault ? "is-default-focus" : ""}" data-edge-service-key="${utils.escapeHtml(edge.serviceKey)}" data-edge-module-key="${utils.escapeHtml(edge.moduleKey)}" d="M1 ${y1} C42 ${y1} 108 ${y2} ${CONNECTOR_WIDTH - 1} ${y2}"></path>`;
      })
      .join("");
    return `
      <svg class="environment-workbench-connector-layer" viewBox="0 0 ${CONNECTOR_WIDTH} ${height}" style="height:${height}px;" aria-hidden="true" focusable="false">
        ${paths}
      </svg>
    `;
  }

  function defaultFocusServiceKey(group) {
    if (group.defaultFocusServiceKey) return group.defaultFocusServiceKey;
    return utils
      .list(group.services)
      .slice()
      .sort((left, right) => Number(right.relationCount || 0) - Number(left.relationCount || 0) || serviceKey(left).localeCompare(serviceKey(right), "zh-Hans-CN"))[0]
      ? serviceKey(
          utils
            .list(group.services)
            .slice()
            .sort((left, right) => Number(right.relationCount || 0) - Number(left.relationCount || 0) || serviceKey(left).localeCompare(serviceKey(right), "zh-Hans-CN"))[0],
        )
      : "";
  }

  function renderRelationWorkbench(group) {
    const services = utils.list(group.services);
    const modules = utils.list(group.modules);
    const serviceIndex = new Map(services.map((service, index) => [serviceKey(service), index]));
    const moduleIndex = new Map(modules.map((module, index) => [relationNodeKey(module), index]));
    const defaultService = defaultFocusServiceKey(group);
    const activeModuleKeys = new Set(utils.list(group.edges).filter((edge) => edge.serviceKey === defaultService).map((edge) => edge.moduleKey));
    const maxRows = Math.max(services.length, modules.length, 1);
    return `
      <div class="environment-workbench-relation-panel" style="--relation-row-count:${maxRows};" data-default-service-key="${utils.escapeHtml(defaultService)}">
        <div class="environment-workbench-column-head">安全技术服务</div>
        <div class="environment-workbench-column-head environment-workbench-connector-title">映射</div>
        <div class="environment-workbench-column-head">安全技术模块</div>
        <div class="environment-workbench-service-list">
          ${services.length ? services.map((service, index) => renderServiceNode(service, index, defaultService)).join("") : `<span class="empty-inline">无适用服务</span>`}
        </div>
        <div class="environment-workbench-connector-cell">
          ${renderConnectorLayer(group, serviceIndex, moduleIndex, maxRows, defaultService)}
        </div>
        <div class="environment-workbench-module-list">
          ${renderModuleGroups(modules, moduleIndex, activeModuleKeys)}
        </div>
      </div>
    `;
  }

  function renderGroup(group) {
    return `
      <article class="environment-object-workbench" data-environment-object-key="${utils.escapeHtml(group.objectKey || group.id || "")}">
        ${renderObjectSummary(group)}
        ${renderRelationWorkbench(group)}
      </article>
    `;
  }

  function clearDynamicFocus(workbench) {
    workbench.classList.remove("is-live-focus", "is-locked-focus");
    workbench.querySelectorAll(".is-active, .is-muted").forEach((item) => item.classList.remove("is-active", "is-muted"));
  }

  function applyRelationFocus(workbench, kind, key, locked = false) {
    clearDynamicFocus(workbench);
    if (!kind || !key) return;
    workbench.classList.add("is-live-focus");
    if (locked) workbench.classList.add("is-locked-focus");
    const serviceKeys = new Set();
    const moduleKeys = new Set();
    workbench.querySelectorAll(".environment-workbench-connector-layer path").forEach((edge) => {
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
    workbench.querySelectorAll("[data-relation-service-key]").forEach((node) => {
      const nodeKey = node.getAttribute("data-relation-service-key");
      if (serviceKeys.has(nodeKey) || (kind === "service" && nodeKey === key)) node.classList.add("is-active");
      else node.classList.add("is-muted");
    });
    workbench.querySelectorAll("[data-relation-module-key]").forEach((node) => {
      const nodeKey = node.getAttribute("data-relation-module-key");
      if (moduleKeys.has(nodeKey) || (kind === "module" && nodeKey === key)) node.classList.add("is-active");
      else node.classList.add("is-muted");
    });
  }

  function lockedFocus(workbench) {
    const kind = workbench.dataset.lockedFocusKind || "";
    const key = workbench.dataset.lockedFocusKey || "";
    if (kind && key) applyRelationFocus(workbench, kind, key, true);
    else clearDynamicFocus(workbench);
  }

  function bindRelationFocus() {
    if (window.__sapdEnvironmentRelationWorkbenchBound || typeof document === "undefined" || !document?.addEventListener) return;
    window.__sapdEnvironmentRelationWorkbenchBound = true;
    document.addEventListener("mouseover", (event) => {
      const node = event.target.closest?.("[data-relation-service-key], [data-relation-module-key]");
      const workbench = node?.closest?.(".environment-object-workbench");
      if (!node || !workbench) return;
      const serviceKeyValue = node.getAttribute("data-relation-service-key");
      const moduleKeyValue = node.getAttribute("data-relation-module-key");
      applyRelationFocus(workbench, serviceKeyValue ? "service" : "module", serviceKeyValue || moduleKeyValue, false);
    });
    document.addEventListener("mouseout", (event) => {
      const workbench = event.target.closest?.(".environment-object-workbench");
      if (!workbench || workbench.contains(event.relatedTarget)) return;
      lockedFocus(workbench);
    });
    document.addEventListener("click", (event) => {
      const node = event.target.closest?.("[data-relation-service-key], [data-relation-module-key]");
      const workbench = event.target.closest?.(".environment-object-workbench");
      if (!workbench) return;
      if (!node) {
        delete workbench.dataset.lockedFocusKind;
        delete workbench.dataset.lockedFocusKey;
        clearDynamicFocus(workbench);
        return;
      }
      const serviceKeyValue = node.getAttribute("data-relation-service-key");
      const moduleKeyValue = node.getAttribute("data-relation-module-key");
      workbench.dataset.lockedFocusKind = serviceKeyValue ? "service" : "module";
      workbench.dataset.lockedFocusKey = serviceKeyValue || moduleKeyValue;
      applyRelationFocus(workbench, workbench.dataset.lockedFocusKind, workbench.dataset.lockedFocusKey, true);
    });
  }

  function render({ rows, groups, grouped = false }) {
    bindRelationFocus();
    const objectGroups = utils.list(groups).length ? utils.list(groups) : fallbackGroupsFromRows(rows);
    const uniqueServices = new Set(objectGroups.flatMap((group) => utils.list(group.services).map(serviceKey)).filter(Boolean)).size;
    const uniqueModules = new Set(objectGroups.flatMap((group) => utils.list(group.modules).map(relationNodeKey)).filter(Boolean)).size;
    const oneToManyCount = objectGroups.reduce((sum, group) => sum + Number(group.oneToManyCount || 0), 0);
    return `
      <section class="semantic-panel environment-mapping-section environment-workbench-section">
        <div class="matrix-section-head">
          <div>
            <h3>${grouped ? "环境视角归纳表" : "环境视角映射表"}</h3>
            <p>单对象关系工作台；默认弱线总览，hover 或 click 聚焦服务与模块关系。</p>
          </div>
          <span>${utils.escapeHtml(`${objectGroups.length} 个对象 · ${uniqueServices} 项服务 · ${uniqueModules} 个模块 · ${oneToManyCount} 个 1:N`)}</span>
        </div>
        <div class="environment-workbench-list">
          ${objectGroups.length ? objectGroups.map(renderGroup).join("") : `<div class="reference-empty">暂无环境映射</div>`}
        </div>
      </section>
    `;
  }

  components.EnvironmentScopeServiceMatrix = { render };
})();
