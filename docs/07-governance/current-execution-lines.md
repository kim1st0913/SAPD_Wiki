# 当前执行线台账

本文档是“暂停但不丢失”的任务看板。它记录当前已经展开、容易被多会话打散的执行线，帮助主控在收敛期间不遗忘任何任务。

状态口径：

- `当前主线`：当前唯一建议写入主线。
- `运行中`：Codex thread 仍处于 active / inProgress；主控只做 fan-in，不抢写同一范围。
- `待验收`：已有改动或产物，先验收再决定 checkpoint。
- `暂停`：不继续写入，但保留恢复入口。
- `后置`：当前不处理，除非用户重新指定。
- `待确认`：需要用户业务判断。
- `归档参考`：历史线程或重复线程，只作为证据来源，不作为当前恢复入口。

## 当前唯一建议主线

| 执行线 | 状态 | 为什么现在排第一 | 下一步 |
|---|---|---|---|
| Dirty worktree 验收与 checkpoint | 当前主线 | 当前工作区已有多主题未提交改动；不先验收会继续扩大回退成本 | 按文件组看局部 diff，跑对应治理脚本，决定 checkpoint / 修正 / 暂停 |

## EL-001 验收快照（2026-06-03）

本轮主控只做 dirty worktree 验收和基线验证，未 stage、未 commit、未回退文件。当前工作区仍在 `main`，本地领先 `origin/main` 1 个提交，且没有 staged 文件。

| 文件组 | 主要文件 | 验收结论 | 主控建议 |
|---|---|---|---|
| 执行线 / 治理收敛 | `CURRENT_STATE.md`、`docs/07-governance/current-execution-lines.md`、`docs/07-governance/execution-line-convergence-workflow.md`、`docs/07-governance/codex-performance-workflow.md`、`docs/07-governance/governance-index.md`、`progress.md` | 方向正确，解决多线程、长会话和主控交接问题 | 可作为独立 checkpoint；后续新会话优先恢复本文档 |
| Open Issues / 安全能力加载治理 | `docs/06-implementation/open-issues.md`、`open-issues-index.md`、`open-issues-history/2026-06.md`、`capability-mapping-change-control.md` | `OI-132` 已按三轮治理关闭；`OI-133` 保留待设计；`govern_open_issues` 通过后应为 active=3 | 可作为治理 checkpoint；后续恢复时不要重新打开 `OI-132`，除非出现新的复现证据 |
| ArchiMate / 安全指南前端 | `frontend/capability-browser/app.js`、`styles.css`、`AppShell.js`、`index.html`、`archimate-modeling-page-optimization-plan.md` | 当前改动可运行，但效果仍未达到目标；已登记 `OI-133 / EL-025` | 可保留为当前版本 checkpoint，但下一轮必须单线优化，不继续混写其他页面 |
| LC-DT / 生命周期页面 | `ApplicationSecurityLifecycle.js`、`viewModels.js`、`styles.css`、`index.html` | 语法、数据包摘要和 `/data-security` 轻量 smoke 通过 | 可作为前端修正 checkpoint；不再扩大到数据源或 ETL |
| 安全能力页 tab / 矩阵滚动 | `CapabilityLocalRelationMap.js`、`styles.css`、`index.html` | 语法、能力页 smoke、projection / ViewModel 审计通过；但截图问题显示 UI 空态仍不可信 | 可保留已通过的小修；后续进入 `EL-024` 时必须先做加载状态诊断 |
| 安全知识目录表格 | `TechnicalServiceMaintenanceTable.js`、`styles.css` | 语法和 `/knowledge/technical-services` 轻量 smoke 通过 | 可作为前端表格展示 checkpoint |
| Delivery ZIP alpha | `scripts/build_zip_bundle.py`、`scripts/start-macos.command` | `py_compile` 和 `sh -n` 通过；GitHub 数据边界通过 | 可作为 Delivery 脚本独立 checkpoint；不默认启动 Windows UAT |
| C/S 客户端预研 | `docs/09-delivery/cs-client-delivery-presearch-macos-windows.md`、`findings.md` | 属于长期路线预研，不替代当前 ZIP alpha | 可保留为后置预研文档；不进入当前实现 |
| 字典引用一致性 | `lifecycle-workbench.json`、`environment-workbench.json`、维护包候选映射（当前未直接 dirty） | `audit_dictionary_reference_consistency` 仍失败：issues=615、errors=337、warnings=278 | 不阻塞本轮前端 / 治理 checkpoint；单独保留为 `EL-007` 数据治理线 |

