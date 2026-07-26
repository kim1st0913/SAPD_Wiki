#!/usr/bin/env node

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import vm from "node:vm";

const root = resolve(import.meta.dirname, "..");
const read = (path) => readFileSync(resolve(root, path), "utf8");

const app = read("frontend/capability-browser/app.js");
const shell = read("frontend/capability-browser/components/AppShell.js");
const viewModels = read("frontend/capability-browser/viewModels.js");
const component = read("frontend/capability-browser/components/EnvironmentObjectDirectoryTable.js");
const capabilityDirectory = read("frontend/capability-browser/components/CapabilityDirectoryMaintenanceTable.js");
const referenceTableStyles = read("frontend/capability-browser/p1-reference-tables.css");
const productWorkspaceStyles = read("frontend/capability-browser/p2-product-workspace.css");
const index = read("frontend/capability-browser/index.html");
const workbench = JSON.parse(read("frontend/capability-browser/public/data/environment-workbench.json"));

assert.ok(shell.includes('label: "信息化环境-对象目录"'), "知识库字典导航缺少信息化环境-对象目录");
assert.ok(shell.includes('"/knowledge/environment-objects": { view: "maintenance", maintenancePage: "environment-objects" }'), "缺少环境对象字典路由");
assert.ok(app.includes('"environment-objects": {\n    requiredPackages: ["environmentWorkbench"]'), "环境对象字典必须直接加载环境工作台权威数据包");
assert.ok(app.includes("components.EnvironmentObjectDirectoryTable?.render"), "环境对象字典组件未接入维护页面");
assert.ok(viewModels.includes("buildEnvironmentObjectDirectoryViewModel"), "缺少环境对象字典 ViewModel");
assert.ok(viewModels.includes('id: `environment-object:${environmentId}:${segmentId || segmentIndex}:${objectId || objectIndex}`'), "信息化对象目录必须使用环境+子类+对象上下文键");
assert.ok(index.includes("components/EnvironmentObjectDirectoryTable.js"), "环境对象字典组件未进入前端加载链");
assert.ok(component.includes('data-environment-object-directory-action="expand-all"'), "缺少全部展开操作");
assert.ok(component.includes('data-environment-object-directory-action="collapse-all"'), "缺少分类收起操作");
assert.ok(component.includes("expandSearchResults: Boolean"), "搜索结果必须自动展开命中路径");
assert.ok(
  component.includes("environmentContainsSelected") && component.includes("segmentContainsSelected"),
  "显式选中的信息化对象应保持所属环境和子类展开",
);
assert.ok(
  component.includes("hierarchical-directory-maintenance-table")
    && capabilityDirectory.includes("hierarchical-directory-maintenance-table"),
  "环境对象目录与安全能力清单应复用同一分层目录布局结构",
);
assert.ok(
  productWorkspaceStyles.includes(".source-local-search-body:has(.hierarchical-directory-maintenance-table)")
    && referenceTableStyles.includes(".maintenance-table-scroll:has(.hierarchical-directory-maintenance-table)"),
  "分层目录工具栏、滚动表格和底部记录区应复用安全能力清单布局契约",
);

const environments = workbench.environment_scope_tree || workbench.environmentScopeTree || [];
const segmentIds = new Set();
const objectIds = new Set();
const contextKeys = [];
for (const environment of environments) {
  for (const object of environment.objects || []) {
    objectIds.add(object.id || object.title);
    for (const segment of object.segments || []) {
      segmentIds.add(segment.id || `${environment.id}:${segment.title}`);
      contextKeys.push(`${environment.id}:${segment.id || segment.title}:${object.id || object.title}`);
    }
  }
}

assert.equal(environments.length, 10, "信息化环境数量应为 10");
assert.equal(segmentIds.size, 29, "环境子类数量应为 29");
assert.equal(objectIds.size, 51, "唯一信息化对象数量应为 51");
assert.equal(contextKeys.length, 67, "环境+子类+对象上下文记录应为 67");
assert.equal(new Set(contextKeys).size, contextKeys.length, "环境对象目录上下文键必须唯一");

