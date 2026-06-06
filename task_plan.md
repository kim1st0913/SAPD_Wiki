# Task Plan: SAPD 工作知识库系统

本文档只保留当前阶段计划入口和未完成主线。完整历史计划已归档，避免每次开工默认加载过长上下文。

## 当前状态

- Status: `security_capability_workbench_radial_star_network_refined`
- Started: 2026-05-09
- 当前主线：已导入 Sheet 的业务含义复核 + 前端关系展示校正
- 快速状态入口：`CURRENT_STATE.md`
- 完整历史计划归档：`docs/05-archive/context-slimming-2026-05-15/task_plan-full-before-slimming.md`

## 当前阶段

当前处于 Phase 5：知识浏览与搜索 / 关系化前端工作台校正。

本阶段不是新增 Sheet，也不是进入 Phase 7 多格式增强，而是把已导入数据的业务语义、页面范围、关系链路和前端展示方式校正清楚。

## Frontend Baseline 1.0

Frontend Baseline 1.0 当前关系工作台实现重点仍覆盖三页：

1. `安全能力映射`
   - 主视角：安全能力 / 安全关注点。
   - 技术视角：安全关注点 -> 作用域 -> 安全技术服务 -> 安全技术模块 / 安全技术措施。
   - 管理视角：安全关注点 -> 管理工作 -> 安全流程（L2 流程组 / L3 流程 / L4 活动）或安全职能（4 层）。
2. `LC-AP开发安全生命周期`
   - 主视角：LC-AP 开发安全生命周期阶段。
   - 核心关系：阶段、主要活动、安全活动、安全策略要求、开发技术服务、安全技术服务、安全技术模块、安全技术措施、开发类产品组件、来源证据。
3. `信息化环境维度`
   - 主视角：信息化环境 / 环境子类 / 信息化对象。
   - 核心关系：环境、环境子类、对象、作用域、安全技术服务、安全技术模块、安全系统、产品、来源证据。
   - 该页是第一批核心数据的第三个业务视角，不是新 Sheet 扩展。

全站菜单和数据契约规划另纳入 `SAPD 成熟度评估` 独立模块，承载评分填报、结果生成和评估报告入口；该模块后续另开实现会话，不并入三份 workbench JSON。

详细说明见：`docs/04-user-guide/frontend-baseline-1.0-plan.md`

## 当前下一步

前后端分离本轮已阶段性收口，收口说明见 `docs/01-architecture/frontend-backend-separation-closure.md`。

2026-06-06 已新增总 backlog 收敛入口：`docs/07-governance/backlog-convergence-2026-06-06.md`。后续恢复未开展任务时，先用该文件区分 `Gate 0`、`P0`、可并行只读评估、后续开发和后置任务，避免用某一条前端或交付线覆盖整个项目计划。

后续继续推进时，建议按“前端页面设计线”和“后端数据 / 逻辑线”分开管理，并按页面逐个闭环：

1. 先确认对应页面的后端投影契约是否稳定。
2. 再进入前端页面设计和组件实现。
3. 每页完成后执行浏览器切换回归、字段边界检查和静态 / API fallback 检查。
4. 若发现数据缺口，记录为数据契约或待确认问题，不在前端临时硬编码业务关系。

本轮已完成首个前后端分离落点：安全能力映射页新增 `/api/v1/capabilities/workspace-projection`，用于承载技术视角和管理视角的关系投影；静态模式下保留 ViewModel fallback。

2026-06-06 用户调整优先级：`analytics_summary` 是 P0，但不独占当前最高优先级；Delivery Bundle / 打包任务先往后排。当前已完成 `OI-135 + DB-11 + DB-2` 的第一轮设计收敛，产出 `docs/06-implementation/user-database-governance-and-stable-key-design.md`；Data Analytics dashboard 成果已 fan-in 到计划，后续按队列推进，不直接改前端。

## 当前 P0 主线队列

