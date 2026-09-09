#!/usr/bin/env node
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const componentPath = path.join(root, "frontend/capability-browser/components/MaturityAssessmentWorkbench.js");
const component = readFileSync(componentPath, "utf8");

function createHarness() {
  const timers = new Map();
  let nextTimer = 1;
  const storage = new Map();
  const listeners = new Map();
  const window = {
    sapdComponents: {
      utils: {
        text: (value) => (value == null ? "" : String(value)),
        list: (value) => (Array.isArray(value) ? value : []),
        escapeHtml: (value) => String(value == null ? "" : value)
          .replaceAll("&", "&amp;")
          .replaceAll("<", "&lt;")
          .replaceAll(">", "&gt;")
          .replaceAll('"', "&quot;"),
      },
      AppShell: { directoryPaneMetrics: { defaultWidth: 304, minWidth: 240, maxWidth: 520, handleWidth: 6 } },
    },
    localStorage: {
      getItem(key) { return storage.get(key) ?? null; },
      setItem(key, value) { storage.set(key, String(value)); },
      removeItem(key) { storage.delete(key); },
    },
    sessionStorage: {
      getItem() { return null; },
      setItem() {},
      removeItem() {},
    },
    crypto: { randomUUID: () => "l2-batch-runtime" },
    CSS: { escape: (value) => String(value) },
    requestAnimationFrame(callback) { callback(); },
    addEventListener(type, listener) { listeners.set(type, listener); },
    removeEventListener(type, listener) {
      if (listeners.get(type) === listener) listeners.delete(type);
    },
    setTimeout(callback) {
      const id = nextTimer++;
      timers.set(id, callback);
      return id;
    },
    clearTimeout(id) { timers.delete(id); },
  };
  const document = {
    activeElement: null,
    body: { classList: { add() {}, remove() {} } },
    documentElement: { dataset: { sapdUiScale: "1" } },
    querySelector() { return null; },
    getElementById() { return null; },
    addEventListener() {},
    removeEventListener() {},
  };
  const marker = "  components.MaturityAssessmentWorkbench = {";
  assert(component.includes(marker), "component registration marker is required for the runtime harness");
  const instrumented = component.replace(marker, `  window.__maturityTest = { model, bindRoot, handleClick, handleChange, handleInput, scoringSelection, capabilityScoreItems, capabilityApplicabilityState, capabilityBatchState, renderHierarchyStatistics, renderL2Summary, renderScoringTab, renderLevelScore, setScoringHierarchy, setScoringFocus, setScoringItem, persistDetail, hydrateWorkspace };
${marker}`);
  vm.runInNewContext(instrumented, {
    window,
    document,
    console,
    CSS: window.CSS,
    structuredClone,
    DOMException,
  }, { filename: componentPath });
  const test = window.__maturityTest;

  class Root {
    constructor() { this.listeners = new Map(); this.innerHTML = ""; this.scrollTop = 0; }
    addEventListener(type, listener) { this.listeners.set(type, listener); }
    removeEventListener(type, listener) {
      if (this.listeners.get(type) === listener) this.listeners.delete(type);
    }
    querySelector() { return null; }
    querySelectorAll() { return []; }
    dispatchEvent(event) {
      this.listeners.get(event.type)?.(event);
      return true;
    }
  }

  const rootElement = new Root();
  test.model.root = null;
  test.bindRoot(rootElement);
  return {
    ...test,
    rootElement,
    storage,
    runEvent(type, target) { rootElement.dispatchEvent({ type, target, preventDefault() {}, stopPropagation() {} }); },
  };
}

function eventTarget(action, data = {}) {
  return {
    dataset: { maturityAction: action, ...data },
    closest(selector) {
      if (selector === "[data-maturity-action]") return this;
      if (selector === "[data-maturity-score-level]") return null;
      if (selector === "[data-maturity-tab]") return null;
      return null;
    },
    matches() { return false; },
  };
}

function sliderTarget(kind, value) {
  const label = { textContent: "" };
  const control = {
    style: { setProperty() {} },
    querySelector() { return label; },
  };
  return {
    dataset: {
      maturityFocusBatchSlider: kind,
      maturityBatchOwner: "capability",
      maturityMinLevel: "1",
      maturityMaxLevel: "5",
    },
    value: String(value),
    matches(selector) { return selector === "[data-maturity-focus-batch-slider]"; },
    closest(selector) { return selector === ".maturity-v9-score-slider" ? control : null; },
    setAttribute() {},
  };
}

