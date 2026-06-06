# progress.md

本文件是当前会话恢复入口，只保留最近状态、最近完成事项、关键验证和历史索引。完整执行历史已归档到 `docs/05-archive/progress-history/`。

## 当前状态（2026-06-06）

- 当前分支：`main`。
- 固定预览入口：`http://127.0.0.1:5173/`。前端展示和用户验收默认只看该端口。
- 当前主控主线：三个 P0 已完成代码闭环。`analytics_summary` 已完成 exporter / audit / `data_package_summary` / `dataClient` / dashboard 消费；`OI-135 + DB-11 + DB-2` 已完成设计、审计脚本、dry-run、临时库 smoke 和正式迁移脚本三段式；`OI-128 / OI-135` 已完成数据篮最小 API。真实基础库 / 用户库未写入；后续 apply 必须显式确认并自动备份。Delivery Bundle / 打包任务继续后排。
- Open Issues 当前未关闭：`OI-038`、`OI-128`、`OI-133`、`OI-135`；`OI-133` 已完成第一轮修复 / 待人工验收，`OI-136` 已修复并归档。
- 当前禁止事项：不默认改 ETL、数据库、数据模型、基础数据包、导出 JSON、用户库数据或业务关系推断；不 `git add .`；主展示区不得暴露 `sheet`、`row`、`column`、`raw_value`、`source_file`、`import_id`、`source_id`、`source_ref`、`source_label`、`debug`、`raw`、`metadata`、`intermediate`、`generated_at`。

## 当前子 Agent fan-in（2026-06-06）

- `019e9d71-9d02-7870-bdc6-300f99012487` / Faraday / worker：写入 `scripts/audit_stable_key_contract.mjs`，只读检查 `stable_key`、deterministic ID、`base_id_redirects` 契约；状态 `completed / fan-in / closed`。
- `019e9d71-9ef8-7861-bd5d-dd1710dbb5a8` / Arendt / explorer：只读分析当前用户库兼容报告事实，包括旧 `target_ref`、legacy `user_favorites.note`、潜在 orphan / deprecated 检查方案；状态 `completed / fan-in / closed`。
- `019e9d61-57ed-74e3-b017-74abb2b650c8` / Ptolemy / explorer：只读分析 `user_favorites`、`user_notes`、本地用户写入 API 和长期 user DB 治理差距；状态 `completed / fan-in / closed`。
- `019e9d61-83d2-7501-9376-170e117a3a66` / Kuhn / explorer：只读分析 `stable_key`、deterministic ID、`base_id_redirects` 和基础库升级兼容设计证据；状态 `completed / fan-in / closed`。
- `019e9d61-add5-70f0-8077-e8ee081db5f6` / Nash / explorer：只读分析工作台、数据篮、导出配置、用户自定义能力和导入草稿产品设计；状态 `completed / fan-in / closed`。

## 最近完成事项

