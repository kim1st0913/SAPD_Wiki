#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const root = process.cwd();
const dataDir = path.join(root, "frontend/capability-browser/public/data");
const generatedDir = path.join(root, "frontend/capability-browser/generated");
const outDir = path.join(root, "data/exports/worker-verify/protected-dictionary-standard-global-audit/formal-apply");

const oldServiceCodeMap = new Map([
  ["I-OS&T-AS.DS-01", "I-AP&T-AS.DS-01"],
  ["I-OS&T-AS.DS-02", "I-AP&T-AS.DS-02"],
  ["I-OS&T-AS.DS-03", "I-AP&T-AS.DS-03"],
  ["I-OS&T-AS.DS-04", "I-AP&T-AS.DS-04"],
  ["I-OS&T-AS.DS-05", "I-AP&T-AS.DS-05"],
  ["I-OS&T-AS.DS-06", "I-AP&T-AS.DS-06"],
]);

const oldServiceNameByCode = new Map([
  ["I-DI&T-PD.DP-01", { oldName: "应用页面水印", canonicalName: "数据内容水印" }],
  ["I-DI&T-PD.DP-02", { oldName: "应用动态数据脱敏", canonicalName: "静态数据脱敏" }],
]);

const targetFiles = [
  "frontend/capability-browser/public/data/maintenance/modules.json",
  "frontend/capability-browser/public/data/capability-tree.json",
  "frontend/capability-browser/public/data/environment-workbench.json",
  "frontend/capability-browser/public/data/lifecycle-knowledge.json",
  "frontend/capability-browser/public/data/maintenance-knowledge.json",
  "frontend/capability-browser/generated/environmentBasemap.node-details.json",
];

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(root, relativePath), "utf8"));
}

