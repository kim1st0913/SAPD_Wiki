# progress.md
本文件是当前会话恢复入口，只保留最近状态、最近关键动作、验证摘要和历史索引。完整执行历史已归档到 `docs/05-archive/progress-history/`。

## 当前状态（2026-07-03）

- 当前分支：`main`；最新提交 `fd808bc Checkpoint capability overview and search governance`，当前工作区仍有多项未提交改动，后续提交必须只 stage 明确相关文件。
- 固定预览入口：`http://127.0.0.1:5173/`；当前 5173 为项目服务，`python3 scripts/dev_server_guard.py --status` 通过。
- 用户已确认 `OI-164` 关闭；`OI-155` 全局搜索本轮按 bug fix 追加修复 `Ansible` 重复、`外包` 上下文不足、结果预览上下文和命中词高亮，待页面人工验收。
- 当前主线：`OI-154` 页面内搜索治理已完成 P7 词级高亮、内容区定位和环境共享搜索控制带修复，待页面人工验收；标准 / 框架页和知识库字典页后续按具体截图逐页治理。边界为前端局部搜索状态、定位、高亮、空态、命中计数和审计脚本；不重导 ETL 或正式数据包。
- 数据和禁止范围：不修改原始 Excel、SQLite、正式 JSON 数据包、标准包、字典包、LC 数据包、环境数据包、用户 Issue / 批注数据库；不启动系统 Chrome，除非用户明确批准。
- 2026-07 详细进度已归档到 `docs/05-archive/progress-history/2026-07.md`；根目录只保留本轮恢复必读摘要。

## 最近完成事项

