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
        <button class="maintenance-section-tab ${route === "/settings/privacy-audit" ? "active" : ""}" type="button" data-app-route="/settings/privacy-audit" aria-current="${route === "/settings/privacy-audit" ? "page" : "false"}">隐私与审计</button>
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

  function auditEventPresentation(event = {}, clients = []) {
    const eventType = text(event.event_type).trim();
    const toolName = text(event.tool_name).trim();
    const occurrenceCount = Math.max(1, Number.parseInt(event.occurrence_count, 10) || 1);
    const isGrouped = occurrenceCount > 1;
    const client = clients.find((item) => item?.client_id === event.client_id);
    const toolLabels = {
      search_knowledge: "搜索知识库",
      get_knowledge_object: "读取知识对象",
      get_related_knowledge: "查看关联知识",
      get_source_evidence: "查看来源证据",
      get_knowledge_version: "读取知识库版本",
    };
    const labels = {
      CLIENT_REGISTERED: "客户端发起注册",
      AUTHORIZATION_APPROVED: "客户端授权通过",
      AUTHORIZATION_DENIED: "客户端授权拒绝",
      AUTHORIZATION_TIMEOUT: "授权请求超时",
      TOKEN_ISSUED: "访问凭据签发",
      TOKEN_REFRESHED: "访问凭据续期",
      TOKEN_REVOKED: "访问凭据撤销",
      CLIENT_REVOKED: "客户端授权撤销",
      REFRESH_REUSE: "检测到旧凭据重复使用",
      TOOL_CALL: toolLabels[toolName] || "访问基础知识库",
    };
    const resultCode = text(event.result_code).trim();
    const resultLabels = {
      OK: ["成功", "success"],
      DCR_UNVERIFIED: ["发布方未验证", "warning"],
      AUTH_DENIED: ["已拒绝", "warning"],
      AUTH_TIMEOUT: ["已超时", "warning"],
      TOKEN_REUSED: ["已阻止并撤销", "error"],
      INVALID_INPUT: ["输入不符合要求", "error"],
      OBJECT_NOT_AVAILABLE: ["未找到可访问内容", "warning"],
      RESPONSE_TOO_LARGE: ["返回内容超过限制", "warning"],
      POLICY_BLOCKED: ["已按安全策略阻止", "error"],
      POLICY_EXPIRED: ["知识访问策略已过期", "error"],
      POLICY_SIGNATURE_INVALID: ["策略校验失败", "error"],
      CURSOR_STALE: ["查询结果已更新，请重试", "warning"],
      RATE_LIMITED: ["请求过于频繁", "warning"],
      AUTH_REQUIRED: ["需要重新授权", "warning"],
      REQUEST_TIMEOUT: ["请求超时", "warning"],
      RUNTIME_NOT_READY: ["本机知识服务尚未就绪", "warning"],
      INTERNAL_ERROR: ["本机服务处理失败", "error"],
      RESPONSE_POLICY_VIOLATION: ["返回内容未通过安全检查", "error"],
      UNKNOWN_OBJECT_TYPE: ["不支持的知识对象类型", "error"],
      UNKNOWN_RELATION_TYPE: ["不支持的关系类型", "error"],
    };
    const result = resultLabels[resultCode] || ["需要检查", "error"];
    const toolDetails = [
      event.returned_count === null || event.returned_count === undefined
        ? ""
        : `${isGrouped ? "累计返回" : "返回"} ${Number(event.returned_count) || 0} 条`,
      event.duration_ms === null || event.duration_ms === undefined
        ? ""
        : `${isGrouped ? "累计用时" : "用时"} ${Number(event.duration_ms) || 0} 毫秒`,
    ].filter(Boolean);
    const details = {
      CLIENT_REGISTERED: "客户端已完成动态注册，等待用户确认",
      AUTHORIZATION_APPROVED: "已授予基础知识库只读访问权限",
      AUTHORIZATION_DENIED: "用户拒绝了本次只读访问请求",
      AUTHORIZATION_TIMEOUT: "授权请求在有效期内未完成确认",
      TOKEN_ISSUED: "已为授权客户端签发短期访问凭据",
      TOKEN_REFRESHED: "访问凭据已安全续期",
      TOKEN_REVOKED: "该访问凭据已失效",
      CLIENT_REVOKED: "该客户端已停止访问基础知识库",
      REFRESH_REUSE: "检测到重复使用旧凭据，相关凭据已撤销",
      TOOL_CALL: toolDetails.length ? toolDetails.join(" · ") : "已完成一次只读知识访问",
    };
    const label = labels[eventType] || "本机安全状态变更";
    const detail = eventType === "TOKEN_REFRESHED" && isGrouped
      ? `已合并显示 ${occurrenceCount} 次安全续期`
      : details[eventType] || "已记录一项本机安全状态变化";
    return {
      label: isGrouped ? `${label}（${occurrenceCount} 次）` : label,
      client: client?.display_name || text(event.client_id).trim() || "本机服务",
      detail,
      result: result[0],
      tone: result[1],
    };
  }

  function mcpOverviewPresentation(mcp = {}) {
    const status = mcp.status || {};
    const clients = list(mcp.clients).filter((client) => client?.status !== "revoked");
    const requests = list(mcp.authorization_requests);
    const audit = mcp.audit || {};
    const reconnectState = text(status.reconnect_state).trim();
    const displayState = ["scheduled", "recovering"].includes(reconnectState)
      ? "recovering"
      : text(status.display_state).trim()
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
      disabled: { label: "MCP 未启用", tone: "idle", message: "启动本机服务后，兼容的 MCP 客户端才能发起安全连接与客户端授权。" },
      starting: { label: "MCP 正在启动", tone: "warning", message: "正在建立本机 HTTPS 服务，请稍候查看连接状态。" },
      stopping: { label: "MCP 正在停止", tone: "warning", message: "服务停止后，已授权客户端将暂时无法访问。" },
      recovering: { label: "MCP 正在自动恢复", tone: "warning", message: "检测到本机服务中断，SAPD Wiki 正在自动重新建立连接服务。" },
      recoverable_error: { label: "连接需要处理", tone: "error", message: "本机服务未正常就绪，请按页面提示检查端口、证书或 Runtime。" },
      knowledge_blocked: { label: "知识访问不可用", tone: "error", message: "连接服务可运行，但当前知识策略阻止返回内容。" },
      knowledge_degraded: { label: "知识访问受限", tone: "warning", message: "MCP 可连接，但部分基础知识库内容暂时不可用。" },
      audit_degraded: { label: "审计记录异常", tone: "warning", message: "MCP 可连接，但本地审计状态需要检查。" },
      ready_waiting_authorization: { label: "等待客户端授权", tone: "warning", message: "服务已就绪；从 MCP 客户端发起连接后，在此确认客户端授权。" },
      authorized_waiting_use: { label: "已授权，等待使用", tone: "ready", message: "客户端授权已完成，可以从已授权的 MCP 客户端使用 SAPD Wiki。" },
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
      authorizationMeta: requests.length ? `${requests.length} 个请求等待处理` : clients.length ? "可逐个查看和撤销" : "等待 MCP 客户端发起连接",
      knowledge: knowledgeLabels[status.knowledge_state] || "状态待检查",
      knowledgeTone: status.knowledge_state === "blocked" ? "error" : status.knowledge_state === "degraded" ? "warning" : "ready",
      audit: auditLabels[status.audit_state] || "状态待检查",
      auditMeta: `${Number(audit.event_count) || 0} 条记录 · 保留 ${Number(audit.retention_days) || 0} 天`,
      activity: activityLabels[status.activity_state] || "状态待检查",
      activityMeta: status.last_success_at ? `最近成功：${formatDateTime(status.last_success_at)}` : "尚无成功调用记录",
    };
  }

  function diagnosticCheckLabel(checkId) {
    return {
      runtime: "本机运行环境",
      sidecar_process: "MCP 本机服务",
      loopback_tls: "本机安全连接",
    }[text(checkId).trim()] || text(checkId).trim() || "连接检查";
  }

  function diagnosticStatusLabel(status) {
    return {
      pass: "通过",
      fail: "未通过",
      warning: "需注意",
      unknown: "待检查",
    }[text(status).trim()] || "待检查";
  }

  function diagnosticRecoveryLabel(action) {
    return {
      start_service: "请先启动 MCP 服务",
      retry_service: "请重新启动 MCP 服务",
      change_port: "请修改本地端口后重试",
      unlock_keychain: "请解锁 macOS“登录”钥匙串后重试",
    }[text(action).trim()] || (action ? "请按页面提示处理后重试" : "无需操作");
  }

  function renderAiOverview(mcp, pendingAction) {
    const overview = mcpOverviewPresentation(mcp);
    const serviceState = text(mcp.status?.service_state || mcp.service_state);
    const diagnostics = mcp.diagnostics || {};
    const checks = list(diagnostics.checks);
    const diagnosticState = text(diagnostics.overall_state).trim() || "unknown";
    const diagnosticTone = diagnosticState === "ready" ? "ready" : diagnosticState === "blocked" ? "error" : "idle";
    const diagnosticLabel = diagnosticState === "ready" ? "连接正常" : diagnosticState === "blocked" ? "连接受阻" : "尚未检查";
    const passedChecks = checks.filter((check) => check.status === "pass").length;
    const diagnosticMeta = diagnostics.last_checked_at
      ? `最近检查：${formatDateTime(diagnostics.last_checked_at)} · ${passedChecks}/${checks.length} 项通过`
      : "验证服务、安全连接和客户端访问";
    const diagnosticDisabled = Boolean(pendingAction) || mcp.settings?.control_capabilities?.diagnostic_check === false;
    return `
      <section class="system-settings-panel system-settings-ai-overview" data-settings-section="overview" aria-labelledby="aiOverviewTitle">
        <header class="system-settings-panel-heading">
          <div>
            <span>AI CONNECTION OVERVIEW</span>
            <h2 id="aiOverviewTitle">AI 集成概况</h2>
            <p>${escapeHtml(overview.display.message)}</p>
          </div>
          <b class="system-settings-state is-${escapeHtml(overview.display.tone)}">${escapeHtml(overview.display.label)}</b>
        </header>
        <dl class="system-settings-overview-grid">
          <div class="system-settings-overview-service"><dt>本机服务</dt><dd>${escapeHtml(statusLabel(serviceState))}</dd><small>仅监听 127.0.0.1</small></div>
          <div class="system-settings-overview-authorization"><dt>客户端授权</dt><dd>${escapeHtml(overview.authorization)}</dd><small>${escapeHtml(overview.authorizationMeta)}</small></div>
          <div class="system-settings-overview-diagnostic">
            <dt>连接检查</dt>
            <dd class="is-${escapeHtml(diagnosticTone)}">${escapeHtml(diagnosticLabel)}</dd>
            <small>${escapeHtml(diagnosticMeta)}</small>
            <button type="button" data-mcp-settings-action="check" ${diagnosticDisabled ? "disabled" : ""}>${diagnostics.last_checked_at ? "重新检查" : "立即检查"}</button>
            ${checks.length ? `
              <div class="system-settings-overview-diagnostics" role="list" aria-label="连接检查结果">
                ${checks.map((check) => `
                  <div role="listitem">
                    <span>
                      <strong>${escapeHtml(check.label || diagnosticCheckLabel(check.check_id))}</strong>
                      <small>${escapeHtml(diagnosticRecoveryLabel(check.recovery_action))}</small>
                    </span>
                    <b class="is-${escapeHtml(check.status === "pass" ? "ready" : check.status === "fail" ? "error" : "idle")}">${escapeHtml(diagnosticStatusLabel(check.status))}</b>
                  </div>
                `).join("")}
              </div>
            ` : ""}
          </div>
          <div class="system-settings-overview-knowledge">
            <dt id="aiKnowledgeAccessTitle">知识访问</dt>
            <dd class="system-settings-overview-knowledge-content">
              <strong class="system-settings-overview-knowledge-state is-${escapeHtml(overview.knowledgeTone)}">${escapeHtml(overview.knowledge)}</strong>
              <small>基础知识库全部业务内容（只读）</small>
              <dl class="system-settings-overview-knowledge-list">
                <div><dt>当前开放</dt><dd>基础知识库全部业务内容，包括完整标准正文</dd></div>
                <div><dt>访问方式</dt><dd>5 个只读知识工具</dd></div>
                <div><dt>网络边界</dt><dd>仅本机回环 HTTPS</dd></div>
                <div><dt>明确排除</dt><dd>用户数据、源文件本体、本地路径、系统配置与凭据、日志和非受控 SQL</dd></div>
              </dl>
              <p>AI 可以检索和使用基础知识库中的全部知识内容。知识内容仅用于查询、分析和引用，不能改变系统权限或指挥系统执行操作。</p>
            </dd>
          </div>
        </dl>
      </section>
    `;
  }

  function certificatePresentation(certificate = {}) {
    const state = text(certificate.state).trim() || "not_configured";
    const reason = text(certificate.reason_code).trim();
    if (state === "error" && reason === "CERTIFICATE_SECRET_STORE_UNAVAILABLE") {
      return {
        state,
        label: "安全存储暂不可用",
        tone: "warning",
        message: "当前用户安全存储暂时无法读取；已运行的 MCP 会保持服务，请解锁后重新启动。",
      };
    }
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

  function certificateStoragePresentation(mcp = {}) {
    return text(mcp.settings?.release_channel).trim() === "dev"
      ? "~/Library/Application Support/SAPD Wiki/LocalMCP/Certificates/dev"
      : "App 保存位置/Runtime/data/mcp/certificates";
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
    const certificateStorage = certificateStoragePresentation(mcp);
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
          <div>
            <dt>证书目录</dt>
            <dd class="system-settings-certificate-storage"><code>${escapeHtml(certificateStorage)}</code></dd>
          </div>
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
      label: verified ? "预注册客户端" : "动态注册",
      tone: verified ? "verified" : "unverified",
    };
  }

  function compactIdentifier(value) {
    const normalized = text(value).trim();
    return normalized.length > 20
      ? `${normalized.slice(0, 8)}…${normalized.slice(-4)}`
      : normalized || "/";
  }

  function renderAuthorizationAttention(mcp) {
    const requests = list(mcp.authorization_requests);
    if (!requests.length) return "";
    const nextRequest = requests[0] || {};
    const clientName = text(nextRequest.client_name || nextRequest.client_id).trim() || "AI 客户端";
    return `
      <aside class="system-settings-authorization-attention" data-settings-section="authorization-attention" role="alert" aria-labelledby="aiAuthorizationAttentionTitle">
        <div>
          <span>需要您的确认</span>
          <strong id="aiAuthorizationAttentionTitle">${escapeHtml(clientName)} 正在请求只读访问基础知识库</strong>
          <small>${requests.length > 1 ? `共 ${requests.length} 个请求等待处理；` : ""}请在 ${escapeHtml(formatDateTime(nextRequest.expires_at))} 前允许或拒绝。授权成功后，浏览器会显示 “Authentication complete”。</small>
        </div>
        <button type="button" data-app-route="/settings/ai-integration" data-settings-anchor="aiAuthorizationPanel">查看授权请求</button>
      </aside>
    `;
  }

  function renderAuthorizationRequests(mcp, pendingAction) {
    const requests = list(mcp.authorization_requests);
    if (!requests.length) return "";
    const capabilities = mcp.settings?.control_capabilities || {};
    const decisionDisabled = Boolean(pendingAction) || capabilities.authorization_decision === false;
    return `
      <section id="aiAuthorizationPanel" class="system-settings-panel" data-settings-section="authorization-requests" aria-labelledby="aiAuthorizationTitle" tabindex="-1">
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
                  <div>
                    <span>请求 ${index + 1} / ${requests.length}</span>
                    <strong>${escapeHtml(request.client_name || request.client_id)}</strong>
                    <p>申请使用 5 个只读知识工具查询基础知识库；不会获得用户数据、文件路径、系统配置或数据库直连权限。</p>
                  </div>
                  <b class="system-settings-trust is-${escapeHtml(trust.tone)}">${escapeHtml(trust.label)}</b>
                </div>
                <div class="system-settings-authorization-decision">
                  <dl>
                    <div><dt>请求权限</dt><dd>只读访问基础知识库</dd></div>
                    <div><dt>有效时间</dt><dd>${escapeHtml(formatDateTime(request.expires_at))} 前</dd></div>
                  </dl>
                  <div class="system-settings-actions">
                    <button class="is-primary" type="button" data-mcp-authorization-action="allow" data-mcp-authorization-request-id="${escapeHtml(request.request_id)}" ${decisionDisabled ? "disabled" : ""}>允许只读访问</button>
                    <button type="button" data-mcp-authorization-action="deny" data-mcp-authorization-request-id="${escapeHtml(request.request_id)}" ${decisionDisabled ? "disabled" : ""}>拒绝</button>
                  </div>
                </div>
                <details class="system-settings-authorization-details">
                  <summary>查看技术信息</summary>
                  <dl class="system-settings-authorization-grid">
                    <div><dt>Client ID</dt><dd class="system-settings-code">${escapeHtml(request.client_id)}</dd></div>
                    <div><dt>Redirect URI</dt><dd class="system-settings-code">${escapeHtml(request.redirect_uri)}</dd></div>
                    <div><dt>Scope</dt><dd>${list(request.scopes).map((scope) => `<code>${escapeHtml(scope)}</code>`).join(" ") || "/"}</dd></div>
                    <div><dt>Resource</dt><dd class="system-settings-code">${escapeHtml(request.resource)}</dd></div>
                    <div><dt>数据策略</dt><dd>${escapeHtml(request.policy_version || "/")}</dd></div>
                  </dl>
                </details>
              </article>
            `;
          }).join("")}
        </div>
      </section>
    `;
  }

  function renderClients(mcp, pendingAction) {
    const clients = list(mcp.clients).filter((client) => client?.status !== "revoked");
    const capabilities = mcp.settings?.control_capabilities || {};
    const revokeDisabled = Boolean(pendingAction) || capabilities.client_revocation === false;
    return `
      <section id="aiClientsPanel" class="system-settings-panel" data-settings-section="clients" aria-labelledby="aiClientsTitle" tabindex="-1">
        <header class="system-settings-panel-heading">
          <div>
            <span>AUTHORIZED CLIENTS</span>
            <h2 id="aiClientsTitle">客户端授权</h2>
            <p>查看已获准访问的 MCP 客户端、只读范围和最近使用情况。</p>
          </div>
          <b class="system-settings-state">${clients.length ? `已授权 ${clients.length} 个` : "未授权"}</b>
        </header>
        ${clients.length
          ? `<div class="system-settings-client-table" role="table" aria-label="已授权客户端">
              <div class="system-settings-client-table-head" role="row">
                <span role="columnheader">客户端</span>
                <span role="columnheader">访问范围</span>
                <span role="columnheader">使用记录</span>
                <span role="columnheader">操作</span>
              </div>
              <div class="system-settings-client-list" role="rowgroup">
              ${clients.map((client) => {
                const trust = trustState(client.trust_state);
                const clientLabel = client.display_name || client.client_id;
                return `
                  <article role="row">
                    <div class="system-settings-client-identity" role="cell">
                      <strong>${escapeHtml(clientLabel)}</strong>
                      <span class="system-settings-trust is-${escapeHtml(trust.tone)}">${escapeHtml(trust.label)}</span>
                      <small class="system-settings-code" title="${escapeHtml(client.client_id)}">Client ID ${escapeHtml(compactIdentifier(client.client_id))}</small>
                    </div>
                    <div class="system-settings-client-access" role="cell">
                      <strong>基础知识库（只读）</strong>
                      <small>${list(client.scopes).map((scope) => `<code>${escapeHtml(scope)}</code>`).join(" ") || "/"}</small>
                    </div>
                    <dl class="system-settings-client-activity" role="cell">
                      <div><dt>最近使用</dt><dd>${escapeHtml(formatDateTime(client.last_used_at))}</dd></div>
                      <div><dt>授权时间</dt><dd>${escapeHtml(formatDateTime(client.authorized_at))}</dd></div>
                    </dl>
                    <button class="system-settings-revoke-button" type="button" data-mcp-request-confirmation="revoke" data-mcp-client-id="${escapeHtml(client.client_id)}" data-mcp-client-label="${escapeHtml(clientLabel)}" aria-label="撤销 ${escapeHtml(clientLabel)} 的授权" title="撤销客户端授权" ${revokeDisabled ? "disabled" : ""}>撤销授权</button>
                  </article>
                `;
              }).join("")}
              </div>
              <p class="system-settings-client-trust-note">“动态注册”表示客户端临时向 SAPD Wiki 注册了名称和回调地址，SAPD Wiki 未验证其软件发布方身份。这不代表 HTTPS 连接不安全，也不代表客户端已经获得授权；请核对客户端名称、回调地址和只读范围。</p>
            </div>`
          : `<div class="system-settings-client-empty">
              <div>
                <strong>尚未连接 MCP 客户端</strong>
                <span>客户端完成首次连接并经您确认后，会在这里显示。</span>
              </div>
              <ol aria-label="客户端授权步骤">
                <li><b>1</b><span>启动 MCP 服务</span></li>
                <li><b>2</b><span>复制 HTTP Stream 地址或打开 WorkBuddy 配置引导</span></li>
                <li><b>3</b><span>返回本页确认授权请求</span></li>
              </ol>
            </div>`}
      </section>
    `;
  }

  function renderAudit(mcp, pendingAction) {
    const audit = mcp.audit || {};
    const eventCount = Number.isInteger(Number(audit.event_count)) ? Number(audit.event_count) : 0;
    const displayLimit = Number(audit.display_limit) || 30;
    const displayedEventCount = Math.min(eventCount, displayLimit);
    const recentEvents = list(audit.recent_events).slice(0, 10);
    const page = Math.max(1, Number.parseInt(audit.page, 10) || 1);
    const pageCount = Math.max(1, Number.parseInt(audit.page_count, 10) || 1);
    const pageSize = 10;
    const pageStart = displayedEventCount ? ((page - 1) * pageSize) + 1 : 0;
    const pageEnd = displayedEventCount ? Math.min(displayedEventCount, page * pageSize) : 0;
    const clients = list(mcp.clients);
    const capabilities = mcp.settings?.control_capabilities || {};
    const clearDisabled = Boolean(pendingAction) || capabilities.audit_clear === false || eventCount === 0;
    const retentionDays = Number(audit.retention_days) || 30;
    const maxEvents = Number(audit.max_events) || 100;
    const maxMegabytes = Math.max(1, Math.round((Number(audit.retention_bytes) || (20 * 1024 * 1024)) / 1024 / 1024));
    return `
      <section class="system-settings-panel" data-settings-section="audit" aria-labelledby="privacyAuditTitle">
        <header class="system-settings-panel-heading">
          <div>
            <span>PRIVACY &amp; AUDIT</span>
            <h2 id="privacyAuditTitle">审计记录</h2>
            <p>按时间查看本机 AI 客户端的授权、知识访问与安全事件。</p>
          </div>
          <b class="system-settings-state">${escapeHtml(audit.state === "ready" ? "记录正常" : audit.enabled === false ? "未启用" : "状态待检查")}</b>
        </header>
        <dl class="system-settings-audit-grid">
          <div><dt>已记录事件</dt><dd><strong>${escapeHtml(eventCount)}</strong> 条</dd></div>
          <div><dt>最近事件</dt><dd>${escapeHtml(formatDateTime(audit.last_event_at))}</dd></div>
          <div><dt>自动清理</dt><dd>${escapeHtml(retentionDays)} 天或 ${escapeHtml(maxEvents.toLocaleString("zh-CN"))} 条</dd></div>
          <div><dt>容量上限</dt><dd>${escapeHtml(maxMegabytes)}MB · 独立控制库</dd></div>
        </dl>
        <div class="system-settings-audit-events" aria-label="最近审计事件">
          <div class="system-settings-audit-events-heading">
            <strong>最近记录</strong>
            <span>每页读取 10 条原始记录 · 自动合并相似成功事件</span>
          </div>
          ${recentEvents.length
            ? `<div class="system-settings-audit-columns" aria-hidden="true">
                <span>时间</span>
                <span>事件</span>
                <span>记录内容</span>
                <span>结果</span>
              </div>`
            : ""}
          ${recentEvents.length
            ? `<ol>${recentEvents.map((event) => {
                const view = auditEventPresentation(event, clients);
                const firstOccurredAt = text(event.first_occurred_at).trim();
                const lastOccurredAt = text(event.last_occurred_at).trim();
                const timeTitle = firstOccurredAt && lastOccurredAt && firstOccurredAt !== lastOccurredAt
                  ? `${formatDateTime(firstOccurredAt)} 至 ${formatDateTime(lastOccurredAt)}`
                  : "";
                return `<li>
                  <time datetime="${escapeHtml(event.occurred_at)}"${timeTitle ? ` title="${escapeHtml(timeTitle)}"` : ""}>${escapeHtml(formatDateTime(event.occurred_at))}</time>
                  <span class="system-settings-audit-event-copy">
                    <strong>${escapeHtml(view.label)}</strong>
                    <small>${escapeHtml(view.client)}</small>
                  </span>
                  <span class="system-settings-audit-event-detail">${escapeHtml(view.detail)}</span>
                  <b class="system-settings-audit-result is-${escapeHtml(view.tone)}">${escapeHtml(view.result)}</b>
                </li>`;
              }).join("")}</ol>`
            : '<div class="system-settings-audit-empty">暂无审计记录。客户端完成授权或调用知识工具后，将在这里显示操作时间、对象和结果。</div>'}
          <nav class="system-settings-audit-pagination" aria-label="审计记录分页">
            <span>原始记录 ${escapeHtml(pageStart)}–${escapeHtml(pageEnd)}，本页合并为 ${escapeHtml(recentEvents.length)} 组${eventCount > displayedEventCount ? `（共存储 ${escapeHtml(eventCount)} 条）` : ""}</span>
            <div>
              <button type="button" data-mcp-audit-page="${escapeHtml(page - 1)}" ${page <= 1 ? "disabled" : ""}>上一页</button>
              <b>第 ${escapeHtml(page)} / ${escapeHtml(pageCount)} 页</b>
              <button type="button" data-mcp-audit-page="${escapeHtml(page + 1)}" ${page >= pageCount ? "disabled" : ""}>下一页</button>
            </div>
          </nav>
        </div>
        <div class="system-settings-audit-footer">
          <p class="system-settings-panel-note">记录客户端、操作类型、返回数量、耗时和处理结果；不保存用户问题、搜索词或知识正文。连续的成功续期和同工具调用只在界面合并，底层审计仍逐条保留；授权、撤销、失败和异常事件不合并。记录保存在独立 MCP 控制库，不进入收藏、批注等用户业务数据库；达到 ${escapeHtml(retentionDays)} 天、${escapeHtml(maxEvents.toLocaleString("zh-CN"))} 条或 ${escapeHtml(maxMegabytes)}MB 任一上限时，自动删除最旧记录。页面只查询最近 ${escapeHtml(displayLimit)} 条。</p>
          <button type="button" data-mcp-request-confirmation="clear-audit" ${clearDisabled ? "disabled" : ""}>清除审计记录</button>
        </div>
      </section>
    `;
  }

  function renderPrivacyAudit(model) {
    const audit = model.mcp?.audit || {};
    const retentionDays = Number(audit.retention_days) || 30;
    const maxEvents = Number(audit.max_events) || 100;
    const maxMegabytes = Math.max(1, Math.round((Number(audit.retention_bytes) || (20 * 1024 * 1024)) / 1024 / 1024));
    const displayLimit = Number(audit.display_limit) || 30;
    return `
      <div class="system-settings-ai system-settings-privacy-audit" data-settings-page="privacy-audit">
        <section class="system-settings-audit-policy-grid" data-settings-section="audit-policy" aria-label="隐私与审计策略">
          <article class="system-settings-panel system-settings-audit-policy">
            <span>PRIVACY BOUNDARY</span>
            <h2>隐私边界</h2>
            <dl>
              <div><dt>会记录</dt><dd>客户端、操作类型、返回数量、耗时和处理结果</dd></div>
              <div><dt>不会记录</dt><dd>用户问题、搜索词、查询正文和知识正文</dd></div>
              <div><dt>使用目的</dt><dd>仅用于本机访问审计、安全检查和故障定位</dd></div>
            </dl>
          </article>
          <article class="system-settings-panel system-settings-audit-policy">
            <span>STORAGE GOVERNANCE</span>
            <h2>存储与自动清理</h2>
            <dl>
              <div><dt>存储位置</dt><dd>独立 MCP 控制库，不进入用户业务数据库</dd></div>
              <div><dt>三重上限</dt><dd>${escapeHtml(retentionDays)} 天、${escapeHtml(maxEvents)} 条或 ${escapeHtml(maxMegabytes)}MB</dd></div>
              <div><dt>页面范围</dt><dd>只查询最近 ${escapeHtml(displayLimit)} 条，每页读取 10 条并合并相似事件</dd></div>
            </dl>
          </article>
        </section>
        ${renderAudit(model.mcp || {}, model.pendingAction)}
      </div>
    `;
  }

  function renderMaintenance(mcp, pendingAction) {
    const capabilities = mcp.settings?.control_capabilities || {};
    const resetDisabled = Boolean(pendingAction) || capabilities.web_reset_confirmation === false;
    return `
      <section class="system-settings-maintenance" data-settings-section="maintenance" aria-labelledby="aiMaintenanceTitle">
        <div>
          <span>MAINTENANCE</span>
          <h2 id="aiMaintenanceTitle">维护操作</h2>
          <p>仅在需要重新建立本机证书、客户端授权和本地凭据时使用；License、知识库与用户数据不受影响。</p>
        </div>
        <div class="system-settings-actions">
          <button class="is-danger" type="button" data-mcp-action="prepare-reset" ${resetDisabled ? "disabled" : ""}>重置 AI 集成</button>
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

  function certificateFailureMessage(code) {
    return {
      CERTIFICATE_TRUST_CONFIRMATION_TIMEOUT: "等待系统确认超时。请重新操作，并在 2 分钟内于系统提示中选择允许。",
      CERTIFICATE_TRUST_USER_DENIED: "系统未允许写入当前用户信任。请重新操作，并在系统提示中选择允许。",
      CERTIFICATE_TRUST_VERIFY_FAILED: "证书已写入，但 127.0.0.1 安全连接校验未通过；系统已自动回滚。",
      SECRET_STORE_UNAVAILABLE: "macOS“登录”钥匙串当前锁定或无法验证；请在“钥匙串访问”中解锁“登录”钥匙串后重试，不要再次重置。",
      SECRET_WRITE_FAILED: "证书密钥未能保存到当前用户安全存储；系统已自动回滚。",
    }[text(code).trim()] || "";
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
            : "确认后将修改当前用户的本机信任设置；操作系统可能弹出确认提示，请在 2 分钟内选择允许。不会写入系统级或其他用户证书库。"}</p>
          <div class="system-settings-actions">
            <button type="button" data-mcp-action="close-certificate-preview" autofocus>取消</button>
            <button class="is-primary" type="button" data-mcp-action="confirm-certificate">${escapeHtml(button)}</button>
          </div>
        </section>
      </div>
    `;
  }

  function renderWorkbuddyGuide(guide = {}) {
    const configuredPort = Number(guide.configuredPort) || "";
    const canonicalResource = configuredPort
      ? `https://127.0.0.1:${configuredPort}/mcp`
      : text(guide.canonicalResource).trim();
    const dataRoot = text(guide.system?.dataRoot).trim();
    const runtimeRoot = text(guide.system?.runtimeRoot).trim()
      || (dataRoot ? `${dataRoot}/Runtime` : "");
    const systemPaths = [
      guide.system?.userHome,
      dataRoot,
      runtimeRoot,
      guide.system?.importDirectory,
      guide.system?.downloadDirectory,
    ].map((value) => text(value).trim());
    const userHome = text(guide.system?.userHome).trim() || systemPaths
      .map((value) => value.match(/^\/Users\/[^/]+/)?.[0] || "")
      .find(Boolean) || "";
    const certificateReady = text(guide.certificate?.state).trim() === "valid";
    const certificateProfile = text(guide.certificate?.profile).trim();
    const appCertificateManifest = runtimeRoot
      ? `${runtimeRoot}/data/mcp/certificates/active-manifest.json`
      : "";
    const webCertificateManifest = userHome
      ? `${userHome}/Library/Application Support/SAPD Wiki/LocalMCP/Certificates/dev/active-manifest.json`
      : "";
    const profileCertificateManifest = certificateProfile === "app"
      ? appCertificateManifest
      : certificateProfile === "dev"
        ? webCertificateManifest
        : "";
    const certificateManifestCandidates = [...new Set(
      (profileCertificateManifest
        ? [profileCertificateManifest]
        : [appCertificateManifest, webCertificateManifest])
        .filter(Boolean),
    )];
    const workbuddyCaPath = userHome
      ? `${userHome}/.workbuddy/certs/sapd-wiki-app-ca.pem`
      : "";
    const expectedCaFingerprint = text(guide.certificate?.ca_fingerprint_sha256).trim();
    const buildWorkbuddyServer = (command, pathValue) => ({
      type: "stdio",
      command,
      args: [
        "-y",
        "mcp-remote@0.1.38",
        canonicalResource,
        "--host",
        "127.0.0.1",
        "--transport",
        "http-only",
        "--auth-timeout",
        "300",
      ],
      env: {
        NODE_EXTRA_CA_CERTS: workbuddyCaPath,
        NO_PROXY: "127.0.0.1,localhost",
        MCP_REMOTE_CONFIG_DIR: `${userHome}/.workbuddy/mcp-auth/sapd-wiki`,
        PATH: pathValue,
      },
      disabled: false,
    });
    const canConfigureWorkbuddy = certificateReady
      && canonicalResource
      && userHome
      && certificateManifestCandidates.length;
    const workbuddyConfig = canConfigureWorkbuddy
      ? JSON.stringify({
          mcpServers: {
            "SAPD Wiki": buildWorkbuddyServer(
              "__NPX_ABSOLUTE_PATH__",
              "__NODE_BIN__:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin",
            ),
          },
        }, null, 2)
      : "";
    const manifestCandidateList = certificateManifestCandidates
      .map((value, index) => `${index + 1}. ${value}`)
      .join("\n");
    const manifestSelectionInstruction = certificateManifestCandidates.length === 1
      ? `读取 SAPD Wiki 当前证书清单：
${certificateManifestCandidates[0]}

要求清单是有效 JSON，并包含 ca_relative_path 和 ca_fingerprint_sha256。`
      : `SAPD Wiki 未返回明确的证书 profile。只检查以下候选，不要全盘搜索：
${manifestCandidateList}

读取存在且有效的 active-manifest.json，要求包含 ca_relative_path 和 ca_fingerprint_sha256。`;
    const workbuddyPrompt = workbuddyConfig
      ? `请帮我在本机完成 SAPD Wiki 的 WorkBuddy MCP 配置。

SAPD Wiki 当前页面已经确定：
- MCP 地址：${canonicalResource}
- WorkBuddy 配置文件：${userHome}/.workbuddy/mcp.json
- CA 导出位置：${workbuddyCaPath}
${expectedCaFingerprint ? `- 当前 CA 指纹：${expectedCaFingerprint}` : "- 当前 CA 指纹：页面未返回，请从有效清单读取"}

安全边界：
- 不要生成、更新或重置 SAPD Wiki 证书。
- 不要读取、复制或导出 server_key_relative_path、任何 .key 文件、口令或 Keychain 内容。
- 不要关闭 TLS 校验；NODE_EXTRA_CA_CERTS 只用于增加本机 CA 信任。
- 不要替我批准 OAuth，也不要删除已有 token 或未确认归属的 lockfile。

请按顺序执行：

1. 选择当前 CA 清单
${manifestSelectionInstruction}
${expectedCaFingerprint
  ? `将清单中的 CA 指纹与页面提供的 ${expectedCaFingerprint} 比较，忽略大小写与冒号格式差异；不一致时停止。`
  : "如果存在多个有效候选，停止并列出路径，不要自行猜测。"}

2. 导出并校验 CA
以选中清单的父目录为根解析 ca_relative_path，确认解析结果仍在该目录内且是普通 PEM 证书。创建 ${userHome}/.workbuddy/certs，只复制该 ca.pem 到 ${workbuddyCaPath}。
校验源文件与目标文件 SHA-256 一致，用 openssl x509 读取目标证书并核对清单中的 CA 指纹；目标文件不得包含 PRIVATE KEY。

3. 检测 WorkBuddy 可用的 Node 与 npx
不要假设 /opt/homebrew/bin/npx 一定存在。按顺序检查：
- ${userHome}/.workbuddy/binaries/node/versions/*/bin：从版本目录中选择同时具有可执行 node 和 npx 的最高版本。
- /opt/homebrew/bin：要求 node 和 npx 都可执行。
- /usr/local/bin：要求 node 和 npx 都可执行。

记录 npx 的绝对路径 NPX_ABSOLUTE_PATH 和其所在目录 NODE_BIN。使用 PATH="NODE_BIN:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin" 执行 npx --version；失败时停止并报告，不要继续写配置。

4. 备份并合并配置
确保 ${userHome}/.workbuddy/mcp-auth/sapd-wiki 存在。为 ${userHome}/.workbuddy/mcp.json 创建带时间戳的备份；原文件不存在时按 {"mcpServers":{}} 初始化。
将下方模板中的 __NPX_ABSOLUTE_PATH__ 和 __NODE_BIN__ 替换为刚才检测到的绝对路径。最终文件中不得保留占位符或使用 ~。只合并或更新 mcpServers["SAPD Wiki"]，保留其他所有 MCP 配置。

目标配置模板：
${workbuddyConfig}

5. 验证最终配置
验证 JSON 有效，并逐项核对：
- command 是已验证的 npx 绝对路径；
- env.PATH 以对应 NODE_BIN 开头；
- NODE_EXTRA_CA_CERTS 正好等于 ${workbuddyCaPath}；
- MCP 地址正好等于 ${canonicalResource}；
- 配置中没有 __NPX_ABSOLUTE_PATH__、__NODE_BIN__ 或以 ~ 开头的路径。

6. 模拟 WorkBuddy 启动
使用最终配置的 command、args 和完整 env，在有限超时内启动 mcp-remote，并通过非空 stdin 发起 MCP initialize。只停止本次测试启动的进程。
- 如果进程立即退出，分别报告 Node/PATH、npm 下载、TLS/CA 或端口占用错误，不要只写“Connection closed”。
- 如果出现 OAuth 地址或等待授权状态，说明 Node、stdio 和 TLS 启动链路已通过；不要替我授权，也不要把“尚未授权”误判为启动失败。
- 如果已有 token，则要求收到 initialize 响应。

7. 报告结果
报告实际使用的清单与 CA 路径、CA 指纹、npx 路径、NODE_BIN、写入的 PATH、配置备份位置和启动验证结果。提醒我重启 WorkBuddy；首次连接后由我回到 SAPD Wiki 确认 OAuth 只读授权。`
      : "";
    return `
      <div class="system-settings-dialog-backdrop" data-mcp-dialog>
        <section class="system-settings-dialog system-settings-workbuddy-dialog" role="dialog" aria-modal="true" aria-labelledby="mcpWorkbuddyTitle" aria-describedby="mcpWorkbuddyDescription">
          <span>WORKBUDDY SETUP</span>
          <h2 id="mcpWorkbuddyTitle">WorkBuddy 配置引导</h2>
          <p id="mcpWorkbuddyDescription">按以下 4 步完成 WorkBuddy 配置。</p>
          <div class="system-settings-workbuddy-certificate is-${certificateReady ? "ready" : "warning"}">
            <strong>1. 生成连接证书</strong>
            <span>${certificateReady
              ? "已完成。WorkBuddy 只会复制 CA 证书，不会接触服务端私钥。"
              : "关闭本窗口，在“安全连接证书”中完成生成后再继续。"}</span>
          </div>
          ${workbuddyConfig
            ? `<details class="system-settings-workbuddy-copy-section">
                <summary><span><strong>2. 核对 JSON 模板</strong><small>确认端口和 CA 路径；Node 路径由提示词自动填写</small></span></summary>
                <pre class="system-settings-workbuddy-json" data-workbuddy-json tabindex="0"><code>${escapeHtml(workbuddyConfig)}</code></pre>
              </details>
              <details class="system-settings-workbuddy-copy-section">
                <summary><span><strong>3. 复制配置提示词</strong><small>交给 WorkBuddy 自动完成配置</small></span></summary>
                <pre class="system-settings-workbuddy-prompt" data-workbuddy-prompt tabindex="0">${escapeHtml(workbuddyPrompt)}</pre>
              </details>`
            : `<div class="system-settings-workbuddy-step is-disabled" aria-disabled="true">
                <strong>2. 核对 JSON 模板</strong>
                <span>${certificateReady ? "正在读取本机配置路径，请刷新状态后重试。" : "生成连接证书后开放。"}</span>
              </div>
              <div class="system-settings-workbuddy-step is-disabled" aria-disabled="true">
                <strong>3. 复制配置提示词</strong>
                <span>${certificateReady ? "正在读取本机配置路径，请刷新状态后重试。" : "生成连接证书后开放。"}</span>
              </div>`}
          <div class="system-settings-workbuddy-next">
            <strong>4. 重启并授权</strong>
            <span>重启 WorkBuddy。首次连接后，返回本页确认 OAuth 只读授权。</span>
          </div>
          <div class="system-settings-workbuddy-copy-status" data-workbuddy-copy-status role="status" aria-live="polite"></div>
          <div class="system-settings-actions">
            <button type="button" data-mcp-action="close-workbuddy-guide" autofocus>关闭</button>
            <button type="button" data-mcp-copy-workbuddy ${workbuddyConfig ? "" : "disabled"}>复制 JSON 模板</button>
            <button type="button" data-mcp-copy-workbuddy-prompt ${workbuddyPrompt ? "" : "disabled"}>复制配置提示词</button>
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
    const canonicalResource = text(settings.canonical_resource || mcp.canonical_resource);
    const configuredPort = Number(settings.configured_port || mcp.configured_port) || "";
    const serviceAction = running ? "stop" : errorState ? "retry" : "start";
    return `
      <div class="system-settings-ai" data-settings-page="ai-integration">
        ${renderAiOverview(mcp, model.pendingAction)}
        ${renderAuthorizationAttention(mcp)}
        ${renderAuthorizationRequests(mcp, model.pendingAction)}
        <div class="system-settings-ai-connection-grid" data-settings-section="connection">
          <section class="system-settings-panel system-settings-runtime-panel" aria-labelledby="aiRuntimeTitle">
            <header class="system-settings-panel-heading">
              <div>
                <span>LOCAL RUNTIME</span>
                <h2 id="aiRuntimeTitle">MCP 连接配置</h2>
                <p>配置本机端口，并复制 MCP 客户端所需的连接信息。</p>
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
              <div><dt>服务地址</dt><dd class="system-settings-code">${escapeHtml(canonicalResource || "/")}</dd><small>供本机 MCP 客户端连接使用</small></div>
            </dl>
            ${settings.auto_restore ? `<p class="system-settings-callout">${status.desired_state === "enabled"
              ? "已开启自动恢复：重启 SAPD Wiki 后会自动启动 MCP；服务异常中断时会自动重试，已授权客户端无需重新批准。"
              : "当前已手动停止 MCP；下次启动 SAPD Wiki 时不会自动启动。再次点击“启动 MCP”后会恢复自动启动与断线恢复。"
            }</p>` : ""}
            ${status.recoverable_error ? `<p class="system-settings-callout is-warning">${escapeHtml(
              status.recoverable_error.recovery_action === "change_port"
                ? "当前端口被占用，请修改端口后重新启动；主 Web 页面不受影响。"
                : certificateFailureMessage(status.recoverable_error.code)
                  || "本地 MCP 启动失败，可检查 Runtime 后重试；主 Web 页面不受影响。",
            )}</p>` : ""}
            <div class="system-settings-runtime-footer">
              <div class="system-settings-actions system-settings-runtime-actions">
                <button class="is-primary" type="button" data-mcp-settings-action="${escapeHtml(serviceAction)}" ${serviceDisabled ? "disabled" : ""}>${escapeHtml(model.pendingAction || transitioning ? "处理中…" : serviceAction === "stop" ? "停止 MCP" : serviceAction === "retry" ? "重试启动" : "启动 MCP")}</button>
                <button type="button" data-mcp-copy-url="${escapeHtml(canonicalResource)}" ${canonicalResource ? "" : "disabled"}>复制 HTTP Stream 地址</button>
                <button type="button" data-mcp-workbuddy-guide="${escapeHtml(canonicalResource)}">WorkBuddy 配置引导</button>
              </div>
            </div>
          </section>
          ${renderCertificate(mcp, model.pendingAction)}
        </div>
        ${renderClients(mcp, model.pendingAction)}
        ${renderMaintenance(mcp, model.pendingAction)}
      </div>
    `;
  }

  function render(model = {}) {
    const route = ["/settings/ai-integration", "/settings/privacy-audit"].includes(model.route)
      ? model.route
      : "/settings/system";
    const notice = typeof model.notice === "string" ? model.notice : model.notice?.message || "";
    const noticeTone = ["success", "error", "warning", "info"].includes(text(model.notice?.tone))
      ? text(model.notice.tone)
      : "info";
    const unavailable = route !== "/settings/system" && !model.loading && !model.mcp?.contract_version;
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
              : route === "/settings/privacy-audit"
                ? renderPrivacyAudit(model)
                : renderAi(model)}
        </div>
        ${model.workbuddyGuide
          ? renderWorkbuddyGuide({
              canonicalResource: model.mcp?.settings?.canonical_resource || model.mcp?.canonical_resource,
              configuredPort: model.mcp?.settings?.configured_port || model.mcp?.configured_port,
              certificate: model.mcp?.certificate,
              system: model.system,
            })
          : model.certificatePreview
            ? renderCertificatePreview(model.certificatePreview, model.mcp?.certificate)
            : model.resetPreview
              ? renderResetPreview(model.resetPreview)
              : renderConfirmation(model.confirmation)}
      </section>
    `;
  }

  components.SystemSettings = { render };
})();
