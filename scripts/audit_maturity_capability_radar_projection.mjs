#!/usr/bin/env node

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const componentPath = path.join(root, "frontend/capability-browser/components/MaturityAssessmentWorkbench.js");
const component = readFileSync(componentPath, "utf8");

function recordingContext() {
  const paths = [];
  let currentPath = null;
  const context = {
    paths,
    setTransform() {},
    clearRect() {},
    beginPath() {
      currentPath = { commands: [], closed: false, strokeStyle: context.strokeStyle, lineWidth: context.lineWidth };
      paths.push(currentPath);
    },
    moveTo(x, y) { currentPath?.commands.push(["moveTo", x, y]); },
    lineTo(x, y) { currentPath?.commands.push(["lineTo", x, y]); },
    closePath() { if (currentPath) currentPath.closed = true; },
    arc(x, y, radius) { currentPath?.commands.push(["arc", x, y, radius]); },
    stroke() { if (currentPath) currentPath.strokeed = true; },
    fill() { if (currentPath) currentPath.filled = true; },
    fillText(text, x, y) { context.labels.push({ text: String(text), x, y }); },
    setLineDash(value) { context.lineDash = [...value]; },
    labels: [],
    lineDash: [],
    lineWidth: 1,
    strokeStyle: "",
    fillStyle: "",
    font: "",
    textAlign: "",
    textBaseline: "",
  };
  return context;
}

function makeCanvas(context) {
  return {
    dataset: { radarHeight: "480", radarMinWidth: "560" },
    getBoundingClientRect() { return { width: 880 }; },
    getContext() { return context; },
    style: {},
  };
}

function makeHarness() {
  const window = {
    sapdComponents: {
      utils: {
        text: (value) => (value == null ? "" : String(value)),
        list: (value) => (Array.isArray(value) ? value : []),
        escapeHtml: (value) => String(value ?? "")
          .replaceAll("&", "&amp;")
          .replaceAll("<", "&lt;")
          .replaceAll(">", "&gt;")
          .replaceAll('"', "&quot;"),
      },
    },
    devicePixelRatio: 1,
    addEventListener() {},
    removeEventListener() {},
    setTimeout() { return 0; },
    clearTimeout() {},
    requestAnimationFrame(callback) { callback(); },
    localStorage: { getItem() { return null; }, setItem() {}, removeItem() {} },
    sessionStorage: { getItem() { return null; }, setItem() {}, removeItem() {} },
    CSS: { escape: (value) => String(value) },
  };
  const document = {
    activeElement: null,
    body: {},
    documentElement: { dataset: {} },
    addEventListener() {},
    removeEventListener() {},
    querySelector() { return null; },
    getElementById() { return null; },
  };
  const marker = "  components.MaturityAssessmentWorkbench = {";
  assert(component.includes(marker), "maturity component injection point missing");
  const instrumented = component.replace(
    marker,
    `  window.__maturityTest = { model, capabilityRadarGroupsForRadar, reportCapabilityRadarGroups, renderCapabilityRadar, drawMaturityRadar };\n${marker}`,
  );
  vm.runInNewContext(instrumented, {
    window,
    document,
    console,
    structuredClone,
    CSS: window.CSS,
    navigator: {},
    performance: { now: () => 0 },
  }, { filename: componentPath });
  return window.__maturityTest;
}

function detailFor(rows) {
  return {
    project: { id: "radar-projection", name: "Radar Projection", status: "completed", readOnly: true },
    template: {
      categories: [{ id: "top-t", code: "T", name: "技术", capabilityLevel: "L0", sortOrder: 1 }],
      capabilities: rows.map((row, index) => ({ id: row.id, code: row.code, name: row.name, topCategoryId: "top-t", categoryId: "top-t", sortOrder: index + 1 })),
      focuses: [],
      scoreItems: [],
    },
    result: {
      ok: true,
      summary: { dimensionResults: { organization: 2, process: 2, tool: 2, data: 2 }, targetDimensionResults: { organization: 4, process: 4, tool: 4, data: 4 } },
      capabilityResults: rows,
      categoryResults: [],
      subCategoryResults: [],
      gapItems: [],
      maturityDistribution: [],
      evidenceDistribution: [],
    },
  };
}

