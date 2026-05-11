# Findings: SAPD 工作知识库系统

## 2026-05-09 初始发现

用户提供的构想文档将本项目定位为本地结构化知识资产系统，而不是简单文件管理器。

提取到的关键需求：

- 工程应通过 GitHub 维护。
- 现有知识分布在 Excel、Draw.io、PPT、DOCX 等多种文件格式中。
- 知识需要结构化后存入数据库。
- 更新机制需要支持人工编辑、批量上传和第三方 ETL 映射。
- 页面需要支持不同知识类型展示、关联查询、多维导出和全量导出。
- 系统应通过本地 HTML/前端页面运行，并保持较好的性能。
- 最终交付形态是可本地执行和打包的程序。
- 功能页面需要方便扩展。
- 用户不是开发人员，需要 Codex 按阶段指导和执行。

架构判断：

- V1 使用 SQLite 和本地文件存储。
- V1 技术选型以 `docs/01-architecture/technology-decisions.md` 为准。
- ETL 可以用 Python 或 Node.js 脚本解析文件并写入 SQLite。
- V1 阶段 SQLite FTS5 足够承担基础全文检索。
- DuckDB、图数据库和 RAG 应作为后续增强，不作为 V1 基础。

实施判断：

- 从 Excel、Markdown、DOCX 开始。
- PPT 和 Draw.io 深度解析应等导入模型验证后再做。
- 必须保留原始文件和来源元数据。
- 必须记录导入任务、文件 hash、来源位置和变更日志。
- 批量导入和 ETL 更新进入正式库前应有审查和 diff 流程。

重要风险：

- 如果系统只做文件预览，价值会很有限。真正重要的是从文件中抽取知识对象和关系。

推荐近期文档：

- `docs/02-data-model/data-model.md`：当前已升级为第一版逻辑数据模型，后续 Phase 3 再补 SQLite schema 和迁移脚本。
- `docs/03-import-etl/import-rules.md`
- `docs/03-import-etl/sample-file-inventory.md`
- `README.md`
- `.gitignore`

## 2026-05-09 数据定义与 ETL 规划发现

用户补充说明：开发前还不清楚如何把多来源文件变成字段、映射和 ETL 规则。这是产品和数据设计问题，必须在实现前处理。

新的规划判断：

- 增加“数据发现与知识建模”前置阶段。
- 不要求非开发者直接定义数据库表。
- 从真实文件、用户想问的问题、导出需求和反复出现的业务概念开始。
- 先从样例文件推导字段，再把稳定字段沉淀为标准字段字典。
- 每个来源文件都是证据，不是最终数据模型本身。
- 建立来源字段/位置到标准字段的映射表。
- ETL 应设计为可审查流程：提取、标准化、映射、校验、审查、入库。
- V1 导入应包含 staging 暂存区和审查流程，再进入正式知识表。

重要设计影响：

- 开发不应从页面开始，而应从样例文件盘点、知识对象定义、字段字典、映射规则和更新规则开始。

需要新增或修订的文档：

- `docs/02-data-model/data-definition-guide.md`
- `docs/02-data-model/data-dictionary-template.md`
- `docs/03-import-etl/import-rules.md`
- `docs/03-import-etl/sample-file-inventory.md`

## 2026-05-09 补充实施指南发现

来源：用户提供的非开发者实施指南。

关键补充：

- 非开发者工作流在写代码前应明确产出三类结构化输入：`knowledge_objects.xlsx`、`field_dictionary.xlsx`、`mapping_rules.xlsx`。
- 第一份文件盘点应视为“知识资产盘点”，不是简单文件目录。
- V1 知识对象可以包括 Capability、Process、ArchitectureElement、Control、Risk、Indicator、SourceFile、Relation 和 Tag。
- 对成熟度或评估类 Excel，一行原始数据可能拆成多个对象：Capability、Indicator、AssessmentResult、ImprovementTask、Relation 和 SourceFile。
- ETL 应向用户解释为 Extract、Transform、Load：
  - Extract：读取 sheet、行、标题、幻灯片和 Draw.io 节点。
  - Transform：字段重命名、值标准化、生成 ID、拆分或合并字段、检测重复、创建关系。
  - Load：写入暂存记录和经审查后的数据库记录。
- Codex 开发任务应在数据输入稳定后排序：工程骨架、SQLite schema、Excel ETL、staging/review、基础页面。

规划影响：

- Phase 1 应同时输出 Markdown 文档和类似电子表格的配置模板。初期可以先用 Markdown，样例稳定后再生成 `.xlsx` 文件。

