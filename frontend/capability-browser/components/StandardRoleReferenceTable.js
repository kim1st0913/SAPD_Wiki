(function () {
  const components = (window.sapdComponents = window.sapdComponents || {});
  const utils = components.utils;

  function valueText(value) {
    if (value == null || value === "") return "待补充";
    if (Array.isArray(value)) return value.length ? value.map((item) => utils.titleOf(item, "待补充")).join("；") : "待补充";
    if (typeof value === "object") return utils.titleOf(value, "待补充");
    return value;
  }

  function renderChips(items, empty = "待补充") {
    const rows = utils.list(items).filter(Boolean);
    if (!rows.length) return `<span class="empty-inline">${utils.escapeHtml(empty)}</span>`;
    return rows.map((item) => `<span class="relation-chip">${utils.escapeHtml(utils.titleOf(item, "待补充"))}</span>`).join("");
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
            <td>${renderChips(row.linkedSecurityFunctions, "待确认")}</td>
            <td>${renderChips(row.linkedProcesses, "待确认")}</td>
            <td>${utils.escapeHtml(valueText(row.mappingStatus))}</td>
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
            <td>${renderChips(row.candidateSecurityFunctions, "待补充")}</td>
            <td>${utils.escapeHtml(valueText(row.matchEvidence))}</td>
            <td>${utils.escapeHtml(valueText(row.reviewStatus || row.mappingStatus))}</td>
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

  function renderTabs(activeTab, standards, roles) {
    return `
      <div class="reference-tabs" role="tablist" aria-label="岗位参考页面页签">
        <button class="reference-tab ${activeTab === "gbt" ? "active" : ""}" type="button" role="tab" data-reference-tab="gbt" aria-selected="${activeTab === "gbt"}">
          <span>GB/T 42446-2023</span>
          <strong>${utils.escapeHtml(standards.length)}</strong>
        </button>
        <button class="reference-tab ${activeTab === "gartner" ? "active" : ""}" type="button" role="tab" data-reference-tab="gartner" aria-selected="${activeTab === "gartner"}">
          <span>Gartner 工作岗位参考</span>
          <strong>${utils.escapeHtml(roles.length)}</strong>
        </button>
      </div>
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
        ${renderTabs(normalizedTab, standards, roles)}
        ${
          normalizedTab === "gartner"
            ? renderTable({
                title: "Gartner 工作岗位参考",
                empty: "暂无 Gartner 岗位参考数据。",
                headers: ["岗位来源", "岗位分类", "岗位名称", "候选安全职能", "匹配依据", "复核状态"],
                body: renderRoleRows(roles, selectedId),
              })
            : renderTable({
                title: "GB/T 42446-2023",
                empty: "暂无 GB/T 42446-2023 任务参考数据。",
                headers: ["标准来源", "任务分类", "任务名称", "关联安全职能", "关联流程", "状态"],
                body: renderStandardRows(standards, selectedId),
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
