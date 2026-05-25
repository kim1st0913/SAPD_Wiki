(function () {
  const components = (window.sapdComponents = window.sapdComponents || {});
  const utils = components.utils;

  function componentChips(components = []) {
    const rows = utils.list(components);
    if (!rows.length) return `<span class="empty-inline">待补充</span>`;
    return `
      <span class="application-component-preview">
        ${rows.map((component) => `<span>${utils.escapeHtml(utils.titleOf(component, "待补充"))}</span>`).join("")}
      </span>
    `;
  }

  function render({ rows, emptyState }) {
    const dataRows = utils.list(rows);
    if (!dataRows.length) return `<div class="maintenance-empty-state">${utils.escapeHtml(emptyState || "暂无应用系统目录数据。")}</div>`;
    return `
      <div class="maintenance-table-scroll application-system-directory-scroll">
        <table class="maintenance-data-table application-system-directory-table">
          <thead>
            <tr>
              <th>应用系统</th>
              <th>定义</th>
              <th>应用组件</th>
            </tr>
          </thead>
          <tbody>
            ${dataRows
              .map(
                (row) => `
                  <tr data-maintenance-id="${utils.escapeHtml(row.id)}">
                    <td><strong>${utils.escapeHtml(row.title || "待补充")}</strong></td>
                    <td>${utils.escapeHtml(row.description || "待补充")}</td>
                    <td>${componentChips(row.components)}</td>
                  </tr>
                `,
              )
              .join("")}
          </tbody>
        </table>
      </div>
    `;
  }

  components.ApplicationSystemDirectoryTable = { render };
})();
