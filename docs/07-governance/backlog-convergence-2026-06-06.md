# SAPD Wiki 总 Backlog 收敛表

日期：2026-06-06

目的：把当前散落在 `task_plan.md`、`CURRENT_STATE.md`、`progress.md`、`open-issues.md`、执行线台账、Product Design review、Data Analytics review 和 Delivery 文档中的未开展任务收敛到一个可恢复、可排序、可执行的入口。

本文件不是替代 `task_plan.md`，而是当前阶段的 backlog 排序视图。正式阶段计划仍以 `task_plan.md` 为准；问题状态仍以 `docs/06-implementation/open-issues.md` 为准；执行线恢复仍以 `docs/07-governance/current-execution-lines.md` 为准。

## 当前判断

没有任务丢失。之前的问题是 backlog 分散在多个入口，导致“前端稳定化”看起来像替代了整个项目计划。

当前需要先做一轮收敛，而不是直接开新功能：

1. 先把 `OI-128C` 和当前 dirty worktree 做 checkpoint，降低回退成本。
2. 再修 `OI-136 / FE-ROUTE`，保证深层路由直接访问、刷新和批注定位跳转稳定。
3. 随后按用户当前优先级在“用户库 / stable_key / Delivery Bundle”和“前端基线稳定化”之间选择主线。

## Backlog 总览

| 优先级 | 工作包 | 包含任务 | 当前状态 | 推荐处理 |
|---|---|---|---|---|
| Gate 0 | Dirty worktree checkpoint | `OI-128C` 批注收口、全局批注基线、批注脚本、当前设计审阅产物 | 已完成 | 已拆成 `b93a9f1` 批注基线和 `e23c6d7` backlog / 设计计划两个 checkpoint；当前工作区已清理，可进入 `OI-136 / FE-ROUTE` |
| P0 | 深层路由稳定性 | `OI-136`、`FE-ROUTE` | 待修复 | 单线写入；修直接访问 `/guides/*`、`/knowledge/*`、`/standards/*` 掉样式 |
| P0 | 用户库长期治理 | `OI-135`、`DB-11`、`user_notes`、旧 `user_favorites`、数据篮 / 导出 / 自定义能力 | 待设计 | 先设计 schema / migration / 备份恢复，不直接写前端 |
| P0 | 稳定键与基础库升级兼容 | `DB-2 stable_key`、deterministic ID、`base_id_redirects` | 待启动 | 与用户库治理强相关；进入 Delivery 正式版前必须做 |
| P0/P1 | Delivery Bundle 1.0-alpha | `BE-6`、`DB-6/7/9`、Windows x64 实测、诊断包、release manifest | macOS alpha 已准备，Windows 未验证 | checkpoint 后继续；不要和前端 UI 混写 |
| P1 | 前端设计基线稳定化 | `FE-BASELINE-STABILIZE` 建议包：`FE-NAV`、`FE-ANNOTATION-UX`、`FE-CHIP-MATRIX`、`FE-DASHBOARD` | 待拆分 | 先只读审阅，逐项小步实现 |
| P1 | 页面模块继续验收 | 安全能力、LC-AP / LC-DT、信息化环境、知识库字典、标准 / 框架、指南页 | 多数已有实现或待验收 | 只读 Gap Check 起步；写入必须单页面单线 |
| P1/P2 | ArchiMate 建模语言页优化 | `OI-133 / EL-025` | 待设计 | 先按优化计划确认阅读路径和加载策略 |
| P2 | Dashboard 工作入口化 | `dashboard-and-module-data-display-optimization-design.md` | 设计完成，未进实现项 | 先补计划项，再后端聚合数据，最后前端实现 |
| P2 | 数据质量 / 字典一致性 | `EL-007`、字典引用一致性、候选映射校对 | 暂停 / 待确认 | 单独数据治理线，不和前端混修 |
| P2 | Gartner 人工校对 | `OI-038` | 待确认 | 用户业务确认任务；Codex 只提供辅助表和校对视图 |
| 后置 | 成熟度评估模块 | `FE-M`、`BE-M`、M1.3 / M2 / M3 | 待启动 / 另线 | 用户重新指定后再启动 |
| 后置 | C/S 客户端 / Tauri / 安装包增强 | `EL-005`、`DB-8`、C/S presearch | 后置 | ZIP alpha 成立后再评估 |
| 后置 | 多格式增强 / AI RAG | Phase 7、Phase 10 | 后置 | 当前不启动 |