const viewModelSandbox = { window: {} };
vm.runInNewContext(viewModels, viewModelSandbox, { filename: "viewModels.js" });
const directoryViewModel = viewModelSandbox.window.sapdViewModels.buildEnvironmentObjectDirectoryViewModel({
  management: { environment_scope_tree: environments },
  search: "",
});
assert.equal(directoryViewModel.summary.totalEnvironments, 10, "目录 ViewModel 应展示 10 个信息化环境");
assert.equal(directoryViewModel.summary.totalSegments, 29, "目录 ViewModel 应展示 29 个环境子类");
assert.equal(directoryViewModel.summary.totalObjects, 51, "目录 ViewModel 应展示 51 个唯一信息化对象");
assert.equal(directoryViewModel.summary.totalContextRows, 67, "目录 ViewModel 应保留 67 条上下文记录");

const searchViewModel = viewModelSandbox.window.sapdViewModels.buildEnvironmentObjectDirectoryViewModel({
  management: { environment_scope_tree: environments },
  search: "API网关层",
});
assert.equal(searchViewModel.environmentGroups.length, 1, "对象搜索应仅保留命中的信息化环境路径");
assert.equal(searchViewModel.environmentGroups[0].segments.length, 1, "对象搜索应仅保留命中的环境子类路径");
assert.equal(searchViewModel.rows.length, 1, "API网关层搜索应命中一条上下文记录");

const componentSandbox = {
  document: { addEventListener() {} },
  window: {
    sapdComponents: {
      utils: {
        escapeHtml(value) {
          return String(value ?? "")
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;");
        },
        list(value) {
          return Array.isArray(value) ? value : [];
        },
        text(value) {
          return value == null ? "" : String(value);
        },
      },
    },
  },
};
vm.runInNewContext(component, componentSandbox, { filename: "EnvironmentObjectDirectoryTable.js" });
const renderDirectory = componentSandbox.window.sapdComponents.EnvironmentObjectDirectoryTable.render;
const collapsedHtml = renderDirectory({
  environmentGroups: directoryViewModel.environmentGroups,
  search: "",
  selectedId: "",
});
assert.equal((collapsedHtml.match(/depth-0/g) || []).length, 10, "默认目录应渲染 10 个信息化环境分类");
assert.equal((collapsedHtml.match(/depth-1/g) || []).length, 29, "默认目录应渲染 29 个环境子类分类");
assert.equal((collapsedHtml.match(/environment-object-directory-row/g) || []).length, 67, "默认目录应渲染 67 条对象上下文");
assert.equal((collapsedHtml.match(/aria-expanded="true"/g) || []).length, 0, "默认目录应收起到信息化环境层");

const searchedHtml = renderDirectory({
  environmentGroups: searchViewModel.environmentGroups,
  search: "API网关层",
  selectedId: "",
});
assert.equal((searchedHtml.match(/aria-expanded="true"/g) || []).length, 2, "搜索结果应自动展开环境和子类两级路径");
assert.equal((searchedHtml.match(/environment-object-directory-row/g) || []).length, 1, "搜索结果应只渲染命中对象");

const selectedHtml = renderDirectory({
  environmentGroups: directoryViewModel.environmentGroups,
  search: "",
  selectedId: directoryViewModel.rows[0].id,
});
assert.equal((selectedHtml.match(/aria-expanded="true"/g) || []).length, 2, "选中对象后应保持环境和子类两级路径展开");

console.log(
  JSON.stringify(
    {
      result: "pass",
      route: "/knowledge/environment-objects",
      environments: environments.length,
      segments: segmentIds.size,
      objects: objectIds.size,
      contextRows: contextKeys.length,
    },
    null,
    2,
  ),
);
