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

  const ANCHOR_LABELS = {
    page: "页面",
    object: "对象",
    row: "行",
    field: "值",
    relation: "关系",
  };

  const CANONICAL_ANNOTATION_ROUTES = {
    "/knowledge/technical": "/knowledge/technical",
    "/knowledge/technical-modules": "/knowledge/technical",
    "/knowledge/technical-measures": "/knowledge/technical",
  };

  function canonicalAnnotationRoute(route) {
    const normalized = text(route).trim().replace(/[?#].*$/, "").replace(/\/+$/, "") || "/";
    return CANONICAL_ANNOTATION_ROUTES[normalized] || normalized;
  }

  function isSameAnnotationPageRoute(a, b) {
    return canonicalAnnotationRoute(a) === canonicalAnnotationRoute(b);
  }

  const drawerScrollMemory = new Map();
  let restoreScheduled = false;

  function drawerScrollKey(panel) {
    const drawer = panel?.closest?.("[data-annotation-drawer]");
    return text(drawer?.dataset?.annotationPageRoute || window.location.pathname || "current-page").trim() || "current-page";
  }

  function rememberDrawerScroll(panel) {
    if (!panel) return;
    drawerScrollMemory.set(drawerScrollKey(panel), panel.scrollTop || 0);
  }

  function restoreDrawerScroll() {
    restoreScheduled = false;
    const panel = document.querySelector(".user-annotation-drawer.is-open .annotation-drawer-panel");
    if (!panel) return;
    const remembered = drawerScrollMemory.get(drawerScrollKey(panel));
    if (Number.isFinite(remembered) && remembered > 0) panel.scrollTop = remembered;
  }

  function scheduleDrawerScrollRestore() {
    if (restoreScheduled) return;
    restoreScheduled = true;
    window.requestAnimationFrame(restoreDrawerScroll);
  }

  function installDrawerScrollMemory() {
    if (installDrawerScrollMemory.installed) return;
    installDrawerScrollMemory.installed = true;
    document.addEventListener(
      "scroll",
      (event) => {
        const panel = event.target?.closest?.(".annotation-drawer-panel");
        if (panel) rememberDrawerScroll(panel);
      },
      true,
    );
    document.addEventListener(
      "click",
      (event) => {
        const panel = event.target?.closest?.(".annotation-drawer-panel");
        if (panel) rememberDrawerScroll(panel);
        if (event.target?.closest?.("[data-annotation-drawer-toggle]")) scheduleDrawerScrollRestore();
      },
      true,
    );
    const observer = new MutationObserver((mutations) => {
      if (mutations.some((mutation) => Array.from(mutation.addedNodes || []).some((node) => node.nodeType === 1 && (node.matches?.("[data-annotation-drawer]") || node.querySelector?.("[data-annotation-drawer]"))))) {
        scheduleDrawerScrollRestore();
      }
    });
    const observeMount = () => {
      const mount = document.getElementById("userAnnotationMount");
      if (mount) observer.observe(mount, { childList: true, subtree: true });
    };
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", observeMount, { once: true });
    else observeMount();
  }

  installDrawerScrollMemory();

  function noteDate(value) {
    const raw = text(value);
    if (!raw) return "";
    return raw.replace("T", " ").replace("Z", "").slice(0, 16);
  }

  function renderNoteCard(note, { editingNoteId = "", editDraft = "", currentTargetRef = "", index = 0, expandedNoteIds = [] } = {}) {
    const status = text(note.status || "todo");
    const editing = text(note.id).trim() === text(editingNoteId).trim();
    const anchorType = text(note.anchor_type || "object");
    const anchorLabel = ANCHOR_LABELS[anchorType] || "对象";
    const noteTarget = text(note.object_title || note.object_type || note.page_title || "当前页面");
    const isCurrent = text(note.target_ref).trim() === text(currentTargetRef).trim();
    const noteNumber = index + 1;
    const expanded = editing || list(expandedNoteIds).map(text).includes(text(note.id).trim());
    return `
      <details class="annotation-note-card ${isCurrent ? "is-current-anchor" : ""}" data-user-note-id="${escape(note.id)}"${expanded ? " open" : ""}>
        <summary class="annotation-note-summary">
          <span class="annotation-status-pill status-${escape(status)}">${escape(STATUS_LABELS[status] || STATUS_LABELS.todo)}</span>
          <span class="annotation-note-number">#${escape(noteNumber)}</span>
          <span class="annotation-anchor-pill anchor-${escape(anchorType)}">${escape(anchorLabel)}</span>
          <strong title="${escape(noteTarget)}" data-annotation-tooltip="${escape(noteTarget)}">${escape(noteTarget)}</strong>
        </summary>
        <div class="annotation-note-body">
          <div class="annotation-note-meta">
            <time>${escape(noteDate(note.updated_at || note.created_at))}</time>
          </div>
          ${
            editing
              ? `<textarea class="annotation-note-edit" data-user-note-edit-draft="${escape(note.id)}" rows="4">${escape(editDraft || note.body || "")}</textarea>`
              : `<p>${escape(note.body || "暂无批注内容")}</p>`
          }
          <div class="annotation-note-footer">
            <select data-user-note-status="${escape(note.id)}" aria-label="修改批注状态">
              ${Object.entries(STATUS_LABELS)
                .map(([value, label]) => `<option value="${escape(value)}"${value === status ? " selected" : ""}>${escape(label)}</option>`)
                .join("")}
            </select>
            <span class="annotation-note-actions">
              <button type="button" data-user-note-jump="${escape(note.id)}">定位</button>
              ${
                editing
                  ? `
                    <button type="button" data-user-note-edit-save="${escape(note.id)}">保存</button>
                    <button type="button" data-user-note-edit-cancel>取消</button>
                  `
                  : `<button type="button" data-user-note-edit="${escape(note.id)}">编辑</button>`
              }
              <button type="button" data-user-note-delete="${escape(note.id)}">删除</button>
            </span>
          </div>
        </div>
      </details>
    `;
  }

  function renderNoteList(notes, emptyText, options = {}) {
    const rows = list(notes);
    if (!rows.length) return `<div class="annotation-empty">${escape(emptyText)}</div>`;
    return `<div class="annotation-note-list">${rows.map((row, index) => renderNoteCard(row, { ...options, index })).join("")}</div>`;
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

  function renderContextMenu(contextMenu) {
    if (!contextMenu?.target?.targetRef) return "";
    const viewportWidth = Number(window.innerWidth) || 1440;
    const viewportHeight = Number(window.innerHeight) || 900;
    const menuWidth = Math.min(240, Math.max(208, viewportWidth - 16));
    const menuHeight = 132;
    const x = Math.max(8, Math.min(Number(contextMenu.x) || 0, Math.max(8, viewportWidth - menuWidth - 8)));
    const y = Math.max(8, Math.min(Number(contextMenu.y) || 0, Math.max(8, viewportHeight - menuHeight - 8)));
    return `
      <div class="annotation-context-menu" data-annotation-context-menu style="left:${x}px;top:${y}px;">
        <span>${escape(contextMenu.target.objectLabel || "当前选择")}</span>
        <strong title="${escape(contextMenu.target.title || contextMenu.target.code || "")}" data-annotation-tooltip="${escape(contextMenu.target.title || contextMenu.target.code || "当前选择")}">${escape(contextMenu.target.title || contextMenu.target.code || "当前选择")}</strong>
        <button type="button" data-annotation-context-add>添加批注</button>
      </div>
    `;
  }

  function render({ open = false, target, pageTarget, notes = [], favorite, status = {}, draft = "", editingNoteId = "", editDraft = "", expandedNoteIds = [], pendingTargetLabel = "", contextMenu = null }) {
    const currentTarget = target || pageTarget;
    if (!currentTarget?.targetRef) return "";
    const loading = status.state === "loading";
    const unavailable = status.state === "api_unavailable" || status.state === "api_error";
    const saving = Boolean(status.savingNote);
    const pageRoute = text(pageTarget?.code || "").trim();
    const canonicalPageRoute = canonicalAnnotationRoute(pageRoute);
    const pageNotes = list(notes).filter((note) => isSameAnnotationPageRoute(note.page_route, pageRoute));
    const currentPageCount = pageNotes.length;
    const disabledAttr = loading || unavailable || saving ? " disabled" : "";
    const title = currentTarget.title || currentTarget.code || currentTarget.targetRef;
    const pageTitle = pageTarget?.title || pageTarget?.code || "当前页面";
    const anchorLabel = currentTarget.objectType === "page" ? "当前页面" : currentTarget.objectLabel || "当前对象";
    const draftGuard = Boolean(status.draftGuard);
    const tabLabel = currentPageCount ? `批注 ${currentPageCount}` : "批注";
    return `
      ${renderContextMenu(contextMenu)}
      <aside class="user-annotation-drawer ${open ? "is-open" : ""} ${unavailable ? "is-unavailable" : ""} ${currentPageCount ? "has-notes" : ""}" aria-label="批注工作台" data-annotation-drawer data-annotation-page-route="${escape(canonicalPageRoute)}">
        <button class="annotation-drawer-tab" type="button" data-annotation-drawer-toggle aria-expanded="${open ? "true" : "false"}">
          <span>${escape(tabLabel)}</span>
        </button>
        <section class="annotation-drawer-panel" aria-hidden="${open ? "false" : "true"}">
          <header class="annotation-drawer-header">
            <div>
              <span class="annotation-kicker">当前页 ${escape(currentPageCount)} 条</span>
              <h2>批注</h2>
            </div>
            <button type="button" class="annotation-drawer-close" data-annotation-drawer-close aria-label="收起批注面板">收起</button>
          </header>
          <div class="annotation-anchor-strip">
            <span>${escape(anchorLabel)}</span>
            <strong title="${escape(title)}" data-annotation-tooltip="${escape(title)}">${escape(title)}</strong>
            <small title="${escape(currentTarget.code || currentTarget.id || currentTarget.targetRef)}" data-annotation-tooltip="${escape(currentTarget.code || currentTarget.id || currentTarget.targetRef)}">${escape(currentTarget.code || currentTarget.id || currentTarget.targetRef)}</small>
          </div>
          ${
            draftGuard
              ? `
                <div class="annotation-draft-guard" role="alert">
                  <strong>当前批注尚未保存</strong>
                  <span>准备切换到：${escape(pendingTargetLabel || "新页面")}</span>
                  <div>
                    <button type="button" data-annotation-draft-save-switch${disabledAttr}>保存并切换</button>
                    <button type="button" data-annotation-draft-discard-switch${disabledAttr}>放弃并切换</button>
                    <button type="button" data-annotation-draft-cancel-switch>继续编辑</button>
                  </div>
                </div>
              `
              : ""
          }
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
            <h3>${escape(pageTitle)}批注</h3>
            ${renderNoteList(pageNotes, loading ? "正在读取批注..." : "当前页面暂无批注", { editingNoteId, editDraft, expandedNoteIds, currentTargetRef: currentTarget.targetRef })}
          </section>
        </section>
      </aside>
    `;
  }

  components.UserAnnotationDrawer = { render };
})();
