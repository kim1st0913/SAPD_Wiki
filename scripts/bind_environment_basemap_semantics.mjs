#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const SEMANTIC_PATH = "frontend/capability-browser/generated/environmentBasemap.semantic.json";
const HTML_PATH = "frontend/capability-browser/generated/environmentBasemap.html";
const MANIFEST_PATH = "frontend/capability-browser/generated/environmentBasemap.generated.js";
const OVERRIDES_PATH = "frontend/capability-browser/generated/environmentBasemap.binding-overrides.json";
const REPORT_JSON_PATH = "frontend/capability-browser/generated/environmentBasemap.binding-report.json";
const REPORT_MD_PATH = "frontend/capability-browser/generated/environmentBasemap.binding-report.md";
const WORKBENCH_PATH = "frontend/capability-browser/public/data/environment-workbench.json";

const BUSINESS_TYPES = ["information_environment", "environment_segment", "information_object", "scope_type"];
const STATUS_ORDER = ["bound", "candidate", "unbound", "ignored"];
const CONFIDENCE_ORDER = { manual: 0, exact: 1, parent_context: 2, alias: 3, none: 9 };

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function normalize(value = "") {
  return String(value)
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[（）()《》「」『』【】\[\]{}]/g, "")
    .replace(/[：:，,。；;、.\-_—－/\\|]/g, "");
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function escapeHtml(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function markdownCell(value = "") {
  return String(value ?? "").replace(/\|/g, "\\|").replace(/\n/g, "<br>");
}

function objectLabel(object) {
  return object?.name || object?.title || object?.label || "";
}

function buildCatalog(workbench) {
  const byId = new Map();
  const byName = new Map();

  for (const objectType of BUSINESS_TYPES) {
    for (const object of Object.values(workbench.objects?.[objectType] || {})) {
      if (String(object?.id || "").startsWith("reimport:")) continue;
      const name = objectLabel(object);
      const entry = {
        objectType,
        objectId: object.id,
        objectCode: object.code || "",
        objectName: name,
        normalizedName: normalize(name),
        category: object.category || "",
        paths: [],
      };
      byId.set(object.id, entry);
      if (!byName.has(entry.normalizedName)) byName.set(entry.normalizedName, []);
      byName.get(entry.normalizedName).push(entry);
    }
  }

  function addPath(objectId, pathInfo) {
    const entry = byId.get(objectId);
    if (!entry) return;
    const key = [
      pathInfo.environmentId || "",
      pathInfo.segmentId || "",
      pathInfo.objectId || objectId,
    ].join("|");
    if (entry.paths.some((item) => item.key === key)) return;
    entry.paths.push({ ...pathInfo, key });
  }

  for (const object of Object.values(workbench.objects?.information_object || {})) {
    if (String(object?.id || "").startsWith("reimport:")) continue;
    const [environmentName, segmentName, infoObjectName] = String(object.contextKey || "")
      .split("||")
      .map((item) => item.trim());
    if (!environmentName || !segmentName || !infoObjectName) continue;

    addPath(object.id, {
      environmentName,
      segmentName,
      objectId: object.id,
      objectName: infoObjectName,
    });

    for (const segment of object.segments || []) {
      addPath(segment.id, {
        environmentName,
        segmentId: segment.id,
        segmentName,
      });
    }

    for (const environment of byName.get(normalize(environmentName)) || []) {
      if (environment.objectType !== "information_environment") continue;
      addPath(environment.objectId, {
        environmentId: environment.objectId,
        environmentName,
      });
    }
  }

  function visitTree(nodes = [], context = {}) {
    for (const node of nodes) {
      const name = objectLabel(node);
      if (node.type === "information_environment") {
        const nextContext = {
          environmentId: node.id,
          environmentName: name,
        };
        addPath(node.id, nextContext);
        visitTree(node.children || [], nextContext);
        continue;
      }
      if (node.type === "environment_segment") {
        const nextContext = {
          ...context,
          segmentId: node.id,
          segmentName: name,
        };
        addPath(node.id, nextContext);
        visitTree(node.children || [], nextContext);
        continue;
      }
      if (node.type === "information_object") {
        addPath(node.id, {
          ...context,
          objectId: node.id,
          objectName: name,
        });
      }
      visitTree(node.children || [], context);
    }
  }

  visitTree(workbench.navigator?.tree || []);
  return { byId, byName };
}

function nodeArea(node) {
  return Math.max(1, Number(node.width || 0) * Number(node.height || 0));
}

function contains(container, node) {
  if (container.mxId === node.mxId) return false;
  if (!container.label) return false;
  const cx = Number(node.x || 0) + Number(node.width || 0) / 2;
  const cy = Number(node.y || 0) + Number(node.height || 0) / 2;
  return (
    cx >= Number(container.x || 0) &&
    cx <= Number(container.x || 0) + Number(container.width || 0) &&
    cy >= Number(container.y || 0) &&
    cy <= Number(container.y || 0) + Number(container.height || 0) &&
    nodeArea(container) > nodeArea(node) * 1.05
  );
}

function buildContextIndex(nodes) {
  const byId = new Map(nodes.map((node) => [node.mxId, node]));
  return new Map(
    nodes.map((node) => {
      const containers = nodes
        .filter((candidate) => contains(candidate, node))
        .sort((a, b) => nodeArea(a) - nodeArea(b));
      const parent = byId.get(node.parentMxId);
      const labels = unique([
        parent?.label,
        ...containers.map((item) => item.label),
      ]);
      return [node.mxId, labels];
    }),
  );
}

function expandedNames(label, overrides) {
  const names = [{ name: label, confidence: "exact", source: "label" }];
  for (const alias of overrides.aliases?.[label] || []) {
    names.push({ name: alias, confidence: "alias", source: "alias" });
  }
  return names.filter((item, index, list) => list.findIndex((other) => normalize(other.name) === normalize(item.name)) === index);
}

function expandedContextTokens(labels, overrides) {
  const names = [];
  for (const label of labels) {
    names.push(label);
    if ((overrides.candidateOnlyLabels || []).includes(label)) continue;
    if ((overrides.ignoredLabels || []).includes(label)) continue;
    for (const alias of overrides.aliases?.[label] || []) names.push(alias);
  }
  return unique(names.map(normalize));
}

function typeHintsForNode(node, label, overrides) {
  const overrideHints = overrides.objectTypeHints?.[label];
  if (overrideHints?.length) return overrideHints;
  const drawioType = node.drawioObjectType || node.objectType || "unknown";
  if (drawioType === "environment_zone") return ["information_environment"];
  if (drawioType === "environment_segment") return ["environment_segment", "information_environment", "information_object"];
  if (drawioType === "network_boundary") return ["information_object", "environment_segment"];
  if (drawioType === "external_network") return ["information_environment", "environment_segment", "information_object"];
  if (drawioType === "actor") return ["information_object"];
  if (drawioType === "information_object") return ["information_object", "environment_segment", "information_environment"];
  return ["information_object", "environment_segment", "information_environment", "scope_type"];
}

function candidatePathTokens(candidate) {
  const tokens = [];
  for (const item of candidate.paths || []) {
    tokens.push(item.environmentName, item.segmentName, item.objectName);
  }
  tokens.push(candidate.objectName);
  return unique(tokens.map(normalize));
}

function contextScore(candidate, contextTokens) {
  if (!contextTokens.length) return 0;
  const candidateTokens = candidatePathTokens(candidate);
  return candidateTokens.filter((token) => contextTokens.includes(token)).length;
}

function sortCandidates(candidates, typeHints) {
  return [...candidates].sort((a, b) => {
    const confidenceDelta = CONFIDENCE_ORDER[a.confidence] - CONFIDENCE_ORDER[b.confidence];
    if (confidenceDelta) return confidenceDelta;
    const typeDelta = typeHints.indexOf(a.objectType) - typeHints.indexOf(b.objectType);
    if (typeDelta) return typeDelta;
    return a.objectName.localeCompare(b.objectName, "zh-Hans-CN");
  });
}

function dedupeCandidates(candidates, typeHints) {
  const bestById = new Map();
  for (const candidate of sortCandidates(candidates, typeHints)) {
    const key = `${candidate.objectType}:${candidate.objectId}`;
    if (!bestById.has(key)) bestById.set(key, candidate);
  }
  return sortCandidates([...bestById.values()], typeHints);
}

function lookupCandidates(node, overrides, catalog, contextLabels) {
  const label = node.label || "";
  const typeHints = typeHintsForNode(node, label, overrides);
  const nameSources = expandedNames(label, overrides);
  const rawCandidates = [];

  for (const source of nameSources) {
    for (const entry of catalog.byName.get(normalize(source.name)) || []) {
      if (!typeHints.includes(entry.objectType)) continue;
      rawCandidates.push({
        objectType: entry.objectType,
        objectId: entry.objectId,
        objectCode: entry.objectCode,
        objectName: entry.objectName,
        confidence: source.confidence,
        matchName: source.name,
        matchedBy: source.source,
        paths: entry.paths,
      });
    }
  }

  const deduped = dedupeCandidates(rawCandidates, typeHints);
  if (deduped.length <= 1) return { candidates: deduped, confidence: deduped[0]?.confidence || "none", reason: "name_match" };

  const contextTokens = expandedContextTokens(contextLabels, overrides);
  const scored = deduped.map((candidate) => ({ candidate, score: contextScore(candidate, contextTokens) }));
  const bestScore = Math.max(...scored.map((item) => item.score));
  if (bestScore > 0) {
    const filtered = scored.filter((item) => item.score === bestScore).map((item) => item.candidate);
    const filteredDeduped = dedupeCandidates(filtered, typeHints);
    if (filteredDeduped.length < deduped.length) {
      return {
        candidates: filteredDeduped.map((candidate) => ({ ...candidate, confidence: "parent_context" })),
        confidence: "parent_context",
        reason: "parent_container_context",
      };
    }
  }

  return { candidates: deduped, confidence: "none", reason: "ambiguous_name_match" };
}

function applyManualOverride(node, override, catalog) {
  const object = override.objectId ? catalog.byId.get(override.objectId) : null;
  const objectType = override.objectType || object?.objectType || "unknown";
  return {
    ...node,
    drawioObjectType: node.drawioObjectType || node.objectType || "unknown",
    objectType,
    objectId: override.objectId || object?.objectId || "",
    objectCode: override.objectCode || object?.objectCode || "",
    objectName: override.objectName || object?.objectName || "",
    bindStatus: "bound",
    confidence: "manual",
    candidates: [],
    bindingReason: "manual_override",
  };
}

function bindNode(node, overrides, catalog, contextLabels) {
  const label = node.label || "";
  const ignoredMxId = (overrides.ignoredMxIds || []).find((item) => item.mxId === node.mxId);
  if (ignoredMxId) {
    return {
      ...node,
      drawioObjectType: node.drawioObjectType || node.objectType || "unknown",
      bindStatus: "ignored",
      confidence: "none",
      objectId: "",
      objectCode: "",
      objectName: "",
      candidates: [],
      bindingReason: ignoredMxId.reason || "ignored_by_mxid_override",
      contextLabels,
    };
  }
  const manualOverride = (overrides.bindings || []).find((item) => item.mxId === node.mxId);
  if (manualOverride) return applyManualOverride(node, manualOverride, catalog);

  const drawioObjectType = node.drawioObjectType || node.objectType || "unknown";
  if ((overrides.ignoredLabels || []).includes(label)) {
    return {
      ...node,
      drawioObjectType,
      bindStatus: "ignored",
      confidence: "none",
      objectId: "",
      objectCode: "",
      objectName: "",
      candidates: [],
      bindingReason: "ignored_by_override",
      contextLabels,
    };
  }

  const lookup = lookupCandidates(node, overrides, catalog, contextLabels);
  const candidates = lookup.candidates.map((candidate) => ({
    objectType: candidate.objectType,
    objectId: candidate.objectId,
    objectCode: candidate.objectCode,
    objectName: candidate.objectName,
    confidence: candidate.confidence,
    matchName: candidate.matchName,
    matchedBy: candidate.matchedBy,
    context: unique((candidate.paths || []).map((item) => [item.environmentName, item.segmentName].filter(Boolean).join(" / "))),
  }));
  const candidateOnly = (overrides.candidateOnlyLabels || []).includes(label);
  const status = candidates.length === 0 ? "unbound" : candidates.length === 1 && !candidateOnly ? "bound" : "candidate";
  const best = candidates[0] || {};

  return {
    ...node,
    drawioObjectType,
    objectType: best.objectType || node.objectType || "unknown",
    objectId: status === "bound" ? best.objectId || "" : "",
    objectCode: status === "bound" ? best.objectCode || "" : "",
    objectName: status === "bound" ? best.objectName || "" : "",
    bindStatus: status,
    confidence: status === "bound" ? lookup.confidence : candidates.length ? lookup.confidence : "none",
    candidates,
    bindingReason: status === "bound" ? lookup.reason : candidates.length ? (candidateOnly ? "candidate_only_override" : lookup.reason) : "no_name_match",
    contextLabels,
  };
}

function countByStatus(nodes) {
  return Object.fromEntries(STATUS_ORDER.map((status) => [status, nodes.filter((node) => node.bindStatus === status).length]));
}

function countByObjectType(nodes) {
  const result = {};
  for (const node of nodes) {
    const type = node.objectType || "unknown";
    result[type] ||= Object.fromEntries(STATUS_ORDER.map((status) => [status, 0]));
    result[type][node.bindStatus] = (result[type][node.bindStatus] || 0) + 1;
  }
  return result;
}

function duplicateBoundObjectIds(nodes, overrides, catalog) {
  const groups = new Map();
  for (const node of nodes.filter((item) => item.bindStatus === "bound" && item.objectId)) {
    if (!groups.has(node.objectId)) groups.set(node.objectId, []);
    groups.get(node.objectId).push(node);
  }
  return [...groups.entries()]
    .filter(([, group]) => group.length > 1)
    .map(([objectId, group]) => {
      const object = catalog.byId.get(objectId);
      const objectName = object?.objectName || group[0]?.objectName || "";
      const contexts = unique(group.flatMap((node) => node.contextLabels || []));
      const allowedByName = (overrides.allowedDuplicateObjectNames || []).includes(objectName);
      const allowedByContext = contexts.length > 1 || (object?.paths || []).length > 1;
      return {
        objectId,
        objectType: object?.objectType || group[0]?.objectType || "",
        objectName,
        count: group.length,
        mxIds: group.map((node) => node.mxId),
        labels: unique(group.map((node) => node.label)),
        contextLabels: contexts,
        allowed: allowedByName || allowedByContext,
        reason: allowedByName || allowedByContext ? "same catalog object reused across environment contexts" : "needs review",
      };
    });
}

function missingExpectedObjects(nodes, overrides, catalog) {
  const result = [];
  for (const label of overrides.expectedLabels || []) {
    const sameLabelNodes = nodes.filter((node) => node.label === label);
    const relatedNodes = nodes.filter((node) => {
      if (node.label === label) return true;
      return (node.candidates || []).some((candidate) => normalize(candidate.objectName) === normalize(label));
    });
    const workbenchMatches = [];
    for (const sourceName of expandedNames(label, overrides)) {
      for (const match of catalog.byName.get(normalize(sourceName.name)) || []) {
        workbenchMatches.push({
          objectType: match.objectType,
          objectId: match.objectId,
          objectName: match.objectName,
        });
      }
    }
    if (!sameLabelNodes.length && !relatedNodes.length) {
      result.push({ label, reason: "no_semantic_node", workbenchMatches: dedupeSimpleCandidates(workbenchMatches) });
      continue;
    }
    if (!workbenchMatches.length && sameLabelNodes.length) {
      result.push({ label, reason: "no_workbench_object", mxIds: sameLabelNodes.map((node) => node.mxId) });
      continue;
    }
    if (sameLabelNodes.length && !sameLabelNodes.some((node) => node.bindStatus === "bound")) {
      result.push({
        label,
        reason: "not_bound",
        statuses: unique(sameLabelNodes.map((node) => node.bindStatus)),
        mxIds: sameLabelNodes.map((node) => node.mxId),
        workbenchMatches: dedupeSimpleCandidates(workbenchMatches),
      });
    }
  }
  return result;
}

function dedupeSimpleCandidates(candidates) {
  const seen = new Set();
  return candidates.filter((candidate) => {
    const key = `${candidate.objectType}:${candidate.objectId}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function compactNode(node) {
  return {
    mxId: node.mxId,
    label: node.label,
    objectType: node.objectType,
    objectId: node.objectId || "",
    objectCode: node.objectCode || "",
    objectName: node.objectName || "",
    bindStatus: node.bindStatus,
    confidence: node.confidence,
    bindingReason: node.bindingReason,
    candidates: node.candidates || [],
    contextLabels: node.contextLabels || [],
  };
}

function buildReport(semantic, overrides, catalog) {
  const nodes = semantic.nodes || [];
  const statusCounts = countByStatus(nodes);
  const duplicates = duplicateBoundObjectIds(nodes, overrides, catalog);
  return {
    source: {
      semantic: SEMANTIC_PATH,
      workbench: WORKBENCH_PATH,
      overrides: OVERRIDES_PATH,
      generated_at: new Date().toISOString(),
    },
    totalNodes: nodes.length,
    totalEdges: (semantic.edges || []).length,
    ...statusCounts,
    byObjectType: countByObjectType(nodes),
    ambiguousCandidates: nodes.filter((node) => node.bindStatus === "candidate" && (node.candidates || []).length > 1).map(compactNode),
    needsManualConfirmation: nodes.filter((node) => node.bindStatus === "candidate").map(compactNode),
    unboundNodes: nodes.filter((node) => node.bindStatus === "unbound").map(compactNode),
    ignoredNodes: nodes.filter((node) => node.bindStatus === "ignored").map(compactNode),
    boundNodes: nodes.filter((node) => node.bindStatus === "bound").map(compactNode),
    duplicateBoundObjectIds: duplicates,
    disallowedDuplicateBoundObjectIds: duplicates.filter((item) => !item.allowed),
    missingExpectedObjects: missingExpectedObjects(nodes, overrides, catalog),
    rules: [
      "manual overrides by mxId win first",
      "exact normalized name match",
      "alias table match",
      "parent/container context narrows duplicate candidates",
      "candidateOnlyLabels prevent uncertain aliases from becoming bound",
      "no fuzzy matching and no coordinate-only binding",
    ],
  };
}

function renderReportMarkdown(report) {
  const lines = [];
  lines.push("# Environment Basemap Binding Report");
  lines.push("");
  lines.push(`- Generated at: ${report.source.generated_at}`);
  lines.push(`- Total nodes: ${report.totalNodes}`);
  lines.push(`- Total edges: ${report.totalEdges}`);
  lines.push(`- Bound: ${report.bound}`);
  lines.push(`- Candidate: ${report.candidate}`);
  lines.push(`- Unbound: ${report.unbound}`);
  lines.push(`- Ignored: ${report.ignored}`);
  lines.push("");
  lines.push("## Binding Rules");
  for (const rule of report.rules) lines.push(`- ${rule}`);

  function table(title, rows, includeCandidates = false) {
    lines.push("");
    lines.push(`## ${title}`);
    if (!rows.length) {
      lines.push("");
      lines.push("None.");
      return;
    }
    lines.push("");
    lines.push("| mxId | label | status | confidence | objectType | objectName | objectId | candidates | context |");
    lines.push("|---|---|---|---|---|---|---|---|---|");
    for (const row of rows) {
      lines.push(
        [
          row.mxId,
          row.label,
          row.bindStatus,
          row.confidence,
          row.objectType,
          row.objectName,
          row.objectId,
          includeCandidates ? (row.candidates || []).map((item) => `${item.objectType}:${item.objectName}`).join("<br>") : "",
          (row.contextLabels || []).join(" / "),
        ]
          .map(markdownCell)
          .join("|")
          .replace(/^/, "|")
          .replace(/$/, "|"),
      );
    }
  }

  table("Bound Nodes", report.boundNodes);
  table("Candidate Nodes - Manual Confirmation Needed", report.needsManualConfirmation, true);
  table("Unbound Nodes", report.unboundNodes);
  table("Ignored Nodes", report.ignoredNodes);

  lines.push("");
  lines.push("## Duplicate Bound Object IDs");
  if (!report.duplicateBoundObjectIds.length) {
    lines.push("");
    lines.push("None.");
  } else {
    lines.push("");
    lines.push("| objectId | objectName | count | allowed | reason | labels |");
    lines.push("|---|---|---:|---|---|---|");
    for (const item of report.duplicateBoundObjectIds) {
      lines.push(
        `|${markdownCell(item.objectId)}|${markdownCell(item.objectName)}|${item.count}|${item.allowed ? "yes" : "no"}|${markdownCell(item.reason)}|${markdownCell(item.labels.join(", "))}|`,
      );
    }
  }

  lines.push("");
  lines.push("## Missing Expected Objects");
  if (!report.missingExpectedObjects.length) {
    lines.push("");
    lines.push("None.");
  } else {
    lines.push("");
    lines.push("| label | reason | mxIds | workbenchMatches |");
    lines.push("|---|---|---|---|");
    for (const item of report.missingExpectedObjects) {
      lines.push(
        `|${markdownCell(item.label)}|${markdownCell(item.reason)}|${markdownCell((item.mxIds || []).join(", "))}|${markdownCell((item.workbenchMatches || []).map((match) => `${match.objectType}:${match.objectName}`).join("<br>"))}|`,
      );
    }
  }

  return `${lines.join("\n")}\n`;
}

function setAttribute(openTag, name, value) {
  const escaped = escapeHtml(value ?? "");
  const pattern = new RegExp(`\\s${name}="[^"]*"`);
  if (pattern.test(openTag)) return openTag.replace(pattern, ` ${name}="${escaped}"`);
  return openTag.replace(/\s+role="/, `\n      ${name}="${escaped}"\n      role="`);
}

function setNodeClass(openTag, node) {
  return openTag.replace(/class="([^"]*)"/, (_, className) => {
    const nextClasses = className
      .split(/\s+/)
      .filter(Boolean)
      .filter((item) => !item.startsWith("basemap-bind-") && !item.startsWith("basemap-object-") && !item.startsWith("basemap-conf-"));
    nextClasses.push(`basemap-bind-${node.bindStatus || "unbound"}`);
    nextClasses.push(`basemap-object-${node.objectType || "unknown"}`);
    nextClasses.push(`basemap-conf-${node.confidence || "none"}`);
    return `class="${unique(nextClasses).join(" ")}"`;
  });
}

function updateHtmlBindings(html, nodes) {
  const byMxId = new Map(nodes.map((node) => [node.mxId, node]));
  return html.replace(/<div\s+class="basemap-node[\s\S]*?<\/div>/g, (block) => {
    const mxId = block.match(/data-mx-id="([^"]+)"/)?.[1];
    const node = byMxId.get(mxId);
    if (!node) return block;
    const openEnd = block.indexOf(">");
    let openTag = block.slice(0, openEnd + 1);
    const body = block.slice(openEnd + 1);
    openTag = setNodeClass(openTag, node);
    openTag = setAttribute(openTag, "data-object-id", node.objectId || "");
    openTag = setAttribute(openTag, "data-object-type", node.objectType || "unknown");
    openTag = setAttribute(openTag, "data-object-code", node.objectCode || "");
    openTag = setAttribute(openTag, "data-object-name", node.objectName || "");
    openTag = setAttribute(openTag, "data-bind-status", node.bindStatus || "unbound");
    openTag = setAttribute(openTag, "data-confidence", node.confidence || "none");
    openTag = setAttribute(openTag, "title", [node.label, node.objectName, node.bindStatus, node.mxId].filter(Boolean).join(" · "));
    return `${openTag}${body}`;
  });
}

function writeManifest(semantic, report) {
  const data = {
    title: semantic.source?.pageName || "信息化环境及对象底图",
    pageIndex: semantic.source?.page || 3,
    source: semantic.source?.file || "",
    generatedFrom: semantic.source?.parser || "direct mxGraphModel parser",
    htmlPath: "./generated/environmentBasemap.html",
    cssPath: "./generated/environmentBasemap.css",
    semanticPath: "./generated/environmentBasemap.semantic.json",
    bindingReportPath: "./generated/environmentBasemap.binding-report.json",
    bindingReportMarkdownPath: "./generated/environmentBasemap.binding-report.md",
    bindingOverridesPath: "./generated/environmentBasemap.binding-overrides.json",
    canvas: semantic.canvas,
    stats: semantic.stats,
    binding: {
      generatedAt: report.source.generated_at,
      totalNodes: report.totalNodes,
      totalEdges: report.totalEdges,
      bound: report.bound,
      candidate: report.candidate,
      unbound: report.unbound,
      ignored: report.ignored,
      disallowedDuplicateBoundObjectIds: report.disallowedDuplicateBoundObjectIds.length,
      missingExpectedObjects: report.missingExpectedObjects.length,
    },
    limitations: semantic.limitations || [
      "未调用官方 draw.io / diagrams.net 渲染器；本机未检测到 drawio 或 diagrams.net CLI。",
      "edgeStyle 自动路由不重新执行；仅使用 source/target、entry/exit 和显式 mxPoint 生成 polyline/path。",
      "部分 draw.io 专有 shape 图标仅做基础 CSS 近似，节点几何坐标不因此改变。",
    ],
  };
  fs.writeFileSync(
    MANIFEST_PATH,
    `// Generated by scripts/bind_environment_basemap_semantics.mjs. Do not edit by hand.\n(function () {\n  window.sapdEnvironmentBasemapData = Object.freeze(${JSON.stringify(data, null, 2)});\n})();\n`,
  );
}

function main() {
  const semantic = readJson(SEMANTIC_PATH);
  const workbench = readJson(WORKBENCH_PATH);
  const overrides = readJson(OVERRIDES_PATH);
  const catalog = buildCatalog(workbench);
  const contextIndex = buildContextIndex(semantic.nodes || []);

  const nodes = (semantic.nodes || []).map((node) => bindNode(node, overrides, catalog, contextIndex.get(node.mxId) || []));
  const updatedSemantic = {
    ...semantic,
    source: {
      ...semantic.source,
      binding_generated_at: new Date().toISOString(),
      binding_source: WORKBENCH_PATH,
      binding_overrides: OVERRIDES_PATH,
    },
    nodes,
  };
  const report = buildReport(updatedSemantic, overrides, catalog);

  writeJson(SEMANTIC_PATH, updatedSemantic);
  writeJson(REPORT_JSON_PATH, report);
  fs.writeFileSync(REPORT_MD_PATH, renderReportMarkdown(report));
  fs.writeFileSync(HTML_PATH, updateHtmlBindings(fs.readFileSync(HTML_PATH, "utf8"), nodes));
  writeManifest(updatedSemantic, report);

  console.log(JSON.stringify({
    semantic: SEMANTIC_PATH,
    report: REPORT_JSON_PATH,
    markdown: REPORT_MD_PATH,
    totalNodes: report.totalNodes,
    totalEdges: report.totalEdges,
    bound: report.bound,
    candidate: report.candidate,
    unbound: report.unbound,
    ignored: report.ignored,
    disallowedDuplicateBoundObjectIds: report.disallowedDuplicateBoundObjectIds.length,
    missingExpectedObjects: report.missingExpectedObjects.length,
  }, null, 2));
}

main();
