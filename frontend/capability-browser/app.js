const state = {
  data: null,
  management: null,
  selected: null,
  search: "",
  activeView: "capabilities",
  activeSourcePage: "work-functions",
  sourceSearch: "",
  selectedSourceId: null,
  expanded: new Set(),
};

const typeNames = {
  capability_catalog: "安全能力目录",
  capability_category: "能力分类",
  capability_domain: "L1 高阶战略能力",
  capability: "L2 安全能力",
  capability_focus: "关注点",
  unlinked_group: "未挂接关注点",
};

const layerOrder = ["网络安全决策层", "决策层", "网络安全管理层", "管理层", "网络安全执行层", "执行层", "网络安全监督层", "监督层"];

const els = {
  metrics: document.getElementById("metrics"),
  tree: document.getElementById("tree"),
  detail: document.getElementById("detail"),
  services: document.getElementById("services"),
  selectedType: document.getElementById("selectedType"),
  serviceCount: document.getElementById("serviceCount"),
  searchInput: document.getElementById("searchInput"),
  resetButton: document.getElementById("resetButton"),
  capabilityTab: document.getElementById("capabilityTab"),
  sourceTab: document.getElementById("sourceTab"),
  capabilityWorkspace: document.getElementById("capabilityWorkspace"),
  sourceWorkspace: document.getElementById("sourceWorkspace"),
  workFunctionCount: document.getElementById("workFunctionCount"),
  processCount: document.getElementById("processCount"),
  standardCount: document.getElementById("standardCount"),
  roleCount: document.getElementById("roleCount"),
  workFunctionsPageTab: document.getElementById("workFunctionsPageTab"),
  processesPageTab: document.getElementById("processesPageTab"),
  standardsPageTab: document.getElementById("standardsPageTab"),
  rolesPageTab: document.getElementById("rolesPageTab"),
  sourcePageTitle: document.getElementById("sourcePageTitle"),
  sourcePageCount: document.getElementById("sourcePageCount"),
  sourceSearchInput: document.getElementById("sourceSearchInput"),
  sourceList: document.getElementById("sourceList"),
  sourceDetail: document.getElementById("sourceDetail"),
  sourceDetailType: document.getElementById("sourceDetailType"),
};

function text(value) {
  return value == null ? "" : String(value);
}

function list(value) {
  return Array.isArray(value) ? value : [];
}

function titleOf(value) {
  if (value == null) return "";
  if (typeof value === "object") return text(value.title || value.name || value.code || value.id);
  return text(value);
}

function itemText(item) {
  return [item.code, item.title, item.description].map(text).join(" ").toLowerCase();
}

function serviceText(service) {
  return [service.code, service.title, service.description, ...list(service.scopes).map((scope) => `${scope.code} ${scope.title}`)]
    .map(text)
    .join(" ")
    .toLowerCase();
}

function catalogRoot(data) {
  return {
    id: "capability-catalog-root",
    type: "capability_catalog",
    code: "",
    title: "安全能力目录",
    description: "按 Excel 安全能力目录原始顺序组织的能力分类、L1 高阶战略能力、L2 安全能力和关注点。",
    category_count: data.stats.categories,
    domain_count: data.stats.domains,
    capability_count: data.stats.capabilities,
    focus_count: data.stats.focuses,
    service_count: data.stats.services,
    sources: [],
    categories: data.categories,
  };
}

function childrenFor(item) {
  if (item.type === "capability_catalog") return list(item.categories);
  if (item.type === "capability_category") return list(item.domains);
  if (item.type === "capability_domain") return list(item.capabilities);
  if (item.type === "capability") return list(item.focuses);
  if (item.type === "unlinked_group") return list(item.focuses);
  return [];
}

function hasChildren(item) {
  return childrenFor(item).length > 0;
}

function isExpanded(item) {
  return state.search ? true : state.expanded.has(item.id);
}

function levelLabel(item, level) {
  if (item.type === "capability_catalog") return "目录";
  if (item.type === "capability_category") return "分类";
  if (item.type === "capability_domain") return "L1";
  if (item.type === "capability") return "L2";
  if (item.type === "capability_focus") return "关注点";
  return `层级 ${level + 1}`;
}

