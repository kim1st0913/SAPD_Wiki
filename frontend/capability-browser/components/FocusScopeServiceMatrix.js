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

  function exceptionDetails(row) {
    if (row.exceptionType !== "ambiguous_service_mapping") return "";
    return `
      <div class="mapping-exception">
        <details>
          <summary>候选服务 ${utils.list(row.candidateServices).length}</summary>
          <div class="source-chip-row">${chipList(row.candidateServices, "暂无候选服务", 8)}</div>
          <p>${utils.escapeHtml(row.exceptionMessage || "需要后端/ETL确认")}</p>
        </details>
      </div>
    `;
  }

  function render({ rows }) {
    const mappingRows = utils.list(rows);
    return `
      <section class="semantic-panel technical-mapping-section">
        <div class="matrix-section-head">
          <div>
            <h3>技术视角映射矩阵</h3>
            <p>关注点 × 作用域 → 安全技术服务 → 安全技术模块/措施</p>
          </div>
          <span>${mappingRows.length} 条映射</span>
        </div>
        <div class="relationship-matrix-scroll semantic-scroll">
          <table class="semantic-mapping-table">
            <thead>
              <tr>
                <th>作用域</th>
                <th>安全技术服务</th>
                <th>技术模块/措施</th>
              </tr>
            </thead>
            <tbody>
              ${mappingRows
                .map(
                  (row) => `
                    <tr data-capability-id="${utils.escapeHtml(row.focus.id)}">
                      <td><strong>${utils.escapeHtml(row.scope.code || "")}</strong><span>${utils.escapeHtml(row.scope.title)}</span></td>
                      <td>${row.status === "ambiguous_service_mapping" ? `<span class="missing-pill">映射异常</span>${exceptionDetails(row)}` : chipList(row.services, "无适用服务")}</td>
                      <td>${row.status === "ambiguous_service_mapping" ? '<span class="empty-inline">待确认</span>' : chipList(row.modules, row.status === "no_service" ? "不适用" : "暂无模块")}</td>
                    </tr>
                  `,
                )
                .join("") || '<tr><td colspan="3"><div class="reference-empty">暂无技术映射</div></td></tr>'}
            </tbody>
          </table>
        </div>
      </section>
    `;
  }

  components.FocusScopeServiceMatrix = { render };
})();
