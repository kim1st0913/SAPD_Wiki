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

- `task_plan.md`：阶段计划、任务状态、风险和决策；
- `findings.md`：调研结论、需求发现、技术判断；
- `progress.md`：每次工作记录、文件变更、验证结果；
- `docs/project-plan.md`：面向用户和开发过程的正式项目计划。

在做任何较大的实现、重构或技术选型前，先读取上述文件，避免偏离项目目标。

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

- `docs/data-definition-guide.md`
- `docs/data-dictionary-template.md`
- `docs/sample-file-inventory.md`
- `docs/import-rules.md`
- `docs/non-developer-codex-workflow.md`
- `docs/technology-decisions.md`

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

页面应优先服务高频工作流：

- 导入文件；
- 查看导入任务；
- 浏览知识条目；
- 搜索与筛选；
- 查看详情和来源；
- 维护标签、分类、关系；
- 导出当前结果或全量备份。

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
│   ├── project-plan.md
│   ├── architecture.md
│   ├── data-model.md
│   ├── import-rules.md
│   ├── sample-file-inventory.md
│   └── non-developer-codex-workflow.md
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

每次任务完成后，Codex 应更新 `progress.md`；如果阶段状态变化，应同步更新 `task_plan.md`。
