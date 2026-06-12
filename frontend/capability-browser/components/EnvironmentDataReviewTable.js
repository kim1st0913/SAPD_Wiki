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
    sameNameOnly: false,
    nodeMissingOnly: false,
    manyServicesOnly: false,
    missingSystemWithModuleOnly: false,
    abnormalModuleMeasureOnly: false,
    duplicateServiceOnly: false,
    missingScopeOnly: false,
    relationIssueOnly: false,
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
      if (mergedFilters.sameNameOnly && row.sameNameDifferentContext !== "是") return false;
      if (mergedFilters.nodeMissingOnly && row.nodeDetailsContains !== "否") return false;
      if (mergedFilters.missingSystemWithModuleOnly && !(text(row.securityTechnologyModule).trim() && !text(row.securitySystem).trim())) return false;
      if (mergedFilters.manyServicesOnly && !contextIsMany(summary, [row])) return false;
      if (mergedFilters.abnormalModuleMeasureOnly && !contextHasAbnormalModuleMeasure(summary, [row])) return false;
      const issueTypes = list(row.issueTypes);
      if (mergedFilters.duplicateServiceOnly && !issueTypes.includes("duplicate_exact_service_child_relation") && !issueTypes.includes("duplicate_service_in_object_context")) return false;
      if (mergedFilters.missingScopeOnly && !issueTypes.includes("missing_scope_by_service_reverse_check")) return false;
      if (mergedFilters.relationIssueOnly && !issueTypes.some((issue) => text(issue).startsWith("missing_"))) return false;
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
          row.excelRow,
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
            .map((option) => `<option value="${escape(option)}" ${option === value ? "selected" : ""}>${escape(option)}</option>`)
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
    const issues = list(row.issueTypes);
    if (row.riskLevel === "high") return " has-high-risk";
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
    const issues = list(row.issueTypes);
    const prompt = text(row.reviewPrompts || row.riskLevel || "");
    if (!prompt && !issues.length) return '<span class="empty-inline">/</span>';
    return `
      <div class="environment-review-prompts">
        ${issues.map((issue) => `<span>${escape(issue)}</span>`).join("")}
        ${prompt ? `<p>${escape(prompt)}</p>` : ""}
      </div>
    `;
  }

  function renderExcelRowsTable(rows, selectedRowKey) {
    const sortedRows = [...rows].sort((left, right) => excelRow(left) - excelRow(right));
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
                    ${renderMergedCell(sortedRows, index, serviceMergeKey, renderCell(row.securityTechnicalService, "environment-review-token environment-review-token-service"), list(row.issueTypes).some((issue) => issue === "duplicate_exact_service_child_relation" || issue === "duplicate_service_in_object_context") ? "environment-review-merged-cell issue-duplicate-service" : "environment-review-merged-cell")}
                    ${renderMergedCell(sortedRows, index, moduleMeasureMergeKey, renderModuleMeasureCell(row), "environment-review-merged-cell")}
                    ${renderMergedCell(sortedRows, index, systemMergeKey, renderCell(row.securitySystem, "environment-review-token environment-review-token-system"), list(row.issueTypes).includes("missing_security_system") ? "environment-review-merged-cell issue-missing-system" : "environment-review-merged-cell")}
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

  function render({ reviewData, filters = {}, selectedRowKey = "" } = {}) {
    const rows = list(reviewData?.rows);
    if (!reviewData) {
      return `<section class="environment-review-workbench">${components.StatusBadge?.render?.({ type: "pending", label: "正在加载人工核对数据" }) || ""}<div class="reference-empty">正在加载人工核对清单。</div></section>`;
    }
    if (!rows.length) {
      return `<section class="environment-review-workbench"><div class="reference-empty">暂无人工核对清单数据，请先生成 environment-manual-review-checklist.json。</div></section>`;
    }
    const mergedFilters = { ...FILTER_DEFAULTS, ...filters };
    const filteredRows = filterRows(reviewData, mergedFilters)
      .map((row, index) => ({ ...row, __rowKey: rowKey(row, index) }))
      .sort((left, right) => excelRow(left) - excelRow(right));
    const summary = reviewData.summary || {};
    return `
      <section class="environment-review-workbench">
        <div class="environment-review-head">
          <div>
            <h2>环境映射 Excel 关系核对表</h2>
            <p>严格按原始 Excel 行顺序展示，使用合并单元格效果核对服务、模块/措施与安全系统关系。</p>
          </div>
          <div class="environment-review-stats">
            <span><strong>${escape(summary.selectedContextCount ?? countUnique(rows, "objectContextKey"))}</strong>上下文</span>
            <span><strong>${escape(summary.selectedRowCount ?? rows.length)}</strong>原始行</span>
            <span><strong>${escape(filteredRows.length)}</strong>当前行</span>
            <span><strong>${escape(summary.duplicateExactServiceChildRelationRowCount ?? summary.duplicateServiceRowCount ?? 0)}</strong>完整重复关系行</span>
            <span><strong>${escape(summary.scopeCompletenessIssueContextCount ?? 0)}</strong>作用域疑似缺漏</span>
          </div>
        </div>
        <div class="environment-review-filters">
          ${renderTextFilter("全局搜索", "query", mergedFilters.query, "环境、对象、服务、Excel 行号")}
          ${renderSelect("信息化环境", "environment", mergedFilters.environment, uniqueValues(rows, "informationEnvironment"))}
          ${renderSelect("环境子类", "segment", mergedFilters.segment, uniqueValues(rows, "environmentSegment"))}
          ${renderTextFilter("信息化对象", "object", mergedFilters.object, "对象名称")}
          ${renderTextFilter("objectContextKey", "contextKey", mergedFilters.contextKey, "环境||子类||对象")}
          ${renderTextFilter("作用域", "scope", mergedFilters.scope, "作用域编号或名称")}
          ${renderTextFilter("安全技术服务", "service", mergedFilters.service, "服务编号或名称")}
          <div class="environment-review-toggle-row">
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
            ${filteredRows.length ? renderExcelRowsTable(filteredRows, selectedRowKey || "") : '<div class="reference-empty">当前筛选条件下没有核对行。</div>'}
          </div>
        </div>
      </section>
    `;
  }

  components.EnvironmentDataReviewTable = { render, filterRows };
})();
