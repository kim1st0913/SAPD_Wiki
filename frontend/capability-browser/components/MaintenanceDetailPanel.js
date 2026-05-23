(function () {
  const components = (window.sapdComponents = window.sapdComponents || {});
  const utils = components.utils;

  function chipList(items, empty = "暂无") {
    const rows = utils.list(items).filter(Boolean);
    if (!rows.length) return `<span class="empty-inline">${utils.escapeHtml(empty)}</span>`;
    return rows.map((item) => `<span class="relation-chip">${utils.escapeHtml(utils.titleOf(item))}</span>`).join("");
  }

  function valueText(value, empty = "待补充") {
    if (value == null || value === "") return empty;
    if (typeof value === "number" && Number.isNaN(value)) return empty;
    if (typeof value === "object") return utils.titleOf(value, empty);
    const normalized = utils.text(value).trim();
    return normalized && normalized !== "[object Object]" ? normalized : empty;
  }

  function render({ detailPanel }) {
    if (!detailPanel) {
      return `
        <div class="detail-empty"><strong>请选择专项对象</strong><span>左侧表格选择一行后展示详情。</span></div>
      `;
    }
    return `
      <div class="source-entity-code">${utils.escapeHtml(detailPanel.code || detailPanel.type || "专项对象")}</div>
      <h2 class="source-entity-title">${utils.escapeHtml(detailPanel.title || "未命名")}</h2>
      <p class="source-entity-desc">${utils.escapeHtml(detailPanel.description || "暂无说明")}</p>
      <div class="source-entity-grid maintenance-detail-grid">
        ${utils
          .list(detailPanel.facts)
          .map((fact) => `<div><span>${utils.escapeHtml(fact.label)}</span><strong>${utils.escapeHtml(valueText(fact.value))}</strong></div>`)
          .join("")}
      </div>
      ${utils
        .list(detailPanel.sections)
        .map(
          (section) => `
            <h3 class="section-title">${utils.escapeHtml(section.title)}</h3>
            <div class="source-chip-row">${chipList(section.items)}</div>
          `,
        )
        .join("")}
    `;
  }

  components.MaintenanceDetailPanel = { render };
})();
