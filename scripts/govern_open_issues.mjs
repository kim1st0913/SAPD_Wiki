#!/usr/bin/env node

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const sourcePath = path.join(root, "docs/06-implementation/open-issues.md");
const indexPath = path.join(root, "docs/06-implementation/open-issues-index.md");
const archiveDir = path.join(root, "docs/05-archive/open-issues-history");
const archivePath = path.join(archiveDir, "2026-06.md");
const closedStatuses = new Set(["已修复", "业务接受", "已回退", "已修复，后续可继续优化"]);

function escapeTable(value) {
  return String(value || "").replace(/\|/g, "\\|");
}

function parseIssues(text) {
  const headingRe = /^## (OI-\d+)：([^\n]*)$/gm;
  const matches = [...text.matchAll(headingRe)];
  if (!matches.length) throw new Error("No issue headings found");
  return matches.map((match, index) => {
    const start = match.index;
    const end = index + 1 < matches.length ? matches[index + 1].index : text.length;
    const content = text.slice(start, end).trimEnd();
    const id = match[1];
    const title = match[2].trim();
    const status = (content.match(/^- 状态：([^\n]*)/m)?.[1] || "").trim();
    const type = (content.match(/^- 类型：([^\n]*)/m)?.[1] || "").trim();
    const object = (content.match(/^- 对象(?:或页面)?：([^\n]*)/m)?.[1] || "").trim();
    return { id, title, status, type, object, content, order: index + 1 };
  });
}

function buildIndexRows(issueSections, previousIndexKeys = new Map()) {
  const idCounts = new Map();
  for (const item of issueSections) idCounts.set(item.id, (idCounts.get(item.id) || 0) + 1);
  const occurrence = new Map();
  const rows = issueSections.map((item) => {
    const nextOccurrence = (occurrence.get(item.id) || 0) + 1;
    occurrence.set(item.id, nextOccurrence);
    const duplicateKey = previousIndexKeys.get(issueIdentity(item)) || (idCounts.get(item.id) > 1 ? `${item.id}#${nextOccurrence}` : item.id);
    const location = closedStatuses.has(item.status) ? "docs/05-archive/open-issues-history/2026-06.md" : "docs/06-implementation/open-issues.md";
    return { ...item, duplicateKey, location };
  });
  const duplicateIds = [...idCounts.entries()].filter(([, count]) => count > 1).map(([id]) => id);
  return { rows, duplicateIds };
}

async function readTextIfExists(filePath) {
  try {
    return await readFile(filePath, "utf8");
  } catch (error) {
    if (error?.code === "ENOENT") return "";
    throw error;
  }
}

function issueIdentity(item) {
  return `${item.id}\u0000${item.title}`;
}

function mergeClosedIssues(existingArchived, newlyClosed) {
  const seen = new Set();
  const merged = [];
  for (const item of [...existingArchived, ...newlyClosed]) {
    const key = issueIdentity(item);
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(item);
  }
  return merged;
}

function mergeIssueLists(...lists) {
  const seen = new Set();
  const merged = [];
  for (const item of lists.flat()) {
    const key = issueIdentity(item);
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(item);
  }
  return merged;
}

function parsePreviousIndexKeys(text) {
  const keys = new Map();
  for (const line of text.split(/\r?\n/)) {
    if (!line.startsWith("| OI-")) continue;
    const cells = line
      .split("|")
      .slice(1, -1)
      .map((cell) => cell.trim().replace(/\\\|/g, "|"));
    if (cells.length < 3) continue;
    const duplicateKey = cells[0];
    const id = duplicateKey.split("#")[0];
    const status = cells[1];
    const title = cells[2];
    keys.set(`${id}\u0000${status}\u0000${title}`, duplicateKey);
  }
  return keys;
}

