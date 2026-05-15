(function () {
  const components = (window.sapdComponents = window.sapdComponents || {});
  const utils = components.utils;

  const LAYERS = [
    { key: "decision", label: "决策层", tone: "decision" },
    { key: "management", label: "管理层", tone: "management" },
    { key: "execution", label: "执行层", tone: "execution" },
    { key: "supervision", label: "监督层", tone: "supervision" },
  ];

  function list(value) {
    if (utils?.list) return utils.list(value);
    return Array.isArray(value) ? value : [];
  }

  function text(value) {
    if (utils?.text) return utils.text(value);
    return value == null ? "" : String(value);
  }

  function escape(value) {
    if (utils?.escapeHtml) return utils.escapeHtml(value);
    return text(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }

  function valueOf(value, fallback = "待补充") {
    const normalized = text(value).trim();
    return normalized || fallback;
  }

  function entityName(item, fallback = "待补充") {
    if (item == null) return fallback;
    if (typeof item === "string") return valueOf(item, fallback);
    return valueOf(item.name || item.title || item.code || item.id, fallback);
  }

  function entityCode(item) {
    return text(item?.code || item?.scopeCode || item?.serviceCode || "").trim();
  }

  function statusText(status) {
    if (status === "ambiguous") return "待确认";
    if (status === "missing") return "待补充";
    if (status === "not_applicable") return "不适用";
    if (status === "pending") return "待确认";
    if (status === "description") return "说明类";
    return "已映射";
  }

  function keyOf(item) {
    return [item?.id, item?.code, item?.name, item?.title, item?.scopeName, item?.serviceName].map(text).filter(Boolean).join("::");
  }

  function unique(items) {
    const seen = new Set();
    return list(items).filter((item) => {
      const key = keyOf(item) || JSON.stringify(item);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  function limited(items, limit = 6) {
    const rows = unique(items).filter(Boolean);
    return { visible: rows.slice(0, limit), total: rows.length, more: Math.max(0, rows.length - limit) };
  }

  function renderTags(items, options = {}) {
    const { empty = "暂无", limit = 6, className = "canvas-tag", getLabel = entityName } = options;
    const data = limited(items, limit);
    if (!data.visible.length) return `<span class="canvas-empty">${escape(empty)}</span>`;
    return `
      ${data.visible.map((item) => `<span class="${escape(className)}" title="${escape(getLabel(item))}">${escape(getLabel(item))}</span>`).join("")}
      ${data.more ? `<span class="${escape(className)} is-more">+${data.more}</span>` : ""}
    `;
  }

  function renderFocus(focus = {}) {
    return `
      <div class="canvas-focus-node">
        <span class="node-kicker">当前关注点</span>
        <strong>${escape(valueOf(focus.name, "未命名关注点"))}</strong>
        <em>${escape(valueOf(focus.code, "无编码"))}</em>
        <p>${escape(valueOf(focus.description, "用于定位当前安全能力关注点，并从技术和管理两个视角查看落地关系。"))}</p>
      </div>
    `;
  }

  function linkByServiceKey(links = []) {
    const map = new Map();
    for (const link of list(links)) {
      const keys = [link.serviceId, link.serviceCode, link.serviceName].map(text).filter(Boolean);
      for (const key of keys) map.set(key, link);
    }
    return map;
  }

  function matchLink(pair, linkMap) {
    const keys = [pair.serviceId, pair.serviceCode, pair.serviceName].map(text).filter(Boolean);
    for (const key of keys) {
      if (linkMap.has(key)) return linkMap.get(key);
    }
    return null;
  }

  function renderServiceGroup(pair, linkMap, index) {
    const link = matchLink(pair, linkMap);
    const modules = list(link?.modules);
    const measures = list(link?.measures);
    const serviceName = valueOf(pair.serviceName || link?.serviceName, "待补充服务");
    const scopeName = valueOf(pair.scopeName, "待补充作用域");
    const scopeCode = valueOf(pair.scopeCode, "作用域");
    const serviceCode = valueOf(pair.serviceCode || link?.serviceCode, "服务");
    return `
      <article class="service-relation-group status-${escape(pair.status || link?.status || "normal")}" style="--flow-index:${index}">
        <div class="relation-node scope-node-v2">
          <span>${escape(scopeCode)}</span>
          <strong>${escape(scopeName)}</strong>
        </div>
        <div class="flow-connector" aria-hidden="true"><span></span></div>
        <div class="relation-node service-node-v2">
          <span>${escape(statusText(pair.status || link?.status))}</span>
          <strong>${escape(serviceName)}</strong>
          <em>${escape(serviceCode)}</em>
        </div>
        <div class="service-output-panel">
          <section class="service-output-section module-output">
            <header><strong>安全技术模块</strong><em>${modules.length}</em></header>
            <div>${renderTags(modules, { empty: "暂无关联模块", className: "canvas-tag module-tag", getLabel: entityName })}</div>
          </section>
          <section class="service-output-section measure-output">
            <header><strong>安全技术措施</strong><em>${measures.length}</em></header>
            <div>${renderTags(measures, { empty: "暂无关联措施", className: "canvas-tag measure-tag", getLabel: entityName })}</div>
          </section>
        </div>
      </article>
    `;
  }

  function renderTechnical(technical = {}) {
    const pairs = list(technical.scopeServicePairs);
    const linkMap = linkByServiceKey(technical.serviceModuleMeasureLinks);
    return `
      <section class="canvas-zone technical-zone-v2">
        <div class="zone-heading">
          <span class="zone-icon">✦</span>
          <div>
            <strong>技术视角</strong>
            <p>作用域 → 安全技术服务 → 该服务自己的模块 / 措施</p>
          </div>
        </div>
        <div class="service-relation-list">
          ${pairs.length ? pairs.map((pair, index) => renderServiceGroup(pair, linkMap, index)).join("") : '<div class="canvas-empty-card">暂无作用域与服务映射</div>'}
        </div>
      </section>
    `;
  }

  function renderSecurityWorks(works = []) {
    const workRows = limited(works, 8);
    return `
      <section class="management-card-v2 security-work-card-v2">
        <header><strong>安全工作</strong><em>${workRows.total}</em></header>
        <div class="security-work-list-v2">
          ${workRows.visible.length ? workRows.visible.map((work) => `<span>${escape(entityName(work))}</span>`).join("") : '<span class="canvas-empty">暂无安全工作</span>'}
          ${workRows.more ? `<span class="is-more">+${workRows.more}</span>` : ""}
        </div>
      </section>
    `;
  }

  function renderFunctionLayer(layer, items = []) {
    const rows = list(items);
    return `
      <section class="function-layer-v2 layer-${escape(layer.tone)}">
        <header><strong>${escape(layer.label)}</strong><em>${rows.length}</em></header>
        <div class="function-layer-list-v2">
          ${rows.length ? rows.map((fn) => `<span title="${escape(entityName(fn))}">${entityCode(fn) ? `<small>${escape(entityCode(fn))}</small>` : ""}${escape(entityName(fn))}</span>`).join("") : '<span class="canvas-empty">暂无关联职能</span>'}
        </div>
      </section>
    `;
  }

  function renderWorkFunctionLayers(management = {}) {
    const byLayer = management.workFunctionsByLayer || {};
    const unknown = list(byLayer.unknown);
    const total = LAYERS.reduce((sum, layer) => sum + list(byLayer[layer.key]).length, 0) + unknown.length;
    return `
      <section class="management-card-v2 work-function-panel-v2">
        <header><strong>安全职能（四层分类）</strong><em>${total}</em></header>
        <div class="function-layer-columns-v2">
          ${LAYERS.map((layer) => renderFunctionLayer(layer, byLayer[layer.key])).join("")}
        </div>
        ${unknown.length ? `<section class="function-layer-unknown-v2"><header><strong>待确认职能</strong><em>${unknown.length}</em></header><div>${unknown.map((fn) => `<span>${escape(entityName(fn))}</span>`).join("")}</div></section>` : ""}
      </section>
    `;
  }

  function renderProcessTree(management = {}) {
    const groups = list(management.processTree);
    return `
      <section class="management-card-v2 process-panel-v2">
        <header><strong>L2 / L3 / L4 流程展开</strong><em>${groups.length} 个 L2</em></header>
        <div class="process-tree-v2">
          ${
            groups.length
              ? groups
                  .map(
                    (group, index) => `
                      <details class="process-l2-v2" ${index === 0 ? "open" : ""}>
                        <summary><strong>${escape(valueOf(group.l2ProcessGroup, "待补充"))}</strong><span>${list(group.l3Processes).length} 个 L3</span></summary>
                        <div class="process-l3-list-v2">
                          ${list(group.l3Processes)
                            .map(
                              (process, childIndex) => `
                                <details class="process-l3-v2" ${childIndex === 0 ? "open" : ""}>
                                  <summary>${escape(valueOf(process.name, "待补充"))}<span>${list(process.activities).length} 个 L4</span></summary>
                                  <div class="process-l4-list-v2">
                                    ${list(process.activities).length ? list(process.activities).map((activity) => `<span class="${activity.status === "missing" ? "is-missing" : ""}">${escape(valueOf(activity.name, "待补充"))}</span>`).join("") : '<span class="is-missing">待补充</span>'}
                                  </div>
                                </details>
                              `,
                            )
                            .join("")}
                        </div>
                      </details>
                    `,
                  )
                  .join("")
              : '<div class="canvas-empty-card">暂无流程映射</div>'
          }
        </div>
      </section>
    `;
  }

  function renderManagement(management = {}) {
    return `
      <section class="canvas-zone management-zone-v2">
        <div class="zone-heading">
          <span class="zone-icon">✧</span>
          <div>
            <strong>管理视角</strong>
            <p>安全工作 → 四层安全职能 → L2/L3/L4 流程</p>
          </div>
        </div>
        <div class="management-stack-v2">
          ${renderSecurityWorks(management.securityWorks)}
          ${renderWorkFunctionLayers(management)}
          ${renderProcessTree(management)}
        </div>
      </section>
    `;
  }

  function renderLegend() {
    return `
      <div class="canvas-legend-v2">
        <span><i class="legend-scope"></i>作用域</span>
        <span><i class="legend-service"></i>安全技术服务</span>
        <span><i class="legend-module"></i>安全技术模块</span>
        <span><i class="legend-measure"></i>安全技术措施</span>
        <span><i class="legend-work"></i>安全工作</span>
        <span><i class="legend-function"></i>安全职能</span>
        <span class="legend-line">→ 关联关系</span>
      </div>
    `;
  }

  function render({ localRelationMap }) {
    const map = localRelationMap || {};
    if (!map.focus?.id) return "";
    const pairCount = list(map.technical?.scopeServicePairs).length;
    return `
      <section class="capability-local-relation-map capability-map-v2">
        <div class="local-map-head canvas-head-v2">
          <div>
            <h3>当前关注点关系视图</h3>
            <p>以当前关注点为起点，集中展示技术落地路径与组织执行路径；映射矩阵默认折叠，仅用于明细核对。</p>
          </div>
          <span>${pairCount} 条作用域-服务映射</span>
        </div>
        <div class="local-map-canvas-v2">
          <div class="relation-board-v2">
            <div class="canvas-focus-column-v2">
            ${renderFocus(map.focus)}
            </div>
            <div class="local-map-main-grid-v2">
              ${renderTechnical(map.technical)}
              ${renderManagement(map.management)}
            </div>
          </div>
          ${renderLegend()}
        </div>
      </section>
    `;
  }

  components.CapabilityLocalRelationMap = { render };
})();
