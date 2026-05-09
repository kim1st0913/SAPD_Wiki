# SAPD Wiki

本项目用于规划和建设一个本地化结构化工作知识库系统。

目标是把 Excel、DOCX、PPT、Draw.io、Markdown 等多来源资料，逐步整理为可查询、可关联、可导出、可追溯来源的本地知识库。

当前阶段重点不是开发代码，而是先完成知识资产盘点、知识对象定义、字段字典、字段映射规则、ETL 与导入审查流程。

## 先读哪几个文件

如果你是第一次进入项目，建议按这个顺序阅读：

1. `docs/00-overview/project-vision.md`：项目为什么做、要做成什么。
2. `docs/00-overview/project-roadmap.md`：阶段路线。
3. `task_plan.md`：当前正在做什么。
4. `docs/00-overview/non-developer-workflow.md`：非开发者如何配合 Codex 推进。

## 文档入口

### 项目总览

- `docs/00-overview/project-vision.md`：项目愿景。
- `docs/00-overview/project-roadmap.md`：项目路线图。
- `docs/00-overview/non-developer-workflow.md`：非开发者工作流。

### 架构与技术

- `docs/01-architecture/architecture.md`：轻量架构说明。
- `docs/01-architecture/technology-decisions.md`：技术选型记录。

### 数据模型

- `docs/02-data-model/data-model.md`：数据模型设计。
- `docs/02-data-model/data-definition-guide.md`：数据定义与 ETL 设计指南。
- `docs/02-data-model/data-dictionary-template.md`：数据字典模板。

### 导入与 ETL

- `docs/03-import-etl/import-rules.md`：文件导入、字段映射与 ETL 规则。
- `docs/03-import-etl/sample-file-inventory.md`：知识资产与样例文件盘点表。

### 用户说明

- `docs/04-user-guide/user-guide.md`：用户指南。

### 归档

- `docs/05-archive/old-plans/`：旧计划和历史构想。
- `docs/05-archive/closed-issues/`：已闭环的问题记录。

## Codex 工作入口

- `AGENTS.md`：Codex / Agent 工作规则。
- `task_plan.md`：当前任务权威表。
- `findings.md`：关键发现和决策记录。
- `progress.md`：工作进度记录。

## 数据安全

真实原始资料、数据库文件、导出包和本地缓存默认不应提交到 GitHub。请优先提交文档、代码、配置模板和脱敏样例。
