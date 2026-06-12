(function () {
  const components = (window.sapdComponents = window.sapdComponents || {});
  const utils = components.utils;
  const display = window.sapdDisplay || {};

  function factList(items) {
    return `
      <dl class="environment-fact-list">
        ${items
          .map((item) => `<div><dt>${utils.escapeHtml(item.label)}</dt><dd>${utils.escapeHtml(item.value)}</dd></div>`)
          .join("")}
      </dl>
    `;
  }

  function render({ viewModel }) {
    const environment = viewModel?.selectedEnvironment;
    const object = viewModel?.selectedObject;
    const detailPanel = viewModel?.detailPanel || {};
    const summary = viewModel?.relationshipSummary || {};
    if (!environment) {
      return '<section class="focus-overview-section"><div class="detail-empty"><strong>请选择信息化环境或对象</strong><span>左侧选择后展示环境维度映射。</span></div></section>';
    }
    const title = object?.title || environment?.title || "未命名环境";
    const subtitle = object ? "当前信息化对象" : "当前信息化环境";
    const segmentText = utils.list(detailPanel.segments).map((segment) => utils.titleOf(segment)).join("、") || "暂无";
    const description = object?.description || environment?.description || "暂无说明";
    return `
      <section class="focus-overview-section environment-overview-section">
        <div class="matrix-section-head">
          <div>
            <h3>${utils.escapeHtml(subtitle)}概览</h3>
            <p>信息化环境 → 环境子类 → 信息化对象 → 安全作用域 → 安全技术服务 → 安全技术模块 / 措施 → 安全系统</p>
          </div>
        </div>
        <div class="environment-object-overview">
          <div class="environment-object-copy">
            <div class="detail-code">${utils.escapeHtml(environment?.code || environment?.title || "信息化环境")}</div>
            <h2>${utils.escapeHtml(title)}</h2>
            <p>${utils.escapeHtml(description)}</p>
          </div>
          ${factList([
            { label: "所属信息化环境", value: environment?.title || "未命名环境" },
            { label: "环境子类", value: segmentText },
            { label: "对象数", value: summary.selectedObjectCount ?? 0 },
            { label: display.label?.("scope_type", "作用域") || "作用域", value: summary.scopeCount ?? 0 },
            { label: display.label?.("security_technical_service", "安全技术服务") || "安全技术服务", value: summary.serviceCount ?? 0 },
            { label: "安全系统", value: summary.systemCount ?? 0 },
            { label: display.label?.("security_technology_module", "安全技术模块") || "安全技术模块", value: summary.moduleCount ?? 0 },
            { label: display.label?.("security_technical_measure", "安全技术措施") || "安全技术措施", value: summary.measureCount ?? 0 },
            { label: display.state?.("no_applicable_service") || "无适用服务", value: summary.notApplicableCount ?? 0 },
          ])}
        </div>
      </section>
    `;
  }

  components.EnvironmentRelationshipOverview = { render };
})();
