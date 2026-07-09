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
- 默认不为每次小修新增文档、设计说明或 Issue；优先复用现有入口，在 `progress.md` 记录执行，在任务完成反馈里给出验收入口。
- 新增长期文档必须满足至少一个条件：跨模块稳定契约、用户需要单独阅读的交付说明、数据 / 安全 / 审计治理边界、或现有入口继续追加会明显破坏可读性。
- 当前文档治理规则以 `docs/07-governance/governance-index.md` 为准；新文档必须先能说明读者、用途、维护入口和退役条件。
- 设计文档默认按 `docs/README.md` 和 `frontend/design-handoff/README.md` 的分层规则管理：`implementation-specs/` 才是页面代码实现依据；Stitch 输入 / 输出、截图、prompt 和旧 brief 只能作为参考，不能直接驱动实现；小 UI 修复、文案和局部样式不新增设计文档。

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
- 新数据、实验数据和前端试验默认在当前 `main` 内通过受控 demo 页 / demo 数据完成；demo 数据不得静默覆盖稳定基准 SQLite、正式 JSON、源 Excel、用户库或 DMG 产物。正式接入前必须明确权威源、对象粒度、写入范围、回退方案和验收命令。
- `progress.md` 超过 120 行时应先归档瘦身，再继续大任务。
- 工作区存在大量未提交改动时，应建议 checkpoint commit，降低重连后的恢复成本。

## Git / GitHub 收口会话规则

本项目默认把“实现 / 验证”和“提交 / 推送 / PR”分开处理，避免普通开发会话在脏工作区里顺手提交过大或混杂的 diff。

- 专用 Git / GitHub 收口会话：`SAPD Wiki GitHub 提交收口专用 2026-07-07`，thread id `019f3bee-d713-7301-be67-6d555012a5c9`。
- 普通业务开发、前端修复、ETL、审计、打包和文档会话默认不执行 `git commit`、`git push` 或创建 PR；只在用户明确要求“就在当前会话提交 / 推送”时例外。
- 需要提交或推送时，优先让专用收口会话执行：先读取 `AGENTS.md`、`CURRENT_STATE.md`、`progress.md`，再用 `git status --short --branch` 和 `git diff --stat` 给出拟提交范围。
- 专用收口会话必须按主题拆分 checkpoint，只 stage 明确相关文件，禁止 `git add .`。
- 同步 GitHub 前必须执行 `python3 scripts/check_github_data_boundary.py`；涉及前端、数据、打包或治理变更时，按项目规则补跑相应轻量检查。
- 禁止把源 Excel、SQLite、正式生成 JSON、导出包、用户 Issue / 批注数据库、macOS DMG 产物或其他禁止数据提交到 GitHub，除非用户明确授权且项目规则允许。

## SAPD Wiki 主控问题处理契约

SAPD Wiki 的问题修复默认不是“看到现象就打补丁”。所有主控会话和后续继任会话处理数据、页面、搜索、滚动、打包、导入、导出、审计或产品体验问题时，必须先把问题抽象到系统契约层，再进入实现。

用户每次给出的截图、搜索词、单条数据、页面现象或口头反馈，默认视为“问题样例”，不是“只修这一处”的单点任务。除非用户明确说明只处理指定对象，否则 Codex 必须用该样例反查同类页面、同类数据粒度、同类索引 / 展示 / 导入契约是否存在系统性问题，并把修复和验收固化到可复用规则或审计断言中。

默认执行顺序：

1. 先定本质规则：判断现象背后是哪条系统契约不清楚、被破坏或未被固化。
2. 再定边界：明确权威源是什么、业务粒度是什么、哪些自动推断或跨粒度复用绝对禁止。
3. 再补验收：给出黄金样例、反例、断言脚本、静态审计或页面验收点，避免只靠肉眼和局部 smoke 判断。
4. 最后才改代码、数据或页面；修改必须遵守既有数据边界、前后端分离边界和禁止范围。
5. 完成反馈必须说明本轮固化了哪条本质规则，不得只报告“改了什么”和“测试通过”。

