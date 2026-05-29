# progress.md

本文件是当前会话恢复入口，只保留最近状态、最近完成事项、关键验证和历史索引。完整执行历史已归档到 `docs/05-archive/progress-history/2026-05.md`。

## 当前状态（2026-05-29）

- 当前分支：`codex-frontend-backend-separation-closure`。
- 当前主线：Frontend Baseline 1.0 四页关系工作台校正；重点仍是已导入 Sheet 的业务语义复核、前端关系展示校正、数据契约治理和字段边界收口。
- 固定预览入口：`http://127.0.0.1:5173/`。前端展示和用户验收默认只看该端口。
- 当前前端设计方向：以 `frontend/capability-browser/apple-morandi-color-demo.html` 为正式颜色基准，走 Apple / iOS / macOS shell 风格：明亮 tinted neutral、浅蓝灰 translucent sidebar、清晰 iOS blue 选中态、低噪表格、segmented tabs 和语义 chip。
- 当前禁止事项：不修改 ETL、数据库、数据模型、导出 JSON、workbench JSON、`dataClient` 数据来源边界或 ViewModel 业务逻辑；主展示区不得暴露 `sheet`、`row`、`column`、`raw_value`、`source_file`、`import_id`、`source_id`、`source_ref`、`source_label`、`debug`、`raw`、`metadata`、`intermediate`、`generated_at`。

## 最近完成事项

- 2026-05-29 子 Agent 调度规则修订：按用户反馈补充长任务 / 子 Agent 运行判断规则，明确“暂无输出不等于无响应”，运行中 Agent 未经用户确认不得关闭；新增三次确认、只读旁路、fan-out / fan-in 模板和适合并行 / 必须串行任务边界。本轮实际启动只读 explorer Agent `019e7428-4a48-7810-ab2a-82394977a438`（Halley）评估并行任务线，已 fan-in 并关闭。
- 2026-05-29 安全能力映射关注点 projection 前端防串包：`app.js` 将关注点按需投影请求改为 `objectType=capability_focus` + `objectId=<当前关注点>`，新增请求序号、当前有效请求和 pending 请求复用记录；响应合并前校验 `selected` / `graph.center` 与当前选中关注点一致，旧响应或对象不一致响应不再进入 `state.capabilityProjection`；`OI-118` 已修复。
- 2026-05-29 BE-4.3 lifecycle-workbench 安全技术措施投影复查：重新导出 `frontend/capability-browser/public/data/lifecycle-workbench.json`，确认当前已承载 `security_technical_measure=4` 和 `uses_measure=4`；LC-AP 阶段级措施为 `AP-02 -> 应用程序威胁建模`、`AP-04 -> 制品安全加固`、`AP-05 -> IaC代码安全测试`，LC-DT 为 `DT-07 -> 数据销毁`；生成 `data/exports/worker-verify/be-4-3-lifecycle-measures-check.json`，更新 `OI-040` 和 BE-4 gap 清单。
- 2026-05-29 Capability Projection Contract 1.0：`/api/v1/capabilities/workspace-projection` 新增 `object_type` / `object_id` 对象粒度契约，支持 `capability_category`、`capability_domain`、`capability`、`capability_focus`；返回 `selected`、`graphScope`、`dataState`、`graph.center`、`summary`、`tabs`，非关注点不返回关注点级 `localRelationMap`，不存在对象返回 `invalid_object`；新增 `scripts/audit_capability_projection_contract.mjs`，`OI-117` 已修复。
- 2026-05-29 Apple demo 严格对齐增强：按用户指定 `apple-morandi-color-demo.html`，强化正式页 Apple shell 观感；侧栏切为浅蓝灰 translucent surface，一级导航、能力目录、环境目录、生命周期目录和知识目录 active 态改为 demo 式 iOS blue 渐变，搜索框、tabs、面板和表格同步使用更明显的圆角、浅玻璃面板和蓝色选中反馈。
- 2026-05-29 Apple demo 组件级二次对齐：继续按 demo 对表格、Tab 页、映射矩阵、维护表、标准表、目录树、环境目录和 chip 做组件级覆盖；仅修改 CSS 和缓存版本号，不修改数据或业务逻辑。
- 2026-05-29 安全知识和标准 / 框架表格统一配色：按 `apple-morandi-color-demo.html`，限定在 `#maintenanceWorkspace.knowledge-directory-mode` 和 `#maintenanceWorkspace.standards-mode` 下统一表格外框、表头、行底色、hover、分组行、折叠行、CSF 语义行和 chip 色彩；未修改数据、ETL、ViewModel 或图谱逻辑。
- 2026-05-29 Apple demo 组件级回归修复：修复通用 segmented tab 和 chip / pill 规则误伤 `LC-AP` 阶段 Tab 的问题，`AP-01` 不再被渲染成胶囊按钮；安全技术模块维护表分类和安全系统明细改为默认收起，并更新组件缓存版本；新增 `OI-116` 跟踪并关闭。
- 2026-05-29 Apple shell 正式配色落地与图谱布局回退：正式 `styles.css` 追加 Apple shell token 覆盖层；曾尝试修复能力关系图谱当前关注点分支布局，但预览效果更差，已回退该图谱布局策略，保留原图谱逻辑。
- 2026-05-29 Apple 颜色交接：新增 `docs/06-implementation/apple-color-direction-handoff-2026-05-29.md`，把 Apple 方向目标、推荐色板、正式页 token 落点、语义映射、推进顺序、禁止项和验收清单整理为前端交接包。
- 2026-05-29 全局字段命名与显示样式第一轮修复：新增 `frontend/capability-browser/displayLabels.js`，集中维护对象标签、关系列名、状态 / 空态文案和 relation chip helper；`OI-112` 已更新为已修复。

