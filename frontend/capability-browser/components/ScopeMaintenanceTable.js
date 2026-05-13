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
      return `<div class="maintenance-empty-state">${utils.escapeHtml(emptyState || "暂无作用域数据。")}</div>`;
    }
    return `
      <div class="maintenance-table-scroll">
        <table class="maintenance-data-table">
          <thead>
            <tr>
              <th>序号</th>
              <th>情景</th>
              <th>作用域编码</th>
              <th>作用域名称</th>
              <th>描述</th>
            </tr>
          </thead>
          <tbody>
            ${tableRows
              .map(
                (row, index) => `
                  <tr class="${row.id === selectedId ? "active" : ""}" data-maintenance-id="${utils.escapeHtml(row.id)}">
                    <td>${cell(index + 1)}</td>
                    <td>${cell(row.scenario)}</td>
                    <td><strong>${cell(row.code)}</strong></td>
                    <td>${cell(row.title)}</td>
                    <td>${cell(row.description)}</td>
                  </tr>
                `,
              )
              .join("")}
          </tbody>
        </table>
      </div>
    `;
  }

  components.ScopeMaintenanceTable = { render };
})();