function capabilityApplicabilityTarget(capabilityId, checked) {
  return {
    dataset: { capabilityId },
    checked,
    matches(selector) { return selector === "[data-capability-applicability-toggle]"; },
  };
}

const dimensions = ["organization", "process", "tool", "data"];
const allAt = (level) => Object.fromEntries(dimensions.map((key) => [key, level]));

function baseEntry(scoreItemId, overrides = {}) {
  return {
    scoreItemId,
    isApplicable: true,
    elements: {},
    dimensionNotes: { organization: "保留当前说明" },
    reviewElements: {},
    targetElements: {},
    targetDimensionNotes: { organization: "保留目标说明" },
    targetLevel: "",
    targetReason: "",
    targetConfirmed: false,
    evidenceLevel: "E2",
    evidenceSummary: "保留证据",
    note: "保留备注",
    naReason: "",
    status: "incomplete",
    ...overrides,
  };
}

function makeDetail(id = "l2-batch-project") {
  const categories = [{ id: "cat-1", code: "C1", name: "分类", parentId: null, included: true, sortOrder: 0 }];
  const capabilities = [
    { id: "cap-A", code: "A", name: "能力 A", description: "能力说明 A", categoryId: "cat-1", included: true, sortOrder: 0 },
    { id: "cap-B", code: "B", name: "能力 B", description: "能力说明 B", categoryId: "cat-1", included: true, sortOrder: 1 },
  ];
  const focuses = [
    { id: "focus-A-direct", code: "A.F1", name: "直接关注点", capabilityId: "cap-A", included: true, sortOrder: 0 },
    { id: "focus-A-service", code: "A.F2", name: "服务关注点", capabilityId: "cap-A", included: true, sortOrder: 1 },
    { id: "focus-B", code: "B.F1", name: "兄弟关注点", capabilityId: "cap-B", included: true, sortOrder: 0 },
  ];
  const scoreItems = [
    { id: "item-A-direct", itemType: "FOCUS", capabilityId: "cap-A", focusId: "focus-A-direct", included: true, sortOrder: 0, weight: 1 },
    { id: "item-A-service", itemType: "SERVICE", capabilityId: "cap-A", focusId: "focus-A-service", included: true, sortOrder: 1, weight: 1 },
    { id: "item-A-na", itemType: "SERVICE", capabilityId: "cap-A", focusId: "focus-A-service", included: true, sortOrder: 2, weight: 1 },
    { id: "item-B-service", itemType: "SERVICE", capabilityId: "cap-B", focusId: "focus-B", included: true, sortOrder: 0, weight: 1 },
  ];
  const detail = {
    project: { id, name: id, status: "scoring", readOnly: false, updatedAt: "2026-09-08 10:00" },
    template: { id: "template", snapshotId: "snapshot", type: "base", categories, capabilities, focuses, services: [], scoreItems },
    scoreEntries: [
      baseEntry("item-A-direct"),
      baseEntry("item-A-service", { elements: { organization: "L2" }, reviewElements: { process: "L3" } }),
      baseEntry("item-A-na", {
        isApplicable: false,
        elements: { organization: "L1" },
        reviewElements: { tool: "L2" },
        targetElements: { data: "L4" },
        targetDimensionNotes: { data: "不适用草稿目标说明" },
        targetLevel: "",
        targetReason: "不适用草稿目标理由",
        targetConfirmed: false,
        naReason: "明确不适用",
        lastUpdateScope: "LEGACY_IMPORT",
        lastUpdatedAt: "2026-09-07 09:00",
        capabilityBatchSourceId: "legacy-source",
      }),
      baseEntry("item-B-service", { elements: allAt("L2"), targetElements: allAt("L4"), targetLevel: "L4", targetConfirmed: true }),
    ],
    result: {
      capabilityResults: [{ id: "cap-A", code: "A", name: "能力 A", currentIndex: 2, currentLevel: "L2", targetIndex: 4, targetLevel: "L4", dimensionResults: { organization: 2, process: 2, tool: 2, data: 2 }, completionRate: 50, applicableItemCount: 2, completedItemCount: 0 }],
      focusResults: [
        { id: "focus-A-direct", capabilityId: "cap-A", currentIndex: 2, targetIndex: 4, currentLevel: "L2", targetLevel: "L4" },
        { id: "focus-A-service", capabilityId: "cap-A", currentIndex: 2, targetIndex: 4, currentLevel: "L2", targetLevel: "L4" },
      ],
      summary: { statisticsReady: false, completionRate: 0, notScoredCount: 2, targetBelowCurrentCount: 0 },
    },
    resultStale: true,
    dirty: false,
    calculationRevision: 0,
    locallyStored: true,
  };
  return detail;
}

