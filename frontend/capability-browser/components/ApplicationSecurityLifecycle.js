(() => {
  const components = (window.sapdComponents = window.sapdComponents || {});
  const utils = components.utils;

  const list = (value) => utils.list(value);
  const escapeHtml = (value) => utils.escapeHtml(value);
  const titleOf = (item, fallback = "待补充") => utils.titleOf(item, fallback);

  function splitLines(value) {
    if (Array.isArray(value)) return value.flatMap(splitLines);
    if (value && typeof value === "object") return splitLines(titleOf(value, ""));
    return String(value || "")
      .replace(/\r\n/g, "\n")
      .replace(/\r/g, "\n")
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
  }

  function fieldCell(value) {
    const lines = splitLines(value);
    if (!lines.length) return `<span class="empty-inline">待补充</span>`;
    return `<div class="lifecycle-field-lines">${lines.map((line) => `<span>${escapeHtml(line)}</span>`).join("")}</div>`;
  }

  function recordField(label, value) {
    return `
      <th scope="row">${escapeHtml(label)}</th>
      <td>${fieldCell(value)}</td>
    `;
  }

  function renderRecordTable(row) {
    return `
      <div class="lifecycle-record-groups">
        <section class="lifecycle-record-group">
          <h4>开发技术相关</h4>
          <table class="lifecycle-record-table">
            <tbody>
              <tr>
                ${recordField("阶段主要活动（L4流程活动）", row.mainActivity)}
                ${recordField("阶段主要活动参考来源", row.mainActivityReference)}
              </tr>
              <tr>
                ${recordField("软件开发模式", row.developmentTypes)}
                ${recordField("开发技术服务", row.developmentServices)}
              </tr>
              <tr>
                ${recordField("实际产品示例", row.developmentModules)}
                ${recordField("潜在安全威胁场景", row.threatScenarios)}
              </tr>
            </tbody>
          </table>
        </section>
        <section class="lifecycle-record-group">
          <h4>安全相关</h4>
          <table class="lifecycle-record-table">
            <tbody>
              <tr>
                ${recordField("安全活动定义", row.securityActivities)}
                ${recordField("安全活动对应安全策略", row.policyRequirements)}
              </tr>
              <tr>
                ${recordField("安全活动参考来源", row.policyReference)}
                ${recordField("补充安全策略", row.supplementalPolicies)}
              </tr>
              <tr>
                ${recordField("安全技术服务", row.technicalServices)}
                ${recordField("安全技术模块", row.technologyModules)}
              </tr>
            </tbody>
          </table>
        </section>
      </div>
    `;
  }

  function renderNavigation({ stageTree, navigationTree, selectedProcessId }) {
    const rows = list(stageTree || navigationTree);
    if (!rows.length) return `<div class="detail-empty"><strong>暂无 LC-AP 阶段</strong><span>等待生命周期数据导出。</span></div>`;
    return `
      ${rows
        .map(
          (row) => `
            <button class="lifecycle-nav-row ${row.id === selectedProcessId ? "active" : ""}" type="button" data-lifecycle-kind="dev" data-lifecycle-id="${escapeHtml(row.id)}">
              <strong>${escapeHtml(titleOf(row, "未命名阶段"))}</strong>
            </button>
          `,
        )
        .join("")}
    `;
  }

  function renderStageOverview(viewModel) {
    return "";
  }

  function renderRelationTable({ rows, overview }) {
    const relationRows = list(rows);
    const title = overview?.title || "LC-AP";
    const description = overview?.description || "";
    return `
      <section class="semantic-panel lifecycle-relation-section">
        <div class="matrix-section-head">
          <div>
            <h3>${escapeHtml(title)}</h3>
            ${description ? `<div class="lifecycle-stage-definition"><span class="lifecycle-stage-label">阶段目标</span>${fieldCell(description)}</div>` : ""}
          </div>
        </div>
        <div class="lifecycle-record-scroll">
          ${relationRows.map(renderRecordTable).join("") || '<div class="reference-empty">暂无 LC-AP 阶段关系</div>'}
        </div>
      </section>
    `;
  }

  function renderLocalRelationNotes(notes) {
    return "";
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
            <div class="source-chip-row">${fieldCell(softwareTypes.map((item) => titleOf(item, ""))) || "待补充"}</div>
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
                          <td>${fieldCell(system.components.map((item) => titleOf(item, ""))) || "待补充"}</td>
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
