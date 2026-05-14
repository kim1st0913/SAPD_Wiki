(() => {
  const components = (window.sapdComponents = window.sapdComponents || {});
  const utils = components.utils;

  const list = (value) => utils.list(value);
  const escapeHtml = (value) => utils.escapeHtml(value);
  const titleOf = (item, fallback = "待补充") => utils.titleOf(item, fallback);
  const codeTitle = (item, fallback = "待补充") => [item?.code, titleOf(item, fallback)].filter(Boolean).join(" ");

  function chipList(items, empty = "待补充", limit = 8) {
    const rows = list(items).filter(Boolean);
    if (!rows.length) return `<span class="empty-inline">${escapeHtml(empty)}</span>`;
    const visible = rows.slice(0, limit);
    const more = rows.length - visible.length;
    return `${visible
      .map((item) => {
        const kind = item.objectKind || item.kind || "";
        const kindClass = kind.includes("措施") ? "measure-chip" : "";
        return `<span class="relation-chip ${kindClass}">${kind ? `<em>${escapeHtml(kind)}</em>` : ""}${escapeHtml(codeTitle(item))}</span>`;
      })
      .join("")}${more > 0 ? `<span class="relation-chip muted">+${more}</span>` : ""}`;
  }

  function renderNavigation({ stageTree, navigationTree, selectedProcessId }) {
    const rows = list(stageTree || navigationTree);
    if (!rows.length) return `<div class="detail-empty"><strong>暂无 LC-AP 阶段</strong><span>等待生命周期数据导出。</span></div>`;
    return `
      <div class="lifecycle-tree-root">
        <strong>LC-AP 生命周期</strong>
        <span>${rows.length} 个阶段</span>
      </div>
      ${rows
        .map(
          (row) => `
            <button class="lifecycle-nav-row ${row.id === selectedProcessId ? "active" : ""}" type="button" data-lifecycle-kind="dev" data-lifecycle-id="${escapeHtml(row.id)}">
              <strong>${escapeHtml(codeTitle(row, "未命名阶段"))}</strong>
              <span>主要活动 / 安全活动 / 服务摘要</span>
            </button>
          `,
        )
        .join("")}
    `;
  }

  function summaryGrid(items) {
    return `
      <div class="focus-overview-summary">
        ${items.map((item) => `<div><span>${escapeHtml(item.label)}</span><strong>${escapeHtml(item.value)}</strong></div>`).join("")}
      </div>
    `;
  }

  function renderStageOverview(viewModel) {
    const overview = viewModel.stageOverview;
    if (!overview) return `<div class="detail-empty"><strong>暂无阶段概览</strong><span>${escapeHtml(viewModel.emptyState || "等待选择阶段。")}</span></div>`;
    return `
      <section class="focus-overview-section lifecycle-stage-overview">
        <div class="matrix-section-head">
          <div>
            <h3>当前阶段概览</h3>
            <p>对象详情和关系摘要集中在主工作区顶部</p>
          </div>
          <span>${escapeHtml(overview.status || "当前阶段")}</span>
        </div>
        <div class="focus-overview-profile">
          <div class="focus-overview-copy">
            <div class="detail-code">${escapeHtml(overview.code || "LC-AP")}</div>
            <h2>${escapeHtml(overview.title || "未命名阶段")}</h2>
            <p>${escapeHtml(overview.description || "暂无阶段目标 / 描述")}</p>
          </div>
          ${summaryGrid(list(overview.facts))}
        </div>
      </section>
    `;
  }

  function renderRelationTable({ rows }) {
    const relationRows = list(rows);
    return `
      <section class="semantic-panel lifecycle-relation-section">
        <div class="matrix-section-head">
          <div>
            <h3>LC-AP 阶段关系表</h3>
            <p>阶段下的活动、策略、服务、模块、措施和开发类组件分别展示，不压成单线性链路</p>
          </div>
          <span>${relationRows.length} 条阶段关系</span>
        </div>
        <div class="relationship-matrix-scroll semantic-scroll lifecycle-relation-scroll">
          <table class="semantic-mapping-table lifecycle-relation-table">
            <thead>
              <tr>
                <th>主要活动</th>
                <th>安全活动</th>
                <th>安全策略要求</th>
                <th>安全技术服务</th>
                <th>安全技术模块</th>
                <th>安全技术措施</th>
                <th>开发类产品 / 组件参考</th>
                <th>状态</th>
              </tr>
            </thead>
            <tbody>
              ${relationRows
                .map(
                  (row) => `
                    <tr>
                      <td>${chipList(row.mainActivity, "待补充", 12)}</td>
                      <td>${chipList(row.securityActivities, "待补充", 8)}</td>
                      <td>${chipList(row.policyRequirements, "待补充", 8)}</td>
                      <td>${chipList(row.technicalServices, "待补充", 12)}</td>
                      <td>${chipList(row.technologyModules, "待补充", 10)}</td>
                      <td>${chipList(row.technicalMeasures, "待补充", 8)}</td>
                      <td>${chipList(row.productComponents, "参考数据待补充", 8)}</td>
                      <td><span class="status-badge">${escapeHtml(row.status || "待补充")}</span></td>
                    </tr>
                  `,
                )
                .join("") || '<tr><td colspan="8"><div class="reference-empty">暂无 LC-AP 阶段关系</div></td></tr>'}
            </tbody>
          </table>
        </div>
      </section>
    `;
  }

  function renderLocalRelationNotes(notes) {
    const rows = list(notes);
    if (!rows.length) return "";
    return `
      <section class="local-relationship-notes lifecycle-local-notes">
        <div class="matrix-section-head">
          <div>
            <h3>当前阶段局部关系说明</h3>
            <p>说明当前阶段内多类关联关系，不作为全局知识来源维护页面</p>
          </div>
        </div>
        <div class="local-note-list">
          ${rows.map((note) => `<div class="local-note"><strong>${escapeHtml(note.title)}</strong><span>${escapeHtml(note.body)}</span></div>`).join("")}
        </div>
      </section>
    `;
  }

  function renderReferenceSections(referenceSections) {
    const softwareTypes = list(referenceSections?.softwareDevelopmentTypes);
    const systemTypes = list(referenceSections?.applicationSystemTypes);
    return `
      <section class="semantic-panel lifecycle-reference-section">
        <div class="matrix-section-head">
          <div>
            <h3>参考数据</h3>
            <p>软件开发类型、应用系统类型和应用组件仅作为同页参考，不伪造成正式映射关系</p>
          </div>
          <span>${softwareTypes.length + systemTypes.length} 项</span>
        </div>
        <div class="lifecycle-reference-grid">
          <div class="lifecycle-reference-block">
            <h4>软件开发类型</h4>
            <div class="source-chip-row">${chipList(softwareTypes, "待补充", 8)}</div>
          </div>
          <div class="lifecycle-reference-block">
            <h4>应用系统类型 / 应用组件</h4>
            <table class="semantic-mapping-table lifecycle-reference-table">
              <thead><tr><th>应用系统类型</th><th>应用组件</th></tr></thead>
              <tbody>
                ${
                  systemTypes
                    .map(
                      (system) => `
                        <tr>
                          <td>${escapeHtml(titleOf(system))}</td>
                          <td>${chipList(system.components, "待补充", 8)}</td>
                        </tr>
                      `,
                    )
                    .join("") || `<tr><td colspan="2">暂无应用系统类型数据</td></tr>`
                }
              </tbody>
            </table>
          </div>
        </div>
      </section>
    `;
  }

  window.sapdComponents = window.sapdComponents || {};
  window.sapdComponents.ApplicationSecurityLifecycle = {
    renderNavigation,
    renderStageOverview,
    renderRelationTable,
    renderLocalRelationNotes,
    renderReferenceSections,
  };
})();
