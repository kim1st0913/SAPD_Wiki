#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const ROOT = process.cwd();
const DATA_ROOT = path.join(ROOT, "frontend", "capability-browser", "public", "data");
const GENERATED_ROOT = path.join(ROOT, "frontend", "capability-browser", "generated");
const OUT_DIR = path.join(ROOT, "data", "exports", "worker-verify", "security-technical-service-reference-integrity");

const SERVICE_CODE_RE = /\b(?:(?:ALL|I-[A-Z]{2})&T-[A-Z]{2}\.[A-Z]{2}-\d{2}|M-[A-Z]{2}\.[A-Z]{2}-00)\b/g;

const KNOWN_STALE_CODE_HINTS = new Map([
  ["I-OS&T-AS.DS-01", "I-AP&T-AS.DS-01"],
  ["I-OS&T-AS.DS-02", "I-AP&T-AS.DS-02"],
  ["I-OS&T-AS.DS-03", "I-AP&T-AS.DS-03"],
  ["I-OS&T-AS.DS-04", "I-AP&T-AS.DS-04"],
  ["I-OS&T-AS.DS-05", "I-AP&T-AS.DS-05"],
  ["I-OS&T-AS.DS-06", "I-AP&T-AS.DS-06"],
]);

const FORMAL_RUNTIME_FILES = new Set([
  "capability-tree.json",
  "capability-workbench.json",
  "environment-workbench.json",
  "lifecycle-knowledge.json",
  "lifecycle-workbench.json",
  "maintenance-knowledge.json",
  "maintenance-index.json",
  "maintenance/services.json",
  "maintenance/modules.json",
  "maintenance/measures.json",
]);

function readJson(absolutePath) {
  return JSON.parse(fs.readFileSync(absolutePath, "utf8"));
}

