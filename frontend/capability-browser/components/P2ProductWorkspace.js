(function () {
  const components = (window.sapdComponents = window.sapdComponents || {});
  const utils = components.utils;

  function formatNumber(value) {
    return (Number(value) || 0).toLocaleString("zh-CN");
  }

  function formatValue(value, unit = "") {
    if (typeof value === "number") return `${formatNumber(value)}${unit && unit !== "个" ? unit : ""}`;
    const display = utils.text(value) || "0";
    return `${display}${unit && !display.includes(unit) ? unit : ""}`;
  }

  function guideManifestStats() {
    const navigation = utils.list(components.AppShell?.manifest?.navigation);
    const guideGroup = navigation.find((item) => item.id === "guides") || {};
    const guideEntries = utils.list(guideGroup.children).filter((item) => item.type === "document-page");
    return {
      guideEntries: guideEntries.length,
      modelingGuides: guideEntries.filter((item) => item.id === "security-architecture-modeling-language").length,
      maturityGuides: guideEntries.filter((item) => item.id === "maturity-model-usage").length,
    };
  }

  function knowledgeStats(summary) {
    const counts = summary.dictionaryCounts || {};
    const capabilityMap = summary.capabilityMap || {};
    const catalog = summary.knowledgeSummary?.catalog || {};
    return [
      { id: "capabilities", label: "安全能力", value: capabilityMap.capabilities || 0, unit: "项", hint: "L2 能力", route: "/knowledge/capabilities", tone: "blue" },
      { id: "focuses", label: "能力关注点", value: capabilityMap.focuses || summary.totalFocuses || 0, unit: "个", hint: "关注点", route: "/capability-mapping", tone: "indigo" },
      { id: "services", label: "安全技术服务", value: counts.services || 0, unit: "项", hint: "服务字典", route: "/knowledge/technical-services", tone: "teal" },
      { id: "technical", label: "安全技术模块 / 措施", value: `${formatNumber(counts.modules)} / ${formatNumber(counts.measures)}`, unit: "", hint: "模块 / 措施", route: "/knowledge/technical", tone: "cyan" },
      { id: "standards", label: "标准控制项", value: summary.standardControls?.standardsIndex || 0, unit: "条", hint: "标准索引", route: "/standards", tone: "amber" },
      { id: "environment-master", label: "环境主数据", value: catalog.environment_master_records || 0, unit: "项", hint: "环境 / 子类 / 对象", route: "/knowledge/environment-objects", tone: "indigo" },
    ];
  }

  function dictionaryRows(summary) {
    const counts = summary.dictionaryCounts || {};
    const capabilityMap = summary.capabilityMap || {};
    const catalog = summary.knowledgeSummary?.catalog || {};
    return [
      { label: "安全能力", value: capabilityMap.capabilities, route: "/knowledge/capabilities" },
      { label: "能力作用域", value: catalog.scope_types || counts.scopes, route: "/knowledge/scopes" },
      { label: "环境主数据", value: catalog.environment_master_records, route: "/knowledge/environment-objects" },
      { label: "技术服务", value: catalog.technical_services || counts.services, route: "/knowledge/technical-services" },
      { label: "技术模块", value: catalog.technical_modules || counts.modules, route: "/knowledge/technical-modules" },
      { label: "技术措施", value: catalog.technical_measures || counts.measures, route: "/knowledge/technical-measures" },
      { label: "安全工作", value: catalog.security_works || counts["security-works"], route: "/knowledge/work-items" },
      { label: "安全流程", value: catalog.security_processes || counts.processes, route: "/knowledge/processes" },
      {
        label: "应用系统 / 组件",
        displayValue: `${formatNumber(catalog.application_system_types)} / ${formatNumber(catalog.application_components)}`,
        route: "/knowledge/application-systems",
      },
      { label: "安全职能", value: catalog.work_functions, route: "/knowledge/functions" },
      { label: "岗位 / 职能参考", value: catalog.workforce_references || counts.references, route: "/standards/workforce-reference" },
      { label: "标准 / 框架", value: catalog.standard_frameworks, route: "/standards" },
    ];
  }

  function insightBands(summary) {
    const knowledge = summary.knowledgeSummary || {};
    const environment = knowledge.environment || {};
    const lifecycles = knowledge.lifecycles || {};
    const content = knowledge.content || {};
    const manifest = guideManifestStats();
    return [
      {
        id: "environment",
        label: "信息化环境",
        note: "唯一主数据口径，关联上下文不重复计数",
        tone: "ocean",
        items: [
          { label: "环境", value: environment.information_environments, route: "/knowledge/environment-objects" },
          { label: "环境子类", value: environment.environment_segment_types, route: "/knowledge/environment-objects" },
          { label: "对象", value: environment.information_objects, route: "/knowledge/environment-objects" },
        ],
      },
      {
        id: "lifecycle",
        label: "安全生命周期",
        note: "两个生命周期独立呈现",
        tone: "sunset",
        items: [
          { label: "LC-AP 阶段", value: lifecycles.lc_ap_stages, route: "/development-security" },
          { label: "LC-DT 阶段", value: lifecycles.lc_dt_stages, route: "/data-security" },
        ],
      },
      {
        id: "content",
        label: "指南与知识表达",
        note: "只统计当前可用内容入口",
        tone: "orchid",
        items: [
          { label: "指南", value: manifest.guideEntries, route: "/guides" },
          { label: "幻灯片指南", value: content.slide_decks },
          { label: "建模语言", value: manifest.modelingGuides, route: "/guides/security-architecture-modeling-language" },
          { label: "成熟度指南", value: manifest.maturityGuides, route: "/guides/maturity-model-usage" },
        ],
      },
    ];
  }

  function renderKnowledgeStat(item) {
    const content = `<span>${utils.escapeHtml(item.label)}</span><strong>${utils.escapeHtml(formatValue(item.value, item.unit))}</strong><small>${utils.escapeHtml(item.hint)}</small>`;
    if (!item.route) return `<div class="dashboard-knowledge-stat is-static tone-${utils.escapeHtml(item.tone)}" data-dashboard-stat="${utils.escapeHtml(item.id)}">${content}</div>`;
    return `<button class="dashboard-knowledge-stat is-link tone-${utils.escapeHtml(item.tone)}" type="button" data-app-route="${utils.escapeHtml(item.route)}" data-dashboard-stat="${utils.escapeHtml(item.id)}" aria-label="打开${utils.escapeHtml(item.label)}页面">${content}</button>`;
  }

  function renderInsightValue(item) {
    const content = `<strong>${utils.escapeHtml(formatNumber(item.value))}</strong><small>${utils.escapeHtml(item.label)}</small>`;
    if (!item.route) return `<span class="dashboard-insight-value is-static">${content}</span>`;
    return `<button class="dashboard-insight-value is-link" type="button" data-app-route="${utils.escapeHtml(item.route)}" aria-label="打开${utils.escapeHtml(item.label)}页面">${content}</button>`;
  }

  function renderInsightBand(band) {
    return `
      <section class="dashboard-insight-band tone-${utils.escapeHtml(band.tone)}" data-dashboard-band="${utils.escapeHtml(band.id)}" aria-label="${utils.escapeHtml(band.label)}统计">
        <span class="dashboard-insight-band-head"><strong>${utils.escapeHtml(band.label)}</strong><small>${utils.escapeHtml(band.note)}</small></span>
        <span class="dashboard-insight-values">${band.items.map(renderInsightValue).join("")}</span>
      </section>`;
  }

  function secondaryNavigationStats(summary) {
    const includedLabels = new Set([
      "能力作用域",
      "安全工作",
      "安全流程",
      "应用系统 / 组件",
      "安全职能",
      "岗位 / 职能参考",
      "标准 / 框架",
    ]);
    return dictionaryRows(summary).filter((item) => includedLabels.has(item.label));
  }

  function renderNavigationStat(item) {
    return `
      <button class="dashboard-navigation-stat" type="button" data-app-route="${utils.escapeHtml(item.route)}">
        <span>${utils.escapeHtml(item.label)}</span>
        <strong>${utils.escapeHtml(item.displayValue || formatNumber(item.value))}</strong>
      </button>`;
  }

  function issueStatusTone(status = "") {
    if (status === "待处理" || status === "待确认") return "is-attention";
    if (status === "处理中") return "is-active";
    if (status === "已采纳") return "is-positive";
    return "is-muted";
  }

  function renderOverflowMenu({ label, route, actionLabel }) {
    return `
      <details class="dashboard-overflow-menu">
        <summary aria-label="${utils.escapeHtml(label)}" title="更多"><span aria-hidden="true">•••</span></summary>
        <div class="dashboard-overflow-popover" role="menu">
          <button type="button" role="menuitem" data-app-route="${utils.escapeHtml(route)}">${utils.escapeHtml(actionLabel)}</button>
        </div>
      </details>`;
  }

  function renderWorkstreamLead({ tone, label, title, description, primaryLabel, primaryRoute, primaryIssueId = "", metric, metricLabel, supporting, menu }) {
    const issueAttribute = primaryIssueId ? ` data-dashboard-issue-id="${utils.escapeHtml(primaryIssueId)}"` : "";
    return `
      <header class="dashboard-workstream-lead tone-${utils.escapeHtml(tone)}">
        <div class="dashboard-workstream-copy">
          <span>${utils.escapeHtml(label)}</span>
          <h4>${utils.escapeHtml(title)}</h4>
          <p>${utils.escapeHtml(description)}</p>
        </div>
        <div class="dashboard-workstream-command">
          <span class="dashboard-workstream-metric"><strong>${utils.escapeHtml(formatNumber(metric))}</strong><small>${utils.escapeHtml(metricLabel)}</small></span>
          <span class="dashboard-workstream-support">${utils.escapeHtml(supporting)}</span>
          <span class="dashboard-workstream-actions">
            <button class="dashboard-workstream-primary" type="button" data-app-route="${utils.escapeHtml(primaryRoute)}"${issueAttribute}>${utils.escapeHtml(primaryLabel)}</button>
            ${renderOverflowMenu(menu)}
          </span>
        </div>
      </header>`;
  }

  function renderRecentIssues(recentIssues, dataState) {
    if (dataState === "loading") return `<div class="dashboard-recent-empty"><strong>正在读取 ISSUE清单</strong><span>从本地用户库加载最近更新。</span></div>`;
    if (!recentIssues.length) return `<div class="dashboard-recent-empty"><strong>暂无 ISSUE</strong><span>在业务页面创建 Issue 后，最近记录会显示在这里。</span></div>`;
    return recentIssues.slice(0, 3).map((issue) => `
      <button class="dashboard-recent-row dashboard-issue-row" type="button" data-app-route="/workbench/annotations" data-dashboard-issue-id="${utils.escapeHtml(issue.id)}" aria-label="打开 ISSUE：${utils.escapeHtml(issue.title)}">
        <span class="dashboard-recent-copy"><strong>${utils.escapeHtml(issue.title)}</strong><small>${utils.escapeHtml(issue.page)} · ${utils.escapeHtml(issue.updated || "暂无更新时间")}</small></span>
        <span class="dashboard-recent-state ${utils.escapeHtml(issueStatusTone(issue.status))}">${utils.escapeHtml(issue.status)}</span>
      </button>`).join("");
  }

  function renderMaturityProjects(maturitySummary) {
    const projects = utils.list(maturitySummary.projects);
    if (maturitySummary.dataState === "loading") return `<div class="dashboard-recent-empty"><strong>正在读取成熟度项目</strong><span>从受控项目工作区加载最近结果。</span></div>`;
    if (maturitySummary.dataState !== "ready") return `<div class="dashboard-recent-empty"><strong>成熟度项目暂不可用</strong><span>进入成熟度评估工作台可查看加载状态。</span></div>`;
    if (!projects.length) return `<div class="dashboard-recent-empty"><strong>暂无成熟度项目</strong><span>创建评估项目后，最近结果会显示在这里。</span></div>`;
    return projects.slice(0, 3).map((project) => {
      const hasResult = project.resultReady && Number.isFinite(Number(project.currentIndex));
      const resultValue = hasResult ? Number(project.currentIndex).toFixed(2) : "—";
      const resultLabel = hasResult ? project.currentLevel || "已形成结果" : project.statusLabel || "结果待形成";
      return `
        <button class="dashboard-recent-row dashboard-maturity-row" type="button" data-app-route="${utils.escapeHtml(project.route)}" aria-label="打开成熟度项目：${utils.escapeHtml(project.name)}">
          <span class="dashboard-recent-copy"><strong>${utils.escapeHtml(project.name)}</strong><small>${utils.escapeHtml(project.organization || "企业组织未填写")} · ${utils.escapeHtml(project.updatedAt || "暂无更新时间")}</small></span>
          <span class="dashboard-maturity-result"><strong>${utils.escapeHtml(resultValue)}</strong><small>${utils.escapeHtml(resultLabel)}</small></span>
        </button>`;
    }).join("");
  }

  function renderWorkbench({ issueSummary, recentIssues, issueDataState, maturitySummary }) {
    const visibleIssues = utils.list(recentIssues);
    const visibleProjects = utils.list(maturitySummary.projects);
    const firstIssue = visibleIssues[0] || {};
    const firstProject = visibleProjects[0] || {};
    return `
      <section class="dashboard-workbench-entry dashboard-p2-panel" aria-label="工作台入口">
        <header class="dashboard-p2-panel-head"><div><span class="dashboard-kicker">ACTION CENTER</span><h3>待办工作</h3></div><span class="dashboard-status">本地用户库</span></header>
        <div class="dashboard-workbench-streams">
          <section class="dashboard-workstream" aria-label="ISSUE清单工作区">
            ${renderWorkstreamLead({
              tone: "issue",
              label: "ISSUE清单",
              title: "处理架构评审问题",
              description: "状态、优先级、页面定位、处理结果和导出统一管理。",
              primaryLabel: firstIssue.id ? "继续处理" : "打开清单",
              primaryRoute: "/workbench/annotations",
              primaryIssueId: firstIssue.id,
              metric: issueSummary.todoCount,
              metricLabel: "待处理",
              supporting: `${formatNumber(issueSummary.total)} 条全部`,
              menu: { label: "ISSUE清单更多", route: "/workbench/annotations", actionLabel: `查看全部 ${formatNumber(issueSummary.total)} 条 ISSUE` },
            })}
            <div class="dashboard-workstream-list-head"><strong>最近待办</strong><span>${Math.min(3, visibleIssues.length)} 条</span></div>
            <div class="dashboard-recent-list" role="group" aria-label="最近 3 条 ISSUE">${renderRecentIssues(visibleIssues, issueDataState)}</div>
          </section>
          <section class="dashboard-workstream" aria-label="成熟度评估工作区">
            ${renderWorkstreamLead({
              tone: "maturity",
              label: "成熟度评估",
              title: "继续客户评估项目",
              description: "项目、模板、评分、复核、结果与报告统一管理。",
              primaryLabel: firstProject.route ? "继续评估" : "进入工作台",
              primaryRoute: firstProject.route || "/workbench/maturity",
              metric: maturitySummary.total,
              metricLabel: "评估项目",
              supporting: `${formatNumber(maturitySummary.resultReadyCount)} 个已有结果`,
              menu: { label: "成熟度评估更多", route: "/workbench/maturity", actionLabel: `查看全部 ${formatNumber(maturitySummary.total)} 个项目` },
            })}
            <div class="dashboard-workstream-list-head"><strong>继续评估</strong><span>${Math.min(3, visibleProjects.length)} 个项目</span></div>
            <div class="dashboard-recent-list" role="group" aria-label="最近 3 个成熟度项目结果">${renderMaturityProjects(maturitySummary)}</div>
          </section>
        </div>
        <footer class="dashboard-workbench-foot"><span>本地数据实时读取</span><span>ISSUE ${utils.escapeHtml(firstIssue.updated || "暂无更新")} · 评估 ${utils.escapeHtml(firstProject.updatedAt || "暂无更新")}</span></footer>
      </section>`;
  }

  function renderKnowledge(summary) {
    const knowledgeReady = summary.knowledgeSummary?.data_state === "ready";
    return `
      <section class="dashboard-p2-panel dashboard-knowledge-panel" aria-label="系统数据总览">
        <header class="dashboard-p2-panel-head"><div><span class="dashboard-kicker">SYSTEM OVERVIEW</span><h3>系统数据总览</h3></div><span class="dashboard-status">${utils.escapeHtml(summary.dataState === "ready" && summary.dictionaryDataState === "ready" && knowledgeReady ? "数据就绪" : "数据加载中")}</span></header>
        <div class="dashboard-knowledge-stats" role="list" aria-label="知识库基础数量">${knowledgeStats(summary).map(renderKnowledgeStat).join("")}</div>
        <div class="dashboard-stat-mosaic-secondary" aria-label="全局导航数据">
          <div class="dashboard-navigation-stats">${secondaryNavigationStats(summary).map(renderNavigationStat).join("")}</div>
          ${insightBands(summary).map(renderInsightBand).join("")}
        </div>
      </section>`;
  }

  function usageGuideGroups() {
    return {
      operational: {
        kicker: "QUICK START",
        title: "快速开始",
        status: "3 条业务流",
        rows: [
          {
            id: "mcp",
            title: "MCP 集成",
            description: "将外部 AI 客户端安全连接到本机 SAPD Wiki，只读使用受控知识内容。",
            flow: "系统设置 → 生成本机安全连接证书 → 启动 MCP → 复制连接地址 → 客户端连接 → 本机批准授权 → 查看访问审计",
            actionLabel: "进入设置",
            route: "/settings/ai-integration",
          },
          {
            id: "issues",
            title: "ISSUE 生成与管理",
            description: "把业务页面中的疑问、缺口和复核结论转入统一清单持续处理。",
            flow: "业务页面创建 Issue → 补充上下文 → 设置状态与优先级 → 处理与复核 → 批量管理或导出",
            actionLabel: "进入清单",
            route: "/workbench/annotations",
          },
          {
            id: "maturity",
            title: "成熟度评估",
            description: "按统一模板完成现状与目标评估，并形成可复核、可导出的结果和报告。",
            flow: "创建项目 → 选择模板 → 设置适用性 → 现状/目标评分与说明 → 复核 → 结果 → 报告",
            actionLabel: "开始评估",
            route: "/workbench/maturity",
          },
        ],
      },
    };
  }

  function renderUsageGuideRow(item, index, interactive) {
    const content = `
      <span class="dashboard-usage-guide-index">${String(index + 1).padStart(2, "0")}</span>
      <span class="dashboard-usage-guide-copy">
        <strong>${utils.escapeHtml(item.title)}</strong>
        <small>${utils.escapeHtml(item.description)}</small>
        ${item.flow ? `<em>${utils.escapeHtml(item.flow)}</em>` : ""}
      </span>`;
    if (!interactive) {
      return `<div class="dashboard-usage-guide-item" role="listitem" data-dashboard-guide="${utils.escapeHtml(item.id)}">${content}</div>`;
    }
    return `
      <button type="button" role="listitem" data-app-route="${utils.escapeHtml(item.route)}" data-dashboard-guide="${utils.escapeHtml(item.id)}" aria-label="${utils.escapeHtml(item.actionLabel)}：${utils.escapeHtml(item.title)}">
        ${content}
        <span class="dashboard-usage-guide-action">${utils.escapeHtml(item.actionLabel)} <span aria-hidden="true">›</span></span>
      </button>`;
  }

  function renderUsageGuide(group, type) {
    const interactive = type === "operational";
    return `
      <section class="dashboard-p2-panel dashboard-usage-guide is-${utils.escapeHtml(type)}" aria-label="${utils.escapeHtml(group.title)}">
        <header class="dashboard-p2-panel-head">
          <div><span class="dashboard-kicker">${utils.escapeHtml(group.kicker)}</span><h3>${utils.escapeHtml(group.title)}</h3></div>
          <span class="dashboard-status">${utils.escapeHtml(group.status)}</span>
        </header>
        ${group.intro ? `<p class="dashboard-usage-guide-intro">${utils.escapeHtml(group.intro)}</p>` : ""}
        <div class="dashboard-usage-guide-list" role="list">
          ${group.rows.map((item, index) => renderUsageGuideRow(item, index, interactive)).join("")}
        </div>
      </section>`;
  }

  function render({ summary, issueSummary, recentIssues = [], issueDataState = "loading", maturitySummary = {} }) {
    const guides = usageGuideGroups();
    return `
      <section class="dashboard-p2-layout">
        ${renderKnowledge(summary)}
        <div class="dashboard-p2-action-grid">
          ${renderWorkbench({ issueSummary, recentIssues, issueDataState, maturitySummary })}
          ${renderUsageGuide(guides.operational, "operational")}
        </div>
      </section>`;
  }

  components.P2ProductWorkspace = { render };
})();
