(function () {
  const components = (window.sapdComponents = window.sapdComponents || {});
  const utils = components.utils;

  const levelClass = {
    environment: "tree-level-0",
    segment: "tree-level-1",
    object: "tree-level-2",
  };

  const levelLabel = {
    environment: "环境",
    segment: "子类",
    object: "对象",
  };

  function rowsFromTree(navigationTree) {
    return utils.list(navigationTree).flatMap((environment) => {
      const environmentRow = {
        id: environment.id,
        parentId: "",
        level: "environment",
        title: environment.title || "未命名环境",
        code: "",
        meta: `${environment.segmentCount ?? utils.list(environment.segments).length} 类 / ${environment.objectCount ?? utils.list(environment.objects).length} 对象`,
        hasChildren: utils.list(environment.segments).length > 0,
        environmentId: environment.id,
      };
      const segmentRows = utils.list(environment.segments).flatMap((segment) => {
        const segmentRow = {
          id: segment.id,
          parentId: environment.id,
          level: "segment",
          title: segment.title || "未定义环境子类",
          code: "",
          meta: `${segment.objectCount ?? utils.list(segment.objects).length} 对象`,
          hasChildren: utils.list(segment.objects).length > 0,
          environmentId: segment.environmentId || environment.id,
          segmentId: segment.id,
        };
        const objectRows = utils.list(segment.objects).map((object) => ({
          id: object.id,
          parentId: segment.id,
          level: "object",
          title: object.title || "未命名对象",
          code: "",
          meta: `作用域 ${object.scopeCount ?? 0} / 服务 ${object.serviceCount ?? 0} / 模块/措施 ${object.moduleCount ?? 0}`,
          hasChildren: false,
          environmentId: object.environmentId || environment.id,
          objectId: object.id,
        }));
        return [segmentRow, ...objectRows];
      });
      return [environmentRow, ...segmentRows];
    });
  }

  function visibleRows(rows, expandedIds, search) {
    if (String(search || "").trim()) return rows;
    const rowById = new Map(rows.map((row) => [row.id, row]));
    return rows.filter((row) => {
      let parentId = row.parentId;
      while (parentId) {
        if (!expandedIds.has(parentId)) return false;
        parentId = rowById.get(parentId)?.parentId || "";
      }
      return true;
    });
  }

  function dataAttrs(row) {
    const environmentAttr = row.environmentId ? ` data-environment-id="${utils.escapeHtml(row.environmentId)}"` : "";
    const segmentAttr = row.segmentId ? ` data-environment-segment-id="${utils.escapeHtml(row.segmentId)}"` : "";
    const objectAttr = row.objectId ? ` data-environment-object-id="${utils.escapeHtml(row.objectId)}"` : "";
    return `${environmentAttr}${segmentAttr}${objectAttr}`;
  }

  function render({ navigationTree, selectedObjectId, selectedEnvironmentId, selectedSegmentId, expandedIds, search }) {
    const rows = rowsFromTree(navigationTree);
    if (!rows.length) {
      return '<div class="detail-empty"><strong>暂无环境对象</strong><span>请确认信息化环境维度数据是否已导出。</span></div>';
    }
    const expanded = expandedIds instanceof Set ? expandedIds : new Set(utils.list(expandedIds));
    return visibleRows(rows, expanded, search)
      .map((row) => {
        const active =
          (row.level === "environment" && row.environmentId === selectedEnvironmentId && !selectedSegmentId && !selectedObjectId) ||
          (row.level === "segment" && row.segmentId === selectedSegmentId && !selectedObjectId) ||
          (row.level === "object" && row.objectId === selectedObjectId);
        const expandedText = row.hasChildren ? (expanded.has(row.id) ? "▾" : "▸") : "";
        const ariaExpanded = row.hasChildren ? ` aria-expanded="${expanded.has(row.id) ? "true" : "false"}"` : "";
        return `
          <button class="tree-row tree-node-row environment-tree-row ${levelClass[row.level] || ""} ${active ? "active" : ""}" type="button"${dataAttrs(row)}${ariaExpanded}>
            <span class="node-expander ${row.hasChildren ? "has-children" : "is-empty"}" ${row.hasChildren ? `data-environment-tree-toggle-id="${utils.escapeHtml(row.id)}"` : ""} aria-hidden="true">${expandedText}</span>
            <span class="node-level-label">${utils.escapeHtml(levelLabel[row.level] || row.level)}</span>
            <span class="node-copy">
              <span class="node-title">${utils.escapeHtml(row.title)}</span>
              <span class="environment-node-meta">${utils.escapeHtml(row.meta)}</span>
            </span>
          </button>
        `;
      })
      .join("");
  }

  components.EnvironmentTree = { render };
})();