function useCapability(harness, detail, capabilityId = "cap-A") {
  harness.model.details = { [detail.project.id]: detail };
  harness.model.route = `/workbench/maturity/${detail.project.id}`;
  harness.model.selectedCapabilityId = capabilityId;
  harness.model.selectedFocusId = capabilityId === "cap-A" ? "focus-A-direct" : "focus-B";
  harness.model.selectedScoreItemId = capabilityId === "cap-A" ? "item-A-direct" : "item-B-service";
  harness.model.selectedScoreViewLevel = "L2";
  harness.model.selectedScoreViewId = capabilityId;
  detail.scoringLocation = {
    capabilityId,
    focusId: harness.model.selectedFocusId,
    scoreItemId: harness.model.selectedScoreItemId,
    viewLevel: "L2",
    viewId: capabilityId,
  };
  harness.model.capabilityBatchClearConfirmId = "";
  harness.model.capabilityTargetClearConfirmId = "";
  return detail;
}

function entry(detail, id) {
  return detail.scoreEntries.find((item) => item.scoreItemId === id);
}

function fire(harness, action, capabilityId = "cap-A") {
  harness.runEvent("click", eventTarget(action, { capabilityId }));
}

function currentSnapshot(item) {
  return JSON.stringify({
    elements: item.elements,
    reviewElements: item.reviewElements,
    targetElements: item.targetElements,
    targetDimensionNotes: item.targetDimensionNotes,
    targetLevel: item.targetLevel,
    targetReason: item.targetReason,
    targetConfirmed: item.targetConfirmed,
    isApplicable: item.isApplicable,
    dimensionNotes: item.dimensionNotes,
    evidenceLevel: item.evidenceLevel,
    evidenceSummary: item.evidenceSummary,
    note: item.note,
    naReason: item.naReason,
  });
}

function assertJsonEqual(actual, expected, message) {
  assert.equal(JSON.stringify(actual), JSON.stringify(expected), message);
}

const harness = createHarness();
const detail = useCapability(harness, makeDetail());
const capabilityItems = harness.capabilityScoreItems(detail, "cap-A");
assertJsonEqual(capabilityItems.map((item) => item.id), ["item-A-direct", "item-A-service", "item-A-na"], "L2 batch must include FOCUS and SERVICE items but exclude sibling L2");
const initialNaSnapshot = currentSnapshot(entry(detail, "item-A-na"));
const initialNaMetadata = {
  status: entry(detail, "item-A-na").status,
  lastUpdateScope: entry(detail, "item-A-na").lastUpdateScope,
  lastUpdatedAt: entry(detail, "item-A-na").lastUpdatedAt,
  capabilityBatchSourceId: entry(detail, "item-A-na").capabilityBatchSourceId,
};

