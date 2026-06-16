#!/usr/bin/env node

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const FRONTEND_ROOT = join(ROOT, "frontend/capability-browser");
const DATA_ROOT = join(FRONTEND_ROOT, "public/data");
const REPORT_ROOT = join(ROOT, "data/exports/worker-verify");
const REPORT_JSON = join(REPORT_ROOT, "standard-framework-canonical-name-review.json");
const REPORT_MD = join(REPORT_ROOT, "standard-framework-canonical-name-review.md");

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function list(value) {
  return Array.isArray(value) ? value : [];
}

function text(value) {
  return value == null ? "" : String(value).replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
}

function uniq(values) {
  const seen = new Set();
  const rows = [];
  for (const value of values.map(text).filter(Boolean)) {
    const key = value.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    rows.push(value);
  }
  return rows;
}

function resolveDataPath(value) {
  const raw = text(value);
  if (!raw) return "";
  if (raw.startsWith("./public/data/")) return join(DATA_ROOT, raw.slice("./public/data/".length));
  if (raw.startsWith("public/data/")) return join(DATA_ROOT, raw.slice("public/data/".length));
  if (raw.startsWith("/")) return raw;
  return join(DATA_ROOT, raw);
}

function sourceNamesFromFramework(framework) {
  const names = [];
  if (framework.dataPath) {
    const payload = readJson(resolveDataPath(framework.dataPath));
    names.push(payload.frameworkTitle, payload.title);
  }
  for (const tab of list(framework.tabs)) {
    const payload = readJson(resolveDataPath(tab.dataPath));
    names.push(payload.frameworkTitle);
  }
  return uniq(names);
}

function sidebarNamesById() {
  const source = readFileSync(join(FRONTEND_ROOT, "components/AppShell.js"), "utf8");
  const rows = {};
  const regex = /\{\s*id:\s*"([^"]+)"\s*,\s*label:\s*"([^"]+)"\s*,\s*route:\s*"\/standards\/[^"]+"/g;
  let match;
  while ((match = regex.exec(source))) {
    rows[match[1]] = match[2];
  }
  return rows;
}

function capabilityRawNamesByCode(workbench) {
  const rows = {};
  for (const item of Object.values(workbench.objects?.standard_framework || {})) {
    const code = text(item.code || item.frameworkCode);
    if (!code) continue;
    rows[code] = uniq([...(rows[code] || []), item.title, item.name, item.frameworkTitle]);
  }
  return rows;
}

function chooseSuggestedName({ sourceNames, sidebarName, standardsDataNames, rawNames }) {
  const candidates = uniq([...sourceNames, sidebarName, ...standardsDataNames, ...rawNames]);
  const longName = candidates.find((name) => /GB\/T|Controls|Safeguards|Cybersecurity Framework/i.test(name) && name.length > 8);
  return longName || candidates[0] || "";
}

function actionFor({ currentDictionaryName, suggestedCanonicalName, aliasCandidates }) {
  if (!suggestedCanonicalName || suggestedCanonicalName === currentDictionaryName) {
    return aliasCandidates.length ? "add_alias_candidate" : "keep";
  }
  return "manual_review";
}

