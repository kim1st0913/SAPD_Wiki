(function () {
  const components = (window.sapdComponents = window.sapdComponents || {});
  const utils = components.utils;
  const display = window.sapdDisplay || {};

  function chipList(items, empty = "待补充") {
    if (display.relationChipList) return display.relationChipList(utils, items, { empty, preferCodeTitle: false });
    const rows = utils.list(items).filter(Boolean);
    if (!rows.length) return `<span class="empty-inline">${utils.escapeHtml(empty)}</span>`;
    return rows.map((item) => `<span class="relation-chip">${utils.escapeHtml(displayValue(item, empty))}</span>`).join("");
  }

  function displayValue(value, empty = "待补充") {
    if (value == null || value === "") return empty;
    if (typeof value === "number" && Number.isNaN(value)) return empty;
    const raw = typeof value === "object" ? utils.titleOf(value, empty) : value;
    const normalized = utils.text(raw).trim();
    return normalized && normalized !== "[object Object]" ? normalized : empty;
  }

  function render({ rows, selectedId, emptyState }) {
    const tableRows = utils.list(rows);
    if (!tableRows.length) {
      return `<div class="maintenance-empty-state">${utils.escapeHtml(emptyState || "暂无安全技术措施数据，请确认 ETL 是否已导出 security_technical_measures。")}</div>`;
    }
    return `
      <div class="maintenance-table-scroll">
        <table class="maintenance-data-table technical-measure-maintenance-table">
          <thead>
            <tr>
              <th>序号</th>
              <th>${utils.escapeHtml(display.label?.("security_technical_measure", "安全技术措施") || "安全技术措施")}</th>
              <th>来源标签</th>
              <th>${utils.escapeHtml(display.relationLabel?.("security_technical_service") || "关联安全技术服务")}</th>
              <th>${utils.escapeHtml(display.relationLabel?.("scope_type") || "关联作用域")}</th>
              <th>${utils.escapeHtml(display.relationLabel?.("information_environment") || "关联信息化环境")}</th>
              <th>${utils.escapeHtml(display.relationLabel?.("information_object") || "关联信息化对象")}</th>
            </tr>
          </thead>
          <tbody>
            ${tableRows
              .map(
                (row) => `
                  <tr class="${row.id === selectedId ? "active" : ""}" data-maintenance-id="${utils.escapeHtml(row.id)}">
                    <td>${utils.escapeHtml(displayValue(row.index))}</td>
                    <td>
                      <strong>${utils.escapeHtml(displayValue(row.measureName))}</strong>
                      ${row.mappingStatusLabel ? `<span class="maintenance-cell-note">${utils.escapeHtml(row.mappingStatusLabel)}</span>` : ""}
                    </td>
                    <td>${utils.escapeHtml(displayValue(row.sourceLabel))}</td>
                    <td>${chipList(row.serviceNames, row.serviceEmptyText || "待补充关联安全技术服务")}</td>
                    <td>${chipList(row.scopeNames, row.scopeEmptyText || "待补充关联作用域")}</td>
                    <td>${chipList(row.environmentNames)}</td>
                    <td>${chipList(row.environmentObjectNames)}</td>
                  </tr>
                `,
              )
              .join("")}
          </tbody>
        </table>
      </div>
    `;
  }

  components.TechnicalMeasureMaintenanceTable = { render };
})();
