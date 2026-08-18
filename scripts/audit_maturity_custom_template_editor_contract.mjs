import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const componentPath = path.join(root, "frontend/capability-browser/components/MaturityAssessmentWorkbench.js");
const stylesPath = path.join(root, "frontend/capability-browser/maturity-assessment-workbench.css");
const indexPath = path.join(root, "frontend/capability-browser/index.html");
const appPath = path.join(root, "frontend/capability-browser/app.js");
const maturityPath = path.join(root, "src/sapd_wiki/maturity.py");
const appShellPath = path.join(root, "frontend/capability-browser/components/AppShell.js");

const component = fs.readFileSync(componentPath, "utf8");
const styles = fs.readFileSync(stylesPath, "utf8");
const index = fs.readFileSync(indexPath, "utf8");
const app = fs.readFileSync(appPath, "utf8");
const maturity = fs.readFileSync(maturityPath, "utf8");
const appShell = fs.readFileSync(appShellPath, "utf8");
const issues = [];
let contractCount = 0;

function requireContract(condition, message) {
  contractCount += 1;
  if (!condition) issues.push(message);
}

function includesAll(source, tokens) {
  return tokens.every((token) => source.includes(token));
}

requireContract(
  includesAll(component, [
    'model.activeTab = isCustom ? "template" : "scoring"',
    "rememberProjectTab(model.activeTab, projectId)",
    'draft.templateType === "custom" ? "创建并进入评估模板" : "创建并进入评分执行"',
  ]),
  "新建自定义模板必须在路由挂载前记住评估模板页，固定模板才进入评分执行。",
);

requireContract(
  includesAll(component, [
    'data-maturity-action="manage-template-project"',
    ">编辑</button>",
    'data-maturity-action="open-source-project-template"',
    ">进入项目优化</button>",
    'data-maturity-action="copy-template-to-manager"',
    'title="创建副本">创建副本</button>',
    'const [primaryLabel, primaryTab] = projectPrimaryAction(project)',
  ]),
  "模板管理必须区分项目原件、模板管理原件和独立副本入口，项目列表按状态直达当前步骤。",
);

requireContract(
  includesAll(component, [
    "if (isCustom) return renderCustomTemplateEditor(detail)",
    "maturity-v47-template-shell-header",
    "maturity-v47-template-identity",
    "maturity-v47-template-actions",
    'data-maturity-action="export-template"',
    'data-maturity-action="trigger-template-import"',
    'data-maturity-action="validate-template"',
  ]),
  "自定义模板身份、文件交换、校验发布和脑图编辑必须合并在同一个模板工作台区域内。",
);

requireContract(
  includesAll(component, [
    "function templateMindmapLayout(detail, selected)",
    "function renderTemplateMindmap(detail, selected)",
    "function renderTemplateMindmapConnector(from, to, tone",
    "function renderTemplateNodeInspector(detail, selected)",
    "function renderTemplateContextMenu(detail)",
    "maturity-v41-mindmap-workbench",
    "data-template-mindmap-viewport",
    "maturity-v41-floating-panel is-inspector",
    'data-template-draggable="true"',
    "右键打开编辑菜单",
  ]) && !component.includes('data-maturity-action="toggle-template-outline" aria-pressed='),
  "自定义模板页必须使用带树枝连线的大脑图画布、悬浮属性和右键菜单，不再重复展示占画布的目录浮层。",
);

requireContract(
  includesAll(component, [
    'data-template-layout-mode="full-tree"',
    "function defaultCollapsedTemplateNodeKeys(detail)",
    "function allCollapsibleTemplateNodeKeys(detail)",
    "function setTemplateCollapsePreset(detail, preset)",
    "collapsedTemplateNodeKeys",
    'templateCollapseKey("L1", id)',
    'templateCollapseKey("L2", id)',
    'templateCollapseKey("FOCUS", id)',
    "const l0Layouts = []",
    "const l1Layouts = []",
    "const l2Layouts = []",
    "const focusLayouts = []",
    "rootExpanded",
    "expanded ? childRows.map",
    "l1Rows.filter((item) => !item.parentId || !l0Ids.has(item.parentId))",
    "capabilities.filter((item) => !l1Ids.has(item.categoryId))",
    "positionTemplateMindmapViewport(detail, rootSelection)",
    "默认收起到 L1",
    'data-maturity-action="collapse-all-template-nodes"',
    'data-maturity-action="expand-all-template-nodes"',
    '["collapse-all-template-nodes", "expand-all-template-nodes"].includes(action)',
    'setTemplateCollapsePreset(detail, shouldCollapse ? "L1" : "EXPANDED")',
    "{ fit: true }",
    'aria-label="全部收起到 L1"',
    ">全部收起</button>",
    ">全部展开</button>",
    "适配全图",
  ]),
  "脑图必须保留完整模型，但首次默认只展开到 L1；L1/L2/关注点按层渐进展开，选中目录深层节点时可恢复祖先路径。",
);

requireContract(
  includesAll(component, [
    "function moveTemplateNode(detail, sourceType, sourceId, targetType, targetId)",
    "function removeTemplateCapability(detail, capabilityId)",
    "function removeSelectedTemplateNode(detail)",
    "function removeServiceMapping(detail, mappingId)",
    "function updateTemplateServiceMappingRole(detail, mapping, role)",
    "normalizeTemplateSortOrders(template)",
    "expandTemplateAncestors(detail, source)",
    "全部下级随节点保留",
    "sourceMappingId",
    "serviceMappingIds",
    "focusIds",
  ]),
  "节点移动和删除必须同步能力、关注点、服务映射、评估点和排序交叉引用。",
);

