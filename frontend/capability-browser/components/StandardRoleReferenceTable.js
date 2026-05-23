(function () {
  const components = (window.sapdComponents = window.sapdComponents || {});
  const utils = components.utils;

  function valueText(value) {
    if (value == null || value === "") return "待补充";
    if (Array.isArray(value)) return value.length ? value.map((item) => utils.titleOf(item, "待补充")).join("；") : "待补充";
    if (typeof value === "object") return utils.titleOf(value, "待补充");
    return value;
  }

  function groupId(parts) {
    return parts
      .map((part) =>
        utils
          .text(part)
          .trim()
          .replace(/[^\w\u4e00-\u9fa5-]+/g, "-")
          .replace(/^-+|-+$/g, ""),
      )
      .filter(Boolean)
      .join("-");
  }

  function groupedByCategory(rows, fallbackLabel) {
    const groups = [];
    const groupMap = new Map();
    for (const row of utils.list(rows)) {
      const label = utils.text(row.category || "").trim() || fallbackLabel;
      if (!groupMap.has(label)) {
        const group = { label, rows: [] };
        groups.push(group);
        groupMap.set(label, group);
      }
      groupMap.get(label).rows.push(row);
    }
    return groups;
  }

  function renderStandardDetailRows(rows, selectedId) {
    return rows
      .map(
        (row) => `
          <tr class="maintenance-data-row reference-group-detail ${row.id === selectedId ? "active" : ""}" data-maintenance-id="${utils.escapeHtml(row.id)}">
            <td><strong>${utils.escapeHtml(valueText(row.title))}</strong></td>
          </tr>
        `,
      )
      .join("");
  }

  function renderRoleDetailRows(rows, selectedId) {
    return rows
      .map(
        (row) => `
          <tr class="maintenance-data-row reference-group-detail ${row.id === selectedId ? "active" : ""}" data-maintenance-id="${utils.escapeHtml(row.id)}">
            <td><strong>${utils.escapeHtml(valueText(row.title))}</strong></td>
            <td class="maintenance-description-cell"><span>${utils.escapeHtml(valueText(row.description))}</span></td>
          </tr>
        `,
      )
      .join("");
  }

  function renderGroupedPanels(rows, selectedId, options) {
    const groups = groupedByCategory(rows, options.fallbackLabel);
    const hasSelectedRow = utils.list(rows).some((row) => row.id === selectedId);
    return groups
      .map((group, groupIndex) => {
        const referenceGroupId = groupId([options.idPrefix, groupIndex, group.label]);
        const groupHasSelected = group.rows.some((row) => row.id === selectedId);
        const expanded = hasSelectedRow ? groupHasSelected : groupIndex === 0;
        return `
          <details class="reference-category-panel" data-reference-group="${utils.escapeHtml(referenceGroupId)}" ${expanded ? "open" : ""}>
            <summary>
              <span class="reference-category-caret">›</span>
              <strong>${utils.escapeHtml(group.label)}</strong>
              <em>${utils.escapeHtml(`${group.rows.length} ${options.countUnit}`)}</em>
            </summary>
            <div class="maintenance-table-scroll reference-group-table-scroll">
              <table class="maintenance-data-table reference-group-table ${utils.escapeHtml(options.tableClass)}">
                <thead>
                  <tr>${options.headers.map((header) => `<th>${utils.escapeHtml(header)}</th>`).join("")}</tr>
                </thead>
                <tbody>${options.renderDetails(group.rows, selectedId)}</tbody>
              </table>
            </div>
          </details>
        `;
      })
      .join("");
  }

  function renderTable({ title, empty, body }) {
    return `
      <section class="reference-table-section">
        <h3 class="reference-section-title">${utils.escapeHtml(title)}</h3>
        ${
          body
            ? `<div class="reference-group-list">${body}</div>`
            : `<div class="maintenance-empty-state">${utils.escapeHtml(empty)}</div>`
        }
      </section>
    `;
  }

  function render({ standardRows, roleRows, selectedId, emptyState, activeTab = "gbt" }) {
    const standards = utils.list(standardRows);
    const roles = utils.list(roleRows);
    if (!standards.length && !roles.length) {
      return `<div class="maintenance-empty-state">${utils.escapeHtml(emptyState || "暂无岗位参考页面数据，请确认 ETL 是否已导出 gbt_42446_references 与 gartner_roles。")}</div>`;
    }
    const normalizedTab = activeTab === "gartner" ? "gartner" : "gbt";
    return `
      <div class="reference-table-stack">
        ${
          normalizedTab === "gartner"
            ? renderTable({
                title: "Gartner 工作岗位参考",
                empty: "暂无 Gartner 岗位参考数据。",
                body: renderGroupedPanels(roles, selectedId, {
                  idPrefix: "gartner-role-category",
                  fallbackLabel: "未分组岗位分类",
                  countUnit: "个角色",
                  headers: ["角色", "描述"],
                  tableClass: "role-reference-maintenance-table",
                  renderDetails: renderRoleDetailRows,
                }),
              })
            : renderTable({
                title: "GB/T 42446-2023",
                empty: "暂无 GB/T 42446-2023 任务参考数据。",
                body: renderGroupedPanels(standards, selectedId, {
                  idPrefix: "gbt-work-category",
                  fallbackLabel: "未分组工作类别",
                  countUnit: "项工作任务",
                  headers: ["承担的工作任务"],
                  tableClass: "standard-reference-maintenance-table",
                  renderDetails: renderStandardDetailRows,
                }),
              })
        }
      </div>
    `;
  }

  components.StandardRoleReferenceTable = { render };

  function securityWorkCell(value) {
    return utils.escapeHtml(valueText(value));
  }

  function renderSecurityWorkTable({ rows, selectedId, emptyState }) {
    const tableRows = utils.list(rows);
    if (!tableRows.length) {
      return `<div class="maintenance-empty-state">${utils.escapeHtml(emptyState || "暂无安全工作数据。")}</div>`;
    }
    return `
      <div class="maintenance-table-scroll">
        <table class="maintenance-data-table security-work-table">
          <thead>
            <tr>
              <th>序号</th>
              <th>安全工作编码</th>
              <th>安全工作名称</th>
              <th>关联安全能力</th>
              <th>关联关注点</th>
              <th>状态</th>
            </tr>
          </thead>
          <tbody>
            ${tableRows
              .map(
                (row) => `
                  <tr class="${row.id === selectedId ? "active" : ""}" data-maintenance-id="${utils.escapeHtml(row.id)}">
                    <td>${securityWorkCell(row.index)}</td>
                    <td><strong>${securityWorkCell(row.displayCode)}</strong></td>
                    <td>${securityWorkCell(row.title)}</td>
                    <td>${securityWorkCell(utils.titleOf(row.capability, "待补充"))}</td>
                    <td>${securityWorkCell([row.focusCode, row.focusTitle].filter(Boolean).join(" ") || "待补充")}</td>
                    <td>${securityWorkCell(row.status)}</td>
                  </tr>
                `,
              )
              .join("")}
          </tbody>
        </table>
      </div>
    `;
  }

  components.SecurityWorkMaintenanceTable = { render: renderSecurityWorkTable };
})();
