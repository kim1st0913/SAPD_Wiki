const state = {
  capability: null,
  management: null,
  lifecycle: null,
  content: null,
  activeView: "overview",
  activeMaintenancePage: "scopes",
  activeContentPage: "html",
  selectedCapabilityId: null,
  selectedEnvironmentObjectId: null,
  selectedDevProcessId: null,
  selectedDataProcessId: null,
  selectedMaintenanceId: null,
  selectedContentId: null,
  search: "",
  maintenanceFilters: {},
  maintenanceColumnWidths: [150, 150, 240, 280, 220],
  relationshipFilters: {},
  relationshipColumnWidths: [190, 180, 150, 160, 160, 150, 130, 160],
};

const $ = (id) => document.getElementById(id);
const list = (value) => (Array.isArray(value) ? value : []);
const text = (value) => (value == null ? "" : String(value));
const escapeHtml = (value) =>
  text(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

const titleOf = (value, fallback = "未命名") => {
  if (!value) return fallback;
  if (typeof value === "object") return text(value.title || value.name || value.code || value.id || fallback);
  return text(value);
};

const codeTitle = (value, fallback = "未命名") => [value?.code, titleOf(value, fallback)].filter(Boolean).join(" ");
const matchesSearch = (...values) => values.map(text).join(" ").toLowerCase().includes(state.search.toLowerCase());

function setHtml(id, html) {
  const element = $(id);
  if (element) element.innerHTML = html;
}

function setText(id, value) {
  const element = $(id);
  if (element) element.textContent = text(value);
}

function emptyState(title, body = "等待数据导出或选择左侧对象") {
  return `<div class="detail-empty"><strong>${escapeHtml(title)}</strong><span>${escapeHtml(body)}</span></div>`;
}

function pillList(items, empty = "暂无") {
  const rows = list(items).filter(Boolean);
  if (!rows.length) return `<span class="empty-inline">${escapeHtml(empty)}</span>`;
  return rows.map((item) => `<span class="stakeholder-pill">${escapeHtml(titleOf(item))}</span>`).join("");
}

function scopeGroup(scope) {
  const group = text(scope?.scenario || scope?.category).trim();
  return group && group !== "未分类" ? group : "网络空间";
}

function maintenanceTableColumns() {
  const baseColumns = [
    { key: "group", label: "分组" },
    { key: "code", label: "编码/类型" },
    { key: "title", label: "名称" },
    { key: "description", label: "描述" },
  ];
  if (["processes", "work-functions", "modules"].includes(state.activeMaintenancePage)) {
    return [...baseColumns, { key: "relation", label: "关联结果" }];
  }
  return baseColumns;
}

function maintenanceColumnTemplate() {
  const widths = state.maintenanceColumnWidths;
  return maintenanceTableColumns().map((_, index) => `${Math.max(90, widths[index] || 160)}px`).join(" ");
}

function maintenanceCellValue(row, key) {
  if (key === "code") return row.code || row.type;
  if (key === "description") return row.description || "";
  if (key === "relation") return list(row.relations).slice(0, 2).join("；") || "暂无关联";
  return row[key] || "";
}

function relationshipMatrixColumns() {
  return [
    { key: "focus", label: "能力关注点" },
    { key: "services", label: "安全技术服务" },
    { key: "scopes", label: "作用域" },
    { key: "processGroups", label: "L2流程组" },
    { key: "processReferences", label: "L3流程" },
    { key: "activities", label: "L4关键活动" },
    { key: "stakeholders", label: "职能层" },
    { key: "modules", label: "技术模块" },
  ];
}

function relationshipCellValue(row, key) {
  if (key === "focus") return [row.focus?.code, row.focus?.title, row.focus?.description].filter(Boolean).join(" ");
  if (key === "activities") return row.activities.length ? row.activities.map(titleOf).join("；") : row.hasMissingActivity ? "待补充" : "";
  if (key === "stakeholders") return row.stakeholders.map((stakeholder) => stakeholder.layer || titleOf(stakeholder)).join("；");
  return list(row[key]).map(titleOf).join("；");
}

function filterRelationshipRows(rows) {
  const filters = state.relationshipFilters || {};
  return rows.filter((row) =>
    relationshipMatrixColumns().every((column) => {
      const filter = text(filters[column.key]).trim().toLowerCase();
      if (!filter) return true;
      return relationshipCellValue(row, column.key).toLowerCase().includes(filter);
    }),
  );
}

function filterMaintenanceRows(rows) {
  const filters = state.maintenanceFilters || {};
  return rows.filter((row) =>
    maintenanceTableColumns().every((column) => {
      const filter = text(filters[column.key]).trim().toLowerCase();
      if (!filter) return true;
      return maintenanceCellValue(row, column.key).toLowerCase().includes(filter);
    }),
  );
}

function flattenCapabilities() {
  const rows = [];
  for (const category of list(state.capability?.categories)) {
    rows.push({ level: "分类", item: category });
    for (const domain of list(category.domains)) {
      rows.push({ level: "L1", item: domain });
      for (const capability of list(domain.capabilities)) {
        rows.push({ level: "L2", item: capability });
        for (const focus of list(capability.focuses)) rows.push({ level: "关注点", item: focus });
      }
    }
  }
  return rows;
}

function focusRows() {
  return flattenCapabilities().filter((row) => row.item.type === "capability_focus");
}

function uniqueBy(items, keyFn) {
  const seen = new Set();
  return list(items).filter((item) => {
    const key = keyFn(item);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function compactChips(items, empty = "暂无", limit = 3) {
  const rows = uniqueBy(list(items).filter(Boolean), (item) => (typeof item === "string" ? item : item.id || item.code || item.title || item.name));
  if (!rows.length) return `<span class="empty-inline">${escapeHtml(empty)}</span>`;
  const visible = rows.slice(0, limit);
  const more = rows.length - visible.length;
  return `${visible.map((item) => `<span class="relation-chip">${escapeHtml(titleOf(item))}</span>`).join("")}${more > 0 ? `<span class="relation-chip muted">+${more}</span>` : ""}`;
}

function serviceModuleIndex(service) {
  return list(state.management?.service_module_index).find((entry) => {
    const entryService = entry.service || {};
    return (service?.id && entryService.id === service.id) || (service?.code && entryService.code === service.code) || (service?.title && entryService.title === service.title);
  });
}

function modulesForServices(services) {
  return uniqueBy(
    list(services).flatMap((service) => list(serviceModuleIndex(service)?.modules)),
    (module) => module.id || module.code || module.title,
  );
}

function systemsProductsForServices(services) {
  return uniqueBy(
    list(services).flatMap((service) => {
      const entry = serviceModuleIndex(service) || {};
      return [...list(entry.systems), ...list(entry.products)];
    }),
    (item) => item.id || item.code || item.title || item.name,
  );
}

function stakeholdersFromMappings(processMappings) {
  return uniqueBy(
    list(processMappings).flatMap((mapping) =>
      Object.entries(mapping.stakeholders || {}).flatMap(([layer, stakeholders]) => list(stakeholders).map((stakeholder) => ({ ...stakeholder, layer }))),
    ),
    (stakeholder) => `${stakeholder.layer}:${stakeholder.id || stakeholder.code || stakeholder.title}`,
  );
}

function findCapabilityItemAndFocuses(targetId) {
  let selected = null;
  let focuses = [];
  const collectCapabilityFocuses = (capability) => list(capability.focuses);
  const collectDomainFocuses = (domain) => list(domain.capabilities).flatMap(collectCapabilityFocuses);
  const collectCategoryFocuses = (category) => list(category.domains).flatMap(collectDomainFocuses);
  for (const category of list(state.capability?.categories)) {
    if (category.id === targetId) {
      selected = category;
      focuses = collectCategoryFocuses(category);
      break;
    }
    for (const domain of list(category.domains)) {
      if (domain.id === targetId) {
        selected = domain;
        focuses = collectDomainFocuses(domain);
        break;
      }
      for (const capability of list(domain.capabilities)) {
        if (capability.id === targetId) {
          selected = capability;
          focuses = collectCapabilityFocuses(capability);
          break;
        }
        const focus = list(capability.focuses).find((item) => item.id === targetId);
        if (focus) {
          selected = focus;
          focuses = [focus];
          break;
        }
      }
      if (selected) break;
    }
    if (selected) break;
  }
  return { selected, focuses: focuses.length ? focuses : focusRows().map((row) => row.item) };
}

function capabilityPathForFocus(focusId) {
  for (const category of list(state.capability?.categories)) {
    for (const domain of list(category.domains)) {
      for (const capability of list(domain.capabilities)) {
        const focus = list(capability.focuses).find((item) => item.id === focusId);
        if (focus) return { category, domain, capability, focus };
      }
    }
  }
  return {};
}

function laneItems(items, empty = "暂无") {
  const rows = list(items).filter(Boolean);
  if (!rows.length) return `<div class="path-item muted">${escapeHtml(empty)}</div>`;
  return rows
    .slice(0, 6)
    .map((item) => `<div class="path-item"><strong>${escapeHtml(item.code || item.layer || "")}</strong><span>${escapeHtml(titleOf(item))}</span></div>`)
    .join("");
}

function renderCapabilityPathMap(row) {
  if (!row) return emptyState("暂无能力链路");
  const path = capabilityPathForFocus(row.focus.id);
  const layerItems = uniqueBy(
    row.stakeholders.map((stakeholder) => ({ layer: stakeholder.layer, title: `${stakeholder.layer}：${stakeholder.title || stakeholder.name || "未命名职能"}` })),
    (item) => item.title,
  );
  const workItems = row.activities.length
    ? row.activities
    : row.hasMissingActivity
      ? [{ title: "L4关键活动：待补充" }]
      : [];
  const lanes = [
    { label: "1. 能力分类", tone: "blue", items: [path.category] },
    { label: "2. 单一能力", tone: "navy", items: [path.capability] },
    { label: "3. 关注点", tone: "purple", items: [row.focus] },
    { label: "4. 对应的技术服务", tone: "green", items: row.services },
    { label: "5. 对应的管理职能", tone: "orange", items: layerItems },
    { label: "6. 管理工作", tone: "teal", items: workItems },
    { label: "7. 管理流程", tone: "indigo", items: row.processReferences },
  ];
  return `
    <section class="capability-path-map">
      <div class="matrix-section-head">
        <div>
          <h3>安全能力维度映射图</h3>
          <p>从能力分类、关注点到技术服务、管理职能、管理工作和管理流程的全链路映射</p>
        </div>
      </div>
      <div class="path-lanes">
        ${lanes
          .map(
            (lane, index) => `
              <section class="path-lane ${lane.tone}">
                <h4>${escapeHtml(lane.label)}</h4>
                <div class="path-item-list">${laneItems(lane.items)}</div>
              </section>
              ${index < lanes.length - 1 ? '<div class="path-arrow">→</div>' : ""}
            `,
          )
          .join("")}
      </div>
    </section>
  `;
}

function capabilityRelationRows(selectedId) {
  const { focuses } = findCapabilityItemAndFocuses(selectedId);
  return focuses.map((focus) => {
    const services = uniqueBy(focus.services, (service) => service.id || service.code || service.title);
    const scopes = uniqueBy([...list(focus.scope_mappings).map((mapping) => mapping.scope), ...services.flatMap((service) => list(service.scopes))], (scope) => scope?.id || scope?.code || scope?.title);
    const processMappings = list(focus.process_mappings);
    return {
      focus,
      services,
      scopes,
      processGroups: uniqueBy(processMappings.map((mapping) => mapping.process_group), (item) => item?.id || item?.title),
      processReferences: uniqueBy(processMappings.map((mapping) => mapping.process_reference), (item) => item?.id || item?.title),
      activities: processMappings.flatMap((mapping) => list(mapping.activities)),
      hasMissingActivity: processMappings.some((mapping) => mapping.missing_activity || mapping.activity_status === "missing"),
      stakeholders: stakeholdersFromMappings(processMappings),
      modules: modulesForServices(services),
      systemsProducts: systemsProductsForServices(services),
      processMappings,
    };
  });
}

function renderEnvironmentPathMap(selected) {
  if (!selected) return "";
  const scopeMappings = list(selected.object.scope_mappings);
  const scopes = uniqueBy(scopeMappings.map((mapping) => mapping.scope), (scope) => scope?.id || scope?.code || scope?.title);
  const services = uniqueBy(scopeMappings.flatMap((mapping) => list(mapping.services)), (service) => service.id || service.code || service.title);
  const modules = uniqueBy(services.flatMap((service) => list(service.modules)), (module) => module.id || module.code || module.title);
  const systemsProducts = uniqueBy(
    modules.flatMap((module) => [...list(module.systems), ...list(module.products)]),
    (item) => item.id || item.code || item.title || item.name,
  );
  const lanes = [
    { label: "1. 信息化环境", tone: "blue", items: [selected.environment] },
    { label: "2. 信息化对象", tone: "teal", items: [selected.object] },
    { label: "3. 安全作用域", tone: "green", items: scopes },
    { label: "4. 安全技术服务", tone: "amber", items: services },
    { label: "5. 安全技术模块/措施", tone: "orange", items: modules },
    { label: "6. 安全系统/产品", tone: "purple", items: systemsProducts },
  ];
  return `
    <section class="capability-path-map environment-path-map">
      <div class="matrix-section-head">
        <div>
          <h3>信息化环境关联映射图</h3>
          <p>从环境到对象、作用域、技术服务、模块/措施、系统/产品的纵向映射</p>
        </div>
      </div>
      <div class="path-lanes environment-lanes">
        ${lanes
          .map(
            (lane, index) => `
              <section class="path-lane ${lane.tone}">
                <h4>${escapeHtml(lane.label)}</h4>
                <div class="path-item-list">${laneItems(lane.items)}</div>
              </section>
              ${index < lanes.length - 1 ? '<div class="path-arrow">→</div>' : ""}
            `,
          )
          .join("")}
      </div>
    </section>
  `;
}

function environmentRows() {
  return list(state.management?.environment_scope_tree).flatMap((environment) =>
    list(environment.objects).map((object) => ({
      environment,
      object,
      id: object.id || `${environment.title}:${object.title}`,
      searchText: [
        environment.title,
        object.title,
        object.environment_segment,
        ...list(object.scope_mappings).map((mapping) => titleOf(mapping.scope)),
        ...list(object.scope_mappings).flatMap((mapping) => list(mapping.services).map(titleOf)),
      ].join(" "),
    })),
  );
}

function maintenanceRows() {
  const page = state.activeMaintenancePage;
  if (page === "scopes") {
    return list(state.management?.scope_types).map((scope) => ({
      id: scope.id,
      type: "作用域",
      code: scope.code,
      title: scope.title,
      group: scopeGroup(scope),
      description: scope.description,
      sources: scope.sources,
      relations: [
        ...list(scope.services).map((service) => `服务：${titleOf(service)}`),
        ...list(scope.information_objects).map((object) => `对象：${titleOf(object)}`),
      ],
    }));
  }
  if (page === "processes") {
    return list(state.management?.security_processes).flatMap((domain) =>
      list(domain.groups).flatMap((group) =>
        list(group.references).map((reference) => ({
          id: reference.id,
          type: "流程",
          code: reference.capability_focus_code || reference.code,
          title: reference.title,
          group: group.title,
          layer: [domain.code, domain.title].filter(Boolean).join(" "),
          description: reference.description,
          sources: reference.sources,
          relations: list(reference.stakeholders).map((stakeholder) => `职能：${titleOf(stakeholder)}`),
        })),
      ),
    );
  }
  if (page === "work-functions") {
    return list(state.management?.work_function_layers).flatMap((layer) =>
      list(layer.groups).flatMap((group) =>
        list(group.functions).map((fn) => ({
          id: fn.id,
          type: "职能",
          code: fn.code,
          title: fn.title,
          group: group.title,
          layer: layer.title,
          description: fn.description,
          sources: fn.sources,
          relations: [...list(fn.tasks).map((task) => `任务：${titleOf(task)}`), ...list(fn.gbt_42446_refs).map((ref) => `GB/T：${titleOf(ref)}`)],
        })),
      ),
    );
  }
  if (page === "modules") {
    return list(state.management?.security_technology_modules).map((module) => ({
      id: module.id,
      type: "技术模块",
      code: module.code,
      title: module.title,
      group: module.category || "未分类",
      description: module.description,
      sources: module.sources,
      relations: [
        ...list(module.systems).map((system) => `系统：${titleOf(system)}`),
        ...list(module.services).map((service) => `服务：${titleOf(service)}`),
        ...list(module.products).map((product) => `产品：${titleOf(product)}`),
        ...list(module.environments).map((environment) => `环境：${titleOf(environment)}`),
      ],
    }));
  }
  if (page === "standards") {
    return list(state.management?.gbt_42446_references).map((ref) => ({
      id: ref.id,
      type: "标准",
      title: ref.title,
      group: ref.category || "未分类",
      description: ref.description,
      sources: ref.sources,
      relations: [],
    }));
  }
  return list(state.management?.gartner_roles).map((role) => ({
    id: role.id,
    type: "岗位",
    title: role.title,
    group: role.category || "未分类",
    description: role.description,
    sources: role.sources,
    relations: [],
  }));
}

function lifecycleProcesses(kind) {
  if (kind === "dev") return list(state.lifecycle?.application_security_development?.processes);
  return list(state.lifecycle?.data_lifecycle?.processes);
}

function contentRows() {
  if (state.activeContentPage === "drawio") return list(state.content?.diagram_views);
  if (state.activeContentPage === "ppt") return list(state.content?.guide_pages);
  return list(state.content?.html_documents);
}

function renderMetrics() {
  const stats = state.capability?.stats || {};
  const lifecycleStats = state.lifecycle?.stats || {};
  const metrics = [
    ["能力", stats.capabilities || 0],
    ["关注点", stats.focuses || 0],
    ["服务", stats.services || 0],
    ["环境", state.management?.stats?.information_environments || 0],
    ["生命周期", (lifecycleStats.application_processes || 0) + (lifecycleStats.data_processes || 0)],
  ];
  setHtml("metrics", metrics.map(([label, value]) => `<div class="metric"><strong>${value}</strong><span>${label}</span></div>`).join(""));
}

function renderOverview() {
  const stats = {
    capability: state.capability?.stats || {},
    management: state.management?.stats || {},
    lifecycle: state.lifecycle?.stats || {},
    content: state.content?.stats || {},
  };
  setText("overviewGeneratedAt", state.capability?.generated_at || "已加载");
  setHtml(
    "overviewMap",
    `
      <div class="relation-map">
        ${["能力维度", "信息化环境维度", "安全开发维度", "数据生命周期维度", "专项知识维护", "说明与视图"]
          .map((item) => `<div class="relation-node">${escapeHtml(item)}</div>`)
          .join("")}
      </div>
    `,
  );
  setHtml(
    "overviewCoverage",
    `
      <table class="matrix-table">
        <tbody>
          <tr><th>能力关注点</th><td>${stats.capability.focuses || 0}</td><th>关注点-作用域</th><td>${stats.capability.focus_scope_mappings || 0}</td></tr>
          <tr><th>信息化对象</th><td>${stats.management.information_objects || 0}</td><th>对象-作用域</th><td>${stats.management.environment_scope_mappings || 0}</td></tr>
          <tr><th>LC-AP 阶段</th><td>${stats.lifecycle.application_processes || 0}</td><th>LC-DT 过程</th><td>${stats.lifecycle.data_processes || 0}</td></tr>
          <tr><th>Draw.io 图</th><td>${stats.content.diagram_views || 0}</td><th>PPT 页</th><td>${stats.content.guide_pages || 0}</td></tr>
        </tbody>
      </table>
    `,
  );
  setHtml(
    "overviewIssues",
    `
      <div class="issue-list">
        <div><strong>L4关键活动</strong><span>${stats.management.process_activity_missing || 0} 条待补充</span></div>
        <div><strong>内容视图</strong><span>HTML / Draw.io / PPT 已预留入口</span></div>
        <div><strong>前端策略</strong><span>关系、矩阵、树表优先</span></div>
      </div>
    `,
  );
}

function renderCapabilities() {
  const rows = flattenCapabilities().filter((row) => matchesSearch(row.level, row.item.code, row.item.title, row.item.description));
  if (!state.selectedCapabilityId) state.selectedCapabilityId = focusRows()[0]?.item.id || rows[0]?.item.id || null;
  const levelClass = { 分类: "tree-level-0", L1: "tree-level-1", L2: "tree-level-2", 关注点: "tree-level-3" };
  setHtml(
    "tree",
    rows
      .map(({ level, item }) => `
        <button class="tree-row tree-node-row ${levelClass[level] || ""} ${item.id === state.selectedCapabilityId ? "active" : ""}" type="button" data-capability-id="${escapeHtml(item.id)}">
          <span class="node-level-label">${escapeHtml(level)}</span>
          <span class="node-code">${escapeHtml(item.code || "")}</span>
          <span class="node-title">${escapeHtml(item.title || "未命名")}</span>
        </button>
      `)
      .join("") || emptyState("没有匹配的能力"),
  );
  const selected = rows.find((row) => row.item.id === state.selectedCapabilityId)?.item || focusRows()[0]?.item;
  if (!selected) {
    setHtml("detail", emptyState("暂无能力关系数据"));
    setHtml("services", emptyState("暂无对象详情"));
    setText("serviceCount", 0);
    return;
  }
  const matrixColumns = relationshipMatrixColumns();
  const matrixRows = filterRelationshipRows(
    capabilityRelationRows(selected.id).filter((row) =>
      matchesSearch(
        row.focus.code,
        row.focus.title,
        ...row.services.map(titleOf),
        ...row.scopes.map(titleOf),
        ...row.processGroups.map(titleOf),
        ...row.processReferences.map(titleOf),
        ...row.modules.map(titleOf),
      ),
    ),
  );
  const selectedFocusRow = matrixRows.find((row) => row.focus.id === selected.id) || matrixRows[0];
  const selectedDetail = selected.type === "capability_focus" ? selected : selectedFocusRow?.focus || selected;
  const detailServices = selectedDetail.type === "capability_focus" ? uniqueBy(selectedDetail.services, (service) => service.id || service.code || service.title) : [];
  const detailProcesses = selectedDetail.type === "capability_focus" ? list(selectedDetail.process_mappings) : [];
  const detailModules = selectedDetail.type === "capability_focus" ? modulesForServices(detailServices) : [];
  const chainFocus = selectedFocusRow || (selectedDetail.type === "capability_focus" ? capabilityRelationRows(selectedDetail.id)[0] : null);
  setText("selectedType", selectedDetail.type || selected.type || "能力对象");
  setHtml(
    "detail",
    `
      ${renderCapabilityPathMap(chainFocus)}
      <section class="relationship-matrix-section">
        <div class="matrix-section-head">
          <div>
            <h3>能力关系矩阵</h3>
            <p>能力关注点、服务、作用域、流程、职能层和技术模块的映射结果</p>
          </div>
          <span>${matrixRows.length} 条关注点</span>
        </div>
        <div class="relationship-matrix-scroll">
          <table class="relationship-matrix-table">
            <colgroup>
              ${matrixColumns.map((_, index) => `<col data-relation-column-index="${index}" style="width: ${Math.max(110, state.relationshipColumnWidths[index] || 150)}px" />`).join("")}
            </colgroup>
            <thead>
              <tr>
                ${matrixColumns
                  .map(
                    (column, index) => `
                      <th>
                        <span class="relationship-head-cell">
                          <strong>${escapeHtml(column.label)}</strong>
                          <input type="search" data-relation-filter="${escapeHtml(column.key)}" value="${escapeHtml(state.relationshipFilters[column.key] || "")}" placeholder="筛选" />
                          <i class="relationship-column-resizer" data-relation-column-index="${index}" aria-hidden="true"></i>
                        </span>
                      </th>
                    `,
                  )
                  .join("")}
              </tr>
            </thead>
            <tbody>
              ${
                matrixRows
                  .map(
                    (row) => `
                      <tr class="${row.focus.id === selectedDetail.id ? "active" : ""}" data-capability-id="${escapeHtml(row.focus.id)}">
                        <td>
                          <details class="focus-inline-detail">
                            <summary><strong>${escapeHtml(row.focus.code || "无编码")}</strong><span>${escapeHtml(row.focus.title || "未命名关注点")}</span></summary>
                            <p>${escapeHtml(row.focus.description || "暂无描述")}</p>
                          </details>
                        </td>
                        <td>${compactChips(row.services, "暂无服务")}</td>
                        <td>${compactChips(row.scopes, "暂无作用域")}</td>
                        <td>${compactChips(row.processGroups, "暂无流程组")}</td>
                        <td>${compactChips(row.processReferences, "暂无流程")}</td>
                        <td>${
                          row.activities.length
                            ? compactChips(row.activities, "暂无活动")
                            : row.hasMissingActivity
                              ? '<span class="missing-pill">待补充</span>'
                              : '<span class="empty-inline">暂无</span>'
                        }</td>
                        <td>${compactChips(row.stakeholders.map((stakeholder) => stakeholder.layer), "暂无职能层")}</td>
                        <td>${compactChips(row.modules, "暂无模块")}</td>
                      </tr>
                    `,
                  )
                  .join("") || '<tr><td colspan="8"><div class="reference-empty">暂无匹配关系</div></td></tr>'
              }
            </tbody>
          </table>
        </div>
      </section>
      <section class="relationship-chain-section">
        <div class="matrix-section-head">
          <div>
            <h3>关系链</h3>
            <p>按当前选中关注点展示服务、作用域、模块和系统/产品链路</p>
          </div>
        </div>
        ${
          chainFocus
            ? `
              <div class="relationship-chain">
                <div class="chain-node"><span>能力关注点</span><strong>${escapeHtml(chainFocus.focus.code || "无编码")}</strong><small>${escapeHtml(chainFocus.focus.title || "未命名")}</small></div>
                <div class="chain-arrow">→</div>
                <div class="chain-node"><span>安全技术服务</span><strong>${chainFocus.services.length}</strong><small>${escapeHtml(chainFocus.services.slice(0, 2).map(titleOf).join("、") || "暂无")}</small></div>
                <div class="chain-arrow">→</div>
                <div class="chain-node"><span>作用域</span><strong>${chainFocus.scopes.length}</strong><small>${escapeHtml(chainFocus.scopes.slice(0, 2).map(titleOf).join("、") || "暂无")}</small></div>
                <div class="chain-arrow">→</div>
                <div class="chain-node"><span>技术模块</span><strong>${chainFocus.modules.length}</strong><small>${escapeHtml(chainFocus.modules.slice(0, 2).map(titleOf).join("、") || "暂无")}</small></div>
                <div class="chain-arrow">→</div>
                <div class="chain-node"><span>系统/产品</span><strong>${chainFocus.systemsProducts.length}</strong><small>${escapeHtml(chainFocus.systemsProducts.slice(0, 2).map(titleOf).join("、") || "暂无")}</small></div>
              </div>
            `
            : emptyState("暂无关系链")
        }
      </section>
    `,
  );
  setText("serviceCount", detailServices.length);
  setHtml(
    "services",
    `
      <div class="detail-code">${escapeHtml(selectedDetail.code || "无编码")}</div>
      <h2 class="source-entity-title">${escapeHtml(selectedDetail.title || "未命名")}</h2>
      <p class="source-entity-desc">${escapeHtml(selectedDetail.description || "暂无描述")}</p>
      <h3 class="section-title">相关服务</h3>
      <div class="source-chip-row">${compactChips(detailServices, "暂无服务", 8)}</div>
      <h3 class="section-title">流程与职能层</h3>
      <div class="process-list">
        ${
          detailProcesses.length
            ? detailProcesses
                .map((mapping) => `
                  <article class="process-card compact">
                    <div class="process-head">
                      <span>L2流程组：${escapeHtml(titleOf(mapping.process_group, "未关联流程组"))}</span>
                      <strong>L3流程：${escapeHtml(titleOf(mapping.process_reference, "待补充"))}</strong>
                    </div>
                    <div class="l4-placeholder"><strong>L4关键活动</strong><span>${escapeHtml(mapping.activity_status_label || "待补充")}</span></div>
                    <div class="stakeholder-grid">${["决策层", "管理层", "执行层", "监督层"]
                      .map((layer) => `<div class="stakeholder-row"><strong>${layer}</strong><div>${pillList(mapping.stakeholders?.[layer])}</div></div>`)
                      .join("")}</div>
                  </article>
                `)
                .join("")
            : emptyState("暂无流程关系", "")
        }
      </div>
      <h3 class="section-title">技术模块</h3>
      <div class="source-chip-row">${compactChips(detailModules, "暂无模块", 8)}</div>
    `,
  );
}

function renderEnvironment() {
  const rows = environmentRows().filter((row) => matchesSearch(row.searchText));
  if (!state.selectedEnvironmentObjectId) state.selectedEnvironmentObjectId = rows[0]?.id || null;
  setText("environmentCount", rows.length);
  const grouped = rows.reduce((groups, row) => {
    const key = row.environment.title || "未分组环境";
    groups[key] = groups[key] || [];
    groups[key].push(row);
    return groups;
  }, {});
  setHtml(
    "environmentTree",
    Object.entries(grouped)
      .map(([environment, objectRows]) => `
        <section class="environment-group">
          <div class="environment-group-head"><strong>${escapeHtml(environment)}</strong><span>${objectRows.length}</span></div>
          <div class="environment-object-list">
            ${objectRows
              .map((row) => `<button class="environment-object-row ${row.id === state.selectedEnvironmentObjectId ? "active" : ""}" type="button" data-environment-object-id="${escapeHtml(row.id)}"><strong>${escapeHtml(row.object.title || "未命名对象")}</strong><span>${escapeHtml(list(row.object.scope_mappings).map((mapping) => titleOf(mapping.scope)).join("、") || "暂无作用域")}</span></button>`)
              .join("")}
          </div>
        </section>
      `)
      .join("") || emptyState("暂无信息化对象"),
  );
  const selected = rows.find((row) => row.id === state.selectedEnvironmentObjectId) || rows[0];
  if (!selected) {
    setHtml("environmentDetail", emptyState("请选择信息化对象"));
    return;
  }
  setHtml(
    "environmentDetail",
    `
      <div class="source-entity-code">${escapeHtml(selected.environment.title || "信息化环境")}</div>
      <h2 class="source-entity-title">${escapeHtml(selected.object.title || "未命名对象")}</h2>
      <p class="source-entity-desc">环境片区：${escapeHtml(selected.object.environment_segment || "辅助字段，当前不作为主层级")}</p>
      ${renderEnvironmentPathMap(selected)}
      <div class="scope-chain-list">
        ${list(selected.object.scope_mappings)
          .map((mapping) => `
            <section class="scope-chain">
              <h3>${escapeHtml(codeTitle(mapping.scope, "未命名作用域"))}</h3>
              ${list(mapping.services)
                .map((service) => `
                  <article class="chain-service">
                    <div><strong>${escapeHtml(codeTitle(service, "未命名服务"))}</strong><span>安全技术服务</span></div>
                    <div class="chain-module-list">
                      ${list(service.modules).map((module) => `<div class="chain-module"><strong>${escapeHtml(titleOf(module))}</strong><span>${escapeHtml(list(module.systems).map(titleOf).join("、") || "未归属系统")}</span></div>`).join("") || '<div class="chain-module muted">暂无模块</div>'}
                    </div>
                  </article>
                `)
                .join("") || '<div class="reference-empty">暂无服务映射</div>'}
            </section>
          `)
          .join("")}
      </div>
    `,
  );
}

function renderLifecycle(kind) {
  const processes = lifecycleProcesses(kind).filter((process) => matchesSearch(process.title, process.description, process.goal));
  const selectedKey = kind === "dev" ? "selectedDevProcessId" : "selectedDataProcessId";
  if (!state[selectedKey]) state[selectedKey] = processes[0]?.id || null;
  const selected = processes.find((process) => process.id === state[selectedKey]) || processes[0];
  const navId = kind === "dev" ? "devLifecycleNav" : "dataLifecycleNav";
  const countId = kind === "dev" ? "devLifecycleCount" : "dataLifecycleCount";
  const laneId = kind === "dev" ? "devLifecycleLane" : "dataLifecycleMatrix";
  const detailId = kind === "dev" ? "devLifecycleDetail" : "dataLifecycleDetail";
  const typeId = kind === "dev" ? "devLifecycleType" : "dataLifecycleType";
  setText(countId, processes.length);
  setHtml(
    navId,
    processes.map((process) => `<button class="lifecycle-nav-row ${process.id === state[selectedKey] ? "active" : ""}" type="button" data-lifecycle-kind="${kind}" data-lifecycle-id="${escapeHtml(process.id)}"><strong>${escapeHtml(process.title || "未命名")}</strong><span>${escapeHtml(process.order || process.code || "")}</span></button>`).join("") || emptyState("暂无生命周期数据"),
  );
  setHtml(
    laneId,
    processes
      .map((process) => `
        <section class="lane-column">
          <strong>${escapeHtml(process.title || "未命名")}</strong>
          <span>${escapeHtml(kind === "dev" ? process.goal || "阶段目标待补充" : process.description || "过程说明待补充")}</span>
          <small>服务 ${list(process.technical_services).length} / 模块 ${list(process.technology_modules).length} / 策略 ${list(process.policy_requirements).length}</small>
        </section>
      `)
      .join("") || emptyState("暂无生命周期泳道"),
  );
  setText(typeId, kind === "dev" ? "LC-AP" : "LC-DT");
  setHtml(
    detailId,
    selected
      ? `
        <div class="source-entity-code">${escapeHtml(selected.order || selected.code || (kind === "dev" ? "LC-AP" : "LC-DT"))}</div>
        <h2 class="source-entity-title">${escapeHtml(selected.title || "未命名")}</h2>
        <p class="source-entity-desc">${escapeHtml(selected.goal || selected.description || "暂无说明")}</p>
        <h3 class="section-title">活动 / 场景</h3>
        <div class="source-chip-row">${pillList([...list(selected.main_activities), ...list(selected.security_activities), ...list(selected.scenes)], "暂无")}</div>
        <h3 class="section-title">策略 / 服务 / 模块</h3>
        <div class="source-chip-row">${pillList([...list(selected.policy_requirements), ...list(selected.technical_services), ...list(selected.technology_modules)], "暂无")}</div>
      `
      : emptyState("请选择生命周期节点"),
  );
}

function renderMaintenance() {
  const allRows = maintenanceRows();
  const rows = filterMaintenanceRows(allRows).filter((row) => matchesSearch(row.code, row.title, row.group, row.layer, row.description, ...list(row.relations)));
  if (!state.selectedMaintenanceId || !rows.some((row) => row.id === state.selectedMaintenanceId)) state.selectedMaintenanceId = rows[0]?.id || null;
  const pageTitles = {
    scopes: "作用域清单",
    processes: "流程清单",
    "work-functions": "职能清单",
    modules: "安全技术模块清单",
    standards: "标准与规范参考",
    roles: "岗位参考",
  };
  setText("scopeCount", list(state.management?.scope_types).length);
  setText("processCount", list(state.management?.security_processes).flatMap((domain) => list(domain.groups).flatMap((group) => list(group.references))).length);
  setText("workFunctionCount", list(state.management?.work_function_layers).flatMap((layer) => list(layer.groups).flatMap((group) => list(group.functions))).length);
  setText("moduleCount", list(state.management?.security_technology_modules).length);
  setText("standardCount", list(state.management?.gbt_42446_references).length);
  setText("roleCount", list(state.management?.gartner_roles).length);
  setText("sourcePageTitle", pageTitles[state.activeMaintenancePage] || "专项知识维护");
  setText("sourcePageCount", rows.length);
  const columns = maintenanceTableColumns();
  const columnTemplate = maintenanceColumnTemplate();
  setHtml(
    "sourceList",
    `<div class="source-sheet-table" style="--source-columns: ${escapeHtml(columnTemplate)}">
      <div class="source-sheet-row source-sheet-head">
        ${columns
          .map(
            (column, index) => `
              <span class="source-head-cell">
                <strong>${escapeHtml(column.label)}</strong>
                <input type="search" data-maint-filter="${escapeHtml(column.key)}" value="${escapeHtml(state.maintenanceFilters[column.key] || "")}" placeholder="筛选" />
                <i class="column-resizer" data-column-index="${index}" aria-hidden="true"></i>
              </span>
            `,
          )
          .join("")}
      </div>
      ${rows
        .map(
          (row) => `<button class="source-sheet-row ${row.id === state.selectedMaintenanceId ? "active" : ""}" type="button" data-maintenance-id="${escapeHtml(row.id)}">
            ${columns.map((column) => `<span>${escapeHtml(maintenanceCellValue(row, column.key) || "暂无")}</span>`).join("")}
          </button>`,
        )
        .join("")}
    </div>`,
  );
  const selected = rows.find((row) => row.id === state.selectedMaintenanceId);
  setText("sourceDetailType", selected?.type || "未选择");
  const shouldShowRelations = ["processes", "work-functions", "modules"].includes(state.activeMaintenancePage);
  const relationSection =
    selected && shouldShowRelations
      ? `
        <h3 class="section-title">关联结果</h3>
        <div class="source-chip-row">${pillList(selected.relations, "暂无关联")}</div>
      `
      : "";
  setHtml(
    "sourceDetail",
    selected
      ? `
        <div class="source-entity-code">${escapeHtml(selected.code || selected.type)}</div>
        <h2 class="source-entity-title">${escapeHtml(selected.title || "未命名")}</h2>
        <p class="source-entity-desc">${escapeHtml(selected.description || "暂无说明")}</p>
        <div class="source-entity-grid">
          <div><span>类型</span><strong>${escapeHtml(selected.type || "专项对象")}</strong></div>
          <div><span>分组</span><strong>${escapeHtml(selected.group || "未分组")}</strong></div>
          <div><span>层级</span><strong>${escapeHtml(selected.layer || "专项")}</strong></div>
        </div>
        ${relationSection}
      `
      : emptyState("请选择专项对象"),
  );
}

function visibleWorkspaceElements() {
  return [
    "overviewWorkspace",
    "capabilityWorkspace",
    "environmentWorkspace",
    "devLifecycleWorkspace",
    "dataLifecycleWorkspace",
    "maintenanceWorkspace",
    "contentWorkspace",
  ]
    .map((id) => $(id))
    .filter(Boolean);
}

function workspacePanes(workspace) {
  return [...workspace.children].filter((child) => !child.classList.contains("workspace-resizer"));
}

function applyWorkspaceGrid(workspace, widths) {
  const columns = widths.map((width, index) => `${Math.max(160, Math.round(width))}px${index < widths.length - 1 ? " 6px" : ""}`).join(" ");
  workspace.style.gridTemplateColumns = columns;
  workspace._paneWidths = widths;
}

function defaultWorkspaceWidths(workspace, panes) {
  const handlesWidth = 6 * (panes.length - 1);
  const total = Math.max(480, workspace.clientWidth - handlesWidth);
  const rest = (...fixed) => Math.max(220, total - fixed.reduce((sum, value) => sum + value, 0));
  if (workspace.id === "capabilityWorkspace") return [300, rest(300, 330), 330];
  if (workspace.id === "environmentWorkspace") return [rest(320), 320];
  if (workspace.id === "devLifecycleWorkspace" || workspace.id === "dataLifecycleWorkspace") return [270, rest(270, 220), 220];
  if (workspace.id === "maintenanceWorkspace") return [220, rest(220, 260), 260];
  if (workspace.id === "contentWorkspace") return [220, rest(220, 260), 260];
  if (workspace.id === "overviewWorkspace") {
    const issueWidth = 240;
    const mapWidth = Math.max(420, Math.round((total - issueWidth) * 0.6));
    return [mapWidth, rest(mapWidth, issueWidth), issueWidth];
  }
  const measured = panes.map((pane) => Math.max(160, pane.getBoundingClientRect().width));
  const measuredTotal = measured.reduce((sum, width) => sum + width, 0) || panes.length;
  return measured.map((width) => (width / measuredTotal) * total);
}

function ensureWorkspaceResizable(workspace) {
  if (workspace.classList.contains("is-hidden") || workspace.clientWidth <= 0) return;
  const panes = workspacePanes(workspace);
  if (panes.length < 2) return;
  workspace.classList.add("is-resizable");
  if (!workspace.dataset.resizableReady) {
    panes.slice(0, -1).forEach((pane, index) => {
      const handle = document.createElement("div");
      handle.className = "workspace-resizer";
      handle.dataset.workspaceResizeIndex = index;
      handle.setAttribute("role", "separator");
      handle.setAttribute("aria-orientation", "vertical");
      pane.after(handle);
    });
    workspace.dataset.resizableReady = "true";
  }
  if (!workspace._paneWidths) {
    applyWorkspaceGrid(workspace, defaultWorkspaceWidths(workspace, panes));
  }
}

function setupResizableWorkspaces() {
  visibleWorkspaceElements().forEach(ensureWorkspaceResizable);
}

function beginWorkspaceResize(event, handle) {
  const workspace = handle.parentElement;
  const index = Number(handle.dataset.workspaceResizeIndex);
  const panes = workspacePanes(workspace);
  if (!workspace || Number.isNaN(index) || index >= panes.length - 1) return;
  event.preventDefault();
  const startX = event.clientX;
  const startWidths = workspace._paneWidths || panes.map((pane) => pane.getBoundingClientRect().width);
  document.body.classList.add("is-resizing");
  const onMove = (moveEvent) => {
    const delta = moveEvent.clientX - startX;
    const nextWidths = [...startWidths];
    nextWidths[index] = Math.max(160, startWidths[index] + delta);
    nextWidths[index + 1] = Math.max(160, startWidths[index + 1] - delta);
    applyWorkspaceGrid(workspace, nextWidths);
  };
  const onUp = () => {
    document.body.classList.remove("is-resizing");
    document.removeEventListener("pointermove", onMove);
    document.removeEventListener("pointerup", onUp);
  };
  document.addEventListener("pointermove", onMove);
  document.addEventListener("pointerup", onUp, { once: true });
}

function applyMaintenanceColumnWidths() {
  const table = $("sourceList")?.querySelector(".source-sheet-table");
  if (table) table.style.setProperty("--source-columns", maintenanceColumnTemplate());
}

function applyRelationshipColumnWidths() {
  document.querySelectorAll(".relationship-matrix-table col[data-relation-column-index]").forEach((column) => {
    const index = Number(column.dataset.relationColumnIndex);
    if (!Number.isNaN(index)) column.style.width = `${Math.max(110, state.relationshipColumnWidths[index] || 150)}px`;
  });
}

function beginMaintenanceColumnResize(event, handle) {
  const index = Number(handle.dataset.columnIndex);
  if (Number.isNaN(index)) return;
  event.preventDefault();
  event.stopPropagation();
  const startX = event.clientX;
  const startWidths = [...state.maintenanceColumnWidths];
  document.body.classList.add("is-resizing");
  const onMove = (moveEvent) => {
    const delta = moveEvent.clientX - startX;
    state.maintenanceColumnWidths[index] = Math.max(90, startWidths[index] + delta);
    applyMaintenanceColumnWidths();
  };
  const onUp = () => {
    document.body.classList.remove("is-resizing");
    document.removeEventListener("pointermove", onMove);
    document.removeEventListener("pointerup", onUp);
  };
  document.addEventListener("pointermove", onMove);
  document.addEventListener("pointerup", onUp, { once: true });
}

function beginRelationshipColumnResize(event, handle) {
  const index = Number(handle.dataset.relationColumnIndex);
  if (Number.isNaN(index)) return;
  event.preventDefault();
  event.stopPropagation();
  const startX = event.clientX;
  const startWidths = [...state.relationshipColumnWidths];
  document.body.classList.add("is-resizing");
  const onMove = (moveEvent) => {
    const delta = moveEvent.clientX - startX;
    state.relationshipColumnWidths[index] = Math.max(110, startWidths[index] + delta);
    applyRelationshipColumnWidths();
  };
  const onUp = () => {
    document.body.classList.remove("is-resizing");
    document.removeEventListener("pointermove", onMove);
    document.removeEventListener("pointerup", onUp);
  };
  document.addEventListener("pointermove", onMove);
  document.addEventListener("pointerup", onUp, { once: true });
}

function renderContent() {
  const rows = contentRows().filter((row) => matchesSearch(row.title, row.category, row.view_type, row.content));
  if (!state.selectedContentId || !rows.some((row) => row.id === state.selectedContentId)) state.selectedContentId = rows[0]?.id || null;
  const titles = { html: "HTML 知识说明", drawio: "Draw.io 只读图", ppt: "PPT 使用说明" };
  setText("contentPageTitle", titles[state.activeContentPage]);
  setText("contentPageCount", rows.length);
  setText("htmlDocCount", list(state.content?.html_documents).length);
  setText("drawioViewCount", list(state.content?.diagram_views).length);
  setText("pptGuideCount", list(state.content?.guide_pages).length);
  setHtml(
    "contentList",
    rows.map((row) => `<button class="catalog-row ${row.id === state.selectedContentId ? "active" : ""}" type="button" data-content-id="${escapeHtml(row.id)}"><span class="catalog-main"><strong>${escapeHtml(row.title || "未命名内容")}</strong><small>${escapeHtml(row.view_type || row.category || "")}</small></span><span class="catalog-meta"><span>${escapeHtml(row.slide_number || row.page_index || row.updated_at || "")}</span></span></button>`).join("") || emptyState("暂无内容视图", "HTML / Draw.io / PPT 已预留入口"),
  );
  const selected = rows.find((row) => row.id === state.selectedContentId);
  setText("contentDetailType", state.activeContentPage);
  setHtml(
    "contentDetail",
    selected
      ? `
        <div class="source-entity-code">${escapeHtml(selected.view_type || selected.category || "内容")}</div>
        <h2 class="source-entity-title">${escapeHtml(selected.title || "未命名内容")}</h2>
        <p class="source-entity-desc">${escapeHtml(selected.content || selected.note || selected.drawio_path || selected.preview_path || "首版为索引占位，后续补充预览内容。")}</p>
      `
      : emptyState("请选择内容"),
  );
}

function renderActiveView() {
  renderMetrics();
  if (state.activeView === "overview") renderOverview();
  if (state.activeView === "capabilities") renderCapabilities();
  if (state.activeView === "environment") renderEnvironment();
  if (state.activeView === "dev-lifecycle") renderLifecycle("dev");
  if (state.activeView === "data-lifecycle") renderLifecycle("data");
  if (state.activeView === "maintenance") renderMaintenance();
  if (state.activeView === "content") renderContent();
}

function setActiveView(view) {
  state.activeView = view;
  for (const button of document.querySelectorAll(".module-tab")) {
    const active = button.dataset.view === view;
    button.classList.toggle("active", active);
    button.setAttribute("aria-current", active ? "page" : "false");
  }
  const workspaceMap = {
    overview: "overviewWorkspace",
    capabilities: "capabilityWorkspace",
    environment: "environmentWorkspace",
    "dev-lifecycle": "devLifecycleWorkspace",
    "data-lifecycle": "dataLifecycleWorkspace",
    maintenance: "maintenanceWorkspace",
    content: "contentWorkspace",
  };
  for (const [key, id] of Object.entries(workspaceMap)) $(id)?.classList.toggle("is-hidden", key !== view);
  renderActiveView();
  setupResizableWorkspaces();
}

function bindEvents() {
  document.querySelectorAll(".module-tab").forEach((button) => button.addEventListener("click", () => setActiveView(button.dataset.view)));
  $("searchInput")?.addEventListener("input", (event) => {
    state.search = event.target.value.trim();
    if ($("capabilitySearchInput")) $("capabilitySearchInput").value = event.target.value;
    renderActiveView();
  });
  $("resetButton")?.addEventListener("click", () => {
    state.search = "";
    state.relationshipFilters = {};
    $("searchInput").value = "";
    if ($("capabilitySearchInput")) $("capabilitySearchInput").value = "";
    state.selectedCapabilityId = null;
    renderCapabilities();
  });
  $("capabilitySearchInput")?.addEventListener("input", (event) => {
    state.search = event.target.value.trim();
    if ($("searchInput")) $("searchInput").value = event.target.value;
    renderCapabilities();
  });
  $("tree")?.addEventListener("click", (event) => {
    const row = event.target.closest("[data-capability-id]");
    if (!row) return;
    state.selectedCapabilityId = row.dataset.capabilityId;
    renderCapabilities();
  });
  $("detail")?.addEventListener("click", (event) => {
    const row = event.target.closest("[data-capability-id]");
    if (!row) return;
    state.selectedCapabilityId = row.dataset.capabilityId;
    renderCapabilities();
  });
  $("detail")?.addEventListener("input", (event) => {
    const input = event.target.closest("[data-relation-filter]");
    if (!input) return;
    state.relationshipFilters[input.dataset.relationFilter] = input.value;
    const field = input.dataset.relationFilter;
    const cursor = input.selectionStart;
    renderCapabilities();
    requestAnimationFrame(() => {
      const nextInput = $("detail")?.querySelector(`[data-relation-filter="${field}"]`);
      if (nextInput) {
        nextInput.focus();
        nextInput.setSelectionRange(cursor, cursor);
      }
    });
  });
  $("detail")?.addEventListener("pointerdown", (event) => {
    const handle = event.target.closest(".relationship-column-resizer");
    if (handle) beginRelationshipColumnResize(event, handle);
  });
  $("environmentSearchInput")?.addEventListener("input", (event) => {
    state.search = event.target.value.trim();
    renderEnvironment();
  });
  $("environmentTree")?.addEventListener("click", (event) => {
    const row = event.target.closest("[data-environment-object-id]");
    if (!row) return;
    state.selectedEnvironmentObjectId = row.dataset.environmentObjectId;
    renderEnvironment();
  });
  $("sourceSearchInput")?.addEventListener("input", (event) => {
    state.search = event.target.value.trim();
    renderMaintenance();
  });
  document.querySelectorAll("[data-source-page]").forEach((button) =>
    button.addEventListener("click", () => {
      state.activeMaintenancePage = button.dataset.sourcePage;
      state.selectedMaintenanceId = null;
      state.maintenanceFilters = {};
      document.querySelectorAll("[data-source-page]").forEach((item) => item.classList.toggle("active", item === button));
      renderMaintenance();
    }),
  );
  $("sourceList")?.addEventListener("click", (event) => {
    const row = event.target.closest("[data-maintenance-id]");
    if (!row) return;
    state.selectedMaintenanceId = row.dataset.maintenanceId;
    renderMaintenance();
  });
  $("sourceList")?.addEventListener("input", (event) => {
    const input = event.target.closest("[data-maint-filter]");
    if (!input) return;
    state.maintenanceFilters[input.dataset.maintFilter] = input.value;
    const field = input.dataset.maintFilter;
    const cursor = input.selectionStart;
    renderMaintenance();
    requestAnimationFrame(() => {
      const nextInput = $(`sourceList`)?.querySelector(`[data-maint-filter="${field}"]`);
      if (nextInput) {
        nextInput.focus();
        nextInput.setSelectionRange(cursor, cursor);
      }
    });
  });
  $("sourceList")?.addEventListener("pointerdown", (event) => {
    const handle = event.target.closest(".column-resizer");
    if (handle) beginMaintenanceColumnResize(event, handle);
  });
  document.addEventListener("pointerdown", (event) => {
    const handle = event.target.closest(".workspace-resizer");
    if (handle) beginWorkspaceResize(event, handle);
  });
  document.querySelectorAll("[data-lifecycle-kind]").forEach((button) => {
    button.addEventListener("click", () => {});
  });
  document.addEventListener("click", (event) => {
    const lifecycle = event.target.closest("[data-lifecycle-kind][data-lifecycle-id]");
    if (lifecycle) {
      if (lifecycle.dataset.lifecycleKind === "dev") state.selectedDevProcessId = lifecycle.dataset.lifecycleId;
      if (lifecycle.dataset.lifecycleKind === "data") state.selectedDataProcessId = lifecycle.dataset.lifecycleId;
      renderLifecycle(lifecycle.dataset.lifecycleKind);
    }
    const content = event.target.closest("[data-content-id]");
    if (content) {
      state.selectedContentId = content.dataset.contentId;
      renderContent();
    }
  });
  document.querySelectorAll("[data-content-page]").forEach((button) =>
    button.addEventListener("click", () => {
      state.activeContentPage = button.dataset.contentPage;
      state.selectedContentId = null;
      document.querySelectorAll("[data-content-page]").forEach((item) => item.classList.toggle("active", item === button));
      renderContent();
    }),
  );
}

async function fetchJson(path, fallback = null) {
  try {
    const response = await fetch(path, { cache: "no-store" });
    if (!response.ok) return fallback;
    return await response.json();
  } catch {
    return fallback;
  }
}

async function init() {
  [state.capability, state.management, state.lifecycle, state.content] = await Promise.all([
    fetchJson("./public/data/capability-tree.json", { stats: {}, categories: [] }),
    fetchJson("./public/data/management-knowledge.json", { stats: {} }),
    fetchJson("./public/data/lifecycle-knowledge.json", { stats: {} }),
    fetchJson("./public/data/content-views.json", { stats: {}, html_documents: [], diagram_views: [], guide_pages: [] }),
  ]);
  bindEvents();
  setActiveView("overview");
}

init();
