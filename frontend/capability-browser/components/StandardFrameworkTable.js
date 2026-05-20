(function () {
  const components = (window.sapdComponents = window.sapdComponents || {});
  const utils = components.utils;

  function cellValue(value) {
    if (value == null || value === "") return "";
    return String(value);
  }

  function visibleColumns(activeFrameworkId, columns, tableId) {
    return utils
      .list(columns)
      .filter(
        (column) =>
          !(
            activeFrameworkId === "mlps-level-3" &&
            ["等级保护", "等保要求", "等保控制项"].includes(column)
          ) &&
          !(
            activeFrameworkId === "cis-csc-v8" &&
            ["安全控制项", "安全控制项名称", "控制项描述"].includes(column)
          ) &&
          !(
            activeFrameworkId === "iso-27001-2022" &&
            column === "控制类别"
          ) &&
          !(
            activeFrameworkId === "crf" &&
            tableId === "crf-safeguards-core-2026" &&
            ["保障措施分类", "保障措施域"].includes(column)
          ) &&
          !(
            activeFrameworkId === "nist-800-53-rev5" &&
            ["安全控制类", "安全控制"].includes(column)
          ) &&
          !(
            activeFrameworkId === "nist-csf-2" &&
            tableId === "csf-core" &&
            ["功能", "分类", "分类标识符"].includes(column)
          ) &&
          !(
            activeFrameworkId === "nist-csf-2" &&
            tableId === "csf-tiers" &&
            column === "层级"
          ),
      );
  }

  function csfTone(row) {
    const text = cellValue(row.values?.["功能"]);
    if (text.includes("GOVERN") || text.includes("治理")) return "gv";
    if (text.includes("IDENTIFY") || text.includes("识别")) return "id";
    if (text.includes("PROTECT") || text.includes("保护")) return "pr";
    if (text.includes("DETECT") || text.includes("检测")) return "de";
    if (text.includes("RESPOND") || text.includes("响应")) return "rs";
    if (text.includes("RECOVER") || text.includes("恢复")) return "rc";
    return "";
  }

  function compactGroupText(value) {
    return cellValue(value).split("：")[0].trim();
  }

  function cisControlLabel(values) {
    const control = cellValue(values["安全控制项"]).replace(/[/.、\s]+$/g, "");
    const name = cellValue(values["安全控制项名称"]);
    return [control ? `${control}.` : "", name].filter(Boolean).join(" ");
  }

  function renderHeaderCell(activeFrameworkId, column) {
    if (activeFrameworkId === "nist-800-53-rev5" && column.startsWith("安全类型（")) {
      return `
        <th class="nist-security-type-heading">
          <span>安全类型</span>
          <small>O=组织层面控制<br>S=系统层面控制<br>O/S=组织和系统均涉及</small>
        </th>
      `;
    }
    return `<th>${utils.escapeHtml(column)}</th>`;
  }

  function relatedFocusCodes(value) {
    const text = cellValue(value);
    if (!text) return [];
    const matches = text.match(/\b(?:[TGM]-[A-Z]{2}\.[A-Z]{2}-\d{2}|M\.PS\.CT-\d{2})\b/g);
    if (matches?.length) return [...new Set(matches)];
    return text
      .split(/\n+/)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  function focusTooltip(code, focusByCode = {}) {
    const focus = focusByCode[code] || {};
    const category = cellValue(focus.category).replace(/\s+[A-Z]$/, "").trim();
    const domain = cellValue(focus.domain).trim();
    const capabilityCode = cellValue(focus.capabilityCode).trim();
    const capabilityTitle = cellValue(focus.capability).trim();
    const focusTitle = cellValue(focus.title || focus.name).trim();
    return [
      [category, domain].filter(Boolean).join("-"),
      [capabilityCode, capabilityTitle].filter(Boolean).join("-"),
      [code, focusTitle].filter(Boolean).join("-"),
      focus.description || "",
    ]
      .map((item) => cellValue(item).trim())
      .filter(Boolean)
      .join("\n");
  }

  function renderCell(column, value, focusByCode = {}) {
    if (column === "关联安全能力/关注点") {
      const codes = relatedFocusCodes(value);
      if (!codes.length) return "";
      return `
        <div class="standard-focus-code-list">
          ${codes
            .map((code) => {
              const tooltip = focusTooltip(code, focusByCode);
              return `<span class="standard-tooltip-chip standard-focus-code" data-tooltip="${utils.escapeHtml(tooltip)}" aria-label="${utils.escapeHtml(tooltip || code)}" tabindex="0">${utils.escapeHtml(code)}</span>`;
            })
            .join("")}
        </div>
      `;
    }
    return utils.escapeHtml(cellValue(value));
  }

  function groupConfig(activeFrameworkId, tableId) {
    if (activeFrameworkId === "mlps-level-3") {
      return {
        levels: [
          { fields: ["等保要求"], label: (values) => values["等保要求"] },
          { fields: ["等保控制项"], label: (values) => values["等保控制项"] },
        ],
      };
    }
    if (activeFrameworkId === "cis-csc-v8") {
      return {
        levels: [
          {
            fields: ["安全控制项", "安全控制项名称"],
            label: (values) => cisControlLabel(values),
            description: (values) => values["控制项描述"],
          },
        ],
      };
    }
    if (activeFrameworkId === "iso-27001-2022") {
      return {
        levels: [{ fields: ["控制类别"], label: (values) => values["控制类别"] }],
      };
    }
    if (activeFrameworkId === "crf" && tableId === "crf-safeguards-core-2026") {
      return {
        levels: [
          { fields: ["保障措施分类"], label: (values) => values["保障措施分类"] },
          { fields: ["保障措施域"], label: (values) => values["保障措施域"] },
        ],
      };
    }
    if (activeFrameworkId === "nist-800-53-rev5") {
      return {
        levels: [
          { fields: ["安全控制类"], label: (values) => values["安全控制类"] },
          { fields: ["安全控制"], label: (values) => values["安全控制"] },
        ],
      };
    }
    if (activeFrameworkId === "nist-csf-2" && tableId === "csf-tiers") {
      return {
        levels: [{ fields: ["层级"], label: (values) => values["层级"] }],
      };
    }
    if (activeFrameworkId === "nist-csf-2") {
      return {
        levels: [
          { fields: ["功能"], label: (values) => compactGroupText(values["功能"]) },
          { fields: ["分类", "分类标识符"], label: (values) => [compactGroupText(values["分类"]), values["分类标识符"]].filter(Boolean).join(" / ") },
        ],
      };
    }
    return null;
  }

  function groupedRows(rows, config) {
    if (!config) return [];
    const makeGroups = (sourceRows, levelIndex = 0) => {
      const level = utils.list(config.levels)[levelIndex];
      if (!level) return [];
      const groups = [];
      const byKey = new Map();
      for (const row of utils.list(sourceRows)) {
        const values = row.values || {};
        const key = level.fields.map((field) => cellValue(values[field])).join("::");
        if (!byKey.has(key)) {
          const group = {
            id: `group:${levelIndex}:${groups.length}`,
            depth: levelIndex,
            label: level.label(values) || "未分组",
            description: level.description?.(values) || "",
            rows: [],
            children: [],
          };
          groups.push(group);
          byKey.set(key, group);
        }
        byKey.get(key).rows.push(row);
      }
      for (const group of groups) group.children = makeGroups(group.rows, levelIndex + 1);
      return groups;
    };
    return makeGroups(rows);
  }

  function groupDomId(activeFrameworkId, tableId, path) {
    return [activeFrameworkId || "standard", tableId || "main", ...path].join("-");
  }

  function renderDetailRows({ rows, tableColumns, activeFrameworkId, selectedId, parentId, hidden = false, lineage = [], focusByCode = {} }) {
    const lineageAttr = lineage.length ? ` data-standard-lineage="${utils.escapeHtml(lineage.join(" "))}"` : "";
    const parentAttr = parentId ? ` data-standard-parent="${utils.escapeHtml(parentId)}"` : "";
    const hiddenAttr = hidden ? " hidden" : "";
    return utils
      .list(rows)
      .map((row) => {
        const tone = activeFrameworkId === "nist-csf-2" ? csfTone(row) : "";
        const active = selectedId && row.id === selectedId;
        return `
          <tr class="maintenance-data-row standard-group-detail ${tone ? `csf-row csf-${tone}` : ""} ${active ? "active" : ""}"${parentAttr}${lineageAttr}${hiddenAttr} data-maintenance-id="${utils.escapeHtml(row.id || "")}">
            ${tableColumns.map((column) => `<td>${renderCell(column, row.values?.[column], focusByCode)}</td>`).join("")}
          </tr>
        `;
      })
      .join("");
  }

  function renderGroups({
    groups,
    tableColumns,
    activeFrameworkId,
    tableId,
    selectedId,
    parentId = "",
    path = [],
    parentExpanded = true,
    lineage = [],
    focusByCode = {},
  }) {
    return utils
      .list(groups)
      .map((group, index) => {
        const groupPath = [...path, index];
        const groupId = groupDomId(activeFrameworkId, tableId, groupPath);
        const groupLineage = [...lineage, groupId];
        const expanded = parentExpanded && index === 0;
        const hidden = !parentExpanded;
        const parentAttr = parentId ? ` data-standard-parent="${utils.escapeHtml(parentId)}"` : "";
        const lineageAttr = lineage.length ? ` data-standard-lineage="${utils.escapeHtml(lineage.join(" "))}"` : "";
        const hiddenAttr = hidden ? " hidden" : "";
        const childRows = group.children.length
          ? renderGroups({
              groups: group.children,
              tableColumns,
              activeFrameworkId,
              tableId,
              selectedId,
              parentId: groupId,
              path: groupPath,
              parentExpanded: expanded,
              lineage: groupLineage,
              focusByCode,
            })
          : renderDetailRows({
              rows: group.rows,
              tableColumns,
              activeFrameworkId,
              selectedId,
              parentId: groupId,
              hidden: !expanded,
              lineage: groupLineage,
              focusByCode,
            });
        return `
          <tr class="standard-group-row depth-${group.depth} ${expanded ? "expanded" : ""}" data-standard-group="${utils.escapeHtml(groupId)}"${parentAttr}${lineageAttr}${hiddenAttr}>
            <td colspan="${tableColumns.length}">
              <button class="standard-group-toggle" type="button" aria-expanded="${expanded ? "true" : "false"}">
                <span class="standard-group-caret">›</span>
                <span class="standard-group-main">
                  <strong>${utils.escapeHtml(group.label)}</strong>
                  ${group.description ? `<span class="standard-group-description">${utils.escapeHtml(group.description)}</span>` : ""}
                </span>
                <em>${utils.escapeHtml(`第 ${group.depth + 1} 级 · ${group.rows.length} 条`)}</em>
              </button>
            </td>
          </tr>
          ${childRows}
        `;
      })
      .join("");
  }

  function renderTable({ activeFrameworkId, tableId, rows, columns, selectedId, focusByCode = {} }) {
    const tableRows = utils.list(rows);
    const tableColumns = visibleColumns(activeFrameworkId, columns, tableId);
    if (!tableRows.length || !tableColumns.length) return "";
    const groups = groupedRows(tableRows, groupConfig(activeFrameworkId, tableId));
    const frameworkClass =
      activeFrameworkId === "nist-csf-2" && tableId === "csf-tiers"
        ? " csf-tiers-table"
        : activeFrameworkId === "nist-csf-2"
          ? " csf-core-table"
          : activeFrameworkId === "mlps-level-3"
            ? " mlps-level-3-table"
            : activeFrameworkId === "cis-csc-v8"
              ? " cis-csc-v8-table"
              : activeFrameworkId === "iso-27001-2022"
                ? " iso-27001-2022-table"
                : activeFrameworkId === "nist-800-53-rev5"
                  ? " nist-800-53-rev5-table"
                : activeFrameworkId === "crf" && tableId === "crf-safeguards-core-2026"
                  ? " crf-table crf-safeguards-table"
                  : activeFrameworkId === "crf" && tableId === "crf-maturity-model-2026"
                    ? " crf-table crf-maturity-table"
                : "";
    return `
      <div class="maintenance-table-scroll standard-framework-table-scroll">
        <table class="maintenance-data-table standard-framework-table${frameworkClass}">
          <thead>
            <tr>${tableColumns.map((column) => renderHeaderCell(activeFrameworkId, column)).join("")}</tr>
          </thead>
          <tbody>
            ${groups.length ? renderGroups({ groups, tableColumns, activeFrameworkId, tableId, selectedId, focusByCode }) : renderDetailRows({ rows: tableRows, tableColumns, activeFrameworkId, selectedId, focusByCode })}
          </tbody>
        </table>
      </div>
    `;
  }

  function render({ activeFrameworkId, rows, columns, tables, selectedId, emptyState, focusByCode }) {
    const tableModels = utils.list(tables);
    const hasTabTables = activeFrameworkId === "nist-csf-2" || tableModels.length > 1;
    const fallbackCsfTables =
      activeFrameworkId === "nist-csf-2" && !tableModels.length
        ? [
            {
              id: "csf-core",
              title: "CSF Core",
              columns: ["功能", "分类", "分类标识符", "分类标识符说明", "关联安全能力/关注点"],
              rows: utils.list(rows).filter((row) => row.values && !Object.prototype.hasOwnProperty.call(row.values, "层级")),
            },
            {
              id: "csf-tiers",
              title: "CSF Tiers",
              columns: [
                "层级",
                "网络安全风险治理（Cybersecurity Risk Governance, GV）",
                "网络安全风险管理（Cybersecurity Risk Management, ID/PR/DE/RS/RC）",
              ],
              rows: utils.list(rows).filter((row) => row.values && Object.prototype.hasOwnProperty.call(row.values, "层级")),
            },
          ].map((table) => ({ ...table, totalRows: table.rows.length }))
        : [];
    const normalizedTables = hasTabTables && tableModels.length ? tableModels : fallbackCsfTables;
    const tableRows = hasTabTables ? normalizedTables.flatMap((table) => utils.list(table.rows)) : utils.list(rows);
    const tableColumns = hasTabTables ? normalizedTables.flatMap((table) => utils.list(table.columns)) : visibleColumns(activeFrameworkId, columns);
    if (!tableRows.length || !tableColumns.length) {
      return `
        <div class="reference-table-stack standard-framework-stack">
          <div class="maintenance-empty-state">${utils.escapeHtml(emptyState || "暂无标准框架数据。")}</div>
        </div>
      `;
    }
    if (hasTabTables) {
      if (!normalizedTables.length) {
        return `
          <div class="reference-table-stack standard-framework-stack">
            <div class="maintenance-empty-state">${utils.escapeHtml(emptyState || "暂无 CSF Core / CSF Tiers 数据。")}</div>
          </div>
        `;
      }
      const tabName = `standard-framework-tab-${activeFrameworkId}`;
      return `
        <div class="reference-table-stack standard-framework-stack standard-framework-tabbed">
          <div class="standard-framework-tabs" role="tablist">
            ${normalizedTables
              .map(
                (table, index) => `
                  <button class="standard-framework-tab ${index === 0 ? "active" : ""}" type="button" role="tab" aria-selected="${index === 0 ? "true" : "false"}" data-tab-target="${utils.escapeHtml(table.id)}">
                    <span>${utils.escapeHtml(table.title)}</span>
                  </button>
                `,
              )
              .join("")}
          </div>
          <div class="standard-framework-tab-panels">
            ${normalizedTables
              .map(
                (table, index) => `
                  <section class="standard-framework-tab-panel ${index === 0 ? "active" : ""}" data-tab-panel="${utils.escapeHtml(table.id)}" ${index === 0 ? "" : "hidden"}>
                    ${renderTable({ activeFrameworkId, tableId: table.id, rows: table.rows, columns: table.columns, selectedId, focusByCode })}
                  </section>
                `,
              )
              .join("")}
          </div>
        </div>
      `;
    }
    return `
      <div class="reference-table-stack standard-framework-stack">
        ${renderTable({ activeFrameworkId, rows, columns, selectedId, focusByCode })}
      </div>
    `;
  }

  document.addEventListener("click", (event) => {
    const tab = event.target.closest?.(".standard-framework-tab");
    if (!tab) return;
    const stack = tab.closest(".standard-framework-tabbed");
    const target = tab.dataset.tabTarget;
    if (!stack || !target) return;
    stack.querySelectorAll(".standard-framework-tab").forEach((item) => {
      const active = item.dataset.tabTarget === target;
      item.classList.toggle("active", active);
      item.setAttribute("aria-selected", active ? "true" : "false");
    });
    stack.querySelectorAll(".standard-framework-tab-panel").forEach((panel) => {
      const active = panel.dataset.tabPanel === target;
      panel.classList.toggle("active", active);
      panel.hidden = !active;
    });
  });

  document.addEventListener("click", (event) => {
    const toggle = event.target.closest?.(".standard-group-toggle");
    if (!toggle) return;
    const row = toggle.closest(".standard-group-row");
    const groupId = row?.dataset.standardGroup;
    const table = row?.closest("table");
    if (!groupId || !table) return;
    const expanded = toggle.getAttribute("aria-expanded") === "true";
    const nextExpanded = !expanded;
    toggle.setAttribute("aria-expanded", nextExpanded ? "true" : "false");
    row.classList.toggle("expanded", nextExpanded);
    if (!nextExpanded) {
      table.querySelectorAll(`[data-standard-lineage~="${groupId}"]`).forEach((descendant) => {
        descendant.hidden = true;
        if (descendant.classList.contains("standard-group-row")) {
          descendant.classList.remove("expanded");
          descendant.querySelector(".standard-group-toggle")?.setAttribute("aria-expanded", "false");
        }
      });
      return;
    }
    table.querySelectorAll(`[data-standard-parent="${groupId}"]`).forEach((child) => {
      child.hidden = false;
    });
  });

  components.StandardFrameworkTable = { render };
})();
