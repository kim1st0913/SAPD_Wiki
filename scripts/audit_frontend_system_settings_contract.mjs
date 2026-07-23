#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");

const index = read("frontend/capability-browser/index.html");
const app = read("frontend/capability-browser/app.js");
const shell = read("frontend/capability-browser/components/AppShell.js");
const dataClient = read("frontend/capability-browser/dataClient.js");
const settingsSource = read("frontend/capability-browser/components/SystemSettings.js");
const settingsCss = read("frontend/capability-browser/system-settings.css");

assert.match(index, /id="settingsWorkspace"/);
assert.match(index, /system-settings\.css\?v=/);
assert.match(index, /components\/SystemSettings\.js\?v=/);
assert.doesNotMatch(index, /AiIntegrationSettings|ai-integration-settings\.css/);
assert.ok(index.indexOf("components/SystemSettings.js") < index.indexOf("./app.js"), "settings component must load before app.js");

assert.match(shell, /data-app-route="\/settings\/system"/);
assert.match(shell, /data-app-route="\/settings\/ai-integration"/);
assert.match(shell, /MCP 状态监测/);
assert.match(shell, /MCP 链接状态/);
assert.match(shell, /客户端授权/);
assert.match(shell, /License 授权状态/);
assert.match(shell, /function backRouteFor/);
assert.match(shell, /默认返回全局导航/);
assert.match(shell, /"\/settings\/basic": \{ view: "settings", settingsPage: "system", canonicalRoute: "\/settings\/system" \}/);

assert.match(app, /window\.sapdDesktop\?\.getSettings/);
assert.match(app, /chooseDataRoot/);
assert.match(app, /chooseImportDirectory/);
assert.match(app, /chooseDownloadDirectory/);
assert.match(app, /startMcpService/);
assert.match(app, /stopMcpService/);
assert.match(app, /updateMcpPort/);
assert.match(app, /requestId: mcpRequestId/);
assert.match(app, /expectedStateVersion/);
assert.doesNotMatch(app, /sapd:mcp-configured-port:v1/);

assert.match(dataClient, /"\/api\/v1\/mcp\/control-panel"/);
assert.match(dataClient, /"\/api\/v1\/mcp\/actions\/start"/);
assert.match(dataClient, /"\/api\/v1\/mcp\/actions\/stop"/);
assert.match(settingsCss, /\.app-shell-integrated \.topbar\s*\{\s*overflow:\s*visible;/s);
assert.match(settingsCss, /\.mcp-status-monitor:hover \.mcp-status-popover/);

const context = vm.createContext({ window: { sapdComponents: {} } });
vm.runInContext(settingsSource, context, { filename: "SystemSettings.js" });
const component = context.window.sapdComponents.SystemSettings;

const systemHtml = component.render({
  route: "/settings/system",
  system: {
    currentVersion: "0.2.0",
    dataRoot: "/tmp/SAPDWiki",
    importDirectory: "/tmp/SAPDWiki/import",
    downloadDirectory: "/tmp/SAPDWiki/export",
  },
});
for (const label of ["当前版本", "App 保存位置", "文件上传路径", "文件下载路径"]) {
  assert.match(systemHtml, new RegExp(label));
}

const aiHtml = component.render({
  route: "/settings/ai-integration",
  mcp: {
    contract_version: "sapd-mcp-control-v1",
    status: { service_state: "stopped" },
    settings: {
      release_channel: "dev",
      configured_port: 28775,
      canonical_resource: "https://127.0.0.1:28775/mcp",
    },
    authorization_requests: [{
      request_id: "request-12345678",
      client_name: "自有测试客户端",
      client_id: "client-12345678",
      redirect_uri: "http://127.0.0.1:34567/callback",
      scopes: ["sapd.public.read"],
      resource: "https://127.0.0.1:28775/mcp",
      policy_version: "policy-v1",
      expires_at: "2026-07-23T12:00:00Z",
    }],
    clients: [],
    diagnostics: { overall_state: "unknown", checks: [] },
  },
});
for (const label of ["本地运行配置", "本地端口", "服务地址", "客户端授权", "待确认授权", "允许", "拒绝", "复制 Codex 配置", "检查服务"]) {
  assert.match(aiHtml, new RegExp(label));
}
assert.match(aiHtml, /data-mcp-port-form/);
assert.doesNotMatch(aiHtml.match(/<input[^>]+id="mcpConfiguredPort"[^>]*>/s)?.[0] || "", /disabled/);

const sentinelHtml = component.render({
  route: "/settings/ai-integration",
  mcp: null,
});
for (const forbidden of ["token-secret-sentinel", "private-key-sentinel", "raw-log-sentinel"]) {
  assert.doesNotMatch(sentinelHtml, new RegExp(forbidden));
}

console.log("system settings frontend contract: PASS");