关键验证结果：

- `git diff --check`：通过。
- `node --check` 覆盖 `app.js`、`viewModels.js`、`AppShell.js`、`ApplicationSecurityLifecycle.js`、`CapabilityLocalRelationMap.js`、`TechnicalServiceMaintenanceTable.js`：通过。
- `node scripts/govern_open_issues.mjs`：通过，`active=4`、`archived=131`。
- `node scripts/audit_frontend_lazy_load_contract.mjs`：通过。
- `node scripts/audit_frontend_route_refresh_contract.mjs`：通过。
- `python3 scripts/check_github_data_boundary.py`：通过。
- `python3 scripts/dev_server_guard.py --status`：通过，固定 `5173` 只有一个项目服务。
- `python3 -m py_compile scripts/build_zip_bundle.py`、`sh -n scripts/start-macos.command`：通过。
- `python3 scripts/data_package_summary.py --package lifecycle-workbench`：通过，`data_state=ready`。
- 轻量 smoke：`/`、`/capability-map`、`/guides/security-architecture-modeling-language`、`/data-security`、`/knowledge/technical-services` 均通过，未启动系统 Chrome。
- `node scripts/audit_capability_viewmodel_contract.mjs --url http://127.0.0.1:5173`：提升本地网络权限后通过；`T-AS.AD-01` 返回 `standardRows=1`。
- `node scripts/audit_capability_projection_contract.mjs --url http://127.0.0.1:5173`：提升本地网络权限后通过。
- `node scripts/audit_dictionary_reference_consistency.mjs`：失败，属于既有数据治理线，不在本轮混修。

主控 checkpoint 建议：不要做一个总提交。建议拆成至少 4 个 checkpoint：治理收敛与 Open Issues、前端页面修正、Delivery ZIP alpha 脚本、C/S 客户端预研。前端页面修正内部如需更细，可继续拆为 ArchiMate / LC-DT / capability / knowledge table。

## 模块线程映射

模块线程不是执行线本身。模块线程是工作区，执行线是可验收任务。一个模块线程可以对应多个执行线，但同一时间只能有一个线程拥有写入权。

