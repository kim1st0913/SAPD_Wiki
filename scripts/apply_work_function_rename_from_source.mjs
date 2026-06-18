#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const root = process.cwd();
const outRoot = path.join(root, "data/exports/worker-verify/work-function-rename-source-update/formal-apply");
const runId = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
const outDir = path.join(outRoot, runId);
const backupDir = path.join(outDir, "backups");
const candidateDir = path.join(outDir, "candidate-files");

const CODE12 = {
  id: "10075171-336e-4ed9-b574-353d221daaae",
  type: "work_function",
  code: "12",
  title: "安全合规管理职能",
  name: "安全合规管理职能",
  description:
    "负责领导组织内的网络安全合规活动，确保所有网络安全措施和政策符合法律法规、行业标准及组织内部规定。包括制定和维护合规框架，评估和监控网络安全措施的合规性，定期报告合规状况给高层管理层。确保组织在所有业务活动中的法律，保护组织免受法律风险和潜在罚款。",
  category: null,
};

const CODE75 = {
  id: "52b91f47-c0d2-4489-9c36-fd92bcbd6330",
  type: "work_function",
  code: "75",
  title: "企业合规管理职能",
  name: "企业合规管理职能",
  description:
    "负责确保组织遵守所有相关的法律、法规、标准和内部政策。这包括制定和维护企业合规框架，识别和评估合规风险，制定和实施合规策略和程序，以及监控和报告合规状态。职能工作涉及与各部门合作，提供合规培训和指导，处理合规查询和调查，以及管理和缓解合规违规的风险。",
  category: null,
};

const source12 = [
  { sheet: "安全工作职能清单", row: 14, column: "工作职能", cell: "E14", raw_value: "安全合规管理职能" },
  { sheet: "安全能力-安全管理元素（high level）", row: 75, column: "管理层", cell: "J75", raw_value: "安全合规管理职能" },
  { sheet: "安全能力-安全管理元素（high level）", row: 76, column: "管理层", cell: "J75", raw_value: "安全合规管理职能" },
  { sheet: "安全能力-安全管理元素（high level）", row: 77, column: "管理层", cell: "J75", raw_value: "安全合规管理职能" },
];

const source75 = [
  { sheet: "安全工作职能清单", row: 77, column: "工作职能", cell: "E77", raw_value: "企业合规管理职能" },
];

const targetFiles = [
  "frontend/capability-browser/public/data/maintenance/work-functions.json",
  "frontend/capability-browser/public/data/maintenance/processes.json",
  "frontend/capability-browser/public/data/maintenance/references.json",
  "frontend/capability-browser/public/data/maintenance-knowledge.json",
  "frontend/capability-browser/public/data/capability-tree.json",
  "frontend/capability-browser/public/data/capability-workbench.json",
];

function readJson(relative) {
  return JSON.parse(fs.readFileSync(path.join(root, relative), "utf8"));
}

