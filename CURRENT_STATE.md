# CURRENT_STATE: SAPD Wiki

本文件用于 Codex 每次开工前快速读取，帮助主控 Agent 避免默认加载过长历史文档。

## 当前主线

- 已导入 Sheet 的业务含义复核 + 前端关系展示校正。
- 用户已明确优先解决“执行线太多 / 子 Agent 不稳定 / 长会话效率下降”问题；后续默认先按 `docs/07-governance/execution-line-convergence-workflow.md` 收敛到单一主控和单一写入主线，再继续新功能。
- Delivery Bundle 1.0-alpha ZIP 解压即用交付版已完成 macOS alpha 准备，但当前打包任务先往后排；后续待用户库长期治理和 `stable_key` / 基础库升级兼容设计稳定后再恢复。
- 当前重点不是新增数据源，也不是扩展新模块，而是把已导入数据的业务语义、页面归属和关系展示校正清楚。
- Frontend Baseline 1.0 已确认作为当前前端对齐工作的基线说明。
- 前后端分离本轮已阶段性收口，收口说明见 `docs/01-architecture/frontend-backend-separation-closure.md`。

## 当前页面范围

Frontend Baseline 1.0 当前覆盖四页：

1. `安全能力映射`
   - 主视角：安全能力 / 安全关注点。
   - 技术视角：安全关注点 -> 作用域 -> 安全技术服务 -> 安全技术模块 / 安全技术措施。
   - 管理视角：安全关注点 -> 管理工作 -> 安全流程（L2 流程组 / L3 流程 / L4 活动）或安全职能（4 层）。
2. `LC-AP安全开发生命周期`
   - 主视角：LC-AP 安全开发生命周期阶段。
   - 核心关系：阶段、主要活动、安全活动、安全策略要求、开发技术服务、安全技术服务、安全技术模块、安全技术措施、开发类产品组件、来源证据。
3. `信息化环境维度`
   - 主视角：信息化环境 / 环境子类 / 信息化对象。
   - 核心关系：环境、环境子类、对象、作用域、安全技术服务、安全技术模块、安全系统、产品、来源证据。
   - 该页是第一批核心数据的第三个业务视角，不是新 Sheet 扩展。
4. `LC-DT数据生命周期安全`
   - 主视角：LC-DT 数据处理过程。
   - 核心关系：数据处理过程、处理子场景、安全技术服务、安全技术模块、安全技术措施、来源证据。

## 当前禁止事项

- 不默认启动 Phase 7 多格式增强。
- 不默认启动 maturity M1。
- 不默认新增 Sheet 扩展。
- 不默认重构数据库 schema。
- 不默认大改 ETL。
- 不默认引入 React / Vue 重构当前静态 MVP 前端。
- 不默认大规模搬迁目录、重排文档编号或大拆 `app.js` / `styles.css`；结构治理优先采用索引、说明、归档和小步收口。
- 不在主展示区暴露非业务字段：`sheet`、`row`、`column`、`raw_value`、`source_file`、`import_id`、`source_id`、`source_ref`、`source_label`、`debug`、`raw`、`metadata`、`intermediate`、`generated_at`。
- 不静默覆盖用户文件或未确认业务判断。
- 不允许提交或同步原始数据、SQLite 数据库、ETL 中间产物、前端生成 JSON、指南 / 标准生成资源或导出包到 GitHub；提交前可用 `python3 scripts/check_github_data_boundary.py` 检查。
- 不允许新增页面绕过 `dataClient` 或 `/api/v1/*` 契约直接读取原始数据、数据库或临时 JSON。
- 不允许前端组件实现 ETL、主数据归一、跨表匹配、成熟度评分或业务关系推断。

## 全工程前后端分离规则

- 后端负责数据导入、清洗、标准化、匹配、关系生成、评分、校验、导出和页面数据投影。
- 前端负责导航、布局、筛选、交互状态、表格 / 树 / 关系视图展示和用户反馈。
- 所有页面数据优先通过 `/api/v1/*` 本地 API 和 `dataClient` 消费；`public/data/*.json` 仅作为后端生成的离线兼容包或 API 不可用时的 fallback。
- 新增页面、字段、关系或 maturity 能力前，先更新后端契约和文档，再进入前端实现。
- ViewModel 只能做展示层整理，不承担业务事实生成、关系推断、评分和客户评估结论。