| 模块线程 | 建议线程类型 | 对应执行线 | 默认权限 | fan-in 给主控的内容 |
|---|---|---|---|---|
| 主控 / 收敛线程 | 主控会话 | EL-001、EL-002、全部执行线排序 | 可写 | 最终采纳、checkpoint、状态入口更新 |
| 前端 / ArchiMate 图例线程 | 辅助或临时写入 | EL-003 | 默认只读；写入需用户确认 | UI 改动范围、截图 / smoke 证据、是否可 checkpoint |
| ArchiMate 建模语言页优化线程 | 后续设计 / 性能优化 | EL-025 | 当前只读评估；实现需单线写入 | 页面阅读路径、区域导航、图片加载策略、SAPD 映射说明 |
| Delivery / macOS ZIP 线程 | 辅助或临时写入 | EL-004 | 默认只读；脚本写入需单独授权 | 启动脚本、ZIP、checksum、诊断结果 |
| Delivery / C/S 客户端预研线程 | 辅助只读 | EL-005 | 只读或单文档草案 | 路线建议、风险、后置条件 |
| Open Issues 治理线程 | 主控优先 | EL-006 | 主控可写；辅助只给草案 | active / archived 数量、归档差异、待确认 issue |
| 数据字典 / 引用一致性线程 | 辅助只读或单线写入 | EL-007、EL-010 | 默认只读；修复时单线写入 | mismatch 分类、权威 ID 证据、修复建议 |
| 用户写入 / 收藏备注线程 | 后续写入线程 | EL-008 | 暂停；恢复后单线写入 | API / UI / user DB 验收结果 |
| Gartner 校对线程 | 用户确认线程 | EL-009 | 只读 | 候选映射清单、需用户接受 / 删除 / 调整项 |
| Windows ZIP UAT 线程 | 后置验证线程 | EL-011 | 后置只读 | Windows 实机构建和 UAT 结果 |
| Frontend Baseline 后续线程 | 后置设计 / Gap Check | EL-012 | 只读 Gap Check 起步 | 页面缺口、字段边界、组件一致性建议 |
| 安全能力映射数据加载治理线程 | 主控单线治理 | EL-024 | 当前只读诊断；实现需单线写入 | workspace-view、projection、fallback、tab rows、空态原因和回归审计 |
| maturity 线程 | 后置模块线程 | EL-013 | 后置 | maturity 专用数据契约和后续范围 |
| 数据库清理线程 | 归档参考 / 单线维护 | EL-021 | 默认只读；清理需单线写入 | 数据库备份保留规则、清理脚本、清理证据 |
| 5173 卡住排查线程 | 归档参考 / 运行稳定性 | EL-022 | 默认只读 | 服务状态、页面卡住根因、按需加载风险 |
| 配色 demo 线程 | 后置视觉基准 | EL-023 | 后置只读 | Apple Morandi 配色 demo、可采纳的全局视觉 token |
| 旧主控 / Gap Check 线程 | 已归档参考 | EL-001 | 只读 | 历史 checkpoint、历史差距检查结论，不能替代当前 dirty diff |

映射规则：

- 线程名可以按模块命名，但必须在输出中声明对应 `EL-xxx`。
- 同一线程发现跨模块问题时，只记录，不跨范围写入。
- 辅助线程不能直接改 `CURRENT_STATE.md`、`progress.md`、`task_plan.md`、`findings.md`、`open-issues.md`。
- 主控决定是否采纳辅助线程结果，并负责更新本文档。

## 页面模块设计线程映射

页面模块线程用于追踪“某个产品页面 / 工作台 / 目录页”的设计、数据契约和前端实现状态。它们可以由不同线程并行做只读 Gap Check，但写入仍必须回到单一主控。

| 页面模块线程 | 页面类型 | 对应执行线 | 当前状态 | 默认权限 | fan-in 给主控的内容 |
|---|---|---|---|---|---|
| 安全能力映射页面线程 | `capability-mapping-workbench` | EL-016、EL-024 | 待验收 | 当前先只读验收；修复需单线写入 | 对象级契约、左侧选中、图谱中心、三视角矩阵、字段边界、数据加载可信度 |
| 安全指南页面线程 | `document-hub` / `document-page` | EL-014、EL-025 | 待验收 | 当前只验收已有 dirty diff | 安全架构建模语言页、元素图例、文案、页面阅读结构、图片加载效率 |
| 标准 / 框架页面线程 | `standard-framework-directory` / `standard-framework-page` | EL-015 | 暂停 | 只读 Gap Check | 标准索引、tab loader、分包加载、条款 / 控制项展示边界 |
| 安全知识目录线程 | `knowledge-directory` / `knowledge-reference-page` | EL-017 | 待验收 | 当前先只读验收 | 作用域、技术服务、模块 / 措施、管理工作、职能、岗位参考页面状态 |
| 信息化环境维度线程 | `environment-mapping-workbench` | EL-018 | 后置 | 只读 Gap Check 起步 | 环境 / 对象 / 作用域 / 服务 / 系统 / 产品关系缺口 |
| LC-AP / LC-DT 生命周期线程 | `domain-module` | EL-019 | 待验收 | 当前先只读验收 | LC-AP / LC-DT 表格、矩阵、阶段 / 活动 / 策略关系和字段边界 |
| 应用壳 / 全站导航线程 | `application-shell` | EL-020 | 待验收 | 当前先只读验收 | 左侧导航、二级菜单、路由描述、页面标题区和全局一致性 |
| SAPD 成熟度评估页面线程 | `domain-module` | EL-013 | 后置 | 后置 | maturity 专用填报、结果、报告入口，不并入关系工作台 |