| 优先级组 | 工作包 | 当前状态 | 推荐下一步 | 改动边界 |
|---|---|---|---|---|
| P0-A | 用户库长期治理 | `OI-135` / `DB-11` 临时库 smoke 通过 / 真实迁移待确认 | 先 checkpoint 当前设计与 smoke 证据；如继续推进，下一步设计真实迁移脚本的备份、dry-run、apply 三段式，不直接写真实用户库 | 文档 / schema 设计先行，不直接改前端按钮 |
| P0-A | `stable_key` / 基础库升级兼容 | `DB-2` 临时库 smoke 通过 / 真实迁移待确认 | 先 checkpoint 当前设计与 smoke 证据；如继续推进，下一步定义正式 stable key 生成口径和 `base_id_redirects` 真实样例策略 | 支撑批注、收藏、Delivery 和后续基础库升级 |
| P0-B | `analytics_summary` 落地 | exporter / audit / `data_package_summary` / `dataClient` 已完成，dashboard 待启动 | 下一步让 dashboard 消费 `dataClient.getAnalyticsSummary()`；不要在 dashboard 内重新计算跨包指标 | 先数据契约，后前端展示 |
| P0-C | 深层路由稳定性 | `OI-136 / FE-ROUTE` 已修复 / 待 checkpoint | 已通过根 `base href` 修复 `/guides/*`、`/knowledge/*`、`/standards/*` 直接访问资源相对路径问题；轻量 smoke 已覆盖三类深链根资源加载 | 单线写入，不和 dashboard 或批注混写 |
| P1 | Delivery Bundle 1.0-alpha | macOS alpha 已准备，Windows 未实测 | 打包任务后排；待 user DB / stable_key 前置设计稳定后，再决定是否恢复 Windows UAT 或正式打包 | 不和前端 UI 混写 |

## analytics_summary P0 落地计划

设计入口：

- `docs/06-implementation/dashboard-and-module-data-display-optimization-design.md`
- `docs/06-implementation/analytics-summary-json-contract-draft.md`

实施原则：

- 先生成后端 / 离线数据契约，再接入 `dataClient`，最后改 dashboard 展示。
- Dashboard 第一屏围绕 `capability_focus`、能力覆盖、多维支撑、场景可达和标准支撑，不展示数据治理 / 导入健康 / 工程状态。
- 标准控制项必须区分三类 grain：能力映射可达控制项、标准索引控制项、SQLite 全库 reconciliation；不得混成一个“标准控制项总数”。
- 普通用户主展示区不得出现 `sheet`、`row`、`column`、`raw_value`、`source_file`、`import_id`、`source_id`、`source_ref`、`source_label`、`debug`、`raw`、`metadata`、`intermediate`、`generated_at`。

| 顺序 | 编号 | 任务 | 状态 | 改动范围 | 验收重点 |
|---|---|---|---|---|---|
| 1 | AN-SUM-EXPORT | exporter 生成 `analytics-summary.json` | 已完成 / 待提交 | 新增 `scripts/export_analytics_summary.mjs`；输出 `frontend/capability-browser/public/data/analytics-summary.json`，该生成包不纳入 Git | 顶层包含 `meta`、`businessSummary`、`coverageSummary`、`moduleSummary`、`navigationSummary`、`relationshipSummary`、`evidenceSummary`、`adminSummary`、`reconciliationSummary`、`compatibility`；覆盖率有分子、分母、relation type、source package |
| 2 | AN-SUM-PKG | `data_package_summary.py` 增加摘要检查 | 已完成 / 待提交 | `scripts/data_package_summary.py`、`scripts/README.md` | `--package analytics-summary` 能显示 `dataState`、主 grain、关键计数、覆盖维度、标准控制项三类 grain，不打印完整 JSON |
| 3 | AN-SUM-CLIENT | `dataClient.getAnalyticsSummary()` | 已完成 / 待提交 | `frontend/capability-browser/dataClient.js`；`audit_analytics_summary_contract.mjs` 增加客户端契约检查 | 统一处理 API `/api/v1/data-packages/analytics-summary` 与离线包 fallback；页面组件不直接读取 raw workbench JSON 重新计算 P0 指标 |
| 4 | AN-SUM-DASHBOARD | dashboard 消费 `analytics_summary` | P0 待启动 | `frontend/capability-browser/app.js`、必要 CSS；不改批注模块 | 首页从数据包健康统计转为能力知识地图入口；管理员 / reconciliation 信息只进折叠维护区；不做营销页、卡片墙或装饰 dashboard |
| 5 | AN-SUM-AUDIT | audit 脚本验证覆盖率、标准控制项 grain 和禁止字段泄露 | 已完成 / 待提交 | 新增 `scripts/audit_analytics_summary_contract.mjs` | 验证覆盖率分母固定为 `capability_focus`、标准控制项三类 grain 不混用、主展示字段不泄露禁止字段 |

