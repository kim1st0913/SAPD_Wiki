#!/usr/bin/env node

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import vm from "node:vm";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");
const indexHtml = await readFile(resolve(root, "frontend/capability-browser/index.html"), "utf8");
const scaleCss = await readFile(resolve(root, "frontend/capability-browser/adaptive-ui-scale.css"), "utf8");
const scaleJs = await readFile(resolve(root, "frontend/capability-browser/components/AdaptiveUiScale.js"), "utf8");

assert.match(indexHtml, /adaptive-ui-scale\.css\?v=/, "adaptive scale stylesheet must be loaded");
assert.match(indexHtml, /components\/AdaptiveUiScale\.js\?v=/, "adaptive scale owner must be loaded");
assert.match(scaleCss, /zoom:\s*var\(--sapd-ui-scale\)/, "shell must use one shared scale layer");
assert.match(scaleCss, /--sapd-ui-logical-viewport-width/, "scaled shell must compensate logical width");
assert.match(scaleCss, /--sapd-ui-logical-viewport-height/, "scaled shell must compensate logical height");
assert.match(scaleCss, /width:\s*var\(--sapd-ui-logical-viewport-width\)/, "scaled shell must preserve full viewport width");
assert.match(scaleCss, /max-width:\s*none/, "legacy shell max-width must not clip compact scaling");
assert.match(scaleCss, /calc\(var\(--sapd-ui-logical-viewport-width\) - var\(--app-sidebar-width\)\)/, "main pane must use the compensated logical viewport");
assert.doesNotMatch(scaleCss, /transform:\s*scale/, "fixed and sticky shell geometry must not use transform scaling");
assert.match(scaleJs, /BASE_VIEWPORT_WIDTH\s*=\s*1920/, "1920px desktop baseline must remain 1:1");
assert.match(scaleJs, /COMPACT_VIEWPORT_WIDTH\s*=\s*1180/, "compact layout must align with the shared shell breakpoint");
assert.match(scaleJs, /MIN_READABLE_SCALE\s*=\s*1/, "compact viewports must not shrink readable text below 1:1");
assert.match(scaleJs, /MAX_SCALE\s*=\s*1\.6/, "extreme-width scale must stay capped");
assert.match(scaleJs, /MIN_LOGICAL_HEIGHT\s*=\s*700/, "short wide viewports must preserve a usable logical height");
assert.match(scaleJs, /safeWidth \/ BASE_VIEWPORT_WIDTH/, "wide-screen scaling must remain fluid instead of using resolution tiers");
assert.match(scaleJs, /viewportWidth \/ scale/, "logical width must be derived from the CSS viewport and scale");
assert.match(scaleJs, /viewportHeight \/ scale/, "logical height must be derived from the CSS viewport and scale");
assert.match(scaleJs, /window\.visualViewport\?\.addEventListener\("resize"/, "App and Web visual viewport changes must rescale");
assert.doesNotMatch(scaleJs, /devicePixelRatio/, "scale must follow CSS viewport rather than display pixel density");
assert.match(scaleCss, /data-sapd-ui-layout="compact"/, "compact layout must be owned by the shared adaptive layer");
assert.match(scaleCss, /--app-sidebar-width:\s*76px/, "compact layout must prioritize the icon rail over shell shrinking");
assert.match(scaleCss, /\.module-tabs\.manifest-navigation \.module-tab span:not\(\.nav-symbol\)/, "compact icon rail must hide navigation labels instead of stacking them vertically");
assert.match(scaleCss, /width:\s*44px/, "compact icon rail controls must keep a stable touch target");

const rootStyle = new Map();
const documentElement = {
  dataset: {},
  style: {
    setProperty(name, value) {
      rootStyle.set(name, value);
    },
  },
};
const browserContext = {
  document: { documentElement },
  window: {
    innerWidth: 1920,
    innerHeight: 1080,
    sapdComponents: {},
    addEventListener() {},
    cancelAnimationFrame() {},
    requestAnimationFrame(callback) {
      callback();
      return 1;
    },
    visualViewport: { addEventListener() {} },
  },
};
vm.runInNewContext(scaleJs, browserContext);
const adaptiveScale = browserContext.window.sapdComponents.AdaptiveUiScale;
const viewportMatrix = [
  { width: 1024, height: 768, expectedScale: 1, expectedLayout: "compact" },
  { width: 1280, height: 720, expectedScale: 1, expectedLayout: "desktop" },
  { width: 1366, height: 768, expectedScale: 1, expectedLayout: "desktop" },
  { width: 1440, height: 900, expectedScale: 1, expectedLayout: "desktop" },
  { width: 1680, height: 1050, expectedScale: 1, expectedLayout: "desktop" },
  { width: 1920, height: 1080, expectedScale: 1, expectedLayout: "wide" },
  { width: 2048, height: 1152, expectedScale: 1.067, expectedLayout: "wide" },
  { width: 2560, height: 1440, expectedScale: 1.333, expectedLayout: "wide" },
  { width: 3008, height: 1692, expectedScale: 1.567, expectedLayout: "wide" },
  { width: 3840, height: 2160, expectedScale: 1.6, expectedLayout: "wide" },
  { width: 3001, height: 1661, expectedScale: 1.563, expectedLayout: "wide" },
  { width: 2522, height: 926, expectedScale: 1.314, expectedLayout: "wide" },
  { width: 2641, height: 1188, expectedScale: 1.376, expectedLayout: "wide" },
];

viewportMatrix.forEach(({ width, height, expectedScale, expectedLayout }) => {
  assert.equal(adaptiveScale.scaleForViewport(width, height), expectedScale, `${width}x${height} scale must match the shared contract`);
  assert.equal(adaptiveScale.layoutForViewport(width), expectedLayout, `${width}px layout mode must match the shared contract`);
});

assert(adaptiveScale.scaleForViewport(2561, 1440) > adaptiveScale.scaleForViewport(2560, 1440), "fluid scale must not snap at 2560px");
assert(adaptiveScale.scaleForViewport(3007, 1692) < adaptiveScale.scaleForViewport(3008, 1692), "fluid scale must not snap at 3008px");

console.log("frontend adaptive UI scale contract: pass");
