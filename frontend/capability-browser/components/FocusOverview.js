(function () {
  const components = (window.sapdComponents = window.sapdComponents || {});
  const utils = components.utils;
  const display = window.sapdDisplay || {};

  function emptyState(title) {
    return `<div class="detail-empty"><strong>${utils.escapeHtml(title)}</strong><span>请选择能力或关注点</span></div>`;
  }

  function summaryGrid(title, items) {
    return `
      <div class="focus-overview-summary-group">
        <header>${utils.escapeHtml(title)}</header>
        <div class="focus-overview-summary">
        ${items.map((item) => `<div><strong>${utils.escapeHtml(item.value)}</strong><span>${utils.escapeHtml(item.label)}</span></div>`).join("")}
        </div>
      </div>
    `;
  }

  function renderPath(path = {}) {
    const items = [
      ["能力分类", path.category],
      ["能力域", path.domain],
      ["单一能力", path.capability],
    ].filter(([, item]) => item);
    if (!items.length) return "";
    return `
      <div class="focus-compact-path">
        ${items.map(([label, item]) => `<span><small>${utils.escapeHtml(label)}</small>${utils.escapeHtml(utils.titleOf(item))}</span>`).join("")}
      </div>
    `;
  }

  function render({ focusOverview }) {
    const rows = utils.list(focusOverview?.rows);
    if (!rows.length) return emptyState("暂无关注点概览");
    const current = focusOverview.current || null;
    const selected = focusOverview.selected || current;
    const currentRow = current ? rows.find((row) => row.focus.id === current?.id) || {} : {};
    const technical = focusOverview.technicalSummary || {};
    const management = focusOverview.managementSummary || {};
    const title = focusOverview.isAggregate ? utils.titleOf(selected, "能力范围") : utils.titleOf(current, "未命名关注点");
    const code = focusOverview.isAggregate ? selected?.code || "能力范围" : current?.code || "无编码";
    const description = focusOverview.isAggregate ? "当前选择包含多个关注点，请在左侧选择一个关注点查看单点映射。" : current?.description || "暂无说明";
    return `
      <section class="focus-overview-section capability-focus-summary">
        <div class="focus-overview-compact">
          <div class="focus-overview-copy">
            <div class="focus-compact-kicker">
              <strong>${utils.escapeHtml(code)}</strong>
              <span>${focusOverview.isAggregate ? `${rows.length} 个关注点` : current?.status || "当前关注点"}</span>
            </div>
            <h2>${utils.escapeHtml(title)}</h2>
            ${renderPath(focusOverview.path)}
            <p>${utils.escapeHtml(description)}</p>
          </div>
          <div class="focus-overview-metrics">
            ${summaryGrid("技术落地", [
              { label: display.label?.("scope_type", "作用域") || "作用域", value: technical.scopeCount ?? currentRow.scopeCount ?? 0 },
              { label: display.label?.("security_technical_service", "安全技术服务") || "安全技术服务", value: technical.serviceCount ?? currentRow.serviceCount ?? 0 },
              { label: display.label?.("security_module_or_measure", "安全技术模块/措施") || "安全技术模块/措施", value: technical.moduleCount ?? currentRow.moduleCount ?? 0 },
            ])}
            ${summaryGrid("管理执行", [
              { label: "安全工作", value: management.securityWorkCount ?? currentRow.securityWorkCount ?? 0 },
              { label: "安全职能", value: management.securityFunctionCount ?? 0 },
              { label: "L3 流程", value: management.processReferenceCount ?? currentRow.processReferenceCount ?? 0 },
            ])}
          </div>
        </div>
      </section>
    `;
  }

  components.FocusOverview = { render };
})();
