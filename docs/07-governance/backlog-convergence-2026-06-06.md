# SAPD Wiki 总 Backlog 收敛表

日期：2026-06-06

目的：把当前散落在 `task_plan.md`、`CURRENT_STATE.md`、`progress.md`、`open-issues.md`、执行线台账、Product Design review、Data Analytics review 和 Delivery 文档中的未开展任务收敛到一个可恢复、可排序、可执行的入口。

本文件不是替代 `task_plan.md`，而是当前阶段的 backlog 排序视图。正式阶段计划仍以 `task_plan.md` 为准；问题状态仍以 `docs/06-implementation/open-issues.md` 为准；执行线恢复仍以 `docs/07-governance/current-execution-lines.md` 为准。

## 当前判断

没有任务丢失。之前的问题是 backlog 分散在多个入口，导致“前端稳定化”看起来像替代了整个项目计划。

当前需要先做一轮收敛，而不是直接开新功能：

1. 先把 `OI-128C` 和当前 dirty worktree 做 checkpoint，降低回退成本。
2. 2026-06-06 用户调整优先级：`analytics_summary` 是 P0，但不独占当前最高优先级；`OI-136 / FE-ROUTE` 与只读 subagent 评估项也暂时不抢主线。
3. 当前已完成 `OI-135 + DB-11 + DB-2` 正式迁移脚本三段式：`scripts/migrate_db_contracts.mjs`。Delivery Bundle / 打包任务先往后排；`analytics_summary` 已完成 dashboard 消费，后续只按视觉或业务反馈小修。

## Backlog 总览

| 优先级 | 工作包 | 包含任务 | 当前状态 | 推荐处理 |
|---|---|---|---|---|
| Gate 0 | Dirty worktree checkpoint | `OI-128C` 批注收口、全局批注基线、批注脚本、当前设计审阅产物 | 已完成 | 已拆成 `b93a9f1` 批注基线和 `e23c6d7` backlog / 设计计划两个 checkpoint；当前工作区已清理，进入 P0 主线队列 |
| P0 | `analytics_summary` 落地 | exporter、`data_package_summary`、`dataClient.getAnalyticsSummary()`、dashboard 消费、audit 脚本 | 已完成 / 已提交 | 首页已只消费 `analyticsSummary`，后续只按视觉或业务反馈小修 |
| P1 | 深层路由稳定性 | `OI-136`、`FE-ROUTE` | 已修复 / 已归档 | 已修直接访问 `/guides/*`、`/knowledge/*`、`/standards/*` 掉样式，并纳入轻量 smoke；已随 checkpoint 提交并从当前 Open Issues 移入归档 |
| P0 | 用户库长期治理 | `OI-135`、`DB-11`、`user_notes`、旧 `user_favorites`、数据篮 / 导出 / 自定义能力 | 正式迁移脚本完成 / 真实库 apply 待显式确认 | `scripts/migrate_db_contracts.mjs` 已验证默认 dry-run、临时库 apply、自动备份和真实项目库写入确认门 |
| P0 | 稳定键与基础库升级兼容 | `DB-2 stable_key`、deterministic ID、`base_id_redirects` | 正式迁移脚本完成 / 真实库 apply 待显式确认 | 临时复制基础库已验证正式 `stable_key` / `stable_ref` / `public_id` 字段和 `base_id_redirects` 最小 migration，真实库未写入 |
| P1 | Delivery Bundle 1.0-alpha | `BE-6`、`DB-6/7/9`、Windows x64 实测、诊断包、release manifest | macOS alpha 已准备，Windows 未验证；优先级后排 | 待 user DB / stable_key 前置设计稳定后再恢复；不要和前端 UI 混写 |
| P1 | 前端设计基线稳定化 | `FE-BASELINE-STABILIZE` 建议包：`FE-NAV`、`FE-ANNOTATION-UX`、`FE-CHIP-MATRIX`、`FE-DASHBOARD` | 待拆分 | 先只读审阅，逐项小步实现 |
| P1 | 页面模块继续验收 | 安全能力、LC-AP / LC-DT、信息化环境、知识库字典、标准 / 框架、指南页 | 多数已有实现或待验收 | 只读 Gap Check 起步；写入必须单页面单线 |
| P1/P2 | ArchiMate 建模语言页优化 | `OI-133 / EL-025` | 待设计 | 先按优化计划确认阅读路径和加载策略 |
| P0 | Dashboard 工作入口化 | `dashboard-and-module-data-display-optimization-design.md`、`analytics-summary-json-contract-draft.md` | 设计完成，计划已补入 `task_plan.md` | 先生成 `analytics-summary.json`，再接入摘要检查、dataClient、dashboard 和审计 |
| P2 | 数据质量 / 字典一致性 | `EL-007`、字典引用一致性、候选映射校对 | 暂停 / 待确认 | 单独数据治理线，不和前端混修 |
| P2 | Gartner 人工校对 | `OI-038` | 待确认 | 用户业务确认任务；Codex 只提供辅助表和校对视图 |
| 后置 | 成熟度评估模块 | `FE-M`、`BE-M`、M1.3 / M2 / M3 | 待启动 / 另线 | 用户重新指定后再启动 |
| 后置 | C/S 客户端 / Tauri / 安装包增强 | `EL-005`、`DB-8`、C/S presearch | 后置 | ZIP alpha 成立后再评估 |
| 后置 | 多格式增强 / AI RAG | Phase 7、Phase 10 | 后置 | 当前不启动 |

