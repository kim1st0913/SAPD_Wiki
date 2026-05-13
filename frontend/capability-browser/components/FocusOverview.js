(function () {
  const components = (window.sapdComponents = window.sapdComponents || {});
  const utils = components.utils;

  function emptyState(title) {
    return `<div class="detail-empty"><strong>${utils.escapeHtml(title)}</strong><span>请选择能力或关注点</span></div>`;
  }

  function summaryGrid(items) {
    return `
      <div class="focus-overview-summary">
        ${items.map((item) => `<div><span>${utils.escapeHtml(item.label)}</span><strong>${utils.escapeHtml(item.value)}</strong></div>`).join("")}
      </div>
    `;
  }

  function renderPath(path = {}) {
    const items = [
      ["能力分类", path.category],
      ["能力域", path.domain],
      ["单一能力", path.capability],
    ].filter(([, item]) => item);
    if (!items.length) return "";
    return `
      <div class="focus-path">
        ${items.map(([label, item]) => `<span><small>${utils.escapeHtml(label)}</small><strong>${utils.escapeHtml(utils.titleOf(item))}</strong></span>`).join("")}
      </div>
    `;
  }

  function render({ focusOverview }) {
    const rows = utils.list(focusOverview?.rows);
    if (!rows.length) return emptyState("暂无关注点概览");
    const current = focusOverview.current || rows[0]?.focus;
    const selected = focusOverview.selected || current;
    const currentRow = rows.find((row) => row.focus.id === current?.id) || rows[0] || {};
    const technical = focusOverview.technicalSummary || {};
    const management = focusOverview.managementSummary || {};
    const title = focusOverview.isAggregate ? utils.titleOf(selected, "能力范围") : utils.titleOf(current, "未命名关注点");
    const code = focusOverview.isAggregate ? selected?.code || "能力范围" : current?.code || "无编码";
    const description = focusOverview.isAggregate ? "当前选择包含多个关注点，请在左侧选择一个关注点查看单点映射。" : current?.description || "暂无说明";
    return `
      <section class="focus-overview-section">
        <div class="matrix-section-head">
          <div>
            <h3>当前关注点概览</h3>
            <p>对象详情、技术映射摘要与管理映射摘要集中在主工作区顶部</p>
          </div>
          <span>${focusOverview.isAggregate ? `${rows.length} 个关注点` : current?.status || "当前关注点"}</span>
        </div>
        ${renderPath(focusOverview.path)}
        <div class="focus-overview-profile">
          <div class="focus-overview-copy">
            <div class="detail-code">${utils.escapeHtml(code)}</div>
            <h2>${utils.escapeHtml(title)}</h2>
            <p>${utils.escapeHtml(description)}</p>
          </div>
          ${summaryGrid([
            { label: "作用域", value: technical.scopeCount ?? currentRow.scopeCount ?? 0 },
            { label: "确认服务", value: technical.serviceCount ?? currentRow.serviceCount ?? 0 },
            { label: "无服务作用域", value: technical.noServiceCount ?? 0 },
            { label: "映射异常", value: technical.ambiguousCount ?? currentRow.ambiguousCount ?? 0 },
            { label: "安全工作", value: management.securityWorkCount ?? currentRow.securityWorkCount ?? 0 },
            { label: "安全职能", value: management.securityFunctionCount ?? 0 },
            { label: "L3 流程", value: management.processReferenceCount ?? currentRow.processReferenceCount ?? 0 },
          ])}
        </div>
      </section>
    `;
  }

  components.FocusOverview = { render };
})();
