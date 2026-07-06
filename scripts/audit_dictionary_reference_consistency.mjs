#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const PROJECT_ROOT = process.cwd();
const DATA_ROOT = path.join(PROJECT_ROOT, "frontend", "capability-browser", "public", "data");

const AUTHORITY_TYPES = new Set([
  "capability_category",
  "capability_domain",
  "capability",
  "capability_focus",
  "scope_type",
  "security_technical_service",
  "security_technology_module",
  "security_technical_measure",
  "security_work",
  "process_domain",
  "process_group",
  "process_reference",
  "process_activity",
  "work_function_layer",
  "work_function_group",
  "work_function",
]);

const AUTHORITY_FILES = [
  "capability-tree.json",
  "maintenance/scopes.json",
  "maintenance/services.json",
  "maintenance/modules.json",
  "maintenance/measures.json",
  "maintenance/processes.json",
  "maintenance/work-functions.json",
];

const FIELD_ARRAY_CHECKS = [
  {
    ownerType: "security_technical_measure",
    idField: "related_service_ids",
    nameField: "related_service_names",
    targetType: "security_technical_service",
  },
  {
    ownerType: "security_technical_measure",
    idField: "related_scope_ids",
    nameField: "related_scope_names",
    targetType: "scope_type",
  },
  {
    ownerType: "security_technical_measure",
    idField: "related_module_ids",
    nameField: "related_module_names",
    targetType: "security_technology_module",
  },
  {
    ownerType: "security_technical_measure",
    idField: "related_capability_focus_ids",
    nameField: "related_capability_focus_names",
    targetType: "capability_focus",
  },
];

const MODULE_ONLY_MEASURE_TITLES = new Set([
  "主机防火墙",
  "主机恶意代码防护",
  "主机入侵防御（HIPS）",
  "终端安全工作区",
]);

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(DATA_ROOT, relativePath), "utf8"));
}

