#!/usr/bin/env node

import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const DEFAULT_BASE_URL = "http://127.0.0.1:5173";

function argValue(name, fallback) {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function read(relativePath, encoding = "utf8") {
  return readFile(new URL(`../${relativePath}`, import.meta.url), encoding);
}

function unwrapEnvelope(payload) {
  return payload && typeof payload === "object" && Object.prototype.hasOwnProperty.call(payload, "data") ? payload.data : payload;
}

function sameObject(left, right) {
  return Boolean(left?.id && right?.id && left.id === right.id && left.type === right.type && left.code === right.code);
}

function cssBlock(source, selector) {
  const index = source.indexOf(selector);
  assert(index >= 0, `missing CSS selector: ${selector}`);
  const start = source.indexOf("{", index);
  const end = source.indexOf("}", start);
  assert(start >= 0 && end > start, `invalid CSS block: ${selector}`);
  return source.slice(index, end + 1);
}

function extractForbiddenMainKeys(source, file) {
  const match = source.match(/const forbiddenMainKeys = new Set\(\[([\s\S]*?)\]\);/);
  assert(match, `${file}: forbiddenMainKeys contract missing`);
  return [...match[1].matchAll(/"([^"]+)"/g)].map((item) => item[1]);
}

function assertSameStringSet(actual, expected, label) {
  const left = [...new Set(actual)].sort();
  const right = [...new Set(expected)].sort();
  assert(JSON.stringify(left) === JSON.stringify(right), `${label}: ${left.join(",")} != ${right.join(",")}`);
}

function runNodeAudit(script, args = []) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [script, ...args], { cwd: ROOT, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code !== 0) {
        reject(new Error(`${script} failed: ${(stderr || stdout).trim().slice(0, 4000)}`));
        return;
      }
      try {
        resolve(JSON.parse(stdout));
      } catch (error) {
        reject(new Error(`${script} returned invalid JSON: ${error.message}`));
      }
    });
  });
}

async function validateDrawioBoundary(contract, sources) {
  const asset = await read(contract.drawio.asset, null);
  const hash = createHash("sha256").update(asset).digest("hex");
  assert(hash === contract.drawio.sha256, `Draw.io baseline hash changed: ${hash}`);
  assert(contract.drawio.stylePolicy === "immutable_external_overlay_only", "Draw.io style policy must stay external-overlay-only");
  assert(sources.viewer.includes('layer.setAttribute("data-basemap-hit-layer", "")'), "Draw.io hit layer marker missing");
  assert(sources.viewer.includes('document.createElement("button")'), "Draw.io overlay nodes must use native buttons");
  assert(sources.viewer.includes("host.append(layer)"), "Draw.io hit layer must be a sibling overlay inside the host");
  const highlightBlock = sources.viewer.match(/function applyHighlight\(root\) \{[\s\S]*?\n  \}\n\n  function selectNode/)?.[0] || "";
  assert(highlightBlock.includes("classList.toggle"), "Draw.io highlight must be class-driven overlay state");
  assert(!highlightBlock.includes("setAttribute(") && !highlightBlock.includes(".style."), "Draw.io highlight must not mutate SVG visual attributes");
  const forbiddenMutations = [
    /\.setAttribute\(\s*["'](?:fill|stroke|font-family|font-size|filter)["']/,
    /\.style\.(?:fill|stroke|filter|fontFamily|fontSize)\s*=/,
    /querySelectorAll\([^)]*(?:path|rect|text|polygon|ellipse)[^)]*\)[\s\S]{0,180}(?:setAttribute|\.style\.)/,
  ];
  forbiddenMutations.forEach((pattern) => assert(!pattern.test(sources.viewer), `Draw.io visual mutation matched ${pattern}`));
  assert(!sources.css.includes(".basemap-lab-inline-svg"), "Draw.io imported SVG must not receive CSS visual overrides");
  return hash;
}

