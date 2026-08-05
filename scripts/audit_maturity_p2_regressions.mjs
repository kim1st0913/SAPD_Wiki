#!/usr/bin/env node
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const componentPath = path.join(root, "frontend/capability-browser/components/MaturityAssessmentWorkbench.js");
const component = readFileSync(componentPath, "utf8");
const appSource = readFileSync(path.join(root, "frontend/capability-browser/app.js"), "utf8");

for (const token of [
  "function scheduleDetailPersistence(detail)",
  "}, 300);",
  "function flushScheduledDetailPersistence()",
  'window.addEventListener("pagehide", flushScheduledDetailPersistence)',
  "pendingProjectId !== detail.project.id",
]) {
  assert(component.includes(token), `missing batched persistence contract: ${token}`);
}

for (const token of [
  'const homePage = model.root?.querySelector(".maturity-v1-list-page")',
  "homeTop",
  "homeLeft",
  "homePage.scrollTop = state.homeTop",
]) {
  assert(component.includes(token), `missing homepage scroll restoration contract: ${token}`);
}

for (const token of [
  "function rememberDeleteReturnFocus(actionTarget)",
  "function restoreDeleteReturnFocus(fallbackSelector)",
  "function applyDeleteModalInertBoundary(deleteLayer)",
  'document.addEventListener("keydown", handleDeleteModalKeydown, true)',
  'const deleteModal = model.root?.querySelector(".maturity-v53-delete-modal")',
  "!deleteModal.contains(document.activeElement)",
  "sibling.inert = true",
]) {
  assert(component.includes(token), `missing delete-dialog focus contract: ${token}`);
}

const renderWorkbenchSource = appSource.slice(
  appSource.indexOf("function renderWorkbench()"),
  appSource.indexOf("function sourceSearchPlaceholder("),
);
assert(
  renderWorkbenchSource.indexOf("MaturityAssessmentWorkbench?.unmount?.()") >= 0
    && renderWorkbenchSource.indexOf("MaturityAssessmentWorkbench?.unmount?.()") < renderWorkbenchSource.indexOf('setHtml("workbenchWorkspace"'),
  "workbench root replacement did not unmount the maturity component first",
);
const setActiveViewSource = appSource.slice(
  appSource.indexOf("function setActiveView("),
  appSource.indexOf("function bindEvents("),
);
assert(
  setActiveViewSource.includes('previousView === "workbench"')
    && setActiveViewSource.includes("MaturityAssessmentWorkbench?.unmount?.()"),
  "leaving the workbench did not unmount the maturity component",
);

const modelingGuideSource = appSource.slice(
  appSource.indexOf("function renderModelingLanguageGuide("),
  appSource.indexOf("function renderMaturityModelGuideNav("),
);
assert(
  modelingGuideSource.includes('bindSpecializedWheelSurfaces($("contentList"));'),
  "modeling language poster did not bind its local wheel surface after rendering",
);

function maturityHarness() {
  let nextTimer = 1;
  const timers = new Map();
  const storage = new Map();
  const storageReadKeys = [];
  let storageWriteCount = 0;
  let failedWrites = 0;
  let failedReads = 0;
  const window = {
    sapdComponents: {},
    localStorage: {
      getItem(key) {
        storageReadKeys.push(key);
        if (failedReads > 0) {
          failedReads -= 1;
          throw new Error("storage unavailable");
        }
        return storage.get(key) ?? null;
      },
      setItem(key, value) {
        storageWriteCount += 1;
        if (failedWrites > 0) {
          failedWrites -= 1;
          throw new Error("storage unavailable");
        }
        storage.set(key, String(value));
      },
      removeItem(key) { storage.delete(key); },
    },
    sessionStorage: { getItem() { return null; }, setItem() {} },
    clearTimeout(id) { timers.delete(id); },
    setTimeout(callback) {
      const id = nextTimer++;
      timers.set(id, callback);
      return id;
    },
    requestAnimationFrame(callback) { callback(); },
    addEventListener() {},
    scrollX: 0,
    scrollY: 0,
    scrollTo(x, y) { this.scrollX = x; this.scrollY = y; },
    CSS: { escape: (value) => String(value) },
    crypto: { randomUUID: () => "test-uuid" },
  };
  class FileReader {
    readAsDataURL() {
      this.result = "data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,ZmFrZQ==";
      this.onload?.();
    }
  }
  const documentListeners = new Map();
  const documentListenerCounts = new Map();
  const document = {
    activeElement: null,
    body: null,
    querySelector() { return null; },
    getElementById() { return null; },
    addEventListener(type, listener, capture) {
      const key = `${type}:${Boolean(capture)}`;
      documentListeners.set(key, listener);
      documentListenerCounts.set(key, (documentListenerCounts.get(key) || 0) + 1);
    },
    removeEventListener(type, listener, capture) {
      const key = `${type}:${Boolean(capture)}`;
      if (documentListeners.get(key) === listener) documentListeners.delete(key);
    },
  };
  const marker = "  components.MaturityAssessmentWorkbench = {";
  assert(component.includes(marker), "maturity test harness injection point missing");
  const instrumented = component.replace(marker, `  window.__maturityTest = { model, persistDetail, scheduleDetailPersistence, flushScheduledDetailPersistence, hydrateWorkspace, dashboardSnapshot, bindRoot, handleDeleteModalKeydown, applyDeleteModalInertBoundary, clearDeleteModalInertBoundary, restoreRenderPosition, render, renderProjectList, displayTemplateName, standardProjectTemplateName, standardCustomTemplateName, syncMaturityShellHeader, copyTemplateSubtree, createStandaloneTemplateWorkspace, refreshHydratedAssessments, restorePersistedReports, importTemplate, importScoreExchange, generateReport, calculateDetail, saveCreateDraft, createProject, saveProjectInfo, validateTemplate, completeAssessment, unlockAssessmentForEditing, beginScoreDirectoryResize, unmount: typeof unmount === "function" ? unmount : undefined };\n${marker}`);
  vm.runInNewContext(instrumented, {
    window,
    document,
    documentListeners,
    documentListenerCounts,
    window,
    console,
    structuredClone,
    CSS: window.CSS,
    FileReader,
  }, { filename: componentPath });
  return {
    ...window.__maturityTest,
    document,
    documentListeners,
    documentListenerCounts,
    window,
    storage,
    storageReadKeys,
    storageWriteCount() { return storageWriteCount; },
    failNextReads(count) { failedReads = count; },
    failNextWrites(count) { failedWrites = count; },
    runTimers() {
      while (timers.size) {
        const pending = [...timers.values()];
        timers.clear();
        pending.forEach((callback) => callback());
      }
    },
  };
}

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function assessmentDetail(id = "project-assessment") {
  return {
    project: { id, name: id, status: "completed", readOnly: true, updatedAt: "2026-08-05 10:00" },
    template: { id: "template", snapshotId: "template-snapshot", type: "base", categories: [], capabilities: [], focuses: [], services: [], scoreItems: [] },
    scoreEntries: [],
    result: {
      ok: true,
      summary: { statisticsReady: true, completionRate: 100, notScoredCount: 0, targetBelowCurrentCount: 0 },
      calculationRun: { inputHash: "input-hash", resultHash: "result-hash" },
    },
    resultStale: false,
    dirty: false,
    calculationRevision: 0,
    report: {
      id: "old-receipt",
      ok: true,
      formal: true,
      reportModel: { schemaVersion: "sapd-maturity-report-model-v2" },
      persistence: { projectId: id, artifactId: "old-artifact", reportId: "old-receipt" },
    },
    reportNarrative: { executiveSummary: "old narrative" },
    reportNarrativeDirty: false,
    reportV2Conclusions: {},
    improvementRoadmap: [],
    exchangeBatches: [],
    scoreImportIssues: [],
    locallyStored: true,
  };
}

