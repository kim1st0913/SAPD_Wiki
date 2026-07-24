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
    };
  }

  function knowledgeStats(summary) {
    const counts = summary.dictionaryCounts || {};
    const capabilityMap = summary.capabilityMap || {};
    return [
      { id: "capabilities", label: "安全能力", value: capabilityMap.capabilities || 0, unit: "项", hint: "L2 能力", route: "/knowledge/capabilities", tone: "blue" },
      { id: "focuses", label: "能力关注点", value: capabilityMap.focuses || summary.totalFocuses || 0, unit: "个", hint: "关注点", route: "/capability-mapping", tone: "indigo" },
      { id: "services", label: "安全技术服务", value: counts.services || 0, unit: "项", hint: "服务字典", route: "/knowledge/technical-services", tone: "teal" },
      { id: "technical", label: "安全技术模块 / 措施", value: `${formatNumber(counts.modules)} / ${formatNumber(counts.measures)}`, unit: "", hint: "模块 / 措施", route: "/knowledge/technical", tone: "cyan" },
      { id: "standards", label: "标准控制项", value: summary.standardControls?.standardsIndex || 0, unit: "条", hint: "标准索引", route: "/standards", tone: "amber" },
      { id: "dictionaries", label: "字典目录", value: summary.dictionarySections?.length || 0, unit: "类", hint: "业务目录", tone: "violet" },
    ];
  }

  function dictionaryRows(summary) {
    const counts = summary.dictionaryCounts || {};
    return [
      { label: "作用域", value: counts.scopes, route: "/knowledge/scopes" },
      { label: "服务", value: counts.services, route: "/knowledge/technical-services" },
      { label: "模块", value: counts.modules, route: "/knowledge/technical-modules" },
      { label: "措施", value: counts.measures, route: "/knowledge/technical-measures" },
      { label: "安全工作", value: counts["security-works"], route: "/knowledge/work-items" },
      { label: "流程", value: counts.processes, route: "/knowledge/processes" },
      { label: "职能层", value: counts["work-functions"], route: "/knowledge/functions" },
      { label: "岗位 / 职能参考", value: counts.references, route: "/standards/workforce-reference" },
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
        note: "环境投影口径，与字典作用域分开",
        tone: "ocean",
        items: [
          { label: "环境", value: environment.information_environments, route: "/environment-mapping" },
          { label: "对象", value: environment.information_objects },
          { label: "作用域类型", value: environment.scope_types, route: "/knowledge/scopes" },
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
          { label: "幻灯片类", value: content.html_documents },
          { label: "建模语言", value: manifest.modelingGuides, route: "/guides/security-architecture-modeling-language" },
          { label: "图示视图", value: content.diagram_views },
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
    return recentIssues.slice(0, 5).map((issue) => `
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
        <header class="dashboard-p2-panel-head"><div><span class="dashboard-kicker">WORKBENCH</span><h3>工作事项</h3></div><span class="dashboard-status">本地用户库</span></header>
        <div class="dashboard-workbench-streams">
          <section class="dashboard-workstream" aria-label="ISSUE清单工作区">
            ${renderWorkstreamLead({
              tone: "issue",
              label: "ISSUE清单",
              title: "处理架构评审问题",
              description: "状态、优先级、页面范围和导出集中在完整清单。",
              primaryLabel: firstIssue.id ? "继续处理" : "打开清单",
              primaryRoute: "/workbench/annotations",
              primaryIssueId: firstIssue.id,
              metric: issueSummary.todoCount,
              metricLabel: "待处理",
              supporting: `${formatNumber(issueSummary.total)} 条全部 · ${Math.min(5, visibleIssues.length)} 条最近更新`,
              menu: { label: "ISSUE清单更多", route: "/workbench/annotations", actionLabel: `查看全部 ${formatNumber(issueSummary.total)} 条 ISSUE` },
            })}
            <div class="dashboard-workstream-list-head"><strong>最近更新</strong><span>${Math.min(5, visibleIssues.length)} 条</span></div>
            <div class="dashboard-recent-list" role="group" aria-label="最近 5 条 ISSUE">${renderRecentIssues(visibleIssues, issueDataState)}</div>
          </section>
          <section class="dashboard-workstream" aria-label="成熟度评估工作区">
            ${renderWorkstreamLead({
              tone: "maturity",
              label: "成熟度评估",
              title: "继续客户评估项目",
              description: "项目、模板、评分、复核、结果和报告形成完整工作流。",
              primaryLabel: firstProject.route ? "继续评估" : "进入工作台",
              primaryRoute: firstProject.route || "/workbench/maturity",
              metric: maturitySummary.total,
              metricLabel: "评估项目",
              supporting: `${formatNumber(maturitySummary.resultReadyCount)} 个已有结果`,
              menu: { label: "成熟度评估更多", route: "/workbench/maturity", actionLabel: `查看全部 ${formatNumber(maturitySummary.total)} 个项目` },
            })}
            <div class="dashboard-workstream-list-head"><strong>最近项目结果</strong><span>${Math.min(3, visibleProjects.length)} 个</span></div>
            <div class="dashboard-recent-list" role="group" aria-label="最近 3 个成熟度项目结果">${renderMaturityProjects(maturitySummary)}</div>
          </section>
        </div>
        <footer class="dashboard-workbench-foot"><span>本地数据实时读取</span><span>ISSUE ${utils.escapeHtml(firstIssue.updated || "暂无更新")} · 评估 ${utils.escapeHtml(firstProject.updatedAt || "暂无更新")}</span></footer>
      </section>`;
  }

  function renderKnowledge(summary) {
    const knowledgeReady = summary.knowledgeSummary?.data_state === "ready";
    return `
      <section class="dashboard-p2-panel dashboard-knowledge-panel" aria-label="知识库基础统计">
        <header class="dashboard-p2-panel-head"><div><span class="dashboard-kicker">KNOWLEDGE OBSERVATORY</span><h3>知识库统计</h3></div><span class="dashboard-status">${utils.escapeHtml(summary.dataState === "ready" && summary.dictionaryDataState === "ready" && knowledgeReady ? "数据就绪" : "数据加载中")}</span></header>
        <div class="dashboard-knowledge-stats" role="list" aria-label="知识库基础数量">${knowledgeStats(summary).map(renderKnowledgeStat).join("")}</div>
        <div class="dashboard-insight-deck" aria-label="环境、生命周期和指南统计">${insightBands(summary).map(renderInsightBand).join("")}</div>
        <div class="dashboard-dictionary-summary">
          <div><strong>字典明细</strong><span>按业务目录统计，不合并为跨粒度唯一对象数</span></div>
          <div class="dashboard-dictionary-list">${dictionaryRows(summary).map((item) => `<button type="button" data-app-route="${utils.escapeHtml(item.route)}"><span>${utils.escapeHtml(item.label)}</span><strong>${utils.escapeHtml(formatNumber(item.value))}</strong></button>`).join("")}</div>
        </div>
      </section>`;
  }

  function render({ summary, issueSummary, recentIssues = [], issueDataState = "loading", maturitySummary = {} }) {
    return `
      <section class="dashboard-p2-layout">${renderWorkbench({ issueSummary, recentIssues, issueDataState, maturitySummary })}${renderKnowledge(summary)}</section>`;
  }

  components.P2ProductWorkspace = { render };
})();
