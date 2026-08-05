(() => {
  const DATA_PATHS = {
    capability: "./public/data/capability-tree.json",
    capabilityWorkbench: "./public/data/capability-workbench.json",
    environmentDictionary: "./public/data/environment-dictionary.json",
    environmentWorkbench: "./public/data/environment-workbench.json",
    lifecycleWorkbench: "./public/data/lifecycle-workbench.json",
    analyticsSummary: "./public/data/analytics-summary.json",
    maintenanceIndex: "./public/data/maintenance-index.json",
    maintenance: "./public/data/maintenance-knowledge.json?v=gbt42446-task-description-20260601-1",
    sharedLookups: "./public/data/shared-lookups.json",
    lifecycle: "./public/data/lifecycle-knowledge.json",
    content: "./public/data/content-views.json",
    securityArchitectureDesignGuide: "./public/data/guides/security-architecture-design.json",
    dataSecurityDesignGuide: "./public/data/guides/data-security-design.json",
    lightPlanningGuide: "./public/data/guides/light-planning.json",
    standards: "./public/data/standards-index.json",
    oi149SplitManifest: "./public/data/oi149-split-manifest.json",
  };

  const API_PACKAGE_PATHS = {
    capability: "/api/v1/data-packages/capability",
    capabilityWorkbench: "/api/v1/data-packages/capability-workbench",
    environmentDictionary: "/api/v1/environments/dictionary",
    environmentWorkbench: "/api/v1/data-packages/environment-workbench",
    lifecycleWorkbench: "/api/v1/data-packages/lifecycle-workbench",
    analyticsSummary: "/api/v1/data-packages/analytics-summary",
    maintenanceIndex: "/api/v1/data-packages/maintenance-index",
    maintenance: "/api/v1/data-packages/maintenance",
    sharedLookups: "/api/v1/data-packages/shared-lookups",
    lifecycle: "/api/v1/data-packages/lifecycle",
    content: "/api/v1/data-packages/content",
    securityArchitectureDesignGuide: "/api/v1/data-packages/security-architecture-design-guide",
    dataSecurityDesignGuide: "/api/v1/data-packages/data-security-design-guide",
    lightPlanningGuide: "/api/v1/data-packages/light-planning-guide",
    standards: "/api/v1/data-packages/standards-index",
  };

  const API_PATHS = {
    dashboardKnowledgeSummary: "/api/v1/dashboard/knowledge-summary",
    capabilityWorkspaceProjection: "/api/v1/capabilities/workspace-projection",
    capabilityWorkspaceView: "/api/v1/capabilities/workspace-view",
    capabilityWorkspaceInitial: "/api/v1/capabilities/workspace-initial",
    searchIndex: "/api/v1/search-index",
    health: "/api/v1/health",
    userFavorites: "/api/v1/user/favorites",
    userNotes: "/api/v1/user/notes",
    userNotesExport: "/api/v1/user/notes/export",
    userMarkdownExport: "/api/v1/user/exports/markdown",
    maturityWorkspace: "/api/v1/maturity/workspace",
    maturityCalculate: "/api/v1/maturity/calculate",
    maturityTemplateValidate: "/api/v1/maturity/template/validate",
    maturityReport: "/api/v1/maturity/report",
    maturityReportExport: "/api/v1/maturity/report/export",
    maturityReportArtifact: "/api/v1/maturity/reports/artifact",
    maturityScoreExport: "/api/v1/maturity/score/export",
    maturityScoreImport: "/api/v1/maturity/score/import",
    maturityTemplateExport: "/api/v1/maturity/template/export",
    maturityTemplateImport: "/api/v1/maturity/template/import",
    mcpControlPanel: "/api/v1/mcp/control-panel",
    mcpAudit: "/api/v1/mcp/audit",
    mcpStart: "/api/v1/mcp/actions/start",
    mcpStop: "/api/v1/mcp/actions/stop",
    mcpRetry: "/api/v1/mcp/actions/retry",
    mcpUpdatePort: "/api/v1/mcp/settings/port",
    mcpCheck: "/api/v1/mcp/diagnostics/actions/check",
    mcpAuthorizationAllow: "/api/v1/mcp/authorization/actions/allow",
    mcpAuthorizationDeny: "/api/v1/mcp/authorization/actions/deny",
    mcpRevokeClient: "/api/v1/mcp/clients/actions/revoke",
    mcpClearAudit: "/api/v1/mcp/audit/actions/clear",
    mcpPrepareCertificate: "/api/v1/mcp/certificate/actions/prepare",
    mcpConfirmCertificate: "/api/v1/mcp/certificate/actions/confirm",
    mcpPrepareReset: "/api/v1/mcp/reset/actions/prepare",
    mcpConfirmWebReset: "/api/v1/mcp/reset/actions/confirm-web",
  };

  const API_FETCH_TIMEOUT_MS = 12000;
  const CAPABILITY_WORKSPACE_FETCH_TIMEOUT_MS = 5000;

  const FALLBACKS = {
    dashboardKnowledgeSummary: {
      generated_at: null,
      data_state: "missing_file",
      environment: {
        information_environments: 0,
        environment_segment_types: 0,
        information_objects: 0,
        scope_types: 0,
      },
      catalog: {
        capabilities: 0,
        scope_types: 0,
        environment_master_records: 0,
        technical_services: 0,
        technical_modules: 0,
        technical_measures: 0,
        security_works: 0,
        security_processes: 0,
        application_system_types: 0,
        application_components: 0,
        work_functions: 0,
        workforce_references: 0,
        standard_frameworks: 0,
      },
      lifecycles: { lc_ap_stages: 0, lc_dt_stages: 0 },
      content: { html_documents: 0, slide_decks: 0, diagram_views: 0, guide_pages: 0 },
    },
    capability: { generated_at: null, stats: {}, categories: [], unlinked_focuses: [] },
    capabilityWorkbench: null,
    environmentDictionary: {
      schema_version: "environment-dictionary-v1",
      data_state: "missing_file",
      generated_at: null,
      source_package_versions: {},
      master_counts: {
        information_environments: 0,
        environment_segment_types: 0,
        information_objects: 0,
      },
      context_counts: {
        environment_segments: 0,
        environment_object_contexts: 0,
      },
      information_environments: [],
      environment_segment_types: [],
      information_objects: [],
      usage_relations: [],
      evidence_ref_count: 0,
    },
    environmentWorkbench: null,
    lifecycleWorkbench: null,
    analyticsSummary: {
      meta: {
        version: "v1",
        viewModelVersion: "analytics-summary-1.0",
        generated_at: null,
        dataState: "missing_file",
        apiEquivalent: "/api/v1/data-packages/analytics-summary",
        sourcePackages: [],
        stats: { primaryGrain: "capability_focus", focusCount: 0, capabilityCount: 0, sourcePackageCount: 0 },
      },
      page: {},
      businessSummary: {},
      coverageSummary: { grain: "capability_focus", totalFocuses: 0, dimensions: [] },
      moduleSummary: { entryViews: [] },
      navigationSummary: { primaryEntries: [], secondaryEntries: [] },
      relationshipSummary: { graphGrain: "business_relation", groups: [] },
      evidenceSummary: { displayRole: "secondary", sourcePackages: [], totalEvidenceRefs: 0 },
      adminSummary: { displayRole: "admin_only", packageHealth: [] },
      reconciliationSummary: {
        displayRole: "admin_only",
        standardControls: { capabilityMapped: 0, standardsIndex: 0, sqliteFullDatabase: null, grainNotes: [] },
      },
      compatibility: { warnings: ["analytics-summary.json 不存在，dashboard 应显示空状态而不是重新计算跨包指标。"], sourcePackages: [] },
    },
    maintenance: {
      generated_at: null,
      stats: {},
      gartner_roles: [],
      gbt_42446_references: [],
      scope_types: [],
      security_processes: [],
      security_technical_measures: [],
      security_technology_modules: [],
      work_function_layers: [],
    },
    maintenanceIndex: { generated_at: null, data_state: "empty", stats: {}, section_counts: {}, sections: [] },
    sharedLookups: {
      generated_at: null,
      data_state: "empty",
      stats: {},
      service_module_index: [],
    },
    lifecycle: {
      generated_at: null,
      stats: {},
      application_security_development: {
        processes: [],
        software_development_types: [],
        development_technical_services: [],
        development_technical_modules: [],
        security_technical_measures: [],
        application_system_types: [],
        application_components: [],
      },
      data_lifecycle: { processes: [] },
    },
    content: { generated_at: null, stats: {}, html_documents: [], diagram_views: [], guide_pages: [] },
    securityArchitectureDesignGuide: { generated_at: null, data_state: "empty", guide_id: "security-architecture-design", slides: {} },
    dataSecurityDesignGuide: { generated_at: null, data_state: "empty", guide_id: "data-security-design", slides: {} },
    lightPlanningGuide: { generated_at: null, data_state: "empty", guide_id: "light-planning", slides: {} },
    standards: { generated_at: null, data_state: "empty", stats: {}, frameworks: [] },
    oi149SplitManifest: null,
  };

  const cache = new Map();
  const apiFailureBackoff = new Map();
  const API_FAILURE_BACKOFF_MS = 1000;
  const API_FAILURE_BACKOFF_MAX_ENTRIES = 64;
  let runtimeHealthCache = null;
  let runtimeHealthPromise = null;
  let runtimeHealthRefreshPromise = null;
  let runtimeHealthGeneration = 0;
  const list = (value) => (Array.isArray(value) ? value : []);
  const text = (value) => (value == null ? "" : String(value));
  const TECHNICAL_MEASURES_FIELD = "security_technical_measures";
  const TECHNICAL_MEASURES_EMPTY_MESSAGE = "暂无安全技术措施数据，请确认 ETL 是否已导出 security_technical_measures。";
  const WORKFORCE_REFERENCE_FRAMEWORK_ID = "workforce-reference-standards";
  const WORKFORCE_REFERENCE_ROUTE = "/standards/workforce-reference";
  const GBT_TASK_DEFINITION_TABLE_ID = "gbt-42446-task-definitions";
  const GBT_TASK_CLASSIFICATION_TABLE_ID = "gbt-42446-classification";
  const GARTNER_WORK_ROLE_TABLE_ID = "gartner-work-roles";
  const hasOwn = (object, key) => Boolean(object) && Object.prototype.hasOwnProperty.call(object, key);
  function isEnvironmentMasterDictionaryEnabled() {
    return window.sapdFeatureFlags?.environmentMasterDictionary === true;
  }
  const titleOf = (value, fallback = "未命名") => {
    if (!value) return fallback;
    if (typeof value === "object") return text(value.title || value.name || value.code || value.id || fallback);
    return text(value);
  };
  const objectIdOf = (item, fallback = "unknown") => text(item?.id || item?.code || item?.title || item?.name || fallback).trim();
  const slugText = (value, fallback = "item") =>
    text(value)
      .trim()
      .replace(/[^\w\u4e00-\u9fa5-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 72) || fallback;

  function emptyWorkbench(pageType, route, title, sourcePackages = []) {
    return {
      meta: {
        version: "v1",
        viewModelVersion: `${pageType}-1.0`,
        generated_at: null,
        sourcePackages,
        stats: {},
      },
      page: {
        route,
        pageType,
        title,
      },
      navigator: {},
      overview: {},
      relationshipGroups: [],
      objects: {},
      relations: [],
      evidenceRefs: [],
      compatibility: {
        mode: "transitional_fallback",
        sourcePackages,
        warnings: [],
      },
    };
  }

  function compactWorkbenchObject(item, objectType, fallback = "未命名") {
    return {
      id: objectIdOf(item, `${objectType}:${titleOf(item, fallback)}`),
      type: objectType,
      code: text(item?.code),
      name: titleOf(item, fallback),
      title: titleOf(item, fallback),
      description: text(item?.description || item?.summary),
      category: text(item?.category),
      status: text(item?.status || item?.state),
      evidenceRefs: [],
    };
  }

  function createLegacyCapabilityWorkbenchFallback(capability, management) {
    const workbench = emptyWorkbench("capability-mapping-workbench", "/capability-mapping", "安全能力映射", ["capability-tree.json", "maintenance-knowledge.json", "shared-lookups.json"]);
    const focuses = allFocuses(capability);
    workbench.meta.generated_at = capability?.generated_at || management?.generated_at || null;
    workbench.meta.stats = {
      capability_focus: focuses.length,
      security_technical_service: uniqueBy(focuses.flatMap((focus) => list(focus.services)), (service) => objectIdOf(service)).length,
      relations: 0,
    };
    workbench.navigator = {
      defaultSelectedFocusId: focuses[0]?.id || null,
      tree: list(capability?.categories).map((category) => ({
        id: objectIdOf(category),
        type: "capability_category",
        code: text(category.code),
        name: titleOf(category),
        children: list(category.domains).map((domain) => ({
          id: objectIdOf(domain),
          type: "capability_domain",
          code: text(domain.code),
          name: titleOf(domain),
          children: list(domain.capabilities).map((capabilityItem) => ({
            id: objectIdOf(capabilityItem),
            type: "capability",
            code: text(capabilityItem.code),
            name: titleOf(capabilityItem),
            children: list(capabilityItem.focuses).map((focus) => ({
              id: objectIdOf(focus),
              type: "capability_focus",
              code: text(focus.code),
              name: titleOf(focus),
              children: [],
            })),
          })),
        })),
      })),
    };
    workbench.overview = { defaultObjectId: focuses[0]?.id || null, object_type: "capability_focus", stats: workbench.meta.stats };
    workbench.objects = {
      capability_focus: Object.fromEntries(focuses.map((focus) => [objectIdOf(focus), compactWorkbenchObject(focus, "capability_focus")])),
    };
    workbench.compatibility.warnings = ["缺少 capability-workbench.json，当前使用 capability-tree.json / maintenance-knowledge.json / shared-lookups.json 生成过渡稳定结构。"];
    return workbench;
  }

  function createLegacyEnvironmentWorkbenchFallback() {
    const environments = [];
    const objects = [];
    const workbench = emptyWorkbench("environment-mapping-workbench", "/environment-mapping", "信息化环境安全能力映射", ["environment-workbench.json"]);
    workbench.meta.generated_at = null;
    workbench.meta.stats = {
      information_environment: environments.length,
      information_object: objects.length,
      relations: 0,
    };
    workbench.navigator = {
      defaultSelectedObjectId: objects[0]?.id || null,
      tree: environments.map((environment) => ({
        id: objectIdOf(environment),
        type: "information_environment",
        code: text(environment.code),
        name: titleOf(environment),
        children: list(environment.objects).map((item) => ({
          id: objectIdOf(item),
          type: "information_object",
          code: text(item.code),
          name: titleOf(item),
          children: [],
        })),
      })),
    };
    workbench.overview = { defaultObjectId: objects[0]?.id || null, object_type: "information_object", stats: workbench.meta.stats };
    workbench.objects = {
      information_environment: Object.fromEntries(environments.map((environment) => [objectIdOf(environment), compactWorkbenchObject(environment, "information_environment")])),
      information_object: Object.fromEntries(objects.map((item) => [objectIdOf(item), compactWorkbenchObject(item, "information_object")])),
    };
    workbench.compatibility.warnings = ["缺少 environment-workbench.json；management-knowledge.json 已退役，未启用旧结构 fallback。"];
    return workbench;
  }

  function createLegacyLifecycleWorkbenchFallback(lifecycle) {
    const appSecurity = lifecycle?.application_security_development || {};
    const processes = list(appSecurity.processes);
    const workbench = emptyWorkbench("domain-module", "/development-security/lc-ap", "LC-AP安全开发生命周期专项关系投影", ["lifecycle-knowledge.json"]);
    workbench.meta.generated_at = lifecycle?.generated_at || null;
    workbench.meta.stats = {
      lifecycle_stage: processes.length,
      relations: 0,
    };
    workbench.navigator = {
      defaultSelectedStageId: processes[0]?.id || null,
      tree: [
        {
          id: "lifecycle_domain:LC-AP",
          type: "lifecycle_domain",
          code: "LC-AP",
          name: "LC-AP安全开发生命周期",
          children: processes.map((process) => ({
            id: objectIdOf(process),
            type: "lifecycle_stage",
            code: text(process.code),
            name: titleOf(process),
            children: [],
          })),
        },
      ],
    };
    workbench.overview = { defaultObjectId: processes[0]?.id || null, object_type: "lifecycle_stage", stats: workbench.meta.stats };
    workbench.objects = {
      lifecycle_stage: Object.fromEntries(processes.map((process) => [objectIdOf(process), compactWorkbenchObject(process, "lifecycle_stage")])),
    };
    workbench.compatibility.warnings = ["缺少 lifecycle-workbench.json，当前使用 lifecycle-knowledge.json 生成过渡稳定结构。"];
    return workbench;
  }

  function createEnvelope(data, warnings = []) {
    return {
      meta: {
        version: "v1",
        generated_at: data?.generated_at || new Date().toISOString(),
        data_version: data?.generated_at || null,
        warnings_count: warnings.length,
      },
      data,
      warnings,
    };
  }

  function apiUrl(path) {
    const configured = window.SAPD_API_BASE || "";
    if (configured) return `${configured.replace(/\/$/, "")}${path}`;
    if (window.location.protocol === "file:") return "";
    return path;
  }

  function unwrapEnvelope(payload) {
    if (payload && typeof payload === "object" && Object.prototype.hasOwnProperty.call(payload, "data")) return payload.data;
    return payload;
  }

  function normalizeUserPayload(payload) {
    const data = unwrapEnvelope(payload);
    if (!data || typeof data !== "object") return { ok: false, data_state: "api_unavailable", favorites: [], notes: [] };
    return data;
  }

  function apiRequestCoolingDown(path) {
    const retryAt = Number(apiFailureBackoff.get(path) || 0);
    if (!retryAt || retryAt <= Date.now()) {
      apiFailureBackoff.delete(path);
      return false;
    }
    return true;
  }

  function recordApiFailure(path) {
    const now = Date.now();
    for (const [key, retryAt] of apiFailureBackoff) {
      if (Number(retryAt) <= now) apiFailureBackoff.delete(key);
    }
    apiFailureBackoff.delete(path);
    while (apiFailureBackoff.size >= API_FAILURE_BACKOFF_MAX_ENTRIES) {
      apiFailureBackoff.delete(apiFailureBackoff.keys().next().value);
    }
    apiFailureBackoff.set(path, now + API_FAILURE_BACKOFF_MS);
  }

  async function fetchApiPackage(name) {
    const path = API_PACKAGE_PATHS[name];
    if (apiRequestCoolingDown(path)) return null;
    const url = path ? apiUrl(path) : "";
    if (!url) return null;
    try {
      const response = await fetch(url, { cache: "no-store" });
      if (!response.ok) {
        recordApiFailure(path);
        return null;
      }
      apiFailureBackoff.delete(path);
      return unwrapEnvelope(await response.json());
    } catch {
      recordApiFailure(path);
      return null;
    }
  }

  async function fetchWithTimeout(url, options = {}, timeoutMs = API_FETCH_TIMEOUT_MS) {
    const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
    const requestOptions = { ...options };
    const timeout = Number(timeoutMs);
    let timer = null;
    if (controller && !requestOptions.signal) {
      requestOptions.signal = controller.signal;
      if (Number.isFinite(timeout) && timeout > 0) {
        timer = setTimeout(() => controller.abort(), timeout);
      }
    }
    try {
      return await fetch(url, requestOptions);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  async function fetchApiData(path, options = {}) {
    if (apiRequestCoolingDown(path)) return null;
    const url = path ? apiUrl(path) : "";
    if (!url) return null;
    try {
      const response = await fetchWithTimeout(url, { cache: "no-store" }, options.timeoutMs);
      if (!response.ok) {
        recordApiFailure(path);
        return null;
      }
      apiFailureBackoff.delete(path);
      return unwrapEnvelope(await response.json());
    } catch (error) {
      recordApiFailure(path);
      return null;
    }
  }

  async function fetchRuntimeHealth() {
    if (runtimeHealthCache) return runtimeHealthCache;
    if (runtimeHealthPromise) return runtimeHealthPromise;
    const url = apiUrl(API_PATHS.health);
    if (!url) {
      return { status: "offline", auth: { writes_require_token: false }, user_database: { ready: false } };
    }
    const generation = runtimeHealthGeneration;
    const request = (async () => {
      try {
        const response = await fetch(url, { cache: "no-store" });
        if (!response.ok) throw new Error(`health ${response.status}`);
        return normalizeUserPayload(await response.json());
      } catch {
        return { status: "offline", auth: { writes_require_token: false }, user_database: { ready: false }, data_state: "api_unavailable" };
      }
    })();
    runtimeHealthPromise = request;
    try {
      const health = await request;
      if (generation === runtimeHealthGeneration && health.data_state !== "api_unavailable") runtimeHealthCache = health;
      return health;
    } finally {
      if (runtimeHealthPromise === request) runtimeHealthPromise = null;
    }
  }

  function invalidateRuntimeHealth() {
    runtimeHealthGeneration += 1;
    runtimeHealthCache = null;
    runtimeHealthPromise = null;
  }

  async function refreshRuntimeHealth() {
    if (runtimeHealthRefreshPromise) return runtimeHealthRefreshPromise;
    invalidateRuntimeHealth();
    const refresh = fetchRuntimeHealth();
    runtimeHealthRefreshPromise = refresh;
    try {
      return await refresh;
    } finally {
      if (runtimeHealthRefreshPromise === refresh) runtimeHealthRefreshPromise = null;
    }
  }

  async function shouldSaveExportToConfiguredDirectory(options = {}) {
    const destination = text(options?.destination).trim().toLowerCase();
    if (options?.download === true || destination === "download") return false;
    if (options?.save === true || destination === "configured") return true;
    const health = await fetchRuntimeHealth();
    return Boolean(text(health?.state?.bundle_root).trim());
  }

  async function userWriteHeaders() {
    const health = await fetchRuntimeHealth();
    const headers = { "Content-Type": "application/json" };
    const auth = health?.auth || {};
    if (auth.writes_require_token && auth.header && auth.session_token) {
      headers[auth.header] = auth.session_token;
    }
    return headers;
  }

  function isUserWriteMethod(method) {
    return ["POST", "PATCH", "DELETE"].includes(String(method || "GET").toUpperCase());
  }

  function headersToObject(headers) {
    if (!headers) return {};
    if (typeof Headers !== "undefined" && headers instanceof Headers) {
      const result = {};
      headers.forEach((value, key) => {
        result[key] = value;
      });
      return result;
    }
    if (Array.isArray(headers)) return Object.fromEntries(headers);
    return { ...headers };
  }

  async function fetchUserApi(path, options = {}) {
    const url = path ? apiUrl(path) : "";
    if (!url) return { ok: false, data_state: "api_unavailable", favorites: [], notes: [] };
    const { sapdAuthRetry, ...fetchOptions } = options || {};
    try {
      const response = await fetch(url, { cache: "no-store", ...fetchOptions });
      const payload = response.headers.get("Content-Type")?.includes("application/json") ? await response.json() : {};
      const data = normalizeUserPayload(payload);
      if (!response.ok && [401, 403].includes(response.status) && isUserWriteMethod(fetchOptions.method) && !sapdAuthRetry) {
        await refreshRuntimeHealth();
        const retryHeaders = {
          ...headersToObject(fetchOptions.headers),
          ...(await userWriteHeaders()),
        };
        return fetchUserApi(path, { ...fetchOptions, headers: retryHeaders, sapdAuthRetry: true });
      }
      return response.ok ? data : { ok: false, data_state: "api_error", error: data.error || data.message || `HTTP ${response.status}` };
    } catch (error) {
      return { ok: false, data_state: "api_unavailable", error: error?.message || "user api unavailable" };
    }
  }

  const MCP_CONTROL_CONTRACT_VERSION = "sapd-mcp-control-v1";
  const MCP_FORBIDDEN_RESPONSE_KEYS = [
    "token",
    "private_key",
    "passphrase",
    "redirect_query",
    "absolute_path",
    "pid",
    "raw_logs",
    "query",
    "knowledge_content",
    "user_content",
  ];

  function mcpSafeErrorMessage(code = "", status = 0) {
    const messages = {
      STATE_VERSION_CONFLICT: "AI 集成状态已更新，页面将重新读取最新状态。",
      REQUEST_ID_REUSED: "本次操作标识已被使用，请重新发起操作。",
      AUTH_REQUIRED: "当前操作需要本地会话授权。",
      AUTH_DENIED: "当前环境未允许执行该操作。",
      DESKTOP_CAPABILITY_REQUIRED: "该操作需要桌面应用。",
      DESKTOP_APP_REQUIRED: "该操作需要桌面应用。",
      REQUEST_TIMEOUT: "等待系统确认超时，请重新操作并在 macOS 提示中选择允许。",
    };
    return messages[text(code).trim()] || (status === 403
      ? "当前操作需要本地会话授权或桌面应用能力。"
      : "AI 集成请求失败，请稍后重试或在桌面应用中检查服务。");
  }

  function createMcpControlError(code, status, currentStateVersion = null) {
    const error = new Error(mcpSafeErrorMessage(code, status));
    error.name = "McpControlError";
    error.code = text(code).trim() || "MCP_CONTROL_ERROR";
    error.status = Number(status) || 0;
    error.currentStateVersion = Number.isInteger(currentStateVersion) ? currentStateVersion : null;
    return error;
  }

  function assertMcpResponseFieldPolicy(value, seen = new Set()) {
    if (!value || typeof value !== "object" || seen.has(value)) return;
    seen.add(value);
    Object.entries(value).forEach(([key, child]) => {
      const normalizedKey = text(key).trim().toLowerCase();
      const forbidden = MCP_FORBIDDEN_RESPONSE_KEYS.some((family) =>
        normalizedKey === family
        || normalizedKey.includes(`${family}_`)
        || normalizedKey.includes(`_${family}`),
      );
      if (forbidden) throw createMcpControlError("RESPONSE_FIELD_POLICY_VIOLATION", 502);
      assertMcpResponseFieldPolicy(child, seen);
    });
  }

  function assertMcpControlPayload(payload, kind = "response") {
    if (!payload || typeof payload !== "object" || payload.contract_version !== MCP_CONTROL_CONTRACT_VERSION) {
      throw createMcpControlError("CONTRACT_VERSION_MISMATCH", 502);
    }
    assertMcpResponseFieldPolicy(payload);
    if (kind === "control-panel") {
      const valid =
        Number.isInteger(payload.state_version)
        && payload.status && typeof payload.status === "object"
        && payload.settings && typeof payload.settings === "object"
        && payload.certificate && typeof payload.certificate === "object"
        && Array.isArray(payload.clients)
        && payload.audit && typeof payload.audit === "object"
        && payload.diagnostics && typeof payload.diagnostics === "object";
      if (!valid) throw createMcpControlError("CONTROL_PANEL_SCHEMA_MISMATCH", 502);
    }
    return payload;
  }

  async function mcpControlRequestHeaders({ mutation = false } = {}) {
    const health = await fetchRuntimeHealth();
    const headers = mutation ? { "Content-Type": "application/json" } : {};
    const sessionToken = text(health?.auth?.session_token).trim();
    if (!sessionToken) throw createMcpControlError("AUTH_REQUIRED", 403);
    headers["X-SAPD-Session-Token"] = sessionToken;
    return headers;
  }

  async function fetchMcpControlApi(path, options = {}) {
    const url = path ? apiUrl(path) : "";
    if (!url) throw createMcpControlError("API_UNAVAILABLE", 0);
    const method = text(options.method || "GET").toUpperCase();
    const isMutation = isUserWriteMethod(method);
    const {
      sapdAuthRetry,
      kind = "response",
      timeoutMs = API_FETCH_TIMEOUT_MS,
      ...requestOptions
    } = options;
    const headers = {
      ...headersToObject(requestOptions.headers),
      ...(await mcpControlRequestHeaders({ mutation: isMutation })),
    };
    try {
      const response = await fetchWithTimeout(url, {
        cache: "no-store",
        ...requestOptions,
        method,
        headers,
      }, timeoutMs);
      const payload = response.headers.get("Content-Type")?.includes("application/json") ? await response.json() : null;
      assertMcpResponseFieldPolicy(payload);
      if (!response.ok && (response.status === 401 || response.status === 403) && !sapdAuthRetry) {
        await refreshRuntimeHealth();
        return fetchMcpControlApi(path, {
          ...requestOptions,
          method,
          kind,
          timeoutMs,
          sapdAuthRetry: true,
        });
      }
      if (!response.ok) {
        const code = payload?.error?.code || "MCP_CONTROL_ERROR";
        throw createMcpControlError(code, response.status, payload?.error?.current_state_version);
      }
      return assertMcpControlPayload(payload, kind);
    } catch (error) {
      if (error?.name === "McpControlError") throw error;
      throw createMcpControlError(error?.name === "AbortError" ? "REQUEST_TIMEOUT" : "API_UNAVAILABLE", 0);
    }
  }

  function mcpMutationBody({ requestId, expectedStateVersion, ...extra } = {}) {
    const normalizedRequestId = text(requestId).trim();
    const normalizedStateVersion = Number(expectedStateVersion);
    if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/.test(normalizedRequestId)) {
      throw createMcpControlError("INVALID_REQUEST_ID", 400);
    }
    if (!Number.isInteger(normalizedStateVersion) || normalizedStateVersion < 0) {
      throw createMcpControlError("INVALID_STATE_VERSION", 400);
    }
    if (extra.client_id && !/^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/.test(text(extra.client_id).trim())) {
      throw createMcpControlError("INVALID_CLIENT_ID", 400);
    }
    if (
      extra.authorization_request_id
      && !/^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/.test(text(extra.authorization_request_id).trim())
    ) {
      throw createMcpControlError("INVALID_AUTHORIZATION_REQUEST_ID", 400);
    }
    if (
      Object.prototype.hasOwnProperty.call(extra, "configured_port")
      && (
        !Number.isInteger(Number(extra.configured_port))
        || Number(extra.configured_port) < 1024
        || Number(extra.configured_port) > 65535
        || Number(extra.configured_port) === 5173
      )
    ) {
      throw createMcpControlError("INVALID_PORT", 400);
    }
    if (
      extra.action
      && !["certificate_provision", "certificate_rotate", "certificate_repair_trust"].includes(text(extra.action).trim())
    ) {
      throw createMcpControlError("INVALID_CERTIFICATE_ACTION", 400);
    }
    if (
      extra.confirmation_id
      && !/^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/.test(text(extra.confirmation_id).trim())
    ) {
      throw createMcpControlError("INVALID_CONFIRMATION_ID", 400);
    }
    return JSON.stringify({
      request_id: normalizedRequestId,
      expected_state_version: normalizedStateVersion,
      ...extra,
    });
  }

  async function runMcpMutation(path, payload = {}, { timeoutMs } = {}) {
    return fetchMcpControlApi(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: mcpMutationBody(payload),
      timeoutMs,
    });
  }

  async function fetchPackage(name) {
    if (cache.has(name)) return cache.get(name);
    const path = DATA_PATHS[name];
    const fallback = FALLBACKS[name] || {};
    const apiData = await fetchApiPackage(name);
    if (apiData) {
      cache.set(name, apiData);
      return apiData;
    }
    try {
      const response = await fetch(path, { cache: "no-store" });
      if (!response.ok) {
        const dataState = response.status === 404 ? "missing_file" : "error";
        const failedData = fallback && typeof fallback === "object"
          ? { ...fallback, __data_state: dataState, __load_error: `HTTP ${response.status}` }
          : { __data_state: dataState, __load_error: `HTTP ${response.status}` };
        cache.set(name, failedData);
        return failedData;
      }
      const data = await response.json();
      cache.set(name, data);
      return data;
    } catch (error) {
      const failedData = fallback && typeof fallback === "object"
        ? { ...fallback, __data_state: "error", __load_error: error?.message || "数据请求失败" }
        : { __data_state: "error", __load_error: error?.message || "数据请求失败" };
      cache.set(name, failedData);
      return failedData;
    }
  }

  async function fetchJsonPath(path, fallback = {}) {
    if (!path) return fallback;
    const cacheKey = `path:${path}`;
    if (cache.has(cacheKey)) return cache.get(cacheKey);
    try {
      const response = await fetch(path, { cache: "no-store" });
      if (!response.ok) {
        cache.set(cacheKey, fallback);
        return fallback;
      }
      const data = await response.json();
      cache.set(cacheKey, data);
      return data;
    } catch {
      cache.set(cacheKey, fallback);
      return fallback;
    }
  }

  function publicDataPath(relativePath) {
    const clean = text(relativePath).replace(/^\.?\/*/, "");
    return clean ? `./public/data/${clean}` : "";
  }

  function isReadySplitManifest(manifest) {
    return Boolean(manifest && typeof manifest === "object" && manifest.__data_state !== "missing_file" && manifest.contract === "oi149-p4-split-v1");
  }

  async function getOi149SplitManifest() {
    const manifest = await fetchPackage("oi149SplitManifest");
    return isReadySplitManifest(manifest) ? manifest : null;
  }

  async function fetchOi149SplitJson(relativePath, fallback = null) {
    const path = publicDataPath(relativePath);
    if (!path) return fallback;
    const data = await fetchJsonPath(path, fallback);
    return data && typeof data === "object" ? data : fallback;
  }

  function capabilityWorkbenchFromSplitIndex(index, manifest) {
    if (!index || typeof index !== "object") return null;
    const tree = list(index.tree);
    if (!tree.length) return null;
    return {
      meta: {
        version: "v1",
        viewModelVersion: "capability-workbench-initial-split-1.0",
        generated_at: manifest?.generatedAt || null,
        sourcePackages: ["capability/index.json", "oi149-split-manifest.json"],
        stats: index.stats || {},
        dataSource: "oi149-split-index",
      },
      page: {
        route: "/capability-mapping",
        pageType: "capability-mapping-workbench",
        title: "安全能力映射",
      },
      navigator: {
        defaultSelectedFocusId: index.defaultSelectedFocusId || null,
        tree,
      },
      overview: {
        defaultObjectId: index.defaultSelectedFocusId || null,
        object_type: "capability_focus",
        stats: index.stats || {},
      },
      relationshipGroups: [],
      objects: {},
      relations: [],
      evidenceRefs: [],
      compatibility: {
        mode: "initial_projection",
        sourcePackages: ["capability/index.json", "oi149-split-manifest.json"],
        splitContract: manifest?.contract || "oi149-p4-split-v1",
        warnings: ["当前使用 OI-149 P4 split index 作为能力页首屏导航；对象详情继续按需加载 workspace-view。"],
      },
    };
  }

  async function getCapabilityWorkspaceInitialFromSplit() {
    const manifest = await getOi149SplitManifest();
    const indexPath = manifest?.domains?.capability?.indexPath || "";
    if (!indexPath) return null;
    const index = await fetchOi149SplitJson(indexPath, null);
    return capabilityWorkbenchFromSplitIndex(index, manifest);
  }

  function environmentNavigatorFromSplit(navigator, manifest) {
    if (!navigator || typeof navigator !== "object") return null;
    const tree = list(navigator.tree);
    if (!tree.length) return null;
    return {
      generated_at: manifest?.generatedAt || null,
      dataSource: "oi149-split-environment-navigator",
      splitContract: manifest?.contract || "oi149-p4-split-v1",
      stats: navigator.stats || {},
      defaultSelectedObjectId: navigator.defaultSelectedObjectId || "",
      environments: tree,
      projections: list(navigator.projections),
      compatibility: {
        mode: "split_navigator",
        sourcePackages: ["environment/navigator.json", "oi149-split-manifest.json"],
        warnings: ["当前使用 OI-149 P4 split navigator 作为信息化环境首屏导航；对象映射详情继续读取 environment-workbench。"],
      },
    };
  }

  async function getEnvironmentNavigatorFromSplit() {
    const manifest = await getOi149SplitManifest();
    const navigatorPath = manifest?.domains?.environment?.navigatorPath || "";
    if (!navigatorPath) return null;
    const navigator = await fetchOi149SplitJson(navigatorPath, null);
    return environmentNavigatorFromSplit(navigator, manifest);
  }

  function environmentProjectionRequest(params = {}) {
    const rawOrdinal = params.navOrdinal ?? params.nav_ordinal ?? "";
    const navOrdinal = rawOrdinal === "" || rawOrdinal == null ? null : Number(rawOrdinal);
    return {
      projectionKey: text(params.projectionKey || params.projection_key).trim(),
      projectionPath: text(params.projectionPath || params.projection_path || params.path).trim(),
      id: text(params.id || params.objectId || params.object_id || params.environmentId || params.environment_id || params.segmentId || params.segment_id).trim(),
      type: text(params.type || params.objectType || params.object_type).trim(),
      navOrdinal: Number.isFinite(navOrdinal) ? navOrdinal : null,
    };
  }

  function environmentProjectionRowMatches(row, request) {
    if (!row || !request) return false;
    if (request.projectionKey && row.projectionKey === request.projectionKey) return true;
    if (request.projectionPath && row.path === request.projectionPath) return true;
    if (request.navOrdinal != null && row.navOrdinal === request.navOrdinal) return true;
    if (!request.id) return false;
    const typeMatches = !request.type || row.type === request.type;
    if (row.id === request.id && typeMatches) return true;
    return list(row.objectContextIds).includes(request.id);
  }

  function environmentProjectionRequestHasTarget(request) {
    return Boolean(request?.projectionKey || request?.projectionPath || request?.id || request?.navOrdinal != null);
  }

  function findEnvironmentProjectionRow(navigator, params = {}) {
    const rows = list(navigator?.projections);
    if (!rows.length) return null;
    const request = environmentProjectionRequest(params);
    const matched = rows.find((row) => environmentProjectionRowMatches(row, request)) || null;
    if (matched || environmentProjectionRequestHasTarget(request)) return matched;
    return null;
  }

  function environmentProjectionFromSplit(projection, row, manifest) {
    if (!projection || typeof projection !== "object" || projection.dataState !== "ready") return null;
    return {
      ...projection,
      generated_at: manifest?.generatedAt || null,
      dataSource: "oi149-split-environment-projection",
      splitContract: manifest?.contract || "oi149-p4-split-v1",
      selectedNavigation:
        projection.selectedNavigation ||
        {
          id: row?.id || "",
          type: row?.type || "",
          code: row?.code || "",
          title: row?.title || "",
          navOrdinal: row?.navOrdinal ?? null,
          projectionKey: row?.projectionKey || "",
          projectionPath: row?.path || "",
        },
      relationCount: Number.isFinite(Number(projection.relationCount)) ? Number(projection.relationCount) : list(projection.relations).length,
      compatibility: {
        ...(projection.compatibility || {}),
        mode: "split_projection",
        sourcePackages: [row?.path || projection.projectionPath || "", "environment/navigator.json", "oi149-split-manifest.json"].filter(Boolean),
        warnings: ["当前使用 OI-149 P4 split projection 作为信息化环境对象详情；缺失时回退 environment-workbench。"],
      },
    };
  }

  async function getEnvironmentWorkspaceProjectionFromSplit(params = {}) {
    const manifest = await getOi149SplitManifest();
    const navigatorPath = manifest?.domains?.environment?.navigatorPath || "";
    if (!navigatorPath) return null;
    const navigator = await fetchOi149SplitJson(navigatorPath, null);
    const row = findEnvironmentProjectionRow(navigator, params);
    if (!row?.path) return null;
    const projection = await fetchOi149SplitJson(row.path, null);
    return environmentProjectionFromSplit(projection, row, manifest);
  }

  function environmentProjectionFromWorkbenchFallback(workbench, params = {}) {
    const request = environmentProjectionRequest(params);
    return {
      generated_at: workbench?.meta?.generated_at || null,
      dataSource: "environment-workbench-fallback",
      splitContract: null,
      requested: request,
      stats: workbench?.meta?.stats || {},
      selectedNavigation: null,
      objects: workbench?.objects || {},
      objectScopeTree: list(workbench?.environment_scope_tree || workbench?.environmentScopeTree),
      relations: list(workbench?.relations),
      relationCount: list(workbench?.relations).length,
      compatibility: {
        mode: "full_workbench_fallback",
        sourcePackages: ["environment-workbench.json"],
        warnings: ["OI-149 P4 split projection 不可用，已回退到完整 environment-workbench。"],
      },
    };
  }

  function frameworkIndexById(standards, frameworkId) {
    return list(standards?.frameworks).find((framework) => framework.id === frameworkId) || null;
  }

  function maintenanceSectionById(index, sectionId) {
    return list(index?.sections).find((section) => section.id === sectionId) || null;
  }

  function emptyMaintenanceSlice(index, sectionId) {
    return {
      generated_at: index?.generated_at || null,
      data_state: index?.__data_state === "missing_file" ? "missing_file" : index?.data_state || "empty",
      package_type: "maintenance-section",
      section_id: sectionId,
      stats: index?.stats || {},
      section_counts: index?.section_counts || {},
      source_evidence_by_id: {},
      gbt_42446_references: [],
      gartner_roles: [],
      scope_types: [],
      security_works: [],
      security_processes: [],
      security_technical_measures: [],
      security_technology_modules: [],
      security_technical_services: [],
      work_function_layers: [],
    };
  }

  async function getMaintenanceIndexPayload() {
    return fetchPackage("maintenanceIndex");
  }

  async function getMaintenanceSectionPayload(sectionId) {
    const [index, sharedLookups] = await Promise.all([getMaintenanceIndexPayload(), fetchPackage("sharedLookups")]);
    const section = maintenanceSectionById(index, sectionId);
    if (!section || index?.__data_state === "missing_file") {
      return getMaintenanceKnowledgePayload();
    }
    const [sectionPayload, evidencePayload] = await Promise.all([
      fetchJsonPath(section.dataPath, emptyMaintenanceSlice(index, sectionId)),
      fetchJsonPath(section.sourceEvidencePath, { evidenceById: {} }),
    ]);
    const payload = {
      ...emptyMaintenanceSlice(index, sectionId),
      ...sectionPayload,
      generated_at: sectionPayload?.generated_at || index?.generated_at || null,
      stats: {
        ...(index?.stats || {}),
        ...(sectionPayload?.stats || {}),
      },
      section_counts: index?.section_counts || {},
      source_evidence_by_id: evidencePayload?.evidenceById || evidencePayload?.evidence_by_id || {},
      maintenance_index: index,
    };
    return mergeSharedLookups(payload, sharedLookups);
  }

  function gbtTaskNameFromTitle(title) {
    const value = text(title).trim();
    const parts = value.split(/[-－—]/).map((part) => part.trim()).filter(Boolean);
    return parts.length > 1 ? parts.slice(1).join("-") : value;
  }

  function addUniqueValue(target, value) {
    const textValue = text(value).trim();
    if (textValue && !target.includes(textValue)) target.push(textValue);
  }

  function gbtTaskRelationKey(category, task) {
    return `${text(category).trim()}::${text(task).trim()}`;
  }

  function buildGbtTaskWorkFunctionIndex(workFunctionsPayload) {
    const exact = new Map();
    const byTask = new Map();
    for (const layer of list(workFunctionsPayload?.work_function_layers)) {
      for (const group of list(layer?.groups)) {
        for (const workFunction of list(group?.functions)) {
          const workFunctionTitle = titleOf(workFunction, "").trim();
          if (!workFunctionTitle) continue;
          for (const ref of list(workFunction?.gbt_42446_refs)) {
            const task = gbtTaskNameFromTitle(ref?.title);
            const category = text(ref?.category).trim();
            if (!task) continue;
            const exactKey = gbtTaskRelationKey(category, task);
            if (!exact.has(exactKey)) exact.set(exactKey, []);
            addUniqueValue(exact.get(exactKey), workFunctionTitle);
            if (!byTask.has(task)) byTask.set(task, []);
            addUniqueValue(byTask.get(task), workFunctionTitle);
          }
        }
      }
    }
    return { exact, byTask };
  }

  function gbtRelatedWorkFunctions(index, category, task) {
    const exactMatches = index?.exact?.get(gbtTaskRelationKey(category, task));
    if (exactMatches?.length) return exactMatches;
    return index?.byTask?.get(text(task).trim()) || [];
  }

  function gbtTaskDefinitionRows(standardRows, workFunctionIndex) {
    const byTask = new Map();
    for (const row of list(standardRows)) {
      const task = gbtTaskNameFromTitle(row?.title);
      if (!task) continue;
      if (!byTask.has(task)) {
        byTask.set(task, { task, description: text(row?.description).trim(), categories: [], workFunctions: [] });
      }
      const entry = byTask.get(task);
      const category = text(row?.category).trim();
      addUniqueValue(entry.categories, category);
      for (const workFunction of gbtRelatedWorkFunctions(workFunctionIndex, category, task)) {
        addUniqueValue(entry.workFunctions, workFunction);
      }
      if (!entry.description && row?.description) entry.description = text(row.description).trim();
    }
    return Array.from(byTask.values()).map((entry, index) => ({
      id: `gbt-42446-task-definition-${slugText(entry.task, `task-${index + 1}`)}`,
      "序号": index + 1,
      "工作任务": entry.task,
      "任务描述": entry.description,
      "所属工作类别": entry.categories.join("、"),
      "关联安全职能": entry.workFunctions.join("、"),
      "分类数量": entry.categories.length,
    }));
  }

  function gbtTaskClassificationRows(standardRows, workFunctionIndex) {
    return list(standardRows).map((row, index) => {
      const category = text(row?.category).trim();
      const task = gbtTaskNameFromTitle(row?.title);
      return {
        id: `gbt-42446-classification-${slugText(category, "category")}-${slugText(task, `task-${index + 1}`)}-${index + 1}`,
        "序号": index + 1,
        "工作类别": category,
        "工作任务": task,
        "关联安全职能": gbtRelatedWorkFunctions(workFunctionIndex, category, task).join("、"),
      };
    });
  }

  function gartnerWorkRoleRows(roleRows) {
    return list(roleRows).map((row, index) => {
      const category = text(row?.category).trim();
      const title = titleOf(row, "");
      const candidates = list(row?.candidate_work_functions || row?.candidateSecurityFunctions || row?.candidate_security_functions)
        .map((item) => titleOf(item, ""))
        .filter(Boolean);
      return {
        id: `gartner-work-role-${slugText(category, "category")}-${slugText(title, `role-${index + 1}`)}-${index + 1}`,
        "序号": index + 1,
        "岗位分类": category,
        "岗位/角色": title,
        "说明": text(row?.description || row?.summary).trim(),
        "关联安全职能": candidates.join("、"),
      };
    });
  }

  function workforceReferenceFrameworkFromMaintenance(management, workFunctionsPayload) {
    const standardRows = list(management?.gbt_42446_references);
    const roleRows = list(management?.gartner_roles);
    const workFunctionIndex = buildGbtTaskWorkFunctionIndex(workFunctionsPayload);
    const definitionRows = gbtTaskDefinitionRows(standardRows, workFunctionIndex);
    const classificationRows = gbtTaskClassificationRows(standardRows, workFunctionIndex);
    const gartnerRows = gartnerWorkRoleRows(roleRows);
    const tabs = [
      {
        id: GBT_TASK_DEFINITION_TABLE_ID,
        title: "GB/T 42446-2023｜任务定义",
        shortTitle: "任务定义",
        groupId: "gbt-42446",
        groupLabel: "GB/T 42446-2023",
        columns: ["序号", "工作任务", "任务描述", "所属工作类别", "关联安全职能", "分类数量"],
        rows: definitionRows,
        totalRows: definitionRows.length,
        loaded: true,
      },
      {
        id: GBT_TASK_CLASSIFICATION_TABLE_ID,
        title: "GB/T 42446-2023｜工作类别分类",
        shortTitle: "工作类别分类",
        groupId: "gbt-42446",
        groupLabel: "GB/T 42446-2023",
        columns: ["序号", "工作任务", "关联安全职能"],
        rows: classificationRows,
        totalRows: classificationRows.length,
        loaded: true,
      },
      {
        id: GARTNER_WORK_ROLE_TABLE_ID,
        title: "Gartner 工作岗位参考",
        shortTitle: "工作岗位参考",
        groupId: "gartner",
        groupLabel: "Gartner",
        columns: ["序号", "岗位分类", "岗位/角色", "说明", "关联安全职能"],
        rows: gartnerRows,
        totalRows: gartnerRows.length,
        loaded: true,
      },
    ];
    return {
      id: WORKFORCE_REFERENCE_FRAMEWORK_ID,
      route: WORKFORCE_REFERENCE_ROUTE,
      title: "人力资源 Workforce 参考标准",
      frameworkCode: "WORKFORCE-REFERENCE",
      summaryNote: "GB/T 42446-2023 任务定义是工作任务唯一口径，工作类别分类展示任务归属关系；Gartner 提供岗位参考。",
      summaryBadges: [
        { label: "GB/T 任务定义", value: definitionRows.length, unit: "项", text: `${definitionRows.length} 项任务定义` },
        { label: "GB/T 分类行", value: classificationRows.length, unit: "条", text: `${classificationRows.length} 条分类映射` },
        { label: "Gartner 岗位参考", value: gartnerRows.length, unit: "条", text: `${gartnerRows.length} 条岗位参考` },
      ],
      tabs,
      totalRows: definitionRows.length + classificationRows.length + gartnerRows.length,
      split: false,
      loaded: true,
    };
  }

  async function getWorkforceReferenceFramework() {
    const [management, workFunctionsPayload] = await Promise.all([
      getMaintenanceSectionPayload("references"),
      getMaintenanceSectionPayload("work-functions"),
    ]);
    return workforceReferenceFrameworkFromMaintenance(management, workFunctionsPayload);
  }

  async function getStandardsWithWorkforceReferences() {
    const [standards, workforceFramework] = await Promise.all([fetchPackage("standards"), getWorkforceReferenceFramework()]);
    const frameworks = list(standards?.frameworks).filter((framework) => framework?.id !== WORKFORCE_REFERENCE_FRAMEWORK_ID);
    return {
      ...(standards || {}),
      stats: {
        ...(standards?.stats || {}),
        frameworks: frameworks.length + 1,
        workforce_reference_rows: workforceFramework.totalRows,
      },
      frameworks: [...frameworks, workforceFramework],
    };
  }

  async function loadStandardFramework(frameworkId) {
    if (frameworkId === WORKFORCE_REFERENCE_FRAMEWORK_ID) return getWorkforceReferenceFramework();
    const standards = await fetchPackage("standards");
    const framework = frameworkIndexById(standards, frameworkId);
    if (!framework) return null;
    if (framework.dataPath) {
      const payload = await fetchJsonPath(framework.dataPath, null);
      return payload ? { ...framework, ...payload, loaded: true } : framework;
    }
    if (list(framework.tabs).length) {
      const [firstTab, ...restTabs] = list(framework.tabs);
      const loadedFirstTab = firstTab?.dataPath ? await fetchJsonPath(firstTab.dataPath, firstTab) : firstTab;
      return {
        ...framework,
        loaded: true,
        tabs: [
          { ...firstTab, ...loadedFirstTab, loaded: Boolean(loadedFirstTab?.rows) },
          ...restTabs.map((tab) => ({ ...tab, rows: [], loaded: false })),
        ],
      };
    }
    return framework;
  }

  async function loadStandardFrameworkTable(frameworkId, tableId) {
    if (frameworkId === WORKFORCE_REFERENCE_FRAMEWORK_ID) {
      const framework = await getWorkforceReferenceFramework();
      return list(framework.tabs).find((table) => table.id === tableId) || null;
    }
    const standards = await fetchPackage("standards");
    const framework = frameworkIndexById(standards, frameworkId);
    const table = list(framework?.tabs).find((tab) => tab.id === tableId);
    if (!table) return null;
    if (!table.dataPath) return table;
    const payload = await fetchJsonPath(table.dataPath, table);
    return { ...table, ...payload, loaded: Boolean(payload?.rows) };
  }

  async function getCapabilityAndManagement() {
    const [capability, management, sharedLookups] = await Promise.all([fetchPackage("capability"), fetchPackage("maintenance"), fetchPackage("sharedLookups")]);
    return { capability, management: mergeSharedLookups(management, sharedLookups) };
  }

  async function getMaintenanceKnowledgePayload() {
    const [maintenance, sharedLookups] = await Promise.all([fetchPackage("maintenance"), fetchPackage("sharedLookups")]);
    if (maintenance?.__data_state !== "missing_file") return mergeSharedLookups(maintenance, sharedLookups);
    return mergeSharedLookups(maintenance, sharedLookups);
  }

  function mergeSharedLookups(payload, sharedLookups) {
    const serviceModuleIndex = list(sharedLookups?.service_module_index);
    if (!serviceModuleIndex.length || list(payload?.service_module_index).length) return payload;
    return {
      ...(payload || {}),
      stats: {
        ...(payload?.stats || {}),
        service_module_index: serviceModuleIndex.length,
      },
      service_module_index: serviceModuleIndex,
    };
  }

  function capabilityPathForFocus(capabilityTree, focusId) {
    for (const category of list(capabilityTree.categories)) {
      for (const domain of list(category.domains)) {
        for (const capability of list(domain.capabilities)) {
          const focus = list(capability.focuses).find((item) => item.id === focusId);
          if (focus) return { category, domain, capability, focus };
        }
      }
    }
    return {};
  }

  function allFocuses(capabilityTree) {
    return list(capabilityTree.categories).flatMap((category) =>
      list(category.domains).flatMap((domain) => list(domain.capabilities).flatMap((capability) => list(capability.focuses))),
    );
  }

  function focusMatchesSelection(capabilityTree, focus, selectedId) {
    if (!selectedId) return true;
    if (focus.id === selectedId) return true;
    const path = capabilityPathForFocus(capabilityTree, focus.id);
    return [path.category?.id, path.domain?.id, path.capability?.id].includes(selectedId);
  }

  function uniqueBy(items, keyFn) {
    const seen = new Set();
    return list(items).filter((item) => {
      const key = keyFn(item);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  function serviceModuleIndex(management, service) {
    return list(management.service_module_index).find((entry) => {
      const entryService = entry.service || {};
      return (service?.id && entryService.id === service.id) || (service?.code && entryService.code === service.code) || (service?.title && entryService.title === service.title);
    });
  }

  function modulesForServices(management, services) {
    return uniqueBy(
      list(services).flatMap((service) => list(serviceModuleIndex(management, service)?.modules)),
      (module) => module.id || module.code || module.title,
    );
  }

  function systemsProductsForServices(management, services) {
    return uniqueBy(
      list(services).flatMap((service) => {
        const entry = serviceModuleIndex(management, service) || {};
        return [...list(entry.systems), ...list(entry.products)];
      }),
      (item) => item.id || item.code || item.title || item.name,
    );
  }

  function stakeholdersFromMappings(processMappings) {
    return uniqueBy(
      list(processMappings).flatMap((mapping) =>
        Object.entries(mapping.stakeholders || {}).flatMap(([layer, stakeholders]) => list(stakeholders).map((stakeholder) => ({ ...stakeholder, layer }))),
      ),
      (stakeholder) => `${stakeholder.layer}:${stakeholder.id || stakeholder.code || stakeholder.title}`,
    );
  }

  function capabilityMatrixRows(capabilityTree, management, params = {}) {
    const query = text(params.q).trim().toLowerCase();
    return allFocuses(capabilityTree)
      .filter((focus) => focusMatchesSelection(capabilityTree, focus, params.capability_id))
      .map((focus) => {
        const services = uniqueBy(focus.services, (service) => service.id || service.code || service.title);
        const scopes = uniqueBy([...list(focus.scope_mappings).map((mapping) => mapping.scope), ...services.flatMap((service) => list(service.scopes))], (scope) => scope?.id || scope?.code || scope?.title);
        const processMappings = list(focus.process_mappings);
        return {
          focus,
          services,
          scopes,
          process_groups: uniqueBy(processMappings.map((mapping) => mapping.process_group), (item) => item?.id || item?.title),
          process_references: uniqueBy(processMappings.map((mapping) => mapping.process_reference), (item) => item?.id || item?.title),
          activities: processMappings.flatMap((mapping) => list(mapping.activities)),
          has_missing_activity: processMappings.some((mapping) => mapping.missing_activity || mapping.activity_status === "missing"),
          stakeholders: stakeholdersFromMappings(processMappings),
          modules: modulesForServices(management, services),
          systems_products: systemsProductsForServices(management, services),
        };
      })
      .filter((row) => {
        if (!query) return true;
        return [row.focus.code, row.focus.title, ...row.services.map(titleOf), ...row.scopes.map(titleOf), ...row.modules.map(titleOf)].join(" ").toLowerCase().includes(query);
      });
  }

  function environmentMatrixRows(management, params = {}) {
    const query = text(params.q).trim().toLowerCase();
    return list(management.environment_scope_tree)
      .filter((environment) => !params.environment_id || environment.id === params.environment_id)
      .flatMap((environment) =>
        list(environment.objects)
          .filter((object) => !params.object_id || object.id === params.object_id)
          .flatMap((object) =>
            list(object.scope_mappings)
              .filter((mapping) => !params.scope_id || mapping.scope?.id === params.scope_id)
              .map((mapping) => {
                const services = list(mapping.services);
                const modules = uniqueBy(services.flatMap((service) => list(service.modules)), (module) => module.id || module.code || module.title);
                return {
                  environment,
                  segments: list(object.segments),
                  information_object: object,
                  scope: mapping.scope,
                  services,
                  modules,
                };
              }),
          ),
      )
      .filter((row) => {
        if (!query) return true;
        return [row.environment.title, row.information_object.title, titleOf(row.scope), ...row.services.map(titleOf), ...row.modules.map(titleOf)].join(" ").toLowerCase().includes(query);
      });
  }

  function environmentMatrixRowsFromWorkbench(workbench, params = {}) {
    const objects = workbench?.objects && typeof workbench.objects === "object" ? workbench.objects : {};
    const relations = list(workbench?.relations);
    const byType = (type) => (objects[type] && typeof objects[type] === "object" ? objects[type] : {});
    const entity = (type, id) => byType(type)[id] || null;
    const relationsOf = (type) => relations.filter((relation) => relation.type === type);
    const rowsByObject = new Map();
    const ensureObjectRow = (environmentLike, segmentLike, objectLike) => {
      const object = entity("information_object", objectLike?.id) || objectLike;
      const environment = entity("information_environment", environmentLike?.id) || environmentLike;
      if (!object?.id || !environment?.id) return null;
      const row =
        rowsByObject.get(object.id) || {
          environment: { ...environment, title: titleOf(environment, "未命名环境") },
          information_object: { ...object, title: titleOf(object, "未命名对象") },
          segments: [],
        };
      const segment = entity("environment_segment", segmentLike?.id) || segmentLike;
      if (segment?.id || segment?.title) {
        row.segments = uniqueBy([...row.segments, { ...segment, title: titleOf(segment, "未定义环境子类") }], (item) => item.id || item.title);
      }
      rowsByObject.set(object.id, row);
      return row;
    };

    for (const environmentNode of list(workbench?.navigator?.tree)) {
      for (const child of list(environmentNode.children)) {
        if (child.type === "environment_segment") {
          for (const objectNode of list(child.children)) ensureObjectRow(environmentNode, child, objectNode);
        } else {
          ensureObjectRow(environmentNode, null, child);
        }
      }
    }

    if (!rowsByObject.size) {
      for (const relation of relationsOf("contains_object")) {
        const object = entity("information_object", relation.targetId);
        const segment = entity("environment_segment", relation.sourceId);
        const environmentRelation = segment
          ? relationsOf("contains_segment").find((item) => item.targetId === segment.id)
          : relations.find((item) => item.type === "contains_object" && item.targetId === relation.targetId);
        const environment = segment ? entity("information_environment", environmentRelation?.sourceId) : entity("information_environment", relation.sourceId);
        ensureObjectRow(environment, segment, object);
      }
    }

    const serviceScopeIds = new Map();
    for (const relation of relationsOf("applies_to_scope")) {
      if (!relation.sourceId || !relation.targetId) continue;
      serviceScopeIds.set(relation.sourceId, new Set([...(serviceScopeIds.get(relation.sourceId) || []), relation.targetId]));
    }
    const serviceModules = new Map();
    for (const relation of [...relationsOf("implemented_by_module"), ...relationsOf("implements_service")]) {
      const serviceId = relation.type === "implemented_by_module" ? relation.sourceId : relation.targetId;
      const moduleId = relation.type === "implemented_by_module" ? relation.targetId : relation.sourceId;
      const module = entity("security_technology_module", moduleId);
      if (!serviceId || !module) continue;
      serviceModules.set(serviceId, uniqueBy([...(serviceModules.get(serviceId) || []), module], (item) => item.id || item.code || item.title));
    }
    for (const relation of relationsOf("has_measure")) {
      const measure = entity("security_technical_measure", relation.targetId);
      if (!relation.sourceId || !measure) continue;
      serviceModules.set(relation.sourceId, uniqueBy([...(serviceModules.get(relation.sourceId) || []), { ...measure, objectKind: "安全技术措施" }], (item) => item.id || item.code || item.title));
    }
    const rows = [];
    for (const baseRow of rowsByObject.values()) {
      if (params.environment_id && baseRow.environment.id !== params.environment_id) continue;
      if (params.object_id && baseRow.information_object.id !== params.object_id) continue;
      const objectId = baseRow.information_object.id;
      const scopeRows = uniqueBy(
        relationsOf("applies_to_scope")
          .filter((relation) => relation.sourceId === objectId)
          .map((relation) => entity("scope_type", relation.targetId))
          .filter(Boolean),
        (scope) => scope.id || scope.code || scope.title,
      );
      const services = uniqueBy(
        relationsOf("protects_object")
          .filter((relation) => relation.targetId === objectId)
          .map((relation) => entity("security_technical_service", relation.sourceId))
          .filter(Boolean),
        (service) => service.id || service.code || service.title,
      );
      const scopedRows = scopeRows.length
        ? scopeRows
        : uniqueBy(services.flatMap((service) => [...(serviceScopeIds.get(service.id) || [])].map((scopeId) => entity("scope_type", scopeId))).filter(Boolean), (scope) => scope.id || scope.code || scope.title);
      for (const scope of scopedRows) {
        if (params.scope_id && scope.id !== params.scope_id) continue;
        const rowServices = services.filter((service) => {
          const scopeIds = serviceScopeIds.get(service.id);
          return !scopeIds?.size || scopeIds.has(scope.id);
        });
        rows.push({
          id: [objectId, scope.id || scope.code || scope.title].filter(Boolean).join("::"),
          environment: baseRow.environment,
          segments: baseRow.segments,
          information_object: baseRow.information_object,
          object: baseRow.information_object,
          scope,
          services: rowServices,
          modules: uniqueBy(rowServices.flatMap((service) => list(serviceModules.get(service.id))), (module) => module.id || module.code || module.title),
        });
      }
    }
    const query = text(params.q).trim().toLowerCase();
    return rows.filter((row) => {
      if (!query) return true;
      return [row.environment.title, row.information_object.title, ...row.segments.map(titleOf), titleOf(row.scope), ...row.services.map(titleOf), ...row.modules.map(titleOf)].join(" ").toLowerCase().includes(query);
    });
  }

  const dataClient = {
    async getHealth() {
      const runtimeHealth = await fetchRuntimeHealth();
      return createEnvelope({
        status: runtimeHealth?.status === "degraded" ? "degraded" : "ok",
        app: "SAPD Wiki",
        version: "v1",
        database_ready: runtimeHealth?.database_ready !== false,
        generated_data_ready: runtimeHealth?.generated_data_ready ?? true,
        runtime: runtimeHealth,
        checked_at: new Date().toISOString(),
      });
    },

    async getRuntimeHealth() {
      return createEnvelope(await fetchRuntimeHealth());
    },

    async getMcpControlPanel() {
      return createEnvelope(await fetchMcpControlApi(API_PATHS.mcpControlPanel, { kind: "control-panel" }));
    },

    async getMcpAuditPage(page = 1) {
      const normalizedPage = Math.max(1, Number.parseInt(page, 10) || 1);
      return createEnvelope(await fetchMcpControlApi(`${API_PATHS.mcpAudit}?page=${normalizedPage}`));
    },

    async startMcpService(payload) {
      return createEnvelope(await runMcpMutation(API_PATHS.mcpStart, payload));
    },

    async stopMcpService(payload) {
      return createEnvelope(await runMcpMutation(API_PATHS.mcpStop, payload));
    },

    async retryMcpService(payload) {
      return createEnvelope(await runMcpMutation(API_PATHS.mcpRetry, payload));
    },

    async updateMcpPort(payload) {
      return createEnvelope(await runMcpMutation(API_PATHS.mcpUpdatePort, {
        requestId: payload?.requestId,
        expectedStateVersion: payload?.expectedStateVersion,
        configured_port: Number(payload?.configuredPort),
      }));
    },

    async checkMcpService(payload) {
      return createEnvelope(await runMcpMutation(API_PATHS.mcpCheck, payload));
    },

    async decideMcpAuthorization(payload) {
      const allow = payload?.decision === "allow";
      return createEnvelope(await runMcpMutation(
        allow ? API_PATHS.mcpAuthorizationAllow : API_PATHS.mcpAuthorizationDeny,
        {
          requestId: payload?.requestId,
          expectedStateVersion: payload?.expectedStateVersion,
          authorization_request_id: text(payload?.authorizationRequestId).trim(),
        },
      ));
    },

    async revokeMcpClient(payload) {
      return createEnvelope(await runMcpMutation(API_PATHS.mcpRevokeClient, {
        requestId: payload?.requestId,
        expectedStateVersion: payload?.expectedStateVersion,
        client_id: text(payload?.clientId).trim(),
      }));
    },

    async clearMcpAudit(payload) {
      return createEnvelope(await runMcpMutation(API_PATHS.mcpClearAudit, payload));
    },

    async prepareMcpCertificateAction(payload) {
      return createEnvelope(await runMcpMutation(API_PATHS.mcpPrepareCertificate, {
        requestId: payload?.requestId,
        expectedStateVersion: payload?.expectedStateVersion,
        action: text(payload?.action).trim(),
      }));
    },

    async confirmMcpCertificateAction(payload) {
      return createEnvelope(await runMcpMutation(API_PATHS.mcpConfirmCertificate, {
        requestId: payload?.requestId,
        expectedStateVersion: payload?.expectedStateVersion,
        confirmation_id: text(payload?.confirmationId).trim(),
      }, { timeoutMs: 150000 }));
    },

    async prepareMcpReset(payload) {
      return createEnvelope(await runMcpMutation(API_PATHS.mcpPrepareReset, {
        requestId: payload?.requestId,
        expectedStateVersion: payload?.expectedStateVersion,
        audit_disposition: payload?.clearAudit ? "clear" : "retain",
      }));
    },

    async confirmMcpWebReset(payload) {
      return createEnvelope(await runMcpMutation(
        API_PATHS.mcpConfirmWebReset,
        {
          requestId: payload?.requestId,
          expectedStateVersion: payload?.expectedStateVersion,
          reset_id: text(payload?.resetId).trim(),
          confirmation: "RESET",
        },
      ));
    },

    async confirmMcpReset() {
      throw createMcpControlError("DESKTOP_CAPABILITY_REQUIRED", 428);
    },

    invalidatePackage(name) {
      const packageName = text(name).trim();
      if (!packageName || !Object.prototype.hasOwnProperty.call(DATA_PATHS, packageName)) return false;
      cache.delete(packageName);
      const apiPath = API_PACKAGE_PATHS[packageName];
      if (apiPath) apiFailureBackoff.delete(apiPath);
      return true;
    },

    async getSearchIndex(params = {}) {
      const query = text(params.q || params.query || "").trim();
      const limit = Number.isFinite(Number(params.limit)) ? Math.max(1, Math.min(Number(params.limit), 120)) : 80;
      const offset = Number.isFinite(Number(params.offset)) ? Math.max(0, Math.trunc(Number(params.offset))) : 0;
      const category = text(params.category || "").trim();
      const queryParams = new URLSearchParams();
      if (query) queryParams.set("q", query);
      queryParams.set("limit", String(limit));
      if (offset) queryParams.set("offset", String(offset));
      if (category) queryParams.set("category", category);
      const payload = await fetchApiData(`${API_PATHS.searchIndex}?${queryParams.toString()}`);
      return createEnvelope(
        payload || {
          generated_at: null,
          data_state: "api_unavailable",
          package_type: "runtime-search-index",
          query,
          results: [],
          stats: { items: 0, matched: 0, returned: 0, limit, offset },
        },
      );
    },

    async getUserFavorites() {
      const result = await fetchUserApi(API_PATHS.userFavorites);
      return createEnvelope({
        ok: Boolean(result.ok),
        data_state: result.data_state || (result.ok ? "ready" : "api_unavailable"),
        favorites: list(result.favorites),
        error: result.error || "",
      });
    },

    async upsertUserFavorite(payload) {
      const result = await fetchUserApi(API_PATHS.userFavorites, {
        method: "POST",
        headers: await userWriteHeaders(),
        body: JSON.stringify({
          target_ref: text(payload?.target_ref).trim(),
          note: payload?.note == null ? null : text(payload.note),
        }),
      });
      return createEnvelope(result);
    },

    async deleteUserFavorite(targetRef) {
      const query = `?target_ref=${encodeURIComponent(text(targetRef).trim())}`;
      const result = await fetchUserApi(`${API_PATHS.userFavorites}${query}`, {
        method: "DELETE",
        headers: await userWriteHeaders(),
        body: "{}",
      });
      return createEnvelope(result);
    },

    async getUserNotes(filters = {}) {
      const query = new URLSearchParams();
      if (filters.target_ref) query.set("target_ref", text(filters.target_ref).trim());
      if (filters.page_route) query.set("page_route", text(filters.page_route).trim());
      const path = `${API_PATHS.userNotes}${query.toString() ? `?${query.toString()}` : ""}`;
      const result = await fetchUserApi(path);
      return createEnvelope({
        ok: Boolean(result.ok),
        data_state: result.data_state || (result.ok ? "ready" : "api_unavailable"),
        notes: list(result.notes),
        error: result.error || "",
      });
    },

    async exportUserNotes(options = {}) {
      const shouldSave = await shouldSaveExportToConfiguredDirectory(options);
      const query = new URLSearchParams();
      if (shouldSave) {
        query.set("save", "1");
      } else {
        query.set("download", "1");
      }
      const path = `${API_PATHS.userNotesExport}${query.toString() ? `?${query.toString()}` : ""}`;
      const url = apiUrl(path);
      if (!url) return { ok: false, data_state: "api_unavailable", error: "当前运行模式未提供 Issue 导出服务" };
      try {
        const accept = shouldSave ? "application/json" : "text/markdown";
        const headers = shouldSave ? await userWriteHeaders() : {};
        headers.Accept = accept;
        let response = await fetch(url, { cache: "no-store", headers });
        if (shouldSave && [401, 403].includes(response.status)) {
          await refreshRuntimeHealth();
          const retryHeaders = await userWriteHeaders();
          retryHeaders.Accept = accept;
          response = await fetch(url, { cache: "no-store", headers: retryHeaders });
        }
        if (!response.ok) return { ok: false, data_state: "api_error", error: `HTTP ${response.status}` };
        if (shouldSave) {
          return normalizeUserPayload(await response.json());
        }
        const blob = await response.blob();
        const contentDisposition = response.headers.get("Content-Disposition") || "";
        const match = /filename\\*=UTF-8''([^;]+)|filename=\"([^\"]+)\"/i.exec(contentDisposition || "");
        const encodedName = match ? match[1] || match[2] || "" : "";
        let filename = "user-notes-export.md";
        if (encodedName) {
          try {
            filename = decodeURIComponent(encodedName);
          } catch {
            filename = encodedName;
          }
        }
        return { ok: true, data_state: "ready", blob, filename, size: blob?.size || 0 };
      } catch (error) {
        return { ok: false, data_state: "api_unavailable", error: error?.message || "用户 Issue 导出失败" };
      }
    },

    async saveMarkdownExport(payload = {}) {
      const content = text(payload.content).trim();
      if (!content) return { ok: false, data_state: "empty", error: "没有可导出的内容" };
      const shouldSave = await shouldSaveExportToConfiguredDirectory(payload);
      if (!shouldSave) {
        const prefix = text(payload.filename_prefix || "sapd-export").trim() || "sapd-export";
        const timestamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
        const filename = text(payload.filename).trim() || `${prefix}-${timestamp}.md`;
        const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
        return { ok: true, data_state: "ready", blob, filename, size: blob.size };
      }
      const result = await fetchUserApi(API_PATHS.userMarkdownExport, {
        method: "POST",
        headers: await userWriteHeaders(),
        body: JSON.stringify({
          filename_prefix: text(payload.filename_prefix || "sapd-export").trim(),
          filename: text(payload.filename).trim(),
          category: text(payload.category || "issues").trim(),
          content,
        }),
      });
      return result;
    },

    async createUserNote(payload) {
      const result = await fetchUserApi(API_PATHS.userNotes, {
        method: "POST",
        headers: await userWriteHeaders(),
        body: JSON.stringify({
          target_ref: text(payload?.target_ref).trim(),
          body: text(payload?.body).trim(),
          status: text(payload?.status || "todo").trim(),
          page_route: text(payload?.page_route).trim(),
          page_title: text(payload?.page_title).trim(),
          anchor_type: text(payload?.anchor_type || "object").trim(),
          object_type: text(payload?.object_type).trim(),
          object_title: text(payload?.object_title).trim(),
          tags: list(payload?.tags).map((item) => text(item).trim()).filter(Boolean),
        }),
      });
      return createEnvelope(result);
    },

    async updateUserNote(noteId, payload) {
      const body = {};
      if (Object.prototype.hasOwnProperty.call(payload || {}, "body")) body.body = text(payload.body).trim();
      if (Object.prototype.hasOwnProperty.call(payload || {}, "status")) body.status = text(payload.status).trim();
      if (Object.prototype.hasOwnProperty.call(payload || {}, "tags")) body.tags = list(payload.tags).map((item) => text(item).trim()).filter(Boolean);
      const result = await fetchUserApi(`${API_PATHS.userNotes}/${encodeURIComponent(text(noteId).trim())}`, {
        method: "PATCH",
        headers: await userWriteHeaders(),
        body: JSON.stringify(body),
      });
      return createEnvelope(result);
    },

    async deleteUserNote(noteId) {
      const result = await fetchUserApi(`${API_PATHS.userNotes}/${encodeURIComponent(text(noteId).trim())}`, {
        method: "DELETE",
        headers: await userWriteHeaders(),
        body: "{}",
      });
      return createEnvelope(result);
    },

    async getCatalogSummary() {
      const [capability, maintenance, lifecycle, content, sharedLookups] = await Promise.all([
        fetchPackage("capability"),
        fetchPackage("maintenance"),
        fetchPackage("lifecycle"),
        fetchPackage("content"),
        fetchPackage("sharedLookups"),
      ]);
      return createEnvelope({
        generated_at: [capability.generated_at, maintenance.generated_at, lifecycle.generated_at, content.generated_at, sharedLookups.generated_at].filter(Boolean).sort().at(-1) || null,
        stats: {
          capability: capability.stats || {},
          maintenance: maintenance.stats || {},
          lifecycle: lifecycle.stats || {},
          sharedLookups: sharedLookups.stats || {},
          content: content.stats || {},
        },
        data_packages: Object.entries(DATA_PATHS).map(([name, path]) => ({ name, path })),
      });
    },

    async getAnalyticsSummary() {
      const summary = await fetchPackage("analyticsSummary");
      return createEnvelope(summary);
    },

    async getDashboardKnowledgeSummary() {
      const summary = await fetchApiData(API_PATHS.dashboardKnowledgeSummary);
      return createEnvelope(summary || FALLBACKS.dashboardKnowledgeSummary);
    },

    async getMaturityWorkspace() {
      const workspace = await fetchApiData(API_PATHS.maturityWorkspace);
      return createEnvelope(
        workspace || {
          dataState: "api_unavailable",
          mode: "controlled_demo",
          persistence: "none",
          notice: "成熟度评估 API 当前不可用。",
          projects: [],
          projectDetails: {},
          template: null,
          levels: [],
          evidenceLevels: [],
        },
      );
    },

    async validateMaturityTemplate(template = {}) {
      const result = await fetchUserApi(API_PATHS.maturityTemplateValidate, {
        method: "POST",
        headers: await userWriteHeaders(),
        body: JSON.stringify({ template }),
      });
      return createEnvelope(result);
    },

    async calculateMaturityAssessment(payload = {}) {
      const result = await fetchUserApi(API_PATHS.maturityCalculate, {
        method: "POST",
        headers: await userWriteHeaders(),
        body: JSON.stringify(payload),
      });
      return createEnvelope(result);
    },

    async createMaturityReport(payload = {}) {
      const result = await fetchUserApi(API_PATHS.maturityReport, {
        method: "POST",
        headers: await userWriteHeaders(),
        body: JSON.stringify(payload),
      });
      return createEnvelope(result);
    },

    async getMaturityReportArtifact({ projectId = "", artifactId = "", reportId = "", inputHash = "", resultHash = "" } = {}) {
      const params = new URLSearchParams();
      if (projectId) params.set("project_id", projectId);
      if (artifactId) params.set("artifact_id", artifactId);
      if (reportId) params.set("report_id", reportId);
      if (inputHash) params.set("input_hash", inputHash);
      if (resultHash) params.set("result_hash", resultHash);
      const result = await fetchUserApi(`${API_PATHS.maturityReportArtifact}?${params.toString()}`);
      return createEnvelope(result);
    },

    async exportMaturityReport(payload = {}) {
      const shouldSave = await shouldSaveExportToConfiguredDirectory(payload);
      if (!shouldSave) return createEnvelope({ ok: true, dataState: "ready", destination: "download" });
      const result = await fetchUserApi(API_PATHS.maturityReportExport, {
        method: "POST",
        headers: await userWriteHeaders(),
        body: JSON.stringify(payload),
      });
      return createEnvelope(result);
    },

    async exportMaturityScoreExchange(payload = {}) {
      const shouldSave = await shouldSaveExportToConfiguredDirectory(payload);
      const result = await fetchUserApi(API_PATHS.maturityScoreExport, {
        method: "POST",
        headers: await userWriteHeaders(),
        body: JSON.stringify({ ...payload, saveToConfiguredDirectory: shouldSave }),
      });
      return createEnvelope(result);
    },

    async importMaturityScoreExchange(payload = {}) {
      const result = await fetchUserApi(API_PATHS.maturityScoreImport, {
        method: "POST",
        headers: await userWriteHeaders(),
        body: JSON.stringify(payload),
      });
      return createEnvelope(result);
    },

    async exportMaturityTemplateExchange(template = {}) {
      const shouldSave = await shouldSaveExportToConfiguredDirectory({});
      const result = await fetchUserApi(API_PATHS.maturityTemplateExport, {
        method: "POST",
        headers: await userWriteHeaders(),
        body: JSON.stringify({ template, saveToConfiguredDirectory: shouldSave }),
      });
      return createEnvelope(result);
    },

    async importMaturityTemplateExchange(exchange = {}) {
      const result = await fetchUserApi(API_PATHS.maturityTemplateImport, {
        method: "POST",
        headers: await userWriteHeaders(),
        body: JSON.stringify({ exchange }),
      });
      return createEnvelope(result);
    },

    async getCapabilityTree() {
      const capability = await fetchPackage("capability");
      return createEnvelope(capability);
    },

    async getCapabilityWorkbench() {
      const workbench = await fetchPackage("capabilityWorkbench");
      if (workbench.__data_state !== "missing_file") return createEnvelope(workbench);
      const { capability, management } = await getCapabilityAndManagement();
      return createEnvelope(createLegacyCapabilityWorkbenchFallback(capability, management), ["capability-workbench.json 不存在，已启用过渡 fallback。"]);
    },

    async getCapabilityWorkspaceInitial() {
      const splitInitial = await getCapabilityWorkspaceInitialFromSplit();
      if (splitInitial) return createEnvelope(splitInitial);
      const initial = await fetchApiData(API_PATHS.capabilityWorkspaceInitial);
      if (initial) return createEnvelope(initial);
      const workbench = await fetchPackage("capabilityWorkbench");
      return createEnvelope(workbench, ["workspace-initial API 不可用，已回退到完整 capability-workbench。"]);
    },

    async getCapabilityMatrix(params = {}) {
      const { capability, management } = await getCapabilityAndManagement();
      const rows = capabilityMatrixRows(capability, management, params);
      return createEnvelope({
        generated_at: capability.generated_at,
        selected: params.capability_id || null,
        rows,
        stats: { rows: rows.length },
      });
    },

    async getCapabilityRelationships(id) {
      const requestedId = text(id).trim();
      const { capability, management } = await getCapabilityAndManagement();
      const rows = requestedId ? capabilityMatrixRows(capability, management, { capability_id: requestedId }) : [];
      const focusRow = requestedId ? rows.find((row) => row.focus.id === requestedId) || null : null;
      return createEnvelope({
        generated_at: capability.generated_at,
        object: focusRow?.focus || null,
        path: focusRow ? capabilityPathForFocus(capability, focusRow.focus.id) : {},
        relationships: focusRow
          ? {
              services: focusRow.services,
              scopes: focusRow.scopes,
              process_groups: focusRow.process_groups,
              process_references: focusRow.process_references,
              activities: focusRow.activities,
              stakeholders: focusRow.stakeholders,
              modules: focusRow.modules,
              systems_products: focusRow.systems_products,
            }
          : {},
      });
    },

    async getCapabilityWorkspaceProjection(params = {}) {
      const focusId = params.focusId || params.focus_id || "";
      const objectType = params.objectType || params.object_type || "";
      const objectId = params.objectId || params.object_id || "";
      const queryParams = new URLSearchParams();
      if (objectType) queryParams.set("object_type", objectType);
      if (objectId) queryParams.set("object_id", objectId);
      if (!objectType && !objectId && focusId) queryParams.set("focus_id", focusId);
      const query = queryParams.toString() ? `?${queryParams.toString()}` : "";
      const projection = await fetchApiData(`${API_PATHS.capabilityWorkspaceProjection}${query}`, { timeoutMs: CAPABILITY_WORKSPACE_FETCH_TIMEOUT_MS });
      return createEnvelope(
        projection || {
          generated_at: null,
          data_state: "missing_api",
          technicalMappingRows: [],
          managementMappingRows: [],
          stats: { technical_rows: 0, management_rows: 0, focuses: 0 },
        },
      );
    },

    async getCapabilityWorkspaceView(params = {}) {
      const focusId = params.focusId || params.focus_id || "";
      const objectType = params.objectType || params.object_type || "";
      const objectId = params.objectId || params.object_id || "";
      const queryParams = new URLSearchParams();
      if (objectType) queryParams.set("object_type", objectType);
      if (objectId) queryParams.set("object_id", objectId);
      if (!objectType && !objectId && focusId) queryParams.set("focus_id", focusId);
      const query = queryParams.toString() ? `?${queryParams.toString()}` : "";
      const view = await fetchApiData(`${API_PATHS.capabilityWorkspaceView}${query}`, { timeoutMs: CAPABILITY_WORKSPACE_FETCH_TIMEOUT_MS });
      if (view) return createEnvelope(view);
      const projection = await this.getCapabilityWorkspaceProjection(params);
      return createEnvelope(projection.data, ["workspace-view API 不可用，已回退到 workspace-projection。"]);
    },

    async getEnvironmentTree() {
      const splitNavigator = await getEnvironmentNavigatorFromSplit();
      if (splitNavigator) return createEnvelope(splitNavigator);
      const workbench = await fetchPackage("environmentWorkbench");
      return createEnvelope({
        generated_at: workbench?.meta?.generated_at || null,
        dataSource: "environment-workbench",
        stats: workbench?.meta?.stats || {},
        environments: list(workbench?.navigator?.tree),
      });
    },

    async getEnvironmentNavigator() {
      const splitNavigator = await getEnvironmentNavigatorFromSplit();
      if (splitNavigator) return createEnvelope(splitNavigator);
      return this.getEnvironmentTree();
    },

    async getEnvironmentWorkspaceProjection(params = {}) {
      const splitProjection = await getEnvironmentWorkspaceProjectionFromSplit(params);
      if (splitProjection) return createEnvelope(splitProjection);
      const workbench = await fetchPackage("environmentWorkbench");
      const fallback = workbench?.__data_state === "missing_file" ? createLegacyEnvironmentWorkbenchFallback() : workbench;
      return createEnvelope(environmentProjectionFromWorkbenchFallback(fallback, params), ["environment split projection 不可用，已回退到完整 environment-workbench。"]);
    },

    async getEnvironmentWorkbench() {
      const workbench = await fetchPackage("environmentWorkbench");
      if (workbench.__data_state !== "missing_file") return createEnvelope(workbench);
      return createEnvelope(
        { ...createLegacyEnvironmentWorkbenchFallback(), __data_state: "missing_file" },
        ["environment-workbench.json 不存在，且 management-knowledge.json 已退役。"],
      );
    },

    async getEnvironmentDictionary() {
      return createEnvelope(await fetchPackage("environmentDictionary"));
    },

    isEnvironmentMasterDictionaryEnabled,

    async getEnvironmentMatrix(params = {}) {
      const workbench = await fetchPackage("environmentWorkbench");
      const rows =
        workbench?.__data_state === "missing_file"
          ? environmentMatrixRows(createLegacyEnvironmentWorkbenchFallback(), params)
          : environmentMatrixRowsFromWorkbench(workbench, params);
      return createEnvelope({
        generated_at: workbench?.meta?.generated_at || null,
        rows,
        stats: { rows: rows.length },
      });
    },

    async getEnvironmentRelationships(id) {
      const requestedId = text(id).trim();
      const workbench = await fetchPackage("environmentWorkbench");
      const rows =
        requestedId && workbench?.__data_state === "missing_file"
          ? environmentMatrixRows(createLegacyEnvironmentWorkbenchFallback(), { object_id: requestedId })
          : requestedId
          ? environmentMatrixRowsFromWorkbench(workbench, { object_id: requestedId })
          : [];
      const row = requestedId ? rows.find((item) => item.information_object?.id === requestedId) || null : null;
      const relationshipRows = row ? rows : [];
      return createEnvelope({
        generated_at: workbench?.meta?.generated_at || null,
        object: row?.information_object || null,
        environment: row?.environment || null,
        relationships: {
          rows: relationshipRows,
          scopes: uniqueBy(relationshipRows.map((item) => item.scope), (scope) => scope?.id || scope?.code || scope?.title),
          services: uniqueBy(relationshipRows.flatMap((item) => item.services), (service) => service?.id || service?.code || service?.title),
          modules: uniqueBy(relationshipRows.flatMap((item) => item.modules), (module) => module?.id || module?.code || module?.title),
        },
      });
    },

    async getMaintenanceScopes() {
      const management = await getMaintenanceSectionPayload("scopes");
      return createEnvelope({ generated_at: management.generated_at, items: list(management.scope_types), stats: { items: list(management.scope_types).length } });
    },

    async getMaintenanceProcesses() {
      const management = await getMaintenanceSectionPayload("processes");
      return createEnvelope({ generated_at: management.generated_at, items: list(management.security_processes), stats: { items: list(management.security_processes).length } });
    },

    async getMaintenanceWorkFunctions() {
      const management = await getMaintenanceSectionPayload("work-functions");
      return createEnvelope({ generated_at: management.generated_at, items: list(management.work_function_layers), stats: { items: list(management.work_function_layers).length } });
    },

    async getMaintenanceTechnologyModules() {
      const management = await getMaintenanceSectionPayload("modules");
      return createEnvelope({ generated_at: management.generated_at, items: list(management.security_technology_modules), stats: { items: list(management.security_technology_modules).length } });
    },

    async getMaintenanceTechnologyMeasures() {
      const management = await getMaintenanceSectionPayload("measures");
      const hasMeasureField = hasOwn(management, TECHNICAL_MEASURES_FIELD);
      const measures = hasMeasureField ? list(management[TECHNICAL_MEASURES_FIELD]) : [];
      return createEnvelope({
        generated_at: management.generated_at,
        items: measures,
        stats: { items: measures.length },
        data_state: measures.length ? "ready" : hasMeasureField ? "empty" : "field_missing",
        empty_state: measures.length
          ? null
          : hasMeasureField
            ? TECHNICAL_MEASURES_EMPTY_MESSAGE
            : "当前数据包尚未包含 security_technical_measures 字段，请确认 ETL 是否已导出 security_technical_measures。",
      });
    },

    async getMaintenanceStandardRoleReferences() {
      const management = await getMaintenanceSectionPayload("references");
      const standards = list(management.gbt_42446_references);
      const roles = list(management.gartner_roles);
      return createEnvelope({
        generated_at: management.generated_at,
        standards,
        roles,
        stats: {
          standards: standards.length,
          roles: roles.length,
          items: standards.length + roles.length,
        },
        empty_state: standards.length || roles.length ? null : "暂无岗位参考页面数据，请确认 ETL 是否已导出 gbt_42446_references 与 gartner_roles。",
      });
    },

    async getMaintenanceKnowledge() {
      return createEnvelope(await getMaintenanceKnowledgePayload());
    },

    async getMaintenanceIndex() {
      return createEnvelope(await getMaintenanceIndexPayload());
    },

    async getMaintenanceSection(sectionId) {
      return createEnvelope(await getMaintenanceSectionPayload(sectionId));
    },

    async getStandardFrameworks() {
      const standards = await getStandardsWithWorkforceReferences();
      return createEnvelope(standards);
    },

    async getStandardFramework(frameworkId) {
      return createEnvelope(await loadStandardFramework(frameworkId));
    },

    async getStandardFrameworkTable(frameworkId, tableId) {
      return createEnvelope(await loadStandardFrameworkTable(frameworkId, tableId));
    },

    async getContentViews() {
      const content = await fetchPackage("content");
      return createEnvelope(content);
    },

    async getSecurityArchitectureDesignGuide() {
      const guide = await fetchPackage("securityArchitectureDesignGuide");
      return createEnvelope(guide);
    },

    async getDataSecurityDesignGuide() {
      const guide = await fetchPackage("dataSecurityDesignGuide");
      return createEnvelope(guide);
    },

    async getLightPlanningGuide() {
      const guide = await fetchPackage("lightPlanningGuide");
      return createEnvelope(guide);
    },

    async getSharedLookups() {
      return createEnvelope(await fetchPackage("sharedLookups"));
    },

    async getLifecycleKnowledge() {
      return createEnvelope(await fetchPackage("lifecycle"));
    },


    async getLifecycleWorkbench() {
      const workbench = await fetchPackage("lifecycleWorkbench");
      if (workbench.__data_state !== "missing_file") return createEnvelope(workbench);
      const lifecycle = await fetchPackage("lifecycle");
      return createEnvelope(createLegacyLifecycleWorkbenchFallback(lifecycle), ["lifecycle-workbench.json 不存在，已启用过渡 fallback。"]);
    },

    async getApplicationSecurityLifecycle(params = {}) {
      const lifecycle = await fetchPackage("lifecycle");
      const appSecurity = lifecycle.application_security_development || {};
      const hasLifecycleFile = lifecycle.__data_state !== "missing_file";
      const hasApplicationData = list(appSecurity.processes).length > 0;
      const query = text(params.q).trim().toLowerCase();
      const processes = list(appSecurity.processes).filter((process) => {
        if (params.process_id && process.id !== params.process_id) return false;
        if (!query) return true;
        return [
          process.code,
          process.title,
          process.description,
          process.goal,
          ...list(process.main_activities).map(titleOf),
          ...list(process.security_activities).map(titleOf),
          ...list(process.policy_requirements).map(titleOf),
          ...list(process.technical_services).map(titleOf),
          ...list(process.technology_modules).map(titleOf),
          ...list(process.technical_measures).map(titleOf),
          ...list(process.development_technical_services).map(titleOf),
          ...list(process.development_technical_modules).map(titleOf),
        ]
          .join(" ")
          .toLowerCase()
          .includes(query);
      });
      return createEnvelope({
        generated_at: lifecycle.generated_at,
        stats: lifecycle.stats || {},
        data_state: !hasLifecycleFile ? "missing_file" : hasApplicationData ? "ready" : "empty",
        empty_state: !hasLifecycleFile
          ? "未找到 lifecycle-knowledge.json，请先执行 LC-AP 数据导出。"
          : hasApplicationData
            ? ""
            : "暂无开发安全生命周期数据，请确认 ETL 是否已导出 application_security_development。",
        processes,
        software_development_types: list(appSecurity.software_development_types),
        development_technical_services: list(appSecurity.development_technical_services),
        development_technical_modules: list(appSecurity.development_technical_modules),
        security_technical_measures: list(appSecurity.security_technical_measures),
        application_system_types: list(appSecurity.application_system_types),
      });
    },
  };

  window.sapdDataClient = dataClient;
})();
