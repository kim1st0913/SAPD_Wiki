(function () {
  const display = (window.sapdDisplay = window.sapdDisplay || {});

  const ENTITY_LABELS = {
    capability_focus: "能力关注点",
    scope_type: "作用域",
    security_technical_service: "安全技术服务",
    security_technology_module: "安全技术模块",
    security_technical_measure: "安全技术措施",
    security_module_or_measure: "安全技术模块/措施",
    security_policy_requirement: "安全策略要求",
    l2_process_group: "L2 流程组",
    l3_process: "L3 流程",
    l4_activity: "L4 活动",
    security_work: "安全工作",
    security_function: "安全职能",
    security_system: "安全系统",
    information_environment: "信息化环境",
    information_object: "信息化对象",
  };

  const DISPLAY_STATES = {
    missing: "待补充",
    empty: "暂无",
    not_applicable: "不适用",
    pending_review: "待确认",
    mapping_exception: "映射异常",
    no_applicable_service: "无适用服务",
    no_module_or_measure: "暂无安全技术模块/措施",
    contract_pending: "待契约补充",
  };

  function text(value) {
    return value == null ? "" : String(value);
  }

  function label(key, fallback = "") {
    return ENTITY_LABELS[key] || fallback || key;
  }

  function relationLabel(key) {
    return `关联${label(key)}`;
  }

  function state(key, fallback = "") {
    return DISPLAY_STATES[key] || fallback || key;
  }

  function kindKey(kind) {
    const value = text(kind).trim();
    if (value === "安全技术服务" || value === "开发技术服务" || value.includes("技术服务")) return "security_technical_service";
    if (value === "安全技术模块" || value.includes("模块")) return "security_technology_module";
    if (value === "安全技术措施" || value.includes("措施")) return "security_technical_measure";
    if (value === "能力关注点" || value.includes("关注点")) return "capability_focus";
    if (value === "安全系统") return "security_system";
    if (value === "信息化环境") return "information_environment";
    if (value.includes("说明")) return "note";
    return "";
  }

  function chipClass(kind) {
    const key = kindKey(kind);
    if (key === "security_technical_service") return "technical-chip service-chip";
    if (key === "security_technology_module") return "technical-chip module-chip";
    if (key === "security_technical_measure") return "technical-chip measure-chip";
    if (key === "capability_focus") return "ownership-chip";
    if (key === "security_system") return "system-chip";
    if (key === "information_environment") return "environment-chip";
    if (key === "note") return "note-chip";
    return "";
  }

  function itemText(utils, item, empty = state("missing"), preferCodeTitle = true) {
    if (item == null || item === "") return empty;
    if (typeof item === "number" && Number.isNaN(item)) return empty;
    if (typeof item === "object") {
      const value = preferCodeTitle && utils.codeTitleOf ? utils.codeTitleOf(item, empty) : utils.titleOf(item, empty);
      return utils.text(value).trim() || empty;
    }
    const value = utils.text ? utils.text(item).trim() : text(item).trim();
    return value && value !== "[object Object]" ? value : empty;
  }

  function relationChip(utils, item, { empty = state("missing"), kind = "", showKind = false, preferCodeTitle = true } = {}) {
    const escaped = utils.escapeHtml;
    const itemKind = text((item && typeof item === "object" && (item.objectKind || item.kind)) || kind).trim();
    const visibleKind = showKind ? itemKind : "";
    const kindPrefix = visibleKind ? `<em>${escaped(visibleKind)}</em>` : "";
    return `<span class="relation-chip ${chipClass(itemKind)}">${kindPrefix}${escaped(itemText(utils, item, empty, preferCodeTitle))}</span>`;
  }

  function relationChipList(utils, items, options = {}) {
    const rows = (Array.isArray(items) ? items : []).filter(Boolean);
    const empty = options.empty || state("missing");
    if (!rows.length) return `<span class="empty-inline">${utils.escapeHtml(empty)}</span>`;
    const limit = Number.isFinite(options.limit) ? options.limit : Infinity;
    const visible = rows.slice(0, limit);
    const more = rows.length - visible.length;
    const chips = visible.map((item) => relationChip(utils, item, options)).join("");
    return `${chips}${more > 0 ? `<span class="relation-chip muted">+${utils.escapeHtml(more)}</span>` : ""}`;
  }

  display.labels = ENTITY_LABELS;
  display.states = DISPLAY_STATES;
  display.label = label;
  display.relationLabel = relationLabel;
  display.state = state;
  display.chipClass = chipClass;
  display.itemText = itemText;
  display.relationChip = relationChip;
  display.relationChipList = relationChipList;
})();