function sanitizeTemplateContent(content) {
  return String(content || "")
    .split(/\n## 当前问题详情/)[0]
    .trimEnd()
    .replace(/\n```$/, "");
}

function buildStatusCounts(sections) {
  return sections.reduce((acc, item) => {
    const status = item.status || "(空)";
    acc[status] = (acc[status] || 0) + 1;
    return acc;
  }, {});
}

const text = await readFile(sourcePath, "utf8");
const sections = parseIssues(text);
const existingArchiveText = await readTextIfExists(archivePath);
const existingIndexText = await readTextIfExists(indexPath);
const archivedSections = existingArchiveText ? parseIssues(existingArchiveText).filter((item) => item.id !== "OI-000") : [];
const previousIndexKeys = parsePreviousIndexKeys(existingIndexText);
const template = sections.find((item) => item.id === "OI-000");
const issueSections = sections.filter((item) => item.id !== "OI-000");
const archivedClosed = archivedSections.filter((item) => closedStatuses.has(item.status));
const archivedActive = archivedSections.filter((item) => !closedStatuses.has(item.status));
const closed = issueSections.filter((item) => closedStatuses.has(item.status));
const active = mergeIssueLists(archivedActive, issueSections.filter((item) => !closedStatuses.has(item.status)));
const allClosed = mergeClosedIssues(archivedClosed, closed);
const allIssueSections = archivedSections.length ? [...allClosed, ...active] : issueSections;
const { rows: indexRows, duplicateIds } = buildIndexRows(allIssueSections, previousIndexKeys);
const statusCounts = buildStatusCounts([...(template ? [template] : []), ...allIssueSections]);

await mkdir(archiveDir, { recursive: true });

const archiveContent = [
  "# Open Issues History - 2026-06",
  "",
  "本文件归档 `docs/06-implementation/open-issues.md` 中已关闭的问题长记录，生成日期：2026-06-01。",
  "",
  `- 归档数量：${allClosed.length}`,
  "- 归档状态：`已修复`、`业务接受`、`已回退`、`已修复，后续可继续优化`",
  "- 当前入口：`docs/06-implementation/open-issues.md`",
  "- 全量索引：`docs/06-implementation/open-issues-index.md`",
  "",
  "## 已归档问题",
  "",
  ...allClosed.map((item) => item.content),
  "",
].join("\n");

const activeTableRows = active.map((item) => `| ${item.id} | ${item.status || "未填写"} | ${escapeTable(item.title)} |`).join("\n");
const currentContent = [
  "# Open Issues",
  "",
  "本文件现在只保留当前仍需处理或确认的问题、问题模板和治理入口。已关闭问题的完整记录已归档，避免当前入口继续膨胀。",
  "",
  "## 治理入口",
  "",
  `- 当前未关闭问题数：${active.length}`,
  `- 已关闭归档问题数：${allClosed.length}`,
  "- 全量索引：`docs/06-implementation/open-issues-index.md`",
  "- 已关闭问题归档：`docs/05-archive/open-issues-history/2026-06.md`",
  duplicateIds.length ? `- 重复编号待治理：${duplicateIds.map((id) => `\`${id}\``).join("、")}，索引中使用 \`OI-xxx#n\` 区分历史条目。` : "- 重复编号待治理：无。",
  "",
  "## 当前未关闭问题",
  "",
  "| 编号 | 状态 | 标题 |",
  "|---|---|---|",
  activeTableRows || "| 无 | - | - |",
  "",
  "## 问题记录模板",
  "",
  template ? sanitizeTemplateContent(template.content) : "暂无模板。",
  "",
  "## 当前问题详情",
  "",
  ...active.map((item) => item.content),
  "",
].join("\n");

const statusRows = Object.entries(statusCounts)
  .sort(([left], [right]) => left.localeCompare(right, "zh-Hans-CN"))
  .map(([status, count]) => `| ${status} | ${count} |`)
  .join("\n");
const duplicateRows = duplicateIds.length
  ? indexRows
      .filter((row) => duplicateIds.includes(row.id))
      .map((row) => `| ${row.duplicateKey} | ${row.id} | ${row.status || "未填写"} | ${escapeTable(row.title)} | ${row.location} |`)
      .join("\n")
  : "| 无 | - | - | - | - |";
const indexTableRows = indexRows.map((row) => `| ${row.duplicateKey} | ${row.status || "未填写"} | ${escapeTable(row.title)} | ${escapeTable(row.type)} | ${row.location} |`).join("\n");
const indexContent = [
  "# Open Issues Index",
  "",
  "本索引用于快速定位当前问题和历史归档问题。完整历史正文请到对应位置查看。",
  "",
  "## 摘要",
  "",
  "- 生成日期：2026-06-01",
  `- 问题总数：${allIssueSections.length}`,
  `- 当前未关闭问题数：${active.length}`,
  `- 已关闭归档问题数：${allClosed.length}`,
  "- 当前入口：`docs/06-implementation/open-issues.md`",
  "- 已关闭归档：`docs/05-archive/open-issues-history/2026-06.md`",
  "",
  "## 状态分布",
  "",
  "| 状态 | 数量 |",
  "|---|---:|",
  statusRows,
  "",
  "## 重复编号",
  "",
  "| 索引键 | 原编号 | 状态 | 标题 | 位置 |",
  "|---|---|---|---|---|",
  duplicateRows,
  "",
  "## 全量索引",
  "",
  "| 索引键 | 状态 | 标题 | 类型 | 位置 |",
  "|---|---|---|---|---|",
  indexTableRows,
  "",
].join("\n");

await writeFile(archivePath, archiveContent, "utf8");
await writeFile(sourcePath, currentContent, "utf8");
await writeFile(indexPath, indexContent, "utf8");

console.log(
  JSON.stringify(
    {
      result: "pass",
      issues: allIssueSections.length,
      active: active.length,
      archived: allClosed.length,
      duplicateIds,
      files: [sourcePath, archivePath, indexPath],
    },
    null,
    2,
  ),
);
