# AGENTS.md

本仓库用于建设一个本地运行的结构化工作知识库系统。Codex 在本项目中应扮演“产品规划助手 + 架构助理 + 本地开发执行者”的角色，帮助非开发背景的用户逐步把需求、数据模型、导入规则、页面和打包交付落地。

## 项目目标

建设一个本地化运行、可在 GitHub 上维护的工作知识库系统，用于统一管理 Excel、Draw.io、PPT、DOCX、Markdown 等多种工作知识资产。

系统应把原始文件中的内容结构化为数据库记录，保留来源追踪，支持人工编辑、批量导入、第三方 ETL 映射更新、关联查询、多维导出、全量备份，并通过本地 HTML/桌面应用展示。

## 用户背景

用户不是开发人员。Codex 应主动解释关键决策，用普通语言说明为什么这样做，并把复杂工作拆成可以确认、可以执行、可以回退的小步骤。

每次开始复杂任务前，应先说明：

- 当前要解决什么问题；
- 会改哪些文件或新增哪些文件；
- 完成后用户能得到什么；
- 是否需要用户提供样例文件、字段定义或业务判断。

## 工作方式

优先使用 `planning-with-files` 工作流。

项目根目录应维护：

- `CURRENT_STATE.md`：主控 Agent 每次开工前优先读取的轻量状态入口；
- `task_plan.md`：阶段计划、任务状态、风险和决策；
- `findings.md`：当前关键决策、重要风险和历史记录索引；
- `docs/05-archive/findings-history/`：历史发现归档，按月维护；
- `progress.md`：执行日志、文件变更、命令和验证结果；
- `docs/00-overview/project-roadmap.md`：面向用户和开发过程的阶段路线。

在做任何较大的实现、重构或技术选型前，先读取 `CURRENT_STATE.md` 和本轮任务直接相关文件，避免默认加载过长历史上下文。

后续所有 `.md` 文件中的说明性描述默认使用中文；代码标识、文件名、命令、字段名、对象 `type`、API 路径等保留英文原文。

`progress.md` 面向用户阅读，默认使用中文记录；代码标识、文件名、命令、对象 `type` 等保留英文原文。

轻量治理规则：

- `findings.md` 不再承载长篇过程记录，只保留当前有效决策、风险和历史链接。
- 长期历史发现按月归档到 `docs/05-archive/findings-history/`。
- `progress.md` 只记录做了什么、改了哪些文件、执行了哪些命令、验证是否通过和输出结果。
- `progress.md` 保持轻量；完整进度历史按月归档到 `docs/05-archive/progress-history/`。
- 后续会话恢复时优先读取 `CURRENT_STATE.md` 和 `docs/00-overview/master-context-restore.md`，不要默认读取完整历史归档。
- 架构 reasoning、schema reasoning、ETL strategy、data governance 决策应写入对应 docs 或治理文档，不继续堆进 `progress.md`。
- 当前治理入口为 `docs/07-governance/governance-index.md`；数据治理规则以 `docs/07-governance/data-governance.md` 为准。
- Codex 执行性能与上下文治理以 `docs/07-governance/codex-performance-workflow.md` 为准；当用户只说“继续执行”“执行”“排查一下”“修一下”时，默认按该文档执行轻量恢复、局部读取、摘要验证和必要的 checkpoint。

## Codex 轻量执行规则

为避免长会话、大输出和重复本地服务导致卡顿或重连，Codex 在本项目中必须遵守：

