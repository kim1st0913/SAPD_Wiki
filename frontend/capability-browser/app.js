const state = {
  capability: null,
  capabilityWorkbench: null,
  capabilityWorkbenchViewModel: null,
  capabilityInitial: null,
  capabilityProjection: null,
  capabilityWorkspaceView: null,
  sharedLookups: null,
  environmentWorkbench: null,
  environmentWorkbenchViewModel: null,
  environmentManualReview: null,
  lifecycle: null,
  lifecycleWorkbench: null,
  lifecycleWorkbenchViewModel: null,
  analyticsSummary: null,
  content: null,
  guidePackages: {},
  standards: null,
  maintenanceIndex: null,
  maintenanceKnowledge: null,
  activeView: "overview",
  activeRoute: "/",
  capabilityCatalogCollapsed: false,
  devLifecycleCatalogCollapsed: false,
  expandedCapabilityIds: new Set(),
  expandedEnvironmentIds: new Set(),
  expandedSelectionId: null,
  expandedEnvironmentSelectionId: null,
  activeMaintenancePage: "scopes",
  activeReferenceTab: "gbt",
  activeStandardFramework: "mlps-level-3",
  activeStandardTableId: "",
  activeContentPage: "html",
  selectedCapabilityId: null,
  activeCapabilityRelationTab: "summary",
  selectedEnvironmentId: null,
  selectedEnvironmentSegmentId: null,
  selectedEnvironmentObjectId: null,
  selectedEnvironmentRowId: null,
  activeEnvironmentTab: "topology",
  environmentReviewFilters: {
    query: "",
    environment: "",
    segment: "",
    object: "",
    contextKey: "",
    scope: "",
    service: "",
    sameNameOnly: false,
    nodeMissingOnly: false,
    manyServicesOnly: false,
    missingSystemWithModuleOnly: false,
    abnormalModuleMeasureOnly: false,
    duplicateServiceOnly: false,
    missingScopeOnly: false,
    relationIssueOnly: false,
  },
  selectedEnvironmentReviewRowKey: "",
  environmentCatalogCollapsed: false,
  selectedDevProcessId: null,
  selectedDataProcessId: null,
  devLifecycleStageSearch: "",
  dataLifecycleStageSearch: "",
  selectedMaintenanceId: null,
  selectedContentId: null,
  selectedContentSlideIndex: 0,
  activeModelingLanguageTab: "overview",
  modelingPosterLightboxTarget: null,
  modelingPosterLightboxZoom: 1,
  modelingPosterLightboxDragging: false,
  contentSlideScrollMode: "preserve",
  standardFrameworkLoads: new Map(),
  maintenanceSectionLoads: new Map(),
  loadedMaintenanceSections: new Set(),
  maintenanceSectionStaleReloads: new Set(),
  loadedPackages: new Set(),
  packageLoads: new Map(),
  capabilityProjectionFallbackFocusIds: new Set(),
  capabilityProjectionRequestSeq: 0,
  activeCapabilityProjectionRequest: null,
  capabilityProjectionRequests: new Map(),
  annotationContextLoads: new Map(),
  userFavorites: [],
  userFavoritesByRef: new Map(),
  userFavoritesLoaded: false,
  userFavoriteLoadPromise: null,
  userNotes: [],
  userNotesLoaded: false,
  userNotesLoadPromise: null,
  activeUserTarget: null,
  activePageAnnotationTarget: null,
  userAnnotationDrawerOpen: false,
  userAnnotationDraft: "",
  annotationDraftTarget: null,
  userAnnotationExpandedNoteIds: new Set(),
  userAnnotationEditingNoteId: "",
  userAnnotationEditDraft: "",
  pendingAnnotationAction: null,
  pendingAnnotationTargetLabel: "",
  annotationContextMenu: null,
  userWriteStatus: { state: "idle", savingTargetRef: "" },
  activeUserNoteTargetRef: "",
  annotationMarkerFrame: 0,
  annotationMarkerTimers: [],
  annotationSurfaceObserver: null,
  search: "",
  pageHeaderSummary: [],
  pageHeaderNote: "",
  relationshipFilters: {},
  relationshipColumnWidths: [190, 180, 150, 160, 160, 150, 130, 160],
};

const modelingPosterDragState = {
  active: false,
  pointerId: null,
  startX: 0,
  startY: 0,
  scrollLeft: 0,
  scrollTop: 0,
};

const environmentBasemapDragState = {
  active: false,
  pointerId: null,
  startX: 0,
  startY: 0,
  panX: 0,
  panY: 0,
  moved: false,
  suppressNextClick: false,
};

const ENVIRONMENT_BASEMAP_MIN_SCALE = 0.12;
const ENVIRONMENT_BASEMAP_MAX_SCALE = 4;
const ENVIRONMENT_BASEMAP_FIT_PADDING = 28;
const ENVIRONMENT_BASEMAP_DRAG_THRESHOLD = 5;
const ENVIRONMENT_BASEMAP_TOOLTIP_DELAY = 500;
const environmentBasemapTooltipState = {
  timer: 0,
  node: null,
};

const environmentBasemapHtmlCache = new Map();
const environmentBasemapNodeDetailsCache = new Map();
const ENVIRONMENT_BASEMAP_OBJECT_TYPE_LABELS = Object.freeze({
  information_environment: "信息化环境",
  environment_segment: "环境子类",
  information_object: "信息化对象",
  environment_zone: "环境区域",
  external_network: "外部网络",
  actor: "参与方",
  scope_type: "作用域",
  security_technical_service: "安全技术服务",
  security_technology_module: "安全技术模块",
  security_technical_measure: "安全技术措施",
});

