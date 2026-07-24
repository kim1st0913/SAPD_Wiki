(function () {
  const components = (window.sapdComponents = window.sapdComponents || {});
  const display = window.sapdDisplay || {};

  const DIRECTORY_PANE_METRICS = Object.freeze({
    defaultWidth: 304,
    minWidth: 240,
    maxWidth: 520,
    handleWidth: 6,
  });

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
        id: "workbench",
        label: "工作台",
        route: "/workbench",
        type: "workbench-module",
        children: [
          {
            id: "workbench-maturity",
            label: "成熟度评估",
            route: "/workbench/maturity",
            type: "workbench-page",
            children: [
              { id: "workbench-maturity-project", label: "网络安全成熟度评估", route: "/workbench/maturity/demo-project-001", type: "workbench-page", children: [] },
            ],
          },
          { id: "workbench-issues", label: "ISSUE清单", route: "/workbench/annotations", type: "workbench-page", children: [] },
        ],
      },
      {
        id: "guides",
        label: "安全指南",
        route: "/guides",
        type: "document-hub",
        children: [
          { id: "security-architecture-design", label: "安全技术架构设计方法", route: "/guides/security-architecture-design", type: "document-page", children: [] },
          { id: "security-architecture-modeling-language", label: "安全架构建模语言", route: "/guides/security-architecture-modeling-language", type: "document-page", children: [] },
          { id: "data-security-design", label: "数据安全设计方法", route: "/guides/data-security-design", type: "document-page", children: [] },
          { id: "light-planning", label: "轻规划", route: "/guides/light-planning", type: "document-page", children: [] },
          { id: "security-governance-model", label: "安全管控模式设计方法", route: "/guides/security-governance-model", type: "placeholder-page", children: [] },
          { id: "maturity-model-usage", label: "成熟度模型使用指南", route: "/guides/maturity-model-usage", type: "document-page", children: [] },
          { id: "other-guides", label: "其他指南", route: "/guides/others", type: "placeholder-page", children: [] },
        ],
      },
      { id: "capability-mapping", label: "安全能力映射", route: "/capability-mapping", type: "capability-mapping-workbench", children: [] },
      { id: "environment-mapping", label: "信息化环境安全能力映射", route: "/environment-mapping", type: "environment-mapping-workbench", children: [] },
      { id: "development-security", label: "LC-AP安全开发生命周期", route: "/development-security", type: "domain-module", children: [] },
      { id: "data-security", label: "LC-DT数据生命周期安全", route: "/data-security", type: "domain-module", children: [] },
      {
        id: "knowledge",
        label: "知识库字典",
        route: "/knowledge",
        type: "knowledge-directory",
        children: [
          { id: "security-capabilities", label: "安全能力清单", route: "/knowledge/capabilities", type: "knowledge-directory", children: [] },
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
            children: [],
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
          { id: "mlps-level-3", label: "GB/T 22239-2019 网络安全等级保护基本要求 第三级", route: "/standards/mlps-level-3", type: "standard-framework-page", children: [] },
          { id: "nist-csf-2", label: "NIST Cybersecurity Framework 2.0", route: "/standards/nist-csf-2", type: "standard-framework-page", children: [] },
          { id: "iso-27001-2022", label: "ISO/IEC 27001:2022", route: "/standards/iso-27001-2022", type: "standard-framework-page", children: [] },
          { id: "dsp-level-2", label: "DSP Secure Controls Framework (SCF) - 2026", route: "/standards/dsp-level-2", type: "standard-framework-page", children: [] },
          { id: "cis-csc-v8", label: "CIS Controls v8.1.2", route: "/standards/cis-csc-v8", type: "standard-framework-page", children: [] },
          { id: "crf", label: "CRF Safeguards Core Edition v2026", route: "/standards/crf", type: "standard-framework-page", children: [] },
          { id: "nist-800-53-rev5", label: "NIST SP 800-53 Rev.5", route: "/standards/nist-800-53-rev5", type: "standard-framework-page", children: [] },
          { id: "workforce-reference-standards", label: "人力资源 Workforce 参考标准", route: "/standards/workforce-reference", type: "standard-framework-page", children: [] },
          { id: "other-standards", label: "其他标准 / 框架", route: "/standards/others", type: "placeholder-page", children: [] },
        ],
      },
    ],
  };

  const SETTINGS_UTILITY_ITEM = {
    id: "system-settings",
    label: "系统设置",
    route: "/settings",
    type: "system-settings",
    children: [
      { id: "system-settings-main", label: "系统设置", route: "/settings/system", type: "system-settings", children: [] },
      { id: "system-settings-ai-integration", label: "AI 功能集成", route: "/settings/ai-integration", type: "system-settings", children: [] },
    ],
  };

  const SIDEBAR_STATE_KEY = "sapd.appShell.sidebarCollapsed";
  const SHELL_AUXILIARY_EVENT = "sapd:shell-auxiliary-dismiss";
  const auxiliaryReturnFocus = new WeakMap();
  let lastMcpStatusSnapshot = null;
  let lastMcpStatusOptions = {};

  const ROUTE_TARGETS = {
    "/": { view: "overview" },
    "/search": { view: "search" },
    "/settings": { view: "settings", settingsPage: "system", canonicalRoute: "/settings/system" },
    "/settings/system": { view: "settings", settingsPage: "system" },
    "/settings/basic": { view: "settings", settingsPage: "system", canonicalRoute: "/settings/system" },
    "/settings/ai-integration": { view: "settings", settingsPage: "ai-integration" },
    "/workbench": { view: "workbench" },
    "/workbench/annotations": { view: "workbench" },
    "/workbench/maturity": { view: "workbench" },
    "/workbench/maturity/demo-project-001": { view: "workbench" },
    "/guides": { view: "content", contentPage: "html" },
    "/guides/security-architecture-design": { view: "content", contentPage: "html" },
    "/guides/security-architecture-modeling-language": { view: "content", contentPage: "html" },
    "/guides/data-security-design": { view: "content", contentPage: "html" },
    "/guides/light-planning": { view: "content", contentPage: "html" },
    "/guides/security-governance-model": { view: "placeholder", placeholder: true },
    "/guides/maturity-model-usage": { view: "content", contentPage: "html" },
    "/guides/others": { view: "placeholder", placeholder: true },
    "/capability-mapping": { view: "capabilities" },
    "/environment-mapping": { view: "environment" },
    "/development-security": { view: "dev-lifecycle" },
    "/data-security": { view: "data-lifecycle" },
    "/sapd-maturity-assessment": { view: "workbench", canonicalRoute: "/workbench/maturity" },
    "/knowledge": { view: "maintenance", maintenancePage: "scopes" },
    "/knowledge/capabilities": { view: "maintenance", maintenancePage: "capability-directory" },
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
    "/knowledge/gbt-42446": { view: "maintenance", maintenancePage: "standards", standardFramework: "workforce-reference-standards", standardTableId: "gbt-42446-task-definitions", canonicalRoute: "/standards/workforce-reference" },
    "/knowledge/role-references": { view: "maintenance", maintenancePage: "standards", standardFramework: "workforce-reference-standards", standardTableId: "gartner-work-roles", canonicalRoute: "/standards/workforce-reference" },
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
    "/standards/workforce-reference": { view: "maintenance", maintenancePage: "standards", standardFramework: "workforce-reference-standards" },
    "/standards/others": { view: "placeholder", placeholder: true },
  };

  const VIEW_ROUTES = {
    overview: "/",
    search: "/search",
    settings: "/settings/system",
    capabilities: "/capability-mapping",
    environment: "/environment-mapping",
    "dev-lifecycle": "/development-security",
    "data-lifecycle": "/data-security",
    workbench: "/workbench",
    content: "/guides",
    maintenance: "/knowledge/scopes",
  };

  const MAINTENANCE_ROUTES = {
    "capability-directory": "/knowledge/capabilities",
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

  function normalizeRoute(route) {
    const value = text(route).trim();
    if (!value) return "/";
    const withoutHash = value.startsWith("#") ? value.slice(1) : value;
    const withoutQuery = withoutHash.split("?")[0];
    const normalized = withoutQuery.startsWith("/") ? withoutQuery : `/${withoutQuery}`;
    return normalized.replace(/\/+$/, "") || "/";
  }

  const PAGE_DESCRIPTIONS = {
    "/": "查看当前已导入安全能力、信息化环境、生命周期和知识维护数据的关系覆盖状态。",
    "/search": "跨安全能力、信息化环境、生命周期、知识库和标准 / 框架检索知识对象，并进入目标页面定位。",
    "/settings/system": "管理当前版本、App 保存位置、文件上传路径和文件下载路径。",
    "/settings/ai-integration": "管理本地 MCP 服务、连接地址和客户端授权。",
    "/workbench": "集中进入 Issue 处理和成熟度评估工作流。",
    "/workbench/annotations": "以 Review Queue 方式查看、筛选、编辑、批量处理和导出所有 Issue。",
    "/workbench/maturity": "管理成熟度评估项目、模板、评分、结果和报告快照。",
    "/workbench/maturity/demo-project-001": "管理成熟度评估项目、模板、评分、结果和报告快照。",
    "/guides": "承载安全架构、数据安全、管控模式和成熟度模型等方法论说明。",
    "/guides/security-architecture-modeling-language": "安全架构设计元素图例，安全架构中的各种元素都需要映射到 ArchiMate 的元素。",
    "/guides/data-security-design": "以本地幻灯片形式浏览数据安全设计方法，后续可扩展为数据安全设计指南目录。",
    "/guides/light-planning": "以本地幻灯片形式浏览轻规划设计报告模版，后续可扩展为轻规划设计指南目录。",
    "/guides/maturity-model-usage": "说明成熟度模型的方法论、等级含义、评估工具、四要素评分、证据采集和报告使用。",
    "/capability-mapping": "从安全能力和关注点出发，核对技术视角、管理视角和标准 / 框架映射。",
    "/environment-mapping": "从信息化环境和对象出发，核对对象、作用域、服务、模块、措施和能力关联。",
    "/development-security": "以 LC-AP安全开发生命周期阶段和活动为主语，承载受控专项关系投影。",
    "/data-security": "以 LC-DT 数据生命周期过程和场景为主语，承载数据安全服务、模块和措施的受控专项关系投影。",
    "/knowledge": "集中维护作用域、技术服务、技术模块、技术措施、安全工作、流程和安全职能等知识对象。",
    "/knowledge/capabilities": "安全能力清单按 L0 能力分类、L1 能力域、L2 安全能力逐层归纳展开，并展示安全关注点表格。",
    "/knowledge/technical-services": "安全技术服务清单用于核对服务编号、定义补充状态、归属安全能力/关注点和模块关联关系。",
    "/knowledge/technical": "安全系统（为解决某一场景 / 领域的安全问题，由多个安全模块组成、协同运行的实体）；安全技术模块（实现一个或多个安全能力的安全技术逻辑实体，可以独立部署运行，通常代表一类安全产品）。",
    "/knowledge/management-workflows": "用页签集中维护安全工作清单和安全职能流程清单。",
    "/knowledge/application-systems": "来自 LC-AP 应用安全开发生命周期元素目录，按应用系统、定义和应用组件归纳展开。",
    "/knowledge/functions": "集中维护安全工作职能清单；GB/T 与 Gartner 人力资源参考已迁移到安全标准 / 框架模块。",
    "/standards": "集中查看标准 / 框架参考及其与能力、措施和管理工作的映射关系。",
    "/standards/workforce-reference": "集中查看 GB/T 42446-2023 工作任务定义、工作类别分类和 Gartner 工作岗位参考。",
  };

  const PAGE_HEADER_OVERRIDES = {
    "/": {
      eyebrow: "SAPD WIKI",
      title: "工作台与知识库概览",
      description: "继续本地工作，并按业务粒度查看能力、环境、生命周期、技术服务、标准、字典与指南内容。",
      hideTypeLabel: true,
    },
    "/settings/system": {
      title: "系统设置",
      description: PAGE_DESCRIPTIONS["/settings/system"],
      hideTypeLabel: true,
    },
    "/settings/ai-integration": {
      title: "系统设置",
      description: PAGE_DESCRIPTIONS["/settings/ai-integration"],
      hideTypeLabel: true,
    },
  };

  const GUIDE_DOWNLOADS = {
    "/guides/maturity-model-usage": {
      href: "./assets/guides/maturity-model-usage.html",
      filename: "SAPD-成熟度模型使用指南-v1.3.html",
      label: "下载指南",
    },
  };

  const TYPE_LABELS = {
    "application-shell": "应用壳",
    "search-page": "检索页",
    "system-settings": "系统设置",
    "workbench-module": "工作台",
    "workbench-page": "工作台页面",
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
    workbench: "▦",
    guides: "□",
    "capability-mapping": "▣",
    "environment-mapping": "◫",
    "development-security": "◇",
    "data-security": "◎",
    knowledge: "☷",
    standards: "▤",
  };

  function allNavItems(items = NAV_MANIFEST.navigation, parent = null) {
    return components.utils.list(items).flatMap((item) => [{ ...item, parent }, ...allNavItems(item.children, item)]);
  }

  function utilityItems() {
    return [{ ...SETTINGS_UTILITY_ITEM, parent: null }, ...allNavItems(SETTINGS_UTILITY_ITEM.children, SETTINGS_UTILITY_ITEM)];
  }

  function manifestRouteFor(route) {
    const normalized = normalizeRoute(route);
    if (normalized.startsWith("/workbench/maturity/")) return "/workbench/maturity";
    return normalized;
  }

  function findNavItem(route) {
    const manifestRoute = manifestRouteFor(route);
    return utilityItems().find((item) => item.route === manifestRoute)
      || allNavItems().find((item) => item.route === manifestRoute)
      || NAV_MANIFEST.navigation[0];
  }

  function parentForRoute(route) {
    const manifestRoute = manifestRouteFor(route);
    if (components.utils.list(SETTINGS_UTILITY_ITEM.children).some((child) => child.route === manifestRoute)) return SETTINGS_UTILITY_ITEM;
    return allNavItems().find((item) => components.utils.list(item.children).some((child) => child.route === manifestRoute)) || null;
  }

  function backRouteFor(route) {
    const normalized = normalizeRoute(route);
    return normalized === "/" ? "" : "/";
  }

  function getRouteTarget(route) {
    const normalized = normalizeRoute(route);
    if (ROUTE_TARGETS[normalized]) {
      const target = ROUTE_TARGETS[normalized];
      return { ...target, route: target.canonicalRoute || normalized };
    }

    if (normalized.startsWith("/search")) return { view: "search", route: "/search", canonicalRoute: "/search" };
    if (normalized.startsWith("/settings")) {
      const route = normalized === "/settings" || normalized === "/settings/basic" ? "/settings/system" : normalized;
      return { view: "settings", route, canonicalRoute: route };
    }

    if (normalized === "/workbench") return { view: "workbench", route: "/workbench", canonicalRoute: "/workbench" };

    if (normalized.startsWith("/workbench/annotations")) {
      return { view: "workbench", route: "/workbench/annotations", canonicalRoute: "/workbench/annotations" };
    }

    if (normalized.startsWith("/workbench/maturity")) {
      return { view: "workbench", route: normalized, canonicalRoute: normalized };
    }

    if (normalized.startsWith("/workbench")) return { view: "workbench", route: "/workbench", canonicalRoute: "/workbench" };

    const target = ROUTE_TARGETS[normalized] || { view: "overview", route: "/" };
    return { ...target, route: target.canonicalRoute || target.route || "/" };
  }

  function routeForView({ view, activeMaintenancePage, activeReferenceTab, activeContentPage, activeStandardFramework } = {}) {
    if (view === "maintenance" && activeMaintenancePage === "standards") return `/standards/${activeStandardFramework || "mlps-level-3"}`;
    if (view === "search") return VIEW_ROUTES.search;
    if (view === "maintenance") return MAINTENANCE_ROUTES[activeMaintenancePage] || VIEW_ROUTES.maintenance;
    if (view === "content") return CONTENT_ROUTES[activeContentPage] || VIEW_ROUTES.content;
    return VIEW_ROUTES[view] || "/";
  }

  function childRouteActive(parent, route) {
    return components.utils.list(parent.children).some((child) => child.route === route || childRouteActive(child, route));
  }

  function activeNavigationLabel(item, activeRoute) {
    const activeChild = components.utils.list(item.children).find((child) => child.route === activeRoute || childRouteActive(child, activeRoute));
    if (!activeChild) return item.label;
    return activeNavigationLabel(activeChild, activeRoute);
  }

  function renderGlobalSearch() {
    return `
      <div class="global-search" aria-label="全局搜索">
        <span class="search-icon" aria-hidden="true">⌕</span>
        <input id="searchInput" type="search" placeholder="全局搜索知识、能力、标准、指南" autocomplete="off" data-search-history-kind="global" />
        <button id="globalSearchActionButton" class="global-search-shortcut" type="button" title="聚焦全局搜索 / 打开搜索结果" aria-label="聚焦全局搜索或打开搜索结果">⌘K</button>
      </div>
    `;
  }

  function renderTopBar() {
    return `
      ${renderGlobalSearch()}
      <span id="appLiveStatus" class="sapd-visually-hidden" role="status" aria-live="polite" aria-atomic="true"></span>
      <div id="localModeStatus" class="topbar-status" aria-label="本地运行状态"></div>
      <div class="topbar-actions" aria-label="全局操作">
        <span id="licenseStatusBadge" class="topbar-license-status" aria-live="polite">${renderLocalModeStatus()}</span>
        <button class="topbar-settings-button" type="button" title="系统设置" aria-label="系统设置" data-app-route="/settings/system">⚙</button>
        ${renderMcpStatusMonitor()}
      </div>
    `;
  }

  function readSidebarCollapsed() {
    try {
      return window.localStorage?.getItem(SIDEBAR_STATE_KEY) === "true";
    } catch (error) {
      return false;
    }
  }

  function writeSidebarCollapsed(collapsed) {
    try {
      window.localStorage?.setItem(SIDEBAR_STATE_KEY, collapsed ? "true" : "false");
    } catch (error) {
      // Local storage can be disabled in restricted browser modes.
    }
  }

  function applySidebarState(collapsed, { persist = true } = {}) {
    const app = document.getElementById("app");
    const sidebar = document.querySelector(".app-sidebar");
    const toggle = document.getElementById("globalSidebarToggle");
    app?.classList.toggle("sidebar-collapsed", collapsed);
    sidebar?.setAttribute("data-collapsed", collapsed ? "true" : "false");
    if (toggle) {
      toggle.setAttribute("aria-expanded", collapsed ? "false" : "true");
      toggle.setAttribute("aria-label", collapsed ? "展开全局导航" : "收起全局导航");
      toggle.setAttribute("title", collapsed ? "展开全局导航" : "收起全局导航");
    }
    document.querySelectorAll(".secondary-navigation").forEach((nav) => {
      nav.setAttribute("aria-hidden", collapsed ? "true" : "false");
      nav.querySelectorAll("button").forEach((button) => {
        if (collapsed) button.setAttribute("tabindex", "-1");
        else button.removeAttribute("tabindex");
      });
    });
    if (persist) writeSidebarCollapsed(collapsed);
  }

  function renderSidebarToggle(collapsed = false) {
    return `
      <button
        id="globalSidebarToggle"
        class="sidebar-collapse-toggle"
        type="button"
        aria-label="${collapsed ? "展开全局导航" : "收起全局导航"}"
        aria-expanded="${collapsed ? "false" : "true"}"
        title="${collapsed ? "展开全局导航" : "收起全局导航"}"
      >
        <span class="sidebar-collapse-glyph" aria-hidden="true"></span>
      </button>
    `;
  }

  function renderNavigationItem(item, activeRoute) {
    const children = components.utils.list(item.children);
    const active = item.route === activeRoute || childRouteActive(item, activeRoute);
    const symbol = NAV_SYMBOLS[item.id] || "•";
    if (children.length) {
      const activeLabel = activeNavigationLabel(item, activeRoute);
      return `
        <details class="navigation-group" ${active ? "open" : ""} data-nav-id="${escapeHtml(item.id)}">
          <summary class="module-tab navigation-parent ${active ? "active" : ""}" title="${escapeHtml(active ? activeLabel : item.label)}">
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
    const collapsed = readSidebarCollapsed();
    return `
      <div class="brand shell-sidebar-brand">
        <div class="brand-mark">S</div>
        <div>
          <strong class="brand-title">SAPD Wiki</strong>
          <p>咨询规划工作台</p>
        </div>
        ${renderSidebarToggle(collapsed)}
      </div>
      <nav class="module-tabs manifest-navigation" aria-label="SAPD Wiki 全局导航">
        ${NAV_MANIFEST.navigation.map((item) => renderNavigationItem(item, activeRoute)).join("")}
      </nav>
      <div class="sidebar-status">
        <span>开发维护</span>
        <strong>SAPD 架构组</strong>
      </div>
    `;
  }

  function bindSidebarControls() {
    const toggle = document.getElementById("globalSidebarToggle");
    toggle?.addEventListener("click", () => {
      const app = document.getElementById("app");
      const collapsed = !app?.classList.contains("sidebar-collapsed");
      applySidebarState(collapsed);
      if (!collapsed) revealCurrentNavigationAfterExpansion(app?.dataset.shellRoute || "/");
    });
    document.querySelectorAll(".navigation-group > .navigation-parent").forEach((summary) => {
      summary.addEventListener("click", (event) => {
        const app = document.getElementById("app");
        const collapsed = app?.classList.contains("sidebar-collapsed");
        if (!collapsed) return;
        event.preventDefault();
        const group = summary.closest(".navigation-group");
        if (group) group.open = true;
        applySidebarState(false);
        revealCurrentNavigationAfterExpansion(app?.dataset.shellRoute || "/");
      });
    });
    document.querySelectorAll(".navigation-group").forEach((group) => {
      group.addEventListener("toggle", () => {
        if (!group.open) return;
        document.querySelectorAll(".navigation-group").forEach((candidate) => {
          if (candidate !== group) candidate.open = false;
        });
      });
    });
  }

  function syncNavigationGroups(activeRoute = "/", { scroll = true } = {}) {
    const manifestRoute = manifestRouteFor(activeRoute);
    let activeTarget = null;
    document.querySelectorAll(".navigation-group").forEach((group) => {
      const parent = NAV_MANIFEST.navigation.find((item) => item.id === group.dataset.navId);
      const active = parent ? parent.route === manifestRoute || childRouteActive(parent, manifestRoute) : false;
      group.classList.toggle("active", active);
      group.open = active;
      const summary = group.querySelector(":scope > summary");
      summary?.classList.toggle("active", active);
      summary?.setAttribute("aria-current", active && parent?.route === manifestRoute ? "page" : "false");
      if (active) activeTarget = group.querySelector(`[data-app-route="${CSS.escape(manifestRoute)}"]`) || summary;
    });
    activeTarget ||= document.querySelector(`[data-app-route="${CSS.escape(manifestRoute)}"]`);
    if (!scroll || !activeTarget) return;
    window.requestAnimationFrame(() => {
      activeTarget?.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "auto" });
      const navigation = activeTarget?.closest(".manifest-navigation");
      const targetRect = activeTarget?.getBoundingClientRect();
      const navigationRect = navigation?.getBoundingClientRect();
      const inset = 10;
      if (!navigation || !targetRect || !navigationRect) return;
      if (targetRect.top < navigationRect.top + inset) navigation.scrollTop -= navigationRect.top + inset - targetRect.top;
      else if (targetRect.bottom > navigationRect.bottom - inset) navigation.scrollTop += targetRect.bottom - (navigationRect.bottom - inset);
    });
  }

  function revealCurrentNavigationAfterExpansion(activeRoute = "/") {
    const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
    window.requestAnimationFrame(() => syncNavigationGroups(activeRoute));
    if (!reducedMotion) window.setTimeout(() => syncNavigationGroups(activeRoute), 440);
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

  function renderModelingLanguageHeaderTabs(activeTab = "overview") {
    const tabs = [
      { id: "overview", label: "ArchiMate® 3.2 - 企业架构建模标准" },
      { id: "elements", label: "SAPD 元素图例" },
    ];
    const normalizedActiveTab = tabs.some((tab) => tab.id === activeTab) ? activeTab : "overview";
    return `
      <div id="modelingLanguageHeaderTabs" class="modeling-language-title-tabs" aria-label="安全架构建模语言页签">
        <div class="maintenance-section-tabs modeling-language-tabs" role="tablist" aria-label="安全架构建模语言页签">
          ${tabs
            .map(
              (tab) => `
                <button class="maintenance-section-tab ${tab.id === normalizedActiveTab ? "active" : ""}" type="button" role="tab" aria-selected="${tab.id === normalizedActiveTab ? "true" : "false"}" data-modeling-language-tab="${escapeHtml(tab.id)}">
                  <span>${escapeHtml(tab.label)}</span>
                </button>
              `,
            )
            .join("")}
        </div>
      </div>
    `;
  }

  function renderEnvironmentHeaderTabs(activeTab = "topology") {
    const tabs = [
      { id: "topology", label: "信息化环境视图" },
      { id: "mapping", label: "信息化环境-安全技术" },
    ];
    const normalizedActiveTab = tabs.some((tab) => tab.id === activeTab) ? activeTab : "topology";
    return `
      <div id="environmentHeaderTabs" class="environment-title-tabs" aria-label="信息化环境页面视图">
        <div class="maintenance-section-tabs environment-page-tabs" role="tablist" aria-label="信息化环境页面视图">
          ${tabs
            .map(
              (tab) => `
                <button class="maintenance-section-tab ${tab.id === normalizedActiveTab ? "active" : ""}" type="button" role="tab" aria-selected="${tab.id === normalizedActiveTab ? "true" : "false"}" data-environment-tab="${escapeHtml(tab.id)}">
                  <span>${escapeHtml(tab.label)}</span>
                </button>
              `,
            )
            .join("")}
        </div>
      </div>
    `;
  }

  function renderGuideHeaderActions(activeRoute = "/") {
    const download = GUIDE_DOWNLOADS[normalizeRoute(activeRoute)];
    if (!download) return "";
    return `
      <div class="page-header-actions guide-header-actions" aria-label="指南操作">
        <a
          class="maturity-guide-download"
          href="${escapeHtml(download.href)}"
          download="${escapeHtml(download.filename)}"
          data-guide-download="${escapeHtml(normalizeRoute(activeRoute))}"
          aria-label="下载 ${escapeHtml(download.filename)}"
        >${escapeHtml(download.label)}</a>
      </div>
    `;
  }

  function renderPageHeader({ activeRoute = "/", activeModelingLanguageTab = "overview", activeEnvironmentTab = "topology" } = {}) {
    const item = findNavItem(activeRoute);
    const manifestRoute = manifestRouteFor(activeRoute);
    const headerOverride = PAGE_HEADER_OVERRIDES[activeRoute] || PAGE_HEADER_OVERRIDES[manifestRoute] || null;
    const pageTitle = headerOverride?.title || (activeRoute === "/development-security"
        ? "LC-AP安全开发生命周期"
        : activeRoute === "/data-security"
          ? "LC-DT数据生命周期安全"
          : activeRoute === "/search"
            ? "全局搜索"
            : item.label);
    const rootRoute = parentForRoute(activeRoute)?.route || manifestRoute;
    const description = headerOverride?.description || PAGE_DESCRIPTIONS[activeRoute] || PAGE_DESCRIPTIONS[manifestRoute] || PAGE_DESCRIPTIONS[rootRoute] || "当前页面通过 Manifest 导航进入，业务内容由现有前端 ViewModel 渲染。";
    const target = getRouteTarget(activeRoute);
    const isSourceTablePage = target.view === "maintenance";
    const isGuidePage = activeRoute.startsWith("/guides/");
    const isPlaceholderPage = target.placeholder || target.view === "placeholder";
    const isWorkbenchIssuePage = activeRoute === "/workbench/annotations";
    const isMaturityPage = activeRoute === "/workbench/maturity" || activeRoute.startsWith("/workbench/maturity/");
    const backRoute = backRouteFor(activeRoute);
    const typeLabel = activeRoute === "/search" ? TYPE_LABELS["search-page"] : TYPE_LABELS[item.type] || item.type;
    return `
      <section class="app-page-header" id="appPageHeader" data-shell-title-owner="true" data-shell-route="${escapeHtml(manifestRoute)}" aria-labelledby="appPageTitle">
        <div class="page-header-copy">
          ${headerOverride?.eyebrow ? `<div class="page-header-eyebrow">${escapeHtml(headerOverride.eyebrow)}</div>` : renderBreadcrumb(activeRoute)}
          <div class="page-title-row">
            ${backRoute ? `<button class="shell-back-button maturity-v1-back maturity-v39-shell-back" type="button" data-app-route="${escapeHtml(backRoute)}" aria-label="返回上一层，默认返回全局导航" title="返回上一层">‹</button>` : ""}
            <h1 id="appPageTitle">${escapeHtml(pageTitle)}</h1>
            ${isWorkbenchIssuePage ? '<span id="workbenchIssueHeaderStats" class="workbench-review-stats is-compact page-title-issue-stats" aria-label="Issue 状态筛选"></span>' : ""}
            ${isSourceTablePage ? '<span id="pageHeaderCount" class="page-title-summary" hidden></span>' : ""}
            ${isSourceTablePage || isWorkbenchIssuePage || headerOverride?.hideTypeLabel ? "" : `<span class="shell-tag muted">${escapeHtml(typeLabel)}</span>`}
            ${activeRoute === "/guides/security-architecture-modeling-language" ? renderModelingLanguageHeaderTabs(activeModelingLanguageTab) : ""}
            ${activeRoute === "/environment-mapping" ? renderEnvironmentHeaderTabs(activeEnvironmentTab) : ""}
          </div>
          ${description ? `<p>${escapeHtml(description)}</p>` : ""}
        </div>
        ${
          isMaturityPage
            ? `<div id="maturityShellHeaderActions" class="maturity-v3-header-slot" aria-label="成熟度评估状态与操作"></div>`
            : isWorkbenchIssuePage
              ? `<div id="workbenchIssueHeaderActions" class="workbench-issue-page-actions" aria-label="Issue 导出操作"></div>`
            : isGuidePage
              ? renderGuideHeaderActions(activeRoute)
              : isPlaceholderPage
                ? ""
              : ""
        }
      </section>
    `;
  }

  function ensurePageHeader({ activeRoute = "/", activeModelingLanguageTab = "overview", activeEnvironmentTab = "topology" } = {}) {
    const main = document.querySelector(".app-main");
    const stage = document.querySelector(".workspace-stage");
    if (!main || !stage) return;
    let header = document.getElementById("appPageHeader");
    if (!header) {
      stage.insertAdjacentHTML("beforebegin", renderPageHeader({ activeRoute, activeModelingLanguageTab, activeEnvironmentTab }));
      return;
    }
    header.outerHTML = renderPageHeader({ activeRoute, activeModelingLanguageTab, activeEnvironmentTab });
  }

  function applyWorkbenchContainers() {
    [
      ["overviewWorkspace", "three"],
      ["searchWorkspace", "one"],
      ["settingsWorkspace", "one"],
      ["workbenchWorkspace", "one"],
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

    const configureAuxiliary = (selector, { kind, mode, dismissLabel = "关闭详情" }) => {
      const panel = document.querySelector(selector);
      if (!panel) return;
      panel.dataset.shellAuxiliary = kind;
      panel.dataset.shellAuxiliaryMode = mode;
      if (kind === "directory") panel.classList.add("shell-directory-pane");
      if (mode !== "overlay") return;
      panel.classList.add("is-shell-closed");
      panel.dataset.shellOpen = "false";
      panel.setAttribute("aria-hidden", "true");
      const head = panel.querySelector(":scope > .pane-head");
      if (!head || head.querySelector("[data-shell-auxiliary-dismiss]")) return;
      const button = document.createElement("button");
      button.className = "shell-auxiliary-dismiss";
      button.type = "button";
      button.dataset.shellAuxiliaryDismiss = panel.id || kind;
      button.setAttribute("aria-label", dismissLabel);
      button.textContent = "关闭";
      button.addEventListener("click", () => {
        setAuxiliaryLayerState(panel.id || kind, false, { restoreFocus: true });
        document.dispatchEvent(new CustomEvent(SHELL_AUXILIARY_EVENT, { detail: { id: panel.id || kind } }));
      });
      head.append(button);
    };

    const workspaceLayouts = [
      ["overviewWorkspace", "main-resident-auxiliary"],
      ["settingsWorkspace", "main-only"],
      ["workbenchWorkspace", "main-only"],
      ["capabilityWorkspace", "resident-directory-main"],
      ["environmentWorkspace", "main-only"],
      ["devLifecycleWorkspace", "main-resident-inspector"],
      ["dataLifecycleWorkspace", "main-resident-inspector"],
      ["maintenanceWorkspace", "directory-main-overlay"],
      ["contentWorkspace", "directory-main-overlay"],
    ];
    workspaceLayouts.forEach(([id, layout]) => {
      const workspace = document.getElementById(id);
      if (workspace) workspace.dataset.shellLayout = layout;
    });
    configureAuxiliary(".overview-issue-pane", { kind: "inspector", mode: "resident" });
    configureAuxiliary(".capability-tree-pane", { kind: "directory", mode: "resident" });
    configureAuxiliary("#devLifecycleWorkspace .lifecycle-detail-pane", { kind: "inspector", mode: "resident" });
    configureAuxiliary("#dataLifecycleWorkspace .lifecycle-detail-pane", { kind: "inspector", mode: "resident" });
    configureAuxiliary("#sourceNavPane", { kind: "directory", mode: "resident" });
    configureAuxiliary("#sourceDetailPane", { kind: "inspector", mode: "overlay", dismissLabel: "关闭实体关系详情" });
    configureAuxiliary("#contentWorkspace .content-nav-pane", { kind: "directory", mode: "resident" });
    configureAuxiliary("#contentWorkspace .content-detail-pane", { kind: "inspector", mode: "overlay", dismissLabel: "关闭内容详情" });
  }

  function setAuxiliaryLayerState(id, open, { restoreFocus = false } = {}) {
    const panel = document.getElementById(id) || document.querySelector(`[data-shell-auxiliary="${CSS.escape(text(id))}"]`);
    if (!panel || panel.dataset.shellAuxiliaryMode !== "overlay") return false;
    const wasOpen = panel.dataset.shellOpen === "true";
    if (open && !wasOpen && document.activeElement instanceof HTMLElement && !panel.contains(document.activeElement)) {
      auxiliaryReturnFocus.set(panel, document.activeElement);
    }
    panel.dataset.shellOpen = open ? "true" : "false";
    panel.classList.toggle("is-shell-closed", !open);
    panel.setAttribute("aria-hidden", open ? "false" : "true");
    if (open && !wasOpen) panel.querySelector("[data-shell-auxiliary-dismiss]")?.focus({ preventScroll: true });
    if (!open && wasOpen && restoreFocus) {
      const returnTarget = auxiliaryReturnFocus.get(panel);
      if (returnTarget?.isConnected) returnTarget.focus({ preventScroll: true });
    }
    return true;
  }

  function mountApplicationShell({ activeRoute = "/", activeModelingLanguageTab = "overview", activeEnvironmentTab = "topology" } = {}) {
    document.body?.classList.add("app-shell-locked");
    const app = document.getElementById("app");
    app?.classList.add("app-shell-integrated");
    if (app) app.dataset.shellRoute = normalizeRoute(activeRoute);
    const sidebar = document.querySelector(".app-sidebar");
    const topbar = document.querySelector(".topbar");
    if (sidebar) sidebar.innerHTML = renderSideNavigation(activeRoute);
    if (topbar) topbar.innerHTML = renderTopBar();
    bindSidebarControls();
    applySidebarState(readSidebarCollapsed(), { persist: false });
    ensurePageHeader({ activeRoute, activeModelingLanguageTab, activeEnvironmentTab });
    applyWorkbenchContainers();
    updateApplicationShell({ activeRoute, activeModelingLanguageTab, activeEnvironmentTab });
  }

  function updateApplicationShell({ activeRoute = "/", activeModelingLanguageTab = "overview", activeEnvironmentTab = "topology" } = {}) {
    const app = document.getElementById("app");
    if (app) app.dataset.shellRoute = normalizeRoute(activeRoute);
    const manifestRoute = manifestRouteFor(activeRoute);
    document.querySelectorAll("[data-app-route]").forEach((element) => {
      const active = element.dataset.appRoute === manifestRoute;
      element.classList.toggle("active", active);
      element.setAttribute("aria-current", active ? "page" : "false");
    });
    syncNavigationGroups(activeRoute);
    ensurePageHeader({ activeRoute, activeModelingLanguageTab, activeEnvironmentTab });
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
      <aside class="capability-tree-pane shell-directory-pane app-shell-secondary">
        <div class="pane-head shell-directory-head">
          <div class="shell-directory-copy"><h2 class="shell-directory-title">安全能力映射</h2></div>
        </div>
        <div id="tree" class="tree shell-directory-tree"></div>
      </aside>

      <section class="capability-relation-pane app-shell-workspace">
        <button id="expandCapabilityCatalogTab" class="catalog-expand-tab" type="button" aria-label="展开安全能力目录" aria-expanded="false">目录</button>
        <div class="capability-workbench-head">
          <div id="capabilityFocusHeader" class="capability-focus-head-slot"></div>
        </div>
        <div class="capability-workspace-surface">
          <div class="capability-workspace-control page-local-search-toolbar" aria-label="能力映射工作区控制轨">
            <div id="capabilityViewControls" class="capability-view-controls" aria-label="能力页视图切换"></div>
            <div class="capability-workbench-tools page-search-control" aria-label="能力页局部搜索">
              <label class="page-search-input-shell" for="capabilitySearchInput">
                <span class="capability-search-icon" aria-hidden="true">⌕</span>
                <input id="capabilitySearchInput" type="search" placeholder="搜索能力、服务、流程或模块/措施" autocomplete="off" data-search-history-kind="capability" />
              </label>
              <span class="page-search-match-status" data-page-search-status="capability-mapping" aria-live="polite"></span>
              <button class="page-search-step" type="button" data-page-search-step="-1" data-page-search-scope="capability-mapping" title="上一个匹配" aria-label="上一个匹配">‹</button>
              <button class="page-search-step" type="button" data-page-search-step="1" data-page-search-scope="capability-mapping" title="下一个匹配" aria-label="下一个匹配">›</button>
            </div>
          </div>
          <div id="detail" class="capability-relation-workspace"></div>
        </div>
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

  function mcpStatusPresentation(snapshot = null, { error = false } = {}) {
    const serviceState = text(snapshot?.service_state || snapshot?.status?.service_state).trim();
    const authorizedCount = Number(
      snapshot?.authorized_client_count
      ?? snapshot?.status?.authorized_client_count
      ?? (Array.isArray(snapshot?.clients) ? snapshot.clients.filter((client) => client?.status !== "revoked").length : 0),
    );
    const pendingCount = Number(
      snapshot?.pending_authorization_count
      ?? snapshot?.status?.pending_authorization_count
      ?? (Array.isArray(snapshot?.authorization_requests) ? snapshot.authorization_requests.length : 0),
    );
    const licenseState = text(window.sapdLicenseStatus?.state).trim();
    const productLicense = text(window.sapdLicenseStatus?.display_text).trim()
      || (licenseState === "activated" ? "已授权" : licenseState === "expired" ? "已到期" : licenseState === "open" ? "无限制版" : "读取中");
    return {
      tone: error ? "warning" : serviceState === "ready" ? "ok" : serviceState === "error" ? "danger" : "neutral",
      serviceLabel: error ? "状态不可用" : serviceState === "ready" ? "已启动" : serviceState === "starting" ? "启动中" : serviceState === "stopping" ? "停止中" : serviceState === "error" ? "异常" : "未启动",
      authorizationLabel: pendingCount > 0
        ? `待确认 ${pendingCount} 个`
        : authorizedCount > 0
          ? `已授权 ${authorizedCount} 个客户端`
          : "未授权客户端",
      productLicense,
    };
  }

  function renderMcpStatusMonitor(snapshot = null, options = {}) {
    const status = mcpStatusPresentation(snapshot, options);
    return `
      <div id="mcpStatusMonitor" class="mcp-status-monitor" data-status-tone="${escapeHtml(status.tone)}">
        <button
          class="mcp-status-monitor-button"
          type="button"
          data-app-route="/settings/ai-integration"
          title="MCP 与授权状态"
          aria-label="${escapeHtml(`MCP ${status.serviceLabel}，${status.authorizationLabel}，打开 AI 功能集成`)}"
        ><span aria-hidden="true">▤</span><i aria-hidden="true"></i></button>
        <div class="mcp-status-popover" role="status" aria-live="polite">
          <strong>MCP 状态监测</strong>
          <span><small>MCP 链接状态</small><b>${escapeHtml(status.serviceLabel)}</b></span>
          <span><small>客户端授权</small><b>${escapeHtml(status.authorizationLabel)}</b></span>
          <span><small>License 授权状态</small><b>${escapeHtml(status.productLicense)}</b></span>
        </div>
      </div>
    `;
  }

  function updateMcpStatusMonitor(snapshot = null, options = {}) {
    const target = document.getElementById("mcpStatusMonitor");
    if (!target) return;
    if (snapshot && typeof snapshot === "object") lastMcpStatusSnapshot = snapshot;
    lastMcpStatusOptions = { ...lastMcpStatusOptions, ...options };
    target.outerHTML = renderMcpStatusMonitor(lastMcpStatusSnapshot, lastMcpStatusOptions);
  }

  function renderLocalModeStatus(license = window.sapdLicenseStatus) {
    const state = text(license?.state || "").trim();
    const displayText = text(license?.display_text || "").trim();
    const tone = state === "activated" || state === "open" ? "success" : state === "expired" ? "warning" : "info";
    const label = state === "open" ? "版本" : state === "activated" ? "授权" : state === "expired" ? "到期" : "试用";
    const value = displayText || "授权状态读取中";
    return `
      <span class="status-badge license-status-badge license-status-${escapeHtml(tone)}">
        <small>${escapeHtml(label)}</small>
        <strong>${escapeHtml(value)}</strong>
      </span>
    `;
  }

  async function hydrateLicenseStatus() {
    const target = document.getElementById("licenseStatusBadge");
    if (target) target.innerHTML = renderLocalModeStatus();
    const dataClient = window.sapdDataClient;
    if (!dataClient?.getRuntimeHealth) {
      updateMcpStatusMonitor();
      return;
    }
    try {
      const [runtimeEnvelope, mcpEnvelope] = await Promise.all([
        dataClient.getRuntimeHealth(),
        dataClient.getMcpControlPanel?.() || Promise.resolve(null),
      ]);
      const runtime = runtimeEnvelope?.data || runtimeEnvelope || {};
      const mcpSnapshot = mcpEnvelope?.data || mcpEnvelope || null;
      window.sapdLicenseStatus = runtime.license || null;
      if (target) target.innerHTML = renderLocalModeStatus(window.sapdLicenseStatus);
      updateMcpStatusMonitor(mcpSnapshot);
    } catch (error) {
      window.sapdLicenseStatus = { state: "unknown", display_text: "授权状态未知" };
      if (target) target.innerHTML = renderLocalModeStatus(window.sapdLicenseStatus);
      updateMcpStatusMonitor(null, { error: true });
    }
  }

  components.AppShell = {
    manifest: NAV_MANIFEST,
    directoryPaneMetrics: DIRECTORY_PANE_METRICS,
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
    setAuxiliaryLayerState,
    renderTopBar,
    renderGlobalSearch,
    renderSideNavigation,
    renderBreadcrumb,
    renderPageHeader,
    renderWorkbenchLayout,
    renderRightInsightPanel,
    mountCapabilityWorkspace,
    renderCapabilitySummary,
    renderMcpStatusMonitor,
    updateMcpStatusMonitor,
    renderLocalModeStatus,
    hydrateLicenseStatus,
  };
})();