function fullReport(id, detail) {
  return {
    id,
    ok: true,
    formal: true,
    html: `<p>${id}</p>`,
    markdown: id,
    reportModel: {
      schemaVersion: "sapd-maturity-report-model-v2",
      project: { id: detail.project.id },
      resultSnapshot: { calculationRun: { ...detail.result.calculationRun } },
      resultVersion: { resultHash: detail.result.calculationRun.resultHash, templateSnapshotId: detail.template.snapshotId },
    },
    persistence: { projectId: detail.project.id, artifactId: `${id}-artifact`, reportId: id },
  };
}

function editableAssessment(id) {
  const project = assessmentDetail(id);
  project.project.status = "scoring";
  project.project.readOnly = false;
  project.resultStale = true;
  project.dirty = true;
  return project;
}

function readyCalculation(marker) {
  return {
    ok: true,
    marker,
    summary: { statisticsReady: true, completionRate: 100, notScoredCount: 0, targetBelowCurrentCount: 0 },
    calculationRun: { inputHash: `${marker}-input`, resultHash: `${marker}-result` },
  };
}

{
  const harness = maturityHarness();
  harness.model.workspace = { template: assessmentDetail().template, dictionarySnapshot: { id: "dictionary" } };
  harness.model.createDraft = {
    name: "新项目", organization: "测试组织", industry: "测试行业", companySize: "中型", customerCharacteristics: "", constraints: "",
    owner: "负责人", plannedStartDate: "", plannedEndDate: "", assessors: "评估员", note: "", templateType: "base", templateLibraryId: "template",
  };
  harness.model.createOpen = true;
  harness.failNextWrites(2);
  harness.createProject();
  assert.equal(harness.model.createOpen, true, "failed project creation closed the wizard and implied success");
  assert.deepEqual(Object.keys(harness.model.details), [], "failed project creation remained in the live workspace");
  assert.equal(harness.model.toastTone, "error");

  harness.createProject();
  assert.equal(harness.model.createOpen, false, "successful project creation did not close the wizard");
  assert.equal(Object.keys(harness.model.details).length, 1);
  assert.equal(harness.model.toastTone, "success");
}

{
  const harness = maturityHarness();
  harness.model.workspace = { template: assessmentDetail().template };
  harness.model.createDraft = {
    name: "草稿", organization: "测试组织", industry: "测试行业", companySize: "中型", customerCharacteristics: "", constraints: "",
    owner: "负责人", plannedStartDate: "", plannedEndDate: "", assessors: "", note: "", templateType: "", templateLibraryId: "",
  };
  harness.model.createOpen = true;
  harness.failNextWrites(2);
  harness.saveCreateDraft();
  assert.equal(harness.model.createOpen, true, "failed draft save closed the wizard and implied success");
  assert.deepEqual(Object.keys(harness.model.details), [], "failed draft save remained in the live workspace");
  assert.equal(harness.model.toastTone, "error");

  harness.saveCreateDraft();
  assert.equal(harness.model.createOpen, false);
  assert.equal(Object.keys(harness.model.details).length, 1);
  assert.equal(harness.model.toastTone, "success");
}

{
  const harness = maturityHarness();
  const project = editableAssessment("project-info-save");
  project.project.organization = "旧组织";
  project.project.industry = "旧行业";
  project.project.companySize = "小型";
  project.project.owner = "旧负责人";
  harness.model.details = { [project.project.id]: project };
  harness.model.projectInfoEditId = project.project.id;
  const values = {
    maturityProjectInfoName: project.project.name,
    maturityProjectInfoOrganization: "新组织",
    maturityProjectInfoIndustry: "新行业",
    maturityProjectInfoCompanySize: "中型",
    maturityProjectInfoCharacteristics: "",
    maturityProjectInfoConstraints: "",
    maturityProjectInfoOwner: "新负责人",
    maturityProjectInfoStartDate: "",
    maturityProjectInfoEndDate: "",
    maturityProjectInfoAssessors: "",
    maturityProjectInfoNote: "",
  };
  harness.document.getElementById = (id) => ({ value: values[id] ?? "" });
  harness.failNextWrites(2);
  harness.saveProjectInfo(project);
  assert.equal(project.project.organization, "旧组织", "failed project-info save remained applied in memory");
  assert.equal(harness.model.projectInfoEditId, project.project.id, "failed project-info save closed the editor");
  assert.equal(harness.model.toastTone, "error");

  harness.saveProjectInfo(project);
  assert.equal(project.project.organization, "新组织");
  assert.equal(harness.model.projectInfoEditId, "");
  assert.equal(harness.model.toastTone, "success");
}

{
  const harness = maturityHarness();
  const project = editableAssessment("project-template-validation-race");
  project.template.type = "custom";
  const response = deferred();
  harness.model.details = { [project.project.id]: project };
  harness.window.sapdDataClient = { validateMaturityTemplate: () => response.promise };
  const validating = harness.validateTemplate(project);
  project.calculationRevision += 1;
  project.template.name = "用户随后修改的新模板";
  response.resolve({ data: { valid: true, snapshotId: "stale-snapshot" } });
  await validating;
  assert.equal(project.template.name, "用户随后修改的新模板");
  assert.notEqual(project.template.snapshotId, "stale-snapshot", "stale validation marked newer template content valid");
  assert.notEqual(project.template.status, "validated");
  assert.equal(harness.model.toastTone, "error");
}

{
  const harness = maturityHarness();
  const project = editableAssessment("project-template-validation-save");
  project.template.type = "custom";
  harness.model.details = { [project.project.id]: project };
  harness.window.sapdDataClient = { validateMaturityTemplate: async () => ({ data: { valid: true, snapshotId: "validated-snapshot" } }) };
  harness.failNextWrites(2);
  await harness.validateTemplate(project);
  assert.notEqual(project.template.status, "validated", "unsaved validation result remained active");
  assert.equal(harness.model.toastTone, "error");

  await harness.validateTemplate(project);
  assert.equal(project.template.status, "validated");
  assert.equal(harness.model.toastTone, "success");
}

