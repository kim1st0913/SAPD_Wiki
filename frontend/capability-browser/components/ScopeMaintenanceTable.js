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

  function render({ rows, selectedId, emptyState }) {
    const tableRows = utils.list(rows);
    if (!tableRows.length) {
      return `<div class="maintenance-empty-state">${utils.escapeHtml(emptyState || "暂无作用域数据。")}</div>`;
    }
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

  components.ScopeMaintenanceTable = { render };
})();
