#!/usr/bin/env node

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import vm from "node:vm";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");
const read = (relativePath) => readFile(resolve(root, relativePath), "utf8");

const [
  appShellSource,
  componentSource,
  statusBadgeSource,
  runtimeStateSource,
  dataClientSource,
  appSource,
  indexSource,
  cssSource,
  adaptiveCssSource,
] = await Promise.all([
  read("frontend/capability-browser/components/AppShell.js"),
  read("frontend/capability-browser/components/AiIntegrationSettings.js"),
  read("frontend/capability-browser/components/StatusBadge.js"),
  read("frontend/capability-browser/components/RuntimeState.js"),
  read("frontend/capability-browser/dataClient.js"),
  read("frontend/capability-browser/app.js"),
  read("frontend/capability-browser/index.html"),
  read("frontend/capability-browser/ai-integration-settings.css"),
  read("frontend/capability-browser/adaptive-ui-scale.css"),
]);

const browserContext = {
  window: { sapdComponents: {}, sapdDisplay: {} },
  console,
  Intl,
};
vm.runInNewContext(appShellSource, browserContext, { filename: "AppShell.js" });
vm.runInNewContext(statusBadgeSource, browserContext, { filename: "StatusBadge.js" });
vm.runInNewContext(runtimeStateSource, browserContext, { filename: "RuntimeState.js" });
vm.runInNewContext(componentSource, browserContext, { filename: "AiIntegrationSettings.js" });

const appShell = browserContext.window.sapdComponents.AppShell;
const settingsComponent = browserContext.window.sapdComponents.AiIntegrationSettings;
assert.equal(appShell.getRouteTarget("/settings").route, "/settings/basic", "settings root must canonicalize to basic settings");
assert.equal(appShell.getRouteTarget("/settings/basic").view, "settings", "basic settings route must resolve to settings view");
assert.equal(appShell.getRouteTarget("/settings/ai-integration").view, "settings", "AI integration route must resolve to settings view");
assert.equal(appShell.getRouteTarget("/settings/ai-integration").settingsPage, "ai-integration", "AI integration route must retain its explicit page");

const manifestRoutes = [];
const collectRoutes = (items = []) => items.forEach((item) => {
  manifestRoutes.push(item.route);
  collectRoutes(item.children);
});
collectRoutes(appShell.manifest.navigation);
assert(!manifestRoutes.some((route) => String(route).startsWith("/settings")), "settings must not enter the business sidebar manifest");

const topbar = appShell.renderTopBar();
assert(topbar.includes('data-app-route="/settings/basic"'), "topbar settings entry is missing");
assert(topbar.includes('data-app-route="/settings/ai-integration"'), "topbar AI status entry is missing");
assert.equal((topbar.match(/class="topbar-actions"/g) || []).length, 1, "topbar must retain one action group");
const settingsHeader = appShell.renderPageHeader({ activeRoute: "/settings/ai-integration" });
assert.equal((settingsHeader.match(/<h1\b/g) || []).length, 1, "settings route must retain exactly one AppShell h1");
assert(settingsHeader.includes('<h1 id="appPageTitle">系统设置</h1>'), "settings page title must be owned by AppShell");
assert(settingsHeader.includes("AI 集成"), "settings breadcrumb must identify the current utility page");

const snapshot = {
  contract_version: "sapd-mcp-control-v1",
  state_version: 12,
  status: {
    desired_state: "enabled",
    service_state: "ready",
    authorization_state: "authorized",
    activity_state: "recent",
    knowledge_state: "ready",
    audit_state: "ready",
    display_state: "recently_used",
    last_success_at: "2026-07-23T08:30:00Z",
    recoverable_error: null,
  },
  settings: {
    enabled: true,
    configured_port: 18775,
    release_channel: "beta",
    canonical_resource: "https://127.0.0.1:18775/mcp",
    control_capabilities: {
      service_control: false,
      client_revocation: true,
      audit_clear: true,
      native_reset_confirmation: false,
    },
  },
  clients: [
    {
      client_id: "client:test-0001",
      display_name: "Codex 本地客户端",
      trust_state: "verified",
      scopes: ["sapd.base.public.summary.read"],
      authorized_at: "2026-07-23T08:00:00Z",
      last_used_at: "2026-07-23T08:30:00Z",
      policy_version: "v1",
      status: "authorized",
    },
  ],
  audit: {
    enabled: true,
    state: "ready",
    retention_days: 30,
    retention_bytes: 20971520,
    event_count: 8,
    last_event_at: "2026-07-23T08:30:00Z",
  },
  diagnostics: {
    overall_state: "ready",
    last_checked_at: "2026-07-23T08:31:00Z",
    checks: [
      { check_id: "port", status: "pass", error_code: null, recovery_action: null },
      { check_id: "tls", status: "warning", error_code: "LOCAL_CHECK", recovery_action: "open_desktop_app" },
    ],
  },
  internal_sentinel: "MUST_NOT_RENDER_INTERNAL_SENTINEL",
};

