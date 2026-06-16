#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const ROOT = process.cwd();
const DATA_ROOT = path.join(ROOT, "frontend", "capability-browser", "public", "data");
const OUT_DIR = path.join(ROOT, "data", "exports", "worker-verify", "security-technical-service-reference-candidate");
const CANDIDATE_DIR = path.join(OUT_DIR, "candidate-files");

const TARGET_FILES = [
  "lifecycle-knowledge.json",
  "lifecycle-workbench.json",
  "maintenance/scopes.json",
  "shared-lookups.json",
];

const REVIEW_ARTIFACTS_TO_REGENERATE = [
  "review/environment-manual-review-checklist.json",
];

const SERVICE_CODE_RE = /\b(?:(?:ALL|I-[A-Z]{2})&T-[A-Z]{2}\.[A-Z]{2}-\d{2}|M-[A-Z]{2}\.[A-Z]{2}-00)\b/g;

const KNOWN_CODE_MIGRATIONS = new Map([
  ["I-OS&T-AS.DS-01", "I-AP&T-AS.DS-01"],
  ["I-OS&T-AS.DS-02", "I-AP&T-AS.DS-02"],
  ["I-OS&T-AS.DS-03", "I-AP&T-AS.DS-03"],
  ["I-OS&T-AS.DS-04", "I-AP&T-AS.DS-04"],
  ["I-OS&T-AS.DS-05", "I-AP&T-AS.DS-05"],
  ["I-OS&T-AS.DS-06", "I-AP&T-AS.DS-06"],
]);

function readJson(absolutePath) {
  return JSON.parse(fs.readFileSync(absolutePath, "utf8"));
}