function validateSemanticColorBoundary(contract, sources) {
  assert(contract.semanticColors.drawioExcluded === true, "Draw.io must stay outside generated-UI semantic colors");
  for (const token of Object.values(contract.semanticColors.statusTokens)) {
    assert(sources.css.includes(`${token}:`), `missing semantic state token ${token}`);
    assert(sources.displayLabels.includes(`"${token}"`), `display semantic role registry missing ${token}`);
  }
  for (const className of Object.values(contract.semanticColors.objectRoleClasses)) {
    assert(sources.displayLabels.includes(`"${className}"`), `display object role missing ${className}`);
  }
  assert(cssBlock(sources.css, ".status-badge-ok strong").includes("var(--sapd-state-complete)"), "complete state must use complete token");
  assert(cssBlock(sources.css, ".status-badge-warning strong").includes("var(--sapd-state-warning)"), "warning state must use warning token");
  assert(cssBlock(sources.css, ".basemap-hit-node.is-selected").includes("var(--sapd-state-selected)"), "selection overlay must use selected token");
  for (const selector of [
    ".relation-chip.technical-chip,",
    ".relation-chip.ownership-chip,",
    ".relation-chip.module-chip,",
    ".relation-chip.measure-chip,",
    ".relation-chip.system-chip,",
    ".relation-chip.environment-chip,",
    ".relation-chip.note-chip {",
  ]) {
    assert(!cssBlock(sources.css, selector).includes("--sapd-state-"), `object role colors must not reuse state tokens: ${selector}`);
  }
}

function validateAccessibilityBoundary(sources) {
  const tabSource = sources.capabilityMap;
  assert(tabSource.includes('role="tab"'), "capability relation tabs need tab semantics");
  assert(tabSource.includes('aria-selected="${activeTab === id ? "true" : "false"}"'), "capability relation tabs need aria-selected");
  assert(tabSource.includes('tabindex="${activeTab === id ? "0" : "-1"}"'), "capability relation tabs need roving tabindex");
  assert(tabSource.includes('aria-controls="capability-relation-panel-${escape(id)}"'), "capability relation tabs need aria-controls");
  assert(tabSource.includes('tabindex="-1"') && tabSource.includes("relation-view-radio"), "hidden relation radios must leave the tab order");
  assert(sources.app.includes('event.target?.closest?.(".relation-view-tab[role=\'tab\']")'), "capability tabs need keyboard handling");
  for (const key of ["ArrowLeft", "ArrowRight", "Home", "End", "Enter"]) assert(sources.app.includes(`"${key}"`), `capability tab keyboard flow missing ${key}`);
  assert(sources.dimensionTree.includes('<button class="tree-row tree-node-row'), "capability tree rows must be native buttons");
  assert(sources.dimensionTree.includes("aria-expanded"), "capability tree branches need aria-expanded");
  assert(sources.viewer.includes('document.createElement("button")'), "Draw.io overlay nodes must be native buttons");
  assert(sources.networkGraph.includes('tabindex="0"') && sources.networkGraph.includes('role="listitem"'), "relation graph nodes must be keyboard focusable");
  assert(sources.css.includes("button:focus-visible") && sources.css.includes(".relation-view-tab:focus-visible"), "representative controls need visible focus rings");
  assert(sources.css.includes("@media (prefers-reduced-motion: reduce)"), "reduced motion contract missing");
  assert(sources.css.includes(".sapd-visually-hidden"), "screen-reader-only utility missing");
  for (const shell of [sources.index, sources.appShell]) {
    assert(shell.includes('id="appLiveStatus"') && shell.includes('aria-live="polite"') && shell.includes('aria-atomic="true"'), "global live status region missing");
  }
  assert(sources.app.includes("function announceAppStatus") && sources.app.includes("已切换到"), "capability dynamic status announcements missing");
  assert(sources.viewer.includes("data-basemap-live-status") && sources.viewer.includes("function announceBasemapStatus"), "Draw.io positioning announcements missing");
}

function validateFieldBoundary(contract, sources) {
  const expected = contract.fieldBoundary.forbiddenMainKeys;
  assertSameStringSet(extractForbiddenMainKeys(sources.projectionAudit, "audit_capability_projection_contract.mjs"), expected, "projection forbidden fields");
  assertSameStringSet(extractForbiddenMainKeys(sources.viewModelAudit, "audit_capability_viewmodel_contract.mjs"), expected, "viewmodel forbidden fields");
  const boundaryBlock = sources.viewModelAudit.match(/function validateMainDisplayBoundary\(item, viewModel\) \{[\s\S]*?\n\}/)?.[0] || "";
  for (const marker of ["technicalMappingRows", "managementMappingRows", "standardMappingRows", "localRelationMap"]) {
    assert(boundaryBlock.includes(marker), `viewmodel main-display boundary missing ${marker}`);
  }
  assert(contract.fieldBoundary.evidenceContainer === "sourceEvidence", "source evidence container contract changed");
}

