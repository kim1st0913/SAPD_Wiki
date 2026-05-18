# Progress: SAPD 工作知识库系统

本文档只保留最近记录和历史索引。完整执行历史已迁入 `docs/05-archive/`，避免主控 Agent 每次恢复时加载过大上下文。

## 恢复入口

- 快速当前状态：`CURRENT_STATE.md`
- 当前计划入口：`task_plan.md`
- 当前关键决策：`findings.md`
- 统一问题清单：`docs/06-implementation/open-issues.md`
- 主控轻量恢复说明：`docs/00-overview/master-context-restore.md`
- 完整历史进度归档：`docs/05-archive/progress-history/2026-05.md`

## 当前状态摘要

- 当前主线：已导入 Sheet 的业务含义复核 + 前端关系展示校正。
- Frontend Baseline 1.0 范围已修正为三页：`安全能力映射`、`LC-AP开发安全生命周期`、`信息化环境维度`。
- 成熟度分析模块当前处于 M0 文档和配置规划完成状态；M1 不应在主线优先级确认前启动。
- 后续开工默认读取 `AGENTS.md` + `CURRENT_STATE.md`，按任务需要再读取 `task_plan.md`、`findings.md`、`progress.md` 和相关 docs。

## 最近记录

### 2026-05-17 F3-GRAPH-P2 Radial Star Network Graph Refinement

任务：用户提供 `f3-graph-p2-radial-star-network-refinement.md`，并明确要求 `本地关联摘要` 以能力-关注点作为唯一中心锚点，`技术视角`、`管理视角`、`标准 / 框架映射` 星形分散；无数据业务节点不显示；管理视角先分为 `安全职能`、`安全工作`、`流程` 三个结构节点；安全职能下展示 `决策层`、`管理层`、`执行层`、`监督层`；流程按 `L2 -> L3 -> L4` 展开；技术视角按 `作用域 -> 安全技术服务` 展开；不再使用 `技术路径` / `管理路径` 命名。

本次调整：

- 更新 `frontend/capability-browser/models/relationGraphModel.js`，将本地关系图模型调整为 `current_focus -> view_technical / view_management / view_standard` 的星形分支结构。
- 更新 `frontend/capability-browser/models/relationGraphModel.js`，技术视角节点严格来自技术矩阵同源数据，按 `技术视角 -> 作用域 -> 安全技术服务 -> 技术模块 / 技术措施` 展开；没有真实模块 / 措施数据时不生成业务节点。
- 更新 `frontend/capability-browser/models/relationGraphModel.js`，管理视角节点严格来自管理矩阵同源数据，先展开 `安全职能`、`安全工作`、`流程` 三个结构节点；安全职能下固定展示 `决策层`、`管理层`、`执行层`、`监督层` 四类层级节点，再挂载真实安全职能；流程按真实 `L2流程组 -> L3流程 -> L4活动` 展开，无真实 L4 时不生成假节点。
- 更新 `frontend/capability-browser/models/relationGraphModel.js`，标准 / 框架映射保留一级分支和轻量 `待投影` 状态，不伪造标准、条款或控制项。
- 更新 `frontend/capability-browser/components/LocalRelationNetworkGraph.js`，将 SVG 布局调整为径向星形关系图：当前能力-关注点为唯一中心，三个视角分支在画布中分散展开，管理视角内部再形成安全职能 / 安全工作 / 流程三支树枝。
- 更新 `frontend/capability-browser/components/LocalRelationNetworkGraph.js`，压缩业务节点文案和尺寸，减少节点重叠；背景装饰网络继续保留，但不参与业务语义和统计。
- 更新 `frontend/capability-browser/styles.css`，补充 `view_technical`、`view_management`、`view_standard`、`management_function_root`、`management_work_root`、`management_process_root`、`security_function_layer`、`technical_module`、`technical_measure` 等节点样式，以及新的视角边 / 管理结构边样式。

验证：

- `node --check frontend/capability-browser/models/relationGraphModel.js` 通过。
- `node --check frontend/capability-browser/components/LocalRelationNetworkGraph.js` 通过。
- `node --check frontend/capability-browser/components/CapabilityLocalRelationMap.js` 通过。
- `node --check frontend/capability-browser/app.js` 通过。
- `node --check frontend/capability-browser/components/FocusScopeServiceMatrix.js` 通过。
- `node --check frontend/capability-browser/components/FocusManagementMapping.js` 通过。
- `node --check frontend/capability-browser/dataClient.js` 通过。
- 浏览器验证 `本地关联摘要` 仍为默认 Tab，`.local-relation-network-graph svg` 正常渲染。
- 浏览器验证当前中心节点数量为 1，`技术视角`、`管理视角`、`标准 / 框架映射` 三个视角节点均存在。
- 浏览器验证管理视角包含 `安全职能`、`安全工作`、`流程` 三个结构节点；安全职能层级包含 `决策层`、`管理层`、`执行层`、`监督层`。
- 浏览器验证技术视角包含 6 个作用域节点和 6 个安全技术服务节点；管理视角包含 1 个安全工作、9 个安全职能、1 个 L2 流程组、1 个 L3 流程；当前数据无真实 L4 活动，因此 `processL4=0`。
- 浏览器验证无业务空状态节点堆叠，`emptyStateNodes=0`；标准 / 框架映射仅保留轻量 `待投影` 状态。
- 浏览器验证 `技术视角` Tab 仍为原 `FocusScopeServiceMatrix`，当前 6 行；`管理视角` Tab 仍为原 `FocusManagementMapping`，四类职能桶仍存在。
- 浏览器验证 `信息化环境安全能力映射`、`开发安全`、`数据安全` 入口可切换。
- 浏览器验证主展示区未发现 `技术路径`、`管理路径`、`映射状态`、`映射说明`、`成熟度`、`证据数`、`sheet`、`row`、`column`、`raw_value`、`source_file`、`import_id`、`source_id`、`source_ref`、`source_label`、`debug`、`raw`、`metadata`、`intermediate`、`generated_at`。
- 已生成截图：`/private/tmp/sapd-wiki-f3-graph-p2-radial-star-1440.png`、`/private/tmp/sapd-wiki-f3-graph-p2-radial-star-1920.png`。
- 本轮未修改 ETL、数据库、数据模型、导出 JSON、workbench JSON、`dataClient` 数据来源边界，未引入新依赖。

### 2026-05-17 F3-GRAPH-P1-V2 Local Relation Network Graph with Source-Aligned Projection

任务：用户提供 `f3-graph-p1-v2-local-relation-network-graph.md`，要求把 `安全能力映射` 页默认 `本地关联摘要` 从 HTML 卡片 / 分支卡片升级为原生 SVG 本地关联网络图，同时保持技术视角矩阵、管理视角矩阵和标准 / 框架映射 Tab 不受影响。

诊断结论：

- `本地关联摘要` 当前由 `CapabilityLocalRelationMap.render()` 渲染，输入来自 `app.js` 传入的 `viewModel.localRelationMap`、`viewModel.technicalMappingRows`、`viewModel.managementMappingRows`。
- `技术视角` Tab 当前调用 `FocusScopeServiceMatrix.render({ rows })`，数据来自同一个 `viewModel.technicalMappingRows`。
- `管理视角` Tab 当前调用 `FocusManagementMapping.render({ rows })`，数据来自同一个 `viewModel.managementMappingRows`。
- `viewModels.js` 已在此前收口：当 `capability-workbench.json` 行投影可用时，`localRelationMap` 由当前关注点的 `detailTechnicalRows` / `detailManagementRows` 构建；摘要图与矩阵 Tab 为同源投影的不同展示形式。
- `frontend/capability-browser/public/data/capability-workbench.json` 存在，统计显示 `standard_framework=0`、`standard_control=0`，因此标准 / 框架映射仍只能展示可信空状态，不得伪造标准、条款或控制项。

本次调整：

- 新增 `frontend/capability-browser/models/relationGraphModel.js`，提供 `buildLocalRelationGraphModel()`，把当前关注点、技术矩阵 rows、管理矩阵 rows 和标准状态整理为 `nodes`、`edges`、`groups`、`stats`。
- 新增 `frontend/capability-browser/components/LocalRelationNetworkGraph.js`，使用原生 SVG 渲染本地关联网络图，不引入 D3、Cytoscape、ForceGraph 或任何新依赖。
- 更新 `frontend/capability-browser/components/CapabilityLocalRelationMap.js`，将 `本地关联摘要` Tab 替换为 `LocalRelationNetworkGraph.render({ graphModel })`；`技术视角` / `管理视角` / `标准 / 框架映射` Tabs 保持原实现。
- 更新 `frontend/capability-browser/app.js`，按顺序动态加载 `relationGraphModel.js`、`LocalRelationNetworkGraph.js`、`CapabilityLocalRelationMap.js`。
- 更新 `frontend/capability-browser/styles.css`，新增 SVG 网络图视觉：浅灰背景网络、装饰节点 / 装饰边、中心节点 halo / 呼吸效果、业务节点、业务边、hover 关联边高亮、`prefers-reduced-motion` 保护。
- 更新 `frontend/capability-browser/index.html` 资源版本参数为 `f3-graph-p1-v2-network`。

图模型说明：

- 支持节点类型：`current_focus`、`capability`、`scope`、`technical_service`、`security_work`、`security_function`、`process_l2`、`process_l3`、`process_l4`、`standard_status`、`decorative`、`empty_state`。
- 支持边类型：`focus_to_scope`、`scope_to_service`、`focus_to_work`、`work_to_function`、`function_to_process_l2`、`process_l2_to_l3`、`process_l3_to_l4`、`focus_to_standard_status`、`decorative_link`。
- 业务节点 `isDecorative=false`，参与 hover 和业务边展示；背景节点 / 边 `isDecorative=true`，只用于知识网络空间感，不参与统计、不展示业务信息、不伪造业务对象。

验证：