requireContract(
  includesAll(component, [
    'root.addEventListener("contextmenu", handleTemplateContextMenu)',
    'data-template-draggable="true"',
    'root.addEventListener("mousedown", handleTemplateMouseDown)',
    'document.addEventListener("mousemove", move)',
    'document.addEventListener("mouseup", finish, { once: true })',
    "function renderTemplateDragGhost(state, clientX, clientY, dropTarget = null)",
    "function templateDropMagnetPoint(state, dropTarget, clientX, clientY)",
    "function animateTemplateNodeDrop(type, id)",
    "function templateDropTargetAt(detail, state, clientX, clientY)",
    "function markTemplateDropCandidates(detail, state)",
    "function scheduleTemplateDragFrame(detail, state)",
    "function scheduleTemplateAutoPan(detail, state)",
    "function cancelTemplateDragFrames(state)",
    "function refreshTemplateDropCandidateRects(state)",
    "移动节点及全部下级",
    "松开吸附到",
    "nearestDistance = 88",
    'document.addEventListener("selectstart", preventSelection)',
    "window.getSelection",
    "is-template-parent-drop-target",
    "is-template-drop-target",
  ]) && !component.includes(' draggable="true"') && !component.includes('root.addEventListener("dragstart"'),
  "可视化编辑器必须由单一 document 级鼠标生命周期完成拖拽和右键编辑，不能让浏览器原生 draggable 抢占鼠标事件。",
);

requireContract(
  includesAll(component, [
    "document.elementFromPoint(clientX, clientY)",
    "state.latestClientX = moveEvent.clientX",
    "state.latestClientY = moveEvent.clientY",
    "scheduleTemplateDragFrame(state.detail, state)",
    "templateDropTargetAt(active, state, upEvent.clientX, upEvent.clientY)",
    "cancelTemplateDragFrames(state);",
    "state.dropCandidateRects?.forEach(({ element: candidate, rect })",
    "shiftTemplateDropCandidateRects(state, nextDelta.x * screenScale, nextDelta.y * screenScale)",
    "Math.hypot(moveEvent.clientX - state.startX, moveEvent.clientY - state.startY) < 7",
    "function clearTemplateTextSelection()",
    "clearTemplateTextSelection();",
    "function handleTemplateSelectStart(event)",
    'root.addEventListener("selectstart", handleTemplateSelectStart)',
  ]) && !component.includes("panTemplateCanvasNearPointer(moveEvent.clientX")
    && !component.includes('model.root?.querySelectorAll(".is-template-drop-candidate").forEach((candidate) => {'),
  "拖拽必须合并到单一动画帧、缓存候选矩形，并在 mouseup 用最新真实坐标重新命中。",
);

requireContract(
  includesAll(component, [
    "state.cancelled = true",
    "window.cancelAnimationFrame(state.moveFrame)",
    "window.cancelAnimationFrame(state.autoPanFrame)",
    'window.removeEventListener("resize", invalidateGeometry)',
    'window.removeEventListener("scroll", invalidateGeometry, true)',
    "state.currentDropTarget === dropTarget",
    "state.ghostDropTarget !== dropTarget || state.ghostParentSnap !== parentSnap",
  ]),
  "Escape、取消、卸载和 mouseup 必须停止拖动及自动平移帧，且目标未变化时不得重复切换样式与提示。",
);

requireContract(
  includesAll(component, [
    "function handleTemplateMindmapPointerDown(event)",
    "function handleTemplateMindmapPointerMove(event)",
    "function handleTemplateMindmapPointerUp(event)",
    "function applyTemplateMindmapTransform(viewport)",
    "function zoomTemplateMindmapAt(viewport, nextZoom, clientX, clientY)",
    "function handleTemplateMindmapWheel(event)",
    "function handleTemplateGestureStart(event)",
    "function handleTemplateGestureChange(event)",
    "function handleTemplateGestureEnd(event)",
    "function bindTemplateMindmapInputSurface(root = model.root)",
    'root.addEventListener("pointermove", handleTemplateMindmapPointerMove)',
    'viewport.addEventListener("wheel", handleTemplateMindmapWheel, { passive: false })',
    'viewport.addEventListener("gesturestart", handleTemplateGestureStart, { passive: false })',
    'viewport.addEventListener("gesturechange", handleTemplateGestureChange, { passive: false })',
    'viewport.addEventListener("gestureend", handleTemplateGestureEnd, { passive: false })',
    "event.ctrlKey || event.metaKey",
    "空白处拖动 / 双指平移 / 捏合缩放",
    "templateMindmapPanX",
    "templateMindmapPanY",
    "templateMindmapZoom",
    'data-maturity-action="zoom-template-mindmap"',
    'data-maturity-action="center-template-mindmap"',
  ]) && !component.includes('root.addEventListener("wheel", handleTemplateMindmapWheel'),
  "脑图工作台必须支持空白处平移、缩放、适配和状态保持。",
);

requireContract(
  includesAll(component, [
    "function maturityAdaptiveScale()",
    "function maturityLogicalPoint(clientX, clientY, origin",
    "function maturityLogicalRectSize(rect",
    "function maturityContextMenuPosition(clientX, clientY",
    "function fitMaturityContextMenuToViewport(menu",
    "function maturityLogicalWheelDelta(delta, deltaMode, viewport",
    "function closestTemplateContextTarget(event, selector)",
    "document.elementFromPoint(event.clientX, event.clientY)",
    "maturityLogicalRectSize(rect, adaptiveScale)",
    "maturityContextMenuPosition(event.clientX, event.clientY",
    'fitMaturityContextMenuToViewport(model.root?.querySelector(".maturity-v40-context-menu:not(.maturity-v41-canvas-context-menu)"))',
    'fitMaturityContextMenuToViewport(model.root?.querySelector(".maturity-v41-canvas-context-menu"))',
    "maturityLogicalWheelDelta(event.deltaX, event.deltaMode, viewport, adaptiveScale)",
    "(event.clientX - state.startX) / state.adaptiveScale",
  ]),
  "成熟度脑图必须只在视口坐标进入组件逻辑坐标和图谱模型时应用自适应缩放。",
);

