(function () {
  const components = (window.sapdComponents = window.sapdComponents || {});
  const utils = components.utils;

  function sourceValue(value, empty = "") {
    if (value == null || value === "") return empty;
    if (typeof value === "number" && Number.isNaN(value)) return empty;
    const raw = typeof value === "object" ? utils.titleOf(value, "结构化内容") : value;
    const normalized = utils.text(raw).trim();
    return normalized && normalized !== "[object Object]" ? normalized : empty;
  }

  function render(sourceEvidence) {
    const rows = utils.list(sourceEvidence);
    if (!rows.length) {
      return `
        <details class="service-sources source-evidence-panel">
          <summary>来源证据（0）</summary>
          <div class="service-source">
            <span>暂无来源证据</span>
          </div>
        </details>
      `;
    }
    return `
      <details class="service-sources source-evidence-panel">
        <summary>来源证据（${rows.length}）</summary>
        ${rows
          .map(
            (source) => `
              <div class="service-source">
                <strong>${utils.escapeHtml(sourceValue(source.file || source.source_file || source.path, "来源文件"))}</strong>
                <span>${utils.escapeHtml([sourceValue(source.sheet), sourceValue(source.cell), source.row ? `第 ${sourceValue(source.row)} 行` : "", sourceValue(source.location)].filter(Boolean).join(" · ") || "位置待补充")}</span>
                <small>${utils.escapeHtml(sourceValue(source.raw_value || source.note))}</small>
              </div>
            `,
          )
          .join("")}
      </details>
    `;
  }

  components.SourceEvidencePanel = { render };
})();
