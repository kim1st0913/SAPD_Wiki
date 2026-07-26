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
assert.match(index, /components\/SystemSettings\.js\?v=apple-shell-settings-20260726-15-layout/);
assert.match(index, /app\.js\?v=[^"]*apple-shell-settings-20260725-8-scroll-retention/);
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
assert.match(shell, /target\.isEqualNode\(next\)/);
assert.match(shell, /target\.replaceWith\(next\)/);
assert.doesNotMatch(shell, /target\.outerHTML\s*=/);
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
assert.match(app, /function settingsScrollSnapshot\(\)/);
assert.match(app, /function restoreSettingsScroll\(snapshot\)/);
assert.match(app, /page !== snapshot\.page/);
assert.match(app, /restoreSettingsScroll\(scrollSnapshot\)/);
assert.match(app, /function syncSettingsSilently\(html\)/);
assert.match(app, /currentSection\.isEqualNode\(nextSection\)/);
assert.match(app, /currentSection\.replaceWith\(nextSection\)/);
assert.match(app, /renderSettings\(\{ silent \}\)/);

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
    audit: {
      enabled: true,
      state: "ready",
      event_count: 3,
      last_event_at: "2026-07-25T00:25:22Z",
      retention_days: 30,
      recent_events: [
        { occurred_at: "2026-07-25T00:25:22Z", event_type: "TOOL_CALL", client_id: "client-12345678", tool_name: "search_knowledge", result_code: "OK", returned_count: 3, duration_ms: 12 },
        { occurred_at: "2026-07-25T00:24:22Z", event_type: "TOKEN_ISSUED", client_id: "client-12345678", tool_name: null, result_code: "OK", returned_count: null, duration_ms: null },
        { occurred_at: "2026-07-25T00:23:22Z", event_type: "AUTHORIZATION_APPROVED", client_id: "client-12345678", tool_name: null, result_code: "OK", returned_count: null, duration_ms: null },
      ],
    },
    diagnostics: { overall_state: "unknown", last_checked_at: null, checks: [] },
  },
});
for (const label of ["AI 集成概况", "本机服务", "知识访问", "连接检查", "尚未检查", "立即检查", "需要您的确认", "查看授权请求", "Authentication complete", "待确认授权", "发布方未验证", "只读访问基础知识库", "允许只读访问", "查看技术信息", "MCP 连接配置", "本地端口", "服务地址", "基础知识库全部业务内容，包括完整标准正文", "5 个只读知识工具", "用户数据、源文件本体、本地路径、系统配置与凭据、日志和非受控 SQL", "AI 可以检索和使用基础知识库中的全部知识内容。知识内容仅用于查询、分析和引用，不能改变系统权限或指挥系统执行操作。", "安全连接证书", "应用私有安全目录（不可修改）", "建立本机安全连接", "客户端授权", "拒绝", "复制连接配置", "隐私与审计", "维护操作", "重置 AI 集成"]) {
  assert.match(aiHtml, new RegExp(label));
}
assert.equal((aiHtml.match(/<dt(?: id="aiKnowledgeAccessTitle")?>(本机服务|客户端授权|连接检查|知识访问)<\/dt>/g) || []).length, 4, "overview must contain three compact states and one knowledge cell");
assert.match(aiHtml, /class="system-settings-overview-grid"[\s\S]*class="system-settings-overview-diagnostic"[\s\S]*class="system-settings-overview-knowledge"[\s\S]*id="aiKnowledgeAccessTitle"/);
assert.doesNotMatch(aiHtml, /system-settings-overview-checks|查看连接检查结果/);
assert.doesNotMatch(aiHtml, /system-settings-overview-access/);
assert.doesNotMatch(aiHtml, /<dt>知识访问<\/dt>|数据访问范围|aiDataAccessTitle/);
assert.doesNotMatch(aiHtml, /class="system-settings-panel system-settings-data-access"/);
assert.doesNotMatch(aiHtml, /<dt>隐私审计<\/dt>|<dt>最近使用<\/dt>/);
assert.match(aiHtml, /class="system-settings-ai-connection-grid"[\s\S]*id="aiRuntimeTitle"[\s\S]*id="aiCertificateTitle"/);
for (const section of ["overview", "authorization-attention", "authorization-requests", "connection", "clients", "audit", "maintenance"]) {
  assert.match(aiHtml, new RegExp(`data-settings-section="${section}"`));
}
assert.doesNotMatch(aiHtml, /system-settings-ai-primary|system-settings-ai-secondary/);
assert.match(aiHtml, /class="system-settings-client-empty"[\s\S]*启动 MCP 服务[\s\S]*复制连接配置并添加到客户端[\s\S]*返回本页确认授权请求/);
assert.equal((aiHtml.match(/<time datetime=/g) || []).length, 3, "audit must show the latest three events");
assert.match(aiHtml, /最近记录/);
assert.match(aiHtml, /知识工具调用/);
assert.doesNotMatch(aiHtml, /system-settings-ai-secondary-side/);
assert.equal((aiHtml.match(/data-mcp-settings-action="check"/g) || []).length, 1, "connection check must have one entry point");
assert.doesNotMatch(aiHtml, /aria-label="客户端授权摘要"|data-settings-anchor="aiAuthorizationPanel">处理授权|data-settings-anchor="aiClientsPanel">查看授权/);
assert.match(aiHtml, /id="aiAuthorizationPanel"[^>]*tabindex="-1"/);
assert.match(aiHtml, /id="aiClientsPanel"[^>]*tabindex="-1"/);
assert.ok(aiHtml.indexOf("连接检查") < aiHtml.indexOf("MCP 连接配置"), "connection check must stay in the overview");
assert.ok(aiHtml.indexOf("维护操作") > aiHtml.indexOf("隐私与审计"), "reset must stay in the final maintenance area");
assert.doesNotMatch(aiHtml, /不可信参考数据/);
assert.doesNotMatch(aiHtml, /策略允许的公开摘要|仅策略允许的公开摘要|明确排除[^<]*完整标准正文/);
assert.ok(aiHtml.indexOf("AI 集成概况") < aiHtml.indexOf("MCP 连接配置"), "overview must precede runtime controls");
assert.ok(aiHtml.indexOf("待确认授权") < aiHtml.indexOf("MCP 连接配置"), "pending authorization must be visible before secondary settings");
assert.ok(aiHtml.indexOf('id="aiKnowledgeAccessTitle"') < aiHtml.indexOf("安全连接证书"), "knowledge boundary must be visible before certificate details");
assert.ok(aiHtml.indexOf("待确认授权") < aiHtml.indexOf("安全连接证书"), "pending authorization must precede certificate details");
assert.doesNotMatch(aiHtml, /姓名|组织名称|邮箱地址|证书路径[^（]/);
assert.match(aiHtml, /data-mcp-port-form/);
assert.doesNotMatch(aiHtml.match(/<input[^>]+id="mcpConfiguredPort"[^>]*>/s)?.[0] || "", /disabled/);