- `node --check frontend/capability-browser/models/relationGraphModel.js` 通过。
- `node --check frontend/capability-browser/components/LocalRelationNetworkGraph.js` 通过。
- `node --check frontend/capability-browser/components/CapabilityLocalRelationMap.js` 通过。
- `node --check frontend/capability-browser/app.js` 通过。
- `node --check frontend/capability-browser/components/FocusScopeServiceMatrix.js` 通过。
- `node --check frontend/capability-browser/components/FocusManagementMapping.js` 通过。
- `node --check frontend/capability-browser/dataClient.js` 通过。
- 浏览器验证 `安全能力映射` 页面可打开，`本地关联摘要` 仍为默认 Tab。
- 浏览器验证摘要区已渲染 `.local-relation-network-graph svg`，旧 `.summary-branch-graph` 未渲染。
- 浏览器验证当前 SVG 图包含业务节点 26 个、装饰节点 31 个、业务边 96 条、装饰边 35 条、hover 关联边 64 条。
- 浏览器验证当前关注点中心节点和 halo 存在；技术、管理、标准 / 框架映射分组标签存在。
- 浏览器验证 `技术视角` Tab 仍为原 `FocusScopeServiceMatrix`，当前 6 行。
- 浏览器验证 `管理视角` Tab 仍为原 `FocusManagementMapping`，四类职能桶仍存在且不出现 `待归类`。
- 浏览器验证 `标准 / 框架映射` Tab 仍为可信空状态。
- 浏览器验证右侧栏、独立映射矩阵明细、来源证据和待确认项未恢复。
- 浏览器验证主展示区未发现 `映射状态`、`映射说明`、`成熟度`、`证据数`、`sheet`、`row`、`column`、`raw_value`、`source_file`、`import_id`、`source_id`、`source_ref`、`source_label`、`debug`、`raw`、`metadata`、`intermediate`、`generated_at`。
- 浏览器烟测 `信息化环境安全能力映射`、`开发安全`、`数据安全` 入口可切换。
- 已生成截图：`/private/tmp/sapd-wiki-f3-graph-p1-v2-network-1440.png`、`/private/tmp/sapd-wiki-f3-graph-p1-v2-network-1920.png`。
- 本轮未修改 ETL、数据库、数据模型、导出 JSON、workbench JSON、`dataClient` 数据来源边界，未引入新依赖。

### 2026-05-17 F3-UI-P4 Local Relation Branch Graph Refinement

任务：用户提供 `f3-ui-p4-local-relation-branch-graph-refinement.md`，并补充要求：`本地关联摘要` 不再展示能力定位 / 上游能力；以当前一级能力-关注点为起始视觉锚点；不再称为 `技术路径`、`管理路径`，统一使用 `技术视角`、`管理视角`；当前能力 / 关注点节点只显示名称，不展示摘要统计。

本次调整：

- 更新 `frontend/capability-browser/components/CapabilityLocalRelationMap.js`，删除默认摘要图中的上游 / 所属能力定位区，只保留当前能力-关注点作为关系图谱起点。
- 更新 `frontend/capability-browser/components/CapabilityLocalRelationMap.js`，中心节点改为只显示当前关注点名称，不显示编码、能力路径、作用域 / 服务 / 职能 / 标准等摘要统计。
- 更新 `frontend/capability-browser/components/CapabilityLocalRelationMap.js`，将摘要图分支命名统一为 `技术视角`、`管理视角`、`标准 / 框架映射`，不再使用 `技术路径`、`管理路径` 等非用户确认名词。
- 更新 `frontend/capability-browser/styles.css`，将默认摘要区调整为更轻的分支图谱表达：中心节点保留克制 halo / 呼吸光效，右侧三条视角分支以图式连线和轻量节点承载。
- 保留 F3-UI-P3 已完成的数据投影收口：`localRelationMap` 与技术矩阵、管理矩阵继续使用同源投影，只是展示形式不同。
- 本轮未修改 ETL、数据库、数据模型、导出 JSON、workbench JSON、`dataClient` 数据来源边界。

验证：

- `node --check frontend/capability-browser/components/CapabilityLocalRelationMap.js` 通过。
- `node --check frontend/capability-browser/viewModels.js` 通过。
- `node --check scripts/f3-ui-p4-browser-check.mjs` 通过。
- 浏览器验证 `安全能力映射` 页面可打开，`本地关联摘要` 仍为默认 Tab。
- 浏览器验证摘要图存在中心能力-关注点节点，且中心节点可见文本仅为当前关注点名称；`hubStats=0`、`hubMeta=0`。
- 浏览器验证摘要图不再渲染能力定位 / 上游能力区，不再出现 `技术路径`、`管理路径`、`能力定位`、`上游能力`、`上游 / 所属能力`。
- 浏览器验证摘要图分支名称为 `技术视角`、`管理视角`、`标准 / 框架映射`。
- 浏览器验证摘要图技术视角为 6 条，技术矩阵也是 6 行。
- 浏览器验证管理视角包含 4 类职能分组，管理矩阵仍展示 `决策层`、`管理层`、`执行层`、`监督层`，且不出现 `待归类`。
- 浏览器验证标准 / 框架映射页仍是可信空状态，未伪造标准、条款或控制项。
- 浏览器验证右侧栏、来源证据、待确认项、独立 `映射矩阵明细` 未恢复。
- 浏览器验证主展示区未发现 `映射状态`、`映射说明`、`成熟度`、`证据数`、`sheet`、`row`、`column`、`raw_value`、`source_file`、`import_id`、`source_id`、`source_ref`、`source_label`、`debug`、`raw`、`metadata`、`intermediate`、`generated_at`。
- 浏览器烟测 `信息化环境安全能力映射`、`开发安全`、`数据安全` 入口可切换。
- 已生成截图：`/private/tmp/sapd-wiki-f3-ui-p4-branch-graph-1440.png`、`/private/tmp/sapd-wiki-f3-ui-p4-branch-graph-1920.png`。

### 2026-05-17 F3-UI-P3 Anchor Graph Visual Upgrade and Relation Projection Correction

任务：用户提供 `f3-ui-p3-anchor-graph-visual-upgrade-and-projection-correction.md`，要求继续升级安全能力映射页默认 `本地关联摘要`，并纠正技术路径、管理路径与矩阵 Tab 数据来源不一致的问题。

关键澄清：

- `本地关联摘要` 和 `技术视角 / 管理视角` 矩阵不应是不同数据源；它们应是同一批当前关注点投影数据的不同展示形式。
- 本轮已在 ViewModel 层收口：当矩阵行来自 `capability-workbench.json` 时，`localRelationMap` 也由同一批 `detailTechnicalRows` / `detailManagementRows` 构建；只有矩阵也来自 `capabilityProjection` 时，才使用 `capabilityProjection.localRelationMap`。
- 组件层不再用矩阵行临时覆盖摘要图，而是消费同源生成后的 `localRelationMap`，将其展示为图式总览。

本次调整：

- 更新 `frontend/capability-browser/viewModels.js`，修正 `localRelationMap` 的来源优先级，避免摘要图和矩阵 Tab 分别消费不同投影。
- 更新 `frontend/capability-browser/viewModels.js`，为 workbench 行投影补充 `buildLocalProcessTreeFromManagementRows()`，保证管理路径的 L2 / L3 / L4 状态来自当前管理矩阵同源数据。
- 更新 `frontend/capability-browser/components/CapabilityLocalRelationMap.js`，摘要图继续消费 `localRelationMap`，但将其展示为 `能力定位 -> 当前关注点锚点 -> 技术路径 / 管理路径 / 标准框架状态` 的图式总览。
- 更新 `frontend/capability-browser/styles.css`，为当前关注点核心节点增加空间感卡片、低饱和 halo、克制呼吸光效，并加入 `prefers-reduced-motion` 保护。
- 更新 `frontend/capability-browser/index.html` 和 `frontend/capability-browser/app.js` 资源版本参数为 `f3-ui-p3-anchor-graph`。

验证：

- `node --check frontend/capability-browser/components/CapabilityLocalRelationMap.js` 通过。
- `node --check frontend/capability-browser/viewModels.js` 通过。
- `node --check frontend/capability-browser/app.js` 通过。
- `node --check frontend/capability-browser/components/FocusScopeServiceMatrix.js` 通过。
- `node --check frontend/capability-browser/components/FocusManagementMapping.js` 通过。
- `node --check frontend/capability-browser/components/AppShell.js` 通过。
- `node --check frontend/capability-browser/components/FocusOverview.js` 通过。
- `node --check frontend/capability-browser/dataClient.js` 通过。
- 浏览器验证 `安全能力映射` 页面可打开，`本地关联摘要` 仍为默认 Tab。
- 浏览器验证摘要图存在当前关注点锚点、halo、技术路径、管理路径、标准 / 框架状态。
- 浏览器验证摘要图技术路径为 6 条，技术矩阵也是 6 行。
- 浏览器验证摘要图管理路径包含 4 类职能分组，管理矩阵表头与四类职能桶仍存在，且不出现 `待归类`。
- 浏览器验证标准 / 框架状态为 `无直接投影 / 待投影`，未伪造标准、条款或控制项。
- 浏览器验证右侧栏、来源证据、待确认项、独立 `映射矩阵明细` 未恢复。
- 浏览器验证能力工作台主展示区未发现 `映射状态`、`映射说明`、`成熟度`、`证据数`、`sheet`、`row`、`column`、`raw_value`、`source_file`、`import_id`、`source_id`、`source_ref`、`source_label`、`debug`、`raw`、`metadata`、`intermediate`、`generated_at`。
- 浏览器烟测 `信息化环境安全能力映射`、`开发安全`、`数据安全` 入口可切换。
- 已生成截图：`/private/tmp/sapd-wiki-f3-ui-p3-anchor-graph-1440.png`、`/private/tmp/sapd-wiki-f3-ui-p3-anchor-graph-1920.png`。
- 本轮未修改 ETL、数据库、数据模型、导出 JSON、workbench JSON、`dataClient` 数据来源边界。

### 2026-05-17 F3-UI-P2 Local Relation Graph Advanced Visual Upgrade

任务：用户提供 `f3-ui-p2-local-relation-graph-advanced-visual-upgrade.md`，要求只升级安全能力映射页默认 `本地关联摘要` 关系图，不重做 Application Shell、不改数据链路、不改技术 / 管理矩阵内容。

本次调整：

- 更新 `frontend/capability-browser/components/CapabilityLocalRelationMap.js`，将默认摘要图调整为 `能力定位 -> 当前关注点核心 -> 技术 / 管理 / 标准路径` 的中心枢纽式结构。
- 新增当前关注点核心节点渲染，突出关注点名称、编码、所属能力和轻量标签。
- 左侧定位区展示上游能力 / 所属能力 / 能力路径，作为当前关注点的业务定位。
- 右侧路径区继续在同一张局部关系图中展示 `技术路径`、`管理路径`、`标准 / 框架状态`，不拆回底部独立区块。
- 更新 `frontend/capability-browser/styles.css`，补充中心节点、定位分区、路径分区、连接线、hover 高亮和 1440px / 1920px 响应式样式。
- 更新 `frontend/capability-browser/index.html` 与 `frontend/capability-browser/app.js` 资源版本参数为 `f3-ui-p2-local-relation-graph`，避免浏览器缓存旧关系图样式。

