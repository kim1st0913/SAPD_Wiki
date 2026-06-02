#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const projectRoot = path.resolve(path.dirname(__filename), "..");
const baselinePath = path.join(projectRoot, "config/frontend-governance-baseline.json");
const openIssuesPath = path.join(projectRoot, "docs/06-implementation/open-issues.md");

function readProjectFile(relativePath) {
  return readFileSync(path.join(projectRoot, relativePath), "utf8");
}

function countMatches(text, pattern) {
  return (text.match(pattern) || []).length;
}

function metricsFor(relativePath) {
  const text = readProjectFile(relativePath);
  return {
    lines: text.split(/\r?\n/).length,
    important: countMatches(text, /!important/g),
    hexColors: countMatches(text, /#[0-9a-fA-F]{3,8}\b/g),
    rootBlocks: countMatches(text, /:root\b/g),
    relationChipMentions: countMatches(text, /relation-chip/g),
    colorMix: countMatches(text, /color-mix\(/g),
  };
}

function checkMax(issues, relativePath, label, actual, maxValue) {
  if (typeof maxValue !== "number") return;
  if (actual > maxValue) {
    issues.push(`${relativePath}: ${label}=${actual} exceeds baseline ${maxValue}`);
  }
}

function main() {
  if (!existsSync(baselinePath)) {
    console.error(`result=fail reason=missing_baseline path=${baselinePath}`);
    process.exit(1);
  }

  const baseline = JSON.parse(readFileSync(baselinePath, "utf8"));
  const issues = [];
  const summaries = [];

  for (const [relativePath, limits] of Object.entries(baseline.files || {})) {
    const absolutePath = path.join(projectRoot, relativePath);
    if (!existsSync(absolutePath)) {
      issues.push(`${relativePath}: missing file`);
      continue;
    }
    const metrics = metricsFor(relativePath);
    checkMax(issues, relativePath, "lines", metrics.lines, limits.maxLines);
    checkMax(issues, relativePath, "important", metrics.important, limits.maxImportant);
    checkMax(issues, relativePath, "hexColors", metrics.hexColors, limits.maxHexColors);
    checkMax(issues, relativePath, "rootBlocks", metrics.rootBlocks, limits.maxRootBlocks);
    checkMax(issues, relativePath, "relationChipMentions", metrics.relationChipMentions, limits.maxRelationChipMentions);
    checkMax(issues, relativePath, "colorMix", metrics.colorMix, limits.maxColorMix);
    summaries.push({ file: relativePath, ...metrics });
  }

  if (baseline.requiredIssue) {
    const openIssues = existsSync(openIssuesPath) ? readFileSync(openIssuesPath, "utf8") : "";
    if (!openIssues.includes(baseline.requiredIssue)) {
      issues.push(`docs/06-implementation/open-issues.md: missing ${baseline.requiredIssue}`);
    }
  }

  if (baseline.requiredReview && !existsSync(path.join(projectRoot, baseline.requiredReview))) {
    issues.push(`${baseline.requiredReview}: missing required review document`);
  }

  console.log(`baseline=${baseline.version}`);
  for (const summary of summaries) {
    console.log(
      [
        `file=${summary.file}`,
        `lines=${summary.lines}`,
        `important=${summary.important}`,
        `hexColors=${summary.hexColors}`,
        `rootBlocks=${summary.rootBlocks}`,
        `relationChipMentions=${summary.relationChipMentions}`,
        `colorMix=${summary.colorMix}`,
      ].join(" "),
    );
  }

  if (issues.length) {
    console.error("result=fail");
    for (const issue of issues) console.error(`issue=${issue}`);
    process.exit(1);
  }

  console.log("result=pass");
}

main();
