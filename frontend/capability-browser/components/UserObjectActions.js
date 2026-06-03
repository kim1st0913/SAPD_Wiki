(function () {
  const components = (window.sapdComponents = window.sapdComponents || {});
  const utils = components.utils || {};

  function text(value) {
    if (utils.text) return utils.text(value);
    return value == null ? "" : String(value);
  }

  function escape(value) {
    if (utils.escapeHtml) return utils.escapeHtml(value);
    return text(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }

  function render({ target, favorite, status = {}, noteOpen = false }) {
    if (!target?.targetRef) return "";
    const isFavorite = Boolean(favorite);
    const isLoading = status.state === "loading";
    const isSaving = status.savingTargetRef === target.targetRef;
    const unavailable = status.state === "api_unavailable" || status.state === "api_error";
    const buttonLabel = isFavorite ? "移出关注清单" : "加入关注清单";
    const note = text(favorite?.note);
    const statusLabel = unavailable ? "用户库不可用" : isLoading ? "正在读取用户库" : isFavorite ? "已加入关注清单" : "未加入关注清单";
    const disabledAttr = isLoading || isSaving || unavailable ? " disabled" : "";
    const notePanel = noteOpen
      ? `
        <div class="user-action-note-panel">
          <textarea class="user-action-note-input" data-user-note-input="${escape(target.targetRef)}" rows="3" placeholder="记录这个收藏对象的复核结论、待补充点或个人判断">${escape(note)}</textarea>
          <div class="user-action-note-tools">
            <span>${escape(target.objectLabel || "当前对象")}</span>
            <button class="user-action-note-save" type="button" data-user-note-save="${escape(target.targetRef)}"${disabledAttr}>保存收藏备注</button>
          </div>
        </div>
      `
      : "";
    return `
      <section class="user-object-actions ${isFavorite ? "is-favorite" : ""} ${unavailable ? "is-unavailable" : ""}" data-user-target="${escape(target.targetRef)}" aria-label="用户对象操作">
        <div class="user-action-status">
          <span class="user-action-dot" aria-hidden="true"></span>
          <strong>${escape(statusLabel)}</strong>
          <small>${escape(target.title || target.code || target.targetRef)}</small>
        </div>
        <div class="user-action-buttons">
          <button class="user-action-favorite" type="button" data-user-favorite-toggle="${escape(target.targetRef)}"${disabledAttr}>${escape(isSaving ? "保存中" : buttonLabel)}</button>
          <button class="user-action-note-toggle" type="button" data-user-note-toggle="${escape(target.targetRef)}"${disabledAttr}>收藏备注</button>
        </div>
        ${notePanel}
      </section>
    `;
  }

  components.UserObjectActions = { render };
})();