验证：

- `node --check frontend/capability-browser/components/CapabilityLocalRelationMap.js` 通过。
- `node --check frontend/capability-browser/app.js` 通过。
- `node --check frontend/capability-browser/viewModels.js` 通过。
- `node --check frontend/capability-browser/components/FocusScopeServiceMatrix.js` 通过。
- `node --check frontend/capability-browser/components/FocusManagementMapping.js` 通过。
- `node --check frontend/capability-browser/components/AppShell.js` 通过。
- `node --check frontend/capability-browser/components/FocusOverview.js` 通过。
- `node --check frontend/capability-browser/dataClient.js` 通过。
- 浏览器验证 `安全能力映射` 页面可打开，`本地关联摘要` 仍为默认 Tab。
- 浏览器验证摘要图存在 `.summary-core-map`、`.summary-origin-zone`、`.summary-hub-card`、`.summary-path-board` 和 2 条方向连接线。
- 浏览器验证同一关系图内展示 `技术路径`、`管理路径`、`标准 / 框架状态`。
- 浏览器验证 `技术视角` 和 `管理视角` 仍保留原矩阵组件，表头未被破坏。
- 浏览器验证右侧栏、来源证据、待确认项和独立 `映射矩阵明细` 未恢复。
- 浏览器验证能力工作台主展示区未发现 `映射状态`、`映射说明`、`成熟度`、`证据数`、`sheet`、`row`、`column`、`raw_value`、`source_file`、`import_id`、`source_id`、`source_ref`、`source_label`、`debug`、`raw`、`metadata`、`intermediate`、`generated_at`。
- 浏览器烟测 `信息化环境安全能力映射`、`开发安全`、`数据安全` 入口可切换。
- 已生成截图：`/private/tmp/sapd-wiki-f3-ui-p2-local-relation-graph-1440.png`、`/private/tmp/sapd-wiki-f3-ui-p2-local-relation-graph-1920.png`。
- 本轮未修改 ETL、数据库、数据模型、导出 JSON、workbench JSON、`dataClient` 数据来源边界或 ViewModel 业务逻辑。

### 2026-05-17 F3-DIAG-UI-P1 Management Projection Diagnosis and Local Relation View Refinement

任务：用户提供 `f3-diag-ui-p1-management-projection-and-local-relation-prompt.md`，要求先诊断管理视角投影中“待归类”来源，再优化默认 `本地关联摘要` 关系展示和原技术 / 管理矩阵视觉。

诊断结论：

- `managementMappingRows` 来自 `frontend/capability-browser/public/data/capability-workbench.json`，由 `viewModels.js` 的 `buildCapabilityManagementRowsFromWorkbench()` 生成；当 workbench 数据存在时，不走 `management-knowledge.json` 的旧 fallback。
- 每行字段包括：`id`、`focus`、`securityWorks`、`stakeholders`、`processGroups`、`processReferences`、`activities`、`hasMissingActivity`、`dataSource`。
- workbench JSON 中 `work_function` 对象存在真实 `layer` 字段，四类安全职能为 `决策层`、`管理层`、`执行层`、`监督层`。
- “待归类”不是 ETL 缺失，也不是 workbench JSON 缺失，而是 `viewModels.js` 的 `workbenchEntity()` 展示投影未保留 `layer` / `layerLabel` / `group`，导致管理矩阵前端分桶时读不到层级。
- 问题分类为 B：ViewModel 展示投影丢字段；本轮已在 ViewModel 展示实体中保留职能层级字段，不改变 `dataClient` 数据来源边界，不新增业务推断。
- L2 / L3 流程数据存在；当前 `capability-workbench.json` 中 `process_activity` 为 0，未提供 L4 活动直接投影，因此 UI 继续以轻量 `待补充` 展示，不编造 L4。
- 标准 / 框架映射对象当前为空，继续保留可信空状态。

本次调整：

- 更新 `frontend/capability-browser/viewModels.js`，在 `workbenchEntity()` 中保留 `layer`、`layerLabel`、`group` 三个展示投影字段，用于管理视角四类职能分桶。
- 更新 `frontend/capability-browser/components/CapabilityLocalRelationMap.js`，将默认 `本地关联摘要` 重构为一张以当前能力 / 关注点为中心的整合关系图，同时展示技术路径、管理路径和标准 / 框架投影状态；不再在摘要 Tab 底部追加分离的关联列。
- 更新 `frontend/capability-browser/components/FocusManagementMapping.js`，为空职能层级补充轻量 `is-empty` 状态。
- 更新 `frontend/capability-browser/styles.css`，优化原技术 / 管理矩阵在 Tab 内的密度、列宽、职能分桶和默认摘要关系图的节点、连线、分组样式。
- 更新 `frontend/capability-browser/index.html` 与 `frontend/capability-browser/app.js` 的资源版本参数为 `f3-diag-ui-p1-local-relation`，确保浏览器读取最新组件和 ViewModel。

验证：

- `node --check frontend/capability-browser/viewModels.js` 通过。
- `node --check frontend/capability-browser/components/CapabilityLocalRelationMap.js` 通过。
- `node --check frontend/capability-browser/components/FocusManagementMapping.js` 通过。
- `node --check frontend/capability-browser/components/FocusScopeServiceMatrix.js` 通过。
- `node --check frontend/capability-browser/app.js` 通过。
- `node --check frontend/capability-browser/components/AppShell.js` 通过。
- `node --check frontend/capability-browser/components/FocusOverview.js` 通过。
- `node --check frontend/capability-browser/dataClient.js` 通过。
- 浏览器验证 `安全能力映射` 页面可打开，默认 Tab 为 `本地关联摘要`。
- 浏览器验证默认摘要存在统一 `.summary-core-map`，包含 `技术路径`、`管理路径`、`标准 / 框架状态`，且摘要区不再渲染 `.summary-related-columns`。
- 浏览器验证技术视角保留原矩阵组件，表头为 `作用域`、`安全技术服务`、`技术模块/措施`，不显示 `成熟度`、`证据数`、`映射状态`、`映射说明`。
- 浏览器验证管理视角保留原矩阵组件，表头为 `安全工作`、`安全职能`、`L2 流程组`、`L3 流程`、`L4 关键活动`；`安全职能` 不再出现 `待归类`，四类职能按层级分桶展示。
- 浏览器验证标准 / 框架映射 Tab 存在可信空状态。
- 浏览器验证能力工作台内部不再出现右侧洞察栏或独立 `映射矩阵明细` 抽屉。
- 浏览器验证主展示区未发现 `sheet`、`row`、`column`、`raw_value`、`source_file`、`import_id`、`source_id`、`source_ref`、`source_label`、`debug`、`raw`、`metadata`、`intermediate`、`generated_at`。
- 浏览器烟测 `信息化环境安全能力映射`、`开发安全`、`数据安全` 入口可切换。
- 已生成截图：`/private/tmp/sapd-wiki-f3-diag-ui-p1-local-relation-1440.png`、`/private/tmp/sapd-wiki-f3-diag-ui-p1-local-relation-1920.png`。
- 本轮未修改 ETL、数据库、数据模型、导出 JSON、workbench JSON、`dataClient` 数据来源边界或 ViewModel 业务逻辑。

### 2026-05-17 F3-RECOVERY-P1 Restore Original Mapping Matrix Implementation

任务：用户提供 `f3-recovery-p1-restore-original-mapping-matrix.md`，要求停止继续自由生成简化表格，先溯源找回原“技术视角映射矩阵 / 管理视角映射矩阵”，再迁移到对应 Tab。

溯源判断：

- 已找到原技术视角映射矩阵实现：`frontend/capability-browser/components/FocusScopeServiceMatrix.js`，函数 `render({ rows })`，历史 commit `a891d34` 和当前工作树均存在。
- 已找到原管理视角映射矩阵实现：`frontend/capability-browser/components/FocusManagementMapping.js`，函数 `render({ rows })`，历史 commit `a891d34` 和当前工作树均存在。
- 当前版本此前没有恢复成功的原因：独立 `映射矩阵明细` 抽屉被删除后，`CapabilityLocalRelationMap.js` 在 Tab 内重新生成了简化 `preview-mapping-table`，没有调用原矩阵组件。

本次调整：

- 更新 `frontend/capability-browser/app.js`，将 `technicalMappingRows` 和 `managementMappingRows` 传入 `CapabilityLocalRelationMap.render()`。
- 更新 `frontend/capability-browser/components/CapabilityLocalRelationMap.js`，在 `技术视角` Tab 中调用 `FocusScopeServiceMatrix.render({ rows })`，在 `管理视角` Tab 中调用 `FocusManagementMapping.render({ rows })`。
- 保留当前 IA：`本地关联摘要` 仍为默认 Tab，`技术视角`、`管理视角`、`标准 / 框架映射` 为同级 Tab。
- 继续删除右侧整列区域，未恢复 `待确认项`、`来源证据` 或独立 `映射矩阵明细` 折叠区。
- 更新 `frontend/capability-browser/components/FocusManagementMapping.js`，在原管理矩阵的 `安全职能` 单元格内补充四类职能桶：`决策层`、`管理层`、`执行层`、`监督层`；无归类数据时显示轻量空状态，未编造业务事实。
- 更新 `frontend/capability-browser/styles.css`，让原矩阵组件在 Tab 面板内占满可用空间，并补充四类职能桶样式。
- 更新 `frontend/capability-browser/index.html` 和 `app.js` 的资源版本参数为 `f3-recovery-p1-original-matrix`。

验证：

