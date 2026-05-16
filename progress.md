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
