# SAPD Wiki

本项目用于规划和建设一个本地化结构化工作知识库系统。

目标是把 Excel、DOCX、PPT、Draw.io、Markdown 等多来源资料，逐步整理为可查询、可关联、可导出、可追溯来源的本地知识库。

当前阶段重点不是开发代码，而是先完成：

- 知识资产盘点；
- 知识对象定义；
- 字段字典；
- 字段映射规则；
- ETL 与导入审查流程；
- 轻量架构和主控 Agent 分工。

## 关键文档

- `AGENTS.md`：Codex 在本项目中的工作规则。
- `task_plan.md`：项目阶段计划。
- `findings.md`：关键发现和决策记录。
- `progress.md`：工作进度记录。
- `docs/project-plan.md`：项目计划。
- `docs/architecture.md`：轻量架构说明。
- `docs/non-developer-codex-workflow.md`：非开发者使用 Codex 推进项目的工作流。
- `docs/data-definition-guide.md`：数据定义与 ETL 设计指南。
- `docs/data-dictionary-template.md`：数据字典模板。
- `docs/sample-file-inventory.md`：知识资产与样例文件盘点表。
- `docs/import-rules.md`：文件导入、字段映射与 ETL 规则。

## 数据安全

真实原始资料、数据库文件、导出包和本地缓存默认不应提交到 GitHub。请优先提交文档、代码、配置模板和脱敏样例。