- 已执行 prompt 要求的 `git status`、三个目标文件 diff、两个目标文件 git log、`git stash list` 和全仓矩阵关键词搜索。
- `node --check frontend/capability-browser/components/CapabilityLocalRelationMap.js` 通过。
- `node --check frontend/capability-browser/components/FocusManagementMapping.js` 通过。
- `node --check frontend/capability-browser/components/FocusScopeServiceMatrix.js` 通过。
- `node --check frontend/capability-browser/app.js` 通过。
- `node --check frontend/capability-browser/components/AppShell.js` 通过。
- `node --check frontend/capability-browser/components/FocusOverview.js` 通过。
- `node --check frontend/capability-browser/viewModels.js` 通过。
- 浏览器验证 `安全能力映射` 页面可打开，默认 `本地关联摘要` 仍为 checked。
- 浏览器验证 `技术视角` Tab 中存在原 `.technical-mapping-section` 和 `.semantic-mapping-table`，不存在 `.preview-mapping-table`，表头为 `作用域`、`安全技术服务`、`技术模块/措施`。
- 浏览器验证 `管理视角` Tab 中存在原 `.management-mapping-section` 和 `.semantic-mapping-table`，不存在 `.preview-mapping-table`，表头为 `安全工作`、`安全职能`、`L2 流程组`、`L3 流程`、`L4 关键活动`。
- 浏览器验证右侧栏 DOM 不存在，独立 `映射矩阵明细` 抽屉不存在。
- 浏览器验证安全能力映射工作台主展示区未发现 `映射状态`、`映射说明`、`成熟度`、`证据数`、`sheet`、`row`、`column`、`raw_value`、`source_file`、`import_id`、`source_id`、`source_ref`、`source_label`、`debug`、`raw`、`metadata`、`intermediate`、`generated_at`。
- 浏览器验证 `信息化环境安全能力映射`、`开发安全`、`数据安全` 入口仍可打开，控制台 error 日志为空。
- 已生成截图：`/private/tmp/sapd-wiki-f3-recovery-p1-original-matrix-1440.png`、`/private/tmp/sapd-wiki-f3-recovery-p1-original-matrix-1920.png`。
- 本轮未修改 ETL、数据库、数据模型、导出 JSON、workbench JSON、`dataClient` 数据来源边界或 ViewModel 业务逻辑。

### 2026-05-17 F3-IMPL-P1R5 Remove Right Panel and Restore Matrix Tabs

任务：用户提供 `f3-impl-p1r5-remove-right-panel-restore-matrix-tabs.md`，要求删除安全能力映射工作台右侧整列区域，中央工作区填满原右侧空间，并将右侧统计摘要迁移到当前关注点摘要区。

本次调整：

- 更新 `frontend/capability-browser/components/CapabilityLocalRelationMap.js`，删除右侧独立洞察栏渲染入口，不再展示 `关联模块清单`、`统计摘要`、`待确认项`、`来源证据`。
- 将统计信息迁移到当前关注点摘要区，展示为轻量 chips：`作用域`、`服务`、`安全工作`、`职能`、`L2/L3/L4`、`标准`。
- 保留四个同级 Tabs：`本地关联摘要`、`技术视角`、`管理视角`、`标准 / 框架映射`，并保持 `本地关联摘要` 默认打开。
- 技术视角 Tab 保留 `技术视角映射矩阵`，字段只展示 `作用域`、`安全技术服务`。
- 管理视角 Tab 保留 `管理视角映射矩阵`，字段展示 `安全工作`、`安全职能`、`L2流程组`、`L3流程`、`L4活动`，其中 `安全职能` 内部分四类展示。
- 标准 / 框架映射 Tab 保留可信空状态，不伪造标准、条款或控制项。
- 更新 `frontend/capability-browser/styles.css`，将工作台网格从双列改为单列，中央工作区占满原右侧空间，并补充矩阵面板标题区和摘要统计 chips 样式。
- 更新 `frontend/capability-browser/index.html` 和 `frontend/capability-browser/app.js` 的资源版本参数为 `f3-impl-p1r5-no-right-panel`。

验证：

- `node --check frontend/capability-browser/components/CapabilityLocalRelationMap.js` 通过。
- `node --check frontend/capability-browser/app.js` 通过。
- `node --check frontend/capability-browser/components/AppShell.js` 通过。
- `node --check frontend/capability-browser/components/FocusOverview.js` 通过。
- `node --check frontend/capability-browser/viewModels.js` 通过。
- `node --check frontend/capability-browser/dataClient.js` 通过。
- `git diff --check` 通过。
- 浏览器验证 `安全能力映射` 页面可打开，默认选中 `本地关联摘要`。
- 浏览器验证右侧栏 DOM 不存在，且安全能力映射组件内不显示 `关联模块清单`、`统计摘要`、`待确认项`、`来源证据`。
- 浏览器验证摘要区显示迁移后的轻量统计：作用域、服务、安全工作、职能、L2/L3/L4、标准投影状态。
- 浏览器验证独立 `映射矩阵明细` 区域不存在。
- 浏览器验证技术视角矩阵表头为 `作用域`、`安全技术服务`。
- 浏览器验证管理视角矩阵表头为 `安全工作`、`安全职能`、`L2流程组`、`L3流程`、`L4活动`，四类安全职能均显示。
- 浏览器验证 1920px 下中央工作区宽度扩展到原右侧空间，`preview-relation-stage` 宽度约 1290px。
- 浏览器验证 `信息化环境安全能力映射`、`开发安全`、`数据安全` 入口可打开，控制台 error 日志为空。
- 安全能力映射工作台组件范围内未发现 `映射状态`、`映射说明`、`成熟度`、`证据数`、`source_file`、`source_id`、`debug`、`raw`、`metadata`、`generated_at` 等主展示字段泄露。
- 已生成截图：`/private/tmp/sapd-wiki-f3-impl-p1r5-no-right-panel-1440.png`、`/private/tmp/sapd-wiki-f3-impl-p1r5-no-right-panel-1920.png`。
- 本轮未修改 ETL、数据库、数据模型、导出 JSON、workbench JSON、`dataClient` 数据来源边界或 ViewModel 业务逻辑。

### 2026-05-17 F3-IMPL-P1R4 Workbench Tab IA Rebuild, Matrix Migration and Field Semantic Correction

任务：用户提供 `f3-impl-p1r4-workbench-tab-ia-matrix-migration-prompt.md`，要求按提示词收口安全能力映射工作台：以视角 Tab 驱动页面信息架构，迁移原“映射矩阵明细”有效内容，并校正字段语义。

本次调整：

- 更新 `frontend/capability-browser/components/CapabilityLocalRelationMap.js`，保持 `本地关联摘要` 作为默认 Tab，并保留 `技术视角`、`管理视角`、`标准 / 框架映射` 同级 Tabs。
- 技术视角 Tab 仅展示迁移后的技术视角映射矩阵，字段只保留 `作用域`、`安全技术服务`。
- 管理视角 Tab 仅展示迁移后的管理视角映射矩阵，字段调整为 `安全工作`、`安全职能`、`L2流程组`、`L3流程`、`L4活动`。
- `安全职能` 单元格内按四类展示：`决策层`、`管理层`、`执行层`、`监督层`；无关联时显示轻量空状态，不编造数据。
- 标准 / 框架映射 Tab 保留可信空状态，当前不伪造标准、条款或控制项映射。
- 从 `frontend/capability-browser/app.js` 删除独立 `映射矩阵明细` 折叠区调用，并移除未使用的独立矩阵 / 来源证据抽屉函数。
- 从安全能力映射主展示区移除独立 `当前关注点局部关系说明` 追加区，避免 Tab 工作台后继续纵向堆叠说明卡片。
- 更新 `frontend/capability-browser/styles.css`，补充管理视角五列矩阵和四类职能单元格样式。
- 更新 `frontend/capability-browser/index.html` 和 `frontend/capability-browser/app.js` 的资源版本参数为 `f3-impl-p1r4-tab-ia`。

验证：

- `node --check frontend/capability-browser/components/CapabilityLocalRelationMap.js` 通过。
- `node --check frontend/capability-browser/app.js` 通过。
- `node --check frontend/capability-browser/components/AppShell.js` 通过。
- `node --check frontend/capability-browser/components/FocusOverview.js` 通过。
- `node --check frontend/capability-browser/viewModels.js` 通过。
- `node --check frontend/capability-browser/dataClient.js` 通过。
- `git diff --check` 通过。
- 浏览器验证 `安全能力映射` 页面可打开，默认选中 `本地关联摘要`。
- 浏览器验证 Tabs 列表为 `本地关联摘要`、`技术视角`、`管理视角`、`标准 / 框架映射`。
- 浏览器验证页面中不再显示独立 `映射矩阵明细` 区域。
- 浏览器验证页面中不再显示独立 `当前关注点局部关系说明` 追加区。
- 浏览器验证技术视角矩阵表头为 `作用域`、`安全技术服务`，不含 `关联模块`、`关联措施`、`安全技术模块`、`安全技术措施`。
- 浏览器验证管理视角矩阵表头为 `安全工作`、`安全职能`、`L2流程组`、`L3流程`、`L4活动`，且 `安全职能` 内展示四类职能。
- 浏览器验证标准 / 框架映射显示可信空状态，不伪造标准 / 控制项数据。
- 浏览器验证右侧只保留 `关联模块清单` 和 `统计摘要`，不显示 `待确认项` 和 `来源证据`。
- 浏览器验证 `信息化环境安全能力映射`、`开发安全`、`数据安全` 入口可打开，控制台 error 日志为空。
- 安全能力映射工作台组件范围内未发现 `映射状态`、`映射说明`、`成熟度`、`证据数`、`流程层级`、`流程名称`、`待确认项`、`来源证据` 等主展示字段泄露。
- 已生成截图：`/private/tmp/sapd-wiki-f3-impl-p1r4-tab-ia-1440.png`、`/private/tmp/sapd-wiki-f3-impl-p1r4-tab-ia-1920.png`。
- 本轮未修改 ETL、数据库、数据模型、导出 JSON、workbench JSON、`dataClient` 数据来源边界或 ViewModel 业务逻辑。

### 2026-05-17 F3-IMPL-P1R5 Local Relation Summary Default Tab

任务：用户反馈安全能力映射页中间区域仍然拥挤，建议把“本地关联摘要”也改成与 `技术视角`、`管理视角`、`标准 / 框架映射` 同级的切换页，并在点进能力 / 关注点后默认先显示本地关联摘要。

本次调整：

- 更新 `frontend/capability-browser/components/CapabilityLocalRelationMap.js`，新增默认 `本地关联摘要` 页签。
- 将 `本地关联摘要` 从 `技术视角`、`管理视角`、`标准 / 框架映射` 三个面板中移出，避免映射清单和关系摘要在同一中间区域挤压。
- 保留三视角 Tabs：`技术视角`、`管理视角`、`标准 / 框架映射`。
- 保留右侧 `关联模块清单` 和轻量 `统计摘要`。
- 更新 `frontend/capability-browser/styles.css`，补充默认摘要页签的选中态和面板显示规则。
- 更新 `frontend/capability-browser/index.html` 和 `frontend/capability-browser/app.js` 的资源版本参数为 `f3-impl-p1r5`。

