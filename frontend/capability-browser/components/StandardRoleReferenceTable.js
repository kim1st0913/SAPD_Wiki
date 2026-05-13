(function () {
  const components = (window.sapdComponents = window.sapdComponents || {});
  const utils = components.utils;

  function valueText(value) {
    if (value == null || value === "") return "待补充";
    return value;
  }

  function renderStandardRows(rows, selectedId) {
    return utils
      .list(rows)
      .map(
        (row) => `
          <tr class="${row.id === selectedId ? "active" : ""}" data-maintenance-id="${utils.escapeHtml(row.id)}">
            <td>${utils.escapeHtml(valueText(row.source))}</td>
            <td>${utils.escapeHtml(valueText(row.category))}</td>
            <td><strong>${utils.escapeHtml(valueText(row.title))}</strong></td>
            <td>${utils.escapeHtml(valueText(row.description))}</td>
            <td>${utils.escapeHtml(valueText(row.linkedSecurityFunctions))}</td>
            <td>${utils.escapeHtml(valueText(row.linkedProcesses))}</td>
          </tr>
        `,
      )
      .join("");
  }

  function renderRoleRows(rows, selectedId) {
    return utils
      .list(rows)
      .map(
        (row) => `
          <tr class="${row.id === selectedId ? "active" : ""}" data-maintenance-id="${utils.escapeHtml(row.id)}">
            <td>${utils.escapeHtml(valueText(row.source))}</td>
            <td>${utils.escapeHtml(valueText(row.category))}</td>
            <td><strong>${utils.escapeHtml(valueText(row.title))}</strong></td>
            <td>${utils.escapeHtml(valueText(row.description))}</td>
            <td>${utils.escapeHtml(valueText(row.linkedSecurityFunctions))}</td>
            <td>${utils.escapeHtml(valueText(row.linkedProcesses))}</td>
          </tr>
        `,
      )
      .join("");
  }

  function renderTable({ title, empty, headers, body }) {
    return `
      <section class="reference-table-section">
        <h3 class="reference-section-title">${utils.escapeHtml(title)}</h3>
        ${
          body
            ? `
              <div class="maintenance-table-scroll">
                <table class="maintenance-data-table">
                  <thead>
                    <tr>${headers.map((header) => `<th>${utils.escapeHtml(header)}</th>`).join("")}</tr>
                  </thead>
                  <tbody>${body}</tbody>
                </table>
              </div>
            `
            : `<div class="maintenance-empty-state">${utils.escapeHtml(empty)}</div>`
        }
      </section>
    `;
  }

  function render({ standardRows, roleRows, selectedId, emptyState }) {
    const standards = utils.list(standardRows);
    const roles = utils.list(roleRows);
    if (!standards.length && !roles.length) {
      return `<div class="maintenance-empty-state">${utils.escapeHtml(emptyState || "暂无标准与岗位参考数据，请确认 ETL 是否已导出 gbt_42446_references 与 gartner_roles。")}</div>`;
    }
    return `
      <div class="reference-table-stack">
        ${renderTable({
          title: "标准任务参考",
          empty: "暂无 GB/T 42446 任务参考数据。",
          headers: ["标准来源", "任务分类", "任务名称", "任务说明", "关联安全职能", "关联流程"],
          body: renderStandardRows(standards, selectedId),
        })}
        ${renderTable({
          title: "岗位参考",
          empty: "暂无 Gartner 岗位参考数据。",
          headers: ["岗位来源", "岗位分类", "岗位名称", "岗位说明", "关联安全职能", "关联流程"],
          body: renderRoleRows(roles, selectedId),
        })}
      </div>
    `;
  }

  components.StandardRoleReferenceTable = { render };
})();
