# progress.md

本文件是当前会话恢复入口，只保留最近状态、最近完成事项、关键验证和历史索引。完整执行历史已归档到 `docs/05-archive/progress-history/`。

## 当前状态（2026-06-03）

- 当前分支：`main`。
- 固定预览入口：`http://127.0.0.1:5173/`。前端展示和用户验收默认只看该端口。
- 当前主控主线：`OI-132 / EL-024` 数据加载稳定性已完成三轮治理并关闭；下一步建议在 `OI-133 / EL-025` ArchiMate 建模语言页优化和 `OI-128` 最小用户写入入口之间择一推进。
- Open Issues 当前未关闭：`OI-038`、`OI-128`、`OI-133`。
- 当前禁止事项：不默认改 ETL、数据库、数据模型、导出 JSON、workbench JSON、原始数据或业务关系推断；主展示区不得暴露 `sheet`、`row`、`column`、`raw_value`、`source_file`、`import_id`、`source_id`、`source_ref`、`source_label`、`debug`、`raw`、`metadata`、`intermediate`、`generated_at`。

## 最近完成事项

- 2026-06-03 `OI-132 / EL-024` 第三轮页面级展示基准治理并关闭：按用户截图修复安全能力映射管理视角主关系矩阵里安全职能 chip 被省略号截断的问题；`FocusManagementMapping.js` 为关系对象写入完整文本 `title` / `data-copy-text`，`styles.css` 将管理矩阵关系 chip 改为完整换行显示并可选择复制；同步更新前端展示基准和新增 `audit_frontend_display_contract.mjs`；真实 Chrome 回归确认管理视角 chip `truncated=false`、`copyable=true`，`OI-132` 关闭。
- 2026-06-03 `OI-132 / EL-024` 第二轮对象级空态可信度治理：优先核查 `T-AS.AD-01` 标准 / 框架映射和用户截图中的 `T-PD.PP` 管理视角；确认 `T-PD.PP-01/02/03` 源表 `安全能力-安全工作!G32:G34` 为合并单元格，修复 `parse_security_work_sheet()` 未继承合并单元格值导致后两条关注点显示 `暂无安全工作` 的问题；同时修复 `bootstrap-local-data` 先导出 workbench 后导出 `capability-tree` 导致对象 UUID 不一致、标准 tab 计数回退为 0 的导出顺序问题。已重建本地数据库和前端数据包，生成数据仍在 Git 忽略边界内。
- 2026-06-03 `OI-132 / EL-024` 安全能力清单、知识库字典和标准 / 框架加载稳定性第一轮治理：确认 `/api/v1/data-packages/capability` 有能力 / 关注点描述，而 `/api/v1/capabilities/workspace-initial` 是轻量工作台树且缺描述；修复 `capabilityInitial` 覆盖完整 `capability-tree` 的风险，维护页缺必需包时主动自愈加载，标准 / 框架 active tab 未加载完成时显示加载态，不再把暂时空表渲染成真实空数据；扩展懒加载契约审计。未改 ETL、数据库、数据包或业务字段。
- 2026-06-03 checkpoint 推送：当前 `main` 的 5 个 checkpoint 已推送到 `origin/main`，推送后 `git status --short --branch` 为干净基线；本轮后续改动只来自 `OI-132` 加载治理。
- 2026-06-03 ArchiMate 建模语言页优化评估：只读评估 `/guides/security-architecture-modeling-language` 当前 PDF 图片化方案，新增 `docs/06-implementation/archimate-modeling-page-optimization-plan.md`，并登记 `OI-133 / EL-025`；建议后续从素材陈列升级为区域导航 + 当前区域阅读器 + SAPD 元素映射说明，并优化为首屏只加载默认区域图。
- 2026-06-03 执行线收敛治理入口落地：新增 `docs/07-governance/execution-line-convergence-workflow.md` 和 `docs/07-governance/current-execution-lines.md`，固定“单一主控、单一写入主线、dirty diff 优先验收、checkpoint 后再继续功能”的默认规则，并补充模块线程与页面模块线程到 `EL-xxx` 的映射规则。
- 2026-06-03 Delivery ZIP alpha checkpoint：完成 macOS launcher guard、C/S 客户端交付预研和相关 release / delivery 文档 checkpoint；Windows UAT 仍后置，当前不跳到正式安装包 / Tauri。

## 最近验证