## 当前下一步

2026-06-05 起主控接管到当前线程 `019e966d-81e1-7261-bd89-370c41a8c90e`；旧 `product design Review` 线程 `019e8b6d-8ae3-7d20-8436-3024c4683891` 降级为历史产物来源 / 待 fan-in，不再默认拥有写入权。后续复杂实现优先采用“轻主控 + 专项 subagent / 专项会话 + fan-in 验收”，主控只做调度、边界、验收、状态更新和 checkpoint。

`OI-128C` 最新结论：用户 2026-06-05 后续抽查提出的定位高亮落到文字后方、L0-L2 批注无常态高亮、普通态高亮线需要加深加粗但不遮挡文字、指南 / 幻灯片页无法添加批注等问题已修复，并已基本验收通过。当前批注设计已作为全局基线固化到 `docs/06-implementation/global-annotation-requirements-and-regression-matrix.md` 和 `docs/06-implementation/frontend-global-design-baseline-2026-05-30.md`；后续新增页面必须按“新页面接入清单”声明页面对象、值锚点、行锚点、幻灯片 / 子页上下文和回归命令，不再逐页重新调试。2026-06-06 已完成 `OI-128C` checkpoint：`b93a9f1 Finalize OI-128C annotation baseline`。后续只按 bug fix 处理，不继续开发新的批注功能或混入工作台 V2 / V3。

当前先进入执行线收敛 P0：验收 dirty worktree、同步治理入口、明确 checkpoint，再继续前端、数据或 Delivery Bundle 功能线。不要在 dirty diff 未验收前启动新的并行写入任务。

2026-06-06 已完成总 backlog 收敛，入口为 `docs/07-governance/backlog-convergence-2026-06-06.md`。当前 dirty worktree checkpoint 已完成：`e23c6d7 Document backlog convergence and frontend planning` 固化 Product Design 审阅、dashboard 契约草案和 backlog 收敛；`f305d1a Checkpoint DB governance and route stability` 固化用户库 / stable key 治理、临时库 smoke 和 `OI-136 / FE-ROUTE` 深层路由修复。用户已明确：`analytics_summary` 是 P0，但不独占当前最高优先级；Delivery Bundle / 打包任务先往后排。当前已完成两个 P0 的代码闭环：`analytics_summary` 已完成 exporter / audit / `data_package_summary` / `dataClient` / dashboard 消费；`OI-135 + DB-11 + DB-2` 已新增 `scripts/migrate_db_contracts.mjs`，提供默认 dry-run、临时库 apply、自动备份、项目真实库写入显式确认门和审计闭环。真实基础库和真实用户库仍未写入，后续如需 apply 必须显式传 `--apply --confirm-project-db-write`。`scripts/audit_analytics_summary_contract.mjs` 可验证 `capability_focus=91`、覆盖率分母、标准控制项 `1745 / 4893` grain 分离、禁止字段泄露、`dataClient` 契约和 dashboard 消费契约；生成 JSON 仍属于前端离线数据包，不纳入 Git。下一步进入工作台 / 数据篮 / 导出最小 API 选择，不再做泛化周边评估。

当前多任务、模块线程和实际 Codex thread id 追踪入口为 `docs/07-governance/current-execution-lines.md`。暂停任务前必须先登记状态、证据、恢复条件和下一步；已有模块线程必须映射到 `EL-xxx` 执行线，避免多会话收敛后丢失任务线。当前已盘点 18 个 cwd 属于本工程的 Codex 线程；`archimate建模` 已进入 idle / 待验收状态，后续页面效果与加载优化走 `OI-133 / EL-025`；`数据安全页面1` 仍显示为运行中线程，主控只做 fan-in，不默认停止或抢写同一范围。长会话需要换新会话时，按 `docs/07-governance/execution-line-convergence-workflow.md` 的“长会话轮换协议”执行。

