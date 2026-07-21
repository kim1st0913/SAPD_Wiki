(function () {
  const components = (window.sapdComponents = window.sapdComponents || {});
  const utils = components.utils || {};
  const text = utils.text || ((value) => (value == null ? "" : String(value)));
  const list = utils.list || ((value) => (Array.isArray(value) ? value : []));
  const escapeHtml =
    utils.escapeHtml ||
    ((value) =>
      text(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;"));

  const STORAGE_KEY = "sapd-wiki-maturity-controlled-demo-v2.1";
  const TAB_STORAGE_KEY = "sapd-wiki-maturity-project-tabs-v1";
  const LEGACY_PROJECT_ROUTE_ID = "project-001";
  const PROJECT_TAB_IDS = new Set(["overview", "template", "scoring", "review", "results", "report", "report-v2"]);
  const FORMAL_RESULT_TAB_IDS = new Set(["results", "report", "report-v2"]);
  const DIRECTORY_PANE_METRICS = components.AppShell?.directoryPaneMetrics || {
    defaultWidth: 304,
    minWidth: 240,
    maxWidth: 520,
    handleWidth: 6,
  };
  const LEVELS = ["L1", "L2", "L3", "L4", "L5"];
  const DIMENSIONS = [
    ["organization", "组织与角色"],
    ["process", "制度与流程"],
    ["tool", "平台与工具"],
    ["data", "数据与信息"],
  ];
  const LEVEL_NAMES = {
    L1: "非正式执行",
    L2: "计划跟踪",
    L3: "充分定义",
    L4: "量化控制",
    L5: "持续优化",
  };
  const RADAR_SHORT_LABELS = {
    "T-AS.AD": "体系架构",
    "T-AS.AM": "资产管理",
    "T-AS.CM": "配置加固",
    "T-AS.VM": "漏洞补丁",
    "T-AS.IA": "身份访问",
    "T-AS.DS": "开发安全",
    "T-AS.LA": "日志审计",
    "T-AS.CG": "密码服务",
    "T-AS.DG": "数据治理",
    "T-PD.PP": "边界防护",
    "T-PD.AC": "访问控制",
    "T-PD.TP": "威胁防护",
    "T-PD.DP": "数据防护",
    "T-AD.SA": "态势感知",
    "T-AD.IR": "事件响应",
    "T-AD.SV": "架构评估",
    "T-IN.IO": "情报运营",
    "T-IN.IP": "情报生产",
    "T-OF.AT": "进攻反制",
    "G-SP.SM": "战略管理",
    "M-PM.PL": "安全规划",
    "M-PM.PR": "安全建设",
    "M-SA.AM": "安全保障",
    "M-SA.RM": "风险管理",
    "M-SA.RE": "合规管理",
    "M-SA.TP": "第三方",
    "M-SA.OP": "安全运行",
    "M-SA.CO": "安全协同",
    "M-SE.SE": "监督检查",
    "M-SE.PE": "绩效考核",
    "M-PS.HS": "人员管理",
    "M-PS.CT": "意识培养",
  };
  const EVIDENCE_NAMES = {
    E0: "无证据",
    E1: "文档证据",
    E2: "配置证据",
    E3: "运行证据",
    E4: "审计证据",
    E5: "持续证据",
  };
  const PROJECT_STATUS_NAMES = {
    draft: "草稿",
    template_configuring: "模板配置中",
    scoring: "评分中",
    score_review: "评分检查中",
    completed: "评估完成",
    reported: "已生成报告",
    archived: "已归档",
  };
  const LOCKED_ASSESSMENT_STATUSES = new Set(["completed", "reported", "archived"]);
  const ROADMAP_STATUSES = ["待规划", "已确认", "进行中", "已完成", "暂缓"];
  const REPORT_V2_FIELDS = [
    { id: "diagnosticInterpretation", stage: "1", label: "能力全景解读", maxLength: 220, question: "差距主要分布在哪里，哪些异常点需要优先解释？", structure: "差距分布 → 集中区域 → 异常点 → 优先切入点" },
    { id: "diagnosticManagementImplication", stage: "1", label: "诊断的管理含义", maxLength: 220, question: "四维差距对管理机制和能力建设方式意味着什么？", structure: "四维事实 → 管理影响 → 需要验证的机制" },
    { id: "executiveSummary", stage: "2", label: "总体差距研判", maxLength: 280, question: "为什么总体差距需要体系化处理，会影响哪些业务目标？", structure: "总体差距 → 体系性原因 → 业务影响" },
    { id: "keyFindings", stage: "2", label: "四维短板研判", maxLength: 280, question: "四个维度之间如何相互制约，主要原因是什么？", structure: "最高/最低维度 → 相互关系 → 原因判断" },
    { id: "managementRecommendations", stage: "3", label: "优先能力建设原则", maxLength: 280, question: "应采用什么跨部门建设原则和验收要求？", structure: "优先方向 → 责任协同 → 资源原则 → 验收证据" },
    { id: "nextSteps", stage: "3", label: "执行准备研判", maxLength: 280, question: "启动整改前必须满足哪些条件，30/60/90 天如何推进？", structure: "前置条件 → 30 天 → 60 天 → 90 天" },
    { id: "executionRiskConclusion", stage: "3", label: "执行风险结论", maxLength: 220, question: "当前首要执行风险是什么，可能造成什么影响？", structure: "风险 → 影响 → 处置要求" },
    { id: "executiveConclusionTitle", stage: "4", label: "管理层核心判断", maxLength: 60, question: "当前最需要管理层认识到什么？", structure: "一句话判断，不只重复分数", singleLine: true },
    { id: "executiveCurrentState", stage: "4", label: "现状解释", maxLength: 120, question: "当前阶段意味着什么，与目标状态有什么关键区别？", structure: "当前阶段 → 目标阶段 → 核心区别" },
    { id: "executiveJudgement", stage: "4", label: "原因判断", maxLength: 160, question: "差距属于局部问题还是体系问题，主要成因是什么？", structure: "问题性质 → 主要成因 → 判断依据" },
    { id: "executiveDecisionRecommendation", stage: "4", label: "决策建议", maxLength: 160, question: "管理层本次应批准哪些优先方向和时间要求？", structure: "批准事项 → 优先顺序 → 时间要求" },
    { id: "executiveMeetingDecision", stage: "5", label: "会议决议主张", maxLength: 80, question: "本次会议需要形成什么授权或决议？", structure: "决议对象 → 授权范围 → 生效要求", singleLine: true },
    { id: "decisionResponsibility", stage: "5", label: "责任授权决议", maxLength: 80, question: "牵头部门、流程所有者和协同关系如何明确？", structure: "牵头方 → 所有者 → 协同原则", singleLine: true },
    { id: "decisionResources", stage: "5", label: "资源投入决议", maxLength: 80, question: "人员、预算、平台和数据投入边界是什么？", structure: "资源类型 → 投入边界 → 优先顺序", singleLine: true },
    { id: "decisionCadence", stage: "5", label: "治理节奏决议", maxLength: 80, question: "整改周期、检查频率和复评要求如何确定？", structure: "周期 → 检查 → 验收 → 复评", singleLine: true },
  ];
  const REPORT_V2_STAGES = [
    { id: "1", index: "01", label: "解释数据", note: "先把雷达、差距和四维结果转成客观解读" },
    { id: "2", index: "02", label: "形成研判", note: "判断总体差距与四维短板之间的关系" },
    { id: "3", index: "03", label: "提出行动", note: "形成建设原则、执行准备和风险要求" },
    { id: "4", index: "04", label: "压缩摘要", note: "把前序判断压缩为管理层可读摘要" },
    { id: "5", index: "05", label: "形成决议", note: "明确责任、资源与治理节奏" },
  ];

  const model = {
    root: null,
    route: "/workbench/maturity",
    navigate: null,
    loading: false,
    loaded: false,
    loadPromise: null,
    error: "",
    workspace: null,
    details: {},
    activeTab: "scoring",
    selectedCapabilityId: "",
    selectedFocusId: "",
    selectedScoreItemId: "",
    selectedScoreViewLevel: "",
    selectedScoreViewId: "",
    selectedTemplateCapabilityId: "",
    projectObjectSearch: "",
    projectObjectSearchIndex: 0,
    projectHistoryPage: 0,
    projectInfoEditId: "",
    projectInfoDraft: {},
    projectInfoErrors: {},
    unlockConfirmProjectId: "",
    listSearch: "",
    listStatus: "active",
    listTemplateType: "all",
    listOwner: "all",
    listIndustry: "all",
    projectListPage: 1,
    projectListPageSize: 5,
    templateManagerView: "all",
    templateManagerPage: 1,
    templateManagerPageSize: 5,
    expandedProjectId: "",
    createOpen: false,
    createStep: 1,
    createErrors: {},
    createDraftProjectId: "",
    createDraft: {
      name: "",
      organization: "",
      industry: "",
      companySize: "",
      customerCharacteristics: "",
      constraints: "",
      owner: "",
      plannedStartDate: "",
      plannedEndDate: "",
      assessors: "",
      note: "",
      templateType: "",
      templateLibraryId: "",
    },
    scoringSearch: "",
    scoringStatus: "all",
    scoringEvidence: "all",
    focusBatchOpen: false,
    focusBatchLevel: "L3",
    focusBatchClearConfirmId: "",
    focusTargetBatchLevel: "L3",
    focusTargetClearConfirmId: "",
    scoreContextResizeBound: false,
    hierarchyExpansionByProject: {},
    directoryInitializedByProject: {},
    scoreDirectoryUiByProject: {},
    resultsView: "customer",
    reportEditingSection: "",
    reportV2Stage: "1",
    reportDownloadProjectId: "",
    reportDownloadFormat: "html",
    validation: null,
    calculating: false,
    reportGenerating: false,
    calculationSequence: 0,
    calculationTimer: 0,
    calculationPromise: null,
    toast: "",
    toastTone: "info",
    toastRoute: "",
    boundRoot: null,
    lastRenderContext: "",
  };

  const SCORE_DIRECTORY_MIN_WIDTH = DIRECTORY_PANE_METRICS.minWidth;
  const SCORE_DIRECTORY_MAX_WIDTH = DIRECTORY_PANE_METRICS.maxWidth;
  const SCORE_WORKBENCH_MIN_WIDTH = 640;

  function clone(value) {
    if (typeof structuredClone === "function") return structuredClone(value);
    return JSON.parse(JSON.stringify(value));
  }

  function normalizeTargetFields(entry) {
    if (!entry || typeof entry !== "object") return entry;
    if (!Object.prototype.hasOwnProperty.call(entry, "targetElements")) {
      entry.targetElements = LEVELS.includes(entry.targetLevel)
        ? DIMENSIONS.reduce((values, [key]) => ({ ...values, [key]: entry.targetLevel }), {})
        : {};
    }
    if (!Object.prototype.hasOwnProperty.call(entry, "targetDimensionNotes")) {
      entry.targetDimensionNotes = text(entry.targetReason)
        ? DIMENSIONS.reduce((values, [key]) => ({ ...values, [key]: text(entry.targetReason) }), {})
        : {};
    }
    entry.dimensionNotes = entry.dimensionNotes && typeof entry.dimensionNotes === "object" ? entry.dimensionNotes : {};
    return entry;
  }

  function syncLegacyTargetProjection(entry) {
    normalizeTargetFields(entry);
    const targetLevels = DIMENSIONS.map(([key]) => entry.targetElements?.[key]);
    entry.targetLevel = targetLevels.every((level) => LEVELS.includes(level)) && new Set(targetLevels).size === 1 ? targetLevels[0] : "";
    const notes = DIMENSIONS.map(([key]) => text(entry.targetDimensionNotes?.[key]).trim()).filter(Boolean);
    entry.targetReason = notes[0] || "";
    entry.targetConfirmed = hasCompleteElements(entry.targetElements);
    return entry;
  }

  function normalizeScoreEntries(entries) {
    return list(entries).map((entry) => normalizeTargetFields(entry));
  }

  function unwrap(response) {
    return response && typeof response === "object" && Object.prototype.hasOwnProperty.call(response, "data") ? response.data : response;
  }

  function nowLabel() {
    const date = new Date();
    const pad = (value) => String(value).padStart(2, "0");
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }

  function uid(prefix) {
    if (window.crypto?.randomUUID) return `${prefix}:${window.crypto.randomUUID()}`;
    return `${prefix}:${Date.now()}:${Math.random().toString(16).slice(2)}`;
  }

  function safeStore() {
    try {
      const raw = window.localStorage?.getItem(STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : {};
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
      return {};
    }
  }

  function writeStore(store) {
    try {
      window.localStorage?.setItem(STORAGE_KEY, JSON.stringify(store));
      return true;
    } catch {
      return false;
    }
  }

  function projectIdFromRoute(route = model.route) {
    const normalized = text(route).replace(/^#/, "").split("?")[0].replace(/\/+$/, "");
    const prefix = "/workbench/maturity/";
    if (!normalized.startsWith(prefix)) return "";
    const projectId = decodeURIComponent(normalized.slice(prefix.length));
    return projectId === LEGACY_PROJECT_ROUTE_ID ? "demo-project-001" : projectId;
  }

  function projectTabStore() {
    const tabs = {};
    for (const storage of [window.localStorage, window.sessionStorage]) {
      try {
        const parsed = JSON.parse(storage?.getItem(TAB_STORAGE_KEY) || "{}");
        if (parsed && typeof parsed === "object") Object.assign(tabs, parsed);
      } catch {
        // Continue to the next browser-scoped storage.
      }
    }
    return tabs;
  }

  function rememberedProjectTab(route = model.route) {
    const projectId = projectIdFromRoute(route);
    const candidate = projectId ? text(projectTabStore()[projectId]) : "";
    return PROJECT_TAB_IDS.has(candidate) ? candidate : "scoring";
  }

  function rememberProjectTab(tab = model.activeTab, projectId = projectIdFromRoute()) {
    if (!projectId || !PROJECT_TAB_IDS.has(tab)) return false;
    const tabs = projectTabStore();
    if (tabs[projectId] === tab) return true;
    tabs[projectId] = tab;
    for (const storage of [window.localStorage, window.sessionStorage]) {
      try {
        storage?.setItem(TAB_STORAGE_KEY, JSON.stringify(tabs));
        return true;
      } catch {
        // localStorage may be full because report content is large; sessionStorage keeps refresh continuity.
      }
    }
    return false;
  }

  function reportPersistenceReceipt(report) {
    if (!report?.id) return report || null;
    return {
      id: report.id,
      ok: report.ok !== false,
      formal: Boolean(report.formal),
      status: report.status || "",
      generatedAt: report.generatedAt || "",
      fileNames: clone(report.fileNames || {}),
      reportModel: { schemaVersion: report.reportModel?.schemaVersion || "" },
      html: "",
      markdown: "",
      persistence: report.persistence && typeof report.persistence === "object" ? clone(report.persistence) : "receipt_only",
    };
  }

  function persistDetail(detail) {
    if (!detail?.project?.id) return false;
    const store = safeStore();
    store.version = "2.1";
    store.projects = store.projects && typeof store.projects === "object" ? store.projects : {};
    const persistedDetail = {
      project: detail.project,
      scoreEntries: detail.scoreEntries,
      template: detail.template?.type === "custom" ? detail.template : null,
      result: detail.result || null,
      resultStale: Boolean(detail.resultStale),
      localSaveState: detail.localSaveState || "saved",
      lastSavedAt: detail.lastSavedAt || "",
      lastCalculatedAt: detail.lastCalculatedAt || "",
      validation: detail.validation || null,
      report: detail.report || null,
      reportNarrative: detail.reportNarrative || defaultReportNarrative(),
      reportNarrativeDirty: Boolean(detail.reportNarrativeDirty),
      reportV2Conclusions: detail.reportV2Conclusions || defaultReportV2Conclusions(),
      reportV2Dirty: Boolean(detail.reportV2Dirty),
      improvementRoadmap: list(detail.improvementRoadmap),
      exchangeBatches: list(detail.exchangeBatches).slice(-20),
      scoreImportIssues: list(detail.scoreImportIssues).slice(-200),
      scoreImportNotice: detail.scoreImportNotice || null,
      scoringLocation: detail.scoringLocation || null,
    };
    store.projects[detail.project.id] = persistedDetail;
    if (writeStore(store)) return true;
    if (!persistedDetail.report?.id) return false;
    store.projects[detail.project.id] = {
      ...persistedDetail,
      report: reportPersistenceReceipt(persistedDetail.report),
    };
    return writeStore(store);
  }

  function clearStoredDemo() {
    try {
      window.localStorage?.removeItem(STORAGE_KEY);
    } catch {
      // The API-backed demo remains usable when localStorage is unavailable.
    }
  }

  function hydrateWorkspace(workspace) {
    const details = {};
    Object.entries(workspace?.projectDetails || {}).forEach(([id, detail]) => {
      details[id] = {
        ...clone(detail),
        scoreEntries: normalizeScoreEntries(clone(detail.scoreEntries || [])),
        template: clone(detail.template || workspace.template),
        reportV2Conclusions: clone(detail.reportV2Conclusions || defaultReportV2Conclusions()),
        reportV2Dirty: Boolean(detail.reportV2Dirty),
        calculationRevision: 0,
      };
    });
    const storedProjects = safeStore().projects || {};
    Object.entries(storedProjects).forEach(([id, stored]) => {
      if (!stored?.project) return;
      const existing = details[id] || {};
      const storedProject = clone(stored.project);
      if (!existing.project && /^demo-project-\d{3}$/.test(id)) return;
      const controlledDemoRevision = text(existing.project?.controlledDemoRevision);
      if (controlledDemoRevision && controlledDemoRevision !== text(storedProject.controlledDemoRevision)) {
        details[id] = {
          ...existing,
          scoringLocation: clone(stored.scoringLocation || existing.scoringLocation || null),
          locallyStored: false,
        };
        return;
      }
      if (LOCKED_ASSESSMENT_STATUSES.has(storedProject.status)) storedProject.readOnly = true;
      details[id] = {
        ...existing,
        project: storedProject,
        template: clone(stored.template || existing.template || workspace.template),
        scoreEntries: normalizeScoreEntries(clone(stored.scoreEntries || existing.scoreEntries || [])),
        result: clone(stored.result || existing.result || null),
        resultStale: Boolean(stored.resultStale),
        localSaveState: stored.localSaveState || "saved",
        lastSavedAt: stored.lastSavedAt || "",
        lastCalculatedAt: stored.lastCalculatedAt || "",
        validation: clone(stored.validation || existing.validation || null),
        report: clone(stored.report || existing.report || null),
        reportNarrative: clone(stored.reportNarrative || existing.reportNarrative || defaultReportNarrative()),
        reportNarrativeDirty: Boolean(stored.reportNarrativeDirty),
        reportV2Conclusions: clone(stored.reportV2Conclusions || existing.reportV2Conclusions || defaultReportV2Conclusions()),
        reportV2Dirty: Boolean(stored.reportV2Dirty),
        improvementRoadmap: clone(stored.improvementRoadmap || existing.improvementRoadmap || []),
        exchangeBatches: clone(stored.exchangeBatches || existing.exchangeBatches || []),
        scoreImportIssues: clone(stored.scoreImportIssues || existing.scoreImportIssues || []),
        scoreImportNotice: clone(stored.scoreImportNotice || existing.scoreImportNotice || null),
        scoringLocation: clone(stored.scoringLocation || existing.scoringLocation || null),
        locallyStored: true,
        calculationRevision: 0,
      };
    });
    model.details = details;
  }

  function formalAssessmentReady(detail) {
    const summary = summaryOf(detail);
    const status = text(detail?.project?.status);
    if (!detail?.result?.ok || !LOCKED_ASSESSMENT_STATUSES.has(status) || detail?.resultStale) return false;
    const completionReady = Number(summary.completionRate || 0) >= 100
      && Number(summary.notScoredCount || 0) === 0
      && Number(summary.targetBelowCurrentCount || 0) === 0;
    return summary.statisticsReady === true ? completionReady : summary.statisticsReady == null && completionReady;
  }

  function reportMatchesCurrentAssessment(detail, report) {
    if (!formalAssessmentReady(detail) || report?.formal !== true) return false;
    const reportModel = report?.reportModel || {};
    const reportProjectId = text(reportModel.project?.id || report?.persistence?.projectId);
    const liveRun = detail?.result?.calculationRun || {};
    const reportRun = reportModel.resultSnapshot?.calculationRun || {};
    const reportVersion = reportModel.resultVersion || {};
    return reportProjectId === text(detail?.project?.id)
      && Boolean(text(liveRun.inputHash))
      && text(reportRun.inputHash) === text(liveRun.inputHash)
      && text(reportRun.resultHash) === text(liveRun.resultHash)
      && text(reportVersion.resultHash) === text(liveRun.resultHash)
      && text(reportVersion.templateSnapshotId) === text(detail?.template?.snapshotId);
  }

  async function restorePersistedReports() {
    const candidates = Object.values(model.details).filter((detail) => detail?.project?.id && formalAssessmentReady(detail));
    await Promise.all(candidates.map(async (detail) => {
      if (reportExportReady(detail.report) && reportMatchesCurrentAssessment(detail, detail.report)) {
        persistDetail(detail);
        return;
      }
      const persistence = detail.report?.persistence && typeof detail.report.persistence === "object" ? detail.report.persistence : {};
      const calculationRun = detail.result?.calculationRun || {};
      const response = await window.sapdDataClient?.getMaturityReportArtifact?.({
        projectId: detail.project.id,
        artifactId: persistence.artifactId || "",
        reportId: detail.report?.id || "",
        inputHash: calculationRun.inputHash || "",
        resultHash: calculationRun.resultHash || "",
      });
      const report = unwrap(response);
      if (!reportExportReady(report) || !reportMatchesCurrentAssessment(detail, report)) {
        detail.report = detail.report?.id ? reportPersistenceReceipt(detail.report) : null;
        persistDetail(detail);
        return;
      }
      detail.report = report;
      persistDetail(detail);
    }));
  }

  function activeProjectId() {
    return projectIdFromRoute();
  }

  function activeDetail() {
    const id = activeProjectId();
    return id ? model.details[id] || null : null;
  }

  function projectList() {
    return Object.values(model.details)
      .filter((detail) => detail?.project?.id)
      .sort((left, right) => text(right.project.updatedAt).localeCompare(text(left.project.updatedAt), "zh-Hans-CN", { numeric: true }));
  }

  function dashboardSnapshot(limit = 3) {
    const normalizedLimit = Math.max(0, Number(limit) || 0);
    const projects = projectList();
    return {
      dataState: model.error ? "api_unavailable" : model.loading || !model.loaded ? "loading" : "ready",
      total: projects.length,
      resultReadyCount: projects.filter((detail) => statisticsReadyForDisplay(detail)).length,
      projects: projects.slice(0, normalizedLimit).map((detail) => {
        const project = detail.project;
        const summary = summaryOf(detail);
        const resultReady = statisticsReadyForDisplay(detail);
        return {
          id: project.id,
          name: project.name,
          organization: project.organization,
          status: project.status,
          statusLabel: PROJECT_STATUS_NAMES[project.status] || project.status || "状态未填写",
          updatedAt: project.updatedAt || "",
          currentIndex: resultReady && Number.isFinite(Number(summary.currentIndex)) ? Number(summary.currentIndex) : null,
          currentLevel: resultReady ? summary.currentLevel || "" : "",
          completionRate: Number.isFinite(Number(summary.completionRate)) ? Number(summary.completionRate) : 0,
          resultReady,
          route: `/workbench/maturity/${encodeURIComponent(project.id)}`,
        };
      }),
    };
  }

  function summaryOf(detail) {
    return detail?.result?.summary || {
      currentIndex: null,
      currentLevel: "Not Scored",
      currentPercent: 0,
      targetLevel: "Not Scored",
      targetIndex: null,
      targetAchievementRate: null,
      completionRate: 0,
      evidenceCoverage: 0,
      notScoredCount: activeTemplateData(detail?.template).scoreItems.length,
      notApplicableCount: 0,
    };
  }

  function statisticsReadyForDisplay(detail) {
    return formalAssessmentReady(detail);
  }

  function assessmentProgress(detail) {
    const summary = summaryOf(detail);
    const active = activeTemplateData(detail?.template);
    const capabilityRows = list(detail?.result?.capabilityResults);
    const focusRows = list(detail?.result?.focusResults);
    const applicableCapabilities = capabilityRows.filter((row) => row.status !== "not_applicable");
    const applicableFocuses = focusRows.filter((row) => row.status !== "not_applicable");
    const completedCapabilities = applicableCapabilities.filter((row) => row.status === "ready" || Number(row.completionRate || 0) >= 100);
    const completedFocuses = applicableFocuses.filter((row) => row.status === "ready" || Number(row.completionRate || 0) >= 100);
    const numeric = (value, fallback) => Number.isFinite(Number(value)) ? Number(value) : fallback;
    const applicableItemCount = numeric(summary.applicableItemCount, active.scoreItems.length - numeric(summary.notApplicableCount, 0));
    const completedItemCount = numeric(summary.scoredItemCount, 0);
    const priorityCapabilities = capabilityRows
      .filter((row) => row.status !== "not_applicable" && Number(row.completionRate || 0) < 100)
      .sort((left, right) => {
        const leftStarted = Number(left.completionRate || 0) > 0 ? 1 : 0;
        const rightStarted = Number(right.completionRate || 0) > 0 ? 1 : 0;
        return rightStarted - leftStarted
          || Number(right.completionRate || 0) - Number(left.completionRate || 0)
          || text(left.code || left.name).localeCompare(text(right.code || right.name), "zh-Hans-CN", { numeric: true });
      })
      .slice(0, 3);
    return {
      completionRate: numeric(summary.completionRate, 0),
      capabilityCount: numeric(summary.applicableCapabilityCount, capabilityRows.length ? applicableCapabilities.length : active.capabilities.length),
      completedCapabilityCount: numeric(summary.completedCapabilityCount, completedCapabilities.length),
      focusCount: numeric(summary.applicableFocusCount, focusRows.length ? applicableFocuses.length : active.focuses.length),
      completedFocusCount: numeric(summary.completedFocusCount, completedFocuses.length),
      applicableItemCount,
      completedItemCount,
      remainingItemCount: Math.max(0, applicableItemCount - completedItemCount),
      notApplicableCount: numeric(summary.notApplicableCount, 0),
      capabilityTotalCount: active.capabilities.length,
      focusTotalCount: active.focuses.length,
      itemTotalCount: active.scoreItems.length,
      priorityCapabilities,
    };
  }

  function completionPercent(completed, applicable) {
    const denominator = Math.max(0, Number(applicable || 0));
    if (!denominator) return 0;
    return Math.max(0, Math.min(100, (Number(completed || 0) / denominator) * 100));
  }

  function appendProjectHistory(detail, action, label, description, metadata = {}) {
    if (!detail?.project) return;
    detail.project.changeHistory = list(detail.project.changeHistory);
    detail.project.changeHistory.push({ action, label, description, changedAt: nowLabel(), ...metadata });
  }

  function projectChangeHistory(detail) {
    const history = list(detail?.project?.changeHistory);
    if (history.length) return history.slice().reverse();
    const project = detail?.project || {};
    return [{
      action: "CURRENT_SNAPSHOT",
      label: "当前项目状态",
      description: `${PROJECT_STATUS_NAMES[project.status] || project.status || "状态未填写"} · ${project.readOnly ? "评分已锁定" : "评分可编辑"}`,
      changedAt: project.updatedAt || "-",
    }];
  }

  function activeTemplateData(template) {
    const categories = list(template?.categories);
    const capabilities = list(template?.capabilities).filter((item) => item.included !== false);
    const capabilityIds = new Set(capabilities.map((item) => item.id));
    const focuses = list(template?.focuses).filter((item) => item.included !== false && capabilityIds.has(item.capabilityId));
    const focusIds = new Set(focuses.map((item) => item.id));
    const scoreItems = list(template?.scoreItems).filter((item) => focusIds.has(item.focusId));
    const focusServiceMappings = list(template?.focusServiceMappings).filter((item) => focusIds.has(item.focusId));
    const serviceIds = new Set([...scoreItems.filter((item) => item.itemType === "SERVICE" && item.serviceId).map((item) => item.serviceId), ...focusServiceMappings.map((item) => item.serviceId).filter(Boolean)]);
    return { categories, capabilities, focuses, scoreItems, focusServiceMappings, serviceIds };
  }

  function projectObjectSearchResults(detail) {
    const query = text(model.projectObjectSearch).trim().toLowerCase();
    if (!query) return [];
    const active = activeTemplateData(detail?.template);
    const focusById = new Map(active.focuses.map((item) => [item.id, item]));
    const categoryRows = byTemplateOrder(active.categories)
      .filter((item) => ["L0", "L1"].includes(categoryCapabilityLevel(item)))
      .map((item) => ({ type: categoryCapabilityLevel(item), id: item.id, code: item.code, name: item.name }));
    const capabilityRows = byTemplateOrder(active.capabilities)
      .map((item) => ({ type: "L2", id: item.id, code: item.code, name: item.name }));
    const focusRows = byTemplateOrder(active.focuses)
      .map((item) => ({ type: "FOCUS", id: item.id, code: item.code, name: item.name, capabilityId: item.capabilityId }));
    const serviceById = new Map(list(detail?.template?.services).filter((item) => active.serviceIds.has(item.id)).map((item) => [item.id, item]));
    const serviceContexts = new Map();
    byTemplateOrder(active.scoreItems).forEach((item) => {
      if (item.itemType !== "SERVICE" || !item.serviceId || serviceContexts.has(item.serviceId)) return;
      serviceContexts.set(item.serviceId, { focusId: item.focusId, scoreItemId: item.id });
    });
    byTemplateOrder(active.focusServiceMappings).forEach((item) => {
      if (!item.serviceId || serviceContexts.has(item.serviceId)) return;
      serviceContexts.set(item.serviceId, { focusId: item.focusId, scoreItemId: "" });
    });
    const serviceRows = byTemplateOrder([...serviceById.values()]).map((item) => {
      const context = serviceContexts.get(item.id) || {};
      const focus = focusById.get(context.focusId) || {};
      return { type: "SERVICE", id: item.id, code: item.code, name: item.name, focusId: context.focusId, scoreItemId: context.scoreItemId, context: `${focus.code || ""} ${focus.name || ""}`.trim() };
    });
    return [...categoryRows, ...capabilityRows, ...focusRows, ...serviceRows]
      .filter((item) => [item.code, item.name, item.context].join(" ").toLowerCase().includes(query))
      .slice(0, 10);
  }

  function renderProjectObjectSearch(detail) {
    const rows = projectObjectSearchResults(detail);
    const query = text(model.projectObjectSearch).trim();
    const activeIndex = rows.length ? Math.max(0, Math.min(rows.length - 1, Number(model.projectObjectSearchIndex || 0))) : 0;
    const typeNames = { L0: "L0", L1: "L1", L2: "L2", FOCUS: "关注点", SERVICE: "安全技术服务" };
    return `<div class="maturity-v21-project-search page-search-control" role="search" aria-label="当前评估模板对象搜索">
      <label class="page-search-input-shell"><span class="capability-search-icon" aria-hidden="true">⌕</span><input type="search" value="${escapeHtml(model.projectObjectSearch)}" placeholder="搜索 L0 / L1 / L2 / 关注点 / 安全技术服务" data-maturity-project-search autocomplete="off" aria-label="搜索当前评估模板业务对象" aria-activedescendant="${rows.length ? `maturityProjectSearchResult${activeIndex}` : ""}" /></label>
      <span class="page-search-match-status" aria-live="polite">${query ? `${rows.length ? activeIndex + 1 : 0} / ${rows.length}` : ""}</span>
      <button class="page-search-step" type="button" data-maturity-action="step-project-search" data-search-step="-1" aria-label="上一个匹配" title="上一个匹配" ${rows.length ? "" : "disabled"}>‹</button>
      <button class="page-search-step" type="button" data-maturity-action="step-project-search" data-search-step="1" aria-label="下一个匹配" title="下一个匹配" ${rows.length ? "" : "disabled"}>›</button>
      ${query ? `<div class="maturity-v21-project-search-results" role="listbox" aria-label="当前模板搜索结果">${rows.map((item, index) => `<button id="maturityProjectSearchResult${index}" class="${index === activeIndex ? "is-active" : ""}" type="button" role="option" aria-selected="${index === activeIndex}" data-project-search-index="${index}" data-maturity-action="open-project-object-result" data-object-type="${escapeHtml(item.type)}" data-object-id="${escapeHtml(item.id)}" data-focus-id="${escapeHtml(item.focusId || "")}" data-score-item-id="${escapeHtml(item.scoreItemId || "")}"><span>${escapeHtml(typeNames[item.type] || item.type)}</span><strong>${escapeHtml(item.code || "自定义")} ${escapeHtml(item.name || "未命名")}</strong>${item.context ? `<small>${escapeHtml(item.context)}</small>` : ""}</button>`).join("") || `<div class="maturity-v21-project-search-empty">当前模板没有匹配的业务对象</div>`}</div>` : ""}
    </div>`;
  }

  function templateStats(template) {
    const active = activeTemplateData(template);
    return {
      topCategories: active.categories.filter((item) => Number(item.level) === 1).length,
      domains: active.categories.filter((item) => Number(item.level) === 2).length,
      capabilities: active.capabilities.length,
      focuses: active.focuses.length,
      services: active.serviceIds.size,
      scoreItems: active.scoreItems.length,
    };
  }

  function defaultReportNarrative() {
    return {
      executiveSummary: "",
      keyFindings: "",
      managementRecommendations: "",
      nextSteps: "",
    };
  }

  function defaultReportV2Conclusions() {
    return Object.fromEntries(REPORT_V2_FIELDS.map((field) => [field.id, ""]));
  }

  function reportExportReady(report) {
    return report?.reportModel?.schemaVersion === "sapd-maturity-report-model-v2"
      && Boolean(text(report.html).trim())
      && Boolean(text(report.markdown).trim());
  }

  function reportPreviouslyGenerated(detail) {
    if (detail?.report?.id) return true;
    if (["reported", "archived"].includes(detail?.project?.status)) return true;
    return list(detail?.project?.changeHistory).some((item) => ["REPORT_GENERATED", "REPORT_UPDATED"].includes(item?.action));
  }

  function defaultImprovementAction(gap) {
    return list(gap?.recommendations)
      .slice(0, 2)
      .map((item) => text(item?.text).trim())
      .filter(Boolean)
      .join(" ");
  }

  function improvementRoadmapRows(detail) {
    const storedRows = new Map(list(detail?.improvementRoadmap).map((row) => [text(row?.capabilityId), row]));
    return list(detail?.result?.gapItems).slice(0, 10).map((gap, index) => {
      const capabilityId = text(gap?.capabilityId);
      const hasStored = storedRows.has(capabilityId);
      const stored = storedRows.get(capabilityId) || {};
      return {
        rank: index + 1,
        capabilityId,
        capabilityCode: text(gap?.capabilityCode),
        capabilityName: text(gap?.capabilityName),
        priority: text(gap?.priority),
        priorityScore: gap?.priorityScore,
        currentLevel: text(gap?.currentLevel),
        targetLevel: text(gap?.targetLevel),
        gapIndex: gap?.gapIndex,
        action: hasStored ? text(stored.action) : defaultImprovementAction(gap),
        owner: text(stored.owner),
        resources: text(stored.resources),
        dependencies: text(stored.dependencies),
        status: ROADMAP_STATUSES.includes(stored.status) ? stored.status : "待规划",
      };
    });
  }

  function updateImprovementRoadmapField(detail, capabilityId, field, value) {
    if (!detail || !["action", "owner", "resources", "dependencies", "status"].includes(field)) return;
    detail.improvementRoadmap = improvementRoadmapRows(detail).map((row) => row.capabilityId === capabilityId ? { ...row, [field]: value } : row);
    detail.reportNarrativeDirty = true;
    detail.project.updatedAt = nowLabel();
    persistDetail(detail);
  }

  function templateLibraryRecords() {
    const baseTemplate = model.workspace?.template;
    const records = [];
    if (baseTemplate?.id) records.push({ template: baseTemplate, source: "default", sourceProjectId: "", importedAt: "" });
    projectList().forEach((detail) => {
      if (detail.template?.type !== "custom" || !detail.template?.id) return;
      records.push({ template: detail.template, source: "project", sourceProjectId: detail.project.id, importedAt: detail.project.updatedAt || "" });
    });
    list(safeStore().templateLibrary).forEach((item) => {
      const template = item?.template || item;
      if (template?.id) records.push({ template, source: "import", sourceProjectId: "", importedAt: item?.importedAt || "" });
    });
    const unique = new Map();
    records.forEach((item) => {
      if (!unique.has(item.template.id)) unique.set(item.template.id, item);
    });
    return [...unique.values()];
  }

  function templateImportHistory() {
    const stored = list(safeStore().templateImportBatches);
    const projectBatches = projectList().flatMap((detail) => list(detail.exchangeBatches).filter((item) => item?.exchangeType === "TEMPLATE_STRUCTURE"));
    const unique = new Map();
    [...stored, ...projectBatches].forEach((item) => {
      if (item?.id && !unique.has(item.id)) unique.set(item.id, item);
    });
    return [...unique.values()].sort((left, right) => text(right.importedAt || right.createdAt || right.id).localeCompare(text(left.importedAt || left.createdAt || left.id), "zh-Hans-CN", { numeric: true }));
  }

  function paginatedRows(rows, requestedPage, requestedPageSize) {
    const pageSize = [5, 10, 20].includes(Number(requestedPageSize)) ? Number(requestedPageSize) : 5;
    const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
    const page = Math.max(1, Math.min(pageCount, Number(requestedPage) || 1));
    const start = (page - 1) * pageSize;
    return { rows: rows.slice(start, start + pageSize), page, pageSize, pageCount, total: rows.length, start };
  }

  function renderWorkspacePagination(target, pagination) {
    const { page, pageSize, pageCount, total, start } = pagination;
    const first = total ? start + 1 : 0;
    const last = total ? Math.min(total, start + pageSize) : 0;
    const pageButtons = Array.from({ length: pageCount }, (_, index) => index + 1)
      .filter((value) => pageCount <= 5 || value === 1 || value === pageCount || Math.abs(value - page) <= 1)
      .map((value, index, values) => `${index && value - values[index - 1] > 1 ? '<span aria-hidden="true">…</span>' : ""}<button class="${value === page ? "is-current" : ""}" type="button" data-maturity-action="set-workspace-page" data-page-target="${target}" data-page="${value}" aria-label="第 ${value} 页"${value === page ? ' aria-current="page"' : ""}>${value}</button>`)
      .join("");
    return `<footer class="maturity-v26-pagination" aria-label="${target === "projects" ? "评估项目" : "模板"}分页">
      <span>显示 ${first}–${last}，共 ${total} 项</span>
      <div><button type="button" data-maturity-action="set-workspace-page" data-page-target="${target}" data-page="${page - 1}" ${page <= 1 ? "disabled" : ""}>上一页</button>${pageButtons}<button type="button" data-maturity-action="set-workspace-page" data-page-target="${target}" data-page="${page + 1}" ${page >= pageCount ? "disabled" : ""}>下一页</button></div>
      <label><span>每页</span><select data-maturity-page-size="${target}" aria-label="${target === "projects" ? "评估项目" : "模板"}每页条数">${[5, 10, 20].map((value) => `<option value="${value}"${value === pageSize ? " selected" : ""}>${value}</option>`).join("")}</select></label>
    </footer>`;
  }

  function renderTemplateManager() {
    const records = templateLibraryRecords();
    const filtered = model.templateManagerView === "custom" ? records.filter((item) => item.template.type === "custom") : records;
    const history = templateImportHistory();
    const templateRows = model.templateManagerView === "history" ? history : filtered;
    const pagination = paginatedRows(templateRows, model.templateManagerPage, model.templateManagerPageSize);
    model.templateManagerPage = pagination.page;
    return `<section class="maturity-v24-home-section maturity-v24-template-manager" aria-labelledby="maturityTemplateManagerTitle">
      <header><div><span>模板资产</span><h2 id="maturityTemplateManagerTitle">模板管理</h2><p>标准模板保持只读；自定义模板必须保留评分标题和评分列，但所有评分数据单元格必须为空。</p></div><div><button class="maturity-v1-button is-secondary maturity-v28-import-button" type="button" data-maturity-action="trigger-global-template-import">导入自定义模板</button><input type="file" accept="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,.xlsx" hidden data-maturity-template-library-file /></div></header>
      <nav class="maturity-v24-template-views" aria-label="模板管理视图">
        ${[["all", "全部模板", records.length], ["custom", "自定义模板", records.filter((item) => item.template.type === "custom").length], ["history", "导入任务", history.length]].map(([value, label, count]) => `<button class="${model.templateManagerView === value ? "is-active" : ""}" type="button" data-maturity-action="set-template-view" data-template-view="${value}" aria-label="${label}，${count} 项" aria-pressed="${model.templateManagerView === value}">${label}</button>`).join("")}
      </nav>
      ${model.templateManagerView === "history" ? `<div class="maturity-v24-template-table"><table class="maturity-v28-template-table is-history"><thead><tr><th>任务</th><th>来源类型</th><th>状态</th><th>结果</th></tr></thead><tbody>${history.length ? pagination.rows.map((item) => `<tr><td><strong>${escapeHtml(item.id)}</strong><small>${escapeHtml(item.importedAt || item.createdAt || "本地受控任务")}</small></td><td>自定义模板</td><td><span class="maturity-v1-status ${item.status === "success" ? "is-good" : "is-warn"}">${escapeHtml(item.status === "success" ? "成功" : item.status || "待确认")}</span></td><td>${Number(item.successCount || (item.status === "success" ? 1 : 0))} 成功 / ${Number(item.failureCount || 0)} 失败</td></tr>`).join("") : `<tr><td colspan="4"><div class="maturity-v1-table-empty"><strong>暂无模板导入任务</strong><span>导入自定义业务模板后，这里会保留本地受控记录。</span></div></td></tr>`}</tbody></table></div>` : `<div class="maturity-v24-template-table"><table class="maturity-v28-template-table"><thead><tr><th>模板</th><th>类型 / 版本</th><th>结构</th><th>来源</th><th>操作</th></tr></thead><tbody>${filtered.length ? pagination.rows.map((item) => { const stats = templateStats(item.template); const project = item.sourceProjectId ? model.details[item.sourceProjectId]?.project : null; return `<tr><td><strong>${escapeHtml(item.template.name || "未命名模板")}</strong></td><td><span class="maturity-v2-template-kind">${item.template.type === "base" ? "标准" : "自定义"}</span><small>${escapeHtml(item.template.version || "V2.1")}</small></td><td><strong>${stats.capabilities} L2 · ${stats.focuses} 关注点</strong><small>${stats.scoreItems} 个评估点</small></td><td>${item.source === "default" ? "知识库稳定模板" : item.source === "project" ? `项目：${escapeHtml(project?.name || "本地项目")}` : "历史导入副本"}</td><td><div class="maturity-v24-template-actions"><button class="maturity-v1-button is-secondary maturity-v28-export-button" type="button" data-maturity-action="export-global-template" data-template-id="${escapeHtml(item.template.id)}">导出 XLSX</button></div></td></tr>`; }).join("") : `<tr><td colspan="5"><div class="maturity-v1-table-empty"><strong>暂无自定义模板</strong><span>可以导入自定义业务模板，或在新建项目时创建自定义模板。</span></div></td></tr>`}</tbody></table></div>`}
      ${renderWorkspacePagination("templates", pagination)}
    </section>`;
  }

  function renderTemplateManagerRegion({ restoreTabFocus = false } = {}) {
    const current = model.root?.querySelector(".maturity-v24-template-manager");
    if (!current) {
      render();
      return;
    }
    const fragment = document.createElement("template");
    fragment.innerHTML = renderTemplateManager().trim();
    const next = fragment.content.firstElementChild;
    if (!next) return;
    current.replaceWith(next);
    if (restoreTabFocus) {
      window.setTimeout(() => model.root?.querySelector(`[data-maturity-action="set-template-view"][data-template-view="${model.templateManagerView}"]`)?.focus(), 0);
    }
  }

  function normalizedRoute(route = model.route) {
    return text(route || "/workbench/maturity").replace(/^#/, "").split("?")[0].replace(/\/+$/, "") || "/workbench/maturity";
  }

  function renderFeedback() {
    if (!model.toast || model.toastRoute !== normalizedRoute()) return "";
    return `<div class="maturity-v24-feedback is-${escapeHtml(model.toastTone)}" role="status"><strong>${model.toastTone === "error" ? "需要处理" : model.toastTone === "success" ? "操作完成" : "操作提示"}</strong><span>${escapeHtml(model.toast)}</span><button type="button" data-maturity-action="dismiss-feedback" aria-label="关闭提示">×</button></div>`;
  }

  function showToast(message, tone = "info") {
    model.toast = text(message);
    model.toastTone = tone;
    model.toastRoute = normalizedRoute();
    render();
    window.setTimeout(() => {
      if (model.toast === message && model.toastRoute === normalizedRoute()) {
        model.toast = "";
        model.toastRoute = "";
        render();
      }
    }, 2800);
  }

  function statusTone(status) {
    if (["completed", "reported", "archived"].includes(status)) return "is-good";
    if (status === "score_review") return "is-review";
    if (status === "template_configuring") return "is-warn";
    return "is-active";
  }

  function projectStatusGroup(status) {
    if (["completed", "reported", "archived"].includes(status)) return "completed";
    return "active";
  }

  function projectPrimaryAction(project) {
    const actions = {
      draft: ["继续设置", "overview"],
      template_configuring: ["继续配置", "template"],
      scoring: ["继续评分", "scoring"],
      score_review: ["进入复核", "review"],
      completed: ["查看结果", "results"],
      reported: ["查看报告", "report"],
      archived: ["查看快照", "overview"],
    };
    return actions[project?.status] || ["打开项目", "overview"];
  }

  function displayTemplateName(detail) {
    if (detail?.project?.templateType === "base") {
      return model.workspace?.template?.name || "SAPD标准能力成熟度模板";
    }
    return detail?.project?.templateName || detail?.template?.name || "未选择";
  }

  function createDraftIsDirty() {
    return Object.entries(model.createDraft || {}).some(([key, value]) => key !== "templateType" && text(value).trim());
  }

  function emptyCreateDraft() {
    return { name: "", organization: "", industry: "", companySize: "", customerCharacteristics: "", constraints: "", owner: "", plannedStartDate: "", plannedEndDate: "", assessors: "", note: "", templateType: "", templateLibraryId: "" };
  }

  function levelTone(level) {
    return LEVELS.includes(level) ? `is-${level.toLowerCase()}` : "is-unscored";
  }

  function renderLevelScore(level, score, label = "成熟度指数") {
    const normalizedLevel = LEVELS.includes(level) ? level : "—";
    const normalizedScore = Number.isFinite(Number(score)) ? Number(score).toFixed(2) : "—";
    return `<span class="maturity-v24-level-score ${levelTone(normalizedLevel)}"><strong>${escapeHtml(normalizedLevel)}</strong><span><b>${escapeHtml(normalizedScore)}</b><small>${escapeHtml(label)} / 5.00</small></span></span>`;
  }

  function percent(value) {
    const number = Number(value);
    return Number.isFinite(number) ? Math.max(0, Math.min(100, number)) : 0;
  }

  function levelOptions(selected, { includeEmpty = false, compact = false } = {}) {
    return `${includeEmpty ? '<option value="">未设置</option>' : ""}${LEVELS.map(
      (level) => `<option value="${level}"${level === selected ? " selected" : ""}>${level}${compact ? "" : ` ${LEVEL_NAMES[level]}`}</option>`,
    ).join("")}`;
  }

  function evidenceOptions(selected) {
    return Object.entries(EVIDENCE_NAMES)
      .map(([value, label]) => `<option value="${value}"${value === selected ? " selected" : ""}>${value} ${escapeHtml(label)}</option>`)
      .join("");
  }

  function renderLoading() {
    return `
      <section class="maturity-v1-page is-loading" aria-label="成熟度评估正在加载">
        <div class="maturity-v1-loading-line"></div>
        <div class="maturity-v1-loading-grid"><span></span><span></span><span></span></div>
        <p>正在读取当前稳定能力字典并生成评估模板...</p>
      </section>
    `;
  }

  function renderError() {
    return `
      <section class="maturity-v1-page maturity-v1-empty" aria-label="成熟度评估加载失败">
        <h3>成熟度评估暂时无法打开</h3>
        <p>${escapeHtml(model.error || "成熟度评估 API 当前不可用。")}</p>
        <button class="maturity-v1-button" type="button" data-maturity-action="retry-load">重新读取</button>
      </section>
    `;
  }

  function renderProjectList() {
    const projects = projectList();
    if (model.listStatus === "review") model.listStatus = "active";
    const search = text(model.listSearch).toLowerCase();
    const filtered = projects.filter((detail) => {
      const project = detail.project;
      if (model.listStatus !== "all" && projectStatusGroup(project.status) !== model.listStatus) return false;
      if (model.listTemplateType !== "all" && project.templateType !== model.listTemplateType) return false;
      if (model.listOwner !== "all" && project.owner !== model.listOwner) return false;
      if (model.listIndustry !== "all" && project.industry !== model.listIndustry) return false;
      if (!search) return true;
      return [project.name, project.organization, project.industry, project.companySize, displayTemplateName(detail), project.owner].join(" ").toLowerCase().includes(search);
    });
    const owners = [...new Set(projects.map((detail) => text(detail.project.owner).trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, "zh-Hans-CN"));
    const industries = [...new Set(projects.map((detail) => text(detail.project.industry).trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, "zh-Hans-CN"));
    const viewCounts = { active: 0, completed: 0, all: projects.length };
    projects.forEach((detail) => { const group = projectStatusGroup(detail.project.status); if (Object.prototype.hasOwnProperty.call(viewCounts, group)) viewCounts[group] += 1; });
    const pagination = paginatedRows(filtered, model.projectListPage, model.projectListPageSize);
    model.projectListPage = pagination.page;
    return `
      <section class="maturity-v1-page maturity-v1-list-page" aria-label="成熟度评估项目列表">
        ${renderFeedback()}
        <div class="maturity-v26-home-grid">
          <section class="maturity-v26-project-hub" aria-label="项目进展">
        <header class="maturity-v24-home-heading"><div><span>当前工作</span><h2>项目进展</h2><p>查看评估阶段、评分完成度和下一步动作。</p></div><dl><div><dt>进行中</dt><dd>${viewCounts.active}</dd></div><div><dt>已完成</dt><dd>${viewCounts.completed}</dd></div></dl></header>
        <div class="maturity-v2-list-views" role="tablist" aria-label="项目状态视图">
          ${[["active", "进行中"], ["completed", "已完成"], ["all", "全部"]].map(([value, label]) => `<button class="${model.listStatus === value ? "is-active" : ""}" type="button" role="tab" aria-label="${label}，${viewCounts[value]} 项" aria-selected="${model.listStatus === value}" data-maturity-action="set-list-view" data-list-view="${value}">${label}<span aria-hidden="true">${viewCounts[value]}</span></button>`).join("")}
        </div>
        <div class="maturity-v1-filterbar">
          <label class="is-search"><span>项目 / 客户</span><input type="search" value="${escapeHtml(model.listSearch)}" placeholder="搜索项目、客户、负责人" autocomplete="off" data-maturity-list-search /></label>
          <label><span>模板</span><select data-maturity-list-filter="templateType">
            <option value="all">全部模板</option>
            <option value="base"${model.listTemplateType === "base" ? " selected" : ""}>基础能力体系模板</option>
            <option value="custom"${model.listTemplateType === "custom" ? " selected" : ""}>自定义能力模板</option>
          </select></label>
          <label><span>负责人</span><select data-maturity-list-filter="owner"><option value="all">全部负责人</option>${owners.map((value) => `<option value="${escapeHtml(value)}"${model.listOwner === value ? " selected" : ""}>${escapeHtml(value)}</option>`).join("")}</select></label>
          <label><span>行业</span><select data-maturity-list-filter="industry"><option value="all">全部行业</option>${industries.map((value) => `<option value="${escapeHtml(value)}"${model.listIndustry === value ? " selected" : ""}>${escapeHtml(value)}</option>`).join("")}</select></label>
          <button class="maturity-v1-link-button maturity-v2-clear-filters" type="button" data-maturity-action="clear-list-filters">清空筛选</button>
        </div>
        <div class="maturity-v1-project-layout">
          <section class="maturity-v1-table-wrap" aria-label="评估项目表">
            <table class="maturity-v1-table maturity-v1-project-table maturity-v28-project-table">
              <thead><tr><th>客户</th><th>状态</th><th>采用模板</th><th>完成度</th><th>操作</th></tr></thead>
              <tbody>
                ${filtered.length ? pagination.rows.map((detail) => {
                  const project = detail.project;
                  const summary = summaryOf(detail);
                  const completedItems = Math.max(0, Number(summary.applicableItemCount || 0) - Number(summary.notScoredCount || 0));
                  const totalItems = Number(summary.applicableItemCount || activeTemplateData(detail.template).scoreItems.length || 0);
                  const expanded = model.expandedProjectId === project.id;
                  return `<tr class="maturity-v2-project-row maturity-v28-project-row ${expanded ? "is-expanded" : ""}" data-maturity-action="toggle-project-preview" data-project-id="${escapeHtml(project.id)}" tabindex="0" aria-label="${escapeHtml(project.organization || project.name)}，展开项目摘要" aria-expanded="${expanded}">
                    <td><strong class="notranslate" translate="no" data-maturity-literal="organization">${escapeHtml(project.organization || "客户未填写")}</strong></td>
                    <td><span class="maturity-v1-status ${statusTone(project.status)}">${escapeHtml(PROJECT_STATUS_NAMES[project.status] || project.status)}</span></td>
                    <td><strong>${escapeHtml(displayTemplateName(detail))}</strong><span class="maturity-v2-template-kind">${project.templateType === "custom" ? "自定义" : project.templateType === "base" ? "固定" : "待选择"}</span></td>
                    <td><div class="maturity-v28-completion"><span class="maturity-v1-progress"><i style="width:${percent(summary.completionRate)}%"></i></span><strong>${percent(summary.completionRate).toFixed(0)}%</strong><small>${completedItems} / ${totalItems || "-"}</small></div></td>
                    <td><button class="maturity-v1-button is-primary maturity-v2-row-primary" type="button" data-maturity-action="open-project-tab" data-project-id="${escapeHtml(project.id)}" data-project-tab="overview">进入项目</button></td>
                  </tr>${expanded ? `<tr class="maturity-v2-project-preview maturity-v28-project-preview"><td colspan="5"><div><dl><div><dt>项目负责人</dt><dd class="maturity-v28-literal-value notranslate" translate="no" data-maturity-literal="project-owner" data-value="${escapeHtml(project.owner || "未填写")}" aria-label="${escapeHtml(project.owner || "未填写")}"></dd></div><div><dt>评估人员</dt><dd class="maturity-v28-literal-value notranslate" translate="no" data-maturity-literal="assessors" data-value="${escapeHtml(list(project.assessors).join("、") || "未填写")}" aria-label="${escapeHtml(list(project.assessors).join("、") || "未填写")}"></dd></div><div><dt>阻塞项</dt><dd>${Number(summary.reviewPendingCount || 0)}</dd></div><div><dt>不适用项</dt><dd>${Number(summary.notApplicableCount || 0)}</dd></div><div><dt>最近更新</dt><dd>${escapeHtml(project.updatedAt || "-")}</dd></div></dl></div></td></tr>` : ""}`;
                }).join("") : `<tr><td colspan="5"><div class="maturity-v1-table-empty"><strong>${projects.length ? "当前筛选下没有评估项目" : "从企业组织项目开始"}</strong><span>${projects.length ? "调整筛选条件，或清空筛选后继续。" : "创建项目后选择固定或自定义模板，进入四维评分。"}</span><button class="maturity-v1-button is-primary" type="button" data-maturity-action="${projects.length ? "clear-list-filters" : "new-project"}">${projects.length ? "清空筛选" : "新建评估项目"}</button></div></td></tr>`}
              </tbody>
            </table>
          </section>
        </div>
        ${renderWorkspacePagination("projects", pagination)}
          </section>
          ${renderTemplateManager()}
        </div>
        ${renderCreateWizard()}
      </section>
    `;
  }

  function renderCompactCategoryBars(rows) {
    if (!list(rows).length) return `<div class="maturity-v1-empty-inline">完成评分后显示分类结果。</div>`;
    return `<div class="maturity-v1-mini-bars">${list(rows).map((row) => `<div><span title="${escapeHtml(row.name)}">${escapeHtml(row.code || row.name)}</span><i><b style="width:${percent(Number(row.currentIndex || 0) * 20)}%"></b></i><strong>${row.currentIndex ?? "-"}</strong></div>`).join("")}</div>`;
  }

  function renderCreateWizard() {
    if (!model.createOpen) return "";
    const draft = model.createDraft;
    const stepLabels = ["客户与项目", "选择模板", "确认创建"];
    const error = (field) => model.createErrors?.[field] ? `<small id="maturityCreateError-${field}" class="maturity-v2-field-error">${escapeHtml(model.createErrors[field])}</small>` : "";
    const fieldAttrs = (field) => `data-create-field="${field}"${model.createErrors?.[field] ? ` aria-invalid="true" aria-describedby="maturityCreateError-${field}"` : ""}`;
    const baseStats = templateStats(model.workspace?.template || {});
    const reusableTemplates = templateLibraryRecords().filter((item) => item.template.type === "custom");
    const selectedLibraryTemplate = templateLibraryRecords().find((item) => item.template.id === draft.templateLibraryId)?.template;
    return `
      <div class="maturity-v1-modal-backdrop maturity-v2-create-layer" data-maturity-create-layer data-shell-workflow-overlay="maturity-project-create">
        <button class="maturity-v2-create-scrim" type="button" data-maturity-action="close-create" aria-label="关闭新建评估项目浮层"></button>
        <aside class="maturity-v1-modal maturity-v2-create-workspace" data-shell-overlay-surface="maturity-project-create" role="dialog" aria-modal="true" aria-labelledby="maturityCreateTitle">
          <header><div><span>第 ${model.createStep} / 3 步</span><h3 id="maturityCreateTitle">${model.createDraftProjectId ? "继续设置评估项目" : "新建评估项目"}</h3></div><button class="maturity-v1-icon-button" type="button" data-maturity-action="close-create" aria-label="关闭浮层">×</button></header>
          <ol class="maturity-v1-stepper">${stepLabels.map((label, index) => `<li class="${index + 1 === model.createStep ? "is-active" : index + 1 < model.createStep ? "is-done" : ""}"${index + 1 === model.createStep ? ' aria-current="step"' : ""}><span>${index + 1}</span><strong>${escapeHtml(label)}</strong></li>`).join("")}</ol>
          <div class="maturity-v1-modal-body" data-maturity-create-scroll>
            ${model.createStep === 1 ? `
              <div class="maturity-v1-form-grid">
                <label><span>项目名称 *</span><input id="maturityCreateName" class="maturity-v2-literal notranslate" translate="no" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" data-maturity-literal-input="project-name" ${fieldAttrs("name")} value="${escapeHtml(draft.name)}" placeholder="例如：某集团网络安全成熟度评估" />${error("name")}</label>
                <label><span>客户企业组织 *</span><input id="maturityCreateOrganization" class="maturity-v2-literal notranslate" translate="no" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" data-maturity-literal-input="organization" ${fieldAttrs("organization")} value="${escapeHtml(draft.organization)}" />${error("organization")}</label>
                <label><span>客户所属行业 *</span><input id="maturityCreateIndustry" ${fieldAttrs("industry")} value="${escapeHtml(draft.industry)}" placeholder="例如：制造业、金融、能源" />${error("industry")}</label>
                <label><span>企业规模 *</span><select id="maturityCreateCompanySize" ${fieldAttrs("companySize")}><option value="">请选择</option>${["大型企业", "中型企业", "小型企业"].map((value) => `<option value="${value}"${draft.companySize === value ? " selected" : ""}>${value}</option>`).join("")}</select>${error("companySize")}</label>
                <label class="is-wide"><span>客户特点</span><textarea id="maturityCreateCharacteristics" ${fieldAttrs("customerCharacteristics")} rows="3" placeholder="业务、信息化、安全环境或监管特点">${escapeHtml(draft.customerCharacteristics)}</textarea></label>
                <label class="is-wide"><span>客户偏好与约束</span><textarea id="maturityCreateConstraints" ${fieldAttrs("constraints")} rows="3" placeholder="预算、周期、风险偏好等，仅影响目标和路线图">${escapeHtml(draft.constraints)}</textarea></label>
                <label><span>项目负责人 *</span><input id="maturityCreateOwner" class="maturity-v2-literal notranslate" translate="no" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" data-maturity-literal-input="project-owner" ${fieldAttrs("owner")} value="${escapeHtml(draft.owner)}" />${error("owner")}</label>
                <div class="maturity-v2-date-pair"><label><span>计划开始时间</span><input id="maturityCreateStartDate" ${fieldAttrs("plannedStartDate")} type="date" value="${escapeHtml(draft.plannedStartDate)}" /></label><label><span>计划结束时间</span><input id="maturityCreateEndDate" ${fieldAttrs("plannedEndDate")} type="date" value="${escapeHtml(draft.plannedEndDate)}" /></label></div>
                <label><span>评估人员</span><input id="maturityCreateAssessors" class="maturity-v2-literal notranslate" translate="no" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" data-maturity-literal-input="assessors" ${fieldAttrs("assessors")} value="${escapeHtml(draft.assessors)}" placeholder="多人用顿号分隔" /></label>
                <label class="is-wide"><span>备注</span><textarea id="maturityCreateNote" ${fieldAttrs("note")} rows="2">${escapeHtml(draft.note)}</textarea></label>
              </div>
            ` : ""}
            ${model.createStep === 2 ? `
              <div class="maturity-v1-template-choice" role="radiogroup" aria-label="评估模板类型">
                <button class="${draft.templateType === "base" ? "is-selected" : ""}" type="button" data-maturity-action="choose-template" data-template-type="base" role="radio" aria-checked="${draft.templateType === "base"}">
                  <div><strong>固定知识库模板</strong><span class="maturity-v2-readonly-badge">只读结构</span></div><span>按知识快照中的真实关注点、作用域与服务关系生成评估点。</span><small>V2.1 · ${baseStats.topCategories} 个能力 L0 / ${baseStats.domains} 个能力 L1 / ${baseStats.capabilities} 个能力 L2 / ${baseStats.focuses} 个关注点 / ${baseStats.scoreItems} 个评估点</small>
                </button>
                <button class="${draft.templateType === "custom" && !draft.templateLibraryId ? "is-selected" : ""}" type="button" data-maturity-action="choose-template" data-template-type="custom" role="radio" aria-checked="${draft.templateType === "custom" && !draft.templateLibraryId}">
                  <div><strong>从固定模板复制为新自定义模板</strong><span class="maturity-v2-template-kind">需配置</span></div><span>创建后进入模板配置，可重组能力 L0 / L1 / L2、关注点、作用域和服务角色。</span><small>所有变化只保存在项目模板，不修改主工程字典。</small>
                </button>
                ${reusableTemplates.map((item) => { const stats = templateStats(item.template); const selected = draft.templateLibraryId === item.template.id; return `<button class="${selected ? "is-selected" : ""}" type="button" data-maturity-action="choose-template" data-template-type="custom" data-template-id="${escapeHtml(item.template.id)}" role="radio" aria-checked="${selected}"><div><strong>${escapeHtml(item.template.name)}</strong><span class="maturity-v2-template-kind">自定义副本</span></div><span>从模板中心复制到新项目后继续调整，原模板保持不变。</span><small>${stats.capabilities} 个 L2 / ${stats.focuses} 个关注点 / ${stats.scoreItems} 个评估点</small></button>`; }).join("")}
              </div>
              ${error("templateType")}
            ` : ""}
            ${model.createStep === 3 ? `
              <div class="maturity-v1-confirm-grid">
                <section><div class="maturity-v2-confirm-heading"><strong>客户与项目</strong><button type="button" data-maturity-action="create-edit-step" data-step="1">修改</button></div><dl><div><dt>项目</dt><dd class="notranslate" translate="no" data-maturity-literal="project-name">${escapeHtml(draft.name)}</dd></div><div><dt>客户企业组织</dt><dd class="notranslate" translate="no" data-maturity-literal="organization">${escapeHtml(draft.organization)}</dd></div><div><dt>所属行业 / 规模</dt><dd>${escapeHtml(draft.industry)} / ${escapeHtml(draft.companySize)}</dd></div><div><dt>项目负责人</dt><dd class="notranslate" translate="no" data-maturity-literal="project-owner">${escapeHtml(draft.owner)}</dd></div><div><dt>评估对象</dt><dd>企业组织</dd></div></dl></section>
                <section><div class="maturity-v2-confirm-heading"><strong>评估模板</strong><button type="button" data-maturity-action="create-edit-step" data-step="2">修改</button></div><div class="maturity-v1-confirm-template"><span>模板</span><strong>${draft.templateType === "custom" ? escapeHtml(selectedLibraryTemplate?.name || "新自定义能力模板") : "当前知识库基础能力体系模板"}</strong><p>${draft.templateType === "custom" ? "创建时生成项目专属副本；进入模板配置继续调整，不覆盖模板中心原件。" : "固定模板结构只读；作用域和服务均来自字典真实映射。"}</p></div></section>
              </div>
            ` : ""}
          </div>
          <footer>
            <button class="maturity-v1-button is-secondary" type="button" data-maturity-action="${model.createStep === 1 ? "close-create" : "create-back"}">${model.createStep === 1 ? "取消" : "返回"}</button>
            <button class="maturity-v1-button is-primary" type="button" data-maturity-action="${model.createStep === 3 ? "create-project" : "create-next"}" ${model.createStep === 2 && !draft.templateType ? "disabled" : ""}>${model.createStep === 1 ? "下一步：选择模板" : model.createStep === 2 ? "下一步：确认信息" : "创建并进入项目"}</button>
          </footer>
        </aside>
      </div>
    `;
  }

  function renderProject(detail) {
    const project = detail.project;
    const summary = summaryOf(detail);
    const tabs = [
      ["overview", "项目概览"],
      ["template", "评估模板"],
      ["scoring", "评分执行"],
      ["review", "评分检查"],
      ["results", "评估结果"],
      ["report", "评估报告"],
      ["report-v2", "评估报告 V2"],
    ];
    const formalReady = formalAssessmentReady(detail);
    return `
      <section class="maturity-v1-page maturity-v1-project-page" aria-label="成熟度评估项目">
        <div class="maturity-v6-project-sticky-header" aria-label="当前项目与项目步骤">
          <div class="maturity-v21-project-tab-row">
            <nav class="maturity-v1-tabs" aria-label="成熟度评估项目步骤">
              ${tabs.map(([id, label]) => { const blocked = FORMAL_RESULT_TAB_IDS.has(id) && !formalReady; return `<button class="${model.activeTab === id ? "is-active" : ""}" type="button" data-maturity-tab="${id}" ${blocked ? 'disabled aria-disabled="true" title="完成全部适用评估点并正式完成评估后开放"' : ""}><span>${escapeHtml(label)}</span>${id === "scoring" && summary.notScoredCount ? `<b>${summary.notScoredCount}</b>` : ""}</button>`; }).join("")}
            </nav>
            ${["report", "report-v2"].includes(model.activeTab) ? "" : renderProjectObjectSearch(detail)}
          </div>
        </div>
        ${renderFeedback()}
        <div class="maturity-v1-project-body">
          ${renderProjectTab(detail)}
        </div>
      </section>
    `;
  }

  function renderProjectTab(detail) {
    if (model.activeTab === "template") return renderTemplateTab(detail);
    if (model.activeTab === "scoring") return renderScoringTab(detail);
    if (model.activeTab === "review") return renderReviewTab(detail);
    if (model.activeTab === "results") return renderResultsTab(detail);
    if (model.activeTab === "report") return renderReportTab(detail);
    if (model.activeTab === "report-v2") return renderReportV2Tab(detail);
    return renderOverviewTab(detail);
  }

  function renderFormalAssessmentBlocked(title) {
    return `<section class="maturity-v21-results-blocked sapd-stat-vibrancy" aria-label="正式评估内容尚不可用"><span>正式内容尚未开放</span><h2>${escapeHtml(title)}</h2><p>请先完成全部适用评估点，并在评分检查中正式完成评估。未完成项目不会输出成熟度结果或评估报告。</p><div><button class="maturity-v1-button is-primary" type="button" data-maturity-action="open-review-tab">前往评分检查</button></div></section>`;
  }

  function renderUnlockConfirmation(detail) {
    if (model.unlockConfirmProjectId !== detail?.project?.id) return "";
    return `<div class="maturity-v1-modal-backdrop maturity-v32-unlock-layer" data-maturity-unlock-layer>
      <aside class="maturity-v1-modal maturity-v32-unlock-modal" role="dialog" aria-modal="true" aria-labelledby="maturityUnlockTitle">
        <header><div><span>修改评估分数</span><h3 id="maturityUnlockTitle">确认解锁当前项目？</h3></div></header>
        <div class="maturity-v32-unlock-body"><p>解锁后，现有评分会完整保留并恢复编辑；项目回到“评分检查中”阶段，当前正式评估报告将失效。</p><ul><li>评分执行页恢复可编辑</li><li>评分检查页“完成评估”恢复可用</li><li>再次完成评估后重新锁定结果</li></ul></div>
        <footer><button class="maturity-v1-button is-secondary" type="button" data-maturity-action="cancel-score-unlock">取消</button><button class="maturity-v1-button is-primary" type="button" data-maturity-action="confirm-score-unlock">确认解锁</button></footer>
      </aside>
    </div>`;
  }

  function renderReportDownloadConfirmation(detail) {
    if (model.reportDownloadProjectId !== detail?.project?.id) return "";
    const exportReady = reportExportReady(detail.report);
    return `<div class="maturity-v1-modal-backdrop maturity-v33-report-download-layer" data-maturity-report-download-layer>
      <aside class="maturity-v1-modal maturity-v33-report-download-modal" role="dialog" aria-modal="true" aria-labelledby="maturityReportDownloadTitle">
        <header><div><span>下载评估报告</span><h3 id="maturityReportDownloadTitle">确认报告格式</h3></div></header>
        <div class="maturity-v33-report-download-body">
          <p>${exportReady ? "请选择本次下载格式。文件内容来自当前已生成的完整评估报告。" : "当前尚无可导出的完整报告。确认后会先生成最新评估报告，再下载所选格式。"}</p>
          <div role="radiogroup" aria-label="评估报告下载格式">
            <label class="${model.reportDownloadFormat === "html" ? "is-selected" : ""}"><input type="radio" name="maturity-report-download-format" value="html" data-maturity-report-download-format ${model.reportDownloadFormat === "html" ? "checked" : ""} /><span><strong>HTML</strong><small>适合管理层汇报、浏览器阅读与打印</small></span></label>
            <label class="${model.reportDownloadFormat === "markdown" ? "is-selected" : ""}"><input type="radio" name="maturity-report-download-format" value="markdown" data-maturity-report-download-format ${model.reportDownloadFormat === "markdown" ? "checked" : ""} /><span><strong>Markdown</strong><small>适合内容归档、知识库维护与二次编辑</small></span></label>
          </div>
        </div>
        <footer><button class="maturity-v1-button is-secondary" type="button" data-maturity-action="cancel-overview-report-download">取消</button><button class="maturity-v1-button is-primary" type="button" data-maturity-action="confirm-overview-report-download">确认并下载</button></footer>
      </aside>
    </div>`;
  }

  function renderProjectInfoEditor(detail) {
    if (model.projectInfoEditId !== detail?.project?.id) return "";
    const draft = model.projectInfoDraft || {};
    const error = (field) => model.projectInfoErrors?.[field] ? `<small id="maturityProjectInfoError-${field}" class="maturity-v2-field-error">${escapeHtml(model.projectInfoErrors[field])}</small>` : "";
    const fieldAttrs = (field) => `data-project-info-field="${field}"${model.projectInfoErrors?.[field] ? ` aria-invalid="true" aria-describedby="maturityProjectInfoError-${field}"` : ""}`;
    return `<div class="maturity-v1-modal-backdrop maturity-v2-create-layer maturity-v37-project-edit-layer" data-maturity-project-info-layer data-shell-workflow-overlay="maturity-project-info-edit">
      <button class="maturity-v2-create-scrim" type="button" data-maturity-action="cancel-project-info-edit" aria-label="关闭项目信息编辑浮层"></button>
      <aside class="maturity-v1-modal maturity-v2-create-workspace maturity-v37-project-edit-workspace" data-shell-overlay-surface="maturity-project-info-edit" role="dialog" aria-modal="true" aria-labelledby="maturityProjectInfoEditTitle">
        <header><div><span>项目基本信息</span><h3 id="maturityProjectInfoEditTitle">编辑项目信息</h3></div><button class="maturity-v1-icon-button" type="button" data-maturity-action="cancel-project-info-edit" aria-label="关闭浮层">×</button></header>
        <div class="maturity-v1-modal-body">
          <div class="maturity-v1-form-grid">
            <label><span>项目名称 *</span><input id="maturityProjectInfoName" class="maturity-v2-literal notranslate" translate="no" autocomplete="off" ${fieldAttrs("name")} value="${escapeHtml(draft.name)}" />${error("name")}</label>
            <label><span>客户企业组织 *</span><input id="maturityProjectInfoOrganization" class="maturity-v2-literal notranslate" translate="no" autocomplete="off" ${fieldAttrs("organization")} value="${escapeHtml(draft.organization)}" />${error("organization")}</label>
            <label><span>客户所属行业 *</span><input id="maturityProjectInfoIndustry" ${fieldAttrs("industry")} value="${escapeHtml(draft.industry)}" />${error("industry")}</label>
            <label><span>企业规模 *</span><select id="maturityProjectInfoCompanySize" ${fieldAttrs("companySize")}><option value="">请选择</option>${["大型企业", "中型企业", "小型企业"].map((value) => `<option value="${value}"${draft.companySize === value ? " selected" : ""}>${value}</option>`).join("")}</select>${error("companySize")}</label>
            <label class="is-wide"><span>客户特点</span><textarea id="maturityProjectInfoCharacteristics" rows="3" ${fieldAttrs("customerCharacteristics")}>${escapeHtml(draft.customerCharacteristics)}</textarea></label>
            <label class="is-wide"><span>客户偏好与约束</span><textarea id="maturityProjectInfoConstraints" rows="3" ${fieldAttrs("constraints")}>${escapeHtml(draft.constraints)}</textarea></label>
            <label><span>项目负责人 *</span><input id="maturityProjectInfoOwner" class="maturity-v2-literal notranslate" translate="no" autocomplete="off" ${fieldAttrs("owner")} value="${escapeHtml(draft.owner)}" />${error("owner")}</label>
            <div class="maturity-v2-date-pair"><label><span>计划开始时间</span><input id="maturityProjectInfoStartDate" type="date" ${fieldAttrs("plannedStartDate")} value="${escapeHtml(draft.plannedStartDate)}" /></label><label><span>计划结束时间</span><input id="maturityProjectInfoEndDate" type="date" ${fieldAttrs("plannedEndDate")} value="${escapeHtml(draft.plannedEndDate)}" />${error("plannedEndDate")}</label></div>
            <label><span>评估人员</span><input id="maturityProjectInfoAssessors" class="maturity-v2-literal notranslate" translate="no" autocomplete="off" ${fieldAttrs("assessors")} value="${escapeHtml(draft.assessors)}" placeholder="多人用顿号分隔" /></label>
            <label class="is-wide"><span>备注</span><textarea id="maturityProjectInfoNote" rows="2" ${fieldAttrs("note")}>${escapeHtml(draft.note)}</textarea></label>
          </div>
        </div>
        <footer><button class="maturity-v1-button is-secondary" type="button" data-maturity-action="cancel-project-info-edit">取消</button><button class="maturity-v1-button is-primary" type="button" data-maturity-action="save-project-info">保存修改</button></footer>
      </aside>
    </div>`;
  }

  function renderOverviewTab(detail) {
    const project = detail.project;
    const progress = assessmentProgress(detail);
    const workflow = [
      ["draft", "项目创建"],
      ["template_configuring", "模板配置"],
      ["scoring", "评分执行"],
      ["score_review", "评分检查"],
      ["completed", "评估完成"],
      ["reported", "评估报告"],
    ];
    const currentIndex = workflow.findIndex(([id]) => id === project.status);
    const currentStep = currentIndex < 0 ? 0 : currentIndex;
    const progressWidth = Math.max(0, Math.min(100, progress.completionRate));
    const remainingCapabilityCount = Math.max(0, progress.capabilityCount - progress.completedCapabilityCount);
    const remainingFocusCount = Math.max(0, progress.focusCount - progress.completedFocusCount);
    const notApplicableCapabilityCount = Math.max(0, progress.capabilityTotalCount - progress.capabilityCount);
    const notApplicableFocusCount = Math.max(0, progress.focusTotalCount - progress.focusCount);
    const capabilityCompletionRate = completionPercent(progress.completedCapabilityCount, progress.capabilityCount);
    const focusCompletionRate = completionPercent(progress.completedFocusCount, progress.focusCount);
    const itemCompletionRate = completionPercent(progress.completedItemCount, progress.applicableItemCount);
    const projectHistory = projectChangeHistory(detail);
    const projectHistoryPageSize = 3;
    const projectHistoryPageCount = Math.max(1, Math.ceil(projectHistory.length / projectHistoryPageSize));
    const projectHistoryPage = Math.max(0, Math.min(projectHistoryPageCount - 1, Number(model.projectHistoryPage || 0)));
    const visibleProjectHistory = projectHistory.slice(projectHistoryPage * projectHistoryPageSize, (projectHistoryPage + 1) * projectHistoryPageSize);
    const assessmentLocked = detail.project.readOnly && LOCKED_ASSESSMENT_STATUSES.has(detail.project.status);
    const reportDownloadAvailable = progress.completionRate >= 100
      && (assessmentLocked || reportPreviouslyGenerated(detail));
    const priorityRows = progress.priorityCapabilities.map((row) => `<button type="button" data-maturity-action="continue-overview-capability" data-capability-id="${escapeHtml(row.id)}"><span><b>${escapeHtml(row.code || "自定义")}</b>${escapeHtml(row.name)}</span><strong>${Number(row.completionRate || 0).toFixed(0)}%</strong></button>`).join("");
    return `
      <div class="maturity-v1-overview-grid">
        <section class="maturity-v1-section maturity-v10-project-overview">
          <div class="maturity-v1-panel-heading"><div><span>项目基本信息</span><h3 class="notranslate" translate="no" data-maturity-literal="project-name">${escapeHtml(project.name || "未命名项目")}</h3></div><div class="maturity-v37-project-heading-actions"><button class="maturity-v1-button is-secondary" type="button" data-maturity-action="edit-project-info">编辑项目信息</button><span class="maturity-v1-status ${statusTone(project.status)}">${escapeHtml(PROJECT_STATUS_NAMES[project.status] || project.status)}</span></div></div>
          <dl class="maturity-v1-project-facts maturity-v10-project-facts">
            <div><dt>行业 / 规模</dt><dd>${escapeHtml(project.industry || "未填写")} / ${escapeHtml(project.companySize || "未填写")}</dd></div>
            <div><dt>项目负责人</dt><dd class="maturity-v28-literal-value notranslate" translate="no" data-maturity-literal="project-owner" data-value="${escapeHtml(project.owner || "未填写")}" aria-label="${escapeHtml(project.owner || "未填写")}"></dd></div>
            <div><dt>评估人员</dt><dd class="maturity-v28-literal-value notranslate" translate="no" data-maturity-literal="assessors" data-value="${escapeHtml(list(project.assessors).join("、") || "未填写")}" aria-label="${escapeHtml(list(project.assessors).join("、") || "未填写")}"></dd></div>
            <div><dt>计划时间</dt><dd>${escapeHtml(project.plannedStartDate || "未设置")} — ${escapeHtml(project.plannedEndDate || "未设置")}</dd></div>
            <div><dt>评估模板</dt><dd>${escapeHtml(displayTemplateName(detail))}</dd></div>
            <div><dt>最近更新</dt><dd>${escapeHtml(project.updatedAt || "-")}</dd></div>
            <div><dt>评估对象</dt><dd>企业组织</dd></div>
          </dl>
          <section class="maturity-v32-project-history" aria-label="项目历史修改记录"><header><strong>历史修改记录</strong><span>共 ${projectHistory.length} 条</span></header><ol>${visibleProjectHistory.map((item) => `<li><div><strong>${escapeHtml(item.label || item.action || "项目变更")}</strong><span>${escapeHtml(item.description || "项目状态已更新")}</span></div><time>${escapeHtml(item.changedAt || "-")}</time></li>`).join("")}</ol><footer><span>第 ${projectHistoryPage + 1} / ${projectHistoryPageCount} 页 · 每页 3 条</span><div><button type="button" data-maturity-action="step-project-history" data-history-step="-1" aria-label="历史记录上一页" ${projectHistoryPage <= 0 ? "disabled" : ""}>‹</button><button type="button" data-maturity-action="step-project-history" data-history-step="1" aria-label="历史记录下一页" ${projectHistoryPage >= projectHistoryPageCount - 1 ? "disabled" : ""}>›</button></div></footer></section>
          <div class="maturity-v10-project-stage"><header><strong>当前进度阶段</strong><span>${escapeHtml(PROJECT_STATUS_NAMES[project.status] || project.status)}</span></header><ol class="maturity-v1-workflow">${workflow.map(([id, label], index) => `<li class="${index < currentStep ? "is-done" : index === currentStep ? "is-active" : ""}"><i>${index + 1}</i><span>${escapeHtml(label)}</span>${index === 5 && reportDownloadAvailable ? `<button class="maturity-v33-report-download-entry" type="button" data-maturity-action="request-overview-report-download">下载评估报告</button>` : ""}</li>`).join("")}</ol></div>
        </section>
        <aside class="maturity-v1-section maturity-v10-overview-progress sapd-stat-vibrancy">
          <div class="maturity-v1-panel-heading"><div><span>评估进度</span><h3>总体完成 ${progress.completionRate.toFixed(0)}%</h3></div><strong>${progress.completedItemCount} / ${progress.applicableItemCount} 个适用评估点</strong></div>
          <div class="maturity-v9-overall-progress" role="progressbar" aria-label="评估总体完成率" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${progress.completionRate.toFixed(0)}"><i style="width:${progressWidth}%"></i></div>
          <div class="maturity-v10-progress-metrics" aria-label="评估进度分层统计">
            <article><header><span>能力</span><small>L2</small></header><strong>${capabilityCompletionRate.toFixed(0)}%</strong><p>总计 ${progress.capabilityTotalCount} · 适用 ${progress.capabilityCount}</p><small>已完成 ${progress.completedCapabilityCount} / ${progress.capabilityCount} · 待完成 ${remainingCapabilityCount} · 不适用 ${notApplicableCapabilityCount}</small></article>
            <article><header><span>关注点</span></header><strong>${focusCompletionRate.toFixed(0)}%</strong><p>总计 ${progress.focusTotalCount} · 适用 ${progress.focusCount}</p><small>已完成 ${progress.completedFocusCount} / ${progress.focusCount} · 待完成 ${remainingFocusCount} · 不适用 ${notApplicableFocusCount}</small></article>
            <article><header><span>评估点</span></header><strong>${itemCompletionRate.toFixed(0)}%</strong><p>总计 ${progress.itemTotalCount} · 适用 ${progress.applicableItemCount}</p><small>已完成 ${progress.completedItemCount} / ${progress.applicableItemCount} · 待完成 ${progress.remainingItemCount} · 不适用 ${progress.notApplicableCount}</small></article>
          </div>
          <div class="maturity-v10-progress-rule"><strong>完成率口径</strong><p>总体完成率 = 已完成适用评估点 ÷ 适用评估点；能力、关注点、评估点分别按各自适用对象统计，不适用对象不进入分母。</p></div>
          ${!assessmentLocked && priorityRows ? `<div class="maturity-v9-progress-priorities"><header><strong>继续评分位置</strong><span>优先返回已经开始但尚未完成的能力</span></header><div>${priorityRows}</div></div>` : ""}
          ${assessmentLocked ? `<button class="maturity-v1-button is-primary is-full maturity-v9-overview-continue" type="button" data-maturity-action="request-score-unlock">修改评估分数</button>` : `<button class="maturity-v1-button is-primary is-full maturity-v9-overview-continue" type="button" data-maturity-tab="scoring">${progress.completionRate >= 100 ? "查看并调整评分" : "继续评分"}</button>`}
          <div class="maturity-v29-score-file-actions" aria-label="评分文件交换">
            <button class="maturity-v1-button is-secondary" type="button" data-maturity-action="export-score-exchange">下载评分表</button>
            <button class="maturity-v1-button is-secondary" type="button" data-maturity-action="trigger-score-import" ${assessmentLocked ? "disabled" : ""}>上传评分文件</button>
            <input type="file" accept="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,.xlsx" hidden data-maturity-score-file />
            ${assessmentLocked ? `<small>解锁评分后可上传 XLSX</small>` : detail.scoreImportNotice?.message ? `<small class="is-${escapeHtml(detail.scoreImportNotice.tone || "success")}" role="status">${escapeHtml(detail.scoreImportNotice.message)}</small>` : `<small>读取适用性、四维评分和目标等级</small>`}
          </div>
        </aside>
      </div>
      ${renderUnlockConfirmation(detail)}
      ${renderReportDownloadConfirmation(detail)}
      ${renderProjectInfoEditor(detail)}
    `;
  }

  function renderTemplateTab(detail) {
    const template = detail.template;
    const stats = templateStats(template);
    const isCustom = template?.type === "custom";
    return `
      <section class="maturity-v1-section maturity-v1-template-summary">
        <div class="maturity-v1-panel-heading">
          <div><span>${isCustom ? "自定义能力模板" : "基础能力体系模板"}</span><h3>${escapeHtml(template?.name || "未选择模板")}</h3></div>
          <div class="maturity-v1-toolbar">
            ${!isCustom ? `<button class="maturity-v1-button is-secondary" type="button" data-maturity-action="clone-custom-template">复制为自定义模板</button>` : ""}
            ${isCustom ? `<button class="maturity-v1-button is-secondary" type="button" data-maturity-action="export-template">导出自定义模板</button><button class="maturity-v1-button is-secondary" type="button" data-maturity-action="trigger-template-import">导入自定义模板</button><input type="file" accept="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,.xlsx" hidden data-maturity-template-file /><button class="maturity-v1-button is-primary" type="button" data-maturity-action="validate-template">校验并发布</button>` : `<span class="maturity-v2-readonly-badge">标准模板结构只读</span>`}
          </div>
        </div>
        <div class="maturity-v1-template-stats"><div><span>能力 L0</span><strong>${stats.topCategories || 0}</strong></div><div><span>能力 L1</span><strong>${stats.domains || 0}</strong></div><div><span>能力 L2</span><strong>${stats.capabilities || 0}</strong></div><div><span>关注点</span><strong>${stats.focuses || 0}</strong></div><div><span>安全技术服务</span><strong>${stats.services || 0}</strong></div><div><span>评估点</span><strong>${stats.scoreItems || 0}</strong></div></div>
        ${renderValidation(detail.validation, stats, template?.status)}
        ${renderExchangeBatches(detail)}
      </section>
      ${isCustom ? renderCustomTemplateEditor(detail) : renderBaseTemplateDirectory(template)}
    `;
  }

  function renderExchangeBatches(detail) {
    const batches = list(detail.exchangeBatches).slice(-5).reverse();
    if (!batches.length) return "";
    return `<details class="maturity-v2-exchange-log"><summary><span>文件交换记录</span><strong>${batches.length} 个最近批次</strong></summary><div>${batches.map((batch) => `<article><span class="maturity-v1-row-status ${batch.status === "success" ? "is-good" : batch.status === "partial_success" ? "is-warn" : "is-muted"}">${escapeHtml(batch.status || "unknown")}</span><strong>${escapeHtml(batch.exchangeType || "FILE_EXCHANGE")} · ${escapeHtml(batch.direction || "")}</strong><small>${escapeHtml(batch.id || "")} · 成功 ${Number(batch.successCount ?? batch.rowCount ?? 0)} / 失败 ${Number(batch.failureCount || 0)}</small>${list(batch.rowErrors).length ? `<ul>${list(batch.rowErrors).slice(0, 3).map((row) => `<li>第 ${row.row || "-"} 行：${escapeHtml(row.message || row.code)}</li>`).join("")}</ul>` : ""}</article>`).join("")}</div></details>`;
  }

  function renderValidation(validation, stats = {}, templateStatus = "draft") {
    if (!validation && templateStatus === "validated") return `<div class="maturity-v1-validation is-valid"><strong>模板校验通过</strong><span>${Number(stats.topCategories || 0) + Number(stats.domains || 0)} 个分类、${stats.capabilities || 0} 个能力、${stats.scoreItems || 0} 个评估点。</span></div>`;
    if (!validation) return `<div class="maturity-v1-validation is-neutral"><strong>模板待校验</strong><span>进入评分前会由后端检查分类、能力、关注点、作用域、服务评估点互斥和四维权重。</span></div>`;
    if (validation.valid) return `<div class="maturity-v1-validation is-valid"><strong>模板校验通过</strong><span>${validation.stats?.categories || 0} 个分类、${validation.stats?.capabilities || 0} 个能力、${validation.stats?.scoreItems || 0} 个评估点。</span></div>`;
    return `<div class="maturity-v1-validation is-invalid"><strong>模板有 ${list(validation.errors).length} 个问题</strong><span>${list(validation.errors).slice(0, 3).map((item) => escapeHtml(item.message)).join("；")}</span></div>`;
  }

  function renderBaseTemplateDirectory(template) {
    const capabilities = list(template?.capabilities);
    const categories = list(template?.categories);
    return `<section class="maturity-v1-section"><div class="maturity-v1-panel-heading"><div><span>只读知识快照</span><h3>能力 L0 / L1 / L2 评估目录</h3></div><span>项目内不能修改结构、映射和权重</span></div><div class="maturity-v1-directory-grid">${categories.filter((category) => categoryCapabilityLevel(category) === "L0").map((top) => `<section><h4>${escapeHtml(top.name)}</h4>${categories.filter((category) => categoryCapabilityLevel(category) === "L1" && category.parentId === top.id).map((domain) => `<div><strong>${escapeHtml(domain.code)} ${escapeHtml(domain.name)}</strong><span>${capabilities.filter((capability) => capability.categoryId === domain.id && capability.included !== false).length} 个 L2 能力</span></div>`).join("")}</section>`).join("")}</div></section>`;
  }

  function categoryCapabilityLevel(category) {
    return text(category?.capabilityLevel) || (Number(category?.level) === 1 ? "L0" : "L1");
  }

  function categoryOptions(template, selected) {
    return list(template?.categories).filter((category) => categoryCapabilityLevel(category) === "L1").map((category) => `<option value="${escapeHtml(category.id)}"${category.id === selected ? " selected" : ""}>${escapeHtml(category.code || "")} ${escapeHtml(category.name)}</option>`).join("");
  }

  function renderCustomTemplateEditor(detail) {
    const template = detail.template;
    const categories = list(template.categories);
    const capabilities = list(template.capabilities);
    const selectedCapability = capabilities.find((item) => item.id === model.selectedTemplateCapabilityId) || capabilities.find((item) => item.included !== false) || capabilities[0];
    if (selectedCapability && !model.selectedTemplateCapabilityId) model.selectedTemplateCapabilityId = selectedCapability.id;
    return `
      <div class="maturity-v1-template-editor">
        <aside class="maturity-v1-template-categories">
          <div class="maturity-v1-panel-heading"><div><span>能力结构</span><h3>L0（可选）/ L1</h3></div></div>
          <div class="maturity-v1-category-list maturity-v2-node-editor">${categories.map((category) => `<div class="${categoryCapabilityLevel(category) === "L1" ? "is-child" : ""}"><span>${escapeHtml(category.code || "")}</span><input value="${escapeHtml(category.name)}" data-template-category-field="name" data-category-id="${escapeHtml(category.id)}" aria-label="修改 ${escapeHtml(category.name)}" /><select data-template-category-field="parentId" data-category-id="${escapeHtml(category.id)}" ${categoryCapabilityLevel(category) === "L0" ? "disabled" : ""}><option value="">顶级 L1</option>${categories.filter((item) => categoryCapabilityLevel(item) === "L0").map((item) => `<option value="${escapeHtml(item.id)}"${category.parentId === item.id ? " selected" : ""}>归属 ${escapeHtml(item.name)}</option>`).join("")}</select><small>${categoryCapabilityLevel(category)}</small><button class="maturity-v1-icon-button" type="button" data-maturity-action="remove-category" data-category-id="${escapeHtml(category.id)}" aria-label="从模板移除 ${escapeHtml(category.name)}">×</button></div>`).join("")}</div>
          <div class="maturity-v1-inline-form">
            <label><span>分类名称</span><input id="maturityCustomCategoryName" placeholder="输入分类名称" /></label>
            <label><span>能力层级</span><select id="maturityCustomCategoryLevel"><option value="L0">能力 L0（可选）</option><option value="L1">能力 L1</option></select></label>
            <label><span>L1 所属 L0</span><select id="maturityCustomCategoryParent"><option value="">无，作为顶级 L1</option>${categories.filter((item) => categoryCapabilityLevel(item) === "L0").map((item) => `<option value="${escapeHtml(item.id)}">${escapeHtml(item.name)}</option>`).join("")}</select></label>
            <button class="maturity-v1-button is-secondary is-full" type="button" data-maturity-action="add-category">新增能力节点</button>
          </div>
          <div class="maturity-v1-inline-form maturity-v2-custom-scope-form">
            <label><span>模板内作用域编码</span><input id="maturityCustomScopeCode" placeholder="例如 CUST-SCOPE" /></label>
            <label><span>作用域名称</span><input id="maturityCustomScopeName" placeholder="业务专题作用域" /></label>
            <button class="maturity-v1-button is-secondary is-full" type="button" data-maturity-action="add-custom-scope">新增模板内作用域</button>
            <small>${list(template.scopes).map((scope) => escapeHtml(scope.code)).join("、")}</small>
          </div>
        </aside>
        <section class="maturity-v1-template-capabilities">
          <div class="maturity-v1-panel-heading"><div><span>能力配置</span><h3>已有能力与模板覆盖</h3></div><span>${capabilities.filter((item) => item.included !== false).length} 个纳入评估</span></div>
          <div class="maturity-v1-table-wrap"><table class="maturity-v1-table maturity-v1-config-table"><thead><tr><th>纳入</th><th>编码</th><th>能力 L2 展示名称</th><th>所属能力 L1</th><th>变更</th><th>关键项</th></tr></thead><tbody>${capabilities.map((capability) => `<tr class="${capability.id === selectedCapability?.id ? "is-selected" : ""}" data-maturity-action="select-template-capability" data-capability-id="${escapeHtml(capability.id)}"><td><input type="checkbox" aria-label="纳入 ${escapeHtml(capability.name)}" ${capability.included !== false ? "checked" : ""} data-template-capability-field="included" data-capability-id="${escapeHtml(capability.id)}" /></td><td><span class="maturity-v1-code">${escapeHtml(capability.code || "自定义")}</span></td><td><input value="${escapeHtml(capability.name)}" data-template-capability-field="name" data-capability-id="${escapeHtml(capability.id)}" /></td><td><select data-template-capability-field="categoryId" data-capability-id="${escapeHtml(capability.id)}">${categoryOptions(template, capability.categoryId)}</select></td><td><span class="maturity-v1-row-status is-muted">${escapeHtml(capability.changeAction || "UNCHANGED")}</span></td><td><input type="checkbox" aria-label="设为关键能力" ${capability.isCritical ? "checked" : ""} data-template-capability-field="isCritical" data-capability-id="${escapeHtml(capability.id)}" /></td></tr>`).join("")}</tbody></table></div>
          <div class="maturity-v1-inline-form is-horizontal">
            <label><span>新增模板内能力</span><input id="maturityCustomCapabilityName" placeholder="能力名称" /></label>
            <label><span>所属能力 L1</span><select id="maturityCustomCapabilityCategory">${categoryOptions(template, categories.find((item) => categoryCapabilityLevel(item) === "L1")?.id)}</select></label>
            <button class="maturity-v1-button is-secondary" type="button" data-maturity-action="add-custom-capability">新增能力 L2</button>
          </div>
        </section>
        <aside class="maturity-v1-template-inspector">
          ${renderTemplateCapabilityInspector(detail, selectedCapability)}
        </aside>
      </div>
    `;
  }

  function renderTemplateCapabilityInspector(detail, capability) {
    if (!capability) return `<div class="maturity-v1-table-empty">选择一个能力查看关注点和评估点。</div>`;
    const template = detail.template;
    const capabilities = list(template.capabilities).filter((item) => item.included !== false);
    const focuses = list(template.focuses).filter((item) => item.capabilityId === capability.id);
    const scoreItems = list(template.scoreItems);
    return `
      <div class="maturity-v1-panel-heading"><div><span>能力详情</span><h3>${escapeHtml(capability.name)}</h3></div><span>${focuses.length} 个关注点</span></div>
      <p class="maturity-v1-inspector-copy">${escapeHtml(capability.description || "模板内展示信息；主工程对象不会被修改。")}</p>
      <div class="maturity-v1-focus-config-list">${focuses.map((focus) => {
        const rows = scoreItems.filter((item) => item.focusId === focus.id);
        const references = list(template.focusServiceMappings).filter((mapping) => mapping.focusId === focus.id && mapping.serviceRole === "PLATFORM_EVIDENCE_REFERENCE").length;
        return `<div><span class="maturity-v2-focus-code">${escapeHtml(focus.code || "自定义关注点")}</span><input value="${escapeHtml(focus.name)}" data-template-focus-field="name" data-focus-id="${escapeHtml(focus.id)}" aria-label="修改关注点名称" /><select data-template-focus-field="capabilityId" data-focus-id="${escapeHtml(focus.id)}">${capabilities.map((item) => `<option value="${escapeHtml(item.id)}"${item.id === focus.capabilityId ? " selected" : ""}>${escapeHtml(item.code || "自定义")} ${escapeHtml(item.name)}</option>`).join("")}</select><span>${focus.itemType === "SERVICE" ? `服务评估点 · ${rows.length} 项` : "关注点评估点"}${references ? ` · ${references} 个平台工具参考` : ""}</span><span class="maturity-v2-focus-actions"><button class="maturity-v1-link-button" type="button" data-maturity-action="add-custom-service" data-focus-id="${escapeHtml(focus.id)}">添加服务关系</button><button class="maturity-v1-link-button" type="button" data-maturity-action="remove-custom-focus" data-focus-id="${escapeHtml(focus.id)}">从模板移除</button></span></div>`;
      }).join("")}</div>
      <div class="maturity-v1-inline-form">
        <label><span>新增模板内关注点</span><input id="maturityCustomFocusName" placeholder="关注点名称" /></label>
        <label><span>评估点类型</span><select id="maturityCustomFocusMode"><option value="FOCUS">关注点评估点</option><option value="SERVICE">服务评估点</option></select></label>
        <label><span>自定义服务名称</span><input id="maturityCustomServiceName" placeholder="服务评估点需要" /></label>
        <label><span>服务作用域</span><select id="maturityCustomServiceScope">${list(template.scopes).map((scope) => `<option value="${escapeHtml(scope.code)}">${escapeHtml(scope.code)} ${escapeHtml(scope.name)}</option>`).join("")}</select></label>
        <label><span>新增服务角色</span><select id="maturityCustomServiceRole"><option value="ASSESSMENT_POINT">独立服务评估点</option><option value="PLATFORM_EVIDENCE_REFERENCE">平台工具参考</option></select></label>
        <button class="maturity-v1-button is-secondary is-full" type="button" data-maturity-action="add-custom-focus" data-capability-id="${escapeHtml(capability.id)}">新增关注点</button>
      </div>
    `;
  }

  function includedCapabilities(template) {
    return list(template?.capabilities).filter((item) => item.included !== false);
  }

  function selectedCapability(detail) {
    const capabilities = includedCapabilities(detail.template);
    const selected = capabilities.find((item) => item.id === model.selectedCapabilityId) || capabilities[0] || null;
    if (selected && model.selectedCapabilityId !== selected.id) model.selectedCapabilityId = selected.id;
    return selected;
  }

  function scoreEntryMap(detail) {
    return new Map(list(detail.scoreEntries).map((entry) => [entry.scoreItemId, entry]));
  }

  function scoreEntry(detail, itemId) {
    let entry = list(detail.scoreEntries).find((item) => item.scoreItemId === itemId);
    if (!entry) {
      entry = { scoreItemId: itemId, isApplicable: true, elements: {}, dimensionNotes: {}, reviewElements: {}, targetElements: {}, targetDimensionNotes: {}, targetLevel: "", targetReason: "", targetConfirmed: false, evidenceLevel: "E0", evidenceSummary: "", note: "", naReason: "", status: "not_scored" };
      detail.scoreEntries.push(entry);
    }
    return normalizeTargetFields(entry);
  }

  function capabilityProgress(detail, capabilityId) {
    const focuses = list(detail.template.focuses).filter((focus) => focus.capabilityId === capabilityId && focus.included !== false);
    const focusIds = new Set(focuses.map((focus) => focus.id));
    const itemIds = new Set(list(detail.template.scoreItems).filter((item) => focusIds.has(item.focusId)).map((item) => item.id));
    const entries = list(detail.scoreEntries).filter((entry) => itemIds.has(entry.scoreItemId));
    const applicable = entries.filter((entry) => entry.isApplicable !== false);
    const scored = applicable.filter((entry) => entryIsComplete(entry));
    return applicable.length ? Math.round((100 * scored.length) / applicable.length) : itemIds.size ? 100 : 0;
  }

  function hasCompleteElements(elements) {
    return ["organization", "process", "tool", "data"].every((key) => LEVELS.includes(elements?.[key]));
  }

  function entryIsComplete(entry) {
    if (entry?.isApplicable === false) return true;
    normalizeTargetFields(entry);
    return hasCompleteElements(entry?.elements) && hasCompleteElements(entry?.targetElements);
  }

  function entryIsStarted(entry) {
    if (!entry) return false;
    if (entry.isApplicable === false) return true;
    normalizeTargetFields(entry);
    return DIMENSIONS.some(([key]) => LEVELS.includes(entry.elements?.[key]) || LEVELS.includes(entry.reviewElements?.[key]) || Boolean(text(entry.dimensionNotes?.[key]).trim()) || LEVELS.includes(entry.targetElements?.[key]) || Boolean(text(entry.targetDimensionNotes?.[key]).trim()))
      || Boolean(text(entry.evidenceSummary).trim())
      || Boolean(text(entry.note).trim())
      || (entry.evidenceLevel && entry.evidenceLevel !== "E0");
  }

  function scoreProgressState(detail, items) {
    const rows = list(items).map((item) => scoreEntry(detail, item.id));
    const applicable = rows.filter((entry) => entry.isApplicable !== false);
    const excluded = rows.length - applicable.length;
    const completed = applicable.filter((entry) => entryIsComplete(entry)).length;
    const started = applicable.filter((entry) => entryIsStarted(entry)).length;
    if (rows.length && !applicable.length) return { key: "not-applicable", label: "不适用", count: `0 / 0`, excluded };
    if (applicable.length && completed === applicable.length) return { key: "complete", label: "已完成", count: `${completed} / ${applicable.length}`, excluded };
    if (started || excluded) return { key: "in-progress", label: "进行中", count: `${completed} / ${applicable.length}`, excluded };
    return { key: "not-started", label: "未开始", count: `0 / ${applicable.length || rows.length}`, excluded };
  }

  function renderScoreProgressState(state, { compact = false, iconOnly = false } = {}) {
    const suffix = state.excluded ? ` · ${state.excluded} 不适用` : "";
    const accessibleLabel = `评分状态：${state.label}${state.excluded ? `，${state.excluded} 个不适用` : ""}`;
    const labelMarkup = iconOnly ? "" : `<b>${escapeHtml(state.label)}</b>`;
    const countMarkup = iconOnly || compact ? "" : `<small>${escapeHtml(state.count)}${escapeHtml(suffix)}</small>`;
    return `<span class="maturity-v4-score-state is-${escapeHtml(state.key)}${iconOnly ? " is-icon-only" : ""}" aria-label="${escapeHtml(accessibleLabel)}" title="${escapeHtml(accessibleLabel)}"><i></i>${labelMarkup}${countMarkup}</span>`;
  }

  function scoreEntryStatusLabel(entry) {
    if (entry?.isApplicable === false) return "不适用";
    normalizeTargetFields(entry);
    const dimensionCount = DIMENSIONS.filter(([key]) => LEVELS.includes(entry?.elements?.[key])).length;
    const targetCount = DIMENSIONS.filter(([key]) => LEVELS.includes(entry?.targetElements?.[key])).length;
    if (!dimensionCount && !targetCount) return "未评分";
    if (dimensionCount < DIMENSIONS.length) return `填写中 ${dimensionCount}/4`;
    if (targetCount < DIMENSIONS.length) return `待设置目标 ${targetCount}/4`;
    return "已完成";
  }

  function scoreItemResult(detail, itemId) {
    return list(detail?.result?.scoreItemResults).find((item) => item.id === itemId) || null;
  }

  function scoreTargetConflict(detail, itemId) {
    const pointResult = scoreItemResult(detail, itemId);
    return pointResult?.targetBelowCurrent === true ? pointResult : null;
  }

  function currentDimensionLevel(entry, dimension) {
    return entry?.reviewElements?.[dimension] || entry?.elements?.[dimension] || "";
  }

  function targetLevelIsBelowCurrent(entry, dimension, targetLevel) {
    const currentLevel = currentDimensionLevel(entry, dimension);
    return LEVELS.includes(currentLevel)
      && LEVELS.includes(targetLevel)
      && LEVELS.indexOf(targetLevel) < LEVELS.indexOf(currentLevel);
  }

  function currentLevelIsAboveTarget(entry, dimension, currentLevel) {
    const targetLevel = entry?.targetElements?.[dimension] || "";
    return LEVELS.includes(currentLevel)
      && LEVELS.includes(targetLevel)
      && LEVELS.indexOf(currentLevel) > LEVELS.indexOf(targetLevel);
  }

  function focusCurrentMaximumLevel(detail, items) {
    const maximumIndex = list(items)
      .filter((item) => item.itemType === "SERVICE")
      .reduce((highest, item) => {
        const entry = scoreEntry(detail, item.id);
        if (entry.isApplicable === false) return highest;
        return DIMENSIONS.reduce((dimensionHighest, [key]) => {
          const level = currentDimensionLevel(entry, key);
          return LEVELS.includes(level) ? Math.max(dimensionHighest, LEVELS.indexOf(level)) : dimensionHighest;
        }, highest);
      }, 0);
    return LEVELS[maximumIndex] || "L1";
  }

  function focusTargetMinimumLevel(detail, items) {
    return focusCurrentMaximumLevel(detail, items);
  }

  function focusExistingTargetMinimumLevel(detail, items) {
    const targetIndexes = list(items)
      .filter((item) => item.itemType === "SERVICE")
      .flatMap((item) => {
        const entry = scoreEntry(detail, item.id);
        if (entry.isApplicable === false) return [];
        return DIMENSIONS.map(([key]) => LEVELS.indexOf(entry.targetElements?.[key])).filter((index) => index >= 0);
      });
    return targetIndexes.length ? LEVELS[Math.min(...targetIndexes)] : "";
  }

  function focusCurrentMaximumAllowedLevel(detail, items) {
    return focusExistingTargetMinimumLevel(detail, items) || "L5";
  }

  function targetConflictMessage(conflict) {
    const dimensionConflicts = list(conflict?.targetDimensionConflicts);
    if (dimensionConflicts.length) {
      const first = dimensionConflicts[0];
      const suffix = dimensionConflicts.length > 1 ? `等 ${dimensionConflicts.length} 个维度` : "";
      return `${first.dimensionLabel || "目标状态"}${suffix}不能低于当前状态 ${first.currentLevel || first.minimumTargetLevel || ""}，请提高目标状态等级`;
    }
    return `目标等级不能低于当前评分计算等级 ${conflict?.minimumTargetLevel || conflict?.currentLevel || ""}，请先修改目标等级`;
  }

  function scorePointIsComplete(detail, itemId, entry = scoreEntry(detail, itemId)) {
    const pointResult = scoreItemResult(detail, itemId);
    if (!detail?.resultStale && pointResult) return pointResult.isComplete === true;
    return entryIsComplete(entry) && pointResult?.targetBelowCurrent !== true;
  }

  function scoringNavigationBlocked(detail, nextItemId) {
    const currentItemId = model.selectedScoreItemId;
    if (!currentItemId || currentItemId === nextItemId) return false;
    if (detail?.resultStale || model.calculating) {
      showToast("正在由后端校验当前评分与目标等级，请稍候再切换评估点", "info");
      return true;
    }
    const conflict = scoreTargetConflict(detail, currentItemId);
    if (!conflict) return false;
    showToast(targetConflictMessage(conflict), "error");
    render();
    scheduleScoringLanding(detail, currentItemId, { targetConflict: true });
    return true;
  }

  function hierarchyExpansion(detail) {
    const projectId = detail?.project?.id || "default";
    if (!(model.hierarchyExpansionByProject[projectId] instanceof Set)) model.hierarchyExpansionByProject[projectId] = new Set();
    return model.hierarchyExpansionByProject[projectId];
  }

  function scoreDirectoryUi(detail) {
    const projectId = detail?.project?.id || "default";
    const current = model.scoreDirectoryUiByProject[projectId];
    if (!current || typeof current !== "object") {
      model.scoreDirectoryUiByProject[projectId] = { collapsed: false, width: DIRECTORY_PANE_METRICS.defaultWidth };
    }
    return model.scoreDirectoryUiByProject[projectId];
  }

  function clampScoreDirectoryWidth(value, shell = null) {
    const adaptiveScale = Math.max(1, Number(document.documentElement.dataset.sapdUiScale) || 1);
    const shellWidth = shell ? shell.getBoundingClientRect().width / adaptiveScale : 0;
    const availableMaximum = shellWidth
      ? Math.max(SCORE_DIRECTORY_MIN_WIDTH, shellWidth - SCORE_WORKBENCH_MIN_WIDTH - 6)
      : SCORE_DIRECTORY_MAX_WIDTH;
    return Math.round(Math.min(SCORE_DIRECTORY_MAX_WIDTH, availableMaximum, Math.max(SCORE_DIRECTORY_MIN_WIDTH, Number(value) || DIRECTORY_PANE_METRICS.defaultWidth)));
  }

  function applyScoreDirectoryWidth(shell, ui) {
    if (!shell || !ui) return;
    ui.width = clampScoreDirectoryWidth(ui.width, shell);
    shell.style.setProperty("--maturity-score-directory-width", `${ui.width}px`);
    const handle = shell.querySelector("[data-maturity-score-directory-resizer]");
    if (handle) handle.setAttribute("aria-valuenow", String(ui.width));
  }

  function beginScoreDirectoryResize(event) {
    const handle = event.target.closest?.("[data-maturity-score-directory-resizer]");
    if (!handle || event.button !== 0) return;
    const detail = activeDetail();
    const shell = handle.closest(".maturity-v4-scoring-shell");
    if (!detail || !shell || shell.classList.contains("is-directory-collapsed")) return;
    event.preventDefault();
    const ui = scoreDirectoryUi(detail);
    const adaptiveScale = Math.max(1, Number(document.documentElement.dataset.sapdUiScale) || 1);
    const startX = event.clientX;
    const startWidth = clampScoreDirectoryWidth(ui.width, shell);
    document.body.classList.add("is-resizing");
    const finish = () => {
      document.body.classList.remove("is-resizing");
      document.removeEventListener("pointermove", move);
      document.removeEventListener("pointerup", finish);
      document.removeEventListener("pointercancel", finish);
    };
    const move = (moveEvent) => {
      ui.width = startWidth + (moveEvent.clientX - startX) / adaptiveScale;
      applyScoreDirectoryWidth(shell, ui);
    };
    document.addEventListener("pointermove", move);
    document.addEventListener("pointerup", finish, { once: true });
    document.addEventListener("pointercancel", finish, { once: true });
  }

  function hierarchyKey(level, id) {
    return `${level}:${id}`;
  }

  function expandHierarchyPathToCapability(detail, capabilityId) {
    const expanded = hierarchyExpansion(detail);
    const capability = list(detail.template?.capabilities).find((item) => item.id === capabilityId);
    if (!capability) return;
    expanded.add(hierarchyKey("L2", capability.id));
    const l1 = list(detail.template?.categories).find((item) => item.id === capability.categoryId);
    if (l1) {
      expanded.add(hierarchyKey("L1", l1.id));
      if (l1.parentId) expanded.add(hierarchyKey("L0", l1.parentId));
    }
  }

  function aggregateLevelOptions(value) {
    const mixed = value === "__mixed__";
    return `${mixed ? '<option value="" selected disabled>混合</option>' : ""}${levelOptions(mixed ? "__mixed__" : value, { includeEmpty: true, compact: true })}`;
  }

  function commonScoreValue(rows, getter) {
    const values = rows.map(getter).filter((value) => LEVELS.includes(value));
    if (!values.length) return "";
    return new Set(values).size === 1 && values.length === rows.length ? values[0] : "__mixed__";
  }

  function focusDirectState(items, entries) {
    const rows = items.map((item) => entries.get(item.id) || { scoreItemId: item.id, isApplicable: true, elements: {}, targetLevel: "" });
    const applicableRows = rows.filter((entry) => entry.isApplicable !== false);
    const applicability = rows.length && rows.every((entry) => entry.isApplicable === false) ? "false" : rows.some((entry) => entry.isApplicable === false) ? "mixed" : "true";
    return {
      applicability,
      elements: DIMENSIONS.reduce((values, [key]) => ({ ...values, [key]: commonScoreValue(applicableRows, (entry) => entry.elements?.[key]) }), {}),
      targetLevel: commonScoreValue(applicableRows, (entry) => entry.targetLevel),
    };
  }

  function aggregateStatus(result, stale = false) {
    if (stale) return { label: "更新中", tone: "is-review" };
    if (!result || result.currentIndex == null) return { label: "未评分", tone: "is-muted" };
    if (Number(result.completionRate || 0) >= 100) return { label: "已完成", tone: "is-good" };
    return { label: "填写中", tone: "is-warn" };
  }

  function renderAggregateSummary(result, stale = false) {
    const status = aggregateStatus(result, stale);
    const currentLevel = LEVELS.includes(result?.currentLevel) ? result.currentLevel : "未评分";
    const targetLevel = LEVELS.includes(result?.targetLevel) ? result.targetLevel : "未设置";
    return `<span class="maturity-v2-aggregate-summary"><span>当前 <b>${escapeHtml(currentLevel)}</b>${result?.currentIndex == null ? "" : ` ${escapeHtml(result.currentIndex)}`}</span><span>目标 <b>${escapeHtml(targetLevel)}</b></span><span>完成 ${Number(result?.completionRate || 0).toFixed(0)}%</span><span class="maturity-v1-row-status ${status.tone}">${status.label}</span></span>`;
  }

  function renderHierarchyRow({ className, levelKey, label, id, code, name, result, expanded, stale }) {
    return `<tr class="${className}" data-hierarchy-row="${escapeHtml(levelKey)}:${escapeHtml(id)}"><td colspan="10"><button class="maturity-v2-hierarchy-toggle" type="button" data-maturity-action="toggle-score-hierarchy" data-hierarchy-level="${escapeHtml(levelKey)}" data-hierarchy-id="${escapeHtml(id)}" aria-expanded="${expanded}"><span class="maturity-v2-hierarchy-action">${expanded ? "收起" : "展开"}</span><span>${escapeHtml(label)}</span><strong>${escapeHtml(code || `自定义 ${levelKey}`)} ${escapeHtml(name)}</strong>${renderAggregateSummary(result, stale)}</button></td></tr>`;
  }

  function byTemplateOrder(rows) {
    return [...list(rows)].sort((left, right) => {
      const leftOrder = left?.sortOrder == null || left.sortOrder === "" || !Number.isFinite(Number(left.sortOrder)) ? Number.MAX_SAFE_INTEGER : Number(left.sortOrder);
      const rightOrder = right?.sortOrder == null || right.sortOrder === "" || !Number.isFinite(Number(right.sortOrder)) ? Number.MAX_SAFE_INTEGER : Number(right.sortOrder);
      return leftOrder - rightOrder || text(left?.code || left?.name).localeCompare(text(right?.code || right?.name), "zh-Hans-CN", { numeric: true });
    });
  }

  function renderScoringTabLegacy(detail) {
    const template = detail.template;
    const capabilities = includedCapabilities(template);
    if (!capabilities.length) return `<div class="maturity-v1-empty">当前模板没有可评分能力。</div>`;
    const capabilityById = new Map(capabilities.map((item) => [item.id, item]));
    const focuses = list(template.focuses).filter((item) => capabilityById.has(item.capabilityId) && item.included !== false);
    const focusById = new Map(focuses.map((item) => [item.id, item]));
    const allScoreItems = list(template.scoreItems).filter((item) => focusById.has(item.focusId));
    const entries = scoreEntryMap(detail);
    const search = text(model.scoringSearch).trim().toLowerCase();
    const scoreItems = allScoreItems.filter((item) => {
      const focus = focusById.get(item.focusId) || {};
      const capability = capabilityById.get(item.capabilityId) || {};
      const service = list(template.services).find((candidate) => candidate.id === item.serviceId) || {};
      const entry = entries.get(item.id) || {};
      const complete = entryIsComplete(entry);
      if (model.scoringStatus === "unscored" && complete) return false;
      if (model.scoringStatus === "complete" && (entry.isApplicable === false || !entryIsComplete(entry))) return false;
      if (model.scoringStatus === "na" && entry.isApplicable !== false) return false;
      if (model.scoringEvidence === "missing" && entry.isApplicable !== false && entry.evidenceLevel && entry.evidenceLevel !== "E0") return false;
      if (!search) return true;
      return [focus.code, focus.name, capability.code, capability.name, service.code, service.name, item.scopeCode, item.scopeName].join(" ").toLowerCase().includes(search);
    });
    const selectedItem = allScoreItems.find((item) => item.id === model.selectedScoreItemId) || null;
    const summary = summaryOf(detail);
    const categories = byTemplateOrder(list(template.categories).filter((item) => item.included !== false));
    const l0Categories = categories.filter((item) => categoryCapabilityLevel(item) === "L0");
    const l1Categories = categories.filter((item) => categoryCapabilityLevel(item) === "L1");
    const expandedKeys = hierarchyExpansion(detail);
    const forceExpanded = Boolean(search || model.scoringStatus !== "all" || model.scoringEvidence !== "all");
    const isExpanded = (level, id) => forceExpanded || expandedKeys.has(hierarchyKey(level, id));
    const categoryResults = new Map([...list(detail.result?.categoryResults), ...list(detail.result?.subCategoryResults)].map((item) => [item.id, item]));
    const capabilityResults = new Map(list(detail.result?.capabilityResults).map((item) => [item.id, item]));
    const focusResults = new Map(list(detail.result?.focusResults).map((item) => [item.id, item]));
    const stale = Boolean(detail.resultStale || model.calculating);
    const renderFocusRows = (focus) => {
      const visibleItems = byTemplateOrder(scoreItems.filter((item) => item.focusId === focus.id));
      if (!visibleItems.length) return "";
      const allItems = byTemplateOrder(allScoreItems.filter((item) => item.focusId === focus.id));
      const direct = focusDirectState(allItems, entries);
      const expanded = isExpanded("FOCUS", focus.id);
      const focusResult = focusResults.get(focus.id);
      const focusStatus = aggregateStatus(focusResult, stale);
      const applicabilityOptions = direct.applicability === "mixed" ? '<option value="" selected disabled>部分适用</option>' : "";
      return `<tr class="maturity-v2-focus-group" data-focus-group="${escapeHtml(focus.id)}">
        <td><button class="maturity-v2-focus-toggle" type="button" data-maturity-action="toggle-score-hierarchy" data-hierarchy-level="FOCUS" data-hierarchy-id="${escapeHtml(focus.id)}" aria-expanded="${expanded}"><span>${expanded ? "收起" : "展开"}</span><strong>${escapeHtml(focus.code || "自定义关注点")} ${escapeHtml(focus.name)}</strong></button></td>
        <td><span class="maturity-v2-focus-batch-label">关注点统一设置</span><small>${allItems.length} 个下级评估点</small></td>
        <td><select class="maturity-v2-applicability-select" data-focus-applicability data-focus-id="${escapeHtml(focus.id)}" ${detail.project.readOnly ? "disabled" : ""} aria-label="${escapeHtml(focus.name)}是否适用">${applicabilityOptions}<option value="true"${direct.applicability === "true" ? " selected" : ""}>适用</option><option value="false"${direct.applicability === "false" ? " selected" : ""}>不适用</option></select></td>
        ${DIMENSIONS.map(([key, label]) => `<td><select class="maturity-v2-dimension-select" data-focus-score-dimension="${key}" data-focus-id="${escapeHtml(focus.id)}" ${direct.applicability === "false" || detail.project.readOnly ? "disabled" : ""} aria-label="${escapeHtml(focus.name)}统一${escapeHtml(label)}评分">${aggregateLevelOptions(direct.elements[key])}</select></td>`).join("")}
        <td><span class="maturity-v1-level ${levelTone(focusResult?.currentLevel)}">${escapeHtml(LEVELS.includes(focusResult?.currentLevel) ? focusResult.currentLevel : "未计算")}</span><small>${focusResult?.currentIndex == null ? "服务评分后汇总" : `${focusResult.currentIndex} / ${focusResult.currentPercent}`}</small></td>
        <td><select data-focus-score-field="targetLevel" data-focus-id="${escapeHtml(focus.id)}" ${direct.applicability === "false" || detail.project.readOnly ? "disabled" : ""} aria-label="${escapeHtml(focus.name)}统一目标等级">${aggregateLevelOptions(direct.targetLevel)}</select><small>${focusResult?.targetLevel && LEVELS.includes(focusResult.targetLevel) ? `汇总 ${focusResult.targetLevel}` : "未设置"}</small></td>
        <td><span class="maturity-v1-row-status ${focusStatus.tone}">${focusStatus.label}</span><small>${detail.localSaveState === "error" ? "保存失败" : detail.lastSavedAt ? "已保存" : "未保存"}</small></td>
      </tr>${expanded ? visibleItems.map((item) => renderScoreRow(detail, item, focus, entries.get(item.id), item.id === selectedItem?.id)).join("") : ""}`;
    };
    const capabilityRows = (capability) => {
      const capabilityFocuses = byTemplateOrder(focuses.filter((focus) => focus.capabilityId === capability.id && scoreItems.some((item) => item.focusId === focus.id)));
      if (!capabilityFocuses.length) return "";
      const expanded = isExpanded("L2", capability.id);
      return `${renderHierarchyRow({ className: "maturity-v2-capability-group", levelKey: "L2", label: "能力 L2", id: capability.id, code: capability.code, name: capability.name, result: capabilityResults.get(capability.id), expanded, stale })}${expanded ? capabilityFocuses.map(renderFocusRows).join("") : ""}`;
    };
    const l1Rows = (category) => {
      const childCapabilities = byTemplateOrder(capabilities.filter((capability) => capability.categoryId === category.id && scoreItems.some((item) => item.capabilityId === capability.id)));
      if (!childCapabilities.length) return "";
      const expanded = isExpanded("L1", category.id);
      return `${renderHierarchyRow({ className: "maturity-v2-l1-group", levelKey: "L1", label: "能力 L1", id: category.id, code: category.code, name: category.name, result: categoryResults.get(category.id), expanded, stale })}${expanded ? childCapabilities.map(capabilityRows).join("") : ""}`;
    };
    const renderedL1Ids = new Set();
    const groupedRows = [
      ...l0Categories.map((category) => {
        const rows = l1Categories.filter((item) => item.parentId === category.id).map((item) => {
          const output = l1Rows(item);
          if (output) renderedL1Ids.add(item.id);
          return output;
        }).join("");
        if (!rows) return "";
        const expanded = isExpanded("L0", category.id);
        return `${renderHierarchyRow({ className: "maturity-v2-l0-group", levelKey: "L0", label: "能力 L0", id: category.id, code: category.code, name: category.name, result: categoryResults.get(category.id), expanded, stale })}${expanded ? rows : ""}`;
      }),
      ...l1Categories.filter((category) => !renderedL1Ids.has(category.id)).map((category) => {
        const output = l1Rows(category);
        if (output) renderedL1Ids.add(category.id);
        return output;
      }),
      ...byTemplateOrder(capabilities.filter((capability) => !l1Categories.some((category) => category.id === capability.categoryId))).map(capabilityRows),
    ].join("");
    return `
      <section class="maturity-v1-section maturity-v2-scoring-workspace">
        <div class="maturity-v2-scoring-toolbar">
          <div><span>四维评分</span><h3>${Number(summary.completionRate || 0).toFixed(0)}% 已完成</h3><small>${summary.scoredItemCount || 0} / ${summary.applicableItemCount || allScoreItems.length} 个适用评估点 · ${detail.localSaveState === "error" ? "保存失败" : model.calculating ? "已保存，正在试算" : detail.resultStale ? "已保存，等待汇总" : "已保存并完成汇总"}</small></div>
          <label><span>跳转到能力 L2</span><select data-maturity-capability-jump><option value="">选择能力</option>${capabilities.map((item) => `<option value="${escapeHtml(item.id)}">${escapeHtml(item.code || "自定义")} ${escapeHtml(item.name)}</option>`).join("")}</select></label>
          <label class="maturity-v2-score-search"><span>搜索评估点</span><input type="search" value="${escapeHtml(model.scoringSearch)}" placeholder="关注点、服务或作用域" autocomplete="off" data-maturity-score-search /></label>
          <label><span>状态</span><select data-maturity-score-filter="status"><option value="all">全部状态</option><option value="unscored"${model.scoringStatus === "unscored" ? " selected" : ""}>未完成</option><option value="complete"${model.scoringStatus === "complete" ? " selected" : ""}>已完成</option><option value="na"${model.scoringStatus === "na" ? " selected" : ""}>不适用</option></select></label>
          <label><span>证据（辅助）</span><select data-maturity-score-filter="evidence"><option value="all">全部</option><option value="missing"${model.scoringEvidence === "missing" ? " selected" : ""}>无证据</option></select></label>
          <div class="maturity-v1-toolbar"><button class="maturity-v1-button is-secondary" type="button" data-maturity-action="export-score-exchange">下载评分表</button><button class="maturity-v1-button is-secondary" type="button" data-maturity-action="trigger-score-import">上传评分文件</button><input type="file" accept="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,.xlsx" hidden data-maturity-score-file /></div>
        </div>
        <div class="maturity-v1-table-wrap maturity-v1-score-table-scroll"><table class="maturity-v1-table maturity-v1-score-table maturity-v2-score-table"><thead><tr><th>安全技术服务 / 关注点评估项</th><th>类型 / 作用域</th><th>是否适用</th><th>组织</th><th>流程</th><th>工具</th><th>数据</th><th>系统当前</th><th>目标等级</th><th>状态</th></tr></thead><tbody>${groupedRows || `<tr><td colspan="10"><div class="maturity-v1-table-empty"><strong>没有符合条件的评估点</strong><span>清空搜索或筛选后继续评分。</span><button class="maturity-v1-button is-secondary" type="button" data-maturity-action="clear-score-filters">清空筛选</button></div></td></tr>`}</tbody></table></div>
      </section>
    `;
  }

  function scoringSelection(detail) {
    const active = activeTemplateData(detail.template);
    const categories = byTemplateOrder(active.categories.filter((item) => item.included !== false));
    const categoryById = new Map(categories.map((item) => [item.id, item]));
    const capabilities = byTemplateOrder(active.capabilities);
    const preferredCapabilityId = model.selectedCapabilityId || detail.scoringLocation?.capabilityId;
    const capability = capabilities.find((item) => item.id === preferredCapabilityId) || capabilities[0] || null;
    const l1 = capability ? categoryById.get(capability.categoryId) || null : null;
    const l0 = l1?.parentId ? categoryById.get(l1.parentId) || null : null;
    const focuses = capability
      ? byTemplateOrder(active.focuses.filter((item) => item.capabilityId === capability.id))
      : [];
    const preferredFocusId = model.selectedFocusId || detail.scoringLocation?.focusId;
    const focus = focuses.find((item) => item.id === preferredFocusId) || focuses[0] || null;
    const scoreItems = focus
      ? byTemplateOrder(active.scoreItems.filter((item) => item.focusId === focus.id))
      : [];
    const preferredScoreItemId = model.selectedScoreItemId || detail.scoringLocation?.scoreItemId;
    const scoreItem = scoreItems.find((item) => item.id === preferredScoreItemId) || scoreItems[0] || null;
    const storedViewLevel = text(model.selectedScoreViewLevel || detail.scoringLocation?.viewLevel).toUpperCase();
    const storedViewId = text(model.selectedScoreViewId || detail.scoringLocation?.viewId);
    const validView = storedViewLevel === "L0"
      ? categories.some((item) => item.id === storedViewId && categoryCapabilityLevel(item) === "L0")
      : storedViewLevel === "L1"
        ? categories.some((item) => item.id === storedViewId && categoryCapabilityLevel(item) === "L1")
        : storedViewLevel === "L2"
          ? capabilities.some((item) => item.id === storedViewId)
          : storedViewLevel === "FOCUS"
            ? active.focuses.some((item) => item.id === storedViewId)
            : false;
    const viewLevel = validView ? storedViewLevel : "FOCUS";
    const viewId = validView ? storedViewId : focus?.id || "";
    model.selectedCapabilityId = capability?.id || "";
    model.selectedFocusId = focus?.id || "";
    model.selectedScoreItemId = scoreItem?.id || "";
    model.selectedScoreViewLevel = viewLevel;
    model.selectedScoreViewId = viewId;
    detail.scoringLocation = {
      capabilityId: model.selectedCapabilityId,
      focusId: model.selectedFocusId,
      scoreItemId: model.selectedScoreItemId,
      viewLevel,
      viewId,
    };
    const projectId = detail.project?.id || "default";
    if (!model.directoryInitializedByProject[projectId] && capability) {
      expandHierarchyPathToCapability(detail, capability.id);
      if (focus) hierarchyExpansion(detail).add(hierarchyKey("FOCUS", focus.id));
      model.directoryInitializedByProject[projectId] = true;
    }
    return { active, categories, categoryById, capabilities, capability, l1, l0, focuses, focus, scoreItems, scoreItem, viewLevel, viewId };
  }

  function setScoringHierarchy(detail, level, objectId) {
    const active = activeTemplateData(detail.template);
    const categories = byTemplateOrder(active.categories.filter((item) => item.included !== false));
    const categoryById = new Map(categories.map((item) => [item.id, item]));
    const normalizedLevel = text(level).toUpperCase();
    let capability = null;
    if (normalizedLevel === "L2") {
      capability = active.capabilities.find((item) => item.id === objectId) || null;
    } else if (normalizedLevel === "L1") {
      capability = byTemplateOrder(active.capabilities.filter((item) => item.categoryId === objectId))[0] || null;
    } else if (normalizedLevel === "L0") {
      const l1Ids = new Set(categories.filter((item) => item.parentId === objectId && categoryCapabilityLevel(item) === "L1").map((item) => item.id));
      capability = byTemplateOrder(active.capabilities.filter((item) => l1Ids.has(item.categoryId) || item.categoryId === objectId))[0] || null;
    }
    if (!capability || !["L0", "L1", "L2"].includes(normalizedLevel)) return;
    const focus = byTemplateOrder(active.focuses.filter((item) => item.capabilityId === capability.id))[0] || null;
    const scoreItem = byTemplateOrder(active.scoreItems.filter((item) => item.focusId === focus?.id))[0] || null;
    model.selectedCapabilityId = capability.id;
    model.selectedFocusId = focus?.id || "";
    model.selectedScoreItemId = scoreItem?.id || "";
    model.selectedScoreViewLevel = normalizedLevel;
    model.selectedScoreViewId = objectId;
    if (normalizedLevel === "L0") hierarchyExpansion(detail).add(hierarchyKey("L0", objectId));
    if (normalizedLevel === "L1") {
      hierarchyExpansion(detail).add(hierarchyKey("L1", objectId));
      const category = categoryById.get(objectId);
      if (category?.parentId) hierarchyExpansion(detail).add(hierarchyKey("L0", category.parentId));
    }
    if (normalizedLevel === "L2") expandHierarchyPathToCapability(detail, capability.id);
    detail.scoringLocation = {
      capabilityId: model.selectedCapabilityId,
      focusId: model.selectedFocusId,
      scoreItemId: model.selectedScoreItemId,
      viewLevel: normalizedLevel,
      viewId: objectId,
    };
    persistDetail(detail);
  }

  function setScoringCapability(detail, capabilityId) {
    const active = activeTemplateData(detail.template);
    const capability = active.capabilities.find((item) => item.id === capabilityId) || active.capabilities[0];
    if (capability) setScoringHierarchy(detail, "L2", capability.id);
  }

  function setScoringFocus(detail, focusId) {
    const active = activeTemplateData(detail.template);
    const focus = active.focuses.find((item) => item.id === focusId);
    if (!focus) return;
    const scoreItem = byTemplateOrder(active.scoreItems.filter((item) => item.focusId === focus.id))[0];
    model.selectedCapabilityId = focus.capabilityId;
    model.selectedFocusId = focus.id;
    model.selectedScoreItemId = scoreItem?.id || "";
    model.selectedScoreViewLevel = "FOCUS";
    model.selectedScoreViewId = focus.id;
    expandHierarchyPathToCapability(detail, focus.capabilityId);
    hierarchyExpansion(detail).add(hierarchyKey("FOCUS", focus.id));
    detail.scoringLocation = { capabilityId: focus.capabilityId, focusId: focus.id, scoreItemId: model.selectedScoreItemId, viewLevel: "FOCUS", viewId: focus.id };
    persistDetail(detail);
  }

  function setScoringItem(detail, scoreItemId) {
    const active = activeTemplateData(detail.template);
    const scoreItem = active.scoreItems.find((item) => item.id === scoreItemId);
    const focus = active.focuses.find((item) => item.id === scoreItem?.focusId);
    if (!scoreItem || !focus) return;
    model.selectedCapabilityId = focus.capabilityId;
    model.selectedFocusId = focus.id;
    model.selectedScoreItemId = scoreItem.id;
    model.selectedScoreViewLevel = "FOCUS";
    model.selectedScoreViewId = focus.id;
    expandHierarchyPathToCapability(detail, focus.capabilityId);
    hierarchyExpansion(detail).add(hierarchyKey("FOCUS", focus.id));
    detail.scoringLocation = { capabilityId: focus.capabilityId, focusId: focus.id, scoreItemId: scoreItem.id, viewLevel: "FOCUS", viewId: focus.id };
    persistDetail(detail);
  }

  function compactChineseName(value) {
    return text(value)
      .replace(/\s+[A-Za-z][A-Za-z\s&/()-]*$/, "")
      .replace(/能力$/, "")
      .trim();
  }

  function renderCapabilityTab(item, active, action, dataName, label) {
    const visibleLabel = label || `${item.code || "自定义"} ${item.name}`;
    return `<button class="maturity-v3-capability-tab ${active ? "is-active" : ""}" type="button" data-maturity-action="${action}" ${dataName}="${escapeHtml(item.id)}" aria-pressed="${active}" title="${escapeHtml(`${item.code || "自定义"} ${item.name}`)}">${escapeHtml(visibleLabel)}</button>`;
  }

  function renderDimensionSummary(result) {
    return DIMENSIONS.map(([key, label]) => `<div><span>${escapeHtml(label)}</span><strong>${result?.dimensionResults?.[key] == null ? "-" : escapeHtml(Number(result.dimensionResults[key]).toFixed(2))}</strong></div>`).join("");
  }

  function resultProgressCopy(result) {
    if (result?.targetIndex == null) return { rate: null, label: "未设置目标", tone: "is-pending" };
    if (result?.currentIndex == null) return { rate: null, label: "待完成评分", tone: "is-pending" };
    const gap = Number(result?.gapIndex);
    if (Number.isFinite(gap) && gap > 0) return { rate: result.targetAchievementRate, label: `距目标尚差 ${gap.toFixed(2)} 级`, tone: "is-gap" };
    return { rate: result.targetAchievementRate, label: "已达到目标", tone: "is-ready" };
  }

  function renderStatisticDimensionRows(values, { levelValues = false } = {}) {
    return DIMENSIONS.map(([key, label]) => {
      const level = levelValues && LEVELS.includes(values?.[key]) ? values[key] : "";
      const numericValue = level ? LEVELS.indexOf(level) + 1 : values?.[key] == null ? null : Number(values[key]);
      const safeValue = Number.isFinite(numericValue) ? Math.max(1, Math.min(5, numericValue)) : null;
      const ratio = safeValue == null ? 0 : (safeValue - 1) / 4;
      return `<div data-maturity-point-dimension="${escapeHtml(key)}" style="--maturity-stat-ratio:${ratio}"><span>${escapeHtml(label)}</span><i aria-hidden="true"><b></b><em></em><u></u><u></u><u></u><u></u><u></u></i><strong>${safeValue == null ? "—" : escapeHtml(safeValue.toFixed(2))}</strong></div>`;
    }).join("");
  }

  function dimensionProfile(values) {
    return DIMENSIONS.map(([key, label]) => {
      const numeric = values?.[key] == null ? null : Number(values[key]);
      return { key, label, value: Number.isFinite(numeric) ? Math.max(1, Math.min(5, numeric)) : null };
    });
  }

  function profileExtremes(profile) {
    const scored = list(profile).filter((item) => item.value != null).sort((left, right) => right.value - left.value);
    return {
      strongest: scored[0] || null,
      weakest: scored[scored.length - 1] || null,
      spread: scored.length === DIMENSIONS.length ? scored[0].value - scored[scored.length - 1].value : null,
    };
  }

  function renderScoreOverview(detail, item, entry) {
    const pointResult = scoreItemResult(detail, item.id);
    const currentLevel = LEVELS.includes(pointResult?.currentLevel) ? pointResult.currentLevel : "";
    const currentIndex = pointResult?.currentIndex == null ? "—" : Number(pointResult.currentIndex).toFixed(2);
    const targetLevel = LEVELS.includes(pointResult?.targetLevel) ? pointResult.targetLevel : "";
    const targetIndex = pointResult?.targetIndex == null ? "" : Number(pointResult.targetIndex).toFixed(2);
    return `<section class="maturity-v12-score-summary maturity-v15-score-overview sapd-stat-vibrancy" data-maturity-current-summary>
      <header class="maturity-v17-score-overview-heading"><span>评估概览</span></header>
      <div class="maturity-v15-score-overview-body">
        <div class="maturity-v12-score-readout"><div><strong data-maturity-current-index>${escapeHtml(currentIndex)}</strong><span>综合得分</span></div><div><strong data-maturity-current-level>${escapeHtml(currentLevel || "—")}</strong><span>${escapeHtml(LEVEL_NAMES[currentLevel] || "成熟度待计算")}</span></div></div>
        <div class="maturity-v12-score-facts maturity-v16-score-target"><div><span>目标等级</span><strong>${escapeHtml(targetLevel ? `${targetIndex} ${targetLevel} ${LEVEL_NAMES[targetLevel]}` : "未设置")}</strong></div></div>
        <section class="maturity-v15-point-radar" aria-label="当前评估点四维雷达"><header><h3>四维雷达图</h3></header><canvas width="320" height="236" data-maturity-point-radar data-score-item-id="${escapeHtml(item.id)}" aria-label="组织、流程、工具、数据当前与目标四维得分雷达图"></canvas><div class="maturity-v15-radar-legend"><span><i></i>当前状态</span><span class="is-target"><i></i>目标状态</span></div></section>
      </div>
    </section>`;
  }

  function hierarchyResult(detail, level, id) {
    if (level === "L0") return list(detail.result?.categoryResults).find((item) => item.id === id) || null;
    if (level === "L1") return list(detail.result?.subCategoryResults).find((item) => item.id === id) || null;
    if (level === "L2") return list(detail.result?.capabilityResults).find((item) => item.id === id) || null;
    return null;
  }

  function hierarchyChildren(detail, selection) {
    const { viewLevel, viewId } = selection;
    if (viewLevel === "L0") {
      const subCategories = list(detail.result?.subCategoryResults)
        .filter((item) => item.parentId === viewId)
        .map((item) => ({ ...item, level: "L1" }));
      const directCapabilities = list(detail.result?.capabilityResults)
        .filter((item) => item.topCategoryId === viewId && !item.categoryId)
        .map((item) => ({ ...item, level: "L2" }));
      return [...subCategories, ...directCapabilities];
    }
    if (viewLevel === "L1") return list(detail.result?.capabilityResults).filter((item) => item.categoryId === viewId).map((item) => ({ ...item, level: "L2" }));
    if (viewLevel === "L2") return list(detail.result?.focusResults).filter((item) => item.capabilityId === viewId).map((item) => ({ ...item, level: "关注点" }));
    return [];
  }

  function hierarchyDimensionProfile(result) {
    return dimensionProfile(result?.dimensionResults || {});
  }

  function hierarchyLevelLabel(value, emptyLabel) {
    return LEVELS.includes(value) ? value : emptyLabel;
  }

  function renderHierarchyChildRow(item) {
    const numericCurrent = item?.currentIndex == null ? null : Number(item.currentIndex);
    const current = Number.isFinite(numericCurrent) ? Math.max(1, Math.min(5, numericCurrent)) : null;
    const ratio = current == null ? 0 : (current - 1) / 4;
    const currentLevel = hierarchyLevelLabel(item?.currentLevel, "未评分");
    const targetLevel = hierarchyLevelLabel(item?.targetLevel, "未设置");
    const targetValue = item?.targetIndex == null || !Number.isFinite(Number(item.targetIndex)) ? "" : Number(item.targetIndex).toFixed(2);
    const completed = Number(item?.completedItemCount || 0);
    const applicable = Number(item?.applicableItemCount || 0);
    const completionRate = Number(item?.completionRate || 0).toFixed(0);
    return `<div class="${current == null ? "is-unscored" : ""}" style="--maturity-child-ratio:${ratio}">
      <span>${escapeHtml(item.level)}</span>
      <div class="maturity-v14-child-identity"><strong>${escapeHtml(item.code || "自定义")} ${escapeHtml(item.name || "未命名")}</strong><div><i aria-hidden="true"><b></b><em></em></i><small>${current == null ? "未评分" : `${current.toFixed(2)} ${escapeHtml(currentLevel)}`}</small></div></div>
      <dl><div><dt>目标</dt><dd>${targetValue ? `${escapeHtml(targetValue)} ${escapeHtml(targetLevel)}` : "未设置"}</dd></div><div><dt>评估完成</dt><dd>${completed} / ${applicable || "—"}<small>${completionRate}%</small></dd></div></dl>
    </div>`;
  }

  function renderHierarchyStatistics(detail, selection, stale) {
    const { viewLevel, viewId, categories, capabilities } = selection;
    const object = viewLevel === "L2" ? capabilities.find((item) => item.id === viewId) : categories.find((item) => item.id === viewId);
    const result = hierarchyResult(detail, viewLevel, viewId);
    const progress = resultProgressCopy(result);
    const rate = progress.rate == null ? 0 : Math.max(0, Math.min(100, Number(progress.rate)));
    const completed = Number(result?.completedItemCount || 0);
    const applicable = Number(result?.applicableItemCount || 0);
    const children = hierarchyChildren(detail, selection);
    const childLabel = viewLevel === "L0" ? "下属能力域" : viewLevel === "L1" ? "归属能力" : "归属关注点";
    const childRadarTitle = `${childLabel}雷达图`;
    const currentLevel = LEVELS.includes(result?.currentLevel) ? result.currentLevel : "—";
    const targetLevel = LEVELS.includes(result?.targetLevel) ? result.targetLevel : "—";
    const scoredChildren = children.filter((item) => item.currentIndex != null && Number.isFinite(Number(item.currentIndex)));
    return `<main class="maturity-v4-score-workbench maturity-v13-hierarchy-workbench" aria-label="${escapeHtml(viewLevel)} 聚合统计">
      <header class="maturity-v13-hierarchy-heading"><div><span>${escapeHtml(viewLevel)} 评估结果</span><h2>${escapeHtml(object?.code || viewLevel)} ${escapeHtml(object?.name || "未命名")}</h2></div></header>
      <section class="maturity-v14-hierarchy-analysis maturity-v16-hierarchy-strip sapd-stat-vibrancy ${stale ? "is-stale" : ""}" aria-label="当前汇总与双雷达">
        <aside class="maturity-v14-hierarchy-insight"><header><h3>当前汇总</h3></header><div class="maturity-v14-hierarchy-readout"><div><strong>${result?.currentIndex == null ? "—" : escapeHtml(Number(result.currentIndex).toFixed(2))}</strong><span>综合得分</span></div><div><strong>${escapeHtml(currentLevel)}</strong><span>${escapeHtml(LEVEL_NAMES[currentLevel] || "成熟度待计算")}</span></div></div><dl><div class="maturity-v22-hierarchy-target"><dt>目标等级</dt><dd>${escapeHtml(targetLevel)}${LEVEL_NAMES[targetLevel] ? ` ${escapeHtml(LEVEL_NAMES[targetLevel])}` : ""}</dd></div><div><dt>完成 / 适用</dt><dd>${completed} / ${applicable || "—"}</dd></div></dl><div class="maturity-v13-achievement"><div><span>目标达成率</span><strong>${progress.rate == null ? "—" : `${Number(progress.rate).toFixed(1)}%`}</strong></div><i role="progressbar" aria-label="目标达成率" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${rate.toFixed(1)}"><b style="width:${rate}%"></b></i><small class="${progress.tone}">${escapeHtml(progress.label)}；评分完成度 ${Number(result?.completionRate || 0).toFixed(0)}%</small></div><div class="maturity-v12-score-dimension-stats" aria-label="四维聚合精确值">${renderStatisticDimensionRows(result?.dimensionResults || {})}</div></aside>
        <div class="maturity-v14-hierarchy-visual"><header><h3>四维成熟度雷达图</h3><div class="maturity-v14-hierarchy-legend"><span><i></i>当前状态</span><span class="is-target"><i></i>目标状态</span></div></header><div class="maturity-v14-hierarchy-radar"><canvas width="440" height="286" data-maturity-hierarchy-radar data-hierarchy-level="${escapeHtml(viewLevel)}" data-hierarchy-id="${escapeHtml(viewId)}" aria-label="${escapeHtml(viewLevel)} 当前与目标四维成熟度雷达图"></canvas></div></div>
        <section class="maturity-v15-child-radar-panel" aria-label="${escapeHtml(childRadarTitle)}">
        <header><h3>${escapeHtml(childRadarTitle)}</h3><div class="maturity-v15-radar-legend"><span><i></i>当前结果</span><span class="is-target"><i></i>目标等级</span><small>${scoredChildren.length} / ${children.length} 已评分，未评分留空</small></div></header>
        ${children.length >= 3 ? `<canvas width="820" height="360" data-maturity-child-radar data-hierarchy-level="${escapeHtml(viewLevel)}" data-hierarchy-id="${escapeHtml(viewId)}" aria-label="${escapeHtml(childLabel)}直接下级成熟度雷达图"></canvas>` : `<div class="maturity-v1-empty-inline">直接下级少于 3 个，保留精确比较列表，不生成可能误导的雷达形状。</div>`}
        </section>
      </section>
      <section class="maturity-v13-hierarchy-children" aria-label="${escapeHtml(childLabel)}统计"><header><div><span>${escapeHtml(childLabel)}比较</span><strong>${children.length} 个对象</strong></div></header>${children.length ? `<div class="maturity-v13-child-list">${children.map(renderHierarchyChildRow).join("")}</div>` : `<div class="maturity-v1-table-empty"><strong>当前层级没有可统计的下级对象</strong></div>`}</section>
    </main>`;
  }

  function renderL2Summary(capability, result, stale) {
    const currentLevel = LEVELS.includes(result?.currentLevel) ? result.currentLevel : "未评分";
    const targetLevel = LEVELS.includes(result?.targetLevel) ? result.targetLevel : "未设置";
    const completed = Number(result?.completedItemCount || 0);
    const applicable = Number(result?.applicableItemCount || 0);
    const notApplicable = Number(result?.notApplicableItemCount || 0);
    const total = applicable + notApplicable;
    return `<section class="maturity-v3-l2-summary sapd-stat-vibrancy ${stale ? "is-stale" : ""}" aria-label="当前能力 L2 汇总">
      <div class="maturity-v3-l2-identity"><h3>${escapeHtml(capability.code || "自定义 L2")} ${escapeHtml(capability.name)}</h3></div>
      <dl class="maturity-v22-maturity-summary"><div class="is-current"><dt>当前成熟度</dt><dd>${renderLevelScore(currentLevel, result?.currentIndex)}</dd></div><div class="is-target"><dt>目标成熟度</dt><dd>${renderLevelScore(targetLevel, result?.targetIndex, "目标指数")}</dd></div></dl>
      <div class="maturity-v3-dimension-summary maturity-v19-dimension-summary"><span>评估维度均值</span>${renderDimensionSummary(result)}</div>
      <div class="maturity-v22-point-summary"><span>评估点情况</span><div><div class="maturity-v20-applicability-summary" data-maturity-l2-applicability><span>适用性</span><strong>${applicable} / ${total || "—"}</strong><small>适用评估点 / 全部评估点</small></div><div class="maturity-v20-completion-summary"><span>评估进度</span><strong>${completed} / ${applicable || "—"}</strong><small>已完成 / 适用评估点</small></div></div></div>
    </section>`;
  }

  function renderScoreDirectoryRow({ level, item, state, expanded = false, hasChildren = false, active = false, action, dataName }) {
    const visibleLevel = level === "FOCUS" ? "关注点" : level;
    const label = `${item.code || `自定义 ${visibleLevel}`} ${item.name || "未命名"}`.trim();
    return `<div class="maturity-v4-directory-row is-${escapeHtml(level.toLowerCase())} ${active ? "is-active" : ""}">
      ${hasChildren ? `<button class="maturity-v4-directory-toggle" type="button" data-maturity-action="toggle-score-hierarchy" data-hierarchy-level="${escapeHtml(level)}" data-hierarchy-id="${escapeHtml(item.id)}" aria-expanded="${expanded}" aria-label="${expanded ? "收起" : "展开"}${escapeHtml(label)}">${expanded ? "⌄" : "›"}</button>` : `<span class="maturity-v4-directory-spacer"></span>`}
      <button class="maturity-v4-directory-node" type="button" data-maturity-action="${escapeHtml(action)}" ${dataName}="${escapeHtml(item.id)}" aria-pressed="${active}">
        ${renderScoreProgressState(state, { iconOnly: true })}
        <span class="maturity-v4-directory-level">${escapeHtml(visibleLevel)}</span>
        <span class="maturity-v4-directory-label"><b>${escapeHtml(item.code || `自定义 ${visibleLevel}`)}</b><em>${escapeHtml(item.name || "未命名")}</em></span>
        <small>${escapeHtml(state.count)}</small>
      </button>
    </div>`;
  }

  function renderScoreDirectory(detail, selection, serviceById, directoryUi) {
    const { active, categories, capabilities, viewLevel, viewId } = selection;
    const categoryById = new Map(categories.map((item) => [item.id, item]));
    const focusById = new Map(active.focuses.map((item) => [item.id, item]));
    const capabilityById = new Map(capabilities.map((item) => [item.id, item]));
    const filtersActive = Boolean(text(model.scoringSearch).trim() || model.scoringStatus !== "all" || model.scoringEvidence !== "all");
    const visibleItems = filtersActive
      ? active.scoreItems.filter((item) => scoreItemMatchesFilters(detail, item, focusById.get(item.focusId) || {}, capabilityById.get(item.capabilityId) || {}, serviceById.get(item.serviceId)))
      : active.scoreItems;
    const visibleItemIds = new Set(visibleItems.map((item) => item.id));
    const hasVisibleItems = (items) => list(items).some((item) => visibleItemIds.has(item.id));
    const itemsForFocus = (focusId) => byTemplateOrder(active.scoreItems.filter((item) => item.focusId === focusId));
    const itemsForCapability = (capabilityId) => byTemplateOrder(active.scoreItems.filter((item) => item.capabilityId === capabilityId));
    const capabilitiesForCategory = (categoryId) => byTemplateOrder(capabilities.filter((item) => item.categoryId === categoryId));
    const childL1 = (l0Id) => byTemplateOrder(categories.filter((item) => categoryCapabilityLevel(item) === "L1" && item.parentId === l0Id));
    const itemsForL1 = (l1Id) => capabilitiesForCategory(l1Id).flatMap((item) => itemsForCapability(item.id));
    const itemsForL0 = (l0Id) => childL1(l0Id).flatMap((item) => itemsForL1(item.id));
    const expanded = hierarchyExpansion(detail);
    const rowOpen = (level, id) => filtersActive || expanded.has(hierarchyKey(level, id));
    const renderFocusRows = (capabilityRow) => byTemplateOrder(active.focuses.filter((item) => item.capabilityId === capabilityRow.id && hasVisibleItems(itemsForFocus(item.id))))
      .map((focusRow) => renderScoreDirectoryRow({ level: "FOCUS", item: focusRow, state: scoreProgressState(detail, itemsForFocus(focusRow.id)), active: viewLevel === "FOCUS" && focusRow.id === viewId, action: "select-focus", dataName: "data-focus-id" }))
      .join("");
    const renderCapabilityRows = (l1Row) => capabilitiesForCategory(l1Row.id)
      .filter((capabilityRow) => hasVisibleItems(itemsForCapability(capabilityRow.id)))
      .map((capabilityRow) => {
        const open = rowOpen("L2", capabilityRow.id);
        return `${renderScoreDirectoryRow({ level: "L2", item: capabilityRow, state: scoreProgressState(detail, itemsForCapability(capabilityRow.id)), expanded: open, hasChildren: true, active: viewLevel === "L2" && capabilityRow.id === viewId, action: "select-capability", dataName: "data-capability-id" })}${open ? `<div class="maturity-v4-directory-children">${renderFocusRows(capabilityRow)}</div>` : ""}`;
      }).join("");
    const renderL1Rows = (l0Row) => childL1(l0Row.id)
      .filter((l1Row) => hasVisibleItems(itemsForL1(l1Row.id)))
      .map((l1Row) => {
        const open = rowOpen("L1", l1Row.id);
        const activeL1 = viewLevel === "L1" && l1Row.id === viewId;
        return `${renderScoreDirectoryRow({ level: "L1", item: l1Row, state: scoreProgressState(detail, itemsForL1(l1Row.id)), expanded: open, hasChildren: true, active: activeL1, action: "select-score-l1", dataName: "data-category-id" })}${open ? `<div class="maturity-v4-directory-children">${renderCapabilityRows(l1Row)}</div>` : ""}`;
      }).join("");
    const l0Rows = byTemplateOrder(categories.filter((item) => categoryCapabilityLevel(item) === "L0"))
      .filter((l0Row) => hasVisibleItems(itemsForL0(l0Row.id)))
      .map((l0Row) => {
        const open = rowOpen("L0", l0Row.id);
        return `${renderScoreDirectoryRow({ level: "L0", item: l0Row, state: scoreProgressState(detail, itemsForL0(l0Row.id)), expanded: open, hasChildren: true, active: viewLevel === "L0" && l0Row.id === viewId, action: "select-score-l0", dataName: "data-category-id" })}${open ? `<div class="maturity-v4-directory-children">${renderL1Rows(l0Row)}</div>` : ""}`;
      }).join("");
    const orphanL1Rows = byTemplateOrder(categories.filter((item) => categoryCapabilityLevel(item) === "L1" && !categoryById.has(item.parentId)))
      .filter((item) => hasVisibleItems(itemsForL1(item.id)))
      .map((item) => {
        const open = rowOpen("L1", item.id);
        return `${renderScoreDirectoryRow({ level: "L1", item, state: scoreProgressState(detail, itemsForL1(item.id)), expanded: open, hasChildren: true, active: viewLevel === "L1" && item.id === viewId, action: "select-score-l1", dataName: "data-category-id" })}${open ? `<div class="maturity-v4-directory-children">${renderCapabilityRows(item)}</div>` : ""}`;
      }).join("");
    return `<aside class="maturity-v4-score-directory shell-directory-pane shell-directory-pane-has-meta" aria-label="成熟度评分能力目录" aria-hidden="${directoryUi.collapsed}">
      <header class="pane-head shell-directory-head"><div class="shell-directory-copy"><strong class="shell-directory-title">评分目录</strong><span class="shell-directory-meta">安全能力映射结构</span></div><div class="maturity-v4-score-directory-actions shell-directory-actions"><small class="shell-directory-meta">${capabilities.length} 个 L2 能力</small><button class="maturity-v1-button is-secondary maturity-v4-directory-collapse-button shell-directory-action" type="button" data-maturity-action="toggle-score-directory" aria-expanded="true" title="收起评分目录">收起目录</button></div></header>
      <div class="maturity-v4-score-legend" aria-label="评分状态图例">${renderScoreProgressState({ key: "complete", label: "已完成", count: "" }, { compact: true })}${renderScoreProgressState({ key: "in-progress", label: "进行中", count: "" }, { compact: true })}${renderScoreProgressState({ key: "not-started", label: "未开始", count: "" }, { compact: true })}</div>
      <div class="maturity-v4-directory-tree shell-directory-tree">${l0Rows}${orphanL1Rows}${l0Rows || orphanL1Rows ? "" : `<div class="maturity-v1-table-empty"><strong>没有符合条件的目录节点</strong><button class="maturity-v1-button is-secondary" type="button" data-maturity-action="clear-score-filters">清空筛选</button></div>`}</div>
    </aside>`;
  }

  function scoreItemMatchesFilters(detail, item, focus, capability, service) {
    const entry = scoreEntry(detail, item.id);
    const search = text(model.scoringSearch).trim().toLowerCase();
    if (search && ![focus.code, focus.name, capability.code, capability.name, service?.code, service?.name, item.scopeCode, item.scopeName].join(" ").toLowerCase().includes(search)) return false;
    if (model.scoringStatus === "unscored" && entryIsComplete(entry)) return false;
    if (model.scoringStatus === "complete" && (entry.isApplicable === false || !entryIsComplete(entry))) return false;
    if (model.scoringStatus === "na" && entry.isApplicable !== false) return false;
    if (model.scoringEvidence === "missing" && entry.isApplicable !== false && entry.evidenceLevel && entry.evidenceLevel !== "E0") return false;
    return true;
  }

  function renderScoringTab(detail) {
    const selection = scoringSelection(detail);
    const { active, capability, focus, scoreItems, scoreItem, viewLevel } = selection;
    if (!capability) return `<div class="maturity-v1-empty">当前模板没有可评分能力。</div>`;
    const directoryUi = scoreDirectoryUi(detail);
    const serviceById = new Map(list(detail.template.services).map((item) => [item.id, item]));
    const capabilityResult = list(detail.result?.capabilityResults).find((item) => item.id === capability.id);
    const summary = summaryOf(detail);
    const stale = Boolean(detail.resultStale || model.calculating);
    const currentFocusItems = scoreItems;
    const sourceMode = currentFocusItems.some((item) => item.itemType === "SERVICE") ? "CHILD_ROLLUP" : "DIRECT";
    const directFocusAssessment = sourceMode === "DIRECT" && currentFocusItems.length === 1;
    const focusBatch = focusBatchState(detail, currentFocusItems);
    const focusState = scoreProgressState(detail, currentFocusItems);
    const focusEntries = currentFocusItems.map((item) => scoreEntry(detail, item.id));
    const focusTotalCount = focusEntries.length;
    const focusApplicableCount = focusEntries.filter((entry) => entry.isApplicable !== false).length;
    const focusCompletedApplicableCount = currentFocusItems.filter((item) => {
      const entry = scoreEntry(detail, item.id);
      return entry.isApplicable !== false && scorePointIsComplete(detail, item.id, entry);
    }).length;
    const focusAllNotApplicable = Boolean(focusEntries.length && focusEntries.every((entry) => entry.isApplicable === false));
    const focusPartiallyApplicable = Boolean(!focusAllNotApplicable && focusEntries.some((entry) => entry.isApplicable === false));
    const focusNaReason = focusAllNotApplicable ? text(focusEntries.find((entry) => text(entry.naReason).trim())?.naReason).trim() : "";
    const serviceTabDensity = currentFocusItems.length <= 3 ? "is-sparse" : "is-dense";
    const serviceTabs = currentFocusItems.map((item) => {
      const service = serviceById.get(item.serviceId);
      const activeItem = item.id === scoreItem?.id;
      const state = scoreProgressState(detail, [item]);
      const itemLabel = item.itemType === "SERVICE" ? `${service?.code || ""} ${service?.name || "安全技术服务"}`.trim() : `${focus?.code || ""} 关注点自身`.trim();
      const entry = scoreEntry(detail, item.id);
      const applicable = entry.isApplicable !== false;
      return `<div class="maturity-v5-service-tab-item ${activeItem ? "is-active" : ""}"><button class="maintenance-section-tab maturity-v4-service-tab ${activeItem ? "active is-active" : ""}" type="button" role="tab" aria-selected="${activeItem}" aria-label="${escapeHtml(`${state.label} ${itemLabel}`)}" title="${escapeHtml(`${state.label} · ${itemLabel}`)}" data-maturity-action="select-score-item" data-score-item-id="${escapeHtml(item.id)}"><span class="maturity-v4-service-tab-dot is-${escapeHtml(state.key)}" aria-hidden="true"></span><strong>${escapeHtml(itemLabel)}</strong></button><label class="maturity-v5-service-tab-applicability" title="${escapeHtml(`${itemLabel}是否适用`)}"><input type="checkbox" data-score-applicability data-score-item-id="${escapeHtml(item.id)}" ${applicable ? "checked" : ""} ${detail.project.readOnly ? "disabled" : ""} aria-label="${escapeHtml(`${itemLabel}是否适用`)}" /><span aria-hidden="true">✓</span></label></div>`;
    }).join("");
    return `<section class="maturity-v3-scoring-workspace" data-maturity-v3-scoring>
      <div class="maturity-v3-page-status" aria-label="评分进度与保存状态"><strong>${summary.scoredItemCount || 0} / ${summary.applicableItemCount || active.scoreItems.length}</strong><span>个适用评估点 · ${Number(summary.completionRate || 0).toFixed(0)}% 已完成</span><i>·</i><span class="${detail.localSaveState === "error" ? "is-error" : "is-saved"}">${detail.localSaveState === "error" ? "保存失败" : model.calculating ? "已保存，正在试算" : stale ? "已保存，等待汇总" : "已自动保存"}</span></div>
      <div class="maturity-v4-scoring-shell ${directoryUi.collapsed ? "is-directory-collapsed" : ""}" style="--maturity-score-directory-width:${clampScoreDirectoryWidth(directoryUi.width)}px">
        <button class="maturity-v1-button is-secondary maturity-v4-directory-expand-tab" type="button" data-maturity-action="toggle-score-directory" aria-expanded="false" title="展开评分目录" ${directoryUi.collapsed ? "" : "hidden"}>目录</button>
        ${renderScoreDirectory(detail, selection, serviceById, directoryUi)}
        <div class="maturity-v4-directory-resizer shell-directory-resizer" data-maturity-score-directory-resizer role="separator" aria-orientation="vertical" aria-label="调整评分目录宽度" aria-valuemin="${SCORE_DIRECTORY_MIN_WIDTH}" aria-valuemax="${SCORE_DIRECTORY_MAX_WIDTH}" aria-valuenow="${clampScoreDirectoryWidth(directoryUi.width)}" tabindex="0" title="拖动调整目录宽度"></div>
        ${viewLevel !== "FOCUS" ? renderHierarchyStatistics(detail, selection, stale) : `<main class="maturity-v4-score-workbench" aria-label="当前评分工作台">
          <div class="maturity-v23-score-context" data-maturity-fixed-score-context>
          ${renderL2Summary(capability, capabilityResult, stale)}
          <section class="maturity-v4-focus-context" aria-label="当前关注点摘要">
            <div class="maturity-v18-focus-copy"><header class="maturity-v18-focus-heading"><h3>${escapeHtml(focus?.code || "-")} ${escapeHtml(focus?.name || "请选择关注点")}</h3><label class="maturity-v4-focus-applicability"><input type="checkbox" data-focus-applicability-toggle data-focus-id="${escapeHtml(focus?.id || "")}" ${focusAllNotApplicable ? "" : "checked"} ${detail.project.readOnly ? "disabled" : ""} /><span>适用性</span><strong>${focusAllNotApplicable ? "不适用" : focusPartiallyApplicable ? "部分适用" : "适用"}</strong></label></header><p>${escapeHtml(focus?.description || "暂无关注点定义")}</p></div>
            <div class="maturity-v5-focus-status-panel">
              <div class="maturity-v5-focus-status-head">${renderScoreProgressState(focusState, { compact: true })}</div>
              <dl class="maturity-v5-focus-stats maturity-v17-focus-stats"><div><dt>完成</dt><dd>${focusCompletedApplicableCount}/${focusApplicableCount}</dd></div><div><dt>适用性</dt><dd>${focusApplicableCount}/${focusTotalCount}</dd></div></dl>
              <div class="maturity-v5-focus-batch-state">${sourceMode === "CHILD_ROLLUP" ? `<button class="maturity-v1-link-button" type="button" data-maturity-action="toggle-focus-batch" title="${escapeHtml(focusBatch.reason)}">下级评估设置</button><span title="${escapeHtml(focusBatch.reason)}"><i aria-hidden="true"></i>${focusBatch.hasAnyScore || focusBatch.hasAnyTarget ? `已有${focusBatch.hasAnyScore ? "评分" : ""}${focusBatch.hasAnyScore && focusBatch.hasAnyTarget ? "与" : ""}${focusBatch.hasAnyTarget ? "目标" : ""}` : "下级尚未设置"}</span>` : `<span>关注点直接评估</span>`}</div>
            </div>
          </section>
          ${focusAllNotApplicable ? `<label class="maturity-v4-focus-na-reason"><span>不适用说明（可选）</span><textarea rows="2" data-focus-na-reason data-focus-id="${escapeHtml(focus?.id || "")}" ${detail.project.readOnly ? "disabled" : ""} placeholder="可记录该关注点不适用于本次评估的原因">${escapeHtml(focusNaReason)}</textarea><small>不适用项退出评分与聚合；说明用于复核参考，不阻塞完成评估。</small></label>` : ""}
          ${model.focusBatchOpen && sourceMode === "CHILD_ROLLUP" ? renderFocusBatchControls(detail, focus, currentFocusItems, focusBatch) : ""}
          ${directFocusAssessment ? "" : `<div class="maturity-v4-service-tab-strip"><nav class="maintenance-section-tabs maturity-v4-service-tabs ${serviceTabDensity}" data-service-tab-count="${currentFocusItems.length}" role="tablist" aria-label="当前关注点安全技术服务">${serviceTabs || `<span>当前关注点没有可评分服务。</span>`}</nav></div>`}
          </div>
          <article class="maturity-v3-score-form" data-score-item-id="${escapeHtml(scoreItem?.id || "")}">${renderScoreInspector(detail, scoreItem, focus)}</article>
        </main>`}
      </div>
    </section>`;
  }

  function renderScoreRow(detail, item, focus, currentEntry, selected) {
    const entry = currentEntry || scoreEntry(detail, item.id);
    const applicable = entry.isApplicable !== false;
    const pointResult = scoreItemResult(detail, item.id);
    const currentLevel = pointResult?.currentLevel || "";
    const service = list(detail.template.services).find((candidate) => candidate.id === item.serviceId);
    const rowLabel = item.itemType === "SERVICE" ? `${service?.code || ""} ${service?.name || "安全技术服务"}`.trim() : "关注点评估点";
    const status = scoreEntryStatusLabel(entry);
    const elementValues = entry.reviewElements && Object.keys(entry.reviewElements).length ? entry.reviewElements : entry.elements || {};
    return `<tr class="maturity-v2-score-item-row ${selected ? "is-selected" : ""} ${!applicable ? "is-not-applicable" : ""}" data-score-item-id="${escapeHtml(item.id)}">
      <td><button class="maturity-v2-score-item-toggle" type="button" data-maturity-action="select-score-item" data-score-item-id="${escapeHtml(item.id)}" aria-expanded="${selected}"><strong>${escapeHtml(rowLabel)}</strong><span>${item.itemType === "SERVICE" ? "安全技术服务评估点" : "关注点整体评估"}</span></button></td>
      <td>${item.itemType === "SERVICE" ? `<span class="maturity-v1-scope" data-scope="${escapeHtml(item.scopeCode || "ALL")}">${escapeHtml(item.scopeCode || "ALL")}</span><small>${escapeHtml(item.scopeName || "全部作用域")}</small>` : `<span class="maturity-v1-row-status is-muted">关注点</span><small>关注点整体</small>`}</td>
      <td><label class="maturity-v3-applicability-check"><input type="checkbox" data-score-applicability data-score-item-id="${escapeHtml(item.id)}" ${applicable ? "checked" : ""} ${detail.project.readOnly ? "disabled" : ""} aria-label="${escapeHtml(rowLabel)}是否适用" /><span>适用</span></label></td>
      ${DIMENSIONS.map(([key, label]) => `<td><select class="maturity-v2-dimension-select" data-score-dimension="${key}" data-score-item-id="${escapeHtml(item.id)}" ${!applicable || detail.project.readOnly ? "disabled" : ""} aria-label="${escapeHtml(rowLabel)}${escapeHtml(label)}评分">${levelOptions(elementValues[key], { includeEmpty: true, compact: true })}</select></td>`).join("")}
      <td><span class="maturity-v1-level ${levelTone(currentLevel)}">${escapeHtml(applicable ? currentLevel || "未计算" : "不计分")}</span><small>${!applicable ? "已退出计算" : pointResult?.currentIndex == null ? "四维完成后计算" : `${pointResult.currentIndex} / ${pointResult.currentPercent}`}</small></td>
      <td><span>${DIMENSIONS.map(([key]) => escapeHtml(entry.targetElements?.[key] || "-")).join(" / ")}</span><small>${!applicable ? "无需设置" : pointResult?.targetAchievementRate == null ? "待计算达成率" : `综合 ${escapeHtml(pointResult.targetLevel || "-")} · 达成 ${Number(pointResult.targetAchievementRate).toFixed(0)}%`}</small></td>
      <td><span class="maturity-v1-row-status ${status.includes("待") || status.includes("填写中") ? "is-warn" : status === "未评分" || !applicable ? "is-muted" : "is-good"}">${status}</span><small>${entry.lastUpdateScope === "FOCUS_BATCH" ? "关注点带入" : entry.lastUpdateScope === "FOCUS_CLEAR" ? "已清空下级评分" : entry.lastUpdateScope === "ITEM" ? "单项调整" : detail.lastSavedAt ? "已保存" : ""}</small></td>
    </tr>${selected ? `<tr class="maturity-v2-inline-score-row"><td colspan="10"><div class="maturity-v1-score-inspector">${renderScoreInspector(detail, item, focus)}</div></td></tr>` : ""}`;
  }

  function renderFocusBatchControls(detail, focus, items, batch = focusBatchState(detail, items)) {
    if (!focus) return "";
    const ticks = LEVELS.map(() => `<span><i></i></span>`).join("");
    const renderBatchRow = ({ state, level, minimumLevel = "L1", maximumLevel = "L5", currentMaximumLevel = "", targetMinimumLevel = "", kind, title, clearAction, applyAction, clearLabel, applyLabel, confirmId, confirmAction, cancelAction }) => {
      const index = LEVELS.indexOf(level);
      const isTarget = kind === "target";
      const rangeUnavailable = !minimumLevel || !maximumLevel;
      const minimumIndex = minimumLevel ? Math.max(0, LEVELS.indexOf(minimumLevel)) : isTarget ? LEVELS.length - 1 : 0;
      const maximumIndex = maximumLevel ? Math.max(0, LEVELS.indexOf(maximumLevel)) : isTarget ? LEVELS.length - 1 : 0;
      const sliderHint = rangeUnavailable
        ? "当前没有有效的统一设置等级"
        : isTarget
          ? `${state.canApply ? "" : "清空后可重设；"}目标状态不能低于下级当前最高等级 ${currentMaximumLevel}`
          : targetMinimumLevel
            ? `${state.canApply ? "" : "清空后可重设；"}当前状态不能高于下级已有最低目标等级 ${targetMinimumLevel}`
          : state.canApply
            ? "拖动滑块选择统一等级"
            : "清空下级当前评分后可重新设置";
      const canApply = state.canApply && !rangeUnavailable;
      return `<div class="maturity-v33-focus-batch-row is-${kind}"><div class="maturity-v33-focus-batch-label"><strong>${title}</strong><span>${state.hasAny ? `下级已有${isTarget ? "目标" : "当前评分"}，清空后可重新统一设置。` : `下级尚未设置${isTarget ? "目标" : "当前评分"}。`}</span></div><div class="maturity-v9-score-slider maturity-v10-batch-slider has-value ${canApply ? "" : "is-locked"}" style="--maturity-score-progress:${index * 25}%;--maturity-score-ratio:${index / 4}"><div class="maturity-v9-score-slider-copy"><strong data-focus-batch-slider-label="${kind}">${escapeHtml(level)} ${escapeHtml(LEVEL_NAMES[level])}</strong><span>${escapeHtml(sliderHint)}</span></div><div class="maturity-v9-score-slider-track"><span class="maturity-v9-score-slider-base"></span><span class="maturity-v9-score-slider-start-fill"></span><span class="maturity-v9-score-slider-fill"></span><span class="maturity-v9-score-slider-ticks" aria-hidden="true">${ticks}</span><input type="range" min="1" max="5" step="1" value="${index + 1}" data-maturity-focus-batch-slider="${kind}" data-maturity-min-level="${minimumIndex + 1}" data-maturity-max-level="${maximumIndex + 1}" aria-label="${title}统一等级" aria-valuemin="${minimumIndex + 1}" aria-valuemax="${maximumIndex + 1}" aria-valuetext="${escapeHtml(`${level} ${LEVEL_NAMES[level]}`)}" ${canApply ? "" : "disabled"} /></div></div><div class="maturity-v10-focus-batch-actions"><small>${batch.hasServiceItems ? `作用于当前关注点 ${batch.serviceItemCount} 个下级评估点。` : batch.reason}</small><div><button class="maturity-v1-button is-secondary is-danger" type="button" data-maturity-action="${clearAction}" data-focus-id="${escapeHtml(focus.id)}" ${state.canClear ? "" : "disabled"}>${clearLabel}</button><button class="maturity-v1-button is-primary ${isTarget ? "is-target-action" : ""}" type="button" data-maturity-action="${applyAction}" data-focus-id="${escapeHtml(focus.id)}" ${canApply ? "" : "disabled"}>${applyLabel}</button></div>${confirmId === focus.id ? `<div class="maturity-v11-focus-clear-confirm" role="alert"><strong>确认${clearLabel}？</strong><span>${isTarget ? "此操作只清除目标等级与目标说明，保留当前评分、适用性和证据。" : "此操作只清除当前四维评分，保留目标、适用性和证据。"}</span><div><button class="maturity-v1-button is-secondary" type="button" data-maturity-action="${cancelAction}">取消</button><button class="maturity-v1-button is-primary is-danger" type="button" data-maturity-action="${confirmAction}" data-focus-id="${escapeHtml(focus.id)}">确认清空</button></div></div>` : ""}</div></div>`;
    };
    const existingTargetMinimumLevel = focusExistingTargetMinimumLevel(detail, items);
    const currentMaximumAllowedLevel = focusCurrentMaximumAllowedLevel(detail, items);
    const currentMaximumLevel = focusCurrentMaximumLevel(detail, items);
    const requestedCurrentLevel = LEVELS.includes(model.focusBatchLevel) ? model.focusBatchLevel : "L3";
    const currentLevel = batch.current.hasAny
      ? currentMaximumLevel
      : currentMaximumAllowedLevel
        ? LEVELS[Math.min(LEVELS.indexOf(requestedCurrentLevel), LEVELS.indexOf(currentMaximumAllowedLevel))]
        : "L1";
    model.focusBatchLevel = currentLevel;
    const targetMinimumLevel = focusTargetMinimumLevel(detail, items);
    const requestedTargetLevel = LEVELS.includes(model.focusTargetBatchLevel) ? model.focusTargetBatchLevel : "L3";
    const targetLevel = batch.target.hasAny && existingTargetMinimumLevel
      ? existingTargetMinimumLevel
      : targetMinimumLevel
        ? LEVELS[Math.max(LEVELS.indexOf(requestedTargetLevel), LEVELS.indexOf(targetMinimumLevel))]
        : "L5";
    model.focusTargetBatchLevel = targetLevel;
    return `<section class="maturity-v3-focus-batch maturity-v33-focus-batch" aria-label="当前关注点下级评估设置"><header><strong>下级评估设置</strong><span>分别统一设置下级当前状态与目标状态；两类数据独立清空、互不影响。</span></header>${renderBatchRow({ state: batch.current, level: currentLevel, maximumLevel: currentMaximumAllowedLevel, targetMinimumLevel: existingTargetMinimumLevel, kind: "current", title: "下级当前状态设置", clearAction: "request-clear-focus-scores", applyAction: "apply-focus-batch-level", clearLabel: "清空下级所有评分", applyLabel: "统一设置下级当前状态", confirmId: model.focusBatchClearConfirmId, confirmAction: "confirm-clear-focus-scores", cancelAction: "cancel-clear-focus-scores" })}${renderBatchRow({ state: batch.target, level: targetLevel, minimumLevel: targetMinimumLevel, currentMaximumLevel, kind: "target", title: "下级目标状态设置", clearAction: "request-clear-focus-targets", applyAction: "apply-focus-target-batch-level", clearLabel: "清空下级所有目标", applyLabel: "统一设置下级目标状态", confirmId: model.focusTargetClearConfirmId, confirmAction: "confirm-clear-focus-targets", cancelAction: "cancel-clear-focus-targets" })}</section>`;
  }

  function focusBatchState(detail, items) {
    const serviceItems = list(items).filter((item) => item.itemType === "SERVICE");
    const applicableServiceItems = serviceItems.filter((item) => scoreEntry(detail, item.id).isApplicable !== false);
    const hasAnyScore = serviceItems.some((item) => {
      const entry = scoreEntry(detail, item.id);
      return DIMENSIONS.some(([key]) => LEVELS.includes(entry.elements?.[key]) || LEVELS.includes(entry.reviewElements?.[key]));
    });
    const hasAnyTarget = serviceItems.some((item) => {
      const entry = scoreEntry(detail, item.id);
      return DIMENSIONS.some(([key]) => LEVELS.includes(entry.targetElements?.[key]));
    });
    const hasAllScores = applicableServiceItems.length > 0 && applicableServiceItems.every((item) => {
      const entry = scoreEntry(detail, item.id);
      return DIMENSIONS.every(([key]) => LEVELS.includes(currentDimensionLevel(entry, key)));
    });
    const hasAllTargets = applicableServiceItems.length > 0 && applicableServiceItems.every((item) => {
      const entry = scoreEntry(detail, item.id);
      return DIMENSIONS.every(([key]) => LEVELS.includes(entry.targetElements?.[key]));
    });
    const hasServiceItems = serviceItems.length > 0;
    const mutable = Boolean(hasServiceItems && !detail.project.readOnly);
    return {
      allowed: Boolean(mutable && !hasAnyScore),
      canApply: Boolean(mutable && !hasAnyScore),
      canClear: Boolean(mutable && hasAnyScore),
      hasAnyScore,
      hasAnyTarget,
      hasServiceItems,
      serviceItemCount: serviceItems.length,
      current: { hasAny: hasAnyScore, hasAll: hasAllScores, canApply: Boolean(mutable && !hasAnyScore), canClear: Boolean(mutable && hasAnyScore) },
      target: { hasAny: hasAnyTarget, hasAll: hasAllTargets, canApply: Boolean(mutable && !hasAnyTarget), canClear: Boolean(mutable && hasAnyTarget), reason: !hasServiceItems ? "当前关注点没有下级安全技术服务。" : detail.project.readOnly ? "当前项目已锁定，只能查看下级目标状态设置。" : hasAnyTarget ? "下级已有目标，清空后才能再次统一设置。" : "下级尚未设置目标，可以统一设置。" },
      reason: !hasServiceItems
        ? "当前关注点没有下级安全技术服务。"
        : detail.project.readOnly
          ? "当前项目已锁定，只能查看下级评估设置。"
          : hasAnyScore
            ? "下级已有评分，清空后才能再次统一设置。"
            : "下级均未评分，可以统一设置一个初始等级。",
    };
  }

  function renderScoreInspector(detail, item, focus) {
    if (!item || !focus) return `<div class="maturity-v1-table-empty">选择一个评估点查看四维评分、目标和证据。</div>`;
    const entry = scoreEntry(detail, item.id);
    const applicable = entry.isApplicable !== false;
    const targetConflict = scoreTargetConflict(detail, item.id);
    const service = list(detail.template.services).find((candidate) => candidate.id === item.serviceId);
    const serviceById = new Map(list(detail.template.services).map((candidate) => [candidate.id, candidate]));
    const platformReferences = list(detail.template.focusServiceMappings)
      .filter((mapping) => mapping.focusId === focus.id && mapping.serviceRole === "PLATFORM_EVIDENCE_REFERENCE")
      .map((mapping) => ({ mapping, service: serviceById.get(mapping.serviceId) || {} }));
    return `<div class="maturity-v3-score-form-inner ${applicable ? "" : "is-not-applicable"}">
      ${platformReferences.length ? `<details class="maturity-v2-platform-references"><summary>平台与工具评估参考（不单独计分）</summary>${platformReferences.map(({ mapping, service: reference }) => `<div><strong>${escapeHtml(reference.code || "")} ${escapeHtml(reference.name || "安全技术服务")}</strong><small>${escapeHtml(mapping.scopeCode || "")}${mapping.scopeName ? ` · ${escapeHtml(mapping.scopeName)}` : ""}</small></div>`).join("")}</details>` : ""}
      ${applicable ? "" : `<label class="maturity-v3-na-reason"><span>不适用说明（可选）</span><textarea rows="3" data-score-text="naReason" data-score-item-id="${escapeHtml(item.id)}" ${detail.project.readOnly ? "disabled" : ""} placeholder="可记录该服务或关注点不适用于本次企业组织评估的原因">${escapeHtml(entry.naReason || "")}</textarea></label>`}
      <div class="maturity-v12-score-layout">
        <div class="maturity-v12-score-dimensions">
          ${renderElementControls(detail, item, entry)}
          ${targetConflict ? `<section class="maturity-v15-assessment-details maturity-v33-target-validation" aria-label="目标校验"><div class="maturity-v21-target-conflict" role="alert"><strong>目标等级设置冲突</strong><span>当前四维评分由后端计算为 ${escapeHtml(targetConflict.currentLevel)} ${targetConflict.currentIndex == null ? "" : escapeHtml(Number(targetConflict.currentIndex).toFixed(2))}，目标等级不能低于 ${escapeHtml(targetConflict.minimumTargetLevel || targetConflict.currentLevel)}。请先修改目标等级，才能切换到其他评估点。</span></div></section>` : ""}
          <details class="maturity-v3-secondary-fields maturity-v15-secondary-fields"><summary>证据等级与评分备注</summary><div><label><span>证据等级（可选）</span><select data-score-field="evidenceLevel" data-score-item-id="${escapeHtml(item.id)}" ${detail.project.readOnly || !applicable ? "disabled" : ""}>${evidenceOptions(entry.evidenceLevel || "E0")}</select></label><label><span>评分备注</span><textarea rows="2" data-score-text="note" data-score-item-id="${escapeHtml(item.id)}" ${detail.project.readOnly ? "disabled" : ""}>${escapeHtml(entry.note || "")}</textarea></label></div></details>
        </div>
        <aside class="maturity-v12-score-side" aria-label="当前评分概览">${renderScoreOverview(detail, item, entry)}</aside>
      </div>
      <footer class="maturity-v3-score-footer"><span>不适用项不会进入评分、聚合或完成率分母。</span><small aria-live="polite">${detail.localSaveState === "error" ? "保存失败，请重试" : model.calculating ? "正在保存并试算" : detail.resultStale ? "已保存，等待汇总" : "已保存"}</small><button class="maturity-v1-button is-primary" type="button" data-maturity-action="next-score-item" data-score-item-id="${escapeHtml(item.id)}">保存并转到下一项</button></footer>
    </div>`;
  }

  function rubricRows(item, dimension) {
    return list(item?.rubricEntries)
      .filter((entry) => entry.dimensionCode === dimension && LEVELS.includes(entry.level) && text(entry.criteria))
      .sort((left, right) => LEVELS.indexOf(left.level) - LEVELS.indexOf(right.level));
  }

  function rubricIsComplete(item) {
    return DIMENSIONS.every(([dimension]) => rubricRows(item, dimension).length === LEVELS.length);
  }

  function inheritedRubricEntries(template, scoreItemId) {
    const source = list(template?.scoreItems).find((item) => rubricIsComplete(item));
    return clone(list(source?.rubricEntries)).map((entry) => ({ ...entry, scoreItemId }));
  }

  function renderRubricMissing(item, dimension) {
    if (rubricRows(item, dimension).length === LEVELS.length) return "";
    return `<div class="maturity-v3-rubric-missing" role="alert"><strong>评分标准缺失</strong><span>当前评估点缺少该维度完整 L1—L5 标准，已阻止评分。</span></div>`;
  }

  function renderElementControls(detail, item, entry) {
    normalizeTargetFields(entry);
    const completeRubric = rubricIsComplete(item);
    const renderLane = (key, label, state) => {
      const isTarget = state === "target";
      const elements = isTarget ? entry.targetElements || {} : entry.elements || {};
      const notes = isTarget ? entry.targetDimensionNotes || {} : entry.dimensionNotes || {};
      const activeIndex = LEVELS.indexOf(elements[key]);
      const selectedLevel = activeIndex >= 0 ? LEVELS[activeIndex] : "";
      const currentLevel = currentDimensionLevel(entry, key);
      const currentIndex = LEVELS.indexOf(currentLevel);
      const targetLevel = LEVELS.includes(entry.targetElements?.[key]) ? entry.targetElements[key] : "";
      const targetIndex = LEVELS.indexOf(targetLevel);
      const targetFloorConflict = isTarget && targetLevelIsBelowCurrent(entry, key, selectedLevel);
      const currentCeilingConflict = !isTarget && currentLevelIsAboveTarget(entry, key, selectedLevel);
      const selectedRubric = selectedLevel ? rubricRows(item, key).find((candidate) => candidate.level === selectedLevel) : null;
      const stateLabel = isTarget ? "目标状态" : "当前状态";
      const accessibleLabel = `${label}${stateLabel}等级，当前${selectedLevel ? `${selectedLevel} ${selectedRubric?.levelName || LEVEL_NAMES[selectedLevel]}` : "未评分"}`;
      const matrix = `<div class="maturity-v15-score-matrix ${selectedLevel ? "has-value" : ""}" role="radiogroup" aria-label="${escapeHtml(accessibleLabel)}" data-maturity-score-group="${escapeHtml(key)}">${LEVELS.map((level, index) => {
        const rubric = rubricRows(item, key).find((candidate) => candidate.level === level);
        const active = level === selectedLevel;
        const belowCurrent = isTarget && currentIndex >= 0 && index < currentIndex;
        const aboveTarget = !isTarget && targetIndex >= 0 && index > targetIndex;
        const disabled = detail.project.readOnly || entry.isApplicable === false || !completeRubric || belowCurrent || aboveTarget;
        const boundaryHint = belowCurrent
          ? `目标状态不能低于当前状态 ${currentLevel}`
          : aboveTarget
            ? `当前状态不能高于目标状态 ${targetLevel}`
            : "";
        return `<button class="${active ? "is-active" : activeIndex >= 0 && index < activeIndex ? "is-before" : ""}" type="button" role="radio" aria-checked="${active}" tabindex="${active || (!selectedLevel && index === Math.max(currentIndex, 0)) ? "0" : "-1"}" data-maturity-score-level data-score-mode="${state}" data-score-item-id="${escapeHtml(item.id)}" data-element="${escapeHtml(key)}" data-score-level="${escapeHtml(level)}" ${boundaryHint ? `title="${escapeHtml(boundaryHint)}" aria-label="${escapeHtml(`${level}，${boundaryHint}`)}"` : ""} ${disabled ? "disabled" : ""}><strong>${escapeHtml(level)}</strong></button>`;
      }).join("")}</div>`;
      const feedbackId = `maturity-score-feedback-${state}-${text(item.id).replace(/[^a-zA-Z0-9_-]/g, "-")}-${key}`;
      const feedback = `<output class="maturity-v15-score-feedback ${selectedLevel ? "has-value" : "is-empty"}" id="${escapeHtml(feedbackId)}" aria-live="polite"><strong>${selectedLevel ? `${escapeHtml(selectedLevel)} ${escapeHtml(selectedRubric?.levelName || LEVEL_NAMES[selectedLevel])}` : "请选择等级"}</strong><span>${selectedRubric?.criteria ? escapeHtml(selectedRubric.criteria) : `选择 L1—L5 后，在本行显示${stateLabel}等级定义。`}</span></output>`;
      const noteAttribute = isTarget ? `data-score-target-dimension-note="${key}"` : `data-score-dimension-note="${key}"`;
      const note = `<input type="text" value="${escapeHtml(notes[key] || "")}" placeholder="请输入${escapeHtml(label)}${stateLabel}评分说明（可选）" ${noteAttribute} data-score-item-id="${escapeHtml(item.id)}" ${detail.project.readOnly || entry.isApplicable === false || !completeRubric ? "disabled" : ""} />`;
      const allowedTargetRange = currentLevel === "L5" ? "L5" : `${currentLevel}—L5`;
      const allowedCurrentRange = targetLevel === "L1" ? "L1" : `L1—${targetLevel}`;
      const boundaryMessage = targetFloorConflict
        ? `<small class="maturity-v33-target-floor-message" role="alert">${escapeHtml(label)}目标状态不能低于当前状态 ${escapeHtml(currentLevel)}，请选择 ${escapeHtml(allowedTargetRange)}。</small>`
        : currentCeilingConflict
          ? `<small class="maturity-v33-target-floor-message" role="alert">${escapeHtml(label)}当前状态不能高于目标状态 ${escapeHtml(targetLevel)}，请选择 ${escapeHtml(allowedCurrentRange)}。</small>`
          : "";
      return `<article class="maturity-v33-score-lane is-${state} ${targetFloorConflict || currentCeilingConflict ? "has-target-floor-conflict" : ""}" data-score-state="${state}"><span>${stateLabel}</span>${matrix}${feedback}${note}${boundaryMessage}</article>`;
    };
    return `<div class="maturity-v3-dimension-grid maturity-v15-dimension-grid maturity-v33-dimension-grid"><header><strong>打分维度</strong><span>当前状态</span><span>目标状态</span></header>${DIMENSIONS.map(([key, label]) => `<section data-maturity-dimension-row="${escapeHtml(key)}"><strong>${escapeHtml(label)}</strong><div class="maturity-v33-score-state-grid">${renderLane(key, label, "current")}${renderLane(key, label, "target")}</div>${renderRubricMissing(item, key)}</section>`).join("")}</div>`;
  }

  function renderReviewInspector(detail, item, focus) {
    if (!item || !focus) return `<div class="maturity-v1-table-empty">选择一个待处理评估点查看复核摘要。</div>`;
    const entry = scoreEntry(detail, item.id);
    const service = list(detail.template.services).find((candidate) => candidate.id === item.serviceId);
    const pointResult = scoreItemResult(detail, item.id);
    const scored = scorePointIsComplete(detail, item.id, entry);
    const targetConflict = pointResult?.targetBelowCurrent === true;
    const dimensionRows = DIMENSIONS.map(([key, label]) => {
      const selfLevel = LEVELS.includes(entry.elements?.[key]) ? entry.elements[key] : "";
      const reviewLevel = LEVELS.includes(entry.reviewElements?.[key]) ? entry.reviewElements[key] : "";
      const effectiveLevel = reviewLevel || selfLevel;
      const rubric = effectiveLevel ? rubricRows(item, key).find((candidate) => candidate.level === effectiveLevel) : null;
      const targetLevel = LEVELS.includes(entry.targetElements?.[key]) ? entry.targetElements[key] : "";
      const targetRubric = targetLevel ? rubricRows(item, key).find((candidate) => candidate.level === targetLevel) : null;
      return `<section data-maturity-review-dimension="${escapeHtml(key)}"><header><strong>${escapeHtml(label)}</strong><span>当前 ${escapeHtml(effectiveLevel || "未评分")} → 目标 ${escapeHtml(targetLevel || "未设置")}</span></header><div class="maturity-v33-review-state-pair"><div><strong>当前状态</strong><p>${escapeHtml(rubric?.criteria || "当前维度尚未形成可复核结果。")}</p><small>${escapeHtml(entry.dimensionNotes?.[key] || (reviewLevel && reviewLevel !== selfLevel ? `自评 ${selfLevel || "未评分"}，复核调整为 ${reviewLevel}` : "未填写说明"))}</small></div><div><strong>目标状态</strong><p>${escapeHtml(targetRubric?.criteria || "目标维度尚未设置。")}</p><small>${escapeHtml(entry.targetDimensionNotes?.[key] || "未填写说明")}</small></div></div></section>`;
    }).join("");
    return `<section class="maturity-v17-review-inspector" aria-label="当前评估点复核摘要">
      <header><div><span>检查对象</span><h3>${escapeHtml(focus.code || "-")} ${escapeHtml(focus.name || "评估点")}</h3><p>${escapeHtml(service ? `${service.code || ""} ${service.name || "安全技术服务"}`.trim() : "关注点整体评估")}${item.scopeName ? ` · ${escapeHtml(item.scopeName)}` : ""}</p></div><span class="maturity-v1-row-status ${entry.isApplicable === false ? "is-muted" : scored ? "is-good" : "is-warn"}">${entry.isApplicable === false ? "不适用" : targetConflict ? "目标冲突" : scored ? "已完成" : "未完成"}</span></header>
      <div class="maturity-v17-review-facts"><div><span>系统当前</span><strong>${escapeHtml(pointResult?.currentLevel || "—")} ${pointResult?.currentIndex == null ? "" : escapeHtml(Number(pointResult.currentIndex).toFixed(2))}</strong></div><div><span>综合目标</span><strong>${escapeHtml(pointResult?.targetLevel ? `${pointResult.targetLevel} ${LEVEL_NAMES[pointResult.targetLevel] || ""}`.trim() : "未设置")} ${pointResult?.targetIndex == null ? "" : escapeHtml(Number(pointResult.targetIndex).toFixed(2))}</strong></div><div class="is-wide"><span>说明状态</span><p>当前与目标说明按四个维度分别记录，均为可选。</p></div></div>
      ${entry.isApplicable === false ? `<div class="maturity-v1-validation is-valid"><strong>该评估点不适用</strong><span>${escapeHtml(entry.naReason || "未填写不适用说明")}</span></div>` : `<div class="maturity-v17-review-dimensions">${dimensionRows}</div>`}
      <footer><span>检查页只读展示当前记录；不适用项用于核对原因，不增加额外确认步骤。</span><div class="maturity-v19-review-inspector-actions"><button class="maturity-v1-button is-secondary" type="button" data-maturity-action="adjust-review-item" data-score-item-id="${escapeHtml(item.id)}">返回评分</button></div></footer>
    </section>`;
  }

  function renderReviewQueueRows(detail, rows, statusLabel) {
    return list(rows).slice(0, 80).map(({ entry, item, focus, service, pointResult }) => {
      const selected = model.selectedScoreItemId === item.id;
      const targetConflict = pointResult?.targetBelowCurrent === true;
      const visibleStatus = statusLabel || (entry.isApplicable === false ? "不适用" : targetConflict ? "目标冲突" : "未完成");
      const tone = ["不适用", "无证据"].includes(visibleStatus) ? "is-muted" : "is-warn";
      return `<tr class="${selected ? "is-selected" : ""}" data-maturity-action="select-review-item" data-score-item-id="${escapeHtml(item.id)}"><td><strong>${escapeHtml(focus.code || "")} ${escapeHtml(focus.name || "评估点")}</strong><span>${escapeHtml(service.code || "")} ${escapeHtml(service.name || "关注点评估点")}</span></td><td>${DIMENSIONS.map(([key]) => escapeHtml(entry.elements?.[key] || "-")).join(" / ")}</td><td>${escapeHtml(pointResult?.currentLevel || "-")} ${pointResult?.currentIndex ?? ""}</td><td>${DIMENSIONS.map(([key]) => escapeHtml(entry.targetElements?.[key] || "-")).join(" / ")}<small>${targetConflict ? `综合目标不得低于 ${escapeHtml(pointResult.minimumTargetLevel || pointResult.currentLevel)}` : `综合 ${escapeHtml(pointResult?.targetLevel || "-")} ${pointResult?.targetIndex ?? ""}`}</small></td><td>${escapeHtml(entry.evidenceLevel || "E0")}</td><td><div class="maturity-v19-review-row-actions"><span class="maturity-v1-row-status ${tone}">${escapeHtml(visibleStatus)}</span><button type="button" data-maturity-action="adjust-review-item" data-score-item-id="${escapeHtml(item.id)}">返回评分</button></div></td></tr>${selected ? `<tr class="maturity-v2-inline-score-row"><td colspan="6">${renderReviewInspector(detail, item, focus)}</td></tr>` : ""}`;
    }).join("") || `<tr><td colspan="6"><div class="maturity-v1-table-empty">当前分组没有需要核对的评估点。</div></td></tr>`;
  }

  function renderReviewQueueGroup(detail, { key, title, description, rows, statusLabel, open = false }) {
    return `<details class="maturity-v23-review-group is-${escapeHtml(key)}"${open ? " open" : ""} data-maturity-review-group="${escapeHtml(key)}"><summary><div><strong>${escapeHtml(title)}</strong><span>${escapeHtml(description)}</span></div><b>${rows.length}</b><small><span>展开</span><span>收起</span></small></summary><div class="maturity-v1-table-wrap maturity-v17-review-table"><table class="maturity-v1-table"><thead><tr><th>关注点 / 评估点</th><th>四维自评</th><th>系统当前</th><th>目标</th><th>证据</th><th>状态 / 操作</th></tr></thead><tbody>${renderReviewQueueRows(detail, rows, statusLabel)}</tbody></table></div></details>`;
  }

  function renderReviewTab(detail) {
    const template = detail.template;
    const itemById = new Map(list(template.scoreItems).map((item) => [item.id, item]));
    const focusById = new Map(list(template.focuses).map((item) => [item.id, item]));
    const serviceById = new Map(list(template.services).map((item) => [item.id, item]));
    const rows = activeTemplateData(template).scoreItems.map((templateItem) => {
      const item = itemById.get(templateItem.id) || templateItem;
      const entry = scoreEntry(detail, item.id);
      const focus = focusById.get(item.focusId) || {};
      const service = serviceById.get(item.serviceId) || {};
      const pointResult = scoreItemResult(detail, item.id);
      const scored = scorePointIsComplete(detail, item.id, entry);
      return { entry, item, focus, service, scored, pointResult };
    });
    const unscored = rows.filter((row) => row.entry.isApplicable !== false && !row.scored);
    const completed = rows.filter((row) => row.scored && row.entry.isApplicable !== false);
    const noEvidence = rows.filter((row) => row.entry.isApplicable !== false && (!row.entry.evidenceLevel || row.entry.evidenceLevel === "E0") && !text(row.entry.evidenceSummary).trim());
    const notApplicable = rows.filter((row) => row.entry.isApplicable === false);
    const targetConflicts = unscored.filter((row) => row.pointResult?.targetBelowCurrent === true);
    const incomplete = unscored.filter((row) => row.pointResult?.targetBelowCurrent !== true);
    const noEvidenceInformation = noEvidence;
    const scoreImportIssues = list(detail.scoreImportIssues);
    const summary = summaryOf(detail);
    const targetConflictCount = Math.max(targetConflicts.length, Number(summary.targetBelowCurrentCount || 0));
    const blockingCount = incomplete.length + targetConflictCount + scoreImportIssues.length;
    const canComplete = blockingCount === 0 && !detail.project.readOnly;
    const reviewGroups = [
      { key: "target-conflict", title: "目标冲突", description: "目标等级低于当前评分计算等级，必须修改", rows: targetConflicts, statusLabel: "目标冲突", open: targetConflicts.length > 0 },
      { key: "incomplete", title: "未完成", description: "四维评分或目标等级尚未完整", rows: incomplete, statusLabel: "未完成", open: incomplete.length > 0 },
      { key: "not-applicable", title: "不适用核对", description: "退出评分与聚合，可选说明不阻塞完成", rows: notApplicable, statusLabel: "不适用" },
      { key: "no-evidence", title: "无证据（信息）", description: "证据材料可选，仅供补充，不阻塞完成", rows: noEvidenceInformation, statusLabel: "无证据" },
    ];
    return `
      <div class="maturity-v1-review-layout">
        <section class="maturity-v1-section">
          <div class="maturity-v1-panel-heading"><div><span>提交条件</span><h3>评分完整性检查</h3></div><span>${Number(summary.completionRate || 0).toFixed(0)}% 完成</span></div>
          <div class="maturity-v1-review-summary maturity-v19-review-summary"><div class="is-good"><span>已完成</span><strong>${completed.length}</strong><small>不在下方问题清单显示</small></div><button class="${unscored.length ? "is-warn" : "is-good"}" type="button" data-maturity-action="adjust-first-blocker" ${unscored.length ? "" : "disabled"}><span>未完成</span><strong>${unscored.length}</strong><small>${unscored.length ? "返回首个待调整项" : "全部完成"}</small></button><div class="is-muted"><span>不适用</span><strong>${notApplicable.length}</strong><small>下方保留原因核对</small></div><div class="is-muted"><span>无证据（信息）</span><strong>${noEvidence.length}</strong><small>可选材料，不阻塞</small></div></div>
          <div class="maturity-v1-review-actions">
            <span>完成评估会锁定当前完整结果，并开放正式评估报告。</span>
            <button class="maturity-v1-button is-primary" type="button" data-maturity-action="complete-assessment" ${canComplete ? "" : "disabled"}>完成评估</button>
          </div>
          ${detail.project.readOnly ? `<div class="maturity-v1-validation is-valid"><strong>当前评估结果已锁定</strong><span>如需调整，请在项目概览选择“修改评估分数”并确认解锁。</span></div>` : blockingCount ? `<div class="maturity-v1-validation is-invalid"><strong>暂不能完成项目</strong><span>${scoreImportIssues.length ? `上传评分文件还有 ${scoreImportIssues.length} 个问题；` : ""}${targetConflictCount ? `还有 ${targetConflictCount} 个目标等级冲突；` : ""}${incomplete.length} 个适用评估点仍未形成完整有效评分。</span></div>` : `<div class="maturity-v1-validation is-valid"><strong>评分完整性通过</strong><span>不适用说明、评估说明和证据材料均为可选，不阻塞完成评估。</span></div>`}
        </section>
        <section class="maturity-v1-section">
          <div class="maturity-v1-panel-heading"><div><span>评分检查</span><h3>按问题类型核对</h3></div><span>已完成项已隐藏</span></div>
          ${scoreImportIssues.length ? `<section class="maturity-v29-import-issues" aria-label="评分文件校验问题"><header><div><span>文件校验</span><strong>上传评分文件有 ${scoreImportIssues.length} 个阻塞项</strong></div><button class="maturity-v1-button is-secondary" type="button" data-maturity-action="trigger-score-import">重新上传</button><input type="file" accept="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,.xlsx" hidden data-maturity-score-file /></header><ul>${scoreImportIssues.slice(0, 12).map((issue) => `<li><b>${issue.row ? `第 ${issue.row} 行` : "文件"}</b><span>${escapeHtml(issue.message || issue.code || "评分文件校验失败")}</span></li>`).join("")}</ul>${scoreImportIssues.length > 12 ? `<small>另有 ${scoreImportIssues.length - 12} 个问题，请修正后重新上传。</small>` : ""}</section>` : ""}
          <div class="maturity-v23-review-groups">${reviewGroups.map((group) => renderReviewQueueGroup(detail, group)).join("")}</div>
        </section>
      </div>
    `;
  }

  function capabilityRadarGroups(detail) {
    const categories = byTemplateOrder(list(detail?.template?.categories));
    const topCategories = categories.filter((item) => categoryCapabilityLevel(item) === "L0");
    const resultRows = list(detail?.result?.capabilityResults);
    const rowsByTopCategory = new Map(topCategories.map((item) => [item.id, []]));
    const unmatched = [];
    resultRows.forEach((row) => {
      const bucket = rowsByTopCategory.get(row.topCategoryId);
      if (bucket) bucket.push(row);
      else unmatched.push(row);
    });
    const groups = topCategories.map((category) => ({
      id: category.id,
      code: category.code || "—",
      name: compactChineseName(category.name) || category.name || "其他能力",
      rows: rowsByTopCategory.get(category.id) || [],
    })).filter((group) => group.rows.length);
    if (unmatched.length) groups.push({ id: "ungrouped", code: "—", name: "未分组能力", rows: unmatched });
    return groups;
  }

  function reportRadarData(detail) {
    if (!reportExportReady(detail?.report)) return null;
    const section = list(detail.report?.reportModel?.sections).find((item) => item?.id === "radars");
    return section?.data && typeof section.data === "object" ? section.data : null;
  }

  function reportSurfaceDetail(detail) {
    const snapshot = detail?.report?.reportModel?.resultSnapshot;
    return reportExportReady(detail?.report) && snapshot?.ok ? { ...detail, result: snapshot } : detail;
  }

  function reportCapabilityRadarGroups(detail) {
    const chart = reportRadarData(detail)?.capabilityRadar;
    const axes = list(chart?.axes);
    const groups = list(chart?.groups).map((group) => ({
      id: group.id || group.code,
      code: group.code || "—",
      name: group.name || "未分组能力",
      rows: axes
        .filter((axis) => text(axis.groupCode) === text(group.code))
        .map((axis) => ({
          id: axis.id,
          code: axis.code,
          name: axis.label,
          displayLabel: axis.displayLabel,
          currentIndex: axis.current,
          targetIndex: axis.target,
        })),
    })).filter((group) => group.rows.length);
    const knownAxisIds = new Set(groups.flatMap((group) => group.rows.map((row) => row.id)));
    const unmatched = axes.filter((axis) => !knownAxisIds.has(axis.id));
    if (unmatched.length) {
      groups.push({
        id: "ungrouped",
        code: "—",
        name: "未分组能力",
        rows: unmatched.map((axis) => ({ id: axis.id, code: axis.code, name: axis.label, displayLabel: axis.displayLabel, currentIndex: axis.current, targetIndex: axis.target })),
      });
    }
    return groups.length ? groups : null;
  }

  function radarShortLabel(row) {
    if (text(row?.displayLabel)) return text(row.displayLabel);
    const configured = RADAR_SHORT_LABELS[text(row?.code)];
    if (configured) return configured;
    const fallback = compactChineseName(row?.name)
      .replace(/^网络安全/, "")
      .replace(/安全能力$/, "")
      .replace(/管理能力$/, "管理")
      .replace(/能力$/, "");
    return fallback.slice(0, 6) || text(row?.code) || "未命名";
  }

  function maturityResultGroupStats(detail, groups) {
    const topResults = new Map(list(detail?.result?.categoryResults).map((row) => [row.id, row]));
    const l1Results = list(detail?.result?.subCategoryResults);
    return groups.map((group) => {
      const l1Rows = l1Results.filter((row) => row.parentId === group.id);
      const l2CountByCategory = group.rows.reduce((counts, row) => {
        counts.set(row.categoryId, (counts.get(row.categoryId) || 0) + 1);
        return counts;
      }, new Map());
      return {
        ...group,
        result: topResults.get(group.id) || null,
        l1Rows: l1Rows.map((row) => ({ ...row, l2Count: l2CountByCategory.get(row.id) || 0 })),
        scoredL2Count: group.rows.filter((row) => row.currentIndex != null).length,
        belowTargetL2Count: group.rows.filter((row) => Number(row.gapIndex) > 0).length,
      };
    });
  }

  function backendPriorityCounts(detail, capabilityIds) {
    const allowed = capabilityIds instanceof Set ? capabilityIds : new Set(list(capabilityIds));
    return list(detail?.result?.gapItems).reduce((counts, item) => {
      if (!allowed.has(item.capabilityId) || !["高", "中", "低"].includes(item.priority)) return counts;
      counts[item.priority] += 1;
      return counts;
    }, { 高: 0, 中: 0, 低: 0 });
  }

  function renderBackendPriorityCounts(counts) {
    return `<div class="maturity-v19-priority-counts" aria-label="后端差距候选优先级"><span>差距优先级</span>${["高", "中", "低"].map((priority) => `<b class="is-${priority === "高" ? "high" : priority === "中" ? "medium" : "low"}">${priority} ${Number(counts?.[priority] || 0)}</b>`).join("")}</div>`;
  }

  function resultObjectLabel(row) {
    return [text(row?.code), compactChineseName(row?.name) || text(row?.name)].filter(Boolean).join(" ") || "未命名能力域";
  }

  function renderResultEvaluation(detail, rows) {
    const result = detail?.result || {};
    const scoredCount = rows.filter((row) => row.currentIndex != null).length;
    const belowTargetCount = rows.filter((row) => Number(row.gapIndex) > 0).length;
    const reachedTargetCount = rows.filter((row) => row.gapIndex != null && Number(row.gapIndex) <= 0).length;
    const l1Rows = list(result.subCategoryResults).filter((row) => row.currentIndex != null && Number.isFinite(Number(row.currentIndex)));
    const leadingL1 = [...l1Rows]
      .sort((left, right) => Number(right.currentIndex) - Number(left.currentIndex) || text(left.code).localeCompare(text(right.code), "zh-Hans-CN", { numeric: true }))
      .slice(0, 3);
    const improvementL1 = [...l1Rows]
      .filter((row) => row.gapIndex != null && Number(row.gapIndex) > 0)
      .sort((left, right) => Number(right.gapIndex) - Number(left.gapIndex) || text(left.code).localeCompare(text(right.code), "zh-Hans-CN", { numeric: true }))
      .slice(0, 3);
    const l1ById = new Map(l1Rows.map((row) => [row.id, row]));
    const leadingGap = list(result.gapItems)[0] || null;
    const leadingGapL1 = leadingGap ? l1ById.get(leadingGap.categoryId) : null;
    const maturityLeaders = list(result.maturityDistribution)
      .filter((item) => Number(item.count || 0) > 0)
      .sort((left, right) => Number(right.count || 0) - Number(left.count || 0))
      .slice(0, 2);
    const profile = dimensionProfile(result.summary?.dimensionResults || {});
    const { strongest, weakest, spread } = profileExtremes(profile);
    const evidenceRows = list(result.evidenceDistribution);
    const evidenceTotal = evidenceRows.reduce((sum, item) => sum + Number(item.count || 0), 0);
    const evidenceMissing = Number(evidenceRows.find((item) => item.level === "E0")?.count || 0);
    const evidenceFilled = Math.max(0, evidenceTotal - evidenceMissing);
    const leadingL1Text = leadingL1.length
      ? `${leadingL1.map((row) => `${escapeHtml(resultObjectLabel(row))}（${Number(row.currentIndex).toFixed(2)}）`).join("、")}相对表现突出。`
      : "当前没有可用于比较的 L1 能力域结果。";
    const improvementL1Text = improvementL1.length
      ? `${improvementL1.map((row) => `${escapeHtml(resultObjectLabel(row))}（当前 ${Number(row.currentIndex).toFixed(2)} / 目标 ${Number(row.targetIndex).toFixed(2)}）`).join("、")}需要进一步加强。`
      : "当前 L1 能力域均已达到目标。";
    const focusText = leadingGap
      ? `特别是${leadingGapL1 ? `“${escapeHtml(resultObjectLabel(leadingGapL1))}”能力域下的 ` : ""}${escapeHtml(leadingGap.capabilityCode)} ${escapeHtml(leadingGap.capabilityName)}，当前差距 ${Number(leadingGap.gapIndex).toFixed(2)}，位列改进优先首位。`
      : "当前没有需要单独聚焦的 L2 改进项。";
    const maturityText = maturityLeaders.length
      ? `当前能力主要分布在 ${maturityLeaders.map((item) => `${escapeHtml(item.level)}（${Number(item.count || 0)} 项）`).join(" 和 ")}；${belowTargetCount} 项低于目标。`
      : `${belowTargetCount} 项低于目标。`;
    const dimensionText = strongest && weakest
      ? `${escapeHtml(strongest.label)}得分最高（${strongest.value.toFixed(2)}），${escapeHtml(weakest.label)}得分最低（${weakest.value.toFixed(2)}）${spread == null ? "。" : `，四维极差 ${spread.toFixed(2)}。`}`
      : "四维结果尚未完整，暂不形成均衡性判断。";
    const evidenceText = evidenceTotal
      ? `${evidenceFilled} / ${evidenceTotal} 项达到 E1 及以上，E0 无证据 ${evidenceMissing} 项。`
      : "当前没有可汇总的证据等级数据。";
    return `<section class="maturity-v4-radar-observation" aria-label="结果评价"><span>结果评价</span><strong>${scoredCount} / ${rows.length} 项 L2 已有评分，${reachedTargetCount} 项已达到或超过目标</strong><div class="maturity-v34-result-insights"><p><b>成熟度轮廓</b><span>${maturityText}</span></p><p><b>L1 优势能力域</b><span>${leadingL1Text}</span></p><p><b>L1 重点加强</b><span>${improvementL1Text}${focusText}</span></p><p><b>四维均衡</b><span>${dimensionText}</span></p><p><b>证据基础</b><span>${evidenceText}</span></p></div>${renderAssessmentDistributions(result)}</section>`;
  }

  function renderRadarAnalysis(detail, groups) {
    const stats = maturityResultGroupStats(detail, groups);
    const rows = groups.flatMap((group) => group.rows);
    return `<aside class="maturity-v4-radar-analysis sapd-stat-vibrancy" aria-label="技术、治理、管理分层统计与结果评价">
      <header><span>分层统计</span><h4>T / G / M 总体与层级</h4><p>指数沿用后端聚合结果；数量按当前模板 L1、L2 结构统计。</p></header>
      <div class="maturity-v4-radar-tgm-stats">${stats.map((group) => `<section data-radar-group="${escapeHtml(group.code)}"><header><span><i></i><strong>${escapeHtml(group.code)} ${escapeHtml(group.name)}</strong></span><b>${group.result?.currentIndex == null ? "—" : escapeHtml(Number(group.result.currentIndex).toFixed(2))}<small> / 目标 ${group.result?.targetIndex == null ? "—" : escapeHtml(Number(group.result.targetIndex).toFixed(2))}</small></b></header><dl><div><dt>L1</dt><dd>${group.l1Rows.length}</dd></div><div><dt>L2</dt><dd>${group.rows.length}</dd></div><div><dt>低于目标</dt><dd>${group.belowTargetL2Count}</dd></div></dl>${renderBackendPriorityCounts(backendPriorityCounts(detail, new Set(group.rows.map((row) => row.id))))}</section>`).join("")}</div>
      <section class="maturity-v4-radar-l1-stats"><header><strong>L1 能力域</strong><span>当前 / 目标 · L2 数量 · 后端差距优先级</span></header><div>${stats.flatMap((group) => group.l1Rows.map((row) => { const capabilityRows = group.rows.filter((capability) => capability.categoryId === row.id); return `<div><span><i data-radar-group="${escapeHtml(group.code)}"></i><strong>${escapeHtml(row.code || compactChineseName(row.name))}</strong><small>${escapeHtml(compactChineseName(row.name))}</small></span><b>${row.currentIndex == null ? "—" : escapeHtml(Number(row.currentIndex).toFixed(2))} / ${row.targetIndex == null ? "—" : escapeHtml(Number(row.targetIndex).toFixed(2))}</b><em>${row.l2Count} L2</em>${renderBackendPriorityCounts(backendPriorityCounts(detail, new Set(capabilityRows.map((capability) => capability.id))))}</div>`; })).join("")}</div></section>
      ${renderResultEvaluation(detail, rows)}
    </aside>`;
  }

  function renderCapabilityRadar(detail) {
    const groups = capabilityRadarGroups(detail);
    const rows = groups.flatMap((group) => group.rows);
    if (!rows.length) return `<div class="maturity-v1-empty-inline">当前没有可进入能力雷达的 L2 能力。</div>`;
    const unscoredCount = rows.filter((row) => row.currentIndex == null).length;
    return `<section class="maturity-v4-radar-panel maturity-v20-radar-suite maturity-v21-radar-suite sapd-stat-vibrancy" data-maturity-radar-contract="l2-capability-by-top-category">
      <header><div><span>成熟度轮廓</span><h3>全能力分组与四维成熟度雷达</h3></div><div class="maturity-v4-radar-group-legend" aria-label="雷达能力分组">${groups.map((group) => `<span data-radar-group="${escapeHtml(group.code)}"><i></i><strong>${escapeHtml(group.code)}</strong>${escapeHtml(group.name)} <b>${group.rows.length}</b></span>`).join("")}</div></header>
      <div class="maturity-v21-radar-stack">
        <div class="maturity-v4-radar-layout maturity-v21-capability-radar-layout">
          <div class="maturity-v25-radar-visual-column">
            <section class="maturity-v20-capability-radar" aria-label="全能力分组雷达"><header><h3>全能力分组雷达</h3><p>每条轴为一项 L2 能力；T / G / M 使用可辨识的低彩度底色分区。</p></header><div class="maturity-v4-radar-canvas-wrap"><canvas width="880" height="480" data-maturity-capability-radar aria-label="${rows.length} 项 L2 能力成熟度分组雷达，按${escapeHtml(groups.map((group) => group.name).join("、"))}展示"></canvas><div class="maturity-v4-radar-legend"><span class="is-current"><i></i>当前成熟度</span><span class="is-target"><i></i>目标等级</span>${unscoredCount ? `<span class="is-unscored"><i></i>${unscoredCount} 项未评分，不按 0 分计算</span>` : ""}</div></div></section>
            <div class="maturity-v21-dimension-radar-row maturity-v25-compact-dimension-radar">${renderResultDimensionRadar(detail)}</div>
          </div>
          ${renderRadarAnalysis(detail, groups)}
        </div>
      </div>
    </section>`;
  }

  function renderAssessmentDistributions(result) {
    return `<div class="maturity-v20-result-distributions" aria-label="成熟度与证据分布"><section><header><strong>成熟度分布</strong><span>L2 能力</span></header>${renderDistribution(result.maturityDistribution || [])}</section><section><header><strong>证据分布</strong><span>辅助完整性</span></header><div class="maturity-v1-evidence-list">${list(result.evidenceDistribution).map((item) => `<div><span>${escapeHtml(item.level)} ${escapeHtml(item.name)}</span><strong>${item.count}</strong></div>`).join("")}</div></section></div>`;
  }

  function renderResultSummary(detail) {
    const summary = detail?.result?.summary || {};
    const applicable = Number(summary.applicableItemCount || 0);
    const excluded = Number(summary.notApplicableCount || 0);
    const total = applicable + excluded;
    const completed = Number(summary.scoredItemCount || 0);
    const layerRows = list(detail?.result?.categoryResults).slice(0, 3);
    const currentLevel = LEVELS.includes(summary.currentLevel) ? summary.currentLevel : "未评分";
    const currentLevelName = LEVEL_NAMES[currentLevel] || "";
    const targetLevel = LEVELS.includes(summary.targetLevel) ? summary.targetLevel : "—";
    const targetIndex = Number.isFinite(Number(summary.targetIndex)) ? Number(summary.targetIndex).toFixed(2) : "—";
    return `<section class="maturity-v20-result-summary sapd-stat-vibrancy" aria-label="评估结果与统计口径">
      <header><div><span>评估结果</span><h2>${escapeHtml(currentLevel)}${currentLevelName ? ` ${escapeHtml(currentLevelName)}` : ""}</h2></div><p>全部适用评估点已形成后端正式统计；不适用与无证据仅作为信息项。</p></header>
      <div class="maturity-v20-result-metrics maturity-v21-result-metrics"><article class="is-target maturity-v25-target-maturity"><span>目标成熟度</span><div><strong>${escapeHtml(targetLevel)}</strong><b>${escapeHtml(targetIndex)}</b></div></article><article><span>适用性</span><strong>${applicable} / ${total || "—"}</strong><small>适用评估点 / 全部评估点</small></article><article><span>评估进度</span><strong>${completed} / ${applicable || "—"}</strong><small>已完成 / 适用评估点</small></article><article class="is-layered maturity-v27-category-scores"><span>能力类别评分</span><div>${layerRows.map((row) => `<div class="maturity-v27-category-score" data-radar-group="${escapeHtml(row.code)}"><span><i></i><strong>${escapeHtml(row.code || compactChineseName(row.name))}</strong><b>${row.currentIndex == null ? "—" : escapeHtml(Number(row.currentIndex).toFixed(2))}</b></span><small>${escapeHtml(compactChineseName(row.name))} · 目标 ${row.targetIndex == null ? "—" : escapeHtml(Number(row.targetIndex).toFixed(2))}</small></div>`).join("")}</div></article></div>
    </section>`;
  }

  function renderResultDimensionRadar(detail) {
    const summary = detail?.result?.summary || {};
    const profile = dimensionProfile(summary.dimensionResults || {});
    const { strongest, weakest, spread } = profileExtremes(profile);
    return `<section class="maturity-v15-result-dimension-radar" aria-label="评估结果四维雷达">
      <header><div><h3>四维成熟度雷达</h3><p>总体四维聚合结果</p></div><div class="maturity-v15-radar-legend"><span><i></i>当前状态</span><span class="is-target"><i></i>目标状态</span></div></header>
      <div class="maturity-v15-result-dimension-layout"><canvas width="520" height="300" data-maturity-result-radar aria-label="评估结果组织、流程、工具、数据四维雷达图"></canvas><aside><strong>${strongest && weakest ? `${escapeHtml(strongest.label)}最高，${escapeHtml(weakest.label)}最低` : "四维结果尚未完整"}</strong><p>${spread == null ? "完成四维评分后展示离散度。" : `四维极差 ${spread.toFixed(2)} 级；雷达形状用于暴露不均衡，不替代精确结果表。`}</p><dl>${profile.map((item) => `<div><dt>${escapeHtml(item.label)}</dt><dd>${item.value == null ? "—" : item.value.toFixed(2)}</dd></div>`).join("")}</dl></aside></div>
      <p>目标虚线来自四个维度分别设置并聚合后的目标状态。</p>
    </section>`;
  }

  function drawHierarchyRadar(detail) {
    const canvas = model.root?.querySelector("[data-maturity-hierarchy-radar]");
    if (!canvas) return;
    const viewLevel = text(canvas.dataset.hierarchyLevel).toUpperCase();
    const viewId = text(canvas.dataset.hierarchyId);
    const result = hierarchyResult(detail, viewLevel, viewId);
    const profile = hierarchyDimensionProfile(result);
    const context = canvas.getContext?.("2d");
    if (!context) return;
    const cssWidth = Math.max(300, Math.round(canvas.getBoundingClientRect().width || 520));
    const cssHeight = 286;
    const ratio = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
    canvas.width = Math.round(cssWidth * ratio);
    canvas.height = Math.round(cssHeight * ratio);
    canvas.style.height = `${cssHeight}px`;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.clearRect(0, 0, cssWidth, cssHeight);
    const center = { x: cssWidth / 2, y: cssHeight / 2 + 3 };
    const radius = Math.min(cssWidth * 0.3, 104);
    const angles = profile.map((_, index) => -Math.PI / 2 + (Math.PI * 2 * index) / profile.length);
    const point = (angle, value) => ({ x: center.x + Math.cos(angle) * radius * (value / 5), y: center.y + Math.sin(angle) * radius * (value / 5) });
    for (let level = 1; level <= 5; level += 1) {
      context.beginPath();
      angles.forEach((angle, index) => {
        const current = point(angle, level);
        if (!index) context.moveTo(current.x, current.y);
        else context.lineTo(current.x, current.y);
      });
      context.closePath();
      context.lineWidth = level === 5 ? 1.25 : 1;
      context.strokeStyle = level === 5 ? "#aebbc8" : "#dbe3ea";
      context.stroke();
    }
    angles.forEach((angle, index) => {
      const edge = point(angle, 5);
      context.beginPath();
      context.moveTo(center.x, center.y);
      context.lineTo(edge.x, edge.y);
      context.lineWidth = 1;
      context.strokeStyle = "#d5dee7";
      context.stroke();
      const labelPoint = { x: center.x + Math.cos(angle) * (radius + 26), y: center.y + Math.sin(angle) * (radius + 22) };
      context.fillStyle = "#405a71";
      context.font = "700 11px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
      context.textAlign = Math.cos(angle) > 0.22 ? "left" : Math.cos(angle) < -0.22 ? "right" : "center";
      context.textBaseline = "middle";
      context.fillText(profile[index].label, labelPoint.x, labelPoint.y);
    });
    const drawSeries = (values, { stroke, fill = "", dashed = false, points = false }) => {
      const complete = values.every((value) => value != null && Number.isFinite(Number(value)));
      if (!complete) return;
      context.beginPath();
      values.forEach((value, index) => {
        const current = point(angles[index], Math.max(1, Math.min(5, Number(value))));
        if (!index) context.moveTo(current.x, current.y);
        else context.lineTo(current.x, current.y);
      });
      context.closePath();
      if (fill) {
        context.fillStyle = fill;
        context.fill();
      }
      context.setLineDash(dashed ? [6, 5] : []);
      context.lineWidth = 2;
      context.strokeStyle = stroke;
      context.stroke();
      context.setLineDash([]);
      if (points) values.forEach((value, index) => {
        const current = point(angles[index], Math.max(1, Math.min(5, Number(value))));
        context.beginPath();
        context.arc(current.x, current.y, 3.2, 0, Math.PI * 2);
        context.fillStyle = "#f8fbfd";
        context.fill();
        context.lineWidth = 2;
        context.strokeStyle = stroke;
        context.stroke();
      });
    };
    const targetProfile = dimensionProfile(result?.targetDimensionResults || {});
    const hasTargetProfile = targetProfile.every((item) => item.value != null);
    const targetIndex = result?.targetIndex == null ? null : Number(result.targetIndex);
    const targetValues = hasTargetProfile ? targetProfile.map((item) => item.value) : Number.isFinite(targetIndex) ? profile.map(() => targetIndex) : [];
    if (targetValues.length) drawSeries(targetValues, { stroke: "#9a6d2f", dashed: true });
    drawSeries(profile.map((item) => item.value), { stroke: "#1676c5", fill: "rgba(22, 118, 197, 0.12)", points: true });
    context.fillStyle = "#6e7f90";
    context.font = "700 9px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
    context.textAlign = "left";
    context.fillText("1", center.x + 4, center.y - radius / 5 + 3);
    context.fillText("5", center.x + 4, center.y - radius + 3);
  }

  function drawCompactDimensionRadar(canvas, result, { height = 236, maxRadius = 92 } = {}) {
    if (!canvas) return;
    const context = canvas.getContext?.("2d");
    if (!context) return;
    const profile = dimensionProfile(result?.dimensionResults || {});
    const cssWidth = Math.max(260, Math.round(canvas.getBoundingClientRect().width || 320));
    const cssHeight = height;
    const ratio = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
    canvas.width = Math.round(cssWidth * ratio);
    canvas.height = Math.round(cssHeight * ratio);
    canvas.style.height = `${cssHeight}px`;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.clearRect(0, 0, cssWidth, cssHeight);
    const center = { x: cssWidth / 2, y: cssHeight / 2 + 3 };
    const radius = Math.min(cssWidth * 0.36, cssHeight * 0.39, maxRadius);
    const angles = profile.map((_, index) => -Math.PI / 2 + (Math.PI * 2 * index) / profile.length);
    const point = (angle, value) => ({ x: center.x + Math.cos(angle) * radius * (value / 5), y: center.y + Math.sin(angle) * radius * (value / 5) });
    for (let level = 1; level <= 5; level += 1) {
      context.beginPath();
      angles.forEach((angle, index) => {
        const current = point(angle, level);
        if (!index) context.moveTo(current.x, current.y);
        else context.lineTo(current.x, current.y);
      });
      context.closePath();
      context.lineWidth = level === 5 ? 1.2 : 1;
      context.strokeStyle = level === 5 ? "#aebbc8" : "#dbe3ea";
      context.stroke();
    }
    angles.forEach((angle, index) => {
      const edge = point(angle, 5);
      context.beginPath();
      context.moveTo(center.x, center.y);
      context.lineTo(edge.x, edge.y);
      context.strokeStyle = "#d5dee7";
      context.stroke();
      const labelPoint = { x: center.x + Math.cos(angle) * (radius + 23), y: center.y + Math.sin(angle) * (radius + 19) };
      context.fillStyle = "#405a71";
      context.font = "700 10px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
      context.textAlign = Math.cos(angle) > 0.22 ? "left" : Math.cos(angle) < -0.22 ? "right" : "center";
      context.textBaseline = "middle";
      context.fillText(profile[index].label, labelPoint.x, labelPoint.y);
    });
    const drawSeries = (values, { stroke, fill = "", dashed = false, points = false }) => {
      if (!values.every((value) => value != null && Number.isFinite(Number(value)))) return;
      context.beginPath();
      values.forEach((value, index) => {
        const current = point(angles[index], Math.max(1, Math.min(5, Number(value))));
        if (!index) context.moveTo(current.x, current.y);
        else context.lineTo(current.x, current.y);
      });
      context.closePath();
      if (fill) {
        context.fillStyle = fill;
        context.fill();
      }
      context.setLineDash(dashed ? [6, 5] : []);
      context.lineWidth = 2;
      context.strokeStyle = stroke;
      context.stroke();
      context.setLineDash([]);
      if (points) values.forEach((value, index) => {
        const current = point(angles[index], Math.max(1, Math.min(5, Number(value))));
        context.beginPath();
        context.arc(current.x, current.y, 3, 0, Math.PI * 2);
        context.fillStyle = "#f8fbfd";
        context.fill();
        context.lineWidth = 2;
        context.strokeStyle = stroke;
        context.stroke();
      });
    };
    const targetProfile = dimensionProfile(result?.targetDimensionResults || {});
    const hasTargetProfile = targetProfile.every((item) => item.value != null);
    const targetIndex = result?.targetIndex == null ? null : Number(result.targetIndex);
    const targetValues = hasTargetProfile ? targetProfile.map((item) => item.value) : Number.isFinite(targetIndex) ? profile.map(() => targetIndex) : [];
    if (targetValues.length) drawSeries(targetValues, { stroke: "#9a6d2f", dashed: true });
    drawSeries(profile.map((item) => item.value), { stroke: "#1676c5", fill: "rgba(22, 118, 197, 0.12)", points: true });
  }

  function drawPointRadar(detail) {
    const canvas = model.root?.querySelector("[data-maturity-point-radar]");
    if (!canvas) return;
    drawCompactDimensionRadar(canvas, scoreItemResult(detail, canvas.dataset.scoreItemId), { height: 178 });
  }

  function drawResultDimensionRadar(detail) {
    const canvas = model.root?.querySelector("[data-maturity-result-radar]");
    if (!canvas) return;
    const height = Math.max(220, Number(canvas.dataset.radarHeight || 390));
    const maxRadius = Math.max(72, Number(canvas.dataset.radarRadius || 150));
    const reportAxes = model.activeTab === "report" ? list(reportRadarData(detail)?.dimensionRadar?.axes) : [];
    const result = reportAxes.length
      ? {
        dimensionResults: Object.fromEntries(reportAxes.map((axis) => [axis.id, axis.current])),
        targetIndex: reportAxes.find((axis) => axis.target != null)?.target ?? null,
      }
      : detail?.result?.summary;
    drawCompactDimensionRadar(canvas, result, { height, maxRadius });
  }

  function drawChildRadar(detail) {
    const canvas = model.root?.querySelector("[data-maturity-child-radar]");
    if (!canvas) return;
    const viewLevel = text(canvas.dataset.hierarchyLevel).toUpperCase();
    const viewId = text(canvas.dataset.hierarchyId);
    const rows = hierarchyChildren(detail, { viewLevel, viewId });
    const context = canvas.getContext?.("2d");
    if (rows.length < 3 || !context) return;
    const cssWidth = Math.max(520, Math.round(canvas.getBoundingClientRect().width || 820));
    const cssHeight = 360;
    const ratio = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
    canvas.width = Math.round(cssWidth * ratio);
    canvas.height = Math.round(cssHeight * ratio);
    canvas.style.height = `${cssHeight}px`;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.clearRect(0, 0, cssWidth, cssHeight);
    const center = { x: cssWidth / 2, y: cssHeight / 2 + 3 };
    const radius = Math.min(cssWidth * 0.34, cssHeight * 0.34, 122);
    const angles = rows.map((_, index) => -Math.PI / 2 + (Math.PI * 2 * index) / rows.length);
    const point = (angle, value) => ({ x: center.x + Math.cos(angle) * radius * (value / 5), y: center.y + Math.sin(angle) * radius * (value / 5) });
    for (let level = 1; level <= 5; level += 1) {
      context.beginPath();
      angles.forEach((angle, index) => {
        const current = point(angle, level);
        if (!index) context.moveTo(current.x, current.y);
        else context.lineTo(current.x, current.y);
      });
      context.closePath();
      context.lineWidth = level === 5 ? 1.2 : 1;
      context.strokeStyle = level === 5 ? "#aebbc8" : "#dbe3ea";
      context.stroke();
    }
    angles.forEach((angle, index) => {
      const edge = point(angle, 5);
      context.beginPath();
      context.moveTo(center.x, center.y);
      context.lineTo(edge.x, edge.y);
      context.strokeStyle = "#d5dee7";
      context.stroke();
      const labelRadius = radius + 22 + (rows.length > 12 && index % 2 ? 12 : 0);
      const labelPoint = { x: center.x + Math.cos(angle) * labelRadius, y: center.y + Math.sin(angle) * labelRadius };
      context.fillStyle = rows[index].currentIndex == null ? "#8492a0" : "#405a71";
      context.font = `${rows.length > 18 ? 8 : 9}px ui-monospace, SFMono-Regular, Menlo, monospace`;
      context.textAlign = Math.cos(angle) > 0.22 ? "left" : Math.cos(angle) < -0.22 ? "right" : "center";
      context.textBaseline = "middle";
      context.fillText(text(rows[index].code || radarShortLabel(rows[index])).slice(0, 14), labelPoint.x, labelPoint.y);
    });
    const drawSeries = (values, { stroke, dashed = false, points = false }) => {
      const complete = values.every((value) => value != null && Number.isFinite(Number(value)));
      context.beginPath();
      let started = false;
      values.forEach((value, index) => {
        if (value == null || !Number.isFinite(Number(value))) {
          started = false;
          return;
        }
        const current = point(angles[index], Math.max(1, Math.min(5, Number(value))));
        if (!started) context.moveTo(current.x, current.y);
        else context.lineTo(current.x, current.y);
        started = true;
      });
      if (complete) context.closePath();
      context.setLineDash(dashed ? [6, 5] : []);
      context.lineWidth = 2;
      context.strokeStyle = stroke;
      context.stroke();
      context.setLineDash([]);
      if (points) values.forEach((value, index) => {
        if (value == null || !Number.isFinite(Number(value))) return;
        const current = point(angles[index], Math.max(1, Math.min(5, Number(value))));
        context.beginPath();
        context.arc(current.x, current.y, 2.8, 0, Math.PI * 2);
        context.fillStyle = "#f8fbfd";
        context.fill();
        context.lineWidth = 2;
        context.strokeStyle = stroke;
        context.stroke();
      });
    };
    drawSeries(rows.map((row) => row.targetIndex), { stroke: "#9a6d2f", dashed: true });
    drawSeries(rows.map((row) => row.currentIndex), { stroke: "#1676c5", points: true });
  }

  function drawMaturityRadar(detail) {
    drawHierarchyRadar(detail);
    drawPointRadar(detail);
    drawChildRadar(detail);
    drawResultDimensionRadar(detail);
    const canvas = model.root?.querySelector("[data-maturity-capability-radar]");
    if (!canvas) return;
    const groups = model.activeTab === "report" ? reportCapabilityRadarGroups(detail) || capabilityRadarGroups(detail) : capabilityRadarGroups(detail);
    const rows = groups.flatMap((group) => group.rows);
    const context = canvas.getContext?.("2d");
    if (!rows.length || !context) return;
    const minimumWidth = Math.max(320, Number(canvas.dataset.radarMinWidth || 560));
    const cssWidth = Math.max(minimumWidth, Math.round(canvas.getBoundingClientRect().width || 880));
    const cssHeight = Math.max(280, Number(canvas.dataset.radarHeight || 480));
    const ratio = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
    canvas.width = Math.round(cssWidth * ratio);
    canvas.height = Math.round(cssHeight * ratio);
    canvas.style.height = `${cssHeight}px`;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.clearRect(0, 0, cssWidth, cssHeight);
    const center = { x: cssWidth / 2, y: cssHeight / 2 + 4 };
    const radius = Math.min(cssWidth * 0.33, cssHeight * 0.36);
    const angles = rows.map((_, index) => -Math.PI / 2 + (Math.PI * 2 * index) / rows.length);
    const point = (angle, value) => ({ x: center.x + Math.cos(angle) * radius * (value / 5), y: center.y + Math.sin(angle) * radius * (value / 5) });
    const groupColors = ["#2f78c4", "#7467b8", "#4f8a72"];
    let groupOffset = 0;
    groups.forEach((group, groupIndex) => {
      const start = -Math.PI / 2 + (Math.PI * 2 * (groupOffset - 0.5)) / rows.length;
      const end = -Math.PI / 2 + (Math.PI * 2 * (groupOffset + group.rows.length - 0.5)) / rows.length;
      context.beginPath();
      context.moveTo(center.x, center.y);
      context.arc(center.x, center.y, radius + 10, start, end);
      context.closePath();
      context.fillStyle = `${groupColors[groupIndex % groupColors.length]}30`;
      context.fill();
      groupOffset += group.rows.length;
    });
    context.lineWidth = 1;
    for (let level = 1; level <= 5; level += 1) {
      context.beginPath();
      angles.forEach((angle, index) => {
        const current = point(angle, level);
        if (!index) context.moveTo(current.x, current.y);
        else context.lineTo(current.x, current.y);
      });
      context.closePath();
      context.strokeStyle = level === 5 ? "#aebbc8" : "#dbe3ea";
      context.stroke();
    }
    angles.forEach((angle, index) => {
      const edge = point(angle, 5);
      context.beginPath();
      context.moveTo(center.x, center.y);
      context.lineTo(edge.x, edge.y);
      context.strokeStyle = "#d5dee7";
      context.stroke();
      const labelRadius = radius + 21 + (index % 2) * 13;
      const labelPoint = { x: center.x + Math.cos(angle) * labelRadius, y: center.y + Math.sin(angle) * labelRadius };
      context.fillStyle = rows[index].currentIndex == null ? "#8a96a3" : "#465b70";
      context.font = "700 9px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
      context.textAlign = Math.cos(angle) > 0.22 ? "left" : Math.cos(angle) < -0.22 ? "right" : "center";
      context.textBaseline = "middle";
      context.fillText(radarShortLabel(rows[index]), labelPoint.x, labelPoint.y);
    });
    context.setLineDash([]);
    const drawSeries = (values, { stroke, dashed = false, points = false, fill = "" }) => {
      const normalizedValues = values.map((value) => value == null || !Number.isFinite(Number(value)) ? null : Number(value));
      const complete = normalizedValues.every((value) => value != null);
      context.setLineDash(dashed ? [6, 5] : []);
      context.lineWidth = 2;
      context.strokeStyle = stroke;
      if (complete) {
        context.beginPath();
        normalizedValues.forEach((value, index) => {
          const current = point(angles[index], Math.max(0, Math.min(5, value)));
          if (!index) context.moveTo(current.x, current.y);
          else context.lineTo(current.x, current.y);
        });
        context.closePath();
        if (fill) {
          context.fillStyle = fill;
          context.fill();
        }
        context.stroke();
      } else {
        normalizedValues.forEach((value, index) => {
          const nextIndex = (index + 1) % normalizedValues.length;
          const nextValue = normalizedValues[nextIndex];
          if (value == null || nextValue == null) return;
          const start = point(angles[index], Math.max(0, Math.min(5, value)));
          const end = point(angles[nextIndex], Math.max(0, Math.min(5, nextValue)));
          context.beginPath();
          context.moveTo(start.x, start.y);
          context.lineTo(end.x, end.y);
          context.stroke();
        });
      }
      context.setLineDash([]);
      if (points) angles.forEach((angle, index) => {
        if (normalizedValues[index] == null) return;
        const current = point(angle, Math.max(0, Math.min(5, normalizedValues[index])));
        context.beginPath();
        context.arc(current.x, current.y, 2.8, 0, Math.PI * 2);
        context.fillStyle = "#f8fbfd";
        context.fill();
        context.lineWidth = 2;
        context.strokeStyle = stroke;
        context.stroke();
      });
    };
    drawSeries(rows.map((row) => row.targetIndex), { stroke: "#9a6d2f", dashed: true });
    drawSeries(rows.map((row) => row.currentIndex), { stroke: "#1676c5", points: true, fill: "rgba(22,118,197,.12)" });
    rows.forEach((row, index) => {
      if (row.currentIndex != null) return;
      const marker = point(angles[index], 0.16);
      context.beginPath();
      context.arc(marker.x, marker.y, 3.2, 0, Math.PI * 2);
      context.fillStyle = "#f8fbfd";
      context.fill();
      context.lineWidth = 1.5;
      context.strokeStyle = "#8a96a3";
      context.stroke();
    });
    context.fillStyle = "#738397";
    context.font = "600 10px ui-monospace, SFMono-Regular, Menlo, monospace";
    context.textAlign = "left";
    context.textBaseline = "middle";
    context.fillText("1", center.x + 6, center.y - radius / 5);
    context.fillText("5", center.x + 6, center.y - radius + 2);
  }

  function renderResultsTab(detail) {
    const result = detail.result;
    if (!result?.ok) return `<section class="maturity-v1-empty"><h3>结果尚未生成</h3><p>请先完成模板校验并执行后端评分计算。</p><button class="maturity-v1-button is-primary" type="button" data-maturity-action="calculate">开始计算</button></section>`;
    const summary = result.summary || {};
    if (!statisticsReadyForDisplay(detail)) return `<section class="maturity-v21-results-blocked sapd-stat-vibrancy" aria-label="评估结果尚不可用"><span>评估结果暂不可用</span><h2>请先完成全部适用评估点</h2><p>后端检测到 ${Number(summary.notScoredCount || 0)} 个未完成或无效评分${Number(summary.targetBelowCurrentCount || 0) ? `，其中 ${Number(summary.targetBelowCurrentCount)} 个目标等级低于当前评分计算等级` : ""}。评分完整前不输出成熟度统计、雷达或优先级。</p><div><button class="maturity-v1-button is-primary" type="button" data-maturity-action="open-review-tab">前往评分检查</button><button class="maturity-v1-button is-secondary" type="button" data-maturity-action="adjust-first-blocker">返回首个待调整项</button></div></section>`;
    const viewSwitch = `<div class="maturity-v2-result-views" role="tablist" aria-label="评估结果视图"><button class="${model.resultsView === "customer" ? "is-active" : ""}" type="button" role="tab" aria-selected="${model.resultsView === "customer"}" data-maturity-action="set-results-view" data-results-view="customer">客户评估结果</button><button class="${model.resultsView === "internal" ? "is-active" : ""}" type="button" role="tab" aria-selected="${model.resultsView === "internal"}" data-maturity-action="set-results-view" data-results-view="internal">评分明细清单</button><span>客户主结果最细到能力 L2</span></div>`;
    if (model.resultsView === "internal") return `${viewSwitch}${renderInternalAssessmentDetails(detail, true)}`;
    return `
      <div class="maturity-v1-results">
        ${viewSwitch}
        ${renderResultSummary(detail)}
        ${renderCapabilityRadar(detail)}
        ${renderCollapsibleResultSection({ className: "maturity-v23-capability-heat", eyebrow: "能力分数", title: "L2 能力分数清单", meta: `${list(result.capabilityResults).length} 个能力，按 T / G / M 展开`, body: renderCapabilityHeatTable(detail) })}
        ${renderCollapsibleResultSection({ className: "maturity-v23-overall-priority maturity-v33-overall-rankings-section", eyebrow: "能力排行", title: "L2 能力 Top 10", meta: "", body: renderOverallCapabilityTop10(detail) })}
        ${renderDimensionPriorityTop10(detail)}
        ${renderImprovementRoadmap(detail)}
      </div>
    `;
  }

  function renderCategoryComparison(rows) {
    return `<div class="maturity-v1-comparison-bars">${list(rows).map((row) => `<div><div><strong>${escapeHtml(row.code || row.name)}</strong><span>${escapeHtml(row.name)}</span></div><div class="maturity-v1-dual-bar"><i class="is-target" style="width:${percent(Number(row.targetIndex || 0) * 20)}%"></i><i class="is-current ${levelTone(row.currentLevel)}" style="width:${percent(Number(row.currentIndex || 0) * 20)}%"></i></div><b>${row.currentIndex ?? "-"} / ${row.targetIndex ?? "-"}</b></div>`).join("")}</div>`;
  }

  function renderDistribution(rows) {
    const total = list(rows).reduce((sum, item) => sum + Number(item.count || 0), 0) || 1;
    return `<div class="maturity-v1-distribution"><div class="maturity-v1-distribution-bar">${list(rows).map((item) => `<i class="${levelTone(item.level)}" style="width:${(100 * Number(item.count || 0)) / total}%" title="${escapeHtml(item.level)} ${item.count}"></i>`).join("")}</div><div class="maturity-v1-distribution-legend">${list(rows).map((item) => `<span class="${levelTone(item.level)}"><i></i>${escapeHtml(item.level)} <b>${item.count}</b></span>`).join("")}</div></div>`;
  }

  function priorityTone(priority) {
    return priority === "高" ? "is-high" : priority === "中" ? "is-medium" : priority === "低" ? "is-low" : "is-none";
  }

  function renderPriorityBadge(priority) {
    return `<span class="maturity-v20-priority ${priorityTone(priority)}">${escapeHtml(priority || "—")}</span>`;
  }

  function renderCollapsibleResultSection({ className = "", eyebrow, title, meta, body, open = true }) {
    return `<details class="maturity-v1-section maturity-v23-result-section ${escapeHtml(className)}"${open ? " open" : ""}><summary class="maturity-v1-panel-heading"><div><span>${escapeHtml(eyebrow)}</span><h3>${escapeHtml(title)}</h3></div><span class="maturity-v23-result-section-meta">${escapeHtml(meta)}<b><i>展开</i><i>收起</i></b></span></summary><div class="maturity-v23-result-section-body">${body}</div></details>`;
  }

  function renderOverallCapabilityTop10(detail) {
    const result = detail?.result || {};
    const leadingRows = list(result.capabilityResults)
      .filter((row) => row.currentIndex != null && Number.isFinite(Number(row.currentIndex)))
      .sort((left, right) => Number(right.currentIndex) - Number(left.currentIndex)
        || Number(right.targetAchievementRate || 0) - Number(left.targetAchievementRate || 0)
        || text(left.code).localeCompare(text(right.code), "zh-Hans-CN", { numeric: true }))
      .slice(0, 10);
    const improvementRows = list(result.gapItems).slice(0, 10);
    const leadingTable = leadingRows.length
      ? `<div class="maturity-v36-ranking-columns"><i></i><span>能力</span><span>当前成熟度</span><span>目标成熟度</span><span>目标达成率</span></div><ol class="maturity-v34-overall-list is-leading">${leadingRows.map((row, index) => `<li><b>${index + 1}</b><span><strong>${escapeHtml(row.code)}</strong><small title="${escapeHtml(row.name)}">${escapeHtml(row.name)}</small></span><em><strong>${Number(row.currentIndex).toFixed(2)}</strong><small>${escapeHtml(row.currentLevel)} 当前</small></em><em><strong>${row.targetIndex == null ? "—" : Number(row.targetIndex).toFixed(2)}</strong><small>${escapeHtml(row.targetLevel || "未设置")} 目标</small></em><em><strong>${row.targetAchievementRate == null ? "—" : `${Number(row.targetAchievementRate).toFixed(0)}%`}</strong><small>目标达成</small></em></li>`).join("")}</ol>`
      : `<div class="maturity-v1-empty-inline">当前没有可计算的成熟度领先能力。</div>`;
    const improvementTable = improvementRows.length
      ? `<div class="maturity-v36-ranking-columns"><i></i><span>能力</span><span>当前成熟度</span><span>目标成熟度</span><span>优先级分数</span></div><ol class="maturity-v34-overall-list is-improvement">${improvementRows.map((row, index) => `<li><b>${index + 1}</b><span><strong>${escapeHtml(row.capabilityCode)}</strong><small title="${escapeHtml(row.capabilityName)}">${escapeHtml(row.capabilityName)}</small></span><em><strong>${row.currentIndex == null ? "—" : Number(row.currentIndex).toFixed(2)}</strong><small>${escapeHtml(row.currentLevel || "未评分")} 当前</small></em><em><strong>${row.targetIndex == null ? "—" : Number(row.targetIndex).toFixed(2)}</strong><small>${escapeHtml(row.targetLevel || "未设置")} 目标</small></em><em><strong>${Number(row.priorityScore).toFixed(1)}</strong><small>${escapeHtml(row.priority)}优先级</small></em></li>`).join("")}</ol>`
      : `<div class="maturity-v1-empty-inline">当前没有需要优先改进的成熟度差距。</div>`;
    return `<div class="maturity-v33-overall-rankings"><section><header><span>优势能力</span><h4>成熟度领先 Top 10</h4></header>${leadingTable}</section><section><header><span>差距能力</span><h4>改进优先 Top 10</h4></header>${improvementTable}</section></div>`;
  }

  function renderDimensionRankingRows(rows, key, priorityByCapability, { showPriority = false } = {}) {
    if (!rows.length) return `<ol><li class="is-empty">当前没有可展示的 L2 能力</li></ol>`;
    return `<ol>${rows.map((row, index) => { const priority = priorityByCapability.get(row.id); return `<li><b>${index + 1}</b><span><strong>${escapeHtml(row.code)}</strong><small title="${escapeHtml(row.name)}">${escapeHtml(row.name)}</small></span><em>${Number(row.dimensionResults[key]).toFixed(2)}</em>${showPriority ? renderPriorityBadge(priority?.priority) : "<i></i>"}</li>`; }).join("")}</ol>`;
  }

  function renderDimensionPriorityTop10(detail, { open = true } = {}) {
    const result = detail?.result || {};
    const priorityByCapability = new Map(list(result.gapItems).map((item) => [item.capabilityId, item]));
    const capabilityRows = list(result.capabilityResults);
    const panels = DIMENSIONS.map(([key, label]) => {
      const leadingRows = capabilityRows
        .filter((row) => row.dimensionResults?.[key] != null && Number.isFinite(Number(row.dimensionResults[key])))
        .sort((left, right) => Number(right.dimensionResults[key]) - Number(left.dimensionResults[key])
          || text(left.code).localeCompare(text(right.code), "zh-Hans-CN", { numeric: true }))
        .slice(0, 10);
      const improvementRows = capabilityRows
        .filter((row) => priorityByCapability.has(row.id) && row.dimensionResults?.[key] != null && Number.isFinite(Number(row.dimensionResults[key])))
        .sort((left, right) => Number(left.dimensionResults[key]) - Number(right.dimensionResults[key]) || Number(priorityByCapability.get(right.id)?.priorityScore || 0) - Number(priorityByCapability.get(left.id)?.priorityScore || 0) || text(left.code).localeCompare(text(right.code), "zh-Hans-CN", { numeric: true }))
        .slice(0, 10);
      return `<section data-priority-dimension="${escapeHtml(key)}"><header><div><span>评估维度</span><strong>${escapeHtml(label)}</strong></div><small>当前维度得分</small></header><div class="maturity-v33-dimension-rankings"><section><h4>领先能力 Top 10</h4>${renderDimensionRankingRows(leadingRows, key, priorityByCapability)}</section><section><h4>改进优先 Top 10</h4>${renderDimensionRankingRows(improvementRows, key, priorityByCapability, { showPriority: true })}</section></div></section>`;
    }).join("");
    return renderCollapsibleResultSection({ className: "maturity-v20-dimension-priorities maturity-v33-dimension-priorities", eyebrow: "维度评估", title: "维度评估 L2 能力 Top 10", meta: "", body: `<div class="maturity-v20-priority-grid maturity-v33-dimension-grid">${panels}</div>`, open });
  }

  function renderImprovementRoadmap(detail, { open = true } = {}) {
    const rows = improvementRoadmapRows(detail);
    if (!rows.length) return renderCollapsibleResultSection({ className: "maturity-v35-improvement-roadmap", eyebrow: "行动规划", title: "改进路线图", meta: "0 项", body: `<div class="maturity-v1-empty-inline">当前没有可转化为行动计划的成熟度差距。</div>`, open });
    const body = `<div class="maturity-v1-table-wrap maturity-v35-roadmap-scroll"><table class="maturity-v1-table maturity-v35-roadmap-table"><thead><tr><th>优先级</th><th>L2 能力</th><th>当前 / 目标</th><th>改进行动</th><th>负责人</th><th>资源投入</th><th>依赖事项</th><th>状态</th></tr></thead><tbody>${rows.map((row) => `<tr data-maturity-roadmap-row="${escapeHtml(row.capabilityId)}"><td><b class="maturity-v35-roadmap-rank">${row.rank}</b>${renderPriorityBadge(row.priority)}<small>${row.priorityScore == null ? "—" : Number(row.priorityScore).toFixed(1)}</small></td><td><span class="maturity-v1-code">${escapeHtml(row.capabilityCode)}</span><strong>${escapeHtml(row.capabilityName)}</strong><small>差距 ${row.gapIndex == null ? "—" : Number(row.gapIndex).toFixed(2)}</small></td><td><strong>${escapeHtml(row.currentLevel || "—")} → ${escapeHtml(row.targetLevel || "—")}</strong></td><td><textarea rows="3" data-maturity-roadmap-field="action" data-capability-id="${escapeHtml(row.capabilityId)}" placeholder="填写可执行的改进行动">${escapeHtml(row.action)}</textarea></td><td><input type="text" value="${escapeHtml(row.owner)}" data-maturity-roadmap-field="owner" data-capability-id="${escapeHtml(row.capabilityId)}" placeholder="责任部门 / 人" /></td><td><input type="text" value="${escapeHtml(row.resources)}" data-maturity-roadmap-field="resources" data-capability-id="${escapeHtml(row.capabilityId)}" placeholder="预算、人力等" /></td><td><textarea rows="2" data-maturity-roadmap-field="dependencies" data-capability-id="${escapeHtml(row.capabilityId)}" placeholder="前置条件或协同事项">${escapeHtml(row.dependencies)}</textarea></td><td><select data-maturity-roadmap-field="status" data-capability-id="${escapeHtml(row.capabilityId)}">${ROADMAP_STATUSES.map((status) => `<option value="${status}"${row.status === status ? " selected" : ""}>${status}</option>`).join("")}</select></td></tr>`).join("")}</tbody></table></div>`;
    return renderCollapsibleResultSection({ className: "maturity-v35-improvement-roadmap", eyebrow: "行动规划", title: "改进路线图", meta: `${rows.length} 项 · 自动保存并同步到报告`, body, open });
  }

  function renderCapabilityHeatTable(detail) {
    const gapItems = list(detail?.result?.gapItems);
    const priorityByCapability = new Map(gapItems.map((item) => [item.capabilityId, item.priority]));
    const groups = capabilityRadarGroups(detail);
    const groupBodies = groups.map((group) => {
      const sorted = [...group.rows].sort((left, right) => Number(right.gapIndex || 0) - Number(left.gapIndex || 0) || text(left.code).localeCompare(text(right.code), "zh-Hans-CN", { numeric: true }));
      const rows = sorted.map((row) => `<tr><td><span class="maturity-v1-code">${escapeHtml(row.code)}</span><strong>${escapeHtml(row.name)}</strong></td><td><span class="maturity-v1-heat-cell ${levelTone(row.currentLevel)}">${escapeHtml(row.currentLevel)}</span><small>${row.currentIndex ?? "-"}</small></td><td>${escapeHtml(row.targetLevel)}<small>${row.targetIndex ?? "-"}</small></td><td>${row.gapIndex ?? "-"}</td><td>${renderPriorityBadge(priorityByCapability.get(row.id))}</td><td>${row.targetAchievementRate == null ? "-" : `${Number(row.targetAchievementRate).toFixed(0)}%`}</td>${DIMENSIONS.map(([key]) => `<td><span class="maturity-v2-dimension-result">${row.dimensionResults?.[key] ?? "-"}</span></td>`).join("")}<td>${Number(row.evidenceCoverage || 0).toFixed(0)}%</td></tr>`).join("");
      return `<tbody data-radar-group="${escapeHtml(group.code)}"><tr class="maturity-v23-heat-group"><th colspan="11"><span><i></i><strong>${escapeHtml(group.code)} ${escapeHtml(group.name)}</strong></span><b>${group.rows.length} 项 L2</b></th></tr>${rows}</tbody>`;
    }).join("");
    return `<div class="maturity-v1-table-wrap"><table class="maturity-v1-table maturity-v1-heat-table maturity-v2-capability-table"><thead><tr><th>L2 安全能力</th><th>当前</th><th>目标</th><th>差距</th><th>优先级</th><th>达成率</th><th>组织</th><th>流程</th><th>工具</th><th>数据</th><th>证据覆盖</th></tr></thead>${groupBodies}</table></div>`;
  }

  function renderInternalAssessmentDetails(detail, open = false) {
    const result = detail.result || {};
    const focusById = new Map(list(detail.template.focuses).map((item) => [item.id, item]));
    const scoreEntryById = new Map(list(detail.scoreEntries).map((item) => [item.scoreItemId, item]));
    const rows = list(result.scoreItemResults);
    return `<details class="maturity-v1-section maturity-v2-internal-details"${open ? " open" : ""}><summary><span>内部评估明细</span><strong>关注点、评估点、四维评分与证据</strong><small>${rows.length} 个评估点，仅用于评估工作台和报告附录</small></summary><div class="maturity-v1-table-wrap"><table class="maturity-v1-table"><thead><tr><th>关注点 / 评估点</th><th>类型 / 作用域</th><th>四维最终值</th><th>当前</th><th>目标</th><th>达成率</th><th>评估证据</th><th>状态</th></tr></thead><tbody>${rows.map((row) => {
      const focus = focusById.get(row.focusId) || {};
      const entry = scoreEntryById.get(row.id) || {};
      const isService = row.itemType === "SERVICE";
      const typeLabel = isService ? "" : row.itemType === "FOCUS" ? "关注点" : "评估点";
      const scopeCode = isService ? row.scopeCode || "ALL" : "关注点整体";
      const evidenceFilled = (entry.evidenceLevel && entry.evidenceLevel !== "E0") || Boolean(text(entry.evidenceSummary).trim());
      const statusLabel = row.status === "scored" ? "已完成" : row.status === "not_applicable" ? "不适用" : row.status === "incomplete" || row.status === "not_scored" ? "未完成" : row.isComplete ? "已完成" : "未完成";
      const statusToneClass = statusLabel === "已完成" ? "is-good" : statusLabel === "不适用" ? "is-muted" : "is-warn";
      return `<tr><td><strong>${escapeHtml(focus.code || "")} ${escapeHtml(focus.name || "关注点")}</strong><span>${escapeHtml(row.serviceCode || "")} ${escapeHtml(row.serviceName || "关注点评估点")}</span></td><td>${typeLabel ? `<span class="maturity-v1-row-status is-muted">${escapeHtml(typeLabel)}</span>` : ""}<small>${escapeHtml(scopeCode)}</small></td><td>${DIMENSIONS.map(([key]) => row.dimensionResults?.[key] ?? "-").join(" / ")}</td><td>${escapeHtml(row.currentLevel)} ${row.currentIndex ?? ""}</td><td>${escapeHtml(row.targetLevel)} ${row.targetIndex ?? ""}</td><td>${row.targetAchievementRate == null ? "-" : `${Number(row.targetAchievementRate).toFixed(0)}%`}</td><td><span class="maturity-v1-row-status ${evidenceFilled ? "is-good" : "is-muted"}">${evidenceFilled ? "已填报" : "未填报"}</span></td><td><span class="maturity-v1-row-status ${statusToneClass}">${statusLabel}</span></td></tr>`;
    }).join("")}</tbody></table></div></details>`;
  }

  function renderGapTable(rows, limit) {
    const visible = list(rows).slice(0, limit);
    if (!visible.length) return `<div class="maturity-v1-empty-inline">当前没有可计算的成熟度差距。</div>`;
    return `<div class="maturity-v1-table-wrap"><table class="maturity-v1-table maturity-v1-gap-table"><thead><tr><th>优先级</th><th>能力</th><th>当前</th><th>目标</th><th>差距</th><th>优先级分数</th><th>建议方向</th></tr></thead><tbody>${visible.map((item) => `<tr><td><span class="maturity-v1-priority is-${item.priority === "高" ? "high" : item.priority === "中" ? "medium" : "low"}">${escapeHtml(item.priority)}</span></td><td><span class="maturity-v1-code">${escapeHtml(item.capabilityCode)}</span><strong>${escapeHtml(item.capabilityName)}</strong></td><td>${escapeHtml(item.currentLevel)}</td><td>${escapeHtml(item.targetLevel)}</td><td>${item.gapIndex}</td><td>${item.priorityScore}</td><td><span>${list(item.recommendations).slice(0, 2).map((row) => escapeHtml(row.type)).join(" / ")}</span><small>${list(item.relatedServices).slice(0, 2).map(escapeHtml).join("；") || "需人工确认建设措施"}</small></td></tr>`).join("")}</tbody></table></div>`;
  }

  function reportNarrativeSections() {
    return [
      { key: "executiveSummary", index: "一", label: "评估概况", helper: "请概述本次评估背景、范围、方法与结论要点（建议 3—6 行）。", placeholder: "填写评估背景、范围、方法、总体成熟度及对业务的影响。" },
      { key: "keyFindings", index: "二", label: "关键发现", helper: "请基于结果数据补充关键发现与差距洞察（建议 3—6 条要点）。", placeholder: "填写关键优势、主要短板、形成原因及重要约束。" },
      { key: "managementRecommendations", index: "三", label: "提升建议", helper: "请提出针对性的改进方向与优先建议（建议 3—6 条要点）。", placeholder: "填写改进方向、建议优先级、责任主体和资源安排。" },
      { key: "nextSteps", index: "四", label: "下一步计划", helper: "请明确后续行动计划、里程碑与责任人（建议 3—6 条要点）。", placeholder: "填写近期行动、里程碑、责任人与复评安排。" },
    ];
  }

  function renderReportNavigation(detail) {
    const report = detail?.report;
    const exportReady = reportExportReady(report);
    const previouslyGenerated = reportPreviouslyGenerated(detail);
    const automaticSections = [
      ["report-overall", "总体结果"],
      ["report-capability-radar", "全能力分组雷达"],
      ["report-dimension-radar", "四维成熟度雷达"],
      ["report-category-coverage", "能力类别评分"],
      ["report-l2-results", "L2 能力表"],
      ["report-overall-top10", "总体优先级 Top 10"],
      ["report-dimension-top10", "四维优先改进 Top 10"],
      ["report-result-analysis", "成熟度与证据分布"],
      ["report-internal-detail", "评分明细附录"],
    ];
    return `<aside class="maturity-v37-report-nav" aria-label="评估报告章节导航">
      <header><span>报告结构</span><h2>报告章节导航</h2></header>
      <nav aria-label="人工填写章节">${reportNarrativeSections().map((section) => `<button type="button" data-maturity-action="scroll-report-section" data-report-section-target="report-${escapeHtml(section.key)}"><b>${section.index}</b><span>${escapeHtml(section.label)}</span></button>`).join("")}</nav>
      <section><header><strong>结果章节自动同步</strong><span title="评估结果更新后，重新生成报告即可同步全部统计。">说明</span></header><p>以下结果章节均直接使用评估结果数据；重新生成后导出文件会同步更新。</p><div>${automaticSections.map(([id, label]) => `<button type="button" data-maturity-action="scroll-report-section" data-report-section-target="${id}"><em>同步</em><span>${escapeHtml(label)}</span></button>`).join("")}</div></section>
      <footer class="${detail.reportNarrativeDirty || (previouslyGenerated && !exportReady) ? "is-dirty" : exportReady ? "is-synced" : ""}"><strong>${detail.reportNarrativeDirty ? "汇报内容待更新" : exportReady ? "结果与报告已同步" : previouslyGenerated ? "评估报告需要更新" : "尚未生成评估报告"}</strong><span>${report ? `快照 ${escapeHtml(report.id)}` : previouslyGenerated ? "当前结果尚未同步到导出文件" : "完成编辑后首次生成评估报告"}</span></footer>
    </aside>`;
  }

  function renderReportOverall(detail) {
    const summary = summaryOf(detail);
    const applicable = Number(summary.applicableItemCount || 0);
    const excluded = Number(summary.notApplicableCount || 0);
    const completed = Number(summary.scoredItemCount || Math.max(0, applicable - Number(summary.notScoredCount || 0)));
    const currentLevel = LEVELS.includes(summary.currentLevel) ? summary.currentLevel : "—";
    const targetLevel = LEVELS.includes(summary.targetLevel) ? summary.targetLevel : "—";
    const currentIndex = Number.isFinite(Number(summary.currentIndex)) ? Number(summary.currentIndex).toFixed(2) : "—";
    const targetIndex = Number.isFinite(Number(summary.targetIndex)) ? Number(summary.targetIndex).toFixed(2) : "—";
    const categoryRows = list(detail?.result?.categoryResults).slice(0, 3);
    return `<section id="report-overall" class="maturity-v37-report-overall" data-report-section="report-overall" aria-labelledby="maturityReportOverallTitle">
      <header><i aria-hidden="true"></i><h2 id="maturityReportOverallTitle">总体结果（关键结论）</h2></header>
      <div class="maturity-v37-report-metrics">
        <article><span>当前成熟度</span><strong>${escapeHtml(currentLevel)}${LEVEL_NAMES[currentLevel] ? ` <small>${escapeHtml(LEVEL_NAMES[currentLevel])}</small>` : ""}</strong><small>成熟度指数 ${escapeHtml(currentIndex)} / 5.00</small></article>
        <article><span>目标成熟度</span><strong>${escapeHtml(targetLevel)}</strong><small>目标指数 ${escapeHtml(targetIndex)} / 5.00</small></article>
        <article><span>适用性</span><strong>${applicable} / ${applicable + excluded || "—"}</strong><small>适用评估点 / 全部评估点</small></article>
        <article><span>评估进度</span><strong>${completed} / ${applicable || "—"}</strong><small>已完成 / 适用评估点</small></article>
      </div>
      <div class="maturity-v37-report-categories"><span>能力类别评分</span>${categoryRows.map((row) => `<article data-radar-group="${escapeHtml(row.code)}"><i></i><div><strong>${escapeHtml(row.code || compactChineseName(row.name))} ${escapeHtml(compactChineseName(row.name))}</strong><span><b>${row.currentIndex == null ? "—" : Number(row.currentIndex).toFixed(2)}</b> / 目标 ${row.targetIndex == null ? "—" : Number(row.targetIndex).toFixed(2)}</span></div></article>`).join("")}</div>
    </section>`;
  }

  function renderReportCategoryCoverage(detail) {
    const groups = capabilityRadarGroups(detail);
    const scoredCount = groups.flatMap((group) => group.rows).filter((row) => row.currentIndex != null).length;
    const totalCount = groups.reduce((sum, group) => sum + group.rows.length, 0);
    return `<section id="report-category-coverage" class="maturity-v37-report-panel maturity-v37-report-coverage" data-report-section="report-category-coverage">
      <header><h3>L2 评估覆盖与差距</h3><span>按能力类别</span></header><p><strong>${scoredCount} / ${totalCount || "—"}</strong> 已评分的 L2 能力</p>
      <div>${groups.map((group) => { const belowTarget = group.rows.filter((row) => Number(row.gapIndex) > 0).length; return `<article data-radar-group="${escapeHtml(group.code)}"><strong>${escapeHtml(group.code)} ${escapeHtml(group.name)}</strong><b>${group.rows.length}<small> 个 L2 能力</small></b><span>低于目标 ${belowTarget}</span></article>`; }).join("")}</div>
    </section>`;
  }

  function renderReportPriorityTable(detail) {
    const rows = list(detail?.result?.gapItems).slice(0, 5);
    return `<section class="maturity-v37-report-panel maturity-v37-report-priority" aria-labelledby="maturityReportPriorityTitle"><header><h3 id="maturityReportPriorityTitle">总体优先级差距 Top 5</h3><span>后端优先级与分数</span></header><div class="maturity-v1-table-wrap"><table><thead><tr><th>排名</th><th>能力编号</th><th>能力名称</th><th>当前</th><th>目标</th><th>差距</th><th>优先级得分</th></tr></thead><tbody>${rows.length ? rows.map((row, index) => `<tr><td>${index + 1}</td><td><strong>${escapeHtml(row.capabilityCode)}</strong></td><td>${escapeHtml(row.capabilityName)}</td><td>${escapeHtml(row.currentLevel || "—")}</td><td>${escapeHtml(row.targetLevel || "—")}</td><td>${row.gapIndex == null ? "—" : Number(row.gapIndex).toFixed(2)}</td><td><span class="maturity-v37-priority-score"><i style="width:${percent(Number(row.priorityScore || 0))}%"></i></span><b>${row.priorityScore == null ? "—" : Number(row.priorityScore).toFixed(1)}</b></td></tr>`).join("") : `<tr><td colspan="7">当前没有已计算差距。</td></tr>`}</tbody></table></div></section>`;
  }

  function renderReportNarrative(detail, section, narrative) {
    const editing = model.reportEditingSection === section.key;
    const value = text(narrative[section.key]);
    return `<section id="report-${escapeHtml(section.key)}" class="maturity-v37-report-narrative ${editing ? "is-editing" : ""}" data-report-section="report-${escapeHtml(section.key)}">
      <header><h3>${section.index}、${escapeHtml(section.label)}</h3><button type="button" data-maturity-action="${editing ? "finish-report-section" : "edit-report-section"}" data-report-field="${escapeHtml(section.key)}">${editing ? "完成" : "编辑"}</button></header>
      ${editing ? `<textarea rows="5" data-maturity-report-field="${escapeHtml(section.key)}" placeholder="${escapeHtml(section.placeholder)}">${escapeHtml(value)}</textarea><p>内容自动保存在当前项目；重新生成报告后同步到 HTML 与 Markdown。</p>` : `<p class="${value.trim() ? "has-content" : ""}">${value.trim() ? escapeHtml(value) : escapeHtml(section.helper)}</p>`}
    </section>`;
  }

  function renderReportResultAppendix(detail) {
    const groups = capabilityRadarGroups(detail);
    return `<section class="maturity-v37-report-appendix" aria-labelledby="maturityReportAppendixTitle">
      <header><span>完整自动同步结果</span><h2 id="maturityReportAppendixTitle">评估结果与数据附录</h2><p>以下章节与“评估结果”使用同一份结果对象，不在报告页面重新计算统计口径。</p></header>
      <div id="report-result-analysis" data-report-section="report-result-analysis">${renderCollapsibleResultSection({ className: "maturity-v37-report-analysis", eyebrow: "分层统计", title: "T / G / M、L1 与结果评价", meta: "成熟度与证据分布", body: renderRadarAnalysis(detail, groups), open: false })}</div>
      <div id="report-l2-results" data-report-section="report-l2-results">${renderCollapsibleResultSection({ className: "maturity-v37-report-l2", eyebrow: "完整数据", title: "L2 能力分数清单", meta: `${list(detail?.result?.capabilityResults).length} 项 L2`, body: renderCapabilityHeatTable(detail), open: false })}</div>
      <div id="report-overall-top10" data-report-section="report-overall-top10">${renderCollapsibleResultSection({ className: "maturity-v37-report-top10", eyebrow: "能力排行", title: "总体领先与改进优先 Top 10", meta: "后端结果排序", body: renderOverallCapabilityTop10(detail), open: false })}</div>
      <div id="report-dimension-top10" data-report-section="report-dimension-top10">${renderDimensionPriorityTop10(detail, { open: false })}</div>
      <div id="report-improvement-roadmap" data-report-section="report-improvement-roadmap">${renderImprovementRoadmap(detail, { open: false })}</div>
      <div id="report-internal-detail" data-report-section="report-internal-detail">${renderInternalAssessmentDetails(detail, false)}</div>
    </section>`;
  }

  function reportV2Conclusions(detail) {
    return { ...defaultReportV2Conclusions(), ...(detail?.reportV2Conclusions || {}) };
  }

  function reportV2Facts(detail) {
    const summary = summaryOf(detail);
    const capabilityRows = list(detail?.result?.capabilityResults);
    const scoredCapabilities = capabilityRows.filter((row) => row.currentIndex != null);
    const belowTarget = capabilityRows.filter((row) => row.currentIndex != null && Number(row.gapIndex || 0) > 0);
    const topGaps = list(detail?.result?.gapItems).slice(0, 5);
    const roadmap = improvementRoadmapRows(detail);
    const dimensions = dimensionProfile(summary.dimensionResults || {});
    const currentIndex = Number.isFinite(Number(summary.currentIndex)) ? Number(summary.currentIndex).toFixed(2) : "—";
    const targetIndex = Number.isFinite(Number(summary.targetIndex)) ? Number(summary.targetIndex).toFixed(2) : "—";
    const gapIndex = Number.isFinite(Number(summary.gapIndex)) ? Number(summary.gapIndex).toFixed(2) : Number.isFinite(Number(summary.targetIndex)) && Number.isFinite(Number(summary.currentIndex)) ? (Number(summary.targetIndex) - Number(summary.currentIndex)).toFixed(2) : "—";
    const evidenceCoverage = Number.isFinite(Number(summary.evidenceCoverage)) ? `${Number(summary.evidenceCoverage).toFixed(1)}%` : "—";
    const topGapNames = topGaps.map((row) => `${row.capabilityCode || ""} ${row.capabilityName || ""}`.trim()).filter(Boolean);
    return {
      summary,
      capabilityRows,
      scoredCapabilities,
      belowTarget,
      topGaps,
      roadmap,
      dimensions,
      currentIndex,
      targetIndex,
      gapIndex,
      evidenceCoverage,
      topGapNames,
      missingOwnerCount: roadmap.filter((row) => !text(row.owner).trim()).length,
      missingResourceCount: roadmap.filter((row) => !text(row.resources).trim()).length,
      pendingRoadmapCount: roadmap.filter((row) => row.status === "待规划").length,
    };
  }

  function reportV2Evidence(fieldId, facts) {
    const dimensionText = facts.dimensions.map((row) => `${row.label} ${row.value == null ? "—" : row.value.toFixed(2)}`).join("；");
    const topGapText = facts.topGapNames.length ? facts.topGapNames.join("、") : "当前无可用差距排名";
    const maturityText = `当前 ${facts.summary.currentLevel || "—"} / ${facts.currentIndex}；目标 ${facts.summary.targetLevel || "—"} / ${facts.targetIndex}；差距 ${facts.gapIndex}`;
    const coverageText = `${facts.scoredCapabilities.length}/${facts.capabilityRows.length || "—"} 项 L2 已评分，${facts.belowTarget.length} 项低于目标；证据覆盖 ${facts.evidenceCoverage}`;
    const roadmapText = `Top ${facts.roadmap.length} 行动项中：负责人待补 ${facts.missingOwnerCount} 项，资源待补 ${facts.missingResourceCount} 项，待规划 ${facts.pendingRoadmapCount} 项`;
    const evidenceByField = {
      diagnosticInterpretation: `${coverageText}；当前 Top 5 差距：${topGapText}`,
      diagnosticManagementImplication: `${dimensionText}；总体目标 ${facts.targetIndex}`,
      executiveSummary: `${maturityText}；${facts.belowTarget.length}/${facts.capabilityRows.length || "—"} 项 L2 低于目标`,
      keyFindings: `${dimensionText}；证据覆盖 ${facts.evidenceCoverage}`,
      managementRecommendations: `后端差距排序 Top 5：${topGapText}`,
      nextSteps: roadmapText,
      executionRiskConclusion: roadmapText,
      executiveConclusionTitle: `${maturityText}；低于目标 L2 ${facts.belowTarget.length} 项`,
      executiveCurrentState: maturityText,
      executiveJudgement: `${coverageText}；${dimensionText}`,
      executiveDecisionRecommendation: `Top 5 差距：${topGapText}；${roadmapText}`,
      executiveMeetingDecision: `${maturityText}；当前行动登记册 ${facts.roadmap.length} 项`,
      decisionResponsibility: `Top 5 差距：${topGapText}；负责人待补 ${facts.missingOwnerCount} 项`,
      decisionResources: `资源投入待补 ${facts.missingResourceCount} 项；Top 5 差距：${topGapText}`,
      decisionCadence: `待规划行动 ${facts.pendingRoadmapCount} 项；评估完成度 ${Number(facts.summary.completionRate || 0).toFixed(0)}%`,
    };
    return evidenceByField[fieldId] || maturityText;
  }

  function reportV2Progress(detail) {
    const conclusions = reportV2Conclusions(detail);
    const filled = REPORT_V2_FIELDS.filter((field) => text(conclusions[field.id]).trim()).length;
    return { conclusions, filled, total: REPORT_V2_FIELDS.length, percent: REPORT_V2_FIELDS.length ? (filled / REPORT_V2_FIELDS.length) * 100 : 0 };
  }

  function renderReportV2StageNavigation(detail, progress) {
    return `<aside class="maturity-v38-stage-nav" aria-label="评估报告 V2 编制阶段">
      <header><span>编制顺序</span><h2>从数据到管理决议</h2></header>
      <nav>${REPORT_V2_STAGES.map((stage) => { const fields = REPORT_V2_FIELDS.filter((field) => field.stage === stage.id); const filled = fields.filter((field) => text(progress.conclusions[field.id]).trim()).length; return `<button class="${model.reportV2Stage === stage.id ? "is-active" : ""}" type="button" data-maturity-action="select-report-v2-stage" data-report-v2-stage="${stage.id}"><b>${stage.index}</b><span><strong>${escapeHtml(stage.label)}</strong><small>${escapeHtml(stage.note)}</small></span><em data-report-v2-stage-count="${stage.id}">${filled}/${fields.length}</em></button>`; }).join("")}</nav>
      <footer><strong data-report-v2-state>${progress.filled === progress.total ? "内容已齐，可提交复核" : `尚缺 ${progress.total - progress.filled} 项人工结论`}</strong><span>当前为独立 V2 草稿，不影响原评估报告。</span></footer>
    </aside>`;
  }

  function renderReportV2AuthoringRow(field, conclusions, facts) {
    const value = text(conclusions[field.id]);
    return `<article class="maturity-v38-authoring-row" data-report-v2-field-row="${escapeHtml(field.id)}">
      <div class="maturity-v38-system-evidence"><span>系统依据</span><p>${escapeHtml(reportV2Evidence(field.id, facts))}</p></div>
      <div class="maturity-v38-writing-guide"><span>填写参考</span><strong>${escapeHtml(field.label)}</strong><p>${escapeHtml(field.question)}</p><small>建议结构：${escapeHtml(field.structure)}</small></div>
      <label class="maturity-v38-manual-input"><span>人工填写 <small>必填 · ${field.maxLength} 字以内</small></span><textarea rows="${field.singleLine ? 2 : 5}" maxlength="${field.maxLength}" data-maturity-report-v2-field="${escapeHtml(field.id)}" data-report-input="${escapeHtml(field.id)}" data-stage="${field.stage}" aria-label="${escapeHtml(field.label)}" aria-required="true" placeholder="请填写${escapeHtml(field.label)}">${escapeHtml(value)}</textarea><em><b data-report-v2-field-count="${escapeHtml(field.id)}">${value.trim().length}</b> / ${field.maxLength}</em></label>
    </article>`;
  }

  function renderReportV2Authoring(detail, progress, facts) {
    const stage = REPORT_V2_STAGES.find((item) => item.id === model.reportV2Stage) || REPORT_V2_STAGES[0];
    const fields = REPORT_V2_FIELDS.filter((field) => field.stage === stage.id);
    const filled = fields.filter((field) => text(progress.conclusions[field.id]).trim()).length;
    return `<section class="maturity-v38-authoring" data-report-authoring="sapd-maturity-report-v2">
      <header><div><span>阶段 ${stage.index}</span><h2>${escapeHtml(stage.label)}</h2><p>${escapeHtml(stage.note)}</p></div><strong>${filled} / ${fields.length} 已填写</strong></header>
      <div class="maturity-v38-authoring-columns" aria-hidden="true"><span>系统依据</span><span>填写问题与表达结构</span><span>人工填写内容</span></div>
      <div class="maturity-v38-authoring-rows">${fields.map((field) => renderReportV2AuthoringRow(field, progress.conclusions, facts)).join("")}</div>
    </section>`;
  }

  function renderReportV2PreviewField(fieldId, conclusions) {
    const field = REPORT_V2_FIELDS.find((item) => item.id === fieldId);
    if (!field) return "";
    const value = text(conclusions[fieldId]);
    return `<article class="maturity-v38-preview-field ${value.trim() ? "has-content" : "is-empty"}"><header><span>人工结论</span><strong>${escapeHtml(field.label)}</strong></header><div role="textbox" contenteditable="true" aria-label="${escapeHtml(field.label)}" aria-required="true" data-maturity-report-v2-preview-field="${escapeHtml(field.id)}" data-report-field="${escapeHtml(field.id)}" data-max-length="${field.maxLength}" data-placeholder="待人工填写：${escapeHtml(field.label)}">${escapeHtml(value)}</div></article>`;
  }

  function renderReportV2PreviewSection(title, index, fieldIds, conclusions) {
    return `<section class="maturity-v38-preview-section" data-report-section="report-v2-${escapeHtml(index)}"><header><span>${escapeHtml(index)}</span><div><h3>${escapeHtml(title)}</h3><p>人工结论与上方编制工作台按字段 ID 实时同步</p></div></header><div>${fieldIds.map((fieldId) => renderReportV2PreviewField(fieldId, conclusions)).join("")}</div></section>`;
  }

  function renderReportV2FormalPreview(detail, progress) {
    const summary = summaryOf(detail);
    const capabilityAxes = list(detail?.result?.capabilityResults);
    return `<section id="maturityReportV2Preview" class="maturity-v38-formal-preview" data-report-model="sapd-maturity-report-v2-preview">
      <header class="maturity-v38-preview-masthead"><div><span>FORMAL REPORT PREVIEW</span><h2>${escapeHtml(detail.project.name)} 评估报告 V2</h2><p>${escapeHtml(detail.project.organization)} · ${escapeHtml(displayTemplateName(detail))} · 当前计算结果</p></div><strong>${progress.filled}/${progress.total} 人工结论</strong></header>
      ${renderReportV2PreviewSection("管理层摘要与会议决议", "P1", ["executiveConclusionTitle", "executiveCurrentState", "executiveJudgement", "executiveDecisionRecommendation", "executiveMeetingDecision", "decisionResponsibility", "decisionResources", "decisionCadence"], progress.conclusions)}
      ${renderReportOverall(detail)}
      <div class="maturity-v38-preview-dashboard">
        <section class="maturity-v37-report-panel maturity-v37-report-capability-radar" data-report-section="report-v2-capability-radar"><header><h3>L2 能力成熟度雷达（${capabilityAxes.length} 维）</h3><div><span class="is-current"><i></i>当前成熟度</span><span class="is-target"><i></i>目标成熟度</span></div></header><canvas width="760" height="350" data-maturity-capability-radar data-radar-height="350" data-radar-min-width="420" aria-label="评估报告 V2 全能力成熟度雷达图"></canvas></section>
        <section class="maturity-v37-report-panel maturity-v37-report-dimension-radar" data-report-section="report-v2-dimension-radar"><header><h3>四维成熟度雷达</h3><span>当前状态 / 目标状态</span></header><canvas width="460" height="300" data-maturity-result-radar data-radar-height="300" data-radar-radius="108" aria-label="评估报告 V2 当前与目标四维成熟度雷达图"></canvas><dl>${dimensionProfile(summary.dimensionResults || {}).map((item) => { const target = Number(summary.targetDimensionResults?.[item.key]); return `<div><dt>${escapeHtml(item.label)}</dt><dd>${item.value == null ? "—" : item.value.toFixed(2)} / ${Number.isFinite(target) ? target.toFixed(2) : "—"}</dd></div>`; }).join("")}</dl></section>
        ${renderReportCategoryCoverage(detail)}
      </div>
      ${renderReportV2PreviewSection("差距诊断", "P2", ["diagnosticInterpretation", "diagnosticManagementImplication"], progress.conclusions)}
      ${renderReportPriorityTable(detail)}
      ${renderReportV2PreviewSection("管理研判与行动计划", "P3", ["executiveSummary", "keyFindings", "managementRecommendations", "nextSteps", "executionRiskConclusion"], progress.conclusions)}
      ${renderReportResultAppendix(detail)}
      <footer class="maturity-v37-report-note"><strong>V2 草稿说明</strong><span>系统图表与统计均来自当前评估结果；人工结论未完成或未确认时，不作为正式发布报告。</span><small>原评估报告页面与原导出逻辑未改动</small></footer>
    </section>`;
  }

  function renderReportV2Tab(detail) {
    if (!detail?.result?.ok) return `<section class="maturity-v1-empty"><h3>评估报告 V2 尚不可用</h3><p>请先完成评分计算，再进入报告编制工作台。</p><button class="maturity-v1-button is-primary" type="button" data-maturity-action="calculate">开始计算</button></section>`;
    if (!formalAssessmentReady(detail)) return renderFormalAssessmentBlocked("评估报告 V2 尚不可用");
    detail.reportV2Conclusions = reportV2Conclusions(detail);
    const progress = reportV2Progress(detail);
    const facts = reportV2Facts(detail);
    return `<div class="maturity-v38-report-v2" data-maturity-report-v2>
      <section class="maturity-v38-authoring-summary"><header><div><span>评估报告 V2</span><h2>报告编制工作台</h2><p>系统提供评分事实，评估人员依次完成解释、研判、行动、摘要与管理决议。</p></div><div><strong><b data-report-v2-filled>${progress.filled}</b> / <span data-report-v2-total>${progress.total}</span></strong><small>必填人工结论</small></div></header><i role="progressbar" aria-label="人工结论完成度" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${progress.percent.toFixed(0)}"><b data-report-v2-progress style="width:${progress.percent}%"></b></i><div class="maturity-v38-facts"><article><span>当前成熟度</span><strong>${escapeHtml(facts.summary.currentLevel || "—")} / ${facts.currentIndex}</strong></article><article><span>目标成熟度</span><strong>${escapeHtml(facts.summary.targetLevel || "—")} / ${facts.targetIndex}</strong></article><article><span>低于目标 L2</span><strong>${facts.belowTarget.length} / ${facts.capabilityRows.length || "—"}</strong></article><article><span>证据覆盖</span><strong>${facts.evidenceCoverage}</strong></article><article><span>行动准备</span><strong>${facts.roadmap.length - facts.pendingRoadmapCount} / ${facts.roadmap.length || "—"}</strong></article></div></section>
      <div class="maturity-v38-authoring-layout">${renderReportV2StageNavigation(detail, progress)}${renderReportV2Authoring(detail, progress, facts)}</div>
      ${renderReportV2FormalPreview(detail, progress)}
    </div>`;
  }

  function renderReportTab(detail) {
    const report = detail.report;
    const reportDetail = reportSurfaceDetail(detail);
    const summary = summaryOf(reportDetail);
    const reportCapabilityAxes = list(reportRadarData(reportDetail)?.capabilityRadar?.axes);
    const narrative = { ...defaultReportNarrative(), ...(detail.reportNarrative || {}) };
    if (!detail?.result?.ok) return `<section class="maturity-v1-empty"><h3>评估报告尚不可用</h3><p>请先完成后端评分计算，再进入报告编制。</p><button class="maturity-v1-button is-primary" type="button" data-maturity-action="calculate">开始计算</button></section>`;
    if (!formalAssessmentReady(detail)) return renderFormalAssessmentBlocked("评估报告尚不可用");
    return `
      <div class="maturity-v37-report-shell" data-maturity-report-ready="true">
        ${renderReportNavigation(detail)}
        <main class="maturity-v37-report-document">
          ${renderReportOverall(reportDetail)}
          <div class="maturity-v37-report-dashboard">
            <section id="report-capability-radar" class="maturity-v37-report-panel maturity-v37-report-capability-radar" data-report-section="report-capability-radar"><header><h3>全能力分组雷达（${reportCapabilityAxes.length || list(detail?.result?.capabilityResults).length} 个 L2 能力）</h3><div><span class="is-current"><i></i>当前成熟度</span><span class="is-target"><i></i>目标成熟度</span></div></header><canvas width="760" height="350" data-maturity-capability-radar data-radar-height="350" data-radar-min-width="420" aria-label="全能力分组成熟度雷达图"></canvas></section>
            <section id="report-dimension-radar" class="maturity-v37-report-panel maturity-v37-report-dimension-radar" data-report-section="report-dimension-radar"><header><h3>四维成熟度雷达</h3><span>当前状态 / 目标状态</span></header><canvas width="460" height="300" data-maturity-result-radar data-radar-height="300" data-radar-radius="108" aria-label="组织、流程、工具、数据当前与目标四维成熟度雷达图"></canvas><dl>${dimensionProfile(summary.dimensionResults || {}).map((item) => { const target = Number(summary.targetDimensionResults?.[item.key]); return `<div><dt>${escapeHtml(item.label)}</dt><dd>${item.value == null ? "—" : item.value.toFixed(2)} / ${Number.isFinite(target) ? target.toFixed(2) : "—"}</dd></div>`; }).join("")}</dl></section>
            ${renderReportCategoryCoverage(reportDetail)}
            <div class="maturity-v37-report-narratives">${reportNarrativeSections().map((section) => renderReportNarrative(detail, section, narrative)).join("")}</div>
            ${renderReportPriorityTable(reportDetail)}
          </div>
          ${renderReportResultAppendix(reportDetail)}
          <footer class="maturity-v37-report-note"><strong>说明</strong><span>本报告由 SAPD 成熟度评估结果自动生成；结果数据保留生成时点的有效版本，人工章节用于管理汇报与决策参考。</span>${report ? `<small>${report.formal ? "正式评估报告" : "草稿报告"} · ${escapeHtml(report.generatedAt || "")}</small>` : `<small>尚未生成导出文件</small>`}</footer>
        </main>
      </div>
    `;
  }

  function activeControlLocator() {
    const element = document.activeElement;
    if (!element || !model.root?.contains(element)) return "";
    const attributes = [
      "data-score-item-id",
      "data-element",
      "data-score-dimension",
      "data-score-field",
      "data-score-applicability",
      "data-focus-id",
      "data-focus-score-dimension",
      "data-focus-score-field",
      "data-focus-applicability",
      "data-focus-applicability-toggle",
      "data-focus-na-reason",
      "data-hierarchy-level",
      "data-hierarchy-id",
    ];
    const parts = attributes
      .filter((name) => element.hasAttribute(name))
      .map((name) => `[${name}="${window.CSS?.escape?.(element.getAttribute(name)) || element.getAttribute(name)}"]`)
      .join("");
    return parts ? `${element.localName}${parts}` : "";
  }

  function captureRenderPosition() {
    const owners = [];
    let node = model.root;
    while (node instanceof HTMLElement) {
      owners.push({ node, top: node.scrollTop, left: node.scrollLeft });
      node = node.parentElement;
    }
    const table = model.root?.querySelector(".maturity-v1-score-table-scroll");
    const projectPage = model.root?.querySelector(".maturity-v1-project-page");
    const directoryTree = model.root?.querySelector(".maturity-v4-directory-tree");
    const scorePanels = [...(model.root?.querySelectorAll(".maturity-v3-focus-list > div, .maturity-v3-score-form") || [])].map((panel, index) => ({ index, top: panel.scrollTop, left: panel.scrollLeft }));
    return {
      owners,
      pageX: window.scrollX,
      pageY: window.scrollY,
      tableTop: table?.scrollTop || 0,
      tableLeft: table?.scrollLeft || 0,
      projectTop: projectPage?.scrollTop || 0,
      projectLeft: projectPage?.scrollLeft || 0,
      directoryTop: directoryTree?.scrollTop || 0,
      directoryLeft: directoryTree?.scrollLeft || 0,
      scorePanels,
      controlLocator: activeControlLocator(),
    };
  }

  function restoreRenderPosition(state) {
    if (!state) return;
    const restore = () => {
      state.owners.forEach(({ node, top, left }) => {
        node.scrollTop = top;
        node.scrollLeft = left;
      });
      window.scrollTo(state.pageX, state.pageY);
      const table = model.root?.querySelector(".maturity-v1-score-table-scroll");
      if (table) {
        table.scrollTop = state.tableTop;
        table.scrollLeft = state.tableLeft;
      }
      const projectPage = model.root?.querySelector(".maturity-v1-project-page");
      if (projectPage) {
        projectPage.scrollTop = state.projectTop;
        projectPage.scrollLeft = state.projectLeft;
      }
      const directoryTree = model.root?.querySelector(".maturity-v4-directory-tree");
      if (directoryTree) {
        directoryTree.scrollTop = state.directoryTop;
        directoryTree.scrollLeft = state.directoryLeft;
      }
      const scorePanels = [...(model.root?.querySelectorAll(".maturity-v3-focus-list > div, .maturity-v3-score-form") || [])];
      state.scorePanels?.forEach(({ index, top, left }) => {
        const panel = scorePanels[index];
        if (!panel) return;
        panel.scrollTop = top;
        panel.scrollLeft = left;
      });
      if (state.controlLocator) model.root?.querySelector(state.controlLocator)?.focus?.({ preventScroll: true });
    };
    restore();
    window.requestAnimationFrame(restore);
    window.setTimeout(restore, 0);
  }

  function syncMaturityShellHeader(detail) {
    const slot = document.getElementById("maturityShellHeaderActions");
    if (!slot) return;
    const pageTitle = document.querySelector("#appPageTitle");
    const pageDescription = document.querySelector("#appPageHeader .page-header-copy > p");
    if (pageTitle) pageTitle.textContent = detail ? detail.project.name : "SAPD 成熟度评估";
    if (pageDescription) {
      pageDescription.textContent = detail
        ? `${detail.project.organization} · ${displayTemplateName(detail)} · 最近更新 ${detail.project.updatedAt || "-"}`
        : "管理成熟度评估项目、模板、评分、结果和评估报告。";
    }
    const scoringStatus = detail && model.activeTab === "scoring" ? model.root.querySelector(".maturity-v3-page-status") || slot.querySelector(".maturity-v3-page-status") : null;
    slot.replaceChildren();
    if (!detail) {
      slot.innerHTML = `<div class="maturity-v2-page-actions"><button id="maturityNewProjectButton" class="maturity-v1-button is-primary" type="button" data-maturity-action="new-project">新建评估项目</button></div>`;
    } else if (model.activeTab === "scoring") {
      if (scoringStatus) slot.append(scoringStatus);
    } else if (FORMAL_RESULT_TAB_IDS.has(model.activeTab) && !formalAssessmentReady(detail)) {
      slot.innerHTML = `<span class="maturity-v37-shell-report-state"><span class="maturity-v1-status is-warn">评估尚未正式完成</span></span><button class="maturity-v1-button is-primary" type="button" data-maturity-action="open-review-tab">前往评分检查</button>`;
    } else if (model.activeTab === "report-v2") {
      const progress = reportV2Progress(detail);
      slot.innerHTML = `<span class="maturity-v38-shell-state"><span class="maturity-v1-status ${progress.filled === progress.total ? "is-good" : "is-active"}">${progress.filled} / ${progress.total} 已填写</span></span><button class="maturity-v1-button is-secondary" type="button" data-maturity-action="scroll-report-v2-preview">查看正式报告预览</button>`;
    } else if (model.activeTab === "report") {
      const report = detail.report;
      const exportReady = reportExportReady(report);
      const updateMode = reportPreviouslyGenerated(detail);
      const reportState = detail.reportNarrativeDirty ? "汇报内容待更新" : exportReady ? "结果与报告已同步" : updateMode ? "评估报告需要更新" : "尚未生成评估报告";
      const generateLabel = model.reportGenerating ? updateMode ? "更新中..." : "生成中..." : updateMode ? "更新评估报告" : "生成评估报告";
      const actionHint = updateMode ? "基于当前评估结果和汇报内容更新评估报告" : "首次生成评估报告";
      slot.innerHTML = `<span class="maturity-v37-shell-report-state"><span class="maturity-v1-status ${detail.reportNarrativeDirty || (updateMode && !exportReady) ? "is-warn" : exportReady ? "is-good" : "is-active"}">${escapeHtml(reportState)}</span></span><button class="maturity-v1-button is-primary" type="button" data-maturity-action="generate-report" data-report-operation="${updateMode ? "update" : "create"}" aria-label="${escapeHtml(actionHint)}" title="${escapeHtml(actionHint)}" ${model.reportGenerating ? "disabled" : ""}>${escapeHtml(generateLabel)}</button><button class="maturity-v1-button is-secondary" type="button" data-maturity-action="download-report" data-format="html" ${exportReady ? "" : "disabled"}>导出 HTML</button><button class="maturity-v1-button is-secondary" type="button" data-maturity-action="download-report" data-format="markdown" ${exportReady ? "" : "disabled"}>导出 Markdown</button>`;
    } else {
      const [primaryLabel, primaryTab] = projectPrimaryAction(detail.project);
      slot.innerHTML = `<span class="maturity-v5-shell-project-state"><span class="maturity-v1-status ${statusTone(detail.project.status)}">${escapeHtml(PROJECT_STATUS_NAMES[detail.project.status] || detail.project.status)}</span>${detail.project.status === "scoring" ? `<span class="maturity-v2-save-state" aria-live="polite">${model.calculating ? "正在保存并试算..." : detail.dirty ? "已保存草稿，等待试算" : "已自动保存"}</span>` : ""}</span><button class="maturity-v1-button is-primary" type="button" data-maturity-tab="${primaryTab}">${escapeHtml(primaryLabel)}</button>`;
    }
    slot.hidden = false;
    if (!slot.dataset.maturityBound) {
      slot.addEventListener("click", handleClick);
      slot.addEventListener("change", handleChange);
      slot.addEventListener("input", handleInput);
      slot.dataset.maturityBound = "true";
    }
  }

  function syncFixedScoreContextPosition() {
    const context = model.root?.querySelector("[data-maturity-fixed-score-context]");
    const workbench = context?.closest(".maturity-v4-score-workbench");
    if (!context || !workbench) return;
    const height = Math.ceil(context.getBoundingClientRect().height || 0);
    workbench.style.setProperty("--maturity-v23-score-context-height", `${height}px`);
  }

  function render() {
    if (!model.root) return;
    const previousScrollTop = model.root.scrollTop;
    const renderContext = `${model.route}|${model.activeTab}`;
    const preservedPosition = model.lastRenderContext === renderContext ? captureRenderPosition() : null;
    if (model.loading || !model.loaded) {
      model.root.innerHTML = renderLoading();
      return;
    }
    if (model.error) {
      model.root.innerHTML = renderError();
      return;
    }
    const detail = activeDetail();
    if (detail) rememberProjectTab(model.activeTab, detail.project.id);
    model.root.innerHTML = detail ? renderProject(detail) : renderProjectList();
    window.requestAnimationFrame(() => {
      syncMaturityShellHeader(detail);
      syncFixedScoreContextPosition();
      if (detail) drawMaturityRadar(detail);
    });
    window.setTimeout(() => syncMaturityShellHeader(detail), 0);
    model.lastRenderContext = renderContext;
    restoreRenderPosition(preservedPosition);
    if (!detail && model.createOpen) {
      model.root.scrollTop = previousScrollTop;
      window.setTimeout(() => {
        const modal = model.root?.querySelector(".maturity-v2-create-workspace");
        if (!modal?.contains(document.activeElement)) (modal.querySelector("input:not(:disabled), select:not(:disabled), textarea:not(:disabled), button:not(:disabled)") || modal)?.focus?.();
      }, 0);
    }
  }

  async function loadWorkspace({ force = false } = {}) {
    if (model.loading) return model.loadPromise;
    if (model.loaded && !force) return model.workspace;
    model.loading = true;
    model.loaded = false;
    model.error = "";
    render();
    model.loadPromise = (async () => {
      try {
        const response = await window.sapdDataClient?.getMaturityWorkspace?.();
        const workspace = unwrap(response);
        if (!workspace || workspace.dataState !== "ready") throw new Error(workspace?.notice || "成熟度评估 API 当前不可用。请确认 5173 服务已重启到最新代码。");
        model.workspace = workspace;
        hydrateWorkspace(workspace);
        await refreshHydratedAssessments();
        await restorePersistedReports();
        model.loaded = true;
        model.loading = false;
        const detail = activeDetail();
        if (detail && FORMAL_RESULT_TAB_IDS.has(model.activeTab) && !formalAssessmentReady(detail)) model.activeTab = "review";
        render();
        return workspace;
      } catch (error) {
        model.loading = false;
        model.loaded = true;
        model.error = error?.message || "成熟度评估加载失败。";
        render();
        return null;
      } finally {
        model.loadPromise = null;
      }
    })();
    return model.loadPromise;
  }

  async function requestMaturityCalculation({ project, template, scoreEntries }) {
    const response = await window.sapdDataClient?.calculateMaturityAssessment?.({ project, template, scoreEntries });
    const result = unwrap(response);
    if (!result?.ok) throw new Error(list(result?.validation?.errors)[0]?.message || result?.error || "评分计算失败。请先校验模板。");
    return result;
  }

  function applyCalculatedResult(detail, result) {
    detail.result = result;
    detail.resultStale = false;
    detail.dirty = false;
    detail.lastCalculatedAt = nowLabel();
    detail.lastSavedAt = detail.lastCalculatedAt;
    detail.localSaveState = "saved";
  }

  async function refreshHydratedAssessments() {
    const candidates = Object.values(model.details).filter((detail) => detail?.project?.id && detail.locallyStored);
    await Promise.all(candidates.map(async (detail) => {
      try {
        const result = await requestMaturityCalculation(detail);
        applyCalculatedResult(detail, result);
        if (LOCKED_ASSESSMENT_STATUSES.has(detail.project.status) && !formalAssessmentReady(detail)) {
          detail.project.status = "score_review";
          detail.project.readOnly = false;
          detail.report = null;
          detail.reportNarrativeDirty = true;
        }
        persistDetail(detail);
      } catch {
        detail.resultStale = true;
        detail.localSaveState = "error";
      }
    }));
  }

  function touchDetail(detail, { invalidateResult = false, invalidateReport = false } = {}) {
    if (invalidateResult) {
      detail.result = null;
      detail.resultStale = true;
      detail.calculationRevision = Number(detail.calculationRevision || 0) + 1;
    }
    if (invalidateReport) detail.report = null;
    detail.project.updatedAt = nowLabel();
    detail.dirty = true;
    detail.lastSavedAt = nowLabel();
    detail.localSaveState = "saved";
    if (!persistDetail(detail)) detail.localSaveState = "error";
  }

  function markCalculationDirty(detail) {
    detail.resultStale = true;
    detail.calculationRevision = Number(detail.calculationRevision || 0) + 1;
  }

  function markTemplateDirty(detail) {
    detail.template.status = "draft";
    detail.project.status = "template_configuring";
    detail.validation = null;
    touchDetail(detail, { invalidateResult: true, invalidateReport: true });
  }

  function refreshScoringCalculatedState(detail) {
    if (!model.root || model.activeTab !== "scoring" || activeDetail() !== detail) {
      render();
      return;
    }
    const selection = scoringSelection(detail);
    const capabilityResult = list(detail.result?.capabilityResults).find((item) => item.id === selection.capability?.id);
    const summaryNode = model.root.querySelector(".maturity-v3-l2-summary");
    if (summaryNode && selection.capability) summaryNode.outerHTML = renderL2Summary(selection.capability, capabilityResult, false);
    const pointResult = scoreItemResult(detail, selection.scoreItem?.id);
    const currentSummary = model.root.querySelector("[data-maturity-current-summary]");
    if (currentSummary && selection.scoreItem) {
      currentSummary.outerHTML = renderScoreOverview(detail, selection.scoreItem, scoreEntry(detail, selection.scoreItem.id));
      drawPointRadar(detail);
    }
    const targetRate = model.root.querySelector(".maturity-v2-target-rate");
    if (targetRate) targetRate.innerHTML = `<span>目标达成率</span><strong>${pointResult?.targetAchievementRate == null ? "待计算" : `${Number(pointResult.targetAchievementRate).toFixed(1)}%`}</strong><small>当前指数 ÷ 目标指数，上限 100%</small>`;
    const saveState = model.root.querySelector(".maturity-v3-score-footer > small");
    if (saveState) saveState.textContent = detail.localSaveState === "error" ? "保存失败，请重试" : "已保存";
    syncMaturityShellHeader(detail);
  }

  async function calculateDetail(detail = activeDetail(), { silent = false } = {}) {
    if (!detail) return null;
    if (model.calculating) return model.calculationPromise;
    model.calculating = true;
    const sequence = ++model.calculationSequence;
    const calculationRevision = Number(detail.calculationRevision || 0);
    if (!silent) render();
    model.calculationPromise = (async () => {
      try {
        const result = await requestMaturityCalculation(detail);
        if (sequence !== model.calculationSequence || calculationRevision !== Number(detail.calculationRevision || 0)) {
          detail.resultStale = true;
          scheduleCalculation(detail);
          return null;
        }
        applyCalculatedResult(detail, result);
        persistDetail(detail);
        if (!silent) {
          model.toast = "评分试算已更新；完成评估前仍以评分检查中的阻断项为准。";
          model.toastTone = "success";
          model.toastRoute = normalizedRoute();
        }
        return result;
      } catch (error) {
        detail.localSaveState = "error";
        if (!silent) {
          model.toast = error?.message || "评分计算失败";
          model.toastTone = "error";
          model.toastRoute = normalizedRoute();
        }
        return null;
      } finally {
        if (sequence === model.calculationSequence) {
          model.calculating = false;
          model.calculationPromise = null;
        }
        if (silent) refreshScoringCalculatedState(detail);
        else render();
      }
    })();
    return model.calculationPromise;
  }

  function scheduleCalculation(detail = activeDetail()) {
    window.clearTimeout(model.calculationTimer);
    model.calculationTimer = window.setTimeout(() => {
      if (model.calculating) {
        scheduleCalculation(detail);
        return;
      }
      calculateDetail(detail, { silent: true });
    }, 280);
  }

  function readCreateStepOne() {
    model.createDraft = {
      ...model.createDraft,
      name: text(document.getElementById("maturityCreateName")?.value).trim(),
      organization: text(document.getElementById("maturityCreateOrganization")?.value).trim(),
      owner: text(document.getElementById("maturityCreateOwner")?.value).trim(),
      industry: text(document.getElementById("maturityCreateIndustry")?.value).trim(),
      companySize: text(document.getElementById("maturityCreateCompanySize")?.value).trim(),
      customerCharacteristics: text(document.getElementById("maturityCreateCharacteristics")?.value).trim(),
      constraints: text(document.getElementById("maturityCreateConstraints")?.value).trim(),
      plannedStartDate: text(document.getElementById("maturityCreateStartDate")?.value).trim(),
      plannedEndDate: text(document.getElementById("maturityCreateEndDate")?.value).trim(),
      assessors: text(document.getElementById("maturityCreateAssessors")?.value).trim(),
      note: text(document.getElementById("maturityCreateNote")?.value).trim(),
    };
    const required = { name: "请填写项目名称", organization: "请填写客户企业组织", industry: "请填写客户所属行业", companySize: "请选择企业规模", owner: "请填写项目负责人" };
    model.createErrors = Object.entries(required).reduce((errors, [field, message]) => {
      if (!text(model.createDraft[field]).trim()) errors[field] = message;
      return errors;
    }, {});
    return Object.keys(model.createErrors).length === 0;
  }

  function openCreateWizard(detail = null, libraryTemplate = null) {
    const project = detail?.project || {};
    model.createOpen = true;
    model.createErrors = {};
    model.createDraftProjectId = project.status === "draft" ? project.id : "";
    model.createStep = Number(project.draftStep || 1);
    model.createDraft = project.status === "draft"
      ? {
          name: project.name || "",
          organization: project.organization || "",
          industry: project.industry || "",
          companySize: project.companySize || "",
          customerCharacteristics: project.customerCharacteristics || "",
          constraints: project.constraints || "",
          owner: project.owner || "",
          plannedStartDate: project.plannedStartDate || "",
          plannedEndDate: project.plannedEndDate || "",
          assessors: list(project.assessors).join("、"),
          note: project.note || "",
          templateType: project.templateType || "",
          templateLibraryId: project.templateLibraryId || "",
        }
      : emptyCreateDraft();
    if (!detail && libraryTemplate?.id) {
      model.createStep = 1;
      model.createDraft.templateType = libraryTemplate.type === "base" ? "base" : "custom";
      model.createDraft.templateLibraryId = libraryTemplate.id;
    }
    render();
  }

  function closeCreateWizard() {
    model.createOpen = false;
    model.createErrors = {};
    model.createDraftProjectId = "";
    model.createStep = 1;
    model.createDraft = emptyCreateDraft();
    render();
    window.setTimeout(() => document.getElementById("maturityNewProjectButton")?.focus(), 0);
  }

  function projectInfoDraft(project = {}) {
    return {
      name: project.name || "",
      organization: project.organization || "",
      industry: project.industry || "",
      companySize: project.companySize || "",
      customerCharacteristics: project.customerCharacteristics || "",
      constraints: project.constraints || "",
      owner: project.owner || "",
      plannedStartDate: project.plannedStartDate || "",
      plannedEndDate: project.plannedEndDate || "",
      assessors: list(project.assessors).join("、"),
      note: project.note || "",
    };
  }

  function openProjectInfoEditor(detail) {
    if (!detail?.project?.id) return;
    model.projectInfoEditId = detail.project.id;
    model.projectInfoDraft = projectInfoDraft(detail.project);
    model.projectInfoErrors = {};
    render();
    window.setTimeout(() => model.root?.querySelector("#maturityProjectInfoName")?.focus(), 0);
  }

  function closeProjectInfoEditor() {
    model.projectInfoEditId = "";
    model.projectInfoDraft = {};
    model.projectInfoErrors = {};
    render();
    window.setTimeout(() => model.root?.querySelector('[data-maturity-action="edit-project-info"]')?.focus(), 0);
  }

  function readProjectInfoEditor() {
    model.projectInfoDraft = {
      name: text(document.getElementById("maturityProjectInfoName")?.value).trim(),
      organization: text(document.getElementById("maturityProjectInfoOrganization")?.value).trim(),
      industry: text(document.getElementById("maturityProjectInfoIndustry")?.value).trim(),
      companySize: text(document.getElementById("maturityProjectInfoCompanySize")?.value).trim(),
      customerCharacteristics: text(document.getElementById("maturityProjectInfoCharacteristics")?.value).trim(),
      constraints: text(document.getElementById("maturityProjectInfoConstraints")?.value).trim(),
      owner: text(document.getElementById("maturityProjectInfoOwner")?.value).trim(),
      plannedStartDate: text(document.getElementById("maturityProjectInfoStartDate")?.value).trim(),
      plannedEndDate: text(document.getElementById("maturityProjectInfoEndDate")?.value).trim(),
      assessors: text(document.getElementById("maturityProjectInfoAssessors")?.value).trim(),
      note: text(document.getElementById("maturityProjectInfoNote")?.value).trim(),
    };
    const required = { name: "请填写项目名称", organization: "请填写客户企业组织", industry: "请填写客户所属行业", companySize: "请选择企业规模", owner: "请填写项目负责人" };
    model.projectInfoErrors = Object.entries(required).reduce((errors, [field, message]) => {
      if (!text(model.projectInfoDraft[field]).trim()) errors[field] = message;
      return errors;
    }, {});
    if (model.projectInfoDraft.plannedStartDate && model.projectInfoDraft.plannedEndDate && model.projectInfoDraft.plannedEndDate < model.projectInfoDraft.plannedStartDate) {
      model.projectInfoErrors.plannedEndDate = "计划结束时间不能早于开始时间";
    }
    return Object.keys(model.projectInfoErrors).length === 0;
  }

  function saveProjectInfo(detail) {
    if (!detail?.project || model.projectInfoEditId !== detail.project.id) return;
    if (!readProjectInfoEditor()) {
      render();
      window.setTimeout(() => model.root?.querySelector('[aria-invalid="true"]')?.focus(), 0);
      return;
    }
    const draft = model.projectInfoDraft;
    const assessors = draft.assessors.split(/[、,，]/).map((value) => value.trim()).filter(Boolean);
    const nextValues = { ...draft, assessors };
    const fieldLabels = {
      name: "项目名称",
      organization: "客户企业组织",
      industry: "客户所属行业",
      companySize: "企业规模",
      customerCharacteristics: "客户特点",
      constraints: "客户偏好与约束",
      owner: "项目负责人",
      plannedStartDate: "计划开始时间",
      plannedEndDate: "计划结束时间",
      assessors: "评估人员",
      note: "备注",
    };
    const changedFields = Object.keys(fieldLabels).filter((field) => JSON.stringify(detail.project[field] ?? (field === "assessors" ? [] : "")) !== JSON.stringify(nextValues[field]));
    if (!changedFields.length) {
      model.projectInfoEditId = "";
      model.projectInfoDraft = {};
      model.projectInfoErrors = {};
      showToast("项目信息没有变化", "info");
      return;
    }
    Object.keys(fieldLabels).forEach((field) => { detail.project[field] = clone(nextValues[field]); });
    detail.project.customerContextSnapshot = {
      ...(detail.project.customerContextSnapshot || {}),
      organization: draft.organization,
      industry: draft.industry,
      companySize: draft.companySize,
      customerCharacteristics: draft.customerCharacteristics,
      constraints: draft.constraints,
    };
    appendProjectHistory(detail, "PROJECT_INFO_UPDATED", "更新项目信息", `已修改：${changedFields.map((field) => fieldLabels[field]).join("、")}`);
    model.projectHistoryPage = 0;
    touchDetail(detail, { invalidateResult: true, invalidateReport: true });
    model.projectInfoEditId = "";
    model.projectInfoDraft = {};
    model.projectInfoErrors = {};
    render();
    showToast("项目信息已保存，评估结果正在同步更新", "success");
    scheduleCalculation(detail);
  }

  function saveCreateDraft() {
    const draft = model.createDraft;
    const projectId = model.createDraftProjectId || uid("demo-project");
    const existing = model.details[projectId] || {};
    const project = {
      ...(existing.project || {}),
      id: projectId,
      name: draft.name || "未命名成熟度评估项目",
      organization: draft.organization || "客户组织待填写",
      assessmentObjectType: "ENTERPRISE_ORGANIZATION",
      industry: draft.industry,
      companySize: draft.companySize,
      customerCharacteristics: draft.customerCharacteristics,
      constraints: draft.constraints,
      plannedStartDate: draft.plannedStartDate,
      plannedEndDate: draft.plannedEndDate,
      note: draft.note,
      owner: draft.owner,
      assessors: text(draft.assessors).split(/[、,，]/).map((value) => value.trim()).filter(Boolean),
      status: "draft",
      statusLabel: PROJECT_STATUS_NAMES.draft,
      templateType: draft.templateType || "",
      templateLibraryId: draft.templateLibraryId || "",
      templateName: draft.templateType === "custom" ? "自定义模板待配置" : draft.templateType === "base" ? model.workspace?.template?.name : "待选择模板",
      draftStep: model.createStep,
      updatedAt: nowLabel(),
      mode: "controlled_demo",
      readOnly: false,
    };
    const detail = { ...existing, project, template: existing.template || clone(model.workspace?.template), scoreEntries: list(existing.scoreEntries), result: existing.result || null, report: existing.report || null, reportNarrative: existing.reportNarrative || defaultReportNarrative(), reportNarrativeDirty: Boolean(existing.reportNarrativeDirty), reportV2Conclusions: existing.reportV2Conclusions || defaultReportV2Conclusions(), reportV2Dirty: Boolean(existing.reportV2Dirty), improvementRoadmap: list(existing.improvementRoadmap), exchangeBatches: list(existing.exchangeBatches), scoreImportIssues: list(existing.scoreImportIssues), scoreImportNotice: existing.scoreImportNotice || null, locallyStored: true };
    model.details[projectId] = detail;
    persistDetail(detail);
    model.createOpen = false;
    model.createDraftProjectId = "";
    render();
    showToast("项目草稿已保存", "success");
  }

  function createBlankEntries(template) {
    return list(template.scoreItems).map((item) => ({ scoreItemId: item.id, isApplicable: true, elements: {}, dimensionNotes: {}, reviewElements: {}, targetElements: {}, targetDimensionNotes: {}, targetLevel: "", targetReason: "", targetConfirmed: false, evidenceLevel: "E0", evidenceSummary: "", note: "", naReason: "", status: "not_scored" }));
  }

  function createProject() {
    const draft = model.createDraft;
    if (!draft.templateType) {
      model.createErrors = { templateType: "请选择评估模板" };
      model.createStep = 2;
      render();
      return;
    }
    const projectId = model.createDraftProjectId || uid("demo-project");
    const libraryTemplate = templateLibraryRecords().find((item) => item.template.id === draft.templateLibraryId)?.template;
    const baseTemplate = clone(libraryTemplate || model.workspace.template);
    const isCustom = draft.templateType === "custom";
    const template = isCustom
      ? {
          ...baseTemplate,
          id: uid("custom-template"),
          snapshotId: uid("draft-template"),
          name: libraryTemplate ? `${libraryTemplate.name} · ${draft.name} 副本` : `${draft.name} 自定义模板`,
          type: "custom",
          status: "draft",
          readOnly: false,
          structureMutable: true,
          weightMutable: true,
          sourceTemplateId: libraryTemplate?.id || baseTemplate.id,
          sourceTemplateSnapshotId: baseTemplate.snapshotId,
          description: "加载固定知识库模板后形成的自定义能力自由组合模板。",
        }
      : baseTemplate;
    const project = {
      id: projectId,
      name: draft.name,
      organization: draft.organization,
      assessmentObjectType: "ENTERPRISE_ORGANIZATION",
      industry: draft.industry,
      companySize: draft.companySize,
      customerCharacteristics: draft.customerCharacteristics,
      constraints: draft.constraints,
      plannedStartDate: draft.plannedStartDate,
      plannedEndDate: draft.plannedEndDate,
      note: draft.note,
      owner: draft.owner,
      assessors: draft.assessors.split(/[、,，]/).map((value) => value.trim()).filter(Boolean),
      status: isCustom ? "template_configuring" : "scoring",
      statusLabel: isCustom ? PROJECT_STATUS_NAMES.template_configuring : PROJECT_STATUS_NAMES.scoring,
      templateId: template.id,
      templateName: template.name,
      templateType: template.type,
      templateLibraryId: draft.templateLibraryId || "",
      templateSnapshotId: template.snapshotId,
      knowledgeSnapshotId: model.workspace?.dictionarySnapshot?.id || model.workspace?.template?.snapshotId,
      algorithmVersion: "sapd-maturity-v2.1.0",
      customerContextSnapshot: {
        organization: draft.organization,
        industry: draft.industry,
        companySize: draft.companySize,
        customerCharacteristics: draft.customerCharacteristics,
        constraints: draft.constraints,
      },
      updatedAt: nowLabel(),
      mode: "controlled_demo",
      readOnly: false,
    };
    const detail = { project, template, scoreEntries: createBlankEntries(template), result: null, report: null, reportNarrative: defaultReportNarrative(), reportNarrativeDirty: false, reportV2Conclusions: defaultReportV2Conclusions(), reportV2Dirty: false, improvementRoadmap: [], exchangeBatches: [], scoreImportIssues: [], scoreImportNotice: null, locallyStored: true };
    model.details[projectId] = detail;
    persistDetail(detail);
    model.createOpen = false;
    model.createDraftProjectId = "";
    model.createStep = 1;
    model.activeTab = isCustom ? "template" : "scoring";
    model.selectedCapabilityId = "";
    model.selectedFocusId = "";
    model.selectedScoreItemId = "";
    model.selectedScoreViewLevel = "";
    model.selectedScoreViewId = "";
    model.navigate?.(`/workbench/maturity/${encodeURIComponent(projectId)}`);
  }

  function cloneAsCustom(detail) {
    detail.template = {
      ...clone(detail.template),
      id: uid("custom-template"),
      snapshotId: uid("draft-template"),
      name: `${detail.project.name} 自定义模板`,
      type: "custom",
      status: "draft",
      readOnly: false,
      structureMutable: true,
      weightMutable: true,
      sourceTemplateId: detail.template.id,
      sourceTemplateSnapshotId: detail.template.snapshotId,
    };
    detail.project.templateId = detail.template.id;
    detail.project.templateName = detail.template.name;
    detail.project.templateType = "custom";
    detail.project.templateSnapshotId = detail.template.snapshotId;
    markTemplateDirty(detail);
    render();
  }

  function addCustomCategory(detail) {
    const name = text(document.getElementById("maturityCustomCategoryName")?.value).trim();
    const capabilityLevel = text(document.getElementById("maturityCustomCategoryLevel")?.value).trim() || "L1";
    const level = capabilityLevel === "L0" ? 1 : 2;
    const parentId = capabilityLevel === "L1" ? text(document.getElementById("maturityCustomCategoryParent")?.value).trim() : "";
    if (!name) {
      showToast("请填写能力节点名称", "error");
      return;
    }
    const id = uid("custom-category");
    detail.template.categories.push({ id, code: `C${detail.template.categories.length + 1}`, name, description: "", level, capabilityLevel, parentId: parentId || null, weight: 1, sortOrder: detail.template.categories.length, includedInOverall: true, isCustom: true, sourceType: "CUSTOM", changeAction: "ADDED", originalParentId: null, currentParentId: parentId || null, changeReason: "模板内新增能力节点" });
    markTemplateDirty(detail);
    render();
  }

  function removeCustomCategory(detail, categoryId) {
    const category = list(detail.template.categories).find((item) => item.id === categoryId);
    if (!category) return;
    if (categoryCapabilityLevel(category) === "L1" && list(detail.template.capabilities).some((item) => item.included !== false && item.categoryId === categoryId)) {
      showToast("请先把该 L1 下的能力 L2 移动到其他 L1，再删除该节点", "error");
      return;
    }
    if (categoryCapabilityLevel(category) === "L0") {
      list(detail.template.categories).filter((item) => item.parentId === categoryId).forEach((item) => {
        item.parentId = null;
        item.currentParentId = null;
        item.changeAction = item.changeAction === "ADDED" ? "ADDED" : "MOVED";
      });
    }
    detail.template.changeLog = list(detail.template.changeLog);
    detail.template.changeLog.push({ objectType: categoryCapabilityLevel(category), objectId: category.id, sourceType: category.sourceType || "DICTIONARY", changeAction: "REMOVED", originalParentId: category.originalParentId || category.parentId || null, currentParentId: null, changedAt: nowLabel(), snapshot: clone(category) });
    detail.template.categories = list(detail.template.categories).filter((item) => item.id !== categoryId);
    markTemplateDirty(detail);
    render();
  }

  function addCustomScope(detail) {
    const code = text(document.getElementById("maturityCustomScopeCode")?.value).trim().toUpperCase();
    const name = text(document.getElementById("maturityCustomScopeName")?.value).trim();
    if (!code || !name) {
      showToast("请填写模板内作用域编码和名称", "error");
      return;
    }
    if (list(detail.template.scopes).some((scope) => scope.code === code)) {
      showToast("该作用域编码已存在", "error");
      return;
    }
    detail.template.scopes = list(detail.template.scopes);
    detail.template.scopes.push({ id: uid("custom-scope"), code, name, sourceType: "CUSTOM", changeAction: "ADDED", sourceSnapshotObjectId: null, isCustom: true });
    markTemplateDirty(detail);
    render();
  }

  function addScoreItemForFocus(template, capability, focus, itemType, serviceName = "", scopeCode = "ALL", serviceRole = "ASSESSMENT_POINT") {
    if (itemType === "SERVICE") {
      const scope = list(template.scopes).find((item) => item.code === scopeCode) || { code: scopeCode, name: scopeCode };
      const serviceId = uid("custom-service");
      template.services.push({ id: serviceId, code: `CUST-SVC-${template.services.length + 1}`, name: serviceName || "自定义安全技术服务", scopeCode: scope.code, scopeName: scope.name, sourceType: "CUSTOM", changeAction: "ADDED", isCustom: true });
      const mappingId = uid("custom-mapping");
      template.focusServiceMappings = list(template.focusServiceMappings);
      template.focusServiceMappings.push({ id: mappingId, focusId: focus.id, scopeCode: scope.code, scopeName: scope.name, serviceId, serviceRole, weight: 1, sortOrder: list(focus.serviceMappingIds).length, sourceType: "CUSTOM", changeAction: "ADDED", originalParentId: null, currentParentId: focus.id, changeReason: "模板内新增服务关系" });
      focus.serviceMappingIds = list(focus.serviceMappingIds);
      focus.serviceMappingIds.push(mappingId);
      if (serviceRole === "PLATFORM_EVIDENCE_REFERENCE") {
        focus.platformEvidenceServiceIds = list(focus.platformEvidenceServiceIds);
        focus.platformEvidenceServiceIds.push(serviceId);
        return;
      }
      const itemId = uid("custom-score");
      template.scoreItems.push({ id: itemId, itemType: "SERVICE", capabilityId: capability.id, focusId: focus.id, serviceId, scopeCode: scope.code, scopeName: scope.name, weight: 1, sortOrder: 0, required: true, sourceType: "CUSTOM", serviceRole: "ASSESSMENT_POINT", sourceMappingId: mappingId, elementWeights: { organization: 0.25, process: 0.25, tool: 0.25, data: 0.25 }, rubricEntries: inheritedRubricEntries(template, itemId) });
      focus.scoreItemIds.push(itemId);
      return;
    }
    const itemId = uid("custom-score");
    template.scoreItems.push({ id: itemId, itemType: "FOCUS", capabilityId: capability.id, focusId: focus.id, serviceId: null, scopeCode: null, scopeName: null, weight: 1, sortOrder: 0, required: true, sourceType: "CUSTOM", serviceRole: null, platformEvidenceServiceIds: list(focus.platformEvidenceServiceIds), elementWeights: { organization: 0.25, process: 0.25, tool: 0.25, data: 0.25 }, rubricEntries: inheritedRubricEntries(template, itemId) });
    focus.scoreItemIds.push(itemId);
  }

  function addCustomCapability(detail) {
    const template = detail.template;
    const name = text(document.getElementById("maturityCustomCapabilityName")?.value).trim();
    const categoryId = text(document.getElementById("maturityCustomCapabilityCategory")?.value).trim();
    if (!name || !categoryId) {
      showToast("请填写能力名称并选择分类", "error");
      return;
    }
    const category = list(template.categories).find((item) => item.id === categoryId) || {};
    const capability = { id: uid("custom-capability"), code: `CUST.CAP-${template.capabilities.filter((item) => item.isCustom).length + 1}`, name, description: "模板内新增能力 L2。", capabilityLevel: "L2", categoryId, topCategoryId: category.parentId || null, weight: 1, sortOrder: template.capabilities.length, included: true, isCustom: true, isCritical: false, businessImportance: 3, riskUrgency: 3, sourceType: "CUSTOM", changeAction: "ADDED", originalParentId: null, currentParentId: categoryId, changeReason: "模板内新增能力 L2", focusIds: [] };
    const focus = { id: uid("custom-focus"), code: `${capability.code}-01`, name: `${name}整体评估`, description: "模板内新增关注点。", capabilityId: capability.id, weight: 1, sortOrder: 0, included: true, isCustom: true, isCritical: false, itemType: "FOCUS", sourceType: "CUSTOM", changeAction: "ADDED", originalParentId: null, currentParentId: capability.id, changeReason: "随新增能力创建", serviceMappingIds: [], platformEvidenceServiceIds: [], scoreItemIds: [] };
    addScoreItemForFocus(template, capability, focus, "FOCUS");
    capability.focusIds.push(focus.id);
    template.capabilities.push(capability);
    template.focuses.push(focus);
    detail.scoreEntries.push(...createBlankEntries({ scoreItems: template.scoreItems.filter((item) => focus.scoreItemIds.includes(item.id)) }));
    model.selectedTemplateCapabilityId = capability.id;
    markTemplateDirty(detail);
    render();
  }

  function addCustomFocus(detail, capabilityId) {
    const template = detail.template;
    const capability = list(template.capabilities).find((item) => item.id === capabilityId);
    const name = text(document.getElementById("maturityCustomFocusName")?.value).trim();
    const mode = text(document.getElementById("maturityCustomFocusMode")?.value).trim() || "FOCUS";
    const serviceName = text(document.getElementById("maturityCustomServiceName")?.value).trim();
    const serviceScope = text(document.getElementById("maturityCustomServiceScope")?.value).trim() || "ALL";
    const serviceRole = text(document.getElementById("maturityCustomServiceRole")?.value).trim() || "ASSESSMENT_POINT";
    if (!capability || !name) {
      showToast("请先选择能力并填写关注点名称", "error");
      return;
    }
    const focus = { id: uid("custom-focus"), code: `${capability.code || "CUST"}-${String(list(template.focuses).filter((item) => item.capabilityId === capability.id).length + 1).padStart(2, "0")}`, name, description: "模板内新增关注点。", capabilityId: capability.id, weight: 1, sortOrder: capability.focusIds.length, included: true, isCustom: true, isCritical: false, itemType: mode, sourceType: "CUSTOM", changeAction: "ADDED", originalParentId: null, currentParentId: capability.id, changeReason: "模板内新增关注点", serviceMappingIds: [], platformEvidenceServiceIds: [], scoreItemIds: [] };
    if (mode === "SERVICE") addScoreItemForFocus(template, capability, focus, "SERVICE", serviceName, serviceScope, serviceRole);
    if (!focus.scoreItemIds.length) addScoreItemForFocus(template, capability, focus, "FOCUS");
    capability.focusIds.push(focus.id);
    template.focuses.push(focus);
    detail.scoreEntries.push(...createBlankEntries({ scoreItems: template.scoreItems.filter((item) => focus.scoreItemIds.includes(item.id)) }));
    markTemplateDirty(detail);
    render();
  }

  function removeCustomFocus(detail, focusId) {
    const focus = list(detail.template.focuses).find((item) => item.id === focusId);
    if (!focus) return;
    const itemIds = new Set(list(detail.template.scoreItems).filter((item) => item.focusId === focusId).map((item) => item.id));
    const removedMappings = list(detail.template.focusServiceMappings).filter((item) => item.focusId === focusId);
    const removedServiceIds = new Set(removedMappings.map((item) => item.serviceId).filter(Boolean));
    detail.template.changeLog = list(detail.template.changeLog);
    detail.template.changeLog.push({ objectType: "FOCUS", objectId: focus.id, sourceType: focus.sourceType || "DICTIONARY", changeAction: "REMOVED", originalParentId: focus.originalParentId || focus.capabilityId, currentParentId: null, changedAt: nowLabel(), snapshot: clone(focus) });
    detail.template.focuses = list(detail.template.focuses).filter((item) => item.id !== focusId);
    detail.template.focusServiceMappings = list(detail.template.focusServiceMappings).filter((item) => item.focusId !== focusId);
    detail.template.scoreItems = list(detail.template.scoreItems).filter((item) => item.focusId !== focusId);
    const remainingServiceIds = new Set(list(detail.template.focusServiceMappings).map((item) => item.serviceId).filter(Boolean));
    detail.template.services = list(detail.template.services).filter((item) => !removedServiceIds.has(item.id) || remainingServiceIds.has(item.id));
    detail.scoreEntries = list(detail.scoreEntries).filter((entry) => !itemIds.has(entry.scoreItemId));
    const capability = list(detail.template.capabilities).find((item) => item.id === focus.capabilityId);
    if (capability) capability.focusIds = list(capability.focusIds).filter((id) => id !== focusId);
    markTemplateDirty(detail);
    render();
  }

  function addCustomServiceToFocus(detail, focusId) {
    const template = detail.template;
    const focus = list(template.focuses).find((item) => item.id === focusId);
    const capability = list(template.capabilities).find((item) => item.id === focus?.capabilityId);
    const serviceName = text(document.getElementById("maturityCustomServiceName")?.value).trim();
    const serviceScope = text(document.getElementById("maturityCustomServiceScope")?.value).trim() || "ALL";
    const serviceRole = text(document.getElementById("maturityCustomServiceRole")?.value).trim() || "ASSESSMENT_POINT";
    if (!focus || !capability || !serviceName) {
      showToast("请在下方填写自定义服务名称后再添加", "error");
      return;
    }
    if (serviceRole === "ASSESSMENT_POINT" && focus.itemType === "FOCUS") {
      const replacedIds = new Set(list(template.scoreItems).filter((item) => item.focusId === focus.id).map((item) => item.id));
      template.scoreItems = list(template.scoreItems).filter((item) => item.focusId !== focus.id);
      detail.scoreEntries = list(detail.scoreEntries).filter((entry) => !replacedIds.has(entry.scoreItemId));
      focus.scoreItemIds = [];
      focus.itemType = "SERVICE";
    }
    const before = new Set(list(template.scoreItems).map((item) => item.id));
    addScoreItemForFocus(template, capability, focus, "SERVICE", serviceName, serviceScope, serviceRole);
    detail.scoreEntries.push(...createBlankEntries({ scoreItems: list(template.scoreItems).filter((item) => !before.has(item.id)) }));
    focus.changeAction = focus.changeAction === "ADDED" ? "ADDED" : "MODIFIED";
    markTemplateDirty(detail);
    render();
  }

  async function validateTemplate(detail) {
    const response = await window.sapdDataClient?.validateMaturityTemplate?.(detail.template);
    const validation = unwrap(response);
    detail.validation = validation;
    model.validation = validation;
    if (validation?.valid) {
      detail.template.status = "validated";
      if (validation.snapshotId) detail.template.snapshotId = validation.snapshotId;
      detail.project.templateSnapshotId = detail.template.snapshotId;
      if (detail.project.status === "template_configuring") detail.project.status = "scoring";
      touchDetail(detail, { invalidateResult: true, invalidateReport: true });
      showToast("模板校验通过，可以进入评分", "success");
      return;
    }
    render();
    showToast(list(validation?.errors)[0]?.message || "模板校验未通过", "error");
  }

  async function exportTemplateRecord(template, detail = null) {
    try {
      const response = await window.sapdDataClient?.exportMaturityTemplateExchange?.(template);
      const exported = unwrap(response);
      if (!exported?.ok) throw new Error(exported?.message || list(exported?.validation?.errors)[0]?.message || "模板结构导出失败");
      if (detail) {
        detail.exchangeBatches = list(detail.exchangeBatches);
        detail.exchangeBatches.push(exported.batch);
        persistDetail(detail);
      }
      const outputPath = configuredExportPath(exported);
      if (!outputPath) {
        const fileName = exported.fileName || `${safeFileName(template.name || template.id)}-业务模板.xlsx`;
        downloadBlob(workbookBlob(exported.package), fileName, exported.mimeType || XLSX_MIME);
      }
      showToast(outputPath ? `${template.type === "base" ? "标准" : "自定义"}模板已保存到：${outputPath}` : `${template.type === "base" ? "标准" : "自定义"}模板 XLSX 已下载`, "success");
    } catch (error) {
      showToast(error?.message || "模板结构导出失败", "error");
    }
  }

  async function exportTemplate(detail) {
    return exportTemplateRecord(detail.template, detail);
  }

  async function importTemplateToLibrary(file) {
    try {
      const exchange = await workbookExchange(file);
      const response = await window.sapdDataClient?.importMaturityTemplateExchange?.(exchange);
      const imported = unwrap(response);
      if (!imported?.ok) throw new Error(list(imported?.rowErrors)[0]?.message || "导入模板校验未通过");
      const store = safeStore();
      store.templateLibrary = list(store.templateLibrary).filter((item) => (item?.template || item)?.id !== imported.template.id);
      store.templateLibrary.push({ template: imported.template, importedAt: nowLabel(), sourceTemplateType: imported.sourceTemplateType || "custom" });
      store.templateImportBatches = list(store.templateImportBatches);
      store.templateImportBatches.push({ ...imported.batch, importedAt: nowLabel(), sourceTemplateType: imported.sourceTemplateType || "custom" });
      writeStore(store);
      model.templateManagerView = "custom";
      showToast("自定义业务模板已导入：评分标题与评分列已保留，评分数据单元格为空。", "success");
    } catch (error) {
      showToast(error?.message || "模板导入失败", "error");
    }
  }

  async function importTemplate(detail, file) {
    try {
      const exchange = await workbookExchange(file);
      const response = await window.sapdDataClient?.importMaturityTemplateExchange?.(exchange);
      const imported = unwrap(response);
      if (!imported?.ok) throw new Error(list(imported?.rowErrors)[0]?.message || "导入模板校验未通过");
      detail.template = { ...imported.template, type: "custom", status: "validated" };
      detail.project.templateId = detail.template.id || uid("custom-template");
      detail.project.templateName = detail.template.name || "导入的自定义模板";
      detail.project.templateType = "custom";
      detail.project.templateSnapshotId = detail.template.snapshotId;
      detail.project.status = "scoring";
      detail.scoreEntries = createBlankEntries(detail.template);
      detail.validation = imported.validation;
      detail.exchangeBatches = list(detail.exchangeBatches);
      detail.exchangeBatches.push({ ...imported.batch, rowErrors: list(imported.rowErrors) });
      touchDetail(detail, { invalidateResult: true, invalidateReport: true });
      render();
      showToast("自定义模板结构已导入并通过后端校验", "success");
    } catch (error) {
      showToast(error?.message || "模板导入失败", "error");
    }
  }

  async function exportScoreExchange(detail) {
    try {
      const response = await window.sapdDataClient?.exportMaturityScoreExchange?.({ project: detail.project, template: detail.template, scoreEntries: detail.scoreEntries });
      const exported = unwrap(response);
      if (!exported?.ok) throw new Error(list(exported?.validation?.errors)[0]?.message || "评分文件导出失败");
      detail.exchangeBatches = list(detail.exchangeBatches);
      detail.exchangeBatches.push(exported.batch);
      persistDetail(detail);
      const outputPath = configuredExportPath(exported);
      if (!outputPath) downloadBlob(workbookBlob(exported.package), exported.fileName || `${safeFileName(detail.project.name)}-评分表.xlsx`, exported.mimeType || XLSX_MIME);
      showToast(outputPath ? `评分表已保存到：${outputPath}` : "评分表已下载，可填写适用性、四维评分和目标等级", "success");
    } catch (error) {
      showToast(error?.message || "评分文件导出失败", "error");
    }
  }

  async function importScoreExchange(detail, file) {
    try {
      const exchange = await workbookExchange(file);
      const response = await window.sapdDataClient?.importMaturityScoreExchange?.({ project: detail.project, template: detail.template, scoreEntries: detail.scoreEntries, exchange });
      const imported = unwrap(response);
      detail.exchangeBatches = list(detail.exchangeBatches);
      if (imported?.batch) detail.exchangeBatches.push({ ...imported.batch, rowErrors: list(imported.rowErrors) });
      detail.scoreImportIssues = list(imported?.rowErrors);
      if (!imported?.ok && !list(imported?.scoreEntries).length) {
        detail.scoreImportNotice = { tone: "error", message: list(imported?.rowErrors)[0]?.message || "评分文件导入失败" };
        persistDetail(detail);
        render();
        showToast(list(imported?.rowErrors)[0]?.message || "评分文件导入失败", "error");
        return;
      }
      detail.scoreEntries = normalizeScoreEntries(list(imported.scoreEntries));
      const successes = Number(imported.batch?.successCount || 0);
      const failures = Number(imported.batch?.failureCount || 0);
      const templateLabel = detail.template?.type === "base" ? "标准模板" : "自定义模板";
      const successMessage = failures ? `${templateLabel}评分文件已导入 ${successes} 个评估点，${failures} 行需要修正` : `${templateLabel}评分文件上传成功，已导入 ${successes} 个评估点`;
      detail.scoreImportNotice = { tone: failures ? "info" : "success", message: successMessage };
      appendProjectHistory(
        detail,
        "SCORE_FILE_IMPORTED",
        failures ? "上传评分文件（部分成功）" : "上传评分文件",
        `${file?.name || "评分文件"} · 成功导入 ${successes} 个评估点${failures ? `，${failures} 行需要修正` : ""}`,
      );
      touchDetail(detail, { invalidateResult: true, invalidateReport: true });
      await calculateDetail(detail, { silent: true });
      showToast(successMessage, failures ? "info" : "success");
    } catch (error) {
      showToast(error?.message || "评分文件导入失败", "error");
    }
  }

  const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

  async function workbookExchange(file) {
    if (!file || !/\.xlsx$/i.test(file.name || "")) throw new Error("请选择 XLSX 文件");
    const workbookBase64 = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error("XLSX 文件读取失败"));
      reader.onload = () => resolve(text(reader.result).split(",", 2)[1] || "");
      reader.readAsDataURL(file);
    });
    if (!workbookBase64) throw new Error("XLSX 文件内容为空");
    return { fileName: file.name, workbookBase64, mimeType: file.type || XLSX_MIME };
  }

  function workbookBlob(exchangePackage) {
    const encoded = text(exchangePackage?.workbookBase64);
    if (!encoded) throw new Error("后端未返回可下载的 XLSX 文件");
    const binary = window.atob(encoded);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
    return new Blob([bytes], { type: exchangePackage?.mimeType || XLSX_MIME });
  }

  function safeFileName(value) {
    return text(value || "maturity-template").replace(/[\\/:*?"<>|]+/g, "-").replace(/\s+/g, "-").slice(0, 80) || "maturity-template";
  }

  function downloadBlob(content, fileName, type) {
    const blob = content instanceof Blob ? content : new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = fileName;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  function configuredExportPath(exported) {
    return text(exported?.outputPath || exported?.output_path || exported?.export?.outputPath || exported?.export?.output_path).trim();
  }

  async function generateReport(detail) {
    if (!detail || model.reportGenerating) return;
    if (!formalAssessmentReady(detail)) {
      showToast("请先完成全部适用评估点并正式完成评估，再生成评估报告", "error");
      return;
    }
    const updateMode = reportPreviouslyGenerated(detail);
    model.reportGenerating = true;
    render();
    try {
      const response = await window.sapdDataClient?.createMaturityReport?.({ project: detail.project, template: detail.template, scoreEntries: detail.scoreEntries, narrative: { ...defaultReportNarrative(), ...(detail.reportNarrative || {}) }, improvementRoadmap: improvementRoadmapRows(detail), operation: updateMode ? "update" : "create" });
      const report = unwrap(response);
      if (!report?.ok) throw new Error(list(report?.validation?.errors)[0]?.message || report?.error || "报告生成失败");
      const reportResultHash = text(report.reportModel?.resultVersion?.resultHash);
      const reportSnapshotHash = text(report.reportModel?.resultSnapshot?.calculationRun?.resultHash);
      if (!reportResultHash || reportResultHash !== reportSnapshotHash) throw new Error("报告结果版本校验失败，请重新生成");
      detail.report = report;
      detail.reportNarrativeDirty = false;
      const htmlFileName = report.fileNames?.html || "maturity-report.html";
      appendProjectHistory(
        detail,
        updateMode ? "REPORT_UPDATED" : "REPORT_GENERATED",
        `${updateMode ? "更新" : "生成"} HTML ${report.formal ? "评估报告" : "报告草稿"}`,
        `${htmlFileName} · ${report.id || "报告快照"}`,
        {
          artifactType: "HTML",
          fileName: htmlFileName,
          reportId: report.id || "",
          reportGeneratedAt: report.generatedAt || "",
          reportArtifactId: report.persistence?.artifactId || "",
          reportArtifactPath: report.persistence?.relativePath || "",
        },
      );
      if (report.formal) {
        detail.project.status = "reported";
        detail.project.readOnly = true;
      }
      touchDetail(detail);
      model.toast = report.formal
        ? updateMode ? "正式评估报告已更新" : "正式评估报告已生成"
        : updateMode ? "评估报告草稿已更新" : "评估报告草稿已生成";
      model.toastTone = "success";
      model.toastRoute = normalizedRoute();
    } catch (error) {
      model.toast = error?.message || "报告生成失败";
      model.toastTone = "error";
      model.toastRoute = normalizedRoute();
    } finally {
      model.reportGenerating = false;
      render();
    }
  }

  async function downloadReport(detail, format) {
    const report = detail?.report;
    if (!report) return;
    if (!reportExportReady(report)) {
      showToast("请先生成包含完整图表与统计的评估报告", "error");
      return;
    }
    try {
      const run = detail.result?.calculationRun || {};
      const persistence = report.persistence || {};
      const response = await window.sapdDataClient?.exportMaturityReport?.({
        project: { id: detail.project?.id || "", name: detail.project?.name || "" },
        artifactId: persistence.artifactId || "",
        reportId: report.id || "",
        inputHash: run.inputHash || "",
        resultHash: run.resultHash || "",
        format,
      });
      const exported = unwrap(response);
      if (exported?.ok === false) throw new Error(exported?.message || exported?.error || "评估报告导出失败");
      const outputPath = configuredExportPath(exported);
      if (outputPath) {
        showToast(`评估报告已保存到：${outputPath}`, "success");
        return;
      }
      if (format === "markdown") downloadBlob(report.markdown || "", report.fileNames?.markdown || "maturity-report.md", "text/markdown;charset=utf-8");
      if (format === "html") downloadBlob(report.html || "", report.fileNames?.html || "maturity-report.html", "text/html;charset=utf-8");
      showToast(`评估报告已按 ${format === "html" ? "HTML" : "Markdown"} 格式下载`, "success");
    } catch (error) {
      showToast(error?.message || "评估报告导出失败", "error");
    }
  }

  async function confirmOverviewReportDownload(detail) {
    if (!detail || model.reportGenerating) return;
    if (!formalAssessmentReady(detail)) {
      showToast("评估尚未正式完成，不能生成或下载评估报告", "error");
      return;
    }
    const format = model.reportDownloadFormat === "markdown" ? "markdown" : "html";
    model.reportDownloadProjectId = "";
    render();
    if (!reportExportReady(detail.report)) await generateReport(detail);
    if (!reportExportReady(detail.report)) return;
    await downloadReport(detail, format);
  }

  function updateScoreEntry(detail, itemId, changes, { rerender = true } = {}) {
    if (!detail || detail.project.readOnly) return;
    if (["score_review", "completed"].includes(detail.project.status)) detail.project.status = "scoring";
    const entry = scoreEntry(detail, itemId);
    detail.scoreImportIssues = list(detail.scoreImportIssues).filter((issue) => text(issue?.itemInstanceId) !== text(itemId));
    Object.assign(entry, changes);
    const scored = entryIsComplete(entry);
    entry.status = entry.isApplicable === false ? "not_applicable" : scored ? "scored" : "incomplete";
    entry.lastUpdateScope = "ITEM";
    entry.lastUpdatedAt = nowLabel();
    markCalculationDirty(detail);
    touchDetail(detail, { invalidateReport: true });
    if (rerender) render();
    scheduleCalculation(detail);
  }

  function flushScoreInspector(detail, itemId) {
    if (!detail || detail.project.readOnly || !itemId) return false;
    const entry = scoreEntry(detail, itemId);
    const controls = [...(model.root?.querySelectorAll(".maturity-v3-score-form [data-score-item-id]") || [])]
      .filter((control) => control.dataset.scoreItemId === itemId);
    let changed = false;
    controls.forEach((control) => {
      const scoreField = control.dataset.scoreField;
      const scoreText = control.dataset.scoreText;
      const dimension = control.dataset.scoreDimension;
      const dimensionNote = control.dataset.scoreDimensionNote;
      const targetDimensionNote = control.dataset.scoreTargetDimensionNote;
      if (scoreField && entry[scoreField] !== control.value) {
        entry[scoreField] = control.value;
        changed = true;
      }
      if (scoreText && entry[scoreText] !== control.value) {
        entry[scoreText] = control.value;
        changed = true;
      }
      if (dimension && entry.elements?.[dimension] !== control.value) {
        if (currentLevelIsAboveTarget(entry, dimension, control.value)) return;
        entry.elements = { ...(entry.elements || {}), [dimension]: control.value };
        entry.reviewElements = {};
        changed = true;
      }
      if (dimensionNote && entry.dimensionNotes?.[dimensionNote] !== control.value) {
        entry.dimensionNotes = { ...(entry.dimensionNotes || {}), [dimensionNote]: control.value };
        changed = true;
      }
      if (targetDimensionNote && entry.targetDimensionNotes?.[targetDimensionNote] !== control.value) {
        entry.targetDimensionNotes = { ...(entry.targetDimensionNotes || {}), [targetDimensionNote]: control.value };
        syncLegacyTargetProjection(entry);
        changed = true;
      }
    });
    if (!changed) return false;
    entry.status = entry.isApplicable === false ? "not_applicable" : entryIsComplete(entry) ? "scored" : "incomplete";
    entry.lastUpdateScope = "ITEM";
    entry.lastUpdatedAt = nowLabel();
    markCalculationDirty(detail);
    touchDetail(detail, { invalidateReport: true });
    return true;
  }

  async function saveAndAdvanceScoreItem(detail, itemId) {
    window.clearTimeout(model.calculationTimer);
    flushScoreInspector(detail, itemId);
    if (model.calculating && model.calculationPromise) await model.calculationPromise;
    window.clearTimeout(model.calculationTimer);
    const result = await calculateDetail(detail, { silent: true });
    if (!result || detail.resultStale) {
      showToast("当前评分尚未完成后端校验，请检查保存状态后重试", "error");
      return;
    }
    const selection = scoringSelection(detail);
    const scoreItems = selection.focuses.flatMap((candidate) => byTemplateOrder(selection.active.scoreItems.filter((item) => item.focusId === candidate.id)));
    const currentIndex = scoreItems.findIndex((item) => item.id === itemId);
    const nextItem = scoreItems[currentIndex + 1] || scoreItems[0];
    if (nextItem && scoringNavigationBlocked(detail, nextItem.id)) return;
    if (nextItem) setScoringItem(detail, nextItem.id);
    render();
    if (nextItem) scheduleScoringLanding(detail, nextItem.id);
  }

  function commitScoreLevel(detail, button) {
    if (!detail || detail.project.readOnly || button.disabled) return;
    const itemId = button.dataset.scoreItemId;
    const dimension = button.dataset.element;
    const level = button.dataset.scoreLevel;
    const mode = ["review", "target"].includes(button.dataset.scoreMode) ? button.dataset.scoreMode : "current";
    if (!LEVELS.includes(level) || !DIMENSIONS.some(([key]) => key === dimension)) return;
    const item = list(detail?.template?.scoreItems).find((candidate) => candidate.id === itemId);
    if (!item || !rubricRows(item, dimension).some((candidate) => candidate.level === level)) return;
    const entry = scoreEntry(detail, itemId);
    const dimensionLabel = DIMENSIONS.find(([key]) => key === dimension)?.[1] || "当前状态";
    if (mode === "review") {
      if (currentLevelIsAboveTarget(entry, dimension, level)) {
        showToast(`${dimensionLabel}复核状态不能高于目标状态 ${entry.targetElements?.[dimension]}`, "error");
        return;
      }
      if (entry.reviewElements?.[dimension] === level) return;
      updateScoreEntry(detail, itemId, { reviewElements: { ...(entry.reviewElements || {}), [dimension]: level } });
    } else if (mode === "target") {
      if (targetLevelIsBelowCurrent(entry, dimension, level)) {
        const currentLevel = currentDimensionLevel(entry, dimension);
        showToast(`${dimensionLabel}目标状态不能低于当前状态 ${currentLevel}`, "error");
        return;
      }
      if (entry.targetElements?.[dimension] === level) return;
      const targetElements = { ...(entry.targetElements || {}), [dimension]: level };
      entry.targetElements = targetElements;
      syncLegacyTargetProjection(entry);
      updateScoreEntry(detail, itemId, { targetElements, targetLevel: entry.targetLevel, targetReason: entry.targetReason, targetConfirmed: entry.targetConfirmed });
    } else {
      if (currentLevelIsAboveTarget(entry, dimension, level)) {
        showToast(`${dimensionLabel}当前状态不能高于目标状态 ${entry.targetElements?.[dimension]}`, "error");
        return;
      }
      if (entry.elements?.[dimension] === level) return;
      updateScoreEntry(detail, itemId, { elements: { ...(entry.elements || {}), [dimension]: level }, reviewElements: {} });
    }
  }

  function updateFocusEntries(detail, focusId, updater, { scope = "FOCUS_BATCH" } = {}) {
    if (!detail || detail.project.readOnly) return;
    if (["score_review", "completed"].includes(detail.project.status)) detail.project.status = "scoring";
    const scoreItems = list(detail.template?.scoreItems).filter((item) => item.focusId === focusId);
    scoreItems.forEach((item) => {
      const entry = scoreEntry(detail, item.id);
      updater(entry, item);
      entry.status = entry.isApplicable === false ? "not_applicable" : entryIsComplete(entry) ? "scored" : "incomplete";
      entry.lastUpdateScope = scope;
      entry.lastUpdatedAt = nowLabel();
      if (scope === "FOCUS_CLEAR") delete entry.focusBatchSourceId;
      else entry.focusBatchSourceId = focusId;
    });
    markCalculationDirty(detail);
    touchDetail(detail, { invalidateReport: true });
    render();
    scheduleCalculation(detail);
  }

  async function completeAssessment(detail) {
    if (model.calculating) {
      showToast("后端正在校验评分，请稍候再完成评估", "info");
      return;
    }
    model.calculating = true;
    render();
    try {
      const liveResult = await requestMaturityCalculation(detail);
      applyCalculatedResult(detail, liveResult);
      persistDetail(detail);
      const liveSummary = liveResult.summary || {};
      if (liveSummary.statisticsReady !== true) {
        model.activeTab = "review";
        model.toast = Number(liveSummary.targetBelowCurrentCount || 0) ? "存在目标等级低于当前评分计算等级的冲突，请先修改" : "仍有适用评分项未完成，不能完成评估";
        model.toastTone = "error";
        model.toastRoute = normalizedRoute();
        return;
      }

      const completedProject = { ...clone(detail.project), status: "completed", readOnly: true };
      const completedEntries = clone(detail.scoreEntries);
      completedEntries.forEach((entry) => {
        if (entry.isApplicable === false) return;
        entry.reviewElements = DIMENSIONS.reduce((values, [key]) => ({ ...values, [key]: entry.reviewElements?.[key] || entry.elements?.[key] }), {});
        entry.targetConfirmed = true;
        entry.status = "confirmed";
      });
      const finalResult = await requestMaturityCalculation({ project: completedProject, template: detail.template, scoreEntries: completedEntries });
      const finalSummary = finalResult.summary || {};
      if (finalSummary.statisticsReady !== true || Number(finalSummary.completionRate || 0) < 100 || Number(finalSummary.notScoredCount || 0) !== 0) {
        throw new Error("完成状态复核未通过，项目状态未改变");
      }

      detail.project = completedProject;
      detail.scoreEntries = completedEntries;
      applyCalculatedResult(detail, finalResult);
      appendProjectHistory(detail, "ASSESSMENT_COMPLETED", "完成评估并锁定评分", "评分检查通过，当前评估结果已重新锁定。");
      touchDetail(detail, { invalidateReport: true });
      model.activeTab = "results";
      model.toast = "评估已完成，全部适用评估点已锁定；不适用与无证据项未作为阻断项。";
      model.toastTone = "success";
      model.toastRoute = normalizedRoute();
    } catch (error) {
      model.activeTab = "review";
      model.toast = error?.message || "完成评估失败，项目状态未改变";
      model.toastTone = "error";
      model.toastRoute = normalizedRoute();
    } finally {
      model.calculating = false;
      render();
    }
  }

  function unlockAssessmentForEditing(detail) {
    if (!detail?.project || !LOCKED_ASSESSMENT_STATUSES.has(detail.project.status) || !detail.project.readOnly) return;
    appendProjectHistory(detail, "ASSESSMENT_UNLOCKED", "解锁评分修改", "保留现有评分，项目回到评分检查阶段；原正式评估报告失效。");
    detail.project.status = "score_review";
    detail.project.readOnly = false;
    detail.resultStale = false;
    touchDetail(detail, { invalidateReport: true });
    model.unlockConfirmProjectId = "";
    model.activeTab = "scoring";
    render();
    showToast("项目已解锁，可以修改评分；评分检查中的“完成评估”已恢复。", "success");
  }

  function scheduleScoringLanding(detail, itemId, { firstMissing = false, targetConflict = false } = {}) {
    window.setTimeout(() => {
      window.requestAnimationFrame(() => {
        const entry = scoreEntry(detail, itemId);
        const missingCurrentDimension = firstMissing ? DIMENSIONS.find(([key]) => !LEVELS.includes(entry.elements?.[key]))?.[0] : "";
        const missingTargetDimension = firstMissing && !missingCurrentDimension ? DIMENSIONS.find(([key]) => !LEVELS.includes(entry.targetElements?.[key]))?.[0] : "";
        const missingDimension = missingCurrentDimension || missingTargetDimension || "organization";
        const organizationRow = model.root?.querySelector('[data-maturity-dimension-row="organization"]');
        const dimensionRow = model.root?.querySelector(`[data-maturity-dimension-row="${missingDimension || "organization"}"]`) || organizationRow;
        const targetControl = targetConflict || missingTargetDimension
          ? dimensionRow?.querySelector('[data-score-state="target"] [role="radio"][tabindex="0"]') || model.root?.querySelector('[data-score-state="target"] [role="radio"][tabindex="0"]')
          : null;
        const target = targetControl || dimensionRow;
        const dimensionScrollOwner = target?.closest(".maturity-v12-score-dimensions");
        const dimensionOverflow = dimensionScrollOwner ? window.getComputedStyle(dimensionScrollOwner).overflowY : "";
        const formScrollOwner = target?.closest(".maturity-v3-score-form");
        const formOverflow = formScrollOwner ? window.getComputedStyle(formScrollOwner).overflowY : "";
        const scrollOwner = /auto|scroll|overlay/.test(dimensionOverflow)
          ? dimensionScrollOwner
          : /auto|scroll|overlay/.test(formOverflow)
            ? formScrollOwner
            : target?.closest(".maturity-v1-project-page") || model.root?.querySelector(".maturity-v1-project-page");
        if (target && scrollOwner) {
          const ownerRect = scrollOwner.getBoundingClientRect();
          const targetRect = target.getBoundingClientRect();
          const projectHeader = model.root?.querySelector(".maturity-v6-project-sticky-header");
          const inset = scrollOwner.matches(".maturity-v12-score-dimensions")
            ? 44
            : scrollOwner.matches(".maturity-v3-score-form")
              ? 12
              : Math.max(0, projectHeader?.getBoundingClientRect().height || 0) + 12;
          scrollOwner.scrollTop = Math.max(0, scrollOwner.scrollTop + targetRect.top - ownerRect.top - inset);
        } else {
          target?.scrollIntoView({ block: "start" });
        }
        window.requestAnimationFrame(() => {
          if (targetControl) targetControl.focus({ preventScroll: true });
          else {
            const dimensionControl = dimensionRow?.querySelector('[role="radio"][tabindex="0"]');
            const organizationControl = model.root?.querySelector('[data-maturity-score-group="organization"] [role="radio"][tabindex="0"]');
            (dimensionControl || organizationControl)?.focus({ preventScroll: true });
          }
        });
      });
    }, 0);
  }

  function openScoringItem(detail, itemId, { firstMissing = false } = {}) {
    const item = list(detail?.template?.scoreItems).find((candidate) => candidate.id === itemId);
    if (!item) return;
    model.activeTab = "scoring";
    setScoringItem(detail, item.id);
    render();
    scheduleScoringLanding(detail, item.id, { firstMissing });
  }

  function handleClick(event) {
    const actionTarget = event.target.closest("[data-maturity-action]");
    const tabTarget = event.target.closest("[data-maturity-tab]");
    if (tabTarget) {
      const nextTab = tabTarget.dataset.maturityTab || "overview";
      const detail = activeDetail();
      if (FORMAL_RESULT_TAB_IDS.has(nextTab) && !formalAssessmentReady(detail)) {
        model.activeTab = "review";
        showToast("完成全部适用评估点并正式完成评估后，才能查看评估结果和报告", "info");
        return;
      }
      model.activeTab = nextTab;
      if (model.activeTab !== "report") model.reportEditingSection = "";
      model.projectObjectSearch = "";
      model.projectObjectSearchIndex = 0;
      render();
      return;
    }
    const levelTarget = event.target.closest("[data-maturity-score-level]");
    if (levelTarget) {
      const detail = activeDetail();
      if (detail) commitScoreLevel(detail, levelTarget);
      return;
    }
    if (!actionTarget) return;
    const action = actionTarget.dataset.maturityAction;
    const detail = activeDetail();
    if (action === "edit-project-info" && detail) { openProjectInfoEditor(detail); return; }
    if (action === "cancel-project-info-edit") { closeProjectInfoEditor(); return; }
    if (action === "save-project-info" && detail) { saveProjectInfo(detail); return; }
    if (action === "toggle-score-directory" && detail) {
      const ui = scoreDirectoryUi(detail);
      ui.collapsed = !ui.collapsed;
      render();
      window.setTimeout(() => {
        model.root?.querySelector(ui.collapsed ? ".maturity-v4-directory-expand-tab" : ".maturity-v4-score-directory-actions button")?.focus();
      }, 0);
      return;
    }
    if (action === "step-project-history" && detail) {
      const pageCount = Math.max(1, Math.ceil(projectChangeHistory(detail).length / 3));
      model.projectHistoryPage = Math.max(0, Math.min(pageCount - 1, Number(model.projectHistoryPage || 0) + Number(actionTarget.dataset.historyStep || 0)));
      render();
      return;
    }
    if (action === "dismiss-feedback") { model.toast = ""; model.toastRoute = ""; render(); return; }
    if (action === "retry-load") loadWorkspace({ force: true });
    if (action === "new-project") openCreateWizard();
    if (action === "close-create") closeCreateWizard();
    if (action === "save-create-draft") saveCreateDraft();
    if (action === "resume-draft") openCreateWizard(model.details[actionTarget.dataset.projectId]);
    if (action === "create-edit-step") { model.createStep = Number(actionTarget.dataset.step || 1); model.createErrors = {}; render(); }
    if (action === "set-list-view") { model.listStatus = actionTarget.dataset.listView || "all"; model.projectListPage = 1; model.expandedProjectId = ""; render(); }
    if (action === "clear-list-filters") { model.listSearch = ""; model.listTemplateType = "all"; model.listOwner = "all"; model.listIndustry = "all"; model.projectListPage = 1; render(); }
    if (action === "toggle-project-preview") { model.expandedProjectId = model.expandedProjectId === actionTarget.dataset.projectId ? "" : actionTarget.dataset.projectId; render(); }
    if (action === "open-project-tab") {
      model.activeTab = actionTarget.dataset.projectTab || "overview";
      rememberProjectTab(model.activeTab, actionTarget.dataset.projectId || "");
      model.navigate?.(`/workbench/maturity/${encodeURIComponent(actionTarget.dataset.projectId || "")}`);
    }
    if (action === "show-global-note") showToast(actionTarget.dataset.note || "该功能将在正式持久化阶段开放", "info");
    if (action === "set-template-view") {
      model.templateManagerView = actionTarget.dataset.templateView || "all";
      model.templateManagerPage = 1;
      renderTemplateManagerRegion({ restoreTabFocus: true });
    }
    if (action === "set-workspace-page") {
      const page = Math.max(1, Number(actionTarget.dataset.page) || 1);
      if (actionTarget.dataset.pageTarget === "templates") {
        model.templateManagerPage = page;
        renderTemplateManagerRegion();
      } else {
        model.projectListPage = page;
        model.expandedProjectId = "";
        render();
      }
    }
    if (action === "trigger-global-template-import") model.root.querySelector("[data-maturity-template-library-file]")?.click();
    if (action === "export-global-template") {
      const record = templateLibraryRecords().find((item) => item.template.id === actionTarget.dataset.templateId);
      if (record) exportTemplateRecord(record.template, record.sourceProjectId ? model.details[record.sourceProjectId] : null);
    }
    if (action === "use-library-template") {
      const record = templateLibraryRecords().find((item) => item.template.id === actionTarget.dataset.templateId);
      if (record) openCreateWizard(null, record.template);
    }
    if (action === "manage-template-project") {
      model.activeTab = "template";
      model.navigate?.(`/workbench/maturity/${encodeURIComponent(actionTarget.dataset.projectId || "")}`);
    }
    if (action === "set-results-view") { model.resultsView = actionTarget.dataset.resultsView || "customer"; render(); }
    if (action === "open-review-tab") { model.activeTab = "review"; model.projectObjectSearch = ""; render(); }
    if (action === "create-next") {
      if (model.createStep === 1 && !readCreateStepOne()) {
        render();
        window.setTimeout(() => model.root.querySelector('[aria-invalid="true"]')?.focus(), 0);
        return;
      }
      if (model.createStep === 2 && !model.createDraft.templateType) {
        model.createErrors = { templateType: "请选择评估模板" };
        render();
        return;
      }
      model.createErrors = {};
      model.createStep = Math.min(3, model.createStep + 1);
      render();
    }
    if (action === "create-back") {
      model.createStep = Math.max(1, model.createStep - 1);
      render();
    }
    if (action === "choose-template") {
      model.createDraft.templateType = actionTarget.dataset.templateType || "base";
      model.createDraft.templateLibraryId = actionTarget.dataset.templateId || (model.createDraft.templateType === "base" ? model.workspace?.template?.id || "" : "");
      model.createErrors = {};
      render();
    }
    if (action === "create-project") createProject();
    if (action === "reset-demo") {
      clearStoredDemo();
      model.loaded = false;
      model.workspace = null;
      model.details = {};
      loadWorkspace({ force: true });
    }
    if (!detail) return;
    if (action === "select-report-v2-stage") {
      const stageId = text(actionTarget.dataset.reportV2Stage);
      if (!REPORT_V2_STAGES.some((stage) => stage.id === stageId)) return;
      model.reportV2Stage = stageId;
      render();
      window.setTimeout(() => model.root?.querySelector("[data-report-authoring]")?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
      return;
    }
    if (action === "scroll-report-v2-preview") {
      model.root?.querySelector("#maturityReportV2Preview")?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    if (action === "scroll-report-section") {
      const target = model.root?.querySelector(`#${CSS.escape(actionTarget.dataset.reportSectionTarget || "")}`);
      const details = target?.matches("details") ? target : target?.querySelector(":scope > details");
      if (details) details.open = true;
      target?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    if (action === "edit-report-section") {
      model.reportEditingSection = actionTarget.dataset.reportField || "";
      render();
      window.setTimeout(() => model.root?.querySelector(`[data-maturity-report-field="${CSS.escape(model.reportEditingSection)}"]`)?.focus(), 0);
      return;
    }
    if (action === "finish-report-section") {
      model.reportEditingSection = "";
      render();
      return;
    }
    if (action === "request-overview-report-download") {
      model.reportDownloadProjectId = detail.project.id;
      model.reportDownloadFormat = "html";
      render();
      window.setTimeout(() => model.root?.querySelector(".maturity-v33-report-download-modal input:checked")?.focus(), 0);
      return;
    }
    if (action === "cancel-overview-report-download") {
      model.reportDownloadProjectId = "";
      render();
      return;
    }
    if (action === "confirm-overview-report-download") {
      confirmOverviewReportDownload(detail);
      return;
    }
    if (action === "request-score-unlock") {
      if (!detail.project.readOnly || !LOCKED_ASSESSMENT_STATUSES.has(detail.project.status)) return;
      model.unlockConfirmProjectId = detail.project.id;
      render();
      window.setTimeout(() => model.root?.querySelector(".maturity-v32-unlock-modal button")?.focus(), 0);
      return;
    }
    if (action === "cancel-score-unlock") {
      model.unlockConfirmProjectId = "";
      render();
      return;
    }
    if (action === "confirm-score-unlock") {
      unlockAssessmentForEditing(detail);
      return;
    }
    if (action === "step-project-search") {
      const rows = projectObjectSearchResults(detail);
      if (!rows.length) return;
      const delta = Number(actionTarget.dataset.searchStep || 0) < 0 ? -1 : 1;
      model.projectObjectSearchIndex = (Number(model.projectObjectSearchIndex || 0) + delta + rows.length) % rows.length;
      render();
      window.setTimeout(() => model.root?.querySelector("[data-maturity-project-search]")?.focus(), 0);
      return;
    }
    const lockedActions = new Set(["clone-custom-template", "add-category", "remove-category", "add-custom-scope", "add-custom-capability", "add-custom-focus", "add-custom-service", "remove-custom-focus", "validate-template", "trigger-template-import", "trigger-score-import", "complete-assessment"]);
    if (detail.project.readOnly && lockedActions.has(action)) {
      showToast("正式报告项目已锁定；请新建项目或复制模板后继续评估", "error");
      return;
    }
    if (action === "toggle-score-hierarchy") {
      const key = hierarchyKey(actionTarget.dataset.hierarchyLevel || "", actionTarget.dataset.hierarchyId || "");
      const expanded = hierarchyExpansion(detail);
      if (expanded.has(key)) expanded.delete(key);
      else expanded.add(key);
      render();
    }
    if (action === "calculate") calculateDetail(detail);
    if (action === "open-report") {
      model.activeTab = "report";
      render();
    }
    if (action === "select-capability") {
      if (scoringNavigationBlocked(detail, "")) return;
      setScoringCapability(detail, actionTarget.dataset.capabilityId || "");
      render();
    }
    if (action === "continue-overview-capability") {
      if (scoringNavigationBlocked(detail, "")) return;
      model.activeTab = "scoring";
      setScoringCapability(detail, actionTarget.dataset.capabilityId || "");
      render();
    }
    if (action === "select-score-l0") {
      if (scoringNavigationBlocked(detail, "")) return;
      setScoringHierarchy(detail, "L0", actionTarget.dataset.categoryId || "");
      render();
    }
    if (action === "select-score-l1") {
      if (scoringNavigationBlocked(detail, "")) return;
      setScoringHierarchy(detail, "L1", actionTarget.dataset.categoryId || "");
      render();
    }
    if (action === "select-focus") {
      if (scoringNavigationBlocked(detail, "")) return;
      setScoringFocus(detail, actionTarget.dataset.focusId || "");
      model.focusBatchOpen = false;
      model.focusBatchClearConfirmId = "";
      render();
    }
    if (action === "select-score-item") {
      if (scoringNavigationBlocked(detail, actionTarget.dataset.scoreItemId || "")) return;
      setScoringItem(detail, actionTarget.dataset.scoreItemId || "");
      render();
    }
    if (action === "open-project-object-result") {
      const objectType = actionTarget.dataset.objectType || "";
      const objectId = actionTarget.dataset.objectId || "";
      const scoreItemId = actionTarget.dataset.scoreItemId || "";
      const focusId = actionTarget.dataset.focusId || "";
      if (scoringNavigationBlocked(detail, scoreItemId)) return;
      model.activeTab = "scoring";
      model.projectObjectSearch = "";
      model.projectObjectSearchIndex = 0;
      if (["L0", "L1", "L2"].includes(objectType)) setScoringHierarchy(detail, objectType, objectId);
      else if (objectType === "FOCUS") setScoringFocus(detail, objectId);
      else if (objectType === "SERVICE" && scoreItemId) setScoringItem(detail, scoreItemId);
      else if (objectType === "SERVICE" && focusId) setScoringFocus(detail, focusId);
      render();
      if (scoreItemId) scheduleScoringLanding(detail, scoreItemId);
    }
    if (action === "toggle-focus-batch") {
      const selection = scoringSelection(detail);
      const batch = focusBatchState(detail, selection.scoreItems);
      if (!batch.hasServiceItems) {
        showToast(batch.target.reason, "info");
        return;
      }
      model.focusBatchOpen = !model.focusBatchOpen;
      model.focusBatchClearConfirmId = "";
      model.focusTargetClearConfirmId = "";
      render();
    }
    if (action === "request-clear-focus-scores") {
      const selection = scoringSelection(detail);
      const batch = focusBatchState(detail, selection.scoreItems);
      if (!batch.canClear) {
        showToast(batch.reason, "info");
        return;
      }
      model.focusBatchClearConfirmId = actionTarget.dataset.focusId || "";
      render();
    }
    if (action === "cancel-clear-focus-scores") {
      model.focusBatchClearConfirmId = "";
      render();
    }
    if (action === "confirm-clear-focus-scores") {
      const selection = scoringSelection(detail);
      const batch = focusBatchState(detail, selection.scoreItems);
      const focusId = actionTarget.dataset.focusId || "";
      if (!batch.canClear || focusId !== selection.focus?.id) {
        showToast(batch.reason || "当前关注点已变化，请重新操作", "info");
        return;
      }
      model.focusBatchClearConfirmId = "";
      updateFocusEntries(detail, focusId, (entry, item) => {
        if (item.itemType !== "SERVICE") return;
        entry.elements = {};
        entry.reviewElements = {};
      }, { scope: "FOCUS_CLEAR" });
      showToast("已清空当前关注点全部下级四维评分，可以重新统一设置", "success");
    }
    if (action === "apply-focus-batch-level") {
      const selection = scoringSelection(detail);
      const batch = focusBatchState(detail, selection.scoreItems);
      const level = model.focusBatchLevel;
      const existingTargetMinimumLevel = focusExistingTargetMinimumLevel(detail, selection.scoreItems);
      const maximumAllowedLevel = focusCurrentMaximumAllowedLevel(detail, selection.scoreItems);
      if (!batch.canApply || !LEVELS.includes(level)) {
        showToast(batch.reason || "请选择有效等级", "info");
        return;
      }
      if (LEVELS.indexOf(level) > LEVELS.indexOf(maximumAllowedLevel)) {
        showToast(`下级当前状态不能高于下级已有最低目标等级 ${existingTargetMinimumLevel}`, "error");
        return;
      }
      model.focusBatchOpen = !batch.target.hasAll;
      model.focusBatchClearConfirmId = "";
      updateFocusEntries(detail, actionTarget.dataset.focusId, (entry, item) => {
        if (item.itemType !== "SERVICE" || entry.isApplicable === false) return;
        entry.elements = DIMENSIONS.reduce((values, [key]) => ({ ...values, [key]: level }), {});
        entry.reviewElements = {};
      });
      showToast(`已将 ${level} 作为下级评估点的四维初始等级`, "success");
    }
    if (action === "request-clear-focus-targets") {
      const selection = scoringSelection(detail);
      const batch = focusBatchState(detail, selection.scoreItems);
      if (!batch.target.canClear) {
        showToast(batch.target.reason, "info");
        return;
      }
      model.focusTargetClearConfirmId = actionTarget.dataset.focusId || "";
      render();
    }
    if (action === "cancel-clear-focus-targets") {
      model.focusTargetClearConfirmId = "";
      render();
    }
    if (action === "confirm-clear-focus-targets") {
      const selection = scoringSelection(detail);
      const batch = focusBatchState(detail, selection.scoreItems);
      const focusId = actionTarget.dataset.focusId || "";
      if (!batch.target.canClear || focusId !== selection.focus?.id) {
        showToast(batch.target.reason || "当前关注点已变化，请重新操作", "info");
        return;
      }
      model.focusTargetClearConfirmId = "";
      updateFocusEntries(detail, focusId, (entry, item) => {
        if (item.itemType !== "SERVICE") return;
        entry.targetElements = {};
        entry.targetDimensionNotes = {};
        entry.targetLevel = "";
        entry.targetReason = "";
        entry.targetConfirmed = false;
      }, { scope: "FOCUS_TARGET_CLEAR" });
      showToast("已清空当前关注点全部下级目标，当前评分保持不变", "success");
    }
    if (action === "apply-focus-target-batch-level") {
      const selection = scoringSelection(detail);
      const batch = focusBatchState(detail, selection.scoreItems);
      const level = model.focusTargetBatchLevel;
      const currentMaximumLevel = focusCurrentMaximumLevel(detail, selection.scoreItems);
      const minimumLevel = focusTargetMinimumLevel(detail, selection.scoreItems);
      if (!batch.target.canApply || !LEVELS.includes(level)) {
        showToast(batch.target.reason || "请选择有效目标等级", "info");
        return;
      }
      if (LEVELS.indexOf(level) < LEVELS.indexOf(minimumLevel)) {
        showToast(`下级目标状态不能低于下级当前最高等级 ${currentMaximumLevel}`, "error");
        return;
      }
      model.focusBatchOpen = !batch.current.hasAll;
      model.focusTargetClearConfirmId = "";
      updateFocusEntries(detail, actionTarget.dataset.focusId, (entry, item) => {
        if (item.itemType !== "SERVICE" || entry.isApplicable === false) return;
        entry.targetElements = DIMENSIONS.reduce((values, [key]) => ({ ...values, [key]: level }), {});
        syncLegacyTargetProjection(entry);
      }, { scope: "FOCUS_TARGET_BATCH" });
      showToast(`已将 ${level} 作为下级评估点的四维目标等级`, "success");
    }
    if (action === "select-review-item") {
      model.selectedScoreItemId = model.selectedScoreItemId === actionTarget.dataset.scoreItemId ? "" : actionTarget.dataset.scoreItemId || "";
      render();
    }
    if (action === "adjust-first-blocker") {
      const blocker = list(detail?.scoreEntries).find((entry) => entry.isApplicable !== false && !scorePointIsComplete(detail, entry.scoreItemId, entry));
      if (blocker) openScoringItem(detail, blocker.scoreItemId, { firstMissing: true });
    }
    if (action === "adjust-review-item") openScoringItem(detail, actionTarget.dataset.scoreItemId, { firstMissing: true });
    if (action === "close-score-item") {
      model.selectedScoreItemId = "";
      render();
    }
    if (action === "next-score-item") {
      saveAndAdvanceScoreItem(detail, actionTarget.dataset.scoreItemId);
      return;
    }
    if (action === "clear-score-filters") {
      model.scoringSearch = "";
      model.scoringStatus = "all";
      model.scoringEvidence = "all";
      render();
    }
    if (action === "clone-custom-template") cloneAsCustom(detail);
    if (action === "add-category") addCustomCategory(detail);
    if (action === "remove-category") removeCustomCategory(detail, actionTarget.dataset.categoryId);
    if (action === "add-custom-scope") addCustomScope(detail);
    if (action === "select-template-capability") {
      model.selectedTemplateCapabilityId = actionTarget.dataset.capabilityId || "";
      render();
    }
    if (action === "add-custom-capability") addCustomCapability(detail);
    if (action === "add-custom-focus") addCustomFocus(detail, actionTarget.dataset.capabilityId);
    if (action === "add-custom-service") addCustomServiceToFocus(detail, actionTarget.dataset.focusId);
    if (action === "remove-custom-focus") removeCustomFocus(detail, actionTarget.dataset.focusId);
    if (action === "validate-template") validateTemplate(detail);
    if (action === "export-template") exportTemplate(detail);
    if (action === "trigger-template-import") model.root.querySelector("[data-maturity-template-file]")?.click();
    if (action === "export-score-exchange") exportScoreExchange(detail);
    if (action === "trigger-score-import") (model.root.querySelector("[data-maturity-score-file]") || document.querySelector("#maturityShellHeaderActions [data-maturity-score-file]"))?.click();
    if (action === "complete-assessment") completeAssessment(detail);
    if (action === "generate-report") generateReport(detail);
    if (action === "download-report") downloadReport(detail, actionTarget.dataset.format);
  }

  function handleChange(event) {
    const detail = activeDetail();
    if (event.target.matches("[data-maturity-report-download-format]")) {
      model.reportDownloadFormat = event.target.value === "markdown" ? "markdown" : "html";
      render();
      window.setTimeout(() => model.root?.querySelector(`[data-maturity-report-download-format][value="${model.reportDownloadFormat}"]`)?.focus(), 0);
      return;
    }
    if (event.target.matches("[data-maturity-list-filter='status']")) {
      model.listStatus = event.target.value || "all";
      model.projectListPage = 1;
      render();
      return;
    }
    if (event.target.matches("[data-maturity-list-filter='templateType']")) {
      model.listTemplateType = event.target.value || "all";
      model.projectListPage = 1;
      render();
      return;
    }
    if (event.target.matches("[data-maturity-list-filter='owner']")) {
      model.listOwner = event.target.value || "all";
      model.projectListPage = 1;
      render();
      return;
    }
    if (event.target.matches("[data-maturity-list-filter='industry']")) {
      model.listIndustry = event.target.value || "all";
      model.projectListPage = 1;
      render();
      return;
    }
    if (event.target.matches("[data-maturity-page-size]")) {
      const pageSize = Number(event.target.value) || 5;
      if (event.target.dataset.maturityPageSize === "templates") {
        model.templateManagerPageSize = pageSize;
        model.templateManagerPage = 1;
      } else {
        model.projectListPageSize = pageSize;
        model.projectListPage = 1;
        model.expandedProjectId = "";
      }
      render();
      return;
    }
    if (event.target.matches("[data-create-field]")) {
      model.createDraft[event.target.dataset.createField] = event.target.value;
      delete model.createErrors[event.target.dataset.createField];
      return;
    }
    if (event.target.matches("[data-maturity-template-library-file]") && event.target.files?.[0]) {
      importTemplateToLibrary(event.target.files[0]);
      event.target.value = "";
      return;
    }
    if (!detail) return;
    if (event.target.matches("select[data-maturity-roadmap-field]")) {
      updateImprovementRoadmapField(detail, text(event.target.dataset.capabilityId), text(event.target.dataset.maturityRoadmapField), event.target.value);
      return;
    }
    if (event.target.matches("[data-maturity-capability-jump]")) {
      const capabilityId = event.target.value;
      if (capabilityId && scoringNavigationBlocked(detail, "")) { render(); return; }
      if (capabilityId) setScoringCapability(detail, capabilityId);
      render();
      return;
    }
    if (event.target.matches("[data-maturity-score-filter='status']")) {
      model.scoringStatus = event.target.value || "all";
      model.selectedScoreItemId = "";
      render();
      return;
    }
    if (event.target.matches("[data-maturity-score-filter='evidence']")) {
      model.scoringEvidence = event.target.value || "all";
      model.selectedScoreItemId = "";
      render();
      return;
    }
    if (detail.project.readOnly && event.target.matches("[data-template-capability-field], [data-template-category-field], [data-template-focus-field], [data-maturity-template-file], [data-maturity-score-file]")) {
      render();
      showToast("正式报告项目已锁定；模板不能继续修改", "error");
      return;
    }
    if (event.target.matches("[data-focus-applicability-toggle]")) {
      const focusId = event.target.dataset.focusId;
      const focus = list(detail.template?.focuses).find((item) => item.id === focusId) || {};
      const isApplicable = event.target.checked;
      updateFocusEntries(detail, focusId, (entry) => {
        entry.isApplicable = isApplicable;
        entry.naReason = isApplicable ? "" : entry.naReason || `${focus.code || "当前"} ${focus.name || "关注点"}整体标记为不适用。`;
      });
      return;
    }
    if (event.target.matches("[data-focus-applicability]")) {
      const isApplicable = event.target.value !== "false";
      updateFocusEntries(detail, event.target.dataset.focusId, (entry) => {
        entry.isApplicable = isApplicable;
        if (isApplicable) entry.naReason = "";
      });
      return;
    }
    if (event.target.matches("[data-focus-score-dimension]")) {
      const key = event.target.dataset.focusScoreDimension;
      const value = event.target.value;
      const conflictingEntry = list(detail.template?.scoreItems)
        .filter((item) => item.focusId === event.target.dataset.focusId && item.itemType === "SERVICE")
        .map((item) => scoreEntry(detail, item.id))
        .find((entry) => entry.isApplicable !== false
          && LEVELS.includes(entry.targetElements?.[key])
          && LEVELS.indexOf(value) > LEVELS.indexOf(entry.targetElements[key]));
      if (conflictingEntry) {
        showToast(`下级当前状态不能高于已有目标状态 ${conflictingEntry.targetElements?.[key]}`, "error");
        render();
        return;
      }
      updateFocusEntries(detail, event.target.dataset.focusId, (entry) => {
        if (entry.isApplicable === false) return;
        entry.elements = { ...(entry.elements || {}), [key]: value };
        entry.reviewElements = {};
      });
      return;
    }
    if (event.target.matches("[data-focus-score-field='targetLevel']")) {
      const value = event.target.value;
      const focusItems = list(detail.template?.scoreItems).filter((item) => item.focusId === event.target.dataset.focusId);
      const currentMaximumLevel = focusCurrentMaximumLevel(detail, focusItems);
      const minimumLevel = focusTargetMinimumLevel(detail, focusItems);
      if (!minimumLevel || LEVELS.indexOf(value) < LEVELS.indexOf(minimumLevel)) {
        showToast(`下级目标状态不能低于下级当前最高等级 ${currentMaximumLevel}`, "error");
        render();
        return;
      }
      updateFocusEntries(detail, event.target.dataset.focusId, (entry) => {
        if (entry.isApplicable === false) return;
        entry.targetElements = DIMENSIONS.reduce((values, [key]) => ({ ...values, [key]: value }), {});
        syncLegacyTargetProjection(entry);
      }, { scope: "FOCUS_TARGET_BATCH" });
      return;
    }
    if (event.target.matches("[data-score-applicability]")) {
      const isApplicable = event.target.type === "checkbox" ? event.target.checked : event.target.value !== "false";
      updateScoreEntry(detail, event.target.dataset.scoreItemId, { isApplicable, naReason: isApplicable ? "" : scoreEntry(detail, event.target.dataset.scoreItemId).naReason || "" });
      return;
    }
    if (event.target.matches("[data-score-dimension]")) {
      const entry = scoreEntry(detail, event.target.dataset.scoreItemId);
      if (currentLevelIsAboveTarget(entry, event.target.dataset.scoreDimension, event.target.value)) {
        showToast(`当前状态不能高于目标状态 ${entry.targetElements?.[event.target.dataset.scoreDimension]}`, "error");
        render();
        return;
      }
      updateScoreEntry(detail, event.target.dataset.scoreItemId, { elements: { ...(entry.elements || {}), [event.target.dataset.scoreDimension]: event.target.value }, reviewElements: {} });
      return;
    }
    if (event.target.matches("[data-score-review-dimension]")) {
      const entry = scoreEntry(detail, event.target.dataset.scoreItemId);
      if (currentLevelIsAboveTarget(entry, event.target.dataset.scoreReviewDimension, event.target.value)) {
        showToast(`复核状态不能高于目标状态 ${entry.targetElements?.[event.target.dataset.scoreReviewDimension]}`, "error");
        render();
        return;
      }
      updateScoreEntry(detail, event.target.dataset.scoreItemId, { reviewElements: { ...(entry.reviewElements || {}), [event.target.dataset.scoreReviewDimension]: event.target.value } });
      return;
    }
    if (event.target.matches("[data-score-field]")) {
      updateScoreEntry(detail, event.target.dataset.scoreItemId, { [event.target.dataset.scoreField]: event.target.value });
      return;
    }
    if (event.target.matches("[data-score-text]")) {
      updateScoreEntry(detail, event.target.dataset.scoreItemId, { [event.target.dataset.scoreText]: event.target.value });
      return;
    }
    if (event.target.matches("[data-score-dimension-note]")) {
      const entry = scoreEntry(detail, event.target.dataset.scoreItemId);
      updateScoreEntry(detail, event.target.dataset.scoreItemId, { dimensionNotes: { ...(entry.dimensionNotes || {}), [event.target.dataset.scoreDimensionNote]: event.target.value } });
      return;
    }
    if (event.target.matches("[data-score-target-dimension-note]")) {
      const entry = scoreEntry(detail, event.target.dataset.scoreItemId);
      entry.targetDimensionNotes = { ...(entry.targetDimensionNotes || {}), [event.target.dataset.scoreTargetDimensionNote]: event.target.value };
      syncLegacyTargetProjection(entry);
      updateScoreEntry(detail, event.target.dataset.scoreItemId, { targetDimensionNotes: entry.targetDimensionNotes, targetReason: entry.targetReason });
      return;
    }
    if (event.target.matches("[data-template-capability-field]")) {
      const capability = list(detail.template.capabilities).find((item) => item.id === event.target.dataset.capabilityId);
      if (!capability) return;
      const field = event.target.dataset.templateCapabilityField;
      capability[field] = event.target.type === "checkbox" ? event.target.checked : event.target.value;
      capability.changeAction = capability.changeAction === "ADDED" ? "ADDED" : field === "included" && capability.included === false ? "REMOVED" : field === "categoryId" ? "MOVED" : "MODIFIED";
      if (field === "categoryId") {
        const category = list(detail.template.categories).find((item) => item.id === event.target.value) || {};
        capability.currentParentId = event.target.value;
        capability.topCategoryId = category.parentId || null;
      }
      markTemplateDirty(detail);
      render();
      scheduleCalculation(detail);
      return;
    }
    if (event.target.matches("[data-template-category-field]")) {
      const category = list(detail.template.categories).find((item) => item.id === event.target.dataset.categoryId);
      if (!category) return;
      const field = event.target.dataset.templateCategoryField;
      category[field] = event.target.value || null;
      category.currentParentId = category.parentId || null;
      category.changeAction = category.changeAction === "ADDED" ? "ADDED" : field === "parentId" ? "MOVED" : "MODIFIED";
      markTemplateDirty(detail);
      render();
      return;
    }
    if (event.target.matches("[data-template-focus-field]")) {
      const focus = list(detail.template.focuses).find((item) => item.id === event.target.dataset.focusId);
      if (!focus) return;
      const field = event.target.dataset.templateFocusField;
      const previousCapabilityId = focus.capabilityId;
      focus[field] = event.target.value;
      focus.currentParentId = focus.capabilityId;
      focus.changeAction = focus.changeAction === "ADDED" ? "ADDED" : field === "capabilityId" ? "MOVED" : "MODIFIED";
      if (field === "capabilityId" && previousCapabilityId !== focus.capabilityId) {
        const previous = list(detail.template.capabilities).find((item) => item.id === previousCapabilityId);
        const current = list(detail.template.capabilities).find((item) => item.id === focus.capabilityId);
        if (previous) previous.focusIds = list(previous.focusIds).filter((id) => id !== focus.id);
        if (current && !list(current.focusIds).includes(focus.id)) current.focusIds.push(focus.id);
        list(detail.template.scoreItems).filter((item) => item.focusId === focus.id).forEach((item) => { item.capabilityId = focus.capabilityId; });
      }
      markTemplateDirty(detail);
      render();
      return;
    }
    if (event.target.matches("[data-maturity-template-file]") && event.target.files?.[0]) importTemplate(detail, event.target.files[0]);
    if (event.target.matches("[data-maturity-score-file]") && event.target.files?.[0]) importScoreExchange(detail, event.target.files[0]);
  }

  function syncReportV2ProgressDom(detail) {
    const progress = reportV2Progress(detail);
    const root = model.root;
    const filledNode = root?.querySelector("[data-report-v2-filled]");
    const totalNode = root?.querySelector("[data-report-v2-total]");
    const progressBar = root?.querySelector("[data-report-v2-progress]");
    const progressOwner = progressBar?.parentElement;
    const stateNode = root?.querySelector("[data-report-v2-state]");
    if (filledNode) filledNode.textContent = String(progress.filled);
    if (totalNode) totalNode.textContent = String(progress.total);
    if (progressBar) progressBar.style.width = `${progress.percent}%`;
    if (progressOwner) progressOwner.setAttribute("aria-valuenow", progress.percent.toFixed(0));
    if (stateNode) stateNode.textContent = progress.filled === progress.total ? "内容已齐，可提交复核" : `尚缺 ${progress.total - progress.filled} 项人工结论`;
    REPORT_V2_STAGES.forEach((stage) => {
      const fields = REPORT_V2_FIELDS.filter((field) => field.stage === stage.id);
      const filled = fields.filter((field) => text(progress.conclusions[field.id]).trim()).length;
      const node = root?.querySelector(`[data-report-v2-stage-count="${stage.id}"]`);
      if (node) node.textContent = `${filled}/${fields.length}`;
    });
    const shellBadge = document.querySelector("#maturityShellHeaderActions .maturity-v38-shell-state .maturity-v1-status");
    if (shellBadge) {
      shellBadge.textContent = `${progress.filled} / ${progress.total} 已填写`;
      shellBadge.classList.toggle("is-good", progress.filled === progress.total);
      shellBadge.classList.toggle("is-active", progress.filled !== progress.total);
    }
  }

  function updateReportV2Conclusion(detail, fieldId, rawValue, source) {
    const field = REPORT_V2_FIELDS.find((item) => item.id === fieldId);
    if (!detail || !field) return;
    let value = text(rawValue).replaceAll("\r", "");
    if (field.singleLine) value = value.replace(/\s*\n\s*/g, " ");
    value = value.slice(0, field.maxLength);
    detail.reportV2Conclusions = { ...defaultReportV2Conclusions(), ...(detail.reportV2Conclusions || {}), [fieldId]: value };
    detail.reportV2Dirty = true;
    detail.project.updatedAt = nowLabel();
    persistDetail(detail);
    const textarea = model.root?.querySelector(`[data-maturity-report-v2-field="${CSS.escape(fieldId)}"]`);
    const preview = model.root?.querySelector(`[data-maturity-report-v2-preview-field="${CSS.escape(fieldId)}"]`);
    if (textarea && textarea !== source && textarea.value !== value) textarea.value = value;
    if (preview && preview !== source && preview.textContent !== value) preview.textContent = value;
    if (preview && preview === source && preview.textContent !== value) preview.textContent = value;
    if (preview) {
      preview.closest(".maturity-v38-preview-field")?.classList.toggle("is-empty", !value.trim());
      preview.closest(".maturity-v38-preview-field")?.classList.toggle("has-content", Boolean(value.trim()));
    }
    const count = model.root?.querySelector(`[data-report-v2-field-count="${CSS.escape(fieldId)}"]`);
    if (count) count.textContent = String(value.trim().length);
    syncReportV2ProgressDom(detail);
  }

  function handleInput(event) {
    if (event.target.matches("[data-maturity-focus-batch-slider]")) {
      const minimumValue = Math.max(1, Math.min(5, Number(event.target.dataset.maturityMinLevel || 1)));
      const maximumValue = Math.max(minimumValue, Math.min(5, Number(event.target.dataset.maturityMaxLevel || 5)));
      const requestedValue = Math.max(1, Math.min(5, Math.round(Number(event.target.value || 1))));
      const value = Math.max(minimumValue, Math.min(maximumValue, requestedValue));
      event.target.value = String(value);
      const index = value - 1;
      const level = LEVELS[index];
      const kind = event.target.dataset.maturityFocusBatchSlider === "target" ? "target" : "current";
      if (kind === "target") model.focusTargetBatchLevel = level;
      else model.focusBatchLevel = level;
      const control = event.target.closest(".maturity-v9-score-slider");
      control?.style.setProperty("--maturity-score-progress", `${index * 25}%`);
      control?.style.setProperty("--maturity-score-ratio", `${index / 4}`);
      const label = control?.querySelector(`[data-focus-batch-slider-label="${kind}"]`);
      if (label) label.textContent = `${level} ${LEVEL_NAMES[level]}`;
      event.target.setAttribute("aria-valuetext", `${level} ${LEVEL_NAMES[level]}`);
      return;
    }
    if (event.target.matches("[data-create-field]")) {
      model.createDraft[event.target.dataset.createField] = event.target.value;
      delete model.createErrors[event.target.dataset.createField];
      return;
    }
    if (event.target.matches("[data-maturity-report-field]")) {
      const detail = activeDetail();
      if (!detail) return;
      detail.reportNarrative = { ...defaultReportNarrative(), ...(detail.reportNarrative || {}), [event.target.dataset.maturityReportField]: event.target.value };
      detail.reportNarrativeDirty = true;
      detail.project.updatedAt = nowLabel();
      persistDetail(detail);
      return;
    }
    if (event.target.matches("[data-maturity-report-v2-field]")) {
      updateReportV2Conclusion(activeDetail(), event.target.dataset.maturityReportV2Field, event.target.value, event.target);
      return;
    }
    if (event.target.matches("[data-maturity-report-v2-preview-field]")) {
      updateReportV2Conclusion(activeDetail(), event.target.dataset.maturityReportV2PreviewField, event.target.innerText, event.target);
      return;
    }
    if (event.target.matches("[data-maturity-roadmap-field]:not(select)")) {
      const detail = activeDetail();
      if (!detail) return;
      updateImprovementRoadmapField(detail, text(event.target.dataset.capabilityId), text(event.target.dataset.maturityRoadmapField), event.target.value);
      return;
    }
    if (event.target.matches("[data-maturity-list-search]")) {
      model.listSearch = event.target.value;
      model.projectListPage = 1;
      render();
      window.setTimeout(() => { const input = model.root.querySelector("[data-maturity-list-search]"); input?.focus(); input?.setSelectionRange?.(model.listSearch.length, model.listSearch.length); }, 0);
      return;
    }
    if (event.target.matches("[data-maturity-project-search]")) {
      model.projectObjectSearch = event.target.value;
      model.projectObjectSearchIndex = 0;
      render();
      window.setTimeout(() => { const input = model.root.querySelector("[data-maturity-project-search]"); input?.focus(); input?.setSelectionRange?.(model.projectObjectSearch.length, model.projectObjectSearch.length); }, 0);
      return;
    }
    if (event.target.matches("[data-maturity-score-search]")) {
      model.scoringSearch = event.target.value;
      model.selectedScoreItemId = "";
      render();
      window.setTimeout(() => { const input = model.root.querySelector("[data-maturity-score-search]"); input?.focus(); input?.setSelectionRange?.(model.scoringSearch.length, model.scoringSearch.length); }, 0);
      return;
    }
    if (event.target.matches("[data-score-text]")) {
      const detail = activeDetail();
      if (!detail || detail.project.readOnly) return;
      const entry = scoreEntry(detail, event.target.dataset.scoreItemId);
      entry[event.target.dataset.scoreText] = event.target.value;
      entry.status = entry.isApplicable === false ? "not_applicable" : entryIsComplete(entry) ? "scored" : "incomplete";
      entry.lastUpdateScope = "ITEM";
      entry.lastUpdatedAt = nowLabel();
      markCalculationDirty(detail);
      touchDetail(detail, { invalidateReport: true });
      scheduleCalculation(detail);
    }
    if (event.target.matches("[data-score-dimension-note]")) {
      const detail = activeDetail();
      if (!detail || detail.project.readOnly) return;
      const entry = scoreEntry(detail, event.target.dataset.scoreItemId);
      entry.dimensionNotes = { ...(entry.dimensionNotes || {}), [event.target.dataset.scoreDimensionNote]: event.target.value };
      entry.lastUpdateScope = "ITEM";
      entry.lastUpdatedAt = nowLabel();
      touchDetail(detail, { invalidateReport: true });
    }
    if (event.target.matches("[data-score-target-dimension-note]")) {
      const detail = activeDetail();
      if (!detail || detail.project.readOnly) return;
      const entry = scoreEntry(detail, event.target.dataset.scoreItemId);
      entry.targetDimensionNotes = { ...(entry.targetDimensionNotes || {}), [event.target.dataset.scoreTargetDimensionNote]: event.target.value };
      syncLegacyTargetProjection(entry);
      entry.lastUpdateScope = "ITEM";
      entry.lastUpdatedAt = nowLabel();
      touchDetail(detail, { invalidateReport: true });
    }
    if (event.target.matches("[data-focus-na-reason]")) {
      const detail = activeDetail();
      if (!detail || detail.project.readOnly) return;
      const focusId = event.target.dataset.focusId;
      const itemIds = new Set(list(detail.template?.scoreItems).filter((item) => item.focusId === focusId).map((item) => item.id));
      list(detail.scoreEntries).filter((entry) => itemIds.has(entry.scoreItemId) && entry.isApplicable === false).forEach((entry) => {
        entry.naReason = event.target.value;
        entry.status = "not_applicable";
        entry.lastUpdateScope = "FOCUS_BATCH";
        entry.lastUpdatedAt = nowLabel();
      });
      markCalculationDirty(detail);
      touchDetail(detail, { invalidateReport: true });
      scheduleCalculation(detail);
    }
  }

  function handleKeydown(event) {
    const directoryResizer = event.target.closest?.("[data-maturity-score-directory-resizer]");
    if (directoryResizer && ["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) {
      const detail = activeDetail();
      const shell = directoryResizer.closest(".maturity-v4-scoring-shell");
      if (!detail || !shell) return;
      event.preventDefault();
      const ui = scoreDirectoryUi(detail);
      ui.width = event.key === "Home"
        ? SCORE_DIRECTORY_MIN_WIDTH
        : event.key === "End"
          ? SCORE_DIRECTORY_MAX_WIDTH
          : ui.width + (event.key === "ArrowRight" ? 16 : -16);
      applyScoreDirectoryWidth(shell, ui);
      return;
    }
    const projectRow = event.target.closest?.(".maturity-v28-project-row[data-project-id]");
    if (projectRow && event.target === projectRow && ["Enter", " "].includes(event.key)) {
      event.preventDefault();
      model.expandedProjectId = model.expandedProjectId === projectRow.dataset.projectId ? "" : projectRow.dataset.projectId;
      render();
      window.setTimeout(() => model.root?.querySelector(`.maturity-v28-project-row[data-project-id="${projectRow.dataset.projectId}"]`)?.focus(), 0);
      return;
    }
    if (event.target.matches?.("[data-maturity-project-search]") && ["ArrowUp", "ArrowDown", "Enter", "Escape"].includes(event.key)) {
      const detail = activeDetail();
      const rows = projectObjectSearchResults(detail);
      if (event.key === ["Escape"][0]) {
        event.preventDefault();
        model.projectObjectSearch = "";
        model.projectObjectSearchIndex = 0;
        render();
        return;
      }
      if (!rows.length) return;
      event.preventDefault();
      if (event.key === "Enter") {
        model.root?.querySelector(`[data-project-search-index="${Math.max(0, Math.min(rows.length - 1, Number(model.projectObjectSearchIndex || 0)))}"]`)?.click();
        return;
      }
      model.projectObjectSearchIndex = (Number(model.projectObjectSearchIndex || 0) + (event.key === "ArrowUp" ? -1 : 1) + rows.length) % rows.length;
      render();
      window.setTimeout(() => model.root?.querySelector("[data-maturity-project-search]")?.focus(), 0);
      return;
    }
    const scoreLevel = event.target.closest?.("[data-maturity-score-level]");
    if (scoreLevel && ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"].includes(event.key)) {
      const group = scoreLevel.closest("[role='radiogroup']");
      const buttons = [...(group?.querySelectorAll("[data-maturity-score-level]:not(:disabled)") || [])];
      if (!buttons.length) return;
      event.preventDefault();
      const currentIndex = Math.max(0, buttons.indexOf(scoreLevel));
      const nextIndex = event.key === "Home"
        ? 0
        : event.key === "End"
          ? buttons.length - 1
          : (currentIndex + (["ArrowRight", "ArrowDown"].includes(event.key) ? 1 : -1) + buttons.length) % buttons.length;
      const next = buttons[nextIndex];
      const focusKey = { itemId: next.dataset.scoreItemId, dimension: next.dataset.element, level: next.dataset.scoreLevel, mode: next.dataset.scoreMode };
      next.click();
      window.setTimeout(() => {
        const candidates = model.root?.querySelectorAll("[data-maturity-score-level]") || [];
        [...candidates].find((candidate) => candidate.dataset.scoreItemId === focusKey.itemId && candidate.dataset.element === focusKey.dimension && candidate.dataset.scoreLevel === focusKey.level && candidate.dataset.scoreMode === focusKey.mode)?.focus();
      }, 0);
      return;
    }
    const projectInfoModal = model.root?.querySelector(".maturity-v37-project-edit-workspace");
    if (projectInfoModal) {
      if (event.key === "Escape") {
        event.preventDefault();
        closeProjectInfoEditor();
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = [...projectInfoModal.querySelectorAll('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])')].filter((element) => !element.hidden && element.offsetParent !== null);
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      return;
    }
    const reportDownloadModal = model.root?.querySelector(".maturity-v33-report-download-modal");
    if (reportDownloadModal) {
      if (event.key === "Escape") {
        event.preventDefault();
        model.reportDownloadProjectId = "";
        render();
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = [...reportDownloadModal.querySelectorAll('button:not(:disabled), input:not(:disabled), [tabindex]:not([tabindex="-1"])')].filter((element) => !element.hidden && element.offsetParent !== null);
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      return;
    }
    const unlockModal = model.root?.querySelector(".maturity-v32-unlock-modal");
    if (unlockModal) {
      if (event.key === ["Escape"][0]) {
        event.preventDefault();
        model.unlockConfirmProjectId = "";
        render();
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = [...unlockModal.querySelectorAll('button:not(:disabled), [tabindex]:not([tabindex="-1"])')].filter((element) => !element.hidden && element.offsetParent !== null);
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      return;
    }
    if (!model.createOpen) return;
    if (event.key === "Escape") {
      event.preventDefault();
      closeCreateWizard();
      return;
    }
    if (event.key !== "Tab") return;
    const modal = model.root?.querySelector(".maturity-v2-create-workspace");
    if (!modal) return;
    const focusable = [...modal.querySelectorAll('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])')].filter((element) => !element.hidden && element.offsetParent !== null);
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }

  function bindRoot(root) {
    if (model.boundRoot === root) return;
    model.boundRoot = root;
    root.addEventListener("click", handleClick);
    root.addEventListener("change", handleChange);
    root.addEventListener("input", handleInput);
    root.addEventListener("keydown", handleKeydown);
    root.addEventListener("pointerdown", beginScoreDirectoryResize);
    if (!model.scoreContextResizeBound) {
      window.addEventListener("resize", syncFixedScoreContextPosition, { passive: true });
      model.scoreContextResizeBound = true;
    }
  }

  components.MaturityAssessmentWorkbench = {
    dashboardSnapshot,
    ensureDashboardData() {
      return loadWorkspace();
    },
    renderShell() {
      return `<section class="maturity-v1-page is-loading" aria-label="成熟度评估正在准备"><p>正在准备成熟度评估工作台...</p></section>`;
    },
    mount({ root, route, navigate }) {
      const nextRoute = normalizedRoute(route || "/workbench/maturity");
      if (model.toast && model.toastRoute && model.toastRoute !== nextRoute) {
        model.toast = "";
        model.toastRoute = "";
      }
      model.root = root;
      model.route = nextRoute;
      model.activeTab = rememberedProjectTab(nextRoute);
      const routedDetail = model.details[projectIdFromRoute(nextRoute)];
      if (routedDetail && FORMAL_RESULT_TAB_IDS.has(model.activeTab) && !formalAssessmentReady(routedDetail)) {
        model.activeTab = "review";
      }
      model.navigate = typeof navigate === "function" ? navigate : model.navigate;
      bindRoot(root);
      if (!model.loaded && !model.loading) loadWorkspace();
      else render();
    },
  };
})();
