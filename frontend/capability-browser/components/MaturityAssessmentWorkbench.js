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
  const LEGACY_PROJECT_ROUTE_ID = "project-001";
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
    score_review: "待复核",
    completed: "评估完成",
    reported: "已生成报告",
    archived: "已归档",
  };

  const model = {
    root: null,
    route: "/workbench/maturity",
    navigate: null,
    loading: false,
    loaded: false,
    error: "",
    workspace: null,
    details: {},
    activeTab: "scoring",
    selectedCapabilityId: "",
    selectedFocusId: "",
    selectedScoreItemId: "",
    selectedTemplateCapabilityId: "",
    listSearch: "",
    listStatus: "active",
    listTemplateType: "all",
    listOwner: "all",
    listIndustry: "all",
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
    },
    scoringSearch: "",
    scoringStatus: "all",
    scoringEvidence: "all",
    focusBatchOpen: false,
    hierarchyExpansionByProject: {},
    directoryInitializedByProject: {},
    resultsView: "customer",
    validation: null,
    calculating: false,
    reportGenerating: false,
    calculationSequence: 0,
    calculationTimer: 0,
    toast: "",
    toastTone: "info",
    boundRoot: null,
    lastRenderContext: "",
  };

  function clone(value) {
    if (typeof structuredClone === "function") return structuredClone(value);
    return JSON.parse(JSON.stringify(value));
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

  function persistDetail(detail) {
    if (!detail?.project?.id) return false;
    const store = safeStore();
    store.version = "2.1";
    store.projects = store.projects && typeof store.projects === "object" ? store.projects : {};
    store.projects[detail.project.id] = {
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
      exchangeBatches: list(detail.exchangeBatches).slice(-20),
      scoringLocation: detail.scoringLocation || null,
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
        template: clone(detail.template || workspace.template),
      };
    });
    const storedProjects = safeStore().projects || {};
    Object.entries(storedProjects).forEach(([id, stored]) => {
      if (!stored?.project) return;
      const existing = details[id] || {};
      const storedProject = clone(stored.project);
      if (existing.project) {
        ["name", "organization", "owner", "assessors", "customerCharacteristics", "constraints"].forEach((field) => {
          storedProject[field] = clone(existing.project[field]);
        });
      }
      if (["reported", "archived"].includes(storedProject.status)) storedProject.readOnly = true;
      details[id] = {
        ...existing,
        project: storedProject,
        template: clone(stored.template || existing.template || workspace.template),
        scoreEntries: clone(stored.scoreEntries || existing.scoreEntries || []),
        result: clone(stored.result || existing.result || null),
        resultStale: Boolean(stored.resultStale),
        localSaveState: stored.localSaveState || "saved",
        lastSavedAt: stored.lastSavedAt || "",
        lastCalculatedAt: stored.lastCalculatedAt || "",
        validation: clone(stored.validation || existing.validation || null),
        report: clone(stored.report || existing.report || null),
        exchangeBatches: clone(stored.exchangeBatches || existing.exchangeBatches || []),
        scoringLocation: clone(stored.scoringLocation || existing.scoringLocation || null),
        locallyStored: true,
      };
    });
    model.details = details;
  }

  function activeProjectId() {
    const route = text(model.route).replace(/^#/, "").split("?")[0].replace(/\/+$/, "");
    const prefix = "/workbench/maturity/";
    if (!route.startsWith(prefix)) return "";
    const id = decodeURIComponent(route.slice(prefix.length));
    return id === LEGACY_PROJECT_ROUTE_ID ? "demo-project-001" : id;
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

  function showToast(message, tone = "info") {
    model.toast = text(message);
    model.toastTone = tone;
    render();
    window.setTimeout(() => {
      if (model.toast === message) {
        model.toast = "";
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
    if (["draft", "template_configuring", "scoring"].includes(status)) return "active";
    if (status === "score_review") return "review";
    if (["completed", "reported"].includes(status)) return "completed";
    return "all";
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

  function createDraftIsDirty() {
    return Object.entries(model.createDraft || {}).some(([key, value]) => key !== "templateType" && text(value).trim());
  }

  function emptyCreateDraft() {
    return { name: "", organization: "", industry: "", companySize: "", customerCharacteristics: "", constraints: "", owner: "", plannedStartDate: "", plannedEndDate: "", assessors: "", note: "", templateType: "" };
  }

  function levelTone(level) {
    return LEVELS.includes(level) ? `is-${level.toLowerCase()}` : "is-unscored";
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
    const search = text(model.listSearch).toLowerCase();
    const filtered = projects.filter((detail) => {
      const project = detail.project;
      if (model.listStatus !== "all" && projectStatusGroup(project.status) !== model.listStatus) return false;
      if (model.listTemplateType !== "all" && project.templateType !== model.listTemplateType) return false;
      if (model.listOwner !== "all" && project.owner !== model.listOwner) return false;
      if (model.listIndustry !== "all" && project.industry !== model.listIndustry) return false;
      if (!search) return true;
      return [project.name, project.organization, project.industry, project.companySize, project.templateName, project.owner].join(" ").toLowerCase().includes(search);
    });
    const owners = [...new Set(projects.map((detail) => text(detail.project.owner).trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, "zh-Hans-CN"));
    const industries = [...new Set(projects.map((detail) => text(detail.project.industry).trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, "zh-Hans-CN"));
    const viewCounts = { active: 0, review: 0, completed: 0, all: projects.length };
    projects.forEach((detail) => { const group = projectStatusGroup(detail.project.status); if (Object.prototype.hasOwnProperty.call(viewCounts, group)) viewCounts[group] += 1; });
    return `
      <section class="maturity-v1-page maturity-v1-list-page" aria-label="成熟度评估项目列表">
        <div class="maturity-v2-list-views" role="tablist" aria-label="项目状态视图">
          ${[["active", "进行中"], ["review", "待复核"], ["completed", "已完成"], ["all", "全部"]].map(([value, label]) => `<button class="${model.listStatus === value ? "is-active" : ""}" type="button" role="tab" aria-selected="${model.listStatus === value}" data-maturity-action="set-list-view" data-list-view="${value}">${label}<span>${viewCounts[value]}</span></button>`).join("")}
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
            <table class="maturity-v1-table maturity-v1-project-table">
              <thead><tr><th>项目 / 客户</th><th>状态 / 下一步</th><th>模板</th><th>当前 → 目标</th><th>评分完成度</th><th>待复核</th><th>负责人</th><th>最近更新</th><th>操作</th></tr></thead>
              <tbody>
                ${filtered.length ? filtered.map((detail) => {
                  const project = detail.project;
                  const summary = summaryOf(detail);
                  const route = `/workbench/maturity/${encodeURIComponent(project.id)}`;
                  const [primaryLabel, primaryTab] = projectPrimaryAction(project);
                  const completedItems = Math.max(0, Number(summary.applicableItemCount || 0) - Number(summary.notScoredCount || 0));
                  const totalItems = Number(summary.applicableItemCount || activeTemplateData(detail.template).scoreItems.length || 0);
                  const expanded = model.expandedProjectId === project.id;
                  return `<tr class="maturity-v2-project-row ${expanded ? "is-expanded" : ""}">
                    <td><button class="maturity-v1-project-name" type="button" data-maturity-action="toggle-project-preview" data-project-id="${escapeHtml(project.id)}" aria-expanded="${expanded}"><strong class="notranslate" translate="no" data-maturity-literal="project-name">${escapeHtml(project.name)}</strong><span><span class="maturity-v2-literal notranslate" translate="no" data-maturity-literal="organization">${escapeHtml(project.organization)}</span> · ${escapeHtml(project.industry || "行业未填写")} / ${escapeHtml(project.companySize || "规模未填写")}</span></button></td>
                    <td><span class="maturity-v1-status ${statusTone(project.status)}">${escapeHtml(PROJECT_STATUS_NAMES[project.status] || project.status)}</span><small>下一步：${escapeHtml(primaryLabel)}</small></td>
                    <td><strong>${escapeHtml(project.templateName || detail.template?.name || "未选择")}</strong><span class="maturity-v2-template-kind">${project.templateType === "custom" ? "自定义" : project.templateType === "base" ? "固定" : "待选择"}</span></td>
                    <td><span class="maturity-v1-level ${levelTone(summary.currentLevel)}">${escapeHtml(summary.currentLevel || "-")}</span><span>${summary.currentIndex == null ? "未计算" : `${summary.currentIndex} → ${summary.targetIndex ?? "-"} ${summary.targetLevel || ""}`}</span><small>${summary.targetAchievementRate == null ? "达成率未计算" : `达成率 ${Number(summary.targetAchievementRate).toFixed(0)}%`}</small></td>
                    <td><span class="maturity-v1-progress"><i style="width:${percent(summary.completionRate)}%"></i></span><b>${completedItems} / ${totalItems || "-"}</b></td>
                    <td>${Number(summary.reviewPendingCount || 0) ? `<strong>${Number(summary.reviewPendingCount)}</strong>` : `<span>0</span>`}</td>
                    <td><span class="maturity-v2-literal notranslate" translate="no" data-maturity-literal="project-owner">${escapeHtml(project.owner || "未填写")}</span></td>
                    <td title="${escapeHtml(project.updatedAt || "-")}">${escapeHtml(project.updatedAt || "-")}</td>
                    <td><button class="maturity-v1-button is-secondary maturity-v2-row-primary" type="button" ${project.status === "draft" ? `data-maturity-action="resume-draft" data-project-id="${escapeHtml(project.id)}"` : `data-maturity-action="open-project-tab" data-project-id="${escapeHtml(project.id)}" data-project-tab="${primaryTab}"`}>${escapeHtml(primaryLabel)}</button></td>
                  </tr>${expanded ? `<tr class="maturity-v2-project-preview"><td colspan="9"><div><dl><div><dt>项目负责人</dt><dd class="notranslate" translate="no" data-maturity-literal="project-owner">${escapeHtml(project.owner || "未填写")}</dd></div><div><dt>评估人员</dt><dd class="notranslate" translate="no" data-maturity-literal="assessors">${escapeHtml(list(project.assessors).join("、") || "未填写")}</dd></div><div><dt>计划时间</dt><dd>${escapeHtml(project.plannedStartDate || "未设置")} — ${escapeHtml(project.plannedEndDate || "未设置")}</dd></div><div><dt>知识快照</dt><dd class="notranslate" translate="no">${escapeHtml(project.knowledgeSnapshotId || "待绑定")}</dd></div><div><dt>算法版本</dt><dd class="notranslate" translate="no">${escapeHtml(project.algorithmVersion || "待计算")}</dd></div><div><dt>目标达成率</dt><dd>${summary.targetAchievementRate == null ? "未计算" : `${Number(summary.targetAchievementRate).toFixed(0)}%`}</dd></div><div><dt>不适用项</dt><dd>${Number(summary.notApplicableCount || 0)}</dd></div><div><dt>证据覆盖率</dt><dd>${Number(summary.evidenceCoverage || 0).toFixed(0)}%（辅助信息）</dd></div></dl><div class="maturity-v2-preview-actions"><button class="maturity-v1-button is-primary" type="button" ${project.status === "draft" ? `data-maturity-action="resume-draft" data-project-id="${escapeHtml(project.id)}"` : `data-maturity-action="open-project-tab" data-project-id="${escapeHtml(project.id)}" data-project-tab="${primaryTab}"`}>${escapeHtml(primaryLabel)}</button><button class="maturity-v1-button is-secondary" type="button" data-app-route="${escapeHtml(route)}">打开项目概览</button></div></div></td></tr>` : ""}`;
                }).join("") : `<tr><td colspan="9"><div class="maturity-v1-table-empty"><strong>${projects.length ? "当前筛选下没有评估项目" : "从企业组织项目开始"}</strong><span>${projects.length ? "调整筛选条件，或清空筛选后继续。" : "创建项目后选择固定或自定义模板，进入四维评分。"}</span><button class="maturity-v1-button is-primary" type="button" data-maturity-action="${projects.length ? "clear-list-filters" : "new-project"}">${projects.length ? "清空筛选" : "新建评估项目"}</button></div></td></tr>`}
              </tbody>
            </table>
          </section>
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
                <button class="${draft.templateType === "custom" ? "is-selected" : ""}" type="button" data-maturity-action="choose-template" data-template-type="custom" role="radio" aria-checked="${draft.templateType === "custom"}">
                  <div><strong>从固定模板复制为新自定义模板</strong><span class="maturity-v2-template-kind">需配置</span></div><span>创建后进入模板配置，可重组能力 L0 / L1 / L2、关注点、作用域和服务角色。</span><small>所有变化只保存在项目模板，不修改主工程字典。</small>
                </button>
              </div>
              ${error("templateType")}
            ` : ""}
            ${model.createStep === 3 ? `
              <div class="maturity-v1-confirm-grid">
                <section><div class="maturity-v2-confirm-heading"><strong>客户与项目</strong><button type="button" data-maturity-action="create-edit-step" data-step="1">修改</button></div><dl><div><dt>项目</dt><dd class="notranslate" translate="no" data-maturity-literal="project-name">${escapeHtml(draft.name)}</dd></div><div><dt>客户企业组织</dt><dd class="notranslate" translate="no" data-maturity-literal="organization">${escapeHtml(draft.organization)}</dd></div><div><dt>所属行业 / 规模</dt><dd>${escapeHtml(draft.industry)} / ${escapeHtml(draft.companySize)}</dd></div><div><dt>项目负责人</dt><dd class="notranslate" translate="no" data-maturity-literal="project-owner">${escapeHtml(draft.owner)}</dd></div><div><dt>评估对象</dt><dd>企业组织</dd></div></dl></section>
                <section><div class="maturity-v2-confirm-heading"><strong>评估模板</strong><button type="button" data-maturity-action="create-edit-step" data-step="2">修改</button></div><div class="maturity-v1-confirm-template"><span>模板</span><strong>${draft.templateType === "custom" ? "新自定义能力模板" : "当前知识库基础能力体系模板"}</strong><p>${draft.templateType === "custom" ? "创建后先进入模板配置，校验发布后开始评分。" : "固定模板结构只读；作用域和服务均来自字典真实映射。"}</p></div></section>
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
      ["review", "评分复核"],
      ["results", "评估结果"],
      ["report", "报告快照"],
    ];
    return `
      <section class="maturity-v1-page maturity-v1-project-page" aria-label="成熟度评估项目">
        <div class="maturity-v6-project-sticky-header" aria-label="当前项目与项目步骤">
          <div class="maturity-v5-project-context" aria-label="当前成熟度评估项目">
            <button class="maturity-v1-back" type="button" data-app-route="/workbench/maturity" aria-label="返回评估项目列表">‹</button>
            <div><strong class="notranslate" translate="no" data-maturity-literal="project-name">${escapeHtml(project.name)}</strong><span><span class="maturity-v2-literal notranslate" translate="no" data-maturity-literal="organization">${escapeHtml(project.organization)}</span> · ${escapeHtml(project.templateName || detail.template?.name || "模板待选择")} · 最近更新 ${escapeHtml(project.updatedAt || "-")}</span></div>
            <span class="maturity-v1-status ${statusTone(project.status)}">${escapeHtml(PROJECT_STATUS_NAMES[project.status] || project.status)}</span>
          </div>
          <nav class="maturity-v1-tabs" aria-label="成熟度评估项目步骤">
            ${tabs.map(([id, label]) => `<button class="${model.activeTab === id ? "is-active" : ""}" type="button" data-maturity-tab="${id}"><span>${escapeHtml(label)}</span>${id === "scoring" && summary.notScoredCount ? `<b>${summary.notScoredCount}</b>` : ""}</button>`).join("")}
          </nav>
        </div>
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
    return renderOverviewTab(detail);
  }

  function renderOverviewTab(detail) {
    const project = detail.project;
    const summary = summaryOf(detail);
    const workflow = [
      ["draft", "项目创建"],
      ["template_configuring", "模板配置"],
      ["scoring", "评分执行"],
      ["score_review", "评分复核"],
      ["completed", "评估完成"],
      ["reported", "报告快照"],
    ];
    const currentIndex = workflow.findIndex(([id]) => id === project.status);
    const currentStep = currentIndex < 0 ? 0 : currentIndex;
    return `
      <div class="maturity-v1-overview-grid">
        <section class="maturity-v1-section">
          <div class="maturity-v1-panel-heading"><div><span>项目状态</span><h3>评估业务流程</h3></div><strong>${Number(summary.completionRate || 0).toFixed(0)}% 已评分</strong></div>
          <ol class="maturity-v1-workflow">${workflow.map(([id, label], index) => `<li class="${index < currentStep ? "is-done" : index === currentStep ? "is-active" : ""}"><i>${index + 1}</i><span>${escapeHtml(label)}</span></li>`).join("")}</ol>
          <dl class="maturity-v1-project-facts">
            <div><dt>评估对象</dt><dd>企业组织</dd></div>
            <div><dt>客户所属行业</dt><dd>${escapeHtml(project.industry || "未填写")}</dd></div>
            <div><dt>企业规模</dt><dd>${escapeHtml(project.companySize || "未填写")}</dd></div>
            <div><dt>客户特点</dt><dd>${escapeHtml(project.customerCharacteristics || "未填写")}</dd></div>
            <div><dt>客户偏好与约束</dt><dd>${escapeHtml(project.constraints || "未填写")}</dd></div>
            <div><dt>项目负责人</dt><dd class="notranslate" translate="no" data-maturity-literal="project-owner">${escapeHtml(project.owner || "未填写")}</dd></div>
            <div><dt>评估模板</dt><dd>${escapeHtml(project.templateName || detail.template?.name)}</dd></div>
            <div><dt>评分算法</dt><dd>${escapeHtml(detail.result?.calculationRun?.algorithmVersion || project.algorithmVersion || "sapd-maturity-v2.1.0")}</dd></div>
          </dl>
        </section>
        <aside class="maturity-v1-section maturity-v1-current-result">
          <div class="maturity-v1-panel-heading"><div><span>当前结果</span><h3>${escapeHtml(summary.currentLevel || "未评分")}</h3></div><span class="maturity-v1-level ${levelTone(summary.currentLevel)}">${summary.currentIndex ?? "-"}</span></div>
          <div class="maturity-v1-result-metrics"><div><span>百分制</span><strong>${summary.currentPercent || 0}</strong></div><div><span>目标达成率</span><strong>${summary.targetAchievementRate == null ? "-" : `${Number(summary.targetAchievementRate).toFixed(0)}%`}</strong></div><div><span>证据覆盖</span><strong>${Number(summary.evidenceCoverage || 0).toFixed(0)}%</strong></div></div>
          ${renderCompactCategoryBars(detail.result?.categoryResults || [])}
          <button class="maturity-v1-button is-primary is-full" type="button" data-maturity-tab="scoring">继续评分</button>
        </aside>
      </div>
      <section class="maturity-v1-section maturity-v1-gap-preview">
        <div class="maturity-v1-panel-heading"><div><span>差距摘要</span><h3>优先处理的能力差距</h3></div><button class="maturity-v1-link-button" type="button" data-maturity-tab="results">查看全部结果</button></div>
        ${renderGapTable(detail.result?.gapItems || [], 5)}
      </section>
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
            <button class="maturity-v1-button is-secondary" type="button" data-maturity-action="export-score-exchange">导出评分文件</button>
            <button class="maturity-v1-button is-secondary" type="button" data-maturity-action="trigger-score-import">导入评分文件</button>
            <input type="file" accept="application/json,.json" hidden data-maturity-score-file />
            ${isCustom ? `<button class="maturity-v1-button is-secondary" type="button" data-maturity-action="export-template">导出模板结构</button><button class="maturity-v1-button is-secondary" type="button" data-maturity-action="trigger-template-import">导入模板结构</button><input type="file" accept="application/json,.json" hidden data-maturity-template-file /><button class="maturity-v1-button is-primary" type="button" data-maturity-action="validate-template">校验并发布</button>` : `<span class="maturity-v2-readonly-badge">结构与权重只读</span>`}
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
      entry = { scoreItemId: itemId, isApplicable: true, elements: {}, reviewElements: {}, targetLevel: "", targetReason: "", targetConfirmed: false, evidenceLevel: "E0", evidenceSummary: "", note: "", naReason: "", status: "not_scored" };
      detail.scoreEntries.push(entry);
    }
    return entry;
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
    if (entry?.isApplicable === false) return Boolean(text(entry.naReason).trim());
    return hasCompleteElements(entry?.elements) && LEVELS.includes(entry?.targetLevel) && Boolean(text(entry?.targetReason).trim());
  }

  function entryIsStarted(entry) {
    if (!entry) return false;
    if (entry.isApplicable === false) return true;
    return DIMENSIONS.some(([key]) => LEVELS.includes(entry.elements?.[key]) || LEVELS.includes(entry.reviewElements?.[key]) || Boolean(text(entry.dimensionNotes?.[key]).trim()))
      || LEVELS.includes(entry.targetLevel)
      || Boolean(text(entry.targetReason).trim())
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
    if (entry?.isApplicable === false) return text(entry.naReason).trim() ? "不适用" : "不适用待说明";
    if (entry?.status === "confirmed") return "已确认";
    const dimensionCount = DIMENSIONS.filter(([key]) => LEVELS.includes(entry?.elements?.[key])).length;
    if (!dimensionCount && !LEVELS.includes(entry?.targetLevel)) return "未评分";
    if (dimensionCount < DIMENSIONS.length) return `填写中 ${dimensionCount}/4`;
    if (!LEVELS.includes(entry?.targetLevel)) return "待设置目标";
    if (!text(entry?.targetReason).trim()) return "待补目标理由";
    return "已评分";
  }

  function scoreItemResult(detail, itemId) {
    return list(detail?.result?.scoreItemResults).find((item) => item.id === itemId) || null;
  }

  function hierarchyExpansion(detail) {
    const projectId = detail?.project?.id || "default";
    if (!(model.hierarchyExpansionByProject[projectId] instanceof Set)) model.hierarchyExpansionByProject[projectId] = new Set();
    return model.hierarchyExpansionByProject[projectId];
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
      if (model.scoringStatus === "review" && entry.status !== "scored") return false;
      if (model.scoringStatus === "confirmed" && entry.status !== "confirmed") return false;
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
          <label><span>状态</span><select data-maturity-score-filter="status"><option value="all">全部状态</option><option value="unscored"${model.scoringStatus === "unscored" ? " selected" : ""}>未评分</option><option value="review"${model.scoringStatus === "review" ? " selected" : ""}>待复核</option><option value="confirmed"${model.scoringStatus === "confirmed" ? " selected" : ""}>已确认</option><option value="na"${model.scoringStatus === "na" ? " selected" : ""}>不适用</option></select></label>
          <label><span>证据（辅助）</span><select data-maturity-score-filter="evidence"><option value="all">全部</option><option value="missing"${model.scoringEvidence === "missing" ? " selected" : ""}>无证据</option></select></label>
          <div class="maturity-v1-toolbar"><button class="maturity-v1-button is-secondary" type="button" data-maturity-action="export-score-exchange">导出评分表</button><button class="maturity-v1-button is-secondary" type="button" data-maturity-action="trigger-score-import">导入评分数据</button><input type="file" accept="application/json,.json" hidden data-maturity-score-file /></div>
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
    model.selectedCapabilityId = capability?.id || "";
    model.selectedFocusId = focus?.id || "";
    model.selectedScoreItemId = scoreItem?.id || "";
    detail.scoringLocation = {
      capabilityId: model.selectedCapabilityId,
      focusId: model.selectedFocusId,
      scoreItemId: model.selectedScoreItemId,
    };
    const projectId = detail.project?.id || "default";
    if (!model.directoryInitializedByProject[projectId] && capability) {
      expandHierarchyPathToCapability(detail, capability.id);
      if (focus) hierarchyExpansion(detail).add(hierarchyKey("FOCUS", focus.id));
      model.directoryInitializedByProject[projectId] = true;
    }
    return { active, categories, categoryById, capabilities, capability, l1, l0, focuses, focus, scoreItems, scoreItem };
  }

  function setScoringCapability(detail, capabilityId) {
    const active = activeTemplateData(detail.template);
    const capability = active.capabilities.find((item) => item.id === capabilityId) || active.capabilities[0];
    const focus = byTemplateOrder(active.focuses.filter((item) => item.capabilityId === capability?.id))[0];
    const scoreItem = byTemplateOrder(active.scoreItems.filter((item) => item.focusId === focus?.id))[0];
    model.selectedCapabilityId = capability?.id || "";
    model.selectedFocusId = focus?.id || "";
    model.selectedScoreItemId = scoreItem?.id || "";
    expandHierarchyPathToCapability(detail, model.selectedCapabilityId);
    if (model.selectedFocusId) hierarchyExpansion(detail).add(hierarchyKey("FOCUS", model.selectedFocusId));
    detail.scoringLocation = { capabilityId: model.selectedCapabilityId, focusId: model.selectedFocusId, scoreItemId: model.selectedScoreItemId };
    persistDetail(detail);
  }

  function setScoringFocus(detail, focusId) {
    const active = activeTemplateData(detail.template);
    const focus = active.focuses.find((item) => item.id === focusId);
    if (!focus) return;
    const scoreItem = byTemplateOrder(active.scoreItems.filter((item) => item.focusId === focus.id))[0];
    model.selectedCapabilityId = focus.capabilityId;
    model.selectedFocusId = focus.id;
    model.selectedScoreItemId = scoreItem?.id || "";
    expandHierarchyPathToCapability(detail, focus.capabilityId);
    hierarchyExpansion(detail).add(hierarchyKey("FOCUS", focus.id));
    detail.scoringLocation = { capabilityId: focus.capabilityId, focusId: focus.id, scoreItemId: model.selectedScoreItemId };
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
    expandHierarchyPathToCapability(detail, focus.capabilityId);
    hierarchyExpansion(detail).add(hierarchyKey("FOCUS", focus.id));
    detail.scoringLocation = { capabilityId: focus.capabilityId, focusId: focus.id, scoreItemId: scoreItem.id };
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

  function renderL2Summary(capability, result, stale) {
    const currentLevel = LEVELS.includes(result?.currentLevel) ? result.currentLevel : "未评分";
    const targetLevel = LEVELS.includes(result?.targetLevel) ? result.targetLevel : "未设置";
    return `<section class="maturity-v3-l2-summary ${stale ? "is-stale" : ""}" aria-label="当前能力 L2 汇总">
      <div class="maturity-v3-l2-identity"><span>当前 L2 · 下级汇总</span><h3>${escapeHtml(capability.code || "自定义 L2")} ${escapeHtml(capability.name)}</h3></div>
      <dl><div><dt>当前成熟度</dt><dd>${result?.currentIndex == null ? "-" : escapeHtml(Number(result.currentIndex).toFixed(2))}<small>${escapeHtml(currentLevel)}</small></dd></div><div><dt>目标成熟度</dt><dd>${result?.targetIndex == null ? "-" : escapeHtml(Number(result.targetIndex).toFixed(2))}<small>${escapeHtml(targetLevel)}</small></dd></div><div><dt>差距</dt><dd>${result?.gapIndex == null ? "-" : escapeHtml(Number(result.gapIndex).toFixed(2))}</dd></div><div><dt>完成度</dt><dd>${Number(result?.completionRate || 0).toFixed(0)}%</dd></div></dl>
      <div class="maturity-v3-dimension-summary"><span>四维平均</span>${renderDimensionSummary(result)}</div>
    </section>`;
  }

  function renderScoreDirectoryRow({ level, item, state, expanded = false, hasChildren = false, active = false, action, dataName }) {
    const label = `${item.code || `自定义 ${level}`} ${item.name || "未命名"}`.trim();
    return `<div class="maturity-v4-directory-row is-${escapeHtml(level.toLowerCase())} ${active ? "is-active" : ""}">
      ${hasChildren ? `<button class="maturity-v4-directory-toggle" type="button" data-maturity-action="toggle-score-hierarchy" data-hierarchy-level="${escapeHtml(level)}" data-hierarchy-id="${escapeHtml(item.id)}" aria-expanded="${expanded}" aria-label="${expanded ? "收起" : "展开"}${escapeHtml(label)}">${expanded ? "⌄" : "›"}</button>` : `<span class="maturity-v4-directory-spacer"></span>`}
      <button class="maturity-v4-directory-node" type="button" data-maturity-action="${escapeHtml(action)}" ${dataName}="${escapeHtml(item.id)}" aria-pressed="${active}">
        ${renderScoreProgressState(state, { iconOnly: true })}
        <span class="maturity-v4-directory-level">${escapeHtml(level)}</span>
        <span class="maturity-v4-directory-label"><b>${escapeHtml(item.code || `自定义 ${level}`)}</b><em>${escapeHtml(item.name || "未命名")}</em></span>
        <small>${escapeHtml(state.count)}</small>
      </button>
    </div>`;
  }

  function renderScoreDirectory(detail, selection, serviceById) {
    const { active, categories, capabilities, capability, l1, l0, focus } = selection;
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
      .map((focusRow) => renderScoreDirectoryRow({ level: "FOCUS", item: focusRow, state: scoreProgressState(detail, itemsForFocus(focusRow.id)), active: focusRow.id === focus?.id, action: "select-focus", dataName: "data-focus-id" }))
      .join("");
    const renderCapabilityRows = (l1Row) => capabilitiesForCategory(l1Row.id)
      .filter((capabilityRow) => hasVisibleItems(itemsForCapability(capabilityRow.id)))
      .map((capabilityRow) => {
        const open = rowOpen("L2", capabilityRow.id);
        return `${renderScoreDirectoryRow({ level: "L2", item: capabilityRow, state: scoreProgressState(detail, itemsForCapability(capabilityRow.id)), expanded: open, hasChildren: true, active: capabilityRow.id === capability?.id, action: "select-capability", dataName: "data-capability-id" })}${open ? `<div class="maturity-v4-directory-children">${renderFocusRows(capabilityRow)}</div>` : ""}`;
      }).join("");
    const renderL1Rows = (l0Row) => childL1(l0Row.id)
      .filter((l1Row) => hasVisibleItems(itemsForL1(l1Row.id)))
      .map((l1Row) => {
        const open = rowOpen("L1", l1Row.id);
        const activeL1 = l1Row.id === l1?.id;
        return `${renderScoreDirectoryRow({ level: "L1", item: l1Row, state: scoreProgressState(detail, itemsForL1(l1Row.id)), expanded: open, hasChildren: true, active: activeL1, action: "select-score-l1", dataName: "data-category-id" })}${open ? `<div class="maturity-v4-directory-children">${renderCapabilityRows(l1Row)}</div>` : ""}`;
      }).join("");
    const l0Rows = byTemplateOrder(categories.filter((item) => categoryCapabilityLevel(item) === "L0"))
      .filter((l0Row) => hasVisibleItems(itemsForL0(l0Row.id)))
      .map((l0Row) => {
        const open = rowOpen("L0", l0Row.id);
        return `${renderScoreDirectoryRow({ level: "L0", item: l0Row, state: scoreProgressState(detail, itemsForL0(l0Row.id)), expanded: open, hasChildren: true, active: l0Row.id === l0?.id, action: "select-score-l0", dataName: "data-category-id" })}${open ? `<div class="maturity-v4-directory-children">${renderL1Rows(l0Row)}</div>` : ""}`;
      }).join("");
    const orphanL1Rows = byTemplateOrder(categories.filter((item) => categoryCapabilityLevel(item) === "L1" && !categoryById.has(item.parentId)))
      .filter((item) => hasVisibleItems(itemsForL1(item.id)))
      .map((item) => {
        const open = rowOpen("L1", item.id);
        return `${renderScoreDirectoryRow({ level: "L1", item, state: scoreProgressState(detail, itemsForL1(item.id)), expanded: open, hasChildren: true, active: item.id === l1?.id, action: "select-score-l1", dataName: "data-category-id" })}${open ? `<div class="maturity-v4-directory-children">${renderCapabilityRows(item)}</div>` : ""}`;
      }).join("");
    return `<aside class="maturity-v4-score-directory" aria-label="成熟度评分能力目录">
      <header><div><strong>评分目录</strong><span>安全能力映射结构</span></div><small>${capabilities.length} 个 L2 能力</small></header>
      <div class="maturity-v4-score-legend" aria-label="评分状态图例">${renderScoreProgressState({ key: "complete", label: "已完成", count: "" }, { compact: true })}${renderScoreProgressState({ key: "in-progress", label: "进行中", count: "" }, { compact: true })}${renderScoreProgressState({ key: "not-started", label: "未开始", count: "" }, { compact: true })}</div>
      <div class="maturity-v4-directory-tree">${l0Rows}${orphanL1Rows}${l0Rows || orphanL1Rows ? "" : `<div class="maturity-v1-table-empty"><strong>没有符合条件的目录节点</strong><button class="maturity-v1-button is-secondary" type="button" data-maturity-action="clear-score-filters">清空筛选</button></div>`}</div>
    </aside>`;
  }

  function scoreItemMatchesFilters(detail, item, focus, capability, service) {
    const entry = scoreEntry(detail, item.id);
    const search = text(model.scoringSearch).trim().toLowerCase();
    if (search && ![focus.code, focus.name, capability.code, capability.name, service?.code, service?.name, item.scopeCode, item.scopeName].join(" ").toLowerCase().includes(search)) return false;
    if (model.scoringStatus === "unscored" && entryIsComplete(entry)) return false;
    if (model.scoringStatus === "review" && entry.status !== "scored") return false;
    if (model.scoringStatus === "confirmed" && entry.status !== "confirmed") return false;
    if (model.scoringStatus === "na" && entry.isApplicable !== false) return false;
    if (model.scoringEvidence === "missing" && entry.isApplicable !== false && entry.evidenceLevel && entry.evidenceLevel !== "E0") return false;
    return true;
  }

  function renderScoringTab(detail) {
    const selection = scoringSelection(detail);
    const { active, capabilities, capability, focus, scoreItems, scoreItem } = selection;
    if (!capability) return `<div class="maturity-v1-empty">当前模板没有可评分能力。</div>`;
    const serviceById = new Map(list(detail.template.services).map((item) => [item.id, item]));
    const capabilityResult = list(detail.result?.capabilityResults).find((item) => item.id === capability.id);
    const summary = summaryOf(detail);
    const stale = Boolean(detail.resultStale || model.calculating);
    const currentFocusItems = scoreItems;
    const sourceMode = focus?.itemType === "SERVICE" ? "CHILD_ROLLUP" : "DIRECT";
    const focusBatch = focusBatchState(detail, currentFocusItems);
    const focusState = scoreProgressState(detail, currentFocusItems);
    const focusEntries = currentFocusItems.map((item) => scoreEntry(detail, item.id));
    const focusApplicableCount = focusEntries.filter((entry) => entry.isApplicable !== false).length;
    const focusNotApplicableCount = focusEntries.length - focusApplicableCount;
    const focusCompletedCount = currentFocusItems.filter((item) => scoreProgressState(detail, [item]).key === "complete").length;
    const focusAllNotApplicable = Boolean(focusEntries.length && focusEntries.every((entry) => entry.isApplicable === false));
    const focusPartiallyApplicable = Boolean(!focusAllNotApplicable && focusEntries.some((entry) => entry.isApplicable === false));
    const focusNaReason = focusAllNotApplicable ? text(focusEntries.find((entry) => text(entry.naReason).trim())?.naReason).trim() : "";
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
      <details class="maturity-v3-scoring-tools">
        <summary class="maturity-v1-button is-secondary">更多</summary>
        <div class="maturity-v3-scoring-toolbar">
          <header><div><strong>${escapeHtml(detail.project.name)}</strong><span>${escapeHtml(detail.project.organization)} · ${escapeHtml(detail.project.owner || "负责人未填写")}</span></div><button class="maturity-v1-link-button" type="button" data-app-route="/workbench/maturity">返回项目列表</button></header>
        <div><strong>${summary.scoredItemCount || 0} / ${summary.applicableItemCount || active.scoreItems.length}</strong><span>个适用评估点 · ${Number(summary.completionRate || 0).toFixed(0)}% 已完成 · ${detail.localSaveState === "error" ? "保存失败" : model.calculating ? "已保存，正在试算" : stale ? "已保存，等待汇总" : "已自动保存"}</span></div>
        <label><span>跳转到能力 L2</span><select data-maturity-capability-jump><option value="">选择能力</option>${capabilities.map((item) => `<option value="${escapeHtml(item.id)}"${item.id === capability.id ? " selected" : ""}>${escapeHtml(item.code || "自定义")} ${escapeHtml(item.name)}</option>`).join("")}</select></label>
        <label class="maturity-v3-score-search"><span>搜索当前 L2</span><input type="search" value="${escapeHtml(model.scoringSearch)}" placeholder="关注点、服务或作用域" autocomplete="off" data-maturity-score-search /></label>
        <label><span>状态</span><select data-maturity-score-filter="status"><option value="all">全部状态</option><option value="unscored"${model.scoringStatus === "unscored" ? " selected" : ""}>未评分</option><option value="review"${model.scoringStatus === "review" ? " selected" : ""}>待复核</option><option value="confirmed"${model.scoringStatus === "confirmed" ? " selected" : ""}>已确认</option><option value="na"${model.scoringStatus === "na" ? " selected" : ""}>不适用</option></select></label>
        <label><span>证据（辅助）</span><select data-maturity-score-filter="evidence"><option value="all">全部</option><option value="missing"${model.scoringEvidence === "missing" ? " selected" : ""}>无证据</option></select></label>
        <div class="maturity-v1-toolbar"><button class="maturity-v1-button is-secondary" type="button" data-maturity-action="export-score-exchange">导出评分表</button><button class="maturity-v1-button is-secondary" type="button" data-maturity-action="trigger-score-import">导入评分数据</button><input type="file" accept="application/json,.json" hidden data-maturity-score-file /></div>
        </div>
      </details>
      <div class="maturity-v4-scoring-shell">
        ${renderScoreDirectory(detail, selection, serviceById)}
        <main class="maturity-v4-score-workbench" aria-label="当前评分工作台">
          ${renderL2Summary(capability, capabilityResult, stale)}
          <section class="maturity-v4-focus-context" aria-label="当前关注点摘要">
            <div><span>当前关注点</span><h3>${escapeHtml(focus?.code || "-")} ${escapeHtml(focus?.name || "请选择关注点")}</h3><p>${escapeHtml(focus?.description || "暂无关注点定义")}</p></div>
            <div class="maturity-v5-focus-status-panel">
              <div class="maturity-v5-focus-status-head">${renderScoreProgressState(focusState, { compact: true })}<label class="maturity-v4-focus-applicability"><input type="checkbox" data-focus-applicability-toggle data-focus-id="${escapeHtml(focus?.id || "")}" ${focusAllNotApplicable ? "" : "checked"} ${detail.project.readOnly ? "disabled" : ""} /><span>关注点适用</span><strong>${focusAllNotApplicable ? "不适用" : focusPartiallyApplicable ? "部分适用" : "适用"}</strong></label></div>
              <dl class="maturity-v5-focus-stats"><div><dt>完成</dt><dd>${focusCompletedCount} / ${focusApplicableCount}</dd></div><div><dt>适用</dt><dd>${focusApplicableCount}</dd></div><div><dt>不适用</dt><dd>${focusNotApplicableCount}</dd></div></dl>
              <div class="maturity-v5-focus-batch-state">${sourceMode === "CHILD_ROLLUP" ? focusBatch.allowed ? `<button class="maturity-v1-link-button" type="button" data-maturity-action="toggle-focus-batch" title="${escapeHtml(focusBatch.reason)}">统一设置下级</button>` : `<span title="${escapeHtml(focusBatch.reason)}"><i aria-hidden="true"></i>已有下级评分</span>` : `<span>关注点直接评估</span>`}</div>
            </div>
          </section>
          ${focusAllNotApplicable ? `<label class="maturity-v4-focus-na-reason"><span>关注点不适用原因 *</span><textarea rows="2" data-focus-na-reason data-focus-id="${escapeHtml(focus?.id || "")}" ${detail.project.readOnly ? "disabled" : ""} placeholder="说明该关注点不适用于本次评估的原因">${escapeHtml(focusNaReason)}</textarea><small>该关注点下所有安全技术服务均从评分、聚合和完成率分母中剔除。</small></label>` : ""}
          ${model.focusBatchOpen && sourceMode === "CHILD_ROLLUP" && focusBatch.allowed ? renderFocusBatchControls(detail, focus, currentFocusItems) : ""}
          <div class="maturity-v4-service-tab-strip"><nav class="maintenance-section-tabs maturity-v4-service-tabs" role="tablist" aria-label="当前关注点安全技术服务" style="--maturity-service-tab-columns:${Math.min(Math.max(currentFocusItems.length, 1), 3)}">${serviceTabs || `<span>当前关注点没有可评分服务。</span>`}</nav></div>
          <article class="maturity-v3-score-form" data-score-item-id="${escapeHtml(scoreItem?.id || "")}">${renderScoreInspector(detail, scoreItem, focus)}</article>
        </main>
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
      <td>${item.itemType === "SERVICE" ? `<span class="maturity-v1-scope" data-scope="${escapeHtml(item.scopeCode || "ALL")}">${escapeHtml(item.scopeCode || "ALL")}</span><small>${escapeHtml(item.scopeName || "全部作用域")}</small>` : `<span class="maturity-v1-row-status is-muted">FOCUS</span><small>关注点整体</small>`}</td>
      <td><label class="maturity-v3-applicability-check"><input type="checkbox" data-score-applicability data-score-item-id="${escapeHtml(item.id)}" ${applicable ? "checked" : ""} ${detail.project.readOnly ? "disabled" : ""} aria-label="${escapeHtml(rowLabel)}是否适用" /><span>适用</span></label></td>
      ${DIMENSIONS.map(([key, label]) => `<td><select class="maturity-v2-dimension-select" data-score-dimension="${key}" data-score-item-id="${escapeHtml(item.id)}" ${!applicable || detail.project.readOnly ? "disabled" : ""} aria-label="${escapeHtml(rowLabel)}${escapeHtml(label)}评分">${levelOptions(elementValues[key], { includeEmpty: true, compact: true })}</select></td>`).join("")}
      <td><span class="maturity-v1-level ${levelTone(currentLevel)}">${escapeHtml(applicable ? currentLevel || "未计算" : "不计分")}</span><small>${!applicable ? "已退出计算" : pointResult?.currentIndex == null ? "四维完成后计算" : `${pointResult.currentIndex} / ${pointResult.currentPercent}`}</small></td>
      <td><select data-score-field="targetLevel" data-score-item-id="${escapeHtml(item.id)}" ${!applicable || detail.project.readOnly ? "disabled" : ""} aria-label="${escapeHtml(rowLabel)}目标等级">${levelOptions(entry.targetLevel, { includeEmpty: true, compact: true })}</select><small>${!applicable ? "无需设置" : pointResult?.targetAchievementRate == null ? "待计算达成率" : `达成 ${Number(pointResult.targetAchievementRate).toFixed(0)}%`}</small></td>
      <td><span class="maturity-v1-row-status ${status.includes("待") || status.includes("填写中") ? "is-warn" : status === "未评分" || !applicable ? "is-muted" : "is-good"}">${status}</span><small>${entry.lastUpdateScope === "FOCUS_BATCH" ? "关注点带入" : entry.lastUpdateScope === "ITEM" ? "单项调整" : detail.lastSavedAt ? "已保存" : ""}</small></td>
    </tr>${selected ? `<tr class="maturity-v2-inline-score-row"><td colspan="10"><div class="maturity-v1-score-inspector">${renderScoreInspector(detail, item, focus)}</div></td></tr>` : ""}`;
  }

  function renderFocusBatchControls(detail, focus, items) {
    if (!focus) return "";
    return `<section class="maturity-v3-focus-batch" aria-label="统一设置当前关注点下级评估点"><div><strong>统一设置关注点初始等级</strong><span>仅在全部下级尚未评分时可用；所选等级会同时带入每个下级安全技术服务的四个维度。</span></div><div class="maturity-v3-focus-batch-levels" role="group" aria-label="关注点统一初始等级">${LEVELS.map((level, index) => `<button type="button" data-maturity-action="set-focus-batch-level" data-focus-id="${escapeHtml(focus.id)}" data-level="${level}">${index + 1}</button>`).join("")}</div><small>将初始化 ${items.length} 个下级评估点，之后请逐项核对。</small></section>`;
  }

  function focusBatchState(detail, items) {
    const serviceItems = list(items).filter((item) => item.itemType === "SERVICE");
    const hasAnyScore = serviceItems.some((item) => {
      const entry = scoreEntry(detail, item.id);
      return DIMENSIONS.some(([key]) => LEVELS.includes(entry.elements?.[key]) || LEVELS.includes(entry.reviewElements?.[key]));
    });
    if (!serviceItems.length) return { allowed: false, reason: "当前关注点没有下级安全技术服务。" };
    if (detail.project.readOnly) return { allowed: false, reason: "当前项目已锁定。" };
    if (hasAnyScore) return { allowed: false, reason: "下级已有评分，请逐项调整，不能再统一覆盖。" };
    return { allowed: true, reason: "下级均未评分，可以统一设置一个初始等级。" };
  }

  function renderScoreInspector(detail, item, focus) {
    if (!item || !focus) return `<div class="maturity-v1-table-empty">选择一个评估点查看四维评分、目标和证据。</div>`;
    const entry = scoreEntry(detail, item.id);
    const applicable = entry.isApplicable !== false;
    const service = list(detail.template.services).find((candidate) => candidate.id === item.serviceId);
    const pointResult = scoreItemResult(detail, item.id);
    const currentLevel = LEVELS.includes(pointResult?.currentLevel) ? pointResult.currentLevel : "";
    const isReview = detail.project.status === "score_review";
    const serviceById = new Map(list(detail.template.services).map((candidate) => [candidate.id, candidate]));
    const platformReferences = list(detail.template.focusServiceMappings)
      .filter((mapping) => mapping.focusId === focus.id && mapping.serviceRole === "PLATFORM_EVIDENCE_REFERENCE")
      .map((mapping) => ({ mapping, service: serviceById.get(mapping.serviceId) || {} }));
    return `<div class="maturity-v3-score-form-inner ${applicable ? "" : "is-not-applicable"}">
      ${platformReferences.length ? `<details class="maturity-v2-platform-references"><summary>平台与工具评估参考（不单独计分）</summary>${platformReferences.map(({ mapping, service: reference }) => `<div><strong>${escapeHtml(reference.code || "")} ${escapeHtml(reference.name || "安全技术服务")}</strong><small>${escapeHtml(mapping.scopeCode || "")}${mapping.scopeName ? ` · ${escapeHtml(mapping.scopeName)}` : ""}</small></div>`).join("")}</details>` : ""}
      ${renderElementControls(detail, item, entry, "self")}
      ${applicable ? "" : `<label class="maturity-v3-na-reason"><span>不适用原因 *</span><textarea rows="3" data-score-text="naReason" data-score-item-id="${escapeHtml(item.id)}" ${detail.project.readOnly ? "disabled" : ""} placeholder="说明该服务或关注点不适用于本次企业组织评估的原因">${escapeHtml(entry.naReason || "")}</textarea></label>`}
      ${isReview && applicable ? `<div class="maturity-v2-review-divider"><span>复核人员逐维确认</span></div>${renderElementControls(detail, item, entry, "review")}` : ""}
      <section class="maturity-v3-score-outcome"><div><span>当前指数</span><strong>${pointResult?.currentIndex == null ? "-" : escapeHtml(Number(pointResult.currentIndex).toFixed(2))}</strong><small>成熟度 ${escapeHtml(currentLevel || "未评分")}</small></div><label><span>目标等级 *</span><select data-score-field="targetLevel" data-score-item-id="${escapeHtml(item.id)}" ${detail.project.readOnly || !applicable ? "disabled" : ""}>${levelOptions(entry.targetLevel, { includeEmpty: true })}</select></label><label><span>目标理由 *</span><textarea rows="2" data-score-text="targetReason" data-score-item-id="${escapeHtml(item.id)}" ${detail.project.readOnly || !applicable ? "disabled" : ""} placeholder="请输入目标理由">${escapeHtml(entry.targetReason || "")}</textarea></label><label><span>评估证据说明（可选）</span><textarea rows="2" data-score-text="evidenceSummary" data-score-item-id="${escapeHtml(item.id)}" ${detail.project.readOnly ? "disabled" : ""} placeholder="说明访谈、制度、配置、日志、报告或运行事实">${escapeHtml(entry.evidenceSummary || "")}</textarea></label></section>
      <details class="maturity-v3-secondary-fields"><summary>证据等级与评分备注</summary><div><label><span>证据等级（可选）</span><select data-score-field="evidenceLevel" data-score-item-id="${escapeHtml(item.id)}" ${detail.project.readOnly || !applicable ? "disabled" : ""}>${evidenceOptions(entry.evidenceLevel || "E0")}</select></label><label><span>评分备注</span><textarea rows="2" data-score-text="note" data-score-item-id="${escapeHtml(item.id)}" ${detail.project.readOnly ? "disabled" : ""}>${escapeHtml(entry.note || "")}</textarea></label><div class="maturity-v2-target-rate"><span>目标达成率</span><strong>${pointResult?.targetAchievementRate == null ? "待计算" : `${Number(pointResult.targetAchievementRate).toFixed(1)}%`}</strong><small>当前指数 ÷ 目标指数，上限 100%</small></div></div></details>
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

  function renderRubric(item, dimension, activeLevel) {
    const rows = rubricRows(item, dimension);
    const selected = rows.find((entry) => entry.level === activeLevel);
    if (!selected) return "";
    return `<span class="maturity-v6-score-definition" data-rubric-level="${escapeHtml(selected.level)}" aria-live="polite"><strong>${escapeHtml(selected.level)} ${escapeHtml(selected.levelName || LEVEL_NAMES[selected.level])}</strong><span>${escapeHtml(selected.criteria)}</span></span>`;
  }

  function renderRubricMissing(item, dimension) {
    if (rubricRows(item, dimension).length === LEVELS.length) return "";
    return `<div class="maturity-v3-rubric-missing" role="alert"><strong>评分标准缺失</strong><span>当前评估点缺少该维度完整 L1—L5 标准，已阻止评分。</span></div>`;
  }

  function renderElementControls(detail, item, entry, mode = "self") {
    const elements = mode === "review" ? entry.reviewElements || {} : entry.elements || {};
    const action = mode === "review" ? "set-review-element-level" : "set-element-level";
    const completeRubric = rubricIsComplete(item);
    return `<div class="maturity-v3-dimension-grid ${mode === "review" ? "is-review" : ""}"><header><strong>打分维度</strong><span>评分（1—5，选中格展开定义）</span><span>${mode === "review" ? "复核说明" : "评分依据（可选）"}</span></header>${DIMENSIONS.map(([key, label]) => {
      const activeIndex = LEVELS.indexOf(elements[key]);
      const groupState = activeIndex >= 0 ? `has-active is-level-${activeIndex + 1}` : "";
      const buttons = LEVELS.map((level, index) => {
        const activeLevel = elements[key] === level;
        const rubric = rubricRows(item, key).find((candidate) => candidate.level === level);
        const definition = activeLevel ? renderRubric(item, key, level) : "";
        const accessibleLabel = `${label}${mode === "review" ? "复核" : "自评"}${level} ${rubric?.levelName || LEVEL_NAMES[level]}${rubric?.criteria ? `：${rubric.criteria}` : ""}`;
        return `<button class="${activeLevel ? "is-active" : ""}" type="button" data-maturity-action="${action}" data-score-item-id="${escapeHtml(item.id)}" data-element="${key}" data-level="${level}" aria-pressed="${activeLevel}" aria-label="${escapeHtml(accessibleLabel)}" title="${escapeHtml(`${level} ${rubric?.levelName || LEVEL_NAMES[level]}`)}" ${detail.project.readOnly || entry.isApplicable === false || !completeRubric ? "disabled" : ""}><span class="maturity-v6-score-number">${index + 1}</span>${definition}</button>`;
      }).join("");
      const evidence = mode === "self" ? `<input type="text" value="${escapeHtml(entry.dimensionNotes?.[key] || "")}" placeholder="请输入${escapeHtml(label)}评分依据（可选）" data-score-dimension-note="${key}" data-score-item-id="${escapeHtml(item.id)}" ${detail.project.readOnly || entry.isApplicable === false || !completeRubric ? "disabled" : ""} />` : `<span class="maturity-v3-review-value">自评 ${escapeHtml(entry.elements?.[key] || "未设置")} → 复核 ${escapeHtml(elements[key] || "沿用自评")}</span>`;
      return `<section><strong>${escapeHtml(label)}</strong><div class="maturity-v3-level-buttons ${groupState}" role="group" aria-label="${escapeHtml(label)}${mode === "review" ? "复核" : "自评"}等级">${buttons}</div>${evidence}${renderRubricMissing(item, key)}</section>`;
    }).join("")}</div>`;
  }

  function renderReviewTab(detail) {
    const template = detail.template;
    const itemById = new Map(list(template.scoreItems).map((item) => [item.id, item]));
    const focusById = new Map(list(template.focuses).map((item) => [item.id, item]));
    const serviceById = new Map(list(template.services).map((item) => [item.id, item]));
    const rows = list(detail.scoreEntries).map((entry) => {
      const item = itemById.get(entry.scoreItemId) || {};
      const focus = focusById.get(item.focusId) || {};
      const service = serviceById.get(item.serviceId) || {};
      const scored = entryIsComplete(entry);
      const pointResult = scoreItemResult(detail, item.id);
      return { entry, item, focus, service, scored, pointResult };
    });
    const unscored = rows.filter((row) => !row.scored);
    const pendingReview = rows.filter((row) => row.scored && row.entry.isApplicable !== false && row.entry.status !== "confirmed");
    const noEvidence = rows.filter((row) => row.scored && row.entry.isApplicable !== false && (!row.entry.evidenceLevel || row.entry.evidenceLevel === "E0"));
    const notApplicable = rows.filter((row) => row.entry.isApplicable === false);
    const queue = [...new Map([...unscored, ...pendingReview, ...noEvidence, ...notApplicable].map((row) => [row.item.id, row])).values()];
    const summary = summaryOf(detail);
    return `
      <div class="maturity-v1-review-layout">
        <section class="maturity-v1-section">
          <div class="maturity-v1-panel-heading"><div><span>提交条件</span><h3>评分完整性检查</h3></div><span>${Number(summary.completionRate || 0).toFixed(0)}% 完成</span></div>
          <div class="maturity-v1-review-summary"><button class="${unscored.length ? "is-warn" : "is-good"}" type="button" data-maturity-review-filter="unscored"><span>阻塞项</span><strong>${unscored.length}</strong></button><button class="${pendingReview.length ? "is-review" : "is-good"}" type="button" data-maturity-review-filter="pending"><span>待复核</span><strong>${pendingReview.length}</strong></button><button class="is-muted" type="button" data-maturity-review-filter="evidence"><span>无证据（信息）</span><strong>${noEvidence.length}</strong></button><button class="is-good" type="button"><span>已确认</span><strong>${summary.confirmedCount || 0}</strong></button></div>
          <div class="maturity-v1-review-actions">
            <button class="maturity-v1-button is-secondary" type="button" data-maturity-action="submit-review" ${unscored.length || detail.project.readOnly ? "disabled" : ""}>提交评分复核</button>
            <button class="maturity-v1-button is-primary" type="button" data-maturity-action="confirm-review" ${unscored.length || detail.project.readOnly ? "disabled" : ""}>确认全部已评分项</button>
          </div>
          ${detail.project.readOnly ? `<div class="maturity-v1-validation is-valid"><strong>正式报告项目已锁定</strong><span>评分、复核结论和报告快照保持一致；如需重新评估，请新建项目。</span></div>` : unscored.length ? `<div class="maturity-v1-validation is-invalid"><strong>暂不能完成项目</strong><span>还有 ${unscored.length} 个适用评估点缺少四维评分、目标等级或目标理由。</span></div>` : `<div class="maturity-v1-validation is-valid"><strong>评分完整性通过</strong><span>可以提交复核；证据为可选材料，仅统计覆盖率，不影响分数与完成条件。</span></div>`}
        </section>
        <section class="maturity-v1-section">
          <div class="maturity-v1-panel-heading"><div><span>复核队列</span><h3>待处理评分项</h3></div><button class="maturity-v1-link-button" type="button" data-maturity-tab="scoring">返回评分</button></div>
          <div class="maturity-v1-table-wrap"><table class="maturity-v1-table"><thead><tr><th>关注点 / 评估点</th><th>四维自评</th><th>系统当前</th><th>目标</th><th>证据</th><th>状态</th></tr></thead><tbody>${queue.slice(0, 80).map(({ entry, item, focus, service, scored, pointResult }) => { const selected = model.selectedScoreItemId === item.id; return `<tr class="${selected ? "is-selected" : ""}" data-maturity-action="select-review-item" data-score-item-id="${escapeHtml(item.id)}"><td><strong>${escapeHtml(focus.code || "")} ${escapeHtml(focus.name || "评估点")}</strong><span>${escapeHtml(service.code || "")} ${escapeHtml(service.name || "关注点评估点")}</span></td><td>${DIMENSIONS.map(([key]) => escapeHtml(entry.elements?.[key] || "-")).join(" / ")}</td><td>${escapeHtml(pointResult?.currentLevel || "-")} ${pointResult?.currentIndex ?? ""}</td><td>${escapeHtml(entry.targetLevel || "-")}<small>${escapeHtml(entry.targetReason || "缺少目标理由")}</small></td><td>${escapeHtml(entry.evidenceLevel || "E0")}</td><td><span class="maturity-v1-row-status ${entry.isApplicable === false ? "is-muted" : !scored ? "is-warn" : entry.status === "confirmed" ? "is-good" : "is-review"}">${entry.isApplicable === false ? "不适用" : !scored ? "阻塞" : entry.status === "confirmed" ? "已确认" : "待复核"}</span></td></tr>${selected ? `<tr class="maturity-v2-inline-score-row"><td colspan="6"><div class="maturity-v1-score-inspector">${renderScoreInspector(detail, item, focus)}</div></td></tr>` : ""}`; }).join("") || `<tr><td colspan="6"><div class="maturity-v1-table-empty">当前没有待处理评估点。</div></td></tr>`}</tbody></table></div>
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

  function radarShortLabel(row) {
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

  function renderRadarAnalysis(detail, groups) {
    const stats = maturityResultGroupStats(detail, groups);
    const rows = groups.flatMap((group) => group.rows);
    const scoredCount = rows.filter((row) => row.currentIndex != null).length;
    const belowTargetCount = rows.filter((row) => Number(row.gapIndex) > 0).length;
    const leadingGap = list(detail?.result?.gapItems)[0];
    return `<aside class="maturity-v4-radar-analysis" aria-label="技术、治理、管理分层统计与结果评价">
      <header><span>分层统计</span><h4>T / G / M 总体与层级</h4><p>指数沿用后端聚合结果；数量按当前模板 L1、L2 结构统计。</p></header>
      <div class="maturity-v4-radar-tgm-stats">${stats.map((group) => `<section data-radar-group="${escapeHtml(group.code)}"><header><span><i></i><strong>${escapeHtml(group.code)} ${escapeHtml(group.name)}</strong></span><b>${group.result?.currentIndex == null ? "—" : escapeHtml(Number(group.result.currentIndex).toFixed(2))}<small> / 目标 ${group.result?.targetIndex == null ? "—" : escapeHtml(Number(group.result.targetIndex).toFixed(2))}</small></b></header><dl><div><dt>L1</dt><dd>${group.l1Rows.length}</dd></div><div><dt>L2</dt><dd>${group.rows.length}</dd></div><div><dt>低于目标</dt><dd>${group.belowTargetL2Count}</dd></div></dl></section>`).join("")}</div>
      <section class="maturity-v4-radar-l1-stats"><header><strong>L1 能力域</strong><span>当前 / 目标 · L2 数量</span></header><div>${stats.flatMap((group) => group.l1Rows.map((row) => `<div><span><i data-radar-group="${escapeHtml(group.code)}"></i><strong>${escapeHtml(row.code || compactChineseName(row.name))}</strong><small>${escapeHtml(compactChineseName(row.name))}</small></span><b>${row.currentIndex == null ? "—" : escapeHtml(Number(row.currentIndex).toFixed(2))} / ${row.targetIndex == null ? "—" : escapeHtml(Number(row.targetIndex).toFixed(2))}</b><em>${row.l2Count} L2</em></div>`)).join("")}</div></section>
      <section class="maturity-v4-radar-observation"><span>结果评价</span><strong>${scoredCount} / ${rows.length} 项 L2 已有评分</strong><p>${belowTargetCount} 项低于目标等级。${leadingGap ? `后端首要差距候选为 ${escapeHtml(leadingGap.capabilityCode)} ${escapeHtml(leadingGap.capabilityName)}，差距 ${escapeHtml(leadingGap.gapIndex)}，优先级 ${escapeHtml(leadingGap.priority)}。` : "当前没有后端差距候选。"}</p><small>这里只呈现后端结果与候选，正式评价仍需在评分复核后确认。</small></section>
    </aside>`;
  }

  function renderCapabilityRadar(detail) {
    const groups = capabilityRadarGroups(detail);
    const rows = groups.flatMap((group) => group.rows);
    if (!rows.length) return `<div class="maturity-v1-empty-inline">当前没有可进入能力雷达的 L2 能力。</div>`;
    const unscoredCount = rows.filter((row) => row.currentIndex == null).length;
    return `<section class="maturity-v4-radar-panel" data-maturity-radar-contract="l2-capability-by-top-category">
      <header><div><span>能力结果</span><h3>全能力分组雷达</h3><p>固定 1—5 量尺；每条轴是一项 L2 能力，按技术、治理、管理分区展示当前值与目标等级。</p></div><div class="maturity-v4-radar-group-legend" aria-label="雷达能力分组">${groups.map((group) => `<span data-radar-group="${escapeHtml(group.code)}"><i></i><strong>${escapeHtml(group.code)}</strong>${escapeHtml(group.name)} <b>${group.rows.length}</b></span>`).join("")}</div></header>
      <div class="maturity-v4-radar-layout"><div class="maturity-v4-radar-canvas-wrap"><canvas width="880" height="540" data-maturity-capability-radar aria-label="${rows.length} 项 L2 能力成熟度分组雷达，按${escapeHtml(groups.map((group) => group.name).join("、"))}展示"></canvas><div class="maturity-v4-radar-legend"><span class="is-current"><i></i>当前成熟度</span><span class="is-target"><i></i>目标等级</span>${unscoredCount ? `<span class="is-unscored"><i></i>${unscoredCount} 项未评分，不按 0 分计算</span>` : ""}</div></div>${renderRadarAnalysis(detail, groups)}</div>
      <details class="maturity-v4-radar-axis-details"><summary>查看全部 L2 精确值</summary><div>${groups.map((group) => `<section><header><strong>${escapeHtml(group.code)} ${escapeHtml(group.name)}</strong><span>${group.rows.length} 项 L2</span></header>${group.rows.map((row) => `<div><span><b>${escapeHtml(row.code)}</b>${escapeHtml(row.name)}</span><small>当前 ${row.currentIndex == null ? "未评分" : escapeHtml(Number(row.currentIndex).toFixed(2))} · 目标 ${row.targetIndex == null ? "未设置" : escapeHtml(Number(row.targetIndex).toFixed(2))}</small></div>`).join("")}</section>`).join("")}</div></details>
    </section>`;
  }

  function renderAssessmentCoverage(summary, result) {
    const applicable = Number(summary.applicableItemCount || 0);
    const completed = Number(summary.scoredItemCount || 0);
    const remaining = Math.max(0, applicable - completed);
    const excluded = Number(summary.notApplicableCount || 0);
    const completion = Number(summary.completionRate || 0);
    return `<section class="maturity-v4-coverage-panel">
      <header><span>统计口径</span><h3>评估覆盖与排除</h3><p>完成率只使用适用评估点作为分母。</p></header>
      <div class="maturity-v4-coverage-progress"><div><i style="width:${percent(completion)}%"></i></div><strong>${completion.toFixed(0)}%</strong></div>
      <dl><div><dt>适用评估点</dt><dd>${applicable}</dd></div><div><dt>已完成</dt><dd>${completed}</dd></div><div><dt>待完成</dt><dd>${remaining}</dd></div><div><dt>不适用并排除</dt><dd>${excluded}</dd></div></dl>
      <p class="maturity-v4-denominator-note">关注点或安全技术服务标记为不适用后，不进入当前分、目标分、能力聚合或完成率分母；数量仅在这里单独披露。</p>
      <details><summary>查看成熟度与证据分布</summary>${renderDistribution(result.maturityDistribution || [])}<div class="maturity-v1-evidence-list">${list(result.evidenceDistribution).map((item) => `<div><span>${escapeHtml(item.level)} ${escapeHtml(item.name)}</span><strong>${item.count}</strong></div>`).join("")}</div></details>
    </section>`;
  }

  function drawMaturityRadar(detail) {
    const canvas = model.root?.querySelector("[data-maturity-capability-radar]");
    if (!canvas) return;
    const groups = capabilityRadarGroups(detail);
    const rows = groups.flatMap((group) => group.rows);
    const context = canvas.getContext?.("2d");
    if (!rows.length || !context) return;
    const cssWidth = Math.max(560, Math.round(canvas.getBoundingClientRect().width || 880));
    const cssHeight = 540;
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
      context.fillStyle = `${groupColors[groupIndex % groupColors.length]}0d`;
      context.fill();
      const boundary = point(start, 5.12);
      context.beginPath();
      context.moveTo(center.x, center.y);
      context.lineTo(boundary.x, boundary.y);
      context.lineWidth = 1.5;
      context.strokeStyle = `${groupColors[groupIndex % groupColors.length]}66`;
      context.stroke();
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
    const drawSeries = (values, { stroke, dashed = false, points = false }) => {
      context.setLineDash(dashed ? [6, 5] : []);
      context.lineWidth = 2;
      context.strokeStyle = stroke;
      let started = false;
      context.beginPath();
      values.forEach((value, index) => {
        if (value == null || !Number.isFinite(Number(value))) {
          started = false;
          return;
        }
        const current = point(angles[index], Math.max(0, Math.min(5, Number(value))));
        if (!started) context.moveTo(current.x, current.y);
        else context.lineTo(current.x, current.y);
        started = true;
      });
      if (values.every((value) => value != null && Number.isFinite(Number(value)))) context.closePath();
      context.stroke();
      context.setLineDash([]);
      if (points) angles.forEach((angle, index) => {
        if (values[index] == null || !Number.isFinite(Number(values[index]))) return;
        const current = point(angle, Math.max(0, Math.min(5, Number(values[index]))));
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
    const incomplete = Number(summary.completionRate || 0) < 100;
    const viewSwitch = `<div class="maturity-v2-result-views" role="tablist" aria-label="评估结果视图"><button class="${model.resultsView === "customer" ? "is-active" : ""}" type="button" role="tab" aria-selected="${model.resultsView === "customer"}" data-maturity-action="set-results-view" data-results-view="customer">客户结果</button><button class="${model.resultsView === "internal" ? "is-active" : ""}" type="button" role="tab" aria-selected="${model.resultsView === "internal"}" data-maturity-action="set-results-view" data-results-view="internal">内部明细</button><span>客户主结果最细到能力 L2</span></div>`;
    if (model.resultsView === "internal") return `${viewSwitch}${renderInternalAssessmentDetails(detail, true)}`;
    return `
      <div class="maturity-v1-results">
        ${viewSwitch}
        ${incomplete ? `<div class="maturity-v1-validation is-warn"><strong>当前为试算结果</strong><span>还有 ${summary.notScoredCount || 0} 个适用评估点未完成四维评分、目标建议或理由；当前等级仅基于已完成项，不可作为正式评估结论。</span></div>` : ""}
        <section class="maturity-v4-result-overview">
          <div><span>${incomplete ? "当前试算结论" : "总体评估结论"}</span><h3><strong class="maturity-v1-level ${levelTone(summary.currentLevel)}">${escapeHtml(summary.currentLevel)}</strong><b>${summary.currentIndex}</b><small>/ 5</small></h3><p>${incomplete ? "当前结论仅基于已完成的适用评估点。" : "全部适用评估点已进入当前成熟度结论。"}</p></div>
          <dl><div><dt>目标等级</dt><dd>${escapeHtml(summary.targetLevel)} <small>${summary.targetIndex ?? "-"}</small></dd></div><div><dt>成熟度差距</dt><dd>${summary.gapIndex ?? "-"}</dd></div><div><dt>目标达成率</dt><dd>${summary.targetAchievementRate == null ? "-" : `${Number(summary.targetAchievementRate).toFixed(0)}%`}</dd></div><div><dt>评分完成度</dt><dd>${Number(summary.completionRate || 0).toFixed(0)}%</dd></div></dl>
        </section>
        <div class="maturity-v4-result-insights">${renderCapabilityRadar(detail)}${renderAssessmentCoverage(summary, result)}</div>
        <section class="maturity-v1-section maturity-v4-category-comparison">
          <div class="maturity-v1-panel-heading"><div><span>当前与目标</span><h3>能力域结果</h3></div><span>成熟度指数 1—5</span></div>
          ${renderCategoryComparison(result.categoryResults || [])}
        </section>
        <section class="maturity-v1-section">
          <div class="maturity-v1-panel-heading"><div><span>能力成熟度热力表</span><h3>L2 能力结果</h3></div><span>${list(result.capabilityResults).length} 个能力</span></div>
          ${renderCapabilityHeatTable(result.capabilityResults || [])}
        </section>
        <section class="maturity-v1-section">
          <div class="maturity-v1-panel-heading"><div><span>差距优先级</span><h3>高优先级差距 Top 10</h3></div><span>建议候选需人工确认</span></div>
          ${renderGapTable(result.gapItems || [], 10)}
        </section>
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

  function renderCapabilityHeatTable(rows) {
    const sorted = [...list(rows)].sort((left, right) => Number(right.gapIndex || 0) - Number(left.gapIndex || 0) || text(left.code).localeCompare(text(right.code), "zh-Hans-CN", { numeric: true }));
    return `<div class="maturity-v1-table-wrap"><table class="maturity-v1-table maturity-v1-heat-table maturity-v2-capability-table"><thead><tr><th>L2 安全能力</th><th>当前</th><th>目标</th><th>差距</th><th>达成率</th><th>组织</th><th>流程</th><th>工具</th><th>数据</th><th>证据覆盖</th></tr></thead><tbody>${sorted.map((row) => `<tr><td><span class="maturity-v1-code">${escapeHtml(row.code)}</span><strong>${escapeHtml(row.name)}</strong></td><td><span class="maturity-v1-heat-cell ${levelTone(row.currentLevel)}">${escapeHtml(row.currentLevel)}</span><small>${row.currentIndex ?? "-"}</small></td><td>${escapeHtml(row.targetLevel)}<small>${row.targetIndex ?? "-"}</small></td><td>${row.gapIndex ?? "-"}</td><td>${row.targetAchievementRate == null ? "-" : `${Number(row.targetAchievementRate).toFixed(0)}%`}</td>${DIMENSIONS.map(([key]) => `<td><span class="maturity-v2-dimension-result">${row.dimensionResults?.[key] ?? "-"}</span></td>`).join("")}<td>${Number(row.evidenceCoverage || 0).toFixed(0)}%</td></tr>`).join("")}</tbody></table></div>`;
  }

  function renderInternalAssessmentDetails(detail, open = false) {
    const result = detail.result || {};
    const focusById = new Map(list(detail.template.focuses).map((item) => [item.id, item]));
    const rows = list(result.scoreItemResults);
    return `<details class="maturity-v1-section maturity-v2-internal-details"${open ? " open" : ""}><summary><span>内部评估明细</span><strong>关注点、服务、四维评分与证据</strong><small>${rows.length} 个评估点，仅用于评估工作台和报告附录</small></summary><div class="maturity-v1-table-wrap"><table class="maturity-v1-table"><thead><tr><th>关注点 / 评估点</th><th>类型 / 作用域</th><th>四维最终值</th><th>当前</th><th>目标</th><th>达成率</th><th>证据</th><th>状态</th></tr></thead><tbody>${rows.map((row) => { const focus = focusById.get(row.focusId) || {}; return `<tr><td><strong>${escapeHtml(focus.code || "")} ${escapeHtml(focus.name || "关注点")}</strong><span>${escapeHtml(row.serviceCode || "")} ${escapeHtml(row.serviceName || "关注点评估点")}</span></td><td>${escapeHtml(row.itemType)}<small>${escapeHtml(row.scopeCode || "-")}</small></td><td>${DIMENSIONS.map(([key]) => row.dimensionResults?.[key] ?? "-").join(" / ")}</td><td>${escapeHtml(row.currentLevel)} ${row.currentIndex ?? ""}</td><td>${escapeHtml(row.targetLevel)} ${row.targetIndex ?? ""}</td><td>${row.targetAchievementRate == null ? "-" : `${Number(row.targetAchievementRate).toFixed(0)}%`}</td><td>${escapeHtml(row.evidenceLevel)}</td><td>${escapeHtml(row.status)}</td></tr>`; }).join("")}</tbody></table></div></details>`;
  }

  function renderGapTable(rows, limit) {
    const visible = list(rows).slice(0, limit);
    if (!visible.length) return `<div class="maturity-v1-empty-inline">当前没有可计算的成熟度差距。</div>`;
    return `<div class="maturity-v1-table-wrap"><table class="maturity-v1-table maturity-v1-gap-table"><thead><tr><th>优先级</th><th>能力</th><th>当前</th><th>目标</th><th>差距</th><th>优先级分数</th><th>建议方向</th></tr></thead><tbody>${visible.map((item) => `<tr><td><span class="maturity-v1-priority is-${item.priority === "高" ? "high" : item.priority === "中" ? "medium" : "low"}">${escapeHtml(item.priority)}</span></td><td><span class="maturity-v1-code">${escapeHtml(item.capabilityCode)}</span><strong>${escapeHtml(item.capabilityName)}</strong></td><td>${escapeHtml(item.currentLevel)}</td><td>${escapeHtml(item.targetLevel)}</td><td>${item.gapIndex}</td><td>${item.priorityScore}</td><td><span>${list(item.recommendations).slice(0, 2).map((row) => escapeHtml(row.type)).join(" / ")}</span><small>${list(item.relatedServices).slice(0, 2).map(escapeHtml).join("；") || "需人工确认建设措施"}</small></td></tr>`).join("")}</tbody></table></div>`;
  }

  function renderReportTab(detail) {
    const report = detail.report;
    const summary = summaryOf(detail);
    const formalReady = ["completed", "reported", "archived"].includes(detail.project.status) && Number(summary.completionRate) === 100;
    return `
      <div class="maturity-v1-report-layout">
        <section class="maturity-v1-section">
          <div class="maturity-v1-panel-heading"><div><span>${formalReady ? "正式报告快照" : "草稿报告预览"}</span><h3>评估报告内容</h3></div>${report ? `<span class="maturity-v1-status ${report.formal ? "is-good" : "is-warn"}">${report.formal ? "已固化" : "草稿"}</span>` : ""}</div>
          <ol class="maturity-v1-report-chapters"><li>封面与项目信息</li><li>评估范围与模板说明</li><li>成熟度等级与四维计分方法</li><li>总体评估结论</li><li>L1 能力域摘要</li><li>L2 安全能力结果</li><li>L2 能力四维分析</li><li>差距、安全需求与能力演进建议</li><li>证据和限制说明</li><li>内部评估明细附录</li></ol>
          <div class="maturity-v1-report-actions">
            <button class="maturity-v1-button is-primary" type="button" data-maturity-action="generate-report" ${model.reportGenerating ? "disabled" : ""}>${model.reportGenerating ? "生成中..." : formalReady ? "生成报告快照" : "生成草稿预览"}</button>
            ${!formalReady ? `<span>完成全部评分并通过复核后，才能生成正式快照。</span>` : ""}
          </div>
        </section>
        <aside class="maturity-v1-section maturity-v1-report-export">
          <div class="maturity-v1-panel-heading"><div><span>导出</span><h3>报告与项目包</h3></div></div>
          ${report ? `<dl class="maturity-v1-definition-list"><div><dt>快照状态</dt><dd>${report.formal ? "正式快照" : "草稿预览"}</dd></div><div><dt>快照编号</dt><dd>${escapeHtml(report.id)}</dd></div><div><dt>生成时间</dt><dd>${escapeHtml(report.generatedAt)}</dd></div></dl><div class="maturity-v1-export-buttons"><button class="maturity-v1-button is-secondary" type="button" data-maturity-action="download-report" data-format="markdown">Markdown</button><button class="maturity-v1-button is-secondary" type="button" data-maturity-action="download-report" data-format="html">HTML</button><button class="maturity-v1-button is-secondary" type="button" data-maturity-action="download-report" data-format="json">JSON</button><button class="maturity-v1-button is-secondary" type="button" data-maturity-action="download-report" data-format="package">项目包</button></div>` : `<div class="maturity-v1-empty-inline">先生成报告预览或正式快照，再导出文件。</div>`}
        </aside>
        ${report ? `<section class="maturity-v1-section maturity-v1-report-preview"><div class="maturity-v1-panel-heading"><div><span>报告摘要</span><h3>${escapeHtml(detail.project.name)}</h3></div><span>${escapeHtml(summary.currentLevel)} · ${summary.currentIndex}</span></div><div class="maturity-v1-report-preview-grid"><div><span>${formalReady ? "总体成熟度" : "当前试算成熟度"}</span><strong>${escapeHtml(summary.currentLevel)}</strong><small>${summary.currentIndex} / ${summary.currentPercent}</small></div><div><span>目标成熟度</span><strong>${escapeHtml(summary.targetLevel)}</strong><small>差距 ${summary.gapIndex ?? "-"}</small></div><div><span>目标达成率</span><strong>${summary.targetAchievementRate == null ? "-" : `${Number(summary.targetAchievementRate).toFixed(0)}%`}</strong><small>当前指数 ÷ 目标指数</small></div><div><span>证据覆盖率</span><strong>${Number(summary.evidenceCoverage || 0).toFixed(0)}%</strong><small>可选材料完整性指标</small></div></div>${renderGapTable(detail.result?.gapItems || [], 5)}</section>` : ""}
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
    const scorePanels = [...(model.root?.querySelectorAll(".maturity-v3-focus-list > div, .maturity-v3-score-form") || [])].map((panel, index) => ({ index, top: panel.scrollTop, left: panel.scrollLeft }));
    return {
      owners,
      pageX: window.scrollX,
      pageY: window.scrollY,
      tableTop: table?.scrollTop || 0,
      tableLeft: table?.scrollLeft || 0,
      projectTop: projectPage?.scrollTop || 0,
      projectLeft: projectPage?.scrollLeft || 0,
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
    const pageDescription = document.querySelector("#appPageHeader .page-header-copy > p");
    if (pageDescription) {
      pageDescription.textContent = detail
        ? `${detail.project.name} · ${detail.project.organization} · ${detail.project.templateName || detail.template?.name || "模板待选择"}`
        : "管理成熟度评估项目、模板、评分、结果和报告快照。";
    }
    const scoringStatus = detail && model.activeTab === "scoring" ? model.root.querySelector(".maturity-v3-page-status") || slot.querySelector(".maturity-v3-page-status") : null;
    const scoringTools = detail && model.activeTab === "scoring" ? model.root.querySelector(".maturity-v3-scoring-tools") || slot.querySelector(".maturity-v3-scoring-tools") : null;
    slot.replaceChildren();
    if (!detail) {
      slot.innerHTML = `<div class="maturity-v2-page-actions"><details class="maturity-v2-more-menu"><summary class="maturity-v1-button is-secondary">更多</summary><div><button type="button" data-maturity-action="show-global-note" data-note="模板管理将在正式持久化阶段开放。">模板管理</button><button type="button" data-maturity-action="show-global-note" data-note="项目包导出请进入具体项目。">导出项目包</button><button type="button" data-maturity-action="show-global-note" data-note="当前没有需要处理的历史导入任务。">历史导入任务</button></div></details><button id="maturityNewProjectButton" class="maturity-v1-button is-primary" type="button" data-maturity-action="new-project">新建评估项目</button></div>`;
    } else if (model.activeTab === "scoring") {
      if (scoringStatus) slot.append(scoringStatus);
      if (scoringTools) slot.append(scoringTools);
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
    model.root.innerHTML = detail ? renderProject(detail) : renderProjectList();
    window.requestAnimationFrame(() => {
      syncMaturityShellHeader(detail);
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
    if (model.toast) {
      model.root.insertAdjacentHTML("beforeend", `<div class="maturity-v1-toast is-${escapeHtml(model.toastTone)}" role="status">${escapeHtml(model.toast)}</div>`);
    }
  }

  async function loadWorkspace({ force = false } = {}) {
    if (model.loading || (model.loaded && !force)) return;
    model.loading = true;
    model.loaded = false;
    model.error = "";
    render();
    try {
      const response = await window.sapdDataClient?.getMaturityWorkspace?.();
      const workspace = unwrap(response);
      if (!workspace || workspace.dataState !== "ready") throw new Error(workspace?.notice || "成熟度评估 API 当前不可用。请确认 5173 服务已重启到最新代码。");
      model.workspace = workspace;
      hydrateWorkspace(workspace);
      model.loaded = true;
      model.loading = false;
      render();
      const detail = activeDetail();
      if (detail?.locallyStored) calculateDetail(detail, { silent: true });
    } catch (error) {
      model.loading = false;
      model.loaded = true;
      model.error = error?.message || "成熟度评估加载失败。";
      render();
    }
  }

  function touchDetail(detail, { invalidateResult = false, invalidateReport = false } = {}) {
    if (invalidateResult) detail.result = null;
    if (invalidateReport) detail.report = null;
    detail.project.updatedAt = nowLabel();
    detail.dirty = true;
    detail.lastSavedAt = nowLabel();
    detail.localSaveState = "saved";
    if (!persistDetail(detail)) detail.localSaveState = "error";
  }

  function markTemplateDirty(detail) {
    detail.template.status = "draft";
    detail.project.status = "template_configuring";
    detail.validation = null;
    touchDetail(detail, { invalidateResult: true, invalidateReport: true });
  }

  async function calculateDetail(detail = activeDetail(), { silent = false } = {}) {
    if (!detail || model.calculating) return;
    model.calculating = true;
    const sequence = ++model.calculationSequence;
    if (!silent) render();
    try {
      const response = await window.sapdDataClient?.calculateMaturityAssessment?.({
        project: detail.project,
        template: detail.template,
        scoreEntries: detail.scoreEntries,
      });
      const result = unwrap(response);
      if (sequence !== model.calculationSequence) return;
      if (!result?.ok) {
        detail.validation = result?.validation || null;
        throw new Error(list(result?.validation?.errors)[0]?.message || result?.error || "评分计算失败。请先校验模板。")
      }
      detail.result = result;
      detail.resultStale = false;
      detail.dirty = false;
      detail.lastCalculatedAt = nowLabel();
      detail.lastSavedAt = detail.lastCalculatedAt;
      detail.localSaveState = "saved";
      persistDetail(detail);
      if (!silent) model.toast = "评分结果已由后端重新计算";
    } catch (error) {
      if (!silent) {
        model.toast = error?.message || "评分计算失败";
        model.toastTone = "error";
      }
    } finally {
      if (sequence === model.calculationSequence) model.calculating = false;
      render();
    }
  }

  function scheduleCalculation(detail = activeDetail()) {
    window.clearTimeout(model.calculationTimer);
    model.calculationTimer = window.setTimeout(() => calculateDetail(detail, { silent: true }), 280);
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

  function openCreateWizard(detail = null) {
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
        }
      : emptyCreateDraft();
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
      templateName: draft.templateType === "custom" ? "自定义模板待配置" : draft.templateType === "base" ? model.workspace?.template?.name : "待选择模板",
      draftStep: model.createStep,
      updatedAt: nowLabel(),
      mode: "controlled_demo",
      readOnly: false,
    };
    const detail = { ...existing, project, template: existing.template || clone(model.workspace?.template), scoreEntries: list(existing.scoreEntries), result: existing.result || null, report: existing.report || null, exchangeBatches: list(existing.exchangeBatches), locallyStored: true };
    model.details[projectId] = detail;
    persistDetail(detail);
    model.createOpen = false;
    model.createDraftProjectId = "";
    render();
    showToast("项目草稿已保存", "success");
  }

  function createBlankEntries(template) {
    return list(template.scoreItems).map((item) => ({ scoreItemId: item.id, isApplicable: true, elements: {}, dimensionNotes: {}, reviewElements: {}, targetLevel: "", targetReason: "", targetConfirmed: false, evidenceLevel: "E0", evidenceSummary: "", note: "", naReason: "", status: "not_scored" }));
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
    const baseTemplate = clone(model.workspace.template);
    const isCustom = draft.templateType === "custom";
    const template = isCustom
      ? {
          ...baseTemplate,
          id: uid("custom-template"),
          snapshotId: uid("draft-template"),
          name: `${draft.name} 自定义模板`,
          type: "custom",
          status: "draft",
          readOnly: false,
          structureMutable: true,
          weightMutable: true,
          sourceTemplateId: baseTemplate.id,
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
    const detail = { project, template, scoreEntries: createBlankEntries(template), result: null, report: null, exchangeBatches: [], locallyStored: true };
    model.details[projectId] = detail;
    persistDetail(detail);
    model.createOpen = false;
    model.createDraftProjectId = "";
    model.createStep = 1;
    model.activeTab = isCustom ? "template" : "scoring";
    model.selectedCapabilityId = "";
    model.selectedFocusId = "";
    model.selectedScoreItemId = "";
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

  async function exportTemplate(detail) {
    try {
      const response = await window.sapdDataClient?.exportMaturityTemplateExchange?.(detail.template);
      const exported = unwrap(response);
      if (!exported?.ok) throw new Error(exported?.message || list(exported?.validation?.errors)[0]?.message || "模板结构导出失败");
      detail.exchangeBatches = list(detail.exchangeBatches);
      detail.exchangeBatches.push(exported.batch);
      persistDetail(detail);
      downloadBlob(JSON.stringify(exported.package, null, 2), exported.fileName || `${safeFileName(detail.template.name)}-structure-v2.1.json`, "application/json;charset=utf-8");
      showToast("自定义模板结构文件已导出", "success");
    } catch (error) {
      showToast(error?.message || "模板结构导出失败", "error");
    }
  }

  async function importTemplate(detail, file) {
    try {
      const exchange = JSON.parse(await file.text());
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
      downloadBlob(JSON.stringify(exported.package, null, 2), exported.fileName || `${safeFileName(detail.project.name)}-score-v2.1.json`, "application/json;charset=utf-8");
      showToast("评分文件已导出，结构字段保持只读", "success");
    } catch (error) {
      showToast(error?.message || "评分文件导出失败", "error");
    }
  }

  async function importScoreExchange(detail, file) {
    try {
      const exchange = JSON.parse(await file.text());
      const response = await window.sapdDataClient?.importMaturityScoreExchange?.({ project: detail.project, template: detail.template, scoreEntries: detail.scoreEntries, exchange });
      const imported = unwrap(response);
      detail.exchangeBatches = list(detail.exchangeBatches);
      if (imported?.batch) detail.exchangeBatches.push({ ...imported.batch, rowErrors: list(imported.rowErrors) });
      if (!imported?.ok && !list(imported?.scoreEntries).length) throw new Error(list(imported?.rowErrors)[0]?.message || "评分文件导入失败");
      detail.scoreEntries = list(imported.scoreEntries);
      touchDetail(detail, { invalidateResult: true, invalidateReport: true });
      await calculateDetail(detail, { silent: true });
      const failures = Number(imported.batch?.failureCount || 0);
      showToast(failures ? `评分文件部分导入成功，${failures} 行需要修正` : "评分文件已全部导入", failures ? "info" : "success");
    } catch (error) {
      showToast(error?.message || "评分文件导入失败", "error");
    }
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

  async function generateReport(detail) {
    if (!detail || model.reportGenerating) return;
    model.reportGenerating = true;
    render();
    try {
      const response = await window.sapdDataClient?.createMaturityReport?.({ project: detail.project, template: detail.template, scoreEntries: detail.scoreEntries });
      const report = unwrap(response);
      if (!report?.ok) throw new Error(list(report?.validation?.errors)[0]?.message || report?.error || "报告生成失败");
      detail.report = report;
      if (report.formal) {
        detail.project.status = "reported";
        detail.project.readOnly = true;
      }
      touchDetail(detail);
      model.toast = report.formal ? "正式报告快照已生成" : "草稿报告预览已生成";
      model.toastTone = "success";
    } catch (error) {
      model.toast = error?.message || "报告生成失败";
      model.toastTone = "error";
    } finally {
      model.reportGenerating = false;
      render();
    }
  }

  function downloadReport(detail, format) {
    const report = detail?.report;
    if (!report) return;
    if (format === "markdown") downloadBlob(report.markdown || "", report.fileNames?.markdown || "maturity-report.md", "text/markdown;charset=utf-8");
    if (format === "html") downloadBlob(report.html || "", report.fileNames?.html || "maturity-report.html", "text/html;charset=utf-8");
    if (format === "json") downloadBlob(JSON.stringify({ report: { id: report.id, status: report.status, generatedAt: report.generatedAt }, summary: report.summary }, null, 2), report.fileNames?.json || "maturity-report.json", "application/json;charset=utf-8");
    if (format === "package") downloadBlob(JSON.stringify(report.json || {}, null, 2), report.fileNames?.package || "maturity-project-package.json", "application/json;charset=utf-8");
  }

  function updateScoreEntry(detail, itemId, changes) {
    if (!detail || detail.project.readOnly) return;
    if (["score_review", "completed"].includes(detail.project.status)) detail.project.status = "scoring";
    const entry = scoreEntry(detail, itemId);
    Object.assign(entry, changes);
    const scored = entryIsComplete(entry);
    entry.status = entry.isApplicable === false ? "not_applicable" : scored ? "scored" : "incomplete";
    entry.lastUpdateScope = "ITEM";
    entry.lastUpdatedAt = nowLabel();
    detail.resultStale = true;
    touchDetail(detail, { invalidateReport: true });
    render();
    scheduleCalculation(detail);
  }

  function updateFocusEntries(detail, focusId, updater) {
    if (!detail || detail.project.readOnly) return;
    if (["score_review", "completed"].includes(detail.project.status)) detail.project.status = "scoring";
    const scoreItems = list(detail.template?.scoreItems).filter((item) => item.focusId === focusId);
    scoreItems.forEach((item) => {
      const entry = scoreEntry(detail, item.id);
      updater(entry, item);
      entry.status = entry.isApplicable === false ? "not_applicable" : entryIsComplete(entry) ? "scored" : "incomplete";
      entry.lastUpdateScope = "FOCUS_BATCH";
      entry.lastUpdatedAt = nowLabel();
      entry.focusBatchSourceId = focusId;
    });
    detail.resultStale = true;
    touchDetail(detail, { invalidateReport: true });
    render();
    scheduleCalculation(detail);
  }

  function confirmReview(detail) {
    const incomplete = list(detail.scoreEntries).some((entry) => !entryIsComplete(entry));
    if (incomplete) {
      showToast("仍有适用评分项未完成，不能通过复核", "error");
      return;
    }
    detail.scoreEntries.forEach((entry) => {
      if (entry.isApplicable === false) return;
      entry.reviewElements = DIMENSIONS.reduce((values, [key]) => ({ ...values, [key]: entry.reviewElements?.[key] || entry.elements?.[key] }), {});
      entry.targetConfirmed = true;
      entry.status = "confirmed";
    });
    detail.project.status = "completed";
    touchDetail(detail, { invalidateResult: true, invalidateReport: true });
    calculateDetail(detail);
  }

  function handleClick(event) {
    const actionTarget = event.target.closest("[data-maturity-action]");
    const tabTarget = event.target.closest("[data-maturity-tab]");
    if (tabTarget) {
      model.activeTab = tabTarget.dataset.maturityTab || "overview";
      render();
      return;
    }
    if (!actionTarget) return;
    const action = actionTarget.dataset.maturityAction;
    const detail = activeDetail();
    if (action === "retry-load") loadWorkspace({ force: true });
    if (action === "new-project") openCreateWizard();
    if (action === "close-create") closeCreateWizard();
    if (action === "save-create-draft") saveCreateDraft();
    if (action === "resume-draft") openCreateWizard(model.details[actionTarget.dataset.projectId]);
    if (action === "create-edit-step") { model.createStep = Number(actionTarget.dataset.step || 1); model.createErrors = {}; render(); }
    if (action === "set-list-view") { model.listStatus = actionTarget.dataset.listView || "all"; model.expandedProjectId = ""; render(); }
    if (action === "clear-list-filters") { model.listSearch = ""; model.listTemplateType = "all"; model.listOwner = "all"; model.listIndustry = "all"; render(); }
    if (action === "toggle-project-preview") { model.expandedProjectId = model.expandedProjectId === actionTarget.dataset.projectId ? "" : actionTarget.dataset.projectId; render(); }
    if (action === "open-project-tab") {
      model.activeTab = actionTarget.dataset.projectTab || "overview";
      model.navigate?.(`/workbench/maturity/${encodeURIComponent(actionTarget.dataset.projectId || "")}`);
    }
    if (action === "show-global-note") showToast(actionTarget.dataset.note || "该功能将在正式持久化阶段开放", "info");
    if (action === "set-results-view") { model.resultsView = actionTarget.dataset.resultsView || "customer"; render(); }
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
    const lockedActions = new Set(["set-element-level", "set-review-element-level", "clone-custom-template", "add-category", "remove-category", "add-custom-scope", "add-custom-capability", "add-custom-focus", "add-custom-service", "remove-custom-focus", "validate-template", "trigger-template-import", "trigger-score-import", "submit-review", "confirm-review"]);
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
      if (!detail.report) generateReport(detail);
    }
    if (action === "select-capability") {
      setScoringCapability(detail, actionTarget.dataset.capabilityId || "");
      render();
    }
    if (action === "select-score-l0") {
      const l1 = byTemplateOrder(list(detail.template.categories).filter((item) => item.parentId === actionTarget.dataset.categoryId && item.included !== false))[0];
      const capability = byTemplateOrder(includedCapabilities(detail.template).filter((item) => item.categoryId === l1?.id))[0];
      if (capability) setScoringCapability(detail, capability.id);
      render();
    }
    if (action === "select-score-l1") {
      const capability = byTemplateOrder(includedCapabilities(detail.template).filter((item) => item.categoryId === actionTarget.dataset.categoryId))[0];
      if (capability) setScoringCapability(detail, capability.id);
      render();
    }
    if (action === "select-focus") {
      setScoringFocus(detail, actionTarget.dataset.focusId || "");
      model.focusBatchOpen = false;
      render();
    }
    if (action === "select-score-item") {
      setScoringItem(detail, actionTarget.dataset.scoreItemId || "");
      render();
    }
    if (action === "toggle-focus-batch") {
      const selection = scoringSelection(detail);
      const batch = focusBatchState(detail, selection.scoreItems);
      if (!batch.allowed) {
        showToast(batch.reason, "info");
        return;
      }
      model.focusBatchOpen = !model.focusBatchOpen;
      render();
    }
    if (action === "set-focus-batch-level") {
      const selection = scoringSelection(detail);
      const batch = focusBatchState(detail, selection.scoreItems);
      const level = actionTarget.dataset.level;
      if (!batch.allowed || !LEVELS.includes(level)) {
        showToast(batch.reason || "请选择有效等级", "info");
        return;
      }
      model.focusBatchOpen = false;
      updateFocusEntries(detail, actionTarget.dataset.focusId, (entry) => {
        if (entry.isApplicable === false) return;
        entry.elements = DIMENSIONS.reduce((values, [key]) => ({ ...values, [key]: level }), {});
        entry.reviewElements = {};
      });
      showToast(`已将 ${level} 作为下级评估点的四维初始等级`, "success");
    }
    if (action === "select-review-item") {
      model.selectedScoreItemId = model.selectedScoreItemId === actionTarget.dataset.scoreItemId ? "" : actionTarget.dataset.scoreItemId || "";
      render();
    }
    if (action === "close-score-item") {
      model.selectedScoreItemId = "";
      render();
    }
    if (action === "next-score-item") {
      const selection = scoringSelection(detail);
      const scoreItems = selection.focuses.flatMap((candidate) => byTemplateOrder(selection.active.scoreItems.filter((item) => item.focusId === candidate.id)));
      const currentIndex = scoreItems.findIndex((item) => item.id === actionTarget.dataset.scoreItemId);
      const nextItem = scoreItems[currentIndex + 1] || scoreItems[0];
      if (nextItem) setScoringItem(detail, nextItem.id);
      render();
      window.setTimeout(() => model.root.querySelector(".maturity-v3-score-form")?.scrollIntoView({ block: "nearest" }), 0);
    }
    if (action === "clear-score-filters") {
      model.scoringSearch = "";
      model.scoringStatus = "all";
      model.scoringEvidence = "all";
      render();
    }
    if (action === "set-element-level") {
      const entry = scoreEntry(detail, actionTarget.dataset.scoreItemId);
      updateScoreEntry(detail, actionTarget.dataset.scoreItemId, { elements: { ...(entry.elements || {}), [actionTarget.dataset.element]: actionTarget.dataset.level }, reviewElements: {} });
    }
    if (action === "set-review-element-level") {
      const entry = scoreEntry(detail, actionTarget.dataset.scoreItemId);
      updateScoreEntry(detail, actionTarget.dataset.scoreItemId, { reviewElements: { ...(entry.reviewElements || {}), [actionTarget.dataset.element]: actionTarget.dataset.level } });
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
    if (action === "submit-review") {
      if (list(detail.scoreEntries).some((entry) => !entryIsComplete(entry))) showToast("全部适用评估点完成四维评分、目标建议和理由后才能提交复核", "error");
      else {
        detail.project.status = "score_review";
        touchDetail(detail);
        showToast("项目已进入待复核状态", "success");
      }
    }
    if (action === "confirm-review") confirmReview(detail);
    if (action === "generate-report") generateReport(detail);
    if (action === "download-report") downloadReport(detail, actionTarget.dataset.format);
  }

  function handleChange(event) {
    const detail = activeDetail();
    if (event.target.matches("[data-maturity-list-filter='status']")) {
      model.listStatus = event.target.value || "all";
      render();
      return;
    }
    if (event.target.matches("[data-maturity-list-filter='templateType']")) {
      model.listTemplateType = event.target.value || "all";
      render();
      return;
    }
    if (event.target.matches("[data-maturity-list-filter='owner']")) {
      model.listOwner = event.target.value || "all";
      render();
      return;
    }
    if (event.target.matches("[data-maturity-list-filter='industry']")) {
      model.listIndustry = event.target.value || "all";
      render();
      return;
    }
    if (event.target.matches("[data-create-field]")) {
      model.createDraft[event.target.dataset.createField] = event.target.value;
      delete model.createErrors[event.target.dataset.createField];
      return;
    }
    if (!detail) return;
    if (event.target.matches("[data-maturity-capability-jump]")) {
      const capabilityId = event.target.value;
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
      updateFocusEntries(detail, event.target.dataset.focusId, (entry) => {
        if (entry.isApplicable === false) return;
        entry.elements = { ...(entry.elements || {}), [key]: value };
        entry.reviewElements = {};
      });
      return;
    }
    if (event.target.matches("[data-focus-score-field='targetLevel']")) {
      const value = event.target.value;
      updateFocusEntries(detail, event.target.dataset.focusId, (entry) => {
        if (entry.isApplicable !== false) entry.targetLevel = value;
      });
      return;
    }
    if (event.target.matches("[data-score-applicability]")) {
      const isApplicable = event.target.type === "checkbox" ? event.target.checked : event.target.value !== "false";
      updateScoreEntry(detail, event.target.dataset.scoreItemId, { isApplicable, naReason: isApplicable ? "" : scoreEntry(detail, event.target.dataset.scoreItemId).naReason || "" });
      return;
    }
    if (event.target.matches("[data-score-dimension]")) {
      const entry = scoreEntry(detail, event.target.dataset.scoreItemId);
      updateScoreEntry(detail, event.target.dataset.scoreItemId, { elements: { ...(entry.elements || {}), [event.target.dataset.scoreDimension]: event.target.value }, reviewElements: {} });
      return;
    }
    if (event.target.matches("[data-score-review-dimension]")) {
      const entry = scoreEntry(detail, event.target.dataset.scoreItemId);
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

  function handleInput(event) {
    if (event.target.matches("[data-create-field]")) {
      model.createDraft[event.target.dataset.createField] = event.target.value;
      delete model.createErrors[event.target.dataset.createField];
      return;
    }
    if (event.target.matches("[data-maturity-list-search]")) {
      model.listSearch = event.target.value;
      render();
      window.setTimeout(() => { const input = model.root.querySelector("[data-maturity-list-search]"); input?.focus(); input?.setSelectionRange?.(model.listSearch.length, model.listSearch.length); }, 0);
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
      detail.resultStale = true;
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
      detail.resultStale = true;
      touchDetail(detail, { invalidateReport: true });
      scheduleCalculation(detail);
    }
  }

  function handleKeydown(event) {
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
  }

  components.MaturityAssessmentWorkbench = {
    renderShell() {
      return `<section class="maturity-v1-page is-loading" aria-label="成熟度评估正在准备"><p>正在准备成熟度评估工作台...</p></section>`;
    },
    mount({ root, route, navigate }) {
      model.root = root;
      model.route = route || "/workbench/maturity";
      model.navigate = typeof navigate === "function" ? navigate : model.navigate;
      bindRoot(root);
      if (!model.loaded && !model.loading) loadWorkspace();
      else render();
    },
  };
})();
