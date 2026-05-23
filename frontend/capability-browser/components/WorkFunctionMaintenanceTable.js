(function () {
  const components = (window.sapdComponents = window.sapdComponents || {});
  const utils = components.utils;

  function cell(value) {
    const text = value == null || value === "" ? "待补充" : value;
    return utils.escapeHtml(text);
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

  function renderDetailRows(rows, selectedId, parentId, lineage, hidden) {
    const hiddenAttr = hidden ? " hidden" : "";
    return rows
      .map(
        (row) => `
          <tr class="maintenance-data-row standard-group-detail ${row.id === selectedId ? "active" : ""}" data-standard-parent="${utils.escapeHtml(parentId)}" data-standard-lineage="${utils.escapeHtml(lineage.join(" "))}"${hiddenAttr} data-maintenance-id="${utils.escapeHtml(row.id)}">
            <td><strong>${cell(row.code)}</strong></td>
            <td>${cell(row.title)}</td>
            <td class="maintenance-description-cell"><span>${cell(row.description)}</span></td>
            <td>${cell(row.securityWorkCount)}</td>
            <td>${cell(row.processCount)}</td>
          </tr>
        `,
      )
      .join("");
  }

  function renderGroupedRows(rows, selectedId) {
    const hasSelectedRow = rows.some((row) => row.id === selectedId);
    return groupedRows(rows)
      .map((layer, layerIndex) => {
        const layerId = groupId(["work-function-layer", layerIndex, layer.label]);
        const layerHasSelected = layer.rows.some((row) => row.id === selectedId);
        const layerExpanded = hasSelectedRow ? layerHasSelected : layerIndex === 0;
        const groupRows = layer.groups
          .map((group, groupIndex) => {
            const functionGroupId = groupId([layerId, "group", groupIndex, group.label]);
            const groupHasSelected = group.rows.some((row) => row.id === selectedId);
            const groupExpanded = hasSelectedRow ? groupHasSelected : layerExpanded && groupIndex === 0;
            const groupHidden = !layerExpanded;
            const groupHiddenAttr = groupHidden ? " hidden" : "";
            return `
              <tr class="standard-group-row depth-1 ${groupExpanded ? "expanded" : ""}" data-standard-group="${utils.escapeHtml(functionGroupId)}" data-standard-parent="${utils.escapeHtml(layerId)}" data-standard-lineage="${utils.escapeHtml(layerId)}"${groupHiddenAttr}>
                <td colspan="5">
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
            <td colspan="5">
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

  function render({ rows, selectedId, emptyState }) {
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
              <th>关联安全工作数</th>
              <th>关联流程数</th>
            </tr>
          </thead>
          <tbody>
            ${renderGroupedRows(tableRows, selectedId)}
          </tbody>
        </table>
      </div>
    `;
  }

  components.WorkFunctionMaintenanceTable = { render };
})();
