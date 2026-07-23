(function () {
  const components = (window.sapdComponents = window.sapdComponents || {});
  const utils = components.utils || {};
  const text = (value) => (value == null ? "" : String(value));
  const list = (value) => (Array.isArray(value) ? value : []);
  const escapeHtml = (value) =>
    (utils.escapeHtml ? utils.escapeHtml(value) : text(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;"));

  const DISPLAY_STATES = {
    disabled: { label: "MCP 未启用", tone: "neutral" },
    starting: { label: "MCP 正在启动", tone: "info" },
    stopping: { label: "MCP 正在停止", tone: "info" },
    ready_waiting_authorization: { label: "服务已就绪，等待授权", tone: "info" },
    authorized_waiting_use: { label: "已授权，等待使用", tone: "ok" },
    recently_used: { label: "近期已使用", tone: "ok" },
    knowledge_degraded: { label: "MCP 可用，知识状态受限", tone: "warning" },
    knowledge_blocked: { label: "MCP 知识不可用", tone: "danger" },
    audit_degraded: { label: "MCP 可用，审计记录异常", tone: "warning" },
    recoverable_error: { label: "MCP 需要处理", tone: "danger" },
  };

  const SERVICE_STATES = {
    stopped: "已停止",
    starting: "正在启动",
    ready: "运行正常",
    stopping: "正在停止",
    error: "运行异常",
  };

  const KNOWLEDGE_STATES = {
    ready: "公开知识摘要可用",
    degraded: "公开知识摘要受限",
    blocked: "公开知识摘要不可用",
  };

  const AUDIT_STATES = {
    disabled: "未启用",
    ready: "记录正常",
    degraded: "记录异常",
  };

  const DIAGNOSTIC_STATES = {
    ready: "检查通过",
    degraded: "部分受限",
    blocked: "检查未通过",
    unknown: "尚未检查",
  };

  const CHECK_LABELS = {
    port: "本地端口",
    tls: "本地 TLS",
    oauth: "客户端授权",
    runtime: "服务运行态",
    policy: "数据访问政策",
    audit: "审计记录",
    knowledge: "知识摘要",
  };

  const CHECK_STATUS = {
    pass: { label: "通过", tone: "ok" },
    warning: { label: "需注意", tone: "warning" },
    fail: { label: "未通过", tone: "danger" },
    unknown: { label: "未检查", tone: "neutral" },
  };

  const EFFECT_LABELS = {
    stop_service: "停止本地 MCP 服务",
    revoke_all_clients: "撤销全部已授权客户端",
    delete_managed_trust: "删除由桌面应用管理的信任配置",
    delete_managed_secrets: "删除由桌面应用管理的安全凭据",
    retain_audit: "保留现有审计记录",
    clear_audit: "清除现有审计记录",
  };

  function formatDateTime(value) {
    const raw = text(value).trim();
    if (!raw) return "/";
    const date = new Date(raw);
    if (Number.isNaN(date.getTime())) return "/";
    return new Intl.DateTimeFormat("zh-CN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  }

  function formatBytes(value) {
    const bytes = Number(value);
    if (!Number.isFinite(bytes) || bytes < 0) return "/";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KiB`;
    return `${(bytes / (1024 * 1024)).toFixed(bytes >= 10 * 1024 * 1024 ? 0 : 1)} MiB`;
  }

  function badge(label, value, tone = "neutral") {
    if (components.StatusBadge?.render) return components.StatusBadge.render({ label, value, tone });
    return `<span class="status-badge status-badge-${escapeHtml(tone)}"><small>${escapeHtml(label)}</small><strong>${escapeHtml(value)}</strong></span>`;
  }

  function settingsTabs(activeRoute) {
    const tabs = [
      { route: "/settings/basic", label: "基础设置" },
      { route: "/settings/ai-integration", label: "AI 集成" },
    ];
    return `
      <nav class="ai-settings-tabs maintenance-section-tabs" aria-label="系统设置">
        ${tabs.map((tab) => {
          const active = tab.route === activeRoute;
          return `
            <button
              class="maintenance-section-tab ${active ? "active" : ""}"
              type="button"
              data-app-route="${escapeHtml(tab.route)}"
              aria-current="${active ? "page" : "false"}"
            >${escapeHtml(tab.label)}</button>
          `;
        }).join("")}
      </nav>
    `;
  }

  function runtimeState({ loading, error }) {
    if (!loading && !error) return "";
    if (components.RuntimeState?.render) {
      return components.RuntimeState.render({
        state: loading ? "loading" : "error",
        title: loading ? "正在读取 AI 集成状态" : "AI 集成状态不可用",
        message: loading
          ? "页面会以本地控制快照为准，完成后自动更新。"
          : error || "请确认本地服务可用后重新加载。",
      });
    }
    return `<section class="ai-settings-runtime" role="${error ? "alert" : "status"}">${escapeHtml(error || "正在加载")}</section>`;
  }

  function actionButton({ action, label, disabled = false, pending = false, kind = "secondary", attrs = "" }) {
    return `
      <button
        class="ai-settings-button is-${escapeHtml(kind)}"
        type="button"
        data-mcp-action="${escapeHtml(action)}"
        ${attrs}
        ${disabled || pending ? "disabled" : ""}
        ${pending ? 'aria-busy="true"' : ""}
      >${escapeHtml(pending ? "处理中…" : label)}</button>
    `;
  }

  function renderBasic(snapshot) {
    const settings = snapshot?.settings || {};
    const status = snapshot?.status || {};
    const display = DISPLAY_STATES[status.display_state] || DISPLAY_STATES.disabled;
    return `
      <div class="ai-settings-basic" data-settings-page="basic">
        <section class="ai-settings-section" aria-labelledby="basicRuntimeTitle">
          <div class="ai-settings-section-head">
            <div>
              <span class="ai-settings-kicker">LOCAL RUNTIME</span>
              <h2 id="basicRuntimeTitle">本地运行配置</h2>
            </div>
            ${badge("AI 集成", display.label, display.tone)}
          </div>
          <dl class="ai-settings-definition-grid">
            <div><dt>运行通道</dt><dd>${escapeHtml(settings.release_channel || "/")}</dd></div>
            <div><dt>本地端口</dt><dd>${escapeHtml(settings.configured_port || "/")}</dd></div>
            <div><dt>服务地址</dt><dd class="ai-settings-code">${escapeHtml(settings.canonical_resource || "/")}</dd></div>
            <div><dt>运行状态</dt><dd>${escapeHtml(SERVICE_STATES[status.service_state] || "/")}</dd></div>
          </dl>
          <p class="ai-settings-section-note">这些值来自本地控制快照。服务启停、客户端授权和重置在“AI 集成”中分别管理。</p>
          <div class="ai-settings-actions">
            <button class="ai-settings-button is-primary" type="button" data-app-route="/settings/ai-integration">打开 AI 集成</button>
          </div>
        </section>
        <section class="ai-settings-section" aria-labelledby="basicBoundaryTitle">
          <div class="ai-settings-section-head">
            <div>
              <span class="ai-settings-kicker">CONTROL BOUNDARY</span>
              <h2 id="basicBoundaryTitle">运行边界</h2>
            </div>
          </div>
          <ul class="ai-settings-boundary-list">
            <li><strong>浏览器</strong><span>读取受控状态，并通过本地 API 请求允许的控制动作。</span></li>
            <li><strong>桌面应用</strong><span>负责系统信任、客户端配置和最终重置确认。</span></li>
            <li><strong>数据访问</strong><span>仅提供政策允许的公开知识摘要，不包含本地用户内容。</span></li>
          </ul>
        </section>
      </div>
    `;
  }

  function renderService(snapshot, pendingAction) {
    const status = snapshot.status;
    const settings = snapshot.settings;
    const capabilities = settings.control_capabilities;
    const pending = ["start", "stop", "retry"].includes(pendingAction);
    const canControl = capabilities.service_control;
    const serviceReady = status.service_state === "ready";
    const serviceError = status.service_state === "error";
    const serviceTransitioning = ["starting", "stopping"].includes(status.service_state);
    const display = DISPLAY_STATES[status.display_state] || DISPLAY_STATES.disabled;
    return `
      <section id="aiServiceStatus" class="ai-settings-section" data-ai-settings-section="service-status" aria-labelledby="aiServiceStatusTitle">
        <div class="ai-settings-section-head">
          <div>
            <span class="ai-settings-kicker">SERVICE</span>
            <h2 id="aiServiceStatusTitle">服务状态</h2>
          </div>
          <div class="ai-settings-status">${badge("MCP", display.label, display.tone)}</div>
        </div>
        <dl class="ai-settings-definition-grid">
          <div><dt>期望状态</dt><dd>${status.desired_state === "enabled" ? "已启用" : "未启用"}</dd></div>
          <div><dt>服务状态</dt><dd>${escapeHtml(SERVICE_STATES[status.service_state] || "/")}</dd></div>
          <div><dt>最近成功使用</dt><dd>${escapeHtml(formatDateTime(status.last_success_at))}</dd></div>
          <div><dt>运行通道</dt><dd>${escapeHtml(settings.release_channel)}</dd></div>
        </dl>
        ${status.recoverable_error ? '<p class="ai-settings-callout is-warning">服务提供了可恢复状态。请先重试；若仍失败，请在桌面应用中检查本地服务。</p>' : ""}
        <div class="ai-settings-actions" aria-describedby="${canControl ? "" : "mcpDesktopRequirement"}">
          ${serviceReady
            ? actionButton({ action: "stop", label: "停止服务", disabled: !canControl || Boolean(pendingAction), pending: pending && pendingAction === "stop" })
            : serviceError
              ? actionButton({ action: "retry", label: "重试启动", disabled: !canControl || Boolean(pendingAction), pending: pending && pendingAction === "retry", kind: "primary" })
              : actionButton({
                  action: "start",
                  label: status.service_state === "starting" ? "正在启动" : status.service_state === "stopping" ? "正在停止" : "启动服务",
                  disabled: !canControl || serviceTransitioning || Boolean(pendingAction),
                  pending: pending && pendingAction === "start",
                  kind: "primary",
                })}
          ${canControl ? "" : '<span id="mcpDesktopRequirement" class="ai-settings-requirement">需要桌面应用</span>'}
        </div>
      </section>
    `;
  }

  function renderConnection(snapshot) {
    const settings = snapshot.settings;
    return `
      <section id="aiClientConnection" class="ai-settings-section" data-ai-settings-section="client-connection" aria-labelledby="aiClientConnectionTitle">
        <div class="ai-settings-section-head">
          <div>
            <span class="ai-settings-kicker">CONNECT CLIENT</span>
            <h2 id="aiClientConnectionTitle">连接客户端</h2>
          </div>
          ${badge("客户端", "Codex / MCP", "info")}
        </div>
        <ol class="ai-settings-step-list">
          <li><span>1</span><div><strong>确认本地服务就绪</strong><p>服务状态应显示“服务已就绪，等待授权”。</p></div></li>
          <li><span>2</span><div><strong>在桌面应用中添加客户端</strong><p>浏览器不会写入客户端配置或修改系统信任。</p></div></li>
          <li><span>3</span><div><strong>核对授权范围</strong><p>授权完成后，客户端会出现在下方清单中。</p></div></li>
        </ol>
        <div class="ai-settings-resource">
          <span>本地 MCP 地址</span>
          <code>${escapeHtml(settings.canonical_resource)}</code>
        </div>
        <p class="ai-settings-requirement">写入客户端配置和系统信任：需要桌面应用</p>
      </section>
    `;
  }

  function renderClients(snapshot, pendingAction) {
    const clients = list(snapshot.clients);
    const canRevoke = snapshot.settings.control_capabilities.client_revocation;
    return `
      <section id="aiAuthorizedClients" class="ai-settings-section" data-ai-settings-section="authorized-clients" aria-labelledby="aiAuthorizedClientsTitle">
        <div class="ai-settings-section-head">
          <div>
            <span class="ai-settings-kicker">AUTHORIZED CLIENTS</span>
            <h2 id="aiAuthorizedClientsTitle">已授权客户端</h2>
          </div>
          ${badge("客户端", `${clients.length} 个`, clients.length ? "ok" : "neutral")}
        </div>
        ${clients.length ? `
          <div class="ai-settings-table-scroll" tabindex="0" aria-label="已授权客户端表格，可横向滚动">
            <table class="ai-settings-table">
              <thead><tr><th scope="col">客户端</th><th scope="col">信任</th><th scope="col">授权范围</th><th scope="col">授权时间</th><th scope="col">最近使用</th><th scope="col">操作</th></tr></thead>
              <tbody>
                ${clients.map((client) => {
                  const revoking = pendingAction === `revoke:${client.client_id}`;
                  const active = client.status === "authorized";
                  return `
                    <tr>
                      <td><strong>${escapeHtml(client.display_name)}</strong><span>${active ? "已授权" : "已撤销"}</span></td>
                      <td>${escapeHtml(client.trust_state === "verified" ? "已验证" : "未验证")}</td>
                      <td><span class="ai-settings-scope-list">${list(client.scopes).map((scope) => `<code>${escapeHtml(scope)}</code>`).join("")}</span></td>
                      <td>${escapeHtml(formatDateTime(client.authorized_at))}</td>
                      <td>${escapeHtml(formatDateTime(client.last_used_at))}</td>
                      <td>
                        <button
                          class="ai-settings-button is-danger"
                          type="button"
                          data-mcp-request-confirmation="revoke"
                          data-mcp-client-id="${escapeHtml(client.client_id)}"
                          data-mcp-client-label="${escapeHtml(client.display_name)}"
                          ${!active || !canRevoke || Boolean(pendingAction) ? "disabled" : ""}
                        >${revoking ? "撤销中…" : "撤销授权"}</button>
                        ${canRevoke ? "" : '<span class="ai-settings-inline-note">需要桌面应用</span>'}
                      </td>
                    </tr>
                  `;
                }).join("")}
              </tbody>
            </table>
          </div>
        ` : '<div class="ai-settings-empty"><strong>暂无已授权客户端</strong><span>服务启动后，请在桌面应用中添加并授权 Codex 客户端。</span></div>'}
      </section>
    `;
  }

  function renderDataAccess(snapshot) {
    const state = snapshot.status.knowledge_state;
    return `
      <section id="aiDataAccess" class="ai-settings-section" data-ai-settings-section="data-access" aria-labelledby="aiDataAccessTitle">
        <div class="ai-settings-section-head">
          <div>
            <span class="ai-settings-kicker">DATA ACCESS</span>
            <h2 id="aiDataAccessTitle">数据访问</h2>
          </div>
          ${badge("知识", KNOWLEDGE_STATES[state] || "状态未知", state === "ready" ? "ok" : state === "degraded" ? "warning" : "danger")}
        </div>
        <div class="ai-settings-policy-grid">
          <div>
            <h3>允许</h3>
            <ul>
              <li>政策允许的公开安全知识摘要</li>
              <li>公开对象的标识、名称与类型</li>
              <li>摘要版本、许可和来源依据</li>
            </ul>
          </div>
          <div>
            <h3>明确排除</h3>
            <ul>
              <li>本地用户笔记、收藏和 Issue 内容</li>
              <li>受限知识正文和内部维护信息</li>
              <li>设备、文件系统和运行实现细节</li>
            </ul>
          </div>
        </div>
        <p class="ai-settings-section-note">页面只展示受控摘要投影。具体客户端授权范围以“已授权客户端”清单为准。</p>
      </section>
    `;
  }

  function renderAudit(snapshot, pendingAction) {
    const audit = snapshot.audit;
    const canClear = snapshot.settings.control_capabilities.audit_clear;
    return `
      <section id="aiPrivacyAudit" class="ai-settings-section" data-ai-settings-section="privacy-audit" aria-labelledby="aiPrivacyAuditTitle">
        <div class="ai-settings-section-head">
          <div>
            <span class="ai-settings-kicker">PRIVACY &amp; AUDIT</span>
            <h2 id="aiPrivacyAuditTitle">隐私与审计</h2>
          </div>
          ${badge("审计", AUDIT_STATES[audit.state] || "状态未知", audit.state === "ready" ? "ok" : audit.state === "degraded" ? "warning" : "neutral")}
        </div>
        <dl class="ai-settings-definition-grid">
          <div><dt>记录状态</dt><dd>${audit.enabled ? "已启用" : "未启用"}</dd></div>
          <div><dt>保留时间</dt><dd>${escapeHtml(`${audit.retention_days} 天`)}</dd></div>
          <div><dt>容量上限</dt><dd>${escapeHtml(formatBytes(audit.retention_bytes))}</dd></div>
          <div><dt>事件数量</dt><dd>${escapeHtml(audit.event_count)}</dd></div>
          <div><dt>最近记录</dt><dd>${escapeHtml(formatDateTime(audit.last_event_at))}</dd></div>
        </dl>
        <p class="ai-settings-section-note">审计仅记录必要的操作元信息，不在此页面展示请求正文或知识正文。</p>
        <div class="ai-settings-actions">
          <button
            class="ai-settings-button is-danger"
            type="button"
            data-mcp-request-confirmation="clear-audit"
            ${!canClear || Boolean(pendingAction) ? "disabled" : ""}
          >${pendingAction === "clear-audit" ? "清除中…" : "清除审计记录"}</button>
          ${canClear ? "" : '<span class="ai-settings-requirement">需要桌面应用</span>'}
        </div>
      </section>
    `;
  }

  function renderDiagnostics(snapshot, pendingAction) {
    const diagnostics = snapshot.diagnostics;
    const checks = list(diagnostics.checks);
    return `
      <section id="aiDiagnosticsReset" class="ai-settings-section" data-ai-settings-section="diagnostics-reset" aria-labelledby="aiDiagnosticsResetTitle">
        <div class="ai-settings-section-head">
          <div>
            <span class="ai-settings-kicker">DIAGNOSTICS &amp; RESET</span>
            <h2 id="aiDiagnosticsResetTitle">诊断与重置</h2>
          </div>
          ${badge("诊断", DIAGNOSTIC_STATES[diagnostics.overall_state] || "状态未知", diagnostics.overall_state === "ready" ? "ok" : diagnostics.overall_state === "blocked" ? "danger" : "warning")}
        </div>
        <div class="ai-settings-diagnostics" role="list" aria-label="诊断检查">
          ${checks.length ? checks.map((check) => {
            const status = CHECK_STATUS[check.status] || CHECK_STATUS.unknown;
            return `
              <div class="ai-settings-diagnostic-row" role="listitem">
                <span><strong>${escapeHtml(CHECK_LABELS[check.check_id] || "本地服务检查")}</strong><small>${check.recovery_action ? "可在桌面应用中继续处理" : "无需操作"}</small></span>
                ${badge("结果", status.label, status.tone)}
              </div>
            `;
          }).join("") : '<div class="ai-settings-empty"><strong>尚无诊断结果</strong><span>本地服务完成检查后会在这里显示。</span></div>'}
        </div>
        <p class="ai-settings-section-note">最近检查：${escapeHtml(formatDateTime(diagnostics.last_checked_at))}。页面不显示运行实现细节或原始记录。</p>
        <div class="ai-settings-reset">
          <div>
            <strong>重置 AI 集成</strong>
            <span>重置与停止服务、撤销单个客户端相互独立。先生成影响清单，最终确认必须由桌面应用完成。</span>
          </div>
          ${actionButton({ action: "prepare-reset", label: "准备重置", disabled: Boolean(pendingAction), pending: pendingAction === "prepare-reset", kind: "danger" })}
        </div>
      </section>
    `;
  }

  function renderConfirmation(confirmation) {
    if (!confirmation) return "";
    const revoke = confirmation.action === "revoke";
    return `
      <div class="ai-settings-dialog-backdrop" data-mcp-dialog="confirmation">
        <section class="ai-settings-dialog" role="dialog" aria-modal="true" aria-labelledby="mcpConfirmTitle" aria-describedby="mcpConfirmDescription">
          <span class="ai-settings-kicker">CONFIRM ACTION</span>
          <h2 id="mcpConfirmTitle">${revoke ? "确认撤销客户端授权" : "确认清除审计记录"}</h2>
          <p id="mcpConfirmDescription">${revoke
            ? `只会撤销“${escapeHtml(confirmation.label)}”的授权，不会停止服务或重置其他客户端。`
            : "该操作只清除审计记录，不会停止服务、撤销客户端或执行重置。"}</p>
          <div class="ai-settings-actions">
            <button class="ai-settings-button is-secondary" type="button" data-mcp-action="cancel-confirmation">取消</button>
            <button class="ai-settings-button is-danger" type="button" data-mcp-confirm-action="${escapeHtml(confirmation.action)}" data-mcp-client-id="${escapeHtml(confirmation.clientId || "")}" autofocus>确认</button>
          </div>
        </section>
      </div>
    `;
  }

  function renderResetPreview(preview) {
    if (!preview) return "";
    return `
      <div class="ai-settings-dialog-backdrop" data-mcp-dialog="reset-preview">
        <section class="ai-settings-dialog" role="dialog" aria-modal="true" aria-labelledby="mcpResetPreviewTitle" aria-describedby="mcpResetPreviewDescription">
          <span class="ai-settings-kicker">RESET PREVIEW</span>
          <h2 id="mcpResetPreviewTitle">重置影响清单</h2>
          <p id="mcpResetPreviewDescription">请核对影响范围。浏览器不会执行最终确认。</p>
          <ul class="ai-settings-effect-list">
            ${list(preview.effects).map((effect) => `<li>${escapeHtml(EFFECT_LABELS[effect] || "受控重置操作")}</li>`).join("")}
          </ul>
          <p class="ai-settings-callout is-warning"><strong>需要桌面应用</strong><span>最终重置需要桌面应用签发一次性原生确认。</span></p>
          <div class="ai-settings-actions">
            <button class="ai-settings-button is-primary" type="button" data-mcp-action="close-reset-preview" autofocus>我知道了</button>
          </div>
        </section>
      </div>
    `;
  }

  function render({
    route = "/settings/ai-integration",
    loading = false,
    error = "",
    snapshot = null,
    pendingAction = "",
    notice = null,
    confirmation = null,
    resetPreview = null,
  } = {}) {
    const activeRoute = route === "/settings/basic" ? "/settings/basic" : "/settings/ai-integration";
    const loadingState = runtimeState({ loading, error });
    const hasSnapshot = snapshot?.contract_version === "sapd-mcp-control-v1";
    const content = loadingState || (!hasSnapshot
      ? runtimeState({ error: "本地控制快照不可用，请重新加载。" })
      : activeRoute === "/settings/basic"
        ? renderBasic(snapshot)
        : `
          <div class="ai-settings-sections" data-settings-page="ai-integration">
            ${renderService(snapshot, pendingAction)}
            ${renderConnection(snapshot)}
            ${renderClients(snapshot, pendingAction)}
            ${renderDataAccess(snapshot)}
            ${renderAudit(snapshot, pendingAction)}
            ${renderDiagnostics(snapshot, pendingAction)}
          </div>
        `);
    return `
      <section class="ai-settings-workspace" data-ai-settings-route="${escapeHtml(activeRoute)}" aria-busy="${loading ? "true" : "false"}">
        <div class="ai-settings-toolbar">
          ${settingsTabs(activeRoute)}
          <button class="ai-settings-button is-secondary" type="button" data-mcp-action="reload" ${loading || pendingAction ? "disabled" : ""}>刷新状态</button>
        </div>
        <div class="ai-settings-live" role="status" aria-live="polite" aria-atomic="true">
          ${notice?.message ? `<span class="is-${escapeHtml(notice.tone || "info")}">${escapeHtml(notice.message)}</span>` : ""}
        </div>
        <div class="ai-settings-scroll">
          ${content}
        </div>
        ${renderConfirmation(confirmation)}
        ${renderResetPreview(resetPreview)}
      </section>
    `;
  }

  components.AiIntegrationSettings = {
    displayStates: DISPLAY_STATES,
    render,
  };
})();