推荐实施顺序：

1. 先做 `AN-SUM-EXPORT`，把 Data Analytics 方案变成稳定离线数据包。
2. 同步做 `AN-SUM-AUDIT` 的最小契约审计，先让错误可被脚本抓住。
3. 做 `AN-SUM-PKG`，把 `data_package_summary.py` 变成轻量验收入口。
4. 做 `AN-SUM-CLIENT`，只加读取契约，不改页面视觉。
5. 最后做 `AN-SUM-DASHBOARD`，用已经稳定的数据包替换当前首页工程统计。

不建议同时做：

- 不同时做 dashboard 视觉重构和 exporter 口径调整。
- 不让 dashboard 组件直接从 `capability-workbench`、`environment-workbench`、`lifecycle-workbench` 拼统计。
- 不把 `OI-136 / FE-ROUTE`、批注 UI 微调、导航重构和 `analytics_summary` 落地混在一个提交里。

## 未来项目计划：前端页面设计线

| 编号 | 任务 | 当前状态 | 目标产出 | 依赖 |
|---|---|---|---|---|
| FE-0 | 安全能力映射页关系画布收敛 | 已完成（F3-GRAPH-P2） | 已恢复预览页式结构，以 `本地关联摘要 / 技术视角 / 管理视角 / 标准框架` 四个同级 Tabs 承载工作台；右侧栏已删除；技术 / 管理 Tab 已恢复原 `FocusScopeServiceMatrix` / `FocusManagementMapping` 矩阵组件；已诊断并修复管理职能层级展示投影丢失问题；默认本地关联摘要已升级为原生 SVG 网络图，并进一步收敛为以当前能力-关注点为唯一中心锚点的径向星形关系图：`技术视角`、`管理视角`、`标准 / 框架映射` 三个一级分支星形分散，管理视角下按 `安全职能 / 安全工作 / 流程` 展开，安全职能展示四类层级，流程按 L2/L3/L4 真实数据展开 | 已有能力页投影、用户确认的预览图、`security-capability-workbench-visual-spec-v1.md` |
| FE-IA | 全站菜单与页面类型定义 | 已完成 | 固化全站菜单、页面类型、导航 Manifest、Stitch 交接说明、全局导航 Stitch Prompt、设计输出目录和 implementation specs 目录 | `docs/00-overview/frontend-menu-and-page-type-definition-v1.md`, `frontend/design-handoff/README.md` |
| FE-AS | Application Shell 集成实现 | 已完成 | 已接入 Manifest 导航、顶部栏、页面标题区、面包屑、通用 WorkbenchLayout / RightInsightPanel 骨架，并保持现有页面可用 | `frontend/design-handoff/implementation-specs/application-shell-implementation-spec-v1.md`, `frontend/design-handoff/navigation/nav-manifest.v1.json` |
| FE-AS-V | Application Shell 视觉对齐 | 已完成 | 已按 Stitch 输出对齐蓝灰低阴影工作台风格，移除重复品牌，降低顶部状态区和安全能力映射页视觉噪声，并生成 1440px / 1920px 截图 | F2-P1.5 应用壳集成、`application-shell-v1.png` |
| FE-CAP-SPEC | 安全能力映射工作台视觉实现规格 | 已完成 | 已新增视觉实现规格，明确拒绝验收原因、三视角关系图、右侧关联洞察区和响应式验收标准 | `frontend/design-handoff/implementation-specs/security-capability-workbench-visual-spec-v1.md` |
| FE-CAP-W | 安全能力映射工作台专项实现 | 已完成（F3-GRAPH-P2） | F3-P1R 与 F3-IMPL-P1 均已被用户拒绝；R2 恢复预览页结构，R3/R4 完成矩阵语义校正与 Tab IA，R5 删除右侧栏；RECOVERY 恢复原技术 / 管理矩阵组件到对应 Tabs；F3-DIAG 修复四类职能层级投影；P2/P3/P4 将默认摘要收敛为同源图式总览；GRAPH-P1-V2 新增原生 SVG `LocalRelationNetworkGraph` 和 `relationGraphModel`；GRAPH-P2 将其改为径向星形网络图，确保能力-关注点为唯一中心锚点、三视角星形分散、无数据业务节点不显示，技术 / 管理 Tabs 继续保留表格式明细 | `CapabilityLocalRelationMap.js`, `LocalRelationNetworkGraph.js`, `relationGraphModel.js`, `FocusScopeServiceMatrix.js`, `FocusManagementMapping.js`, `viewModels.js`, `app.js` |
| FE-ROUTE | 深层路由直接访问与刷新稳定性治理 | 已修复 / 待 checkpoint（`OI-136`） | 已在 `index.html` 固化根 `base href="/"`，并扩展 `frontend_smoke_check.mjs` 的深层路由轻量资源断言，覆盖 `/guides/*`、`/knowledge/*`、`/standards/*` 直接访问样式和主脚本加载 | `frontend-global-design-baseline-2026-05-30.md`, `index.html`, `scripts/frontend_smoke_check.mjs` |
| FE-DASHBOARD-AS | Dashboard 消费 `analytics_summary` | P0 待启动 | 首页从工程数据包统计切换为“安全能力知识地图”入口，只消费 `dataClient.getAnalyticsSummary()`，不在组件内重新计算跨包覆盖率、标准控制项 grain 或关系推断 | `docs/06-implementation/dashboard-and-module-data-display-optimization-design.md`, `docs/06-implementation/analytics-summary-json-contract-draft.md`, `dataClient.js`, `app.js` |
| FE-1 | 关系画布设计基线固化 | 待启动 | 抽象 `LocalRelationCanvas` / `RelationNode` / `RelationLane` / `FoldedDetail` 等可复用模式，不急于跨页抽组件文件 | FE-0 验收结果、FE-IA |
| FE-2 | 安全能力映射页前端验收清单 | 待启动 | 固化能力页验收项：左侧关注点、技术视角、管理视角、矩阵折叠、来源折叠、字段边界、无控制台错误 | FE-0 |
| FE-3 | 信息化环境维度页设计 | 第一版实现已完成 | 已新增信息化环境安全能力映射图谱策略，并接入环境页本地关系图谱：`E0` 信息化环境只展示结构、`E1` 环境子类展示对象 / 作用域 / 服务 / 能力概览、`E2` 信息化对象完整展示作用域、服务、模块 / 措施、系统、产品和能力 / 关注点；保留原环境映射表作为核对入口 | `frontend/design-handoff/implementation-specs/environment-security-capability-graph-strategy-2026-05-20.md`, `environmentRelationGraphModel.js`, `EnvironmentLocalRelationMap.js`, BE-2 |
| FE-4 | LC-AP 开发安全生命周期页设计 | 待启动 | 形成生命周期页局部关系画布：阶段 -> 活动 -> 策略 -> 服务 -> 模块 / 措施 / 组件 | BE-3 |
| FE-M | SAPD 成熟度评估页面设计 | 待启动（另开会话） | 形成评分填报、结果摘要和报告导出页面，不复用关系画布作为主界面 | maturity 专用数据契约 |
| FE-5 | 三页共同组件和交互一致性整理 | 后置 | 统一导航、对象头、关系画布、折叠明细、来源证据、空状态和标签风格 | FE-2 / FE-3 / FE-4 |
| FE-6 | 专项知识维护页面稳定化 | 第二轮结构调整已完成 | 已按安全知识目录链路完成收口：外层二级入口为作用域、技术模块/措施、管理工作/流程、职能、Hype Cycle、其他知识目录；模块/措施、管理工作/流程、职能/岗位参考改为内部 Tab；维护表格密度与列宽统一；后续继续梳理详情面板和缺口字段 | 后端专项接口稳定 |
| FE-ANN | 全局批注与工作台锚点契约 | 基本验收通过 / checkpoint 已完成（OI-128C 设计已固化为全局基线，真实回归 33/33 通过） | 右侧浮层批注抽屉已替代横向收藏条；批注模块按 overlay 层治理，基础页面只暴露稳定锚点，批注层统一处理右键、抽屉、保存、状态、tooltip、常驻提示和定位高亮；全局值级锚点覆盖能力映射、环境映射、知识库字典、标准 / 框架、指南和 LC-AP / LC-DT；普通 `td` 单元格具备值级兜底，知识库对象行挂载稳定 `data-annotation-target-ref`，折叠目录定位可自动展开父级并恢复常驻标记。普通态视觉已从背景铺底收口为贴文字的琥珀下划线，行级普通态只保留左侧标识，关系 chip 保留语义底色并叠加低噪声下划线 / 边框；定位态保留更明显的黄色 + Apple blue 聚焦，指南 slide / thumb 定位态额外补齐琥珀下沿，避免 active 蓝底覆盖批注 ink。2026-06-06 已完成 `OI-128C` checkpoint：`b93a9f1 Finalize OI-128C annotation baseline`。当前设计已写入全局基线和新页面接入清单，后续新增页面必须先接入页面对象、值锚点、行锚点、幻灯片 / 子页上下文并跑契约审计，不再逐页重新调试。后续批注只按 bug fix 处理；当前进入 P0 主线队列，不再把批注作为新功能主线 | `docs/06-implementation/global-annotation-requirements-and-regression-matrix.md`, `docs/06-implementation/workspace-annotation-and-capability-remix-design.md`, `scripts/audit_user_annotation_contract.mjs`, `scripts/audit_saved_user_annotations.mjs` |

