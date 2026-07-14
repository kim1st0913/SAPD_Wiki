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
    no_module_or_measure: "/",
    contract_pending: "待契约补充",
  };

  const SEMANTIC_ROLES = Object.freeze({
    status: Object.freeze({ selected: "--sapd-state-selected", complete: "--sapd-state-complete", warning: "--sapd-state-warning", review: "--sapd-state-review", error: "--sapd-state-error" }),
    object: Object.freeze({ service: "technical-chip service-chip", module: "technical-chip module-chip", measure: "technical-chip measure-chip", focus: "ownership-chip", system: "system-chip", environment: "environment-chip", note: "note-chip" }),
    drawio: Object.freeze({ stylePolicy: "immutable_external_overlay_only" }),
  });

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

  function emptyMark() {
    return "/";
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

  const SERVICE_SCOPE_CODES = new Set(["I-AP", "I-DI", "I-NT", "I-US", "I-OS", "I-HD", "I-PE"]);

  function serviceScopeCode(item) {
    const values = [];
    if (item && typeof item === "object") {
      values.push(
        item.scopeCode,
        item.serviceScopeCode,
        item.category,
        item.code,
        item.serviceCode,
        item.objectCode,
        item.id,
        item.serviceId,
        item.title,
        item.name,
        item.objectName,
      );
    } else {
      values.push(item);
    }
    for (const value of values) {
      const raw = text(value).trim();
      if (!raw) continue;
      const direct = raw.match(/\bI-[A-Z]{2}\b/)?.[0] || "";
      if (SERVICE_SCOPE_CODES.has(direct)) return direct;
    }
    return "";
  }

  function serviceScopeAttrs(utils, item) {
    const code = serviceScopeCode(item);
    if (!code) return "";
    const escaped = utils?.escapeHtml ? utils.escapeHtml(code) : code.replaceAll("&", "&amp;").replaceAll('"', "&quot;");
    return ` data-scope="${escaped}" data-service-scope="${escaped}"`;
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

  function inferredKindKey(item, fallbackKind = "") {
    const explicitKind = kindKey(fallbackKind);
    if (explicitKind) return explicitKind;
    if (item && typeof item === "object") {
      const type = text(item.objectType || item.type).trim();
      if (type === "security_technical_service") return "security_technical_service";
      if (type === "security_technology_module") return "security_technology_module";
      if (type === "security_technical_measure") return "security_technical_measure";
      if (type === "capability_focus") return "capability_focus";
      if (type === "security_system") return "security_system";
      if (type === "information_environment") return "information_environment";
      const serviceCode = text(item.code || item.serviceCode || item.objectCode || item.id).trim();
      if (/^(?:I-[A-Z]{2}|ALL)&T-[A-Z]{2}\./.test(serviceCode) || /^M-[A-Z]{2}\./.test(serviceCode)) return "security_technical_service";
    } else {
      const raw = text(item).trim();
      if (/^(?:I-[A-Z]{2}|ALL)&T-[A-Z]{2}\./.test(raw) || /^M-[A-Z]{2}\./.test(raw)) return "security_technical_service";
    }
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

  function annotationValueAttrs(utils, value) {
    const raw = text(value).trim();
    if (!raw || raw === "/" || raw === state("missing")) return "";
    const escaped = utils.escapeHtml;
    return ` data-annotation-value="true" data-copy-text="${escaped(raw)}" data-annotation-tooltip="${escaped(raw)}"`;
  }

  function relationChip(utils, item, { empty = state("missing"), kind = "", showKind = false, preferCodeTitle = true } = {}) {
    const escaped = utils.escapeHtml;
    const itemKind = text((item && typeof item === "object" && (item.objectKind || item.kind)) || kind).trim();
    const itemKindKey = inferredKindKey(item, itemKind);
    const visibleKind = showKind && itemKindKey !== "security_technical_service" ? itemKind : "";
    const kindPrefix = visibleKind ? `<em>${escaped(visibleKind)}</em>` : "";
    const visibleText = itemText(utils, item, empty, preferCodeTitle);
    const copyText = [visibleKind, visibleText].filter(Boolean).join(" | ");
    const resolvedKind = itemKindKey ? label(itemKindKey, itemKind) : itemKind;
    const scopeAttrs = itemKindKey === "security_technical_service" ? serviceScopeAttrs(utils, item) : "";
    return `<span class="relation-chip ${chipClass(resolvedKind)}"${annotationValueAttrs(utils, copyText && copyText !== empty ? copyText : "")}${scopeAttrs}>${kindPrefix}<span class="relation-chip-text">${escaped(visibleText)}</span></span>`;
  }

  function relationChipList(utils, items, options = {}) {
    const rows = (Array.isArray(items) ? items : []).filter(Boolean);
    if (!rows.length) return `<span class="empty-inline">${utils.escapeHtml(emptyMark())}</span>`;
    const limit = Number.isFinite(options.limit) ? options.limit : Infinity;
    const visible = rows.slice(0, limit);
    const more = rows.length - visible.length;
    const chips = visible.map((item) => relationChip(utils, item, options)).join("");
    return `${chips}${more > 0 ? `<span class="relation-chip muted">+${utils.escapeHtml(more)}</span>` : ""}`;
  }

  display.labels = ENTITY_LABELS;
  display.states = DISPLAY_STATES;
  display.semanticRoles = SEMANTIC_ROLES;
  display.label = label;
  display.relationLabel = relationLabel;
  display.state = state;
  display.emptyMark = emptyMark;
  display.chipClass = chipClass;
  display.inferredKindKey = inferredKindKey;
  display.serviceScopeCode = serviceScopeCode;
  display.serviceScopeAttrs = serviceScopeAttrs;
  display.itemText = itemText;
  display.annotationValueAttrs = annotationValueAttrs;
  display.relationChip = relationChip;
  display.relationChipList = relationChipList;
})();
