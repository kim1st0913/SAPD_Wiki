# SAPD Wiki

本项目用于规划和建设一个本地化结构化工作知识库系统。

目标是把 Excel、DOCX、PPT、Draw.io、Markdown 等多来源资料，逐步整理为可查询、可关联、可导出、可追溯来源的本地知识库。

当前已经跑通 Excel 导入 MVP 的核心链路：本地 SQLite 初始化、来源文件登记、5 个核心 Sheet 解析、暂存预览、审批入正式表和基础查询。不做前端页面。

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
- `docs/02-data-model/field-dictionary-draft.md`：第一批 5 个核心 Excel Sheet 字段字典草案。
- `docs/02-data-model/sqlite-schema-design.md`：SQLite schema 设计草案。

### 导入与 ETL

- `docs/03-import-etl/import-rules.md`：文件导入、字段映射与 ETL 规则。
- `docs/03-import-etl/mapping-rules-draft.md`：第一批 5 个核心 Excel Sheet 映射规则草案。
- `docs/03-import-etl/remaining-21-sheets-modeling.md`：剩余 21 个 Excel Sheet 建模草案。
- `docs/03-import-etl/excel-import-mvp-design.md`：Excel 导入 MVP 设计。
- `docs/03-import-etl/sample-file-inventory.md`：知识资产与样例文件盘点表。

### 实施与数据库

- `db/migrations/`：SQLite migration SQL。
- `db/README.md`：数据库迁移顺序。
- `docs/06-implementation/local-data-layout.md`：本地数据目录约定。
- `docs/06-implementation/open-issues.md`：当前所有 bug、数据问题、页面问题和待确认事项的唯一维护文件。

### 治理

- `docs/07-governance/governance-index.md`：轻量治理入口。
- `docs/07-governance/data-governance.md`：数据标准化、去重、冲突、旧对象停用、验证等级和 metadata 字段升级规则。

### 用户说明

- `docs/04-user-guide/user-guide.md`：用户指南。
- `docs/04-user-guide/capability-browser-page-design.md`：第一版能力目录浏览页设计。

### 归档

- `docs/05-archive/old-plans/`：旧计划和历史构想。
- `docs/05-archive/closed-issues/`：已闭环的问题记录。

## Codex 工作入口

- `AGENTS.md`：Codex / Agent 工作规则。
- `task_plan.md`：当前任务权威表。
- `findings.md`：当前关键决策、重要风险和历史记录索引。
- `findings-history/`：历史发现归档。
- `progress.md`：执行日志、文件变更、命令和验证结果。
- `docs/06-implementation/open-issues.md`：bug 和问题清单；修复后也在这里改状态。

## 本地命令

初始化本地数据库：

```bash
python scripts/sapd_wiki.py init-db
```

登记并检查 Excel 样例：

```bash
python scripts/sapd_wiki.py inspect-excel "data/raw-samples/wiki sample.xlsx" --sensitive-level confidential
```

把 5 个核心 Sheet 解析到暂存区：

```bash
python scripts/sapd_wiki.py stage-excel "data/raw-samples/wiki sample.xlsx" --sheets all --sensitive-level confidential
```

审批某次暂存导入并写入正式表：

```bash
python scripts/sapd_wiki.py approve-import <import_job_id>
```

查看当前数据库摘要和基础查询：

```bash
python scripts/sapd_wiki.py summary
python scripts/sapd_wiki.py list-items --type capability_focus --limit 8
python scripts/sapd_wiki.py imports --limit 5
```

导出对象、关系和本次导入结果报告：

```bash
python scripts/sapd_wiki.py export-items --format all
python scripts/sapd_wiki.py export-relations --format all
python scripts/sapd_wiki.py export-report --sample-limit 20
```

导出文件默认生成在 `data/exports/`，该目录不提交 GitHub。

当前干净重建后的正式验收报告位于：

```text
data/exports/clean-d1c3fe17/import-result-report-d1c3fe17.md
```

启动第一版能力目录浏览页：

```bash
python scripts/sapd_wiki.py export-capability-tree
cd frontend/capability-browser
python -m http.server 5173
```

然后打开：

```text
http://127.0.0.1:5173
```

数据库默认生成在：

```text
data/database/sapd_wiki.sqlite3
```

## 数据安全

真实原始资料、数据库文件、导出包和本地缓存默认不应提交到 GitHub。请优先提交文档、代码、配置模板和脱敏样例。
