(function () {
  const list = (value) => (Array.isArray(value) ? value : []);
  const text = (value) => (value == null ? "" : String(value));
  const TECHNICAL_MEASURES_FIELD = "security_technical_measures";
  const TECHNICAL_MEASURES_EMPTY_MESSAGE = "暂无安全技术措施数据，请确认 ETL 是否已导出 security_technical_measures。";
  const PENDING_TEXT = "待补充";
  const NOT_APPLICABLE_TEXT = "不适用";
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

  function buildFocusOverview({ capabilityTree, management, focuses, selectedDetail, technicalRows = [], managementRows = [] }) {
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
        const focusTechnicalRows = technicalRows.filter((row) => row.focus.id === focus.id);
        const services = uniqueBy(focusTechnicalRows.flatMap((row) => row.services), (service) => service.id || service.code || service.title);
        const modules = modulesForServices(management, services);
        const processMappings = list(focus.process_mappings);
        return {
          focus: compactEntity(focus),
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
        const status = isAmbiguous ? "ambiguous_service_mapping" : confirmedServices.length ? "covered" : "no_service";
        return {
          focus: compactEntity(group.focus),
          scope: compactEntity(group.scope, "未命名作用域"),
          services: confirmedServices.map(compactEntity),
          candidateServices: candidateServices.map(compactEntity),
          modules: modules.map(compactEntity),
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

  function buildNavigationTree(capabilityTree, search) {
    const query = normalizeSearch(search);
    return flattenCapabilities(capabilityTree)
      .filter((row) => includesSearch(query, row.level, row.item.code, row.item.title, row.item.description))
      .map((row) => ({
        level: row.level,
        id: row.item.id,
        type: row.item.type || "",
        code: row.item.code || "",
        title: titleOf(row.item),
        description: row.item.description || "",
      }));
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
    return [
      {
        title: "技术视角",
        body: `当前关注点通过 ${technicalForFocus.length} 个作用域映射安全技术服务；其中 ${technicalForFocus.filter((item) => item.status === "no_service").length} 个作用域明确无适用服务，${technicalForFocus.filter((item) => item.status === "ambiguous_service_mapping").length} 条需要确认。技术服务由关注点与作用域共同决定。`,
      },
      {
        title: "管理视角",
        body: `当前关注点关联 ${managementForFocus?.securityWorks.length || 0} 项安全工作、${managementForFocus?.processReferences.length || 0} 个 L3 流程；L2 流程组归属于单一能力，不作为技术服务下游。`,
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

  function buildCapabilityWorkspaceViewModel({ capabilityTree, management, selectedCapabilityId, search, relationshipFilters }) {
    const navigationTree = buildNavigationTree(capabilityTree, search);
    const fallbackFocus = focusRows(capabilityTree)[0]?.item;
    const selectedResult = selectedCapabilityId ? findCapabilityItemAndFocuses(capabilityTree, selectedCapabilityId) : { selected: null };
    const selectedRaw = selectedResult.selected || fallbackFocus;
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
    const technicalMappingRows = buildTechnicalMappingRows({ management, focuses: visibleFocuses });
    const managementMappingRows = buildManagementMappingRows({ focuses: visibleFocuses });
    const focusOverview = buildFocusOverview({ capabilityTree, management, focuses: visibleFocuses, selectedDetail, technicalRows: technicalMappingRows, managementRows: managementMappingRows });
    const selectedFocusRow = rows.find((row) => row.focus.id === selectedId) || rows[0] || null;
    const isFocus = selectedDetail?.type === "capability_focus";
    const chainFocus = selectedFocusRow || null;
    const detailRaw = selectedDetail?.id ? findCapabilityItemAndFocuses(capabilityTree, selectedDetail.id).selected : selectedRaw;
    const detailRawProcesses = list(detailRaw?.process_mappings);
    const detailTechnicalRows = isFocus ? technicalMappingRows.filter((row) => row.focus.id === selectedDetail.id) : technicalMappingRows;
    const detailManagementRows = isFocus ? managementMappingRows.filter((row) => row.focus.id === selectedDetail.id) : managementMappingRows;
    const detailServices = uniqueBy(detailTechnicalRows.flatMap((row) => row.services), (service) => service.id || service.code || service.title);
    const detailProcesses = isFocus ? detailRawProcesses.map(compactProcessMapping) : [];
    const detailModules = uniqueBy(detailTechnicalRows.flatMap((row) => row.modules), (module) => module.id || module.code || module.title);
    const detailSecurityWorks = isFocus ? managementMappingRows.find((row) => row.focus.id === selectedDetail.id)?.securityWorks || [] : uniqueBy(managementMappingRows.flatMap((row) => row.securityWorks), (work) => work.id || work.code || work.title);
    const detailSourceItems = [...list(detailRaw?.security_works), ...list(detailRaw?.scope_mappings)];

    return {
      navigationTree,
      selectedCapability: selectedDetail,
      relationshipSummary: {
        rowCount: visibleFocuses.length,
        selectedType: selectedDetail?.type || selectedCapability?.type || "能力对象",
        serviceCount: summarizeTechnical(technicalMappingRows).serviceCount,
        technicalRowCount: technicalMappingRows.length,
        managementRowCount: managementMappingRows.length,
        noServiceCount: summarizeTechnical(technicalMappingRows).noServiceCount,
        ambiguousCount: summarizeTechnical(technicalMappingRows).ambiguousCount,
      },
      focusOverview,
      technicalMappingRows,
      managementMappingRows,
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
    const measures = uniqueBy(list(module?.measures || module?.security_technical_measures || module?.technical_measures), (measure) => measure?.id || measure?.code || measure?.title || measure?.name);
    const scopes = moduleLinkedScopes(management, module);
    const informationObjects = moduleLinkedInformationObjects(management, module);
    const missing = [
      !text(module?.category).trim() ? "模块分类" : "",
      !text(module?.description).trim() ? "描述" : "",
    ].filter(Boolean);
    return {
      id: module?.id || module?.code || module?.title || `technology-module-${index}`,
      category: module?.category || "待补充",
      title: suspiciousTitle ? "待确认" : titleOf(module, "待补充"),
      description: module?.description || "待补充",
      serviceCount: services.length,
      measureCount: measures.length || "待补充",
      scopeCount: scopes.length || "待补充",
      informationObjectCount: informationObjects.length || "待补充",
      status: suspiciousTitle ? "待确认" : missing.length ? "待补充" : "正常",
      missingFields: missing,
      linkedServices: services.map(compactEntity),
      linkedMeasures: measures.map(compactEntity),
      linkedScopes: scopes.map(compactEntity),
      informationObjects: informationObjects.map(compactEntity),
    };
  }

  function buildTechnologyModuleMaintenanceViewModel({ management, search }) {
    const query = normalizeSearch(search);
    const rows = list(management?.security_technology_modules)
      .map((module, index) => compactTechnologyModuleRow(management, module, index))
      .filter((row) =>
        includesSearch(
          query,
          row.category,
          row.title,
          row.description,
          row.status,
          ...row.linkedServices.map(titleOf),
          ...row.linkedScopes.map(titleOf),
          ...row.informationObjects.map(titleOf),
        ),
      );
    return {
      rows,
      summary: {
        totalModules: rows.length,
        linkedServices: countLinked(rows.flatMap((row) => row.linkedServices)),
        linkedScopes: countLinked(rows.flatMap((row) => row.linkedScopes)),
        linkedObjects: countLinked(rows.flatMap((row) => row.informationObjects)),
        pendingConfirmation: rows.filter((row) => row.status === "待确认").length,
        missingFields: rows.filter((row) => row.status === "待补充").length,
      },
      emptyState: rows.length ? "" : "暂无安全技术模块数据，请确认 ETL 是否已导出 security_technology_modules。",
    };
  }

  function compactStandardRoleReferenceRow(item, index, kind) {
    const rawId = item?.id || item?.code || item?.title || `${kind}-${index}`;
    const source = kind === "standard" ? "GB/T 42446-2023" : "Gartner";
    const referenceType = kind === "standard" ? "标准任务参考" : "岗位参考";
    const title = titleOf(item, "待补充");
    const description = item?.description || "待补充";
    const missing = [
      !text(item?.title).trim() ? "名称" : "",
      !text(item?.description).trim() ? "说明" : "",
    ].filter(Boolean);
    return {
      id: `${kind}:${rawId}`,
      rawId,
      referenceKind: kind,
      referenceType,
      source,
      category: item?.category || "待补充",
      title,
      description,
      linkedSecurityFunctions: "待补充",
      linkedProcesses: "待补充",
      status: missing.length ? "待补充" : "正常",
      missingFields: missing,
    };
  }

  function buildStandardRoleReferenceViewModel({ management, search }) {
    const query = normalizeSearch(search);
    const standardRows = list(management?.gbt_42446_references)
      .map((item, index) => compactStandardRoleReferenceRow(item, index, "standard"))
      .filter((row) => includesSearch(query, row.source, row.category, row.title, row.description, row.status));
    const roleRows = list(management?.gartner_roles)
      .map((item, index) => compactStandardRoleReferenceRow(item, index, "role"))
      .filter((row) => includesSearch(query, row.source, row.category, row.title, row.description, row.status));
    const rows = [...standardRows, ...roleRows];
    return {
      rows,
      standardRows,
      roleRows,
      summary: {
        totalReferences: rows.length,
        standardTasks: standardRows.length,
        roleReferences: roleRows.length,
        missingLinks: rows.filter((row) => row.linkedSecurityFunctions === "待补充" || row.linkedProcesses === "待补充").length,
        missingFields: rows.filter((row) => row.status === "待补充").length,
      },
      emptyState: rows.length ? "" : "暂无标准与岗位参考数据，请确认 ETL 是否已导出 gbt_42446_references 与 gartner_roles。",
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
          row.type,
          row.title,
          row.description,
          row.status,
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
        missingFields: rows.filter((row) => row.status === "待补充").length,
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

  function maintenanceNavigationItems(management, section) {
    const processCount = list(management?.security_processes).flatMap((domain) => list(domain.groups).flatMap((group) => list(group.references))).length;
    const workFunctionCount = list(management?.work_function_layers).flatMap((layer) => list(layer.groups).flatMap((group) => list(group.functions))).length;
    const referenceCount = list(management?.gbt_42446_references).length + list(management?.gartner_roles).length;
    return [
      { id: "scopes", label: "作用域清单", count: list(management?.scope_types).length, implemented: true },
      { id: "processes", label: "流程清单", count: processCount, implemented: true },
      { id: "work-functions", label: "职能清单", count: workFunctionCount, implemented: true },
      { id: "modules", label: "安全技术模块清单", count: list(management?.security_technology_modules).length, implemented: true },
      { id: "measures", label: "安全技术措施清单", count: list(management?.security_technical_measures).length, implemented: true },
      { id: "references", label: "标准与岗位参考", count: referenceCount, implemented: true },
    ].map((item) => ({ ...item, active: item.id === section }));
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
          { label: "作用域类型", value: row.type },
          { label: "关联技术服务", value: row.serviceCount },
          { label: "关联信息化对象", value: row.informationObjectCount },
          { label: "状态", value: row.status },
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
          { label: "状态", value: row.status },
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
          { label: "状态", value: row.status },
        ],
        sections: [
          { title: "关联安全工作", items: row.tasks },
          { title: "关联流程", items: row.processReferences },
          { title: "GB/T 42446-2023 参考", items: row.gbtReferences },
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
          { label: "模块分类", value: row.category },
          { label: "关联安全技术服务", value: row.serviceCount },
          { label: "关联安全技术措施", value: row.measureCount },
          { label: "关联作用域", value: row.scopeCount },
          { label: "关联信息化对象", value: row.informationObjectCount },
          { label: "状态", value: row.status },
        ],
        sections: [
          { title: "关联安全技术服务", items: row.linkedServices },
          { title: "关联安全技术措施", items: row.linkedMeasures },
          { title: "关联作用域", items: row.linkedScopes },
          { title: "关联信息化对象", items: row.informationObjects },
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
          { label: "关联安全职能", value: row.linkedSecurityFunctions },
          { label: "关联流程", value: row.linkedProcesses },
          { label: "状态", value: row.status },
        ],
        sections: [],
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
        { label: "状态", value: row.status },
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

  function buildMaintenanceWorkspaceViewModel({ management, section = "scopes", selectedId, search }) {
    const normalizedSection = ["scopes", "processes", "work-functions", "modules", "measures", "references"].includes(section) ? section : "scopes";
    const navigationItems = maintenanceNavigationItems(management, normalizedSection);
    const pageMeta = {
      scopes: {
        title: "作用域清单",
        description: "用于维护和核对安全作用域，展示处理后的业务字段和关联数量。",
        implemented: true,
      },
      measures: {
        title: "安全技术措施清单",
        description: "用于维护和核对安全技术措施，展示措施与安全技术服务、作用域、信息化环境和信息化对象的关系。",
        implemented: true,
        notice: "信息化环境和对象由安全技术服务 + 作用域在 environment_scope_tree 中可靠派生；无法命中时显示“待补充”。",
      },
      processes: {
        title: "流程清单",
        description: "用于维护和核对安全职能流程，展示流程域、L2 流程组、L3 流程和 L4 关键活动状态。",
        implemented: true,
      },
      "work-functions": {
        title: "职能清单",
        description: "用于维护和核对安全工作职能，统一使用“安全职能”业务口径。",
        implemented: true,
      },
      modules: {
        title: "安全技术模块清单",
        description: "用于维护和核对安全技术模块，区别于安全技术措施，不把系统或产品作为主列。",
        implemented: true,
        notice: "关联安全技术措施数依赖后续数据契约完善",
      },
      references: {
        title: "标准与岗位参考",
        description: "展示 GB/T 42446 任务参考和 Gartner 岗位参考，作为职能、流程、任务的参考知识。",
        implemented: true,
        notice: "关联安全职能和关联流程暂不编造，无法计算时显示“待补充”",
      },
    }[normalizedSection];
    const sectionViewModel =
      normalizedSection === "scopes"
        ? buildScopeMaintenanceViewModel({ management, search })
        : normalizedSection === "processes"
          ? buildProcessMaintenanceViewModel({ management, search })
          : normalizedSection === "work-functions"
            ? buildWorkFunctionMaintenanceViewModel({ management, search })
            : normalizedSection === "modules"
              ? buildTechnologyModuleMaintenanceViewModel({ management, search })
              : normalizedSection === "measures"
                ? buildTechnicalMeasureMaintenanceViewModel({ management, search })
                : normalizedSection === "references"
                  ? buildStandardRoleReferenceViewModel({ management, search })
                  : { rows: [], summary: {}, emptyState: pageMeta.description };
    const selectedRow = sectionViewModel.rows.find((row) => row.id === selectedId) || sectionViewModel.rows[0] || null;
    const sourceEvidence =
      selectedRow && sectionViewModel.sourceEvidenceById
        ? list(sectionViewModel.sourceEvidenceById[selectedRow.id])
        : maintenanceSourceEvidence(management, normalizedSection, selectedRow);
    return {
      section: normalizedSection,
      navigationItems,
      page: pageMeta,
      summary: sectionViewModel.summary,
      rows: sectionViewModel.rows,
      standardRows: sectionViewModel.standardRows || [],
      roleRows: sectionViewModel.roleRows || [],
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
            scopeCount: Number(object.scope_count ?? list(object.scope_mappings).length) || 0,
            serviceCount: Number(object.service_count ?? 0) || 0,
            moduleCount: Number(object.module_count ?? 0) || 0,
          }));
        return {
          id: environment.id,
          type: "information_environment",
          title: titleOf(environment, "未命名环境"),
          description: environment.description || "",
          objectCount: objects.length,
          objects,
        };
      })
      .filter((environment) => environment.objects.length || includesSearch(query, environment.title, environment.description));
  }

  function findEnvironmentSelection(management, selectedObjectId, selectedEnvironmentId, search) {
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
    const environmentSelection = environments.find((row) => row.environment.id === selectedEnvironmentId);
    if (environmentSelection) return { selectionType: "environment", environment: environmentSelection.environment, object: null, objects: environmentSelection.objects };
    const fallback = environments[0];
    if (!fallback) return null;
    const object = fallback.objects[0] || null;
    return object
      ? { selectionType: "object", environment: fallback.environment, object, objects: fallback.objects }
      : { selectionType: "environment", environment: fallback.environment, object: null, objects: fallback.objects };
  }

  function buildEnvironmentScopeServiceRows(selectedObject, showObjectColumn) {
    if (!selectedObject) return [];
    return list(selectedObject.scope_mappings).map((mapping) => {
      const services = uniqueBy(list(mapping.services), (service) => service.id || service.code || service.title);
      const modules = uniqueBy(services.flatMap((service) => list(service.modules)), (module) => module.id || module.code || module.title);
      const hasServices = services.length > 0;
      const hasModules = modules.length > 0;
      return {
        id: [showObjectColumn ? selectedObject.id : "", mapping.scope?.id || mapping.scope?.code || mapping.scope?.title || "scope"].filter(Boolean).join("::"),
        object: showObjectColumn ? compactEntity(selectedObject, "未命名对象") : null,
        scope: compactEntity(mapping.scope, "未命名作用域"),
        services: services.map(compactEntity),
        modules: modules.map(compactEntity),
        coverageStatus: hasServices && hasModules ? "已覆盖" : hasServices ? "模块待补充" : "不适用",
        note: hasServices ? (hasModules ? "已建立服务与模块/措施映射。" : "已有安全技术服务，安全技术模块/措施待补充。") : "该对象在此作用域下无适用安全技术服务。",
      };
    });
  }

  function buildEnvironmentLocalRelationNotes({ selectionType, selectedEnvironment, selectedObject, summary, detailPanel }) {
    const scopeSubject = selectionType === "environment" ? "当前环境下的信息化对象" : "当前信息化对象";
    const segmentText = list(detailPanel.segments).length ? list(detailPanel.segments).map(titleOf).join("、") : "暂无环境分段";
    return [
      {
        title: "关系主链路",
        body: `${scopeSubject} 按“安全作用域 → 安全技术服务 → 安全技术模块/措施”展示，后续系统或产品归属不作为本页主链路。`,
      },
      {
        title: "覆盖口径",
        body: `共 ${summary.scopeCount} 个作用域、${summary.serviceCount} 个安全技术服务、${summary.moduleCount} 个技术模块/措施；${summary.notApplicableCount} 个作用域无适用服务，${summary.missingModuleCount} 个作用域模块/措施待补充。`,
      },
      {
        title: "环境分段",
        body: selectedObject ? `${titleOf(selectedObject)} 的环境分段：${segmentText}。该字段只作为辅助信息，不作为默认主层级。` : `${titleOf(selectedEnvironment)} 下当前未选中单一对象，表格展示该环境内对象的合并映射。`,
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

  function buildEnvironmentWorkspaceViewModel({ management, selectedObjectId, selectedEnvironmentId, search }) {
    const navigationTree = buildEnvironmentNavigationTree(management, search);
    const selected = findEnvironmentSelection(management, selectedObjectId, selectedEnvironmentId, search);
    const selectedEnvironment = compactEntity(selected?.environment, "未命名环境");
    const selectedObject = selected?.object ? compactEntity(selected.object, "未命名对象") : null;
    const isEnvironmentSelection = selected?.selectionType === "environment";
    const scopeServiceRows = isEnvironmentSelection
      ? list(selected?.objects).flatMap((object) => buildEnvironmentScopeServiceRows(object, true))
      : buildEnvironmentScopeServiceRows(selected?.object, false);
    const summary = {
      objectCount: navigationTree.reduce((sum, environment) => sum + list(environment.objects).length, 0),
      selectedObjectCount: isEnvironmentSelection ? list(selected?.objects).length : selectedObject ? 1 : 0,
      scopeCount: uniqueBy(scopeServiceRows.map((row) => row.scope), (scope) => scope?.id || scope?.code || scope?.title).length,
      serviceCount: uniqueBy(scopeServiceRows.flatMap((row) => row.services), (service) => service.id || service.code || service.title).length,
      moduleCount: uniqueBy(scopeServiceRows.flatMap((row) => row.modules), (module) => module.id || module.code || module.title).length,
      notApplicableCount: scopeServiceRows.filter((row) => !row.services.length).length,
      missingModuleCount: scopeServiceRows.filter((row) => row.services.length && !row.modules.length).length,
      status: scopeServiceRows.some((row) => row.coverageStatus === "模块待补充") ? "待完善" : "正常",
    };
    const detailPanel = {
      environment: selectedEnvironment,
      object: selectedObject,
      selectionType: selected?.selectionType || "",
      showObjectColumn: isEnvironmentSelection,
      segments: isEnvironmentSelection
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
      selectedObject,
      selectedMode: selected?.selectionType || "",
      relationshipSummary: summary,
      scopeServiceRows,
      detailPanel,
      localRelationNotes: buildEnvironmentLocalRelationNotes({ selectionType: selected?.selectionType, selectedEnvironment, selectedObject, summary, detailPanel }),
      sourceEvidence: environmentSourceEvidence(selected?.environment, selected?.object, selected?.objects),
    };
  }

  window.sapdViewModels = {
    buildCapabilityWorkspaceViewModel,
    buildMaintenanceWorkspaceViewModel,
    buildProcessMaintenanceViewModel,
    buildScopeMaintenanceViewModel,
    buildTechnicalMeasureMaintenanceViewModel,
    buildTechnologyModuleMaintenanceViewModel,
    buildStandardRoleReferenceViewModel,
    buildWorkFunctionMaintenanceViewModel,
    buildEnvironmentWorkspaceViewModel,
  };
})();