const aiHtml = settingsComponent.render({
  route: "/settings/ai-integration",
  snapshot,
  notice: { tone: "success", message: "状态已刷新" },
});
const basicHtml = settingsComponent.render({ route: "/settings/basic", snapshot });
const sectionIds = [
  "service-status",
  "client-connection",
  "authorized-clients",
  "data-access",
  "privacy-audit",
  "diagnostics-reset",
];
sectionIds.forEach((sectionId) => {
  assert.equal((aiHtml.match(new RegExp(`data-ai-settings-section="${sectionId}"`, "g")) || []).length, 1, `${sectionId} must render exactly once`);
});
assert(aiHtml.includes("近期已使用"), "D3 display_state must own the rendered status");
assert(aiHtml.includes("Codex 本地客户端"), "authorized client projection is missing");
assert(aiHtml.includes("需要桌面应用"), "pure Web capability boundary is not explicit");
assert(/data-mcp-action="stop"[\s\S]*?disabled/.test(aiHtml), "service control must be disabled when the D3 capability is false");
assert(aiHtml.includes('data-mcp-request-confirmation="revoke"'), "client revoke must remain an independent confirmed action");
assert(aiHtml.includes('data-mcp-request-confirmation="clear-audit"'), "audit clear must remain an independent confirmed action");
assert(aiHtml.includes('data-mcp-action="prepare-reset"'), "reset prepare must remain independent from stop and revoke");
assert(!aiHtml.includes("MUST_NOT_RENDER_INTERNAL_SENTINEL"), "component rendered an undeclared response field");
assert(!aiHtml.includes("<h1"), "settings component must not compete with the AppShell page title");
assert(basicHtml.includes('data-settings-page="basic"') && basicHtml.includes("本地运行配置"), "basic settings route did not render");
assert(basicHtml.includes('data-app-route="/settings/ai-integration"'), "basic settings must link to AI integration");
const displayCases = [
  ["disabled", "MCP 未启用"],
  ["ready_waiting_authorization", "服务已就绪，等待授权"],
  ["authorized_waiting_use", "已授权，等待使用"],
  ["knowledge_degraded", "MCP 可用，知识状态受限"],
  ["knowledge_blocked", "MCP 知识不可用"],
  ["audit_degraded", "MCP 可用，审计记录异常"],
  ["recoverable_error", "MCP 需要处理"],
];
displayCases.forEach(([displayState, expectedLabel]) => {
  const variant = {
    ...snapshot,
    status: { ...snapshot.status, display_state: displayState },
  };
  assert(settingsComponent.render({ route: "/settings/ai-integration", snapshot: variant }).includes(expectedLabel), `${displayState} must use the D3 display label`);
});

const confirmationHtml = settingsComponent.render({
  route: "/settings/ai-integration",
  snapshot,
  confirmation: { action: "revoke", clientId: "client:test-0001", label: "Codex 本地客户端" },
});
assert(confirmationHtml.includes('role="dialog"') && confirmationHtml.includes('aria-modal="true"'), "destructive confirmation must use an accessible dialog");
assert(confirmationHtml.includes("只会撤销") && confirmationHtml.includes("不会停止服务"), "revoke confirmation must describe its independent scope");

const resetHtml = settingsComponent.render({
  route: "/settings/ai-integration",
  snapshot,
  resetPreview: {
    effects: ["stop_service", "revoke_all_clients", "delete_managed_trust", "delete_managed_secrets", "retain_audit"],
  },
});
assert(resetHtml.includes("重置影响清单") && resetHtml.includes("需要桌面应用"), "reset preview must stop at the desktop boundary");
assert(!resetHtml.includes('data-mcp-confirm-action="confirm-reset"'), "Web must not fabricate native reset confirmation");