- 2026-07-03 `GitHub Homepage README + Non-Packaging Checkpoint`：按用户要求准备 Git / GitHub 收口，并明确排除打包范围。`README.md` 已更新为当前 GitHub 首页项目说明，反映本地关系工作台、核心页面、全局搜索 / 页面内搜索分工、本地 API / fallback 和数据不入 GitHub 边界。本轮提交范围只包含搜索治理、前端体验、后端轻量索引、审计脚本、文档和 README；不 stage `apps/macos/SAPDWiki/Sources/SAPDWiki/main.swift`、`apps/macos/SAPDWiki/apps/` 等打包 / macOS 包内产物。提交前验证通过：相关 JS / Python 语法检查、全局搜索 / 页面内搜索 / 环境搜索 / 滚动 / 文本选择 / 路由刷新审计、内容 smoke、能力 / 环境 / LC-AP / LC-DT / 搜索页轻量 smoke、5173 状态、JSON 边界、GitHub 数据边界和 `git diff --check`。
- 2026-07-03 `OI-154 Page Search P7 Word-Level Highlight + Shared Environment Search Rail`：按用户复测继续收口 4 个通病。LC-AP / LC-DT 页面搜索定位优先匹配内容区命中词，不再让阶段 tab 抢占当前位置；当前搜索命中改为“具体命中词强高亮 + 所在容器轻定位框”，取消整行 / 整卡片大面积黄底；环境页搜索改为环境视图和安全技术 tab 共用的工作区顶部控制带，两个 tab 顶部区域高度保持一致。修改范围不涉及正式 JSON、SQLite、原始 Excel、标准包、字典包、LC 数据包、环境数据包或用户 Issue / 批注数据库；未启动系统 Chrome。验证通过：相关 JS 语法检查、`audit_search_state_isolation` 34 项、`audit_environment_search_contract` 11 项、内容 smoke（`持续` 12 个能力命中、`部署` 12 个 LC 字段级命中、`外包` 8 个 LC-AP 阶段命中）、能力 / 环境 / LC-AP / LC-DT 轻量 smoke、5173 状态、JSON 边界、GitHub 数据边界和 `git diff --check`。
- 2026-07-03 `OI-154 Page Search P6 Target Binding + Empty State Fix`：按用户复测继续处理通病。能力页输入搜索后的首个业务命中现在直接写入待高亮目标，避免回退到普通文本匹配导致“选中了但没高亮”；页面搜索高亮会同时标记具体命中值和所在业务行 / 卡片，并以 `data-page-search-current` 强焦点层压过能力树 / 环境树 active 样式；定位会滚动内部工作区容器，不再只滚 document；环境页搜索无命中时保留搜索栏、环境对象树和工作区，只显示局部“未找到匹配的信息化环境对象”空态。修改范围不涉及正式 JSON、SQLite、原始 Excel、标准包、字典包、LC 数据包、环境数据包或用户 Issue / 批注数据库；未启动系统 Chrome。验证通过：相关 JS 语法检查、`audit_search_state_isolation` 34 项、`audit_environment_search_contract` 11 项、内容 smoke、`audit_global_search_index_contract`、能力 / 环境 / LC-AP / LC-DT 轻量 smoke、5173 状态、JSON 边界、GitHub 数据边界和 `git diff --check`。
- 2026-07-03 `OI-154 Page Search P5 Final Pass`：按用户最新 3 张截图继续收口普遍问题。页面内搜索当前命中新增持久 `page-search-current-match` 高亮，短暂定位动画结束后仍保留黄色搜索底色和蓝色定位环；能力页、环境页、LC-AP / LC-DT、知识库页、关系表过滤和工作台搜索输入统一加入 composition / IME 输入保护及重渲染后焦点恢复；LC-AP / LC-DT 搜索队列从阶段级改为字段级 occurrence 队列，函数级样本确认 `部署` 为 3 个阶段、12 个字段级命中。修改范围不涉及正式 JSON、SQLite、原始 Excel、标准包、字典包、LC 数据包、环境数据包或用户 Issue / 批注数据库；未启动系统 Chrome。验证通过：相关 JS 语法检查、`audit_search_state_isolation` 33 项、`audit_environment_search_contract` 10 项、内容 smoke、`audit_global_search_index_contract`、能力 / 环境 / LC-AP / LC-DT 轻量 smoke、5173 状态、JSON 边界、GitHub 数据边界和 `git diff --check`。
- 2026-07-03 `OI-154 Page Search Queue P4 + OI-155 Context Highlight`：按用户复测 5 张截图继续收口搜索体验。页面内搜索侧：能力页和 LC-AP / LC-DT 的命中计数与上一个 / 下一个改为业务对象队列，不再只依赖可见 DOM 文本；函数级样本确认 `LC-AP 外包` 为 8 个阶段命中，`能力页 持续` 为 12 个直接命中。环境页搜索条从左侧对象树移动到环境映射工作区顶部横向搜索栏，左侧目录只保留浏览和收起目录。全局搜索侧：顶部预览补“页面 / 类型 / 路径 + 命中上下文”，搜索结果页和预览的 `命中：...` 片段高亮当前查询词。修改范围不涉及正式 JSON、SQLite、原始 Excel、标准包、字典包、LC 数据包、环境数据包或用户 Issue / 批注数据库；未启动系统 Chrome。验证通过：相关 JS 语法检查、`audit_search_state_isolation` 31 项、`audit_environment_search_contract` 9 项、`audit_global_search_index_contract` 静态 26 项与 5173 运行时 44 项、内容 smoke、能力 / LC-AP / 环境 / 搜索页轻量 smoke、5173 状态。
- 2026-07-03 `OI-154 Page Search Match Queue + OI-155 Ansible Context Fix`：按用户 5 张截图修复搜索体验。全局搜索侧：后端 `/api/v1/search-index` 新增受控 `match_context`；前端将 `Jira` 定点降噪扩展为通用生命周期降噪，`Ansible` 只保留 2 条具体 LC-AP 阶段值并压掉同名字典项 / 父级聚合项；搜索结果页增加“页面 · 业务类型 · 路径”和“命中：上下文片段”。页面内搜索侧：能力页、环境页、LC-AP / LC-DT 搜索框新增 `当前/总数` 与上一个 / 下一个；LC-AP 搜 `外包` 可在多个命中间切换；能力页搜 `架构` 时自动切到第一个直接匹配对象；环境页搜索入口补完整占位、图标和命中队列。修改范围不涉及正式 JSON、SQLite、原始 Excel、标准包、字典包、LC 数据包、环境数据包或用户 Issue / 批注数据库；未启动系统 Chrome。验证通过：相关 JS / Python 语法检查、`audit_global_search_index_contract` 静态与 5173 运行时 43 项、`audit_search_state_isolation` 28 项、`audit_environment_search_contract` 8 项、内容 smoke、搜索 / 能力 / 环境 / LC-AP 页面 smoke、JSON 边界、GitHub 数据边界、5173 状态和 `git diff --check`。
- 2026-07-03 `OI-165 Frontend Text Selection Copy Fix`：按用户反馈修复大部分页面文字和值无法稳定选中复制的问题。根因收口为可点击业务行 / 卡片 / 表格行在拖拽选中后触发 click，导致状态重渲染并清空选区；同时部分业务按钮行需要显式允许 `user-select: text`。本轮在 `app.js` 新增统一文本选区 click 保护，在 `styles.css` 增加业务文本可选择基线并保留控件 / 拖拽画布不可选，在 `index.html` 提升 `app.js` / `styles.css` 缓存版本，新增 `scripts/audit_frontend_text_selection_contract.mjs` 并扩展内容 smoke。修改范围不涉及正式 JSON、SQLite、原始 Excel / PDF、标准包、字典包、LC 数据包、环境数据包或用户 Issue / 批注数据库。验证通过：相关 JS 语法检查、文本选择契约审计、5173 状态、内容 smoke、能力映射 / Workforce 标准 / 搜索结果 / Issue 清单 / 环境 / LC-AP 页面 smoke、JSON 边界、GitHub 数据边界和 `git diff --check`；未启动系统 Chrome。
- 2026-07-03 `OI-154 Environment Page Search P2 Fix`：按用户确认开始页面内搜索治理，本轮只完成环境页优先修复。`viewModels.js` 将环境对象页面内搜索范围扩展到环境、子类、对象、作用域、安全技术服务、安全技术模块、安全技术措施和安全系统；命中非当前对象的服务 / 模块 / 措施 / 系统时，ViewModel 会选中首个匹配对象。`EnvironmentTree.js` 为树行补 `data-copy-text` 并将搜索无结果空态改为“未找到匹配的信息化环境对象”；`index.html` 提升 `viewModels.js` 和 `EnvironmentTree.js` 缓存版本；新增 `scripts/audit_environment_search_contract.mjs`，并扩展 `frontend_content_smoke_check.mjs`。本轮未修改正式 JSON、SQLite、原始 Excel、标准包、字典包、LC 数据包、环境数据包或用户 Issue / 批注数据库；未启动系统 Chrome。验证通过：相关 `node --check`、`audit_environment_search_contract`、`audit_search_state_isolation`、`audit_global_search_index_contract`、`frontend_content_smoke_check --skip-api`、环境页 smoke、JSON 包边界、GitHub 数据边界、5173 状态和 `git diff --check`。
- 2026-07-03 `Workforce Reference Tab Group Horizontal Emphasis`：按用户纠偏，将 Workforce 参考标准 tab 从上一轮纵向组头方案恢复为横向一行分组；保留 `GB/T 42446-2023` 与 `Gartner` 两个分类的视觉增强，只加重分类标签、组底板边界和组间距，不改变 tab 交互结构。同步提升 `styles.css` 缓存版本为 `workforce-reference-tab-groups-20260703-4`，并更新 `frontend_content_smoke_check.mjs` 断言横向分组样式。验证通过：相关 JS 语法检查、5173 服务状态、Workforce 页面 smoke、内容 smoke、JSON 边界、GitHub 数据边界、`git diff --check`；未启动系统 Chrome，未修改正式 JSON、SQLite、原始 Excel / PDF 或标准基准包。
- 2026-07-03 `progress.md 轻量归档瘦身`：因根目录 `progress.md` 已超过 120 行，按项目规则将瘦身前全文归档到 `docs/05-archive/progress-history/2026-07.md`，并将当前入口压缩为 `OI-154` 开工所需状态。未修改业务代码、数据包、SQLite、原始 Excel 或用户数据库。
- 2026-07-03 `OI-164 AppShell Scroll Contract Fix`：全局搜索结果页与工作台 Issue 清单页滚动架构已修复，新增 `scripts/audit_frontend_scroll_contract.mjs`，用户已确认关闭。
- 2026-07-03 `OI-155 Global Search Result Noise Pruning Fix`：修复 `#/search?q=jira` 页面把后端 1 条精确结果与已加载 fallback 合并后显示 3 条的问题；前端合并层已压掉同名清单级结果和仅靠聚合文本命中的父级阶段。
- 2026-07-03 `OI-155 Global Search Local Filter Isolation Fix`：修复全局搜索定位后污染 LC-AP / LC-DT 或页面局部搜索框的问题；全局搜索结果只保留顶部 query，`targetText` 仅用于定位和高亮。
- 2026-07-03 `OI-155 Global Search Coverage And Fuzzy Closure`：后端 `/api/v1/search-index` 继续作为全局搜索唯一轻量索引入口，已补齐导航页、工作台、Workforce、ArchiMate、生命周期明细单元格、维护字典、别名和受控模糊匹配样本。
- 2026-07-03 `OI-163 / Workforce / Dashboard`：近期 Workforce 参考标准迁移、分组 tab、Dashboard 冗余块删除、侧栏滚动治理等前序工作已完成，详细记录见 2026-07 归档。

## 本轮 OI-154 执行计划

1. 读取 `OI-154`、同步搜索治理设计和相关前端搜索代码。
2. 优先修复环境页页面内搜索：覆盖环境、子类、对象、作用域、服务、模块、措施和安全系统，确保命中非当前对象时可切换并定位。
3. 收敛页面内搜索契约：能力、知识库、标准 / 框架、LC-AP、LC-DT 和字段过滤不得写入全局搜索，也不得互相污染。
4. 补充审计脚本与轻量 smoke，默认不启动系统 Chrome。
5. 更新 `docs/06-implementation/open-issues.md` 与本文件记录。

## 维护规则

- 本文件只保留最近状态、最近 5-10 条重要执行和恢复入口；超过 120 行时继续归档到 `docs/05-archive/progress-history/`。
- 详细过程、长命令输出和阶段性历史不写入根目录 `progress.md`。