requireContract(
  includesAll(component, [
    'data-maturity-action="edit-template-node">编辑属性</button>',
    'data-maturity-action="add-template-child">新增下级</button>',
    'data-maturity-action="add-template-sibling">新增同级</button>',
    'data-maturity-action="copy-template-subtree"',
    'data-maturity-action="move-template-node" data-direction="-1">上移</button>',
    'data-maturity-action="move-template-node" data-direction="1">下移</button>',
    'data-maturity-action="remove-template-node"',
    '${expanded ? "收起" : "展开"}全部下级（${childCount}）',
    'data-maturity-action="start-add-loose-node">新增自由节点</button>',
  ])
    && !component.includes("编辑属性<span>↵</span>")
    && !component.includes("<span>＋</span>")
    && !component.includes("<span>⇥</span>")
    && !component.includes("<span>⌘D</span>")
    && !component.includes("<span>⌃</span>")
    && !component.includes("<span>⌄</span>")
    && !component.includes("<span>⌫</span>"),
  "右键菜单必须保留完整文字业务动作和下级数量，同时移除右栏快捷键与装饰符号。",
);

requireContract(
  includesAll(component, [
    "let localStoreFailure = null",
    "function localStoreFailureSnapshot()",
    "function localStoreFailureMessage(subject",
    'kind: "read_unavailable"',
    'kind: "read_invalid_json"',
    'kind: "read_invalid_structure"',
    'kind: "serialize_failed"',
    '"quota_exceeded"',
    '"write_dom_exception"',
    '"write_unknown"',
    "byteSize",
    "为保护现有数据，本次未写入",
  ]),
  "本地成熟度存储必须保留中性失败分类和安全提示，不得把所有失败误报为容量问题。",
);

requireContract(
  includesAll(app, [
    "function bindSpecializedWheelSurfaces(root = document)",
    'viewport.addEventListener("wheel", handleEnvironmentBasemapWheel, { passive: false })',
    'viewport.addEventListener("wheel", handleModelingPosterLightboxWheel, { passive: false })',
    'bindSpecializedWheelSurfaces($("environmentDetail"))',
    'bindSpecializedWheelSurfaces($("contentDetail"))',
  ]) && !app.includes('document.addEventListener("wheel"'),
  "画布和海报的非被动滚轮监听必须局部绑定，不能阻塞成熟度列表的合成器滚动。",
);

requireContract(
  includesAll(component, [
    "const baseTemplate = clone(libraryTemplate || model.workspace.template)",
    "sourceTemplateId: libraryTemplate?.id || baseTemplate.id",
    "looseNodes: clone(list(baseTemplate.looseNodes))",
    "默认来源：基础模板",
  ]),
  "新建自定义模板必须默认深拷贝基础模板，并在模板属性中保留可审阅的来源信息。",
);

requireContract(
  includesAll(component, [
    "function customGenericRubricReference()",
    "model.workspace?.customGenericRubric",
    "function customGenericRubricEntries(scoreItemId)",
    'sourceType: "CUSTOM_GENERIC_FALLBACK"',
    "sourceVersion: reference.version",
    "bindScoreItemToCurrentGenericRubric({ id: itemId",
  ]) && !component.includes("function inheritedRubricEntries(")
    && !component.includes("renderCustomGenericRubricSummary")
    && !component.includes("通用成熟度定义（L1—L5）"),
  "新增评估点必须使用显式通用 Rubric，且通用评分兜底规则不得作为普通模板节点属性展示。",
);

requireContract(
  includesAll(maturity, [
    'CUSTOM_GENERIC_RUBRIC_VERSION = "sapd-maturity-custom-generic-rubric-v3-2026-07-30"',
    "CUSTOM_GENERIC_LEVEL_DESCRIPTIONS = {",
    "CUSTOM_GENERIC_DIMENSION_RUBRIC = (",
    "def _custom_generic_rubric_entries_for_item(item_id: str)",
    "def _custom_generic_rubric_reference()",
    '"customGenericRubric": _custom_generic_rubric_reference()',
    '"sourceType": "CUSTOM_GENERIC_FALLBACK"',
    '"rubricEntries": _custom_generic_rubric_entries_for_item(item_id)',
    '"rubricVersion": CUSTOM_GENERIC_RUBRIC_VERSION',
    '"levelDescriptions": [',
  ]),
  "自定义 XLSX 导入和评分交换导出必须与前端使用同一通用 Rubric 版本及五级描述。",
);

requireContract(
  includesAll(component, [
    "function templateStructureIsUninitialized(template)",
    "function hydrateProjectTemplate(project, candidateTemplate, baseTemplate)",
    "function alignRepairedTemplateEntries(entries, template)",
    'project?.templateType === "custom"',
    "默认带出当前基础模板形成的项目专属自定义模板。",
    "project.templateSnapshotId = resolvedTemplate.template.snapshotId",
    'detail?.project?.templateType === "custom" && detail.project.status === "template_configuring"',
    "model.activeTab = rememberedProjectTab(model.route)",
  ]),
  "既有但尚未初始化结构的自定义项目必须在运行时带出当前基础模板并直达模板页，按基础评估点补齐空白评分记录；已有有效自定义结构不得被覆盖。",
);

requireContract(
  includesAll(component, [
    "function copyTemplateSubtree(detail, record = selectedTemplateNode(detail))",
    '"copy-template-subtree"',
    "复制节点及全部下级",
    "categoryMap",
    "capabilityMap",
    "focusMap",
    "mappingMap",
    "serviceMap",
    "scoreMap",
    "createBlankEntries({ scoreItems: newScoreItems })",
    "store.templateLibrary.push",
  ]),
  "模板根与各级节点必须支持右键复制；子树复制需重建全部下级引用，并为复制的评估点创建空白评分条目。",
);

requireContract(
  includesAll(component, [
    "function renderTemplateCanvasContextMenu()",
    "function renderTemplateLooseComposer(detail)",
    "function createLooseTemplateNode(detail)",
    "function materializeLooseTemplateNode(detail, source, targetType, targetId)",
    "function templateDropIsValid(detail, sourceType, sourceId, targetType, targetId)",
    '"start-add-loose-node"',
    '"create-loose-node"',
    'data-template-loose-field="nodeType"',
    "拖到任意合法层级吸附",
  ]),
  "空白画布必须能创建可编辑类型的自由节点，并且只有合法父级显示吸附态、松手后才写入模板树。",
);