页面模块线程规则：

- 页面线程不等于“前端随便改”。页面线程必须同时说明页面类型、数据入口、当前验收目标和禁止范围。
- 同一页面线程可以发现数据契约问题，但不能在页面组件里临时生成业务事实。
- 标准 / 框架、安全知识目录、安全指南这类页面不是三页关系工作台的附属品；需要独立登记和验收。
- 页面模块线程如需写入 `app.js`、`styles.css`、`dataClient` 或 ViewModel，必须先回到 EL-001 dirty diff 验收和对应治理脚本。

## 执行线清单

| 编号 | 执行线 | 状态 | 当前证据 / 入口 | 恢复条件 | 下一步 |
|---|---|---|---|---|---|
| EL-001 | Dirty worktree 验收与 checkpoint | 当前主线 | `git status --short --branch` 显示 `main` ahead 1，且前端、治理文档、Delivery 脚本仍有未提交改动 | 任何新功能开始前 | `git diff --stat` 后按主题验收：前端 UI、治理文档、Delivery 脚本、Open Issues 归档 |
| EL-002 | 执行线收敛治理 | 待验收 | `docs/07-governance/execution-line-convergence-workflow.md`、本文档、`CURRENT_STATE.md` | 用户确认此工作流可作为后续默认方式 | 将本台账作为新会话恢复入口；必要时 checkpoint |
| EL-003 | ArchiMate / SAPD 元素图例前端修正 | 待验收 | 当前 dirty diff 涉及 `app.js`、`styles.css`、`index.html`、`AppShell.js`，`progress.md` 已记录多轮浏览器标注反馈 | 先完成 EL-001；若继续改前端，必须按页面和文件组分开 | 只读核对 UI 改动范围，跑 `node --check`、页面 smoke、必要时浏览器截图 |
| EL-004 | macOS ZIP alpha `Killed: 9` 启动提示修复 | 待验收 | dirty diff 涉及 `scripts/build_zip_bundle.py`、`scripts/start-macos.command`；`progress.md` 记录已替换发行 ZIP 与 checksum | 先完成脚本语法和打包边界验证；不默认推进 Windows UAT | 验证 `py_compile`、`sh -n`、`check_github_data_boundary.py`，确认是否 checkpoint |
| EL-005 | C/S 客户端交付预研 | 暂停 | 新增未跟踪文档 `docs/09-delivery/cs-client-delivery-presearch-macos-windows.md`，`findings.md` 有长期决策入口 | ZIP alpha 收口后，或用户重新要求 C/S 客户端路线 | 仅保留为长期预研，不替代 ZIP alpha |
| EL-006 | Open Issues 轻量治理 | 待验收 | `open-issues.md` 当前 4 个未关闭问题；归档和 index 有 dirty diff | EL-001 中按文档组验收 | 跑 `node scripts/govern_open_issues.mjs`，确认 active / archived 数量 |
| EL-007 | 权威字典引用一致性 | 暂停 | `node scripts/audit_dictionary_reference_consistency.mjs` 曾报告引用 ID 不一致；属于数据治理线 | Dirty diff checkpoint 后，且不要和前端 UI 同时改 | 作为单独数据治理任务处理，不在前端临时修 |
| EL-008 | `OI-128` 收藏 / 备注最小前端入口 | 暂停 | `open-issues.md` 记录待实现；建议先做收藏，再做备注 | EL-001 完成；ID / user DB 边界确认；用户同意先做收藏 | 先写最小验收：点击收藏 -> 写入 user DB -> 重启保留 -> base DB 不变 |
| EL-009 | `OI-038` Gartner 候选映射人工校对 | 待确认 | `open-issues.md` 记录候选映射仅可用于页面格式，不是最终正式关系 | 用户准备逐条校对候选 CSV | 只做事实展示和校对辅助，不把候选映射升级为正式关系 |
| EL-010 | Delivery Bundle `stable_key` / deterministic ID | 暂停 | `task_plan.md` 中 DB-2 为 P0 待启动；`findings.md` 记录缺少稳定业务键风险 | Dirty diff 收口后，且准备进入用户库 / 升级兼容 | 单独做数据设计和最小实现，不与前端 UI 混改 |
| EL-011 | Windows ZIP UAT | 后置 | 用户已明确当前不建议做 Windows UAT；Windows manifest 仍 `pending / not_verified` | 用户重新要求或 macOS alpha / user write 闭环稳定 | 不默认启动 |
| EL-012 | Frontend Baseline 1.0 后续页面 / 共同组件 | 后置 | `task_plan.md` 中 FE-1、FE-2、FE-4、FE-5 仍待启动或后置 | 当前前端治理基线通过且 dirty diff 已 checkpoint | 先做 Gap Check，不直接实现 |
| EL-013 | maturity 模块后续 | 后置 | `task_plan.md` 中 M1.3 / M2 / M3 待确认或后置 | 用户重新指定 maturity 为主线 | 不默认启动 |
| EL-014 | 安全指南页面模块设计 | 待验收 | 当前 dirty diff 涉及 `/guides/security-architecture-modeling-language`、`AppShell.js`、`app.js`、`styles.css`；页面类型来自 `frontend-menu-and-page-type-definition-v1.md` 的 `document-hub` / `document-page` | EL-001 完成后；如继续页面设计，先只读验收当前安全指南页 | 核对安全架构建模语言页是否符合指南页 / 文档页定位，避免变成杂糅工作台 |
| EL-015 | 标准 / 框架页面模块设计 | 暂停 | 标准 / 框架页面类型已定义；`audit_frontend_lazy_load_contract.mjs` 是当前加载契约入口 | EL-001 完成后，且用户要求继续标准 / 框架页面 | 只读 Gap Check：目录页、单标准页、tab loader、分包和字段边界 |
| EL-016 | 安全能力映射页面模块设计 | 待验收 | 当前 dirty diff 涉及 `CapabilityLocalRelationMap.js`、`styles.css`；对象级契约 `/api/v1/capabilities/workspace-view` 已接入 | EL-001 完成后；继续安全能力页必须跑对象一致性审计 | 核对当前页面是否仍符合核心工作台定位，不把指南、标准、知识目录逻辑混进能力页 |
| EL-017 | 安全知识目录 / 知识库字典页面模块设计 | 待验收 | 当前 dirty diff 涉及 `TechnicalServiceMaintenanceTable.js`；知识目录使用 `maintenance-index` + 分片加载 | EL-001 完成后；不恢复大一统 JSON | 核对各目录页表格、详情、候选映射、来源证据和字段边界 |
| EL-018 | 信息化环境维度页面模块设计 | 后置 | 第一版环境 workbench 已完成；页面类型为 `environment-mapping-workbench` | 用户重新指定或三页基线继续推进 | 只读 Gap Check：对象主语、作用域、服务、模块、系统、产品关系 |
| EL-019 | LC-AP / LC-DT 生命周期页面模块设计 | 待验收 | 当前 dirty diff 涉及 `ApplicationSecurityLifecycle.js`；生命周期 workbench 数据包为当前入口 | EL-001 完成后；不把 LC-AP 参考数据塞入同页参考区 | 核对阶段 / 活动 / 策略 / 服务 / 模块 / 措施矩阵和字段边界 |
| EL-020 | 应用壳 / 全站导航模块设计 | 待验收 | 当前 dirty diff 涉及 `AppShell.js`；页面类型为 `application-shell` | EL-001 完成后；不与页面内容改动混写 | 核对左侧导航、二级页面、标题描述、路由和页面类型一致性 |
| EL-021 | 数据库备份清理 / retention 规则 | 归档参考 | 线程 `019e8293-ce9f-7d52-a3f2-61792f29c07a` 已完成旧备份清理，只保留最新备份，并新增 `scripts/prune_database_backups.py` 和备份保留 manifest | 只有当再次清理数据库备份或调整保留策略时恢复 | 当前只保留规则和证据，不纳入前端 / Delivery 主线 |
| EL-022 | 5173 服务稳定性 / 页面卡住排查 | 归档参考 | 线程 `019e82a9-691f-7593-829d-03e3ea1a5c06` 定位 `/knowledge/functions` 卡住根因：首屏依赖过重，`maintenance-knowledge.json` 拆包后需先加载 `maintenance-index` 和主分片 | 再次出现 5173 卡住、空白、chunk 长时间 pending 时恢复 | 先查 `dev_server_guard.py --status` 和页面 required / supplemental 声明，不直接重启或改大 JSON |
| EL-023 | Apple Morandi 配色 demo / 全局视觉基准 | 后置 | 线程 `019e72f1-f6f8-7fa0-b9ef-378551251726` 产出 `apple-morandi-color-demo.html`、`DESIGN.md` 配色基准和 handoff | 用户要求继续全局视觉统一，或页面 Gap Check 需要统一色彩 token 时恢复 | 只作为设计参考，不在 dirty diff 未验收前改 `styles.css` |
| EL-024 | 安全能力映射数据加载稳定性治理 | 已修复 / 可归档 | `OI-132`；2026-06-03 第一轮已修复能力清单 / 知识库字典 / 标准框架类页面的加载竞态入口；第二轮已修复 `安全能力-安全工作` 合并单元格未继承导致的 `T-PD.PP-02/03` 安全工作空值，以及 `bootstrap-local-data` 先导出 workbench 后导出 `capability-tree` 导致 UUID 不一致、`T-AS.AD-01` 标准 tab 计数为 0 的问题；第三轮已补齐管理视角主关系矩阵完整显示 / 可复制基准，真实 Chrome 回归确认管理视角 chip `truncated=false`、`copyable=true` | 数据契约、主关系矩阵展示基准、轻量 smoke、对象级审计和真实浏览器回归均已通过 | 后续若继续改安全能力页，必须先跑 `audit_capability_projection_contract.mjs`、`audit_capability_viewmodel_contract.mjs`、`audit_frontend_display_contract.mjs` 和能力页真实 smoke；不要用局部空态补丁覆盖对象级问题 |
| EL-025 | ArchiMate 建模语言页显示与加载效率优化 | 待设计 | `OI-133`；当前页面已从 PDF iframe 改为整页 JPG + 6 个区域 JPG + 下载按钮，但仍像素材陈列，缺少区域导航、阅读路径、SAPD 映射说明和受控加载策略 | EL-001 完成后；若继续安全指南页，先按 `archimate-modeling-page-optimization-plan.md` 做设计确认 | 先做 P1 区域导航 + 当前区域阅读器，首屏只加载默认区域；再补 SAPD 元素图例与 ArchiMate 区域映射 |

