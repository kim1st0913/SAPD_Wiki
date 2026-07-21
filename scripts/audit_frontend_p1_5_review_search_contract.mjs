#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const configPath = path.join(projectRoot, "config/frontend-p1-5-review-search.json");
const read = (relativePath) => readFileSync(path.join(projectRoot, relativePath), "utf8");
const assert = (condition, message, issues) => {
  if (!condition) issues.push(message);
};
const includesAll = (source, values) => values.every((value) => source.includes(value));
const argValue = (name) => {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] || "" : "";
};

function functionSlice(source, startName, endName) {
  const start = source.indexOf(`function ${startName}`);
  const end = source.indexOf(`function ${endName}`, start + 1);
  return start >= 0 ? source.slice(start, end >= 0 ? end : undefined) : "";
}

async function fetchText(baseUrl, relativePath) {
  const response = await fetch(new URL(relativePath, `${baseUrl.replace(/\/$/, "")}/`), { cache: "no-store" });
  if (!response.ok) throw new Error(`${relativePath} HTTP ${response.status}`);
  return response.text();
}

async function main() {
  const issues = [];
  assert(existsSync(configPath), "缺少 P1-5 Issue/搜索配置", issues);
  const config = JSON.parse(readFileSync(configPath, "utf8"));
  const appSource = read("frontend/capability-browser/app.js");
  const dataClientSource = read("frontend/capability-browser/dataClient.js");
  const apiSource = read("src/sapd_wiki/api_server.py");
  const packagedServerSource = read("scripts/run_local_server.py");
  const macosWrapperSource = read("apps/macos/SAPDWiki/Sources/SAPDWiki/main.swift");
  const cssSource = read("frontend/capability-browser/p1-review-search.css");
  const stylesSource = read("frontend/capability-browser/styles.css");
  const indexSource = read("frontend/capability-browser/index.html");
  const issueItemSource = functionSlice(appSource, "renderWorkbenchIssueItem", "workbenchIssuePageObjectLabel");
  const issueWorkspaceSource = functionSlice(appSource, "renderWorkbenchIssues", "renderWorkbenchMaturity");
  const searchPageSource = functionSlice(appSource, "renderSearchPage", "renderPlaceholder");
  const clearFiltersStart = appSource.indexOf('const clearFiltersButton = event.target.closest("[data-review-clear-filters]")');
  const clearFiltersEnd = appSource.indexOf('const bulkStatusButton = event.target.closest("[data-review-bulk-status]")', clearFiltersStart);
  const clearFiltersSource = clearFiltersStart >= 0 ? appSource.slice(clearFiltersStart, clearFiltersEnd >= 0 ? clearFiltersEnd : undefined) : "";

  assert(config.issueWorkspace?.listLabel === "ISSUE清单" && includesAll(appSource, ['aria-label="ISSUE清单"', "不会再出现在 ISSUE清单"]) && !appSource.includes("Issue 清单"), "Issue 列表名称未统一为 ISSUE清单", issues);
  assert(includesAll(appSource, config.issueColumns.filter((key) => key !== "select").map((key) => key === "title" ? "issue-column-title" : `issue-column-${key}`)), "Issue 默认列类未完整覆盖清单、页面/对象、状态、优先级和更新时间", issues);
  assert(!issueItemSource.includes("<article"), "普通 Issue 仍使用独立卡片语义", issues);
  assert(includesAll(cssSource, ["overflow-x: hidden", "workbench-review-item", "border-bottom: 1px solid", "workbench-review-queue", "border-radius: 14px"]), "Issue 队列无横向滚动、共享表面或分隔行契约不完整", issues);
  assert(config.issueWorkspace?.toolbar === "status-priority-filters-plus-canonical-page-search" && includesAll(issueWorkspaceSource, ["workbench-review-filter-field", "优先级", "workbench-review-search-shell"]), "Issue 筛选未形成状态、优先级加标准局部搜索的单行层级", issues);
  assert(config.issueWorkspace?.scopeOwner === "left-directory-only" && includesAll(issueWorkspaceSource, ["workbench-review-scope", 'data-review-page-route="全部"']) && !issueWorkspaceSource.includes('data-review-filter-control="page"') && !issueWorkspaceSource.includes('<span>Issue 范围</span><select'), "Issue 页面范围未收敛为左侧目录唯一入口", issues);
  assert(clearFiltersSource && !issueWorkspaceSource.includes('{ label: "Issue 范围"') && !appSource.includes('if (control === "page") state.workbenchIssuePageFilter') && !clearFiltersSource.includes("state.workbenchIssuePageFilter"), "顶部筛选或清除筛选仍可绕过左侧目录修改 Issue 范围", issues);
  assert(config.issueWorkspace?.searchControl === "global-page-search-control-with-match-navigation" && config.issueWorkspace?.searchMatchGrain === "filtered-issue-objects-by-stable-id" && includesAll(issueWorkspaceSource, ["workbench-review-search-control page-search-control", "page-search-input-shell", 'id="workbenchIssueSearchInput"', "page-search-match-status", 'data-page-search-step="-1"', 'data-page-search-step="1"']) && includesAll(stylesSource, [".app-shell-integrated .workbench-review-search-control.page-search-control", "border-radius: 999px"]), "Issue 搜索未复用包含计数与前后箭头的全局页面搜索组件", issues);
  assert(!issueWorkspaceSource.includes("workbench-review-filter-label"), "Issue 搜索仍保留全局组件之外的私有“关键词”标题", issues);
  assert(includesAll(appSource, ["WORKBENCH_ISSUE_SEARCH_SCOPE", "syncWorkbenchIssueSearchNavigation", "moveWorkbenchIssueSearchMatch", "rows.map((issue) => ({ id: issue.id, title: issue.title }))", "state.workbenchSelectedIssueId = rows[nextIndex].id"]), "Issue 搜索箭头未按筛选后 Issue 稳定 ID 导航", issues);
  assert(!cssSource.includes(".workbench-issues-route .workbench-review-search-control.page-search-control {\n  width: 100%;\n  grid-template-columns"), "Issue 私有样式仍把全局搜索组件压成单列并隐藏计数/箭头", issues);
  assert(includesAll(cssSource, ["grid-template-columns: 116px 116px minmax(var(--page-local-search-width), 1fr) auto", ".workbench-review-active-filters:empty", "display: none"]), "移除重复范围控件后工具栏未回收列宽，或无筛选时仍显示冗余状态块", issues);
  assert(config.issueWorkspace?.exportDestination?.web === "browser-download-setting" && config.issueWorkspace?.exportDestination?.app === "configured-download-directory" && config.issueWorkspace?.exportDestination?.successRequires === "blob-download-or-output-path", "Issue 导出目的地配置未区分 Web 浏览器下载与 App 配置目录", issues);
  assert(includesAll(dataClientSource, ["shouldSaveExportToConfiguredDirectory", "health?.state?.bundle_root", 'query.set("download", "1")', 'query.set("save", "1")', "new Blob([content]", "return normalizeUserPayload(await response.json())"]), "Issue 导出未按运行面自动选择浏览器下载或 App 配置目录", issues);
  assert(includesAll(appSource, ["issueExportSuccessState", "downloadBlobFile(result.blob, result.filename)", "保存位置由浏览器下载设置决定", "导出服务未返回文件下载路径", "result?.output_path || result?.data?.output_path"]), "Issue 导出成功态未校验浏览器 Blob 下载或 App 实际路径", issues);
  assert(includesAll(apiSource, ["/api/v1/user/exports/markdown", "def save_markdown_export", "def save_user_notes_export", "should_save"]), "App 配置目录保存接口不完整", issues);
  assert(includesAll(packagedServerSource, ["self.export_dir = self.resolve_export_dir(self.config.get(\"download_dir\"))", 'self.export_category_dir("issues")', '"output_path": str(output_path)', '"download_dir": str(self.export_dir)']) && includesAll(macosWrapperSource, ['title: "导出文件夹"', "changeDownloadPath", 'object["download_dir"] = settings.downloadDirectory.path']), "macOS App 未把用户选择的导出文件夹及 Issue 分类目录写入运行时配置", issues);
  assert(indexSource.split('id="searchInput"').length - 1 === 1, "顶部全局搜索输入框数量不是 1", issues);
  assert(!appSource.includes('id="searchPageQueryInput"') && !appSource.includes("data-search-page-submit"), "搜索结果页仍存在第二主搜索框", issues);
  assert(searchPageSource.includes("global-search-page-context") && searchPageSource.includes("aria-pressed"), "搜索结果页缺少当前查询上下文或分面状态", issues);
  assert(config.searchContract.contextAlignment === "centered-consistent" && includesAll(cssSource, [".global-search-page-context", "justify-content: center", "margin-inline-start: 0"]), "搜索查询提示在不同结果页中的对齐契约不一致", issues);
  assert(appSource.includes("function highlightFirstSearchText") && searchPageSource.includes("highlightFirstSearchText"), "结果摘要未限制为首个命中高亮", issues);
  assert(appSource.includes("GLOBAL_SEARCH_PAGE_SIZE = 20"), "搜索结果页每页数量不是 20", issues);
  assert(includesAll(appSource, ["globalSearchPageStateKey", "rememberGlobalSearchPageScroll", "restoreGlobalSearchPageScroll", "globalSearchPageScrollPositions", "globalSearchPageFilter", "globalSearchPageIndex"]), "搜索 query/filter/page/scrollTop 恢复链路不完整", issues);
  assert(includesAll(appSource, config.resultIdentity.map((key) => `result.${key}`)), "搜索结果稳定身份字段被削弱", issues);
  assert(includesAll(cssSource, ["global-search-page-row", "content: none", "global-search-page-results", "overscroll-behavior: contain"]), "搜索结果分隔列表或局部滚动样式不完整", issues);
  assert(includesAll(indexSource, ["p1-review-search.css?v=p1-5-review-search-20260715-5", "p1-issue-export-20260715-1", "p1-5-review-scope-owner-20260715-1", "issue-list-name-20260716-1"]), "P1-5 样式、脚本、命名或导出缓存版本未更新", issues);
  for (const source of [issueItemSource, searchPageSource]) {
    for (const forbidden of ["raw_value", "source_file", "import_id", "source_id", "source_ref", "source_label", "debug", "metadata", "intermediate", "generated_at"]) {
      assert(!source.includes(forbidden), `Issue/搜索主展示泄露非业务字段：${forbidden}`, issues);
    }
  }

  const baseUrl = argValue("--url");
  if (baseUrl) {
    try {
      const [liveIndex, liveApp, liveCss] = await Promise.all([
        fetchText(baseUrl, "index.html"),
        fetchText(baseUrl, "app.js"),
        fetchText(baseUrl, "p1-review-search.css?v=p1-5-review-search-20260715-5"),
      ]);
      assert(liveIndex.includes("p1-review-search.css?v=p1-5-review-search-20260715-5") && liveIndex.includes("p1-5-review-scope-owner-20260715-1") && liveIndex.includes("issue-list-name-20260716-1"), "5173 未加载 P1-5 V6 样式或脚本", issues);
      assert(liveApp.includes("restoreGlobalSearchPageScroll"), "5173 app 不是 P1-5 版本", issues);
      assert(liveApp.includes("moveWorkbenchIssueSearchMatch") && liveApp.includes('aria-label="ISSUE清单"') && !liveApp.includes("Issue 清单") && !liveApp.includes('data-review-filter-control="page"') && liveCss.includes("P1-5 V5") && liveCss.includes("workbench-review-search-control.page-search-control"), "5173 Issue/搜索样式、命名、范围所有者或导航逻辑不是 P1-5 V6", issues);
    } catch (error) {
      issues.push(`5173 P1-5 运行态核对失败：${error.message}`);
    }
  }

  console.log(`contract=${config.version}`);
  console.log(`routes=${config.routes.join(",")}`);
  console.log(`search_page_size=${config.searchContract.pageSize}`);
  if (issues.length) {
    console.error("result=fail");
    issues.forEach((issue) => console.error(`issue=${issue}`));
    process.exit(1);
  }
  console.log("result=pass");
}

main();