assert(!/\bfetch\s*\(/.test(componentSource), "render component must not fetch");
assert(!componentSource.includes("sapdDataClient"), "render component must not call dataClient");
assert(appSource.includes("async function loadMcpControlPanel"), "app.js must own control snapshot loading");
assert(appSource.includes("async function performMcpControlAction"), "app.js must own control mutations");
assert(appSource.includes("await loadMcpControlPanel({ force: true })"), "app.js must refresh the D3 snapshot after mutations");
assert(appSource.includes('if (state.activeView === "settings") return [];'), "settings route must not trigger unrelated data package loading");
assert(appSource.includes('settings: "settingsWorkspace"'), "settings workspace must be registered in view switching");

const expectedPaths = [
  "/api/v1/mcp/control-panel",
  "/api/v1/mcp/actions/start",
  "/api/v1/mcp/actions/stop",
  "/api/v1/mcp/actions/retry",
  "/api/v1/mcp/clients/actions/revoke",
  "/api/v1/mcp/audit/actions/clear",
  "/api/v1/mcp/reset/actions/prepare",
];
expectedPaths.forEach((path) => assert(dataClientSource.includes(`"${path}"`), `missing frozen D3 endpoint ${path}`));
assert(dataClientSource.includes("request_id") && dataClientSource.includes("expected_state_version"), "mutation concurrency fields are missing");
assert(dataClientSource.includes("assertMcpResponseFieldPolicy"), "recursive response field guard is missing");
assert(dataClientSource.includes("async confirmMcpReset()") && dataClientSource.includes('createMcpControlError("DESKTOP_CAPABILITY_REQUIRED"'), "Web reset confirmation must use the frozen desktop capability error");

const requiredIndexMarkers = [
  'id="settingsWorkspace"',
  "ai-integration-settings.css?v=mcp-web-d4-20260723-1",
  "components/AiIntegrationSettings.js?v=mcp-web-d4-20260723-1",
];
requiredIndexMarkers.forEach((marker) => assert(indexSource.includes(marker), `index missing ${marker}`));
assert(indexSource.indexOf("components/AiIntegrationSettings.js") < indexSource.indexOf("./app.js?"), "settings component must load before app.js");
assert(adaptiveCssSource.includes(".app-shell-integrated .settings-workspace"), "settings workspace is not registered in the adaptive owner");
assert(cssSource.includes("overflow-x: auto") && cssSource.includes("overflow-wrap: anywhere"), "narrow layout needs local overflow containment");
assert(cssSource.includes("@media (max-width: 1180px)") && cssSource.includes("@media (max-width: 640px)"), "compact and narrow settings layouts are missing");
assert(cssSource.includes(":focus-visible") && cssSource.includes("prefers-reduced-motion"), "keyboard focus or reduced-motion support is missing");
assert(!/#[0-9a-f]{3,8}\b/i.test(cssSource), "scoped settings CSS must not introduce raw colors");
assert(!/\b(?:rgb|rgba|hsl|hsla)\(/i.test(cssSource), "scoped settings CSS must use approved tokens");

const controlRequests = [];
let injectForbiddenControlField = false;
const controlFetch = async (url, options = {}) => {
  controlRequests.push({ url: String(url), options });
  if (String(url).endsWith("/api/v1/health")) {
    return {
      ok: true,
      status: 200,
      headers: { get: () => "application/json" },
      json: async () => ({
        auth: {
          writes_require_token: true,
          header: "X-SAPD-Session-Token",
          session_token: "synthetic-local-session",
        },
      }),
    };
  }
  if (String(url).endsWith("/api/v1/mcp/control-panel")) {
    return {
      ok: true,
      status: 200,
      headers: { get: () => "application/json" },
      json: async () => {
        const { internal_sentinel, ...contractSnapshot } = snapshot;
        return injectForbiddenControlField
          ? { ...contractSnapshot, raw_logs: "MUST_BE_REJECTED" }
          : contractSnapshot;
      },
    };
  }
  const request = JSON.parse(options.body || "{}");
  const action = String(url).includes("/clients/") ? "revoke_client"
    : String(url).includes("/audit/") ? "clear_audit"
      : String(url).includes("/reset/") ? "prepare_reset"
        : String(url).split("/").at(-1);
  const response = {
    contract_version: "sapd-mcp-control-v1",
    action,
    request_id: request.request_id,
    state_version: 13,
    result: "completed",
    changed: false,
  };
  if (action === "prepare_reset") {
    response.reset = {
      reset_id: "reset:test-0001",
      expires_at: "2026-07-23T09:00:00Z",
      effects: ["stop_service", "revoke_all_clients", "retain_audit"],
      native_confirmation_required: true,
    };
  }
  return {
    ok: true,
    status: 200,
    headers: { get: () => "application/json" },
    json: async () => response,
  };
};

const dataClientContext = {
  window: {
    location: { protocol: "http:" },
    SAPD_API_BASE: "http://synthetic.local",
  },
  fetch: controlFetch,
  URLSearchParams,
  AbortController,
  Headers,
  Blob,
  setTimeout,
  clearTimeout,
};
vm.runInNewContext(dataClientSource, dataClientContext, { filename: "dataClient.js" });
const dataClient = dataClientContext.window.sapdDataClient;
assert.equal((await dataClient.getMcpControlPanel()).data.state_version, 12, "control panel must return the D3 snapshot");
const firstControlRead = controlRequests.find((request) => request.url.endsWith("/api/v1/mcp/control-panel"));
assert.equal(firstControlRead?.options?.headers?.["X-SAPD-Session-Token"], "synthetic-local-session", "control GET must use the local session boundary");
injectForbiddenControlField = true;
await assert.rejects(() => dataClient.getMcpControlPanel(), /AI 集成请求失败/, "forbidden response fields must fail closed");
injectForbiddenControlField = false;
await dataClient.stopMcpService({ requestId: "request:stop-0001", expectedStateVersion: 12 });
await dataClient.revokeMcpClient({ requestId: "request:revoke-01", expectedStateVersion: 12, clientId: "client:test-0001" });
await dataClient.prepareMcpReset({ requestId: "request:reset-001", expectedStateVersion: 12, clearAudit: false });

const mutationRequests = controlRequests.filter((request) => request.options.method === "POST");
assert.equal(mutationRequests.length, 3, "synthetic control test must issue exactly three independent mutations");
mutationRequests.forEach((request) => {
  const body = JSON.parse(request.options.body);
  assert("request_id" in body && "expected_state_version" in body, "mutation must send idempotency and state version fields");
  assert.equal(request.options.headers["X-SAPD-Session-Token"], "synthetic-local-session", "mutation must use the existing local session boundary");
});
assert.deepEqual(
  Object.keys(JSON.parse(mutationRequests[0].options.body)).sort(),
  ["expected_state_version", "request_id"],
  "stop request must not inherit revoke or reset fields",
);
assert.deepEqual(
  Object.keys(JSON.parse(mutationRequests[1].options.body)).sort(),
  ["client_id", "expected_state_version", "request_id"],
  "revoke request must target only one client",
);
assert.deepEqual(
  Object.keys(JSON.parse(mutationRequests[2].options.body)).sort(),
  ["audit_disposition", "expected_state_version", "request_id"],
  "reset prepare request must retain its independent audit disposition",
);
await assert.rejects(() => dataClient.confirmMcpReset(), /需要桌面应用/, "Web reset confirmation must remain blocked");

let controlReadWithoutSession = false;
const missingSessionContext = {
  window: {
    location: { protocol: "http:" },
    SAPD_API_BASE: "http://synthetic.local",
  },
  fetch: async (url) => {
    if (String(url).endsWith("/api/v1/health")) {
      return {
        ok: true,
        status: 200,
        headers: { get: () => "application/json" },
        json: async () => ({ auth: { writes_require_token: true } }),
      };
    }
    controlReadWithoutSession = true;
    throw new Error("control request must not be sent without a session");
  },
  URLSearchParams,
  AbortController,
  Headers,
  Blob,
  setTimeout,
  clearTimeout,
};
vm.runInNewContext(dataClientSource, missingSessionContext, { filename: "dataClient.js" });
await assert.rejects(
  () => missingSessionContext.window.sapdDataClient.getMcpControlPanel(),
  /本地会话授权/,
  "control GET must fail closed without a session",
);
assert.equal(controlReadWithoutSession, false, "control GET reached the endpoint without a session header");

console.log(JSON.stringify({
  result: "pass",
  routes: ["/settings/basic", "/settings/ai-integration"],
  sections: sectionIds,
  syntheticMutations: mutationRequests.map((request) => new URL(request.url).pathname),
  desktopBoundary: "enforced",
}, null, 2));