- 2026-06-07 完成 `OI-133 / ArchiMate 建模语言页` 第一轮页面优化：`安全指南 / 安全架构建模语言` 从“整页海报 + 6 个区域缩略图”调整为“区域目录 + 当前区域阅读器 + SAPD 映射说明”；默认只渲染当前区域图，整页海报和其他区域通过点击查看或切换时加载；弹层补充上一项 / 下一项和左右键区域切换；图片补齐 `width` / `height` 尺寸声明；保留 PDF 下载和 `SAPD 元素图例` registry 受控渲染。本轮只改 `frontend/capability-browser/app.js`、`frontend/capability-browser/styles.css`、`docs/06-implementation/open-issues.md`、`task_plan.md` 和 `progress.md`，不改数据库、数据包、ETL 或用户库。
- 2026-06-07 完成 `OI-128 / OI-135` 工作台总览和数据篮最小 API：`scripts/run_local_server.py` 新增 `/api/v1/user/workspaces`、`/api/v1/user/data-baskets` 和 `/items` 写读删接口，runtime 会确保 `user_workspaces` / `user_workspace_items` / `user_data_baskets` / `user_data_basket_items` 表存在；`scripts/smoke_user_data_basket_api.mjs` 用临时 ZIP bundle / 临时 user DB 验证 token 拒绝、创建容器、条目 upsert、读取和删除闭环。真实基础库 / 用户库未写入。
- 2026-06-06 推进 `analytics_summary` P0 主线第一段：新增 `scripts/export_analytics_summary.mjs`，从 `capability-workbench`、`environment-workbench`、`lifecycle-workbench`、`standards-index`、`content-views` 生成本地 `analytics-summary.json`；新增 `scripts/audit_analytics_summary_contract.mjs`，验证 `capability_focus=91`、覆盖率分母、标准控制项 `1745 / 4893` grain 分离和禁止字段泄露；扩展 `scripts/data_package_summary.py --package analytics-summary`。生成 JSON 属于已忽略前端离线数据包，不纳入 Git。
- 2026-06-06 推进 `AN-SUM-CLIENT`：`frontend/capability-browser/dataClient.js` 新增 `analyticsSummary` API / 离线包路径、空状态 fallback 和 `getAnalyticsSummary()`；`audit_analytics_summary_contract.mjs` 同步检查客户端契约，确保 dashboard 后续只消费该方法，不重新拼 raw workbench 统计。
- 2026-06-07 推进 `AN-SUM-DASHBOARD`：首页只加载 `analyticsSummary` 并消费 `dataClient.getAnalyticsSummary()`，从工程数据包统计改为安全能力知识地图入口；audit 同步检查 dashboard 不再加载 raw workbench 包拼首页指标。
- 2026-06-07 完成 `OI-135 + DB-11 + DB-2` 正式迁移脚本三段式：新增 `scripts/migrate_db_contracts.mjs`，默认 dry-run 只写 `/private/tmp` 复制库，`--apply` 才写目标库，真实项目库写入还需 `--confirm-project-db-write` 并自动备份；正式脚本与 `user_schema_0.3` 设计 SQL 对齐，真实基础库 / 用户库未写入。
- 2026-06-06 收口 `OI-136 / FE-ROUTE` 治理：前一 checkpoint `f305d1a Checkpoint DB governance and route stability` 已固化深层路由修复，本轮按脚本口径将 `OI-136` 标为 `已修复` 并运行 `node scripts/govern_open_issues.mjs`，当前未关闭问题降为 4，已关闭归档问题增至 134。
- 2026-06-06 修复 `OI-136 / FE-ROUTE` 深层路由直接访问掉样式：`index.html` 增加 `<base href="/" />`，解决 `/guides/*`、`/knowledge/*`、`/standards/*` 直接访问时 CSS、脚本、组件和数据包相对路径落到深层目录的问题；扩展 `scripts/frontend_smoke_check.mjs`，轻量 HTTP 模式增加深层路由 `base href`、根 `/styles.css` 和根 `/app.js` 断言。本轮不改数据包、不改用户库、不改批注逻辑。
- 2026-06-06 完成 `OI-135 + DB-11 + DB-2` 临时库 migration smoke：新增 `scripts/smoke_db_migration_contracts.mjs`，只复制真实 user/base DB 到 `/private/tmp` 并在复制库执行 `user_schema_0.3` 与基础库 `stable_key` / `stable_ref` / `public_id` / `base_id_redirects` 最小迁移；真实项目数据库未写入。复制用户库升级到 `user_schema_0.3` 并创建 13 张新表；复制基础库给 4660 个对象和 7654 条关系补齐稳定引用字段。同步 `CURRENT_STATE.md`、`task_plan.md`、`docs/07-governance/backlog-convergence-2026-06-06.md`、`docs/06-implementation/open-issues.md` 和 `scripts/README.md`。
- 2026-06-06 Product Design 主控推进下一步：新增 `scripts/plan_user_schema_0_3_migration.mjs`，只读输出 `user_schema_0.3` dry-run 计划，当前真实用户库 dry-run 通过，拟执行 16 个 schema 计划动作和 6 类数据处理动作，`writesPerformed=false`；新增 `docs/06-implementation/base-stable-key-and-redirect-migration-design-2026-06-06.md`，确认 `metadata_json.object_key` / `relation_key` 可作为正式 `stable_key` 候选来源，但当前不直接写真实基础库；同步 `scripts/README.md`、`CURRENT_STATE.md`、`task_plan.md`、`open-issues.md`、`backlog-convergence` 和 `progress.md`。下一步收敛为只对 `/private/tmp` 复制库做 migration smoke。
- 2026-06-06 作为主控完成三件下一步任务：新增 `scripts/audit_user_db_governance_contract.mjs`，默认审计设计 / 代码契约，传 `--db` 时只读检查真实用户库；并行 worker 新增 `scripts/audit_stable_key_contract.mjs`，检查基础库显式 `stable_key` / `stable_ref`、deterministic ID、`base_id_redirects` 和用户库引用形态；只读 explorer 事实已沉淀为 `docs/06-implementation/user-db-compatibility-report-2026-06-06.md`，记录当前 `user_schema_0.2`、`user_notes=34`、legacy favorite note `1` 条、v2 页面锚点风险和基础库 stable key 缺口。本轮不改前端、不迁移真实用户库、不修改基础数据包。
- 2026-06-06 完成 `OI-135 + DB-11 + DB-2` 下一步工作任务 4 步：读取现有 user DB / base DB 脚本和设计，fan-in 三个只读子 Agent 结论，新增 `docs/06-implementation/user-database-governance-and-stable-key-design.md`，覆盖 `user_notes`、旧 `user_favorites`、数据篮、导出配置、工作区、用户自定义能力、导入草稿、备份 / 恢复、read model 合并、`stable_key`、deterministic ID、`base_id_redirects` 和跨 release 迁移策略；同步 `task_plan.md`、`CURRENT_STATE.md`、`docs/07-governance/backlog-convergence-2026-06-06.md` 和 `docs/06-implementation/open-issues.md`。本轮只做设计和计划，不改前端、不迁移数据库。
- 2026-06-06 修正 P0 优先级口径：`analytics_summary` 已纳入 P0，但不独占当前最高优先级；Delivery Bundle / 打包任务先往后排。计划入口改为当前下一步启动 `OI-135 + DB-11 + DB-2`，即用户库长期治理与 `stable_key` / 基础库升级兼容设计。本轮只改计划，不改前端。
- 2026-06-06 fan-in Data Analytics 会话的 dashboard 方案成果：已将 `analytics_summary P0` 纳入 `task_plan.md`，拆成 `AN-SUM-EXPORT` exporter 生成 `analytics-summary.json`、`AN-SUM-PKG` 数据包摘要检查、`AN-SUM-CLIENT` `dataClient.getAnalyticsSummary()`、`AN-SUM-DASHBOARD` dashboard 消费和 `AN-SUM-AUDIT` 覆盖率 / 标准控制项 grain / 禁止字段泄露审计。本轮只改计划，不改前端。
- 2026-06-06 完成当前 dirty worktree checkpoint：`b93a9f1 Finalize OI-128C annotation baseline` 固化批注前端、抽屉标签、幻灯片定位、审计脚本和全局批注基线；`e23c6d7 Document backlog convergence and frontend planning` 固化 Product Design 审阅、dashboard 契约草案、`OI-136 / FE-ROUTE` 登记和总 backlog 收敛。原默认下一步为 `OI-136 / FE-ROUTE`，随后曾调整为 `analytics_summary P0`，当前已更正为 P0 主线队列。
- 2026-06-06 设计 `analytics_summary` JSON 契约草案：新增 `docs/06-implementation/analytics-summary-json-contract-draft.md`，明确 dashboard 面向能力知识地图的 P0 数据结构、`capability_focus` 主粒度、覆盖率维度、模块入口统计、关系摘要、证据折叠、管理员折叠区、标准控制项三类 grain 和前端消费边界；本轮仅做契约设计，不改前端、ETL、数据库或数据包。
- 2026-06-06 完成总 backlog 收敛：新增 `docs/07-governance/backlog-convergence-2026-06-06.md`，将未开展任务重新分为 `Gate 0`、`P0`、可并行只读评估、后续开发和后置任务。结论：任务未丢失，但分散在 `task_plan.md`、Open Issues、执行线台账、Product Design review、Data Analytics review 和 Delivery 文档中；原默认下一步为 dirty worktree checkpoint 后进入 `OI-136 / FE-ROUTE`，随后曾调整为先推进 `analytics_summary P0`，当前已更正为 P0 主线队列。
- 2026-06-06 按 Data Analytics review 继续优化 dashboard 方案：更新 `docs/06-implementation/dashboard-and-module-data-display-optimization-design.md`，补齐标准控制项三类 grain（能力映射可达 / 标准索引 / SQLite 全库）、P0 支撑覆盖 relation type、控制数据源优先级、P0 指标口径附录、Top 榜单 capped score、首屏 L0 / L1 聚合矩阵和维护视角边界；继续不改前端、ETL、数据库或数据包。
- 2026-06-06 完成 Product Design 只读审阅：基于固定预览入口 `http://127.0.0.1:5173/` 抓取当前真实前端截图，输出到 `docs/06-implementation/design-audits/2026-06-06-product-design-review/`。结论：当前前端设计基线明显优于泛化 ImageGen 方案，应保留左侧全局导航、能力树、生命周期阶段条、环境拓扑和批注抽屉；优先修复深层路由 `/guides/*`、`/knowledge/*`、`/standards/*` 直接访问未加载样式的 P0 交付问题，再做局部组件 / CSS 统一。
- 2026-06-06 将 Product Design 审阅发现的深层路由样式问题纳入整体计划：新增 `OI-136 深层路由直接访问未加载前端样式`，并在 `task_plan.md` 前端页面设计线新增 `FE-ROUTE 深层路由直接访问与刷新稳定性治理`。该项作为 P0 排在组件视觉统一之前，后续先修 route / 静态资源加载 / 刷新契约，再继续指南、知识库和标准页视觉审阅。
- 2026-06-06 完成 dashboard 与现有模块数据展示优化方案设计：新增 `docs/06-implementation/dashboard-and-module-data-display-optimization-design.md`，将首页定位从“数据包 / 对象 / 关系 / 来源健康统计”调整为“以安全能力为中心的知识地图入口”，明确能力覆盖、多维支撑、场景可达、关系链路、参考依据等统计口径；同时固定 `LC-AP` / `LC-DT` 共用 `lifecycle-workbench` 时全局统计必须按数据包去重、按页面视角拆分展示，管理员维护数据不进入普通用户主视图。
- 2026-06-06 修复幻灯片业务批注定位全局 bug：`security_guide_slide` 旧格式目标 `base:security_guide_slide:<guide>#<page>` 现在会从 `target_ref` 恢复 `selectedContentId` 和 `selectedContentSlideIndex`，定位批注时不仅跳到指南 / 幻灯片目录页，也会把主幻灯片切到目标当前页。新增真实回归断言 `guideSlidePageOk`，检查 `.guide-slide-page`、active thumb 和内部 `selectedContentSlideIndex` 三者一致。
- 2026-06-05 批注抽屉右侧标签 Apple 胶囊方案落地：用户否决上一版“hover 露出半截批注页”的视觉方案后，已改为默认只露出窄数量徽标，hover / focus 只平滑展开标签本体，批注抽屉面板保持完全隐藏；点击标签才完整展开抽屉，再次点击或收起按钮平滑收回。标签文案拆成独立数量徽标 + `批注`，不再使用 `批注 1` 这类拼接语义。新增真实浏览器回归 `scripts/audit_annotation_drawer_tab.mjs`，专门检查默认窄标签、hover 标签展开、面板不泄露、点击展开 / 收起和无 console 异常。
- 2026-06-05 `OI-128C` checkpoint 提交后补充真实回归：提交后发现当前用户库已扩展到 33 条保存批注，首次全量回归抓出 4 条指南 / 幻灯片缩略图批注缺少定位态视觉高亮。已只针对 `.guide-slide-stage` / `.guide-thumb` 定位态补齐琥珀下沿并推进 `styles.css` 缓存版本到 `annotation-global-20260605-8`，保留 Apple blue 聚焦圈。定点 4 条和全量 33 条真实 Chrome 严格回归均通过，最终 `33/33 pass`、`failures=[]`、`consoleIssues=[]`。
- 2026-06-05 `OI-128C` checkpoint 前治理状态同步：已将 `docs/07-governance/current-execution-lines.md` 中过期的 `24/24 pass`、最终人工抽查口径同步为当前事实：用户已基本验收通过，批注设计已作为全局基线固化，当前用户库保存批注真实 Chrome 严格回归最终口径为 `33/33 pass`、`failures=[]`、`consoleIssues=[]`。下一步进入 checkpoint amend 收口；仍不 `git add .`，不混入工作台 V2 / V3。
- 2026-06-05 `OI-128C` 批注设计全局基线固化：用户确认本问题基本验收通过，后续有问题再按 bug fix 处理。已将当前批注设计固化为全局基线，新增 `global-annotation-requirements-and-regression-matrix.md` 的“基线固化状态”“新页面接入清单”“维护边界”，并同步 `frontend-global-design-baseline-2026-05-30.md`。后续新增页面必须先声明页面对象、值锚点、行锚点、幻灯片 / 子页上下文并跑契约审计，避免每个新页面重新调试批注。
- 2026-06-05 `OI-128C` 后续变更收口：修复定位后高亮落到文字后方、L0-L2 对象批注常态不高亮、普通态高亮线需要加深加粗但不遮挡文字、指南 / 幻灯片页无法添加批注，以及能力映射标准页 ISO / NIST 标准行按需加载后值锚点丢失的问题。标准映射 ViewModel 改为“projection / workbench 为主、已加载 standards 包只补充不覆盖”，避免 `NIST CSF` 加载后覆盖 `AT-6`；`localRelationMap` 同步补入 fallback 标准框架 / 控制项，保证页面 DOM 有稳定值锚点。当前用户库保存批注真实 Chrome 严格回归已从 24 条扩展到 28 条，最终 `28/28 pass`。
- 2026-06-05 `OI-128C` 常态高亮视觉收口：用户截图指出普通高亮仍呈横向黄色长条，影响 Apple shell / Office Word 式批注质感。已把普通态批注从背景铺底改为贴文字的琥珀下划线；行级普通态仅保留左侧标识，不再铺整行黄色；关系 chip 保留原有语义底色，只叠加低噪声下划线 / 边框。定位态仍保留更明显的黄色 + Apple blue 聚焦，方便查找。资源版本更新到 `annotation-global-20260605-5`。
- 2026-06-05 `OI-128C` 视觉防回归脚本升级：`scripts/audit_saved_user_annotations.mjs` 新增 `normalStripeOk`、`normal_visual_stripe_too_wide`，同时识别 text-decoration 式普通批注；后续如果普通态又出现用户截图中的宽背景条，真实 Chrome 回归会直接失败。
- 2026-06-05 `OI-128C` 安全技术服务 / 模块 / 措施高亮五次回归问题根因修复：旧脚本只验证 `data-user-note-anchor-marked / active` 属性，未验证真实视觉样式；技术 chip 语义色规则会覆盖批注样式。已把批注 chip 覆盖层放到语义色规则之后，并补齐 `technical-chip service-chip` specificity。
- 2026-06-05 `OI-128C` 二次人工抽查问题修复完成：安全技术措施 / 模块 / 服务常态与定位高亮、点击页面后常态保留、非首屏定位抽屉滚动保持、抽屉视口完整性均纳入真实 Chrome 严格回归并通过。
- 2026-06-05 新主控接收旧会话交接并同步状态入口：当前线程接管主控；旧慢会话降级为历史产物来源 / 待 fan-in。后续复杂任务采用“轻主控 + 专项 subagent / 专项会话 + fan-in 验收”，主控只负责边界、调度、验收、状态更新和 checkpoint。