const rendered = harness.renderHierarchyStatistics(detail, harness.scoringSelection(detail), false);
assert.doesNotMatch(rendered, /toggle-capability-batch/, "L2 hierarchy must not require an expand toggle for unified settings");
assert.equal("capabilityBatchOpen" in harness.model, false, "L2 unified settings must not retain an unused open state");
assert.match(rendered, /maturity-v3-l2-summary/, "L2 hierarchy must reuse the resident capability summary strip");
assert.match(rendered, /maturity-v18-l2-content-grid/, "L2 hierarchy must keep the full-width statistics surface");
assert.match(rendered, /maturity-v18-l2-capability-description/, "L2 statistics must render the selected capability description");
assert.match(rendered, /能力说明 A/, "L2 statistics must render the selected capability description text");
assert.doesNotMatch(rendered, /maturity-v18-l2-capability-context|maturity-v18-l2-capability-facts|maturity-v18-l2-capability-status/, "L2 hierarchy must not render a duplicate capability context rail");
assert.doesNotMatch(rendered, /maturity-v34-l2-batch-disclosure|<details\b/, "L2 unified settings must stay resident rather than use a disclosure");
const analysisPosition = rendered.indexOf("maturity-v18-l2-analysis");
const batchPosition = rendered.indexOf("maturity-v33-focus-batch");
assert.ok(analysisPosition >= 0 && batchPosition > analysisPosition, "L2 unified settings must render below the complete statistics surface");
assert.match(harness.renderLevelScore("L2", null), /<b>—<\/b>/, "an unscored maturity index must render as an em dash");
assert.match(harness.renderLevelScore("L2", 0), /<b>0\.00<\/b>/, "a valid zero maturity index must remain numeric");
assert.match(rendered, /maturity-v33-focus-batch/, "L2 hierarchy must render the unified-setting surface");
assert.match(rendered, /data-maturity-focus-batch-slider="current"/, "L2 hierarchy must render the current-state control directly");
assert.match(rendered, /data-maturity-focus-batch-slider="target"/, "L2 hierarchy must render the target-state control directly");
assert.match(rendered, /data-maturity-action="apply-capability-batch-level"/, "L2 hierarchy must retain the current apply action");
assert.match(rendered, /data-maturity-action="apply-capability-target-batch-level"/, "L2 hierarchy must retain the target apply action");

fire(harness, "apply-capability-batch-level");
assert.equal(entry(detail, "item-A-service").elements.organization, "L2", "partial current score must lock unified current setting");
assert.equal(entry(detail, "item-A-na").elements.organization, "L1", "inapplicable draft must participate in the current lock scan");

const siblingBefore = currentSnapshot(entry(detail, "item-B-service"));
fire(harness, "apply-capability-batch-level", "cap-B");
assert.equal(currentSnapshot(entry(detail, "item-B-service")), siblingBefore, "a stale sibling action target must not write another L2");

fire(harness, "request-clear-capability-scores");
assert.equal(harness.model.capabilityBatchClearConfirmId, "cap-A", "current clear must require confirmation");
const beforeCancel = currentSnapshot(entry(detail, "item-A-service"));
fire(harness, "cancel-clear-capability-scores");
assert.equal(harness.model.capabilityBatchClearConfirmId, "", "cancel must close the current clear confirmation");
assert.equal(currentSnapshot(entry(detail, "item-A-service")), beforeCancel, "cancel must preserve scores");

const naBeforeCurrentClear = currentSnapshot(entry(detail, "item-A-na"));
fire(harness, "request-clear-capability-scores");
fire(harness, "confirm-clear-capability-scores");
assertJsonEqual(entry(detail, "item-A-direct").elements, {}, "current clear must clear direct FOCUS dimensions");
assertJsonEqual(entry(detail, "item-A-service").reviewElements, {}, "current clear must clear review dimensions");
assertJsonEqual(entry(detail, "item-A-na").elements, {}, "current clear must clear stale inapplicable dimensions too");
assertJsonEqual(entry(detail, "item-A-na").reviewElements, {}, "current clear must clear stale inapplicable review dimensions too");
assertJsonEqual(entry(detail, "item-A-na").targetElements, { data: "L4" }, "current clear must preserve target fields");
assert.equal(entry(detail, "item-A-na").naReason, "明确不适用", "current clear must preserve applicability reason");
assertJsonEqual({
  status: entry(detail, "item-A-na").status,
  lastUpdateScope: entry(detail, "item-A-na").lastUpdateScope,
  lastUpdatedAt: entry(detail, "item-A-na").lastUpdatedAt,
  capabilityBatchSourceId: entry(detail, "item-A-na").capabilityBatchSourceId,
}, initialNaMetadata, "current clear must not rewrite unrelated inapplicable metadata");
assert.notEqual(currentSnapshot(entry(detail, "item-A-na")), naBeforeCurrentClear, "inapplicable stale score was explicitly cleared");