前端页面设计线的边界：

- 前端负责布局、交互、折叠、筛选、表格、节点视觉和验收体验。
- 前端不得生成业务事实，不得从原始 JSON 推断关系，不得绕过 `dataClient` 或 `/api/v1/*`。
- 页面设计不追求一次性 Impeccable polish，先把业务关系表达清楚，再做视觉细节。

## 未来项目计划：后端数据 / 逻辑线

| 编号 | 任务 | 当前状态 | 目标产出 | 依赖 |
|---|---|---|---|---|
| BE-0 | API / 离线数据包契约盘点 | 已完成 | 已形成三页所需字段、关系、状态、来源证据契约清单，确认哪些来自 API，哪些来自 fallback JSON | `docs/01-architecture/api-offline-package-contract-inventory.md` |
| BE-1 | 安全能力映射页投影补强 | 已完成 | 已输出 `scopeServicePairs`、`serviceModuleMeasureLinks`、`workFunctionsByLayer`、`processTree`，后续前端可直接消费 `localRelationMap` | 现有 `/api/v1/capabilities/workspace-projection` |
| BE-DG | Frontend Baseline 1.0 前端数据契约治理 | 已完成 | 三份 workbench 规格已齐；三个 P0 workbench JSON 已能生成；`dataClient` / ViewModel 已提供稳定读取入口；契约验收通过 | `docs/04-user-guide/frontend-data-contract-baseline-1.0.md`, `frontend/capability-browser/public/data/*-workbench.json` |
| BE-DPS-1 | Data Package Split 1.0 专项维护包拆分 | 已完成 | 新增 `maintenance-knowledge.json`，专项知识维护页和 `dataClient` 优先读取该包；`management-knowledge.json` 已退役，不再作为前端 fallback 或 API 数据包 | `frontend/capability-browser/public/data/maintenance-knowledge.json`, `dataClient.js`, `viewModels.js` |
| BE-2 | 信息化环境维度页投影 | 已完成（数据包投影） | 已输出 `environment-workbench.json`，承载环境 / 对象 / 作用域 / 服务 / 模块 / 系统 / 产品 / 能力关联 | `frontend/capability-browser/public/data/environment-workbench.json` |
| BE-3 | LC-AP 生命周期页投影 | 已完成（数据包投影） | 已输出 `lifecycle-workbench.json`，承载阶段 / 活动 / 控制点 / 策略要求 / 服务 / 模块 / 能力关联 | `frontend/capability-browser/public/data/lifecycle-workbench.json` |
| BE-4 | 数据质量与缺口清单 | 已完成（首轮静态审计，BE-4.2 已修复；`OI-040` 已修复） | 已新增三份 workbench 数据质量与缺口清单，确认三包顶层结构、关系端点和字段边界正常；`OI-040`、`OI-049`、`OI-050` 已修复，当前继续跟踪源数据一致性待确认问题 `OI-073` | `docs/06-implementation/be-4-workbench-data-quality-gap-list.md`, `docs/06-implementation/open-issues.md` |
| BE-AN-SUM-1 | `analytics_summary` 离线数据包生成 | 已完成 / 待提交 | 新增 exporter 生成 `frontend/capability-browser/public/data/analytics-summary.json`，聚合 `capability-workbench`、`environment-workbench`、`lifecycle-workbench`、`standards-index`、`content-views`，以 `capability_focus` 为主 grain，输出覆盖率、模块入口、关系摘要、证据摘要和 reconciliation；生成包不提交到 Git | `docs/06-implementation/analytics-summary-json-contract-draft.md`, `docs/06-implementation/dashboard-and-module-data-display-optimization-design.md` |
| BE-AN-SUM-2 | `analytics_summary` 数据包摘要与审计 | 已完成 / 待提交 | 扩展 `scripts/data_package_summary.py` 支持 `analytics-summary` 摘要；新增 `scripts/audit_analytics_summary_contract.mjs`，验证覆盖率、标准控制项三类 grain 和禁止字段泄露 | `BE-AN-SUM-1` |
| BE-M | SAPD 成熟度评估数据契约 | 待启动（另开会话） | 定义 maturity 评估模板、填报会话、结果投影和报告导出契约 | `docs/08-maturity/` |
| BE-5 | 导入 / 校验 / 审批链路回补 | 后置 | 将当前 Excel 导入 MVP 进一步整理为 source -> staging -> review -> formal tables 的可维护链路 | 当前导入脚本和 SQLite |
| BE-6 | Delivery Bundle 1.0-alpha ZIP 解压即用交付版 | 后排保留；ZIP-UAT-0 macOS 内部试发准备已完成，Windows 待实机验证 | 当前 macOS arm64 alpha 试发材料已固定到 `/Users/kim1st/Documents/kim note/04_workspace/analysis/research/知识库工程/sapd wiki bundle/dist/releases/0.1.0-alpha/`，并已固化 ZIP、checksum、release manifest、试发指南、UAT checklist 和反馈模板；Windows `SAPD-Wiki-Backend.exe` 构建脚本和验收清单已就绪，但需 Windows x64 环境继续实测。打包任务先往后排，待 user DB / `stable_key` 前置设计稳定后再恢复 | `docs/09-delivery/zip-uat-0-internal-trial-guide.md`, `docs/09-delivery/zip-uat-0-checklist.md`, `docs/09-delivery/zip-uat-feedback-template.md`, `docs/09-delivery/windows-zip-build-guide.md` |