const rows = [
  { id: "cap-a", code: "T-A", name: "适用 A", displayLabel: "A", applicableItemCount: 1, currentIndex: 2, targetIndex: 3 },
  { id: "cap-na", code: "T-NA", name: "全 NA", displayLabel: "NA", applicableItemCount: 0, currentIndex: null, targetIndex: null, status: "not_applicable" },
  { id: "cap-u", code: "T-U", name: "适用未评分", displayLabel: "U", applicableItemCount: 1, currentIndex: null, targetIndex: null, status: "partial" },
  { id: "cap-b", code: "T-B", name: "适用 B", displayLabel: "B", applicableItemCount: 1, currentIndex: 4, targetIndex: 5 },
  { id: "cap-c", code: "T-C", name: "适用 C", displayLabel: "C", applicableItemCount: 1, currentIndex: 3, targetIndex: 4 },
];
const harness = makeHarness();
const detail = detailFor(rows);
const radarGroups = harness.capabilityRadarGroupsForRadar(detail);
const radarRows = radarGroups.flatMap((group) => group.rows);
assert.deepEqual(Array.from(radarRows, (row) => row.id), ["cap-a", "cap-u", "cap-b", "cap-c"], "only all-NA L2 axes must be removed");
assert(radarRows.some((row) => row.id === "cap-u"), "an applicable but unscored L2 must remain an axis");
assert(!radarRows.some((row) => row.id === "cap-na"), "an all-NA L2 must be removed from the axis set");

const rendered = harness.renderCapabilityRadar(detail);
assert(rendered.includes("4 项适用 L2 能力"), "result radar title must use the filtered capability count");
assert(rendered.includes("1 项未评分，不按 0 分计算"), "unscored applicable axes must be disclosed without zero-filling");

const allScoredDetail = detailFor(rows.filter((row) => row.id !== "cap-u"));
const allScoredContext = recordingContext();
const allScoredCanvas = makeCanvas(allScoredContext);
harness.model.activeTab = "results";
harness.model.root = { querySelector(selector) { return selector === "[data-maturity-capability-radar]" ? allScoredCanvas : null; } };
harness.drawMaturityRadar(allScoredDetail);
const currentSeries = allScoredContext.paths.find((path) => path.strokeStyle === "#1676c5" && path.lineWidth === 2 && path.commands.filter(([name]) => name === "lineTo").length >= 2);
const targetSeries = allScoredContext.paths.find((path) => path.strokeStyle === "#9a6d2f" && path.lineWidth === 2 && path.commands.filter(([name]) => name === "lineTo").length >= 2);
assert(currentSeries?.closed, "filtered current series must close through the remaining axes");
assert(targetSeries?.closed, "filtered target series must close through the remaining axes");
assert.deepEqual(Array.from(allScoredContext.labels.filter((item) => ["A", "B", "C"].includes(item.text)), (item) => item.text), ["A", "B", "C"], "filtered radar must redraw three remaining labels, not four angular positions");

const partialContext = recordingContext();
const partialCanvas = makeCanvas(partialContext);
harness.model.root = { querySelector(selector) { return selector === "[data-maturity-capability-radar]" ? partialCanvas : null; } };
harness.drawMaturityRadar(detail);
assert(partialContext.labels.some((item) => item.text === "U"), "unscored applicable axis label must remain visible");
assert(!partialContext.labels.some((item) => item.text === "NA"), "excluded all-NA axis label must not be drawn");

const allNaDetail = detailFor(rows.map((row) => ({ ...row, applicableItemCount: 0, currentIndex: null, targetIndex: null, status: "not_applicable" })));
assert.equal(harness.capabilityRadarGroupsForRadar(allNaDetail).flatMap((group) => group.rows).length, 0, "all-NA must leave no radar axes");
assert(harness.renderCapabilityRadar(allNaDetail).includes("有效 L2 能力少于 3 个"), "all-NA must use the existing small-set empty state");

const twoAxisDetail = detailFor(rows.slice(0, 2));
assert(harness.renderCapabilityRadar(twoAxisDetail).includes("有效 L2 能力少于 3 个"), "one or two valid axes must use the existing small-set empty state");

const reportDetail = {
  ...detail,
  report: {
    formal: true,
    html: "<html>",
    markdown: "# report",
    reportModel: {
      schemaVersion: "sapd-maturity-report-model-v2",
      resultSnapshot: { capabilityResults: rows },
      sections: [{ id: "radars", data: { capabilityRadar: {
        groups: [{ id: "top-t", code: "T", name: "技术", count: 5 }],
        axes: rows.map((row) => ({ id: row.id, code: row.code, label: row.name, groupCode: "T", current: row.currentIndex, target: row.targetIndex, applicableItemCount: row.applicableItemCount })),
      } } }],
    },
  },
};
const reportRows = harness.reportCapabilityRadarGroups(reportDetail).flatMap((group) => group.rows);
assert.deepEqual(Array.from(reportRows, (row) => row.id), ["cap-a", "cap-u", "cap-b", "cap-c"], "report snapshot radar must share the filtered axis set");

console.log(JSON.stringify({ result: "pass", filteredAxes: Array.from(radarRows, (row) => row.id), allScoredClosed: true, reportAxes: reportRows.length }));
