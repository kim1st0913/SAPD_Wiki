(function () {
  const list = (value) => (Array.isArray(value) ? value : []);
  const text = (value) => (value == null ? "" : String(value));
  const display = window.sapdDisplay || {};
  const displayLabel = (key, fallback) => display.label?.(key, fallback) || fallback;
  const relationLabel = (key, fallback) => display.relationLabel?.(key) || fallback;
  const displayState = (key, fallback) => display.state?.(key, fallback) || fallback;
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
  const SEARCH_QUERY_ALIASES = {};
  const searchQueryVariants = (query) => {
    const normalized = normalizeSearch(query);
    if (!normalized) return [];
    return [normalized, ...list(SEARCH_QUERY_ALIASES[normalized]).map(normalizeSearch)].filter(Boolean);
  };
  const includesSearch = (query, ...values) => {
    const variants = searchQueryVariants(query);
    if (!variants.length) return true;
    const haystack = values.map(text).join(" ").toLowerCase();
    return variants.some((variant) => haystack.includes(variant));
  };
  const objectId = (item) => text(item?.id).trim();
  function resolveCurrentObjectSelection({ rows, selectedId, grain, label, source }) {
    const allRows = list(rows);
    const requestedId = text(selectedId).trim();
    const selectionSource = source || (requestedId ? "explicit" : "initial_landing");
    if (requestedId) {
      const row = allRows.find((item) => objectId(item) === requestedId) || null;
      if (row) {
        return {
          id: objectId(row),
          row,
          status: selectionSource === "page_search" ? "search_preview" : "selected",
          source: selectionSource,
          grain,
          requestedId,
          message: "",
        };
      }
      return {
        id: null,
        row: null,
        status: "target_missing",
        source: selectionSource,
        grain,
        requestedId,
        message: `未定位到${label || "当前对象"}：${requestedId}`,
      };
    }
    const defaultRow = allRows[0] || null;
    if (defaultRow) {
      return {
        id: objectId(defaultRow),
        row: defaultRow,
        status: "default_landing",
        source: "initial_landing",
        grain,
        requestedId: "",
        message: "",
      };
    }
    return {
      id: null,
      row: null,
      status: "empty",
      source: "none",
      grain,
      requestedId: "",
      message: `暂无${label || "当前对象"}数据`,
    };
  }
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

  function serviceFocusCode(serviceCode) {
    const parts = text(serviceCode).split("&");
    return text(parts.length > 1 ? parts[parts.length - 1] : serviceCode).trim();
  }

  function serviceScopeCode(serviceCode) {
    const parts = text(serviceCode).split("&");
    return text(parts.length > 1 ? parts[0] : "").trim();
  }

  function capabilityCodeFromFocusCode(focusCode) {
    return text(focusCode).replace(/-\d+$/, "");
  }

  function buildCapabilityFocusOrder(capabilityTree) {
    const focusOrder = new Map();
    const capabilityOrder = new Map();
    let order = 0;
    for (const category of list(capabilityTree?.categories)) {
      for (const domain of list(category.domains)) {
        for (const capability of list(domain.capabilities)) {
          const capabilityCode = text(capability?.code).trim();
          if (capabilityCode && !capabilityOrder.has(capabilityCode)) {
            capabilityOrder.set(capabilityCode, { order, title: titleOf(capability, capabilityCode) });
          }
          for (const focus of list(capability.focuses)) {
            const focusCode = text(focus?.code).trim();
            if (focusCode && !focusOrder.has(focusCode)) {
              focusOrder.set(focusCode, {
                order,
                capabilityCode,
                capabilityTitle: titleOf(capability, capabilityCode),
                focusTitle: titleOf(focus, focusCode),
              });
              order += 1;
            }
          }
        }
      }
    }
    return { focusOrder, capabilityOrder };
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

  function isSecurityTechnicalMeasure(item) {
    return (
      item?.type === "security_technical_measure" ||
      item?.objectKind === "安全技术措施" ||
      item?.kind === "安全技术措施" ||
      item?.category === "安全技术措施" ||
      item?.measureName ||
      text(item?.id).startsWith("security_technical_measure:")
    );
  }

  function compactTechnicalObject(item, fallbackKind = "安全技术模块") {
    const compact = compactEntity(item, "待补充");
    const status = text(item?.status || compact?.status).trim().toLowerCase();
    const isMeasure = isSecurityTechnicalMeasure(item);
    const kind = isMeasure ? "安全技术措施" : fallbackKind;
    return {
      ...compact,
      objectKind: kind,
      kind,
      systems: uniqueBy([...list(item?.systems), ...list(item?.securitySystems), ...list(item?.linkedSystems)].map(compactEntity).filter(Boolean), (system) => system?.id || system?.code || system?.title),
      securitySystems: uniqueBy([...list(item?.securitySystems), ...list(item?.systems), ...list(item?.linkedSystems)].map(compactEntity).filter(Boolean), (system) => system?.id || system?.code || system?.title),
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

  function capabilityDisplayCode(item = {}) {
    const explicit = text(item.code).trim();
    if (explicit) return explicit;
    const title = titleOf(item, "").trim();
    const match = title.match(/\s([TGM])$/);
    return match ? match[1] : "";
  }

  function capabilityDisplayTitle(item = {}, fallback = "未命名") {
    const code = capabilityDisplayCode(item);
    const title = titleOf(item, fallback).trim();
    if (!code || title === code) return title || fallback;
    const spacedSuffix = ` ${code}`;
    if (title.endsWith(spacedSuffix)) return title.slice(0, -spacedSuffix.length).trim() || fallback;
    return title || fallback;
  }

  const CAPABILITY_SUMMARY_DEFINITIONS = {
    T: "面向业务系统、信息化环境和数字基础设施的技术性安全能力集合，覆盖安全架构设计、被动防护、主动防御、威胁情报和攻防验证等能力，用于降低攻击面、建立防护控制、提升监测响应和对抗验证能力。",
    G: "面向组织层面的网络安全方向、原则、目标架构、建设路线和投资决策能力，将业务战略、风险偏好、监管要求和企业架构约束转化为可执行的安全战略计划与治理闭环。",
    M: "面向安全能力落地和持续运行的管理能力集合，通过项目建设、资源保障、监督评价、人员能力和流程机制，确保安全战略、技术能力和治理要求能够稳定执行、持续改进。",
    "T-AS": "在考虑安全的前提下，对系统进行规划、建立和维护。它强调安全应被设计进系统本身，而不是在系统建成后再外加补救。基础架构需要与组织使命、业务目标、资金、人力和运行环境相匹配，覆盖系统规划、工程设计、采购实施、网络分段、配置加固、补丁维护、攻击面降低和系统韧性。良好的基础架构为后续被动防御、积极防御、情报和进攻性验证提供基础，使这些能力更有效、成本更低。",
    "T-PD": "添加到架构中的系统，用于在没有持续人工交互的情况下，对威胁提供持续保护或洞察。它建立在良好架构之上，用于在存在对手时保护系统。即使架构良好，具备机会、意图和能力的威胁仍可能绕过架构，因此需要防火墙、反恶意代码、入侵检测 / 防护、访问控制、边界控制、日志监测等被动防御系统。这类能力需要维护、调优和运营照料，但核心价值是持续降低威胁接触概率、限制已知安全缺口，并消耗攻击者时间与资源。",
    "T-AD": "分析人员对己方网络内部的威胁进行监测、响应、学习，并将其知识应用回防御过程。它不是“反黑”或越界攻击，而是在良好的基础架构和被动防御之上，由训练有素的安全人员主动发现、分析、处置和改进防御。积极防御强调人员行动、机动性和适应性，覆盖网络安全监控、事件响应、威胁狩猎、恶意代码分析、遏制处置、复盘学习和检测优化等活动。",
    "T-IN": "收集数据，将其加工为信息，并产出情报。它强调情报不是工具自动生成的结果，而是分析人员围绕知识缺口，从多来源数据中进行处理、关联、分析和判断后形成的产物。情报能力既包括关于对手、攻击活动、TTPs、能力和意图的分析，也包括将这些判断转化为可支撑检测、响应、风险判断和防御决策的情报评估。生成情报属于 Intelligence，消费情报则服务于 Active Defense。",
    "T-OF": "为了自卫，在友方系统之外，针对对手采取的合法反制和反击行动。它位于滑动标尺最右侧，对前面架构、被动防御、积极防御和情报能力依赖最高，成本也最高。文档强调，进攻行动必须合法，普通民间组织通常不应把它理解为自行报复或越界攻击。在 SAPD Wiki 中，该能力更适合作为合法授权边界内的红队演练、渗透测试、攻防验证和对抗模拟能力，用于检验防御体系和暴露真实攻击路径。",
    "G-SP": "指从组织战略、业务目标、风险偏好、监管要求和企业架构出发，制定网络安全目标、原则、能力蓝图、建设路线图和投资优先级。它用于回答“为什么建设、建设到什么状态、按什么顺序建设、如何衡量成效”。",
    "M-PM": "指将安全战略、目标架构和能力蓝图转化为具体建设项目、实施计划、预算、里程碑、交付物和验收机制的管理能力，确保安全能力建设可计划、可执行、可验收、可追踪。",
    "M-SA": "指为安全能力运行提供组织、制度、资源、工具、流程、供应商、资产和证据支撑的保障能力，确保安全工作具备稳定的人力、技术、流程和管理基础。",
    "M-SE": "指对安全制度执行、控制有效性、风险整改、合规状态、项目成效和能力成熟度进行监督、检查、审计、度量和绩效评价的能力，用于形成问题发现、整改跟踪和持续改进闭环。",
    "M-PS": "指围绕人员身份、岗位职责、权限边界、安全意识、技能培养、任职资格、行为规范和离岗交接等方面建立管理机制，降低人员风险并提升组织安全能力水平。",
  };

  function capabilitySummaryDefinition(item = {}) {
    const code = capabilityDisplayCode(item);
    return text(item.description || item.summary || item.definition || CAPABILITY_SUMMARY_DEFINITIONS[code]).trim();
  }

  function compactCapabilitySummaryEntity(item, fallback = "未命名") {
    const compact = compactEntity(item, fallback);
    if (!compact) return null;
    return {
      ...compact,
      code: capabilityDisplayCode(item),
      title: capabilityDisplayTitle(item, fallback),
      description: capabilitySummaryDefinition(item),
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
      code: capabilityDisplayCode(item),
      title: capabilityDisplayTitle(item),
      description: item.description || "",
    };
  }

  function buildNavigationTree(capabilityTree, search) {
    const query = normalizeSearch(search);
    const rows = [];
    const shouldInclude = (item, level, inheritedMatch = false) =>
      !query || inheritedMatch || includesSearch(query, level, item.code, capabilityDisplayCode(item), item.title, capabilityDisplayTitle(item), item.description);

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
      { key: "focus", label: displayLabel("capability_focus", "能力关注点"), value: row.focus?.code || "无编码", preview: row.focus?.title || "未命名", items: row.focus ? [row.focus] : [] },
      { key: "services", label: displayLabel("security_technical_service", "安全技术服务"), value: row.services.length, preview: row.services.slice(0, 2).map(titleOf).join("、") || "暂无", items: row.services },
      { key: "scopes", label: displayLabel("scope_type", "作用域"), value: row.scopes.length, preview: row.scopes.slice(0, 2).map(titleOf).join("、") || "暂无", items: row.scopes },
      { key: "modules", label: displayLabel("security_module_or_measure", "安全技术模块/措施"), value: row.modules.length, preview: row.modules.slice(0, 2).map(titleOf).join("、") || "暂无", items: row.modules },
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
    const technicalObjects = uniqueBy(list(rows).flatMap((row) => list(row.modules)), (module) => module.id || module.code || module.title);
    const technologyModules = uniqueBy(
      [
        ...list(rows).flatMap((row) => list(row.technologyModules)),
        ...technicalObjects.filter((module) => !isSecurityTechnicalMeasure(module)),
      ],
      (module) => module.id || module.code || module.title || module.name,
    );
    const technicalMeasures = uniqueBy(
      [
        ...list(rows).flatMap((row) => list(row.technicalMeasures)),
        ...technicalObjects.filter((module) => isSecurityTechnicalMeasure(module)),
      ],
      (measure) => measure.id || measure.code || measure.title || measure.name,
    );
    return {
      scopeCount: uniqueBy(rows.map((row) => row.scope), (scope) => scope?.id || scope?.title).length,
      serviceCount: uniqueBy(rows.flatMap((row) => row.services), (service) => service.id || service.code || service.title).length,
      moduleCount: technicalObjects.length,
      technologyModuleCount: technologyModules.length,
      measureCount: technicalMeasures.length,
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

  function nestedWorkFunctions(management) {
    return uniqueBy(
      list(management?.work_function_layers).flatMap((layer) => list(layer.groups).flatMap((group) => list(group.functions))),
      (item) => item.id || item.code || item.title || item.name,
    );
  }

  function nestedProcessReferences(management) {
    return uniqueBy(
      list(management?.security_processes).flatMap((domain) => list(domain.groups).flatMap((group) => list(group.references))),
      (item) => item.id || item.code || item.title || item.name,
    );
  }

  function maintenanceStatsCount(management, key) {
    const candidates = [
      management?.stats?.[key],
      management?.maintenance_index?.stats?.[key],
      management?.maintenanceIndex?.stats?.[key],
    ];
    for (const candidate of candidates) {
      const number = Number(candidate);
      if (Number.isFinite(number) && number > 0) return number;
    }
    return 0;
  }

  function coverageTotalCount(total, value) {
    const totalNumber = Number(total);
    const valueNumber = Number(value);
    const normalizedValue = Number.isFinite(valueNumber) && valueNumber > 0 ? valueNumber : 0;
    if (Number.isFinite(totalNumber) && totalNumber > 0) return Math.max(totalNumber, normalizedValue);
    return normalizedValue;
  }

  function dictionaryCoverageDenominators(management, technicalRows = [], managementRows = []) {
    const technicalFallback = summarizeTechnical(technicalRows);
    const managementFallback = summarizeManagement(managementRows);
    return {
      technicalSummary: {
        scopeCount: coverageTotalCount(maintenanceStatsCount(management, "scope_types") || list(management?.scope_types).length, technicalFallback.scopeCount),
        serviceCount: coverageTotalCount(maintenanceStatsCount(management, "security_technical_services") || list(management?.security_technical_services).length, technicalFallback.serviceCount),
        technologyModuleCount: coverageTotalCount(maintenanceStatsCount(management, "security_technology_modules") || list(management?.security_technology_modules).length, technicalFallback.technologyModuleCount),
        measureCount: coverageTotalCount(maintenanceStatsCount(management, "security_technical_measures") || list(management?.security_technical_measures).length, technicalFallback.measureCount),
      },
      managementSummary: {
        securityFunctionCount: coverageTotalCount(maintenanceStatsCount(management, "work_functions") || nestedWorkFunctions(management).length, managementFallback.securityFunctionCount),
        processReferenceCount: coverageTotalCount(maintenanceStatsCount(management, "process_references") || nestedProcessReferences(management).length, managementFallback.processReferenceCount),
      },
    };
  }

  const CAPABILITY_DETAIL_ROW_THRESHOLD = 30;

  function capabilityLevelLabel(type) {
    if (type === "capability_category") return "L0 总览";
    if (type === "capability_domain") return "L1 总览";
    if (type === "capability") return "L2 能力";
    if (type === "capability_focus") return "关注点";
    return "能力对象";
  }

  function childCapabilityItems(item = {}) {
    if (!item) return [];
    if (item.type === "capability_category" || list(item.domains).length) return list(item.domains);
    if (item.type === "capability_domain" || list(item.capabilities).length) return list(item.capabilities);
    if (item.type === "capability" || list(item.focuses).length) return list(item.focuses);
    return [];
  }

  function descendantFocusItems(item = {}) {
    if (!item) return [];
    if (item.type === "capability_focus") return [item];
    if (list(item.focuses).length) return list(item.focuses);
    if (list(item.capabilities).length) return list(item.capabilities).flatMap(descendantFocusItems);
    if (list(item.domains).length) return list(item.domains).flatMap(descendantFocusItems);
    return [];
  }

  function capabilityStructureCounts(item = {}) {
    if (!item) return { l1Count: 0, l2Count: 0, focusCount: 0 };
    const domains = list(item.domains);
    const capabilities = item.type === "capability_domain" ? list(item.capabilities) : domains.flatMap((domain) => list(domain.capabilities));
    const directFocuses = item.type === "capability" ? list(item.focuses) : [];
    const focuses = descendantFocusItems(item);
    return {
      l1Count: domains.length,
      l2Count: capabilities.length || (item.type === "capability" ? 1 : 0),
      focusCount: focuses.length || directFocuses.length,
    };
  }

  function rowFocusId(row = {}) {
    return text(row.focus?.id || row.focusId || row.focus_id || row.focus?.code).trim();
  }

  function rowsForFocusIds(rows = [], focusIds = new Set()) {
    if (!focusIds.size) return [];
    return list(rows).filter((row) => focusIds.has(rowFocusId(row)));
  }

  function summarizeStandards(rows) {
    const displayableRows = list(rows).filter((row) => list(row.controls).length);
    return {
      frameworkCount: uniqueBy(list(rows).flatMap((row) => list(row.standards || row.frameworks)), (standard) => standard.id || standard.code || standard.title || standard.name).length,
      controlCount: uniqueBy(displayableRows.flatMap((row) => list(row.controls)), (control) => control.id || control.code || control.originalControlId || control.title).length,
      rowCount: displayableRows.length,
    };
  }

  function ratioOf(value, total) {
    const numerator = Number(value);
    const denominator = Number(total);
    if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator <= 0) return 0;
    return Math.max(0, Math.min(1, numerator / denominator));
  }

  function capabilityMappingStats({ focusCount = 0, technicalRows = [], managementRows = [], standardRows = [], coverageDenominators = null } = {}) {
    const technicalSummary = summarizeTechnical(technicalRows);
    const managementSummary = summarizeManagement(managementRows);
    const standardSummary = summarizeStandards(standardRows);
    const technicalTotal = coverageDenominators?.technicalSummary || technicalSummary;
    const managementTotal = coverageDenominators?.managementSummary || managementSummary;
    const technicalCoverageTotal = {
      scopeCount: coverageTotalCount(technicalTotal.scopeCount, technicalSummary.scopeCount),
      serviceCount: coverageTotalCount(technicalTotal.serviceCount, technicalSummary.serviceCount),
      technologyModuleCount: coverageTotalCount(technicalTotal.technologyModuleCount, technicalSummary.technologyModuleCount),
      measureCount: coverageTotalCount(technicalTotal.measureCount, technicalSummary.measureCount),
    };
    const managementCoverageTotal = {
      securityFunctionCount: coverageTotalCount(managementTotal.securityFunctionCount, managementSummary.securityFunctionCount),
      processReferenceCount: coverageTotalCount(managementTotal.processReferenceCount, managementSummary.processReferenceCount),
    };
    return {
      focusCount,
      technicalRowCount: list(technicalRows).length,
      managementRowCount: list(managementRows).length,
      standardRowCount: standardSummary.rowCount,
      mappingCount: list(technicalRows).length + list(managementRows).length + standardSummary.rowCount,
      technicalSummary,
      managementSummary,
      standardSummary,
      coverage: [
        {
          key: "technical",
          label: "技术映射",
          items: [
            { label: "安全技术服务", value: technicalSummary.serviceCount, total: technicalCoverageTotal.serviceCount, ratio: ratioOf(technicalSummary.serviceCount, technicalCoverageTotal.serviceCount) },
            { label: "安全技术模块", value: technicalSummary.technologyModuleCount, total: technicalCoverageTotal.technologyModuleCount, ratio: ratioOf(technicalSummary.technologyModuleCount, technicalCoverageTotal.technologyModuleCount) },
            { label: "安全技术措施", value: technicalSummary.measureCount, total: technicalCoverageTotal.measureCount, ratio: ratioOf(technicalSummary.measureCount, technicalCoverageTotal.measureCount) },
          ],
        },
        {
          key: "management",
          label: "管理映射",
          items: [
            { label: "职能", value: managementSummary.securityFunctionCount, total: managementCoverageTotal.securityFunctionCount, ratio: ratioOf(managementSummary.securityFunctionCount, managementCoverageTotal.securityFunctionCount) },
            { label: "流程", value: managementSummary.processReferenceCount, total: managementCoverageTotal.processReferenceCount, ratio: ratioOf(managementSummary.processReferenceCount, managementCoverageTotal.processReferenceCount) },
          ],
        },
      ],
    };
  }

  function capabilityChildOverview(item, mappingRows) {
    const focuses = descendantFocusItems(item);
    const focusIds = new Set(focuses.map((focus) => focus.id).filter(Boolean));
    const childItems = childCapabilityItems(item);
    const technicalRows = rowsForFocusIds(mappingRows.technicalMappingRows, focusIds);
    const managementRows = rowsForFocusIds(mappingRows.managementMappingRows, focusIds);
    const standardRows = rowsForFocusIds(mappingRows.standardMappingRows, focusIds);
    const structure = capabilityStructureCounts(item);
    const stats = capabilityMappingStats({ focusCount: focuses.length, technicalRows, managementRows, standardRows, coverageDenominators: mappingRows.coverageDenominators });
    return {
      ...compactCapabilitySummaryEntity(item),
      levelLabel: capabilityLevelLabel(item?.type),
      structure,
      stats,
      previewChildren: childItems.map(compactCapabilitySummaryEntity).filter(Boolean),
    };
  }

  function buildCapabilityOverview({ selectedRaw, selectedDetail, visibleFocuses, technicalMappingRows, managementMappingRows, standardMappingRows, coverageDenominators }) {
    const selectedType = selectedRaw?.type || selectedDetail?.type || "";
    const childItems = childCapabilityItems(selectedRaw);
    const structure = capabilityStructureCounts(selectedRaw);
    const stats = capabilityMappingStats({
      focusCount: visibleFocuses.length,
      technicalRows: technicalMappingRows,
      managementRows: managementMappingRows,
      standardRows: standardMappingRows,
      coverageDenominators,
    });
    const isL0OrL1 = selectedType === "capability_category" || selectedType === "capability_domain";
    const isL2 = selectedType === "capability";
    const detailRowCount = stats.technicalRowCount + stats.managementRowCount + stats.standardRowCount;
    const detailPolicy = isL0OrL1 || isL2 ? "overview" : "full_detail";
    return {
      selected: compactCapabilitySummaryEntity(selectedRaw || selectedDetail),
      selectedType,
      levelLabel: capabilityLevelLabel(selectedType),
      detailPolicy,
      detailThreshold: CAPABILITY_DETAIL_ROW_THRESHOLD,
      detailRowCount,
      structure,
      stats,
      coverage: stats.coverage,
      children: childItems
        .map((item) =>
          capabilityChildOverview(item, {
            technicalMappingRows,
            managementMappingRows,
            standardMappingRows,
            coverageDenominators,
          }),
        )
        .filter(Boolean),
      summaryHint: isL0OrL1
        ? "当前层级默认呈现结构、覆盖和下钻入口，完整映射明细请进入 L2 或关注点核对。"
        : isL2
          ? "当前 L2 默认呈现关注点摘要和入口，完整映射明细请进入关注点核对。"
        : detailPolicy === "mixed_summary"
          ? "当前 L2 映射量较大，默认收拢为摘要；进入关注点可查看完整核对明细。"
          : "当前层级可展示完整映射明细。",
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

  function hasLocalStandards(map) {
    return Boolean(list(map?.standards?.frameworks).length || list(map?.standards?.controls).length);
  }

  function mergeProjectedStandards(localMap, projectedMap) {
    if (hasLocalStandards(localMap) || !hasLocalStandards(projectedMap)) return localMap;
    return {
      ...localMap,
      standards: projectedMap.standards,
    };
  }

  function mergeFallbackStandardsIntoProjected(projectedMap, fallbackMap) {
    if (!projectedMap || hasLocalStandards(projectedMap) || !hasLocalStandards(fallbackMap)) return projectedMap;
    return {
      ...projectedMap,
      standards: fallbackMap.standards,
    };
  }

  function isReadyCapabilityProjection(capabilityProjection) {
    if (!capabilityProjection) return false;
    const dataState = text(capabilityProjection.data_state || capabilityProjection.dataState || "").trim();
    if (dataState && dataState !== "ready") return false;
    return Boolean(capabilityProjection.localRelationMap || capabilityProjection.localRelationMapsByFocusId || list(capabilityProjection.localRelationMaps).length);
  }

  function capabilityProjectionMatchesSelected(capabilityProjection, selectedDetail) {
    if (!capabilityProjection || !selectedDetail?.id) return false;
    const dataState = text(capabilityProjection.data_state || capabilityProjection.dataState || "").trim();
    if (dataState && dataState !== "ready" && dataState !== "empty") return false;
    const selected = capabilityProjection.selected || {};
    const selectedKeys = [selected.id, selected.code].map(text).filter(Boolean);
    const expectedKeys = [selectedDetail.id, selectedDetail.code].map(text).filter(Boolean);
    return text(selected.type) === text(selectedDetail.type) && selectedKeys.some((key) => expectedKeys.includes(key));
  }

  function projectedLocalRelationMapFor(capabilityProjection, selectedFocusId) {
    if (!isReadyCapabilityProjection(capabilityProjection)) return null;
    const byFocusId = capabilityProjection.localRelationMapsByFocusId || capabilityProjection.local_relation_maps_by_focus_id || {};
    if (selectedFocusId && byFocusId[selectedFocusId]) return byFocusId[selectedFocusId];
    const maps = list(capabilityProjection.localRelationMaps || capabilityProjection.local_relation_maps);
    if (selectedFocusId) {
      const selectedMap = maps.find((item) => item?.focus?.id === selectedFocusId);
      if (selectedMap) return selectedMap;
      return null;
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
      lifecycleType: item.lifecycleType || item.lifecycle_type || "",
      objectKind: item.objectKind || item.object_kind || "",
      originalBusinessFields: item.originalBusinessFields || item.original_business_fields || {},
      dataPolicyRows: item.dataPolicyRows || item.data_policy_rows || [],
      ...extra,
    };
  }

  function workbenchRelations(workbench, relationType) {
    return list(workbench?.relations).filter((relation) => !relationType || relation.type === relationType);
  }

  function isInitialProjectionWorkbench(workbench) {
    return text(workbench?.compatibility?.mode).trim() === "initial_projection";
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
    if (isInitialProjectionWorkbench(workbench)) return [];
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
    if (isInitialProjectionWorkbench(workbench)) return [];
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

  function standardCatalogByCode(standards = {}) {
    const byCode = {};
    for (const framework of list(standards?.frameworks)) {
      const code = text(framework.frameworkCode || framework.code).trim();
      if (!code) continue;
      byCode[code] = {
        id: framework.id || code,
        type: "standard_framework",
        code,
        frameworkCode: code,
        title: framework.title || framework.name || code,
        name: framework.title || framework.name || code,
      };
    }
    return byCode;
  }

  function canonicalStandardEntity(standard = {}, catalogByCode = {}) {
    const code = text(standard.frameworkCode || standard.code || standard.id).trim();
    const canonical = code ? catalogByCode[code] : null;
    if (!canonical) return standard;
    return {
      ...standard,
      id: canonical.id,
      code: canonical.code,
      frameworkCode: canonical.frameworkCode,
      title: canonical.title,
      name: canonical.name,
    };
  }

  function canonicalStandardEntityKey(standard = {}) {
    const entity = typeof standard === "object" && standard ? standard : { title: standard };
    const code = text(entity.frameworkCode || entity.code).trim();
    if (code) return `code:${canonicalStandardKey(code)}`;
    const title = text(entity.frameworkTitle || entity.title || entity.name).trim();
    if (title) return `title:${canonicalStandardKey(title)}`;
    const id = text(entity.id).trim();
    return id ? `id:${canonicalStandardKey(id)}` : "";
  }

  function isPlaceholderControlCode(value) {
    const normalized = text(value).trim().toLowerCase();
    return !normalized || ["/", "n/a", "na", "none", "null", "待补充", "暂无", "未编号", "待确认"].includes(normalized);
  }

  function isDisplayableStandardControl(control = {}) {
    const code = text(control.originalControlId || control.controlId || control.code).trim();
    const title = text(control.title || control.name || control.controlName || control.control_name).trim();
    return !isPlaceholderControlCode(code) && !isPlaceholderControlCode(title);
  }

  function buildCapabilityStandardRowsFromWorkbench(workbench, focuses, catalogByCode = {}) {
    if (!workbench || workbench.__data_state === "missing_file") return [];
    if (isInitialProjectionWorkbench(workbench)) return [];
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
          .filter(isDisplayableStandardControl)
          .map((control) =>
            canonicalStandardEntity(
              frameworksByCode[control.frameworkCode] || (control.frameworkCode ? { id: control.frameworkCode, code: control.frameworkCode, frameworkCode: control.frameworkCode, title: control.frameworkTitle || control.frameworkCode } : null),
              catalogByCode,
            ),
          )
          .filter(Boolean),
        canonicalStandardEntityKey,
      );
      return {
        id: `${focusId}:standard`,
        focus: focusEntity,
        standards: frameworks,
        controls: controls.filter(isDisplayableStandardControl),
        dataSource: "capability-workbench.json",
      };
    });
  }

  function standardFrameworkTables(framework) {
    if (list(framework?.tabs).length) return list(framework.tabs);
    return framework ? [framework] : [];
  }

  function standardRowRelatedFocusCodes(row = {}) {
    return text(
      row["关联安全能力/关注点"] ||
        row.related_capability_focus ||
        row.relatedCapabilityFocus ||
        row.relatedFocus ||
        row.related_focus ||
        "",
    )
      .split(/[\s,，;；、]+/)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  function standardControlFromRow(row = {}, framework = {}) {
    const controlId = text(row["控制编号"] || row.originalControlId || row.original_control_id || row.controlId || row.code || "").trim();
    const controlName = text(row["控制名称"] || row.controlName || row.control_name || row.title || row.name || "").trim();
    const title = [controlId, controlName].filter(Boolean).join(" ") || controlName || controlId || PENDING_TEXT;
    return {
      id: `${framework.id || framework.frameworkCode || framework.title}:${controlId || title}`,
      type: "standard_control",
      code: controlId,
      title,
      name: controlName,
      frameworkCode: framework.frameworkCode || framework.code || framework.id || "",
      frameworkTitle: framework.title || framework.name || "",
      originalControlId: controlId,
    };
  }

  function canonicalStandardKey(value) {
    const raw = text(value).trim().toLowerCase();
    if (!raw) return "";
    return raw.replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "");
  }

  function standardEntityKeys(standard = {}) {
    const entity = typeof standard === "object" && standard ? standard : { title: standard };
    return [entity.id, entity.code, entity.frameworkCode, entity.frameworkTitle, entity.title, entity.name]
      .flatMap((value) => {
        const raw = text(value).trim();
        const canonical = canonicalStandardKey(raw);
        return [raw.toLowerCase(), canonical].filter(Boolean);
      })
      .filter(Boolean);
  }

  function standardRowFrameworkKeys(row = {}) {
    const keys = list(row.standards || row.frameworks || row.standardFrameworks).flatMap(standardEntityKeys);
    keys.push(...standardEntityKeys(row.standard || row.framework || {}));
    for (const control of list(row.controls)) {
      keys.push(canonicalStandardKey(control.frameworkCode), canonicalStandardKey(control.frameworkTitle));
    }
    return new Set(keys.filter(Boolean));
  }

  function standardRowsShareFramework(left = {}, right = {}) {
    const leftKeys = standardRowFrameworkKeys(left);
    if (!leftKeys.size) return false;
    for (const key of standardRowFrameworkKeys(right)) {
      if (leftKeys.has(key)) return true;
    }
    return false;
  }

  function standardRowFocusId(row = {}) {
    return text(row.focus?.id || row.focusId || row.focus_id || "").trim();
  }

  function mergeSupplementalStandardRows(primaryRows, supplementalRows) {
    const rows = list(primaryRows).map((row) => ({
      ...row,
      standards: list(row.standards),
      controls: list(row.controls),
    }));
    for (const supplement of list(supplementalRows)) {
      const focusId = standardRowFocusId(supplement);
      const match = rows.find((row) => standardRowFocusId(row) === focusId && standardRowsShareFramework(row, supplement));
      if (!match) {
        rows.push(supplement);
        continue;
      }
      match.standards = uniqueBy([...list(match.standards), ...list(supplement.standards)], canonicalStandardEntityKey);
      match.controls = uniqueBy([...list(match.controls), ...list(supplement.controls)].filter(isDisplayableStandardControl), (control) => `${canonicalStandardKey(control.frameworkCode || control.frameworkTitle)}:${text(control.originalControlId || control.code || control.title).trim()}`);
      match.dataSource = [match.dataSource, supplement.dataSource].filter(Boolean).join("+");
    }
    return rows;
  }

  function buildCapabilityStandardRowsFromStandards(standards, focuses, catalogByCode = {}) {
    const loadedFrameworks = Object.values(standards?.loadedFrameworks || standards?.loaded_frameworks || {});
    if (!loadedFrameworks.length) return [];
    return list(focuses).flatMap((focus) => {
      const focusEntity = workbenchEntity(focus, "未命名关注点");
      const focusCode = text(focus?.code).trim();
      if (!focusCode) return [];
      return loadedFrameworks
        .map((framework) => {
          const controls = uniqueBy(
            standardFrameworkTables(framework)
              .flatMap((table) => list(table.rows))
              .filter((row) => standardRowRelatedFocusCodes(row).includes(focusCode))
              .map((row) => standardControlFromRow(row, framework)),
            (control) => `${control.frameworkCode}:${control.originalControlId || control.title}`,
          ).filter(isDisplayableStandardControl);
          if (!controls.length) return null;
          const frameworkCode = framework.frameworkCode || framework.code || framework.id || "";
          const standard = canonicalStandardEntity(
            {
              id: framework.id || frameworkCode,
              type: "standard_framework",
              code: frameworkCode,
              frameworkCode,
              title: framework.title || framework.name || frameworkCode || "标准 / 框架",
            },
            catalogByCode,
          );
          return {
            id: `${focus.id}:${standard.id || standard.code}:standard-package`,
            focus: focusEntity,
            standards: [standard],
            controls,
            dataSource: "standards-index",
          };
        })
        .filter(Boolean);
    });
  }

  function buildCapabilityWorkspaceViewModel({ capabilityWorkbench, capabilityWorkbenchViewModel, capabilityTree, capabilityProjection, management, standards, selectedCapabilityId, search, relationshipFilters }) {
    const dataSource = workbenchDataSource({
      workbench: capabilityWorkbench,
      workbenchViewModel: capabilityWorkbenchViewModel,
      workbenchName: "capability-workbench.json",
      fallbackName: "capability-tree.json + maintenance-knowledge.json + shared-lookups.json",
    });
    const navigationTree = buildNavigationTree(capabilityTree, search);
    const fallbackSelection = defaultCapabilitySelection(capabilityTree);
    const requestedCapabilityId = text(selectedCapabilityId).trim();
    const selectedResult = requestedCapabilityId ? findCapabilityItemAndFocuses(capabilityTree, requestedCapabilityId) : { selected: null, focuses: [] };
    const selection = requestedCapabilityId
      ? resolveCurrentObjectSelection({
          rows: flattenCapabilities(capabilityTree).map((row) => row.item),
          selectedId: requestedCapabilityId,
          grain: "capability_object",
          label: "安全能力对象",
        })
      : resolveCurrentObjectSelection({
          rows: fallbackSelection ? [fallbackSelection] : [],
          selectedId: "",
          grain: "capability_object",
          label: "安全能力对象",
        });
    const selectedRaw = requestedCapabilityId ? selectedResult.selected : fallbackSelection;
    const selectedCapability = compactEntity(selectedRaw);
    const selectedDetail = selectedCapability;
    const selectedId = selectedCapability?.id || null;
    const query = normalizeSearch(search);
    const selectedFocuses = selectedId ? findCapabilityItemAndFocuses(capabilityTree, selectedId).focuses : [];
    const rows = filterRelationshipRows(
      relationshipMatrixRows({ capabilityTree, management, selectedCapabilityId: selectedId }).filter((row) =>
        includesSearch(query, row.focus.code, row.focus.title, ...row.services.map(titleOf), ...row.scopes.map(titleOf), ...row.processGroups.map(titleOf), ...row.processReferences.map(titleOf), ...row.modules.map(titleOf)),
      ),
      relationshipFilters,
    );
    const visibleFocusIds = new Set(rows.map((row) => row.focus.id));
    const visibleFocuses = selectedFocuses.filter((focus) => !query || visibleFocusIds.has(focus.id) || includesSearch(query, focus.code, focus.title, focus.description));
    const visibleFocusIdSet = new Set(visibleFocuses.map((focus) => focus.id));
    const securityWorkCodeLookup = buildSecurityWorkCodeLookup(capabilityTree, management);
    const workbenchTechnicalRows = buildCapabilityTechnicalRowsFromWorkbench(capabilityWorkbench, visibleFocuses);
    const workbenchManagementRows = buildCapabilityManagementRowsFromWorkbench(capabilityWorkbench, visibleFocuses);
    const standardsCatalogByCode = standardCatalogByCode(standards);
    const workbenchStandardRows = buildCapabilityStandardRowsFromWorkbench(capabilityWorkbench, visibleFocuses, standardsCatalogByCode);
    const standardsPackageRows = buildCapabilityStandardRowsFromStandards(standards, visibleFocuses, standardsCatalogByCode);
    const allFocuses = focusRows(capabilityTree).map((row) => row.item);
    const allWorkbenchTechnicalRows = buildCapabilityTechnicalRowsFromWorkbench(capabilityWorkbench, allFocuses);
    const allWorkbenchManagementRows = buildCapabilityManagementRowsFromWorkbench(capabilityWorkbench, allFocuses);
    const allTechnicalRows = allWorkbenchTechnicalRows.length ? allWorkbenchTechnicalRows : buildTechnicalMappingRows({ management, focuses: allFocuses });
    const allManagementRows = allWorkbenchManagementRows.length ? allWorkbenchManagementRows : buildManagementMappingRows({ focuses: allFocuses });
    const coverageDenominators = dictionaryCoverageDenominators(management, allTechnicalRows, allManagementRows);
    const isFocus = selectedDetail?.type === "capability_focus";
    const canUseObjectProjection = capabilityProjectionMatchesSelected(capabilityProjection, selectedDetail);
    const projectedTechnicalRows = canUseObjectProjection ? list(capabilityProjection?.technicalMappingRows || capabilityProjection?.technical_mapping_rows) : [];
    const projectedManagementRows = canUseObjectProjection ? list(capabilityProjection?.managementMappingRows || capabilityProjection?.management_mapping_rows) : [];
    const projectedStandardRows = canUseObjectProjection ? list(capabilityProjection?.standardMappingRows || capabilityProjection?.standard_mapping_rows) : [];
    const selectedProjectedStandardRows = projectedStandardRows.filter((row) => visibleFocusIdSet.has(row.focus?.id));
    const technicalMappingRows = workbenchTechnicalRows.length
      ? workbenchTechnicalRows
      : projectedTechnicalRows.length
      ? projectedTechnicalRows.filter((row) => visibleFocusIdSet.has(row.focus?.id))
      : buildTechnicalMappingRows({ management, focuses: visibleFocuses });
    const rawManagementMappingRows = workbenchManagementRows.length
      ? workbenchManagementRows
      : projectedManagementRows.length
      ? projectedManagementRows.filter((row) => visibleFocusIdSet.has(row.focus?.id))
      : buildManagementMappingRows({ focuses: visibleFocuses });
    const managementMappingRows = applySecurityWorkCodesToRows(rawManagementMappingRows, securityWorkCodeLookup);
    const workbenchAndLoadedStandardRows = workbenchStandardRows.length ? mergeSupplementalStandardRows(workbenchStandardRows, standardsPackageRows) : [];
    const projectedAndLoadedStandardRows = mergeSupplementalStandardRows(selectedProjectedStandardRows, standardsPackageRows);
    const standardMappingRows = workbenchAndLoadedStandardRows.length
      ? workbenchAndLoadedStandardRows
      : projectedAndLoadedStandardRows.length
      ? projectedAndLoadedStandardRows
      : [];
    const focusOverview = buildFocusOverview({ capabilityTree, focuses: visibleFocuses, selectedDetail, technicalRows: technicalMappingRows, managementRows: managementMappingRows });
    const capabilityOverview = buildCapabilityOverview({
      selectedRaw,
      selectedDetail,
      visibleFocuses,
      technicalMappingRows,
      managementMappingRows,
      standardMappingRows,
      coverageDenominators,
    });
    const selectedFocusRow = selectedId ? rows.find((row) => row.focus.id === selectedId) || null : null;
    const chainFocus = selectedFocusRow || null;
    const detailRaw = selectedDetail?.id ? findCapabilityItemAndFocuses(capabilityTree, selectedDetail.id).selected : selectedRaw;
    const detailRawProcesses = list(detailRaw?.process_mappings);
    const detailTechnicalRows = isFocus ? technicalMappingRows.filter((row) => row.focus.id === selectedDetail.id) : technicalMappingRows;
    const detailManagementRows = isFocus ? managementMappingRows.filter((row) => row.focus.id === selectedDetail.id) : managementMappingRows;
    const detailStandardRows = isFocus ? standardMappingRows.filter((row) => row.focus.id === selectedDetail.id) : standardMappingRows;
    const detailServices = uniqueBy(detailTechnicalRows.flatMap((row) => row.services), (service) => service.id || service.code || service.title);
    const detailProcesses = isFocus ? detailRawProcesses.map(compactProcessMapping) : [];
    const detailModules = uniqueBy(detailTechnicalRows.flatMap((row) => row.modules), (module) => module.id || module.code || module.title);
    const detailSecurityWorks = isFocus ? managementMappingRows.find((row) => row.focus.id === selectedDetail.id)?.securityWorks || [] : uniqueBy(managementMappingRows.flatMap((row) => row.securityWorks), (work) => work.id || work.code || work.title);
    const detailSourceItems = [...list(detailRaw?.security_works), ...list(detailRaw?.scope_mappings)];
    const detailSourceEvidence = sourceEvidenceFor(detailRaw, detailRawProcesses, detailSourceItems);
    const projectedFocusId = canUseObjectProjection ? selectedDetail.id : null;
    const projectedLocalRelationMap = projectedFocusId ? projectedLocalRelationMapFor(capabilityProjection, projectedFocusId) : null;
    const usingWorkbenchMappingRows = Boolean(workbenchTechnicalRows.length || workbenchManagementRows.length);
    const usingProjectedLocalRelationMap = Boolean(!usingWorkbenchMappingRows && projectedLocalRelationMap);
    const fallbackLocalRelationMap = selectedDetail
      ? buildCapabilityLocalRelationMap({
          selectedDetail,
          detailRawProcesses,
          detailTechnicalRows,
          detailManagementRows,
          detailStandardRows,
          detailSourceEvidence,
        })
      : null;
    const rawLocalRelationMap = usingProjectedLocalRelationMap
      ? mergeFallbackStandardsIntoProjected(projectedLocalRelationMap, fallbackLocalRelationMap)
      : mergeProjectedStandards(fallbackLocalRelationMap, projectedLocalRelationMap);
    const localRelationMap = applySecurityWorkCodesToLocalRelationMap(rawLocalRelationMap, securityWorkCodeLookup);

    return {
      navigationTree,
      selection,
      selectedCapability: selectedDetail,
      relationshipSummary: {
        rowCount: visibleFocuses.length,
        selectedType: selectedDetail?.type || selectedCapability?.type || "能力对象",
        serviceCount: summarizeTechnical(technicalMappingRows).serviceCount,
        technicalRowCount: technicalMappingRows.length,
        managementRowCount: managementMappingRows.length,
        standardRowCount: standardMappingRows.filter((row) => list(row.controls).length).length,
        noServiceCount: summarizeTechnical(technicalMappingRows).noServiceCount,
        ambiguousCount: summarizeTechnical(technicalMappingRows).ambiguousCount,
        detailPolicy: capabilityOverview.detailPolicy,
      },
      capabilityOverview,
      focusOverview,
      technicalMappingRows,
      managementMappingRows,
      standardMappingRows,
      localRelationMap,
      localRelationMapSource: usingWorkbenchMappingRows ? "capability_workbench" : usingProjectedLocalRelationMap ? "backend_projection" : "viewmodel_fallback",
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

  function relationRowKey(row) {
    return [row.environment?.id || row.environment?.title, row.object?.id || row.object?.title, row.scope?.id || row.scope?.code || row.scope?.title].map(text).join("::");
  }

  function environmentObjectPairs(rows) {
    return uniqueBy(
      list(rows)
        .flatMap((row) => {
          const environment = compactEntity(row.environment, "待补充");
          const object = compactEntity(row.object, "待补充");
          const environmentTitle = titleOf(environment, "").trim();
          const objectTitle = titleOf(object, "").trim();
          if (!environmentTitle || !objectTitle) return [];
          const objectSegments = list(row.object?.segments);
          const segmentRows = uniqueBy(
            objectSegments.length ? objectSegments : row.segment ? [row.segment] : [],
            (segment) => segment?.id || segment?.code || segment?.title || segment?.name,
          );
          const segments = segmentRows.length ? segmentRows : [{ id: "environment-segment-pending", title: "未定义环境子类" }];
          return segments
            .map((segmentLike) => {
              const segment = compactEntity(segmentLike, "未定义环境子类");
              const segmentTitle = titleOf(segment, "").trim();
              if (!segmentTitle) return null;
              return {
                id: [environment.id || environmentTitle, segment.id || segmentTitle, object.id || objectTitle].map(text).join("::"),
                type: "information_environment_object_path",
                objectKind: "信息化环境",
                title: `${environmentTitle}-${segmentTitle}-${objectTitle}`,
                environment,
                segment,
                object,
              };
            })
            .filter(Boolean);
        })
        .filter(Boolean),
      (item) => item.id || item.title,
    );
  }

  function scopeMatches(scopeRows, scope) {
    if (!scopeRows.length) return true;
    const scopeTitle = text(scope?.title || scope?.name).trim();
    return scopeRows.some((candidate) => {
      if (sameEntity(candidate, scope)) return true;
      const code = text(candidate?.code).trim();
      const title = text(candidate?.title || candidate?.name).trim();
      return Boolean(scopeTitle && ((code && scopeTitle.includes(code)) || (title && scopeTitle.includes(title))));
    });
  }

  function measureRelatedEnvironmentRows(management, measure, services, scopes) {
    const serviceRows = applicableMeasureEntities(services);
    const scopeRows = applicableMeasureEntities(scopes);
    const rows = list(management?.environment_scope_tree).flatMap((environment) =>
      list(environment.objects).flatMap((object) =>
        list(object.scope_mappings).flatMap((mapping) =>
          list(mapping.services)
            .filter((service) => {
              const directMeasureMatched = [
                ...list(service.measures),
                ...list(service.modules).filter(isSecurityTechnicalMeasure),
                ...list(service.relationNodes).filter(isSecurityTechnicalMeasure),
              ].some((linkedMeasure) => sameEntity(linkedMeasure, measure));
              const scopeMatched = scopeMatches(scopeRows, mapping.scope);
              const serviceMatched = !serviceRows.length || serviceRows.some((measureService) => sameEntity(measureService, service));
              return directMeasureMatched || (scopeMatched && serviceMatched);
            })
            .map(() => ({ environment, object, scope: mapping.scope })),
        ),
      ),
    );
    return uniqueBy(rows, relationRowKey);
  }

  function compactMeasureRow(management, measure, index) {
    const services = compactMeasureEntities(measure, ["services", "related_services", "technical_services"]);
    const modules = compactMeasureEntities(measure, ["modules", "related_modules", "technology_modules"]);
    const scopes = compactMeasureEntities(measure, ["scopes", "scope_types", "applicable_scopes"]);
    const focuses = compactMeasureEntities(measure, ["focuses", "capability_focuses", "related_focuses"]);
    if (!services.length) {
      services.push(...compactMeasureEntities(measure, ["related_service_names"]));
    }
    if (!scopes.length) {
      scopes.push(...compactMeasureEntities(measure, ["related_scope_names"]));
    }
    const environmentRows = measureRelatedEnvironmentRows(management, measure, services, scopes);
    const environmentObjectPairRows = environmentObjectPairs(environmentRows);
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
    const sourceLabel = businessText(measure?.source_label || measure?.sourceLabel || measure?.source_kind || measure?.sourceKind);
    const status = measureStatusText(measure?.status || measure?.state, name === PENDING_TEXT ? PENDING_TEXT : "正常");
    const mappingStatusLabel = businessText(measure?.mapping_status_label || measure?.mappingStatusLabel, status === PENDING_TEXT ? "待补充关联安全技术服务或作用域" : "");
    const notes = [];
    if (!environments.length || !environmentObjects.length) {
      notes.push("信息化环境和对象由安全技术服务 + 作用域在 environment_scope_tree 中派生；当前数据未命中时显示待补充。");
    }
    return {
      id: measure?.id || measure?.code || measure?.title || measure?.name || `measure-${index}`,
      index: index + 1,
      measureName: name,
      sourceLabel,
      mappingStatusLabel,
      serviceEmptyText: services.length ? PENDING_TEXT : "待补充关联安全技术服务",
      scopeEmptyText: scopes.length ? PENDING_TEXT : "待补充关联作用域",
      serviceNames: services.map((item) => codeTitle(item, PENDING_TEXT)),
      scopeNames: scopes.map((item) => titleOf(item, PENDING_TEXT)),
      environmentNames: environments.map((item) => titleOf(item, PENDING_TEXT)),
      environmentObjectNames: environmentObjects.map((item) => titleOf(item, PENDING_TEXT)),
      environmentObjectPairs: environmentObjectPairRows,
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

  function serviceRelatedEnvironmentRows(management, service) {
    return uniqueBy(
      list(management?.environment_scope_tree).flatMap((environment) =>
        list(environment.objects).flatMap((object) =>
          list(object.scope_mappings).flatMap((mapping) =>
            list(mapping.services)
              .filter((linkedService) => sameEntity(linkedService, service))
              .map(() => ({ environment, object, scope: mapping.scope })),
          ),
        ),
      ),
      relationRowKey,
    );
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
    const environmentRows = moduleRelatedEnvironmentRows(management, module);
    const environmentObjectPairRows = environmentObjectPairs(environmentRows);
    const environments = uniqueBy(
      [...list(module?.environments), ...environmentRows.map((row) => row.environment)],
      (environment) => environment?.id || environment?.code || environment?.title,
    );
    const catalogSourceRows = list(module?.sources)
      .filter((source) => source?.sheet === "安全技术模块清单" && Number(source?.row))
      .map((source) => Number(source.row));
    const scopes = uniqueBy(
      [
        ...moduleLinkedScopes(management, module),
        ...environmentRows.map((row) => row.scope),
      ],
      (scope) => scope?.id || scope?.code || scope?.title,
    );
    const informationObjects = uniqueBy(
      [
        ...moduleLinkedInformationObjects(management, module),
        ...environmentRows.map((row) => row.object),
      ],
      (object) => object?.id || object?.code || object?.title,
    );
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
      scopeCount: scopes.length || "待契约补充",
      informationObjectCount: informationObjects.length || "待契约补充",
      scopeMappingStatus: scopes.length ? `${scopes.length} 个作用域` : "当前维护包未包含模块-作用域映射",
      informationObjectMappingStatus: informationObjects.length ? `${informationObjects.length} 个对象` : "当前维护包未包含模块-对象映射",
      informationEnvironmentStatus: environments.length ? environments.map((environment) => titleOf(environment, "未命名环境")).join("、") : "当前维护包未包含环境映射",
      status: suspiciousTitle ? "待确认" : missing.length ? "待补充" : "正常",
      missingFields: missing,
      linkedServices: services.map(compactEntity),
      linkedSystems: systems.map(compactEntity),
      linkedProducts: products.map(compactEntity),
      linkedScopes: scopes.map(compactEntity),
      informationObjects: informationObjects.map(compactEntity),
      informationEnvironments: environments.map(compactEntity),
      environmentObjectPairs: environmentObjectPairRows,
    };
  }

  function hasTechnologyModuleCatalogSource(module) {
    return list(module?.sources).some((source) => source?.sheet === "安全技术模块清单" && Number(source?.row));
  }

  function catalogTechnologyModules(management) {
    return list(management?.security_technology_modules).filter((module) => hasTechnologyModuleCatalogSource(module) || text(module?.category).trim());
  }

  function securityWorkBaseCodeFromPath(path = {}) {
    const capabilityCode = text(path?.capability?.code || path?.capabilityCode).trim();
    if (capabilityCode) return capabilityCode;
    const focusCode = text(path?.focus?.code || path?.focusCode).trim();
    const focusBaseCode = focusCode.replace(/-\d+$/, "");
    if (focusBaseCode) return focusBaseCode;
    const domainCode = text(path?.domain?.code || path?.domainCode).trim();
    if (domainCode) return domainCode;
    return "GENERAL";
  }

  function securityWorkDisplayCode(work, path, index) {
    const explicitCode = text(work?.code).trim();
    if (explicitCode.startsWith("SW-")) return explicitCode;
    const focusCode = securityWorkBaseCodeFromPath(path);
    const sequence = String(index + 1).padStart(2, "0");
    return `SW-${focusCode}-${sequence}`;
  }

  function securityWorkTitleKey(value) {
    const raw = typeof value === "object" ? value?.title || value?.name || value?.code || value?.id : value;
    const normalized = text(raw).trim().replace(/\s+/g, "");
    return normalized || "";
  }

  function securityWorkLogicalCount(management, fallback = 0) {
    const count = uniqueBy(list(management?.security_works), (work) => securityWorkTitleKey(work) || work?.id || work?.code).length;
    return count || fallback;
  }

  function securityWorkRawRows(capabilityTree, management) {
    const treeRows = capabilityFocusRows(capabilityTree).flatMap((path) =>
      list(path.focus.security_works).map((work, focusWorkIndex) => ({ ...path, work, focusWorkIndex })),
    );
    const packageRows = list(management?.security_works).flatMap((work, workIndex) => {
      const focuses = list(work.focuses);
      if (!focuses.length) return [{ ...capabilityFocusPathByCode(capabilityTree, {}), work, focusWorkIndex: workIndex }];
      return focuses.map((focus, focusWorkIndex) => ({
        ...capabilityFocusPathByCode(capabilityTree, focus),
        work,
        focusWorkIndex,
      }));
    });
    return packageRows.length ? packageRows : treeRows;
  }

  function capabilityFocusOrderMap(capabilityTree) {
    const map = new Map();
    capabilityFocusRows(capabilityTree).forEach((path, index) => {
      const id = text(path.focus?.id).trim();
      const code = text(path.focus?.code).trim();
      if (id) map.set(`id:${id}`, index);
      if (code) map.set(`code:${code}`, index);
    });
    return map;
  }

  function securityWorkFocusSortOrder(item, focusOrderMap) {
    const focusId = text(item?.focus?.id).trim();
    const focusCode = text(item?.focus?.code).trim();
    if (focusId && focusOrderMap.has(`id:${focusId}`)) return focusOrderMap.get(`id:${focusId}`);
    if (focusCode && focusOrderMap.has(`code:${focusCode}`)) return focusOrderMap.get(`code:${focusCode}`);
    return Number.MAX_SAFE_INTEGER;
  }

  function compareSecurityWorkGroups(left, right) {
    const leftOrder = Number.isFinite(Number(left.sortOrder)) ? Number(left.sortOrder) : Number.MAX_SAFE_INTEGER;
    const rightOrder = Number.isFinite(Number(right.sortOrder)) ? Number(right.sortOrder) : Number.MAX_SAFE_INTEGER;
    const leftRawIndex = Number.isFinite(Number(left.rawIndex)) ? Number(left.rawIndex) : 0;
    const rightRawIndex = Number.isFinite(Number(right.rawIndex)) ? Number(right.rawIndex) : 0;
    return (
      leftOrder - rightOrder ||
      leftRawIndex - rightRawIndex ||
      text(left.title).localeCompare(text(right.title), "zh-Hans-CN")
    );
  }

  function buildSecurityWorkCodeLookup(capabilityTree, management) {
    const grouped = new Map();
    const focusOrderMap = capabilityFocusOrderMap(capabilityTree);
    securityWorkRawRows(capabilityTree, management).forEach((item, rawIndex) => {
      const titleKey = securityWorkTitleKey(item.work);
      const key = titleKey ? `title:${titleKey}` : `id:${item.work?.id || item.work?.code || grouped.size}`;
      const sortOrder = securityWorkFocusSortOrder(item, focusOrderMap);
      if (!grouped.has(key)) grouped.set(key, { key, rows: [], rawIndex, sortOrder, title: item.work?.title || item.work?.name || "" });
      const group = grouped.get(key);
      group.rows.push(item);
      group.sortOrder = Math.min(group.sortOrder, sortOrder);
      group.rawIndex = Math.min(group.rawIndex, rawIndex);
    });
    const sequenceByBaseCode = new Map();
    const byTitle = new Map();
    const byId = new Map();
    const groupCodes = new Map();
    const orderedGroups = [...grouped.values()].sort(compareSecurityWorkGroups);
    for (const group of orderedGroups) {
      const first = group.rows[0] || {};
      const explicitCode = group.rows.map((row) => text(row.work?.code).trim()).find((code) => code.startsWith("SW-"));
      const baseCode = securityWorkBaseCodeFromPath(first);
      const nextSequence = (sequenceByBaseCode.get(baseCode) || 0) + 1;
      sequenceByBaseCode.set(baseCode, nextSequence);
      const displayCode = explicitCode || `SW-${baseCode}-${String(nextSequence).padStart(2, "0")}`;
      groupCodes.set(group.key, displayCode);
      const titleKey = securityWorkTitleKey(first.work);
      if (titleKey) byTitle.set(titleKey, displayCode);
      for (const item of group.rows) {
        const id = text(item.work?.id).trim();
        if (id) byId.set(id, displayCode);
        const rawCode = text(item.work?.code).trim();
        if (rawCode) byId.set(rawCode, displayCode);
      }
    }
    return { byTitle, byId, groupCodes };
  }

  function securityWorkUniqueDisplayCode(work, codeLookup) {
    const explicitCode = text(work?.code).trim();
    if (explicitCode.startsWith("SW-")) return explicitCode;
    const titleKey = securityWorkTitleKey(work);
    if (titleKey && codeLookup?.byTitle?.has(titleKey)) return codeLookup.byTitle.get(titleKey);
    const id = text(work?.id).trim();
    if (id && codeLookup?.byId?.has(id)) return codeLookup.byId.get(id);
    return explicitCode;
  }

  function applySecurityWorkCodesToRows(rows, codeLookup) {
    if (!codeLookup) return rows;
    return list(rows).map((row) => ({
      ...row,
      securityWorks: list(row.securityWorks).map((work) => {
        const code = securityWorkUniqueDisplayCode(work, codeLookup);
        return code ? { ...work, code, displayCode: code } : work;
      }),
    }));
  }

  function applySecurityWorkCodesToLocalRelationMap(map, codeLookup) {
    if (!map || !codeLookup) return map;
    const management = map.management || {};
    const withCode = (work) => {
      const code = securityWorkUniqueDisplayCode(work, codeLookup);
      return code ? { ...work, code, displayCode: code } : work;
    };
    return {
      ...map,
      management: {
        ...management,
        securityWorks: list(management.securityWorks).map(withCode),
        works: list(management.works).map(withCode),
      },
    };
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

  function capabilityFocusPathByCode(capabilityTree, focus) {
    const focusId = text(focus?.id).trim();
    const focusCode = text(focus?.code).trim();
    return (
      capabilityFocusRows(capabilityTree).find((path) => {
        const candidate = path.focus || {};
        return (focusId && candidate.id === focusId) || (focusCode && candidate.code === focusCode);
      }) || { category: null, domain: null, capability: null, focus }
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
      displayCode: securityWorkDisplayCode(work, { category, domain, capability, focus }, focusWorkIndex),
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

  function buildSecurityWorkMaintenanceViewModel({ capabilityTree, management, search }) {
    const query = normalizeSearch(search);
    const rawRows = securityWorkRawRows(capabilityTree, management);
    const codeLookup = buildSecurityWorkCodeLookup(capabilityTree, management);
    const focusOrderMap = capabilityFocusOrderMap(capabilityTree);
    const rowPairs = rawRows.map((item, index) => ({
      item,
      row: compactSecurityWorkRow(item, index, item.focusWorkIndex),
    }));
    const grouped = new Map();
    rowPairs.forEach((pair, rawIndex) => {
      const titleKey = securityWorkTitleKey(pair.row.title);
      const key = titleKey ? `title:${titleKey}` : `id:${pair.row.rawId || pair.row.id}`;
      const sortOrder = securityWorkFocusSortOrder(pair.item, focusOrderMap);
      if (!grouped.has(key)) grouped.set(key, { key, pairs: [], rawIndex, sortOrder, title: pair.row.title });
      const group = grouped.get(key);
      group.pairs.push(pair);
      group.sortOrder = Math.min(group.sortOrder, sortOrder);
      group.rawIndex = Math.min(group.rawIndex, rawIndex);
    });
    const groupedRows = Array.from(grouped.values()).sort(compareSecurityWorkGroups).map((group, index) => {
      const rows = group.pairs.map((pair) => pair.row);
      const first = rows[0] || {};
      const displayCode = codeLookup.groupCodes.get(group.key) || securityWorkUniqueDisplayCode(group.pairs[0]?.item?.work, codeLookup) || first.displayCode;
      const displayCodes = displayCode ? [displayCode] : [];
      const relatedFocuses = uniqueBy(
        rows
          .map((row) => row.focus)
          .filter((focus) => focus && (focus.id || focus.code || focus.title)),
        (focus) => focus.id || focus.code || focus.title,
      );
      const relatedCapabilities = uniqueBy(
        rows
          .map((row) => row.capability)
          .filter((capability) => capability && (capability.id || capability.code || capability.title)),
        (capability) => capability.id || capability.code || capability.title,
      );
      const relatedCategories = uniqueBy(
        rows
          .map((row) => row.category)
          .filter((category) => category && (category.id || category.code || category.title)),
        (category) => category.id || category.code || category.title,
      );
      const relatedDomains = uniqueBy(
        rows
          .map((row) => row.domain)
          .filter((domain) => domain && (domain.id || domain.code || domain.title)),
        (domain) => domain.id || domain.code || domain.title,
      );
      const sourceEvidence = uniqueBy(group.pairs.flatMap((pair) => list(pair.item?.work?.sources)), sourceEvidenceKey);
      const missingFields = uniqueBy(rows.flatMap((row) => list(row.missingFields)), (field) => field);
      return {
        ...first,
        id: `security-work-group:${group.key}`,
        rawIds: uniqueBy(rows.map((row) => row.rawId).filter(Boolean), (id) => id),
        index: index + 1,
        displayCode: displayCodes[0] || first.displayCode,
        displayCodes,
        codeCount: displayCodes.length,
        relatedFocuses,
        relatedCapabilities,
        relatedCategories,
        relatedDomains,
        focus: relatedFocuses[0] || first.focus,
        focusCode: relatedFocuses[0]?.code || first.focusCode,
        focusTitle: relatedFocuses[0]?.title || first.focusTitle,
        capability: relatedCapabilities[0] || first.capability,
        category: relatedCategories[0] || first.category,
        domain: relatedDomains[0] || first.domain,
        focusCount: relatedFocuses.length,
        capabilityCount: relatedCapabilities.length,
        missingFields,
        sourceEvidence,
        status: missingFields.length ? "待补充" : rows.some((row) => row.status === "待补充") ? "待补充" : "正常",
      };
    });
    const rows = groupedRows
      .filter((row) =>
        includesSearch(
          query,
          row.displayCode,
          ...list(row.displayCodes),
          row.title,
          row.status,
          row.capability?.title,
          ...list(row.relatedCapabilities).map((item) => codeTitle(item)),
          row.focusCode,
          row.focusTitle,
          ...list(row.relatedFocuses).map((item) => codeTitle(item)),
          row.category?.title,
          row.domain?.title,
        ),
      );
    return {
      rows,
      summary: {
        totalSecurityWorks: rows.length,
        linkedCapabilities: countLinked(rows.flatMap((row) => row.relatedCapabilities)),
        linkedFocuses: countLinked(rows.flatMap((row) => row.relatedFocuses)),
        pendingFields: rows.filter((row) => row.status === "待补充").length,
        relationRows: rows.reduce((sum, row) => sum + list(row.relatedFocuses).length, 0),
      },
      sourceEvidenceById: Object.fromEntries(groupedRows.map((row) => [row.id, list(row.sourceEvidence)])),
      emptyState: rows.length ? "" : "暂无安全工作数据，请确认 ETL 是否已导出 security_works。",
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
          ...row.environmentObjectPairs.map(titleOf),
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
          row.title,
          row.category,
          row.description,
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
          row.description,
          row.category,
          row.title,
          row.matchEvidence,
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
    const components = sortBySourceRow(list(system?.components)).map(compactLifecycleItem);
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

  function sourceRowNumber(item) {
    const rows = list(item?.sources)
      .map((source) => Number(source?.row))
      .filter((row) => Number.isFinite(row));
    return rows.length ? Math.min(...rows) : Number.MAX_SAFE_INTEGER;
  }

  function sortBySourceRow(items) {
    return list(items)
      .map((item, index) => ({ item, index, sourceRow: sourceRowNumber(item) }))
      .sort((left, right) => left.sourceRow - right.sourceRow || left.index - right.index)
      .map(({ item }) => item);
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

  function buildApplicationSystemDirectoryViewModel({ lifecycle, search }) {
    const query = normalizeSearch(search);
    const applicationSecurity = lifecycle?.application_security_development || {};
    const rowPairs = sortBySourceRow(applicationSecurity.application_system_types).map((system, index) => ({
      system,
      row: compactLifecycleApplicationSystemReferenceRow(system, index),
    }));
    const rows = rowPairs
      .map(({ row }) => row)
      .filter((row) => includesSearch(query, row.title, row.description, ...row.components.map(titleOf)));
    return {
      rows,
      applicationRows: rows,
      summary: {
        totalApplicationSystems: rows.length,
        applicationComponents: rows.reduce((sum, row) => sum + row.componentCount, 0),
      },
      sourceEvidenceById: Object.fromEntries(rowPairs.map(({ row }) => [row.id, row.sourceEvidence])),
      emptyState: rows.length ? "" : "暂无应用系统目录数据，请确认 lifecycle-knowledge.json 是否已导出 application_system_types。",
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
      .filter((scope) => scope?.display_in_scope_catalog !== false)
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

  function capabilityCategoryCode(category) {
    const explicitCode = text(category?.code).trim();
    if (explicitCode) return explicitCode;
    const match = titleOf(category, "").match(/\b([A-Z])$/);
    return match?.[1] || "L0";
  }

  function compactCapabilityDirectoryFocus(category, domain, capability, focus, index) {
    return {
      id: focus?.id || focus?.code || focus?.title || `capability-focus-${index}`,
      level: "关注点",
      categoryCode: capabilityCategoryCode(category),
      categoryTitle: titleOf(category, "待补充能力分类"),
      domainCode: domain?.code || "",
      domainTitle: titleOf(domain, "待补充能力域"),
      capabilityCode: capability?.code || "",
      capabilityTitle: titleOf(capability, "待补充安全能力"),
      capabilityDefinition: capability?.description || "待补充", code: focus?.code || "",
      title: titleOf(focus, "待补充关注点"),
      description: focus?.description || "待补充",
      serviceCount: Number(focus?.service_count) || list(focus?.services).length || 0,
    };
  }

  function buildCapabilityDirectoryViewModel({ capabilityTree, search }) {
    const query = normalizeSearch(search);
    const groups = [];
    const rows = [];
    let l1Count = 0;
    let l2Count = 0;
    let focusCount = 0;
    for (const category of list(capabilityTree?.categories)) {
      const categoryCode = capabilityCategoryCode(category);
      const categoryMatch = includesSearch(query, categoryCode, category?.title, category?.description);
      const categoryGroup = {
        id: category?.id || categoryCode || category?.title,
        code: categoryCode,
        title: titleOf(category, "待补充能力分类"),
        description: category?.description || "",
        domains: [],
      };
      for (const domain of list(category?.domains)) {
        const domainMatch = categoryMatch || includesSearch(query, domain?.code, domain?.title, domain?.description);
        const domainGroup = {
          id: domain?.id || domain?.code || domain?.title,
          code: domain?.code || "",
          title: titleOf(domain, "待补充能力域"),
          description: domain?.description || "",
          capabilities: [],
        };
        for (const capability of list(domain?.capabilities)) {
          const capabilityMatch = domainMatch || includesSearch(query, capability?.code, capability?.title, capability?.description);
          const focusRows = list(capability?.focuses)
            .map((focus, index) => compactCapabilityDirectoryFocus(category, domain, capability, focus, index))
            .filter((focus) => capabilityMatch || includesSearch(query, focus.code, focus.title, focus.description));
          if (!capabilityMatch && !focusRows.length) continue;
          const capabilityRow = {
            id: capability?.id || capability?.code || capability?.title,
            level: "L2",
            code: capability?.code || "",
            title: titleOf(capability, "待补充安全能力"),
            description: capability?.description || "待补充",
            focusCount: focusRows.length,
            serviceCount: focusRows.reduce((sum, focus) => sum + Number(focus.serviceCount || 0), 0),
            focuses: focusRows,
          };
          domainGroup.capabilities.push(capabilityRow);
          rows.push(capabilityRow, ...focusRows);
          focusCount += focusRows.length;
          l2Count += 1;
        }
        if (!domainGroup.capabilities.length) continue;
        categoryGroup.domains.push(domainGroup);
        l1Count += 1;
      }
      if (categoryGroup.domains.length) groups.push(categoryGroup);
    }
    return {
      rows,
      capabilityGroups: groups,
      summary: {
        l0: groups.length,
        l1: l1Count,
        l2: l2Count,
        focuses: focusCount,
      },
      emptyState: rows.length ? "" : query ? "未找到匹配的安全能力，请调整搜索条件。" : "暂无安全能力清单数据，请确认 capability-tree.json 是否已导出安全能力和关注点。",
    };
  }

  function serviceDefinitionText(service) {
    return businessText(service?.description || service?.definition || service?.summary, "待补充定义");
  }

  function scopeKey(scope) {
    return text(scope?.code || scope?.id || scope?.title || scope?.name).trim();
  }

  function scopeLabel(scope) {
    return [scope?.code, titleOf(scope, "")].filter(Boolean).join(" ") || "待补充作用域";
  }

  function scopeLookup(management) {
    return new Map(list(management?.scope_types).map((scope) => [scopeKey(scope), scope]).filter(([key]) => key));
  }

  function scopeSortOrderMap(management) {
    const orders = new Map();
    list(management?.scope_types).forEach((scope, index) => {
      const key = scopeKey(scope);
      if (key) orders.set(key, index + 1);
    });
    return orders;
  }

  function serviceLookupKeys(service) {
    return uniqueBy([service?.id, service?.code, service?.title, service?.name], (value) => text(value).trim())
      .map((value) => text(value).trim())
      .filter(Boolean);
  }

  function measureByServiceLookup(management) {
    const measuresByService = new Map();
    const addMeasure = (serviceRef, measure) => {
      serviceLookupKeys(serviceRef).forEach((key) => {
        if (!measuresByService.has(key)) measuresByService.set(key, []);
        measuresByService.get(key).push(measure);
      });
    };
    list(management?.[TECHNICAL_MEASURES_FIELD]).forEach((measure) => {
      const measureEntity = { ...compactEntity(measure, "未命名安全技术措施"), objectKind: "安全技术措施" };
      list(measure?.related_services).forEach((serviceRef) => addMeasure(serviceRef, measureEntity));
      list(measure?.related_service_ids).forEach((id) => addMeasure({ id }, measureEntity));
      list(measure?.related_service_names).forEach((title) => addMeasure({ title }, measureEntity));
    });
    return measuresByService;
  }

  function canonicalScope(scope, orderIndex = {}) {
    if (!scope) return scope;
    const code = text(scope?.code).trim();
    const key = scopeKey(scope);
    const canonical = orderIndex.scopeByCode?.get(code) || orderIndex.scopeByCode?.get(key);
    return canonical ? { ...scope, ...canonical, sources: list(scope?.sources).length ? scope.sources : canonical.sources } : scope;
  }

  function compactTechnicalServiceRow(entry, index, orderIndex = {}) {
    const service = entry?.service || entry || {};
    const scopes = uniqueBy(
      list(entry?.scopes || service?.scopes || service?.scope_types).map((scope) => canonicalScope(scope, orderIndex)),
      (scope) => scope?.id || scope?.code || scope?.title,
    );
    const declaredScopeCode = serviceScopeCode(service?.code);
    const fallbackScope = orderIndex.scopeByCode?.get(declaredScopeCode);
    const groupingScopes = scopes.length ? scopes : fallbackScope ? [fallbackScope] : [];
    const modules = uniqueBy(list(entry?.modules || service?.modules || service?.technology_modules), (module) => module?.id || module?.code || module?.title);
    const linkedModules = modules.map((module) => ({ ...compactEntity(module), objectKind: "安全技术模块" }));
    const linkedMeasures = uniqueBy(
      serviceLookupKeys(service).flatMap((key) => list(orderIndex.measuresByService?.get(key))),
      (measure) => measure?.id || measure?.code || measure?.title,
    );
    const linkedModuleMeasures = uniqueBy([...linkedModules, ...linkedMeasures], (item) => `${item?.objectKind || ""}:${item?.id || item?.code || item?.title}`);
    const environmentRows = serviceRelatedEnvironmentRows(orderIndex.environmentManagement || {}, service);
    const environmentObjectPairRows = environmentObjectPairs(environmentRows);
    const systems = uniqueBy(modules.flatMap((module) => list(module?.systems)), (system) => system?.id || system?.code || system?.title);
    const products = uniqueBy(modules.flatMap((module) => list(module?.products)), (product) => product?.id || product?.code || product?.title);
    const environments = uniqueBy(
      [
        ...list(entry?.environments || service?.environments),
        ...modules.flatMap((module) => list(module?.environments)),
        ...environmentRows.map((row) => row.environment),
      ],
      (environment) => environment?.id || environment?.code || environment?.title,
    );
    const definition = serviceDefinitionText(service);
    const missing = [
      !text(service?.code).trim() ? "服务编号" : "",
      definition === "待补充定义" ? "定义" : "",
      !scopes.length ? "适用作用域" : "",
    ].filter(Boolean);
    const focusCode = serviceFocusCode(service?.code);
    const capabilityCode = capabilityCodeFromFocusCode(focusCode);
    const focusOrder = orderIndex.focusOrder?.get(focusCode);
    const capabilityOrder = orderIndex.capabilityOrder?.get(capabilityCode);
    const capabilityTitle = focusOrder?.capabilityTitle || capabilityOrder?.title || capabilityCode || "待补充安全能力";
    const focusTitle = focusOrder?.focusTitle || focusCode || "待补充关注点";
    const ownershipFocus = focusCode
      ? {
          id: focusCode,
          type: "capability_focus",
          code: "",
          title: [capabilityTitle, focusTitle].filter(Boolean).join(" / "),
        }
      : null;
    return {
      id: service?.id || service?.code || service?.title || `technical-service-${index}`,
      index: index + 1,
      code: service?.code || "待补充",
      title: titleOf(service, "待补充"),
      serviceLabel: codeTitle(service, "待补充"),
      sourceOrder: index + 1,
      capabilityCode,
      capabilityTitle,
      focusCode,
      focusTitle,
      sortOrder: focusOrder?.order ?? capabilityOrder?.order ?? 999999,
      definition,
      status: missing.length ? "待补充" : "正常",
      missingFields: missing,
      scopeCount: scopes.length,
      moduleCount: modules.length,
      systemCount: systems.length,
      productCount: products.length,
      environmentCount: environments.length,
      linkedScopes: scopes.map(compactEntity),
      groupingScopes: groupingScopes.map(compactEntity),
      ownershipFocuses: ownershipFocus ? [ownershipFocus] : [],
      linkedModules,
      linkedMeasures,
      linkedModuleMeasures,
      linkedSystems: systems.map(compactEntity),
      linkedProducts: products.map(compactEntity),
      linkedEnvironments: environments.map(compactEntity),
      environmentObjectPairs: environmentObjectPairRows,
      sourceEvidence: uniqueBy([...list(service?.sources), ...list(entry?.sources)], sourceEvidenceKey),
    };
  }

  function orderValue(value) {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : 999999;
  }

  function compareTechnicalServiceRows(left, right) {
    return (
      orderValue(left.sortOrder) - orderValue(right.sortOrder) ||
      orderValue(left.sourceOrder) - orderValue(right.sourceOrder) ||
      text(left.code).localeCompare(text(right.code), "zh-Hans-CN", { numeric: true, sensitivity: "base" }) ||
      text(left.title).localeCompare(text(right.title), "zh-Hans-CN")
    );
  }

  function buildTechnicalServiceScopeGroups(rows, management) {
    const orderMap = scopeSortOrderMap(management);
    const grouped = new Map();
    for (const row of list(rows)) {
      const isManagementService = text(row.code).startsWith("M");
      const scopes = list(row.groupingScopes).length ? list(row.groupingScopes) : [{ code: "missing", title: "待补充作用域" }];
      const groups = isManagementService
        ? [{ id: "security-management", code: "M", title: "安全管理类安全技术服务", label: "安全管理类安全技术服务", order: 10001 }]
        : scopes.map((scope) => {
            const key = scopeKey(scope) || "missing";
            if (key === "ALL") {
              return {
                id: "security-operations",
                code: "ALL",
                title: "安全运行类安全技术服务",
                label: "安全运行类安全技术服务",
                order: 10000,
              };
            }
            return {
              id: key,
              code: scope?.code || "",
              title: titleOf(scope, "待补充作用域"),
              label: scopeLabel(scope),
              order: orderMap.has(key) ? orderMap.get(key) : 9999,
            };
          });
      for (const groupInfo of groups) {
        const key = groupInfo.id || "missing";
        if (!grouped.has(key)) {
          grouped.set(key, {
            id: key,
            code: groupInfo.code || "",
            title: groupInfo.title || "待补充作用域",
            label: groupInfo.label || groupInfo.title || "待补充作用域",
            count: 0,
            order: groupInfo.order ?? 9999,
            rows: [],
          });
        }
        const group = grouped.get(key);
        group.count += 1;
        group.rows.push(row);
      }
    }
    return [...grouped.values()]
      .map((group) => ({
        ...group,
        rows: uniqueBy(group.rows.sort(compareTechnicalServiceRows), (row) => row.id),
      }))
      .sort((left, right) => left.order - right.order || text(left.label).localeCompare(text(right.label), "zh-Hans-CN"));
  }

  function buildTechnicalServiceMaintenanceViewModel({ capabilityTree, management, search }) {
    const query = normalizeSearch(search);
    const orderIndex = {
      ...buildCapabilityFocusOrder(capabilityTree),
      scopeByCode: scopeLookup(management),
      measuresByService: measureByServiceLookup(management),
      environmentManagement: management,
    };
    const sourceEntries = list(management?.security_technical_services).length
      ? list(management?.security_technical_services)
      : list(management?.service_module_index);
    const rowPairs = sourceEntries.map((entry, index) => ({ entry, row: compactTechnicalServiceRow(entry, index, orderIndex) }));
    const searchRows = rowPairs
      .map(({ row }) => row)
      .sort(compareTechnicalServiceRows)
      .filter((row) =>
        includesSearch(
          query,
          row.code,
          row.title,
          row.definition,
          row.status,
          ...row.ownershipFocuses.map(codeTitle),
          ...row.linkedScopes.map(codeTitle),
          ...row.linkedModules.map(titleOf),
          ...row.linkedMeasures.map(titleOf),
          ...row.linkedSystems.map(titleOf),
          ...row.linkedProducts.map(titleOf),
          ...row.linkedEnvironments.map(titleOf),
          ...row.environmentObjectPairs.map(titleOf),
        ),
      );
    const rows = searchRows.map((row, index) => ({ ...row, index: index + 1 }));
    return {
      rows,
      serviceScopeGroups: buildTechnicalServiceScopeGroups(rows, management),
      summary: {
        totalServices: rows.length,
        linkedFocuses: countLinked(rows.flatMap((row) => row.ownershipFocuses)),
        linkedModules: countLinked(rows.flatMap((row) => row.linkedModuleMeasures)),
        linkedSystems: countLinked(rows.flatMap((row) => row.linkedSystems)),
        missingDefinitions: rows.filter((row) => row.definition === "待补充定义").length,
      },
      sourceEvidenceById: Object.fromEntries(rowPairs.map(({ row }) => [row.id, row.sourceEvidence])),
      emptyState: rows.length ? "" : "暂无安全技术服务数据，请确认 ETL 是否已导出 security_technical_services 或 service_module_index。",
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
        row.sourceLabel,
        row.mappingStatusLabel,
        row.detail.category,
        row.status,
        ...row.serviceNames,
        ...row.scopeNames,
        ...row.environmentNames,
        ...row.environmentObjectNames,
        ...row.environmentObjectPairs.map(titleOf),
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

  function entityMatchesWorkFunction(workFunction, entity) {
    if (!workFunction || !entity) return false;
    return (
      (workFunction.id && entity.id && workFunction.id === entity.id) ||
      (workFunction.code && entity.code && workFunction.code === entity.code) ||
      (workFunction.title && entity.title && workFunction.title === entity.title) ||
      (workFunction.code && entity.id && entity.id === `work-function-candidate:${workFunction.code}`)
    );
  }

  function gartnerReferencesForWorkFunction(management, workFunction) {
    return uniqueBy(
      list(management?.gartner_roles).filter((role) =>
        gartnerCandidateFunctions(role).some((candidate) => entityMatchesWorkFunction(workFunction, candidate)),
      ),
      (role) => role?.id || role?.code || role?.title,
    );
  }

  function compactWorkFunctionMaintenanceRow(management, layer, group, fn) {
    const tasks = list(fn?.tasks);
    const processReferences = processReferencesForWorkFunction(management, fn);
    const processGroups = uniqueBy(
      processReferences.map(({ group }) => group).filter(Boolean),
      (item) => item?.id || item?.code || item?.title,
    );
    const processReferenceItems = uniqueBy(
      processReferences.map(({ reference }) => reference).filter(Boolean),
      (reference) => reference?.id || reference?.code || reference?.title,
    );
    const gartnerReferences = gartnerReferencesForWorkFunction(management, fn);
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
      processGroupCount: processGroups.length,
      processCount: processReferenceItems.length,
      processRelationCount: processGroups.length + processReferenceItems.length,
      gbtReferenceCount: list(fn?.gbt_42446_refs).length,
      gartnerReferenceCount: gartnerReferences.length,
      status: missing.length ? "待补充" : "正常",
      missingFields: missing,
      tasks: tasks.map(compactEntity),
      processGroups: processGroups.map(compactEntity),
      processReferences: processReferenceItems.map(compactEntity),
      gbtReferences: list(fn?.gbt_42446_refs).map(compactEntity),
      gartnerReferences: gartnerReferences.map(compactEntity),
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
        gbtReferences: rows.reduce((sum, row) => sum + Number(row.gbtReferenceCount || 0), 0),
        gartnerReferences: rows.reduce((sum, row) => sum + Number(row.gartnerReferenceCount || 0), 0),
        linkedProcessRelations: rows.reduce((sum, row) => sum + Number(row.processRelationCount || 0), 0),
        linkedProcesses: rows.reduce((sum, row) => sum + (Number(row.processCount) || 0), 0),
        missingFields: rows.filter((row) => row.status === "待补充").length,
      },
      emptyState: rows.length ? "" : "暂无职能清单数据，请确认 ETL 是否已导出 work_function_layers。",
    };
  }

  function maintenanceNavigationItems(management, section, capabilityTree, lifecycle, standards) {
    const configuredCount = (id, fallback = 0) => {
      const counts = management?.section_counts || management?.maintenance_index?.section_counts || {};
      const value = counts[id];
      return Number.isFinite(Number(value)) ? Number(value) : fallback;
    };
    const capabilityDirectoryCount = list(capabilityTree?.categories).reduce(
      (sum, category) =>
        sum +
        list(category?.domains).reduce(
          (domainSum, domain) =>
            domainSum +
            list(domain?.capabilities).reduce((capabilitySum, capability) => capabilitySum + 1 + list(capability?.focuses).length, 0),
          0,
        ),
      0,
    );
    const processCount = list(management?.security_processes).flatMap((domain) => list(domain.groups).flatMap((group) => list(group.references))).length;
    const workFunctionCount = list(management?.work_function_layers).flatMap((layer) => list(layer.groups).flatMap((group) => list(group.functions))).length;
    const securityWorkReferenceCount = list(capabilityTree?.categories).flatMap((category) =>
      list(category.domains).flatMap((domain) => list(domain.capabilities).flatMap((capability) => list(capability.focuses).flatMap((focus) => list(focus.security_works)))),
    ).length;
    const securityWorkCount = securityWorkLogicalCount(management, securityWorkReferenceCount);
    const applicationSystemCount = list(lifecycle?.application_security_development?.application_system_types).length;
    return [
      { id: "capability-directory", label: "安全能力清单", count: capabilityDirectoryCount, implemented: true },
      { id: "scopes", label: "作用域清单", count: configuredCount("scopes", list(management?.scope_types).length), implemented: true },
      {
        id: "services",
        label: "安全技术服务清单",
        count: configuredCount("services", list(management?.security_technical_services).length || list(management?.service_module_index).length),
        implemented: true,
      },
      { id: "modules", label: "安全技术模块清单", count: configuredCount("modules", catalogTechnologyModules(management).length), implemented: true },
      { id: "measures", label: "安全技术措施清单", count: configuredCount("measures", list(management?.security_technical_measures).length), implemented: true },
      { id: "security-works", label: "安全工作清单", count: securityWorkCount, implemented: true },
      { id: "processes", label: "流程清单", count: configuredCount("processes", processCount), implemented: true },
      { id: "application-systems", label: "应用系统目录", count: applicationSystemCount, implemented: true },
      { id: "work-functions", label: "职能清单", count: configuredCount("work-functions", workFunctionCount), implemented: true },
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
    ],
    references: [
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
    if (section === "capability-directory") {
      return {
        title: "安全能力清单",
        description: "集中查看安全能力和安全关注点，按 L0 能力分类、L1 能力域、L2 安全能力逐层归纳展开。",
        implemented: true,
        notice: "当前页只展示安全能力和关注点业务字段；关系核对仍在安全能力映射工作台中完成。",
      };
    }
    if (section === "services" || section === "modules" || section === "measures") {
      const isServicePage = section === "services";
      return {
        title: isServicePage ? "安全技术服务清单" : "安全技术模块/措施清单",
        description: isServicePage
          ? "安全技术服务清单用于核对服务编号、定义补充状态、归属安全能力/关注点和模块关联关系。"
          : "安全技术模块是实现服务的标准技术构件；安全技术措施是更细粒度的落地措施，二者在页面和颜色上保持区分。",
        implemented: true,
        notice:
          isServicePage
            ? "服务按作用域分组，ALL 服务显示为安全运行类，M 开头服务显示为安全管理类；组内按安全能力/关注点顺序排列。"
            : section === "modules"
              ? "模块只来自安全技术模块清单或权威模块关系，不伪造成措施。"
              : "措施需保持来源标签和服务 / 作用域映射，不伪造成模块。",
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
      if (section === "references") {
        return {
          title: "人力资源 Workforce 参考标准",
          description: "GB/T 42446-2023 与 Gartner 工作岗位参考已迁移到安全标准 / 框架模块，旧路由仅保留兼容。",
          implemented: true,
          notice: "请从安全标准 / 框架进入“人力资源 Workforce 参考标准”。",
        };
      }
      return {
        title: "安全职能清单",
        description: "集中维护安全工作职能清单，按安全职能层和职能组核对职能定义、流程关联及参考映射。",
        implemented: true,
        notice: "GB/T 42446-2023 与 Gartner 工作岗位参考已迁移到安全标准 / 框架模块。",
      };
    }
    if (section === "application-systems") {
      return {
        title: "应用系统目录",
        description: "来自 LC-AP 应用安全开发生命周期元素目录，按原始字段“应用系统、定义、应用组件”归纳展开。",
        implemented: true,
        notice: "当前页面只展示原始表应用系统目录区域的业务字段；软件开发类型仍保留在 LC-AP 生命周期参考数据中。",
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

  function buildStandardFrameworkViewModel({ standards, search, standardFrameworkId = "mlps-level-3", standardTableId = "" }) {
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
    const activeTableId = frameworkTables.some((table) => table.id === standardTableId) ? standardTableId : frameworkTables[0]?.id || "";
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
        active: (table.id || `${tableIndex}`) === activeTableId,
      };
    });
    const activeTable = tableModels.find((table) => table.active) || tableModels[0] || { columns: [], rows: [] };
    const rows = activeTable.rows || [];
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
      activeStandardTableId: activeTable.id || activeTableId || "",
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
    if (section === "capability-directory") {
      return {
        type: row.level === "L2" ? "安全能力" : "安全关注点",
        code: row.code,
        title: row.title,
        description: row.description,
        facts: [
          { label: "层级", value: row.level },
          { label: "L1 能力域", value: [row.domainCode, row.domainTitle].filter(Boolean).join(" ") || "待补充" },
          { label: "L2 安全能力", value: [row.capabilityCode, row.capabilityTitle].filter(Boolean).join(" ") || row.title },
        ],
        sections: [],
        sourceEvidence,
      };
    }
    if (section === "scopes") {
      return {
        type: "安全能力作用域",
        code: row.code,
        title: row.title,
        description: row.description,
        facts: [
          { label: "情景", value: row.scenario },
          { label: relationLabel("security_technical_service", "关联安全技术服务"), value: row.serviceCount },
          { label: relationLabel("information_object", "关联信息化对象"), value: row.informationObjectCount },
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
          { label: displayLabel("l2_process_group", "L2 流程组"), value: row.processGroup },
          { label: `${displayLabel("l4_activity", "L4 活动")}状态`, value: row.l4ActivityStatus },
          { label: relationLabel("capability_focus", "关联能力关注点"), value: row.relatedFocusCount },
          { label: "关联安全职能", value: row.securityFunctionCount },
        ],
        sections: [
          { title: displayLabel("l4_activity", "L4 活动"), items: row.activities },
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
          { label: "GB/T 42446-2023 映射", value: row.gbtReferenceCount },
          { label: "Gartner 映射", value: row.gartnerReferenceCount },
          { label: "关联流程组/流程", value: row.processRelationCount },
        ],
        sections: [
          { title: "GB/T 42446-2023 映射", items: row.gbtReferences },
          { title: "Gartner 映射", items: row.gartnerReferences },
          { title: "关联流程组", items: row.processGroups },
          { title: "关联流程", items: row.processReferences },
        ],
        sourceEvidence,
      };
    }
    if (section === "security-works") {
      return {
        type: "安全工作",
        code: row.displayCode,
        title: row.title,
        description: "安全工作作为独立对象展示；一个安全工作可关联多个能力关注点。",
        facts: [
          { label: "工作编码", value: list(row.displayCodes).join("、") || row.displayCode },
          { label: "关联安全能力", value: row.capabilityCount ? `${row.capabilityCount} 项` : "待补充" },
          { label: "关联关注点", value: row.focusCount ? `${row.focusCount} 项` : "待补充" },
          { label: "状态", value: row.status },
        ],
        sections: [
          { title: "关联安全能力", items: row.relatedCapabilities },
          { title: "关联关注点", items: row.relatedFocuses },
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
          { label: relationLabel("scope_type", "关联作用域"), value: row.scopeCount },
          { label: relationLabel("information_object", "关联信息化对象"), value: row.informationObjectCount },
        ],
        sections: [
          { title: "所属安全系统", items: row.linkedSystems },
          { title: "关联安全技术服务", items: row.linkedServices },
          { title: relationLabel("scope_type", "关联作用域"), items: row.linkedScopes },
          { title: relationLabel("information_object", "关联信息化对象"), items: row.informationObjects },
          { title: relationLabel("information_environment", "关联信息化环境"), items: row.informationEnvironments },
        ],
        sourceEvidence,
      };
    }
    if (section === "services") {
      return {
        type: "安全技术服务",
        code: row.code,
        title: row.serviceLabel,
        description: row.definition,
        facts: [
          { label: "服务编号", value: row.code },
          { label: "归属安全能力 / 关注点", value: row.ownershipFocuses.length || "待补充" },
          { label: relationLabel("security_module_or_measure", "关联安全技术模块/措施"), value: row.linkedModuleMeasures.length },
          { label: relationLabel("security_system", "关联安全系统"), value: row.systemCount },
          { label: "定义状态", value: row.definition === "待补充定义" ? "待补充" : "正常" },
        ],
        sections: [
          { title: "归属安全能力 / 关注点", items: row.ownershipFocuses },
          { title: relationLabel("security_module_or_measure", "关联安全技术模块/措施"), items: row.linkedModuleMeasures },
          { title: relationLabel("security_system", "关联安全系统"), items: row.linkedSystems },
          { title: "关联产品", items: row.linkedProducts },
          { title: relationLabel("information_environment", "关联信息化环境"), items: row.environmentObjectPairs?.length ? row.environmentObjectPairs : row.linkedEnvironments },
        ],
        sourceEvidence,
      };
    }
    if (section === "references") {
      const isRoleReference = row.referenceKind === "role";
      return {
        type: row.referenceType,
        title: row.title,
        description: row.description,
        facts: isRoleReference ? [{ label: "分类", value: row.category }] : [{ label: "工作类别", value: row.category }],
        sections: [],
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
    if (section === "application-systems") {
      return {
        type: "应用系统目录",
        title: row.title,
        description: row.description,
        facts: [],
        sections: [{ title: "应用组件", items: row.components }],
        sourceEvidence,
      };
    }
    if (section === "lcap-references") {
      return {
        type: row.type || "应用系统目录",
        code: row.type || "",
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
        { label: relationLabel("security_technical_service", "关联安全技术服务"), value: measureEntityCountLabel(row.linkedServices) },
        { label: relationLabel("scope_type", "关联作用域"), value: measureEntityCountLabel(row.applicableScopes) },
        { label: relationLabel("information_environment", "关联信息化环境"), value: measureEntityCountLabel(row.relatedEnvironments) },
        { label: relationLabel("information_object", "关联信息化对象"), value: measureEntityCountLabel(row.relatedEnvironmentObjects) },
      ],
      sections: [
        { title: "关联安全技术服务", items: row.linkedServices },
        { title: relationLabel("scope_type", "关联作用域"), items: row.applicableScopes },
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
      const source = list(management?.security_works).find((work, index) => (work?.id || work?.code || work?.title || `security-work-${index}`) === row.rawId);
      return list(source?.sources);
    }
    if (section === "modules") {
      const source = list(management?.security_technology_modules).find((module, index) => (module?.id || module?.code || module?.title || `technology-module-${index}`) === row.id);
      return list(source?.sources);
    }
    if (section === "services") {
      const source = list(management?.security_technical_services).find((entry, index) => {
        const service = entry?.service || entry;
        return (service?.id || service?.code || service?.title || `technical-service-${index}`) === row.id;
      });
      return uniqueBy([...list(source?.service?.sources), ...list(source?.sources), ...list(row?.sourceEvidence)], sourceEvidenceKey);
    }
    if (section === "references") {
      const sourceList = row.referenceKind === "standard" ? list(management?.gbt_42446_references) : list(management?.gartner_roles);
      const source = sourceList.find((item, index) => (item?.id || item?.code || item?.title || `${row.referenceKind}-${index}`) === row.rawId);
      return list(source?.sources);
    }
    return [];
  }

  function buildMaintenanceWorkspaceViewModel({ capabilityTree, management, maintenance, lifecycle, standards, section = "scopes", selectedId, search, referenceTab = "gbt", standardFrameworkId = "mlps-level-3", standardTableId = "" }) {
    const normalizedSection = ["capability-directory", "scopes", "processes", "work-functions", "security-works", "services", "modules", "measures", "application-systems", "lcap-references", "references", "standards"].includes(section) ? section : "scopes";
    const normalizedReferenceTab = referenceTab === "gartner" ? "gartner" : "gbt";
    const maintenanceKnowledge = maintenance || management;
    const navigationItems = maintenanceNavigationItems(maintenanceKnowledge, normalizedSection, capabilityTree, lifecycle, standards);
    const pageMeta = maintenancePageMeta(normalizedSection);
    const sectionViewModel =
      normalizedSection === "capability-directory"
        ? buildCapabilityDirectoryViewModel({ capabilityTree, search })
      : normalizedSection === "scopes"
        ? buildScopeMaintenanceViewModel({ management: maintenanceKnowledge, search })
        : normalizedSection === "processes"
          ? buildProcessMaintenanceViewModel({ management: maintenanceKnowledge, search })
          : normalizedSection === "work-functions"
          ? buildWorkFunctionMaintenanceViewModel({ management: maintenanceKnowledge, search })
          : normalizedSection === "security-works"
          ? buildSecurityWorkMaintenanceViewModel({ capabilityTree, management: maintenanceKnowledge, search })
            : normalizedSection === "services"
              ? buildTechnicalServiceMaintenanceViewModel({ capabilityTree, management: maintenanceKnowledge, search })
              : normalizedSection === "modules"
                ? buildTechnologyModuleMaintenanceViewModel({ management: maintenanceKnowledge, search })
                : normalizedSection === "measures"
                  ? buildTechnicalMeasureMaintenanceViewModel({ management: maintenanceKnowledge, search })
                : normalizedSection === "lcap-references"
                  ? buildLifecycleReferenceMaintenanceViewModel({ lifecycle, search })
                : normalizedSection === "application-systems"
                  ? buildApplicationSystemDirectoryViewModel({ lifecycle, search })
                : normalizedSection === "references"
                  ? buildStandardRoleReferenceViewModel({ management: maintenanceKnowledge, search })
                  : normalizedSection === "standards"
                    ? buildStandardFrameworkViewModel({ standards, search, standardFrameworkId, standardTableId })
                  : { rows: [], summary: {}, emptyState: pageMeta.description };
    const selectableRows =
      normalizedSection === "references" ? (normalizedReferenceTab === "gartner" ? sectionViewModel.roleRows || [] : sectionViewModel.standardRows || []) : sectionViewModel.rows;
    const selection = resolveCurrentObjectSelection({
      rows: selectableRows,
      selectedId,
      grain: "maintenance_object",
      label: "知识库对象",
    });
    const selectedRow = selection.row;
    const sidecarSourceEvidence = selectedRow ? list(maintenanceKnowledge?.source_evidence_by_id?.[selectedRow.id]) : [];
    const sourceEvidence = sidecarSourceEvidence.length
      ? sidecarSourceEvidence
      : selectedRow && sectionViewModel.sourceEvidenceById
        ? list(sectionViewModel.sourceEvidenceById[selectedRow.id])
        : maintenanceSourceEvidence(maintenanceKnowledge, normalizedSection, selectedRow);
    const countFor = (id, fallback = 0) => {
      const counts = maintenanceKnowledge?.section_counts || maintenanceKnowledge?.maintenance_index?.section_counts || {};
      const value = counts[id];
      return Number.isFinite(Number(value)) ? Number(value) : fallback;
    };
    const tabCounts = {
      ...Object.fromEntries(navigationItems.map((item) => [item.id, item.count])),
      "references-gbt": countFor("references-gbt", list(maintenanceKnowledge?.gbt_42446_references).length),
      "references-gartner": countFor("references-gartner", list(maintenanceKnowledge?.gartner_roles).length),
    };
    const visibleRows = normalizedSection === "references" ? selectableRows : sectionViewModel.rows;
    return {
      section: normalizedSection,
      navigationItems,
      sectionTabs: maintenanceSectionTabs(normalizedSection, tabCounts, normalizedReferenceTab),
      capabilityGroups: sectionViewModel.capabilityGroups || [],
      serviceScopeGroups: sectionViewModel.serviceScopeGroups || [],
      page: pageMeta,
      summary: sectionViewModel.summary,
      rows: visibleRows,
      standardRows: sectionViewModel.standardRows || [],
      roleRows: sectionViewModel.roleRows || [],
      frameworkTabs: sectionViewModel.frameworkTabs || [],
      activeFrameworkId: sectionViewModel.activeFrameworkId || standardFrameworkId,
      activeStandardTableId: sectionViewModel.activeStandardTableId || standardTableId,
      activeFrameworkTitle: sectionViewModel.activeFrameworkTitle || "",
      columns: sectionViewModel.columns || [],
      tables: sectionViewModel.tables || [],
      summaryBadges: sectionViewModel.summaryBadges || [],
      summaryNote: sectionViewModel.summaryNote || "",
      softwareRows: sectionViewModel.softwareRows || [],
      applicationRows: sectionViewModel.applicationRows || [],
      referenceTab: normalizedReferenceTab,
      selection,
      selectedId: selectedRow?.id || null,
      detailPanel: buildMaintenanceDetailPanel(selectedRow, normalizedSection, sourceEvidence),
      sourceEvidence,
      dataState: sectionViewModel.dataState || "",
      emptyState: selection.status === "target_missing" ? selection.message : sectionViewModel.emptyState || "",
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

  function workbenchObjectRows(workbenchViewModel, type) {
    const rows = workbenchViewModel?.objects?.[type];
    return rows && typeof rows === "object" ? Object.values(rows) : [];
  }

  function buildEnvironmentManagementFromWorkbench(workbenchViewModel) {
    const directEnvironmentTree = list(workbenchViewModel?.environmentScopeTree);
    if (directEnvironmentTree.length) {
      const segmentObjects = new Map();
      const splitScopeLabel = (scope) => {
        const title = titleOf(scope, "").trim();
        const code = text(scope?.code).trim();
        if (code || !title) return [scope];
        const chunks = title
          .split(/(?=I-[A-Z]{2}\b)/g)
          .map((chunk) => chunk.trim())
          .filter(Boolean);
        const parsed = chunks
          .map((chunk) => {
            const match = chunk.match(/^(I-[A-Z]{2})\s*(.+)$/);
            if (!match) return null;
            return {
              ...scope,
              id: match[1],
              code: match[1],
              title: match[2].trim(),
              name: match[2].trim(),
            };
          })
          .filter(Boolean);
        return parsed.length ? parsed : [scope];
      };
      const normalizeEnvironmentObject = (object) => ({
        ...object,
        title: titleOf(object, "未命名对象"),
        segments: list(object.segments).map((segment) => ({ ...segment, title: titleOf(segment, "未定义环境子类") })),
        scope_mappings: list(object.scope_mappings).flatMap((mapping) =>
          splitScopeLabel(mapping.scope).map((scope) => ({
            ...mapping,
            scope,
            services: list(mapping.services).map((service) => ({
              ...service,
              title: titleOf(service, "未命名服务"),
              modules: list(service.modules),
              measures: list(service.measures).map((measure) => ({
                ...measure,
                type: "security_technical_measure",
                objectKind: "安全技术措施",
                kind: "安全技术措施",
                title: titleOf(measure, "未命名措施"),
              })),
            })),
          })),
        ),
      });
      const environment_scope_tree = directEnvironmentTree.map((environment) => {
        const objects = list(environment.objects).map(normalizeEnvironmentObject);
        for (const object of objects) {
          for (const segment of list(object.segments)) {
            if (!segment?.id) continue;
            segmentObjects.set(segment.id, uniqueBy([...(segmentObjects.get(segment.id) || []), object], (item) => item.id || item.title));
          }
        }
        return {
          ...environment,
          title: titleOf(environment, "未命名环境"),
          objects,
        };
      });
      return {
        environment_scope_tree,
        service_module_index: [],
        security_technical_measures: workbenchObjectRows(workbenchViewModel, "security_technical_measure"),
        segmentObjects,
      };
    }
    const objects = workbenchViewModel?.objects || {};
    const relations = list(workbenchViewModel?.relations);
    const byType = (type) => (objects[type] && typeof objects[type] === "object" ? objects[type] : {});
    const entity = (type, id) => byType(type)[id] || null;
    const relationsOf = (type) => relations.filter((relation) => relation.type === type);
    const scopeByCode = new Map(workbenchObjectRows(workbenchViewModel, "scope_type").map((scope) => [text(scope.code || scope.title).trim(), scope]));
    const segmentObjects = new Map();
    const environmentRows = new Map();

    const ensureEnvironment = (environmentLike) => {
      const environment = entity("information_environment", environmentLike?.id) || environmentLike;
      if (!environment?.id) return null;
      if (!environmentRows.has(environment.id)) {
        environmentRows.set(environment.id, {
          ...environment,
          title: titleOf(environment, "未命名环境"),
          objectsMap: new Map(),
        });
      }
      return environmentRows.get(environment.id);
    };

    const addObjectToEnvironment = (environmentLike, segmentLike, objectLike) => {
      const environment = ensureEnvironment(environmentLike);
      const object = entity("information_object", objectLike?.id) || objectLike;
      if (!environment || !object?.id) return;
      const segment = entity("environment_segment", segmentLike?.id) || segmentLike || {
        id: `${environment.id}:segment:unclassified`,
        title: "未定义环境子类",
      };
      const row =
        environment.objectsMap.get(object.id) || {
          ...object,
          title: titleOf(object, "未命名对象"),
          segments: [],
          scope_mappings: [],
        };
      if (segment?.id || segment?.title) {
        row.segments = uniqueBy([...list(row.segments), { ...segment, title: titleOf(segment, "未定义环境子类") }], (item) => item.id || item.title);
        if (segment?.id) {
          segmentObjects.set(segment.id, uniqueBy([...(segmentObjects.get(segment.id) || []), row], (item) => item.id || item.title));
        }
      }
      environment.objectsMap.set(object.id, row);
    };

    for (const environmentNode of list(workbenchViewModel?.navigatorData?.tree)) {
      for (const segmentNode of list(environmentNode.children)) {
        for (const objectNode of list(segmentNode.children)) {
          addObjectToEnvironment(environmentNode, segmentNode, objectNode);
        }
      }
    }

    if (!environmentRows.size) {
      for (const relation of relationsOf("contains_object")) {
        const segment = entity("environment_segment", relation.sourceId);
        const object = entity("information_object", relation.targetId);
        const environmentRelation = relationsOf("contains_segment").find((item) => item.targetId === relation.sourceId);
        const environment = entity("information_environment", environmentRelation?.sourceId);
        addObjectToEnvironment(environment, segment, object);
      }
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
      serviceModules.set(relation.sourceId, uniqueBy([...(serviceModules.get(relation.sourceId) || []), measure], (item) => item.id || item.code || item.title));
    }

    const moduleSystems = new Map();
    for (const relation of relationsOf("part_of_system")) {
      const system = entity("security_system", relation.targetId);
      if (!relation.sourceId || !system) continue;
      moduleSystems.set(relation.sourceId, uniqueBy([...(moduleSystems.get(relation.sourceId) || []), system], (item) => item.id || item.title));
    }
    const moduleProducts = new Map();
    for (const relation of relationsOf("maps_to_product")) {
      const product = entity("product", relation.targetId);
      if (!relation.sourceId || !product) continue;
      moduleProducts.set(relation.sourceId, uniqueBy([...(moduleProducts.get(relation.sourceId) || []), product], (item) => item.id || item.title));
    }

    const decorateService = (service) => ({
      ...service,
      title: titleOf(service, "未命名服务"),
      modules: list(serviceModules.get(service.id)).map((module) => ({
        ...module,
        systems: list(moduleSystems.get(module.id)),
        products: list(moduleProducts.get(module.id)),
      })),
    });

    const serviceMatchesScope = (service, scope) => {
      const scopeCode = text(scope?.code).trim();
      const scopeTitle = text(scope?.title || scope?.name).trim();
      const serviceCategory = text(service?.category).trim();
      const serviceCode = text(service?.code).trim();
      if (scopeCode && (serviceCategory === scopeCode || serviceCode.startsWith(`${scopeCode}&`) || serviceCode.startsWith(`${scopeCode}-`))) return true;
      if (scopeTitle && serviceCategory === scopeTitle) return true;
      return !scopeCode && !scopeTitle;
    };

    const scopesForObject = (object) =>
      uniqueBy(
        relationsOf("applies_to_scope")
          .filter((relation) => relation.sourceId === object.id)
          .map((relation) => entity("scope_type", relation.targetId))
          .filter(Boolean),
        (scope) => scope.id || scope.code || scope.title,
      );

    const servicesForObject = (object) =>
      uniqueBy(
        relationsOf("protects_object")
          .filter((relation) => relation.targetId === object.id)
          .map((relation) => entity("security_technical_service", relation.sourceId))
          .filter(Boolean),
        (service) => service.id || service.code || service.title,
      );

    for (const environment of environmentRows.values()) {
      for (const object of environment.objectsMap.values()) {
        const scopes = scopesForObject(object);
        const services = servicesForObject(object);
        const derivedScopes = scopes.length
          ? scopes
          : uniqueBy(services.map((service) => scopeByCode.get(text(service.category).trim())).filter(Boolean), (scope) => scope.id || scope.code || scope.title);
        object.scope_mappings = derivedScopes.map((scope) => ({
          scope,
          services: services.filter((service) => serviceMatchesScope(service, scope)).map(decorateService),
        }));
        object.scope_count = object.scope_mappings.length;
        object.service_count = uniqueBy(object.scope_mappings.flatMap((mapping) => mapping.services), (service) => service.id || service.code || service.title).length;
        object.module_count = uniqueBy(object.scope_mappings.flatMap((mapping) => list(mapping.services).flatMap((service) => list(service.modules))), (module) => module.id || module.code || module.title).length;
      }
    }

    return {
      environment_scope_tree: [...environmentRows.values()].map((environment) => ({
        ...environment,
        objects: [...environment.objectsMap.values()].sort((left, right) => titleOf(left).localeCompare(titleOf(right), "zh-Hans-CN")),
      })),
      service_module_index: [...serviceModules.entries()].map(([serviceId, modules]) => ({
        service: entity("security_technical_service", serviceId),
        modules,
      })),
      security_technical_measures: workbenchObjectRows(workbenchViewModel, "security_technical_measure"),
      segmentObjects,
    };
  }

  function buildEnvironmentNavigationTree(management, search) {
    const query = normalizeSearch(search);
    const relationNodeKey = (item) => [item?.id, item?.code, item?.title, item?.name, item?.objectKind, item?.type].filter(Boolean).join("::");
    const environmentObjectServices = (object) => list(object?.scope_mappings).flatMap((mapping) => list(mapping.services));
    const environmentObjectRelationNodes = (object) =>
      uniqueBy(
        environmentObjectServices(object).flatMap((service) => [
          ...list(service.modules).map((module) => compactTechnicalObject(module, isSecurityTechnicalMeasure(module) ? "安全技术措施" : "安全技术模块")),
          ...list(service.measures).map((measure) => compactTechnicalObject({ ...measure, type: "security_technical_measure" }, "安全技术措施")),
          ...list(service.relationNodes).map((node) => compactTechnicalObject(node, isSecurityTechnicalMeasure(node) ? "安全技术措施" : "安全技术模块")),
        ]),
        relationNodeKey,
      );
    const environmentObjectSecuritySystems = (object) => {
      const services = environmentObjectServices(object);
      const relationNodes = environmentObjectRelationNodes(object);
      return uniqueBy(
        [
          ...list(object?.securitySystems),
          ...list(object?.systems),
          ...list(object?.linkedSystems),
          ...services.flatMap((service) => [...list(service.securitySystems), ...list(service.systems), ...list(service.linkedSystems)]),
          ...relationNodes.flatMap((node) => [...list(node.securitySystems), ...list(node.systems), ...list(node.linkedSystems)]),
        ].map(compactEntity).filter(Boolean),
        (system) => system?.id || system?.code || system?.title,
      );
    };
    const environmentObjectSearchValues = (environment, object) => [
      environment?.id,
      environment?.code,
      environment?.title,
      environment?.description,
      object?.id,
      object?.code,
      object?.title,
      object?.description,
      ...list(object?.segments).flatMap((segment) => [segment?.id, segment?.code, segment?.title, segment?.description]),
      ...list(object?.scope_mappings).flatMap((mapping) => [mapping?.scope?.id, mapping?.scope?.code, mapping?.scope?.title, mapping?.scope?.description]),
      ...environmentObjectServices(object).flatMap((service) => [service?.id, service?.code, service?.title, service?.name, codeTitle(service)]),
      ...environmentObjectRelationNodes(object).flatMap((node) => [node?.id, node?.code, node?.title, node?.name, node?.objectKind, node?.kind, codeTitle(node)]),
      ...environmentObjectSecuritySystems(object).flatMap((system) => [system?.id, system?.code, system?.title, system?.name, codeTitle(system)]),
    ];
    const environmentObjectMatchesSearch = (environment, object) => includesSearch(query, ...environmentObjectSearchValues(environment, object));
    return list(management?.environment_scope_tree)
      .map((environment) => {
        const objects = list(environment.objects)
          .filter((object) => environmentObjectMatchesSearch(environment, object))
          .map((object) => {
            const relationNodes = environmentObjectRelationNodes(object);
            return {
              id: object.id,
              environmentId: environment.id,
              type: "information_object",
              title: titleOf(object, "未命名对象"),
              description: object.description || "",
              segments: list(object.segments),
              scopeCount: Number(object.scope_count ?? list(object.scope_mappings).length) || 0,
              serviceCount: Number(object.service_count ?? 0) || 0,
              moduleCount: Number(object.module_count ?? relationNodes.length) || 0,
              relationNodes,
              searchText: environmentObjectSearchValues(environment, object).map(text).join(" "),
            };
          });
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
    const relationNodeKey = (item) => [item?.id, item?.code, item?.title, item?.name, item?.objectKind, item?.type].filter(Boolean).join("::");
    const environmentObjectServices = (object) => list(object?.scope_mappings).flatMap((mapping) => list(mapping.services));
    const environmentObjectRelationNodes = (object) =>
      uniqueBy(
        environmentObjectServices(object).flatMap((service) => [
          ...list(service.modules).map((module) => compactTechnicalObject(module, isSecurityTechnicalMeasure(module) ? "安全技术措施" : "安全技术模块")),
          ...list(service.measures).map((measure) => compactTechnicalObject({ ...measure, type: "security_technical_measure" }, "安全技术措施")),
          ...list(service.relationNodes).map((node) => compactTechnicalObject(node, isSecurityTechnicalMeasure(node) ? "安全技术措施" : "安全技术模块")),
        ]),
        relationNodeKey,
      );
    const environmentObjectSecuritySystems = (object) => {
      const services = environmentObjectServices(object);
      const relationNodes = environmentObjectRelationNodes(object);
      return uniqueBy(
        [
          ...list(object?.securitySystems),
          ...list(object?.systems),
          ...list(object?.linkedSystems),
          ...services.flatMap((service) => [...list(service.securitySystems), ...list(service.systems), ...list(service.linkedSystems)]),
          ...relationNodes.flatMap((node) => [...list(node.securitySystems), ...list(node.systems), ...list(node.linkedSystems)]),
        ].map(compactEntity).filter(Boolean),
        (system) => system?.id || system?.code || system?.title,
      );
    };
    const environmentObjectMatchesSearch = (environment, object) =>
      includesSearch(
        query,
        environment?.id,
        environment?.code,
        environment?.title,
        environment?.description,
        object?.id,
        object?.code,
        object?.title,
        object?.description,
        ...list(object?.segments).flatMap((segment) => [segment?.id, segment?.code, segment?.title, segment?.description]),
        ...list(object?.scope_mappings).flatMap((mapping) => [mapping?.scope?.id, mapping?.scope?.code, mapping?.scope?.title, mapping?.scope?.description]),
        ...environmentObjectServices(object).flatMap((service) => [service?.id, service?.code, service?.title, service?.name, codeTitle(service)]),
        ...environmentObjectRelationNodes(object).flatMap((node) => [node?.id, node?.code, node?.title, node?.name, node?.objectKind, node?.kind, codeTitle(node)]),
        ...environmentObjectSecuritySystems(object).flatMap((system) => [system?.id, system?.code, system?.title, system?.name, codeTitle(system)]),
      );
    const environments = list(management?.environment_scope_tree)
      .map((environment) => {
        const objects = list(environment.objects).filter((object) => environmentObjectMatchesSearch(environment, object));
        return { environment, objects };
      })
      .filter((row) => row.objects.length || includesSearch(query, row.environment.title, row.environment.description));
    const objectSelection = environments
      .flatMap(({ environment, objects }) => objects.map((object) => ({ selectionType: "object", environment, object, objects })))
      .find((row) => row.object.id === selectedObjectId);
    if (objectSelection) return { ...objectSelection, selectionSource: "explicit" };
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
    if (segmentSelection) return { ...segmentSelection, selectionSource: "explicit" };
    const environmentSelection = environments.find((row) => row.environment.id === selectedEnvironmentId);
    if (environmentSelection) return { selectionType: "environment", selectionSource: "explicit", environment: environmentSelection.environment, object: null, objects: environmentSelection.objects };
    if (!query) return null;
    const fallback = environments[0];
    if (!fallback) return null;
    const object = fallback.objects[0] || null;
    return object
      ? { selectionType: "object", selectionSource: "search", environment: fallback.environment, object, objects: fallback.objects }
      : { selectionType: "environment", selectionSource: "search", environment: fallback.environment, object: null, objects: fallback.objects };
  }

  function buildEnvironmentScopeServiceRows(management, selectedObject, showObjectColumn, selectedEnvironment) {
    if (!selectedObject) return [];
    const environment = selectedEnvironment ? compactEntity(selectedEnvironment, "未命名环境") : null;
    const objectScopes = uniqueBy(
      list(selectedObject.scope_mappings).map((mapping) => compactEntity(mapping.scope, "未命名作用域")).filter(Boolean),
      (scope) => scope.code || scope.id || scope.title,
    );
    const segments = list(selectedObject.segments).map(compactEntity);
    const baseForObject = () => ({
      environment,
      object: compactEntity(selectedObject, "未命名对象"),
      segments,
      scopes: objectScopes,
      scope: objectScopes[0] || null,
    });
    const rowId = (scope, service, index) =>
      [
        selectedObject.id,
        scope?.id || scope?.code || scope?.title || "scope",
        service?.id || service?.code || service?.title || "service",
        index,
      ]
        .filter(Boolean)
        .join("::");

    const compactSystem = (system) => compactEntity(system, "未命名安全系统");
    const compactProduct = (product) => compactEntity(product, "未命名产品");
    const relationNodeKey = (item) => [item?.id, item?.code, item?.title, item?.name, item?.objectKind, item?.type].filter(Boolean).join("::");
    const serviceKey = (service) => service?.code || service?.id || service?.title || service?.name;
    const enrichRelationNode = (item, fallbackKind, context = {}) => {
      const objectKind = item?.objectKind || item?.kind || fallbackKind;
      const relationKind = objectKind.includes("措施") ? "measure" : "module";
      return {
        ...item,
        objectKind,
        kind: objectKind,
        relationKind,
        measures: uniqueBy(list(item?.measures).map((measure) => compactTechnicalObject({ ...measure, type: "security_technical_measure" }, "安全技术措施")), relationNodeKey),
        securitySystems: uniqueBy(
          [
            ...list(item?.systems),
            ...list(item?.linkedSystems),
            ...list(item?.securitySystems),
          ].map(compactSystem),
          (system) => system?.id || system?.code || system?.title,
        ),
        products: uniqueBy(
          [
            ...list(item?.products),
            ...list(item?.linkedProducts),
            ...list(context?.products),
            ...list(context?.linkedProducts),
          ].map(compactProduct),
          (product) => product?.id || product?.code || product?.title,
        ),
      };
    };
    const rawServiceRelationNodes = (service) => {
      const moduleObjects = list(service.modules)
        .filter((item) => !isSecurityTechnicalMeasure(item))
        .map((module) => enrichRelationNode(compactTechnicalObject(module, "安全技术模块"), "安全技术模块", service));
      const moduleMeasures = list(service.modules)
        .filter(isSecurityTechnicalMeasure)
        .map((measure) => enrichRelationNode(compactTechnicalObject({ ...measure, type: "security_technical_measure" }, "安全技术措施"), "安全技术措施", service));
      const directMeasures = list(service.measures)
        .map((measure) => enrichRelationNode(compactTechnicalObject({ ...measure, type: "security_technical_measure" }, "安全技术措施"), "安全技术措施", service));
      return [...moduleObjects, ...moduleMeasures, ...directMeasures];
    };
    const exactRelationKey = (service, relationNode) =>
      [
        service?.code || service?.id || service?.title,
        relationNode?.id || relationNode?.code || relationNode?.title,
        relationNode?.objectKind || relationNode?.type,
        list(relationNode?.measures).map(relationNodeKey).sort().join("|"),
        list(relationNode?.securitySystems).map((system) => system?.id || system?.code || system?.title).sort().join("|"),
        list(relationNode?.products).map((product) => product?.id || product?.code || product?.title).sort().join("|"),
      ].join("::");

    const base = baseForObject();
    const rows = [];
    let index = 0;
    for (const mapping of list(selectedObject.scope_mappings)) {
      const scope = compactEntity(mapping.scope, "未命名作用域");
      const services = uniqueBy(list(mapping.services), serviceKey);
      if (!services.length) {
        rows.push({
          id: rowId(scope, null, index++),
          ...base,
          scopes: scope ? [scope] : objectScopes,
          scope: scope || objectScopes[0] || null,
          services: [],
          service: null,
          securitySystems: [],
          products: [],
          modules: [],
          measures: [],
          relationNodes: [],
          relationType: "none",
          exactDuplicateCount: 0,
          coverageStatus: "不适用",
          note: "该作用域无适用安全技术服务。",
        });
        continue;
      }
      for (const service of services) {
        const compactService = compactEntity(service, "未命名服务");
        const rawRelationNodes = rawServiceRelationNodes(service);
        const relationNodes = uniqueBy(rawRelationNodes, relationNodeKey);
        const exactSeen = new Set();
        let exactDuplicateCount = 0;
        for (const node of rawRelationNodes) {
          const key = exactRelationKey(compactService, node);
          if (exactSeen.has(key)) exactDuplicateCount += 1;
          exactSeen.add(key);
        }
        const modules = uniqueBy(relationNodes.filter((item) => item.relationKind !== "measure"), relationNodeKey);
        const measures = uniqueBy(
          [
            ...relationNodes.filter((item) => item.relationKind === "measure"),
            ...relationNodes.flatMap((item) => list(item.measures)),
          ],
          relationNodeKey,
        );
        const securitySystems = uniqueBy(
          [
            ...list(service.systems || service.linkedSystems || service.securitySystems).map(compactSystem),
            ...relationNodes.flatMap((item) => list(item.securitySystems)),
          ],
          (system) => system?.id || system?.code || system?.title,
        );
        const products = uniqueBy(relationNodes.flatMap((item) => list(item.products)), (product) => product?.id || product?.code || product?.title);
        rows.push({
          id: rowId(scope, compactService, index++),
          ...base,
          scopes: scope ? [scope] : objectScopes,
          scope: scope || objectScopes[0] || null,
          services: [compactService],
          service: compactService,
          securitySystems,
          products,
          modules,
          measures,
          relationNodes,
          relationType: relationNodes.length > 1 ? "one_to_many" : relationNodes.length === 1 ? "one_to_one" : "no_relation",
          exactDuplicateCount,
          coverageStatus: relationNodes.length ? "已覆盖" : "无模块/措施映射",
          note: relationNodes.length ? "服务唯一显示，右侧聚合模块 / 措施 / 系统。" : "已有安全技术服务，未形成模块 / 措施映射。",
        });
      }
    }
    if (!rows.length) {
      return [
        {
          id: rowId(null, null, 0),
          ...base,
          services: [],
          service: null,
          securitySystems: [],
          products: [],
          modules: [],
          measures: [],
          relationNodes: [],
          relationType: "none",
          exactDuplicateCount: 0,
          coverageStatus: "不适用",
          note: "该对象无适用安全技术服务。",
        },
      ];
    }
    return rows;
  }

  function buildEnvironmentScopeServiceGroups(rows) {
    const relationNodeKey = (item) => [item?.id, item?.code, item?.title, item?.name, item?.objectKind, item?.type].filter(Boolean).join("::");
    const serviceKey = (service) => service?.code || service?.id || service?.title || service?.name;
    const objectKey = (row, index) => row?.object?.id || row?.object?.code || row?.object?.title || `environment-object:${index}`;
    const groupsByKey = new Map();
    const serviceScopesByGroup = new Map();

    const ensureGroup = (row, index) => {
      const key = objectKey(row, index);
      if (!groupsByKey.has(key)) {
        const object = row?.object || {
          id: key,
          title: "当前信息化对象",
        };
        groupsByKey.set(key, {
          id: key,
          objectKey: key,
          environment: row?.environment || null,
          object,
          objectTitle: titleOf(object, "当前信息化对象"),
          segments: [],
          scopes: [],
          services: [],
          modules: [],
          edges: [],
          exactDuplicateCount: 0,
          emptyScopeCount: 0,
        });
      }
      const group = groupsByKey.get(key);
      if (!group.environment && row?.environment) group.environment = row.environment;
      return group;
    };

    const addUnique = (items, item, keyFn) => {
      if (!item) return;
      const key = keyFn(item);
      if (!key || items.some((row) => keyFn(row) === key)) return;
      items.push(item);
    };

    for (const [index, row] of list(rows).entries()) {
      const group = ensureGroup(row, index);
      const currentObjectKey = group.objectKey;
      if (!serviceScopesByGroup.has(currentObjectKey)) serviceScopesByGroup.set(currentObjectKey, new Map());
      const serviceScopes = serviceScopesByGroup.get(currentObjectKey);
      const rowScopes = list(row.scopes).length ? list(row.scopes) : [row.scope];
      for (const segment of list(row.segments)) addUnique(group.segments, segment, (item) => item.id || item.code || item.title);
      for (const scope of rowScopes) addUnique(group.scopes, scope, (item) => item?.code || item?.id || item?.title);
      group.exactDuplicateCount += Number(row.exactDuplicateCount || 0);
      if (!list(row.services).length) group.emptyScopeCount += 1;

      for (const service of list(row.services)) {
        const currentServiceKey = serviceKey(service);
        addUnique(group.services, service, serviceKey);
        if (currentServiceKey) {
          const existingScopes = serviceScopes.get(currentServiceKey) || [];
          for (const scope of rowScopes) addUnique(existingScopes, scope, (item) => item?.code || item?.id || item?.title);
          serviceScopes.set(currentServiceKey, existingScopes);
        }
        const relationNodes = list(row.relationNodes).length ? list(row.relationNodes) : [...list(row.modules), ...list(row.measures)];
        for (const module of relationNodes) {
          const currentModuleKey = relationNodeKey(module);
          addUnique(group.modules, module, relationNodeKey);
          if (!currentServiceKey || !currentModuleKey) continue;
          const edgeKey = `${currentServiceKey}::${currentModuleKey}`;
          if (group.edges.some((edge) => edge.edgeKey === edgeKey)) continue;
          group.edges.push({
            edgeKey,
            serviceKey: currentServiceKey,
            moduleKey: currentModuleKey,
            service,
            module,
          });
        }
      }
    }

    return [...groupsByKey.values()].map((group) => {
      const serviceLinkCounts = new Map();
      const moduleLinkCounts = new Map();
      for (const edge of group.edges) {
        serviceLinkCounts.set(edge.serviceKey, (serviceLinkCounts.get(edge.serviceKey) || 0) + 1);
        moduleLinkCounts.set(edge.moduleKey, (moduleLinkCounts.get(edge.moduleKey) || 0) + 1);
      }
      const defaultFocusServiceKey =
        [...serviceLinkCounts.entries()].sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0], "zh-Hans-CN"))[0]?.[0] || "";
      return {
        ...group,
        services: group.services.map((service) => {
          const key = serviceKey(service);
          return {
            ...service,
            scopes: serviceScopesByGroup.get(group.objectKey)?.get(key) || [],
            relationCount: serviceLinkCounts.get(key) || 0,
            relationType: (serviceLinkCounts.get(key) || 0) > 1 ? "one_to_many" : "one_to_one",
            isDefaultFocus: key === defaultFocusServiceKey,
          };
        }),
        modules: group.modules.map((module) => {
          const key = relationNodeKey(module);
          return {
            ...module,
            relationCount: moduleLinkCounts.get(key) || 0,
            relationType: (moduleLinkCounts.get(key) || 0) > 1 ? "many_to_one" : "one_to_one",
          };
        }),
        oneToManyCount: [...serviceLinkCounts.values()].filter((count) => count > 1).length,
        manyToOneCount: [...moduleLinkCounts.values()].filter((count) => count > 1).length,
        defaultFocusServiceKey,
      };
    });
  }

  function buildEnvironmentLocalRelationNotes({ selectionType, selectedEnvironment, selectedSegment, selectedObject, summary, detailPanel }) {
    const scopeSubject = selectionType === "environment" ? "当前环境下的信息化对象" : selectionType === "segment" ? "当前环境子类下的信息化对象" : "当前信息化对象";
    const segmentText = list(detailPanel.segments).length ? list(detailPanel.segments).map(titleOf).join("、") : "暂无环境子类";
    return [
      {
        title: "关系主链路",
        body: `${scopeSubject} 先合并信息化对象的唯一作用域，再按“安全技术服务 → 安全技术模块 / 措施 → 安全系统”展示；同一模块 / 措施下合并关联服务，避免把作用域与技术链路做笛卡尔展开。`,
      },
      {
        title: "覆盖口径",
        body: `共 ${summary.scopeCount} 个作用域、${summary.serviceCount} 个安全技术服务、${summary.systemCount} 个安全系统、${summary.moduleCount} 个安全技术模块、${summary.measureCount} 个安全技术措施；${summary.notApplicableCount} 个作用域无适用服务。`,
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
    const environmentManagement = management || buildEnvironmentManagementFromWorkbench(environmentWorkbenchViewModel);
    const dataSource = workbenchDataSource({
      workbench: environmentWorkbench,
      workbenchViewModel: environmentWorkbenchViewModel,
      workbenchName: "environment-workbench.json",
      fallbackName: "environment-workbench.json",
    });
    const navigationTree = buildEnvironmentNavigationTree(environmentManagement, search);
    const topologyTree = buildEnvironmentNavigationTree(environmentManagement, "");
    const selected = findEnvironmentSelection(environmentManagement, selectedObjectId, selectedEnvironmentId, selectedSegmentId, search);
    const selectedEnvironment = compactEntity(selected?.environment, "未命名环境");
    const selectedSegment = selected?.segment ? compactEntity(selected.segment, "未定义环境子类") : null;
    const selectedObject = selected?.object ? compactEntity(selected.object, "未命名对象") : null;
    const selectionSource = selected?.selectionSource || "";
    const isEnvironmentSelection = selected?.selectionType === "environment";
    const isSegmentSelection = selected?.selectionType === "segment";
    const scopeServiceRows = isEnvironmentSelection
      ? list(selected?.objects).flatMap((object) => buildEnvironmentScopeServiceRows(environmentManagement, object, true, selected?.environment))
      : isSegmentSelection
        ? list(selected?.objects).flatMap((object) => buildEnvironmentScopeServiceRows(environmentManagement, object, true, selected?.environment))
      : buildEnvironmentScopeServiceRows(environmentManagement, selected?.object, false, selected?.environment);
    const scopeServiceGroups = buildEnvironmentScopeServiceGroups(scopeServiceRows);
    const summary = {
      objectCount: uniqueBy(navigationTree.flatMap((environment) => list(environment.objects)), (object) => object.id || object.title).length,
      selectedObjectCount: isEnvironmentSelection || isSegmentSelection ? list(selected?.objects).length : selectedObject ? 1 : 0,
      scopeCount: uniqueBy(scopeServiceRows.flatMap((row) => (list(row.scopes).length ? list(row.scopes) : [row.scope])), (scope) => scope?.id || scope?.code || scope?.title).length,
      serviceCount: uniqueBy(scopeServiceRows.flatMap((row) => row.services), (service) => service.id || service.code || service.title).length,
      moduleCount: uniqueBy(scopeServiceRows.flatMap((row) => row.modules), (module) => module.id || module.code || module.title).length,
      measureCount: uniqueBy(scopeServiceRows.flatMap((row) => row.measures), (measure) => measure.id || measure.code || measure.title).length,
      systemCount: uniqueBy(scopeServiceRows.flatMap((row) => row.securitySystems), (system) => system.id || system.code || system.title).length,
      notApplicableCount: scopeServiceRows.filter((row) => !row.services.length).length,
      missingModuleCount: scopeServiceRows.filter((row) => row.services.length && !row.modules.length && !row.measures.length).length,
    };
    const detailPanel = {
      environment: selectedEnvironment,
      segment: selectedSegment,
      object: selectedObject,
      selectionType: selected?.selectionType || "",
      selectionSource,
      showObjectColumn: isEnvironmentSelection || isSegmentSelection,
      segments: isEnvironmentSelection || isSegmentSelection
        ? uniqueBy(list(selected?.objects).flatMap((object) => list(object.segments)), (segment) => segment?.id || segment?.code || segment?.title).map(compactEntity)
        : list(selected?.object?.segments).map(compactEntity),
      scopeCount: summary.scopeCount,
      serviceCount: summary.serviceCount,
      moduleCount: summary.moduleCount,
      measureCount: summary.measureCount,
      systemCount: summary.systemCount,
      description: selected?.object?.description || selected?.environment?.description || "暂无说明",
    };
    return {
      navigationTree,
      topologyTree,
      selectedEnvironment,
      selectedSegment,
      selectedObject,
      selectedMode: selected?.selectionType || "",
      selectionSource,
      relationshipSummary: summary,
      scopeServiceRows,
      scopeServiceGroups,
      detailPanel,
      localRelationNotes: buildEnvironmentLocalRelationNotes({ selectionType: selected?.selectionType, selectedEnvironment, selectedSegment, selectedObject, summary, detailPanel }),
      sourceEvidence: environmentSourceEvidence(selected?.environment, selected?.object, selected?.objects),
      dataSource,
      workbenchViewModel: environmentWorkbenchViewModel || null,
      environmentGraphContext: {
        selectionType: selected?.selectionType || "",
        selectionSource,
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
        scopeServiceGroups,
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
        ...list(process?.development_technical_services).flatMap((item) => list(item?.sources)),
        ...list(process?.development_technical_modules).flatMap((item) => list(item?.sources)),
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
      lifecycleType: item?.lifecycleType || item?.lifecycle_type || item?.metadata?.lifecycle_type || "",
      objectKind: item?.objectKind || item?.object_kind || "",
      originalBusinessFields: item?.originalBusinessFields || item?.original_business_fields || item?.metadata?.original_business_fields || {},
    };
  }

  function compactLifecycleActivity(item) {
    const compact = compactLifecycleItem(item);
    if (!compact) return compact;
    return {
      ...compact,
      title: businessText(compact.description || compact.title),
    };
  }

  function lifecycleServiceCategory(service) {
    return businessText(service?.service_category || service?.metadata?.service_category, "安全技术服务");
  }

  function lifecycleProcessServices(process) {
    return {
      developmentServices: list(process?.development_technical_services),
      securityServices: list(process?.technical_services),
    };
  }

  function lifecycleFieldText(value) {
    if (Array.isArray(value)) return value.map(lifecycleFieldText).filter(Boolean).join("\n");
    if (value && typeof value === "object") return titleOf(value, "");
    return text(value).trim();
  }

  function lifecycleFieldListText(items) {
    return list(items).map(lifecycleFieldText).filter(Boolean).join("\n");
  }

  function lifecycleFieldLines(value) {
    const raw = lifecycleFieldText(value);
    if (!raw || raw === "/") return [];
    return raw
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
  }

  function lifecycleOriginalBusinessFields(stage) {
    return stage?.originalBusinessFields || stage?.original_business_fields || stage?.metadata?.original_business_fields || {};
  }

  function lifecycleOriginalField(stage, key, fallbackItems = []) {
    const fields = lifecycleOriginalBusinessFields(stage);
    const raw = lifecycleFieldText(fields[key]);
    if (raw) return raw;
    return lifecycleFieldListText(fallbackItems);
  }

  function typedLifecycleSecurityTechnologyItems(stage, modules, measures) {
    const sourceLines = lifecycleFieldLines(lifecycleOriginalBusinessFields(stage)["安全技术模块"]);
    const moduleItems = list(modules);
    const measureItems = list(measures);
    if (!sourceLines.length) return [...moduleItems, ...measureItems];
    const moduleNames = moduleItems.map((item) => titleOf(item, "")).filter(Boolean);
    const measureNames = measureItems.map((item) => titleOf(item, "")).filter(Boolean);
    const matchesNamedObject = (line, names) => names.some((name) => line === name || line.startsWith(`${name}（`) || line.startsWith(`${name}(`));
    return sourceLines.map((line) => {
      const isMeasure = matchesNamedObject(line, measureNames);
      const isModule = matchesNamedObject(line, moduleNames);
      return {
        title: line,
        name: line,
        objectKind: isMeasure && !isModule ? "安全技术措施" : "安全技术模块",
      };
    });
  }

  function softwareDevelopmentTypeDefinitionMap(lifecycle) {
    const types = list(lifecycle?.application_security_development?.software_development_types);
    return new Map(
      types
        .map((item) => [titleOf(item, ""), businessText(item?.description || item?.definition || item?.metadata?.definition || "", "")])
        .filter(([title, description]) => title && description),
    );
  }

  function appendSoftwareDevelopmentTypeDefinitions(value, definitionMap) {
    const raw = lifecycleFieldText(value);
    if (!raw || !definitionMap?.size) return raw;
    return raw
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const description = definitionMap.get(line);
        return description ? `${line}：${description}` : line;
      })
      .join("\n");
  }

  function buildLifecycleOriginalFieldRows(selectedStageRow, softwareDefinitionMap = new Map()) {
    if (!selectedStageRow) return [];
    const technicalServices = list(selectedStageRow.technicalServices).map((service) => [service?.code, titleOf(service, "")].filter(Boolean).join(" "));
    const originalModuleFallback = [...list(selectedStageRow.technologyModules), ...list(selectedStageRow.technicalMeasures)];
    const typedSecurityTechnologyItems = typedLifecycleSecurityTechnologyItems(selectedStageRow, selectedStageRow.technologyModules, selectedStageRow.technicalMeasures);
    const developmentTypes = lifecycleOriginalField(selectedStageRow, "软件开发模式", selectedStageRow.developmentTypes);
    return [
      {
        id: `${selectedStageRow.id}:original-business-fields`,
        stageId: selectedStageRow.id || "",
        stageCode: selectedStageRow.code || "",
        stageTitle: selectedStageRow.title || "",
        stageGoal: lifecycleOriginalField(selectedStageRow, "阶段目标", [selectedStageRow.goal]),
        mainActivity: lifecycleOriginalField(selectedStageRow, "阶段主要活动（L4流程活动）", selectedStageRow.mainActivities),
        mainActivityReference: lifecycleOriginalField(selectedStageRow, "阶段主要活动参考来源"),
        securityActivities: lifecycleOriginalField(selectedStageRow, "安全活动定义", selectedStageRow.securityActivities),
        policyRequirements: lifecycleOriginalField(selectedStageRow, "安全活动对应安全策略", selectedStageRow.policyRequirements),
        policyReference: lifecycleOriginalField(selectedStageRow, "安全活动参考来源"),
        developmentTypes: appendSoftwareDevelopmentTypeDefinitions(developmentTypes, softwareDefinitionMap),
        developmentServices: lifecycleOriginalField(selectedStageRow, "开发技术服务", selectedStageRow.developmentServices),
        developmentModules: lifecycleOriginalField(selectedStageRow, "实际产品示例", selectedStageRow.developmentModules),
        threatScenarios: lifecycleOriginalField(selectedStageRow, "潜在安全威胁场景"),
        supplementalPolicies: lifecycleOriginalField(selectedStageRow, "补充安全策略"),
        technicalServices: lifecycleOriginalField(selectedStageRow, "安全技术服务", technicalServices),
        technologyModules: typedSecurityTechnologyItems,
      },
    ];
  }

  function buildDataLifecycleOriginalFieldRows(selectedStageRow) {
    if (!selectedStageRow) return [];
    const technicalModules = [...list(selectedStageRow.technologyModules), ...list(selectedStageRow.technicalMeasures)];
    return [
      {
        id: `${selectedStageRow.id}:data-lifecycle-fields`,
        stageId: selectedStageRow.id || "",
        stageCode: selectedStageRow.code || "",
        stageTitle: selectedStageRow.title || "",
        processDefinition: selectedStageRow.description || selectedStageRow.goal || "",
        scenes: list(selectedStageRow.scenes).map((scene) => ({
          id: scene?.id || scene?.code || titleOf(scene, ""),
          code: scene?.code || "",
          title: titleOf(scene, ""),
          description: businessText(scene?.description, ""),
        })),
        technicalServices: list(selectedStageRow.technicalServices),
        technologyModules: technicalModules,
      },
    ];
  }

  function compactDataLifecyclePolicy(policy) {
    return {
      level: policy?.level || "",
      label: policy?.label || "",
      code: policy?.code || "",
      text: businessText(policy?.text, ""),
      reference: businessText(policy?.reference, ""),
      status: policy?.status || "",
    };
  }

  function compactDataLifecyclePolicyRow(row, index = 0) {
    const modules = list(row?.module_or_measure_items || row?.moduleOrMeasureItems).length
      ? list(row?.module_or_measure_items || row?.moduleOrMeasureItems)
      : [...list(row?.technology_modules || row?.technologyModules), ...list(row?.technical_measures || row?.technicalMeasures)];
    return {
      id: row?.id || `data-policy-row:${index}`,
      category: businessText(row?.category, ""),
      sequence: businessText(row?.sequence, ""),
      policies: list(row?.policies).map(compactDataLifecyclePolicy),
      technicalServices: list(row?.technical_services || row?.technicalServices).map(compactLifecycleItem),
      technologyModules: modules.map(compactLifecycleItem),
    };
  }

  function compactDataLifecyclePolicyRows(rows) {
    return list(rows).map(compactDataLifecyclePolicyRow);
  }

  function findDataLifecycleProcess(lifecycle, selectedStage) {
    if (!selectedStage) return null;
    const candidates = list(lifecycle?.data_lifecycle?.processes);
    return (
      candidates.find((process) => process?.id === selectedStage.id) ||
      candidates.find((process) => process?.code && process.code === selectedStage.code) ||
      candidates.find((process) => titleOf(process, "") === titleOf(selectedStage, "")) ||
      null
    );
  }

  function dataPolicyRowsForStage(lifecycle, selectedStage) {
    const workbenchRows = list(selectedStage?.dataPolicyRows || selectedStage?.data_policy_rows);
    if (workbenchRows.length) return compactDataLifecyclePolicyRows(workbenchRows);
    const sourceProcess = findDataLifecycleProcess(lifecycle, selectedStage);
    return compactDataLifecyclePolicyRows(sourceProcess?.data_policy_rows || sourceProcess?.dataPolicyRows);
  }

  function dataLifecycleStageSearchText(lifecycleWorkbench, objectsById, lifecycle, stage) {
    const policyRows = dataPolicyRowsForStage(lifecycle, stage);
    return [
      lifecycleWorkbenchStageSearchText(lifecycleWorkbench, objectsById, stage),
      ...policyRows.flatMap((row) => [
        row.category,
        row.sequence,
        ...list(row.policies).flatMap((policy) => [policy.level, policy.label, policy.code, policy.text, policy.reference, policy.status]),
        ...list(row.technicalServices).flatMap((service) => [service.code, service.title, service.name, service.description]),
        ...list(row.technologyModules).flatMap((item) => [item.code, item.title, item.name, item.description, item.objectKind]),
      ]),
    ].join(" ");
  }

  function comparableItemKey(item) {
    return text(item?.code || item?.title || item?.name || item).trim();
  }

  function dataLifecycleTechnicalConsistency(stageRow, policyRows) {
    const stageServiceKeys = new Set(list(stageRow?.technicalServices).map(comparableItemKey).filter(Boolean));
    const policyServiceKeys = new Set(list(policyRows).flatMap((row) => list(row.technicalServices).map(comparableItemKey)).filter(Boolean));
    const stageModuleKeys = new Set([...list(stageRow?.technologyModules), ...list(stageRow?.technicalMeasures)].map(comparableItemKey).filter(Boolean));
    const policyModuleKeys = new Set(list(policyRows).flatMap((row) => list(row.technologyModules).map(comparableItemKey)).filter(Boolean));
    const serviceDelta = [...stageServiceKeys].filter((key) => !policyServiceKeys.has(key)).length + [...policyServiceKeys].filter((key) => !stageServiceKeys.has(key)).length;
    const moduleDelta = [...stageModuleKeys].filter((key) => !policyModuleKeys.has(key)).length + [...policyModuleKeys].filter((key) => !stageModuleKeys.has(key)).length;
    return {
      status: serviceDelta === 0 && moduleDelta === 0 ? "两表一致" : "待核对",
      serviceDelta,
      moduleDelta,
    };
  }

  function buildLifecycleNavigation(processes, search) {
    const query = normalizeSearch(search);
    return list(processes)
      .map((process) => {
        const searchText = [
          process.code,
          process.title,
          process.description,
          process.goal,
          ...list(process.main_activities).map(titleOf),
          ...list(process.security_activities).map(titleOf),
          ...list(process.technical_services).map(titleOf),
          ...list(process.development_technical_services).map(titleOf),
          ...list(process.development_technical_modules).map(titleOf),
          ...list(process.technology_modules).map(titleOf),
          ...list(process.technical_measures).map(titleOf),
          ...list(process.data_policy_rows || process.dataPolicyRows).flatMap((row) => [
            row?.category,
            row?.sequence,
            ...list(row?.policies).flatMap((policy) => [policy?.level, policy?.label, policy?.code, policy?.text, policy?.reference, policy?.status]),
            ...list(row?.technical_services || row?.technicalServices).flatMap((service) => [service?.code, titleOf(service), service?.description]),
            ...list(row?.module_or_measure_items || row?.moduleOrMeasureItems || row?.technology_modules || row?.technologyModules || row?.technical_measures || row?.technicalMeasures).flatMap((item) => [item?.code, titleOf(item), item?.description]),
          ]),
        ].join(" ");
        return {
          id: process.id,
          code: process.code || `AP-${String(process.order || "").padStart(2, "0")}`,
          title: titleOf(process, "未命名阶段"),
          description: businessText(process.goal || process.description, ""),
          order: process.order || process.metadata?.order || "",
          serviceCount: list(process.technical_services).length,
          moduleCount: list(process.technology_modules).length,
          measureCount: list(process.technical_measures).length,
          searchText,
        };
      })
      .filter((process) => includesSearch(query, process.searchText));
  }

  function lifecycleWorkbenchStageSearchText(lifecycleWorkbench, objectsById, stage) {
    if (!stage?.id) return [stage?.code, stage?.title, stage?.description].join(" ");
    const originalBusinessFields =
      stage.originalBusinessFields && typeof stage.originalBusinessFields === "object" ? Object.values(stage.originalBusinessFields) : [];
    const relationSets = [
      ["contains_activity", "lifecycle_activity"],
      ["contains_control", "lifecycle_control"],
      ["belongs_to", "lifecycle_requirement", "source"],
      ["applies_to_development_type", "software_development_type"],
      ["maps_to_service", "security_technical_service"],
      ["implemented_by_module", "security_technology_module"],
      ["uses_measure", "security_technical_measure"],
      ["uses_development_technical_service", "development_technical_service"],
      ["uses_development_technical_module", "development_technical_module"],
      ["contains_scene", "lifecycle_activity"],
    ];
    const related = relationSets.flatMap(([relationType, objectType, direction]) =>
      direction === "source"
        ? workbenchSources(lifecycleWorkbench, objectsById, stage.id, relationType, objectType)
        : workbenchTargets(lifecycleWorkbench, objectsById, stage.id, relationType, objectType),
    );
    return [
      stage.code,
      stage.title,
      stage.description,
      stage.goal,
      ...originalBusinessFields,
      ...related.flatMap((item) => [item.code, item.title, item.name, item.description, item.category, item.objectKind]),
    ].join(" ");
  }

  function buildLifecycleStageRows(processes) {
    return list(processes).map((process) => ({
      id: process.id,
      order: process.order || process.metadata?.order || "",
      code: process.code || "",
      title: titleOf(process, "未命名阶段"),
      goal: businessText(process.goal || process.description),
      originalBusinessFields: process.original_business_fields || process.originalBusinessFields || process.metadata?.original_business_fields || {},
      mainActivities: list(process.main_activities).map(compactLifecycleItem),
      securityActivities: list(process.security_activities).map(compactLifecycleActivity),
      policyRequirements: list(process.policy_requirements).map(compactLifecycleItem),
      developmentTypes: list(process.development_types).map(compactLifecycleItem),
      developmentServices: list(process.development_technical_services).map((service) => ({
        ...compactLifecycleItem(service),
        objectKind: "开发技术服务",
      })),
      developmentModules: list(process.development_technical_modules).map((module) => ({
        ...compactLifecycleItem(module),
        objectKind: "开发技术模块",
      })),
      technicalServices: list(process.technical_services).map(compactLifecycleItem),
      technologyModules: list(process.technology_modules).map((module) => ({
        ...compactLifecycleItem(module),
        objectKind: "安全技术模块",
      })),
      technicalMeasures: list(process.technical_measures).map((measure) => ({
        ...compactLifecycleItem(measure),
        objectKind: "安全技术措施",
      })),
      dataPolicyRows: compactDataLifecyclePolicyRows(process.data_policy_rows || process.dataPolicyRows),
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
      developmentModules: list(process?.development_technical_modules).map((module) => ({ ...compactLifecycleItem(module), objectKind: "开发技术模块" })),
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
        developmentTypes: selectedStageRow.developmentTypes,
        technicalServices: securityServices,
        technologyModules,
        technicalMeasures: list(serviceMappingRows?.stageMeasures),
        developmentServices: list(serviceMappingRows?.developmentServices),
        developmentModules: list(serviceMappingRows?.developmentModules),
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
        { label: displayLabel("security_policy_requirement", "安全策略要求"), value: summary.policyRequirementCount },
        { label: displayLabel("security_technical_service", "安全技术服务"), value: summary.technicalServiceCount },
        { label: "开发技术服务", value: summary.developmentServiceCount },
        { label: "开发技术模块", value: summary.developmentModuleCount },
        { label: displayLabel("security_technology_module", "安全技术模块"), value: summary.technologyModuleCount },
        { label: displayLabel("security_technical_measure", "安全技术措施"), value: summary.technicalMeasureCount },
      ],
    };
  }

  function buildLifecycleLocalRelationNotes(selectedStageRow, serviceMappingRows) {
    if (!selectedStageRow) return [];
    return [];
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

  function buildApplicationSecurityLifecycleWorkbenchViewModel({ lifecycleWorkbench, lifecycleWorkbenchViewModel, lifecycle, selectedProcessId, search, dataSource, selectionSource }) {
    const objectsById = workbenchObjectsById(lifecycleWorkbench);
    const stages = Object.values(lifecycleWorkbench?.objects?.lifecycle_stage || {})
      .map((stage) => workbenchEntity(stage, "未命名阶段"))
      .filter((stage) => !stage.lifecycleType || stage.lifecycleType === "application_security_development");
    const query = normalizeSearch(search);
    const allNavigationTree = stages.map((stage) => ({
        ...stage,
        order: stage.code,
        searchText: lifecycleWorkbenchStageSearchText(lifecycleWorkbench, objectsById, stage),
      }));
    const navigationTree = allNavigationTree.filter((stage) => includesSearch(query, stage.searchText));
    const selection = resolveCurrentObjectSelection({
      rows: allNavigationTree,
      selectedId: selectedProcessId,
      grain: "lifecycle_stage",
      label: "LC-AP 阶段",
      source: selectionSource,
    });
    const selectedId = selection.id;
    const selectedStage = selection.row;
    const stageActivities = selectedStage ? workbenchTargets(lifecycleWorkbench, objectsById, selectedStage.id, "contains_activity", "lifecycle_activity").map(compactLifecycleItem) : [];
    const securityActivities = selectedStage ? workbenchTargets(lifecycleWorkbench, objectsById, selectedStage.id, "contains_control", "lifecycle_control").map(compactLifecycleActivity) : [];
    const policyRequirements = selectedStage ? workbenchSources(lifecycleWorkbench, objectsById, selectedStage.id, "belongs_to", "lifecycle_requirement").map(compactLifecycleItem) : [];
    const developmentTypes = selectedStage ? workbenchTargets(lifecycleWorkbench, objectsById, selectedStage.id, "applies_to_development_type", "software_development_type").map(compactLifecycleItem) : [];
    const technicalServices = selectedStage ? workbenchTargets(lifecycleWorkbench, objectsById, selectedStage.id, "maps_to_service", "security_technical_service").map(compactLifecycleItem) : [];
    const stageModules = selectedStage ? workbenchTargets(lifecycleWorkbench, objectsById, selectedStage.id, "implemented_by_module", "security_technology_module").map((module) => ({ ...compactLifecycleItem(module), objectKind: "安全技术模块" })) : [];
    const technicalMeasures = selectedStage ? workbenchTargets(lifecycleWorkbench, objectsById, selectedStage.id, "uses_measure", "security_technical_measure").map((measure) => ({ ...compactLifecycleItem(measure), objectKind: "安全技术措施" })) : [];
    const developmentServices = selectedStage ? workbenchTargets(lifecycleWorkbench, objectsById, selectedStage.id, "uses_development_technical_service", "development_technical_service").map((service) => ({ ...compactLifecycleItem(service), objectKind: "开发技术服务" })) : [];
    const developmentModules = selectedStage ? workbenchTargets(lifecycleWorkbench, objectsById, selectedStage.id, "uses_development_technical_module", "development_technical_module").map((module) => ({ ...compactLifecycleItem(module), objectKind: "开发技术模块" })) : [];
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
      softwareDevelopmentTypeCount: developmentTypes.length,
      developmentServiceCount: developmentServices.length,
      technicalServiceCount: technicalServices.length,
      technologyModuleCount: technologyModules.length,
      technicalMeasureCount: technicalMeasures.length,
      developmentModuleCount: developmentModules.length,
      applicationSystemTypeCount: 0,
    };
    const selectedStageRow = selectedStage
      ? {
          ...selectedStage,
          mainActivities: stageActivities,
          securityActivities,
          policyRequirements,
          developmentTypes,
          developmentServices,
          developmentModules,
          technicalServices,
          technologyModules,
          technicalMeasures,
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
            { label: displayLabel("security_policy_requirement", "安全策略要求"), value: summary.policyRequirementCount },
            { label: "软件开发模式", value: summary.softwareDevelopmentTypeCount },
            { label: "开发技术服务", value: summary.developmentServiceCount },
            { label: "开发技术模块", value: summary.developmentModuleCount },
            { label: displayLabel("security_technical_service", "安全技术服务"), value: summary.technicalServiceCount },
            { label: displayLabel("security_technology_module", "安全技术模块"), value: summary.technologyModuleCount },
            { label: displayLabel("security_technical_measure", "安全技术措施"), value: summary.technicalMeasureCount },
          ],
        }
      : null;
    const softwareDefinitionMap = softwareDevelopmentTypeDefinitionMap(lifecycle);
    const relationRows = buildLifecycleOriginalFieldRows(selectedStageRow, softwareDefinitionMap);
    return {
      dataState: dataSource.workbenchReady ? "ready" : "empty",
      title: "LC-AP安全开发生命周期",
      description: "按 LC-AP 原始业务字段展示阶段、活动、策略、开发技术服务、开发技术模块、安全技术服务、安全技术模块和安全技术措施。",
      selection,
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
        developmentServices,
        securityServiceRows: technicalServices.map((service) => ({ id: service.id, category: service.category || "安全技术服务", service, modules: workbenchTargets(lifecycleWorkbench, objectsById, service.id, "implemented_by_module", "security_technology_module").map(compactLifecycleItem) })),
        stageModules,
        stageMeasures: technicalMeasures,
        developmentModules,
      },
      relationRows,
      referenceSections: { softwareDevelopmentTypes: [], applicationSystemTypes: [] },
      referenceGroups: { softwareDevelopmentTypes: [], applicationSystemTypes: [] },
      localRelationNotes: [],
      detailPanel: selectedStage
        ? {
            type: "LC-AP 开发过程阶段",
            code: selectedStage.code || "LC-AP",
            title: selectedStage.title || PENDING_TEXT,
            description: selectedStage.description || PENDING_TEXT,
	            facts: [
	              { label: "软件开发模式", value: summary.softwareDevelopmentTypeCount },
	              { label: "开发技术服务", value: summary.developmentServiceCount },
	              { label: "开发技术模块", value: summary.developmentModuleCount },
		              { label: displayLabel("security_technical_service", "安全技术服务"), value: summary.technicalServiceCount },
		              { label: displayLabel("security_technology_module", "安全技术模块"), value: summary.technologyModuleCount },
		              { label: displayLabel("security_technical_measure", "安全技术措施"), value: summary.technicalMeasureCount },
	            ],
	            sections: [
	              { title: "软件开发模式", items: developmentTypes },
	              { title: "阶段主要活动", items: stageActivities },
	              { title: "安全活动", items: securityActivities },
		              { title: displayLabel("security_policy_requirement", "安全策略要求"), items: policyRequirements },
	              { title: "开发技术服务", items: developmentServices },
	              { title: "开发技术模块", items: developmentModules },
	              { title: "安全技术措施", items: technicalMeasures },
	            ],
            sourceEvidence: [],
          }
        : null,
      sourceEvidence: [],
      dataSource,
      workbenchViewModel: lifecycleWorkbenchViewModel || null,
      emptyState: selection.status === "target_missing" ? selection.message : navigationTree.length ? "" : "暂无 LC-AP workbench 数据，请确认 lifecycle-workbench.json 是否已生成。",
    };
  }

  function buildDataSecurityLifecycleWorkbenchViewModel({ lifecycleWorkbench, lifecycleWorkbenchViewModel, lifecycle, selectedProcessId, search, dataSource, selectionSource }) {
    const objectsById = workbenchObjectsById(lifecycleWorkbench);
    const stages = Object.values(lifecycleWorkbench?.objects?.lifecycle_stage || {})
      .map((stage) => workbenchEntity(stage, "未命名数据过程"))
      .filter((stage) => stage.lifecycleType === "data");
    const query = normalizeSearch(search);
    const allNavigationTree = stages.map((stage) => ({
        ...stage,
        order: stage.code,
        searchText: dataLifecycleStageSearchText(lifecycleWorkbench, objectsById, lifecycle, stage),
      }));
    const navigationTree = allNavigationTree.filter((stage) => includesSearch(query, stage.searchText));
    const selection = resolveCurrentObjectSelection({
      rows: allNavigationTree,
      selectedId: selectedProcessId,
      grain: "lifecycle_stage",
      label: "LC-DT 数据过程",
      source: selectionSource,
    });
    const selectedId = selection.id;
    const selectedStage = selection.row;
    const scenes = selectedStage ? workbenchTargets(lifecycleWorkbench, objectsById, selectedStage.id, "contains_scene", "lifecycle_activity").map((scene) => ({ ...compactLifecycleItem(scene), objectKind: "数据处理场景" })) : [];
    const technicalServices = selectedStage ? workbenchTargets(lifecycleWorkbench, objectsById, selectedStage.id, "maps_to_service", "security_technical_service").map(compactLifecycleItem) : [];
    const stageModules = selectedStage ? workbenchTargets(lifecycleWorkbench, objectsById, selectedStage.id, "implemented_by_module", "security_technology_module").map((module) => ({ ...compactLifecycleItem(module), objectKind: "安全技术模块" })) : [];
    const technicalMeasures = selectedStage ? workbenchTargets(lifecycleWorkbench, objectsById, selectedStage.id, "uses_measure", "security_technical_measure").map((measure) => ({ ...compactLifecycleItem(measure), objectKind: "安全技术措施" })) : [];
    const technologyModules = uniqueBy(stageModules, (module) => module.id || module.code || module.title);
    const summary = {
      processCount: navigationTree.length,
      selectedProcessId: selectedId,
      sceneCount: scenes.length,
      technicalServiceCount: technicalServices.length,
      technologyModuleCount: technologyModules.length,
      technicalMeasureCount: technicalMeasures.length,
      dataPolicyRowCount: 0,
      technicalConsistencyStatus: "",
    };
    const selectedStageRow = selectedStage
      ? {
          ...selectedStage,
          scenes,
          technicalServices,
          technologyModules,
          technicalMeasures,
        }
      : null;
    const policyRows = dataPolicyRowsForStage(lifecycle, selectedStageRow);
    const consistency = dataLifecycleTechnicalConsistency(selectedStageRow, policyRows);
    summary.dataPolicyRowCount = policyRows.length;
    summary.technicalConsistencyStatus = consistency.status;
    summary.serviceConsistencyDelta = consistency.serviceDelta;
    summary.moduleConsistencyDelta = consistency.moduleDelta;
    const stageOverview = selectedStage
      ? {
          mode: "data",
          code: selectedStage.code || "LC-DT",
          title: selectedStage.title || PENDING_TEXT,
          description: selectedStage.description || PENDING_TEXT,
          status: "当前数据过程",
          facts: [
            { label: "处理场景", value: summary.sceneCount },
            { label: "策略行", value: summary.dataPolicyRowCount },
            { label: "两表技术映射", value: summary.technicalConsistencyStatus },
            { label: displayLabel("security_technical_service", "安全技术服务"), value: summary.technicalServiceCount },
            { label: displayLabel("security_technology_module", "安全技术模块"), value: summary.technologyModuleCount },
            { label: displayLabel("security_technical_measure", "安全技术措施"), value: summary.technicalMeasureCount },
          ],
        }
      : null;
    const relationRows = buildDataLifecycleOriginalFieldRows(selectedStageRow);
    return {
      dataState: dataSource.workbenchReady ? "ready" : "empty",
      title: "LC-DT数据生命周期安全",
      description: "按 LC-DT 两个原始 sheet 展示数据处理场景、数据重要程度安全策略，以及同一阶段一致的安全技术服务和安全技术模块/措施。",
      selection,
      navigationTree,
      stageTree: navigationTree,
      selectedProcess: selectedStageRow,
      selectedStage: selectedStageRow,
      relationshipSummary: summary,
      stageOverview,
      stageRows: navigationTree,
      relationRows,
      policyRows,
      serviceMappingRows: {
        securityServiceRows: technicalServices.map((service) => ({ id: service.id, category: service.category || "安全技术服务", service, modules: workbenchTargets(lifecycleWorkbench, objectsById, service.id, "implemented_by_module", "security_technology_module").map(compactLifecycleItem) })),
        stageModules,
        stageMeasures: technicalMeasures,
      },
      referenceSections: {},
      referenceGroups: {},
      localRelationNotes: [],
      detailPanel: selectedStage
        ? {
            type: "LC-DT 数据处理过程",
            code: selectedStage.code || "LC-DT",
            title: selectedStage.title || PENDING_TEXT,
            description: selectedStage.description || PENDING_TEXT,
            facts: [
              { label: "处理场景", value: summary.sceneCount },
              { label: "策略行", value: summary.dataPolicyRowCount },
              { label: "两表技术映射", value: summary.technicalConsistencyStatus },
              { label: displayLabel("security_technical_service", "安全技术服务"), value: summary.technicalServiceCount },
              { label: displayLabel("security_technology_module", "安全技术模块"), value: summary.technologyModuleCount },
              { label: displayLabel("security_technical_measure", "安全技术措施"), value: summary.technicalMeasureCount },
            ],
            sections: [
              { title: "数据处理场景", items: scenes },
              { title: "数据重要程度安全策略", items: policyRows.map((row) => ({ id: row.id, title: [row.category, row.sequence].filter(Boolean).join(" "), objectKind: "策略行" })) },
              { title: "安全技术服务", items: technicalServices },
              { title: "安全技术模块", items: technologyModules },
              { title: "安全技术措施", items: technicalMeasures },
            ],
            sourceEvidence: [],
          }
        : null,
      sourceEvidence: [],
      dataSource,
      workbenchViewModel: lifecycleWorkbenchViewModel || null,
      emptyState: selection.status === "target_missing" ? selection.message : navigationTree.length ? "" : "暂无 LC-DT workbench 数据，请确认 lifecycle-workbench.json 是否已生成。",
    };
  }

  function buildApplicationSecurityLifecycleViewModel({ lifecycleWorkbench, lifecycleWorkbenchViewModel, lifecycle, selectedProcessId, search, selectionSource }) {
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
        lifecycle,
        selectedProcessId,
        search,
        selectionSource,
        dataSource: sourceStatus,
      });
    }
    const appSecurity = lifecycle?.application_security_development || {};
    const dataState = lifecycle?.__data_state === "missing_file" ? "missing_file" : list(appSecurity.processes).length ? "ready" : "empty";
    const allNavigationTree = buildLifecycleNavigation(appSecurity.processes, "");
    const navigationTree = buildLifecycleNavigation(appSecurity.processes, search);
    const selection = resolveCurrentObjectSelection({
      rows: allNavigationTree,
      selectedId: selectedProcessId,
      grain: "lifecycle_stage",
      label: "LC-AP 阶段",
      source: selectionSource,
    });
    const selectedId = selection.id;
    const process = list(appSecurity.processes).find((item) => item.id === selectedId) || null;
    const allStageRows = buildLifecycleStageRows(appSecurity.processes);
    const stageRows = allStageRows.filter((row) => !normalizeSearch(search) || navigationTree.some((nav) => nav.id === row.id));
    const selectedStageRow = allStageRows.find((row) => row.id === selectedId) || null;
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
      developmentModuleCount: list(process?.development_technical_modules).length,
      softwareDevelopmentTypeCount: referenceSections.softwareDevelopmentTypes.length,
      applicationSystemTypeCount: referenceSections.applicationSystemTypes.length,
    };
    const softwareDefinitionMap = softwareDevelopmentTypeDefinitionMap(lifecycle);
    const stageProfileRows = stageRows.flatMap((row) => buildLifecycleOriginalFieldRows(row, softwareDefinitionMap));
    const relationRows = buildLifecycleOriginalFieldRows(selectedStageRow, softwareDefinitionMap);
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
            { label: displayLabel("security_policy_requirement", "安全策略要求"), value: summary.policyRequirementCount },
            { label: "软件开发模式", value: list(process?.development_types).length },
            { label: "开发技术服务", value: summary.developmentServiceCount },
            { label: displayLabel("security_technical_service", "安全技术服务"), value: summary.technicalServiceCount },
            { label: displayLabel("security_technology_module", "安全技术模块"), value: summary.technologyModuleCount },
            { label: displayLabel("security_technical_measure", "安全技术措施"), value: summary.technicalMeasureCount },
            { label: "开发技术模块", value: summary.developmentModuleCount },
          ],
          sections: [
            { title: "软件开发模式", items: selectedStageRow?.developmentTypes || [] },
            { title: "阶段主要活动", items: selectedStageRow?.mainActivities || [] },
            { title: "安全活动", items: selectedStageRow?.securityActivities || [] },
            { title: "安全策略", items: selectedStageRow?.policyRequirements || [] },
            { title: "开发技术服务", items: selectedStageRow?.developmentServices || [] },
            { title: "开发技术模块", items: selectedStageRow?.developmentModules || [] },
          ],
          sourceEvidence: [],
        }
      : null;
    return {
      dataState,
      title: "LC-AP安全开发生命周期",
      description: "按 LC-AP 原始业务字段展示阶段、活动、策略、开发技术服务、开发技术模块、安全技术服务、安全技术模块和安全技术措施。",
      selection,
      navigationTree,
      stageTree: navigationTree,
      selectedProcess: selectedStageRow,
      selectedStage: selectedStageRow,
      relationshipSummary: summary,
      stageOverview,
      stageRows,
      stageProfileRows,
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
      sourceEvidence: [],
      dataSource: sourceStatus,
      workbenchViewModel: lifecycleWorkbenchViewModel || null,
      emptyState: selection.status === "target_missing"
        ? selection.message
        : stageRows.length
        ? ""
        : dataState === "missing_file"
          ? "未找到 lifecycle-knowledge.json，请先执行 LC-AP 数据导出。"
          : "暂无 LC-AP安全开发生命周期数据，请确认 lifecycle-knowledge.json 是否已导出。",
    };
  }

  function buildDataSecurityLifecycleViewModel({ lifecycleWorkbench, lifecycleWorkbenchViewModel, lifecycle, selectedProcessId, search, selectionSource }) {
    const sourceStatus = workbenchDataSource({
      workbench: lifecycleWorkbench,
      workbenchViewModel: lifecycleWorkbenchViewModel,
      workbenchName: "lifecycle-workbench.json",
      fallbackName: "lifecycle-knowledge.json",
    });
    if (sourceStatus.workbenchReady) {
      return buildDataSecurityLifecycleWorkbenchViewModel({
        lifecycleWorkbench,
        lifecycleWorkbenchViewModel,
        lifecycle,
        selectedProcessId,
        search,
        selectionSource,
        dataSource: sourceStatus,
      });
    }
    const dataLifecycle = lifecycle?.data_lifecycle || {};
    const dataState = lifecycle?.__data_state === "missing_file" ? "missing_file" : list(dataLifecycle.processes).length ? "ready" : "empty";
    const allNavigationTree = buildLifecycleNavigation(dataLifecycle.processes, "");
    const navigationTree = buildLifecycleNavigation(dataLifecycle.processes, search);
    const selection = resolveCurrentObjectSelection({
      rows: allNavigationTree,
      selectedId: selectedProcessId,
      grain: "lifecycle_stage",
      label: "LC-DT 数据过程",
      source: selectionSource,
    });
    const selectedId = selection.id;
    const stageRows = buildLifecycleStageRows(dataLifecycle.processes);
    const selectedStageRow = stageRows.find((row) => row.id === selectedId) || null;
    if (selectedStageRow) selectedStageRow.scenes = list(list(dataLifecycle.processes).find((item) => item.id === selectedStageRow.id)?.scenes).map(compactLifecycleItem);
    const relationRows = buildDataLifecycleOriginalFieldRows(selectedStageRow);
    const policyRows = dataPolicyRowsForStage(lifecycle, selectedStageRow);
    const consistency = dataLifecycleTechnicalConsistency(selectedStageRow, policyRows);
    return {
      dataState,
      title: "LC-DT数据生命周期安全",
      description: "按 LC-DT 两个原始 sheet 展示数据处理场景、数据重要程度安全策略，以及同一阶段一致的安全技术服务和安全技术模块/措施。",
      selection,
      navigationTree,
      stageTree: navigationTree,
      selectedProcess: selectedStageRow,
      selectedStage: selectedStageRow,
      relationshipSummary: {
        processCount: navigationTree.length,
        selectedProcessId: selectedId,
        sceneCount: list(selectedStageRow?.scenes).length,
        dataPolicyRowCount: policyRows.length,
        technicalConsistencyStatus: consistency.status,
        serviceConsistencyDelta: consistency.serviceDelta,
        moduleConsistencyDelta: consistency.moduleDelta,
        technicalServiceCount: list(selectedStageRow?.technicalServices).length,
        technologyModuleCount: list(selectedStageRow?.technologyModules).length,
        technicalMeasureCount: list(selectedStageRow?.technicalMeasures).length,
      },
      stageOverview: selectedStageRow
        ? {
            mode: "data",
            code: selectedStageRow.code || "LC-DT",
            title: selectedStageRow.title || PENDING_TEXT,
            description: selectedStageRow.description || selectedStageRow.goal || PENDING_TEXT,
            facts: [
              { label: "处理场景", value: list(selectedStageRow?.scenes).length },
              { label: "策略行", value: policyRows.length },
              { label: "两表技术映射", value: consistency.status },
            ],
          }
        : null,
      relationRows,
      policyRows,
      dataSource: sourceStatus,
      workbenchViewModel: lifecycleWorkbenchViewModel || null,
      emptyState: selection.status === "target_missing"
        ? selection.message
        : navigationTree.length
        ? ""
        : dataState === "missing_file"
          ? "未找到 lifecycle-knowledge.json，请先执行 LC-DT 数据导出。"
          : "暂无 LC-DT 数据生命周期安全数据，请确认 lifecycle-knowledge.json 是否已导出。",
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
      environmentScopeTree: list(data.environment_scope_tree || data.environmentScopeTree),
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
    return buildWorkbenchDataContractViewModel(workbench, "LC-AP安全开发生命周期专项关系投影");
  }

  window.sapdViewModels = {
    buildCapabilityWorkbenchViewModel,
    buildCapabilityWorkspaceViewModel,
    buildEnvironmentWorkbenchViewModel,
    buildEnvironmentManagementFromWorkbench,
    buildLifecycleWorkbenchViewModel,
    buildApplicationSecurityLifecycleViewModel,
    buildDataSecurityLifecycleViewModel,
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