## 2026-05-09 第一批样例文件本地盘点发现

来源：`data/raw-samples/` 中的 3 个本地样例文件。该目录已加入 `.gitignore`，样例文件默认不提交 GitHub。

关键发现：

- Excel 样例是第一批最重要的主数据来源。用户已确认：最初提到 3 个 Sheet，后续放入的是完整 Excel，因此当前样例实际包含 26 个 Sheet。`目录` Sheet 可作为后续功能页面的参考。
- Excel 的核心主题是以安全能力为中心的多维关系，包括能力目录、作用域、信息化对象、技术服务、技术模块、流程、职能、制度/标准框架和控制项。
- PPT 样例包含 49 页幻灯片、73 个媒体资源和 35 个备注页。用户已确认 PPT 后续作为说明，单独建立使用页面。
- Draw.io 样例包含 7 个页面：信息化架构图、现状安全技术模块部署图、安全技术措施部署图、安全集成图、元模型图、流程图、功能架构图。用户已确认 Draw.io 后续作为视图展示，不考虑编辑功能。
- 第一批候选知识对象包括 SourceFile、Capability、CapabilityFocusPoint、Scope、InformationObject、SecurityTechnicalService、SecurityTechnologyModule、SecuritySystem、Product、Process、Role、StandardFramework、StandardControl、DiagramView、UserGuideSection 和 Relation。

当前主控判断：

- V1 导入应优先做 Excel，不要一开始深度解析 PPT 和 Draw.io。
- Excel 的 26 个 Sheet 后续都要纳入知识库建设范围。第一批建议先处理 5 个核心 Sheet：`安全能力目录`、`安全能力作用域目录`、`安全能力-安全技术服务`、`安全技术模块清单`、`作用域-安全技术服务-安全技术模块映射`，用于先打通主链路。
- 已生成 `docs/02-data-model/field-dictionary-draft.md`，作为第一批 5 个核心 Excel Sheet 的字段字典草案。
- 已生成 `docs/03-import-etl/mapping-rules-draft.md`，作为第一批 5 个核心 Excel Sheet 的映射规则草案。
- 已将 `docs/02-data-model/data-model.md` 从占位文档升级为第一版逻辑数据模型，定义了统一知识对象、知识关系、来源追踪、暂存审查、变更记录，以及 26 个 Sheet 的后续建模批次。

数据模型判断：

- V1 不应一开始为每种知识对象建立大量专用表。更稳妥的方式是先用 `knowledge_item` + `type` 承载对象，用 `knowledge_relation` 承载关系，用 `metadata_json` 承载暂不稳定字段。
- 必须优先实现 `source_file`、`import_job`、`source_reference`、`staging_item`、`staging_relation`，否则后续批量导入和人工审查会缺少基础。
- PPT 和 Draw.io 暂不进入主数据 ETL 链路。PPT 先走 `guide_page`，Draw.io 先走 `diagram_view`，都保留原文件和只读展示能力。

## 2026-05-09 Schema 与导入 MVP 设计发现

主控 Agent 已完成实现前设计：

- `docs/02-data-model/sqlite-schema-design.md`：SQLite schema 设计草案。
- `docs/03-import-etl/excel-import-mvp-design.md`：Excel 导入 MVP 设计。

关键判断：

- Schema 实现应先做 P0 表：`source_files`、`import_jobs`、`knowledge_items`、`knowledge_relations`、`source_references`、`staging_items`、`staging_relations`。
- P1 表包括 `item_aliases`、`review_decisions`、`change_logs`、`app_settings`，建议和 P0 同期或紧随其后实现，否则审查和变更追踪会不完整。
- FTS5 第一版只索引 `knowledge_items` 的 `title`、`description`、`code`、`category`。
- Excel 导入 MVP 应拆成：来源登记、workbook reader、5 个 Sheet parser、transformer、matcher、staging writer、review loader。
- MVP 的第一验收标准不是“页面漂亮”，而是可以把 5 个核心 Sheet 解析成对象和关系，并带来源进入 staging，经审查后入正式表。

## 2026-05-09 Migration 与本地数据边界发现

主控 Agent 已生成 SQLite migration SQL：

- `db/migrations/001_init_core.sql`
- `db/migrations/002_source_tracking.sql`
- `db/migrations/003_staging_review.sql`
- `db/migrations/004_search.sql`
- `db/migrations/005_guides_diagrams.sql`

校验结果：

- 5 个 migration 已在临时 SQLite 数据库中顺序执行通过。
- SQLite FTS5 表和触发器创建成功。

本地数据边界：

