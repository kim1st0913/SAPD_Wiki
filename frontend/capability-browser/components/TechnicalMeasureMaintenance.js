(function () {
  const components = (window.sapdComponents = window.sapdComponents || {});
  const utils = components.utils;

  function summaryBadge(label, value) {
    return `<span class="measure-summary-badge"><small>${utils.escapeHtml(label)}</small><strong>${utils.escapeHtml(value)}</strong></span>`;
  }

  function render({ viewModel }) {
    const summary = viewModel?.summary || {};
    const rows = utils.list(viewModel?.rows);
    return `
      <section class="technical-measure-maintenance">
        <div class="measure-maintenance-copy">
          <strong>安全技术措施清单</strong>
          <span>部分字段依赖后续数据契约完善；当前页面先作为专项维护入口，用于后续核对措施、服务、模块和作用域关系。</span>
        </div>
        <div class="measure-summary-strip">
          ${summaryBadge("措施", summary.totalMeasures ?? rows.length)}
          ${summaryBadge("关联服务", summary.linkedServices ?? 0)}
          ${summaryBadge("关联模块", summary.linkedModules ?? 0)}
          ${summaryBadge("待补充", summary.missingMappings ?? 0)}
        </div>
        ${
          rows.length
            ? ""
            : `<div class="measure-empty-state">${utils.escapeHtml(viewModel?.emptyState || "暂无安全技术措施数据。")}</div>`
        }
      </section>
    `;
  }

  components.TechnicalMeasureMaintenance = { render };
})();
