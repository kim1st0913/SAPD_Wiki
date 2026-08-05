#!/usr/bin/env node

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relativePath) => readFileSync(path.join(projectRoot, relativePath), "utf8");
const issues = [];
const assert = (condition, message) => {
  if (!condition) issues.push(message);
};

const appSource = read("frontend/capability-browser/app.js");
const indexSource = read("frontend/capability-browser/index.html");

assert(
  appSource.includes('<details class="modeling-legend-section')
    && appSource.includes('<summary class="modeling-legend-section-summary">'),
  "元素图例未使用原生 details/summary 折叠结构",
);
assert(
  appSource.includes('data-modeling-legend-action="expand-all"')
    && appSource.includes('data-modeling-legend-action="collapse-all"')
    && appSource.includes("setModelingLegendSections("),
  "元素图例缺少独立的全部展开/全部收起控制",
);
assert(
  !appSource.includes("function toggleModelingLegendSection")
    && !appSource.includes('event.target.closest(".modeling-legend-section-summary")')
    && !appSource.includes('event.target?.closest?.(".modeling-legend-section-summary")'),
  "元素图例仍叠加全局事件委托，普通内容点击可能误触收回",
);
assert(
  appSource.includes('if (event.target.closest(".modeling-legend-section")) return;'),
  "元素图例分组未与共享 document action router 隔离",
);
assert(
  indexSource.includes("modeling-legend-native-toggle-20260805-1"),
  "index.html 未刷新元素图例交互缓存版本",
);

console.log("contract=modeling-legend-native-toggle-v1");
if (issues.length) {
  console.error("result=fail");
  issues.forEach((issue) => console.error(`issue=${issue}`));
  process.exit(1);
}
console.log("result=pass");
