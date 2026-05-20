(function () {
  const components = (window.sapdComponents = window.sapdComponents || {});
  const utils = components.utils;
  const levelClass = { 分类: "tree-level-0", L1: "tree-level-1", L2: "tree-level-2", 关注点: "tree-level-3" };
  const levelLabel = { 分类: "L0" };

  function emptyState(title, body = "等待数据导出或选择左侧对象") {
    return `<div class="detail-empty"><strong>${utils.escapeHtml(title)}</strong><span>${utils.escapeHtml(body)}</span></div>`;
  }

  function visibleRows(rows, expandedIds, search) {
    if (String(search || "").trim()) return rows;
    const rowById = new Map(rows.map((row) => [row.id, row]));
    const isVisible = (row) => {
      let parentId = row.parentId;
      while (parentId) {
        if (!expandedIds.has(parentId)) return false;
        parentId = rowById.get(parentId)?.parentId || "";
      }
      return true;
    };
    return rows.filter(isVisible);
  }

  function render({ navigationTree, selectedCapabilityId, expandedIds, search }) {
    const rows = utils.list(navigationTree);
    if (!rows.length) return emptyState("没有匹配的能力");
    const expanded = expandedIds instanceof Set ? expandedIds : new Set(utils.list(expandedIds));
    return visibleRows(rows, expanded, search)
      .map(
        (item) => `
          <button class="tree-row tree-node-row ${levelClass[item.level] || ""} ${item.id === selectedCapabilityId ? "active" : ""}" type="button" data-capability-id="${utils.escapeHtml(item.id)}"${item.hasChildren ? ` aria-expanded="${expanded.has(item.id) ? "true" : "false"}"` : ""}>
            <span class="node-expander ${item.hasChildren ? "has-children" : "is-empty"}" ${item.hasChildren ? `data-tree-toggle-id="${utils.escapeHtml(item.id)}"` : ""} aria-hidden="true">${item.hasChildren ? (expanded.has(item.id) ? "▾" : "▸") : ""}</span>
            <span class="node-level-label">${utils.escapeHtml(levelLabel[item.level] || item.level)}</span>
            <span class="node-copy">
              <span class="node-code">${utils.escapeHtml(item.code)}</span>
              <span class="node-title">${utils.escapeHtml(item.title)}</span>
            </span>
          </button>
        `,
      )
      .join("");
  }

  components.DimensionTree = { render };
})();
