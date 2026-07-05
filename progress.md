# progress.md
本文件是当前会话恢复入口，只保留最近状态、最近关键动作、验证摘要和历史索引。完整执行历史已归档到 `docs/05-archive/progress-history/`。

## 当前状态（2026-07-05）

- 当前分支：`main`；最近提交状态以 `git log -1 --oneline` 和远端 `origin/main` 为准。工作区存在改动时，提交必须只 stage 明确相关文件，不能使用 `git add .`。
- 固定预览入口：`http://127.0.0.1:5173/`；`python3 scripts/dev_server_guard.py --status` 通过，5173 为项目服务。
- 主控问题处理契约已写入 `AGENTS.md`：用户给出的截图、搜索词、单条数据或页面现象默认是问题样例，不是单点任务；必须先定系统规则、边界和验收，再改代码 / 数据 / 页面，并在完成反馈说明固化了哪条规则。
- 数据和禁止范围：不得默认修改源 Excel、SQLite、正式 JSON 数据包、标准包、字典包、LC 数据包、环境数据包、用户 Issue / 批注数据库或 macOS 打包产物；涉及上述范围必须先确认。
- 当前已知业务状态：`OI-164`、`OI-165`、`OI-166`、`OI-167`、`OI-182` 已按用户确认关闭；`OI-170` 按用户要求暂不修复；`OI-176`、`OI-177`、`OI-178` 保持待处理记录。

## 最近完成事项