function normalizeText(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function objectTitle(value) {
  return normalizeText(value?.title ?? value?.name ?? value?.label ?? "");
}

function objectCode(value) {
  return normalizeText(value?.code ?? "");
}

function identityOf(value) {
  return normalizeText(value?.id ?? value?.code ?? value?.title ?? value?.name ?? "");
}

function hasBusinessIdentity(value) {
  return Boolean(normalizeText(value?.id) || objectCode(value) || objectTitle(value));
}

function safeRelative(filePath) {
  return filePath.split(path.sep).join("/");
}

function addAuthorityRecord(index, record, source, explicitType) {
  if (!record || typeof record !== "object") return;
  const type = explicitType || record.type || record.object_type || record.objectType;
  if (!AUTHORITY_TYPES.has(type)) return;
  const normalized = {
    type,
    id: normalizeText(record.id),
    code: objectCode(record),
    title: objectTitle(record),
    source,
  };
  if (!hasBusinessIdentity(normalized)) return;
  const bucket = index.byType.get(type) || { byId: new Map(), byCode: new Map(), byTitle: new Map(), records: [] };
  bucket.records.push(normalized);
  if (normalized.id) appendIndex(bucket.byId, normalized.id, normalized);
  if (normalized.code) appendIndex(bucket.byCode, normalized.code, normalized);
  if (normalized.title) appendIndex(bucket.byTitle, normalized.title, normalized);
  index.byType.set(type, bucket);
}

function appendIndex(map, key, value) {
  const rows = map.get(key) || [];
  rows.push(value);
  map.set(key, rows);
}

function firstRecord(rows) {
  return Array.isArray(rows) && rows.length ? rows[0] : null;
}

function collectCapabilityAuthority(index, data) {
  for (const category of arrayOf(data.categories)) {
    addAuthorityRecord(index, category, "capability-tree.json", "capability_category");
    for (const domain of arrayOf(category.domains)) {
      addAuthorityRecord(index, domain, "capability-tree.json", "capability_domain");
      for (const capability of arrayOf(domain.capabilities)) {
        addAuthorityRecord(index, capability, "capability-tree.json", "capability");
        for (const focus of arrayOf(capability.focuses)) {
          addAuthorityRecord(index, focus, "capability-tree.json", "capability_focus");
          for (const work of arrayOf(focus.security_works)) {
            addAuthorityRecord(index, work, "capability-tree.json", "security_work");
          }
        }
      }
    }
  }
}

function collectMaintenanceAuthority(index) {
  const scopes = readJson("maintenance/scopes.json");
  for (const scope of arrayOf(scopes.scope_types)) addAuthorityRecord(index, scope, "maintenance/scopes.json", "scope_type");

  const services = readJson("maintenance/services.json");
  for (const entry of arrayOf(services.security_technical_services)) {
    addAuthorityRecord(index, entry.service || entry, "maintenance/services.json", "security_technical_service");
  }

  const modules = readJson("maintenance/modules.json");
  for (const module of arrayOf(modules.security_technology_modules)) addAuthorityRecord(index, module, "maintenance/modules.json", "security_technology_module");

  const measures = readJson("maintenance/measures.json");
  for (const measure of arrayOf(measures.security_technical_measures)) {
    addAuthorityRecord(index, { ...measure, type: "security_technical_measure", title: measure.name || measure.title }, "maintenance/measures.json", "security_technical_measure");
  }

  const processes = readJson("maintenance/processes.json");
  for (const domain of arrayOf(processes.security_processes)) {
    addAuthorityRecord(index, { ...domain, type: "process_domain" }, "maintenance/processes.json", "process_domain");
    for (const group of arrayOf(domain.groups)) {
      addAuthorityRecord(index, { ...group, type: "process_group" }, "maintenance/processes.json", "process_group");
      for (const reference of arrayOf(group.references)) {
        addAuthorityRecord(index, reference, "maintenance/processes.json", "process_reference");
        for (const activity of arrayOf(reference.activities)) addAuthorityRecord(index, activity, "maintenance/processes.json", "process_activity");
      }
    }
  }

  const workFunctions = readJson("maintenance/work-functions.json");
  for (const layer of arrayOf(workFunctions.work_function_layers)) {
    addAuthorityRecord(index, { ...layer, type: "work_function_layer" }, "maintenance/work-functions.json", "work_function_layer");
    for (const group of arrayOf(layer.groups)) {
      addAuthorityRecord(index, { ...group, type: "work_function_group" }, "maintenance/work-functions.json", "work_function_group");
      for (const fn of arrayOf(group.functions)) addAuthorityRecord(index, fn, "maintenance/work-functions.json", "work_function");
    }
  }
}

function buildAuthorityIndex() {
  const index = { byType: new Map() };
  collectCapabilityAuthority(index, readJson("capability-tree.json"));
  collectMaintenanceAuthority(index);
  return index;
}

function arrayOf(value) {
  return Array.isArray(value) ? value : [];
}

function listJsonFiles(directory) {
  const rows = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      if (safeRelative(path.relative(DATA_ROOT, absolute)).startsWith("source-evidence")) continue;
      rows.push(...listJsonFiles(absolute));
    } else if (entry.isFile() && entry.name.endsWith(".json")) {
      rows.push(absolute);
    }
  }
  return rows.sort();
}

function pathWithKey(basePath, key) {
  return `${basePath}.${key}`;
}

function issue(issues, severity, type, kind, message, details) {
  issues.push({
    severity,
    type,
    kind,
    message,
    ...details,
  });
}