验证：

- `node --check frontend/capability-browser/components/CapabilityLocalRelationMap.js` 通过。
- `node --check frontend/capability-browser/app.js` 通过。
- `node --check frontend/capability-browser/components/AppShell.js` 通过。
- `node --check frontend/capability-browser/components/FocusOverview.js` 通过。
- `node --check frontend/capability-browser/viewModels.js` 通过。
- `node --check frontend/capability-browser/dataClient.js` 通过。
- `git diff --check` 通过。
- 浏览器验证 `安全能力映射` 页面可打开，默认选中 `本地关联摘要`，默认面板中不显示映射清单。
- 浏览器验证 `技术视角` 表头为 `作用域`、`安全技术服务`，面板内不再重复显示 `本地关联摘要`。
- 浏览器验证 `管理视角` 表头为 `安全工作`、四类安全职能、`L2流程组`、`L3流程`、`L4活动`，面板内不再重复显示 `本地关联摘要`。
- 浏览器验证 `标准 / 框架映射` 页签保留可信空状态，面板内不再重复显示 `本地关联摘要`。
- 浏览器验证 `信息化环境安全能力映射`、`开发安全`、`数据安全` 入口可打开，控制台 error 日志为空。
- 安全能力映射工作台组件范围内未发现 `映射状态`、`映射说明`、`成熟度`、`证据数`、`待确认项`、`来源证据` 等主展示字段泄露。
- 已生成截图：`/private/tmp/sapd-wiki-f3-impl-p1r5-summary-tab-1440.png`、`/private/tmp/sapd-wiki-f3-impl-p1r5-summary-tab-1920.png`。
- 本轮未修改 ETL、数据库、数据模型、导出 JSON、workbench JSON、`dataClient` 数据来源边界或 ViewModel 业务逻辑。

### 2026-05-17 F3-IMPL-P1R4 Mapping List Semantic Correction

任务：用户要求在保留 F3-IMPL-P1R3 页面结构的前提下，只校正映射清单字段语义，不重做整体页面结构、关系图或 Application Shell。

本次调整：

- 更新 `frontend/capability-browser/components/CapabilityLocalRelationMap.js`，删除主映射清单中的 `映射状态`、`映射说明`、`成熟度`、`证据数` 等非安全能力映射主链路字段。
- 技术视角映射清单只保留 `作用域` 和 `安全技术服务` 两列，不再把安全技术模块 / 安全技术措施作为主清单列。
- 管理视角映射清单改为 `安全工作`、`决策层职能`、`管理层职能`、`执行层职能`、`监督层职能`、`L2流程组`、`L3流程`、`L4活动`。
- 标准 / 框架映射页签保留；当前无直接标准控制项投影时仍显示可信空状态，不伪造映射。
- 更新 `frontend/capability-browser/styles.css`，补充 F3-IMPL-P1R4 表格列宽和管理视角宽表样式。
- 更新 `frontend/capability-browser/index.html` 和 `frontend/capability-browser/app.js` 的资源版本参数为 `f3-impl-p1r4`。

验证：

- `node --check frontend/capability-browser/components/CapabilityLocalRelationMap.js` 通过。
- `node --check frontend/capability-browser/app.js` 通过。
- `node --check frontend/capability-browser/components/AppShell.js` 通过。
- `node --check frontend/capability-browser/components/FocusOverview.js` 通过。
- `node --check frontend/capability-browser/viewModels.js` 通过。
- `node --check frontend/capability-browser/dataClient.js` 通过。
- `git diff --check` 通过。
- 浏览器验证 `安全能力映射` 页面可打开，能力目录可选择关注点，本地关联摘要和三视角 Tabs 保留。
- 浏览器验证技术视角表头为 `作用域`、`安全技术服务`，不含 `关联模块`、`关联措施`、`映射状态`、`映射说明`。
- 浏览器验证管理视角表头为 `安全工作`、四类安全职能、`L2流程组`、`L3流程`、`L4活动`。
- 浏览器验证标准 / 框架映射显示可信空状态，且不伪造标准 / 控制项数据。
- 浏览器验证 `信息化环境安全能力映射`、`开发安全`、`数据安全` 入口可打开，控制台 error 日志为空。
- 主展示区字段边界检查通过，未发现 `sheet`、`row`、`column`、`raw_value`、`source_file`、`import_id`、`source_id`、`debug`、`raw`、`metadata`、`generated_at` 等非业务字段。
- 已生成截图：`/private/tmp/sapd-wiki-f3-impl-p1r4-capability-1440.png`、`/private/tmp/sapd-wiki-f3-impl-p1r4-capability-1920.png`。
- 本轮未修改 ETL、数据库、数据模型、导出 JSON、workbench JSON、`dataClient` 数据来源边界或 ViewModel 业务逻辑。

### 2026-05-17 F3-IMPL-P1R3 Mapping List Field Correction and Right Panel Cleanup

任务：用户确认 F3-IMPL-P1R2 结构基本通过，但要求继续收口两个问题：校正上方映射清单字段，删除右侧 `待确认项` 和 `来源证据`。

本次调整：

- 更新 `frontend/capability-browser/components/CapabilityLocalRelationMap.js`，将映射清单改为按三种视角分别生成字段。
- 技术视角表格字段改为 `作用域`、`安全技术服务`、`关联模块`、`关联措施`、`映射状态`、`映射说明`。
- 管理视角表格字段改为 `安全工作`、`安全职能`、`流程层级`、`流程名称`、`映射状态`、`映射说明`。
- 标准 / 框架映射页签保留；当前无直接标准控制项投影时显示可信空状态，不伪造映射行。
- 从右侧洞察区移除 `待确认项` 和 `来源证据` 渲染，右侧只保留 `关联模块清单` 和轻量 `统计摘要`。
- 更新 `frontend/capability-browser/styles.css`，补充 F3-IMPL-P1R3 表格列宽、对齐和右侧区域收口样式。
- 更新 `frontend/capability-browser/index.html` 和 `frontend/capability-browser/app.js` 的资源版本参数为 `f3-impl-p1r3`。

验证：

- `node --check frontend/capability-browser/components/CapabilityLocalRelationMap.js` 通过。
- `node --check frontend/capability-browser/app.js` 通过。
- `node --check frontend/capability-browser/components/AppShell.js` 通过。
- `node --check frontend/capability-browser/components/FocusOverview.js` 通过。
- `node --check frontend/capability-browser/viewModels.js` 通过。
- `node --check frontend/capability-browser/dataClient.js` 通过。
- 浏览器验证 `安全能力映射` 页面可打开，能力目录可选择关注点，上方映射清单、本地关联摘要、三视角 Tabs 和右侧关联模块清单可见。
- 浏览器验证技术视角、管理视角、标准 / 框架映射均可切换；技术 / 管理表格中不再出现 `成熟度`、`证据数`、`重点关注点`、`映射对象` 等不合适字段。
- 浏览器验证右侧洞察区不再显示 `待确认项` 和 `来源证据`。
- 浏览器验证 `信息化环境安全能力映射`、`开发安全`、`数据安全` 入口可打开。
- 浏览器控制台 error 日志为空。
- 主展示区字段边界检查通过，未发现 `sheet`、`row`、`column`、`raw_value`、`source_file`、`import_id`、`source_id`、`debug`、`raw`、`metadata`、`generated_at` 等非业务字段。
- 已生成截图：`/private/tmp/sapd-wiki-f3-impl-p1r3-capability-1440.png`、`/private/tmp/sapd-wiki-f3-impl-p1r3-capability-1920.png`。
- 本轮未修改 ETL、数据库、数据模型、导出 JSON、workbench JSON、`dataClient` 数据来源边界或 ViewModel 业务逻辑。

### 2026-05-17 F3-IMPL-P1R2 基于预览页恢复安全能力映射工作台

任务：用户拒绝验收 F3-IMPL-P1，要求在保留三视角切换的基础上，严格恢复前期预览页的信息结构和视觉结构，重点恢复上方映射清单 / 表格统计区、本地关联摘要关系图，并压缩右侧待确认项和来源证据。

本次调整：

- 覆盖重构 `frontend/capability-browser/components/CapabilityLocalRelationMap.js`，将页面内部结构恢复为 `当前关注点轻量条 -> 三视角 Tabs -> 映射清单表格 -> 本地关联摘要关系图 -> 当前视角关系区`。
- 恢复上方映射清单表格，表头包含 `重点关注点`、`映射对象`、`说明`、`成熟度`、`证据数`，内容使用当前 ViewModel 的技术 / 管理 / 标准映射状态生成，不伪造数据。
- 恢复 `本地关联摘要` 区块，以当前关注点为中心，使用上游能力、作用域、服务、模块 / 措施、管理工作、职能、流程或标准映射状态形成局部关系图。
- 保留 `技术视角`、`管理视角`、`标准 / 框架映射` 三个 Tabs；标准 / 框架映射在当前数据为空时显示可信空状态。
- 调整右侧区域，只保留 `关联模块清单` 和轻量 `统计摘要` 作为主要内容，`待确认项` 和 `来源证据` 默认折叠。
- 更新 `frontend/capability-browser/styles.css`，追加 F3-IMPL-P1R2 预览页还原样式，覆盖上一轮路径卡片列表视觉。
- 更新 `frontend/capability-browser/index.html` 和 `frontend/capability-browser/app.js` 的资源版本参数为 `f3-impl-p1r2`。

验证：

