import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8");
}

const stylesCss = read("frontend/capability-browser/styles.css").replace(/\/\*[\s\S]*?\*\//g, "");
const appJs = read("frontend/capability-browser/app.js");
const dataClientJs = read("frontend/capability-browser/dataClient.js");
const indexHtml = read("frontend/capability-browser/index.html");
const workbenchPageHeightPattern = "calc\\(100dvh\\s*-\\s*var\\(--topbar-height\\)\\s*-\\s*var\\(--page-header-height\\)\\)";
const inspectorActionsRenderIndex = appJs.indexOf("${renderWorkbenchIssueInspectorActions()}");
const inspectorContentRenderIndex = appJs.indexOf('class="workbench-review-inspector-content" data-review-inspector-scroll');

function cssBlocksForSelector(source, selector) {
  const blocks = [];
  const pattern = /([^{}]+)\{([^{}]*)\}/g;
  let match;
  while ((match = pattern.exec(source))) {
    const selectorList = match[1]
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
    if (selectorList.includes(selector)) {
      blocks.push(match[2]);
    }
  }
  return blocks;
}

function blockHasDeclaration(block, property, valuePattern) {
  const pattern = new RegExp(`${property}\\s*:\\s*${valuePattern}\\s*(?:;|$)`);
  return pattern.test(block);
}

function anyBlock(selector, predicate) {
  return cssBlocksForSelector(stylesCss, selector).some(predicate);
}

function check(id, ok, message, detail = undefined) {
  return { id, ok: Boolean(ok), message, ...(detail ? { detail } : {}) };
}

const checks = [
  check(
    "sidebar_expanded_has_single_native_scroll_owner",
    anyBlock(
      ".app-shell-integrated:not(.sidebar-collapsed) .module-tabs.manifest-navigation",
      (block) =>
        blockHasDeclaration(block, "overflow-y", "auto") &&
        blockHasDeclaration(block, "overflow-x", "hidden") &&
        blockHasDeclaration(block, "scrollbar-gutter", "auto"),
    ) &&
      anyBlock(
        ".app-shell-integrated:not(.sidebar-collapsed) .secondary-navigation",
        (block) => blockHasDeclaration(block, "overflow", "visible") && blockHasDeclaration(block, "max-height", "none"),
      ),
    "expanded AppShell sidebar must scroll only on manifest-navigation; secondary-navigation must not create nested scroll.",
  ),
  check(
    "sidebar_expanded_has_no_custom_webkit_scrollbar",
    !stylesCss.includes(".app-shell-integrated:not(.sidebar-collapsed) .module-tabs.manifest-navigation::-webkit-scrollbar"),
    "expanded AppShell sidebar must not use a custom WebKit scrollbar that can add repaint or scroll-jank risk.",
  ),
  check(
    "global_search_workspace_is_single_scroll_owner",
    anyBlock(
      ".global-search-page-workspace",
      (block) =>
        blockHasDeclaration(block, "overflow-x", "hidden") &&
        blockHasDeclaration(block, "overflow-y", "auto") &&
        blockHasDeclaration(block, "overscroll-behavior-y", "contain"),
    ) &&
      anyBlock(
        ".app-shell-integrated .global-search-page-workspace",
        (block) =>
          blockHasDeclaration(block, "overflow-x", "hidden") &&
          blockHasDeclaration(block, "overflow-y", "auto") &&
          blockHasDeclaration(block, "overscroll-behavior-y", "contain"),
      ),
    "global search result page must have exactly one vertical page scroll owner in the locked AppShell.",
  ),
  check(
    "global_search_results_do_not_create_nested_vertical_scroll",
    anyBlock(
      ".global-search-page",
      (block) => blockHasDeclaration(block, "height", "auto") && blockHasDeclaration(block, "min-height", "100%"),
    ) &&
      anyBlock(".global-search-page-layout", (block) => blockHasDeclaration(block, "height", "auto")) &&
      anyBlock(".global-search-page-results", (block) => blockHasDeclaration(block, "grid-template-rows", "auto auto auto")) &&
      anyBlock(".global-search-page-list", (block) => blockHasDeclaration(block, "overflow", "visible")),
    "global search results must expand in the page scroll; the result list must not be a second vertical scroll container.",
  ),
  check(
    "workbench_issue_route_has_stable_class",
    appJs.includes('class="workbench-route-page workbench-issues-route" aria-label="Issue 清单"'),
    "Issue list route must expose a stable class so scroll ownership can be scoped to this route only.",
  ),
  check(
    "workbench_workspace_has_definite_height_for_split_panes",
    anyBlock(
      ".app-shell-integrated .workbench-workspace",
      (block) =>
        blockHasDeclaration(block, "height", workbenchPageHeightPattern) &&
        blockHasDeclaration(block, "max-height", workbenchPageHeightPattern) &&
        blockHasDeclaration(block, "box-sizing", "border-box"),
    ),
    "Workbench workspace must provide a definite height reference before issue split panes can own local scrolling.",
  ),
  check(
    "workbench_issue_outer_workspace_only_scrolls_horizontally",
    anyBlock(
      ".app-shell-integrated .workbench-workspace:has(.workbench-issues-route)",
      (block) =>
        blockHasDeclaration(block, "height", workbenchPageHeightPattern) &&
        blockHasDeclaration(block, "max-height", workbenchPageHeightPattern) &&
        blockHasDeclaration(block, "overflow-x", "auto") &&
        blockHasDeclaration(block, "overflow-y", "hidden"),
    ),
    "Issue list workspace must not compete vertically with the three review panes; it may keep horizontal overflow for narrow screens.",
  ),
  check(
    "workbench_issue_layout_fills_available_height",
    anyBlock(
      ".workbench-issues-route",
      (block) =>
        blockHasDeclaration(block, "height", "100%") &&
        blockHasDeclaration(block, "max-height", "100%") &&
        blockHasDeclaration(block, "min-height", "0") &&
        blockHasDeclaration(block, "box-sizing", "border-box") &&
        blockHasDeclaration(block, "grid-template-rows", "auto auto minmax\\(0, 1fr\\)"),
    ) &&
      anyBlock(
        ".workbench-issues-route .workbench-prototype-annotation-layout",
        (block) =>
          blockHasDeclaration(block, "height", "100%") &&
          blockHasDeclaration(block, "min-height", "0") &&
          blockHasDeclaration(block, "max-height", "none") &&
          blockHasDeclaration(block, "align-self", "stretch") &&
          blockHasDeclaration(block, "box-sizing", "border-box"),
      ),
    "Issue list must size the three-column queue to the available AppShell height instead of using viewport magic numbers.",
  ),
  check(
    "workbench_issue_split_panes_have_stable_scroll_owners",
    anyBlock(
      ".workbench-review-scope",
      (block) =>
        blockHasDeclaration(block, "overflow", "auto") &&
        blockHasDeclaration(block, "height", "100%") &&
        blockHasDeclaration(block, "overflow-y", "auto") &&
        blockHasDeclaration(block, "max-height", "100%") &&
        blockHasDeclaration(block, "scrollbar-gutter", "stable"),
    ) &&
      anyBlock(".workbench-review-scope", (block) => blockHasDeclaration(block, "overflow-x", "hidden")) &&
      anyBlock(
        ".workbench-review-queue",
        (block) =>
          blockHasDeclaration(block, "overflow", "auto") &&
          blockHasDeclaration(block, "height", "100%") &&
          blockHasDeclaration(block, "overflow-x", "auto") &&
          blockHasDeclaration(block, "overflow-y", "auto") &&
          blockHasDeclaration(block, "max-height", "100%") &&
          blockHasDeclaration(block, "scrollbar-gutter", "stable"),
      ) &&
      anyBlock(
        ".workbench-review-inspector",
        (block) =>
          blockHasDeclaration(block, "height", "100%") &&
          blockHasDeclaration(block, "max-height", "100%"),
      ) &&
      anyBlock(
        ".workbench-review-inspector",
        (block) =>
          blockHasDeclaration(block, "grid-template-rows", "auto\\s+auto\\s+auto\\s+minmax\\(0,\\s*1fr\\)") &&
          blockHasDeclaration(block, "overflow", "hidden"),
      ) &&
      anyBlock(
        ".workbench-review-inspector-content",
        (block) =>
          blockHasDeclaration(block, "min-height", "0") &&
          blockHasDeclaration(block, "overflow", "auto") &&
          blockHasDeclaration(block, "overflow-x", "hidden") &&
          blockHasDeclaration(block, "overflow-y", "auto") &&
          blockHasDeclaration(block, "scrollbar-gutter", "stable"),
      ),
    "Issue list scope and queue own their pane scroll; the inspector keeps actions above a dedicated content scroll body.",
  ),
  check(
    "workbench_issue_queue_horizontal_scroll_and_resizable_panes",
    anyBlock(
      ".workbench-issues-route .workbench-prototype-annotation-layout",
      (block) => blockHasDeclaration(block, "grid-template-columns", "260px\\s+6px\\s+minmax\\(720px,\\s*1fr\\)\\s+6px\\s+380px"),
    ) &&
      anyBlock(".workbench-review-scope", (block) => blockHasDeclaration(block, "overflow-x", "hidden")) &&
      anyBlock(".workbench-review-inspector", (block) => blockHasDeclaration(block, "overflow-x", "hidden")) &&
      anyBlock(".workbench-review-queue-head", (block) => blockHasDeclaration(block, "min-width", "760px")) &&
      anyBlock(".workbench-review-item", (block) => blockHasDeclaration(block, "min-width", "760px")) &&
      appJs.includes('class="workspace-resizer workbench-issue-pane-resizer" data-workspace-resize-index="0"') &&
      appJs.includes('class="workspace-resizer workbench-issue-pane-resizer" data-workspace-resize-index="1"') &&
      appJs.includes('pane.classList.contains("workbench-review-queue") ? 520') &&
      appJs.includes("beginWorkspaceResize(event, handle)"),
    "Issue queue must keep its own horizontal scroll and expose drag handles between the three workbench panes.",
  ),
  check(
    "workbench_issue_actions_are_top_toolbar_outside_scroll_body",
    anyBlock(
      ".workbench-review-inspector-actions",
      (block) =>
        blockHasDeclaration(block, "position", "relative") &&
        blockHasDeclaration(block, "z-index", "1") &&
        blockHasDeclaration(block, "border-bottom", "1px\\s+solid\\s+rgba\\(136,\\s*157,\\s*181,\\s*0\\.16\\)"),
    ) &&
      inspectorActionsRenderIndex >= 0 &&
      inspectorContentRenderIndex >= 0 &&
      inspectorActionsRenderIndex < inspectorContentRenderIndex &&
      appJs.includes('class="workbench-review-inspector-content" data-review-inspector-scroll') &&
      appJs.includes("function renderWorkbenchIssueDetailActions()") &&
      appJs.includes("function renderWorkbenchIssueBatchActions()") &&
      appJs.includes("function renderWorkbenchIssueInspectorActions()") &&
      appJs.includes('event.target.closest("[data-review-delete]")') &&
      appJs.includes("handleWorkbenchIssueDelete()") &&
      appJs.includes('event.target.closest("[data-review-save]")') &&
      appJs.includes("saveWorkbenchReviewInspector()") &&
      appJs.includes("handleWorkbenchIssueBulkStatus"),
    "Issue inspector action buttons must be rendered as a top toolbar before the scroll body and keep their delegated event handlers.",
  ),
  check(
    "workbench_issue_panes_use_visible_scrollbars",
    stylesCss.includes(".workbench-review-scope::-webkit-scrollbar") &&
      stylesCss.includes(".workbench-review-queue::-webkit-scrollbar") &&
      stylesCss.includes(".workbench-review-inspector-content::-webkit-scrollbar") &&
      stylesCss.includes(".workbench-review-inspector-content::-webkit-scrollbar-thumb") &&
      stylesCss.includes(".workbench-review-scope.has-scroll-overflow") &&
      stylesCss.includes(".workbench-review-queue.has-scroll-overflow") &&
      stylesCss.includes(".workbench-review-inspector.has-scroll-overflow") &&
      stylesCss.includes("overscroll-behavior: contain") &&
      appJs.includes("function updateWorkbenchPaneScrollAffordance()") &&
      appJs.includes('pane.querySelector("[data-review-inspector-scroll]")') &&
      appJs.includes("requestAnimationFrame(updateWorkbenchPaneScrollAffordance)"),
    "Issue list split panes should expose visible local scrollbars in the macOS desktop wrapper.",
  ),
  check(
    "workbench_issue_queue_has_sortable_columns_and_select_all",
    appJs.includes("const WORKBENCH_ISSUE_SORT_COLUMNS") &&
      appJs.includes("function setWorkbenchIssueSort") &&
      appJs.includes("data-review-sort-key") &&
      appJs.includes("data-review-select-all") &&
      stylesCss.includes(".workbench-review-sort-button") &&
      stylesCss.includes(".workbench-review-select-all"),
    "Issue queue table must support visible column sorting and select-all selection from the header.",
  ),
  check(
    "workbench_issue_rows_do_not_auto_select_first_item",
    !appJs.includes('state.workbenchSelectedIssueId = filteredRows[0]?.id || ""') &&
      !appJs.includes("selected: state.workbenchSelectedIssueId ? issue.id === state.workbenchSelectedIssueId : index === 0") &&
      appJs.includes("selected: Boolean(state.workbenchSelectedIssueId)"),
    "Issue queue must not use the first row as the implicit current issue; the current issue must come from explicit user selection.",
  ),
  check(
    "workbench_issue_row_click_selects_queue_row",
    appJs.includes("selectWorkbenchReviewItem(reviewItem)") &&
      appJs.includes('!event.target.closest("input, select, textarea, button")') &&
      appJs.includes("state.workbenchSelectedIssueIds.add(noteId)") &&
      appJs.includes("state.workbenchSelectedIssueId = noteId"),
    "Clicking an Issue queue row must select that row and open its current issue, not require the checkbox as the only selection target.",
  ),
  check(
    "workbench_issue_bulk_actions_match_review_queue_contract",
    appJs.includes('data-review-bulk-status="closed">全部关闭') &&
      appJs.includes('data-review-bulk-status="reviewing">改为处理中') &&
      appJs.includes('data-review-bulk-status="deferred">全部忽略') &&
      appJs.includes('data-review-bulk-status="confirmed">标记已采纳') &&
      appJs.includes("data-review-clear-selection>清除选择") &&
      !appJs.includes('data-review-bulk-status="deferred">忽略</button>') &&
      !appJs.includes('<button class="workbench-prototype-action" type="button" data-review-export-selected>导出所选</button>'),
    "Bulk action bar must expose the review workflow actions only: close all, reviewing, ignore all, accepted, and clear selection.",
  ),
  check(
    "workbench_issue_batch_actions_are_static_grid_not_overlay",
    anyBlock(
      ".workbench-review-inspector-actions.is-batch",
      (block) =>
        blockHasDeclaration(block, "position", "static") &&
        blockHasDeclaration(block, "display", "grid") &&
        blockHasDeclaration(block, "grid-template-columns", "repeat\\(2,\\s*minmax\\(0,\\s*1fr\\)\\)") &&
        blockHasDeclaration(block, "align-self", "stretch"),
    ) &&
      anyBlock(
        ".workbench-review-inspector-actions.is-batch .workbench-prototype-action",
        (block) => blockHasDeclaration(block, "width", "100%"),
      ) &&
      anyBlock(
        ".workbench-review-inspector-actions.is-batch [data-review-clear-selection]",
        (block) => blockHasDeclaration(block, "grid-column", "1\\s*/\\s*-1"),
      ),
    "Batch inspector actions must be a stable in-panel grid so wrapped buttons do not sticky-overlay selected Issue summaries.",
  ),
  check(
    "workbench_issue_inspector_has_empty_single_and_batch_states",
    appJs.includes("function renderWorkbenchIssueEmptyInspector") &&
      appJs.includes("function renderWorkbenchIssueDetailInspector") &&
      appJs.includes("function renderWorkbenchIssueBatchInspector") &&
      appJs.includes("selectedRows.length > 1") &&
      stylesCss.includes(".workbench-review-batch-panel") &&
      stylesCss.includes(".workbench-review-empty.is-blank"),
    "Issue inspector must distinguish no current issue, one current issue, and multiple selected issues.",
  ),
  check(
    "workbench_issue_inspector_field_boundary",
    appJs.includes("<label>关联页面/对象</label>") &&
      appJs.includes("workbenchIssuePageObjectLabel") &&
      appJs.includes('{ label: "Issue 范围", value: activePageLabel }') &&
      !appJs.includes('{ label: "页面", value: activePageLabel }') &&
      !appJs.includes("<label>关联页面</label>") &&
      !appJs.includes("<label>关联对象</label>") &&
      !appJs.includes("<label>锚点 / 类型</label>") &&
      appJs.includes('<select class="workbench-review-select" data-review-field="priority"'),
    "Issue inspector must combine related page/object, hide anchor/type in the main display, and provide a priority control.",
  ),
  check(
    "workbench_issue_priority_order_matches_review_workflow",
    appJs.includes('const WORKBENCH_ISSUE_PRIORITY_VALUES = ["未标注", "低", "中", "高"];') &&
      appJs.includes('"未标注": 10') &&
      appJs.includes('"低": 20') &&
      appJs.includes('"中": 30') &&
      appJs.includes('"高": 40') &&
      appJs.includes('if (tags.includes("中优先级")) return "中";') &&
      appJs.includes('if (normalizedPriority === "中") nextTags.push("中优先级");') &&
      appJs.includes("...WORKBENCH_ISSUE_PRIORITY_VALUES.map((value) => [value, value])"),
    "Issue priority controls must use the business order 未标注 -> 低 -> 中 -> 高 and persist medium priority through tags.",
  ),
  check(
    "workbench_issue_cancel_restores_saved_issue_state",
    appJs.includes("function cancelWorkbenchReviewInspector()") &&
      appJs.includes('const wasDirty = inspector?.dataset?.dirty === "true";') &&
      appJs.includes("renderWorkbench();") &&
      appJs.includes('setWorkbenchReviewWarning(wasDirty ? "已恢复为上次保存内容。" : "当前 Issue 没有未保存修改。", true);') &&
      appJs.includes("setWorkbenchReviewDirty(false);") &&
      appJs.includes("cancelWorkbenchReviewInspector();"),
    "Issue cancel must explicitly discard local inspector edits, restore the saved state, and show visible feedback instead of acting as a no-op.",
  ),
  check(
    "workbench_issue_delete_uses_app_confirm_not_browser_confirm",
    !appJs.includes("window.confirm") &&
      appJs.includes("function renderWorkbenchIssueDeleteDialog") &&
      appJs.includes('role="dialog"') &&
      appJs.includes("data-review-delete-backdrop") &&
      appJs.includes("data-review-delete-confirm") &&
      appJs.includes("confirmWorkbenchIssueDelete") &&
      stylesCss.includes(".workbench-review-dialog-backdrop") &&
      stylesCss.includes(".workbench-review-dialog"),
    "Issue delete confirmation must use the app's own modal dialog instead of the browser/native confirm frame or an inline inspector block.",
  ),
  check(
    "workbench_issue_priority_is_saved_via_tags_without_schema_change",
    appJs.includes("function workbenchIssueTagsWithPriority") &&
      dataClientJs.includes('body.status = text(payload.status).trim()') &&
      dataClientJs.includes('body.tags = list(payload.tags)') &&
      appJs.includes("dataClient.updateUserNote(noteId, { body, status: statusValue, tags })"),
    "Priority changes must use the existing tags update contract rather than adding frontend-only state or changing the user DB schema.",
  ),
  check(
    "standard_table_scroll_is_preserved",
    anyBlock(".standard-framework-table-scroll", (block) => block.includes("overflow: auto")),
    "standard/framework large data table scroll must remain available.",
  ),
  check(
    "annotation_drawer_scroll_is_preserved",
    anyBlock(".annotation-drawer-scroll", (block) => blockHasDeclaration(block, "overflow-y", "auto")),
    "annotation drawer must retain its own vertical scroll.",
  ),
  check(
    "environment_canvas_scroll_is_preserved",
    anyBlock(".environment-object-graph", (block) => block.includes("overflow: auto")) &&
      anyBlock(".environment-object-funnel-viewport", (block) => block.includes("overflow: auto")),
    "environment graph/canvas workspaces may keep intentional local pan/scroll containers.",
  ),
  check(
    "lifecycle_stage_tabs_fit_without_horizontal_scroll",
    anyBlock(
      ".dev-lifecycle-workspace .lifecycle-stage-tabs",
      (block) =>
        blockHasDeclaration(block, "overflow-x", "hidden(?:\\s*!important)?") &&
        blockHasDeclaration(block, "overflow-y", "visible(?:\\s*!important)?") &&
        blockHasDeclaration(block, "scrollbar-gutter", "auto(?:\\s*!important)?"),
    ) &&
      anyBlock(
        ".dev-lifecycle-workspace .lifecycle-stage-tabs .lifecycle-nav-row",
        (block) =>
          blockHasDeclaration(block, "flex", "1\\s+1\\s+0(?:\\s*!important)?") &&
          blockHasDeclaration(block, "min-width", "0(?:\\s*!important)?") &&
          blockHasDeclaration(block, "max-width", "none(?:\\s*!important)?"),
      ),
    "LC-AP/LC-DT finite stage tabs must fit the toolbar without creating horizontal tab scroll.",
  ),
  check(
    "lifecycle_lane_is_single_vertical_scroll_owner",
    anyBlock(
      ".dev-lifecycle-workspace .lifecycle-lane",
      (block) => blockHasDeclaration(block, "overflow-x", "hidden") && blockHasDeclaration(block, "overflow-y", "auto"),
    ),
    "LC-AP/LC-DT stage content must keep lifecycle-lane as the single vertical scroll owner.",
  ),
  check(
    "lifecycle_record_scroll_does_not_create_nested_vertical_scroll",
    anyBlock(".dev-lifecycle-workspace .lifecycle-record-scroll", (block) => blockHasDeclaration(block, "overflow", "visible")),
    "LC-AP/LC-DT record wrapper must not create a second vertical scrollbar.",
  ),
  check(
    "lifecycle_table_scroll_is_horizontal_only",
    anyBlock(
      ".dev-lifecycle-workspace .lifecycle-table-scroll",
      (block) => blockHasDeclaration(block, "overflow-x", "auto") && blockHasDeclaration(block, "overflow-y", "visible"),
    ),
    "LC-AP/LC-DT table wrappers may scroll horizontally but must not own vertical scrolling.",
  ),
  check(
    "lifecycle_data_technical_summary_does_not_create_nested_vertical_scroll",
    anyBlock(
      ".dev-lifecycle-workspace .data-lifecycle-technical-scroll",
      (block) =>
        blockHasDeclaration(block, "max-height", "none") &&
        blockHasDeclaration(block, "overflow-x", "auto") &&
        blockHasDeclaration(block, "overflow-y", "visible"),
    ),
    "LC-DT technical summary table must not inherit semantic-scroll vertical limits.",
  ),
  check(
    "cache_versions_include_scroll_contract",
    indexHtml.includes("scroll-contract-20260703-1") &&
      indexHtml.includes("lifecycle-scroll-contract-20260705-1") &&
      indexHtml.includes("lifecycle-stage-tabs-fit-20260705-1") &&
      indexHtml.includes("issue-pane-scroll-20260707-2") &&
      indexHtml.includes("issue-inspector-actions-top-20260707-1") &&
      indexHtml.includes("issue-priority-cancel-20260707-1") &&
      indexHtml.includes("issue-queue-resize-20260707-1"),
    "index.html must cache-bust the scroll contract changes.",
  ),
];

const failed = checks.filter((item) => !item.ok);

console.log(
  JSON.stringify(
    {
      status: failed.length ? "fail" : "pass",
      checkCount: checks.length,
      failedCount: failed.length,
      failed,
    },
    null,
    2,
  ),
);

if (failed.length) {
  process.exit(1);
}
