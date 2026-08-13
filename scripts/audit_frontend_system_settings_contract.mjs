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

assert.equal(index.match(/id="settingsWorkspace"/g)?.length, 1, "settings workspace id must be unique");
assert.match(index, /system-settings\.css\?v=/);
assert.match(index, /components\/SystemSettings\.js\?v=/);
assert.match(index, /system-settings\.css\?v=apple-shell-settings-20260726-21-privacy-audit-tab-workbuddy-guide-20260729-1/);
assert.match(index, /components\/SystemSettings\.js\?v=apple-shell-settings-20260727-22-audit-event-groups-workbuddy-guide-20260729-1/);
assert.match(index, /app\.js\?v=[^"]*workbuddy-guide-20260729-1/);
assert.doesNotMatch(index, /AiIntegrationSettings|ai-integration-settings\.css/);
assert.ok(index.indexOf("components/SystemSettings.js") < index.indexOf("./app.js"), "settings component must load before app.js");

assert.match(shell, /data-app-route="\/settings\/system"/);
assert.match(shell, /data-app-route="\/settings\/ai-integration"/);
assert.match(shell, /route: "\/settings\/privacy-audit"/);
assert.match(shell, /"\/settings\/privacy-audit": \{ view: "settings", settingsPage: "privacy-audit" \}/);
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
assert.match(app, /function settingsActiveEditor\(section, activeElement\)/);
assert.match(app, /matchingButtons\[0\]\.focus\(\{ preventScroll: true \}\)/);
assert.match(app, /renderSettings\(\{ silent \}\)/);
assert.match(app, /text\(settingsPaths\.user_home\)\.trim\(\)/);
assert.match(app, /text\(settingsPaths\.runtime_root\)\.trim\(\)/);
assert.match(app, /inlineStatusSelector:\s*"\[data-workbuddy-copy-status\]"/);
assert.match(app, /announceInline\("success", successMessage\)/);
assert.match(app, /visibleStateChanged/);
assert.match(app, /data-mcp-audit-page/);
assert.match(app, /const auditPage = auditPayload\?\.data;/);
assert.match(app, /const requestedAuditPage = state\.mcpAuditPage;/);
assert.match(app, /Number\(state\.mcpAuditPage\) !== Number\(state\.mcpControlSnapshot\?\.audit\?\.page\)/);

assert.match(dataClient, /"\/api\/v1\/mcp\/control-panel"/);
assert.match(dataClient, /"\/api\/v1\/mcp\/audit"/);
assert.match(dataClient, /getMcpAuditPage/);
assert.match(dataClient, /"\/api\/v1\/mcp\/actions\/start"/);
assert.match(dataClient, /"\/api\/v1\/mcp\/actions\/stop"/);
assert.match(dataClient, /"\/api\/v1\/mcp\/certificate\/actions\/prepare"/);
assert.match(dataClient, /"\/api\/v1\/mcp\/certificate\/actions\/confirm"/);
assert.doesNotMatch(dataClient, /getMcpUiState|\/api\/v1\/mcp\/ui-state/);
assert.match(dataClient, /Number\(extra\.configured_port\) === 5173/);
assert.match(settingsCss, /\.app-shell-integrated \.topbar\s*\{\s*overflow:\s*visible;/s);
assert.match(settingsCss, /\.mcp-status-monitor:hover \.mcp-status-popover/);
assert.match(settingsSource, /macos_web_dev_keychain:\s*"macOS 登录钥匙串（开发环境）"/);
assert.match(settingsSource, /unlock_keychain:\s*"请解锁 macOS“登录”钥匙串后重试"/);
assert.match(settingsSource, /SECRET_STORE_UNAVAILABLE:[^,\n]*钥匙串当前不可用/);
assert.match(settingsSource, /SECRET_AUTH_OR_ACCESS_DENIED:[^,\n]*修复访问权限/);
assert.match(app, /SECRET_STORE_UNAVAILABLE:[^,\n]*钥匙串当前不可用/);
assert.match(app, /SECRET_AUTH_OR_ACCESS_DENIED:[^,\n]*修复访问权限/);
const confirmCertificateActionSource = app.match(
  /async function confirmMcpCertificateAction\(\) \{[\s\S]*?\n\}\n\nasync function performMcpControlAction/,
)?.[0] || "";
assert.match(
  confirmCertificateActionSource,
  /preview\.action === "certificate_repair_secret_access"[\s\S]*钥匙串访问权限修复未生效；原证书、口令和客户端授权均未改变。请查看诊断信息或重新执行“修复访问权限”/,
);
assert.ok(
  confirmCertificateActionSource.indexOf("钥匙串访问权限修复未生效")
    < confirmCertificateActionSource.indexOf("恢复或重置 AI 集成"),
  "access repair must use its neutral failure message before the generic certificate reset guidance",
);

const context = vm.createContext({ window: { sapdComponents: {} } });
vm.runInContext(settingsSource, context, { filename: "SystemSettings.js" });
const component = context.window.sapdComponents.SystemSettings;
const certificate = (state = "not_configured", overrides = {}) => ({
  state,
  profile: "dev",
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
        certificate_repair_secret_access: true,
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
      event_count: 4,
      last_event_at: "2026-07-25T00:25:22Z",
      retention_days: 30,
      max_events: 100,
      retention_bytes: 20 * 1024 * 1024,
      display_limit: 30,
      page: 1,
      page_size: 10,
      page_count: 1,
      recent_events: [
        { occurred_at: "2026-07-25T00:25:22Z", first_occurred_at: "2026-07-25T00:20:22Z", last_occurred_at: "2026-07-25T00:25:22Z", occurrence_count: 2, event_type: "TOOL_CALL", client_id: "client-12345678", tool_name: "search_knowledge", result_code: "OK", returned_count: 5, duration_ms: 20 },
        { occurred_at: "2026-07-25T00:24:22Z", event_type: "TOKEN_ISSUED", client_id: "client-12345678", tool_name: null, result_code: "OK", returned_count: null, duration_ms: null },
        { occurred_at: "2026-07-25T00:23:22Z", event_type: "CLIENT_REGISTERED", client_id: "client-12345678", tool_name: null, result_code: "DCR_UNVERIFIED", returned_count: null, duration_ms: null },
      ],
    },
    diagnostics: { overall_state: "unknown", last_checked_at: null, checks: [] },
  },
});
const privacyAuditHtml = component.render({
  route: "/settings/privacy-audit",
  mcp: {
    contract_version: "sapd-mcp-control-v1",
    settings: { control_capabilities: { audit_clear: true } },
    clients: [],
    audit: {
      enabled: true,
      state: "ready",
      event_count: 4,
      last_event_at: "2026-07-25T00:25:22Z",
      retention_days: 30,
      max_events: 100,
      retention_bytes: 20 * 1024 * 1024,
      display_limit: 30,
      page: 1,
      page_size: 10,
      page_count: 1,
      recent_events: [
        { occurred_at: "2026-07-25T00:25:22Z", first_occurred_at: "2026-07-25T00:20:22Z", last_occurred_at: "2026-07-25T00:25:22Z", occurrence_count: 2, event_type: "TOOL_CALL", client_id: "client-12345678", tool_name: "search_knowledge", result_code: "OK", returned_count: 5, duration_ms: 20 },
        { occurred_at: "2026-07-25T00:24:22Z", event_type: "TOKEN_ISSUED", client_id: "client-12345678", tool_name: null, result_code: "OK", returned_count: null, duration_ms: null },
        { occurred_at: "2026-07-25T00:23:22Z", event_type: "CLIENT_REGISTERED", client_id: "client-12345678", tool_name: null, result_code: "DCR_UNVERIFIED", returned_count: null, duration_ms: null },
      ],
    },
  },
});
for (const label of ["AI 集成概况", "本机服务", "知识访问", "连接检查", "尚未检查", "立即检查", "需要您的确认", "查看授权请求", "Authentication complete", "待确认授权", "动态注册", "只读访问基础知识库", "允许只读访问", "查看技术信息", "MCP 连接配置", "本地端口", "服务地址", "基础知识库全部业务内容，包括完整标准正文", "5 个只读知识工具", "用户数据、源文件本体、本地路径、系统配置与凭据、日志和非受控 SQL", "AI 可以检索和使用基础知识库中的全部知识内容。知识内容仅用于查询、分析和引用，不能改变系统权限或指挥系统执行操作。", "安全连接证书", "证书目录", "~/Library/Application Support/SAPD Wiki/LocalMCP/Certificates/dev", "建立本机安全连接", "客户端授权", "拒绝", "复制 HTTP Stream 地址", "WorkBuddy 配置引导", "隐私与审计", "维护操作", "重置 AI 集成"]) {
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
for (const section of ["overview", "authorization-attention", "authorization-requests", "connection", "clients", "maintenance"]) {
  assert.match(aiHtml, new RegExp(`data-settings-section="${section}"`));
}
assert.doesNotMatch(aiHtml, /data-settings-section="audit"/);
assert.match(privacyAuditHtml, /data-settings-page="privacy-audit"/);
assert.match(privacyAuditHtml, /data-settings-section="audit-policy"/);
assert.match(privacyAuditHtml, /data-settings-section="audit"/);
assert.doesNotMatch(aiHtml, /system-settings-ai-primary|system-settings-ai-secondary/);
assert.match(aiHtml, /class="system-settings-client-empty"[\s\S]*启动 MCP 服务[\s\S]*复制 HTTP Stream 地址或打开 WorkBuddy 配置引导[\s\S]*返回本页确认授权请求/);
assert.match(aiHtml, /data-mcp-copy-url="https:\/\/127\.0\.0\.1:28775\/mcp"[^>]*>复制 HTTP Stream 地址<\/button>\s*<button[^>]*data-mcp-workbuddy-guide="https:\/\/127\.0\.0\.1:28775\/mcp"[^>]*>WorkBuddy 配置引导<\/button>/);
assert.doesNotMatch(aiHtml, /复制连接配置|复制 MCP 地址|data-mcp-copy-config/);
assert.equal((privacyAuditHtml.match(/<time datetime=/g) || []).length, 3, "audit page must render the available events");
assert.match(privacyAuditHtml, /最近记录/);
for (const auditLabel of ["隐私边界", "存储与自动清理", "独立 MCP 控制库", "30 天、100 条或 20MB", "只查询最近 30 条，每页读取 10 条并合并相似事件", "搜索知识库（2 次）", "累计返回 5 条", "累计用时 20 毫秒", "本页合并为 3 组", "底层审计仍逐条保留", "授权、撤销、失败和异常事件不合并", "已为授权客户端签发短期访问凭据", "客户端已完成动态注册，等待用户确认", "发布方未验证", "不保存用户问题、搜索词或知识正文"]) {
  assert.match(privacyAuditHtml, new RegExp(auditLabel));
}
assert.doesNotMatch(privacyAuditHtml, /未记录查询正文|DCR_UNVERIFIED|search_knowledge/);
assert.match(privacyAuditHtml, /class="system-settings-audit-pagination"/);
assert.equal((privacyAuditHtml.match(/data-mcp-audit-page=/g) || []).length, 2, "audit pagination must have previous and next controls");
assert.doesNotMatch(aiHtml, /system-settings-ai-secondary-side/);
assert.equal((aiHtml.match(/data-mcp-settings-action="check"/g) || []).length, 1, "connection check must have one entry point");
assert.doesNotMatch(aiHtml, /aria-label="客户端授权摘要"|data-settings-anchor="aiAuthorizationPanel">处理授权|data-settings-anchor="aiClientsPanel">查看授权/);
assert.match(aiHtml, /data-app-route="\/settings\/ai-integration" data-settings-anchor="aiAuthorizationPanel">查看授权请求<\/button>/);
assert.doesNotMatch(aiHtml, /href="#aiAuthorizationPanel"/);
assert.match(aiHtml, /id="aiAuthorizationPanel"[^>]*tabindex="-1"/);
assert.match(aiHtml, /id="aiClientsPanel"[^>]*tabindex="-1"/);
assert.ok(aiHtml.indexOf("连接检查") < aiHtml.indexOf("MCP 连接配置"), "connection check must stay in the overview");
assert.match(aiHtml, /维护操作/);
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
assert.match(authorizedHtml, /预注册客户端/);
assert.match(authorizedHtml, /未验证其软件发布方身份/);
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

const temporarilyLockedHtml = component.render({
  route: "/settings/ai-integration",
  mcp: {
    contract_version: "sapd-mcp-control-v1",
    status: { service_state: "ready" },
    settings: {
      control_capabilities: {
        certificate_view_details: true,
        web_reset_confirmation: true,
      },
    },
    certificate: certificate("error", {
      reason_code: "CERTIFICATE_SECRET_STORE_UNAVAILABLE",
      next_action: "certificate_view_details",
    }),
    clients: [],
    diagnostics: { overall_state: "ready", last_checked_at: null, checks: [] },
  },
});
assert.match(temporarilyLockedHtml, /安全存储暂不可用/);
assert.match(temporarilyLockedHtml, /已运行的 MCP 会保持服务，请完成系统解锁后重试/);
assert.doesNotMatch(temporarilyLockedHtml, /重置 AI 集成并重新初始化/);

const accessDeniedHtml = component.render({
  route: "/settings/ai-integration",
  mcp: {
    contract_version: "sapd-mcp-control-v1",
    status: {
      service_state: "error",
      recoverable_error: {
        code: "KEY_STORE_ACCESS_DENIED",
        recovery_action: "repair_keychain_access",
      },
    },
    settings: {
      control_capabilities: {
        certificate_repair_secret_access: true,
        certificate_view_details: true,
      },
    },
    certificate: certificate("error", {
      reason_code: "CERTIFICATE_SECRET_ACCESS_DENIED",
      next_action: "certificate_repair_secret_access",
    }),
    clients: [],
    diagnostics: { overall_state: "blocked", last_checked_at: null, checks: [] },
  },
});
assert.match(accessDeniedHtml, /钥匙串访问被拒绝/);
assert.match(accessDeniedHtml, /data-mcp-certificate-action="certificate_repair_secret_access"/);
assert.match(accessDeniedHtml, /修复访问权限/);
assert.doesNotMatch(accessDeniedHtml, /解锁 macOS“登录”钥匙串/);
assert.doesNotMatch(accessDeniedHtml, /重置 AI 集成并重新初始化/);

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

const workbuddyGuideHtml = component.render({
  route: "/settings/ai-integration",
  system: {
    userHome: "/Users/tester",
    dataRoot: "/Users/tester/Library/Application Support/SAPDWiki",
    runtimeRoot: "/Users/tester/Library/Application Support/SAPDWiki/Runtime",
    importDirectory: "/Users/tester/Documents/SAPDWiki/import",
    downloadDirectory: "/Users/tester/Documents/SAPDWiki/export",
  },
  mcp: {
    contract_version: "sapd-mcp-control-v1",
    status: { service_state: "ready" },
    settings: {
      release_channel: "dev",
      configured_port: 28775,
      canonical_resource: "https://127.0.0.1:28775/mcp",
      control_capabilities: {},
    },
    certificate: certificate("valid", {
      ca_fingerprint_sha256: "AA:BB:CC:DD",
    }),
    clients: [],
    diagnostics: { overall_state: "ready", last_checked_at: null, checks: [] },
  },
  workbuddyGuide: true,
});
for (const label of ["WorkBuddy 配置引导", "按以下 4 步完成 WorkBuddy 配置", "1. 生成连接证书", "2. 核对 JSON 模板", "3. 复制配置提示词", "4. 重启并授权", "mcpServers", "stdio", "/opt/homebrew/bin", "/usr/local/bin", "mcp-remote@0.1.38", "http-only", "https://127.0.0.1:28775/mcp", "NODE_EXTRA_CA_CERTS", "/Users/tester/.workbuddy/certs/sapd-wiki-app-ca.pem", "MCP_REMOTE_CONFIG_DIR", "PATH", "已完成。WorkBuddy 只会复制 CA 证书，不会接触服务端私钥", "读取 SAPD Wiki 当前证书清单", "active-manifest.json", "ca_relative_path", "ca_fingerprint_sha256", "server_key_relative_path", "不要关闭 TLS 校验", "AA:BB:CC:DD", "__NPX_ABSOLUTE_PATH__", "__NODE_BIN__", "最终文件中不得保留占位符或使用 ~", "如果出现 OAuth 地址或等待授权状态", "不要删除已有 token", "返回本页确认 OAuth 只读授权", "复制 JSON 模板", "复制配置提示词", "创建带时间戳的备份", "保留其他所有 MCP 配置", "不要替我批准 OAuth"]) {
  assert.match(workbuddyGuideHtml, new RegExp(label));
}
assert.match(workbuddyGuideHtml, /\/Users\/tester\/Library\/Application Support\/SAPD Wiki\/LocalMCP\/Certificates\/dev\/active-manifest\.json/);
assert.doesNotMatch(workbuddyGuideHtml, /\/Users\/tester\/Library\/Application Support\/SAPDWiki\/Runtime\/data\/mcp\/certificates\/active-manifest\.json/);
assert.match(workbuddyGuideHtml, /\/Users\/tester\/\.workbuddy\/binaries\/node\/versions\/\*\/bin/);
assert.match(workbuddyGuideHtml, /&quot;PATH&quot;:\s*&quot;__NODE_BIN__:\/opt\/homebrew\/bin:\/usr\/local\/bin:\/usr\/bin:\/bin:\/usr\/sbin:\/sbin&quot;/);
assert.doesNotMatch(workbuddyGuideHtml, /&quot;3334&quot;/);
assert.match(workbuddyGuideHtml, /data-mcp-action="close-workbuddy-guide"/);
assert.match(workbuddyGuideHtml, /data-mcp-copy-workbuddy/);
assert.match(workbuddyGuideHtml, /data-mcp-copy-workbuddy-prompt/);
assert.doesNotMatch(workbuddyGuideHtml, /class="is-primary"[^>]*data-mcp-copy-workbuddy(?:-prompt)?/);
assert.match(workbuddyGuideHtml, /data-workbuddy-prompt/);
assert.match(workbuddyGuideHtml, /data-workbuddy-copy-status/);
assert.equal((workbuddyGuideHtml.match(/<details class="system-settings-workbuddy-copy-section">/g) || []).length, 2);
assert.match(workbuddyGuideHtml, /<summary><span><strong>2\. 核对 JSON 模板<\/strong><small>确认端口和 CA 路径；Node 路径由提示词自动填写<\/small><\/span><\/summary>/);
assert.match(workbuddyGuideHtml, /<summary><span><strong>3\. 复制配置提示词<\/strong><small>交给 WorkBuddy 自动完成配置<\/small><\/span><\/summary>/);
assert.doesNotMatch(workbuddyGuideHtml, /<details class="system-settings-workbuddy-copy-section" open>/);
assert.match(settingsCss, /\.system-settings-workbuddy-copy-section summary::after\s*\{[^}]*content:\s*"展开"/s);
assert.match(settingsCss, /\.system-settings-workbuddy-copy-section\[open\] summary::after\s*\{[^}]*content:\s*"收起"/s);
assert.match(settingsCss, /\.system-settings-dialog\s*\{[^}]*background:\s*var\(--panel,\s*#fff\)/s);
assert.match(settingsCss, /\.system-settings-dialog button\s*\{[^}]*background:\s*var\(--panel,\s*#fff\)/s);
assert.match(settingsCss, /\.system-settings-workbuddy-copy-section\s*\{[^}]*background:\s*var\(--surface-quiet,\s*#f4f7fb\)/s);
assert.match(settingsCss, /\.system-settings-workbuddy-copy-section summary > span\s*\{[^}]*display:\s*grid/s);
assert.match(settingsCss, /\.system-settings-workbuddy-certificate,\s*[\s\S]*\.system-settings-workbuddy-step,\s*[\s\S]*\.system-settings-workbuddy-next\s*\{[^}]*grid-template-columns:\s*88px minmax\(0,\s*1fr\)/s);
assert.match(settingsCss, /\.system-settings-workbuddy-copy-status\.is-success\s*\{[^}]*color:\s*var\(--sapd-state-success/s);

const workbuddyCertificateRequiredHtml = component.render({
  route: "/settings/ai-integration",
  system: { dataRoot: "/Users/tester/Library/Application Support/SAPDWiki" },
  mcp: {
    contract_version: "sapd-mcp-control-v1",
    status: { service_state: "stopped" },
    settings: {
      configured_port: 28775,
      canonical_resource: "https://127.0.0.1:28775/mcp",
      control_capabilities: {},
    },
    certificate: certificate("not_configured"),
    clients: [],
    diagnostics: { overall_state: "unknown", last_checked_at: null, checks: [] },
  },
  workbuddyGuide: true,
});
assert.match(workbuddyCertificateRequiredHtml, /1\. 生成连接证书/);
assert.match(workbuddyCertificateRequiredHtml, /关闭本窗口，在“安全连接证书”中完成生成后再继续/);
assert.doesNotMatch(workbuddyCertificateRequiredHtml, /已完成。WorkBuddy 只会复制 CA 证书/);
assert.match(workbuddyCertificateRequiredHtml, /2\. 核对 JSON 模板/);
assert.match(workbuddyCertificateRequiredHtml, /3\. 复制配置提示词/);
assert.match(workbuddyCertificateRequiredHtml, /data-mcp-copy-workbuddy disabled/);
assert.match(workbuddyCertificateRequiredHtml, /data-mcp-copy-workbuddy-prompt disabled/);
assert.doesNotMatch(workbuddyCertificateRequiredHtml, /data-workbuddy-json/);
assert.doesNotMatch(workbuddyCertificateRequiredHtml, /data-workbuddy-prompt/);

const workbuddyAppGuideHtml = component.render({
  route: "/settings/ai-integration",
  system: {
    userHome: "/Users/tester",
    dataRoot: "/Users/tester/Library/Application Support/SAPDWiki",
    runtimeRoot: "/Users/tester/Library/Application Support/SAPDWiki/Runtime",
  },
  mcp: {
    contract_version: "sapd-mcp-control-v1",
    status: { service_state: "ready" },
    settings: {
      release_channel: "stable",
      configured_port: 28776,
      canonical_resource: "https://127.0.0.1:28776/mcp",
      control_capabilities: {},
    },
    certificate: certificate("valid", { profile: "app" }),
    clients: [],
    diagnostics: { overall_state: "ready", last_checked_at: null, checks: [] },
  },
  workbuddyGuide: true,
});
assert.match(workbuddyAppGuideHtml, /https:\/\/127\.0\.0\.1:28776\/mcp/);
assert.match(workbuddyAppGuideHtml, /\/Users\/tester\/Library\/Application Support\/SAPDWiki\/Runtime\/data\/mcp\/certificates\/active-manifest\.json/);
assert.doesNotMatch(workbuddyAppGuideHtml, /\/Users\/tester\/Library\/Application Support\/SAPD Wiki\/LocalMCP\/Certificates\/dev\/active-manifest\.json/);
assert.match(workbuddyAppGuideHtml, /App 保存位置\/Runtime\/data\/mcp\/certificates/);
assert.doesNotMatch(workbuddyAppGuideHtml, /相对于/);
assert.doesNotMatch(workbuddyAppGuideHtml, /应用私有安全目录（不可修改）/);
assert.match(settingsCss, /\.system-settings-certificate-storage code\s*\{[^}]*font-size:\s*var\(--sapd-shell-type-caption,\s*11px\)[^}]*overflow-wrap:\s*anywhere/s);
assert.doesNotMatch(workbuddyGuideHtml, /Web 开发通道|28775 请继续保留给 Web|28776 对应地址/);
assert.doesNotMatch(workbuddyAppGuideHtml, /Web 开发通道|28775 请继续保留给 Web|28776 对应地址/);
assert.match(workbuddyAppGuideHtml, /复制 JSON/);
assert.match(workbuddyAppGuideHtml, /复制配置提示词/);

const sentinelHtml = component.render({
  route: "/settings/ai-integration",
  mcp: null,
});
for (const forbidden of ["token-secret-sentinel", "private-key-sentinel", "passphrase-reference-sentinel", "absolute-path-sentinel", "raw-log-sentinel"]) {
  assert.doesNotMatch(sentinelHtml, new RegExp(forbidden));
}

console.log("system settings frontend contract: PASS");