后端数据 / 逻辑线的边界：

- 后端负责导入、清洗、主数据统一、关系生成、校验、页面投影和来源证据。
- 后端投影应直接服务前端页面，不把 Sheet 原始字段泄露给主展示区。
- 每新增一个页面关系字段，先更新契约或投影说明，再进入前端消费。

### Delivery Bundle 1.0-alpha ZIP 前置任务

| 编号 | 任务 | 当前状态 | 目标产出 |
|---|---|---|---|
| DB-1 | base/user 双数据库边界 | 最小运行契约已完成 | 明确 `sapd_wiki_base.sqlite3` 只读基础库和 `sapd_wiki_user.sqlite3` 可写用户库 schema 分界 |
| DB-2 | `stable_key` / deterministic ID 策略 | P0 临时库 smoke 通过 / 真实迁移待确认 | 已新增 `scripts/audit_stable_key_contract.mjs`、`scripts/smoke_db_migration_contracts.mjs` 和 `base-stable-key-and-redirect-migration-design-2026-06-06.md`；复制基础库已验证 4660 个对象和 7654 条关系的 `stable_key` / `stable_ref` / `public_id` 覆盖，真实迁移仍需用户确认 |
| DB-3 | base manifest 与版本规范 | 最小契约已完成 | 生成 `base-manifest.json`，绑定 app 版本、base 数据版本、schema 版本、fallback JSON hash 和关键计数 |
| DB-4 | 用户库 schema / migration | 最小 schema 与创建脚本已完成 | 初始化用户库，覆盖备注、收藏、个人标签、overlay、修正建议、用户导入 staging / review / change log |
| DB-11 | 用户库治理与兼容表迁移清理 | P0 临时库 smoke 通过 / 真实迁移待确认 | 已新增 `scripts/audit_user_db_governance_contract.mjs`、用户库兼容报告、`scripts/plan_user_schema_0_3_migration.mjs` 和 `scripts/smoke_db_migration_contracts.mjs`；复制用户库已验证 `user_schema_0.3` 13 张新表，真实迁移仍需用户确认 |
| DB-5 | base/user 合并 read model | 连接与命名空间规则已设计 | API 层输出 `base:<id>` / `user:<id>` 命名空间，前端不关心数据来自哪个 SQLite |
| DB-6 | ZIP Bundle Builder alpha | 真实运行 ZIP 构建规则已收紧 | 从已审批正式库生成 `sapd_wiki_base.sqlite3`、manifest、`frontend-dist`、分平台 start/stop / diagnostics 脚本、logs、diagnostics 和平台 zip 目录；默认输出到 `/Users/kim1st/Documents/kim note/04_workspace/analysis/research/知识库工程/sapd wiki bundle`；真实 ZIP 必须传入 `--backend-binary`，结构验证包必须显式 `--allow-placeholder` |
| DB-7 | 本地后端可执行文件 alpha | macOS arm64 已打包验证，Windows 待实测 | `scripts/run_local_server.py` 已用 PyInstaller 打包为 macOS arm64 `SAPD-Wiki-Backend` 并完成 ZIP 解压启动验证；Windows 构建脚本 `scripts/package_backend_windows.ps1` 和 `docs/09-delivery/windows-zip-build-guide.md` 已就绪，待 Windows x64 环境生成并验证 `SAPD-Wiki-Backend.exe` |
| DB-9 | ZIP-UAT-0 内部试发准备 | macOS arm64 已完成，Windows 前置已收口 | macOS alpha 试发材料已固定到本地 release 目录，包含 ZIP、checksum、release manifest、README、UAT checklist、问题反馈模板和 Windows pending 验证报告；Windows x64 实机构建前置条件已固化 |
| DB-8 | Tauri / 安装包体验增强 | 后置 | ZIP alpha 成立后再评估 Tauri 壳、macOS `.dmg/.app`、Windows `.msi/.exe`、签名和自动更新 |

