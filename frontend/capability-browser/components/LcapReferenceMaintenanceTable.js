(function () {
  const components = (window.sapdComponents = window.sapdComponents || {});
  const utils = components.utils;
  const display = window.sapdDisplay || {};

  function annotationAttrs(value) {
    return display.annotationValueAttrs?.(utils, value) || "";
  }

  function chipList(items, empty = "待补充") {
    const rows = utils.list(items).filter(Boolean);
    if (!rows.length) return `<span class="empty-inline">${utils.escapeHtml(empty)}</span>`;
    return rows
      .map((item) => {
        const label = utils.titleOf(item);
        return `<span class="relation-chip"${annotationAttrs(label)}><span class="relation-chip-text">${utils.escapeHtml(label)}</span></span>`;
      })
      .join("");
  }

  function renderSoftwareRows(rows) {
    const dataRows = utils.list(rows);
    return `
      <section class="reference-table-section">
        <div class="matrix-section-head">
          <div>
            <h3>软件开发类型</h3>
            <p>仅作为 LC-AP安全开发生命周期页面参考数据。</p>
          </div>
          <span>${dataRows.length} 项</span>
        </div>
        <table class="matrix-table maintenance-table">
          <thead>
            <tr>
              <th>序号</th>
              <th>软件开发类型</th>
              <th>说明</th>
            </tr>
          </thead>
          <tbody>
            ${
              dataRows
                .map(
                  (row, index) => `
                    <tr data-maintenance-id="${utils.escapeHtml(row.id)}">
                      <td>${index + 1}</td>
                      <td><strong>${utils.escapeHtml(row.title)}</strong></td>
                      <td>${utils.escapeHtml(row.description)}</td>
                    </tr>
                  `,
                )
                .join("") || `<tr><td colspan="3"><div class="maintenance-empty-state">暂无软件开发类型</div></td></tr>`
            }
          </tbody>
        </table>
      </section>
    `;
  }

  function renderApplicationRows(rows) {
    const dataRows = utils.list(rows);
    return `
      <section class="reference-table-section">
        <div class="matrix-section-head">
          <div>
            <h3>应用系统类型 / 应用组件</h3>
            <p>应用组件按应用系统类型归组展示，不作为正式映射关系。</p>
          </div>
          <span>${dataRows.length} 类</span>
        </div>
        <table class="matrix-table maintenance-table">
          <thead>
            <tr>
              <th>序号</th>
              <th>应用系统类型</th>
              <th>说明</th>
              <th>应用组件</th>
            </tr>
          </thead>
          <tbody>
            ${
              dataRows
                .map(
                  (row, index) => `
                    <tr data-maintenance-id="${utils.escapeHtml(row.id)}">
                      <td>${index + 1}</td>
                      <td><strong>${utils.escapeHtml(row.title)}</strong></td>
                      <td>${utils.escapeHtml(row.description)}</td>
                      <td>${chipList(row.components, "待补充")}</td>
                    </tr>
                  `,
                )
                .join("") || `<tr><td colspan="4"><div class="maintenance-empty-state">暂无应用系统类型 / 应用组件</div></td></tr>`
            }
          </tbody>
        </table>
      </section>
    `;
  }

  function render({ softwareRows, applicationRows, emptyState }) {
    const hasRows = utils.list(softwareRows).length || utils.list(applicationRows).length;
    if (!hasRows) return `<div class="maintenance-empty-state">${utils.escapeHtml(emptyState || "暂无 LC-AP 参考数据。")}</div>`;
    return `
      <div class="reference-table-stack">
        ${renderSoftwareRows(softwareRows)}
        ${renderApplicationRows(applicationRows)}
      </div>
    `;
  }

  components.LcapReferenceMaintenanceTable = { render };
})();