- 开发阶段数据库默认路径为 `data/database/sapd_wiki.sqlite3`。
- `data/raw-samples/`、`data/raw/`、`data/database/`、`data/processed/`、`data/previews/`、`data/exports/` 均不提交 GitHub。
- 测试 fixture 不能直接使用真实样例文件；后续需要构造或脱敏生成。

主控判断：

- Phase 3 数据模型设计已经足够进入实现。
- 下一步应开始工程骨架和 Excel 导入 MVP，不建议继续只写文档。

## 2026-05-09 Excel 导入 MVP 第一阶段实现发现

已完成第一段实现，不包含前端页面，也不正式导入业务数据。

实现内容：

- Python 命令行骨架已建立。
- 本地 SQLite migration runner 已实现。
- `data/database/sapd_wiki.sqlite3` 已成功初始化。
- `source_file` 登记已实现，使用 SHA-256 判断文件唯一性。
- `import_job` 创建和状态更新已实现。
- Excel workbook reader 已实现，能读取 workbook、统计 Sheet，并检测 5 个核心 Sheet。

验证结果：

- `schema_migrations` 有 5 条记录。
- `source_files` 有 1 条记录，文件为 `wiki sample.xlsx`。
- `import_jobs` 有 1 条记录，状态为 `parsed`。
- `knowledge_items`、`knowledge_relations`、`staging_items`、`staging_relations` 均为 0，符合“第一阶段不导入业务数据”的边界。

下一步主控判断：

- 应实现第一个 parser：`安全能力目录`。
- 该 parser 应先生成对象候选和关系候选，再写入 staging 预览，不直接进入正式表。

## 2026-05-09 Excel 导入 MVP 核心链路实现发现

主控 Agent 已完成用户确认的后三步实现：

- `安全能力目录` parser 已实现，能生成能力分类、能力域、能力、关注点对象和 `belongs_to` 关系。
- 其余 4 个核心 Sheet parser 已实现，覆盖作用域、技术服务、技术模块、系统、产品、环境、信息化对象和关系映射。
- 暂存区写入已实现，导入不会直接覆盖正式表。
- 审批入库已实现，写入 `knowledge_items`、`knowledge_relations`、`source_references`、`review_decisions` 和 `change_logs`。
- 基础查询命令已实现，可查看摘要、导入任务和对象列表。

本地验证结果：

| 指标 | 数量 |
|---|---:|
| 暂存对象 | 843 |
| 暂存关系 | 2288 |
| 正式知识对象 | 707 |
| 正式知识关系 | 2155 |
| 来源引用 | 10297 |
| 审批记录 | 2862 |
| 变更日志 | 2862 |

第一批正式对象类型数量：

| 类型 | 数量 |
|---|---:|
| capability | 32 |
| capability_category | 3 |
| capability_domain | 10 |
| capability_focus | 92 |
| environment_segment | 29 |
| information_environment | 10 |
| information_object | 51 |
| product | 78 |
| scope_type | 13 |
| security_system | 34 |
| security_technical_service | 197 |
| security_technology_module | 158 |

第一批正式关系类型数量：

| 类型 | 数量 |
|---|---:|
| applies_to_scope | 235 |
| belongs_to | 228 |
| deployed_in_environment | 228 |
| implements_service | 443 |
| maps_to_product | 103 |
| part_of_system | 168 |
| protects_object | 591 |
| supports_focus | 159 |

数据质量发现：

- `安全能力-安全技术服务` 产生 9 条 warning，主要是服务编码缺失或服务编码格式不一致。
- 这些 warning 不影响对象和关系入库，但会影响后续按服务编码做精确查询和去重。
- 下一步应先把 warning 作为数据治理事项审查，再继续扩大到剩余 21 个 Sheet。

## 2026-05-09 导入结果导出与审查发现

主控 Agent 已补齐第一批导入结果的审查材料和导出能力：

- `docs/03-import-etl/import-warning-review.md`：面向用户审查的 warning 清单。
- `data/exports/knowledge-items.csv` / `.json`：正式知识对象导出。
- `data/exports/knowledge-relations.csv` / `.json`：正式知识关系导出。
- `data/exports/import-summary-30c1db64.json`：导入任务摘要。
- `data/exports/import-result-report-30c1db64.md`：第一版导入结果报告。
- `data/exports/warning-review-30c1db64.csv`：可用表格软件打开的 warning 审查表。

主控判断：

- 现在已经有足够材料让用户判断“Excel 是否被正确理解”。
- 不建议立刻扩大到剩余 21 个 Sheet。应先确认前 5 个 Sheet 的对象、关系和 warning 处理策略。
- 如果 warning 处理策略确认无误，下一步更适合做第一个本地浏览/查询页面，让用户用页面体验数据结构是否符合预期。

