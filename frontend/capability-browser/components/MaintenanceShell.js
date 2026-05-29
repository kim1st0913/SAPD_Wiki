(function () {
  const components = (window.sapdComponents = window.sapdComponents || {});
  const utils = components.utils;

  function summaryBadge(label, value) {
    return `<span class="measure-summary-badge"><small>${utils.escapeHtml(label)}</small><strong>${utils.escapeHtml(value)}</strong></span>`;
  }

  function renderSummary(section, summary = {}) {
    if (section === "scopes") {
      return [
        summaryBadge("作用域", summary.totalScopes ?? 0),
        summaryBadge("情景", summary.scenarios ?? 0),
        summaryBadge("关联服务", summary.linkedServices ?? 0),
        summaryBadge("关联对象", summary.linkedObjects ?? 0),
      ].join("");
    }
    if (section === "measures") {
      return [
        summaryBadge("措施", summary.totalMeasures ?? 0),
        summaryBadge("关联服务", summary.linkedServices ?? 0),
        summaryBadge("适用作用域", summary.linkedScopes ?? 0),
        summaryBadge("关联环境", summary.linkedEnvironments ?? 0),
        summaryBadge("关联对象", summary.linkedObjects ?? 0),
      ].join("");
    }
    if (section === "services") {
      return [
        summaryBadge("技术服务", summary.totalServices ?? 0),
        summaryBadge("归属关注点", summary.linkedFocuses ?? 0),
        summaryBadge("关联模块", summary.linkedModules ?? 0),
        summaryBadge("待补定义", summary.missingDefinitions ?? 0),
      ].join("");
    }
    if (section === "processes") {
      return [
        summaryBadge("流程", summary.totalProcesses ?? 0),
        summaryBadge("L2 流程组", summary.processGroups ?? 0),
        summaryBadge("关联安全职能", summary.linkedFunctions ?? 0),
      ].join("");
    }
    if (section === "work-functions") {
      return [
        summaryBadge("安全职能", summary.totalFunctions ?? 0),
        summaryBadge("职能层", summary.layers ?? 0),
        summaryBadge("关联安全工作", summary.linkedWorks ?? 0),
        summaryBadge("关联流程", summary.linkedProcesses ?? 0),
      ].join("");
    }
    if (section === "security-works") {
      return [
        summaryBadge("安全工作", summary.totalSecurityWorks ?? 0),
        summaryBadge("关联能力", summary.linkedCapabilities ?? 0),
        summaryBadge("关联关注点", summary.linkedFocuses ?? 0),
        summaryBadge("待补字段", summary.pendingFields ?? 0),
      ].join("");
    }
    if (section === "modules") {
      return [
        summaryBadge("技术模块", summary.totalModules ?? 0),
        summaryBadge("关联服务", summary.linkedServices ?? 0),
        summaryBadge("关联作用域", summary.linkedScopes ?? 0),
        summaryBadge("关联对象", summary.linkedObjects ?? 0),
      ].join("");
    }
    if (section === "references") {
      return [
        summaryBadge("参考项", summary.totalReferences ?? 0),
        summaryBadge("标准任务", summary.standardTasks ?? 0),
        summaryBadge("岗位参考", summary.roleReferences ?? 0),
        summaryBadge("待复核", summary.pendingReview ?? 0),
      ].join("");
    }
    if (section === "lcap-references") {
      return [
        summaryBadge("参考项", summary.totalReferences ?? 0),
        summaryBadge("软件开发类型", summary.softwareTypes ?? 0),
        summaryBadge("应用系统类型", summary.applicationSystemTypes ?? 0),
        summaryBadge("应用组件", summary.applicationComponents ?? 0),
      ].join("");
    }
    return "";
  }

  function renderSectionTabs(tabs = []) {
    const rows = utils.list(tabs);
    if (!rows.length) return "";
    return `
      <div class="maintenance-section-tabs" role="tablist" aria-label="安全知识页签">
        ${rows
          .map(
            (tab) => `
              <button class="maintenance-section-tab ${tab.active ? "active" : ""}" type="button" role="tab" data-source-page="${utils.escapeHtml(tab.sourcePage || tab.id)}"${tab.referenceTab ? ` data-reference-tab="${utils.escapeHtml(tab.referenceTab)}"` : ""} aria-selected="${tab.active ? "true" : "false"}">
                <span>${utils.escapeHtml(tab.label)}</span>
                <strong>${utils.escapeHtml(tab.count ?? 0)}</strong>
              </button>
            `,
          )
          .join("")}
      </div>
    `;
  }

  function render({ viewModel }) {
    const tabs = renderSectionTabs(viewModel?.sectionTabs);
    if (!tabs) return "";
    return `
      <section class="maintenance-shell-head crf-like-tabs">
        ${tabs}
      </section>
    `;
  }

  components.MaintenanceShell = { render };
})();