requireContract(
  includesAll(component, [
    "function renderTemplateCollapseButton(type, id",
    '"toggle-template-node-collapse"',
    'aria-expanded="${expanded ? "true" : "false"}"',
    "templateNodeIsCollapsed",
    "setTemplateNodeCollapsed",
    "visibleMappings = expanded ? mappings : []",
  ]),
  "所有存在下级的模板、能力和关注点节点必须常驻显示收起/展开按钮，关注点服务分支使用同一折叠模型。",
);

requireContract(
  includesAll(component, [
    "function renderTemplateInlineNode()",
    "function renderTemplateInlineCreateInspector(detail, inline)",
    "function beginTemplateInlineCreate(detail, parentType, parentId, nodeType)",
    "function commitTemplateInlineCreate(detail)",
    'data-maturity-action="begin-template-inline-child"',
    "maturityTemplateInlineName",
    "maturityTemplateInlineCode",
    "maturityTemplateInlineScope",
    "确认前仅作为画布草稿",
    "确认新增",
    'data-maturity-action="commit-template-inline-create"',
    'aria-label="确定新增节点"',
  ]) && !component.includes("renderTemplateQuickAddButton") && !styles.includes(".maturity-v42-node-quick-add"),
  "新增入口必须从节点边缘加号移入右键菜单；右键新增仍在画布内生成带临时连线的行内节点，并支持点击确定或 Enter 保存。",
);

requireContract(
  includesAll(component, [
    "function commitTemplateInlineCreate(detail)",
    "model.templateInlineCreate = null",
    "model.templateInspectorOpen = false",
    "model.templateInspectorSaveMessage = \"\"",
  ]),
  "新增节点确认成功后必须关闭属性编辑栏，只在画布保留已创建节点。",
);

requireContract(
  includesAll(component, [
    "function collapsedTemplateNodeKeySet()",
    "function ensureTemplateDerivedCaches(detail)",
    "templateMindmapLayoutCache",
    "const mappingsByFocus = groupBy",
    "const scoreItemCountByFocus",
    "function updateTemplateSelectionUi(detail, selected)",
  ]),
  "模板脑图必须复用折叠集合、派生状态与布局索引；普通节点选择只局部更新，不得重建完整画布。",
);

requireContract(
  includesAll(component, [
    "function scheduleHydratedWorkspaceRefresh(workspace)",
    "scheduleHydratedWorkspaceRefresh(workspace)",
    '!detail.project.templateWorkspace',
    'detail.project.status !== "template_configuring"',
    "Background refresh must never block or replace the already usable workspace.",
  ]) && !component.includes("await refreshHydratedAssessments();\n        await restorePersistedReports();\n        model.loaded = true"),
  "成熟度工作台刷新必须先展示已加载工作区，再在空闲时刷新必要评估与报告，模板配置页不得阻塞首屏。",
);

requireContract(
  includesAll(component, [
    "function updateProjectObjectSearchUi(detail, sourceInput = null)",
    "renderProjectObjectSearchResultList(rows, activeIndex, query)",
    "function normalizeProjectObjectSearchValue(value)",
    "item.description, item.definition",
    "byTemplateOrder(active.focusServiceMappings)",
    "scoreItemsByFocusService",
    "const baseTemplate = model.workspace?.template || {}",
    "const inheritedRecordSearchText",
    "directSearchText",
    "queryTerms.every((term) => item.directSearchText.includes(term))",
    ".slice(0, 80)",
    "if (!event.isComposing) updateProjectObjectSearchUi(activeDetail(), event.target)",
    "if (event.isComposing || event.keyCode === 229) return",
    "function handleCompositionEnd(event)",
    'root.addEventListener("compositionend", handleCompositionEnd)',
    "updateProjectObjectSearchUi(detail, event.target)",
  ]),
  "模板局部搜索必须覆盖名称、编号、定义、评估点、服务作用域和每条服务映射，保留原输入节点并正确处理中文输入法完成态。",
);

requireContract(
  includesAll(component, [
    "function templateSiblingParent(detail, record)",
    'data-maturity-action="add-template-sibling"',
    "新增同级",
    'data-template-child-type="L0"',
    'data-template-child-type="L1"',
  ]),
  "模板根和各级节点右键菜单必须覆盖新增 L0、根级 L1、下级和同级节点。",
);

requireContract(
  includesAll(component, [
    "function templateChildIsValid(parentType, nodeType)",
    'parentType === "TEMPLATE" && ["L0", "L1"].includes(nodeType)',
    'parentType === "L0" && nodeType === "L1"',
    'parentType === "L1" && nodeType === "L2"',
    'parentType === "L2" && nodeType === "FOCUS"',
    'parentType === "FOCUS" && nodeType === "SERVICE"',
    "当前节点不允许新增该类型下级",
  ]),
  "快捷新增必须服从模板到能力、关注点和安全技术服务的有类型层级约束。",
);

requireContract(
  includesAll(component, [
    "function undoTemplateChange(detail)",
    "function redoTemplateChange(detail)",
    "templateUndoStack",
    "templateRedoStack",
    'data-maturity-action="undo-template-change"',
    'data-maturity-action="redo-template-change"',
    "撤销上一步模板编辑",
    "撤销上一步</button>",
    'shortcutKey === "z"',
    'shortcutKey === "d"',
  ]),
  "图谱编辑必须支持工具栏和键盘撤销/重做，并提供选中子树复制快捷键。",
);

requireContract(
  includesAll(component, [
    "TEMPLATE_ELEMENT_ORIGINS",
    "标准元素",
    "标准修改元素",
    "模板自建元素",
    "function templateNodeHasChangedStructure",
    "function templateElementOrigin",
    "originalParentId: mapping.originalParentId || focusId",
    "data-template-origin-label",
    "maturity-v48-origin-key is-standard",
    "maturity-v48-origin-key is-modified",
    "maturity-v48-origin-key is-custom",
  ]) && includesAll(styles, [
    ".maturity-v41-mindmap-node.is-origin-modified",
    ".maturity-v41-mindmap-node.is-origin-custom",
    ".maturity-v48-origin-status",
  ]),
  "画布节点必须区分标准元素、标准修改元素和模板自建元素；标准父级的下级增删改或移动也必须进入修改态。",
);