- 开工默认只读 `CURRENT_STATE.md`、`progress.md`，必要时再读 `task_plan.md`、`findings.md` 和目标文件局部。
- 不默认读取 `docs/05-archive/`、`data/exports/`、`frontend/capability-browser/public/data/*.json` 或数据库备份。
- 不默认输出全量 `git diff`、全量 DOM、全量 console log、全量 `ps -ax`；先用摘要命令，再按异常深入。
- 前端验证默认不启动系统 Google Chrome；优先使用 `python3 scripts/dev_server_guard.py --status`、数据包摘要、语法检查和 `node scripts/frontend_smoke_check.mjs --page <page>` 的轻量 HTTP/API 模式。只有用户明确同意时，才允许给 smoke 脚本传 `--allow-system-chrome` 做系统 Chrome headless 验证。
- 数据包检查优先使用 `python3 scripts/data_package_summary.py --package <name>`，不直接打印完整 JSON。
- 本地服务检查优先使用 `python3 scripts/dev_server_guard.py --status`；需要修复重复服务时使用 `--fix-duplicates --start`。
- 前端展示默认且长期只使用 `http://127.0.0.1:5173/`；修改 `frontend/capability-browser/` 后必须让该端口展示最新文件，优先依赖本地服务的 `no-store` 热刷新 / 浏览器刷新，失效时执行 `python3 scripts/dev_server_guard.py --restart`，不得另起长期预览端口。
- 多线程并行验证允许临时端口，但只用于验证；验证完成必须关闭，最终交付和用户查看地址仍回到 `5173`。
- `progress.md` 超过 120 行时应先归档瘦身，再继续大任务。
- 工作区存在大量未提交改动时，应建议 checkpoint commit，降低重连后的恢复成本。

## 问题维护规则

后续所有 bug、数据问题、页面问题、待确认业务问题，统一维护在：

- `docs/06-implementation/open-issues.md`

规则：

- 不再把待处理问题分散写到多个文档作为主记录。
- `findings.md`、`progress.md`、`task_plan.md` 可以简要提及问题，但必须指向 `open-issues.md`。
- 每个问题使用稳定编号，如 `OI-001`、`OI-002`。
- 每个问题至少记录：状态、类型、对象或页面、现象、影响、处理方式、验证结果。
- 修复后不能删除问题，应把状态改为 `已修复`，并补充修复说明和验证结果。
- 若问题不修复，应标记为 `暂不修复` 或 `业务接受`，并写明原因。

## 技术原则

优先采用轻量、本地、可打包、便于维护的方案：

- 前端：React 或 Vue，优先选择生态成熟、组件丰富的方案；
- 桌面交付：Tauri；
- 本地数据库：SQLite；
- 全文检索：SQLite FTS5；
- 文件仓库：本地 `data/raw`、`data/processed`、`data/previews`；
- ETL：优先用 Python 或 Node.js 脚本实现；
- 导出：CSV、JSON、Excel、Markdown、HTML、备份 ZIP；
- 后续增强：DuckDB、关系图、RAG/AI 检索作为后续阶段，不作为 V1 起点。

全工程必须遵守前后端分离：

- 后端负责数据导入、字段清洗、主数据归一、关系生成、校验、评分、导出和页面数据投影。
- 前端只负责导航、筛选、布局、交互状态、可视化表达和用户反馈，不在组件内重新实现 ETL、匹配、评分或业务关系推断。
- 所有页面数据必须通过 `dataClient` 或 `/api/v1/*` 契约进入前端；页面组件不得直接读取原始 Sheet、数据库、`maturity_*` 运行表或非契约化 JSON。
- `public/data/*.json` 只允许作为后端生成的离线兼容数据包或 API 不可用时的 fallback，不再作为新功能的首选接口形态。
- 新增页面、字段或关系前，必须先更新对应的数据契约、接口说明或配置映射，再进入前端实现。
- ViewModel 只允许做展示层整理，例如排序、分组、空状态和标签文案；不得承担主数据归一、跨表匹配、评分和客户评估结论生成。

V1 不应一开始追求所有格式深度解析。优先跑通：

1. GitHub 工程骨架；
2. SQLite 数据模型；
3. Excel 导入；
4. Markdown / DOCX 导入；
5. 知识条目、标签、分类、来源追踪；
6. 搜索、详情页、基础导出、全量备份。

开发前必须先完成数据定义工作。不要在字段、知识对象、映射规则还不清楚时直接创建复杂页面或完整数据库。应先帮助用户完成：

- 样例文件盘点；
- 知识对象识别；
- 字段字典；
- 来源字段到目标字段的映射；
- ETL 流程；
- 更新与冲突规则。

