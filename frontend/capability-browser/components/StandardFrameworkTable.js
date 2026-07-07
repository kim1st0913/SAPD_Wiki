(function () {
  const components = (window.sapdComponents = window.sapdComponents || {});
  const utils = components.utils;
  const detailTextCache = new Map();
  let renderSerial = 0;
  let detailSerial = 0;
  const STANDARD_INITIAL_RENDER_LIMIT = 600;
  const STANDARD_SEARCH_RENDER_LIMIT = 1200;

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
          ) &&
          !(
            activeFrameworkId === "dsp-level-2" &&
            tableId === "dsp-scf-controls-2026" &&
            ["SCF域", "策略原则", "策略意图"].includes(column)
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

  function scfGroupLabel(values) {
    return cellValue(values["SCF域"]).replace(/\s+/g, " ").trim();
  }

  function scfGroupDescription(values) {
    const principle = cellValue(values["策略原则"]).trim();
    const intent = cellValue(values["策略意图"]).trim();
    return [
      principle ? `策略原则：${principle}` : "",
      intent ? `策略意图：${intent}` : "",
    ]
      .filter(Boolean)
      .join(" · ");
  }

  function columnSlug(column) {
    const known = {
      "关联安全能力/关注点": "related-focus",
      "等保三级控制要求": "mlps-control-requirement",
      "分类标识符说明": "csf-category-description",
      "控制描述": "control-description",
      "控制项描述": "control-description",
      "SCF控制项描述": "control-description",
      "保障措施描述": "control-description",
      "描述": "control-description",
      "安全策略编号": "control-code",
      "安全控制项": "control-title",
      "SCF编号": "control-code",
      "SCF控制项": "control-title",
      "控制编号": "control-code",
      "控制名称": "control-title",
      "Safeguard ID": "control-code",
      "保护措施编号": "control-code",
      "名称": "control-title",
      "安全级别": "compact-status",
      "安全类型（O=组织层面控制，S=系统层面控制，O/S=组织和系统均涉及）": "compact-status",
      "实施组": "compact-status",
      "安全功能": "compact-status",
      "资产类型": "compact-status",
      "NIST CSF功能分组": "compact-status",
      "CRF成熟度等级": "compact-status",
      "保障措施系统": "compact-status",
      "序号": "row-index",
      "工作任务": "work-task",
      "任务描述": "task-description",
      "所属工作类别": "work-category",
      "工作类别": "work-category",
      "分类数量": "category-count",
      "关联安全职能": "related-work-functions",
      "岗位分类": "role-category",
      "岗位/角色": "role-title",
      "说明": "role-description",
    };
    if (known[column]) return known[column];
    return cellValue(column)
      .toLowerCase()
      .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48);
  }

  function columnClass(column) {
    return `standard-column standard-column-${columnSlug(column)}`;
  }

  function renderHeaderCell(activeFrameworkId, column) {
    if (activeFrameworkId === "nist-800-53-rev5" && column.startsWith("安全类型（")) {
      return `
        <th class="${columnClass(column)} nist-security-type-heading" data-column="${utils.escapeHtml(column)}" title="O=组织层面控制；S=系统层面控制；O/S=组织和系统均涉及">
          <span>安全类型</span>
        </th>
      `;
    }
    return `<th class="${columnClass(column)}" data-column="${utils.escapeHtml(column)}">${utils.escapeHtml(column)}</th>`;
  }

  function isDspMaturityColumn(activeFrameworkId, tableId, column) {
    return activeFrameworkId === "dsp-level-2" && tableId === "dsp-scf-maturity-2026" && column.startsWith("SCR-CMM ");
  }

  function compactLongText(value, maxLength = 92) {
    const text = cellValue(value).replace(/\s+/g, " ").trim();
    if (text.length <= maxLength) return text;
    return `${text.slice(0, maxLength).trim()}...`;
  }

  function codeWithBreaks(value) {
    return utils.escapeHtml(cellValue(value)).replace(/([.\/:：-])/g, "$1<wbr>").replace(/(\s+)/g, "$1<wbr>");
  }

  function translateSecurityFunction(value) {
    const map = {
      govern: "治理",
      identify: "识别",
      protect: "保护",
      detect: "检测",
      respond: "响应",
      recover: "恢复",
    };
    return cellValue(value).replace(/\b(Govern|Identify|Protect|Detect|Respond|Recover)\b/gi, (match) => map[match.toLowerCase()] || match);
  }

  function tableDataRows(table, frameworkId) {
    return utils.list(table?.rows).map((row, index) =>
      row?.values
        ? row
        : {
            id: row?.id || `${frameworkId || "standard"}:${table?.id || "table"}:${index}`,
            frameworkId: frameworkId || "",
            tableId: table?.id || "",
            values: row || {},
          },
    );
  }

  function tabGroupKey(table, index) {
    const title = cellValue(table?.title || table?.id);
    if (/GB\/T\s*42446/i.test(title) || /^gbt-42446/i.test(cellValue(table?.id))) return "gbt-42446";
    if (/Gartner/i.test(title) || /^gartner/i.test(cellValue(table?.id))) return "gartner";
    return cellValue(table?.groupId || table?.tabGroupId || table?.groupLabel || table?.tabGroup || `tab-group-${index}`);
  }

  function tabGroupLabel(table) {
    const title = cellValue(table?.title || table?.id);
    if (/GB\/T\s*42446/i.test(title) || /^gbt-42446/i.test(cellValue(table?.id))) return "GB/T 42446-2023";
    if (/Gartner/i.test(title) || /^gartner/i.test(cellValue(table?.id))) return "Gartner";
    return cellValue(table?.groupLabel || table?.tabGroupLabel || table?.tabGroup || "");
  }

  function tabButtonLabel(table) {
    const explicit = cellValue(table?.shortTitle || table?.tabTitle);
    if (explicit) return explicit;
    const title = cellValue(table?.title || table?.id || "表格");
    return title.replace(/^GB\/T\s*42446-2023[｜|\s]+/, "").replace(/^Gartner\s+/, "") || title;
  }

  function groupedStandardTabs(tables) {
    const groups = [];
    utils.list(tables).forEach((table, index) => {
      const id = tabGroupKey(table, index);
      const label = tabGroupLabel(table);
      let group = groups.find((item) => item.id === id);
      if (!group) {
        group = { id, label, tables: [] };
        groups.push(group);
      }
      if (!group.label && label) group.label = label;
      group.tables.push(table);
    });
    return groups;
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

  function renderLongPreview(value) {
    const text = cellValue(value).trim();
    if (!text) return "";
    const cacheKey = `standard-detail-${++detailSerial}`;
    detailTextCache.set(cacheKey, text);
    return `
      <button class="standard-rich-preview" type="button" data-standard-detail-key="${utils.escapeHtml(cacheKey)}" aria-label="查看完整成熟度描述">
        ${utils.escapeHtml(compactLongText(text))}
      </button>
    `;
  }

  function renderCell(column, value, focusByCode = {}, context = {}) {
    if (context.activeFrameworkId === "workforce-reference-standards" && column === "关联安全职能") {
      const labels = cellValue(value)
        .split(/[、,，]/)
        .map((item) => item.trim())
        .filter(Boolean);
      if (!labels.length) return "";
      return `
        <div class="workforce-function-chip-list">
          ${labels.map((label) => `<span class="workforce-function-chip">${utils.escapeHtml(label)}</span>`).join("")}
        </div>
      `;
    }
    if (column === "关联安全能力/关注点") {
      const codes = relatedFocusCodes(value);
      if (!codes.length) return "";
      return `
        <div class="standard-focus-code-list">
          ${codes
            .map((code) => {
              const tooltip = focusTooltip(code, focusByCode);
              const copyText = tooltip || code;
              return `<span class="standard-tooltip-chip standard-focus-code standard-code-breaks" data-annotation-value="true" data-copy-text="${utils.escapeHtml(copyText)}" title="${utils.escapeHtml(copyText)}" data-annotation-tooltip="${utils.escapeHtml(copyText)}" data-tooltip="${utils.escapeHtml(tooltip)}" aria-label="${utils.escapeHtml(copyText)}" tabindex="0">${codeWithBreaks(code)}</span>`;
            })
            .join("")}
        </div>
      `;
    }
    if (isDspMaturityColumn(context.activeFrameworkId, context.tableId, column)) {
      return renderLongPreview(value);
    }
    if (context.activeFrameworkId === "cis-csc-v8" && column === "安全功能") {
      return utils.escapeHtml(translateSecurityFunction(value));
    }
    return utils.escapeHtml(cellValue(value));
  }

  function standardRowCode(row = {}) {
    const values = row.values || row || {};
    return cellValue(
      row.controlId ||
        row.controlCode ||
        values["Safeguard ID"] ||
        values["SCF编号"] ||
        values["控制项"] ||
        values["控制编号"] ||
        values["控制ID"] ||
        values["控制项ID"] ||
        values["保护措施编号"] ||
        values["等保控制项"] ||
        values["编号"] ||
        row.code,
    );
  }

  function standardRowTargetRef(activeFrameworkId, tableId, row = {}) {
    const rowId = cellValue(row.id).trim();
    if (!activeFrameworkId || !tableId || !rowId) return "";
    return `standard_control:${activeFrameworkId}:${tableId}:${rowId}`;
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
    if (activeFrameworkId === "dsp-level-2" && tableId === "dsp-scf-controls-2026") {
      return {
        levels: [
          {
            fields: ["SCF域", "策略原则", "策略意图"],
            label: scfGroupLabel,
            description: scfGroupDescription,
          },
        ],
      };
    }
    if (activeFrameworkId === "workforce-reference-standards" && tableId === "gbt-42446-classification") {
      return {
        levels: [{ fields: ["工作类别"], label: (values) => values["工作类别"] }],
      };
    }
    if (activeFrameworkId === "workforce-reference-standards" && tableId === "gartner-work-roles") {
      return {
        levels: [{ fields: ["岗位分类"], label: (values) => values["岗位分类"] }],
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

  function renderDetailRows({ rows, tableColumns, activeFrameworkId, tableId, selectedId, parentId, hidden = false, lineage = [], focusByCode = {} }) {
    const lineageAttr = lineage.length ? ` data-standard-lineage="${utils.escapeHtml(lineage.join(" "))}"` : "";
    const parentAttr = parentId ? ` data-standard-parent="${utils.escapeHtml(parentId)}"` : "";
    const hiddenAttr = hidden ? " hidden" : "";
    const selectedKey = cellValue(selectedId).trim();
    return utils
      .list(rows)
      .map((row) => {
        const tone = activeFrameworkId === "nist-csf-2" ? csfTone(row) : "";
        const rowId = cellValue(row.id).trim();
        const rowCode = standardRowCode(row);
        const rowTargetRef = standardRowTargetRef(activeFrameworkId, tableId, row);
        const active = selectedKey && rowId === selectedKey;
        const rowText = [rowId, rowCode, ...tableColumns.map((column) => row.values?.[column])].map((value) => utils.text(value)).filter(Boolean).join(" ");
        return `
          <tr class="maintenance-data-row standard-group-detail ${tone ? `csf-row csf-${tone}` : ""} ${active ? "active" : ""}"${parentAttr}${lineageAttr}${hiddenAttr} data-maintenance-id="${utils.escapeHtml(rowId)}" data-standard-row-id="${utils.escapeHtml(rowId)}" data-standard-row-code="${utils.escapeHtml(rowCode)}" data-standard-target-ref="${utils.escapeHtml(rowTargetRef)}" data-standard-row-text="${utils.escapeHtml(rowText)}">
            ${tableColumns
              .map(
                (column) =>
                  `<td class="${columnClass(column)}" data-column="${utils.escapeHtml(column)}" data-copy-text="${utils.escapeHtml(row.values?.[column] || "")}">${renderCell(column, row.values?.[column], focusByCode, { activeFrameworkId, tableId })}</td>`,
              )
              .join("")}
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
    expandAll = false,
  }) {
    return utils
      .list(groups)
      .map((group, index) => {
        const groupPath = [...path, index];
        const groupId = groupDomId(activeFrameworkId, tableId, groupPath);
        const groupLineage = [...lineage, groupId];
        const expanded = expandAll;
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
              expandAll,
            })
          : renderDetailRows({
              rows: group.rows,
              tableColumns,
              activeFrameworkId,
              tableId,
              selectedId,
              parentId: groupId,
              hidden: !expanded,
              lineage: groupLineage,
              focusByCode,
            });
        return `
          <tr class="standard-group-row depth-${group.depth} ${expanded ? "expanded" : ""}" data-standard-group="${utils.escapeHtml(groupId)}" data-copy-text="${utils.escapeHtml([group.label, group.description].filter(Boolean).join(" "))}"${parentAttr}${lineageAttr}${hiddenAttr}>
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

  function frameworkTableClass(activeFrameworkId, tableId) {
    if (activeFrameworkId === "nist-csf-2" && tableId === "csf-tiers") return " csf-tiers-table";
    if (activeFrameworkId === "nist-csf-2") return " csf-core-table";
    if (activeFrameworkId === "mlps-level-3") return " mlps-level-3-table";
    if (activeFrameworkId === "cis-csc-v8") return " cis-csc-v8-table";
    if (activeFrameworkId === "iso-27001-2022") return " iso-27001-2022-table";
    if (activeFrameworkId === "nist-800-53-rev5") return " nist-800-53-rev5-table";
    if (activeFrameworkId === "dsp-level-2" && tableId === "dsp-scf-controls-2026") return " dsp-scf-table dsp-scf-controls-table";
    if (activeFrameworkId === "dsp-level-2" && tableId === "dsp-scf-maturity-2026") return " dsp-scf-table dsp-scf-maturity-table";
    if (activeFrameworkId === "crf" && tableId === "crf-safeguards-core-2026") return " crf-table crf-safeguards-table";
    if (activeFrameworkId === "crf" && tableId === "crf-maturity-model-2026") return " crf-table crf-maturity-table";
    if (activeFrameworkId === "workforce-reference-standards") return " workforce-reference-table";
    return "";
  }

  function renderTable({ activeFrameworkId, tableId, rows, columns, selectedId, focusByCode = {}, search = "" }) {
    const allRows = utils.list(rows);
    const searchActive = Boolean(utils.text(search).trim());
    const renderLimit = searchActive ? STANDARD_SEARCH_RENDER_LIMIT : STANDARD_INITIAL_RENDER_LIMIT;
    const capped = allRows.length > renderLimit;
    const selectedKey = cellValue(selectedId).trim();
    let selectedRowIncludedFromOverflow = false;
    let tableRows = capped ? allRows.slice(0, renderLimit) : allRows;
    if (capped && selectedKey && !tableRows.some((row) => cellValue(row?.id).trim() === selectedKey)) {
      const selectedRow = allRows.find((row) => cellValue(row?.id).trim() === selectedKey);
      if (selectedRow) {
        tableRows = [...tableRows.slice(0, Math.max(0, renderLimit - 1)), selectedRow];
        selectedRowIncludedFromOverflow = true;
      }
    }
    const tableColumns = visibleColumns(activeFrameworkId, columns, tableId);
    if (!tableRows.length || !tableColumns.length) return "";
    const groups = groupedRows(tableRows, groupConfig(activeFrameworkId, tableId));
    const frameworkClass = frameworkTableClass(activeFrameworkId, tableId);
    const expandAll = Boolean(utils.text(search).trim() || selectedKey);
    return `
      ${
        capped
          ? `<div class="standard-framework-render-limit">当前表共 ${utils.escapeHtml(allRows.length)} 条，已先显示 ${utils.escapeHtml(tableRows.length)} 条${selectedRowIncludedFromOverflow ? "，并补入当前定位目标" : ""}；请用搜索词缩小范围后核对完整命中。</div>`
          : ""
      }
      <div class="maintenance-table-scroll standard-framework-table-scroll">
        <table class="maintenance-data-table standard-framework-table${frameworkClass}">
          <thead>
            <tr>${tableColumns.map((column) => renderHeaderCell(activeFrameworkId, column)).join("")}</tr>
          </thead>
          <tbody>
            ${groups.length ? renderGroups({ groups, tableColumns, activeFrameworkId, tableId, selectedId, focusByCode, expandAll }) : renderDetailRows({ rows: tableRows, tableColumns, activeFrameworkId, tableId, selectedId, focusByCode })}
          </tbody>
        </table>
      </div>
    `;
  }

  function render({ activeFrameworkId, activeTableId, rows, columns, tables, selectedId, emptyState, focusByCode, search = "" }) {
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
    if (!hasTabTables) {
      const tableRows = utils.list(rows);
      const tableColumns = visibleColumns(activeFrameworkId, columns);
      if (!tableRows.length || !tableColumns.length) {
        return `
          <div class="reference-table-stack standard-framework-stack">
            <div class="maintenance-empty-state">${utils.escapeHtml(emptyState || "暂无标准框架数据。")}</div>
          </div>
        `;
      }
      return `
        <div class="reference-table-stack standard-framework-stack">
          ${renderTable({ activeFrameworkId, tableId: activeTableId || activeFrameworkId || "standard", rows, columns, selectedId, focusByCode, search })}
        </div>
      `;
    }
    if (!normalizedTables.length) {
      return `
        <div class="reference-table-stack standard-framework-stack">
          <div class="maintenance-empty-state">${utils.escapeHtml(emptyState || "暂无 CSF Core / CSF Tiers 数据。")}</div>
        </div>
      `;
    }
    const normalizedActiveTableId = normalizedTables.some((table) => table.id === activeTableId) ? activeTableId : normalizedTables[0]?.id;
    const instanceId = `standard-framework-${activeFrameworkId || "standard"}-${++renderSerial}`;
    const tabGroups = groupedStandardTabs(normalizedTables);
    const hasTabGroups = tabGroups.some((group) => group.label) && tabGroups.length > 1;
    return `
      <div class="reference-table-stack standard-framework-stack standard-framework-tabbed" data-standard-tab-instance="${utils.escapeHtml(instanceId)}">
        <div class="standard-framework-tabs ${hasTabGroups ? "has-tab-groups" : ""}" role="tablist" aria-label="${utils.escapeHtml(`${activeFrameworkId || "标准框架"}表格`)}">
          ${tabGroups
            .map(
              (group) => `
                <div class="standard-framework-tab-group" role="group" aria-label="${utils.escapeHtml(group.label || "表格分组")}" data-tab-group="${utils.escapeHtml(group.id)}">
                  ${group.label ? `<span class="standard-framework-tab-group-label">${utils.escapeHtml(group.label)}</span>` : ""}
                  <span class="standard-framework-tab-options">
                    ${group.tables
                      .map((table) => {
                        const active = table.id === normalizedActiveTableId;
                        const label = hasTabGroups ? tabButtonLabel(table) : table.title;
                        return `
                          <button class="standard-framework-tab ${active ? "active" : ""}" type="button" role="tab" aria-selected="${active ? "true" : "false"}" aria-label="${utils.escapeHtml(table.title || label)}" data-framework-id="${utils.escapeHtml(activeFrameworkId)}" data-tab-target="${utils.escapeHtml(table.id)}">
                            <span>${utils.escapeHtml(label)}</span>
                          </button>
                        `;
                      })
                      .join("")}
                  </span>
                </div>
              `,
            )
            .join("")}
        </div>
        <div class="standard-framework-tab-panels">
          ${normalizedTables
            .map((table) => {
              const active = table.id === normalizedActiveTableId;
              const tableRows = tableDataRows(table, activeFrameworkId);
              const panelBody = tableRows.length
                ? renderTable({ activeFrameworkId, tableId: table.id, rows: tableRows, columns: table.columns, selectedId, focusByCode, search })
                : table.dataPath && !table.loaded
                  ? `<div class="maintenance-empty-state standard-framework-lazy-state">正在加载表格数据...</div>`
                  : `<div class="maintenance-empty-state standard-framework-lazy-state">暂无 ${utils.escapeHtml(table.title || "表格")} 数据。</div>`;
              return `
                <section class="standard-framework-tab-panel ${active ? "active" : ""}" data-tab-panel="${utils.escapeHtml(table.id)}" data-framework-id="${utils.escapeHtml(activeFrameworkId)}"${active ? "" : " hidden"}>
                  ${panelBody}
                </section>
              `;
            })
            .join("")}
        </div>
      </div>
    `;
  }

  document.addEventListener("click", (event) => {
    const tab = event.target.closest?.(".standard-framework-tab");
    if (!tab) return;
    const stack = tab.closest(".standard-framework-tabbed");
    const target = tab.dataset.tabTarget;
    if (!stack || !target) return;
    document.dispatchEvent(
      new CustomEvent("sapd:standard-table-select", {
        detail: {
          frameworkId: tab.dataset.frameworkId || "",
          tableId: target,
        },
      }),
    );
  });

  function tooltipTextFor(target) {
    if (target?.dataset?.standardDetailKey) return detailTextCache.get(target.dataset.standardDetailKey) || "";
    return target?.dataset?.tooltip || "";
  }

  function ensureTooltip() {
    let tooltip = document.querySelector(".floating-standard-tooltip");
    if (!tooltip) {
      tooltip = document.createElement("div");
      tooltip.className = "floating-standard-tooltip";
      tooltip.hidden = true;
      document.body.appendChild(tooltip);
    }
    return tooltip;
  }

  function positionTooltip(tooltip, event, anchor) {
    const rect = anchor?.getBoundingClientRect?.() || {
      left: event?.clientX || 12,
      right: event?.clientX || 12,
      top: event?.clientY || 12,
      bottom: event?.clientY || 12,
    };
    const gap = 8;
    const margin = 12;
    const tooltipRect = tooltip.getBoundingClientRect();
    const preferredX = rect.left;
    const x = Math.min(window.innerWidth - tooltipRect.width - margin, Math.max(margin, preferredX));
    const belowY = rect.bottom + gap;
    const aboveY = rect.top - tooltipRect.height - gap;
    const y = belowY + tooltipRect.height + margin <= window.innerHeight ? belowY : Math.max(margin, aboveY);
    tooltip.style.left = `${x}px`;
    tooltip.style.top = `${y}px`;
  }

  function showTooltip(event) {
    const target = event.target.closest?.(".standard-tooltip-chip, .standard-rich-preview");
    const text = tooltipTextFor(target);
    if (!target || !text) return;
    const tooltip = ensureTooltip();
    tooltip.textContent = text;
    tooltip.hidden = false;
    positionTooltip(tooltip, event, target);
  }

  function hideTooltip() {
    const tooltip = document.querySelector(".floating-standard-tooltip");
    if (tooltip) tooltip.hidden = true;
  }

  document.addEventListener("pointerover", showTooltip);
  document.addEventListener("focusin", showTooltip);
  document.addEventListener("pointermove", (event) => {
    const tooltip = document.querySelector(".floating-standard-tooltip:not([hidden])");
    const target = event.target.closest?.(".standard-tooltip-chip, .standard-rich-preview");
    if (tooltip && target) positionTooltip(tooltip, event, target);
  });
  document.addEventListener("pointerout", (event) => {
    if (event.target.closest?.(".standard-tooltip-chip, .standard-rich-preview")) hideTooltip();
  });
  document.addEventListener("focusout", (event) => {
    if (event.target.closest?.(".standard-tooltip-chip, .standard-rich-preview")) hideTooltip();
  });
  window.addEventListener("resize", hideTooltip);
  window.addEventListener("scroll", hideTooltip, true);

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
