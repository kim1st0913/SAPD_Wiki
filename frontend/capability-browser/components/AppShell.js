(function () {
  const components = (window.sapdComponents = window.sapdComponents || {});
  const display = window.sapdDisplay || {};

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
    codeTitleOf(value, fallback = "未命名") {
      if (!value || typeof value !== "object") return this.titleOf(value, fallback);
      const code = text(value.code || "").trim();
      const title = this.titleOf(value, fallback);
      return [code, title].filter(Boolean).join(" ");
    },
  };

  const NAV_MANIFEST = {
    version: "v1",
    appName: "SAPD Wiki",
    navigation: [
      { id: "global-navigation", label: "全局导航", route: "/", type: "application-shell", children: [] },
      {
        id: "guides",
        label: "安全指南",
        route: "/guides",
        type: "document-hub",
        children: [
          { id: "security-architecture-design", label: "安全技术架构设计方法", route: "/guides/security-architecture-design", type: "document-page", children: [] },
          { id: "data-security-design", label: "数据安全设计方法", route: "/guides/data-security-design", type: "document-page", children: [] },
          { id: "security-governance-model", label: "安全管控模式设计方法", route: "/guides/security-governance-model", type: "placeholder-page", children: [] },
          { id: "maturity-model-usage", label: "成熟度模型使用方法", route: "/guides/maturity-model-usage", type: "placeholder-page", children: [] },
          { id: "other-guides", label: "其他指南", route: "/guides/others", type: "placeholder-page", children: [] },
        ],
      },
      { id: "capability-mapping", label: "安全能力映射", route: "/capability-mapping", type: "capability-mapping-workbench", children: [] },
      { id: "environment-mapping", label: "信息化环境安全能力映射", route: "/environment-mapping", type: "environment-mapping-workbench", children: [] },
      { id: "development-security", label: "LC-AP安全开发生命周期", route: "/development-security", type: "domain-module", children: [] },
      { id: "data-security", label: "LC-DT数据生命周期安全", route: "/data-security", type: "domain-module", children: [] },
      { id: "sapd-maturity-assessment", label: "SAPD成熟度评估", route: "/sapd-maturity-assessment", type: "placeholder-page", children: [] },
      {
        id: "knowledge",
        label: "安全知识",
        route: "/knowledge",
        type: "knowledge-directory",
        children: [
          { id: "security-scopes", label: "安全能力作用域目录", route: "/knowledge/scopes", type: "knowledge-directory", children: [] },
          { id: "technical-services", label: "安全技术服务清单", route: "/knowledge/technical-services", type: "knowledge-directory", children: [] },
          { id: "technical-knowledge", label: "安全技术模块/措施清单", route: "/knowledge/technical", type: "knowledge-directory", children: [] },
          { id: "management-workflows", label: "安全管理工作/流程清单", route: "/knowledge/management-workflows", type: "knowledge-directory", children: [] },
          { id: "application-systems", label: "应用系统目录", route: "/knowledge/application-systems", type: "knowledge-directory", children: [] },
          {
            id: "security-functions",
            label: "安全职能清单",
            route: "/knowledge/functions",
            type: "knowledge-directory",
            children: [
              { id: "security-functions-gbt", label: "GB/T 42446-2023", route: "/knowledge/gbt-42446", type: "knowledge-directory", children: [] },
              { id: "security-functions-gartner", label: "Gartner 工作岗位参考", route: "/knowledge/role-references", type: "knowledge-directory", children: [] },
            ],
          },
          { id: "hype-cycle", label: "Hype Cycle", route: "/knowledge/hype-cycle", type: "placeholder-page", children: [] },
          { id: "other-knowledge", label: "其他知识目录", route: "/knowledge/others", type: "placeholder-page", children: [] },
        ],
      },
      {
        id: "standards",
        label: "安全标准 / 框架",
        route: "/standards",
        type: "standard-framework-directory",
        children: [
          { id: "mlps-level-3", label: "等级保护三级", route: "/standards/mlps-level-3", type: "standard-framework-page", children: [] },
          { id: "nist-csf-2", label: "NIST CSF 2.0", route: "/standards/nist-csf-2", type: "standard-framework-page", children: [] },
          { id: "iso-27001-2022", label: "ISO/IEC 27001:2022", route: "/standards/iso-27001-2022", type: "standard-framework-page", children: [] },
          { id: "dsp-level-2", label: "DSP Secure Controls Framework (SCF) - 2026", route: "/standards/dsp-level-2", type: "standard-framework-page", children: [] },
          { id: "cis-csc-v8", label: "CIS CSC v8", route: "/standards/cis-csc-v8", type: "standard-framework-page", children: [] },
          { id: "crf", label: "CRF", route: "/standards/crf", type: "standard-framework-page", children: [] },
          { id: "nist-800-53-rev5", label: "NIST SP 800-53 Rev.5", route: "/standards/nist-800-53-rev5", type: "standard-framework-page", children: [] },
          { id: "other-standards", label: "其他标准 / 框架", route: "/standards/others", type: "placeholder-page", children: [] },
        ],
      },
    ],
  };

  const ROUTE_TARGETS = {
    "/": { view: "overview" },
    "/guides": { view: "content", contentPage: "html" },
    "/guides/security-architecture-design": { view: "content", contentPage: "html" },
    "/guides/data-security-design": { view: "content", contentPage: "html" },
    "/guides/security-governance-model": { view: "placeholder", placeholder: true },
    "/guides/maturity-model-usage": { view: "placeholder", placeholder: true },
    "/guides/others": { view: "placeholder", placeholder: true },
    "/capability-mapping": { view: "capabilities" },
    "/environment-mapping": { view: "environment" },
    "/development-security": { view: "dev-lifecycle" },
    "/data-security": { view: "data-lifecycle" },
    "/sapd-maturity-assessment": { view: "placeholder", placeholder: true },
    "/knowledge": { view: "maintenance", maintenancePage: "scopes" },
    "/knowledge/scopes": { view: "maintenance", maintenancePage: "scopes" },
    "/knowledge/technical-services": { view: "maintenance", maintenancePage: "services" },
    "/knowledge/technical": { view: "maintenance", maintenancePage: "modules" },
    "/knowledge/technical-modules": { view: "maintenance", maintenancePage: "modules", canonicalRoute: "/knowledge/technical" },
    "/knowledge/technical-measures": { view: "maintenance", maintenancePage: "measures", canonicalRoute: "/knowledge/technical" },
    "/knowledge/management-workflows": { view: "maintenance", maintenancePage: "security-works" },
    "/knowledge/work-items": { view: "maintenance", maintenancePage: "security-works", canonicalRoute: "/knowledge/management-workflows" },
    "/knowledge/processes": { view: "maintenance", maintenancePage: "processes", canonicalRoute: "/knowledge/management-workflows" },
    "/knowledge/application-systems": { view: "maintenance", maintenancePage: "application-systems" },
    "/knowledge/functions": { view: "maintenance", maintenancePage: "work-functions" },
    "/knowledge/gbt-42446": { view: "maintenance", maintenancePage: "references", referenceTab: "gbt", canonicalRoute: "/knowledge/functions" },
    "/knowledge/role-references": { view: "maintenance", maintenancePage: "references", referenceTab: "gartner", canonicalRoute: "/knowledge/functions" },
    "/knowledge/hype-cycle": { view: "placeholder", placeholder: true },
    "/knowledge/others": { view: "placeholder", placeholder: true },
    "/standards": { view: "maintenance", maintenancePage: "standards", standardFramework: "mlps-level-3" },
    "/standards/mlps-level-3": { view: "maintenance", maintenancePage: "standards", standardFramework: "mlps-level-3" },
    "/standards/nist-csf-2": { view: "maintenance", maintenancePage: "standards", standardFramework: "nist-csf-2" },
    "/standards/iso-27001-2022": { view: "maintenance", maintenancePage: "standards", standardFramework: "iso-27001-2022" },
    "/standards/dsp-level-2": { view: "maintenance", maintenancePage: "standards", standardFramework: "dsp-level-2" },
    "/standards/cis-csc-v8": { view: "maintenance", maintenancePage: "standards", standardFramework: "cis-csc-v8" },
    "/standards/crf": { view: "maintenance", maintenancePage: "standards", standardFramework: "crf" },
    "/standards/nist-800-53-rev5": { view: "maintenance", maintenancePage: "standards", standardFramework: "nist-800-53-rev5" },
    "/standards/others": { view: "placeholder", placeholder: true },
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
    services: "/knowledge/technical-services",
    modules: "/knowledge/technical",
    measures: "/knowledge/technical",
    "security-works": "/knowledge/management-workflows",
    processes: "/knowledge/management-workflows",
    "application-systems": "/knowledge/application-systems",
    "work-functions": "/knowledge/functions",
    "lcap-references": "/development-security",
    references: "/knowledge/functions",
  };

  const CONTENT_ROUTES = {
    html: "/guides",
    drawio: "/guides/others",
    ppt: "/guides/others",
  };

  const PAGE_DESCRIPTIONS = {
    "/": "查看当前已导入安全能力、信息化环境、生命周期和知识维护数据的关系覆盖状态。",
    "/guides": "承载安全架构、数据安全、管控模式和成熟度模型等方法论说明。",
    "/guides/data-security-design": "以本地幻灯片形式浏览数据安全设计方法，后续可扩展为数据安全设计指南目录。",
    "/capability-mapping": "从安全能力和关注点出发，核对技术视角、管理视角和标准 / 框架映射。",
    "/environment-mapping": "从信息化环境和对象出发，核对对象、作用域、服务、模块、措施和能力关联。",
    "/development-security": "以 LC-AP安全开发生命周期阶段和活动为主语，承载受控专项关系投影。",
    "/data-security": "以 LC-DT 数据生命周期过程和场景为主语，承载数据安全服务、模块和措施的受控专项关系投影。",
    "/sapd-maturity-assessment": "成熟度评估已纳入菜单规划，评分填报和结果生成将在独立模块中实现。",
    "/knowledge": "集中维护作用域、技术服务、技术模块、技术措施、安全工作、流程、职能和岗位参考等知识对象。",
    "/knowledge/technical-services": "安全技术服务清单用于核对服务编号、定义补充状态、归属安全能力/关注点和模块关联关系。",
    "/knowledge/technical": "安全系统（为解决某一场景 / 领域的安全问题，由多个安全模块组成、协同运行的实体）；安全技术模块（实现一个或多个安全能力的安全技术逻辑实体，可以独立部署运行，通常代表一类安全产品）。",
    "/knowledge/management-workflows": "用页签集中维护安全工作清单和安全职能流程清单。",
    "/knowledge/application-systems": "来自 LC-AP 应用安全开发生命周期元素目录，按应用系统、定义和应用组件归纳展开。",
    "/knowledge/functions": "用页签集中维护安全工作职能清单和岗位 / 职能参考目录。",
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
    const target = ROUTE_TARGETS[normalized];
    return { ...target, route: target.canonicalRoute || normalized };
  }

  function routeForView({ view, activeMaintenancePage, activeReferenceTab, activeContentPage, activeStandardFramework } = {}) {
    if (view === "maintenance" && activeMaintenancePage === "standards") return `/standards/${activeStandardFramework || "mlps-level-3"}`;
    if (view === "maintenance") return MAINTENANCE_ROUTES[activeMaintenancePage] || VIEW_ROUTES.maintenance;
    if (view === "content") return CONTENT_ROUTES[activeContentPage] || VIEW_ROUTES.content;
    return VIEW_ROUTES[view] || "/";
  }

  function childRouteActive(parent, route) {
    return components.utils.list(parent.children).some((child) => child.route === route || childRouteActive(child, route));
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
                  <button class="submodule-tab ${child.route === activeRoute || childRouteActive(child, activeRoute) ? "active" : ""}" type="button" data-app-route="${escapeHtml(child.route)}" data-view="${escapeHtml(getRouteTarget(child.route).view)}">
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
    const pageTitle = activeRoute === "/development-security" ? "LC-AP安全开发生命周期" : activeRoute === "/data-security" ? "LC-DT数据生命周期安全" : item.label;
    const rootRoute = parentForRoute(activeRoute)?.route || activeRoute;
    const description = PAGE_DESCRIPTIONS[activeRoute] || PAGE_DESCRIPTIONS[rootRoute] || "当前页面通过 Manifest 导航进入，业务内容由现有前端 ViewModel 渲染。";
    const target = getRouteTarget(activeRoute);
    const isSourceTablePage = target.view === "maintenance";
    const isStandardFrameworkPage = target.view === "maintenance" && target.maintenancePage === "standards";
    const isGuidePage = activeRoute.startsWith("/guides/");
    const isPlaceholderPage = target.placeholder || target.view === "placeholder";
    return `
      <section class="app-page-header" id="appPageHeader">
        <div class="page-header-copy">
          ${renderBreadcrumb(activeRoute)}
          <div class="page-title-row">
            <h1>${escapeHtml(pageTitle)}</h1>
            ${isSourceTablePage ? '<span id="pageHeaderCount" class="page-title-summary" hidden></span>' : ""}
            ${isSourceTablePage ? "" : `<span class="shell-tag muted">${escapeHtml(TYPE_LABELS[item.type] || item.type)}</span>`}
          </div>
          <p>${escapeHtml(description)}</p>
        </div>
        ${
          isSourceTablePage
            ? `<label class="page-header-search" for="sourceSearchInput">
                <span class="search-icon" aria-hidden="true">⌕</span>
                <input id="sourceSearchInput" type="search" placeholder="搜索名称、编码、分组或关系" autocomplete="off" />
              </label>`
            : isGuidePage || isPlaceholderPage
              ? ""
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
      ["placeholderWorkspace", "two"],
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
      capability_focus: display.label?.("capability_focus", "能力关注点") || "能力关注点",
      service: display.label?.("security_technical_service", "安全技术服务") || "安全技术服务",
      scope: display.label?.("scope_type", "作用域") || "作用域",
      process: "安全流程",
      module: display.label?.("security_technology_module", "安全技术模块") || "安全技术模块",
      measure: display.label?.("security_technical_measure", "安全技术措施") || "安全技术措施",
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
            <input id="capabilitySearchInput" type="search" placeholder="搜索能力、作用域、安全技术服务、流程或安全技术模块/措施" />
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
      { label: display.label?.("capability_focus", "能力关注点") || "能力关注点", value: summary.rowCount ?? 0 },
      { label: "技术映射", value: summary.technicalRowCount ?? 0 },
      { label: "管理映射", value: summary.managementRowCount ?? 0 },
      { label: display.state?.("no_applicable_service") || "无适用服务", value: summary.noServiceCount ?? 0 },
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
    getRouteInfo(route) {
      const normalized = ROUTE_TARGETS[route] ? route : "/";
      const item = findNavItem(normalized);
      const rootRoute = parentForRoute(normalized)?.route || normalized;
      return {
        item,
        parent: parentForRoute(normalized),
        description: PAGE_DESCRIPTIONS[normalized] || PAGE_DESCRIPTIONS[rootRoute] || "该页面已进入导航规划，等待独立设计和数据契约确认。",
        target: getRouteTarget(normalized),
      };
    },
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