## 实际 Codex 线程盘点

本节按 Codex thread id 记录当前工程下已发现的线程。盘点口径：仅纳入 cwd 为 `/Users/kim1st/Documents/kim note/06_dev_projects/SAPD_Wiki` 的线程；其他目录的 MarkItDown、Playground、个人笔记脚本等线程不纳入本项目执行线。

| Thread id | 线程标题 | Codex 状态 | 映射执行线 | 角色 / 当前处理 |
|---|---|---|---|---|
| `019e8b6d-8ae3-7d20-8436-3024c4683891` | `product design Review` | active / inProgress | EL-001、EL-002、全部执行线 | 当前主控收敛线程；负责读取全线程、更新治理入口和最终 fan-in |
| `019e8246-0825-7292-a542-87631d98f6dd` | `archimate建模` | idle | EL-003、EL-014、EL-025 | 已完成 PDF 图片化和区域阅读初版；当前效果待验收，后续优化走 EL-025 |
| `019e6d81-0a90-7fb2-966c-515fe4890b07` | `交付打包` | idle | EL-004、EL-005、EL-011 | macOS ZIP alpha、`Killed: 9`、Windows UAT 和 C/S 预研参考；下一步先只读验收 dirty diff |
| `019e7eca-4622-7862-b1be-6333f8392b10` | `治理会话2` | idle | EL-006、EL-007、EL-016、EL-001 | Open Issues 瘦身、字典治理、能力页契约和交接说明来源；作为当前治理事实入口 |
| `019e826e-2c7d-7e81-8d37-580a5937104f` | `前端设计3` | notLoaded | EL-020、EL-014、EL-017、EL-018、EL-019 | 应用壳、左侧导航、页面标题、Archimate 图例文字基线；后续只做页面 Gap Check 来源 |
| `019e5e7c-477d-7df0-aa6a-3c99de853ea8` | `开发安全页面2` | idle | EL-019 | LC-AP / LC-DT 页面细节修改来源；先验收现有生命周期 dirty diff |
| `019e4aca-49b0-7830-bb22-81707ab73286` | `安全指南页面1` | notLoaded | EL-014、EL-003、EL-025 | 安全指南、建模语言页、元素图例和 PCF 文案来源；与 ArchiMate 优化线合并验收 |
| `019e8b3e-2aaa-7e02-adac-eb78ae811358` | `预研 Mac 和 Windows OS 兼容性` | notLoaded | EL-005、EL-011 | C/S 客户端路线预研；保持后置，不替代当前 ZIP alpha 验收 |
| `019e8914-249b-7fd3-9621-9c84295219f2` | `archimate语义 分析` | notLoaded | EL-003、EL-014、EL-025 | ArchiMate / SAPD 语义映射、registry、draw.io / HTML 嵌入证据来源 |
| `019e6741-6102-7460-bf27-14ccb2204851` | `安全能力图谱4` | notLoaded | EL-016、EL-007、EL-012 | 安全能力映射页、ViewModel、滚动容器、矩阵和字典一致性来源；不要与前端设计线程混写 |
| `019e822d-b4e3-77b0-905a-daca8b864f9f` | `安全知识页面2` | notLoaded | EL-017、EL-012 | 知识库字典、技术服务维护表、字段展示边界和分片加载来源 |
| `019e8293-ce9f-7d52-a3f2-61792f29c07a` | `清理数据库垃圾和陈旧数据` | idle | EL-021 | 数据库备份清理已完成；当前作为 retention 规则和脚本证据，不再展开 |
| `019e82a9-691f-7593-829d-03e3ea1a5c06` | `排查5173页面卡住` | idle | EL-022 | 页面卡住和分片加载根因参考；服务问题先查 required / supplemental 和 guard |
| `019e2725-e53e-7a41-9be8-690e19024894` | `主控V3` | archived | EL-001 | 已归档为历史 checkpoint / Gap Check 参考；不能替代当前工作区状态 |
| `019e4615-baf4-7822-85dd-2fe4dbf32327` | `信息化环境安全能力1` | notLoaded | EL-018、EL-016、EL-012 | 信息化环境维度 workbench、五列表格和关系页面参考；当前后置 |
| `019e4f25-c649-7db2-ab70-ffdcf19a8b6e` | `数据安全页面1` | active / inProgress | EL-019 | LC-DT 数据生命周期页面细节来源；当前运行中，先等输出再与 `开发安全页面2` 合并验收 |
| `019e72f1-f6f8-7fa0-b9ef-378551251726` | `demo配色` | idle | EL-023、EL-020、EL-012 | Apple Morandi 视觉基准来源；dirty diff 未验收前不改 CSS |
| `019e7266-31eb-7500-9454-8797c0a9cd46` | `安全能力图谱5` | notLoaded | EL-016、EL-007 | `安全能力图谱4` 的重复 / 旧参考线程；仅归档参考，不作为恢复入口 |