若任务很小，也可以简化表达，但不能跳过契约判断。若涉及源 Excel、SQLite、正式 JSON 数据包、标准 / 字典 / 生命周期基线、回退、提交、打包或系统浏览器回归，仍必须先确认边界和风险。

### Web / App 双运行面影响分类

每个 bug 修复都必须先声明运行面影响分类，不能默认把 `5173` 浏览器结论等同于 macOS DMG App 结论，也不能默认每个小修都要求重打 DMG。

默认分类：

- `shared runtime`：页面 JS / CSS、路由、搜索、批注、Issue、导出前端状态等共享前端逻辑。通常 Web 和 DMG App 都受影响，修复可在共享代码完成，但反馈必须说明 App 是否需要回归或等下次 DMG 验收。
- `data / ETL / JSON package`：源数据、SQLite、导出投影、索引、字段边界和数据包。Web / App 共享数据口径，必须用源到包到页面链路验证，不能只看某个页面。
- `web-only`：仅涉及 5173 开发服务、系统浏览器缓存、开发预览或浏览器专属能力。可只验 Web，但必须说明为什么不影响 App。
- `app-only`：涉及 `WKWebView`、macOS 窗口、全屏、下载、文件保存路径、用户库、授权、打包 runtime、签名 / Gatekeeper。Web 通过不算验收，必须进入 App 或发布矩阵验证。
- `release blocker`：影响启动、授权、用户状态、搜索定位、批注 / Issue 写入、导出、核心业务页面或用户数据安全的 P0 / P1 问题。必须进入 `docs/09-delivery/release-acceptance-matrix-0.1.md` 的证据目录和阻断分级。

完成反馈必须给出：`影响面：Web / App / 两者 / 暂未覆盖`，`根因层：data / shared frontend / API / user DB / macOS wrapper / packaging runtime`，以及 `验证范围：5173 / DMG App / 自动审计 / 人工验收 / 未做原因`。

## 问题维护规则

后续中高严重性 bug、全局问题、数据问题、审计问题、安全 / 边界问题和待确认业务问题，统一维护在：

- `docs/06-implementation/open-issues.md`

规则：

- 不再把待处理问题分散写到多个文档作为主记录。
- `findings.md`、`progress.md`、`task_plan.md` 可以简要提及问题，但必须指向 `open-issues.md`。
- 小问题默认直接修复，不新建 `OI`：例如文案、轻微样式、单页小交互、局部空态、可在本轮完成并自动验证的回归。
- 只有满足以下至少一项才新建 `OI`：影响多个页面或数据域、涉及源数据 / ETL / 字典 / 标准 / SQLite / 正式 JSON、需要审计脚本或长期防回归、涉及安全或数据边界、需要用户业务判断、无法在本轮完整修复或验收、或严重性为中 / 高。
- 每个问题使用稳定编号，如 `OI-001`、`OI-002`。
- 每个问题至少记录：状态、严重性、类型、对象或页面、现象、影响、建单理由、处理方式、验证结果、验收入口和关闭条件。
- 修复后不能删除问题，应把状态改为 `已修复`，并补充修复说明和验证结果。
- 若问题需要用户验收，完成反馈必须明确提示“需要你验收”，并给出固定入口、导航路径、预期现象和是否已做浏览器 / 自动回归。
- 若自动验证已覆盖且不需要用户业务判断，修复后可以直接标记为 `已关闭 / 自动验收通过`，不用长期停留在“待页面验收”。
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
- 前端数据粒度必须严格匹配：关注点级 projection、轻量首屏投影、fallback 数据或缓存数据，只能用于声明的对象粒度；不得把 `capability_focus` 级数据用于 L0 / L1 / L2 能力层级节点。
- 禁止用 `rows[0]`、默认关注点、首个子节点、最近一次选中对象或旧投影数据驱动主展示区当前对象；当前对象必须来自左侧显式选中 ID 或后端明确返回的同粒度对象。
- 修改 `dataClient`、`ViewModel`、按需加载、刷新恢复、缓存版本或图谱输入时，必须验证 L0、L1、L2、关注点四类选择，并断言左侧选中对象、右侧标题 / 图谱中心和 `localRelationMap.focus` 或等价当前对象一致。

