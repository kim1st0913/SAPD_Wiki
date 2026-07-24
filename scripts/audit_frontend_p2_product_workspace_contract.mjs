#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const configPath = path.join(projectRoot, "config/frontend-p2-product-workspace.json");
const read = (relativePath) => readFileSync(path.join(projectRoot, relativePath), "utf8");
const assert = (condition, message, issues) => {
  if (!condition) issues.push(message);
};
const includesAll = (source, values) => values.every((value) => source.includes(value));
const excludesAll = (source, values) => values.every((value) => !source.includes(value));
const argValue = (name) => {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] || "" : "";
};

function functionSlice(source, startName, endName) {
  const start = source.indexOf(`function ${startName}`);
  const end = source.indexOf(`function ${endName}`, start + 1);
  return start >= 0 ? source.slice(start, end >= 0 ? end : undefined) : "";
}

function capabilityDirectoryActions(source) {
  return [...source.matchAll(/data-capability-directory-action="([^"]+)"/g)].map((match) => match[1]);
}

async function fetchText(baseUrl, relativePath) {
  const response = await fetch(new URL(relativePath, `${baseUrl.replace(/\/$/, "")}/`), { cache: "no-store" });
  if (!response.ok) throw new Error(`${relativePath} HTTP ${response.status}`);
  return response.text();
}

async function fetchJson(baseUrl, relativePath) {
  const response = await fetch(new URL(relativePath, `${baseUrl.replace(/\/$/, "")}/`), { cache: "no-store" });
  if (!response.ok) throw new Error(`${relativePath} HTTP ${response.status}`);
  return response.json();
}

