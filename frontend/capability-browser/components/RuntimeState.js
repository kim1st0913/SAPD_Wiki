(function () {
  const components = (window.sapdComponents = window.sapdComponents || {});

  const STATE_META = {
    loading: {
      label: "加载中",
      title: "正在加载",
      message: "完成后会自动显示，无需离开当前页面。",
    },
    empty: {
      label: "空数据",
      title: "暂无可用数据",
      message: "数据源已成功读取，但当前没有符合条件的业务记录。可调整筛选或补充数据后再查看。",
    },
    missing_file: {
      label: "缺少文件",
      title: "数据文件尚未准备",
      message: "未找到当前页面需要的数据包。请先完成对应数据导出，再重新加载。",
    },
    error: {
      label: "请求失败",
      title: "加载失败",
      message: "数据请求未成功。可保留当前页面与选择并重新加载。",
    },
    no_selection: {
      label: "待选择",
      title: "尚未选择对象",
      message: "请从左侧目录选择一个对象查看详情。",
    },
  };

  const ACTION_ATTRIBUTES = {
    package: "data-runtime-state-retry",
    capability: "data-capability-load-retry",
    standard: "data-standard-load-retry",
  };

  function escape(value) {
    const utils = components.utils;
    if (utils?.escapeHtml) return utils.escapeHtml(value);
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  function normalizeState(value) {
    const normalized = String(value || "")
      .trim()
      .toLowerCase()
      .replaceAll("-", "_");
    if (STATE_META[normalized]) return normalized;
    if (["api_error", "api_unavailable", "failed", "failure"].includes(normalized)) return "error";
    return normalized;
  }

  function resolveState({ loading = false, error = null, dataState = "", hasData = null, selected = true } = {}) {
    if (loading) return "loading";
    if (error) return "error";
    const explicitState = normalizeState(dataState);
    if (["missing_file", "error", "empty"].includes(explicitState)) return explicitState;
    if (selected === false) return "no_selection";
    if (hasData === false) return "empty";
    return "ready";
  }

  function renderSkeleton(rowCount = 3) {
    const count = Math.max(2, Math.min(5, Number(rowCount) || 3));
    return `
      <div class="runtime-state__skeleton" aria-hidden="true">
        ${Array.from({ length: count }, (_, index) => `<span style="--runtime-skeleton-index:${index}"></span>`).join("")}
      </div>
    `;
  }

  function renderAction(action) {
    const scope = String(action?.scope || "").trim();
    const key = String(action?.key || "").trim();
    const attribute = ACTION_ATTRIBUTES[scope];
    if (!attribute || !key) return "";
    return `
      <button type="button" class="runtime-state__action" ${attribute}="${escape(key)}">
        ${escape(action.label || "重新加载")}
      </button>
    `;
  }

  function render({ state = "empty", title = "", message = "", action = null, compact = false, skeletonRows = 3, ariaLabel = "" } = {}) {
    const normalizedState = normalizeState(state);
    const meta = STATE_META[normalizedState] || STATE_META.empty;
    const domState = normalizedState.replaceAll("_", "-");
    const role = normalizedState === "error" ? "alert" : "status";
    const busy = normalizedState === "loading" ? ' aria-busy="true"' : "";
    const label = ariaLabel || `${meta.label}：${title || meta.title}`;
    return `
      <section class="runtime-state${compact ? " is-compact" : ""}" data-runtime-state="${escape(domState)}" role="${role}" aria-label="${escape(label)}"${busy}>
        <div class="runtime-state__content">
          <span class="runtime-state__eyebrow"><i aria-hidden="true"></i>${escape(meta.label)}</span>
          <strong class="runtime-state__title">${escape(title || meta.title)}</strong>
          <p class="runtime-state__message">${escape(message || meta.message)}</p>
          ${normalizedState === "loading" ? renderSkeleton(skeletonRows) : ""}
          ${renderAction(action)}
        </div>
      </section>
    `;
  }

  components.RuntimeState = {
    states: ["loading", "empty", "missing_file", "error", "no_selection"],
    defaults: STATE_META,
    normalizeState,
    resolveState,
    render,
  };
})();