const targetBeforeCurrentApply = JSON.stringify(entry(detail, "item-A-na").targetElements);
const inapplicableAfterClear = currentSnapshot(entry(detail, "item-A-na"));
harness.runEvent("input", sliderTarget("current", 4));
assert.equal(harness.model.capabilityBatchLevel, "L4", "L2 slider input must update the capability batch level");
fire(harness, "apply-capability-batch-level");
assertJsonEqual(entry(detail, "item-A-direct").elements, allAt("L4"), "current batch must write every applicable FOCUS item");
assertJsonEqual(entry(detail, "item-A-service").elements, allAt("L4"), "current batch must write every applicable SERVICE item");
assert.equal(JSON.stringify(entry(detail, "item-A-na").targetElements), targetBeforeCurrentApply, "current batch must preserve the inapplicable target draft");
assert.equal(currentSnapshot(entry(detail, "item-A-na")), inapplicableAfterClear, "inapplicable item must not receive apply metadata or unrelated writes");

const currentBeforeTargetClear = JSON.stringify(entry(detail, "item-A-direct").elements);
fire(harness, "request-clear-capability-targets");
fire(harness, "cancel-clear-capability-targets");
assert.equal(JSON.stringify(entry(detail, "item-A-direct").elements), currentBeforeTargetClear, "target clear cancel must preserve current scores");
fire(harness, "request-clear-capability-targets");
fire(harness, "confirm-clear-capability-targets");
assertJsonEqual(entry(detail, "item-A-direct").targetElements, {}, "target clear must clear target dimensions independently");
assertJsonEqual(entry(detail, "item-A-direct").elements, allAt("L4"), "target clear must preserve current dimensions");
assertJsonEqual(entry(detail, "item-A-na").targetElements, {}, "target clear must clear stale inapplicable target drafts");
assert.equal(entry(detail, "item-A-na").naReason, "明确不适用", "target clear must preserve applicability");
assertJsonEqual({
  status: entry(detail, "item-A-na").status,
  lastUpdateScope: entry(detail, "item-A-na").lastUpdateScope,
  lastUpdatedAt: entry(detail, "item-A-na").lastUpdatedAt,
  capabilityBatchSourceId: entry(detail, "item-A-na").capabilityBatchSourceId,
}, initialNaMetadata, "target clear must not rewrite unrelated inapplicable metadata");

harness.runEvent("input", sliderTarget("target", 3));
fire(harness, "apply-capability-target-batch-level");
assert.equal(entry(detail, "item-A-direct").targetElements.organization, undefined, "target below current must remain blocked");
harness.runEvent("input", sliderTarget("target", 4));
fire(harness, "apply-capability-target-batch-level");
assertJsonEqual(entry(detail, "item-A-direct").targetElements, allAt("L4"), "target batch must obey current lower bound and write applicable FOCUS items");
assertJsonEqual(entry(detail, "item-A-service").targetElements, allAt("L4"), "target batch must write applicable SERVICE items");
assertJsonEqual(entry(detail, "item-A-na").targetElements, {}, "target batch must preserve the cleared inapplicable target state");

const persisted = JSON.parse(harness.storage.get("sapd-wiki-maturity-controlled-demo-v2.1"));
assertJsonEqual(persisted.projects[detail.project.id].scoreEntries, detail.scoreEntries, "batch changes must persist through the existing local scoreEntries path");
const reloaded = JSON.parse(JSON.stringify(persisted.projects[detail.project.id]));
assertJsonEqual(reloaded.scoreEntries, detail.scoreEntries, "persisted L2 batch state must reload without a new API shape");

const allNaDetail = makeDetail("l2-all-na");
allNaDetail.scoreEntries.filter((item) => item.scoreItemId.startsWith("item-A-")).forEach((item) => { item.isApplicable = false; });
useCapability(harness, allNaDetail);
const allNaState = harness.capabilityBatchState(allNaDetail, harness.capabilityScoreItems(allNaDetail, "cap-A"));
assert.equal(allNaState.current.canApply, false, "an all-inapplicable L2 must not offer a unified write");
assert.equal(allNaState.current.canClear, true, "an all-inapplicable L2 with stale scores must still allow clearing");
assert.equal(allNaState.target.canClear, true, "an all-inapplicable L2 with stale targets must still allow clearing");
fire(harness, "request-clear-capability-scores");
fire(harness, "confirm-clear-capability-scores");
assertJsonEqual(entry(allNaDetail, "item-A-na").elements, {}, "all-inapplicable current clear must remove stale draft values");
fire(harness, "request-clear-capability-targets");
fire(harness, "confirm-clear-capability-targets");
assertJsonEqual(entry(allNaDetail, "item-A-na").targetElements, {}, "all-inapplicable target clear must remove stale draft values");

