#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const DEFAULT_BASE_URL = "http://127.0.0.1:5173";
const FOUNDATION_MARKER = "/* P0-2 Apple Shell shared layout foundation */";

function argValue(name, fallback) {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function read(relativePath) {
  return readFile(new URL(`../${relativePath}`, import.meta.url), "utf8");
}

function occurrenceCount(source, pattern) {
  return [...source.matchAll(pattern)].length;
}

function assertToken(source, name, value) {
  const pattern = new RegExp(`${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*:\\s*${String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}px\\s*;`);
  assert(pattern.test(source), `missing token ${name}: ${value}px`);
}

async function fetchText(baseUrl, pathname) {
  const response = await fetch(new URL(pathname, baseUrl));
  assert(response.ok, `${pathname}: HTTP ${response.status}`);
  return response.text();
}

function validateMetrics(contract, foundation) {
  const viewport = contract.viewport_case;
  const mainHeight = viewport.height - viewport.topbar_height - viewport.page_header_height;
  assert(mainHeight >= viewport.minimum_main_height, `main height ${mainHeight}px is below ${viewport.minimum_main_height}px`);
  assertToken(foundation, "--topbar-height", viewport.topbar_height);
  assertToken(foundation, "--page-header-height", viewport.page_header_height);
  assertToken(foundation, "--sapd-shell-main-min-height", viewport.minimum_main_height);
  assert(/\.app-shell\.app-shell-integrated\s*\{[\s\S]*?--topbar-height:\s*56px;[\s\S]*?--page-header-height:\s*96px;[\s\S]*?\}/.test(foundation), "shell-local metric override missing");
  assert(foundation.includes("grid-template-rows: var(--topbar-height) var(--page-header-height) minmax(0, 1fr);"), "app-main row contract missing");
  return mainHeight;
}

function validateTopbarOperationContract(sources, foundation) {
  const topbarStart = sources.appShell.indexOf("function renderTopBar()");
  const topbarEnd = sources.appShell.indexOf("\n  function readSidebarCollapsed", topbarStart);
  assert(topbarStart >= 0 && topbarEnd > topbarStart, "AppShell topbar renderer missing");
  const topbar = sources.appShell.slice(topbarStart, topbarEnd);
  assert(!topbar.includes('id="metrics"'), "topbar must not reintroduce global count metrics");
  assert(topbar.includes('class="topbar-actions"'), "topbar must keep one global action group");
  assert(topbar.includes('id="licenseStatusBadge"'), "topbar must keep the license status inside the global action group");
  assert(!sources.app.includes("function renderMetrics()"), "removed topbar metrics must not keep a runtime render path");
  assert(/\.app-shell-integrated \.topbar\s*\{[\s\S]*?grid-template-columns:\s*minmax\(0,\s*1fr\)\s+auto;/.test(foundation), "topbar must reserve the right slot for global actions");
}

function validateTitleContract(contract, sources) {
  assert(occurrenceCount(sources.appShell, /<h1\b/g) === contract.title_contract.maximum_page_h1, "AppShell must generate exactly one page h1");
  assert(occurrenceCount(sources.index, /<h1\b/g) === 0, "static shell must not provide a competing h1");
  assert(sources.appShell.includes('<strong class="brand-title">SAPD Wiki</strong>'), "mounted brand must not own h1");
  assert(sources.index.includes('<strong class="brand-title">SAPD Wiki</strong>'), "static brand must not own h1");
  assert(sources.appShell.includes('data-shell-title-owner="true"'), "page title owner marker missing");
  assert(sources.appShell.includes('<h1 id="appPageTitle">'), "page title id missing");
}

function validateNavigationContract(contract, appShell) {
  assert(contract.navigation_contract.single_open_business_domain === true, "single-domain navigation contract changed");
  assert(appShell.includes("function syncNavigationGroups"), "navigation synchronization helper missing");
  assert(appShell.includes("group.open = active;"), "route update must close inactive domains and open the active domain");
  assert(appShell.includes("if (candidate !== group) candidate.open = false;"), "manual domain expansion must close sibling domains");
  assert(appShell.includes('scrollIntoView({ block: "nearest", inline: "nearest", behavior: "auto" })'), "active navigation auto-scroll missing");
  assert(appShell.includes("function revealCurrentNavigationAfterExpansion") && appShell.includes("revealCurrentNavigationAfterExpansion(app?.dataset.shellRoute"), "expanded sidebar must reveal the current route after layout transition");
  assert(appShell.includes(`const SIDEBAR_STATE_KEY = "${contract.navigation_contract.collapse_state_key}";`), "sidebar persistence key changed");
  assert(appShell.includes("syncNavigationGroups(activeRoute);"), "shell update must synchronize navigation groups");
  assert(appShell.includes("const manifestRoute = manifestRouteFor(activeRoute);") && appShell.includes("element.dataset.appRoute === manifestRoute"), "deep routes must resolve to the manifest navigation target");
}

function validateAuxiliaryContract(contract, sources, foundation) {
  const layouts = contract.auxiliary_contract.ordinary_workspace_layouts;
  for (const [id, layout] of Object.entries(layouts)) {
    assert(sources.appShell.includes(`["${id}", "${layout}"]`), `${id}: shared layout declaration missing`);
  }
  assert(sources.appShell.includes('mode: "overlay"'), "second auxiliary layer must use overlay mode");
  assert(sources.appShell.includes(`const SHELL_AUXILIARY_EVENT = "${contract.auxiliary_contract.overlay_dismiss_event}";`), "overlay dismiss event changed");
  assert(sources.appShell.includes("function setAuxiliaryLayerState"), "overlay state helper missing");
  assert(sources.app.includes('child.dataset.shellAuxiliaryMode !== "overlay"'), "overlay must stay outside resident grid columns");
  assert(sources.app.includes('setAuxiliaryLayerState?.("sourceDetailPane"'), "maintenance inspector overlay state is not connected");
  assert(sources.app.includes('setAuxiliaryLayerState?.("contentDetailPane"'), "content inspector overlay state is not connected");
  assert(sources.app.includes(`document.addEventListener("${contract.auxiliary_contract.overlay_dismiss_event}"`), "overlay dismiss handling missing");
  assert(foundation.includes('[data-shell-auxiliary-mode="overlay"]'), "overlay layout CSS missing");
  assert(foundation.includes('[data-shell-auxiliary-mode="overlay"].is-shell-closed'), "closed overlay CSS missing");
}

function validateDirectoryContract(contract, sources, directoryCss) {
  const directory = contract.directory_contract;
  assert(directory.shared_class === "shell-directory-pane", "shared directory class changed");
  assert(directory.contour_owner === "outer-pane-only", "directory contour owner must remain the outer pane");
  assert(directory.surface_radius === contract.visual_tokens.radii.surface, "directory surface radius must reuse the Apple Shell surface token");
  assert(directory.body_border === 0 && directory.body_radius === 0, "directory scroll body must remain borderless and square");
  assert(directory.collapsed_border === 0, "collapsed directory must not leave a contour sliver in the zero-width track");
  assert(Object.keys(directory.registered_panes).length === 4, "all four resident directory pane families must be registered");
  assert(sources.appShell.includes('if (kind === "directory") panel.classList.add("shell-directory-pane");'), "AppShell does not assign the shared directory class by auxiliary role");
  assert(sources.appShell.includes('class="capability-tree-pane shell-directory-pane app-shell-secondary"'), "mounted capability directory does not keep the shared shell class");
  assert(sources.environmentLocal.includes('class="environment-tab-tree-pane shell-directory-pane"'), "environment object directory does not use the shared shell class");
  for (const selector of ["capability-tree-pane", "source-nav-pane", "content-nav-pane"]) {
    assert(sources.index.includes(`${selector} shell-directory-pane`) || sources.index.includes(`shell-directory-pane ${selector}`), `static ${selector} fallback does not use the shared directory class`);
  }
  const shellStart = directoryCss.indexOf(".app-shell-integrated .shell-directory-pane {");
  const shellEnd = directoryCss.indexOf("}", shellStart);
  const shellBlock = shellStart >= 0 && shellEnd > shellStart ? directoryCss.slice(shellStart, shellEnd + 1) : "";
  assert(shellBlock.includes("border: 1px solid var(--sapd-shell-divider);") && shellBlock.includes("border-radius: var(--sapd-shell-radius-surface);"), "directory outer pane is not the single Apple Shell contour owner");
  assert(shellBlock.includes("overflow: hidden;") && shellBlock.includes("isolation: isolate;"), "directory outer pane does not clip child surfaces at all four corners");
  const bodyStart = directoryCss.indexOf(".app-shell-integrated .shell-directory-pane > :is(.tree, .environment-tree, .source-nav) {");
  const bodyEnd = directoryCss.indexOf("}", bodyStart);
  const bodyBlock = bodyStart >= 0 && bodyEnd > bodyStart ? directoryCss.slice(bodyStart, bodyEnd + 1) : "";
  assert(bodyBlock.includes("height: auto;") && bodyBlock.includes("overflow: auto;"), "directory body does not own its scroll area inside the shared grid");
  assert(bodyBlock.includes("border: 0;") && bodyBlock.includes("border-radius: 0;") && bodyBlock.includes("box-shadow: none;"), "directory body can still draw a nested rounded contour");
  assert(directoryCss.includes(".capability-workspace.catalog-collapsed .shell-directory-pane") && directoryCss.includes(".environment-mapping-workbench.catalog-collapsed .shell-directory-pane"), "collapsed capability or environment directory is not covered by the shared shell contract");
}

function validateSharedComponentContract(contract, sources) {
  const segmented = contract.shared_component_contract.segmented_tabs;
  const search = contract.shared_component_contract.page_local_search;
  assert(segmented.container_min_height === 42 && segmented.container_radius === 16, "shared segmented container geometry changed");
  assert(segmented.button_min_height === 34 && segmented.button_radius === 12 && segmented.placement_invariant === true, "shared segmented button or placement contract changed");
  assert(/\.app-shell-integrated \.maintenance-section-tabs,[\s\S]*?min-height:\s*42px;[\s\S]*?padding:\s*4px;[\s\S]*?border-radius:\s*16px;/.test(sources.css), "shared segmented container CSS is incomplete");
  assert(/\.app-shell-integrated \.maintenance-section-tabs button,[\s\S]*?min-height:\s*34px;[\s\S]*?padding:\s*0 13px;[\s\S]*?border-radius:\s*12px;/.test(sources.css), "shared segmented button CSS is incomplete");
  assert(!sources.css.includes(".app-shell-integrated #appPageHeader .maintenance-section-tabs"), "page-header placement must not compress the shared segmented component");
  assert(search.minimum_height === 40 && search.radius === "pill", "page-local search geometry contract changed");
  assert(search.required_parts.join(",") === "input,match_status,previous,next", "page-local search required parts changed");
  assert(/\.page-search-control\s*\{[\s\S]*?grid-template-columns:\s*minmax\(0, 1fr\) minmax\(42px, auto\) 28px 28px;/.test(sources.css), "page-local search input/status/previous/next grid is incomplete");
  assert(sources.css.includes(".page-search-match-status") && sources.css.includes(".page-search-step"), "page-local search status or step styles are missing");
}

function validateMaturityShellContract(contract, sources) {
  const maturity = contract.maturity_contract;
  assert(maturity.included_in_apple_shell === true, "maturity must be included in the Apple Shell contract");
  assert(maturity.workspace_layout === "main-only", "maturity workspace must remain main-only");
  assert(sources.appShell.includes('const isMaturityPage = activeRoute === "/workbench/maturity" || activeRoute.startsWith("/workbench/maturity/")'), "maturity route family must share one App Shell branch");
  assert(sources.appShell.includes(`id="${maturity.header_action_slot}"`), "maturity App Shell action slot missing");
  assert(sources.maturity.includes("function syncMaturityShellHeader"), "maturity shell synchronization helper missing");
  assert(sources.maturity.includes(`document.getElementById("${maturity.header_action_slot}")`), "maturity workbench is not connected to the shared header slot");
  assert(!sources.maturity.includes('<header class="maturity-v1-page-header">'), "maturity project list must not add a second page header");
  assert(!sources.maturity.includes('<header class="maturity-v1-project-header">'), "maturity project pages must not add a second primary header");
  assert(sources.maturity.includes('data-shell-workflow-overlay="maturity-project-create"'), "maturity create flow must declare a shell workflow overlay");
  assert(sources.maturity.includes('data-shell-overlay-surface="maturity-project-create"'), "maturity create dialog must declare its overlay surface");
  assert(sources.maturityCss.includes("border-radius: var(--sapd-shell-radius-overlay, 14px);"), "maturity create dialog must reuse the shell overlay radius");
  assert(sources.maturityCss.includes(".app-shell-integrated .app-page-header:has(#maturityShellHeaderActions)"), "maturity shell popovers must remain visible outside the page header row");
  assert(!sources.maturity.includes('model.activeTab === "scoring" ? ""'), "every maturity project tab must keep the same project context");
  assert(sources.maturity.includes('maintenance-section-tabs maturity-v4-service-tabs') && sources.maturity.includes('maintenance-section-tab maturity-v4-service-tab'), "maturity service switching must reuse shared Apple Shell tabs");
  assert(sources.maturity.includes('data-maturity-radar-contract="l2-capability-by-top-category"'), "maturity results must expose the all-L2 grouped radar contract");
  assert(contract.forbidden_scope.maturity_business_or_scoring_rule_change === true, "P0-2 maturity inclusion must not change business or scoring rules");
}

function validateVisualTokenContract(contract, foundation) {
  const [meta, body, section, title] = contract.visual_tokens.font_sizes;
  assertToken(foundation, "--sapd-shell-type-meta", meta);
  assertToken(foundation, "--sapd-shell-type-body", body);
  assertToken(foundation, "--sapd-shell-type-section", section);
  assertToken(foundation, "--sapd-shell-type-title", title);
  assertToken(foundation, "--sapd-shell-radius-control", contract.visual_tokens.radii.control);
  assertToken(foundation, "--sapd-shell-radius-surface", contract.visual_tokens.radii.surface);
  assertToken(foundation, "--sapd-shell-radius-overlay", contract.visual_tokens.radii.overlay);
  assert(!/\b(?:table|thead|tbody|tfoot|tr|th|td)\b/.test(foundation), "P0-2 foundation must not globally override business tables");
  assert(!/font-size\s*:\s*(?:9|10|11|13|15|17|18|19|20|21|23|24)px/.test(foundation), "P0-2 shell introduced a non-contract font size");
  assert(!/border-radius\s*:\s*(?:1[5-9]|[2-9]\d|999)px/.test(foundation), "P0-2 shell introduced an out-of-contract fixed radius");
  assert(foundation.includes("border-radius: var(--sapd-shell-radius-surface);"), "shared surface radius is not applied");
  assert(foundation.includes("border-radius: var(--sapd-shell-radius-overlay);"), "overlay radius is not applied");
}

function validateStatisticVibrancyContract(contract, sources) {
  const vibrancy = contract.visual_tokens.statistic_vibrancy;
  assert(vibrancy.shared_class === "sapd-stat-vibrancy", "statistic Vibrancy shared class changed");
  assert(vibrancy.stylesheet === "stat-vibrancy.css", "statistic Vibrancy stylesheet changed");
  assert(vibrancy.blur_px === 28 && vibrancy.solid_fallback === true, "statistic Vibrancy strength or fallback contract changed");
  assert(vibrancy.allowed_surfaces.includes("score_summary") && vibrancy.allowed_surfaces.includes("result_analysis"), "maturity statistical surfaces are not registered for Vibrancy");
  assert(vibrancy.forbidden_surfaces.includes("form_field") && vibrancy.forbidden_surfaces.includes("business_table") && vibrancy.forbidden_surfaces.includes("drawio_canvas"), "Vibrancy forbidden scope is incomplete");
  assert(sources.index.includes('stat-vibrancy.css?v=apple-shell-stat-vibrancy-20260715-1'), "shared statistic Vibrancy stylesheet is not loaded");
  assert(sources.statVibrancy.includes(`.${vibrancy.shared_class}`), "shared statistic Vibrancy class is missing");
  assert(sources.statVibrancy.includes(`blur(${vibrancy.blur_px}px)`) && sources.statVibrancy.includes("@supports not"), "statistic Vibrancy blur or solid fallback is missing");
  assert(sources.statVibrancy.includes("@media (forced-colors: active)"), "statistic Vibrancy forced-colors fallback is missing");
  assert(occurrenceCount(sources.maturity, /sapd-stat-vibrancy/g) >= 6, "maturity statistical surfaces do not reuse the shared Vibrancy class");
}

function validatePageHeaderRhythmContract(contract, foundation) {
  const rhythm = contract.visual_tokens.page_header_rhythm;
  assertToken(foundation, "--sapd-shell-page-header-gap", rhythm.gap);
  assertToken(foundation, "--sapd-shell-page-header-padding-block", rhythm.padding_block);
  assertToken(foundation, "--sapd-shell-page-header-padding-inline", rhythm.padding_inline);
  assertToken(foundation, "--sapd-shell-page-header-copy-gap", rhythm.copy_gap);
  assertToken(foundation, "--sapd-shell-page-header-title-gap", rhythm.title_gap);
  assertToken(foundation, "--sapd-shell-page-header-title-min-height", rhythm.title_min_height);
  assert(foundation.includes(`--sapd-shell-page-header-breadcrumb-line-height: ${rhythm.breadcrumb_line_height};`), "breadcrumb line-height token drifted from the DMG baseline");
  assert(foundation.includes(`--sapd-shell-page-header-title-line-height: ${rhythm.title_line_height};`), "page title line-height token drifted from the DMG baseline");
  assert(foundation.includes(`--sapd-shell-page-header-description-line-height: ${rhythm.description_line_height};`), "page description line-height token drifted from the DMG baseline");
  assert(/\.app-shell-integrated \.app-page-header\s*\{[\s\S]*?gap:\s*var\(--sapd-shell-page-header-gap\);[\s\S]*?padding:\s*var\(--sapd-shell-page-header-padding-block\) var\(--sapd-shell-page-header-padding-inline\);/.test(foundation), "page header must consume the shared DMG rhythm tokens");
  assert(/\.app-shell-integrated \.page-header-copy\s*\{[\s\S]*?gap:\s*var\(--sapd-shell-page-header-copy-gap\);/.test(foundation), "page header copy gap must consume the shared token");
  assert(/\.app-shell-integrated \.page-title-row\s*\{[\s\S]*?min-height:\s*var\(--sapd-shell-page-header-title-min-height\);[\s\S]*?gap:\s*var\(--sapd-shell-page-header-title-gap\);/.test(foundation), "page title row must consume the shared DMG rhythm tokens");
  assert(/\.app-shell-integrated \.page-title-row h1\s*\{[\s\S]*?font-size:\s*var\(--sapd-shell-type-title\);[\s\S]*?line-height:\s*var\(--sapd-shell-page-header-title-line-height\);/.test(foundation), "page title must use the shared 24px DMG title contract");
  assert(/\.app-shell-integrated \.page-header-copy p\s*\{[\s\S]*?font-size:\s*var\(--sapd-shell-type-meta\);[\s\S]*?line-height:\s*var\(--sapd-shell-page-header-description-line-height\);/.test(foundation), "page description must use the compact DMG text role");
}

async function main() {
  const baseUrl = argValue("--url", DEFAULT_BASE_URL).replace(/\/$/, "");
  const [contractSource, appShell, app, index, css, maturity, maturityCss, environmentLocal, directoryCss, statVibrancy] = await Promise.all([
    read("config/frontend-p0-2-apple-shell-layout.json"),
    read("frontend/capability-browser/components/AppShell.js"),
    read("frontend/capability-browser/app.js"),
    read("frontend/capability-browser/index.html"),
    read("frontend/capability-browser/styles.css"),
    read("frontend/capability-browser/components/MaturityAssessmentWorkbench.js"),
    read("frontend/capability-browser/maturity-assessment-workbench.css"),
    read("frontend/capability-browser/components/EnvironmentLocalRelationMap.js"),
    read("frontend/capability-browser/shared-directory-shell.css"),
    read("frontend/capability-browser/stat-vibrancy.css"),
  ]);
  const contract = JSON.parse(contractSource);
  const markerIndex = css.lastIndexOf(FOUNDATION_MARKER);
  assert(markerIndex >= 0, "P0-2 foundation marker missing");
  const foundation = css.slice(markerIndex);
  const sources = { appShell, app, index, css, maturity, maturityCss, environmentLocal, statVibrancy };

  const mainHeight = validateMetrics(contract, foundation);
  validateTopbarOperationContract(sources, foundation);
  validateTitleContract(contract, sources);
  validateNavigationContract(contract, appShell);
  validateAuxiliaryContract(contract, sources, foundation);
  validateDirectoryContract(contract, sources, directoryCss);
  validateSharedComponentContract(contract, sources);
  validateMaturityShellContract(contract, sources);
  validateVisualTokenContract(contract, foundation);
  validateStatisticVibrancyContract(contract, sources);
  validatePageHeaderRhythmContract(contract, foundation);

  const [runtimeIndex, runtimeAppShell, runtimeApp, runtimeCss, runtimeMaturity, runtimeMaturityCss, runtimeEnvironmentLocal, runtimeDirectoryCss, runtimeStatVibrancy] = await Promise.all([
    fetchText(baseUrl, "/"),
    fetchText(baseUrl, "/components/AppShell.js"),
    fetchText(baseUrl, "/app.js"),
    fetchText(baseUrl, "/styles.css"),
    fetchText(baseUrl, "/components/MaturityAssessmentWorkbench.js"),
    fetchText(baseUrl, "/maturity-assessment-workbench.css"),
    fetchText(baseUrl, "/components/EnvironmentLocalRelationMap.js"),
    fetchText(baseUrl, "/shared-directory-shell.css"),
    fetchText(baseUrl, "/stat-vibrancy.css"),
  ]);
  assert(runtimeIndex.includes('id="contentDetailPane"'), "runtime index is not serving the P0-2 auxiliary target");
  assert(runtimeAppShell.includes("syncNavigationGroups"), "runtime AppShell is not serving P0-2 navigation");
  assert(runtimeCss.includes(FOUNDATION_MARKER), "runtime CSS is not serving the P0-2 foundation");
  assert(runtimeIndex.includes("shared-directory-shell.css?v=p0-2-directory-shell-20260714-1"), "runtime index is not loading the shared directory shell");
  validateTopbarOperationContract({ appShell: runtimeAppShell, app: runtimeApp }, runtimeCss.slice(runtimeCss.lastIndexOf(FOUNDATION_MARKER)));
  validatePageHeaderRhythmContract(contract, runtimeCss.slice(runtimeCss.lastIndexOf(FOUNDATION_MARKER)));
  validateDirectoryContract(contract, { appShell: runtimeAppShell, index: runtimeIndex, environmentLocal: runtimeEnvironmentLocal }, runtimeDirectoryCss);
  validateSharedComponentContract(contract, { css: runtimeCss });
  validateStatisticVibrancyContract(contract, { index: runtimeIndex, maturity: runtimeMaturity, statVibrancy: runtimeStatVibrancy });
  assert(runtimeMaturity.includes("syncMaturityShellHeader"), "runtime maturity workbench is not serving the Apple Shell integration");
  assert(runtimeMaturityCss.includes("#maturityShellHeaderActions"), "runtime maturity styles are not serving the Apple Shell integration");

  console.log(JSON.stringify({
    result: "pass",
    contract: contract.version,
    baseUrl,
    viewport: {
      width: contract.viewport_case.width,
      height: contract.viewport_case.height,
      mainHeight,
      minimum: contract.viewport_case.minimum_main_height,
    },
    title: { pageH1: 1, competingBrandH1: 0 },
    navigation: { singleOpenDomain: true, activeRouteAutoScroll: true },
    auxiliary: { maximumResidentLayers: contract.auxiliary_contract.maximum_resident_layers_per_ordinary_page, secondLayerMode: contract.auxiliary_contract.second_layer_mode },
    maturity: contract.maturity_contract,
    visualTokens: contract.visual_tokens,
    pageHeaderRhythm: contract.visual_tokens.page_header_rhythm,
    forbiddenScope: contract.forbidden_scope,
  }, null, 2));
}

main().catch((error) => {
  console.error(JSON.stringify({ result: "fail", error: error.message }, null, 2));
  process.exit(1);
});