function writeJson(absolutePath, payload) {
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(absolutePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

function writeText(absolutePath, text) {
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(absolutePath, `${text.trimEnd()}\n`, "utf8");
}

function normalizeText(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function rel(absolutePath) {
  return path.relative(ROOT, absolutePath).split(path.sep).join("/");
}

function listJsonFiles(directory) {
  if (!fs.existsSync(directory)) return [];
  const files = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      const relative = rel(absolute);
      if (relative.includes("/standards/") || relative.endsWith("/standards")) continue;
      if (relative.includes("/source-evidence/") || relative.endsWith("/source-evidence")) continue;
      files.push(...listJsonFiles(absolute));
    } else if (entry.isFile() && entry.name.endsWith(".json")) {
      files.push(absolute);
    }
  }
  return files.sort();
}

function packageClass(relativePath) {
  if (relativePath.startsWith("frontend/capability-browser/generated/")) return "generated";
  const dataRelative = relativePath.replace("frontend/capability-browser/public/data/", "");
  if (FORMAL_RUNTIME_FILES.has(dataRelative)) return "formal_runtime";
  if (dataRelative.startsWith("review/")) return "review_artifact";
  return "supporting_data";
}

function canonicalServices() {
  const servicesPath = path.join(DATA_ROOT, "maintenance", "services.json");
  const payload = readJson(servicesPath);
  const services = [];
  for (const entry of Array.isArray(payload.security_technical_services) ? payload.security_technical_services : []) {
    const service = entry?.service && typeof entry.service === "object" ? entry.service : entry;
    const code = normalizeText(service?.code);
    const title = normalizeText(service?.title ?? service?.name);
    if (!code && !title) continue;
    services.push({
      id: normalizeText(service?.id),
      code,
      title,
      category: normalizeText(service?.category),
    });
  }
  return services;
}

function buildIndex(services) {
  const byCode = new Map();
  const byTitle = new Map();
  const byId = new Map();
  for (const service of services) {
    if (service.code) byCode.set(service.code, service);
    if (service.title) {
      const rows = byTitle.get(service.title) || [];
      rows.push(service);
      byTitle.set(service.title, rows);
    }
    if (service.id) byId.set(service.id, service);
  }
  return { byCode, byTitle, byId };
}

function titleAfterCode(value, code, endIndex = -1) {
  const text = normalizeText(value);
  const index = text.indexOf(code);
  if (index < 0) return "";
  const rawTail = endIndex > index ? text.slice(index + code.length, endIndex) : text.slice(index + code.length);
  const tail = rawTail.trim().replace(/^[/、|:：,，;；]+|[/、|:：,，;；]+$/g, "").trim();
  if (!tail) return "";
  if (/^[|:：,，;；]/.test(tail)) return "";
  return tail.split(/[|,，;；]/)[0].trim();
}

function referenceLabel(value) {
  return normalizeText(value?.securityTechnicalService ?? value?.security_technical_service ?? value?.title ?? value?.name ?? value?.label ?? "");
}

function addIssue(issues, kind, details) {
  issues.push({
    kind,
    severity: details.packageClass === "formal_runtime" ? "error" : "warning",
    ...details,
  });
}

function validateCodeReference({ code, explicitTitle, file, jsonPath, packageClassName, index, issues }) {
  const canonical = index.byCode.get(code);
  if (!canonical) {
    const expectedCode = KNOWN_STALE_CODE_HINTS.get(code) || "";
    const expected = expectedCode ? index.byCode.get(expectedCode) : null;
    addIssue(issues, "unknown_service_code", {
      file,
      packageClass: packageClassName,
      path: jsonPath,
      code,
      title: explicitTitle,
      expectedCode,
      expectedTitle: expected?.title || "",
    });
    return;
  }
  if (explicitTitle && canonical.title && explicitTitle !== canonical.title) {
    addIssue(issues, "service_title_mismatch", {
      file,
      packageClass: packageClassName,
      path: jsonPath,
      code,
      title: explicitTitle,
      expectedCode: canonical.code,
      expectedTitle: canonical.title,
    });
  }
}

function inspectObject(node, file, jsonPath, packageClassName, index, issues, references) {
  const type = normalizeText(node?.type ?? node?.objectType ?? node?.object_type);
  if (type === "security_technical_service") {
    const code = normalizeText(node.code);
    const title = normalizeText(node.title ?? node.name);
    const id = normalizeText(node.id);
    const byId = id ? index.byId.get(id) : null;
    const byCode = code ? index.byCode.get(code) : null;
    const titleMatches = title ? index.byTitle.get(title) || [] : [];
    references.push({ file, packageClass: packageClassName, path: jsonPath, code, title, id });
    if (code) {
      validateCodeReference({ code, explicitTitle: title, file, jsonPath, packageClassName, index, issues });
    } else if (id && !byId && titleMatches.length !== 1) {
      addIssue(issues, "unknown_service_object", { file, packageClass: packageClassName, path: jsonPath, id, code, title });
    }
    if (id && byCode && byCode.id && id !== byCode.id && !id.startsWith("shadow:")) {
      addIssue(issues, "service_id_mismatch", {
        file,
        packageClass: packageClassName,
        path: jsonPath,
        id,
        expectedId: byCode.id,
        code,
        title,
      });
    }
  }
  for (const [key, value] of Object.entries(node)) {
    const keyText = String(key);
    if (!/service/i.test(keyText) && !/安全技术服务/.test(keyText)) continue;
    if (typeof value === "string") {
      scanString(value, file, `${jsonPath}.${keyText}`, packageClassName, index, issues, references);
    } else if (Array.isArray(value)) {
      value.forEach((item, itemIndex) => {
        if (typeof item === "string") {
          scanString(item, file, `${jsonPath}.${keyText}[${itemIndex}]`, packageClassName, index, issues, references);
        }
      });
    }
  }
}

function scanString(value, file, jsonPath, packageClassName, index, issues, references) {
  const text = normalizeText(value);
  if (!text) return;
  const matches = [...text.matchAll(SERVICE_CODE_RE)];
  for (const [matchIndex, match] of matches.entries()) {
    const code = match[0];
    const nextMatch = matches[matchIndex + 1];
    const explicitTitle = titleAfterCode(text, code, nextMatch?.index ?? -1);
    references.push({ file, packageClass: packageClassName, path: jsonPath, code, title: explicitTitle, value: text });
    validateCodeReference({ code, explicitTitle, file, jsonPath, packageClassName, index, issues });
  }
}

function walk(node, file, jsonPath, packageClassName, index, issues, references) {
  if (Array.isArray(node)) {
    node.forEach((item, itemIndex) => walk(item, file, `${jsonPath}[${itemIndex}]`, packageClassName, index, issues, references));
    return;
  }
  if (node && typeof node === "object") {
    inspectObject(node, file, jsonPath, packageClassName, index, issues, references);
    for (const [key, value] of Object.entries(node)) walk(value, file, `${jsonPath}.${key}`, packageClassName, index, issues, references);
  }
}

function countBy(rows, keyFn) {
  const counts = new Map();
  for (const row of rows) {
    const key = keyFn(row);
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return Object.fromEntries([...counts.entries()].sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0]))));
}

