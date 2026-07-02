(function () {
  const components = (window.sapdComponents = window.sapdComponents || {});
  const utils = components.utils;

  function cell(value) {
    const text = value == null || value === "" ? "待补充" : value;
    return utils.escapeHtml(text);
  }

  function levelChip(label) {
    return `<span class="type-pill">${cell(label)}</span>`;
  }

  function fullText(value, className = "") {
    const safeValue = cell(value);
    const classAttr = className ? ` class="${utils.escapeHtml(className)}"` : "";
    return `<span${classAttr} title="${safeValue}">${safeValue}</span>`;
  }

  function optionalFullText(value, className = "") {
    return utils.text(value).trim() ? fullText(value, className) : "";
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

  function groupTitle(item) {
    const code = utils.text(item.code || "").trim();
    const title = utils.text(item.title || "").trim();
    if (!code) return title;
    if (!title || title === code || title.startsWith(`${code} `)) return title || code;
    if (title.endsWith(` ${code}`)) return [code, title.slice(0, -code.length).trim()].filter(Boolean).join(" ");
    return [code, title].filter(Boolean).join(" ");
  }

  function focusNameColumnWidth(groups) {
    const maxLength = utils
      .list(groups)
      .flatMap((category) => utils.list(category.domains))
      .flatMap((domain) => utils.list(domain.capabilities))
      .flatMap((capability) => utils.list(capability.focuses))
      .reduce((max, focus) => Math.max(max, Array.from(utils.text(focus?.title || "")).length), 0);
    return Math.min(520, Math.max(320, maxLength * 15 + 28));
  }

  function renderFocusRows(rows, selectedId, parentId, lineage, hidden) {
    const hiddenAttr = hidden ? " hidden" : "";
    return utils
      .list(rows)
      .map((row) => {
        const description = row.focusDescription || row.description;
        return `
          <tr class="maintenance-data-row standard-group-detail ${row.id === selectedId ? "active" : ""}" data-standard-parent="${utils.escapeHtml(parentId)}" data-standard-lineage="${utils.escapeHtml(lineage.join(" "))}" data-maintenance-id="${utils.escapeHtml(row.id)}"${hiddenAttr}>
            <td style="padding-left: 38px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${levelChip("关注点")} <strong>${cell(row.code)}</strong></td>
            <td>${cell(row.title)}</td>
            <td class="maintenance-description-cell">${fullText(description)}</td>
          </tr>
        `;
      })
      .join("");
  }

  function renderCapabilityGroup(capability, selectedId, parentId, lineage, hidden, expanded) {
    const capabilityId = groupId([...lineage, "capability", capability.code || capability.title]);
    const hiddenAttr = hidden ? " hidden" : "";
    const nextLineage = [...lineage, capabilityId];
    const definition = capability.capabilityDefinition || capability.description;
    return `
      <tr class="standard-group-row capability-directory-group depth-2 ${expanded ? "expanded" : ""}" data-standard-group="${utils.escapeHtml(capabilityId)}" data-standard-parent="${utils.escapeHtml(parentId)}" data-standard-lineage="${utils.escapeHtml(lineage.join(" "))}"${hiddenAttr}>
        <td colspan="3">
          <button class="standard-group-toggle" type="button" aria-expanded="${expanded ? "true" : "false"}" style="padding-left: 32px;">
            <span class="standard-group-caret">›</span>
            <span class="standard-group-main">
              <strong>${levelChip("能力")} ${cell(groupTitle(capability))}</strong>
              ${fullText(definition, "standard-group-description")}
            </span>
            <em>${cell(`${utils.list(capability.focuses).length} 个关注点`)}</em>
          </button>
        </td>
      </tr>
      ${renderFocusRows(capability.focuses, selectedId, capabilityId, nextLineage, !expanded)}
    `;
  }

  function renderDomainGroup(domain, selectedId, parentId, lineage, hidden, expanded, expandFirstCapability, expandAll) {
    const domainId = groupId([...lineage, "domain", domain.code || domain.title]);
    const hiddenAttr = hidden ? " hidden" : "";
    const nextLineage = [...lineage, domainId];
    const definition = domain.description;
    return `
      <tr class="standard-group-row capability-directory-group depth-1 ${expanded ? "expanded" : ""}" data-standard-group="${utils.escapeHtml(domainId)}" data-standard-parent="${utils.escapeHtml(parentId)}" data-standard-lineage="${utils.escapeHtml(lineage.join(" "))}"${hiddenAttr}>
        <td colspan="3">
          <button class="standard-group-toggle" type="button" aria-expanded="${expanded ? "true" : "false"}" style="padding-left: 18px;">
            <span class="standard-group-caret">›</span>
            <span class="standard-group-main">
              <strong>${levelChip("能力域")} ${cell(groupTitle(domain))}</strong>
              ${optionalFullText(definition, "standard-group-description")}
            </span>
            <em>${cell(`${utils.list(domain.capabilities).length} 个安全能力`)}</em>
          </button>
        </td>
      </tr>
      ${utils
        .list(domain.capabilities)
        .map((capability, index) => renderCapabilityGroup(capability, selectedId, domainId, nextLineage, !expanded, expandAll || (expanded && expandFirstCapability && index === 0)))
        .join("")}
    `;
  }

  function renderCategoryGroup(category, selectedId, index, expandAll) {
    const categoryId = groupId(["capability-directory", index, category.code || category.title]);
    const expanded = expandAll;
    const definition = category.description;
    return `
      <tr class="standard-group-row capability-directory-group depth-0 ${expanded ? "expanded" : ""}" data-standard-group="${utils.escapeHtml(categoryId)}">
        <td colspan="3">
          <button class="standard-group-toggle" type="button" aria-expanded="${expanded ? "true" : "false"}" style="padding-left: 4px;">
            <span class="standard-group-caret">›</span>
            <span class="standard-group-main">
              <strong>${levelChip("能力分类")} ${cell(groupTitle(category))}</strong>
              ${optionalFullText(definition, "standard-group-description")}
            </span>
            <em>${cell(`${utils.list(category.domains).length} 个能力域`)}</em>
          </button>
        </td>
      </tr>
      ${utils
        .list(category.domains)
        .map((domain, domainIndex) => renderDomainGroup(domain, selectedId, categoryId, [categoryId], !expanded, expandAll || (expanded && domainIndex === 0), domainIndex === 0, expandAll))
        .join("")}
    `;
  }

  function render({ rows, capabilityGroups, selectedId, emptyState, search }) {
    const groups = utils.list(capabilityGroups);
    const nameColumnWidth = focusNameColumnWidth(groups);
    if (!groups.length) {
      return `<div class="maintenance-empty-state">${utils.escapeHtml(emptyState || "暂无安全能力清单数据。")}</div>`;
    }
    return `
      <div class="maintenance-table-scroll">
        <table class="maintenance-data-table capability-directory-maintenance-table" style="width: 100%; min-width: 0; table-layout: fixed;">
          <colgroup>
            <col style="width: 220px;">
            <col style="width: ${nameColumnWidth}px;">
            <col>
          </colgroup>
          <thead>
            <tr>
              <th>编码</th>
              <th>名称</th>
              <th>定义 / 描述</th>
            </tr>
          </thead>
          <tbody>
            ${groups.map((category, index) => renderCategoryGroup(category, selectedId, index, Boolean(utils.text(search).trim()))).join("")}
          </tbody>
        </table>
      </div>
    `;
  }

  components.CapabilityDirectoryMaintenanceTable = { render };
})();
