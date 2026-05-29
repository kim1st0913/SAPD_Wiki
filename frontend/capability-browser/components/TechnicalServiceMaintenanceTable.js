(function () {
  const components = (window.sapdComponents = window.sapdComponents || {});
  const utils = components.utils;
  const display = window.sapdDisplay || {};
  const TABLE_STATE_KEY = "sapd:technical-service-maintenance-table:v1";
  let pendingScrollRestore = true;
  let scrollSaveTimer = 0;

  function displayValue(value, empty = "待补充") {
    if (value == null || value === "") return empty;
    if (typeof value === "number" && Number.isNaN(value)) return empty;
    const raw = typeof value === "object" ? utils.codeTitleOf(value, empty) : value;
    const normalized = utils.text(raw).trim();
    return normalized && normalized !== "[object Object]" ? normalized : empty;
  }

  function chipClass(kind) {
    if (display.chipClass) return display.chipClass(kind);
    if (kind === "安全技术模块") return "technical-chip module-chip";
    if (kind === "安全技术措施") return "technical-chip measure-chip";
    if (kind === "能力关注点") return "ownership-chip";
    if (kind === "安全系统") return "system-chip";
    if (kind === "信息化环境") return "environment-chip";
    return "technical-chip";
  }

  function chipList(items, empty = "待补充", fallbackKind = "", showKind = false) {
    if (display.relationChipList) {
      return display.relationChipList(utils, items, { empty, kind: fallbackKind, showKind });
    }
    const rows = utils.list(items).filter(Boolean);
    if (!rows.length) return `<span class="empty-inline">${utils.escapeHtml(empty)}</span>`;
    return rows
      .map((item) => {
        const kind = utils.text(item.objectKind || item.kind || fallbackKind).trim();
        return `<span class="relation-chip ${chipClass(kind)}">${showKind && kind ? `<em>${utils.escapeHtml(kind)}</em>` : ""}${utils.escapeHtml(displayValue(item, empty))}</span>`;
      })
      .join("");
  }

  function readTableState() {
    try {
      return JSON.parse(window.localStorage?.getItem(TABLE_STATE_KEY) || "{}") || {};
    } catch (error) {
      return {};
    }
  }

  function writeTableState(nextState) {
    try {
      const state = { ...readTableState(), ...nextState, updatedAt: Date.now() };
      window.localStorage?.setItem(TABLE_STATE_KEY, JSON.stringify(state));
    } catch (error) {
      // localStorage may be unavailable in private or restricted contexts.
    }
  }

  function expandedGroupSet() {
    const groups = readTableState().expandedGroups;
    return new Set(Array.isArray(groups) ? groups.filter(Boolean) : []);
  }

  function groupId(value) {
    return utils
      .text(value)
      .trim()
      .replace(/[^\w\u4e00-\u9fa5-]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  function renderServiceRow(row, selectedId, parentId, hidden = false) {
    const hiddenAttr = hidden ? " hidden" : "";
    return `
      <tr class="maintenance-data-row standard-group-detail ${row.id === selectedId ? "active" : ""}" data-standard-parent="${utils.escapeHtml(parentId)}" data-standard-lineage="${utils.escapeHtml(parentId)}" data-maintenance-id="${utils.escapeHtml(row.id)}"${hiddenAttr}>
        <td>${utils.escapeHtml(displayValue(row.index))}</td>
        <td>
          <strong>${utils.escapeHtml(displayValue(row.serviceLabel))}</strong>
        </td>
        <td>${utils.escapeHtml(displayValue(row.definition))}</td>
        <td>${chipList(row.ownershipFocuses, "待补充安全能力 / 关注点", "能力关注点")}</td>
        <td>${chipList(row.linkedModuleMeasures, display.state?.("no_module_or_measure") || "暂无安全技术模块/措施", "", true)}</td>
        <td>${chipList(row.linkedSystems, "待补充安全系统", "安全系统")}</td>
        <td>${chipList(row.linkedEnvironments, "待补充信息化环境", "信息化环境")}</td>
      </tr>
    `;
  }

  function renderGroupedRows(rows, scopeGroups, selectedId) {
    const groups = utils.list(scopeGroups).length ? utils.list(scopeGroups) : [{ id: "ungrouped", label: "全部服务", count: utils.list(rows).length, rows }];
    const expandedGroups = expandedGroupSet();
    return groups
      .map((group, index) => {
        const id = groupId(`technical-service-scope-${index}-${group.id || group.label}`);
        const expanded = expandedGroups.has(id);
        const serviceRows = utils.list(group.rows);
        return `
          <tr class="standard-group-row service-scope-table-group depth-0 ${expanded ? "expanded" : ""}" data-standard-group="${utils.escapeHtml(id)}">
            <td colspan="7">
              <button class="standard-group-toggle" type="button" aria-expanded="${expanded ? "true" : "false"}">
                <span class="standard-group-caret">›</span>
                  <span class="standard-group-main">
                  <strong>${utils.escapeHtml(group.label || "待补充作用域")}</strong>
                  <span class="standard-group-description">组内按安全能力 / 关注点顺序排列</span>
                </span>
                <em>${utils.escapeHtml(`${group.count ?? serviceRows.length} 项服务`)}</em>
              </button>
            </td>
          </tr>
          ${serviceRows.map((row) => renderServiceRow(row, selectedId, id, !expanded)).join("")}
        `;
      })
      .join("");
  }

  function saveExpandedState(table) {
    if (!table) return;
    const expandedGroups = [...table.querySelectorAll(".standard-group-row[data-standard-group]")]
      .filter((row) => row.querySelector(".standard-group-toggle")?.getAttribute("aria-expanded") === "true")
      .map((row) => row.dataset.standardGroup)
      .filter(Boolean);
    writeTableState({ expandedGroups });
  }

  function saveScrollState() {
    const table = document.querySelector(".technical-service-maintenance-table[data-technical-service-table='true']");
    if (!table) return;
    const scrollBox = table.closest(".maintenance-table-scroll");
    writeTableState({
      scrollY: window.scrollY || document.documentElement.scrollTop || 0,
      scrollTop: scrollBox?.scrollTop || 0,
      scrollLeft: scrollBox?.scrollLeft || 0,
    });
  }

  function scheduleScrollRestore() {
    if (!pendingScrollRestore) return;
    pendingScrollRestore = false;
    const state = readTableState();
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        const table = document.querySelector(".technical-service-maintenance-table[data-technical-service-table='true']");
        const scrollBox = table?.closest(".maintenance-table-scroll");
        if (scrollBox && Number.isFinite(Number(state.scrollTop))) scrollBox.scrollTop = Number(state.scrollTop) || 0;
        if (scrollBox && Number.isFinite(Number(state.scrollLeft))) scrollBox.scrollLeft = Number(state.scrollLeft) || 0;
        if (Number.isFinite(Number(state.scrollY))) window.scrollTo(0, Number(state.scrollY) || 0);
      });
    });
  }

  function render({ rows, scopeGroups, selectedId, emptyState }) {
    const tableRows = utils.list(rows);
    if (!tableRows.length) {
      return `<div class="maintenance-empty-state">${utils.escapeHtml(emptyState || "暂无安全技术服务数据，请确认 ETL 是否已导出 security_technical_services。")}</div>`;
    }
    const html = `
      <div class="maintenance-table-scroll">
        <table class="maintenance-data-table technical-service-maintenance-table" data-technical-service-table="true">
          <thead>
            <tr>
              <th>序号</th>
              <th>${utils.escapeHtml(display.label?.("security_technical_service", "安全技术服务") || "安全技术服务")}</th>
              <th>定义</th>
              <th>归属安全能力 / 关注点</th>
              <th>${utils.escapeHtml(display.relationLabel?.("security_module_or_measure") || "关联安全技术模块/措施")}</th>
              <th>${utils.escapeHtml(display.relationLabel?.("security_system") || "关联安全系统")}</th>
              <th>${utils.escapeHtml(display.relationLabel?.("information_environment") || "关联信息化环境")}</th>
            </tr>
          </thead>
          <tbody>
            ${renderGroupedRows(tableRows, scopeGroups, selectedId)}
          </tbody>
        </table>
      </div>
    `;
    scheduleScrollRestore();
    return html;
  }

  document.addEventListener("click", (event) => {
    const toggle = event.target.closest?.(".technical-service-maintenance-table .standard-group-toggle");
    if (!toggle) return;
    const table = toggle.closest(".technical-service-maintenance-table");
    window.setTimeout(() => saveExpandedState(table), 0);
  });

  window.addEventListener(
    "scroll",
    () => {
      if (!document.querySelector(".technical-service-maintenance-table[data-technical-service-table='true']")) return;
      window.clearTimeout(scrollSaveTimer);
      scrollSaveTimer = window.setTimeout(saveScrollState, 120);
    },
    true,
  );

  components.TechnicalServiceMaintenanceTable = { render };
})();