const readOnlyDetail = makeDetail("l2-readonly");
readOnlyDetail.project.readOnly = true;
useCapability(harness, readOnlyDetail);
const readOnlyBefore = JSON.stringify(readOnlyDetail.scoreEntries);
fire(harness, "apply-capability-batch-level");
assert.equal(JSON.stringify(readOnlyDetail.scoreEntries), readOnlyBefore, "read-only L2 projects must not accept unified writes");

const siblingDetail = makeDetail("l2-sibling");
useCapability(harness, siblingDetail, "cap-A");
harness.setScoringHierarchy(siblingDetail, "L2", "cap-B");
const siblingRendered = harness.renderHierarchyStatistics(siblingDetail, harness.scoringSelection(siblingDetail), false);
assert.match(siblingRendered, /data-capability-id="cap-B"/, "changing L2 selection must keep the resident controls bound to the selected capability");
assert.doesNotMatch(siblingRendered, /data-capability-id="cap-A"/, "resident L2 controls must not retain a stale capability target");
const capABefore = currentSnapshot(entry(siblingDetail, "item-A-direct"));
fire(harness, "confirm-clear-capability-scores", "cap-A");
assert.equal(currentSnapshot(entry(siblingDetail, "item-A-direct")), capABefore, "a capability clear must revalidate the selected L2 identity");

const focusDetail = makeDetail("focus-regression");
focusDetail.scoreEntries = [
  baseEntry("item-A-direct"),
  baseEntry("item-A-service"),
  baseEntry("item-A-na", { isApplicable: false }),
];
useCapability(harness, focusDetail, "cap-A");
harness.model.selectedScoreViewLevel = "FOCUS";
harness.model.selectedScoreViewId = "focus-A-service";
harness.model.selectedFocusId = "focus-A-service";
harness.model.focusBatchLevel = "L2";
harness.runEvent("click", eventTarget("apply-focus-batch-level", { focusId: "focus-A-service" }));
assertJsonEqual(entry(focusDetail, "item-A-service").elements, allAt("L2"), "existing FOCUS batch apply must keep working");
assertJsonEqual(entry(focusDetail, "item-A-direct").elements, {}, "existing FOCUS batch must not include direct FOCUS rows");

