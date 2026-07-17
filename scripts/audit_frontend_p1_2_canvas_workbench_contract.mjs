#!/usr/bin/env node

import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const configPath = path.join(projectRoot, "config/frontend-p1-2-canvas-workbench.json");
const read = (relativePath) => readFileSync(path.join(projectRoot, relativePath), "utf8");
const assert = (condition, message, issues) => {
  if (!condition) issues.push(message);
};
const includesAll = (source, values) => values.every((value) => source.includes(value));
const sha256 = (relativePath) => createHash("sha256").update(readFileSync(path.join(projectRoot, relativePath))).digest("hex");
const argValue = (name) => {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] || "" : "";
};

async function fetchText(baseUrl, relativePath) {
  const response = await fetch(new URL(relativePath, `${baseUrl.replace(/\/$/, "")}/`), { cache: "no-store" });
  if (!response.ok) throw new Error(`${relativePath} HTTP ${response.status}`);
  return response.text();
}

async function main() {
  const issues = [];
  assert(existsSync(configPath), "缺少 P1-2 双画布工作台配置", issues);
  const config = JSON.parse(readFileSync(configPath, "utf8"));
  const appSource = read("frontend/capability-browser/app.js");
  const shellSource = read("frontend/capability-browser/components/AppShell.js");
  const environmentSource = read("frontend/capability-browser/components/EnvironmentBasemapViewer.js");
  const cssSource = read("frontend/capability-browser/p1-canvas-workbench.css");
  const stylesSource = read("frontend/capability-browser/styles.css");
  const indexSource = read("frontend/capability-browser/index.html");
  const oi159Start = stylesSource.indexOf("/* OI-159 revision: Apple shell workspace-attached capability controls. */");
  const oi159Source = oi159Start >= 0 ? stylesSource.slice(oi159Start, oi159Start + 7000) : "";

  const controlHeadStart = shellSource.indexOf('<div class="capability-workspace-control page-local-search-toolbar"');
  const controlHeadEnd = shellSource.indexOf('</div>\n          <div id="detail"', controlHeadStart);
  const controlHeadSource = controlHeadStart >= 0 && controlHeadEnd > controlHeadStart ? shellSource.slice(controlHeadStart, controlHeadEnd) : "";
  assert(shellSource.includes('<div class="capability-workbench-head">\n          <div id="capabilityFocusHeader" class="capability-focus-head-slot"></div>'), "能力对象标题未恢复到图 2 的独立工作台头", issues);
  assert(includesAll(controlHeadSource, ['id="capabilityViewControls"', 'id="capabilitySearchInput"']) && !controlHeadSource.includes('id="capabilityFocusHeader"'), "能力页 Tab 与搜索未形成独立控制头，或对象标题仍被塞入控制头", issues);
  assert(shellSource.split('class="capability-workbench-head"').length - 1 === 1, "能力页仍存在重复对象标题头", issues);
  assert(includesAll(appSource, ["capabilityCatalogNarrowExpanded", "(max-width: 1099px)", '"240px 6px minmax(760px, 1fr)"', "return [240, rest(240)]"]), "能力目录 240px 与窄屏自动折叠契约不完整", issues);
  assert(config.capability.directoryRange[0] === 220 && config.capability.directoryRange[1] === 300, "能力目录配置未锁定 220—300px", issues);
  assert(includesAll(appSource, ["Math.min(300, Math.max(220", "Math.max(760, pairWidth - nextWidths[index])"]), "能力目录拖拽未执行 220—300px 边界或未保护主画布宽度", issues);
  assert(includesAll(cssSource, ["grid-template-columns: 240px 6px minmax(760px, 1fr)", "calc(100dvh - 258px)"]), "能力目录 / resizer / 主画布轨道或可用高度不完整", issues);
  assert(config.capability.visualAuthority.includes("Figure 2") && config.capability.objectHeaderPlacement.startsWith("above-canvas-surface") && config.capability.surfaceRadius === 26 && config.capability.canvasRadius === 18, "P1-2 未记录图 2 的对象标题层级与 OI-159 视觉真值", issues);
  assert(includesAll(oi159Source, ["border-radius: 26px", "display: flex", "border-radius: 25px 25px 0 0", "border-radius: 18px", "padding: 14px"]), "能力页成熟 OI-159 单行控制头或两级圆角基线缺失", issues);
  assert(!cssSource.includes(".capability-workspace-surface {") && !cssSource.includes(".capability-workbench-head.capability-workspace-control") && !cssSource.includes(".preview-relation-stage"), "P1-2 再次越界覆盖能力页成熟视觉基线", issues);
  assert(cssSource.includes("grid-template-rows: auto minmax(0, 1fr)"), "能力对象标题层与画布层未按图 2 分成两行", issues);
  assert(includesAll(environmentSource, config.environment.actions.map((action) => `data-basemap-lab-action=\"${action}\"`)), "环境画布工具缺少适应、100%、缩放、返回焦点或全屏动作", issues);
  assert(includesAll(environmentSource, ["lastFocusedMxId", "focusNodeInViewport", "data-basemap-detail-drawer", "has-detail", "preventScroll: true"]), "环境目标定位、按需详情或返回焦点链路不完整", issues);
  assert(includesAll(cssSource, ["grid-template-columns: minmax(0, 1fr) 0", "environment-basemap-lab-shell.has-detail", "basemap-node-detail-drawer"]), "环境详情空闲零宽或外置抽屉契约不完整", issues);
  assert(config.environment.singleContour === true && config.environment.singleContourOwner === ".environment-detail-pane" && config.environment.childSurfaceRadius === 0, "环境双 Tab 未锁定单一外轮廓所有者", issues);
  assert(config.capability.referenceImageContract?.border === "explicit-image-element-hairline-four-edges" && config.capability.referenceImageContract?.fit === "intrinsic-image-box-within-both-available-axes" && config.capability.referenceImageContract?.height === "responsive-within-summary-pane-no-scroll" && config.capability.referenceImageContract?.rootLayout === "reference-priority-full-width-single-pane" && config.environment.sectionNavigation === "global-apple-shell-segmented-capsule-placement-invariant", "P1-2 未记录图片元素四边框、根能力全宽单区、双轴适应或全局 Apple Shell 胶囊导航位置不变契约", issues);
  assert(includesAll(cssSource, ["width: min(100%, 1600px)", ".preview-tab-panel:has(.capability-overview-summary-shell)", "overflow: hidden", ".capability-overview-summary-shell:has(.capability-overview-children-pane.has-sliding-scale)", "grid-template-rows: minmax(0, 1fr)", ".capability-overview-summary-grid:has(.capability-overview-children-pane.has-sliding-scale)", "grid-template-columns: minmax(0, 1fr)", ".capability-sliding-scale-reference img", "position: static", "width: auto", "height: auto", "max-width: 100%", "max-height: 100%", "object-fit: contain", "border: 1px solid rgba(53, 63, 76, 0.72)"]), "参考图未在根能力全宽单区内用图片实际缩放盒绘制完整四边框，或仍依赖局部滚动", issues);
  assert(!includesAll(cssSource, [".capability-sliding-scale-reference img", "position: absolute", "inset: 0"]), "参考图仍以填满容器的绝对定位盒冒充图片实际边界", issues);
  assert(!cssSource.includes(".environment-title-tabs .environment-page-tabs"), "P1-2 仍以局部线型样式覆盖全局环境胶囊导航", issues);
  assert(includesAll(stylesSource, [".app-shell-integrated .maintenance-section-tabs", "min-height: 42px", "padding: 4px", "border-radius: 16px", ".app-shell-integrated .maintenance-section-tabs button", "min-height: 34px", "padding: 0 13px", "border-radius: 12px"]), "全局 Apple Shell 胶囊导航 42/34px 几何基线缺失", issues);
  assert(!stylesSource.includes(".app-shell-integrated #appPageHeader .maintenance-section-tabs"), "页面标题位置仍私自压缩全局 Apple Shell 胶囊导航", issues);
  assert(
    includesAll(cssSource, [
      ".environment-workspace .environment-detail-pane",
      ".environment-workspace .environment-relation-map.environment-tabbed-map",
      ".environment-workspace .environment-tab-panels",
      ".environment-workspace .environment-tab-panel",
      ".environment-basemap-lab-main",
      "border-radius: 0",
      "isolation: isolate",
    ]),
    "环境双 Tab 子容器去边框 / 去圆角或父外壳裁切契约不完整",
    issues,
  );
  assert(!environmentSource.includes('data-basemap-lab-action="reset"'), "环境工具仍把适应误标为还原", issues);
  assert(indexSource.includes("p1-canvas-workbench.css?v=p1-2-canvas-workbench-20260715-3"), "P1-2 样式入口或缓存版本未更新", issues);

  for (const [relativePath, expected] of Object.entries(config.frozenArtifacts)) {
    assert(existsSync(path.join(projectRoot, relativePath)), `冻结对象不存在：${relativePath}`, issues);
    if (existsSync(path.join(projectRoot, relativePath))) {
      assert(sha256(relativePath) === expected, `P1-2 越界修改冻结对象：${relativePath}`, issues);
    }
  }

  const forbiddenArtifacts = [
    "frontend/capability-browser/components/CapabilityGraphLayoutController.js",
    "config/frontend-p0-3-capability-graph-collision.json",
    "scripts/audit_frontend_p0_3_capability_graph_collision_contract.mjs",
  ];
  forbiddenArtifacts.forEach((relativePath) => assert(!existsSync(path.join(projectRoot, relativePath)), `P1-2 重新引入已回退的 P0-3 文件：${relativePath}`, issues));

  const baseUrl = argValue("--url");
  if (baseUrl) {
    try {
      const [liveIndex, liveCss, liveStyles, liveEnvironment] = await Promise.all([
        fetchText(baseUrl, "index.html"),
        fetchText(baseUrl, "p1-canvas-workbench.css?v=p1-2-canvas-workbench-20260715-3"),
        fetchText(baseUrl, "styles.css"),
        fetchText(baseUrl, "components/EnvironmentBasemapViewer.js?v=p1-2-canvas-workbench-20260714-2"),
      ]);
      assert(liveIndex.includes("p1-canvas-workbench.css?v=p1-2-canvas-workbench-20260715-3"), "5173 未加载 P1-2 V11 样式", issues);
      assert(liveCss.includes("P1-2 V11") && liveCss.includes("grid-template-columns: 240px 6px minmax(760px, 1fr)"), "5173 双画布基础样式不是 P1-2 V11 版本", issues);
      assert(liveCss.includes("position: static") && liveCss.includes("border: 1px solid rgba(53, 63, 76, 0.72)") && liveCss.includes(".capability-overview-summary-grid:has(.capability-overview-children-pane.has-sliding-scale)"), "5173 未加载参考图实际图片盒四边框与根能力全宽适应修复", issues);
      assert(!liveStyles.includes(".app-shell-integrated #appPageHeader .maintenance-section-tabs"), "5173 仍以标题区局部规则压缩全局胶囊导航", issues);
      assert(!liveCss.includes(".environment-title-tabs .environment-page-tabs"), "5173 仍加载环境线型局部覆盖", issues);
      assert(liveCss.includes("exactly one outer contour owner") && liveCss.includes(".environment-workspace .environment-relation-map.environment-tabbed-map"), "5173 未加载环境单一外轮廓修复", issues);
      assert(liveStyles.includes("border-radius: 26px") && liveStyles.includes("border-radius: 25px 25px 0 0"), "5173 未保留图 2 的 OI-159 圆角基线", issues);
      assert(liveEnvironment.includes("focusNodeInViewport"), "5173 环境画布组件不是 P1-2 版本", issues);
    } catch (error) {
      issues.push(`5173 P1-2 运行态核对失败：${error.message}`);
    }
  }

  console.log(`contract=${config.version}`);
  console.log(`routes=${config.routes.join(",")}`);
  console.log(`frozen_artifacts=${Object.keys(config.frozenArtifacts).length}`);
  if (issues.length) {
    console.error("result=fail");
    issues.forEach((issue) => console.error(`issue=${issue}`));
    process.exit(1);
  }
  console.log("result=pass");
}

main();
