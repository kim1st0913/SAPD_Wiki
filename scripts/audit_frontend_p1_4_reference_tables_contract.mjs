#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const configPath = path.join(projectRoot, "config/frontend-p1-4-reference-tables.json");
const read = (relativePath) => readFileSync(path.join(projectRoot, relativePath), "utf8");
const assert = (condition, message, issues) => {
  if (!condition) issues.push(message);
};
const includesAll = (source, values) => values.every((value) => source.includes(value));
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
  assert(existsSync(configPath), "缺少 P1-4 字典/标准配置", issues);
  const config = JSON.parse(readFileSync(configPath, "utf8"));
  const directorySource = read("frontend/capability-browser/components/CapabilityDirectoryMaintenanceTable.js");
  const standardSource = read("frontend/capability-browser/components/StandardFrameworkTable.js");
  const shellSource = read("frontend/capability-browser/components/MaintenanceShell.js");
  const appSource = read("frontend/capability-browser/app.js");
  const cssSource = read("frontend/capability-browser/p1-reference-tables.css");
  const indexSource = read("frontend/capability-browser/index.html");

  const context = {
    window: {
      sapdComponents: {
        utils: {
          list: (value) => (Array.isArray(value) ? value : value == null ? [] : [value]),
          text: (value) => String(value ?? ""),
          escapeHtml: (value) => String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;"),
        },
      },
    },
  };
  vm.runInNewContext(directorySource, context, { filename: "CapabilityDirectoryMaintenanceTable.js" });
  const directory = context.window.sapdComponents.CapabilityDirectoryMaintenanceTable;
  const html = directory?.render({
    selectedId: "focus-2",
    capabilityGroups: [{
      code: "T",
      title: "安全技术能力",
      domains: [{ code: "T-AS", title: "基础架构安全", capabilities: [{ code: "T-AS.AD", title: "网络安全", focuses: [{ id: "focus-1", code: "AD-01", title: "架构管控" }, { id: "focus-2", code: "AD-02", title: "冗余设计" }] }] }],
    }],
  }) || "";
  assert(html.includes("hierarchy-level-label") && html.includes("hierarchy-meta"), "字典层级标签或静态计数未切换到弱元数据语义", issues);
  assert(!html.includes("type-pill"), "字典层级仍使用选择态胶囊", issues);
  assert(!/hierarchy-meta[^>]*tabindex/.test(html), "静态计数被错误加入键盘焦点", issues);
  assert(html.includes("standard-group-detail active"), "显式选中行未保留单一选择态", issues);

  for (const key of config.tabKeys) assert(standardSource.includes(`"${key}"`), `标准 Tab 缺少键盘键：${key}`, issues);
  assert(includesAll(standardSource, ["selectStandardTab", 'role="tab"', 'aria-selected=', 'tabindex="${active ? "0" : "-1"}"']), "标准 Tab 的选择、ARIA 或 roving tabindex 契约不完整", issues);
  assert(config.defaultExpansion === "all-collapsed-unless-searching" && standardSource.includes("const expandAll = Boolean(utils.text(search).trim())"), "标准/框架默认全部收起契约未固化", issues);
  assert(config.singleSectionTab === "hidden" && shellSource.includes("if (rows.length < 2) return \"\";"), "单页面仍渲染无意义 Tab", issues);
  assert(config.capabilityDirectoryScrollOwner === ".maintenance-table-scroll" && includesAll(cssSource, ["#sourceList:has(.hierarchical-directory-maintenance-table)", "overflow: hidden", ".maintenance-table-scroll:has(.hierarchical-directory-maintenance-table)", "-webkit-overflow-scrolling: touch"]), "分层目录唯一滚动容器契约不完整", issues);
  assert(includesAll(appSource, ["captureMaintenanceScrollPosition", "restoreMaintenanceScrollPosition", "expandedGroupIds", "preserveTableScroll: true"]), "能力清单重绘后的展开状态与滚动位置恢复链路不完整", issues);
  assert(includesAll(cssSource, ["capability-directory-group.depth-0", "standard-group-detail.active", "standard-framework-tab[aria-selected", "border-bottom: 1px solid", "nth-child(odd)"]), "中性层级、蓝色选择、轻量 Tab 或发丝分隔样式不完整", issues);
  assert(includesAll(indexSource, ["p1-reference-tables.css?v=p1-4-reference-tables-20260714-2", "p1-4-reference-tables-20260714-2", "p1-single-tab-remove-20260714-1"]), "P1-4 样式或单页导航缓存版本未更新", issues);
  for (const source of [directorySource, standardSource]) {
    for (const forbidden of ["raw_value", "source_file", "import_id", "source_ref", "debug", "metadata", "generated_at"]) {
      assert(!source.includes(forbidden), `字典/标准主展示泄露非业务字段：${forbidden}`, issues);
    }
  }

  const baseUrl = argValue("--url");
  if (baseUrl) {
    try {
      const [liveIndex, liveDirectory, liveStandard, liveShell, liveCss] = await Promise.all([
        fetchText(baseUrl, "index.html"),
        fetchText(baseUrl, "components/CapabilityDirectoryMaintenanceTable.js?v=p1-4-reference-tables-20260714-1"),
        fetchText(baseUrl, "components/StandardFrameworkTable.js?v=p1-4-reference-tables-20260714-2"),
        fetchText(baseUrl, "components/MaintenanceShell.js?v=p1-single-tab-remove-20260714-1"),
        fetchText(baseUrl, "p1-reference-tables.css?v=p1-4-reference-tables-20260714-2"),
      ]);
      assert(liveIndex.includes("p1-reference-tables.css?v=p1-4-reference-tables-20260714-2"), "5173 未加载 P1-4 V2 样式", issues);
      assert(liveDirectory.includes("hierarchy-level-label"), "5173 字典组件不是 P1-4 版本", issues);
      assert(liveStandard.includes("const expandAll = Boolean(utils.text(search).trim())"), "5173 标准组件未加载默认收起修复", issues);
      assert(liveShell.includes("if (rows.length < 2) return \"\";"), "5173 未加载单页面隐藏 Tab 修复", issues);
      assert(liveCss.includes("standard-framework-tabbed"), "5173 标准样式不是 P1-4 版本", issues);
    } catch (error) {
      issues.push(`5173 P1-4 运行态核对失败：${error.message}`);
    }
  }

  console.log(`contract=${config.version}`);
  console.log(`routes=${config.routes.join(",")}`);
  console.log(`tab_keys=${config.tabKeys.join(",")}`);
  if (issues.length) {
    console.error("result=fail");
    issues.forEach((issue) => console.error(`issue=${issue}`));
    process.exit(1);
  }
  console.log("result=pass");
}

main();
