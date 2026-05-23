(function () {
  const components = (window.sapdComponents = window.sapdComponents || {});
  const utils = components.utils;

  function escape(value) {
    return utils?.escapeHtml ? utils.escapeHtml(value) : String(value ?? "");
  }

  function renderStatus(summary = {}) {
    const items = [
      ["对象", summary.selectedObjectCount ?? 0],
      ["作用域", summary.scopeCount ?? 0],
      ["技术服务", summary.serviceCount ?? 0],
      ["模块/措施", summary.moduleCount ?? 0],
    ];
    return `
      <div class="environment-graph-status" aria-label="当前图谱统计">
        ${items.map(([label, value]) => `<span><strong>${escape(value)}</strong>${escape(label)}</span>`).join("")}
      </div>
    `;
  }

  function render({ viewModel } = {}) {
    const graphModel = window.sapdModels?.buildEnvironmentRelationGraphModel?.({ viewModel });
    return `
      <section class="semantic-panel environment-relation-map">
        <div class="matrix-section-head">
          <div>
            <h3>本地关系图谱</h3>
            <p>按当前层级切换结构、概览和完整对象关系。</p>
          </div>
          ${renderStatus(viewModel?.relationshipSummary || {})}
        </div>
        ${
          components.LocalRelationNetworkGraph?.render({ graphModel }) ||
          '<div class="reference-empty">环境关系图谱组件未加载。</div>'
        }
      </section>
    `;
  }

  components.EnvironmentLocalRelationMap = { render };
})();