- 2026-07-05 `OI-182 Final LC-DT / Environment Service Set Acceptance`：用户完成源 Excel 最终修正后，按主控契约重新验收“字典全局关系”和“对象 / 阶段实际服务集合”边界。最终重导三张源表：`作用域-安全技术服务-安全技术模块映射`、`LC-DT 数据生命周期`、`LC-DT 安全技术服务、模块、策略映射表`，import job 为 `b8ed0cfd-42af-48be-83f6-7e56bccbff41`，`items_updated=315`、`relations_created=0`、`relations_deleted=0`。已重导维护包、`shared-lookups`、生命周期包、能力 / 环境 / 生命周期 workbench，并正式 apply OI-149 split projection。验收通过：安全技术服务字典 `160` 条唯一；安全技术模块 `102` 个、模块-服务关系 `397` 条且模块内重复 `0`；环境对象源表与正式投影均为 `67` 个上下文、`806` 条上下文-服务关系，缺失 / 多余均为 `0`；LC-DT 新增脱敏 / 水印服务已进入 `DT-04 加工/使用`、`DT-05 提供` 的阶段和策略投影。通过专项审计、基线审计、JSON 边界、GitHub 数据边界、通用内容 smoke、能力 / 环境 / LC-AP / LC-DT / 字典服务 / 字典模块页轻量 smoke 和 5173 状态检查；未启动系统 Chrome。`OI-182` 已关闭；`OI-170` 仍按用户此前要求保留为“加工/使用阶段模块/措施双表确认”问题，服务集合无差异。
- 2026-07-05 `OI-184 Search Baseline + Index Quality Audit`：按用户要求继续检查全局搜索、局部搜索和索引质量。根因定位为两类契约风险：页面内搜索历史基线没有覆盖所有生产搜索框；搜索索引优化缺少可重复的语义质量探针。已确认信息化环境局部搜索 `environmentSearchInput` 已关闭浏览器原生 `autocomplete` 并纳入统一 `page` 搜索历史；补齐同类遗漏的工作台 Issue 搜索框 `workbenchIssueSearchInput`，加入 `autocomplete="off"`、`data-search-history-kind="page"` 和统一历史提交。新增 `scripts/audit_search_index_quality_probes.py`，直接探测 `/api/v1/search-index` 的全量 facets、窗口分页、标准 / 框架覆盖、弱命中裁剪和反例隔离。修改 `frontend/capability-browser/app.js`、`frontend/capability-browser/index.html`、`scripts/audit_global_search_index_contract.mjs`、`scripts/audit_search_state_isolation.mjs`、`scripts/frontend_content_smoke_check.mjs`、`docs/06-implementation/global-search-contract-2026-07-05.md`、`docs/06-implementation/open-issues.md` 和本文件；未修改任何禁止数据源或打包产物。验证通过：索引质量探针 `10` 项、全局搜索审计 `44` 项、搜索状态隔离审计 `39` 项、环境搜索审计 `20` 项、内容 smoke、搜索 / 环境 / 工作台 Issue 轻量 smoke、5173 状态、JSON 边界、GitHub 数据边界和定向 `git diff --check`；未启动系统 Chrome。
- 2026-07-05 `OI-183 Global Search History Commit + Pagination Control Fix`：修复搜索历史只依赖输入防抖导致已执行查询未及时进入历史面板的问题，并修复分页 `上一页` / `下一页` 继承图标按钮宽度导致文字断行的问题。固化规则：搜索历史记录“已执行并完成加载的查询”；分页文字按钮必须保留稳定宽度和 `nowrap`。验证通过 JS 语法、全局搜索审计、状态隔离审计、内容 smoke、5173 状态、后端索引探针、搜索页轻量 smoke、JSON / GitHub 数据边界和定向 `git diff --check`；未启动系统 Chrome。
- 2026-07-05 `OI-182 Environment / LC-DT Business Service Set Re-audit`：只读复核安全能力映射、信息化环境安全能力映射、LC-AP、LC-DT、安全技术服务 / 模块 / 措施清单和 LC-DT 数据处理场景与技术映射。结论：未发现新的安全技术模块 / 服务映射数据问题；字典服务 `160` 条唯一，模块 `102` 个、模块-服务关系 `397` 条且模块内重复为 `0`；环境对象源表与正式投影均为 `67` 个对象上下文、`806` 条上下文-服务关系；LC-DT 阶段主表、策略表、workbench 和 split projection 数量一致。未修改源 Excel、SQLite 或正式业务数据包。
- 2026-07-05 `OI-181 Global Search Page Window + Search Memory Baseline`：修复搜索结果页和顶部预览请求状态互相污染、结果页只能看前 `120` 条窗口、环境页局部搜索沿用浏览器原生 autocomplete 等通病。固化规则：搜索结果页使用独立请求序列；`/api/v1/search-index` 支持 `offset/category/window`；全局搜索与搜索结果页共享 `global` 历史，页面内搜索共享 `page` 历史，默认显示 5 条、最多 10 条，支持展开、清空和单条删除，纳入输入框统一 `autocomplete="off"`。
- 2026-07-05 `OI-180 Global Search Pagination + Sticky Context`：全局搜索结果页增加每页 `20` 条分页、上下分页、跳页和 sticky 查询 / 分类上下文。固化规则：不改变搜索规则、排序、facets 计数、索引来源或数据，只改变结果阅读形态。
- 2026-07-05 `OI-179 Global Search Count Facets Contract Fix`：修复搜索结果页把当前返回窗口当成全量计数展示的问题。固化规则：总数和分类 chip 必须来自 API `facets` 全量命中计数，结果列表窗口必须和全量命中明确区分。
- 2026-07-05 `OI-175 Standards Detail Global Search Coverage Fix`：修复标准 / 框架局部搜索可命中而全局搜索漏掉标准明细行的问题。固化规则：标准 / 框架页面局部搜索可命中的业务明细，必须按同一业务粒度进入全局搜索，并携带可回到标准页的定位字段。

## 本轮执行计划

1. 维护全局搜索、局部搜索和搜索索引契约，优先修复能形成系统性规则的问题。
2. 继续通过审计脚本、索引探针和轻量 smoke 固化验收；默认不启动系统 Chrome。
3. 更新 `docs/06-implementation/open-issues.md` 和本文件；提交或打包前必须再次确认范围。

## 维护规则

- 本文件只保留最近状态、最近 5-10 条重要执行和恢复入口；超过 120 行时继续压缩或归档到 `docs/05-archive/progress-history/`。
- 详细过程、长命令输出和阶段性历史不写入根目录 `progress.md`。