function main() {
  const standardsData = readJson(join(DATA_ROOT, "standards-data.json"));
  const standardsIndex = readJson(join(DATA_ROOT, "standards-index.json"));
  const capabilityWorkbench = readJson(join(DATA_ROOT, "capability-workbench.json"));
  const sidebars = sidebarNamesById();
  const rawNamesByCode = capabilityRawNamesByCode(capabilityWorkbench);
  const indexByCode = new Map(list(standardsIndex.frameworks).map((item) => [text(item.frameworkCode), item]));

  const standards = list(standardsData.frameworks).map((framework) => {
    const code = text(framework.frameworkCode);
    const indexFramework = indexByCode.get(code) || {};
    const sourceNames = sourceNamesFromFramework(framework);
    const currentDictionaryName = text(framework.title || framework.name);
    const currentSidebarName = text(sidebars[framework.id]);
    const standardsDataNames = uniq([framework.title, framework.name]);
    const standardsIndexNames = uniq([indexFramework.title, indexFramework.name]);
    const capabilityMappingRawNames = rawNamesByCode[code] || [];
    const aliasCandidates = uniq([
      ...sourceNames,
      currentSidebarName,
      ...standardsDataNames,
      ...standardsIndexNames,
      ...capabilityMappingRawNames,
    ]).filter((name) => name !== currentDictionaryName);
    const suggestedCanonicalName = chooseSuggestedName({
      sourceNames,
      sidebarName: currentSidebarName,
      standardsDataNames,
      rawNames: capabilityMappingRawNames,
    });
    const recommendedAction = actionFor({ currentDictionaryName, suggestedCanonicalName, aliasCandidates });
    return {
      standardKey: code || framework.id,
      standardId: framework.id,
      currentDictionaryName,
      currentSidebarName,
      capabilityMappingRawNames,
      standardsDataNames,
      standardsIndexNames,
      sourceFileNames: sourceNames,
      suggestedCanonicalName,
      aliasCandidates,
      recommendedAction,
      requiresUserConfirmation: recommendedAction !== "keep",
    };
  });

  const report = {
    status: "ready",
    generatedAt: new Date().toISOString(),
    scope: "P0 Baseline Canonical Data Correction 1.1 / Standard Framework Canonical Name Review",
    readonly: true,
    modifiedStandardsDictionary: false,
    summary: {
      frameworkCount: standards.length,
      requiresUserConfirmationCount: standards.filter((item) => item.requiresUserConfirmation).length,
      manualReviewCount: standards.filter((item) => item.recommendedAction === "manual_review").length,
      aliasCandidateCount: standards.filter((item) => item.aliasCandidates.length).length,
    },
    standards,
  };

  mkdirSync(REPORT_ROOT, { recursive: true });
  writeFileSync(REPORT_JSON, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  writeFileSync(
    REPORT_MD,
    [
      "# Standard Framework Canonical Name Review",
      "",
      `- 状态：\`${report.status}\``,
      `- 生成时间：\`${report.generatedAt}\``,
      `- 只读审计：\`${report.readonly}\``,
      `- 已修改标准字典：\`${report.modifiedStandardsDictionary}\``,
      `- 标准数量：\`${report.summary.frameworkCount}\``,
      `- 需要用户确认：\`${report.summary.requiresUserConfirmationCount}\``,
      "",
      "## 候选清单",
      "",
      "| standardKey | 当前字典名 | 侧边栏名 | raw 名称 | 建议 canonical 名称 | 建议动作 |",
      "|---|---|---|---|---|---|",
      ...standards.map((item) =>
        [
          item.standardKey,
          item.currentDictionaryName,
          item.currentSidebarName,
          item.capabilityMappingRawNames.join(" / "),
          item.suggestedCanonicalName,
          item.recommendedAction,
        ]
          .map((value) => String(value || "").replace(/\|/g, "\\|"))
          .join(" | ")
          .replace(/^/, "| ")
          .replace(/$/, " |"),
      ),
      "",
      "## 说明",
      "",
      "- 本报告不修改 `standards-data.json`、`standards-index.json` 或标准分片。",
      "- `manual_review` 表示建议名称与当前字典名不一致，需要用户确认后再修改标准字典。",
      "- `add_alias_candidate` 表示当前字典名可暂保留，但建议后续维护 alias。",
      "",
    ].join("\n"),
    "utf8",
  );

  console.log(`status=${report.status}`);
  console.log(`frameworks=${report.summary.frameworkCount}`);
  console.log(`requires_user_confirmation=${report.summary.requiresUserConfirmationCount}`);
  console.log(`manual_review=${report.summary.manualReviewCount}`);
  console.log(`json=${REPORT_JSON}`);
  console.log(`markdown=${REPORT_MD}`);
}

main();
