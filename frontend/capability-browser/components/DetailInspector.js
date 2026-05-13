(function () {
  const components = (window.sapdComponents = window.sapdComponents || {});
  const utils = components.utils;
  function emptyState(title, body = "等待数据导出或选择左侧对象") {
    return `<div class="detail-empty"><strong>${utils.escapeHtml(title)}</strong><span>${utils.escapeHtml(body)}</span></div>`;
  }

  function chipList(items, empty = "暂无", limit = 8) {
    const rows = utils.list(items).filter(Boolean);
    if (!rows.length) return `<span class="empty-inline">${utils.escapeHtml(empty)}</span>`;
    const visible = rows.slice(0, limit);
    const more = rows.length - visible.length;
    return `${visible.map((item) => `<span class="relation-chip">${utils.escapeHtml(utils.titleOf(item))}</span>`).join("")}${more > 0 ? `<span class="relation-chip muted">+${more}</span>` : ""}`;
  }

  function summaryGrid(items) {
    return `
      <div class="source-entity-grid inspector-summary-grid">
        ${items.map((item) => `<div><span>${utils.escapeHtml(item.label)}</span><strong>${utils.escapeHtml(item.value)}</strong></div>`).join("")}
      </div>
    `;
  }

  function render({ detailInspector }) {
    if (!detailInspector) return emptyState("暂无对象详情");
    const technical = detailInspector.technicalSummary || {};
    const management = detailInspector.managementSummary || {};
    return `
      <section class="inspector-section">
        <div class="detail-code">${utils.escapeHtml(detailInspector.code)}</div>
        <h2 class="source-entity-title">${utils.escapeHtml(detailInspector.title)}</h2>
        <p class="source-entity-desc">${utils.escapeHtml(detailInspector.description)}</p>
      </section>

      <section class="inspector-section">
        <h3 class="section-title">技术映射摘要</h3>
        ${summaryGrid([
          { label: "作用域", value: technical.scopeCount ?? 0 },
          { label: "服务", value: technical.serviceCount ?? 0 },
          { label: "模块", value: technical.moduleCount ?? 0 },
        ])}
        <div class="source-chip-row">${chipList(detailInspector.services, "暂无服务", 8)}</div>
      </section>

      <section class="inspector-section">
        <h3 class="section-title">管理映射摘要</h3>
        ${summaryGrid([
          { label: "安全工作", value: management.securityWorkCount ?? 0 },
          { label: "L2 流程组", value: management.processGroupCount ?? 0 },
          { label: "L3 流程", value: management.processReferenceCount ?? 0 },
          { label: "L4 待补", value: management.missingActivityCount ?? 0 },
        ])}
        <div class="source-chip-row">${chipList(detailInspector.securityWorks, "暂无安全工作", 8)}</div>
      </section>

      ${components.SourceEvidencePanel ? components.SourceEvidencePanel.render(detailInspector.sourceEvidence) : ""}
    `;
  }

  components.DetailInspector = { render };
})();