## 页面推进顺序建议

| 顺序 | 页面 / 模块 | 推荐原因 | 工作方式 |
|---|---|---|---|
| 1 | 安全能力映射页 | 已经有投影和多轮前端试错，最适合作为关系画布基准页 | 先收敛当前画布，再固化验收标准 |
| 2 | 信息化环境维度页 | 关系链较清晰，但要严格控制系统 / 产品不要混入主箭头 | 先补后端投影，再做页面 |
| 3 | LC-AP 开发安全生命周期页 | 关系类型最多，最容易前端硬推断 | 先补后端投影，再做页面 |
| 4 | 三页组件一致性 | 只有三页都跑通后，才有足够事实抽象公共组件 | 小步重构，不做框架迁移 |
| 5 | 专项知识维护和治理入口 | 作为数据核对与修复入口，不抢主线关系画布优先级 | 保持稳定，按问题修复 |

## 全工程前后端分离规则

- 后端负责数据导入、清洗、标准化、匹配、关系生成、评分、校验、导出和页面数据投影。
- 前端负责导航、布局、筛选、交互状态、表格 / 树 / 关系视图展示和用户反馈。
- 所有页面数据优先通过 `/api/v1/*` 和 `dataClient` 进入前端；`public/data/*.json` 仅作为后端生成的离线兼容包或 API 不可用时的 fallback。
- 新增页面、字段、关系或 maturity 能力前，先更新后端契约和文档，再进入前端实现。
- ViewModel 只做展示层整理，不承担 ETL、主数据归一、跨表匹配、成熟度评分或业务关系推断。