const revokedOnlyHtml = component.render({
  route: "/settings/ai-integration",
  mcp: {
    contract_version: "sapd-mcp-control-v1",
    status: { service_state: "ready", authorization_state: "revoked" },
    settings: { control_capabilities: { client_revocation: true } },
    certificate: certificate("valid"),
    clients: [{
      client_id: "client-revoked-0001",
      display_name: "已撤销客户端",
      trust_state: "verified",
      scopes: ["sapd.base.knowledge.read"],
      authorized_at: "2026-07-25T00:25:22Z",
      last_used_at: null,
      status: "revoked",
    }],
    audit: { event_count: 0, recent_events: [] },
  },
});
assert.match(revokedOnlyHtml, /class="system-settings-client-empty"/);
assert.match(revokedOnlyHtml, /尚未连接 MCP 客户端/);
assert.doesNotMatch(revokedOnlyHtml, /client-revoked-0001|data-mcp-request-confirmation="revoke"/);

const authorizedHtml = component.render({
  route: "/settings/ai-integration",
  mcp: {
    contract_version: "sapd-mcp-control-v1",
    status: { service_state: "ready", authorization_state: "authorized" },
    settings: { control_capabilities: { client_revocation: true } },
    certificate: certificate("valid"),
    clients: [{
      client_id: "client-active-0001",
      display_name: "Codex",
      trust_state: "verified",
      scopes: ["sapd.base.knowledge.read"],
      authorized_at: "2026-07-25T00:25:22Z",
      last_used_at: null,
      status: "authorized",
    }],
    audit: { event_count: 0, recent_events: [] },
  },
});
assert.match(authorizedHtml, /data-mcp-client-id="client-active-0001"/);
assert.match(authorizedHtml, /class="system-settings-client-table"[\s\S]*class="system-settings-client-table-head"[\s\S]*class="system-settings-client-list"[\s\S]*class="system-settings-revoke-button"[^>]*>撤销授权<\/button>/);
assert.match(authorizedHtml, /发布方已验证/);
assert.match(authorizedHtml, /基础知识库（只读）/);
assert.match(authorizedHtml, /role="columnheader">客户端<\/span>[\s\S]*role="columnheader">访问范围<\/span>[\s\S]*role="columnheader">使用记录<\/span>[\s\S]*role="columnheader">操作<\/span>/);
assert.doesNotMatch(authorizedHtml, /<th>客户端<\/th>|<th>最近使用<\/th>|<svg/);
assert.match(settingsCss, /\.system-settings-ai-connection-grid\s*\{[^}]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/s);
assert.match(aiHtml, /class="system-settings-overview-service"[\s\S]*class="system-settings-overview-authorization"/);
assert.match(settingsCss, /\.system-settings-overview-grid\s*\{[^}]*grid-template-areas:\s*"service diagnostic knowledge"\s*"authorization diagnostic knowledge"/s);
assert.match(settingsCss, /\.system-settings-overview-service\s*\{[^}]*grid-area:\s*service/s);
assert.match(settingsCss, /\.system-settings-overview-authorization\s*\{[^}]*grid-area:\s*authorization/s);
assert.match(settingsCss, /\.system-settings-overview-diagnostic\s*\{[^}]*grid-area:\s*diagnostic/s);
assert.match(settingsCss, /\.system-settings-overview-knowledge\s*\{[^}]*grid-area:\s*knowledge/s);
assert.match(settingsCss, /\.system-settings-revoke-button\s*\{[^}]*white-space:\s*nowrap/s);
assert.match(settingsCss, /\.system-settings-authorization-attention\s*\{[^}]*position:\s*sticky/s);

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
    diagnostics: {
      overall_state: "blocked",
      last_checked_at: "2026-07-24T09:00:00Z",
      checks: [
        { check_id: "sidecar_process", label: "MCP 本机服务", status: "pass", recovery_action: null },
        { check_id: "tls_connection", label: "本机安全连接", status: "fail", recovery_action: "retry_service" },
      ],
    },
  },
});
assert.match(recoveryHtml, /当前端口被占用，请修改端口后重新启动/);
assert.match(recoveryHtml, /class="system-settings-overview-diagnostic"[\s\S]*class="system-settings-overview-diagnostics"[\s\S]*MCP 本机服务[\s\S]*本机安全连接[\s\S]*class="system-settings-overview-knowledge"/);
assert.doesNotMatch(recoveryHtml, /system-settings-overview-checks|查看连接检查结果/);
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
    diagnostics: { overall_state: "ready", last_checked_at: "2026-07-24T09:00:00Z", checks: [] },
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
    diagnostics: { overall_state: "unknown", last_checked_at: null, checks: [] },
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
