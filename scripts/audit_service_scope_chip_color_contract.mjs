#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

const ROOT = process.cwd();
const SCOPE_CODES = ["I-AP", "I-DI", "I-NT", "I-US", "I-OS", "I-HD", "I-PE"];
const CACHE_TOKEN = "service-scope-chip-color-20260709-3";

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8");
}

function text(value) {
  return value == null ? "" : String(value).trim();
}

function escapeHtml(value) {
  return text(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function codeTitleOf(item, empty = "") {
  if (!item || typeof item !== "object") return empty;
  const code = text(item.code || item.objectCode || item.serviceCode || item.id);
  const title = text(item.title || item.objectName || item.name);
  return [code, title].filter(Boolean).join(" ") || empty;
}

function titleOf(item, empty = "") {
  if (!item || typeof item !== "object") return empty;
  return text(item.title || item.objectName || item.name || item.code || item.objectCode || item.id) || empty;
}

function check(id, ok, message, detail = undefined) {
  return { id, ok: Boolean(ok), message, ...(detail === undefined ? {} : { detail }) };
}

function evaluateDisplayHelpers(source) {
  const context = { window: {} };
  vm.createContext(context);
  vm.runInContext(source, context, { filename: "displayLabels.js" });
  return context.window.sapdDisplay;
}

function includesAll(source, values) {
  return values.every((value) => source.includes(value));
}

function serviceScopeSelector(code) {
  return `html body [data-service-scope="${code}"][data-scope][class]`;
}

function scopePaletteSelector(code) {
  return `html body .sapd-pill.pill--scope[data-scope-palette="${code}"][class]`;
}

const stylesCss = read("frontend/capability-browser/styles.css");
const indexHtml = read("frontend/capability-browser/index.html");
const displayLabelsJs = read("frontend/capability-browser/displayLabels.js");
const appJs = read("frontend/capability-browser/app.js");
const focusScopeServiceMatrixJs = read("frontend/capability-browser/components/FocusScopeServiceMatrix.js");
const applicationSecurityLifecycleJs = read("frontend/capability-browser/components/ApplicationSecurityLifecycle.js");
const environmentLocalRelationMapJs = read("frontend/capability-browser/components/EnvironmentLocalRelationMap.js");
const environmentBasemapViewerJs = read("frontend/capability-browser/components/EnvironmentBasemapViewer.js");
const environmentBasemapNodeDetails = JSON.parse(read("frontend/capability-browser/generated/environmentBasemap.node-details.json"));
const technicalMeasureMaintenanceTableJs = read("frontend/capability-browser/components/TechnicalMeasureMaintenanceTable.js");
const detailInspectorJs = read("frontend/capability-browser/components/DetailInspector.js");

function environmentBasemapDetails() {
  return Object.values(environmentBasemapNodeDetails.nodeDetailsByMxId || {});
}

function scopeGroupServices(detail) {
  return [...utils.list(detail?.directScopeGroups), ...utils.list(detail?.inheritedScopeGroups), ...utils.list(detail?.scopeMappings)]
    .flatMap((group) => utils.list(group?.services));
}

const display = evaluateDisplayHelpers(displayLabelsJs);
const utils = {
  escapeHtml,
  text,
  codeTitleOf,
  titleOf,
  list(value) {
    if (Array.isArray(value)) return value;
    if (value == null) return [];
    return [value];
  },
};
const objectServiceChip = display.relationChip(
  utils,
  { objectKind: "安全技术服务", code: "I-NT&T-PD.AC-01", title: "网络访问控制" },
  { showKind: true },
);
const stringServiceChip = display.relationChipList(utils, ["I-AP&T-AS.AD-02 网络冗余"], {});
const scopeOnlyChip = display.relationChip(utils, { type: "scope_type", code: "I-NT", title: "网络" }, { showKind: true });
const managementServiceChip = display.relationChip(utils, { objectKind: "安全技术服务", code: "M-PM.PR-00", title: "管理服务" }, {});
const focusScopeMatrixContext = { window: { sapdComponents: { utils }, sapdDisplay: display } };
vm.createContext(focusScopeMatrixContext);
vm.runInContext(focusScopeServiceMatrixJs, focusScopeMatrixContext, { filename: "FocusScopeServiceMatrix.js" });
const focusScopeMatrixHtml = focusScopeMatrixContext.window.sapdComponents.FocusScopeServiceMatrix.render({
  summary: "scope-color-audit",
  rows: [
    {
      focus: { id: "focus-audit-di" },
      scope: { code: "I-DI", title: "数据与信息" },
      services: [{ objectKind: "安全技术服务", code: "I-DI&T-AS.AD-01", title: "数据分库分表" }],
      modules: [],
    },
    {
      focus: { id: "focus-audit-hd" },
      scope: { code: "I-HD", title: "硬件" },
      services: [{ objectKind: "安全技术服务", code: "I-HD&T-AS.AD-01", title: "计算与存储分离" }],
      modules: [],
    },
    {
      focus: { id: "focus-audit-nt" },
      scope: { code: "I-NT", title: "网络" },
      services: [{ objectKind: "安全技术服务", code: "I-NT&T-PD.AC-01", title: "网络访问控制" }],
      modules: [],
    },
  ],
});
const applicationFrontendDetail = environmentBasemapDetails().find((detail) =>
  utils.list(detail?.contextPath).join(" / ") === "传统数据中心 / 应用及数据 / 应用前端",
);
const applicationFrontendServices = scopeGroupServices(applicationFrontendDetail);

const checks = [
  check(
    "display_helper_exports_service_scope_contract",
    ["serviceScopeCode", "serviceScopeAttrs", "inferredKindKey"].every((name) => typeof display[name] === "function"),
    "Shared display helper must expose service scope detection and kind inference.",
  ),
  check(
    "display_helper_detects_object_service_scope",
    objectServiceChip.includes("service-chip") &&
      objectServiceChip.includes('data-scope="I-NT"') &&
      objectServiceChip.includes('data-service-scope="I-NT"'),
    "Object-shaped security technical service chips must carry the scope code used by global CSS.",
    objectServiceChip,
  ),
  check(
    "display_helper_detects_string_service_scope",
    stringServiceChip.includes("service-chip") && stringServiceChip.includes('data-scope="I-AP"'),
    "String service values such as I-AP&T-* must still be inferred as service chips.",
    stringServiceChip,
  ),
  check(
    "scope_object_is_not_colored_as_service",
    !scopeOnlyChip.includes("service-chip") && !scopeOnlyChip.includes("data-scope="),
    "Scope objects must not be misclassified as service chips just because their code is I-XX.",
    scopeOnlyChip,
  ),
  check(
    "management_service_keeps_service_style_without_information_scope",
    managementServiceChip.includes("service-chip") && !managementServiceChip.includes("data-scope="),
    "Management service chips may keep service styling, but must not borrow an information-environment scope color.",
    managementServiceChip,
  ),
  check(
    "global_scope_color_variables_cover_all_codes",
    includesAll(stylesCss, SCOPE_CODES.map((code) => `--sapd-scope-${code.slice(2).toLowerCase()}:`)) &&
      stylesCss.includes("--sapd-scope-default:"),
    "Global CSS variables must define every information service scope color.",
  ),
  check(
    "global_service_scope_attrs_override_shared_chip_variables",
    stylesCss.includes("html body [data-service-scope][data-scope][class]") &&
      stylesCss.includes("--sapd-service-border: var(--sapd-service-scope-color);") &&
      stylesCss.includes("--sapd-service-bg:") &&
      stylesCss.includes("--sapd-service-text: var(--sapd-service-scope-color);") &&
      SCOPE_CODES.every((code) => stylesCss.includes(serviceScopeSelector(code))) &&
      SCOPE_CODES.every((code) => !stylesCss.includes(`\n[data-service-scope="${code}"]`)),
    "Service scope coloring must use per-code selectors that are at least as specific as the default data-service-scope rule.",
  ),
  check(
    "focus_scope_matrix_renders_mixed_service_scope_attrs",
    ["I-DI", "I-HD", "I-NT"].every((code) =>
      focusScopeMatrixHtml.includes(`data-scope="${code}"`) && focusScopeMatrixHtml.includes(`data-service-scope="${code}"`),
    ),
    "Capability technical mapping tables must render mixed-scope service chips, not only default-blue I-AP samples.",
    focusScopeMatrixHtml,
  ),
  check(
    "svg_scope_pills_use_scope_palette_not_service_kind",
    environmentBasemapViewerJs.includes('if (kind === "service")') &&
      environmentBasemapViewerJs.includes('if (kind !== "scope")') &&
      environmentBasemapViewerJs.includes("data-scope-palette") &&
      stylesCss.includes(".sapd-pill.pill--scope[data-scope-palette][class]") &&
      SCOPE_CODES.every((code) => stylesCss.includes(scopePaletteSelector(code))),
    "SVG/basemap scope pills must carry a scope palette attribute without being reclassified as service chips.",
  ),
  check(
    "svg_association_chips_do_not_use_native_title_tooltip",
    environmentBasemapViewerJs.includes("display.annotationValueAttrs?.({ escapeHtml, text }, raw)") &&
      !environmentBasemapViewerJs.includes('title="${escaped}" data-annotation-tooltip'),
    "SVG/basemap association chips must use the shared custom tooltip contract and must not emit browser-native title tooltips.",
  ),
  check(
    "svg_marked_service_chip_keeps_readable_palette",
    stylesCss.includes('.relation-chip.technical-chip.service-chip[data-user-note-anchor-marked="true"][data-service-scope][data-scope][class]') &&
      stylesCss.includes("background: var(--sapd-service-bg) !important;") &&
      stylesCss.includes("color: var(--sapd-service-text) !important;"),
    "Annotated service chips in SVG/basemap associations must keep readable scope chip background and text colors.",
  ),
  check(
    "svg_application_frontend_services_are_labelled_business_chips",
    applicationFrontendServices.length >= 30 &&
      applicationFrontendServices.every((item) => text(item?.objectCode || item?.code) && text(item?.objectName || item?.title || item?.name)) &&
      ["I-AP&T-AS.AD-03", "I-DI&T-PD.DP-01"].every((code) =>
        applicationFrontendServices.some((item) => text(item?.objectCode || item?.code) === code),
      ),
    "The SVG/basemap 应用前端 service association list must render labelled business chips only, without blank visual chips.",
    {
      count: applicationFrontendServices.length,
      blankCount: applicationFrontendServices.filter((item) => !text(item?.objectCode || item?.code) || !text(item?.objectName || item?.title || item?.name)).length,
    },
  ),
  check(
    "environment_graph_scope_selectors_cover_all_codes",
    SCOPE_CODES.every((code) =>
      stylesCss.includes(`.environment-object-service-node[data-scope="${code}"]`) &&
      stylesCss.includes(`.environment-object-funnel-service[data-scope="${code}"]`),
    ),
    "SVG/environment relation graph service nodes must share the same scope palette.",
  ),
  check(
    "environment_graph_uses_global_scope_variables",
    stylesCss.includes("--service: var(--sapd-scope-default);") &&
      stylesCss.includes("--hd: var(--sapd-scope-hd);") &&
      stylesCss.includes("--pe: var(--sapd-scope-pe);"),
    "Environment graph local variables must point at the global service scope palette.",
  ),
  check(
    "manual_relation_chip_renderers_append_scope_attrs",
    focusScopeServiceMatrixJs.includes("serviceScopeAttrs(item, kind)") &&
      applicationSecurityLifecycleJs.includes("serviceScopeAttrs({ ...item, code, title }, objectKind)") &&
      environmentBasemapViewerJs.includes("chipScopeAttrs(item, kind)") &&
      environmentBasemapViewerJs.includes("data-scope-palette"),
    "Components that still render service chips manually must append shared service scope attributes.",
  ),
  check(
    "environment_tree_click_preserves_scroll_owner",
    environmentLocalRelationMapJs.includes("data-environment-tree-scroll") &&
      appJs.includes("function environmentTreeScrollOwner()") &&
      appJs.includes("function restoreEnvironmentTreeScroll(previousScrollTop)") &&
      appJs.includes("const previousTreeScrollTop = options?.preserveTreeScroll") &&
      appJs.includes(`EnvironmentLocalRelationMap.js?v=`) &&
      appJs.includes(CACHE_TOKEN) &&
      (appJs.match(/renderEnvironment\(\{ preserveTreeScroll: true \}\)/g) || []).length >= 4,
    "Environment tree interactions must preserve the tree scroll owner when re-rendering the mapping tab.",
  ),
  check(
    "environment_graph_hud_does_not_cover_legend",
    stylesCss.includes("grid-template-columns: minmax(0, var(--object-hud-width)) minmax(260px, 1fr);") &&
      stylesCss.includes(".environment-object-graph-hud") &&
      stylesCss.includes("max-width: 100%;") &&
      stylesCss.includes(".environment-object-graph-legend") &&
      stylesCss.includes("z-index: 7;") &&
      stylesCss.includes("overflow: hidden;"),
    "Environment graph HUD must stay within its grid column so the scope legend remains visible.",
  ),
  check(
    "maintenance_and_detail_renderers_delegate_to_shared_helper",
    technicalMeasureMaintenanceTableJs.includes("display.relationChipList(utils, items, { empty, kind: fallbackKind })") &&
      detailInspectorJs.includes("display.relationChipList(utils, items, { empty, limit })"),
    "Generic maintenance/detail chip lists must use the shared helper instead of local service color logic.",
  ),
  check(
    "cache_tokens_cover_changed_frontend_files",
    (indexHtml.match(new RegExp(CACHE_TOKEN, "g")) || []).length >= 7,
    "index.html must bump cache tokens for the stylesheet and changed chip renderers.",
  ),
];

const failed = checks.filter((item) => !item.ok);
const result = {
  status: failed.length ? "fail" : "pass",
  checkCount: checks.length,
  failedCount: failed.length,
  checks,
};

console.log(JSON.stringify(result, null, 2));
if (failed.length) process.exitCode = 1;
