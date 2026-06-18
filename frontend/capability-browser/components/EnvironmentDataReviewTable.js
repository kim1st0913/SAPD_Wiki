(function () {
  const components = (window.sapdComponents = window.sapdComponents || {});
  const utils = components.utils || {};
  const list = utils.list || ((value) => (Array.isArray(value) ? value : []));
  const text = utils.text || ((value) => (value == null ? "" : String(value)));
  const escape = utils.escapeHtml || ((value) => text(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]));

  const FILTER_DEFAULTS = {
    query: "",
    environment: "",
    segment: "",
    object: "",
    contextKey: "",
    scope: "",
    service: "",
    moduleMeasure: "",
    securitySystem: "",
    issueType: "",
    triageCategory: "",
    sameNameOnly: false,
    nodeMissingOnly: false,
    manyServicesOnly: false,
    missingSystemWithModuleOnly: false,
    abnormalModuleMeasureOnly: false,
    duplicateServiceOnly: false,
    missingScopeOnly: false,
    relationIssueOnly: false,
    topOnly: false,
    possibleAliasOnly: false,
    serviceExpansionOnly: false,
    directoryMismatchOnly: false,
    coverageGapOnly: false,
    reviewMode: "environment",
    directoryQuery: "",
    directoryDifference: "",
    directorySystem: "",
    directoryModule: "",
    directoryService: "",
  };

  function includes(value, query) {
    const keyword = text(query).trim().toLowerCase();
    if (!keyword) return true;
    return text(value).toLowerCase().includes(keyword);
  }

  function splitEvidence(value) {
    return text(value)
      .split("|")
      .map((item) => item.trim())
      .filter(Boolean);
  }

  function uniqueValues(rows, key) {
    return [...new Set(list(rows).map((row) => text(row?.[key]).trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, "zh-Hans-CN"));
  }

  function countUnique(rows, key) {
    return new Set(list(rows).map((row) => text(row?.[key]).trim()).filter(Boolean)).size;
  }

  function issueTypesFor(row) {
    return list(row?.issueTypes).map((issue) => text(issue)).filter(Boolean);
  }

  function triageCategoriesFor(row) {
    return list(row?.triageCategories).map((category) => text(category)).filter(Boolean);
  }

  function patternSignaturesFor(row) {
    return list(row?.patternSignatures).map((signature) => text(signature)).filter(Boolean);
  }

  function uniqueIssueTypes(rows) {
    return [...new Set(list(rows).flatMap((row) => issueTypesFor(row)))].sort((a, b) => a.localeCompare(b, "zh-Hans-CN"));
  }

  function differenceLabels(reviewData) {
    return reviewData?.dualTableReview?.differenceTypeLabels || {
      aligned: "一致",
      catalog_unused: "目录有，环境未用",
      environment_only: "环境有，目录没有",
      module_service_mismatch: "模块-服务不一致",
      system_module_mismatch: "系统-模块不一致",
      possible_alias: "可能别名",
      selective_reference_candidate: "选择性引用候选",
    };
  }

  function directoryRelationKey(record, index = 0) {
    return text(record?.relationKey || [record?.relationOrigin, record?.securitySystem, record?.securityTechnologyModule, record?.securityTechnicalServiceKey, index].join("::"));
  }

  function rowKey(row, index = 0) {
    return [
      row?.objectContextKey,
      row?.excelRow,
      row?.scope,
      row?.securityTechnicalService,
      row?.securitySystem,
      row?.securityTechnologyModule,
      row?.securityTechnicalMeasure,
      index,
    ]
      .map((value) => encodeURIComponent(text(value)))
      .join("::");
  }

  function contextLabel(row) {
    return [row?.informationEnvironment, row?.environmentSegment, row?.informationObject].map((value) => text(value).trim() || "待补充").join(" / ");
  }

  function contextSummaryMap(reviewData) {
    const map = new Map();
    for (const item of list(reviewData?.contextSummaries)) {
      const key = text(item.objectContextKey || item.contextKey);
      if (key) map.set(key, item);
    }
    return map;
  }

  function buildGroups(rows, summaryByContext) {
    const groups = new Map();
    rows.forEach((row, index) => {
      const key = text(row.objectContextKey || contextLabel(row));
      if (!groups.has(key)) {
        groups.set(key, {
          key,
          label: contextLabel(row),
          environment: text(row.informationEnvironment),
          segment: text(row.environmentSegment),
          object: text(row.informationObject),
          summary: summaryByContext.get(key) || null,
          rows: [],
        });
      }
      groups.get(key).rows.push({ ...row, __rowKey: rowKey(row, index) });
    });
    return [...groups.values()].sort((left, right) => left.label.localeCompare(right.label, "zh-Hans-CN"));
  }

  function contextIsMany(summary, rows) {
    const serviceCount = Number(summary?.serviceCount ?? countUnique(rows, "securityTechnicalService"));
    return serviceCount >= 20;
  }

  function contextHasAbnormalModuleMeasure(summary, rows) {
    const moduleCount = Number(summary?.moduleCount ?? countUnique(rows, "securityTechnologyModule"));
    const measureCount = Number(summary?.measureCount ?? countUnique(rows, "securityTechnicalMeasure"));
    return moduleCount + measureCount >= 20;
  }

  function filterRows(reviewData, filters = {}) {
    const mergedFilters = { ...FILTER_DEFAULTS, ...filters };
    const rows = list(reviewData?.rows);
    const summaryByContext = contextSummaryMap(reviewData);
    return rows.filter((row) => {
      const summary = summaryByContext.get(text(row.objectContextKey)) || null;
      if (mergedFilters.environment && row.informationEnvironment !== mergedFilters.environment) return false;
      if (mergedFilters.segment && row.environmentSegment !== mergedFilters.segment) return false;
      if (!includes(row.informationObject, mergedFilters.object)) return false;
      if (!includes(row.objectContextKey, mergedFilters.contextKey)) return false;
      if (!includes(row.scope, mergedFilters.scope)) return false;
      if (!includes(row.securityTechnicalService, mergedFilters.service)) return false;
      if (!includes(row.moduleOrMeasure || row.securityTechnologyModule || row.securityTechnicalMeasure, mergedFilters.moduleMeasure)) return false;
      if (mergedFilters.securitySystem && row.securitySystem !== mergedFilters.securitySystem) return false;
      if (mergedFilters.issueType && !issueTypesFor(row).includes(mergedFilters.issueType)) return false;
      if (mergedFilters.triageCategory && !triageCategoriesFor(row).includes(mergedFilters.triageCategory)) return false;
      if (mergedFilters.sameNameOnly && row.sameNameDifferentContext !== "是") return false;
      if (mergedFilters.nodeMissingOnly && row.nodeDetailsContains !== "否") return false;
      if (mergedFilters.missingSystemWithModuleOnly && !(text(row.securityTechnologyModule).trim() && !text(row.securitySystem).trim())) return false;
      if (mergedFilters.manyServicesOnly && !contextIsMany(summary, [row])) return false;
      if (mergedFilters.abnormalModuleMeasureOnly && !contextHasAbnormalModuleMeasure(summary, [row])) return false;
      const issueTypes = issueTypesFor(row);
      const triageCategories = triageCategoriesFor(row);
      const patternSignatures = patternSignaturesFor(row);
      if (mergedFilters.duplicateServiceOnly && !issueTypes.includes("duplicate_exact_service_child_relation") && !triageCategories.includes("A")) return false;
      if (mergedFilters.missingScopeOnly && !issueTypes.includes("missing_scope_by_service_reverse_check")) return false;
      if (mergedFilters.relationIssueOnly && !issueTypes.some((issue) => text(issue).startsWith("missing_"))) return false;
      if (mergedFilters.topOnly && !row.isTopManualReviewItem) return false;
      if (mergedFilters.possibleAliasOnly && !list(row.possibleAliasMatches).length && !triageCategories.includes("H")) return false;
      if (mergedFilters.serviceExpansionOnly && !triageCategories.includes("I") && !patternSignatures.some((signature) => signature.startsWith("serviceExpansion::"))) return false;
      if (mergedFilters.directoryMismatchOnly && !triageCategories.some((category) => category === "C" || category === "D" || category === "G")) return false;
      if (mergedFilters.coverageGapOnly && !triageCategories.some((category) => category === "E" || category === "F")) return false;
      if (mergedFilters.query) {
        const haystack = [
          row.reviewTarget,
          row.informationEnvironment,
          row.environmentSegment,
          row.informationObject,
          row.objectContextKey,
          row.scope,
          row.securityTechnicalService,
          row.securitySystem,
          row.securityTechnologyModule,
          row.securityTechnicalMeasure,
          row.moduleOrMeasure,
          row.excelRow,
          issueTypes.join(" "),
          triageCategories.join(" "),
          patternSignatures.join(" "),
          row.mergedRanges,
          row.sourceCells,
          row.reviewPrompts,
        ].join(" ");
        if (!includes(haystack, mergedFilters.query)) return false;
      }
      return true;
    });
  }

  function renderSelect(label, name, value, options) {
    return `
      <label class="environment-review-filter">
        <span>${escape(label)}</span>
        <select data-environment-review-filter="${escape(name)}">
          <option value="">全部</option>
          ${list(options)
            .map((option) => {
              const optionValue = typeof option === "object" ? text(option.value) : text(option);
              const optionLabel = typeof option === "object" ? text(option.label || option.value) : text(option);
              return `<option value="${escape(optionValue)}" ${optionValue === value ? "selected" : ""}>${escape(optionLabel)}</option>`;
            })
            .join("")}
        </select>
      </label>
    `;
  }

  function renderTextFilter(label, name, value, placeholder) {
    return `
      <label class="environment-review-filter">
        <span>${escape(label)}</span>
        <input type="search" value="${escape(value || "")}" placeholder="${escape(placeholder || "")}" data-environment-review-filter="${escape(name)}" />
      </label>
    `;
  }

  function renderToggle(label, name, checked) {
    return `
      <label class="environment-review-toggle">
        <input type="checkbox" ${checked ? "checked" : ""} data-environment-review-toggle="${escape(name)}" />
        <span>${escape(label)}</span>
      </label>
    `;
  }

  function renderModeTabs(mode) {
    const normalizedMode = mode === "directory" ? "directory" : "environment";
    return `
      <div class="environment-review-mode-tabs" role="tablist" aria-label="数据核对视图">
        <button type="button" class="${normalizedMode === "environment" ? "is-active" : ""}" data-environment-review-mode="environment">环境对象核对</button>
        <button type="button" class="${normalizedMode === "directory" ? "is-active" : ""}" data-environment-review-mode="directory">双表对照核对</button>
      </div>
    `;
  }

  function renderCell(value, className = "") {
    const cleanValue = text(value).trim();
    return cleanValue ? `<span class="${escape(className || "environment-review-text")}">${escape(cleanValue)}</span>` : '<span class="empty-inline">/</span>';
  }

  function excelRow(row) {
    const value = Number(row?.excelRow || row?.row || 0);
    return Number.isFinite(value) ? value : 0;
  }

  function mergeRange(row, field) {
    return text(row?.mergedRangesMap?.[field]);
  }

  function sourceCell(row, field) {
    return text(row?.sourceCellsMap?.[field]?.sourceCell || row?.sourceCellsMap?.[field]?.cell);
  }

  function fieldMergeKey(row, field) {
    const range = mergeRange(row, field);
    if (range) return `${field}:range:${range}`;
    const source = sourceCell(row, field);
    return `${field}:cell:${source || `${excelRow(row)}`}`;
  }

  function moduleMeasureDisplay(row) {
    return text(row.moduleOrMeasure || row.securityTechnologyModule || row.securityTechnicalMeasure || "");
  }

  function serviceMergeKey(row) {
    return ["service", row.objectContextKey, row.securityTechnicalService].map(text).join("::");
  }

  function moduleMeasureMergeKey(row) {
    const value = moduleMeasureDisplay(row);
    const range = mergeRange(row, "moduleOrMeasureRaw");
    if (range) return `moduleMeasure:range:${range}`;
    return ["moduleMeasure", row.objectContextKey, row.securityTechnicalService, row.moduleOrMeasureKind, value].map(text).join("::");
  }

  function systemMergeKey(row) {
    const value = text(row.securitySystem);
    const range = mergeRange(row, "securitySystem");
    if (range) return `system:range:${range}`;
    return ["system", row.objectContextKey, moduleMeasureDisplay(row), value].map(text).join("::");
  }

  function rowSpanAt(rows, index, keyFn) {
    const key = keyFn(rows[index]);
    if (!key) return 1;
    if (index > 0 && keyFn(rows[index - 1]) === key) return 0;
    let span = 1;
    for (let cursor = index + 1; cursor < rows.length; cursor += 1) {
      if (keyFn(rows[cursor]) !== key) break;
      span += 1;
    }
    return span;
  }

  function renderMergedCell(rows, index, keyFn, html, className = "") {
    const span = rowSpanAt(rows, index, keyFn);
    if (span <= 0) return "";
    return `<td class="${escape(className)}" rowspan="${escape(span)}">${html}</td>`;
  }

  function renderMultiline(value, className = "environment-review-text") {
    const values = text(value)
      .split(/\n| \/ /)
      .map((item) => item.trim())
      .filter(Boolean);
    if (!values.length) return '<span class="empty-inline">/</span>';
    return `<span class="${escape(className)}">${values.map((item) => `<span class="environment-review-scope-line">${escape(item)}</span>`).join("")}</span>`;
  }

  function rowIssueClass(row) {
    const issues = issueTypesFor(row);
    const categories = triageCategoriesFor(row);
    if (issues.includes("duplicate_exact_service_child_relation") || categories.includes("A") || categories.includes("B")) return " has-high-risk";
    if (categories.some((category) => category === "C" || category === "D" || category === "G")) return " has-directory-risk";
    if (categories.some((category) => category === "E" || category === "F")) return " has-coverage-risk";
    if (categories.includes("H")) return " has-alias-risk";
    if (categories.includes("I")) return " has-info-risk";
    if (issues.length || row.riskLevel === "medium") return " has-medium-risk";
    return "";
  }

  function renderModuleMeasureCell(row) {
    const value = moduleMeasureDisplay(row);
    if (!value) return '<span class="empty-inline">/</span>';
    const kind = text(row.moduleOrMeasureKind);
    const label = kind === "module" ? "模块" : kind === "measure" ? "措施" : kind === "pending" ? "待确认" : "";
    return `<span class="environment-review-token environment-review-token-module-measure ${kind ? `is-${escape(kind)}` : ""}">${label ? `<em>${escape(label)}</em>` : ""}<span>${escape(value)}</span></span>`;
  }

  function renderPrompt(row) {
    const issues = issueTypesFor(row);
    const categories = triageCategoriesFor(row);
    const prompt = text(row.reviewPrompts || row.riskLevel || "");
    if (!prompt && !issues.length) return '<span class="empty-inline">/</span>';
    return `
      <div class="environment-review-prompts">
        ${categories.map((category) => `<span class="is-triage-${escape(category)}">${escape(category)}</span>`).join("")}
        ${issues.map((issue) => `<span>${escape(issue)}</span>`).join("")}
        ${prompt ? `<p>${escape(prompt)}</p>` : ""}
      </div>
    `;
  }

  function topPriority(row) {
    const value = Number(row?.topManualReviewPriority || 0);
    return Number.isFinite(value) && value > 0 ? value : 9999;
  }

  function renderExcelRowsTable(rows, selectedRowKey, topMode = false) {
    const sortedRows = [...rows].sort((left, right) => {
      if (topMode) return topPriority(left) - topPriority(right) || excelRow(left) - excelRow(right);
      return excelRow(left) - excelRow(right);
    });
    return `
      <div class="environment-review-table-scroll">
        <table class="environment-review-table environment-review-excel-table">
          <thead>
            <tr>
              <th>信息化环境</th>
              <th>环境子类</th>
              <th>信息化对象</th>
              <th>作用域</th>
              <th>安全技术服务</th>
              <th>安全技术模块/安全技术措施</th>
              <th>安全系统</th>
              <th>核对提示</th>
              <th>证据</th>
            </tr>
          </thead>
          <tbody>
            ${sortedRows
              .map((row, index) => {
                const selected = row.__rowKey === selectedRowKey;
                const contextKey = (item) => text(item.objectContextKey);
                return `
                  <tr class="${selected ? "is-selected" : ""}${rowIssueClass(row)}">
                    ${renderMergedCell(sortedRows, index, (item) => fieldMergeKey(item, "informationEnvironment"), renderCell(row.informationEnvironment), "environment-review-merged-cell")}
                    ${renderMergedCell(sortedRows, index, (item) => fieldMergeKey(item, "environmentSegment"), renderCell(row.environmentSegment), "environment-review-merged-cell")}
                    ${renderMergedCell(sortedRows, index, (item) => fieldMergeKey(item, "informationObject"), renderCell(row.informationObject), "environment-review-merged-cell")}
                    ${renderMergedCell(sortedRows, index, contextKey, renderMultiline(row.declaredScopeCell || row.scope), "environment-review-merged-cell environment-review-scope-cell")}
                    ${renderMergedCell(sortedRows, index, serviceMergeKey, renderCell(row.securityTechnicalService, "environment-review-token environment-review-token-service"), issueTypesFor(row).some((issue) => issue === "duplicate_exact_service_child_relation" || issue === "duplicate_service_in_object_context") ? "environment-review-merged-cell issue-duplicate-service" : "environment-review-merged-cell")}
                    ${renderMergedCell(sortedRows, index, moduleMeasureMergeKey, renderModuleMeasureCell(row), "environment-review-merged-cell")}
                    ${renderMergedCell(sortedRows, index, systemMergeKey, renderCell(row.securitySystem, "environment-review-token environment-review-token-system"), issueTypesFor(row).includes("missing_security_system") ? "environment-review-merged-cell issue-missing-system" : "environment-review-merged-cell")}
                    <td>${renderPrompt(row)}</td>
                    <td><button type="button" class="environment-review-row-button" data-environment-review-row-key="${escape(row.__rowKey)}">Excel ${escape(row.excelRow || "查看")}</button></td>
                  </tr>
                `;
              })
              .join("")}
          </tbody>
        </table>
      </div>
    `;
  }

  function renderEvidenceList(values, emptyLabel = "无") {
    const items = list(values).map((value) => text(value)).filter(Boolean);
    if (!items.length) return `<span class="empty-inline">${escape(emptyLabel)}</span>`;
    return `<ul>${items.slice(0, 12).map((item) => `<li>${escape(item)}</li>`).join("")}</ul>`;
  }

  function renderEvidenceObject(value) {
    if (!value || typeof value !== "object") return '<span class="empty-inline">/</span>';
    const entries = Object.entries(value).filter(([, entryValue]) => {
      if (Array.isArray(entryValue)) return entryValue.length;
      if (entryValue && typeof entryValue === "object") return Object.keys(entryValue).length;
      return text(entryValue);
    });
    if (!entries.length) return '<span class="empty-inline">/</span>';
    return `<dl class="environment-review-evidence-grid">${entries
      .map(([key, entryValue]) => {
        const valueHtml = Array.isArray(entryValue)
          ? renderEvidenceList(entryValue)
          : entryValue && typeof entryValue === "object"
            ? `<code>${escape(JSON.stringify(entryValue))}</code>`
            : escape(entryValue);
        return `<div><dt>${escape(key)}</dt><dd>${valueHtml}</dd></div>`;
      })
      .join("")}</dl>`;
  }

  function selectedReviewRow(rows, selectedRowKey) {
    if (selectedRowKey) {
      const match = rows.find((row) => row.__rowKey === selectedRowKey);
      if (match) return match;
    }
    return rows[0] || null;
  }

  function directoryDifferenceOptions(reviewData) {
    const labels = differenceLabels(reviewData);
    const rows = list(reviewData?.dualTableReview?.directoryRelationRows);
    return [...new Set(rows.flatMap((row) => list(row.differenceTypes).map((item) => text(item)).filter(Boolean)))]
      .sort((left, right) => (labels[left] || left).localeCompare(labels[right] || right, "zh-Hans-CN"));
  }

  function filterDirectoryRows(reviewData, filters = {}) {
    const mergedFilters = { ...FILTER_DEFAULTS, ...filters };
    const rows = list(reviewData?.dualTableReview?.directoryRelationRows);
    return rows.filter((row) => {
      const differenceTypes = list(row.differenceTypes).map((item) => text(item)).filter(Boolean);
      if (mergedFilters.directoryDifference && !differenceTypes.includes(mergedFilters.directoryDifference)) return false;
      if (!includes(row.securitySystem, mergedFilters.directorySystem)) return false;
      if (!includes(row.securityTechnologyModule, mergedFilters.directoryModule)) return false;
      if (!includes(row.securityTechnicalService, mergedFilters.directoryService)) return false;
      if (mergedFilters.possibleAliasOnly && !differenceTypes.includes("possible_alias")) return false;
      if (mergedFilters.directoryMismatchOnly && !differenceTypes.some((item) => item === "module_service_mismatch" || item === "system_module_mismatch" || item === "environment_only")) return false;
      if (mergedFilters.coverageGapOnly && !differenceTypes.some((item) => item === "catalog_unused" || item === "selective_reference_candidate")) return false;
      if (mergedFilters.query || mergedFilters.directoryQuery) {
        const keyword = [mergedFilters.directoryQuery, mergedFilters.query].filter(Boolean).join(" ");
        const usageRows = list(row.environmentUsageRows);
        const haystack = [
          row.securitySystemCategory,
          row.securitySystem,
          row.securityTechnologyModule,
          row.securityTechnicalService,
          row.securityTechnicalServiceKey,
          differenceTypes.join(" "),
          row.reviewSuggestion,
          usageRows.map((usage) => [usage.informationEnvironment, usage.environmentSegment, usage.informationObject, usage.objectContextKey, usage.declaredScopes, usage.excelRow].join(" ")).join(" "),
        ].join(" ");
        if (!includes(haystack, keyword)) return false;
      }
      return true;
    });
  }

  function directoryRelationClass(record) {
    const differences = list(record?.differenceTypes).map((item) => text(item));
    if (differences.includes("module_service_mismatch") || differences.includes("system_module_mismatch") || differences.includes("environment_only")) return " has-directory-risk";
    if (differences.includes("possible_alias")) return " has-alias-risk";
    if (differences.includes("catalog_unused") || differences.includes("selective_reference_candidate")) return " has-coverage-risk";
    return "";
  }

  function renderDifferenceBadges(record, reviewData) {
    const labels = differenceLabels(reviewData);
    const differences = list(record?.differenceTypes).map((item) => text(item)).filter(Boolean);
    if (!differences.length) return '<span class="empty-inline">/</span>';
    return `<div class="environment-review-prompts">${differences.map((item) => `<span class="is-diff-${escape(item)}">${escape(labels[item] || item)}</span>`).join("")}</div>`;
  }

  function uniqueCompact(values, limit = 3) {
    const items = [...new Set(list(values).map((value) => text(value).trim()).filter(Boolean))];
    if (!items.length) return "";
    const visible = items.slice(0, limit).join(" / ");
    return items.length > limit ? `${visible} 等 ${items.length} 项` : visible;
  }

  function usageRowsForSummary(record) {
    return list(record?.environmentUsageRows).length ? list(record?.environmentUsageRows) : list(record?.relatedEnvironmentUsageRows);
  }

  function relationOriginLabel(record) {
    const origin = text(record?.relationOrigin);
    if (origin === "catalog") return "目录表关系";
    if (origin === "environmentOnly") return "环境映射关系";
    return "对照关系";
  }

  function renderCatalogComparisonSide(record) {
    const hasCatalog = text(record?.relationOrigin) !== "environmentOnly";
    if (!hasCatalog) {
      return `
        <div class="environment-review-comparison-side is-missing">
          <strong>目录表无精确关系</strong>
          <span>当前安全系统 / 模块 / 服务组合来自环境映射表，模块清单中未找到同一条目录关系。</span>
        </div>
      `;
    }
    return `
      <div class="environment-review-comparison-side">
        <strong>${escape(record.securityTechnologyModule || "未命名模块")}</strong>
        <dl>
          <div><dt>安全系统分类</dt><dd>${renderCell(record.securitySystemCategory)}</dd></div>
          <div><dt>安全系统</dt><dd>${renderCell(record.securitySystem, "environment-review-token environment-review-token-system")}</dd></div>
          <div><dt>安全技术服务</dt><dd>${renderCell(record.securityTechnicalService, "environment-review-token environment-review-token-service")}</dd></div>
        </dl>
      </div>
    `;
  }

  function renderEnvironmentComparisonSide(record) {
    const rows = usageRowsForSummary(record);
    if (!rows.length) {
      return `
        <div class="environment-review-comparison-side is-muted">
          <strong>环境映射未精确引用</strong>
          <span>目录关系存在，但当前环境映射表没有完全相同的系统 / 模块 / 服务组合。此类默认按选择性引用候选处理。</span>
        </div>
      `;
    }
    return `
      <div class="environment-review-comparison-side">
        <strong>${escape(rows.length)} 条使用记录</strong>
        <dl>
          <div><dt>出现环境</dt><dd>${escape(uniqueCompact(rows.map((row) => row.informationEnvironment), 4) || "/")}</dd></div>
          <div><dt>涉及对象</dt><dd>${escape(uniqueCompact(rows.map((row) => row.informationObject), 3) || "/")}</dd></div>
          <div><dt>作用域</dt><dd>${escape(uniqueCompact(rows.flatMap((row) => list(row.declaredScopes)), 4) || "/")}</dd></div>
          <div><dt>Excel 行</dt><dd>${escape(uniqueCompact(rows.map((row) => row.excelRow), 6) || "/")}</dd></div>
        </dl>
      </div>
    `;
  }

  function renderDirectoryActiveFilters(filters) {
    const entries = [
      ["directoryQuery", "搜索", filters.directoryQuery || filters.query],
      ["directoryDifference", "差异类型", filters.directoryDifference],
      ["directorySystem", "安全系统", filters.directorySystem],
      ["directoryModule", "安全技术模块", filters.directoryModule],
      ["directoryService", "安全技术服务", filters.directoryService],
      ["directoryMismatchOnly", "目录不一致", filters.directoryMismatchOnly ? "是" : ""],
      ["possibleAliasOnly", "可能别名", filters.possibleAliasOnly ? "是" : ""],
      ["coverageGapOnly", "选择性引用候选", filters.coverageGapOnly ? "是" : ""],
    ].filter(([, , value]) => text(value).trim());
    if (!entries.length) return "";
    return `
      <div class="environment-review-active-filters" aria-label="当前双表筛选">
        ${entries.map(([, label, value]) => `<span>${escape(label)}：${escape(value)}</span>`).join("")}
        <button type="button" data-environment-review-clear-directory-filters>清空双表筛选</button>
      </div>
    `;
  }

  function directoryFilterCount(reviewData, predicate) {
    return list(reviewData?.dualTableReview?.directoryRelationRows).filter(predicate).length;
  }

  function renderDirectoryEmptyState(reviewData, filters) {
    const system = text(filters.directorySystem).trim();
    const module = text(filters.directoryModule).trim();
    const service = text(filters.directoryService).trim();
    const query = text(filters.directoryQuery || filters.query).trim();
    const nearby = [
      system ? `仅按安全系统「${system}」匹配：${directoryFilterCount(reviewData, (row) => includes(row.securitySystem, system))} 条` : "",
      module ? `仅按安全技术模块「${module}」匹配：${directoryFilterCount(reviewData, (row) => includes(row.securityTechnologyModule, module))} 条` : "",
      service ? `仅按安全技术服务「${service}」匹配：${directoryFilterCount(reviewData, (row) => includes(row.securityTechnicalService, service))} 条` : "",
      query ? `仅按搜索词「${query}」匹配：${directoryFilterCount(reviewData, (row) => includes([row.securitySystemCategory, row.securitySystem, row.securityTechnologyModule, row.securityTechnicalService, row.securityTechnicalServiceKey, row.reviewSuggestion].join(" "), query))} 条` : "",
    ].filter(Boolean);
    return `
      <div class="reference-empty environment-review-empty-explainer">
        <strong>当前组合没有精确目录关系。</strong>
        <p>这通常表示多个筛选条件来自不同目录分支，或差异类型筛选把结果排除了。可先清空筛选，再从目录树选择一条关系。</p>
        ${nearby.length ? `<ul>${nearby.map((item) => `<li>${escape(item)}</li>`).join("")}</ul>` : ""}
        <button type="button" class="environment-review-row-button" data-environment-review-clear-directory-filters>清空双表筛选</button>
      </div>
    `;
  }

  function selectedDirectoryRelation(rows, selectedKey) {
    if (selectedKey) {
      const match = rows.find((row) => row.__relationKey === selectedKey);
      if (match) return match;
    }
    return rows[0] || null;
  }

  function renderDirectoryTree(reviewData, selectedKey) {
    const categories = list(reviewData?.dualTableReview?.tree?.categories);
    if (!categories.length) return '<div class="reference-empty">暂无目录基准树。</div>';
    return `
      <aside class="environment-review-directory-tree">
        <div class="environment-review-pane-title">目录基准树</div>
        ${categories
          .map(
            (category) => `
              <details open>
                <summary>${escape(category.title)} <span>${escape(category.relationCount || 0)}</span></summary>
                ${list(category.systems)
                  .map(
                    (system) => `
                      <details>
                        <summary><button type="button" data-environment-review-directory-filter-name="directorySystem" data-environment-review-directory-filter-value="${escape(system.title)}">${escape(system.title)}</button><span>${escape(system.relationCount || 0)}</span></summary>
                        ${list(system.modules)
                          .map(
                            (module) => `
                              <button type="button" class="environment-review-tree-module" data-environment-review-directory-filter-name="directoryModule" data-environment-review-directory-filter-value="${escape(module.title)}" data-environment-review-directory-system-value="${escape(system.title)}">
                                <span>${escape(module.title)}</span>
                                <em>${escape(module.relationCount || list(module.relations).length)}</em>
                              </button>
                            `,
                          )
                          .join("")}
                      </details>
                    `,
                  )
                  .join("")}
              </details>
            `,
          )
          .join("")}
      </aside>
    `;
  }

  function renderDirectoryRelationTable(rows, selectedKey, reviewData) {
    return `
      <div class="environment-review-table-scroll environment-review-directory-table-scroll">
        <table class="environment-review-table environment-review-directory-table">
          <thead>
            <tr>
              <th>目录表这一边</th>
              <th>环境映射表这一边</th>
              <th>对照结论</th>
              <th>核对建议</th>
            </tr>
          </thead>
          <tbody>
            ${rows
              .map(
                (row) => `
                  <tr class="${row.__relationKey === selectedKey ? "is-selected" : ""}${directoryRelationClass(row)}">
                    <td>${renderCatalogComparisonSide(row)}</td>
                    <td>${renderEnvironmentComparisonSide(row)}</td>
                    <td>
                      <div class="environment-review-comparison-result">
                        <em>${escape(relationOriginLabel(row))}</em>
                        ${renderDifferenceBadges(row, reviewData)}
                        <button type="button" class="environment-review-row-button" data-environment-review-directory-key="${escape(row.__relationKey)}">查看依据</button>
                      </div>
                    </td>
                    <td>${renderCell(row.reviewSuggestion)}</td>
                  </tr>
                `,
              )
              .join("")}
          </tbody>
        </table>
      </div>
    `;
  }

  function renderUsageRowsTable(rows) {
    const usageRows = list(rows);
    if (!usageRows.length) return '<div class="reference-empty">环境映射表中暂无精确使用记录。</div>';
    return `
      <div class="environment-review-table-scroll environment-review-usage-table-scroll">
        <table class="environment-review-table environment-review-usage-table">
          <thead>
            <tr>
              <th>Excel 行</th>
              <th>信息化环境</th>
              <th>环境子类</th>
              <th>信息化对象</th>
              <th>作用域</th>
              <th>安全技术服务</th>
              <th>安全技术模块/措施</th>
              <th>安全系统</th>
              <th>证据</th>
            </tr>
          </thead>
          <tbody>
            ${usageRows
              .map(
                (row) => `
                  <tr>
                    <td>${escape(row.excelRow || "/")}</td>
                    <td>${renderCell(row.informationEnvironment)}</td>
                    <td>${renderCell(row.environmentSegment)}</td>
                    <td>${renderCell(row.informationObject)}</td>
                    <td>${renderMultiline(list(row.declaredScopes).join(" / "))}</td>
                    <td>${renderCell(row.securityTechnicalService, "environment-review-token environment-review-token-service")}</td>
                    <td>${renderCell(row.securityTechnologyModuleOrMeasure, "environment-review-token environment-review-token-module")}</td>
                    <td>${renderCell(row.securitySystem, "environment-review-token environment-review-token-system")}</td>
                    <td>${renderEvidenceObject({ mergedRange: row.mergedRanges, sourceCells: row.sourceCells })}</td>
                  </tr>
                `,
              )
              .join("")}
          </tbody>
        </table>
      </div>
    `;
  }

  function renderDualTableEvidencePanel(record, reviewData) {
    if (!record) {
      return `
        <aside class="environment-review-evidence-panel">
          <div class="environment-review-evidence-head">
          <strong>选中关系的双表对照</strong>
          <span>请选择一条关系查看两张表各自写了什么，以及为什么被标记。</span>
          </div>
        </aside>
      `;
    }
    const relatedRows = list(record.relatedEnvironmentUsageRows);
    const aliasItems = list(record.possibleAliasMatches);
    return `
      <aside class="environment-review-evidence-panel environment-review-directory-evidence">
        <div class="environment-review-evidence-head">
          <strong>选中关系的双表对照</strong>
          <span>${escape([record.securitySystem, record.securityTechnologyModule, record.securityTechnicalService].filter(Boolean).join(" / "))}</span>
        </div>
        <section class="environment-review-evidence-section">
          <h4>目录表这一边</h4>
          ${renderEvidenceObject({
            安全系统分类: record.securitySystemCategory,
            安全系统: record.securitySystem,
            安全技术模块: record.securityTechnologyModule,
            安全技术服务: record.securityTechnicalService,
            原始Excel行号: record.catalogEvidence?.sourceRows,
            mergedRange: record.catalogEvidence?.mergedRanges,
            sourceCells: record.catalogEvidence?.sourceCells,
          })}
        </section>
        <section class="environment-review-evidence-section">
          <h4>为什么被标记</h4>
          ${renderEvidenceObject({
            差异类型: list(record.differenceTypes).map((item) => differenceLabels(reviewData)[item] || item),
            模块服务一致: record.moduleServiceConsistent === false ? "否" : "是",
            系统模块一致: record.systemModuleConsistent === false ? "否" : "是",
            目录有但环境未用: list(record.differenceTypes).includes("catalog_unused") ? "是" : "否",
            环境有但目录没有: list(record.differenceTypes).includes("environment_only") ? "是" : "否",
            可能别名: aliasItems.length ? "是" : "否",
            选择性引用候选: list(record.differenceTypes).includes("selective_reference_candidate") ? "是" : "否",
          })}
          <p>${escape(record.reviewSuggestion || "")}</p>
        </section>
        <section class="environment-review-evidence-section">
          <h4>环境映射表这一边</h4>
          ${renderUsageRowsTable(record.environmentUsageRows)}
        </section>
        ${
          relatedRows.length && relatedRows.length !== list(record.environmentUsageRows).length
            ? `<section class="environment-review-evidence-section"><h4>相关候选行</h4>${renderUsageRowsTable(relatedRows)}</section>`
            : ""
        }
        ${
          aliasItems.length
            ? `<section class="environment-review-evidence-section"><h4>可能别名提示</h4>${renderEvidenceList(aliasItems.map((item) => `${item.environmentValue} ↔ ${item.catalogValue}（${item.similarityHint}，行 ${list(item.rows).join(" / ")}）`))}</section>`
            : ""
        }
      </aside>
    `;
  }

  function renderRowDirectoryEvidencePanel(row) {
    if (!row) {
      return `
        <aside class="environment-review-evidence-panel">
          <div class="environment-review-evidence-head">
            <strong>目录依据</strong>
            <span>请选择一行查看环境映射表与安全技术模块清单的差异依据。</span>
          </div>
        </aside>
      `;
    }
    const evidence = row.directoryEvidence || {};
    const patterns = list(evidence.patterns);
    const primaryPattern = patterns[0] || {};
    const topItems = list(evidence.topManualReviewItems);
    const firstTopItem = topItems[0] || {};
    const catalogEvidence = primaryPattern.catalogEvidence || firstTopItem.catalogEvidence || patterns[0]?.sampleRows?.[0]?.catalogMatch;
    const aliasItems = list(row.possibleAliasMatches);
    return `
      <aside class="environment-review-evidence-panel">
        <div class="environment-review-evidence-head">
          <strong>目录依据</strong>
          <span>${escape(contextLabel(row))}</span>
        </div>
        <dl class="environment-review-evidence-grid">
          <div><dt>Excel 行</dt><dd>${escape(row.excelRow || "/")}</dd></div>
          <div><dt>patternSignature</dt><dd><code>${escape(patternSignaturesFor(row).join(" / ") || primaryPattern.patternSignature || "/")}</code></dd></div>
          <div><dt>triageCategory</dt><dd>${renderEvidenceList(triageCategoriesFor(row), "/")}</dd></div>
          <div><dt>影响行数</dt><dd>${escape(primaryPattern.affectedRows || firstTopItem.affectedRows || "/")}</dd></div>
          <div><dt>影响对象上下文</dt><dd>${escape(primaryPattern.affectedObjectContexts || firstTopItem.affectedObjectContexts || "/")}</dd></div>
        </dl>
        <section class="environment-review-evidence-section">
          <h4>环境映射表关系</h4>
          ${renderEvidenceObject(evidence.environmentRelation)}
        </section>
        <section class="environment-review-evidence-section">
          <h4>安全技术模块清单依据</h4>
          ${renderEvidenceObject(catalogEvidence)}
        </section>
        <section class="environment-review-evidence-section">
          <h4>人工判断问题</h4>
          <p>${escape(evidence.suggestedManualAction || primaryPattern.suggestedManualAction || firstTopItem.suggestedManualAction || "判断是环境映射表错、模块清单错、命名口径不一致，还是目录全量关系与环境选择性引用的正常差异。")}</p>
        </section>
        ${
          aliasItems.length
            ? `<section class="environment-review-evidence-section"><h4>可能别名提示</h4>${renderEvidenceList(aliasItems.map((item) => `${item.environmentValue} ↔ ${item.catalogValue}（${item.similarityHint}）`))}</section>`
            : ""
        }
      </aside>
    `;
  }

  function renderContextGroup(group, selectedRowKey) {
    const summary = group.summary || {};
    const selectedKey = selectedRowKey || group.rows[0]?.__rowKey || "";
    return `
      <details class="environment-review-context" open>
        <summary>
          <span class="environment-review-context-title">${escape(group.label)}</span>
          <span class="environment-review-context-key">${escape(group.key)}</span>
          <span class="environment-review-context-stats">
            ${escape(group.rows.length)} 行 · ${escape(summary.scopeCount ?? countUnique(group.rows, "scope"))} 作用域 · ${escape(summary.serviceCount ?? countUnique(group.rows, "securityTechnicalService"))} 服务 · ${escape(summary.moduleCount ?? countUnique(group.rows, "securityTechnologyModule"))} 模块 · ${escape(summary.measureCount ?? countUnique(group.rows, "securityTechnicalMeasure"))} 措施
          </span>
        </summary>
        <div class="environment-review-table-scroll">
          <table class="environment-review-table">
            <thead>
              <tr>
                <th>作用域</th>
                <th>安全技术服务</th>
                <th>安全系统</th>
                <th>安全技术模块</th>
                <th>安全技术措施</th>
                <th>Excel 行</th>
                <th>node-details</th>
                <th>核对提示</th>
              </tr>
            </thead>
            <tbody>
              ${group.rows
                .map(
                  (row) => `
                    <tr class="${row.__rowKey === selectedKey ? "is-selected" : ""}">
                      <td>${renderCell(row.scope)}</td>
                      <td>${renderCell(row.securityTechnicalService, "environment-review-token environment-review-token-service")}</td>
                      <td>${renderCell(row.securitySystem, "environment-review-token environment-review-token-system")}</td>
                      <td>${renderCell(row.securityTechnologyModule, "environment-review-token environment-review-token-module")}</td>
                      <td>${renderCell(row.securityTechnicalMeasure, "environment-review-token environment-review-token-measure")}</td>
                      <td><button type="button" class="environment-review-row-button" data-environment-review-row-key="${escape(row.__rowKey)}">${escape(row.excelRow || "查看")}</button></td>
                      <td>${renderCell(row.nodeDetailsContains)}</td>
                      <td>${renderCell(row.reviewPrompts || row.riskLevel || "")}</td>
                    </tr>
                  `,
                )
                .join("")}
            </tbody>
          </table>
        </div>
      </details>
    `;
  }

  function renderEnvironmentObjectReview({ reviewData, filters = {}, selectedRowKey = "" } = {}) {
    const rows = list(reviewData?.rows);
    const mergedFilters = { ...FILTER_DEFAULTS, ...filters };
    const filteredRows = filterRows(reviewData, mergedFilters)
      .map((row, index) => ({ ...row, __rowKey: rowKey(row, index) }))
      .sort((left, right) => (mergedFilters.topOnly ? topPriority(left) - topPriority(right) || excelRow(left) - excelRow(right) : excelRow(left) - excelRow(right)));
    const triageSummary = reviewData.triageSummary || {};
    const selectedRow = selectedReviewRow(filteredRows, selectedRowKey || "");
    const triageOptions = Object.keys(triageSummary.triageCategoryLabels || {}).sort();
    return `
      <div class="environment-review-filters">
        ${renderTextFilter("全局搜索", "query", mergedFilters.query, "环境、对象、服务、Excel 行号")}
        ${renderSelect("信息化环境", "environment", mergedFilters.environment, uniqueValues(rows, "informationEnvironment"))}
        ${renderSelect("环境子类", "segment", mergedFilters.segment, uniqueValues(rows, "environmentSegment"))}
        ${renderTextFilter("信息化对象", "object", mergedFilters.object, "对象名称")}
        ${renderTextFilter("objectContextKey", "contextKey", mergedFilters.contextKey, "环境||子类||对象")}
        ${renderTextFilter("作用域", "scope", mergedFilters.scope, "作用域编号或名称")}
        ${renderTextFilter("安全技术服务", "service", mergedFilters.service, "服务编号或名称")}
        ${renderTextFilter("模块/措施", "moduleMeasure", mergedFilters.moduleMeasure, "模块或措施名称")}
        ${renderSelect("安全系统", "securitySystem", mergedFilters.securitySystem, uniqueValues(rows, "securitySystem"))}
        ${renderSelect("issueType", "issueType", mergedFilters.issueType, uniqueIssueTypes(rows))}
        ${renderSelect("triageCategory", "triageCategory", mergedFilters.triageCategory, triageOptions)}
        <div class="environment-review-toggle-row">
          ${renderToggle("只看 Top 人工核对项", "topOnly", mergedFilters.topOnly)}
          ${renderToggle("可能别名问题", "possibleAliasOnly", mergedFilters.possibleAliasOnly)}
          ${renderToggle("1:N 展开", "serviceExpansionOnly", mergedFilters.serviceExpansionOnly)}
          ${renderToggle("目录不一致", "directoryMismatchOnly", mergedFilters.directoryMismatchOnly)}
          ${renderToggle("覆盖差异候选", "coverageGapOnly", mergedFilters.coverageGapOnly)}
          ${renderToggle("同名不同上下文", "sameNameOnly", mergedFilters.sameNameOnly)}
          ${renderToggle("底图详情未命中", "nodeMissingOnly", mergedFilters.nodeMissingOnly)}
          ${renderToggle("服务偏多", "manyServicesOnly", mergedFilters.manyServicesOnly)}
          ${renderToggle("有模块但无安全系统", "missingSystemWithModuleOnly", mergedFilters.missingSystemWithModuleOnly)}
          ${renderToggle("模块/措施偏多", "abnormalModuleMeasureOnly", mergedFilters.abnormalModuleMeasureOnly)}
          ${renderToggle("完整重复关系", "duplicateServiceOnly", mergedFilters.duplicateServiceOnly)}
          ${renderToggle("作用域疑似缺漏", "missingScopeOnly", mergedFilters.missingScopeOnly)}
          ${renderToggle("正式关系缺失", "relationIssueOnly", mergedFilters.relationIssueOnly)}
        </div>
      </div>
      <div class="environment-review-layout">
        <div class="environment-review-group-list">
          ${filteredRows.length ? renderExcelRowsTable(filteredRows, selectedRow?.__rowKey || selectedRowKey || "", mergedFilters.topOnly) : '<div class="reference-empty">当前筛选条件下没有核对行。</div>'}
        </div>
        ${renderRowDirectoryEvidencePanel(selectedRow)}
      </div>
    `;
  }

  function renderDualTableReview({ reviewData, filters = {}, selectedDirectoryRelationKey = "" } = {}) {
    const mergedFilters = { ...FILTER_DEFAULTS, ...filters };
    const directoryRows = filterDirectoryRows(reviewData, mergedFilters).map((row, index) => ({ ...row, __relationKey: directoryRelationKey(row, index) }));
    const selectedRelation = selectedDirectoryRelation(directoryRows, selectedDirectoryRelationKey || "");
    const summary = reviewData?.dualTableReview?.summary || {};
    const labels = differenceLabels(reviewData);
    return `
      <div class="environment-review-dual-summary">
        <span><strong>${escape(summary.directoryRelationCount ?? 0)}</strong>目录关系</span>
        <span><strong>${escape(summary.environmentOnlyRelationCount ?? 0)}</strong>环境有目录无</span>
        <span><strong>${escape(summary.catalogUnusedRelationCount ?? 0)}</strong>目录有环境未用</span>
        <span><strong>${escape(summary.moduleServiceMismatchRelationCount ?? 0)}</strong>模块-服务不一致</span>
        <span><strong>${escape(summary.systemModuleMismatchRelationCount ?? 0)}</strong>系统-模块不一致</span>
        <span><strong>${escape(summary.possibleAliasRelationCount ?? 0)}</strong>可能别名关系</span>
      </div>
      <div class="environment-review-filters environment-review-directory-filters">
        ${renderTextFilter("目录关系搜索", "directoryQuery", mergedFilters.directoryQuery || mergedFilters.query, "系统、模块、服务、对象、Excel 行号")}
        ${renderSelect("差异类型", "directoryDifference", mergedFilters.directoryDifference, directoryDifferenceOptions(reviewData).map((value) => ({ value, label: labels[value] || value })))}
        ${renderTextFilter("安全系统", "directorySystem", mergedFilters.directorySystem, "安全系统")}
        ${renderTextFilter("安全技术模块", "directoryModule", mergedFilters.directoryModule, "模块名称")}
        ${renderTextFilter("安全技术服务", "directoryService", mergedFilters.directoryService, "服务编号或名称")}
        <div class="environment-review-toggle-row">
          ${renderToggle("目录不一致", "directoryMismatchOnly", mergedFilters.directoryMismatchOnly)}
          ${renderToggle("可能别名", "possibleAliasOnly", mergedFilters.possibleAliasOnly)}
          ${renderToggle("选择性引用候选", "coverageGapOnly", mergedFilters.coverageGapOnly)}
        </div>
      </div>
      ${renderDirectoryActiveFilters(mergedFilters)}
      <div class="environment-review-directory-layout">
        ${renderDirectoryTree(reviewData, selectedRelation?.__relationKey || selectedDirectoryRelationKey || "")}
        <div class="environment-review-group-list">
          ${directoryRows.length ? renderDirectoryRelationTable(directoryRows, selectedRelation?.__relationKey || selectedDirectoryRelationKey || "", reviewData) : renderDirectoryEmptyState(reviewData, mergedFilters)}
        </div>
        ${renderDualTableEvidencePanel(selectedRelation, reviewData)}
      </div>
    `;
  }

  function render({ reviewData, filters = {}, selectedRowKey = "", selectedDirectoryRelationKey = "" } = {}) {
    const rows = list(reviewData?.rows);
    if (!reviewData) {
      return `<section class="environment-review-workbench">${components.StatusBadge?.render?.({ type: "pending", label: "正在加载人工核对数据" }) || ""}<div class="reference-empty">正在加载人工核对清单。</div></section>`;
    }
    if (!rows.length) {
      return `<section class="environment-review-workbench"><div class="reference-empty">暂无人工核对清单数据，请先生成 environment-manual-review-checklist.json。</div></section>`;
    }
    const mergedFilters = { ...FILTER_DEFAULTS, ...filters };
    const reviewMode = mergedFilters.reviewMode === "directory" ? "directory" : "environment";
    const summary = reviewData.summary || {};
    const triageSummary = reviewData.triageSummary || {};
    return `
      <section class="environment-review-workbench">
        <div class="environment-review-head">
          <div>
            <h2>环境映射临时数据核对</h2>
            <p>${reviewMode === "directory" ? "以安全技术模块清单为目录基准，对照环境映射表中的使用位置和差异依据。" : "严格按原始 Excel 行顺序展示，使用合并单元格效果核对服务、模块/措施与安全系统关系。"}</p>
          </div>
          <div class="environment-review-stats">
            <span><strong>${escape(summary.selectedContextCount ?? countUnique(rows, "objectContextKey"))}</strong>上下文</span>
            <span><strong>${escape(summary.selectedRowCount ?? rows.length)}</strong>原始行</span>
            <span><strong>${escape(reviewMode === "directory" ? reviewData?.dualTableReview?.summary?.directoryRelationCount ?? 0 : filterRows(reviewData, mergedFilters).length)}</strong>${reviewMode === "directory" ? "目录关系" : "当前行"}</span>
            <span><strong>${escape(summary.duplicateExactServiceChildRelationRowCount ?? summary.duplicateServiceRowCount ?? 0)}</strong>完整重复关系行</span>
            <span><strong>${escape(triageSummary.topManualReviewItemCount ?? 0)}</strong>Top 核对项</span>
            <span><strong>${escape(triageSummary.possibleAliasMatchCount ?? 0)}</strong>可能别名</span>
          </div>
        </div>
        ${renderModeTabs(reviewMode)}
        ${
          reviewMode === "directory"
            ? renderDualTableReview({ reviewData, filters: mergedFilters, selectedDirectoryRelationKey })
            : renderEnvironmentObjectReview({ reviewData, filters: mergedFilters, selectedRowKey })
        }
      </section>
    `;
  }

  components.EnvironmentDataReviewTable = { render, filterRows, filterDirectoryRows };
})();
