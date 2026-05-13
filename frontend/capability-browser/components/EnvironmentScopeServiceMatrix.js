(function () {
  const components = (window.sapdComponents = window.sapdComponents || {});
  const utils = components.utils;

  function chipList(items, empty = "暂无", limit = 4) {
    const rows = utils.list(items).filter(Boolean);
    if (!rows.length) return `<span class="empty-inline">${utils.escapeHtml(empty)}</span>`;
    const visible = rows.slice(0, limit);
    const more = rows.length - visible.length;
    return `${visible.map((item) => `<span class="relation-chip">${utils.escapeHtml(utils.titleOf(item))}</span>`).join("")}${more > 0 ? `<span class="relation-chip muted">+${more}</span>` : ""}`;
  }

  function statusTone(status) {
    if (status === "已覆盖") return "ok";
    if (status === "模块待补充") return "warning";
    return "neutral";
  }

  function render({ rows, showObjectColumn = false, selectedRowId = "" }) {
    const mappingRows = utils.list(rows);
    const colspan = showObjectColumn ? 6 : 5;
    const statusBadge = components.StatusBadge;
    return `
      <section class="semantic-panel environment-mapping-section">
        <div class="matrix-section-head">
          <div>
            <h3>环境视角映射表</h3>
            <p>信息化对象 × 安全作用域 → 安全技术服务 → 安全技术模块/措施</p>
          </div>
          <span>${mappingRows.length} 条映射</span>
        </div>
        <div class="relationship-matrix-scroll semantic-scroll">
          <table class="semantic-mapping-table environment-mapping-table">
            <thead>
              <tr>
                ${showObjectColumn ? "<th>信息化对象</th>" : ""}
                <th>安全作用域</th>
                <th>安全技术服务</th>
                <th>安全技术模块/措施</th>
                <th>覆盖状态</th>
                <th>说明</th>
              </tr>
            </thead>
            <tbody>
              ${mappingRows
                .map(
                  (row) => `
                    <tr class="${row.id === selectedRowId ? "active" : ""}" data-environment-row-id="${utils.escapeHtml(row.id || row.scope?.id || "")}">
                      ${showObjectColumn ? `<td><strong>${utils.escapeHtml(row.object?.code || "")}</strong><span>${utils.escapeHtml(row.object?.title || "未命名对象")}</span></td>` : ""}
                      <td><strong>${utils.escapeHtml(row.scope?.code || "")}</strong><span>${utils.escapeHtml(row.scope?.title || "未命名作用域")}</span></td>
                      <td>${chipList(row.services, "无适用服务")}</td>
                      <td>${chipList(row.modules, row.services?.length ? "待补充" : "不适用")}</td>
                      <td>${statusBadge ? statusBadge.render({ label: "状态", value: row.coverageStatus || "待确认", tone: statusTone(row.coverageStatus) }) : utils.escapeHtml(row.coverageStatus || "待确认")}</td>
                      <td>${utils.escapeHtml(row.note || "暂无说明")}</td>
                    </tr>
                  `,
                )
                .join("") || `<tr><td colspan="${colspan}"><div class="reference-empty">暂无环境映射</div></td></tr>`}
            </tbody>
          </table>
        </div>
      </section>
    `;
  }

  components.EnvironmentScopeServiceMatrix = { render };
})();
