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

  const NAV_MANIFEST = {
    version: "v1",
    appName: "SAPD Wiki",
    navigation: [
      { id: "global-navigation", label: "全局导航", route: "/", type: "application-shell", priority: "P0", children: [] },
      {
        id: "guides",
        label: "安全指南",
        route: "/guides",
        type: "document-hub",
        priority: "P2",
        children: [
          { id: "security-architecture-design", label: "安全技术架构设计方法", route: "/guides/security-architecture-design", type: "document-page", priority: "P2", children: [] },
          { id: "data-security-design", label: "数据安全设计方法", route: "/guides/data-security-design", type: "document-page", priority: "P2", children: [] },
          { id: "security-governance-model", label: "安全管控模式设计方法", route: "/guides/security-governance-model", type: "document-page", priority: "P2", children: [] },
          { id: "maturity-model-usage", label: "成熟度模型使用方法", route: "/guides/maturity-model-usage", type: "document-page", priority: "P2", children: [] },
          { id: "other-guides", label: "其他指南", route: "/guides/others", type: "placeholder-page", priority: "P3", children: [] },
        ],
      },
      { id: "capability-mapping", label: "安全能力映射", route: "/capability-mapping", type: "capability-mapping-workbench", priority: "P1", children: [] },
      { id: "environment-mapping", label: "信息化环境安全能力映射", route: "/environment-mapping", type: "environment-mapping-workbench", priority: "P1", children: [] },
      { id: "development-security", label: "开发安全", route: "/development-security", type: "domain-module", priority: "P3", children: [] },
      { id: "data-security", label: "数据安全", route: "/data-security", type: "domain-module", priority: "P3", children: [] },
      { id: "sapd-maturity-assessment", label: "SAPD成熟度评估", route: "/sapd-maturity-assessment", type: "domain-module", priority: "P2", children: [] },
      {
        id: "knowledge",
        label: "安全知识",
        route: "/knowledge",
        type: "knowledge-directory",
        priority: "P2",
        children: [
          { id: "security-scopes", label: "安全能力作用域目录", route: "/knowledge/scopes", type: "knowledge-directory", priority: "P2", children: [] },
          { id: "technical-modules", label: "安全技术模块 / 安全技术措施目录", route: "/knowledge/technical-modules", type: "knowledge-directory", priority: "P2", children: [] },
          { id: "work-items", label: "安全工作清单目录", route: "/knowledge/work-items", type: "knowledge-directory", priority: "P2", children: [] },
          { id: "processes", label: "安全职能流程目录", route: "/knowledge/processes", type: "knowledge-directory", priority: "P2", children: [] },
          { id: "functions", label: "安全工作职能目录", route: "/knowledge/functions", type: "knowledge-directory", priority: "P2", children: [] },
          { id: "role-references", label: "岗位 / 职能参考目录", route: "/knowledge/role-references", type: "knowledge-directory", priority: "P2", children: [] },
          { id: "hype-cycle", label: "Hype Cycle", route: "/knowledge/hype-cycle", type: "knowledge-directory", priority: "P3", children: [] },
          { id: "other-knowledge", label: "其他知识目录", route: "/knowledge/others", type: "placeholder-page", priority: "P3", children: [] },
        ],
      },
      {
        id: "standards",
        label: "安全标准 / 框架",
        route: "/standards",
        type: "standard-framework-directory",
        priority: "P2",
        children: [
          { id: "mlps-level-3", label: "等级保护三级", route: "/standards/mlps-level-3", type: "standard-framework-page", priority: "P2", children: [] },
          { id: "nist-csf-2", label: "NIST CSF 2.0", route: "/standards/nist-csf-2", type: "standard-framework-page", priority: "P2", children: [] },
          { id: "iso-27001-2022", label: "ISO/IEC 27001:2022", route: "/standards/iso-27001-2022", type: "standard-framework-page", priority: "P2", children: [] },
          { id: "dsp-level-2", label: "DSP 2级策略清单", route: "/standards/dsp-level-2", type: "standard-framework-page", priority: "P2", children: [] },
          { id: "cis-csc-v8", label: "CIS CSC v8", route: "/standards/cis-csc-v8", type: "standard-framework-page", priority: "P2", children: [] },
          { id: "crf", label: "CRF", route: "/standards/crf", type: "standard-framework-page", priority: "P2", children: [] },
          { id: "nist-800-53-rev5", label: "NIST SP 800-53 Rev.5", route: "/standards/nist-800-53-rev5", type: "standard-framework-page", priority: "P2", children: [] },
          { id: "other-standards", label: "其他标准 / 框架", route: "/standards/others", type: "placeholder-page", priority: "P3", children: [] },
        ],
      },
    ],
  };

  const ROUTE_TARGETS = {
    "/": { view: "overview" },
    "/guides": { view: "content", contentPage: "html" },
    "/guides/security-architecture-design": { view: "content", contentPage: "html" },
    "/guides/data-security-design": { view: "content", contentPage: "html" },
    "/guides/security-governance-model": { view: "content", contentPage: "html" },
    "/guides/maturity-model-usage": { view: "content", contentPage: "html" },
    "/guides/others": { view: "content", contentPage: "html" },
    "/capability-mapping": { view: "capabilities" },
    "/environment-mapping": { view: "environment" },
    "/development-security": { view: "dev-lifecycle" },
    "/data-security": { view: "data-lifecycle" },
    "/sapd-maturity-assessment": { view: "overview", placeholder: true },
    "/knowledge": { view: "maintenance", maintenancePage: "scopes" },
    "/knowledge/scopes": { view: "maintenance", maintenancePage: "scopes" },
    "/knowledge/technical-modules": { view: "maintenance", maintenancePage: "modules" },
    "/knowledge/work-items": { view: "maintenance", maintenancePage: "security-works" },
    "/knowledge/processes": { view: "maintenance", maintenancePage: "processes" },
    "/knowledge/functions": { view: "maintenance", maintenancePage: "work-functions" },
    "/knowledge/role-references": { view: "maintenance", maintenancePage: "references", referenceTab: "roles" },
    "/knowledge/hype-cycle": { view: "content", contentPage: "html", placeholder: true },
    "/knowledge/others": { view: "content", contentPage: "html", placeholder: true },
    "/standards": { view: "maintenance", maintenancePage: "standards", standardFramework: "mlps-level-3" },
    "/standards/mlps-level-3": { view: "maintenance", maintenancePage: "standards", standardFramework: "mlps-level-3" },
    "/standards/nist-csf-2": { view: "maintenance", maintenancePage: "standards", standardFramework: "nist-csf-2" },
    "/standards/iso-27001-2022": { view: "maintenance", maintenancePage: "standards", standardFramework: "iso-27001-2022" },
    "/standards/dsp-level-2": { view: "maintenance", maintenancePage: "references", referenceTab: "gbt" },
    "/standards/cis-csc-v8": { view: "maintenance", maintenancePage: "standards", standardFramework: "cis-csc-v8" },
    "/standards/crf": { view: "maintenance", maintenancePage: "standards", standardFramework: "crf" },
    "/standards/nist-800-53-rev5": { view: "maintenance", maintenancePage: "standards", standardFramework: "nist-800-53-rev5" },
    "/standards/others": { view: "maintenance", maintenancePage: "references", referenceTab: "gbt", placeholder: true },
  };

  const VIEW_ROUTES = {
    overview: "/",
    capabilities: "/capability-mapping",
    environment: "/environment-mapping",
    "dev-lifecycle": "/development-security",
    "data-lifecycle": "/data-security",
    content: "/guides",
    maintenance: "/knowledge/scopes",
  };

  const MAINTENANCE_ROUTES = {
    scopes: "/knowledge/scopes",
    modules: "/knowledge/technical-modules",
    "security-works": "/knowledge/work-items",
    processes: "/knowledge/processes",
    "work-functions": "/knowledge/functions",
    measures: "/knowledge/technical-modules",
    "lcap-references": "/development-security",
    references: "/standards",
  };

  const CONTENT_ROUTES = {
    html: "/guides",
    drawio: "/guides/others",
    ppt: "/guides/others",
  };

  const PAGE_DESCRIPTIONS = {
    "/": "查看当前已导入安全能力、信息化环境、生命周期和知识维护数据的关系覆盖状态。",
    "/guides": "承载安全架构、数据安全、管控模式和成熟度模型等方法论说明。",
    "/capability-mapping": "从安全能力和关注点出发，核对技术视角、管理视角和标准 / 框架映射。",
    "/environment-mapping": "从信息化环境和对象出发，核对对象、作用域、服务、模块、措施和能力关联。",
    "/development-security": "以 LC-AP 开发安全生命周期阶段和活动为主语，承载受控专项关系投影。",
    "/data-security": "保留当前数据生命周期维度页面入口，后续再按数据安全专题契约收口。",
    "/sapd-maturity-assessment": "成熟度评估已纳入菜单规划，评分填报和结果生成将在独立模块中实现。",
    "/knowledge": "集中维护作用域、技术模块、技术措施、安全工作、流程、职能和岗位参考等知识对象。",
    "/standards": "集中查看标准 / 框架参考及其与能力、措施和管理工作的映射关系。",
  };

  const TYPE_LABELS = {
    "application-shell": "应用壳",
    "document-hub": "文档集合",
    "document-page": "文档页",
    "capability-mapping-workbench": "能力工作台",
    "environment-mapping-workbench": "环境工作台",
    "domain-module": "专题模块",
    "knowledge-directory": "知识目录",
    "standard-framework-directory": "标准目录",
    "standard-framework-page": "标准页",
    "placeholder-page": "预留页",
  };

  const NAV_SYMBOLS = {
    "global-navigation": "⌂",
    guides: "□",
    "capability-mapping": "▣",
    "environment-mapping": "◫",
    "development-security": "◇",
    "data-security": "◎",
    "sapd-maturity-assessment": "◌",
    knowledge: "☷",
    standards: "▤",
  };

  function allNavItems(items = NAV_MANIFEST.navigation, parent = null) {
    return components.utils.list(items).flatMap((item) => [{ ...item, parent }, ...allNavItems(item.children, item)]);
  }

  function findNavItem(route) {
    return allNavItems().find((item) => item.route === route) || NAV_MANIFEST.navigation[0];
  }

  function parentForRoute(route) {
    return allNavItems().find((item) => components.utils.list(item.children).some((child) => child.route === route)) || null;
  }

  function getRouteTarget(route) {
    const normalized = ROUTE_TARGETS[route] ? route : "/";
    return { route: normalized, ...ROUTE_TARGETS[normalized] };
  }

  function routeForView({ view, activeMaintenancePage, activeContentPage, activeStandardFramework } = {}) {
    if (view === "maintenance" && activeMaintenancePage === "standards") return `/standards/${activeStandardFramework || "mlps-level-3"}`;
    if (view === "maintenance") return MAINTENANCE_ROUTES[activeMaintenancePage] || VIEW_ROUTES.maintenance;
    if (view === "content") return CONTENT_ROUTES[activeContentPage] || VIEW_ROUTES.content;
    return VIEW_ROUTES[view] || "/";
  }

  function childRouteActive(parent, route) {
    return components.utils.list(parent.children).some((child) => child.route === route);
  }

  function renderGlobalSearch() {
    return `
      <label class="global-search" for="searchInput">
        <span class="search-icon" aria-hidden="true">⌕</span>
        <input id="searchInput" type="search" placeholder="搜索知识、能力、标准、指南" autocomplete="off" />
        <kbd>⌘K</kbd>
      </label>
    `;
  }

  function renderTopBar() {
    return `
      ${renderGlobalSearch()}
      <div id="localModeStatus" class="topbar-status" aria-label="本地运行状态"></div>
      <div class="topbar-actions" aria-label="全局操作">
        <button type="button" title="通知" aria-label="通知">!</button>
        <button type="button" title="设置" aria-label="设置">⚙</button>
        <button type="button" title="本地数据包" aria-label="本地数据包">▤</button>
      </div>
      <div class="metrics" id="metrics"></div>
    `;
  }

  function renderNavigationItem(item, activeRoute) {
    const children = components.utils.list(item.children);
    const active = item.route === activeRoute || childRouteActive(item, activeRoute);
    const symbol = NAV_SYMBOLS[item.id] || "•";
    if (children.length) {
      return `
        <details class="navigation-group" ${active ? "open" : ""} data-nav-id="${escapeHtml(item.id)}">
          <summary class="module-tab navigation-parent ${active ? "active" : ""}" title="${escapeHtml(item.label)}">
            <span class="nav-symbol">${escapeHtml(symbol)}</span>
            <span>${escapeHtml(item.label)}</span>
          </summary>
          <div class="secondary-navigation">
            ${children
              .map(
                (child) => `
                  <button class="submodule-tab ${child.route === activeRoute ? "active" : ""}" type="button" data-app-route="${escapeHtml(child.route)}" data-view="${escapeHtml(getRouteTarget(child.route).view)}">
                    <span>${escapeHtml(child.label)}</span>
                  </button>
                `,
              )
              .join("")}
          </div>
        </details>
      `;
    }
    return `
      <button class="module-tab ${active ? "active" : ""}" type="button" data-app-route="${escapeHtml(item.route)}" data-view="${escapeHtml(getRouteTarget(item.route).view)}" title="${escapeHtml(item.label)}">
        <span class="nav-symbol">${escapeHtml(symbol)}</span>
        <span>${escapeHtml(item.label)}</span>
      </button>
    `;
  }

  function renderSideNavigation(activeRoute = "/") {
    return `
      <div class="brand shell-sidebar-brand">
        <div class="brand-mark">S</div>
        <div>
          <h1>SAPD Wiki</h1>
          <p>本地业务关系工作台</p>
        </div>
      </div>
      <nav class="module-tabs manifest-navigation" aria-label="SAPD Wiki 全局导航">
        ${NAV_MANIFEST.navigation.map((item) => renderNavigationItem(item, activeRoute)).join("")}
      </nav>
      <div class="sidebar-status">
        <span>运行模式</span>
        <strong>本地静态页面</strong>
        <small>Manifest 导航已接入，页面数据仍通过 dataClient 读取</small>
      </div>
    `;
  }

  function breadcrumbItems(route) {
    const item = findNavItem(route);
    const parent = parentForRoute(route);
    return [NAV_MANIFEST.navigation[0], parent, item].filter(Boolean).filter((row, index, rows) => rows.findIndex((candidate) => candidate.route === row.route) === index);
  }

  function renderBreadcrumb(route = "/") {
    return `
      <nav class="breadcrumb" aria-label="当前位置">
        ${breadcrumbItems(route)
          .map((item, index, rows) => `<span>${escapeHtml(item.label)}</span>${index < rows.length - 1 ? '<i aria-hidden="true">/</i>' : ""}`)
          .join("")}
      </nav>
    `;
  }

  function renderPageHeader({ activeRoute = "/" } = {}) {
    const item = findNavItem(activeRoute);
    const rootRoute = parentForRoute(activeRoute)?.route || activeRoute;
    const description = PAGE_DESCRIPTIONS[activeRoute] || PAGE_DESCRIPTIONS[rootRoute] || "当前页面通过 Manifest 导航进入，业务内容由现有前端 ViewModel 渲染。";
    const target = getRouteTarget(activeRoute);
    const isSourceTablePage = target.view === "maintenance";
    const isStandardFrameworkPage = target.view === "maintenance" && target.maintenancePage === "standards";
    return `
      <section class="app-page-header" id="appPageHeader">
        <div class="page-header-copy">
          ${renderBreadcrumb(activeRoute)}
          <div class="page-title-row">
            <h1>${escapeHtml(item.label)}</h1>
            ${isStandardFrameworkPage ? '<span id="pageHeaderCount" class="page-title-summary" hidden></span>' : ""}
            ${isStandardFrameworkPage ? "" : `<span class="shell-tag">${escapeHtml(item.priority || "规划")}</span>`}
            ${isStandardFrameworkPage ? "" : `<span class="shell-tag muted">${escapeHtml(TYPE_LABELS[item.type] || item.type)}</span>`}
          </div>
          <p>${escapeHtml(description)}</p>
        </div>
        ${
          isSourceTablePage
            ? `<label class="page-header-search" for="sourceSearchInput">
                <span class="search-icon" aria-hidden="true">⌕</span>
                <input id="sourceSearchInput" type="search" placeholder="搜索名称、编码、分组或关系" autocomplete="off" />
              </label>`
            : `<div class="page-header-actions" aria-label="页面操作">
                <button type="button" disabled>导出数据</button>
                <button type="button" disabled>编辑映射</button>
              </div>`
        }
      </section>
    `;
  }

  function ensurePageHeader(activeRoute) {
    const main = document.querySelector(".app-main");
    const stage = document.querySelector(".workspace-stage");
    if (!main || !stage) return;
    let header = document.getElementById("appPageHeader");
    if (!header) {
      stage.insertAdjacentHTML("beforebegin", renderPageHeader({ activeRoute }));
      return;
    }
    header.outerHTML = renderPageHeader({ activeRoute });
  }

  function applyWorkbenchContainers() {
    [
      ["overviewWorkspace", "three"],
      ["capabilityWorkspace", "two"],
      ["environmentWorkspace", "two"],
      ["devLifecycleWorkspace", "three"],
      ["dataLifecycleWorkspace", "three"],
      ["maintenanceWorkspace", "three"],
      ["contentWorkspace", "three"],
    ].forEach(([id, mode]) => {
      const workspace = document.getElementById(id);
      if (!workspace) return;
      workspace.classList.add("workbench-layout", `workbench-layout-${mode}`);
    });
    [
      ".overview-issue-pane",
      ".lifecycle-detail-pane",
      ".source-detail-pane",
      ".content-detail-pane",
    ].forEach((selector) => {
      document.querySelectorAll(selector).forEach((panel) => panel.classList.add("right-insight-panel"));
    });
  }

  function mountApplicationShell({ activeRoute = "/" } = {}) {
    document.getElementById("app")?.classList.add("app-shell-integrated");
    const sidebar = document.querySelector(".app-sidebar");
    const topbar = document.querySelector(".topbar");
    if (sidebar) sidebar.innerHTML = renderSideNavigation(activeRoute);
    if (topbar) topbar.innerHTML = renderTopBar();
    ensurePageHeader(activeRoute);
    applyWorkbenchContainers();
    updateApplicationShell({ activeRoute });
  }

  function updateApplicationShell({ activeRoute = "/" } = {}) {
    document.querySelectorAll("[data-app-route]").forEach((element) => {
      const active = element.dataset.appRoute === activeRoute;
      element.classList.toggle("active", active);
      element.setAttribute("aria-current", active ? "page" : "false");
    });
    document.querySelectorAll(".navigation-group").forEach((group) => {
      const parent = NAV_MANIFEST.navigation.find((item) => item.id === group.dataset.navId);
      const active = parent ? parent.route === activeRoute || childRouteActive(parent, activeRoute) : false;
      group.classList.toggle("active", active);
      const summary = group.querySelector("summary");
      summary?.classList.toggle("active", active);
      if (active) group.open = true;
    });
    ensurePageHeader(activeRoute);
  }

  function renderWorkbenchLayout({ left = "", main = "", right = "" } = {}) {
    return `
      <section class="workbench-layout workbench-layout-three">
        <aside class="workbench-layout-left">${left}</aside>
        <section class="workbench-layout-main">${main}</section>
        <aside class="right-insight-panel">${right}</aside>
      </section>
    `;
  }

  function renderRightInsightPanel({ title = "洞察区", count = "", body = "" } = {}) {
    return `
      <aside class="right-insight-panel">
        <div class="pane-head">
          <h2>${escapeHtml(title)}</h2>
          ${count === "" ? "" : `<span class="count-pill">${escapeHtml(count)}</span>`}
        </div>
        <div class="right-insight-body">${body}</div>
      </aside>
    `;
  }

  function displaySelectedType(value) {
    const labels = {
      capability_category: "能力分类",
      capability_focus: "能力关注点",
      service: "安全技术服务",
      scope: "作用域",
      process: "安全流程",
      module: "技术模块",
      measure: "技术措施",
    };
    return labels[value] || value || "能力对象";
  }

  // Legacy helper kept for the existing capability page. Global shell work lives in mountApplicationShell.
  function renderCapabilityWorkspace() {
    return `
      <aside class="capability-tree-pane app-shell-secondary">
        <div class="pane-head">
          <h2>安全能力映射</h2>
        </div>
        <div id="tree" class="tree"></div>
      </aside>

      <section class="capability-relation-pane app-shell-workspace">
        <button id="expandCapabilityCatalogTab" class="catalog-expand-tab" type="button" aria-label="展开安全能力目录" aria-expanded="false">目录</button>
        <div class="capability-workbench-head">
          <div id="capabilityFocusHeader" class="capability-focus-head-slot"></div>
          <div class="capability-workbench-tools">
            <input id="capabilitySearchInput" type="search" placeholder="搜索能力、服务、作用域、流程、模块" />
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
      { label: "对象", value: displaySelectedType(summary.selectedType) },
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
    manifest: NAV_MANIFEST,
    routeTargets: ROUTE_TARGETS,
    getRouteTarget,
    routeForView,
    mountApplicationShell,
    updateApplicationShell,
    renderTopBar,
    renderGlobalSearch,
    renderSideNavigation,
    renderBreadcrumb,
    renderPageHeader,
    renderWorkbenchLayout,
    renderRightInsightPanel,
    mountCapabilityWorkspace,
    renderCapabilitySummary,
    renderLocalModeStatus,
  };
})();