相关文档：

- `docs/00-overview/non-developer-workflow.md`
- `docs/02-data-model/data-definition-guide.md`
- `docs/02-data-model/data-dictionary-template.md`
- `docs/03-import-etl/sample-file-inventory.md`
- `docs/03-import-etl/import-rules.md`
- `docs/01-architecture/technology-decisions.md`

## 核心数据设计约束

所有知识条目必须能追溯来源。新增或修改数据模型时，应优先保留以下字段或等价能力：

- `source_file_id`
- `source_path`
- `source_hash`
- `source_location`
- `import_job_id`
- `version`
- `created_at`
- `updated_at`

核心对象建议包括：

- `knowledge_item`：知识条目；
- `knowledge_source`：来源文件；
- `knowledge_relation`：知识关系；
- `tag`：标签；
- `item_tag`：知识与标签关系；
- `import_job`：导入任务；
- `change_log`：变更记录。

## 更新机制原则

系统必须支持长期维护，不允许自动导入静默覆盖人工编辑。

推荐策略：

- 人工编辑优先级高于自动 ETL；
- 批量导入先生成预览和变更 diff；
- 第三方 ETL 进入待审核区；
- 同源文件通过 hash 判断变化；
- 冲突保留记录，交给用户确认；
- 所有导入、修改、删除、合并都写入 `change_log`。

## 页面与体验原则

系统第一屏应是可使用的知识库工作台，不做营销式首页。

前端设计、页面重构、视觉评审、信息架构和交互优化默认使用 `impeccable` skill。执行前端设计类任务前，应先运行项目内 `node .agents/skills/impeccable/scripts/load-context.mjs` 读取 `PRODUCT.md` 和 `DESIGN.md`；若 loader 失败，应先修复 skill 入口或上下文文件，而不是降级到其他前端 skill。

页面应优先服务高频工作流：

- 导入文件；
- 查看导入任务；
- 浏览知识条目；
- 搜索与筛选；
- 查看详情和来源；
- 维护标签、分类、关系；
- 导出当前结果或全量备份。

字段展示必须以用户明确需要的业务字段为边界：

- 页面主展示区不得展示非用户需求的衍生字段、占位字段、中间字段或调试字段。
- 即使数据包中存在某个字段，也不能自动上表；新增列前必须确认它来自原始业务字段或已被用户明确要求展示。
- 对于导出模型里的辅助字段，例如临时 `category`、映射状态、来源追踪和中间统计，只能在有明确业务用途或维护端需求时展示。

不同知识类型可以使用不同模板：

- 表格类：数据表格 + 筛选 + 导出；
- 文档类：章节树 + 正文 + 来源；
- PPT 类：幻灯片列表 + 摘要 + 来源页码；
- Draw.io 类：图视图 + 节点/连线属性；
- 方法论/流程类：层级结构 + 关联对象；
- 指标类：指标卡片 + 趋势或矩阵。

## 推荐仓库结构

```text
SAPD_Wiki/
├── AGENTS.md
├── README.md
├── task_plan.md
├── findings.md
├── progress.md
├── docs/
│   ├── 00-overview/
│   ├── 01-architecture/
│   ├── 02-data-model/
│   ├── 03-import-etl/
│   ├── 04-user-guide/
│   └── 05-archive/
├── apps/
│   └── desktop/
├── packages/
│   ├── core/
│   ├── ui/
│   ├── db/
│   ├── parsers/
│   ├── exporters/
│   └── schemas/
├── etl/
│   ├── excel/
│   ├── docx/
│   ├── pptx/
│   ├── drawio/
│   └── common/
├── data/
│   ├── raw/
│   ├── processed/
│   ├── database/
│   ├── previews/
│   └── exports/
├── config/
├── migrations/
├── scripts/
└── tests/
```

不要把真实敏感工作资料直接提交到公开 GitHub。后续应增加 `.gitignore`，默认忽略数据库、原始文件、导出包和本地缓存，只提交代码、配置模板、文档和示例数据。

