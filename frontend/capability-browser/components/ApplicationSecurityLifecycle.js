(() => {
  const components = (window.sapdComponents = window.sapdComponents || {});
  const utils = components.utils;
  const display = window.sapdDisplay || {};

  const list = (value) => utils.list(value);
  const escapeHtml = (value) => utils.escapeHtml(value);
  const titleOf = (item, fallback = "—") => utils.titleOf(item, fallback);
  const EMPTY_VALUE = "—";
  const EMPTY_PLACEHOLDER_PATTERN = /^[\/／\-‐‑‒–—―－]+$/u;
  let activeHighlightQuery = "";

  function isEmptyDisplayValue(value) {
    const normalized = String(value ?? "").trim().replace(/\s+/g, "");
    return !normalized || EMPTY_PLACEHOLDER_PATTERN.test(normalized);
  }

  function splitLines(value) {
    if (Array.isArray(value)) return value.flatMap(splitLines);
    if (value && typeof value === "object") return splitLines(titleOf(value, ""));
    return String(value ?? "")
      .replace(/\r\n/g, "\n")
      .replace(/\r/g, "\n")
      .split("\n")
      .map((line) => line.trim())
      .flatMap(splitInlineNumberedClauses)
      .filter(isBusinessText);
  }

  function splitInlineNumberedClauses(line) {
    const markerPattern = /(?:^|\s)(\d+['’′]?)[).）、](?=\s|[\u4e00-\u9fff])\s*/g;
    const matches = [...line.matchAll(markerPattern)];
    if (matches.length <= 1 || matches[0].index !== 0) return [line];
    return matches.map((match, index) => {
      const next = matches[index + 1];
      return line.slice(match.index, next?.index ?? line.length).trim();
    });
  }

  function fieldCell(value) {
    const lines = splitLines(value);
    if (!lines.length) return `<span class="empty-inline">${EMPTY_VALUE}</span>`;
    return `
      <div class="lifecycle-field-lines">
        ${lines.map(renderFieldLine).join("")}
      </div>
    `;
  }

  function hasBusinessValue(value) {
    return splitLines(value).length > 0;
  }

  function isBusinessText(value) {
    return !isEmptyDisplayValue(value);
  }

  function displayValue(value) {
    return isBusinessText(value) ? String(value).trim() : EMPTY_VALUE;
  }

  function annotationValueAttrs(value) {
    const normalized = String(value ?? "").trim();
    if (!isBusinessText(normalized)) return "";
    const escaped = escapeHtml(normalized);
    return ` data-annotation-value="true" data-copy-text="${escaped}" title="${escaped}" data-annotation-tooltip="${escaped}"`;
  }

  function serviceScopeAttrs(item, objectKind = "") {
    if (!String(objectKind || "").includes("服务")) return "";
    return display.serviceScopeAttrs?.(utils, item) || "";
  }

  function lifecycleTargetAttrs(row, kind = "dev") {
    const id = String(row?.id || "").trim();
    const code = String(row?.code || row?.order || id).trim();
    const title = [code, titleOf(row, "")].filter(Boolean).join(" ").trim();
    const stableKey = code || id;
    if (!stableKey) return "";
    const isData = kind === "data";
    const target = {
      targetRef: `base:${isData ? "lifecycle_data_process" : "lifecycle_application_stage"}:${stableKey}`,
      objectType: isData ? "lifecycle_data_process" : "lifecycle_application_stage",
      objectLabel: isData ? "LC-DT 数据过程" : "LC-AP 阶段",
      id: id || stableKey,
      code: stableKey,
      title: title || stableKey,
      anchorType: "object",
    };
    if (display.annotationTargetAttrs) return ` ${display.annotationTargetAttrs(target, { title: title || stableKey })}`;
    return ` data-annotation-target-ref="${escapeHtml(target.targetRef)}" data-annotation-anchor-type="object" data-annotation-object-type="${escapeHtml(target.objectType)}" data-annotation-object-label="${escapeHtml(target.objectLabel)}" data-annotation-object-id="${escapeHtml(target.id)}" data-annotation-object-code="${escapeHtml(target.code)}" data-annotation-title="${escapeHtml(target.title)}" data-annotation-tooltip="${escapeHtml(target.title)}" title="${escapeHtml(target.title)}"`;
  }

  function highlightText(value) {
    const raw = String(value || "");
    const query = String(activeHighlightQuery || "").trim();
    if (!query) return escapeHtml(raw);
    const lowerRaw = raw.toLowerCase();
    const lowerQuery = query.toLowerCase();
    if (!lowerQuery || !lowerRaw.includes(lowerQuery)) return escapeHtml(raw);
    let cursor = 0;
    let output = "";
    while (cursor < raw.length) {
      const index = lowerRaw.indexOf(lowerQuery, cursor);
      if (index < 0) {
        output += escapeHtml(raw.slice(cursor));
        break;
      }
      output += escapeHtml(raw.slice(cursor, index));
      output += `<mark class="lifecycle-search-mark">${escapeHtml(raw.slice(index, index + query.length))}</mark>`;
      cursor = index + query.length;
    }
    return output;
  }

  function renderFieldLine(line) {
    const numbered = line.match(/^(\d+['’′]?)[).）、]\s*(.+)$/);
    if (numbered) {
      return `
        <span class="lifecycle-field-line is-numbered"${annotationValueAttrs(line)}>
          <span class="line-marker">${escapeHtml(numbered[1])}</span>
          <span class="line-text">${highlightText(numbered[2])}</span>
        </span>
      `;
    }

    const term = line.match(/^([^：:]{2,14})[：:]\s*(.+)$/);
    if (term) {
      return `
        <span class="lifecycle-field-line is-term"${annotationValueAttrs(line)}>
          <span class="line-term">${highlightText(term[1])}</span>
          <span class="line-text">${highlightText(term[2])}</span>
        </span>
      `;
    }

    return `<span class="lifecycle-field-line"${annotationValueAttrs(line)}><span class="line-text">${highlightText(line)}</span></span>`;
  }

  function renderMainActivityLine(line) {
    const numbered = line.match(/^(\d+['’′]?)[).）、]\s*(.+)$/);
    if (!numbered) return renderFieldLine(line);
    return `
      <span class="lifecycle-field-line is-numbered"${annotationValueAttrs(line)}>
        <span class="line-marker">${escapeHtml(numbered[1])}</span>
        <span class="line-text">${renderMainActivityText(numbered[2])}</span>
      </span>
    `;
  }

  function renderMainActivityText(text) {
    const match = String(text || "").match(/^([^：:\[]+)([：:\[].*)?$/);
    if (!match) return highlightText(text);
    const title = match[1].trim();
    const suffix = match[2] || "";
    if (!isSecurityMainActivityTitle(title)) return highlightText(text);
    return `<span class="security-main-activity-title">${highlightText(title)}</span>${highlightText(suffix)}`;
  }

  function isSecurityMainActivityTitle(title) {
    return /安全|威胁建模/.test(String(title || ""));
  }

  function chipItems(value) {
    if (!Array.isArray(value)) return splitLines(value).map((line) => ({ label: line, kind: "" })).filter((item) => isBusinessText(item.label));
    return value
      .flatMap((item) => {
        if (item && typeof item === "object") {
          return {
            ...item,
            label: titleOf(item, ""),
            kind: item.objectKind || item.object_kind || "",
          };
        }
        return splitLines(item).map((line) => ({ label: line, kind: "" }));
      })
      .filter((item) => isBusinessText(item.label));
  }

  function inlineChips(value, tone = "") {
    const items = chipItems(value);
    if (!items.length) return `<span class="empty-inline">${EMPTY_VALUE}</span>`;
    return `
      <div class="lifecycle-inline-chips ${escapeHtml(tone)}">
        ${items.map((item) => technicalRelationChip({ ...item, title: item.label, objectKind: item.kind || item.objectKind }, fallbackTechnicalKind(tone))).join("")}
      </div>
    `;
  }

  function developmentChips(value, tone = "dev") {
    const items = chipItems(value);
    if (!items.length) return `<span class="empty-inline">${EMPTY_VALUE}</span>`;
    return `
      <div class="lifecycle-inline-chips ${escapeHtml(tone)}">
        ${items.map((item) => `<span class="lifecycle-chip-item"${annotationValueAttrs(item.label)}><em>${highlightText(item.label)}</em></span>`).join("")}
      </div>
    `;
  }

  function objectChipItems(value) {
    return list(value)
      .flatMap((item) => {
        if (item && typeof item === "object") {
          return {
            ...item,
            code: item.code || "",
            label: titleOf(item, ""),
            kind: item.objectKind || item.object_kind || "",
          };
        }
        return splitLines(item).map((line) => ({ code: "", label: line, kind: "" }));
      })
      .filter((item) => isBusinessText(item.label) || isBusinessText(item.code));
  }

  function semanticObjectChips(value, tone = "") {
    const items = objectChipItems(value);
    if (!items.length) return `<span class="empty-inline">${EMPTY_VALUE}</span>`;
    return `
      <div class="lifecycle-object-chip-list ${escapeHtml(tone)}">
        ${items.map((item) => technicalRelationChip({ ...item, code: item.code, title: item.label, objectKind: item.kind || item.objectKind }, fallbackTechnicalKind(tone))).join("")}
      </div>
    `;
  }

  function fallbackTechnicalKind(tone = "") {
    if (tone === "security") return "安全技术服务";
    if (tone === "module") return "安全技术模块";
    if (tone === "measure") return "安全技术措施";
    return "";
  }

  function lifecycleSearchTargetAttrs(targetRef = "", extra = {}) {
    const normalizedTargetRef = String(targetRef || "").trim();
    if (!normalizedTargetRef) return "";
    const attrs = [`data-lifecycle-target-ref="${escapeHtml(normalizedTargetRef)}"`];
    Object.entries(extra || {}).forEach(([key, value]) => {
      const normalizedValue = String(value || "").trim();
      if (!normalizedValue) return;
      attrs.push(`${key}="${escapeHtml(normalizedValue)}"`);
    });
    return ` ${attrs.join(" ")}`;
  }

  function technicalRelationChip(item, fallbackKind = "") {
    const objectKind = item.objectKind || fallbackKind;
    const code = isBusinessText(item.code) ? item.code : "";
    const title = isBusinessText(item.title) ? item.title : "";
    if (!code && !title) return "";
    const searchTargetRef = String(item.searchTargetRef || item.targetRef || "").trim();
    if (display.relationChip && !activeHighlightQuery && !searchTargetRef) {
      return display.relationChip(utils, { ...item, code, title, objectKind }, { kind: objectKind, showKind: true, preferCodeTitle: true });
    }
    const kindClass = objectKind.includes("措施") ? "measure-chip" : objectKind.includes("模块") ? "module-chip" : objectKind.includes("服务") ? "service-chip" : "";
    const visibleText = [code, title].filter(Boolean).join(" ");
    const isService = objectKind.includes("服务");
    const annotationText = [isService ? "" : objectKind, visibleText].filter(Boolean).join(" | ");
    return `<span class="relation-chip technical-chip ${kindClass}"${annotationValueAttrs(annotationText)}${serviceScopeAttrs({ ...item, code, title }, objectKind)}${lifecycleSearchTargetAttrs(searchTargetRef, {
      "data-lifecycle-relation-type": item.relationType,
      "data-lifecycle-policy-row-id": item.policyRowId,
      "data-lifecycle-object-id": item.objectId || item.id || item.code || item.title,
    })}>${objectKind && !isService ? `<em>${escapeHtml(objectKind)}</em>` : ""}<span class="relation-chip-text">${highlightText(visibleText)}</span></span>`;
  }

  function dataPolicyRowTargetRef(stageId, row) {
    const rowId = String(row?.id || "").trim();
    const ownerId = String(stageId || row?.stageId || "").trim();
    if (!ownerId || !rowId) return "";
    return `lifecycle_policy_row:${ownerId}:${rowId}`;
  }

  function dataPolicyTechnicalRelationType(item, fallback = "security_technology_module") {
    const objectKind = String(item?.objectKind || item?.object_kind || "").trim();
    const type = String(item?.type || "").trim();
    if (type) return type;
    return objectKind.includes("措施") ? "security_technical_measure" : fallback;
  }

  function dataPolicyRelationTargetRef(stageId, row, relationType, item) {
    const rowId = String(row?.id || "").trim();
    const ownerId = String(stageId || row?.stageId || "").trim();
    const objectId = String(item?.id || item?.code || item?.title || item?.name || "").trim();
    if (!ownerId || !rowId || !relationType || !objectId) return "";
    return `lifecycle_policy_relation:${relationType}:${ownerId}:${rowId}:${objectId}`;
  }

  function withDataPolicySearchTargets(items, row, stageId, relationType, objectKind = "") {
    return list(items).map((item) => {
      const resolvedRelationType = relationType || dataPolicyTechnicalRelationType(item);
      return {
        ...item,
        objectKind: item?.objectKind || item?.object_kind || objectKind,
        relationType: resolvedRelationType,
        policyRowId: row?.id || "",
        objectId: item?.id || item?.code || item?.title || item?.name || "",
        searchTargetRef: dataPolicyRelationTargetRef(stageId, row, resolvedRelationType, item),
      };
    });
  }

  function renderDataScenarioList(scenes) {
    const items = list(scenes).filter((scene) => [scene?.title, scene?.description, scene?.code].some(isBusinessText));
    if (!items.length) return `<span class="empty-inline">${EMPTY_VALUE}</span>`;
    return `
      <div class="data-scenario-stack">
        ${items
          .map(
            (scene) => `
              <div class="data-scenario-item">
                <div class="data-scenario-title"${annotationValueAttrs([scene.code, scene.title].filter(isBusinessText).join(" "))}>
                  ${isBusinessText(scene.code) ? `<code>${escapeHtml(scene.code)}</code>` : ""}
                  <strong>${escapeHtml(displayValue(scene.title))}</strong>
                </div>
                ${isBusinessText(scene.description) ? `<p${annotationValueAttrs(scene.description)}>${escapeHtml(scene.description)}</p>` : ""}
              </div>
            `,
          )
          .join("")}
      </div>
    `;
  }

  function tableText(value, className = "") {
    return `<div class="lifecycle-table-text ${escapeHtml(className)}">${fieldCell(value)}</div>`;
  }

  function emptyValueCellClass(value) {
    const lines = splitLines(value);
    return lines.length ? "" : " lifecycle-empty-value-cell";
  }

  function sourceNote(value, label = "参考来源") {
    const lines = splitLines(value).filter(isBusinessText);
    if (!lines.length) return "";
    const referenceText = lines.join("； ");
    return `
      <div class="source-reference-note lifecycle-activity-source-note">
        <span class="source-reference-label activity-source-label">${escapeHtml(label)}</span>
        <div class="source-reference-value activity-source-values">
          <span${annotationValueAttrs(referenceText)}>${escapeHtml(referenceText)}</span>
        </div>
      </div>
    `;
  }

  function mainActivityCell(row) {
    const lines = splitLines(row.mainActivity);
    const activityContent =
      !lines.length
        ? `<span class="empty-inline">${EMPTY_VALUE}</span>`
        : `<div class="lifecycle-field-lines">${lines.map(renderMainActivityLine).join("")}</div>`;
    return `
      <div class="lifecycle-main-activity-cell">
        <div class="lifecycle-table-text main-activities">${activityContent}</div>
        ${hasBusinessValue(row.mainActivity) ? sourceNote(row.mainActivityReference) : ""}
      </div>
    `;
  }

  function securityActivityCell(row) {
    return `
      <div class="lifecycle-security-activity-cell">
        ${tableText(row.securityActivities, "security-activities")}
        ${hasBusinessValue(row.securityActivities) ? sourceNote(row.policyReference) : ""}
      </div>
    `;
  }

  function renderDevelopmentProfileRow(row, selectedStageId) {
    return `
      <tr class="${row.stageId === selectedStageId ? "selected" : ""}" data-lifecycle-kind="dev" data-lifecycle-id="${escapeHtml(row.stageId)}">
        <td>${tableText(row.stageGoal)}</td>
        <td>${mainActivityCell(row)}</td>
        <td>${tableText(row.developmentTypes, "development-mode")}</td>
        <td>${developmentChips(row.developmentServices, "dev")}</td>
        <td>${developmentChips(row.developmentModules, "dev-module")}</td>
      </tr>
    `;
  }

  function renderSecurityControlRow(row) {
    return `
      <tr data-lifecycle-kind="dev" data-lifecycle-id="${escapeHtml(row.stageId || "")}">
        <td class="${emptyValueCellClass(row.securityActivities)}">${securityActivityCell(row)}</td>
        <td class="${emptyValueCellClass(row.policyRequirements)}">${tableText(row.policyRequirements)}</td>
        <td class="${emptyValueCellClass(row.threatScenarios)}">${tableText(row.threatScenarios, "threat")}</td>
        <td class="${emptyValueCellClass(row.supplementalPolicies)}">${tableText(row.supplementalPolicies)}</td>
        <td class="${emptyValueCellClass(row.technicalServices)}">${inlineChips(row.technicalServices, "security")}</td>
        <td class="${emptyValueCellClass(row.technologyModules)}">${inlineChips(row.technologyModules, "module")}</td>
      </tr>
    `;
  }

  function renderDataScenarioTitleCell(scene) {
    if (![scene?.title, scene?.code].some(isBusinessText)) return `<span class="empty-inline">${EMPTY_VALUE}</span>`;
    const titleText = [scene.code, scene.title].filter(isBusinessText).join(" ");
    return `
      <div class="data-scenario-title-cell"${annotationValueAttrs(titleText)}>
        ${isBusinessText(scene.code) ? `<code>${escapeHtml(scene.code)}</code>` : ""}
        <strong>${escapeHtml(displayValue(scene.title))}</strong>
      </div>
    `;
  }

  function renderDataScenarioDefinitionCell(scene) {
    if (!isBusinessText(scene?.description)) return `<span class="empty-inline">${EMPTY_VALUE}</span>`;
    return `<div class="data-scenario-definition"${annotationValueAttrs(scene.description)}>${escapeHtml(scene.description)}</div>`;
  }

  function renderDataProcessProfileRows(row, selectedStageId) {
    const scenes = list(row.scenes).length ? list(row.scenes) : [{ id: `${row.stageId}:empty-scene`, title: "", description: "" }];
    const rowSpan = scenes.length;
    return scenes
      .map((scene, index) => {
        const isFirst = index === 0;
        return `
          <tr class="${row.stageId === selectedStageId ? "selected" : ""} ${isFirst ? "data-process-group-start" : "data-process-group-continuation"}" data-lifecycle-kind="data" data-lifecycle-id="${escapeHtml(row.stageId)}">
            ${isFirst ? `<td class="data-process-definition-cell" rowspan="${rowSpan}">${tableText(row.processDefinition)}</td>` : ""}
            <td class="data-scenario-name-cell">${renderDataScenarioTitleCell(scene)}</td>
            <td class="data-scenario-definition-cell">${renderDataScenarioDefinitionCell(scene)}</td>
          </tr>
        `;
      })
      .join("");
  }

  function renderDataTechnicalSummary(row) {
    if (!row) return "";
    return `
      <div class="relationship-matrix-scroll semantic-scroll data-lifecycle-technical-scroll" data-lifecycle-kind="data" data-lifecycle-id="${escapeHtml(row.stageId || "")}">
        <table class="semantic-mapping-table data-lifecycle-technical-table">
          <colgroup>
            <col style="width: 62%" />
            <col style="width: 38%" />
          </colgroup>
          <thead>
            <tr>
              <th>${utils.escapeHtml(display.label?.("security_technical_service", "安全技术服务") || "安全技术服务")}</th>
              <th>${utils.escapeHtml(display.label?.("security_module_or_measure", "安全技术模块/措施") || "安全技术模块/措施")}</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>${semanticObjectChips(row.technicalServices, "security")}</td>
              <td>${semanticObjectChips(row.technologyModules, "module")}</td>
            </tr>
          </tbody>
        </table>
      </div>
    `;
  }

  function renderDataPolicyCell(policy) {
    if (!policy || !hasBusinessValue(policy.text)) return `<span class="empty-inline">${EMPTY_VALUE}</span>`;
    const isNotApplicable = policy.status === "not_applicable" || policy.text === "不涉及";
    return `
      <div class="data-policy-cell ${isNotApplicable ? "is-not-applicable" : ""}">
        ${isBusinessText(policy.code) ? `<strong${annotationValueAttrs(policy.code)}>${escapeHtml(policy.code)}</strong>` : ""}
        <span${annotationValueAttrs(policy.text)}>${escapeHtml(policy.text)}</span>
        ${sourceNote(policy.reference)}
      </div>
    `;
  }

  function policyByLevel(row, level) {
    return list(row.policies).find((policy) => policy.level === level) || null;
  }

  function renderDataPolicyRow(row, { showCategory = true, selectedStageId = "" } = {}) {
    const rowTargetRef = dataPolicyRowTargetRef(selectedStageId, row);
    const serviceItems = withDataPolicySearchTargets(row.technicalServices, row, selectedStageId, "security_technical_service", "安全技术服务");
    const moduleItems = withDataPolicySearchTargets(row.technologyModules, row, selectedStageId, "", "安全技术模块");
    return `
      <tr data-lifecycle-kind="data" data-lifecycle-id="${escapeHtml(selectedStageId || row.stageId || "")}"${lifecycleSearchTargetAttrs(rowTargetRef, {
        "data-lifecycle-policy-row-id": row.id,
      })}>
        ${showCategory ? `<td>${tableText([row.category, row.sequence || ""].filter(Boolean).join("\n"))}</td>` : `<td>${tableText(row.sequence || "")}</td>`}
        <td>${renderDataPolicyCell(policyByLevel(row, "I"))}</td>
        <td>${renderDataPolicyCell(policyByLevel(row, "S"))}</td>
        <td>${renderDataPolicyCell(policyByLevel(row, "N"))}</td>
        <td>${renderDataPolicyCell(policyByLevel(row, "P"))}</td>
        <td class="${emptyValueCellClass(row.technicalServices)}">${inlineChips(serviceItems, "security")}</td>
        <td class="${emptyValueCellClass(row.technologyModules)}">${inlineChips(moduleItems, "module")}</td>
      </tr>
    `;
  }

  function dataPolicyGroups(rows) {
    const groups = [];
    for (const row of list(rows)) {
      const category = row.category || "未分类策略";
      let group = groups.find((item) => item.category === category);
      if (!group) {
        group = { category, rows: [] };
        groups.push(group);
      }
      group.rows.push(row);
    }
    return groups;
  }

  function renderDataPolicyGroup(group, selectedStageId = "") {
    const rows = list(group.rows);
    return `
      <details class="data-policy-category-group">
        <summary>
          <strong>${escapeHtml(group.category)}</strong>
          <span>${rows.length} 项策略</span>
        </summary>
        <div class="lifecycle-table-scroll lifecycle-security-scroll">
          <table class="lifecycle-workbench-table lifecycle-security-table data-lifecycle-policy-table data-lifecycle-policy-group-table">
            <colgroup>
              <col style="width: 4%" />
              <col style="width: 15%" />
              <col style="width: 15%" />
              <col style="width: 15%" />
              <col style="width: 15%" />
              <col style="width: 18%" />
              <col style="width: 18%" />
            </colgroup>
            <thead>
              <tr>
                <th>编号</th>
                <th>重要数据</th>
                <th>个人敏感数据</th>
                <th>非公开数据</th>
                <th>公开数据</th>
                <th>${utils.escapeHtml(display.label?.("security_technical_service", "安全技术服务") || "安全技术服务")}</th>
                <th>${utils.escapeHtml(display.label?.("security_module_or_measure", "安全技术模块/措施") || "安全技术模块/措施")}</th>
              </tr>
            </thead>
            <tbody>
              ${rows.map((row) => renderDataPolicyRow(row, { showCategory: false, selectedStageId })).join("")}
            </tbody>
          </table>
        </div>
      </details>
    `;
  }

  function renderDevelopmentProfileTable(rows, selectedStageId) {
    return `
      <section class="lifecycle-logic-section lifecycle-table-panel">
        <div class="lifecycle-logic-head">
          <h4>开发阶段画像</h4>
        </div>
        <div class="lifecycle-table-scroll lifecycle-profile-scroll">
          <table class="lifecycle-workbench-table lifecycle-profile-table">
            <colgroup>
              <col style="width: 22%" />
              <col style="width: 28%" />
              <col style="width: 14%" />
              <col style="width: 18%" />
              <col style="width: 18%" />
            </colgroup>
            <thead>
              <tr>
                <th>阶段目标</th>
                <th>阶段主要活动</th>
                <th>软件开发模式</th>
                <th>开发技术服务</th>
                <th>开发技术模块</th>
              </tr>
            </thead>
            <tbody>
              ${rows.map((row) => renderDevelopmentProfileRow(row, selectedStageId)).join("") || `<tr><td colspan="5">暂无 LC-AP 阶段画像</td></tr>`}
            </tbody>
          </table>
        </div>
      </section>
    `;
  }

  function renderSecurityControlTable(rows) {
    return `
      <section class="lifecycle-logic-section lifecycle-table-panel">
        <div class="lifecycle-logic-head">
          <h4>阶段安全控制与威胁补充策略表</h4>
        </div>
        <div class="lifecycle-table-scroll lifecycle-security-scroll">
          <table class="lifecycle-workbench-table lifecycle-security-table">
            <colgroup>
              <col style="width: 12%" />
              <col style="width: 23%" />
              <col style="width: 15%" />
              <col style="width: 18%" />
              <col style="width: 16%" />
              <col style="width: 16%" />
            </colgroup>
            <thead>
              <tr>
                <th>安全活动</th>
                <th>安全活动对应策略要求</th>
                <th>潜在安全威胁场景</th>
                <th>补充策略要求</th>
                <th>${utils.escapeHtml(display.label?.("security_technical_service", "安全技术服务") || "安全技术服务")}</th>
                <th>${utils.escapeHtml(display.label?.("security_module_or_measure", "安全技术模块/措施") || "安全技术模块/措施")}</th>
              </tr>
            </thead>
            <tbody>
              ${rows.map(renderSecurityControlRow).join("") || `<tr><td colspan="6">暂无阶段安全控制数据</td></tr>`}
            </tbody>
          </table>
        </div>
      </section>
    `;
  }

  function renderDataProcessProfileTable(rows, selectedStageId) {
    const selectedRow = list(rows).find((row) => row.stageId === selectedStageId) || null;
    return `
      <section class="lifecycle-logic-section lifecycle-table-panel">
        <div class="lifecycle-logic-head">
          <h4>数据处理场景与技术映射</h4>
        </div>
        <div class="lifecycle-table-scroll lifecycle-profile-scroll">
          <table class="lifecycle-workbench-table lifecycle-profile-table data-lifecycle-profile-table">
            <colgroup>
              <col style="width: 18%" />
              <col style="width: 22%" />
              <col style="width: 60%" />
            </colgroup>
            <thead>
              <tr>
                <th>过程定义</th>
                <th>数据处理子场景</th>
                <th>子场景定义</th>
              </tr>
            </thead>
            <tbody>
              ${rows.map((row) => renderDataProcessProfileRows(row, selectedStageId)).join("") || `<tr><td colspan="3">暂无 LC-DT 数据处理过程画像</td></tr>`}
            </tbody>
          </table>
        </div>
        ${renderDataTechnicalSummary(selectedRow)}
      </section>
    `;
  }

  function renderDataPolicyMatrixTable(rows, selectedStageId = "") {
    const groups = dataPolicyGroups(rows);
    return `
      <section class="lifecycle-logic-section lifecycle-table-panel">
        <div class="lifecycle-logic-head">
          <h4>数据重要程度安全策略矩阵</h4>
        </div>
        ${
          groups.length
            ? `<div class="data-policy-category-stack">${groups.map((group) => renderDataPolicyGroup(group, selectedStageId)).join("")}</div>`
            : `<div class="reference-empty">暂无数据重要程度安全策略映射</div>`
        }
      </section>
    `;
  }

  function renderRecordTables({ rows, profileRows, selectedStageId }) {
    return `
      <div class="lifecycle-logic-stack">
        ${renderDevelopmentProfileTable(profileRows, selectedStageId)}
        ${renderSecurityControlTable(rows)}
      </div>
    `;
  }

  function renderDataRecordTables({ rows, policyRows, selectedStageId }) {
    return `
      <div class="lifecycle-logic-stack">
        ${renderDataProcessProfileTable(rows, selectedStageId)}
        ${renderDataPolicyMatrixTable(list(policyRows), selectedStageId)}
      </div>
    `;
  }

  function renderNavigation({ stageTree, navigationTree, selectedProcessId, search = "", kind = "dev" }) {
    const previousHighlightQuery = activeHighlightQuery;
    activeHighlightQuery = search;
    const query = String(search || "").trim().toLowerCase();
    const rows = list(stageTree || navigationTree).filter((row) => {
      if (!query) return true;
      return [titleOf(row, ""), row.code, row.order, row.searchText].map((value) => String(value || "")).join(" ").toLowerCase().includes(query);
    });
    if (!rows.length) {
      activeHighlightQuery = previousHighlightQuery;
      return `
        <div class="lifecycle-stage-empty">
          <strong>没有匹配阶段</strong>
          <span>换一个关键词试试。</span>
        </div>
      `;
    }
    const textUnits = (value) =>
      Array.from(String(value || "")).reduce((total, char) => total + (/[\u0000-\u007f]/.test(char) ? 0.58 : 1), 0);
    const stageMeta = rows.map((row, index) => {
      const code = row.code || row.order || `${kind === "data" ? "DT" : "AP"}-${String(index + 1).padStart(2, "0")}`;
      const title = titleOf(row, "未命名阶段");
      return { row, code, title };
    });
    const maxTitleUnits = Math.max(...stageMeta.map((item) => textUnits(item.title)), 0);
    const maxCodeUnits = Math.max(...stageMeta.map((item) => textUnits(item.code)), 0);
    const tabWidth = Math.ceil(Math.max(maxTitleUnits * 15, maxCodeUnits * 8) + 58);
    const html = `
      ${stageMeta
        .map(({ row, code, title }) => {
          return `
            <button class="lifecycle-nav-row ${row.id === selectedProcessId ? "active" : ""}" type="button" data-lifecycle-kind="${escapeHtml(kind)}" data-lifecycle-id="${escapeHtml(row.id)}" data-annotation-prefer-target="true"${lifecycleTargetAttrs(row, kind)} style="--stage-tab-width: ${tabWidth}px;">
              <span class="stage-tab-code">${highlightText(code)}</span>
              <strong>${highlightText(title)}</strong>
            </button>
          `;
        })
        .join("")}
    `;
    activeHighlightQuery = previousHighlightQuery;
    return html;
  }

  function renderStageOverview(viewModel) {
    const overview = viewModel?.stageOverview;
    if (!overview) return "";
    const facts = list(overview.facts).filter((fact) => isBusinessText(fact?.label) && hasBusinessValue(fact?.value));
    const visibleFacts = facts.filter((fact) => !["安全技术服务", "安全技术模块", "安全技术措施", "开发技术服务", "开发技术模块"].includes(String(fact.label || ""))).slice(0, 4);
    return `
      <section class="lifecycle-stage-context" aria-label="当前${overview.mode === "data" ? "数据过程" : "开发阶段"}上下文">
        <div class="lifecycle-stage-context__identity">
          <span>${escapeHtml(overview.status || (overview.mode === "data" ? "当前数据过程" : "当前阶段"))}</span>
          <strong><code>${escapeHtml(overview.code || (overview.mode === "data" ? "LC-DT" : "LC-AP"))}</code>${escapeHtml(displayValue(overview.title))}</strong>
        </div>
        <p>${escapeHtml(displayValue(overview.description))}</p>
        ${
          visibleFacts.length
            ? `<dl>${visibleFacts
                .map((fact) => `<div><dt>${escapeHtml(fact.label)}</dt><dd>${escapeHtml(displayValue(fact.value))}</dd></div>`)
                .join("")}</dl>`
            : ""
        }
      </section>
    `;
  }

  function renderRelationTable({ rows, profileRows, policyRows, overview, searchQuery = "", mode = "", selectedStageId = "", emptyMessage = "" }) {
    const previousHighlightQuery = activeHighlightQuery;
    activeHighlightQuery = searchQuery;
    const relationRows = list(rows);
    const allProfileRows = list(profileRows).length ? list(profileRows) : relationRows;
    const isDataMode = mode === "data" || overview?.mode === "data";
    const html = `
      <section class="semantic-panel lifecycle-relation-section">
        <div class="lifecycle-record-scroll">
          ${
            relationRows.length
              ? isDataMode
                ? renderDataRecordTables({ rows: relationRows, policyRows, selectedStageId })
                : renderRecordTables({ rows: relationRows, profileRows: allProfileRows, selectedStageId })
              : `<div class="reference-empty">${utils.escapeHtml(emptyMessage || (isDataMode ? "暂无 LC-DT 数据安全关系" : "暂无 LC-AP 阶段关系"))}</div>`
          }
        </div>
      </section>
    `;
    activeHighlightQuery = previousHighlightQuery;
    return html;
  }

  function renderLocalRelationNotes(notes) {
    return "";
  }

  function renderReferenceSections(referenceSections) {
    const softwareTypes = list(referenceSections?.softwareDevelopmentTypes);
    const systemTypes = list(referenceSections?.applicationSystemTypes);
    return `
      <section class="semantic-panel lifecycle-reference-section">
        <div class="matrix-section-head">
          <div>
            <h3>参考数据</h3>
            <p>软件开发类型、应用系统类型和应用组件仅作为同页参考，不伪造成正式映射关系</p>
          </div>
          <span>${softwareTypes.length + systemTypes.length} 项</span>
        </div>
        <div class="lifecycle-reference-grid">
          <div class="lifecycle-reference-block">
            <h4>软件开发类型</h4>
            <div class="source-chip-row">${fieldCell(softwareTypes.map((item) => titleOf(item, ""))) || EMPTY_VALUE}</div>
          </div>
          <div class="lifecycle-reference-block">
            <h4>应用系统类型 / 应用组件</h4>
            <table class="semantic-mapping-table lifecycle-reference-table">
              <thead><tr><th>应用系统类型</th><th>应用组件</th></tr></thead>
              <tbody>
                ${
                  systemTypes
                    .map(
                      (system) => `
                        <tr>
                          <td><span${annotationValueAttrs(titleOf(system, ""))}>${escapeHtml(displayValue(titleOf(system, "")))}</span></td>
                          <td>${fieldCell(system.components.map((item) => titleOf(item, ""))) || EMPTY_VALUE}</td>
                        </tr>
                      `,
                    )
                    .join("") || `<tr><td colspan="2">暂无应用系统类型数据</td></tr>`
                }
              </tbody>
            </table>
          </div>
        </div>
      </section>
    `;
  }

  window.sapdComponents = window.sapdComponents || {};
  window.sapdComponents.ApplicationSecurityLifecycle = {
    renderNavigation,
    renderStageOverview,
    renderRelationTable,
    renderLocalRelationNotes,
    renderReferenceSections,
  };
})();