requireContract(
  includesAll(component, [
    '<div class="maturity-v41-mindmap-viewport',
    '<div class="maturity-v41-mindmap-toolbar">',
    "const toolbarInset",
    "const usableHeight",
  ]) && includesAll(styles, [
    ".maturity-v41-mindmap-toolbar {",
    "position: absolute",
    "top: 12px",
    "grid-template-rows: auto minmax(0, 1fr)",
    "height: clamp(780px, calc(100vh - 108px), 1040px)",
  ]),
  "脑图工具条必须悬浮在画布顶部，画布适配需要避让工具条并扩大可视区域。",
);

requireContract(
  includesAll(component, [
    "function requiredTemplateServiceRole(template, capabilityOrId)",
    "function requiredTemplateServiceRoleForFocus(template, focusOrId)",
    "function templateServiceRoleLabel(role)",
    "服务角色（系统判定）",
    "安全技术能力 T：服务作为独立评估点",
    "类治理/管理能力：服务仅作平台工具参考",
    'data-template-mapping-field="scopeCode"',
    "maturity-v49-readonly-role",
  ]) && !includesAll(component, [
    'data-template-mapping-field="serviceRole"',
  ]) && !component.includes("maturity-v40-inspector-add") && includesAll(styles, [
    ".maturity-v41-floating-panel .maturity-v40-inspector-content",
    "overflow-y: auto",
    ".maturity-v49-readonly-role",
  ]),
  "属性面板必须只维护当前节点属性；服务节点保留作用域并展示系统判定的只读角色，结构操作留在画布。",
);

requireContract(
  includesAll(component, [
    "function hydrateStandardTemplateDefinitions(template, baseTemplate)",
    '["categories", "capabilities", "focuses", "services"].forEach',
    'definitionField("data-template-category-field"',
    'definitionField("data-template-capability-field"',
    'definitionField("data-template-focus-field"',
    'definitionField("data-template-service-field"',
    'id="maturityTemplateInlineDescription"',
    "节点定义 <b>可选</b>",
    "已带出知识库标准定义",
    "标准修改",
  ]) && includesAll(maturity, [
    "category_objects = _object_map(capability_workbench, \"capability_category\")",
    "domain_objects = _object_map(capability_workbench, \"capability_domain\")",
    "capability_objects = _object_map(capability_workbench, \"capability\")",
    '"description": _text(focus_object.get("description"))',
    '"description": _text(service.get("description"))',
  ]),
  "标准来源节点必须投影并显示知识库定义；模板内可覆盖定义但不得覆盖标准基线，新增节点定义保持可选。",
);

requireContract(
  includesAll(component, [
    'data-maturity-action="new-template"',
    "function createStandaloneTemplateWorkspace(sourceTemplate = null, sourceRecord = null)",
    "templateWorkspace: true",
    "hiddenFromProjectList: true",
    'model.activeTab = "template"',
    'data-maturity-action="return-template-manager"',
    "模板管理新增",
  ]) && includesAll(component, [
    'detail.template.status !== "validated"',
    "publishedFromProjectId",
    "publishedFromProjectName",
    "项目来源模板只能回到原项目修改",
    "项目：",
  ]),
  "成熟度首页必须支持用同一图谱编辑器新增模板；项目模板校验保存后进入模板管理并显示来源项目。",
);

requireContract(
  !component.includes("在右侧完成信息后确认新增")
    && includesAll(styles, [
      "max-height: min(calc(100% - 96px), 620px)",
      ".maturity-v51-definition-field textarea",
      "min-height: 84px",
      ".maturity-v50-inspector-actions",
    ]),
  "新增节点属性栏必须按内容收缩并在内部滚动，画布节点不得暴露“在右侧”等实现方位提示。",
);

requireContract(
  includesAll(component, [
    "const TEMPLATE_INLINE_CREATE_GAP = 118",
    "const inlineCreate = model.templateInlineCreate",
    "reservesInlineGap",
    'reservesInlineGap("FOCUS", focus.id, "SERVICE")',
    'reservesInlineGap("L2", capability.id, "FOCUS")',
    'reservesInlineGap("L1", category.id, "L2")',
    'reservesInlineGap("L0", category.id, "L1")',
  ]),
  "画布行内新增或复制编辑器必须为后续分支预留纵向空间，不能覆盖下方节点。",
);

requireContract(
  includesAll(component, [
    "function enforceTemplateServiceRolesForFocus(detail, focusId)",
    "function enforceTemplateServiceRoles(detail, focusIds = null)",
    "role = requiredTemplateServiceRoleForFocus(template, focus)",
    "enforceTemplateServiceRoles(detail, affectedFocusIds)",
    "const corrected = enforceTemplateServiceRoles(detail)",
  ]) && includesAll(maturity, [
    "def _required_service_role(capability:",
    '"code": "service_role_capability_kind_conflict"',
    "服务角色不可手工选择",
    '"code": "granularity_capability_kind_conflict"',
  ]),
  "T 下服务必须固定为独立评估点，G/M 下服务必须固定为平台工具参考；加载、移动、导入和后端校验都必须执行同一硬规则。",
);

requireContract(
  includesAll(component, [
    "function normalizeTemplateIdentity(value",
    "function validateTemplateNodeIdentity(template",
    "function nextUniqueTemplateNodeCode(template",
    "const errors = validateTemplateNodeIdentity(detail.template",
    "名称已被",
    "编号已被",
  ]) && includesAll(maturity, [
    'for field in ("name", "code")',
    '"code": f"duplicate_{field}"',
    '"field": field',
  ]),
  "新增与编辑节点必须在前端执行名称、编号唯一性校验，后端发布校验必须阻止大小写变体重复。",
);

requireContract(
  includesAll(component, [
    "captureFocusAssessmentBaseline(detail, focus)",
    "restoreFocusAssessmentBaseline(detail, focus)",
    "removeTransientTemplateChangeLog(template, mapping)",
    "transientTemplateRemovalWasCancelled(template, entry)",
    'if (transient) restoreStandardRecordChangeAction("FOCUS", focus)',
  ]),
  "新增自建节点再删除必须作为净取消处理，不留下 REMOVED 修改态，并恢复关注点原评估项和评分记录。",
);