## 当前禁止事项

- 不默认启动 Phase 7 PPT / Draw.io / DOCX 多格式增强。
- 不在当前会话启动 maturity 评估代码实现；后续另开会话推进。
- 不默认新增 Sheet 扩展。
- 不默认重构 SQLite schema。
- 不默认大改 ETL。
- 不默认引入 React / Vue 重构当前静态 MVP 前端。
- 不在主展示区暴露非业务字段。
- 不新增绕过 `dataClient` 或 `/api/v1/*` 契约的数据读取路径。

## 长期阶段索引

| Phase | Name | 当前处理 |
|---|---|---|
| 0 | 需求澄清与项目规划 | 已完成，历史见归档 |
| 1 | 数据发现与字段定义 | 主体完成，后续随 Sheet 复核补充 |
| 2 | 工程骨架 | 已建立，按需维护 |
| 3 | 数据模型设计 | 已完成，当前不重构 schema |
| 4 | 导入 MVP | 已跑通，当前不大改 ETL |
| 5 | 知识浏览与搜索 | 当前主线 |
| 6 | 导出与备份 | 后续 |
| 7 | 多格式增强 | 后置 |
| 8 | 更新审查与关系管理 | 后续 |
| 9 | 打包交付 | Delivery Bundle 1.0-alpha ZIP 主目标已锁定，工程待启动 |
| 10 | AI/RAG 增强 | 可选后续 |
| M | 成熟度分析模块 | M0 完成，M1 暂不默认启动 |

