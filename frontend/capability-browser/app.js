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
  lastCapabilityRelationSelectionId: "",
  selectedEnvironmentId: null,
  selectedEnvironmentSegmentId: null,
  selectedEnvironmentObjectId: null,
  selectedEnvironmentRowId: null,
  activeEnvironmentTab: "topology",
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
  standardFrameworkLoadErrors: new Map(),
  maintenanceSectionLoads: new Map(),
  loadedMaintenanceSections: new Set(),
  maintenanceSectionStaleReloads: new Set(),
  loadedPackages: new Set(),
  packageLoads: new Map(),
  capabilityProjectionRequestSeq: 0,
  activeCapabilityProjectionRequest: null,
  capabilityProjectionRequests: new Map(),
  capabilityProjectionLoadResults: new Map(),
  annotationContextLoads: new Map(),
  annotationCapabilityProjectionIndex: null,
  annotationCapabilityProjectionIndexPromise: null,
  annotationCapabilityProjectionValueCache: new Map(),
  annotationCapabilityProjectionDataCache: new Map(),
  userFavorites: [],
  userFavoritesByRef: new Map(),
  userFavoritesLoaded: false,
  userFavoriteLoadPromise: null,
  userNotes: [],
  userNoteIndex: null,
  userNotesLoaded: false,
  userNotesLoadPromise: null,
  userNotesExporting: false,
  userNotesExportStatus: null,
  workbenchIssueExporting: false,
  workbenchIssueExportStatus: null,
  workbenchIssueStatusFilter: "全部",
  workbenchIssuePageFilter: "全部",
  workbenchIssuePriorityFilter: "全部",
  workbenchIssueSearch: "",
  workbenchSelectedIssueId: "",
  workbenchSelectedIssueIds: new Set(),
  workbenchIssueSortKey: "updated",
  workbenchIssueSortDirection: "desc",
  workbenchPendingDeleteIssueId: "",
  workbenchIssueSaving: false,
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
  activeUserNoteId: "",
  activeUserNoteTargetRef: "",
  activeUserNoteAnchorType: "",
  annotationMarkerFrame: 0,
  annotationMarkerTimers: [],
  annotationSurfaceObserver: null,
  annotationAnchorIndex: null,
  annotationHiddenAnchorIndex: null,
  annotationNoteIndex: null,
  annotationJumpFailure: null,
  annotationJumpToken: 0,
  globalSearch: "",
  globalSearchOpen: false,
  globalSearchLoading: false,
  globalSearchResults: [],
  globalSearchResultStats: null,
  globalSearchRequestSeq: 0,
  globalSearchStandardsReady: false,
  globalSearchLoadedQuery: "",
  globalSearchPageLoading: false,
  globalSearchPageResults: [],
  globalSearchPageResultStats: null,
  globalSearchPageLoadedQuery: "",
  globalSearchPageLoadedFilter: "全部",
  globalSearchPageLoadedIndex: 0,
  globalSearchPageRequestSeq: 0,
  globalSearchPageFilter: "全部",
  globalSearchPageSelectedKey: "",
  globalSearchPageIndex: 1,
  searchHistoryExpandedKind: "",
  search: "",
  pageSearches: {},
  pendingPageSearchReveal: null,
  pageSearchNavigation: { scope: "", query: "", index: 0, count: 0 },
  pageSearchMatchSets: {},
  composingSearchInputId: "",
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

const TEXT_SELECTION_CLICK_EXEMPT_SELECTOR = [
  "input",
  "textarea",
  "select",
  "option",
  "[contenteditable='true']",
  "[data-allow-selection-click]",
].join(", ");

const TEXT_SELECTION_DRAG_SURFACE_SELECTOR = [
  ".workspace-resizer",
  ".relationship-column-resizer",
  ".network-graph-canvas",
  "[data-environment-basemap-viewport]",
  ".modeling-poster-lightbox-scroll",
  ".basemap-lab-viewport",
  ".environment-object-funnel-viewport",
].join(", ");

function activeTextSelection() {
  const selection = window.getSelection?.();
  if (!selection || selection.isCollapsed || !selection.rangeCount) return null;
  const selectedText = String(selection.toString() || "").trim();
  if (!selectedText) return null;
  return selection;
}

function selectionIntersectsNode(selection, node) {
  if (!selection || !node) return false;
  for (let index = 0; index < selection.rangeCount; index += 1) {
    try {
      if (selection.getRangeAt(index).intersectsNode(node)) return true;
    } catch (_) {
      // Some SVG or detached nodes cannot be tested by Range.intersectsNode.
    }
  }
  return false;
}

function shouldSuppressClickForTextSelection(event) {
  const target = event.target;
  if (!target?.closest) return false;
  if (target.closest(TEXT_SELECTION_CLICK_EXEMPT_SELECTOR)) return false;
  if (target.closest(TEXT_SELECTION_DRAG_SURFACE_SELECTOR)) return false;
  const selection = activeTextSelection();
  if (!selection) return false;
  const clickableHost = target.closest(
    [
      "[data-app-route]",
      "[data-review-item]",
      "[data-search-page-result]",
      "[data-global-search-result]",
      "[data-capability-id]",
      "[data-maintenance-id]",
      "[data-environment-id]",
      "[data-environment-segment-id]",
      "[data-environment-object-id]",
      "[data-environment-row-id]",
      "[data-content-id]",
      "[data-lifecycle-kind]",
      "[data-source-page]",
      "[data-reference-tab]",
      ".catalog-row",
      ".source-nav-button",
      ".tree-row",
      "tr",
    ].join(", "),
  );
  return Boolean(clickableHost && selectionIntersectsNode(selection, clickableHost));
}

function suppressClickIfTextSelection(event) {
  if (!shouldSuppressClickForTextSelection(event)) return;
  event.preventDefault();
  event.stopImmediatePropagation();
}

function searchScopeForCurrentState() {
  if (state.activeView === "capabilities") return "capability-mapping";
  if (state.activeView === "environment") return "environment-mapping";
  if (state.activeView === "dev-lifecycle") return "development-security";
  if (state.activeView === "data-lifecycle") return "data-security";
  if (state.activeView === "maintenance") {
    if (state.activeMaintenancePage === "standards") {
      return `standards:${state.activeStandardFramework || ""}:${state.activeStandardTableId || ""}`;
    }
    return `knowledge:${state.activeMaintenancePage || ""}:${state.activeReferenceTab || ""}`;
  }
  if (state.activeView === "workbench") return `workbench:${state.activeRoute || "/workbench"}`;
  if (state.activeView === "content") return `content:${state.activeRoute || state.activeContentPage || ""}`;
  if (state.activeView === "placeholder") return `placeholder:${state.activeRoute || ""}`;
  return state.activeView || "overview";
}

function currentScopedSearch() {
  const scope = searchScopeForCurrentState();
  return text(state.pageSearches?.[scope] || "").trim();
}

function restoreScopedSearch() {
  state.search = currentScopedSearch();
}

function setScopedSearch(value) {
  const scope = searchScopeForCurrentState();
  const nextValue = text(value).trim();
  state.search = nextValue;
  state.pageSearches = { ...(state.pageSearches || {}), [scope]: nextValue };
}

const SEARCH_COMPOSITION_INPUT_SELECTOR = [
  "#searchInput",
  "#searchPageQueryInput",
  "#capabilitySearchInput",
  "#sourceSearchInput",
  "#environmentSearchInput",
  "#devLifecycleStageSearch",
  "#dataLifecycleStageSearch",
  "[data-relation-filter]",
  "[data-review-filter-control='search']",
].join(", ");

const SEARCH_HISTORY_INPUT_SELECTOR = [
  "#searchInput",
  "#searchPageQueryInput",
  "#capabilitySearchInput",
  "#sourceSearchInput",
  "#environmentSearchInput",
  "#devLifecycleStageSearch",
  "#dataLifecycleStageSearch",
  "#workbenchIssueSearchInput",
].join(", ");

function isManagedSearchInput(target) {
  return Boolean(target?.matches?.(SEARCH_COMPOSITION_INPUT_SELECTOR));
}

function isComposingSearchInput(event) {
  const target = event?.target;
  return Boolean(event?.isComposing || target?.dataset?.searchComposing === "true" || (target?.id && state.composingSearchInputId === target.id));
}

function restoreSearchInputFocus(inputId = "", cursor = null) {
  if (!inputId) return;
  requestAnimationFrame(() => {
    const input = $(inputId);
    if (!input) return;
    input.focus({ preventScroll: true });
    if (Number.isFinite(Number(cursor)) && typeof input.setSelectionRange === "function") {
      const offset = Math.max(0, Math.min(Number(cursor), text(input.value).length));
      input.setSelectionRange(offset, offset);
    }
  });
}

function queuePageSearchReveal(value, scope = searchScopeForCurrentState(), options = {}) {
  const query = text(value).trim();
  const current = state.pageSearchNavigation || {}, revealOptions = options && typeof options === "object" ? options : {};
  const activeIndex = current.scope === scope && current.query === query ? Number(current.index) || 0 : 0;
  const index = Number.isFinite(Number(revealOptions.index)) ? Number(revealOptions.index) : activeIndex;
  state.pageSearchNavigation = query ? { scope, query, index: activeIndex, count: 0 } : { scope, query: "", index: 0, count: 0 };
  state.pendingPageSearchReveal = query ? { ...revealOptions, scope, query, index } : null;
  if (!query) { clearPageSearchHighlights(); updatePageSearchControls(); }
}

function pageSearchQueryForScope(scope = searchScopeForCurrentState()) {
  if (scope === "development-security") return text(state.devLifecycleStageSearch).trim();
  if (scope === "data-security") return text(state.dataLifecycleStageSearch).trim();
  if (scope === searchScopeForCurrentState()) return text(state.search || currentScopedSearch()).trim();
  return text(state.pageSearches?.[scope] || "").trim();
}

function clearPageSearchMatchSet(scope = searchScopeForCurrentState()) {
  const nextSets = { ...(state.pageSearchMatchSets || {}) };
  delete nextSets[scope];
  state.pageSearchMatchSets = nextSets;
}

function pageSearchMatchSet(scope = searchScopeForCurrentState(), query = pageSearchQueryForScope(scope)) {
  const set = state.pageSearchMatchSets?.[scope] || null;
  const normalizedQuery = text(query).trim();
  if (!set || !normalizedQuery || text(set.query).trim() !== normalizedQuery) return null;
  return set;
}

function setPageSearchMatchSet(scope = searchScopeForCurrentState(), query = "", matches = [], activeId = "") {
  const normalizedQuery = text(query).trim();
  if (!normalizedQuery) {
    clearPageSearchMatchSet(scope);
    if (state.pageSearchNavigation?.scope === scope) state.pageSearchNavigation = { scope, query: "", index: 0, count: 0 };
    return;
  }
  const normalizedMatches = list(matches)
    .map((match) => ({
      ...match,
      id: text(match?.id).trim(),
      title: text(match?.title || match?.label || match?.code).trim(),
    }))
    .filter((match) => match.id);
  state.pageSearchMatchSets = {
    ...(state.pageSearchMatchSets || {}),
    [scope]: { query: normalizedQuery, matches: normalizedMatches },
  };
  const selectedIndex = Math.max(0, normalizedMatches.findIndex((match) => match.id === text(activeId).trim()));
  const count = normalizedMatches.length;
  state.pageSearchNavigation = { scope, query: normalizedQuery, index: count ? selectedIndex : 0, count };
  if (state.pendingPageSearchReveal?.scope === scope && state.pendingPageSearchReveal.query === normalizedQuery) {
    state.pendingPageSearchReveal.displayIndex = count ? selectedIndex : 0;
    state.pendingPageSearchReveal.displayCount = count;
    state.pendingPageSearchReveal.index = Number.isFinite(Number(state.pendingPageSearchReveal.index)) ? Number(state.pendingPageSearchReveal.index) : 0;
  }
}

function routeHasPageSearch(route = state.activeRoute) {
  const value = text(route).trim();
  return (
    value === "/capability-mapping" ||
    value === "/environment-mapping" ||
    value.startsWith("/knowledge/") ||
    value.startsWith("/standards/") ||
    value.startsWith("/guides/")
  );
}

function clearScopedSearchForCurrentDestination() {
  const scope = searchScopeForCurrentState();
  const pageSearches = { ...(state.pageSearches || {}) };
  if (scope && Object.prototype.hasOwnProperty.call(pageSearches, scope)) {
    delete pageSearches[scope];
    state.pageSearches = pageSearches;
  }
  state.search = "";
}

function clearDestinationSearchForGlobalActivation(route = "") {
  clearScopedSearchForCurrentDestination();
  if (route === "/development-security") state.devLifecycleStageSearch = "";
  if (route === "/data-security") state.dataLifecycleStageSearch = "";
  syncSearchInputs();
}

function searchTextForActivatedResult(result = {}) {
  return cleanGlobalSearchDisplayText(result.targetText || result.title || result.code || state.globalSearch);
}

function syncSearchInputs() {
  const globalInput = $("searchInput");
  if (globalInput && globalInput.value !== state.globalSearch) globalInput.value = state.globalSearch;
  const searchPageInput = $("searchPageQueryInput");
  if (searchPageInput && searchPageInput.value !== state.globalSearch) searchPageInput.value = state.globalSearch;
  const capabilityInput = $("capabilitySearchInput");
  if (capabilityInput && capabilityInput.value !== state.search) capabilityInput.value = state.search;
  const sourceInput = $("sourceSearchInput");
  if (sourceInput && sourceInput.value !== state.search) sourceInput.value = state.search;
  const environmentInput = $("environmentSearchInput");
  if (environmentInput && environmentInput.value !== state.search) environmentInput.value = state.search;
}

const GLOBAL_SEARCH_MIN_QUERY_LENGTH = 1;
const GLOBAL_SEARCH_RESULT_LIMIT = 40;
const GLOBAL_SEARCH_PAGE_RESULT_LIMIT = 120;
const GLOBAL_SEARCH_PAGE_SIZE = 20;
const SEARCH_HISTORY_STORAGE_KEY = "sapd-wiki-search-history-v1";
const SEARCH_HISTORY_MAX_ITEMS = 10;
const SEARCH_HISTORY_COLLAPSED_ITEMS = 5;
const globalSearchIndexQueryCache = new Map();
const searchHistoryCommitTimers = new Map();
let searchHistoryMemoryStore = null;

function safeSearchHistoryStore() {
  if (searchHistoryMemoryStore) return searchHistoryMemoryStore;
  try {
    const raw = window.localStorage?.getItem(SEARCH_HISTORY_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    searchHistoryMemoryStore = parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    searchHistoryMemoryStore = {};
  }
  return searchHistoryMemoryStore;
}

function persistSearchHistoryStore(store = safeSearchHistoryStore()) {
  searchHistoryMemoryStore = store && typeof store === "object" ? store : {};
  try {
    window.localStorage?.setItem(SEARCH_HISTORY_STORAGE_KEY, JSON.stringify(searchHistoryMemoryStore));
  } catch {
    // localStorage can be unavailable in strict local previews; in-memory history still works.
  }
}

function searchHistoryKindForInput(input) {
  const id = text(input?.id).trim();
  const declaredKind = text(input?.dataset?.searchHistoryKind).trim();
  if (declaredKind && input?.matches?.(SEARCH_HISTORY_INPUT_SELECTOR)) return declaredKind;
  if (id === "searchInput" || id === "searchPageQueryInput") return "global";
  if (id === "capabilitySearchInput") return "capability";
  if (id === "environmentSearchInput") return "environment";
  if (id === "devLifecycleStageSearch") return "lc-ap";
  if (id === "dataLifecycleStageSearch") return "lc-dt";
  if (id === "sourceSearchInput") return sourceSearchHistoryKind();
  if (id === "workbenchIssueSearchInput") return "workbench-issues";
  return "";
}

function searchHistoryTitle(kind = "") {
  const titles = {
    global: "全局搜索记录",
    capability: "安全能力页搜索记录",
    environment: "信息化环境页搜索记录",
    "lc-ap": "LC-AP 页搜索记录",
    "lc-dt": "LC-DT 页搜索记录",
    knowledge: "知识库页搜索记录",
    standards: "标准 / 框架页搜索记录",
    guides: "指南页搜索记录",
    "workbench-issues": "Issue 筛选记录",
  };
  return titles[text(kind).trim()] || "页面内搜索记录";
}

function searchHistoryItems(kind = "") {
  return list(safeSearchHistoryStore()[kind]).map((item) => text(item).trim()).filter(Boolean).slice(0, SEARCH_HISTORY_MAX_ITEMS);
}

function setSearchHistoryItems(kind = "", items = []) {
  const targetKind = text(kind).trim();
  if (!targetKind) return;
  const store = { ...safeSearchHistoryStore() };
  store[targetKind] = list(items).map((item) => text(item).trim()).filter(Boolean).slice(0, SEARCH_HISTORY_MAX_ITEMS);
  persistSearchHistoryStore(store);
}

function refreshSearchHistoryPanelForKind(kind = "") {
  const targetKind = text(kind).trim();
  const panel = document.getElementById("searchHistoryPanel");
  if (!targetKind || !panel || panel.hidden || text(panel.dataset.searchHistoryKind).trim() !== targetKind) return;
  const inputId = text(panel.dataset.searchHistoryInputId).trim();
  const sourceInput = inputId ? $(inputId) : null;
  if (sourceInput?.matches?.(SEARCH_HISTORY_INPUT_SELECTOR)) renderSearchHistoryPanel(sourceInput);
}

function clearSearchHistoryCommitTimer(key = "") {
  const targetKey = text(key).trim();
  if (!targetKey) return;
  window.clearTimeout(searchHistoryCommitTimers.get(targetKey));
  searchHistoryCommitTimers.delete(targetKey);
}

function clearSearchHistoryCommitTimersForKind(kind = "") {
  const targetKind = text(kind).trim();
  if (!targetKind) return;
  document.querySelectorAll(SEARCH_HISTORY_INPUT_SELECTOR).forEach((input) => {
    if (searchHistoryKindForInput(input) === targetKind) clearSearchHistoryCommitTimer(input.id || targetKind);
  });
  clearSearchHistoryCommitTimer(targetKind);
}

function rememberSearchQuery(kind = "", query = "", options = {}) {
  const targetKind = text(kind).trim();
  const value = text(query).trim();
  if (!targetKind || !value) return;
  const nextItems = [value, ...searchHistoryItems(targetKind).filter((item) => item !== value)].slice(0, SEARCH_HISTORY_MAX_ITEMS);
  setSearchHistoryItems(targetKind, nextItems);
  if (options.refresh !== false) refreshSearchHistoryPanelForKind(targetKind);
}

function rememberCommittedSearchQuery(kind = "", query = "", options = {}) {
  const targetKind = text(kind).trim();
  const value = text(query).trim();
  if (!targetKind || !value) return;
  clearSearchHistoryCommitTimersForKind(targetKind);
  rememberSearchQuery(targetKind, value, options);
}

function globalSearchQueryHasLoaded(value = "") {
  const query = text(value).trim();
  if (query.length < GLOBAL_SEARCH_MIN_QUERY_LENGTH) return false;
  return text(state.globalSearchLoadedQuery).trim() === query || text(state.globalSearchPageLoadedQuery).trim() === query;
}

function commitLoadedSearchHistoryForInput(input) {
  const kind = searchHistoryKindForInput(input);
  const value = text(input?.value).trim();
  if (kind !== "global" || !globalSearchQueryHasLoaded(value)) return;
  rememberCommittedSearchQuery(kind, value, { refresh: false });
}

function scheduleSearchHistoryCommit(input, query = text(input?.value).trim()) {
  const kind = searchHistoryKindForInput(input);
  if (!kind) return;
  const key = input?.id || kind;
  window.clearTimeout(searchHistoryCommitTimers.get(key));
  searchHistoryCommitTimers.set(
    key,
    window.setTimeout(() => {
      searchHistoryCommitTimers.delete(key);
      rememberSearchQuery(kind, query);
    }, 700),
  );
}

function removeSearchHistoryItem(kind = "", query = "") {
  const target = text(query).trim();
  setSearchHistoryItems(kind, searchHistoryItems(kind).filter((item) => item !== target));
}

function clearSearchHistory(kind = "") {
  setSearchHistoryItems(kind, []);
}

function ensureSearchHistoryPanel() {
  let panel = document.getElementById("searchHistoryPanel");
  if (!panel) {
    document.body.insertAdjacentHTML("beforeend", '<div id="searchHistoryPanel" class="search-history-panel" hidden></div>');
    panel = document.getElementById("searchHistoryPanel");
  }
  return panel;
}

function hideSearchHistoryPanel() {
  const panel = document.getElementById("searchHistoryPanel");
  if (!panel) return;
  panel.hidden = true;
  panel.innerHTML = "";
}

function renderSearchHistoryPanel(input) {
  if (!input?.matches?.(SEARCH_HISTORY_INPUT_SELECTOR)) return;
  const kind = searchHistoryKindForInput(input);
  commitLoadedSearchHistoryForInput(input);
  const items = searchHistoryItems(kind);
  const panel = ensureSearchHistoryPanel();
  if (!kind || !items.length) {
    hideSearchHistoryPanel();
    return;
  }
  const expanded = state.searchHistoryExpandedKind === kind;
  const visibleItems = expanded ? items : items.slice(0, SEARCH_HISTORY_COLLAPSED_ITEMS);
  const rect = input.getBoundingClientRect();
  const panelWidth = Math.round(Math.min(Math.max(rect.width, 260), Math.max(260, window.innerWidth - 24)));
  const panelLeft = Math.round(Math.min(Math.max(12, rect.left), Math.max(12, window.innerWidth - panelWidth - 12)));
  panel.hidden = false;
  panel.dataset.searchHistoryKind = kind;
  panel.dataset.searchHistoryInputId = input.id || "";
  panel.style.left = `${panelLeft}px`;
  panel.style.top = `${Math.round(rect.bottom + 8)}px`;
  panel.style.width = `${panelWidth}px`;
  panel.innerHTML = `
    <div class="search-history-head">
      <strong>${escapeHtml(searchHistoryTitle(kind))}</strong>
      <button type="button" data-search-history-clear="${escapeHtml(kind)}">清空</button>
    </div>
    <div class="search-history-list" role="listbox">
      ${visibleItems
        .map(
          (item) => `
            <div class="search-history-row" role="option">
              <button class="search-history-pick" type="button" data-search-history-pick="${escapeHtml(item)}">${escapeHtml(item)}</button>
              <button class="search-history-remove" type="button" aria-label="删除 ${escapeHtml(item)}" data-search-history-remove="${escapeHtml(item)}">×</button>
            </div>
          `,
        )
        .join("")}
    </div>
    ${
      items.length > SEARCH_HISTORY_COLLAPSED_ITEMS
        ? `<button class="search-history-expand" type="button" data-search-history-expand="${escapeHtml(kind)}">${expanded ? "收起搜索记录" : `显示全部 ${items.length} 条`}</button>`
        : ""
    }
  `;
}

function applySearchHistoryQuery(input, query = "") {
  if (!input) return;
  const value = text(query).trim();
  if (!value) return;
  input.value = value;
  rememberCommittedSearchQuery(searchHistoryKindForInput(input), value);
  hideSearchHistoryPanel();
  if (input.id === "searchInput") {
    state.globalSearch = value;
    syncSearchInputs();
    runGlobalSearch();
    return;
  }
  if (input.id === "searchPageQueryInput") {
    openGlobalSearchPage(value, { replace: true });
    return;
  }
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

function normalizeSearchText(value) {
  return text(value).trim().toLowerCase();
}

function compactSearchText(...values) {
  return values
    .flatMap((value) => (Array.isArray(value) ? value : [value]))
    .map((value) => (typeof value === "object" ? [value?.code, value?.title, value?.name, value?.description, value?.summary].filter(Boolean).join(" ") : text(value)))
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

const GLOBAL_SEARCH_BUSINESS_ALIASES_BY_CODE = {};
const GLOBAL_SEARCH_QUERY_ALIASES = {};

function businessSearchAliasesForCode(code = "") {
  return GLOBAL_SEARCH_BUSINESS_ALIASES_BY_CODE[text(code).trim()] || "";
}

function searchQueryAliasesForText(query = "") {
  return list(GLOBAL_SEARCH_QUERY_ALIASES[text(query).trim()]).map(text).filter(Boolean);
}

function compactGlobalSearchComparable(value) {
  return normalizeSearchText(value).replace(/[^a-z0-9\u4e00-\u9fa5]+/gi, "");
}

function globalSearchQueryVariants(query = "") {
  const raw = normalizeSearchText(query);
  const compact = compactGlobalSearchComparable(raw);
  return [raw, compact, ...searchQueryAliasesForText(raw), ...searchQueryAliasesForText(compact)]
    .map((value) => normalizeSearchText(value))
    .filter(Boolean)
    .filter((value, index, values) => values.indexOf(value) === index);
}

function globalSearchValueMatches(value, variant = "") {
  const rawValue = normalizeSearchText(value);
  const compactValue = compactGlobalSearchComparable(value);
  const compactVariant = compactGlobalSearchComparable(variant);
  return Boolean((variant && rawValue.includes(variant)) || (compactVariant && compactValue.includes(compactVariant)));
}

function globalSearchValueStartsWith(value, variant = "") {
  const rawValue = normalizeSearchText(value);
  const compactValue = compactGlobalSearchComparable(value);
  const compactVariant = compactGlobalSearchComparable(variant);
  return Boolean((variant && rawValue.startsWith(variant)) || (compactVariant && compactValue.startsWith(compactVariant)));
}

function globalSearchValueExact(value, variant = "") {
  const rawValue = normalizeSearchText(value);
  const compactValue = compactGlobalSearchComparable(value);
  const compactVariant = compactGlobalSearchComparable(variant);
  return Boolean(rawValue === variant || (compactVariant && compactValue === compactVariant));
}

function isInternalSearchCode(value) {
  const normalized = text(value).trim();
  if (!normalized) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(normalized) || /^(?:[a-z][a-z0-9_]*:)?[0-9a-f]{12,}$/i.test(normalized);
}

function cleanGlobalSearchDisplayText(value) {
  let normalized = text(value).replace(/\s+/g, " ").trim();
  const internalPrefix = /^(?:(?:[a-z][a-z0-9_]*:)?[0-9a-f]{12,}|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\s+/i;
  while (normalized && internalPrefix.test(normalized)) {
    normalized = normalized.replace(internalPrefix, "").trim();
  }
  return normalized;
}

function sanitizeGlobalSearchResult(result = {}) {
  const cleanCode = isInternalSearchCode(result.code) ? "" : text(result.code).trim();
  const cleanTitle = cleanGlobalSearchDisplayText(result.title || result.name || result.label || cleanCode || result.targetText || result.target_text);
  const cleanTargetText = cleanGlobalSearchDisplayText(result.targetText || result.target_text || cleanTitle || cleanCode);
  const targetRef = text(result.targetRef || result.target_ref).trim();
  const objectType = text(result.objectType || result.object_type).trim();
  const objectId = text(result.objectId || result.object_id).trim();
  const matchContext = cleanGlobalSearchDisplayText(result.matchContext || result.match_context || result.summary || "");
  const matchKind = text(result.matchKind || result.match_kind).trim();
  return {
    ...result,
    code: cleanCode,
    title: cleanTitle,
    targetText: cleanTargetText,
    matchContext,
    matchKind,
    targetRef,
    objectType,
    objectId,
  };
}

function scoreGlobalSearchResult(result, query) {
  return globalSearchMatchDetails(result, query).score;
}

function globalSearchMatchDetails(result = {}, query = "") {
  const variants = globalSearchQueryVariants(query);
  if (!variants.length) return { score: 0, matchKind: "none" };
  const code = result.code;
  const title = result.title;
  const targetText = result.targetText || result.target_text;
  const identity = compactSearchText(result.identityText, code, title, targetText, result.aliases);
  const content = compactSearchText(result.contentText, result.searchText, result.description, result.summary);
  const context = compactSearchText(result.contextText, result.subtitle);
  for (const variant of variants) {
    if (globalSearchValueExact(code, variant)) return { score: 130, matchKind: "code_exact" };
    if (globalSearchValueExact(title, variant) || globalSearchValueExact(targetText, variant)) return { score: 120, matchKind: "title_exact" };
    if (globalSearchValueStartsWith(code, variant)) return { score: 105, matchKind: "code_prefix" };
    if (globalSearchValueStartsWith(title, variant) || globalSearchValueStartsWith(targetText, variant)) return { score: 100, matchKind: "title_prefix" };
    if (globalSearchValueMatches(code, variant)) return { score: 90, matchKind: "code_contains" };
    if (globalSearchValueMatches(title, variant) || globalSearchValueMatches(targetText, variant)) return { score: 80, matchKind: "title_contains" };
    if (globalSearchValueMatches(identity, variant)) return { score: 72, matchKind: "identity_contains" };
    if (globalSearchValueMatches(content, variant)) return { score: 42, matchKind: "content_contains" };
    if (globalSearchValueMatches(context, variant)) return { score: 24, matchKind: "context_contains" };
  }
  return { score: 0, matchKind: "none" };
}

function addGlobalSearchResult(results, result) {
  const displayResult = sanitizeGlobalSearchResult(result);
  const key = globalSearchResultDedupKey(displayResult);
  if (!key || results.has(key)) return;
  results.set(key, { ...displayResult, key });
}

function globalSearchSemanticTargetKey(result = {}) {
  const route = text(result.route).trim();
  const targetRef = text(result.targetRef || result.target_ref).trim();
  if (targetRef) {
    const [targetType, ...targetParts] = targetRef.split(":");
    if (targetType && targetParts.length) {
      return ["target", route, targetType, targetParts.join(":")].filter(Boolean).join("::");
    }
    return ["target", route, targetRef].filter(Boolean).join("::");
  }

  const explicitObjectType = text(result.objectType || result.object_type).trim();
  const explicitObjectId = text(result.objectId || result.object_id).trim();
  if (explicitObjectType && explicitObjectId) {
    return ["target", route, explicitObjectType, explicitObjectId].filter(Boolean).join("::");
  }

  const semanticSelectors = [
    ["maintenance", result.selectedMaintenanceId],
    ["capability", result.selectedCapabilityId],
    ["environment_object", result.selectedEnvironmentObjectId],
    ["environment_segment", result.selectedEnvironmentSegmentId],
    ["environment", result.selectedEnvironmentId],
    ["process", result.selectedProcessId],
    ["content", result.selectedContentId],
    ["standard_table", result.standardTableId],
    ["standard_framework", result.standardFramework],
  ];
  const matchedSelector = semanticSelectors.find(([, value]) => text(value).trim());
  if (!matchedSelector) return "";
  const [semanticType, semanticId] = matchedSelector;
  return ["target", route, semanticType, text(semanticId).trim()].filter(Boolean).join("::");
}

function globalSearchResultDedupKey(result = {}) {
  const semanticKey = globalSearchSemanticTargetKey(result);
  if (semanticKey) return semanticKey;

  const route = text(result.route).trim();
  const type = text(result.typeLabel || result.type).trim();
  const title = cleanGlobalSearchDisplayText(result.title || result.targetText || result.code);
  const subtitle = cleanGlobalSearchDisplayText(result.subtitle || result.summary || result.description || "");
  return ["visible", type, route, title, subtitle].filter(Boolean).join("::");
}

function globalSearchNormalizedDisplayText(value) {
  return normalizeSearchText(cleanGlobalSearchDisplayText(value));
}

function isLifecycleGlobalSearchResult(result = {}) {
  const route = text(result.route).trim();
  return route === "/development-security" || route === "/data-security" || text(result.type).trim() === "lifecycle";
}

function globalSearchTargetRefDepth(result = {}) {
  const targetRef = text(result.targetRef || result.target_ref).trim();
  if (!targetRef) return 0;
  return targetRef.split(":").filter(Boolean).length;
}

function globalSearchHasLifecycleContext(result = {}) {
  return Boolean(text(result.selectedProcessId).trim() || globalSearchTargetRefDepth(result) >= 3);
}

function isLifecycleNonContextResult(result = {}) {
  return isLifecycleGlobalSearchResult(result) && !globalSearchHasLifecycleContext(result);
}

function isLifecycleContainerSearchResult(result = {}) {
  if (!isLifecycleGlobalSearchResult(result)) return false;
  const typeLabel = text(result.typeLabel || result.type_label).trim();
  const title = text(result.title || result.code).trim();
  return /(?:LC-AP|LC-DT|阶段|过程)/.test(typeLabel) || /^(?:AP|DT)-\d{2}\b/i.test(title);
}

function globalSearchResultSpecificity(result = {}, query = "") {
  const q = normalizeSearchText(query);
  const title = globalSearchNormalizedDisplayText(result.title);
  const targetText = globalSearchNormalizedDisplayText(result.targetText || result.target_text);
  let weight = Number(result.score) || 0;
  if (title && title === q) weight += 400;
  if (targetText && targetText === q) weight += 260;
  if (globalSearchTargetRefDepth(result) >= 3) weight += 160;
  if (text(result.targetRef || result.target_ref).trim()) weight += 80;
  if (globalSearchHasLifecycleContext(result)) weight += 50;
  if (text(result.objectType || result.object_type).trim()) weight += 20;
  if (isLifecycleContainerSearchResult(result) && title !== q) weight -= 240;
  return weight;
}

function isGlobalSearchIdentityMatch(result = {}) {
  const matchKind = text(result.matchKind || result.match_kind).trim();
  const score = Number(result.score) || 0;
  return score >= 72 && /^(?:code|title|identity)_/.test(matchKind);
}

function isGlobalSearchWeakMatch(result = {}) {
  const matchKind = text(result.matchKind || result.match_kind).trim();
  const score = Number(result.score) || 0;
  return /^(?:content|context)_/.test(matchKind) || (matchKind && score < 72);
}

function chooseMoreSpecificGlobalSearchResult(left, right, query = "") {
  if (!left) return right;
  const leftWeight = globalSearchResultSpecificity(left, query);
  const rightWeight = globalSearchResultSpecificity(right, query);
  if (rightWeight !== leftWeight) return rightWeight > leftWeight ? right : left;
  const rightScore = Number(right?.score) || 0;
  const leftScore = Number(left?.score) || 0;
  if (rightScore !== leftScore) return rightScore > leftScore ? right : left;
  return text(left.title).localeCompare(text(right.title), "zh-Hans-CN") <= 0 ? left : right;
}

function globalSearchVisibleDedupeKey(result = {}) {
  const route = text(result.route).trim();
  const category = globalSearchResultCategory(result);
  const title = globalSearchNormalizedDisplayText(result.title || result.targetText || result.code);
  const subtitle = globalSearchNormalizedDisplayText(result.subtitle || result.summary || result.description || "");
  const targetText = globalSearchNormalizedDisplayText(result.targetText || result.title || result.code);
  if (!route || !title) return "";
  return ["display", route, category, title, subtitle, targetText].join("::");
}

function pruneGlobalSearchResultsForQuery(results = [], query = "") {
  const q = normalizeSearchText(query);
  if (!q) return list(results);

  const visibleMap = new Map();
  list(results).forEach((result) => {
    const displayKey = globalSearchVisibleDedupeKey(result);
    if (!displayKey) return;
    visibleMap.set(displayKey, chooseMoreSpecificGlobalSearchResult(visibleMap.get(displayKey), result, q));
  });

  const rows = [...visibleMap.values()];
  const dropRows = new WeakSet();
  if (rows.some(isGlobalSearchIdentityMatch)) {
    rows.filter(isGlobalSearchWeakMatch).forEach((row) => dropRows.add(row));
  }
  const lifecycleExactTitleGroups = new Map();
  rows.forEach((result) => {
    if (!isLifecycleGlobalSearchResult(result)) return;
    const title = globalSearchNormalizedDisplayText(result.title);
    if (title !== q) return;
    const groupKey = [text(result.route).trim(), title].join("::");
    const group = lifecycleExactTitleGroups.get(groupKey) || [];
    group.push(result);
    lifecycleExactTitleGroups.set(groupKey, group);
  });

  lifecycleExactTitleGroups.forEach((group) => {
    const contextualRows = group.filter(globalSearchHasLifecycleContext);
    const candidateRows = contextualRows.length ? contextualRows : group;
    if (contextualRows.length) group.filter((row) => !globalSearchHasLifecycleContext(row)).forEach((row) => dropRows.add(row));

    const contextMap = new Map();
    candidateRows.forEach((row) => {
      const contextKey = text(row.selectedProcessId || row.targetRef || row.target_ref || row.subtitle || row.objectId || row.object_id || "").trim() || "__global";
      contextMap.set(contextKey, chooseMoreSpecificGlobalSearchResult(contextMap.get(contextKey), row, q));
    });
    candidateRows.forEach((row) => {
      const contextKey = text(row.selectedProcessId || row.targetRef || row.target_ref || row.subtitle || row.objectId || row.object_id || "").trim() || "__global";
      if (contextMap.get(contextKey) !== row) dropRows.add(row);
    });
  });

  const exactLifecycleRoutes = new Set(
    rows
      .filter((row) => !dropRows.has(row) && isLifecycleGlobalSearchResult(row) && globalSearchNormalizedDisplayText(row.title) === q)
      .map((row) => text(row.route).trim())
      .filter(Boolean),
  );

  return rows.filter((result) => {
    if (dropRows.has(result)) return false;
    const route = text(result.route).trim();
    const title = globalSearchNormalizedDisplayText(result.title);
    const targetText = globalSearchNormalizedDisplayText(result.targetText || result.target_text);
    const score = Number(result.score) || 0;
    if (exactLifecycleRoutes.has(route) && isLifecycleNonContextResult(result) && (title.includes(q) || targetText.includes(q))) return false;
    if (exactLifecycleRoutes.has(route) && isLifecycleContainerSearchResult(result) && title !== q && score <= 60) return false;
    return true;
  });
}

function flattenCapabilitySearchItems(capability, capabilityWorkbench) {
  const rows = [];
  const trailById = new Map();
  const visit = (item, route, trail = []) => {
    if (!item || typeof item !== "object") return;
    const id = text(item.id || item.code || item.title).trim();
    const code = text(item.code).trim();
    const title = text(item.title || item.name || code || id).trim();
    const typeLabels = {
      capability_category: "能力分类",
      capability_domain: "能力域",
      capability: "安全能力",
      capability_focus: "安全关注点",
    };
    if (title || code) {
      rows.push({
        id,
        code,
        title: [code, title].filter(Boolean).join(" "),
        type: "capability",
        typeLabel: typeLabels[item.type] || "安全能力",
        route: "/capability-mapping",
        subtitle: [...trail, title].filter(Boolean).join(" / "),
        selectedCapabilityId: id,
        targetText: title,
        searchText: compactSearchText(code, title, item.description),
      });
    }
    const nextTrail = [...trail, title].filter(Boolean);
    if (id) trailById.set(id, nextTrail);
    list(item.domains).forEach((child) => visit(child, route, nextTrail));
    list(item.capabilities).forEach((child) => visit(child, route, nextTrail));
    list(item.focuses).forEach((child) => visit(child, route, nextTrail));
  };
  list(capability?.categories).forEach((category) => visit(category, "/capability-mapping"));
  list(capability?.unlinked_focuses).forEach((focus) => visit(focus, "/capability-mapping", ["未挂接关注点"]));
  const objects = capabilityWorkbench?.objects && typeof capabilityWorkbench.objects === "object" ? capabilityWorkbench.objects : {};
  const byType = (objectType) => (objects[objectType] && typeof objects[objectType] === "object" ? objects[objectType] : {});
  const entity = (objectType, objectId) => byType(objectType)[objectId] || null;
  const addMapping = (map, key, value) => {
    if (!key || !value) return;
    if (!map.has(key)) map.set(key, new Set());
    map.get(key).add(value);
  };
  const serviceFocusIds = new Map();
  const serviceModuleIds = new Map();
  const serviceMeasureIds = new Map();
  list(capabilityWorkbench?.relations).forEach((relation) => {
    const relationType = text(relation?.type).trim();
    const sourceType = text(relation?.sourceType || relation?.source_type).trim();
    const targetType = text(relation?.targetType || relation?.target_type).trim();
    const sourceId = text(relation?.sourceId || relation?.source_id).trim();
    const targetId = text(relation?.targetId || relation?.target_id).trim();
    if (relationType === "supports_focus" && sourceType === "security_technical_service" && targetType === "capability_focus") addMapping(serviceFocusIds, sourceId, targetId);
    if (relationType === "implemented_by_module" && sourceType === "security_technical_service" && targetType === "security_technology_module") addMapping(serviceModuleIds, sourceId, targetId);
    if (relationType === "has_measure" && sourceType === "security_technical_service" && targetType === "security_technical_measure") addMapping(serviceMeasureIds, sourceId, targetId);
  });
  const pushCapabilityRelation = ({ item, focusId, relationType, typeLabel, objectType }) => {
    if (!item || !focusId) return;
    const id = text(item.id || item.code || item.title || item.name).trim();
    const code = text(item.code).trim();
    const title = text(item.title || item.name || code || id).trim();
    if (!id || (!title && !code)) return;
    const trail = trailById.get(focusId) || [];
    rows.push({
      id: `${focusId}:${relationType}:${id}`,
      code,
      title: [code, title].filter(Boolean).join(" "),
      type: "capability",
      typeLabel,
      route: "/capability-mapping",
      subtitle: trail.join(" / "),
      selectedCapabilityId: focusId,
      targetRef: `capability_relation:${relationType}:${focusId}:${id}`,
      targetText: title,
      objectType,
      objectId: id,
      searchText: compactSearchText(code, title, item.description, item.summary, globalSearchBusinessAliasesForCode(code)),
    });
  };
  for (const [serviceId, focusIds] of serviceFocusIds.entries()) {
    const service = entity("security_technical_service", serviceId);
    for (const focusId of focusIds) {
      pushCapabilityRelation({ item: service, focusId, relationType: "security_technical_service", typeLabel: "能力安全技术服务", objectType: "security_technical_service" });
      for (const moduleId of serviceModuleIds.get(serviceId) || []) {
        pushCapabilityRelation({ item: entity("security_technology_module", moduleId), focusId, relationType: "security_technology_module", typeLabel: "能力安全技术模块", objectType: "security_technology_module" });
      }
      for (const measureId of serviceMeasureIds.get(serviceId) || []) {
        pushCapabilityRelation({ item: entity("security_technical_measure", measureId), focusId, relationType: "security_technical_measure", typeLabel: "能力安全技术措施", objectType: "security_technical_measure" });
      }
    }
  }
  return rows;
}

function maintenanceSearchSections() {
  return [
    { key: "scope_types", typeLabel: "作用域", route: "/knowledge/scopes", objectType: "scope_type" },
    { key: "security_technical_services", typeLabel: "安全技术服务", route: "/knowledge/technical-services", objectType: "security_technical_service" },
    { key: "security_technology_modules", typeLabel: "安全技术模块", route: "/knowledge/technical-modules", objectType: "security_technology_module" },
    { key: "security_technical_measures", typeLabel: "安全技术措施", route: "/knowledge/technical-measures", objectType: "security_technical_measure" },
    { key: "security_works", typeLabel: "安全工作", route: "/knowledge/management-workflows", objectType: "security_work" },
    { key: "security_processes", typeLabel: "安全流程", route: "/knowledge/management-workflows", objectType: "security_process" },
    { key: "work_function_layers", typeLabel: "安全职能", route: "/knowledge/functions", objectType: "work_function" },
    {
      key: "gbt_42446_references",
      typeLabel: "GB/T 42446 任务",
      route: "/standards/workforce-reference",
      objectType: "gbt_42446_task_reference",
      standardFramework: "workforce-reference-standards",
      standardTableId: "gbt-42446-classification",
    },
    {
      key: "gartner_roles",
      typeLabel: "Gartner 岗位参考",
      route: "/standards/workforce-reference",
      objectType: "work_role_reference",
      standardFramework: "workforce-reference-standards",
      standardTableId: "gartner-work-roles",
    },
  ];
}

function searchSlug(value, fallback = "item") {
  return (
    text(value)
      .trim()
      .replace(/[^\w\u4e00-\u9fa5-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 72) || fallback
  );
}

function gbtSearchTaskName(title) {
  const value = text(title).trim();
  const parts = value.split(/[-－—]/).map((part) => part.trim()).filter(Boolean);
  return parts.length > 1 ? parts.slice(1).join("-") : value;
}

function workforceReferenceSearchId(section, item, index, title) {
  if (section.key === "gbt_42446_references") {
    const category = text(item?.category).trim();
    const task = gbtSearchTaskName(title);
    return `gbt-42446-classification-${searchSlug(category, "category")}-${searchSlug(task, `task-${index + 1}`)}-${index + 1}`;
  }
  if (section.key === "gartner_roles") {
    const category = text(item?.category).trim();
    return `gartner-work-role-${searchSlug(category, "category")}-${searchSlug(title, `role-${index + 1}`)}-${index + 1}`;
  }
  return text(item.id || item.code || item.title || item.name || `${section.key}:${index}`).trim();
}

function maintenanceSearchTargetRef(objectType = "", id = "") {
  const type = text(objectType).trim();
  const value = text(id).trim();
  if (!type || !value) return "";
  return value.startsWith(`${type}:`) ? value : `${type}:${value}`;
}

function flattenMaintenanceSearchItems(maintenance, lifecycle) {
  const rows = [];
  for (const section of maintenanceSearchSections()) {
    list(maintenance?.[section.key]).forEach((item, index) => {
      const entity = section.key === "security_technical_services" && item?.service ? item.service : item;
      const rawId = text(entity.id || entity.code || entity.title || entity.name || `${section.key}:${index}`).trim();
      const code = text(entity.code || entity.serviceCode || entity.processCode || entity.referenceCode).trim();
      const title = text(entity.title || entity.name || entity.serviceName || entity.processName || entity.description || code || rawId).trim();
      const id = workforceReferenceSearchId(section, entity, index, title);
      const objectType = text(section.objectType).trim();
      if (!title && !code) return;
      rows.push({
        id,
        code,
        title: [code, title].filter(Boolean).join(" "),
        type: "maintenance",
        typeLabel: section.typeLabel,
        route: section.route,
        selectedMaintenanceId: id,
        objectType,
        objectId: id,
        targetRef: maintenanceSearchTargetRef(objectType, id),
        standardFramework: section.standardFramework || "",
        standardTableId: section.standardTableId || "",
        referenceTab: "",
        targetText: title,
        subtitle: compactSearchText(entity.category, item.category, item.layer, item.group, item.capability, item.focus, item.scopes),
        searchText: compactSearchText(code, title, businessSearchAliasesForCode(code), entity.description, entity.definition, entity.summary),
      });
    });
  }
  list(lifecycle?.application_security_development?.application_system_types).forEach((item, index) => {
    const id = text(item.id || item.code || item.title || `application-system:${index}`).trim();
    const code = text(item.code).trim();
    const title = text(item.title || item.name || code || id).trim();
    rows.push({
      id,
      code,
      title: [code, title].filter(Boolean).join(" "),
      type: "maintenance",
      typeLabel: "应用系统目录",
      route: "/knowledge/application-systems",
      selectedMaintenanceId: id,
      targetText: title,
      subtitle: compactSearchText(item.description),
      searchText: compactSearchText(code, title, item.description, item.components),
    });
  });
  return rows;
}

function flattenLifecycleSearchItems(lifecycleWorkbench, lifecycle) {
  const rows = [];
  const addLifecycleObject = (item, route, typeLabel, selectedProcessId = "", index = 0, options = {}) => {
    const id = text(item.id || item.code || item.title || `${typeLabel}:${index}`).trim();
    const code = text(item.code).trim();
    const title = text(item.title || item.name || code || id).trim();
    if (!title && !code) return;
    const targetProcessId = selectedProcessId || (options.useOwnIdAsSelection ? id : "");
    rows.push({
      id,
      code,
      title: [code, title].filter(Boolean).join(" "),
      type: "lifecycle",
      typeLabel,
      route,
      selectedProcessId: targetProcessId,
      targetRef: text(options.targetRef).trim(),
      targetText: text(options.targetText || title).trim(),
      subtitle: compactSearchText(options.subtitle, item.description, item.stage, item.phase, targetProcessId ? "生命周期阶段明细" : ""),
      searchText: compactSearchText(code, title, options.searchText, item.description, item.stage, item.phase, item.objectKind, item.category),
    });
  };
  const addProcess = (item, route, typeLabel, index) => {
    addLifecycleObject(
      {
        ...item,
        description: compactSearchText(
          item.description,
          item.goal,
          ...list(item.main_activities).map((row) => row?.title || row?.name || row?.description),
          ...list(item.security_activities).map((row) => row?.title || row?.name || row?.description),
          ...list(item.technical_services).map((row) => row?.title || row?.name),
          ...list(item.development_technical_services).map((row) => row?.title || row?.name),
          ...list(item.development_technical_modules).map((row) => row?.title || row?.name),
          ...list(item.technology_modules).map((row) => row?.title || row?.name),
          ...list(item.technical_measures).map((row) => row?.title || row?.name),
        ),
      },
      route,
      typeLabel,
      "",
      index,
      { useOwnIdAsSelection: true },
    );
    [
      ["development_technical_services", "开发技术服务"],
      ["development_technical_modules", "开发技术模块"],
      ["technical_services", "安全技术服务"],
      ["technology_modules", "安全技术模块"],
      ["technical_measures", "安全技术措施"],
    ].forEach(([key, label]) => {
      list(item[key]).forEach((child, childIndex) => addLifecycleObject(child, route, label, item.id, childIndex));
    });
    if (route === "/data-security") {
      list(item.data_policy_rows || item.dataPolicyRows).forEach((row, rowIndex) => {
        const rowId = text(row?.id || `data-policy-row:${rowIndex + 1}`).trim();
        const rowTitle = compactSearchText(row?.category, row?.sequence) || "数据重要程度安全策略";
        const rowSubtitle = compactSearchText(typeLabel, item.title || item.name, rowTitle);
        const policyText = compactSearchText(
          ...list(row?.policies).flatMap((policy) => [policy?.level, policy?.label, policy?.code, policy?.text, policy?.reference, policy?.status]),
        );
        const services = list(row?.technical_services || row?.technicalServices);
        const modules = list(row?.module_or_measure_items || row?.moduleOrMeasureItems || row?.technology_modules || row?.technologyModules || row?.technical_measures || row?.technicalMeasures);
        addLifecycleObject(
          {
            id: `${item.id}:data_policy_row:${rowId}`,
            title: rowTitle,
            description: compactSearchText(
              policyText,
              ...services.flatMap((service) => [service?.code, service?.title || service?.name, service?.description, service?.category]),
              ...modules.flatMap((module) => [module?.code, module?.title || module?.name, module?.description, module?.category, module?.objectKind]),
            ),
          },
          route,
          "数据重要程度安全策略矩阵",
          item.id,
          rowIndex,
          {
            targetRef: lifecycleDataPolicyRowTargetRef(item.id, row),
            targetText: rowTitle,
            subtitle: rowSubtitle,
          },
        );
        services.forEach((service, serviceIndex) => {
          addLifecycleObject(
            service,
            route,
            "LC-DT 矩阵安全技术服务",
            item.id,
            serviceIndex,
            {
              targetRef: lifecycleDataPolicyRelationTargetRef(item.id, row, "security_technical_service", service),
              subtitle: rowSubtitle,
            },
          );
        });
        modules.forEach((module, moduleIndex) => {
          const relationType = lifecycleDataPolicyRelationType(module);
          addLifecycleObject(
            module,
            route,
            relationType === "security_technical_measure" ? "LC-DT 矩阵安全技术措施" : "LC-DT 矩阵安全技术模块",
            item.id,
            moduleIndex,
            {
              targetRef: lifecycleDataPolicyRelationTargetRef(item.id, row, relationType, module),
              subtitle: rowSubtitle,
            },
          );
        });
      });
    }
  };
  list(lifecycle?.application_security_development?.processes).forEach((item, index) => addProcess(item, "/development-security", "LC-AP 阶段", index));
  list(lifecycle?.data_lifecycle?.processes).forEach((item, index) => addProcess(item, "/data-security", "LC-DT 过程", index));
  list(lifecycle?.application_security_development?.development_technical_services).forEach((item, index) => addLifecycleObject(item, "/development-security", "开发技术服务", "", index));
  list(lifecycle?.application_security_development?.development_technical_modules).forEach((item, index) => addLifecycleObject(item, "/development-security", "开发技术模块", "", index));
  list(lifecycleWorkbench?.applicationProcesses || lifecycleWorkbench?.application_processes).forEach((item, index) =>
    addLifecycleObject(item, "/development-security", "LC-AP 阶段", "", index, { useOwnIdAsSelection: true }),
  );
  list(lifecycleWorkbench?.dataProcesses || lifecycleWorkbench?.data_processes).forEach((item, index) =>
    addLifecycleObject(item, "/data-security", "LC-DT 过程", "", index, { useOwnIdAsSelection: true }),
  );
  return rows;
}

function flattenContentSearchItems(content) {
  return [
    ...list(content?.html_documents).map((item, index) => ({ item, route: "/guides", typeLabel: "指南内容", fallback: `html:${index}` })),
    ...list(content?.diagram_views).map((item, index) => ({ item, route: "/guides/others", typeLabel: "Draw.io 视图", fallback: `drawio:${index}` })),
    ...list(content?.guide_pages).map((item, index) => ({ item, route: "/guides/others", typeLabel: "PPT 指南", fallback: `ppt:${index}` })),
  ].map(({ item, route, typeLabel, fallback }) => {
    const id = text(item.id || item.code || item.title || fallback).trim();
    const title = text(item.title || item.name || id).trim();
    return {
      id,
      code: text(item.code || item.slide_number || item.page_index).trim(),
      title,
      type: "content",
      typeLabel,
      route,
      selectedContentId: id,
      targetText: title,
      subtitle: compactSearchText(item.category, item.view_type),
      searchText: compactSearchText(title, item.summary, item.description, item.category, item.view_type),
    };
  });
}

function flattenNavigationSearchItems() {
  const components = window.sapdComponents || {};
  const walk = (items = [], parent = "") =>
    list(items).flatMap((item) => [
      {
        id: item.id || item.route,
        code: "",
        title: item.label || item.route,
        type: "navigation",
        typeLabel: "页面",
        route: item.route || "/",
        targetText: item.label || item.route,
        subtitle: parent,
        searchText: compactSearchText(item.label, item.route, parent),
      },
      ...walk(item.children, item.label || parent),
    ]);
  return walk(components.AppShell?.manifest?.navigation || []);
}

function flattenStandardSearchItems(standards) {
  const rows = [];
  list(standards?.frameworks).forEach((framework) => {
    rows.push({
      id: framework.id,
      code: text(framework.frameworkCode || framework.id),
      title: framework.title || framework.id,
      type: "standard",
      typeLabel: "标准 / 框架",
      route: framework.route || `/standards/${framework.id}`,
      standardFramework: framework.id,
      targetText: framework.title || framework.id,
      subtitle: compactSearchText(framework.totalRows ? `${framework.totalRows} 条控制项` : "", framework.frameworkCode),
      searchText: compactSearchText(framework.title, framework.id, framework.frameworkCode),
    });
  });
  Object.entries(standards?.loadedFrameworks || {}).forEach(([frameworkId, framework]) => {
    const frameworkTitle = framework?.title || list(standards?.frameworks).find((item) => item.id === frameworkId)?.title || frameworkId;
    const addRows = (sourceRows, tableTitle = "", tableId = "") => {
      list(sourceRows).forEach((row, index) => {
        const values = row?.values || row;
        const code = text(row?.controlId || row?.controlCode || values?.["Safeguard ID"] || values?.["SCF编号"] || values?.["控制项"] || values?.["控制编号"] || values?.["控制ID"] || values?.["控制项ID"] || values?.["保护措施编号"] || values?.["等保控制项"] || values?.["编号"] || row?.code).trim();
        const title = text(row?.title || values?.["SCF控制项"] || values?.["保障措施描述"] || values?.["名称"] || values?.["控制项名称"] || values?.["安全控制项名称"] || values?.["等保三级控制要求"] || values?.["描述"] || values?.["保障措施域"] || values?.["SCF域"] || code || `control:${index}`).trim();
        const id = text(row?.id || [frameworkId, tableTitle, code || index].filter(Boolean).join(":")).trim();
        if (!title && !code) return;
        rows.push({
          id,
          code,
          title: [code, title].filter(Boolean).join(" "),
          type: "standard-control",
          typeLabel: "标准控制项",
          route: framework.route || `/standards/${frameworkId}`,
          standardFramework: frameworkId,
          standardTableId: tableId || frameworkId,
          selectedMaintenanceId: id,
          targetText: title, targetRef: `standard_control:${frameworkId}:${tableId || frameworkId}:${id}`, objectType: "standard_control", objectId: id,
          subtitle: [frameworkTitle, tableTitle].filter(Boolean).join(" / "),
          searchText: compactSearchText(code, title, Object.values(values || {})),
        });
      });
    };
    addRows(framework?.rows, "");
    list(framework?.tabs).forEach((tab) => addRows(tab.rows, tab.title || tab.id, tab.id || ""));
  });
  return rows;
}

function flattenEnvironmentSearchItems(environmentWorkbench) {
  const rows = [];
  const pushObject = (item, typeLabel, subtitle = "", context = {}) => {
    const id = text(item?.id || item?.code || item?.title || item?.name).trim();
    const code = text(item?.code).trim();
    const title = text(item?.title || item?.name || code || id).trim();
    if (!id && !title && !code) return;
    rows.push({
      id,
      code,
      title: [code, title].filter(Boolean).join(" "),
      type: "environment",
      typeLabel,
      route: "/environment-mapping",
      selectedEnvironmentId: typeLabel === "信息化环境" ? id : text(context.environment?.id).trim(),
      selectedEnvironmentSegmentId: typeLabel === "环境子类" ? id : text(context.segment?.id).trim(),
      selectedEnvironmentObjectId: typeLabel === "信息化对象" ? id : "",
      targetText: title,
      subtitle,
      searchText: compactSearchText(code, title, item?.description, subtitle),
    });
  };
  const pushRelation = (item, typeLabel, relationType, context = {}) => {
    if (!item || !context.object) return;
    const objectId = text(context.object.id || context.object.code || context.object.title || context.object.name).trim();
    const itemId = text(item.id || item.code || item.title || item.name || typeLabel).trim();
    const title = text(item.title || item.name || item.code || itemId).trim();
    if (!objectId || !itemId || !title) return;
    const code = text(item.code).trim();
    const locationContext = compactSearchText(context.environment?.title || context.environment?.name, context.object?.segments, context.object?.title || context.object?.name, context.scope);
    const serviceContext = compactSearchText(context.service?.title || context.service?.name);
    const subtitle = compactSearchText(locationContext, serviceContext);
    rows.push({
      id: `${objectId}:${relationType}:${itemId}`,
      code,
      title: [code, title].filter(Boolean).join(" "),
      type: "environment",
      typeLabel,
      route: "/environment-mapping",
      selectedEnvironmentId: text(context.environment?.id).trim(),
      selectedEnvironmentSegmentId: text(list(context.object?.segments)[0]?.id).trim(),
      selectedEnvironmentObjectId: objectId,
      targetRef: `${relationType}:${objectId}:${itemId}`,
      targetText: title,
      subtitle,
      searchText: compactSearchText(code, title, businessSearchAliasesForCode(code), item.description, item.category),
    });
  };
  const pushSystems = (systems, context = {}) => {
    list(systems).forEach((system) => pushRelation(system, "安全系统", "security_system", context));
  };
  list(environmentWorkbench?.environments).forEach((environment) => {
    pushObject(environment, "信息化环境");
    list(environment.segments).forEach((segment) => {
      pushObject(segment, "环境子类", text(environment.title || environment.name), { environment });
      list(segment.objects).forEach((object) => pushObject(object, "信息化对象", [environment.title || environment.name, segment.title || segment.name].filter(Boolean).join(" / "), { environment, segment }));
    });
  });
  list(environmentWorkbench?.mappingRows || environmentWorkbench?.rows).forEach((row) => {
    pushObject(row.information_object || row.object, "信息化对象", compactSearchText(row.environment, row.segments));
  });
  list(environmentWorkbench?.environment_scope_tree).forEach((environment) => {
    list(environment?.objects).forEach((object) => {
      list(object?.scope_mappings).forEach((mapping) => {
        const scope = mapping?.scope || {};
        list(mapping?.services).forEach((service) => {
          const serviceContext = { environment, object, scope, service };
          pushRelation(service, "环境安全技术服务", "security_technical_service", { environment, object, scope });
          list(service?.modules).forEach((module) => {
            pushRelation(module, "环境安全技术模块", "security_technology_module", serviceContext);
            pushSystems([...list(module?.securitySystems), ...list(module?.systems), ...list(module?.linkedSystems)], serviceContext);
          });
          list(service?.measures).forEach((measure) => {
            pushRelation(measure, "环境安全技术措施", "security_technical_measure", serviceContext);
            pushSystems([...list(measure?.securitySystems), ...list(measure?.systems), ...list(measure?.linkedSystems)], serviceContext);
          });
          list(service?.relationNodes).forEach((node) => {
            const isMeasure = text(node?.relationKind || node?.kind || node?.objectKind || node?.title).includes("measure") || text(node?.relationKind || node?.kind || node?.objectKind || node?.title).includes("措施");
            pushRelation(node, isMeasure ? "环境安全技术措施" : "环境安全技术模块", isMeasure ? "security_technical_measure" : "security_technology_module", serviceContext);
            pushSystems([...list(node?.securitySystems), ...list(node?.systems), ...list(node?.linkedSystems)], serviceContext);
          });
          pushSystems([...list(service?.securitySystems), ...list(service?.systems), ...list(service?.linkedSystems)], serviceContext);
        });
      });
    });
  });
  return rows;
}

async function ensureGlobalSearchPackages() {
  // P0 缓解：不再在全局搜索输入时做全量业务包预加载。
  // 全局搜索改为优先命中已加载数据，避免绕过路由懒加载契约导致 1-2 秒以上卡顿。
  return Promise.resolve();
}

async function ensureGlobalSearchStandardDetails() {
  // P0 缓解：暂不在全局搜索里预加载标准详情表。
  // 如需标准控制级检索，请先通过标准索引或目标页打开对应标准并完成 OI-150+。
  if (state.globalSearchStandardsReady) return;
  state.globalSearchStandardsReady = true;
  return Promise.resolve();
}

function buildGlobalSearchResults(query, limit = GLOBAL_SEARCH_RESULT_LIMIT) {
  const q = normalizeSearchText(query);
  if (q.length < GLOBAL_SEARCH_MIN_QUERY_LENGTH) return [];
  const resultMap = new Map();
  [
    ...flattenNavigationSearchItems(),
    ...flattenCapabilitySearchItems(state.capability, state.capabilityWorkbench),
    ...flattenMaintenanceSearchItems(state.maintenanceKnowledge, state.lifecycle),
    ...flattenLifecycleSearchItems(state.lifecycleWorkbench, state.lifecycle),
    ...flattenContentSearchItems(state.content),
    ...flattenStandardSearchItems(state.standards),
    ...flattenEnvironmentSearchItems(state.environmentWorkbench),
  ].forEach((result) => {
    const match = globalSearchMatchDetails(result, q);
    if (match.score > 0) addGlobalSearchResult(resultMap, { ...result, score: match.score, matchKind: match.matchKind });
  });
  return [...resultMap.values()]
    .sort((left, right) => right.score - left.score || text(left.typeLabel).localeCompare(text(right.typeLabel), "zh-Hans-CN") || text(left.title).localeCompare(text(right.title), "zh-Hans-CN"))
    .slice(0, limit);
}

function normalizeGlobalSearchIndexResult(result = {}) {
  const displayResult = sanitizeGlobalSearchResult(result);
  const route = text(result.route).trim();
  const objectType = text(result.object_type || result.objectType).trim();
  const objectId = text(result.object_id || result.objectId || result.id).trim();
  const targetRef = text(result.target_ref || result.targetRef).trim();
  const normalized = {
    ...displayResult,
    key: text(result.key || [result.type, route, targetRef || objectId, displayResult.title].filter(Boolean).join("::")).trim(),
    route,
    targetRef,
    targetText: displayResult.targetText,
    matchContext: displayResult.matchContext,
    typeLabel: text(result.typeLabel || result.type_label || "结果").trim(),
    score: Number(result.score) || 0,
    matchKind: text(result.match_kind || result.matchKind).trim(),
  };
  if (route === "/capability-mapping") {
    normalized.selectedCapabilityId = text(result.selectedCapabilityId || result.selected_capability_id).trim();
    if (!normalized.selectedCapabilityId && objectId) normalized.selectedCapabilityId = objectId;
  }
  if (route === "/environment-mapping") {
    normalized.selectedEnvironmentId = text(result.selectedEnvironmentId || result.selected_environment_id).trim();
    normalized.selectedEnvironmentSegmentId = text(result.selectedEnvironmentSegmentId || result.selected_environment_segment_id).trim();
    normalized.selectedEnvironmentObjectId = text(result.selectedEnvironmentObjectId || result.selected_environment_object_id).trim();
    if (objectId) {
      if (objectType === "information_environment") normalized.selectedEnvironmentId = normalized.selectedEnvironmentId || objectId;
      if (objectType === "environment_segment") normalized.selectedEnvironmentSegmentId = normalized.selectedEnvironmentSegmentId || objectId;
      if (objectType === "information_object") normalized.selectedEnvironmentObjectId = normalized.selectedEnvironmentObjectId || objectId;
    }
    const parentSelection = environmentSelectionForObjectId(normalized.selectedEnvironmentObjectId);
    if (parentSelection) {
      normalized.selectedEnvironmentId = normalized.selectedEnvironmentId || parentSelection.environmentId;
      normalized.selectedEnvironmentSegmentId = normalized.selectedEnvironmentSegmentId || parentSelection.segmentId;
      normalized.selectedEnvironmentObjectId = normalized.selectedEnvironmentObjectId || parentSelection.objectId;
    }
  }
  if (route.startsWith("/knowledge/") && objectId) normalized.selectedMaintenanceId = objectId;
  if (route === "/knowledge/gbt-42446") normalized.referenceTab = "gbt";
  if (route === "/knowledge/role-references") normalized.referenceTab = "gartner";
  if (route === "/standards/workforce-reference") {
    normalized.standardFramework = "workforce-reference-standards";
    if (objectId) normalized.selectedMaintenanceId = objectId;
    if (["gbt_42446_task_reference", "gbt_42446_task_definition"].includes(objectType)) normalized.standardTableId = "gbt-42446-classification";
    if (objectType === "work_role_reference") normalized.standardTableId = "gartner-work-roles";
  }
  if (route.startsWith("/standards/")) {
    normalized.standardFramework = text(result.standardFramework || result.standard_framework || normalized.standardFramework).trim();
    normalized.standardTableId = text(result.standardTableId || result.standard_table_id || normalized.standardTableId).trim();
    if (objectType === "standard_control" && objectId) normalized.selectedMaintenanceId = objectId;
  }
  if ((route === "/development-security" || route === "/data-security") && objectId) normalized.selectedProcessId = objectId;
  if (route.startsWith("/guides/") && objectId) normalized.selectedContentId = objectId;
  if (objectType === "standard_framework" && objectId) normalized.standardFramework = objectId;
  if (targetRef.startsWith("standard_table:")) {
    const [, frameworkId, tableId] = targetRef.split(":");
    if (frameworkId) normalized.standardFramework = frameworkId;
    if (tableId) normalized.standardTableId = tableId;
  }
  if (targetRef.startsWith("standard_control:")) {
    const [, frameworkId, tableId] = targetRef.split(":");
    if (frameworkId) normalized.standardFramework = frameworkId;
    if (tableId) normalized.standardTableId = tableId;
    if (objectId) normalized.selectedMaintenanceId = objectId;
  }
  return normalized;
}

function searchIndexPayloadFromEnvelope(envelope) {
  const firstLayer = envelope && typeof envelope === "object" ? envelope : {};
  const secondLayer = firstLayer.data && typeof firstLayer.data === "object" ? firstLayer.data : firstLayer;
  if (secondLayer?.data && typeof secondLayer.data === "object" && (Array.isArray(secondLayer.data.results) || secondLayer.data.data_state)) {
    return secondLayer.data;
  }
  return secondLayer;
}

function globalSearchFiniteNumber(value, fallback = 0) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : fallback;
}

function globalSearchCategoryCountsFromResults(results = []) {
  const counts = new Map([["全部", list(results).length]]);
  list(results).forEach((result) => {
    const category = globalSearchResultCategory(result);
    counts.set(category, (counts.get(category) || 0) + 1);
  });
  return counts;
}

function globalSearchStatsFromResults(results = [], limit = GLOBAL_SEARCH_RESULT_LIMIT) {
  const counts = globalSearchCategoryCountsFromResults(results);
  const order = ["全部", "安全能力", "信息化环境", "生命周期", "知识库", "标准 / 框架", "指南", "工作台", "其他"];
  return {
    total: list(results).length,
    returned: list(results).length,
    limit,
    offset: 0,
    truncated: false,
    categories: order
      .filter((label) => label === "全部" || counts.has(label))
      .map((label) => ({ label, count: counts.get(label) || 0 })),
  };
}

function normalizeGlobalSearchStats(payload = {}, results = [], limit = GLOBAL_SEARCH_RESULT_LIMIT) {
  const facets = payload?.facets && typeof payload.facets === "object" ? payload.facets : {};
  const stats = payload?.stats && typeof payload.stats === "object" ? payload.stats : {};
  const total = globalSearchFiniteNumber(facets.total ?? stats.matched, list(results).length);
  const returned = globalSearchFiniteNumber(facets.returned ?? stats.returned, list(results).length);
  const effectiveLimit = globalSearchFiniteNumber(facets.limit ?? stats.limit, limit);
  const offset = globalSearchFiniteNumber(facets.offset ?? stats.offset ?? payload?.offset, 0);
  const rawCategories = list(facets.categories);
  const categories = rawCategories.length
    ? rawCategories
        .map((row) => ({
          label: text(row?.label).trim(),
          count: globalSearchFiniteNumber(row?.count, 0),
        }))
        .filter((row) => row.label)
    : globalSearchStatsFromResults(results, effectiveLimit).categories;
  if (!categories.some((row) => row.label === "全部")) categories.unshift({ label: "全部", count: total });
  return {
    total,
    returned,
    limit: effectiveLimit,
    offset,
    truncated: Boolean(facets.truncated ?? stats.truncated ?? total > returned),
    categories,
  };
}

async function searchIndexPayloadForQuery(query, limit = GLOBAL_SEARCH_RESULT_LIMIT, options = {}) {
  const normalizedQuery = text(query).trim();
  if (normalizedQuery.length < GLOBAL_SEARCH_MIN_QUERY_LENGTH) return { results: [], stats: globalSearchStatsFromResults([], limit), dataState: "empty" };
  const offset = Number.isFinite(Number(options.offset)) ? Math.max(0, Math.trunc(Number(options.offset))) : 0;
  const category = text(options.category).trim();
  const cacheKey = `${normalizedQuery}::${limit}::${offset}::${category}`;
  if (globalSearchIndexQueryCache.has(cacheKey)) return globalSearchIndexQueryCache.get(cacheKey);
  const dataClient = window.sapdDataClient;
  const envelope = await dataClient?.getSearchIndex?.({ q: normalizedQuery, limit, offset, category });
  const payload = searchIndexPayloadFromEnvelope(envelope);
  const rows = list(payload?.results).map(normalizeGlobalSearchIndexResult).filter((result) => result.route);
  const normalizedPayload = {
    results: rows,
    stats: normalizeGlobalSearchStats(payload, rows, limit),
    dataState: text(payload?.data_state || payload?.dataState).trim(),
  };
  if (payload?.data_state === "ready" || rows.length) {
    globalSearchIndexQueryCache.set(cacheKey, normalizedPayload);
    return normalizedPayload;
  }
  return { results: [], stats: globalSearchStatsFromResults([], limit), dataState: "empty" };
}

async function searchIndexResultsForQuery(query) {
  const payload = await searchIndexPayloadForQuery(query, GLOBAL_SEARCH_RESULT_LIMIT);
  return payload.results;
}

function mergeGlobalSearchResults(primary = [], secondary = [], query = "", limit = GLOBAL_SEARCH_RESULT_LIMIT) {
  const resultMap = new Map();
  [...primary, ...secondary].forEach((result) => addGlobalSearchResult(resultMap, result));
  return pruneGlobalSearchResultsForQuery([...resultMap.values()], query)
    .sort((left, right) => (Number(right.score) || 0) - (Number(left.score) || 0) || text(left.typeLabel).localeCompare(text(right.typeLabel), "zh-Hans-CN") || text(left.title).localeCompare(text(right.title), "zh-Hans-CN"))
    .slice(0, limit);
}

function renderGlobalSearchPanel() {
  let panel = document.getElementById("globalSearchPanel");
  const root = document.querySelector(".global-search");
  if (!root) return;
  if (!panel) {
    document.body.insertAdjacentHTML("beforeend", '<div id="globalSearchPanel" class="global-search-panel" hidden></div>');
    panel = document.getElementById("globalSearchPanel");
  } else if (panel.parentElement !== document.body) {
    document.body.appendChild(panel);
  }
  const query = text(state.globalSearch).trim();
  const shouldShow = state.globalSearchOpen && query.length >= GLOBAL_SEARCH_MIN_QUERY_LENGTH;
  panel.hidden = !shouldShow;
  if (!shouldShow) {
    panel.innerHTML = "";
    return;
  }
  const rect = root.getBoundingClientRect();
  panel.style.left = `${Math.round(rect.left)}px`;
  panel.style.top = `${Math.round(rect.bottom + 8)}px`;
  panel.style.width = `${Math.round(rect.width)}px`;
  if (state.globalSearchLoading) {
    panel.innerHTML = '<div class="global-search-state">正在搜索...</div>';
    return;
  }
  if (!state.globalSearchResults.length) {
    panel.innerHTML = '<div class="global-search-state">未找到匹配结果</div>';
    return;
  }
  panel.innerHTML = `
    <div class="global-search-result-list" role="listbox" aria-label="全局搜索结果">
      ${state.globalSearchResults
        .map(
          (result, index) => {
            const metaLine = globalSearchResultMetaLine(result);
            const snippet = globalSearchResultSnippetLabel(result, query);
            return `
            <button class="global-search-result" type="button" role="option" data-global-search-result="${index}">
              <span class="global-search-result-type">${escapeHtml(result.typeLabel || "结果")}</span>
              <span class="global-search-result-main">
                <strong>${escapeHtml(result.title || "未命名结果")}</strong>
                ${metaLine ? `<small>${escapeHtml(metaLine)}</small>` : ""}
                <em>${highlightSearchText(snippet, query)}</em>
              </span>
            </button>
          `;
          },
        )
        .join("")}
    </div>
    <div class="global-search-panel-footer">
      <button class="global-search-view-all" type="button" data-global-search-view-all>
        查看全部搜索结果
      </button>
    </div>
  `;
}

async function runGlobalSearch() {
  const options = arguments[0] || {};
  const renderPanel = options.panel !== false;
  const requestSeq = ++state.globalSearchRequestSeq;
  const query = text(state.globalSearch).trim();
  state.globalSearchOpen = renderPanel && Boolean(query);
  if (query.length < GLOBAL_SEARCH_MIN_QUERY_LENGTH) {
    state.globalSearchLoading = false;
    state.globalSearchResults = [];
    state.globalSearchResultStats = globalSearchStatsFromResults([], renderPanel ? GLOBAL_SEARCH_RESULT_LIMIT : GLOBAL_SEARCH_PAGE_RESULT_LIMIT);
    state.globalSearchLoadedQuery = query;
    if (renderPanel) renderGlobalSearchPanel();
    if (!renderPanel && state.activeView === "search") renderSearchPage();
    return;
  }
  state.globalSearchLoading = true;
  state.globalSearchResultStats = null;
  if (renderPanel) renderGlobalSearchPanel();
  await ensureGlobalSearchPackages();
  await ensureGlobalSearchStandardDetails();
  const resultLimit = renderPanel ? GLOBAL_SEARCH_RESULT_LIMIT : GLOBAL_SEARCH_PAGE_RESULT_LIMIT;
  const indexedPayload = await searchIndexPayloadForQuery(query, resultLimit);
  const indexedResults = indexedPayload.results;
  if (requestSeq !== state.globalSearchRequestSeq) return;
  state.globalSearchResults = mergeGlobalSearchResults(indexedResults, buildGlobalSearchResults(query, resultLimit), query, resultLimit);
  state.globalSearchResultStats = indexedPayload.dataState === "ready" || indexedResults.length
    ? indexedPayload.stats
    : globalSearchStatsFromResults(state.globalSearchResults, resultLimit);
  state.globalSearchLoading = false;
  state.globalSearchLoadedQuery = query;
  rememberCommittedSearchQuery("global", query);
  if (renderPanel) renderGlobalSearchPanel();
  if (!renderPanel && state.activeView === "search") renderSearchPage();
}

function resetGlobalSearchPageResults() {
  state.globalSearchPageLoading = false;
  state.globalSearchPageResults = [];
  state.globalSearchPageResultStats = null;
  state.globalSearchPageLoadedQuery = "";
  state.globalSearchPageLoadedFilter = "全部";
  state.globalSearchPageLoadedIndex = 0;
  state.globalSearchPageSelectedKey = "";
}

function globalSearchPageWindowMatches(query = state.globalSearch, filter = state.globalSearchPageFilter, pageIndex = state.globalSearchPageIndex) {
  return (
    text(state.globalSearchPageLoadedQuery).trim() === text(query).trim() &&
    text(state.globalSearchPageLoadedFilter || "全部").trim() === (text(filter).trim() || "全部") &&
    Number(state.globalSearchPageLoadedIndex) === Number(pageIndex)
  );
}

function fallbackGlobalSearchPagePayload(query = "", limit = GLOBAL_SEARCH_PAGE_SIZE, offset = 0, category = "") {
  const fallbackLimit = Math.max(GLOBAL_SEARCH_PAGE_RESULT_LIMIT, offset + limit);
  const allResults = mergeGlobalSearchResults([], buildGlobalSearchResults(query, fallbackLimit), query, fallbackLimit);
  const filteredResults = category && category !== "全部" ? allResults.filter((result) => globalSearchResultCategory(result) === category) : allResults;
  const pageResults = filteredResults.slice(offset, offset + limit);
  return {
    results: pageResults,
    stats: globalSearchStatsFromResults(allResults, fallbackLimit),
    dataState: allResults.length ? "fallback" : "empty",
  };
}

async function runGlobalSearchPage() {
  const query = text(state.globalSearch).trim();
  const filter = text(state.globalSearchPageFilter || "全部").trim() || "全部";
  const pageIndex = clampGlobalSearchPageIndex(state.globalSearchPageIndex, Math.max(1, Math.ceil((globalSearchCategoryCount(state.globalSearchPageResultStats, filter, 0) || GLOBAL_SEARCH_PAGE_SIZE) / GLOBAL_SEARCH_PAGE_SIZE)));
  const requestSeq = ++state.globalSearchPageRequestSeq;
  const offset = (pageIndex - 1) * GLOBAL_SEARCH_PAGE_SIZE;
  if (query.length < GLOBAL_SEARCH_MIN_QUERY_LENGTH) {
    resetGlobalSearchPageResults();
    state.globalSearchPageLoadedQuery = query;
    if (state.activeView === "search") renderSearchPage();
    return;
  }
  state.globalSearchPageLoading = true;
  if (state.activeView === "search") renderSearchPage();
  await ensureGlobalSearchPackages();
  await ensureGlobalSearchStandardDetails();
  const category = filter === "全部" ? "" : filter;
  const indexedPayload = await searchIndexPayloadForQuery(query, GLOBAL_SEARCH_PAGE_SIZE, { offset, category });
  const useIndexedResults = indexedPayload.dataState === "ready" || indexedPayload.results.length;
  const pagePayload = useIndexedResults
    ? indexedPayload
    : fallbackGlobalSearchPagePayload(query, GLOBAL_SEARCH_PAGE_SIZE, offset, category);
  if (requestSeq !== state.globalSearchPageRequestSeq) return;
  state.globalSearchPageResults = list(pagePayload.results);
  state.globalSearchPageResultStats = pagePayload.stats || globalSearchStatsFromResults(state.globalSearchPageResults, GLOBAL_SEARCH_PAGE_SIZE);
  state.globalSearchPageLoading = false;
  state.globalSearchPageLoadedQuery = query;
  state.globalSearchPageLoadedFilter = filter;
  state.globalSearchPageLoadedIndex = pageIndex;
  state.globalSearchPageIndex = pageIndex;
  rememberCommittedSearchQuery("global", query);
  if (state.activeView === "search") renderSearchPage();
}

function clearGlobalSearchPanel({ keepQuery = false } = {}) {
  state.globalSearchOpen = false;
  state.globalSearchLoading = false;
  state.globalSearchResults = [];
  if (!keepQuery) state.globalSearch = "";
  syncSearchInputs();
  renderGlobalSearchPanel();
}

function findElementByDataAttr(attributeName, value) {
  const expected = text(value).trim();
  if (!expected) return null;
  return Array.from(document.querySelectorAll(`[${attributeName}]`)).find((node) => text(node.getAttribute(attributeName)).trim() === expected) || null;
}

function activeGlobalSearchRootElement() {
  return activeSearchRootElement();
}

function activeSearchRootElement() {
  const workspaceMap = {
    overview: "overviewWorkspace",
    search: "searchWorkspace",
    capabilities: "capabilityWorkspace",
    environment: "environmentWorkspace",
    "dev-lifecycle": "devLifecycleWorkspace",
    "data-lifecycle": "dataLifecycleWorkspace",
    maintenance: "maintenanceWorkspace",
    workbench: "workbenchWorkspace",
    content: "contentWorkspace",
    placeholder: "placeholderWorkspace",
  };
  return $(workspaceMap[state.activeView]) || document.querySelector(".app-main") || document.body;
}

function globalSearchTargetTexts(result = {}) {
  const values = [
    result.targetText,
    result.title,
    result.code,
    result.subtitle,
  ]
    .map((value) => cleanGlobalSearchDisplayText(value))
    .filter(Boolean);
  return [...new Set(values.flatMap((value) => [value, value.replace(/^\S+\s+/, "").trim()].filter(Boolean)))];
}

function nodeBusinessText(node) {
  if (!node) return "";
  return text(
      node.getAttribute?.("data-copy-text") ||
      node.getAttribute?.("data-annotation-tooltip") ||
      node.getAttribute?.("data-standard-row-text") ||
      node.getAttribute?.("title") ||
      node.getAttribute?.("aria-label") ||
      node.textContent,
  ).trim();
}

function isSearchChromeNode(node) {
  return Boolean(node?.closest?.("#globalSearchPanel, .global-search, .topbar, .page-local-search-toolbar, .page-search-control, .capability-workbench-tools, .source-catalog-tools, .lifecycle-stage-search, [data-annotation-drawer], [data-annotation-context-menu]"));
}

function isVisibleSearchTarget(node) {
  if (!node || node.hidden || isSearchChromeNode(node)) return false;
  const rect = node.getBoundingClientRect?.();
  return Boolean(rect && rect.width > 0 && rect.height > 0);
}

function searchTargetCandidates(root) {
  if (!root) return [];
  const selectors = [
    "[data-copy-text]",
    '[data-annotation-value="true"]',
    "[data-annotation-target-ref]",
    "[data-maintenance-id]",
    "[data-capability-id]",
    "[data-environment-id]",
    "[data-environment-segment-id]",
    "[data-environment-object-id]",
    "[data-content-id]",
    "[data-standard-group]",
    "[data-standard-row-text]",
    "[data-standard-detail-key]",
    ".relation-chip",
    ".standard-tooltip-chip",
    ".standard-framework-name",
    ".management-chip",
    ".taxonomy-chip",
    ".catalog-row",
    ".tree-row",
    ".lifecycle-nav-row",
    ".source-nav-button",
    ".relationship-table td",
    ".relationship-table th",
    ".maintenance-table td",
    ".maintenance-table th",
    ".standard-framework-table td",
    ".standard-framework-table th",
    ".review-table td",
    ".review-table th",
    "td",
    "th",
    "tr",
    "button",
    "h1",
    "h2",
    "h3",
    "h4",
    "p",
    "li",
  ];
  return Array.from(root.querySelectorAll(selectors.join(","))).filter(isVisibleSearchTarget);
}

function textTargetElement(targetTexts = [], root = activeSearchRootElement()) {
  if (!root || !targetTexts.length) return null;
  const candidates = searchTargetCandidates(root);
  for (const targetText of targetTexts) {
    const exact = candidates.find((node) => nodeBusinessText(node) === targetText);
    if (exact) return exact;
  }
  for (const targetText of targetTexts) {
    const normalized = targetText.toLowerCase();
    const fuzzy = candidates.find((node) => {
      const value = nodeBusinessText(node).toLowerCase();
      return value && normalized && (value.includes(normalized) || normalized.includes(value));
    });
    if (fuzzy) return fuzzy;
  }
  return null;
}

function globalSearchTextTargetElement(result = {}) {
  return textTargetElement(globalSearchTargetTexts(result), activeGlobalSearchRootElement());
}

function dedupeNestedSearchTargets(nodes = []) {
  const unique = [];
  list(nodes).forEach((node) => {
    if (!node) return;
    const nested = unique.some((existing) => existing === node || existing.contains(node) || node.contains(existing));
    if (!nested) unique.push(node);
  });
  return unique;
}

function pageSearchTargetElements(query = "", root = activeSearchRootElement()) {
  const searchText = text(query).trim();
  if (!searchText || !root) return [];
  const targetAliases = searchQueryAliasesForText(searchText);
  const targets = [searchText, ...targetAliases, searchText.replace(/^\S+\s+/, "").trim(), ...targetAliases.map((value) => value.replace(/^\S+\s+/, "").trim())].filter(Boolean);
  const normalizedTargets = [...new Set(targets.map((value) => value.toLowerCase()).filter(Boolean))];
  if (!normalizedTargets.length) return [];
  const candidates = searchTargetCandidates(root);
  const matches = candidates.filter((node) => {
    const value = nodeBusinessText(node).toLowerCase();
    if (!value) return false;
    return normalizedTargets.some((target) => value.includes(target) || target.includes(value));
  });
  return dedupeNestedSearchTargets(matches);
}

function pageSearchTextTargetElement(query = "") {
  return pageSearchTargetElements(query)[0] || null;
}

function clearPageSearchHighlights() {
  document.querySelectorAll(".page-search-target-highlight, .page-search-current-match, .page-search-current-container").forEach((node) => {
    node.classList.remove("page-search-target-highlight", "page-search-current-match", "page-search-current-container");
    node.removeAttribute("data-page-search-current");
    node.removeAttribute("data-page-search-context");
  });
}

function pageSearchContextTarget(target) {
  return (
    target?.closest?.(
      [
        ".tree-row",
        ".environment-tree-row",
        ".lifecycle-nav-row",
        "[data-lifecycle-kind][data-lifecycle-id]",
        "[data-capability-id]",
        "[data-environment-id]",
        "[data-environment-segment-id]",
        "[data-environment-object-id]",
        "[data-environment-row-id]",
        "[data-maintenance-id]",
        "[data-search-page-result]",
        "tr",
      ].join(", "),
    ) || null
  );
}

function pageSearchHighlightTargets(target) {
  return [...new Set([target, pageSearchContextTarget(target)].filter(Boolean))];
}

function markPageSearchTarget(target) {
  if (!target) return;
  target.classList.add("page-search-current-match");
  target.setAttribute("data-page-search-current", "true");
  const context = pageSearchContextTarget(target);
  if (context && context !== target) {
    context.classList.add("page-search-current-container");
    context.setAttribute("data-page-search-context", "true");
  }
}

function expandSearchTargetLineage(target) {
  let node = target?.parentElement || null;
  while (node && node !== document.body) {
    if (node.tagName === "DETAILS") node.open = true;
    node = node.parentElement;
  }
  expandAnnotationHiddenLineage(target);
}

function scrollSearchTargetIntoView(target, attempt = 0) {
  if (!target?.scrollIntoView) return;
  const behavior = attempt ? "auto" : "smooth";
  target.scrollIntoView({ block: "center", inline: "nearest", behavior });
  requestAnimationFrame(() => {
    const targetRect = target.getBoundingClientRect?.();
    if (!targetRect) return;
    let node = target.parentElement;
    while (node && node !== document.body) {
      const style = window.getComputedStyle(node);
      const canScrollY = /(auto|scroll)/.test(style.overflowY) && node.scrollHeight > node.clientHeight + 2;
      const canScrollX = /(auto|scroll)/.test(style.overflowX) && node.scrollWidth > node.clientWidth + 2;
      if (canScrollY || canScrollX) {
        const rect = node.getBoundingClientRect();
        if (canScrollY && (targetRect.top < rect.top + 24 || targetRect.bottom > rect.bottom - 24)) {
          node.scrollTop += targetRect.top - rect.top - Math.max(24, (node.clientHeight - targetRect.height) / 2);
        }
        if (canScrollX && (targetRect.left < rect.left + 24 || targetRect.right > rect.right - 24)) {
          node.scrollLeft += targetRect.left - rect.left - Math.max(24, (node.clientWidth - targetRect.width) / 2);
        }
      }
      node = node.parentElement;
    }
  });
}

function updatePageSearchControls() {
  const currentScope = searchScopeForCurrentState();
  const nav = state.pageSearchNavigation || {};
  document.querySelectorAll("[data-page-search-status]").forEach((node) => {
    const scope = text(node.dataset.pageSearchStatus).trim() || currentScope;
    const query = pageSearchQueryForScope(scope);
    const matchSet = pageSearchMatchSet(scope, query);
    const isActive = scope === nav.scope && query && query === nav.query;
    const count = matchSet ? matchSet.matches.length : isActive ? Number(nav.count) || 0 : 0;
    const rawIndex = isActive && count ? Number(nav.index) || 0 : 0;
    const index = count ? Math.max(0, Math.min(count - 1, rawIndex)) : 0;
    node.textContent = query ? `${count ? index + 1 : 0}/${count}` : "";
  });
  document.querySelectorAll("[data-page-search-step]").forEach((button) => {
    const scope = text(button.dataset.pageSearchScope).trim() || currentScope;
    const query = pageSearchQueryForScope(scope);
    const matchSet = pageSearchMatchSet(scope, query);
    const isActive = scope === nav.scope && query && query === nav.query;
    const count = matchSet ? matchSet.matches.length : isActive ? Number(nav.count) || 0 : 0;
    button.disabled = !query || count < 2;
  });
}

function revealPageSearchTarget(pending = state.pendingPageSearchReveal, attempt = 0) {
  if (!pending?.query) return false;
  if (pending.scope && pending.scope !== searchScopeForCurrentState()) return false;
  const targets = pageSearchTargetElements(pending.query);
  const count = targets.length;
  const requestedIndex = Number.isFinite(Number(pending.index)) ? Number(pending.index) : Number(state.pageSearchNavigation?.index) || 0;
  const activeIndex = count ? ((requestedIndex % count) + count) % count : 0;
  const displayCount = Number.isFinite(Number(pending.displayCount)) ? Number(pending.displayCount) : count;
  const displayIndex = Number.isFinite(Number(pending.displayIndex)) ? Number(pending.displayIndex) : activeIndex;
  state.pageSearchNavigation = {
    scope: pending.scope || searchScopeForCurrentState(),
    query: pending.query,
    index: displayIndex,
    count: displayCount,
  };
  updatePageSearchControls();
  let target = null;
  if (pending.targetAttribute === "data-lifecycle-id" && pending.targetId) {
    const kind = pending.scope === "data-security" ? "data" : "dev";
    const safeTargetId = window.CSS?.escape ? window.CSS.escape(pending.targetId) : text(pending.targetId).replace(/["\\]/g, "\\$&");
    const contentRoot = kind === "data" ? $("dataLifecycleMatrix") : $("devLifecycleLane");
    const selector = `[data-lifecycle-kind="${kind}"][data-lifecycle-id="${safeTargetId}"] .lifecycle-search-mark`;
    const marks = Array.from((contentRoot || document).querySelectorAll(selector)).filter(isVisibleSearchTarget);
    const markIndex = Number.isFinite(Number(pending.lifecycleOccurrenceIndex)) ? Number(pending.lifecycleOccurrenceIndex) : activeIndex;
    target = marks[Math.max(0, Math.min(marks.length - 1, markIndex))] || null;
  }
  if (!target && pending.targetAttribute && pending.targetId) {
    const preferredTarget = findElementByDataAttr(pending.targetAttribute, pending.targetId);
    if (preferredTarget && isVisibleSearchTarget(preferredTarget)) target = preferredTarget;
  }
  target = target || targets[activeIndex] || null;
  if (target) {
    expandSearchTargetLineage(target);
    target.hidden = false;
    clearPageSearchHighlights();
    scrollSearchTargetIntoView(target, attempt);
    markPageSearchTarget(target);
    target.classList.add("page-search-target-highlight");
    window.setTimeout(() => target.classList.remove("page-search-target-highlight"), 2600);
    state.pendingPageSearchReveal = null;
    return true;
  }
  if (attempt >= 10) {
    state.pendingPageSearchReveal = null;
    return false;
  }
  window.setTimeout(() => revealPageSearchTarget(pending, attempt + 1), attempt < 4 ? 80 : 180);
  return false;
}

function flushPageSearchReveal() {
  const pending = state.pendingPageSearchReveal;
  if (!pending?.query) {
    updatePageSearchControls();
    return;
  }
  requestAnimationFrame(() => revealPageSearchTarget(pending));
}

function movePageSearchMatch(delta = 1, scope = searchScopeForCurrentState()) {
  const query = pageSearchQueryForScope(scope);
  if (!query) return;
  if (scope === "development-security" || scope === "data-security") {
    moveLifecyclePageSearchMatch(scope === "data-security" ? "data" : "dev", delta, query);
    return;
  }
  if (scope === "capability-mapping" && moveCapabilityPageSearchMatch(delta, query)) return;
  if (scope === "environment-mapping" && moveEnvironmentPageSearchMatch(delta, query)) return;
  const targets = pageSearchTargetElements(query);
  const count = targets.length;
  const nav = state.pageSearchNavigation || {};
  const currentIndex = nav.scope === scope && nav.query === query ? Number(nav.index) || 0 : 0;
  const nextIndex = count ? ((currentIndex + delta) % count + count) % count : 0;
  state.pendingPageSearchReveal = { scope, query, index: nextIndex };
  revealPageSearchTarget(state.pendingPageSearchReveal, 1);
}

function lifecycleSearchRowsForKind(kind = "dev") {
  const safeKind = kind === "data" ? "data" : "dev";
  return Array.from(document.querySelectorAll(`[data-lifecycle-kind="${safeKind}"][data-lifecycle-id]`));
}

function lifecycleSearchScopeForKind(kind = "dev") {
  return kind === "data" ? "data-security" : "development-security";
}

function searchQueryOccurrenceCount(value = "", query = "") {
  const source = text(value).toLowerCase();
  const needle = text(query).trim().toLowerCase();
  if (!source || !needle) return 0;
  let count = 0;
  let cursor = 0;
  while (cursor < source.length) {
    const index = source.indexOf(needle, cursor);
    if (index < 0) break;
    count += 1;
    cursor = index + Math.max(needle.length, 1);
  }
  return count;
}

function lifecycleSearchOccurrenceSources(row = {}) {
  const values = [row.code, row.title, row.description, row.goal, row.order];
  const originalFields = row.originalBusinessFields && typeof row.originalBusinessFields === "object" ? Object.values(row.originalBusinessFields) : [];
  values.push(...originalFields);
  [
    "mainActivities",
    "securityActivities",
    "policyRequirements",
    "developmentTypes",
    "developmentServices",
    "developmentModules",
    "technicalServices",
    "technologyModules",
    "technicalMeasures",
    "scenes",
  ].forEach((key) => {
    list(row[key]).forEach((item) => {
      if (item && typeof item === "object") {
        values.push(item.code, item.title, item.name, item.description, item.category, item.objectKind, item.value, item.requirement);
        list(item.modules).forEach((module) => values.push(module?.code, module?.title, module?.name, module?.description, module?.objectKind));
      } else {
        values.push(item);
      }
    });
  });
  return values.map(text).filter(Boolean);
}

function lifecycleItemSearchValues(item = {}) {
  if (!item || typeof item !== "object") return [item];
  return [
    item.code,
    item.title,
    item.name,
    item.description,
    item.category,
    item.objectKind,
    item.object_kind,
    item.value,
    item.requirement,
    item.level,
    item.label,
    item.text,
    item.reference,
    item.status,
  ];
}

function lifecycleDataPolicyRowTargetRef(stageId = "", row = {}) {
  const ownerId = text(stageId).trim();
  const rowId = text(row.id).trim();
  return ownerId && rowId ? `lifecycle_policy_row:${ownerId}:${rowId}` : "";
}

function lifecycleDataPolicyRelationType(item = {}, fallback = "security_technology_module") {
  const type = text(item.type).trim();
  if (type) return type;
  const objectKind = text(item.objectKind || item.object_kind).trim();
  return objectKind.includes("措施") ? "security_technical_measure" : fallback;
}

function lifecycleDataPolicyRelationTargetRef(stageId = "", row = {}, relationType = "", item = {}) {
  const ownerId = text(stageId).trim();
  const rowId = text(row.id).trim();
  const objectId = text(item.id || item.code || item.title || item.name).trim();
  return ownerId && rowId && relationType && objectId ? `lifecycle_policy_relation:${relationType}:${ownerId}:${rowId}:${objectId}` : "";
}

function lifecycleDataPolicyOccurrenceMatches(stage = {}, query = "") {
  const stageId = text(stage.id).trim();
  const stageTitle = [stage.code, stage.title].filter(Boolean).join(" ");
  const matches = [];
  const pushMatches = (count, targetRef, title) => {
    const normalizedCount = Math.max(0, Number(count) || 0);
    if (!normalizedCount || !targetRef) return;
    for (let index = 0; index < normalizedCount; index += 1) {
      matches.push({
        id: `${stageId || "stage"}::${targetRef}::${matches.length}`,
        stageId,
        occurrenceIndex: 0,
        targetRef,
        title: title || stageTitle,
      });
    }
  };
  list(stage.dataPolicyRows).forEach((row) => {
    const rowTargetRef = lifecycleDataPolicyRowTargetRef(stageId, row);
    const rowLabel = [stageTitle, row.category, row.sequence].filter(Boolean).join(" / ");
    const rowValueCount = [row.category, row.sequence].reduce((total, value) => total + searchQueryOccurrenceCount(value, query), 0);
    pushMatches(rowValueCount, rowTargetRef, rowLabel);
    list(row.policies).forEach((policy) => {
      const count = lifecycleItemSearchValues(policy).reduce((total, value) => total + searchQueryOccurrenceCount(value, query), 0);
      pushMatches(count, rowTargetRef, [rowLabel, policy.code || policy.label].filter(Boolean).join(" / "));
    });
    list(row.technicalServices).forEach((service) => {
      const targetRef = lifecycleDataPolicyRelationTargetRef(stageId, row, "security_technical_service", service);
      const count = lifecycleItemSearchValues(service).reduce((total, value) => total + searchQueryOccurrenceCount(value, query), 0);
      pushMatches(count, targetRef, [rowLabel, service.code, service.title || service.name].filter(Boolean).join(" / "));
    });
    list(row.technologyModules).forEach((item) => {
      const relationType = lifecycleDataPolicyRelationType(item);
      const targetRef = lifecycleDataPolicyRelationTargetRef(stageId, row, relationType, item);
      const count = lifecycleItemSearchValues(item).reduce((total, value) => total + searchQueryOccurrenceCount(value, query), 0);
      pushMatches(count, targetRef, [rowLabel, item.code, item.title || item.name].filter(Boolean).join(" / "));
    });
  });
  return matches;
}

function lifecycleOccurrenceMatches(matchedStages = [], query = "") {
  const normalizedQuery = text(query).trim();
  if (!normalizedQuery) return [];
  return list(matchedStages).flatMap((row) => {
    const targetedMatches = lifecycleDataPolicyOccurrenceMatches(row, normalizedQuery);
    const sources = lifecycleSearchOccurrenceSources(row);
    let count = sources.reduce((total, value) => total + searchQueryOccurrenceCount(value, normalizedQuery), 0);
    if (!count && !targetedMatches.length) count = searchQueryOccurrenceCount(row.searchText, normalizedQuery);
    if (!count && targetedMatches.length) return targetedMatches;
    if (!count) count = 1;
    const genericMatches = Array.from({ length: count }, (_, occurrenceIndex) => ({
      id: `${row.id || "stage"}::${occurrenceIndex}`,
      stageId: row.id,
      occurrenceIndex,
      title: [row.code, row.title].filter(Boolean).join(" "),
    }));
    return [...genericMatches, ...targetedMatches];
  });
}

function updateLifecyclePageSearchNavigation(kind = "dev", matchedStages = [], query = "") {
  const scope = lifecycleSearchScopeForKind(kind);
  const normalizedQuery = text(query).trim();
  if (!normalizedQuery) {
    clearPageSearchMatchSet(scope);
    if (state.pageSearchNavigation?.scope === scope) state.pageSearchNavigation = { scope, query: "", index: 0, count: 0 };
    updatePageSearchControls();
    return;
  }
  const rows = lifecycleOccurrenceMatches(matchedStages, normalizedQuery);
  const selectedId = kind === "data" ? state.selectedDataProcessId : state.selectedDevProcessId;
  const nav = state.pageSearchNavigation || {};
  const previousIndex = nav.scope === scope && nav.query === normalizedQuery ? Number(nav.index) || 0 : 0;
  const previousMatch = rows[Math.max(0, Math.min(rows.length - 1, previousIndex))];
  const activeMatch = previousMatch?.stageId === selectedId ? previousMatch : rows.find((row) => row.stageId === selectedId) || rows[0] || null;
  setPageSearchMatchSet(scope, normalizedQuery, rows, activeMatch?.id || "");
  if (activeMatch && state.pendingPageSearchReveal?.scope === scope && state.pendingPageSearchReveal?.query === normalizedQuery) {
    state.pendingPageSearchReveal.targetAttribute = activeMatch.targetRef ? "data-lifecycle-target-ref" : "data-lifecycle-id";
    state.pendingPageSearchReveal.targetId = activeMatch.targetRef || activeMatch.stageId;
    state.pendingPageSearchReveal.lifecycleOccurrenceIndex = activeMatch.occurrenceIndex;
    state.pendingPageSearchReveal.displayIndex = rows.findIndex((row) => row.id === activeMatch.id);
    state.pendingPageSearchReveal.displayCount = rows.length;
  }
  updatePageSearchControls();
}

function moveLifecyclePageSearchMatch(kind = "dev", delta = 1, query = "") {
  const scope = lifecycleSearchScopeForKind(kind);
  const matchSet = pageSearchMatchSet(scope, query);
  const rows = matchSet?.matches || [];
  const count = rows.length;
  if (!count) {
    state.pageSearchNavigation = { scope, query, index: 0, count: 0 };
    updatePageSearchControls();
    return;
  }
  const selectedId = kind === "data" ? state.selectedDataProcessId : state.selectedDevProcessId;
  const nav = state.pageSearchNavigation || {};
  const selectedIndex = Math.max(0, rows.findIndex((row) => text(row.stageId || row.id).trim() === text(selectedId).trim()));
  const currentIndex = nav.scope === scope && nav.query === text(query).trim() ? Number(nav.index) || selectedIndex : selectedIndex;
  const nextIndex = ((currentIndex + delta) % count + count) % count;
  const nextMatch = rows[nextIndex] || {};
  const nextId = text(nextMatch.stageId || nextMatch.id).trim();
  if (kind === "data") state.selectedDataProcessId = nextId;
  else state.selectedDevProcessId = nextId;
  state.pageSearchNavigation = { scope, query, index: nextIndex, count };
  state.pendingPageSearchReveal = {
    scope,
    query,
    index: 0,
    targetAttribute: nextMatch.targetRef ? "data-lifecycle-target-ref" : "data-lifecycle-id",
    targetId: nextMatch.targetRef || nextId,
    lifecycleOccurrenceIndex: Number(nextMatch.occurrenceIndex) || 0,
    displayIndex: nextIndex,
    displayCount: count,
  };
  renderLifecycle(kind);
  flushPageSearchReveal();
}

function globalSearchResultMetaLine(result = {}) {
  const category = globalSearchResultCategory(result);
  const parts = [globalSearchRouteLabel(result.route), result.typeLabel && result.typeLabel !== category ? result.typeLabel : "", result.subtitle]
    .map((value) => text(value).trim())
    .filter(Boolean);
  return [...new Set(parts)].join(" · ");
}

function globalSearchResultSnippetLabel(result = {}, query = "") {
  const snippet = globalSearchResultSnippet(result, query);
  return snippet ? `命中：${snippet}` : "该结果来自全局轻量索引，可打开目标页查看完整上下文。";
}

function highlightSearchText(value = "", query = "") {
  const source = text(value);
  const needle = text(query).trim();
  if (!source || !needle) return escapeHtml(source);
  const lowerSource = source.toLowerCase();
  const lowerNeedle = needle.toLowerCase();
  let cursor = 0;
  let output = "";
  while (cursor < source.length) {
    const nextIndex = lowerSource.indexOf(lowerNeedle, cursor);
    if (nextIndex < 0) {
      output += escapeHtml(source.slice(cursor));
      break;
    }
    output += escapeHtml(source.slice(cursor, nextIndex));
    output += `<mark class="global-search-snippet-mark">${escapeHtml(source.slice(nextIndex, nextIndex + needle.length))}</mark>`;
    cursor = nextIndex + needle.length;
  }
  return output || escapeHtml(source);
}

function searchSelectorStringValue(value = "") {
  return text(value).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function findLifecycleSearchTargetByRef(targetRef = "", root = document) {
  const normalizedTargetRef = text(targetRef).trim();
  if (!normalizedTargetRef || !root?.querySelector) return null;
  return root.querySelector(`[data-lifecycle-target-ref="${searchSelectorStringValue(normalizedTargetRef)}"]`);
}

function lifecycleSearchValueTargetElement(result = {}, kind = "dev") {
  const processId = text(result.selectedProcessId).trim();
  const targetRef = text(result.targetRef || result.target_ref).trim();
  if (targetRef) {
    const targetByRef = findLifecycleSearchTargetByRef(targetRef, kind === "data" ? $("dataLifecycleMatrix") || document : $("devLifecycleLane") || document);
    if (targetByRef) return targetByRef;
  }
  const targetText = text(result.targetText || result.title).trim();
  if (!processId || !targetText) return null;
  const safeProcessId = window.CSS?.escape ? window.CSS.escape(processId) : processId.replace(/["\\]/g, "\\$&");
  const selector = `[data-lifecycle-kind="${kind}"][data-lifecycle-id="${safeProcessId}"] [data-copy-text]`;
  const candidates = Array.from(document.querySelectorAll(selector));
  const exact = candidates.find((node) => text(node.getAttribute("data-copy-text")).trim() === targetText);
  if (exact) return exact;
  const normalized = targetText.toLowerCase();
  return candidates.find((node) => text(node.getAttribute("data-copy-text")).toLowerCase().includes(normalized)) || null;
}

function selectorStringValue(value = "") {
  return searchSelectorStringValue(value);
}

function capabilityRelationTargetRef(result = {}) {
  return text(result.targetRef || result.target_ref).trim();
}

function parseCapabilityRelationTargetRef(result = {}) {
  const targetRef = capabilityRelationTargetRef(result);
  if (!targetRef.startsWith("capability_relation:")) return null;
  const [, relationType = "", focusId = "", ...objectParts] = targetRef.split(":");
  const objectId = objectParts.join(":");
  if (!relationType || !focusId || !objectId) return null;
  return { targetRef, relationType, focusId, objectId };
}

function capabilityRelationTabForSearchResult(result = {}) {
  const parsed = parseCapabilityRelationTargetRef(result);
  if (!parsed) return "";
  if (["security_technical_service", "security_technology_module", "security_technical_measure"].includes(parsed.relationType)) return "technical";
  return "";
}

function capabilitySearchValueTargetElement(result = {}) {
  const root = $("capabilityWorkspace") || document;
  const parsed = parseCapabilityRelationTargetRef(result);
  if (parsed?.targetRef) {
    const target = root.querySelector(`[data-capability-relation-target-ref="${selectorStringValue(parsed.targetRef)}"]`);
    if (target) return target;
  }
  if (parsed?.objectId) {
    const objectTarget = root.querySelector(
      `[data-capability-relation-type="${selectorStringValue(parsed.relationType)}"][data-capability-relation-object-id="${selectorStringValue(parsed.objectId)}"]`,
    );
    if (objectTarget) return objectTarget;
  }
  const targetText = text(result.targetText || result.title).trim();
  if (!targetText) return null;
  const candidates = Array.from(root.querySelectorAll("[data-copy-text]"));
  const exact = candidates.find((node) => text(node.getAttribute("data-copy-text")).trim() === targetText);
  if (exact) return exact;
  const normalized = targetText.toLowerCase();
  return candidates.find((node) => text(node.getAttribute("data-copy-text")).toLowerCase().includes(normalized)) || null;
}

function environmentSearchValueTargetElement(result = {}) {
  const targetText = text(result.targetText || result.title).trim();
  if (!targetText) return null;
  const root = $("environmentDetail") || document;
  const candidates = Array.from(root.querySelectorAll("[data-copy-text]"));
  const exact = candidates.find((node) => text(node.getAttribute("data-copy-text")).trim() === targetText);
  if (exact) return exact;
  const normalized = targetText.toLowerCase();
  return candidates.find((node) => text(node.getAttribute("data-copy-text")).toLowerCase().includes(normalized)) || null;
}

function standardSearchTargetElement(result = {}) {
  const targetRef = text(result.targetRef || result.target_ref).trim();
  const rowId = standardSearchRowId(result, targetRef);
  const rowCode = text(result.code || result.targetText || result.target_text || "").trim();
  const selectors = [targetRef && ["data-standard-target-ref", targetRef], rowId && ["data-standard-row-id", rowId], rowId && ["data-maintenance-id", rowId], rowCode && ["data-standard-row-code", rowCode]].filter(Boolean);
  for (const [attributeName, value] of selectors) {
    const target = findElementByDataAttr(attributeName, value);
    if (target) return target;
  }
  return null;
}

function standardSearchRowId(result = {}, targetRef = text(result.targetRef || result.target_ref).trim()) {
  return text(result.selectedMaintenanceId || result.objectId || result.object_id || (targetRef.startsWith("standard_control:") ? targetRef.split(":").slice(3).join(":") : "")).trim();
}

function globalSearchPageRevealOptions(result = {}) {
  const targetRef = text(result.targetRef || result.target_ref).trim();
  if (!targetRef.startsWith("standard_control:")) return {};
  const rowId = standardSearchRowId(result, targetRef);
  return rowId ? { targetAttribute: "data-standard-row-id", targetId: rowId } : { targetAttribute: "data-standard-target-ref", targetId: targetRef };
}

function globalSearchTargetElement(result = {}) {
  if (text(result.targetRef || result.target_ref).trim().startsWith("standard_control:")) {
    const target = standardSearchTargetElement(result);
    if (target) return target;
  }
  if (result.selectedCapabilityId) {
    if (/^capability_relation:/.test(text(result.targetRef || result.target_ref))) {
      const valueTarget = capabilitySearchValueTargetElement(result);
      if (valueTarget) return valueTarget;
    }
    const target = findElementByDataAttr("data-capability-id", result.selectedCapabilityId);
    if (target) return target;
  }
  if (result.selectedMaintenanceId) {
    const target = findElementByDataAttr("data-maintenance-id", result.selectedMaintenanceId);
    if (target) return target;
  }
  if (result.selectedProcessId) {
    const kind = result.route === "/data-security" ? "data" : "dev";
    const valueTarget = lifecycleSearchValueTargetElement(result, kind);
    if (valueTarget) return valueTarget;
    const target = Array.from(document.querySelectorAll(`[data-lifecycle-kind="${kind}"][data-lifecycle-id]`)).find((node) => text(node.dataset.lifecycleId).trim() === text(result.selectedProcessId).trim()) || null;
    if (target) return target;
  }
  if (result.selectedEnvironmentObjectId) {
    const valueTarget = environmentSearchValueTargetElement(result);
    if (valueTarget) return valueTarget;
    const target = findElementByDataAttr("data-environment-object-id", result.selectedEnvironmentObjectId);
    if (target) return target;
  }
  if (result.selectedEnvironmentSegmentId) {
    const target = findElementByDataAttr("data-environment-segment-id", result.selectedEnvironmentSegmentId);
    if (target) return target;
  }
  if (result.selectedEnvironmentId) {
    const target = findElementByDataAttr("data-environment-id", result.selectedEnvironmentId);
    if (target) return target;
  }
  if (result.selectedContentId) {
    const target = findElementByDataAttr("data-content-id", result.selectedContentId);
    if (target) return target;
  }
  return globalSearchTextTargetElement(result);
}

function revealGlobalSearchTarget(result, attempt = 0) {
  const target = globalSearchTargetElement(result);
  if (target) {
    expandSearchTargetLineage(target);
    target.hidden = false;
    target.scrollIntoView({ block: "center", inline: "nearest", behavior: attempt ? "auto" : "smooth" });
    target.classList.add("global-search-target-highlight");
    window.setTimeout(() => target.classList.remove("global-search-target-highlight"), 2200);
    return true;
  }
  if (attempt >= 14) return false;
  window.setTimeout(() => revealGlobalSearchTarget(result, attempt + 1), attempt < 4 ? 120 : 260);
  return false;
}

function revealEnvironmentCatalogSelection(result = {}, attempt = 0) {
  const root = $("environmentTree");
  if (!root) {
    if (attempt < 14) window.setTimeout(() => revealEnvironmentCatalogSelection(result, attempt + 1), attempt < 4 ? 120 : 260);
    return false;
  }
  const candidates = [
    ["data-environment-object-id", result.selectedEnvironmentObjectId || result.selected_environment_object_id],
    ["data-environment-segment-id", result.selectedEnvironmentSegmentId || result.selected_environment_segment_id],
    ["data-environment-id", result.selectedEnvironmentId || result.selected_environment_id],
  ];
  for (const [attributeName, value] of candidates) {
    const expected = text(value).trim();
    if (!expected) continue;
    const target = Array.from(root.querySelectorAll(`[${attributeName}]`)).find((node) => text(node.getAttribute(attributeName)).trim() === expected);
    if (target) {
      target.scrollIntoView({ block: "center", inline: "nearest", behavior: attempt ? "auto" : "smooth" });
      target.classList.add("global-search-target-highlight");
      window.setTimeout(() => target.classList.remove("global-search-target-highlight"), 2200);
      return true;
    }
  }
  if (attempt >= 14) return false;
  window.setTimeout(() => revealEnvironmentCatalogSelection(result, attempt + 1), attempt < 4 ? 120 : 260);
  return false;
}

function expandCapabilityAncestors(targetId) {
  if (!targetId) return;
  const path = [];
  const visit = (item, ancestors = []) => {
    if (!item) return false;
    if (item.id === targetId) {
      path.push(...ancestors);
      return true;
    }
    const children = [...list(item.domains), ...list(item.capabilities), ...list(item.focuses)];
    return children.some((child) => visit(child, [...ancestors, item.id].filter(Boolean)));
  };
  list(state.capability?.categories).some((category) => visit(category, []));
  path.forEach((id) => state.expandedCapabilityIds.add(id));
}

function activateGlobalSearchResult(result) {
  if (!result?.route) return;
  const activationQuery = searchTextForActivatedResult(result);
  clearGlobalSearchPanel({ keepQuery: true });
  activateRoute(result.route);
  if (result.standardFramework) state.activeStandardFramework = result.standardFramework;
  if (result.standardTableId) state.activeStandardTableId = result.standardTableId;
  if (result.referenceTab) state.activeReferenceTab = result.referenceTab;
  clearDestinationSearchForGlobalActivation(result.route);
  if (activationQuery && routeHasPageSearch(result.route)) {
    queuePageSearchReveal(activationQuery, searchScopeForCurrentState(), globalSearchPageRevealOptions(result));
  }
  if (result.selectedCapabilityId) {
    state.selectedCapabilityId = result.selectedCapabilityId;
    expandCapabilityAncestors(result.selectedCapabilityId);
    ensureCapabilityWorkspaceViewForSelection(result.selectedCapabilityId);
    const capabilityRelationTab = capabilityRelationTabForSearchResult(result);
    if (capabilityRelationTab) {
      state.activeCapabilityRelationTab = capabilityRelationTab;
      state.lastCapabilityRelationSelectionId = result.selectedCapabilityId;
    }
    renderCapabilities();
  }
  if (result.selectedMaintenanceId) {
    state.selectedMaintenanceId = result.selectedMaintenanceId;
    renderMaintenance();
  }
  if (result.selectedProcessId && result.route === "/development-security") {
    state.selectedDevProcessId = result.selectedProcessId;
    if (activationQuery) {
      queuePageSearchReveal(activationQuery, "development-security");
    }
    renderLifecycle("dev");
  }
  if (result.selectedProcessId && result.route === "/data-security") {
    state.selectedDataProcessId = result.selectedProcessId;
    if (activationQuery) {
      queuePageSearchReveal(activationQuery, "data-security");
    }
    renderLifecycle("data");
  }
  if (result.selectedContentId) {
    state.selectedContentId = result.selectedContentId;
    renderContent();
  }
  if (result.selectedEnvironmentId || result.selectedEnvironmentSegmentId || result.selectedEnvironmentObjectId) {
    const parentSelection = environmentSelectionForObjectId(result.selectedEnvironmentObjectId);
    state.activeEnvironmentTab = "mapping";
    state.environmentCatalogCollapsed = false;
    state.selectedEnvironmentId = result.selectedEnvironmentId || parentSelection?.environmentId || null;
    state.selectedEnvironmentSegmentId = result.selectedEnvironmentSegmentId || parentSelection?.segmentId || null;
    state.selectedEnvironmentObjectId = result.selectedEnvironmentObjectId || parentSelection?.objectId || null;
    if (state.selectedEnvironmentId) state.expandedEnvironmentIds.add(state.selectedEnvironmentId);
    if (state.selectedEnvironmentSegmentId) state.expandedEnvironmentIds.add(state.selectedEnvironmentSegmentId);
    renderEnvironment();
    revealEnvironmentCatalogSelection(result);
  }
  persistWorkspaceState();
  revealGlobalSearchTarget(result);
  flushPageSearchReveal();
}

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

window.sapdDisplay = window.sapdDisplay || {};
window.sapdDisplay.annotationTargetAttrs = annotationTargetAttrsForHtml;

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
  const variants = [normalized, ...searchQueryAliasesForText(query).map((value) => value.toLowerCase())].filter(Boolean);
  const haystack = values.map(text).join(" ").toLowerCase();
  return variants.some((variant) => haystack.includes(variant));
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
  state.activeEnvironmentTab = snapshot.activeEnvironmentTab === "mapping" ? "mapping" : "topology";
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
      scheduleCapabilityRenderAfterPackageLoad(name);
    });
  state.packageLoads.set(name, load);
  return load;
}

function scheduleCapabilityRenderAfterPackageLoad(name) {
  if (state.activeView !== "capabilities") return;
  const capabilityPackageNames = new Set([
    "capability",
    "capabilityInitial",
    "capabilityWorkbench",
    "capabilityProjection",
    "maintenanceIndex",
    "maintenanceKnowledge",
    "sharedLookups",
    "standards",
  ]);
  if (!capabilityPackageNames.has(name) && !String(name || "").startsWith("capability")) return;
  const schedule = window.requestAnimationFrame || ((callback) => window.setTimeout(callback, 0));
  schedule(() => {
    if (state.activeView === "capabilities") renderCapabilities();
  });
}

function routePackagesForCurrentState() {
  if (state.activeView === "placeholder") return [];
  if (state.activeView === "workbench") return [];
  if (state.activeView === "search") return [];
  if (state.activeView === "overview") return ["analyticsSummary"];
  if (state.activeView === "capabilities") return ["capabilityInitial", "maintenanceIndex"];
  if (state.activeView === "environment") {
    return ["environmentWorkbench"];
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
  return capabilityObjectViewHasFocus(state.capabilityProjection, focusId) || capabilityObjectViewHasFocus(state.capabilityWorkspaceView, focusId);
}

function capabilityObjectViewHasFocus(projection, focusId) {
  if (!projection || !focusId) return false;
  const maps = projection.localRelationMapsByFocusId || projection.local_relation_maps_by_focus_id || {};
  if (maps[focusId]) return true;
  const item = capabilityItemById(focusId);
  if (!item || item.type !== "capability_focus") return false;
  const localMap = projection.localRelationMap || projection.local_relation_map || null;
  return capabilityProjectionMatchesSelection(projection, item) && Boolean(localMap || projection.graph);
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

function capabilityLoadFailureMessage(error) {
  return error?.message || String(error || "请求结束但没有返回可用的能力对象投影。");
}

function capabilityLoadFailure(loadKey) {
  const result = state.capabilityProjectionLoadResults.get(loadKey);
  if (!result || result.status === "ready") return null;
  return result;
}

function markCapabilityLoadResult(loadKey, result = null) {
  if (!loadKey) return;
  if (!result || result.status === "ready") {
    state.capabilityProjectionLoadResults.delete(loadKey);
    return;
  }
  state.capabilityProjectionLoadResults.set(loadKey, {
    ...result,
    at: Date.now(),
  });
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
        markCapabilityLoadResult(loadKey, {
          status: "mismatch",
          title: "加载失败：当前关注点关系数据",
          message: "返回的关系投影与当前选择不一致，已停止加载态。已回退到已有视图数据，可重试加载当前关注点。",
        });
      } else {
        mergeCapabilityProjection(projection);
        markCapabilityLoadResult(loadKey, { status: "ready" });
      }
      if (state.activeView === "capabilities" && state.selectedCapabilityId === focusId) renderCapabilities();
    })
    .catch((error) => {
      console.warn("关注点关系投影加载失败", error);
      markCapabilityLoadResult(loadKey, {
        status: "error",
        title: "加载失败：当前关注点关系数据",
        message: `${capabilityLoadFailureMessage(error)} 已停止加载态。已回退到已有视图数据，可重试加载当前关注点。`,
      });
    })
    .finally(() => {
      state.packageLoads.delete(loadKey);
      state.capabilityProjectionRequests.delete(loadKey);
      scheduleCapabilityRenderAfterPackageLoad(loadKey);
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
        markCapabilityLoadResult(loadKey, {
          status: "mismatch",
          title: "加载失败：当前能力对象关系数据",
          message: "返回的能力对象视图与当前选择不一致，已停止加载态。已回退到已有视图数据，可重试加载当前对象。",
        });
      } else {
        state.capabilityWorkspaceView = view;
        markCapabilityLoadResult(loadKey, { status: "ready" });
      }
      if (state.activeView === "capabilities" && state.selectedCapabilityId === item.id) renderCapabilities();
    })
    .catch((error) => {
      console.warn("能力对象工作区视图加载失败", error);
      markCapabilityLoadResult(loadKey, {
        status: "error",
        title: "加载失败：当前能力对象关系数据",
        message: `${capabilityLoadFailureMessage(error)} 已停止加载态。已回退到已有视图数据，可重试加载当前对象。`,
      });
    })
    .finally(() => {
      state.packageLoads.delete(loadKey);
      state.capabilityProjectionRequests.delete(loadKey);
      scheduleCapabilityRenderAfterPackageLoad(loadKey);
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
const ANNOTATION_JUMP_MAX_ATTEMPTS = 12;
const ANNOTATION_JUMP_RETRY_DELAY_MS = 120;
const ANNOTATION_JUMP_TIMEOUT_MS = 1800;
const ANNOTATION_JUMP_MARKER_REFRESH_LIMIT = 1;
const ANNOTATION_MARKER_TEXT_FALLBACK_TIMEOUT_MS = 120;
const ANNOTATION_MARKER_MAX_TEXT_FALLBACKS = 40;

const ANNOTATION_CONTEXT_SELECTOR = [
  ANNOTATION_VALUE_SELECTOR,
  ANNOTATION_TARGET_REF_SELECTOR,
  ANNOTATION_CELL_VALUE_SELECTOR,
  "tr",
  "[data-capability-id]",
  "[data-maintenance-id]",
].join(", ");

function annotationPerfNow() {
  return Number(globalThis.performance?.now?.()) || Date.now();
}

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

function annotationLeadingCodeVariant(value = "") {
  const raw = text(value).trim();
  const match = raw.match(/^([A-Za-z0-9][A-Za-z0-9&._:-]*[.-][A-Za-z0-9&._:-]+)(?:\s+|$)/);
  return match?.[1] || "";
}

function annotationTextCoreVariants(value = "") {
  const raw = text(value).trim();
  if (!raw) return [];
  return [
    raw,
    raw.replace(/^[\s\-*•·]+/u, "").trim(),
    raw.replace(/^\(?[A-Za-z]\)?[).）、]\s*/u, "").trim(),
    raw.replace(/^\d+(?:\.\d+)*['’′]?[).）、]\s*/u, "").trim(),
  ].filter(Boolean);
}

function annotationBusinessTextVariants(value = "") {
  const raw = text(value).trim();
  if (!raw) return [];
  const values = [raw];
  raw
    .split(/[｜|]/)
    .map((item) => item.trim())
    .filter(Boolean)
    .forEach((item) => values.push(item));
  const prefixes = ["选中值", "表格行", "标准控制项", "安全技术服务", "安全技术模块", "安全技术措施", "能力", "关注点", "页面"];
  const suffixes = ["持续管理流程组", "持续管理流程", "管理流程组", "流程组", "流程"];
  for (const item of [...values]) {
    prefixes.forEach((prefix) => {
      if (item.startsWith(prefix)) values.push(item.slice(prefix.length).trim());
    });
    suffixes.forEach((suffix) => {
      if (item.endsWith(suffix)) values.push(item.slice(0, -suffix.length).trim());
    });
  }
  return uniqueAnnotationTextVariants(values.flatMap((item) => annotationTextCoreVariants(item)));
}

function noteLookupTextVariants(note = {}) {
  const objectTitle = text(note.object_title).trim();
  const body = text(note.body).trim();
  const values = annotationBusinessTextVariants(objectTitle);
  values.push(
    objectTitle
      .replace(/^(选中值|表格行|标准控制项|安全技术服务|安全技术模块|安全技术措施|能力|关注点|页面)\s*/u, "")
      .trim(),
  );
  if (body && body.length <= 80) values.push(body);
  if (body && body.length <= 80) annotationTextCoreVariants(body).forEach((item) => values.push(item));
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
  const anchorType = normalizedAnnotationAnchorType(note.anchor_type || annotationAnchorTypeFromTargetRef(note.target_ref));
  if (anchorType === "field" && node.matches?.("tr, .standard-group-row")) return 0;
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

function pushAnnotationIndexEntry(bucket, key, entry) {
  const normalizedKey = text(key).trim();
  if (!normalizedKey || !entry?.node) return;
  const rows = bucket.get(normalizedKey) || [];
  rows.push(entry);
  bucket.set(normalizedKey, rows);
}

function pushAnnotationTextIndexEntry(bucket, node) {
  if (!node) return;
  for (const value of annotationElementLookupTexts(node)) {
    const compact = compactAnnotationLookupText(value);
    if (!compact) continue;
    pushAnnotationIndexEntry(bucket, compact, { node });
  }
}

function annotationTargetRefAliasesForNode(node) {
  const dataset = node?.dataset || {};
  const objectType = text(dataset.annotationObjectType).trim();
  const baseValues = [
    dataset.annotationTargetRef,
    dataset.annotationObjectId,
    dataset.annotationObjectCode,
    dataset.annotationTitle,
    dataset.annotationTooltip,
    node?.getAttribute?.("title"),
  ]
    .map((value) => text(value).trim())
    .filter(Boolean);
  const valueSeen = new Set();
  const values = [...baseValues, ...baseValues.map(annotationLeadingCodeVariant)]
    .map((value) => text(value).trim())
    .filter((value) => value && !valueSeen.has(value) && valueSeen.add(value));
  const aliases = new Set();
  text(dataset.annotationTargetRef).trim() && aliases.add(text(dataset.annotationTargetRef).trim());
  if (objectType) {
    values.forEach((value) => {
      aliases.add(`base:${objectType}:${value}`);
    });
  }
  values.forEach((value) => {
    aliases.add(`base:field_value:${fieldAnnotationId(value, node)}`);
  });
  return [...aliases].filter(Boolean);
}

function createAnnotationAnchorIndex({ includeHidden = false } = {}) {
  const index = {
    refs: new Map(),
    texts: new Map(),
    candidatesByKind: {
      target: [],
      value: [],
      cell: [],
      capability: [],
      maintenance: [],
      row: [],
    },
  };
  const usable = (node) => {
    if (!node || node.closest?.("[data-annotation-drawer], [data-annotation-context-menu]")) return false;
    return includeHidden || isAnnotationAnchorVisible(node);
  };
  const addRef = (targetRef, node, anchorType = "") => {
    if (!usable(node)) return;
    pushAnnotationIndexEntry(index.refs, targetRef, { node, anchorType });
    pushAnnotationTextIndexEntry(index.texts, node);
  };
  document.querySelectorAll(ANNOTATION_TARGET_REF_SELECTOR).forEach((node) => {
    if (!usable(node)) return;
    annotationTargetRefAliasesForNode(node).forEach((targetRef) => {
      addRef(targetRef, node, node.dataset.annotationAnchorType || "object");
    });
    index.candidatesByKind.target.push(node);
  });
  document.querySelectorAll(ANNOTATION_VALUE_SELECTOR).forEach((node) => {
    if (!usable(node)) return;
    const value = annotationValueText(node);
    if (!value) return;
    if (!node.getAttribute("title")) node.setAttribute("title", value);
    if (!node.dataset.annotationTooltip) node.dataset.annotationTooltip = value;
    addRef(`base:field_value:${fieldAnnotationId(value, node)}`, node, "field");
    index.candidatesByKind.value.push(node);
  });
  document.querySelectorAll(ANNOTATION_CELL_VALUE_SELECTOR).forEach((node) => {
    if (node.querySelector(ANNOTATION_VALUE_SELECTOR)) return;
    if (!usable(node)) return;
    const value = annotationCellValueText(node);
    if (!value) return;
    if (!node.getAttribute("title")) node.setAttribute("title", value);
    if (!node.dataset.annotationTooltip) node.dataset.annotationTooltip = value;
    addRef(`base:field_value:${fieldAnnotationId(value, node)}`, node, "field");
    index.candidatesByKind.cell.push(node);
  });
  document.querySelectorAll("[data-capability-id]").forEach((node) => {
    if (!usable(node)) return;
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
    addRef(targetRef, node, "row");
    index.candidatesByKind.capability.push(node);
  });
  document.querySelectorAll("[data-maintenance-id]").forEach((node) => {
    if (!usable(node)) return;
    const id = node.dataset.maintenanceId;
    addRef(`base:table_row:${rowAnnotationId(node, id)}`, node, "row");
    index.candidatesByKind.maintenance.push(node);
  });
  document.querySelectorAll("tr").forEach((node) => {
    if (!usable(node)) return;
    const title = text(node.querySelector("strong")?.textContent || node.cells?.[1]?.textContent || node.textContent).trim();
    if (!title) return;
    addRef(`base:table_row:${rowAnnotationId(node, title)}`, node, "row");
    index.candidatesByKind.row.push(node);
  });
  return index;
}

function annotationAnchorIndex({ includeHidden = false, refresh = false } = {}) {
  const key = includeHidden ? "annotationHiddenAnchorIndex" : "annotationAnchorIndex";
  if (refresh || !state[key]) state[key] = createAnnotationAnchorIndex({ includeHidden });
  return state[key];
}

function invalidateAnnotationAnchorIndex() {
  state.annotationAnchorIndex = null;
  state.annotationHiddenAnchorIndex = null;
}

function annotationIndexEntriesForTargetRef(targetRef, { includeHidden = false } = {}) {
  return annotationAnchorIndex({ includeHidden }).refs.get(text(targetRef).trim()) || [];
}

function annotationCandidatesFromIndex(note, { includeHidden = false } = {}) {
  const targetRef = text(note?.target_ref).trim();
  const anchorType = normalizedAnnotationAnchorType(note?.anchor_type || annotationAnchorTypeFromTargetRef(targetRef));
  const index = annotationAnchorIndex({ includeHidden });
  const exact = index.refs.get(targetRef) || [];
  if (exact.length) return exact.map((entry) => entry.node);
  if (targetRef.startsWith("base:capability:")) {
    return [...index.candidatesByKind.capability, document.querySelector("#capabilityFocusHeader"), document.querySelector("#tree")].filter(Boolean);
  }
  if (anchorType === "row") {
    return [...index.candidatesByKind.target, ...index.candidatesByKind.maintenance, ...index.candidatesByKind.capability, ...index.candidatesByKind.row];
  }
  const textCandidates = [];
  for (const noteText of noteLookupTextVariants(note)) {
    const compact = compactAnnotationLookupText(noteText);
    if (!compact) continue;
    textCandidates.push(...(index.texts.get(compact) || []).map((entry) => entry.node));
  }
  return [...new Set([...textCandidates, ...index.candidatesByKind.value, ...index.candidatesByKind.cell, ...index.candidatesByKind.target])];
}

function addUserNoteIndexEntry(map, key, note) {
  const normalized = text(key).trim();
  if (!normalized) return;
  if (!map.has(normalized)) map.set(normalized, []);
  map.get(normalized).push(note);
}

function routeTargetNoteIndexKey(route = "", targetRef = "") {
  return `${canonicalAnnotationRoute(route || "/")}::${text(targetRef).trim()}`;
}

function createUserNoteRuntimeIndex(notes = []) {
  const index = {
    notes: list(notes),
    byId: new Map(),
    byPageRoute: new Map(),
    byTargetRef: new Map(),
    byRouteTargetRef: new Map(),
    byAnchorType: new Map(),
    byObjectType: new Map(),
    invalid: [],
  };
  for (const note of index.notes) {
    const id = text(note?.id).trim();
    const pageRoute = canonicalAnnotationRoute(note?.page_route || "/");
    const targetRef = text(note?.target_ref).trim();
    const anchorType = normalizedAnnotationAnchorType(note?.anchor_type || annotationAnchorTypeFromTargetRef(targetRef)) || "object";
    const objectType = text(note?.object_type).trim() || annotationTargetRefObjectType(targetRef) || "unknown";
    if (!id || !pageRoute || !targetRef) {
      index.invalid.push({
        id: id || "(missing-id)",
        pageRoute,
        targetRef,
        reason: !id ? "missing_id" : !pageRoute ? "missing_page_route" : "missing_target_ref",
      });
      continue;
    }
    index.byId.set(id, note);
    addUserNoteIndexEntry(index.byPageRoute, pageRoute, note);
    addUserNoteIndexEntry(index.byTargetRef, targetRef, note);
    addUserNoteIndexEntry(index.byRouteTargetRef, routeTargetNoteIndexKey(pageRoute, targetRef), note);
    addUserNoteIndexEntry(index.byAnchorType, anchorType, note);
    addUserNoteIndexEntry(index.byObjectType, objectType, note);
  }
  return index;
}

function refreshUserNoteRuntimeIndex() {
  state.userNoteIndex = createUserNoteRuntimeIndex(state.userNotes);
  return state.userNoteIndex;
}

function userNoteRuntimeIndex() {
  return state.userNoteIndex || refreshUserNoteRuntimeIndex();
}

function userNoteById(noteId = "") {
  return userNoteRuntimeIndex().byId.get(text(noteId).trim()) || null;
}

function userNotesForPageRoute(pageRoute = "") {
  return userNoteRuntimeIndex().byPageRoute.get(canonicalAnnotationRoute(pageRoute || state.activeRoute || "/")) || [];
}

function buildAnnotationNoteIndex(pageRoute = "") {
  const notes = userNotesForPageRoute(pageRoute).filter((note) => annotationNoteMatchesCurrentPage(note, pageRoute));
  const counts = new Map();
  const anchorTypes = new Map();
  for (const note of notes) {
    const targetRef = text(note.target_ref).trim();
    if (!targetRef || targetRef.startsWith("page:")) continue;
    counts.set(targetRef, (counts.get(targetRef) || 0) + 1);
    if (!anchorTypes.has(targetRef)) {
      anchorTypes.set(targetRef, note.anchor_type || annotationAnchorTypeFromTargetRef(targetRef));
    }
  }
  state.annotationNoteIndex = { pageRoute, notes, counts, anchorTypes };
  return state.annotationNoteIndex;
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
  const currentRoute = canonicalAnnotationRoute(state.activeRoute || "/");
  const noteRoute = canonicalAnnotationRoute(note?.page_route || meta.route || "");
  const metaRoute = canonicalAnnotationRoute(meta.route || "");
  if (meta.view === "dev-lifecycle" || meta.view === "data-lifecycle") {
    const preferredProcessId = decodeLegacyAnchorPart(meta.context?.[2] || "");
    const resolvedProcessId = lifecycleAnnotationProcessIdForNote(note, meta.view, preferredProcessId);
    const currentProcessId = meta.view === "dev-lifecycle" ? state.selectedDevProcessId : state.selectedDataProcessId;
    if (resolvedProcessId) return !currentProcessId || resolvedProcessId === currentProcessId;
  }
  if (
    (meta.view !== state.activeView || !meta.context.length) &&
    noteRoute &&
    noteRoute === currentRoute &&
    (!metaRoute || metaRoute === currentRoute)
  ) {
    return true;
  }
  if (
    meta.view === "capabilities" &&
    ["field_value", "table_row"].includes(meta.objectType) &&
    noteRoute &&
    noteRoute === currentRoute &&
    (!metaRoute || metaRoute === currentRoute)
  ) {
    const legacyTab = decodeLegacyAnchorPart(meta.context?.[3] || "");
    return !legacyTab || legacyTab === "_" || legacyTab === state.activeCapabilityRelationTab;
  }
  if (meta.view === "maintenance" && noteRoute && noteRoute === currentRoute && (!metaRoute || metaRoute === currentRoute)) {
    return true;
  }
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
      if (valueIndexText === "cell" && cell) candidates.push(cell);
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
  const candidates = annotationCandidatesFromIndex(note, { includeHidden });
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

function annotationTargetRefObjectType(targetRef = "") {
  const parts = text(targetRef).trim().split(":");
  return parts[0] === "base" ? parts[1] || "" : "";
}

function annotationTargetRefStableKey(targetRef = "") {
  const parts = text(targetRef).trim().split(":");
  if (parts[0] !== "base") return "";
  if (parts[2] === "v2") return "";
  return parts.slice(2).join(":");
}

function annotationQueryValuesForNote(note = {}) {
  return uniqueAnnotationTextVariants([
    annotationTargetRefStableKey(note.target_ref),
    note.object_code,
    note.object_title,
    note.body && text(note.body).length <= 80 ? note.body : "",
  ]);
}

function environmentItemMatchesAnnotationQueries(item = {}, queries = []) {
  if (!item || !queries.length) return false;
  const values = uniqueAnnotationTextVariants([
    item.id,
    item.code,
    item.serviceCode,
    item.scopeCode,
    item.title,
    item.name,
    codeTitle(item || {}),
  ]).map(compactAnnotationLookupText);
  return queries.map(compactAnnotationLookupText).some((query) => query && values.some((value) => value && (value === query || value.includes(query) || query.includes(value))));
}

function environmentObjectServicesForAnnotation(object = {}) {
  return [
    ...list(object.services),
    ...list(object.securityTechnicalServices),
    ...list(object.security_technical_services),
    ...list(object.technicalServices),
    ...list(object.scope_mappings).flatMap((mapping) => list(mapping.services)),
    ...list(object.scopeMappings).flatMap((mapping) => list(mapping.services)),
  ];
}

function environmentRelationNodesForAnnotation(object = {}) {
  const services = environmentObjectServicesForAnnotation(object);
  return [
    ...list(object.relationNodes),
    ...list(object.modules),
    ...list(object.measures),
    ...list(object.securityTechnicalModules),
    ...list(object.securityTechnicalMeasures),
    ...services.flatMap((service) => list(service.modules)),
    ...services.flatMap((service) => list(service.measures)),
    ...services.flatMap((service) => list(service.relationNodes)),
  ];
}

function environmentSystemsForAnnotation(object = {}) {
  const services = environmentObjectServicesForAnnotation(object);
  const relationNodes = environmentRelationNodesForAnnotation(object);
  const rows = [
    ...list(object.securitySystems),
    ...list(object.systems),
    ...list(object.linkedSystems),
    ...list(object.security_systems),
    ...services.flatMap((service) => list(service.securitySystems)),
    ...services.flatMap((service) => list(service.systems)),
    ...services.flatMap((service) => list(service.linkedSystems)),
    ...services.flatMap((service) => list(service.security_systems)),
  ];
  for (const node of relationNodes) {
    rows.push(...list(node.securitySystems), ...list(node.systems), ...list(node.linkedSystems), ...list(node.security_systems));
  }
  return rows;
}

function environmentAnnotationObjectSelections(environment = {}) {
  const rows = [];
  const environmentId = environment.id || "";
  for (const segment of list(environment.segments)) {
    const segmentId = segment.id || "";
    for (const object of list(segment.objects)) {
      rows.push({ environmentId, segmentId, objectId: object.id || "", object, segment });
    }
  }
  for (const object of list(environment.objects)) {
    const objectSegments = list(object.segments);
    if (!objectSegments.length) {
      rows.push({ environmentId, segmentId: "", objectId: object.id || "", object, segment: null });
      continue;
    }
    objectSegments.forEach((segment) => {
      rows.push({ environmentId, segmentId: segment.id || "", objectId: object.id || "", object, segment });
    });
  }
  return uniqueBy(rows, (row) => [row.environmentId, row.segmentId, row.objectId].join("::"));
}

function environmentSelectionForObjectId(objectId = "") {
  const id = text(objectId).trim();
  if (!id) return null;
  const tree = list(
    state.environmentWorkbench?.environment_scope_tree ||
      state.environmentWorkbench?.environments ||
      state.environmentWorkbench?.navigator?.tree ||
      state.environmentWorkbench?.navigationTree ||
      state.environmentWorkbench?.tree,
  );
  for (const environment of tree) {
    for (const row of environmentAnnotationObjectSelections(environment)) {
      const candidateIds = [row.objectId, row.object?.id, row.object?.code, row.object?.title].map(text).map((value) => value.trim()).filter(Boolean);
      if (candidateIds.includes(id)) {
        return {
          environmentId: row.environmentId || environment.id || "",
          segmentId: row.segmentId || "",
          objectId: row.objectId || id,
        };
      }
    }
  }
  return null;
}

function annotationNoteMatchesEnvironmentSearch(note = {}) {
  const query = text(state.search).trim();
  if (!query) return true;
  const values = [
    annotationTargetRefStableKey(note.target_ref),
    note.object_code,
    note.object_title,
    note.body && text(note.body).length <= 80 ? note.body : "",
  ];
  return matchesTextQuery(query, ...values);
}

function environmentAnnotationSelectionForNote(note = {}) {
  const route = canonicalAnnotationRoute(note.page_route || "");
  if (route && route !== "/environment-mapping") return null;
  const objectType = annotationTargetRefObjectType(note.target_ref);
  const queries = annotationQueryValuesForNote(note);
  const tree = list(
    state.environmentWorkbench?.environment_scope_tree ||
      state.environmentWorkbench?.environments ||
      state.environmentWorkbench?.navigator?.tree ||
      state.environmentWorkbench?.navigationTree ||
      state.environmentWorkbench?.tree,
  );
  if (!tree.length || !queries.length) return null;
  let fuzzySelection = null;
  for (const environment of tree) {
    const environmentSelection = { environmentId: environment.id || "", segmentId: "", objectId: "" };
    if (objectType === "information_environment" && environmentItemMatchesAnnotationQueries(environment, queries)) return environmentSelection;
    for (const segment of list(environment.segments)) {
      const segmentSelection = { environmentId: environment.id || "", segmentId: segment.id || "", objectId: "" };
      if (objectType === "environment_segment" && environmentItemMatchesAnnotationQueries(segment, queries)) return segmentSelection;
    }
    for (const row of environmentAnnotationObjectSelections(environment)) {
      const object = row.object;
      const objectSelection = { environmentId: row.environmentId, segmentId: row.segmentId, objectId: row.objectId };
      if (objectType === "information_object" && environmentItemMatchesAnnotationQueries(object, queries)) return objectSelection;
      const serviceMatch = environmentObjectServicesForAnnotation(object).some((service) => environmentItemMatchesAnnotationQueries(service, queries));
      const relationMatch = environmentRelationNodesForAnnotation(object).some((node) => environmentItemMatchesAnnotationQueries(node, queries));
      const systemMatch = environmentSystemsForAnnotation(object).some((system) => environmentItemMatchesAnnotationQueries(system, queries));
      if (serviceMatch && objectType === "security_technical_service") return objectSelection;
      if (relationMatch && (objectType === "security_technology_module" || objectType === "security_technical_measure")) return objectSelection;
      if (systemMatch && objectType === "security_system") return objectSelection;
      if (objectType === "field_value" && (serviceMatch || relationMatch || systemMatch)) return objectSelection;
      if (!fuzzySelection && (environmentItemMatchesAnnotationQueries(object, queries) || serviceMatch || relationMatch || systemMatch)) fuzzySelection = objectSelection;
    }
  }
  return fuzzySelection;
}

function restoreEnvironmentContextFromNote(note = {}) {
  if (canonicalAnnotationRoute(note.page_route || state.activeRoute || "") !== "/environment-mapping") return false;
  const selection = environmentAnnotationSelectionForNote(note);
  let changed = false;
  if (state.activeEnvironmentTab !== "mapping") {
    state.activeEnvironmentTab = "mapping";
    changed = true;
  }
  if (!selection) return changed;
  if (state.search && !annotationNoteMatchesEnvironmentSearch(note)) {
    state.search = "";
    changed = true;
  }
  if (selection.environmentId && selection.environmentId !== state.selectedEnvironmentId) {
    state.selectedEnvironmentId = selection.environmentId;
    state.expandedEnvironmentIds.add(selection.environmentId);
    changed = true;
  }
  if (selection.segmentId && selection.segmentId !== state.selectedEnvironmentSegmentId) {
    state.selectedEnvironmentSegmentId = selection.segmentId;
    state.expandedEnvironmentIds.add(selection.segmentId);
    changed = true;
  }
  if (selection.objectId && selection.objectId !== state.selectedEnvironmentObjectId) {
    state.selectedEnvironmentObjectId = selection.objectId;
    changed = true;
  }
  return changed;
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

function environmentUserTarget(viewModel) {
  const selectedObject = viewModel?.selectedObject;
  if (selectedObject?.id) {
    return buildBaseUserTarget({
      objectType: "information_object",
      objectLabel: "信息化对象",
      id: selectedObject.id,
      code: selectedObject.code,
      title: codeTitle(selectedObject, "信息化对象"),
    });
  }
  const selectedSegment = viewModel?.selectedSegment;
  if (selectedSegment?.id) {
    return buildBaseUserTarget({
      objectType: "environment_segment",
      objectLabel: "环境子类",
      id: selectedSegment.id,
      code: selectedSegment.code,
      title: codeTitle(selectedSegment, "环境子类"),
    });
  }
  const selectedEnvironment = viewModel?.selectedEnvironment;
  if (selectedEnvironment?.id) {
    return buildBaseUserTarget({
      objectType: "information_environment",
      objectLabel: "信息化环境",
      id: selectedEnvironment.id,
      code: selectedEnvironment.code,
      title: codeTitle(selectedEnvironment, "信息化环境"),
    });
  }
  return null;
}

function lifecycleAnnotationKindFromView(view = "") {
  if (view === "dev-lifecycle") return "dev";
  if (view === "data-lifecycle") return "data";
  return "";
}

function lifecycleViewModelForAnnotation(kind = "", { selectedProcessId = null, search = "" } = {}) {
  const viewModels = window.sapdViewModels;
  if (!viewModels) return null;
  const lifecycleWorkbenchViewModel =
    viewModels.buildLifecycleWorkbenchViewModel?.({ workbench: state.lifecycleWorkbench }) || state.lifecycleWorkbenchViewModel;
  if (lifecycleWorkbenchViewModel) state.lifecycleWorkbenchViewModel = lifecycleWorkbenchViewModel;
  const args = {
    lifecycleWorkbench: state.lifecycleWorkbench,
    lifecycleWorkbenchViewModel,
    lifecycle: state.lifecycle,
    selectedProcessId,
    search,
  };
  if (kind === "dev") return viewModels.buildApplicationSecurityLifecycleViewModel?.(args) || null;
  if (kind === "data") return viewModels.buildDataSecurityLifecycleViewModel?.(args) || null;
  return null;
}

function lifecycleAnnotationProcessMatchScore(row = {}, note = {}) {
  const rowText = compactAnnotationLookupText([row.id, row.code, row.order, row.title, row.name, row.searchText].filter(Boolean).join(" "));
  if (!rowText) return 0;
  let score = 0;
  for (const noteText of noteLookupTextVariants(note)) {
    const compactNote = compactAnnotationLookupText(noteText);
    if (!compactNote || compactNote.length < 2) continue;
    if (rowText === compactNote) score = Math.max(score, 260);
    else if (rowText.includes(compactNote)) score = Math.max(score, 110 + Math.min(compactNote.length, 80));
    else if (compactNote.includes(rowText) && rowText.length >= 3) score = Math.max(score, 76);
  }
  return score;
}

function lifecycleAnnotationProcessIdForNote(note = {}, view = "", preferredProcessId = "") {
  const kind = lifecycleAnnotationKindFromView(view);
  if (!kind) return "";
  const viewModel = lifecycleViewModelForAnnotation(kind, { selectedProcessId: null, search: "" });
  const rows = list(viewModel?.stageTree || viewModel?.navigationTree);
  const preferred = text(preferredProcessId).trim();
  if (preferred && preferred !== "_" && rows.some((row) => text(row.id).trim() === preferred)) return preferred;
  let bestRow = null;
  let bestScore = 0;
  for (const row of rows) {
    const score = lifecycleAnnotationProcessMatchScore(row, note);
    if (score > bestScore) {
      bestRow = row;
      bestScore = score;
    }
  }
  return bestScore >= 90 ? text(bestRow?.id).trim() : "";
}

function lifecycleSearchIncludesProcess(kind = "", processId = "", search = "") {
  const normalizedProcessId = text(processId).trim();
  if (!normalizedProcessId) return false;
  if (!text(search).trim()) return true;
  const viewModel = lifecycleViewModelForAnnotation(kind, { selectedProcessId: normalizedProcessId, search });
  return list(viewModel?.stageTree || viewModel?.navigationTree).some((row) => text(row.id).trim() === normalizedProcessId);
}

function lifecycleUserTarget(viewModel, kind = "dev") {
  const selected = viewModel?.selectedProcess || viewModel?.selectedStage;
  if (!selected?.id) return null;
  const isData = kind === "data";
  return buildBaseUserTarget({
    objectType: isData ? "lifecycle_data_process" : "lifecycle_application_stage",
    objectLabel: isData ? "LC-DT 数据过程" : "LC-AP 阶段",
    id: selected.id,
    code: selected.code || selected.id,
    title: codeTitle(selected, isData ? "LC-DT 数据过程" : "LC-AP 阶段"),
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
  const preferredStableTargetNode = element.closest?.('[data-annotation-prefer-target="true"]');
  const preferredStableTarget = annotationTargetFromDataset(preferredStableTargetNode);
  if (preferredStableTarget) return preferredStableTarget;
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

function clearAnnotationActiveAnchorState() {
  document
    .querySelectorAll(
      [
        "[data-user-note-anchor-active='true']",
        "[data-user-note-anchor-cell-active='true']",
        "[data-user-note-anchor-row-active='true']",
      ].join(","),
    )
    .forEach((node) => {
      node.removeAttribute("data-user-note-anchor-active");
      node.removeAttribute("data-user-note-anchor-cell-active");
      node.removeAttribute("data-user-note-anchor-row-active");
    });
}

function activeUserNoteForCurrentPage() {
  const activeNoteId = text(state.activeUserNoteId).trim();
  const activeTargetRef = text(state.activeUserNoteTargetRef).trim();
  if (!activeNoteId && !activeTargetRef) return null;
  return (
    userNotesForPageRoute(state.activeRoute).find((note) => {
      if (!annotationNoteMatchesCurrentPage(note, state.activeRoute)) return false;
      if (activeNoteId && text(note.id).trim() === activeNoteId) return true;
      return activeTargetRef && text(note.target_ref).trim() === activeTargetRef;
    }) || null
  );
}

function markActiveAnnotationTargetFromState() {
  const activeNote = activeUserNoteForCurrentPage();
  if (!activeNote || !annotationTargetContextMatchesCurrent(activeNote)) return false;
  const anchor = findAnnotationAnchorElement(activeNote);
  if (!anchor) return false;
  markAnnotationAnchorContext(activeAnchorElementForNote(anchor, activeNote), "active", activeNote.anchor_type || state.activeUserNoteAnchorType || annotationAnchorTypeFromTargetRef(activeNote.target_ref), activeNote);
  return true;
}

function activeAnchorElementForNote(anchor, note = null) {
  const anchorType = normalizedAnnotationAnchorType(note?.anchor_type || annotationAnchorTypeFromTargetRef(note?.target_ref));
  return anchorType === "field" || anchorType === "value" ? fieldAnnotationAnchorElement(anchor, note) || anchor : anchor;
}

function annotationAnchorElementForNote(anchor, note = null) {
  if (!anchor) return null;
  const anchorType = normalizedAnnotationAnchorType(note?.anchor_type || annotationAnchorTypeFromTargetRef(note?.target_ref));
  return anchorType === "field" || anchorType === "value" ? fieldAnnotationAnchorElement(anchor, note) || anchor : anchor;
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
  invalidateAnnotationAnchorIndex();
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

function applyAnnotationAnchorMarkers({ refreshIndex = true, fallbackText = true, source = "scheduled" } = {}) {
  clearAnnotationAnchorState();
  const pageRoute = text((state.activePageAnnotationTarget || currentPageAnnotationTarget()).code).trim();
  const { notes, counts: noteCounts, anchorTypes: noteAnchorTypes } = buildAnnotationNoteIndex(pageRoute);
  if (!noteCounts.size) return;
  const markedTargetRefs = new Set();
  const index = annotationAnchorIndex({ refresh: refreshIndex });
  const markerStartedAt = annotationPerfNow();
  let textFallbackCount = 0;

  const mark = (node, targetRef, preferredAnchorType = "") => {
    const count = noteCounts.get(targetRef);
    if (!node || !count) return;
    const anchorType = preferredAnchorType || noteAnchorTypes.get(targetRef) || annotationAnchorTypeFromTargetRef(targetRef);
    markAnnotationAnchorContext(node, "marked", anchorType);
    markedTargetRefs.add(targetRef);
  };

  for (const [targetRef, entries] of index.refs) {
    if (!noteCounts.has(targetRef)) continue;
    entries.forEach((entry) => mark(entry.node, targetRef, entry.anchorType));
  }
  for (const note of notes) {
    const targetRef = text(note.target_ref).trim();
    if (!targetRef || targetRef.startsWith("page:") || markedTargetRefs.has(targetRef)) continue;
    if (!annotationTargetContextMatchesCurrent(note)) continue;
    if (!fallbackText) continue;
    if (textFallbackCount >= ANNOTATION_MARKER_MAX_TEXT_FALLBACKS || annotationPerfNow() - markerStartedAt > ANNOTATION_MARKER_TEXT_FALLBACK_TIMEOUT_MS) break;
    textFallbackCount += 1;
    const fallbackAnchor = candidateFromLegacyCoordinate(note) || findAnnotationAnchorElementByNoteText(note);
    if (!fallbackAnchor) continue;
    markAnnotationAnchorContext(fallbackAnchor, "marked", note.anchor_type || annotationAnchorTypeFromTargetRef(targetRef), note);
    markedTargetRefs.add(targetRef);
  }
  markActiveAnnotationTargetFromState();
}

function findAnnotationAnchorElement(note, { includeHidden = false } = {}) {
  const targetRef = text(note?.target_ref).trim();
  if (!targetRef || targetRef.startsWith("page:")) return null;
  const exactIndexMatch = annotationIndexEntriesForTargetRef(targetRef, { includeHidden }).find((entry) => includeHidden || isAnnotationAnchorVisible(entry.node));
  if (exactIndexMatch?.node) return annotationAnchorElementForNote(exactIndexMatch.node, note);
  if (targetRef.startsWith("base:capability:")) {
    const legacyCapabilityKey = targetRef.replace(/^base:capability:/, "");
    const item = capabilityItemByCodeOrTitle(legacyCapabilityKey || note?.object_title);
    if (item?.id && item.id === state.selectedCapabilityId) {
      const treeNode = annotationAnchorIndex({ includeHidden }).candidatesByKind.capability.find((node) => node.dataset.capabilityId === item.id);
      return treeNode || document.querySelector("#capabilityFocusHeader");
    }
  }
  for (const node of annotationAnchorIndex({ includeHidden }).candidatesByKind.capability) {
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
  for (const node of annotationAnchorIndex({ includeHidden }).candidatesByKind.maintenance) {
    const id = node.dataset.maintenanceId;
    if (`base:table_row:${rowAnnotationId(node, id)}` === targetRef) return node;
  }
  for (const node of annotationAnchorIndex({ includeHidden }).candidatesByKind.row) {
    const label = text(node.querySelector("strong")?.textContent || node.cells?.[1]?.textContent || node.textContent).trim();
    if (!label) continue;
    if (`base:table_row:${rowAnnotationId(node, label)}` === targetRef) return node;
  }
  if (!annotationTargetContextMatchesCurrent(note)) return null;
  return annotationAnchorElementForNote(candidateFromLegacyCoordinate(note, { includeHidden }) || findAnnotationAnchorElementByNoteText(note, { includeHidden }), note);
}

function restoreAnnotationContextFromNote(note) {
  const targetRef = text(note?.target_ref).trim();
  const parts = targetRef.split(":");
  if (parts[0] !== "base") return false;
  const slideChanged = restoreGuideSlideContextFromNote(note);
  if (slideChanged) return true;
  const environmentChanged = restoreEnvironmentContextFromNote(note);
  if (environmentChanged) return true;
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
    const item = capabilityItemById(capabilityId);
    if (item?.id && capabilityId !== state.selectedCapabilityId) {
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
    const legacyProcessId = decoded[2] === "_" ? "" : decoded[2];
    const processId = lifecycleAnnotationProcessIdForNote(note, view, legacyProcessId) || legacyProcessId;
    if (processId && processId !== state.selectedDevProcessId) {
      state.selectedDevProcessId = processId;
      changed = true;
    }
    if (processId && !lifecycleSearchIncludesProcess("dev", processId, state.devLifecycleStageSearch)) {
      state.devLifecycleStageSearch = "";
      changed = true;
    }
  } else if (view === "data-lifecycle") {
    const legacyProcessId = decoded[2] === "_" ? "" : decoded[2];
    const processId = lifecycleAnnotationProcessIdForNote(note, view, legacyProcessId) || legacyProcessId;
    if (processId && processId !== state.selectedDataProcessId) {
      state.selectedDataProcessId = processId;
      changed = true;
    }
    if (processId && !lifecycleSearchIncludesProcess("data", processId, state.dataLifecycleStageSearch)) {
      state.dataLifecycleStageSearch = "";
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

async function capabilityProjectionRowsForAnnotation() {
  if (Array.isArray(state.annotationCapabilityProjectionIndex)) return state.annotationCapabilityProjectionIndex;
  if (state.annotationCapabilityProjectionIndexPromise) return state.annotationCapabilityProjectionIndexPromise;
  state.annotationCapabilityProjectionIndexPromise = fetch("./public/data/capability/index.json", { cache: "no-store" })
    .then((response) => (response.ok ? response.json() : null))
    .then((index) => {
      const rows = list(index?.projections).filter((row) => row?.id && row?.path);
      state.annotationCapabilityProjectionIndex = rows;
      return rows;
    })
    .catch((error) => {
      console.warn("能力 Issue projection 索引加载失败", error);
      state.annotationCapabilityProjectionIndex = [];
      return [];
    })
    .finally(() => {
      state.annotationCapabilityProjectionIndexPromise = null;
    });
  return state.annotationCapabilityProjectionIndexPromise;
}

function annotationCapabilityValueNeedles(note = {}) {
  const values = [note.object_title, note.object_code, note.object_name, note.field_value]
    .map((value) => text(value).trim())
    .filter(Boolean);
  const variants = values.flatMap((value) => annotationBusinessTextVariants(value));
  return uniqueBy([...values, ...variants].map(compactAnnotationLookupText).filter(Boolean), (value) => value);
}

function isGenericAnnotationCapabilityValue(note = {}) {
  const values = annotationCapabilityValueNeedles(note);
  return values.length > 0 && values.every((value) => ["all", "全部", "全部对象", "全部范围"].includes(value));
}

function relatedCapabilityAnnotationValueNotes(note = {}) {
  const meta = legacyAnnotationTargetMeta(note?.target_ref);
  if (!meta || meta.view !== "capabilities") return [];
  const legacyCapabilityId = decodeLegacyAnchorPart(meta.context?.[2] || "");
  if (!legacyCapabilityId || legacyCapabilityId === "_") return [];
  return userNotesForPageRoute("/capability-mapping").filter((candidate) => {
    if (candidate === note || candidate?.id === note?.id) return false;
    const candidateMeta = legacyAnnotationTargetMeta(candidate?.target_ref);
    if (!candidateMeta || candidateMeta.view !== "capabilities" || candidateMeta.objectType !== "field_value") return false;
    if (decodeLegacyAnchorPart(candidateMeta.context?.[2] || "") !== legacyCapabilityId) return false;
    return !isGenericAnnotationCapabilityValue(candidate);
  });
}

function capabilityProjectionContainsAnnotationValue(projection, note) {
  const needles = annotationCapabilityValueNeedles(note);
  if (!needles.length || !projection) return false;
  const haystack = compactAnnotationLookupText(
    JSON.stringify({
      selected: projection.selected,
      objects: projection.objects,
      technicalMappingRows: projection.technicalMappingRows || projection.technical_mapping_rows,
      managementMappingRows: projection.managementMappingRows || projection.management_mapping_rows,
      standardMappingRows: projection.standardMappingRows || projection.standard_mapping_rows,
      localRelationMapsByFocusId: projection.localRelationMapsByFocusId || projection.local_relation_maps_by_focus_id,
    }),
  );
  return needles.some((needle) => haystack.includes(needle));
}

function applyCapabilityAnnotationProjection(projection, row, note) {
  const selected = projection?.selected || {};
  const item = capabilityItemById(selected.id) || capabilityItemById(row?.id);
  if (!item?.id) return false;
  state.selectedCapabilityId = item.id;
  state.capabilityCatalogCollapsed = false;
  capabilityAncestorIds(item.id).forEach((id) => state.expandedCapabilityIds.add(id));
  state.expandedSelectionId = item.id;
  state.capabilityWorkspaceView = projection;
  if (item.type === "capability_focus") mergeCapabilityProjection(projection);
  const tab = decodeLegacyAnchorPart(legacyAnnotationTargetMeta(note?.target_ref)?.context?.[3] || "");
  if (tab && tab !== "_") state.activeCapabilityRelationTab = tab;
  return true;
}

async function findCapabilityProjectionForAnnotationValue(note) {
  const cacheKey = annotationCapabilityValueNeedles(note).join("|");
  if (!cacheKey) return null;
  const cached = state.annotationCapabilityProjectionValueCache.get(cacheKey);
  if (cached) return cached;
  const rows = await capabilityProjectionRowsForAnnotation();
  const orderedRows = [
    ...rows.filter((row) => row.id === state.selectedCapabilityId),
    ...rows.filter((row) => row.detailMode === "detail" && row.id !== state.selectedCapabilityId),
    ...rows.filter((row) => row.detailMode !== "detail" && row.id !== state.selectedCapabilityId),
  ];
  for (const row of orderedRows) {
    const path = `./public/data/${text(row.path).replace(/^\/+/, "")}`;
    let projection = state.annotationCapabilityProjectionDataCache.get(row.id);
    if (!projection) {
      projection = await fetch(path, { cache: "no-store" })
        .then((response) => (response.ok ? response.json() : null))
        .catch(() => null);
      if (projection) state.annotationCapabilityProjectionDataCache.set(row.id, projection);
    }
    if (!capabilityProjectionContainsAnnotationValue(projection, note)) continue;
    const result = { row, projection };
    state.annotationCapabilityProjectionValueCache.set(cacheKey, result);
    return result;
  }
  state.annotationCapabilityProjectionValueCache.set(cacheKey, null);
  return null;
}

function ensureCapabilityProjectionForAnnotationItem(item) {
  if (!item?.id) return Promise.resolve(false);
  state.selectedCapabilityId = item.id;
  state.capabilityCatalogCollapsed = false;
  capabilityAncestorIds(item.id).forEach((id) => state.expandedCapabilityIds.add(id));
  state.expandedSelectionId = item.id;
  const load =
    item.type === "capability_focus" ? ensureCapabilityProjectionForFocus(item.id) : ensureCapabilityWorkspaceViewForSelection(item.id);
  return Promise.resolve(load).then(() => true);
}

function ensureCapabilityAnnotationProjectionForNote(note) {
  const meta = legacyAnnotationTargetMeta(note?.target_ref);
  if (!meta || meta.view !== "capabilities" || !["field_value", "table_row"].includes(meta.objectType)) return Promise.resolve(false);
  const lookupNotes = isGenericAnnotationCapabilityValue(note) ? relatedCapabilityAnnotationValueNotes(note) : [note, ...relatedCapabilityAnnotationValueNotes(note)];
  const loadKey = `annotationCapabilityProjection:${[text(note?.target_ref).trim(), ...lookupNotes.flatMap((item) => annotationCapabilityValueNeedles(item))].join("|")}`;
  if (state.annotationContextLoads.has(loadKey)) return state.annotationContextLoads.get(loadKey);
  const run = async () => {
    if (findAnnotationAnchorElement(note)) return false;
    const legacyCapabilityId = decodeLegacyAnchorPart(meta.context?.[2] || "");
    const directItem = capabilityItemById(legacyCapabilityId);
    if (directItem?.id) return ensureCapabilityProjectionForAnnotationItem(directItem);
    for (const lookupNote of lookupNotes) {
      const match = await findCapabilityProjectionForAnnotationValue(lookupNote);
      if (!match?.projection) continue;
      return applyCapabilityAnnotationProjection(match.projection, match.row, note);
    }
    return false;
  };
  const load = promiseWithTimeout(run(), 3200).finally(() => {
    state.annotationContextLoads.delete(loadKey);
  });
  state.annotationContextLoads.set(loadKey, load);
  return load;
}

function annotationContextLoadPromiseForNote(note) {
  const meta = legacyAnnotationTargetMeta(note?.target_ref);
  if (!meta || meta.view !== "capabilities") return Promise.resolve();
  const capabilityId = decodeLegacyAnchorPart(meta.context?.[2] || "");
  const loads = [ensureStandardFrameworkLoadedForAnnotationNote(note), ensureCapabilityAnnotationProjectionForNote(note)];
  if (capabilityId && capabilityId !== "_" && capabilityItemTypeById(capabilityId) === "capability_focus") {
    loads.push(ensureCapabilityProjectionForFocus(capabilityId));
  }
  return promiseWithTimeout(Promise.all(loads), 3200);
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

function annotationJumpBudgetStatus(startedAt, attempt) {
  const elapsedMs = annotationPerfNow() - startedAt;
  if (elapsedMs >= ANNOTATION_JUMP_TIMEOUT_MS) return { exceeded: true, reason: "timeout", elapsedMs };
  if (attempt >= ANNOTATION_JUMP_MAX_ATTEMPTS) return { exceeded: true, reason: "target_not_loaded", elapsedMs };
  return { exceeded: false, reason: "", elapsedMs };
}

function annotationJumpFailureMessage(reason) {
  if (reason === "timeout") return "定位超过时间预算，目标可能还未加载。已停止自动重试，可点击重试定位。";
  if (reason === "route_changed") return "页面已切换，已停止本次定位。可回到目标页面后重试定位。";
  return "目标未加载或当前筛选未展开。已停止自动重试，可点击重试定位。";
}

function setAnnotationJumpFailure(note, reason) {
  const noteId = text(note?.id).trim();
  if (!noteId) return;
  state.annotationJumpFailure = {
    noteId,
    reason,
    message: annotationJumpFailureMessage(reason),
    targetTitle: text(note.object_title || note.object_type || note.page_title || note.target_ref).trim(),
  };
  state.userAnnotationDrawerOpen = true;
  renderUserAnnotationDrawer({ preserveScroll: true });
}

function clearAnnotationJumpFailure(noteId = "") {
  if (!state.annotationJumpFailure) return false;
  const normalized = text(noteId).trim();
  if (normalized && text(state.annotationJumpFailure.noteId).trim() !== normalized) return false;
  state.annotationJumpFailure = null;
  return true;
}

function jumpToUserNote(noteId) {
  const note = userNoteById(noteId);
  if (!note) return;
  const route = text(note.page_route).trim();
  const failureWasVisible = clearAnnotationJumpFailure(note.id);
  if (failureWasVisible && state.userAnnotationDrawerOpen) renderUserAnnotationDrawer({ preserveScroll: true });
  state.activeUserNoteId = text(note.id).trim();
  state.activeUserNoteTargetRef = text(note.target_ref).trim();
  state.activeUserNoteAnchorType = note.anchor_type || annotationAnchorTypeFromTargetRef(note.target_ref);
  state.userAnnotationDrawerOpen = true;
  state.userAnnotationExpandedNoteIds.add(state.activeUserNoteId);
  renderUserAnnotationDrawer({ preserveScroll: true, focusNoteId: state.activeUserNoteId });
  clearAnnotationActiveAnchorState();
  const isCoveredByOpenDrawer = (anchor) => {
    if (!state.userAnnotationDrawerOpen || !anchor) return false;
    const panel = document.querySelector(".user-annotation-drawer.is-open .annotation-drawer-panel");
    if (!panel) return false;
    const anchorRect = anchor.getBoundingClientRect();
    const panelRect = panel.getBoundingClientRect();
    return anchorRect.right > panelRect.left - 12 && anchorRect.left < panelRect.right && anchorRect.bottom > panelRect.top && anchorRect.top < panelRect.bottom;
  };
  const scrollEnvironmentGraphViewportToAnchor = (anchor) => {
    const viewport = anchor?.closest?.(".environment-object-funnel-viewport, .environment-object-graph-stage, .semantic-scroll, .preview-stage-scroll");
    if (!viewport) return false;
    const viewportRect = viewport.getBoundingClientRect();
    const anchorRect = anchor.getBoundingClientRect();
    const nextLeft = viewport.scrollLeft + anchorRect.left - viewportRect.left - Math.max(24, (viewportRect.width - anchorRect.width) / 2);
    const nextTop = viewport.scrollTop + anchorRect.top - viewportRect.top - Math.max(24, (viewportRect.height - anchorRect.height) / 2);
    viewport.scrollTo?.({
      left: Math.max(0, nextLeft),
      top: Math.max(0, nextTop),
      behavior: "smooth",
    });
    return true;
  };
  const revealAnchor = (anchor, isCurrent = () => true) => {
    if (!isCurrent()) return;
    const clearedFailure = clearAnnotationJumpFailure(note.id);
    if (clearedFailure && state.userAnnotationDrawerOpen) renderUserAnnotationDrawer({ preserveScroll: true });
    const anchorType = note.anchor_type || annotationAnchorTypeFromTargetRef(note.target_ref);
    state.activeUserNoteId = text(note.id).trim();
    state.activeUserNoteTargetRef = text(note.target_ref).trim();
    state.activeUserNoteAnchorType = anchorType;
    clearAnnotationActiveAnchorState();
    markAnnotationAnchorContext(activeAnchorElementForNote(anchor, note), "active", anchorType, note);
    const scrollTarget = annotationRevealScrollElement(anchor, note);
    scrollEnvironmentGraphViewportToAnchor(scrollTarget);
    scrollTarget?.scrollIntoView?.({ behavior: "smooth", block: "center", inline: "nearest" });
    if (state.userAnnotationDrawerOpen) scrollAnnotationDrawerNoteIntoView(note.id, { attempts: 4 });
    [180, 520, 980].forEach((delay) => {
      window.setTimeout(() => {
        if (!isCurrent()) return;
        const current = resolveAnnotationAnchorElement(note) || anchor;
        markAnnotationAnchorContext(activeAnchorElementForNote(current, note), "active", anchorType, note);
        if (state.userAnnotationDrawerOpen) scrollAnnotationDrawerNoteIntoView(note.id, { attempts: 1 });
      }, delay);
    });
  };
  const doJump = () => {
    const jumpToken = ++state.annotationJumpToken;
    const isCurrentJump = () => jumpToken === state.annotationJumpToken;
    const changed = restoreAnnotationContextFromNote(note);
    if (changed) renderActiveView();
    const pendingContextLoad = annotationContextLoadPromiseForNote(note);
    let revealed = false;
    let finished = false;
    let markerRefreshCount = 0;
    let contextPending = true;
    let startedAt = annotationPerfNow();
    const applyMarkersForJump = () => {
      if (markerRefreshCount >= ANNOTATION_JUMP_MARKER_REFRESH_LIMIT) return;
      markerRefreshCount += 1;
      applyAnnotationAnchorMarkers({ refreshIndex: true, fallbackText: false, source: "jumpToUserNote" });
    };
    const finishWithFailure = (reason) => {
      if (finished || revealed || !isCurrentJump()) return;
      finished = true;
      if (text(note.target_ref).trim().startsWith("page:")) {
        document.querySelector(".workspace-stage")?.scrollIntoView?.({ behavior: "smooth", block: "start" });
        return;
      }
      setAnnotationJumpFailure(note, reason);
    };
    const resolveAndReveal = (attempt = 0) => {
      if (finished || revealed || !isCurrentJump()) return;
      if (route && route !== state.activeRoute) {
        finishWithFailure("route_changed");
        return;
      }
      applyMarkersForJump();
      const anchor = resolveAnnotationAnchorElement(note);
      if (!anchor) {
        const budget = annotationJumpBudgetStatus(startedAt, attempt);
        if (budget.exceeded) {
          finishWithFailure(budget.reason);
          return;
        }
        if (contextPending && attempt < ANNOTATION_JUMP_MAX_ATTEMPTS * 2) {
          window.setTimeout(() => resolveAndReveal(attempt + 1), ANNOTATION_JUMP_RETRY_DELAY_MS);
          return;
        }
        window.setTimeout(() => resolveAndReveal(attempt + 1), ANNOTATION_JUMP_RETRY_DELAY_MS);
        return;
      }
      revealed = true;
      finished = true;
      if (isCoveredByOpenDrawer(anchor)) {
        state.userAnnotationDrawerOpen = false;
        renderUserAnnotationDrawer({ preserveScroll: true });
        requestAnimationFrame(() => {
          if (!isCurrentJump()) return;
          scheduleAnnotationAnchorMarkers("jump-drawer-covered", { delays: [0, 80] });
          revealAnchor(resolveAnnotationAnchorElement(note) || anchor, isCurrentJump);
        });
        return;
      }
      revealAnchor(anchor, isCurrentJump);
    };
    pendingContextLoad?.then?.(() => {
      if (!isCurrentJump() || finished || revealed || (route && route !== state.activeRoute)) return;
      contextPending = false;
      startedAt = annotationPerfNow();
      markerRefreshCount = 0;
      renderActiveView();
      scheduleAnnotationAnchorMarkers("jump-context-loaded", { delays: [0, 80] });
      requestAnimationFrame(() => resolveAndReveal(0));
    });
    pendingContextLoad?.finally?.(() => {
      if (!isCurrentJump()) return;
      contextPending = false;
    });
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
  state.annotationJumpToken += 1;
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
  state.annotationJumpFailure = null;
  state.activeUserNoteId = "";
  state.activeUserNoteTargetRef = "";
  state.activeUserNoteAnchorType = "";
  clearAnnotationActiveAnchorState();
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
      refreshUserNoteRuntimeIndex();
      state.userWriteStatus = { ...state.userWriteStatus, state: data.ok === false ? data.data_state || "api_unavailable" : "ready", savingNote: false };
      state.userNotesLoaded = true;
    })
    .catch((error) => {
      console.warn("用户 Issue 加载失败", error);
      state.userWriteStatus = { ...state.userWriteStatus, state: "api_unavailable", savingNote: false };
      state.userNotesLoaded = true;
    })
    .finally(() => {
      state.userNotesLoadPromise = null;
      renderUserAnnotationDrawer();
      if (state.activeView === "workbench" || state.activeView === "overview") renderActiveView();
      scheduleAnnotationAnchorMarkers("user-notes-loaded");
    });
  return state.userNotesLoadPromise;
}

function userNotesExportFileNameFallback() {
  const now = new Date();
  const iso = now.toISOString();
  return `user-notes-export-${iso.slice(0, 4)}${iso.slice(5, 7)}${iso.slice(8, 10)}-${iso.slice(11, 13)}${iso.slice(14, 16)}${iso.slice(17, 19)}Z.md`;
}

function downloadBlobFile(blob, filename = "") {
  const data = blob instanceof Blob ? blob : new Blob([text(blob || "")], { type: "text/markdown" });
  const safeName = text(filename).trim() || userNotesExportFileNameFallback();
  if (typeof window === "undefined" || !window.URL || !window.URL.createObjectURL) {
    window.alert("当前环境不支持文件下载。");
    return;
  }
  const href = window.URL.createObjectURL(data);
  const anchor = document.createElement("a");
  anchor.href = href;
  anchor.download = safeName;
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => window.URL.revokeObjectURL(href), 700);
}

function syncUserNotesExportButton() {
  document.querySelectorAll("[data-user-notes-export]").forEach((exportButton) => {
    exportButton.disabled = Boolean(state.userNotesExporting);
    exportButton.textContent = state.userNotesExporting ? "导出中..." : "导出全部";
    exportButton.classList.toggle("is-exporting", Boolean(state.userNotesExporting));
  });
}

async function handleUserNotesExport() {
  const dataClient = window.sapdDataClient;
  if (!dataClient?.exportUserNotes) {
    window.alert("当前运行环境未提供 Issue 导出能力。");
    return;
  }
  state.userNotesExporting = true;
  state.workbenchIssueExportStatus = null;
  state.userNotesExportStatus = { state: "running", message: "正在导出全部批注..." };
  syncUserNotesExportButton();
  syncWorkbenchIssueHeaderControls();
  try {
    const result = await dataClient.exportUserNotes({ save: true });
    if (result?.ok === false) throw new Error(result.error || "导出失败");
    const outputPath = text(result?.output_path).trim();
    state.userNotesExportStatus = {
      state: "success",
      message: outputPath ? `已导出全部批注到：${outputPath}` : "已导出全部批注。",
      outputPath,
    };
  } catch (error) {
    console.warn("用户 Issue 导出失败", error);
    state.userNotesExportStatus = { state: "error", message: `Issue 导出失败：${text(error?.message || error) || "请检查应用服务是否可用"}` };
    window.alert(`Issue 导出失败：${text(error?.message || error) || "请检查应用服务是否可用"}`);
  } finally {
    state.userNotesExporting = false;
    syncUserNotesExportButton();
    syncWorkbenchIssueHeaderControls();
  }
}

function workbenchSelectedIssueRows() {
  const selectedIds = Array.from(state.workbenchSelectedIssueIds || []).map((noteId) => text(noteId).trim()).filter(Boolean);
  if (!selectedIds.length) return [];
  const selectedIdSet = new Set(selectedIds);
  return workbenchAllIssueRows().filter((issue) => selectedIdSet.has(issue.id));
}

function workbenchIssueExportMarkdown(rows = [], title = "SAPD Wiki Issue 导出") {
  const exportedAt = new Date().toISOString();
  const body = list(rows)
    .map(
      (issue, index) => [
        `## ${index + 1}. ${issue.title || "未命名 Issue"}`,
        "",
        `- 状态：${issue.status || "-"}`,
        `- 优先级：${issue.priority || "-"}`,
        `- 所属页面：${issue.page || "-"}`,
        `- 关联对象：${issue.object || "-"}`,
        `- 更新时间：${issue.updated || "-"}`,
        "",
        issue.body || issue.summary || "",
      ].join("\n"),
    )
    .join("\n\n");
  return [`# ${title}`, "", `导出时间：${exportedAt}`, `Issue 数量：${rows.length}`, "", body || "无可导出的 Issue。", ""].join("\n");
}

function workbenchIssueExportFilename(prefix = "sapd-issues-selected") {
  const now = new Date();
  const iso = now.toISOString();
  return `${prefix}-${iso.slice(0, 4)}${iso.slice(5, 7)}${iso.slice(8, 10)}-${iso.slice(11, 13)}${iso.slice(14, 16)}${iso.slice(17, 19)}Z.md`;
}

async function handleWorkbenchIssueSelectedExport() {
  const rows = workbenchSelectedIssueRows();
  if (!rows.length) {
    setWorkbenchReviewWarning("请先勾选需要导出的 Issue。", true);
    syncWorkbenchIssueHeaderControls();
    return;
  }
  const dataClient = window.sapdDataClient;
  if (!dataClient?.saveMarkdownExport) {
    window.alert("当前运行环境未提供 Issue 导出能力。");
    return;
  }
  state.workbenchIssueExporting = true;
  state.userNotesExportStatus = null;
  state.workbenchIssueExportStatus = { state: "running", message: `正在导出已选 ${formatNumber(rows.length)} 条 Issue...` };
  syncWorkbenchIssueHeaderControls();
  const markdown = workbenchIssueExportMarkdown(rows, "SAPD Wiki 所选 Issue");
  try {
    const result = await dataClient.saveMarkdownExport({
      filename_prefix: "sapd-issues-selected",
      content: markdown,
    });
    if (result?.ok === false) throw new Error(result.error || "导出失败");
    const outputPath = text(result?.output_path).trim();
    state.workbenchIssueExportStatus = {
      state: "success",
      message: outputPath ? `已导出所选 Issue 到：${outputPath}` : "已导出所选 Issue。",
      outputPath,
    };
  } catch (error) {
    console.warn("所选 Issue 导出失败", error);
    state.workbenchIssueExportStatus = { state: "error", message: `所选 Issue 导出失败：${text(error?.message || error) || "请检查应用服务是否可用"}` };
    window.alert(`所选 Issue 导出失败：${text(error?.message || error) || "请检查应用服务是否可用"}`);
  } finally {
    state.workbenchIssueExporting = false;
    syncWorkbenchIssueHeaderControls();
  }
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
  refreshUserNoteRuntimeIndex();
}

function removeNoteFromState(noteId) {
  const normalized = text(noteId).trim();
  state.userNotes = list(state.userNotes).filter((row) => text(row.id).trim() !== normalized);
  refreshUserNoteRuntimeIndex();
}

function annotationJumpFailureForCurrentPage() {
  const failure = state.annotationJumpFailure;
  if (!failure?.noteId) return null;
  const note = userNoteById(failure.noteId);
  if (!note || !annotationNoteMatchesCurrentPage(note, state.activeRoute)) return null;
  return failure;
}

function annotationDrawerFocusNoteId(options = {}) {
  const explicit = text(options.focusNoteId).trim();
  if (explicit) return explicit;
  const failure = annotationJumpFailureForCurrentPage();
  if (failure?.noteId) return text(failure.noteId).trim();
  const activeNoteId = text(state.activeUserNoteId).trim();
  if (activeNoteId) {
    const activeNote = userNoteById(activeNoteId);
    if (activeNote && annotationNoteMatchesCurrentPage(activeNote, state.activeRoute)) return activeNoteId;
  }
  return "";
}

function scrollAnnotationDrawerNoteIntoView(noteId, { attempts = 3 } = {}) {
  const targetNoteId = text(noteId).trim();
  if (!targetNoteId) return;
  const mount = $("userAnnotationMount");
  const panel = mount?.querySelector?.(".user-annotation-drawer.is-open .annotation-drawer-panel");
  const scroll = panel?.querySelector?.(".annotation-drawer-scroll");
  const card = Array.from(scroll?.querySelectorAll?.(".annotation-note-card[data-user-note-id]") || []).find((node) => text(node.dataset.userNoteId).trim() === targetNoteId);
  if (!scroll || !card) return;
  if (!card.open) card.open = true;
  const align = () => {
    const scrollRect = scroll.getBoundingClientRect();
    const cardRect = card.getBoundingClientRect();
    if (!scrollRect.height || !cardRect.height) return;
    const topGutter = 12;
    const bottomGutter = 18;
    const fullyVisible = cardRect.top >= scrollRect.top + topGutter && cardRect.bottom <= scrollRect.bottom - bottomGutter;
    if (fullyVisible) return;
    const nextTop = Math.max(0, scroll.scrollTop + cardRect.top - scrollRect.top - Math.max(topGutter, Math.round((scrollRect.height - Math.min(cardRect.height, scrollRect.height)) * 0.32)));
    scroll.scrollTo?.({ top: nextTop, behavior: "auto" });
    scroll.scrollTop = nextTop;
  };
  align();
  for (let index = 1; index < attempts; index += 1) {
    window.setTimeout(align, index * 80);
  }
}

const ANNOTATION_CAPABILITY_TAB_LABELS = {
  summary: "关系图谱",
  technical: "技术视角",
  management: "管理视角",
  standards: "标准 / 框架映射",
};

const ANNOTATION_MAINTENANCE_PAGE_LABELS = {
  "capability-directory": "安全能力清单",
  scopes: "安全能力作用域目录",
  services: "安全技术服务清单",
  modules: "安全技术模块/措施清单",
  measures: "安全技术模块/措施清单",
  "security-works": "安全管理工作/流程清单",
  processes: "安全管理工作/流程清单",
  "application-systems": "应用系统目录",
  "work-functions": "安全职能清单",
  references: "安全职能参考",
  standards: "安全标准 / 框架",
};

const ANNOTATION_OBJECT_TYPE_LABELS = {
  page: "页面",
  capability_category: "能力分类",
  capability_domain: "能力域",
  capability: "能力",
  capability_focus: "关注点",
  field_value: "值",
  table_row: "行",
  information_environment: "信息化环境",
  environment_segment: "环境子类",
  information_object: "信息化对象",
  environment_scope_tree: "作用域",
  security_technical_service: "安全技术服务",
  security_technology_module: "安全技术模块",
  security_technical_measure: "安全技术措施",
  security_system: "安全系统",
  lifecycle_application_stage: "LC-AP 阶段",
  lifecycle_data_process: "LC-DT 数据过程",
  security_guide: "安全指南",
  security_guide_slide: "幻灯片页",
  standard_framework: "标准 / 框架",
  standard_control: "标准控制项",
};

function annotationPageLabel(route = "") {
  const normalizedRoute = canonicalAnnotationRoute(route || state.activeRoute || "/");
  const routeInfo = window.sapdComponents?.AppShell?.getRouteInfo?.(normalizedRoute) || {};
  return text(routeInfo.item?.label || routeInfo.description || normalizedRoute).trim() || "当前页面";
}

function annotationObjectTypeLabel(value = "") {
  const normalized = text(value).trim();
  return ANNOTATION_OBJECT_TYPE_LABELS[normalized] || capabilityUserObjectLabel(normalized) || normalized || "业务对象";
}

function capabilityPathLabels(targetId = "") {
  const id = text(targetId).trim();
  if (!id) return [];
  const walk = (items, trail = []) => {
    for (const item of list(items)) {
      const label = codeTitle(item, item?.id || "能力对象");
      const nextTrail = [...trail, label].filter(Boolean);
      if (text(item?.id).trim() === id) return nextTrail;
      const childTrail = walk([...list(item?.domains), ...list(item?.capabilities), ...list(item?.focuses), ...list(item?.children)], nextTrail);
      if (childTrail.length) return childTrail;
    }
    return [];
  };
  return walk(state.capability?.categories || state.capabilityWorkbench?.navigator?.tree || []);
}

function environmentObjectPathLabels(targetId = "") {
  const id = text(targetId).trim();
  if (!id) return [];
  const tree = state.environmentWorkbenchViewModel?.navigationTree || state.environmentWorkbench?.navigator?.tree || state.environmentWorkbench?.navigationTree || [];
  const walk = (items, trail = []) => {
    for (const item of list(items)) {
      const label = codeTitle(item, item?.id || "环境对象");
      const nextTrail = [...trail, label].filter(Boolean);
      if (text(item?.id).trim() === id || text(item?.code).trim() === id) return nextTrail;
      const childTrail = walk([...list(item?.children), ...list(item?.segments), ...list(item?.objects)], nextTrail);
      if (childTrail.length) return childTrail;
    }
    return [];
  };
  return walk(tree);
}

function annotationBusinessContextParts(note = {}) {
  const route = canonicalAnnotationRoute(note.page_route || state.activeRoute || "/");
  const meta = legacyAnnotationTargetMeta(note.target_ref);
  const parts = [annotationPageLabel(route)];
  if (meta?.view === "capabilities") {
    const capabilityId = decodeLegacyAnchorPart(meta.context?.[2] || "");
    const capabilityPath = capabilityPathLabels(capabilityId).slice(-2);
    parts.push(...(capabilityPath.length ? capabilityPath : ["历史能力映射"]));
    const tab = decodeLegacyAnchorPart(meta.context?.[3] || "");
    if (tab && tab !== "_") parts.push(ANNOTATION_CAPABILITY_TAB_LABELS[tab] || tab);
  } else if (meta?.view === "maintenance") {
    const maintenancePage = decodeLegacyAnchorPart(meta.context?.[2] || "");
    const framework = decodeLegacyAnchorPart(meta.context?.[4] || "");
    if (maintenancePage && maintenancePage !== "_") parts.push(ANNOTATION_MAINTENANCE_PAGE_LABELS[maintenancePage] || maintenancePage);
    if (framework && framework !== "_") parts.push(framework);
  } else if (meta?.view === "dev-lifecycle" || route === "/development-security") {
    const processId = decodeLegacyAnchorPart(meta?.context?.[2] || "");
    parts.push(processId && processId !== "_" ? processId : "LC-AP 阶段");
  } else if (meta?.view === "data-lifecycle" || route === "/data-security") {
    const processId = decodeLegacyAnchorPart(meta?.context?.[2] || "");
    parts.push(processId && processId !== "_" ? processId : "LC-DT 数据过程");
  } else if (route === "/environment-mapping") {
    const objectPath = environmentObjectPathLabels(note.object_id || note.object_code || "");
    parts.push(...(objectPath.length ? objectPath.slice(-2) : [annotationObjectTypeLabel(note.object_type)]));
  } else if (route.startsWith("/guides/")) {
    parts.push(annotationObjectTypeLabel(note.object_type || meta?.objectType || "security_guide"));
  } else {
    parts.push(annotationObjectTypeLabel(note.object_type || meta?.objectType));
  }
  return uniqueBy(parts.map((part) => text(part).trim()).filter(Boolean), (part) => part);
}

function annotationNoteContextForDrawer(note = {}) {
  const route = canonicalAnnotationRoute(note.page_route || state.activeRoute || "/");
  const meta = legacyAnnotationTargetMeta(note.target_ref);
  const objectType = text(note.object_type || meta?.objectType || annotationTargetRefObjectType(note.target_ref)).trim();
  const anchorType = normalizedAnnotationAnchorType(note.anchor_type || annotationAnchorTypeFromTargetRef(note.target_ref)) || "object";
  const pathParts = annotationBusinessContextParts(note);
  const targetLabel = text(note.object_title || note.object_code || note.page_title || note.target_ref).trim();
  const detailParts = [
    annotationObjectTypeLabel(objectType),
    anchorType === "field" ? "值级 Issue" : anchorType === "row" ? "行级 Issue" : anchorType === "page" ? "页面 Issue" : "对象 Issue",
    targetLabel,
  ].filter(Boolean);
  return {
    pageLabel: pathParts[0] || annotationPageLabel(route),
    pathLabel: pathParts.join(" / "),
    detailLabel: uniqueBy(detailParts, (part) => compactAnnotationLookupText(part)).join(" · "),
    targetLabel,
  };
}

function annotationNoteContextsForDrawer(notes = []) {
  return Object.fromEntries(list(notes).map((note) => [text(note.id).trim(), annotationNoteContextForDrawer(note)]).filter(([id]) => id));
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
  const focusNoteId = annotationDrawerFocusNoteId(options);
  if (focusNoteId) state.userAnnotationExpandedNoteIds.add(focusNoteId);
  const target = state.activeUserTarget || state.activePageAnnotationTarget || currentPageAnnotationTarget();
  const pageTarget = state.activePageAnnotationTarget || currentPageAnnotationTarget();
  setHtml(
    "userAnnotationMount",
    components.UserAnnotationDrawer.render({
      open: state.userAnnotationDrawerOpen,
      target,
      pageTarget,
      notes: state.userNotes,
      noteContexts: annotationNoteContextsForDrawer(userNotesForPageRoute(pageTarget?.code || state.activeRoute || "/")),
      favorite: favoriteForTarget(target?.targetRef),
      status: state.userWriteStatus,
      draft: state.userAnnotationDraft,
      editingNoteId: state.userAnnotationEditingNoteId,
      editDraft: state.userAnnotationEditDraft,
      expandedNoteIds: Array.from(state.userAnnotationExpandedNoteIds),
      currentNoteId: focusNoteId,
      pendingTargetLabel: state.pendingAnnotationTargetLabel,
      contextMenu: state.annotationContextMenu,
      jumpFailure: annotationJumpFailureForCurrentPage(),
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
    if (options.preserveScroll && !focusNoteId) {
      const nextPanel = mount.querySelector(".annotation-drawer-scroll");
      if (nextPanel) nextPanel.scrollTop = previousPanelScrollTop;
    }
    if (nextOpen && focusNoteId) scrollAnnotationDrawerNoteIntoView(focusNoteId);
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
    console.warn("用户 Issue 保存失败", error);
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
    console.warn("用户 Issue 状态保存失败", error);
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
    console.warn("用户 Issue 修改失败", error);
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
    console.warn("用户 Issue 删除失败", error);
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
    supplementalPackages: ["capability", "environmentWorkbench"],
    supplementalSections: ["scopes", "modules", "measures"],
  },
  modules: {
    requiredPackages: ["sharedLookups"],
    requiredSections: ["modules"],
    supplementalPackages: ["environmentWorkbench"],
    supplementalSections: ["services", "scopes"],
  },
  measures: {
    requiredPackages: [],
    requiredSections: ["measures"],
    supplementalPackages: ["environmentWorkbench"],
    supplementalSections: ["services", "scopes"],
  },
  "security-works": {
    requiredPackages: [],
    requiredSections: ["security-works"],
    supplementalPackages: ["capability"],
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
  "security-works": ["security_works"],
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

function environmentManagementForMaintenance(viewModels) {
  if (!state.environmentWorkbench || state.environmentWorkbench.__data_state === "missing_file") return {};
  const environmentWorkbenchViewModel = viewModels?.buildEnvironmentWorkbenchViewModel?.({ workbench: state.environmentWorkbench });
  const environmentManagement = viewModels?.buildEnvironmentManagementFromWorkbench?.(environmentWorkbenchViewModel) || {};
  return {
    environment_scope_tree: list(environmentManagement.environment_scope_tree),
  };
}

function maintenanceManagementForViewModel(viewModels) {
  const base = mergeSharedLookups(state.maintenanceKnowledge || { ...(state.maintenanceIndex || {}), maintenance_index: state.maintenanceIndex });
  const environmentManagement = environmentManagementForMaintenance(viewModels);
  if (!list(environmentManagement.environment_scope_tree).length) return base;
  return {
    ...base,
    environment_scope_tree: environmentManagement.environment_scope_tree,
  };
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

function standardFrameworkLoadError(key) {
  return state.standardFrameworkLoadErrors.get(key) || "";
}

function setStandardFrameworkLoadError(key, error) {
  if (!key) return;
  const message = error?.message || String(error || "标准 / 框架数据加载失败");
  state.standardFrameworkLoadErrors.set(key, message);
}

function clearStandardFrameworkLoadError(key) {
  if (!key) return;
  state.standardFrameworkLoadErrors.delete(key);
}

function ensureStandardFrameworkTableLoaded(frameworkId, tableId) {
  const framework = loadedStandardFramework(frameworkId);
  const table = standardTableById(framework, tableId);
  if (!framework || !table || standardTableHasRows(table) || !table.dataPath) return false;
  const loadKey = `${frameworkId}:${tableId}`;
  if (state.standardFrameworkLoads.has(loadKey)) return true;
  const dataClient = window.sapdDataClient;
  if (!dataClient?.getStandardFrameworkTable) return false;
  const loadPromise = dataClient
    .getStandardFrameworkTable(frameworkId, tableId)
    .then((envelope) => {
      clearStandardFrameworkLoadError(loadKey);
      mergeLoadedStandardFrameworkTable(frameworkId, envelope?.data || table);
    })
    .catch((error) => {
      console.warn(`标准 / 框架表格加载失败：${loadKey}`, error);
      setStandardFrameworkLoadError(loadKey, error);
    })
    .finally(() => {
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
    const slideWidth = Number(packageSlides.width || row?.slide_width || 16);
    const slideHeight = Number(packageSlides.height || row?.slide_height || 9);
    return Array.from({ length: Number(packageSlides.count) }, (_, index) => ({
      pageNumber: index + 1,
      title: `第 ${index + 1} 页`,
      image: text(packageSlides.path_pattern).replace("{n}", String(index + 1).padStart(3, "0")),
      width: slideWidth,
      height: slideHeight,
    }));
  }
  const explicitSlides = list(row?.slides);
  if (explicitSlides.length) {
    return explicitSlides.map((slide, index) => ({
      pageNumber: Number(slide.pageNumber || slide.slide_number || index + 1),
      title: text(slide.title || `第 ${index + 1} 页`),
      image: text(slide.image || slide.preview_path || slide.path),
      width: Number(slide.width || row?.slide_width || 16),
      height: Number(slide.height || row?.slide_height || 9),
    }));
  }
  const count = Number(row?.slide_count || 0);
  if (!count || !row?.slide_path_pattern) return [];
  const slideWidth = Number(row?.slide_width || 16);
  const slideHeight = Number(row?.slide_height || 9);
  return Array.from({ length: count }, (_, index) => ({
    pageNumber: index + 1,
    title: `第 ${index + 1} 页`,
    image: slideImagePath(row, index + 1),
    width: slideWidth,
    height: slideHeight,
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

function activateContentSlideStep(slideStep, event = null) {
  if (!slideStep) return false;
  event?.preventDefault?.();
  event?.stopPropagation?.();
  if (slideStep.disabled || slideStep.getAttribute("aria-disabled") === "true") return true;
  slideStep.blur?.();
  changeContentSlide(Number(slideStep.dataset.contentSlideStep || 0), "active");
  window.setTimeout(persistWorkspaceState, 0);
  return true;
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
  const slideWidth = Math.max(1, Number(activeSlide.width || row?.slide_width || 16));
  const slideHeight = Math.max(1, Number(activeSlide.height || row?.slide_height || 9));
  const slideRatio = slideWidth / slideHeight;
  const slideStyle = `--guide-slide-aspect:${slideWidth} / ${slideHeight};--guide-slide-ratio:${slideRatio.toFixed(6)};`;
  return `
    <div class="guide-slide-player" data-guide-id="${escapeHtml(row.id)}">
      <div class="guide-slide-stage" tabindex="0" aria-label="${escapeHtml(`${row.title || "指南"}第 ${activeSlide.pageNumber} 页`)}" data-annotation-slide-stage="true" style="${escapeHtml(slideStyle)}" ${slideTargetAttrs}>
        <img src="${escapeHtml(activeSlide.image)}" alt="${escapeHtml(activeSlide.title)}" loading="eager" />
      </div>
      <div class="guide-slide-controls" data-content-slide-controls="true" aria-label="幻灯片翻页控制">
        <button class="guide-slide-arrow" type="button" data-content-slide-step="-1" aria-label="上一页" title="上一页" ${previousDisabled}>
          <span aria-hidden="true">‹</span>
        </button>
        <span class="guide-slide-page">第 ${activeSlide.pageNumber} / ${slides.length} 页</span>
        <button class="guide-slide-arrow" type="button" data-content-slide-step="1" aria-label="下一页" title="下一页" ${nextDisabled}>
          <span aria-hidden="true">›</span>
        </button>
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

function renderDashboardWorkbenchEntry() {
  if (!state.userNotesLoaded && !state.userNotesLoadPromise) ensureUserNotesLoaded();
  const issueSummary = workbenchIssueSummary();
  const latestIssue = issueSummary.latestIssue;
  return `
    <section class="dashboard-workbench-entry" aria-label="工作台入口">
      <div class="dashboard-workbench-copy">
        <span class="dashboard-chip">工作台</span>
        <h3>Issue 与成熟度评估工作入口</h3>
        <p>集中处理页面 Issue、继续客户成熟度评估项目。Issue 数据来自本地用户库。</p>
        <div class="dashboard-workbench-meta">
          <span><strong>${escapeHtml(formatNumber(issueSummary.todoCount))}</strong> 待处理 Issue</span>
          <span><strong>1</strong> 暂存评估</span>
          <span><strong>${escapeHtml(latestIssue?.updated || "-")}</strong> 最近更新</span>
        </div>
      </div>
      <div class="dashboard-workbench-actions">
        <button type="button" class="dashboard-workbench-card" data-app-route="/workbench/annotations">
          <span>Issue 清单</span>
          <strong>${escapeHtml(formatNumber(issueSummary.total))} 条真实 Issue</strong>
          <small>${escapeHtml(latestIssue?.title || "筛选、编辑、流转和导出")}</small>
        </button>
        <button type="button" class="dashboard-workbench-card" data-app-route="/workbench/maturity">
          <span>成熟度评估</span>
          <strong>评估工作与历史项目</strong>
          <small>暂存、编辑和导出占位</small>
        </button>
      </div>
    </section>
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
        <div class="dashboard-hero-side">
          <div class="dashboard-state">
            <span>${escapeHtml(summary.dataState)}</span>
            <strong>${escapeHtml(formatNumber(summary.totalFocuses))}</strong>
            <small>能力关注点</small>
          </div>
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
      ${renderDashboardWorkbenchEntry()}
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
    `,
  );
}

function workbenchRouteType(route = state.activeRoute) {
  const normalized = normalizeAppRoute(route);
  if (normalized === "/workbench/annotations") return "issues";
  if (normalized === "/workbench/maturity") return "maturity";
  if (normalized.startsWith("/workbench/maturity/")) return "maturity-project";
  return "home";
}

function renderWorkbenchHome() {
  if (!state.userNotesLoaded && !state.userNotesLoadPromise) ensureUserNotesLoaded();
  const issueRows = workbenchAllIssueRows();
  const issueSummary = workbenchIssueSummary(issueRows);
  const recentIssues = issueRows.slice(0, 3);
  return `
    <section class="workbench-route-page" aria-label="工作台首页">
      <div class="workbench-section-title">
        <div>
          <h3>工作台</h3>
          <span>模块总入口，只承接入口和最近动态。</span>
        </div>
        <span>Issue data / local user DB</span>
      </div>
      <div class="workbench-prototype-grid is-two">
        <button class="workbench-prototype-card is-entry" type="button" data-app-route="/workbench/maturity">
          <span class="workbench-prototype-pill is-good">成熟度评估</span>
          <h3>管理客户评估项目</h3>
          <p>包含当前评估工作、状态暂存、历史项目查询、编辑和导出占位。</p>
          <div class="workbench-prototype-chip-row">
            <span class="workbench-prototype-pill is-warn">1 暂存</span>
            <span class="workbench-prototype-pill">3 项目</span>
          </div>
        </button>
        <button class="workbench-prototype-card is-entry" type="button" data-app-route="/workbench/annotations">
          <span class="workbench-prototype-pill">Issue 清单</span>
          <h3>处理全局 Issue</h3>
          <p>汇总本地用户库中的真实 Issue，支持状态筛选、页面分组、详情查看和导出占位。</p>
          <div class="workbench-prototype-chip-row">
            <span class="workbench-prototype-pill is-warn">${escapeHtml(formatNumber(issueSummary.todoCount))} 待处理</span>
            <span class="workbench-prototype-pill">${escapeHtml(formatNumber(issueSummary.total))} 全部</span>
          </div>
        </button>
      </div>
      <div class="workbench-prototype-grid is-two">
        <section class="workbench-prototype-panel">
          <div class="workbench-section-title"><h3>最近 Issue</h3><span>只展示摘要</span></div>
          ${
            recentIssues.length
              ? recentIssues
                  .map(
                    (issue, index) =>
                      `<button class="workbench-prototype-row ${index === 0 ? "is-active" : ""}" type="button" data-app-route="/workbench/annotations"><span>${escapeHtml(issue.page)}</span><strong>${escapeHtml(issue.title)}</strong></button>`,
                  )
                  .join("")
              : `<div class="workbench-review-empty">当前没有真实 Issue。</div>`
          }
        </section>
        <section class="workbench-prototype-panel">
          <div class="workbench-section-title"><h3>最近评估项目</h3><span>项目状态</span></div>
          <button class="workbench-prototype-row is-active" type="button" data-app-route="/workbench/maturity/project-001"><span>华东政企云</span><strong>L3 / 72 / 草稿</strong></button>
          <button class="workbench-prototype-row" type="button" data-app-route="/workbench/maturity"><span>制造集团数据域</span><strong>L2 / 61 / 已完成</strong></button>
          <button class="workbench-prototype-row" type="button" data-app-route="/workbench/maturity"><span>金融数据平台</span><strong>L3 / 76 / 已导出</strong></button>
        </section>
      </div>
    </section>
  `;
}

const WORKBENCH_ISSUE_STATUS_LABELS = {
  todo: "待处理",
  reviewing: "处理中",
  waiting_confirm: "待确认",
  confirmed: "已采纳",
  closed: "已关闭",
  deferred: "已忽略",
};

const WORKBENCH_ISSUE_STATUS_BY_LABEL = Object.fromEntries(
  Object.entries(WORKBENCH_ISSUE_STATUS_LABELS).map(([value, label]) => [label, value]),
);

const WORKBENCH_ISSUE_STATUS_SORT_ORDER = {
  todo: 10,
  reviewing: 20,
  waiting_confirm: 30,
  confirmed: 40,
  deferred: 50,
  closed: 60,
};

const WORKBENCH_ISSUE_PRIORITY_SORT_ORDER = { "未标注": 10, "低": 20, "中": 30, "高": 40 };

const WORKBENCH_ISSUE_PRIORITY_VALUES = ["未标注", "低", "中", "高"];
const WORKBENCH_ISSUE_PRIORITY_TAGS = ["高优先级", "中优先级", "低优先级"];

const WORKBENCH_ISSUE_SORT_COLUMNS = [
  { key: "title", label: "Issue", type: "text", defaultDirection: "asc" },
  { key: "pageObject", label: "所属页面 / 对象", type: "text", defaultDirection: "asc" },
  { key: "status", label: "状态", type: "workflow", defaultDirection: "asc" },
  { key: "priority", label: "优先级", type: "priority", defaultDirection: "asc" },
  { key: "updated", label: "更新时间", type: "time", defaultDirection: "desc" },
];

const WORKBENCH_ISSUE_SORT_COLUMN_MAP = Object.fromEntries(WORKBENCH_ISSUE_SORT_COLUMNS.map((column) => [column.key, column]));

function workbenchIssueStatusLabel(status = "") {
  const normalized = text(status || "todo").trim();
  return WORKBENCH_ISSUE_STATUS_LABELS[normalized] || WORKBENCH_ISSUE_STATUS_LABELS.todo;
}

function workbenchIssueStatusValue(labelOrValue = "") {
  const normalized = text(labelOrValue || "todo").trim();
  return WORKBENCH_ISSUE_STATUS_LABELS[normalized] ? normalized : WORKBENCH_ISSUE_STATUS_BY_LABEL[normalized] || "todo";
}

function workbenchIssueShortText(value = "", maxLength = 72) {
  const normalized = text(value).replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, Math.max(1, maxLength - 1))}…`;
}

function workbenchIssueUpdatedLabel(note = {}) {
  const raw = text(note.updated_at || note.created_at).trim();
  if (!raw) return "-";
  const normalized = raw.replace("T", " ").replace("Z", "");
  return normalized.slice(0, 16);
}

function workbenchIssueTagList(note = {}) {
  return list(note.tags).map((item) => text(item).trim()).filter(Boolean);
}

function workbenchIssuePriority(note = {}) {
  const tags = workbenchIssueTagList(note);
  if (tags.includes("高优先级")) return "高";
  if (tags.includes("中优先级")) return "中";
  if (tags.includes("低优先级")) return "低";
  const haystack = [note.priority, note.severity, note.body, note.object_title, ...tags].map(text).join(" ");
  if (/(高优先级|紧急|严重|阻塞|P0|P1|high|urgent|blocker)/i.test(haystack)) return "高";
  if (/(中优先级|中等优先级|P2|medium|normal)/i.test(haystack)) return "中";
  if (/(低优先级|可后置|low|later)/i.test(haystack)) return "低";
  return "未标注";
}

function workbenchIssueTagsWithPriority(tags = [], priority = "未标注") {
  const normalizedPriority = text(priority || "未标注").trim() || "未标注";
  const nextTags = list(tags)
    .map((item) => text(item).trim())
    .filter((item) => item && !WORKBENCH_ISSUE_PRIORITY_TAGS.includes(item));
  if (normalizedPriority === "高") nextTags.push("高优先级");
  if (normalizedPriority === "中") nextTags.push("中优先级");
  if (normalizedPriority === "低") nextTags.push("低优先级");
  return Array.from(new Set(nextTags));
}

function workbenchIssueTitle(note = {}, index = 0) {
  return workbenchIssueShortText(note.object_title || note.page_title || note.target_ref || `Issue #${index + 1}`, 48);
}

function workbenchIssueObjectLabel(note = {}) {
  const context = annotationNoteContextForDrawer(note);
  return text(context.detailLabel || note.object_title || note.object_type || note.target_ref || "业务对象").trim();
}

function workbenchIssuePageLabel(note = {}) {
  return text(note.page_title || annotationNoteContextForDrawer(note).pageLabel || annotationPageLabel(note.page_route) || note.page_route || "未命名页面").trim();
}

function workbenchIssueTagsLabel(note = {}) {
  const tags = workbenchIssueTagList(note);
  return tags.length ? tags.join(" / ") : "无标签";
}

function workbenchAllIssueRows() {
  const rows = list(state.userNotes)
    .map((note, index) => {
      const statusValue = workbenchIssueStatusValue(note.status);
      const status = workbenchIssueStatusLabel(statusValue);
      const title = workbenchIssueTitle(note, index);
      const body = text(note.body).trim();
      const page = workbenchIssuePageLabel(note);
      const pageRoute = canonicalAnnotationRoute(note.page_route || "/");
      const object = workbenchIssueObjectLabel(note);
      const priority = workbenchIssuePriority(note);
      return {
        id: text(note.id).trim(),
        note,
        title,
        summary: workbenchIssueShortText(body || object || page, 76),
        body,
        page,
        pageRoute,
        object,
        status,
        statusValue,
        priority,
        updated: workbenchIssueUpdatedLabel(note),
        created: workbenchIssueUpdatedLabel({ updated_at: note.created_at }),
        anchorType: text(note.anchor_type || "object").trim() || "object",
        objectType: text(note.object_type || "").trim() || "unknown",
        tags: workbenchIssueTagsLabel(note),
        tagsList: workbenchIssueTagList(note),
      };
    })
    .filter((row) => row.id);
  return rows.sort(compareWorkbenchIssueRows);
}

function workbenchIssueDateValue(issue = {}) {
  const raw = text(issue.note?.updated_at || issue.note?.created_at || issue.updated).trim();
  const timestamp = raw ? Date.parse(raw) : NaN;
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function workbenchIssueSortText(issue = {}, key = "title") {
  if (key === "pageObject") return `${text(issue.page)} ${text(issue.object)}`.trim();
  return text(issue[key]).trim();
}

function workbenchIssueSortRank(issue = {}, key = "updated") {
  if (key === "updated") return workbenchIssueDateValue(issue);
  if (key === "status") return WORKBENCH_ISSUE_STATUS_SORT_ORDER[issue.statusValue] ?? 999;
  if (key === "priority") return WORKBENCH_ISSUE_PRIORITY_SORT_ORDER[issue.priority] ?? 999;
  return workbenchIssueSortText(issue, key);
}

function compareWorkbenchIssueRows(left, right) {
  const key = WORKBENCH_ISSUE_SORT_COLUMN_MAP[state.workbenchIssueSortKey]?.key || "updated";
  const direction = state.workbenchIssueSortDirection === "asc" ? 1 : -1;
  const leftValue = workbenchIssueSortRank(left, key);
  const rightValue = workbenchIssueSortRank(right, key);
  let result = 0;
  if (typeof leftValue === "number" && typeof rightValue === "number") result = leftValue - rightValue;
  else result = text(leftValue).localeCompare(text(rightValue), "zh-Hans-CN", { numeric: true, sensitivity: "base" });
  if (result !== 0) return result * direction;
  return (
    text(left.title).localeCompare(text(right.title), "zh-Hans-CN", { numeric: true, sensitivity: "base" }) ||
    text(left.id).localeCompare(text(right.id), "zh-Hans-CN")
  );
}

function setWorkbenchIssueSort(key = "updated") {
  const column = WORKBENCH_ISSUE_SORT_COLUMN_MAP[key] || WORKBENCH_ISSUE_SORT_COLUMN_MAP.updated;
  if (state.workbenchIssueSortKey === column.key) {
    state.workbenchIssueSortDirection = state.workbenchIssueSortDirection === "asc" ? "desc" : "asc";
  } else {
    state.workbenchIssueSortKey = column.key;
    state.workbenchIssueSortDirection = column.defaultDirection || "asc";
  }
  state.workbenchPendingDeleteIssueId = "";
}

function workbenchIssueById(noteId = "") {
  const normalized = text(noteId).trim();
  if (!normalized) return null;
  return workbenchAllIssueRows().find((issue) => issue.id === normalized) || null;
}

function workbenchIssueMatchesFilters(issue) {
  const statusFilter = text(state.workbenchIssueStatusFilter || "全部").trim();
  const pageFilter = text(state.workbenchIssuePageFilter || "全部").trim();
  const priorityFilter = text(state.workbenchIssuePriorityFilter || "全部").trim();
  const query = compactAnnotationLookupText(state.workbenchIssueSearch || "");
  if (statusFilter && statusFilter !== "全部" && issue.status !== statusFilter) return false;
  if (pageFilter && pageFilter !== "全部" && issue.pageRoute !== pageFilter) return false;
  if (priorityFilter && priorityFilter !== "全部" && issue.priority !== priorityFilter) return false;
  if (query) {
    const haystack = compactAnnotationLookupText(
      [issue.title, issue.summary, issue.body, issue.page, issue.object, issue.tags, issue.status, issue.priority].join(" "),
    );
    if (!haystack.includes(query)) return false;
  }
  return true;
}

function workbenchIssueRows() {
  const rows = workbenchAllIssueRows();
  const filteredRows = rows.filter(workbenchIssueMatchesFilters);
  const selectedStillVisible = filteredRows.some((issue) => issue.id === state.workbenchSelectedIssueId);
  if (!selectedStillVisible) state.workbenchSelectedIssueId = "";
  const visibleIds = new Set(filteredRows.map((issue) => issue.id));
  for (const noteId of Array.from(state.workbenchSelectedIssueIds || [])) {
    if (!visibleIds.has(noteId)) state.workbenchSelectedIssueIds.delete(noteId);
  }
  return filteredRows.map((issue) => ({
    ...issue,
    selected: Boolean(state.workbenchSelectedIssueId) && issue.id === state.workbenchSelectedIssueId,
    checked: state.workbenchSelectedIssueIds?.has(issue.id) || false,
  }));
}

function workbenchIssueSummary(rows = workbenchAllIssueRows()) {
  const statusCount = (statusLabel) => rows.filter((issue) => issue.status === statusLabel).length;
  const highCount = rows.filter((issue) => issue.priority === "高").length;
  return {
    total: rows.length,
    todoCount: statusCount("待处理"),
    reviewingCount: statusCount("处理中"),
    confirmedCount: statusCount("已采纳"),
    ignoredCount: statusCount("已忽略"),
    closedCount: statusCount("已关闭"),
    waitingCount: statusCount("待确认"),
    highCount,
    latestIssue: rows[0] || null,
  };
}

function renderWorkbenchIssueStatusCapsules(summary = workbenchIssueSummary()) {
  const activeStatusFilter = state.workbenchIssueStatusFilter || "全部";
  const activePriorityFilter = state.workbenchIssuePriorityFilter || "全部";
  return [
    ["全部", summary.total, activeStatusFilter === "全部" && activePriorityFilter === "全部"],
    ["待处理", summary.todoCount, activeStatusFilter === "待处理"],
    ["处理中", summary.reviewingCount, activeStatusFilter === "处理中"],
    ["已采纳", summary.confirmedCount, activeStatusFilter === "已采纳"],
    ["已忽略", summary.ignoredCount, activeStatusFilter === "已忽略"],
    ["高优先级", summary.highCount, activePriorityFilter === "高"],
  ]
    .map(
      ([label, value, active]) =>
        `<button class="workbench-review-stat ${active ? "is-active" : ""}" type="button" data-review-filter="${escapeHtml(label)}"><span>${escapeHtml(label)}</span><strong>${escapeHtml(formatNumber(value))}</strong></button>`,
    )
    .join("");
}

function renderWorkbenchExportStatus() {
  const status = state.workbenchIssueExportStatus || state.userNotesExportStatus;
  if (!status?.message) return "";
  const statusName = text(status.state || "idle").trim();
  return `<div class="workbench-export-status ${statusName ? `is-${escapeHtml(statusName)}` : ""}" title="${escapeHtml(status.outputPath || status.message)}">${escapeHtml(status.message)}</div>`;
}

function syncWorkbenchIssueHeaderControls() {
  const statsHost = $("workbenchIssueHeaderStats");
  const actionsHost = $("workbenchIssueHeaderActions");
  if (!statsHost && !actionsHost) return;
  if (state.activeRoute !== "/workbench/annotations") {
    if (statsHost) statsHost.innerHTML = "";
    if (actionsHost) actionsHost.innerHTML = "";
    return;
  }
  if (statsHost) statsHost.innerHTML = renderWorkbenchIssueStatusCapsules(workbenchIssueSummary(workbenchAllIssueRows()));
  if (actionsHost) {
    const selectedCount = state.workbenchSelectedIssueIds?.size || 0;
    const exporting = Boolean(state.userNotesExporting || state.workbenchIssueExporting);
    const selectedLabel = state.workbenchIssueExporting ? "导出中..." : `导出所选${selectedCount ? ` ${escapeHtml(formatNumber(selectedCount))}` : ""}`;
    actionsHost.innerHTML = `
      <button class="workbench-prototype-action" type="button" data-user-notes-export>导出全部</button>
      <button class="workbench-prototype-action is-secondary ${state.workbenchIssueExporting ? "is-exporting" : ""}" type="button" data-review-export-selected ${selectedCount && !exporting ? "" : "disabled"} title="${selectedCount ? `导出已选 ${selectedCount} 条 Issue` : "请先勾选需要导出的 Issue"}">${selectedLabel}</button>
      ${renderWorkbenchExportStatus()}
    `;
    syncUserNotesExportButton();
  }
}

function workbenchIssuePageGroups(rows = workbenchAllIssueRows()) {
  const groups = new Map();
  for (const issue of rows) {
    const key = issue.pageRoute || "全部";
    const current = groups.get(key) || { page: issue.page, pageRoute: key, total: 0, todo: 0, latest: "" };
    current.total += 1;
    if (issue.status === "待处理") current.todo += 1;
    current.latest = [current.latest, issue.updated].filter(Boolean).sort().at(-1) || issue.updated;
    groups.set(key, current);
  }
  return Array.from(groups.values()).sort((a, b) => b.total - a.total || a.page.localeCompare(b.page, "zh-Hans-CN"));
}

function workbenchReviewPillTone(value, kind = "status") {
  const normalized = text(value).trim();
  if (kind === "priority") {
    if (normalized === "高") return "is-warn";
    if (normalized === "低") return "is-muted";
    return "";
  }
  if (normalized === "已采纳") return "is-good";
  if (normalized === "待处理" || normalized === "已忽略" || normalized === "已关闭") return "is-muted";
  return "";
}

function renderWorkbenchPill(value, kind = "status") {
  const tone = workbenchReviewPillTone(value, kind);
  return `<span class="workbench-prototype-pill${tone ? ` ${tone}` : ""}">${escapeHtml(value)}</span>`;
}

function renderWorkbenchIssueSortableHead(column) {
  const active = state.workbenchIssueSortKey === column.key;
  const direction = active ? state.workbenchIssueSortDirection : column.defaultDirection;
  const arrow = active ? (direction === "asc" ? "↑" : "↓") : "↕";
  return `
    <button class="workbench-review-sort-button ${active ? "is-active" : ""}" type="button"
      data-review-sort-key="${escapeHtml(column.key)}"
      aria-label="按${escapeHtml(column.label)}排序，当前排序类型：${escapeHtml(column.type)}">
      <span>${escapeHtml(column.label)}</span><small>${escapeHtml(arrow)}</small>
    </button>
  `;
}

function renderWorkbenchIssueQueueHead(issues = []) {
  const selectedVisibleCount = issues.filter((issue) => state.workbenchSelectedIssueIds?.has(issue.id)).length;
  const allVisibleSelected = Boolean(issues.length) && selectedVisibleCount === issues.length;
  return `
    <div class="workbench-review-queue-head" role="row">
      <label class="workbench-review-select-all-shell" title="全选或取消当前筛选下的 Issue">
        <input class="workbench-review-select-all" type="checkbox" data-review-select-all aria-label="全选或取消当前筛选下的 Issue"${allVisibleSelected ? " checked" : ""} />
      </label>
      ${WORKBENCH_ISSUE_SORT_COLUMNS.map(renderWorkbenchIssueSortableHead).join("")}
    </div>
  `;
}

function renderWorkbenchIssueItem(issue, index) {
  return `
    <article class="workbench-review-item ${issue.selected ? "is-active" : ""} ${issue.checked ? "is-checked" : ""}" role="button" tabindex="0" data-review-item
      data-note-id="${escapeHtml(issue.id)}"
      data-title="${escapeHtml(issue.title)}"
      data-body="${escapeHtml(issue.body)}"
      data-page="${escapeHtml(issue.page)}"
      data-page-route="${escapeHtml(issue.pageRoute)}"
      data-object="${escapeHtml(issue.object)}"
      data-status="${escapeHtml(issue.status)}"
      data-status-value="${escapeHtml(issue.statusValue)}"
      data-priority="${escapeHtml(issue.priority)}"
      data-anchor-type="${escapeHtml(issue.anchorType)}"
      data-object-type="${escapeHtml(issue.objectType)}"
      data-tags="${escapeHtml(issue.tags)}"
      data-created="${escapeHtml(issue.created)}"
      data-updated="${escapeHtml(issue.updated)}">
      <input class="workbench-review-checkbox" type="checkbox" aria-label="选择 ${escapeHtml(issue.title)}" data-note-id="${escapeHtml(issue.id)}"${issue.checked ? " checked" : ""} />
      <span class="workbench-review-item-title"><strong>${escapeHtml(issue.title)}</strong><span>${escapeHtml(issue.summary)}</span></span>
      <span class="workbench-review-item-meta">${escapeHtml(issue.page)}<br />${escapeHtml(issue.object)}</span>
      ${renderWorkbenchPill(issue.status)}
      ${renderWorkbenchPill(issue.priority, "priority")}
      <span class="workbench-review-item-meta">${escapeHtml(issue.updated || `#${index + 1}`)}</span>
    </article>
  `;
}

function workbenchIssuePageObjectLabel(issue = {}) {
  return [issue.page, issue.object].map((item) => text(item).trim()).filter(Boolean).join(" / ") || "-";
}

function renderWorkbenchIssueStatusOptions(activeStatusValue = "todo") {
  return Object.entries(WORKBENCH_ISSUE_STATUS_LABELS)
    .map(([value, label]) => `<option value="${escapeHtml(value)}"${value === activeStatusValue ? " selected" : ""}>${escapeHtml(label)}</option>`)
    .join("");
}

function renderWorkbenchIssuePriorityOptions(activePriority = "未标注") {
  return WORKBENCH_ISSUE_PRIORITY_VALUES
    .map((value) => `<option value="${escapeHtml(value)}"${value === activePriority ? " selected" : ""}>${escapeHtml(value)}</option>`)
    .join("");
}

function renderWorkbenchIssueDeleteDialog() {
  const issue = workbenchIssueById(state.workbenchPendingDeleteIssueId);
  if (!issue?.id) return "";
  const title = escapeHtml(issue.title || "当前 Issue");
  return `<div class="workbench-review-dialog-backdrop" data-review-delete-backdrop><section class="workbench-review-dialog" role="dialog" aria-modal="true" aria-labelledby="workbenchReviewDeleteTitle" aria-describedby="workbenchReviewDeleteDescription"><span class="workbench-review-dialog-kicker">删除确认</span><h3 id="workbenchReviewDeleteTitle">删除 Issue</h3><p id="workbenchReviewDeleteDescription">确认删除「${title}」？此操作会写入本地用户库，删除后不会再出现在 Issue 清单。</p><div class="workbench-review-dialog-actions"><button class="workbench-prototype-action is-secondary" type="button" data-review-delete-cancel>取消</button><button class="workbench-prototype-action is-danger" type="button" data-review-delete-confirm>确认删除</button></div></section></div>`;
}

function renderWorkbenchIssueDetailInspector(issue = {}) {
  return `
    <div class="workbench-review-form">
      <div class="workbench-review-field"><label>Issue 标题</label><input class="workbench-review-input" value="${escapeHtml(issue.title)}" data-review-field="title" readonly /></div>
      <div class="workbench-review-field"><label>Issue 内容</label><textarea class="workbench-review-textarea" data-review-field="body">${escapeHtml(issue.body)}</textarea></div>
      <div class="workbench-review-form-row">
        <div class="workbench-review-field"><label>状态</label><select class="workbench-review-select" data-review-field="status">${renderWorkbenchIssueStatusOptions(issue.statusValue)}</select></div>
        <div class="workbench-review-field"><label>优先级</label><select class="workbench-review-select" data-review-field="priority">${renderWorkbenchIssuePriorityOptions(issue.priority)}</select></div>
      </div>
      <div class="workbench-review-field"><label>关联页面/对象</label><span class="workbench-review-field-value" data-review-field="pageObject">${escapeHtml(workbenchIssuePageObjectLabel(issue))}</span></div>
      <div class="workbench-review-field"><label>标签</label><span class="workbench-review-field-value" data-review-field="tags">${escapeHtml(issue.tags)}</span></div>
      <div class="workbench-review-field">
        <label>状态流转记录</label>
        <div class="workbench-review-timeline">
          <span>创建：${escapeHtml(issue.created || "-")}</span>
          <span>更新：${escapeHtml(issue.updated || "-")}</span>
          <span>当前状态：${escapeHtml(issue.status)}</span>
        </div>
      </div>
    </div>
  `;
}

function renderWorkbenchIssueDetailActions() {
  return `<div class="workbench-review-inspector-actions"><button class="workbench-prototype-action" type="button" data-review-save>${escapeHtml(state.workbenchIssueSaving ? "保存中" : "保存")}</button><button class="workbench-prototype-action is-secondary" type="button" data-review-cancel>取消</button><button class="workbench-prototype-action is-secondary" type="button" data-review-status-action="confirmed">标记已采纳</button><button class="workbench-prototype-action is-secondary" type="button" data-review-status-action="deferred">忽略</button><button class="workbench-prototype-action is-secondary" type="button" data-review-delete>删除</button></div>`;
}

function renderWorkbenchIssueBatchInspector(selectedRows = []) {
  const statusSummary = Object.values(WORKBENCH_ISSUE_STATUS_LABELS)
    .map((label) => [label, selectedRows.filter((issue) => issue.status === label).length])
    .filter(([, count]) => count > 0);
  const previewRows = selectedRows.slice(0, 5);
  return `
    <div class="workbench-review-batch-panel">
      <div class="workbench-review-batch-summary">
        <strong>已选择 ${escapeHtml(formatNumber(selectedRows.length))} 条 Issue</strong>
        <span>批量操作会写入本地用户库；如需编辑正文，请只打开单条 Issue。</span>
      </div>
      <div class="workbench-review-batch-stats">
        ${statusSummary.map(([label, count]) => `<span>${escapeHtml(label)} <strong>${escapeHtml(formatNumber(count))}</strong></span>`).join("")}
      </div>
      <div class="workbench-review-batch-list" aria-label="已选择的 Issue 摘要">
        ${previewRows.map((issue) => `<span>${escapeHtml(issue.title)}<small>${escapeHtml(workbenchIssuePageObjectLabel(issue))}</small></span>`).join("")}
        ${selectedRows.length > previewRows.length ? `<span class="is-more">还有 ${escapeHtml(formatNumber(selectedRows.length - previewRows.length))} 条</span>` : ""}
      </div>
    </div>
  `;
}

function renderWorkbenchIssueBatchActions() {
  return `<div class="workbench-review-inspector-actions is-batch"><button class="workbench-prototype-action is-secondary" type="button" data-review-bulk-status="closed">全部关闭</button><button class="workbench-prototype-action is-secondary" type="button" data-review-bulk-status="reviewing">改为处理中</button><button class="workbench-prototype-action is-secondary" type="button" data-review-bulk-status="deferred">全部忽略</button><button class="workbench-prototype-action is-secondary" type="button" data-review-bulk-status="confirmed">标记已采纳</button><button class="workbench-prototype-action is-secondary" type="button" data-review-clear-selection>清除选择</button></div>`;
}

function renderWorkbenchIssueEmptyInspector() {
  return `<div class="workbench-review-empty is-blank">未选择 Issue</div>`;
}

function renderWorkbenchIssueInspectorContent() {
  const selectedRows = workbenchSelectedIssueRows();
  if (selectedRows.length > 1) return renderWorkbenchIssueBatchInspector(selectedRows);
  const active = workbenchIssueById(state.workbenchSelectedIssueId) || selectedRows[0] || null;
  if (!active) return renderWorkbenchIssueEmptyInspector();
  return renderWorkbenchIssueDetailInspector(active);
}

function renderWorkbenchIssueInspectorActions() { const selectedRows = workbenchSelectedIssueRows(); const active = workbenchIssueById(state.workbenchSelectedIssueId) || selectedRows[0] || null; return selectedRows.length > 1 ? renderWorkbenchIssueBatchActions() : active ? renderWorkbenchIssueDetailActions() : ""; }

function renderWorkbenchIssues() {
  if (!state.userNotesLoaded && !state.userNotesLoadPromise) ensureUserNotesLoaded();
  const allIssues = workbenchAllIssueRows();
  const issues = workbenchIssueRows();
  const summary = workbenchIssueSummary(allIssues);
  const pageGroups = workbenchIssuePageGroups(allIssues);
  const isLoading = state.userWriteStatus.state === "loading" && !state.userNotesLoaded;
  const statusOptions = [
    ["全部", "状态：全部"],
    ["待处理", "待处理"],
    ["处理中", "处理中"],
    ["待确认", "待确认"],
    ["已采纳", "已采纳"],
    ["已忽略", "已忽略"],
    ["已关闭", "已关闭"],
  ];
  const pageOptions = [["全部", "页面：全部页面"], ...pageGroups.map((group) => [group.pageRoute, group.page])];
  const priorityOptions = [["全部", "优先级：全部"], ...WORKBENCH_ISSUE_PRIORITY_VALUES.map((value) => [value, value])];
  const activeStatusFilter = state.workbenchIssueStatusFilter || "全部";
  const activePageFilter = state.workbenchIssuePageFilter || "全部";
  const activePriorityFilter = state.workbenchIssuePriorityFilter || "全部";
  const activePageLabel = activePageFilter !== "全部" ? pageGroups.find((group) => group.pageRoute === activePageFilter)?.page || activePageFilter : "";
  const selectedIssueCount = state.workbenchSelectedIssueIds?.size || 0;
  const selectedRowsForInspector = workbenchSelectedIssueRows();
  const inspectorIssue = selectedRowsForInspector.length > 1 ? null : workbenchIssueById(state.workbenchSelectedIssueId) || selectedRowsForInspector[0] || null;
  const filterChips = [
    activeStatusFilter !== "全部" ? { label: "状态", value: activeStatusFilter } : null,
    activePageLabel ? { label: "Issue 范围", value: activePageLabel } : null,
    activePriorityFilter !== "全部" ? { label: "优先级", value: activePriorityFilter } : null,
    state.workbenchIssueSearch ? { label: "关键词", value: state.workbenchIssueSearch } : null,
  ].filter(Boolean);
  const queueContext = `${formatNumber(issues.length)} / ${formatNumber(summary.total)} 条`;
  return `
    <section class="workbench-route-page workbench-issues-route" aria-label="Issue 清单">
      <div class="workbench-review-toolbar" aria-label="Issue 筛选工具条">
        <div class="workbench-review-filter-group">
          <select class="workbench-review-select" aria-label="状态筛选" data-review-filter-control="status">${statusOptions.map(([value, label]) => `<option value="${escapeHtml(value)}"${value === activeStatusFilter ? " selected" : ""}>${escapeHtml(label)}</option>`).join("")}</select>
          <select class="workbench-review-select" aria-label="页面筛选" data-review-filter-control="page">${pageOptions.map(([value, label]) => `<option value="${escapeHtml(value)}"${value === activePageFilter ? " selected" : ""}>${escapeHtml(label)}</option>`).join("")}</select>
          <select class="workbench-review-select" aria-label="优先级筛选" data-review-filter-control="priority">${priorityOptions.map(([value, label]) => `<option value="${escapeHtml(value)}"${value === activePriorityFilter ? " selected" : ""}>${escapeHtml(label)}</option>`).join("")}</select>
          <label class="workbench-review-search-shell" for="workbenchIssueSearchInput">
            <input id="workbenchIssueSearchInput" class="workbench-review-search" type="search" value="${escapeHtml(state.workbenchIssueSearch || "")}" placeholder="搜索 Issue 标题、内容、页面或对象" aria-label="搜索 Issue 标题、内容、页面或对象" autocomplete="off" data-search-history-kind="workbench-issues" data-review-filter-control="search" />
          </label>
          <button class="workbench-prototype-action is-secondary" type="button" data-review-clear-filters>清除筛选</button>
        </div>
        <div class="workbench-review-active-filters" data-review-filter-state>
          ${
            filterChips.length
              ? filterChips.map((chip) => `<span class="workbench-review-filter-chip"><span>${escapeHtml(chip.label)}</span><strong>${escapeHtml(chip.value)}</strong></span>`).join("")
              : `<span class="workbench-review-filter-chip is-empty">全部 Issue</span>`
          }
        </div>
      </div>
      <div class="workbench-review-bulkbar" data-review-bulkbar>
        <strong data-review-selection-count>已选 0 条</strong>
        <div class="workbench-review-bulk-actions">
          <button class="workbench-prototype-action is-secondary" type="button" data-review-bulk-status="closed">全部关闭</button>
          <button class="workbench-prototype-action is-secondary" type="button" data-review-bulk-status="reviewing">改为处理中</button>
          <button class="workbench-prototype-action is-secondary" type="button" data-review-bulk-status="deferred">全部忽略</button>
          <button class="workbench-prototype-action is-secondary" type="button" data-review-bulk-status="confirmed">标记已采纳</button>
          <button class="workbench-prototype-action is-secondary" type="button" data-review-clear-selection>清除选择</button>
        </div>
      </div>
      <div class="workbench-prototype-annotation-layout">
        <aside class="workbench-review-scope" aria-label="Issue 范围导航">
          <div class="workbench-review-panel-title">Issue 范围 <span class="workbench-prototype-pill is-muted">${escapeHtml(formatNumber(summary.total))} 条</span></div>
          <button class="workbench-review-scope-row ${activePageFilter === "全部" ? "is-active" : ""}" type="button" data-review-page-route="全部"><strong>全部 Issue</strong><span>${escapeHtml(formatNumber(summary.total))} 条 / ${escapeHtml(formatNumber(summary.todoCount))} 待处理</span></button>
          ${pageGroups
            .map(
              (group) => `
                <button class="workbench-review-scope-row ${activePageFilter === group.pageRoute ? "is-active" : ""}" type="button" data-review-page-route="${escapeHtml(group.pageRoute)}">
                  <strong>${escapeHtml(group.page)}</strong><span>${escapeHtml(formatNumber(group.total))} 条 / ${escapeHtml(formatNumber(group.todo))} 待处理</span>
                </button>
              `,
            )
            .join("")}
        </aside>
        <div class="workspace-resizer workbench-issue-pane-resizer" data-workspace-resize-index="0" role="separator" aria-orientation="vertical" aria-label="调整 Issue 范围和处理队列宽度" title="拖动调整宽度"></div>
        <section class="workbench-review-queue" aria-label="Issue 处理队列">
          <div class="workbench-review-panel-title">Issue 处理队列 <span class="workbench-prototype-pill is-muted" data-review-queue-context>${escapeHtml(queueContext)}</span></div>
          ${renderWorkbenchIssueQueueHead(issues)}
          ${isLoading ? `<div class="workbench-review-loading">正在读取本地 Issue...</div>` : issues.length ? issues.map(renderWorkbenchIssueItem).join("") : `<div class="workbench-review-empty">当前筛选下没有 Issue。</div>`}
        </section>
        <div class="workspace-resizer workbench-issue-pane-resizer" data-workspace-resize-index="1" role="separator" aria-orientation="vertical" aria-label="调整处理队列和选中 Issue 宽度" title="拖动调整宽度"></div>
        <aside class="workbench-review-inspector" aria-label="Issue 编辑面板" data-review-inspector data-dirty="false" data-note-id="${escapeHtml(inspectorIssue?.id || "")}" data-selected-count="${escapeHtml(String(selectedIssueCount))}">
          <div class="workbench-review-panel-title">选中 Issue <span class="workbench-prototype-pill ${selectedIssueCount > 1 ? "is-muted" : "is-good"}" data-review-dirty>${selectedIssueCount > 1 ? `${escapeHtml(formatNumber(selectedIssueCount))} 条` : "已保存"}</span></div>
          <div class="workbench-review-warning" data-review-warning hidden>切换 Issue 前，如有未保存内容，需要提示确认。</div>
          ${renderWorkbenchIssueInspectorActions()}
          <div class="workbench-review-inspector-content" data-review-inspector-scroll>${renderWorkbenchIssueInspectorContent()}</div>
        </aside>
      </div>
      ${renderWorkbenchIssueDeleteDialog()}
    </section>
  `;
}

function renderWorkbenchMaturity() {
  const rows = [
    ["华东政企云", "SAPD 成熟度 V1", "L3", "72", "暂存", "2026-07-01 09:42", "/workbench/maturity/project-001"],
    ["制造集团数据域", "数据安全成熟度", "L2", "61", "已完成", "2026-06-28 17:20", "/workbench/maturity/project-001"],
    ["金融数据平台", "SAPD 成熟度 V1", "L3", "76", "已导出", "2026-06-22 15:10", "/workbench/maturity/project-001"],
  ];
  return `
    <section class="workbench-route-page" aria-label="成熟度评估页">
      <div class="workbench-section-title">
        <div>
          <h3>成熟度评估</h3>
          <span>独立页面，包含评估工作流暂存、历史项目查询、编辑和导出入口。</span>
        </div>
        <button class="workbench-prototype-action" type="button">新建评估项目</button>
      </div>
      <div class="workbench-prototype-grid is-three">
        <section class="workbench-prototype-card">
          <span class="workbench-prototype-pill is-warn">当前评估工作</span>
          <h3>华东政企云</h3>
          <p>状态暂存于评分维度「治理体系」，下一步继续补充证据说明和备注。</p>
          <div class="workbench-prototype-action-row">
            <button class="workbench-prototype-action" type="button" data-app-route="/workbench/maturity/project-001">继续评估</button>
            <button class="workbench-prototype-action is-secondary" type="button">保存暂存</button>
          </div>
        </section>
        <section class="workbench-prototype-card">
          <span class="workbench-prototype-pill is-good">工作流状态</span>
          <div class="workbench-prototype-row is-active"><span>已完成维度</span><strong>3 / 6</strong></div>
          <div class="workbench-prototype-row"><span>待补证据</span><strong>4 项</strong></div>
        </section>
        <section class="workbench-prototype-card">
          <span class="workbench-prototype-pill">历史项目查询</span>
          <p>支持按客户、模板、状态、更新时间过滤历史项目，后续接用户库 project 索引。</p>
          <div class="workbench-prototype-chip-row">
            <span class="workbench-prototype-pill is-muted">编辑</span>
            <span class="workbench-prototype-pill is-muted">导出报告</span>
            <span class="workbench-prototype-pill is-muted">导出 project 包</span>
          </div>
        </section>
      </div>
      <div class="workbench-prototype-filter-row">
        <span class="workbench-prototype-filter">客户：全部</span>
        <span class="workbench-prototype-filter">模板：全部模板</span>
        <span class="workbench-prototype-filter">状态：暂存 / 草稿 / 已完成 / 已导出</span>
        <span class="workbench-prototype-filter">关键词：客户或项目名</span>
        <span class="workbench-prototype-filter">最近更新：近 90 天</span>
      </div>
      <div class="workbench-prototype-maturity-layout">
        <section class="workbench-prototype-table" aria-label="评估项目列表">
          <div class="workbench-prototype-table-row is-head"><span>客户名称</span><span>模板名称</span><span>等级</span><span>总分</span><span>状态</span><span>最近更新</span><span>操作</span></div>
          ${rows
            .map(
              (row, index) => `
                <div class="workbench-prototype-table-row${index === 0 ? " is-active" : ""}">
                  <span>${escapeHtml(row[0])}</span><span>${escapeHtml(row[1])}</span><span>${escapeHtml(row[2])}</span><span>${escapeHtml(row[3])}</span><span>${escapeHtml(row[4])}</span><span>${escapeHtml(row[5])}</span>
                  <span class="workbench-prototype-row-actions"><button type="button" data-app-route="${escapeHtml(row[6])}">编辑</button><button type="button">导出</button></span>
                </div>
              `,
            )
            .join("")}
        </section>
        <aside class="workbench-prototype-chart-card">
          <h3>项目概览</h3>
          <div class="workbench-prototype-radar" aria-hidden="true"></div>
          <div class="workbench-prototype-bar"><span>治理</span><span><i style="width: 68%"></i></span><b>68</b></div>
          <div class="workbench-prototype-bar"><span>技术</span><span><i style="width: 78%"></i></span><b>78</b></div>
          <div class="workbench-prototype-bar"><span>运营</span><span><i style="width: 61%"></i></span><b>61</b></div>
          <button class="workbench-prototype-action" type="button" data-app-route="/workbench/maturity/project-001">打开项目详情</button>
        </aside>
      </div>
    </section>
  `;
}

function renderWorkbenchProject() {
  return `
    <section class="workbench-route-page" aria-label="成熟度评估项目详情页">
      <div class="workbench-section-title">
        <div>
          <h3>华东政企云成熟度评估</h3>
          <span>项目详情页，左侧维度导航，中间评分表单，右侧实时结果。</span>
        </div>
        <div class="workbench-prototype-action-row">
          <button class="workbench-prototype-action" type="button">保存</button>
          <button class="workbench-prototype-action is-secondary" type="button">修改</button>
          <button class="workbench-prototype-action is-secondary" type="button">导出报告</button>
          <button class="workbench-prototype-action is-secondary" type="button">导出 project 包</button>
        </div>
      </div>
      <div class="workbench-prototype-project-layout">
        <aside class="workbench-prototype-panel">
          <h3>评分维度</h3>
          <button class="workbench-prototype-row is-active" type="button"><span>治理体系</span><strong>68</strong></button>
          <button class="workbench-prototype-row" type="button"><span>技术能力</span><strong>78</strong></button>
          <button class="workbench-prototype-row" type="button"><span>运营闭环</span><strong>61</strong></button>
          <button class="workbench-prototype-row" type="button"><span>证据完整性</span><strong>58</strong></button>
        </aside>
        <section class="workbench-prototype-panel">
          <h3>评分表单</h3>
          <div class="workbench-prototype-score-row"><span>制度完整性</span><span class="workbench-prototype-score-options"><i class="workbench-prototype-score-dot is-on"></i><i class="workbench-prototype-score-dot is-on"></i><i class="workbench-prototype-score-dot"></i><i class="workbench-prototype-score-dot"></i></span></div>
          <div class="workbench-prototype-score-row"><span>职责边界清晰度</span><span class="workbench-prototype-score-options"><i class="workbench-prototype-score-dot is-on"></i><i class="workbench-prototype-score-dot"></i><i class="workbench-prototype-score-dot"></i><i class="workbench-prototype-score-dot"></i></span></div>
          <div class="workbench-prototype-score-row"><span>评审记录完整性</span><span class="workbench-prototype-score-options"><i class="workbench-prototype-score-dot is-on"></i><i class="workbench-prototype-score-dot is-on"></i><i class="workbench-prototype-score-dot"></i><i class="workbench-prototype-score-dot"></i></span></div>
          <div class="workbench-prototype-filter-row">
            <span class="workbench-prototype-filter">证据说明：已填写</span>
            <span class="workbench-prototype-filter">备注：待客户确认</span>
          </div>
        </section>
        <aside class="workbench-prototype-detail">
          <span class="workbench-prototype-pill is-good">成熟度等级</span>
          <span class="workbench-prototype-metric"><strong>L3</strong><span>总分 72</span></span>
          <div class="workbench-prototype-radar" aria-hidden="true"></div>
          <div class="workbench-prototype-bar"><span>治理</span><span><i style="width: 68%"></i></span><b>68</b></div>
          <div class="workbench-prototype-bar"><span>技术</span><span><i style="width: 78%"></i></span><b>78</b></div>
          <div class="workbench-prototype-bar"><span>运营</span><span><i style="width: 61%"></i></span><b>61</b></div>
          <h3>评价摘要</h3>
          <p>当前客户已具备基础治理与技术能力覆盖，但证据完整性和持续运营记录仍是主要短板。</p>
        </aside>
      </div>
    </section>
  `;
}

function renderWorkbench() {
  const routeType = workbenchRouteType();
  const templates = {
    home: renderWorkbenchHome,
    issues: renderWorkbenchIssues,
    maturity: renderWorkbenchMaturity,
    "maturity-project": renderWorkbenchProject,
  };
  setHtml("workbenchWorkspace", (templates[routeType] || renderWorkbenchHome)());
  updateWorkbenchReviewSelection();
  syncWorkbenchIssueHeaderControls();
  requestAnimationFrame(updateWorkbenchPaneScrollAffordance);
}

function sourceSearchPlaceholder(section = state.activeMaintenancePage) {
  if (section === "standards") return "搜索标准、框架、控制项或条款";
  if (section === "capability-directory") return "搜索能力、关注点、编码或层级";
  if (section === "application-systems") return "搜索应用系统、类型或组件";
  if (section === "services") return "搜索服务、编码、作用域或模块/措施";
  if (section === "modules") return "搜索模块、编码、服务或作用域";
  if (section === "measures") return "搜索措施、编码、服务或环境对象";
  if (section === "work-functions") return "搜索职能、层级、任务或流程";
  if (section === "references") return "搜索标准任务、岗位或关联职能";
  return "搜索名称、编码、分组或关系";
}

function sourceSearchHistoryKind(section = state.activeMaintenancePage) {
  if (section === "standards") return "standards";
  if (text(state.activeRoute).trim().startsWith("/guides/")) return "guides";
  return "knowledge";
}

function renderSourceLocalSearchToolbar(viewModel = {}, { standardsMode = false } = {}) {
  const components = window.sapdComponents || {};
  const scope = searchScopeForCurrentState();
  const historyKind = sourceSearchHistoryKind(viewModel.section);
  const leading = standardsMode ? "" : components.MaintenanceShell?.render({ viewModel }) || "";
  return `
    <div class="source-local-search-toolbar page-local-search-toolbar ${standardsMode ? "is-standards" : "is-knowledge"}" aria-label="${standardsMode ? "标准 / 框架局部搜索" : "知识库字典局部搜索"}">
      <div class="source-local-toolbar-leading">${leading}</div>
      <div class="source-catalog-tools page-search-control" role="search" aria-label="${standardsMode ? "标准 / 框架页面内搜索" : "知识库字典页面内搜索"}">
        <label class="page-search-input-shell" for="sourceSearchInput">
          <span class="capability-search-icon" aria-hidden="true">⌕</span>
          <input id="sourceSearchInput" type="search" value="${escapeHtml(state.search || "")}" placeholder="${escapeHtml(sourceSearchPlaceholder(viewModel.section))}" autocomplete="off" data-search-history-kind="${escapeHtml(historyKind)}" />
        </label>
        <span class="page-search-match-status" data-page-search-status="${escapeHtml(scope)}" aria-live="polite"></span>
        <button class="page-search-step" type="button" data-page-search-step="-1" data-page-search-scope="${escapeHtml(scope)}" title="上一个匹配" aria-label="上一个匹配">‹</button>
        <button class="page-search-step" type="button" data-page-search-step="1" data-page-search-scope="${escapeHtml(scope)}" title="下一个匹配" aria-label="下一个匹配">›</button>
      </div>
    </div>
  `;
}

function activeWorkbenchReviewPage() {
  return $("workbenchWorkspace")?.querySelector(".workbench-route-page[aria-label='Issue 清单']") || null;
}

function updateWorkbenchPaneScrollAffordance() {
  const page = activeWorkbenchReviewPage();
  if (!page) return;
  page.querySelectorAll(".workbench-review-scope, .workbench-review-queue, .workbench-review-inspector").forEach((pane) => {
    const scrollTarget = pane.matches(".workbench-review-inspector") ? pane.querySelector("[data-review-inspector-scroll]") || pane : pane;
    const hasOverflow = scrollTarget.scrollHeight > scrollTarget.clientHeight + 2;
    pane.classList.toggle("has-scroll-overflow", hasOverflow);
  });
}

function activeWorkbenchReviewItem() {
  return activeWorkbenchReviewPage()?.querySelector("[data-review-item].is-active") || null;
}

function updateWorkbenchReviewSelection() {
  const page = activeWorkbenchReviewPage();
  if (!page) {
    syncWorkbenchIssueHeaderControls();
    return;
  }
  const checkedIds = Array.from(page.querySelectorAll(".workbench-review-checkbox:checked"))
    .map((checkbox) => text(checkbox.dataset.noteId).trim())
    .filter(Boolean);
  state.workbenchSelectedIssueIds = new Set(checkedIds);
  const checkedCount = state.workbenchSelectedIssueIds.size;
  const visibleCheckboxes = Array.from(page.querySelectorAll(".workbench-review-checkbox"));
  const selectAll = page.querySelector("[data-review-select-all]");
  if (selectAll) {
    selectAll.checked = Boolean(visibleCheckboxes.length) && checkedCount === visibleCheckboxes.length;
    selectAll.indeterminate = checkedCount > 0 && checkedCount < visibleCheckboxes.length;
    selectAll.disabled = visibleCheckboxes.length === 0;
  }
  const bulkbar = page.querySelector("[data-review-bulkbar]");
  const counter = page.querySelector("[data-review-selection-count]");
  if (counter) counter.textContent = `已选 ${checkedCount} 条`;
  if (bulkbar) bulkbar.hidden = checkedCount === 0;
  syncWorkbenchIssueHeaderControls();
  updateWorkbenchPaneScrollAffordance();
}

function setWorkbenchReviewDirty(isDirty) {
  const inspector = activeWorkbenchReviewPage()?.querySelector("[data-review-inspector]");
  if (!inspector) return;
  inspector.dataset.dirty = isDirty ? "true" : "false";
  const dirtyPill = inspector.querySelector("[data-review-dirty]");
  if (dirtyPill) {
    dirtyPill.textContent = isDirty ? "未保存" : "已保存";
    dirtyPill.classList.toggle("is-warn", isDirty);
    dirtyPill.classList.toggle("is-good", !isDirty);
  }
}

function setWorkbenchReviewWarning(message, visible = true) {
  const warning = activeWorkbenchReviewPage()?.querySelector("[data-review-warning]");
  if (!warning) return;
  warning.textContent = message;
  warning.hidden = !visible;
}

function setWorkbenchReviewPill(pill, value, kind = "status") {
  if (!pill) return;
  pill.textContent = value || "待处理";
  pill.classList.remove("is-muted", "is-good", "is-warn");
  const tone = workbenchReviewPillTone(value, kind);
  if (tone) pill.classList.add(tone);
}

function updateWorkbenchReviewInspector(item) {
  const inspector = activeWorkbenchReviewPage()?.querySelector("[data-review-inspector]");
  if (!inspector || !item) return;
  state.workbenchSelectedIssueId = text(item.dataset.noteId).trim();
  inspector.dataset.noteId = state.workbenchSelectedIssueId;
  const fields = {
    title: item.dataset.title,
    body: item.dataset.body,
    status: item.dataset.statusValue,
    priority: item.dataset.priority,
    pageObject: workbenchIssuePageObjectLabel({ page: item.dataset.page, object: item.dataset.object }),
    tags: item.dataset.tags,
  };
  Object.entries(fields).forEach(([key, value]) => {
    const field = inspector.querySelector(`[data-review-field="${key}"]`);
    if (!field || value == null) return;
    if ("value" in field) field.value = value;
    else field.textContent = value;
  });
  setWorkbenchReviewWarning("", false);
  setWorkbenchReviewDirty(false);
}

function cancelWorkbenchReviewInspector() { const inspector = activeWorkbenchReviewPage()?.querySelector("[data-review-inspector]"); const wasDirty = inspector?.dataset?.dirty === "true"; state.workbenchPendingDeleteIssueId = ""; renderWorkbench(); setWorkbenchReviewWarning(wasDirty ? "已恢复为上次保存内容。" : "当前 Issue 没有未保存修改。", true); setWorkbenchReviewDirty(false); }

function selectWorkbenchReviewItem(reviewItem) {
  if (!reviewItem) return false;
  const page = reviewItem.closest(".workbench-route-page"), inspector = page?.querySelector("[data-review-inspector]");
  if (!page || !inspector) return false;
  if (inspector.dataset.dirty === "true" && !reviewItem.classList.contains("is-active")) {
    setWorkbenchReviewWarning("当前 Issue 有未保存修改，请先保存或取消，再切换到其他 Issue。", true);
    return false;
  }
  const noteId = text(reviewItem.dataset.noteId).trim();
  if (!noteId) return false;
  if (!(state.workbenchSelectedIssueIds instanceof Set)) state.workbenchSelectedIssueIds = new Set();
  state.workbenchSelectedIssueId = noteId; state.workbenchPendingDeleteIssueId = "";
  state.workbenchSelectedIssueIds.add(noteId);
  renderWorkbench();
  return true;
}

async function saveWorkbenchReviewInspector() {
  const inspector = activeWorkbenchReviewPage()?.querySelector("[data-review-inspector]");
  if (!inspector) return;
  const noteId = text(inspector.dataset.noteId || activeWorkbenchReviewItem()?.dataset.noteId).trim();
  const activeItem =
    activeWorkbenchReviewItem() ||
    Array.from(activeWorkbenchReviewPage()?.querySelectorAll("[data-review-item]") || []).find((item) => text(item.dataset.noteId).trim() === noteId);
  if (!noteId) return;
  const body = inspector.querySelector('[data-review-field="body"]')?.value || activeItem?.dataset.body || "";
  const statusValue = inspector.querySelector('[data-review-field="status"]')?.value || activeItem?.dataset.statusValue || "todo";
  const priorityValue = inspector.querySelector('[data-review-field="priority"]')?.value || activeItem?.dataset.priority || "未标注";
  const sourceIssue = workbenchIssueById(noteId);
  const tags = workbenchIssueTagsWithPriority(sourceIssue?.tagsList || [], priorityValue);
  const dataClient = window.sapdDataClient;
  if (!noteId || !dataClient?.updateUserNote) {
    setWorkbenchReviewWarning("当前运行环境未提供 Issue 更新能力。", true);
    return;
  }
  state.workbenchIssueSaving = true;
  setWorkbenchReviewWarning("正在保存到本地用户库...", false);
  renderWorkbench();
  try {
    const envelope = await dataClient.updateUserNote(noteId, { body, status: statusValue, tags });
    if (envelope?.data?.ok === false) throw new Error(envelope.data.error || "update note failed");
    upsertNoteInState(envelope?.data?.note);
    state.workbenchSelectedIssueId = noteId;
    state.workbenchIssueSaving = false;
    renderWorkbench();
    setWorkbenchReviewWarning("已保存到本地用户库。", false);
    setWorkbenchReviewDirty(false);
  } catch (error) {
    console.warn("工作台 Issue 保存失败", error);
    state.workbenchIssueSaving = false;
    renderWorkbench();
    setWorkbenchReviewWarning(`保存失败：${text(error?.message || error) || "请检查本地服务"}`, true);
  }
}

async function handleWorkbenchIssueBulkStatus(statusValue = "") {
  const dataClient = window.sapdDataClient;
  const noteIds = Array.from(state.workbenchSelectedIssueIds || []).map((noteId) => text(noteId).trim()).filter(Boolean);
  if (!noteIds.length) return;
  if (!dataClient?.updateUserNote) {
    setWorkbenchReviewWarning("当前运行环境未提供 Issue 更新能力。", true);
    return;
  }
  state.workbenchIssueSaving = true;
  setWorkbenchReviewWarning(`正在批量更新 ${noteIds.length} 条 Issue...`, false);
  try {
    const results = await Promise.all(noteIds.map((noteId) => dataClient.updateUserNote(noteId, { status: statusValue })));
    results.forEach((envelope) => {
      if (envelope?.data?.note) upsertNoteInState(envelope.data.note);
    });
    state.workbenchSelectedIssueIds = new Set();
    state.workbenchSelectedIssueId = "";
    state.workbenchIssueSaving = false;
    renderWorkbench();
    setWorkbenchReviewWarning(`已批量更新 ${noteIds.length} 条 Issue。`, false);
  } catch (error) {
    console.warn("工作台 Issue 批量状态更新失败", error);
    state.workbenchIssueSaving = false;
    renderWorkbench();
    setWorkbenchReviewWarning(`批量更新失败：${text(error?.message || error) || "请检查本地服务"}`, true);
  }
}

async function handleWorkbenchIssueDelete() {
  const inspector = activeWorkbenchReviewPage()?.querySelector("[data-review-inspector]");
  const noteId = text(inspector?.dataset.noteId || state.workbenchSelectedIssueId).trim();
  if (!noteId) return;
  state.workbenchPendingDeleteIssueId = noteId;
  renderWorkbench();
}

async function confirmWorkbenchIssueDelete() {
  const inspector = activeWorkbenchReviewPage()?.querySelector("[data-review-inspector]");
  const noteId = text(inspector?.dataset.noteId || state.workbenchPendingDeleteIssueId || state.workbenchSelectedIssueId).trim();
  if (!noteId) return;
  const dataClient = window.sapdDataClient;
  if (!dataClient?.deleteUserNote) {
    setWorkbenchReviewWarning("当前运行环境未提供 Issue 删除能力。", true);
    return;
  }
  state.workbenchIssueSaving = true;
  try {
    const envelope = await dataClient.deleteUserNote(noteId);
    if (envelope?.data?.ok === false) throw new Error(envelope.data.error || "delete note failed");
    removeNoteFromState(noteId);
    state.workbenchSelectedIssueId = "";
    state.workbenchSelectedIssueIds?.delete(noteId);
    state.workbenchPendingDeleteIssueId = "";
    state.workbenchIssueSaving = false;
    renderWorkbench();
    setWorkbenchReviewWarning("Issue 已删除。", false);
  } catch (error) {
    console.warn("工作台 Issue 删除失败", error);
    state.workbenchPendingDeleteIssueId = "";
    state.workbenchIssueSaving = false;
    renderWorkbench();
    setWorkbenchReviewWarning(`删除失败：${text(error?.message || error) || "请检查本地服务"}`, true);
  }
}

function mountAppShellComponents() {
  const components = window.sapdComponents || {};
  components.AppShell?.mountApplicationShell?.({
    activeRoute: state.activeRoute,
    activeModelingLanguageTab: state.activeModelingLanguageTab,
    activeEnvironmentTab: state.activeEnvironmentTab,
  });
  components.AppShell?.mountCapabilityWorkspace($("capabilityWorkspace"));
  if ($("localModeStatus")) setHtml("localModeStatus", "");
  components.AppShell?.hydrateLicenseStatus?.();
  syncUserNotesExportButton();
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
  if (target.standardTableId) state.activeStandardTableId = target.standardTableId;
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

function routeQueryString(route) {
  const value = text(route).trim();
  if (!value) return "";
  const withoutHash = value.startsWith("#") ? value.slice(1) : value;
  const queryStart = withoutHash.indexOf("?");
  if (queryStart < 0) return "";
  const query = withoutHash.slice(queryStart + 1).split("#")[0];
  return query ? `?${query}` : "";
}

function globalSearchRoute(query = state.globalSearch) {
  const q = text(query).trim();
  return q ? `/search?q=${encodeURIComponent(q)}` : "/search";
}

function globalSearchQueryFromRoute(route = "") {
  const value = text(route).trim();
  const normalizedRoute = value.startsWith("#") ? value.slice(1) : value;
  const query = routeQueryString(normalizedRoute);
  if (!query) return "";
  return text(new URLSearchParams(query.slice(1)).get("q")).trim();
}

function globalSearchQueryFromBrowser() {
  return globalSearchQueryFromRoute(window.location.hash || "");
}

function globalSearchQueryFromLocationSearch() {
  return text(new URLSearchParams(window.location.search || "").get("q")).trim();
}

function resolveRouteTarget(route) {
  const normalized = normalizeAppRoute(route);
  const components = window.sapdComponents || {};
  const shellTarget = components.AppShell?.getRouteTarget?.(normalized);
  if (shellTarget?.route) return shellTarget;

  if (normalized === "/workbench") {
    return { route: "/workbench", view: "workbench" };
  }

  if (normalized.startsWith("/workbench/annotations")) {
    return { route: "/workbench/annotations", view: "workbench" };
  }

  if (normalized.startsWith("/workbench/maturity")) {
    return { route: normalized, view: "workbench" };
  }

  if (normalized.startsWith("/workbench")) {
    return { route: "/workbench", view: "workbench" };
  }

  if (normalized.startsWith("/search")) {
    return { route: "/search", view: "search" };
  }

  return { route: "/", view: "overview" };
}

function routeFromBrowserLocation() {
  const rawHashRoute = text(window.location.hash || "").trim();
  const hashRoute = normalizeAppRoute(rawHashRoute);
  if (hashRoute !== "/") return rawHashRoute.startsWith("#") ? rawHashRoute.slice(1) : rawHashRoute;
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
  const query = normalized === "/search" ? routeQueryString(route) : "";
  const nextHash = normalized === "/" ? "" : `#${normalized}${query}`;
  const nextPath = appRouteBasePath();
  if (window.location.pathname === nextPath && window.location.hash === nextHash) return;
  const nextUrl = `${nextPath}${window.location.search}${nextHash}`;
  if (replace) window.history.replaceState({ route: normalized }, "", nextUrl);
  else window.history.pushState({ route: normalized }, "", nextUrl);
}

function activateRoute(route, options = {}) {
  const target = resolveRouteTarget(route);
  const routeChanged = target.route !== state.activeRoute;
  const isWorkbenchIssueRoute = target.route === "/workbench/annotations";
  if (!options.skipAnnotationGuard && routeChanged && hasUnsavedAnnotationDraft() && !isWorkbenchIssueRoute) {
    requestAnnotationContextSwitch(() => activateRoute(route, { ...options, skipAnnotationGuard: true }), target.description || target.route || "新页面");
    if (options.fromBrowser) syncBrowserRoute(state.activeRoute, { replace: true });
    return;
  }
  if (routeChanged && hasUnsavedAnnotationDraft() && isWorkbenchIssueRoute) {
    resetAnnotationInteraction({ collapse: true, clearDraft: true });
  }
  if (routeChanged) resetAnnotationInteraction({ collapse: true, clearDraft: !options.preserveAnnotationDraft });
  state.activeRoute = target.route || "/";
  if (target.route === "/search") {
    const nextSearchQuery = globalSearchQueryFromRoute(route) || globalSearchQueryFromLocationSearch();
    if (state.globalSearch !== nextSearchQuery) {
      state.globalSearchLoadedQuery = "";
      state.globalSearchResultStats = null;
      resetGlobalSearchPageResults();
      state.globalSearchPageFilter = "全部";
      state.globalSearchPageIndex = 1;
    }
    state.globalSearch = nextSearchQuery;
    syncSearchInputs();
  }
  applyRouteTarget(target);
  restoreScopedSearch();
  setActiveView(target.view || "overview", { syncRoute: false, skipAnnotationGuard: true });
  const browserRoute = target.route === "/search" ? route : state.activeRoute;
  if (!options.fromBrowser) syncBrowserRoute(browserRoute, { replace: Boolean(options.replace) });
}

function openGlobalSearchPage(query = state.globalSearch, options = {}) {
  const nextSearchQuery = text(query).trim();
  state.globalSearch = nextSearchQuery;
  state.globalSearchLoadedQuery = "";
  state.globalSearchOpen = false;
  resetGlobalSearchPageResults();
  state.globalSearchPageFilter = "全部";
  state.globalSearchPageIndex = 1;
  rememberCommittedSearchQuery("global", nextSearchQuery);
  syncSearchInputs();
  renderGlobalSearchPanel();
  activateRoute(globalSearchRoute(state.globalSearch), { replace: Boolean(options.replace) });
}

function routeForCurrentState(view = state.activeView) {
  const components = window.sapdComponents || {};
  if (view === "search") return globalSearchRoute();
  if (view === "workbench" && normalizeAppRoute(state.activeRoute).startsWith("/workbench")) {
    return normalizeAppRoute(state.activeRoute);
  }
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
  syncWorkbenchIssueHeaderControls();
  syncSearchInputs();
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
  const hasObjectView = capabilityProjectionMatchesSelection(state.capabilityWorkspaceView, item) || capabilityProjectionMatchesSelection(state.capabilityProjection, item);
  const loadState = {
    phase: "initial",
    selectedId,
    selectedType,
    objectViewPending: false,
    focusProjectionPending: false,
    objectViewFailed: false,
    focusProjectionFailed: false,
    blocksDetail: false,
    loadKey,
    retryLoadKey: "",
    loadFailure: null,
    title: "",
    body: "",
  };
  if (item && !hasObjectView) {
    const failure = capabilityLoadFailure(loadKey);
    if (failure) {
      loadState.phase = "object_view_failed";
      loadState.objectViewFailed = true;
      loadState.retryLoadKey = loadKey;
      loadState.loadFailure = failure;
    } else {
      loadState.phase = "object_view_pending";
      loadState.objectViewPending = true;
      ensureCapabilityWorkspaceViewForSelection(selectedId);
    }
  }
  const focusLoadKey = capabilityProjectionLoadKey(selectedId);
  const isFocusProjectionPending =
    selectedType === "capability_focus" &&
    !loadState.objectViewPending &&
    !loadState.objectViewFailed &&
    !capabilityProjectionHasFocus(selectedId);
  if (isFocusProjectionPending) {
    const failure = capabilityLoadFailure(focusLoadKey);
    if (failure) {
      loadState.phase = "focus_projection_failed";
      loadState.focusProjectionFailed = true;
      loadState.retryLoadKey = focusLoadKey;
      loadState.loadFailure = failure;
    } else {
      loadState.phase = "focus_projection_pending";
      loadState.focusProjectionPending = true;
      loadState.retryLoadKey = focusLoadKey;
      ensureCapabilityProjectionForFocus(selectedId);
    }
  }
  return loadState;
}

function resolveCapabilityDetailLoadState(viewModel, loadState) {
  const selected = viewModel.selectedCapability;
  if (!selected) {
    return { ...loadState, phase: "no_selection", blocksDetail: true, title: "暂无能力关系数据" };
  }
  const canRenderInBackground = capabilityLoadStateCanRenderInBackground(viewModel, loadState);
  if (loadState.objectViewPending && state.packageLoads.has(loadState.loadKey)) {
    if (canRenderInBackground) {
      return {
        ...loadState,
        phase: "object_view_pending_background",
        blocksDetail: false,
        title: "正在补全当前能力对象关系数据",
        body: "已先显示当前对象的可用关系视图，后台投影完成后会自动刷新。",
      };
    }
    return {
      ...loadState,
      phase: "object_view_pending",
      blocksDetail: true,
      title: "正在加载当前能力对象关系数据",
      body: "对象级工作区视图加载完成后会自动显示。",
    };
  }
  if (loadState.objectViewFailed || loadState.focusProjectionFailed) {
    if (canRenderInBackground) {
      return {
        ...loadState,
        phase: `${loadState.phase}_background`,
        blocksDetail: false,
        title: loadState.loadFailure?.title || "加载失败：当前能力关系数据",
        body: loadState.loadFailure?.message || "请求结束但没有返回可用数据。已继续显示已有视图数据，可重试加载。",
      };
    }
    return {
      ...loadState,
      blocksDetail: true,
      title: loadState.loadFailure?.title || "加载失败：当前能力关系数据",
      body: loadState.loadFailure?.message || "请求结束但没有返回可用数据。已停止加载态，已回退到已有视图数据，可重试加载。",
    };
  }
  if (loadState.focusProjectionPending && state.packageLoads.has(capabilityProjectionLoadKey(state.selectedCapabilityId))) {
    if (canRenderInBackground) {
      return {
        ...loadState,
        phase: "focus_projection_pending_background",
        blocksDetail: false,
        title: "正在补全当前关注点关系数据",
        body: "已先显示当前关注点的可用关系视图，后台投影完成后会自动刷新。",
      };
    }
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

function capabilityViewModelHasRenderableDetail(viewModel) {
  if (!viewModel?.selectedCapability?.id) return false;
  if (viewModel.localRelationMap?.focus?.id || viewModel.localRelationMap?.focus?.code) return true;
  if (viewModel.capabilityOverview?.selected?.id || list(viewModel.capabilityOverview?.children).length) return true;
  if (viewModel.detailInspector) return true;
  return Boolean(list(viewModel.technicalMappingRows).length || list(viewModel.managementMappingRows).length || list(viewModel.standardMappingRows).length);
}

function capabilityLoadStateCanRenderInBackground(viewModel, loadState) {
  if (!capabilityViewModelHasRenderableDetail(viewModel)) return false;
  const selected = viewModel?.selectedCapability || null;
  if (selected?.type !== "capability_focus") return true;
  const item = capabilityItemById(loadState.selectedId || selected.id);
  const objectView = currentCapabilityObjectView();
  return Boolean(
    item?.id &&
      viewModel.localRelationMapSource === "backend_projection" &&
      capabilityProjectionMatchesSelection(objectView, item) &&
      capabilityObjectViewHasFocus(objectView, item.id),
  );
}

function capabilityManagementForViewModel() {
  const maintenanceKnowledge = state.maintenanceKnowledge || {};
  const maintenanceIndex = state.maintenanceIndex || maintenanceKnowledge.maintenance_index || maintenanceKnowledge.maintenanceIndex || null;
  return mergeSharedLookups({
    ...maintenanceKnowledge,
    maintenance_index: maintenanceIndex,
    stats: {
      ...(maintenanceIndex?.stats || {}),
      ...(maintenanceKnowledge.stats || {}),
    },
    section_counts: {
      ...(maintenanceIndex?.section_counts || {}),
      ...(maintenanceKnowledge.section_counts || {}),
    },
  });
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
    management: capabilityManagementForViewModel(),
    standards: state.standards,
    selectedCapabilityId: state.selectedCapabilityId,
    search: state.search,
    relationshipFilters: state.relationshipFilters,
  });
}

function capabilitySearchDirectMatches(viewModel, query = state.search) {
  const normalizedQuery = text(query).trim();
  if (!normalizedQuery) return [];
  const directRowMatches = (row) =>
    matchesTextQuery(
      normalizedQuery,
      row?.level,
      row?.code,
      row?.title,
      row?.label,
      row?.subtitle,
    );
  return list(viewModel?.navigationTree)
    .filter(directRowMatches)
    .map((row) => ({
      id: row.id,
      title: [row.code, row.title].filter(Boolean).join(" "),
      type: row.type,
    }));
}

function environmentSearchObjectMatches(viewModel, query = state.search) {
  const normalizedQuery = text(query).trim();
  if (!normalizedQuery) return [];
  const rows = [];
  const seen = new Set();
  const addObject = (environment, segment, object) => {
    const objectId = text(object?.id).trim();
    if (!objectId || seen.has(objectId)) return;
    if (
      !matchesTextQuery(
        normalizedQuery,
        environment?.code,
        environment?.title,
        segment?.code,
        segment?.title,
        object?.code,
        object?.title,
        object?.label,
        object?.description,
        object?.searchText,
      )
    ) {
      return;
    }
    seen.add(objectId);
    rows.push({
      id: objectId,
      objectId,
      environmentId: text(environment?.id).trim(),
      segmentId: text(segment?.id).trim(),
      title: [object?.code, object?.title].filter(Boolean).join(" ") || objectId,
      type: "information_object",
    });
  };
  list(viewModel?.navigationTree).forEach((environment) => {
    list(environment?.objects).forEach((object) => addObject(environment, null, object));
    list(environment?.segments).forEach((segment) => {
      list(segment?.objects).forEach((object) => addObject(environment, segment, object));
    });
  });
  return rows;
}

function resolveCapabilitySelection(viewModel) {
  const hadSelectedCapability = Boolean(state.selectedCapabilityId);
  const query = normalizeSearchText(state.search);
  const navigationRows = list(viewModel.navigationTree);
  const currentNavigationRow = navigationRows.find((row) => row.id === state.selectedCapabilityId);
  const rowMatchesDirectly = (row) => {
    if (!query || !row) return false;
    return normalizeSearchText([row.level, row.code, row.title].filter(Boolean).join(" ")).includes(query);
  };
  if (query && navigationRows.length && !rowMatchesDirectly(currentNavigationRow)) {
    const nextRow = navigationRows.find(rowMatchesDirectly) || navigationRows[0];
    if (nextRow?.id && nextRow.id !== state.selectedCapabilityId) {
      state.selectedCapabilityId = nextRow.id;
      state.activeCapabilityRelationTab = "summary";
    }
  }
  if (!state.selectedCapabilityId) state.selectedCapabilityId = viewModel.selectedCapability?.id || null;
  if (!hadSelectedCapability && viewModel.selectedCapability?.type === "capability_category" && state.selectedCapabilityId) {
    capabilityCategoryIds().forEach((id) => state.expandedCapabilityIds.add(id));
  }
  if (state.selectedCapabilityId && state.expandedSelectionId !== state.selectedCapabilityId) {
    capabilityAncestorIds(state.selectedCapabilityId).forEach((id) => state.expandedCapabilityIds.add(id));
    state.expandedSelectionId = state.selectedCapabilityId;
  }
}

function updateCapabilityPageSearchNavigation(viewModel) {
  const scope = "capability-mapping";
  const query = text(state.search).trim();
  if (!query) {
    clearPageSearchMatchSet(scope);
    updatePageSearchControls();
    return;
  }
  const matches = capabilitySearchDirectMatches(viewModel, query);
  if (matches.length) {
    const activeMatch = matches.find((row) => row.id === state.selectedCapabilityId) || matches[0];
    setPageSearchMatchSet(scope, query, matches, activeMatch?.id || state.selectedCapabilityId);
    if (activeMatch && state.pendingPageSearchReveal?.scope === scope && state.pendingPageSearchReveal?.query === query) {
      const activeIndex = Math.max(0, matches.findIndex((row) => row.id === activeMatch.id));
      state.pendingPageSearchReveal.targetAttribute = "data-capability-id";
      state.pendingPageSearchReveal.targetId = activeMatch.id;
      state.pendingPageSearchReveal.displayIndex = activeIndex;
      state.pendingPageSearchReveal.displayCount = matches.length;
      state.pageSearchNavigation = { scope, query, index: activeIndex, count: matches.length };
    }
  } else {
    clearPageSearchMatchSet(scope);
  }
  updatePageSearchControls();
}

function moveCapabilityPageSearchMatch(delta = 1, query = state.search) {
  const scope = "capability-mapping";
  const matchSet = pageSearchMatchSet(scope, query);
  if (!matchSet?.matches?.length) return false;
  const count = matchSet.matches.length;
  const nav = state.pageSearchNavigation || {};
  const currentIndex = nav.scope === scope && nav.query === text(query).trim() ? Number(nav.index) || 0 : 0;
  const nextIndex = ((currentIndex + delta) % count + count) % count;
  const nextId = matchSet.matches[nextIndex]?.id;
  if (!nextId) return false;
  state.selectedCapabilityId = nextId;
  state.activeCapabilityRelationTab = "summary";
  capabilityAncestorIds(nextId).forEach((id) => state.expandedCapabilityIds.add(id));
  state.pageSearchNavigation = { scope, query: text(query).trim(), index: nextIndex, count };
  state.pendingPageSearchReveal = {
    scope,
    query: text(query).trim(),
    index: 0,
    displayIndex: nextIndex,
    displayCount: count,
    targetAttribute: "data-capability-id",
    targetId: nextId,
  };
  renderCapabilities();
  flushPageSearchReveal();
  return true;
}

function updateEnvironmentPageSearchNavigation(viewModel) {
  const scope = "environment-mapping";
  const query = text(state.search).trim();
  if (!query) {
    clearPageSearchMatchSet(scope);
    updatePageSearchControls();
    return;
  }
  const matches = environmentSearchObjectMatches(viewModel, query);
  if (matches.length) {
    const activeMatch = matches.find((row) => row.objectId === state.selectedEnvironmentObjectId) || matches[0];
    setPageSearchMatchSet(scope, query, matches, activeMatch?.id || state.selectedEnvironmentObjectId);
    if (activeMatch && state.pendingPageSearchReveal?.scope === scope && state.pendingPageSearchReveal?.query === query) {
      const activeIndex = Math.max(0, matches.findIndex((row) => row.id === activeMatch.id));
      state.pendingPageSearchReveal.displayIndex = activeIndex;
      state.pendingPageSearchReveal.displayCount = matches.length;
      state.pageSearchNavigation = { scope, query, index: activeIndex, count: matches.length };
    }
  } else {
    clearPageSearchMatchSet(scope);
  }
  updatePageSearchControls();
}

function moveEnvironmentPageSearchMatch(delta = 1, query = state.search) {
  const scope = "environment-mapping";
  const matchSet = pageSearchMatchSet(scope, query);
  if (!matchSet?.matches?.length) return false;
  const count = matchSet.matches.length;
  const nav = state.pageSearchNavigation || {};
  const currentIndex = nav.scope === scope && nav.query === text(query).trim() ? Number(nav.index) || 0 : 0;
  const nextIndex = ((currentIndex + delta) % count + count) % count;
  const nextMatch = matchSet.matches[nextIndex] || {};
  if (!nextMatch.objectId) return false;
  state.selectedEnvironmentId = nextMatch.environmentId || null;
  state.selectedEnvironmentSegmentId = nextMatch.segmentId || null;
  state.selectedEnvironmentObjectId = nextMatch.objectId;
  state.selectedEnvironmentRowId = null;
  state.pageSearchNavigation = { scope, query: text(query).trim(), index: nextIndex, count };
  state.pendingPageSearchReveal = {
    scope,
    query: text(query).trim(),
    index: 0,
    displayIndex: nextIndex,
    displayCount: count,
  };
  renderEnvironment();
  flushPageSearchReveal();
  return true;
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
  setHtml("capabilityViewControls", "");
  if (loadState.loadFailure) {
    setHtml(
      "detail",
      `
        <div class="detail-empty capability-load-failure" data-capability-load-failure="${escapeHtml(loadState.phase)}">
          <strong>${escapeHtml(loadState.title)}</strong>
          <span>${escapeHtml(loadState.body)}</span>
          <button type="button" class="relation-mode-button" data-capability-load-retry="${escapeHtml(loadState.retryLoadKey || loadState.loadKey || "")}">重试加载</button>
        </div>
      `,
    );
  } else {
    setHtml("detail", emptyState(loadState.title, loadState.body));
  }
  applyCapabilityCatalogState();
  return true;
}

function renderCapabilityDetail(components, viewModel) {
  const userTarget = capabilityUserTarget(viewModel);
  const capabilityOverview = viewModel.capabilityOverview || {};
  const selectedCapabilityId = viewModel.selectedCapability?.id || "";
  if (selectedCapabilityId && state.lastCapabilityRelationSelectionId !== selectedCapabilityId) {
    state.lastCapabilityRelationSelectionId = selectedCapabilityId;
    if (state.activeCapabilityRelationTab !== "summary") {
      state.activeCapabilityRelationTab = "summary";
      persistWorkspaceState();
    }
  }
  const availableRelationTabs = capabilityOverview.detailPolicy === "overview" ? ["summary", "technical"] : ["summary", "technical", "management", "standard"];
  if (!availableRelationTabs.includes(state.activeCapabilityRelationTab)) state.activeCapabilityRelationTab = "summary";
  const shouldRenderDetailMatrices = capabilityOverview.detailPolicy !== "overview" && capabilityOverview.detailPolicy !== "mixed_summary";
  setCurrentAnnotationTarget(userTarget);
  setHtml(
    "capabilityFocusHeader",
    components.CapabilityLocalRelationMap?.renderFocusStrip?.(viewModel.localRelationMap, viewModel.focusOverview, capabilityOverview) || "",
  );
  setHtml(
    "capabilityViewControls",
    components.CapabilityLocalRelationMap?.renderTabControls?.(viewModel.localRelationMap, capabilityOverview, state.activeCapabilityRelationTab) || "",
  );
  setHtml(
    "detail",
    `
      ${
        components.CapabilityLocalRelationMap?.render({
          localRelationMap: viewModel.localRelationMap,
          focusOverview: viewModel.focusOverview,
          capabilityOverview,
          activeTab: state.activeCapabilityRelationTab,
          technicalMappingRows: shouldRenderDetailMatrices ? viewModel.technicalMappingRows : [],
          managementMappingRows: shouldRenderDetailMatrices ? viewModel.managementMappingRows : [],
          standardMappingRows: shouldRenderDetailMatrices ? viewModel.standardMappingRows : [],
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
    setHtml("capabilityViewControls", "");
    setHtml("detail", emptyState("正在加载安全能力映射数据", "当前页面优先加载，完成后会自动显示。"));
    return;
  }
  if (!viewModels?.buildCapabilityWorkspaceViewModel) {
    setHtml("detail", emptyState("能力视图模型未加载"));
    return;
  }
  const selectedType = capabilityItemTypeById(state.selectedCapabilityId);
  let loadState = createCapabilityLoadState(selectedType, state.selectedCapabilityId);
  let viewModel = buildCapabilityViewModel(viewModels);
  const previousSelectedCapabilityId = state.selectedCapabilityId;
  resolveCapabilitySelection(viewModel);
  if (state.selectedCapabilityId !== previousSelectedCapabilityId) {
    viewModel = buildCapabilityViewModel(viewModels);
    loadState = createCapabilityLoadState(capabilityItemTypeById(state.selectedCapabilityId), state.selectedCapabilityId);
  }
  if (!loadState.selectedId && state.selectedCapabilityId) {
    loadState = createCapabilityLoadState(capabilityItemTypeById(state.selectedCapabilityId), state.selectedCapabilityId);
  }
  renderCapabilityTree(components, viewModel);
  updateCapabilityPageSearchNavigation(viewModel);
  if (renderCapabilityPendingDetail(resolveCapabilityDetailLoadState(viewModel, loadState))) return;
  renderCapabilityDetail(components, viewModel);
  applyCapabilityCatalogState();
  updateCapabilityPageSearchNavigation(viewModel);
}

function renderEnvironmentHeaderTabs() {
  const root = $("environmentHeaderTabs");
  if (!root) return;
  const tabs = [
    { id: "topology", label: "信息化环境视图" },
    { id: "mapping", label: "信息化环境-安全技术" },
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
  const canSyncEnvironmentSelection = viewModel.selectionSource === "explicit" || viewModel.selectionSource === "search";
  if (canSyncEnvironmentSelection && viewModel.selectedEnvironment?.id && state.selectedEnvironmentId !== viewModel.selectedEnvironment.id) {
    state.selectedEnvironmentId = viewModel.selectedEnvironment.id;
  }
  if (canSyncEnvironmentSelection && viewModel.selectedObject?.id && state.selectedEnvironmentObjectId !== viewModel.selectedObject.id) {
    state.selectedEnvironmentObjectId = viewModel.selectedObject.id;
  }
  if (canSyncEnvironmentSelection && viewModel.selectedSegment?.id && state.selectedEnvironmentSegmentId !== viewModel.selectedSegment.id) {
    state.selectedEnvironmentSegmentId = viewModel.selectedSegment.id;
  }
  if (state.selectedEnvironmentId && state.expandedEnvironmentSelectionId !== `${state.selectedEnvironmentId}:${state.selectedEnvironmentSegmentId || ""}:${state.selectedEnvironmentObjectId || ""}`) {
    environmentAncestorIds(viewModel).forEach((id) => state.expandedEnvironmentIds.add(id));
    state.expandedEnvironmentSelectionId = `${state.selectedEnvironmentId}:${state.selectedEnvironmentSegmentId || ""}:${state.selectedEnvironmentObjectId || ""}`;
  }
  setCurrentAnnotationTarget(environmentUserTarget(viewModel), { pageTitle: "信息化环境安全能力映射" });
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
        }) || emptyState("环境图谱组件未加载")
      }
    `,
  );
  const basemapRoot = $("environmentDetail")?.querySelector("[data-environment-basemap-viewer-svg]");
  if (basemapRoot && components.EnvironmentBasemapViewer?.mount) {
    components.EnvironmentBasemapViewer.mount(basemapRoot);
  }
  components.EnvironmentScopeServiceMatrix?.mount?.($("environmentDetail"));
  updateEnvironmentPageSearchNavigation(viewModel);
  updatePageSearchControls();
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
      search: state.devLifecycleStageSearch,
    });
    const stageQuery = text(state.devLifecycleStageSearch).trim();
    const matchedStages = list(viewModel.stageTree).filter((row) => matchesTextQuery(stageQuery, row.title, row.code, row.order, row.searchText));
    if (stageQuery && matchedStages.length && !matchedStages.some((row) => row.id === viewModel.relationshipSummary?.selectedProcessId)) {
      viewModel = viewModels.buildApplicationSecurityLifecycleViewModel({
        lifecycleWorkbench: state.lifecycleWorkbench,
        lifecycleWorkbenchViewModel,
        lifecycle: state.lifecycle,
        selectedProcessId: matchedStages[0].id,
        search: state.devLifecycleStageSearch,
        selectionSource: "page_search",
      });
    }
    const devRenderSelectedProcessId = viewModel.relationshipSummary?.selectedProcessId || viewModel.selectedProcess?.id || null;
    if (!["search_preview", "target_missing"].includes(viewModel.selection?.status)) state.selectedDevProcessId = devRenderSelectedProcessId;
    updateLifecyclePageSearchNavigation("dev", matchedStages, state.devLifecycleStageSearch);
    setCurrentAnnotationTarget(lifecycleUserTarget(viewModel, "dev"), { pageTitle: "LC-AP安全开发生命周期" });
    if ($("devLifecycleStageSearch")) $("devLifecycleStageSearch").value = state.devLifecycleStageSearch;
    setText("devLifecyclePageTitle", "");
    setText("devLifecycleCount", viewModel.navigationTree.length);
    setText("devLifecycleType", viewModel.dataState || "LC-AP");
    setHtml(
      "devLifecycleNav",
      components.ApplicationSecurityLifecycle?.renderNavigation({
        stageTree: viewModel.stageTree,
        selectedProcessId: devRenderSelectedProcessId,
        search: state.devLifecycleStageSearch,
      }) || emptyState("安全开发阶段树组件未加载"),
    );
    setHtml(
      "devLifecycleLane",
      `
        ${components.ApplicationSecurityLifecycle?.renderStageOverview(viewModel) || ""}
        ${components.ApplicationSecurityLifecycle?.renderRelationTable({ rows: viewModel.relationRows, policyRows: viewModel.policyRows, overview: viewModel.stageOverview, searchQuery: state.devLifecycleStageSearch, mode: "dev", selectedStageId: devRenderSelectedProcessId, emptyMessage: viewModel.emptyState }) || ""}
      `,
    );
    setHtml("devLifecycleDetail", "");
    applyDevLifecycleCatalogState();
    updatePageSearchControls();
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
      search: state.dataLifecycleStageSearch,
    });
    const stageQuery = text(state.dataLifecycleStageSearch).trim();
    const matchedStages = list(viewModel.stageTree).filter((row) => matchesTextQuery(stageQuery, row.title, row.code, row.order, row.searchText));
    if (stageQuery && matchedStages.length && !matchedStages.some((row) => row.id === viewModel.relationshipSummary?.selectedProcessId)) {
      viewModel = viewModels.buildDataSecurityLifecycleViewModel({
        lifecycleWorkbench: state.lifecycleWorkbench,
        lifecycleWorkbenchViewModel,
        lifecycle: state.lifecycle,
        selectedProcessId: matchedStages[0].id,
        search: state.dataLifecycleStageSearch,
        selectionSource: "page_search",
      });
    }
    const dataRenderSelectedProcessId = viewModel.relationshipSummary?.selectedProcessId || viewModel.selectedProcess?.id || null;
    if (!["search_preview", "target_missing"].includes(viewModel.selection?.status)) state.selectedDataProcessId = dataRenderSelectedProcessId;
    updateLifecyclePageSearchNavigation("data", matchedStages, state.dataLifecycleStageSearch);
    setCurrentAnnotationTarget(lifecycleUserTarget(viewModel, "data"), { pageTitle: "LC-DT数据生命周期安全" });
    if ($("dataLifecycleStageSearch")) $("dataLifecycleStageSearch").value = state.dataLifecycleStageSearch;
    setText("dataLifecyclePageTitle", "");
    setText("dataLifecycleCount", viewModel.navigationTree.length);
    setText("dataLifecycleType", viewModel.dataState || "LC-DT");
    setHtml(
      "dataLifecycleNav",
      components.ApplicationSecurityLifecycle?.renderNavigation({
        stageTree: viewModel.stageTree,
        selectedProcessId: dataRenderSelectedProcessId,
        search: state.dataLifecycleStageSearch,
        kind: "data",
      }) || emptyState("数据生命周期过程树组件未加载"),
    );
    setHtml(
      "dataLifecycleMatrix",
      `
        ${components.ApplicationSecurityLifecycle?.renderStageOverview(viewModel) || ""}
        ${components.ApplicationSecurityLifecycle?.renderRelationTable({ rows: viewModel.relationRows, policyRows: viewModel.policyRows, overview: viewModel.stageOverview, searchQuery: state.dataLifecycleStageSearch, mode: "data", selectedStageId: dataRenderSelectedProcessId, emptyMessage: viewModel.emptyState }) || ""}
      `,
    );
    setHtml("dataLifecycleDetail", "");
    updatePageSearchControls();
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
    const frameworkLoadError = standardFrameworkLoadError(frameworkId);
    if (!loadedFramework && frameworkLoadError) {
      setHtml(
        "sourceList",
        `<div class="maintenance-empty-state">标准 / 框架数据加载失败：${escapeHtml(frameworkLoadError)}</div>`,
      );
      setText("sourceDetailType", "");
      setHtml("sourceDetail", "");
      return;
    }
    if (!loadedFramework) {
      setHtml("sourceList", `<div class="maintenance-empty-state">正在加载 ${escapeHtml(frameworkId)} 标准 / 框架数据...</div>`);
      const existingLoad = state.standardFrameworkLoads.get(frameworkId);
      const loadPromise =
        existingLoad ||
        dataClient
          .getStandardFramework(frameworkId)
          .then((envelope) => {
            clearStandardFrameworkLoadError(frameworkId);
            state.standards = {
              ...(state.standards || {}),
              loadedFrameworks: {
                ...(state.standards?.loadedFrameworks || {}),
                [frameworkId]: envelope?.data || { id: frameworkId, rows: [], tabs: [], loaded: true },
              },
            };
          })
          .catch((error) => {
            console.warn(`标准 / 框架加载失败：${frameworkId}`, error);
            setStandardFrameworkLoadError(frameworkId, error);
          })
          .finally(() => {
            state.standardFrameworkLoads.delete(frameworkId);
            if (state.activeMaintenancePage === "standards" && state.activeStandardFramework === frameworkId) renderMaintenance();
          });
      state.standardFrameworkLoads.set(frameworkId, loadPromise);
      return;
    }
    state.activeStandardTableId = activeStandardTableIdForFramework(loadedFramework);
    const activeTable = standardTableById(loadedFramework, state.activeStandardTableId);
    const activeTableLoading = ensureStandardFrameworkTableLoaded(frameworkId, state.activeStandardTableId);
    const activeTableLoadError = standardFrameworkLoadError(`${frameworkId}:${state.activeStandardTableId}`);
    if (activeTableLoadError) {
      setHtml(
        "sourceList",
        `<div class="maintenance-empty-state">标准 / 框架表格加载失败：${escapeHtml(activeTableLoadError)}</div>`,
      );
      setText("sourceDetailType", "");
      setHtml("sourceDetail", "");
      return;
    }
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
    management: maintenanceManagementForViewModel(viewModels),
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
  if (viewModel.selection?.status !== "target_missing") state.selectedMaintenanceId = viewModel.selectedId;
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
      ${renderSourceLocalSearchToolbar(viewModel, { standardsMode })}
      <div class="source-local-search-body">
        ${tableHtml || ""}
        ${knowledgeDirectoryMode && viewModel.rows.length ? `<div class="maintenance-table-endcap">已显示全部 ${escapeHtml(viewModel.rows.length)} 条记录</div>` : ""}
      </div>
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
  flushPageSearchReveal();
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
    "workbenchWorkspace",
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
    const minFor = (pane) => pane.classList.contains("workbench-review-queue") ? 520 : pane.classList.contains("workbench-review-inspector") ? 320 : 200;
    nextWidths[index] = Math.max(minFor(panes[index]), startWidths[index] + delta);
    nextWidths[index + 1] = Math.max(minFor(panes[index + 1]), startWidths[index + 1] - delta);
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
  const requestedContentId = text(state.selectedContentId).trim();
  const selectedById = requestedContentId ? rows.find((row) => row.id === requestedContentId) || null : null;
  const contentSelection = requestedContentId
    ? {
        status: selectedById ? "selected" : "target_missing",
        id: selectedById?.id || null,
        message: selectedById ? "" : `未定位到指南内容：${requestedContentId}`,
      }
    : {
        status: rows[0] ? "default_landing" : "empty",
        id: rows[0]?.id || null,
        message: rows[0] ? "" : "暂无内容视图",
      };
  if (!requestedContentId && contentSelection.id) state.selectedContentId = contentSelection.id;
  if (!contentSelection.id) state.selectedContentSlideIndex = 0;
  const titles = { html: "HTML 知识说明", drawio: "Draw.io 只读图", ppt: "PPT 使用说明" };
  const selected = selectedById || (!requestedContentId ? rows[0] : null);
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
      : rows.map((row) => `<button class="catalog-row ${row.id === selected?.id ? "active" : ""}" type="button" data-content-id="${escapeHtml(row.id)}"><span class="catalog-main"><strong>${escapeHtml(row.title || "未命名内容")}</strong><small>${escapeHtml(row.view_type || row.category || "")}</small></span><span class="catalog-meta"><span>${escapeHtml(row.slide_number || row.page_index || row.updated_at || "")}</span></span></button>`).join("") || emptyState(contentSelection.message || "暂无内容视图", "HTML / Draw.io / PPT 已预留入口")
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
      setHtml(
        "contentDetail",
        selected
          ? renderContentDetail(selected)
          : emptyState(contentSelection.message || "请选择内容")
      );
}

function globalSearchResultKey(result = {}, index = 0) {
  return text(result.key || [result.route, result.targetRef, result.targetText, result.title, index].filter(Boolean).join("::")).trim();
}

function globalSearchRouteLabel(route = "") {
  const components = window.sapdComponents || {};
  const routeInfo = components.AppShell?.getRouteInfo?.(route) || {};
  return text(routeInfo.item?.label || routeInfo.title || route).trim() || "未知页面";
}

function globalSearchResultCategory(result = {}) {
  const route = text(result.route).trim();
  if (route === "/capability-mapping") return "安全能力";
  if (route === "/environment-mapping") return "信息化环境";
  if (route === "/development-security" || route === "/data-security") return "生命周期";
  if (route.startsWith("/knowledge/")) return "知识库";
  if (route.startsWith("/standards")) return "标准 / 框架";
  if (route.startsWith("/guides/")) return "指南";
  if (route.startsWith("/workbench")) return "工作台";
  return text(result.typeLabel || "其他").trim() || "其他";
}

function globalSearchResultSnippet(result = {}, query = "") {
  const source = text(result.matchContext || result.match_context || result.summary || result.description || result.subtitle || result.searchText || result.targetText || "");
  const compact = cleanGlobalSearchDisplayText(source.replace(/\s+/g, " ").trim());
  if (!compact) return "该结果来自全局轻量索引，可打开目标页查看完整上下文。";
  const q = normalizeSearchText(query);
  const lower = normalizeSearchText(compact);
  const index = q ? lower.indexOf(q) : -1;
  if (index < 0) return compact.length > 120 ? `${compact.slice(0, 118)}...` : compact;
  const start = Math.max(0, index - 44);
  const end = Math.min(compact.length, index + q.length + 76);
  const prefix = start > 0 ? "..." : "";
  const suffix = end < compact.length ? "..." : "";
  return `${prefix}${compact.slice(start, end)}${suffix}`;
}

function globalSearchPageResults() {
  const filter = text(state.globalSearchPageFilter || "全部").trim() || "全部";
  const results = list(state.globalSearchPageResults);
  if (filter === "全部" || state.globalSearchPageLoadedFilter === filter) return results;
  return results.filter((result) => globalSearchResultCategory(result) === filter);
}

function globalSearchStatsForPage(results = state.globalSearchPageResults) {
  return state.globalSearchPageResultStats || state.globalSearchResultStats || globalSearchStatsFromResults(results, GLOBAL_SEARCH_PAGE_SIZE);
}

function globalSearchCategoryCount(stats, label, fallback = 0) {
  const targetLabel = text(label).trim() || "全部";
  const matched = list(stats?.categories).find((row) => row.label === targetLabel);
  return matched ? globalSearchFiniteNumber(matched.count, fallback) : fallback;
}

function globalSearchPageFilterRows(results = state.globalSearchResults) {
  const order = ["全部", "安全能力", "信息化环境", "生命周期", "知识库", "标准 / 框架", "指南", "工作台", "其他"];
  const fallbackCounts = globalSearchCategoryCountsFromResults(results);
  const stats = globalSearchStatsForPage(results);
  const statCounts = new Map(list(stats?.categories).map((row) => [row.label, globalSearchFiniteNumber(row.count, 0)]));
  return order
    .filter((label) => label === "全部" || statCounts.has(label) || fallbackCounts.has(label))
    .map((label) => ({ label, count: statCounts.get(label) ?? fallbackCounts.get(label) ?? 0 }));
}

function selectedGlobalSearchPageResult(results = globalSearchPageResults()) {
  const selectedKey = text(state.globalSearchPageSelectedKey).trim();
  const matched = list(results).find((result, index) => globalSearchResultKey(result, index) === selectedKey);
  return matched || list(results)[0] || null;
}

function globalSearchPageResultForKey(key, results = globalSearchPageResults()) {
  const targetKey = text(key).trim();
  if (!targetKey) return null;
  return list(results).find((result, index) => globalSearchResultKey(result, index) === targetKey) || null;
}

function clampGlobalSearchPageIndex(value, pageCount = 1) {
  const numeric = Number(value);
  const page = Number.isFinite(numeric) ? Math.trunc(numeric) : 1;
  return Math.min(Math.max(page, 1), Math.max(1, pageCount));
}

function globalSearchPaginationItems(currentPage, pageCount) {
  const lastPage = Math.max(1, Number(pageCount) || 1);
  if (lastPage <= 7) return Array.from({ length: lastPage }, (_, index) => index + 1);
  const pages = new Set([1, lastPage, currentPage - 1, currentPage, currentPage + 1]);
  return [...pages].filter((page) => page >= 1 && page <= lastPage).sort((a, b) => a - b);
}

function renderGlobalSearchPagination({ currentPage, pageCount, pageStart, pageEnd, activeTotal, loadedCount, placement = "bottom" }) {
  if (pageCount <= 1 && activeTotal <= GLOBAL_SEARCH_PAGE_SIZE) return "";
  const pages = globalSearchPaginationItems(currentPage, pageCount);
  const rangeText = `第 ${pageStart}-${pageEnd} 条 / 全量 ${activeTotal} 条`;
  let previousPage = 0;
  const pageButtons = pages
    .map((page) => {
      const gap = previousPage && page - previousPage > 1 ? `<span class="global-search-pagination-gap" aria-hidden="true">...</span>` : "";
      previousPage = page;
      return `${gap}<button class="global-search-pagination-button ${page === currentPage ? "is-current" : ""}" type="button" data-search-page-page="${page}" ${page === currentPage ? 'aria-current="page"' : ""}>${page}</button>`;
    })
    .join("");
  return `
    <nav class="global-search-pagination is-${escapeHtml(placement)}" aria-label="搜索结果分页">
      <span class="global-search-page-range">${escapeHtml(rangeText)}</span>
      <div class="global-search-pagination-pages">
        <button class="global-search-pagination-button is-boundary" type="button" data-search-page-page="${currentPage - 1}" ${currentPage <= 1 ? "disabled" : ""}>上一页</button>
        ${pageButtons}
        <button class="global-search-pagination-button is-boundary" type="button" data-search-page-page="${currentPage + 1}" ${currentPage >= pageCount ? "disabled" : ""}>下一页</button>
        <label class="global-search-pagination-jump">
          <span>跳至</span>
          <input type="number" min="1" max="${escapeHtml(String(pageCount))}" value="${escapeHtml(String(currentPage))}" data-search-page-jump-input />
          <span>/ ${escapeHtml(String(pageCount))}</span>
          <button type="button" data-search-page-jump>跳转</button>
        </label>
      </div>
    </nav>
  `;
}

function renderSearchPage() {
  const query = text(state.globalSearch).trim();
  const hasQuery = query.length >= GLOBAL_SEARCH_MIN_QUERY_LENGTH;
  const resultStats = globalSearchStatsForPage();
  const filters = globalSearchPageFilterRows();
  if (state.globalSearchPageFilter !== "全部" && !filters.some((row) => row.label === state.globalSearchPageFilter)) {
    state.globalSearchPageFilter = "全部";
  }
  const activeTotal = hasQuery ? globalSearchCategoryCount(resultStats, state.globalSearchPageFilter, list(state.globalSearchPageResults).length) : 0;
  const pageCount = Math.max(1, Math.ceil(Math.max(activeTotal, 0) / GLOBAL_SEARCH_PAGE_SIZE));
  state.globalSearchPageIndex = clampGlobalSearchPageIndex(state.globalSearchPageIndex, pageCount);
  const windowMatches = hasQuery && globalSearchPageWindowMatches(query, state.globalSearchPageFilter, state.globalSearchPageIndex);
  const needsLoad = hasQuery && !state.globalSearchPageLoading && !windowMatches;
  const isLoading = hasQuery && (state.globalSearchPageLoading || !windowMatches);
  const pageResults = hasQuery && !isLoading ? globalSearchPageResults() : [];
  const loadedCount = pageResults.length;
  const currentPage = hasQuery ? state.globalSearchPageIndex : 1;
  const pageStartIndex = (currentPage - 1) * GLOBAL_SEARCH_PAGE_SIZE;
  const pageStart = pageResults.length ? pageStartIndex + 1 : 0;
  const pageEnd = pageStartIndex + pageResults.length;
  const compactPage = hasQuery && !isLoading && activeTotal > 0 && activeTotal <= 3;
  const paginationTop = !isLoading && pageResults.length
    ? renderGlobalSearchPagination({ currentPage, pageCount, pageStart, pageEnd, activeTotal, loadedCount, placement: "top" })
    : "";
  const paginationBottom = !isLoading && pageResults.length
    ? renderGlobalSearchPagination({ currentPage, pageCount, pageStart, pageEnd, activeTotal, loadedCount, placement: "bottom" })
    : "";
  setHtml(
    "searchWorkspace",
    `
      <section class="global-search-page ${compactPage ? "is-compact" : ""}">
        <div class="global-search-page-sticky">
          <div class="global-search-page-toolbar">
            <label class="global-search-page-query" for="searchPageQueryInput">
              <span aria-hidden="true">⌕</span>
              <input id="searchPageQueryInput" type="search" value="${escapeHtml(query)}" placeholder="搜索能力、环境对象、流程、标准或关键字" autocomplete="off" data-search-history-kind="global" />
              <button type="button" data-search-page-submit>搜索</button>
            </label>
          </div>
          <div class="global-search-filter-strip" aria-label="搜索结果范围">
            ${filters
              .map(
                (row) => `
                  <button class="${row.label === state.globalSearchPageFilter ? "active" : ""}" type="button" data-search-page-filter="${escapeHtml(row.label)}">
                    <span>${escapeHtml(row.label)}</span>
                    <strong>${escapeHtml(String(row.count))}</strong>
                  </button>
                `,
              )
              .join("")}
          </div>
        </div>
        <div class="global-search-page-layout">
          <section class="global-search-page-results" aria-label="搜索结果列表">
            <div class="pane-head">
              <h2>结果队列</h2>
              ${paginationTop}
            </div>
            ${
              !hasQuery
                ? `<div class="global-search-page-empty"><strong>请输入关键词</strong><span>建议搜索能力编码、对象名称、安全技术服务、标准名称或流程关键词。</span></div>`
                : isLoading
                  ? `<div class="global-search-page-empty"><strong>正在搜索...</strong><span>优先读取轻量索引，不触发全量数据包加载。</span></div>`
                  : !pageResults.length
                    ? `<div class="global-search-page-empty"><strong>${activeTotal ? "当前页未返回结果" : "未找到匹配结果"}</strong><span>${activeTotal ? "请返回上一页，或使用页码跳转重新定位。" : "可以更换关键词，或进入具体模块使用页面内搜索。"}</span></div>`
                    : `<div class="global-search-page-list">
                        ${pageResults
                          .map((result, index) => {
                            const key = globalSearchResultKey(result, index);
                            const metaLine = globalSearchResultMetaLine(result);
                            return `
                              <article class="global-search-page-row" role="button" tabindex="0" data-search-page-result="${escapeHtml(key)}">
                                <span class="global-search-page-row-type">${escapeHtml(globalSearchResultCategory(result))}</span>
                                <span class="global-search-page-row-main">
                                  <strong>${escapeHtml(result.title || "未命名结果")}</strong>
                                  <small>${escapeHtml(metaLine)}</small>
                                  <em>${highlightSearchText(globalSearchResultSnippetLabel(result, query), query)}</em>
                                </span>
                              </article>
                            `;
                          })
                          .join("")}
                      </div>`
                      + paginationBottom
            }
          </section>
        </div>
      </section>
    `,
  );
  if (needsLoad) runGlobalSearchPage();
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
  if (state.activeView === "search") renderSearchPage();
  if (state.activeView === "workbench") renderWorkbench();
  if (state.activeView === "capabilities") renderCapabilities();
  if (state.activeView === "environment") renderEnvironment();
  if (state.activeView === "dev-lifecycle") renderLifecycle("dev");
  if (state.activeView === "data-lifecycle") renderLifecycle("data");
  if (state.activeView === "maintenance") renderMaintenance();
  if (state.activeView === "content") renderContent();
  if (state.activeView === "placeholder") renderPlaceholder();
  scheduleAnnotationAnchorMarkers("render-active-view");
  syncSearchInputs();
  flushPageSearchReveal();
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
  if (view === "environment" && previousView !== "environment") {
    state.activeEnvironmentTab = "topology";
  }
  state.activeView = view;
  restoreScopedSearch();
  document.body.dataset.activeView = view;
  for (const button of document.querySelectorAll(".module-tab")) {
    const active = button.dataset.view === view;
    button.classList.toggle("active", active);
    button.setAttribute("aria-current", active ? "page" : "false");
  }
  const workspaceMap = {
    overview: "overviewWorkspace",
    search: "searchWorkspace",
    workbench: "workbenchWorkspace",
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
  syncSearchInputs();
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
  document.addEventListener("click", suppressClickIfTextSelection, true);
  document.addEventListener("click", (event) => {
    const slideStep = event.target?.closest?.("[data-content-slide-step]");
    if (!slideStep) return;
    activateContentSlideStep(slideStep, event);
  }, true);
  document.addEventListener("click", (event) => {
    const routeButton = event.target?.closest?.("[data-app-route]");
    if (!routeButton) return;
    event.preventDefault();
    event.stopPropagation();
    activateRoute(routeButton.dataset.appRoute);
  }, true);
  document.addEventListener("click", (event) => {
    const reviewFilterButton = event.target.closest("[data-review-filter]");
    if (reviewFilterButton && (reviewFilterButton.closest("#workbenchWorkspace") || reviewFilterButton.closest("#appPageHeader"))) {
      const filter = text(reviewFilterButton.dataset.reviewFilter).trim() || "全部";
      if (filter === "高优先级") {
        state.workbenchIssueStatusFilter = "全部";
        state.workbenchIssuePriorityFilter = "高";
      } else {
        state.workbenchIssueStatusFilter = filter;
        state.workbenchIssuePriorityFilter = "全部";
      }
      state.workbenchSelectedIssueId = "";
      state.workbenchSelectedIssueIds = new Set();
      state.workbenchPendingDeleteIssueId = "";
      renderWorkbench();
      return;
    }

    const reviewScopeButton = event.target.closest(".workbench-review-scope-row");
    if (reviewScopeButton && reviewScopeButton.closest("#workbenchWorkspace")) {
      state.workbenchIssuePageFilter = text(reviewScopeButton.dataset.reviewPageRoute || "全部").trim() || "全部";
      state.workbenchSelectedIssueId = "";
      state.workbenchSelectedIssueIds = new Set();
      state.workbenchPendingDeleteIssueId = "";
      renderWorkbench();
      return;
    }

    const clearSelectionButton = event.target.closest("[data-review-clear-selection]");
    if (clearSelectionButton && clearSelectionButton.closest("#workbenchWorkspace")) {
      state.workbenchSelectedIssueIds = new Set();
      state.workbenchPendingDeleteIssueId = "";
      renderWorkbench();
      return;
    }

    const sortButton = event.target.closest("[data-review-sort-key]");
    if (sortButton && sortButton.closest("#workbenchWorkspace")) {
      setWorkbenchIssueSort(sortButton.dataset.reviewSortKey);
      renderWorkbench();
      return;
    }

    const clearFiltersButton = event.target.closest("[data-review-clear-filters]");
    if (clearFiltersButton && clearFiltersButton.closest("#workbenchWorkspace")) {
      state.workbenchIssueStatusFilter = "全部";
      state.workbenchIssuePageFilter = "全部";
      state.workbenchIssuePriorityFilter = "全部";
      state.workbenchIssueSearch = "";
      state.workbenchSelectedIssueIds = new Set();
      state.workbenchPendingDeleteIssueId = "";
      renderWorkbench();
      return;
    }

    const bulkStatusButton = event.target.closest("[data-review-bulk-status]");
    if (bulkStatusButton && bulkStatusButton.closest("#workbenchWorkspace")) {
      handleWorkbenchIssueBulkStatus(bulkStatusButton.dataset.reviewBulkStatus);
      return;
    }

    const selectedExportButton = event.target.closest("[data-review-export-selected]");
    if (selectedExportButton && (selectedExportButton.closest("#workbenchWorkspace") || selectedExportButton.closest("#appPageHeader"))) {
      handleWorkbenchIssueSelectedExport();
      return;
    }

    if (event.target.closest("[data-review-save]") && event.target.closest("#workbenchWorkspace")) {
      saveWorkbenchReviewInspector();
      return;
    }

    if (event.target.closest("[data-review-cancel]") && event.target.closest("#workbenchWorkspace")) {
      cancelWorkbenchReviewInspector();
      return;
    }

    const reviewStatusAction = event.target.closest("[data-review-status-action]");
    if (reviewStatusAction && reviewStatusAction.closest("#workbenchWorkspace")) {
      const status = reviewStatusAction.dataset.reviewStatusAction;
      const statusField = activeWorkbenchReviewPage()?.querySelector('[data-review-field="status"]');
      if (statusField && status) {
        statusField.value = status;
        setWorkbenchReviewDirty(true);
        saveWorkbenchReviewInspector();
      }
      return;
    }

    if (event.target.closest("[data-review-delete-cancel]") && event.target.closest("#workbenchWorkspace")) {
      state.workbenchPendingDeleteIssueId = ""; renderWorkbench(); return;
    }

    if (event.target.matches?.("[data-review-delete-backdrop]") && event.target.closest("#workbenchWorkspace")) {
      state.workbenchPendingDeleteIssueId = ""; renderWorkbench(); return;
    }

    if (event.target.closest("[data-review-delete-confirm]") && event.target.closest("#workbenchWorkspace")) {
      confirmWorkbenchIssueDelete();
      return;
    }

    if (event.target.closest("[data-review-delete]") && event.target.closest("#workbenchWorkspace")) {
      handleWorkbenchIssueDelete();
      return;
    }

    const reviewItem = event.target.closest("[data-review-item]");
    if (reviewItem && reviewItem.closest("#workbenchWorkspace") && !event.target.closest("input, select, textarea, button")) {
      selectWorkbenchReviewItem(reviewItem);
    }
  });
  document.addEventListener("click", (event) => {
    const exportButton = event.target.closest("[data-user-notes-export]");
    if (!exportButton) return;
    event.preventDefault();
    if (state.userNotesExporting) return;
    handleUserNotesExport();
  });
  document.querySelectorAll(".module-tab").forEach((button) => {
    if (!button.dataset.view || button.dataset.appRoute) return;
    button.addEventListener("click", () => {
      state.activeRoute = routeForCurrentState(button.dataset.view);
      setActiveView(button.dataset.view);
    });
  });
  document.addEventListener("compositionstart", (event) => {
    if (!isManagedSearchInput(event.target)) return;
    event.target.dataset.searchComposing = "true";
    state.composingSearchInputId = event.target.id || "";
  });
  document.addEventListener("compositionend", (event) => {
    if (!isManagedSearchInput(event.target)) return;
    event.target.dataset.searchComposing = "false";
    state.composingSearchInputId = "";
    event.target.dispatchEvent(new Event("input", { bubbles: true }));
  });
  document.addEventListener("focusin", (event) => {
    if (!event.target?.matches?.(SEARCH_HISTORY_INPUT_SELECTOR)) return;
    renderSearchHistoryPanel(event.target);
  });
  document.addEventListener("click", (event) => {
    const panel = event.target.closest("#searchHistoryPanel");
    const historyInput = event.target.closest(SEARCH_HISTORY_INPUT_SELECTOR);
    if (historyInput && !panel) {
      renderSearchHistoryPanel(historyInput);
      return;
    }
    if (!panel) {
      hideSearchHistoryPanel();
      return;
    }
    const kind = text(panel.dataset.searchHistoryKind).trim();
    const sourceInput = $(panel.dataset.searchHistoryInputId || "");
    const pick = event.target.closest("[data-search-history-pick]");
    if (pick) {
      event.preventDefault();
      event.stopPropagation();
      applySearchHistoryQuery(sourceInput, pick.dataset.searchHistoryPick);
      return;
    }
    const remove = event.target.closest("[data-search-history-remove]");
    if (remove) {
      event.preventDefault();
      event.stopPropagation();
      removeSearchHistoryItem(kind, remove.dataset.searchHistoryRemove);
      renderSearchHistoryPanel(sourceInput);
      return;
    }
    const clear = event.target.closest("[data-search-history-clear]");
    if (clear) {
      event.preventDefault();
      event.stopPropagation();
      clearSearchHistory(clear.dataset.searchHistoryClear);
      renderSearchHistoryPanel(sourceInput);
      return;
    }
    const expand = event.target.closest("[data-search-history-expand]");
    if (expand) {
      event.preventDefault();
      event.stopPropagation();
      state.searchHistoryExpandedKind = state.searchHistoryExpandedKind === kind ? "" : kind;
      renderSearchHistoryPanel(sourceInput);
    }
  }, true);
  $("searchInput")?.addEventListener("input", (event) => {
    if (isComposingSearchInput(event)) return;
    state.globalSearch = event.target.value.trim();
    scheduleSearchHistoryCommit(event.target, state.globalSearch);
    syncSearchInputs();
    runGlobalSearch();
  });
  $("searchInput")?.addEventListener("focus", () => {
    if (text(state.globalSearch).trim().length >= GLOBAL_SEARCH_MIN_QUERY_LENGTH) {
      state.globalSearchOpen = true;
      runGlobalSearch();
    }
  });
  $("searchInput")?.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      clearGlobalSearchPanel({ keepQuery: true });
      event.target.blur();
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      rememberCommittedSearchQuery("global", event.target.value);
      openGlobalSearchPage(event.target.value);
    }
  });
  $("globalSearchActionButton")?.addEventListener("click", () => {
    const input = $("searchInput");
    input?.focus();
    state.globalSearch = text(input?.value || state.globalSearch).trim();
    if (state.globalSearch.length >= GLOBAL_SEARCH_MIN_QUERY_LENGTH) {
      rememberCommittedSearchQuery("global", state.globalSearch);
      openGlobalSearchPage(state.globalSearch);
    }
  });
  document.addEventListener("pointerdown", (event) => { const resultButton = event.target.closest("[data-global-search-result]"); const result = resultButton ? state.globalSearchResults[Number(resultButton.dataset.globalSearchResult)] : null; if (result) { event.preventDefault(); activateGlobalSearchResult(result); } });
  document.addEventListener("click", (event) => {
    const viewAllButton = event.target.closest("[data-global-search-view-all]");
    if (viewAllButton) {
      event.preventDefault();
      rememberCommittedSearchQuery("global", state.globalSearch);
      openGlobalSearchPage(state.globalSearch);
      return;
    }
    const resultButton = event.target.closest("[data-global-search-result]");
    if (resultButton) {
      activateGlobalSearchResult(state.globalSearchResults[Number(resultButton.dataset.globalSearchResult)]);
      return;
    }
    if (!event.target.closest(".global-search") && !event.target.closest("#globalSearchPanel")) clearGlobalSearchPanel({ keepQuery: true });
  });
  document.addEventListener("click", (event) => {
    const submit = event.target.closest("[data-search-page-submit]");
    if (submit) {
      event.preventDefault();
      event.stopPropagation();
      const query = $("searchPageQueryInput")?.value || state.globalSearch;
      rememberCommittedSearchQuery("global", query);
      openGlobalSearchPage(query, { replace: true });
      return;
    }
    const filter = event.target.closest("[data-search-page-filter]");
    if (filter) {
      event.preventDefault();
      event.stopPropagation();
      state.globalSearchPageFilter = text(filter.dataset.searchPageFilter).trim() || "全部";
      state.globalSearchPageSelectedKey = "";
      state.globalSearchPageIndex = 1;
      state.globalSearchPageLoadedFilter = "";
      renderSearchPage();
      return;
    }
    const pageButton = event.target.closest("[data-search-page-page]");
    if (pageButton) {
      event.preventDefault();
      event.stopPropagation();
      const activeTotal = globalSearchCategoryCount(globalSearchStatsForPage(), state.globalSearchPageFilter, 0);
      const pageCount = Math.max(1, Math.ceil(activeTotal / GLOBAL_SEARCH_PAGE_SIZE));
      state.globalSearchPageIndex = clampGlobalSearchPageIndex(pageButton.dataset.searchPagePage, pageCount);
      state.globalSearchPageSelectedKey = "";
      renderSearchPage();
      return;
    }
    const jumpButton = event.target.closest("[data-search-page-jump]");
    if (jumpButton) {
      event.preventDefault();
      event.stopPropagation();
      const container = jumpButton.closest(".global-search-pagination");
      const input = container?.querySelector("[data-search-page-jump-input]");
      const activeTotal = globalSearchCategoryCount(globalSearchStatsForPage(), state.globalSearchPageFilter, 0);
      const pageCount = Math.max(1, Math.ceil(activeTotal / GLOBAL_SEARCH_PAGE_SIZE));
      state.globalSearchPageIndex = clampGlobalSearchPageIndex(input?.value, pageCount);
      state.globalSearchPageSelectedKey = "";
      renderSearchPage();
      return;
    }
    const row = event.target.closest("[data-search-page-result]");
    if (row) {
      event.preventDefault();
      event.stopPropagation();
      const result = globalSearchPageResultForKey(row.dataset.searchPageResult);
      activateGlobalSearchResult(result);
      return;
    }
  }, true);
  document.addEventListener("keydown", (event) => {
    if (event.target?.id !== "searchPageQueryInput") return;
    if (event.key !== "Enter") return;
    event.preventDefault();
    rememberCommittedSearchQuery("global", event.target.value);
    openGlobalSearchPage(event.target.value, { replace: true });
  });
  document.addEventListener("keydown", (event) => {
    if (!event.target?.matches?.("[data-search-page-jump-input]")) return;
    if (event.key !== "Enter") return;
    event.preventDefault();
    const container = event.target.closest(".global-search-pagination");
    container?.querySelector("[data-search-page-jump]")?.click();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    const row = event.target?.closest?.("[data-search-page-result]");
    if (!row) return;
    event.preventDefault();
    const result = globalSearchPageResultForKey(row.dataset.searchPageResult);
    activateGlobalSearchResult(result);
  });
  $("capabilitySearchInput")?.addEventListener("input", (event) => {
    if (isComposingSearchInput(event)) return;
    const cursor = event.target.selectionStart;
    scheduleSearchHistoryCommit(event.target, event.target.value);
    setScopedSearch(event.target.value);
    queuePageSearchReveal(event.target.value, "capability-mapping");
    renderCapabilities();
    flushPageSearchReveal();
    restoreSearchInputFocus("capabilitySearchInput", cursor);
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
    if (event.target?.matches?.("[data-review-select-all]") && event.target.closest("#workbenchWorkspace")) {
      const page = event.target.closest(".workbench-route-page");
      const visibleIds = Array.from(page?.querySelectorAll(".workbench-review-checkbox") || [])
        .map((checkbox) => text(checkbox.dataset.noteId).trim())
        .filter(Boolean);
      state.workbenchSelectedIssueIds = event.target.checked ? new Set(visibleIds) : new Set();
      state.workbenchSelectedIssueId = "";
      state.workbenchPendingDeleteIssueId = "";
      renderWorkbench();
      return;
    }
    if (event.target?.matches?.(".workbench-review-checkbox") && event.target.closest("#workbenchWorkspace")) {
      const noteId = text(event.target.dataset.noteId).trim(), isChecked = Boolean(event.target.checked);
      updateWorkbenchReviewSelection();
      if (isChecked && noteId) state.workbenchSelectedIssueId = noteId;
      else if (state.workbenchSelectedIssueId === noteId) state.workbenchSelectedIssueId = "";
      state.workbenchPendingDeleteIssueId = ""; renderWorkbench(); return;
    }
    const filterControl = event.target?.closest?.("[data-review-filter-control]");
    if (filterControl && filterControl.closest("#workbenchWorkspace")) {
      const control = filterControl.dataset.reviewFilterControl;
      if (control === "status") state.workbenchIssueStatusFilter = filterControl.value || "全部";
      if (control === "page") state.workbenchIssuePageFilter = filterControl.value || "全部";
      if (control === "priority") state.workbenchIssuePriorityFilter = filterControl.value || "全部";
      state.workbenchSelectedIssueIds = new Set();
      state.workbenchPendingDeleteIssueId = "";
      renderWorkbench();
      return;
    }
    if (event.target?.closest?.("[data-review-inspector]") && event.target.closest("#workbenchWorkspace")) {
      setWorkbenchReviewDirty(true);
      return;
    }
    const statusSelect = event.target?.closest?.("[data-user-note-status]");
    if (!statusSelect) return;
    handleUserNoteStatus(statusSelect.dataset.userNoteStatus, statusSelect.value);
  });
  document.addEventListener("input", (event) => {
    const filterControl = event.target?.closest?.("[data-review-filter-control='search']");
    if (filterControl && isComposingSearchInput(event)) return;
    if (filterControl && filterControl.closest("#workbenchWorkspace")) {
      state.workbenchIssueSearch = filterControl.value || "";
      scheduleSearchHistoryCommit(filterControl, filterControl.value);
      renderWorkbench();
      requestAnimationFrame(() => {
        const input = activeWorkbenchReviewPage()?.querySelector("[data-review-filter-control='search']");
        if (!input) return;
        input.focus();
        const end = text(input.value).length;
        input.setSelectionRange?.(end, end);
      });
      return;
    }
    if (!event.target?.closest?.("[data-review-inspector]") || !event.target.closest("#workbenchWorkspace")) return;
    setWorkbenchReviewDirty(true);
  });
  document.addEventListener("keydown", (event) => {
    const reviewItem = event.target?.closest?.("[data-review-item]");
    if (!reviewItem || !reviewItem.closest("#workbenchWorkspace")) return;
    if (event.key !== "Enter" && event.key !== " ") return;
    if (event.target.closest("input, select, textarea, button")) return;
    event.preventDefault();
    selectWorkbenchReviewItem(reviewItem);
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
  const previousCapabilityId = state.selectedCapabilityId;
  state.selectedCapabilityId = row.dataset.capabilityId;
  if (previousCapabilityId !== state.selectedCapabilityId) state.activeCapabilityRelationTab = "summary";
  const selectedType = capabilityItemTypeById(state.selectedCapabilityId);
  if (selectedType === "capability_focus") {
    ensureCapabilityProjectionForFocus(state.selectedCapabilityId);
  }
  renderCapabilities();
});
  $("detail")?.addEventListener("click", (event) => {
  const retry = event.target.closest("[data-capability-load-retry]");
  if (retry) {
    const retryKey = retry.dataset.capabilityLoadRetry || "";
    if (retryKey) state.capabilityProjectionLoadResults.delete(retryKey);
    const selectedType = capabilityItemTypeById(state.selectedCapabilityId);
    if (selectedType === "capability_focus" && retryKey.startsWith("capabilityProjection:")) {
      ensureCapabilityProjectionForFocus(state.selectedCapabilityId);
    } else {
      ensureCapabilityWorkspaceViewForSelection(state.selectedCapabilityId);
    }
    renderCapabilities();
    return;
  }
  const row = event.target.closest("[data-capability-id]");
  if (!row) return;
  const previousCapabilityId = state.selectedCapabilityId;
  state.selectedCapabilityId = row.dataset.capabilityId;
  if (previousCapabilityId !== state.selectedCapabilityId) state.activeCapabilityRelationTab = "summary";
  if (capabilityItemTypeById(state.selectedCapabilityId) === "capability_focus") ensureCapabilityProjectionForFocus(state.selectedCapabilityId);
  renderCapabilities();
  });
  $("capabilityFocusHeader")?.addEventListener("click", () => {});
  $("detail")?.addEventListener("change", (event) => {
    const tab = event.target.closest(".relation-view-radio");
    if (!tab) return;
    state.activeCapabilityRelationTab = tab.value || "summary";
    document.querySelectorAll("#capabilityViewControls .relation-view-tab").forEach((label) => {
      label.classList.toggle("is-active", label.getAttribute("for") === `capability-relation-tab-${state.activeCapabilityRelationTab}`);
    });
    persistWorkspaceState();
  });
  $("detail")?.addEventListener("input", (event) => {
    const input = event.target.closest("[data-relation-filter]");
    if (!input) return;
    if (isComposingSearchInput(event)) return;
    state.relationshipFilters[input.dataset.relationFilter] = input.value;
    queuePageSearchReveal(input.value);
    const field = input.dataset.relationFilter;
    const cursor = input.selectionStart;
    renderCapabilities();
    flushPageSearchReveal();
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
    if (isComposingSearchInput(event)) return;
    const cursor = event.target.selectionStart;
    scheduleSearchHistoryCommit(event.target, event.target.value);
    setScopedSearch(event.target.value);
    queuePageSearchReveal(event.target.value, "environment-mapping");
    renderEnvironment();
    flushPageSearchReveal();
    restoreSearchInputFocus("environmentSearchInput", cursor);
  });
  $("devLifecycleStageSearch")?.addEventListener("input", (event) => {
    if (isComposingSearchInput(event)) return;
    const cursor = event.target.selectionStart;
    scheduleSearchHistoryCommit(event.target, event.target.value);
    state.devLifecycleStageSearch = event.target.value.trim();
    queuePageSearchReveal(event.target.value, "development-security");
    renderLifecycle("dev");
    flushPageSearchReveal();
    restoreSearchInputFocus("devLifecycleStageSearch", cursor);
  });
  $("dataLifecycleStageSearch")?.addEventListener("input", (event) => {
    if (isComposingSearchInput(event)) return;
    const cursor = event.target.selectionStart;
    scheduleSearchHistoryCommit(event.target, event.target.value);
    state.dataLifecycleStageSearch = event.target.value.trim();
    queuePageSearchReveal(event.target.value, "data-security");
    renderLifecycle("data");
    flushPageSearchReveal();
    restoreSearchInputFocus("dataLifecycleStageSearch", cursor);
  });
  $("environmentDetail")?.addEventListener("click", (event) => {
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
      state.activeEnvironmentTab = objectRow ? "mapping" : event.target.closest(".environment-tab-panel-mapping") ? "mapping" : "topology";
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
  document.addEventListener("input", (event) => {
    if (event.target?.id !== "sourceSearchInput") return;
    if (isComposingSearchInput(event)) return;
    const cursor = event.target.selectionStart;
    scheduleSearchHistoryCommit(event.target, event.target.value);
    setScopedSearch(event.target.value);
    queuePageSearchReveal(event.target.value);
    renderMaintenance();
    flushPageSearchReveal();
    restoreSearchInputFocus("sourceSearchInput", cursor);
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
      restoreScopedSearch();
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
      restoreScopedSearch();
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
    restoreScopedSearch();
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
    window.requestAnimationFrame(updateWorkbenchPaneScrollAffordance);
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
    const pageSearchStep = event.target.closest("[data-page-search-step]");
    if (pageSearchStep) {
      event.preventDefault();
      event.stopPropagation();
      movePageSearchMatch(Number(pageSearchStep.dataset.pageSearchStep) || 1, pageSearchStep.dataset.pageSearchScope || searchScopeForCurrentState());
      return;
    }
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
    const noteJumpRetry = event.target.closest("[data-annotation-jump-retry]");
    if (noteJumpRetry) {
      jumpToUserNote(noteJumpRetry.dataset.annotationJumpRetry);
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
      state.activeEnvironmentTab = nextEnvironmentTab === "mapping" ? "mapping" : "topology";
      renderEnvironment();
      return;
    }
    const contentPage = event.target.closest("[data-content-page]");
    if (contentPage && contentPage.closest("#contentWorkspace")) {
      const switchContentPage = () => {
        state.activeContentPage = contentPage.dataset.contentPage;
        state.activeRoute = routeForCurrentState("content");
        restoreScopedSearch();
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
      activateContentSlideStep(slideStep, event);
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
  document.addEventListener("keydown", (event) => {
    if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== "k") return;
    event.preventDefault();
    const input = $("searchInput");
    input?.focus();
    input?.select?.();
  });
}

async function init() {
  const dataClient = window.sapdDataClient;
  if (!dataClient) throw new Error("SAPD Wiki dataClient 未加载");
  await loadScriptOnce("./models/relationGraphModel.js?v=capability-graph-focus-untangle-20260608-3", () => Boolean(window.sapdModels?.buildLocalRelationGraphModel));
  await loadScriptOnce("./components/LocalRelationNetworkGraph.js?v=capability-graph-controls-20260701-1", () => Boolean(window.sapdComponents?.LocalRelationNetworkGraph));
  await loadScriptOnce("./components/CapabilityLocalRelationMap.js?v=annotation-framework-anchor-20260605-1-oi156-anchor-20260630-1-oi159-overview-mode-20260701-1-capability-tabs-20260701-2-oi159-summary-20260701-1-oi159-title-tabs-20260701-1-oi159-title-baseline-20260701-1-oi159-summary-compact-20260702-1-oi159-attached-control-20260702-2-oi159-l2-summary-tabs-20260702-1-oi159-reader-summary-cards-20260702-1-oi159-definition-source-20260702-1-oi159-coverage-ratio-20260702-1-oi159-coverage-denominator-scale-20260702-1-oi159-service-coverage-scale-crop-20260702-1", () => Boolean(window.sapdComponents?.CapabilityLocalRelationMap));
  await loadScriptOnce("./models/environmentRelationGraphModel.js?v=environment-graph-20260521-1", () => Boolean(window.sapdModels?.buildEnvironmentRelationGraphModel));
  await loadScriptOnce("./components/EnvironmentLocalRelationMap.js?v=environment-backup-tab-removal-20260629-1-oi156-anchor-20260630-1-oi154-page-search-nav-20260703-1-oi154-search-p6-20260703-1-oi154-search-p7-20260703-1-oi154-search-p8-20260703-1-oi154-local-search-baseline-20260703-1-oi154-all-local-search-baseline-20260703-1-oi154-search-toolbar-align-20260703-1-oi154-env-search-tab-preserve-20260703-1-oi154-basemap-search-remove-20260703-1-oi154-default-shell-20260704-1-oi154-single-tab-state-20260704-1-oi185-domain-search-history-20260705-1", () => Boolean(window.sapdComponents?.EnvironmentLocalRelationMap));
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
