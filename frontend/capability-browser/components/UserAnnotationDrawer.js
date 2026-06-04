(function () {
  const components = (window.sapdComponents = window.sapdComponents || {});
  const utils = components.utils || {};

  function text(value) {
    if (utils.text) return utils.text(value);
    return value == null ? "" : String(value);
  }

  function list(value) {
    if (utils.list) return utils.list(value);
    return Array.isArray(value) ? value : [];
  }

  function escape(value) {
    if (utils.escapeHtml) return utils.escapeHtml(value);
    return text(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }

  const STATUS_LABELS = {
    todo: "待处理",
    reviewing: "处理中",
    waiting_confirm: "待确认",
    confirmed: "已确认",
    closed: "已关闭",
    deferred: "暂不处理",
  };

  function noteDate(value) {
    const raw = text(value);
    if (!raw) return "";
    return raw.replace("T", " ").replace("Z", "").slice(0, 16);
  }

  function renderNoteCard(note) {
    const status = text(note.status || "todo");
    return `
      <article class="annotation-note-card" data-user-note-id="${escape(note.id)}">
        <div class="annotation-note-meta">
          <span class="annotation-status-pill status-${escape(status)}">${escape(STATUS_LABELS[status] || STATUS_LABELS.todo)}</span>
          <time>${escape(noteDate(note.updated_at || note.created_at))}</time>
        </div>
        <p>${escape(note.body || "暂无批注内容")}</p>
        <div class="annotation-note-footer">
          <select data-user-note-status="${escape(note.id)}" aria-label="修改批注状态">
            ${Object.entries(STATUS_LABELS)
              .map(([value, label]) => `<option value="${escape(value)}"${value === status ? " selected" : ""}>${escape(label)}</option>`)
              .join("")}
          </select>
          <button type="button" data-user-note-delete="${escape(note.id)}">删除</button>
        </div>
      </article>
    `;
  }

  function renderNoteList(notes, emptyText) {
    const rows = list(notes);
    if (!rows.length) return `<div class="annotation-empty">${escape(emptyText)}</div>`;
    return `<div class="annotation-note-list">${rows.map(renderNoteCard).join("")}</div>`;
  }

  function renderLegacyFavorite(favorite) {
    const note = text(favorite?.note).trim();
    if (!note) return "";
    return `
      <article class="annotation-legacy-note">
        <span>过渡收藏备注</span>
        <p>${escape(note)}</p>
      </article>
    `;
  }

  function render({ open = false, target, pageTarget, notes = [], favorite, status = {}, draft = "" }) {
    const currentTarget = target || pageTarget;
    if (!currentTarget?.targetRef) return "";
    const loading = status.state === "loading";
    const unavailable = status.state === "api_unavailable" || status.state === "api_error";
    const saving = Boolean(status.savingNote);
    const objectNotes = list(notes).filter((note) => text(note.target_ref).trim() === text(currentTarget.targetRef).trim());
    const pageNotes = list(notes).filter((note) => text(note.page_route).trim() === text(pageTarget?.code || "").trim());
    const totalCount = list(notes).length + (text(favorite?.note).trim() ? 1 : 0);
    const tags = list(currentTarget.tags).length
      ? list(currentTarget.tags)
      : [currentTarget.objectLabel, currentTarget.title].filter(Boolean);
    const disabledAttr = loading || unavailable || saving ? " disabled" : "";
    const title = currentTarget.title || currentTarget.code || currentTarget.targetRef;
    const tabLabel = totalCount ? `批注 ${totalCount}` : "批注";
    return `
      <aside class="user-annotation-drawer ${open ? "is-open" : ""} ${unavailable ? "is-unavailable" : ""}" aria-label="批注工作台" data-annotation-drawer>
        <button class="annotation-drawer-tab" type="button" data-annotation-drawer-toggle aria-expanded="${open ? "true" : "false"}">
          <span>${escape(tabLabel)}</span>
        </button>
        <section class="annotation-drawer-panel" aria-hidden="${open ? "false" : "true"}">
          <header class="annotation-drawer-header">
            <div>
              <span class="annotation-kicker">工作台批注</span>
              <h2>${escape(title)}</h2>
            </div>
            <button type="button" class="annotation-drawer-close" data-annotation-drawer-close aria-label="收起批注面板">收起</button>
          </header>
          <div class="annotation-context-box">
            <div><span>页面</span><strong>${escape(pageTarget?.title || pageTarget?.code || "当前页面")}</strong></div>
            <div><span>对象</span><strong>${escape(currentTarget.objectLabel || "当前对象")}</strong></div>
            <div><span>编码</span><strong>${escape(currentTarget.code || currentTarget.id || currentTarget.targetRef)}</strong></div>
          </div>
          <div class="annotation-tag-row">
            ${tags.slice(0, 4).map((tag) => `<span>${escape(tag)}</span>`).join("")}
          </div>
          <form class="annotation-create-form" data-user-note-form>
            <label for="userAnnotationDraft">添加批注</label>
            <textarea id="userAnnotationDraft" data-user-note-draft rows="5" placeholder="记录复核结论、待确认点或需要后续处理的问题。" ${disabledAttr}>${escape(draft)}</textarea>
            <div class="annotation-form-tools">
              <span>${escape(unavailable ? "用户库不可用" : loading ? "正在读取用户库" : "写入用户库，不修改基础数据")}</span>
              <button type="submit"${disabledAttr}>${escape(saving ? "保存中" : "保存批注")}</button>
            </div>
          </form>
          ${renderLegacyFavorite(favorite)}
          <section class="annotation-section">
            <h3>当前对象批注</h3>
            ${renderNoteList(objectNotes, loading ? "正在读取批注..." : "当前对象暂无批注")}
          </section>
          <section class="annotation-section">
            <h3>当前页面批注</h3>
            ${renderNoteList(pageNotes, loading ? "正在读取批注..." : "当前页面暂无批注")}
          </section>
        </section>
      </aside>
    `;
  }

  components.UserAnnotationDrawer = { render };
})();