## 最近验证

- 2026-06-07 `OI-133 / ArchiMate 建模语言页` 验证：`node --check frontend/capability-browser/app.js` 通过；`python3 scripts/dev_server_guard.py --status` 通过，固定 `5173` 单一项目服务健康；`node scripts/frontend_smoke_check.mjs --page content --route /guides/security-architecture-modeling-language --url http://127.0.0.1:5173` 轻量 HTTP smoke 通过，未启动系统 Chrome；`git diff --check -- frontend/capability-browser/app.js frontend/capability-browser/styles.css` 通过；diff 禁止字段检查未发现新增主展示区禁止字段；Browser 插件工具本线程未暴露，未做应用内浏览器截图。
- 2026-06-06 `analytics_summary` 验证：`node --check scripts/export_analytics_summary.mjs`、`node --check scripts/audit_analytics_summary_contract.mjs`、`python3 -m py_compile scripts/data_package_summary.py` 均通过；`node scripts/export_analytics_summary.mjs` 生成本地包通过，输出 `primaryGrain=capability_focus`、`focusCount=91`、`coverageDimensions=7`；`node scripts/audit_analytics_summary_contract.mjs` 通过，确认 `capabilityMapped=1745`、`standardsIndex=4893`；`python3 scripts/data_package_summary.py --package analytics-summary` 通过并输出覆盖维度与标准控制项三类 grain 摘要。
- 2026-06-06 `AN-SUM-CLIENT` 验证：`node --check frontend/capability-browser/dataClient.js`、`node --check scripts/audit_analytics_summary_contract.mjs`、`node scripts/audit_analytics_summary_contract.mjs`、`python3 scripts/dev_server_guard.py --status` 均通过；`node scripts/frontend_smoke_check.mjs --page overview --url http://127.0.0.1:5173` 轻量首页 smoke 通过，未启动系统 Chrome。
- 2026-06-07 `AN-SUM-DASHBOARD` 验证：`node --check frontend/capability-browser/app.js`、`node scripts/audit_analytics_summary_contract.mjs`、`node scripts/frontend_smoke_check.mjs --page overview --url http://127.0.0.1:5173`、`python3 scripts/check_github_data_boundary.py`、`git diff --check` 均通过。
- 2026-06-07 `OI-135 / DB-2` 正式迁移脚本验证：`node --check scripts/migrate_db_contracts.mjs` 通过；`node scripts/migrate_db_contracts.mjs --json` 默认 dry-run 通过且 `writesPerformedOnProjectDatabases=false`；`--apply` 对真实项目库被确认门拦截；对 `/private/tmp` 复制库 apply 通过并生成备份；`audit_user_db_governance_contract.mjs --require-v03` 与 `audit_stable_key_contract.mjs` 对迁移后复制库均通过，stable key / public id 覆盖 `4660/4660` 对象和 `7654/7654` 关系。
- 2026-06-06 Open Issues 治理验证：`node --check scripts/govern_open_issues.mjs` 通过；`node scripts/govern_open_issues.mjs` 通过，输出 `active=4`、`archived=134`。
- 2026-06-06 `OI-136 / FE-ROUTE` 验证：`node --check scripts/frontend_smoke_check.mjs`、`node --check frontend/capability-browser/app.js`、`python3 scripts/dev_server_guard.py --status` 均通过；轻量 HTTP smoke 覆盖 `/guides/security-architecture-design`、`/guides/security-architecture-modeling-language`、`/knowledge/technical`、`/knowledge/technical-services`、`/standards/iso-27001-2022`、`/standards/nist-csf-2`，均返回 `result=pass`，并确认深层路由 HTML 包含根 `base href`、根 `/styles.css` 和根 `/app.js` 可访问；本轮未启动系统 Chrome。
- 2026-06-06 临时库 migration smoke 验证：`node --check scripts/smoke_db_migration_contracts.mjs`、`node --check scripts/audit_stable_key_contract.mjs`、`node --check scripts/audit_user_db_governance_contract.mjs` 均通过；`node scripts/smoke_db_migration_contracts.mjs` 通过，输出 `writesPerformedOnProjectDatabases=false`、复制库路径 `/private/tmp/sapd_wiki_user_schema_0_3_smoke.sqlite3` / `/private/tmp/sapd_wiki_base_stable_key_smoke.sqlite3`、`userSchemaVersion=user_schema_0.3`、`userV03CreatedTables=13`、`baseAddedColumns=6`、`knowledgeItemsUpdated=4660`、`knowledgeRelationsUpdated=7654`；`node scripts/audit_user_db_governance_contract.mjs --db /private/tmp/sapd_wiki_user_schema_0_3_smoke.sqlite3 --require-v03` 通过，仅保留 legacy favorite note `1` 条 warning；`node scripts/audit_stable_key_contract.mjs --base-db /private/tmp/sapd_wiki_base_stable_key_smoke.sqlite3 --user-db /private/tmp/sapd_wiki_user_schema_0_3_smoke.sqlite3` 通过，stable key / deterministic public id 覆盖率均为 100%，仅保留 `base_id_redirects` 示例类型未覆盖和页面锚点需上下文解析的 warning。
- 2026-06-06 Product Design 主控推进验证：`node --check scripts/plan_user_schema_0_3_migration.mjs`、`node --check scripts/audit_user_db_governance_contract.mjs`、`node --check scripts/audit_stable_key_contract.mjs` 均通过；`node scripts/plan_user_schema_0_3_migration.mjs` 通过，输出 `writesPerformed=false`、`currentSchemaVersion=user_schema_0.2`、`targetSchemaVersion=user_schema_0.3`、`plannedSchemaActions=16`、`plannedDataActions=6`、高风险引用 `80` 条需 contextual / manual resolution；`node scripts/audit_user_db_governance_contract.mjs --db data/user/sapd_wiki_user.sqlite3` 通过；`node scripts/audit_stable_key_contract.mjs` 可运行并按预期失败，继续指出 DB-2 缺口；`git diff --check` 通过。
- 2026-06-06 三件下一步任务验证：`node --check scripts/audit_user_db_governance_contract.mjs` 通过；`node scripts/audit_user_db_governance_contract.mjs` 通过；`python3 scripts/create_user_db.py /private/tmp/sapd_wiki_user_audit_smoke.sqlite3` 创建临时库成功；`node scripts/audit_user_db_governance_contract.mjs --db /private/tmp/sapd_wiki_user_audit_smoke.sqlite3` 通过并仅 warning 0.3 表未实现；`node scripts/audit_user_db_governance_contract.mjs --db data/user/sapd_wiki_user.sqlite3 --json` 通过，发现真实用户库 `schemaVersion=user_schema_0.2`、legacy favorite note `1` 条；`node --check scripts/audit_stable_key_contract.mjs` 通过；`node scripts/audit_stable_key_contract.mjs` 可运行并按预期失败，指出基础库缺少显式 `stable_key` / `stable_ref`、`base_id_redirects` 和 deterministic public id，同时用户库引用中旧两段式 `base:<id>` 为 0。该失败是当前 `DB-2` 未落地的预期缺口，不是脚本语法错误。
- 2026-06-06 `OI-135 + DB-11 + DB-2` 设计收敛验证：`git diff --check` 通过；当时确认 `OI-135` 已进入设计 / dry-run 阶段、`OI-133` 保持 `待设计`、下一步收敛为治理审计 / stable ref 审计 / `user_schema_0.3` migration 设计；`git status --short --branch` 显示当前分支 `main...origin/main [ahead 8]`，本轮文档改动未提交。当前最新状态见上方“临时库 migration smoke 验证”。
- 2026-06-06 P0 主线队列计划验证：`rg '当前优先.*analytics|默认下一步.*analytics|当前必须先做|独占当前最高|P0 主线队列|用户库长期治理|stable_key' CURRENT_STATE.md task_plan.md docs/07-governance/backlog-convergence-2026-06-06.md progress.md -n` 确认入口已表达 `analytics_summary` 不独占当前最高优先级；`git diff --check -- task_plan.md CURRENT_STATE.md docs/07-governance/backlog-convergence-2026-06-06.md progress.md` 通过。
- 2026-06-06 checkpoint 验证：`git status --short --branch` 显示 `main...origin/main [ahead 7]` 且无未提交文件；`git log -2 --oneline` 显示 `e23c6d7` 与 `b93a9f1`；`python3 scripts/dev_server_guard.py --status` 通过，固定 `5173` 单一项目服务健康；`git diff --check` 通过。
- `node scripts/audit_saved_user_annotations.mjs --url http://127.0.0.1:5173 --allow-system-chrome --debug-port 9462 --width 1800 --height 1200 --compact --from-ordinal 1 --to-ordinal 5`：真实 Chrome 定向幻灯片批注定位回归通过，`auditedNoteCount=5`、`passed=5`、`failed=0`、`failures=[]`；覆盖安全技术架构设计方法第 30 / 2 页、轻规划第 26 页、数据安全设计方法第 3 / 1 页，均满足 `guideSlidePageOk=true`，页面显示、active thumb 和 `selectedContentSlideIndex` 一致。
- `node scripts/audit_saved_user_annotations.mjs --url http://127.0.0.1:5173 --allow-system-chrome --debug-port 9461 --width 1800 --height 1200 --compact`：真实 Chrome 全量保存批注回归通过，当前用户库 `noteCount=34`、`auditedNoteCount=34`、`passed=34`、`failed=0`、`failures=[]`、`consoleIssues=[]`。
- `node --check frontend/capability-browser/app.js`、`node --check scripts/audit_saved_user_annotations.mjs`、`node --check scripts/audit_user_annotation_contract.mjs`：均通过。
- `node scripts/audit_user_annotation_contract.mjs`：通过，新增覆盖 `guideSlideTargetMetaFromNote`、`restoreGuideSlideContextFromNote` 和 `state.selectedContentSlideIndex = slideTarget.slideIndex`。
- `node scripts/frontend_smoke_check.mjs --page content --route /guides/security-architecture-design --url http://127.0.0.1:5173`：通过，指南页 HTTP / health 检查均为 `ok`。
- `python3 scripts/dev_server_guard.py --status`：通过，固定 `5173` 只有一个项目服务进程，home / workspace projection 均为 `200`。
- `git diff --check`：通过。
- `node scripts/audit_annotation_drawer_tab.mjs --url http://127.0.0.1:5173 --route /capability-mapping --allow-system-chrome --debug-port 9451 --width 1800 --height 1200`：真实 Chrome 交互回归通过，`initialDrawerVisible=34`、`initialTabVisible=34`、`hoverTabVisible=108`、`hoverPanelVisible=0`、`openDrawerVisible=390`、`closedPanelVisible=0`、`failures=[]`、`consoleIssues=[]`。
- `node scripts/audit_saved_user_annotations.mjs --url http://127.0.0.1:5173 --allow-system-chrome --debug-port 9452 --width 1800 --height 1200 --compact`：真实 Chrome 严格逐条保存批注回归通过，`noteCount=33`、`auditedNoteCount=33`、`passed=33`、`failed=0`、`failures=[]`、`consoleIssues=[]`。
- `node scripts/frontend_smoke_check.mjs --page capability --url http://127.0.0.1:5173`：通过，HTTP / health / capability initial 均为 `ok`；未额外启动系统 Chrome。
- `node scripts/audit_user_annotation_contract.mjs`：通过，新增覆盖抽屉数量徽标、平滑预展开和“不能露出批注抽屉面板”要求，结果 `issues=[]`。
- `node --check frontend/capability-browser/app.js`、`node --check frontend/capability-browser/components/UserAnnotationDrawer.js`、`node --check scripts/audit_user_annotation_contract.mjs`、`node --check scripts/audit_annotation_drawer_tab.mjs`：均通过。
- `python3 scripts/dev_server_guard.py --status`：通过，固定 `5173` 只有一个项目服务进程，home / workspace projection 均为 `200`。
- `git diff --check`：通过。
- `node scripts/audit_user_annotation_contract.mjs`：通过，新增检查已覆盖“全局设计基线已固化”“33/33 pass”“新页面接入清单”“页面对象声明”“锚点声明”“视觉接入”“回归准入”等硬条款，结果 `issues=[]`。
- `node scripts/audit_saved_user_annotations.mjs --url http://127.0.0.1:5173 --allow-system-chrome --debug-port 9446 --width 1800 --height 1200 --compact`：提交后真实 Chrome 严格逐条保存批注回归通过，`noteCount=33`、`auditedNoteCount=33`、`passed=33`、`failed=0`、`failures=[]`、`consoleIssues=[]`；覆盖新增指南 / 幻灯片缩略图对象批注、L0-L2 对象 / 行批注、ISO 标准框架值、`AT-6` 标准控制项、技术服务 / 模块 / 措施 chip、常态视觉、定位视觉、值 / 行粒度、点击后常态保留、抽屉滚动保持和误高亮防护。
- `node --check scripts/audit_user_annotation_contract.mjs`：通过。
- `git diff --check -- docs/06-implementation/global-annotation-requirements-and-regression-matrix.md docs/06-implementation/frontend-global-design-baseline-2026-05-30.md scripts/audit_user_annotation_contract.mjs`：通过。
- `node scripts/audit_saved_user_annotations.mjs --url http://127.0.0.1:5173 --allow-system-chrome --debug-port 9433 --width 1800 --height 1200 --compact`：真实 Chrome 严格逐条保存批注回归通过，`noteCount=28`、`auditedNoteCount=28`、`passed=28`、`failed=0`、`failures=[]`、`consoleIssues=[]`；覆盖 L0-L2 对象 / 行批注、ISO 标准框架值、`AT-6` 标准控制项、技术服务 / 模块 / 措施 chip、幻灯片页、常态视觉、定位视觉、值 / 行粒度、点击后常态保留、抽屉滚动保持和误高亮防护。
- `node scripts/audit_saved_user_annotations.mjs --url http://127.0.0.1:5173 --allow-system-chrome --debug-port 9432 --width 1800 --height 1200 --compact --from-ordinal 15 --to-ordinal 23 --debug-state`：通过，确认 `NIST CSF 2.0` 标准包加载后不会覆盖后端 projection 中的 `AT-6` 锚点。
- `node --check scripts/audit_saved_user_annotations.mjs`：通过。
- `node --check frontend/capability-browser/app.js`：通过。
- `node --check frontend/capability-browser/viewModels.js`：通过。
- `node --check frontend/capability-browser/components/CapabilityLocalRelationMap.js`：通过。
- `node --check scripts/audit_user_annotation_contract.mjs`：通过。
- `git diff --check -- frontend/capability-browser/app.js frontend/capability-browser/viewModels.js frontend/capability-browser/components/CapabilityLocalRelationMap.js frontend/capability-browser/styles.css frontend/capability-browser/index.html scripts/audit_saved_user_annotations.mjs scripts/audit_user_annotation_contract.mjs`：通过。
- `python3 scripts/dev_server_guard.py --status`：通过，固定 `5173` 只有一个项目服务进程，home / workspace projection 均为 `200`。
- `node scripts/audit_user_annotation_contract.mjs`：通过，确认全局锚点契约、共享关系 chip 值锚点、LC-AP / LC-DT 值锚点、折叠分组定位契约、视觉范围基线和全局批注需求矩阵均合格。

