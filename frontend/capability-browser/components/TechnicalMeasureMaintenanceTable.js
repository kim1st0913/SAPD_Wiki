(function () {
  const components = (window.sapdComponents = window.sapdComponents || {});
  const utils = components.utils;
  const display = window.sapdDisplay || {};

  function chipList(items, empty = "待补充", fallbackKind = "") {
    const rows = utils.list(items).filter(Boolean);
    if (!rows.length) return `<span class="empty-inline">${utils.escapeHtml(empty)}</span>`;
    return rows
      .map((item) => {
        const label = displayValue(item, empty);
        const annotationText = [fallbackKind, label].filter(Boolean).join(" | ");
        return `<span class="relation-chip ${display.chipClass?.(fallbackKind) || ""}"${display.annotationValueAttrs?.(utils, annotationText) || ""}><span class="relation-chip-text">${utils.escapeHtml(label)}</span></span>`;
      })
      .join("");
  }

  function displayValue(value, empty = "待补充") {
    if (value == null || value === "") return empty;
    if (typeof value === "number" && Number.isNaN(value)) return empty;
    const raw = typeof value === "object" ? utils.titleOf(value, empty) : value;
    const normalized = utils.text(raw).trim();
    return normalized && normalized !== "[object Object]" ? normalized : empty;
  }

  function render({ rows, selectedId, emptyState }) {
    const tableRows = utils.list(rows);
    if (!tableRows.length) {
      return `<div class="maintenance-empty-state">${utils.escapeHtml(emptyState || "暂无安全技术措施数据，请确认 ETL 是否已导出 security_technical_measures。")}</div>`;
    }
    return `
      <div class="maintenance-table-scroll">
        <table class="maintenance-data-table technical-measure-maintenance-table">
          <thead>
            <tr>
              <th>序号</th>
              <th>${utils.escapeHtml(display.label?.("security_technical_measure", "安全技术措施") || "安全技术措施")}</th>
              <th>${utils.escapeHtml(display.relationLabel?.("security_technical_service") || "关联安全技术服务")}</th>
              <th>${utils.escapeHtml(display.relationLabel?.("scope_type") || "关联作用域")}</th>
              <th>关联信息化环境</th>
            </tr>
          </thead>
          <tbody>
            ${tableRows
              .map(
                (row) => `
                  <tr class="${row.id === selectedId ? "active" : ""}" data-maintenance-id="${utils.escapeHtml(row.id)}">
                    <td>${utils.escapeHtml(displayValue(row.index))}</td>
                    <td>
                      <strong>${utils.escapeHtml(displayValue(row.measureName))}</strong>
                    </td>
                    <td>${chipList(row.serviceNames, row.serviceEmptyText || "待补充关联安全技术服务", "安全技术服务")}</td>
                    <td>${chipList(row.scopeNames, row.scopeEmptyText || "待补充关联作用域")}</td>
                    <td>
                      <div class="environment-combo-chip-list">
                        ${chipList(row.environmentObjectPairs, "待补充关联信息化环境", "信息化环境")}
                      </div>
                    </td>
                  </tr>
                `,
              )
              .join("")}
          </tbody>
        </table>
      </div>
    `;
  }

  components.TechnicalMeasureMaintenanceTable = { render };
})();