{
  const harness = maturityHarness();
  const project = editableAssessment("project-completion-save");
  harness.model.details = { [project.project.id]: project };
  harness.window.sapdDataClient = { calculateMaturityAssessment: async ({ project: requestProject }) => ({ data: readyCalculation(requestProject.status === "completed" ? "final" : "validation") }) };
  harness.failNextWrites(2);
  await harness.completeAssessment(project);
  assert.equal(project.project.status, "scoring", "completion with failed final persistence remained locked in memory");
  assert.equal(project.project.readOnly, false);
  assert.equal(project.localSaveState, "error");
  assert.equal(harness.model.toastTone, "error");

  await harness.completeAssessment(project);
  assert.equal(project.project.status, "completed");
  assert.equal(project.project.readOnly, true);
  assert.equal(harness.model.toastTone, "success");
}

{
  const harness = maturityHarness();
  const project = editableAssessment("project-completion-race");
  const response = deferred();
  harness.model.details = { [project.project.id]: project };
  harness.window.sapdDataClient = { calculateMaturityAssessment: () => response.promise };
  const completing = harness.completeAssessment(project);
  const replacement = editableAssessment(project.project.id);
  replacement.project.name = "replacement";
  harness.model.details[project.project.id] = replacement;
  response.resolve({ data: readyCalculation("stale-completion") });
  await completing;
  assert.equal(replacement.project.status, "scoring");
  assert.equal(project.project.status, "scoring", "stale completion changed the detached project");
  assert.equal(harness.model.toastTone, "error");
}

{
  const harness = maturityHarness();
  const project = editableAssessment("project-score-api-failure");
  project.localSaveState = "saved";
  harness.model.details = { [project.project.id]: project };
  harness.window.sapdDataClient = { calculateMaturityAssessment: async () => { throw new Error("评分服务不可用"); } };
  await harness.calculateDetail(project);
  assert.equal(project.localSaveState, "saved", "score API failure was mislabeled as local persistence failure");
  assert.equal(harness.model.toastTone, "error");
  assert.match(harness.model.toast, /评分服务不可用/);
}

{
  const harness = maturityHarness();
  const project = assessmentDetail("project-unlock-save");
  harness.model.details = { [project.project.id]: project };
  harness.failNextWrites(2);
  harness.unlockAssessmentForEditing(project);
  assert.equal(project.project.status, "completed", "unsaved unlock remained active in memory");
  assert.equal(project.project.readOnly, true);
  assert.equal(harness.model.toastTone, "error");

  harness.unlockAssessmentForEditing(project);
  assert.equal(project.project.status, "score_review");
  assert.equal(project.project.readOnly, false);
  assert.equal(harness.model.toastTone, "success");
}

{
  const harness = maturityHarness();
  const project = assessmentDetail("project-report-no-write-amplification");
  project.report = fullReport("complete-report", project);
  harness.model.details = { [project.project.id]: project };
  const writesBefore = harness.storageWriteCount();
  await harness.restorePersistedReports();
  await harness.restorePersistedReports();
  assert.equal(harness.storageWriteCount(), writesBefore, "unchanged completed report restore rewrote the full local workspace");
}

{
  const harness = maturityHarness();
  let dragCancelled = 0;
  harness.model.templateMouseDrag = { cancel() { dragCancelled += 1; } };
  const project = editableAssessment("project-active-resize");
  harness.model.details = { [project.project.id]: project };
  harness.model.route = `/workbench/maturity/${project.project.id}`;
  harness.document.documentElement = { dataset: {} };
  harness.document.body = { classList: { add() {}, remove() {} } };
  const shell = {
    classList: { contains() { return false; } },
    getBoundingClientRect() { return { width: 1200 }; },
    querySelector() { return null; },
    style: { setProperty() {} },
  };
  const handle = { closest(selector) { return selector === ".maturity-v4-scoring-shell" ? shell : null; } };
  harness.beginScoreDirectoryResize({
    button: 0,
    clientX: 300,
    preventDefault() {},
    target: { closest(selector) { return selector === "[data-maturity-score-directory-resizer]" ? handle : null; } },
  });
  assert.equal(harness.documentListeners.has("pointermove:false"), true, "directory resize did not register its active document listener");
  harness.unmount();
  harness.unmount();
  assert.equal(dragCancelled, 1, "active template drag was not cancelled exactly once on unmount");
  assert.equal(harness.documentListeners.has("pointermove:false"), false, "active directory resize listener survived unmount");
  assert.equal(harness.documentListeners.has("pointerup:false"), false, "active directory resize completion listener survived unmount");
  assert.equal(harness.documentListeners.has("pointercancel:false"), false, "active directory resize cancellation listener survived unmount");
}

for (const invalidStore of ["[]", "1", '{"version":"2.1","projects":[]}']) {
  const harness = maturityHarness();
  const key = "sapd-wiki-maturity-controlled-demo-v2.1";
  harness.storage.set(key, invalidStore);
  const incoming = detail("project-invalid-store");
  assert.equal(harness.persistDetail(incoming), false, `invalid store structure was accepted: ${invalidStore}`);
  assert.equal(incoming.localSaveState, "error");
  assert.equal(harness.storage.get(key), invalidStore, "invalid store structure was overwritten");
}

{
  const harness = maturityHarness();
  const detail = {
    project: { id: "project-template-copy", name: "模板复制项目" },
    template: {
      id: "template-source",
      snapshotId: "snapshot-source",
      name: "待复制模板",
      type: "custom",
      categories: [],
      capabilities: [],
      focuses: [],
      services: [],
      scoreItems: [],
    },
  };
  harness.failNextWrites(1);
  harness.copyTemplateSubtree(detail, { type: "TEMPLATE" });
  assert.equal(harness.model.toastTone, "error", "failed template copy reported success");
  assert.equal(harness.storage.has("sapd-wiki-maturity-controlled-demo-v2.1"), false);

  harness.copyTemplateSubtree(detail, { type: "TEMPLATE" });
  const stored = JSON.parse(harness.storage.get("sapd-wiki-maturity-controlled-demo-v2.1"));
  assert.equal(harness.model.toastTone, "success", "template copy did not recover after storage became writable");
  assert.equal(stored.templateLibrary.length, 1);
}

{
  const harness = maturityHarness();
  harness.model.workspace = { template: assessmentDetail().template, dictionarySnapshot: { id: "dictionary" } };
  harness.model.navigate = () => assert.fail("failed template draft must not navigate");
  harness.failNextWrites(2);
  const created = harness.createStandaloneTemplateWorkspace();
  assert.equal(created, false);
  assert.deepEqual(Object.keys(harness.model.details), [], "failed template draft remained in memory");
  assert.equal(harness.model.toastTone, "error", "failed template draft reported success");
}

