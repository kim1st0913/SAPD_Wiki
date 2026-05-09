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
- V1 技术选型以 `docs/technology-decisions.md` 为准。
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

- `docs/data-model.md`：Phase 3 详细设计，当前已建立占位文档。
- `docs/import-rules.md`
- `docs/sample-file-inventory.md`
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

- `docs/data-definition-guide.md`
- `docs/data-dictionary-template.md`
- `docs/import-rules.md`
- `docs/sample-file-inventory.md`

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
