const state = {
  capability: null,
  management: null,
  lifecycle: null,
  content: null,
  activeView: "overview",
  activeMaintenancePage: "scopes",
  activeReferenceTab: "gbt",
  activeContentPage: "html",
  selectedCapabilityId: null,
  selectedEnvironmentId: null,
  selectedEnvironmentObjectId: null,
  selectedEnvironmentRowId: null,
  selectedDevProcessId: null,
  selectedDataProcessId: null,
  selectedMaintenanceId: null,
  selectedContentId: null,
  search: "",
  relationshipFilters: {},
  relationshipColumnWidths: [190, 180, 150, 160, 160, 150, 130, 160],
};

const $ = (id) => document.getElementById(id);
const list = (value) => (Array.isArray(value) ? value : []);
const text = (value) => (value == null ? "" : String(value));
const escapeHtml = (value) =>
  text(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

const titleOf = (value, fallback = "未命名") => {
  if (!value) return fallback;
  if (typeof value === "object") return text(value.title || value.name || value.code || value.id || fallback);
  return text(value);
};

const codeTitle = (value, fallback = "未命名") => [value?.code, titleOf(value, fallback)].filter(Boolean).join(" ");
const matchesSearch = (...values) => values.map(text).join(" ").toLowerCase().includes(state.search.toLowerCase());

function setHtml(id, html) {
  const element = $(id);
  if (element) element.innerHTML = html;
}

function setText(id, value) {
  const element = $(id);
  if (element) element.textContent = text(value);
}

function emptyState(title, body = "等待数据导出或选择左侧对象") {
  return `<div class="detail-empty"><strong>${escapeHtml(title)}</strong><span>${escapeHtml(body)}</span></div>`;
}

function pillList(items, empty = "暂无") {
  const rows = list(items).filter(Boolean);
  if (!rows.length) return `<span class="empty-inline">${escapeHtml(empty)}</span>`;
  return rows.map((item) => `<span class="stakeholder-pill">${escapeHtml(titleOf(item))}</span>`).join("");
}

function flattenCapabilities() {
  const rows = [];
  for (const category of list(state.capability?.categories)) {
    rows.push({ level: "分类", item: category });
    for (const domain of list(category.domains)) {
      rows.push({ level: "L1", item: domain });
      for (const capability of list(domain.capabilities)) {
        rows.push({ level: "L2", item: capability });
        for (const focus of list(capability.focuses)) rows.push({ level: "关注点", item: focus });
      }
    }
  }
  return rows;
}

function focusRows() {
  return flattenCapabilities().filter((row) => row.item.type === "capability_focus");
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

function compactChips(items, empty = "暂无", limit = 3) {
  const rows = uniqueBy(list(items).filter(Boolean), (item) => (typeof item === "string" ? item : item.id || item.code || item.title || item.name));
  if (!rows.length) return `<span class="empty-inline">${escapeHtml(empty)}</span>`;
  const visible = rows.slice(0, limit);
  const more = rows.length - visible.length;
  return `${visible.map((item) => `<span class="relation-chip">${escapeHtml(titleOf(item))}</span>`).join("")}${more > 0 ? `<span class="relation-chip muted">+${more}</span>` : ""}`;
}

function findCapabilityItemAndFocuses(targetId) {
  let selected = null;
  let focuses = [];
  const collectCapabilityFocuses = (capability) => list(capability.focuses);
  const collectDomainFocuses = (domain) => list(domain.capabilities).flatMap(collectCapabilityFocuses);
  const collectCategoryFocuses = (category) => list(category.domains).flatMap(collectDomainFocuses);
  for (const category of list(state.capability?.categories)) {
    if (category.id === targetId) {
      selected = category;
      focuses = collectCategoryFocuses(category);
      break;
    }
    for (const domain of list(category.domains)) {
      if (domain.id === targetId) {
        selected = domain;
        focuses = collectDomainFocuses(domain);
        break;
      }
      for (const capability of list(domain.capabilities)) {
        if (capability.id === targetId) {
          selected = capability;
          focuses = collectCapabilityFocuses(capability);
          break;
        }
        const focus = list(capability.focuses).find((item) => item.id === targetId);
        if (focus) {
          selected = focus;
          focuses = [focus];
          break;
        }
      }
      if (selected) break;
    }
    if (selected) break;
  }
  return { selected, focuses: focuses.length ? focuses : focusRows().map((row) => row.item) };
}

function capabilityPathForFocus(focusId) {
  for (const category of list(state.capability?.categories)) {
    for (const domain of list(category.domains)) {
      for (const capability of list(domain.capabilities)) {
        const focus = list(capability.focuses).find((item) => item.id === focusId);
        if (focus) return { category, domain, capability, focus };
      }
    }
  }
  return {};
}

function lifecycleProcesses(kind) {
  if (kind === "dev") return list(state.lifecycle?.application_security_development?.processes);
  return list(state.lifecycle?.data_lifecycle?.processes);
}

function contentRows() {
  if (state.activeContentPage === "drawio") return list(state.content?.diagram_views);
  if (state.activeContentPage === "ppt") return list(state.content?.guide_pages);
  return list(state.content?.html_documents);
}

function renderMetrics() {
  const stats = state.capability?.stats || {};
  const lifecycleStats = state.lifecycle?.stats || {};
  const metrics = [
    ["能力", stats.capabilities || 0],
    ["关注点", stats.focuses || 0],
    ["服务", stats.services || 0],
    ["环境", state.management?.stats?.information_environments || 0],
    ["生命周期", (lifecycleStats.application_processes || 0) + (lifecycleStats.data_processes || 0)],
  ];
  setHtml("metrics", metrics.map(([label, value]) => `<div class="metric"><strong>${value}</strong><span>${label}</span></div>`).join(""));
}

function renderOverview() {
  const stats = {
    capability: state.capability?.stats || {},
    management: state.management?.stats || {},
    lifecycle: state.lifecycle?.stats || {},
    content: state.content?.stats || {},
  };
  setText("overviewGeneratedAt", "本地数据");
  setHtml(
    "overviewMap",
    `
      <div class="relation-map">
        ${["安全能力映射", "信息化环境维度", "安全开发维度", "数据生命周期维度", "专项知识维护", "说明与视图"]
          .map((item) => `<div class="relation-node">${escapeHtml(item)}</div>`)
          .join("")}
      </div>
    `,
  );
  setHtml(
    "overviewCoverage",
    `
      <table class="matrix-table">
        <tbody>
          <tr><th>能力关注点</th><td>${stats.capability.focuses || 0}</td><th>关注点-作用域</th><td>${stats.capability.focus_scope_mappings || 0}</td></tr>
          <tr><th>信息化对象</th><td>${stats.management.information_objects || 0}</td><th>对象-作用域</th><td>${stats.management.environment_scope_mappings || 0}</td></tr>
          <tr><th>LC-AP 阶段</th><td>${stats.lifecycle.application_processes || 0}</td><th>LC-DT 过程</th><td>${stats.lifecycle.data_processes || 0}</td></tr>
          <tr><th>Draw.io 图</th><td>${stats.content.diagram_views || 0}</td><th>PPT 页</th><td>${stats.content.guide_pages || 0}</td></tr>
        </tbody>
      </table>
    `,
  );
  setHtml(
    "overviewIssues",
    `
      <div class="issue-list">
        <div><strong>内容视图</strong><span>HTML / Draw.io / PPT 已预留入口</span></div>
        <div><strong>前端策略</strong><span>关系、矩阵、树表优先</span></div>
      </div>
    `,
  );
}

function mountAppShellComponents() {
  const components = window.sapdComponents || {};
  components.AppShell?.mountCapabilityWorkspace($("capabilityWorkspace"));
  if ($("localModeStatus")) setHtml("localModeStatus", components.AppShell?.renderLocalModeStatus?.() || '<span class="type-pill">本地模式</span>');
}

function renderLocalRelationshipNotes(notes) {
  const rows = list(notes);
  if (!rows.length) return emptyState("暂无局部关系说明");
  return `
    <section class="local-relationship-notes">
      <div class="matrix-section-head">
        <div>
          <h3>当前关注点局部关系说明</h3>
          <p>仅说明当前对象的局部关系，不作为单线性链路展示</p>
        </div>
      </div>
      <div class="local-note-list">
        ${rows.map((note) => `<div class="local-note"><strong>${escapeHtml(note.title)}</strong><span>${escapeHtml(note.body)}</span></div>`).join("")}
      </div>
    </section>
  `;
}

function renderCapabilities() {
  const viewModels = window.sapdViewModels;
  const components = window.sapdComponents || {};
  if (!viewModels?.buildCapabilityWorkspaceViewModel) {
    setHtml("detail", emptyState("能力视图模型未加载"));
    return;
  }
  const viewModel = viewModels.buildCapabilityWorkspaceViewModel({
    capabilityTree: state.capability,
    management: state.management,
    selectedCapabilityId: state.selectedCapabilityId,
    search: state.search,
    relationshipFilters: state.relationshipFilters,
  });
  if (!state.selectedCapabilityId) state.selectedCapabilityId = viewModel.selectedCapability?.id || null;
  setHtml("tree", components.DimensionTree?.render({ navigationTree: viewModel.navigationTree, selectedCapabilityId: state.selectedCapabilityId }) || emptyState("能力树组件未加载"));
  setHtml("capabilitySummary", components.AppShell?.renderCapabilitySummary?.(viewModel.relationshipSummary) || "");
  const selected = viewModel.selectedCapability;
  if (!selected) {
    setHtml("detail", emptyState("暂无能力关系数据"));
    return;
  }
  const detailInspector = viewModel.detailInspector;
  setHtml(
    "detail",
    `
      ${components.FocusOverview?.render({ focusOverview: viewModel.focusOverview }) || emptyState("关注点概览组件未加载")}
      <div class="parallel-mapping-grid">
        ${components.FocusScopeServiceMatrix?.render({ rows: viewModel.technicalMappingRows }) || emptyState("技术映射组件未加载")}
        ${components.FocusManagementMapping?.render({ rows: viewModel.managementMappingRows }) || emptyState("管理映射组件未加载")}
      </div>
      ${renderLocalRelationshipNotes(viewModel.localRelationshipNotes)}
      ${components.SourceEvidencePanel ? components.SourceEvidencePanel.render(detailInspector.sourceEvidence) : ""}
    `,
  );
}

function renderEnvironment() {
  const viewModels = window.sapdViewModels;
  const components = window.sapdComponents || {};
  if (!viewModels?.buildEnvironmentWorkspaceViewModel) {
    setHtml("environmentDetail", emptyState("信息化环境视图模型未加载"));
    return;
  }
  const viewModel = viewModels.buildEnvironmentWorkspaceViewModel({
    management: state.management,
    selectedObjectId: state.selectedEnvironmentObjectId,
    selectedEnvironmentId: state.selectedEnvironmentId,
    search: state.search,
  });
  if (viewModel.selectedEnvironment?.id && state.selectedEnvironmentId !== viewModel.selectedEnvironment.id) {
    state.selectedEnvironmentId = viewModel.selectedEnvironment.id;
  }
  if (viewModel.selectedObject?.id && state.selectedEnvironmentObjectId !== viewModel.selectedObject.id) {
    state.selectedEnvironmentObjectId = viewModel.selectedObject.id;
  }
  setText("environmentCount", viewModel.relationshipSummary.objectCount || 0);
  setHtml(
    "environmentTree",
    components.EnvironmentTree?.render({
      navigationTree: viewModel.navigationTree,
      selectedEnvironmentId: state.selectedEnvironmentId,
      selectedObjectId: state.selectedEnvironmentObjectId,
    }) || emptyState("环境对象树组件未加载"),
  );
  if (!viewModel.selectedEnvironment) {
    setHtml("environmentDetail", emptyState("请选择信息化环境或对象"));
    return;
  }
  setHtml(
    "environmentDetail",
    `
      ${components.EnvironmentRelationshipOverview?.render({ viewModel }) || emptyState("环境概览组件未加载")}
      ${components.EnvironmentScopeServiceMatrix?.render({ rows: viewModel.scopeServiceRows, showObjectColumn: viewModel.detailPanel?.showObjectColumn, selectedRowId: state.selectedEnvironmentRowId }) || emptyState("环境映射表组件未加载")}
      ${components.EnvironmentDetailPanel?.render({ localRelationNotes: viewModel.localRelationNotes, sourceEvidence: viewModel.sourceEvidence }) || ""}
    `,
  );
}

function renderLifecycle(kind) {
  if (kind === "dev") {
    const viewModels = window.sapdViewModels;
    const components = window.sapdComponents || {};
    const devWorkspace = $("devLifecycleWorkspace");
    const devDetailPane = devWorkspace?.querySelector(".lifecycle-detail-pane");
    devWorkspace?.classList.add("dev-lifecycle-workspace");
    devDetailPane?.classList.add("is-hidden");
    if (!viewModels?.buildApplicationSecurityLifecycleViewModel) {
      setHtml("devLifecycleDetail", emptyState("安全开发视图模型未加载"));
      return;
    }
    const viewModel = viewModels.buildApplicationSecurityLifecycleViewModel({
      lifecycle: state.lifecycle,
      selectedProcessId: state.selectedDevProcessId,
      search: state.search,
    });
    state.selectedDevProcessId = viewModel.relationshipSummary?.selectedProcessId || viewModel.selectedProcess?.id || null;
    setText("devLifecycleCount", viewModel.navigationTree.length);
    setText("devLifecycleType", viewModel.dataState || "LC-AP");
    setHtml(
      "devLifecycleNav",
      components.ApplicationSecurityLifecycle?.renderNavigation({
        stageTree: viewModel.stageTree,
        selectedProcessId: state.selectedDevProcessId,
      }) || emptyState("安全开发阶段树组件未加载"),
    );
    setHtml(
      "devLifecycleLane",
      `
        ${components.ApplicationSecurityLifecycle?.renderStageOverview(viewModel) || ""}
        ${components.ApplicationSecurityLifecycle?.renderRelationTable({ rows: viewModel.relationRows }) || ""}
        ${components.ApplicationSecurityLifecycle?.renderLocalRelationNotes(viewModel.localRelationNotes) || ""}
        ${components.ApplicationSecurityLifecycle?.renderReferenceSections(viewModel.referenceSections) || ""}
        ${components.SourceEvidencePanel ? components.SourceEvidencePanel.render(viewModel.sourceEvidence) : ""}
      `,
    );
    setHtml("devLifecycleDetail", "");
    return;
  }
  const processes = lifecycleProcesses(kind).filter((process) => matchesSearch(process.title, process.description, process.goal));
  const selectedKey = kind === "dev" ? "selectedDevProcessId" : "selectedDataProcessId";
  if (!state[selectedKey]) state[selectedKey] = processes[0]?.id || null;
  const selected = processes.find((process) => process.id === state[selectedKey]) || processes[0];
  const navId = kind === "dev" ? "devLifecycleNav" : "dataLifecycleNav";
  const countId = kind === "dev" ? "devLifecycleCount" : "dataLifecycleCount";
  const laneId = kind === "dev" ? "devLifecycleLane" : "dataLifecycleMatrix";
  const detailId = kind === "dev" ? "devLifecycleDetail" : "dataLifecycleDetail";
  const typeId = kind === "dev" ? "devLifecycleType" : "dataLifecycleType";
  setText(countId, processes.length);
  setHtml(
    navId,
    processes.map((process) => `<button class="lifecycle-nav-row ${process.id === state[selectedKey] ? "active" : ""}" type="button" data-lifecycle-kind="${kind}" data-lifecycle-id="${escapeHtml(process.id)}"><strong>${escapeHtml(process.title || "未命名")}</strong><span>${escapeHtml(process.order || process.code || "")}</span></button>`).join("") || emptyState("暂无生命周期数据"),
  );
  setHtml(
    laneId,
    processes
      .map((process) => `
        <section class="lane-column">
          <strong>${escapeHtml(process.title || "未命名")}</strong>
          <span>${escapeHtml(kind === "dev" ? process.goal || "阶段目标待补充" : process.description || "过程说明待补充")}</span>
          <small>服务 ${list(process.technical_services).length} / 模块 ${list(process.technology_modules).length} / 策略 ${list(process.policy_requirements).length}</small>
        </section>
      `)
      .join("") || emptyState("暂无生命周期泳道"),
  );
  setText(typeId, kind === "dev" ? "LC-AP" : "LC-DT");
  setHtml(
    detailId,
    selected
      ? `
        <div class="source-entity-code">${escapeHtml(selected.order || selected.code || (kind === "dev" ? "LC-AP" : "LC-DT"))}</div>
        <h2 class="source-entity-title">${escapeHtml(selected.title || "未命名")}</h2>
        <p class="source-entity-desc">${escapeHtml(selected.goal || selected.description || "暂无说明")}</p>
        <h3 class="section-title">活动 / 场景</h3>
        <div class="source-chip-row">${pillList([...list(selected.main_activities), ...list(selected.security_activities), ...list(selected.scenes)], "暂无")}</div>
        <h3 class="section-title">策略 / 服务 / 模块</h3>
        <div class="source-chip-row">${pillList([...list(selected.policy_requirements), ...list(selected.technical_services), ...list(selected.technology_modules)], "暂无")}</div>
      `
      : emptyState("请选择生命周期节点"),
  );
}

function renderMaintenance() {
  const viewModels = window.sapdViewModels;
  const components = window.sapdComponents || {};
  if (!viewModels?.buildMaintenanceWorkspaceViewModel) {
    setHtml("sourceList", emptyState("专项维护视图模型未加载"));
    return;
  }
  const viewModel = viewModels.buildMaintenanceWorkspaceViewModel({
    capabilityTree: state.capability,
    management: state.management,
    section: state.activeMaintenancePage,
    selectedId: state.selectedMaintenanceId,
    search: state.search,
    referenceTab: state.activeReferenceTab,
  });
  state.activeMaintenancePage = viewModel.section;
  state.activeReferenceTab = viewModel.referenceTab || state.activeReferenceTab;
  state.selectedMaintenanceId = viewModel.selectedId;
  setHtml("maintenanceNavigation", components.MaintenanceNavigation?.render({ navigationItems: viewModel.navigationItems }) || "");
  setText("sourcePageTitle", viewModel.page?.title || "专项知识维护");
  setText("sourcePageCount", viewModel.rows.length);
  let tableHtml = `<div class="maintenance-empty-state">${escapeHtml(viewModel.emptyState || "该专项页面将在后续阶段接入。")}</div>`;
  if (viewModel.section === "scopes") {
    tableHtml = components.ScopeMaintenanceTable?.render({ rows: viewModel.rows, selectedId: viewModel.selectedId, emptyState: viewModel.emptyState }) || tableHtml;
  } else if (viewModel.section === "processes") {
    tableHtml = components.ProcessMaintenanceTable?.render({ rows: viewModel.rows, selectedId: viewModel.selectedId, emptyState: viewModel.emptyState }) || tableHtml;
  } else if (viewModel.section === "work-functions") {
    tableHtml = components.WorkFunctionMaintenanceTable?.render({ rows: viewModel.rows, selectedId: viewModel.selectedId, emptyState: viewModel.emptyState }) || tableHtml;
  } else if (viewModel.section === "security-works") {
    tableHtml = components.SecurityWorkMaintenanceTable?.render({ rows: viewModel.rows, selectedId: viewModel.selectedId, emptyState: viewModel.emptyState }) || tableHtml;
  } else if (viewModel.section === "modules") {
    tableHtml = components.TechnologyModuleMaintenanceTable?.render({ rows: viewModel.rows, selectedId: viewModel.selectedId, emptyState: viewModel.emptyState }) || tableHtml;
  } else if (viewModel.section === "measures") {
    tableHtml = components.TechnicalMeasureMaintenanceTable?.render({ rows: viewModel.rows, selectedId: viewModel.selectedId, emptyState: viewModel.emptyState }) || tableHtml;
  } else if (viewModel.section === "references") {
    tableHtml =
      components.StandardRoleReferenceTable?.render({
        standardRows: viewModel.standardRows,
        roleRows: viewModel.roleRows,
        selectedId: viewModel.selectedId,
        emptyState: viewModel.emptyState,
        activeTab: viewModel.referenceTab,
      }) || tableHtml;
  }
  setHtml(
    "sourceList",
    `
      ${components.MaintenanceShell?.render({ viewModel }) || ""}
      ${tableHtml || ""}
    `,
  );
  setText("sourceDetailType", viewModel.detailPanel?.type || "未选择");
  setHtml(
    "sourceDetail",
    components.MaintenanceDetailPanel?.render({ detailPanel: viewModel.detailPanel }) || emptyState("请选择专项对象"),
  );
}

function visibleWorkspaceElements() {
  return [
    "overviewWorkspace",
    "capabilityWorkspace",
    "environmentWorkspace",
    "devLifecycleWorkspace",
    "dataLifecycleWorkspace",
    "maintenanceWorkspace",
    "contentWorkspace",
  ]
    .map((id) => $(id))
    .filter(Boolean);
}

function workspacePanes(workspace) {
  return [...workspace.children].filter((child) => !child.classList.contains("workspace-resizer") && !child.classList.contains("is-hidden"));
}

function applyWorkspaceGrid(workspace, widths) {
  const columns = widths.map((width, index) => `${Math.max(160, Math.round(width))}px${index < widths.length - 1 ? " 6px" : ""}`).join(" ");
  workspace.style.gridTemplateColumns = columns;
  workspace._paneWidths = widths;
}

function defaultWorkspaceWidths(workspace, panes) {
  const handlesWidth = 6 * (panes.length - 1);
  const total = Math.max(480, workspace.clientWidth - handlesWidth);
  const rest = (...fixed) => Math.max(220, total - fixed.reduce((sum, value) => sum + value, 0));
  if (workspace.id === "capabilityWorkspace") return [310, rest(310)];
  if (workspace.id === "environmentWorkspace") return [300, rest(300)];
  if (workspace.id === "devLifecycleWorkspace" && panes.length === 2) return [300, rest(300)];
  if (workspace.id === "devLifecycleWorkspace" || workspace.id === "dataLifecycleWorkspace") return [270, rest(270, 220), 220];
  if (workspace.id === "maintenanceWorkspace") return [220, rest(220, 260), 260];
  if (workspace.id === "contentWorkspace") return [220, rest(220, 260), 260];
  if (workspace.id === "overviewWorkspace") {
    const issueWidth = 240;
    const mapWidth = Math.max(420, Math.round((total - issueWidth) * 0.6));
    return [mapWidth, rest(mapWidth, issueWidth), issueWidth];
  }
  const measured = panes.map((pane) => Math.max(160, pane.getBoundingClientRect().width));
  const measuredTotal = measured.reduce((sum, width) => sum + width, 0) || panes.length;
  return measured.map((width) => (width / measuredTotal) * total);
}

function ensureWorkspaceResizable(workspace) {
  if (workspace.classList.contains("is-hidden") || workspace.clientWidth <= 0) return;
  const panes = workspacePanes(workspace);
  if (panes.length < 2) return;
  workspace.classList.add("is-resizable");
  if (!workspace.dataset.resizableReady) {
    panes.slice(0, -1).forEach((pane, index) => {
      const handle = document.createElement("div");
      handle.className = "workspace-resizer";
      handle.dataset.workspaceResizeIndex = index;
      handle.setAttribute("role", "separator");
      handle.setAttribute("aria-orientation", "vertical");
      pane.after(handle);
    });
    workspace.dataset.resizableReady = "true";
  }
  if (!workspace._paneWidths) {
    applyWorkspaceGrid(workspace, defaultWorkspaceWidths(workspace, panes));
  }
}

function setupResizableWorkspaces() {
  visibleWorkspaceElements().forEach(ensureWorkspaceResizable);
}

function beginWorkspaceResize(event, handle) {
  const workspace = handle.parentElement;
  const index = Number(handle.dataset.workspaceResizeIndex);
  const panes = workspacePanes(workspace);
  if (!workspace || Number.isNaN(index) || index >= panes.length - 1) return;
  event.preventDefault();
  const startX = event.clientX;
  const startWidths = workspace._paneWidths || panes.map((pane) => pane.getBoundingClientRect().width);
  document.body.classList.add("is-resizing");
  const onMove = (moveEvent) => {
    const delta = moveEvent.clientX - startX;
    const nextWidths = [...startWidths];
    nextWidths[index] = Math.max(160, startWidths[index] + delta);
    nextWidths[index + 1] = Math.max(160, startWidths[index + 1] - delta);
    applyWorkspaceGrid(workspace, nextWidths);
  };
  const onUp = () => {
    document.body.classList.remove("is-resizing");
    document.removeEventListener("pointermove", onMove);
    document.removeEventListener("pointerup", onUp);
  };
  document.addEventListener("pointermove", onMove);
  document.addEventListener("pointerup", onUp, { once: true });
}

function applyRelationshipColumnWidths() {
  document.querySelectorAll(".relationship-matrix-table col[data-relation-column-index]").forEach((column) => {
    const index = Number(column.dataset.relationColumnIndex);
    if (!Number.isNaN(index)) column.style.width = `${Math.max(110, state.relationshipColumnWidths[index] || 150)}px`;
  });
}

function beginRelationshipColumnResize(event, handle) {
  const index = Number(handle.dataset.relationColumnIndex);
  if (Number.isNaN(index)) return;
  event.preventDefault();
  event.stopPropagation();
  const startX = event.clientX;
  const startWidths = [...state.relationshipColumnWidths];
  document.body.classList.add("is-resizing");
  const onMove = (moveEvent) => {
    const delta = moveEvent.clientX - startX;
    state.relationshipColumnWidths[index] = Math.max(110, startWidths[index] + delta);
    applyRelationshipColumnWidths();
  };
  const onUp = () => {
    document.body.classList.remove("is-resizing");
    document.removeEventListener("pointermove", onMove);
    document.removeEventListener("pointerup", onUp);
  };
  document.addEventListener("pointermove", onMove);
  document.addEventListener("pointerup", onUp, { once: true });
}

function renderContent() {
  const rows = contentRows().filter((row) => matchesSearch(row.title, row.category, row.view_type, row.content));
  if (!state.selectedContentId || !rows.some((row) => row.id === state.selectedContentId)) state.selectedContentId = rows[0]?.id || null;
  const titles = { html: "HTML 知识说明", drawio: "Draw.io 只读图", ppt: "PPT 使用说明" };
  setText("contentPageTitle", titles[state.activeContentPage]);
  setText("contentPageCount", rows.length);
  setText("htmlDocCount", list(state.content?.html_documents).length);
  setText("drawioViewCount", list(state.content?.diagram_views).length);
  setText("pptGuideCount", list(state.content?.guide_pages).length);
  setHtml(
    "contentList",
    rows.map((row) => `<button class="catalog-row ${row.id === state.selectedContentId ? "active" : ""}" type="button" data-content-id="${escapeHtml(row.id)}"><span class="catalog-main"><strong>${escapeHtml(row.title || "未命名内容")}</strong><small>${escapeHtml(row.view_type || row.category || "")}</small></span><span class="catalog-meta"><span>${escapeHtml(row.slide_number || row.page_index || row.updated_at || "")}</span></span></button>`).join("") || emptyState("暂无内容视图", "HTML / Draw.io / PPT 已预留入口"),
  );
  const selected = rows.find((row) => row.id === state.selectedContentId);
  setText("contentDetailType", state.activeContentPage);
  setHtml(
    "contentDetail",
    selected
      ? `
        <div class="source-entity-code">${escapeHtml(selected.view_type || selected.category || "内容")}</div>
        <h2 class="source-entity-title">${escapeHtml(selected.title || "未命名内容")}</h2>
        <p class="source-entity-desc">${escapeHtml(selected.content || selected.note || selected.drawio_path || selected.preview_path || "首版为索引占位，后续补充预览内容。")}</p>
      `
      : emptyState("请选择内容"),
  );
}

function renderActiveView() {
  renderMetrics();
  if (state.activeView === "overview") renderOverview();
  if (state.activeView === "capabilities") renderCapabilities();
  if (state.activeView === "environment") renderEnvironment();
  if (state.activeView === "dev-lifecycle") renderLifecycle("dev");
  if (state.activeView === "data-lifecycle") renderLifecycle("data");
  if (state.activeView === "maintenance") renderMaintenance();
  if (state.activeView === "content") renderContent();
}

function setActiveView(view) {
  state.activeView = view;
  for (const button of document.querySelectorAll(".module-tab")) {
    const active = button.dataset.view === view;
    button.classList.toggle("active", active);
    button.setAttribute("aria-current", active ? "page" : "false");
  }
  const workspaceMap = {
    overview: "overviewWorkspace",
    capabilities: "capabilityWorkspace",
    environment: "environmentWorkspace",
    "dev-lifecycle": "devLifecycleWorkspace",
    "data-lifecycle": "dataLifecycleWorkspace",
    maintenance: "maintenanceWorkspace",
    content: "contentWorkspace",
  };
  for (const [key, id] of Object.entries(workspaceMap)) $(id)?.classList.toggle("is-hidden", key !== view);
  renderActiveView();
  setupResizableWorkspaces();
}

function bindEvents() {
  document.querySelectorAll(".module-tab").forEach((button) => button.addEventListener("click", () => setActiveView(button.dataset.view)));
  $("searchInput")?.addEventListener("input", (event) => {
    state.search = event.target.value.trim();
    if ($("capabilitySearchInput")) $("capabilitySearchInput").value = event.target.value;
    renderActiveView();
  });
  $("resetButton")?.addEventListener("click", () => {
    state.search = "";
    state.relationshipFilters = {};
    $("searchInput").value = "";
    if ($("capabilitySearchInput")) $("capabilitySearchInput").value = "";
    state.selectedCapabilityId = null;
    renderCapabilities();
  });
  $("capabilitySearchInput")?.addEventListener("input", (event) => {
    state.search = event.target.value.trim();
    if ($("searchInput")) $("searchInput").value = event.target.value;
    renderCapabilities();
  });
  $("tree")?.addEventListener("click", (event) => {
    const row = event.target.closest("[data-capability-id]");
    if (!row) return;
    state.selectedCapabilityId = row.dataset.capabilityId;
    renderCapabilities();
  });
  $("detail")?.addEventListener("click", (event) => {
    const row = event.target.closest("[data-capability-id]");
    if (!row) return;
    state.selectedCapabilityId = row.dataset.capabilityId;
    renderCapabilities();
  });
  $("detail")?.addEventListener("input", (event) => {
    const input = event.target.closest("[data-relation-filter]");
    if (!input) return;
    state.relationshipFilters[input.dataset.relationFilter] = input.value;
    const field = input.dataset.relationFilter;
    const cursor = input.selectionStart;
    renderCapabilities();
    requestAnimationFrame(() => {
      const nextInput = $("detail")?.querySelector(`[data-relation-filter="${field}"]`);
      if (nextInput) {
        nextInput.focus();
        nextInput.setSelectionRange(cursor, cursor);
      }
    });
  });
  $("detail")?.addEventListener("pointerdown", (event) => {
    const handle = event.target.closest(".relationship-column-resizer");
    if (handle) beginRelationshipColumnResize(event, handle);
  });
  $("environmentSearchInput")?.addEventListener("input", (event) => {
    state.search = event.target.value.trim();
    renderEnvironment();
  });
  $("environmentTree")?.addEventListener("click", (event) => {
    const objectRow = event.target.closest("[data-environment-object-id]");
    const environmentRow = event.target.closest("[data-environment-id]");
    if (!objectRow && !environmentRow) return;
    state.selectedEnvironmentId = environmentRow?.dataset.environmentId || null;
    state.selectedEnvironmentObjectId = objectRow?.dataset.environmentObjectId || null;
    state.selectedEnvironmentRowId = null;
    renderEnvironment();
  });
  $("environmentDetail")?.addEventListener("click", (event) => {
    const row = event.target.closest("[data-environment-row-id]");
    if (!row) return;
    state.selectedEnvironmentRowId = row.dataset.environmentRowId;
    renderEnvironment();
  });
  $("sourceSearchInput")?.addEventListener("input", (event) => {
    state.search = event.target.value.trim();
    renderMaintenance();
  });
  $("maintenanceNavigation")?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-source-page]");
    if (!button) return;
    state.activeMaintenancePage = button.dataset.sourcePage;
    if (state.activeMaintenancePage === "references" && !state.activeReferenceTab) state.activeReferenceTab = "gbt";
    state.selectedMaintenanceId = null;
    renderMaintenance();
  });
  $("sourceList")?.addEventListener("click", (event) => {
    const tab = event.target.closest("[data-reference-tab]");
    if (tab) {
      state.activeReferenceTab = tab.dataset.referenceTab;
      state.selectedMaintenanceId = null;
      renderMaintenance();
      return;
    }
    const row = event.target.closest("[data-maintenance-id]");
    if (!row) return;
    state.selectedMaintenanceId = row.dataset.maintenanceId;
    renderMaintenance();
  });
  document.addEventListener("pointerdown", (event) => {
    const handle = event.target.closest(".workspace-resizer");
    if (handle) beginWorkspaceResize(event, handle);
  });
  document.querySelectorAll("[data-lifecycle-kind]").forEach((button) => {
    button.addEventListener("click", () => {});
  });
  document.addEventListener("click", (event) => {
    const lifecycle = event.target.closest("[data-lifecycle-kind][data-lifecycle-id]");
    if (lifecycle) {
      if (lifecycle.dataset.lifecycleKind === "dev") state.selectedDevProcessId = lifecycle.dataset.lifecycleId;
      if (lifecycle.dataset.lifecycleKind === "data") state.selectedDataProcessId = lifecycle.dataset.lifecycleId;
      renderLifecycle(lifecycle.dataset.lifecycleKind);
    }
    const content = event.target.closest("[data-content-id]");
    if (content) {
      state.selectedContentId = content.dataset.contentId;
      renderContent();
    }
  });
  document.querySelectorAll("[data-content-page]").forEach((button) =>
    button.addEventListener("click", () => {
      state.activeContentPage = button.dataset.contentPage;
      state.selectedContentId = null;
      document.querySelectorAll("[data-content-page]").forEach((item) => item.classList.toggle("active", item === button));
      renderContent();
    }),
  );
}

async function init() {
  const dataClient = window.sapdDataClient;
  if (!dataClient) throw new Error("SAPD Wiki dataClient 未加载");
  const [capability, management, lifecycle, content] = await Promise.all([
    dataClient.getCapabilityTree(),
    dataClient.getManagementKnowledge(),
    dataClient.getLifecycleKnowledge(),
    dataClient.getContentViews(),
  ]);
  state.capability = capability.data;
  state.management = management.data;
  state.lifecycle = lifecycle.data;
  state.content = content.data;
  mountAppShellComponents();
  bindEvents();
  setActiveView("overview");
}

init();
