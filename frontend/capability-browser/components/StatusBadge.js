(function () {
  const components = (window.sapdComponents = window.sapdComponents || {});
  const utils = components.utils || {
    escapeHtml: (value) => String(value == null ? "" : value),
  };

  function render({ label, value, tone = "neutral" }) {
    return `
      <span class="status-badge status-badge-${utils.escapeHtml(tone)}">
        <small>${utils.escapeHtml(label)}</small>
        <strong>${utils.escapeHtml(value)}</strong>
      </span>
    `;
  }

  components.StatusBadge = { render };
})();
