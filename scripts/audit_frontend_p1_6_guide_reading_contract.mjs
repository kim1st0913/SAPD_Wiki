#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const configPath = path.join(projectRoot, "config/frontend-p1-6-guide-reading.json");
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

function sectionSlice(source, startId, endId) {
  const start = source.indexOf(`id="${startId}"`);
  const end = source.indexOf(`id="${endId}"`, start + 1);
  return start >= 0 ? source.slice(start, end >= 0 ? end : undefined) : "";
}

async function fetchText(baseUrl, relativePath) {
  const response = await fetch(new URL(relativePath, `${baseUrl.replace(/\/$/, "")}/`), { cache: "no-store" });
  if (!response.ok) throw new Error(`${relativePath} HTTP ${response.status}`);
  return response.text();
}

async function main() {
  const issues = [];
  assert(existsSync(configPath), "缺少 P1-6 指南阅读配置", issues);
  const config = JSON.parse(readFileSync(configPath, "utf8"));
  const appSource = read("frontend/capability-browser/app.js");
  const appShellSource = read("frontend/capability-browser/components/AppShell.js");
  const guideSource = read("frontend/capability-browser/assets/guides/maturity-model-usage.html");
  const cssSource = read("frontend/capability-browser/p1-guide-reading.css");
  const indexSource = read("frontend/capability-browser/index.html");
  const prepareFrameSource = functionSlice(appSource, "prepareMaturityModelGuideFrame", "renderMaturityModelGuide");
  const toolSection = sectionSlice(guideSource, "tool", "scoring");
  const coverMatch = guideSource.match(/\.hero\s*\{([\s\S]*?)\n\s*\}/);
  const coverCss = coverMatch?.[1] || "";

  assert(config.navigationLabel === "成熟度模型使用指南", "指南目录名称不是成熟度模型使用指南", issues);
  assert(appShellSource.includes('label: "成熟度模型使用指南"') && !appShellSource.includes('label: "SAPD成熟度模型使用指南"') && !appShellSource.includes('label: "成熟度模型使用方法"'), "AppShell 指南目录名称未统一", issues);
  assert(appSource.includes('routeItem.label || "成熟度模型使用指南"') && !appSource.includes('routeItem.label || "SAPD成熟度模型使用指南"') && !appSource.includes('routeItem.label || "成熟度模型使用方法"'), "指南页面标题回退名称未统一", issues);
  assert(appSource.includes("maturity-model-usage.html?embed=1&v=p1-6-guide-navigation-20260721-1"), "指南 iframe 未使用最新导航版本", issues);
  assert(includesAll(appSource, ["sapd:maturity-guide:navigate", "sapd:maturity-guide:navigated", "handleMaturityModelGuideMessage", "postMessage"]), "App 指南目录缺少 iframe 双向导航协议", issues);
  assert(!prepareFrameSource.includes("createElement(\"style\")") && !prepareFrameSource.includes("sapd-wiki-maturity-embed-style"), "App 仍在外层强行改写 iframe 正文样式", issues);
  assert(includesAll(guideSource, ["document-cover", "document-meta", "document-entry-links", 'data-embed="true"', "URLSearchParams"]), "文档式封面或源文档嵌入模式不完整", issues);
  assert(includesAll(guideSource, config.chapterAnchors.map((anchor) => `id=\"${anchor}\"`)), "指南章节锚点不完整", issues);
  assert(includesAll(guideSource, ["sapd:maturity-guide:navigate", "sapd:maturity-guide:navigated", "scrollIntoView", "window.addEventListener('message'"]), "指南文档缺少桌面壳目录导航监听", issues);
  assert(includesAll(guideSource, config.featuredAnchors.map((anchor) => `href=\"#${anchor}\"`)), "封面重点章节入口不完整", issues);
  assert(includesAll(guideSource, ["SAPD 成熟度模型使用指南 v1.3", "版本 v1.3", "更新：2026-07-16"]), "指南版本或更新时间未升级到 v1.3", issues);
  assert(includesAll(toolSection, [
    "三步新建浮层",
    "项目概览、评估模板、评分执行、评分复核、评估结果、报告快照",
    "安全技术服务评估点",
    "关注点评估点",
    "组织与角色、制度与流程、平台与工具、数据与信息",
    "评估说明（可选）",
    "下级评估设置",
    "保存并转到下一项",
    "文件交换、匹配与人工审查",
    "不是日常在线评分的前置步骤",
  ]), "指南第 3 章未完整同步当前成熟度评估工具流程", issues);
  assert(!toolSection.includes("解析客户输入与证据") && !toolSection.includes("低置信度匹配进入人工审查"), "指南仍把旧解析与匹配路径写成默认主流程", issues);
  assert(coverCss.includes("height: 208px") && !coverCss.includes("gradient"), "指南封面高度不在 160—220px 或仍使用营销渐变", issues);
  assert(guideSource.includes(".section { margin-top: 20px; padding: 28px 0 4px; background: transparent; border: 0; border-top: 1px solid var(--line); border-radius: 0; box-shadow: none; }"), "指南章节仍逐节套卡", issues);
  assert(includesAll(cssSource, ["grid-template-columns: 210px minmax(0, 1fr)", "content-nav-pane", "content-list-pane", "maturity-guide-frame-shell"]), "App 指南目录与隔离文档两层结构不完整", issues);
  assert(config.download?.owner === "AppShell page header", "指南下载入口 owner 不是 AppShell 页面标题栏", issues);
  assert(config.download?.asset === "/assets/guides/maturity-model-usage.html", "指南下载资产不是权威自包含 HTML", issues);
  assert(config.download?.filename === "SAPD-成熟度模型使用指南-v1.3.html", "指南下载文件名与版本不一致", issues);
  assert(includesAll(appShellSource, [
    "GUIDE_DOWNLOADS",
    '"/guides/maturity-model-usage"',
    'href: "./assets/guides/maturity-model-usage.html"',
    'filename: "SAPD-成熟度模型使用指南-v1.3.html"',
    'class="page-header-actions guide-header-actions"',
    'class="maturity-guide-download"',
    'data-guide-download="',
    'download="',
  ]), "AppShell 指南下载操作契约不完整", issues);
  assert(includesAll(cssSource, ["app-page-header:has(.guide-header-actions)", "page-header-actions.guide-header-actions", "display: inline-flex", "maturity-guide-download", "min-height: 30px", "maturity-guide-download:focus-visible"]), "指南下载按钮可见性、样式或键盘焦点契约不完整", issues);
  assert(guideSource.includes("data:image/png;base64,"), "指南下载资产不是图片内嵌的自包含 HTML", issues);
  assert(!cssSource.includes("iframe .") && !cssSource.includes("contentDocument"), "App 指南样式越界改写 iframe 内容", issues);
  assert(includesAll(indexSource, ["p1-guide-reading.css?v=p1-6-guide-reading-20260716-3", "maturity-guide-name-20260716-2"]), "P1-6 样式入口或指南命名缓存版本未更新", issues);

  const baseUrl = argValue("--url");
  if (baseUrl) {
    try {
      const [liveIndex, liveCss, liveApp, liveAppShell, liveGuide, liveDownloadGuide] = await Promise.all([
        fetchText(baseUrl, "index.html"),
        fetchText(baseUrl, "p1-guide-reading.css?v=p1-6-guide-reading-20260716-3"),
        fetchText(baseUrl, "app.js?v=maturity-guide-name-20260716-2"),
        fetchText(baseUrl, "components/AppShell.js?v=maturity-guide-name-20260716-2"),
        fetchText(baseUrl, "assets/guides/maturity-model-usage.html?embed=1&v=p1-6-document-cover-20260714-1"),
        fetchText(baseUrl, "assets/guides/maturity-model-usage.html"),
      ]);
      assert(liveIndex.includes("p1-guide-reading.css?v=p1-6-guide-reading-20260716-3"), "5173 未加载 P1-6 下载按钮样式", issues);
      assert(includesAll(liveCss, ["maturity-guide-frame-shell", "page-header-actions.guide-header-actions", "maturity-guide-download"]), "5173 指南壳层或下载按钮样式不是 P1-6 V2", issues);
      assert(liveApp.includes("p1-6-guide-navigation-20260721-1") && liveApp.includes("sapd:maturity-guide:navigate") && liveApp.includes('routeItem.label || "成熟度模型使用指南"') && !liveApp.includes('routeItem.label || "SAPD成熟度模型使用指南"'), "5173 app 未加载指南导航或命名版本", issues);
      assert(includesAll(liveAppShell, ["GUIDE_DOWNLOADS", "maturity-guide-download", "SAPD-成熟度模型使用指南-v1.3.html", 'label: "成熟度模型使用指南"']) && !liveAppShell.includes('label: "SAPD成熟度模型使用指南"') && !liveAppShell.includes('label: "成熟度模型使用方法"'), "5173 AppShell 未加载指南下载或目录命名契约", issues);
      const liveCoverCss = liveGuide.match(/\.hero\s*\{([\s\S]*?)\n\s*\}/)?.[1] || "";
      assert(liveGuide.includes("document-cover") && liveCoverCss.includes("height: 208px") && !liveCoverCss.includes("gradient"), "5173 指南源文档不是 P1-6 文档封面", issues);
      assert(includesAll(liveGuide, ["sapd:maturity-guide:navigate", "sapd:maturity-guide:navigated", "scrollIntoView"]), "5173 指南源文档缺少目录导航协议", issues);
      assert(includesAll(sectionSlice(liveGuide, "tool", "scoring"), ["三步新建浮层", "保存并转到下一项", "文件交换、匹配与人工审查"]), "5173 指南第 3 章不是当前评估工具流程", issues);
      assert(liveDownloadGuide.includes("SAPD 成熟度模型使用指南 v1.3") && liveDownloadGuide.includes("data:image/png;base64,"), "5173 下载资产不是完整 v1.3 自包含指南", issues);
    } catch (error) {
      issues.push(`5173 P1-6 运行态核对失败：${error.message}`);
    }
  }

  console.log(`contract=${config.version}`);
  console.log(`route=${config.route}`);
  console.log(`chapter_anchors=${config.chapterAnchors.length}`);
  console.log(`download_asset=${config.download?.asset || "missing"}`);
  if (issues.length) {
    console.error("result=fail");
    issues.forEach((issue) => console.error(`issue=${issue}`));
    process.exit(1);
  }
  console.log("result=pass");
}

main();
