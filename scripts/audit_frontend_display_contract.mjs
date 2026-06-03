import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();

function readText(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8");
}

function blockAfter(source, anchor, length = 1600) {
  const start = source.indexOf(anchor);
  return start < 0 ? "" : source.slice(start, start + length);
}

function includesAll(source, values) {
  return values.every((value) => source.includes(value));
}

const stylesCss = readText("frontend/capability-browser/styles.css");
const managementMappingJs = readText("frontend/capability-browser/components/FocusManagementMapping.js");
const globalBaseline = readText("docs/06-implementation/frontend-global-design-baseline-2026-05-30.md");
const displayPrinciples = readText("docs/06-implementation/frontend-display-design-principles-2026-05-30.md");

const issues = [];
const managementChipBlock = blockAfter(stylesCss, "primary relationship matrices must keep business objects readable and selectable");

if (
  !includesAll(managementChipBlock, [
    ".original-matrix-panel .management-mapping-section .relation-chip",
    ".original-matrix-panel .management-mapping-section .function-layer-bucket em span",
    "white-space: normal",
    "text-overflow: clip",
    "user-select: text",
  ])
) {
  issues.push({
    severity: "error",
    type: "management_relation_chip_truncation_guard_missing",
    message: "管理视角主关系矩阵缺少完整显示 / 可选择复制的 chip 样式保护。",
  });
}

if (
  !includesAll(managementMappingJs, [
    'title="${title}"',
    'data-copy-text="${title}"',
    "relation-chip-text",
  ])
) {
  issues.push({
    severity: "error",
    type: "management_relation_chip_copy_metadata_missing",
    message: "管理视角关系对象 chip 缺少完整文本 title / data-copy-text 或文本容器。",
  });
}

if (!globalBaseline.includes("完整展示并可选择复制")) {
  issues.push({
    severity: "error",
    type: "global_display_baseline_missing",
    message: "全局前端设计基准缺少主关系矩阵完整展示和可复制规则。",
  });
}

if (!displayPrinciples.includes("主关系矩阵")) {
  issues.push({
    severity: "error",
    type: "display_principles_missing",
    message: "前端展示原则缺少主关系矩阵字段完整显示规则。",
  });
}

const result = {
  result: issues.some((issue) => issue.severity === "error") ? "fail" : "pass",
  checked: {
    managementChipCssGuard: Boolean(managementChipBlock),
    managementMappingCopyMetadata: true,
    displayBaselineDocs: true,
  },
  issues,
};

console.log(JSON.stringify(result, null, 2));

if (result.result !== "pass") process.exit(1);
