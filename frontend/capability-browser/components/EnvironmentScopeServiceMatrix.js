(function () {
  const components = (window.sapdComponents = window.sapdComponents || {});
  const utils = components.utils;

  function chipList(items, empty = "暂无", limit = 4) {
    const rows = utils.list(items).filter(Boolean);
    if (!rows.length) return `<span class="empty-inline">${utils.escapeHtml(empty)}</span>`;
    const visible = rows.slice(0, limit);
    const more = rows.length - visible.length;
    return `${visible
      .map((item) => {
        const kind = item.kind || item.objectKind || "";
        return `<span class="relation-chip ${kind.includes("措施") ? "measure-chip" : kind.includes("说明") ? "note-chip" : ""}">${kind ? `<em>${utils.escapeHtml(kind)}</em>` : ""}${utils.escapeHtml(utils.titleOf(item))}</span>`;
      })
      .join("")}${more > 0 ? `<span class="relation-chip muted">+${more}</span>` : ""}`;
  }

  function render({ rows, showObjectColumn = false, selectedRowId = "" }) {
    const mappingRows = utils.list(rows);
    const colspan = showObjectColumn ? 5 : 3;
    return `
      <section class="semantic-panel environment-mapping-section">
        <div class="matrix-section-head">
          <div>
            <h3>环境视角映射表</h3>
            <p>信息化环境 → 环境子类 → 信息化对象 → 安全作用域 → 安全技术服务 → 安全技术模块/措施</p>
          </div>
          <span>${mappingRows.length} 条映射</span>
        </div>
        <div class="relationship-matrix-scroll semantic-scroll">
          <table class="semantic-mapping-table environment-mapping-table">
            <thead>
              <tr>
                ${showObjectColumn ? "<th>环境子类</th><th>信息化对象</th>" : ""}
                <th>安全作用域</th>
                <th>安全技术服务</th>
                <th>安全技术模块/措施</th>
              </tr>
            </thead>
            <tbody>
              ${mappingRows
                .map(
                  (row) => `
                    <tr class="${row.id === selectedRowId ? "active" : ""}" data-environment-row-id="${utils.escapeHtml(row.id || row.scope?.id || "")}">
                      ${showObjectColumn ? `<td>${chipList(row.segments, "未定义环境子类", 2)}</td>` : ""}
                      ${showObjectColumn ? `<td><strong>${utils.escapeHtml(row.object?.code || "")}</strong><span>${utils.escapeHtml(row.object?.title || "未命名对象")}</span></td>` : ""}
                      <td><strong>${utils.escapeHtml(row.scope?.code || "")}</strong><span>${utils.escapeHtml(row.scope?.title || "未命名作用域")}</span></td>
                      <td>${chipList(row.services, "无适用服务")}</td>
                      <td>${chipList(row.modules, row.services?.length ? "待补充" : "不适用")}</td>
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
