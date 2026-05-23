(function () {
  const components = (window.sapdComponents = window.sapdComponents || {});
  const utils = components.utils;

  function renderNote(note) {
    return `
      <div class="local-note">
        <strong>${utils.escapeHtml(note.title || "局部关系")}</strong>
        <span>${utils.escapeHtml(note.body || "暂无说明")}</span>
      </div>
    `;
  }

  function render({ localRelationNotes }) {
    const notes = utils.list(localRelationNotes);
    return `
      <section class="semantic-panel environment-local-notes">
        <div class="matrix-section-head">
          <div>
            <h3>当前对象局部关系说明</h3>
            <p>用于解释当前表格关系，不额外创建右侧详情栏。</p>
          </div>
          <span>关系说明</span>
        </div>
        <div class="environment-detail-body">
          <div class="local-note-list">
            ${notes.map(renderNote).join("") || '<div class="detail-empty"><strong>暂无局部关系说明</strong><span>请选择左侧环境对象。</span></div>'}
          </div>
        </div>
      </section>
    `;
  }

  components.EnvironmentDetailPanel = { render };
})();
