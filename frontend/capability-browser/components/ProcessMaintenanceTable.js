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
      return `<div class="maintenance-empty-state">${utils.escapeHtml(emptyState || "暂无流程清单数据。")}</div>`;
    }
    return `
      <div class="maintenance-table-scroll">
        <table class="maintenance-data-table process-maintenance-table">
          <thead>
            <tr>
              <th>流程域</th>
              <th>L2 流程组</th>
              <th>L3 流程</th>
              <th>L4 关键活动状态</th>
              <th>描述</th>
              <th>关联关注点数</th>
              <th>关联安全职能数</th>
            </tr>
          </thead>
          <tbody>
            ${tableRows
              .map(
                (row) => `
                  <tr class="${row.id === selectedId ? "active" : ""}" data-maintenance-id="${utils.escapeHtml(row.id)}">
                    <td>${cell(row.domain)}</td>
                    <td>${cell(row.processGroup)}</td>
                    <td><strong>${cell(row.processReference)}</strong></td>
                    <td>${cell(row.l4ActivityStatus)}</td>
                    <td class="maintenance-description-cell"><span>${cell(row.description)}</span></td>
                    <td>${cell(row.relatedFocusCount)}</td>
                    <td>${cell(row.securityFunctionCount)}</td>
                  </tr>
                `,
              )
              .join("")}
          </tbody>
        </table>
      </div>
    `;
  }

  components.ProcessMaintenanceTable = { render };
})();