## 当前问题索引

- `OI-038`：Gartner 与安全职能候选映射需后续人工校对，状态 `待确认`。
- `OI-128`：USER-WRITE-UI-1：批注 / 工作台用户写入入口，状态 `部分完成`；`OI-128A/B/C` 已实现，`OI-128C` 已基本验收，当前进入 checkpoint 确认。
- `OI-133`：ArchiMate 建模语言页显示效果与加载效率优化，状态 `已修复 / 待人工验收`。
- `OI-135`：用户库治理与兼容表迁移清理，状态 `正式迁移脚本完成 / 真实库 apply 待显式确认`。
- `OI-136`：深层路由直接访问未加载前端样式，状态 `已修复 / 已归档`。

## 历史索引

| 归档文件 | 内容 |
|---|---|
| `docs/05-archive/progress-history/2026-06.md` | 2026-06 完整执行记录、Open Issues 治理、前端治理、数据口径确认和本轮 progress 瘦身摘要 |
| `docs/05-archive/progress-history/2026-05.md` | 2026-05 完整执行记录、根目录 `progress.md` 瘦身快照和结构治理记录 |
| `docs/05-archive/findings-history/2026-05.md` | 2026-05 历史发现 |
| `docs/05-archive/open-issues-history/2026-06.md` | 已关闭 Open Issues 长记录 |
| `docs/05-archive/context-slimming-2026-05-15/` | 2026-05-15 上下文瘦身快照 |

## 维护规则

- 本文件只保留最近状态、最近 5-10 条重要执行和恢复入口；超过 120 行时继续归档到 `docs/05-archive/progress-history/`。
- 详细过程、长命令输出和阶段性历史不写入根目录 `progress.md`。