## 当前必须先做

### 1. Gate 0：Dirty Worktree checkpoint

理由：当前工作区同时包含批注模块、审阅文档、dashboard 设计、路由计划项、脚本和进度文档。继续开发会增加回退成本。

建议拆成至少三个 checkpoint 候选：

| Checkpoint | 文件范围 | 说明 |
|---|---|---|
| `OI-128C annotation baseline` | `frontend/capability-browser/app.js`、`styles.css`、`components/UserAnnotationDrawer.js`、`index.html`、`scripts/audit_saved_user_annotations.mjs`、`scripts/audit_user_annotation_contract.mjs`、`scripts/audit_annotation_drawer_tab.mjs`、批注基线文档 | 批注功能和全局基线，不混入 dashboard / Product Design review |
| `Design review and backlog governance` | `docs/06-implementation/design-audits/2026-06-06-product-design-review/`、`docs/06-implementation/open-issues.md`、`task_plan.md`、`progress.md`、本文件 | 审阅、Open Issue 和 backlog 收敛 |
| `Dashboard design` | `docs/06-implementation/dashboard-and-module-data-display-optimization-design.md` | Dashboard 方案文档，不混入前端实现 |

提交前不要 `git add .`。

### 2. P0：`OI-136 / FE-ROUTE`

目标：深层 route 直接访问、刷新、前进 / 后退、应用内导航和批注定位跳转必须保持同一个应用壳和样式。

验收 route：

- `/`
- `/capability-mapping`
- `/development-security`
- `/data-security`
- `/environment-mapping`
- `/guides/security-architecture-design`
- `/knowledge/technical`
- `/standards/iso-27001-2022`

每个 route 至少断言：

- 样式已加载，不是原生 HTML。
- 左侧全局导航存在。
- 页面标题与 route 一致。
- 当前父级 / 子级导航状态可理解。
- 批注抽屉不误展开。
- 主展示区无非业务字段泄露。

## 当前可并行只读评估

以下任务可以开只读子 Agent 或专项会话，但不建议并行写入：

| 任务 | 只读产出 | 写入条件 |
|---|---|---|
| `FE-NAV` 全局导航层级治理 | 当前一级 / 二级导航显示规则、DOM 可见性、键盘风险清单 | `FE-ROUTE` 完成后 |
| `FE-ANNOTATION-UX` 批注抽屉体验微调 | 遮挡、列表密度、焦点恢复、主区安全边界评估 | `OI-128C` checkpoint 后 |
| `FE-CHIP-MATRIX` 矩阵和 chip 统一 | 服务 / 模块 / 标准 / 状态 chip 样式差异清单 | 路由稳定、页面截图可信后 |
| `OI-133` ArchiMate 优化 | 当前页面截图、图片请求数、首屏加载、阅读路径建议 | 用户确认先做区域阅读器还是 SAPD 映射说明 |
| `OI-038` Gartner 校对 | 候选映射清单、偏宽候选标记、校对表 | 用户开始逐条确认 |
| Windows ZIP UAT | Windows 构建前置检查、UAT checklist 差距 | 有 Windows x64 环境 |

## 后续开发队列

### A. 用户库 / 工作台 / 数据篮

入口：`OI-128`、`OI-135`、`DB-11`。

建议顺序：

1. 设计用户库长期 schema 和迁移策略。
2. 决定 `user_favorites` 是否保留兼容或迁移。
3. 定义数据篮、导出配置、用户自定义能力和导入草稿的表结构。
4. 定义 base/user read model 合并规则。
5. 再进入前端“我的工作台 / 数据篮 / 导出”。

不要先做前端按钮，否则会再次遇到数据语义不稳。

### B. `stable_key` / base 升级兼容

入口：`DB-2`。

