(function () {
  const components = (window.sapdComponents = window.sapdComponents || {});
  const utils = components.utils;

  function displayValue(value, empty = "待补充") {
    if (value == null || value === "") return empty;
    if (typeof value === "number" && Number.isNaN(value)) return empty;
    const raw = typeof value === "object" ? utils.codeTitleOf(value, empty) : value;
    const normalized = utils.text(raw).trim();
    return normalized && normalized !== "[object Object]" ? normalized : empty;
  }

  function chipList(items, empty = "待补充") {
    const rows = utils.list(items).filter(Boolean);
    if (!rows.length) return `<span class="empty-inline">${utils.escapeHtml(empty)}</span>`;
    return rows.map((item) => `<span class="relation-chip technical-chip">${utils.escapeHtml(displayValue(item, empty))}</span>`).join("");
  }

  function groupId(value) {
    return utils
      .text(value)
      .trim()
      .replace(/[^\w\u4e00-\u9fa5-]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  function renderServiceRow(row, selectedId, parentId) {
    return `
      <tr class="maintenance-data-row standard-group-detail ${row.id === selectedId ? "active" : ""}" data-standard-parent="${utils.escapeHtml(parentId)}" data-standard-lineage="${utils.escapeHtml(parentId)}" data-maintenance-id="${utils.escapeHtml(row.id)}">
        <td>${utils.escapeHtml(displayValue(row.index))}</td>
        <td>
          <strong>${utils.escapeHtml(displayValue(row.serviceLabel))}</strong>
        </td>
        <td>${utils.escapeHtml(displayValue(row.definition))}</td>
        <td>${chipList(row.ownershipFocuses, "待补充安全能力/关注点")}</td>
        <td>${chipList(row.linkedModules, "待补充模块")}</td>
        <td>${chipList(row.linkedSystems, "待补充安全系统")}</td>
        <td>${chipList(row.linkedEnvironments, "待补充环境")}</td>
      </tr>
    `;
  }

  function renderGroupedRows(rows, scopeGroups, selectedId) {
    const groups = utils.list(scopeGroups).length ? utils.list(scopeGroups) : [{ id: "ungrouped", label: "全部服务", count: utils.list(rows).length, rows }];
    return groups
      .map((group, index) => {
        const id = groupId(`technical-service-scope-${index}-${group.id || group.label}`);
        const expanded = true;
        const serviceRows = utils.list(group.rows);
        return `
          <tr class="standard-group-row service-scope-table-group depth-0 ${expanded ? "expanded" : ""}" data-standard-group="${utils.escapeHtml(id)}">
            <td colspan="7">
              <button class="standard-group-toggle" type="button" aria-expanded="${expanded ? "true" : "false"}">
                <span class="standard-group-caret">›</span>
                  <span class="standard-group-main">
                  <strong>${utils.escapeHtml(group.label || "待补充作用域")}</strong>
                  <span class="standard-group-description">组内按安全能力 / 关注点顺序排列</span>
                </span>
                <em>${utils.escapeHtml(`${group.count ?? serviceRows.length} 项服务`)}</em>
              </button>
            </td>
          </tr>
          ${serviceRows.map((row) => renderServiceRow(row, selectedId, id)).join("")}
        `;
      })
      .join("");
  }

  function render({ rows, scopeGroups, selectedId, emptyState }) {
    const tableRows = utils.list(rows);
    if (!tableRows.length) {
      return `<div class="maintenance-empty-state">${utils.escapeHtml(emptyState || "暂无安全技术服务数据，请确认 ETL 是否已导出 security_technical_services。")}</div>`;
    }
    return `
      <div class="maintenance-table-scroll">
        <table class="maintenance-data-table technical-service-maintenance-table">
          <thead>
            <tr>
              <th>序号</th>
              <th>安全技术服务</th>
              <th>定义</th>
              <th>归属安全能力-关注点</th>
              <th>关联安全技术模块/措施</th>
              <th>关联安全系统</th>
              <th>关联信息化环境</th>
            </tr>
          </thead>
          <tbody>
            ${renderGroupedRows(tableRows, scopeGroups, selectedId)}
          </tbody>
        </table>
      </div>
    `;
  }

  components.TechnicalServiceMaintenanceTable = { render };
})();