const applicabilityDetail = makeDetail("l2-applicability");
useCapability(harness, applicabilityDetail, "cap-A");
const capabilitySummary = harness.renderL2Summary(
  applicabilityDetail.template.capabilities[0],
  applicabilityDetail.result.capabilityResults[0],
  false,
  applicabilityDetail,
);
assert.match(capabilitySummary, /data-capability-applicability-toggle/, "L2 summary must expose one capability applicability control");
assert.match(capabilitySummary, /data-capability-id="cap-A"/, "L2 applicability control must carry the selected capability ID");
assert.match(capabilitySummary, /data-maturity-l2-applicability-state="mixed"/, "mixed descendants must expose mixed applicability state");
assert.match(capabilitySummary, />部分适用<\/strong>/, "mixed descendants must show the partial-applicability badge");
const preservedByToggle = ["item-A-direct", "item-A-service", "item-A-na"].map((id) => {
  const item = entry(applicabilityDetail, id);
  return { id, elements: item.elements, reviewElements: item.reviewElements, targetElements: item.targetElements, targetDimensionNotes: item.targetDimensionNotes, evidenceLevel: item.evidenceLevel, evidenceSummary: item.evidenceSummary, note: item.note };
});
const siblingApplicabilityBefore = entry(applicabilityDetail, "item-B-service").isApplicable;
harness.runEvent("change", capabilityApplicabilityTarget("cap-A", false));
assert.equal(harness.capabilityApplicabilityState(applicabilityDetail, harness.capabilityScoreItems(applicabilityDetail, "cap-A")).isAllNotApplicable, true, "capability toggle off must mark every direct and service descendant not applicable");
assert.equal(entry(applicabilityDetail, "item-B-service").isApplicable, siblingApplicabilityBefore, "capability applicability must not touch sibling L2 entries");
preservedByToggle.forEach(({ id, ...expected }) => {
  const item = entry(applicabilityDetail, id);
  assertJsonEqual({ id, elements: item.elements, reviewElements: item.reviewElements, targetElements: item.targetElements, targetDimensionNotes: item.targetDimensionNotes, evidenceLevel: item.evidenceLevel, evidenceSummary: item.evidenceSummary, note: item.note }, { id, ...expected }, `capability applicability must preserve scores and evidence for ${id}`);
});
assert.equal(entry(applicabilityDetail, "item-A-direct").status, "not_applicable", "capability applicability must update the derived status");
assert.equal(entry(applicabilityDetail, "item-A-direct").lastUpdateScope, "CAPABILITY_APPLICABILITY", "capability applicability must record the existing owner scope");
const allNaSummary = harness.renderL2Summary(applicabilityDetail.template.capabilities[0], null, false, applicabilityDetail);
assert.match(allNaSummary, /data-maturity-l2-applicability-state="not-applicable"/, "all-NA descendants must show the not-applicable state");
assert.match(allNaSummary, /data-capability-applicability-toggle data-capability-id="cap-A"/, "all-NA capability must remain re-toggleable");
assert.doesNotMatch(allNaSummary, /data-capability-applicability-toggle[^>]*\schecked(?:\s|>)/, "all-NA capability toggle must render unchecked");
harness.runEvent("change", capabilityApplicabilityTarget("cap-A", true));
assert.equal(harness.capabilityApplicabilityState(applicabilityDetail, harness.capabilityScoreItems(applicabilityDetail, "cap-A")).applicableCount, 3, "all-NA capability must be re-applicable without clearing score evidence");
const persistedApplicability = JSON.parse(harness.storage.get("sapd-wiki-maturity-controlled-demo-v2.1"));
assertJsonEqual(persistedApplicability.projects[applicabilityDetail.project.id].scoreEntries, applicabilityDetail.scoreEntries, "capability applicability must persist through the existing scoreEntries path");
useCapability(harness, applicabilityDetail, "cap-A");
harness.model.selectedScoreViewLevel = "FOCUS";
harness.model.selectedScoreViewId = "focus-A-service";
const focusSummary = harness.renderScoringTab(applicabilityDetail);
assert.match(focusSummary, /data-capability-applicability-toggle data-capability-id="cap-A"/, "FOCUS scoring surface must reuse the same L2 applicability control");
const emptyDetail = makeDetail("l2-empty");
emptyDetail.template.scoreItems = [];
useCapability(harness, emptyDetail, "cap-A");
const emptySummary = harness.renderL2Summary(emptyDetail.template.capabilities[0], null, false, emptyDetail);
assert.match(emptySummary, /data-maturity-l2-applicability-state="empty"/, "empty L2 descendants must expose the empty state");
assert.match(emptySummary, /data-capability-applicability-toggle[^>]*disabled/, "empty L2 descendants must disable the applicability control");
const readOnlyApplicability = makeDetail("l2-applicability-readonly");
readOnlyApplicability.project.readOnly = true;
useCapability(harness, readOnlyApplicability, "cap-A");
const readOnlySummary = harness.renderL2Summary(readOnlyApplicability.template.capabilities[0], readOnlyApplicability.result.capabilityResults[0], false, readOnlyApplicability);
assert.match(readOnlySummary, /data-capability-applicability-toggle[^>]*disabled/, "read-only L2 summaries must disable the applicability control");
const readOnlyApplicabilityBefore = JSON.stringify(readOnlyApplicability.scoreEntries);
harness.runEvent("change", capabilityApplicabilityTarget("cap-A", false));
assert.equal(JSON.stringify(readOnlyApplicability.scoreEntries), readOnlyApplicabilityBefore, "read-only capability applicability must not write entries");

console.log("maturity L2 capability batch runtime checks passed");