该任务支撑：

- 用户批注和收藏跨版本不丢。
- Delivery Bundle 基础库升级不让用户关系断裂。
- 后续 `base_id_redirects` 支持改名、合并、拆分、废弃。

应和用户库治理相邻推进。

### C. Delivery Bundle

入口：`BE-6`、`DB-6`、`DB-7`、`DB-9`。

当前 macOS arm64 alpha 已准备，Windows 仍 `pending / not_verified`。

建议顺序：

1. 先完成 dirty checkpoint。
2. 再确认是否先做 Windows x64 实测，还是先补 user DB / stable_key。
3. ZIP alpha 继续优先，不先做正式安装包或 Tauri 壳。

### D. 前端设计基线稳定化

入口：Product Design review、`frontend-global-design-baseline-2026-05-30.md`。

建议新增工作包：

| 子项 | 目标 |
|---|---|
| `FE-NAV` | 统一全局导航层级、二级入口可见性、父子高亮 |
| `FE-ANNOTATION-UX` | 批注抽屉遮挡、列表密度、焦点恢复，不改批注模型 |
| `FE-CHIP-MATRIX` | 统一矩阵密度、chip 语义色、空值 `/`、参考来源 |
| `FE-DASHBOARD` | 首页从数据包健康总览转为工作入口 |

### E. 页面模块后续

| 页面 / 模块 | 当前入口 | 下一步 |
|---|---|---|
| 安全能力映射 | `FE-1`、`FE-2`、`EL-016` | 固化验收清单和关系画布基线 |
| 信息化环境 | `FE-3`、`EL-018` | 只读 Gap Check，确认拓扑与表格分工 |
| LC-AP / LC-DT | `FE-4`、`EL-019` | 生命周期页局部关系画布和矩阵验收 |
| 知识库字典 | `FE-6`、`EL-017` | 详情面板、候选映射、字段边界继续稳定 |
| 标准 / 框架 | `EL-015` | 标准索引、tab loader、分包加载和条款展示边界 |
| 安全指南 / ArchiMate | `OI-133`、`EL-025` | 建模语言参考工作页，不再做素材陈列 |

### F. Dashboard 工作入口化

入口：`docs/06-implementation/dashboard-and-module-data-display-optimization-design.md`。

该任务已有设计文档，但还没进入 `task_plan.md` 独立实现项。

建议后续补为：

`FE-DASHBOARD：Dashboard 工作入口化实现`

依赖：

- 指标口径确认。
- 后端或离线脚本生成 `analytics_summary`。
- 前端只消费统计契约，不临时推断关系。

### G. 成熟度模块

入口：`FE-M`、`BE-M`、M1.3 / M2 / M3。

当前保持后置。只有用户重新指定 maturity 为主线时再启动。

## 不建议同时做

以下组合容易再次造成“修一个坏一个”：

- `OI-136` 路由修复 + 批注抽屉视觉大改。
- 用户库 schema + 前端数据篮 UI 同时开写。
- Dashboard 指标口径 + 前端实现同时开写。
- ArchiMate 页面优化 + 全站导航重构同时开写。
- Delivery Bundle Windows UAT + 前端大改同时进行。

## 推荐下一步决策

### 默认推荐

1. 做 `OI-136 / FE-ROUTE`。
2. 再进入 `OI-135 + DB-2 + DB-11` 用户库与 stable_key 治理。
3. 然后继续 Delivery Bundle 或前端基线稳定化。

### 如果用户更关心交付包

1. Checkpoint。
2. `OI-136`。
3. `DB-2 + DB-11`。
4. Windows ZIP UAT。

### 如果用户更关心当前前端体验

1. Checkpoint。
2. `OI-136`。
3. `FE-NAV`。
4. `FE-CHIP-MATRIX`。
5. `FE-DASHBOARD`。

## 状态维护要求

- 新增任务必须进入本文件或 `current-execution-lines.md`，不能只写在对话里。
- Open Issue 必须进入 `docs/06-implementation/open-issues.md`。
- 阶段计划必须进入 `task_plan.md`。
- 每轮完成后同步 `progress.md`。
