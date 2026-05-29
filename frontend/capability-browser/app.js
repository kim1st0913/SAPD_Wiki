const state = {
  capability: null,
  capabilityWorkbench: null,
  capabilityWorkbenchViewModel: null,
  capabilityInitial: null,
  capabilityProjection: null,
  sharedLookups: null,
  environmentWorkbench: null,
  environmentWorkbenchViewModel: null,
  lifecycle: null,
  lifecycleWorkbench: null,
  lifecycleWorkbenchViewModel: null,
  content: null,
  guidePackages: {},
  standards: null,
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
  activeContentPage: "html",
  selectedCapabilityId: null,
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
  contentSlideScrollMode: "preserve",
  standardFrameworkLoads: new Map(),
  loadedPackages: new Set(),
  packageLoads: new Map(),
  capabilityProjectionFallbackFocusIds: new Set(),
  capabilityProjectionRequestSeq: 0,
  activeCapabilityProjectionRequest: null,
  capabilityProjectionRequests: new Map(),
  search: "",
  pageHeaderSummary: [],
  pageHeaderNote: "",
  relationshipFilters: {},
  relationshipColumnWidths: [190, 180, 150, 160, 160, 150, 130, 160],
};

const $ = (id) => document.getElementById(id);
const list = (value) => (Array.isArray(value) ? value : []);
const text = (value) => (value == null ? "" : String(value));
const WORKSPACE_STATE_STORAGE_KEY = "sapd:workspace-state:v1";
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
        selectedMaintenanceId: state.selectedMaintenanceId,
        activeContentPage: state.activeContentPage,
        selectedContentId: state.selectedContentId,
        selectedContentSlideIndex: state.selectedContentSlideIndex,
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
  state.selectedMaintenanceId = snapshot.selectedMaintenanceId || state.selectedMaintenanceId;
  state.activeContentPage = snapshot.activeContentPage || state.activeContentPage;
  state.selectedContentId = snapshot.selectedContentId || state.selectedContentId;
  state.selectedContentSlideIndex = Number.isFinite(Number(snapshot.selectedContentSlideIndex)) ? Number(snapshot.selectedContentSlideIndex) : state.selectedContentSlideIndex;
}

const PACKAGE_GETTERS = {
  capability: "getCapabilityTree",
  capabilityWorkbench: "getCapabilityWorkbench",
  capabilityInitial: "getCapabilityWorkspaceInitial",
  capabilityProjection: "getCapabilityWorkspaceProjection",
  environmentWorkbench: "getEnvironmentWorkbench",
  lifecycleWorkbench: "getLifecycleWorkbench",
  maintenanceKnowledge: "getMaintenanceKnowledge",
  sharedLookups: "getSharedLookups",
  content: "getContentViews",
  securityArchitectureDesignGuide: "getSecurityArchitectureDesignGuide",
  dataSecurityDesignGuide: "getDataSecurityDesignGuide",
  standards: "getStandardFrameworks",
  lifecycle: "getLifecycleKnowledge",
};

const GUIDE_ROUTE_PACKAGES = {
  "/guides/security-architecture-design": "securityArchitectureDesignGuide",
  "/guides/data-security-design": "dataSecurityDesignGuide",
};