const $ = (id) => document.getElementById(id);
const list = (value) => (Array.isArray(value) ? value : []);
const text = (value) => (value == null ? "" : String(value));
const WORKSPACE_STATE_STORAGE_KEY = "sapd:workspace-state:v1";
const MODELING_LANGUAGE_GUIDE_ROUTE = "/guides/security-architecture-modeling-language";
const MODELING_LANGUAGE_GUIDE_TABS = [
  { id: "overview", label: "ArchiMate® 3.2 - 企业架构建模标准" },
  { id: "elements", label: "SAPD 元素图例" },
];
window.__sapdAnnotationAnchorVersion = "v2-contextual";
const ARCHIMATE_POSTER_ASSET_BASE = "./public/data/guides/archimate-poster";
const ARCHIMATE_POSTER_PDF_PATH = `${ARCHIMATE_POSTER_ASSET_BASE}/archimate-poster-v3.2-zh.pdf`;
const ARCHIMATE_POSTER_OVERVIEW_IMAGE = `${ARCHIMATE_POSTER_ASSET_BASE}/archimate-poster-overview.jpg`;
const ARCHIMATE_POSTER_OVERVIEW_SIZE = { width: 6741, height: 4768 };
const ARCHIMATE_POSTER_REGIONS = [
  {
    id: "business-general",
    title: "业务层与通用元素",
    summary: "Business Layer、通用元素与通用行为模型，是业务对象、角色、流程和通用 notation 的基础参考。",
    image: `${ARCHIMATE_POSTER_ASSET_BASE}/archimate-poster-region-business-general.jpg`,
    width: 578,
    height: 1700,
    hotspot: { left: 3.7, top: 5.8, width: 33.9, height: 39.3 },
  },
  {
    id: "application-layer",
    title: "应用层",
    summary: "Application Component、Function、Service、Data Object 等应用架构元素。",
    image: `${ARCHIMATE_POSTER_ASSET_BASE}/archimate-poster-region-application-layer.jpg`,
    width: 1056,
    height: 1439,
    hotspot: { left: 38.2, top: 5.8, width: 21.9, height: 25.9 },
  },
  {
    id: "technology-physical",
    title: "技术层与物理层",
    summary: "Artifact、Device、Node、Communication Network、Facility、Equipment 等技术和物理元素。",
    image: `${ARCHIMATE_POSTER_ASSET_BASE}/archimate-poster-region-technology-physical.jpg`,
    width: 1014,
    height: 1439,
    hotspot: { left: 60.7, top: 5.8, width: 21.6, height: 25.9 },
  },
  {
    id: "motivation-strategy",
    title: "动机元素与战略元素",
    summary: "Requirement、Principle、Goal、Capability、Resource、Value Stream 等治理和战略表达元素。",
    image: `${ARCHIMATE_POSTER_ASSET_BASE}/archimate-poster-region-motivation-strategy.jpg`,
    width: 1030,
    height: 1439,
    hotspot: { left: 82.7, top: 5.8, width: 13.7, height: 39.3 },
  },
  {
    id: "risk-implementation",
    title: "实施迁移、风险与安全叠加",
    summary: "Implementation & Migration、Risk and Security Overlay、派生关系和传递关系等扩展参考。",
    image: `${ARCHIMATE_POSTER_ASSET_BASE}/archimate-poster-region-risk-implementation.jpg`,
    width: 539,
    height: 1700,
    hotspot: { left: 82.7, top: 45.9, width: 13.7, height: 42.1 },
  },
  {
    id: "relationships-views",
    title: "关系、视图与元模型结构",
    summary: "ArchiMate 层、关系线、角色职责、替代表达法、视点和视图示例。",
    image: `${ARCHIMATE_POSTER_ASSET_BASE}/archimate-poster-region-relationships-views.jpg`,
    width: 2200,
    height: 1359,
    hotspot: { left: 37.7, top: 32.8, width: 44.7, height: 55.2 },
  },
];
const DRAWIO_LEGEND_DEFAULT_SIZE = [150, 75];
const DRAWIO_LEGEND_SECURITY_SIZE = [150, 82.94701986754967];
const DRAWIO_ACTOR_SIZE = [26.5, 50];
const ARCHIMATE_ICON_LABEL_RULE = {
  chineseFontSize: 15,
  chineseLineHeight: 16.5,
  chineseWeight: 820,
  englishFontSize: 8.8,
  englishLineHeight: 9.8,
  englishWeight: 680,
  titleGap: 5,
  shapeTextPaddingX: 42,
  actorTextMaxWidth: 86,
};
const ARCHIMATE_NOTATION_REGISTRY = window.sapdArchimateNotationRegistry || {};
const MODELING_LEGEND_SECTIONS = [
  {
    id: "information",
    title: "信息化基础元素图例",
    columns: 4,
    items: [
      { name: "人员", base: "actor 图标", definition: "参与业务活动、承担角色的主动参与者。", fill: "#ffff99", iconType: "actor", drawioSize: DRAWIO_ACTOR_SIZE },
      { name: "系统软件", base: "System Software", definition: "运行在硬件上，支撑上层应用的基础软件环境，如操作系统。", fill: "#AFFFAF", iconType: "system-software", drawioSize: DRAWIO_LEGEND_DEFAULT_SIZE },
      { name: "设备", base: "Device", definition: "物理硬件实体，如物理主机、工控设备。", fill: "#AFFFAF", iconType: "device", drawioSize: DRAWIO_LEGEND_DEFAULT_SIZE },
      { name: "节点", base: "Node", definition: "逻辑的计算或通信资源，如主机、终端、网络边界等。", fill: "#AFFFAF", iconType: "node", drawioSize: DRAWIO_LEGEND_DEFAULT_SIZE },
      { name: "网络", base: "Communication Network", definition: "连接各个节点，实现数据传输的通信基础设施。", fill: "#AFFFAF", iconType: "network", drawioSize: DRAWIO_LEGEND_DEFAULT_SIZE },
      { name: "设施", base: "Facility", definition: "一个具体的物理环境，如数据中心。", fill: "#AFFFAF", iconType: "facility", drawioSize: DRAWIO_LEGEND_DEFAULT_SIZE },
      { name: "地点", base: "Location", definition: "一个物理或地理上的空间位置，如园区、分支机构、数据中心机房等。", fill: "#efd1e4", iconType: "location", drawioSize: DRAWIO_LEGEND_DEFAULT_SIZE },
      { name: "分组", base: "Grouping", definition: "具有共同特征的一组架构元素。", fill: "transparent", stroke: "#7d8997", dashed: true, iconType: "grouping", drawioSize: DRAWIO_LEGEND_DEFAULT_SIZE },
      { name: "应用组件", base: "Application Component", definition: "应用系统、平台、模块。", fill: "#99ffff", iconType: "component", drawioSize: DRAWIO_LEGEND_DEFAULT_SIZE },
      { name: "应用功能", base: "Application Function", definition: "用来执行特定任务的具体应用功能或操作。", fill: "#99ffff", rounded: true, iconType: "function", drawioSize: DRAWIO_LEGEND_DEFAULT_SIZE },
      { name: "应用服务", base: "Application Service", definition: "通常由一个或多个应用功能实现，并向其他应用组件或应用提供服务。", fill: "#99ffff", rounded: true, iconType: "service", drawioSize: DRAWIO_LEGEND_DEFAULT_SIZE },
      { name: "数据对象", base: "Data Object", definition: "应用中处理、传输或存储的数据实体。", fill: "#99ffff", iconType: "data", drawioSize: DRAWIO_LEGEND_DEFAULT_SIZE },
    ],
  },
  {
    id: "security",
    title: "SAPD 安全元素图例",
    columns: 4,
    items: [
      { name: "安全人员", base: "Actor", definition: "参与安全工作、承担角色的主动参与者。", fill: "#ffff99", iconType: "actor", drawioSize: DRAWIO_ACTOR_SIZE },
      { name: "安全技术服务", base: "Technology Service", definition: "作用于信息化对象或过程场景、满足特定安全需求的公开技术行为，支撑安全能力实现。", fill: "#f8cecc", stroke: "#b85450", rounded: true, iconType: "service", drawioSize: DRAWIO_LEGEND_SECURITY_SIZE },
      { name: "安全技术模块", base: "Function", definition: "实现一个或多个安全技术服务的安全技术逻辑实体，可以独立部署运行，通常代表一类安全产品。", fill: "#f8cecc", stroke: "#b85450", rounded: true, iconType: "function", drawioSize: DRAWIO_LEGEND_SECURITY_SIZE },
      { name: "安全系统", base: "Node", definition: "为解决某一场景或领域的安全问题，由多个安全模块组成、协同运行的系统。", fill: "#f8cecc", stroke: "#b85450", iconType: "node", drawioSize: DRAWIO_LEGEND_SECURITY_SIZE },
      { name: "安全技术工件", base: "Artifact", definition: "实现安全技术模块的源文件、可执行文件、脚本、数据库表等。", fill: "#f8cecc", stroke: "#b85450", iconType: "artifact", drawioSize: DRAWIO_LEGEND_SECURITY_SIZE },
      { name: "安全系统软件", base: "System Software", definition: "为存储、执行和使用其中部署的安全软件或数据提供环境的软件。", fill: "#f8cecc", stroke: "#b85450", iconType: "system-software", drawioSize: DRAWIO_LEGEND_SECURITY_SIZE },
      { name: "安全设备", base: "Device", definition: "具有安全处理能力的物理 IT 资源。", fill: "#f8cecc", stroke: "#b85450", iconType: "device", drawioSize: DRAWIO_LEGEND_SECURITY_SIZE },
      { name: "安全威胁", base: "Technology Event", definition: "可能危害到信息化对象或过程的机密性、完整性和可用性的行为。", fill: "#f8cecc", stroke: "#b85450", rounded: true, iconType: "event", drawioSize: DRAWIO_LEGEND_SECURITY_SIZE },
      { name: "安全应用 / 安全应用组件", base: "Application Component", definition: "为实现安全目标和策略、管理安全风险、保护敏感信息和数据而设计开发的应用程序、子系统或模块。", fill: "#99ffff", iconType: "component", drawioSize: DRAWIO_LEGEND_SECURITY_SIZE },
      { name: "安全应用功能", base: "Application Function", definition: "用来执行特定的安全任务的具体安全功能或操作。", fill: "#99ffff", rounded: true, iconType: "function", drawioSize: DRAWIO_LEGEND_SECURITY_SIZE },
      { name: "安全应用服务", base: "Application Service", definition: "用于满足特定安全需求，通常由一个或多个安全应用功能实现，并向其他应用组件或安全应用提供服务。", fill: "#99ffff", rounded: true, iconType: "service", drawioSize: DRAWIO_LEGEND_SECURITY_SIZE },
      { name: "安全数据", base: "Data Object", definition: "安全应用中处理、传输或存储的数据实体。", fill: "#99ffff", iconType: "data", drawioSize: DRAWIO_LEGEND_SECURITY_SIZE },
    ],
  },
  {
    id: "management",
    title: "安全管理元素图例",
    columns: 4,
    items: [
      { name: "安全组织单元", base: "Business Actor", definition: "安全人员所属组织。", fill: "#ffff99", iconType: "business-actor", drawioSize: DRAWIO_LEGEND_DEFAULT_SIZE },
      { name: "安全工作岗位", base: "Business Actor", definition: "安全人员所担任的岗位；岗位：职能 = 1:N。", fill: "#ffff99", iconType: "business-actor", drawioSize: DRAWIO_LEGEND_DEFAULT_SIZE },
      { name: "安全工作职能 / 角色", base: "Business Role", definition: "岗位承担的职责身份 / 责任集合；当前版本不再拆分“职能”和“角色”两套概念。", fill: "#ffff99", iconType: "role", drawioSize: DRAWIO_LEGEND_DEFAULT_SIZE },
      { name: "安全流程", base: "Business Process", definition: "参考 PCF 流程分类框架，分为 L1-L5：L1 安全流程类别；L2 安全职能流程组；L3 安全职能流程；L4 流程活动；L5 活动任务。", fill: "#ffff99", rounded: true, iconType: "process", drawioSize: DRAWIO_LEGEND_DEFAULT_SIZE },
    ],
  },
];
const MODELING_RELATION_LEGENDS = [
  { name: "服务关系", base: "Serving", definition: "应用之间的业务服务关系，表示某个元素将功能提供给另一个元素，例如某个应用组件提供认证服务给业务应用。", lineType: "serving" },
  { name: "数据流 / 控制流", base: "Flow", definition: "表示从一个元素转到另一个元素，通常用来表示信息流的传递。", lineType: "flow" },
  { name: "访问关系", base: "Access", definition: "三条线都是访问关系，表示行为和主动结构元素观察或处理被动结构元素的能力，典型示例如应用组件访问数据库。", lineType: "access", lineVariants: ["access-none", "access-both", "access-end"] },
  { name: "连接关系", base: "Association", definition: "表示两个架构元素之间存在一般连接或关联，用于表达不适合归入服务、流转或访问语义的弱关系。", lineType: "association", lineVariants: ["association-none", "association-end"] },
];
const escapeHtml = (value) =>
  text(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

const annotationValueAttrsForHtml = (value) => {
  const raw = text(value).trim();
  if (!raw || raw === "/" || raw === "暂无" || raw === "待补充") return "";
  return ` data-annotation-value="true" data-copy-text="${escapeHtml(raw)}" title="${escapeHtml(raw)}" data-annotation-tooltip="${escapeHtml(raw)}"`;
};

const titleOf = (value, fallback = "未命名") => {
  if (!value) return fallback;
  if (typeof value === "object") return text(value.title || value.name || value.code || value.id || fallback);
  return text(value);
};

const codeTitle = (value, fallback = "未命名") => [value?.code, titleOf(value, fallback)].filter(Boolean).join(" ");
const matchesSearch = (...values) => values.map(text).join(" ").toLowerCase().includes(state.search.toLowerCase());
const matchesTextQuery = (query, ...values) => {
  const normalized = text(query).trim().toLowerCase();
  if (!normalized) return true;
  return values.map(text).join(" ").toLowerCase().includes(normalized);
};

function readWorkspaceState() {
  try {
    return JSON.parse(window.localStorage?.getItem(WORKSPACE_STATE_STORAGE_KEY) || "null");
  } catch {
    return null;
  }
}

function persistWorkspaceState() {
  try {
    window.localStorage?.setItem(
      WORKSPACE_STATE_STORAGE_KEY,
      JSON.stringify({
        activeRoute: state.activeRoute,
        activeView: state.activeView,
        selectedCapabilityId: state.selectedCapabilityId,
        activeCapabilityRelationTab: state.activeCapabilityRelationTab,
        expandedCapabilityIds: [...state.expandedCapabilityIds],
        capabilityCatalogCollapsed: state.capabilityCatalogCollapsed,
        selectedEnvironmentId: state.selectedEnvironmentId,
        selectedEnvironmentSegmentId: state.selectedEnvironmentSegmentId,
        selectedEnvironmentObjectId: state.selectedEnvironmentObjectId,
        selectedEnvironmentRowId: state.selectedEnvironmentRowId,
        expandedEnvironmentIds: [...state.expandedEnvironmentIds],
        activeEnvironmentTab: state.activeEnvironmentTab,
        environmentCatalogCollapsed: state.environmentCatalogCollapsed,
        selectedDevProcessId: state.selectedDevProcessId,
        devLifecycleStageSearch: state.devLifecycleStageSearch,
        selectedDataProcessId: state.selectedDataProcessId,
        dataLifecycleStageSearch: state.dataLifecycleStageSearch,
        devLifecycleCatalogCollapsed: state.devLifecycleCatalogCollapsed,
        activeMaintenancePage: state.activeMaintenancePage,
        activeReferenceTab: state.activeReferenceTab,
        activeStandardFramework: state.activeStandardFramework,
        activeStandardTableId: state.activeStandardTableId,
        selectedMaintenanceId: state.selectedMaintenanceId,
        activeContentPage: state.activeContentPage,
        selectedContentId: state.selectedContentId,
        selectedContentSlideIndex: state.selectedContentSlideIndex,
        activeModelingLanguageTab: state.activeModelingLanguageTab,
        savedAt: new Date().toISOString(),
      }),
    );
  } catch {
    // Ignore localStorage failures in file/private browsing contexts.
  }
}

function applyWorkspaceState(snapshot) {
  if (!snapshot || typeof snapshot !== "object") return;
  state.selectedCapabilityId = snapshot.selectedCapabilityId || state.selectedCapabilityId;
  state.activeCapabilityRelationTab = snapshot.activeCapabilityRelationTab || state.activeCapabilityRelationTab;
  state.expandedCapabilityIds = new Set(list(snapshot.expandedCapabilityIds));
  state.capabilityCatalogCollapsed = Boolean(snapshot.capabilityCatalogCollapsed);
  state.selectedEnvironmentId = snapshot.selectedEnvironmentId || state.selectedEnvironmentId;
  state.selectedEnvironmentSegmentId = snapshot.selectedEnvironmentSegmentId || state.selectedEnvironmentSegmentId;
  state.selectedEnvironmentObjectId = snapshot.selectedEnvironmentObjectId || state.selectedEnvironmentObjectId;
  state.selectedEnvironmentRowId = snapshot.selectedEnvironmentRowId || state.selectedEnvironmentRowId;
  state.expandedEnvironmentIds = new Set(list(snapshot.expandedEnvironmentIds));
  state.activeEnvironmentTab = snapshot.activeEnvironmentTab || state.activeEnvironmentTab;
  state.environmentCatalogCollapsed = Boolean(snapshot.environmentCatalogCollapsed);
  state.selectedDevProcessId = snapshot.selectedDevProcessId || state.selectedDevProcessId;
  state.devLifecycleStageSearch = snapshot.devLifecycleStageSearch || state.devLifecycleStageSearch;
  state.selectedDataProcessId = snapshot.selectedDataProcessId || state.selectedDataProcessId;
  state.dataLifecycleStageSearch = snapshot.dataLifecycleStageSearch || state.dataLifecycleStageSearch;
  state.devLifecycleCatalogCollapsed = Boolean(snapshot.devLifecycleCatalogCollapsed);
  state.activeMaintenancePage = snapshot.activeMaintenancePage || state.activeMaintenancePage;
  state.activeReferenceTab = snapshot.activeReferenceTab || state.activeReferenceTab;
  state.activeStandardFramework = snapshot.activeStandardFramework || state.activeStandardFramework;
  state.activeStandardTableId = snapshot.activeStandardTableId || state.activeStandardTableId;
  state.selectedMaintenanceId = snapshot.selectedMaintenanceId || state.selectedMaintenanceId;
  state.activeContentPage = snapshot.activeContentPage || state.activeContentPage;
  state.selectedContentId = snapshot.selectedContentId || state.selectedContentId;
  state.selectedContentSlideIndex = Number.isFinite(Number(snapshot.selectedContentSlideIndex)) ? Number(snapshot.selectedContentSlideIndex) : state.selectedContentSlideIndex;
  state.activeModelingLanguageTab = snapshot.activeModelingLanguageTab || state.activeModelingLanguageTab;
}

const PACKAGE_GETTERS = {
  capability: "getCapabilityTree",
  capabilityWorkbench: "getCapabilityWorkbench",
  capabilityInitial: "getCapabilityWorkspaceInitial",
  capabilityProjection: "getCapabilityWorkspaceProjection",
  environmentWorkbench: "getEnvironmentWorkbench",
  environmentManualReview: "getEnvironmentManualReviewChecklist",
  lifecycleWorkbench: "getLifecycleWorkbench",
  analyticsSummary: "getAnalyticsSummary",
  maintenanceIndex: "getMaintenanceIndex",
  maintenanceKnowledge: "getMaintenanceKnowledge",
  sharedLookups: "getSharedLookups",
  content: "getContentViews",
  securityArchitectureDesignGuide: "getSecurityArchitectureDesignGuide",
  dataSecurityDesignGuide: "getDataSecurityDesignGuide",
  lightPlanningGuide: "getLightPlanningGuide",
  standards: "getStandardFrameworks",
  lifecycle: "getLifecycleKnowledge",
};

const GUIDE_ROUTE_PACKAGES = {
  "/guides/security-architecture-design": "securityArchitectureDesignGuide",
  "/guides/data-security-design": "dataSecurityDesignGuide",
  "/guides/light-planning": "lightPlanningGuide",
};

function assignPackageData(name, data) {
  if (name === "capability") state.capability = data;
  if (name === "capabilityInitial") {
    state.capabilityInitial = data;
    state.capabilityWorkbench = data;
    if (!state.loadedPackages.has("capability")) state.capability = capabilityTreeFromWorkbench(data);
    state.capabilityProjection = data;
  }
  if (name === "capabilityWorkbench") {
    state.capabilityWorkbench = data;
    if (!state.loadedPackages.has("capability")) state.capability = capabilityTreeFromWorkbench(data);
  }
  if (name === "capabilityProjection") state.capabilityProjection = data;
  if (name === "sharedLookups") state.sharedLookups = data;
  if (name === "environmentWorkbench") state.environmentWorkbench = data;
  if (name === "environmentManualReview") state.environmentManualReview = data;
  if (name === "lifecycleWorkbench") state.lifecycleWorkbench = data;
  if (name === "analyticsSummary") state.analyticsSummary = data;
  if (name === "maintenanceIndex") state.maintenanceIndex = data;
  if (name === "maintenanceKnowledge") state.maintenanceKnowledge = data;
  if (name === "content") state.content = data;
  if (name === "securityArchitectureDesignGuide") state.guidePackages = { ...state.guidePackages, "security-architecture-design": data };
  if (name === "dataSecurityDesignGuide") state.guidePackages = { ...state.guidePackages, "data-security-design": data };
  if (name === "lightPlanningGuide") state.guidePackages = { ...state.guidePackages, "light-planning": data };
  if (name === "standards") state.standards = data;
  if (name === "lifecycle") state.lifecycle = data;
}

function loadDataPackage(name) {
  if (state.loadedPackages.has(name)) return Promise.resolve();
  if (state.packageLoads.has(name)) return state.packageLoads.get(name);
  const dataClient = window.sapdDataClient;
  const getterName = PACKAGE_GETTERS[name];
  const getter = getterName ? dataClient?.[getterName] : null;
  if (!getter) return Promise.resolve();
  const load = getter
    .call(dataClient)
    .then((envelope) => {
      assignPackageData(name, envelope?.data ?? null);
      state.loadedPackages.add(name);
    })
    .catch((error) => {
      console.warn(`数据包加载失败：${name}`, error);
    })
    .finally(() => {
      state.packageLoads.delete(name);
    });
  state.packageLoads.set(name, load);
  return load;
}

function routePackagesForCurrentState() {
  if (state.activeView === "placeholder") return [];
  if (state.activeView === "overview") return ["analyticsSummary"];
  if (state.activeView === "capabilities") return ["capabilityInitial"];
  if (state.activeView === "environment") {
    return state.activeEnvironmentTab === "review" ? ["environmentWorkbench", "environmentManualReview"] : ["environmentWorkbench"];
  }
  if (state.activeView === "dev-lifecycle") return ["lifecycleWorkbench", "lifecycle"];
  if (state.activeView === "data-lifecycle") return ["lifecycleWorkbench", "lifecycle"];
  if (state.activeView === "content") {
    const guidePackage = GUIDE_ROUTE_PACKAGES[state.activeRoute];
    return guidePackage ? ["content", guidePackage] : ["content"];
  }
  if (state.activeView === "maintenance") {
    if (state.activeMaintenancePage === "standards") return ["standards"];
    const contract = maintenanceLoadContractForPage(state.activeMaintenancePage);
    return uniqueBy(["maintenanceIndex", ...list(contract.requiredPackages)], (name) => name);
  }
  return ["content", "standards"];
}

function mergeCapabilityProjection(projection) {
  if (!projection) return;
  const previous = state.capabilityProjection || {};
  const previousMaps = previous.localRelationMapsByFocusId || previous.local_relation_maps_by_focus_id || {};
  const nextMaps = projection.localRelationMapsByFocusId || projection.local_relation_maps_by_focus_id || {};
  const mergedMaps = { ...previousMaps, ...nextMaps };
  const mergeRows = (left, right) => {
    const rows = new Map();
    list(left).forEach((row) => rows.set(row.id || row.focus?.id || JSON.stringify(row), row));
    list(right).forEach((row) => rows.set(row.id || row.focus?.id || JSON.stringify(row), row));
    return [...rows.values()];
  };
  state.capabilityProjection = {
    ...previous,
    ...projection,
    technicalMappingRows: mergeRows(previous.technicalMappingRows || previous.technical_mapping_rows, projection.technicalMappingRows || projection.technical_mapping_rows),
    managementMappingRows: mergeRows(previous.managementMappingRows || previous.management_mapping_rows, projection.managementMappingRows || projection.management_mapping_rows),
    localRelationMapsByFocusId: mergedMaps,
    localRelationMaps: Object.values(mergedMaps),
    localRelationMap: projection.localRelationMap || previous.localRelationMap || null,
  };
}

function capabilityItemTypeById(id) {
  return capabilityItemById(id)?.type || "";
}

function capabilityItemById(id) {
  if (!id) return "";
  const stack = [...list(state.capability?.categories)];
  while (stack.length) {
    const item = stack.shift();
    if (item?.id === id) return item;
    stack.push(...list(item?.domains), ...list(item?.capabilities), ...list(item?.focuses));
  }
  return null;
}

function capabilityProjectionHasFocus(focusId) {
  if (!focusId) return false;
  const maps = state.capabilityProjection?.localRelationMapsByFocusId || state.capabilityProjection?.local_relation_maps_by_focus_id || {};
  return Boolean(maps[focusId]);
}

function capabilityWorkbenchHasFullRelations() {
  const workbench = state.capabilityWorkbench;
  if (!workbench || typeof workbench !== "object") return false;
  const objects = workbench.objects && typeof workbench.objects === "object" ? workbench.objects : {};
  return Boolean(list(workbench.relationshipGroups).length || list(workbench.relations).length || Object.keys(objects).length);
}

function capabilityProjectionLoadKey(focusId) {
  const item = capabilityItemById(focusId);
  return capabilityProjectionLoadKeyForItem(item || { id: focusId, type: "capability_focus" });
}

function capabilityProjectionLoadKeyForItem(item) {
  return `capabilityProjection:${item?.type || "unknown"}:${item?.id || ""}`;
}

function capabilityWorkspaceViewLoadKeyForItem(item) {
  return `capabilityWorkspaceView:${item?.type || "unknown"}:${item?.id || ""}`;
}

function capabilityProjectionObjectMatches(actual, expected) {
  const actualKeys = [actual?.id, actual?.code].map(text).filter(Boolean);
  const expectedKeys = [expected?.id, expected?.code].map(text).filter(Boolean);
  return actualKeys.some((key) => expectedKeys.includes(key));
}

function capabilityProjectionMatchesSelection(projection, expectedItem) {
  if (!projection || !expectedItem) return false;
  const dataState = text(projection.dataState || projection.data_state).trim();
  if (dataState && dataState !== "ready" && dataState !== "empty") return false;
  const selected = projection.selected || null;
  const center = projection.graph?.center || null;
  if (!selected || !center) return false;
  if (text(selected.type) !== text(expectedItem.type)) return false;
  if (text(center.type) !== text(selected.type)) return false;
  return capabilityProjectionObjectMatches(selected, expectedItem) && capabilityProjectionObjectMatches(center, selected);
}

function currentCapabilityObjectView() {
  const item = capabilityItemById(state.selectedCapabilityId);
  if (capabilityProjectionMatchesSelection(state.capabilityWorkspaceView, item)) return state.capabilityWorkspaceView;
  if (capabilityProjectionMatchesSelection(state.capabilityProjection, item)) return state.capabilityProjection;
  return null;
}

function isActiveCapabilityProjectionRequest(request) {
  return (
    request &&
    state.activeCapabilityProjectionRequest?.seq === request.seq &&
    state.activeCapabilityProjectionRequest?.objectId === request.objectId &&
    state.activeCapabilityProjectionRequest?.objectType === request.objectType &&
    state.activeView === "capabilities" &&
    state.selectedCapabilityId === request.objectId
  );
}

function capabilitySelectionNeedsFullWorkbench(selectedType) {
  return Boolean(
    state.selectedCapabilityId &&
      selectedType &&
      selectedType !== "capability_focus" &&
      !capabilityWorkbenchHasFullRelations() &&
      !state.loadedPackages.has("capabilityWorkbench"),
  );
}

function requestCapabilityWorkbenchForSelection(selectedType) {
  if (!capabilitySelectionNeedsFullWorkbench(selectedType)) return false;
  loadDataPackage("capabilityWorkbench").then(() => {
    if (state.activeView === "capabilities") renderCapabilities();
  });
  return true;
}

function ensureCapabilityProjectionForFocus(focusId) {
  if (!focusId || capabilityProjectionHasFocus(focusId)) return Promise.resolve();
  const item = capabilityItemById(focusId);
  if (!item || item.type !== "capability_focus") return Promise.resolve();
  const loadKey = capabilityProjectionLoadKeyForItem(item);
  if (state.packageLoads.has(loadKey)) {
    const pendingRequest = state.capabilityProjectionRequests.get(loadKey);
    if (pendingRequest) state.activeCapabilityProjectionRequest = pendingRequest;
    return state.packageLoads.get(loadKey);
  }
  const request = {
    seq: ++state.capabilityProjectionRequestSeq,
    objectId: item.id,
    objectType: item.type,
    objectCode: item.code || "",
  };
  state.activeCapabilityProjectionRequest = request;
  state.capabilityProjectionRequests.set(loadKey, request);
  const dataClient = window.sapdDataClient;
  const load = dataClient
    ?.getCapabilityWorkspaceProjection?.({ objectType: item.type, objectId: item.id })
    .then(async (envelope) => {
      if (!isActiveCapabilityProjectionRequest(request)) return;
      const projection = envelope?.data;
      if (!capabilityProjectionMatchesSelection(projection, item)) {
        console.warn("关注点关系投影与当前选择不一致，已丢弃", { requested: request, selected: projection?.selected, center: projection?.graph?.center });
      } else {
        mergeCapabilityProjection(projection);
      }
      if (!capabilityProjectionHasFocus(focusId) && !capabilityWorkbenchHasFullRelations() && !state.loadedPackages.has("capabilityWorkbench")) {
        state.capabilityProjectionFallbackFocusIds.add(focusId);
        await loadDataPackage("capabilityWorkbench");
      }
      if (state.activeView === "capabilities" && state.selectedCapabilityId === focusId) renderCapabilities();
    })
    .catch((error) => console.warn("关注点关系投影加载失败", error))
    .finally(() => {
      state.packageLoads.delete(loadKey);
      state.capabilityProjectionRequests.delete(loadKey);
    });
  if (load) state.packageLoads.set(loadKey, load);
  return load || Promise.resolve();
}

function ensureCapabilityWorkspaceViewForSelection(selectedId) {
  const item = capabilityItemById(selectedId);
  if (!item?.id || !item.type) return Promise.resolve();
  if (capabilityProjectionMatchesSelection(state.capabilityWorkspaceView, item)) return Promise.resolve();
  const loadKey = capabilityWorkspaceViewLoadKeyForItem(item);
  if (state.packageLoads.has(loadKey)) {
    const pendingRequest = state.capabilityProjectionRequests.get(loadKey);
    if (pendingRequest) state.activeCapabilityProjectionRequest = pendingRequest;
    return state.packageLoads.get(loadKey);
  }
  const request = {
    seq: ++state.capabilityProjectionRequestSeq,
    objectId: item.id,
    objectType: item.type,
    objectCode: item.code || "",
  };
  state.activeCapabilityProjectionRequest = request;
  state.capabilityProjectionRequests.set(loadKey, request);
  const dataClient = window.sapdDataClient;
  const load = dataClient
    ?.getCapabilityWorkspaceView?.({ objectType: item.type, objectId: item.id })
    .then((envelope) => {
      if (!isActiveCapabilityProjectionRequest(request)) return;
      const view = envelope?.data;
      if (!capabilityProjectionMatchesSelection(view, item)) {
        console.warn("能力对象工作区视图与当前选择不一致，已丢弃", { requested: request, selected: view?.selected, center: view?.graph?.center });
      } else {
        state.capabilityWorkspaceView = view;
      }
      if (state.activeView === "capabilities" && state.selectedCapabilityId === item.id) renderCapabilities();
    })
    .catch((error) => console.warn("能力对象工作区视图加载失败", error))
    .finally(() => {
      state.packageLoads.delete(loadKey);
      state.capabilityProjectionRequests.delete(loadKey);
    });
  if (load) state.packageLoads.set(loadKey, load);
  return load || Promise.resolve();
}

function capabilityNodeFromWorkbench(node) {
  const base = {
    id: node?.id || "",
    type: node?.type || "",
    code: node?.code || "",
    title: titleOf(node, ""),
    name: node?.name || "",
    description: node?.description || "",
  };
  const children = list(node?.children);
  if (base.type === "capability_category") {
    return { ...base, domains: children.map(capabilityNodeFromWorkbench) };
  }
  if (base.type === "capability_domain") {
    return { ...base, capabilities: children.map(capabilityNodeFromWorkbench) };
  }
  if (base.type === "capability") {
    return { ...base, focuses: children.map(capabilityNodeFromWorkbench) };
  }
  return base;
}

function capabilityTreeFromWorkbench(workbench) {
  const tree = list(workbench?.navigator?.tree);
  return {
    generated_at: workbench?.meta?.generated_at || null,
    data_state: workbench?.__data_state === "missing_file" ? "missing_file" : "ready",
    stats: workbench?.meta?.stats || {},
    categories: tree.map(capabilityNodeFromWorkbench),
    unlinked_focuses: [],
  };
}

function capabilityUserObjectLabel(type) {
  const labels = {
    capability_category: "能力分类",
    capability_domain: "能力域",
    capability: "能力",
    capability_focus: "关注点",
  };
  return labels[type] || "能力对象";
}

function hashText(value) {
  let hash = 5381;
  for (const char of text(value)) hash = ((hash << 5) + hash) ^ char.charCodeAt(0);
  return Math.abs(hash >>> 0).toString(36);
}

function encodeAnchorPart(value) {
  return encodeURIComponent(text(value).trim() || "_");
}

const ANNOTATION_VALUE_SELECTOR = [
  '[data-annotation-value="true"]',
  "[data-copy-text]",
  ".relation-chip",
  ".standard-tooltip-chip",
  ".standard-framework-name",
  ".management-chip",
  ".taxonomy-chip",
].join(", ");

const ANNOTATION_CELL_VALUE_SELECTOR = "td";
const ANNOTATION_TARGET_REF_SELECTOR = "[data-annotation-target-ref]";

const ANNOTATION_CONTEXT_SELECTOR = [
  ANNOTATION_VALUE_SELECTOR,
  ANNOTATION_TARGET_REF_SELECTOR,
  ANNOTATION_CELL_VALUE_SELECTOR,
  "tr",
  "[data-capability-id]",
  "[data-maintenance-id]",
].join(", ");

function annotationValueText(node) {
  return text(node?.dataset?.copyText || node?.dataset?.annotationValueText || node?.textContent).trim();
}

function annotationTargetAttrsForHtml(target, { title = "" } = {}) {
  if (!target?.targetRef) return "";
  const targetTitle = text(title || target.title || target.code || target.id || target.targetRef).trim();
  return [
    `data-annotation-target-ref="${escapeHtml(target.targetRef)}"`,
    `data-annotation-anchor-type="${escapeHtml(target.anchorType || "object")}"`,
    `data-annotation-object-type="${escapeHtml(target.objectType || "knowledge_object")}"`,
    `data-annotation-object-label="${escapeHtml(target.objectLabel || "业务对象")}"`,
    `data-annotation-object-id="${escapeHtml(target.id || "")}"`,
    `data-annotation-object-code="${escapeHtml(target.code || "")}"`,
    `data-annotation-title="${escapeHtml(targetTitle)}"`,
    `data-annotation-tooltip="${escapeHtml(targetTitle)}"`,
    `title="${escapeHtml(targetTitle)}"`,
  ].join(" ");
}

function annotationCellValueText(node) {
  const value = text(node?.dataset?.copyText || node?.textContent)
    .replace(/\s+/g, " ")
    .trim();
  if (!value || value === "/" || value === "暂无" || value === "待补充") return "";
  return value;
}

function annotationCellValueNode(element) {
  const cell = element?.closest?.(ANNOTATION_CELL_VALUE_SELECTOR);
  if (!cell || cell.closest?.("[data-annotation-drawer], [data-annotation-context-menu]")) return null;
  if (!cell.closest?.("table")) return null;
  if (element.closest?.(ANNOTATION_VALUE_SELECTOR)) return null;
  if (cell.querySelector?.(ANNOTATION_VALUE_SELECTOR)) return null;
  return annotationCellValueText(cell) ? cell : null;
}

function normalizeAnnotationLookupText(value) {
  return text(value)
    .replace(/\u00a0/g, " ")
    .replace(/[｜|]/g, " ")
    .replace(/[：:]/g, " ")
    .replace(/[，,。；;、]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function compactAnnotationLookupText(value) {
  return normalizeAnnotationLookupText(value).replace(/\s+/g, "");
}

function uniqueAnnotationTextVariants(values) {
  const seen = new Set();
  const variants = [];
  for (const value of values.flatMap((item) => (Array.isArray(item) ? item : [item]))) {
    const normalized = normalizeAnnotationLookupText(value);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    variants.push(normalized);
  }
  return variants;
}

function noteLookupTextVariants(note = {}) {
  const objectTitle = text(note.object_title).trim();
  const body = text(note.body).trim();
  const values = [objectTitle];
  objectTitle
    .split(/[｜|]/)
    .map((item) => item.trim())
    .filter(Boolean)
    .forEach((item) => values.push(item));
  values.push(
    objectTitle
      .replace(/^(选中值|表格行|标准控制项|安全技术服务|安全技术模块|安全技术措施|能力|关注点|页面)\s*/u, "")
      .trim(),
  );
  if (body && body.length <= 80) values.push(body);
  return uniqueAnnotationTextVariants(values);
}

function annotationElementLookupTexts(node) {
  if (!node) return [];
  return uniqueAnnotationTextVariants([
    node.dataset?.annotationTitle,
    node.dataset?.annotationTooltip,
    node.dataset?.copyText,
    node.dataset?.annotationValueText,
    node.getAttribute?.("title"),
    node.getAttribute?.("aria-label"),
    annotationValueText(node),
    annotationCellValueText(node),
    node.querySelector?.("strong")?.textContent,
    node.textContent,
  ]);
}

function annotationTextMatchScore(node, note) {
  const targetRef = text(note?.target_ref).trim();
  let score = node.dataset?.annotationTargetRef && text(node.dataset.annotationTargetRef).trim() === targetRef ? 220 : 0;
  const noteTexts = noteLookupTextVariants(note);
  const nodeTexts = annotationElementLookupTexts(node);
  if (noteTexts.length && nodeTexts.length) {
    for (const noteText of noteTexts) {
      const compactNote = compactAnnotationLookupText(noteText);
      if (!compactNote) continue;
      for (const nodeText of nodeTexts) {
        const compactNode = compactAnnotationLookupText(nodeText);
        if (!compactNode) continue;
        if (compactNode === compactNote) score = Math.max(score, 130);
        else if (compactNode.includes(compactNote)) score = Math.max(score, compactNote.length >= 3 ? 92 : 54);
        else if (compactNote.includes(compactNode) && compactNode.length >= 3) score = Math.max(score, 76);
      }
    }
  }
  if (!score) return 0;
  const anchorType = normalizedAnnotationAnchorType(note.anchor_type || annotationAnchorTypeFromTargetRef(note.target_ref));
  if (score && anchorType === "field" && node.matches?.(ANNOTATION_VALUE_SELECTOR)) score += 12;
  if (score && anchorType === "row" && node.matches?.("tr, [data-maintenance-id], [data-capability-id]")) score += 12;
  return score;
}

function visibleAnnotationCandidates(selector, includeHidden = false) {
  return Array.from(document.querySelectorAll(selector)).filter((node) => {
    if (node.closest?.("[data-annotation-drawer], [data-annotation-context-menu]")) return false;
    return includeHidden || isAnnotationAnchorVisible(node);
  });
}

function bestAnnotationCandidate(candidates, note, minimumScore = 58) {
  let best = null;
  let bestScore = 0;
  for (const candidate of candidates) {
    const score = annotationTextMatchScore(candidate, note);
    if (score > bestScore) {
      best = candidate;
      bestScore = score;
    }
  }
  return bestScore >= minimumScore ? best : null;
}

function decodeLegacyAnchorPart(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function legacyAnnotationTargetMeta(targetRef = "") {
  const parts = text(targetRef).trim().split(":");
  if (parts[0] !== "base" || parts[2] !== "v2") return null;
  const decoded = parts.slice(3).map(decodeLegacyAnchorPart);
  const view = decoded[1] || "";
  const contextEndByView = {
    capabilities: 4,
    maintenance: 6,
    content: 5,
    "dev-lifecycle": 3,
    "data-lifecycle": 3,
  };
  const contextEnd = contextEndByView[view] || 2;
  return {
    objectType: parts[1] || "",
    route: decoded[0] || "",
    view,
    context: decoded.slice(0, contextEnd),
    rowHash: decoded[contextEnd] || "",
    coordinate: decoded[contextEnd + 1] || "",
    valueHash: decoded[contextEnd + 2] || "",
  };
}

function annotationTargetContextMatchesCurrent(note = {}) {
  const meta = legacyAnnotationTargetMeta(note.target_ref);
  if (!meta) return true;
  const current = annotationContextId().split(":").map(decodeLegacyAnchorPart);
  return meta.context.every((part, index) => !part || part === "_" || current[index] === part);
}

function guideSlideTargetMetaFromNote(note = {}) {
  const targetRef = text(note?.target_ref).trim();
  if (!targetRef.startsWith("base:security_guide_slide:")) return null;
  const stableKey = targetRef.replace(/^base:security_guide_slide:/, "");
  const hashIndex = stableKey.lastIndexOf("#");
  const contentId = hashIndex >= 0 ? stableKey.slice(0, hashIndex) : stableKey;
  const titlePageMatch = text(note?.object_title).match(/第\s*(\d+)\s*页/u);
  const pageNumber = Number(hashIndex >= 0 ? stableKey.slice(hashIndex + 1) : titlePageMatch?.[1]);
  if (!contentId || !Number.isFinite(pageNumber) || pageNumber < 1) return null;
  return {
    contentId,
    pageNumber,
    slideIndex: Math.max(0, pageNumber - 1),
  };
}

function restoreGuideSlideContextFromNote(note = {}) {
  const slideTarget = guideSlideTargetMetaFromNote(note);
  if (!slideTarget) return false;
  let changed = false;
  if (state.activeContentPage !== "html") {
    state.activeContentPage = "html";
    changed = true;
  }
  const rows = contentRows();
  const matchedRow = rows.find((row) =>
    [row?.id, row?.route, row?.guide_id, row?.code]
      .map((value) => text(value).trim())
      .some((value) => value && value === slideTarget.contentId),
  );
  const nextContentId = matchedRow?.id || slideTarget.contentId;
  if (nextContentId && nextContentId !== state.selectedContentId) {
    state.selectedContentId = nextContentId;
    changed = true;
  }
  if (slideTarget.slideIndex !== state.selectedContentSlideIndex) {
    state.selectedContentSlideIndex = slideTarget.slideIndex;
    changed = true;
  }
  if (changed) state.contentSlideScrollMode = "active";
  return changed;
}

function candidateFromLegacyCoordinate(note, { includeHidden = false } = {}) {
  const meta = legacyAnnotationTargetMeta(note?.target_ref);
  if (meta && !annotationTargetContextMatchesCurrent(note)) return null;
  const match = text(meta?.coordinate).match(/^t(\d+)r(\d+)c(\d+)v(.+)$/);
  if (!match) return null;
  const anchorType = normalizedAnnotationAnchorType(note?.anchor_type || annotationAnchorTypeFromTargetRef(note?.target_ref));
  const [, tableIndexText, rowIndexText, cellIndexText, valueIndexText] = match;
  const tableIndex = Number(tableIndexText);
  const rowIndex = Number(rowIndexText);
  const cellIndex = Number(cellIndexText);
  const visibleTables = visibleAnnotationCandidates("table", includeHidden);
  const allTables = Array.from(document.querySelectorAll("table")).filter((node) => !node.closest?.("[data-annotation-drawer], [data-annotation-context-menu]"));
  const tables = [...new Set([visibleTables[tableIndex], allTables[tableIndex], ...visibleTables].filter(Boolean))];
  const candidates = [];
  for (const table of tables) {
    if (!includeHidden && !isAnnotationAnchorVisible(table)) continue;
    const rows = Array.from(table.querySelectorAll("tbody tr, thead tr, tfoot tr, tr"));
    const row = rows[rowIndex];
    if (!row || (!includeHidden && !isAnnotationAnchorVisible(row))) continue;
    const cell = row.children[cellIndex];
    const valueNodes = cell ? Array.from(cell.querySelectorAll(ANNOTATION_VALUE_SELECTOR)) : [];
    if (anchorType === "field") {
      if (valueIndexText === "cell" && cell && !valueNodes.length) candidates.push(cell);
      else {
        const valueIndex = Number(valueIndexText);
        if (Number.isFinite(valueIndex) && valueNodes[valueIndex]) candidates.push(valueNodes[valueIndex]);
        candidates.push(...valueNodes);
        if (cell && !valueNodes.length) candidates.push(cell);
      }
      continue;
    }
    if (valueIndexText === "cell" && cell) candidates.push(cell);
    else {
      const valueIndex = Number(valueIndexText);
      if (Number.isFinite(valueIndex) && valueNodes[valueIndex]) candidates.push(valueNodes[valueIndex]);
      if (cell) candidates.push(...valueNodes, cell);
    }
    candidates.push(row);
  }
  return bestAnnotationCandidate(candidates, note, 42);
}

function findAnnotationAnchorElementByNoteText(note, { includeHidden = false } = {}) {
  const targetRef = text(note?.target_ref).trim();
  const anchorType = normalizedAnnotationAnchorType(note?.anchor_type || annotationAnchorTypeFromTargetRef(note?.target_ref));
  const selectors =
    targetRef.startsWith("base:capability:")
      ? ["[data-capability-id]", "#capabilityFocusHeader", "#tree"]
      : anchorType === "row"
      ? ["[data-annotation-target-ref]", "[data-maintenance-id]", "[data-capability-id]", "tr"]
      : [ANNOTATION_VALUE_SELECTOR, ANNOTATION_CELL_VALUE_SELECTOR, "[data-annotation-target-ref]"];
  const candidates = selectors.flatMap((selector) => visibleAnnotationCandidates(selector, includeHidden));
  return bestAnnotationCandidate(candidates, note);
}

function capabilityItemByCodeOrTitle(value) {
  const target = compactAnnotationLookupText(value);
  if (!target) return null;
  let fuzzy = null;
  const stack = [...list(state.capability?.categories)];
  while (stack.length) {
    const item = stack.shift();
    const values = [item?.id, item?.code, item?.title, codeTitle(item || {})].map(compactAnnotationLookupText);
    if (values.some((candidate) => candidate && candidate === target)) return item;
    if (!fuzzy && values.some((candidate) => candidate && candidate.length >= target.length && candidate.includes(target))) fuzzy = item;
    stack.push(...list(item?.domains), ...list(item?.capabilities), ...list(item?.focuses));
  }
  return fuzzy;
}

function annotationContextId() {
  const parts = [state.activeRoute || "/", state.activeView || ""];
  if (state.activeView === "capabilities") {
    parts.push(state.selectedCapabilityId || "", state.activeCapabilityRelationTab || "");
  } else if (state.activeView === "maintenance") {
    parts.push(state.activeMaintenancePage || "", state.activeReferenceTab || "", state.activeStandardFramework || "", state.activeStandardTableId || "");
  } else if (state.activeView === "content") {
    parts.push(state.activeContentPage || "", state.selectedContentId || "", String(state.selectedContentSlideIndex || 0));
  } else if (state.activeView === "dev-lifecycle") {
    parts.push(state.selectedDevProcessId || "");
  } else if (state.activeView === "data-lifecycle") {
    parts.push(state.selectedDataProcessId || "");
  }
  return parts.map(encodeAnchorPart).join(":");
}

function annotationRowLabelFromElement(element) {
  const row = element?.closest?.("tr, [data-capability-id], [data-maintenance-id]");
  if (!row) return "";
  return text(row.querySelector?.("strong")?.textContent || row.cells?.[1]?.textContent || row.textContent).trim();
}

function isAnnotationAnchorVisible(element) {
  if (!element || !element.isConnected) return false;
  const rect = element.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return false;
  const style = window.getComputedStyle(element);
  return style.display !== "none" && style.visibility !== "hidden" && Number(style.opacity || 1) !== 0;
}

function annotationElementCoordinate(element) {
  const node = element?.closest?.(ANNOTATION_CONTEXT_SELECTOR);
  if (!node) return "n0";
  const table = node.closest?.("table");
  if (table) {
    const nodeIsCell = node.matches?.(ANNOTATION_CELL_VALUE_SELECTOR);
    const row = node.closest("tr");
    const cell = nodeIsCell ? node : node.closest("td, th");
    const tableIndex = Array.from(document.querySelectorAll("table")).indexOf(table);
    const rowIndex = row ? Array.from(table.querySelectorAll("tbody tr, thead tr, tfoot tr, tr")).indexOf(row) : -1;
    const cellIndex = cell && row ? Array.from(row.children).indexOf(cell) : -1;
    const valueIndex =
      cell && node !== row
        ? nodeIsCell
          ? "cell"
          : Math.max(0, Array.from(cell.querySelectorAll(ANNOTATION_VALUE_SELECTOR)).indexOf(node))
        : -1;
    return `t${Math.max(0, tableIndex)}r${Math.max(0, rowIndex)}c${Math.max(0, cellIndex)}v${valueIndex === -1 ? 0 : valueIndex}`;
  }
  if (node.dataset?.capabilityId) {
    return `cap${Math.max(0, Array.from(document.querySelectorAll("[data-capability-id]")).indexOf(node))}`;
  }
  if (node.dataset?.maintenanceId) {
    return `mnt${Math.max(0, Array.from(document.querySelectorAll("[data-maintenance-id]")).indexOf(node))}`;
  }
  return `n${Math.max(0, Array.from(document.querySelectorAll(ANNOTATION_VALUE_SELECTOR)).indexOf(node))}`;
}

function fieldAnnotationId(value, element) {
  return `v2:${annotationContextId()}:${hashText(annotationRowLabelFromElement(element))}:${annotationElementCoordinate(element)}:${hashText(value)}`;
}

function rowAnnotationId(element, fallback = "") {
  const rowLabel = annotationRowLabelFromElement(element) || fallback;
  return `v2:${annotationContextId()}:${hashText(rowLabel)}:${annotationElementCoordinate(element)}`;
}

function buildBaseUserTarget({ objectType, objectLabel, id, code, title, anchorType = "object" }) {
  const normalizedType = text(objectType || "object").trim();
  const stableKey =
    normalizedType === "field_value" || normalizedType === "table_row" ? text(id || code).trim() : text(code || id).trim();
  if (!normalizedType || !stableKey) return null;
  return {
    targetRef: `base:${normalizedType}:${stableKey}`,
    objectType: normalizedType,
    objectLabel: objectLabel || "业务对象",
    id: id || stableKey,
    code: text(code),
    title: text(title || code || id || stableKey),
    anchorType,
  };
}

function capabilityUserTarget(viewModel) {
  const selected = viewModel?.selectedCapability || capabilityItemById(state.selectedCapabilityId);
  if (!selected?.id) return null;
  const objectType = selected.type || capabilityItemTypeById(selected.id) || "capability_object";
  return buildBaseUserTarget({
    objectType,
    objectLabel: capabilityUserObjectLabel(objectType),
    id: selected.id,
    code: selected.code,
    title: codeTitle(selected, "未命名能力对象"),
  });
}

function maintenanceUserObjectLabel(section, row) {
  const labels = {
    "capability-directory": row?.level === "L2" ? "安全能力" : "能力关注点",
    scopes: "安全能力作用域",
    services: "安全技术服务",
    modules: "安全技术模块",
    measures: "安全技术措施",
    "security-works": "安全工作",
    processes: "安全流程",
    "work-functions": "安全职能",
    references: row?.referenceType || "岗位 / 职能参考",
    "application-systems": "应用系统",
    "lcap-references": "LC-AP 参考对象",
    standards: "标准控制项",
  };
  return labels[section] || "知识库对象";
}

function maintenanceUserObjectType(section, row) {
  if (section === "capability-directory") return row?.level === "L2" ? "capability" : "capability_focus";
  const types = {
    scopes: "scope_type",
    services: "security_technical_service",
    modules: "security_technology_module",
    measures: "security_technical_measure",
    "security-works": "security_work",
    processes: "process_reference",
    "work-functions": "work_function",
    references: row?.referenceKind === "role" ? "work_role_reference" : "gbt_42446_task_reference",
    "application-systems": "application_system_type",
    "lcap-references": "lifecycle_reference",
    standards: "standard_control",
  };
  return types[section] || "knowledge_object";
}

function maintenanceRowCode(row = {}, section = "") {
  if (section === "standards") {
    const values = row.values || {};
    return values["保护措施编号"] || values["控制ID"] || values["控制项ID"] || values["ID"] || row.id;
  }
  return row.code || row.displayCode || row.serviceCode || row.id;
}

function maintenanceRowTitle(row = {}, section = "") {
  if (section === "standards") {
    const values = row.values || {};
    return values["名称"] || values["控制名称"] || values["等保三级控制要求"] || values["描述"] || maintenanceRowCode(row, section);
  }
  return row.serviceLabel || row.processReference || row.title || row.name || row.description || maintenanceRowCode(row, section);
}

function maintenanceUserTarget(viewModel) {
  if (!viewModel) return null;
  if (viewModel.section === "standards") {
    const row = list(viewModel.rows).find((item) => item.id === viewModel.selectedId);
    if (row) {
      return buildBaseUserTarget({
        objectType: "standard_control",
        objectLabel: "标准控制项",
        id: row.id,
        code: maintenanceRowCode(row, "standards"),
        title: maintenanceRowTitle(row, "standards"),
      });
    }
    return buildBaseUserTarget({
      objectType: "standard_framework",
      objectLabel: "标准 / 框架",
      id: viewModel.activeFrameworkId,
      code: viewModel.activeFrameworkId,
      title: viewModel.activeFrameworkTitle || "标准 / 框架",
    });
  }
  const row = list(viewModel.rows).find((item) => item.id === viewModel.selectedId);
  if (!row) return null;
  return buildBaseUserTarget({
    objectType: maintenanceUserObjectType(viewModel.section, row),
    objectLabel: maintenanceUserObjectLabel(viewModel.section, row),
    id: row.id,
    code: maintenanceRowCode(row, viewModel.section),
    title: maintenanceRowTitle(row, viewModel.section),
  });
}

function annotationTargetFromDataset(node) {
  const targetRef = text(node?.dataset?.annotationTargetRef).trim();
  if (!targetRef) return null;
  const title =
    text(node.dataset.annotationTitle || node.dataset.annotationTooltip || node.getAttribute("title")).trim() ||
    text(node.querySelector?.("strong")?.textContent || node.textContent).trim() ||
    targetRef;
  return {
    targetRef,
    objectType: text(node.dataset.annotationObjectType || "knowledge_object").trim(),
    objectLabel: text(node.dataset.annotationObjectLabel || "业务对象").trim(),
    id: text(node.dataset.annotationObjectId || targetRef).trim(),
    code: text(node.dataset.annotationObjectCode || "").trim(),
    title,
    anchorType: text(node.dataset.annotationAnchorType || "object").trim(),
  };
}

function applyAnnotationTargetDataset(node, target, { title = "" } = {}) {
  if (!node || !target?.targetRef) return;
  const targetTitle = text(title || target.title || target.code || target.id || target.targetRef).trim();
  node.dataset.annotationTargetRef = target.targetRef;
  node.dataset.annotationAnchorType = target.anchorType || "object";
  node.dataset.annotationObjectType = target.objectType || "knowledge_object";
  node.dataset.annotationObjectLabel = target.objectLabel || "业务对象";
  node.dataset.annotationObjectId = target.id || "";
  node.dataset.annotationObjectCode = target.code || "";
  node.dataset.annotationTitle = targetTitle;
  node.dataset.annotationTooltip = targetTitle;
  if (targetTitle && !node.getAttribute("title")) node.setAttribute("title", targetTitle);
}

function hydrateMaintenanceAnnotationTargets(viewModel) {
  const root = $("sourceList");
  if (!root || !viewModel?.section) return;
  const rows = list(viewModel.rows);
  if (!rows.length) return;
  const rowById = new Map(rows.map((row) => [text(row.id).trim(), row]).filter(([id]) => id));
  root.querySelectorAll("[data-maintenance-id]").forEach((node) => {
    const id = text(node.dataset.maintenanceId).trim();
    const row = rowById.get(id);
    if (!row) return;
    const target = buildBaseUserTarget({
      objectType: maintenanceUserObjectType(viewModel.section, row),
      objectLabel: maintenanceUserObjectLabel(viewModel.section, row),
      id: row.id,
      code: maintenanceRowCode(row, viewModel.section),
      title: maintenanceRowTitle(row, viewModel.section),
      anchorType: "object",
    });
    applyAnnotationTargetDataset(node, target, { title: maintenanceRowTitle(row, viewModel.section) });
  });
}

function contentUserTarget(selected, routeInfo = {}) {
  if (selected) {
    return buildBaseUserTarget({
      objectType: "security_guide",
      objectLabel: "安全指南",
      id: selected.id,
      code: selected.route || selected.id,
      title: selected.title || selected.route || selected.id,
    });
  }
  if (state.activeRoute.startsWith("/guides/")) {
    const item = routeInfo.item || {};
    return buildBaseUserTarget({
      objectType: "security_guide",
      objectLabel: "安全指南",
      id: state.activeRoute,
      code: state.activeRoute,
      title: item.label || routeInfo.description || state.activeRoute,
    });
  }
  return null;
}

function contentSlideUserTarget(row, slide, slideIndex = 0) {
  if (!row || !slide) return null;
  const pageNumber = Number(slide.pageNumber || slide.slide_number || slideIndex + 1) || slideIndex + 1;
  const guideTitle = text(row.title || row.route || row.id || "安全指南").trim();
  return buildBaseUserTarget({
    objectType: "security_guide_slide",
    objectLabel: "幻灯片页",
    id: `${row.id || row.route || state.activeRoute}:slide:${pageNumber}`,
    code: `${row.id || row.route || state.activeRoute}#${pageNumber}`,
    title: `${guideTitle} 第 ${pageNumber} 页`,
    anchorType: "object",
  });
}

function renderActiveUserActionScope() {
  if (state.activeView === "maintenance") {
    renderMaintenance();
    return;
  }
  if (state.activeView === "content") {
    renderContent();
    return;
  }
  renderCapabilities();
}

function currentPageAnnotationTarget(pageTitleOverride = "") {
  const pageTitle =
    text(pageTitleOverride).trim() ||
    text(document.querySelector("#appPageHeader h1")?.textContent).trim() ||
    text(document.querySelector(".page-title-copy h1")?.textContent).trim() ||
    (state.activeView === "content" ? text(document.querySelector("#contentPageTitle")?.textContent).trim() : "") ||
    (state.activeView === "content" ? text(document.querySelector("#contentNavTitle")?.textContent).trim() : "") ||
    state.activeRoute ||
    "当前页面";
  return {
    targetRef: `page:${state.activeRoute || "/"}`,
    objectType: "page",
    objectLabel: "页面",
    id: state.activeRoute || "/",
    code: state.activeRoute || "/",
    title: pageTitle,
    tags: [pageTitle, "页面"],
  };
}

function annotationTargetFromElement(element) {
  if (!element || element.closest?.("[data-annotation-drawer], [data-annotation-context-menu], input, textarea, select")) return null;
  const valueNode = element.closest?.(ANNOTATION_VALUE_SELECTOR);
  if (valueNode) {
    const value = annotationValueText(valueNode);
    if (value) {
      return buildBaseUserTarget({
        objectType: "field_value",
        objectLabel: "选中值",
        id: fieldAnnotationId(value, valueNode),
        code: value,
        title: value,
        anchorType: "field",
      });
    }
  }
  const cellNode = annotationCellValueNode(element);
  if (cellNode) {
    const value = annotationCellValueText(cellNode);
    if (value) {
      return buildBaseUserTarget({
        objectType: "field_value",
        objectLabel: "选中值",
        id: fieldAnnotationId(value, cellNode),
        code: value,
        title: value,
        anchorType: "field",
      });
    }
  }
  const stableTargetNode = element.closest?.(ANNOTATION_TARGET_REF_SELECTOR);
  const stableTarget = annotationTargetFromDataset(stableTargetNode);
  if (stableTarget) return stableTarget;
  const capabilityRow = element.closest?.("[data-capability-id]");
  if (capabilityRow) {
    const id = capabilityRow.dataset.capabilityId;
    const item = capabilityItemById(id);
    const objectType = item?.type || capabilityItemTypeById(id) || "capability_object";
    return buildBaseUserTarget({
      objectType,
      objectLabel: capabilityUserObjectLabel(objectType),
      id,
      code: item?.code || id,
      title: codeTitle(item || { id, code: id }, text(capabilityRow.textContent).trim() || id),
      anchorType: "row",
    });
  }
  const maintenanceRow = element.closest?.("[data-maintenance-id]");
  if (maintenanceRow) {
    const id = maintenanceRow.dataset.maintenanceId;
    const title = text(maintenanceRow.querySelector("strong")?.textContent || maintenanceRow.textContent).trim();
    return buildBaseUserTarget({
      objectType: "table_row",
      objectLabel: "表格行",
      id: rowAnnotationId(maintenanceRow, id),
      code: id,
      title: title || id,
      anchorType: "row",
    });
  }
  const tableRow = element.closest?.("tr");
  if (tableRow && tableRow.closest?.("table")) {
    const title = text(tableRow.querySelector("strong")?.textContent || tableRow.cells?.[1]?.textContent || tableRow.textContent).trim();
    if (title) {
      return buildBaseUserTarget({
        objectType: "table_row",
        objectLabel: "表格行",
        id: rowAnnotationId(tableRow, title),
        code: title,
        title,
        anchorType: "row",
      });
    }
  }
  return null;
}

function targetRefForAnnotationTarget(target) {
  return text(target?.targetRef).trim();
}

function clearAnnotationAnchorState() {
  document
    .querySelectorAll(
      [
        "[data-user-note-anchor-marked='true']",
        "[data-user-note-anchor-active='true']",
        "[data-user-note-anchor-cell-marked='true']",
        "[data-user-note-anchor-cell-active='true']",
        "[data-user-note-anchor-row-marked='true']",
        "[data-user-note-anchor-row-active='true']",
      ].join(","),
    )
    .forEach((node) => {
      node.removeAttribute("data-user-note-anchor-marked");
      node.removeAttribute("data-user-note-anchor-active");
      node.removeAttribute("data-user-note-anchor-cell-marked");
      node.removeAttribute("data-user-note-anchor-cell-active");
      node.removeAttribute("data-user-note-anchor-row-marked");
      node.removeAttribute("data-user-note-anchor-row-active");
      node.removeAttribute("data-user-note-count");
    });
}

function normalizedAnnotationAnchorType(anchorType = "") {
  const type = text(anchorType).trim();
  if (type === "value") return "field";
  if (["field", "row", "cell", "column", "area", "object", "relation"].includes(type)) return type;
  return "";
}

function annotationAnchorTypeFromTargetRef(targetRef = "") {
  const ref = text(targetRef).trim();
  if (ref.startsWith("base:field_value:")) return "field";
  if (ref.startsWith("base:table_row:")) return "row";
  return "";
}

function canonicalAnnotationRoute(route = "") {
  const normalized = text(route).trim() || "/";
  const aliases = {
    "/knowledge/technical-modules": "/knowledge/technical",
    "/knowledge/technical-measures": "/knowledge/technical",
  };
  return aliases[normalized] || normalized;
}

function annotationNoteMatchesCurrentPage(note, pageRoute = "") {
  const noteRoute = canonicalAnnotationRoute(note?.page_route);
  const currentRoute = canonicalAnnotationRoute(pageRoute || state.activeRoute || "/");
  if (!noteRoute || noteRoute !== currentRoute) return false;
  const meta = legacyAnnotationTargetMeta(note?.target_ref);
  if (!meta || meta.view !== "maintenance") return true;
  const maintenancePage = decodeLegacyAnchorPart(meta.context?.[2] || "");
  return !maintenancePage || maintenancePage === "_" || maintenancePage === state.activeMaintenancePage;
}

function scheduleAnnotationAnchorMarkers(reason = "", { delays = [0, 80, 240] } = {}) {
  if (state.annotationMarkerFrame) window.cancelAnimationFrame(state.annotationMarkerFrame);
  state.annotationMarkerTimers.forEach((timer) => window.clearTimeout(timer));
  state.annotationMarkerTimers = [];
  const run = () => {
    state.annotationMarkerFrame = 0;
    applyAnnotationAnchorMarkers();
  };
  state.annotationMarkerFrame = window.requestAnimationFrame(run);
  state.annotationMarkerTimers = delays
    .filter((delay) => delay > 0)
    .map((delay) =>
      window.setTimeout(() => {
        applyAnnotationAnchorMarkers();
      }, delay),
    );
}

function setupAnnotationSurfaceObserver() {
  state.annotationSurfaceObserver?.disconnect?.();
  if (typeof MutationObserver !== "function") return;
  const roots = [
    "capabilityWorkspace",
    "environmentWorkspace",
    "devLifecycleWorkspace",
    "dataLifecycleWorkspace",
    "maintenanceWorkspace",
    "contentWorkspace",
    "overviewWorkspace",
  ]
    .map((id) => $(id))
    .filter(Boolean);
  if (!roots.length) return;
  state.annotationSurfaceObserver = new MutationObserver((mutations) => {
    const changed = mutations.some((mutation) => {
      if (mutation.type !== "childList") return false;
      const target = mutation.target;
      if (target?.closest?.("[data-annotation-drawer], [data-annotation-context-menu]")) return false;
      return mutation.addedNodes.length || mutation.removedNodes.length;
    });
    if (changed) scheduleAnnotationAnchorMarkers("surface-dom-mutated", { delays: [0, 80, 240, 520] });
  });
  roots.forEach((root) => {
    state.annotationSurfaceObserver.observe(root, { childList: true, subtree: true });
  });
}

function fieldAnnotationAnchorElement(node, note = null) {
  if (!node) return null;
  if (node.matches?.(ANNOTATION_VALUE_SELECTOR)) return node;
  const valueNodes = Array.from(node.querySelectorAll?.(ANNOTATION_VALUE_SELECTOR) || []).filter(isAnnotationAnchorVisible);
  if (valueNodes.length) return note ? bestAnnotationCandidate(valueNodes, note, 1) || valueNodes[0] : valueNodes[0];
  const cell = node.matches?.("td, th") ? node : node.closest?.("td, th");
  if (cell && !cell.querySelector?.(ANNOTATION_VALUE_SELECTOR) && annotationCellValueText(cell)) return cell;
  return node;
}

function annotationRevealScrollElement(node, note = null) {
  const anchorType = normalizedAnnotationAnchorType(note?.anchor_type || annotationAnchorTypeFromTargetRef(note?.target_ref));
  const anchor = anchorType === "field" || anchorType === "value" ? fieldAnnotationAnchorElement(node, note) : node;
  return anchor?.querySelector?.(".line-text, .relation-chip-text, strong") || anchor || node;
}

function markAnnotationAnchorContext(node, stateName = "marked", anchorType = "", note = null) {
  if (!node) return;
  const isActive = stateName === "active";
  const type = normalizedAnnotationAnchorType(anchorType);
  const anchorAttr = isActive ? "data-user-note-anchor-active" : "data-user-note-anchor-marked";
  const cellAttr = isActive ? "data-user-note-anchor-cell-active" : "data-user-note-anchor-cell-marked";
  const rowAttr = isActive ? "data-user-note-anchor-row-active" : "data-user-note-anchor-row-marked";
  const cell = node.closest?.("td, th");
  const row = node.closest?.("tr");
  if (type === "field" || type === "value") {
    fieldAnnotationAnchorElement(node, note)?.setAttribute(anchorAttr, "true");
    return;
  }
  if (type === "row") {
    (row || node).setAttribute(row ? rowAttr : anchorAttr, "true");
    return;
  }
  if (type === "cell" || type === "column" || type === "area") {
    (cell || node).setAttribute(cell ? cellAttr : anchorAttr, "true");
    return;
  }
  node.setAttribute(anchorAttr, "true");
  if (cell && node !== cell) cell.setAttribute(cellAttr, "true");
  if (row && node !== row) row.setAttribute(rowAttr, "true");
}

function applyAnnotationAnchorMarkers() {
  clearAnnotationAnchorState();
  const pageRoute = text((state.activePageAnnotationTarget || currentPageAnnotationTarget()).code).trim();
  const noteCounts = new Map();
  const noteAnchorTypes = new Map();
  for (const note of list(state.userNotes)) {
    if (!annotationNoteMatchesCurrentPage(note, pageRoute)) continue;
    const targetRef = text(note.target_ref).trim();
    if (!targetRef || targetRef.startsWith("page:")) continue;
    noteCounts.set(targetRef, (noteCounts.get(targetRef) || 0) + 1);
    if (!noteAnchorTypes.has(targetRef)) {
      noteAnchorTypes.set(targetRef, note.anchor_type || annotationAnchorTypeFromTargetRef(targetRef));
    }
  }
  if (!noteCounts.size) return;
  const markedTargetRefs = new Set();

  const mark = (node, targetRef, preferredAnchorType = "") => {
    const count = noteCounts.get(targetRef);
    if (!node || !count) return;
    const anchorType = preferredAnchorType || noteAnchorTypes.get(targetRef) || annotationAnchorTypeFromTargetRef(targetRef);
    markAnnotationAnchorContext(node, "marked", anchorType);
    markedTargetRefs.add(targetRef);
  };

  document.querySelectorAll(ANNOTATION_TARGET_REF_SELECTOR).forEach((node) => {
    if (node.closest("[data-annotation-drawer]")) return;
    if (!isAnnotationAnchorVisible(node)) return;
    const targetRef = text(node.dataset.annotationTargetRef).trim();
    if (!targetRef) return;
    mark(node, targetRef, node.dataset.annotationAnchorType || "object");
  });

  document.querySelectorAll(ANNOTATION_VALUE_SELECTOR).forEach((node) => {
    if (!isAnnotationAnchorVisible(node)) return;
    const value = annotationValueText(node);
    if (!value) return;
    if (!node.getAttribute("title")) node.setAttribute("title", value);
    if (!node.dataset.annotationTooltip) node.dataset.annotationTooltip = value;
    mark(node, `base:field_value:${fieldAnnotationId(value, node)}`);
  });
  document.querySelectorAll(ANNOTATION_CELL_VALUE_SELECTOR).forEach((node) => {
    if (node.closest("[data-annotation-drawer]")) return;
    if (node.querySelector(ANNOTATION_VALUE_SELECTOR)) return;
    if (!isAnnotationAnchorVisible(node)) return;
    const value = annotationCellValueText(node);
    if (!value) return;
    if (!node.getAttribute("title")) node.setAttribute("title", value);
    if (!node.dataset.annotationTooltip) node.dataset.annotationTooltip = value;
    mark(node, `base:field_value:${fieldAnnotationId(value, node)}`);
  });
  document.querySelectorAll("[data-capability-id]").forEach((node) => {
    if (!isAnnotationAnchorVisible(node)) return;
    const id = node.dataset.capabilityId;
    const item = capabilityItemById(id);
    const objectType = item?.type || capabilityItemTypeById(id) || "capability_object";
    const targetRef = targetRefForAnnotationTarget(
      buildBaseUserTarget({
        objectType,
        objectLabel: capabilityUserObjectLabel(objectType),
        id,
        code: item?.code || id,
        title: codeTitle(item || { id, code: id }, id),
        anchorType: "row",
      }),
    );
    mark(node, targetRef);
  });
  document.querySelectorAll("[data-maintenance-id]").forEach((node) => {
    if (!isAnnotationAnchorVisible(node)) return;
    const id = node.dataset.maintenanceId;
    mark(node, `base:table_row:${rowAnnotationId(node, id)}`);
  });
  document.querySelectorAll("tr").forEach((node) => {
    if (node.closest("[data-annotation-drawer]")) return;
    if (!isAnnotationAnchorVisible(node)) return;
    const title = text(node.querySelector("strong")?.textContent || node.cells?.[1]?.textContent || node.textContent).trim();
    if (!title) return;
    mark(node, `base:table_row:${rowAnnotationId(node, title)}`);
  });
  for (const note of list(state.userNotes)) {
    if (!annotationNoteMatchesCurrentPage(note, pageRoute)) continue;
    const targetRef = text(note.target_ref).trim();
    if (!targetRef || targetRef.startsWith("page:") || markedTargetRefs.has(targetRef)) continue;
    if (!annotationTargetContextMatchesCurrent(note)) continue;
    const fallbackAnchor = candidateFromLegacyCoordinate(note) || findAnnotationAnchorElementByNoteText(note);
    if (!fallbackAnchor) continue;
      markAnnotationAnchorContext(fallbackAnchor, "marked", note.anchor_type || annotationAnchorTypeFromTargetRef(targetRef), note);
      markedTargetRefs.add(targetRef);
    }
}

function findAnnotationAnchorElement(note, { includeHidden = false } = {}) {
  const targetRef = text(note?.target_ref).trim();
  if (!targetRef || targetRef.startsWith("page:")) return null;
  if (targetRef.startsWith("base:capability:")) {
    const legacyCapabilityKey = targetRef.replace(/^base:capability:/, "");
    const item = capabilityItemByCodeOrTitle(legacyCapabilityKey || note?.object_title);
    if (item?.id && item.id === state.selectedCapabilityId) {
      const treeNode = Array.from(document.querySelectorAll("[data-capability-id]")).find((node) => node.dataset.capabilityId === item.id);
      return treeNode || document.querySelector("#capabilityFocusHeader");
    }
  }
  for (const node of document.querySelectorAll(ANNOTATION_TARGET_REF_SELECTOR)) {
    if (node.closest("[data-annotation-drawer]")) continue;
    if (!includeHidden && !isAnnotationAnchorVisible(node)) continue;
    if (text(node.dataset.annotationTargetRef).trim() === targetRef) return node;
  }
  for (const node of document.querySelectorAll(ANNOTATION_VALUE_SELECTOR)) {
    if (!includeHidden && !isAnnotationAnchorVisible(node)) continue;
    const value = annotationValueText(node);
    if (!value) continue;
    if (`base:field_value:${fieldAnnotationId(value, node)}` === targetRef) return node;
  }
  for (const node of document.querySelectorAll(ANNOTATION_CELL_VALUE_SELECTOR)) {
    if (node.closest("[data-annotation-drawer]")) continue;
    if (node.querySelector(ANNOTATION_VALUE_SELECTOR)) continue;
    if (!includeHidden && !isAnnotationAnchorVisible(node)) continue;
    const value = annotationCellValueText(node);
    if (!value) continue;
    if (`base:field_value:${fieldAnnotationId(value, node)}` === targetRef) return node;
  }
  for (const node of document.querySelectorAll("[data-capability-id]")) {
    if (!includeHidden && !isAnnotationAnchorVisible(node)) continue;
    const id = node.dataset.capabilityId;
    const item = capabilityItemById(id);
    const legacyCapabilityCode = targetRef.startsWith("base:capability:") ? targetRef.replace(/^base:capability:/, "") : "";
    if (
      legacyCapabilityCode &&
      [id, item?.code, codeTitle(item || { id }, id)]
        .map(compactAnnotationLookupText)
        .some((candidate) => candidate && candidate === compactAnnotationLookupText(legacyCapabilityCode))
    ) {
      return node;
    }
    const objectType = item?.type || capabilityItemTypeById(id) || "capability_object";
    const candidate = targetRefForAnnotationTarget(
      buildBaseUserTarget({
        objectType,
        objectLabel: capabilityUserObjectLabel(objectType),
        id,
        code: item?.code || id,
        title: codeTitle(item || { id, code: id }, id),
        anchorType: "row",
      }),
    );
    if (candidate === targetRef) return node;
  }
  for (const node of document.querySelectorAll("[data-maintenance-id]")) {
    if (!includeHidden && !isAnnotationAnchorVisible(node)) continue;
    const id = node.dataset.maintenanceId;
    if (`base:table_row:${rowAnnotationId(node, id)}` === targetRef) return node;
  }
  for (const node of document.querySelectorAll("tr")) {
    if (node.closest("[data-annotation-drawer]")) continue;
    if (!includeHidden && !isAnnotationAnchorVisible(node)) continue;
    const label = text(node.querySelector("strong")?.textContent || node.cells?.[1]?.textContent || node.textContent).trim();
    if (!label) continue;
    if (`base:table_row:${rowAnnotationId(node, label)}` === targetRef) return node;
  }
  if (!annotationTargetContextMatchesCurrent(note)) return null;
  return candidateFromLegacyCoordinate(note, { includeHidden }) || findAnnotationAnchorElementByNoteText(note, { includeHidden });
}

function restoreAnnotationContextFromNote(note) {
  const targetRef = text(note?.target_ref).trim();
  const parts = targetRef.split(":");
  if (parts[0] !== "base") return false;
  const slideChanged = restoreGuideSlideContextFromNote(note);
  if (slideChanged) return true;
  if (parts[2] !== "v2") {
    if (state.activeView !== "capabilities") return false;
    const item = capabilityItemByCodeOrTitle(parts.slice(2).join(":") || note?.object_title);
    if (!item?.id || item.id === state.selectedCapabilityId) return false;
    state.selectedCapabilityId = item.id;
    state.capabilityCatalogCollapsed = false;
    capabilityAncestorIds(item.id).forEach((id) => state.expandedCapabilityIds.add(id));
    state.expandedSelectionId = item.id;
    return true;
  }
  if (parts.length < 5) return false;
  const payload = parts[2] === "v2" ? parts.slice(3) : parts.slice(2);
  const decoded = payload.map((item) => {
    try {
      return decodeURIComponent(item);
    } catch {
      return item;
    }
  });
  const view = decoded[1] || "";
  let changed = false;
  if (view === "capabilities") {
    const capabilityId = decoded[2] === "_" ? "" : decoded[2];
    const tab = decoded[3] === "_" ? "" : decoded[3];
    if (capabilityId && capabilityId !== state.selectedCapabilityId) {
      state.selectedCapabilityId = capabilityId;
      state.capabilityCatalogCollapsed = false;
      capabilityAncestorIds(capabilityId).forEach((id) => state.expandedCapabilityIds.add(id));
      state.expandedSelectionId = capabilityId;
      changed = true;
    }
    if (capabilityId && capabilityItemTypeById(capabilityId) === "capability_focus") {
      ensureCapabilityProjectionForFocus(capabilityId);
    }
    if (tab && tab !== state.activeCapabilityRelationTab) {
      state.activeCapabilityRelationTab = tab;
      changed = true;
    }
  } else if (view === "maintenance") {
    const maintenancePage = decoded[2] === "_" ? "" : decoded[2];
    const referenceTab = decoded[3] === "_" ? "" : decoded[3];
    const framework = decoded[4] === "_" ? "" : decoded[4];
    const tableId = decoded[5] === "_" ? "" : decoded[5];
    if (maintenancePage && maintenancePage !== state.activeMaintenancePage) {
      state.activeMaintenancePage = maintenancePage;
      changed = true;
    }
    if (referenceTab && referenceTab !== state.activeReferenceTab) state.activeReferenceTab = referenceTab;
    if (framework && framework !== state.activeStandardFramework) state.activeStandardFramework = framework;
    if (tableId && tableId !== state.activeStandardTableId) state.activeStandardTableId = tableId;
  } else if (view === "content") {
    const contentPage = decoded[2] === "_" ? "" : decoded[2];
    const contentId = decoded[3] === "_" ? "" : decoded[3];
    const slideIndex = Number(decoded[4]);
    if (contentPage && contentPage !== state.activeContentPage) {
      state.activeContentPage = contentPage;
      changed = true;
    }
    if (contentId && contentId !== state.selectedContentId) {
      state.selectedContentId = contentId;
      changed = true;
    }
    if (Number.isFinite(slideIndex) && slideIndex !== state.selectedContentSlideIndex) {
      state.selectedContentSlideIndex = slideIndex;
      changed = true;
    }
  } else if (view === "dev-lifecycle") {
    const processId = decoded[2] === "_" ? "" : decoded[2];
    if (processId && processId !== state.selectedDevProcessId) {
      state.selectedDevProcessId = processId;
      changed = true;
    }
  } else if (view === "data-lifecycle") {
    const processId = decoded[2] === "_" ? "" : decoded[2];
    if (processId && processId !== state.selectedDataProcessId) {
      state.selectedDataProcessId = processId;
      changed = true;
    }
  }
  return changed;
}

function annotationStandardFrameworkForNote(note = {}) {
  const target = compactAnnotationLookupText(note.object_title || note.object_code || "");
  if (!target) return null;
  return (
    list(state.standards?.frameworks).find((framework) =>
      [framework?.id, framework?.title, framework?.frameworkCode, framework?.code]
        .map(compactAnnotationLookupText)
        .some((candidate) => candidate && (candidate === target || candidate.includes(target) || target.includes(candidate))),
    ) || null
  );
}

function standardFrameworkRowsLoaded(frameworkId) {
  const loaded = loadedStandardFramework(frameworkId) || standardFrameworkIndexById(frameworkId);
  return standardTablesForFramework(loaded).some((table) => list(table.rows).length);
}

function promiseWithTimeout(promise, timeoutMs = 3200) {
  if (!promise?.then) return Promise.resolve(promise);
  return new Promise((resolve) => {
    const timer = window.setTimeout(() => resolve(null), timeoutMs);
    promise
      .then((value) => resolve(value))
      .catch(() => resolve(null))
      .finally(() => window.clearTimeout(timer));
  });
}

function ensureStandardFrameworkLoadedForAnnotationNote(note) {
  const loadKey = `annotationStandardFramework:${compactAnnotationLookupText(note.object_title || note.object_code || "")}`;
  if (state.annotationContextLoads.has(loadKey)) return state.annotationContextLoads.get(loadKey);
  const run = async () => {
    if (!state.loadedPackages.has("standards")) await loadDataPackage("standards");
    const framework = annotationStandardFrameworkForNote(note);
    if (!framework?.id || standardFrameworkRowsLoaded(framework.id)) return;
    const dataClient = window.sapdDataClient;
    await dataClient
      ?.getStandardFramework?.(framework.id)
      .then((envelope) => {
        const loadedFramework = envelope?.data;
        if (!loadedFramework) return;
        state.standards = {
          ...(state.standards || {}),
          loadedFrameworks: {
            ...(state.standards?.loadedFrameworks || {}),
            [framework.id]: loadedFramework,
          },
        };
      });
  };
  const load = promiseWithTimeout(run()).finally(() => {
    state.annotationContextLoads.delete(loadKey);
  });
  state.annotationContextLoads.set(loadKey, load);
  return load;
}

function annotationContextLoadPromiseForNote(note) {
  const meta = legacyAnnotationTargetMeta(note?.target_ref);
  if (!meta || meta.view !== "capabilities") return Promise.resolve();
  const capabilityId = decodeLegacyAnchorPart(meta.context?.[2] || "");
  const loads = [ensureStandardFrameworkLoadedForAnnotationNote(note)];
  if (capabilityId && capabilityId !== "_" && capabilityItemTypeById(capabilityId) === "capability_focus") {
    loads.push(ensureCapabilityProjectionForFocus(capabilityId));
  }
  return Promise.all(loads);
}

function expandAnnotationHiddenLineage(anchor) {
  const table = anchor?.closest?.("table");
  const row = anchor?.closest?.("tr");
  if (!table || !row) return false;
  const lineage = text(row.dataset?.standardLineage)
    .split(/\s+/)
    .map((item) => item.trim())
    .filter(Boolean);
  const groupRows = Array.from(table.querySelectorAll(".standard-group-row[data-standard-group]"));
  const rows = Array.from(table.querySelectorAll("[data-standard-parent]"));
  for (const groupId of lineage) {
    const groupRow = groupRows.find((candidate) => candidate.dataset.standardGroup === groupId);
    if (groupRow) {
      groupRow.hidden = false;
      groupRow.classList.add("expanded");
      groupRow.querySelector(".standard-group-toggle")?.setAttribute("aria-expanded", "true");
    }
    rows.filter((candidate) => candidate.dataset.standardParent === groupId).forEach((candidate) => {
      candidate.hidden = false;
    });
  }
  row.hidden = false;
  if (lineage.length) scheduleAnnotationAnchorMarkers("expand-annotation-hidden-lineage", { delays: [0, 80] });
  return Boolean(lineage.length);
}

function resolveAnnotationAnchorElement(note) {
  const visibleAnchor = findAnnotationAnchorElement(note);
  if (visibleAnchor) return visibleAnchor;
  const hiddenAnchor = findAnnotationAnchorElement(note, { includeHidden: true });
  if (!hiddenAnchor) return null;
  expandAnnotationHiddenLineage(hiddenAnchor);
  return findAnnotationAnchorElement(note) || hiddenAnchor;
}

function jumpToUserNote(noteId) {
  const note = list(state.userNotes).find((row) => text(row.id).trim() === text(noteId).trim());
  if (!note) return;
  const route = text(note.page_route).trim();
  const clearActiveAnchor = (anchor) => {
    window.setTimeout(() => {
      anchor.removeAttribute("data-user-note-anchor-active");
      anchor.closest?.("td, th")?.removeAttribute("data-user-note-anchor-cell-active");
      anchor.closest?.("tr")?.removeAttribute("data-user-note-anchor-row-active");
      scheduleAnnotationAnchorMarkers("clear-active-after-jump", { delays: [0, 80] });
    }, 2600);
  };
  const isCoveredByOpenDrawer = (anchor) => {
    if (!state.userAnnotationDrawerOpen || !anchor) return false;
    const panel = document.querySelector(".user-annotation-drawer.is-open .annotation-drawer-panel");
    if (!panel) return false;
    const anchorRect = anchor.getBoundingClientRect();
    const panelRect = panel.getBoundingClientRect();
    return anchorRect.right > panelRect.left - 12 && anchorRect.left < panelRect.right && anchorRect.bottom > panelRect.top && anchorRect.top < panelRect.bottom;
  };
  const revealAnchor = (anchor) => {
    const anchorType = note.anchor_type || annotationAnchorTypeFromTargetRef(note.target_ref);
    markAnnotationAnchorContext(anchor, "active", anchorType, note);
    const scrollTarget = annotationRevealScrollElement(anchor, note);
    scrollTarget?.scrollIntoView?.({ behavior: "smooth", block: "center", inline: "nearest" });
    [180, 520, 980].forEach((delay) => {
      window.setTimeout(() => {
        const current = resolveAnnotationAnchorElement(note) || anchor;
        markAnnotationAnchorContext(current, "active", anchorType, note);
      }, delay);
    });
    clearActiveAnchor(anchor);
  };
  const doJump = () => {
    const changed = restoreAnnotationContextFromNote(note);
    const pendingContextLoad = annotationContextLoadPromiseForNote(note);
    if (changed) renderActiveView();
    let revealed = false;
    const resolveAndReveal = (attempt = 0) => {
      applyAnnotationAnchorMarkers();
      const anchor = resolveAnnotationAnchorElement(note);
      if (!anchor) {
        if (attempt < 28) {
          window.setTimeout(() => resolveAndReveal(attempt + 1), 160);
          return;
        }
        if (text(note.target_ref).trim().startsWith("page:")) {
          document.querySelector(".workspace-stage")?.scrollIntoView?.({ behavior: "smooth", block: "start" });
        }
        return;
      }
      revealed = true;
      if (isCoveredByOpenDrawer(anchor)) {
        state.userAnnotationDrawerOpen = false;
        renderUserAnnotationDrawer({ preserveScroll: true });
        requestAnimationFrame(() => {
          scheduleAnnotationAnchorMarkers("jump-drawer-covered", { delays: [0, 80] });
          revealAnchor(resolveAnnotationAnchorElement(note) || anchor);
        });
        return;
      }
      revealAnchor(anchor);
    };
    pendingContextLoad?.then?.(() => {
      if (revealed || (route && route !== state.activeRoute)) return;
      renderActiveView();
      scheduleAnnotationAnchorMarkers("jump-context-loaded", { delays: [0, 80, 240] });
      requestAnimationFrame(() => resolveAndReveal(0));
    });
    requestAnimationFrame(() => resolveAndReveal());
  };
  if (route && route !== state.activeRoute) {
    activateRoute(route);
    window.setTimeout(doJump, 260);
    return;
  }
  doJump();
}

function annotationTooltipTextFromTarget(target) {
  const node = target?.closest?.(
    [
      "[data-annotation-tooltip]",
      "[data-user-note-anchor-marked='true']",
      "[data-user-note-anchor-active='true']",
      "[data-user-note-anchor-cell-marked='true']",
      "[data-user-note-anchor-cell-active='true']",
      "[data-user-note-anchor-row-marked='true']",
      "[data-user-note-anchor-row-active='true']",
    ].join(","),
  );
  if (!node) return "";
  return text(node.dataset?.annotationTooltip || node.getAttribute("title") || node.dataset?.copyText || node.textContent).trim();
}

function annotationTooltipHost(target) {
  return target?.closest?.(
    [
      "[data-annotation-tooltip]",
      "[data-user-note-anchor-marked='true']",
      "[data-user-note-anchor-active='true']",
      "[data-user-note-anchor-cell-marked='true']",
      "[data-user-note-anchor-cell-active='true']",
      "[data-user-note-anchor-row-marked='true']",
      "[data-user-note-anchor-row-active='true']",
    ].join(","),
  );
}

function ensureAnnotationTooltip() {
  let tooltip = document.getElementById("annotationTooltip");
  if (tooltip) return tooltip;
  tooltip = document.createElement("div");
  tooltip.id = "annotationTooltip";
  tooltip.className = "annotation-tooltip";
  tooltip.hidden = true;
  document.body.appendChild(tooltip);
  return tooltip;
}

function showAnnotationTooltip(event) {
  const body = annotationTooltipTextFromTarget(event.target);
  if (!body) return;
  const tooltip = ensureAnnotationTooltip();
  tooltip.textContent = body;
  tooltip.hidden = false;
  positionAnnotationTooltip(event);
}

function positionAnnotationTooltip(event) {
  const tooltip = document.getElementById("annotationTooltip");
  if (!tooltip || tooltip.hidden) return;
  const margin = 12;
  const offset = 14;
  const rect = tooltip.getBoundingClientRect();
  const x = Math.min(window.innerWidth - rect.width - margin, Math.max(margin, event.clientX + offset));
  const y = Math.min(window.innerHeight - rect.height - margin, Math.max(margin, event.clientY + offset));
  tooltip.style.left = `${x}px`;
  tooltip.style.top = `${y}px`;
}

function hideAnnotationTooltip() {
  const tooltip = document.getElementById("annotationTooltip");
  if (tooltip) tooltip.hidden = true;
}

function setCurrentAnnotationTarget(target, options = {}) {
  const pageTarget = currentPageAnnotationTarget(options.pageTitle);
  state.activePageAnnotationTarget = pageTarget;
  state.activeUserTarget = target || pageTarget;
  if (!state.activeUserTarget?.tags?.length) {
    state.activeUserTarget = {
      ...state.activeUserTarget,
      tags: [state.activeUserTarget?.objectLabel, pageTarget.title].filter(Boolean),
    };
  }
  state.annotationContextMenu = null;
  requestAnimationFrame(() => renderUserAnnotationDrawer());
  scheduleAnnotationAnchorMarkers("set-current-annotation-target");
}

function hasUnsavedAnnotationDraft() {
  return Boolean(text(state.userAnnotationDraft).trim());
}

function resetAnnotationInteraction({ collapse = false, clearDraft = false } = {}) {
  if (collapse) state.userAnnotationDrawerOpen = false;
  if (clearDraft) {
    state.userAnnotationDraft = "";
    state.annotationDraftTarget = null;
    state.pendingAnnotationAction = null;
    state.pendingAnnotationTargetLabel = "";
  }
  state.annotationContextMenu = null;
  state.userAnnotationEditingNoteId = "";
  state.userAnnotationEditDraft = "";
  state.userWriteStatus = { ...state.userWriteStatus, draftGuard: false };
}

function requestAnnotationContextSwitch(action, label = "新页面") {
  if (!hasUnsavedAnnotationDraft()) {
    resetAnnotationInteraction({ collapse: true, clearDraft: true });
    action();
    return true;
  }
  state.pendingAnnotationAction = action;
  state.pendingAnnotationTargetLabel = label;
  state.userAnnotationDrawerOpen = true;
  state.userWriteStatus = { ...state.userWriteStatus, draftGuard: true };
  renderUserAnnotationDrawer();
  return false;
}

function runPendingAnnotationAction() {
  const action = state.pendingAnnotationAction;
  state.pendingAnnotationAction = null;
  state.pendingAnnotationTargetLabel = "";
  state.userWriteStatus = { ...state.userWriteStatus, draftGuard: false };
  state.userAnnotationDrawerOpen = false;
  state.userAnnotationDraft = "";
  state.userAnnotationEditingNoteId = "";
  state.userAnnotationEditDraft = "";
  if (typeof action === "function") action();
  else renderUserAnnotationDrawer();
}

function openAnnotationTarget(target) {
  if (!target?.targetRef) return;
  const action = () => {
    state.annotationDraftTarget = target;
    setCurrentAnnotationTarget(target);
    state.userAnnotationDrawerOpen = true;
    state.annotationContextMenu = null;
    renderUserAnnotationDrawer();
    requestAnimationFrame(() => document.querySelector("[data-user-note-draft]")?.focus?.());
  };
  const currentRef = text(state.activeUserTarget?.targetRef).trim();
  if (hasUnsavedAnnotationDraft() && currentRef && currentRef !== text(target.targetRef).trim()) {
    requestAnnotationContextSwitch(action, target.title || target.code || "当前选择");
    return;
  }
  action();
}

function openAnnotationContextMenu(event) {
  const target = annotationTargetFromElement(event.target);
  if (!target?.targetRef) return false;
  event.preventDefault();
  document.querySelectorAll("[data-annotation-anchor-selected='true']").forEach((node) => node.removeAttribute("data-annotation-anchor-selected"));
  const anchorNode =
    event.target.closest?.(ANNOTATION_CONTEXT_SELECTOR) || event.target;
  anchorNode?.setAttribute?.("data-annotation-anchor-selected", "true");
  state.annotationContextMenu = { x: event.clientX, y: event.clientY, target };
  renderUserAnnotationDrawer();
  return true;
}

function refreshUserFavoritesMap() {
  state.userFavoritesByRef = new Map(list(state.userFavorites).map((favorite) => [text(favorite.target_ref).trim(), favorite]));
}

function ensureUserFavoritesLoaded() {
  if (state.userFavoritesLoaded) return Promise.resolve();
  if (state.userFavoriteLoadPromise) return state.userFavoriteLoadPromise;
  const dataClient = window.sapdDataClient;
  if (!dataClient?.getUserFavorites) {
    state.userWriteStatus = { state: "api_unavailable", savingTargetRef: "" };
    state.userFavoritesLoaded = true;
    return Promise.resolve();
  }
  state.userWriteStatus = { ...state.userWriteStatus, state: "loading" };
  state.userFavoriteLoadPromise = dataClient
    .getUserFavorites()
    .then((envelope) => {
      const data = envelope?.data || {};
      state.userFavorites = list(data.favorites);
      refreshUserFavoritesMap();
      state.userWriteStatus = { state: data.ok === false ? data.data_state || "api_unavailable" : "ready", savingTargetRef: "" };
      state.userFavoritesLoaded = true;
    })
    .catch((error) => {
      console.warn("用户收藏加载失败", error);
      state.userWriteStatus = { state: "api_unavailable", savingTargetRef: "" };
      state.userFavoritesLoaded = true;
    })
    .finally(() => {
      state.userFavoriteLoadPromise = null;
      if (["capabilities", "maintenance", "content"].includes(state.activeView)) renderActiveUserActionScope();
    });
  return state.userFavoriteLoadPromise;
}

function ensureUserNotesLoaded() {
  if (state.userNotesLoaded) return Promise.resolve();
  if (state.userNotesLoadPromise) return state.userNotesLoadPromise;
  const dataClient = window.sapdDataClient;
  if (!dataClient?.getUserNotes) {
    state.userWriteStatus = { ...state.userWriteStatus, state: "api_unavailable", savingNote: false };
    state.userNotesLoaded = true;
    return Promise.resolve();
  }
  state.userWriteStatus = { ...state.userWriteStatus, state: "loading" };
  state.userNotesLoadPromise = dataClient
    .getUserNotes()
    .then((envelope) => {
      const data = envelope?.data || {};
      state.userNotes = list(data.notes);
      state.userWriteStatus = { ...state.userWriteStatus, state: data.ok === false ? data.data_state || "api_unavailable" : "ready", savingNote: false };
      state.userNotesLoaded = true;
    })
    .catch((error) => {
      console.warn("用户批注加载失败", error);
      state.userWriteStatus = { ...state.userWriteStatus, state: "api_unavailable", savingNote: false };
      state.userNotesLoaded = true;
    })
    .finally(() => {
      state.userNotesLoadPromise = null;
      renderUserAnnotationDrawer();
      scheduleAnnotationAnchorMarkers("user-notes-loaded");
    });
  return state.userNotesLoadPromise;
}

function favoriteForTarget(targetRef) {
  return state.userFavoritesByRef.get(text(targetRef).trim()) || null;
}

function upsertFavoriteInState(favorite) {
  if (!favorite?.target_ref) return;
  const targetRef = text(favorite.target_ref).trim();
  const rows = list(state.userFavorites).filter((row) => text(row.target_ref).trim() !== targetRef);
  state.userFavorites = [favorite, ...rows];
  refreshUserFavoritesMap();
}

function removeFavoriteFromState(targetRef) {
  const normalized = text(targetRef).trim();
  state.userFavorites = list(state.userFavorites).filter((row) => text(row.target_ref).trim() !== normalized);
  refreshUserFavoritesMap();
}

function upsertNoteInState(note) {
  if (!note?.id) return;
  const rows = list(state.userNotes).filter((row) => text(row.id).trim() !== text(note.id).trim());
  state.userNotes = [note, ...rows];
}

function removeNoteFromState(noteId) {
  const normalized = text(noteId).trim();
  state.userNotes = list(state.userNotes).filter((row) => text(row.id).trim() !== normalized);
}

function renderUserAnnotationDrawer(options = {}) {
  ensureUserFavoritesLoaded();
  ensureUserNotesLoaded();
  const mount = $("userAnnotationMount");
  const components = window.sapdComponents || {};
  if (!mount || !components.UserAnnotationDrawer?.render) return;
  const previousDrawer = mount.querySelector(".user-annotation-drawer");
  const previousOpen = previousDrawer ? previousDrawer.classList.contains("is-open") : null;
  const nextOpen = Boolean(state.userAnnotationDrawerOpen);
  const previousPanelScrollTop = options.preserveScroll ? mount.querySelector(".annotation-drawer-scroll")?.scrollTop || 0 : 0;
  const target = state.activeUserTarget || state.activePageAnnotationTarget || currentPageAnnotationTarget();
  const pageTarget = state.activePageAnnotationTarget || currentPageAnnotationTarget();
  setHtml(
    "userAnnotationMount",
    components.UserAnnotationDrawer.render({
      open: state.userAnnotationDrawerOpen,
      target,
      pageTarget,
      notes: state.userNotes,
      favorite: favoriteForTarget(target?.targetRef),
      status: state.userWriteStatus,
      draft: state.userAnnotationDraft,
      editingNoteId: state.userAnnotationEditingNoteId,
      editDraft: state.userAnnotationEditDraft,
      expandedNoteIds: Array.from(state.userAnnotationExpandedNoteIds),
      pendingTargetLabel: state.pendingAnnotationTargetLabel,
      contextMenu: state.annotationContextMenu,
    }),
  );
  requestAnimationFrame(() => {
    const drawer = mount.querySelector(".user-annotation-drawer");
    if (drawer && previousOpen !== null && previousOpen !== nextOpen) {
      drawer.classList.toggle("is-open", previousOpen);
      drawer.classList.toggle("is-closing", previousOpen && !nextOpen);
      drawer.dataset.annotationTransitioning = "true";
      requestAnimationFrame(() => {
        drawer.classList.toggle("is-open", nextOpen);
        window.setTimeout(() => {
          drawer.classList.remove("is-closing");
          drawer.removeAttribute("data-annotation-transitioning");
        }, 420);
      });
    }
    if (options.preserveScroll) {
      const nextPanel = mount.querySelector(".annotation-drawer-scroll");
      if (nextPanel) nextPanel.scrollTop = previousPanelScrollTop;
    }
    scheduleAnnotationAnchorMarkers("render-drawer", { delays: [0, 80] });
  });
}

async function handleUserNoteCreate() {
  const dataClient = window.sapdDataClient;
  const target = state.annotationDraftTarget || state.activeUserTarget || state.activePageAnnotationTarget || currentPageAnnotationTarget();
  const pageTarget = state.activePageAnnotationTarget || currentPageAnnotationTarget();
  const body = text(state.userAnnotationDraft).trim();
  if (!target?.targetRef || !body || !dataClient?.createUserNote) return false;
  state.userWriteStatus = { ...state.userWriteStatus, state: "ready", savingNote: true };
  renderUserAnnotationDrawer();
  try {
    const envelope = await dataClient.createUserNote({
      target_ref: target.targetRef,
      body,
      status: "todo",
      page_route: pageTarget.code,
      page_title: pageTarget.title,
      anchor_type: target.anchorType || (target.objectType === "page" ? "page" : "object"),
      object_type: target.objectType,
      object_title: target.title,
      tags: [target.objectLabel, pageTarget.title].filter(Boolean),
    });
    if (envelope?.data?.ok === false) throw new Error(envelope.data.error || "create note failed");
    upsertNoteInState(envelope?.data?.note);
    state.userAnnotationDraft = "";
    state.annotationDraftTarget = null;
    state.userWriteStatus = { ...state.userWriteStatus, state: "ready", savingNote: false, draftGuard: false };
    renderUserAnnotationDrawer();
    return true;
  } catch (error) {
    console.warn("用户批注保存失败", error);
    state.userWriteStatus = { ...state.userWriteStatus, state: "api_error", savingNote: false, draftGuard: false };
  }
  renderUserAnnotationDrawer();
  return false;
}

async function handleUserNoteStatus(noteId, status) {
  const dataClient = window.sapdDataClient;
  if (!noteId || !dataClient?.updateUserNote) return;
  state.userWriteStatus = { ...state.userWriteStatus, state: "ready", savingNote: true };
  renderUserAnnotationDrawer({ preserveScroll: true });
  try {
    const envelope = await dataClient.updateUserNote(noteId, { status });
    if (envelope?.data?.ok === false) throw new Error(envelope.data.error || "update note failed");
    upsertNoteInState(envelope?.data?.note);
    state.userWriteStatus = { ...state.userWriteStatus, state: "ready", savingNote: false };
  } catch (error) {
    console.warn("用户批注状态保存失败", error);
    state.userWriteStatus = { ...state.userWriteStatus, state: "api_error", savingNote: false };
  }
  renderUserAnnotationDrawer({ preserveScroll: true });
}

function handleUserNoteEditStart(noteId) {
  const note = list(state.userNotes).find((row) => text(row.id).trim() === text(noteId).trim());
  if (!note) return;
  state.userAnnotationEditingNoteId = note.id;
  state.userAnnotationEditDraft = text(note.body);
  state.userAnnotationExpandedNoteIds.add(text(note.id).trim());
  renderUserAnnotationDrawer({ preserveScroll: true });
}

async function handleUserNoteEditSave(noteId) {
  const dataClient = window.sapdDataClient;
  const body = text(state.userAnnotationEditDraft).trim();
  if (!noteId || !body || !dataClient?.updateUserNote) return;
  state.userWriteStatus = { ...state.userWriteStatus, state: "ready", savingNote: true };
  renderUserAnnotationDrawer({ preserveScroll: true });
  try {
    const envelope = await dataClient.updateUserNote(noteId, { body });
    if (envelope?.data?.ok === false) throw new Error(envelope.data.error || "update note failed");
    upsertNoteInState(envelope?.data?.note);
    state.userAnnotationEditingNoteId = "";
    state.userAnnotationEditDraft = "";
    state.userWriteStatus = { ...state.userWriteStatus, state: "ready", savingNote: false };
  } catch (error) {
    console.warn("用户批注修改失败", error);
    state.userWriteStatus = { ...state.userWriteStatus, state: "api_error", savingNote: false };
  }
  renderUserAnnotationDrawer({ preserveScroll: true });
}

function handleUserNoteEditCancel() {
  state.userAnnotationEditingNoteId = "";
  state.userAnnotationEditDraft = "";
  renderUserAnnotationDrawer({ preserveScroll: true });
}

async function handleUserNoteDelete(noteId) {
  const dataClient = window.sapdDataClient;
  if (!noteId || !dataClient?.deleteUserNote) return;
  state.userWriteStatus = { ...state.userWriteStatus, state: "ready", savingNote: true };
  renderUserAnnotationDrawer();
  try {
    const envelope = await dataClient.deleteUserNote(noteId);
    if (envelope?.data?.ok === false) throw new Error(envelope.data.error || "delete note failed");
    removeNoteFromState(noteId);
    state.userWriteStatus = { ...state.userWriteStatus, state: "ready", savingNote: false };
  } catch (error) {
    console.warn("用户批注删除失败", error);
    state.userWriteStatus = { ...state.userWriteStatus, state: "api_error", savingNote: false };
  }
  renderUserAnnotationDrawer();
}

async function handleAnnotationDraftSaveAndSwitch() {
  const saved = await handleUserNoteCreate();
  if (saved) runPendingAnnotationAction();
}

function handleAnnotationDraftDiscardAndSwitch() {
  runPendingAnnotationAction();
}

function handleAnnotationDraftCancelSwitch() {
  state.pendingAnnotationAction = null;
  state.pendingAnnotationTargetLabel = "";
  state.userWriteStatus = { ...state.userWriteStatus, draftGuard: false };
  state.userAnnotationDrawerOpen = true;
  renderUserAnnotationDrawer();
}

function mergeSharedLookups(payload) {
  const serviceModuleIndex = list(state.sharedLookups?.service_module_index);
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

const MAINTENANCE_PAGE_LOAD_CONTRACT = {
  "capability-directory": {
    requiredPackages: ["capability"],
    requiredSections: [],
    supplementalPackages: [],
    supplementalSections: [],
  },
  scopes: {
    requiredPackages: [],
    requiredSections: ["scopes"],
    supplementalPackages: [],
    supplementalSections: ["services"],
  },
  services: {
    requiredPackages: [],
    requiredSections: ["services"],
    supplementalPackages: ["capability"],
    supplementalSections: ["scopes", "modules", "measures"],
  },
  modules: {
    requiredPackages: ["sharedLookups"],
    requiredSections: ["modules"],
    supplementalPackages: [],
    supplementalSections: ["services", "scopes"],
  },
  measures: {
    requiredPackages: [],
    requiredSections: ["measures"],
    supplementalPackages: [],
    supplementalSections: ["services", "scopes"],
  },
  "security-works": {
    requiredPackages: ["capability"],
    requiredSections: [],
    supplementalPackages: [],
    supplementalSections: [],
  },
  processes: {
    requiredPackages: [],
    requiredSections: ["processes"],
    supplementalPackages: [],
    supplementalSections: [],
  },
  "work-functions": {
    requiredPackages: [],
    requiredSections: ["work-functions"],
    supplementalPackages: [],
    supplementalSections: ["references", "processes"],
  },
  references: {
    requiredPackages: [],
    requiredSections: ["references"],
    supplementalPackages: [],
    supplementalSections: ["work-functions", "processes"],
  },
  "application-systems": {
    requiredPackages: ["lifecycle"],
    requiredSections: [],
    supplementalPackages: [],
    supplementalSections: [],
  },
  "lcap-references": {
    requiredPackages: ["lifecycle"],
    requiredSections: [],
    supplementalPackages: [],
    supplementalSections: [],
  },
};

function maintenanceLoadContractForPage(page) {
  return (
    MAINTENANCE_PAGE_LOAD_CONTRACT[page] || {
      requiredPackages: [],
      requiredSections: [],
      supplementalPackages: [],
      supplementalSections: [],
    }
  );
}

function maintenanceSectionForPage(page) {
  const contract = maintenanceLoadContractForPage(page);
  return list(contract.requiredSections)[0] || "";
}

function maintenanceSectionsForPage(page) {
  return list(maintenanceLoadContractForPage(page).requiredSections);
}

function maintenancePackagesForPage(page) {
  return list(maintenanceLoadContractForPage(page).requiredPackages);
}

function supplementalMaintenanceSectionsForPage(page) {
  return list(maintenanceLoadContractForPage(page).supplementalSections);
}

function supplementalMaintenancePackagesForPage(page) {
  return list(maintenanceLoadContractForPage(page).supplementalPackages);
}

function maintenanceRenderSectionsForPage(page) {
  const contract = maintenanceLoadContractForPage(page);
  return uniqueBy([...list(contract.requiredSections), ...list(contract.supplementalSections)], (sectionId) => sectionId);
}

function maintenanceRenderPackagesForPage(page) {
  const contract = maintenanceLoadContractForPage(page);
  return uniqueBy([...list(contract.requiredPackages), ...list(contract.supplementalPackages)], (packageName) => packageName);
}

const MAINTENANCE_SECTION_FIELDS = {
  scopes: ["scope_types"],
  services: ["security_technical_services"],
  modules: ["security_technology_modules"],
  measures: ["security_technical_measures"],
  processes: ["security_processes"],
  "work-functions": ["work_function_layers"],
  references: ["gbt_42446_references", "gartner_roles"],
};

const MAINTENANCE_SPLIT_FIELDS = uniqueBy(Object.values(MAINTENANCE_SECTION_FIELDS).flat(), (field) => field);

function maintenanceSectionRecordCount(sectionId, payload = state.maintenanceKnowledge) {
  return list(MAINTENANCE_SECTION_FIELDS[sectionId]).reduce((sum, field) => sum + list(payload?.[field]).length, 0);
}

function expectedMaintenanceSectionCount(sectionId) {
  const counts = state.maintenanceIndex?.section_counts || state.maintenanceKnowledge?.section_counts || {};
  return Number(counts[sectionId]) || 0;
}

function isMaintenanceSectionReady(sectionId) {
  if (!sectionId) return true;
  if (maintenanceSectionRecordCount(sectionId) > 0) return true;
  if (!state.loadedMaintenanceSections.has(sectionId)) return false;
  if (expectedMaintenanceSectionCount(sectionId) <= 0) return true;
  if (state.maintenanceSectionStaleReloads.has(sectionId)) return true;
  state.maintenanceSectionStaleReloads.add(sectionId);
  state.loadedMaintenanceSections.delete(sectionId);
  return false;
}

function mergeMaintenanceSectionPayload(payload) {
  if (!payload) return;
  const sectionFields = new Set(MAINTENANCE_SECTION_FIELDS[payload.section_id] || []);
  const scopedPayload = { ...payload };
  MAINTENANCE_SPLIT_FIELDS.forEach((field) => {
    if (!sectionFields.has(field) && list(payload[field]).length === 0 && list(state.maintenanceKnowledge?.[field]).length > 0) {
      scopedPayload[field] = state.maintenanceKnowledge[field];
    }
  });
  if (payload.section_id && maintenanceSectionRecordCount(payload.section_id, payload) > 0) {
    state.maintenanceSectionStaleReloads.delete(payload.section_id);
  }
  state.maintenanceKnowledge = {
    generated_at: scopedPayload.generated_at || state.maintenanceKnowledge?.generated_at || state.maintenanceIndex?.generated_at || null,
    data_state: scopedPayload.data_state || state.maintenanceKnowledge?.data_state || state.maintenanceIndex?.data_state || "ready",
    ...(state.maintenanceKnowledge || {}),
    ...scopedPayload,
    stats: {
      ...(state.maintenanceIndex?.stats || {}),
      ...(state.maintenanceKnowledge?.stats || {}),
      ...(scopedPayload.stats || {}),
    },
    section_counts: {
      ...(state.maintenanceIndex?.section_counts || {}),
      ...(state.maintenanceKnowledge?.section_counts || {}),
      ...(scopedPayload.section_counts || {}),
    },
    source_evidence_by_id: {
      ...(state.maintenanceKnowledge?.source_evidence_by_id || {}),
      ...(scopedPayload.source_evidence_by_id || {}),
    },
    maintenance_index: state.maintenanceIndex || scopedPayload.maintenance_index || state.maintenanceKnowledge?.maintenance_index || null,
  };
}

function resolveMaintenanceSectionId(section) {
  return MAINTENANCE_SECTION_FIELDS[section] ? section : maintenanceSectionForPage(section);
}

function ensureMaintenanceSectionLoaded(section) {
  const sectionId = resolveMaintenanceSectionId(section);
  if (!sectionId || state.loadedMaintenanceSections.has(sectionId)) return false;
  if (state.maintenanceSectionLoads.has(sectionId)) return true;
  const dataClient = window.sapdDataClient;
  if (!dataClient?.getMaintenanceSection) return false;
  const loadPromise = dataClient
    .getMaintenanceSection(sectionId)
    .then((envelope) => {
      mergeMaintenanceSectionPayload(envelope?.data);
      state.loadedMaintenanceSections.add(sectionId);
      state.maintenanceSectionLoads.delete(sectionId);
      if (state.activeView === "maintenance" && maintenanceRenderSectionsForPage(state.activeMaintenancePage).includes(sectionId)) renderMaintenance();
    })
    .catch((error) => {
      console.warn(`知识库字典分片加载失败：${sectionId}`, error);
      state.maintenanceSectionLoads.delete(sectionId);
    });
  state.maintenanceSectionLoads.set(sectionId, loadPromise);
  return true;
}

function ensureMaintenancePackageLoaded(packageName) {
  if (!packageName || state.loadedPackages.has(packageName)) return false;
  const routeAtStart = state.activeRoute;
  const load = loadDataPackage(packageName);
  load.then(() => {
    if (
      state.activeRoute === routeAtStart &&
      state.activeView === "maintenance" &&
      maintenanceRenderPackagesForPage(state.activeMaintenancePage).includes(packageName)
    ) {
      renderMaintenance();
    }
  });
  return true;
}

function ensureSupplementalMaintenanceSectionsLoaded(page) {
  supplementalMaintenanceSectionsForPage(page).forEach((sectionId) => ensureMaintenanceSectionLoaded(sectionId));
  supplementalMaintenancePackagesForPage(page).forEach((packageName) => ensureMaintenancePackageLoaded(packageName));
}

const STANDARD_TABLE_PREFETCH_MAX_ROWS = 200;

function standardFrameworkIndexById(frameworkId) {
  return list(state.standards?.frameworks).find((framework) => framework.id === frameworkId) || null;
}

function loadedStandardFramework(frameworkId) {
  return state.standards?.loadedFrameworks?.[frameworkId] || null;
}

function standardTablesForFramework(framework) {
  if (list(framework?.tabs).length) return list(framework.tabs);
  if (!framework) return [];
  return [
    {
      id: framework.id || "standard",
      title: framework.title || "标准/框架",
      columns: list(framework.columns),
      rows: list(framework.rows),
      totalRows: Number(framework.totalRows) || list(framework.rows).length,
      dataPath: framework.dataPath || "",
      loaded: Boolean(list(framework.rows).length),
    },
  ];
}

function standardTableHasRows(table) {
  return list(table?.rows).length > 0;
}

function activeStandardTableIdForFramework(framework) {
  const tables = standardTablesForFramework(framework);
  if (!tables.length) return "";
  const current = tables.find((table) => table.id === state.activeStandardTableId);
  return current?.id || tables[0].id || "";
}

function standardTableById(framework, tableId) {
  return standardTablesForFramework(framework).find((table) => table.id === tableId) || null;
}

function mergeLoadedStandardFrameworkTable(frameworkId, loadedTable) {
  if (!frameworkId || !loadedTable) return;
  const current = loadedStandardFramework(frameworkId) || standardFrameworkIndexById(frameworkId) || {};
  const tables = standardTablesForFramework(current);
  const nextTabs = list(current.tabs).length
    ? tables.map((table) => (table.id === loadedTable.id ? { ...table, ...loadedTable, loaded: true } : table))
    : list(current.tabs);
  const nextFramework = list(current.tabs).length
    ? { ...current, tabs: nextTabs, loaded: true }
    : { ...current, ...loadedTable, loaded: true };
  state.standards = {
    ...(state.standards || {}),
    loadedFrameworks: {
      ...(state.standards?.loadedFrameworks || {}),
      [frameworkId]: nextFramework,
    },
  };
}

function ensureStandardFrameworkTableLoaded(frameworkId, tableId) {
  const framework = loadedStandardFramework(frameworkId);
  const table = standardTableById(framework, tableId);
  if (!framework || !table || standardTableHasRows(table) || !table.dataPath) return false;
  const loadKey = `${frameworkId}:${tableId}`;
  if (state.standardFrameworkLoads.has(loadKey)) return true;
  const dataClient = window.sapdDataClient;
  if (!dataClient?.getStandardFrameworkTable) return false;
  const loadPromise = dataClient.getStandardFrameworkTable(frameworkId, tableId).then((envelope) => {
    mergeLoadedStandardFrameworkTable(frameworkId, envelope?.data || table);
    state.standardFrameworkLoads.delete(loadKey);
    if (state.activeMaintenancePage === "standards" && state.activeStandardFramework === frameworkId && state.activeStandardTableId === tableId) {
      renderMaintenance();
    }
  });
  state.standardFrameworkLoads.set(loadKey, loadPromise);
  return true;
}

function ensureSupplementalStandardTablesLoaded(frameworkId) {
  const framework = loadedStandardFramework(frameworkId);
  if (!framework) return;
  for (const table of standardTablesForFramework(framework)) {
    if (table.id === state.activeStandardTableId) continue;
    const shouldPrefetch = Number(table.totalRows) > 0 && Number(table.totalRows) <= STANDARD_TABLE_PREFETCH_MAX_ROWS;
    if (shouldPrefetch) ensureStandardFrameworkTableLoaded(frameworkId, table.id);
  }
}

function ensureRoutePackages({ rerender = true } = {}) {
  const routeAtStart = state.activeRoute;
  const packages = routePackagesForCurrentState().filter((name) => !state.loadedPackages.has(name));
  if (!packages.length) return Promise.resolve();
  return Promise.all(packages.map(loadDataPackage)).then(() => {
    renderMetrics();
    if (rerender && state.activeRoute === routeAtStart) {
      renderActiveView();
      setupResizableWorkspaces();
      updateApplicationShellChrome();
    }
  });
}

function scheduleOverviewWarmup() {
  const warmup = () => {
    if (state.activeView !== "overview") return;
    Promise.all(["analyticsSummary"].map(loadDataPackage)).then(() => {
      renderMetrics();
      if (state.activeView === "overview") renderOverview();
    });
  };
  if (window.requestIdleCallback) window.requestIdleCallback(warmup, { timeout: 4000 });
  else window.setTimeout(warmup, 2500);
}

function capabilityFocusByCode(capabilityTree) {
  const rows = {};
  for (const category of list(capabilityTree?.categories)) {
    for (const domain of list(category.domains)) {
      for (const capability of list(domain.capabilities)) {
        for (const focus of list(capability.focuses)) {
          if (!focus?.code) continue;
          rows[focus.code] = {
            code: focus.code,
            title: titleOf(focus, focus.code),
            description: text(focus.description),
            capabilityCode: text(capability.code),
            capability: titleOf(capability, ""),
            domainCode: text(domain.code),
            domain: titleOf(domain, ""),
            categoryCode: text(category.code),
            category: titleOf(category, ""),
          };
        }
      }
    }
  }
  return rows;
}

function setHtml(id, html) {
  const element = $(id);
  if (element) element.innerHTML = html;
}

function setText(id, value) {
  const element = $(id);
  if (element) element.textContent = text(value);
}

function loadScriptOnce(src, isReady) {
  if (isReady?.()) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing) {
      existing.addEventListener("load", resolve, { once: true });
      existing.addEventListener("error", reject, { once: true });
      return;
    }
    const script = document.createElement("script");
    script.src = src;
    script.onload = resolve;
    script.onerror = reject;
    document.body.appendChild(script);
  });
}

function installStandardTooltip() {
  let activeTrigger = null;
  let tooltip = null;

  const ensureTooltip = () => {
    if (tooltip) return tooltip;
    tooltip = document.createElement("div");
    tooltip.className = "floating-standard-tooltip";
    tooltip.setAttribute("role", "tooltip");
    tooltip.hidden = true;
    document.body.appendChild(tooltip);
    return tooltip;
  };

  const positionTooltip = () => {
    if (!activeTrigger || !tooltip || tooltip.hidden) return;
    const triggerRect = activeTrigger.getBoundingClientRect();
    const tooltipRect = tooltip.getBoundingClientRect();
    const gap = 8;
    const viewportGap = 10;
    let top = triggerRect.top - tooltipRect.height - gap;
    if (top < viewportGap) top = triggerRect.bottom + gap;
    const maxLeft = window.innerWidth - tooltipRect.width - viewportGap;
    const centeredLeft = triggerRect.left + triggerRect.width / 2 - tooltipRect.width / 2;
    const left = Math.max(viewportGap, Math.min(centeredLeft, maxLeft));
    tooltip.style.left = `${Math.round(left)}px`;
    tooltip.style.top = `${Math.round(top)}px`;
  };

  const showTooltip = (trigger) => {
    const content = text(trigger?.dataset?.tooltip).trim();
    if (!content) return;
    activeTrigger = trigger;
    const element = ensureTooltip();
    element.textContent = content;
    element.hidden = false;
    requestAnimationFrame(positionTooltip);
  };

  const hideTooltip = (trigger) => {
    if (trigger && trigger !== activeTrigger) return;
    activeTrigger = null;
    if (tooltip) tooltip.hidden = true;
  };

  document.addEventListener("mouseover", (event) => {
    const trigger = event.target.closest(".standard-tooltip-chip[data-tooltip]");
    if (!trigger) return;
    showTooltip(trigger);
  });
  document.addEventListener("mouseout", (event) => {
    const trigger = event.target.closest(".standard-tooltip-chip[data-tooltip]");
    if (!trigger || trigger.contains(event.relatedTarget)) return;
    hideTooltip(trigger);
  });
  document.addEventListener("focusin", (event) => {
    const trigger = event.target.closest(".standard-tooltip-chip[data-tooltip]");
    if (trigger) showTooltip(trigger);
  });
  document.addEventListener("focusout", (event) => {
    const trigger = event.target.closest(".standard-tooltip-chip[data-tooltip]");
    if (trigger) hideTooltip(trigger);
  });
  window.addEventListener("resize", positionTooltip);
  document.addEventListener("scroll", () => hideTooltip(activeTrigger), true);
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
  return `${visible
    .map((item) => {
      const label = titleOf(item);
      return `<span class="relation-chip"${annotationValueAttrsForHtml(label)}>${escapeHtml(label)}</span>`;
    })
    .join("")}${more > 0 ? `<span class="relation-chip muted">+${more}</span>` : ""}`;
}

function slideImagePath(row, slideNumber) {
  const numberText = String(slideNumber).padStart(3, "0");
  return text(row?.slide_path_pattern || "").replace("{n}", numberText);
}

function contentSlides(row) {
  const guidePackage = state.guidePackages?.[row?.guide_id] || null;
  const packageSlides = guidePackage?.slides || null;
  if (packageSlides?.path_pattern && packageSlides?.count) {
    return Array.from({ length: Number(packageSlides.count) }, (_, index) => ({
      pageNumber: index + 1,
      title: `第 ${index + 1} 页`,
      image: text(packageSlides.path_pattern).replace("{n}", String(index + 1).padStart(3, "0")),
    }));
  }
  const explicitSlides = list(row?.slides);
  if (explicitSlides.length) {
    return explicitSlides.map((slide, index) => ({
      pageNumber: Number(slide.pageNumber || slide.slide_number || index + 1),
      title: text(slide.title || `第 ${index + 1} 页`),
      image: text(slide.image || slide.preview_path || slide.path),
    }));
  }
  const count = Number(row?.slide_count || 0);
  if (!count || !row?.slide_path_pattern) return [];
  return Array.from({ length: count }, (_, index) => ({
    pageNumber: index + 1,
    title: `第 ${index + 1} 页`,
    image: slideImagePath(row, index + 1),
  }));
}

function clampSlideIndex(slides) {
  const count = slides.length;
  if (!count) return 0;
  const index = Number(state.selectedContentSlideIndex || 0);
  if (Number.isNaN(index)) return 0;
  return Math.max(0, Math.min(index, count - 1));
}

function changeContentSlide(delta, scrollMode = "active") {
  const selected = contentRows().find((row) => row.id === state.selectedContentId);
  const slides = contentSlides(selected);
  if (!slides.length) return;
  const nextIndex = clampSlideIndex(slides) + delta;
  state.selectedContentSlideIndex = Math.max(0, Math.min(nextIndex, slides.length - 1));
  state.contentSlideScrollMode = scrollMode;
  renderContent();
}

function scaledDrawioSize(size = DRAWIO_LEGEND_DEFAULT_SIZE, maxWidth = 96, maxHeight = 58) {
  const width = Number(size[0]) || DRAWIO_LEGEND_DEFAULT_SIZE[0];
  const height = Number(size[1]) || DRAWIO_LEGEND_DEFAULT_SIZE[1];
  const scale = Math.min(maxWidth / width, maxHeight / height);
  return {
    width: Math.round(width * scale * 100) / 100,
    height: Math.round(height * scale * 100) / 100,
  };
}

function splitIconEnglishTitle(value) {
  const words = text(value)
    .replace(" 图标", "")
    .split(/\s+|\/+/)
    .map((word) => word.trim())
    .filter(Boolean);
  if (!words.length) return [];
  if (words.length <= 2) return [words.join(" ")];
  return [words.slice(0, 2).join(" "), words.slice(2).join(" ")].filter(Boolean);
}

function splitIconChineseTitle(value) {
  const title = text(value).replace(/\s+/g, " ").trim();
  if (title.includes(" / ")) return title.split(" / ").map((part, index, rows) => (index < rows.length - 1 ? `${part} /` : part));
  if (title.length <= 7) return [title];
  return [title.slice(0, 7), title.slice(7)].filter(Boolean);
}

function estimatedSvgTextWidth(line, size) {
  return Array.from(text(line)).reduce((total, char) => {
    const code = char.codePointAt(0) || 0;
    if (code > 255) return total + size * 0.95;
    if (char === " ") return total + size * 0.34;
    return total + size * 0.56;
  }, 0);
}

function renderSvgTextLines(lines, x, y, options = {}) {
  const size = Number(options.size || 10);
  const weight = Number(options.weight || 700);
  const lineHeight = Number(options.lineHeight || size + 2);
  const anchor = options.anchor || "middle";
  return list(lines)
    .map((line, index) => {
      const maxWidth = Number(options.maxWidth || 0);
      const textLength = maxWidth && estimatedSvgTextWidth(line, size) > maxWidth ? ` textLength="${maxWidth}" lengthAdjust="spacingAndGlyphs"` : "";
      return `<text x="${x}" y="${y + index * lineHeight}" text-anchor="${anchor}" font-family="-apple-system,BlinkMacSystemFont,'Segoe UI','Microsoft YaHei',sans-serif" font-size="${size}" font-weight="${weight}" fill="${escapeHtml(options.fill || "#344054")}"${textLength}>${escapeHtml(line)}</text>`;
    })
    .join("");
}

function renderArchimateCornerIcon(type, width, height, options = {}) {
  const x = Math.max(0, width - 20);
  const y = Math.max(0, Math.min(8, height * 0.1));
  const stroke = escapeHtml(options.stroke || "#111827");
  const rawFill = options.fill || "none";
  const fill = rawFill === "none" ? "none" : escapeHtml(rawFill);
  const blackFill = stroke;
  const outline = `fill="${fill}" stroke="${stroke}" stroke-width="1" stroke-miterlimit="10"`;
  const noFill = `fill="none" stroke="${stroke}" stroke-width="1" stroke-miterlimit="10"`;
  const group = (content, dx = 0, dy = 0) => `<g transform="translate(${x + dx} ${y + dy})">${content}</g>`;

  if (type === "location") {
    return group(`<path d="M4.5 0 C2.56 0 0 1.51 0 4.5 C0 6.11 0.7 7.17 1.37 8.23 C2.61 10.18 3.85 11.99 4.5 15 C5.15 11.99 6.39 10.18 7.63 8.23 C8.3 7.17 9 6.11 9 4.5 C9 1.51 6.44 0 4.5 0 Z" ${outline}/>`, 3, 0);
  }
  if (type === "network") {
    return group(`
      <path d="M3.75 2.2 L10.5 2.2 L6.75 8.8 L0 8.8 Z" ${noFill}/>
      <ellipse cx="3.75" cy="2.2" rx="2.25" ry="2.2" fill="${blackFill}" stroke="none"/>
      <ellipse cx="10.5" cy="2.2" rx="2.25" ry="2.2" fill="${blackFill}" stroke="none"/>
      <ellipse cx="0" cy="8.8" rx="2.25" ry="2.2" fill="${blackFill}" stroke="none"/>
      <ellipse cx="6.75" cy="8.8" rx="2.25" ry="2.2" fill="${blackFill}" stroke="none"/>
    `, 2.25, 2.2);
  }
  if (type === "device") {
    return group(`<rect x="0" y="0" width="15" height="13.2" rx="1.5" ry="1.5" ${outline}/><path d="M1.5 13.2 L0 15 L15 15 L13.5 13.2" ${outline}/>`);
  }
  if (type === "system-software") {
    return group(`<ellipse cx="9.75" cy="5.25" rx="5.25" ry="5.25" ${outline}/><ellipse cx="7.35" cy="7.35" rx="7.35" ry="7.35" ${outline}/>`);
  }
  if (type === "component" || type === "artifact") {
    return group(`<rect x="4.25" y="0" width="9.75" height="15" ${outline}/><rect x="1" y="3.75" width="6.5" height="2.25" ${outline}/><rect x="1" y="9" width="6.5" height="2.25" ${outline}/>`);
  }
  if (type === "function") {
    return group(`<path d="M7.5 0 L15 3 L15 15 L7.5 12 L0 15 L0 3 Z" ${outline}/>`);
  }
  if (type === "service" || type === "business-actor") {
    return group(`<path d="M10.5 0 C12.99 0 15 2.01 15 4.5 C15 6.99 12.99 9 10.5 9 L4.5 9 C2.01 9 0 6.99 0 4.5 C0 2.01 2.01 0 4.5 0 Z" ${outline}/>`, 0, 3);
  }
  if (type === "data") {
    return group(`<path d="M0 0 L15 0 L15 9 L0 9 Z M0 1.8 L15 1.8" ${outline}/>`, 0, 3);
  }
  if (type === "event") {
    return group(`<path d="M10.5 0 C12.99 0 15 2.01 15 4.5 C15 6.98 12.99 9 10.5 9 L0 9 L4.5 4.5 L0 0 Z" ${outline}/>`, 0, 3);
  }
  if (type === "node") {
    return group(`<path d="M0 3.75 L3.75 0 L15 0 L15 11.25 L11.25 15 L0 15 Z M0 3.75 L11.25 3.75 L11.25 15 M15 0 L11.25 3.75" ${outline}/>`);
  }
  if (type === "role") {
    return group(`<path d="M12 0 L3 0 C1.34 0 0 2.01 0 4.5 C0 6.99 1.34 9 3 9 L12 9" ${outline}/><ellipse cx="12" cy="4.5" rx="3" ry="4.5" ${outline}/>`, 0, 3);
  }
  if (type === "process") {
    return group(`<path d="M0 2.7 L9 2.7 L9 0 L15 4.5 L9 9 L9 6.3 L0 6.3 Z" ${outline}/>`, 0, 3);
  }
  if (type === "grouping") {
    return group(`<path d="M0 3.3 L15 3.3 L15 11 L0 11 Z M0 3.3 L0 0 L11.25 0 L11.25 3.3" fill="none" stroke="${stroke}" stroke-width="1" stroke-miterlimit="10" stroke-dasharray="3 3"/>`, 0, 2);
  }
  if (type === "facility") {
    return group(`<path d="M0 15 L0 0 L1.95 0 L1.95 10.5 L6.3 8.25 L6.3 10.5 L10.65 8.25 L10.65 10.5 L15 8.25 L15 15 Z" ${outline}/>`);
  }
  return group(`<rect x="0" y="0" width="15" height="15" ${outline}/>`);
}

function notationForLegendItem(item = {}) {
  return ARCHIMATE_NOTATION_REGISTRY[item.notationId || item.iconType] || null;
}

function renderPendingNotationIcon(item) {
  return `
    <span class="modeling-legend-icon-frame modeling-legend-icon-frame-pending" aria-hidden="true">
      <svg class="modeling-legend-drawio-icon" style="width:124px;height:62px" viewBox="0 0 150 75" role="img" focusable="false">
        <rect x="0.75" y="0.75" width="148.5" height="73.5" rx="0" fill="none" stroke="#9aa4b2" stroke-width="1.5" stroke-dasharray="7 5"/>
        ${renderSvgTextLines(["待映射"], 75, 36, { size: ARCHIMATE_ICON_LABEL_RULE.chineseFontSize, weight: ARCHIMATE_ICON_LABEL_RULE.chineseWeight, fill: "#344054", maxWidth: 112 })}
        ${renderSvgTextLines([text(item.base || "Non-standard")], 75, 54, { size: ARCHIMATE_ICON_LABEL_RULE.englishFontSize, weight: ARCHIMATE_ICON_LABEL_RULE.englishWeight, fill: "#667085", maxWidth: 112 })}
      </svg>
    </span>
  `;
}

function renderModelingLegendIcon(item) {
  const notation = notationForLegendItem(item);
  if (!notation) return renderPendingNotationIcon(item);
  const actor = notation.renderer === "actor";
  const rawSize = actor ? DRAWIO_LEGEND_DEFAULT_SIZE : item.drawioSize || notation.drawioSize || DRAWIO_LEGEND_DEFAULT_SIZE;
  const size = scaledDrawioSize(rawSize, 124, 72);
  const viewWidth = Number(rawSize[0]) || DRAWIO_LEGEND_DEFAULT_SIZE[0];
  const viewHeight = Number(rawSize[1]) || DRAWIO_LEGEND_DEFAULT_SIZE[1];
  const stroke = item.stroke || "#2f3b4d";
  const fill = text(item.fill).toLowerCase() === "transparent" ? "none" : item.fill || "#ffffff";
  const dash = notation.dashed ? `stroke-dasharray="7 5"` : "";
  const radius = notation.rounded ? Math.min(18, viewHeight * 0.22) : 0;
  const chineseLines = splitIconChineseTitle(item.name);
  const englishLines = splitIconEnglishTitle(item.base);
  const chineseSize = ARCHIMATE_ICON_LABEL_RULE.chineseFontSize;
  const englishSize = ARCHIMATE_ICON_LABEL_RULE.englishFontSize;
  const chineseLineHeight = ARCHIMATE_ICON_LABEL_RULE.chineseLineHeight;
  const englishLineHeight = ARCHIMATE_ICON_LABEL_RULE.englishLineHeight;
  const titleBlockHeight = chineseLines.length * chineseLineHeight + ARCHIMATE_ICON_LABEL_RULE.titleGap + englishLines.length * englishLineHeight;
  const chineseStartY = Math.max(23, (viewHeight - titleBlockHeight) / 2 + chineseSize);
  const englishY = chineseStartY + chineseLines.length * chineseLineHeight + ARCHIMATE_ICON_LABEL_RULE.titleGap;
  const textMaxWidth = Math.max(82, viewWidth - ARCHIMATE_ICON_LABEL_RULE.shapeTextPaddingX);
  const shape = actor
    ? `
      <rect x="0.75" y="0.75" width="${viewWidth - 1.5}" height="${viewHeight - 1.5}" rx="0" fill="transparent" stroke="transparent"/>
      <g transform="translate(18 12)">
        <circle cx="13.25" cy="7" r="7" fill="${escapeHtml(fill)}" stroke="${escapeHtml(stroke)}" stroke-width="1.5"/>
        <path d="M13.25 14 V30 M2 21 H24.5 M13.25 30 L2 45 M13.25 30 L24.5 45" fill="none" stroke="${escapeHtml(stroke)}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      </g>
      ${renderSvgTextLines(chineseLines, 96, chineseLines.length > 1 ? 29 : 34, { size: chineseSize, weight: ARCHIMATE_ICON_LABEL_RULE.chineseWeight, fill: "#111827", lineHeight: chineseLineHeight, maxWidth: ARCHIMATE_ICON_LABEL_RULE.actorTextMaxWidth })}
      ${renderSvgTextLines(englishLines, 96, chineseLines.length > 1 ? 59 : 55, { size: englishSize, weight: ARCHIMATE_ICON_LABEL_RULE.englishWeight, fill: "#344054", lineHeight: englishLineHeight, maxWidth: ARCHIMATE_ICON_LABEL_RULE.actorTextMaxWidth - 6 })}
    `
    : `
      <rect x="0.75" y="0.75" width="${viewWidth - 1.5}" height="${viewHeight - 1.5}" rx="${radius}" fill="${escapeHtml(fill)}" stroke="${escapeHtml(stroke)}" stroke-width="1.5" ${dash}/>
      ${renderArchimateCornerIcon(notation.cornerIcon, viewWidth, viewHeight, { fill, stroke })}
      ${renderSvgTextLines(chineseLines, viewWidth / 2, chineseStartY, { size: chineseSize, weight: ARCHIMATE_ICON_LABEL_RULE.chineseWeight, fill: "#111827", lineHeight: chineseLineHeight, maxWidth: textMaxWidth })}
      ${renderSvgTextLines(englishLines, viewWidth / 2, englishY, { size: englishSize, weight: ARCHIMATE_ICON_LABEL_RULE.englishWeight, fill: "#344054", lineHeight: englishLineHeight, maxWidth: textMaxWidth - 8 })}
    `;
  return `
    <span class="modeling-legend-icon-frame" aria-hidden="true" data-archimate-element="${escapeHtml(notation.archimateElementTypeId)}" data-drawio-shape="${escapeHtml(notation.drawioShape)}" data-drawio-app-type="${escapeHtml(notation.appType || "")}" data-drawio-archi-type="${escapeHtml(notation.archiType || "")}">
      <svg class="modeling-legend-drawio-icon" style="width:${size.width}px;height:${size.height}px" viewBox="0 0 ${viewWidth} ${viewHeight}" role="img" focusable="false">
        ${shape}
      </svg>
    </span>
  `;
}

function renderModelingLegendCard(item) {
  return `
    <article class="modeling-legend-card">
      ${renderModelingLegendIcon(item)}
      <div class="modeling-legend-card-body">
        <div class="modeling-legend-definition">
          <p>${escapeHtml(item.definition)}</p>
        </div>
      </div>
    </article>
  `;
}

function renderModelingLegendSection(section) {
  return `
    <details class="modeling-legend-section modeling-legend-section-${escapeHtml(section.id)}">
      <summary class="modeling-legend-section-summary">
        <span class="modeling-legend-section-heading">
          <span class="modeling-legend-section-signal" aria-hidden="true"></span>
          <h3>${escapeHtml(section.title)}</h3>
        </span>
        <span class="modeling-legend-section-actions">
          <span class="modeling-legend-section-count">${list(section.items).length} 个元素</span>
          <span class="modeling-legend-section-chevron" aria-hidden="true"></span>
        </span>
      </summary>
      <div class="modeling-legend-section-body">
        <div class="modeling-legend-grid columns-${Number(section.columns) || 3}">
          ${list(section.items).map(renderModelingLegendCard).join("")}
        </div>
      </div>
    </details>
  `;
}

function renderModelingRelationLine(lineType, variant = "") {
  return `<span class="modeling-relation-line line-${escapeHtml(lineType)} ${variant ? `variant-${escapeHtml(variant)}` : ""}" aria-hidden="true"><i></i></span>`;
}

function renderModelingRelationLegendCard(item) {
  return `
    <article class="modeling-relation-legend-card line-${escapeHtml(item.lineType)}">
      <div class="modeling-relation-line-stack">
        ${list(item.lineVariants).length ? list(item.lineVariants).map((variant) => renderModelingRelationLine(item.lineType, variant)).join("") : renderModelingRelationLine(item.lineType)}
      </div>
      <div>
        <strong>${escapeHtml(item.name)}</strong>
        <span>${escapeHtml(item.base)}</span>
        <p>${escapeHtml(item.definition)}</p>
      </div>
    </article>
  `;
}

function renderModelingElementLegendPanel() {
  return `
    <div class="modeling-legend-stack">
      ${MODELING_LEGEND_SECTIONS.map(renderModelingLegendSection).join("")}
      <details class="modeling-legend-section modeling-legend-section-relations">
        <summary class="modeling-legend-section-summary">
          <span class="modeling-legend-section-heading">
            <span class="modeling-legend-section-signal" aria-hidden="true"></span>
            <h3>关系线图例</h3>
          </span>
          <span class="modeling-legend-section-actions">
            <span class="modeling-legend-section-count">${MODELING_RELATION_LEGENDS.length} 类关系</span>
            <span class="modeling-legend-section-chevron" aria-hidden="true"></span>
          </span>
        </summary>
        <div class="modeling-legend-section-body">
          <div class="modeling-relation-legend-grid">
            ${MODELING_RELATION_LEGENDS.map(renderModelingRelationLegendCard).join("")}
          </div>
        </div>
      </details>
    </div>
  `;
}

function toggleModelingLegendSection(summary) {
  const section = summary?.closest?.(".modeling-legend-section");
  if (!section) return false;
  section.open = !section.open;
  return true;
}

function setModelingLegendSections(open) {
  document.querySelectorAll(".modeling-language-guide-workspace .modeling-legend-section").forEach((section) => {
    section.open = Boolean(open);
  });
}

function getModelingPosterTarget(targetId) {
  if (targetId && targetId !== "full") {
    const region = ARCHIMATE_POSTER_REGIONS.find((item) => item.id === targetId);
    if (region) return region;
  }
  return {
    id: "full",
    title: "ArchiMate® 3.2 企业架构建模标准",
    summary: "本地 ArchiMate Poster 整页视图，作为 SAPD 安全架构元素映射的语言标准参考。",
    image: ARCHIMATE_POSTER_OVERVIEW_IMAGE,
    width: ARCHIMATE_POSTER_OVERVIEW_SIZE.width,
    height: ARCHIMATE_POSTER_OVERVIEW_SIZE.height,
  };
}

function renderModelingPosterImage(target, imageClass = "", loading = "lazy") {
  return `
    <img
      class="modeling-poster-image ${escapeHtml(imageClass)}"
      src="${escapeHtml(target.image)}"
      alt="${escapeHtml(target.title)}"
      loading="${escapeHtml(loading)}"
      decoding="async"
      width="${escapeHtml(target.width || ARCHIMATE_POSTER_OVERVIEW_SIZE.width)}"
      height="${escapeHtml(target.height || ARCHIMATE_POSTER_OVERVIEW_SIZE.height)}"
    />
  `;
}

function renderModelingPosterLightbox() {
  if (!state.modelingPosterLightboxTarget) return "";
  const target = getModelingPosterTarget(state.modelingPosterLightboxTarget);
  const zoom = Number(state.modelingPosterLightboxZoom || 1);
  const zoomWidth = Math.round(Number(target.width || ARCHIMATE_POSTER_OVERVIEW_SIZE.width) * zoom);
  const isFit = zoom <= 1;
  return `
    <section class="modeling-poster-lightbox" data-modeling-poster-lightbox role="dialog" aria-modal="true" aria-label="${escapeHtml(target.title)} 图片预览">
      <button class="modeling-poster-lightbox-backdrop" type="button" data-modeling-poster-lightbox-close aria-label="关闭图片预览"></button>
      <div class="modeling-poster-lightbox-stage">
        <div class="modeling-poster-lightbox-toolbar" aria-label="图片预览工具">
          <button type="button" data-modeling-poster-lightbox-action="zoom-out" aria-label="缩小">−</button>
          <button type="button" data-modeling-poster-lightbox-action="fit" aria-label="适应屏幕">适应</button>
          <button type="button" data-modeling-poster-lightbox-action="zoom-in" aria-label="放大">＋</button>
        </div>
        <button class="modeling-poster-lightbox-close" type="button" data-modeling-poster-lightbox-close aria-label="关闭">
          <span aria-hidden="true">×</span>
        </button>
        <div class="modeling-poster-lightbox-scroll">
          <img
            class="modeling-poster-lightbox-image ${isFit ? "is-fit" : "is-zoomed"}"
            src="${escapeHtml(target.image)}"
            alt="${escapeHtml(target.title)}"
            width="${escapeHtml(target.width || ARCHIMATE_POSTER_OVERVIEW_SIZE.width)}"
            height="${escapeHtml(target.height || ARCHIMATE_POSTER_OVERVIEW_SIZE.height)}"
            style="--poster-zoom-width:${escapeHtml(zoomWidth)}px"
            decoding="async"
          />
        </div>
      </div>
    </section>
  `;
}

function requestModelingPosterFullscreen() {
  const lightbox = document.querySelector(".modeling-poster-lightbox");
  if (!lightbox || document.fullscreenElement === lightbox || !lightbox.requestFullscreen) return;
  lightbox.requestFullscreen().catch(() => {});
}

function getModelingPosterFittedWidth(target, viewport) {
  const naturalWidth = Number(target.width || ARCHIMATE_POSTER_OVERVIEW_SIZE.width);
  const naturalHeight = Number(target.height || ARCHIMATE_POSTER_OVERVIEW_SIZE.height);
  const viewportWidth = Math.max(320, Number(viewport?.clientWidth || window.innerWidth || 1280) - 24);
  const viewportHeight = Math.max(240, Number(viewport?.clientHeight || window.innerHeight || 720) - 24);
  const widthByHeight = viewportHeight * (naturalWidth / naturalHeight);
  return Math.min(naturalWidth, viewportWidth, widthByHeight);
}

function openModelingPosterLightbox(targetId = "full") {
  state.modelingPosterLightboxTarget = targetId || "full";
  state.modelingPosterLightboxZoom = 1;
  renderContent();
  requestModelingPosterFullscreen();
}

function closeModelingPosterLightbox() {
  state.modelingPosterLightboxTarget = null;
  state.modelingPosterLightboxZoom = 1;
  state.modelingPosterLightboxDragging = false;
  modelingPosterDragState.active = false;
  modelingPosterDragState.pointerId = null;
  if (document.fullscreenElement && document.exitFullscreen) {
    document.exitFullscreen().catch(() => {});
  }
  renderContent();
}

function applyModelingPosterLightboxZoom(nextZoom, originEvent = null) {
  if (!state.modelingPosterLightboxTarget) return;
  const target = getModelingPosterTarget(state.modelingPosterLightboxTarget);
  const viewport = document.querySelector(".modeling-poster-lightbox-scroll");
  const image = document.querySelector(".modeling-poster-lightbox-image");
  if (!image || !viewport) return;
  const fittedWidth = getModelingPosterFittedWidth(target, viewport);
  const naturalWidth = Number(target.width || ARCHIMATE_POSTER_OVERVIEW_SIZE.width);
  const maxZoom = Math.max(2, Math.min(5, naturalWidth / fittedWidth));
  const previousRect = image.getBoundingClientRect();
  const previousScrollLeft = viewport.scrollLeft;
  const previousScrollTop = viewport.scrollTop;
  const previousX = originEvent ? originEvent.clientX : previousRect.left + previousRect.width / 2;
  const previousY = originEvent ? originEvent.clientY : previousRect.top + previousRect.height / 2;
  const previousRatioX = previousRect.width > 0 ? (previousX - previousRect.left + previousScrollLeft) / previousRect.width : 0.5;
  const previousRatioY = previousRect.height > 0 ? (previousY - previousRect.top + previousScrollTop) / previousRect.height : 0.5;
  state.modelingPosterLightboxZoom = Math.max(1, Math.min(maxZoom, Number(nextZoom.toFixed(2))));
  const zoom = Number(state.modelingPosterLightboxZoom || 1);
  image.classList.toggle("is-fit", zoom <= 1);
  image.classList.toggle("is-zoomed", zoom > 1);
  image.style.setProperty("--poster-zoom-width", `${Math.round(fittedWidth * zoom)}px`);
  requestAnimationFrame(() => {
    if (zoom <= 1) {
      viewport.scrollLeft = 0;
      viewport.scrollTop = 0;
      return;
    }
    const nextRect = image.getBoundingClientRect();
    viewport.scrollLeft = Math.max(0, previousRatioX * nextRect.width - (previousX - nextRect.left));
    viewport.scrollTop = Math.max(0, previousRatioY * nextRect.height - (previousY - nextRect.top));
  });
}

function updateModelingPosterLightboxZoom(action) {
  if (!state.modelingPosterLightboxTarget) return;
  const currentZoom = Number(state.modelingPosterLightboxZoom || 1);
  if (action === "fit") applyModelingPosterLightboxZoom(1);
  if (action === "zoom-in") applyModelingPosterLightboxZoom(currentZoom + 0.18);
  if (action === "zoom-out") applyModelingPosterLightboxZoom(currentZoom - 0.18);
}

function handleModelingPosterLightboxWheel(event) {
  if (!state.modelingPosterLightboxTarget) return;
  if (!event.target?.closest?.(".modeling-poster-lightbox")) return;
  event.preventDefault();
  const currentZoom = Number(state.modelingPosterLightboxZoom || 1);
  const zoomDelta = event.deltaY < 0 ? 0.08 : -0.08;
  applyModelingPosterLightboxZoom(currentZoom + zoomDelta, event);
}

function beginModelingPosterLightboxDrag(event) {
  if (!state.modelingPosterLightboxTarget) return;
  if (event.button !== 0) return;
  const viewport = event.target?.closest?.(".modeling-poster-lightbox-scroll");
  if (!viewport || event.target?.closest?.(".modeling-poster-lightbox-toolbar, .modeling-poster-lightbox-close")) return;
  modelingPosterDragState.active = true;
  modelingPosterDragState.pointerId = event.pointerId;
  modelingPosterDragState.startX = event.clientX;
  modelingPosterDragState.startY = event.clientY;
  modelingPosterDragState.scrollLeft = viewport.scrollLeft;
  modelingPosterDragState.scrollTop = viewport.scrollTop;
  state.modelingPosterLightboxDragging = true;
  viewport.classList.add("is-dragging");
  viewport.setPointerCapture?.(event.pointerId);
  event.preventDefault();
}

function updateModelingPosterLightboxDrag(event) {
  if (!modelingPosterDragState.active) return;
  if (modelingPosterDragState.pointerId !== event.pointerId) return;
  const viewport = document.querySelector(".modeling-poster-lightbox-scroll");
  if (!viewport) return;
  viewport.scrollLeft = modelingPosterDragState.scrollLeft - (event.clientX - modelingPosterDragState.startX);
  viewport.scrollTop = modelingPosterDragState.scrollTop - (event.clientY - modelingPosterDragState.startY);
}

function endModelingPosterLightboxDrag(event) {
  if (!modelingPosterDragState.active) return;
  if (modelingPosterDragState.pointerId !== event.pointerId) return;
  const viewport = document.querySelector(".modeling-poster-lightbox-scroll");
  viewport?.releasePointerCapture?.(event.pointerId);
  viewport?.classList.remove("is-dragging");
  modelingPosterDragState.active = false;
  modelingPosterDragState.pointerId = null;
  window.setTimeout(() => {
    state.modelingPosterLightboxDragging = false;
  }, 0);
}

function getEnvironmentBasemapViewer(target = document) {
  return target?.closest?.("[data-environment-basemap-viewer]") || document.querySelector("[data-environment-basemap-viewer]");
}

function getEnvironmentBasemapViewport(viewer) {
  return viewer?.querySelector?.("[data-environment-basemap-viewport]");
}

function getEnvironmentBasemapPanZoomLayer(viewer) {
  return viewer?.querySelector?.("[data-environment-basemap-panzoom-layer]") || viewer?.querySelector?.("[data-environment-basemap-stage]");
}

function environmentBasemapNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function clampEnvironmentBasemapScale(value) {
  return Math.max(ENVIRONMENT_BASEMAP_MIN_SCALE, Math.min(ENVIRONMENT_BASEMAP_MAX_SCALE, environmentBasemapNumber(value, 1)));
}

function environmentBasemapCanvasSize(layer) {
  return {
    width: Math.max(1, Number.parseFloat(layer?.style?.getPropertyValue("--basemap-stage-width")) || layer?.offsetWidth || 1),
    height: Math.max(1, Number.parseFloat(layer?.style?.getPropertyValue("--basemap-stage-height")) || layer?.offsetHeight || 1),
  };
}

function environmentBasemapViewportSize(viewer) {
  const viewport = getEnvironmentBasemapViewport(viewer) || viewer;
  return {
    width: Math.max(1, viewport?.clientWidth || viewer?.clientWidth || 1),
    height: Math.max(1, viewport?.clientHeight || viewer?.clientHeight || 1),
  };
}

function updateEnvironmentBasemapZoomLabel(viewer, scale, mode = "") {
  const labelRoot = viewer?.closest?.(".environment-basemap-map") || viewer || document;
  const label = labelRoot?.querySelector?.("[data-environment-basemap-zoom-label]");
  if (!label) return;
  label.textContent = mode === "fit" ? "适应" : `${Math.round(scale * 100)}%`;
}

function applyEnvironmentBasemapTransform(viewer) {
  const layer = getEnvironmentBasemapPanZoomLayer(viewer);
  if (!layer) return;
  const scale = clampEnvironmentBasemapScale(viewer.dataset.basemapScale || 1);
  const panX = environmentBasemapNumber(viewer.dataset.basemapPanX, 0);
  const panY = environmentBasemapNumber(viewer.dataset.basemapPanY, 0);
  viewer.dataset.basemapScale = String(scale);
  viewer.dataset.basemapPanX = String(panX);
  viewer.dataset.basemapPanY = String(panY);
  layer.style.setProperty("--basemap-viewer-scale", String(scale));
  layer.style.setProperty("--basemap-viewer-x", `${panX}px`);
  layer.style.setProperty("--basemap-viewer-y", `${panY}px`);
  updateEnvironmentBasemapZoomLabel(viewer, scale, viewer.dataset.basemapMode);
}

function setEnvironmentBasemapTransform(viewer, nextScale, nextPanX, nextPanY, mode = "custom") {
  if (!viewer) return;
  viewer.dataset.basemapScale = String(clampEnvironmentBasemapScale(nextScale));
  viewer.dataset.basemapPanX = String(environmentBasemapNumber(nextPanX, 0));
  viewer.dataset.basemapPanY = String(environmentBasemapNumber(nextPanY, 0));
  viewer.dataset.basemapMode = mode;
  applyEnvironmentBasemapTransform(viewer);
}

function fitEnvironmentBasemapViewer(viewer) {
  if (!viewer) return;
  const layer = getEnvironmentBasemapPanZoomLayer(viewer);
  if (!layer) return;
  const canvas = environmentBasemapCanvasSize(layer);
  const viewport = environmentBasemapViewportSize(viewer);
  const availableWidth = Math.max(1, viewport.width - ENVIRONMENT_BASEMAP_FIT_PADDING);
  const availableHeight = Math.max(1, viewport.height - ENVIRONMENT_BASEMAP_FIT_PADDING);
  const scale = clampEnvironmentBasemapScale(Math.min(availableWidth / canvas.width, availableHeight / canvas.height));
  const panX = (viewport.width - canvas.width * scale) / 2;
  const panY = (viewport.height - canvas.height * scale) / 2;
  setEnvironmentBasemapTransform(viewer, scale, panX, panY, "fit");
}

function zoomEnvironmentBasemapAt(viewer, nextScale, clientX = null, clientY = null) {
  if (!viewer) return;
  const viewport = getEnvironmentBasemapViewport(viewer);
  if (!viewport) return;
  const currentScale = clampEnvironmentBasemapScale(viewer.dataset.basemapScale || 1);
  const scale = clampEnvironmentBasemapScale(nextScale);
  const rect = viewport.getBoundingClientRect();
  const focusX = Number.isFinite(clientX) ? clientX - rect.left : rect.width / 2;
  const focusY = Number.isFinite(clientY) ? clientY - rect.top : rect.height / 2;
  const panX = environmentBasemapNumber(viewer.dataset.basemapPanX, 0);
  const panY = environmentBasemapNumber(viewer.dataset.basemapPanY, 0);
  const contentX = (focusX - panX) / currentScale;
  const contentY = (focusY - panY) / currentScale;
  setEnvironmentBasemapTransform(viewer, scale, focusX - contentX * scale, focusY - contentY * scale, "custom");
}

function updateEnvironmentBasemapViewer(action, trigger = null) {
  const viewer = getEnvironmentBasemapViewer(trigger);
  if (!viewer) return;
  const currentScale = clampEnvironmentBasemapScale(viewer.dataset.basemapScale || 1);
  if (action === "fit") {
    fitEnvironmentBasemapViewer(viewer);
    return;
  }
  if (action === "zoom-in") zoomEnvironmentBasemapAt(viewer, currentScale * 1.16);
  if (action === "zoom-out") zoomEnvironmentBasemapAt(viewer, currentScale / 1.16);
}

function handleEnvironmentBasemapWheel(event) {
  const viewport = event.target?.closest?.("[data-environment-basemap-viewport]");
  const viewer = viewport?.closest?.("[data-environment-basemap-viewer]");
  if (!viewer) return false;
  event.preventDefault();
  const currentScale = clampEnvironmentBasemapScale(viewer.dataset.basemapScale || 1);
  const factor = Math.exp(-event.deltaY * 0.0012);
  zoomEnvironmentBasemapAt(viewer, currentScale * factor, event.clientX, event.clientY);
  return true;
}

function beginEnvironmentBasemapDrag(event) {
  if (event.button !== 0) return;
  const viewport = event.target?.closest?.("[data-environment-basemap-viewport]");
  const viewer = viewport?.closest?.("[data-environment-basemap-viewer]");
  const layer = getEnvironmentBasemapPanZoomLayer(viewer);
  if (!viewport || !viewer || !layer || event.target?.closest?.("[data-environment-basemap-action], [data-environment-basemap-fullscreen]")) return;
  environmentBasemapDragState.active = true;
  environmentBasemapDragState.pointerId = event.pointerId;
  environmentBasemapDragState.startX = event.clientX;
  environmentBasemapDragState.startY = event.clientY;
  environmentBasemapDragState.panX = environmentBasemapNumber(viewer.dataset.basemapPanX, 0);
  environmentBasemapDragState.panY = environmentBasemapNumber(viewer.dataset.basemapPanY, 0);
  environmentBasemapDragState.moved = false;
  layer.classList.add("is-dragging");
  viewport.setPointerCapture?.(event.pointerId);
  event.preventDefault();
}

function updateEnvironmentBasemapDrag(event) {
  if (!environmentBasemapDragState.active) return;
  if (environmentBasemapDragState.pointerId !== event.pointerId) return;
  const viewer = document.querySelector("[data-environment-basemap-viewer]");
  if (!viewer) return;
  const deltaX = event.clientX - environmentBasemapDragState.startX;
  const deltaY = event.clientY - environmentBasemapDragState.startY;
  if (!environmentBasemapDragState.moved && Math.hypot(deltaX, deltaY) < ENVIRONMENT_BASEMAP_DRAG_THRESHOLD) return;
  environmentBasemapDragState.moved = true;
  setEnvironmentBasemapTransform(
    viewer,
    viewer.dataset.basemapScale || 1,
    environmentBasemapDragState.panX + deltaX,
    environmentBasemapDragState.panY + deltaY,
    "custom",
  );
}

function endEnvironmentBasemapDrag(event) {
  if (!environmentBasemapDragState.active) return;
  if (environmentBasemapDragState.pointerId !== event.pointerId) return;
  const viewport = document.querySelector("[data-environment-basemap-viewport]");
  const layer = getEnvironmentBasemapPanZoomLayer(document.querySelector("[data-environment-basemap-viewer]"));
  viewport?.releasePointerCapture?.(event.pointerId);
  layer?.classList.remove("is-dragging");
  if (environmentBasemapDragState.moved) {
    environmentBasemapDragState.suppressNextClick = true;
    window.setTimeout(() => {
      environmentBasemapDragState.suppressNextClick = false;
    }, 80);
  }
  environmentBasemapDragState.active = false;
  environmentBasemapDragState.pointerId = null;
  environmentBasemapDragState.moved = false;
}

function prepareEnvironmentBasemapNodeTooltips(slot) {
  slot?.querySelectorAll?.(".basemap-node[title]").forEach((node) => {
    const value = node.getAttribute("title");
    if (value) node.dataset.basemapTooltip = value;
    node.removeAttribute("title");
  });
}

function hideEnvironmentBasemapTooltip() {
  if (environmentBasemapTooltipState.timer) window.clearTimeout(environmentBasemapTooltipState.timer);
  environmentBasemapTooltipState.timer = 0;
  environmentBasemapTooltipState.node = null;
  document.querySelectorAll("[data-environment-basemap-tooltip]").forEach((tooltip) => {
    tooltip.hidden = true;
    tooltip.textContent = "";
  });
}

function showEnvironmentBasemapTooltip(node) {
  const viewer = getEnvironmentBasemapViewer(node);
  const viewport = getEnvironmentBasemapViewport(viewer);
  const tooltip = viewer?.querySelector?.("[data-environment-basemap-tooltip]");
  if (!node || !viewport || !tooltip || environmentBasemapTooltipState.node !== node) return;
  const label = text(node.dataset.basemapTooltip || node.dataset.label || node.dataset.mxId).trim();
  if (!label) return;
  const viewportRect = viewport.getBoundingClientRect();
  const nodeRect = node.getBoundingClientRect();
  tooltip.textContent = label;
  tooltip.hidden = false;
  const top = Math.max(10, Math.min(viewportRect.height - 46, nodeRect.top - viewportRect.top + 12));
  const left = Math.max(10, Math.min(viewportRect.width - 260, nodeRect.right - viewportRect.left + 10));
  tooltip.style.transform = `translate(${left}px, ${top}px)`;
}

function scheduleEnvironmentBasemapTooltip(node) {
  if (!node) return;
  hideEnvironmentBasemapTooltip();
  environmentBasemapTooltipState.node = node;
  environmentBasemapTooltipState.timer = window.setTimeout(() => {
    environmentBasemapTooltipState.timer = 0;
    showEnvironmentBasemapTooltip(node);
  }, ENVIRONMENT_BASEMAP_TOOLTIP_DELAY);
}

function handleEnvironmentBasemapPointerOver(event) {
  const node = event.target?.closest?.(".basemap-node[data-mx-id]");
  if (!node || !event.target?.closest?.("[data-environment-basemap-viewport]")) return;
  scheduleEnvironmentBasemapTooltip(node);
}

function handleEnvironmentBasemapPointerOut(event) {
  const node = event.target?.closest?.(".basemap-node[data-mx-id]");
  if (!node) return;
  if (node.contains(event.relatedTarget)) return;
  hideEnvironmentBasemapTooltip();
}

async function hydrateEnvironmentBasemapHtml() {
  const slot = document.querySelector("[data-environment-basemap-html]");
  if (!slot || slot.dataset.basemapLoaded === "true") return;
  const url = slot.dataset.environmentBasemapHtml;
  if (!url) return;
  try {
    let html = environmentBasemapHtmlCache.get(url);
    if (!html) {
      const response = await fetch(url, { cache: "no-store" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      html = await response.text();
      environmentBasemapHtmlCache.set(url, html);
    }
    slot.innerHTML = html;
    prepareEnvironmentBasemapNodeTooltips(slot);
    slot.dataset.basemapLoaded = "true";
    requestAnimationFrame(() => fitEnvironmentBasemapViewer(slot.closest("[data-environment-basemap-viewer]")));
  } catch (error) {
    slot.innerHTML = `<div class="empty-state"><strong>信息化环境底图加载失败</strong><p>${escapeHtml(error?.message || "无法读取生成的 HTML 底图")}</p></div>`;
  }
}

function environmentBasemapTypeLabel(value) {
  const key = text(value).trim();
  return ENVIRONMENT_BASEMAP_OBJECT_TYPE_LABELS[key] || key || "未标注类型";
}

function environmentBasemapEntityName(entity) {
  if (!entity || typeof entity !== "object") return "";
  const code = text(entity.objectCode || entity.code).trim();
  const name = text(entity.objectName || entity.name || entity.title).trim();
  return [code, name].filter(Boolean).join(" ");
}

function pushEnvironmentBasemapName(names, seen, value) {
  const name = text(value).trim();
  if (!name || seen.has(name)) return;
  seen.add(name);
  names.push(name);
}

function collectEnvironmentBasemapNames(items, mapper) {
  const names = [];
  const seen = new Set();
  list(items).forEach((item) => pushEnvironmentBasemapName(names, seen, mapper(item)));
  return names;
}

function collectEnvironmentBasemapDetailLists(detail) {
  const mappings = list(detail?.scopeMappings);
  const scopes = collectEnvironmentBasemapNames(mappings, (mapping) => environmentBasemapEntityName(mapping.scope));
  const services = [];
  const modules = [];
  const measures = [];
  const seenServices = new Set();
  const seenModules = new Set();
  const seenMeasures = new Set();
  mappings.forEach((mapping) => {
    list(mapping.services).forEach((service) => {
      pushEnvironmentBasemapName(services, seenServices, environmentBasemapEntityName(service));
      list(service.modules).forEach((module) => {
        pushEnvironmentBasemapName(modules, seenModules, environmentBasemapEntityName(module));
      });
      list(service.measures).forEach((measure) => {
        pushEnvironmentBasemapName(measures, seenMeasures, environmentBasemapEntityName(measure));
      });
    });
  });
  return { scopes, services, modules, measures };
}

function renderEnvironmentBasemapValue(value) {
  const label = text(value).trim();
  return label ? `<span class="environment-basemap-value">${escapeHtml(label)}</span>` : '<span class="environment-basemap-empty-value">暂无</span>';
}

function renderEnvironmentBasemapChipList(items, maxItems = 10) {
  const values = list(items).map((item) => text(item).trim()).filter(Boolean);
  if (!values.length) return '<span class="environment-basemap-empty-value">暂无</span>';
  const visible = values.slice(0, maxItems);
  const hiddenCount = Math.max(0, values.length - visible.length);
  return `
    <div class="environment-basemap-chip-list">
      ${visible.map((item) => `<span class="environment-basemap-chip">${escapeHtml(item)}</span>`).join("")}
      ${hiddenCount ? `<span class="environment-basemap-chip is-more">另 ${escapeHtml(hiddenCount)} 项</span>` : ""}
    </div>
  `;
}

function renderEnvironmentBasemapField(label, valueHtml) {
  return `
    <div class="environment-basemap-detail-field">
      <dt>${escapeHtml(label)}</dt>
      <dd>${valueHtml}</dd>
    </div>
  `;
}

function renderEnvironmentBasemapBoundDetail(detail, node) {
  const lists = collectEnvironmentBasemapDetailLists(detail);
  const objectName =
    text(detail?.objectName).trim() ||
    environmentBasemapEntityName(detail?.informationObject) ||
    text(node?.dataset?.objectName).trim() ||
    text(node?.dataset?.label).trim() ||
    "未命名对象";
  const environmentName = environmentBasemapEntityName(detail?.environment) || (detail?.objectType === "information_environment" ? objectName : "");
  const segments = collectEnvironmentBasemapNames(detail?.segments, environmentBasemapEntityName);
  return `
    <div class="environment-basemap-detail-card is-bound">
      <div class="environment-basemap-detail-head">
        <strong>${escapeHtml(objectName)}</strong>
        <span>已绑定业务对象</span>
      </div>
      <dl class="environment-basemap-detail-grid">
        ${renderEnvironmentBasemapField("对象名称", renderEnvironmentBasemapValue(objectName))}
        ${renderEnvironmentBasemapField("对象类型", renderEnvironmentBasemapValue(environmentBasemapTypeLabel(detail?.objectType)))}
        ${renderEnvironmentBasemapField("所属环境", renderEnvironmentBasemapValue(environmentName))}
        ${renderEnvironmentBasemapField("环境子类", renderEnvironmentBasemapChipList(segments, 8))}
        ${renderEnvironmentBasemapField("作用域", renderEnvironmentBasemapChipList(lists.scopes, 8))}
        ${renderEnvironmentBasemapField("安全技术服务", renderEnvironmentBasemapChipList(lists.services, 8))}
        ${renderEnvironmentBasemapField("安全技术模块", renderEnvironmentBasemapChipList(lists.modules, 8))}
        ${renderEnvironmentBasemapField("安全技术措施", renderEnvironmentBasemapChipList(lists.measures, 8))}
      </dl>
    </div>
  `;
}

function environmentBasemapIgnoredReason(reason) {
  if (reason === "ignored_by_override") return "按绑定规则标记为图示 / 归类节点。";
  return "图示 / 归类节点，不绑定业务对象。";
}

function renderEnvironmentBasemapIgnoredDetail(ignoredNode, node) {
  const label = text(ignoredNode?.label || node?.dataset?.label).trim() || "未命名节点";
  const objectType = ignoredNode?.objectType || node?.dataset?.objectType || "";
  return `
    <div class="environment-basemap-detail-card is-ignored">
      <div class="environment-basemap-detail-head">
        <strong>${escapeHtml(label)}</strong>
        <span>图示 / 归类节点，不绑定业务对象</span>
      </div>
      <dl class="environment-basemap-detail-grid">
        ${renderEnvironmentBasemapField("对象类型", renderEnvironmentBasemapValue(environmentBasemapTypeLabel(objectType)))}
        ${renderEnvironmentBasemapField("忽略原因", renderEnvironmentBasemapValue(environmentBasemapIgnoredReason(ignoredNode?.bindingReason)))}
      </dl>
    </div>
  `;
}

function renderEnvironmentBasemapMissingDetail(node) {
  const label = text(node?.dataset?.label).trim() || "未命名节点";
  return `
    <div class="environment-basemap-detail-card is-empty">
      <div class="environment-basemap-detail-head">
        <strong>${escapeHtml(label)}</strong>
        <span>未找到可展示的业务详情</span>
      </div>
    </div>
  `;
}

function renderEnvironmentBasemapLoading(node) {
  const label = text(node?.dataset?.label).trim() || "节点";
  return `
    <div class="environment-basemap-detail-card is-loading">
      <div class="environment-basemap-detail-head">
        <strong>${escapeHtml(label)}</strong>
        <span>正在读取节点详情...</span>
      </div>
    </div>
  `;
}

function renderEnvironmentBasemapError(error) {
  return `
    <div class="environment-basemap-detail-card is-empty">
      <div class="environment-basemap-detail-head">
        <strong>节点详情加载失败</strong>
        <span>${escapeHtml(error?.message || "无法读取节点详情数据")}</span>
      </div>
    </div>
  `;
}

function clearEnvironmentBasemapSelection(viewer = document) {
  const root = viewer?.querySelectorAll ? viewer : document;
  root.querySelectorAll(".basemap-node.is-selected").forEach((item) => item.classList.remove("is-selected"));
  const selection = document.getElementById("environmentBasemapSelection");
  if (selection) selection.textContent = "点击底图中的业务对象查看详情。";
}

function getEnvironmentBasemapNodeDetailsPath(viewer) {
  return text(viewer?.dataset?.environmentBasemapNodeDetails || window.sapdEnvironmentBasemapData?.nodeDetailsPath).trim();
}

async function loadEnvironmentBasemapNodeDetails(viewer) {
  const url = getEnvironmentBasemapNodeDetailsPath(viewer);
  if (!url) return { nodeDetailsByMxId: {}, ignoredNodes: [] };
  const cached = environmentBasemapNodeDetailsCache.get(url);
  if (cached) return cached;
  const request = fetch(url, { cache: "no-store" }).then(async (response) => {
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  });
  environmentBasemapNodeDetailsCache.set(url, request);
  try {
    return await request;
  } catch (error) {
    environmentBasemapNodeDetailsCache.delete(url);
    throw error;
  }
}

function findEnvironmentBasemapIgnoredNode(details, mxId) {
  return list(details?.ignoredNodes).find((item) => item?.mxId === mxId);
}

async function selectEnvironmentBasemapNode(node) {
  if (!node) return;
  document.querySelectorAll(".basemap-node.is-selected").forEach((item) => {
    if (item !== node) item.classList.remove("is-selected");
  });
  node.classList.add("is-selected");
  const selection = document.getElementById("environmentBasemapSelection");
  if (!selection) return;
  const mxId = node.dataset.mxId || "";
  const viewer = getEnvironmentBasemapViewer(node);
  selection.innerHTML = renderEnvironmentBasemapLoading(node);
  try {
    const details = await loadEnvironmentBasemapNodeDetails(viewer);
    if (!node.classList.contains("is-selected")) return;
    const detail = details?.nodeDetailsByMxId?.[mxId];
    if (detail) {
      selection.innerHTML = renderEnvironmentBasemapBoundDetail(detail, node);
      return;
    }
    const ignoredNode = findEnvironmentBasemapIgnoredNode(details, mxId);
    if (ignoredNode || node.dataset.bindStatus === "ignored") {
      selection.innerHTML = renderEnvironmentBasemapIgnoredDetail(ignoredNode, node);
      return;
    }
    selection.innerHTML = renderEnvironmentBasemapMissingDetail(node);
  } catch (error) {
    if (!node.classList.contains("is-selected")) return;
    selection.innerHTML = renderEnvironmentBasemapError(error);
  }
}

function renderModelingLanguageOverviewPanel() {
  const posterTarget = getModelingPosterTarget("full");
  return `
    <section class="modeling-poster-panel">
      <div class="modeling-poster-page-viewer">
        <div class="modeling-poster-page-stage" aria-label="ArchiMate Poster 整页图">
          <button class="modeling-poster-image-map" type="button" data-modeling-poster-open="full" aria-label="查看 ArchiMate Poster 大图">
            ${renderModelingPosterImage(posterTarget, "is-overview", "eager")}
          </button>
        </div>
      </div>
    </section>
    ${renderModelingPosterLightbox()}
  `;
}

function renderModelingLanguageGuide(routeInfo = {}) {
  ensureUserFavoritesLoaded();
  const workspace = $("contentWorkspace");
  const detailPane = document.querySelector(".content-detail-pane");
  workspace?.classList.remove("guide-slide-layout");
  workspace?.classList.add("modeling-language-guide-workspace");
  detailPane?.classList.add("is-hidden");
  if (workspace) {
    workspace.querySelectorAll(":scope > .workspace-resizer").forEach((handle) => handle.remove());
    workspace.classList.remove("is-resizable");
    workspace.dataset.resizableReady = "";
    workspace.style.gridTemplateColumns = "";
    workspace._paneWidths = null;
  }

  const activeTab = MODELING_LANGUAGE_GUIDE_TABS.some((tab) => tab.id === state.activeModelingLanguageTab)
    ? state.activeModelingLanguageTab
    : MODELING_LANGUAGE_GUIDE_TABS[0].id;
  state.activeModelingLanguageTab = activeTab;
  if (workspace) workspace.dataset.modelingLanguageTab = activeTab;
  const activeTabLabel = MODELING_LANGUAGE_GUIDE_TABS.find((tab) => tab.id === activeTab)?.label || "安全架构建模语言";
  const tabPanels = {
    overview: renderModelingLanguageOverviewPanel(),
    elements: renderModelingElementLegendPanel(),
  };
  const headerActions = activeTab === "overview" ? `
    <div class="modeling-poster-actions">
      <button class="modeling-poster-expand-button" type="button" data-modeling-poster-open="full">
        <span aria-hidden="true">⤢</span>
        全页面显示
      </button>
      <a class="modeling-poster-download" href="${escapeHtml(ARCHIMATE_POSTER_PDF_PATH)}" download="archimate-poster-v3.2-zh.pdf">
        <span aria-hidden="true">↓</span>
        下载 PDF
      </a>
    </div>
  ` : `
    <div class="modeling-legend-bulk-actions" aria-label="元素图例折叠控制">
      <button class="modeling-legend-bulk-button" type="button" data-modeling-legend-action="expand-all">全部展开</button>
      <button class="modeling-legend-bulk-button" type="button" data-modeling-legend-action="collapse-all">全部收起</button>
    </div>
  `;

  const tabs = MODELING_LANGUAGE_GUIDE_TABS.map(
    (tab) => `
      <button class="maintenance-section-tab ${tab.id === activeTab ? "active" : ""}" type="button" role="tab" aria-selected="${tab.id === activeTab ? "true" : "false"}" data-modeling-language-tab="${escapeHtml(tab.id)}">
        <span>${escapeHtml(tab.label)}</span>
      </button>
    `,
  ).join("");
  const routeItem = routeInfo.item || {};
  setCurrentAnnotationTarget(contentUserTarget(null, routeInfo), { pageTitle: routeItem.label || "安全架构建模语言" });
  setText("contentNavTitle", "");
  setHtml("contentNavList", "");
  setText("contentPageTitle", activeTabLabel);
  const pageCount = $("contentPageCount");
  if (pageCount) pageCount.className = "count-pill";
  setText("contentPageCount", "");
  setHtml(
    "modelingLanguageHeaderTabs",
    `
      <div class="maintenance-section-tabs modeling-language-tabs" role="tablist" aria-label="安全架构建模语言页签">
        ${tabs}
      </div>
    `,
  );
  setHtml(
    "contentList",
    `
      <article class="modeling-language-guide-panel">
        <header class="modeling-language-guide-header">
          <h2>${escapeHtml(activeTabLabel)}</h2>
          ${headerActions}
        </header>
        <div class="modeling-language-guide-body" role="tabpanel">
          ${activeTab === "elements" ? `
            <section class="modeling-language-lead">
              <p>SAPD 安全架构建模使用的元素图例，按受控 registry 渲染。</p>
            </section>
          ` : ""}
          ${tabPanels[activeTab]}
        </div>
      </article>
    `,
  );
  setText("contentDetailType", "");
  setHtml("contentDetail", "");
}

function renderSlideDeck(row) {
  const slides = contentSlides(row);
  if (!slides.length) return emptyState("暂无幻灯片", "请确认内容包是否包含 slide_count 或 slides。");
  const activeIndex = clampSlideIndex(slides);
  state.selectedContentSlideIndex = activeIndex;
  const activeSlide = slides[activeIndex];
  const slideTarget = contentSlideUserTarget(row, activeSlide, activeIndex);
  const slideTargetAttrs = annotationTargetAttrsForHtml(slideTarget);
  const previousDisabled = activeIndex <= 0 ? "disabled" : "";
  const nextDisabled = activeIndex >= slides.length - 1 ? "disabled" : "";
  return `
    <div class="guide-slide-player" data-guide-id="${escapeHtml(row.id)}">
      <div class="guide-slide-stage" tabindex="0" aria-label="${escapeHtml(`${row.title || "指南"}第 ${activeSlide.pageNumber} 页`)}" data-annotation-slide-stage="true" ${slideTargetAttrs}>
        <img src="${escapeHtml(activeSlide.image)}" alt="${escapeHtml(activeSlide.title)}" loading="eager" />
        <div class="guide-slide-controls" aria-label="幻灯片翻页控制">
          <button class="guide-slide-arrow" type="button" data-content-slide-step="-1" aria-label="上一页" title="上一页" ${previousDisabled}>
            <span aria-hidden="true">‹</span>
          </button>
          <span class="guide-slide-page">第 ${activeSlide.pageNumber} / ${slides.length} 页</span>
          <button class="guide-slide-arrow" type="button" data-content-slide-step="1" aria-label="下一页" title="下一页" ${nextDisabled}>
            <span aria-hidden="true">›</span>
          </button>
        </div>
      </div>
    </div>
  `;
}

function renderSlidePreviewRail(row) {
  const slides = contentSlides(row);
  if (!slides.length) return "";
  const activeIndex = clampSlideIndex(slides);
  return `
    <div class="guide-thumb-rail guide-thumb-rail-nav" aria-label="幻灯片页面预览">
      ${slides
        .map(
          (slide, index) => {
            const slideTarget = contentSlideUserTarget(row, slide, index);
            return `
            <button class="guide-thumb ${index === activeIndex ? "active" : ""}" type="button" data-content-slide-index="${index}" aria-label="查看第 ${slide.pageNumber} 页" ${annotationTargetAttrsForHtml(slideTarget)}>
              <img src="${escapeHtml(slide.image)}" alt="" loading="lazy" />
              <span>${slide.pageNumber}</span>
            </button>
          `;
          },
        )
        .join("")}
    </div>
  `;
}

function renderContentDetail(selected) {
  if (!selected) return emptyState("请选择内容");
  const slides = contentSlides(selected);
  const activeIndex = clampSlideIndex(slides);
  const activeSlide = slides[activeIndex];
  if (slides.length) {
    return `
      <div class="source-entity-code">${escapeHtml(selected.category || "安全指南")}</div>
      <h2 class="source-entity-title">${escapeHtml(selected.title || "未命名内容")}</h2>
      <p class="source-entity-desc">${escapeHtml(selected.content || selected.note || "本地指南幻灯片视图。")}</p>
      <dl class="guide-detail-list">
        <div><dt>当前页</dt><dd>${escapeHtml(activeSlide ? `${activeSlide.pageNumber} / ${slides.length}` : `0 / ${slides.length}`)}</dd></div>
        <div><dt>视图类型</dt><dd>${escapeHtml(selected.view_type || "slide_deck")}</dd></div>
      </dl>
    `;
  }
  return `
    <div class="source-entity-code">${escapeHtml(selected.view_type || selected.category || "内容")}</div>
    <h2 class="source-entity-title">${escapeHtml(selected.title || "未命名内容")}</h2>
    <p class="source-entity-desc">${escapeHtml(selected.content || selected.note || "首版为索引占位，后续补充预览内容。")}</p>
  `;
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

function capabilityAncestorIds(targetId) {
  for (const category of list(state.capability?.categories)) {
    if (category.id === targetId) return [];
    for (const domain of list(category.domains)) {
      if (domain.id === targetId) return [category.id];
      for (const capability of list(domain.capabilities)) {
        if (capability.id === targetId) return [category.id, domain.id];
        if (list(capability.focuses).some((item) => item.id === targetId)) return [category.id, domain.id, capability.id];
      }
    }
  }
  return [];
}

function capabilityCategoryIds() {
  return list(state.capability?.categories)
    .map((category) => category.id)
    .filter(Boolean);
}

function lifecycleProcesses(kind) {
  if (kind === "dev") return list(state.lifecycle?.application_security_development?.processes);
  return list(state.lifecycle?.data_lifecycle?.processes);
}

function contentRows() {
  let rows = list(state.content?.html_documents);
  if (state.activeContentPage === "drawio") rows = list(state.content?.diagram_views);
  if (state.activeContentPage === "ppt") rows = list(state.content?.guide_pages);
  if (state.activeRoute.startsWith("/guides/")) {
    const routeRows = rows.filter((row) => row.route === state.activeRoute);
    return routeRows;
  }
  return rows;
}

function renderMetrics() {
  const capabilityStats = state.capabilityWorkbench?.meta?.stats || state.capability?.stats || {};
  const environmentStats = state.environmentWorkbench?.meta?.stats || {};
  const lifecycleStats = state.lifecycleWorkbench?.meta?.stats || state.lifecycle?.stats || {};
  const metrics = [
    ["能力", capabilityStats.capability || capabilityStats.capabilities || 0],
    ["关注点", capabilityStats.capability_focus || capabilityStats.focuses || 0],
    ["服务", capabilityStats.security_technical_service || capabilityStats.services || 0],
    ["环境", environmentStats.information_environment || environmentStats.information_environments || 0],
    ["生命周期", lifecycleStats.lifecycle_stage || (lifecycleStats.application_processes || 0) + (lifecycleStats.data_processes || 0)],
  ];
  setHtml("metrics", metrics.map(([label, value]) => `<div class="metric"><strong>${value}</strong><span>${label}</span></div>`).join(""));
}

function formatNumber(value) {
  const number = Number(value) || 0;
  return number.toLocaleString("zh-CN");
}

function formatMetricValue(value, unit = "") {
  if (typeof value === "number") return `${formatNumber(value)}${unit && unit !== "个" ? unit : ""}`;
  return `${text(value) || "0"}${unit && !text(value).includes(unit) ? unit : ""}`;
}

function percentOf(value, total) {
  if (!total) return 0;
  return Math.max(0, Math.min(100, Math.round((Number(value) / Number(total)) * 100)));
}

function workbenchSummary({ id, label, shortLabel, route, workbench, tone, dimensions }) {
  const objects = workbench?.objects && typeof workbench.objects === "object" ? workbench.objects : {};
  const objectCounts = Object.fromEntries(Object.entries(objects).map(([type, rows]) => [type, rows && typeof rows === "object" ? Object.keys(rows).length : 0]));
  const metaStats = workbench?.meta?.stats || {};
  const objectTotal = Number(metaStats.objects) || Object.values(objectCounts).reduce((sum, count) => sum + Number(count || 0), 0);
  const relationTotal = Number(metaStats.relations) || list(workbench?.relations).length;
  const evidenceTotal = Number(metaStats.evidenceRefs) || list(workbench?.evidenceRefs).length;
  const stateLabel = workbench ? (workbench.__data_state === "missing_file" ? "missing_file" : "ready") : "loading";
  return {
    id,
    label,
    shortLabel,
    route,
    tone,
    dimensions,
    dataState: stateLabel,
    objectCounts,
    objectTotal,
    relationTotal,
    evidenceTotal,
    relationshipGroupCount: list(workbench?.relationshipGroups).length,
  };
}

function dashboardSummaries() {
  const summary = state.analyticsSummary || {};
  const coverageDimensions = list(summary.coverageSummary?.dimensions);
  const entryViews = list(summary.moduleSummary?.entryViews);
  const heroMetrics = list(summary.businessSummary?.heroMetrics);
  const capabilityMap = summary.businessSummary?.capabilityMap || {};
  const standardControls = summary.reconciliationSummary?.standardControls || {};
  const metricById = Object.fromEntries(heroMetrics.map((item) => [item.id, item]));
  const primaryEntries = list(summary.navigationSummary?.primaryEntries);
  const secondaryEntries = list(summary.navigationSummary?.secondaryEntries);
  return {
    raw: summary,
    dataState: summary.meta?.dataState || summary.compatibility?.sourcePackages?.[0]?.dataState || "loading",
    page: summary.page || {},
    titleMetric: summary.businessSummary?.headline?.titleMetric || {},
    supportingText: summary.businessSummary?.headline?.supportingText || "",
    coverageDimensions,
    entryViews,
    heroMetrics,
    metricById,
    capabilityMap,
    standardControls,
    primaryEntries,
    secondaryEntries,
    totalFocuses: Number(summary.coverageSummary?.totalFocuses || summary.meta?.stats?.focusCount || 0),
    sourcePackageCount: Number(summary.meta?.stats?.sourcePackageCount || list(summary.meta?.sourcePackages).length || 0),
  };
}

function renderDashboardMetric({ label, value, unit = "", hint, tone = "neutral" }) {
  return `
    <div class="dashboard-metric dashboard-tone-${escapeHtml(tone)}">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(formatMetricValue(value, unit))}</strong>
      <small>${escapeHtml(hint)}</small>
    </div>
  `;
}

function renderDashboardCoverageRows(dimensions) {
  return list(dimensions)
    .map(
      (item) => `
        <div class="dashboard-bar-row">
          <span>${escapeHtml(item.label)}</span>
          <div class="dashboard-bar-track"><i class="dashboard-tone-blue" style="width:${Math.max(0, Math.min(100, Number(item.percent) || 0))}%"></i></div>
          <strong>${escapeHtml(`${formatNumber(item.covered)}/${formatNumber(item.total)}`)}</strong>
        </div>
      `,
    )
    .join("");
}

function renderDashboardCapabilityMap(map) {
  const rows = [
    { label: "能力大类", value: map.categories || 0, tone: "blue" },
    { label: "能力域", value: map.domains || 0, tone: "green" },
    { label: "能力", value: map.capabilities || 0, tone: "amber" },
    { label: "关注点", value: map.focuses || 0, tone: "purple" },
  ];
  const total = Number(map.focuses || 0);
  const colors = [
    "oklch(0.49 0.055 224)",
    "oklch(0.51 0.048 150)",
    "oklch(0.56 0.054 48)",
    "oklch(0.53 0.05 300)",
  ];
  let cursor = 0;
  const max = Math.max(...rows.map((item) => Number(item.value) || 0), 1);
  const stops = rows
    .map((item, index) => {
      const start = cursor;
      const end = cursor + (Number(item.value || 0) / max) * 25;
      cursor = end;
      return `${colors[index]} ${start}% ${end}%`;
    })
    .join(", ");
  return `
    <div class="dashboard-donut-wrap">
      <div class="dashboard-donut" style="background:conic-gradient(${escapeHtml(stops || "oklch(0.86 0.014 86) 0% 100%")})">
        <div><strong>${escapeHtml(formatNumber(total))}</strong><span>关注点</span></div>
      </div>
      <div class="dashboard-legend">
        ${rows
          .map(
            (item, index) => `
              <div><i style="background:${colors[index]}"></i><span>${escapeHtml(item.label)}</span><strong>${escapeHtml(formatNumber(item.value))}</strong></div>
            `,
          )
          .join("")}
      </div>
    </div>
  `;
}

function renderDashboardSatellite(entries) {
  const visibleEntries = [
    { id: "capability_mapping", className: "capability", label: "安全能力映射", route: "/capability-mapping", hint: "能力关注点主入口" },
    { id: "environment_scope", className: "environment", label: "信息化环境维度", route: "/environment-mapping", hint: "环境与对象映射" },
    { id: "lifecycle_ap", className: "lifecycle", label: "LC-AP安全开发生命周期", route: "/development-security", hint: "安全开发过程" },
    { id: "standards", className: "standards", label: "安全标准 / 框架", route: "/standards", hint: "标准控制项" },
    { id: "guides", className: "content", label: "安全指南", route: "/guides/security-architecture-design", hint: "指南 / 幻灯片" },
  ].map((fallback) => ({ ...fallback, ...(list(entries).find((item) => item.id === fallback.id) || {}) }));
  return `
    <div class="dashboard-satellite" aria-label="业务关系卫星图">
      <span class="satellite-line satellite-line-capability"></span>
      <span class="satellite-line satellite-line-environment"></span>
      <span class="satellite-line satellite-line-lifecycle"></span>
      <span class="satellite-line satellite-line-standards"></span>
      <span class="satellite-line satellite-line-content"></span>
      <button class="satellite-node satellite-hub" type="button" data-app-route="/" data-view="overview">
        <strong>能力知识地图</strong>
        <small>capability_focus</small>
      </button>
      ${visibleEntries
        .map(
          (item) => `
            <button class="satellite-node satellite-${escapeHtml(item.className)}" type="button" data-app-route="${escapeHtml(item.route)}">
              <strong>${escapeHtml(item.label)}</strong>
              <small>${escapeHtml(item.hint || item.primaryGrain || "")}</small>
            </button>
          `,
        )
        .join("")}
    </div>
  `;
}

function renderOverview() {
  const summary = dashboardSummaries();
  const technicalCoverage = summary.metricById.technical_service_coverage || {};
  const standardCoverage = summary.metricById.standard_mapping_coverage || {};
  const environmentReach = summary.coverageDimensions.find((item) => item.id === "environment_reach") || {};
  const lifecycleReach = summary.coverageDimensions.find((item) => item.id === "lifecycle_reach") || {};
  setHtml(
    "overviewWorkspace",
    `
      <section class="dashboard-hero">
        <div>
          <span class="dashboard-kicker">SAPD Wiki / Capability Map</span>
          <h2>${escapeHtml(summary.page.title || "安全能力知识地图")}</h2>
          <p>${escapeHtml(summary.page.subtitle || summary.supportingText || "以能力关注点为核心查看技术、环境、生命周期、标准和工作方法的支撑关系。")}</p>
        </div>
        <div class="dashboard-state">
          <span>${escapeHtml(summary.dataState)}</span>
          <strong>${escapeHtml(formatNumber(summary.totalFocuses))}</strong>
          <small>能力关注点</small>
        </div>
      </section>
      <section class="dashboard-metric-grid">
        ${renderDashboardMetric({ label: summary.titleMetric.label || "能力关注点", value: summary.titleMetric.value || summary.totalFocuses, unit: summary.titleMetric.unit || "个", hint: "主统计粒度 capability_focus", tone: "blue" })}
        ${renderDashboardMetric({ label: technicalCoverage.label || "技术服务支撑", value: technicalCoverage.value ?? technicalCoverage.percent ?? 0, unit: "%", hint: `${formatNumber(technicalCoverage.numerator || technicalCoverage.covered || 0)}/${formatNumber(technicalCoverage.denominator || technicalCoverage.total || summary.totalFocuses)} 关注点`, tone: "green" })}
        ${renderDashboardMetric({ label: standardCoverage.label || "标准映射覆盖", value: standardCoverage.value ?? standardCoverage.percent ?? 0, unit: "%", hint: `${formatNumber(standardCoverage.numerator || standardCoverage.covered || 0)}/${formatNumber(standardCoverage.denominator || standardCoverage.total || summary.totalFocuses)} 关注点`, tone: "amber" })}
        ${renderDashboardMetric({ label: "环境可达", value: environmentReach.percent || 0, unit: "%", hint: `${formatNumber(environmentReach.covered || 0)}/${formatNumber(environmentReach.total || summary.totalFocuses)} 关注点`, tone: "purple" })}
        ${renderDashboardMetric({ label: "生命周期可达", value: lifecycleReach.percent || 0, unit: "%", hint: `${formatNumber(lifecycleReach.covered || 0)}/${formatNumber(lifecycleReach.total || summary.totalFocuses)} 关注点`, tone: "slate" })}
        ${renderDashboardMetric({ label: "分析入口", value: list(summary.entryViews).length || summary.metricById.module_entry_count?.value || 0, unit: "个", hint: "可进入的业务页面", tone: "neutral" })}
      </section>
      <section class="dashboard-grid dashboard-grid-primary">
        <article class="dashboard-panel dashboard-panel-bars">
          <header>
            <div>
              <h3>能力关注点覆盖</h3>
              <p>所有覆盖率统一以 ${escapeHtml(formatNumber(summary.totalFocuses))} 个能力关注点为分母。</p>
            </div>
            <span class="dashboard-chip">capability_focus</span>
          </header>
          <div class="dashboard-bars">
            <section><h4>主要支撑</h4>${renderDashboardCoverageRows(summary.coverageDimensions.filter((item) => item.displayRole === "primary"))}</section>
            <section><h4>扩展可达</h4>${renderDashboardCoverageRows(summary.coverageDimensions.filter((item) => item.displayRole !== "primary"))}</section>
            <section><h4>标准 grain</h4>${renderDashboardCoverageRows([{ label: "能力映射可达", covered: summary.standardControls.capabilityMapped || 0, total: summary.standardControls.standardsIndex || 1, percent: percentOf(summary.standardControls.capabilityMapped || 0, summary.standardControls.standardsIndex || 1) }, { label: "标准索引", covered: summary.standardControls.standardsIndex || 0, total: summary.standardControls.standardsIndex || 0, percent: 100 }])}</section>
          </div>
        </article>
        <article class="dashboard-panel">
          <header>
            <div>
              <h3>能力地图层级</h3>
              <p>${escapeHtml(summary.supportingText || "能力体系按类、域、能力和关注点组织。")}</p>
            </div>
            <span class="dashboard-chip">层级</span>
          </header>
          ${renderDashboardCapabilityMap(summary.capabilityMap)}
        </article>
      </section>
      <section class="dashboard-grid dashboard-grid-secondary">
        <article class="dashboard-panel dashboard-panel-satellite">
          <header>
            <div>
              <h3>工作入口关系图</h3>
              <p>从能力知识地图进入核心业务页面，不在首页重新推断关系。</p>
            </div>
            <span class="dashboard-chip">入口</span>
          </header>
          ${renderDashboardSatellite(summary.entryViews)}
        </article>
        <article class="dashboard-panel">
          <header>
            <div>
              <h3>分析入口</h3>
              <p>每个入口保留自己的业务粒度，dashboard 只做导航和摘要。</p>
            </div>
            <span class="dashboard-chip">模块</span>
          </header>
          <div class="dashboard-package-list">
            ${summary.entryViews
              .map(
                (item) => `
                  <button class="dashboard-package-row" type="button" data-app-route="${escapeHtml(item.route)}">
                    <span class="dashboard-package-title"><strong>${escapeHtml(item.label)}</strong><small>${escapeHtml(item.sourcePackage || "")}</small></span>
                    <span><b>${escapeHtml(formatNumber(item.objectCount || 0))}</b><small>对象</small></span>
                    <span><b>${escapeHtml(item.primaryGrain || "-")}</b><small>grain</small></span>
                    <i>${escapeHtml(item.id)}</i>
                  </button>
                `,
              )
              .join("")}
          </div>
        </article>
      </section>
      <section class="dashboard-panel dashboard-panel-table">
        <header>
          <div>
            <h3>覆盖率来源矩阵</h3>
            <p>覆盖率只展示业务口径、来源包和关系类型，不暴露来源追踪中间字段。</p>
          </div>
          <span class="dashboard-chip">覆盖</span>
        </header>
        <div class="dashboard-table-wrap">
          <table class="dashboard-table">
            <thead><tr><th>维度</th><th>覆盖</th><th>百分比</th><th>来源包</th><th>关系类型</th><th>入口</th></tr></thead>
            <tbody>
              ${summary.coverageDimensions
                .map(
                  (item) => `
                    <tr>
                      <td><button type="button" data-app-route="${escapeHtml(item.route)}">${escapeHtml(item.label)}</button><small>${escapeHtml(item.id)}</small></td>
                      <td>${escapeHtml(`${formatNumber(item.covered)}/${formatNumber(item.total)}`)}</td>
                      <td>${escapeHtml(`${item.percent}%`)}</td>
                      <td>${escapeHtml(item.sourcePackage)}</td>
                      <td>${escapeHtml(list(item.relationTypes).join("、"))}</td>
                      <td><span class="dashboard-status">${escapeHtml(item.displayRole || "secondary")}</span></td>
                    </tr>
                  `,
                )
                .join("")}
            </tbody>
          </table>
        </div>
      </section>
    `,
  );
}

function mountAppShellComponents() {
  const components = window.sapdComponents || {};
  components.AppShell?.mountApplicationShell?.({
    activeRoute: state.activeRoute,
    activeModelingLanguageTab: state.activeModelingLanguageTab,
    activeEnvironmentTab: state.activeEnvironmentTab,
  });
  components.AppShell?.mountCapabilityWorkspace($("capabilityWorkspace"));
  if ($("localModeStatus")) setHtml("localModeStatus", components.AppShell?.renderLocalModeStatus?.() || '<span class="type-pill">本地模式</span>');
}

function applyRouteTarget(target = {}) {
  if (target.maintenancePage) {
    state.activeMaintenancePage = target.maintenancePage;
    state.selectedMaintenanceId = null;
  }
  if (target.referenceTab) state.activeReferenceTab = target.referenceTab;
  if (target.standardFramework) {
    if (state.activeStandardFramework !== target.standardFramework) state.activeStandardTableId = "";
    state.activeStandardFramework = target.standardFramework;
    state.selectedMaintenanceId = null;
  }
  if (target.contentPage) {
    state.activeContentPage = target.contentPage;
    state.selectedContentId = null;
    state.selectedContentSlideIndex = 0;
  }
}

function normalizeAppRoute(route) {
  const value = text(route).trim();
  if (!value) return "/";
  const withoutHash = value.startsWith("#") ? value.slice(1) : value;
  const withoutQuery = withoutHash.split("?")[0];
  const normalized = withoutQuery.startsWith("/") ? withoutQuery : `/${withoutQuery}`;
  return normalized.replace(/\/+$/, "") || "/";
}

function routeFromBrowserLocation() {
  const hashRoute = normalizeAppRoute(window.location.hash || "");
  if (hashRoute !== "/") return hashRoute;
  const pathname = window.location.pathname || "/";
  if (pathname.includes("/frontend/capability-browser")) return "/";
  return normalizeAppRoute(pathname);
}

function appRouteBasePath() {
  const pathname = window.location.pathname || "/";
  if (!pathname.includes("/frontend/capability-browser")) return "/";
  return pathname.endsWith("/") ? pathname : `${pathname.replace(/index\.html$/, "").replace(/\/+$/, "")}/`;
}

function syncBrowserRoute(route, { replace = false } = {}) {
  const normalized = normalizeAppRoute(route);
  const nextHash = normalized === "/" ? "" : `#${normalized}`;
  const nextPath = appRouteBasePath();
  if (window.location.pathname === nextPath && window.location.hash === nextHash) return;
  const nextUrl = `${nextPath}${window.location.search}${nextHash}`;
  if (replace) window.history.replaceState({ route: normalized }, "", nextUrl);
  else window.history.pushState({ route: normalized }, "", nextUrl);
}

function activateRoute(route, options = {}) {
  const components = window.sapdComponents || {};
  const target = components.AppShell?.getRouteTarget?.(normalizeAppRoute(route)) || { route: "/", view: "overview" };
  const routeChanged = target.route !== state.activeRoute;
  if (!options.skipAnnotationGuard && routeChanged && hasUnsavedAnnotationDraft()) {
    requestAnnotationContextSwitch(() => activateRoute(route, { ...options, skipAnnotationGuard: true }), target.description || target.route || "新页面");
    if (options.fromBrowser) syncBrowserRoute(state.activeRoute, { replace: true });
    return;
  }
  if (routeChanged) resetAnnotationInteraction({ collapse: true, clearDraft: !options.preserveAnnotationDraft });
  state.activeRoute = target.route || "/";
  applyRouteTarget(target);
  setActiveView(target.view || "overview", { syncRoute: false, skipAnnotationGuard: true });
  if (!options.fromBrowser) syncBrowserRoute(state.activeRoute, { replace: Boolean(options.replace) });
}

function routeForCurrentState(view = state.activeView) {
  const components = window.sapdComponents || {};
  return (
    components.AppShell?.routeForView?.({
      view,
      activeMaintenancePage: state.activeMaintenancePage,
      activeReferenceTab: state.activeReferenceTab,
      activeContentPage: state.activeContentPage,
      activeStandardFramework: state.activeStandardFramework,
    }) || "/"
  );
}

function updatePageHeaderSummary() {
  const countNode = $("pageHeaderCount");
  if (!countNode) return;
  const badges = list(state.pageHeaderSummary);
  const note = text(state.pageHeaderNote);
  countNode.hidden = !badges.length && !note;
  countNode.innerHTML = [
    ...badges.map(
      (badge) =>
        `<span class="page-title-summary-badge"><strong>${escapeHtml(badge.value)}</strong><span>${escapeHtml(`${badge.unit || ""}${badge.label || ""}`)}</span></span>`,
    ),
    note ? `<span class="page-title-summary-note">${escapeHtml(note)}</span>` : "",
  ].join("");
}

function updateApplicationShellChrome() {
  const components = window.sapdComponents || {};
  components.AppShell?.updateApplicationShell?.({
    activeRoute: state.activeRoute,
    activeView: state.activeView,
    activeModelingLanguageTab: state.activeModelingLanguageTab,
    activeEnvironmentTab: state.activeEnvironmentTab,
  });
  updatePageHeaderSummary();
}

function applyCapabilityCatalogState() {
  const workspace = $("capabilityWorkspace");
  workspace?.classList.toggle("catalog-collapsed", state.capabilityCatalogCollapsed);
  if (workspace) {
    const hasResizer = Boolean(workspace.querySelector(".workspace-resizer"));
    if (hasResizer) {
      workspace.style.gridTemplateColumns = state.capabilityCatalogCollapsed ? "0 minmax(0, 1fr)" : "300px 6px minmax(760px, 1fr)";
      workspace._paneWidths = state.capabilityCatalogCollapsed ? [0, Math.max(0, workspace.clientWidth)] : [300, Math.max(760, workspace.clientWidth - 306)];
    } else {
      workspace.style.gridTemplateColumns = state.capabilityCatalogCollapsed ? "0 minmax(0, 1fr)" : "300px minmax(760px, 1fr)";
      workspace._paneWidths = null;
    }
  }
  const button = $("toggleCapabilityCatalog");
  if (button) {
    button.textContent = state.capabilityCatalogCollapsed ? "展开" : "收起目录";
    button.title = state.capabilityCatalogCollapsed ? "展开安全能力目录" : "收起安全能力目录";
    button.setAttribute("aria-label", button.title);
    button.setAttribute("aria-expanded", state.capabilityCatalogCollapsed ? "false" : "true");
  }
  const tab = $("expandCapabilityCatalogTab");
  if (tab) {
    tab.hidden = !state.capabilityCatalogCollapsed;
    tab.setAttribute("aria-expanded", state.capabilityCatalogCollapsed ? "false" : "true");
  }
}

function applyDevLifecycleCatalogState() {
  const workspace = $("devLifecycleWorkspace");
  workspace?.classList.remove("catalog-collapsed");
  if (workspace) {
    workspace.style.gridTemplateColumns = "minmax(0, 1fr)";
    workspace._paneWidths = null;
  }
  const button = $("toggleDevLifecycleCatalog");
  if (button) {
    button.hidden = true;
    button.textContent = "";
    button.title = "";
    button.setAttribute("aria-label", button.title);
    button.setAttribute("aria-expanded", "false");
  }
  const tab = $("expandDevLifecycleCatalogTab");
  if (tab) {
    tab.hidden = true;
    tab.setAttribute("aria-expanded", "false");
  }
}

function environmentAncestorIds(viewModel) {
  const ids = [];
  const environmentId = viewModel?.selectedEnvironment?.id;
  const segmentId = viewModel?.selectedSegment?.id;
  const objectId = viewModel?.selectedObject?.id;
  if (environmentId) ids.push(environmentId);
  if (segmentId) ids.push(segmentId);
  if (objectId && !segmentId) {
    const environment = list(viewModel?.navigationTree).find((row) => row.id === environmentId);
    const segment = list(environment?.segments).find((row) =>
      list(row.objects).some((object) => object.id === objectId),
    );
    if (segment?.id) ids.push(segment.id);
  }
  return ids;
}

function ensureCapabilityCatalogToggle() {
  const paneHead = document.querySelector(".capability-tree-pane .pane-head");
  if (!paneHead || $("toggleCapabilityCatalog")) return;
  const actionGroup = document.createElement("div");
  actionGroup.className = "pane-head-actions";
  const toggleButton = document.createElement("button");
  toggleButton.id = "toggleCapabilityCatalog";
  toggleButton.type = "button";
  toggleButton.title = "收起安全能力目录";
  toggleButton.setAttribute("aria-label", "收起安全能力目录");
  toggleButton.setAttribute("aria-expanded", "true");
  toggleButton.textContent = "收起目录";
  actionGroup.appendChild(toggleButton);
  paneHead.appendChild(actionGroup);
}

function capabilityInitialDataReady() {
  return Boolean(state.capability && (state.loadedPackages.has("capabilityInitial") || state.loadedPackages.has("capabilityWorkbench")));
}

function createCapabilityLoadState(selectedType, selectedId) {
  const item = capabilityItemById(selectedId);
  const loadKey = item ? capabilityWorkspaceViewLoadKeyForItem(item) : "";
  const hasObjectView = capabilityProjectionMatchesSelection(state.capabilityWorkspaceView, item);
  const loadState = {
    phase: "initial",
    selectedId,
    selectedType,
    objectViewPending: false,
    focusProjectionPending: false,
    blocksDetail: false,
    loadKey,
    title: "",
    body: "",
  };
  if (item && !hasObjectView && !capabilityWorkbenchHasFullRelations()) {
    loadState.phase = "object_view_pending";
    loadState.objectViewPending = true;
    ensureCapabilityWorkspaceViewForSelection(selectedId);
  }
  const isFocusProjectionPending =
    selectedType === "capability_focus" &&
    !loadState.objectViewPending &&
    !capabilityProjectionHasFocus(selectedId) &&
    !capabilityWorkbenchHasFullRelations();
  if (isFocusProjectionPending) {
    loadState.phase = "focus_projection_pending";
    loadState.focusProjectionPending = true;
    ensureCapabilityProjectionForFocus(selectedId);
  }
  return loadState;
}

function resolveCapabilityDetailLoadState(viewModel, loadState) {
  const selected = viewModel.selectedCapability;
  if (!selected) {
    return { ...loadState, phase: "no_selection", blocksDetail: true, title: "暂无能力关系数据" };
  }
  if (loadState.objectViewPending && state.packageLoads.has(loadState.loadKey)) {
    return {
      ...loadState,
      phase: "object_view_pending",
      blocksDetail: true,
      title: "正在加载当前能力对象关系数据",
      body: "对象级工作区视图加载完成后会自动显示。",
    };
  }
  const hasObjectView = capabilityProjectionMatchesSelection(state.capabilityWorkspaceView, capabilityItemById(state.selectedCapabilityId));
  const effectiveSelectedType = selected.type || capabilityItemTypeById(state.selectedCapabilityId);
  if (!hasObjectView && requestCapabilityWorkbenchForSelection(effectiveSelectedType)) {
    return {
      ...loadState,
      phase: "workbench_pending",
      blocksDetail: true,
      title: "正在加载整体能力关系数据",
      body: "L0 / L1 / L2 节点需要完整能力工作台数据，加载完成后会自动显示。",
    };
  }
  if (loadState.focusProjectionPending && state.packageLoads.has(capabilityProjectionLoadKey(state.selectedCapabilityId))) {
    return {
      ...loadState,
      phase: "focus_projection_pending",
      blocksDetail: true,
      title: "正在加载当前关注点关系数据",
      body: "关系投影加载完成后会自动显示。",
    };
  }
  return { ...loadState, phase: "ready", blocksDetail: false };
}

function buildCapabilityViewModel(viewModels) {
  const capabilityWorkbenchViewModel =
    viewModels.buildCapabilityWorkbenchViewModel?.({ workbench: state.capabilityWorkbench }) || state.capabilityWorkbenchViewModel;
  state.capabilityWorkbenchViewModel = capabilityWorkbenchViewModel;
  return viewModels.buildCapabilityWorkspaceViewModel({
    capabilityWorkbench: state.capabilityWorkbench,
    capabilityWorkbenchViewModel,
    capabilityTree: state.capability,
    capabilityProjection: currentCapabilityObjectView(),
    management: mergeSharedLookups(state.maintenanceKnowledge),
    standards: state.standards,
    selectedCapabilityId: state.selectedCapabilityId,
    search: state.search,
    relationshipFilters: state.relationshipFilters,
  });
}

function resolveCapabilitySelection(viewModel) {
  const hadSelectedCapability = Boolean(state.selectedCapabilityId);
  if (!state.selectedCapabilityId) state.selectedCapabilityId = viewModel.selectedCapability?.id || null;
  if (!hadSelectedCapability && viewModel.selectedCapability?.type === "capability_category" && state.selectedCapabilityId) {
    capabilityCategoryIds().forEach((id) => state.expandedCapabilityIds.add(id));
  }
  if (state.selectedCapabilityId && state.expandedSelectionId !== state.selectedCapabilityId) {
    capabilityAncestorIds(state.selectedCapabilityId).forEach((id) => state.expandedCapabilityIds.add(id));
    state.expandedSelectionId = state.selectedCapabilityId;
  }
}

function renderCapabilityTree(components, viewModel) {
  setHtml(
    "tree",
    components.DimensionTree?.render({
      navigationTree: viewModel.navigationTree,
      selectedCapabilityId: state.selectedCapabilityId,
      expandedIds: state.expandedCapabilityIds,
      search: state.search,
    }) || emptyState("能力树组件未加载"),
  );
}

function renderCapabilityPendingDetail(loadState) {
  if (!loadState.blocksDetail) return false;
  setHtml("capabilityFocusHeader", "");
  setHtml("detail", emptyState(loadState.title, loadState.body));
  applyCapabilityCatalogState();
  return true;
}

function renderCapabilityDetail(components, viewModel) {
  const userTarget = capabilityUserTarget(viewModel);
  setCurrentAnnotationTarget(userTarget);
  setHtml(
    "capabilityFocusHeader",
    `${components.CapabilityLocalRelationMap?.renderFocusStrip?.(viewModel.localRelationMap, viewModel.focusOverview) || ""}`,
  );
  setHtml(
    "detail",
    `
      ${
        components.CapabilityLocalRelationMap?.render({
          localRelationMap: viewModel.localRelationMap,
          focusOverview: viewModel.focusOverview,
          activeTab: state.activeCapabilityRelationTab,
          technicalMappingRows: viewModel.technicalMappingRows,
          managementMappingRows: viewModel.managementMappingRows,
          standardMappingRows: viewModel.standardMappingRows,
        }) || emptyState("局部关系图组件未加载")
      }
    `,
  );
}

function renderCapabilities() {
  const viewModels = window.sapdViewModels;
  const components = window.sapdComponents || {};
  ensureCapabilityCatalogToggle();
  ensureUserFavoritesLoaded();
  if (!capabilityInitialDataReady()) {
    setHtml("tree", emptyState("正在加载安全能力数据"));
    setHtml("capabilityFocusHeader", "");
    setHtml("detail", emptyState("正在加载安全能力映射数据", "当前页面优先加载，完成后会自动显示。"));
    return;
  }
  if (!viewModels?.buildCapabilityWorkspaceViewModel) {
    setHtml("detail", emptyState("能力视图模型未加载"));
    return;
  }
  const selectedType = capabilityItemTypeById(state.selectedCapabilityId);
  let loadState = createCapabilityLoadState(selectedType, state.selectedCapabilityId);
  const viewModel = buildCapabilityViewModel(viewModels);
  resolveCapabilitySelection(viewModel);
  if (!loadState.selectedId && state.selectedCapabilityId) {
    loadState = createCapabilityLoadState(capabilityItemTypeById(state.selectedCapabilityId), state.selectedCapabilityId);
  }
  renderCapabilityTree(components, viewModel);
  if (renderCapabilityPendingDetail(resolveCapabilityDetailLoadState(viewModel, loadState))) return;
  renderCapabilityDetail(components, viewModel);
  applyCapabilityCatalogState();
}

function renderEnvironmentHeaderTabs() {
  const root = $("environmentHeaderTabs");
  if (!root) return;
  const tabs = [
    { id: "topology", label: "环境底图" },
    { id: "mapping", label: "归纳表格" },
    { id: "review", label: "数据核对（临时）" },
  ];
  const activeTab = tabs.some((tab) => tab.id === state.activeEnvironmentTab) ? state.activeEnvironmentTab : "topology";
  root.innerHTML = `
    <div class="maintenance-section-tabs environment-page-tabs" role="tablist" aria-label="信息化环境页面视图">
      ${tabs
        .map(
          (tab) => `
            <button class="maintenance-section-tab ${tab.id === activeTab ? "active" : ""}" type="button" role="tab" aria-selected="${tab.id === activeTab ? "true" : "false"}" data-environment-tab="${escapeHtml(tab.id)}">
              <span>${escapeHtml(tab.label)}</span>
            </button>
          `,
        )
        .join("")}
    </div>
  `;
}

function renderEnvironment() {
  renderEnvironmentHeaderTabs();
  const viewModels = window.sapdViewModels;
  const components = window.sapdComponents || {};
  if (!state.loadedPackages.has("environmentWorkbench")) {
    setHtml("environmentDetail", emptyState("正在加载信息化环境映射数据", "当前页面优先加载，完成后会自动显示。"));
    return;
  }
  if (!viewModels?.buildEnvironmentWorkspaceViewModel) {
    setHtml("environmentDetail", emptyState("信息化环境视图模型未加载"));
    return;
  }
  const environmentWorkbenchViewModel =
    viewModels.buildEnvironmentWorkbenchViewModel?.({ workbench: state.environmentWorkbench }) || state.environmentWorkbenchViewModel;
  state.environmentWorkbenchViewModel = environmentWorkbenchViewModel;
  const viewModel = viewModels.buildEnvironmentWorkspaceViewModel({
    environmentWorkbench: state.environmentWorkbench,
    environmentWorkbenchViewModel,
    management: null,
    selectedObjectId: state.selectedEnvironmentObjectId,
    selectedEnvironmentId: state.selectedEnvironmentId,
    selectedSegmentId: state.selectedEnvironmentSegmentId,
    search: state.search,
  });
  if (viewModel.selectedEnvironment?.id && state.selectedEnvironmentId !== viewModel.selectedEnvironment.id) {
    state.selectedEnvironmentId = viewModel.selectedEnvironment.id;
  }
  if (viewModel.selectedObject?.id && state.selectedEnvironmentObjectId !== viewModel.selectedObject.id) {
    state.selectedEnvironmentObjectId = viewModel.selectedObject.id;
  }
  if (viewModel.selectedSegment?.id && state.selectedEnvironmentSegmentId !== viewModel.selectedSegment.id) {
    state.selectedEnvironmentSegmentId = viewModel.selectedSegment.id;
  }
  if (state.selectedEnvironmentId && state.expandedEnvironmentSelectionId !== `${state.selectedEnvironmentId}:${state.selectedEnvironmentSegmentId || ""}:${state.selectedEnvironmentObjectId || ""}`) {
    environmentAncestorIds(viewModel).forEach((id) => state.expandedEnvironmentIds.add(id));
    state.expandedEnvironmentSelectionId = `${state.selectedEnvironmentId}:${state.selectedEnvironmentSegmentId || ""}:${state.selectedEnvironmentObjectId || ""}`;
  }
  if (!viewModel.selectedEnvironment) {
    setHtml("environmentDetail", emptyState("请选择信息化环境或对象"));
    return;
  }
  setHtml(
    "environmentDetail",
    `
      ${
        components.EnvironmentLocalRelationMap?.render({
          viewModel,
          selectedRowId: state.selectedEnvironmentRowId,
          selectedEnvironmentId: state.selectedEnvironmentId,
          selectedSegmentId: state.selectedEnvironmentSegmentId,
          selectedObjectId: state.selectedEnvironmentObjectId,
          search: state.search,
          activeTab: state.activeEnvironmentTab,
          expandedIds: state.expandedEnvironmentIds,
          catalogCollapsed: state.environmentCatalogCollapsed,
          reviewData: state.environmentManualReview,
          reviewFilters: state.environmentReviewFilters,
          selectedReviewRowKey: state.selectedEnvironmentReviewRowKey,
        }) || emptyState("环境图谱组件未加载")
      }
    `,
  );
  const basemapRoot = $("environmentDetail")?.querySelector("[data-environment-basemap-viewer-svg]");
  if (basemapRoot && components.EnvironmentBasemapViewer?.mount) {
    components.EnvironmentBasemapViewer.mount(basemapRoot);
  }
}

function renderLifecycle(kind) {
  if (kind === "dev") {
    const viewModels = window.sapdViewModels;
    const components = window.sapdComponents || {};
    const devWorkspace = $("devLifecycleWorkspace");
    const devDetailPane = devWorkspace?.querySelector(".lifecycle-detail-pane");
    devWorkspace?.classList.add("dev-lifecycle-workspace");
    devDetailPane?.classList.add("is-hidden");
    applyDevLifecycleCatalogState();
    if (!state.loadedPackages.has("lifecycleWorkbench")) {
      setText("devLifecycleCount", 0);
      setText("devLifecycleType", "LC-AP");
      setText("devLifecyclePageTitle", "");
      if ($("devLifecycleStageSearch")) $("devLifecycleStageSearch").value = state.devLifecycleStageSearch;
      setHtml("devLifecycleNav", emptyState("正在加载开发安全生命周期数据"));
      setHtml("devLifecycleLane", emptyState("正在加载开发安全生命周期关系数据", "当前页面优先加载，完成后会自动显示。"));
      setHtml("devLifecycleDetail", "");
      return;
    }
    if (!viewModels?.buildApplicationSecurityLifecycleViewModel) {
      setHtml("devLifecycleDetail", emptyState("安全开发视图模型未加载"));
      return;
    }
    const lifecycleWorkbenchViewModel =
      viewModels.buildLifecycleWorkbenchViewModel?.({ workbench: state.lifecycleWorkbench }) || state.lifecycleWorkbenchViewModel;
    state.lifecycleWorkbenchViewModel = lifecycleWorkbenchViewModel;
    let viewModel = viewModels.buildApplicationSecurityLifecycleViewModel({
      lifecycleWorkbench: state.lifecycleWorkbench,
      lifecycleWorkbenchViewModel,
      lifecycle: state.lifecycle,
      selectedProcessId: state.selectedDevProcessId,
      search: state.search,
    });
    const stageQuery = text(state.devLifecycleStageSearch).trim();
    const matchedStages = list(viewModel.stageTree).filter((row) => matchesTextQuery(stageQuery, row.title, row.code, row.order));
    if (stageQuery && matchedStages.length && !matchedStages.some((row) => row.id === viewModel.relationshipSummary?.selectedProcessId)) {
      state.selectedDevProcessId = matchedStages[0].id;
      viewModel = viewModels.buildApplicationSecurityLifecycleViewModel({
        lifecycleWorkbench: state.lifecycleWorkbench,
        lifecycleWorkbenchViewModel,
        lifecycle: state.lifecycle,
        selectedProcessId: state.selectedDevProcessId,
        search: state.search,
      });
    }
    state.selectedDevProcessId = viewModel.relationshipSummary?.selectedProcessId || viewModel.selectedProcess?.id || null;
    if ($("devLifecycleStageSearch")) $("devLifecycleStageSearch").value = state.devLifecycleStageSearch;
    setText("devLifecyclePageTitle", "");
    setText("devLifecycleCount", viewModel.navigationTree.length);
    setText("devLifecycleType", viewModel.dataState || "LC-AP");
    setHtml(
      "devLifecycleNav",
      components.ApplicationSecurityLifecycle?.renderNavigation({
        stageTree: viewModel.stageTree,
        selectedProcessId: state.selectedDevProcessId,
        search: state.devLifecycleStageSearch,
      }) || emptyState("安全开发阶段树组件未加载"),
    );
    setHtml(
      "devLifecycleLane",
      `
        ${components.ApplicationSecurityLifecycle?.renderStageOverview(viewModel) || ""}
        ${components.ApplicationSecurityLifecycle?.renderRelationTable({ rows: viewModel.relationRows, policyRows: viewModel.policyRows, overview: viewModel.stageOverview }) || ""}
      `,
    );
    setHtml("devLifecycleDetail", "");
    applyDevLifecycleCatalogState();
    return;
  }
  if (kind === "data") {
    const viewModels = window.sapdViewModels;
    const components = window.sapdComponents || {};
    const dataWorkspace = $("dataLifecycleWorkspace");
    const dataDetailPane = dataWorkspace?.querySelector(".lifecycle-detail-pane");
    dataWorkspace?.classList.add("dev-lifecycle-workspace");
    dataDetailPane?.classList.add("is-hidden");
    if (!state.loadedPackages.has("lifecycleWorkbench")) {
      setText("dataLifecycleCount", 0);
      setText("dataLifecycleType", "LC-DT");
      setText("dataLifecyclePageTitle", "");
      if ($("dataLifecycleStageSearch")) $("dataLifecycleStageSearch").value = state.dataLifecycleStageSearch;
      setHtml("dataLifecycleNav", emptyState("正在加载数据生命周期安全数据"));
      setHtml("dataLifecycleMatrix", emptyState("正在加载数据生命周期安全关系数据", "当前页面优先加载，完成后会自动显示。"));
      setHtml("dataLifecycleDetail", "");
      return;
    }
    if (!viewModels?.buildDataSecurityLifecycleViewModel) {
      setHtml("dataLifecycleDetail", emptyState("数据生命周期安全视图模型未加载"));
      return;
    }
    const lifecycleWorkbenchViewModel =
      viewModels.buildLifecycleWorkbenchViewModel?.({ workbench: state.lifecycleWorkbench }) || state.lifecycleWorkbenchViewModel;
    state.lifecycleWorkbenchViewModel = lifecycleWorkbenchViewModel;
    let viewModel = viewModels.buildDataSecurityLifecycleViewModel({
      lifecycleWorkbench: state.lifecycleWorkbench,
      lifecycleWorkbenchViewModel,
      lifecycle: state.lifecycle,
      selectedProcessId: state.selectedDataProcessId,
      search: state.search,
    });
    const stageQuery = text(state.dataLifecycleStageSearch).trim();
    const matchedStages = list(viewModel.stageTree).filter((row) => matchesTextQuery(stageQuery, row.title, row.code, row.order));
    if (stageQuery && matchedStages.length && !matchedStages.some((row) => row.id === viewModel.relationshipSummary?.selectedProcessId)) {
      state.selectedDataProcessId = matchedStages[0].id;
      viewModel = viewModels.buildDataSecurityLifecycleViewModel({
        lifecycleWorkbench: state.lifecycleWorkbench,
        lifecycleWorkbenchViewModel,
        lifecycle: state.lifecycle,
        selectedProcessId: state.selectedDataProcessId,
        search: state.search,
      });
    }
    state.selectedDataProcessId = viewModel.relationshipSummary?.selectedProcessId || viewModel.selectedProcess?.id || null;
    if ($("dataLifecycleStageSearch")) $("dataLifecycleStageSearch").value = state.dataLifecycleStageSearch;
    setText("dataLifecyclePageTitle", "");
    setText("dataLifecycleCount", viewModel.navigationTree.length);
    setText("dataLifecycleType", viewModel.dataState || "LC-DT");
    setHtml(
      "dataLifecycleNav",
      components.ApplicationSecurityLifecycle?.renderNavigation({
        stageTree: viewModel.stageTree,
        selectedProcessId: state.selectedDataProcessId,
        search: state.dataLifecycleStageSearch,
        kind: "data",
      }) || emptyState("数据生命周期过程树组件未加载"),
    );
    setHtml(
      "dataLifecycleMatrix",
      `
        ${components.ApplicationSecurityLifecycle?.renderStageOverview(viewModel) || ""}
        ${components.ApplicationSecurityLifecycle?.renderRelationTable({ rows: viewModel.relationRows, policyRows: viewModel.policyRows, overview: viewModel.stageOverview }) || ""}
      `,
    );
    setHtml("dataLifecycleDetail", "");
    return;
  }
}

function renderMaintenance() {
  const viewModels = window.sapdViewModels;
  const components = window.sapdComponents || {};
  const dataClient = window.sapdDataClient;
  ensureUserFavoritesLoaded();
  if (state.activeMaintenancePage === "standards" && !state.loadedPackages.has("standards")) {
    setText("sourcePageTitle", "标准 / 框架");
    setText("sourcePageCount", 0);
    setHtml("maintenanceNavigation", "");
    setHtml("sourceList", `<div class="maintenance-empty-state">正在加载标准 / 框架索引...</div>`);
    setText("sourceDetailType", "");
    setHtml("sourceDetail", "");
    return;
  }
  if (state.activeMaintenancePage !== "standards" && !state.loadedPackages.has("maintenanceIndex")) {
    loadDataPackage("maintenanceIndex").then(() => {
      if (state.activeView === "maintenance" && state.activeMaintenancePage !== "standards") renderMaintenance();
    });
    setText("sourcePageTitle", "知识库字典");
    setText("sourcePageCount", 0);
    setHtml("maintenanceNavigation", "");
    setHtml("sourceList", `<div class="maintenance-empty-state">正在加载知识库字典目录...</div>`);
    setText("sourceDetailType", "");
    setHtml("sourceDetail", "");
    return;
  }
  const maintenanceSectionIds = maintenanceSectionsForPage(state.activeMaintenancePage);
  const missingMaintenanceSectionId = maintenanceSectionIds.find((sectionId) => !isMaintenanceSectionReady(sectionId));
  if (missingMaintenanceSectionId) {
    ensureMaintenanceSectionLoaded(missingMaintenanceSectionId);
    setText("sourcePageTitle", "知识库字典");
    setText("sourcePageCount", 0);
    setHtml("maintenanceNavigation", "");
    setHtml("sourceList", `<div class="maintenance-empty-state">正在加载知识库字典分片...</div>`);
    setText("sourceDetailType", "");
    setHtml("sourceDetail", "");
    return;
  }
  const maintenancePackageNames = maintenancePackagesForPage(state.activeMaintenancePage);
  const missingMaintenancePackageName = maintenancePackageNames.find((packageName) => !state.loadedPackages.has(packageName));
  if (missingMaintenancePackageName) {
    ensureMaintenancePackageLoaded(missingMaintenancePackageName);
    const loadingTitle =
      state.activeMaintenancePage === "capability-directory"
        ? "安全能力清单"
        : state.activeMaintenancePage === "application-systems"
          ? "应用系统目录"
          : "知识库字典";
    setText("sourcePageTitle", loadingTitle);
    setText("sourcePageCount", 0);
    setHtml("maintenanceNavigation", "");
    setHtml("sourceList", `<div class="maintenance-empty-state">正在加载${escapeHtml(loadingTitle)}数据...</div>`);
    setText("sourceDetailType", "");
    setHtml("sourceDetail", "");
    return;
  }
  if (state.activeMaintenancePage === "capability-directory" && !state.loadedPackages.has("capability")) {
    setText("sourcePageTitle", "安全能力清单");
    setText("sourcePageCount", 0);
    setHtml("maintenanceNavigation", "");
    setHtml("sourceList", `<div class="maintenance-empty-state">正在加载安全能力与关注点目录...</div>`);
    setText("sourceDetailType", "");
    setHtml("sourceDetail", "");
    return;
  }
  if (state.activeMaintenancePage === "application-systems" && !state.loadedPackages.has("lifecycle")) {
    setText("sourcePageTitle", "应用系统目录");
    setText("sourcePageCount", 0);
    setHtml("maintenanceNavigation", "");
    setHtml("sourceList", `<div class="maintenance-empty-state">正在加载 LC-AP 应用系统目录...</div>`);
    setText("sourceDetailType", "");
    setHtml("sourceDetail", "");
    return;
  }
  ensureSupplementalMaintenanceSectionsLoaded(state.activeMaintenancePage);
  if (!viewModels?.buildMaintenanceWorkspaceViewModel) {
    setHtml("sourceList", emptyState("专项维护视图模型未加载"));
    return;
  }
  if (state.activeMaintenancePage === "standards" && dataClient?.getStandardFramework) {
    const frameworkId = state.activeStandardFramework || "mlps-level-3";
    const loadedFramework = state.standards?.loadedFrameworks?.[frameworkId];
    if (!loadedFramework) {
      setHtml("sourceList", `<div class="maintenance-empty-state">正在加载 ${escapeHtml(frameworkId)} 标准 / 框架数据...</div>`);
      const existingLoad = state.standardFrameworkLoads.get(frameworkId);
      const loadPromise =
        existingLoad ||
        dataClient.getStandardFramework(frameworkId).then((envelope) => {
          state.standards = {
            ...(state.standards || {}),
            loadedFrameworks: {
              ...(state.standards?.loadedFrameworks || {}),
              [frameworkId]: envelope.data,
            },
          };
          state.standardFrameworkLoads.delete(frameworkId);
          if (state.activeMaintenancePage === "standards" && state.activeStandardFramework === frameworkId) renderMaintenance();
        });
      state.standardFrameworkLoads.set(frameworkId, loadPromise);
      return;
    }
    state.activeStandardTableId = activeStandardTableIdForFramework(loadedFramework);
    const activeTable = standardTableById(loadedFramework, state.activeStandardTableId);
    const activeTableLoading = ensureStandardFrameworkTableLoaded(frameworkId, state.activeStandardTableId);
    if (activeTableLoading && activeTable && !standardTableHasRows(activeTable)) {
      setHtml("sourceList", `<div class="maintenance-empty-state">正在加载 ${escapeHtml(activeTable.title || frameworkId)} 数据...</div>`);
      setText("sourceDetailType", "");
      setHtml("sourceDetail", "");
      return;
    }
    ensureSupplementalStandardTablesLoaded(frameworkId);
  }
  const viewModel = viewModels.buildMaintenanceWorkspaceViewModel({
    capabilityTree: state.capability,
    management: mergeSharedLookups(state.maintenanceKnowledge || { ...(state.maintenanceIndex || {}), maintenance_index: state.maintenanceIndex }),
    lifecycle: state.lifecycle,
    standards: state.standards,
    section: state.activeMaintenancePage,
    selectedId: state.selectedMaintenanceId,
    search: state.search,
    referenceTab: state.activeReferenceTab,
    standardFrameworkId: state.activeStandardFramework,
    standardTableId: state.activeStandardTableId,
  });
  state.activeMaintenancePage = viewModel.section;
  state.activeReferenceTab = viewModel.referenceTab || state.activeReferenceTab;
  if (viewModel.activeStandardTableId) state.activeStandardTableId = viewModel.activeStandardTableId;
  state.selectedMaintenanceId = viewModel.selectedId;
  const standardsMode = viewModel.section === "standards";
  const knowledgeDirectoryMode = !standardsMode;
  state.pageHeaderSummary = standardsMode ? list(viewModel.summaryBadges) : maintenanceHeaderSummary(viewModel);
  state.pageHeaderNote = standardsMode ? text(viewModel.summaryNote) : "";
  $("maintenanceWorkspace")?.classList.toggle("standards-mode", standardsMode);
  $("maintenanceWorkspace")?.classList.toggle("knowledge-directory-mode", knowledgeDirectoryMode);
  $("maintenanceWorkspace")?.classList.toggle("short-maintenance-table", knowledgeDirectoryMode && list(viewModel.rows).length > 0 && list(viewModel.rows).length <= 12);
  $("sourceNavPane")?.classList.toggle("is-hidden", standardsMode || knowledgeDirectoryMode);
  $("sourceDetailPane")?.classList.toggle("is-hidden", standardsMode || knowledgeDirectoryMode);
  updatePageHeaderSummary();
  setHtml("maintenanceNavigation", components.MaintenanceNavigation?.render({ navigationItems: viewModel.navigationItems }) || "");
  setText("sourcePageTitle", standardsMode ? viewModel.activeFrameworkTitle || "标准/框架清单" : viewModel.page?.title || "专项知识维护");
  setText("sourcePageCount", viewModel.rows.length);
  let tableHtml = `<div class="maintenance-empty-state">${escapeHtml(viewModel.emptyState || "该专项页面将在后续阶段接入。")}</div>`;
  if (viewModel.section === "capability-directory") {
    tableHtml =
      components.CapabilityDirectoryMaintenanceTable?.render({
        rows: viewModel.rows,
        capabilityGroups: viewModel.capabilityGroups,
        selectedId: viewModel.selectedId,
        emptyState: viewModel.emptyState,
        search: state.search,
      }) || tableHtml;
  } else if (viewModel.section === "scopes") {
    tableHtml = components.ScopeMaintenanceTable?.render({ rows: viewModel.rows, selectedId: viewModel.selectedId, emptyState: viewModel.emptyState }) || tableHtml;
  } else if (viewModel.section === "processes") {
    tableHtml = components.ProcessMaintenanceTable?.render({ rows: viewModel.rows, selectedId: viewModel.selectedId, emptyState: viewModel.emptyState }) || tableHtml;
  } else if (viewModel.section === "work-functions") {
    tableHtml = components.WorkFunctionMaintenanceTable?.render({ rows: viewModel.rows, selectedId: viewModel.selectedId, emptyState: viewModel.emptyState, search: state.search }) || tableHtml;
  } else if (viewModel.section === "security-works") {
    tableHtml = components.SecurityWorkMaintenanceTable?.render({ rows: viewModel.rows, selectedId: viewModel.selectedId, emptyState: viewModel.emptyState }) || tableHtml;
  } else if (viewModel.section === "services") {
    tableHtml = components.TechnicalServiceMaintenanceTable?.render({ rows: viewModel.rows, scopeGroups: viewModel.serviceScopeGroups, selectedId: viewModel.selectedId, emptyState: viewModel.emptyState, search: state.search }) || tableHtml;
  } else if (viewModel.section === "modules") {
    tableHtml = components.TechnologyModuleMaintenanceTable?.render({ rows: viewModel.rows, selectedId: viewModel.selectedId, emptyState: viewModel.emptyState, search: state.search }) || tableHtml;
  } else if (viewModel.section === "measures") {
    tableHtml = components.TechnicalMeasureMaintenanceTable?.render({ rows: viewModel.rows, selectedId: viewModel.selectedId, emptyState: viewModel.emptyState }) || tableHtml;
  } else if (viewModel.section === "application-systems") {
    tableHtml =
      components.ApplicationSystemDirectoryTable?.render({
        rows: viewModel.rows,
        selectedId: viewModel.selectedId,
        emptyState: viewModel.emptyState,
      }) || tableHtml;
  } else if (viewModel.section === "lcap-references") {
    tableHtml =
      components.LcapReferenceMaintenanceTable?.render({
        softwareRows: viewModel.softwareRows,
        applicationRows: viewModel.applicationRows,
        selectedId: viewModel.selectedId,
        emptyState: viewModel.emptyState,
      }) || tableHtml;
  } else if (viewModel.section === "references") {
    tableHtml = components.StandardRoleReferenceTable?.render({ standardRows: viewModel.standardRows, roleRows: viewModel.roleRows, selectedId: viewModel.selectedId, emptyState: viewModel.emptyState, activeTab: viewModel.referenceTab, search: state.search }) || tableHtml;
  } else if (viewModel.section === "standards") {
    tableHtml =
      components.StandardFrameworkTable?.render({
        activeFrameworkId: viewModel.activeFrameworkId,
        activeTableId: viewModel.activeStandardTableId,
        rows: viewModel.rows,
        columns: viewModel.columns,
        tables: viewModel.tables,
        selectedId: viewModel.selectedId,
        emptyState: viewModel.emptyState,
        focusByCode: capabilityFocusByCode(state.capability),
        search: state.search,
      }) || tableHtml;
  }
  setCurrentAnnotationTarget(maintenanceUserTarget(viewModel));
  setHtml(
    "sourceList",
    `
      ${standardsMode ? "" : components.MaintenanceShell?.render({ viewModel }) || ""}
      ${tableHtml || ""}
      ${knowledgeDirectoryMode && viewModel.rows.length ? `<div class="maintenance-table-endcap">已显示全部 ${escapeHtml(viewModel.rows.length)} 条记录</div>` : ""}
    `,
  );
  hydrateMaintenanceAnnotationTargets(viewModel);
  scheduleAnnotationAnchorMarkers("render-maintenance");
  if (standardsMode || knowledgeDirectoryMode) {
    setText("sourceDetailType", "");
    setHtml("sourceDetail", "");
  } else {
    setText("sourceDetailType", viewModel.detailPanel?.type || "未选择");
    setHtml(
      "sourceDetail",
      components.MaintenanceDetailPanel?.render({ detailPanel: viewModel.detailPanel }) || emptyState("请选择专项对象"),
    );
  }
}

function maintenanceHeaderSummary(viewModel) {
  if (viewModel.section === "application-systems") {
    return [
      { value: viewModel.summary?.totalApplicationSystems ?? list(viewModel.rows).length, label: "应用系统", unit: "类" },
      { value: viewModel.summary?.applicationComponents ?? 0, label: "应用组件", unit: "个" },
    ];
  }
  if (viewModel.section === "capability-directory") {
    return [
      { value: viewModel.summary?.l0 ?? 0, label: "L0 分类", unit: "类" },
      { value: viewModel.summary?.l1 ?? 0, label: "L1 能力域", unit: "个" },
      { value: viewModel.summary?.l2 ?? 0, label: "L2 安全能力", unit: "项" },
      { value: viewModel.summary?.focuses ?? 0, label: "安全关注点", unit: "个" },
    ];
  }
  const navigationCounts = Object.fromEntries(list(viewModel.navigationItems).map((item) => [item.id, Number(item.count) || 0]));
  const sectionTabCounts = Object.fromEntries(list(viewModel.sectionTabs).map((tab) => [tab.id, Number(tab.count) || 0]));
  const counts = { ...navigationCounts, ...sectionTabCounts };
  const labels = {
    "capability-directory": ["能力/关注点", "项"],
    scopes: ["作用域", "个"],
    services: ["技术服务", "项"],
    modules: ["技术模块", "个"],
    measures: ["技术措施", "项"],
    "security-works": ["安全工作", "项"],
    processes: ["流程", "条"],
    "application-systems": ["应用系统", "类"],
    "work-functions": ["安全职能", "个"],
    references: ["岗位 / 职能参考", "条"],
    "references-gbt": ["GB/T 任务参考", "条"],
    "references-gartner": ["Gartner 岗位参考", "条"],
  };
  const tabIds = list(viewModel.sectionTabs).map((tab) => tab.id);
  const ids = tabIds.length ? tabIds : [viewModel.section];
  return ids
    .map((id) => {
      const [label, unit] = labels[id] || [id, ""];
      return { value: counts[id] ?? list(viewModel.rows).length, label, unit };
    })
    .filter((badge) => badge.value || badge.value === 0);
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
  const columns = widths
    .map((width, index) => {
      const minWidth = ["capabilityWorkspace", "devLifecycleWorkspace"].includes(workspace.id) && workspace.classList.contains("catalog-collapsed") && index === 0 ? 64 : 160;
      return `${Math.max(minWidth, Math.round(width))}px${index < widths.length - 1 ? " 6px" : ""}`;
    })
    .join(" ");
  workspace.style.gridTemplateColumns = columns;
  workspace._paneWidths = widths;
}

function defaultWorkspaceWidths(workspace, panes) {
  const handlesWidth = 6 * (panes.length - 1);
  const total = Math.max(480, workspace.clientWidth - handlesWidth);
  const rest = (...fixed) => Math.max(220, total - fixed.reduce((sum, value) => sum + value, 0));
  if (workspace.id === "capabilityWorkspace") return [300, rest(300)];
  if (workspace.id === "environmentWorkspace") return [300, rest(300)];
  if (workspace.id === "devLifecycleWorkspace" && panes.length === 2) return [200, rest(200)];
  if (workspace.id === "devLifecycleWorkspace" || workspace.id === "dataLifecycleWorkspace") return [270, rest(270, 220), 220];
  if (workspace.id === "maintenanceWorkspace" && workspace.classList.contains("standards-mode")) return [rest()];
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
  if (workspace.id === "overviewWorkspace") return;
  if (workspace.id === "devLifecycleWorkspace") return;
  if (workspace.id === "contentWorkspace" && workspace.classList.contains("guide-slide-layout")) return;
  if (workspace.id === "contentWorkspace" && workspace.classList.contains("modeling-language-guide-workspace")) return;
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
  ensureUserFavoritesLoaded();
  const navList = $("contentNavList");
  const previousThumbScrollTop = navList?.scrollTop || 0;
  const routeInfo = window.sapdComponents?.AppShell?.getRouteInfo?.(state.activeRoute) || {};
  if (state.activeRoute === MODELING_LANGUAGE_GUIDE_ROUTE) {
    renderModelingLanguageGuide(routeInfo);
    return;
  }
  $("contentWorkspace")?.classList.remove("modeling-language-guide-workspace");
  const pageCount = $("contentPageCount");
  if (pageCount) pageCount.className = "count-pill";
  const requiredGuidePackage = GUIDE_ROUTE_PACKAGES[state.activeRoute];
  if (!state.loadedPackages.has("content") || (requiredGuidePackage && !state.loadedPackages.has(requiredGuidePackage))) {
    setText("contentNavTitle", "幻灯片目录");
    setText("contentPageTitle", "安全指南");
    setText("contentPageCount", 0);
    setHtml("contentNavList", emptyState("正在加载指南目录"));
    setHtml("contentList", emptyState("正在加载指南内容", "当前页面优先加载，完成后会自动显示。"));
    setText("contentDetailType", "");
    setHtml("contentDetail", "");
    return;
  }
  const rows = contentRows().filter((row) => matchesSearch(row.title, row.category, row.view_type, row.content));
  const isSpecificGuideRoute = state.activeRoute.startsWith("/guides/");
  const routeItem = routeInfo.item || {};
  if (!state.selectedContentId || !rows.some((row) => row.id === state.selectedContentId)) state.selectedContentId = rows[0]?.id || null;
  if (!state.selectedContentId) state.selectedContentSlideIndex = 0;
  const titles = { html: "HTML 知识说明", drawio: "Draw.io 只读图", ppt: "PPT 使用说明" };
  const selected = rows.find((row) => row.id === state.selectedContentId);
  const selectedSlides = contentSlides(selected);
  const activeSlideIndex = selectedSlides.length ? clampSlideIndex(selectedSlides) : 0;
  const activeSlide = selectedSlides[activeSlideIndex] || null;
  const workspace = $("contentWorkspace");
  const detailPane = document.querySelector(".content-detail-pane");
  const isSlideDeck = selectedSlides.length > 0;
  workspace?.classList.toggle("guide-slide-layout", isSlideDeck);
  detailPane?.classList.toggle("is-hidden", isSlideDeck);
  if (isSpecificGuideRoute && !rows.length) detailPane?.classList.add("is-hidden");
  if (workspace && isSlideDeck) {
    workspace.querySelectorAll(":scope > .workspace-resizer").forEach((handle) => handle.remove());
    workspace.classList.remove("is-resizable");
    workspace.dataset.resizableReady = "";
    workspace.style.gridTemplateColumns = "";
    workspace._paneWidths = null;
  }
  setText("contentNavTitle", isSlideDeck || isSpecificGuideRoute ? "幻灯片目录" : "说明与视图");
  setText("contentPageTitle", selected?.title || (isSpecificGuideRoute ? routeItem.label : "") || titles[state.activeContentPage]);
  setText("contentPageCount", selectedSlides.length || rows.length);
  setHtml(
    "contentNavList",
    isSlideDeck
      ? renderSlidePreviewRail(selected)
      : isSpecificGuideRoute && !rows.length
        ? emptyState(routeItem.label || "暂无页面预览", "该指南内容待补充。")
      : `
        <button id="htmlDocsTab" class="source-nav-button ${state.activeContentPage === "html" ? "active" : ""}" type="button" data-content-page="html">
          <span>HTML 知识说明</span>
          <strong>${list(state.content?.html_documents).length}</strong>
        </button>
        <button id="drawioViewsTab" class="source-nav-button ${state.activeContentPage === "drawio" ? "active" : ""}" type="button" data-content-page="drawio">
          <span>Draw.io 只读图</span>
          <strong>${list(state.content?.diagram_views).length}</strong>
        </button>
        <button id="pptGuideTab" class="source-nav-button ${state.activeContentPage === "ppt" ? "active" : ""}" type="button" data-content-page="ppt">
          <span>PPT 使用说明</span>
          <strong>${list(state.content?.guide_pages).length}</strong>
        </button>
      `,
  );
  setCurrentAnnotationTarget(
    isSlideDeck ? contentSlideUserTarget(selected, activeSlide, activeSlideIndex) : contentUserTarget(selected, routeInfo),
    { pageTitle: selected?.title || (isSpecificGuideRoute ? routeItem.label : "") || titles[state.activeContentPage] },
  );
  setHtml(
    "contentList",
    `${
      isSlideDeck
        ? renderSlideDeck(selected)
      : isSpecificGuideRoute && !rows.length
        ? emptyState(routeItem.label || "暂无指南内容", routeInfo.description || "当前二级页面已预留，尚未绑定数据包。")
      : rows.map((row) => `<button class="catalog-row ${row.id === state.selectedContentId ? "active" : ""}" type="button" data-content-id="${escapeHtml(row.id)}"><span class="catalog-main"><strong>${escapeHtml(row.title || "未命名内容")}</strong><small>${escapeHtml(row.view_type || row.category || "")}</small></span><span class="catalog-meta"><span>${escapeHtml(row.slide_number || row.page_index || row.updated_at || "")}</span></span></button>`).join("") || emptyState("暂无内容视图", "HTML / Draw.io / PPT 已预留入口")
    }`,
  );
  if (isSlideDeck) {
    requestAnimationFrame(() => {
      const rail = $("contentNavList");
      if (!rail) return;
      if (state.contentSlideScrollMode === "active") {
        rail.querySelector(".guide-thumb.active")?.scrollIntoView({ block: "nearest", inline: "nearest" });
      } else {
        rail.scrollTop = previousThumbScrollTop;
      }
      state.contentSlideScrollMode = "preserve";
    });
  }
  const typeLabels = { slide_deck: "幻灯片", html: "HTML", drawio: "Draw.io", ppt: "PPT" };
  setText("contentDetailType", typeLabels[selected?.view_type] || typeLabels[state.activeContentPage] || selected?.view_type || state.activeContentPage);
  setHtml("contentDetail", renderContentDetail(selected));
}

function renderPlaceholder() {
  const components = window.sapdComponents || {};
  const routeInfo = components.AppShell?.getRouteInfo?.(state.activeRoute) || {};
  const item = routeInfo.item || {};
  const pageTitle = item.label || "预留页面";
  const description = routeInfo.description || "该页面已进入导航规划，等待独立设计和数据契约确认。";
  setHtml(
    "placeholderDetail",
    `
      <div class="placeholder-page-card">
        <span class="placeholder-page-kicker">待设计页面</span>
        <h2>${escapeHtml(pageTitle)}</h2>
        <p>${escapeHtml(description)}</p>
        <div class="placeholder-page-state">
          <strong>当前状态</strong>
          <span>页面暂不复用其他模块结构，待完成独立设计、数据契约和交互说明后再进入实现。</span>
        </div>
        <ul class="placeholder-page-rules">
          <li>不套用安全能力映射、信息化环境映射、LC-AP、LC-DT 或知识目录页面。</li>
          <li>不临时展示无关数据，不在页面内做业务关系推断。</li>
          <li>不展示 sheet、row、raw_value、source_file 等非业务字段。</li>
        </ul>
      </div>
    `,
  );
}

function renderActiveView() {
  setCurrentAnnotationTarget(null);
  renderMetrics();
  if (state.activeView === "overview") renderOverview();
  if (state.activeView === "capabilities") renderCapabilities();
  if (state.activeView === "environment") renderEnvironment();
  if (state.activeView === "dev-lifecycle") renderLifecycle("dev");
  if (state.activeView === "data-lifecycle") renderLifecycle("data");
  if (state.activeView === "maintenance") renderMaintenance();
  if (state.activeView === "content") renderContent();
  if (state.activeView === "placeholder") renderPlaceholder();
  scheduleAnnotationAnchorMarkers("render-active-view");
}

function setActiveView(view, options = {}) {
  const previousView = state.activeView;
  if (!options.skipAnnotationGuard && view !== previousView && hasUnsavedAnnotationDraft()) {
    requestAnnotationContextSwitch(() => setActiveView(view, { ...options, skipAnnotationGuard: true }), view);
    return;
  }
  if (view !== previousView) resetAnnotationInteraction({ collapse: true, clearDraft: true });
  if (view === "capabilities" && previousView !== "capabilities") {
    state.selectedCapabilityId = null;
    state.expandedCapabilityIds = new Set();
    state.expandedSelectionId = null;
  }
  state.activeView = view;
  document.body.dataset.activeView = view;
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
    placeholder: "placeholderWorkspace",
  };
  for (const [key, id] of Object.entries(workspaceMap)) $(id)?.classList.toggle("is-hidden", key !== view);
  renderActiveView();
  setupResizableWorkspaces();
  if (view === "capabilities") applyCapabilityCatalogState();
  if (options.syncRoute !== false) {
    state.activeRoute = routeForCurrentState(view);
    syncBrowserRoute(state.activeRoute, { replace: Boolean(options.replaceRoute) });
  }
  ensureRoutePackages();
  updateApplicationShellChrome();
  persistWorkspaceState();
}

function bindEvents() {
  document.querySelectorAll(".module-tab").forEach((button) => {
    const label = button.querySelector("span:not(.nav-symbol)")?.textContent || button.textContent.trim();
    button.title = label;
  });
  document.addEventListener("click", (event) => {
    const routeButton = event.target.closest("[data-app-route]");
    if (!routeButton) return;
    event.preventDefault();
    activateRoute(routeButton.dataset.appRoute);
  });
  document.querySelectorAll(".module-tab").forEach((button) => {
    if (!button.dataset.view || button.dataset.appRoute) return;
    button.addEventListener("click", () => {
      state.activeRoute = routeForCurrentState(button.dataset.view);
      setActiveView(button.dataset.view);
    });
  });
  $("searchInput")?.addEventListener("input", (event) => {
    state.search = event.target.value.trim();
    if ($("capabilitySearchInput")) $("capabilitySearchInput").value = event.target.value;
    renderActiveView();
  });
  $("capabilitySearchInput")?.addEventListener("input", (event) => {
    state.search = event.target.value.trim();
    if ($("searchInput")) $("searchInput").value = event.target.value;
    renderCapabilities();
  });
  document.addEventListener("input", (event) => {
    if (!event.target?.matches?.("[data-user-note-draft]")) return;
    state.userAnnotationDraft = event.target.value;
  });
  document.addEventListener("input", (event) => {
    if (!event.target?.matches?.("[data-user-note-edit-draft]")) return;
    state.userAnnotationEditDraft = event.target.value;
  });
  document.addEventListener("contextmenu", (event) => {
    openAnnotationContextMenu(event);
  });
  document.addEventListener("mouseover", (event) => {
    showAnnotationTooltip(event);
  });
  document.addEventListener("mousemove", (event) => {
    positionAnnotationTooltip(event);
  });
  document.addEventListener("mouseout", (event) => {
    const fromHost = annotationTooltipHost(event.target);
    const toHost = annotationTooltipHost(event.relatedTarget);
    if (fromHost && fromHost !== toHost) hideAnnotationTooltip();
  });
  document.addEventListener("submit", (event) => {
    if (!event.target?.matches?.("[data-user-note-form]")) return;
    event.preventDefault();
    handleUserNoteCreate();
  });
  document.addEventListener("change", (event) => {
    const statusSelect = event.target?.closest?.("[data-user-note-status]");
    if (!statusSelect) return;
    handleUserNoteStatus(statusSelect.dataset.userNoteStatus, statusSelect.value);
  });
  document.addEventListener(
    "toggle",
    (event) => {
      const noteCard = event.target?.closest?.(".annotation-note-card[data-user-note-id]");
      if (!noteCard) return;
      const noteId = text(noteCard.dataset.userNoteId).trim();
      if (!noteId) return;
      if (noteCard.open) state.userAnnotationExpandedNoteIds.add(noteId);
      else if (state.userAnnotationEditingNoteId !== noteId) state.userAnnotationExpandedNoteIds.delete(noteId);
    },
    true,
  );
  $("tree")?.addEventListener("click", (event) => {
    const toggle = event.target.closest("[data-tree-toggle-id]");
    if (toggle) {
      const id = toggle.dataset.treeToggleId;
      if (state.expandedCapabilityIds.has(id)) state.expandedCapabilityIds.delete(id);
      else state.expandedCapabilityIds.add(id);
    renderCapabilities();
    return;
  }
  const row = event.target.closest("[data-capability-id]");
  if (!row) return;
  state.selectedCapabilityId = row.dataset.capabilityId;
  const selectedType = capabilityItemTypeById(state.selectedCapabilityId);
  if (selectedType === "capability_focus") {
    ensureCapabilityProjectionForFocus(state.selectedCapabilityId);
  } else if (!state.loadedPackages.has("capabilityWorkbench")) {
    loadDataPackage("capabilityWorkbench").then(() => {
      if (state.activeView === "capabilities") renderCapabilities();
    });
  }
  renderCapabilities();
});
  $("detail")?.addEventListener("click", (event) => {
  const row = event.target.closest("[data-capability-id]");
  if (!row) return;
  state.selectedCapabilityId = row.dataset.capabilityId;
  if (capabilityItemTypeById(state.selectedCapabilityId) === "capability_focus") ensureCapabilityProjectionForFocus(state.selectedCapabilityId);
  renderCapabilities();
  });
  $("capabilityFocusHeader")?.addEventListener("click", () => {});
  $("detail")?.addEventListener("change", (event) => {
    const tab = event.target.closest(".relation-view-radio");
    if (!tab) return;
    state.activeCapabilityRelationTab = tab.value || "summary";
    persistWorkspaceState();
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
  document.addEventListener("input", (event) => {
    if (event.target?.id !== "environmentSearchInput") return;
    state.activeEnvironmentTab = "mapping";
    state.search = event.target.value.trim();
    renderEnvironment();
  });
  $("devLifecycleStageSearch")?.addEventListener("input", (event) => {
    state.devLifecycleStageSearch = event.target.value.trim();
    renderLifecycle("dev");
  });
  $("dataLifecycleStageSearch")?.addEventListener("input", (event) => {
    state.dataLifecycleStageSearch = event.target.value.trim();
    renderLifecycle("data");
  });
  $("environmentTree")?.addEventListener("click", (event) => {
    const objectRow = event.target.closest("[data-environment-object-id]");
    const segmentRow = event.target.closest("[data-environment-segment-id]");
    const environmentRow = event.target.closest("[data-environment-id]");
    if (!objectRow && !segmentRow && !environmentRow) return;
    state.selectedEnvironmentId = environmentRow?.dataset.environmentId || null;
    state.selectedEnvironmentSegmentId = segmentRow?.dataset.environmentSegmentId || null;
    state.selectedEnvironmentObjectId = objectRow?.dataset.environmentObjectId || null;
    state.selectedEnvironmentRowId = null;
    renderEnvironment();
  });
  $("environmentDetail")?.addEventListener("click", (event) => {
    const reviewRowButton = event.target.closest("[data-environment-review-row-key]");
    if (reviewRowButton) {
      state.activeEnvironmentTab = "review";
      state.selectedEnvironmentReviewRowKey = reviewRowButton.dataset.environmentReviewRowKey || "";
      renderEnvironment();
      return;
    }
    const environmentCatalogToggle = event.target.closest("[data-toggle-environment-catalog]");
    if (environmentCatalogToggle) {
      state.activeEnvironmentTab = "mapping";
      state.environmentCatalogCollapsed = !state.environmentCatalogCollapsed;
      renderEnvironment();
      return;
    }
    const environmentToggle = event.target.closest("[data-environment-tree-toggle-id]");
    if (environmentToggle) {
      state.activeEnvironmentTab = "mapping";
      const id = environmentToggle.dataset.environmentTreeToggleId;
      if (state.expandedEnvironmentIds.has(id)) state.expandedEnvironmentIds.delete(id);
      else state.expandedEnvironmentIds.add(id);
      renderEnvironment();
      return;
    }
    const objectRow = event.target.closest("[data-environment-object-id]");
    const segmentRow = event.target.closest("[data-environment-segment-id]");
    const environmentRow = event.target.closest("[data-environment-id]");
    if (objectRow || segmentRow || environmentRow) {
      state.activeEnvironmentTab = event.target.closest(".environment-tab-panel-mapping") ? "mapping" : "topology";
      state.selectedEnvironmentId = environmentRow?.dataset.environmentId || null;
      state.selectedEnvironmentSegmentId = segmentRow?.dataset.environmentSegmentId || null;
      state.selectedEnvironmentObjectId = objectRow?.dataset.environmentObjectId || null;
      state.selectedEnvironmentRowId = null;
      renderEnvironment();
      return;
    }
    const row = event.target.closest("[data-environment-row-id]");
    if (!row) return;
    state.activeEnvironmentTab = "mapping";
    state.selectedEnvironmentRowId = row.dataset.environmentRowId;
    renderEnvironment();
  });
  $("environmentDetail")?.addEventListener("change", (event) => {
    const reviewFilter = event.target?.closest?.("[data-environment-review-filter]");
    if (reviewFilter && reviewFilter.closest("#environmentDetail")) {
      state.environmentReviewFilters[reviewFilter.dataset.environmentReviewFilter] = reviewFilter.value;
      state.selectedEnvironmentReviewRowKey = "";
      renderEnvironment();
      return;
    }
    const reviewToggle = event.target?.closest?.("[data-environment-review-toggle]");
    if (reviewToggle) {
      state.environmentReviewFilters[reviewToggle.dataset.environmentReviewToggle] = Boolean(reviewToggle.checked);
      state.selectedEnvironmentReviewRowKey = "";
      renderEnvironment();
      return;
    }
    if (event.target?.name !== "environmentDetailTab") return;
    state.activeEnvironmentTab =
      event.target.id === "environmentTabMapping" ? "mapping" : event.target.id === "environmentTabReview" ? "review" : "topology";
    if (state.activeEnvironmentTab === "review") ensureRoutePackages();
  });
  document.addEventListener("input", (event) => {
    const reviewFilter = event.target?.closest?.("[data-environment-review-filter]");
    if (reviewFilter && reviewFilter.closest("#environmentDetail")) {
      state.environmentReviewFilters[reviewFilter.dataset.environmentReviewFilter] = reviewFilter.value;
      state.selectedEnvironmentReviewRowKey = "";
      renderEnvironment();
      return;
    }
    if (event.target?.id !== "sourceSearchInput") return;
    state.search = event.target.value.trim();
    renderMaintenance();
  });
  document.addEventListener("click", (event) => {
    const button = event.target.closest("[data-source-page]");
    if (!button) return;
    if (!button.closest("#maintenanceWorkspace")) return;
    const switchMaintenancePage = () => {
      state.activeMaintenancePage = button.dataset.sourcePage;
      if (button.dataset.referenceTab) state.activeReferenceTab = button.dataset.referenceTab;
      state.activeRoute = routeForCurrentState("maintenance");
      if (state.activeMaintenancePage === "references" && !state.activeReferenceTab) state.activeReferenceTab = "gbt";
      if (state.activeMaintenancePage === "standards") state.activeRoute = `/standards/${state.activeStandardFramework}`;
      state.selectedMaintenanceId = null;
      renderMaintenance();
      syncBrowserRoute(state.activeRoute);
      ensureRoutePackages();
      updateApplicationShellChrome();
    };
    requestAnnotationContextSwitch(switchMaintenancePage, button.textContent.trim() || "知识库页面");
  });
  $("sourceList")?.addEventListener("click", (event) => {
    const tab = event.target.closest("[data-reference-tab]");
    if (tab && !tab.dataset.sourcePage) {
      state.activeReferenceTab = tab.dataset.referenceTab;
      state.selectedMaintenanceId = null;
      renderMaintenance();
      return;
    }
    if (event.target.closest(".maintenance-count-bubble")) return;
    const row = event.target.closest("[data-maintenance-id]");
    if (!row) return;
    state.selectedMaintenanceId = row.dataset.maintenanceId;
    renderMaintenance();
  });
  document.addEventListener("sapd:standard-table-select", (event) => {
    const tableId = event.detail?.tableId || "";
    const frameworkId = event.detail?.frameworkId || state.activeStandardFramework;
    if (!tableId || state.activeMaintenancePage !== "standards") return;
    if (frameworkId && frameworkId !== state.activeStandardFramework) return;
    state.activeStandardTableId = tableId;
    state.selectedMaintenanceId = null;
    renderMaintenance();
  });
  document.addEventListener("pointerdown", (event) => {
    const handle = event.target.closest(".workspace-resizer");
    if (handle) beginWorkspaceResize(event, handle);
  });
  document.addEventListener("pointerdown", (event) => {
    beginEnvironmentBasemapDrag(event);
    beginModelingPosterLightboxDrag(event);
  });
  document.addEventListener("pointerover", handleEnvironmentBasemapPointerOver);
  document.addEventListener("pointerout", handleEnvironmentBasemapPointerOut);
  document.addEventListener("pointermove", (event) => {
    updateEnvironmentBasemapDrag(event);
    updateModelingPosterLightboxDrag(event);
  });
  document.addEventListener("pointerup", (event) => {
    endEnvironmentBasemapDrag(event);
    endModelingPosterLightboxDrag(event);
  });
  document.addEventListener("pointercancel", (event) => {
    endEnvironmentBasemapDrag(event);
    endModelingPosterLightboxDrag(event);
  });
  document.addEventListener("wheel", (event) => {
    if (handleEnvironmentBasemapWheel(event)) return;
    handleModelingPosterLightboxWheel(event);
  }, { passive: false });
  document.addEventListener("dblclick", (event) => {
    if (!state.modelingPosterLightboxTarget) return;
    if (!event.target?.closest?.(".modeling-poster-lightbox-scroll")) return;
    applyModelingPosterLightboxZoom(1);
  });
  document.addEventListener("fullscreenchange", () => {
    if (!state.modelingPosterLightboxTarget || document.fullscreenElement) return;
    state.modelingPosterLightboxTarget = null;
    state.modelingPosterLightboxZoom = 1;
    renderContent();
  });
  document.addEventListener("fullscreenchange", () => {
    const viewer = document.querySelector("[data-environment-basemap-viewer]");
    if (!viewer) return;
    window.requestAnimationFrame(() => fitEnvironmentBasemapViewer(viewer));
  });
  window.addEventListener("resize", () => {
    document.querySelectorAll("[data-environment-basemap-viewer][data-basemap-mode='fit']").forEach((viewer) => {
      window.requestAnimationFrame(() => fitEnvironmentBasemapViewer(viewer));
    });
  });
  document.addEventListener("keydown", (event) => {
    const legendSummary = event.target?.closest?.(".modeling-legend-section-summary");
    if (legendSummary && ["Enter", " "].includes(event.key)) {
      event.preventDefault();
      toggleModelingLegendSection(legendSummary);
      return;
    }
    if (state.modelingPosterLightboxTarget && event.key === "Escape") {
      event.preventDefault();
      closeModelingPosterLightbox();
      return;
    }
    const environmentBasemapNode = event.target?.closest?.(".basemap-node[data-mx-id]");
    if (environmentBasemapNode && ["Enter", " "].includes(event.key)) {
      event.preventDefault();
      selectEnvironmentBasemapNode(environmentBasemapNode);
      return;
    }
    if (state.activeView !== "content") return;
    if (!["ArrowUp", "ArrowDown"].includes(event.key)) return;
    if (event.target?.matches?.("input, textarea, select, [contenteditable='true']")) return;
    const selected = contentRows().find((row) => row.id === state.selectedContentId);
    if (!contentSlides(selected).length) return;
    event.preventDefault();
    changeContentSlide(event.key === "ArrowDown" ? 1 : -1, "active");
  });
  document.querySelectorAll("[data-lifecycle-kind]").forEach((button) => {
    button.addEventListener("click", () => {});
  });
  document.addEventListener("click", (event) => {
    const drawerToggle = event.target.closest("[data-annotation-drawer-toggle]");
    if (drawerToggle) {
      state.userAnnotationDrawerOpen = !state.userAnnotationDrawerOpen;
      renderUserAnnotationDrawer();
      return;
    }
    if (event.target.closest("[data-annotation-drawer-close]")) {
      state.userAnnotationDrawerOpen = false;
      renderUserAnnotationDrawer();
      return;
    }
    if (event.target.closest("[data-annotation-context-add]")) {
      openAnnotationTarget(state.annotationContextMenu?.target);
      return;
    }
    if (!event.target.closest("[data-annotation-context-menu]")) {
      if (state.annotationContextMenu) {
        state.annotationContextMenu = null;
        renderUserAnnotationDrawer();
      }
    }
    if (event.target.closest("[data-annotation-draft-save-switch]")) {
      handleAnnotationDraftSaveAndSwitch();
      return;
    }
    if (event.target.closest("[data-annotation-draft-discard-switch]")) {
      handleAnnotationDraftDiscardAndSwitch();
      return;
    }
    if (event.target.closest("[data-annotation-draft-cancel-switch]")) {
      handleAnnotationDraftCancelSwitch();
      return;
    }
    const noteEdit = event.target.closest("[data-user-note-edit]");
    if (noteEdit) {
      handleUserNoteEditStart(noteEdit.dataset.userNoteEdit);
      return;
    }
    const noteJump = event.target.closest("[data-user-note-jump]");
    if (noteJump) {
      jumpToUserNote(noteJump.dataset.userNoteJump);
      return;
    }
    const noteEditSave = event.target.closest("[data-user-note-edit-save]");
    if (noteEditSave) {
      handleUserNoteEditSave(noteEditSave.dataset.userNoteEditSave);
      return;
    }
    if (event.target.closest("[data-user-note-edit-cancel]")) {
      handleUserNoteEditCancel();
      return;
    }
    const noteDelete = event.target.closest("[data-user-note-delete]");
    if (noteDelete) {
      handleUserNoteDelete(noteDelete.dataset.userNoteDelete);
      return;
    }
    if (event.target.closest("#toggleCapabilityCatalog, #expandCapabilityCatalogTab")) {
      state.capabilityCatalogCollapsed = !state.capabilityCatalogCollapsed;
      applyCapabilityCatalogState();
      return;
    }
    if (event.target.closest("#toggleDevLifecycleCatalog, #expandDevLifecycleCatalogTab")) {
      state.devLifecycleCatalogCollapsed = !state.devLifecycleCatalogCollapsed;
      applyDevLifecycleCatalogState();
      return;
    }
    const lifecycle = event.target.closest("[data-lifecycle-kind][data-lifecycle-id]");
    if (lifecycle) {
      if (lifecycle.dataset.lifecycleKind === "dev") state.selectedDevProcessId = lifecycle.dataset.lifecycleId;
      if (lifecycle.dataset.lifecycleKind === "data") state.selectedDataProcessId = lifecycle.dataset.lifecycleId;
      renderLifecycle(lifecycle.dataset.lifecycleKind);
    }
    const environmentBasemapAction = event.target.closest("[data-environment-basemap-action]");
    if (environmentBasemapAction) {
      updateEnvironmentBasemapViewer(environmentBasemapAction.dataset.environmentBasemapAction, environmentBasemapAction);
      return;
    }
    if (environmentBasemapDragState.suppressNextClick) return;
    const environmentBasemapNode = event.target.closest(".basemap-node[data-mx-id]");
    if (environmentBasemapNode) {
      selectEnvironmentBasemapNode(environmentBasemapNode);
      return;
    }
    const environmentBasemapFullscreen = event.target.closest("[data-environment-basemap-fullscreen]");
    if (environmentBasemapFullscreen) {
      const viewer = document.querySelector("[data-environment-basemap-viewer]");
      if (viewer?.requestFullscreen) viewer.requestFullscreen().catch(() => {});
      return;
    }
    const environmentBasemapViewer = event.target.closest("[data-environment-basemap-viewer]");
    if (environmentBasemapViewer) {
      if (!event.target.closest("#environmentBasemapSelection")) clearEnvironmentBasemapSelection(environmentBasemapViewer);
      return;
    }
    const environmentBasemapMap = event.target.closest(".environment-basemap-map");
    if (environmentBasemapMap) {
      clearEnvironmentBasemapSelection(environmentBasemapMap);
      return;
    }
    const modelingPosterLightboxClose = event.target.closest("[data-modeling-poster-lightbox-close]");
    if (modelingPosterLightboxClose) {
      closeModelingPosterLightbox();
      return;
    }
    if (state.modelingPosterLightboxTarget && event.target?.classList?.contains("modeling-poster-lightbox-scroll")) {
      if (state.modelingPosterLightboxDragging) return;
      closeModelingPosterLightbox();
      return;
    }
    const modelingPosterLightboxAction = event.target.closest("[data-modeling-poster-lightbox-action]");
    if (modelingPosterLightboxAction) {
      updateModelingPosterLightboxZoom(modelingPosterLightboxAction.dataset.modelingPosterLightboxAction);
      return;
    }
    const modelingPosterOpen = event.target.closest("[data-modeling-poster-open]");
    if (modelingPosterOpen) {
      openModelingPosterLightbox(modelingPosterOpen.dataset.modelingPosterOpen || "full");
      return;
    }
    const modelingLegendAction = event.target.closest("[data-modeling-legend-action]");
    if (modelingLegendAction) {
      setModelingLegendSections(modelingLegendAction.dataset.modelingLegendAction === "expand-all");
      return;
    }
    const modelingLegendSummary = event.target.closest(".modeling-legend-section-summary");
    if (modelingLegendSummary) {
      event.preventDefault();
      toggleModelingLegendSection(modelingLegendSummary);
      return;
    }
    const modelingLanguageTab = event.target.closest("[data-modeling-language-tab]");
    if (modelingLanguageTab) {
      state.activeModelingLanguageTab = modelingLanguageTab.dataset.modelingLanguageTab;
      renderContent();
      return;
    }
    const environmentPageTab = event.target.closest("[data-environment-tab]");
    if (environmentPageTab) {
      const nextEnvironmentTab = environmentPageTab.dataset.environmentTab;
      state.activeEnvironmentTab = nextEnvironmentTab === "mapping" || nextEnvironmentTab === "review" ? nextEnvironmentTab : "topology";
      renderEnvironment();
      if (state.activeEnvironmentTab === "review") ensureRoutePackages();
      return;
    }
    const contentPage = event.target.closest("[data-content-page]");
    if (contentPage && contentPage.closest("#contentWorkspace")) {
      const switchContentPage = () => {
        state.activeContentPage = contentPage.dataset.contentPage;
        state.activeRoute = routeForCurrentState("content");
        state.selectedContentId = null;
        state.selectedContentSlideIndex = 0;
        renderContent();
        syncBrowserRoute(state.activeRoute);
        ensureRoutePackages();
        updateApplicationShellChrome();
      };
      requestAnnotationContextSwitch(switchContentPage, contentPage.textContent.trim() || "安全指南页面");
      return;
    }
    const slideStep = event.target.closest("[data-content-slide-step]");
    if (slideStep) {
      slideStep.blur();
      changeContentSlide(Number(slideStep.dataset.contentSlideStep || 0), "active");
      return;
    }
    const slideThumb = event.target.closest("[data-content-slide-index]");
    if (slideThumb) {
      state.selectedContentSlideIndex = Number(slideThumb.dataset.contentSlideIndex || 0);
      state.contentSlideScrollMode = "preserve";
      renderContent();
      return;
    }
    const content = event.target.closest("[data-content-id]");
    if (content) {
      state.selectedContentId = content.dataset.contentId;
      state.selectedContentSlideIndex = 0;
      renderContent();
    }
  });
  document.addEventListener("mouseleave", (event) => {
    const stage = event.target.closest?.(".guide-slide-stage");
    if (!stage) return;
    if (stage.contains(document.activeElement)) document.activeElement.blur?.();
  }, true);
  document.addEventListener("click", () => {
    window.setTimeout(persistWorkspaceState, 0);
  });
  document.addEventListener("keydown", () => {
    window.setTimeout(persistWorkspaceState, 0);
  });
}

async function init() {
  const dataClient = window.sapdDataClient;
  if (!dataClient) throw new Error("SAPD Wiki dataClient 未加载");
  await loadScriptOnce("./models/relationGraphModel.js?v=capability-graph-focus-untangle-20260608-3", () => Boolean(window.sapdModels?.buildLocalRelationGraphModel));
  await loadScriptOnce("./components/LocalRelationNetworkGraph.js?v=capability-graph-focus-untangle-20260608-3", () => Boolean(window.sapdComponents?.LocalRelationNetworkGraph));
  await loadScriptOnce("./components/CapabilityLocalRelationMap.js?v=annotation-framework-anchor-20260605-1", () => Boolean(window.sapdComponents?.CapabilityLocalRelationMap));
  await loadScriptOnce("./models/environmentRelationGraphModel.js?v=environment-graph-20260521-1", () => Boolean(window.sapdModels?.buildEnvironmentRelationGraphModel));
  await loadScriptOnce("./components/EnvironmentLocalRelationMap.js?v=environment-reimport-1-5-review-20260612-1", () => Boolean(window.sapdComponents?.EnvironmentLocalRelationMap));
  mountAppShellComponents();
  setupAnnotationSurfaceObserver();
  bindEvents();
  const restoredState = readWorkspaceState();
  const restoreRouteFromLocation = () => {
    activateRoute(routeFromBrowserLocation(), { fromBrowser: true });
  };
  window.addEventListener("hashchange", restoreRouteFromLocation);
  window.addEventListener("popstate", restoreRouteFromLocation);
  const browserRoute = routeFromBrowserLocation();
  const restoredRoute = normalizeAppRoute(restoredState?.activeRoute || "");
  const initialRoute = browserRoute;
  activateRoute(initialRoute, { replace: true });
  if (restoredRoute === state.activeRoute) applyWorkspaceState(restoredState);
  persistWorkspaceState();
  renderActiveView();
  scheduleOverviewWarmup();
}

init();
