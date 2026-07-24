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
      <div class="system-settings-system" data-settings-page="system">
        <section class="system-settings-panel system-settings-system-summary" aria-labelledby="systemSettingsTitle">
          <header class="system-settings-system-summary-heading">
            <div>
              <span>SAPD WIKI</span>
              <h2 id="systemSettingsTitle">SAPD Wiki 系统设置</h2>
              <p>管理应用版本、本地文件位置与数据交换目录。</p>
            </div>
            <dl class="system-settings-version">
              <dt>当前版本</dt>
              <dd>${escapeHtml(settings.currentVersion || "开发环境")}</dd>
            </dl>
          </header>
        </section>
        <section class="system-settings-panel system-settings-storage" aria-labelledby="systemStorageTitle">
          <header class="system-settings-panel-heading">
            <div>
              <span>FILES &amp; STORAGE</span>
              <h2 id="systemStorageTitle">文件与存储</h2>
              <p>路径变更会在重启 SAPD Wiki 后完整生效。</p>
            </div>
          </header>
          <dl class="system-settings-path-list">
            ${pathRow("App 保存位置", settings.dataRoot, "dataRoot")}
            ${pathRow("文件上传路径", settings.importDirectory, "importDirectory")}
            ${pathRow("文件下载路径", settings.downloadDirectory, "downloadDirectory")}
          </dl>
        </section>
      </div>
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

  function formatDate(value) {
    const normalized = text(value).trim();
    if (!normalized) return "尚未生成";
    const parsed = new Date(normalized);
    return Number.isNaN(parsed.getTime())
      ? normalized
      : parsed.toLocaleDateString("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit" });
  }

  function mcpOverviewPresentation(mcp = {}) {
    const status = mcp.status || {};
    const clients = list(mcp.clients).filter((client) => client?.status !== "revoked");
    const requests = list(mcp.authorization_requests);
    const audit = mcp.audit || {};
    const displayState = text(status.display_state).trim()
      || (status.desired_state === "disabled"
        ? "disabled"
        : status.service_state === "starting"
          ? "starting"
          : status.service_state === "stopping"
            ? "stopping"
            : status.service_state === "error"
              ? "recoverable_error"
              : status.knowledge_state === "blocked"
                ? "knowledge_blocked"
                : status.knowledge_state === "degraded"
                  ? "knowledge_degraded"
                  : status.audit_state === "degraded"
                    ? "audit_degraded"
                    : status.authorization_state === "authorized" && status.activity_state === "recent"
                      ? "recently_used"
                      : status.authorization_state === "authorized"
                        ? "authorized_waiting_use"
                        : "ready_waiting_authorization");
    const displayStates = {
      disabled: { label: "MCP 未启用", tone: "idle", message: "启动本机服务后，Codex 才能发起安全连接与客户端授权。" },
      starting: { label: "MCP 正在启动", tone: "warning", message: "正在建立本机 HTTPS 服务，请稍候查看连接状态。" },
      stopping: { label: "MCP 正在停止", tone: "warning", message: "服务停止后，已授权客户端将暂时无法访问。" },
      recoverable_error: { label: "连接需要处理", tone: "error", message: "本机服务未正常就绪，请按页面提示检查端口、证书或 Runtime。" },
      knowledge_blocked: { label: "知识访问不可用", tone: "error", message: "连接服务可运行，但当前知识策略阻止返回内容。" },
      knowledge_degraded: { label: "知识访问受限", tone: "warning", message: "MCP 可连接，但部分基础知识库内容暂时不可用。" },
      audit_degraded: { label: "审计记录异常", tone: "warning", message: "MCP 可连接，但本地审计状态需要检查。" },
      ready_waiting_authorization: { label: "等待客户端授权", tone: "warning", message: "服务已就绪；从 Codex 发起连接后，在此确认客户端授权。" },
      authorized_waiting_use: { label: "已授权，等待使用", tone: "ready", message: "客户端授权已完成，可以从 Codex 开始使用 SAPD Wiki。" },
      recently_used: { label: "连接可用", tone: "ready", message: "近期已有授权客户端成功使用 SAPD Wiki。" },
    };
    const authorizationLabels = {
      no_clients: "尚未授权",
      pending: `待确认 ${requests.length || 1} 个`,
      authorized: `已授权 ${clients.length || 1} 个`,
      revoked: "授权已撤销",
      error: "授权异常",
    };
    const knowledgeLabels = {
      ready: "策略就绪",
      degraded: "访问受限",
      blocked: "不可访问",
    };
    const auditLabels = {
      disabled: "未启用",
      ready: "记录正常",
      degraded: "记录异常",
    };
    const activityLabels = {
      never: "尚未使用",
      idle: "等待使用",
      recent: "近期已使用",
    };
    return {
      display: displayStates[displayState] || displayStates.recoverable_error,
      authorization: authorizationLabels[status.authorization_state] || (clients.length ? `已授权 ${clients.length} 个` : "尚未授权"),
      authorizationMeta: requests.length ? `${requests.length} 个请求等待处理` : clients.length ? "可逐个查看和撤销" : "等待 Codex 发起连接",
      knowledge: knowledgeLabels[status.knowledge_state] || "状态待检查",
      knowledgeTone: status.knowledge_state === "blocked" ? "error" : status.knowledge_state === "degraded" ? "warning" : "ready",
      audit: auditLabels[status.audit_state] || "状态待检查",
      auditMeta: `${Number(audit.event_count) || 0} 条记录 · 保留 ${Number(audit.retention_days) || 0} 天`,
      activity: activityLabels[status.activity_state] || "状态待检查",
      activityMeta: status.last_success_at ? `最近成功：${formatDateTime(status.last_success_at)}` : "尚无成功调用记录",
    };
  }

  function renderAiOverview(mcp) {
    const overview = mcpOverviewPresentation(mcp);
    const serviceState = text(mcp.status?.service_state || mcp.service_state);
    return `
      <section class="system-settings-panel system-settings-ai-overview" aria-labelledby="aiOverviewTitle">
        <header class="system-settings-panel-heading">
          <div>
            <span>AI CONNECTION OVERVIEW</span>
            <h2 id="aiOverviewTitle">AI 集成概况</h2>
            <p>${escapeHtml(overview.display.message)}</p>
          </div>
          <b class="system-settings-state is-${escapeHtml(overview.display.tone)}">${escapeHtml(overview.display.label)}</b>
        </header>
        <dl class="system-settings-overview-grid">
          <div><dt>本机服务</dt><dd>${escapeHtml(statusLabel(serviceState))}</dd><small>仅监听 127.0.0.1</small></div>
          <div><dt>客户端授权</dt><dd>${escapeHtml(overview.authorization)}</dd><small>${escapeHtml(overview.authorizationMeta)}</small></div>
          <div><dt>知识访问</dt><dd class="is-${escapeHtml(overview.knowledgeTone)}">${escapeHtml(overview.knowledge)}</dd><small>基础知识库全部业务内容（只读）</small></div>
          <div><dt>隐私审计</dt><dd>${escapeHtml(overview.audit)}</dd><small>${escapeHtml(overview.auditMeta)}</small></div>
          <div><dt>最近使用</dt><dd>${escapeHtml(overview.activity)}</dd><small>${escapeHtml(overview.activityMeta)}</small></div>
        </dl>
      </section>
    `;
  }

  function renderDataAccess(mcp) {
    const overview = mcpOverviewPresentation(mcp);
    return `
      <section class="system-settings-panel system-settings-data-access" aria-labelledby="aiDataAccessTitle">
        <header class="system-settings-panel-heading">
          <div>
            <span>DATA ACCESS</span>
            <h2 id="aiDataAccessTitle">数据访问范围</h2>
            <p>明确 Codex 可以读取什么，以及始终不会暴露什么。</p>
          </div>
          <b class="system-settings-state is-${escapeHtml(overview.knowledgeTone)}">${escapeHtml(overview.knowledge)}</b>
        </header>
        <dl class="system-settings-data-access-list">
          <div><dt>当前开放</dt><dd>基础知识库全部业务内容，包括完整标准正文</dd></div>
          <div><dt>访问方式</dt><dd>5 个只读知识工具</dd></div>
          <div><dt>网络边界</dt><dd>仅本机回环 HTTPS</dd></div>
          <div><dt>明确排除</dt><dd>用户数据、源文件本体、本地路径、系统配置与凭据、日志和非受控 SQL</dd></div>
        </dl>
        <p class="system-settings-data-trust">AI 可以检索和使用基础知识库中的全部知识内容。知识内容仅用于查询、分析和引用，不能改变系统权限或指挥系统执行操作。</p>
      </section>
    `;
  }

  function certificatePresentation(certificate = {}) {
    const state = text(certificate.state).trim() || "not_configured";
    const presentations = {
      not_configured: { label: "尚未建立", tone: "idle", message: "首次启用时，由 SAPD Wiki 自动生成仅用于 127.0.0.1 的本机安全证书。" },
      valid: { label: "连接安全", tone: "ready", message: "证书与当前用户信任状态正常。" },
      expiring: { label: "即将到期", tone: "warning", message: "证书即将到期，建议在不影响使用的时间更新。" },
      renewal_required: { label: "需要更新", tone: "warning", message: "证书已进入更新窗口，请尽快更新。" },
      expired: { label: "已到期", tone: "error", message: "证书已到期，需要更新后才能恢复稳定安全连接。" },
      trust_missing: { label: "信任缺失", tone: "warning", message: "证书仍在，但当前用户信任已缺失，可直接修复且不更换证书。" },
      trust_conflict: { label: "信任冲突", tone: "error", message: "检测到同名但指纹不同的证书；SAPD Wiki 不会自动接管或删除。" },
      key_unavailable: { label: "密钥不可用", tone: "error", message: "证书密钥当前不可用，请重置 AI 集成后重新初始化。" },
      clock_invalid: { label: "系统时间异常", tone: "error", message: "系统时间与证书有效期不一致，请先校准系统时间。" },
      rotating: { label: "更新中", tone: "warning", message: "正在切换安全证书，请保持 SAPD Wiki 运行。" },
      recovery_required: { label: "需要恢复", tone: "error", message: "证书状态不完整，需按提示重置或恢复。" },
      error: { label: "状态异常", tone: "error", message: "无法确认本机安全证书状态。" },
    };
    return { state, ...(presentations[state] || presentations.error) };
  }

  function certificateAction(certificate = {}, capabilities = {}) {
    const nextAction = text(certificate.next_action).trim();
    const actions = {
      certificate_provision: { value: "certificate_provision", label: "建立本机安全连接" },
      certificate_rotate: { value: "certificate_rotate", label: "更新证书" },
      certificate_repair_trust: { value: "certificate_repair_trust", label: "修复安全连接" },
    };
    const action = actions[nextAction];
    return action && capabilities[action.value] !== false ? action : null;
  }

  function certificateOperationPresentation(operation = {}) {
    const phase = text(operation.phase).trim();
    return {
      planned: "正在准备安全更新",
      staged: "新证书已生成，正在验证",
      new_trust_installed: "新信任已建立，正在安全切换",
      switched: "已切换到新证书，正在检查",
      validated: "新证书已验证，正在安排清理",
      retiring: "更新完成，旧证书暂时保留用于安全回退",
      completed: "证书操作已完成",
    }[phase] || "正在处理本机安全连接";
  }

  function certificateBackendLabel(certificate = {}) {
    return {
      trust: {
        fake_current_user_trust: "隔离测试信任",
        macos_user_trust: "macOS 当前用户信任",
        windows_current_user_root: "Windows 当前用户根证书",
      }[text(certificate.trust_backend).trim()] || "当前用户信任",
      secret: {
        in_memory_test_only: "隔离测试保管",
        macos_web_dev_keychain: "macOS 登录钥匙串（开发环境）",
        macos_data_protection_keychain: "macOS 数据保护钥匙串",
        windows_dpapi_current_user: "Windows 当前用户 DPAPI",
      }[text(certificate.secret_backend).trim()] || "应用安全保管",
    };
  }

  function renderCertificate(mcp, pendingAction) {
    const certificate = mcp.certificate || {};
    const capabilities = mcp.settings?.control_capabilities || {};
    const presentation = certificatePresentation(certificate);
    const action = certificateAction(certificate, capabilities);
    const operationPending = Boolean(certificate.operation) || presentation.state === "rotating";
    const disabled = Boolean(pendingAction) || operationPending;
    const isFakeTrust = certificate.trust_backend === "fake_current_user_trust";
    const backend = certificateBackendLabel(certificate);
    const needsRecovery = presentation.state === "recovery_required";
    return `
      <section id="aiCertificatePanel" class="system-settings-panel system-settings-certificate" data-certificate-state="${escapeHtml(presentation.state)}" aria-labelledby="aiCertificateTitle" tabindex="-1">
        <header class="system-settings-panel-heading">
          <div>
            <span>SECURE CONNECTION CERTIFICATE</span>
            <h2 id="aiCertificateTitle">安全连接证书</h2>
          </div>
          <b class="system-settings-state is-${escapeHtml(presentation.tone)}">${escapeHtml(presentation.label)}</b>
        </header>
        <p class="system-settings-certificate-summary">${escapeHtml(presentation.message)}</p>
        <dl class="system-settings-certificate-grid">
          <div><dt>连接对象</dt><dd>${escapeHtml(certificate.subject || "127.0.0.1")}</dd></div>
          <div><dt>信任范围</dt><dd>当前用户</dd></div>
          <div><dt>有效期至</dt><dd>${escapeHtml(formatDate(certificate.valid_until))}</dd></div>
          <div><dt>剩余时间</dt><dd>${certificate.remaining_days != null && Number.isInteger(Number(certificate.remaining_days)) ? `${escapeHtml(Number(certificate.remaining_days))} 天` : "尚未生成"}</dd></div>
          <div><dt>证书存储</dt><dd>应用私有安全目录（不可修改）</dd></div>
        </dl>
        ${isFakeTrust ? '<p class="system-settings-callout is-warning">当前为 Web 隔离验证，不会修改 macOS 或 Windows 系统信任库。进入真实客户端验证前，需另行启用当前用户平台集成。</p>' : ""}
        ${certificate.operation ? `<p class="system-settings-callout is-warning" role="status" aria-live="polite">${escapeHtml(certificateOperationPresentation(certificate.operation))}</p>` : ""}
        ${certificate.cleanup_pending ? `<p class="system-settings-callout">旧证书将在 ${escapeHtml(formatDateTime(certificate.old_generation_retained_until))} 前保留用于安全回退，随后按原指纹自动清理。</p>` : ""}
        ${certificate.client_restart_required ? '<p class="system-settings-callout is-warning">证书已更新。重新启动 MCP 后，请让已连接的 AI 客户端重新建立连接。</p>' : ""}
        ${action ? `
          <div class="system-settings-actions">
            <button class="is-primary" type="button" data-mcp-certificate-action="${escapeHtml(action.value)}" ${disabled ? "disabled" : ""}>${escapeHtml(disabled ? "处理中…" : action.label)}</button>
          </div>
        ` : ""}
        ${needsRecovery ? `
          <div class="system-settings-actions">
            <button class="is-danger" type="button" data-mcp-action="prepare-reset" ${disabled ? "disabled" : ""}>重置 AI 集成并重新初始化</button>
          </div>
        ` : ""}
        <details class="system-settings-certificate-details" ${capabilities.certificate_view_details === false ? "hidden" : ""}>
          <summary>查看证书详情</summary>
          <dl>
            <div><dt>CA 名称</dt><dd>${escapeHtml(certificate.ca_display_name || "尚未生成")}</dd></div>
            <div><dt>适用地址</dt><dd class="system-settings-code">${escapeHtml(list(certificate.san).join(", ") || "127.0.0.1")}</dd></div>
            <div><dt>CA 指纹（SHA-256）</dt><dd class="system-settings-code">${escapeHtml(certificate.ca_fingerprint_sha256 || "尚未生成")}</dd></div>
            <div><dt>服务证书指纹（SHA-256）</dt><dd class="system-settings-code">${escapeHtml(certificate.server_fingerprint_sha256 || "尚未生成")}</dd></div>
            <div><dt>最近生成</dt><dd>${escapeHtml(formatDateTime(certificate.last_rotated_at))}</dd></div>
            <div><dt>信任策略</dt><dd>仅本机回环 HTTPS</dd></div>
            <div><dt>信任实现</dt><dd>${escapeHtml(backend.trust)}</dd></div>
            <div><dt>安全保管</dt><dd>${escapeHtml(backend.secret)}</dd></div>
            <div><dt>生效时间</dt><dd>${escapeHtml(formatDateTime(certificate.valid_from))}</dd></div>
          </dl>
        </details>
      </section>
    `;
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
          <button type="button" data-mcp-action="prepare-reset" ${resetDisabled ? "disabled" : ""}>重置 AI 集成</button>
          <small>只重置 MCP 证书、客户端授权和本地凭据；License、知识库与用户数据不受影响。</small>
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
          <p id="mcpResetDescription">请先核对以下影响。确认后只重置 AI 集成；License 授权、知识库内容和用户数据不会被修改。再次启用时仍需重新确认建立本机安全连接。</p>
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

  function certificateEffectLabel(effect) {
    return {
      create_managed_identity: "生成仅用于本机 127.0.0.1 的 CA 与服务器证书",
      install_current_user_trust: "在当前用户范围建立受限 HTTPS 信任",
      replace_current_user_trust: "以新证书替换本应用此前管理的当前用户信任",
    }[text(effect).trim()] || "更新一项本机安全连接配置";
  }

  function renderCertificatePreview(preview, certificate = {}) {
    if (!preview) return "";
    const action = text(preview.action).trim();
    const provision = action === "certificate_provision";
    const repair = action === "certificate_repair_trust";
    const title = provision ? "建立本机安全连接？" : repair ? "修复本机安全连接？" : "更新本机安全证书？";
    const button = provision ? "生成并建立信任" : repair ? "确认修复" : "确认更新";
    return `
      <div class="system-settings-dialog-backdrop" data-mcp-dialog>
        <section class="system-settings-dialog" role="dialog" aria-modal="true" aria-labelledby="mcpCertificateTitle" aria-describedby="mcpCertificateDescription">
          <span>SECURE CONNECTION</span>
          <h2 id="mcpCertificateTitle">${escapeHtml(title)}</h2>
          <p id="mcpCertificateDescription">SAPD Wiki 将自动完成证书字段，不需要填写姓名、组织、邮箱、路径或有效期。</p>
          <dl class="system-settings-certificate-confirmation">
            <div><dt>连接地址</dt><dd>127.0.0.1</dd></div>
            <div><dt>信任范围</dt><dd>当前用户</dd></div>
            <div><dt>服务器证书有效期</dt><dd>365 天</dd></div>
            <div><dt>存储位置</dt><dd>应用私有安全目录</dd></div>
          </dl>
          <ul class="system-settings-reset-effects">
            ${list(preview.effects).map((effect) => `<li>${escapeHtml(certificateEffectLabel(effect))}</li>`).join("")}
          </ul>
          <p>${certificate.trust_backend === "fake_current_user_trust"
            ? "当前为 Web 隔离验证，不会修改真实系统证书库。"
            : "确认后将修改当前用户的本机信任设置；系统可能要求你再次确认。不会写入系统级或其他用户证书库。"}</p>
          <div class="system-settings-actions">
            <button type="button" data-mcp-action="close-certificate-preview" autofocus>取消</button>
            <button class="is-primary" type="button" data-mcp-action="confirm-certificate">${escapeHtml(button)}</button>
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
        ${renderAiOverview(mcp)}
        <div class="system-settings-ai-primary">
          <section class="system-settings-panel system-settings-runtime-panel" aria-labelledby="aiRuntimeTitle">
            <header class="system-settings-panel-heading">
              <div>
                <span>LOCAL RUNTIME</span>
                <h2 id="aiRuntimeTitle">服务与 Codex 连接</h2>
                <p>配置本机端口，并复制 Codex 所需的连接信息。</p>
              </div>
              <b class="system-settings-state is-${escapeHtml(running ? "ready" : errorState ? "error" : "idle")}">${escapeHtml(statusLabel(serviceState))}</b>
            </header>
            <dl class="system-settings-runtime-grid">
              <div><dt>运行通道</dt><dd>${escapeHtml(settings.release_channel || mcp.release_channel || "dev")}</dd><small>当前安装通道</small></div>
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
              <div><dt>服务地址</dt><dd class="system-settings-code">${escapeHtml(canonicalResource || "/")}</dd><small>供 Codex 本机连接使用</small></div>
            </dl>
            ${status.recoverable_error ? `<p class="system-settings-callout is-warning">${escapeHtml(status.recoverable_error.recovery_action === "change_port" ? "当前端口被占用，请修改端口后重新启动；主 Web 页面不受影响。" : "本地 MCP 启动失败，可检查 Runtime 后重试；主 Web 页面不受影响。")}</p>` : ""}
            <div class="system-settings-actions system-settings-runtime-actions">
              <button class="is-primary" type="button" data-mcp-settings-action="${escapeHtml(serviceAction)}" ${serviceDisabled ? "disabled" : ""}>${escapeHtml(model.pendingAction || transitioning ? "处理中…" : serviceAction === "stop" ? "停止 MCP" : serviceAction === "retry" ? "重试启动" : "启动 MCP")}</button>
              <button type="button" data-mcp-copy-config="${escapeHtml(canonicalResource)}" ${canonicalResource ? "" : "disabled"}>复制 Codex 配置</button>
              <button type="button" data-mcp-copy-url="${escapeHtml(canonicalResource)}" ${canonicalResource ? "" : "disabled"}>复制 MCP 地址</button>
              <button type="button" data-mcp-settings-action="check" ${diagnosticDisabled ? "disabled" : ""}>检查服务</button>
            </div>
          </section>
          ${renderDataAccess(mcp)}
        </div>
        ${renderCertificate(mcp, model.pendingAction)}
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
        ${model.certificatePreview
          ? renderCertificatePreview(model.certificatePreview, model.mcp?.certificate)
          : model.resetPreview
            ? renderResetPreview(model.resetPreview)
            : renderConfirmation(model.confirmation)}
      </section>
    `;
  }

  components.SystemSettings = { render };
})();