## 成熟度模块侧线

用户已明确本线程只推进 maturity 模块，因此以下任务作为独立侧线维护，不影响当前主线前端 Gap Check。

| 阶段 | 状态 | 当前结论 |
|---|---|---|
| M0 | 已完成 | 完成 maturity 模块需求、领域模型、数据模型、评分规则、模板设计和基础配置规划 |
| M1.1 | 已完成 | 基于 `sample 评分表.xlsx` 完成关注点级基准和安全技术服务输入建模 |
| M1.2 | 已完成 | 基于 `评估表v2.md` 完成 L2 能力级成熟度基准解析和主工程 L2 一致性核对 |
| M1.3 | 待确认 | 确认 `M-PS.CT` 是否补入 V2 L2 基准；`T-AD.SV` 已确认与当前主工程一致 |
| M2 | 待启动 | 设计 maturity 专用 SQLite 迁移草案和导入 MVP，不修改主工程核心 schema |
| M3 | 后置 | 生成正式评估模板，不实现复杂评分、图表和 UI |

## 历史归档

| 归档文件 | 内容 |
|---|---|
| `docs/05-archive/context-slimming-2026-05-15/task_plan-full-before-slimming.md` | 本文件瘦身前的完整 `task_plan.md` |
| `docs/05-archive/findings-history/2026-05.md` | 2026-05 历史发现 |
| `docs/05-archive/progress-history/2026-05.md` | 2026-05 完整执行记录 |

## 维护规则

- 本文件只保留当前阶段、下一步、禁止事项和历史索引。
- 已完成阶段、长列表、导出文件清单、历史错误和详细过程不再继续写入本文件。
- 需要恢复完整上下文时，再读取归档文件。