{
  const harness = maturityHarness();
  const project = assessmentDetail("project-background-calc");
  project.project.status = "scoring";
  project.resultStale = true;
  project.dirty = true;
  const response = deferred();
  harness.window.sapdDataClient = { calculateMaturityAssessment: () => response.promise };
  harness.model.details = { [project.project.id]: project };
  const refresh = harness.refreshHydratedAssessments();
  project.calculationRevision += 1;
  project.result = { ...project.result, marker: "newer-local-result" };
  response.resolve({ data: { ...project.result, marker: "old-background-result", ok: true } });
  await refresh;
  assert.equal(project.result.marker, "newer-local-result", "stale background calculation replaced a newer edit");
  assert.equal(project.resultStale, true);
  assert.equal(project.dirty, true);
}

{
  const harness = maturityHarness();
  const project = assessmentDetail("project-background-completion-race");
  project.project.status = "scoring";
  project.project.readOnly = false;
  project.resultStale = true;
  project.dirty = true;
  const requests = [];
  harness.window.sapdDataClient = {
    calculateMaturityAssessment() {
      const request = deferred();
      requests.push(request);
      return request.promise;
    },
  };
  harness.model.details = { [project.project.id]: project };
  const refresh = harness.refreshHydratedAssessments();
  assert.equal(requests.length, 1, "background hydration calculation did not start");
  const completing = harness.completeAssessment(project);
  assert.equal(requests.length, 2, "completion validation calculation did not start");
  const readyResult = (marker) => ({
    ok: true,
    marker,
    summary: { statisticsReady: true, completionRate: 100, notScoredCount: 0, targetBelowCurrentCount: 0 },
    calculationRun: { inputHash: `${marker}-input`, resultHash: `${marker}-result` },
  });
  requests[1].resolve({ data: readyResult("completion-validation") });
  while (requests.length < 3) await Promise.resolve();
  requests[2].resolve({ data: readyResult("completion-final") });
  await completing;
  assert.equal(project.result.marker, "completion-final");
  assert.equal(project.project.status, "completed");
  requests[0].resolve({ data: readyResult("old-background") });
  await refresh;
  assert.equal(project.result.marker, "completion-final", "old hydration result replaced the completed assessment result");
  assert.equal(project.project.status, "completed");
  assert.equal(project.project.readOnly, true);
}

{
  const harness = maturityHarness();
  const project = assessmentDetail("project-background-error-race");
  project.project.status = "scoring";
  project.project.readOnly = false;
  project.resultStale = true;
  project.dirty = true;
  const response = deferred();
  harness.window.sapdDataClient = { calculateMaturityAssessment: () => response.promise };
  harness.model.details = { [project.project.id]: project };
  const refresh = harness.refreshHydratedAssessments();
  project.calculationRevision += 1;
  project.result = { ...project.result, marker: "newer-success" };
  project.resultStale = false;
  project.dirty = false;
  delete project.calculationRefreshError;
  response.reject(new Error("old background failure"));
  await refresh;
  assert.equal(project.result.marker, "newer-success");
  assert.equal(project.resultStale, false, "old hydration failure marked a newer result stale");
  assert.equal(project.calculationRefreshError, undefined, "old hydration failure overwrote the current refresh state");
}

{
  const harness = maturityHarness();
  const project = assessmentDetail("project-report-restore");
  const response = deferred();
  let restoreRequest = null;
  harness.window.sapdDataClient = { getMaturityReportArtifact: (request) => { restoreRequest = request; return response.promise; } };
  harness.model.details = { [project.project.id]: project };
  const restore = harness.restorePersistedReports();
  assert.equal(restoreRequest.artifactId, "", "receipt-only restore pinned the stale artifact instead of reconciling the latest matching artifact");
  assert.equal(restoreRequest.reportId, "", "receipt-only restore pinned the stale report id instead of reconciling the latest matching artifact");
  assert.equal(restoreRequest.inputHash, "input-hash");
  assert.equal(restoreRequest.resultHash, "result-hash");
  const newerReport = fullReport("newly-generated", project);
  project.report = newerReport;
  response.resolve({ data: fullReport("old-restored", project) });
  await restore;
  assert.equal(project.report.id, "newly-generated", "old artifact restore replaced a newly generated report");
}

