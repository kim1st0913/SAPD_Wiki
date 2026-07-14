#!/usr/bin/env node

import fs from "node:fs";

const SEMANTIC_PATH = "frontend/capability-browser/generated/environmentBasemap.semantic.json";
const WORKBENCH_PATH = "frontend/capability-browser/public/data/environment-workbench.json";
const DETAILS_PATH = "frontend/capability-browser/generated/environmentBasemap.node-details.json";

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function text(value) {
  return value == null ? "" : String(value).trim();
}

function sorted(values) {
  return [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b, "zh-Hans-CN"));
}

function sameArray(a, b) {
  const left = sorted(a);
  const right = sorted(b);
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function parseScopeLabel(scope) {
  const code = text(scope?.objectCode || scope?.code);
  const name = text(scope?.objectName || scope?.title || scope?.name);
  if (code) return { code, name };
  const match = name.match(/^(I-[A-Z]{2})\s*(.+)$/);
  if (match) return { code: match[1], name: text(match[2]) };
  return { code: "", name };
}

function scopeKey(scope) {
  const parsed = parseScopeLabel(scope);
  return `${parsed.code}|${parsed.name}`;
}

function objectCode(object) {
  return text(object?.objectCode || object?.code);
}

function objectName(object) {
  return text(object?.objectName || object?.title || object?.name);
}

function contextKey(environmentTitle, segmentTitle, objectTitle) {
  return `${text(environmentTitle)}||${text(segmentTitle)}||${text(objectTitle)}`;
}

function emptyGroup() {
  return {
    scopes: [],
    services: [],
    modules: [],
  };
}

function normalizeWorkbenchObject(object) {
  const result = emptyGroup();
  const groupsByScope = new Map();
  for (const mapping of asArray(object.scope_mappings)) {
    const key = scopeKey(mapping.scope);
    if (!key || key === "|") continue;
    if (!groupsByScope.has(key)) {
      groupsByScope.set(key, {
        scope: key,
        services: [],
        modules: [],
      });
    }
    const group = groupsByScope.get(key);
    group.services.push(...asArray(mapping.services).map(objectCode));
    group.modules.push(...asArray(mapping.services).flatMap((service) => asArray(service.modules).map(objectName)));
    group.modules.push(...asArray(mapping.modules).map(objectName));
  }
  result.scopes = sorted([...groupsByScope.keys()]);
  result.services = sorted([...groupsByScope.values()].flatMap((group) => group.services));
  result.modules = sorted([...groupsByScope.values()].flatMap((group) => group.modules));
  return result;
}

function normalizeDetail(detail) {
  const result = emptyGroup();
  const groupsByScope = new Map();
  for (const mapping of asArray(detail.directScopeGroups || detail.scopeMappings)) {
    const key = scopeKey(mapping.scope);
    if (!key || key === "|") continue;
    if (!groupsByScope.has(key)) {
      groupsByScope.set(key, {
        scope: key,
        services: [],
        modules: [],
      });
    }
    const group = groupsByScope.get(key);
    group.services.push(...asArray(mapping.services).map(objectCode));
    group.modules.push(...asArray(mapping.services).flatMap((service) => asArray(service.modules).map(objectName)));
    group.modules.push(...asArray(mapping.modules).map(objectName));
  }
  result.scopes = sorted([...groupsByScope.keys()]);
  result.services = sorted([...groupsByScope.values()].flatMap((group) => group.services));
  result.modules = sorted([...groupsByScope.values()].flatMap((group) => group.modules));
  return result;
}

function buildWorkbenchContextIndex(workbench) {
  const contexts = new Map();
  for (const environment of asArray(workbench.environment_scope_tree)) {
    for (const object of asArray(environment.objects)) {
      for (const segment of asArray(object.segments)) {
        contexts.set(contextKey(environment.title, segment.title, object.title), {
          environmentTitle: text(environment.title),
          segmentTitle: text(segment.title),
          objectTitle: text(object.title),
          normalized: normalizeWorkbenchObject(object),
        });
      }
    }
  }
  return contexts;
}

function findDuplicateScopeGroups(detailsPayload) {
  const duplicates = [];
  for (const detail of Object.values(detailsPayload.nodeDetailsByMxId || {})) {
    const seen = new Map();
    for (const mapping of asArray(detail.directScopeGroups || detail.scopeMappings)) {
      const key = scopeKey(mapping.scope);
      if (!key || key === "|") continue;
      seen.set(key, (seen.get(key) || 0) + 1);
    }
    for (const [key, count] of seen.entries()) {
      if (count > 1) {
        duplicates.push({
          mxId: detail.mxId || "",
          label: detail.label || "",
          objectContextKey: detail.objectContextKey || "",
          scope: key,
          count,
        });
      }
    }
  }
  return duplicates;
}

function main() {
  const semantic = readJson(SEMANTIC_PATH);
  const workbench = readJson(WORKBENCH_PATH);
  const details = readJson(DETAILS_PATH);
  const workbenchContexts = buildWorkbenchContextIndex(workbench);
  const failures = [];
  const checks = [];

  function check(name, ok, extra = {}) {
    checks.push(name);
    if (!ok) failures.push({ check: name, ...extra });
  }

  const boundNodes = asArray(semantic.nodes).filter((node) => node.bindStatus === "bound").length;
  const detailReadyNodes = Object.keys(details.nodeDetailsByMxId || {}).length;
  check("all_bound_nodes_have_node_details", detailReadyNodes === boundNodes && details.stats?.missingDetailNodes === 0, {
    boundNodes,
    detailReadyNodes,
    missingDetailNodes: details.stats?.missingDetailNodes,
  });

  const duplicateScopeGroups = findDuplicateScopeGroups(details);
  check("direct_scope_groups_are_unique_by_business_scope", duplicateScopeGroups.length === 0, {
    duplicateScopeGroups: duplicateScopeGroups.slice(0, 20),
    duplicateScopeGroupCount: duplicateScopeGroups.length,
  });

  let comparedContextDetails = 0;
  for (const detail of Object.values(details.nodeDetailsByMxId || {})) {
    if (!detail.objectContextKey || !workbenchContexts.has(detail.objectContextKey)) continue;
    comparedContextDetails += 1;
    const expected = workbenchContexts.get(detail.objectContextKey).normalized;
    const actual = normalizeDetail(detail);
    check(`context_mapping_matches_workbench:${detail.objectContextKey}`, sameArray(actual.scopes, expected.scopes) && sameArray(actual.services, expected.services) && sameArray(actual.modules, expected.modules), {
      mxId: detail.mxId || "",
      label: detail.label || "",
      expected,
      actual,
    });
  }
  check("context_detail_comparison_covered_business_objects", comparedContextDetails > 0, { comparedContextDetails });

  const l3Key = "工业控制网络||L3层||L3内部网络";
  const l3Detail = Object.values(details.nodeDetailsByMxId || {}).find((detail) => detail.objectContextKey === l3Key);
  check("golden_l3_internal_network_detail_exists", Boolean(l3Detail), { l3Key });
  if (l3Detail) {
    const actual = normalizeDetail(l3Detail);
    check("golden_l3_internal_network_scope_services_modules", sameArray(actual.scopes, ["I-NT|网络"]) &&
      sameArray(actual.services, [
        "I-NT&T-AS.AD-02",
        "I-NT&T-AS.LA-03",
        "I-NT&T-PD.AC-01",
        "I-NT&T-PD.PP-03",
      ]) &&
      sameArray(actual.modules, ["工业网络安全审计", "工业防火墙"]), {
      l3Key,
      actual,
    });
  }

  const result = {
    status: failures.length ? "fail" : "pass",
    checkCount: checks.length,
    failedCount: failures.length,
    comparedContextDetails,
    boundNodes,
    detailReadyNodes,
    workbenchContextCount: workbenchContexts.size,
    failures,
  };
  console.log(JSON.stringify(result, null, 2));
  if (failures.length) process.exitCode = 1;
}

main();