- `node --check frontend/capability-browser/components/CapabilityLocalRelationMap.js` 通过。
- `node --check frontend/capability-browser/app.js` 通过。
- `node --check frontend/capability-browser/components/AppShell.js` 通过。
- `node --check frontend/capability-browser/components/FocusOverview.js` 通过。
- `node --check frontend/capability-browser/viewModels.js` 通过。
- `node --check frontend/capability-browser/dataClient.js` 通过。
- `git diff --check` 通过。
- 浏览器验证 `安全能力映射` 页面可打开，能力目录可选择关注点，上方映射表、本地关联摘要、三视角 Tabs 和右侧关联模块清单可见。
- 浏览器验证 `技术视角`、`管理视角`、`标准 / 框架映射` 均可切换；标准 / 框架映射显示空状态且不伪造数据。
- 浏览器验证 `信息化环境安全能力映射`、`开发安全`、`数据安全`、`安全知识 / 专项知识维护` 入口可打开。
- 浏览器控制台 error 日志为空。
- 主展示区字段边界检查通过，未发现 `sheet`、`row`、`column`、`raw_value`、`source_file`、`import_id`、`source_id`、`debug`、`raw`、`metadata`、`generated_at` 等非业务字段。
- 已生成截图：`/private/tmp/sapd-wiki-f3-impl-p1r2-capability-1440.png`、`/private/tmp/sapd-wiki-f3-impl-p1r2-capability-1920.png`。
- 本轮未修改 ETL、数据库、数据模型、导出 JSON、workbench JSON、`dataClient` 数据来源边界或 ViewModel 业务逻辑。

### 2026-05-17 F3-IMPL-P1 安全能力映射工作台按规格实现

任务：用户提供 `f3-impl-p1-security-capability-workbench-prompt.md`，要求基于已完成的视觉规格和 Stitch 预览代码，将被拒绝的 F3-P1 / F3-P1R 卡片堆叠式页面重做为真正的安全能力映射关系工作台。

本次调整：

- 覆盖重构 `frontend/capability-browser/components/CapabilityLocalRelationMap.js`，将能力页内部关系区实现为当前关注点摘要、三视角切换、关系路径画布和右侧关联洞察区。
- 技术视角已按 `当前关注点 -> 作用域 -> 安全技术服务 -> 模块 / 措施` 表达，作用域纵向分组，组内以节点和连接线展示路径。
- 管理视角已按 `当前关注点 -> 安全工作 -> 安全职能 -> L2/L3/L4 流程` 表达，安全工作、职能分层和流程树并列呈现。
- 标准 / 框架映射已提供独立切换页；由于当前数据包未提供直接 `standard_framework` / `standard_control` 投影，页面展示可信空状态，不伪造标准映射。
- 右侧洞察区已包含关联模块清单、来源证据、统计摘要和待确认项，来源证据默认折叠，不挤压核心关系图。
- 更新 `frontend/capability-browser/styles.css`，追加 F3-IMPL-P1 工作台样式，覆盖被拒绝的卡片堆叠效果，强化白底专业关系画布、节点、连线、分组、空状态和 1440px / 1920px 响应式。
- 更新 `frontend/capability-browser/index.html` 与 `frontend/capability-browser/app.js` 的资源版本参数，避免浏览器缓存旧组件或旧样式。

验证：

- `node --check frontend/capability-browser/components/CapabilityLocalRelationMap.js` 通过。
- `node --check frontend/capability-browser/app.js` 通过。
- `node --check frontend/capability-browser/components/AppShell.js` 通过。
- `node --check frontend/capability-browser/components/FocusOverview.js` 通过。
- `node --check frontend/capability-browser/viewModels.js` 通过。
- `node --check frontend/capability-browser/dataClient.js` 通过。
- 浏览器回归确认 `安全能力映射` 页面可打开，技术视角、管理视角、标准 / 框架映射三种切换均可见。
- 浏览器回归确认 `信息化环境安全能力映射`、`开发安全`、`数据安全`、`安全知识 / 专项知识维护` 和说明页入口仍可打开。
- 浏览器控制台 error 日志为空。
- 已生成截图：`/private/tmp/sapd-wiki-f3-impl-p1-capability-1440.png`、`/private/tmp/sapd-wiki-f3-impl-p1-capability-1920.png`。
- 本轮未修改 ETL、数据库、数据模型、导出 JSON、workbench JSON、`dataClient` 数据来源边界或 ViewModel 业务逻辑。

### 2026-05-17 F3-P1R 安全能力映射工作台返工重构

任务：用户反馈 F3-P1 不验收，要求不要继续小修 CSS，而是把 `安全能力映射` 页面内部重构为真正的三栏关系工作台。

本次调整：

- 更新 `frontend/capability-browser/components/CapabilityLocalRelationMap.js`，将关系视图改为 `当前关注点对象卡 + 技术视角关系路径 + 管理视角关系路径` 三个并列区域。
- 更新 `frontend/capability-browser/app.js`，在能力页局部关系图渲染时传入 `focusOverview`，并移除关系区上方重复的大块关注点摘要，保留轻量顶部控制区。
- 更新 `frontend/capability-browser/styles.css`，追加 F3-P1R 三栏关系工作台样式，固定 1440px / 1920px 下三列布局、关系节点、连接线、分组、空状态和滚动边界。
- 更新 `frontend/capability-browser/index.html` 和 `app.js` 的资源版本查询参数，避免浏览器继续使用旧 `CapabilityLocalRelationMap.js` / `styles.css` 缓存影响预览验收。

验证：

- `node --check frontend/capability-browser/app.js` 通过。
- `node --check frontend/capability-browser/components/CapabilityLocalRelationMap.js` 通过。
- `node --check frontend/capability-browser/components/FocusOverview.js` 通过。
- `node --check frontend/capability-browser/components/AppShell.js` 通过。
- `node --check frontend/capability-browser/viewModels.js` 通过。
- `node --check frontend/capability-browser/dataClient.js` 通过。
- `git diff --check` 通过。
- 浏览器回归确认 `安全能力映射`、`信息化环境安全能力映射`、`安全知识 / 专项知识维护` 可打开；`LC-AP开发安全生命周期` 和 `数据生命周期维度` 通过工作区可见性检查确认未失效。
- 浏览器控制台 error 日志为空。
- 已生成截图：`/private/tmp/sapd-wiki-f3-p1r-capability-1440.png`、`/private/tmp/sapd-wiki-f3-p1r-capability-1920.png`。
- 本轮未修改 ETL、数据库、数据模型、导出 JSON、workbench JSON、`dataClient` 数据来源边界或 ViewModel 业务逻辑。

### 2026-05-17 F3-P1 安全能力映射工作台专项设计与实现

任务：用户要求在保留 Application Shell 的前提下，专项重构 `安全能力映射` 页面内部工作台，优化能力目录、关注点摘要、技术视角关系区和管理视角关系区。

本次调整：

- 更新 `frontend/capability-browser/components/FocusOverview.js`，将当前关注点摘要重构为对象身份区 + `技术落地` / `管理执行` 两组统计，突出编码、标题、说明、路径和关键关系数量。
- 更新 `frontend/capability-browser/components/CapabilityLocalRelationMap.js`，补充技术视角和管理视角统计条，强化 `作用域 -> 安全技术服务 -> 模块 / 措施` 与 `安全工作 -> 安全职能 -> L2/L3/L4 流程` 两条关系表达。
- 更新 `frontend/capability-browser/styles.css`，追加 F3-P1 专项样式，重构能力目录、关注点摘要、关系工作台、技术映射、管理映射、空状态、标签和响应式布局。
- 1440px 下管理视角下移为单列关系工作台，避免技术 / 管理双栏挤压主展示区；1920px 下保持左中右关系工作台结构完整展开。

验证：

- `node --check frontend/capability-browser/components/FocusOverview.js` 通过。
- `node --check frontend/capability-browser/components/CapabilityLocalRelationMap.js` 通过。
- `node --check frontend/capability-browser/app.js` 通过。
- `node --check frontend/capability-browser/viewModels.js` 通过。
- `node --check frontend/capability-browser/dataClient.js` 通过。
- `git diff --check` 通过。
- 本地静态服务 `http://127.0.0.1:5173/` 返回 `200 OK`。
- 浏览器回归已确认 `安全能力映射`、`信息化环境安全能力映射`、`开发安全`、`数据安全`、`安全知识 / 专项知识维护` 均可打开。
- 浏览器控制台 error 日志为空。
- 已生成截图：`/private/tmp/sapd-wiki-f3-p1-capability-1440.png`、`/private/tmp/sapd-wiki-f3-p1-capability-1920.png`。
- 本轮未修改 ETL、数据库、数据模型、导出 JSON、workbench JSON、`dataClient` 数据来源边界或 ViewModel 业务逻辑。

### 2026-05-17 F2-P1.6 Application Shell 视觉对齐专项

任务：用户要求在不改业务逻辑的前提下，对 F2-P1.5 已集成的 Application Shell 做视觉还原和设计系统统一，并输出 1440px / 1920px 截图。

本次调整：

- 更新 `frontend/capability-browser/components/AppShell.js`，移除顶部栏重复品牌，仅保留左侧导航品牌作为全局锚点。
- 更新 `frontend/capability-browser/components/AppShell.js`，将能力页摘要中的内部枚举 `capability_focus` 转为展示文案 `能力关注点`，避免主展示区继续呈现内部字段风格。
- 更新 `frontend/capability-browser/styles.css`，追加 F2-P1.6 视觉 token 和覆盖样式，统一背景、边框、圆角、低阴影、focus 状态、按钮、标签、顶部栏、侧边导航、页面标题区和工作台容器。
- 更新 `frontend/capability-browser/styles.css`，对安全能力映射页做壳层内视觉适配，降低关系视图区边框、网格、卡片和状态区视觉重量，不改能力树、关系矩阵、ViewModel 或数据逻辑。

验证：

- `node --check frontend/capability-browser/app.js` 通过。
- `node --check frontend/capability-browser/components/AppShell.js` 通过。
- `node --check frontend/capability-browser/dataClient.js` 通过。
- `node --check frontend/capability-browser/viewModels.js` 通过。
- `git diff --check` 通过。
- 本地静态服务 `http://127.0.0.1:5173/` 返回 `200 OK`。
- 已通过浏览器自动化进入 `安全能力映射` 页面并生成截图：`/private/tmp/sapd-wiki-f2-p16-capability-1440.png`、`/private/tmp/sapd-wiki-f2-p16-capability-1920.png`。
- 本轮未修改 ETL、数据库、数据模型、导出 JSON、workbench JSON、`dataClient` 数据来源边界或 ViewModel 业务逻辑。

### 2026-05-16 F2-P1.5 Application Shell 集成实现

任务：用户要求进入 F2-P1.5，一次性完成 Application Shell 可运行闭环，包括全局壳层、Manifest 导航、顶部栏、搜索入口、页面标题区、面包屑、通用 WorkbenchLayout / RightInsightPanel 容器骨架、现有页面保活、文档同步和验证。

本次调整：

