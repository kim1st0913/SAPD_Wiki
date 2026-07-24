(function () {
  const components = (window.sapdComponents = window.sapdComponents || {});
  const text = (value) => (value == null ? "" : String(value));
  const list = (value) => (Array.isArray(value) ? value : []);
  const escapeHtml = (value) =>
    text(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");

  function pathRow(label, value, action = "") {
    const displayValue = text(value).trim() || "未配置";
    return `
      <div class="system-settings-path-row">
        <dt>${escapeHtml(label)}</dt>
        <dd class="system-settings-code">${escapeHtml(displayValue)}</dd>
        ${action ? `<button type="button" data-settings-path-action="${escapeHtml(action)}">更改路径</button>` : ""}
      </div>
    `;
  }

  function tabs(route) {
    return `
      <nav class="system-settings-tabs maintenance-section-tabs" aria-label="系统设置">
        <button class="maintenance-section-tab ${route === "/settings/system" ? "active" : ""}" type="button" data-app-route="/settings/system" aria-current="${route === "/settings/system" ? "page" : "false"}">系统设置</button>
        <button class="maintenance-section-tab ${route === "/settings/ai-integration" ? "active" : ""}" type="button" data-app-route="/settings/ai-integration" aria-current="${route === "/settings/ai-integration" ? "page" : "false"}">AI 功能集成</button>
      </nav>
    `;
  }

  function renderSystem(model) {
    const settings = model.system || {};
    return `
      <section class="system-settings-panel" data-settings-page="system" aria-labelledby="systemSettingsTitle">
        <header>
          <span>SAPD WIKI</span>
          <h2 id="systemSettingsTitle">SAPD Wiki 系统设置</h2>
          <p>路径变更会在重启 SAPD Wiki 后完整生效。</p>
        </header>
        <dl class="system-settings-path-list">
          ${pathRow("当前版本", settings.currentVersion || "开发环境")}
          ${pathRow("App 保存位置", settings.dataRoot, "dataRoot")}
          ${pathRow("文件上传路径", settings.importDirectory, "importDirectory")}
          ${pathRow("文件下载路径", settings.downloadDirectory, "downloadDirectory")}
        </dl>
      </section>
    `;
  }

  function statusLabel(value) {
    return {
      ready: "已启动",
      starting: "启动中",
      stopping: "停止中",
      stopped: "已停止",
      error: "异常",
    }[value] || "状态不可用";
  }

  function formatDateTime(value) {
    const normalized = text(value).trim();
    if (!normalized) return "尚无";
    const parsed = new Date(normalized);
    return Number.isNaN(parsed.getTime()) ? normalized : parsed.toLocaleString("zh-CN", { hour12: false });
  }

  function trustState(value) {
    const verified = text(value).trim() === "verified";
    return {
      label: verified ? "已验证" : "未验证",
      tone: verified ? "verified" : "unverified",
    };
  }

  function renderAuthorizationRequests(mcp, pendingAction) {
    const requests = list(mcp.authorization_requests);
    if (!requests.length) return "";
    const capabilities = mcp.settings?.control_capabilities || {};
    const decisionDisabled = Boolean(pendingAction) || capabilities.authorization_decision === false;
    return `
      <section class="system-settings-panel" aria-labelledby="aiAuthorizationTitle">
        <header class="system-settings-panel-heading">
          <div>
            <span>AUTHORIZATION REQUESTS</span>
            <h2 id="aiAuthorizationTitle">待确认授权</h2>
          </div>
          <b class="system-settings-state is-warning">待处理 ${requests.length} 个</b>
        </header>
        <div class="system-settings-authorization-list">
          ${requests.map((request, index) => {
            const trust = trustState(request.trust_state);
            return `
              <article data-mcp-authorization-request="${escapeHtml(request.request_id)}">
                <div class="system-settings-authorization-heading">
                  <strong>${escapeHtml(request.client_name || request.client_id)}</strong>
                  <span class="system-settings-authorization-summary">
                    <b class="system-settings-trust is-${escapeHtml(trust.tone)}">${escapeHtml(trust.label)}</b>
                    <span>队列 ${index + 1} / ${requests.length}</span>
                  </span>
                </div>
                <dl class="system-settings-authorization-grid">
                  <div><dt>Client ID</dt><dd class="system-settings-code">${escapeHtml(request.client_id)}</dd></div>
                  <div><dt>Redirect URI</dt><dd class="system-settings-code">${escapeHtml(request.redirect_uri)}</dd></div>
                  <div><dt>Scope</dt><dd>${list(request.scopes).map((scope) => `<code>${escapeHtml(scope)}</code>`).join(" ") || "/"}</dd></div>
                  <div><dt>Resource</dt><dd class="system-settings-code">${escapeHtml(request.resource)}</dd></div>
                  <div><dt>数据策略</dt><dd>${escapeHtml(request.policy_version || "/")}</dd></div>
                  <div><dt>到期时间</dt><dd>${escapeHtml(formatDateTime(request.expires_at))}</dd></div>
                </dl>
                <div class="system-settings-actions">
                  <button class="is-primary" type="button" data-mcp-authorization-action="allow" data-mcp-authorization-request-id="${escapeHtml(request.request_id)}" ${decisionDisabled ? "disabled" : ""}>允许</button>
                  <button type="button" data-mcp-authorization-action="deny" data-mcp-authorization-request-id="${escapeHtml(request.request_id)}" ${decisionDisabled ? "disabled" : ""}>拒绝</button>
                </div>
              </article>
            `;
          }).join("")}
        </div>
      </section>
    `;
  }

  function renderClients(mcp, pendingAction) {
    const clients = list(mcp.clients);
    const capabilities = mcp.settings?.control_capabilities || {};
    const revokeDisabled = Boolean(pendingAction) || capabilities.client_revocation === false;
    return `
      <section class="system-settings-panel" aria-labelledby="aiClientsTitle">
        <header class="system-settings-panel-heading">
          <div>
            <span>AUTHORIZED CLIENTS</span>
            <h2 id="aiClientsTitle">客户端授权</h2>
          </div>
          <b class="system-settings-state">${clients.length ? `已授权 ${clients.length} 个` : "未授权"}</b>
        </header>
        ${clients.length
          ? `<div class="system-settings-table-scroll" tabindex="0" aria-label="已授权客户端表格，可横向滚动">
              <table class="system-settings-table">
                <thead><tr><th>客户端</th><th>信任</th><th>授权范围</th><th>授权时间</th><th>最近使用</th><th>操作</th></tr></thead>
                <tbody>${clients.map((client) => `
                  <tr>
                    <td><strong>${escapeHtml(client.display_name || client.client_id)}</strong><small class="system-settings-code">${escapeHtml(client.client_id)}</small></td>
                    <td><span class="system-settings-trust is-${escapeHtml(trustState(client.trust_state).tone)}">${escapeHtml(trustState(client.trust_state).label)}</span></td>
                    <td>${list(client.scopes).map((scope) => `<code>${escapeHtml(scope)}</code>`).join(" ") || "/"}</td>
                    <td>${escapeHtml(formatDateTime(client.authorized_at))}</td>
                    <td>${escapeHtml(formatDateTime(client.last_used_at))}</td>
                    <td><button type="button" data-mcp-request-confirmation="revoke" data-mcp-client-id="${escapeHtml(client.client_id)}" data-mcp-client-label="${escapeHtml(client.display_name || client.client_id)}" ${revokeDisabled ? "disabled" : ""}>撤销授权</button></td>
                  </tr>
                `).join("")}</tbody>
              </table>
            </div>`
          : '<div class="system-settings-empty"><strong>暂无已授权客户端</strong><span>完成客户端连接和授权后会在这里显示。</span></div>'}
      </section>
    `;
  }

  function renderAudit(mcp, pendingAction) {
    const audit = mcp.audit || {};
    const eventCount = Number.isInteger(Number(audit.event_count)) ? Number(audit.event_count) : 0;
    const capabilities = mcp.settings?.control_capabilities || {};
    const clearDisabled = Boolean(pendingAction) || capabilities.audit_clear === false || eventCount === 0;
    return `
      <section class="system-settings-panel" aria-labelledby="aiAuditTitle">
        <header class="system-settings-panel-heading">
          <div>
            <span>PRIVACY &amp; AUDIT</span>
            <h2 id="aiAuditTitle">隐私与审计</h2>
          </div>
          <b class="system-settings-state">${escapeHtml(audit.state === "ready" ? "记录正常" : audit.enabled === false ? "未启用" : "状态待检查")}</b>
        </header>
        <dl class="system-settings-audit-grid">
          <div><dt>已记录事件</dt><dd><strong>${escapeHtml(eventCount)}</strong> 条</dd></div>
          <div><dt>最近事件</dt><dd>${escapeHtml(formatDateTime(audit.last_event_at))}</dd></div>
          <div><dt>保留时间</dt><dd>${escapeHtml(Number(audit.retention_days) || 0)} 天</dd></div>
        </dl>
        <p class="system-settings-panel-note">仅保留脱敏的本地操作元数据，不记录查询正文或知识正文。</p>
        <div class="system-settings-actions">
          <button type="button" data-mcp-request-confirmation="clear-audit" ${clearDisabled ? "disabled" : ""}>清除审计记录</button>
        </div>
      </section>
    `;
  }

  function renderDiagnostics(mcp, pendingAction) {
    const diagnostics = mcp.diagnostics || {};
    const checks = list(diagnostics.checks);
    const capabilities = mcp.settings?.control_capabilities || {};
    const resetDisabled = Boolean(pendingAction) || capabilities.web_reset_confirmation === false;
    return `
      <section class="system-settings-panel" aria-labelledby="aiDiagnosticsTitle">
        <header class="system-settings-panel-heading">
          <div>
            <span>DIAGNOSTICS</span>
            <h2 id="aiDiagnosticsTitle">连接检查</h2>
          </div>
          <b class="system-settings-state">${escapeHtml(diagnostics.overall_state === "ready" ? "正常" : diagnostics.overall_state === "blocked" ? "阻断" : "待检查")}</b>
        </header>
        <div class="system-settings-diagnostics">
          ${checks.length ? checks.map((check) => `
            <div><span><strong>${escapeHtml(check.label || check.check_id)}</strong><small>${escapeHtml(check.recovery_action || "无需操作")}</small></span><b>${escapeHtml(check.status || "unknown")}</b></div>
          `).join("") : '<div class="system-settings-empty"><strong>尚无诊断结果</strong><span>点击“检查服务”后显示本地连接结果。</span></div>'}
        </div>
        <div class="system-settings-actions system-settings-reset-actions">
          <button type="button" data-mcp-action="prepare-reset" ${resetDisabled ? "disabled" : ""}>重置本地 MCP</button>
          <small>先生成影响清单，确认前不会执行重置。</small>
        </div>
      </section>
    `;
  }

  function resetEffectLabel(effect) {
    return {
      stop_service: "停止本地 MCP 服务",
      revoke_all_clients: "撤销全部客户端授权",
      delete_managed_trust: "删除本应用管理的本地信任材料",
      delete_managed_secrets: "删除本应用管理的本地凭据",
      clear_audit: "清除本地审计记录",
      retain_audit: "保留本地审计记录",
      reset_port: "恢复默认本地端口",
    }[text(effect).trim()] || "重置一项本地 MCP 配置";
  }

  function renderConfirmation(confirmation) {
    const action = text(confirmation?.action).trim();
    if (!["revoke", "clear-audit"].includes(action)) return "";
    const revoke = action === "revoke";
    const title = revoke ? "确认撤销客户端授权？" : "确认清除审计记录？";
    const description = revoke
      ? `只会撤销“${text(confirmation.label || confirmation.clientId || "该客户端")}”的访问授权，不会停止服务，也不会清除审计记录。`
      : "只会清除本地 MCP 的脱敏审计记录，不会停止服务或撤销客户端授权。此操作不可撤销。";
    return `
      <div class="system-settings-dialog-backdrop" data-mcp-dialog>
        <section class="system-settings-dialog" role="dialog" aria-modal="true" aria-labelledby="mcpConfirmationTitle" aria-describedby="mcpConfirmationDescription">
          <span>${revoke ? "CLIENT AUTHORIZATION" : "PRIVACY & AUDIT"}</span>
          <h2 id="mcpConfirmationTitle">${escapeHtml(title)}</h2>
          <p id="mcpConfirmationDescription">${escapeHtml(description)}</p>
          <div class="system-settings-actions">
            <button type="button" data-mcp-action="cancel-confirmation" autofocus>取消</button>
            <button class="is-danger" type="button" data-mcp-confirm-action="${escapeHtml(action)}" ${revoke ? `data-mcp-client-id="${escapeHtml(confirmation.clientId)}"` : ""}>${revoke ? "确认撤销" : "确认清除"}</button>
          </div>
        </section>
      </div>
    `;
  }

  function renderResetPreview(resetPreview) {
    if (!resetPreview) return "";
    const effects = list(resetPreview.effects);
    return `
      <div class="system-settings-dialog-backdrop" data-mcp-dialog>
        <section class="system-settings-dialog" role="dialog" aria-modal="true" aria-labelledby="mcpResetTitle" aria-describedby="mcpResetDescription">
          <span>RESET PREVIEW</span>
          <h2 id="mcpResetTitle">重置影响清单</h2>
          <p id="mcpResetDescription">请先核对以下影响。确认后只重置本地 MCP 集成，不会修改知识库内容或用户数据。</p>
          <ul class="system-settings-reset-effects">
            ${effects.length
              ? effects.map((effect) => `<li>${escapeHtml(resetEffectLabel(effect))}</li>`).join("")
              : "<li>当前没有可执行的重置项。</li>"}
          </ul>
          <div class="system-settings-actions">
            <button type="button" data-mcp-action="close-reset-preview" autofocus>取消</button>
            <button class="is-danger" type="button" data-mcp-action="confirm-web-reset" ${effects.length ? "" : "disabled"}>确认重置</button>
          </div>
        </section>
      </div>
    `;
  }

  function renderAi(model) {
    const mcp = model.mcp || {};
    const status = mcp.status || {};
    const settings = mcp.settings || {};
    const capabilities = settings.control_capabilities || {};
    const serviceState = text(status.service_state || mcp.service_state);
    const running = serviceState === "ready";
    const errorState = serviceState === "error";
    const transitioning = serviceState === "starting" || serviceState === "stopping";
    const serviceDisabled = Boolean(model.pendingAction) || transitioning || capabilities.service_control === false;
    const portLocked = !["stopped", "error"].includes(serviceState)
      || Boolean(model.pendingAction)
      || capabilities.port_configuration === false;
    const diagnosticDisabled = Boolean(model.pendingAction) || capabilities.diagnostic_check === false;
    const canonicalResource = text(settings.canonical_resource || mcp.canonical_resource);
    const configuredPort = Number(settings.configured_port || mcp.configured_port) || "";
    const serviceAction = running ? "stop" : errorState ? "retry" : "start";
    return `
      <div class="system-settings-ai" data-settings-page="ai-integration">
        <section class="system-settings-panel" aria-labelledby="aiRuntimeTitle">
          <header class="system-settings-panel-heading">
            <div>
              <span>LOCAL RUNTIME</span>
              <h2 id="aiRuntimeTitle">本地运行配置</h2>
            </div>
            <b class="system-settings-state is-${escapeHtml(running ? "ready" : errorState ? "error" : "idle")}">${escapeHtml(statusLabel(serviceState))}</b>
          </header>
          <dl class="system-settings-runtime-grid">
            <div><dt>运行通道</dt><dd>${escapeHtml(settings.release_channel || mcp.release_channel || "dev")}</dd></div>
            <div>
              <dt><label for="mcpConfiguredPort">本地端口</label></dt>
              <dd>
                <form class="system-settings-port-form" data-mcp-port-form>
                  <input id="mcpConfiguredPort" name="configured_port" type="number" min="1024" max="65535" step="1" inputmode="numeric" value="${escapeHtml(configuredPort)}" aria-describedby="mcpConfiguredPortHint" ${portLocked ? "disabled" : ""} />
                  <button type="submit" ${portLocked ? "disabled" : ""}>保存</button>
                </form>
                <small id="mcpConfiguredPortHint">${running || transitioning ? "请先停止 MCP，再修改端口。" : errorState ? "可修改端口后重新启动；5173 为稳定页面保留端口。" : "可设置 1024–65535，5173 不可用。"}</small>
              </dd>
            </div>
            <div><dt>服务地址</dt><dd class="system-settings-code">${escapeHtml(canonicalResource || "/")}</dd></div>
            <div><dt>运行状态</dt><dd>${escapeHtml(statusLabel(serviceState))}</dd></div>
          </dl>
          ${status.recoverable_error ? `<p class="system-settings-callout is-warning">${escapeHtml(status.recoverable_error.recovery_action === "change_port" ? "当前端口被占用，请修改端口后重新启动；主 Web 页面不受影响。" : "本地 MCP 启动失败，可检查 Runtime 后重试；主 Web 页面不受影响。")}</p>` : ""}
          <div class="system-settings-actions">
            <button class="is-primary" type="button" data-mcp-settings-action="${escapeHtml(serviceAction)}" ${serviceDisabled ? "disabled" : ""}>${escapeHtml(model.pendingAction || transitioning ? "处理中…" : serviceAction === "stop" ? "停止 MCP" : serviceAction === "retry" ? "重试启动" : "启动 MCP")}</button>
            <button type="button" data-mcp-copy-url="${escapeHtml(canonicalResource)}" ${canonicalResource ? "" : "disabled"}>复制 MCP 地址</button>
            <button type="button" data-mcp-copy-config="${escapeHtml(canonicalResource)}" ${canonicalResource ? "" : "disabled"}>复制 Codex 配置</button>
            <button type="button" data-mcp-settings-action="check" ${diagnosticDisabled ? "disabled" : ""}>检查服务</button>
          </div>
        </section>
        ${renderAuthorizationRequests(mcp, model.pendingAction)}
        ${renderClients(mcp, model.pendingAction)}
        ${renderAudit(mcp, model.pendingAction)}
        ${renderDiagnostics(mcp, model.pendingAction)}
      </div>
    `;
  }

  function render(model = {}) {
    const route = model.route === "/settings/ai-integration" ? "/settings/ai-integration" : "/settings/system";
    const notice = typeof model.notice === "string" ? model.notice : model.notice?.message || "";
    const noticeTone = ["success", "error", "warning", "info"].includes(text(model.notice?.tone))
      ? text(model.notice.tone)
      : "info";
    const unavailable = route === "/settings/ai-integration" && !model.loading && !model.mcp?.contract_version;
    return `
      <section class="system-settings-workspace" aria-busy="${model.loading ? "true" : "false"}">
        <div class="system-settings-toolbar">
          ${tabs(route)}
          <button type="button" data-settings-refresh ${model.loading || model.pendingAction ? "disabled" : ""}>刷新状态</button>
        </div>
        <div class="system-settings-notice is-${escapeHtml(noticeTone)}" role="status" aria-live="polite">${escapeHtml(notice)}</div>
        <div class="system-settings-scroll">
          ${route === "/settings/system"
            ? renderSystem(model)
            : unavailable
              ? '<section class="system-settings-panel system-settings-unavailable" role="alert"><strong>本地 MCP 状态不可用</strong><span>请确认 Web 开发服务正常，主知识库页面仍可继续使用。</span></section>'
              : renderAi(model)}
        </div>
        ${model.resetPreview ? renderResetPreview(model.resetPreview) : renderConfirmation(model.confirmation)}
      </section>
    `;
  }

  components.SystemSettings = { render };
})();