function groupedSamples(rows, keyFn, limit = 10) {
  const grouped = new Map();
  for (const row of rows) {
    const key = keyFn(row);
    const bucket = grouped.get(key) || [];
    if (bucket.length < limit) bucket.push(row);
    grouped.set(key, bucket);
  }
  return Object.fromEntries([...grouped.entries()].sort(([left], [right]) => String(left).localeCompare(String(right))));
}

function renderMarkdown(payload) {
  const lines = [
    "# 安全技术服务引用一致性审计",
    "",
    "## 摘要",
    "",
    `- 审计状态：\`${payload.status}\``,
    `- 字典服务数：\`${payload.summary.canonicalServiceCount}\``,
    `- 扫描文件数：\`${payload.summary.filesChecked}\``,
    `- 引用数：\`${payload.summary.referenceCount}\``,
    `- 问题数：\`${payload.summary.issueCount}\``,
    `- 正式运行包问题数：\`${payload.summary.formalRuntimeIssueCount}\``,
    `- 派生 / review 问题数：\`${payload.summary.nonRuntimeIssueCount}\``,
    "",
    "## 问题类型",
    "",
  ];
  for (const [kind, count] of Object.entries(payload.summary.issuesByKind)) lines.push(`- \`${kind}\`: ${count}`);
  if (!Object.keys(payload.summary.issuesByKind).length) lines.push("- 无");
  lines.push("", "## 正式运行包问题样例", "");
  const formalIssues = payload.issues.filter((item) => item.packageClass === "formal_runtime");
  if (!formalIssues.length) {
    lines.push("- 无");
  } else {
    for (const issue of formalIssues.slice(0, 50)) {
      lines.push(`- \`${issue.file}\` ${issue.path}: \`${issue.code || issue.id || ""}\` ${issue.title || ""} -> ${issue.expectedCode || issue.expectedTitle || "未命中字典"}`);
    }
  }
  lines.push("", "## 派生 / review 问题样例", "");
  const nonRuntimeIssues = payload.issues.filter((item) => item.packageClass !== "formal_runtime");
  if (!nonRuntimeIssues.length) {
    lines.push("- 无");
  } else {
    for (const issue of nonRuntimeIssues.slice(0, 50)) {
      lines.push(`- \`${issue.file}\` ${issue.path}: \`${issue.code || issue.id || ""}\` ${issue.title || ""} -> ${issue.expectedCode || issue.expectedTitle || "未命中字典"}`);
    }
  }
  return lines.join("\n");
}

function main() {
  const services = canonicalServices();
  const index = buildIndex(services);
  const files = [
    ...listJsonFiles(DATA_ROOT),
    ...listJsonFiles(GENERATED_ROOT),
  ];
  const issues = [];
  const references = [];

  for (const absolutePath of files) {
    const relativePath = rel(absolutePath);
    const packageClassName = packageClass(relativePath);
    const payload = readJson(absolutePath);
    walk(payload, relativePath, "$", packageClassName, index, issues, references);
  }

  const formalIssues = issues.filter((item) => item.packageClass === "formal_runtime");
  const payload = {
    status: formalIssues.length ? "fail" : issues.length ? "warnings" : "pass",
    generatedAt: new Date().toISOString(),
    summary: {
      canonicalServiceCount: services.length,
      filesChecked: files.length,
      referenceCount: references.length,
      issueCount: issues.length,
      formalRuntimeIssueCount: formalIssues.length,
      nonRuntimeIssueCount: issues.length - formalIssues.length,
      referencesByPackageClass: countBy(references, (item) => item.packageClass),
      issuesByPackageClass: countBy(issues, (item) => item.packageClass),
      issuesByKind: countBy(issues, (item) => item.kind),
      issuesByFile: countBy(issues, (item) => item.file),
    },
    issueSamplesByKind: groupedSamples(issues, (item) => item.kind, 10),
    issues,
  };

  writeJson(path.join(OUT_DIR, "security-technical-service-reference-integrity.json"), payload);
  writeText(path.join(OUT_DIR, "security-technical-service-reference-integrity.md"), renderMarkdown(payload));
  console.log(JSON.stringify({
    status: payload.status,
    outputDir: rel(OUT_DIR),
    ...payload.summary,
  }, null, 2));
  if (formalIssues.length) process.exitCode = 1;
}

main();