function writeJson(absolutePath, payload) {
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(absolutePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

function writeText(absolutePath, body) {
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(absolutePath, `${body.trimEnd()}\n`, "utf8");
}

function normalizeText(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function sha256(absolutePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(absolutePath)).digest("hex");
}

function hashValue(value) {
  return crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function rel(absolutePath) {
  return path.relative(ROOT, absolutePath).split(path.sep).join("/");
}

function canonicalServices() {
  const payload = readJson(path.join(DATA_ROOT, "maintenance", "services.json"));
  return (payload.security_technical_services || []).map((entry) => {
    const service = entry?.service && typeof entry.service === "object" ? entry.service : entry;
    return {
      id: normalizeText(service.id),
      type: "security_technical_service",
      code: normalizeText(service.code),
      title: normalizeText(service.title ?? service.name),
      name: normalizeText(service.title ?? service.name),
      description: service.description ?? null,
      category: normalizeText(service.category),
    };
  }).filter((service) => service.code && service.title);
}

function buildIndex(services) {
  const byCode = new Map();
  const byTitle = new Map();
  const byId = new Map();
  for (const service of services) {
    byCode.set(service.code, service);
    byId.set(service.id, service);
    const titleRows = byTitle.get(service.title) || [];
    titleRows.push(service);
    byTitle.set(service.title, titleRows);
  }
  return { byCode, byTitle, byId };
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function recordChange(changes, change) {
  changes.push(change);
}

function titleSegment(text, match, nextMatch) {
  const start = match.index + match[0].length;
  const end = nextMatch ? nextMatch.index : text.length;
  return text.slice(start, end).trim().replace(/^[/、|:：,，;；]+|[/、|:：,，;；]+$/g, "").trim();
}

function canonicalForReference({ code, title, id }, index) {
  const normalizedCode = normalizeText(code);
  const normalizedTitle = normalizeText(title);
  const normalizedId = normalizeText(id);
  if (normalizedCode && index.byCode.has(normalizedCode)) {
    return { canonical: index.byCode.get(normalizedCode), reason: "code" };
  }
  if (KNOWN_CODE_MIGRATIONS.has(normalizedCode)) {
    const migrated = KNOWN_CODE_MIGRATIONS.get(normalizedCode);
    return { canonical: index.byCode.get(migrated) || null, reason: "known_code_migration", oldCode: normalizedCode };
  }
  if (normalizedId && index.byId.has(normalizedId)) {
    return { canonical: index.byId.get(normalizedId), reason: "id" };
  }
  const titleMatches = normalizedTitle ? index.byTitle.get(normalizedTitle) || [] : [];
  if (titleMatches.length === 1) return { canonical: titleMatches[0], reason: "unique_title" };
  if (titleMatches.length > 1) return { canonical: null, reason: "ambiguous_title", choices: titleMatches };
  return { canonical: null, reason: "unmatched" };
}

function fixServiceObject(node, context, index, idMap, changes, confirmations) {
  const type = normalizeText(node?.type ?? node?.objectType ?? node?.object_type);
  if (type !== "security_technical_service") return;
  const before = {
    id: normalizeText(node.id),
    code: normalizeText(node.code),
    title: normalizeText(node.title ?? node.name),
    category: normalizeText(node.category),
  };
  const { canonical, reason, choices } = canonicalForReference(before, index);
  if (!canonical) {
    confirmations.push({
      file: context.file,
      path: context.path,
      reason,
      before,
      choices: choices || [],
    });
    return;
  }
  if (before.id && before.id !== canonical.id) idMap.set(before.id, canonical.id);
  const updates = {
    id: canonical.id,
    code: canonical.code,
    title: canonical.title,
    name: canonical.title,
    category: canonical.category,
  };
  const changed = [];
  for (const [key, value] of Object.entries(updates)) {
    if (key in node && normalizeText(node[key]) !== normalizeText(value)) changed.push(key);
    if ((key === "title" || key === "name") && !(key in node)) continue;
    if (key === "category" && !("category" in node)) continue;
    node[key] = value;
  }
  if (changed.length) {
    recordChange(changes, {
      file: context.file,
      path: context.path,
      kind: "service_object_canonicalized",
      reason,
      before,
      after: updates,
      changedFields: changed,
    });
  }
}

function replaceServiceCodesInString(value, context, index, changes, confirmations) {
  const text = String(value);
  const matches = [...text.matchAll(SERVICE_CODE_RE)];
  if (!matches.length) return value;
  let result = "";
  let cursor = 0;
  let changed = false;
  for (const [matchIndex, match] of matches.entries()) {
    const code = match[0];
    const nextMatch = matches[matchIndex + 1];
    const segmentEnd = nextMatch ? nextMatch.index : text.length;
    const oldSegment = text.slice(match.index, segmentEnd);
    const oldTitle = titleSegment(text, match, nextMatch);
    const { canonical, reason, choices } = canonicalForReference({ code, title: oldTitle }, index);
    if (!canonical) {
      confirmations.push({
        file: context.file,
        path: context.path,
        reason,
        before: { code, title: oldTitle, value: oldSegment.trim() },
        choices: choices || [],
      });
      continue;
    }
    const hasTitle = oldTitle.length > 0;
    const newSegment = hasTitle ? `${canonical.code} ${canonical.title}` : canonical.code;
    result += text.slice(cursor, match.index);
    result += newSegment;
    cursor = segmentEnd;
    if (oldSegment !== newSegment) {
      changed = true;
      recordChange(changes, {
        file: context.file,
        path: context.path,
        kind: reason === "known_code_migration" ? "service_code_migrated" : "service_string_canonicalized",
        before: oldSegment.trim(),
        after: newSegment,
        code,
        title: oldTitle,
        canonical: { id: canonical.id, code: canonical.code, title: canonical.title },
        reason,
      });
    }
  }
  result += text.slice(cursor);
  return changed ? result : value;
}

function fixRelationIds(node, context, idMap, changes) {
  if (!node || typeof node !== "object") return;
  for (const field of ["sourceId", "targetId"]) {
    const typeField = field === "sourceId" ? "sourceType" : "targetType";
    if (node[typeField] !== "security_technical_service") continue;
    const before = normalizeText(node[field]);
    const after = idMap.get(before);
    if (!after || after === before) continue;
    node[field] = after;
    recordChange(changes, {
      file: context.file,
      path: `${context.path}.${field}`,
      kind: "service_relation_id_canonicalized",
      before,
      after,
    });
  }
}

function walk(node, context, index, idMap, changes, confirmations) {
  if (Array.isArray(node)) {
    node.forEach((item, itemIndex) => walk(item, { ...context, path: `${context.path}[${itemIndex}]` }, index, idMap, changes, confirmations));
    return;
  }
  if (!node || typeof node !== "object") return;

  fixServiceObject(node, context, index, idMap, changes, confirmations);
  fixRelationIds(node, context, idMap, changes);

  for (const [key, value] of Object.entries(node)) {
    const childPath = `${context.path}.${key}`;
    if (typeof value === "string") {
      const replaced = replaceServiceCodesInString(value, { ...context, path: childPath }, index, changes, confirmations);
      if (replaced !== value) node[key] = replaced;
    } else if (value && typeof value === "object") {
      walk(value, { ...context, path: childPath }, index, idMap, changes, confirmations);
    }
  }
}

function collectServiceIdMappings(node, index, idMap) {
  if (Array.isArray(node)) {
    node.forEach((item) => collectServiceIdMappings(item, index, idMap));
    return;
  }
  if (!node || typeof node !== "object") return;
  const type = normalizeText(node?.type ?? node?.objectType ?? node?.object_type);
  if (type === "security_technical_service") {
    const before = {
      id: normalizeText(node.id),
      code: normalizeText(node.code),
      title: normalizeText(node.title ?? node.name),
      category: normalizeText(node.category),
    };
    const { canonical } = canonicalForReference(before, index);
    if (canonical && before.id && before.id !== canonical.id) idMap.set(before.id, canonical.id);
  }
  for (const child of Object.values(node)) collectServiceIdMappings(child, index, idMap);
}

function fixPayload(payload, file, index, seedIdMap) {
  const candidate = clone(payload);
  const changes = [];
  const confirmations = [];
  const idMap = new Map(seedIdMap);

  walk(candidate, { file, path: "$" }, index, idMap, changes, confirmations);
  if (idMap.size) {
    walk(candidate, { file, path: "$" }, index, idMap, changes, confirmations);
  }
  return { candidate, changes, confirmations, idMap: Object.fromEntries(idMap.entries()) };
}

function summarizeChanges(rows) {
  const result = {};
  for (const row of rows) {
    const key = row.kind;
    result[key] = (result[key] || 0) + 1;
  }
  return Object.fromEntries(Object.entries(result).sort(([left], [right]) => left.localeCompare(right)));
}

function summarizeByFile(rows) {
  const result = {};
  for (const row of rows) result[row.file] = (result[row.file] || 0) + 1;
  return Object.fromEntries(Object.entries(result).sort(([left], [right]) => left.localeCompare(right)));
}

function validateCandidateValue(value, context, index, issues) {
  if (Array.isArray(value)) {
    value.forEach((item, itemIndex) => validateCandidateValue(item, { ...context, path: `${context.path}[${itemIndex}]` }, index, issues));
    return;
  }
  if (typeof value === "string") {
    const matches = [...value.matchAll(SERVICE_CODE_RE)];
    for (const [matchIndex, match] of matches.entries()) {
      const code = match[0];
      const nextMatch = matches[matchIndex + 1];
      const title = titleSegment(value, match, nextMatch);
      const canonical = index.byCode.get(code);
      if (!canonical) {
        issues.push({ file: context.file, path: context.path, kind: "unknown_service_code", code, title });
      } else if (title && title !== canonical.title) {
        issues.push({ file: context.file, path: context.path, kind: "service_title_mismatch", code, title, expectedTitle: canonical.title });
      }
    }
    return;
  }
  if (!value || typeof value !== "object") return;

  const type = normalizeText(value.type ?? value.objectType ?? value.object_type);
  if (type === "security_technical_service") {
    const id = normalizeText(value.id);
    const code = normalizeText(value.code);
    const title = normalizeText(value.title ?? value.name);
    const canonical = index.byCode.get(code);
    if (!canonical) {
      issues.push({ file: context.file, path: context.path, kind: "unknown_service_object", id, code, title });
    } else {
      if (id && id !== canonical.id && !id.startsWith("shadow:")) issues.push({ file: context.file, path: context.path, kind: "service_id_mismatch", id, expectedId: canonical.id, code, title });
      if (title && title !== canonical.title) issues.push({ file: context.file, path: context.path, kind: "service_title_mismatch", id, code, title, expectedTitle: canonical.title });
    }
  }
  for (const field of ["sourceId", "targetId"]) {
    const typeField = field === "sourceId" ? "sourceType" : "targetType";
    if (value[typeField] !== "security_technical_service") continue;
    const id = normalizeText(value[field]);
    if (id && !index.byId.has(id) && !id.startsWith("shadow:")) {
      issues.push({ file: context.file, path: `${context.path}.${field}`, kind: "unknown_service_relation_id", id });
    }
  }
  for (const [key, child] of Object.entries(value)) {
    validateCandidateValue(child, { ...context, path: `${context.path}.${key}` }, index, issues);
  }
}

function renderMappingMd(autoFixes, confirmations) {
  const formatValue = (value) => {
    if (value == null) return "";
    if (typeof value === "string") return `\`${value}\``;
    if (typeof value === "object") {
      const compact = [value.id, value.code, value.title || value.name].filter(Boolean).join(" | ");
      return compact ? `\`${compact}\`` : `\`${JSON.stringify(value)}\``;
    }
    return `\`${String(value)}\``;
  };
  const lines = ["# 安全技术服务引用候选修复清单", "", "## 自动可修复映射", ""];
  if (!autoFixes.length) lines.push("- 无");
  for (const row of autoFixes.slice(0, 200)) {
    lines.push(`- \`${row.file}\` ${row.path}: ${formatValue(row.before)} -> ${formatValue(row.after)}`);
  }
  lines.push("", "## 需要用户确认映射", "");
  if (!confirmations.length) lines.push("- 无");
  for (const row of confirmations.slice(0, 100)) {
    lines.push(`- \`${row.file}\` ${row.path}: ${JSON.stringify(row.before)}，原因：\`${row.reason}\``);
  }
  return lines.join("\n");
}

function renderDiffMd(payload) {
  const lines = ["# OI-143 安全技术服务引用候选 diff", "", "## 摘要", ""];
  for (const [key, value] of Object.entries(payload.summary)) lines.push(`- \`${key}\`: ${JSON.stringify(value)}`);
  lines.push("", "## 按文件变更", "");
  for (const file of payload.files) {
    lines.push(`- \`${file.file}\`: changes=${file.changeCount}, confirmations=${file.confirmationCount}, before=${file.beforeHash}, candidate=${file.candidateHash}`);
  }
  lines.push("", "## 派生产物处理", "");
  for (const item of payload.reviewArtifacts) lines.push(`- \`${item.file}\`: ${item.action}`);
  return lines.join("\n");
}

function main() {
  const services = canonicalServices();
  const index = buildIndex(services);
  const files = [];
  const allChanges = [];
  const allConfirmations = [];
  const sourcePayloads = new Map();
  const globalIdMap = new Map();

  fs.rmSync(OUT_DIR, { recursive: true, force: true });
  fs.mkdirSync(CANDIDATE_DIR, { recursive: true });

  for (const relativeFile of TARGET_FILES) {
    const sourcePath = path.join(DATA_ROOT, relativeFile);
    const payload = readJson(sourcePath);
    sourcePayloads.set(relativeFile, { sourcePath, payload });
    collectServiceIdMappings(payload, index, globalIdMap);
  }

  for (const relativeFile of TARGET_FILES) {
    const { sourcePath, payload } = sourcePayloads.get(relativeFile);
    const beforeHash = sha256(sourcePath);
    const beforeSemanticHash = hashValue(payload);
    const { candidate, changes, confirmations, idMap } = fixPayload(payload, relativeFile, index, globalIdMap);
    const candidatePath = path.join(CANDIDATE_DIR, relativeFile);
    writeJson(candidatePath, candidate);
    const candidateHash = sha256(candidatePath);
    const candidateSemanticHash = hashValue(candidate);
    files.push({
      file: relativeFile,
      sourcePath: rel(sourcePath),
      candidatePath: rel(candidatePath),
      beforeHash,
      candidateHash,
      beforeSemanticHash,
      candidateSemanticHash,
      changed: beforeSemanticHash !== candidateSemanticHash,
      changeCount: changes.length,
      confirmationCount: confirmations.length,
      idMappings: idMap,
      changesByKind: summarizeChanges(changes),
    });
    allChanges.push(...changes);
    allConfirmations.push(...confirmations);
  }

  const payload = {
    version: 1,
    generatedAt: new Date().toISOString(),
    status: allConfirmations.length ? "needs_user_confirmation" : "ready_for_user_confirmation",
    summary: {
      canonicalServiceCount: services.length,
      targetFileCount: TARGET_FILES.length,
      changedFileCount: files.filter((file) => file.changed).length,
      autoFixCount: allChanges.length,
      needsUserConfirmationCount: allConfirmations.length,
      autoFixesByKind: summarizeChanges(allChanges),
      autoFixesByFile: summarizeByFile(allChanges),
      confirmationsByFile: summarizeByFile(allConfirmations),
      formalDataReplaced: false,
      sqliteModified: false,
      dictionaryModified: false,
      environmentMappingModified: false,
    },
    files,
    autoFixes: allChanges,
    needsUserConfirmation: allConfirmations,
    reviewArtifacts: REVIEW_ARTIFACTS_TO_REGENERATE.map((file) => ({
      file,
      action: "不手工 patch；正式运行包确认替换后，通过环境人工核对表生成脚本重新生成。",
    })),
    applyScope: {
      allowedAfterConfirmation: TARGET_FILES.map((file) => `frontend/capability-browser/public/data/${file}`),
      notAllowed: [
        "data/database/sapd_wiki.sqlite3",
        "data/raw-samples/wiki sample.xlsx",
        "frontend/capability-browser/public/data/maintenance/services.json",
        "frontend/capability-browser/public/data/environment-workbench.json",
        "frontend/capability-browser/generated/environmentBasemap.node-details.json",
        "frontend/capability-browser/public/data/standards*.json",
      ],
      reviewArtifactsRegenerateOnly: REVIEW_ARTIFACTS_TO_REGENERATE,
    },
  };

  const candidateIssues = [];
  for (const relativeFile of TARGET_FILES) {
    const candidatePath = path.join(CANDIDATE_DIR, relativeFile);
    validateCandidateValue(readJson(candidatePath), { file: relativeFile, path: "$" }, index, candidateIssues);
  }
  payload.candidateValidation = {
    status: candidateIssues.length ? "fail" : "pass",
    issueCount: candidateIssues.length,
    issuesByKind: summarizeChanges(candidateIssues),
    issuesByFile: summarizeByFile(candidateIssues),
    issues: candidateIssues,
  };
  payload.summary.candidateValidationStatus = payload.candidateValidation.status;
  payload.summary.candidateValidationIssueCount = candidateIssues.length;

  writeJson(path.join(OUT_DIR, "candidate-normalized-diff.json"), payload);
  writeText(path.join(OUT_DIR, "candidate-normalized-diff.md"), renderDiffMd(payload));
  writeJson(path.join(OUT_DIR, "candidate-validation.json"), payload.candidateValidation);
  writeJson(path.join(OUT_DIR, "auto-fix-mapping.json"), allChanges);
  writeJson(path.join(OUT_DIR, "needs-user-confirmation.json"), allConfirmations);
  writeText(path.join(OUT_DIR, "candidate-fix-lists.md"), renderMappingMd(allChanges, allConfirmations));
  writeJson(path.join(OUT_DIR, "candidate-apply-scope.json"), payload.applyScope);
  writeText(path.join(OUT_DIR, "derived-artifacts-regeneration-plan.md"), [
    "# 派生产物重生成计划",
    "",
    "- `review/environment-manual-review-checklist.json` 不在本轮手工 patch。",
    "- 正式运行包经用户确认替换后，再通过环境人工核对表构建脚本重新生成 review 产物。",
    "- 重生成前不恢复 Environment Mapping 写入线，不反向修改服务字典。",
  ].join("\n"));

  console.log(JSON.stringify({
    status: payload.status,
    outputDir: rel(OUT_DIR),
    ...payload.summary,
  }, null, 2));
}

main();
