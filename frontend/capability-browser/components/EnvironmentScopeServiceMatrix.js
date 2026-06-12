(function () {
  const components = (window.sapdComponents = window.sapdComponents || {});
  const utils = components.utils;
  const display = window.sapdDisplay || {};

  function technicalChipClass(kind) {
    if (display.chipClass) return display.chipClass(kind);
    if (kind.includes("模块")) return "technical-chip module-chip";
    if (kind.includes("措施")) return "technical-chip measure-chip";
    if (kind.includes("安全系统")) return "system-chip";
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
        const isService = utils.text(kind).includes("服务");
        const annotationText = [isService ? "" : kind, label].filter(Boolean).join(" | ");
        return `<span class="relation-chip ${technicalChipClass(kind)}"${annotationAttrs(annotationText)}>${kind && !isService ? `<em>${utils.escapeHtml(kind)}</em>` : ""}${utils.escapeHtml(label)}</span>`;
      })
      .join("")}${more > 0 ? `<span class="relation-chip muted">+${more}</span>` : ""}`;
  }

  function scopeValue(row) {
    const scopes = utils.list(row.scopes || (row.scope ? [row.scope] : []));
    if (!scopes.length) return `<span class="empty-inline">未命名作用域</span>`;
    const values = scopes.map((scope) => utils.codeTitleOf(scope)).filter(Boolean);
    const value = values.join("\n");
    return `<span class="environment-scope-value"${annotationAttrs(value)}>${values.map((item) => `<span class="environment-scope-line">${utils.escapeHtml(item)}</span>`).join("")}</span>`;
  }

  function moduleMeasureItems(row) {
    return [...utils.list(row.modules), ...utils.list(row.measures)];
  }

  function moduleMeasureKey(row) {
    const items = moduleMeasureItems(row);
    if (!items.length) return "__empty_module_measure__";
    return items.map((item) => [item.id, item.code, item.title || item.name, item.kind || item.objectKind || item.type].filter(Boolean).join("::")).join("||");
  }

  function securitySystemKey(row) {
    const items = utils.list(row.securitySystems);
    if (!items.length) return "__empty_security_system__";
    return items.map((item) => [item.id, item.code, item.title || item.name, item.kind || item.objectKind || item.type].filter(Boolean).join("::")).join("||");
  }

  function mergedCellRowspan(rows, rowIndex, keyForRow) {
    const currentKey = keyForRow(rows[rowIndex]);
    if (rowIndex > 0 && keyForRow(rows[rowIndex - 1]) === currentKey) return 0;
    let rowspan = 1;
    for (let index = rowIndex + 1; index < rows.length; index += 1) {
      if (keyForRow(rows[index]) !== currentKey) break;
      rowspan += 1;
    }
    return rowspan;
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
      const childLabel = showObjectColumn ? objectLabel(row) : "当前信息化对象";
      if (!group.childMap.has(childLabel)) {
        const child = { label: childLabel, rows: [] };
        group.children.push(child);
        group.childMap.set(childLabel, child);
      }
      group.childMap.get(childLabel).rows.push(row);
    }
    return groups;
  }

  function renderDetailRow(row, showObjectColumn, selectedRowId, parentId, lineage, hidden, scopeCellHtml = "", moduleMeasuresCellHtml = "", securitySystemsCellHtml = "") {
    const hiddenAttr = hidden ? " hidden" : "";
    return `
      <tr class="maintenance-data-row standard-group-detail ${row.id === selectedRowId ? "active" : ""}" data-standard-parent="${utils.escapeHtml(parentId)}" data-standard-lineage="${utils.escapeHtml(lineage.join(" "))}"${hiddenAttr} data-environment-row-id="${utils.escapeHtml(row.id || row.scope?.id || "")}">
        ${showObjectColumn ? `<td>${chipList(row.segments, "未定义环境子类", 2)}</td>` : ""}
        ${showObjectColumn ? `<td><strong>${utils.escapeHtml(row.object?.code || "")}</strong><span>${utils.escapeHtml(row.object?.title || "未命名对象")}</span></td>` : ""}
        ${scopeCellHtml}
        <td>${chipList(row.services, display.state?.("no_applicable_service") || "无适用服务", Infinity, "安全技术服务")}</td>
        ${moduleMeasuresCellHtml}
        ${securitySystemsCellHtml}
      </tr>
    `;
  }

  function renderGroupedBody(rows, showObjectColumn, selectedRowId) {
    const colspan = showObjectColumn ? 6 : 4;
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
              ${child.rows
                .map((row, rowIndex) => {
                  const scopeCellHtml =
                    rowIndex === 0
                      ? `<td class="environment-scope-merged-cell" rowspan="${Math.max(child.rows.length, 1)}">${scopeValue(row)}</td>`
                      : "";
                  const moduleRowspan = mergedCellRowspan(child.rows, rowIndex, moduleMeasureKey);
                  const moduleMeasuresCellHtml =
                    moduleRowspan > 0
                      ? `<td class="environment-module-measure-merged-cell" rowspan="${moduleRowspan}">${chipList(moduleMeasureItems(row), row.services?.length ? "待补充安全技术模块/措施" : display.state?.("not_applicable") || "不适用", Infinity, "安全技术模块/措施")}</td>`
                      : "";
                  const securitySystemRowspan = mergedCellRowspan(child.rows, rowIndex, securitySystemKey);
                  const securitySystemsCellHtml =
                    securitySystemRowspan > 0
                      ? `<td class="environment-security-system-merged-cell" rowspan="${securitySystemRowspan}">${chipList(row.securitySystems, row.services?.length ? "待补充安全系统" : display.state?.("not_applicable") || "不适用", Infinity, "安全系统")}</td>`
                      : "";
                  return renderDetailRow(row, showObjectColumn, selectedRowId, childKey, [groupKey, childKey], !childExpanded, scopeCellHtml, moduleMeasuresCellHtml, securitySystemsCellHtml);
                })
                .join("")}
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

  function flatRowGroups(rows, showObjectColumn) {
    const groups = [];
    const groupMap = new Map();
    for (const row of rows) {
      const key = showObjectColumn ? row.object?.id || row.object?.code || row.object?.title || "unknown-object" : "current-object";
      if (!groupMap.has(key)) {
        const group = { key, rows: [] };
        groups.push(group);
        groupMap.set(key, group);
      }
      groupMap.get(key).rows.push(row);
    }
    return groups;
  }

  function renderFlatBody(rows, showObjectColumn, selectedRowId) {
    return flatRowGroups(rows, showObjectColumn)
      .map((group) =>
        group.rows
          .map((row, rowIndex) => {
            const scopeCellHtml =
              rowIndex === 0
                ? `<td class="environment-scope-merged-cell" rowspan="${Math.max(group.rows.length, 1)}">${scopeValue(row)}</td>`
                : "";
            const moduleRowspan = mergedCellRowspan(group.rows, rowIndex, moduleMeasureKey);
            const moduleMeasuresCellHtml =
              moduleRowspan > 0
                ? `<td class="environment-module-measure-merged-cell" rowspan="${moduleRowspan}">${chipList(moduleMeasureItems(row), row.services?.length ? "待补充安全技术模块/措施" : display.state?.("not_applicable") || "不适用", Infinity, "安全技术模块/措施")}</td>`
                : "";
            const securitySystemRowspan = mergedCellRowspan(group.rows, rowIndex, securitySystemKey);
            const securitySystemsCellHtml =
              securitySystemRowspan > 0
                ? `<td class="environment-security-system-merged-cell" rowspan="${securitySystemRowspan}">${chipList(row.securitySystems, row.services?.length ? "待补充安全系统" : display.state?.("not_applicable") || "不适用", Infinity, "安全系统")}</td>`
                : "";
            return `
              <tr class="${row.id === selectedRowId ? "active" : ""}" data-environment-row-id="${utils.escapeHtml(row.id || row.scope?.id || "")}">
                ${showObjectColumn ? `<td>${chipList(row.segments, "未定义环境子类", 2)}</td>` : ""}
                ${showObjectColumn ? `<td><strong>${utils.escapeHtml(row.object?.code || "")}</strong><span>${utils.escapeHtml(row.object?.title || "未命名对象")}</span></td>` : ""}
                ${scopeCellHtml}
                <td>${chipList(row.services, display.state?.("no_applicable_service") || "无适用服务", Infinity, "安全技术服务")}</td>
                ${moduleMeasuresCellHtml}
                ${securitySystemsCellHtml}
              </tr>
            `;
          })
          .join(""),
      )
      .join("");
  }

  function render({ rows, showObjectColumn = false, selectedRowId = "", grouped = false }) {
    const mappingRows = utils.list(rows);
    const colspan = showObjectColumn ? 6 : 4;
    return `
      <section class="semantic-panel environment-mapping-section">
        <div class="matrix-section-head">
          <div>
            <h3>${grouped ? "环境视角归纳表" : "环境视角映射表"}</h3>
            <p>${grouped ? "按环境子类、信息化对象归纳展开，作用域按对象唯一值合并，技术链路按模块 / 措施聚合关联服务。" : "信息化环境 → 环境子类 → 信息化对象 → 安全作用域 → 安全技术服务 → 安全技术模块 / 措施 → 安全系统"}</p>
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
                <th>安全系统</th>
              </tr>
            </thead>
            <tbody>
              ${
                mappingRows.length
                  ? grouped
                    ? renderGroupedBody(mappingRows, showObjectColumn, selectedRowId)
                    : renderFlatBody(mappingRows, showObjectColumn, selectedRowId)
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