安全能力映射页数据加载反复回退已登记为 `OI-132 / EL-024`。后续继续修改安全能力页前，必须先做数据加载稳定性治理：区分真实空数据、workspace-view 未加载、projection fallback、完整 workbench fallback、对象 mismatch 和重渲染缺失；不得再用局部空态文案或组件补丁替代加载契约治理。

ArchiMate 建模语言页显示效果和加载效率已登记为 `OI-133 / EL-025`。当前页面已完成 PDF 图片化和区域阅读初版，但后续应先按 `docs/06-implementation/archimate-modeling-page-optimization-plan.md` 确认页面职责、区域导航、首屏图片加载策略和 SAPD 元素图例映射说明，再进入前端实现。

Delivery Bundle 1.0-alpha 当前后排保留：正式设计入口为 `docs/09-delivery/zip-bundle-1.0-alpha-design.md`；ZIP-UAT-0 已完成 macOS arm64 内部试发准备，alpha 试发材料已固定到 `/Users/kim1st/Documents/kim note/04_workspace/analysis/research/知识库工程/sapd wiki bundle/dist/releases/0.1.0-alpha/`，包含 macOS ZIP、checksum、release manifest、README、UAT checklist 和反馈模板。Windows 构建脚本和验收清单已就绪，但 Windows 原生 `SAPD-Wiki-Backend.exe` 仍需 Windows x64 环境实测；release manifest 中 Windows 保持 `pending / not_verified`。后续待 user DB / `stable_key` 前置设计稳定后再恢复打包任务。

优先推进 Frontend Baseline 1.0 的三页 Gap Check 和必要校正：

1. 先做只读差距检查，明确页面现状、缺口、风险和涉及文件。
2. 用户确认后，再进入小范围前端实现。
3. 实现时优先复用当前前端、`dataClient`、后端 API / 数据包契约、ViewModel 展示整理和统一组件风格。
4. 若发现数据缺口，记录为数据契约或待确认问题，不在前端临时硬编码业务关系。

## 必读文件

每次开工建议先读：

- `AGENTS.md`
- `CURRENT_STATE.md`
- `docs/00-overview/master-context-restore.md`

按任务类型追加读取：

- 复杂阶段判断：`task_plan.md`
- 当前关键决策和风险：`findings.md`
- 近期执行恢复：`progress.md`
- Frontend Baseline 1.0 相关任务：`docs/04-user-guide/frontend-baseline-1.0-plan.md`
- 前后端分离继续推进：`docs/01-architecture/frontend-backend-separation-closure.md`
- 问题修复或 bug 核对：`docs/06-implementation/open-issues.md`；查历史已关闭问题时先看 `docs/06-implementation/open-issues-index.md`

## 不必默认读取的长文档

以下文件或目录不要每次开工默认读取，只在任务明确相关时读取：

- `task_plan.md` 的完整历史段落
- `docs/05-archive/findings-history/`
- `docs/05-archive/progress-history/`
- `docs/05-archive/context-slimming-2026-05-15/`
- `docs/08-maturity/`
- `docs/05-archive/`
- `data/exports/`
- `frontend/capability-browser/public/data/*.json`
- 大型前端源码文件，除非任务需要检查或修改对应页面

## 轻量结构治理入口

- `scripts/README.md`：脚本分类、长期工具和专题脚本边界。
- `docs/03-import-etl/README.md`：导入与 ETL 文档索引。
- `docs/06-implementation/open-issues.md`：当前未关闭问题入口；已关闭问题通过 `docs/06-implementation/open-issues-index.md` 定位到归档。
- `node scripts/govern_open_issues.mjs`：Open Issues 轻量治理脚本，用于归档已关闭长记录并刷新全量索引。
- `docs/07-governance/capability-mapping-change-control.md`：安全能力映射页变更分级、暂停条件和治理审计入口。
- `node scripts/audit_frontend_governance.mjs`：前端高风险文件基线审计，防止 `styles.css`、`app.js`、`viewModels.js` 和能力映射关键组件继续无意识膨胀。
- `node scripts/audit_frontend_lazy_load_contract.mjs`：前端按需加载契约审计，检查知识库字典和安全标准 / 框架的 `required` / `supplemental` 分片、标准页 tab loader 和组件内取数边界。
- `node scripts/audit_capability_viewmodel_contract.mjs --url http://127.0.0.1:5173`：安全能力映射页 ViewModel 当前对象一致性审计，验证 L0 / L1 / L2 / 关注点不会误用默认关注点或错粒度 projection。
- 安全能力映射页 `renderCapabilities()` 已拆出显式 `loadState` 阶段，后续继续治理时优先沿该边界推进，不要重新把加载判断写回渲染主体。
- 安全能力映射页对象级契约入口为 `/api/v1/capabilities/workspace-view`；前端通过 `dataClient.getCapabilityWorkspaceView()` 按当前选中对象读取，旧 `workspace-projection` 仅作为兼容 fallback。