## 当前 P0 主线队列

### 1. 当前下一步：用户库长期治理 + `stable_key`

理由：这条线直接支撑批注、收藏、数据篮、导出、自定义能力、Delivery Bundle 和基础库升级兼容，属于后续很多功能的底座。建议先做设计和迁移策略，不直接改前端。

第一轮设计已完成，入口为：

- `docs/06-implementation/user-database-governance-and-stable-key-design.md`

审计入口已完成：

1. `scripts/audit_user_db_governance_contract.mjs`
2. `scripts/audit_stable_key_contract.mjs`
3. `docs/06-implementation/user-db-compatibility-report-2026-06-06.md`
4. `scripts/plan_user_schema_0_3_migration.mjs`
5. `docs/06-implementation/base-stable-key-and-redirect-migration-design-2026-06-06.md`

后续实施建议拆分：

1. `OI-135 / DB-11 / DB-2`：正式迁移脚本三段式已完成，真实项目库未写入，后续 apply 必须显式确认并自动备份。
2. 如继续 DB 线：进入最小 API，数据篮或工作台二选一，不同时开。
3. 如恢复 Delivery Bundle：先决定是否把真实基础库 / 用户库 apply 纳入发布前步骤，再做 Windows ZIP UAT。

### 2. 同级 P0：`analytics_summary`

目标：把 Data Analytics 会话的 dashboard 方案从设计文档落成稳定数据契约和实施任务。该 P0 已完成，后续只按视觉或业务反馈小修。

实施顺序：

1. 已完成 exporter 生成本地 `frontend/capability-browser/public/data/analytics-summary.json`，生成包不提交到 Git。
2. 已完成 audit 脚本验证覆盖率、标准控制项 grain 和禁止字段泄露。
3. 已完成 `scripts/data_package_summary.py` 增加 `analytics-summary` 摘要检查。
4. 已完成 `dataClient.getAnalyticsSummary()` 统一 API / 离线包 fallback。
5. 已完成 dashboard 消费 `analytics_summary`，从工程统计页转为安全能力知识地图入口。

### 3. 已下调但仍需保留的问题：`OI-136 / FE-ROUTE`

`OI-136 / FE-ROUTE` 已随 checkpoint 提交并归档。后续如发现深层路由新问题，按新问题登记，不与 `analytics_summary` exporter、dashboard 消费或批注 UI 混在同一提交。

## 已下调的可并行只读评估

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

### C. Delivery Bundle（后排）

入口：`BE-6`、`DB-6`、`DB-7`、`DB-9`。

当前 macOS arm64 alpha 已准备，Windows 仍 `pending / not_verified`。用户已要求打包任务往后排；后续待 user DB / `stable_key` 前置设计稳定后再恢复。

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

1. 当前两个 P0 已完成代码闭环：`analytics_summary` dashboard 消费，以及 `OI-135 + DB-11 + DB-2` 正式迁移脚本三段式。
2. 下一条主线建议进入用户工作台 / 数据篮 / 导出最小 API 二选一。
3. Delivery Bundle 继续后排，待决定真实库 apply 和 Windows UAT 顺序后恢复。

### 如果用户更关心交付包

1. Checkpoint。
2. `DB-2 + DB-11` 真实迁移脚本设计确认。
3. Windows ZIP UAT。

### 如果用户更关心当前前端体验

1. Checkpoint。
2. `analytics_summary` exporter / audit。
3. `FE-DASHBOARD`。
4. `FE-NAV`。
5. `FE-CHIP-MATRIX`。

## 状态维护要求

- 新增任务必须进入本文件或 `current-execution-lines.md`，不能只写在对话里。
- Open Issue 必须进入 `docs/06-implementation/open-issues.md`。
- 阶段计划必须进入 `task_plan.md`。
- 每轮完成后同步 `progress.md`。
