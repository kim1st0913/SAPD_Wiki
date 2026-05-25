# SAPD Wiki

本项目用于规划和建设一个本地化结构化工作知识库系统。

目标是把 Excel、DOCX、PPT、Draw.io、Markdown 等多来源资料，逐步整理为可查询、可关联、可导出、可追溯来源的本地知识库。

当前已经跑通 Excel 导入 MVP 的核心链路：本地 SQLite 初始化、来源文件登记、5 个核心 Sheet 解析、暂存预览、审批入正式表和基础查询。不做前端页面。

全工程执行前后端分离：后端负责导入、清洗、标准化、关系生成、校验、评分、导出和页面数据投影；前端只通过 `dataClient` / `/api/v1/*` 消费契约化数据并负责展示交互。`public/data/*.json` 仅作为后端生成的离线兼容数据包或 API fallback。

面向咨询顾问的 V1 交付目标是压缩包应用：顾问解压后第一次打开，点击一键初始化，系统自动部署预置 SQLite 数据库、页面数据包和预览资源，然后直接进入知识库工作台。顾问端不需要安装 Python / Node / SQLite CLI，不自行导入资料，不执行 ETL 或 migration；第一期也不做登录、注册、账号和权限体系。详细交付模型见 `docs/01-architecture/consultant-delivery-model.md`。

GitHub 工程不提交原始数据、生成数据、SQLite 数据库、导出包或预览资源。数据初始化细节见 `docs/03-import-etl/github-local-data-initialization.md`。

## 先读哪几个文件

如果你是第一次进入项目，建议按这个顺序阅读：

1. `docs/00-overview/project-vision.md`：项目为什么做、要做成什么。
2. `docs/00-overview/project-roadmap.md`：阶段路线。
3. `task_plan.md`：当前正在做什么。
4. `docs/00-overview/non-developer-workflow.md`：非开发者如何配合 Codex 推进。

## 文档入口

### 项目总览

- `docs/README.md`：文档总导航，按场景说明该先看哪些文件。
- `docs/00-overview/project-vision.md`：项目愿景。
- `docs/00-overview/project-roadmap.md`：项目路线图。
- `docs/00-overview/non-developer-workflow.md`：非开发者工作流。

### 架构与技术

- `docs/01-architecture/architecture.md`：轻量架构说明。
- `docs/01-architecture/technology-decisions.md`：技术选型记录。
- `docs/01-architecture/consultant-delivery-model.md`：顾问端压缩包交付、一键初始化和无登录边界。
- `docs/01-architecture/frontend-json-data-package-inventory.md`：前端 JSON 数据包用途、页面归属、legacy 状态和发布处理台账。
- `docs/01-architecture/frontend-backend-separation-closure.md`：本轮前后端分离收口说明。

### 数据模型

- `docs/02-data-model/data-model.md`：数据模型设计。
- `docs/02-data-model/data-definition-guide.md`：数据定义与 ETL 设计指南。
- `docs/02-data-model/data-dictionary-template.md`：数据字典模板。
- `docs/02-data-model/field-dictionary-draft.md`：第一批 5 个核心 Excel Sheet 字段字典草案。
- `docs/02-data-model/sqlite-schema-design.md`：SQLite schema 设计草案。

### 导入与 ETL

- `docs/03-import-etl/README.md`：导入与 ETL 文档索引。
- `docs/03-import-etl/import-rules.md`：文件导入、字段映射与 ETL 规则。
- `docs/03-import-etl/mapping-rules-draft.md`：第一批 5 个核心 Excel Sheet 映射规则草案。
- `docs/03-import-etl/remaining-21-sheets-modeling.md`：剩余 21 个 Excel Sheet 建模草案。
- `docs/03-import-etl/excel-import-mvp-design.md`：Excel 导入 MVP 设计。
- `docs/03-import-etl/sample-file-inventory.md`：知识资产与样例文件盘点表。
- `docs/03-import-etl/github-local-data-initialization.md`：GitHub 拉取后的本地文件放置、一键数据初始化和数据不同步边界。

### 实施与数据库