- 更新 `frontend/capability-browser/components/AppShell.js`，将其扩展为真正的全局 Application Shell 组件入口，同时保留旧的能力页辅助挂载方法，避免现有页面断开。
- 在 `AppShell.js` 中接入与 `nav-manifest.v1.json` 同口径的 Manifest 导航结构，一级菜单来自 `navigation`，二级菜单来自 `children`。
- 新增 Manifest route 到当前已有 view 的映射：`/` 到 `overview`，`/capability-mapping` 到 `capabilities`，`/environment-mapping` 到 `environment`，`/development-security` 到 `dev-lifecycle`，`/data-security` 到 `data-lifecycle`，知识和标准目录映射到现有 `maintenance`，指南类映射到现有 `content`。
- 更新 `frontend/capability-browser/app.js`，新增 `activeRoute`、`activateRoute()`、`routeForCurrentState()` 和 Application Shell chrome 更新流程，保留原有页面切换与数据读取。
- 更新 `frontend/capability-browser/styles.css`，追加 F2 应用壳相关样式，包含 Manifest 左侧导航、顶部栏、全局搜索入口、页面标题区、面包屑、WorkbenchLayout 和 RightInsightPanel 容器骨架。
- 更新 `task_plan.md`，新增 `FE-AS Application Shell 集成实现` 任务并标记为进行中。

验证：

- `node --check frontend/capability-browser/components/AppShell.js` 通过。
- `node --check frontend/capability-browser/app.js` 通过。
- `node --check frontend/capability-browser/dataClient.js` 通过。
- `node --check frontend/capability-browser/viewModels.js` 通过。
- `node --check frontend/capability-browser/components/*.js` 通过。
- `git diff --check` 通过。
- 本地静态服务 `python3 -m http.server 5173 --bind 127.0.0.1` 已启动，`curl -I http://127.0.0.1:5173/` 返回 `200 OK`。
- Chrome headless 已完成真实 DOM 渲染，确认全局壳层、Manifest 一级 / 二级导航、顶部栏、搜索入口、页面标题区、`workbench-layout` 和 `right-insight-panel` 均已出现在运行页面中。
- Chrome headless 已生成 1440px 和 1920px 截图用于布局核对；截图命令写出文件后因 Chrome 后台 updater 未及时退出触发 timeout，但页面截图已生成。
- 静态模式下 `/api/v1/*` 返回 404 后，前端成功回退读取 `public/data/*.json`，未改变 `dataClient` 数据来源边界。

### 2026-05-16 前端设计进程上下文同步

任务：用户要求同步项目进展，并准备用当前进程继续进行前端设计。

本次同步：

- 已按轻量恢复规则读取 `CURRENT_STATE.md`、`task_plan.md`、`findings.md`、`progress.md`、`docs/00-overview/master-context-restore.md` 和 `docs/06-implementation/open-issues.md`。
- 已读取前端设计交接关键文件：`docs/00-overview/stitch-design-handoff-v2.md`、`docs/00-overview/frontend-menu-and-page-type-definition-v1.md`。
- 已按项目规则运行 `node .agents/skills/impeccable/scripts/load-context.mjs`，确认 `PRODUCT.md` / `DESIGN.md` 可用，当前设计 register 为 `product`。
- 当前后续前端设计口径：优先从 Application Shell 和两个 P1 工作台开始；安全能力映射页作为关系画布基准，信息化环境页必须以 `environment-workbench.json` 为目标结构，不沿用旧页面表格主导方式。

验证：

- `git status --short --branch` 已执行，当前存在未跟踪 Stitch 输入 / 输出文件；本轮未修改这些文件。
- 已确认 `dataClient.js`、`app.js`、`viewModels.js` 中三份 workbench 数据入口仍存在。
- 本轮未修改前端运行代码、ETL、数据库 schema 或 `public/data/*.json`。

### 2026-05-16 Stitch / UI 设计输入交接 V2

任务：用户要求进入 Stitch / UI 设计输入整理阶段，只生成 UI 设计交接文档，不做 UI 实现、不改前端代码、不启动浏览器、不运行 npm。

本次调整：

- 新增 `docs/00-overview/stitch-design-handoff-v2.md`，将菜单结构、页面类型、三份 workbench 数据契约状态、当前实现状态和已知缺口整理为 Stitch 设计输入。
- 文档明确当前口径为“P1 双核心工作台 + LC-AP 受控专项关系投影”，并将 `SAPD 成熟度评估` 标注为独立 `domain-module`，代码实现另开会话。
- 文档明确 `environment-workbench.json` 已生成并加载，但信息化环境页展示结构尚未完全切换到其对象 / 关系模型，Stitch 设计应以目标数据结构为准。

验证：

- 本轮未修改前端代码、JSON、`dataClient`、ViewModel、ETL、数据库 schema，未启动 npm，未启动浏览器，未进入 maturity 或 Phase 7。

### 2026-05-16 Pre-Stitch Frontend Data Source Switch

任务：用户要求进入 Pre-Stitch 前端数据源切换阶段，只做数据源切换准备与最小接入核查，不做 UI / Stitch 重构。

本次调整：

- 更新 `frontend/capability-browser/app.js`，初始化时新增读取 `getCapabilityWorkbench()`、`getEnvironmentWorkbench()`、`getLifecycleWorkbench()`。
- 更新 `frontend/capability-browser/viewModels.js`，能力页 ViewModel 优先从 `capability-workbench.json` 派生技术 / 管理映射行，旧 `capability-tree.json` + `management-knowledge.json` 保留为 fallback。
- 更新 `frontend/capability-browser/viewModels.js`，LC-AP 页 ViewModel 在 `lifecycle-workbench.json` 可用时优先用 workbench 派生阶段、活动、控制点、策略、服务和模块关系；旧 `lifecycle-knowledge.json` 保留为 fallback。
- 信息化环境页入口已存在，本轮已挂接 `environment-workbench` 数据状态，但未重写环境页展示结构；后续 UI 重构前仍需完成环境页 workbench 结构消费替换。

验证：

- `node --check frontend/capability-browser/app.js` 通过。
- `node --check frontend/capability-browser/dataClient.js` 通过。
- `node --check frontend/capability-browser/viewModels.js` 通过。
- `node --check frontend/capability-browser/components/*.js` 通过。
- 三份 workbench JSON 顶层契约解析通过。
- `git diff --check` 通过。
- 本轮未启动浏览器、未运行 npm、未修改样式大布局、未进入 Stitch / maturity / Phase 7。

### 2026-05-16 SAPD 成熟度评估纳入前端菜单与数据契约规划

任务：用户指出前端菜单定义中还应包含 `SAPD成熟度评估（评分填报，结果生成）`，要求一并考虑，但代码实现放到另一个会话。

本次调整：

- 更新 `docs/00-overview/frontend-menu-and-page-type-definition-v1.md`，将 `SAPD 成熟度评估` 作为一级菜单补入，路由建议为 `/sapd-maturity-assessment`，页面类型暂用 `domain-module`，优先级为 `P2`。
- 更新 `frontend/design-handoff/navigation/nav-manifest.v1.json`，新增 `sapd-maturity-assessment` 导航项，作为 Stitch 设计交接和后续实现参考。
- 更新 `docs/04-user-guide/frontend-data-contract-baseline-1.0.md`，明确 maturity 评估不并入三份 workbench JSON，后续单独定义 `maturity-assessment-template.json`、`maturity-assessment-session.json`、`maturity-assessment-result.json` 等契约。
- 更新 `docs/04-user-guide/frontend-baseline-1.0-plan.md`，说明三页关系工作台仍是当前前端基线实现重点，`SAPD 成熟度评估` 是独立模块补充。
- 更新 `task_plan.md` 和 `findings.md`，记录 maturity 评估入口已纳入规划，代码实现另开会话。

验证：

- 本轮只修改文档和设计交接 Manifest，不修改前端运行代码、ETL、schema、JSON 数据包或 maturity 运行逻辑。

### 2026-05-16 Frontend Data Contract Governance Step 4-6

任务：用户要求顺序完成三个 workbench JSON 导出、`dataClient` / ViewModel 接入和数据契约验收。

本次调整：

- 更新 `src/sapd_wiki/exports.py`，新增 `export_capability_workbench()`、`export_environment_workbench()`、`export_lifecycle_workbench()` 和 `export_frontend_workbenches()`。
- 更新 `src/sapd_wiki/cli.py`，新增 `export-capability-workbench`、`export-environment-workbench`、`export-lifecycle-workbench`、`export-frontend-workbenches`。
- 更新 `src/sapd_wiki/api_server.py`，补充三个 workbench 数据包的 `/api/v1/data-packages/*` 映射。
- 更新 `frontend/capability-browser/dataClient.js`，新增 `getCapabilityWorkbench()`、`getEnvironmentWorkbench()`、`getLifecycleWorkbench()`，并保留旧包过渡 fallback。
- 更新 `frontend/capability-browser/viewModels.js`，新增三个 workbench ViewModel 入口。
- 生成 `frontend/capability-browser/public/data/capability-workbench.json`、`environment-workbench.json`、`lifecycle-workbench.json`。
- 更新 `task_plan.md` 和 `findings.md`，记录三份 workbench 数据出口已完成，旧 JSON 仍作为过渡兼容。

验证：

- `python3 scripts/sapd_wiki.py export-frontend-workbenches` 通过，生成三份 workbench JSON。
- 三个单独 CLI 导出命令均通过。
- 三份 JSON 均可解析，且均包含 `meta`、`page`、`navigator`、`overview`、`relationshipGroups`、`objects`、`relations`、`evidenceRefs`、`compatibility`。
- 契约统计：`capability-workbench.json` objects=701、relations=2176；`environment-workbench.json` objects=454、relations=2427；`lifecycle-workbench.json` objects=240、relations=354。
- 主展示结构字段边界检查通过，未发现 `sheet`、`row`、`column`、`raw_value`、`source_file`、`import_id`、`generated_at` 泄露。
- `python3 -m compileall src/sapd_wiki/exports.py src/sapd_wiki/cli.py src/sapd_wiki/api_server.py`、`node --check frontend/capability-browser/dataClient.js`、`node --check frontend/capability-browser/viewModels.js`、`git diff --check` 均通过。

### 2026-05-15 Frontend Data Contract Governance 规格阶段收口

任务：用户要求一次性完成数据治理规格阶段剩余工作，但仍不进入代码实现。

本次调整：