线程处理规则：

- 运行中的 `数据安全页面1` 线程不关闭、不打断；主控只记录范围，等产出后再 fan-in。`archimate建模` 已进入 idle，当前作为 EL-025 待验收来源。
- `安全能力图谱4` 和 `安全能力图谱5` 内容重复时，以更新更近、信息更完整的 `安全能力图谱4` 为参考入口。
- `数据安全页面1` 与 `开发安全页面2` 都归入 EL-019，后续只开一条 LC-AP / LC-DT 验收线。
- `安全指南页面1`、`archimate语义 分析`、`archimate建模` 都和 ArchiMate / 安全指南相关，后续统一并入 EL-025，当前只能有一个写入线程。
- 所有 idle / notLoaded 线程默认不继续写入；需要恢复时先回到 EL-001 dirty diff 验收。

## 线程归档与接手评估

归档不是删除任务，而是把旧线程从“可继续工作入口”降级为“历史证据来源”。归档前必须满足三件事：thread id 已登记、结论已 fan-in 到本文档或相关治理文档、没有 active / inProgress 状态。

| 处理分类 | 线程 | 建议动作 | 原因 |
|---|---|---|---|
| 当前主控保留 | `product design Review` | 不归档，由当前会话继续 EL-001 / EL-002 | 当前主控负责线程收敛、dirty diff 验收和 checkpoint 判断 |
| 运行中保留 | `数据安全页面1` | 暂不归档，不抢写；等产出后 fan-in | 该线程仍为 active / inProgress，直接归档会丢失正在执行的上下文 |
| 主控接手 | `治理会话2`、`交付打包` | 暂不继续原线程；由主控在 EL-001 验收时接手其产物 | 两者已有明确产物和 dirty diff，需要主控统一判断是否采纳 / checkpoint |
| 当前会话接手 | `前端设计3`、`安全能力图谱4`、`安全知识页面2`、`开发安全页面2`、`信息化环境安全能力1` | 不再作为独立写入线程；主控按 EL-016 到 EL-020 分页面验收 | 这些线程都指向前端公共文件，继续多线程写入会再次冲突 |
| 主控接手后可归档 | `archimate建模`、`安全指南页面1`、`archimate语义 分析` | 先按 EL-025 合并结论和优化计划，再由用户确认是否归档旧线程 | ArchiMate 相关线程已形成当前页面产物和后续优化方向，不应继续分散写入 |
| 可直接归档为参考 | `安全能力图谱5`、`demo配色`、`排查5173页面卡住`、`清理数据库垃圾和陈旧数据` | 用户确认后可在 Codex App 中归档 | 结论已登记为归档参考或重复线程，不应再作为恢复入口 |
| 已归档参考 | `主控V3` | 已在 Codex App 中归档 | 历史主控入口已经 fan-in，后续由 `product design Review` 接手主控 |
| 后置归档参考 | `预研 Mac 和 Windows OS 兼容性` | 保留文档产物，线程可归档；后续恢复走 EL-005 / EL-011 | 当前不推进 C/S 客户端和 Windows UAT，预研文档已成为正式入口 |

