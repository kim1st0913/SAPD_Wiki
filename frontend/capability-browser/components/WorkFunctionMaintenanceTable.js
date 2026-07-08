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

  function tooltipText(title, items, empty = "暂无关联对象") {
    const rows = utils.list(items).map(itemLabel).filter(Boolean);
    if (!rows.length) return `${title}\n${empty}`;
    return `${title}\n${rows.map((row, index) => `${index + 1}. ${row}`).join("\n")}`;
  }

  function processTooltip(row) {
    const groups = utils.list(row.processGroups).map(itemLabel).filter(Boolean);
    const processes = utils.list(row.processReferences).map(itemLabel).filter(Boolean);
    const groupText = groups.length ? groups.map((item, index) => `${index + 1}. ${item}`).join("\n") : "暂无关联流程组";
    const processText = processes.length ? processes.map((item, index) => `${index + 1}. ${item}`).join("\n") : "暂无关联流程";
    return `关联流程组\n${groupText}\n\n关联流程\n${processText}`;
  }

  function countBubble(value, tooltip, label) {
    const count = Number(value) || 0;
    return `
      <button class="standard-tooltip-chip maintenance-count-bubble" type="button" data-tooltip="${utils.escapeHtml(tooltip)}" aria-label="${utils.escapeHtml(label)}">
        ${utils.escapeHtml(count)}
      </button>
    `;
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

  function groupedRows(rows) {
    const layers = [];
    const layerMap = new Map();
    for (const row of rows) {
      const layerLabel = row.securityFunctionLayer || "待补充安全职能层";
      if (!layerMap.has(layerLabel)) {
        const layer = { label: layerLabel, rows: [], groups: [], groupMap: new Map() };
        layers.push(layer);
        layerMap.set(layerLabel, layer);
      }
      const layer = layerMap.get(layerLabel);
      layer.rows.push(row);
      const groupLabel = row.functionGroup || "待补充职能组";
      if (!layer.groupMap.has(groupLabel)) {
        const group = { label: groupLabel, rows: [] };
        layer.groups.push(group);
        layer.groupMap.set(groupLabel, group);
      }
      layer.groupMap.get(groupLabel).rows.push(row);
    }
    return layers;
  }

  function hasSelected(rows, selectedId) {
    const id = utils.text(selectedId).trim();
    return Boolean(id) && utils.list(rows).some((row) => utils.text(row?.id).trim() === id);
  }

  function renderDetailRows(rows, selectedId, parentId, lineage, hidden) {
    const hiddenAttr = hidden ? " hidden" : "";
    return rows
      .map(
        (row) => `
          <tr class="maintenance-data-row standard-group-detail ${row.id === selectedId ? "active" : ""}" data-standard-parent="${utils.escapeHtml(parentId)}" data-standard-lineage="${utils.escapeHtml(lineage.join(" "))}"${hiddenAttr} data-maintenance-id="${utils.escapeHtml(row.id)}">
            <td><strong>${cell(row.code)}</strong></td>
            <td>${cell(row.title)}</td>
            <td class="maintenance-description-cell"><span>${cell(row.description)}</span></td>
            <td>${countBubble(row.gbtReferenceCount, tooltipText("GB/T 42446-2023 映射", row.gbtReferences), `${row.title} 的 GB/T 42446-2023 映射`)}</td>
            <td>${countBubble(row.gartnerReferenceCount, tooltipText("Gartner 映射", row.gartnerReferences), `${row.title} 的 Gartner 映射`)}</td>
            <td>${countBubble(row.processRelationCount, processTooltip(row), `${row.title} 的关联流程组和流程`)}</td>
          </tr>
        `,
      )
      .join("");
  }

  function renderGroupedRows(rows, selectedId, search) {
    const expandAll = Boolean(utils.text(search).trim());
    return groupedRows(rows)
      .map((layer, layerIndex) => {
        const layerId = groupId(["work-function-layer", layerIndex, layer.label]);
        const layerExpanded = expandAll || hasSelected(layer.rows, selectedId);
        const groupRows = layer.groups
          .map((group, groupIndex) => {
            const functionGroupId = groupId([layerId, "group", groupIndex, group.label]);
            const groupExpanded = expandAll || hasSelected(group.rows, selectedId);
            const groupHidden = !layerExpanded;
            const groupHiddenAttr = groupHidden ? " hidden" : "";
            return `
              <tr class="standard-group-row depth-1 ${groupExpanded ? "expanded" : ""}" data-standard-group="${utils.escapeHtml(functionGroupId)}" data-standard-parent="${utils.escapeHtml(layerId)}" data-standard-lineage="${utils.escapeHtml(layerId)}"${groupHiddenAttr}>
                <td colspan="6">
                  <button class="standard-group-toggle" type="button" aria-expanded="${groupExpanded ? "true" : "false"}">
                    <span class="standard-group-caret">›</span>
                    <span class="standard-group-main"><strong>${cell(group.label)}</strong></span>
                    <em>${cell(`${group.rows.length} 个安全职能`)}</em>
                  </button>
                </td>
              </tr>
              ${renderDetailRows(group.rows, selectedId, functionGroupId, [layerId, functionGroupId], !groupExpanded)}
            `;
          })
          .join("");
        return `
          <tr class="standard-group-row depth-0 ${layerExpanded ? "expanded" : ""}" data-standard-group="${utils.escapeHtml(layerId)}">
            <td colspan="6">
              <button class="standard-group-toggle" type="button" aria-expanded="${layerExpanded ? "true" : "false"}">
                <span class="standard-group-caret">›</span>
                <span class="standard-group-main"><strong>${cell(layer.label)}</strong></span>
                <em>${cell(`${layer.groups.length} 个职能组 · ${layer.rows.length} 个安全职能`)}</em>
              </button>
            </td>
          </tr>
          ${groupRows}
        `;
      })
      .join("");
  }

  function render({ rows, selectedId, emptyState, search }) {
    const tableRows = utils.list(rows);
    if (!tableRows.length) {
      return `<div class="maintenance-empty-state">${utils.escapeHtml(emptyState || "暂无职能清单数据。")}</div>`;
    }
    return `
      <div class="maintenance-table-scroll">
        <table class="maintenance-data-table work-function-maintenance-table">
          <thead>
            <tr>
              <th>安全职能编码</th>
              <th>安全职能名称</th>
              <th>定义</th>
              <th>GB/T 42446-2023 映射</th>
              <th>Gartner 映射</th>
              <th>关联流程组/流程</th>
            </tr>
          </thead>
          <tbody>
            ${renderGroupedRows(tableRows, selectedId, search)}
          </tbody>
        </table>
      </div>
    `;
  }

  components.WorkFunctionMaintenanceTable = { render };
})();
