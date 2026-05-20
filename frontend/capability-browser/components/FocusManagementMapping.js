(function () {
  const components = (window.sapdComponents = window.sapdComponents || {});
  const utils = components.utils;
  const LAYERS = [
    { key: "decision", label: "决策层", aliases: ["decision", "决策层"] },
    { key: "management", label: "管理层", aliases: ["management", "管理层"] },
    { key: "execution", label: "执行层", aliases: ["execution", "执行层"] },
    { key: "supervision", label: "监督层", aliases: ["supervision", "监督层"] },
  ];

  function chipList(items, empty = "暂无", limit = 4) {
    const rows = utils.list(items).filter(Boolean);
    if (!rows.length) return `<span class="empty-inline">${utils.escapeHtml(empty)}</span>`;
    const visible = rows.slice(0, limit);
    const more = rows.length - visible.length;
    return `${visible.map((item) => `<span class="relation-chip">${utils.escapeHtml(utils.titleOf(item))}</span>`).join("")}${more > 0 ? `<span class="relation-chip muted">+${more}</span>` : ""}`;
  }

  function layerKeyOf(stakeholder) {
    const layer = utils.text(stakeholder?.layer || "").trim();
    return LAYERS.find((item) => item.aliases.includes(layer))?.key || "";
  }

  function functionChips(stakeholders) {
    return stakeholders
      .slice(0, 3)
      .map((stakeholder) => `<span>${utils.escapeHtml(utils.titleOf(stakeholder, "未命名职能"))}</span>`)
      .join("");
  }

  function functionList(stakeholders) {
    const rows = utils.list(stakeholders).filter(Boolean);
    const buckets = Object.fromEntries(LAYERS.map((layer) => [layer.key, []]));
    const unknown = [];
    rows.forEach((stakeholder) => {
      const key = layerKeyOf(stakeholder);
      if (key) buckets[key].push(stakeholder);
      else unknown.push(stakeholder);
    });
    return `
      <div class="function-layer-buckets">
        ${LAYERS.map(
          (layer) => `
            <span class="function-layer-bucket ${buckets[layer.key].length ? "" : "is-empty"}">
              <small>${utils.escapeHtml(layer.label)}</small>
              <em>${buckets[layer.key].length ? functionChips(buckets[layer.key]) : "暂无"}</em>
            </span>
          `,
        ).join("")}
        ${unknown.length ? `<span class="function-layer-bucket is-unknown"><small>待归类</small><em>${functionChips(unknown)}</em></span>` : ""}
      </div>
    `;
  }

  function activityList(row) {
    if (row.hasMissingActivity && !utils.list(row.activities).length) return '<span class="missing-pill">待补充</span>';
    return chipList(row.activities, "待补充", 4);
  }

  function render({ rows, summary = "" }) {
    const mappingRows = utils.list(rows);
    return `
      <section class="semantic-panel management-mapping-section">
        <div class="matrix-section-head">
          <div>
            <h3>管理视角映射矩阵</h3>
            <p>单一能力归属 L2 流程组；关注点集合关联安全工作与 L3 流程</p>
          </div>
          ${summary ? `<span>${utils.escapeHtml(summary)}</span>` : ""}
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