接手规则：

- 主控接手的是“产物和验收责任”，不是把旧线程全文搬进上下文。
- 可归档线程在归档前只需要保留 thread id、映射 EL、最后结论和恢复入口。
- active / inProgress 线程不归档；如果疑似卡住，先读取 thread 状态和最后输出，再请用户决定是否停止。
- 由当前会话接手的线程，后续只按执行线恢复，不按原线程标题恢复。

## 暂停规则

暂停不是删除任务。暂停执行线必须保留：

- 状态；
- 入口文件；
- 最后证据；
- 恢复条件；
- 下一步动作。

如果某条执行线没有以上信息，不能直接暂停；先补登记，再暂停。

## 恢复规则

后续用户说“继续执行”时，主控按以下顺序恢复：

1. 读取 `CURRENT_STATE.md` 和本文档。
2. 查看 `git status --short --branch`。
3. 如果 EL-001 未完成，继续 dirty worktree 验收。
4. 如果 EL-001 已完成，选择状态为 `当前主线` 或最高优先级 `待验收` 的执行线。
5. 后置执行线只有在用户重新指定时才恢复。

## 更新规则

- 新增执行线时，必须补一行，不能只写在对话里。
- 执行线完成、暂停、后置或恢复时，更新状态和下一步。
- 新增页面模块线程时，必须同时补入“页面模块设计线程映射”和“执行线清单”。
- 主控负责更新本文档；辅助会话只能提出修改建议。
