#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const configPath = path.join(projectRoot, "config/frontend-p1-3-lifecycle-workbench.json");
const read = (relativePath) => readFileSync(path.join(projectRoot, relativePath), "utf8");
const readJson = (relativePath) => JSON.parse(read(relativePath));
const argValue = (name) => {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] || "" : "";
};
const assert = (condition, message, issues) => {
  if (!condition) issues.push(message);
};
const includesAll = (source, values) => values.every((value) => source.includes(value));
const purePlaceholderText = />\s*[\/／\-‐‑‒–―－]\s*</u;

function assertNoLegacyPlaceholder(html, label, issues) {
  assert(!purePlaceholderText.test(html), `${label} 仍输出 / 或 - 作为空值`, issues);
}

async function fetchText(baseUrl, relativePath) {
  const response = await fetch(new URL(relativePath, `${baseUrl.replace(/\/$/, "")}/`), { cache: "no-store" });
  if (!response.ok) throw new Error(`${relativePath} HTTP ${response.status}`);
  return response.text();
}

async function main() {
  const issues = [];
  assert(existsSync(configPath), "缺少 P1-3 生命周期工作台配置", issues);
  const config = JSON.parse(readFileSync(configPath, "utf8"));
  const componentSource = read("frontend/capability-browser/components/ApplicationSecurityLifecycle.js");
  const viewModelsSource = read("frontend/capability-browser/viewModels.js");
  const cssSource = read("frontend/capability-browser/p1-lifecycle-workbench.css");
  const indexSource = read("frontend/capability-browser/index.html");

  const context = {
    window: {
      sapdDisplay: {},
      sapdComponents: {
        utils: {
          list: (value) => (Array.isArray(value) ? value : value == null ? [] : [value]),
          escapeHtml: (value) => String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;"),
          titleOf: (value, fallback = "") => (value && typeof value === "object" ? value.title || value.name || value.code || fallback : String(value ?? fallback)),
        },
      },
    },
  };
  vm.runInNewContext(componentSource, context, { filename: "ApplicationSecurityLifecycle.js" });
  const component = context.window.sapdComponents.ApplicationSecurityLifecycle;
  const overview = component?.renderStageOverview({
    stageOverview: {
      code: "LC-AP-01",
      title: "需求与规划",
      description: "确认当前开发阶段的业务上下文。",
      status: "当前阶段",
      facts: [{ label: "主要活动", value: 3 }, { label: "安全活动", value: 2 }],
    },
  }) || "";
  assert(includesAll(overview, ["lifecycle-stage-context", "LC-AP-01", "需求与规划", "主要活动"]), "当前阶段上下文未完整呈现编码、名称、定义与事实", issues);
  assert(componentSource.includes('const EMPTY_VALUE = "—"'), "缺失值仍未统一为中文语义破折号", issues);
  assert(includesAll(componentSource, ["EMPTY_PLACEHOLDER_PATTERN", "isEmptyDisplayValue", "String(value ?? \"\")"]), "缺少统一纯斜杠/横线空值判定", issues);
  assert(!componentSource.includes('const EMPTY_VALUE = "/"'), "生命周期表格仍把 / 作为缺失值", issues);
  assert(!componentSource.includes('fallback = "/"'), "生命周期标题 fallback 仍把 / 作为缺失值", issues);
  for (const section of [...config.requiredSections["LC-AP"], ...config.requiredSections["LC-DT"]]) {
    assert(componentSource.includes(section), `缺少生命周期分区：${section}`, issues);
  }
  assert(!componentSource.includes("横向滚动查看更多字段") && !componentSource.includes("lifecycle-scroll-hint"), "生命周期宽表仍输出横向滚动提示", issues);
  const stageContextBlock = cssSource.match(/\.lifecycle-stage-context\s*\{([^}]*)\}/s)?.[1] || "";
  assert(stageContextBlock.includes("position: relative") && !stageContextBlock.includes("position: sticky"), "当前阶段上下文仍会 sticky 覆盖后续分区标题", issues);
  assert(includesAll(cssSource, ["overflow-x: auto", "overflow-y: hidden", "overflow-y: auto", "scrollbar-gutter: auto", "contain: layout paint style", "overscroll-behavior-y: contain", "position: static", "font-size: 13px", "overflow-x: hidden"]), "单轴横向滚动、隔离纵向 owner、非粘滞表格或字号契约不完整", issues);
  assert(!cssSource.includes("position: sticky"), "生命周期表格仍包含会放大纵向重绘的 sticky 单元格", issues);
  assert(!cssSource.includes("lifecycle-scroll-hint"), "生命周期样式仍保留已删除的横向滚动提示", issues);
  assert(includesAll(cssSource, ["min-width: 1280px", "min-width: 1480px", "min-width: 1040px", "min-width: 1560px"]), "生命周期宽表未恢复既有列宽基线", issues);
  assert(!cssSource.includes("width: max("), "生命周期表格仍使用易产生尾部空白的 width:max() 覆盖", issues);
  assert(!cssSource.includes("scrollbar-gutter: stable"), "横向滚动 owner 仍保留无效纵向 gutter", issues);
  assert(viewModelsSource.includes("canonicalLifecycleSecurityTechnologyItems"), "生命周期模块展示未接入 canonical 字典引用解析", issues);
  assert(!viewModelsSource.includes('title: line,\n        name: line,\n        objectKind: isMeasure'), "生命周期 ViewModel 仍会从原始文本伪造模块对象", issues);
  assert(includesAll(indexSource, ["p1-lifecycle-workbench.css?v=p1-3-lifecycle-workbench-20260714-3", "p1-3-lifecycle-workbench-20260714-2", "lifecycle-canonical-module-reference-20260714-1"]), "P1-3 样式、组件或 ViewModel 缓存版本未更新", issues);
  assert(includesAll(config.localScrollContract || [], ["lane_vertical_scroll_owner", "compositor_isolated_vertical_owner", "non_sticky_table_cells", "no_horizontal_hint"]), "P1-3 V3 滚动性能契约未写入配置", issues);
  assert(config.emptyDisplay === "—" && config.preserveBusinessPunctuation === true, "P1-3 V3 空值或业务标点保留契约不完整", issues);

  const placeholderProbe = component.renderStageOverview({
    stageOverview: { code: "LC-AP-X", title: "/", description: "-", status: "当前阶段", facts: [{ label: "保留数值", value: 0 }, { label: "忽略占位", value: "/" }] },
  });
  assertNoLegacyPlaceholder(placeholderProbe, "空值黄金样例", issues);
  assert((placeholderProbe.match(/>—</g) || []).length >= 2, "纯 / 与 - 未统一渲染为 —", issues);
  assert(placeholderProbe.includes(">0<"), "合法数值 0 被空值规则误删", issues);

  const viewModelContext = {
    window: {
      sapdDisplay: {
        label: (_key, fallback) => fallback,
        relationLabel: () => "",
        state: (_key, fallback) => fallback,
      },
    },
  };
  vm.runInNewContext(viewModelsSource, viewModelContext, { filename: "viewModels.js" });
  const viewModels = viewModelContext.window.sapdViewModels;
  const lifecycleWorkbench = readJson("frontend/capability-browser/public/data/lifecycle-workbench.json");
  const lifecycleKnowledge = readJson("frontend/capability-browser/public/data/lifecycle-knowledge.json");
  const moduleDictionary = readJson("frontend/capability-browser/public/data/maintenance/modules.json");
  const canonicalModules = new Map((moduleDictionary.security_technology_modules || []).map((item) => [String(item.id || ""), item]));
  const workbenchModules = Object.values(lifecycleWorkbench.objects?.security_technology_module || {});
  for (const module of workbenchModules) {
    assert(Boolean(module?.id) && canonicalModules.has(String(module.id)), `生命周期投影模块未解析到字典 ID：${module?.title || module?.name || module?.id || "unknown"}`, issues);
  }
  const lifecycleWorkbenchViewModel = viewModels.buildLifecycleWorkbenchViewModel({ workbench: lifecycleWorkbench });
  const applicationStages = Object.values(lifecycleWorkbench.objects?.lifecycle_stage || {}).filter(
    (stage) => !stage.lifecycleType || stage.lifecycleType === "application_security_development",
  );
  const dataStages = Object.values(lifecycleWorkbench.objects?.lifecycle_stage || {}).filter((stage) => stage.lifecycleType === "data");
  const lifecycleModuleItems = [];
  let renderedLifecycleStages = 0;
  for (const stage of applicationStages) {
    const model = viewModels.buildApplicationSecurityLifecycleViewModel({
      lifecycleWorkbench,
      lifecycleWorkbenchViewModel,
      lifecycle: lifecycleKnowledge,
      selectedProcessId: stage.id,
      search: "",
    });
    const rendered = `${component.renderStageOverview(model)}${component.renderRelationTable({
      rows: model.relationRows,
      profileRows: model.stageProfileRows,
      overview: model.stageOverview,
      mode: "dev",
      selectedStageId: stage.id,
    })}`;
    assertNoLegacyPlaceholder(rendered, `LC-AP ${stage.code || stage.id}`, issues);
    renderedLifecycleStages += 1;
    for (const row of model.relationRows || []) {
      for (const item of row.technologyModules || []) {
        if (String(item.objectKind || "").includes("模块")) lifecycleModuleItems.push({ stage, item });
      }
    }
  }
  for (const stage of dataStages) {
    const model = viewModels.buildDataSecurityLifecycleViewModel({
      lifecycleWorkbench,
      lifecycleWorkbenchViewModel,
      lifecycle: lifecycleKnowledge,
      selectedProcessId: stage.id,
      search: "",
    });
    const rendered = `${component.renderStageOverview(model)}${component.renderRelationTable({
      rows: model.relationRows,
      policyRows: model.policyRows,
      overview: model.stageOverview,
      mode: "data",
      selectedStageId: stage.id,
    })}`;
    assertNoLegacyPlaceholder(rendered, `LC-DT ${stage.code || stage.id}`, issues);
    renderedLifecycleStages += 1;
  }
  for (const { stage, item } of lifecycleModuleItems) {
    assert(Boolean(item?.id) && canonicalModules.has(String(item.id)), `生命周期页面伪造或丢失模块字典 ID：${stage.code || stage.id} / ${item?.title || item?.name || "unknown"}`, issues);
  }
  const ap03Modules = lifecycleModuleItems.filter(({ stage }) => stage.code === "AP-03").map(({ item }) => item);
  const ap03StaticModules = ap03Modules.filter((item) => (item.title || item.name) === "应用程序静态安全测试");
  assert(ap03StaticModules.length === 1, `AP-03 应只显示 1 个应用程序静态安全测试，实际 ${ap03StaticModules.length}`, issues);
  assert(!ap03Modules.some((item) => String(item.title || item.name || "").includes("安全函数和组件库")), "AP-03 仍把限定说明伪造成第二个模块", issues);
  for (const forbidden of ["raw_value", "source_file", "import_id", "source_ref", "debug", "metadata", "generated_at"]) {
    assert(!componentSource.includes(forbidden), `生命周期主展示泄露非业务字段：${forbidden}`, issues);
  }
  assert(!includesAll(componentSource, ["CapabilityGraphCollisionController", "relationGraphViewPolicy"]), "P1-3 重新引入了 P0-3 图谱碰撞逻辑", issues);

  const baseUrl = argValue("--url");
  if (baseUrl) {
    try {
      const [liveIndex, liveComponent, liveViewModels, liveCss] = await Promise.all([
        fetchText(baseUrl, "index.html"),
        fetchText(baseUrl, "components/ApplicationSecurityLifecycle.js?v=p1-3-lifecycle-workbench-20260714-2"),
        fetchText(baseUrl, "viewModels.js?v=lifecycle-canonical-module-reference-20260714-1"),
        fetchText(baseUrl, "p1-lifecycle-workbench.css?v=p1-3-lifecycle-workbench-20260714-3"),
      ]);
      assert(liveIndex.includes("p1-lifecycle-workbench.css?v=p1-3-lifecycle-workbench-20260714-3"), "5173 未加载 P1-3 v3 样式", issues);
      assert(liveComponent.includes("EMPTY_PLACEHOLDER_PATTERN") && !liveComponent.includes("横向滚动查看更多字段"), "5173 生命周期组件不是 P1-3 V3 版本", issues);
      assert(liveViewModels.includes("canonicalLifecycleSecurityTechnologyItems"), "5173 未加载 canonical 模块引用 ViewModel", issues);
      assert(liveCss.includes("contain: layout paint style") && !liveCss.includes("position: sticky") && !liveCss.includes("lifecycle-scroll-hint"), "5173 生命周期样式不是 P1-3 V3 版本", issues);
    } catch (error) {
      issues.push(`5173 P1-3 运行态核对失败：${error.message}`);
    }
  }

  console.log(`contract=${config.version}`);
  console.log(`routes=${config.routes.join(",")}`);
  console.log(`empty_display=${config.emptyDisplay}`);
  console.log(`application_stages_checked=${applicationStages.length}`);
  console.log(`data_stages_checked=${dataStages.length}`);
  console.log(`rendered_lifecycle_stages_checked=${renderedLifecycleStages}`);
  console.log(`canonical_module_references_checked=${lifecycleModuleItems.length}`);
  if (issues.length) {
    console.error("result=fail");
    issues.forEach((issue) => console.error(`issue=${issue}`));
    process.exit(1);
  }
  console.log("result=pass");
}

main();
