(function () {
  const components = (window.sapdComponents = window.sapdComponents || {});
  const utils = components.utils;

  function valueText(value) {
    if (value == null || value === "") return "待补充";
    return value;
  }

  function render({ rows, selectedId, emptyState }) {
    const tableRows = utils.list(rows);
    if (!tableRows.length) {
      return `<div class="maintenance-empty-state">${utils.escapeHtml(emptyState || "暂无安全技术模块数据，请确认 ETL 是否已导出 security_technology_modules。")}</div>`;
    }
    return `
      <div class="maintenance-table-scroll">
        <table class="maintenance-data-table">
          <thead>
            <tr>
              <th>模块分类</th>
              <th>安全技术模块</th>
              <th>关联安全技术服务数</th>
              <th>关联安全技术措施数</th>
              <th>关联作用域数</th>
              <th>关联信息化对象数</th>
            </tr>
          </thead>
          <tbody>
            ${tableRows
              .map(
                (row) => `
                  <tr class="${row.id === selectedId ? "active" : ""}" data-maintenance-id="${utils.escapeHtml(row.id)}">
                    <td>${utils.escapeHtml(valueText(row.category))}</td>
                    <td><strong>${utils.escapeHtml(valueText(row.title))}</strong></td>
                    <td>${utils.escapeHtml(valueText(row.serviceCount))}</td>
                    <td>${utils.escapeHtml(valueText(row.measureCount))}</td>
                    <td>${utils.escapeHtml(valueText(row.scopeCount))}</td>
                    <td>${utils.escapeHtml(valueText(row.informationObjectCount))}</td>
                  </tr>
                `,
              )
              .join("")}
          </tbody>
        </table>
      </div>
    `;
  }

  components.TechnologyModuleMaintenanceTable = { render };
})();
