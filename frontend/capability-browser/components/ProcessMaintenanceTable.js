(function () {
  const components = (window.sapdComponents = window.sapdComponents || {});
  const utils = components.utils;
  const display = window.sapdDisplay || {};

  function cell(value) {
    const text = value == null || value === "" ? "待补充" : value;
    return utils.escapeHtml(text);
  }

  function itemLabel(item) {
    if (!item || typeof item !== "object") return utils.text(item).trim();
    return [item.code, utils.titleOf(item)].filter(Boolean).join(" ");
  }

  function securityFunctionTooltip(row) {
    const functions = utils.list(row.stakeholders).map(itemLabel).filter(Boolean);
    if (!functions.length) return "关联安全职能清单\n暂无关联安全职能";
    return `关联安全职能清单\n${functions.map((item, index) => `${index + 1}. ${item}`).join("\n")}`;
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
      return `<div class="maintenance-empty-state">${utils.escapeHtml(emptyState || "暂无流程清单数据。")}</div>`;
    }
    return `
      <div class="maintenance-table-scroll">
        <table class="maintenance-data-table process-maintenance-table">
          <thead>
            <tr>
              <th>流程域</th>
              <th>${utils.escapeHtml(display.label?.("l2_process_group", "L2 流程组") || "L2 流程组")}</th>
              <th>${utils.escapeHtml(display.label?.("l3_process", "L3 流程") || "L3 流程")}</th>
              <th>${utils.escapeHtml(display.label?.("l4_activity", "L4 活动") || "L4 活动")}状态</th>
              <th>关联安全职能数</th>
            </tr>
          </thead>
          <tbody>
            ${tableRows
              .map(
                (row) => `
                  <tr class="${row.id === selectedId ? "active" : ""}" data-maintenance-id="${utils.escapeHtml(row.id)}">
                    <td>${cell(row.domain)}</td>
                    <td>${cell(row.processGroup)}</td>
                    <td><strong>${cell(row.processReference)}</strong></td>
                    <td>${cell(row.l4ActivityStatus)}</td>
                    <td>${countBubble(row.securityFunctionCount, securityFunctionTooltip(row), `${row.processReference} 的关联安全职能清单`)}</td>
                  </tr>
                `,
              )
              .join("")}
          </tbody>
        </table>
      </div>
    `;
  }

  components.ProcessMaintenanceTable = { render };
})();
