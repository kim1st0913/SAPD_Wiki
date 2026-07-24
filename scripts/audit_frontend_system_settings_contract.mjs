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
assert.match(index, /components\/SystemSettings\.js\?v=apple-shell-settings-20260724-8/);
assert.doesNotMatch(index, /AiIntegrationSettings|ai-integration-settings\.css/);
assert.ok(index.indexOf("components/SystemSettings.js") < index.indexOf("./app.js"), "settings component must load before app.js");

assert.match(shell, /data-app-route="\/settings\/system"/);
assert.match(shell, /data-app-route="\/settings\/ai-integration"/);
assert.match(shell, /MCP 状态监测/);
assert.match(shell, /MCP 服务/);
assert.match(shell, /客户端授权/);
assert.match(shell, /安全连接证书/);
assert.match(shell, /data-settings-anchor="aiCertificatePanel"/);
assert.match(shell, /最近使用/);
assert.match(shell, /License 授权/);
assert.match(shell, /licenseDanger/);
assert.match(shell, /\["expired", "trust_missing"/);
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
assert.match(app, /prepareMcpCertificateAction/);
assert.match(app, /confirmMcpCertificateAction/);
assert.match(app, /waitForMcpCertificateOperation/);
assert.match(app, /requestId: mcpRequestId/);
assert.match(app, /expectedStateVersion/);
assert.doesNotMatch(app, /sapd:mcp-configured-port:v1/);
assert.doesNotMatch(app, /readStoredMcpPort|writeStoredMcpPort|settingsMcp|updateMcpService/);
assert.match(app, /configuredPort === 5173/);

assert.match(dataClient, /"\/api\/v1\/mcp\/control-panel"/);
assert.match(dataClient, /"\/api\/v1\/mcp\/actions\/start"/);
assert.match(dataClient, /"\/api\/v1\/mcp\/actions\/stop"/);
assert.match(dataClient, /"\/api\/v1\/mcp\/certificate\/actions\/prepare"/);
assert.match(dataClient, /"\/api\/v1\/mcp\/certificate\/actions\/confirm"/);
assert.doesNotMatch(dataClient, /getMcpUiState|\/api\/v1\/mcp\/ui-state/);
assert.match(dataClient, /Number\(extra\.configured_port\) === 5173/);
assert.match(settingsCss, /\.app-shell-integrated \.topbar\s*\{\s*overflow:\s*visible;/s);
assert.match(settingsCss, /\.mcp-status-monitor:hover \.mcp-status-popover/);

const context = vm.createContext({ window: { sapdComponents: {} } });
vm.runInContext(settingsSource, context, { filename: "SystemSettings.js" });
const component = context.window.sapdComponents.SystemSettings;
const certificate = (state = "not_configured", overrides = {}) => ({
  state,
  reason_code: null,
  subject: "127.0.0.1",
  san: ["127.0.0.1"],
  trust_scope: "current_user",
  trust_backend: "fake_current_user_trust",
  secret_backend: "in_memory_test_only",
  valid_until: null,
  remaining_days: null,
  next_action: state === "not_configured" ? "certificate_provision" : null,
  ...overrides,
});

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
      control_capabilities: {
        certificate_provision: true,
        certificate_rotate: true,
        certificate_repair_trust: true,
        certificate_view_details: true,
      },
    },
    certificate: certificate(),
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
for (const label of ["AI 集成概况", "本机服务", "知识访问", "隐私审计", "最近使用", "服务与 Codex 连接", "本地端口", "服务地址", "数据访问范围", "基础知识库全部业务内容，包括完整标准正文", "5 个只读知识工具", "用户数据、源文件本体、本地路径、系统配置与凭据、日志和非受控 SQL", "AI 可以检索和使用基础知识库中的全部知识内容。知识内容仅用于查询、分析和引用，不能改变系统权限或指挥系统执行操作。", "安全连接证书", "应用私有安全目录（不可修改）", "建立本机安全连接", "客户端授权", "待确认授权", "允许", "拒绝", "复制 Codex 配置", "检查服务", "重置 AI 集成"]) {
  assert.match(aiHtml, new RegExp(label));
}
assert.doesNotMatch(aiHtml, /不可信参考数据/);
assert.doesNotMatch(aiHtml, /策略允许的公开摘要|仅策略允许的公开摘要|明确排除[^<]*完整标准正文/);
assert.ok(aiHtml.indexOf("AI 集成概况") < aiHtml.indexOf("服务与 Codex 连接"), "overview must precede runtime controls");
assert.ok(aiHtml.indexOf("数据访问范围") < aiHtml.indexOf("安全连接证书"), "data boundary must be visible before certificate details");
assert.ok(aiHtml.indexOf("安全连接证书") < aiHtml.indexOf("待确认授权"), "certificate section must precede authorization");
assert.doesNotMatch(aiHtml, /姓名|组织名称|邮箱地址|证书路径[^（]/);
assert.match(aiHtml, /data-mcp-port-form/);
assert.doesNotMatch(aiHtml.match(/<input[^>]+id="mcpConfiguredPort"[^>]*>/s)?.[0] || "", /disabled/);

const recoveryHtml = component.render({
  route: "/settings/ai-integration",
  mcp: {
    contract_version: "sapd-mcp-control-v1",
    status: {
      service_state: "error",
      recoverable_error: { code: "PORT_IN_USE", recovery_action: "change_port" },
    },
    settings: {
      configured_port: 28775,
      canonical_resource: "https://127.0.0.1:28775/mcp",
      control_capabilities: {
        service_control: false,
        port_configuration: true,
        authorization_decision: false,
        client_revocation: false,
        diagnostic_check: false,
        web_reset_confirmation: false,
      },
    },
    certificate: certificate("trust_missing", {
      next_action: "certificate_repair_trust",
      ca_display_name: "SAPD Wiki Local Dev CA 1234ABCD",
      ca_fingerprint_sha256: "AA:".repeat(31) + "AA",
      server_fingerprint_sha256: "BB:".repeat(31) + "BB",
    }),
    authorization_requests: [{
      request_id: "request-disabled-1234",
      client_id: "client-disabled-1234",
      redirect_uri: "http://127.0.0.1:34567/callback",
      scopes: ["sapd.base.knowledge.read"],
      resource: "https://127.0.0.1:28775/mcp",
    }],
    clients: [{ client_id: "client-disabled-1234", scopes: [] }],
    diagnostics: { overall_state: "blocked", checks: [] },
  },
});
assert.match(recoveryHtml, /当前端口被占用，请修改端口后重新启动/);
assert.doesNotMatch(recoveryHtml.match(/<input[^>]+id="mcpConfiguredPort"[^>]*>/s)?.[0] || "", /disabled/);
for (const selector of [
  /data-mcp-settings-action="retry"[^>]*disabled/,
  /data-mcp-settings-action="check"[^>]*disabled/,
  /data-mcp-authorization-action="allow"[^>]*disabled/,
  /data-mcp-request-confirmation="revoke"[^>]*disabled/,
  /data-mcp-action="prepare-reset"[^>]*disabled/,
]) {
  assert.match(recoveryHtml, selector);
}
assert.match(recoveryHtml, /修复安全连接/);

const rotatingHtml = component.render({
  route: "/settings/ai-integration",
  mcp: {
    contract_version: "sapd-mcp-control-v1",
    status: { service_state: "stopped" },
    settings: {
      control_capabilities: {
        certificate_view_details: true,
        web_reset_confirmation: true,
      },
    },
    certificate: certificate("valid", {
      operation: {
        operation_id: "operation-12345678",
        state: "running",
        phase: "retiring",
      },
      cleanup_pending: true,
      client_restart_required: true,
      old_generation_retained_until: "2026-07-25T10:00:00Z",
      valid_from: "2026-07-24T10:00:00Z",
    }),
    clients: [],
    diagnostics: { overall_state: "ready", checks: [] },
  },
});
for (const label of ["旧证书暂时保留用于安全回退", "按原指纹自动清理", "AI 客户端重新建立连接", "安全保管", "生效时间"]) {
  assert.match(rotatingHtml, new RegExp(label));
}

const previewHtml = component.render({
  route: "/settings/ai-integration",
  mcp: {
    contract_version: "sapd-mcp-control-v1",
    status: { service_state: "stopped" },
    settings: { control_capabilities: { certificate_provision: true, certificate_view_details: true } },
    certificate: certificate(),
    clients: [],
    diagnostics: { overall_state: "unknown", checks: [] },
  },
  certificatePreview: {
    confirmation_id: "certificate-confirmation-1234",
    action: "certificate_provision",
    effects: ["create_managed_identity", "install_current_user_trust"],
  },
});
for (const label of ["不需要填写姓名、组织、邮箱、路径或有效期", "127.0.0.1", "当前用户", "365 天", "生成并建立信任"]) {
  assert.match(previewHtml, new RegExp(label));
}
const certificateDialogHtml = previewHtml.slice(previewHtml.indexOf('data-mcp-dialog'));
assert.doesNotMatch(certificateDialogHtml, /<input|<select|<textarea/);

const sentinelHtml = component.render({
  route: "/settings/ai-integration",
  mcp: null,
});
for (const forbidden of ["token-secret-sentinel", "private-key-sentinel", "passphrase-reference-sentinel", "absolute-path-sentinel", "raw-log-sentinel"]) {
  assert.doesNotMatch(sentinelHtml, new RegExp(forbidden));
}

console.log("system settings frontend contract: PASS");