- `db/migrations/`：SQLite migration SQL。
- `db/README.md`：数据库迁移顺序。
- `docs/06-implementation/local-data-layout.md`：本地数据目录约定。
- `docs/06-implementation/open-issues.md`：当前所有 bug、数据问题、页面问题和待确认事项的唯一维护文件。

### 前端与展示

- `docs/04-frontend/frontend-redesign-brief.md`：关系化前端重构任务书，定义 ETL/Data Worker 与 Frontend Worker 的同步契约。

### 治理

- `docs/07-governance/governance-index.md`：轻量治理入口。
- `docs/07-governance/data-governance.md`：数据标准化、去重、冲突、旧对象停用、验证等级和 metadata 字段升级规则。

### 成熟度分析模块

- `docs/08-maturity/module-integration-review.md`：成熟度模块接入主工程的架构 review 和文件结构建议。
- `docs/08-maturity/requirements.md`：成熟度分析模块需求与边界。
- `docs/08-maturity/data-model.md`：`maturity_*` 专用数据模型设计。
- `docs/08-maturity/scoring-rules.md`：L0-L5 评分模型、匹配和聚合规则。
- `docs/08-maturity/template-design.md`：客户评估 Excel 模板设计。
- `docs/08-maturity/implementation-plan.md`：M0-M5 分阶段实施计划。
- `config/maturity/`：成熟度等级、评分规则、关键词、模板 schema 和报告结构配置。

### 用户说明

- `docs/04-user-guide/user-guide.md`：用户指南。
- `docs/README.md`：文档总导航，包含当前用户指南、工程入口和历史归档入口。

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
- `scripts/README.md`：脚本分类、长期工具和专题脚本说明。

## 本地命令

初始化本地数据库：

```bash
python scripts/sapd_wiki.py init-db
```

从 GitHub 拉代码后的推荐一键数据初始化：

```bash
python scripts/sapd_wiki.py bootstrap-local-data --print-inputs
python scripts/sapd_wiki.py bootstrap-local-data --reset
```

提交前检查是否误追踪原始数据或生成数据：

```bash
python scripts/check_github_data_boundary.py
```

同一检查已接入 GitHub Actions：每次 push / pull request 会自动运行 `.github/workflows/data-boundary.yml`，如果原始数据、SQLite、导出包或前端生成数据被误追踪，CI 会失败。

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

成熟度分析模块命令占位：

```bash
python scripts/sapd_wiki.py maturity-template --output data/maturity/templates/customer-maturity-template-v1.xlsx
python scripts/sapd_wiki.py maturity-import data/maturity/inputs/<customer-assessment>.xlsx
python scripts/sapd_wiki.py maturity-match <assessment_id>
python scripts/sapd_wiki.py maturity-export-review <assessment_id> --type match
python scripts/sapd_wiki.py maturity-score <assessment_id>
python scripts/sapd_wiki.py maturity-report <assessment_id> --format html
```

上述 maturity 命令尚未实现，目前只是后续独立模块的 CLI 规划占位。成熟度评估运行数据后续使用 `maturity_*` 专用表，不写入 `knowledge_items`。

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

启动带本地 API 的关系工作台：

```bash
python scripts/sapd_wiki.py serve --host 127.0.0.1 --port 5173
```

该模式会同时提供：

```text
http://127.0.0.1:5173/
http://127.0.0.1:5173/api/v1/health
http://127.0.0.1:5173/api/v1/data-packages/maintenance
http://127.0.0.1:5173/api/v1/data-packages/shared-lookups
http://127.0.0.1:5173/api/v1/capabilities/workspace-projection
http://127.0.0.1:5173/api/v1/maintenance
```

前端会优先读取 `/api/v1/data-packages/*`，如果本地 API 不存在，则自动回退到 `public/data/*.json` 静态文件。

数据库默认生成在：

```text
data/database/sapd_wiki.sqlite3
```

## 数据安全

真实原始资料、数据库文件、导出包和本地缓存默认不应提交到 GitHub。请优先提交文档、代码、配置模板和脱敏样例。