知识库字典与安全标准 / 框架是全局只读基准：

- `maintenance-knowledge.json`、`maintenance/*`、`lifecycle-knowledge.json` 中的应用系统目录、`standards-index.json`、`standards-data.json`、`standards/*` 一旦导入确认，业务模块不得反向改写。
- 环境映射、能力映射、LC-AP / LC-DT、临时核对表和 review / worker-verify 产物只能引用上述基准或输出问题报告，不得把引用方结果写回基准包。
- 修改字典或标准基准必须有用户明确授权；如果只是发现不一致、缺失、别名或覆盖风险，先记录 `open-issues.md` 和审计报告，不自动修复或重导。
- 禁止用 `bootstrap-local-data --profile core --reset` 或 core-only 导出覆盖已存在的字典 / 标准 / 生命周期保护基线；如确需执行，必须先取得用户明确授权，使用 `--allow-protected-baseline-reset` 并保留自动备份和审计报告。
- 涉及数据导入、导出、重导入或正式前端数据包替换后，必须执行 `python3 scripts/audit_dictionary_standard_baseline_integrity.py`；关键数组为 0 时不得交付为通过。
- 分析 Excel 时必须读取并保留 merged ranges；合并单元格是业务关系边界，不允许 CSV 化后反推，也不允许对非合并空值做全局 forward fill。

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

排序字段缺省值必须显式判断：

- `sortOrder`、`sourceOrder`、`tree_order`、`display_order`、`rowIndex` 等业务顺序字段中，`0` 可能是合法顺序值。
- 不得使用 `value || fallback`、`Number(value) || fallback`、`order || 999999` 这类 truthy 判断处理排序字段缺省值。
- 必须显式判断 `null`、`undefined`、空字符串或非有限数字，例如使用 `value == null || value === ""`、`Number.isFinite(...)` 或 `??`。
- 排序回归检查必须覆盖首个顺序值为 `0` 或分组内第一行的场景，避免首项被误判为缺失并排到末尾。

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

每次任务完成后，Codex 应更新 `progress.md`；如果阶段状态变化，应同步更新 `task_plan.md`。只有达到建单门槛的 bug / 数据 / 审计 / 安全 / 全局问题才同步更新 `docs/06-implementation/open-issues.md`；小问题直接修复并在完成反馈中给出验证结果。

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
- 子 Agent 等待超时时，只能记录为“仍在运行 / 暂无新输出 / 未完成”，不得把“无新输出”判定为“无响应”或“失败”。
- 长任务没有文本输出不等于卡死。只要 agent 状态仍为运行中，或相关进程、日志、产物文件仍有活动，就必须视为仍在执行。
- 主控不得因为一两次 `wait_agent` 超时就关闭子 Agent；关闭前必须完成“三次确认”：确认 agent 状态、确认是否有日志 / 文件 / 产物变化、向用户说明证据并请求是否继续等待或停止。
- 未经用户明确同意，不得关闭仍在运行的子 Agent；只有明确完成、明确报错退出、用户要求停止，或三次确认后用户批准停止，才允许 `close_agent`。
- 子 Agent 运行中，主控不得重复执行同一写入任务；如需旁路检查，只能做不修改文件的只读核查，并说明不会影响原任务。
- 子 Agent 完成后，主控 Agent 必须及时读取结果、汇总结论、判断是否采纳，并在确认不再需要后主动 `close_agent` 释放线程名额。
- 若子 Agent 疑似卡住，必须提供证据，例如运行时长、最后输出、产物更新时间、重复等待次数和阻塞点；不能仅凭“暂无输出”判断。
- 不得让历史子 Agent 长时间悬挂；但清理历史 Agent 前也必须先确认状态和用户意图，避免误杀仍在运行的任务。
