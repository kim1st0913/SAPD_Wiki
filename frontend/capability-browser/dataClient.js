(() => {
  const DATA_PATHS = {
    capability: "./public/data/capability-tree.json",
    capabilityWorkbench: "./public/data/capability-workbench.json",
    environmentWorkbench: "./public/data/environment-workbench.json",
    lifecycleWorkbench: "./public/data/lifecycle-workbench.json",
    maintenanceIndex: "./public/data/maintenance-index.json",
    maintenance: "./public/data/maintenance-knowledge.json?v=gbt42446-task-description-20260601-1",
    sharedLookups: "./public/data/shared-lookups.json",
    lifecycle: "./public/data/lifecycle-knowledge.json",
    content: "./public/data/content-views.json",
    securityArchitectureDesignGuide: "./public/data/guides/security-architecture-design.json",
    dataSecurityDesignGuide: "./public/data/guides/data-security-design.json",
    lightPlanningGuide: "./public/data/guides/light-planning.json",
    standards: "./public/data/standards-index.json",
  };

  const API_PACKAGE_PATHS = {
    capability: "/api/v1/data-packages/capability",
    capabilityWorkbench: "/api/v1/data-packages/capability-workbench",
    environmentWorkbench: "/api/v1/data-packages/environment-workbench",
    lifecycleWorkbench: "/api/v1/data-packages/lifecycle-workbench",
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
    capabilityWorkspaceProjection: "/api/v1/capabilities/workspace-projection",
    capabilityWorkspaceView: "/api/v1/capabilities/workspace-view",
    capabilityWorkspaceInitial: "/api/v1/capabilities/workspace-initial",
    health: "/api/v1/health",
    userFavorites: "/api/v1/user/favorites",
    userNotes: "/api/v1/user/notes",
  };

  const FALLBACKS = {
    capability: { generated_at: null, stats: {}, categories: [], unlinked_focuses: [] },
    capabilityWorkbench: null,
    environmentWorkbench: null,
    lifecycleWorkbench: null,
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
  };

  const cache = new Map();
  let apiUnavailable = false;
  let runtimeHealthCache = null;
  const list = (value) => (Array.isArray(value) ? value : []);
  const text = (value) => (value == null ? "" : String(value));
  const TECHNICAL_MEASURES_FIELD = "security_technical_measures";
  const TECHNICAL_MEASURES_EMPTY_MESSAGE = "暂无安全技术措施数据，请确认 ETL 是否已导出 security_technical_measures。";
  const hasOwn = (object, key) => Boolean(object) && Object.prototype.hasOwnProperty.call(object, key);
  const titleOf = (value, fallback = "未命名") => {
    if (!value) return fallback;
    if (typeof value === "object") return text(value.title || value.name || value.code || value.id || fallback);
    return text(value);
  };
  const objectIdOf = (item, fallback = "unknown") => text(item?.id || item?.code || item?.title || item?.name || fallback).trim();

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

  async function fetchApiPackage(name) {
    if (apiUnavailable) return null;
    const path = API_PACKAGE_PATHS[name];
    const url = path ? apiUrl(path) : "";
    if (!url) return null;
    try {
      const response = await fetch(url, { cache: "no-store" });
      if (!response.ok) {
        if (response.status === 404) apiUnavailable = true;
        return null;
      }
      return unwrapEnvelope(await response.json());
    } catch {
      apiUnavailable = true;
      return null;
    }
  }

  async function fetchApiData(path) {
    if (apiUnavailable) return null;
    const url = path ? apiUrl(path) : "";
    if (!url) return null;
    try {
      const response = await fetch(url, { cache: "no-store" });
      if (!response.ok) {
        if (response.status === 404) return null;
        apiUnavailable = true;
        return null;
      }
      return unwrapEnvelope(await response.json());
    } catch {
      apiUnavailable = true;
      return null;
    }
  }

  async function fetchRuntimeHealth() {
    if (runtimeHealthCache) return runtimeHealthCache;
    const url = apiUrl(API_PATHS.health);
    if (!url) {
      runtimeHealthCache = { status: "offline", auth: { writes_require_token: false }, user_database: { ready: false } };
      return runtimeHealthCache;
    }
    try {
      const response = await fetch(url, { cache: "no-store" });
      if (!response.ok) throw new Error(`health ${response.status}`);
      runtimeHealthCache = normalizeUserPayload(await response.json());
      return runtimeHealthCache;
    } catch {
      runtimeHealthCache = { status: "offline", auth: { writes_require_token: false }, user_database: { ready: false }, data_state: "api_unavailable" };
      return runtimeHealthCache;
    }
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

  async function fetchUserApi(path, options = {}) {
    const url = path ? apiUrl(path) : "";
    if (!url) return { ok: false, data_state: "api_unavailable", favorites: [], notes: [] };
    try {
      const response = await fetch(url, { cache: "no-store", ...options });
      const payload = response.headers.get("Content-Type")?.includes("application/json") ? await response.json() : {};
      const data = normalizeUserPayload(payload);
      return response.ok ? data : { ok: false, data_state: "api_error", error: data.error || data.message || `HTTP ${response.status}` };
    } catch (error) {
      return { ok: false, data_state: "api_unavailable", error: error?.message || "user api unavailable" };
    }
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
        const missingData = fallback && typeof fallback === "object" ? { ...fallback, __data_state: "missing_file" } : { __data_state: "missing_file" };
        cache.set(name, missingData);
        return missingData;
      }
      const data = await response.json();
      cache.set(name, data);
      return data;
    } catch {
      const missingData = fallback && typeof fallback === "object" ? { ...fallback, __data_state: "missing_file" } : { __data_state: "missing_file" };
      cache.set(name, missingData);
      return missingData;
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

  async function loadStandardFramework(frameworkId) {
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
      const [runtimeHealth, results] = await Promise.all([fetchRuntimeHealth(), Promise.allSettled(Object.keys(DATA_PATHS).map((name) => fetchPackage(name)))]);
      const failedCount = results.filter((result) => result.status === "rejected").length;
      return createEnvelope({
        status: failedCount ? "degraded" : "ok",
        app: "SAPD Wiki",
        version: "v1",
        database_ready: true,
        generated_data_ready: failedCount === 0,
        runtime: runtimeHealth,
        checked_at: new Date().toISOString(),
      });
    },

    async getRuntimeHealth() {
      return createEnvelope(await fetchRuntimeHealth());
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
      const { capability, management } = await getCapabilityAndManagement();
      const rows = capabilityMatrixRows(capability, management, { capability_id: id });
      const focusRow = rows.find((row) => row.focus.id === id) || rows[0] || null;
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
      const projection = await fetchApiData(`${API_PATHS.capabilityWorkspaceProjection}${query}`);
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
      const view = await fetchApiData(`${API_PATHS.capabilityWorkspaceView}${query}`);
      if (view) return createEnvelope(view);
      const projection = await this.getCapabilityWorkspaceProjection(params);
      return createEnvelope(projection.data, ["workspace-view API 不可用，已回退到 workspace-projection。"]);
    },

    async getEnvironmentTree() {
      const workbench = await fetchPackage("environmentWorkbench");
      return createEnvelope({
        generated_at: workbench?.meta?.generated_at || null,
        stats: workbench?.meta?.stats || {},
        environments: list(workbench?.navigator?.tree),
      });
    },

    async getEnvironmentWorkbench() {
      const workbench = await fetchPackage("environmentWorkbench");
      if (workbench.__data_state !== "missing_file") return createEnvelope(workbench);
      return createEnvelope(createLegacyEnvironmentWorkbenchFallback(), ["environment-workbench.json 不存在，且 management-knowledge.json 已退役。"]);
    },

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
      const workbench = await fetchPackage("environmentWorkbench");
      const rows =
        workbench?.__data_state === "missing_file"
          ? environmentMatrixRows(createLegacyEnvironmentWorkbenchFallback(), { object_id: id })
          : environmentMatrixRowsFromWorkbench(workbench, { object_id: id });
      const row = rows[0] || null;
      return createEnvelope({
        generated_at: workbench?.meta?.generated_at || null,
        object: row?.information_object || null,
        environment: row?.environment || null,
        relationships: {
          rows,
          scopes: uniqueBy(rows.map((item) => item.scope), (scope) => scope?.id || scope?.code || scope?.title),
          services: uniqueBy(rows.flatMap((item) => item.services), (service) => service?.id || service?.code || service?.title),
          modules: uniqueBy(rows.flatMap((item) => item.modules), (module) => module?.id || module?.code || module?.title),
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
      const standards = await fetchPackage("standards");
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