async function main() {
  const issues = [];
  assert(existsSync(configPath), "缺少 P2 前端优化配置", issues);
  const config = JSON.parse(readFileSync(configPath, "utf8"));
  const appSource = read("frontend/capability-browser/app.js");
  const dataClientSource = read("frontend/capability-browser/dataClient.js");
  const appShellSource = read("frontend/capability-browser/components/AppShell.js");
  const workspaceSource = read("frontend/capability-browser/components/P2ProductWorkspace.js");
  const maturitySource = read("frontend/capability-browser/components/MaturityAssessmentWorkbench.js");
  const directorySource = read("frontend/capability-browser/components/CapabilityDirectoryMaintenanceTable.js");
  const serviceSource = read("frontend/capability-browser/components/TechnicalServiceMaintenanceTable.js");
  const moduleSource = read("frontend/capability-browser/components/TechnologyModuleMaintenanceTable.js");
  const functionSource = read("frontend/capability-browser/components/WorkFunctionMaintenanceTable.js");
  const roleSource = read("frontend/capability-browser/components/StandardRoleReferenceTable.js");
  const standardSource = read("frontend/capability-browser/components/StandardFrameworkTable.js");
  const cssSource = read("frontend/capability-browser/p2-product-workspace.css");
  const guideSource = read("frontend/capability-browser/assets/guides/maturity-model-usage.html");
  const indexSource = read("frontend/capability-browser/index.html");
  const apiSource = read("src/sapd_wiki/api_server.py");
  const serverSource = read("scripts/run_local_server.py");
  const routePackagesSource = functionSlice(appSource, "routePackagesForCurrentState", "mergeCapabilityProjection");
  const overviewSource = functionSlice(appSource, "renderOverview", "workbenchRouteType");
  const directoryRenderStart = directorySource.indexOf("function render({");
  const directoryRenderSource = directoryRenderStart >= 0 ? directorySource.slice(directoryRenderStart) : "";
  const directoryActions = capabilityDirectoryActions(directoryRenderSource);

  assert(routePackagesSource.includes('return ["analyticsSummary", "maintenanceIndex", "dashboardKnowledgeSummary"]'), "P2-1 总览未使用三个轻量权威摘要", issues);
  assert(includesAll(overviewSource, ["P2ProductWorkspace", "workbenchIssueSummary", "workbenchRecentIssueRows(issueRows, 5)", "dashboardSnapshot?.(3)", "dashboardSummaries"]), "P2-1 工作台与知识库概览组件接入不完整", issues);
  assert(includesAll(dataClientSource, ["dashboardKnowledgeSummary", "/api/v1/dashboard/knowledge-summary", "getDashboardKnowledgeSummary"]), "P2-1 轻量统计客户端契约不完整", issues);
  assert(includesAll(apiSource, ["def dashboard_knowledge_summary", '"information_environments"', '"information_objects"', '"scope_types"', '"lc_ap_stages"', '"lc_dt_stages"', '"html_documents"', '"diagram_views"']), "P2-1 服务端轻量统计字段不完整", issues);
  assert(serverSource.includes('/api/v1/dashboard/knowledge-summary'), "P2-1 5173 开发服务未暴露轻量统计接口", issues);
  assert(includesAll(workspaceSource, ["KNOWLEDGE OBSERVATORY", "信息化环境", "安全生命周期", "指南与知识表达", "幻灯片类", "建模语言", "图示视图"]), "P2-1 新增统计表达不完整", issues);
  assert(includesAll(workspaceSource, ["function renderInsightValue", "dashboard-insight-value is-static", "dashboard-insight-value is-link", 'route: "/development-security"', 'route: "/data-security"', 'route: "/guides/security-architecture-modeling-language"', 'route: "/knowledge/technical-modules"', 'route: "/knowledge/technical-measures"', 'route: "/knowledge/work-items"', 'route: "/knowledge/processes"']), "Dashboard 分类统计未按独立业务页面分配精确路由", issues);
  assert(!workspaceSource.includes('<button class="dashboard-insight-band') && includesAll(workspaceSource, ['<section class="dashboard-insight-band', 'if (!item.route) return `<span class="dashboard-insight-value is-static">', 'if (!item.route) return `<div class="dashboard-knowledge-stat is-static']), "无独立页面的 Dashboard 统计仍可能整体可点击", issues);
  assert(includesAll(appShellSource, ['eyebrow: "SAPD WIKI"', 'title: "工作台与知识库概览"', "继续本地工作，并按业务粒度查看能力、环境、生命周期、技术服务、标准、字典与指南内容。", "hideTypeLabel: true"]), "P2-1 首页 AppShell 标题内容未按用户指定统一", issues);
  assert(!workspaceSource.includes("工作台与知识库概览") && !workspaceSource.includes("dashboard-p2-heading"), "P2-1 首页正文仍重复持有页面标题", issues);
  assert(includesAll(workspaceSource, ["安全能力", "能力关注点", "安全技术服务", "安全技术模块 / 措施", "标准控制项", "字典目录"]), "P2-1 基础统计对象不完整", issues);
  assert(excludesAll(workspaceSource, ["renderDashboardMetric", "renderDashboardCoverageRows", "renderDashboardCapabilityMap", "%", "达成率", "覆盖率", "dashboard-donut", "dashboard-bar"]), "P2-1 总览仍渲染达成率、覆盖率或图表装饰", issues);
  assert(!workspaceSource.includes("暂存评估") && !workspaceSource.includes("1 暂存"), "P2-1 总览仍含硬编码成熟度数量", issues);
  assert(config.p2_1?.recentWork?.issueLimit === 5 && config.p2_1?.recentWork?.maturityLimit === 3, "P2-1 最近工作数量契约不是 ISSUE 5 条 / 成熟度 3 个", issues);
  assert(includesAll(workspaceSource, ["recentIssues.slice(0, 5)", "projects.slice(0, 3)", "dashboard-overflow-menu", "ISSUE清单更多", "成熟度评估更多", "查看全部", "data-dashboard-issue-id"]), "P2-1 最近工作列表或更多菜单实现不完整", issues);
  assert(config.p2_1?.dashboardComposition?.rule === "recent-lists-are-subsections-not-the-whole-dashboard" && config.p2_1?.dashboardComposition?.forbiddenRegression === "flat-list-only-workbench", "P2-1 工作台整体与内部清单的层级契约未固化", issues);
  assert(config.p2_1?.dashboardComposition?.title === "工作事项" && config.p2_1?.dashboardComposition?.crossStreamSummary === "forbidden" && !config.p2_1?.dashboardComposition?.layers?.includes("work-status-overview"), "P2-1 ISSUE 与成熟度评估仍可能被混合统计", issues);
  assert(config.p2_1?.knowledgeLayout?.pattern === "asymmetric-six-tile-mosaic" && config.p2_1?.knowledgeLayout?.crossGrainAggregation === "forbidden", "P2-1 知识统计非对称区块契约未固化", issues);
  assert(includesAll(workspaceSource, ["工作事项", "renderWorkstreamLead", "dashboard-workstream-lead", "dashboard-workstream-list-head", "dashboard-workbench-foot", "处理架构评审问题", "继续客户评估项目", "继续处理", "继续评估"]), "P2-1 工作事项仍缺少独立工作流、快捷继续或分组摘要", issues);
  assert(excludesAll(workspaceSource, ["renderWorkbenchOverview", "dashboard-workbench-overview", "本地工作进度", "继续评审与评估", "ISSUE 总数"]), "P2-1 仍保留跨 ISSUE / 成熟度评估混合概览", issues);
  assert(excludesAll(workspaceSource, ["dashboard-workbench-card", ">进入<", "进入<em>工作台", "dashboard-workbench-updated"]), "P2-1 首页回退到旧大入口卡或重复更新时间", issues);
  assert(includesAll(appSource, ["function workbenchRecentIssueRows", "workbenchIssueDateValue(right) - workbenchIssueDateValue(left)", "dashboardIssueId", "options.workbenchIssueId", "{ workbenchIssueId: dashboardIssueId }", 'state.workbenchIssueSortKey = "updated"']), "P2-1 最近 ISSUE 排序或显式对象打开契约未固化", issues);
  assert(includesAll(maturitySource, ["function dashboardSnapshot(limit = 3)", "statisticsReadyForDisplay(detail)", "resultReadyCount", "resultReady", "ensureDashboardData()", "loadPromise"]), "P2-1 成熟度最近项目摘要未复用真实项目与正式统计口径", issues);
  assert(includesAll(cssSource, ["width: min(100%, 1560px)", "dashboard-insight-deck", "dashboard-workstream-lead", "dashboard-workstream-list-head", "dashboard-recent-row", "dashboard-overflow-popover", "dashboard-workbench-foot", "grid-template-columns: repeat(6, minmax(0, 1fr))", "data-dashboard-stat=\"capabilities\"", "data-dashboard-stat=\"services\"", "data-dashboard-stat=\"standards\"", "data-dashboard-stat=\"dictionaries\"", "tone-ocean", "tone-sunset", "tone-orchid", "oklch"]), "P2-1 Apple 工作事项或非对称知识统计样式不完整", issues);
  assert(!cssSource.includes("dashboard-workbench-overview"), "P2-1 混合工作进度样式仍残留", issues);

  assert(includesAll(directoryRenderSource, ['revealSelection = false', 'data-capability-directory-action="expand-all"', 'data-capability-directory-action="collapse-l0"']), "P2-2 能力目录默认收起或操作不完整", issues);
  assert(JSON.stringify(directoryActions) === JSON.stringify(["expand-all", "collapse-l0"]), `P2-2 能力目录工具栏必须且只能保留两个动作，实际为 ${directoryActions.join(",") || "空"}`, issues);
  assert(excludesAll(`${directorySource}\n${appSource}`, ["locate-recent", "capabilityDirectoryRecent", "rememberCapabilityDirectorySelection", "locateRecentCapabilityDirectorySelection", "定位最近", "目录层级", "默认全部收起"]), "P2-2 工具栏说明、最近定位控件或无用状态仍残留", issues);
  assert(includesAll(directorySource, ["hasSearchMatchBelowCapability", "hasSearchMatchBelowDomain", "hasSearchMatchBelowCategory"]), "P2-2 能力目录搜索祖先路径契约未固化", issues);
  assert(!directorySource.includes("Boolean(utils.text(search).trim())"), "P2-2 能力搜索仍触发全目录展开", issues);
  assert(includesAll(serviceSource, ['technical-service-maintenance-table:v5', "const expanded = expandAll || expandedGroups.has(id)"]), "P2-2 安全技术服务未默认收起", issues);
  assert(!serviceSource.includes("!hasSavedExpandedGroups") && !serviceSource.includes("groupHasSelectedService"), "P2-2 安全技术服务仍由旧状态或选中项自动展开", issues);
  assert(!moduleSource.includes("hasSelected(") && includesAll(moduleSource, ["const categoryExpanded = expandAll", "const systemExpanded = expandAll"]), "P2-2 安全技术模块未默认收起", issues);
  assert(!functionSource.includes("hasSelected(") && includesAll(functionSource, ["const layerExpanded = expandAll", "const groupExpanded = expandAll"]), "P2-2 工作职能未默认收起", issues);
  assert(!roleSource.includes("hasSelected(") && roleSource.includes("const expanded = expandAll"), "P2-2 岗位 / 职能参考未默认收起", issues);
  assert(standardSource.includes("const expanded = expandAll"), "P2-2 标准框架未默认收起", issues);
  assert(includesAll(cssSource, [":has(.capability-directory-maintenance-table)", "grid-template-rows: auto minmax(0, 1fr) auto", ".capability-directory-toolbar", "position: static", "justify-content: flex-end"]), "P2-2 能力目录工具栏布局未收敛", issues);
  assert(!/\.capability-directory-toolbar\s*\{[^}]*\b(?:padding|border|background|min-height)\s*:/s.test(cssSource), "P2-2 工具栏外框或占位样式仍残留", issues);

  assert(includesAll(guideSource, ["P2-3 V2: larger reading canvas", ".main { max-width: 1120px", "body { font-size: 17px", ".hero { height: 194px", ".section h2 { margin-bottom: 14px; font-size: 30px"]), "P2-3 阅读列、字号或封面密度未落地", issues);
  assert(appSource.includes("density=p2-3-guide-density-20260716-2"), "P2-3 指南 iframe 缓存版本未更新", issues);
  assert(includesAll(cssSource, ["grid-template-columns: 244px minmax(0, 1fr)", "min-height: 44px", "font-size: 14px"]), "P2-3 指南目录宽度或可读性未放大", issues);
  assert(includesAll(indexSource, ["p2-product-workspace.css?v=p2-product-workspace-20260717-8", "P2ProductWorkspace.js?v=p2-product-workspace-20260717-6-work-items-mosaic", "maturity-report-v2-authoring-20260718-1", "p2-workbench-dashboard-20260716-1", "p2-dashboard-header-20260716-1", "p2-default-collapse-20260716-1", "p2-dashboard-summary-20260716-1", "p2-2-directory-navigation-20260716-3"]), "P2 V8 入口或缓存版本不完整", issues);

  const forbiddenFields = ["raw_value", "source_file", "import_id", "source_id", "source_ref", "source_label", "generated_at", "metadata", "intermediate"];
  assert(excludesAll(`${workspaceSource}\n${directoryRenderSource}`, forbiddenFields), "P2 主展示区泄露非业务字段", issues);

  const baseUrl = argValue("--url");
  if (baseUrl) {
    try {
      const [liveIndex, liveApp, liveAppShell, liveDirectory, liveWorkspace, liveMaturity, liveCss, liveGuide, liveSummary] = await Promise.all([
        fetchText(baseUrl, "index.html"),
        fetchText(baseUrl, "app.js"),
        fetchText(baseUrl, "components/AppShell.js?v=p2-dashboard-header-20260716-1"),
        fetchText(baseUrl, "components/CapabilityDirectoryMaintenanceTable.js?v=p2-2-directory-navigation-20260716-3"),
        fetchText(baseUrl, "components/P2ProductWorkspace.js?v=p2-product-workspace-20260717-6-work-items-mosaic"),
        fetchText(baseUrl, "components/MaturityAssessmentWorkbench.js?v=maturity-report-v2-authoring-20260718-1"),
        fetchText(baseUrl, "p2-product-workspace.css?v=p2-product-workspace-20260717-8"),
        fetchText(baseUrl, "assets/guides/maturity-model-usage.html?embed=1&density=p2-3-guide-density-20260716-2"),
        fetchJson(baseUrl, "api/v1/dashboard/knowledge-summary"),
      ]);
      const summary = liveSummary?.data || liveSummary;
      assert(liveIndex.includes("p2-product-workspace-20260717-8") && liveIndex.includes("p2-product-workspace-20260717-6-work-items-mosaic") && liveIndex.includes("p2-workbench-dashboard-20260716-1") && liveIndex.includes("p2-dashboard-header-20260716-1") && liveIndex.includes("p2-2-directory-navigation-20260716-3"), "5173 未加载 P2 V8 入口", issues);
      assert(liveApp.includes("dashboardKnowledgeSummary") && liveApp.includes("workbenchRecentIssueRows(issueRows, 5)") && liveApp.includes("dashboardSnapshot?.(3)") && liveApp.includes("p2-3-guide-density-20260716-2") && !liveApp.includes("capabilityDirectoryRecent"), "5173 app 未接入 P2 V7", issues);
      assert(liveAppShell.includes("工作台与知识库概览") && liveAppShell.includes("hideTypeLabel: true"), "5173 AppShell 未加载首页单一标题契约", issues);
      assert(JSON.stringify(capabilityDirectoryActions(liveDirectory)) === JSON.stringify(["expand-all", "collapse-l0"]) && excludesAll(liveDirectory, ["定位最近", "目录层级", "默认全部收起"]), "5173 能力目录工具栏不是无外框双动作", issues);
      assert(liveWorkspace.includes("recentIssues.slice(0, 5)") && liveWorkspace.includes("projects.slice(0, 3)") && liveWorkspace.includes("工作事项") && !liveWorkspace.includes("dashboard-workbench-overview") && liveWorkspace.includes("dashboard-workstream-lead") && liveWorkspace.includes("dashboard-overflow-menu") && liveWorkspace.includes("KNOWLEDGE OBSERVATORY") && liveWorkspace.includes("指南与知识表达"), "5173 工作台组件不是 P2 V8", issues);
      assert(liveMaturity.includes("function dashboardSnapshot(limit = 3)") && liveMaturity.includes("statisticsReadyForDisplay(detail)") && liveMaturity.includes("resultReadyCount"), "5173 成熟度项目摘要不是正式统计口径", issues);
      assert(!liveCss.includes("dashboard-workbench-overview") && liveCss.includes("dashboard-workstream-lead") && liveCss.includes("dashboard-overflow-popover") && liveCss.includes("dashboard-workbench-foot") && liveCss.includes("dashboard-insight-deck") && liveCss.includes("grid-template-columns: repeat(6, minmax(0, 1fr))") && liveCss.includes("data-dashboard-stat=\"capabilities\"") && liveCss.includes("grid-template-rows: auto minmax(0, 1fr) auto") && liveCss.includes("justify-content: flex-end"), "5173 CSS 不是 P2 V8", issues);
      assert(liveGuide.includes("P2-3 V2: larger reading canvas") && liveGuide.includes("max-width: 1120px"), "5173 指南不是 P2-3 V2", issues);
      assert(summary?.data_state === "ready", "5173 轻量统计接口未就绪", issues);
      assert(summary?.environment?.information_environments === 10 && summary?.environment?.information_objects === 51 && summary?.environment?.scope_types === 6, "5173 环境 / 对象 / 作用域统计不符合权威投影", issues);
      assert(summary?.lifecycles?.lc_ap_stages === 8 && summary?.lifecycles?.lc_dt_stages === 7, "5173 生命周期阶段统计不符合权威投影", issues);
      assert(summary?.content?.html_documents === 3 && summary?.content?.diagram_views === 1 && summary?.content?.guide_pages === 2, "5173 指南与内容统计不符合权威投影", issues);
    } catch (error) {
      issues.push(`5173 P2 V8 运行态核对失败：${error.message}`);
    }
  }

  console.log(`contract=${config.version}`);
  console.log(`routes_checked=${config.routes.length}`);
  console.log(`knowledge_statistics_checked=${config.p2_1.statistics.length}`);
  console.log(`collapsed_families_checked=${config.p2_2.families.length}`);
  if (issues.length) {
    console.error("result=fail");
    issues.forEach((issue) => console.error(`issue=${issue}`));
    process.exit(1);
  }
  console.log("result=pass");
}

main();