## 当前 Agent 工作规则

- 对用户不是开发人员这一点保持友好解释，把复杂任务拆成可确认、可回退的小步骤。
- 复杂任务开始前说明：要解决什么、会读或改哪些文件、完成后得到什么、是否需要用户判断。
- 做较大实现、重构或技术选型前，先确认任务边界并读取必要上下文。
- 默认中文记录说明性内容；代码标识、文件名、命令、字段名、对象 `type`、API 路径保留英文原文。
- 只读任务不得修改文件。
- 如果用户明确禁止读取、运行或打开某类内容，严格遵守。
- 每次任务完成后输出任务完成反馈，说明结论、修改范围、功能结果、验证结果、前端页面提示、数据状态、字段边界和下一步建议。
- 如使用子 Agent，必须明确角色、写入范围、禁止范围和验收标准；完成后主控必须 fan-in 并关闭。

## 重连处理规则

如果后续再次出现多次对话重连、主控长时间不继续、或上下文恢复明显变慢：

- 先执行只读检查：`git status --short --branch`、`wc -l CURRENT_STATE.md task_plan.md findings.md progress.md AGENTS.md`。
- 不要默认读取 `docs/05-archive/`、`data/exports/` 或大型前端 JSON。
- 优先确认是否有未提交的大型上下文文件、未关闭子 Agent 记录或重复计划文件。
- 先做上下文减负和 Git 收口，再继续业务开发。

## Codex 轻量执行入口

当用户只说“继续执行”“执行”“排查一下”“修一下”时，默认按以下顺序处理：

1. 读取 `CURRENT_STATE.md` 和 `progress.md`，必要时读取 `task_plan.md`、`findings.md`。
2. 执行 `git status --short --branch`，确认当前工作区状态。
3. 如果当前任务明确，继续执行；如果不明确，只问用户 1 个问题。
4. 不默认读取 `docs/05-archive/`、`data/exports/`、`frontend/capability-browser/public/data/*.json`、数据库备份或完整历史日志。
5. 不默认运行全量 `ps -ax`、全量 `git diff`、完整 DOM dump 或长 console log。
6. 前端验证默认不启动系统 Google Chrome；优先使用 `python3 scripts/dev_server_guard.py --status`、数据包摘要、语法检查和 `node scripts/frontend_smoke_check.mjs --page <page>` 的轻量 HTTP/API 模式。只有用户明确同意时，才允许传 `--allow-system-chrome` 做系统 Chrome headless 验证。
7. 数据包检查优先使用 `python3 scripts/data_package_summary.py --package <name>`。
8. 本地服务检查优先使用 `python3 scripts/dev_server_guard.py --status`。
9. 本项目常驻预览页固定为 `http://127.0.0.1:5173/`；前端展示和用户验收默认只看该端口。修改 `frontend/capability-browser/` 后必须确认 `5173` 已热刷新到最新文件；若刷新仍旧，执行 `python3 scripts/dev_server_guard.py --restart`，不要另起长期预览端口。
10. 多个线程并行验证时可临时使用其它端口，但验证后必须用 `python3 scripts/dev_server_guard.py --port <temp-port> --stop` 关闭，最终交付地址仍回到 `5173`。
10. 如 `progress.md` 超过 120 行，先归档瘦身；如工作区 diff 很大，建议 checkpoint commit。

详细规则见 `docs/07-governance/codex-performance-workflow.md`。
