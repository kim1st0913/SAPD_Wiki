(function () {
  const components = (window.sapdComponents = window.sapdComponents || {});
  const utils = components.utils;
  const display = window.sapdDisplay || {};

  function valueText(value) {
    if (value == null || value === "") return "待补充";
    return value;
  }

  function entityLabel(item, empty = "待补充") {
    if (!item) return empty;
    const code = utils.text(item.code || "").trim();
    const title = utils.titleOf(item, empty);
    return [code, title].filter(Boolean).join(" ");
  }

  function chipList(items, empty = "待补充", fallbackKind = "") {
    if (display.relationChipList) return display.relationChipList(utils, items, { empty, kind: fallbackKind });
    const rows = utils.list(items).filter(Boolean);
    if (!rows.length) return `<span class="empty-inline">${utils.escapeHtml(empty)}</span>`;
    return rows
      .map((item) => `<span class="relation-chip ${display.chipClass?.(fallbackKind) || ""}">${utils.escapeHtml(entityLabel(item, empty))}</span>`)
      .join("");
  }

  function statusLine(label, value) {
    return `<span class="module-mapping-status"><em>${utils.escapeHtml(label)}</em>${utils.escapeHtml(valueText(value))}</span>`;
  }

  function levelChip(label) {
    return `<span class="type-pill">${utils.escapeHtml(label)}</span>`;
  }

  function groupId(parts) {
    return parts
      .map((part) =>
        utils
          .text(part)
          .trim()
          .replace(/[^\w\u4e00-\u9fa5-]+/g, "-")
          .replace(/^-+|-+$/g, ""),
      )
      .filter(Boolean)
      .join("-");
  }

  function primarySystem(row) {
    return utils.list(row.linkedSystems)[0]?.title || "未分组安全系统";
  }

  function categoryLabel(row) {
    const category = utils.text(row.category).trim();
    if (category) return category;
    return "未归入安全技术模块清单";
  }

  function groupedRows(rows) {
    const categories = [];
    const categoryMap = new Map();
    for (const row of rows) {
      const category = categoryLabel(row);
      if (!categoryMap.has(category)) {
        const group = { label: category, rows: [], systems: [], systemMap: new Map() };
        categories.push(group);
        categoryMap.set(category, group);
      }
      const categoryGroup = categoryMap.get(category);
      categoryGroup.rows.push(row);
      const system = primarySystem(row);
      if (!categoryGroup.systemMap.has(system)) {
        const systemGroup = { label: system, rows: [] };
        categoryGroup.systems.push(systemGroup);
        categoryGroup.systemMap.set(system, systemGroup);
      }
      categoryGroup.systemMap.get(system).rows.push(row);
    }
    return categories;
  }

  function renderDetailRows(rows, selectedId, parentId, lineage, hidden) {
    const hiddenAttr = hidden ? " hidden" : "";
    return rows
      .map(
        (row) => `
          <tr class="maintenance-data-row standard-group-detail ${row.id === selectedId ? "active" : ""}" data-standard-parent="${utils.escapeHtml(parentId)}" data-standard-lineage="${utils.escapeHtml(lineage.join(" "))}"${hiddenAttr} data-maintenance-id="${utils.escapeHtml(row.id)}">
            <td>
              <div class="module-title-cell">
                <strong>${utils.escapeHtml(valueText(row.title))}</strong>
                <span>${utils.escapeHtml(valueText(row.description))}</span>
              </div>
            </td>
            <td>${chipList(row.linkedServices, "暂无关联安全技术服务", "安全技术服务")}</td>
            <td>
              <div class="module-mapping-cell">
                ${statusLine("作用域", row.scopeMappingStatus)}
                ${statusLine("对象", row.informationObjectMappingStatus)}
                ${statusLine("环境", row.informationEnvironmentStatus)}
              </div>
            </td>
          </tr>
        `,
      )
      .join("");
  }

  function renderGroupedRows(rows, selectedId, search) {
    const expandAll = Boolean(utils.text(search).trim());
    return groupedRows(rows)
      .map((category, categoryIndex) => {
        const categoryId = groupId(["module-category", categoryIndex, category.label]);
        const categoryExpanded = expandAll;
        const categoryHiddenAttr = "";
        const systemRows = category.systems
          .map((system, systemIndex) => {
            const systemId = groupId([categoryId, "system", systemIndex, system.label]);
            const systemExpanded = expandAll;
            const systemHidden = !categoryExpanded;
            const systemHiddenAttr = systemHidden ? " hidden" : "";
            return `
              <tr class="standard-group-row depth-1 ${systemExpanded ? "expanded" : ""}" data-standard-group="${utils.escapeHtml(systemId)}" data-standard-parent="${utils.escapeHtml(categoryId)}" data-standard-lineage="${utils.escapeHtml(categoryId)}"${systemHiddenAttr}>
                <td colspan="3">
                  <button class="standard-group-toggle" type="button" aria-expanded="${systemExpanded ? "true" : "false"}" style="padding-left: 30px;">
                    <span class="standard-group-caret">›</span>
                    <span class="standard-group-main"><strong>${levelChip("安全系统")} ${utils.escapeHtml(system.label)}</strong></span>
                    <em>${utils.escapeHtml(`${system.rows.length} 个模块`)}</em>
                  </button>
                </td>
              </tr>
              ${renderDetailRows(system.rows, selectedId, systemId, [categoryId, systemId], !systemExpanded)}
            `;
          })
          .join("");
        return `
          <tr class="standard-group-row depth-0 ${categoryExpanded ? "expanded" : ""}" data-standard-group="${utils.escapeHtml(categoryId)}"${categoryHiddenAttr}>
            <td colspan="3">
              <button class="standard-group-toggle" type="button" aria-expanded="${categoryExpanded ? "true" : "false"}" style="padding-left: 10px;">
                <span class="standard-group-caret">›</span>
                <span class="standard-group-main"><strong>${levelChip("领域分类")} ${utils.escapeHtml(category.label)}</strong></span>
                <em>${utils.escapeHtml(`${category.systems.length} 个安全系统 · ${category.rows.length} 个模块`)}</em>
              </button>
            </td>
          </tr>
          ${systemRows}
        `;
      })
      .join("");
  }

  function render({ rows, selectedId, emptyState, search }) {
    const tableRows = utils.list(rows);
    if (!tableRows.length) {
      return `<div class="maintenance-empty-state">${utils.escapeHtml(emptyState || "暂无安全技术模块数据，请确认 ETL 是否已导出 security_technology_modules。")}</div>`;
    }
    return `
      <div class="maintenance-table-scroll">
        <table class="maintenance-data-table technology-module-maintenance-table">
          <thead>
            <tr>
              <th>${utils.escapeHtml(display.label?.("security_technology_module", "安全技术模块") || "安全技术模块")} / 定义</th>
              <th>${utils.escapeHtml(display.relationLabel?.("security_technical_service") || "关联安全技术服务")}</th>
              <th>作用域 / 对象 / 环境</th>
            </tr>
          </thead>
          <tbody>
            ${renderGroupedRows(tableRows, selectedId, search)}
          </tbody>
        </table>
      </div>
    `;
  }

  components.TechnologyModuleMaintenanceTable = { render };
})();
