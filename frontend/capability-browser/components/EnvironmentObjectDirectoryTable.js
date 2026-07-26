(function () {
  const components = (window.sapdComponents = window.sapdComponents || {});
  const utils = components.utils;
  const masterCategoryExpansion = new Set();
  const masterRecordExpansion = new Set();
  let searchExpansionSnapshot = null;
  let previousSearchActive = false;

  function fullText(value, fallback = "—") {
    const content = utils.text(value).trim() || fallback;
    return `<span title="${utils.escapeHtml(content)}">${utils.escapeHtml(content)}</span>`;
  }

  function typePill(label) {
    return `<span class="type-pill">${utils.escapeHtml(label)}</span>`;
  }

  function compatibilityNotice(message, mode) {
    const text = utils.text(message).trim();
    if (!text) return "";
    return `
      <div class="environment-directory-compatibility-notice ${mode === "legacy_fallback" ? "is-fallback" : ""}" role="status">
        <strong>${mode === "legacy_fallback" ? "兼容目录" : "主数据字典"}</strong>
        <span>${utils.escapeHtml(text)}</span>
      </div>
    `;
  }

  function renderObjectRow(row, segmentId, lineage, hidden) {
    return `
      <tr class="maintenance-data-row standard-group-detail environment-object-directory-row"
          data-standard-parent="${utils.escapeHtml(segmentId)}"
          data-standard-lineage="${utils.escapeHtml(lineage.join(" "))}"
          data-maintenance-id="${utils.escapeHtml(row.id)}"${hidden ? " hidden" : ""}>
        <td>${typePill("信息化对象")}</td>
        <td><strong>${fullText(row.title, "未命名信息化对象")}</strong></td>
        <td class="maintenance-description-cell">${fullText(row.description)}</td>
      </tr>
    `;
  }

  function segmentContainsSelected(segment, selectedId) {
    return Boolean(
      selectedId
      && utils.list(segment?.objects).some((row) => utils.text(row?.id).trim() === selectedId)
    );
  }

  function renderSegment(segment, environmentId, lineage, hidden, options = {}) {
    const segmentId = segment.directoryId;
    const nextLineage = [...lineage, segmentId];
    const expanded = Boolean(
      options.expandSearchResults
      || segmentContainsSelected(segment, options.selectedId)
    );
    return `
      <tr class="standard-group-row environment-object-directory-group depth-1 ${expanded ? "expanded" : ""}"
          data-standard-group="${utils.escapeHtml(segmentId)}"
          data-standard-parent="${utils.escapeHtml(environmentId)}"
          data-standard-lineage="${utils.escapeHtml(lineage.join(" "))}"${hidden ? " hidden" : ""}>
        <td colspan="3">
          <button class="standard-group-toggle" type="button" aria-expanded="${expanded ? "true" : "false"}" style="padding-left: 18px;">
            <span class="standard-group-caret">›</span>
            <span class="standard-group-main">
              <strong>${typePill("环境子类")} ${fullText(segment.title, "未命名环境子类")}</strong>
              ${segment.description ? `<span class="standard-group-description">${fullText(segment.description)}</span>` : ""}
            </span>
            <span class="hierarchy-meta">${utils.escapeHtml(`${utils.list(segment.objects).length} 个信息化对象`)}</span>
          </button>
        </td>
      </tr>
      ${utils.list(segment.objects).map((row) => renderObjectRow(row, segmentId, nextLineage, hidden || !expanded)).join("")}
    `;
  }

  function environmentContainsSelected(environment, selectedId) {
    return Boolean(
      selectedId
      && utils.list(environment?.segments).some((segment) => segmentContainsSelected(segment, selectedId))
    );
  }

  function renderEnvironment(environment, options = {}) {
    const environmentId = environment.directoryId;
    const expanded = Boolean(
      options.expandSearchResults
      || environmentContainsSelected(environment, options.selectedId)
    );
    const objectCount = utils.list(environment.segments).reduce((sum, segment) => sum + utils.list(segment.objects).length, 0);
    return `
      <tr class="standard-group-row environment-object-directory-group depth-0 ${expanded ? "expanded" : ""}"
          data-standard-group="${utils.escapeHtml(environmentId)}">
        <td colspan="3">
          <button class="standard-group-toggle" type="button" aria-expanded="${expanded ? "true" : "false"}" style="padding-left: 4px;">
            <span class="standard-group-caret">›</span>
            <span class="standard-group-main">
              <strong>${typePill("信息化环境")} ${fullText(environment.title, "未命名信息化环境")}</strong>
              ${environment.description ? `<span class="standard-group-description">${fullText(environment.description)}</span>` : ""}
            </span>
            <span class="hierarchy-meta">${utils.escapeHtml(`${utils.list(environment.segments).length} 个环境子类 · ${objectCount} 条对象记录`)}</span>
          </button>
        </td>
      </tr>
      ${utils.list(environment.segments).map((segment) => renderSegment(segment, environmentId, [environmentId], !expanded, options)).join("")}
    `;
  }

  function setLegacyExpansion(expanded) {
    const table = document.querySelector(".environment-object-directory-table.is-legacy");
    if (!table) return;
    table.querySelectorAll(".standard-group-row[data-standard-group]").forEach((row) => {
      row.classList.toggle("expanded", expanded);
      row.querySelector(".standard-group-toggle")?.setAttribute("aria-expanded", expanded ? "true" : "false");
      row.hidden = false;
    });
    table.querySelectorAll("[data-standard-parent]").forEach((row) => {
      row.hidden = !expanded;
    });
    if (!expanded) table.closest(".maintenance-table-scroll")?.scrollTo?.({ top: 0, left: 0 });
  }

  function prepareSearchExpansion(search) {
    const searchActive = Boolean(utils.text(search).trim());
    if (searchActive && !previousSearchActive) {
      searchExpansionSnapshot = {
        categories: new Set(masterCategoryExpansion),
        records: new Set(masterRecordExpansion),
      };
    } else if (!searchActive && previousSearchActive && searchExpansionSnapshot) {
      masterCategoryExpansion.clear();
      searchExpansionSnapshot.categories.forEach((id) => masterCategoryExpansion.add(id));
      masterRecordExpansion.clear();
      searchExpansionSnapshot.records.forEach((id) => masterRecordExpansion.add(id));
      searchExpansionSnapshot = null;
    }
    previousSearchActive = searchActive;
    return searchActive;
  }

  function statusLabel(status) {
    const labels = {
      active: "有效",
      deprecated: "已弃用",
      merged: "已合并",
    };
    return labels[utils.text(status).trim()] || utils.text(status).trim() || "未标注";
  }

  function usageSummaryText(record) {
    const summary = record?.usageSummary || {};
    if (record?.type === "information_environment") {
      return `${Number(summary.environment_segments) || 0} 个子类上下文`;
    }
    if (record?.type === "environment_segment_type") {
      return `${Number(summary.information_environments) || 0} 个环境 · ${Number(summary.environment_segments) || 0} 个子类上下文`;
    }
    return `${Number(summary.information_environments) || 0} 个环境 · ${Number(summary.environment_object_contexts) || 0} 个对象上下文`;
  }

  function contextTypeLabel(contextType) {
    const labels = {
      information_environment: "信息化环境上下文",
      environment_segment: "环境子类上下文",
      information_object: "信息化对象上下文",
      environment_object_context: "环境对象关系上下文",
    };
    return labels[utils.text(contextType).trim()] || "关联上下文";
  }

  function renderContextRow(context, categoryId, recordId, hidden) {
    const params = context?.routeParams || {};
    return `
      <tr class="environment-master-context-row"
          data-standard-lineage="${utils.escapeHtml(categoryId)}"
          data-master-context-parent="${utils.escapeHtml(recordId)}"${hidden ? " hidden" : ""}>
        <td>${typePill("关联使用")}</td>
        <td>
          <span class="environment-master-context-title">${fullText(context.contextTitle, "未命名上下文")}</span>
        </td>
        <td class="maintenance-description-cell">
          <span>${fullText(contextTypeLabel(context.contextType), "上下文")}</span>
        </td>
        <td>
          <button class="environment-master-route-button" type="button"
              data-app-route="${utils.escapeHtml(context.route || "/environment-mapping")}"
              data-environment-id="${utils.escapeHtml(params.environment_id || "")}"
              data-environment-segment-id="${utils.escapeHtml(params.segment_id || "")}"
              data-environment-object-id="${utils.escapeHtml(params.object_id || "")}"
              data-context-ref="${utils.escapeHtml(context.contextRef || "")}">
            查看环境映射
          </button>
        </td>
      </tr>
    `;
  }

  function renderMasterRecord(record, categoryId, categoryExpanded, searchActive) {
    const recordId = record.stableRef || record.id;
    const expanded = Boolean(
      masterRecordExpansion.has(recordId)
      || (searchActive && record.searchContextMatch)
    );
    const contexts = utils.list(record.contexts);
    const aliases = utils.list(record.aliases);
    return `
      <tr class="maintenance-data-row standard-group-detail environment-master-record-row"
          data-standard-parent="${utils.escapeHtml(categoryId)}"
          data-standard-lineage="${utils.escapeHtml(categoryId)}"
          data-maintenance-id="${utils.escapeHtml(recordId)}"${categoryExpanded ? "" : " hidden"}>
        <td>
          <strong class="environment-master-code">${fullText(record.code, "未编号")}</strong>
          <span class="environment-master-status">${utils.escapeHtml(statusLabel(record.status))}</span>
        </td>
        <td>
          <strong>${fullText(record.title, "未命名主数据")}</strong>
          ${aliases.length ? `<span class="environment-master-aliases">别名：${utils.escapeHtml(aliases.join("、"))}</span>` : ""}
        </td>
        <td class="maintenance-description-cell">${fullText(record.description)}</td>
        <td>
          <span class="environment-master-usage-summary">${utils.escapeHtml(usageSummaryText(record))}</span>
          <button class="environment-master-context-toggle" type="button"
              data-environment-master-record-toggle="${utils.escapeHtml(recordId)}"
              aria-expanded="${expanded ? "true" : "false"}"${contexts.length ? "" : " disabled"}>
            ${expanded ? "收起关联" : `展开关联（${record.totalContexts ?? contexts.length}）`}
          </button>
        </td>
      </tr>
      ${contexts.map((context) => renderContextRow(context, categoryId, recordId, !categoryExpanded || !expanded)).join("")}
    `;
  }

  function renderMasterCategory(category, searchActive) {
    const categoryId = category.id;
    const expanded = Boolean(searchActive || masterCategoryExpansion.has(categoryId));
    return `
      <tr class="standard-group-row environment-master-category-row depth-0 ${expanded ? "expanded" : ""}"
          data-environment-master-category="${utils.escapeHtml(categoryId)}"
          data-standard-group="${utils.escapeHtml(categoryId)}">
        <td colspan="4">
          <button class="standard-group-toggle" type="button" aria-expanded="${expanded ? "true" : "false"}">
            <span class="standard-group-caret">›</span>
            <span class="standard-group-main">
              <strong><span class="hierarchy-level-label">主数据分类</span>${fullText(category.label)}</strong>
              <span class="standard-group-description">${fullText(category.description)}</span>
            </span>
            <span class="hierarchy-meta">${utils.escapeHtml(`${category.declaredCount} 条主数据 · ${category.contextCount} 条关联使用`)}</span>
          </button>
        </td>
      </tr>
      ${utils.list(category.records).map((record) => renderMasterRecord(record, categoryId, expanded, searchActive)).join("")}
    `;
  }

  function setMasterCategoryExpansion(expanded) {
    const table = document.querySelector(".environment-object-directory-table.is-master");
    if (!table) return;
    table.querySelectorAll("[data-environment-master-category]").forEach((row) => {
      const categoryId = row.dataset.environmentMasterCategory;
      row.classList.toggle("expanded", expanded);
      row.querySelector(".standard-group-toggle")?.setAttribute("aria-expanded", expanded ? "true" : "false");
      if (expanded) masterCategoryExpansion.add(categoryId);
      else masterCategoryExpansion.delete(categoryId);
      table.querySelectorAll(`[data-standard-parent="${categoryId}"]`).forEach((recordRow) => {
        recordRow.hidden = !expanded;
      });
      table.querySelectorAll(`[data-standard-lineage~="${categoryId}"][data-master-context-parent]`).forEach((contextRow) => {
        contextRow.hidden = !expanded || !masterRecordExpansion.has(contextRow.dataset.masterContextParent);
      });
    });
    if (!expanded) table.closest(".maintenance-table-scroll")?.scrollTo?.({ top: 0, left: 0 });
  }

  document.addEventListener("click", (event) => {
    const action = event.target.closest?.("[data-environment-object-directory-action]")?.dataset.environmentObjectDirectoryAction;
    if (action === "expand-all") setLegacyExpansion(true);
    if (action === "collapse-all") setLegacyExpansion(false);
    if (action === "expand-master-categories") setMasterCategoryExpansion(true);
    if (action === "collapse-master-categories") setMasterCategoryExpansion(false);

    const categoryToggle = event.target.closest?.(".environment-object-directory-table.is-master [data-environment-master-category] .standard-group-toggle");
    if (categoryToggle) {
      const row = categoryToggle.closest("[data-environment-master-category]");
      const categoryId = row?.dataset.environmentMasterCategory;
      const nextExpanded = categoryToggle.getAttribute("aria-expanded") !== "true";
      if (categoryId && nextExpanded) masterCategoryExpansion.add(categoryId);
      if (categoryId && !nextExpanded) masterCategoryExpansion.delete(categoryId);
    }

    const recordToggle = event.target.closest?.("[data-environment-master-record-toggle]");
    if (!recordToggle) return;
    event.preventDefault();
    event.stopPropagation();
    const recordId = recordToggle.dataset.environmentMasterRecordToggle;
    const table = recordToggle.closest("table");
    const nextExpanded = recordToggle.getAttribute("aria-expanded") !== "true";
    recordToggle.setAttribute("aria-expanded", nextExpanded ? "true" : "false");
    recordToggle.textContent = nextExpanded
      ? "收起关联"
      : `展开关联（${table?.querySelectorAll(`[data-master-context-parent="${recordId}"]`).length || 0}）`;
    if (nextExpanded) masterRecordExpansion.add(recordId);
    else masterRecordExpansion.delete(recordId);
    table?.querySelectorAll(`[data-master-context-parent="${recordId}"]`).forEach((row) => {
      row.hidden = !nextExpanded;
    });
  });

  function renderLegacy({ environmentGroups, emptyState, search, selectedId, notice }) {
    const groups = utils.list(environmentGroups);
    if (!groups.length) {
      return `${compatibilityNotice(notice, "legacy_fallback")}<div class="maintenance-empty-state">${utils.escapeHtml(emptyState || "暂无信息化环境-对象目录数据。")}</div>`;
    }
    const options = {
      expandSearchResults: Boolean(utils.text(search).trim()),
      selectedId: utils.text(selectedId).trim(),
    };
    return `
      ${compatibilityNotice(notice, "legacy_fallback")}
      <div class="capability-directory-toolbar" aria-label="信息化环境-对象目录操作">
        <button type="button" data-environment-object-directory-action="expand-all">全部展开</button>
        <button type="button" data-environment-object-directory-action="collapse-all">收起到信息化环境</button>
      </div>
      <div class="maintenance-table-scroll">
        <table class="maintenance-data-table environment-object-directory-table is-legacy hierarchical-directory-maintenance-table" style="width: 100%; min-width: 0; table-layout: fixed;">
          <colgroup>
            <col style="width: 180px;">
            <col style="width: 300px;">
            <col>
          </colgroup>
          <thead>
            <tr>
              <th>目录层级</th>
              <th>名称</th>
              <th>定义 / 描述</th>
            </tr>
          </thead>
          <tbody>
            ${groups.map((environment) => renderEnvironment(environment, options)).join("")}
          </tbody>
        </table>
      </div>
    `;
  }

  function renderMaster({ masterCategories, emptyState, search }) {
    const categories = utils.list(masterCategories);
    const recordCount = categories.reduce((sum, category) => sum + utils.list(category.records).length, 0);
    const searchActive = prepareSearchExpansion(search);
    const modeNotice = "当前显示唯一主数据；关联使用按上下文展开，现有环境映射树和关系数据未修改。";
    if (!recordCount) {
      return `${compatibilityNotice(modeNotice, "master_dictionary")}<div class="maintenance-empty-state">${utils.escapeHtml(emptyState || "暂无环境主数据字典记录。")}</div>`;
    }
    return `
      ${compatibilityNotice(modeNotice, "master_dictionary")}
      <div class="capability-directory-toolbar" aria-label="环境主数据字典分类操作">
        <button type="button" data-environment-object-directory-action="expand-master-categories">全部展开</button>
        <button type="button" data-environment-object-directory-action="collapse-master-categories">全部收起</button>
      </div>
      <div class="maintenance-table-scroll">
        <table class="maintenance-data-table environment-object-directory-table is-master hierarchical-directory-maintenance-table" style="width: 100%; min-width: 0; table-layout: fixed;">
          <colgroup>
            <col style="width: 168px;">
            <col style="width: 270px;">
            <col>
            <col style="width: 250px;">
          </colgroup>
          <thead>
            <tr>
              <th>编号 / 状态</th>
              <th>名称</th>
              <th>定义 / 描述</th>
              <th>关联使用</th>
            </tr>
          </thead>
          <tbody>
            ${categories.map((category) => renderMasterCategory(category, searchActive)).join("")}
          </tbody>
        </table>
      </div>
    `;
  }

  function render({
    environmentGroups,
    masterCategories,
    directoryMode,
    compatibilityNotice: notice,
    emptyState,
    search,
    selectedId,
  }) {
    if (directoryMode === "master_dictionary") {
      return renderMaster({ masterCategories, emptyState, search });
    }
    return renderLegacy({
      environmentGroups,
      emptyState,
      search,
      selectedId,
      notice,
    });
  }

  components.EnvironmentObjectDirectoryTable = { render };
})();
