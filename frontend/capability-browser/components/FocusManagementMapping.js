(function () {
  const components = (window.sapdComponents = window.sapdComponents || {});
  const utils = components.utils;
  const display = window.sapdDisplay || {};
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
      .map((stakeholder) => `<span>${utils.escapeHtml(utils.titleOf(stakeholder, "未命名职能"))}</span>`)
      .join("");
  }

  function functionList(stakeholders) {
    const rows = utils.list(stakeholders).filter(Boolean);
    if (!rows.length) return `<span class="empty-inline">暂无职能</span>`;
    const buckets = Object.fromEntries(LAYERS.map((layer) => [layer.key, []]));
    const unknown = [];
    rows.forEach((stakeholder) => {
      const key = layerKeyOf(stakeholder);
      if (key) buckets[key].push(stakeholder);
      else unknown.push(stakeholder);
    });
    const filledLayers = LAYERS.filter((layer) => buckets[layer.key].length);
    const emptyLayers = LAYERS.filter((layer) => !buckets[layer.key].length);
    return `
      <div class="function-layer-buckets">
        ${filledLayers
          .map(
          (layer) => `
            <span class="function-layer-bucket">
              <small>${utils.escapeHtml(layer.label)}</small>
              <em>${functionChips(buckets[layer.key])}</em>
            </span>
          `,
        )
          .join("")}
        ${unknown.length ? `<span class="function-layer-bucket is-unknown"><small>待归类</small><em>${functionChips(unknown)}</em></span>` : ""}
        ${emptyLayers.length ? `<span class="function-layer-empty-note">${utils.escapeHtml(emptyLayers.map((layer) => layer.label).join(" / "))}：暂无</span>` : ""}
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
                <th>${utils.escapeHtml(display.label?.("l2_process_group", "L2 流程组") || "L2 流程组")}</th>
                <th>${utils.escapeHtml(display.label?.("l3_process", "L3 流程") || "L3 流程")}</th>
                <th>${utils.escapeHtml(display.label?.("l4_activity", "L4 活动") || "L4 活动")}</th>
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
