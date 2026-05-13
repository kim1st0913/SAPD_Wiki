# 项目路线图

本文档是面向用户阅读的阶段路线说明。项目阶段状态以根目录 `task_plan.md` 为唯一权威来源。

## Phase 0：需求澄清与项目规划

状态：已完成

目标：

- 明确项目定位；
- 建立 Codex 工作规则；
- 形成项目计划、轻量架构和初始数据定义方法；
- 明确 GitHub 存储边界。

主要产物：

- `AGENTS.md`
- `README.md`
- `task_plan.md`
- `findings.md`
- `progress.md`
- `docs/00-overview/project-vision.md`
- `docs/00-overview/project-roadmap.md`
- `docs/01-architecture/architecture.md`

## Phase 1：数据发现与字段定义

状态：进行中

目标：

- 从真实样例文件出发，确定第一批知识对象、字段和映射规则；
- 避免在字段不清楚时提前开发复杂页面或数据库。

任务：

- 准备 5 到 10 个代表性样例文件；
- 完成知识资产盘点；
- 识别第一批 V1 知识对象；
- 起草字段字典；
- 起草文件字段到标准字段的映射规则；
- 判断哪些样例可提交 GitHub，哪些必须本地保留。

主要产物：

- `docs/03-import-etl/sample-file-inventory.md`
- `docs/02-data-model/data-dictionary-template.md`
- `docs/03-import-etl/import-rules.md`
- 后续可生成 `knowledge_asset_inventory.xlsx`
- 后续可生成 `knowledge_objects.xlsx`
- 后续可生成 `field_dictionary.xlsx`
- 后续可生成 `mapping_rules.xlsx`

## Phase 2：工程骨架

状态：部分进行中

目标：

- 建立可维护的 GitHub 工程；
- 补齐基础目录和安全忽略规则。

已完成：

- Git 仓库初始化；
- GitHub 私有仓库创建；
- `README.md`；
- `.gitignore`。

后续任务：

- 创建基础代码目录；
- 创建配置目录；
- 创建迁移目录；
- 创建测试目录；
- 后续再初始化前端/桌面工程。

## Phase 3：数据模型设计

状态：已完成

目标：

- 将 Phase 1 的字段字典和映射规则转为 SQLite 数据模型。

主要任务：

- 设计通用表；
- 设计知识对象扩展表；
- 设计 staging 表；
- 设计来源文件、导入任务、变更记录；
- 设计全文检索索引；
- 输出 migration SQL。

主要产物：

- `docs/02-data-model/data-model.md`
- migration SQL

## Phase 4：导入 MVP

状态：进行中

目标：

- 跑通“文件进入系统 -> 结构化暂存 -> 审查 -> 入库”的最小闭环。

V1 范围：

- Excel 单文件导入；
- Markdown 导入；
- DOCX 基础文本、标题、表格导入；
- 来源文件、hash、sheet/章节/行号记录；
- 导入预览；
- 错误提示。

## Phase 5：知识浏览、搜索和详情

状态：进行中

目标：

- 让用户可以真正浏览和查找知识。

范围：

- 知识首页；
- 知识列表；
- 知识详情；
- 来源文件页；
- 标签筛选；
- 分类筛选；
- 关键词搜索；
- 待审核列表。

当前实际进展：

- 已完成关系化静态前端基线；
- 已接入能力维度、信息化环境维度和专项知识维护；
- 已建立 `dataClient` / ViewModel 边界；
- 已补充后端接口设计和字段契约；
- 下一步优先做已导入 Excel Sheet 的业务含义复核，而不是继续扩大页面范围。

## Phase 6：导出和备份

状态：待开始

目标：

- 避免系统形成新的数据孤岛。

范围：

- 当前查询结果导出；
- 单条知识导出；
- 标签/分类导出；
- 全量 JSON/CSV/SQLite 导出；
- 原始文件和配置打包；
- 备份 ZIP manifest。

## Phase 7：多格式增强

状态：待开始

说明：本阶段指正式项目中的 PPT / Draw.io / 多格式解析与预览增强。外部 ChatGPT 生成的 UI prototype、临时编码步骤或 review 建议不自动等同于本阶段，除非主控 Agent 判断它与项目主线有明确共通性并纳入计划。

目标：

- 扩展到主要工作资料形态。

范围：

- PPT 页级解析；
- Draw.io XML 节点和连线解析；
- 文件预览图；
- 节点、幻灯片、章节来源定位；
- 解析规则可配置。

## Phase 8：关系管理和更新审查

状态：待开始

目标：

- 从资料库升级为知识关系库。

范围：

- 手动建立知识关系；
- 批量导入关系；
- 关系查询；
- 导入 diff；
- 冲突检测；
- 变更审查中心；
- 版本回滚。

## Phase 9：打包交付

状态：待开始

目标：

- 让系统可以作为本地程序使用和迁移。

范围：

- 本地运行说明；
- 打包配置；
- 数据目录说明；
- 备份恢复说明；
- 用户指南。

## Phase 10：AI/RAG 增强，可选

状态：可选，后置

目标：

- 在结构化、关系化、来源追踪稳定后增加智能检索。

范围：

- 文档切片；
- 向量索引；
- 语义检索；
- 问答引用来源；
- 自动摘要；
- 自动标签；
- 自动关系推荐。
