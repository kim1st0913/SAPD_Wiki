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
    return "";
  }

  function render({ viewModel }) {
    const page = viewModel?.page || {};
    return `
      <section class="maintenance-shell-head">
        <div class="measure-maintenance-copy">
          <strong>${utils.escapeHtml(page.title || "专项知识维护")}</strong>
          <span>${utils.escapeHtml(page.description || "该专项页面将在后续阶段接入。")}</span>
          ${page.notice ? `<em>${utils.escapeHtml(page.notice)}</em>` : ""}
        </div>
        <div class="measure-summary-strip">${renderSummary(viewModel?.section, viewModel?.summary)}</div>
      </section>
    `;
  }

  components.MaintenanceShell = { render };
})();