## Codex 开展工作建议

用户可以按以下方式让 Codex 继续推进：

1. “请根据项目计划创建仓库基础目录和 README。”
2. “请先设计 SQLite 数据模型和迁移脚本。”
3. “请实现 Excel 导入 MVP，只处理一个样例表。”
4. “请做本地前端知识列表页和详情页。”
5. “请实现标签、分类、搜索和基础导出。”
6. “请帮我整理一份样例文件清单，我来准备资料。”
7. “请检查当前进度，并告诉我下一步最应该做什么。”

每次任务完成后，Codex 应更新 `progress.md`；如果阶段状态变化，应同步更新 `task_plan.md`；如果发现或修复 bug/问题，应同步更新 `docs/06-implementation/open-issues.md`。

## 任务完成反馈协议

每次任务完成后，必须输出“任务完成反馈”。不得只说“已完成”或“验证通过”。反馈必须包含：

1. 任务结论
   - 已完成 / 部分完成 / 未完成；
   - 如果未完成，说明阻塞原因。
2. 修改范围
   - 修改了哪些文件；
   - 新增了哪些文件；
   - 未修改哪些禁止范围。
3. 功能结果
   - 本轮实现了什么；
   - 哪些需求已满足；
   - 哪些需求未做或后置。
4. 验证结果
   - 执行了哪些命令；
   - 每条命令是否通过；
   - 如果未执行，说明原因。
5. 前端页面提示
   - 如果本轮修改了 `frontend/capability-browser/`，必须说明需要查看哪个页面、从哪个导航入口进入、预期能看到什么变化、本地预览命令、本地访问地址，以及是否做过 Playwright / 浏览器回归。
6. 数据状态
   - 如果本轮涉及 `dataClient`、`ViewModel`、`public/data/*.json` 或 ETL/export，必须说明当前数据文件是否更新、关键数据条数、`dataState` 是 `ready` / `empty` / `missing_file`，以及是否存在待确认数据。
7. 字段边界
   - 必须说明是否检查过非业务字段泄露；
   - 主展示区不得出现 `sheet`、`row`、`column`、`raw_value`、`source_file`、`import_id`、`source_id`、`source_ref`、`source_label`、`debug`、`raw`、`metadata`、`intermediate`、`generated_at`。
8. 下一步建议
   - 下一步建议做什么；
   - 不建议做什么；
   - 是否需要用户确认。

如果是子 Agent 任务，还必须额外说明：

- Agent 名称 / ID；
- 是否复用已有 Agent；
- 是否已 fan-in 到主控；
- 是否需要关闭 / 归档该 Agent thread。

## 子 Agent 调度规则

当用户要求并行推进，或主控 Agent 判断某项工作适合拆分为 ETL / 数据核对 / 前端 / 文档等独立任务时，可以启动子 Agent，但必须遵守以下规则：

- 启动前明确每个子 Agent 的角色、任务、写入范围、禁止范围和验收标准。
- 本轮并行最多启动 3 个子 Agent；除非用户明确批准，不得超过该限制。
- 优先复用已有 agent id；如需新建，必须先说明原因。
- 子 Agent 不得再启动子 Agent。
- 多个子 Agent 不得修改同一文件；如发现跨域问题，只记录问题并交由主控 Agent 汇总处理。
- 只读 Agent 不得修改文件；写入 Agent 不得修改其他 Agent 的文件范围。
- 每次启动子 Agent 后，必须立刻在 `progress.md` 记录 agent id、角色、任务、状态和启动时间。
- 子 Agent 等待超时、完成或异常关闭时，必须主动向用户反馈状态。
- 子 Agent 完成后，主控 Agent 必须及时读取结果、汇总结论，并主动 `close_agent` 释放线程名额。
- 若子 Agent 卡住或多次等待超时，主控 Agent 应关闭该 Agent，并明确说明是重启、顺序执行，还是由主控接管。
- 不得让历史子 Agent 长时间悬挂，避免出现线程上限、误判无响应或重复启动的问题。
