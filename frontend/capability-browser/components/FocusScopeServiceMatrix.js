(function () {
  const components = (window.sapdComponents = window.sapdComponents || {});
  const utils = components.utils;
  const display = window.sapdDisplay || {};

  function technicalChipClass(kind) {
    if (display.chipClass) return display.chipClass(kind);
    if (kind.includes("模块")) return "technical-chip module-chip";
    if (kind.includes("措施")) return "technical-chip measure-chip";
    if (kind.includes("说明")) return "note-chip";
    return "";
  }

  function chipList(items, empty = "暂无", limit = Infinity, fallbackKind = "") {
    if (display.relationChipList) return display.relationChipList(utils, items, { empty, limit, kind: fallbackKind, showKind: true });
    const rows = utils.list(items).filter(Boolean);
    if (!rows.length) return `<span class="empty-inline">${utils.escapeHtml(empty)}</span>`;
    const visible = Number.isFinite(limit) ? rows.slice(0, limit) : rows;
    const more = rows.length - visible.length;
    return `${visible
      .map((item) => {
        const kind = item.kind || item.objectKind || fallbackKind;
        return `<span class="relation-chip ${technicalChipClass(kind)}">${kind ? `<em>${utils.escapeHtml(kind)}</em>` : ""}<span class="relation-chip-text">${utils.escapeHtml(utils.codeTitleOf(item))}</span></span>`;
      })
      .join("")}${more > 0 ? `<span class="relation-chip muted">+${more}</span>` : ""}`;
  }

  function exceptionDetails(row) {
    if (row.exceptionType !== "ambiguous_service_mapping") return "";
    return `
      <div class="mapping-exception">
        <details>
          <summary>候选服务 ${utils.list(row.candidateServices).length}</summary>
          <div class="source-chip-row">${chipList(row.candidateServices, "暂无候选服务", 8, "安全技术服务")}</div>
          <p>${utils.escapeHtml(row.exceptionMessage || "需要后端/ETL确认")}</p>
        </details>
      </div>
    `;
  }

  function renderEmptyTechnicalMapping(rows) {
    return `
      <section class="semantic-panel technical-mapping-section">
        <div class="matrix-section-head">
          <div>
            <h3>技术视角映射矩阵</h3>
            <p>当前关注点 → 作用域 → 安全技术服务 → 安全技术模块/措施</p>
          </div>
          <span>0 服务</span>
        </div>
        <div class="relationship-matrix-scroll semantic-scroll">
          <table class="semantic-mapping-table">
            <thead>
              <tr>
                <th>${utils.escapeHtml(display.label?.("scope_type", "作用域") || "作用域")}</th>
                <th>${utils.escapeHtml(display.label?.("security_technical_service", "安全技术服务") || "安全技术服务")}</th>
                <th>${utils.escapeHtml(display.label?.("security_module_or_measure", "安全技术模块/措施") || "安全技术模块/措施")}</th>
              </tr>
            </thead>
            <tbody>
              <tr class="semantic-empty-row">
                <td colspan="3"><div class="reference-empty">暂无作用域对应安全技术服务</div></td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    `;
  }

  function render({ rows, summary = "" }) {
    const sourceRows = utils.list(rows);
    const mappingRows = sourceRows.filter((row) => row?.status === "ambiguous_service_mapping" || utils.list(row?.services).length);
    if (!mappingRows.length) return renderEmptyTechnicalMapping(sourceRows);
    return `
      <section class="semantic-panel technical-mapping-section">
        <div class="matrix-section-head">
          <div>
            <h3>技术视角映射矩阵</h3>
            <p>关注点 × 作用域 → 安全技术服务 → 安全技术模块/措施</p>
          </div>
          ${summary ? `<span>${utils.escapeHtml(summary)}</span>` : ""}
        </div>
        <div class="relationship-matrix-scroll semantic-scroll">
          <table class="semantic-mapping-table">
            <thead>
              <tr>
                <th>${utils.escapeHtml(display.label?.("scope_type", "作用域") || "作用域")}</th>
                <th>${utils.escapeHtml(display.label?.("security_technical_service", "安全技术服务") || "安全技术服务")}</th>
                <th>${utils.escapeHtml(display.label?.("security_module_or_measure", "安全技术模块/措施") || "安全技术模块/措施")}</th>
              </tr>
            </thead>
            <tbody>
              ${mappingRows
                .map(
                  (row) => `
                    <tr>
                      <td><strong>${utils.escapeHtml(row.scope.code || "")}</strong><span>${utils.escapeHtml(row.scope.title)}</span></td>
                      <td>${row.status === "ambiguous_service_mapping" ? `<span class="missing-pill">${utils.escapeHtml(display.state?.("mapping_exception") || "映射异常")}</span>${exceptionDetails(row)}` : chipList(row.services, display.state?.("no_applicable_service") || "无适用服务", Infinity, "安全技术服务")}</td>
                      <td>${row.status === "ambiguous_service_mapping" ? `<span class="empty-inline">${utils.escapeHtml(display.state?.("pending_review") || "待确认")}</span>` : chipList(row.modules, row.status === "no_service" ? display.state?.("not_applicable") || "不适用" : display.state?.("no_module_or_measure") || "/", Infinity)}</td>
                    </tr>
                  `,
                )
                .join("") || '<tr><td colspan="3"><div class="reference-empty">暂无作用域对应安全技术服务</div></td></tr>'}
            </tbody>
          </table>
        </div>
      </section>
    `;
  }

  components.FocusScopeServiceMatrix = { render };
})();
