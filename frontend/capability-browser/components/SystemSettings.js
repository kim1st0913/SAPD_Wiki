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
    return `
      <div class="system-settings-path-row">
        <dt>${escapeHtml(label)}</dt>
        <dd class="system-settings-code">${escapeHtml(value || "/")}</dd>
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

  function renderAuthorizationRequests(mcp, pendingAction) {
    const requests = list(mcp.authorization_requests);
    if (!requests.length) return "";
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
          ${requests.map((request, index) => `
            <article data-mcp-authorization-request="${escapeHtml(request.request_id)}">
              <div class="system-settings-authorization-heading">
                <strong>${escapeHtml(request.client_name || request.client_id)}</strong>
                <span>队列 ${index + 1} / ${requests.length}</span>
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
                <button class="is-primary" type="button" data-mcp-authorization-action="allow" data-mcp-authorization-request-id="${escapeHtml(request.request_id)}" ${pendingAction ? "disabled" : ""}>允许</button>
                <button type="button" data-mcp-authorization-action="deny" data-mcp-authorization-request-id="${escapeHtml(request.request_id)}" ${pendingAction ? "disabled" : ""}>拒绝</button>
              </div>
            </article>
          `).join("")}
        </div>
      </section>
    `;
  }

  function renderClients(mcp, pendingAction) {
    const clients = list(mcp.clients);
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
                    <td>${escapeHtml(client.trust_state === "verified" ? "已验证" : "未验证")}</td>
                    <td>${list(client.scopes).map((scope) => `<code>${escapeHtml(scope)}</code>`).join(" ") || "/"}</td>
                    <td>${escapeHtml(formatDateTime(client.authorized_at))}</td>
                    <td>${escapeHtml(formatDateTime(client.last_used_at))}</td>
                    <td><button type="button" data-mcp-client-revoke="${escapeHtml(client.client_id)}" ${pendingAction ? "disabled" : ""}>撤销授权</button></td>
                  </tr>
                `).join("")}</tbody>
              </table>
            </div>`
          : '<div class="system-settings-empty"><strong>暂无已授权客户端</strong><span>完成客户端连接和授权后会在这里显示。</span></div>'}
      </section>
    `;
  }

  function renderDiagnostics(mcp) {
    const diagnostics = mcp.diagnostics || {};
    const checks = list(diagnostics.checks);
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
      </section>
    `;
  }

  function renderAi(model) {
    const mcp = model.mcp || {};
    const status = mcp.status || {};
    const settings = mcp.settings || {};
    const serviceState = text(status.service_state || mcp.service_state);
    const running = serviceState === "ready";
    const portLocked = serviceState !== "stopped" || Boolean(model.pendingAction);
    const errorState = serviceState === "error";
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
                <small id="mcpConfiguredPortHint">${running ? "请先停止 MCP，再修改端口。" : "可设置 1024–65535。"}</small>
              </dd>
            </div>
            <div><dt>服务地址</dt><dd class="system-settings-code">${escapeHtml(canonicalResource || "/")}</dd></div>
            <div><dt>运行状态</dt><dd>${escapeHtml(statusLabel(serviceState))}</dd></div>
          </dl>
          ${status.recoverable_error ? '<p class="system-settings-callout is-warning">本地 MCP 启动失败，可先重试；主 Web 页面不受影响。</p>' : ""}
          <div class="system-settings-actions">
            <button class="is-primary" type="button" data-mcp-settings-action="${escapeHtml(serviceAction)}" ${model.pendingAction ? "disabled" : ""}>${escapeHtml(model.pendingAction ? "处理中…" : serviceAction === "stop" ? "停止 MCP" : serviceAction === "retry" ? "重试启动" : "启动 MCP")}</button>
            <button type="button" data-mcp-copy-url="${escapeHtml(canonicalResource)}" ${canonicalResource ? "" : "disabled"}>复制 MCP 地址</button>
            <button type="button" data-mcp-copy-config="${escapeHtml(canonicalResource)}" ${canonicalResource ? "" : "disabled"}>复制 Codex 配置</button>
            <button type="button" data-mcp-settings-action="check" ${model.pendingAction ? "disabled" : ""}>检查服务</button>
          </div>
        </section>
        ${renderAuthorizationRequests(mcp, model.pendingAction)}
        ${renderClients(mcp, model.pendingAction)}
        ${renderDiagnostics(mcp)}
      </div>
    `;
  }

  function render(model = {}) {
    const route = model.route === "/settings/ai-integration" ? "/settings/ai-integration" : "/settings/system";
    const notice = typeof model.notice === "string" ? model.notice : model.notice?.message || "";
    const unavailable = route === "/settings/ai-integration" && !model.loading && !model.mcp?.contract_version;
    return `
      <section class="system-settings-workspace" aria-busy="${model.loading ? "true" : "false"}">
        <div class="system-settings-toolbar">
          ${tabs(route)}
          <button type="button" data-settings-refresh ${model.loading || model.pendingAction ? "disabled" : ""}>刷新状态</button>
        </div>
        <div class="system-settings-notice" role="status" aria-live="polite">${escapeHtml(notice)}</div>
        <div class="system-settings-scroll">
          ${route === "/settings/system"
            ? renderSystem(model)
            : unavailable
              ? '<section class="system-settings-panel system-settings-unavailable" role="alert"><strong>本地 MCP 状态不可用</strong><span>请确认 Web 开发服务正常，主知识库页面仍可继续使用。</span></section>'
              : renderAi(model)}
        </div>
      </section>
    `;
  }

  components.SystemSettings = { render };
})();
