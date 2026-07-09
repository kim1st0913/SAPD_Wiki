(function () {
  const components = (window.sapdComponents = window.sapdComponents || {});
  const utils = components.utils;

  function cell(value) {
    const text = value == null || value === "" ? "待补充" : value;
    return utils.escapeHtml(text);
  }

  function itemLabel(item) {
    if (!item || typeof item !== "object") return utils.text(item).trim();
    return [item.code, utils.titleOf(item)].filter(Boolean).join(" ");
  }

  function relationTooltip(title, items, emptyText) {
    const rows = utils.list(items).map(itemLabel).filter(Boolean);
    if (!rows.length) return `${title}\n${emptyText}`;
    return `${title}\n${rows.map((row, index) => `${index + 1}. ${row}`).join("\n")}`;
  }

  function countBubble(value, tooltip, label) {
    const count = Number(value) || 0;
    return `
      <button class="standard-tooltip-chip maintenance-count-bubble" type="button" data-tooltip="${utils.escapeHtml(tooltip)}" aria-label="${utils.escapeHtml(label)}">
        ${utils.escapeHtml(count)}
      </button>
    `;
  }

  function renderLegacyTable(tableRows, selectedId) {
    return `
      <div class="maintenance-table-scroll">
        <table class="maintenance-data-table scope-maintenance-table">
          <thead>
            <tr>
              <th>作用域编码</th>
              <th>作用域名称</th>
              <th>情景</th>
              <th>描述</th>
              <th>关联服务数</th>
              <th>关联对象数</th>
            </tr>
          </thead>
          <tbody>
            ${tableRows
              .map(
                (row) => `
                  <tr class="${row.id === selectedId ? "active" : ""}" data-maintenance-id="${utils.escapeHtml(row.id)}">
                    <td><strong>${cell(row.code)}</strong></td>
                    <td>${cell(row.title)}</td>
                    <td>${cell(row.scenario)}</td>
                    <td class="maintenance-description-cell"><span>${cell(row.description)}</span></td>
                    <td>${countBubble(
                      row.serviceCount,
                      relationTooltip("关联安全技术服务清单", row.linkedServices, "暂无关联安全技术服务"),
                      `${row.title || row.code || "当前作用域"} 的关联安全技术服务清单`,
                    )}</td>
                    <td>${countBubble(
                      row.informationObjectCount,
                      relationTooltip("关联信息化对象清单", row.informationObjects, "暂无关联信息化对象"),
                      `${row.title || row.code || "当前作用域"} 的关联信息化对象清单`,
                    )}</td>
                  </tr>
                `,
              )
              .join("")}
          </tbody>
        </table>
      </div>
    `;
  }

  function renderTypicalObjects(items) {
    const values = utils.list(items).map((item) => utils.text(item).trim()).filter(Boolean);
    if (!values.length) return '<span class="scope-subclass-muted">待补充</span>';
    return `
      <div class="scope-subclass-candidates">
        ${values.map((item) => `<span class="scope-subclass-chip">${utils.escapeHtml(item)}</span>`).join("")}
      </div>
    `;
  }

  function renderScopeIdentity(row) {
    return `
      <div class="scope-subclass-identity ${row.isChildScope ? "is-child" : "is-parent"}">
        <strong>${cell(row.code)}</strong>
        <span>${cell(row.title)}</span>
      </div>
    `;
  }

  function renderServiceCell(row) {
    if (row.isChildScope && !row.serviceCount) {
      return `<span class="scope-subclass-empty">${utils.escapeHtml(row.emptyServiceMessage || "暂无已挂载安全技术服务。")}</span>`;
    }
    const count = row.isChildScope ? row.serviceCount : row.aggregateServiceCount || row.serviceCount;
    if (!row.isChildScope) {
      return `<span class="scope-subclass-parent-count">${utils.escapeHtml(count)} 项子作用域服务</span>`;
    }
    return countBubble(
      row.serviceCount,
      relationTooltip("关联安全技术服务清单", row.linkedServices, "暂无关联安全技术服务"),
      `${row.title || row.code || "当前作用域"} 的关联安全技术服务清单`,
    );
  }

  function renderHierarchyRow(row, selectedId, kind) {
    const isChild = kind === "child";
    const rowClass = [
      row.id === selectedId ? "active" : "",
      isChild ? "scope-subclass-child-row" : "scope-subclass-parent-row",
    ]
      .filter(Boolean)
      .join(" ");
    return `
      <tr class="${rowClass}" data-maintenance-id="${utils.escapeHtml(row.id)}">
        <td>${renderScopeIdentity(row)}</td>
        <td>${isChild ? cell(row.parentScopeCode) : '<span class="scope-subclass-muted">父作用域</span>'}</td>
        <td class="maintenance-description-cell"><span>${cell(row.description)}</span></td>
        <td>${renderServiceCell(row)}</td>
        <td>${renderTypicalObjects(row.typicalObjectCandidates)}</td>
      </tr>
    `;
  }

  function renderHierarchyTable(hierarchyRows, selectedId) {
    return `
      <div class="maintenance-table-scroll">
        <table class="maintenance-data-table scope-maintenance-table scope-subclass-table">
          <thead>
            <tr>
              <th>作用域</th>
              <th>parent_scope_code</th>
              <th>定义</th>
              <th>关联安全技术服务数量</th>
              <th>典型对象候选</th>
            </tr>
          </thead>
          <tbody>
            ${utils
              .list(hierarchyRows)
              .map((row) => [renderHierarchyRow(row, selectedId, "parent"), ...utils.list(row.children).map((child) => renderHierarchyRow(child, selectedId, "child"))].join(""))
              .join("")}
          </tbody>
        </table>
      </div>
    `;
  }

  function render({ rows, hierarchyRows, hasHierarchy, selectedId, emptyState }) {
    const tableRows = utils.list(rows);
    if (!tableRows.length) {
      return `<div class="maintenance-empty-state">${utils.escapeHtml(emptyState || "暂无作用域数据。")}</div>`;
    }
    return hasHierarchy ? renderHierarchyTable(hierarchyRows, selectedId) : renderLegacyTable(tableRows, selectedId);
  }

  components.ScopeMaintenanceTable = { render };
})();