function writeJson(file, payload) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(payload, null, 2)}\n`);
}

function sha256(file) {
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function jp(parts) {
  return parts.reduce((acc, part) => (typeof part === "number" ? `${acc}[${part}]` : `${acc}.${part}`), "$");
}

function setField(obj, key, value, changes, file, pathParts) {
  if (obj[key] === value) return;
  changes.push({ file, path: jp([...pathParts, key]), before: obj[key] ?? null, after: value });
  obj[key] = value;
}

function asWorkFunction(source, includeName = false) {
  const out = {
    id: source.id,
    type: "work_function",
    code: source.code,
    title: source.title,
    description: source.description,
    category: source.category,
  };
  if (includeName) out.name = source.name;
  return out;
}

function applyFunctionObject(obj, desired, changes, file, pathParts) {
  setField(obj, "id", desired.id, changes, file, pathParts);
  setField(obj, "type", "work_function", changes, file, pathParts);
  setField(obj, "code", desired.code, changes, file, pathParts);
  if ("name" in obj) setField(obj, "name", desired.name, changes, file, pathParts);
  setField(obj, "title", desired.title, changes, file, pathParts);
  setField(obj, "description", desired.description, changes, file, pathParts);
  if ("category" in obj) setField(obj, "category", obj.category === "" ? "" : desired.category, changes, file, pathParts);
}

function patchSources(obj, desiredSources, changes, file, pathParts) {
  if (!Array.isArray(obj.sources)) return;
  const before = JSON.stringify(obj.sources);
  obj.sources = clone(desiredSources);
  const after = JSON.stringify(obj.sources);
  if (before !== after) changes.push({ file, path: jp([...pathParts, "sources"]), before: JSON.parse(before), after: obj.sources });
}

function patchWorkFunctionsPackage(payload, changes, file) {
  for (const [layerIndex, layer] of (payload.work_function_layers || []).entries()) {
    for (const [groupIndex, group] of (layer.groups || []).entries()) {
      for (const [fnIndex, fn] of (group.functions || []).entries()) {
        const pathParts = ["work_function_layers", layerIndex, "groups", groupIndex, "functions", fnIndex];
        if (fn.code === "12" || fn.id === CODE12.id) {
          applyFunctionObject(fn, CODE12, changes, file, pathParts);
          patchSources(fn, source12, changes, file, pathParts);
        }
        if (fn.code === "75" || fn.id === CODE75.id) {
          applyFunctionObject(fn, CODE75, changes, file, pathParts);
          patchSources(fn, source75, changes, file, pathParts);
        }
      }
    }
  }
}

function patchWorkFunctionReferences(value, changes, file, pathParts = []) {
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) patchWorkFunctionReferences(value[index], changes, file, [...pathParts, index]);
    return;
  }
  if (!value || typeof value !== "object") return;

  if (value.type === "work_function") {
    if (value.id === CODE12.id || value.code === "12") {
      applyFunctionObject(value, CODE12, changes, file, pathParts);
      patchSources(value, source12, changes, file, pathParts);
    } else if (value.id === CODE75.id || value.code === "75" || value.id === "work-function-candidate:75") {
      if (value.id === "work-function-candidate:75") {
        setField(value, "title", CODE75.title, changes, file, pathParts);
      } else {
        applyFunctionObject(value, CODE75, changes, file, pathParts);
        patchSources(value, source75, changes, file, pathParts);
      }
    }
  }

  for (const [key, child] of Object.entries(value)) patchWorkFunctionReferences(child, changes, file, [...pathParts, key]);
}

function patchHighLevelStakeholderReferences(value, changes, file, pathParts = []) {
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) patchHighLevelStakeholderReferences(value[index], changes, file, [...pathParts, index]);
    return;
  }
  if (!value || typeof value !== "object") return;

  if (value.type === "work_function" && value.id === CODE75.id && value.code === "75") {
    const sourceText = JSON.stringify(value.sources || []);
    if (sourceText.includes("安全能力-安全管理元素（high level）") || pathParts.join(".").includes("stakeholders")) {
      applyFunctionObject(value, CODE12, changes, file, pathParts);
      patchSources(value, source12, changes, file, pathParts);
    }
  }

  for (const [key, child] of Object.entries(value)) patchHighLevelStakeholderReferences(child, changes, file, [...pathParts, key]);
}

function patchCapabilityWorkbench(payload, changes, file) {
  const objects = payload.objects?.work_function || {};
  const oldObj = objects[CODE75.id];
  if (oldObj) {
    const replacement = { ...clone(oldObj), id: CODE12.id, code: CODE12.code, name: CODE12.name, title: CODE12.title, description: CODE12.description, layer: "管理层" };
    delete objects[CODE75.id];
    objects[CODE12.id] = replacement;
    changes.push({ file, path: "$.objects.work_function", before: CODE75.id, after: CODE12.id });
  }
  for (const [index, relation] of (payload.relations || []).entries()) {
    if (relation.targetType === "work_function" && relation.targetId === CODE75.id) {
      setField(relation, "targetId", CODE12.id, changes, file, ["relations", index]);
    }
  }
}

function patchCapabilityTree(payload, changes, file) {
  patchHighLevelStakeholderReferences(payload, changes, file);
}

function applyFile(relative) {
  const absolute = path.join(root, relative);
  const payload = readJson(relative);
  const backup = path.join(backupDir, relative);
  const candidate = path.join(candidateDir, relative);
  fs.mkdirSync(path.dirname(backup), { recursive: true });
  fs.copyFileSync(absolute, backup);
  const beforeHash = sha256(absolute);
  const changes = [];
  const next = clone(payload);

  if (relative.endsWith("maintenance/work-functions.json")) patchWorkFunctionsPackage(next, changes, relative);
  if (relative.endsWith("maintenance/processes.json")) patchHighLevelStakeholderReferences(next, changes, relative);
  if (relative.endsWith("maintenance/references.json")) patchWorkFunctionReferences(next, changes, relative);
  if (relative.endsWith("maintenance-knowledge.json")) {
    patchWorkFunctionsPackage(next, changes, relative);
    patchHighLevelStakeholderReferences(next, changes, relative);
    patchWorkFunctionReferences(next.gartner_roles || [], changes, relative, ["gartner_roles"]);
  }
  if (relative.endsWith("capability-tree.json")) patchCapabilityTree(next, changes, relative);
  if (relative.endsWith("capability-workbench.json")) patchCapabilityWorkbench(next, changes, relative);

  writeJson(candidate, next);
  writeJson(absolute, next);
  return {
    file: relative,
    backupPath: path.relative(root, backup),
    candidatePath: path.relative(root, candidate),
    beforeHash,
    afterHash: sha256(absolute),
    changeCount: changes.length,
    changes,
  };
}

function main() {
  fs.mkdirSync(backupDir, { recursive: true });
  fs.mkdirSync(candidateDir, { recursive: true });
  const reports = targetFiles.map(applyFile);
  const changes = reports.flatMap((report) => report.changes);
  const summary = {
    generatedAt: new Date().toISOString(),
    runId,
    status: "applied",
    targetFiles,
    fileReports: reports.map(({ changes: _, ...rest }) => rest),
    totalChangeCount: changes.length,
    backupDir: path.relative(root, backupDir),
    candidateDir: path.relative(root, candidateDir),
    normalizedDiffPath: path.relative(root, path.join(outDir, "work-function-rename-normalized-diff.json")),
  };
  writeJson(path.join(outDir, "work-function-rename-normalized-diff.json"), changes);
  writeJson(path.join(outDir, "work-function-rename-apply-report.json"), summary);
  fs.writeFileSync(
    path.join(outDir, "work-function-rename-apply-report.md"),
    [
      "# Work Function Rename Apply Report",
      "",
      `- status: \`${summary.status}\``,
      `- runId: \`${runId}\``,
      `- totalChangeCount: \`${summary.totalChangeCount}\``,
      `- backupDir: \`${summary.backupDir}\``,
      "",
      "| 文件 | 变更数 | 备份 | candidate |",
      "|---|---:|---|---|",
      ...summary.fileReports.map((item) => `| ${item.file} | ${item.changeCount} | ${item.backupPath} | ${item.candidatePath} |`),
      "",
    ].join("\n"),
  );
  console.log(JSON.stringify(summary, null, 2));
}

main();
