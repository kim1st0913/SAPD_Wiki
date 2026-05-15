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
