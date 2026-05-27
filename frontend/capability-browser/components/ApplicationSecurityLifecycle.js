(() => {
  const components = (window.sapdComponents = window.sapdComponents || {});
  const utils = components.utils;

  const list = (value) => utils.list(value);
  const escapeHtml = (value) => utils.escapeHtml(value);
  const titleOf = (item, fallback = "/") => utils.titleOf(item, fallback);
  const EMPTY_VALUE = "/";

  function splitLines(value) {
    if (Array.isArray(value)) return value.flatMap(splitLines);
    if (value && typeof value === "object") return splitLines(titleOf(value, ""));
    return String(value || "")
      .replace(/\r\n/g, "\n")
      .replace(/\r/g, "\n")
      .split("\n")
      .map((line) => line.trim())
      .flatMap(splitInlineNumberedClauses)
      .filter(Boolean);
  }

  function splitInlineNumberedClauses(line) {
    const markerPattern = /(?:^|\s)(\d+['’′]?)[).）、](?=\s|[\u4e00-\u9fff])\s*/g;
    const matches = [...line.matchAll(markerPattern)];
    if (matches.length <= 1 || matches[0].index !== 0) return [line];
    return matches.map((match, index) => {
      const next = matches[index + 1];
      return line.slice(match.index, next?.index ?? line.length).trim();
    });
  }

  function fieldCell(value) {
    const lines = splitLines(value);
    if (!lines.length) return `<span class="empty-inline">${EMPTY_VALUE}</span>`;
    return `
      <div class="lifecycle-field-lines">
        ${lines.map(renderFieldLine).join("")}
      </div>
    `;
  }

  function hasBusinessValue(value) {
    const lines = splitLines(value);
    return lines.some((line) => line && line !== EMPTY_VALUE);
  }

  function renderFieldLine(line) {
    const numbered = line.match(/^(\d+['’′]?)[).）、]\s*(.+)$/);
    if (numbered) {
      return `
        <span class="lifecycle-field-line is-numbered">
          <span class="line-marker">${escapeHtml(numbered[1])}</span>
          <span class="line-text">${escapeHtml(numbered[2])}</span>
        </span>
      `;
    }

    const term = line.match(/^([^：:]{2,14})[：:]\s*(.+)$/);
    if (term) {
      return `
        <span class="lifecycle-field-line is-term">
          <span class="line-term">${escapeHtml(term[1])}</span>
          <span class="line-text">${escapeHtml(term[2])}</span>
        </span>
      `;
    }

    return `<span class="lifecycle-field-line"><span class="line-text">${escapeHtml(line)}</span></span>`;
  }

  function chipItems(value) {
    if (!Array.isArray(value)) return splitLines(value).map((line) => ({ label: line, kind: "" }));
    return value
      .flatMap((item) => {
        if (item && typeof item === "object") {
          return {
            label: titleOf(item, ""),
            kind: item.objectKind || item.object_kind || "",
          };
        }
        return splitLines(item).map((line) => ({ label: line, kind: "" }));
      })
      .filter((item) => item.label);
  }

  function inlineChips(value, tone = "") {
    const items = chipItems(value);
    if (!items.length) return `<span class="empty-inline">${EMPTY_VALUE}</span>`;
    return `
      <div class="lifecycle-inline-chips ${escapeHtml(tone)}">
        ${items
          .map((item) => {
            const isMeasure = item.kind === "安全技术措施";
            const isModule = item.kind === "安全技术模块";
            const kindClass = isMeasure ? " is-measure" : isModule ? " is-module" : "";
            const marker = isMeasure ? "措施" : isModule ? "模块" : "";
            return `
              <span class="lifecycle-chip-item${kindClass}">
                ${marker ? `<b>${escapeHtml(marker)}</b>` : ""}
                <em>${escapeHtml(item.label)}</em>
              </span>
            `;
          })
          .join("")}
      </div>
    `;
  }

  function tableText(value, className = "") {
    return `<div class="lifecycle-table-text ${escapeHtml(className)}">${fieldCell(value)}</div>`;
  }

  function emptyValueCellClass(value) {
    const lines = splitLines(value);
    return lines.length === 1 && lines[0] === EMPTY_VALUE ? " lifecycle-empty-value-cell" : "";
  }

  function sourceNote(value, label = "参考来源") {
    const lines = splitLines(value);
    if (!lines.length) return "";
    return `
      <div class="lifecycle-activity-source-note">
        <span class="activity-source-label">${escapeHtml(label)}</span>
        <div class="activity-source-values">
          ${lines.map((line) => `<span>${escapeHtml(line)}</span>`).join("")}
        </div>
      </div>
    `;
  }

  function mainActivityCell(row) {
    return `
      <div class="lifecycle-main-activity-cell">
        ${tableText(row.mainActivity, "main-activities")}
        ${hasBusinessValue(row.mainActivity) ? sourceNote(row.mainActivityReference) : ""}
      </div>
    `;
  }

  function securityActivityCell(row) {
    return `
      <div class="lifecycle-security-activity-cell">
        ${tableText(row.securityActivities, "security-activities")}
        ${hasBusinessValue(row.securityActivities) ? sourceNote(row.policyReference, "安全活动参考来源") : ""}
      </div>
    `;
  }

  function renderDevelopmentProfileRow(row, selectedStageId) {
    return `
      <tr class="${row.stageId === selectedStageId ? "selected" : ""}" data-lifecycle-kind="dev" data-lifecycle-id="${escapeHtml(row.stageId)}">
        <td>${tableText(row.stageGoal)}</td>
        <td>${mainActivityCell(row)}</td>
        <td>${tableText(row.developmentTypes, "development-mode")}</td>
        <td>${inlineChips(row.developmentServices, "dev")}</td>
        <td>${inlineChips(row.developmentModules, "module")}</td>
      </tr>
    `;
  }

  function renderSecurityControlRow(row) {
    return `
      <tr>
        <td class="${emptyValueCellClass(row.securityActivities)}">${securityActivityCell(row)}</td>
        <td class="${emptyValueCellClass(row.policyRequirements)}">${tableText(row.policyRequirements)}</td>
        <td class="${emptyValueCellClass(row.threatScenarios)}">${tableText(row.threatScenarios, "threat")}</td>
        <td class="${emptyValueCellClass(row.supplementalPolicies)}">${tableText(row.supplementalPolicies)}</td>
        <td class="${emptyValueCellClass(row.technicalServices)}">${inlineChips(row.technicalServices, "security")}</td>
        <td class="${emptyValueCellClass(row.technologyModules)}">${inlineChips(row.technologyModules, "module")}</td>
      </tr>
    `;
  }

  function renderDataProcessProfileRow(row, selectedStageId) {
    return `
      <tr class="${row.stageId === selectedStageId ? "selected" : ""}" data-lifecycle-kind="data" data-lifecycle-id="${escapeHtml(row.stageId)}">
        <td>${tableText(row.processDefinition)}</td>
        <td>${tableText(row.scenes, "main-activities")}</td>
        <td>${tableText(row.sceneDescriptions)}</td>
      </tr>
    `;
  }

  function renderDataSecurityMappingRow(row) {
    return `
      <tr>
        <td class="${emptyValueCellClass(row.technicalServices)}">${inlineChips(row.technicalServices, "security")}</td>
        <td class="${emptyValueCellClass(row.technologyModules)}">${inlineChips(row.technologyModules, "module")}</td>
      </tr>
    `;
  }

  function renderDevelopmentProfileTable(rows, selectedStageId) {
    return `
      <section class="lifecycle-logic-section lifecycle-table-panel">
        <div class="lifecycle-logic-head">
          <h4>开发阶段画像</h4>
          <span>阶段目标 → 阶段主要活动（含参考来源） → 软件开发模式 → 开发技术服务 / 开发技术模块</span>
        </div>
        <div class="lifecycle-table-scroll lifecycle-profile-scroll">
          <table class="lifecycle-workbench-table lifecycle-profile-table">
            <colgroup>
              <col style="width: 28%" />
              <col style="width: 33%" />
              <col style="width: 19%" />
              <col style="width: 10%" />
              <col style="width: 10%" />
            </colgroup>
            <thead>
              <tr>
                <th>阶段目标</th>
                <th>阶段主要活动</th>
                <th>软件开发模式</th>
                <th>开发技术服务</th>
                <th>开发技术模块</th>
              </tr>
            </thead>
            <tbody>
              ${rows.map((row) => renderDevelopmentProfileRow(row, selectedStageId)).join("") || `<tr><td colspan="5">暂无 LC-AP 阶段画像</td></tr>`}
            </tbody>
          </table>
        </div>
      </section>
    `;
  }

  function renderSecurityControlTable(rows) {
    return `
      <section class="lifecycle-logic-section lifecycle-table-panel">
        <div class="lifecycle-logic-head">
          <h4>阶段安全控制与威胁补充策略表</h4>
          <span>安全活动（含参考来源）与策略 → 潜在安全威胁场景与补充安全策略 → 安全技术服务 / 安全技术模块/措施</span>
        </div>
        <div class="lifecycle-table-scroll lifecycle-security-scroll">
          <table class="lifecycle-workbench-table lifecycle-security-table">
            <colgroup>
              <col style="width: 14%" />
              <col style="width: 28%" />
              <col style="width: 18%" />
              <col style="width: 20%" />
              <col style="width: 10%" />
              <col style="width: 10%" />
            </colgroup>
            <thead>
              <tr>
                <th>安全活动</th>
                <th>安全活动对应安全策略</th>
                <th>潜在安全威胁场景</th>
                <th>补充安全策略</th>
                <th>安全技术服务</th>
                <th>安全技术模块/措施</th>
              </tr>
            </thead>
            <tbody>
              ${rows.map(renderSecurityControlRow).join("") || `<tr><td colspan="6">暂无阶段安全控制数据</td></tr>`}
            </tbody>
          </table>
        </div>
      </section>
    `;
  }

  function renderDataProcessProfileTable(rows, selectedStageId) {
    return `
      <section class="lifecycle-logic-section lifecycle-table-panel">
        <div class="lifecycle-logic-head">
          <h4>数据处理过程画像</h4>
          <span>过程定义 → 数据处理场景 → 场景说明</span>
        </div>
        <div class="lifecycle-table-scroll lifecycle-profile-scroll">
          <table class="lifecycle-workbench-table lifecycle-profile-table data-lifecycle-profile-table">
            <colgroup>
              <col style="width: 24%" />
              <col style="width: 30%" />
              <col style="width: 46%" />
            </colgroup>
            <thead>
              <tr>
                <th>过程定义</th>
                <th>数据处理场景</th>
                <th>处理子场景描述</th>
              </tr>
            </thead>
            <tbody>
              ${rows.map((row) => renderDataProcessProfileRow(row, selectedStageId)).join("") || `<tr><td colspan="3">暂无 LC-DT 数据处理过程画像</td></tr>`}
            </tbody>
          </table>
        </div>
      </section>
    `;
  }

  function renderDataSecurityMappingTable(rows) {
    return `
      <section class="lifecycle-logic-section lifecycle-table-panel">
        <div class="lifecycle-logic-head">
          <h4>数据安全技术映射表</h4>
          <span>安全技术服务 → 安全技术模块/措施</span>
        </div>
        <div class="lifecycle-table-scroll lifecycle-security-scroll">
          <table class="lifecycle-workbench-table lifecycle-security-table data-lifecycle-security-table">
            <colgroup>
              <col style="width: 42%" />
              <col style="width: 58%" />
            </colgroup>
            <thead>
              <tr>
                <th>安全技术服务</th>
                <th>安全技术模块/措施</th>
              </tr>
            </thead>
            <tbody>
              ${rows.map(renderDataSecurityMappingRow).join("") || `<tr><td colspan="2">暂无数据安全技术映射</td></tr>`}
            </tbody>
          </table>
        </div>
      </section>
    `;
  }

  function renderRecordTables({ rows, profileRows, selectedStageId }) {
    return `
      <div class="lifecycle-logic-stack">
        ${renderDevelopmentProfileTable(profileRows, selectedStageId)}
        ${renderSecurityControlTable(rows)}
      </div>
    `;
  }

  function renderDataRecordTables({ rows, selectedStageId }) {
    return `
      <div class="lifecycle-logic-stack">
        ${renderDataProcessProfileTable(rows, selectedStageId)}
        ${renderDataSecurityMappingTable(rows)}
      </div>
    `;
  }

  function renderNavigation({ stageTree, navigationTree, selectedProcessId, search = "", kind = "dev" }) {
    const query = String(search || "").trim().toLowerCase();
    const rows = list(stageTree || navigationTree).filter((row) => {
      if (!query) return true;
      return [titleOf(row, ""), row.code, row.order].map((value) => String(value || "")).join(" ").toLowerCase().includes(query);
    });
    if (!rows.length) {
      return `
        <div class="lifecycle-stage-empty">
          <strong>没有匹配阶段</strong>
          <span>换一个关键词试试。</span>
        </div>
      `;
    }
    return `
      ${rows
        .map((row, index) => {
          const code = row.code || row.order || `${kind === "data" ? "DT" : "AP"}-${String(index + 1).padStart(2, "0")}`;
          return `
            <button class="lifecycle-nav-row ${row.id === selectedProcessId ? "active" : ""}" type="button" data-lifecycle-kind="${escapeHtml(kind)}" data-lifecycle-id="${escapeHtml(row.id)}">
              <span class="stage-tab-code">${escapeHtml(code)}</span>
              <strong>${escapeHtml(titleOf(row, "未命名阶段"))}</strong>
              <span class="stage-tab-arrow" aria-hidden="true">›</span>
            </button>
          `;
        })
        .join("")}
    `;
  }

  function renderStageOverview(viewModel) {
    return "";
  }

  function renderRelationTable({ rows, profileRows, overview }) {
    const relationRows = list(rows);
    const allProfileRows = list(profileRows).length ? list(profileRows) : relationRows;
    const selectedStageId = relationRows[0]?.stageId || "";
    return `
      <section class="semantic-panel lifecycle-relation-section">
        <div class="lifecycle-record-scroll">
          ${
            relationRows.length
              ? overview?.mode === "data"
                ? renderDataRecordTables({ rows: relationRows, selectedStageId })
                : renderRecordTables({ rows: relationRows, profileRows: allProfileRows, selectedStageId })
              : `<div class="reference-empty">${overview?.mode === "data" ? "暂无 LC-DT 数据安全关系" : "暂无 LC-AP 阶段关系"}</div>`
          }
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
            <div class="source-chip-row">${fieldCell(softwareTypes.map((item) => titleOf(item, ""))) || EMPTY_VALUE}</div>
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
                          <td>${fieldCell(system.components.map((item) => titleOf(item, ""))) || EMPTY_VALUE}</td>
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