requireContract(
  includesAll(component, [
    'id="maturityTemplateInlineScope"',
    "scopeCode = inline?.nodeType === \"SERVICE\"",
    "请选择服务作用域",
    'addScoreItemForFocus(template, capability, focus, "SERVICE", name, scopeCode',
    "record.scopeCode = scopeCode",
    "item.scopeCode = scopeCode",
  ]),
  "安全技术服务新增必须在确认前选择作用域，并同步服务、关系映射和评估点。",
);

requireContract(
  includesAll(styles, [
    ".maturity-v50-create-inspector",
    "grid-template-rows: auto auto minmax(0, 1fr) auto",
    ".maturity-v40-template-inspector.is-creating-node",
    ".maturity-v50-field-error",
    ".maturity-v50-inspector-actions",
    ".maturity-v50-inspector-actions button.is-primary",
    ".maturity-v50-draft-status",
  ]),
  "新增属性面板必须提供 Apple Shell 风格的待确认状态、字段错误和固定确认操作区。",
);

requireContract(
  includesAll(component, [
    "function compactTemplateForLocalStorage(template",
    "stored.rubricStorageRef = base.id",
    "function compactMaturityStoreForRetry(store)",
    "writeStore(compactMaturityStoreForRetry(store))",
  ]),
  "模板保存必须压缩可从基础模板恢复的评分依据，并在本地存储容量紧张时压缩历史报告后重试。",
);

requireContract(
  includesAll(component, [
    'const CUSTOM_TEMPLATE_RUBRIC_RESOLUTION_POLICY = "LATEST_BY_ASSESSMENT_POINT_ORIGIN"',
    'const BASE_KNOWLEDGE_RUBRIC_POLICY = "BASE_KNOWLEDGE_LATEST"',
    'const CUSTOM_GENERIC_RUBRIC_POLICY = "CUSTOM_GENERIC_LATEST"',
    "function refreshCustomTemplateRubrics(template, baseTemplate)",
    "bindScoreItemToBaseKnowledgeRubric(item, base)",
    "bindScoreItemToCurrentGenericRubric(item)",
    "template.rubricResolutionPolicy = CUSTOM_TEMPLATE_RUBRIC_RESOLUTION_POLICY",
    "template.baseKnowledgeRubricVersion",
    "template.customGenericRubricVersion",
    "return bindScoreItemToCurrentGenericRubric(copied)",
    "stored.rubricStoragePolicy = CUSTOM_GENERIC_RUBRIC_POLICY",
  ]) && !component.includes("copied.rubricEntries = list(item.rubricEntries)"),
  "自定义模板评估依据必须按评估点来源解析最新版本：基础评估点跟随知识库，新增或复制评估点跟随通用依据，不固化旧 Rubric 副本。",
);

requireContract(
  includesAll(component, [
    "const inheritedDefinition = !templateRecordIsCustom(record) && !record.definitionOverridden",
    "已带出知识库标准定义",
    "record.definitionOverridden = baseRecord",
    'data-maturity-action="confirm-template-node-properties"',
    ">保存修改</button>",
  ]) && !component.includes("设为关键能力"),
  "能力、关注点和服务必须继承可编辑标准定义；节点属性提供单次显式保存，未实现业务结果的关键能力开关不得出现。",
);

requireContract(
  includesAll(component, [
    "function saveTemplateNodeProperties(detail)",
    "有未保存修改",
    "templateInspectorSaveMessage",
    "model.templateInspectorOpen = true",
    "model.templateInspectorOpen = false",
    "节点属性已保存，详情栏已关闭",
    'data-template-properties-form',
  ]) && includesAll(styles, [
    ".maturity-v52-node-save-status",
    "[data-template-properties-form]",
    "grid-template-columns: minmax(0, 1fr)",
    ".maturity-v54-inspector-section-title",
  ]),
  "节点属性必须由常驻保存区一次提交；成功后关闭详情栏，失败时保留表单和错误状态。",
);

requireContract(
  includesAll(component, [
    "projectDeleteCandidateId",
    "projectDeleteStep",
    "templateDeleteStep",
    "第 ${secondStep ? \"2\" : \"1\"} / 2 次确认",
    "function deleteProjectFromLocalWorkspace(detail)",
    "deletedProjectIds",
    'librarySourceType: "RETAINED_PROJECT"',
    "该模板仍由项目",
    "function deleteTemplateFromLocalWorkspace(record)",
    'data-maturity-action="continue-template-delete"',
    "确认永久删除模板",
    "评估项目管理",
  ]),
  "项目与可删除模板必须双重确认；项目删除保留自定义模板，活动项目模板与标准模板不得直接删除。",
);

requireContract(
  includesAll(component, [
    'data-template-type="base" role="radio"',
    'data-template-type="custom" role="radio"',
    "maturity-v52-template-source-picker",
    "data-create-template-library-id",
    "reusableTemplates.map((item) => `<option",
    "创建后生成新模板 ID，来源保持不变",
  ]) && !component.includes("reusableTemplates.map((item) => { const stats"),
  "新建项目第二步必须只有固定/自定义两个一级选项，自定义来源在二级选择器中选择。",
);

requireContract(
  includesAll(component, [
    "function renderTemplateManagerActions(record)",
    'record.source === "project"',
    'data-maturity-action="open-source-project-template"',
    'data-maturity-action="copy-template-to-manager"',
    "function createStandaloneTemplateWorkspace(sourceTemplate = null, sourceRecord = null)",
    "delete template.publishedAt",
    "delete template.publishedFromProjectId",
    "delete template.publishedFromProjectName",
    "已创建独立模板副本，来源模板保持不变",
  ]),
  "项目来源模板必须回项目优化或创建独立副本，不能在模板管理中直接改写原件。",
);

