(function () {
  const components = (window.sapdComponents = window.sapdComponents || {});

  const text = (value) => (value == null ? "" : String(value));
  const escapeHtml = (value) =>
    text(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");

  components.utils = {
    escapeHtml,
    text,
    list: (value) => (Array.isArray(value) ? value : []),
    titleOf(value, fallback = "未命名") {
      if (!value) return fallback;
      if (typeof value === "object") return text(value.title || value.name || value.code || value.id || fallback);
      return text(value);
    },
  };

  function renderCapabilityWorkspace() {
    return `
      <aside class="capability-tree-pane app-shell-secondary">
        <div class="pane-head">
          <h2>安全能力映射</h2>
          <button id="resetButton" type="button" title="重置选择">↺</button>
        </div>
        <div id="tree" class="tree"></div>
      </aside>

      <section class="capability-relation-pane app-shell-workspace">
        <div class="capability-workbench-head">
          <div>
            <p class="eyebrow">Capability Relationship Workspace</p>
            <h2>当前关注点工作台</h2>
          </div>
          <div class="capability-workbench-tools">
            <input id="capabilitySearchInput" type="search" placeholder="搜索能力、服务、作用域、流程、模块" />
            <div id="capabilitySummary" class="capability-summary-strip"></div>
          </div>
        </div>
        <div id="detail" class="capability-relation-workspace"></div>
      </section>
    `;
  }

  function mountCapabilityWorkspace(root) {
    if (!root || root.dataset.appShellMounted === "true") return;
    root.innerHTML = renderCapabilityWorkspace();
    root.dataset.appShellMounted = "true";
    root.classList.add("app-shell-two-column");
  }

  function renderCapabilitySummary(summary = {}) {
    const statusBadge = components.StatusBadge;
    const rows = [
      { label: "关注点", value: summary.rowCount ?? 0 },
      { label: "技术映射", value: summary.technicalRowCount ?? 0 },
      { label: "管理映射", value: summary.managementRowCount ?? 0 },
      { label: "无服务", value: summary.noServiceCount ?? 0 },
      { label: "异常", value: summary.ambiguousCount ?? 0 },
      { label: "类型", value: summary.selectedType || "能力对象" },
    ];
    return rows
      .map((item) =>
        statusBadge
          ? statusBadge.render({ label: item.label, value: item.value, tone: item.label === "异常" && Number(item.value) > 0 ? "warning" : item.label === "类型" ? "neutral" : "info" })
          : `<span class="status-badge"><small>${escapeHtml(item.label)}</small><strong>${escapeHtml(item.value)}</strong></span>`,
      )
      .join("");
  }

  function renderLocalModeStatus() {
    if (components.StatusBadge) return components.StatusBadge.render({ label: "运行模式", value: "本地", tone: "ok" });
    return '<span class="status-badge status-badge-ok"><small>运行模式</small><strong>本地</strong></span>';
  }

  components.AppShell = {
    mountCapabilityWorkspace,
    renderCapabilitySummary,
    renderLocalModeStatus,
  };
})();
