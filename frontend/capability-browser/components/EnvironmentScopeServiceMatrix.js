(function () {
  const components = (window.sapdComponents = window.sapdComponents || {});
  const utils = components.utils;
  const display = window.sapdDisplay || {};

  function technicalChipClass(kind) {
    if (display.chipClass) return display.chipClass(kind);
    if (kind.includes("模块")) return "technical-chip module-chip";
    if (kind.includes("措施")) return "technical-chip measure-chip";
    if (kind.includes("说明")) return "note-chip";
    return "";
  }

  function annotationAttrs(value) {
    return display.annotationValueAttrs?.(utils, value) || "";
  }

  function chipList(items, empty = "暂无", limit = Infinity, fallbackKind = "") {
    if (display.relationChipList) return display.relationChipList(utils, items, { empty, limit, kind: fallbackKind, showKind: true });
    const rows = utils.list(items).filter(Boolean);
    if (!rows.length) return `<span class="empty-inline">${utils.escapeHtml(empty)}</span>`;
    const visible = Number.isFinite(limit) ? rows.slice(0, limit) : rows;
    const more = rows.length - visible.length;
    return `${visible
      .map((item) => {
        const kind = item.kind || item.objectKind || fallbackKind;
        const label = utils.codeTitleOf(item);
        const annotationText = [kind, label].filter(Boolean).join(" | ");
        return `<span class="relation-chip ${technicalChipClass(kind)}"${annotationAttrs(annotationText)}>${kind ? `<em>${utils.escapeHtml(kind)}</em>` : ""}${utils.escapeHtml(label)}</span>`;
      })
      .join("")}${more > 0 ? `<span class="relation-chip muted">+${more}</span>` : ""}`;
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

  function segmentLabel(row) {
    return utils.list(row.segments)[0]?.title || "未定义环境子类";
  }

  function objectLabel(row) {
    const code = utils.text(row.object?.code || "").trim();
    const title = utils.titleOf(row.object, "当前信息化对象");
    return [code, title].filter(Boolean).join(" ");
  }

  function groupedRows(rows, showObjectColumn) {
    const groups = [];
    const groupMap = new Map();
    for (const row of rows) {
      const primary = showObjectColumn ? segmentLabel(row) : "当前信息化对象";
      if (!groupMap.has(primary)) {
        const group = { label: primary, rows: [], children: [], childMap: new Map() };
        groups.push(group);
        groupMap.set(primary, group);
      }
      const group = groupMap.get(primary);
      group.rows.push(row);
      const childLabel = showObjectColumn ? objectLabel(row) : `${row.scope?.code ? `${row.scope.code} ` : ""}${utils.titleOf(row.scope, "未命名作用域")}`;
      if (!group.childMap.has(childLabel)) {
        const child = { label: childLabel, rows: [] };
        group.children.push(child);
        group.childMap.set(childLabel, child);
      }
      group.childMap.get(childLabel).rows.push(row);
    }
    return groups;
  }

  function renderDetailRow(row, showObjectColumn, selectedRowId, parentId, lineage, hidden) {
    const hiddenAttr = hidden ? " hidden" : "";
    return `
      <tr class="maintenance-data-row standard-group-detail ${row.id === selectedRowId ? "active" : ""}" data-standard-parent="${utils.escapeHtml(parentId)}" data-standard-lineage="${utils.escapeHtml(lineage.join(" "))}"${hiddenAttr} data-environment-row-id="${utils.escapeHtml(row.id || row.scope?.id || "")}">
        ${showObjectColumn ? `<td>${chipList(row.segments, "未定义环境子类", 2)}</td>` : ""}
        ${showObjectColumn ? `<td><strong>${utils.escapeHtml(row.object?.code || "")}</strong><span>${utils.escapeHtml(row.object?.title || "未命名对象")}</span></td>` : ""}
        <td><strong>${utils.escapeHtml(row.scope?.code || "")}</strong><span>${utils.escapeHtml(row.scope?.title || "未命名作用域")}</span></td>
        <td>${chipList(row.services, display.state?.("no_applicable_service") || "无适用服务", Infinity, "安全技术服务")}</td>
        <td>${chipList(row.modules, row.services?.length ? display.state?.("no_module_or_measure") || "/" : display.state?.("not_applicable") || "不适用")}</td>
      </tr>
    `;
  }

  function renderGroupedBody(rows, showObjectColumn, selectedRowId) {
    const colspan = showObjectColumn ? 5 : 3;
    return groupedRows(rows, showObjectColumn)
      .map((group, groupIndex) => {
        const groupKey = groupId(["environment-mapping", groupIndex, group.label]);
        const groupExpanded = groupIndex === 0;
        const childRows = group.children
          .map((child, childIndex) => {
            const childKey = groupId([groupKey, childIndex, child.label]);
            const childExpanded = groupExpanded && childIndex === 0;
            const childHiddenAttr = groupExpanded ? "" : " hidden";
            return `
              <tr class="standard-group-row depth-1 ${childExpanded ? "expanded" : ""}" data-standard-group="${utils.escapeHtml(childKey)}" data-standard-parent="${utils.escapeHtml(groupKey)}" data-standard-lineage="${utils.escapeHtml(groupKey)}"${childHiddenAttr}>
                <td colspan="${colspan}">
                  <button class="standard-group-toggle" type="button" aria-expanded="${childExpanded ? "true" : "false"}">
                    <span class="standard-group-caret">›</span>
                    <span class="standard-group-main"><strong>${utils.escapeHtml(child.label)}</strong></span>
                    <em>${utils.escapeHtml(`${child.rows.length} 条映射`)}</em>
                  </button>
                </td>
              </tr>
              ${child.rows.map((row) => renderDetailRow(row, showObjectColumn, selectedRowId, childKey, [groupKey, childKey], !childExpanded)).join("")}
            `;
          })
          .join("");
        return `
          <tr class="standard-group-row depth-0 ${groupExpanded ? "expanded" : ""}" data-standard-group="${utils.escapeHtml(groupKey)}">
            <td colspan="${colspan}">
              <button class="standard-group-toggle" type="button" aria-expanded="${groupExpanded ? "true" : "false"}">
                <span class="standard-group-caret">›</span>
                <span class="standard-group-main"><strong>${utils.escapeHtml(group.label)}</strong></span>
                <em>${utils.escapeHtml(`${group.children.length} 组 · ${group.rows.length} 条映射`)}</em>
              </button>
            </td>
          </tr>
          ${childRows}
        `;
      })
      .join("");
  }

  function render({ rows, showObjectColumn = false, selectedRowId = "", grouped = false }) {
    const mappingRows = utils.list(rows);
    const colspan = showObjectColumn ? 5 : 3;
    return `
      <section class="semantic-panel environment-mapping-section">
        <div class="matrix-section-head">
          <div>
            <h3>${grouped ? "环境视角归纳表" : "环境视角映射表"}</h3>
            <p>${grouped ? "按环境子类、信息化对象和作用域归纳展开，保留现有映射明细。" : "信息化环境 → 环境子类 → 信息化对象 → 安全作用域 → 安全技术服务 → 安全技术模块/措施"}</p>
          </div>
          <span>${mappingRows.length} 条映射</span>
        </div>
        <div class="${grouped ? "maintenance-table-scroll" : "relationship-matrix-scroll semantic-scroll"}">
          <table class="${grouped ? "maintenance-data-table environment-mapping-summary-table" : `semantic-mapping-table environment-mapping-table ${showObjectColumn ? "with-object-column" : "without-object-column"}`}">
            <thead>
              <tr>
                ${showObjectColumn ? "<th>环境子类</th><th>信息化对象</th>" : ""}
                <th>${utils.escapeHtml(display.label?.("scope_type", "作用域") || "作用域")}</th>
                <th>${utils.escapeHtml(display.label?.("security_technical_service", "安全技术服务") || "安全技术服务")}</th>
                <th>${utils.escapeHtml(display.label?.("security_module_or_measure", "安全技术模块/措施") || "安全技术模块/措施")}</th>
              </tr>
            </thead>
            <tbody>
              ${
                mappingRows.length
                  ? grouped
                    ? renderGroupedBody(mappingRows, showObjectColumn, selectedRowId)
                    : mappingRows
                        .map(
                          (row) => `
                            <tr class="${row.id === selectedRowId ? "active" : ""}" data-environment-row-id="${utils.escapeHtml(row.id || row.scope?.id || "")}">
                              ${showObjectColumn ? `<td>${chipList(row.segments, "未定义环境子类", 2)}</td>` : ""}
                              ${showObjectColumn ? `<td><strong>${utils.escapeHtml(row.object?.code || "")}</strong><span>${utils.escapeHtml(row.object?.title || "未命名对象")}</span></td>` : ""}
                              <td><strong>${utils.escapeHtml(row.scope?.code || "")}</strong><span>${utils.escapeHtml(row.scope?.title || "未命名作用域")}</span></td>
                              <td>${chipList(row.services, display.state?.("no_applicable_service") || "无适用服务", Infinity, "安全技术服务")}</td>
                              <td>${chipList(row.modules, row.services?.length ? display.state?.("no_module_or_measure") || "/" : display.state?.("not_applicable") || "不适用")}</td>
                            </tr>
                          `,
                        )
                        .join("")
                  : `<tr><td colspan="${colspan}"><div class="reference-empty">暂无环境映射</div></td></tr>`
              }
            </tbody>
          </table>
        </div>
      </section>
    `;
  }

  components.EnvironmentScopeServiceMatrix = { render };
})();