requireContract(
  includesAll(component, [
    "maturity-v52-project-heading-actions",
    'id="maturityNewProjectButton"',
    "slot.hidden = true",
  ])
    && !component.includes('slot.innerHTML = `<div class="maturity-v2-page-actions"><button id="maturityNewProjectButton"')
    && !component.includes("<dl><div><dt>进行中</dt><dd>${viewCounts.active}</dd></div><div><dt>已完成</dt>"),
  "新建评估项目按钮必须位于项目管理标题区；进行中与已完成数量只保留在状态标签，不在标题区重复展示。",
);

requireContract(
  includesAll(component, [
    "maturity-v60-project-control-header",
    "maturity-v60-project-heading-copy",
    "maturity-v60-project-header-filters",
    'aria-label="评估项目筛选"',
    "maturity-v60-template-control-header",
  ])
    && includesAll(styles, [
      "--maturity-v60-home-header-height: 158px",
      ".maturity-v1-list-page .maturity-v60-project-control-header",
      ".maturity-v1-list-page .maturity-v60-project-header-filters",
      ".maturity-v1-list-page .maturity-v60-template-control-header",
      "grid-template-rows: auto auto minmax(0, 1fr) auto",
    ])
    && !component.includes('</header>\n        <div class="maturity-v1-filterbar"'),
  "项目标题、新建入口与筛选控件必须共用同一头部；项目与模板头部等高，状态视图位于头部下方。",
);

requireContract(
  includesAll(appShell, [
    'if (normalized.startsWith("/workbench/maturity/")) return "/workbench/maturity"',
  ]) && includesAll(component, [
    'model.navigate?.("/workbench/maturity")',
    'data-maturity-action="return-template-manager"',
  ]),
  "项目或模板工作区的返回箭头与返回模板管理必须回成熟度评估首页。",
);

requireContract(
  includesAll(component, [
    'listStatus: "all"',
    "<th>项目 / 客户</th>",
    '[project.name, project.organization, project.industry, project.companySize, displayTemplateName(detail), project.owner]',
    '<span>项目 / 客户</span><input type="search"',
    'placeholder="搜索项目、客户、负责人"',
    "maturity-v54-project-identity",
    'data-maturity-literal="project-name"',
    'project.name || "未命名项目"',
    "project.organization || \"客户未填写\"",
  ])
    && includesAll(styles, [
    ".maturity-v54-project-identity",
    ".maturity-v53-project-row-actions",
  ]),
  "成熟度首页必须默认展示全部测试项目；项目名是首列主身份且可搜索，客户名称作为辅助身份，操作按钮不得越出表格。",
);

requireContract(
  includesAll(component, [
    'return "SAPD标准模板"',
    "function standardProjectTemplateName(projectName = \"\")",
    "function standardCustomTemplateName(templateName = \"\")",
    "function displayTemplateLibraryName(record)",
    "name: standardProjectTemplateName(draft.name)",
    "name: nextStandaloneTemplateName(displayTemplateName(detail))",
    "displayTemplateLibraryName(item)",
  ]),
  "模板名称必须统一为 SAPD标准模板、{项目名}项目模板或{自定义名称}模板，并由同一命名入口覆盖列表、新建、复制和导入流程。",
);

requireContract(
  includesAll(styles, [
    ".maturity-v1-list-page .maturity-v28-project-table th:nth-child(4) { width: 18%; }",
    ".maturity-v1-list-page .maturity-v28-template-table th:nth-child(2) { width: 12%; }",
    ".maturity-v1-list-page .maturity-v28-template-table th:nth-child(3) { width: 18%; }",
    ".maturity-v1-list-page .maturity-v28-template-table th:nth-child(5) { width: 29%; }",
    ".maturity-v28-completion > strong",
    "white-space: nowrap",
  ]),
  "项目完成度与模板结构摘要必须完整显示；项目、模板表格列宽应按信息密度分配。",
);

requireContract(
  includesAll(component, [
    'librarySourceType === "TEMPLATE_COPY"',
    'source: retainedProject ? "project-retained" : copiedTemplate ? "copy" : "import"',
    'if (record.source === "copy") return "模板复制"',
    'librarySourceType: "TEMPLATE_COPY"',
    'librarySourceType: "XLSX_IMPORT"',
  ]) && includesAll(styles, [
    ".maturity-v1-project-page > .maturity-v24-feedback",
    "position: absolute",
    "width: min(640px, calc(100% - 28px))",
  ]),
  "模板来源必须区分模板复制与 XLSX 导入；项目内操作反馈必须是紧凑浮层，不能占满画布。",
);

requireContract(
  includesAll(component, [
    "const actions = []",
    "const actionCount = actions.length",
    "maturity-v56-template-action-grid has-${actionCount}-actions",
    'data-template-action-count="${actionCount}"',
    'data-template-action-role="primary"',
    'data-template-action-role="secondary"',
    'data-template-action-role="utility"',
    'data-template-action-role="danger"',
    "maturity-v55-template-state",
    "function templateLibraryStatus(record)",
    'label: "项目锁定", className: "is-locked"',
    "项目来源模板仅允许在来源项目内修改",
    "function renderTemplateProjectOrigin(record)",
    "maturity-v57-template-project-origin",
    "来自项目",
    'record.source === "default"',
    'data-maturity-action="export-global-template"',
  ]) && !component.includes("不可删除") && !component.includes("maturity-v54-template-main-actions") && includesAll(styles, [
    ".maturity-v56-template-action-grid.has-1-actions",
    ".maturity-v56-template-action-grid.has-3-actions",
    ".maturity-v56-template-action-grid.has-4-actions",
    "grid-template-columns: repeat(3, minmax(0, 1fr))",
    "grid-template-columns: repeat(2, minmax(0, 1fr))",
    ".maturity-v55-template-state",
    ".maturity-v1-status.is-locked",
    ".maturity-v57-template-project-origin",
    "justify-items: center",
    "justify-content: flex-start",
    "text-align: left",
  ]),
  "模板操作必须先按资产类型固定为 1 / 3 / 4 个动作，再使用单槽、三等分或 2×2 等宽网格；标准模板仅显示导出。",
);