function writeJson(filePath, payload) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`);
}

function sha256(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

function timestamp() {
  return new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function collectTyped(value, type, out = []) {
  if (Array.isArray(value)) {
    for (const item of value) collectTyped(item, type, out);
  } else if (value && typeof value === "object") {
    if (value.type === type) out.push(value);
    for (const child of Object.values(value)) collectTyped(child, type, out);
  }
  return out;
}

function serviceRecordMap() {
  const services = readJson("frontend/capability-browser/public/data/maintenance/services.json");
  const map = new Map();
  for (const row of services.security_technical_services || []) {
    const service = row.service || row;
    if (service?.code) map.set(service.code, service);
  }
  return map;
}

function securitySystemMap() {
  const modules = readJson("frontend/capability-browser/public/data/maintenance/modules.json");
  const services = readJson("frontend/capability-browser/public/data/maintenance/services.json");
  const map = new Map();
  for (const system of [...collectTyped(modules, "security_system"), ...collectTyped(services, "security_system")]) {
    if (system?.title && !map.has(system.title)) map.set(system.title, system);
  }
  return map;
}

function jsonPath(pathParts) {
  return pathParts.reduce((acc, part) => (typeof part === "number" ? `${acc}[${part}]` : `${acc}.${part}`), "$");
}

function replaceString(value, contextCode, changes, file, pathParts) {
  let next = value;
  for (const [oldCode, newCode] of oldServiceCodeMap.entries()) {
    if (next.includes(oldCode)) {
      next = next.split(oldCode).join(newCode);
    }
  }
  const rule = oldServiceNameByCode.get(contextCode);
  if (rule && next.includes(rule.oldName)) {
    next = next.split(rule.oldName).join(rule.canonicalName);
  }
  for (const [code, nameRule] of oldServiceNameByCode.entries()) {
    const paired = `${code} ${nameRule.oldName}`;
    if (next.includes(paired)) {
      next = next.split(paired).join(`${code} ${nameRule.canonicalName}`);
    }
  }
  if (next !== value) {
    changes.push({ file, path: jsonPath(pathParts), before: value, after: next });
  }
  return next;
}

function patchServiceLikeObject(node, changes, file, pathParts) {
  const codeKeys = ["code", "serviceCode", "objectCode"];
  const nameKeys = ["title", "name", "serviceName", "objectName"];
  const codeKey = codeKeys.find((key) => typeof node[key] === "string" && node[key]);
  const currentCode = codeKey ? node[codeKey] : "";
  let nextCode = currentCode;

  if (oldServiceCodeMap.has(currentCode)) {
    nextCode = oldServiceCodeMap.get(currentCode);
    node[codeKey] = nextCode;
    changes.push({ file, path: jsonPath([...pathParts, codeKey]), before: currentCode, after: nextCode });
    for (const key of ["category", "scopeCode"]) {
      if (node[key] === "I-OS") {
        node[key] = "I-AP";
        changes.push({ file, path: jsonPath([...pathParts, key]), before: "I-OS", after: "I-AP" });
      }
    }
  }

  const nameRule = oldServiceNameByCode.get(nextCode || currentCode);
  if (nameRule) {
    for (const key of nameKeys) {
      if (node[key] === nameRule.oldName) {
        node[key] = nameRule.canonicalName;
        changes.push({ file, path: jsonPath([...pathParts, key]), before: nameRule.oldName, after: nameRule.canonicalName });
      }
    }
  }
}

function patchSecuritySystemObject(node, canonicalSystems, changes, file, pathParts) {
  if (node.type !== "security_system" || node.title !== "移动终端安全") return;
  const canonical = canonicalSystems.get("移动终端安全管控");
  if (!canonical) throw new Error("Missing canonical security system: 移动终端安全管控");
  for (const key of ["id", "type", "code", "title", "description", "category"]) {
    const before = node[key] ?? null;
    const after = canonical[key] ?? null;
    if (before !== after) {
      node[key] = after;
      changes.push({ file, path: jsonPath([...pathParts, key]), before, after });
    }
  }
}

function patchDataSecurityModuleSystems(payload, canonicalSystems, changes, file) {
  const modules = payload.security_technology_modules;
  if (!Array.isArray(modules)) return;
  const canonical = canonicalSystems.get("数据安全管理与运营");
  if (!canonical) throw new Error("Missing canonical security system: 数据安全管理与运营");
  for (const [index, module] of modules.entries()) {
    if (!["知情同意管理", "隐私安全影响评估"].includes(module.title)) continue;
    const systems = Array.isArray(module.systems) ? module.systems : [];
    if (!systems.some((system) => system?.title === "数据安全管理与运营")) {
      module.systems = [...systems, clone(canonical)];
      changes.push({
        file,
        path: jsonPath(["security_technology_modules", index, "systems"]),
        before: systems.map((system) => system?.title || "").filter(Boolean),
        after: module.systems.map((system) => system?.title || "").filter(Boolean),
      });
    }
  }
}

function walk(value, contextCode, changes, file, pathParts = [], canonicalSystems) {
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      value[index] = walk(value[index], contextCode, changes, file, [...pathParts, index], canonicalSystems);
    }
    return value;
  }
  if (value && typeof value === "object") {
    patchServiceLikeObject(value, changes, file, pathParts);
    patchSecuritySystemObject(value, canonicalSystems, changes, file, pathParts);
    const localCode = value.code || value.serviceCode || value.objectCode || contextCode;
    for (const [key, child] of Object.entries(value)) {
      value[key] = walk(child, localCode, changes, file, [...pathParts, key], canonicalSystems);
    }
    return value;
  }
  if (typeof value === "string") {
    return replaceString(value, contextCode, changes, file, pathParts);
  }
  return value;
}

function main() {
  const runId = timestamp();
  const applyDir = path.join(outDir, runId);
  const backupDir = path.join(applyDir, "backups");
  const candidateDir = path.join(applyDir, "candidate-files");
  fs.mkdirSync(backupDir, { recursive: true });
  fs.mkdirSync(candidateDir, { recursive: true });

  serviceRecordMap();
  const canonicalSystems = securitySystemMap();
  const fileReports = [];
  const allChanges = [];

  for (const relativeFile of targetFiles) {
    const absolute = path.join(root, relativeFile);
    const payload = readJson(relativeFile);
    const backupPath = path.join(backupDir, relativeFile);
    fs.mkdirSync(path.dirname(backupPath), { recursive: true });
    fs.copyFileSync(absolute, backupPath);

    const beforeHash = sha256(absolute);
    const changes = [];
    const candidate = clone(payload);
    patchDataSecurityModuleSystems(candidate, canonicalSystems, changes, relativeFile);
    walk(candidate, "", changes, relativeFile, [], canonicalSystems);

    const candidatePath = path.join(candidateDir, relativeFile);
    writeJson(candidatePath, candidate);
    writeJson(absolute, candidate);
    const afterHash = sha256(absolute);
    allChanges.push(...changes);
    fileReports.push({
      file: relativeFile,
      backupPath: path.relative(root, backupPath),
      candidatePath: path.relative(root, candidatePath),
      beforeHash,
      afterHash,
      changed: beforeHash !== afterHash,
      changeCount: changes.length,
    });
  }

  const summary = {
    generatedAt: new Date().toISOString(),
    runId,
    status: "applied",
    targetFiles,
    fileReports,
    totalChangeCount: allChanges.length,
    changeTypeCounts: allChanges.reduce((acc, change) => {
      const before = String(change.before);
      const after = String(change.after);
      const key = before.includes("I-OS&T-AS.DS") || after.includes("I-AP&T-AS.DS")
        ? "oldServiceCode"
        : before.includes("移动终端安全")
          ? "securitySystemCanonicalized"
          : after.includes("数据安全管理与运营")
            ? "dataSecurityModuleSystemAdded"
            : "oldServiceName";
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {}),
    normalizedDiffPath: path.relative(root, path.join(applyDir, "protected-global-reference-fix-normalized-diff.json")),
  };

  writeJson(path.join(applyDir, "protected-global-reference-fix-normalized-diff.json"), allChanges);
  writeJson(path.join(applyDir, "protected-global-reference-fix-apply-report.json"), summary);
  fs.writeFileSync(
    path.join(applyDir, "protected-global-reference-fix-apply-report.md"),
    [
      "# Protected Global Reference Fix Apply Report",
      "",
      `- status: \`${summary.status}\``,
      `- runId: \`${runId}\``,
      `- totalChangeCount: \`${summary.totalChangeCount}\``,
      "",
      "## Files",
      "",
      "| 文件 | 变更数 | 备份 | candidate |",
      "|---|---:|---|---|",
      ...fileReports.map((item) => `| ${item.file} | ${item.changeCount} | ${item.backupPath} | ${item.candidatePath} |`),
      "",
      "## Change Types",
      "",
      ...Object.entries(summary.changeTypeCounts).map(([key, count]) => `- ${key}: \`${count}\``),
      "",
    ].join("\n"),
  );

  console.log(JSON.stringify(summary, null, 2));
}

main();