function compareReference(record, authority, issues, file, jsonPath) {
  const type = record.type || record.object_type || record.objectType;
  if (!AUTHORITY_TYPES.has(type) || !hasBusinessIdentity(record)) return;
  if (type === "security_technical_measure" && MODULE_ONLY_MEASURE_TITLES.has(objectTitle(record))) {
    issue(issues, "error", type, "module_title_used_as_measure_reference", "Module-only title must not be typed as a technical measure.", {
      file,
      path: jsonPath,
      id: normalizeText(record.id),
      code: objectCode(record),
      title: objectTitle(record),
    });
  }
  const bucket = authority.byType.get(type);
  if (!bucket) return;

  const id = normalizeText(record.id);
  const code = objectCode(record);
  const title = objectTitle(record);
  let canonical = null;
  let matchedBy = "";
  if (id) {
    canonical = firstRecord(bucket.byId.get(id));
    matchedBy = "id";
  }
  if (!canonical && code) {
    canonical = firstRecord(bucket.byCode.get(code));
    matchedBy = "code";
  }
  if (!canonical && title) {
    canonical = firstRecord(bucket.byTitle.get(title));
    matchedBy = "title";
  }
  if (!canonical) {
    issue(issues, "warning", type, "unknown_dictionary_reference", "Reference object is not found in dictionary authority.", {
      file,
      path: jsonPath,
      id,
      code,
      title,
    });
    return;
  }

  if (id && canonical.id && id !== canonical.id && matchedBy !== "id") {
    const pendingCandidate = type === "work_function" && jsonPath.includes("candidate_work_functions") && id.startsWith("work-function-candidate:");
    issue(issues, pendingCandidate ? "warning" : "error", type, pendingCandidate ? "pending_candidate_reference_id" : "reference_id_mismatch", "Reference id differs from dictionary authority.", {
      file,
      path: jsonPath,
      id,
      expectedId: canonical.id,
      matchedBy,
    });
  }
  if (code && canonical.code && code !== canonical.code) {
    issue(issues, "error", type, "reference_code_mismatch", "Reference code differs from dictionary authority.", {
      file,
      path: jsonPath,
      code,
      expectedCode: canonical.code,
      matchedBy,
    });
  }
  if (title && canonical.title && title !== canonical.title) {
    issue(issues, "error", type, "reference_title_mismatch", "Reference title/name differs from dictionary authority.", {
      file,
      path: jsonPath,
      title,
      expectedTitle: canonical.title,
      matchedBy,
    });
  }
}

function auditFieldArrays(record, authority, issues, file, jsonPath) {
  const ownerType = record.type || (String(record.id || "").startsWith("security_technical_measure:") ? "security_technical_measure" : "");
  for (const check of FIELD_ARRAY_CHECKS) {
    if (ownerType !== check.ownerType) continue;
    const ids = arrayOf(record[check.idField]).map(normalizeText).filter(Boolean);
    const names = arrayOf(record[check.nameField]).map(normalizeText).filter(Boolean);
    const bucket = authority.byType.get(check.targetType);
    if (!bucket) continue;
    ids.forEach((id, index) => {
      const canonical = firstRecord(bucket.byId.get(id));
      if (!canonical) {
        issue(issues, "warning", check.targetType, "unknown_dictionary_id_in_array", "Reference id in array is not found in dictionary authority.", {
          file,
          path: `${jsonPath}.${check.idField}[${index}]`,
          id,
          ownerId: record.id || "",
        });
        return;
      }
      const pairedName = names[index];
      if (pairedName && canonical.title && pairedName !== canonical.title) {
        issue(issues, "error", check.targetType, "array_name_mismatch", "Reference name array does not match dictionary authority for paired id.", {
          file,
          path: `${jsonPath}.${check.nameField}[${index}]`,
          id,
          title: pairedName,
          expectedTitle: canonical.title,
          ownerId: record.id || "",
        });
      }
    });
    names.forEach((name, index) => {
      if (!name || firstRecord(bucket.byTitle.get(name))) return;
      issue(issues, "warning", check.targetType, "unknown_dictionary_name_in_array", "Reference name in array is not found in dictionary authority.", {
        file,
        path: `${jsonPath}.${check.nameField}[${index}]`,
        title: name,
        ownerId: record.id || "",
      });
    });
  }
}