requireContract(
  includesAll(styles, [
    ".app-shell-integrated .maturity-v1-list-page",
    "Maturity home has one vertical scroll owner",
    "Maturity home keeps the two desktop modules side by side",
    "grid-template-columns: repeat(2, minmax(0, 1fr))",
    "container-name: maturity-project-module",
    "container-name: maturity-template-module",
    "@container maturity-project-module (max-width: 720px)",
    "@container maturity-template-module (max-width: 720px)",
    "grid-template-columns: repeat(3, minmax(0, 1fr)) auto",
    "overflow-y: auto",
    "overscroll-behavior-y: contain",
    "align-items: start",
    "align-self: start",
    ".maturity-v1-list-page .maturity-v1-project-layout > .maturity-v1-table-wrap",
    ".maturity-v1-list-page .maturity-v24-template-table",
    "overflow: visible",
    ".maturity-v1-list-page .maturity-v26-home-grid .maturity-v24-template-table table",
    "min-width: 0",
  ])
    && !styles.includes("repeat(auto-fit, minmax(min(100%, 730px), 1fr))")
    && !styles.includes(".maturity-v1-list-page .maturity-v1-filterbar label:nth-of-type(4)"),
  "成熟度模块首页必须在桌面端保持项目管理与模板管理左右并列，并在模块内部紧凑适配筛选、标题和操作控件。",
);

requireContract(
  includesAll(component, [
    'project.templateWorkspace || model.activeTab === "template" ? "is-template-workspace" : ""',
  ]) && includesAll(styles, [
    ".maturity-v1-project-page.is-template-workspace",
    "grid-template-rows: auto minmax(0, 1fr)",
    "overflow: hidden",
    ".maturity-v1-project-page.is-template-workspace .maturity-v41-mindmap-workbench",
  ]),
  "评估模板页必须占满项目工作区并由画布内部承载交互，页面本身不得滚动走校验保存栏。",
);

requireContract(
  includesAll(component, [
    ">校验并保存</button>",
    "模板校验通过，已保存到首页模板管理",
    "模板校验通过，已保存；模板管理已同步项目来源",
    "模板已保存",
  ]) && !component.includes("校验并发布"),
  "模板动作和状态必须使用校验并保存语义，不再向用户表达发布。",
);

requireContract(
  includesAll(component, [
    'if (model.activeTab === "template")',
    "expandTemplateAncestors(detail, selected)",
    "positionTemplateMindmapViewport(detail, selected)",
    "顶部搜索可定位并展开节点",
  ]),
  "移除重复目录后，顶部搜索必须在模板编辑态展开祖先并居中定位节点。",
);

requireContract(
  includesAll(styles, [
    "XMind-style custom template workbench",
    ".maturity-v41-mindmap-workbench",
    ".maturity-v47-template-shell-header",
    ".maturity-v47-template-actions",
    ".maturity-v47-undo-step",
    ".maturity-v41-mindmap-viewport",
    ".maturity-v41-mindmap-viewport.is-gesture-zooming",
    ".maturity-v41-mindmap-stage",
    ".maturity-v41-mindmap-stage input",
    "-webkit-user-drag: none",
    "user-select: none !important",
    ".maturity-v41-mindmap-links path",
    ".maturity-v41-mindmap-node",
    ".maturity-v41-mindmap-node.is-draft",
    ".maturity-v44-drag-ghost",
    ".maturity-v44-drag-ghost-card",
    ".maturity-v44-drag-ghost.is-over-target",
    ".maturity-v44-drag-ghost.is-parent-snap",
    "body.is-template-node-dragging",
    "user-select: none",
    ".maturity-v41-mindmap-node.is-template-parent-drop-target::after",
    "@keyframes maturity-v46-magnet-anchor",
    ".maturity-v41-mindmap-node.is-template-drop-settling",
    "@keyframes maturity-v45-drag-ghost-in",
    "@keyframes maturity-v45-node-settle",
    ".maturity-v41-mindmap-node.is-template-drop-candidate",
    ".maturity-v42-node-toggle",
    ".maturity-v42-node-toggle.is-expanded",
    ".maturity-v42-inline-node",
    ".maturity-v41-mindmap-links path.is-provisional",
    ".maturity-v41-loose-composer",
    ".maturity-v41-floating-panel",
    ".maturity-v40-context-menu",
    ".maturity-v40-template-inspector",
    "@media (max-width: 1320px)",
    "@media (prefers-reduced-motion: reduce)",
  ]),
  "评估模板编辑器必须使用 Apple Shell 脑图画布、悬浮工具、右键菜单和响应式/减弱动画规则。",
);

requireContract(
  includesAll(styles, [
    "body.is-template-node-dragging .maturity-v41-mindmap-viewport",
    "body.is-template-node-dragging .maturity-v41-mindmap-viewport *",
    "transform: translate3d(var(--maturity-drag-x, 0), var(--maturity-drag-y, 0), 0)",
    "will-change: transform",
  ]) && !styles.includes("transition: transform 54ms linear")
    && !styles.includes("body.is-template-node-dragging * {"),
  "节点拖动必须取消 ghost 位移延迟，并把禁止选择和 grabbing 光标限制在脑图交互面内。",
);

requireContract(
  includesAll(index, [
    "maturity-custom-generic-rubric-20260730-9",
    "maturity-template-local-gesture-zoom-20260731-17",
    "maturity-template-provenance-canvas-20260731-19",
    "maturity-template-confirm-identity-scope-20260731-22",
    "maturity-template-library-definition-20260731-23",
    "maturity-template-flow-permissions-20260731-24",
    "maturity-detail-back-20260731-1",
  ]),
  "index.html 必须刷新脑图建模器 JS/CSS 版本。",
);

if (issues.length) {
  console.error(JSON.stringify({ result: "fail", issues }, null, 2));
  process.exit(1);
}

console.log(JSON.stringify({
  result: "pass",
  checks: contractCount,
  surface: "shared runtime",
  editor: "L1-collapsed mindmap modeler + confirmed node properties + search navigation + source-owned template copies + two-stage project template selection",
}, null, 2));
