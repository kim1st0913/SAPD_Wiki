(function () {
  const components = (window.sapdComponents = window.sapdComponents || {});
  const utils = components.utils;

  function cell(value) {
    const text = value == null || value === "" ? "待补充" : value;
    return utils.escapeHtml(text);
  }

  function render({ rows, selectedId, emptyState }) {
    const tableRows = utils.list(rows);
    if (!tableRows.length) {
      return `<div class="maintenance-empty-state">${utils.escapeHtml(emptyState || "暂无职能清单数据。")}</div>`;
    }
    return `
      <div class="maintenance-table-scroll">
        <table class="maintenance-data-table">
          <thead>
            <tr>
              <th>安全职能层</th>
              <th>职能组</th>
              <th>安全职能编码</th>
              <th>安全职能名称</th>
              <th>定义</th>
              <th>关联安全工作数</th>
              <th>关联流程数</th>
              <th>状态</th>
            </tr>
          </thead>
          <tbody>
            ${tableRows
              .map(
                (row) => `
                  <tr class="${row.id === selectedId ? "active" : ""}" data-maintenance-id="${utils.escapeHtml(row.id)}">
                    <td>${cell(row.securityFunctionLayer)}</td>
                    <td>${cell(row.functionGroup)}</td>
                    <td><strong>${cell(row.code)}</strong></td>
                    <td>${cell(row.title)}</td>
                    <td>${cell(row.description)}</td>
                    <td>${cell(row.securityWorkCount)}</td>
                    <td>${cell(row.processCount)}</td>
                    <td><span class="relation-chip">${cell(row.status)}</span></td>
                  </tr>
                `,
              )
              .join("")}
          </tbody>
        </table>
      </div>
    `;
  }

  components.WorkFunctionMaintenanceTable = { render };
})();