async function fetchProjection(baseUrl, item) {
  const url = new URL("/api/v1/capabilities/workspace-view", baseUrl);
  url.searchParams.set("object_type", item.objectType);
  url.searchParams.set("object_id", item.code);
  const response = await fetch(url);
  assert(response.ok, `${item.code}: HTTP ${response.status}`);
  return unwrapEnvelope(await response.json());
}

async function validateCurrentObjectBoundary(contract, baseUrl) {
  const checked = [];
  for (const item of contract.currentObjectCases) {
    const data = await fetchProjection(baseUrl, item);
    const selected = data.selected || {};
    const center = data.graph?.center || {};
    assert(selected.type === item.objectType && selected.code === item.code, `${item.code}: selected object mismatch`);
    assert(data.graphScope === item.graphScope, `${item.code}: graphScope=${data.graphScope}`);
    assert(sameObject(selected, center), `${item.code}: graph center does not match selected object`);
    if (item.objectType === "capability_focus") {
      assert(sameObject(selected, data.localRelationMap?.focus), `${item.code}: localRelationMap.focus does not match selected object`);
      for (const key of ["technicalMappingRows", "managementMappingRows", "standardMappingRows"]) {
        for (const row of Array.isArray(data[key]) ? data[key] : []) {
          assert(row?.focus?.code === item.code && row?.focus?.id === selected.id, `${item.code}: ${key} escaped current focus`);
        }
      }
    } else {
      assert(!data.localRelationMap, `${item.code}: non-focus object returned a localRelationMap`);
    }
    checked.push(`${item.objectType}:${item.code}`);
  }
  return checked;
}

async function main() {
  const baseUrl = argValue("--url", DEFAULT_BASE_URL).replace(/\/$/, "");
  const contract = JSON.parse(await read("config/frontend-p0-1-correctness-boundary.json"));
  const paths = {
    css: "frontend/capability-browser/styles.css",
    displayLabels: "frontend/capability-browser/displayLabels.js",
    capabilityMap: "frontend/capability-browser/components/CapabilityLocalRelationMap.js",
    dimensionTree: "frontend/capability-browser/components/DimensionTree.js",
    viewer: contract.drawio.viewer,
    networkGraph: "frontend/capability-browser/components/LocalRelationNetworkGraph.js",
    app: "frontend/capability-browser/app.js",
    appShell: "frontend/capability-browser/components/AppShell.js",
    index: "frontend/capability-browser/index.html",
    projectionAudit: "scripts/audit_capability_projection_contract.mjs",
    viewModelAudit: "scripts/audit_capability_viewmodel_contract.mjs"
  };
  const sources = Object.fromEntries(await Promise.all(Object.entries(paths).map(async ([key, path]) => [key, await read(path)])));
  const drawioSha256 = await validateDrawioBoundary(contract, sources);
  validateSemanticColorBoundary(contract, sources);
  validateAccessibilityBoundary(sources);
  validateFieldBoundary(contract, sources);
  const currentObjects = await validateCurrentObjectBoundary(contract, baseUrl);
  const [viewModelAudit, serviceScopeAudit] = await Promise.all([
    runNodeAudit("scripts/audit_capability_viewmodel_contract.mjs", ["--url", baseUrl]),
    runNodeAudit("scripts/audit_service_scope_chip_color_contract.mjs"),
  ]);
  assert(viewModelAudit.result === "pass", "capability ViewModel boundary audit failed");
  assert(serviceScopeAudit.status === "pass", "service scope semantic color audit failed");
  console.log(JSON.stringify({
    result: "pass",
    contract: contract.version,
    baseUrl,
    currentObjects,
    drawio: { sha256: drawioSha256, styleDiff: 0, policy: contract.drawio.stylePolicy },
    semanticColors: { stateTokens: Object.keys(contract.semanticColors.statusTokens), drawioExcluded: true },
    accessibility: "representative_keyboard_and_live_status_contract",
    delegatedAudits: { viewModelCases: viewModelAudit.checked.length, serviceScopeChecks: serviceScopeAudit.checkCount },
    forbiddenMainFields: { count: contract.fieldBoundary.forbiddenMainKeys.length, violations: 0 }
  }, null, 2));
}

main().catch((error) => {
  console.error(JSON.stringify({ result: "fail", error: error.message }, null, 2));
  process.exit(1);
});