- `node --check frontend/capability-browser/components/FocusManagementMapping.js`：通过。
- `node --check scripts/audit_frontend_display_contract.mjs`：通过。
- `node scripts/audit_frontend_display_contract.mjs`：通过，`result=pass`，确认管理视角主关系矩阵 chip 完整显示 / 可复制基准、组件完整文本属性和基准文档均存在。
- `node scripts/audit_frontend_lazy_load_contract.mjs`：通过，`result=pass`、`issues=[]`。
- `python3 scripts/dev_server_guard.py --status`：通过，`5173` 只有一个项目服务进程。
- `node scripts/frontend_smoke_check.mjs --page capability --route /capability-map --url http://127.0.0.1:5173`：通过，未启动系统 Chrome。
- `node scripts/audit_capability_projection_contract.mjs --url http://127.0.0.1:5173`：提升本地网络权限后通过。
- `node scripts/audit_capability_viewmodel_contract.mjs --url http://127.0.0.1:5173`：提升本地网络权限后通过；`T-AS.AD-01 standardControls=39`，`T-PD.PP` 管理视角对象级数据仍正常。
- `node scripts/frontend_smoke_check.mjs --page capability --route /capability-mapping --url http://127.0.0.1:5173 --allow-system-chrome --debug-port 9361`：真实 Chrome 回归通过，`activeView=capabilities`、`capabilityMap=true`、`consoleIssues=0`。
- `node scripts/frontend_smoke_check.mjs --page capability --route /capability-mapping --url http://127.0.0.1:5173 --allow-system-chrome --debug-port 9363 --workspace-state-json ...`：定向管理视角真实 Chrome 回归通过，`capabilityManagementChipProbe.count=434`、`truncated=false`、`copyable=true`、`consoleIssues=0`。
- `node scripts/govern_open_issues.mjs`：通过，`active=4`、`archived=131`。
- `python3 scripts/check_github_data_boundary.py`：通过。
- `git diff --check`：通过。
- `python3 scripts/sapd_wiki.py bootstrap-local-data --profile full --reset`：通过；本地数据库重建后 `knowledge_items=4660`、`knowledge_relations=7654`、`security_work=92`、`maps_to_work=92`，比修复前增加 12 条合并单元格继承出的安全工作关系。
- `python3 scripts/sapd_wiki.py export-frontend-workbenches`：通过；重新生成与最新 `capability-tree` 对齐的 `capability-workbench.json`，`capability_workbench_relations=6060`。
- `python3 scripts/audit_capability_management_mappings.py --max-issues 20`：通过，`expected_security_work_focuses=91`、`security_work_issue_count=0`。
- `node scripts/audit_capability_projection_contract.mjs --url http://127.0.0.1:5173`：通过，覆盖 `T-AS.AD-01` 标准控制项不为 0、`T-PD.PP-01/02/03` 安全工作继承和 L0/L1/L2/关注点对象级契约。
- `node scripts/audit_capability_viewmodel_contract.mjs --url http://127.0.0.1:5173`：通过；`T-AS.AD-01 standardControls=39`，`T-PD.PP` 三个关注点均带 `边界防护策略持续管理`。
- 上一轮 `git push origin main`：通过，`OI-132` 第一轮 checkpoint 已同步到远端。
- `python3` 本地 API 只读检查：确认 `data-packages/capability` 中 `T-AS.AD`、`T-AS.AD-01/02/03` 均有描述；`workspace-initial` 对应轻量树无描述。
- `node --check frontend/capability-browser/app.js`：通过。
- `node --check scripts/audit_frontend_lazy_load_contract.mjs`：通过。
- `node scripts/audit_frontend_lazy_load_contract.mjs`：通过，`result=pass`、`standardFrameworks=7`、`standardTabs=6`、`issues=[]`。
- `python3 scripts/dev_server_guard.py --status`：通过，`5173` 只有一个项目服务进程，home 和 workspace projection 均正常。
- `node scripts/frontend_smoke_check.mjs --page maintenance --route /knowledge/capabilities --url http://127.0.0.1:5173`：通过，未启动系统 Chrome。
- `node scripts/frontend_smoke_check.mjs --page standards --route /standards/mlps-level-3 --url http://127.0.0.1:5173`：通过，未启动系统 Chrome。
- `node scripts/frontend_smoke_check.mjs --page content --route /guides/security-architecture-modeling-language --url http://127.0.0.1:5173`：通过，未启动系统 Chrome。
- `node scripts/frontend_smoke_check.mjs --page capability --route /capability-map --url http://127.0.0.1:5173`：通过，未启动系统 Chrome。
- ViewModel 静态断言：完整 `capability-tree.json` 构建安全能力清单得到 `fullRows=123`，`T-AS.AD-01` 描述非 `待补充`，且完整树行数据不含 `待补充`；轻量 `capability-workbench.json` 对应节点确认无描述。

## 当前问题索引

- `OI-038`：Gartner 与安全职能候选映射需后续人工校对，状态 `待确认`。
- `OI-128`：USER-WRITE-UI-1：收藏 / 备注最小前端入口，状态 `待实现`。
- `OI-133`：ArchiMate 建模语言页显示效果与加载效率优化，状态 `待设计`。

## 历史索引

| 归档文件 | 内容 |
|---|---|
| `docs/05-archive/progress-history/2026-06.md` | 2026-06 完整执行记录、Open Issues 治理、前端治理、数据口径确认和本轮 progress 瘦身前快照 |
| `docs/05-archive/progress-history/2026-05.md` | 2026-05 完整执行记录、根目录 `progress.md` 瘦身快照和结构治理记录 |
| `docs/05-archive/findings-history/2026-05.md` | 2026-05 历史发现 |
| `docs/05-archive/open-issues-history/2026-06.md` | 已关闭 Open Issues 长记录 |
| `docs/05-archive/context-slimming-2026-05-15/` | 2026-05-15 上下文瘦身快照 |

## 维护规则

- 本文件只保留最近状态、最近 5-10 条重要执行和恢复入口；超过 120 行时继续归档到 `docs/05-archive/progress-history/`。
- 详细过程、长命令输出和阶段性历史不写入根目录 `progress.md`。
