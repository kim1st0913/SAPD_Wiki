(function () {
  const components = (window.sapdComponents = window.sapdComponents || {});
  const utils = components.utils;

  function chipList(items, empty = "待补充") {
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
              <th>安全技术措施</th>
              <th>关联安全技术服务</th>
              <th>适用作用域</th>
              <th>关联信息化环境</th>
              <th>关联信息化对象</th>
            </tr>
          </thead>
          <tbody>
            ${tableRows
              .map(
                (row) => `
                  <tr class="${row.id === selectedId ? "active" : ""}" data-maintenance-id="${utils.escapeHtml(row.id)}">
                    <td>${utils.escapeHtml(displayValue(row.index))}</td>
                    <td><strong>${utils.escapeHtml(displayValue(row.measureName))}</strong></td>
                    <td>${chipList(row.serviceNames)}</td>
                    <td>${chipList(row.scopeNames)}</td>
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
