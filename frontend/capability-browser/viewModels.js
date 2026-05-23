(function () {
  const list = (value) => (Array.isArray(value) ? value : []);
  const text = (value) => (value == null ? "" : String(value));
  const TECHNICAL_MEASURES_FIELD = "security_technical_measures";
  const TECHNICAL_MEASURES_EMPTY_MESSAGE = "暂无安全技术措施数据，请确认 ETL 是否已导出 security_technical_measures。";
  const PENDING_TEXT = "待补充";
  const NOT_APPLICABLE_TEXT = "不适用";
  const WORK_FUNCTION_LAYERS = [
    { key: "decision", label: "决策层", aliases: ["decision", "决策层", "网络安全决策层"] },
    { key: "management", label: "管理层", aliases: ["management", "管理层", "网络安全管理层"] },
    { key: "execution", label: "执行层", aliases: ["execution", "执行层", "网络安全执行层"] },
    { key: "supervision", label: "监督层", aliases: ["supervision", "监督层", "网络安全监督层"] },
  ];
  const WORK_FUNCTION_LAYER_BY_VALUE = new Map(WORK_FUNCTION_LAYERS.flatMap((layer) => layer.aliases.map((alias) => [alias, layer])));
  const titleOf = (value, fallback = "未命名") => {
    if (!value) return fallback;
    if (typeof value === "object") return text(value.title || value.name || value.code || value.id || fallback);
    return text(value);
  };
  const codeTitle = (value, fallback = "未命名") => [value?.code, titleOf(value, fallback)].filter(Boolean).join(" ");
  const normalizeSearch = (value) => text(value).trim().toLowerCase();
  const includesSearch = (query, ...values) => !query || values.map(text).join(" ").toLowerCase().includes(query);
  const identityOf = (value, fallback = "unknown") => text(value?.id || value?.name || value?.title || value?.code || fallback).trim();
  const serviceIdentity = (service) => text(service?.id || service?.code || service?.title || service?.name || titleOf(service, "未命名服务")).trim();
  const hasOwn = (object, key) => Boolean(object) && Object.prototype.hasOwnProperty.call(object, key);
  const isApplicableService = (service) => {
    const identity = serviceIdentity(service);
    const title = titleOf(service, "");
    return Boolean(identity) && identity !== "/" && title !== "/" && title !== "无";
  };

  function uniqueBy(items, keyFn) {
    const seen = new Set();
    return list(items).filter((item) => {
      const key = keyFn(item);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  function flattenCapabilities(capabilityTree) {
    const rows = [];
    for (const category of list(capabilityTree?.categories)) {
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

  function focusRows(capabilityTree) {
    return flattenCapabilities(capabilityTree).filter((row) => row.item.type === "capability_focus");
  }

  function defaultCapabilitySelection(capabilityTree) {
    return list(capabilityTree?.categories)[0] || focusRows(capabilityTree)[0]?.item || null;
  }

  function findCapabilityItemAndFocuses(capabilityTree, targetId) {
    let selected = null;
    let focuses = [];
    const collectCapabilityFocuses = (capability) => list(capability.focuses);
    const collectDomainFocuses = (domain) => list(domain.capabilities).flatMap(collectCapabilityFocuses);
    const collectCategoryFocuses = (category) => list(category.domains).flatMap(collectDomainFocuses);
    for (const category of list(capabilityTree?.categories)) {
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
    return { selected, focuses: focuses.length ? focuses : focusRows(capabilityTree).map((row) => row.item) };
  }

  function capabilityPathForFocus(capabilityTree, focusId) {
    for (const category of list(capabilityTree?.categories)) {
      for (const domain of list(category.domains)) {
        for (const capability of list(domain.capabilities)) {
          const focus = list(capability.focuses).find((item) => item.id === focusId);
          if (focus) return { category, domain, capability, focus };
        }
      }
    }
    return {};
  }

  function serviceModuleIndex(management, service) {
    return list(management?.service_module_index).find((entry) => {
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

  function entityTokens(item) {
    return [item?.id, item?.code, item?.title, item?.name].map(text).map((value) => value.trim()).filter(Boolean);
  }

  function entityTokenMatches(left, right) {
    const tokens = new Set(entityTokens(left));
    return entityTokens(right).some((token) => tokens.has(token));
  }

  function measuresForServicesAndScope(management, services, scope) {
    const serviceRows = list(services).filter(isApplicableService);
    if (!serviceRows.length) return [];
    return uniqueBy(
      list(management?.security_technical_measures).filter((measure) => {
        const relatedServices = [
          ...list(measure.related_services),
          ...list(measure.services),
          ...list(measure.technical_services),
          ...list(measure.related_service_names).map((title) => ({ title })),
        ];
        const relatedScopes = [
          ...list(measure.applicable_scopes),
          ...list(measure.scopes),
          ...list(measure.scope_types),
          ...list(measure.related_scope_names).map((title) => ({ title })),
        ];
        const serviceMatched = relatedServices.some((measureService) => serviceRows.some((service) => entityTokenMatches(measureService, service)));
        const scopeMatched = !scope || !relatedScopes.length || relatedScopes.some((measureScope) => entityTokenMatches(measureScope, scope));
        return serviceMatched && scopeMatched;
      }),
      (measure) => measure.id || measure.name || measure.title,
    );
  }

  function compactTechnicalObject(item, fallbackKind = "安全技术模块") {
    const compact = compactEntity(item, "待补充");
    const status = text(item?.status || compact?.status).trim().toLowerCase();
    const isMeasure = item?.type === "security_technical_measure" || item?.name || item?.measureName;
    const kind = isMeasure ? "安全技术措施" : fallbackKind;
    return {
      ...compact,
      objectKind: kind,
      kind,
      systems: list(item?.systems).map(compactEntity).filter(Boolean),
      products: list(item?.products).map(compactEntity).filter(Boolean),
    };
  }

  function stakeholdersFromMappings(processMappings) {
    return uniqueBy(
      list(processMappings).flatMap((mapping) =>
        Object.entries(mapping.stakeholders || {}).flatMap(([layer, stakeholders]) => list(stakeholders).map((stakeholder) => ({ ...stakeholder, layer }))),
      ),
      (stakeholder) => `${stakeholder.layer}:${stakeholder.id || stakeholder.code || stakeholder.title}`,
    );
  }

  function sourceEvidenceFor(item, processMappings = [], sourceItems = []) {
    return uniqueBy(
      [
        ...list(item?.sources),
        ...list(sourceItems).flatMap((sourceItem) => list(sourceItem?.sources)),
        ...list(processMappings).flatMap((mapping) => list(mapping.sources)),
        ...list(processMappings).flatMap((mapping) => list(mapping.process_reference?.sources)),
        ...list(processMappings).flatMap((mapping) => list(mapping.process_group?.sources)),
      ].filter(Boolean),
      (source) => [source.file, source.source_file, source.sheet, source.row, source.cell, source.path, source.location].filter(Boolean).join(":") || JSON.stringify(source),
    );
  }

  function relationshipMatrixRows({ capabilityTree, management, selectedCapabilityId }) {
    const { focuses } = findCapabilityItemAndFocuses(capabilityTree, selectedCapabilityId);
    return focuses.map((focus) => {
      const services = uniqueBy(focus.services, (service) => service.id || service.code || service.title);
      const scopes = uniqueBy([...list(focus.scope_mappings).map((mapping) => mapping.scope), ...services.flatMap((service) => list(service.scopes))], (scope) => scope?.id || scope?.code || scope?.title);
      const processMappings = list(focus.process_mappings);
      const modules = modulesForServices(management, services);
      return {
        focus: compactEntity(focus),
        services: services.map(compactEntity),
        scopes: scopes.map(compactEntity),
        processGroups: uniqueBy(processMappings.map((mapping) => mapping.process_group), (item) => item?.id || item?.title).map(compactEntity),
        processReferences: uniqueBy(processMappings.map((mapping) => mapping.process_reference), (item) => item?.id || item?.title).map(compactEntity),
        activities: processMappings.flatMap((mapping) => list(mapping.activities)).map(compactEntity),
        hasMissingActivity: processMappings.some((mapping) => mapping.missing_activity || mapping.activity_status === "missing"),
        stakeholders: stakeholdersFromMappings(processMappings).map(compactStakeholder),
        modules: modules.map(compactEntity),
        processMappings: processMappings.map(compactProcessMapping),
        path: compactPath(capabilityPathForFocus(capabilityTree, focus.id)),
      };
    });
  }

  function buildFocusOverview({ capabilityTree, focuses, selectedDetail, technicalRows = [], managementRows = [] }) {
    const firstPath = capabilityPathForFocus(capabilityTree, focuses[0]?.id);
    const technicalSummary = summarizeTechnical(technicalRows);
    const managementSummary = summarizeManagement(managementRows);
    const currentFocus = focuses.length === 1 ? focuses[0] : null;
    return {
      path: compactPath(firstPath),
      selected: selectedDetail,
      current: currentFocus ? compactEntity(currentFocus) : null,
      isAggregate: focuses.length !== 1,
      focusCount: focuses.length,
      technicalSummary,
      managementSummary,
      rows: focuses.map((focus) => {
        const path = compactPath(capabilityPathForFocus(capabilityTree, focus.id));
        const focusTechnicalRows = technicalRows.filter((row) => row.focus.id === focus.id);
        const services = uniqueBy(focusTechnicalRows.flatMap((row) => row.services), (service) => service.id || service.code || service.title);
        const modules = uniqueBy(focusTechnicalRows.flatMap((row) => row.modules), (module) => module.id || module.code || module.title || module.name);
        const processMappings = list(focus.process_mappings);
        return {
          focus: compactEntity(focus),
          path,
          scopeCount: list(focus.scope_mappings).length,
          serviceCount: services.length,
          ambiguousCount: focusTechnicalRows.filter((row) => row.status === "ambiguous_service_mapping").length,
          securityWorkCount: list(focus.security_works).length,
          processReferenceCount: uniqueBy(processMappings.map((mapping) => mapping.process_reference), (item) => item?.id || item?.title).length,
          moduleCount: modules.length,
          missingActivityCount: processMappings.filter((mapping) => mapping.missing_activity || mapping.activity_status === "missing").length,
        };
      }),
    };
  }

  function buildTechnicalMappingRows({ management, focuses }) {
    return focuses.flatMap((focus) => {
      const grouped = new Map();
      for (const mapping of list(focus.scope_mappings)) {
        const scope = mapping.scope || {};
        const focusKey = identityOf(focus, titleOf(focus, "未命名关注点"));
        const scopeKey = identityOf(scope, titleOf(scope, "未命名作用域"));
        const key = `${focusKey}::${scopeKey}`;
        const group =
          grouped.get(key) || {
            focus,
            scope,
            mappings: [],
            services: [],
            serviceCount: 0,
          };
        group.mappings.push(mapping);
        group.services.push(...list(mapping.services).filter(isApplicableService));
        group.serviceCount += Number(mapping.service_count ?? list(mapping.services).length) || 0;
        grouped.set(key, group);
      }
      return [...grouped.values()].map((group) => {
        const candidateServices = uniqueBy(group.services, serviceIdentity);
        const isExplicitNoService = group.mappings.some((mapping) => mapping.status === "no_service") || candidateServices.length === 0;
        const isAmbiguous = candidateServices.length > 1;
        const confirmedServices = isAmbiguous ? [] : candidateServices;
        const modules = isAmbiguous ? [] : modulesForServices(management, confirmedServices);
        const measures = isAmbiguous ? [] : measuresForServicesAndScope(management, confirmedServices, group.scope);
        const technologyModules = modules.map((module) => compactTechnicalObject(module, "安全技术模块"));
        const technicalMeasures = measures.map((measure) => compactTechnicalObject({ ...measure, type: "security_technical_measure" }, "安全技术措施"));
        const technicalObjects = [...technologyModules, ...technicalMeasures];
        const status = isAmbiguous ? "ambiguous_service_mapping" : confirmedServices.length ? "covered" : "no_service";
        return {
          focus: compactEntity(group.focus),
          scope: compactEntity(group.scope, "未命名作用域"),
          services: confirmedServices.map(compactEntity),
          candidateServices: candidateServices.map(compactEntity),
          technologyModules,
          technicalMeasures,
          modules: technicalObjects,
          serviceCount: group.serviceCount || candidateServices.length,
          status,
          exceptionType: isAmbiguous ? "ambiguous_service_mapping" : "",
          exceptionMessage: isAmbiguous ? "同一关注点与同一作用域下出现多个候选安全技术服务，需要后端/ETL确认，前端不自动选择。" : "",
          isExplicitNoService,
        };
      });
    });
  }

  function buildManagementMappingRows({ focuses }) {
    return focuses.map((focus) => {
      const processMappings = list(focus.process_mappings);
      const securityWorks = uniqueBy(list(focus.security_works), (work) => work.id || work.code || work.title);
      return {
        focus: compactEntity(focus),
        securityWorks: securityWorks.map(compactEntity),
        stakeholders: stakeholdersFromMappings(processMappings).map(compactStakeholder),
        processGroups: uniqueBy(processMappings.map((mapping) => mapping.process_group), (item) => item?.id || item?.title).map(compactEntity),
        processReferences: uniqueBy(processMappings.map((mapping) => mapping.process_reference), (item) => item?.id || item?.title).map(compactEntity),
        activities: uniqueBy(processMappings.flatMap((mapping) => list(mapping.activities)), (item) => item?.id || item?.code || item?.title).map(compactEntity),
        activityStatusLabels: uniqueBy(
          processMappings.map((mapping) => mapping.activity_status_label || (mapping.missing_activity ? "待补充" : "暂无")),
          (label) => label,
        ),
        hasMissingActivity: processMappings.some((mapping) => mapping.missing_activity || mapping.activity_status === "missing"),
      };
    });
  }

  function relationshipCellValue(row, key) {
    if (key === "focus") return [row.focus?.code, row.focus?.title, row.focus?.description].filter(Boolean).join(" ");
    if (key === "activities") return row.activities.length ? row.activities.map(titleOf).join("；") : row.hasMissingActivity ? "待补充" : "";
    if (key === "stakeholders") return row.stakeholders.map((stakeholder) => stakeholder.layer || titleOf(stakeholder)).join("；");
    return list(row[key]).map(titleOf).join("；");
  }

  function filterRelationshipRows(rows, relationshipFilters) {
    const columns = ["focus", "services", "scopes", "processGroups", "processReferences", "activities", "stakeholders", "modules"];
    return rows.filter((row) =>
      columns.every((key) => {
        const filter = normalizeSearch(relationshipFilters?.[key]);
        if (!filter) return true;
        return relationshipCellValue(row, key).toLowerCase().includes(filter);
      }),
    );
  }

  function compactEntity(item, fallback = "未命名") {
    if (!item) return null;
    return {
      id: item.id || item.code || titleOf(item, fallback),
      type: item.type || item.object_type || "",
      code: item.code || "",
      title: titleOf(item, fallback),
      name: item.name || "",
      description: item.description || item.summary || "",
      layer: item.layer || "",
      status: item.status || item.state || "",
    };
  }

  function compactStakeholder(stakeholder) {
    return {
      ...compactEntity(stakeholder, "未命名职能"),
      layer: stakeholder.layer || "",
    };
  }

  function compactProcessMapping(mapping) {
    const compactStakeholdersByLayer = Object.fromEntries(
      Object.entries(mapping.stakeholders || {}).map(([layer, stakeholders]) => [layer, list(stakeholders).map(compactStakeholder)]),
    );
    return {
      process_group: compactEntity(mapping.process_group, "未关联流程组"),
      process_reference: compactEntity(mapping.process_reference, "待补充"),
      activity_status_label: mapping.activity_status_label || "待补充",
      stakeholders: compactStakeholdersByLayer,
    };
  }

  function compactPath(path) {
    return {
      category: compactEntity(path.category),
      domain: compactEntity(path.domain),
      capability: compactEntity(path.capability),
      focus: compactEntity(path.focus),
    };
  }

  function navigationRow(item, level, parentId, hasChildren) {
    return {
      level,
      id: item.id,
      parentId: parentId || "",
      hasChildren: Boolean(hasChildren),
      type: item.type || "",
      code: item.code || "",
      title: titleOf(item),
      description: item.description || "",
    };
  }

  function buildNavigationTree(capabilityTree, search) {
    const query = normalizeSearch(search);
    const rows = [];
    const shouldInclude = (item, level, inheritedMatch = false) =>
      !query || inheritedMatch || includesSearch(query, level, item.code, item.title, item.description);

    for (const category of list(capabilityTree?.categories)) {
      const categoryMatches = shouldInclude(category, "分类");
      const domainRows = [];
      for (const domain of list(category.domains)) {
        const domainMatches = shouldInclude(domain, "L1", categoryMatches);
        const capabilityRows = [];
        for (const capability of list(domain.capabilities)) {
          const capabilityMatches = shouldInclude(capability, "L2", domainMatches);
          const focusRows = list(capability.focuses)
            .filter((focus) => shouldInclude(focus, "关注点", capabilityMatches))
            .map((focus) => navigationRow(focus, "关注点", capability.id, false));
          if (capabilityMatches || focusRows.length) {
            capabilityRows.push(navigationRow(capability, "L2", domain.id, focusRows.length > 0 || list(capability.focuses).length > 0), ...focusRows);
          }
        }
        if (domainMatches || capabilityRows.length) {
          domainRows.push(navigationRow(domain, "L1", category.id, capabilityRows.length > 0 || list(domain.capabilities).length > 0), ...capabilityRows);
        }
      }
      if (categoryMatches || domainRows.length) {
        rows.push(navigationRow(category, "分类", "", domainRows.length > 0 || list(category.domains).length > 0), ...domainRows);
      }
    }
    return rows;
  }

  function buildRelationshipChainRows(row) {
    if (!row) return [];
    return [
      { key: "focus", label: "能力关注点", value: row.focus?.code || "无编码", preview: row.focus?.title || "未命名", items: row.focus ? [row.focus] : [] },
      { key: "services", label: "安全技术服务", value: row.services.length, preview: row.services.slice(0, 2).map(titleOf).join("、") || "暂无", items: row.services },
      { key: "scopes", label: "作用域", value: row.scopes.length, preview: row.scopes.slice(0, 2).map(titleOf).join("、") || "暂无", items: row.scopes },
      { key: "modules", label: "技术模块", value: row.modules.length, preview: row.modules.slice(0, 2).map(titleOf).join("、") || "暂无", items: row.modules },
    ];
  }

  function buildLocalRelationshipNotes(row, technicalRows, managementRows) {
    if (!row) return [];
    const technicalForFocus = technicalRows.filter((item) => item.focus.id === row.focus.id);
    const managementForFocus = managementRows.find((item) => item.focus.id === row.focus.id);
    const scopeCount = uniqueBy(technicalForFocus.map((item) => item.scope), (scope) => scope?.id || scope?.code || scope?.title).length;
    const serviceCount = uniqueBy(buildScopeServicePairs(technicalForFocus).filter((pair) => pair.serviceId || pair.serviceName), (pair) => pair.serviceId || pair.serviceCode || pair.serviceName).length;
    const moduleCount = uniqueBy(technicalForFocus.flatMap((item) => list(item.technologyModules)), (module) => module.id || module.code || module.title || module.name).length;
    const measureCount = uniqueBy(technicalForFocus.flatMap((item) => list(item.technicalMeasures)), (measure) => measure.id || measure.code || measure.title || measure.name).length;
    const workCount = uniqueBy(list(managementForFocus?.securityWorks), (work) => work.id || work.code || work.title).length;
    const functionCount = uniqueBy(list(managementForFocus?.stakeholders), (stakeholder) => stakeholder.id || stakeholder.code || stakeholder.title || stakeholder.name).length;
    return [
      {
        title: "图示范围",
        body: "本图展示当前安全能力关注点在技术视角与管理视角下的局部映射关系。",
      },
      {
        title: "技术视角",
        body: "技术视角从适用作用域出发，展示每个作用域对应的安全技术服务，并进一步关联到安全技术模块和安全技术措施，用于判断该关注点在不同保护对象上的技术落地方式。",
      },
      {
        title: "管理视角",
        body: "管理视角从当前关注点关联的安全工作出发，展示其涉及的四层安全职能，以及对应的 L2/L3 流程和 L4 关键活动，用于判断该关注点在组织职责和流程执行中的落地路径。",
      },
      {
        title: "当前摘要",
        body: `当前关注点共关联 ${scopeCount} 个作用域、${serviceCount} 项安全技术服务、${moduleCount} 个安全技术模块、${measureCount} 项安全技术措施，以及 ${workCount} 项安全工作和 ${functionCount} 个安全职能。`,
      },
    ];
  }

  function summarizeTechnical(rows) {
    return {
      scopeCount: uniqueBy(rows.map((row) => row.scope), (scope) => scope?.id || scope?.title).length,
      serviceCount: uniqueBy(rows.flatMap((row) => row.services), (service) => service.id || service.code || service.title).length,
      moduleCount: uniqueBy(rows.flatMap((row) => row.modules), (module) => module.id || module.code || module.title).length,
      uncoveredCount: rows.filter((row) => !row.services.length).length,
      noServiceCount: rows.filter((row) => row.status === "no_service").length,
      ambiguousCount: rows.filter((row) => row.status === "ambiguous_service_mapping").length,
    };
  }

  function summarizeManagement(rows) {
    return {
      securityWorkCount: uniqueBy(rows.flatMap((row) => row.securityWorks), (work) => work.id || work.code || work.title).length,
      securityFunctionCount: uniqueBy(rows.flatMap((row) => row.stakeholders), (stakeholder) => stakeholder.id || stakeholder.code || stakeholder.title || stakeholder.name).length,
      processGroupCount: uniqueBy(rows.flatMap((row) => row.processGroups), (group) => group.id || group.title).length,
      processReferenceCount: uniqueBy(rows.flatMap((row) => row.processReferences), (process) => process.id || process.title).length,
      stakeholderLayers: uniqueBy(rows.flatMap((row) => row.stakeholders.map((stakeholder) => stakeholder.layer).filter(Boolean)), (layer) => layer),
      missingActivityCount: rows.filter((row) => row.hasMissingActivity).length,
    };
  }

  function buildDetailInspector(selectedDetail, selectedType, processMappings, services, modules, sourceItem, sourceMappings, technicalSummary, managementSummary, securityWorks, sourceItems) {
    return {
      type: selectedDetail?.type || selectedType || "能力对象",
      code: selectedDetail?.code || "无编码",
      title: selectedDetail?.title || "未命名",
      description: selectedDetail?.description || "暂无描述",
      services,
      serviceCount: services.length,
      securityWorks,
      processMappings,
      modules,
      technicalSummary,
      managementSummary,
      sourceEvidence: sourceEvidenceFor(sourceItem, sourceMappings, sourceItems),
    };
  }

  function mapTechnicalStatus(row) {
    if (row?.status === "ambiguous_service_mapping") return "ambiguous";
    if (row?.status === "no_service" && row?.isExplicitNoService) return "not_applicable";
    if (row?.status === "no_service") return "missing";
    return "normal";
  }

  function compactLocalFocus(focus) {
    const compact = compactEntity(focus, "未命名关注点");
    return {
      id: compact?.id || "",
      type: compact?.type || "",
      code: compact?.code || "",
      name: compact?.title || "",
      description: compact?.description || "",
    };
  }

  function compactLocalModule(module) {
    return {
      id: module?.id || module?.code || module?.title || "",
      code: module?.code || "",
      name: module?.title || module?.name || "",
      type: module?.type || "security_technology_module",
    };
  }

  function compactLocalMeasure(measure) {
    return {
      id: measure?.id || measure?.code || measure?.title || "",
      name: measure?.title || measure?.name || "",
      category: measure?.category || measure?.kind || measure?.objectKind || "",
      status: measure?.status || "normal",
    };
  }

  function localPairFor(row, service, status) {
    return {
      scopeId: row.scope?.id || "",
      scopeCode: row.scope?.code || "",
      scopeName: row.scope?.title || "",
      serviceId: service?.id || "",
      serviceCode: service?.code || "",
      serviceName: service?.title || "",
      status,
    };
  }

  function buildScopeServicePairs(technicalRows) {
    return list(technicalRows).flatMap((row) => {
      const status = mapTechnicalStatus(row);
      const services = status === "ambiguous" ? list(row.candidateServices) : list(row.services);
      if (!services.length) return [localPairFor(row, null, status)];
      return services.map((service) => localPairFor(row, service, status));
    });
  }

  function buildLocalProcesses(processMappings) {
    return uniqueBy(
      list(processMappings).map((mapping) => {
        const group = compactEntity(mapping.process_group, "待补充");
        const reference = compactEntity(mapping.process_reference, "待补充");
        return {
          id: [group?.id, reference?.id].filter(Boolean).join(":") || reference?.title || group?.title || "process",
          l2ProcessGroup: group?.title || "待补充",
          l3ProcessName: reference?.title || "待补充",
        };
      }),
      (process) => process.id || `${process.l2ProcessGroup}:${process.l3ProcessName}`,
    );
  }

  function buildLocalProcessTree(processMappings) {
    const groups = new Map();
    for (const mapping of list(processMappings)) {
      const group = compactEntity(mapping.process_group, "待补充");
      const reference = compactEntity(mapping.process_reference, "待补充");
      const groupKey = group?.id || group?.title || "pending-l2";
      const l2 =
        groups.get(groupKey) || {
          id: groupKey,
          l2ProcessGroup: group?.title || "待补充",
          l3Processes: [],
        };
      const activities = list(mapping.activities).map((activity) => ({
        id: activity.id || activity.code || activity.title || "activity",
        name: activity.title || activity.name || "待补充",
        status: activity.status || "normal",
      }));
      l2.l3Processes.push({
        id: reference?.id || reference?.title || `${groupKey}:pending-l3`,
        name: reference?.title || "待补充",
        activities: activities.length ? activities : [{ id: `${reference?.id || groupKey}:missing-activity`, name: "待补充", status: "missing" }],
      });
      groups.set(groupKey, l2);
    }
    return [...groups.values()].map((group) => ({
      ...group,
      l3Processes: uniqueBy(group.l3Processes, (process) => process.id || process.name).map((process) => ({
        ...process,
        activities: uniqueBy(process.activities, (activity) => activity.id || activity.name),
      })),
    }));
  }

  function buildLocalProcessTreeFromManagementRows(managementRows) {
    const groups = new Map();
    for (const row of list(managementRows)) {
      const activities = list(row.activities).map((activity) => ({
        id: activity.id || activity.code || activity.title || "activity",
        name: activity.title || activity.name || "待补充",
        status: activity.status || "normal",
      }));
      const l4Activities = activities.length
        ? activities
        : row.hasMissingActivity
        ? [{ id: `${row.id || "management"}:missing-activity`, name: "待补充", status: "missing" }]
        : [];
      const processReferences = list(row.processReferences);
      const processGroups = list(row.processGroups);
      const l2Rows = processGroups.length ? processGroups : [{ id: `${row.id || "management"}:pending-l2`, title: "待补充" }];
      for (const processGroup of l2Rows) {
        const groupKey = processGroup.id || processGroup.code || processGroup.title || "pending-l2";
        const l2 =
          groups.get(groupKey) || {
            id: groupKey,
            l2ProcessGroup: processGroup.title || processGroup.name || "待补充",
            l3Processes: [],
          };
        if (processReferences.length) {
          processReferences.forEach((process) => {
            l2.l3Processes.push({
              id: process.id || process.code || process.title || `${groupKey}:pending-l3`,
              name: process.title || process.name || "待补充",
              activities: l4Activities,
            });
          });
        } else {
          l2.l3Processes.push({
            id: `${groupKey}:pending-l3`,
            name: "待补充",
            activities: l4Activities,
          });
        }
        groups.set(groupKey, l2);
      }
    }
    return [...groups.values()].map((group) => ({
      ...group,
      l3Processes: uniqueBy(group.l3Processes, (process) => process.id || process.name).map((process) => ({
        ...process,
        activities: uniqueBy(process.activities, (activity) => activity.id || activity.name),
      })),
    }));
  }

  function buildLocalActivities(managementRows) {
    const activities = uniqueBy(
      list(managementRows).flatMap((row) => list(row.activities)),
      (activity) => activity.id || activity.code || activity.title,
    ).map((activity) => ({
      id: activity.id || activity.code || activity.title,
      name: activity.title || activity.name || "待补充",
      status: activity.status || "normal",
    }));
    const hasMissingActivity = list(managementRows).some((row) => row.hasMissingActivity);
    if (activities.length) return activities;
    return hasMissingActivity ? [{ id: "missing-activity", name: "待补充", status: "missing" }] : [];
  }

  function createEmptyWorkFunctionsByLayer() {
    return {
      decision: [],
      management: [],
      execution: [],
      supervision: [],
      unknown: [],
    };
  }

  function workFunctionLayerFor(value) {
    const normalized = text(value).trim();
    return WORK_FUNCTION_LAYER_BY_VALUE.get(normalized) || null;
  }

  function compactLocalWorkFunction(stakeholder) {
    const layerDefinition = workFunctionLayerFor(stakeholder?.layer);
    const layer = layerDefinition?.key || "unknown";
    return {
      id: stakeholder?.id || stakeholder?.code || stakeholder?.title || stakeholder?.name || "",
      code: stakeholder?.code || "",
      name: stakeholder?.title || stakeholder?.name || "",
      layer,
      layerLabel: layerDefinition?.label || "待确认职能",
      group: stakeholder?.group || "",
      status: stakeholder?.status || (layer === "unknown" ? "pending" : "normal"),
    };
  }

  function buildWorkFunctionsByLayer(stakeholders) {
    const grouped = createEmptyWorkFunctionsByLayer();
    for (const workFunction of uniqueBy(list(stakeholders).map(compactLocalWorkFunction), (item) => `${item.layer}:${item.id || item.code || item.name}`)) {
      grouped[workFunction.layer].push(workFunction);
    }
    return grouped;
  }

  function serviceKeyOf(service) {
    return service?.id || service?.code || service?.title || service?.name || "";
  }

  // Fallback only: used when /api/v1/capabilities/workspace-projection is unavailable.
  function buildServiceModuleMeasureLinks(technicalRows) {
    const links = new Map();
    for (const row of list(technicalRows)) {
      const services = list(row.services);
      for (const service of services) {
        const key = serviceKeyOf(service);
        if (!key) continue;
        const link =
          links.get(key) || {
            serviceId: service.id || "",
            serviceCode: service.code || "",
            serviceName: service.title || service.name || "",
            scopes: [],
            modules: [],
            measures: [],
            status: mapTechnicalStatus(row),
          };
        link.scopes.push({
          id: row.scope?.id || "",
          code: row.scope?.code || "",
          name: row.scope?.title || "",
        });
        link.modules.push(...list(row.technologyModules).map(compactLocalModule));
        link.measures.push(...list(row.technicalMeasures).map(compactLocalMeasure));
        if (link.status !== "ambiguous") link.status = mapTechnicalStatus(row);
        links.set(key, link);
      }
    }
    return [...links.values()].map((link) => ({
      ...link,
      scopes: uniqueBy(link.scopes, (scope) => scope.id || scope.code || scope.name),
      modules: uniqueBy(link.modules, (module) => module.id || module.code || module.name),
      measures: uniqueBy(link.measures, (measure) => measure.id || measure.name),
    }));
  }

  // Fallback only: used when backend localRelationMap projection is unavailable.
  function buildCapabilityLocalRelationMap({ selectedDetail, detailRawProcesses, detailTechnicalRows, detailManagementRows, detailStandardRows, detailSourceEvidence }) {
    const firstManagementRow = detailManagementRows[0] || {};
    const modules = uniqueBy(
      list(detailTechnicalRows).flatMap((row) => list(row.technologyModules)),
      (module) => module.id || module.code || module.title,
    ).map(compactLocalModule);
    const measures = uniqueBy(
      list(detailTechnicalRows).flatMap((row) => list(row.technicalMeasures)),
      (measure) => measure.id || measure.code || measure.title,
    ).map(compactLocalMeasure);
    const workFunctions = uniqueBy(
      list(detailManagementRows).flatMap((row) => list(row.stakeholders)),
      (stakeholder) => `${stakeholder.layer || "unknown"}:${stakeholder.id || stakeholder.code || stakeholder.title || stakeholder.name}`,
    ).map(compactLocalWorkFunction);
    const standardFrameworks = uniqueBy(
      list(detailStandardRows).flatMap((row) => list(row.standards)),
      (standard) => standard.id || standard.code || standard.title,
    );
    const standardControls = uniqueBy(
      list(detailStandardRows).flatMap((row) => list(row.controls)),
      (control) => control.id || control.code || control.title,
    );
    return {
      focus: compactLocalFocus(selectedDetail),
      technical: {
        scopeServicePairs: buildScopeServicePairs(detailTechnicalRows),
        serviceModuleMeasureLinks: buildServiceModuleMeasureLinks(detailTechnicalRows),
        modules,
        measures,
      },
      management: {
        securityWorks: uniqueBy(list(detailManagementRows).flatMap((row) => list(row.securityWorks)), (work) => work.id || work.code || work.title).map((work) => ({
          id: work.id || work.code || work.title || "",
          code: work.code || "",
          name: work.title || work.name || "",
          status: work.status || "",
        })),
        workFunctions,
        workFunctionsByLayer: buildWorkFunctionsByLayer(workFunctions),
        processes: buildLocalProcesses(detailRawProcesses),
        processTree: detailRawProcesses.length ? buildLocalProcessTree(detailRawProcesses) : buildLocalProcessTreeFromManagementRows(detailManagementRows),
        activities: buildLocalActivities(detailManagementRows.length ? detailManagementRows : [firstManagementRow]),
      },
      standards: {
        frameworks: standardFrameworks,
        controls: standardControls,
      },
      sourceEvidence: detailSourceEvidence,
    };
  }

  function isReadyCapabilityProjection(capabilityProjection) {
    if (!capabilityProjection) return false;
    const dataState = text(capabilityProjection.data_state || capabilityProjection.dataState || "").trim();
    if (dataState && dataState !== "ready") return false;
    return Boolean(capabilityProjection.localRelationMap || capabilityProjection.localRelationMapsByFocusId || list(capabilityProjection.localRelationMaps).length);
  }

  function projectedLocalRelationMapFor(capabilityProjection, selectedFocusId) {
    if (!isReadyCapabilityProjection(capabilityProjection)) return null;
    const byFocusId = capabilityProjection.localRelationMapsByFocusId || capabilityProjection.local_relation_maps_by_focus_id || {};
    if (selectedFocusId && byFocusId[selectedFocusId]) return byFocusId[selectedFocusId];
    const maps = list(capabilityProjection.localRelationMaps || capabilityProjection.local_relation_maps);
    if (selectedFocusId) {
      const selectedMap = maps.find((item) => item?.focus?.id === selectedFocusId);
      if (selectedMap) return selectedMap;
    }
    return capabilityProjection.localRelationMap || capabilityProjection.local_relation_map || maps[0] || null;
  }

  function workbenchObjectsById(workbench) {
    const rows = {};
    for (const group of Object.values(workbench?.objects || {})) {
      if (!group || typeof group !== "object") continue;
      for (const [id, item] of Object.entries(group)) rows[id] = item;
    }
    return rows;
  }

  function workbenchEntity(item, fallback = PENDING_TEXT, extra = {}) {
    if (!item) return null;
    return {
      id: item.id || item.code || item.title || item.name || fallback,
      type: item.type || "",
      code: item.code || "",
      title: titleOf(item, fallback),
      name: item.name || "",
      description: item.description || "",
      category: item.category || "",
      layer: item.layer || "",
      layerLabel: item.layerLabel || "",
      group: item.group || "",
      status: item.status || "",
      frameworkCode: item.frameworkCode || "",
      frameworkTitle: item.frameworkTitle || "",
      originalControlId: item.originalControlId || "",
      ...extra,
    };
  }

  function workbenchRelations(workbench, relationType) {
    return list(workbench?.relations).filter((relation) => !relationType || relation.type === relationType);
  }

  function workbenchTargets(workbench, objectsById, sourceId, relationType, targetType = "") {
    return workbenchRelations(workbench, relationType)
      .filter((relation) => relation.sourceId === sourceId && (!targetType || relation.targetType === targetType))
      .map((relation) => workbenchEntity(objectsById[relation.targetId]))
      .filter(Boolean);
  }

  function workbenchSources(workbench, objectsById, targetId, relationType, sourceType = "") {
    return workbenchRelations(workbench, relationType)
      .filter((relation) => relation.targetId === targetId && (!sourceType || relation.sourceType === sourceType))
      .map((relation) => workbenchEntity(objectsById[relation.sourceId]))
      .filter(Boolean);
  }

  function buildCapabilityTechnicalRowsFromWorkbench(workbench, focuses) {
    if (!workbench || workbench.__data_state === "missing_file") return [];
    const objectsById = workbenchObjectsById(workbench);
    return list(focuses).flatMap((focus) => {
      const focusId = focus.id;
      const focusEntity = workbenchEntity(objectsById[focusId] || focus, "未命名关注点");
      const services = workbenchSources(workbench, objectsById, focusId, "supports_focus", "security_technical_service");
      return services.flatMap((service) => {
        const scopes = workbenchTargets(workbench, objectsById, service.id, "applies_to_scope", "scope_type");
        const modules = workbenchTargets(workbench, objectsById, service.id, "implemented_by_module", "security_technology_module").map((module) => ({
          ...module,
          objectKind: "安全技术模块",
        }));
        const measures = workbenchTargets(workbench, objectsById, service.id, "has_measure", "security_technical_measure").map((measure) => ({
          ...measure,
          objectKind: "安全技术措施",
        }));
        const scopeRows = scopes.length ? scopes : [{ id: `${service.id}:scope:pending`, type: "scope_type", code: "", title: PENDING_TEXT }];
        return scopeRows.map((scope) => ({
          id: `${focusId}:${service.id}:${scope.id}`,
          focus: focusEntity,
          scope,
          services: [service],
          modules: [...modules, ...measures],
          status: "mapped",
          dataSource: "capability-workbench.json",
        }));
      });
    });
  }

  function buildCapabilityManagementRowsFromWorkbench(workbench, focuses) {
    if (!workbench || workbench.__data_state === "missing_file") return [];
    const objectsById = workbenchObjectsById(workbench);
    return list(focuses).map((focus) => {
      const focusId = focus.id;
      const focusEntity = workbenchEntity(objectsById[focusId] || focus, "未命名关注点");
      const securityWorks = workbenchTargets(workbench, objectsById, focusId, "maps_to_work", "security_work");
      const processReferences = workbenchTargets(workbench, objectsById, focusId, "maps_to_process", "process_reference");
      const processGroups = uniqueBy(
        processReferences.flatMap((process) => workbenchTargets(workbench, objectsById, process.id, "belongs_to", "process_group")),
        (item) => item.id || item.code || item.title,
      );
      const activities = uniqueBy(
        processReferences.flatMap((process) => workbenchTargets(workbench, objectsById, process.id, "has_activity", "process_activity")),
        (item) => item.id || item.code || item.title,
      );
      const stakeholders = uniqueBy(
        processReferences.flatMap((process) => workbenchTargets(workbench, objectsById, process.id, "stakeholder_by", "work_function")),
        (item) => item.id || item.code || item.title,
      );
      return {
        id: `${focusId}:management`,
        focus: focusEntity,
        securityWorks,
        stakeholders,
        processGroups,
        processReferences,
        activities,
        hasMissingActivity: processReferences.length > 0 && activities.length === 0,
        dataSource: "capability-workbench.json",
      };
    });
  }

  function buildCapabilityStandardRowsFromWorkbench(workbench, focuses) {
    if (!workbench || workbench.__data_state === "missing_file") return [];
    const objectsById = workbenchObjectsById(workbench);
    const frameworksByCode = {};
    for (const item of Object.values(workbench?.objects?.standard_framework || {})) {
      if (item?.code) frameworksByCode[item.code] = workbenchEntity(item, "标准 / 框架");
    }
    return list(focuses).map((focus) => {
      const focusId = focus.id;
      const focusEntity = workbenchEntity(objectsById[focusId] || focus, "未命名关注点");
      const controls = workbenchTargets(workbench, objectsById, focusId, "maps_to_standard", "standard_control");
      const frameworks = uniqueBy(
        controls
          .map((control) => frameworksByCode[control.frameworkCode] || (control.frameworkCode ? { id: control.frameworkCode, code: control.frameworkCode, title: control.frameworkTitle || control.frameworkCode } : null))
          .filter(Boolean),
        (framework) => framework.id || framework.code || framework.title,
      );
      return {
        id: `${focusId}:standard`,
        focus: focusEntity,
        standards: frameworks,
        controls,
        dataSource: "capability-workbench.json",
      };
    });
  }

  function buildCapabilityWorkspaceViewModel({ capabilityWorkbench, capabilityWorkbenchViewModel, capabilityTree, capabilityProjection, management, selectedCapabilityId, search, relationshipFilters }) {
    const dataSource = workbenchDataSource({
      workbench: capabilityWorkbench,
      workbenchViewModel: capabilityWorkbenchViewModel,
      workbenchName: "capability-workbench.json",
      fallbackName: "capability-tree.json + maintenance-knowledge.json + shared-lookups.json",
    });
    const navigationTree = buildNavigationTree(capabilityTree, search);
    const fallbackSelection = defaultCapabilitySelection(capabilityTree);
    const selectedResult = selectedCapabilityId ? findCapabilityItemAndFocuses(capabilityTree, selectedCapabilityId) : { selected: null };
    const selectedRaw = selectedResult.selected || fallbackSelection;
    const selectedCapability = compactEntity(selectedRaw);
    const selectedDetail = selectedCapability;
    const selectedId = selectedCapability?.id || null;
    const query = normalizeSearch(search);
    const selectedFocuses = findCapabilityItemAndFocuses(capabilityTree, selectedId).focuses;
    const rows = filterRelationshipRows(
      relationshipMatrixRows({ capabilityTree, management, selectedCapabilityId: selectedId }).filter((row) =>
        includesSearch(query, row.focus.code, row.focus.title, ...row.services.map(titleOf), ...row.scopes.map(titleOf), ...row.processGroups.map(titleOf), ...row.processReferences.map(titleOf), ...row.modules.map(titleOf)),
      ),
      relationshipFilters,
    );
    const visibleFocusIds = new Set(rows.map((row) => row.focus.id));
    const visibleFocuses = selectedFocuses.filter((focus) => !query || visibleFocusIds.has(focus.id) || includesSearch(query, focus.code, focus.title, focus.description));
    const visibleFocusIdSet = new Set(visibleFocuses.map((focus) => focus.id));
    const workbenchTechnicalRows = buildCapabilityTechnicalRowsFromWorkbench(capabilityWorkbench, visibleFocuses);
    const workbenchManagementRows = buildCapabilityManagementRowsFromWorkbench(capabilityWorkbench, visibleFocuses);
    const workbenchStandardRows = buildCapabilityStandardRowsFromWorkbench(capabilityWorkbench, visibleFocuses);
    const projectedTechnicalRows = list(capabilityProjection?.technicalMappingRows || capabilityProjection?.technical_mapping_rows);
    const projectedManagementRows = list(capabilityProjection?.managementMappingRows || capabilityProjection?.management_mapping_rows);
    const technicalMappingRows = workbenchTechnicalRows.length
      ? workbenchTechnicalRows
      : projectedTechnicalRows.length
      ? projectedTechnicalRows.filter((row) => visibleFocusIdSet.has(row.focus?.id))
      : buildTechnicalMappingRows({ management, focuses: visibleFocuses });
    const managementMappingRows = workbenchManagementRows.length
      ? workbenchManagementRows
      : projectedManagementRows.length
      ? projectedManagementRows.filter((row) => visibleFocusIdSet.has(row.focus?.id))
      : buildManagementMappingRows({ focuses: visibleFocuses });
    const focusOverview = buildFocusOverview({ capabilityTree, focuses: visibleFocuses, selectedDetail, technicalRows: technicalMappingRows, managementRows: managementMappingRows });
    const selectedFocusRow = rows.find((row) => row.focus.id === selectedId) || rows[0] || null;
    const isFocus = selectedDetail?.type === "capability_focus";
    const chainFocus = selectedFocusRow || null;
    const detailRaw = selectedDetail?.id ? findCapabilityItemAndFocuses(capabilityTree, selectedDetail.id).selected : selectedRaw;
    const detailRawProcesses = list(detailRaw?.process_mappings);
    const detailTechnicalRows = isFocus ? technicalMappingRows.filter((row) => row.focus.id === selectedDetail.id) : technicalMappingRows;
    const detailManagementRows = isFocus ? managementMappingRows.filter((row) => row.focus.id === selectedDetail.id) : managementMappingRows;
    const detailStandardRows = isFocus ? workbenchStandardRows.filter((row) => row.focus.id === selectedDetail.id) : workbenchStandardRows;
    const detailServices = uniqueBy(detailTechnicalRows.flatMap((row) => row.services), (service) => service.id || service.code || service.title);
    const detailProcesses = isFocus ? detailRawProcesses.map(compactProcessMapping) : [];
    const detailModules = uniqueBy(detailTechnicalRows.flatMap((row) => row.modules), (module) => module.id || module.code || module.title);
    const detailSecurityWorks = isFocus ? managementMappingRows.find((row) => row.focus.id === selectedDetail.id)?.securityWorks || [] : uniqueBy(managementMappingRows.flatMap((row) => row.securityWorks), (work) => work.id || work.code || work.title);
    const detailSourceItems = [...list(detailRaw?.security_works), ...list(detailRaw?.scope_mappings)];
    const detailSourceEvidence = sourceEvidenceFor(detailRaw, detailRawProcesses, detailSourceItems);
    const projectedFocusId = isFocus ? selectedDetail.id : selectedFocusRow?.focus?.id || null;
    const projectedLocalRelationMap = projectedLocalRelationMapFor(capabilityProjection, projectedFocusId);
    const usingWorkbenchMappingRows = Boolean(workbenchTechnicalRows.length || workbenchManagementRows.length);
    const localRelationMap =
      !usingWorkbenchMappingRows && projectedLocalRelationMap
        ? projectedLocalRelationMap
        : buildCapabilityLocalRelationMap({
            selectedDetail,
            detailRawProcesses,
            detailTechnicalRows,
            detailManagementRows,
            detailStandardRows,
            detailSourceEvidence,
          });

    return {
      navigationTree,
      selectedCapability: selectedDetail,
      relationshipSummary: {
        rowCount: visibleFocuses.length,
        selectedType: selectedDetail?.type || selectedCapability?.type || "能力对象",
        serviceCount: summarizeTechnical(technicalMappingRows).serviceCount,
        technicalRowCount: technicalMappingRows.length,
        managementRowCount: managementMappingRows.length,
        standardRowCount: workbenchStandardRows.filter((row) => list(row.controls).length).length,
        noServiceCount: summarizeTechnical(technicalMappingRows).noServiceCount,
        ambiguousCount: summarizeTechnical(technicalMappingRows).ambiguousCount,
      },
      focusOverview,
      technicalMappingRows,
      managementMappingRows,
      standardMappingRows: workbenchStandardRows,
      localRelationMap,
      localRelationMapSource: usingWorkbenchMappingRows ? "capability_workbench" : projectedLocalRelationMap ? "backend_projection" : "viewmodel_fallback",
      localRelationshipNotes: buildLocalRelationshipNotes(chainFocus, technicalMappingRows, managementMappingRows),
      relationshipMatrixRows: rows,
      relationshipChainRows: buildRelationshipChainRows(chainFocus),
      selectedPathRow: chainFocus,
      detailInspector: buildDetailInspector(
        selectedDetail,
        selectedCapability?.type,
        detailProcesses,
        detailServices,
        detailModules,
        detailRaw,
        detailRawProcesses,
        summarizeTechnical(detailTechnicalRows),
        summarizeManagement(detailManagementRows),
        detailSecurityWorks,
        detailSourceItems,
      ),
      dataSource,
      workbenchViewModel: capabilityWorkbenchViewModel || null,
    };
  }

  function countLinked(items) {
    return uniqueBy(list(items), (item) => item?.id || item?.code || item?.title || item?.name).length;
  }

  function isBlank(value) {
    if (value == null) return true;
    if (typeof value === "number" && Number.isNaN(value)) return true;
    return typeof value === "string" && !value.trim();
  }

  function isExplicitNotApplicable(value) {
    const normalized = text(typeof value === "object" ? titleOf(value, "") : value).trim().toLowerCase();
    return ["/", "无", "n/a", "na", "none", "not applicable", "不适用", "无需"].includes(normalized);
  }

  function businessText(value, fallback = PENDING_TEXT) {
    if (isBlank(value)) return fallback;
    const raw = typeof value === "object" ? titleOf(value, "") : value;
    if (isBlank(raw)) return fallback;
    if (isExplicitNotApplicable(raw)) return NOT_APPLICABLE_TEXT;
    const normalized = text(raw).trim();
    return normalized && normalized !== "[object Object]" ? normalized : fallback;
  }

  function asMeasureList(value) {
    if (Array.isArray(value)) return value;
    if (isBlank(value)) return [];
    return [value];
  }

  function measureFieldValues(measure, keys) {
    return keys.flatMap((key) => asMeasureList(measure?.[key]));
  }

  function compactMeasureEntity(item, fallback = PENDING_TEXT) {
    const title = businessText(item, fallback);
    if (title === fallback && isBlank(item)) return null;
    if (title === NOT_APPLICABLE_TEXT) {
      return { id: "not-applicable", type: "not_applicable", code: "", title: NOT_APPLICABLE_TEXT, name: "", description: "", layer: "", status: "" };
    }
    const entity = compactEntity(item, fallback);
    return {
      id: businessText(entity?.id || title, title),
      type: entity?.type || "",
      code: entity?.code || "",
      title: businessText(entity?.title || title, fallback),
      name: entity?.name || "",
      description: entity?.description || "",
      layer: entity?.layer || "",
      status: entity?.status || "",
    };
  }

  function compactMeasureEntities(measure, keys) {
    return uniqueBy(
      measureFieldValues(measure, keys).map((item) => compactMeasureEntity(item)).filter(Boolean),
      (item) => item.id || item.code || item.title || item.name,
    );
  }

  function applicableMeasureEntities(items) {
    return list(items).filter((item) => item?.type !== "not_applicable" && item?.title !== NOT_APPLICABLE_TEXT);
  }

  function measureEntityCountLabel(items) {
    const rows = list(items);
    return rows.some((item) => item?.type === "not_applicable" || item?.title === NOT_APPLICABLE_TEXT) ? NOT_APPLICABLE_TEXT : rows.length;
  }

  function measureFocusCount(measure, focuses) {
    const focusValues = measureFieldValues(measure, ["focuses", "capability_focuses", "related_focuses"]);
    if (focusValues.some(isExplicitNotApplicable)) return NOT_APPLICABLE_TEXT;
    const explicitCount = measure?.related_focus_count ?? measure?.focus_count ?? measure?.capability_focus_count;
    if (!isBlank(explicitCount)) {
      const count = Number(explicitCount);
      return Number.isFinite(count) ? count : PENDING_TEXT;
    }
    return ["focuses", "capability_focuses", "related_focuses"].some((key) => hasOwn(measure, key)) ? focuses.length : PENDING_TEXT;
  }

  function measureStatusText(value, fallback = "正常") {
    const status = businessText(value, fallback);
    const normalized = text(status).trim().toLowerCase();
    if (["pending", "待确认", "待确认中"].includes(normalized)) return "待确认";
    if (["normal", "active", "ok", "ready", "正常"].includes(normalized)) return "正常";
    if (["missing", "待补充"].includes(normalized)) return PENDING_TEXT;
    return status;
  }

  function sourceEvidenceKey(source) {
    return [source?.file, source?.source_file, source?.sheet, source?.row, source?.cell, source?.path, source?.location].filter(Boolean).join(":") || JSON.stringify(source);
  }

  function measureRelatedEnvironmentRows(management, services, scopes) {
    const serviceRows = applicableMeasureEntities(services);
    const scopeRows = applicableMeasureEntities(scopes);
    return list(management?.environment_scope_tree).flatMap((environment) =>
      list(environment.objects).flatMap((object) =>
        list(object.scope_mappings)
          .filter((mapping) => {
            const scopeMatched = !scopeRows.length || scopeRows.some((scope) => sameEntity(scope, mapping.scope));
            const serviceMatched = !serviceRows.length || list(mapping.services).some((service) => serviceRows.some((measureService) => sameEntity(measureService, service)));
            return scopeMatched && serviceMatched;
          })
          .map((mapping) => ({ environment, object, scope: mapping.scope })),
      ),
    );
  }

  function compactMeasureRow(management, measure, index) {
    const services = compactMeasureEntities(measure, ["services", "related_services", "technical_services"]);
    const modules = compactMeasureEntities(measure, ["modules", "related_modules", "technology_modules"]);
    const scopes = compactMeasureEntities(measure, ["scopes", "scope_types", "applicable_scopes"]);
    const focuses = compactMeasureEntities(measure, ["focuses", "capability_focuses", "related_focuses"]);
    const environmentRows = measureRelatedEnvironmentRows(management, services, scopes);
    const environments = uniqueBy(
      environmentRows.map((row) => compactEntity(row.environment, "待补充")).filter(Boolean),
      (item) => item.id || item.code || item.title,
    );
    const environmentObjects = uniqueBy(
      environmentRows.map((row) => compactEntity(row.object, "待补充")).filter(Boolean),
      (item) => item.id || item.code || item.title,
    );
    const name = businessText(measure?.title || measure?.name || measure?.measure_name || measure?.technical_measure_name);
    const category = businessText(measure?.category || measure?.classification);
    const status = measureStatusText(measure?.status || measure?.state, name === PENDING_TEXT ? PENDING_TEXT : "正常");
    const notes = [];
    if (!environments.length || !environmentObjects.length) {
      notes.push("信息化环境和对象由安全技术服务 + 作用域在 environment_scope_tree 中派生；当前数据未命中时显示待补充。");
    }
    return {
      id: measure?.id || measure?.code || measure?.title || measure?.name || `measure-${index}`,
      index: index + 1,
      measureName: name,
      serviceNames: services.map((item) => titleOf(item, PENDING_TEXT)),
      scopeNames: scopes.map((item) => titleOf(item, PENDING_TEXT)),
      environmentNames: environments.map((item) => titleOf(item, PENDING_TEXT)),
      environmentObjectNames: environmentObjects.map((item) => titleOf(item, PENDING_TEXT)),
      detail: {
        category,
        relatedModules: modules,
        relatedFocuses: focuses,
        status,
        notes,
      },
      linkedServices: services,
      linkedModules: modules,
      applicableScopes: scopes,
      relatedFocusCount: measureFocusCount(measure, focuses),
      relatedEnvironments: environments,
      relatedEnvironmentObjects: environmentObjects,
      status,
    };
  }

  function entityKeys(item) {
    return [item?.id, item?.code, item?.title, item?.name].map(text).map((value) => value.trim()).filter(Boolean);
  }

  function sameEntity(a, b) {
    const left = new Set(entityKeys(a));
    return entityKeys(b).some((key) => left.has(key));
  }

  function moduleRelatedEnvironmentRows(management, module) {
    return list(management?.environment_scope_tree).flatMap((environment) =>
      list(environment.objects).flatMap((object) =>
        list(object.scope_mappings)
          .filter((mapping) =>
            list(mapping.services).some((service) => list(service.modules).some((linkedModule) => sameEntity(linkedModule, module))),
          )
          .map((mapping) => ({ environment, object, scope: mapping.scope })),
      ),
    );
  }

  function moduleLinkedScopes(management, module) {
    const serviceKeys = new Set(list(module?.services).flatMap(entityKeys));
    const indexScopes = list(management?.service_module_index)
      .filter((entry) => entityKeys(entry.service).some((key) => serviceKeys.has(key)))
      .flatMap((entry) => list(entry.scopes));
    const environmentScopes = moduleRelatedEnvironmentRows(management, module).map((row) => row.scope);
    return uniqueBy([...indexScopes, ...environmentScopes], (scope) => scope?.id || scope?.code || scope?.title);
  }

  function moduleLinkedInformationObjects(management, module) {
    return uniqueBy(moduleRelatedEnvironmentRows(management, module).map((row) => row.object), (object) => object?.id || object?.code || object?.title);
  }

  function suspiciousModuleTitle(module) {
    const title = titleOf(module, "").trim();
    return !title || title === "/" || title.toLowerCase() === "n/a" || /^\d+$/.test(title);
  }

  function compactTechnologyModuleRow(management, module, index) {
    const suspiciousTitle = suspiciousModuleTitle(module);
    const services = uniqueBy(list(module?.services), (service) => service?.id || service?.code || service?.title);
    const systems = uniqueBy(list(module?.systems), (system) => system?.id || system?.code || system?.title);
    const products = uniqueBy(list(module?.products), (product) => product?.id || product?.code || product?.title);
    const environments = uniqueBy(list(module?.environments), (environment) => environment?.id || environment?.code || environment?.title);
    const catalogSourceRows = list(module?.sources)
      .filter((source) => source?.sheet === "安全技术模块清单" && Number(source?.row))
      .map((source) => Number(source.row));
    const measures = uniqueBy(list(module?.measures || module?.security_technical_measures || module?.technical_measures), (measure) => measure?.id || measure?.code || measure?.title || measure?.name);
    const scopes = moduleLinkedScopes(management, module);
    const informationObjects = moduleLinkedInformationObjects(management, module);
    const missing = [
      !text(module?.category).trim() ? "模块分类" : "",
      !text(module?.description).trim() ? "描述" : "",
    ].filter(Boolean);
    return {
      id: module?.id || module?.code || module?.title || `technology-module-${index}`,
      category: module?.category || "待契约补充",
      catalogOrder: catalogSourceRows.length ? Math.min(...catalogSourceRows) : null,
      inCatalog: catalogSourceRows.length > 0,
      title: suspiciousTitle ? "待确认" : titleOf(module, "待补充"),
      description: module?.description || "待补充",
      serviceCount: services.length,
      measureCount: measures.length || "待契约补充",
      scopeCount: scopes.length || "待契约补充",
      informationObjectCount: informationObjects.length || "待契约补充",
      measureMappingStatus: measures.length ? `${measures.length} 项` : "当前维护包未包含模块-措施映射",
      scopeMappingStatus: scopes.length ? `${scopes.length} 个作用域` : "当前维护包未包含模块-作用域映射",
      informationObjectMappingStatus: informationObjects.length ? `${informationObjects.length} 个对象` : "当前维护包未包含模块-对象映射",
      informationEnvironmentStatus: environments.length ? environments.map((environment) => titleOf(environment, "未命名环境")).join("、") : "当前维护包未包含环境映射",
      status: suspiciousTitle ? "待确认" : missing.length ? "待补充" : "正常",
      missingFields: missing,
      linkedServices: services.map(compactEntity),
      linkedSystems: systems.map(compactEntity),
      linkedProducts: products.map(compactEntity),
      linkedMeasures: measures.map(compactEntity),
      linkedScopes: scopes.map(compactEntity),
      informationObjects: informationObjects.map(compactEntity),
      informationEnvironments: environments.map(compactEntity),
    };
  }

  function hasTechnologyModuleCatalogSource(module) {
    return list(module?.sources).some((source) => source?.sheet === "安全技术模块清单" && Number(source?.row));
  }

  function catalogTechnologyModules(management) {
    return list(management?.security_technology_modules).filter((module) => hasTechnologyModuleCatalogSource(module) || text(module?.category).trim());
  }

  function securityWorkDisplayCode(work, focus, index) {
    const explicitCode = text(work?.code).trim();
    if (explicitCode.startsWith("SW-")) return explicitCode;
    const focusCode = businessText(focus?.code, "FOCUS");
    const sequence = String(index + 1).padStart(2, "0");
    return `SW-${focusCode}-${sequence}`;
  }

  function capabilityFocusRows(capabilityTree) {
    return list(capabilityTree?.categories).flatMap((category) =>
      list(category.domains).flatMap((domain) =>
        list(domain.capabilities).flatMap((capability) =>
          list(capability.focuses).map((focus) => ({
            category,
            domain,
            capability,
            focus,
          })),
        ),
      ),
    );
  }

  function compactSecurityWorkRow({ category, domain, capability, focus, work }, index, focusWorkIndex) {
    const workTitle = businessText(work?.title || work?.name);
    const missing = [
      !text(focus?.code).trim() ? "关注点编码" : "",
      workTitle === PENDING_TEXT ? "安全工作名称" : "",
    ].filter(Boolean);
    return {
      id: [focus?.id || focus?.code || index, work?.id || work?.title || focusWorkIndex].join("::"),
      rawId: work?.id || work?.title || `security-work-${index}`,
      index: index + 1,
      displayCode: securityWorkDisplayCode(work, focus, focusWorkIndex),
      title: workTitle,
      capability: compactEntity(capability, "待补充"),
      focus: compactEntity(focus, "待补充"),
      focusCode: businessText(focus?.code),
      focusTitle: businessText(focus?.title),
      category: compactEntity(category, "待补充"),
      domain: compactEntity(domain, "待补充"),
      status: missing.length ? "待补充" : work?.status === "active" ? "正常" : businessText(work?.status, "正常"),
      missingFields: missing,
    };
  }

  function buildSecurityWorkMaintenanceViewModel({ capabilityTree, search }) {
    const query = normalizeSearch(search);
    const rawRows = capabilityFocusRows(capabilityTree).flatMap((path) =>
      list(path.focus.security_works).map((work, focusWorkIndex) => ({ ...path, work, focusWorkIndex })),
    );
    const rowPairs = rawRows.map((item, index) => ({
      item,
      row: compactSecurityWorkRow(item, index, item.focusWorkIndex),
    }));
    const rows = rowPairs
      .map(({ row }) => row)
      .filter((row) =>
        includesSearch(
          query,
          row.displayCode,
          row.title,
          row.status,
          row.capability?.title,
          row.focusCode,
          row.focusTitle,
          row.category?.title,
          row.domain?.title,
        ),
      );
    return {
      rows,
      summary: {
        totalSecurityWorks: rows.length,
        linkedCapabilities: countLinked(rows.map((row) => row.capability)),
        linkedFocuses: countLinked(rows.map((row) => row.focus)),
        pendingFields: rows.filter((row) => row.status === "待补充").length,
      },
      sourceEvidenceById: Object.fromEntries(rowPairs.map(({ item, row }) => [row.id, uniqueBy(list(item.work?.sources), sourceEvidenceKey)])),
      emptyState: rows.length ? "" : "暂无安全工作数据，请确认 ETL 是否已在 capability-tree 中导出 security_works。",
    };
  }

  function buildTechnologyModuleMaintenanceViewModel({ management, search }) {
    const query = normalizeSearch(search);
    const rows = catalogTechnologyModules(management)
      .map((module, index) => compactTechnologyModuleRow(management, module, index))
      .filter((row) =>
        includesSearch(
          query,
          row.category,
          row.title,
          row.description,
          row.status,
          ...row.linkedSystems.map(titleOf),
          ...row.linkedServices.map(titleOf),
          ...row.linkedScopes.map(titleOf),
          ...row.informationObjects.map(titleOf),
          ...row.informationEnvironments.map(titleOf),
        ),
      );
    return {
      rows,
      summary: {
        totalModules: rows.length,
        linkedServices: countLinked(rows.flatMap((row) => row.linkedServices)),
        linkedScopes: countLinked(rows.flatMap((row) => row.linkedScopes)),
        linkedObjects: countLinked(rows.flatMap((row) => row.informationObjects)),
        linkedSystems: countLinked(rows.flatMap((row) => row.linkedSystems)),
        linkedEnvironments: countLinked(rows.flatMap((row) => row.informationEnvironments)),
        pendingConfirmation: rows.filter((row) => row.status === "待确认").length,
        missingFields: rows.filter((row) => row.status === "待补充").length,
      },
      emptyState: rows.length ? "" : "暂无安全技术模块数据，请确认 ETL 是否已导出 security_technology_modules。",
    };
  }

  function compactStandardRoleReferenceRow(item, index, kind) {
    const rawId = item?.id || item?.code || item?.title || `${kind}-${index}`;
    const source = kind === "standard" ? "GB/T 42446-2023" : "Gartner";
    const referenceType = kind === "standard" ? "GB/T 42446-2023" : "Gartner 工作岗位参考";
    const title = businessText(item?.title || item?.name);
    const description = businessText(item?.description || item?.summary);
    const missing = [
      !text(item?.title).trim() ? "名称" : "",
    ].filter(Boolean);
    return {
      id: `${kind}:${rawId}`,
      rawId,
      referenceKind: kind,
      referenceType,
      source,
      category: businessText(item?.category),
      title,
      description,
      linkedSecurityFunctions: [],
      linkedProcesses: [],
      candidateSecurityFunctions: [],
      matchEvidence: PENDING_TEXT,
      mappingStatus: kind === "standard" ? "待确认" : "待复核",
      reviewStatus: kind === "standard" ? "待确认" : "待复核",
      status: missing.length ? "待补充" : kind === "standard" ? "待确认" : "待复核",
      missingFields: missing,
    };
  }

  function flattenWorkFunctions(management) {
    return list(management?.work_function_layers).flatMap((layer) =>
      list(layer.groups).flatMap((group) =>
        list(group.functions).map((fn) => ({
          layer,
          group,
          fn,
        })),
      ),
    );
  }

  function referenceMatches(reference, item) {
    if (!reference || !item) return false;
    return (
      (reference.id && item.id && reference.id === item.id) ||
      (reference.title && item.title && reference.title === item.title) ||
      (reference.code && item.code && reference.code === item.code)
    );
  }

  function linkedRowsForGbtReference(management, item) {
    const workFunctions = flattenWorkFunctions(management).filter(({ fn }) => list(fn?.gbt_42446_refs).some((reference) => referenceMatches(reference, item)));
    const linkedSecurityFunctions = uniqueBy(
      workFunctions.map(({ layer, group, fn }) => ({
        ...compactEntity(fn, "待补充"),
        layer: layer?.title || "",
        group: group?.title || "",
      })),
      (fn) => fn.id || fn.code || fn.title,
    );
    const linkedProcesses = uniqueBy(
      workFunctions.flatMap(({ fn }) => processReferencesForWorkFunction(management, fn).map(({ reference }) => compactEntity(reference, "待补充"))),
      (reference) => reference.id || reference.code || reference.title,
    );
    return { linkedSecurityFunctions, linkedProcesses };
  }

  function gartnerCandidateFunctions(item) {
    return uniqueBy(
      [
        ...compactMeasureEntities(item, ["candidate_security_functions", "security_functions", "work_functions", "linked_security_functions"]),
        ...list(item?.candidate_work_functions).map((candidate) => compactEntity(candidate, "待补充")).filter(Boolean),
      ],
      (candidate) => candidate.id || candidate.code || candidate.title,
    );
  }

  function buildStandardRoleReferenceViewModel({ management, search }) {
    const query = normalizeSearch(search);
    const standardPairs = list(management?.gbt_42446_references).map((item, index) => {
        const row = compactStandardRoleReferenceRow(item, index, "standard");
        const linked = linkedRowsForGbtReference(management, item);
        return {
          item,
          row: {
          ...row,
          linkedSecurityFunctions: linked.linkedSecurityFunctions,
          linkedProcesses: linked.linkedProcesses,
          mappingStatus: linked.linkedSecurityFunctions.length || linked.linkedProcesses.length ? "待复核" : "待确认",
          status: linked.linkedSecurityFunctions.length || linked.linkedProcesses.length ? "待复核" : row.status,
          },
        };
      });
    const standardRows = standardPairs
      .map(({ row }) => row)
      .filter((row) =>
        includesSearch(
          query,
          row.source,
          row.category,
          row.title,
          row.description,
          row.mappingStatus,
          ...row.linkedSecurityFunctions.map(titleOf),
          ...row.linkedProcesses.map(titleOf),
        ),
      );
    const rolePairs = list(management?.gartner_roles).map((item, index) => {
        const candidates = gartnerCandidateFunctions(item);
        return {
          item,
          row: {
          ...compactStandardRoleReferenceRow(item, index, "role"),
          candidateSecurityFunctions: candidates,
          matchEvidence: businessText(item?.match_basis || item?.match_reason || item?.mapping_basis || item?.evidence),
          mappingStatus: "待复核",
          reviewStatus: "待复核",
          status: "待复核",
          },
        };
      });
    const roleRows = rolePairs
      .map(({ row }) => row)
      .filter((row) =>
        includesSearch(
          query,
          row.source,
          row.category,
          row.title,
          row.description,
          row.matchEvidence,
          row.reviewStatus,
          ...row.candidateSecurityFunctions.map(titleOf),
        ),
      );
    const rows = [...standardRows, ...roleRows];
    return {
      rows,
      standardRows,
      roleRows,
      summary: {
        totalReferences: rows.length,
        standardTasks: standardRows.length,
        roleReferences: roleRows.length,
        pendingReview: rows.filter((row) => row.status === "待复核" || row.status === "待确认").length,
        missingLinks: [...standardRows.filter((row) => !row.linkedSecurityFunctions.length && !row.linkedProcesses.length), ...roleRows.filter((row) => !row.candidateSecurityFunctions.length)].length,
        missingFields: rows.filter((row) => row.status === "待补充").length,
      },
      emptyState: rows.length ? "" : "暂无岗位参考页面数据，请确认 ETL 是否已导出 gbt_42446_references 与 gartner_roles。",
      sourceEvidenceById: {
        ...Object.fromEntries(standardPairs.map(({ item, row }) => [row.id, uniqueBy(list(item?.sources), sourceEvidenceKey)])),
        ...Object.fromEntries(rolePairs.map(({ item, row }) => [row.id, uniqueBy(list(item?.sources), sourceEvidenceKey)])),
      },
    };
  }

  function compactLifecycleSoftwareReferenceRow(item, index) {
    return {
      id: item?.id || item?.title || `software-development-type-${index}`,
      referenceKind: "software-development-type",
      type: "软件开发类型",
      title: businessText(item?.title),
      description: businessText(item?.description),
      status: item?.status === "active" ? "正常" : businessText(item?.status, "正常"),
      sourceEvidence: uniqueBy(list(item?.sources), sourceEvidenceKey),
    };
  }

  function compactLifecycleApplicationSystemReferenceRow(system, index) {
    const components = list(system?.components).map(compactLifecycleItem);
    return {
      id: system?.id || system?.title || `application-system-type-${index}`,
      referenceKind: "application-system-type",
      type: "应用系统类型",
      title: businessText(system?.title),
      description: businessText(system?.description),
      components,
      componentCount: components.length,
      status: system?.status === "active" ? "正常" : businessText(system?.status, "正常"),
      sourceEvidence: uniqueBy([...list(system?.sources), ...list(system?.components).flatMap((component) => list(component?.sources))], sourceEvidenceKey),
    };
  }

  function buildLifecycleReferenceMaintenanceViewModel({ lifecycle, search }) {
    const query = normalizeSearch(search);
    const applicationSecurity = lifecycle?.application_security_development || {};
    const softwareRows = list(applicationSecurity.software_development_types)
      .map(compactLifecycleSoftwareReferenceRow)
      .filter((row) => includesSearch(query, row.type, row.title, row.description, row.status));
    const applicationRows = list(applicationSecurity.application_system_types)
      .map(compactLifecycleApplicationSystemReferenceRow)
      .filter((row) => includesSearch(query, row.type, row.title, row.description, row.status, ...row.components.map(titleOf)));
    const rows = [...softwareRows, ...applicationRows];
    return {
      rows,
      softwareRows,
      applicationRows,
      summary: {
        totalReferences: rows.length,
        softwareTypes: softwareRows.length,
        applicationSystemTypes: applicationRows.length,
        applicationComponents: applicationRows.reduce((sum, row) => sum + row.componentCount, 0),
      },
      sourceEvidenceById: Object.fromEntries(rows.map((row) => [row.id, row.sourceEvidence])),
      emptyState: rows.length ? "" : "暂无 LC-AP 参考数据，请确认 lifecycle-knowledge.json 是否已导出软件开发类型、应用系统类型和应用组件。",
    };
  }

  function scopeScenario(scope) {
    const scenario = text(scope?.scenario || scope?.category).trim();
    return scenario && scenario !== "未分类" ? scenario : "网络空间";
  }

  function compactScopeMaintenanceRow(scope) {
    const services = uniqueBy(list(scope?.services), (service) => service?.id || service?.code || service?.title);
    const informationObjects = uniqueBy(list(scope?.information_objects), (object) => object?.id || object?.code || object?.title);
    const missing = [
      !text(scope?.code).trim() ? "作用域编码" : "",
      !text(scope?.title).trim() ? "作用域名称" : "",
      !text(scope?.description).trim() ? "描述" : "",
    ].filter(Boolean);
    return {
      id: scope?.id || scope?.code || scope?.title || "scope",
      scenario: scopeScenario(scope),
      code: scope?.code || "待补充",
      type: scope?.type || "scope_type",
      title: titleOf(scope, "待补充"),
      description: scope?.description || "待补充",
      serviceCount: services.length,
      informationObjectCount: informationObjects.length,
      status: missing.length ? "待补充" : "正常",
      missingFields: missing,
      linkedServices: services.map(compactEntity),
      informationObjects: informationObjects.map(compactEntity),
    };
  }

  function buildScopeMaintenanceViewModel({ management, search }) {
    const query = normalizeSearch(search);
    const rows = list(management?.scope_types)
      .map(compactScopeMaintenanceRow)
      .filter((row) =>
        includesSearch(
          query,
          row.scenario,
          row.code,
          row.title,
          row.description,
          ...row.linkedServices.map(titleOf),
          ...row.informationObjects.map(titleOf),
        ),
      );
    return {
      rows,
      summary: {
        totalScopes: rows.length,
        scenarios: countLinked(rows.map((row) => ({ title: row.scenario }))),
        linkedServices: rows.reduce((sum, row) => sum + row.serviceCount, 0),
        linkedObjects: rows.reduce((sum, row) => sum + row.informationObjectCount, 0),
      },
      emptyState: rows.length ? "" : "暂无作用域数据，请确认 ETL 是否已导出 scope_types。",
    };
  }

  function buildTechnicalMeasureMaintenanceViewModel({ management, search }) {
    const query = normalizeSearch(search);
    const hasMeasureField = hasOwn(management, TECHNICAL_MEASURES_FIELD);
    const rawMeasures = hasMeasureField ? list(management?.[TECHNICAL_MEASURES_FIELD]) : [];
    const rowPairs = rawMeasures.map((measure, index) => ({ measure, row: compactMeasureRow(management, measure, index) }));
    const rows = rowPairs.map(({ row }) => row).filter((row) =>
      includesSearch(
        query,
        row.measureName,
        row.detail.category,
        row.status,
        ...row.serviceNames,
        ...row.scopeNames,
        ...row.environmentNames,
        ...row.environmentObjectNames,
        ...row.linkedModules.map(titleOf),
      ),
    );
    const dataState = !hasMeasureField ? "field_missing" : rawMeasures.length ? (rows.length ? "ready" : "filtered") : "empty";
    const sourceEvidenceById = Object.fromEntries(
      rowPairs.map(({ measure, row }) => [row.id, uniqueBy(list(measure?.sources), sourceEvidenceKey)]),
    );
    return {
      rows,
      summary: {
        totalMeasures: rows.length,
        linkedServices: countLinked(rows.flatMap((row) => applicableMeasureEntities(row.linkedServices))),
        linkedScopes: countLinked(rows.flatMap((row) => applicableMeasureEntities(row.applicableScopes))),
        linkedEnvironments: countLinked(rows.flatMap((row) => row.relatedEnvironments)),
        linkedObjects: countLinked(rows.flatMap((row) => row.relatedEnvironmentObjects)),
        missingMappings: rows.filter((row) => !row.linkedServices.length || !row.applicableScopes.length || !row.relatedEnvironments.length || !row.relatedEnvironmentObjects.length).length,
      },
      sourceEvidenceById,
      dataState,
      emptyState: rows.length
        ? ""
        : dataState === "field_missing"
          ? "当前数据包尚未包含 security_technical_measures 字段，请确认 ETL 是否已导出 security_technical_measures。"
          : dataState === "filtered"
            ? "未找到匹配的安全技术措施，请调整搜索条件。"
            : TECHNICAL_MEASURES_EMPTY_MESSAGE,
    };
  }

  function processReferenceRows(management) {
    return list(management?.security_processes).flatMap((domain) =>
      list(domain.groups).flatMap((group) =>
        list(group.references).map((reference) => ({
          domain,
          group,
          reference,
        })),
      ),
    );
  }

  function compactProcessMaintenanceRow({ domain, group, reference }) {
    const activities = list(reference?.activities);
    const stakeholders = uniqueBy(list(reference?.stakeholders), (stakeholder) => stakeholder?.id || stakeholder?.code || stakeholder?.title);
    const missing = [
      !text(domain?.title).trim() ? "流程域" : "",
      !text(group?.title).trim() ? "L2 流程组" : "",
      !text(reference?.title).trim() ? "L3 流程" : "",
      !text(reference?.description).trim() ? "描述" : "",
    ].filter(Boolean);
    const l4Status = activities.length ? `${activities.length} 项` : reference?.activity_status_label || "待补充";
    return {
      id: reference?.id || [domain?.title, group?.title, reference?.title].filter(Boolean).join(" / ") || "process",
      domain: [domain?.code, domain?.title].filter(Boolean).join(" ") || "待补充",
      processGroup: [group?.code, group?.title].filter(Boolean).join(" ") || "待补充",
      processReference: titleOf(reference, "待补充"),
      l4ActivityStatus: l4Status,
      description: reference?.description || "待补充",
      relatedFocusCount: reference?.capability_focus_code ? 1 : "待补充",
      securityFunctionCount: stakeholders.length || "待补充",
      status: missing.length || reference?.missing_activity || reference?.activity_status === "missing" ? "待补充" : "正常",
      missingFields: missing,
      activities: activities.map(compactEntity),
      stakeholders: stakeholders.map(compactEntity),
    };
  }

  function buildProcessMaintenanceViewModel({ management, search }) {
    const query = normalizeSearch(search);
    const rows = processReferenceRows(management)
      .map(compactProcessMaintenanceRow)
      .filter((row) =>
        includesSearch(
          query,
          row.domain,
          row.processGroup,
          row.processReference,
          row.l4ActivityStatus,
          row.description,
          row.status,
          ...row.stakeholders.map(titleOf),
          ...row.activities.map(titleOf),
        ),
      );
    return {
      rows,
      summary: {
        totalProcesses: rows.length,
        processGroups: countLinked(rows.map((row) => ({ title: row.processGroup }))),
        missingActivities: rows.filter((row) => row.l4ActivityStatus === "待补充" || row.status === "待补充").length,
        linkedFunctions: countLinked(rows.flatMap((row) => row.stakeholders)),
      },
      emptyState: rows.length ? "" : "暂无流程清单数据，请确认 ETL 是否已导出 security_processes。",
    };
  }

  function processReferencesForWorkFunction(management, workFunction) {
    return processReferenceRows(management).filter(({ reference }) =>
      list(reference?.stakeholders).some((stakeholder) => {
        return (
          (workFunction?.id && stakeholder?.id === workFunction.id) ||
          (workFunction?.code && stakeholder?.code === workFunction.code) ||
          (workFunction?.title && stakeholder?.title === workFunction.title)
        );
      }),
    );
  }

  function compactWorkFunctionMaintenanceRow(management, layer, group, fn) {
    const tasks = list(fn?.tasks);
    const processReferences = processReferencesForWorkFunction(management, fn);
    const missing = [
      !text(layer?.title).trim() ? "安全职能层" : "",
      !text(group?.title).trim() ? "职能组" : "",
      !text(fn?.code).trim() ? "安全职能编码" : "",
      !text(fn?.title).trim() ? "安全职能名称" : "",
      !text(fn?.description).trim() ? "定义" : "",
    ].filter(Boolean);
    return {
      id: fn?.id || fn?.code || fn?.title || "work-function",
      securityFunctionLayer: layer?.title || "待补充",
      functionGroup: group?.title || "待补充",
      code: fn?.code || "待补充",
      title: titleOf(fn, "待补充"),
      description: fn?.description || "待补充",
      securityWorkCount: tasks.length,
      processCount: processReferences.length || "待补充",
      status: missing.length ? "待补充" : "正常",
      missingFields: missing,
      tasks: tasks.map(compactEntity),
      processReferences: uniqueBy(processReferences.map(({ reference }) => reference), (reference) => reference?.id || reference?.title).map(compactEntity),
      gbtReferences: list(fn?.gbt_42446_refs).map(compactEntity),
    };
  }

  function buildWorkFunctionMaintenanceViewModel({ management, search }) {
    const query = normalizeSearch(search);
    const rows = list(management?.work_function_layers)
      .flatMap((layer) =>
        list(layer.groups).flatMap((group) =>
          list(group.functions).map((fn) => compactWorkFunctionMaintenanceRow(management, layer, group, fn)),
        ),
      )
      .filter((row) =>
        includesSearch(
          query,
          row.securityFunctionLayer,
          row.functionGroup,
          row.code,
          row.title,
          row.description,
          row.status,
          ...row.tasks.map(titleOf),
          ...row.processReferences.map(titleOf),
        ),
      );
    return {
      rows,
      summary: {
        totalFunctions: rows.length,
        layers: countLinked(rows.map((row) => ({ title: row.securityFunctionLayer }))),
        linkedWorks: rows.reduce((sum, row) => sum + Number(row.securityWorkCount || 0), 0),
        linkedProcesses: rows.reduce((sum, row) => sum + (Number(row.processCount) || 0), 0),
        missingFields: rows.filter((row) => row.status === "待补充").length,
      },
      emptyState: rows.length ? "" : "暂无职能清单数据，请确认 ETL 是否已导出 work_function_layers。",
    };
  }

  function maintenanceNavigationItems(management, section, capabilityTree, lifecycle, standards) {
    const processCount = list(management?.security_processes).flatMap((domain) => list(domain.groups).flatMap((group) => list(group.references))).length;
    const workFunctionCount = list(management?.work_function_layers).flatMap((layer) => list(layer.groups).flatMap((group) => list(group.functions))).length;
    const referenceCount = list(management?.gbt_42446_references).length + list(management?.gartner_roles).length;
    const securityWorkCount = list(capabilityTree?.categories).flatMap((category) =>
      list(category.domains).flatMap((domain) => list(domain.capabilities).flatMap((capability) => list(capability.focuses).flatMap((focus) => list(focus.security_works)))),
    ).length;
    return [
      { id: "scopes", label: "作用域清单", count: list(management?.scope_types).length, implemented: true },
      { id: "modules", label: "安全技术模块清单", count: catalogTechnologyModules(management).length, implemented: true },
      { id: "measures", label: "安全技术措施清单", count: list(management?.security_technical_measures).length, implemented: true },
      { id: "security-works", label: "安全工作清单", count: securityWorkCount, implemented: true },
      { id: "processes", label: "流程清单", count: processCount, implemented: true },
      { id: "work-functions", label: "职能清单", count: workFunctionCount, implemented: true },
      { id: "references", label: "岗位 / 职能参考", count: referenceCount, implemented: true },
    ].map((item) => ({ ...item, active: item.id === section }));
  }

  const MAINTENANCE_SECTION_TABS = {
    modules: [
      { id: "modules", label: "安全技术模块目录" },
      { id: "measures", label: "安全技术措施目录" },
    ],
    measures: [
      { id: "modules", label: "安全技术模块目录" },
      { id: "measures", label: "安全技术措施目录" },
    ],
    "security-works": [
      { id: "security-works", label: "安全工作清单" },
      { id: "processes", label: "安全职能流程清单" },
    ],
    processes: [
      { id: "security-works", label: "安全工作清单" },
      { id: "processes", label: "安全职能流程清单" },
    ],
    "work-functions": [
      { id: "work-functions", label: "安全工作职能清单" },
      { id: "references-gbt", sourcePage: "references", referenceTab: "gbt", label: "GB/T 42446-2023" },
      { id: "references-gartner", sourcePage: "references", referenceTab: "gartner", label: "Gartner 工作岗位参考" },
    ],
    references: [
      { id: "work-functions", label: "安全工作职能清单" },
      { id: "references-gbt", sourcePage: "references", referenceTab: "gbt", label: "GB/T 42446-2023" },
      { id: "references-gartner", sourcePage: "references", referenceTab: "gartner", label: "Gartner 工作岗位参考" },
    ],
  };

  function maintenanceSectionTabs(section, counts = {}, referenceTab = "gbt") {
    return list(MAINTENANCE_SECTION_TABS[section]).map((tab) => ({
      ...tab,
      count: counts[tab.id] ?? 0,
      active: tab.sourcePage === "references" ? section === "references" && (tab.referenceTab || "gbt") === referenceTab : tab.id === section,
      implemented: true,
    }));
  }

  function maintenancePageMeta(section) {
    if (section === "modules" || section === "measures") {
      return {
        title: "安全技术模块/措施清单",
        description: "安全系统（为解决某一场景 / 领域的安全问题，由多个安全模块组成、协同运行的实体）；安全技术模块（实现一个或多个安全能力的安全技术逻辑实体，可以独立部署运行，通常代表一类安全产品）。",
        implemented: true,
        notice: section === "modules" ? "当前页签为安全技术模块目录；关联措施数依赖后续数据契约完善。" : "当前页签为安全技术措施目录；环境和对象关系由安全技术服务 + 作用域投影生成。",
      };
    }
    if (section === "security-works" || section === "processes") {
      return {
        title: "安全管理工作/流程清单",
        description: "集中维护安全工作清单和安全职能流程清单，按页签核对工作对象、流程域、L2/L3/L4 层级和关联状态。",
        implemented: true,
        notice: section === "security-works" ? "当前页签为安全工作清单；安全工作与安全职能不显示为直接关联。" : "当前页签为安全职能流程清单；L4 关键活动缺失继续作为待补状态展示。",
      };
    }
    if (section === "work-functions" || section === "references") {
      return {
        title: "安全职能清单",
        description: "集中维护安全工作职能清单、GB/T 42446-2023 任务参考和 Gartner 工作岗位参考，按页签核对安全职能分层、标准参考和岗位候选映射。",
        implemented: true,
        notice: section === "references" ? "当前页签为职能参考数据；映射结果只作为候选或待复核信息。" : "当前页签为安全工作职能清单，统一使用“安全职能”业务口径。",
      };
    }
    if (section === "scopes") {
      return {
        title: "安全能力作用域清单",
        description: "用于维护和核对安全能力作用域，展示处理后的业务字段和关联数量。",
        implemented: true,
      };
    }
    if (section === "standards") {
      return {
        title: "标准/框架清单",
        description: "展示已确认入库的等保三级和 CIS CSC V8 控制项；字段保持原始表口径，最后一列预留能力/关注点关联。",
        implemented: true,
        notice: "关联安全能力/关注点字段暂为空，等待后续映射处理。",
      };
    }
    return {
      title: "专项知识维护",
      description: "该专项页面将在后续阶段接入。",
      implemented: false,
    };
  }

  function buildStandardFrameworkViewModel({ standards, search, standardFrameworkId = "mlps-level-3" }) {
    const query = normalizeSearch(search);
    const frameworks = list(standards?.frameworks);
    const indexedFramework = frameworks.find((framework) => framework.id === standardFrameworkId) || frameworks[0] || null;
    const loadedFramework = standards?.loadedFrameworks?.[indexedFramework?.id];
    const activeFramework = loadedFramework || indexedFramework || null;
    const frameworkTables = list(activeFramework?.tabs).length
      ? list(activeFramework.tabs)
      : [
          {
            id: activeFramework?.id || "standard",
            title: activeFramework?.title || "标准/框架",
            columns: list(activeFramework?.columns),
            rows: list(activeFramework?.rows),
          },
        ];
    const tableModels = frameworkTables.map((table, tableIndex) => {
      const columns = list(table.columns);
      const rows = list(table.rows)
        .map((row, index) => ({
          id: row.id || `${activeFramework?.id || "standard"}:${table.id || tableIndex}:${index}`,
          frameworkId: activeFramework?.id || "",
          tableId: table.id || `${tableIndex}`,
          values: row,
        }))
        .filter((row) => !query || columns.some((column) => includesSearch(query, row.values[column])));
      return {
        id: table.id || `${tableIndex}`,
        title: table.title || activeFramework?.title || "标准/框架",
        columns,
        rows,
        totalRows: Number(table.totalRows) || list(table.rows).length,
        dataPath: table.dataPath || "",
        loaded: Boolean(table.loaded),
      };
    });
    const activeTable = tableModels[0] || { columns: [], rows: [] };
    const rows = tableModels.flatMap((table) => table.rows);
    const columns = activeTable.columns;
    const totalFrameworkRows = (framework) =>
      Number(framework?.totalRows) ||
      list(framework?.rows).length +
        list(framework?.tabs).reduce((sum, table) => sum + (Number(table.totalRows) || list(table.rows).length), 0);
    return {
      rows,
      columns,
      tables: tableModels,
      frameworkTabs: frameworks.map((framework) => ({
        id: framework.id,
        title: framework.title,
        count: totalFrameworkRows(framework),
      })),
      activeFrameworkId: activeFramework?.id || "",
      activeFrameworkTitle: activeFramework?.title || "",
      summaryBadges: list(activeFramework?.summaryBadges),
      summaryNote: activeFramework?.summaryNote || "",
      summary: {
        frameworks: frameworks.length,
        rows: rows.length,
        totalRows: frameworks.reduce((sum, framework) => sum + totalFrameworkRows(framework), 0),
      },
      dataState: standards?.data_state || "",
      emptyState: rows.length ? "" : "暂无标准框架数据，请先执行标准框架 JSON 投影。",
    };
  }

  function buildMaintenanceDetailPanel(row, section, sourceEvidence = []) {
    if (!row) return null;
    if (section === "scopes") {
      return {
        type: "安全作用域",
        code: row.code,
        title: row.title,
        description: row.description,
        facts: [
          { label: "情景", value: row.scenario },
          { label: "关联技术服务", value: row.serviceCount },
          { label: "关联信息化对象", value: row.informationObjectCount },
        ],
        sections: [
          { title: "关联安全技术服务", items: row.linkedServices },
          { title: "关联信息化对象", items: row.informationObjects },
        ],
        sourceEvidence,
      };
    }
    if (section === "processes") {
      return {
        type: "安全流程",
        code: row.domain,
        title: row.processReference,
        description: row.description,
        facts: [
          { label: "流程域", value: row.domain },
          { label: "L2 流程组", value: row.processGroup },
          { label: "L4 状态", value: row.l4ActivityStatus },
          { label: "关联关注点", value: row.relatedFocusCount },
          { label: "关联安全职能", value: row.securityFunctionCount },
        ],
        sections: [
          { title: "L4 关键活动", items: row.activities },
          { title: "关联安全职能", items: row.stakeholders },
        ],
        sourceEvidence,
      };
    }
    if (section === "work-functions") {
      return {
        type: "安全职能",
        code: row.code,
        title: row.title,
        description: row.description,
        facts: [
          { label: "安全职能层", value: row.securityFunctionLayer },
          { label: "职能组", value: row.functionGroup },
          { label: "关联安全工作", value: row.securityWorkCount },
          { label: "关联流程", value: row.processCount },
        ],
        sections: [
          { title: "关联安全工作", items: row.tasks },
          { title: "关联流程", items: row.processReferences },
          { title: "GB/T 42446-2023 参考", items: row.gbtReferences },
        ],
        sourceEvidence,
      };
    }
    if (section === "security-works") {
      return {
        type: "安全工作",
        code: row.displayCode,
        title: row.title,
        description: "安全工作作为独立对象展示；与安全职能不建立直接关系。",
        facts: [
          { label: "正式编码", value: row.displayCode },
          { label: "关联安全能力", value: titleOf(row.capability, "待补充") },
          { label: "关联关注点", value: [row.focusCode, row.focusTitle].filter(Boolean).join(" ") || "待补充" },
          { label: "状态", value: row.status },
        ],
        sections: [
          { title: "关联安全能力", items: row.capability ? [row.capability] : [] },
          { title: "关联关注点", items: row.focus ? [row.focus] : [] },
        ],
        sourceEvidence,
      };
    }
    if (section === "modules") {
      return {
        type: "安全技术模块",
        code: row.category,
        title: row.title,
        description: row.description,
        facts: [
          { label: "领域分类", value: row.category },
          { label: "安全系统", value: row.linkedSystems.length },
          { label: "关联安全技术服务", value: row.serviceCount },
          { label: "关联安全技术措施", value: row.measureCount },
          { label: "关联作用域", value: row.scopeCount },
          { label: "关联信息化对象", value: row.informationObjectCount },
        ],
        sections: [
          { title: "所属安全系统", items: row.linkedSystems },
          { title: "关联安全技术服务", items: row.linkedServices },
          { title: "关联安全技术措施", items: row.linkedMeasures },
          { title: "关联作用域", items: row.linkedScopes },
          { title: "关联信息化对象", items: row.informationObjects },
          { title: "关联信息化环境", items: row.informationEnvironments },
        ],
        sourceEvidence,
      };
    }
    if (section === "references") {
      return {
        type: row.referenceType,
        code: row.source,
        title: row.title,
        description: row.description,
        facts: [
          { label: "来源", value: row.source },
          { label: "分类", value: row.category },
          { label: row.referenceKind === "role" ? "候选安全职能" : "关联安全职能", value: row.referenceKind === "role" ? countLinked(row.candidateSecurityFunctions) || "待补充" : countLinked(row.linkedSecurityFunctions) || "待确认" },
          { label: "关联流程", value: row.referenceKind === "role" ? "待补充" : countLinked(row.linkedProcesses) || "待确认" },
          { label: "映射状态", value: row.mappingStatus || row.reviewStatus },
        ],
        sections:
          row.referenceKind === "role"
            ? [{ title: "候选安全职能", items: row.candidateSecurityFunctions }]
            : [
                { title: "关联安全职能（待复核）", items: row.linkedSecurityFunctions },
                { title: "关联流程（待确认）", items: row.linkedProcesses },
              ],
        sourceEvidence,
      };
    }
    if (section === "standards") {
      const values = row.values || {};
      const columns = Object.keys(values).filter((key) => key !== "id");
      return {
        type: "标准控制项",
        code: values["保护措施编号"] || "",
        title: values["名称"] || values["等保三级控制要求"] || "标准控制项",
        description: values["描述"] || values["等保三级控制要求"] || "",
        facts: columns
          .filter((column) => column !== "描述" && column !== "等保三级控制要求")
          .map((column) => ({ label: column, value: values[column] || "待处理" })),
        sections: [
          {
            title: values["描述"] ? "描述" : "等保三级控制要求",
            items: [values["描述"] || values["等保三级控制要求"] || ""].filter(Boolean),
          },
        ],
        sourceEvidence,
      };
    }
    if (section === "lcap-references") {
      return {
        type: row.type,
        code: row.type,
        title: row.title,
        description: row.description,
        facts: [
          { label: "参考类型", value: row.type },
          { label: "应用组件数", value: row.componentCount ?? "不适用" },
          { label: "状态", value: row.status },
        ],
        sections: row.referenceKind === "application-system-type" ? [{ title: "应用组件", items: row.components }] : [],
        sourceEvidence,
      };
    }
    return {
      type: "安全技术措施",
      code: row.id,
      title: row.measureName,
      description: row.detail?.notes?.join(" ") || "以安全技术措施为主对象，展示已处理后的服务、作用域、信息化环境和信息化对象关系。",
      facts: [
        { label: "关联服务", value: measureEntityCountLabel(row.linkedServices) },
        { label: "适用作用域", value: measureEntityCountLabel(row.applicableScopes) },
        { label: "关联信息化环境", value: measureEntityCountLabel(row.relatedEnvironments) },
        { label: "关联信息化对象", value: measureEntityCountLabel(row.relatedEnvironmentObjects) },
      ],
      sections: [
        { title: "关联安全技术服务", items: row.linkedServices },
        { title: "适用作用域", items: row.applicableScopes },
        { title: "关联信息化环境", items: row.relatedEnvironments },
        { title: "关联信息化对象", items: row.relatedEnvironmentObjects },
      ],
      sourceEvidence,
    };
  }

  function maintenanceSourceEvidence(management, section, row) {
    if (!row) return [];
    if (section === "scopes") {
      const source = list(management?.scope_types).find((scope) => (scope?.id || scope?.code || scope?.title) === row.id);
      return list(source?.sources);
    }
    if (section === "measures") {
      const source = list(management?.security_technical_measures).find((measure, index) => (measure?.id || measure?.code || measure?.title || measure?.name || `measure-${index}`) === row.id);
      return list(source?.sources);
    }
    if (section === "processes") {
      const source = processReferenceRows(management).find(({ reference }) => (reference?.id || reference?.title) === row.id);
      return uniqueBy(
        [...list(source?.domain?.sources), ...list(source?.group?.sources), ...list(source?.reference?.sources)],
        (item) => [item.file, item.source_file, item.sheet, item.row, item.cell, item.location].filter(Boolean).join(":") || JSON.stringify(item),
      );
    }
    if (section === "work-functions") {
      const source = list(management?.work_function_layers)
        .flatMap((layer) => list(layer.groups).flatMap((group) => list(group.functions)))
        .find((fn) => (fn?.id || fn?.code || fn?.title) === row.id);
      return list(source?.sources);
    }
    if (section === "security-works") {
      return [];
    }
    if (section === "modules") {
      const source = list(management?.security_technology_modules).find((module, index) => (module?.id || module?.code || module?.title || `technology-module-${index}`) === row.id);
      return list(source?.sources);
    }
    if (section === "references") {
      const sourceList = row.referenceKind === "standard" ? list(management?.gbt_42446_references) : list(management?.gartner_roles);
      const source = sourceList.find((item, index) => (item?.id || item?.code || item?.title || `${row.referenceKind}-${index}`) === row.rawId);
      return list(source?.sources);
    }
    return [];
  }

  function buildMaintenanceWorkspaceViewModel({ capabilityTree, management, maintenance, lifecycle, standards, section = "scopes", selectedId, search, referenceTab = "gbt", standardFrameworkId = "mlps-level-3" }) {
    const normalizedSection = ["scopes", "processes", "work-functions", "security-works", "modules", "measures", "lcap-references", "references", "standards"].includes(section) ? section : "scopes";
    const normalizedReferenceTab = referenceTab === "gartner" ? "gartner" : "gbt";
    const maintenanceKnowledge = maintenance || management;
    const navigationItems = maintenanceNavigationItems(maintenanceKnowledge, normalizedSection, capabilityTree, lifecycle, standards);
    const pageMeta = maintenancePageMeta(normalizedSection);
    const sectionViewModel =
      normalizedSection === "scopes"
        ? buildScopeMaintenanceViewModel({ management: maintenanceKnowledge, search })
        : normalizedSection === "processes"
          ? buildProcessMaintenanceViewModel({ management: maintenanceKnowledge, search })
          : normalizedSection === "work-functions"
          ? buildWorkFunctionMaintenanceViewModel({ management: maintenanceKnowledge, search })
          : normalizedSection === "security-works"
            ? buildSecurityWorkMaintenanceViewModel({ capabilityTree, search })
            : normalizedSection === "modules"
              ? buildTechnologyModuleMaintenanceViewModel({ management: maintenanceKnowledge, search })
              : normalizedSection === "measures"
                ? buildTechnicalMeasureMaintenanceViewModel({ management: maintenanceKnowledge, search })
                : normalizedSection === "lcap-references"
                  ? buildLifecycleReferenceMaintenanceViewModel({ lifecycle, search })
                : normalizedSection === "references"
                  ? buildStandardRoleReferenceViewModel({ management: maintenanceKnowledge, search })
                  : normalizedSection === "standards"
                    ? buildStandardFrameworkViewModel({ standards, search, standardFrameworkId })
                  : { rows: [], summary: {}, emptyState: pageMeta.description };
    const selectableRows =
      normalizedSection === "references" ? (normalizedReferenceTab === "gartner" ? sectionViewModel.roleRows || [] : sectionViewModel.standardRows || []) : sectionViewModel.rows;
    const selectedRow = selectableRows.find((row) => row.id === selectedId) || selectableRows[0] || null;
    const sourceEvidence =
      selectedRow && sectionViewModel.sourceEvidenceById
        ? list(sectionViewModel.sourceEvidenceById[selectedRow.id])
        : maintenanceSourceEvidence(maintenanceKnowledge, normalizedSection, selectedRow);
    const tabCounts = {
      ...Object.fromEntries(navigationItems.map((item) => [item.id, item.count])),
      "references-gbt": list(maintenanceKnowledge?.gbt_42446_references).length,
      "references-gartner": list(maintenanceKnowledge?.gartner_roles).length,
    };
    const visibleRows = normalizedSection === "references" ? selectableRows : sectionViewModel.rows;
    return {
      section: normalizedSection,
      navigationItems,
      sectionTabs: maintenanceSectionTabs(normalizedSection, tabCounts, normalizedReferenceTab),
      page: pageMeta,
      summary: sectionViewModel.summary,
      rows: visibleRows,
      standardRows: sectionViewModel.standardRows || [],
      roleRows: sectionViewModel.roleRows || [],
      frameworkTabs: sectionViewModel.frameworkTabs || [],
      activeFrameworkId: sectionViewModel.activeFrameworkId || standardFrameworkId,
      activeFrameworkTitle: sectionViewModel.activeFrameworkTitle || "",
      columns: sectionViewModel.columns || [],
      tables: sectionViewModel.tables || [],
      summaryBadges: sectionViewModel.summaryBadges || [],
      summaryNote: sectionViewModel.summaryNote || "",
      softwareRows: sectionViewModel.softwareRows || [],
      applicationRows: sectionViewModel.applicationRows || [],
      referenceTab: normalizedReferenceTab,
      selectedId: selectedRow?.id || null,
      detailPanel: buildMaintenanceDetailPanel(selectedRow, normalizedSection, sourceEvidence),
      sourceEvidence,
      dataState: sectionViewModel.dataState || "",
      emptyState: sectionViewModel.emptyState || "",
    };
  }

  function flattenEnvironmentObjects(management) {
    return list(management?.environment_scope_tree).flatMap((environment) =>
      list(environment.objects).map((object) => ({
        environment,
        object,
      })),
    );
  }

  function buildEnvironmentNavigationTree(management, search) {
    const query = normalizeSearch(search);
    return list(management?.environment_scope_tree)
      .map((environment) => {
        const objects = list(environment.objects)
          .filter((object) =>
            includesSearch(
              query,
              environment.title,
              environment.description,
              ...list(object.segments).map(titleOf),
              object.title,
              object.description,
              ...list(object.scope_mappings).map((mapping) => titleOf(mapping.scope)),
              ...list(object.scope_mappings).flatMap((mapping) => list(mapping.services).map(titleOf)),
            ),
          )
          .map((object) => ({
            id: object.id,
            environmentId: environment.id,
            type: "information_object",
            title: titleOf(object, "未命名对象"),
            description: object.description || "",
            segments: list(object.segments),
            scopeCount: Number(object.scope_count ?? list(object.scope_mappings).length) || 0,
            serviceCount: Number(object.service_count ?? 0) || 0,
            moduleCount: Number(object.module_count ?? 0) || 0,
          }));
        const segmentsById = new Map();
        for (const object of objects) {
          const segments = list(object.segments).length ? list(object.segments) : [{ id: `${environment.id}:segment:unclassified`, title: "未定义环境子类" }];
          for (const segment of segments) {
            const segmentId = segment.id || `${environment.id}:segment:${segment.title || "unclassified"}`;
            const segmentRow =
              segmentsById.get(segmentId) || {
                id: segmentId,
                environmentId: environment.id,
                type: "environment_segment",
                title: titleOf(segment, "未定义环境子类"),
                description: segment.description || "",
                objectCount: 0,
                objects: [],
              };
            segmentRow.objects.push(object);
            segmentRow.objectCount = segmentRow.objects.length;
            segmentsById.set(segmentId, segmentRow);
          }
        }
        const segments = [...segmentsById.values()].sort((left, right) => left.title.localeCompare(right.title, "zh-Hans-CN"));
        return {
          id: environment.id,
          type: "information_environment",
          title: titleOf(environment, "未命名环境"),
          description: environment.description || "",
          objectCount: objects.length,
          segmentCount: segments.length,
          segments,
          objects,
        };
      })
      .filter((environment) => environment.objects.length || includesSearch(query, environment.title, environment.description));
  }

  function findEnvironmentSelection(management, selectedObjectId, selectedEnvironmentId, selectedSegmentId, search) {
    const query = normalizeSearch(search);
    const environments = list(management?.environment_scope_tree)
      .map((environment) => {
        const objects = list(environment.objects).filter((object) =>
          includesSearch(
            query,
            environment.title,
            environment.description,
            object.title,
            object.description,
            ...list(object.scope_mappings).map((mapping) => titleOf(mapping.scope)),
            ...list(object.scope_mappings).flatMap((mapping) => list(mapping.services).map(titleOf)),
          ),
        );
        return { environment, objects };
      })
      .filter((row) => row.objects.length || includesSearch(query, row.environment.title, row.environment.description));
    const objectSelection = environments
      .flatMap(({ environment, objects }) => objects.map((object) => ({ selectionType: "object", environment, object, objects })))
      .find((row) => row.object.id === selectedObjectId);
    if (objectSelection) return objectSelection;
    const segmentSelection = environments
      .flatMap(({ environment, objects }) =>
        uniqueBy(list(objects).flatMap((object) => list(object.segments)), (segment) => segment?.id || segment?.title).map((segment) => ({
          selectionType: "segment",
          environment,
          segment,
          object: null,
          objects: objects.filter((object) => list(object.segments).some((item) => (item.id || item.title) === (segment.id || segment.title))),
        })),
      )
      .find((row) => (row.segment?.id || row.segment?.title) === selectedSegmentId);
    if (segmentSelection) return segmentSelection;
    const environmentSelection = environments.find((row) => row.environment.id === selectedEnvironmentId);
    if (environmentSelection) return { selectionType: "environment", environment: environmentSelection.environment, object: null, objects: environmentSelection.objects };
    const fallback = environments[0];
    if (!fallback) return null;
    const object = fallback.objects[0] || null;
    return object
      ? { selectionType: "object", environment: fallback.environment, object, objects: fallback.objects }
      : { selectionType: "environment", environment: fallback.environment, object: null, objects: fallback.objects };
  }

  function buildEnvironmentScopeServiceRows(management, selectedObject, showObjectColumn) {
    if (!selectedObject) return [];
    return list(selectedObject.scope_mappings).map((mapping) => {
      const services = uniqueBy(list(mapping.services), (service) => service.id || service.code || service.title);
      const modules = uniqueBy(services.flatMap((service) => list(service.modules)), (module) => module.id || module.code || module.title);
      const measures = measuresForServicesAndScope(management, services, mapping.scope);
      const technicalObjects = [
        ...modules.map((module) => compactTechnicalObject(module, "安全技术模块")),
        ...measures.map((measure) => compactTechnicalObject({ ...measure, type: "security_technical_measure" }, "安全技术措施")),
      ];
      const hasServices = services.length > 0;
      const hasModules = technicalObjects.length > 0;
      return {
        id: [showObjectColumn ? selectedObject.id : "", mapping.scope?.id || mapping.scope?.code || mapping.scope?.title || "scope"].filter(Boolean).join("::"),
        object: showObjectColumn ? compactEntity(selectedObject, "未命名对象") : null,
        segments: list(selectedObject.segments).map(compactEntity),
        scope: compactEntity(mapping.scope, "未命名作用域"),
        services: services.map(compactEntity),
        modules: technicalObjects,
        coverageStatus: hasServices && hasModules ? "已覆盖" : hasServices ? "模块待补充" : "不适用",
        note: hasServices ? (hasModules ? "已建立服务与模块/措施映射。" : "已有安全技术服务，安全技术模块/措施待补充。") : "该对象在此作用域下无适用安全技术服务。",
      };
    });
  }

  function buildEnvironmentLocalRelationNotes({ selectionType, selectedEnvironment, selectedSegment, selectedObject, summary, detailPanel }) {
    const scopeSubject = selectionType === "environment" ? "当前环境下的信息化对象" : selectionType === "segment" ? "当前环境子类下的信息化对象" : "当前信息化对象";
    const segmentText = list(detailPanel.segments).length ? list(detailPanel.segments).map(titleOf).join("、") : "暂无环境子类";
    return [
      {
        title: "关系主链路",
        body: `${scopeSubject} 按“安全作用域 → 安全技术服务 → 安全技术模块/措施”展示，后续系统或产品归属不作为本页主链路。`,
      },
      {
        title: "覆盖口径",
        body: `共 ${summary.scopeCount} 个作用域、${summary.serviceCount} 个安全技术服务、${summary.moduleCount} 个技术模块/措施；${summary.notApplicableCount} 个作用域无适用服务。`,
      },
      {
        title: "环境子类",
        body: selectedObject
          ? `${titleOf(selectedObject)} 所属环境子类：${segmentText}。环境子类是信息化环境下的正式层级。`
          : selectedSegment
            ? `${titleOf(selectedSegment)} 是 ${titleOf(selectedEnvironment)} 下的环境子类，表格展示该子类内对象的合并映射。`
            : `${titleOf(selectedEnvironment)} 下按环境子类组织信息化对象，表格展示该环境内对象的合并映射。`,
      },
    ];
  }

  function environmentSourceEvidence(environment, object, objects = []) {
    const evidenceObjects = object ? [object] : list(objects);
    return uniqueBy(
      [
        ...list(environment?.sources),
        ...evidenceObjects.flatMap((item) => list(item?.sources)),
        ...evidenceObjects.flatMap((item) => list(item?.segments).flatMap((segment) => list(segment.sources))),
        ...evidenceObjects.flatMap((item) => list(item?.scope_mappings).flatMap((mapping) => list(mapping.sources))),
        ...evidenceObjects.flatMap((item) => list(item?.scope_mappings).flatMap((mapping) => list(mapping.scope?.sources))),
        ...evidenceObjects.flatMap((item) => list(item?.scope_mappings).flatMap((mapping) => list(mapping.services).flatMap((service) => [...list(service.sources), ...list(service.mapping_sources)]))),
      ].filter(Boolean),
      (source) => [source.file, source.source_file, source.sheet, source.row, source.cell, source.path, source.location].filter(Boolean).join(":") || JSON.stringify(source),
    );
  }

  function compactEnvironmentGraphObject(object) {
    const compact = compactEntity(object, "未命名对象");
    return {
      ...compact,
      segments: list(object?.segments).map(compactEntity).filter(Boolean),
    };
  }

  function buildEnvironmentWorkspaceViewModel({ environmentWorkbench, environmentWorkbenchViewModel, management, selectedObjectId, selectedEnvironmentId, selectedSegmentId, search }) {
    const dataSource = workbenchDataSource({
      workbench: environmentWorkbench,
      workbenchViewModel: environmentWorkbenchViewModel,
      workbenchName: "environment-workbench.json",
      fallbackName: "environment-workbench.json",
    });
    const navigationTree = buildEnvironmentNavigationTree(management, search);
    const selected = findEnvironmentSelection(management, selectedObjectId, selectedEnvironmentId, selectedSegmentId, search);
    const selectedEnvironment = compactEntity(selected?.environment, "未命名环境");
    const selectedSegment = selected?.segment ? compactEntity(selected.segment, "未定义环境子类") : null;
    const selectedObject = selected?.object ? compactEntity(selected.object, "未命名对象") : null;
    const isEnvironmentSelection = selected?.selectionType === "environment";
    const isSegmentSelection = selected?.selectionType === "segment";
    const scopeServiceRows = isEnvironmentSelection
      ? list(selected?.objects).flatMap((object) => buildEnvironmentScopeServiceRows(management, object, true))
      : isSegmentSelection
        ? list(selected?.objects).flatMap((object) => buildEnvironmentScopeServiceRows(management, object, true))
      : buildEnvironmentScopeServiceRows(management, selected?.object, false);
    const summary = {
      objectCount: navigationTree.reduce((sum, environment) => sum + list(environment.objects).length, 0),
      selectedObjectCount: isEnvironmentSelection || isSegmentSelection ? list(selected?.objects).length : selectedObject ? 1 : 0,
      scopeCount: uniqueBy(scopeServiceRows.map((row) => row.scope), (scope) => scope?.id || scope?.code || scope?.title).length,
      serviceCount: uniqueBy(scopeServiceRows.flatMap((row) => row.services), (service) => service.id || service.code || service.title).length,
      moduleCount: uniqueBy(scopeServiceRows.flatMap((row) => row.modules), (module) => module.id || module.code || module.title).length,
      notApplicableCount: scopeServiceRows.filter((row) => !row.services.length).length,
      missingModuleCount: scopeServiceRows.filter((row) => row.services.length && !row.modules.length).length,
    };
    const detailPanel = {
      environment: selectedEnvironment,
      segment: selectedSegment,
      object: selectedObject,
      selectionType: selected?.selectionType || "",
      showObjectColumn: isEnvironmentSelection || isSegmentSelection,
      segments: isEnvironmentSelection || isSegmentSelection
        ? uniqueBy(list(selected?.objects).flatMap((object) => list(object.segments)), (segment) => segment?.id || segment?.code || segment?.title).map(compactEntity)
        : list(selected?.object?.segments).map(compactEntity),
      scopeCount: summary.scopeCount,
      serviceCount: summary.serviceCount,
      moduleCount: summary.moduleCount,
      description: selected?.object?.description || selected?.environment?.description || "暂无说明",
    };
    return {
      navigationTree,
      selectedEnvironment,
      selectedSegment,
      selectedObject,
      selectedMode: selected?.selectionType || "",
      relationshipSummary: summary,
      scopeServiceRows,
      detailPanel,
      localRelationNotes: buildEnvironmentLocalRelationNotes({ selectionType: selected?.selectionType, selectedEnvironment, selectedSegment, selectedObject, summary, detailPanel }),
      sourceEvidence: environmentSourceEvidence(selected?.environment, selected?.object, selected?.objects),
      dataSource,
      workbenchViewModel: environmentWorkbenchViewModel || null,
      environmentGraphContext: {
        selectionType: selected?.selectionType || "",
        current: selectedObject || selectedSegment || selectedEnvironment,
        selectedEnvironment,
        selectedSegment,
        selectedObject: selected?.object ? compactEnvironmentGraphObject(selected.object) : null,
        selectedObjects: list(selected?.objects).map(compactEnvironmentGraphObject),
        segments: isEnvironmentSelection
          ? uniqueBy(list(selected?.objects).flatMap((object) => list(object.segments)), (segment) => segment?.id || segment?.title).map(compactEntity)
          : selectedSegment
            ? [selectedSegment]
            : list(selected?.object?.segments).map(compactEntity),
        scopeServiceRows,
        summary,
        workbenchViewModel: environmentWorkbenchViewModel || null,
      },
    };
  }

  function lifecycleSourcesFor(process, extras = []) {
    return uniqueBy(
      [
        ...list(process?.sources),
        ...list(process?.main_activities).flatMap((item) => list(item?.sources)),
        ...list(process?.security_activities).flatMap((item) => list(item?.sources)),
        ...list(process?.policy_requirements).flatMap((item) => list(item?.sources)),
        ...list(process?.technical_services).flatMap((item) => list(item?.sources)),
        ...list(process?.technology_modules).flatMap((item) => list(item?.sources)),
        ...list(process?.technical_measures).flatMap((item) => list(item?.sources)),
        ...list(process?.development_product_components).flatMap((item) => list(item?.sources)),
        ...list(extras).flatMap((item) => list(item?.sources)),
      ].filter(Boolean),
      sourceEvidenceKey,
    );
  }

  function compactLifecycleItem(item, fallback = PENDING_TEXT) {
    const compact = compactEntity(item, fallback);
    return {
      ...compact,
      order: item?.order ?? item?.metadata?.order ?? "",
      category: businessText(item?.service_category || item?.category || item?.metadata?.service_category, ""),
    };
  }

  function lifecycleServiceCategory(service) {
    const sourceColumns = list(service?.sources).map((source) => text(source?.column).trim());
    const fromManagedSecurityColumn = sourceColumns.includes("安全服务（带管理类）") || sourceCellStartsWith(service, "Q");
    const fromSecurityServiceColumn = sourceColumns.includes("安全技术服务") || sourceCellStartsWith(service, "R");
    const serviceCode = text(service?.code).trim();
    const serviceTitle = titleOf(service, "");
    const serviceLabel = `${serviceCode} ${serviceTitle}`.trim();
    const managementNames = ["安全合规管理", "安全风险管理", "人员安全管理", "第三方安全管理", "第三方人员安全管理"];
    if (managementNames.some((name) => serviceTitle === name || serviceLabel.includes(name))) return "管理类";
    if (/T-AS\.DS-|软件威胁建模|代码安全检测|组件安全管理|安全组件和函数管理/.test(serviceLabel)) return "开发类";
    if (fromSecurityServiceColumn || fromManagedSecurityColumn) return "网络空间类";
    return businessText(service?.service_category || service?.metadata?.service_category, "未分类");
  }

  function sourceCellStartsWith(item, prefix) {
    const normalizedPrefix = text(prefix).trim().toUpperCase();
    return list(item?.sources).some((source) => text(source?.cell).trim().toUpperCase().startsWith(normalizedPrefix));
  }

  function isDevelopmentTechnicalService(service) {
    return list(service?.sources).some((source) => text(source?.column).trim() === "开发技术服务") || sourceCellStartsWith(service, "M");
  }

  function lifecycleProcessServices(process) {
    const services = list(process?.technical_services);
    return {
      developmentServices: services.filter(isDevelopmentTechnicalService),
      securityServices: services.filter((service) => !isDevelopmentTechnicalService(service)),
    };
  }

  function buildLifecycleNavigation(processes, search) {
    const query = normalizeSearch(search);
    return list(processes)
      .filter((process) =>
        includesSearch(
          query,
          process.code,
          process.title,
          process.description,
          process.goal,
          ...list(process.main_activities).map(titleOf),
          ...list(process.security_activities).map(titleOf),
          ...list(process.technical_services).map(titleOf),
          ...list(process.technology_modules).map(titleOf),
          ...list(process.technical_measures).map(titleOf),
        ),
      )
      .map((process) => ({
        id: process.id,
        code: process.code || `AP-${String(process.order || "").padStart(2, "0")}`,
        title: titleOf(process, "未命名阶段"),
        description: businessText(process.goal || process.description, ""),
        order: process.order || process.metadata?.order || "",
        serviceCount: list(process.technical_services).length,
        moduleCount: list(process.technology_modules).length,
        measureCount: list(process.technical_measures).length,
      }));
  }

  function buildLifecycleStageRows(processes) {
    return list(processes).map((process) => ({
      id: process.id,
      order: process.order || process.metadata?.order || "",
      code: process.code || "",
      title: titleOf(process, "未命名阶段"),
      goal: businessText(process.goal || process.description),
      mainActivities: list(process.main_activities).map(compactLifecycleItem),
      securityActivities: list(process.security_activities).map(compactLifecycleItem),
      policyRequirements: list(process.policy_requirements).map(compactLifecycleItem),
      developmentTypes: list(process.development_types).map(compactLifecycleItem),
      technicalServices: list(process.technical_services).map(compactLifecycleItem),
      technologyModules: list(process.technology_modules).map((module) => ({
        ...compactLifecycleItem(module),
        objectKind: "安全技术模块",
      })),
      technicalMeasures: list(process.technical_measures).map((measure) => ({
        ...compactLifecycleItem(measure),
        objectKind: "安全技术措施",
      })),
      productComponents: list(process.development_product_components).map((component) => ({
        ...compactLifecycleItem(component),
        objectKind: "开发类产品组件",
      })),
    }));
  }

  function buildLifecycleServiceRows(process) {
    const { developmentServices, securityServices } = lifecycleProcessServices(process);
    const securityServiceRows = securityServices.map((service, index) => ({
      id: service?.id || `service:${index}`,
      category: lifecycleServiceCategory(service),
      service: compactLifecycleItem(service),
      modules: list(service?.modules).map((module) => ({ ...compactLifecycleItem(module), objectKind: "安全技术模块" })),
      note: "安全技术服务明细",
    }));
    return {
      developmentServices: developmentServices.map(compactLifecycleItem),
      securityServiceRows,
      stageModules: list(process?.technology_modules).map((module) => ({ ...compactLifecycleItem(module), objectKind: "安全技术模块" })),
      stageMeasures: list(process?.technical_measures).map((measure) => ({ ...compactLifecycleItem(measure), objectKind: "安全技术措施" })),
      productComponents: list(process?.development_product_components).map((component) => ({ ...compactLifecycleItem(component), objectKind: "开发类产品组件" })),
    };
  }

  function buildLifecycleRelationRows(selectedStageRow, serviceMappingRows) {
    if (!selectedStageRow) return [];
    const securityServices = list(serviceMappingRows?.securityServiceRows).map((row) => ({
      ...row.service,
      objectKind: row.category || "安全技术服务",
      modules: row.modules,
    }));
    const serviceModules = uniqueBy(
      list(serviceMappingRows?.securityServiceRows).flatMap((row) => list(row.modules)),
      (item) => item.id || item.code || item.title || item.name,
    );
    const stageModules = list(serviceMappingRows?.stageModules);
    const technologyModules = uniqueBy([...serviceModules, ...stageModules], (item) => item.id || item.code || item.title || item.name);
    return [
      {
        id: `${selectedStageRow.id}:relation-row`,
        mainActivity: selectedStageRow.mainActivities,
        securityActivities: selectedStageRow.securityActivities,
        policyRequirements: selectedStageRow.policyRequirements,
        technicalServices: securityServices,
        technologyModules,
        technicalMeasures: list(serviceMappingRows?.stageMeasures),
        productComponents: list(serviceMappingRows?.productComponents),
        status: securityServices.length || technologyModules.length || list(serviceMappingRows?.stageMeasures).length ? "已关联" : "待补充",
      },
    ];
  }

  function buildLifecycleStageOverview(selectedStageRow, summary) {
    if (!selectedStageRow) return null;
    return {
      code: selectedStageRow.code || "LC-AP",
      title: selectedStageRow.title || PENDING_TEXT,
      description: selectedStageRow.goal || PENDING_TEXT,
      status: "当前阶段",
      facts: [
        { label: "主要活动", value: summary.mainActivityCount },
        { label: "安全活动", value: summary.securityActivityCount },
        { label: "策略要求", value: summary.policyRequirementCount },
        { label: "技术服务", value: summary.technicalServiceCount },
        { label: "开发技术服务", value: summary.developmentServiceCount },
        { label: "技术模块", value: summary.technologyModuleCount },
        { label: "技术措施", value: summary.technicalMeasureCount },
      ],
    };
  }

  function buildLifecycleLocalRelationNotes(selectedStageRow, serviceMappingRows) {
    if (!selectedStageRow) return [];
    const securityRows = list(serviceMappingRows?.securityServiceRows);
    const categories = uniqueBy(securityRows.map((row) => row.category).filter(Boolean), (category) => category);
    return [
      {
        title: "阶段关系",
        body: `当前阶段包含 ${list(selectedStageRow.mainActivities).length} 项主要活动、${list(selectedStageRow.securityActivities).length} 项安全活动和 ${list(selectedStageRow.policyRequirements).length} 条安全策略要求；这些对象都归属于当前 LC-AP 阶段，不强行画成单线性链路。`,
      },
      {
        title: "服务分类",
        body: `开发技术服务单独展示；安全技术服务在本页面按 ${categories.join("、") || "待补充"} 分类展示，该分类暂不扩展为全局主数据。`,
      },
    ];
  }

  function buildLifecycleReferenceSections(applicationSecurity) {
    const softwareDevelopmentTypes = list(applicationSecurity?.software_development_types).map(compactLifecycleItem);
    const applicationSystemTypes = list(applicationSecurity?.application_system_types).map((system) => ({
      ...compactLifecycleItem(system),
      components: list(system?.components).map(compactLifecycleItem),
    }));
    return {
      softwareDevelopmentTypes,
      applicationSystemTypes,
    };
  }

  function buildApplicationSecurityLifecycleWorkbenchViewModel({ lifecycleWorkbench, lifecycleWorkbenchViewModel, selectedProcessId, search, dataSource }) {
    const objectsById = workbenchObjectsById(lifecycleWorkbench);
    const stages = Object.values(lifecycleWorkbench?.objects?.lifecycle_stage || {}).map((stage) => workbenchEntity(stage, "未命名阶段"));
    const query = normalizeSearch(search);
    const navigationTree = stages
      .filter((stage) => includesSearch(query, stage.code, stage.title, stage.description))
      .map((stage) => ({
        ...stage,
        order: stage.code,
      }));
    const selectedId = selectedProcessId && navigationTree.some((row) => row.id === selectedProcessId) ? selectedProcessId : navigationTree[0]?.id || null;
    const selectedStage = navigationTree.find((stage) => stage.id === selectedId) || navigationTree[0] || null;
    const stageActivities = selectedStage ? workbenchTargets(lifecycleWorkbench, objectsById, selectedStage.id, "contains_activity", "lifecycle_activity").map(compactLifecycleItem) : [];
    const securityActivities = selectedStage ? workbenchTargets(lifecycleWorkbench, objectsById, selectedStage.id, "contains_control", "lifecycle_control").map(compactLifecycleItem) : [];
    const policyRequirements = selectedStage ? workbenchSources(lifecycleWorkbench, objectsById, selectedStage.id, "belongs_to", "lifecycle_requirement").map(compactLifecycleItem) : [];
    const technicalServices = selectedStage ? workbenchTargets(lifecycleWorkbench, objectsById, selectedStage.id, "maps_to_service", "security_technical_service").map(compactLifecycleItem) : [];
    const stageModules = selectedStage ? workbenchTargets(lifecycleWorkbench, objectsById, selectedStage.id, "implemented_by_module", "security_technology_module").map((module) => ({ ...compactLifecycleItem(module), objectKind: "安全技术模块" })) : [];
    const serviceModules = uniqueBy(
      technicalServices.flatMap((service) => workbenchTargets(lifecycleWorkbench, objectsById, service.id, "implemented_by_module", "security_technology_module")).map((module) => ({ ...compactLifecycleItem(module), objectKind: "安全技术模块" })),
      (module) => module.id || module.code || module.title,
    );
    const technologyModules = uniqueBy([...stageModules, ...serviceModules], (module) => module.id || module.code || module.title);
    const summary = {
      processCount: navigationTree.length,
      selectedProcessId: selectedId,
      mainActivityCount: stageActivities.length,
      securityActivityCount: securityActivities.length,
      policyRequirementCount: policyRequirements.length,
      developmentServiceCount: 0,
      technicalServiceCount: technicalServices.length,
      technologyModuleCount: technologyModules.length,
      technicalMeasureCount: 0,
      productComponentCount: 0,
      softwareDevelopmentTypeCount: 0,
      applicationSystemTypeCount: 0,
    };
    const selectedStageRow = selectedStage
      ? {
          ...selectedStage,
          mainActivities: stageActivities,
          securityActivities,
          policyRequirements,
          developmentTypes: [],
          technicalServices,
          technologyModules,
          technicalMeasures: [],
          productComponents: [],
        }
      : null;
    const stageOverview = selectedStage
      ? {
          code: selectedStage.code || "LC-AP",
          title: selectedStage.title || PENDING_TEXT,
          description: selectedStage.description || PENDING_TEXT,
          status: "当前阶段",
          facts: [
            { label: "主要活动", value: summary.mainActivityCount },
            { label: "安全活动", value: summary.securityActivityCount },
            { label: "安全策略", value: summary.policyRequirementCount },
            { label: "技术服务", value: summary.technicalServiceCount },
            { label: "技术模块", value: summary.technologyModuleCount },
          ],
        }
      : null;
    const relationRows = selectedStageRow
      ? [
          {
            id: `${selectedStageRow.id}:workbench-relation-row`,
            mainActivity: stageActivities,
            securityActivities,
            policyRequirements,
            technicalServices: technicalServices.map((service) => ({ ...service, objectKind: service.category || "安全技术服务" })),
            technologyModules,
            technicalMeasures: [],
            productComponents: [],
            status: technicalServices.length || technologyModules.length ? "已关联" : "待补充",
          },
        ]
      : [];
    return {
      dataState: dataSource.workbenchReady ? "ready" : "empty",
      title: "LC-AP开发安全生命周期",
      description: "展示 LC-AP 开发安全生命周期中阶段、活动、策略、技术服务和模块之间的关系。",
      navigationTree,
      stageTree: navigationTree,
      selectedProcess: selectedStageRow,
      selectedStage: selectedStageRow,
      relationshipSummary: summary,
      stageOverview,
      stageRows: navigationTree,
      activityPolicyRows: selectedStageRow
        ? [{ id: `${selectedStageRow.id}:activities`, process: selectedStageRow, mainActivities: stageActivities, securityActivities, policyRequirements }]
        : [],
      serviceMappingRows: {
        developmentServices: [],
        securityServiceRows: technicalServices.map((service) => ({ id: service.id, category: service.category || "安全技术服务", service, modules: workbenchTargets(lifecycleWorkbench, objectsById, service.id, "implemented_by_module", "security_technology_module").map(compactLifecycleItem) })),
        stageModules,
        stageMeasures: [],
        productComponents: [],
      },
      relationRows,
      referenceSections: { softwareDevelopmentTypes: [], applicationSystemTypes: [] },
      referenceGroups: { softwareDevelopmentTypes: [], applicationSystemTypes: [] },
      localRelationNotes: [
        { title: "数据源", body: "当前 LC-AP 页面优先使用 lifecycle-workbench.json 的阶段、活动、控制点、策略、服务和模块关系投影。" },
      ],
      detailPanel: selectedStage
        ? {
            type: "LC-AP 开发过程阶段",
            code: selectedStage.code || "LC-AP",
            title: selectedStage.title || PENDING_TEXT,
            description: selectedStage.description || PENDING_TEXT,
            facts: [
              { label: "阶段主要活动", value: summary.mainActivityCount },
              { label: "安全活动", value: summary.securityActivityCount },
              { label: "安全策略", value: summary.policyRequirementCount },
              { label: "安全技术服务", value: summary.technicalServiceCount },
              { label: "安全技术模块", value: summary.technologyModuleCount },
            ],
            sections: [
              { title: "阶段主要活动", items: stageActivities },
              { title: "安全活动", items: securityActivities },
              { title: "安全策略", items: policyRequirements },
            ],
            sourceEvidence: [],
          }
        : null,
      sourceEvidence: [],
      dataSource,
      workbenchViewModel: lifecycleWorkbenchViewModel || null,
      emptyState: navigationTree.length ? "" : "暂无 LC-AP workbench 数据，请确认 lifecycle-workbench.json 是否已生成。",
    };
  }

  function buildApplicationSecurityLifecycleViewModel({ lifecycleWorkbench, lifecycleWorkbenchViewModel, lifecycle, selectedProcessId, search }) {
    const sourceStatus = workbenchDataSource({
      workbench: lifecycleWorkbench,
      workbenchViewModel: lifecycleWorkbenchViewModel,
      workbenchName: "lifecycle-workbench.json",
      fallbackName: "lifecycle-knowledge.json",
    });
    if (sourceStatus.workbenchReady) {
      return buildApplicationSecurityLifecycleWorkbenchViewModel({
        lifecycleWorkbench,
        lifecycleWorkbenchViewModel,
        selectedProcessId,
        search,
        dataSource: sourceStatus,
      });
    }
    const appSecurity = lifecycle?.application_security_development || {};
    const dataState = lifecycle?.__data_state === "missing_file" ? "missing_file" : list(appSecurity.processes).length ? "ready" : "empty";
    const navigationTree = buildLifecycleNavigation(appSecurity.processes, search);
    const selectedId = selectedProcessId && navigationTree.some((row) => row.id === selectedProcessId) ? selectedProcessId : navigationTree[0]?.id || null;
    const process = list(appSecurity.processes).find((item) => item.id === selectedId) || list(appSecurity.processes)[0] || null;
    const stageRows = buildLifecycleStageRows(appSecurity.processes).filter((row) => !normalizeSearch(search) || navigationTree.some((nav) => nav.id === row.id));
    const selectedStageRow = stageRows.find((row) => row.id === selectedId) || stageRows[0] || null;
    const serviceMappingRows = buildLifecycleServiceRows(process);
    const referenceSections = buildLifecycleReferenceSections(appSecurity);
    const { developmentServices, securityServices } = lifecycleProcessServices(process);
    const summary = {
      processCount: stageRows.length,
      selectedProcessId: selectedId,
      mainActivityCount: list(process?.main_activities).length,
      securityActivityCount: list(process?.security_activities).length,
      policyRequirementCount: list(process?.policy_requirements).length,
      developmentServiceCount: developmentServices.length,
      technicalServiceCount: securityServices.length,
      technologyModuleCount: list(process?.technology_modules).length,
      technicalMeasureCount: list(process?.technical_measures).length,
      productComponentCount: list(process?.development_product_components).length,
      softwareDevelopmentTypeCount: referenceSections.softwareDevelopmentTypes.length,
      applicationSystemTypeCount: referenceSections.applicationSystemTypes.length,
    };
    const relationRows = buildLifecycleRelationRows(selectedStageRow, serviceMappingRows);
    const stageOverview = buildLifecycleStageOverview(selectedStageRow, summary);
    const detailPanel = process
      ? {
          type: "LC-AP 开发过程阶段",
          code: process.code || selectedStageRow?.code || "LC-AP",
          title: titleOf(process, "未命名阶段"),
          description: businessText(process.goal || process.description),
          facts: [
            { label: "阶段主要活动", value: summary.mainActivityCount },
            { label: "安全活动", value: summary.securityActivityCount },
            { label: "安全策略", value: summary.policyRequirementCount },
            { label: "模式", value: list(process?.development_types).length },
            { label: "开发技术服务", value: summary.developmentServiceCount },
            { label: "安全技术服务", value: summary.technicalServiceCount },
            { label: "安全技术模块", value: summary.technologyModuleCount },
            { label: "安全技术措施", value: summary.technicalMeasureCount },
            { label: "开发类产品组件", value: summary.productComponentCount },
          ],
          sections: [
            { title: "软件开发模式", items: selectedStageRow?.developmentTypes || [] },
            { title: "阶段主要活动", items: selectedStageRow?.mainActivities || [] },
            { title: "安全活动", items: selectedStageRow?.securityActivities || [] },
            { title: "安全策略", items: selectedStageRow?.policyRequirements || [] },
            { title: "开发类产品组件", items: selectedStageRow?.productComponents || [] },
          ],
          sourceEvidence: lifecycleSourcesFor(process),
        }
      : null;
    return {
      dataState,
      title: "LC-AP开发安全生命周期",
      description: "展示 LC-AP 开发安全生命周期中阶段、活动、策略、技术服务、模块、措施和开发类参考对象之间的关系。",
      navigationTree,
      stageTree: navigationTree,
      selectedProcess: selectedStageRow,
      selectedStage: selectedStageRow,
      relationshipSummary: summary,
      stageOverview,
      stageRows,
      activityPolicyRows: selectedStageRow
        ? [
            {
              id: `${selectedStageRow.id}:activities`,
              process: selectedStageRow,
              mainActivities: selectedStageRow.mainActivities,
              securityActivities: selectedStageRow.securityActivities,
              policyRequirements: selectedStageRow.policyRequirements,
            },
          ]
        : [],
      serviceMappingRows,
      relationRows,
      referenceSections,
      referenceGroups: referenceSections,
      localRelationNotes: buildLifecycleLocalRelationNotes(selectedStageRow, serviceMappingRows),
      detailPanel,
      sourceEvidence: detailPanel?.sourceEvidence || [],
      dataSource: sourceStatus,
      workbenchViewModel: lifecycleWorkbenchViewModel || null,
      emptyState: stageRows.length
        ? ""
        : dataState === "missing_file"
          ? "未找到 lifecycle-knowledge.json，请先执行 LC-AP 数据导出。"
          : "暂无 LC-AP 开发安全生命周期数据，请确认 lifecycle-knowledge.json 是否已导出。",
    };
  }

  function buildWorkbenchDataContractViewModel(workbench, fallbackTitle) {
    const data = workbench || {};
    const compatibility = data.compatibility || {};
    const warnings = uniqueBy([...(list(data.warnings)), ...(list(compatibility.warnings))], (warning) => text(warning));
    const objects = data.objects && typeof data.objects === "object" ? data.objects : {};
    const objectCounts = Object.fromEntries(Object.entries(objects).map(([type, rows]) => [type, rows && typeof rows === "object" ? Object.keys(rows).length : 0]));
    return {
      dataState: data.__data_state === "missing_file" ? "missing_file" : "ready",
      title: data.page?.title || fallbackTitle,
      page: data.page || {},
      navigatorData: data.navigator || {},
      overviewData: data.overview || {},
      relationshipGroups: list(data.relationshipGroups),
      objects,
      objectCounts,
      relations: list(data.relations),
      relationCount: list(data.relations).length,
      evidenceRefs: list(data.evidenceRefs),
      warnings,
      compatibility,
      meta: data.meta || {},
      emptyState: data.__data_state === "missing_file" ? `${fallbackTitle} 数据契约文件缺失。` : "",
    };
  }

  function workbenchDataSource({ workbench, workbenchViewModel, workbenchName, fallbackName }) {
    const ready = Boolean(workbench && workbench.__data_state !== "missing_file" && workbenchViewModel?.dataState === "ready" && (workbenchViewModel.relationCount > 0 || Object.values(workbenchViewModel.objectCounts || {}).some((count) => count > 0)));
    return {
      primary: ready ? workbenchName : fallbackName,
      workbenchName,
      fallbackName,
      workbenchReady: ready,
      fallbackRequired: !ready,
      status: ready ? "workbench_ready" : "legacy_fallback",
      relationCount: workbenchViewModel?.relationCount || 0,
      objectCounts: workbenchViewModel?.objectCounts || {},
      warnings: list(workbenchViewModel?.warnings),
    };
  }

  function buildCapabilityWorkbenchViewModel({ workbench } = {}) {
    return buildWorkbenchDataContractViewModel(workbench, "安全能力映射");
  }

  function buildEnvironmentWorkbenchViewModel({ workbench } = {}) {
    return buildWorkbenchDataContractViewModel(workbench, "信息化环境安全能力映射");
  }

  function buildLifecycleWorkbenchViewModel({ workbench } = {}) {
    return buildWorkbenchDataContractViewModel(workbench, "LC-AP 开发安全生命周期专项关系投影");
  }

  window.sapdViewModels = {
    buildCapabilityWorkbenchViewModel,
    buildCapabilityWorkspaceViewModel,
    buildEnvironmentWorkbenchViewModel,
    buildLifecycleWorkbenchViewModel,
    buildApplicationSecurityLifecycleViewModel,
    buildMaintenanceWorkspaceViewModel,
    buildProcessMaintenanceViewModel,
    buildScopeMaintenanceViewModel,
    buildSecurityWorkMaintenanceViewModel,
    buildTechnicalMeasureMaintenanceViewModel,
    buildTechnologyModuleMaintenanceViewModel,
    buildStandardRoleReferenceViewModel,
    buildWorkFunctionMaintenanceViewModel,
    buildEnvironmentWorkspaceViewModel,
    capabilityWorkbenchViewModel: buildCapabilityWorkbenchViewModel,
    environmentWorkbenchViewModel: buildEnvironmentWorkbenchViewModel,
    lifecycleWorkbenchViewModel: buildLifecycleWorkbenchViewModel,
  };
})();
