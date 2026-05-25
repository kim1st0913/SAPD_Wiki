(() => {
  const DATA_PATHS = {
    capability: "./public/data/capability-tree.json",
    capabilityWorkbench: "./public/data/capability-workbench.json",
    environmentWorkbench: "./public/data/environment-workbench.json",
    lifecycleWorkbench: "./public/data/lifecycle-workbench.json",
    maintenance: "./public/data/maintenance-knowledge.json?v=security-reference-original-fields-20260523-1",
    sharedLookups: "./public/data/shared-lookups.json",
    lifecycle: "./public/data/lifecycle-knowledge.json",
    content: "./public/data/content-views.json",
    securityArchitectureDesignGuide: "./public/data/guides/security-architecture-design.json",
    dataSecurityDesignGuide: "./public/data/guides/data-security-design.json",
    standards: "./public/data/standards-index.json",
  };

  const API_PACKAGE_PATHS = {
    capability: "/api/v1/data-packages/capability",
    capabilityWorkbench: "/api/v1/data-packages/capability-workbench",
    environmentWorkbench: "/api/v1/data-packages/environment-workbench",
    lifecycleWorkbench: "/api/v1/data-packages/lifecycle-workbench",
    maintenance: "/api/v1/data-packages/maintenance",
    sharedLookups: "/api/v1/data-packages/shared-lookups",
    lifecycle: "/api/v1/data-packages/lifecycle",
    content: "/api/v1/data-packages/content",
    securityArchitectureDesignGuide: "/api/v1/data-packages/security-architecture-design-guide",
    dataSecurityDesignGuide: "/api/v1/data-packages/data-security-design-guide",
    standards: "/api/v1/data-packages/standards-index",
  };

  const API_PATHS = {
    capabilityWorkspaceProjection: "/api/v1/capabilities/workspace-projection",
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
    standards: { generated_at: null, data_state: "empty", stats: {}, frameworks: [] },
  };

  const cache = new Map();
  let apiUnavailable = false;
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
    const workbench = emptyWorkbench("domain-module", "/development-security/lc-ap", "LC-AP 开发安全生命周期专项关系投影", ["lifecycle-knowledge.json"]);
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
          name: "开发安全生命周期",
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

  const dataClient = {
    async getHealth() {
      const results = await Promise.allSettled(Object.keys(DATA_PATHS).map((name) => fetchPackage(name)));
      const failedCount = results.filter((result) => result.status === "rejected").length;
      return createEnvelope({
        status: failedCount ? "degraded" : "ok",
        app: "SAPD Wiki",
        version: "v1",
        database_ready: true,
        generated_data_ready: failedCount === 0,
        checked_at: new Date().toISOString(),
      });
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

    async getCapabilityWorkspaceProjection() {
      const projection = await fetchApiData(API_PATHS.capabilityWorkspaceProjection);
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
      const rows = environmentMatrixRows(createLegacyEnvironmentWorkbenchFallback(workbench), params);
      return createEnvelope({
        generated_at: workbench?.meta?.generated_at || null,
        rows,
        stats: { rows: rows.length },
      });
    },

    async getEnvironmentRelationships(id) {
      const workbench = await fetchPackage("environmentWorkbench");
      const rows = environmentMatrixRows(createLegacyEnvironmentWorkbenchFallback(workbench), { object_id: id });
      const row = rows[0] || null;
      return createEnvelope({
        generated_at: management.generated_at,
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
      const management = await getMaintenanceKnowledgePayload();
      return createEnvelope({ generated_at: management.generated_at, items: list(management.scope_types), stats: { items: list(management.scope_types).length } });
    },

    async getMaintenanceProcesses() {
      const management = await getMaintenanceKnowledgePayload();
      return createEnvelope({ generated_at: management.generated_at, items: list(management.security_processes), stats: { items: list(management.security_processes).length } });
    },

    async getMaintenanceWorkFunctions() {
      const management = await getMaintenanceKnowledgePayload();
      return createEnvelope({ generated_at: management.generated_at, items: list(management.work_function_layers), stats: { items: list(management.work_function_layers).length } });
    },

    async getMaintenanceTechnologyModules() {
      const management = await getMaintenanceKnowledgePayload();
      return createEnvelope({ generated_at: management.generated_at, items: list(management.security_technology_modules), stats: { items: list(management.security_technology_modules).length } });
    },

    async getMaintenanceTechnologyMeasures() {
      const management = await getMaintenanceKnowledgePayload();
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
      const management = await getMaintenanceKnowledgePayload();
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