function assignPackageData(name, data) {
  if (name === "capability") state.capability = data;
  if (name === "capabilityInitial") {
    state.capabilityInitial = data;
    state.capabilityWorkbench = data;
    state.capability = capabilityTreeFromWorkbench(data);
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
  if (name === "maintenanceKnowledge") state.maintenanceKnowledge = data;
  if (name === "content") state.content = data;
  if (name === "securityArchitectureDesignGuide") state.guidePackages = { ...state.guidePackages, "security-architecture-design": data };
  if (name === "dataSecurityDesignGuide") state.guidePackages = { ...state.guidePackages, "data-security-design": data };
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
  if (state.activeView === "overview") return ["capabilityWorkbench", "environmentWorkbench", "lifecycleWorkbench", "content", "standards"];
  if (state.activeView === "capabilities") return ["capabilityInitial"];
  if (state.activeView === "environment") return ["environmentWorkbench"];
  if (state.activeView === "dev-lifecycle") return ["lifecycleWorkbench", "lifecycle"];
  if (state.activeView === "data-lifecycle") return ["lifecycleWorkbench", "lifecycle"];
  if (state.activeView === "content") {
    const guidePackage = GUIDE_ROUTE_PACKAGES[state.activeRoute];
    return guidePackage ? ["content", guidePackage] : ["content"];
  }
  if (state.activeView === "maintenance") {
    if (state.activeMaintenancePage === "standards") return ["standards"];
    const packages = ["maintenanceKnowledge"];
    if (state.activeMaintenancePage === "modules") packages.push("sharedLookups");
    if (state.activeMaintenancePage === "security-works") packages.push("capability");
    if (state.activeMaintenancePage === "lcap-references" || state.activeMaintenancePage === "application-systems") packages.push("lifecycle");
    return packages;
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
    Promise.all(["capabilityWorkbench", "environmentWorkbench", "lifecycleWorkbench"].map(loadDataPackage)).then(() => {
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
  return `${visible.map((item) => `<span class="relation-chip">${escapeHtml(titleOf(item))}</span>`).join("")}${more > 0 ? `<span class="relation-chip muted">+${more}</span>` : ""}`;
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

function renderSlideDeck(row) {
  const slides = contentSlides(row);
  if (!slides.length) return emptyState("暂无幻灯片", "请确认内容包是否包含 slide_count 或 slides。");
  const activeIndex = clampSlideIndex(slides);
  state.selectedContentSlideIndex = activeIndex;
  const activeSlide = slides[activeIndex];
  const previousDisabled = activeIndex <= 0 ? "disabled" : "";
  const nextDisabled = activeIndex >= slides.length - 1 ? "disabled" : "";
  return `
    <div class="guide-slide-player" data-guide-id="${escapeHtml(row.id)}">
      <div class="guide-slide-stage" tabindex="0" aria-label="${escapeHtml(`${row.title || "指南"}第 ${activeSlide.pageNumber} 页`)}">
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
          (slide, index) => `
            <button class="guide-thumb ${index === activeIndex ? "active" : ""}" type="button" data-content-slide-index="${index}" aria-label="查看第 ${slide.pageNumber} 页">
              <img src="${escapeHtml(slide.image)}" alt="" loading="lazy" />
              <span>${slide.pageNumber}</span>
            </button>
          `,
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
  const packages = [
    workbenchSummary({
      id: "capability",
      label: "安全能力映射",
      shortLabel: "能力",
      route: "/capability-mapping",
      workbench: state.capabilityWorkbench,
      tone: "blue",
      dimensions: ["能力", "关注点", "作用域", "服务", "模块", "标准"],
    }),
    workbenchSummary({
      id: "environment",
      label: "信息化环境维度",
      shortLabel: "环境",
      route: "/environment-mapping",
      workbench: state.environmentWorkbench,
      tone: "green",
      dimensions: ["环境", "对象", "作用域", "服务", "系统", "产品"],
    }),
    workbenchSummary({
      id: "lifecycle",
      label: "LC-AP安全开发生命周期",
      shortLabel: "LC-AP",
      route: "/development-security",
      workbench: state.lifecycleWorkbench,
      tone: "amber",
      dimensions: ["阶段", "活动", "策略", "服务", "模块", "措施"],
    }),
    workbenchSummary({
      id: "data-lifecycle",
      label: "LC-DT数据生命周期安全",
      shortLabel: "LC-DT",
      route: "/data-security",
      workbench: state.lifecycleWorkbench,
      tone: "green",
      dimensions: ["过程", "场景", "服务", "模块", "措施"],
    }),
  ];
  const readyCount = packages.filter((item) => item.dataState === "ready").length;
  const objectTotal = packages.reduce((sum, item) => sum + item.objectTotal, 0);
  const relationTotal = packages.reduce((sum, item) => sum + item.relationTotal, 0);
  const evidenceTotal = packages.reduce((sum, item) => sum + item.evidenceTotal, 0);
  return {
    packages,
    readyCount,
    objectTotal,
    relationTotal,
    evidenceTotal,
    standardsTotal: Number(state.standards?.stats?.controls) || 0,
    contentViews: Number(state.content?.stats?.html_documents || 0) + Number(state.content?.stats?.diagram_views || 0) + Number(state.content?.stats?.guide_pages || 0),
  };
}

function renderDashboardMetric({ label, value, hint, tone = "neutral" }) {
  return `
    <div class="dashboard-metric dashboard-tone-${escapeHtml(tone)}">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(formatNumber(value))}</strong>
      <small>${escapeHtml(hint)}</small>
    </div>
  `;
}

function renderDashboardBarRows(packages, key) {
  const max = Math.max(...packages.map((item) => Number(item[key]) || 0), 1);
  return packages
    .map(
      (item) => `
        <div class="dashboard-bar-row">
          <span>${escapeHtml(item.shortLabel)}</span>
          <div class="dashboard-bar-track"><i class="dashboard-tone-${escapeHtml(item.tone)}" style="width:${percentOf(item[key], max)}%"></i></div>
          <strong>${escapeHtml(formatNumber(item[key]))}</strong>
        </div>
      `,
    )
    .join("");
}

function renderDashboardDonut(packages, total) {
  const colors = [
    "oklch(0.49 0.055 224)",
    "oklch(0.51 0.048 150)",
    "oklch(0.56 0.054 48)",
    "oklch(0.53 0.05 300)",
  ];
  let cursor = 0;
  const stops = packages
    .map((item, index) => {
      const start = cursor;
      const end = total ? cursor + (item.objectTotal / total) * 100 : cursor;
      cursor = end;
      return `${colors[index]} ${start}% ${end}%`;
    })
    .join(", ");
  return `
    <div class="dashboard-donut-wrap">
      <div class="dashboard-donut" style="background:conic-gradient(${escapeHtml(stops || "oklch(0.86 0.014 86) 0% 100%")})">
        <div><strong>${escapeHtml(formatNumber(total))}</strong><span>对象</span></div>
      </div>
      <div class="dashboard-legend">
        ${packages
          .map(
            (item, index) => `
              <div><i style="background:${colors[index]}"></i><span>${escapeHtml(item.label)}</span><strong>${escapeHtml(`${percentOf(item.objectTotal, total)}%`)}</strong></div>
            `,
          )
          .join("")}
      </div>
    </div>
  `;
}

function renderDashboardSatellite(packages) {
  return `
    <div class="dashboard-satellite" aria-label="业务关系卫星图">
      <span class="satellite-line satellite-line-capability"></span>
      <span class="satellite-line satellite-line-environment"></span>
      <span class="satellite-line satellite-line-lifecycle"></span>
      <span class="satellite-line satellite-line-standards"></span>
      <span class="satellite-line satellite-line-content"></span>
      <button class="satellite-node satellite-hub" type="button" data-app-route="/" data-view="overview">
        <strong>SAPD Wiki</strong>
        <small>本地关系工作台</small>
      </button>
      ${packages
        .map(
          (item, index) => `
            <button class="satellite-node satellite-${escapeHtml(item.id)} dashboard-tone-${escapeHtml(item.tone)}" type="button" data-app-route="${escapeHtml(item.route)}">
              <strong>${escapeHtml(item.label)}</strong>
              <small>${escapeHtml(`${formatNumber(item.objectTotal)} 对象 / ${formatNumber(item.relationTotal)} 关系`)}</small>
            </button>
          `,
        )
        .join("")}
      <button class="satellite-node satellite-standards" type="button" data-app-route="/standards">
        <strong>安全标准 / 框架</strong>
        <small>${escapeHtml(formatNumber(state.standards?.stats?.frameworks || 0))} 框架 / ${escapeHtml(formatNumber(state.standards?.stats?.controls || 0))} 控制项</small>
      </button>
      <button class="satellite-node satellite-content" type="button" data-app-route="/guides">
        <strong>安全指南</strong>
        <small>${escapeHtml(formatNumber((state.content?.stats?.html_documents || 0) + (state.content?.stats?.diagram_views || 0) + (state.content?.stats?.guide_pages || 0)))} 个内容视图</small>
      </button>
    </div>
  `;
}

function renderOverview() {
  const summary = dashboardSummaries();
  const dataStateLabel = summary.readyCount === summary.packages.length ? "ready" : "loading";
  setHtml(
    "overviewWorkspace",
    `
      <section class="dashboard-hero">
        <div>
          <span class="dashboard-kicker">SAPD Wiki / Dashboard</span>
          <h2>数据关系总览</h2>
          <p>把安全能力、信息化环境、LC-AP / LC-DT 生命周期、标准框架和指南内容集中成一页，用统计图和关系图快速判断当前知识库覆盖情况。</p>
        </div>
        <div class="dashboard-state">
          <span>${escapeHtml(dataStateLabel)}</span>
          <strong>${escapeHtml(`${summary.readyCount}/${summary.packages.length}`)}</strong>
          <small>Workbench 数据包</small>
        </div>
      </section>
      <section class="dashboard-metric-grid">
        ${renderDashboardMetric({ label: "Workbench 数据包", value: summary.readyCount, hint: "能力 / 环境 / LC-AP / LC-DT", tone: "blue" })}
        ${renderDashboardMetric({ label: "对象总数", value: summary.objectTotal, hint: "四个入口 workbench 合计", tone: "green" })}
        ${renderDashboardMetric({ label: "关系总数", value: summary.relationTotal, hint: "关系端点投影合计", tone: "amber" })}
        ${renderDashboardMetric({ label: "来源引用", value: summary.evidenceTotal, hint: "来源证据引用合计", tone: "purple" })}
        ${renderDashboardMetric({ label: "标准控制项", value: summary.standardsTotal, hint: "安全标准 / 框架索引", tone: "slate" })}
        ${renderDashboardMetric({ label: "内容视图", value: summary.contentViews, hint: "HTML / 图 / 指南页", tone: "neutral" })}
      </section>
      <section class="dashboard-grid dashboard-grid-primary">
        <article class="dashboard-panel dashboard-panel-bars">
          <header>
            <div>
              <h3>Workbench 统计柱状图</h3>
              <p>按对象、关系、来源三个维度比较当前核心页面的数据体量。</p>
            </div>
            <span class="dashboard-chip">统计</span>
          </header>
          <div class="dashboard-bars">
            <section><h4>对象</h4>${renderDashboardBarRows(summary.packages, "objectTotal")}</section>
            <section><h4>关系</h4>${renderDashboardBarRows(summary.packages, "relationTotal")}</section>
            <section><h4>来源</h4>${renderDashboardBarRows(summary.packages, "evidenceTotal")}</section>
          </div>
        </article>
        <article class="dashboard-panel">
          <header>
            <div>
              <h3>对象分布饼图</h3>
              <p>三份 workbench 的对象规模占比。</p>
            </div>
            <span class="dashboard-chip">占比</span>
          </header>
          ${renderDashboardDonut(summary.packages, summary.objectTotal)}
        </article>
      </section>
      <section class="dashboard-grid dashboard-grid-secondary">
        <article class="dashboard-panel dashboard-panel-satellite">
          <header>
            <div>
              <h3>业务关系卫星图</h3>
              <p>以全局导航为中心，连接当前可用页面和内容索引。</p>
            </div>
            <span class="dashboard-chip">关系</span>
          </header>
          ${renderDashboardSatellite(summary.packages)}
        </article>
        <article class="dashboard-panel">
          <header>
            <div>
              <h3>页面数据维度</h3>
              <p>每个入口当前承载的主要业务维度。</p>
            </div>
            <span class="dashboard-chip">维度</span>
          </header>
          <div class="dashboard-package-list">
            ${summary.packages
              .map(
                (item) => `
                  <button class="dashboard-package-row" type="button" data-app-route="${escapeHtml(item.route)}">
                    <span class="dashboard-package-title"><strong>${escapeHtml(item.label)}</strong><small>${escapeHtml(item.dimensions.join(" / "))}</small></span>
                    <span><b>${escapeHtml(formatNumber(item.objectTotal))}</b><small>对象</small></span>
                    <span><b>${escapeHtml(formatNumber(item.relationTotal))}</b><small>关系</small></span>
                    <i>${escapeHtml(item.dataState)}</i>
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
            <h3>全局导航页面矩阵</h3>
            <p>从 dashboard 直接进入各工作台，主展示区只呈现业务维度和统计，不暴露来源追踪中间字段。</p>
          </div>
          <span class="dashboard-chip">导航</span>
        </header>
        <div class="dashboard-table-wrap">
          <table class="dashboard-table">
            <thead><tr><th>页面</th><th>图形表达</th><th>核心对象</th><th>关系</th><th>来源引用</th><th>状态</th></tr></thead>
            <tbody>
              ${summary.packages
                .map(
                  (item) => `
                    <tr>
                      <td><button type="button" data-app-route="${escapeHtml(item.route)}">${escapeHtml(item.label)}</button><small>${escapeHtml(item.dimensions.join("、"))}</small></td>
                      <td>${escapeHtml(item.id === "capability" ? "树图 / 矩阵 / 关系图" : item.id === "environment" ? "树图 / 链路图 / 矩阵" : "阶段表 / 关系表 / 统计图")}</td>
                      <td>${escapeHtml(formatNumber(item.objectTotal))}</td>
                      <td>${escapeHtml(formatNumber(item.relationTotal))}</td>
                      <td>${escapeHtml(formatNumber(item.evidenceTotal))}</td>
                      <td><span class="dashboard-status">${escapeHtml(item.dataState)}</span></td>
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
  components.AppShell?.mountApplicationShell?.({ activeRoute: state.activeRoute });
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
  return normalizeAppRoute(window.location.pathname || "/");
}

function syncBrowserRoute(route, { replace = false } = {}) {
  const normalized = normalizeAppRoute(route);
  const nextHash = normalized === "/" ? "" : `#${normalized}`;
  if (window.location.hash === nextHash) return;
  const nextUrl = `${window.location.pathname}${window.location.search}${nextHash}`;
  if (replace) window.history.replaceState({ route: normalized }, "", nextUrl);
  else window.history.pushState({ route: normalized }, "", nextUrl);
}

function activateRoute(route, options = {}) {
  const components = window.sapdComponents || {};
  const target = components.AppShell?.getRouteTarget?.(normalizeAppRoute(route)) || { route: "/", view: "overview" };
  state.activeRoute = target.route || "/";
  applyRouteTarget(target);
  setActiveView(target.view || "overview", { syncRoute: false });
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
  components.AppShell?.updateApplicationShell?.({ activeRoute: state.activeRoute, activeView: state.activeView });
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

function renderCapabilities() {
  const viewModels = window.sapdViewModels;
  const components = window.sapdComponents || {};
  ensureCapabilityCatalogToggle();
  if (!state.capability || (!state.loadedPackages.has("capabilityInitial") && !state.loadedPackages.has("capabilityWorkbench"))) {
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
  if (capabilitySelectionNeedsFullWorkbench(selectedType)) {
    loadDataPackage("capabilityWorkbench").then(() => {
      if (state.activeView === "capabilities") renderCapabilities();
    });
  }
  const isFocusProjectionPending =
    selectedType === "capability_focus" &&
    !capabilityProjectionHasFocus(state.selectedCapabilityId) &&
    !capabilityWorkbenchHasFullRelations();
  if (isFocusProjectionPending) {
    ensureCapabilityProjectionForFocus(state.selectedCapabilityId);
  }
  const capabilityWorkbenchViewModel =
    viewModels.buildCapabilityWorkbenchViewModel?.({ workbench: state.capabilityWorkbench }) || state.capabilityWorkbenchViewModel;
  state.capabilityWorkbenchViewModel = capabilityWorkbenchViewModel;
  const viewModel = viewModels.buildCapabilityWorkspaceViewModel({
    capabilityWorkbench: state.capabilityWorkbench,
    capabilityWorkbenchViewModel,
    capabilityTree: state.capability,
    capabilityProjection: state.capabilityProjection,
    management: mergeSharedLookups(state.maintenanceKnowledge),
    selectedCapabilityId: state.selectedCapabilityId,
    search: state.search,
    relationshipFilters: state.relationshipFilters,
  });
  const hadSelectedCapability = Boolean(state.selectedCapabilityId);
  if (!state.selectedCapabilityId) state.selectedCapabilityId = viewModel.selectedCapability?.id || null;
  if (!hadSelectedCapability && viewModel.selectedCapability?.type === "capability_category" && state.selectedCapabilityId) {
    capabilityCategoryIds().forEach((id) => state.expandedCapabilityIds.add(id));
  }
  if (state.selectedCapabilityId && state.expandedSelectionId !== state.selectedCapabilityId) {
    capabilityAncestorIds(state.selectedCapabilityId).forEach((id) => state.expandedCapabilityIds.add(id));
    state.expandedSelectionId = state.selectedCapabilityId;
  }
  setHtml(
    "tree",
    components.DimensionTree?.render({
      navigationTree: viewModel.navigationTree,
      selectedCapabilityId: state.selectedCapabilityId,
      expandedIds: state.expandedCapabilityIds,
      search: state.search,
    }) || emptyState("能力树组件未加载"),
  );
  const selected = viewModel.selectedCapability;
  if (!selected) {
    setHtml("capabilityFocusHeader", "");
    setHtml("detail", emptyState("暂无能力关系数据"));
    return;
  }
  if (isFocusProjectionPending && state.packageLoads.has(capabilityProjectionLoadKey(state.selectedCapabilityId))) {
    setHtml("capabilityFocusHeader", "");
    setHtml("detail", emptyState("正在加载当前关注点关系数据", "关系投影加载完成后会自动显示。"));
    applyCapabilityCatalogState();
    return;
  }
  setHtml(
    "capabilityFocusHeader",
    components.CapabilityLocalRelationMap?.renderFocusStrip?.(viewModel.localRelationMap, viewModel.focusOverview) || "",
  );
  const detailInspector = viewModel.detailInspector;
  setHtml(
    "detail",
    `
      ${
        components.CapabilityLocalRelationMap?.render({
          localRelationMap: viewModel.localRelationMap,
          focusOverview: viewModel.focusOverview,
          technicalMappingRows: viewModel.technicalMappingRows,
          managementMappingRows: viewModel.managementMappingRows,
          standardMappingRows: viewModel.standardMappingRows,
        }) || emptyState("局部关系图组件未加载")
      }
    `,
  );
  applyCapabilityCatalogState();
}

function renderEnvironment() {
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
        }) || emptyState("环境图谱组件未加载")
      }
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
        ${components.ApplicationSecurityLifecycle?.renderRelationTable({ rows: viewModel.relationRows, overview: viewModel.stageOverview }) || ""}
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
        ${components.ApplicationSecurityLifecycle?.renderRelationTable({ rows: viewModel.relationRows, overview: viewModel.stageOverview }) || ""}
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
  if (state.activeMaintenancePage === "standards" && !state.loadedPackages.has("standards")) {
    setText("sourcePageTitle", "标准 / 框架");
    setText("sourcePageCount", 0);
    setHtml("maintenanceNavigation", "");
    setHtml("sourceList", `<div class="maintenance-empty-state">正在加载标准 / 框架索引...</div>`);
    setText("sourceDetailType", "");
    setHtml("sourceDetail", "");
    return;
  }
  if (state.activeMaintenancePage !== "standards" && !state.loadedPackages.has("maintenanceKnowledge")) {
    setText("sourcePageTitle", "安全知识");
    setText("sourcePageCount", 0);
    setHtml("maintenanceNavigation", "");
    setHtml("sourceList", `<div class="maintenance-empty-state">正在加载安全知识目录...</div>`);
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
  }
  const viewModel = viewModels.buildMaintenanceWorkspaceViewModel({
    capabilityTree: state.capability,
    management: mergeSharedLookups(state.maintenanceKnowledge),
    lifecycle: state.lifecycle,
    standards: state.standards,
    section: state.activeMaintenancePage,
    selectedId: state.selectedMaintenanceId,
    search: state.search,
    referenceTab: state.activeReferenceTab,
    standardFrameworkId: state.activeStandardFramework,
  });
  state.activeMaintenancePage = viewModel.section;
  state.activeReferenceTab = viewModel.referenceTab || state.activeReferenceTab;
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
  if (viewModel.section === "scopes") {
    tableHtml = components.ScopeMaintenanceTable?.render({ rows: viewModel.rows, selectedId: viewModel.selectedId, emptyState: viewModel.emptyState }) || tableHtml;
  } else if (viewModel.section === "processes") {
    tableHtml = components.ProcessMaintenanceTable?.render({ rows: viewModel.rows, selectedId: viewModel.selectedId, emptyState: viewModel.emptyState }) || tableHtml;
  } else if (viewModel.section === "work-functions") {
    tableHtml = components.WorkFunctionMaintenanceTable?.render({ rows: viewModel.rows, selectedId: viewModel.selectedId, emptyState: viewModel.emptyState }) || tableHtml;
  } else if (viewModel.section === "security-works") {
    tableHtml = components.SecurityWorkMaintenanceTable?.render({ rows: viewModel.rows, selectedId: viewModel.selectedId, emptyState: viewModel.emptyState }) || tableHtml;
  } else if (viewModel.section === "services") {
    tableHtml =
      components.TechnicalServiceMaintenanceTable?.render({
        rows: viewModel.rows,
        scopeGroups: viewModel.serviceScopeGroups,
        selectedId: viewModel.selectedId,
        emptyState: viewModel.emptyState,
      }) || tableHtml;
  } else if (viewModel.section === "modules") {
    tableHtml = components.TechnologyModuleMaintenanceTable?.render({ rows: viewModel.rows, selectedId: viewModel.selectedId, emptyState: viewModel.emptyState }) || tableHtml;
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
    tableHtml =
      components.StandardRoleReferenceTable?.render({
        standardRows: viewModel.standardRows,
        roleRows: viewModel.roleRows,
        selectedId: viewModel.selectedId,
        emptyState: viewModel.emptyState,
        activeTab: viewModel.referenceTab,
      }) || tableHtml;
  } else if (viewModel.section === "standards") {
    tableHtml =
      components.StandardFrameworkTable?.render({
        activeFrameworkId: viewModel.activeFrameworkId,
        rows: viewModel.rows,
        columns: viewModel.columns,
        tables: viewModel.tables,
        selectedId: viewModel.selectedId,
        emptyState: viewModel.emptyState,
        focusByCode: capabilityFocusByCode(state.capability),
      }) || tableHtml;
  }
  setHtml(
    "sourceList",
    `
      ${standardsMode ? "" : components.MaintenanceShell?.render({ viewModel }) || ""}
      ${tableHtml || ""}
      ${knowledgeDirectoryMode && viewModel.rows.length ? `<div class="maintenance-table-endcap">已显示全部 ${escapeHtml(viewModel.rows.length)} 条记录</div>` : ""}
    `,
  );
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
  const navigationCounts = Object.fromEntries(list(viewModel.navigationItems).map((item) => [item.id, Number(item.count) || 0]));
  const sectionTabCounts = Object.fromEntries(list(viewModel.sectionTabs).map((tab) => [tab.id, Number(tab.count) || 0]));
  const counts = { ...navigationCounts, ...sectionTabCounts };
  const labels = {
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
  const navList = $("contentNavList");
  const previousThumbScrollTop = navList?.scrollTop || 0;
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
  if (!state.selectedContentId || !rows.some((row) => row.id === state.selectedContentId)) state.selectedContentId = rows[0]?.id || null;
  if (!state.selectedContentId) state.selectedContentSlideIndex = 0;
  const titles = { html: "HTML 知识说明", drawio: "Draw.io 只读图", ppt: "PPT 使用说明" };
  const selected = rows.find((row) => row.id === state.selectedContentId);
  const selectedSlides = contentSlides(selected);
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
  setText("contentPageTitle", selected?.title || titles[state.activeContentPage]);
  setText("contentPageCount", selectedSlides.length || rows.length);
  setHtml(
    "contentNavList",
    isSlideDeck
      ? renderSlidePreviewRail(selected)
      : isSpecificGuideRoute && !rows.length
        ? emptyState("暂无页面预览", "该指南内容待补充。")
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
  setHtml(
    "contentList",
    isSlideDeck
      ? renderSlideDeck(selected)
      : isSpecificGuideRoute && !rows.length
        ? emptyState("暂无指南内容", "当前二级页面已预留，尚未绑定数据包。")
      : rows.map((row) => `<button class="catalog-row ${row.id === state.selectedContentId ? "active" : ""}" type="button" data-content-id="${escapeHtml(row.id)}"><span class="catalog-main"><strong>${escapeHtml(row.title || "未命名内容")}</strong><small>${escapeHtml(row.view_type || row.category || "")}</small></span><span class="catalog-meta"><span>${escapeHtml(row.slide_number || row.page_index || row.updated_at || "")}</span></span></button>`).join("") || emptyState("暂无内容视图", "HTML / Draw.io / PPT 已预留入口"),
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
  renderMetrics();
  if (state.activeView === "overview") renderOverview();
  if (state.activeView === "capabilities") renderCapabilities();
  if (state.activeView === "environment") renderEnvironment();
  if (state.activeView === "dev-lifecycle") renderLifecycle("dev");
  if (state.activeView === "data-lifecycle") renderLifecycle("data");
  if (state.activeView === "maintenance") renderMaintenance();
  if (state.activeView === "content") renderContent();
  if (state.activeView === "placeholder") renderPlaceholder();
}

function setActiveView(view, options = {}) {
  const previousView = state.activeView;
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
    if (event.target?.name !== "environmentDetailTab") return;
    state.activeEnvironmentTab = event.target.id === "environmentTabMapping" ? "mapping" : "topology";
  });
  document.addEventListener("input", (event) => {
    if (event.target?.id !== "sourceSearchInput") return;
    state.search = event.target.value.trim();
    renderMaintenance();
  });
  document.addEventListener("click", (event) => {
    const button = event.target.closest("[data-source-page]");
    if (!button) return;
    if (!button.closest("#maintenanceWorkspace")) return;
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
  });
  $("sourceList")?.addEventListener("click", (event) => {
    const tab = event.target.closest("[data-reference-tab]");
    if (tab && !tab.dataset.sourcePage) {
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
  document.addEventListener("keydown", (event) => {
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
    const contentPage = event.target.closest("[data-content-page]");
    if (contentPage && contentPage.closest("#contentWorkspace")) {
      state.activeContentPage = contentPage.dataset.contentPage;
      state.activeRoute = routeForCurrentState("content");
      state.selectedContentId = null;
      state.selectedContentSlideIndex = 0;
      renderContent();
      syncBrowserRoute(state.activeRoute);
      ensureRoutePackages();
      updateApplicationShellChrome();
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
  await loadScriptOnce("./models/relationGraphModel.js?v=capability-graph-strategy-20260526-1", () => Boolean(window.sapdModels?.buildLocalRelationGraphModel));
  await loadScriptOnce("./components/LocalRelationNetworkGraph.js?v=capability-graph-strategy-20260526-2", () => Boolean(window.sapdComponents?.LocalRelationNetworkGraph));
  await loadScriptOnce("./components/CapabilityLocalRelationMap.js?v=capability-graph-strategy-20260526-5", () => Boolean(window.sapdComponents?.CapabilityLocalRelationMap));
  await loadScriptOnce("./models/environmentRelationGraphModel.js?v=environment-graph-20260521-1", () => Boolean(window.sapdModels?.buildEnvironmentRelationGraphModel));
  await loadScriptOnce("./components/EnvironmentLocalRelationMap.js?v=environment-tabs-20260528-5", () => Boolean(window.sapdComponents?.EnvironmentLocalRelationMap));
  mountAppShellComponents();
  bindEvents();
  const restoredState = readWorkspaceState();
  const restoreRouteFromLocation = () => {
    activateRoute(routeFromBrowserLocation(), { fromBrowser: true });
  };
  window.addEventListener("hashchange", restoreRouteFromLocation);
  window.addEventListener("popstate", restoreRouteFromLocation);
  const browserRoute = routeFromBrowserLocation();
  const restoredRoute = normalizeAppRoute(restoredState?.activeRoute || "");
  const initialRoute = browserRoute === "/" && restoredRoute !== "/" ? restoredRoute : browserRoute;
  activateRoute(initialRoute, { replace: true });
  if (restoredRoute === state.activeRoute) applyWorkspaceState(restoredState);
  persistWorkspaceState();
  renderActiveView();
  scheduleOverviewWarmup();
}

init();
