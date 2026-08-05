#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const failures = [];

function read(relativePath) {
  const absolutePath = path.join(root, relativePath);
  if (!fs.existsSync(absolutePath)) {
    failures.push(`missing required file: ${relativePath}`);
    return "";
  }
  return fs.readFileSync(absolutePath, "utf8");
}

function lineCount(text) {
  return text === "" ? 0 : text.split(/\r?\n/).length;
}

export function latestDatedHeading(text) {
  const dates = [...text.matchAll(/^## (\d{4}-\d{2}-\d{2})$/gm)].map((match) => match[1]);
  return dates.sort().at(-1) || "";
}

const requiredFiles = [
  "README.md",
  "docs/README.md",
  "docs/DOCUMENT_GOVERNANCE.md",
  "docs/05-archive/README.md",
  "docs/00-overview/project-vision.md",
  "docs/01-architecture/architecture.md",
  "docs/07-governance/governance-index.md",
  "docs/09-delivery/packaging-directory-map.md",
  "docs/09-delivery/desktop-packaging-runbook.md",
  "docs/09-delivery/windows-github-installer-migration-plan-2026-07-27.md",
  "apps/README.md",
  "scripts/retired/zip-alpha/README.md",
  "docs/05-archive/delivery-retired-2026-07/workflows/README.md",
  "docs/05-archive/delivery-retired-2026-07/workflows/build-windows-backend.yml",
  "CURRENT_STATE.md",
  "progress.md",
  "task_plan.md",
];

for (const file of requiredFiles) {
  read(file);
}

const taskPlan = read("task_plan.md");
const currentState = read("CURRENT_STATE.md");
const progress = read("progress.md");
const openIssues = read("docs/06-implementation/open-issues.md");
const windowsMigrationPlan = read(
  "docs/09-delivery/windows-github-installer-migration-plan-2026-07-27.md",
);
const progressUpdateDate = /^> 更新日期：(\d{4}-\d{2}-\d{2})$/m.exec(progress)?.[1] || "";
const latestProgressDate = latestDatedHeading(progress);
if (!progressUpdateDate || progressUpdateDate !== latestProgressDate) {
  failures.push(
    `progress date mismatch: declared=${progressUpdateDate || "missing"} latest=${latestProgressDate || "missing"}`,
  );
}
if (lineCount(taskPlan) > 160) {
  failures.push(`task_plan.md exceeds 160 lines: ${lineCount(taskPlan)}`);
}
if (lineCount(currentState) > 120) {
  failures.push(`CURRENT_STATE.md exceeds 120 lines: ${lineCount(currentState)}`);
}
if (lineCount(progress) > 100) {
  failures.push(`progress.md exceeds 100 lines: ${lineCount(progress)}`);
}

const declaredOpenIssueCount = Number(
  /当前未关闭问题数：(\d+)/.exec(openIssues)?.[1] ?? Number.NaN,
);
const currentOpenIssueTable = openIssues
  .split("## 当前未关闭问题", 2)[1]
  ?.split("## 最近关闭问题", 1)[0] || "";
const listedOpenIssueCount = (currentOpenIssueTable.match(/^\| OI-\d+ \|/gm) || []).length;
if (!Number.isInteger(declaredOpenIssueCount) || declaredOpenIssueCount !== listedOpenIssueCount) {
  failures.push(
    `open issue count mismatch: declared=${Number.isInteger(declaredOpenIssueCount) ? declaredOpenIssueCount : "missing"} listed=${listedOpenIssueCount}`,
  );
}

for (const forbiddenHeading of [
  "今晚执行主线",
  "Git 工作区归一化",
  "C1 恢复点内容",
  "C2 分支处置矩阵",
]) {
  if (taskPlan.includes(forbiddenHeading)) {
    failures.push(`task_plan.md still contains completed history: ${forbiddenHeading}`);
  }
}

for (const [file, forbiddenPhrases] of Object.entries({
  "README.md": ["当前工程已从早期 Excel 导入 MVP"],
  "docs/00-overview/project-vision.md": [
    "V1 从 Excel、Markdown、DOCX 开始",
    "PPT 和 Draw.io 深度解析后置",
  ],
  "docs/01-architecture/architecture.md": [
    "V1 只做必要能力",
    "当前阶段只明确系统分层",
  ],
})) {
  const content = read(file);
  for (const phrase of forbiddenPhrases) {
    if (content.includes(phrase)) {
      failures.push(`${file} still contains superseded project positioning: ${phrase}`);
    }
  }
}

const currentDeliveryDir = path.join(root, "docs/09-delivery");
if (fs.existsSync(currentDeliveryDir)) {
  for (const entry of fs.readdirSync(currentDeliveryDir)) {
    if (!entry.endsWith(".md")) continue;
    const content = read(path.join("docs/09-delivery", entry));
    const header = content.split(/\r?\n/).slice(0, 12).join("\n").toLowerCase();
    if (header.includes("retired") || header.includes("historical")) {
      failures.push(`retired delivery document remains in current directory: ${entry}`);
    }
  }
}

const currentGovernanceDir = path.join(root, "docs/07-governance");
if (fs.existsSync(currentGovernanceDir)) {
  for (const entry of fs.readdirSync(currentGovernanceDir)) {
    if (!entry.endsWith(".md")) continue;
    const content = read(path.join("docs/07-governance", entry));
    const header = content.split(/\r?\n/).slice(0, 12).join("\n");
    if (header.includes("已停用") || header.includes("historical")) {
      failures.push(`retired governance document remains in current directory: ${entry}`);
    }
  }
}

const currentIndexFiles = [
  "docs/README.md",
  "docs/DOCUMENT_GOVERNANCE.md",
  "docs/07-governance/governance-index.md",
];
const currentIndexes = currentIndexFiles.map(read).join("\n");

for (const indexFile of ["docs/README.md", "docs/DOCUMENT_GOVERNANCE.md"]) {
  if (!read(indexFile).includes("09-delivery/packaging-directory-map.md")) {
    failures.push(`${indexFile} does not list the packaging directory source of truth`);
  }
}

if (taskPlan.includes("Windows 交付 | `operational / internal_release_ready`")) {
  failures.push("task_plan.md claims Windows automatic delivery is operational");
}
if (/\| W4 main watcher .*\| `complete` \|/.test(windowsMigrationPlan)) {
  failures.push("Windows migration plan still marks the blocked W4 watcher complete");
}

for (const retiredPackagingPath of [
  ".github/workflows/build-windows-backend.yml",
  "scripts/create_alpha_release.py",
  "scripts/create_update_package.py",
  "scripts/start-macos.command",
  "scripts/start-windows.bat",
  "scripts/stop-macos.command",
  "scripts/stop-windows.bat",
]) {
  if (fs.existsSync(path.join(root, retiredPackagingPath))) {
    failures.push(`retired packaging entry returned to active path: ${retiredPackagingPath}`);
  }
}

const retiredCurrentPaths = [
  "docs/00-overview/stitch-design-handoff-v2.md",
  "docs/00-overview/frontend-menu-and-page-type-definition-v1.md",
  "docs/01-architecture/api-offline-package-contract-inventory.md",
  "docs/01-architecture/delivery-bundle-1.0-prebuilt-database.md",
  "docs/01-architecture/frontend-backend-separation-closure.md",
  "docs/01-architecture/consultant-delivery-model.md",
  "docs/01-architecture/hardening/local-mcp-certificate-trust-2026-07-24/hardening.md",
  "docs/04-frontend/frontend-redesign-brief.md",
  "docs/04-user-guide/frontend-baseline-1.0-plan.md",
  "docs/04-user-guide/frontend-data-contract-baseline-1.0.md",
  "docs/04-user-guide/frontend-json-field-attribution-baseline-1.0.md",
  "docs/04-user-guide/special-maintenance-pages-prototype-brief.md",
  "docs/02-data-model/field-dictionary-draft.md",
  "docs/02-data-model/sqlite-schema-design.md",
  "docs/06-implementation/analytics-summary-json-contract-draft.md",
  "docs/06-implementation/base-stable-key-and-redirect-migration-design-2026-06-06.md",
  "docs/06-implementation/base-content-unified-query-tonight-plan-2026-07-26.md",
  "docs/06-implementation/be-4-workbench-data-quality-gap-list.md",
  "docs/06-implementation/database-cleanup-handoff-2026-06-01.md",
  "docs/06-implementation/database-cleanup-plan-and-contingency-2026-06-01.md",
  "docs/06-implementation/database-import-intermediate-cleanup-plan-2026-07-19.md",
  "docs/06-implementation/environment-master-data-dictionary-plan-2026-07-25.md",
  "docs/06-implementation/global-search-redesign-2026-06-30.md",
  "docs/06-implementation/local-mcp-m0t-t0-t2-execution-plan.md",
  "docs/06-implementation/project-blocker-review-2026-05-30.md",
  "docs/06-implementation/search-governance-oi154-oi155-synchronized-design-2026-07-02.md",
  "docs/06-implementation/search-logic-design.md",
  "docs/06-implementation/user-db-compatibility-report-2026-06-06.md",
  "docs/03-import-etl/core-sheet-business-review.md",
  "docs/03-import-etl/excel-import-mvp-design.md",
  "docs/03-import-etl/import-warning-review.md",
  "docs/03-import-etl/mapping-rules-draft.md",
  "docs/03-import-etl/remaining-21-sheets-modeling.md",
  "docs/03-import-etl/second-batch-business-review.md",
  "docs/03-import-etl/second-batch-data-contract.md",
  "docs/03-import-etl/third-batch-data-contract.md",
  "docs/07-governance/backlog-convergence-2026-06-06.md",
  "docs/07-governance/current-execution-lines.md",
  "docs/07-governance/execution-line-convergence-workflow.md",
  "docs/08-maturity/business-design-material-review-2026-07-09.md",
  "docs/08-maturity/data-model.md",
  "docs/08-maturity/evaluation-table-v2-analysis.md",
  "docs/08-maturity/implementation-plan.md",
  "docs/08-maturity/mainline-consistency-check.md",
  "docs/08-maturity/mainline-integration-check.md",
  "docs/08-maturity/module-integration-review.md",
  "docs/08-maturity/sample-analysis.md",
  "docs/08-maturity/scoring-rules.md",
  "docs/08-maturity/template-design.md",
  "docs/09-delivery/windows-electron-build-guide.md",
  "docs/09-delivery/windows-zip-build-guide.md",
];

for (const stalePath of retiredCurrentPaths) {
  if (fs.existsSync(path.join(root, stalePath))) {
    failures.push(`retired document returned to current directory: ${stalePath}`);
  }
  if (currentIndexes.includes(stalePath)) {
    failures.push(`current index still points to retired path: ${stalePath}`);
  }
}

for (const maturityContract of [
  "docs/08-maturity/requirements.md",
  "docs/08-maturity/maturity-domain-model.md",
  "docs/08-maturity/maturity-data-model.md",
  "docs/08-maturity/maturity-template-mapping.md",
  "docs/08-maturity/assessment-rubric-dictionary-mapping-audit-2026-07-17.md",
  "docs/08-maturity/assessment-rubric-source-appendix-2026-07-17.md",
]) {
  read(maturityContract);
}

if (failures.length > 0) {
  console.error("Document governance audit: FAIL");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log("Document governance audit: PASS");
console.log(`CURRENT_STATE.md lines: ${lineCount(currentState)}`);
console.log(`progress.md lines: ${lineCount(progress)}`);
console.log(`task_plan.md lines: ${lineCount(taskPlan)}`);
