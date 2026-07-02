#!/usr/bin/env node

import { readFile } from "node:fs/promises";

const WORK_FUNCTIONS_PATH = "frontend/capability-browser/public/data/maintenance/work-functions.json";
const TARGET_JSON_PATHS = [
  "frontend/capability-browser/public/data/maintenance-knowledge.json",
  "frontend/capability-browser/public/data/maintenance/references.json",
  "frontend/capability-browser/public/data/maintenance/sections/references.json",
];

const EXPECTED_MAPPING = {
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

function collectWorkFunctions(root) {
  const byCode = new Map();
  const byId = new Map();
  function walk(value) {
    if (Array.isArray(value)) {
      value.forEach(walk);
      return;
    }
    if (!value || typeof value !== "object") return;
    if (value.type === "work_function" && value.code && value.id && value.title) {
      const record = { code: String(value.code), id: value.id, title: value.title };
      byCode.set(record.code, record);
      byId.set(record.id, record);
    }
    Object.values(value).forEach(walk);
  }
  walk(root);
  return { byCode, byId };
}

function asCodes(role) {
  return (role.candidate_work_functions || []).map((item) => String(item.code));
}

const authority = collectWorkFunctions(JSON.parse(await readFile(WORK_FUNCTIONS_PATH, "utf8")));
const issues = [];
const summaries = [];

for (const filePath of TARGET_JSON_PATHS) {
  const data = JSON.parse(await readFile(filePath, "utf8"));
  const roles = data.gartner_roles || [];
  const reviewed = roles.filter((role) => EXPECTED_MAPPING[role.gartner_role_candidate_id]);
  if (reviewed.length !== Object.keys(EXPECTED_MAPPING).length) {
    issues.push({ filePath, type: "reviewed_role_count_mismatch", expected: Object.keys(EXPECTED_MAPPING).length, actual: reviewed.length });
  }
  for (const role of reviewed) {
    const roleId = role.gartner_role_candidate_id;
    const actual = asCodes(role);
    const expected = EXPECTED_MAPPING[roleId];
    if (actual.join("|") !== expected.join("|")) {
      issues.push({ filePath, roleId, type: "mapping_mismatch", expected, actual });
    }
    if (role.review_status !== "已确认") {
      issues.push({ filePath, roleId, type: "review_status_not_confirmed", actual: role.review_status });
    }
    if (role.candidate_quality !== "user_confirmed_mapping") {
      issues.push({ filePath, roleId, type: "candidate_quality_not_confirmed", actual: role.candidate_quality });
    }
    for (const item of role.candidate_work_functions || []) {
      const canonical = authority.byCode.get(String(item.code));
      if (!canonical) {
        issues.push({ filePath, roleId, type: "unknown_work_function_code", code: item.code, title: item.title });
        continue;
      }
      if (item.id !== canonical.id || item.title !== canonical.title) {
        issues.push({ filePath, roleId, type: "work_function_identity_mismatch", actual: item, expected: canonical });
      }
      if (item.status !== "已确认") {
        issues.push({ filePath, roleId, type: "work_function_status_not_confirmed", code: item.code, actual: item.status });
      }
    }
  }
  summaries.push({
    filePath,
    gartnerRoles: roles.length,
    reviewedRoles: reviewed.length,
    confirmedRoles: reviewed.filter((role) => role.review_status === "已确认").length,
    confirmedFunctionRefs: reviewed.reduce((sum, role) => sum + (role.candidate_work_functions || []).length, 0),
  });
}

const result = {
  result: issues.length ? "fail" : "pass",
  issueCount: issues.length,
  summaries,
  issues,
};

console.log(JSON.stringify(result, null, 2));
if (issues.length) process.exit(1);
