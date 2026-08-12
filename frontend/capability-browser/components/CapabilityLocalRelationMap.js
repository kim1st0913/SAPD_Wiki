(function () {
  const components = (window.sapdComponents = window.sapdComponents || {});
  const utils = components.utils;
  const display = window.sapdDisplay || {};
  const SLIDING_SCALE_IMAGE_PATH = "./assets/sliding-scale-page-4.png";

  const LAYERS = [
    { key: "decision", label: "决策层" },
    { key: "management", label: "管理层" },
    { key: "execution", label: "执行层" },
    { key: "supervision", label: "监督层" },
  ];

  function list(value) {
    if (utils?.list) return utils.list(value);
    return Array.isArray(value) ? value : [];
  }

  function text(value) {
    if (utils?.text) return utils.text(value);
    return value == null ? "" : String(value);
  }

  function escape(value) {
    if (utils?.escapeHtml) return utils.escapeHtml(value);
    return text(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }

  function annotationValueAttrs(value) {
    const normalized = text(value).trim();
    if (!normalized) return "";
    if (display.annotationValueAttrs) return display.annotationValueAttrs(utils, normalized);
    const escaped = escape(normalized);
    return ` data-annotation-value="true" data-copy-text="${escaped}" title="${escaped}" data-annotation-tooltip="${escaped}"`;
  }

  function valueOf(value, fallback = "待补充") {
    const normalized = text(value).trim();
    return normalized || fallback;
  }

  function entityName(item, fallback = "待补充") {
    if (item == null) return fallback;
    if (typeof item === "string") return valueOf(item, fallback);
    return valueOf(item.title || item.name || item.serviceName || item.scopeName || item.code || item.id, fallback);
  }

  function entityCode(item) {
    return text(item?.code || item?.serviceCode || item?.scopeCode || "").trim();
  }

  function entityKey(item) {
    return [item?.id, item?.code, item?.name, item?.title, item?.serviceName, item?.scopeName, item?.relationKind].map(text).filter(Boolean).join("::");
  }

  function standardKey(item) {
    const code = text(item?.frameworkCode || item?.code).trim().toLowerCase();
    if (code) return `code:${code.replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "")}`;
    const title = text(item?.frameworkTitle || item?.title || item?.name).trim().toLowerCase();
    if (title) return `title:${title.replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "")}`;
    return entityKey(item);
  }

  function standardControlKey(item) {
    const framework = text(item?.frameworkCode || item?.frameworkTitle).trim().toLowerCase().replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "");
    const control = text(item?.originalControlId || item?.code || item?.title || item?.name).trim().toLowerCase().replace(/\s+/g, "");
    return `${framework}:${control}` || entityKey(item);
  }

  function isPlaceholder(value) {
    const normalized = text(value).trim().toLowerCase();
    return !normalized || ["/", "n/a", "na", "none", "null", "待补充", "暂无", "未编号", "待确认"].includes(normalized);
  }

  function isDisplayableStandardControl(item = {}) {
    return !isPlaceholder(item.originalControlId || item.code) && !isPlaceholder(item.title || item.name);
  }

  function unique(items, keyFn = entityKey) {
    const seen = new Set();
    return list(items).filter((item) => {
      const key = keyFn(item) || JSON.stringify(item);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  function statusText(status) {
    if (status === "ambiguous" || status === "ambiguous_service_mapping" || status === "pending") return display.state?.("pending_review") || "待确认";
    if (status === "missing") return display.state?.("missing") || "待补充";
    if (status === "no_service" || status === "not_applicable") return display.state?.("not_applicable") || "不适用";
    if (status === "description") return "说明类";
    return "已映射";
  }

  function metric(label, value) {
    return `<span><strong>${escape(value)}</strong>${escape(label)}</span>`;
  }

  function chip(label, tone = "") {
    return `<span class="preview-chip ${tone ? `tone-${escape(tone)}` : ""}">${escape(label)}</span>`;
  }

  function tooltipText(item) {
    return [
      item?.frameworkTitle || item?.frameworkCode || "",
      item?.originalControlId || entityCode(item),
      entityName(item, ""),
      item?.description || "",
    ]
      .map((value) => text(value).trim())
      .filter(Boolean)
      .join("\n");
  }

  function codeWithBreaks(value) {
    return escape(text(value)).replace(/([.\/:：-])/g, "$1<wbr>").replace(/(\s+)/g, "$1<wbr>");
  }

  function standardControlChip(item) {
    const code = text(item?.originalControlId || entityCode(item) || entityName(item, "未编号")).trim();
    const tooltip = tooltipText(item);
    return `<span class="standard-tooltip-chip standard-control-code-chip standard-control-inline standard-code-breaks" data-tooltip="${escape(tooltip)}" aria-label="${escape(tooltip || code)}" tabindex="0"${annotationValueAttrs(code)}>${codeWithBreaks(code)}</span>`;
  }

  function linkByServiceKey(links = []) {
    const map = new Map();
    for (const link of list(links)) {
      const keys = [link.serviceId, link.serviceCode, link.serviceName].map(text).filter(Boolean);
      for (const key of keys) map.set(key, link);
    }
    return map;
  }

  function matchLink(pair, linkMap) {
    const keys = [pair.serviceId, pair.serviceCode, pair.serviceName].map(text).filter(Boolean);
    for (const key of keys) {
      if (linkMap.has(key)) return linkMap.get(key);
    }
    return null;
  }

  function groupedTechnicalRows(technical = {}) {
    const linkMap = linkByServiceKey(technical.serviceModuleMeasureLinks);
    const groups = new Map();
    for (const pair of list(technical.scopeServicePairs)) {
      const scopeKey = pair.scopeId || pair.scopeCode || pair.scopeName || "pending-scope";
      const group =
        groups.get(scopeKey) || {
          id: scopeKey,
          scopeCode: pair.scopeCode || "",
          scopeName: pair.scopeName || "待补充作用域",
          services: [],
        };
      const link = matchLink(pair, linkMap);
      group.services.push({
        id: pair.serviceId || pair.serviceCode || pair.serviceName || `${scopeKey}:service`,
        serviceCode: pair.serviceCode || link?.serviceCode || "",
        serviceName: pair.serviceName || link?.serviceName || "待补充服务",
        status: pair.status || link?.status || "mapped",
        modules: list(link?.modules),
        measures: list(link?.measures),
      });
      groups.set(scopeKey, group);
    }
    return [...groups.values()];
  }

  function countPending(map = {}) {
    const technical = map.technical || {};
    const management = map.management || {};
    const technicalPending = list(technical.scopeServicePairs).filter((pair) => ["ambiguous", "ambiguous_service_mapping", "pending", "missing", "no_service"].includes(pair.status)).length;
    const missingModules = list(technical.serviceModuleMeasureLinks).filter((link) => !list(link.modules).length).length;
    const missingMeasures = list(technical.serviceModuleMeasureLinks).filter((link) => !list(link.measures).length).length;
    return technicalPending + missingModules + missingMeasures + list(management.workFunctionsByLayer?.unknown).length + 1;
  }

  function relationshipStats(map = {}) {
    const technical = map.technical || {};
    const management = map.management || {};
    const modules = unique(list(technical.serviceModuleMeasureLinks).flatMap((link) => list(link.modules))).length;
    const measures = unique(list(technical.serviceModuleMeasureLinks).flatMap((link) => list(link.measures))).length;
    const processTree = list(management.processTree);
    const l2Processes = processTree.length;
    const l3Processes = processTree.reduce((sum, group) => sum + list(group.l3Processes).length, 0);
    const l4Activities = processTree.reduce((sum, group) => sum + list(group.l3Processes).reduce((inner, process) => inner + list(process.activities).length, 0), 0);
    const standards = list(map.standards?.frameworks || map.standardFrameworks);
    const controls = list(map.standards?.controls || map.standardControls);
    return {
      scopes: groupedTechnicalRows(technical).length,
      services: list(technical.serviceModuleMeasureLinks).length || list(technical.scopeServicePairs).length,
      modules,
      measures,
      works: list(management.securityWorks).length,
      functions: list(management.workFunctions).length,
      processes: l3Processes,
      l2Processes,
      l3Processes,
      l4Activities,
      standardStatus: controls.length ? `${controls.length}` : standards.length ? `${standards.length}` : "待投影",
      pending: countPending(map),
    };
  }

  function renderFocusStrip(map = {}, focusOverview = {}, capabilityOverview = {}) {
    const focus = map.focus || {};
    const path = focusOverview.path || {};
    const overview = capabilityOverview || {};
    const selected = overview.selected || {};
    const useOverview = overview.detailPolicy === "overview" || overview.detailPolicy === "mixed_summary";
    const header = useOverview && selected.id ? { code: valueOf(selected.code, overview.levelLabel || "能力对象"), title: entityName(selected, "未命名能力") } : focusHeader(focus);
    const pathHtml = useOverview
      ? [chip(overview.levelLabel || "总览"), chip(overview.summaryHint || "总览优先")]
      : [path.category, path.domain, path.capability].filter(Boolean).map((item) => chip(entityName(item)));
    return `
      <header class="preview-focus-strip">
        <div class="preview-focus-main">
          <span>${escape(header.code)}</span>
          <strong>${escape(header.title)}</strong>
        </div>
        <div class="preview-focus-path">
          ${pathHtml.join("") || chip("能力路径待补充")}
        </div>
      </header>
    `;
  }

  function focusHeader(focus = {}) {
    const title = entityName(focus, "未命名关注点");
    const explicitCode = text(focus.code).trim();
    if (explicitCode) return { code: explicitCode, title };
    const match = title.match(/^(.*?)[\s　]+([TGM])$/);
    if (match) return { code: match[2], title: valueOf(match[1], title) };
    return { code: "无编码", title };
  }

  function mappingObjectChips(items, empty = "暂无") {
    const rows = unique(items).filter(Boolean).slice(0, 4);
    if (!rows.length) return `<span class="empty-inline">${escape(window.sapdDisplay?.emptyMark?.() || "/")}</span>`;
    return rows.map((item, index) => chip(entityName(item), index < 2 ? "primary" : "")).join("");
  }

  function standardControlChips(items, empty = "暂无控制项") {
    const rows = unique(items, standardControlKey).filter(Boolean).filter(isDisplayableStandardControl);
    if (!rows.length) return `<span class="empty-inline">${escape(window.sapdDisplay?.emptyMark?.() || "/")}</span>`;
    return rows.map((item) => standardControlChip(item)).join("");
  }

  function functionLayerGroups(groups = {}) {
    return LAYERS.map((layer) => ({
      ...layer,
      rows: list(groups[layer.key]),
    }));
  }

  function renderFunctionLayerCell(groups = []) {
    return `
      <div class="management-function-cell">
        ${groups
          .map(
            (group) => `
              <section>
                <strong>${escape(group.label)}</strong>
                <div>${mappingObjectChips(group.rows, "暂无")}</div>
              </section>
            `,
          )
          .join("")}
      </div>
    `;
  }

  function renderMappingTable({ columns = [], rows = [], emptyTitle = "暂无映射矩阵", emptyBody = "当前关注点尚未形成该视角的可展示映射。", mode = "technical", title = "映射矩阵", description = "", summary = "" } = {}) {
    const safeColumns = columns.length ? columns : [{ key: "empty", label: "映射对象" }];
    return `
      <section class="preview-matrix-panel ${escape(mode)}-matrix-panel">
        <header>
          <div>
            <h3>${escape(title)}</h3>
            ${description ? `<p>${escape(description)}</p>` : ""}
          </div>
          ${summary ? `<span>${escape(summary)}</span>` : ""}
        </header>
        <div class="preview-mapping-table-wrap" aria-label="${escape(title)}">
          <table class="preview-mapping-table ${escape(mode)}-mapping-table">
            <thead>
              <tr>
                ${safeColumns.map((column) => `<th>${escape(column.label)}</th>`).join("")}
              </tr>
            </thead>
            <tbody>
              ${
                rows.length
                  ? rows
                      .slice(0, 10)
                      .map(
                        (row) => `
                          <tr>
                            ${safeColumns
                              .map((column) => {
                                const value = row[column.key];
                                if (column.type === "standardControls") return `<td><div class="preview-chip-row standard-control-chip-row">${standardControlChips(value, column.empty)}</div></td>`;
                                if (column.type === "chips") return `<td><div class="preview-chip-row">${mappingObjectChips(value, column.empty)}</div></td>`;
                                if (column.type === "status") return `<td><span class="preview-status ${escape(row.statusTone || "")}">${escape(value || "已映射")}</span></td>`;
                                if (column.type === "path") return `<td><strong>${escape(value?.title || "待补充")}</strong>${value?.code ? `<span>${escape(value.code)}</span>` : ""}</td>`;
                                if (column.type === "functionLayers") return `<td>${renderFunctionLayerCell(value)}</td>`;
                                return `<td>${escape(value || column.empty || "暂无")}</td>`;
                              })
                              .join("")}
                          </tr>
                        `,
                      )
                      .join("")
                  : `<tr class="preview-mapping-empty-row"><td colspan="${safeColumns.length}"><div class="reference-empty">${emptyBody ? `<strong>${escape(emptyTitle)}</strong><span>${escape(emptyBody)}</span>` : escape(emptyTitle)}</div></td></tr>`
              }
            </tbody>
          </table>
        </div>
      </section>
    `;
  }

  function technicalTableRows(map = {}) {
    return groupedTechnicalRows(map.technical)
      .flatMap((group) =>
        group.services.map((service) => ({
          scope: { title: entityName(group.scopeName), code: group.scopeCode },
          service: { title: entityName(service.serviceName), code: service.serviceCode },
        })),
      )
      .slice(0, 6);
  }

  function managementTableRows(map = {}) {
    const works = list(map.management?.securityWorks);
    const byLayer = map.management?.workFunctionsByLayer || {};
    const processGroups = list(map.management?.processTree);
    const functions = functionLayerGroups(byLayer);
    const fallbackWork = works[0] || null;
    const rows = [];
    for (const group of processGroups) {
      const l3Rows = list(group.l3Processes);
      if (!l3Rows.length) {
        rows.push({
          work: fallbackWork ? [fallbackWork] : [],
          functions,
          l2: entityName(group.l2ProcessGroup, "L2 流程组"),
          l3: "",
          l4: [],
        });
      }
      for (const process of l3Rows.slice(0, 2)) {
        rows.push({
          work: works[rows.length % Math.max(works.length, 1)] || fallbackWork ? [works[rows.length % Math.max(works.length, 1)] || fallbackWork] : [],
          functions,
          l2: entityName(group.l2ProcessGroup, "L2 流程组"),
          l3: entityName(process, "L3 流程"),
          l4: list(process.activities),
        });
      }
    }
    if (!rows.length && (works.length || list(map.management?.workFunctions).length)) {
      rows.push({
        work: fallbackWork ? [fallbackWork] : [],
        functions,
        l2: "",
        l3: "",
        l4: [],
      });
    }
    return rows.slice(0, 6);
  }

  function standardTableRows(map = {}) {
    const standards = unique(list(map.standards?.frameworks || map.standardFrameworks), standardKey);
    const controls = list(map.standards?.controls || map.standardControls).filter(isDisplayableStandardControl);
    return standards.map((standard) => ({
      standard: entityName(standard),
      controls: controls.filter((control) => !control.frameworkCode || !entityCode(standard) || control.frameworkCode === entityCode(standard)),
    }));
  }

  function renderStandardMappingMatrix(rows = [], summary = "") {
    const mappingRows = list(rows);
    return `
      <section class="semantic-panel standard-mapping-section">
        <div class="matrix-section-head">
          <div>
            <h3>标准 / 框架映射</h3>
            <p>当前关注点 -> 标准 / 框架 -> 条款 / 控制项</p>
          </div>
          <span>${escape(summary || "0 控制项")}</span>
        </div>
        <div class="relationship-matrix-scroll semantic-scroll">
          <table class="semantic-mapping-table standard-mapping-table">
            <thead>
              <tr>
                <th>标准 / 框架</th>
                <th>条款 / 控制项</th>
              </tr>
            </thead>
            <tbody>
              ${
                mappingRows.length
                  ? mappingRows
                      .slice(0, 10)
                      .map(
                        (row) => `
                          <tr>
                            <td><strong class="standard-framework-name"${annotationValueAttrs(row.standard)}>${escape(row.standard || "待补充")}</strong></td>
                            <td><div class="standard-control-chip-row">${standardControlChips(row.controls, "暂无控制项")}</div></td>
                          </tr>
                        `,
                      )
                      .join("")
                  : '<tr class="semantic-empty-row"><td colspan="2"><div class="reference-empty">暂无条款/控制项对应能力关注点</div></td></tr>'
              }
            </tbody>
          </table>
        </div>
      </section>
    `;
  }

  function countLabel(value, unit) {
    const normalized = text(value).trim();
    if (!normalized || normalized === "待投影" || normalized === "无直接投影") return normalized || "待投影";
    return `${normalized} ${unit}`;
  }

  function visibleTechnicalMappingRows(rows = []) {
    return list(rows).filter((row) => row?.status === "ambiguous_service_mapping" || list(row?.services).length);
  }

  function confirmedTechnicalServiceCount(rows = []) {
    return unique(list(rows).flatMap((row) => list(row.services))).length;
  }

  function percent(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) return 0;
    return Math.max(0, Math.min(100, Math.round(number * 100)));
  }

  function coverageBars(coverage = []) {
    const rows = list(coverage);
    if (!rows.length) return `<div class="capability-overview-empty">暂无覆盖统计</div>`;
    return rows
      .map(
        (group) => `
          <section class="capability-overview-coverage-group tone-${escape(group.key || "")}">
            <strong>${escape(group.label || "覆盖项")}</strong>
            <div class="capability-overview-coverage-lines">
              ${list(group.items)
                .map(
                  (item) => `
                    <div class="capability-overview-coverage-line" style="--coverage:${percent(item.ratio)}%">
                      <span>${escape(item.label || "覆盖项")}</span>
                      <b>${escape(item.value ?? 0)}/${escape(item.total ?? 0)}</b>
                      <em>${escape(`${percent(item.ratio)}%`)}</em>
                      <i aria-hidden="true"></i>
                    </div>
                  `,
                )
                .join("")}
            </div>
          </section>
        `,
      )
      .join("");
  }

  function childStatsLine(child = {}) {
    const structure = child.structure || {};
    const stats = child.stats || {};
    if (child.type === "capability_focus") return "关注点";
    if (child.type === "capability") return stats.focusCount ? `${stats.focusCount} 关注点` : "暂无关注点";
    return [
      structure.l2Count ? `${structure.l2Count} L2 能力` : "",
      stats.focusCount ? `${stats.focusCount} 关注点` : "",
    ]
      .filter(Boolean)
      .join(" / ");
  }

  function renderOverviewChildRow(child = {}) {
    const title = entityName(child, "未命名能力");
    const statsLine = childStatsLine(child) || "暂无下级统计";
    return `
      <button type="button" class="capability-overview-row" data-capability-id="${escape(child.id || "")}">
        <span class="capability-overview-row-main">
          <b>${escape([child.code, title].filter(Boolean).join(" "))}</b>
          <span class="capability-overview-row-stats">${escape(statsLine)}</span>
        </span>
      </button>
    `;
  }

  function shouldRenderSlidingScaleReference(overview = {}, children = []) {
    return text(overview?.selected?.code).trim() === "T" && children.length === 5;
  }

  function renderSlidingScaleReference() {
    return `
      <figure class="capability-sliding-scale-reference">
        <img src="${escape(SLIDING_SCALE_IMAGE_PATH)}" alt="The Sliding Scale of Cyber Security 第 4 页五象限示意图" loading="lazy" />
      </figure>
    `;
  }

  function overviewMetricLine(overview = {}) {
    const structure = overview.structure || {};
    const stats = overview.stats || {};
    return [
      structure.l1Count ? `${structure.l1Count} L1` : "",
      structure.l2Count ? `${structure.l2Count} L2` : "",
      stats.focusCount ? `${stats.focusCount} 关注点` : "",
    ]
      .filter(Boolean)
      .join(" / ");
  }

  function overviewSignalCards(overview = {}) {
    const stats = overview.stats || {};
    const technical = stats.technicalSummary || {};
    const management = stats.managementSummary || {};
    const standard = stats.standardSummary || {};
    const rows = [
      {
        key: "technical",
        label: "技术覆盖",
        value: technical.serviceCount || 0,
        unit: "安全技术服务",
        meta: `${technical.technologyModuleCount || 0} 安全技术模块 / ${technical.measureCount || 0} 安全技术措施`,
      },
      {
        key: "management",
        label: "管理落地",
        value: management.securityFunctionCount || 0,
        unit: "职能",
        meta: `${management.processReferenceCount || 0} 流程`,
      },
      {
        key: "standard",
        label: "标准映射",
        value: standard.frameworkCount || 0,
        unit: "标准",
        meta: `${standard.controlCount || 0} 控制项`,
      },
    ];
    return rows
      .map(
        (row) => `
          <div class="capability-overview-signal tone-${escape(row.key)}">
            <span>${escape(row.label)}</span>
            <strong><span>${escape(row.value)}</span><em>${escape(row.unit || "")}</em></strong>
            <small>${escape(row.meta)}</small>
          </div>
        `,
      )
      .join("");
  }

  function renderOverviewBrief(overview = {}) {
    const selected = overview.selected || {};
    const selectedTitle = [selected.code, entityName(selected, "当前能力")].filter(Boolean).join(" ");
    const selectedDefinition = text(selected.description).trim() || "暂无定义";
    const scopeLine = overviewMetricLine(overview) || "当前层级暂无结构统计";
    return `
      <section class="capability-overview-pane capability-overview-brief">
        <header class="capability-overview-brief-header">
          <div class="capability-overview-definition">
            <strong>${escape(selectedTitle)}</strong>
            <p>${escape(selectedDefinition)}</p>
          </div>
        </header>
        <div class="capability-overview-brief-body">
          <div class="capability-overview-brief-copy">
            <div class="capability-overview-flow">
              ${scopeLine
                .split(" / ")
                .filter(Boolean)
                .map((item) => `<span>${escape(item)}</span>`)
                .join("")}
            </div>
          </div>
          <div class="capability-overview-signal-grid">
            ${overviewSignalCards(overview)}
          </div>
        </div>
      </section>
    `;
  }

  function renderOverviewHomePanel(overview = {}, panelClass = "overview-panel") {
    const children = list(overview.children);
    const isL2 = overview.selectedType === "capability" || overview.levelLabel === "L2 能力";
    const childTitle = isL2 ? "关注点入口" : "下级能力入口";
    const emptyText = isL2 ? "暂无关注点" : "暂无下级能力";
    const showSlidingScale = shouldRenderSlidingScaleReference(overview, children);
    const rowListClass = `capability-overview-row-list${showSlidingScale ? " is-five-up" : ""}`;
    return `
      <div id="capability-relation-panel-overview" class="preview-tab-panel ${escape(panelClass)}" role="tabpanel" aria-labelledby="capability-relation-tab-label-overview">
        <section class="capability-overview-shell capability-overview-summary-shell">
          ${renderOverviewBrief(overview)}
          <div class="capability-overview-summary-grid">
            <section class="capability-overview-pane capability-overview-children-pane${showSlidingScale ? " has-sliding-scale" : ""}">
              <header>
                <strong>${escape(childTitle)}</strong>
              </header>
              <div class="${escape(rowListClass)}">
                ${children.length ? children.map(renderOverviewChildRow).join("") : `<div class="capability-overview-empty">${escape(emptyText)}</div>`}
              </div>
              ${showSlidingScale ? renderSlidingScaleReference() : ""}
            </section>
            <section class="capability-overview-pane capability-overview-coverage-pane">
              <header>
                <strong>覆盖结构</strong>
              </header>
              <div class="capability-overview-coverage">
                ${coverageBars(overview.coverage)}
              </div>
            </section>
          </div>
        </section>
      </div>
    `;
  }

  function renderCondensedDetailPanel(overview = {}, mode = "technical") {
    const labels = {
      technical: ["技术摘要", "完整技术映射请进入关注点核对"],
      management: ["管理摘要", "完整管理映射请进入关注点核对"],
      standard: ["标准摘要", "完整标准条款请进入关注点核对"],
    };
    const [title, helper] = labels[mode] || labels.technical;
    return `
      <div id="capability-relation-panel-${escape(mode)}" class="preview-tab-panel ${escape(mode)}-panel" role="tabpanel" aria-labelledby="capability-relation-tab-label-${escape(mode)}">
        <section class="capability-overview-shell">
          <section class="capability-overview-pane capability-condensed-detail">
            <header>
              <strong>${escape(title)}</strong>
              <span>${escape(`${overview.detailRowCount || 0} 条已收拢`)}</span>
            </header>
            <p>${escape(helper)}</p>
            <div class="capability-overview-coverage">
              ${coverageBars(overview.coverage)}
            </div>
            <div class="capability-overview-index">
              ${list(overview.children).map(renderOverviewChild).join("") || `<div class="capability-overview-empty">暂无关注点入口</div>`}
            </div>
          </section>
        </section>
      </div>
    `;
  }

  function summaryNode(label, title, code = "", modifier = "") {
    return `
      <div class="summary-graph-node ${modifier}">
        <span>${escape(label)}</span>
        <strong>${escape(title)}</strong>
        ${code ? `<small>${escape(code)}</small>` : ""}
      </div>
    `;
  }

  function summaryConnector(label = "") {
    return `<div class="summary-connector"><span>${escape(label)}</span></div>`;
  }

  function layerKeyOf(item = {}) {
    const layer = text(item.layer || item.layerLabel).trim();
    return LAYERS.find((entry) => entry.key === layer || entry.label === layer)?.key || "";
  }

  function localSummaryData(map = {}, focusOverview = {}) {
    const focus = map.focus || {};
    const path = focusOverview.path || {};
    const upstream = [];
    const technicalPairs = list(map.technical?.scopeServicePairs)
      .map((pair) => ({
        scope: { label: display.label?.("scope_type", "作用域") || "作用域", title: valueOf(pair.scopeName, "待补充作用域"), code: pair.scopeCode || "" },
        service: { label: display.label?.("security_technical_service", "安全技术服务") || "安全技术服务", title: valueOf(pair.serviceName, display.state?.("no_applicable_service") || "无适用服务"), code: pair.serviceCode || "" },
      }))
      .slice(0, 6);
    const workFunctionsByLayer = map.management?.workFunctionsByLayer || {};
    const fallbackFunctions = list(map.management?.workFunctions);
    const layerGroups = LAYERS.map((layer) => ({
      ...layer,
      rows: list(workFunctionsByLayer[layer.key]).length
        ? list(workFunctionsByLayer[layer.key]).map((item) => ({ ...item, label: item.layerLabel || layer.label }))
        : fallbackFunctions.filter((item) => layerKeyOf(item) === layer.key).map((item) => ({ ...item, label: item.layerLabel || layer.label })),
    }));
    const processTree = list(map.management?.processTree);
    const processGroups = processTree.map((group) => ({
      label: display.label?.("l2_process_group", "L2 流程组") || "L2 流程组",
      title: valueOf(group.l2ProcessGroup, "待补充"),
      code: group.code || "",
    }));
    const processReferences = processTree
      .flatMap((group) => list(group.l3Processes))
      .map((process) => ({ label: display.label?.("l3_process", "L3 流程") || "L3 流程", title: entityName(process), code: entityCode(process) }));
    const treeActivities = processTree.flatMap((group) => list(group.l3Processes).flatMap((process) => list(process.activities)));
    const activities = (treeActivities.length ? treeActivities : list(map.management?.activities)).map((activity) => ({
      label: display.label?.("l4_activity", "L4 活动") || "L4 活动",
      title: entityName(activity),
      code: entityCode(activity),
      status: activity.status || "",
    }));
    const standards = list(map.standards?.frameworks || map.standardFrameworks);
    const controls = list(map.standards?.controls || map.standardControls);
    const hasMissingActivity = activities.some((activity) => activity.status === "missing" || entityName(activity) === "待补充");
    const l4State = activities.length && !hasMissingActivity ? `${activities.length}` : "待补充";
    const securityWorks = list(map.management?.securityWorks).map((work) => ({ ...work, label: "安全工作" }));
    return {
      upstream,
      current: { title: entityName(focus, "当前关注点"), code: valueOf(focus.code, "") },
      stats: {
        scopes: unique(technicalPairs.map((pair) => pair.scope)).length,
        services: unique(technicalPairs.map((pair) => pair.service)).filter((item) => entityName(item) !== "无适用服务").length,
        works: securityWorks.length,
        functions: layerGroups.reduce((sum, group) => sum + group.rows.length, 0),
        l2: processGroups.length,
        l3: processReferences.length,
        l4: l4State,
        standard: controls.length ? `${controls.length}` : standards.length ? `${standards.length}` : "无直接投影",
      },
      technical: {
        pairs: technicalPairs,
      },
      management: {
        works: securityWorks,
        layerGroups,
        processGroups,
        processReferences,
        activities,
        hasMissingActivity,
      },
      standard: {
        nodes: standards.length
          ? standards.slice(0, 4).map((standard) => ({ ...standard, label: "标准 / 框架" }))
          : [{ label: "标准 / 框架映射", title: "无直接投影", code: "待投影" }],
      },
    };
  }

  function renderNodeStack(nodes, emptyTitle) {
    if (!nodes.length) return `<div class="summary-empty-node">${escape(emptyTitle)}</div>`;
    return nodes
      .slice(0, 3)
      .map((node, index) => summaryNode(node.label || "关联对象", entityName(node), entityCode(node) || node.code || "", index === 0 ? "" : "quiet"))
      .join("");
  }

  function renderHubNode(data) {
    return `
      <article class="summary-hub-card" aria-label="当前能力-关注点：${escape(data.current.title)}">
        <strong>${escape(data.current.title)}</strong>
      </article>
    `;
  }

  function renderTechnicalLane(data) {
    const pairs = list(data.technical?.pairs);
    return `
      <article class="summary-path-lane tone-technical summary-technical-lane">
        <header>
          <strong>技术视角</strong>
          <span>作用域 -> 安全技术服务</span>
        </header>
        <div class="summary-pair-list">
          ${
            pairs.length
              ? pairs
                  .map(
                    (pair) => `
                      <div class="summary-pair-row">
                        ${summaryNode(pair.scope.label, pair.scope.title, pair.scope.code, "compact")}
                        ${summaryConnector("到")}
                        ${summaryNode(pair.service.label, pair.service.title, pair.service.code, "compact")}
                      </div>
                    `,
                  )
                  .join("")
              : `<div class="summary-empty-node">暂无技术映射</div>`
          }
        </div>
      </article>
    `;
  }

  function renderLayerStack(groups = []) {
    return `
      <div class="summary-layer-stack">
        ${groups
          .map(
            (group) => `
              <section class="${group.rows.length ? "" : "is-empty"}">
                <strong>${escape(group.label)}</strong>
                <div>${renderNodeStack(group.rows.slice(0, 2), "暂无")}</div>
              </section>
            `,
          )
          .join("")}
      </div>
    `;
  }

  function renderManagementLane(data) {
    const management = data.management || {};
    const l4Rows = list(management.activities);
    const l4Nodes = l4Rows.length
      ? l4Rows
      : management.hasMissingActivity
      ? [{ label: display.label?.("l4_activity", "L4 活动") || "L4 活动", title: "L4 活动待补充", code: "" }]
      : [];
    return `
      <article class="summary-path-lane tone-management summary-management-lane">
        <header>
          <strong>管理视角</strong>
          <span>安全工作 -> 安全职能 -> L2/L3/L4</span>
        </header>
        <div class="summary-management-route">
          <div class="summary-path-group">
            <em>安全工作</em>
            ${renderNodeStack(list(management.works).slice(0, 3), "暂无安全工作")}
          </div>
          ${summaryConnector("到")}
          <div class="summary-path-group summary-function-group">
            <em>安全职能四类</em>
            ${renderLayerStack(management.layerGroups)}
          </div>
          ${summaryConnector("到")}
          <div class="summary-process-chain">
            <div class="summary-path-group">
              <em>L2流程组</em>
              ${renderNodeStack(list(management.processGroups).slice(0, 2), "暂无 L2")}
            </div>
            <div class="summary-path-group">
              <em>L3流程</em>
              ${renderNodeStack(list(management.processReferences).slice(0, 2), "暂无 L3")}
            </div>
            <div class="summary-path-group">
              <em>L4活动</em>
              ${renderNodeStack(l4Nodes.slice(0, 2), "L4 待补充")}
            </div>
          </div>
        </div>
      </article>
    `;
  }

  function renderRelationPath(title, subtitle, groups, tone = "") {
    return `
      <article class="summary-path-lane ${tone ? `tone-${escape(tone)}` : ""}">
        <header>
          <strong>${escape(title)}</strong>
          <span>${escape(subtitle)}</span>
        </header>
        <div class="summary-path-chain">
          ${groups
            .map(
              (group, index) => `
                ${index ? summaryConnector("到") : ""}
                <div class="summary-path-group">
                  <em>${escape(group.label)}</em>
                  ${renderNodeStack(group.rows, group.empty)}
                </div>
              `,
            )
            .join("")}
        </div>
      </article>
    `;
  }

  function renderStandardRelations(map = {}) {
    const standards = list(map.standards?.frameworks || map.standardFrameworks);
    const controls = list(map.standards?.controls || map.standardControls);
    if (!standards.length && !controls.length) {
      return renderMappingTable({
        columns: [
          { key: "standard", label: "标准 / 框架" },
          { key: "controls", label: "条款 / 控制项", type: "standardControls", empty: "暂无控制项" },
        ],
        rows: [],
        emptyTitle: "暂无条款/控制项对应能力关注点",
        emptyBody: "",
        mode: "standard",
        title: "标准 / 框架映射",
        description: "当前关注点 -> 标准 / 框架 -> 条款 / 控制项",
        summary: "0 控制项",
      });
    }
    return `
      <section class="preview-view-graph">
        <header><h3>标准 / 框架映射</h3><span>当前关注点 -> 标准 / 框架 -> 条款 / 控制项</span></header>
        <div class="preview-service-grid">
          ${standards.map((item) => `<article class="preview-service-node"><strong>${escape(entityName(item))}</strong><small>${escape(entityCode(item) || "标准 / 框架")}</small></article>`).join("")}
        </div>
      </section>
    `;
  }

  function renderTechnicalEmpty(map = {}) {
    return `
      <section class="semantic-panel technical-mapping-section">
        <div class="matrix-section-head">
          <div>
            <h3>技术视角映射矩阵</h3>
            <p>当前关注点 -> 作用域 -> 安全技术服务 -> 安全技术模块/措施</p>
          </div>
          <span>0 服务</span>
        </div>
        <div class="relationship-matrix-scroll semantic-scroll">
          <table class="semantic-mapping-table">
            <thead>
              <tr>
                <th>${escape(display.label?.("scope_type", "作用域") || "作用域")}</th>
                <th>${escape(display.label?.("security_technical_service", "安全技术服务") || "安全技术服务")}</th>
                <th>${escape(display.label?.("security_module_or_measure", "安全技术模块/措施") || "安全技术模块/措施")}</th>
              </tr>
            </thead>
            <tbody>
              <tr class="semantic-empty-row">
                <td colspan="3"><div class="reference-empty">暂无作用域对应安全技术服务</div></td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    `;
  }

  function renderOriginalTechnicalMatrix(rows = [], summary = "") {
    if (!components.FocusScopeServiceMatrix?.render) {
      return `<section class="preview-matrix-panel"><div class="preview-table-empty"><strong>技术视角映射矩阵未加载</strong><span>原矩阵组件 FocusScopeServiceMatrix 当前不可用。</span></div></section>`;
    }
    return components.FocusScopeServiceMatrix.render({ rows, summary });
  }

  function renderOriginalManagementMatrix(rows = [], summary = "") {
    if (!components.FocusManagementMapping?.render) {
      return `<section class="preview-matrix-panel"><div class="preview-table-empty"><strong>管理视角映射矩阵未加载</strong><span>原矩阵组件 FocusManagementMapping 当前不可用。</span></div></section>`;
    }
    return components.FocusManagementMapping.render({ rows, summary });
  }

  function renderViewPanel(map, focusOverview, mode, matrices = {}) {
    const stats = relationshipStats(map);
    if (mode === "technical") {
      const technicalRows = visibleTechnicalMappingRows(matrices.technicalMappingRows);
      if (!technicalRows.length) {
        return `
          <div id="capability-relation-panel-technical" class="preview-tab-panel technical-panel original-matrix-panel" role="tabpanel" aria-labelledby="capability-relation-tab-label-technical">
            ${renderTechnicalEmpty(map)}
          </div>
        `;
      }
      return `
        <div id="capability-relation-panel-technical" class="preview-tab-panel technical-panel original-matrix-panel" role="tabpanel" aria-labelledby="capability-relation-tab-label-technical">
          ${renderOriginalTechnicalMatrix(technicalRows, countLabel(confirmedTechnicalServiceCount(technicalRows), "服务"))}
        </div>
      `;
    }

    if (mode === "management") {
      return `
        <div id="capability-relation-panel-management" class="preview-tab-panel management-panel original-matrix-panel" role="tabpanel" aria-labelledby="capability-relation-tab-label-management">
          ${renderOriginalManagementMatrix(matrices.managementMappingRows, countLabel(stats.functions, "职能"))}
        </div>
      `;
    }

    if (mode === "standard") {
      const rows = standardTableRows(map);
      return `
        <div id="capability-relation-panel-standard" class="preview-tab-panel standard-panel original-matrix-panel" role="tabpanel" aria-labelledby="capability-relation-tab-label-standard">
          ${renderStandardMappingMatrix(rows, rows.length ? countLabel(stats.standardStatus, "控制项") : "0 控制项")}
        </div>
      `;
    }

    const tableConfig =
      mode === "management"
        ? {
            mode,
            columns: [
              { key: "work", label: "安全工作", type: "chips", empty: "暂无安全工作" },
              { key: "functions", label: "安全职能", type: "functionLayers" },
              { key: "l2", label: display.label?.("l2_process_group", "L2 流程组") || "L2 流程组" },
              { key: "l3", label: display.label?.("l3_process", "L3 流程") || "L3 流程" },
              { key: "l4", label: display.label?.("l4_activity", "L4 活动") || "L4 活动", type: "chips", empty: display.state?.("empty") || "暂无" },
            ],
            rows: managementTableRows(map),
            title: "管理视角映射矩阵",
            description: "当前关注点 -> 安全工作 -> 安全职能 -> L2 流程组 -> L3 流程 -> L4 活动",
          }
        : mode === "standard"
          ? {
              mode,
              columns: [
                { key: "standard", label: "标准 / 框架" },
                { key: "controls", label: "条款 / 控制项", type: "standardControls", empty: "暂无控制项" },
              ],
              rows: standardTableRows(map),
              emptyTitle: "暂无条款/控制项对应能力关注点",
              emptyBody: "",
              title: "标准 / 框架映射",
              summary: standardTableRows(map).length ? countLabel(stats.standardStatus, "控制项") : "0 控制项",
            }
          : {
              mode,
              columns: [
                { key: "scope", label: display.label?.("scope_type", "作用域") || "作用域", type: "path" },
                { key: "service", label: display.label?.("security_technical_service", "安全技术服务") || "安全技术服务", type: "path" },
              ],
              rows: technicalTableRows(map),
              title: "技术视角映射矩阵",
              description: "当前关注点 -> 作用域 -> 安全技术服务",
            };
    return `
      <div id="capability-relation-panel-${escape(mode)}" class="preview-tab-panel ${mode}-panel" role="tabpanel" aria-labelledby="capability-relation-tab-label-${escape(mode)}">
        ${renderMappingTable(tableConfig)}
      </div>
    `;
  }

  function renderSummaryPanel(map, focusOverview, matrices = {}, panelClass = "summary-panel") {
    const buildGraphModel = window.sapdModels?.buildLocalRelationGraphModel;
    if (!buildGraphModel || !components.LocalRelationNetworkGraph?.render) {
      return `
        <div id="capability-relation-panel-summary" class="preview-tab-panel ${escape(panelClass)}" role="tabpanel" aria-labelledby="capability-relation-tab-label-summary">
          <section class="local-relation-network-graph">
            <div class="preview-table-empty"><strong>本地关联网络图未加载</strong><span>LocalRelationNetworkGraph 或 relationGraphModel 当前不可用。</span></div>
          </section>
        </div>
      `;
    }
    const graphModel = buildGraphModel({
      currentFocus: map.focus,
      currentCapability: focusOverview?.path?.capability,
      focusOverview,
      localRelationMap: map,
      technicalMappingRows: list(matrices.technicalMappingRows),
      managementMappingRows: list(matrices.managementMappingRows),
      standardRows: map.focus?.type === "capability_focus" ? standardTableRows(map) : list(matrices.standardMappingRows),
    });
    return `
      <div id="capability-relation-panel-summary" class="preview-tab-panel ${escape(panelClass)}" role="tabpanel" aria-labelledby="capability-relation-tab-label-summary">
        ${components.LocalRelationNetworkGraph.render({ graphModel })}
      </div>
    `;
  }

  function renderTabControls(map = {}, capabilityOverview = {}, activeTab = "overview") {
    const policy = capabilityOverview.detailPolicy || "full_detail";
    const tabs =
      policy === "overview"
        ? [
            { id: "overview", label: "摘要总览" },
            { id: "summary", label: "能力关系图谱" },
          ]
        : [
            { id: "overview", label: "摘要总览" },
            { id: "technical", label: "技术视角" },
            { id: "management", label: "管理视角" },
            { id: "standard", label: "标准 / 框架映射" },
            { id: "summary", label: "能力关系图谱" },
          ];
    const normalizedActiveTab = tabs.some((tab) => tab.id === activeTab) ? activeTab : "overview";
    const tabLabel = (tab) => `<label id="capability-relation-tab-label-${escape(tab.id)}" for="capability-relation-tab-${escape(tab.id)}" class="relation-view-tab ${normalizedActiveTab === tab.id ? "is-active" : ""}" role="tab" aria-selected="${normalizedActiveTab === tab.id ? "true" : "false"}" aria-controls="capability-relation-panel-${escape(tab.id)}" tabindex="${normalizedActiveTab === tab.id ? "0" : "-1"}">${escape(tab.label)}</label>`;
    return `
      <div class="relation-view-tabs preview-tabs capability-title-tabs" role="tablist" aria-label="安全能力映射视角">
        ${tabs.map(tabLabel).join("")}
      </div>
    `;
  }

  function render({ localRelationMap, focusOverview } = {}) {
    const args = arguments[0] || {};
    const map = localRelationMap || {};
    if (!map.focus?.id) return "";
    const capabilityOverview = args.capabilityOverview || {};
    const overviewOnly = capabilityOverview.detailPolicy === "overview";
    const condensedDetail = capabilityOverview.detailPolicy === "mixed_summary";
    const availableTabs = overviewOnly ? ["overview", "summary"] : ["overview", "technical", "management", "standard", "summary"];
    const activeTab = availableTabs.includes(args.activeTab) ? args.activeTab : "overview";
    const checked = (tab) => (activeTab === tab ? " checked" : "");
    const matrices = {
      technicalMappingRows: list(args.technicalMappingRows),
      managementMappingRows: list(args.managementMappingRows),
      standardMappingRows: list(args.standardMappingRows),
    };
    const activePanel =
      activeTab === "overview"
        ? renderOverviewHomePanel(capabilityOverview)
        : activeTab === "summary"
          ? renderSummaryPanel(map, focusOverview, matrices)
          : condensedDetail
            ? renderCondensedDetailPanel(capabilityOverview, activeTab)
            : renderViewPanel(map, focusOverview, activeTab, matrices);
    const panels = availableTabs
      .map((tab) =>
        tab === activeTab
          ? activePanel
          : `<div id="capability-relation-panel-${escape(tab)}" class="preview-tab-panel" role="tabpanel" aria-labelledby="capability-relation-tab-label-${escape(tab)}" hidden></div>`,
      )
      .join("");
    return `
      <section class="capability-local-relation-map capability-map-v3 capability-map-preview-r2">
        ${availableTabs.map((tab) => `<input class="relation-view-radio" type="radio" name="capability-relation-view" id="capability-relation-tab-${escape(tab)}" value="${escape(tab)}" tabindex="-1"${checked(tab)} />`).join("")}
        <div class="capability-map-v3-grid preview-workbench-grid">
          <main class="capability-relation-stage preview-relation-stage">
            <section class="preview-stage-scroll">
              ${panels}
            </section>
          </main>
        </div>
      </section>
    `;
  }

  components.CapabilityLocalRelationMap = { render, renderFocusStrip, renderTabControls };
})();