## 2026-05-10 干净重建导入发现

用户将缺失服务编码统一修订为两位尾号 `-00`，主控 Agent 已完成干净重建。

结果：

- 旧数据库已备份到 `data/database/backups/sapd_wiki-before-clean-rebuild-20260510-000904.sqlite3`。
- 新数据库从 migration 重新初始化。
- 修正后的 Excel 正式导入任务为 `491f6322-e5d0-4ddd-a576-d4655ceb84cc`。
- 本次导入 `validations: none`。
- 正式知识对象数量为 710，正式知识关系数量为 2155。
- 新验收材料位于 `data/exports/clean-491f6322/`。

主控判断：

- 第一批 5 个核心 Sheet 的导入链路已经足够稳定，可以开始第一版浏览页面。
- 第一版页面应优先做能力目录浏览，而不是直接扩大到剩余 21 个 Sheet。
- 页面验证的重点是：能力层级、关注点、技术服务、作用域和来源追踪是否符合真实使用习惯。
- 曾发现 1 个关注点 `T-AD.SV-01 实现网络安全策略可视化` 被服务引用但未挂接到能力目录层级。后续已确认这是 ETL 去重键问题，不是能力目录缺项；详见 `docs/06-implementation/open-issues.md` 的 `OI-001`。

## 2026-05-10 能力目录浏览页 MVP 发现

主控 Agent 已启动第一版能力目录浏览页：

- 页面路径：`frontend/capability-browser/`
- 本地地址：`http://127.0.0.1:5173`
- 数据文件：`frontend/capability-browser/public/data/capability-tree.json`

验证结果：

- 页面能加载能力树、详情面板和关联服务面板。
- 搜索 `网络安全项目管理` 后可以定位到 `M-PM.PR-01` 关注点。
- 点击该关注点后，右侧能看到服务 `M-PM.PR-00 网络安全项目管理` 和作用域 `I-US 用户`。

新发现：

- 部分 `ALL` 作用域服务在页面上显示为 `&T-*` 片段，说明 `ALL` 范围的服务编码/展示规则还需要单独规范。
- 这不是页面加载错误，而是 ETL 显示规则需要增强。

## 2026-05-10 ALL 作用域服务修正发现

主控 Agent 已修正 `ALL` 作用域服务解析和页面展示：

- `ALL&T-*` 已作为完整服务编码解析，不再拆成 `code=ALL` 和 `title=&T-*`。
- `ALL&TI.*`、`ALL&T-TI.*` 已在 ETL 中标准化为 `ALL&T-IN.*`。
- `ALL` 作用域在页面中显示为 `全部作用域`。
- 服务卡片已增加来源追踪展开区。

验证结果：

- 最新正式导入任务：`d1c3fe17-7059-466b-a8d9-c5b6a8a8f527`。
- `code = ALL` 的安全技术服务数量为 0。
- `ALL&T-*` 安全技术服务数量为 13。
- 最新验收报告位于 `data/exports/clean-d1c3fe17/`。

已关闭的数据治理点：

- `ALL&T-AD.IR-02` 与 `ALL&T-AD.IR-03` 曾出现源数据编码混淆。用户已手工修正 Excel，并于 2026-05-11 完成干净重建验证；详见 `docs/06-implementation/open-issues.md` 的 `OI-002`。

## 2026-05-10 前端树布局问题修复

用户截图反馈：左侧能力树中编码和标题发生重叠。

原因：

- 前端树节点使用三列布局，但编码列固定为 24px，无法容纳 `T-AD.IR-03` 这类编码。

修复：

- 编码列改为自适应宽度；
- 无编码节点单独使用 `no-code` 布局；
- 已在 Chrome 中刷新页面验证，左侧树不再重叠。

当前待确认问题集中记录在：

- `docs/06-implementation/open-issues.md`

## 2026-05-11 剩余 21 个 Sheet 建模发现

主控 Agent 已为 `wiki sample.xlsx` 中未进入第一批 ETL 的 21 个 Sheet 创建建模草案：

- `docs/03-import-etl/remaining-21-sheets-modeling.md`

核心发现：

- 剩余 21 个 Sheet 不应一次性写代码导入，应分成流程/职能、生命周期、标准框架、目录版本四类。
- 第二批最适合先做“能力到安全工作、流程、职能”的链路，因为它能直接扩展当前能力详情页，且比标准框架类更容易让用户确认。
- 当时曾建议第二批先处理 4 个 Sheet，后续已按用户澄清修订为 5 个 Sheet：
  - `安全能力-安全工作`
  - `安全能力-安全管理元素（high level）`
  - `安全职能流程清单（完善L4）`
  - `安全工作职能清单`
  - `gartner工作岗位参考`