- 新增 `docs/04-user-guide/capability-workbench-json-spec-v1.md`，定义 `capability-workbench.json` 的页面定位、顶层结构、对象 / 关系清单、字段迁移和兼容策略。
- 新增 `docs/04-user-guide/lifecycle-workbench-json-spec-v1.md`，定义 `lifecycle-workbench.json` 的 LC-AP 受控专项关系投影边界、顶层结构、对象 / 关系清单、字段迁移和兼容策略。
- 复核并最小补充 `docs/04-user-guide/frontend-json-field-attribution-baseline-1.0.md`，增加三份 workbench 规格后的最终迁移复核表。
- 更新 `docs/04-user-guide/frontend-data-contract-baseline-1.0.md`，冻结最终前端数据文件清单：P0 四件套、P1 三件套和过渡兼容旧文件。
- 更新 `task_plan.md` 和 `findings.md`，记录三份 workbench 规格已齐，下一步才进入 export / dataClient 代码实现。

验证：

- 本轮未修改前端代码、现有 JSON、`dataClient`、ViewModel、前端组件、ETL、数据库 schema，未重新导入数据，未运行 `npm`，未启动前端，未打开浏览器。

### 2026-05-15 Frontend Baseline 1.0 前端数据契约治理方案

任务：用户要求结合代码同事反馈和 `frontend-data-contract-governance-prompt.md`，评估 `capability-tree.json`、`lifecycle-knowledge.json` 等前端数据包职责混杂问题，并结合全站菜单与页面类型定义给出治理方案。

本次调整：

- 新增 `docs/04-user-guide/frontend-data-contract-baseline-1.0.md`，明确 Frontend Baseline 1.0 应从“三个同级关系工作台”修正为“P1 双核心工作台 + LC-AP 受控专项关系投影”。
- 文档分析了 `capability-tree.json`、`management-knowledge.json`、`lifecycle-knowledge.json` 当前职责混杂问题。
- 文档建议新增或拆分 `app-manifest.json`、`capability-workbench.json`、`environment-workbench.json`、`lifecycle-workbench.json`、`shared-lookups.json`、`source-evidence.json`。
- 更新 `task_plan.md` 和 `findings.md`，记录前端数据契约治理结论。

验证：

- 本轮只修改文档、计划、发现和进度记录。
- 本轮未修改前端代码、现有 JSON、ETL、数据库 schema，未重新导入数据，未运行 `npm`，未启动前端，未打开浏览器。
- 已只读盘点 `frontend/capability-browser/public/data/`、`dataClient.js`、`exports.py`、`api_server.py`、`scripts/` 和相关治理文档。

### 2026-05-15 BE-1 安全能力映射页投影补强

任务：将安全能力映射页关系画布需要的 `scopeServicePairs`、`serviceModuleMeasureLinks`、`workFunctionsByLayer`、`processTree` 下沉到 `/api/v1/capabilities/workspace-projection`。

本次调整：

- 更新 `src/sapd_wiki/api_server.py`，在能力页 workspace projection 中新增 `localRelationMap`、`localRelationMaps`、`localRelationMapsByFocusId`。
- `localRelationMap.technical` 输出 `scopeServicePairs` 和 `serviceModuleMeasureLinks`，保留作用域到服务 pair，并按服务分别输出模块和措施。
- `localRelationMap.management` 输出 `securityWorks`、五组 `workFunctionsByLayer` 和 L2 / L3 / L4 `processTree`。
- `sourceEvidence` 独立输出来源证据，主展示结构不带 `sheet`、`row`、`column` 等来源字段。
- 更新 `docs/01-architecture/api-offline-package-contract-inventory.md`，记录 BE-1 投影结构和剩余前端消费替换事项。
- 更新 `task_plan.md`，将 BE-1 标记为已完成。

验证：

- `python3 -m py_compile src/sapd_wiki/api_server.py` 通过。
- 直接调用 `capability_workspace_projection()` 返回 `data_state=ready`。
- 当前默认测试关注点 `T-AS.AD-01`：`scopeServicePairs=7`，`serviceModuleMeasureLinks=6`，四层职能计数为 `decision=0`、`management=5`、`execution=4`、`supervision=0`、`unknown=0`，`processTree=1`。
- 现有 `technicalMappingRows` 和 `managementMappingRows` 仍保留。
- 本轮未修改 SQLite schema、原始 Excel、前端样式或 `public/data/*.json`。

### 2026-05-15 Frontend Menu and Page Type Definition V1

任务：用户要求根据最新全站菜单结构，完成前端菜单定义、页面类型定义、导航 Manifest 和 Stitch 设计交接准备。

本次调整：

- 新增 `docs/00-overview/frontend-menu-and-page-type-definition-v1.md`，固化页面类型枚举、全站一级菜单、二级菜单、路由建议、设计重点、不适合方式和 Stitch 设计顺序。
- 新增 `frontend/design-handoff/navigation/nav-manifest.v1.json`，作为 Stitch 设计交接和后续 Codex 实现参考，不接入运行代码。
- 新增 `docs/00-overview/stitch-design-handoff-v1.md`，说明 Stitch 输入文件、设计顺序、全局设计边界和后续 Codex 实现边界。
- 新增 `frontend/design-handoff/README.md`，说明设计交接目录定位、导航基线、Stitch 设计顺序、Stitch 输出使用规则和推荐目录结构。
- 新增 `frontend/design-handoff/stitch-prompts/00-application-shell.md`，作为后续提交给 Stitch 的全局导航 / 应用壳设计提示词。
- 新增 `frontend/design-handoff/sample-data/.gitkeep`、`frontend/design-handoff/stitch-outputs/.gitkeep`、`frontend/design-handoff/implementation-specs/.gitkeep`，保留样例数据、Stitch 输出和 implementation specs 目录。
- 更新 `task_plan.md` 和 `findings.md`，记录 FE-IA 已完成。

验证：

- 本轮未修改运行中的前端页面代码、ETL、数据库、数据模型或现有导出 JSON。
- `nav-manifest.v1.json` 已通过 JSON 解析、字段完整性、页面类型枚举和优先级枚举检查。
- 下一步建议基于 `frontend/design-handoff/stitch-prompts/00-application-shell.md` 进行 Stitch 全局导航 / 应用壳设计。

### 2026-05-15 BE-0 API / 离线数据包契约盘点

任务：用户要求先执行 API / 离线数据包契约盘点。

本次调整：

- 新增 `docs/01-architecture/api-offline-package-contract-inventory.md`，盘点当前已实现 API、规划但尚未实现的接口、四个离线数据包、三页字段契约、来源证据边界和后续 BE-1 / BE-2 / BE-3 动作。
- 更新 `task_plan.md`，将 BE-0 状态改为“已完成”，并指向本次盘点文档。
- 更新 `findings.md`，记录当前仅安全能力映射页有页面级投影，环境页和 LC-AP 页仍主要依赖 `data-packages` + ViewModel 整理。

验证：

- 已读取 `CURRENT_STATE.md`、`task_plan.md`、`findings.md`、`progress.md`、`dataClient.js`、`viewModels.js`、`api_server.py`、`api-field-contract.md`、`backend-interface-design.md` 和 Frontend Baseline 文档。
- 已用 Node 读取四个离线 JSON 的顶层字段和统计信息。
- 本轮只修改文档和计划记录，不修改代码、ETL、schema 或 public data。

### 2026-05-15 后续项目计划分线整理

任务：用户要求使用 `planning-with-files` 梳理未来项目计划，并将前端页面设计和后端逻辑分开。

本次调整：

- 更新 `task_plan.md`，新增“未来项目计划：前端页面设计线”和“未来项目计划：后端数据 / 逻辑线”。
- 明确页面推进顺序：先收敛 `安全能力映射页`，再推进 `信息化环境维度页`，最后推进 `LC-AP 开发安全生命周期页`。
- 更新 `findings.md`，记录后续按“后端投影契约 -> 前端页面实现 -> 验收回归”推进，以及当前前端画布结构漂移风险。

验证：

- 已读取 `CURRENT_STATE.md`、`task_plan.md`、`findings.md`、`progress.md`、`docs/04-user-guide/frontend-baseline-1.0-plan.md`、`docs/01-architecture/backend-interface-design.md`、`docs/01-architecture/api-field-contract.md` 和 `docs/06-implementation/open-issues.md`。
- 本轮只修改计划和发现记录，不修改代码、数据、ETL 或前端资源。

### 2026-05-15 5 次重连问题诊断与热修复

任务：用户反馈当前会话多次重连，要求先修复影响工程开发的问题。

本次处理：

- 按 `CURRENT_STATE.md` 的重连处理规则执行只读诊断：`git status --short --branch`、`wc -l CURRENT_STATE.md task_plan.md findings.md progress.md AGENTS.md`、`git diff --stat` 和本地服务探测。
- 确认主控上下文文件合计 713 行，不是根目录主控文档过大导致。
- 确认 `http://127.0.0.1:5173/` 当时已断开，已重新启动 `python3 scripts/sapd_wiki.py serve --host 127.0.0.1 --port 5173`，并验证返回 `200 OK`。
- 确认当前主要风险来自长会话历史、浏览器 / headless 验证进程和未收口脏改，而不是需要读取的大型业务数据文件。

验证：

- `curl -sS -I http://127.0.0.1:5173/` 通过，返回 `HTTP/1.0 200 OK`。
- 本轮未修改代码、schema、ETL、`public/data/*.json` 或原始业务数据。

## 历史索引

| 归档文件 | 内容 |
|---|---|
| `docs/05-archive/context-slimming-2026-05-15/task_plan-full-before-slimming.md` | `task_plan.md` 瘦身前完整内容 |
| `docs/05-archive/context-slimming-2026-05-15/findings-full-before-slimming.md` | `findings.md` 瘦身前完整内容 |
| `docs/05-archive/context-slimming-2026-05-15/progress-full-before-slimming.md` | `progress.md` 瘦身前完整内容 |
| `docs/05-archive/context-slimming-2026-05-15/current-state-before-slimming.md` | `CURRENT_STATE.md` 本轮瘦身前快照 |
| `docs/05-archive/findings-history/2026-05.md` | 2026-05 历史发现 |
| `docs/05-archive/progress-history/2026-05.md` | 2026-05 完整执行记录 |

## 维护规则

- 本文件只记录最近 1-3 次重要执行。
- 超过 120 行时继续归档到 `docs/05-archive/`。
- 详细过程、长命令输出和阶段性历史不再写入根目录 `progress.md`。
