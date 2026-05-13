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

  function functionList(stakeholders) {
    const rows = utils.list(stakeholders).filter(Boolean);
    if (!rows.length) return `<span class="empty-inline">暂无安全职能</span>`;
    return rows
      .slice(0, 5)
      .map(
        (stakeholder) => `
          <span class="function-chip">
            ${utils.escapeHtml(utils.titleOf(stakeholder, "未命名职能"))}
            ${stakeholder.layer ? `<small>${utils.escapeHtml(stakeholder.layer)}</small>` : ""}
          </span>
        `,
      )
      .join("");
  }

  function activityList(row) {
    if (row.hasMissingActivity && !utils.list(row.activities).length) return '<span class="missing-pill">待补充</span>';
    return chipList(row.activities, "待补充", 4);
  }

  function render({ rows }) {
    const mappingRows = utils.list(rows);
    return `
      <section class="semantic-panel management-mapping-section">
        <div class="matrix-section-head">
          <div>
            <h3>管理视角映射矩阵</h3>
            <p>单一能力归属 L2 流程组；关注点集合关联安全工作与 L3 流程</p>
          </div>
          <span>${mappingRows.length} 条映射</span>
        </div>
        <div class="relationship-matrix-scroll semantic-scroll">
          <table class="semantic-mapping-table">
            <thead>
              <tr>
                <th>安全工作</th>
                <th>安全职能</th>
                <th>L2 流程组</th>
                <th>L3 流程</th>
                <th>L4 关键活动</th>
              </tr>
            </thead>
            <tbody>
              ${mappingRows
                .map(
                  (row) => `
                    <tr data-capability-id="${utils.escapeHtml(row.focus.id)}">
                      <td>${chipList(row.securityWorks, "暂无安全工作")}</td>
                      <td>${functionList(row.stakeholders)}</td>
                      <td>${chipList(row.processGroups, "暂无 L2 流程组")}</td>
                      <td>${chipList(row.processReferences, "暂无 L3 流程")}</td>
                      <td>${activityList(row)}</td>
                    </tr>
                  `,
                )
                .join("") || '<tr><td colspan="5"><div class="reference-empty">暂无管理映射</div></td></tr>'}
            </tbody>
          </table>
        </div>
      </section>
    `;
  }

  components.FocusManagementMapping = { render };
})();
