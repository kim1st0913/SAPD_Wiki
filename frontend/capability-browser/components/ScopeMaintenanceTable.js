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
              <th>情景</th>
              <th>作用域编码</th>
              <th>作用域类型</th>
              <th>作用域名称</th>
              <th>描述</th>
              <th>关联技术服务数</th>
              <th>关联信息化对象数</th>
              <th>状态</th>
            </tr>
          </thead>
          <tbody>
            ${tableRows
              .map(
                (row) => `
                  <tr class="${row.id === selectedId ? "active" : ""}" data-maintenance-id="${utils.escapeHtml(row.id)}">
                    <td>${cell(row.scenario)}</td>
                    <td><strong>${cell(row.code)}</strong></td>
                    <td>${cell(row.type)}</td>
                    <td>${cell(row.title)}</td>
                    <td>${cell(row.description)}</td>
                    <td>${cell(row.serviceCount)}</td>
                    <td>${cell(row.informationObjectCount)}</td>
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

  components.ScopeMaintenanceTable = { render };
})();