## 最近验证

- 2026-05-29 子 Agent 调度规则验证：`rg` 定位既有子 Agent / 长任务规则，`AGENTS.md` 和 `docs/07-governance/codex-performance-workflow.md` 已补充；Halley 只读评估完成并关闭；待提交前执行 `git diff --check` 和数据边界检查。
- 2026-05-29 安全能力映射关注点 projection 防串包验证：`node --check frontend/capability-browser/app.js`、`node --check frontend/capability-browser/dataClient.js`、`node scripts/audit_capability_projection_contract.mjs --url http://127.0.0.1:5173`、`node scripts/frontend_smoke_check.mjs --page capability --url http://127.0.0.1:5173/frontend/capability-browser/`、`git diff --check -- frontend/capability-browser/app.js frontend/capability-browser/dataClient.js docs/06-implementation/open-issues.md progress.md` 均通过；普通沙箱访问 localhost 会 `fetch failed`，已在沙箱外重跑通过，未启动系统 Google Chrome。
- 2026-05-29 BE-4.3 验证：`python3 scripts/sapd_wiki.py export-lifecycle-workbench`、`python3 -m py_compile src/sapd_wiki/exports.py`、三份 workbench JSON 解析、`data_package_summary.py --package lifecycle-workbench`、BE-4.3 自定义字段边界 / 端点检查、`git diff --check` 均通过。
- 2026-05-29 Capability Projection Contract 1.0 验证：`python3 -m py_compile src/sapd_wiki/api_server.py`、`node --check frontend/capability-browser/dataClient.js`、`node --check scripts/audit_capability_projection_contract.mjs`、`node scripts/audit_capability_projection_contract.mjs --url http://127.0.0.1:5173` 通过；固定对象 `T`、`T-AS`、`T-AS.AD`、`T-AS.AD-01`、`T-OF`、`T-OF.AT`、`T-OF.AT-02`、`G-SP.SM-02` 和不存在对象均通过。
- 2026-05-29 Apple demo 组件级二次对齐验证：`node --check frontend/capability-browser/app.js`、`node --check frontend/capability-browser/displayLabels.js`、`node --check frontend/capability-browser/components/LocalRelationNetworkGraph.js` 通过。
- 2026-05-29 Apple demo 组件级二次对齐验证：`git diff --check` 通过；`python3 scripts/check_github_data_boundary.py` 通过。
- 2026-05-29 固定 `5173` 服务验证：`python3 scripts/dev_server_guard.py --status` 在沙箱外返回 `result=pass`，首页和 `workspace_projection` 均为 200。
- 2026-05-29 前端轻量 smoke：`/capability-mapping`、`/knowledge/technical-services`、`/environment-mapping`、`/development-security` 均通过；未启动系统 Google Chrome。
- 2026-05-29 回归修复验证：`node --check TechnologyModuleMaintenanceTable.js`、`node --check app.js`、`git diff --check`、`check_github_data_boundary.py` 通过；`/development-security` 和 `/knowledge/technical-modules` smoke 通过。
- 2026-05-29 安全知识和标准 / 框架表格统一配色验证：`node --check app.js`、`StandardFrameworkTable.js`、`TechnologyModuleMaintenanceTable.js`、`git diff --check`、`check_github_data_boundary.py` 通过；`/knowledge/scopes`、`/knowledge/technical-services`、`/knowledge/technical-modules`、`/standards/nist-csf-core`、`/standards/nist-800-53`、`/standards/iso-27001-2022` smoke 通过。
- 2026-05-29 图谱布局回退验证：`LocalRelationNetworkGraph.js` 和 `relationGraphModel.js` 保持原布局逻辑，不再使用失败的 `local_relation_radial_star` 策略。

## 当前问题索引

- `OI-112`：全局字段命名与显示样式一致性，已修复。
- `OI-113`：前端整体色系未统一到 Apple / Morandi 体系，已修复并继续做组件级增强。
- `OI-114`：能力关系图谱布局修复尝试造成视觉回退，已回退。
- `OI-115`：刷新后层级能力节点误用默认关注点投影数据，已修复。
- `OI-116`：Apple demo 组件级对齐误伤 LC-AP 阶段 Tab 和模块表默认展开，已修复。
- `OI-117`：安全能力 projection 缺少对象粒度契约，已修复。
- `OI-118`：关注点 projection 前端缺少请求防串包校验，已修复。

## 历史索引

| 归档文件 | 内容 |
|---|---|
| `docs/05-archive/progress-history/2026-05.md` | 2026-05 完整执行记录、根目录 `progress.md` 瘦身快照和本轮轻量结构治理记录 |
| `docs/05-archive/findings-history/2026-05.md` | 2026-05 历史发现 |
| `docs/05-archive/context-slimming-2026-05-15/` | 2026-05-15 上下文瘦身快照 |

## 维护规则

- 本文件只保留最近 1-3 次重要执行；超过 120 行时继续归档到 `docs/05-archive/`。
- 详细过程、长命令输出和阶段性历史不写入根目录 `progress.md`。