function walkReferences(value, authority, issues, file, jsonPath = "$") {
  if (Array.isArray(value)) {
    value.forEach((item, index) => walkReferences(item, authority, issues, file, `${jsonPath}[${index}]`));
    return;
  }
  if (!value || typeof value !== "object") return;
  compareReference(value, authority, issues, file, jsonPath);
  auditFieldArrays(value, authority, issues, file, jsonPath);
  for (const [key, child] of Object.entries(value)) {
    walkReferences(child, authority, issues, file, pathWithKey(jsonPath, key));
  }
}

function auditAuthorityConflicts(authority, issues) {
  for (const [type, bucket] of authority.byType.entries()) {
    for (const [id, rows] of bucket.byId.entries()) {
      const titles = new Set(rows.map((row) => row.title).filter(Boolean));
      const codes = new Set(rows.map((row) => row.code).filter(Boolean));
      if (titles.size > 1 || codes.size > 1) {
        issue(issues, "error", type, "authority_duplicate_id_conflict", "Dictionary authority contains conflicting records for the same id.", {
          id,
          titles: [...titles],
          codes: [...codes],
          sources: [...new Set(rows.map((row) => row.source))],
        });
      }
    }
    for (const [code, rows] of bucket.byCode.entries()) {
      const titles = new Set(rows.map((row) => row.title).filter(Boolean));
      if (titles.size > 1) {
        issue(issues, "error", type, "authority_duplicate_code_conflict", "Dictionary authority contains conflicting titles for the same code.", {
          code,
          titles: [...titles],
          ids: [...new Set(rows.map((row) => row.id).filter(Boolean))],
          sources: [...new Set(rows.map((row) => row.source))],
        });
      }
    }
  }
}

function summarizeAuthority(authority) {
  const rows = {};
  for (const [type, bucket] of authority.byType.entries()) rows[type] = bucket.records.length;
  return Object.fromEntries(Object.entries(rows).sort(([left], [right]) => left.localeCompare(right)));
}

function countBy(items, keyFn) {
  const counts = new Map();
  for (const item of items) {
    const key = keyFn(item);
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return Object.fromEntries([...counts.entries()].sort((left, right) => right[1] - left[1] || String(left[0]).localeCompare(String(right[0]))));
}

function sampleBy(items, keyFn, limit = 5) {
  const samples = new Map();
  for (const item of items) {
    const key = keyFn(item);
    const rows = samples.get(key) || [];
    if (rows.length < limit) rows.push(item);
    samples.set(key, rows);
  }
  return Object.fromEntries([...samples.entries()].sort(([left], [right]) => String(left).localeCompare(String(right))));
}

function main() {
  const authority = buildAuthorityIndex();
  const issues = [];
  auditAuthorityConflicts(authority, issues);
  const files = listJsonFiles(DATA_ROOT).map((file) => safeRelative(path.relative(DATA_ROOT, file)));
  for (const relativePath of files) {
    const payload = readJson(relativePath);
    walkReferences(payload, authority, issues, relativePath);
  }

  const errors = issues.filter((item) => item.severity === "error");
  const warnings = issues.filter((item) => item.severity === "warning");
  const summary = {
    result: errors.length ? "fail" : warnings.length ? "warnings" : "pass",
    authorityTypes: summarizeAuthority(authority),
    filesChecked: files.length,
    issues: issues.length,
    errors: errors.length,
    warnings: warnings.length,
    issuesByType: countBy(issues, (item) => item.type),
    issuesByKind: countBy(issues, (item) => item.kind),
    issuesByFile: countBy(issues, (item) => item.file || "authority"),
    issueSamplesByType: sampleBy(issues, (item) => item.type, 5),
    issueSample: issues.slice(0, 50),
  };
  console.log(JSON.stringify(summary, null, 2));
  if (errors.length) process.exitCode = 1;
}

main();
