(function () {
  const components = (window.sapdComponents = window.sapdComponents || {});
  const utils = components.utils;

  function render({ navigationItems }) {
    return utils
      .list(navigationItems)
      .map(
        (item) => `
          <button class="source-nav-button ${item.active ? "active" : ""}" type="button" data-source-page="${utils.escapeHtml(item.id)}">
            <span>${utils.escapeHtml(item.label)}</span>
            <strong>${utils.escapeHtml(item.count ?? 0)}</strong>
            ${item.implemented ? "" : '<small class="nav-soon">后续</small>'}
          </button>
        `,
      )
      .join("");
  }

  components.MaintenanceNavigation = { render };
})();