- 暂缓 `安全能力-安全管理元素（细化版本）`，等 high level 模型确认后再细化，避免职能矩阵返工。
- 标准/框架类 Sheet 数据量大，应拆成能力到标准映射和标准控制项主数据两个子批次。

新增对象类型草案：

- `security_work`
- `process_domain`
- `process_group`
- `process_reference`
- `process_activity`
- `work_function`
- `work_task`
- `work_role_reference`
- `lifecycle_process`
- `lifecycle_scene`
- `application_type`
- `standard_framework`
- `standard_control`
- `policy_item`
- `workbook_section`
- `version_record`

主控判断：

- 在第二批范围未澄清前不应分线程写代码。
- 用户已在后续澄清中将第二批调整为 5 个 Sheet；以“第二批 Sheet 范围修订发现”为准。

## 2026-05-11 第二批 Sheet 范围修订发现

用户进一步明确第二批不再按 4 个 Sheet，而是按 5 个 Sheet 建模：

- `安全能力-安全工作`
- `安全能力-安全管理元素（high level）`
- `安全职能流程清单（完善L4）`
- `安全工作职能清单`
- `gartner工作岗位参考`

关键修订：

- `安全能力-安全工作` 表示安全能力关注点对应的安全工作内容。
- `安全能力-安全管理元素（high level）` 表示 L2安全能力到 L2流程组、能力关注点到 L3流程参考、以及四类组织职能相关方的映射。
- `安全职能流程清单（完善L4）` 是流程主数据，L4关键活动允许后续补充，一个 L3流程未来可以映射多个 L4关键活动。
- `安全工作职能清单` 不从安全能力关注点往下映射，而是按网络安全决策层、管理层、执行层和监督层独立展示，需要新增页面模块；该表还包含 GB/T 42446-2023 映射和嵌入图片展示需求。
- `gartner工作岗位参考` 作为 Gartner 安全工作岗位/角色参考库进入第二批，但暂不自动映射到内部安全工作职能。

本地 Excel 快速检查结果：

- `安全工作职能清单` 检测到 1 张嵌入 PNG 图片，位置在表格右侧区域，需要在后续 ETL 中作为展示资产提取。
- `安全工作职能清单` 存在合并表头和空列，GB/T 42446-2023 映射列与引用数据列不能只依赖标题文本，需要结合用户说明和单元格位置识别。
- `gartner工作岗位参考` 当前读取到 3 个核心字段：分类、角色、描述。

主控判断更新：

- 第二批字段字典、映射规则和逻辑数据模型已补充到对应文档。
- 下一步可以分线程写代码：ETL Agent、Frontend Agent、Export Agent，由主控 Agent 审查和合并。

## 2026-05-11 第二批并行编码验收发现

主控 Agent 已按第二批数据契约完成三路并行编码的合并和本地验收。

工程判断：

- 先写 `docs/03-import-etl/second-batch-data-contract.md` 是必要的。它让 ETL、前端、导出三个 Worker 能并行工作，并且避免不同 Agent 对对象类型、关系类型和 JSON 结构各自发挥。
- 第二批已经从“建模草案”进入“可本地页面审查”的状态。当前不再只是文档判断，用户可以直接在页面上检查业务结构是否符合预期。
- `安全工作职能` 不适合塞进原能力目录页面，独立模块方向是正确的；能力目录只扩展关注点详情中的安全工作和流程映射。
- `L4关键活动` 不应生成空对象。源数据未补齐时保留 `process_activity: 0` 比制造占位数据更稳妥。

本地验收结果：

| 指标 | 数量 |
|---|---:|
| 第二批正式新增对象 | 418 |
| 第二批正式更新对象 | 122 |
| 第二批正式新增关系 | 2040 |
| 第二批 validation | 0 |
| 当前正式知识对象总数 | 1122 |
| 当前正式知识关系总数 | 4195 |

需要用户业务判断：

- `安全工作职能` 页面出现 `未分组` 和标题 `...`，这是数据清洗规则问题，不是页面崩溃问题。已记录为 `docs/06-implementation/open-issues.md` 的 `OI-008`。
- 如果这些内容来自 Excel 的说明行或占位行，下一步应定义 ETL 过滤规则；如果它们本身是业务内容，则需要补充正式分组和标题。
