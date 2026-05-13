(function () {
  const components = (window.sapdComponents = window.sapdComponents || {});
  const utils = components.utils;
  const levelClass = { 分类: "tree-level-0", L1: "tree-level-1", L2: "tree-level-2", 关注点: "tree-level-3" };

  function emptyState(title, body = "等待数据导出或选择左侧对象") {
    return `<div class="detail-empty"><strong>${utils.escapeHtml(title)}</strong><span>${utils.escapeHtml(body)}</span></div>`;
  }

  function render({ navigationTree, selectedCapabilityId }) {
    const rows = utils.list(navigationTree);
    if (!rows.length) return emptyState("没有匹配的能力");
    return rows
      .map(
        (item) => `
          <button class="tree-row tree-node-row ${levelClass[item.level] || ""} ${item.id === selectedCapabilityId ? "active" : ""}" type="button" data-capability-id="${utils.escapeHtml(item.id)}">
            <span class="node-level-label">${utils.escapeHtml(item.level)}</span>
            <span class="node-code">${utils.escapeHtml(item.code)}</span>
            <span class="node-title">${utils.escapeHtml(item.title)}</span>
          </button>
        `,
      )
      .join("");
  }

  components.DimensionTree = { render };
})();
