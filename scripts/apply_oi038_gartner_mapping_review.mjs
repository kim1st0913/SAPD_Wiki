#!/usr/bin/env node

import { readFile, writeFile } from "node:fs/promises";

const WORK_FUNCTIONS_PATH = "frontend/capability-browser/public/data/maintenance/work-functions.json";
const TARGET_JSON_PATHS = [
  "frontend/capability-browser/public/data/maintenance-knowledge.json",
  "frontend/capability-browser/public/data/maintenance/references.json",
  "frontend/capability-browser/public/data/maintenance/sections/references.json",
];
const TARGET_CSV_PATHS = [
  "data/exports/worker-verify/sheet-review-2-2-gartner-to-work-function-candidates.csv",
];

const REVIEWED_MAPPING = {
  "GARTNER-003": ["2"],
  "GARTNER-004": ["10"],
  "GARTNER-005": ["3"],
  "GARTNER-006": ["10"],
  "GARTNER-007": ["10"],
  "GARTNER-008": ["19"],
  "GARTNER-009": ["10"],
  "GARTNER-010": ["38", "28"],
  "GARTNER-011": ["11", "16"],
  "GARTNER-012": ["69"],
  "GARTNER-013": ["31"],
  "GARTNER-014": ["85"],
  "GARTNER-015": ["54"],
  "GARTNER-016": ["60", "59"],
  "GARTNER-017": ["56"],
  "GARTNER-018": ["56", "10"],
  "GARTNER-019": ["58"],
  "GARTNER-020": ["30", "31"],
  "GARTNER-021": ["38", "28"],
  "GARTNER-022": ["63", "38"],
  "GARTNER-023": ["47", "69"],
  "GARTNER-024": ["54", "82"],
  "GARTNER-025": ["51", "44", "47", "69"],
  "GARTNER-026": ["54", "82", "11", "16"],
  "GARTNER-027": ["63", "12"],
  "GARTNER-028": ["2"],
  "GARTNER-029": ["16"],
  "GARTNER-030": ["82", "11", "16"],
};

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function collectWorkFunctions(root) {
  const byCode = new Map();
  function walk(value, context = {}) {
    if (Array.isArray(value)) {
      for (const item of value) walk(item, context);
      return;
    }
    if (!value || typeof value !== "object") return;

    const type = value.type || "";
    const title = value.title || value.name || "";
    let nextContext = context;
    if (type === "work_function_layer" || /层$/.test(title)) {
      nextContext = { ...nextContext, layer: title };
    } else if (type === "work_function_group" || /团队|领导|交叉领域|执行|管理/.test(title)) {
      nextContext = { ...nextContext, group: title };
    }

    if (type === "work_function" && value.code && value.title) {
      byCode.set(String(value.code), {
        id: value.id,
        type: "work_function",
        code: String(value.code),
        title: value.title,
        status: "已确认",
        review_status: "人工确认",
        review_source: "OI-038 Gartner 人工复核",
        layer: nextContext.layer || "",
        group: nextContext.group || "",
      });
    }

    for (const child of Object.values(value)) walk(child, nextContext);
  }
  walk(root);
  return byCode;
}

function reviewedFunctions(roleId, workFunctionsByCode) {
  const codes = REVIEWED_MAPPING[roleId];
  if (!codes) return null;
  return codes.map((code) => {
    const item = workFunctionsByCode.get(String(code));
    if (!item) throw new Error(`Missing work function code ${code} for ${roleId}`);
    return { ...item };
  });
}

function updateRole(role, workFunctionsByCode) {
  const roleId = role.gartner_role_candidate_id;
  const reviewed = reviewedFunctions(roleId, workFunctionsByCode);
  if (!reviewed) return role;
  return {
    ...role,
    candidate_work_function_layers: unique(reviewed.map((item) => item.layer)),
    candidate_work_function_groups: unique(reviewed.map((item) => item.group)),
    candidate_work_functions: reviewed.map(({ layer, group, ...item }) => item),
    candidate_count: reviewed.length,
    confidence_or_rule: "user_confirmed",
    review_status: "已确认",
    candidate_quality: "user_confirmed_mapping",
    review_note: "OI-038：用户已逐条人工复核 Gartner 岗位到安全职能映射。",
  };
}

function splitCsvLine(line) {
  const result = [];
  let current = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"') {
      if (quoted && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (char === "," && !quoted) {
      result.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
}

function csvValue(value) {
  const text = String(value ?? "");
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function updateCsv(text, workFunctionsByCode) {
  const hadBom = text.charCodeAt(0) === 0xfeff;
  const clean = hadBom ? text.slice(1) : text;
  const lines = clean.trimEnd().split(/\r?\n/);
  const headers = splitCsvLine(lines[0]);
  const rows = lines.slice(1).map((line) => {
    const columns = splitCsvLine(line);
    const row = Object.fromEntries(headers.map((header, index) => [header, columns[index] || ""]));
    const reviewed = reviewedFunctions(row.gartner_role_id, workFunctionsByCode);
    if (reviewed) {
      row.candidate_work_function_layers = unique(reviewed.map((item) => item.layer)).join("；");
      row.candidate_work_function_groups = unique(reviewed.map((item) => item.group)).join("；");
      row.candidate_work_functions = reviewed.map((item) => `${item.code} ${item.title}`).join("；");
      row.candidate_count = String(reviewed.length);
      row.confidence_or_rule = "user_confirmed";
      row.review_status = "user_confirmed";
      row.candidate_quality = "user_confirmed_mapping";
      row.issue_owner = "closed_oi038_user_business_review";
    }
    return row;
  });
  const body = [
    headers.join(","),
    ...rows.map((row) => headers.map((header) => csvValue(row[header])).join(",")),
  ].join("\n");
  return `${hadBom ? "\ufeff" : ""}${body}\n`;
}

const workFunctionData = JSON.parse(await readFile(WORK_FUNCTIONS_PATH, "utf8"));
const workFunctionsByCode = collectWorkFunctions(workFunctionData);

for (const filePath of TARGET_JSON_PATHS) {
  const data = JSON.parse(await readFile(filePath, "utf8"));
  if (!Array.isArray(data.gartner_roles)) throw new Error(`${filePath} missing gartner_roles`);
  data.gartner_roles = data.gartner_roles.map((role) => updateRole(role, workFunctionsByCode));
  await writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`);
}

for (const filePath of TARGET_CSV_PATHS) {
  const text = await readFile(filePath, "utf8");
  await writeFile(filePath, updateCsv(text, workFunctionsByCode));
}

console.log(JSON.stringify({
  status: "applied",
  reviewedRoles: Object.keys(REVIEWED_MAPPING).length,
  jsonFiles: TARGET_JSON_PATHS.length,
  csvFiles: TARGET_CSV_PATHS.length,
}, null, 2));
