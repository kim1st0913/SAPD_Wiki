(function () {
  const components = (window.sapdComponents = window.sapdComponents || {});
  const utils = components.utils;

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

  function unique(items) {
    const seen = new Set();
    return list(items).filter((item) => {
      const key = entityKey(item) || JSON.stringify(item);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  function statusText(status) {
    if (status === "ambiguous" || status === "ambiguous_service_mapping" || status === "pending") return "待确认";
    if (status === "missing") return "待补充";
    if (status === "no_service" || status === "not_applicable") return "不适用";
    if (status === "description") return "说明类";
    return "已映射";
  }

  function metric(label, value) {
    return `<span><strong>${escape(value)}</strong>${escape(label)}</span>`;
  }

  function chip(label, tone = "") {
    return `<span class="preview-chip ${tone ? `tone-${escape(tone)}` : ""}">${escape(label)}</span>`;
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
      standardStatus: standards.length || controls.length ? `${standards.length + controls.length}` : "待投影",
      pending: countPending(map),
    };
  }

  function renderFocusStrip(map = {}, focusOverview = {}) {
    const focus = map.focus || {};
    const stats = relationshipStats(map);
    const path = focusOverview.path || {};
    return `
      <header class="preview-focus-strip">
        <div class="preview-focus-main">
          <span>${escape(valueOf(focus.code, "无编码"))}</span>
          <strong>${escape(entityName(focus, "未命名关注点"))}</strong>
          <p>${escape(valueOf(focus.description, "从当前关注点核对技术、管理和标准 / 框架映射。"))}</p>
        </div>
        <div class="preview-focus-path">
          ${[path.category, path.domain, path.capability].filter(Boolean).map((item) => chip(entityName(item))).join("") || chip("能力路径待补充")}
        </div>
        <div class="preview-focus-stats">
          ${metric("作用域", stats.scopes)}
          ${metric("服务", stats.services)}
          ${metric("安全工作", stats.works)}
          ${metric("职能", stats.functions)}
          ${metric("L2/L3/L4", `${stats.l2Processes}/${stats.l3Processes}/${stats.l4Activities}`)}
          ${metric("标准", stats.standardStatus)}
        </div>
      </header>
    `;
  }

  function mappingObjectChips(items, empty = "暂无") {
    const rows = unique(items).filter(Boolean).slice(0, 4);
    if (!rows.length) return `<span class="preview-chip is-empty">${escape(empty)}</span>`;
    return rows.map((item, index) => chip(entityName(item), index < 2 ? "primary" : "")).join("");
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

  function renderMappingTable({ columns = [], rows = [], emptyTitle = "暂无映射矩阵", emptyBody = "当前关注点尚未形成该视角的可展示映射。", mode = "technical", title = "映射矩阵", description = "" } = {}) {
    if (!rows.length) {
      return `<section class="preview-matrix-panel"><div class="preview-table-empty"><strong>${escape(emptyTitle)}</strong><span>${escape(emptyBody)}</span></div></section>`;
    }
    return `
      <section class="preview-matrix-panel ${escape(mode)}-matrix-panel">
        <header>
          <div>
            <h3>${escape(title)}</h3>
            ${description ? `<p>${escape(description)}</p>` : ""}
          </div>
          <span>${escape(rows.length)} 条映射</span>
        </header>
        <div class="preview-mapping-table-wrap" aria-label="${escape(title)}">
          <table class="preview-mapping-table ${escape(mode)}-mapping-table">
            <thead>
              <tr>
                ${columns.map((column) => `<th>${escape(column.label)}</th>`).join("")}
              </tr>
            </thead>
            <tbody>
              ${rows
                .slice(0, 10)
                .map(
                  (row) => `
                    <tr>
                      ${columns
                        .map((column) => {
                          const value = row[column.key];
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
                .join("")}
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
    const standards = list(map.standards?.frameworks || map.standardFrameworks);
    const controls = list(map.standards?.controls || map.standardControls);
    return standards.map((standard) => ({
      standard: entityName(standard),
      controls: controls.slice(0, 2),
      requirement: "参考要求以后端标准 / 控制项投影为准",
    }));
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
        scope: { label: "作用域", title: valueOf(pair.scopeName, "待补充作用域"), code: pair.scopeCode || "" },
        service: { label: "安全技术服务", title: valueOf(pair.serviceName, "无适用服务"), code: pair.serviceCode || "" },
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
      label: "L2流程组",
      title: valueOf(group.l2ProcessGroup, "待补充"),
      code: group.code || "",
    }));
    const processReferences = processTree
      .flatMap((group) => list(group.l3Processes))
      .map((process) => ({ label: "L3流程", title: entityName(process), code: entityCode(process) }));
    const treeActivities = processTree.flatMap((group) => list(group.l3Processes).flatMap((process) => list(process.activities)));
    const activities = (treeActivities.length ? treeActivities : list(map.management?.activities)).map((activity) => ({
      label: "L4活动",
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
        standard: standards.length || controls.length ? `${standards.length + controls.length}` : "无直接投影",
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
      ? [{ label: "L4活动", title: "L4 待补充", code: "" }]
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
      return `
        <section class="preview-view-graph">
          <header><h3>标准 / 框架映射</h3><span>当前关注点 -> 标准 / 框架 -> 条款 / 控制项 / 参考要求</span></header>
          <div class="preview-standard-empty">
            ${summaryNode("当前关注点", entityName(map.focus, "当前关注点"), valueOf(map.focus?.code, ""), "current")}
            ${summaryConnector("待投影")}
            <div>
              <strong>暂无当前关注点的标准 / 框架直接映射</strong>
              <p>当前数据包未提供当前关注点到标准 / 框架和条款控制项的直接投影。本页保留切换入口，不伪造标准映射。</p>
              <span>可后续由后端契约补充标准与控制项投影。</span>
            </div>
          </div>
        </section>
      `;
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

  function renderOriginalTechnicalMatrix(rows = []) {
    if (!components.FocusScopeServiceMatrix?.render) {
      return `<section class="preview-matrix-panel"><div class="preview-table-empty"><strong>技术视角映射矩阵未加载</strong><span>原矩阵组件 FocusScopeServiceMatrix 当前不可用。</span></div></section>`;
    }
    return components.FocusScopeServiceMatrix.render({ rows });
  }

  function renderOriginalManagementMatrix(rows = []) {
    if (!components.FocusManagementMapping?.render) {
      return `<section class="preview-matrix-panel"><div class="preview-table-empty"><strong>管理视角映射矩阵未加载</strong><span>原矩阵组件 FocusManagementMapping 当前不可用。</span></div></section>`;
    }
    return components.FocusManagementMapping.render({ rows });
  }

  function renderViewPanel(map, focusOverview, mode, matrices = {}) {
    if (mode === "technical") {
      return `
        <div class="preview-tab-panel technical-panel original-matrix-panel">
          ${renderOriginalTechnicalMatrix(matrices.technicalMappingRows)}
        </div>
      `;
    }

    if (mode === "management") {
      return `
        <div class="preview-tab-panel management-panel original-matrix-panel">
          ${renderOriginalManagementMatrix(matrices.managementMappingRows)}
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
              { key: "l2", label: "L2流程组" },
              { key: "l3", label: "L3流程" },
              { key: "l4", label: "L4活动", type: "chips", empty: "暂无" },
            ],
            rows: managementTableRows(map),
            title: "管理视角映射矩阵",
            description: "当前关注点 -> 安全工作 -> 安全职能 -> L2流程组 -> L3流程 -> L4活动",
          }
        : mode === "standard"
          ? {
              mode,
              columns: [
                { key: "standard", label: "标准 / 框架" },
                { key: "controls", label: "条款 / 控制项", type: "chips", empty: "暂无控制项" },
                { key: "requirement", label: "参考要求" },
              ],
              rows: standardTableRows(map),
              emptyTitle: "标准 / 框架映射待投影",
              emptyBody: "当前数据包暂未提供“当前关注点 -> 标准 / 框架 -> 条款 / 控制项”的直接映射。",
              title: "标准 / 框架映射",
            }
          : {
              mode,
              columns: [
                { key: "scope", label: "作用域", type: "path" },
                { key: "service", label: "安全技术服务", type: "path" },
              ],
              rows: technicalTableRows(map),
              title: "技术视角映射矩阵",
              description: "当前关注点 -> 作用域 -> 安全技术服务",
            };
    if (mode === "standard" && !tableConfig.rows.length) {
      return `
        <div class="preview-tab-panel ${mode}-panel">
          ${renderStandardRelations(map)}
        </div>
      `;
    }
    return `
      <div class="preview-tab-panel ${mode}-panel">
        ${renderMappingTable(tableConfig)}
      </div>
    `;
  }

  function renderSummaryPanel(map, focusOverview, matrices = {}) {
    const buildGraphModel = window.sapdModels?.buildLocalRelationGraphModel;
    if (!buildGraphModel || !components.LocalRelationNetworkGraph?.render) {
      return `
        <div class="preview-tab-panel summary-panel">
          <section class="local-relation-network-graph">
            <div class="preview-table-empty"><strong>本地关联网络图未加载</strong><span>LocalRelationNetworkGraph 或 relationGraphModel 当前不可用。</span></div>
          </section>
        </div>
      `;
    }
    const graphModel = buildGraphModel({
      currentFocus: map.focus,
      currentCapability: focusOverview?.path?.capability,
      localRelationMap: map,
      technicalMappingRows: list(matrices.technicalMappingRows),
      managementMappingRows: list(matrices.managementMappingRows),
      standardRows: standardTableRows(map),
    });
    return `
      <div class="preview-tab-panel summary-panel">
        ${components.LocalRelationNetworkGraph.render({ graphModel })}
      </div>
    `;
  }

  function renderTabControls(map = {}) {
    const stats = relationshipStats(map);
    return `
      <div class="relation-view-tabs preview-tabs" role="tablist" aria-label="安全能力映射视角">
        <label for="capability-relation-tab-summary" class="relation-view-tab">本地关联摘要 <span>默认</span></label>
        <label for="capability-relation-tab-technical" class="relation-view-tab">技术视角 <span>${stats.services} 服务</span></label>
        <label for="capability-relation-tab-management" class="relation-view-tab">管理视角 <span>${stats.functions} 职能</span></label>
        <label for="capability-relation-tab-standard" class="relation-view-tab">标准 / 框架映射 <span>待投影</span></label>
      </div>
    `;
  }

  function render({ localRelationMap, focusOverview } = {}) {
    const args = arguments[0] || {};
    const map = localRelationMap || {};
    if (!map.focus?.id) return "";
    const matrices = {
      technicalMappingRows: list(args.technicalMappingRows),
      managementMappingRows: list(args.managementMappingRows),
    };
    return `
      <section class="capability-local-relation-map capability-map-v3 capability-map-preview-r2">
        <input class="relation-view-radio" type="radio" name="capability-relation-view" id="capability-relation-tab-summary" checked />
        <input class="relation-view-radio" type="radio" name="capability-relation-view" id="capability-relation-tab-technical" />
        <input class="relation-view-radio" type="radio" name="capability-relation-view" id="capability-relation-tab-management" />
        <input class="relation-view-radio" type="radio" name="capability-relation-view" id="capability-relation-tab-standard" />
        <div class="capability-map-v3-grid preview-workbench-grid">
          <main class="capability-relation-stage preview-relation-stage">
            ${renderFocusStrip(map, focusOverview)}
            ${renderTabControls(map)}
            <section class="preview-stage-scroll">
              ${renderSummaryPanel(map, focusOverview, matrices)}
              ${renderViewPanel(map, focusOverview, "technical", matrices)}
              ${renderViewPanel(map, focusOverview, "management", matrices)}
              ${renderViewPanel(map, focusOverview, "standard", matrices)}
            </section>
          </main>
        </div>
      </section>
    `;
  }

  components.CapabilityLocalRelationMap = { render };
})();