function escapeHtml(value) {
  return text(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function highlight(value) {
  const safe = escapeHtml(value);
  if (!state.search) return safe;
  const query = state.search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return safe.replace(new RegExp(query, "gi"), (match) => `<mark>${match}</mark>`);
}

function rowMatchesDeep(item) {
  if (!state.search) return true;
  const needle = state.search.toLowerCase();
  if (itemText(item).includes(needle)) return true;
  if (list(item.services).some((service) => serviceText(service).includes(needle))) return true;
  return childrenFor(item).some(rowMatchesDeep);
}

function flattenTree(data, options = {}) {
  const rows = [];

  function append(item, level, count) {
    if (options.onlyMatches && !rowMatchesDeep(item)) return;
    rows.push({ item, level, count });
    if (!options.includeCollapsed && !isExpanded(item)) return;
    for (const child of childrenFor(item)) {
      append(child, level + 1, child.domain_count || child.capability_count || child.focus_count || child.service_count);
    }
  }

  const root = catalogRoot(data);
  append(root, 0, root.category_count);
  if (list(data.unlinked_focuses).length) {
    append(
      {
        id: "unlinked-focuses",
        type: "unlinked_group",
        code: "",
        title: "未挂接关注点",
        description: "这些关注点已被服务引用，但暂未在能力目录中找到明确上级。",
        service_count: data.unlinked_focuses.reduce((total, focus) => total + (focus.service_count || 0), 0),
        focus_count: data.unlinked_focuses.length,
        sources: [],
        focuses: data.unlinked_focuses,
      },
      0,
      data.unlinked_focuses.length,
    );
  }
  return rows;
}

function initializeExpanded(data) {
  state.expanded.clear();
  state.expanded.add("capability-catalog-root");
  for (const category of list(data.categories)) {
    state.expanded.add(category.id);
  }
}

function renderMetrics() {
  const stats = state.data.stats;
  const metrics = [
    ["分类", stats.categories],
    ["L1", stats.domains],
    ["L2", stats.capabilities],
    ["关注点", stats.focuses],
    ["服务", stats.services],
  ];
  els.metrics.innerHTML = metrics.map(([label, value]) => `<div class="metric"><strong>${value}</strong><span>${label}</span></div>`).join("");
}

function renderTree() {
  const rows = flattenTree(state.data, { onlyMatches: Boolean(state.search) });
  if (!rows.length) {
    els.tree.innerHTML = '<div class="detail-empty">没有匹配结果</div>';
    return;
  }
  els.tree.innerHTML = rows
    .map(({ item, level, count }) => {
      const active = state.selected && state.selected.id === item.id ? " active" : "";
      const codeClass = item.code ? " has-code" : " no-code";
      const expandable = hasChildren(item);
      const expanded = expandable && isExpanded(item);
      const expander = expandable ? (expanded ? "-" : "+") : "";
      const code = item.code ? `<span class="node-code">${highlight(item.code)}</span>` : "";
      return `
        <div class="tree-row tree-level-${level}${active}${codeClass}" data-id="${item.id}" aria-expanded="${expandable ? String(expanded) : "false"}">
          <button class="node-toggle" data-id="${item.id}" ${expandable ? "" : "disabled"} aria-label="${expanded ? "收起" : "展开"} ${escapeHtml(item.title)}">
            ${expander}
          </button>
          <button class="tree-node" data-id="${item.id}">
            <span class="node-meta">
              <span class="node-level-label">${levelLabel(item, level)}</span>
              ${code}
            </span>
            <span class="node-title">${highlight(item.title)}</span>
            <span class="node-count">${count || ""}</span>
          </button>
        </div>
      `;
    })
    .join("");
}

function findById(id) {
  return flattenTree(state.data, { includeCollapsed: true }).find((row) => row.item.id === id)?.item || null;
}

function selectItem(item) {
  state.selected = item;
  renderTree();
  renderDetail();
  renderServices();
}

function toggleItem(item) {
  if (!hasChildren(item)) return;
  if (state.expanded.has(item.id)) {
    state.expanded.delete(item.id);
  } else {
    state.expanded.add(item.id);
  }
  renderTree();
}

function summaryRows(item) {
  const rows = [];
  if (item.category_count != null) rows.push(["能力分类", item.category_count]);
  if (item.domain_count != null) rows.push(["L1", item.domain_count]);
  if (item.capability_count != null) rows.push(["L2", item.capability_count]);
  if (item.focus_count != null) rows.push(["关注点", item.focus_count]);
  if (item.service_count != null) rows.push(["技术服务", item.service_count]);
  return rows;
}

function renderSourceList(sources, className = "source-list", emptyText = "暂无来源引用") {
  const rows = list(sources)
    .map(
      (source) => `
        <div class="source-row">
          <strong>${escapeHtml(source.sheet || "未知 Sheet")}</strong>
          <small>第 ${escapeHtml(source.row || "")} 行 · ${escapeHtml(source.cell || "")}</small>
          <div>${highlight(source.raw_value || "")}</div>
        </div>
      `,
    )
    .join("");
  return `<div class="${className}">${rows || `<div class="source-row">${emptyText}</div>`}</div>`;
}

function renderSecurityWorks(item) {
  if (item.type !== "capability_focus") return "";
  const works = list(item.security_works);
  if (!works.length) return "";
  return `
    <h3 class="section-title">安全工作</h3>
    <div class="management-card-list">
      ${works
        .map(
          (work) => `
            <article class="mini-card">
              <div class="mini-card-kicker">${escapeHtml(work.code || "安全工作")}</div>
              <h4>${highlight(work.title || "未命名安全工作")}</h4>
              <p>${highlight(work.description || "暂无描述")}</p>
              <details>
                <summary>来源追踪</summary>
                ${renderSourceList(work.sources)}
              </details>
            </article>
          `,
        )
        .join("")}
    </div>
  `;
}

function renderStakeholderPills(stakeholders = {}) {
  const layers = ["决策层", "管理层", "执行层", "监督层"];
  return layers
    .map((layer) => {
      const items = list(stakeholders[layer]);
      return `
        <div class="stakeholder-row">
          <strong>${layer}</strong>
          <div>
            ${items.length ? items.map((item) => `<span class="stakeholder-pill">${escapeHtml(titleOf(item))}</span>`).join("") : '<span class="empty-inline">暂无</span>'}
          </div>
        </div>
      `;
    })
    .join("");
}

function renderProcessMappings(item) {
  if (item.type !== "capability_focus") return "";
  const mappings = list(item.process_mappings);
  if (!mappings.length) return "";
  return `
    <h3 class="section-title">流程与组织职能相关方</h3>
    <div class="process-list">
      ${mappings
        .map((mapping) => {
          const group = mapping.process_group || {};
          const reference = mapping.process_reference || {};
          return `
            <article class="process-card">
              <div class="process-head">
                <span>${escapeHtml(group.title || "未关联流程组")}</span>
                <strong>${escapeHtml(reference.title || "未关联 L3 流程参考")}</strong>
              </div>
              <div class="stakeholder-grid">${renderStakeholderPills(mapping.stakeholders)}</div>
              <details>
                <summary>来源追踪</summary>
                ${renderSourceList(mapping.sources)}
              </details>
            </article>
          `;
        })
        .join("")}
    </div>
  `;
}

function renderDetail() {
  const item = state.selected;
  if (!item) {
    els.selectedType.textContent = "未选择";
    els.detail.innerHTML = '<div class="detail-empty">从左侧选择一个能力、关注点或分类</div>';
    return;
  }
  els.selectedType.textContent = typeNames[item.type] || item.type;
  const summary = summaryRows(item)
    .map(([label, value]) => `<div class="summary-row"><strong>${value}</strong><small>${label}</small></div>`)
    .join("");
  els.detail.innerHTML = `
    <div class="detail-code">${highlight(item.code || "无编码")}</div>
    <h2 class="detail-title">${highlight(item.title)}</h2>
    <p class="detail-desc">${highlight(item.description || "暂无描述")}</p>
    ${summary ? `<h3 class="section-title">结构统计</h3><div class="summary-list">${summary}</div>` : ""}
    ${renderSecurityWorks(item)}
    ${renderProcessMappings(item)}
    <h3 class="section-title">来源追踪</h3>
    ${renderSourceList(item.sources)}
  `;
}

function servicesForSelected() {
  const item = state.selected;
  if (!item) return [];
  if (item.type === "capability_catalog") {
    return list(item.categories).flatMap((category) =>
      list(category.domains).flatMap((domain) => list(domain.capabilities).flatMap((capability) => list(capability.focuses).flatMap((focus) => list(focus.services)))),
    );
  }
  if (item.type === "capability_focus") return list(item.services);
  if (item.type === "unlinked_group") return list(item.focuses).flatMap((focus) => list(focus.services));
  if (item.type === "capability") return list(item.focuses).flatMap((focus) => list(focus.services));
  if (item.type === "capability_domain") return list(item.capabilities).flatMap((capability) => list(capability.focuses).flatMap((focus) => list(focus.services)));
  if (item.type === "capability_category") {
    return list(item.domains).flatMap((domain) => list(domain.capabilities).flatMap((capability) => list(capability.focuses).flatMap((focus) => list(focus.services))));
  }
  return [];
}

function renderServices() {
  const services = servicesForSelected();
  els.serviceCount.textContent = services.length;
  if (!services.length) {
    els.services.innerHTML = '<div class="service-empty">选择关注点后查看关联服务</div>';
    return;
  }
  els.services.innerHTML = services
    .map((service) => {
      const scopes = list(service.scopes)
        .map((scope) => `<span class="scope-pill">${highlight(scope.code || "")} ${highlight(scope.title)}</span>`)
        .join("");
      const sources = list(service.sources)
        .slice(0, 4)
        .map(
          (source) => `
            <div class="service-source">
              <strong>${escapeHtml(source.sheet || "未知 Sheet")}</strong>
              <span>第 ${escapeHtml(source.row || "")} 行 · ${escapeHtml(source.cell || "")}</span>
              <small>${highlight(source.raw_value || "")}</small>
            </div>
          `,
        )
        .join("");
      return `
        <article class="service-card">
          <div class="service-code">${highlight(service.code || "无编码")}</div>
          <h3>${highlight(service.title)}</h3>
          <div class="scope-list">${scopes || '<span class="scope-pill">未关联作用域</span>'}</div>
          <details class="service-sources">
            <summary>来源追踪</summary>
            ${sources || '<div class="service-source">暂无来源引用</div>'}
          </details>
        </article>
      `;
    })
    .join("");
}

function normalizedLayers() {
  const layers = list(state.management?.work_function_layers);
  return [...layers].sort((a, b) => {
    const aIndex = layerOrder.indexOf(a.title);
    const bIndex = layerOrder.indexOf(b.title);
    return (aIndex === -1 ? 99 : aIndex) - (bIndex === -1 ? 99 : bIndex);
  });
}

function workFunctionTotal() {
  return normalizedLayers().reduce(
    (total, layer) => total + list(layer.groups).reduce((groupTotal, group) => groupTotal + list(group.functions).length, 0),
    0,
  );
}

function processTotal() {
  return list(state.management?.security_processes).reduce(
    (total, domain) => total + list(domain.groups).reduce((groupTotal, group) => groupTotal + list(group.references).length, 0),
    0,
  );
}

function updateSourceNavCounts() {
  els.workFunctionCount.textContent = "0";
  els.processCount.textContent = "0";
  els.standardCount.textContent = "0";
  els.roleCount.textContent = "0";
  if (!state.management) return;
  els.workFunctionCount.textContent = workFunctionTotal();
  els.processCount.textContent = processTotal();
  els.standardCount.textContent = list(state.management.gbt_42446_references).length;
  els.roleCount.textContent = list(state.management.gartner_roles).length;
}

function renderEmptySources() {
  updateSourceNavCounts();
  const empty = `
    <div class="detail-empty">
      暂无第二批管理知识数据<br />
      等待主控生成 public/data/management-knowledge.json
    </div>
  `;
  els.sourcePageTitle.textContent = "知识来源";
  els.sourcePageCount.textContent = "0";
  els.sourceList.innerHTML = empty;
  els.sourceDetailType.textContent = "未选择";
  els.sourceDetail.innerHTML = empty;
}

function renderFunctionLayersPage() {
  const layers = normalizedLayers();
  const assets = list(state.management?.assets);
  els.sourcePageTitle.textContent = "安全工作职能";
  els.sourcePageCount.textContent = workFunctionTotal();
  if (!layers.length) {
    els.sourceContent.innerHTML = '<div class="detail-empty">暂无安全工作职能清单</div>';
    return;
  }
  const layerHtml = layers
    .map((layer, layerIndex) => {
      const groupHtml = list(layer.groups)
        .map(
          (group, groupIndex) => `
            <details class="function-group" ${layerIndex === 0 && groupIndex < 2 ? "open" : ""}>
              <summary>
                <span>${escapeHtml(group.title || "未分组")}</span>
                <strong>${list(group.functions).length}</strong>
              </summary>
              <div class="function-list">
                ${list(group.functions)
                  .map(
                    (fn) => `
                      <article class="function-card">
                        <div class="function-code">${escapeHtml(fn.code || "无编码")}</div>
                        <h3>${escapeHtml(fn.title || "未命名职能")}</h3>
                        <p>${escapeHtml(fn.description || "暂无定义")}</p>
                        ${list(fn.tasks).length ? `<div class="task-list">${list(fn.tasks).map((task) => `<span>${escapeHtml(titleOf(task))}</span>`).join("")}</div>` : ""}
                        ${
                          list(fn.gbt_42446_refs).length
                            ? `<div class="gbt-chip-row">${list(fn.gbt_42446_refs)
                                .map((ref) => `<span class="gbt-chip">GB/T ${escapeHtml(titleOf(ref))}</span>`)
                                .join("")}</div>`
                            : ""
                        }
                      </article>
                    `,
                  )
                  .join("")}
              </div>
            </details>
          `,
        )
        .join("");
      return `
        <section class="function-layer">
          <div class="layer-head">
            <span>${escapeHtml(layer.title)}</span>
            <strong>${list(layer.groups).reduce((total, group) => total + list(group.functions).length, 0)}</strong>
          </div>
          ${groupHtml}
        </section>
      `;
    })
    .join("");
  const assetHtml = assets.length
    ? `
      <section class="source-asset-strip">
        <div class="source-section-head">
          <h3>安全工作职能图片</h3>
          <span>${assets.length}</span>
        </div>
        <div class="asset-grid">${assets.map(renderAssetCard).join("")}</div>
      </section>
    `
    : "";
  els.sourceContent.innerHTML = `<div class="source-page-grid">${layerHtml}${assetHtml}</div>`;
}

function groupByCategory(items) {
  return list(items).reduce((groups, item) => {
    const category = item.category || "未分类";
    groups[category] = groups[category] || [];
    groups[category].push(item);
    return groups;
  }, {});
}

function renderProcessPage() {
  const domains = list(state.management?.security_processes);
  els.sourcePageTitle.textContent = "安全流程";
  els.sourcePageCount.textContent = processTotal();
  if (!domains.length) {
    els.sourceContent.innerHTML = '<div class="detail-empty">暂无安全流程清单</div>';
    return;
  }
  els.sourceContent.innerHTML = domains
    .map(
      (domain) => `
        <section class="process-domain-card">
          <div class="layer-head">
            <span>${escapeHtml([domain.code, domain.title].filter(Boolean).join(" "))}</span>
            <strong>${list(domain.groups).reduce((total, group) => total + list(group.references).length, 0)}</strong>
          </div>
          ${list(domain.groups)
            .map(
              (group, groupIndex) => `
                <details class="function-group" ${groupIndex < 1 ? "open" : ""}>
                  <summary>
                    <span>${escapeHtml(group.title || "未分组流程组")}</span>
                    <strong>${list(group.references).length}</strong>
                  </summary>
                  <div class="process-reference-list">
                    ${list(group.references)
                      .map(
                        (reference) => `
                          <article class="process-reference-card">
                            <div class="function-code">${escapeHtml(reference.capability_focus_code || reference.code || "L3流程参考")}</div>
                            <h3>${escapeHtml(reference.title || "未命名流程")}</h3>
                            <p>${escapeHtml(reference.description || "暂无说明")}</p>
                            ${
                              list(reference.stakeholders).length
                                ? `<div class="stakeholder-chip-row">${list(reference.stakeholders)
                                    .map((stakeholder) => `<span class="stakeholder-pill">${escapeHtml(titleOf(stakeholder))}</span>`)
                                    .join("")}</div>`
                                : ""
                            }
                            <details>
                              <summary>来源追踪</summary>
                              ${renderSourceList(reference.sources)}
                            </details>
                          </article>
                        `,
                      )
                      .join("")}
                  </div>
                </details>
              `,
            )
            .join("")}
        </section>
      `,
    )
    .join("");
}

function renderStandardsPage() {
  const gbtRefs = list(state.management?.gbt_42446_references);
  els.sourcePageTitle.textContent = "标准与规范参考";
  els.sourcePageCount.textContent = gbtRefs.length;
  els.sourceContent.innerHTML = `
    ${
      gbtRefs.length
        ? Object.entries(groupByCategory(gbtRefs))
            .map(
              ([category, refs]) => `
                <section class="reference-group">
                  <h4>${escapeHtml(category)}</h4>
                  ${refs.map((ref) => `<div class="reference-row"><span>${escapeHtml(ref.title || "未命名任务")}</span></div>`).join("")}
                </section>
              `,
            )
            .join("")
        : '<div class="reference-empty">暂无 GB/T 42446-2023 引用</div>'
    }
  `;
}

function renderRolesPage() {
  const gartnerRoles = list(state.management?.gartner_roles);
  els.sourcePageTitle.textContent = "岗位参考";
  els.sourcePageCount.textContent = gartnerRoles.length;
  els.sourceContent.innerHTML = `
    ${
      gartnerRoles.length
        ? Object.entries(groupByCategory(gartnerRoles))
            .map(
              ([category, roles]) => `
                <section class="reference-group">
                  <h4>${escapeHtml(category)}</h4>
                  ${roles
                    .map(
                      (role) => `
                        <article class="role-card">
                          <strong>${escapeHtml(role.title || "未命名岗位")}</strong>
                          <p>${escapeHtml(role.description || "暂无描述")}</p>
                        </article>
                      `,
                    )
                    .join("")}
                </section>
              `,
            )
            .join("")
        : '<div class="reference-empty">暂无 Gartner 岗位参考</div>'
    }
  `;
}

function renderAssetCard(asset) {
  return `
    <figure class="asset-card">
      <div class="asset-image-wrap">
        <img src="${escapeHtml(asset.path || "")}" alt="${escapeHtml(asset.title || "图片资产")}" loading="lazy" />
      </div>
      <figcaption>
        <strong>${escapeHtml(asset.title || "未命名图片")}</strong>
        <span>${escapeHtml(asset.source_sheet || "未知来源")}</span>
      </figcaption>
    </figure>
  `;
}

const sourcePageInfo = {
  "work-functions": { title: "安全工作职能", type: "工作职能" },
  processes: { title: "安全流程", type: "流程" },
  standards: { title: "标准与规范参考", type: "标准任务" },
  roles: { title: "岗位参考", type: "岗位" },
};

function sourceRowsForPage() {
  if (state.activeSourcePage === "work-functions") {
    return normalizedLayers().flatMap((layer) =>
      list(layer.groups).flatMap((group) =>
        list(group.functions).map((fn) => ({
          id: fn.id,
          type: "工作职能",
          code: fn.code || "",
          title: fn.title || "未命名职能",
          description: fn.description || "暂无定义",
          group: group.title || "未分组",
          layer: layer.title || "",
          sources: fn.sources,
          relations: [...list(fn.tasks).map((task) => titleOf(task)), ...list(fn.gbt_42446_refs).map((ref) => `GB/T ${titleOf(ref)}`)],
        })),
      ),
    );
  }
  if (state.activeSourcePage === "processes") {
    return list(state.management?.security_processes).flatMap((domain) =>
      list(domain.groups).flatMap((group) =>
        list(group.references).map((reference) => ({
          id: reference.id,
          type: "流程",
          code: reference.capability_focus_code || reference.code || "",
          title: reference.title || "未命名流程",
          description: reference.description || "暂无说明",
          group: group.title || "未分组流程组",
          layer: [domain.code, domain.title].filter(Boolean).join(" "),
          sources: reference.sources,
          relations: list(reference.stakeholders).map((stakeholder) => titleOf(stakeholder)),
        })),
      ),
    );
  }
  if (state.activeSourcePage === "standards") {
    return list(state.management?.gbt_42446_references).map((ref) => ({
      id: ref.id,
      type: "标准任务",
      code: ref.code || "",
      title: ref.title || "未命名任务",
      description: ref.description || "暂无说明",
      group: ref.category || "未分类",
      layer: "GB/T 42446-2023",
      sources: ref.sources,
      relations: [],
    }));
  }
  return list(state.management?.gartner_roles).map((role) => ({
    id: role.id,
    type: "岗位",
    code: role.code || "",
    title: role.title || "未命名岗位",
    description: role.description || "暂无描述",
    group: role.category || "未分类",
    layer: "Gartner 工作岗位参考",
    sources: role.sources,
    relations: [],
  }));
}

function sourceRowText(row) {
  return [row.type, row.code, row.title, row.description, row.group, row.layer, ...list(row.relations), ...list(row.sources).map((source) => source.raw_value)]
    .map(text)
    .join(" ")
    .toLowerCase();
}

function filteredSourceRows(rows) {
  const needle = state.sourceSearch.toLowerCase();
  if (!needle) return rows;
  return rows.filter((row) => sourceRowText(row).includes(needle));
}

function renderSourceCatalog(rows) {
  const filtered = filteredSourceRows(rows);
  els.sourcePageTitle.textContent = sourcePageInfo[state.activeSourcePage]?.title || "知识来源";
  els.sourcePageCount.textContent = filtered.length;
  if (!filtered.some((row) => row.id === state.selectedSourceId)) {
    state.selectedSourceId = filtered[0]?.id || null;
  }
  if (!filtered.length) {
    els.sourceList.innerHTML = '<div class="detail-empty">没有匹配的知识实体</div>';
    return;
  }
  els.sourceList.innerHTML = `
    <div class="catalog-table" role="list">
      ${filtered
        .map((row) => {
          const active = row.id === state.selectedSourceId ? " active" : "";
          return `
            <button class="catalog-row${active}" type="button" data-source-id="${escapeHtml(row.id)}" role="listitem">
              <span class="catalog-main">
                <strong>${highlight(row.title)}</strong>
                <small>${escapeHtml(row.group || row.type)}</small>
              </span>
              <span class="catalog-meta">
                <span>${escapeHtml(row.code || row.type)}</span>
                <span>${escapeHtml(row.layer || "")}</span>
              </span>
            </button>
          `;
        })
        .join("")}
    </div>
  `;
}

function renderSourceEntityDetail(rows) {
  const row = rows.find((item) => item.id === state.selectedSourceId);
  if (!row) {
    els.sourceDetailType.textContent = "未选择";
    els.sourceDetail.innerHTML = '<div class="detail-empty">从中间清单选择一个知识实体</div>';
    return;
  }
  els.sourceDetailType.textContent = row.type;
  const relationHtml = list(row.relations).length
    ? `<div class="source-chip-row">${list(row.relations).map((item) => `<span>${escapeHtml(item)}</span>`).join("")}</div>`
    : '<div class="reference-empty">暂无关联信息</div>';
  els.sourceDetail.innerHTML = `
    <div class="source-entity-code">${escapeHtml(row.code || row.type)}</div>
    <h2 class="source-entity-title">${highlight(row.title)}</h2>
    <p class="source-entity-desc">${highlight(row.description || "暂无说明")}</p>
    <div class="source-entity-grid">
      <div><span>层级/来源域</span><strong>${escapeHtml(row.layer || "未分类")}</strong></div>
      <div><span>分组</span><strong>${escapeHtml(row.group || "未分组")}</strong></div>
      <div><span>来源引用</span><strong>${list(row.sources).length}</strong></div>
    </div>
    <h3 class="section-title">关联信息</h3>
    ${relationHtml}
    <h3 class="section-title">来源追踪</h3>
    ${renderSourceList(row.sources, "source-list compact", "暂无来源引用")}
  `;
}

function renderSources() {
  if (!state.management) {
    renderEmptySources();
    return;
  }
  updateSourceNavCounts();
  for (const button of [els.workFunctionsPageTab, els.processesPageTab, els.standardsPageTab, els.rolesPageTab]) {
    button.classList.toggle("active", button.dataset.sourcePage === state.activeSourcePage);
  }
  const rows = sourceRowsForPage();
  const filtered = filteredSourceRows(rows);
  renderSourceCatalog(rows);
  renderSourceEntityDetail(filtered);
}

function setActiveView(view) {
  state.activeView = view;
  const sourceActive = view === "sources";
  els.capabilityTab.classList.toggle("active", !sourceActive);
  els.sourceTab.classList.toggle("active", sourceActive);
  els.capabilityWorkspace.classList.toggle("is-hidden", sourceActive);
  els.sourceWorkspace.classList.toggle("is-hidden", !sourceActive);
  if (sourceActive) renderSources();
}

function setSourcePage(page) {
  state.activeSourcePage = page;
  state.sourceSearch = "";
  state.selectedSourceId = null;
  els.sourceSearchInput.value = "";
  renderSources();
}

function bindEvents() {
  els.tree.addEventListener("click", (event) => {
    const toggle = event.target.closest(".node-toggle");
    if (toggle && !toggle.disabled) {
      const item = findById(toggle.dataset.id);
      if (item) toggleItem(item);
      return;
    }
    const node = event.target.closest(".tree-node");
    if (!node) return;
    const item = findById(node.dataset.id);
    if (!item) return;
    selectItem(item);
  });
  els.searchInput.addEventListener("input", (event) => {
    state.search = event.target.value.trim();
    renderTree();
    renderDetail();
    renderServices();
  });
  els.resetButton.addEventListener("click", () => {
    state.search = "";
    els.searchInput.value = "";
    initializeExpanded(state.data);
    selectItem(catalogRoot(state.data));
  });
  els.capabilityTab.addEventListener("click", () => setActiveView("capabilities"));
  els.sourceTab.addEventListener("click", () => setActiveView("sources"));
  els.sourceSearchInput.addEventListener("input", (event) => {
    state.sourceSearch = event.target.value.trim();
    renderSources();
  });
  els.sourceList.addEventListener("click", (event) => {
    const row = event.target.closest(".catalog-row");
    if (!row) return;
    state.selectedSourceId = row.dataset.sourceId;
    renderSources();
  });
  for (const button of [els.workFunctionsPageTab, els.processesPageTab, els.standardsPageTab, els.rolesPageTab]) {
    button.addEventListener("click", () => setSourcePage(button.dataset.sourcePage));
  }
}

async function fetchRequiredJson(path) {
  const response = await fetch(path, { cache: "no-store" });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

async function fetchOptionalJson(path) {
  try {
    const response = await fetch(path, { cache: "no-store" });
    if (!response.ok) return null;
    const raw = await response.text();
    if (!raw.trim()) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function init() {
  try {
    const [capabilityData, managementData] = await Promise.all([
      fetchRequiredJson("./public/data/capability-tree.json"),
      fetchOptionalJson("./public/data/management-knowledge.json"),
    ]);
    state.data = capabilityData;
    state.management = managementData;
    initializeExpanded(state.data);
    renderMetrics();
    renderSources();
    bindEvents();
    selectItem(catalogRoot(state.data));
  } catch (error) {
    els.tree.innerHTML = "";
    els.detail.innerHTML = `<div class="detail-empty">数据加载失败<br />请先运行 python scripts/sapd_wiki.py export-capability-tree</div>`;
    els.services.innerHTML = `<div class="service-empty">${escapeHtml(error.message)}</div>`;
    renderEmptySources();
  }
}

init();