{
  const harness = maturityHarness();
  const project = assessmentDetail("project-template-import-save");
  const originalSnapshot = project.template.snapshotId;
  harness.model.details = { [project.project.id]: project };
  harness.model.workspace = { template: project.template };
  harness.window.sapdDataClient = {
    importMaturityTemplateExchange: async () => ({ data: { ok: true, template: { ...project.template, id: "imported", snapshotId: "imported-snapshot", type: "custom" }, validation: {}, batch: {}, rowErrors: [] } }),
  };
  harness.failNextWrites(2);
  await harness.importTemplate(project, { name: "template.xlsx", type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  assert.equal(project.template.snapshotId, originalSnapshot, "failed project template import remained applied in memory");
  assert.equal(project.localSaveState, "error");
  assert.equal(harness.model.toastTone, "error");
}

{
  const harness = maturityHarness();
  const project = assessmentDetail("project-template-import-race");
  const response = deferred();
  let requested = false;
  harness.model.details = { [project.project.id]: project };
  harness.model.workspace = { template: project.template };
  harness.window.sapdDataClient = { importMaturityTemplateExchange: () => { requested = true; return response.promise; } };
  const importing = harness.importTemplate(project, { name: "template.xlsx" });
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(requested, true);
  project.calculationRevision += 1;
  project.template.snapshotId = "newer-template-snapshot";
  response.resolve({ data: { ok: true, template: { ...project.template, snapshotId: "old-imported-snapshot" }, validation: {}, batch: {}, rowErrors: [] } });
  await importing;
  assert.equal(project.template.snapshotId, "newer-template-snapshot", "stale template import replaced a newer edit");
  assert.equal(harness.model.toastTone, "error");
}

{
  const harness = maturityHarness();
  const project = assessmentDetail("project-score-import-race");
  const response = deferred();
  let requested = false;
  harness.model.details = { [project.project.id]: project };
  harness.window.sapdDataClient = { importMaturityScoreExchange: () => { requested = true; return response.promise; } };
  const importing = harness.importScoreExchange(project, { name: "scores.xlsx" });
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(requested, true);
  project.calculationRevision += 1;
  project.scoreEntries = [{ scoreItemId: "newer-score" }];
  response.resolve({ data: { ok: true, scoreEntries: [{ scoreItemId: "old-imported-score" }], batch: { successCount: 1, failureCount: 0 }, rowErrors: [] } });
  await importing;
  assert.equal(project.scoreEntries[0].scoreItemId, "newer-score", "stale score import replaced a newer edit");
  assert.equal(harness.model.toastTone, "error");
}

{
  const harness = maturityHarness();
  const project = assessmentDetail("project-score-import-save");
  project.scoreEntries = [{ scoreItemId: "original-score" }];
  harness.model.details = { [project.project.id]: project };
  harness.window.sapdDataClient = {
    importMaturityScoreExchange: async () => ({ data: { ok: true, scoreEntries: [{ scoreItemId: "imported-score" }], batch: { successCount: 1, failureCount: 0 }, rowErrors: [] } }),
  };
  harness.failNextWrites(2);
  await harness.importScoreExchange(project, { name: "scores.xlsx" });
  assert.equal(project.scoreEntries[0].scoreItemId, "original-score", "failed score import remained applied in memory");
  assert.equal(project.localSaveState, "error");
  assert.equal(harness.model.toastTone, "error", "failed score import reported success");
}

{
  const harness = maturityHarness();
  const project = assessmentDetail("project-report-generation-race");
  const response = deferred();
  harness.model.details = { [project.project.id]: project };
  harness.window.sapdDataClient = { createMaturityReport: () => response.promise };
  const generating = harness.generateReport(project);
  project.reportNarrative.executiveSummary = "newer narrative";
  project.reportNarrativeDirty = true;
  response.resolve({ data: fullReport("old-generated", project) });
  await generating;
  assert.notEqual(project.report.id, "old-generated", "report generated from stale narrative replaced the current receipt");
  assert.equal(project.reportNarrativeDirty, true);
  assert.equal(harness.model.toastTone, "error");
}

{
  const harness = maturityHarness();
  const project = assessmentDetail("project-report-unlock-race");
  const response = deferred();
  harness.model.details = { [project.project.id]: project };
  harness.window.sapdDataClient = { createMaturityReport: () => response.promise };
  const generating = harness.generateReport(project);
  harness.unlockAssessmentForEditing(project);
  response.resolve({ data: fullReport("stale-after-unlock", project) });
  await generating;
  assert.equal(project.project.status, "score_review", "stale report response relocked an unlocked assessment");
  assert.equal(project.project.readOnly, false, "stale report response restored read-only state");
  assert.equal(project.report, null, "stale report response restored an invalidated report");
  assert.equal(harness.model.toastTone, "error");
}

{
  const harness = maturityHarness();
  const project = assessmentDetail("project-report-save");
  harness.model.details = { [project.project.id]: project };
  let createCalls = 0;
  harness.window.sapdDataClient = {
    createMaturityReport: async () => {
      createCalls += 1;
      return { data: fullReport("unsaved-generated", project) };
    },
  };
  harness.failNextWrites(2);
  await harness.generateReport(project);
  assert.equal(createCalls, 1);
  assert.equal(project.project.status, "reported", "backend-persisted report was not retained in the live lifecycle");
  assert.equal(project.project.readOnly, true);
  assert.equal(project.report.id, "unsaved-generated", "backend-persisted report receipt was discarded after local storage failure");
  assert.equal(project.localSaveState, "error");
  assert.equal(harness.model.toastTone, "error", "local persistence failure was not surfaced");
  assert.match(harness.model.toast, /已在后端生成/);
  assert.match(harness.model.toast, /本地工作区保存失败/);
  assert.doesNotMatch(harness.model.toast, /报告生成失败/);
  assert.equal(project.reportLocalPersistencePending, true);

  harness.failNextWrites(2);
  await harness.generateReport(project);
  assert.equal(createCalls, 1, "local report persistence retry created a duplicate backend artifact");
  assert.equal(project.localSaveState, "error");
  assert.match(harness.model.toast, /仍保存失败/);
  assert.equal(project.reportLocalPersistencePending, true);

  await harness.generateReport(project);
  assert.equal(createCalls, 1, "successful local report persistence retry called the backend again");
  const stored = JSON.parse(harness.storage.get("sapd-wiki-maturity-controlled-demo-v2.1"));
  assert.equal(stored.projects[project.project.id].report.id, "unsaved-generated", "in-memory report receipt could not be persisted after storage recovered");
  assert.equal(project.localSaveState, "saved");
  assert.equal(project.reportLocalPersistencePending, false);
  assert.equal(harness.model.toastTone, "success");
  assert.match(harness.model.toast, /本地工作区已恢复保存/);
}

const importTemplateSource = component.slice(
  component.indexOf("async function importTemplateToLibrary("),
  component.indexOf("async function importTemplate(detail"),
);
assert(
  importTemplateSource.includes('if (!writeStore(store)) throw new Error("模板导入结果未保存，请检查本地存储空间后重试")'),
  "template-library import still ignores local persistence failure",
);

{
  const harness = maturityHarness();
  const existing = detail("project-kept");
  harness.persistDetail(existing);
  const original = harness.storage.get("sapd-wiki-maturity-controlled-demo-v2.1");
  const incoming = detail("project-new");
  harness.failNextReads(1);
  assert.equal(harness.persistDetail(incoming), false, "read failure must fail closed instead of replacing the local store");
  assert.equal(incoming.localSaveState, "error");
  assert.equal(harness.storage.get("sapd-wiki-maturity-controlled-demo-v2.1"), original, "read failure changed the existing local store");
  assert.deepEqual(Object.keys(JSON.parse(original).projects), ["project-kept"]);
}

function detail(id, updatedAt = "2026-08-04 12:00") {
  return {
    project: { id, name: id, updatedAt },
    scoreEntries: [],
    reportNarrative: {},
    reportV2Conclusions: {},
    improvementRoadmap: [],
  };
}

{
  const harness = maturityHarness();
  const first = detail("project-a");
  const second = detail("project-b");
  harness.scheduleDetailPersistence(first);
  harness.scheduleDetailPersistence(second);
  harness.runTimers();
  const persisted = JSON.parse(harness.storage.get("sapd-wiki-maturity-controlled-demo-v2.1"));
  assert.deepEqual(Object.keys(persisted.projects).sort(), ["project-a", "project-b"], "cross-project debounce lost a pending project");

  harness.failNextWrites(2);
  harness.scheduleDetailPersistence(first);
  harness.runTimers();
  assert.equal(first.localSaveState, "error", "failed local persistence was not surfaced");
  harness.scheduleDetailPersistence(first);
  harness.runTimers();
  assert.equal(first.localSaveState, "saved", "successful retry did not clear stale save failure");
  assert.equal(JSON.parse(harness.storage.get("sapd-wiki-maturity-controlled-demo-v2.1")).projects["project-a"].localSaveState, "saved");
}

{
  const harness = maturityHarness();
  harness.model.loaded = true;
  harness.model.details = {
    "demo-project-001": detail("demo-project-001", "2026-08-04 13:00"),
    "demo-project:local": detail("demo-project:local", "2026-08-04 12:30"),
    "project-real": detail("project-real", "2026-08-04 12:00"),
  };
  const snapshot = harness.dashboardSnapshot(3);
  assert.equal(JSON.stringify(snapshot.projects.map((item) => item.id)), JSON.stringify(["demo-project:local", "project-real"]), "controlled demo leaked into the homepage snapshot");
}

{
  const harness = maturityHarness();
  const project = detail("project-summary-only");
  harness.persistDetail(project);
  harness.model.loaded = false;
  harness.storageReadKeys.length = 0;
  const snapshot = harness.dashboardSnapshot(3);
  assert.equal(JSON.stringify(snapshot.projects.map((item) => item.id)), JSON.stringify(["project-summary-only"]));
  assert.deepEqual(
    harness.storageReadKeys,
    ["sapd-wiki-maturity-dashboard-summary-v1"],
    "unloaded homepage parsed the full maturity workspace instead of the compact summary",
  );
}

for (const summaryValue of [null, "{broken"]) {
  const harness = maturityHarness();
  harness.storage.set(
    "sapd-wiki-maturity-controlled-demo-v2.1",
    JSON.stringify({ version: "2.1", projects: { "project-existing": detail("project-existing") } }),
  );
  if (summaryValue != null) harness.storage.set("sapd-wiki-maturity-dashboard-summary-v1", summaryValue);
  harness.storageReadKeys.length = 0;
  const snapshot = harness.dashboardSnapshot(3);
  assert.equal(snapshot.dataState, "summary_unavailable");
  assert.equal(snapshot.total, null);
  assert.equal(snapshot.projects.length, 0);
  assert.deepEqual(
    harness.storageReadKeys,
    ["sapd-wiki-maturity-dashboard-summary-v1"],
    "missing or invalid summary caused the homepage to parse the full maturity store",
  );
}

{
  const harness = maturityHarness();
  const storeKey = "sapd-wiki-maturity-controlled-demo-v2.1";
  const summaryKey = "sapd-wiki-maturity-dashboard-summary-v1";
  const originalStore = JSON.stringify({ version: "2.1", projects: { "project-local": detail("project-local") } });
  const originalSummary = JSON.stringify([{ id: "project-local", name: "project-local", resultReady: false }]);
  harness.storage.set(storeKey, originalStore);
  harness.storage.set(summaryKey, originalSummary);
  harness.model.details = { "project-visible": detail("project-visible") };
  harness.failNextReads(1);
  assert.throws(
    () => harness.hydrateWorkspace({ projectDetails: {}, template: null }),
    /本地成熟度工作区读取失败/,
    "hydrate treated a local-store read failure as an empty workspace",
  );
  assert.deepEqual(Object.keys(harness.model.details), ["project-visible"], "failed hydration replaced the current in-memory workspace");
  assert.equal(harness.storage.get(storeKey), originalStore, "failed hydration changed the full local maturity store");
  assert.equal(harness.storage.get(summaryKey), originalSummary, "failed hydration rewrote the dashboard summary as an empty workspace");
}

{
  const harness = maturityHarness();
  let focused = "";
  const first = { hidden: false, offsetParent: {}, focus() { focused = "first"; } };
  const last = { hidden: false, offsetParent: {}, focus() { focused = "last"; } };
  const modal = {
    querySelectorAll() { return [first, last]; },
    contains(active) { return active === first || active === last; },
  };
  harness.model.root = {
    querySelector() { return modal; },
    addEventListener() {},
  };
  harness.bindRoot(harness.model.root);
  const globalKeydown = harness.documentListeners.get("keydown:true");
  assert.equal(typeof globalKeydown, "function", "delete dialog key handler was not bound at document capture boundary");
  harness.document.activeElement = { outside: true };
  let prevented = false;
  let stopped = false;
  globalKeydown({ key: "Tab", shiftKey: false, preventDefault() { prevented = true; }, stopPropagation() { stopped = true; } });
  assert.equal(prevented, true);
  assert.equal(stopped, true);
  assert.equal(focused, "first", "focus outside the delete dialog was not recovered");

  harness.document.activeElement = { outside: true };
  focused = "";
  globalKeydown({ key: "Tab", shiftKey: true, preventDefault() {}, stopPropagation() {} });
  assert.equal(focused, "last", "Shift+Tab outside the dialog did not recover to the last control");
  harness.document.activeElement = first;
  focused = "";
  globalKeydown({ key: "Tab", shiftKey: true, preventDefault() {}, stopPropagation() {} });
  assert.equal(focused, "last", "Shift+Tab did not wrap from first to last");
  harness.document.activeElement = last;
  focused = "";
  globalKeydown({ key: "Tab", shiftKey: false, preventDefault() {}, stopPropagation() {} });
  assert.equal(focused, "first", "Tab did not wrap from last to first");

  const secondRoot = { querySelector() { return modal; }, addEventListener() {} };
  harness.bindRoot(secondRoot);
  assert.equal(harness.documentListenerCounts.get("keydown:true"), 1, "root replacement rebound the global delete-dialog listener");
  harness.model.root = secondRoot;
  harness.model.projectDeleteCandidateId = "project-delete";
  harness.model.projectDeleteStep = 2;
  harness.model.loading = true;
  harness.model.loaded = false;
  prevented = false;
  stopped = false;
  globalKeydown({ key: "Escape", preventDefault() { prevented = true; }, stopPropagation() { stopped = true; } });
  assert.equal(prevented, true);
  assert.equal(stopped, true);
  assert.equal(harness.model.projectDeleteCandidateId, "");
  assert.equal(harness.model.projectDeleteStep, 0);
}

{
  const harness = maturityHarness();
  const body = { inert: false, parentElement: null, children: [] };
  const shell = { inert: false, parentElement: body, children: [] };
  const preInert = { inert: true, parentElement: body, children: [] };
  const branch = { inert: false, parentElement: shell, children: [] };
  const sibling = { inert: false, parentElement: shell, children: [] };
  const layer = { inert: false, parentElement: branch, children: [] };
  branch.children = [layer];
  shell.children = [branch, sibling];
  body.children = [shell, preInert];
  harness.document.body = body;
  harness.applyDeleteModalInertBoundary(layer);
  assert.equal(sibling.inert, true);
  assert.equal(preInert.inert, true);
  harness.clearDeleteModalInertBoundary();
  assert.equal(sibling.inert, false, "dialog cleanup did not restore a sibling changed by this dialog");
  assert.equal(preInert.inert, true, "dialog cleanup cleared an element that was already inert");

  const stale = { inert: true };
  harness.model.deleteModalInertElements = [stale];
  harness.model.root = { scrollTop: 0, innerHTML: "", querySelector() { return null; } };
  harness.model.loading = true;
  harness.render();
  assert.equal(stale.inert, false, "loading render left the previous dialog boundary inert");
  assert.equal(harness.model.deleteModalInertElements.length, 0);
}

{
  const harness = maturityHarness();
  const body = { inert: false, parentElement: null, children: [] };
  const shell = { inert: false, parentElement: body, children: [] };
  const branch = { inert: false, parentElement: shell, children: [] };
  const sibling = { inert: false, parentElement: shell, children: [] };
  const layer = { inert: false, parentElement: branch, children: [] };
  branch.children = [layer];
  shell.children = [branch, sibling];
  body.children = [shell];
  harness.document.body = body;
  const rootListeners = new Set();
  const mountedRoot = {
    querySelector() { return null; },
    addEventListener(type, listener) { rootListeners.add(`${type}:${listener.name}`); },
    removeEventListener(type, listener) { rootListeners.delete(`${type}:${listener.name}`); },
  };
  harness.model.root = mountedRoot;
  harness.bindRoot(mountedRoot);
  assert(rootListeners.size > 0);
  harness.applyDeleteModalInertBoundary(layer);
  assert.equal(sibling.inert, true);
  assert.equal(typeof harness.unmount, "function", "maturity component does not expose lifecycle cleanup");
  harness.unmount();
  assert.equal(sibling.inert, false, "route unmount left a shell sibling inert");
  assert.equal(harness.model.root, null, "route unmount retained the detached root");
  assert.equal(rootListeners.size, 0, "route unmount retained root event handlers that would be rebound on remount");
  assert.equal(harness.documentListeners.has("keydown:true"), false, "route unmount retained the delete-dialog keyboard trap");
}

{
  const harness = maturityHarness();
  const owner = { scrollTop: 0, scrollLeft: 0 };
  const table = { scrollTop: 0, scrollLeft: 0 };
  const home = { scrollTop: 0, scrollLeft: 0 };
  const project = { scrollTop: 0, scrollLeft: 0 };
  const directory = { scrollTop: 0, scrollLeft: 0 };
  const panels = [{ scrollTop: 0, scrollLeft: 0 }];
  harness.model.root = {
    querySelector(selector) {
      return new Map([
        [".maturity-v1-score-table-scroll", table],
        [".maturity-v1-list-page", home],
        [".maturity-v1-project-page", project],
        [".maturity-v4-directory-tree", directory],
      ]).get(selector) || null;
    },
    querySelectorAll() { return panels; },
  };
  harness.restoreRenderPosition({
    owners: [{ node: owner, top: 11, left: 12 }],
    pageX: 13,
    pageY: 14,
    tableTop: 21,
    tableLeft: 22,
    homeTop: 31,
    homeLeft: 32,
    projectTop: 41,
    projectLeft: 42,
    directoryTop: 51,
    directoryLeft: 52,
    scorePanels: [{ index: 0, top: 61, left: 62 }],
    controlLocator: "",
  });
  harness.runTimers();
  assert.deepEqual([owner.scrollTop, owner.scrollLeft], [11, 12]);
  assert.deepEqual([table.scrollTop, table.scrollLeft], [21, 22]);
  assert.deepEqual([home.scrollTop, home.scrollLeft], [31, 32]);
  assert.deepEqual([project.scrollTop, project.scrollLeft], [41, 42]);
  assert.deepEqual([directory.scrollTop, directory.scrollLeft], [51, 52]);
  assert.deepEqual([panels[0].scrollTop, panels[0].scrollLeft], [61, 62]);
  assert.deepEqual([harness.window.scrollX, harness.window.scrollY], [13, 14]);
}

{
  const harness = maturityHarness();
  assert.equal(harness.displayTemplateName({ project: { templateType: "base" }, template: { type: "base" } }), "SAPD标准模板");
  assert.equal(harness.standardProjectTemplateName("甲方"), "甲方项目模板");
  assert.equal(harness.standardProjectTemplateName("甲方项目"), "甲方项目模板");
  assert.equal(harness.standardCustomTemplateName("专项模板 副本"), "专项副本模板");
  const title = { textContent: "" };
  const description = { textContent: "" };
  const slot = {
    hidden: false,
    dataset: {},
    innerHTML: "",
    replaceChildren() { this.innerHTML = ""; },
    querySelector() { return null; },
    addEventListener() {},
    append() {},
  };
  harness.document.getElementById = (id) => id === "maturityShellHeaderActions" ? slot : null;
  harness.document.querySelector = (selector) => selector === "#appPageTitle" ? title : selector === "#appPageHeader .page-header-copy > p" ? description : null;
  harness.model.root = { querySelector() { return null; } };
  harness.model.workspace = { template: { name: "SAPD标准能力成熟度模板" } };
  const project = detail("project-header");
  project.project.organization = "甲方";
  project.project.templateType = "base";
  project.project.status = "scoring";
  project.template = { type: "base" };
  for (const tab of ["overview", "scoring", "report"]) {
    harness.model.activeTab = tab;
    harness.syncMaturityShellHeader(project);
    assert.equal(title.textContent, "project-header", `project identity changed on ${tab}`);
  }
}


{
  const harness = maturityHarness();
  const first = assessmentDetail("same-client-project-a");
  const second = assessmentDetail("same-client-project-b");
  first.project.name = "蓝队一期评估";
  second.project.name = "蓝队二期评估";
  for (const project of [first, second]) {
    project.project.organization = "同一客户";
    project.project.templateType = "base";
    project.project.owner = "同一负责人";
  }
  harness.model.workspace = { template: first.template };
  harness.model.details = { [first.project.id]: first, [second.project.id]: second };
  harness.model.listStatus = "all";
  let html = harness.renderProjectList();
  assert.match(html, /蓝队一期评估/, "project name is not visible in the project list");
  assert.match(html, /蓝队二期评估/, "same-client projects cannot be distinguished by name");
  harness.model.listSearch = "二期";
  html = harness.renderProjectList();
  assert.match(html, /蓝队二期评估/, "project name is not searchable");
  assert.doesNotMatch(html, /蓝队一期评估/, "project-name search did not isolate the matching project");
  assert.match(html, /搜索项目、客户、负责人/, "project search affordance does not describe project-name search");
}

async function verifyUserExportTokenRetry() {
  const dataClientSource = readFileSync(path.join(root, "frontend/capability-browser/dataClient.js"), "utf8");
  const requests = [];
  let healthCount = 0;
  const jsonResponse = (status, payload) => ({
    ok: status >= 200 && status < 300,
    status,
    headers: { get(name) { return name.toLowerCase() === "content-type" ? "application/json" : ""; } },
    async json() { return payload; },
  });
  const fetch = async (url, options = {}) => {
    requests.push({ url: String(url), headers: { ...(options.headers || {}) } });
    if (String(url).endsWith("/api/v1/health")) {
      healthCount += 1;
      return jsonResponse(200, { data: { auth: { writes_require_token: true, header: "X-SAPD-Session-Token", session_token: healthCount === 1 ? "old-token" : "new-token" }, state: { bundle_root: "/tmp/runtime" } } });
    }
    if (requests.filter((item) => item.url.includes("/api/v1/user/notes/export")).length === 1) return jsonResponse(403, { error: "expired" });
    return jsonResponse(200, { data: { ok: true, data_state: "ready", note_count: 0 } });
  };
  const window = { location: { protocol: "http:" }, SAPD_API_BASE: "", fetch };
  vm.runInNewContext(dataClientSource, {
    window,
    fetch,
    console,
    URLSearchParams,
    AbortController,
    Headers,
    Blob,
    Date,
    setTimeout,
    clearTimeout,
  }, { filename: "dataClient.js" });
  const result = await window.sapdDataClient.exportUserNotes({ save: true });
  assert.equal(result.ok, true);
  const exportRequests = requests.filter((item) => item.url.includes("/api/v1/user/notes/export"));
  assert.equal(exportRequests.length, 2, "configured export must retry exactly once after authorization failure");
  assert.equal(exportRequests[0].headers["X-SAPD-Session-Token"], "old-token");
  assert.equal(exportRequests[1].headers["X-SAPD-Session-Token"], "new-token");
}

await verifyUserExportTokenRetry();

async function verifyApiFailureIsolation() {
  const dataClientSource = readFileSync(path.join(root, "frontend/capability-browser/dataClient.js"), "utf8");
  const requests = [];
  const jsonResponse = (status, payload) => ({
    ok: status >= 200 && status < 300,
    status,
    headers: { get(name) { return name.toLowerCase() === "content-type" ? "application/json" : ""; } },
    async json() { return payload; },
  });
  const fetch = async (url) => {
    requests.push(String(url));
    if (String(url).endsWith("/api/v1/dashboard/knowledge-summary")) return jsonResponse(500, { error: "temporary dashboard failure" });
    if (String(url).endsWith("/api/v1/maturity/workspace")) return jsonResponse(200, { data: { dataState: "ready", projects: [{ id: "project-ready" }] } });
    return jsonResponse(404, { error: "not found" });
  };
  const window = { location: { protocol: "http:" }, SAPD_API_BASE: "", fetch };
  vm.runInNewContext(dataClientSource, {
    window,
    fetch,
    console,
    URLSearchParams,
    AbortController,
    Headers,
    Blob,
    Date,
    setTimeout,
    clearTimeout,
  }, { filename: "dataClient.js" });
  await window.sapdDataClient.getDashboardKnowledgeSummary();
  const maturity = await window.sapdDataClient.getMaturityWorkspace();
  assert.equal(maturity.data.dataState, "ready", "one endpoint failure blocked an unrelated API read");
  assert.equal(requests.filter((url) => url.endsWith("/api/v1/maturity/workspace")).length, 1);
}

await verifyApiFailureIsolation();

async function verifyDynamicApiFailureBackoffIsBounded() {
  const dataClientSource = readFileSync(path.join(root, "frontend/capability-browser/dataClient.js"), "utf8");
  const marker = "  window.sapdDataClient = dataClient;";
  assert(dataClientSource.includes(marker), "data client test harness injection point missing");
  const instrumented = dataClientSource.replace(
    marker,
    `  window.__apiFailureBackoff = apiFailureBackoff;\n${marker}`,
  );
  const requests = [];
  const fetch = async (url) => {
    requests.push(String(url));
    return {
      ok: false,
      status: 500,
      headers: { get() { return "application/json"; } },
      async json() { return { error: "temporary failure" }; },
    };
  };
  const window = { location: { protocol: "http:" }, SAPD_API_BASE: "", fetch };
  vm.runInNewContext(instrumented, {
    window,
    fetch,
    console,
    URLSearchParams,
    AbortController,
    Headers,
    Blob,
    Date,
    setTimeout,
    clearTimeout,
  }, { filename: "dataClient.js" });
  for (let index = 0; index < 100; index += 1) {
    await window.sapdDataClient.getSearchIndex({ q: `dynamic-query-${index}` });
  }
  assert.equal(
    requests.filter((url) => url.includes("/api/v1/search-index?")).length,
    100,
    "one failed query variant blocked a different request to the same endpoint",
  );
  assert.equal(window.__apiFailureBackoff.size, 64, "dynamic query failures grew the backoff cache beyond its fixed bound");
}

await verifyDynamicApiFailureBackoffIsBounded();

async function verifyConcurrentTokenRefresh() {
  const dataClientSource = readFileSync(path.join(root, "frontend/capability-browser/dataClient.js"), "utf8");
  const requests = [];
  let healthCount = 0;
  let oldExportCount = 0;
  let releaseOldExports;
  const oldExportBarrier = new Promise((resolve) => { releaseOldExports = resolve; });
  const jsonResponse = (status, payload) => ({
    ok: status >= 200 && status < 300,
    status,
    headers: { get(name) { return name.toLowerCase() === "content-type" ? "application/json" : ""; } },
    async json() { return payload; },
  });
  const fetch = async (url, options = {}) => {
    const headers = { ...(options.headers || {}) };
    requests.push({ url: String(url), headers });
    if (String(url).endsWith("/api/v1/health")) {
      healthCount += 1;
      const token = healthCount === 1 ? "old-token" : "new-token";
      return jsonResponse(200, { data: { auth: { writes_require_token: true, header: "X-SAPD-Session-Token", session_token: token }, state: { bundle_root: "/tmp/runtime" } } });
    }
    if (String(url).includes("/api/v1/user/notes/export") && headers["X-SAPD-Session-Token"] === "old-token") {
      oldExportCount += 1;
      if (oldExportCount === 2) releaseOldExports();
      await oldExportBarrier;
      return jsonResponse(403, { error: "expired" });
    }
    return jsonResponse(200, { data: { ok: true, data_state: "ready", note_count: 0 } });
  };
  const window = { location: { protocol: "http:" }, SAPD_API_BASE: "", fetch };
  vm.runInNewContext(dataClientSource, {
    window,
    fetch,
    console,
    URLSearchParams,
    AbortController,
    Headers,
    Blob,
    Date,
    setTimeout,
    clearTimeout,
  }, { filename: "dataClient.js" });
  const results = await Promise.all([
    window.sapdDataClient.exportUserNotes({ save: true }),
    window.sapdDataClient.exportUserNotes({ save: true }),
  ]);
  assert(results.every((result) => result.ok === true));
  assert.equal(healthCount, 2, "concurrent authorization failures must share one token refresh");
  const exports = requests.filter((item) => item.url.includes("/api/v1/user/notes/export"));
  assert.equal(exports.length, 4);
  assert.equal(exports.filter((item) => item.headers["X-SAPD-Session-Token"] === "new-token").length, 2);
}

await verifyConcurrentTokenRefresh();

console.log("result=pass checks=43");
