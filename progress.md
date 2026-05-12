# 进度记录：SAPD 工作知识库系统

## 2026-05-09

已使用 `planning-with-files` 启动规划工作流。

已完成：

- Read `work-knowledge-base-project-plan.md`.
- Identified the project as a structured knowledge asset management system with ETL and local knowledge portal capabilities.
- Created `AGENTS.md` with Codex operating rules for this repository.
- Created `docs/project-plan.md` as the formal project plan.
- Created `task_plan.md` for persistent phase tracking.
- Created `findings.md` for accumulated research and decisions.
- Created this `progress.md` log.

当前阶段：

- Phase 0 - 需求澄清与项目规划.

下一步建议：

- Prepare sample files.
- Create repository foundation: `README.md`, `.gitignore`, base directories.
- Draft `docs/data-model.md` and `docs/import-rules.md`.

验证：

- File creation completed by patch.
- Confirmed expected files exist in the project root and `docs/`.
- `git status --short` reported the directory was not currently a Git repository at that time; this was later superseded by the GitHub upload preparation work, which initialized Git and created commits.

## 2026-05-09 持续补充规划

用户说明：开发前仍有很多事情没有想清楚，尤其是不具备开发经验时，如何从多来源文件确定字段、设计 ETL 和映射规则。

已完成：

- Restored context by reading `task_plan.md`, `progress.md`, and `findings.md`.
- Checked available markdown files in the project directory. No additional user-provided md file was found beyond the existing project concept and planning files.
- Updated `findings.md` with a new data definition and ETL planning finding.
- Updated `task_plan.md` so data discovery and field definition happen before engineering scaffolding.
- Added `docs/data-definition-guide.md` for non-developer data modeling workflow.
- Added `docs/data-dictionary-template.md` for knowledge object and field definition.
- Added `docs/sample-file-inventory.md` for sample file collection and analysis.
- Added `docs/import-rules.md` for mapping, ETL, validation and conflict rules.
- Updated `docs/project-plan.md` and `AGENTS.md` to require data definition before coding.

下一步：

- Ask the user to place the new ChatGPT-generated md into the project directory if they still want exact integration.
- Use `docs/sample-file-inventory.md` with the first batch of sample files.
- Derive candidate fields and mapping rules from actual sample files.

## 2026-05-09 补充指南已整合

用户补充了面向非开发者的实施指南。

已完成：

- Read the supplemental implementation guide.
- Updated `findings.md` with its main planning consequences.
- Updated `task_plan.md` so Phase 1 explicitly produces knowledge asset inventory, knowledge object definitions, field dictionary and mapping rules.
- Added `docs/non-developer-codex-workflow.md` as a direct operating manual for a non-developer using Codex.
- Updated `docs/data-definition-guide.md` to emphasize knowledge asset inventory and pre-development spreadsheet-style outputs.
- Updated `docs/sample-file-inventory.md` with richer inventory fields from the supplemental guide.
- Updated `docs/data-dictionary-template.md` with Risk, Indicator, AssessmentResult, ImprovementTask, Process and ArchitectureElement fields.
- Updated `docs/import-rules.md` with a maturity assessment Excel example that splits one row into multiple knowledge objects and relationships.
- Updated `AGENTS.md` and `docs/project-plan.md` to reference the new non-developer workflow document.

验证：

- Confirmed the docs directory now contains six project planning documents.
- Reviewed key sections of the new workflow, data dictionary and import rules after edits.

下一步：

- Use the workflow document to start Phase 1 with real sample files.
- Generate actual `.xlsx` configuration templates later if the user wants spreadsheet deliverables.

## 2026-05-09 轻量架构已补充

用户要求我作为主控 Agent，先写轻量版架构文件，不写代码。

已完成：

- Restored project context by reading `AGENTS.md`, `task_plan.md`, `findings.md`, and `progress.md`.
- Created `docs/architecture.md`.
- Defined system layers, data flow, module boundaries and future multi-Agent division of labor.
- Clarified that multi-Agent parallel work should wait until Phase 1 data-definition outputs are stable.
- Updated `task_plan.md` to mark lightweight architecture creation complete.

下一步：

- Begin Phase 1 with knowledge asset inventory and sample files.
- Use the architecture file as the boundary document before splitting work across specialist Agents.

## 2026-05-09 GitHub 上传准备

用户要求将项目文件夹上传到 GitHub。

已完成：

- Added `.gitignore` to prevent future raw data, databases, exports, local caches and environment files from being committed accidentally.
- Added `README.md` with project overview and key document links.
- Initialized a local Git repository.
- Renamed the local branch to `main`.
- Set local repository commit identity to `kim1st <kim1st@users.noreply.github.com>`.
- Created initial commit `53ecc1f Initial knowledge base planning docs`.
- Installed GitHub CLI `gh` with Homebrew.
- Checked GitHub authentication status.

阻塞：

- `gh auth status` reports no GitHub account is logged in on this machine.

下一步：

- 用户需要运行 `gh auth login` 并完成 GitHub 认证。
- After authentication, create a private GitHub repository and push branch `main`.

## 2026-05-09 问题审查修复

用户审查了已生成文档，并新增 `docs/issues.md`。

已完成：

- Read `docs/issues.md`.
- Fixed phase plan inconsistency by making `task_plan.md` the only authoritative phase table.
- Updated `docs/project-plan.md` to align with `task_plan.md`.
- Added placeholders for `docs/data-model.md` and `docs/user-guide.md`.
- Added `docs/technology-decisions.md` as the central technology decision record.
- Converted `findings.md` to Chinese and removed local absolute source path.
- Updated `docs/import-rules.md` heading level for the maturity assessment example.
- Added template status note to `docs/sample-file-inventory.md`.
- Added historical-reference notice to `work-knowledge-base-project-plan.md`.
- Changed `work-knowledge-base-project-plan.md` permission from `600` to `644`.
- Updated `docs/issues.md` statuses to `已修复` with repair notes.

下一步：

- Commit the issue-review fixes.
- Complete GitHub authentication and push to a private GitHub repository.

## 2026-05-09 GitHub 上传完成

已完成：

- Re-authenticated GitHub CLI as `kim1st0913`.
- Created private GitHub repository `kim1st0913/SAPD_Wiki`.
- Added remote `origin`.
- Pushed local `main` branch to GitHub.

仓库：

- `https://github.com/kim1st0913/SAPD_Wiki`

## 2026-05-09 文档结构重组

用户要求最终审查文档精简方案，并批准执行。

已完成：

- Kept root working-memory files in place: `README.md`, `AGENTS.md`, `task_plan.md`, `findings.md`, `progress.md`.
- Reorganized `docs/` into topic-based sections:
  - `docs/00-overview/`
  - `docs/01-architecture/`
  - `docs/02-data-model/`
  - `docs/03-import-etl/`
  - `docs/04-user-guide/`
  - `docs/05-archive/old-plans/`
  - `docs/05-archive/closed-issues/`
- Created `docs/00-overview/project-vision.md`.
- Created `docs/00-overview/project-roadmap.md`.
- Moved active architecture, data-model, import/ETL, workflow and user-guide documents into their topic directories.
- Archived old planning files under `docs/05-archive/old-plans/`.
- Archived the closed review issue list under `docs/05-archive/closed-issues/`.
- Rewrote `README.md` as the primary human navigation entry.
- Updated active references in `AGENTS.md`, `task_plan.md`, `findings.md`, and current docs.

结果：

- Long-term vision now lives in `docs/00-overview/project-vision.md`.
- Stage roadmap now lives in `docs/00-overview/project-roadmap.md`.
- Current work remains in `task_plan.md`.
- Historical material is clearly archived.

## 2026-05-09 Phase 1 样例文件夹已准备

用户确定第一批样例包括：

- 1 PPT file for knowledge-base usage instructions, including basics and page introductions.
- 1 Excel file with 3 sheets.
- 1 multi-page Draw.io file.

已完成：

- Created local folder `data/raw-samples/`.
- Added `data/raw-samples/` to `.gitignore` so sample files are not synced to GitHub.
- Updated `docs/03-import-etl/sample-file-inventory.md` with initial planned sample rows.
- Updated `task_plan.md` Phase 1 tasks.

下一步：

- 用户需要将 PPT、Excel 和 Draw.io 文件放入 `data/raw-samples/`。
- 文件放入后，执行 Phase 1 知识资产盘点。

## 2026-05-09 Phase 1 知识资产盘点已启动

用户已将第一批样例放入 `data/raw-samples/`：

- `wiki sample ppt.pptx`
- `wiki sample.xlsx`
- `drawio sample.drawio`

已完成：

- Confirmed `data/raw-samples/` is ignored by Git and remains local-only.
- Inspected file sizes and file types locally.
- Parsed Excel workbook structure with the bundled Python runtime.
- Parsed PPTX slide text, media count and notes count directly from the PPTX package XML.
- Parsed Draw.io page structure, node counts and edge counts from the uncompressed Draw.io XML.
- Updated `docs/03-import-etl/sample-file-inventory.md` with first-batch asset inventory, Excel sheet inventory, PPT structure, Draw.io page inventory, and initial V1 data-model implications.
- Updated `findings.md` with the main Phase 1 findings.

关键发现：

- Excel 样例包含 26 个 Sheet。用户已说明，最初提到的 3 个 Sheet 已被后续放入完整工作簿这一情况替代。
- Excel is the V1 priority import source.
- PPT should be treated as usage-guide content with a dedicated future usage page.
- Draw.io should be treated as read-only view/diagram content, with no editing feature planned.

下一步：

- Draft the first field dictionary from the 5 recommended core Excel sheets.
- Draft the first mapping rules for capability, scope, service, module and relation objects.

## 2026-05-09 Phase 1 Field Dictionary Draft

用户确认主控 Agent 开始为已识别的 5 个核心 Excel Sheet 起草字段字典。

已完成：

- Created `docs/02-data-model/field-dictionary-draft.md`.
- Defined the current scope and non-scope items.
- Drafted the first knowledge object list for the 5 core sheets.
- Drafted common fields, object-specific fields, relation types, cleaning rules, sheet-to-object mapping and first page/export implications.
- Updated `README.md` and `docs/02-data-model/data-model.md` to reference the new draft.
- Updated `task_plan.md` so the field dictionary task is marked complete.

下一步：

- Draft mapping rules for the 5 core sheets in `docs/03-import-etl/import-rules.md`.
- Confirm the business meaning of the unnamed third column in `作用域-安全技术服务-安全技术模块映射`.

## 2026-05-09 Phase 1 Mapping Rules Draft

用户确认：

- `environment_segment` can be used for the unnamed third column in `作用域-安全技术服务-安全技术模块映射`.
- Capability category, L1 and L2 can have independent detail pages.
- Product can be represented as an object, with only product name in the first batch.
- Draw.io nodes should not be automatically linked to Excel modules in the first batch.
- PPT chapter splitting can be handled later.
- All 26 Excel sheets should eventually be modeled; the first 5 sheets are only the first implementation batch.

已完成：

- Created `docs/03-import-etl/mapping-rules-draft.md`.
- Defined first-batch ETL mapping rules for the 5 core Excel sheets.
- Added common cleaning rules, object deduplication keys, relation-generation rules, validation rules and import-preview requirements.
- Updated `docs/03-import-etl/import-rules.md` and `README.md` to reference the mapping draft.
- Updated `docs/02-data-model/field-dictionary-draft.md` to mark the user's answers as confirmed.
- Updated `task_plan.md` so first mapping-rule drafting is marked complete.

下一步：

- Update `docs/02-data-model/data-model.md` with the first logical model derived from the field dictionary and mapping rules.
- Plan the 26-sheet expansion batches before implementing the Excel import MVP.

## 2026-05-09 Phase 1 Logical Data Model

用户要求主控 Agent 在映射规则后继续下一步。

已完成：

- Rewrote `docs/02-data-model/data-model.md` from a placeholder into the first logical data model.
- Defined the main logical entities: `source_file`, `import_job`, `knowledge_item`, `knowledge_relation`, `source_reference`, `item_alias`, staging tables, review decisions and change logs.
- Defined V1 knowledge object types and first-batch relation types.
- Added the first-batch object relationship diagram.
- Mapped the 5 core Excel sheets to the logical model.
- Added page and export implications.
- Added a 26-sheet expansion plan across later batches.
- Updated `task_plan.md` to mark the first logical data model and 26-sheet expansion planning complete.

下一步：

- Decide whether to begin the Excel import MVP now, or continue detailed modeling for the second batch of Excel sheets.
- If implementation starts, derive SQLite schema and migration scripts from the logical model.

## 2026-05-09 Schema and Excel Import MVP Design

用户要求主控 Agent 继续下一步设计。

已完成：

- Created `docs/02-data-model/sqlite-schema-design.md`.
- Created `docs/03-import-etl/excel-import-mvp-design.md`.
- Linked both documents from `README.md`, `docs/02-data-model/data-model.md`, and `docs/03-import-etl/import-rules.md`.
- Updated `task_plan.md` to show schema design and Excel import MVP design as ready.
- Updated `findings.md` with the implementation-relevant design decisions.

下一步：

- Generate actual SQLite migration SQL.
- Create the engineering skeleton.
- Implement the Excel import MVP for the first 5 core Sheet parsers.

## 2026-05-09 SQLite Migrations Generated

已完成：

- Created `db/README.md`.
- Created SQLite migration scripts:
  - `db/migrations/001_init_core.sql`
  - `db/migrations/002_source_tracking.sql`
  - `db/migrations/003_staging_review.sql`
  - `db/migrations/004_search.sql`
  - `db/migrations/005_guides_diagrams.sql`
- Created `docs/06-implementation/local-data-layout.md`.
- Ran all migrations against a temporary SQLite database at `/private/tmp/sapd_wiki_migration_check.sqlite3`.
- Verified migrations executed successfully, including FTS5 table and triggers.
- Updated `README.md`, `docs/02-data-model/sqlite-schema-design.md`, `task_plan.md`, and `findings.md`.

下一步：

- Start implementation of the Excel import MVP.
- Recommended first implementation slice: migration runner, local database initialization, source file registration, workbook reader, and the first parser for `安全能力目录`.

## 2026-05-09 Excel Import MVP Stage 1 Implemented

用户要求开始实现 Excel 导入 MVP 第一阶段，暂不做前端页面。

已完成：

- Created Python project skeleton:
  - `pyproject.toml`
  - `src/sapd_wiki/`
  - `scripts/sapd_wiki.py`
- Implemented migration runner and local database initialization.
- Implemented source file registration with SHA-256 hash calculation.
- Implemented import job creation and status update.
- Implemented Excel workbook reader using `openpyxl`.
- Implemented core Sheet detection for the first 5 Sheet names.
- Added README commands for local database initialization and Excel inspection.
- Ran `init-db` successfully against `data/database/sapd_wiki.sqlite3`.
- Ran `inspect-excel` successfully against `data/raw-samples/wiki sample.xlsx`.

验证结果：

- 5 migrations are recorded in `schema_migrations`.
- 1 `source_files` record was created for `wiki sample.xlsx`.
- 1 `import_jobs` record was created with status `parsed`.
- The workbook has 26 sheets.
- All 5 core sheets were found.
- No business records were written to `knowledge_items`, `knowledge_relations`, `staging_items`, or `staging_relations` yet.

下一步：

- Implement the first parser for `安全能力目录`.
- Generate capability object candidates and `belongs_to` relation candidates.
- Write the first staging preview.

## 2026-05-09 Excel Import MVP Core Chain Implemented

用户确认执行后续三步：

1. Implement the parser for `安全能力目录`, generate object/relation candidates, and write staging only.
2. Implement the remaining 4 core Sheet parsers, generate candidates and validation report, and write staging only.
3. Implement staging summary, approve-to-formal-table loading, and basic query commands.

已完成：

- Added candidate models, transformers, 5 core Sheet parsers, staging writer, approve loader and query helpers under `src/sapd_wiki/`.
- Added CLI commands:
  - `stage-excel`
  - `approve-import`
  - `summary`
  - `list-items`
  - `imports`
- Ran `stage-excel` for `安全能力目录` only. 结果： 136 staged objects and 133 staged relations.
- Ran `stage-excel --sheets all` for the first 5 core Sheets. 结果： 707 staged objects and 2155 staged relations.
- Approved import job `30c1db64-a7e5-41ae-86b7-9e080a345118` into formal tables.
- Backfilled approval decisions for this already-approved local import because approval logging was added immediately after the first approval run.
- Updated README, task plan, findings and progress records.

验证结果：

- `knowledge_items`: 707
- `knowledge_relations`: 2155
- `source_references`: 10297
- `review_decisions`: 2862
- `change_logs`: 2862
- `python -m compileall src scripts` passed.

Validation notes:

- The 5-Sheet import produced 9 warning records in `安全能力-安全技术服务`.
- Warnings are related to inconsistent or missing service codes and do not block the first MVP import.

下一步：

- Review those 9 warning records before relying on the service-code dimension for precise filtering.
- Add export commands for JSON/CSV.
- Then start either a simple query/export page or continue with the next Excel Sheet batch.

## 2026-05-09 Import Review and Export Outputs

用户要求在核心导入链路后继续执行后三步操作。

已完成：

- Created `docs/03-import-etl/import-warning-review.md` for the 9 warning records.
- Implemented local export commands:
  - `export-items`
  - `export-relations`
  - `export-import-summary`
  - `export-report`
- Generated local export files under `data/exports/`:
  - `knowledge-items.csv`
  - `knowledge-items.json`
  - `knowledge-relations.csv`
  - `knowledge-relations.json`
  - `import-summary-30c1db64.json`
  - `import-result-report-30c1db64.md`
  - `warning-review-30c1db64.csv`

验证结果：

- Exported 707 knowledge items.
- Exported 2155 knowledge relations.
- Exported 9 warning review rows.
- `python -m compileall src scripts` passed.

下一步：

- 用户审查生成的报告和 warning 检查清单。
- Master Agent decides whether to adjust ETL rules or continue to the first local frontend page based on the review result.

## 2026-05-10 Warning Corrections Applied

用户提供了 9 条 warning 记录的具体修正。

已完成：

- Updated `data/raw-samples/wiki sample.xlsx` in Sheet `安全能力-安全技术服务`.
- Corrected 3 inconsistent service codes:
  - `I-HD&T-AS.CM-02`
  - `I-US&T-AS.IA-04`
  - `I-DI&T-AS.DG-03`
- Corrected 6 missing service codes using the two-digit `-00` convention:
  - `M-PM.PR-00`
  - `M-SA.RM-00`
  - `M-SA.RE-00`
  - `M-SA.CO-00`
  - `M-SE.PE-00`
  - `M-PS.CT-00`
- Restored ETL code parsing to require two-digit trailing codes.
- Re-ran staging import job `5ff32b2b-e20f-4f74-b6a3-08fb11c784d6`.

验证结果：

- `validations: none`
- `python -m compileall src scripts` passed.

下一步：

- Rebuild the local SQLite database cleanly from the corrected Excel before generating the next official import report.

## 2026-05-10 Clean Import Rebuild and Page Design

用户要求执行下三步。

已完成：

- Backed up the previous local database to `data/database/backups/sapd_wiki-before-clean-rebuild-20260510-000904.sqlite3`.
- Reinitialized `data/database/sapd_wiki.sqlite3` from migrations.
- Re-ran `stage-excel` against corrected `wiki sample.xlsx`.
- Approved clean import job `491f6322-e5d0-4ddd-a576-d4655ceb84cc`.
- Generated fresh clean exports under `data/exports/clean-491f6322/`.
- Created `docs/04-user-guide/capability-browser-page-design.md`.

验证结果：

- `validations: none`
- `knowledge_items`: 710
- `knowledge_relations`: 2155
- `source_references`: 10298
- `review_decisions`: 2865
- `change_logs`: 2865

下一步：

- Review the clean import report, then implement the first local capability browser page.

## 2026-05-10 Capability Browser MVP Started

用户确认前端实现后，要求执行下一步工作。

已完成：

- Added `export-capability-tree` CLI command.
- Generated frontend-ready data at `frontend/capability-browser/public/data/capability-tree.json`.
- Added a lightweight local frontend under `frontend/capability-browser/`.
- Added `.gitignore` rule so generated frontend JSON data is not committed.
- Started a local static server on `http://127.0.0.1:5173`.
- Opened the page in Chrome and verified:
  - metrics load correctly;
  - ability tree renders;
  - search works for `网络安全项目管理`;
  - selecting the matching focus shows detail and linked service `M-PM.PR-00`;
  - the service panel shows scope information.

数据说明：

- At this point the frontend data included 3 categories, 10 L1 domains, 32 L2 capabilities, 92 focuses and 159 services.
- The unlinked `T-AD.SV-01` finding was later confirmed as an ETL de-duplication issue and fixed under `OI-001`.

下一步：

- 用户在浏览器中审查页面。
- Then normalize `ALL` scope service display and add service-level source drilldown.

## 2026-05-10 ALL Scope Display and Service Source Drilldown

已完成：

- Updated ETL service-code parsing to handle `ALL&T-*` service codes.
- Standardized known source variants `ALL&TI.*` and `ALL&T-TI.*` to `ALL&T-IN.*`.
- Updated service scope display so `ALL` is shown as `全部作用域`.
- Added expandable service-level source references in the frontend service cards.
- Rebuilt the local SQLite database cleanly after the ETL change.
- Approved clean import job `d1c3fe17-7059-466b-a8d9-c5b6a8a8f527`.
- Generated fresh exports under `data/exports/clean-d1c3fe17/`.
- Regenerated `frontend/capability-browser/public/data/capability-tree.json`.

验证结果：

- `validations: none`
- `knowledge_items`: 710
- `knowledge_relations`: 2155
- `source_references`: 10310
- `code = ALL` service count: 0
- `ALL&T-*` service count: 13
- At this point frontend data still included 3 categories, 10 L1 domains, 32 L2 capabilities, 92 focuses, 159 services and 1 unlinked focus. This was later fixed under `OI-001`.

数据质量说明：

- `ALL&T-AD.IR-02` appeared with two service titles: `安全事件管理` and `安全响应处置`. This was later confirmed as source-data coding confusion and fixed under `OI-002`.

下一步：

- 用户审查更新后的页面。
- Then move to the next Sheet batch after the current page is accepted.

## 2026-05-10 Frontend Tree Layout Bug Fixed

用户通过截图反馈页面 bug：左侧树节点编码与标题重叠。

已完成：

- Fixed tree node layout in `frontend/capability-browser/styles.css`.
- Added explicit `has-code` / `no-code` classes in `frontend/capability-browser/app.js`.
- Created `docs/06-implementation/open-issues.md` as the central current-issue tracker.
- Recorded:
  - OI-001: unlinked focus `T-AD.SV-01`, later fixed.
  - OI-002: source-data coding confusion for `ALL&T-AD.IR-02` / `ALL&T-AD.IR-03`, later fixed.
  - OI-003: tree code/title overlap, now fixed.

验证结果：

- Refreshed `http://127.0.0.1:5173` in Chrome.
- Confirmed tree node code/title overlap is fixed.
- Confirmed service card shows `ALL&T-AD.IR-03` and `ALL 全部作用域`.
- Confirmed service source drilldown is visible.

## 2026-05-10 Centralized Issue Tracking Rule Added

用户要求后续所有 bug 和问题统一维护在一个文件中，并在修复后标记状态。

已完成：

- Updated `AGENTS.md` with the issue-maintenance rule.
- Updated `README.md` to identify `docs/06-implementation/open-issues.md` as the single issue tracker.
- Expanded `docs/06-implementation/open-issues.md` with status values, issue template and verification fields.

后续规则：

- All bugs, data issues, page issues and business-confirmation items must be recorded in `docs/06-implementation/open-issues.md`.
- Fixed issues remain in the file with status `已修复`.

## 2026-05-11 用户修正 Excel 后重新导入

用户手工修正了 `IR-02` / `IR-03` 编码混淆对应的源 Excel。

已完成：

- 已验证源 Excel 当前包含 `ALL&T-AD.IR-02 安全事件管理` 和 `ALL&T-AD.IR-03 安全响应处置`。
- 已备份旧数据库到 `data/database/backups/sapd_wiki-before-user-excel-fix-20260511-081642.sqlite3`。
- 已从 migration 重新初始化 SQLite 数据库。
- 已暂存并审批导入任务 `5af8f699-3a8d-4cd2-8039-fd541dfcc3d7`。
- 已重新生成最新导出文件和 `frontend/capability-browser/public/data/capability-tree.json`。
- 已更新 `docs/06-implementation/open-issues.md`，`OI-001` 和 `OI-002` 均验证为 `已修复`。

验证结果：

- `validations: none`
- `knowledge_items`: 704
- `knowledge_relations`: 2155
- `security_technical_service`: 198
- `ALL&T-AD.IR-02`：仅对应 `安全事件管理`
- `ALL&T-AD.IR-03`：仅对应 `安全响应处置`
- `T-AD.SV-01`：只生成 1 条关注点记录，并挂接到父级编码 `T-AD.SV`
- 能力树统计：3 个分类、10 个领域、32 个能力、91 个关注点、159 个服务、0 个未挂接关注点。

## 2026-05-11 能力树顺序与层级展示

用户检查页面后提出 3 个问题：

- `开发安全管控能力 T-AS.DS` 看起来像原始数据问题。
- 左侧能力关注点目录需要支持层级展开/收起，并且从 L1 开始严格按照 Excel 表格顺序排列，因为顺序体现滑动标尺模型和 EA 定义。
- 不同层级需要更清晰地区分。

已完成：

- 已在 `docs/06-implementation/open-issues.md` 中新增 `OI-004`、`OI-005`、`OI-006`。
- 解析 `安全能力目录` 时已写入 `tree_order` 元数据。
- 能力树导出逻辑已改为优先按 Excel `tree_order` 排序，再用编码/标题兜底。
- 前端树已支持展开/收起行为。
- 已增加 `分类`、`L1`、`L2`、`关注点` 层级标签。
- 已通过缩进、边框颜色、字重、字号和背景增强层级区分。
- 已备份旧数据库到 `data/database/backups/sapd_wiki-before-tree-order-fix-20260511-095024.sqlite3`。
- 已重新初始化 SQLite 数据库，并审批导入任务 `e3a30211-a138-4bd7-80af-66e5ddff4bb5`。
- 已重新生成最新导出文件和 `frontend/capability-browser/public/data/capability-tree.json`。

验证结果：

- `validations: none`
- `knowledge_items`: 704
- `knowledge_relations`: 2155
- 能力树统计：3 个分类、10 个领域、32 个能力、91 个关注点、159 个服务、0 个未挂接关注点。
- 生成的 JSON 中，T 分类下顺序已按 Excel 行顺序展示：`T-AS -> T-PD -> T-AD -> T-IN -> T-OF`。
- 前端 JavaScript 语法检查通过。
- `T-AS.DS` 在当前项目样例 Excel 和重建数据库中仍存在，因此当时 `OI-004` 保持为 `待确认`。
- 浏览器自动刷新被本地浏览器安全策略阻止，需要用户手动刷新 `http://127.0.0.1:5173/` 确认页面效果。

## 2026-05-11 能力树展开/收起交互修复

用户确认 `开发安全管控能力 T-AS.DS` 是修正后的正确原始数据结果，并反馈能力树展开/收起交互不符合预期。

已完成：

- 已更新 `docs/06-implementation/open-issues.md`：
  - `OI-004` 根据用户确认标记为 `已修复`；
  - 新增 `OI-007` 记录展开/收起交互问题，并标记为 `已修复`。
- 已将左侧树节点交互拆成两个明确区域：
  - 左侧 `+/-` 控件负责展开或收起子节点；
  - 右侧节点内容负责选中对象并更新详情面板。
- 已更新树样式，让展开控件更明显，并显示展开状态。

验证结果：

- 前端 JavaScript 语法检查通过。
- 用户需要手动刷新 `http://127.0.0.1:5173/`，测试 `+/-` 控件后，再进入剩余 21 个 Sheet 建模。

## 2026-05-11 能力树分层展开/收起

用户进一步明确期望：`安全能力目录`、`L1 高阶战略能力`、`L2安全能力` 都要分别支持展开/收起。

已完成：

- 已增加虚拟根节点 `安全能力目录`。
- 已将左侧树层级调整为：
  - `安全能力目录`
  - 能力分类
  - `L1 高阶战略能力`
  - `L2安全能力`
  - 关注点
- 默认展开状态调整为只展开根节点和能力分类，L1 与 L2 由用户显式展开。
- 已更新 `OI-007`，使其明确记录分层展开/收起需求。

验证结果：

- 前端 JavaScript 语法检查通过。
- 由于本会话中本地浏览器策略阻止自动刷新 `http://127.0.0.1:5173/`，浏览器效果仍需用户手动刷新确认。

## 2026-05-11 剩余 21 个 Excel Sheet 建模启动

用户决定开始剩余 21 个 Excel Sheet 的建模，并预期建模后会有较多需求调整。

已完成：

- 已按 `planning-with-files` 工作流重新阅读 `task_plan.md`、`progress.md` 和 `findings.md`。
- 已扫描完整 `wiki sample.xlsx` 工作簿：
  - Sheet 总数：26；
  - 第一批 ETL Sheet：5；
  - 剩余待建模 Sheet：21。
- 已创建 `docs/03-import-etl/remaining-21-sheets-modeling.md`。
- 已将剩余 Sheet 分为：
  - 目录/版本维护；
  - 环境/作用域补充；
  - 安全工作/流程/职能；
  - 生命周期；
  - 标准/框架/控制项。
- 已草拟剩余 Sheet 的新增对象类型和关系类型。
- 当时曾建议第二批优先处理 4 个 Sheet，后续已按用户澄清修订为 5 个 Sheet：
  - `安全能力-安全工作`
  - `安全能力-安全管理元素（high level）`
  - `安全职能流程清单（完善L4）`
  - `安全工作职能清单`
  - `gartner工作岗位参考`
- 已更新 `README.md`、`docs/03-import-etl/import-rules.md`、`docs/02-data-model/data-model.md`、`task_plan.md` 和 `findings.md`，加入新建模文档引用。

下一步：

- 用户审阅 `docs/03-import-etl/remaining-21-sheets-modeling.md`；该建议后续已按用户澄清修订为第二批 5 个 Sheet。
- 用户确认后，再将代码工作拆给 ETL、前端、导出等 Agent 并行推进。

## 2026-05-11 进度记录语言约定

用户要求 `progress.md` 使用中文记录。

已完成：

- 已将最近新增的英文进度记录改为中文。
- 后续 `progress.md` 默认使用中文记录；代码标识、文件名、命令和对象 type 保留英文原文。

## 2026-05-11 第二批 Sheet 范围修订

用户明确第二批建模需求，并要求补充 `gartner工作岗位参考`。

已完成：

- 已将第二批范围从 4 个 Sheet 调整为 5 个 Sheet：
  - `安全能力-安全工作`
  - `安全能力-安全管理元素（high level）`
  - `安全职能流程清单（完善L4）`
  - `安全工作职能清单`
  - `gartner工作岗位参考`
- 已更新 `docs/03-import-etl/remaining-21-sheets-modeling.md`：
  - 明确 `安全能力-安全工作` 是关注点到安全工作的映射；
  - 明确 `安全能力-安全管理元素（high level）` 包含 L2流程组、L3流程参考和四类组织职能相关方；
  - 明确 `安全职能流程清单（完善L4）` 是流程主数据，L4关键活动可后续补充；
  - 明确 `安全工作职能清单` 需要独立页面模块，不挂在原能力主页面下；
  - 明确 `gartner工作岗位参考` 第二批先作为参考库展示，不自动映射内部职能。
- 已更新 `task_plan.md` 和 `findings.md`，保证主控计划、发现记录和建模文档口径一致。
- 已更新 `docs/02-data-model/field-dictionary-draft.md`，补充第二批对象字段草案。
- 已更新 `docs/03-import-etl/mapping-rules-draft.md`，补充第二批 5 个 Sheet 的映射规则草案。
- 已更新 `docs/02-data-model/data-model.md`，加入第二批对象类型和关系类型。

本地检查：

- `安全工作职能清单` 检测到 1 张嵌入 PNG 图片，后续需要作为页面展示资产提取。
- `安全工作职能清单` 的 GB/T 42446-2023 区域存在合并表头和空列，后续 ETL 需要按用户说明和单元格位置共同判断。

下一步：

- 确认第二批并行编码拆分：ETL、前端模块、导出扩展。
- 用户确认建模方向后，进入第二批代码实现。

## 2026-05-11 第二批并行编码启动

用户要求主控 Agent 按建议拆分启动第二批并行编码。

已完成：

- 已新增 `docs/03-import-etl/second-batch-data-contract.md`，作为 ETL、前端、导出验证三个 Agent 的共同数据契约。
- 数据契约明确：
  - 第二批 5 个 Sheet 范围；
  - 新增知识对象类型；
  - 新增关系类型；
  - `capability-tree.json` 扩展字段；
  - `management-knowledge.json` 结构；
  - ETL、前端、导出验证验收标准；
  - 三个并行 Agent 的写入边界。
- 已启动 3 个并行 Worker：
  - ETL Worker：负责第二批 parser、候选对象/关系、图片提取；
  - Frontend Worker：负责能力详情扩展和“安全工作职能”独立模块；
  - Export/Verify Worker：负责前端 JSON 导出和第二批验证报告。
- 已更新 `task_plan.md`，将第二批数据契约和并行拆分标记为完成，并新增集成与验证任务。

下一步：

- 等待三个 Worker 返回结果。
- 主控 Agent 负责合并 CLI 入口、运行第二批本地导入/导出验证、更新 `docs/06-implementation/open-issues.md` 和本进度记录。

## 2026-05-11 第二批 ETL Worker 实现

本次作为第二批 ETL Worker，只修改解析/转换相关文件，未修改 CLI、前端和导出文件。

已完成：

- 新增 `src/sapd_wiki/assets.py`，用于从 Excel 指定 Sheet 提取嵌入图片到本地 ignored 目录。
- 更新 `src/sapd_wiki/transformers.py`，新增 `split_multivalue_text()`，用于处理换行、顿号、分号分隔的多值字段。
- 更新 `src/sapd_wiki/parsers.py`，新增第二批 5 个 Sheet parser：
  - `parse_security_work_sheet()`
  - `parse_management_high_level_sheet()`
  - `parse_process_sheet()`
  - `parse_work_function_sheet()`
  - `parse_gartner_role_reference_sheet()`
- 新增聚合入口 `parse_second_batch_sheets(path, sheets=None)`，供主控 Agent 后续合并 CLI 或验证脚本调用。
- 第二批 parser 已保留 `SourceRef`，并生成契约中的主要对象和关系候选。
- `L4关键活动` 为空时不生成 `process_activity`。
- `安全工作职能清单` 中嵌入图片已提取到 `data/previews/second-batch-assets/安全工作职能清单-2-13-1.png`。

本地验证：

- 已运行 `python3 -m compileall src/sapd_wiki`，语法检查通过。
- 已直接调用 `parse_second_batch_sheets('data/raw-samples/wiki sample.xlsx')`：
  - 原始候选对象：2609
  - 原始候选关系：3283
  - validation：0
  - 去重后对象：540
  - 去重后关系：2040
  - 去重后 `asset`：1
  - 关系端点缺失：0

待主控合并：

- CLI 暂未接入第二批 parser。
- 第二批对象/关系尚未写入 staging 和正式库。
- `management-knowledge.json` 和 `capability-tree.json` 的第二批导出由 Export/Verify Worker 或主控 Agent 合并。

## 2026-05-11 第二批并行编码集成与本地验收

主控 Agent 已完成 ETL、前端、导出验证三个 Worker 的结果合并。

已完成：

- 已将第二批 parser 接入 CLI，`stage-excel --sheets second-batch` 可直接解析第二批 5 个 Sheet。
- 已新增导出命令：
  - `export-management-knowledge`
  - `export-second-batch-summary`
- 已扩展 `capability-tree.json`，在关注点详情中加入 `security_works` 和 `process_mappings`。
- 已新增 `management-knowledge.json`，用于 `安全工作职能` 独立页面模块。
- 已将 Excel 嵌入图片复制到前端本地数据资产目录，供页面展示。
- 已完成第二批导入任务 `c03db78f-6755-4ccb-9e06-4c09704f1913` 的审批入库。
- 已在 Chrome 中验证本地页面：
  - `能力目录` 标签页仍可加载；
  - `安全工作职能` 标签页可打开；
  - 可展示 4 个职能层级、107 条工作职能、GB/T 42446-2023 引用、Gartner 岗位参考和 1 张图片资产。

第二批导入结果：

| 指标 | 数量 |
|---|---:|
| 原始候选对象 | 2609 |
| 暂存去重对象 | 540 |
| 原始候选关系 | 3283 |
| 暂存去重关系 | 2040 |
| 正式新增对象 | 418 |
| 正式更新对象 | 122 |
| 正式新增关系 | 2040 |
| validation | 0 |

第二批正式对象重点数量：

| 类型 | 数量 |
|---|---:|
| `security_work` | 80 |
| `process_domain` | 10 |
| `process_group` | 32 |
| `process_reference` | 88 |
| `work_function_layer` | 4 |
| `work_function_group` | 11 |
| `work_function` | 107 |
| `work_task` | 30 |
| `gbt_42446_task_reference` | 27 |
| `work_role_reference` | 28 |
| `asset` | 1 |

当前数据库汇总：

| 表 | 数量 |
|---|---:|
| `import_jobs` | 2 |
| `knowledge_items` | 1122 |
| `knowledge_relations` | 4195 |
| `source_references` | 14973 |

问题记录：

- 已新增 `docs/06-implementation/open-issues.md` 的 `OI-008`，记录 `安全工作职能` 页面出现 `未分组` 和占位标题 `...`，状态为 `待确认`。
- 已新增 `OI-009`，记录 `L4关键活动` 暂未生成，状态为 `业务接受`，原因是源数据当前待补充。

下一步：

- 用户在 `http://127.0.0.1:5173/?v=2` 审查第二批页面效果。
- 重点确认 `OI-008`：`未分组` 和 `...` 应由源 Excel 清理，还是由 ETL 过滤。
- 用户确认后，再决定是先打磨第二批模块，还是进入下一批 Sheet 建模/编码。

## 2026-05-11 第二批页面审查反馈与源数据修正验证

用户反馈：

- `人力资源负责职能` 应为 `人力负责职能`，用户已修正源 Excel。
- `数据安全负责职能` 应为 `数据负责职能`，用户已修正源 Excel。
- `企业安全人员管理职能` 应为 `企业人员安全管理职能`，用户已修正源 Excel。
- `L4关键活动` 待补充，确认不作为当前 bug。
- `网络安全执行层` 中 `未分组` 较多，需要单独输出问题处理。
- `安全职能流程清单（完善L4）` 应作为流程主数据独立维护，不应只通过能力映射展示。
- 页面结构建议调整为 `知识来源` 二级页面；`安全工作职能`、`安全流程`、`标准与规范参考`、`岗位参考` 应拆开维护。

已完成：

- 已更新 `docs/06-implementation/open-issues.md`：
  - `OI-008`：安全工作职能名称源数据错误，已修复并验证；
  - `OI-009`：L4关键活动待补充，保持 `业务接受`；
  - `OI-010`：网络安全执行层未分组较多，新增为独立待处理问题；
  - `OI-011`：安全职能流程清单需要独立维护页；
  - `OI-012`：知识来源页面结构需要拆分为二级页面；
  - `OI-013`：源数据修正后旧对象不会自动停用，新增为更新机制问题。
- 已重新执行第二批导入任务 `a4b77945-380e-457d-b87f-7ba05b5dcf01`。
- 已修正导入更新逻辑：
  - 对象更新时同步最新 `source_file_id` 和 `source_hash`；
  - 关系更新时同步最新来源文件、导入任务和元数据；
  - 前端导出来源引用时只展示当前版本来源，避免旧 raw_value 混入页面。
- 已将旧错误对象 `数据安全负责职能`、`企业安全人员管理职能`、`…` 标记为 `deprecated`。
- 已重新导出 `capability-tree.json` 和 `management-knowledge.json`。

验证结果：

- `management-knowledge.json` 中已检索不到：
  - `人力资源负责职能`
  - `数据安全负责职能`
  - `企业安全人员管理职能`
  - 标题 `...` 或 `…`
- 正确名称已存在：
  - `人力负责职能`
  - `数据负责职能`
  - `企业人员安全管理职能`
- `management-knowledge.json` 当前展示 `work_functions: 104`。
- `未分组` 仍有 2 个分组，已转入 `OI-010`。

下一步：

- 先处理 `OI-010`，确认未分组记录的来源行和分组规则。
- 再按 `OI-011`、`OI-012` 设计并实现 `知识来源` 二级页面结构。

## 2026-05-11 修复 OI-011/OI-012：知识来源二级页面

用户要求先修正 `OI-011` 和 `OI-012`。

已完成：

- 已扩展 `export-management-knowledge` 导出结构，新增 `security_processes`：
  - `process_domains`: 10
  - `process_groups`: 32
  - `process_references`: 88
- 已调整前端顶层模块：
  - `能力目录`
  - `知识来源`
- 已将 `知识来源` 拆成二级页面：
  - `安全工作职能`
  - `安全流程`
  - `标准与规范参考`
  - `岗位参考`
- 已将 GB/T 42446-2023 引用从原混合页面拆到 `标准与规范参考` 页面。
- 已将 Gartner 岗位参考拆到 `岗位参考` 页面。
- 已将安全职能流程清单作为 `安全流程` 独立清单页面展示，不再只依赖能力详情中的映射关系。
- 已保留 `安全工作职能清单` 图片，在 `安全工作职能` 页面展示。
- 已修正导出关系时混入 deprecated 对象的问题，能力和流程导出只使用 active 对象关系。
- 已更新 `docs/06-implementation/open-issues.md`，将 `OI-011` 和 `OI-012` 标记为 `已修复`。

验证结果：

- `python3 -m compileall src/sapd_wiki scripts` 通过。
- `node --check frontend/capability-browser/app.js` 通过。
- 已重新导出 `frontend/capability-browser/public/data/management-knowledge.json`。
- 浏览器已打开 `http://127.0.0.1:5174/?v=4` 验证：
  - `知识来源 > 安全工作职能` 可打开，计数 104；
  - `知识来源 > 安全流程` 可打开，计数 88；
  - `知识来源 > 标准与规范参考` 可打开，计数 27；
  - `知识来源 > 岗位参考` 可打开，计数 28。

下一步：

- 继续处理 `OI-010`：网络安全执行层未分组职能。
- 确认 `安全流程` 第一版是否只展示 L3，还是提前预留 L4关键活动区域。

## 2026-05-11 修复工作职能分组问题并补充前端参考

用户反馈：

- 未分组的 `人力负责职能` 在源数据修正后仍存在。
- `75 合规管理职能` 页面位置不对，应合并到 `网络安全监督层 > 网络安全监督管理`。
- 当前前端布局和功能模块设计不合理，需要参考类似系统的最佳实践。

已完成：

- 新增并关闭 `OI-014`：
  - 无编码 `人力负责职能` 已标记为 `deprecated`；
  - 导出逻辑已增加保护：同一层级存在同名有编码职能时，排除无编码重复对象。
- 新增并关闭 `OI-015`：
  - 删除 `75 合规管理职能` 指向 `网络安全管理层` 的错误层级关系；
  - 导出逻辑改为优先使用职能组所属层级。
- 已重新导出 `management-knowledge.json`，`work_functions` 从 104 变为 103。
- 已新增 `docs/04-user-guide/frontend-design-references.md`，记录 3 个前端设计参考方向：
  - OpenMetadata / Data Catalog
  - DataHub / Metadata Platform
  - Backstage Software Catalog

验证结果：

- `python3 -m compileall src/sapd_wiki scripts` 通过。
- `node --check frontend/capability-browser/app.js` 通过。
- `人力负责职能` 只保留在 `网络安全决策层 > 企业安全负责相关领导`，编码为 `6`。
- `75 合规管理职能` 位于 `网络安全监督层 > 网络安全监督管理`。
- `12 合规管理职能` 仍保留在 `网络安全管理层 > 企业安全管理相关领导`。
- `网络安全执行层` 仍剩 17 条无编码 `未分组` 职能，继续归入 `OI-010`。

下一步：

- 基于前端参考，设计下一版页面：以清单表格、筛选、详情页和关系查询为核心，而不是继续堆卡片。
- 继续处理 `OI-010` 中网络安全执行层的 17 条未分组职能。

## 2026-05-11 输出 OI-010 核对清单与参考展示页

用户要求：

- 输出 `OI-010` 的 17 条未分组职能，供用户核对源数据。
- 将 3 个前端设计参考各做一个展示页面。

已完成：

- 曾新增临时 `OI-010` 核对清单，列出 17 条网络安全执行层未分组职能、来源行和初步判断。
- 后续已按用户要求合并回统一问题清单 `docs/06-implementation/open-issues.md`，不再单独维护该文件。
- 已新增 3 个前端参考展示页：
  - `frontend/design-references/openmetadata.html`
  - `frontend/design-references/datahub.html`
  - `frontend/design-references/backstage.html`
- 已新增共用样式文件 `frontend/design-references/reference-style.css`。

验证结果：

- 已启动本地静态服务 `http://127.0.0.1:5176/`。
- 3 个页面均返回 HTTP 200：
  - `http://127.0.0.1:5176/openmetadata.html`
  - `http://127.0.0.1:5176/datahub.html`
  - `http://127.0.0.1:5176/backstage.html`

下一步：

- 用户核对 17 条未分组职能后，主控 Agent 根据确认结果修正 ETL 合并、分组或源数据映射规则。
- 用户选择一个前端方向后，再开始主应用页面重构。

## 2026-05-11 识别 OI-010 与安全工作职能清单的匹配关系

用户要求先识别这些问题数据，判断是否可以和 `安全工作职能清单` 匹配。

已完成：

- 已读取正式 `work_function` 主数据，筛选出有编码的 86 条正式职能。
- 已将 `OI-010` 的 17 条无编码未分组职能与正式职能进行名称相似度、包含关系和语义规则匹配。
- 曾更新临时 `OI-010` 核对清单，新增“与安全工作职能清单的匹配识别”表。
- 后续已按用户要求合并回统一问题清单 `docs/06-implementation/open-issues.md`，不再单独维护该文件。

初步识别：

- 高可信可映射：`IT资产运营职能`、`信息化系统运维职能`、`凭证及访问管理运营职能`、`基础设施运维职能`、`安全协调职能`、`数字证书与密钥运营职能` 等。
- 疑似半截文本：`安全实施职能（方案设计`、`技术实施）`、`身份`。
- 疑似错字：`安全时间响应处置职能` 应匹配 `安全事件响应处置职能`。
- 需用户确认语义：`安全实施职能-信创适配`、`安全实施职能-运营管理`、`安全预案运营职能`。

下一步：

- 等待用户确认匹配表。
- 用户确认后，主控 Agent 将把这些规则固化到 ETL：映射到正式职能，不再生成无编码未分组职能。

## 2026-05-11 修复 OI-010 执行层未分组职能

用户确认：

- 原 `OI-010` 中大部分问题为原始数据错误，用户已修正源 Excel。
- `5` 和 `17` 实际是同一个正式职能：`身份、凭证及访问管理运营职能`。
- 旧 ETL 把顿号 `、` 当成多值分隔符，导致该职能被拆成 `身份` 和 `凭证及访问管理运营职能`。

已完成：

- 修改 `src/sapd_wiki/transformers.py`：
  - `split_multivalue_text()` 新增 `split_on_ideographic_comma` 参数；
  - `…` 和 `...` 现在按占位空值处理。
- 修改 `src/sapd_wiki/parsers.py`：
  - 组织职能相关方字段只按换行和分号拆分，不再按顿号拆分；
  - 将当前源表中残留的两个 `安全实施职能` 变体归并到正式职能 `69 安全实施职能（规划咨询、方案设计、技术实施、项目管理）`。
- 重新导入第二批数据：
  - 最新导入任务：`d76d933c-ad79-413c-8598-afae5bc3f244`；
  - `objects_staged: 520`；
  - `relations_staged: 1998`；
  - `validations: []`。
- 停用历史导入残留的 18 条无编码 `work_function` 对象。
- 重新导出：
  - `frontend/capability-browser/public/data/management-knowledge.json`
  - `data/exports/second-batch-summary-latest/second-batch-summary.json`
- 更新问题记录：
  - `docs/06-implementation/open-issues.md`

验证结果：

- `python3 -m compileall src/sapd_wiki scripts` 通过。
- 当前解析结果中无编码 `work_function` 数量为 0。
- 页面数据中 `网络安全执行层` 不再存在 `未分组` 分组。
- 数据库中 active 无编码 `work_function` 数量为 0。
- `身份` 和 `凭证及访问管理运营职能` 已为 `deprecated`。
- 正式职能 `39 身份、凭证及访问管理运营职能` 为 `active`，位于 `网络安全执行层 > 基础架构安全工作执行团队`。

下一步：

- 按用户选择的第一个前端参考方案，改造主应用页面布局：从卡片堆叠改为“目录列表 + 详情面板 + 关系信息”的工作台式页面。

## 2026-05-11 按第一个参考方案改造知识来源页面

用户要求：

- 页面按照第一个前端参考方案进行修改。

已完成：

- 修改 `frontend/capability-browser/index.html`：
  - `知识来源` 页面由原来的单内容区改为三栏工作台；
  - 左侧为知识类型导航；
  - 中间为可搜索目录清单；
  - 右侧为实体详情。
- 修改 `frontend/capability-browser/app.js`：
  - 新增知识来源实体清单生成逻辑；
  - 支持安全工作职能、安全流程、标准与规范参考、岗位参考四类实体统一浏览；
  - 支持中间清单搜索和右侧详情联动；
  - 详情中展示层级/来源域、分组、来源引用、关联信息和来源追踪。
- 修改 `frontend/capability-browser/styles.css`：
  - 页面布局调整为“导航 + 清单 + 详情”的目录型工作台；
  - 减少大卡片堆叠，提高扫描和查询效率。

验证结果：

- `node --check frontend/capability-browser/app.js` 通过。
- `python3 -m compileall src/sapd_wiki scripts` 通过。
- 已启动本地服务 `http://127.0.0.1:5177/`。
- 浏览器验证：
  - 页面可加载；
  - `知识来源` 可打开；
  - `安全工作职能` 默认清单可展示；
  - 搜索 `身份、凭证` 可命中 `身份、凭证及访问管理运营职能`；
  - `安全流程` 页面可切换并展示详情；
  - 浏览器 console 无 error。

下一步：

- 用户刷新并确认页面方向。
- 若方向认可，后续再把能力目录页也逐步改成同一套“清单 + 详情 + 关系”的工作台模式。

## 2026-05-11 确认 OI-010 修复规则

用户确认：

- `OI-010 核对清单：网络安全执行层未分组职能` 中的可修复规则草案可作为正式规则。

已完成：

- 曾更新临时 `OI-010` 核对清单：
  - 将“可选修复规则草案”改为“已确认修复规则”；
  - 删除“待用户确认”段落；
  - 新增“规则落地状态”，说明哪些规则已经进入 ETL 和数据清理流程。
- 后续已按用户要求合并回统一问题清单 `docs/06-implementation/open-issues.md`，不再单独维护该文件。

后续执行规则：

- `安全工作职能清单` 中有编码的正式职能作为主数据。
- `安全能力-安全管理元素（high level）` 中的组织职能相关方只作为映射文本。
- 可匹配正式职能时，只建立 `stakeholder_by` 关系，不再创建新的无编码 `work_function`。
- 明显半截文本和占位文本不生成对象。
- 新出现的错字、简称或业务别名，需要先记录确认，再加入别名规则。

## 2026-05-11 合并 OI-010 到统一问题清单

用户要求：

- `OI-010` 不要再单独维护核对清单文件，所有问题统一维护在 `docs/06-implementation/open-issues.md`。

已完成：

- 已将 `OI-010` 的来源结论、修复前 17 条核对表、已确认修复规则和规则落地状态合并进 `docs/06-implementation/open-issues.md` 的 `OI-010` 条目。
- 已删除临时 `OI-010` 核对清单文件。
- 后续所有 bug、数据问题、页面问题和待确认事项仍以 `docs/06-implementation/open-issues.md` 为唯一权威入口。

## 2026-05-11 轻量治理 P0 落地

用户确认：

- 当前阶段采用轻治理、渐进治理，不一次性建立完整治理六件套。

已完成：

- 新增 `docs/07-governance/governance-index.md`。
- 新增 `docs/07-governance/data-governance.md`。
- 新增 `findings-history/2026-05.md`，归档原 `findings.md` 的完整历史内容。
- 将根目录 `findings.md` 改为索引页，只保留当前关键决策、重要风险、最近发现和历史链接。
- 更新 `AGENTS.md`，明确：
  - `findings.md` 不再承载长篇过程记录；
  - `progress.md` 只记录执行日志、文件变更、命令、验证结果和输出；
  - 数据治理规则以 `docs/07-governance/data-governance.md` 为准。
- 更新 `README.md`，新增治理文档入口。
- 更新 `task_plan.md`，新增并完成 `Governance P0 Tasks`。

验证结果：

- 已确认新增治理文档存在。
- 已确认原 `findings.md` 内容已归档到 `findings-history/2026-05.md`。
- 本次为文档治理调整，未修改运行代码。

## 2026-05-11 修复 OI-013 旧对象生命周期机制

用户要求：

- 执行源数据修正后的旧对象停用修复。
- 同时考虑后续数据导入、错误数据出现后的报错机制、修复方法和处理方式。

已完成：

- 修改 `src/sapd_wiki/loader.py`：
  - `approve-import` 审批时收集本次 staging 的对象 `object_key`、对象类型和来源 Sheet；
  - 对同一来源文件路径、同一来源 Sheet、同类对象中，本次未出现且非人工保护的旧 active 对象，自动标记为 `deprecated`；
  - 自动停用写入 `change_logs`，记录 `import_job_id`、来源文件路径、来源 Sheet 和停用原因；
  - 当导入摘要中存在 `error` 或 `blocking` 校验信息时，跳过旧对象自动停用，避免解析不完整导致误停用；
  - 已停用的 ETL 对象如果重新出现在来源 Sheet 中，审批入库时恢复为 `active`；
  - 关系端点匹配默认只使用 active 对象，避免新关系挂到 deprecated 对象。
- 修改 `src/sapd_wiki/cli.py`：
  - `approve-import` 输出新增 `items_deprecated`。
- 修改 `docs/07-governance/data-governance.md`：
  - 将旧对象停用规则从待确认改为已确认并实现；
  - 新增错误数据处理流程，明确暂存、校验、分类、修复、复导、审批和验证。
- 修改 `docs/06-implementation/open-issues.md`：
  - 将 `OI-013` 状态改为 `已修复`；
  - 记录修复说明和验证结果。
- 更新 `findings.md` 和 `task_plan.md`：
  - 将旧对象生命周期从当前风险调整为已落地 MVP 机制；
  - 下一步重新聚焦剩余 Excel Sheet 建模和批次导入验收。

验证结果：

- `PYTHONPATH=src /Users/kim1st/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3 -m compileall src` 通过。
- 使用临时数据库 `/private/tmp/sapd_oi013_b.sqlite3` 验证：
  - 首次导入 `安全工作职能清单`：`items_created: 160`，`items_deprecated: 0`；
  - 手工模拟同来源旧错误对象 `旧错误职能`；
  - 复导同一 Sheet 后：`items_updated: 160`，`items_deprecated: 1`；
  - 查询模拟旧对象状态为 `deprecated`。
  - 将一个正式来源对象临时设为 `deprecated` 后再次复导，审批后该对象恢复为 `active`。

后续注意：

- 若某个来源 Sheet 后续不是全量同步，而是增量补丁，必须先在 `open-issues.md` 建立问题并定义导入策略，不能直接套用自动停用规则。

## 2026-05-11 第三批生命周期 Sheet 建模启动

用户要求：

- 继续执行下一步工作。

主控检查：

- 已复查 `docs/06-implementation/open-issues.md`，当前没有 `处理中`、`未修复` 或 P0 阻断问题。
- 第三批按既定批次处理 4 个生命周期 Sheet：
  - `LC-DT 数据生命周期`
  - `LC-DT 数据生命周期场景目录`
  - `LC-AP 应用安全开发生命周期`
  - `LC-AP 应用安全开发生命周期元素目录`

已完成：

- 使用 `inspect-excel` 确认当前工作簿仍为 26 个 Sheet。
- 抽样读取第三批 4 个 Sheet 的表头、行数和关键内容：
  - `LC-DT 数据生命周期`：8 个数据生命周期过程，包含安全技术服务设计和安全技术模块设计；
  - `LC-DT 数据生命周期场景目录`：36 个数据生命周期场景；
  - `LC-AP 应用安全开发生命周期`：应用安全开发阶段、阶段目标、主要活动、安全活动、安全策略、开发技术服务、产品示例；
  - `LC-AP 应用安全开发生命周期元素目录`：软件开发类型、应用系统类型和应用组件字典。
- 新增 `docs/03-import-etl/third-batch-data-contract.md`：
  - 定义第三批范围、对象契约、关系契约、解析规则、前端边界、验收标准和 Agent 分工。
- 更新 `docs/02-data-model/data-model.md`：
  - 新增 `lifecycle_process`、`lifecycle_scene`、`security_activity`、`security_policy_requirement`、`software_development_type`、`application_system_type`、`application_component`；
  - 新增第三批关系类型。
- 更新 `docs/02-data-model/field-dictionary-draft.md`：
  - 补充第三批 Sheet 范围、对象字段和关系字段。
- 更新 `docs/03-import-etl/mapping-rules-draft.md`：
  - 补充 LC-DT、LC-AP 4 个 Sheet 的映射规则草案。
- 更新 `task_plan.md`：
  - 当前阶段切换为第三批生命周期 Sheet 建模；
  - 下一步聚焦第三批 ETL parser、staging 和 warning review。

下一步：

- 实现第三批 ETL parser。
- 先只做 staging 和验证，不直接改前端页面。

## 2026-05-11 第三批生命周期 ETL 实现与审批入库

已完成：

- 修改 `src/sapd_wiki/parsers.py`：
  - 新增 `THIRD_BATCH_SHEETS`；
  - 新增 `parse_data_lifecycle_sheet`；
  - 新增 `parse_data_lifecycle_scene_sheet`；
  - 新增 `parse_application_security_lifecycle_sheet`；
  - 新增 `parse_application_lifecycle_element_sheet`；
  - 新增 `parse_third_batch_sheets`；
  - 支持多行拆分、编号策略拆分、空白向下继承和第三批对象/关系候选生成。
- 修改 `src/sapd_wiki/cli.py`：
  - `stage-excel --sheets third-batch` 已接入第三批 4 个 Sheet。

第三批 staging：

- 导入任务：`d8bb7ac6-4eb8-4a50-883f-98c3b0fbf5fa`
- `objects_total: 342`
- `objects_staged: 224`
- `relations_total: 283`
- `relations_staged: 283`
- `validations: none`

第三批 staging 对象统计：

| type | 数量 |
|---|---:|
| lifecycle_process | 16 |
| lifecycle_scene | 36 |
| security_activity | 6 |
| security_policy_requirement | 76 |
| software_development_type | 4 |
| application_system_type | 3 |
| application_component | 13 |
| security_technical_service | 40 |
| security_technology_module | 16 |
| product | 14 |

第三批审批结果：

- `items_created: 186`
- `items_updated: 38`
- `items_deprecated: 0`
- `relations_created: 281`
- `warnings: none`

导出结果：

- `data/exports/import-review-latest/import-result-report-d8bb7ac6.md`
- `data/exports/import-review-latest/warning-review-d8bb7ac6.csv`，0 条 warning
- `data/exports/import-review-latest/import-summary-d8bb7ac6.json`
- `data/exports/items-latest/knowledge-items.json`
- `data/exports/items-latest/knowledge-items.csv`
- `data/exports/relations-latest/knowledge-relations.json`
- `data/exports/relations-latest/knowledge-relations.csv`

当前正式库统计：

- `knowledge_items: 1309`
- `knowledge_relations: 4654`
- 第三批核心对象：
  - `lifecycle_process: 16`
  - `lifecycle_scene: 36`
  - `security_activity: 6`
  - `security_policy_requirement: 76`
  - `software_development_type: 4`
  - `application_system_type: 3`
  - `application_component: 13`

验证结果：

- `PYTHONPATH=src /Users/kim1st/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3 -m compileall src` 通过。
- `git diff --check` 通过。

下一步：

- 扩展导出 JSON，为前端生命周期页面准备 `lifecycle-knowledge.json`。
- 然后启动或分配 Frontend Worker 实现 `生命周期` 页面。

## 2026-05-11 补充安全作用域和安全技术模块独立页面

用户指出：

- `安全能力作用域目录`、`安全技术模块清单` 当前如何在系统中展示需要明确；
- 这两个原始表应该作为 `知识来源` 下的独立维护页面。

当前判断：

- 修复前，`安全能力作用域目录` 主要作为能力详情的作用域和服务关联展示；
- `安全技术模块清单` 主要作为能力详情中的技术模块、安全系统、产品等关联展示；
- 二者都没有作为 `知识来源` 的独立二级页面维护。

已完成：

- 修改 `src/sapd_wiki/exports.py`：
  - `management-knowledge.json` 新增 `scope_types`；
  - `management-knowledge.json` 新增 `security_technology_modules`；
  - 安全作用域携带关联安全技术服务、信息化对象和来源追踪；
  - 安全技术模块携带关联安全系统、技术服务、产品、信息化环境和来源追踪。
- 修改 `frontend/capability-browser/index.html`：
  - `知识来源` 导航新增 `安全作用域`；
  - `知识来源` 导航新增 `安全技术模块`。
- 修改 `frontend/capability-browser/app.js`：
  - 新增两个页面的计数、清单、搜索和详情展示；
  - 复用现有三栏工作台布局。
- 修改 `docs/06-implementation/open-issues.md`：
  - 新增并关闭 `OI-016`；
  - 新增 `OI-017`，记录 `安全技术模块清单!D384:D393` 出现疑似数字标题模块 `98`，等待用户确认源数据。

验证结果：

- `PYTHONPATH=src /Users/kim1st/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3 -m compileall src` 通过。
- `/Users/kim1st/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --check frontend/capability-browser/app.js` 通过。
- 已重新导出 `frontend/capability-browser/public/data/management-knowledge.json`：
  - `scope_types: 10`
  - `security_technology_modules: 166`
- `git diff --check` 通过。

待用户确认：

- `OI-017`：请检查原始 Excel `安全技术模块清单` 第 384 至 393 行 D 列，确认 `98` 是否为真实模块名称。

## 2026-05-11 启动数据处理与关系化前端双轨并行

用户确认“开始双轨并行”，并希望之前的数据处理和前端同步推进。

已完成：

- 读取当前 `task_plan.md`、`progress.md`、`findings.md` 和统一问题清单。
- 确认旧下一步“生命周期页面”暂时后置，当前优先级改为关系化前端与数据导出同步。
- 新增 `docs/04-frontend/frontend-redesign-brief.md`，作为主控 Agent、ETL/Data Worker 和 Frontend Worker 的共同任务书。
- 更新 `README.md`，增加前端关系化重构任务书入口。
- 更新 `task_plan.md`，将当前阶段调整为 `Phase 5 - 数据处理与关系化前端双轨并行`。
- 在 `docs/06-implementation/open-issues.md` 中新增：
  - `OI-018`：前端整体过度卡片化，无法有效排查知识关系；
  - `OI-019`：安全能力作用域目录需要按原始表格样式展示；
  - `OI-020`：信息化环境-信息化对象-安全作用域映射缺少一级页面和连续映射展示；
  - `OI-021`：能力详情中流程与组织职能相关方重复显示。

下一步：

- 启动 ETL/Data Worker，负责连续映射导出和流程/职能去重。
- 启动 Frontend Worker，负责关系化前端工作台重构。
- 主控 Agent 集成两个 worker 的输出并统一验证。

主控复盘：

- 用户指出应优先复用之前已经存在的 3 个 Agent，尤其是此前承担 ETL 的 Agent。
- 检查 `progress.md` 后确认：之前第二批并行 Worker 只记录了逻辑角色，没有记录可恢复的 `agent_id`，因此本次无法可靠恢复旧 Agent。
- 本次已启动的新 Worker 需要记录 ID，后续同一线程或同类任务优先复用，不再无依据地新开。

当前 Worker 登记：

| 角色 | agent_id | 当前任务 | 状态 |
|---|---|---|---|
| ETL/Data Worker | `019e1618-b647-7e22-b2d3-640aab3cfb8f` | 信息化对象连续映射导出、流程/职能去重 | 运行中 |
| Frontend Worker | `019e1618-b692-7e83-bc4c-7829ef81c985` | 关系化前端工作台重构 | 运行中 |

后续规则：

- 如果已有同职责 Worker 的 `agent_id` 可用，主控 Agent 应优先 `resume_agent` 或继续给该 Worker 派发任务。
- 只有当旧 Worker 不可恢复、上下文明显过期、职责边界变化很大，或需要并行处理不同写入范围时，才新开 Worker。

## 2026-05-11 双轨并行集成与前端收口

ETL/Data Worker 返回结果：

- Worker `019e1618-b647-7e22-b2d3-640aab3cfb8f` 完成数据线任务。
- 修改范围遵守边界，仅涉及 `src/sapd_wiki/parsers.py`、`src/sapd_wiki/exports.py`、`src/sapd_wiki/loader.py`。
- 已完成：
  - `信息化环境-信息化对象-安全作用域映射` 解析；
  - `信息化环境 -> 信息化对象 -> 安全作用域 -> 安全技术服务 -> 安全技术模块/措施 -> 安全系统/产品` 连续映射导出；
  - `capability-tree.json` 中流程映射去重；
  - `management-knowledge.json` 中 `environment_scope_tree` 导出。

Frontend Worker 处理情况：

- 原 Frontend Worker `019e1618-b692-7e83-bc4c-7829ef81c985` 修改了前端文件，但未在等待窗口内回报；主控已关闭该 Worker。
- 后续 Frontend Repair/Verify Worker `019e1629-0cf4-7e01-a61d-9b53b3556401` 仍未及时回报；主控已关闭该 Worker。
- 主控 Agent 接管前端收口，保留已有改动并完成：
  - 表格式来源行点击详情修复；
  - 安全作用域、技术模块表格式展示样式；
  - 信息化对象连续映射页面样式；
  - 流程 L4 占位和组织职能相关方样式。

集成输出：

- 重新导出 `frontend/capability-browser/public/data/capability-tree.json`。
- 重新导出 `frontend/capability-browser/public/data/management-knowledge.json`。
- 更新 `docs/06-implementation/open-issues.md`：
  - `OI-018` 改为 `待确认`；
  - `OI-019` 改为 `待确认`；
  - `OI-020` 改为 `待确认`；
  - `OI-021` 改为 `待确认`。
- 更新 `task_plan.md`，双轨并行任务技术集成完成。

验证结果：

- `/Users/kim1st/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --check frontend/capability-browser/app.js` 通过。
- `PYTHONPATH=src /Users/kim1st/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3 -m compileall src` 通过。
- `git diff --check` 通过。
- `python scripts/sapd_wiki.py export-capability-tree` 因本机无 `python` 命令失败；已用运行时 `python3` 重跑成功。
- 重新导出的 `management-knowledge.json` 统计：
  - `information_environments: 10`
  - `information_objects: 96`
  - `environment_scope_mappings: 136`
  - `environment_service_mappings: 571`
  - `environment_module_mappings: 2215`
- 重新导出的 `capability-tree.json` 统计：
  - `categories: 3`
  - `domains: 10`
  - `capabilities: 32`
  - `focuses: 91`
  - `services: 159`
  - `unlinked_focuses: 0`
- Node 脚本检查：
  - 信息化对象缺失 ID 数量：0；
  - 信息化对象空作用域映射数量：0；
  - 同一关注点内重复流程 key 数量：0；
  - `process_mappings: 92`。
- 本地静态服务 `http://127.0.0.1:5180/` 已启动并返回 HTTP 200。

待用户确认：

- 浏览器中检查 `信息化对象` 一级页面是否符合连续映射排查需求。
- 检查 `知识来源 > 安全作用域` 是否符合原始表格核对习惯。
- 检查能力详情里的流程与组织职能相关方是否已经不重复、且 L4 占位显示合理。

## 2026-05-11 修正前端重构目标

用户修正前端目标：

- 前端不应以“一个知识对象来自哪个原始 Sheet、哪一行、哪个字段”为主要关注点；
- 应按现有表格构建关系；
- 需要以能力维度、信息化环境维度、安全开发维度、数据生命周期维度等建立多个关系展现页面；
- 作用域、流程清单、职能清单、安全技术模块清单等应作为专项知识维护页面；
- 后续页面还要支持 HTML 知识说明、Draw.io 图和 PPT 使用说明；
- 不要卡片式，要突出关系模式 UI；
- 应由单独的 Frontend Design Owner 子 Agent 接管全部前端设计。

已完成：

- 重新阅读 `前端优化建议.md`；
- 重写 `docs/04-frontend/frontend-redesign-brief.md`：
  - 将来源追踪从前端主目标降为底层治理能力；
  - 明确能力维度、信息化环境维度、安全开发维度、数据生命周期维度；
  - 明确专项知识维护页面；
  - 明确 HTML、Draw.io、PPT 后续内容型页面入口；
  - 明确 Frontend Design Owner 是前端设计和实现唯一负责人。
- 更新 `docs/06-implementation/open-issues.md`：
  - 将 `OI-018` 重新置为 `处理中`，按修正后的关系化目标继续处理；
  - 新增 `OI-022`，记录需要 Frontend Design Owner 接管前端设计。
- 更新 `task_plan.md`，增加 Frontend Design Owner 的信息架构输出任务。

下一步：

- 启动 Frontend Design Owner，先输出统一前端信息架构和页面设计方案，不直接改代码。
- 主控 Agent 审核方案后，再决定下一轮前端实现批次。

当前 Frontend Design Owner 登记：

| 角色 | agent_id | 当前任务 | 状态 |
|---|---|---|---|
| Frontend Design Owner | `019e163e-4728-7f73-8746-00183d43ece5` | 输出统一前端信息架构方案，只修改 `docs/04-frontend/frontend-information-architecture.md` | 运行中 |

## 2026-05-11 Frontend Design Owner 信息架构输出审阅

Frontend Design Owner `019e163e-4728-7f73-8746-00183d43ece5` 已完成第一版信息架构方案。

新增文件：

- `docs/04-frontend/frontend-information-architecture.md`

主控审阅结论：

- 方案符合用户修正后的方向：
  - 前端从“来源追踪优先”改为“业务关系优先”；
  - 顶层结构改为关系总览、能力维度、信息化环境维度、安全开发维度、数据生命周期维度、专项知识维护、说明与视图；
  - `知识来源` 下一轮建议正式重构为 `专项知识维护`；
  - UI 模式明确禁止卡片墙，优先树表、矩阵、关系链、泳道、分组清单、局部关系图、类 Excel 表格；
  - HTML 知识说明、Draw.io 只读图、PPT 使用说明统一进入 `说明与视图`。
- 方案遵守边界，只新增前端信息架构文档，未修改前端代码、ETL 代码、主控计划或 issue 文件。

已完成主控同步：

- 更新 `docs/06-implementation/open-issues.md`：
  - `OI-022` 标记为 `已修复`；
  - 新增 `OI-023`，收敛 FE-IA-001 至 FE-IA-010 的数据契约待确认问题。
- 更新 `task_plan.md`：
  - 标记 Frontend Design Owner 信息架构输出完成；
  - 下一步改为先确认 FE-IA 数据契约，再启动下一轮前端实现。

下一步建议：

- 先由用户确认 `OI-023` 中 10 个 FE-IA 口径，尤其是顶层导航命名、`知识来源` 是否改为 `专项知识维护`、生命周期数据是否统一导出为 `lifecycle-knowledge.json`。
- 确认后再让 Frontend Design Owner 进入代码实现阶段。

## 2026-05-11 FE-IA 口径确认

用户确认：

- 同意 `OI-023` 中 1-10 条建议。

已固化口径：

- 顶层导航正式采用 7 个一级页面：关系总览、能力维度、信息化环境维度、安全开发维度、数据生命周期维度、专项知识维护、说明与视图。
- `知识来源` 正式改名为 `专项知识维护`。
- 能力关注点到作用域由 ETL 显式导出，不让前端从服务关系反推。
- 服务到模块、系统、产品输出统一索引。
- L4 关键活动空值由 ETL 输出显式 `missing` 状态，前端显示 `待补充`。
- `environment_segment` 先作为辅助字段展示，不作为默认主层级。
- LC-AP / LC-DT 统一导出为 `lifecycle-knowledge.json`。
- HTML、Draw.io、PPT 统一导出为 `content-views.json`。
- Draw.io 首版使用 SVG/PNG 静态预览，保留原 `.drawio` 文件路径，不做在线编辑。
- PPT 使用说明首版按页展示，后续再增加章节分组。

已完成：

- 更新 `docs/06-implementation/open-issues.md`，将 `OI-023` 标记为 `已修复`。
- 更新 `docs/04-frontend/frontend-information-architecture.md`，将“仍需确认”改为“已确认前端与 ETL 口径”。
- 更新 `task_plan.md`，将 FE-IA 数据契约确认任务标记完成，并新增下一轮 ETL/前端实现任务。

下一步：

- 复用 ETL/Data Worker 补齐显式关系和新 JSON 导出。
- 复用 Frontend Design Owner 实现 7 个一级页面骨架和 `专项知识维护` 命名调整。

## 2026-05-11 子 Agent 稳定性问题修正

用户指出：

- 能看到子 Agent 仍在工作；
- 主控 Agent 不应因为等待超时就急于打断；
- Epicurus 此前已经完成设计任务，后续是否继续使用需要更清晰的任务边界；
- 多次出现主控误判“无响应”的情况，需要明确修正 Agent 稳定性。

主控复盘：

- `wait_agent` 超时只表示当前等待窗口没有拿到最终结果，不等于子 Agent 无响应。
- 主控此前把等待超时、状态请求未立即返回、以及前端文件处于重构中间态，过快解释成“失控”。
- 这是主控调度错误，不应归因于子 Agent。
- 对前端重构这类较长任务，应采用更长等待、明确 checkpoint 和状态请求，而不是频繁打断。

已完成修正：

- 更新 `docs/07-governance/governance-index.md`，新增 Worker 稳定性与打断规则。
- 更新 `docs/06-implementation/open-issues.md`，新增并关闭 `OI-024：主控 Agent 过早判断子 Agent 无响应`。

后续执行规则：

- 不再仅凭 `wait_agent` 超时判断 Worker 无响应。
- Worker 显示运行中时，默认视为仍在工作。
- 主控可以发状态请求，但不能因为短时间未回就关闭 Worker。
- 关闭 Worker 前必须记录原因、等待时长、状态请求和文件风险。
- 前端重构中出现临时文件删除/迁移状态，应先视为中间态，除非已经明确违反边界或持续造成运行阻断。
- 已完成设计任务的 Frontend Design Owner 如果继续进入代码实现，必须由主控明确这是新任务，并给出新的边界和验收标准。

当前处理：

- 暂停继续派发、打断或关闭任何子 Agent。
- 暂停继续处理前端文件，先完成稳定性规则修正。

## 2026-05-11 恢复前端可运行基线并集成新数据导出

用户要求执行下一步。

当前真实状态确认：

- ETL/Data Worker 已完成本轮数据导出补齐；
- Frontend Design Owner 的代码实现没有形成完整可运行结果；
- `frontend/capability-browser/app.js` 一度处于删除状态，页面不可运行；
- 前端实现线需要先恢复可运行基线，而不是继续扩大重构。

已完成：

- 将 ETL/Data Worker 输出复制到前端 public 数据目录：
  - `frontend/capability-browser/public/data/capability-tree.json`
  - `frontend/capability-browser/public/data/management-knowledge.json`
  - `frontend/capability-browser/public/data/lifecycle-knowledge.json`
  - `frontend/capability-browser/public/data/content-views.json`
- 重建 `frontend/capability-browser/app.js`，恢复前端入口脚本。
- 保留现有 7 个一级页面骨架：
  - 关系总览
  - 能力维度
  - 信息化环境维度
  - 安全开发维度
  - 数据生命周期维度
  - 专项知识维护
  - 说明与视图
- 将 `知识来源` 页面语义调整为 `专项知识维护`。
- 补充 `frontend/capability-browser/styles.css` 中关系总览、生命周期、内容视图和矩阵/泳道相关的基础样式。

验证结果：

- `/Users/kim1st/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --check frontend/capability-browser/app.js` 通过。
- `PYTHONPATH=src /Users/kim1st/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3 -m compileall src` 通过。
- `git diff --check` 通过。
- 本地服务 `http://127.0.0.1:5180/` 返回 HTTP 200。
- 前端 public 数据统计：
  - `capability-tree.json`: `focus_scope_mappings: 157`、`services: 159`
  - `management-knowledge.json`: `service_module_index: 208`、`process_activity_missing: 88`
  - `lifecycle-knowledge.json`: `application_processes: 8`、`data_processes: 8`、`lifecycle_scenes: 36`
  - `content-views.json`: `html_documents: 0`、`diagram_views: 1`、`guide_pages: 1`

当前结论：

- 前端已从“入口脚本缺失”恢复为可运行基线。
- 当前是 7 个一级页面骨架版，不是最终 UI。
- 下一步应让用户先检查页面能否打开和导航是否符合预期，再选一个页面深入实现，建议优先 `能力维度` 或 `信息化环境维度`。

## 2026-05-11 前端核对效率修复：调宽、筛选、作用域清单

用户提出三项前端问题：

- 每一块区域要支持人工调整宽度；
- 表格每一列要支持宽度调整，表头要支持筛选、过滤；
- `作用域清单` 中 `未分类` 改为 `网络空间`，增加 `描述` 列，实体关系详情不需要展示关系信息；
- 所有页面的实体关系详情默认宽度调整为当前约 1/2。

已完成：

- 在全部一级工作区增加列宽拖拽分隔条。
- 调整右侧详情栏默认宽度，给中间关系表格和链路展示释放空间。
- 在 `专项知识维护` 表格增加表头筛选输入框。
- 在 `专项知识维护` 表格增加列宽拖拽。
- `作用域清单` 表格调整为 `分组 / 编码/类型 / 名称 / 描述` 等业务字段；来源展示已在后续 `OI-026` 中移除。
- 作用域无分组或原 `未分类` 统一显示为 `网络空间`。
- 作用域详情页取消 `关系` 区域，只保留分组、层级、来源等核对信息。
- 在统一问题清单新增并关闭 `OI-025`。

验证结果：

- `node --check frontend/capability-browser/app.js` 通过。
- `git diff --check` 通过。
- 本地 `http://127.0.0.1:5180/` 返回 HTTP 200。
- 浏览器已确认 `专项知识维护 > 作用域清单` 中：
  - 表头逐列筛选已出现；
  - `描述` 列已出现；
  - 原 `未分类` 口径已显示为 `网络空间`；
  - 来源信息已按后续 `OI-026` 从展示层移除；
  - 右侧实体关系详情默认宽度已明显缩窄。
- 仍需用户实际拖拽确认区域宽度和列宽调整手感。

## 2026-05-11 前端去来源化展示

用户明确新口径：

- 系统所有页面不用再展示来源；
- 前端应展示数据处理、映射、关联好的结果；
- 或者展示单独的数据清单；
- 原始 Sheet、行号、单元格等来源信息对当前查看无意义，并影响关系核对。

已完成：

- 从前端展示层移除 `来源` 列。
- 从右侧实体关系详情中移除来源卡片。
- `专项知识维护` 中纯数据清单页只保留 `分组 / 编码或类型 / 名称 / 描述`。
- 有业务关联的清单页显示 `关联结果`，不再用来源作为空关系兜底。
- 在统一问题清单新增并关闭 `OI-026`。

说明：

- 数据层仍保留 source metadata，便于以后 ETL 报错、治理追踪、人工排错。
- 默认 UI 不再展示 source metadata。

验证结果：

- `node --check frontend/capability-browser/app.js` 通过。
- `git diff --check` 通过。
- `rg -n "来源" frontend/capability-browser/app.js frontend/capability-browser/index.html` 无匹配。
- 浏览器已确认 `专项知识维护 > 作用域清单` 不再显示来源列，右侧实体关系详情不再显示来源卡片。

## 2026-05-11 已导入数据复核

用户要求暂停前端优化，重新检查已导入数据是否仍有未修复 issue。

复核范围：

- 统一问题清单 `docs/06-implementation/open-issues.md`。
- 当前 SQLite 数据库 `data/database/sapd_wiki.sqlite3`。
- 最近 import job、正式表、source reference、通用导出风险。
- 已知问题 `OI-017`、`OI-010`、`OI-013` 相关数据状态。

检查结果：

- 最新已审批导入任务为 `552e1ee4-6060-4716-b68c-259a116d1555`，`stage_summary.validations` 为空数组。
- 当前正式表统计：
  - `knowledge_items`: 1375
  - `knowledge_relations`: 4811
  - `source_references`: 34583
- warning review 文件均只有表头，当前没有导入 warning 明细。
- 已确认无以下问题：
  - orphan relation：0
  - 重复 relation：0
  - active 空标题或 `...` / `…` 占位标题：0
  - active `work_function` 无编码：0
  - active `work_function` 未分组：0
  - active 能力目录节点未挂接：0
  - active item 缺 source reference：0
  - relation 缺 source reference：0

新发现或仍未修复的数据问题：

- `OI-017` 仍待确认：`安全技术模块清单` 中存在疑似数字标题对象：
  - `security_system` 标题 `29`，来源 `安全技术模块清单!C384:C403`
  - `security_technology_module` 标题 `98`，来源 `安全技术模块清单!D384:D403`
- 新增 `OI-027`：active 数据中存在同编码多对象：
  - `security_technical_service`：23 组重复编码，涉及 49 个 active 对象
  - `security_policy_requirement`：2 组重复编码，涉及 4 个 active 对象
- 新增 `OI-028`：正式关系表中仍有 212 条关系指向 deprecated 对象：
  - `stakeholder_by`：190 条
  - `belongs_to_layer`：22 条

处理动作：

- 更新 `docs/06-implementation/open-issues.md`：
  - 扩展 `OI-017`，把 `29` 和 `98` 一并纳入数字标题对象复核；
  - 新增 `OI-027`；
  - 新增 `OI-028`。

当前判断：

- 当前导入流程没有新的 parser validation 错误。
- 仍有 3 个数据类问题需要后续确认或修复：`OI-017`、`OI-027`、`OI-028`。
- `OI-018`、`OI-019`、`OI-020`、`OI-021` 主要是前端展示或用户确认事项，本轮不继续处理。

## 2026-05-11 Issue 口径修正与已映射表业务复核清单

用户补充确认：

- `OI-017` 中 `安全技术模块清单` C 列 `29` 和 D 列 `98` 是统计和，不是安全系统或安全技术模块。
- `OI-027` 中，同一个安全技术服务可以映射到同一个安全系统，服务-系统多对多关系本身是正确业务逻辑。
- `OI-028` 需要举例说明具体是哪部分历史关系。
- 后续每建模或导入一张原始表前，都必须先确认业务含义、主键、与其他表的关系，以及一对多/多对一/多对多关系。
- 已经完成映射的原始表，也需要再做一次业务确认，以便前端逻辑设计和展示。

已完成：

- 修正 `src/sapd_wiki/parsers.py`：
  - `安全技术模块清单` 中 C / D 列为纯数字统计值时，整行跳过；
  - 不再生成 `security_system 29` 或 `security_technology_module 98`；
  - 避免统计行沿用上一行 fill-down 值。
- 备份数据库：
  - `data/database/backups/sapd_wiki-before-oi017-summary-skip-20260511.sqlite3`
- 重新 stage / approve 核心 Sheet：
  - import job `19e73f99-564d-4e70-907c-8479b971b0a6`
  - `validations: []`
  - `warnings: []`
  - `items_deprecated: 2`
- 重新导出：
  - `frontend/capability-browser/public/data/capability-tree.json`
  - `frontend/capability-browser/public/data/management-knowledge.json`
  - `frontend/capability-browser/public/data/lifecycle-knowledge.json`
  - `frontend/capability-browser/public/data/content-views.json`
  - `data/exports/items-latest/knowledge-items.*`
  - `data/exports/relations-latest/knowledge-relations.*`
- 新增 `docs/03-import-etl/completed-sheet-business-confirmation.md`：
  - 覆盖第一批核心 Sheet、第二批管理与职能 Sheet、第三批生命周期 Sheet；
  - 列出每张表的业务含义、当前对象、主键/稳定身份、关系基数和待确认问题。
- 更新 `docs/07-governance/data-governance.md`：
  - 新增“原始表建模确认规则”。
- 更新 `docs/06-implementation/open-issues.md`：
  - `OI-017` 改为 `已修复`；
  - `OI-027` 补充 `security_policy_requirement` 来源说明；
  - `OI-028` 补充具体历史关系示例。
- 更新 `task_plan.md`：
  - 增加已完成映射 Sheet 业务确认清单任务。

验证结果：

- SQLite 查询确认 `security_system 29` 和 `security_technology_module 98` 均为 `deprecated`。
- `management-knowledge.json` 中 active `security_technology_modules` 为 165。
- `python -m compileall src` 通过。
- `node --check frontend/capability-browser/app.js` 通过。
- `git diff --check` 通过。

仍待用户确认：

- `security_policy_requirement` 中 `LC-AP 应用安全开发生命周期!G6` 的原始编号 `14.`、`15.` 各出现两次，是否需要修源表编号，还是允许前端显示复合标识。
- 安全技术服务编码是否全局唯一；如果不是，需要确认服务主键是否为 `作用域 + 能力关注点 + 服务编码 + 标题` 或其他复合键。
- deprecated 对象的历史关系是否应从通用全量导出默认隐藏，或保留为历史审计数据。

## 2026-05-11 第一批业务表确认、源数据复导与剩余数据问题收口

用户补充确认：

- `OI-027` 中 `LC-AP` 策略要求重复编号是源数据错误，已把第二个 `14`、`15` 修正为 `16`、`17`，最后一个值修正为 `18`。
- `OI-028` 按最合理方式处理：数据库保留历史，默认关系导出只导出 active 端点关系，审计时单独导出历史关系。
- 第一批 6 张表的业务含义、主键和关系基数已确认：
  - `安全能力目录` / `安全能力-关注点` 是后续映射基础；
  - `安全能力作用域目录` 是作用域主数据来源，按原表样式展示；
  - `信息化环境-信息化对象-安全作用域映射` 是环境 -> 对象 -> 作用域的 1:N 关系；
  - `安全能力-安全技术服务` 表达不同作用域下关注点具备的安全技术服务，服务编码全局唯一；
  - `安全技术模块清单` 是系统分类 -> 系统 -> 模块主数据，模块与服务/产品为 N:M；
  - `作用域-安全技术服务-安全技术模块映射` 是对象/作用域 -> 服务 -> 模块 -> 系统/产品的连续映射。

已完成：

- 更新 `docs/03-import-etl/completed-sheet-business-confirmation.md`：
  - 将第一批 6 张表改为已确认业务口径；
  - 新增第一批前端展示口径；
  - 把 `LC-AP` 策略重复编号、deprecated 关系导出、专项维护页展示口径纳入已确认事项。
- 更新 `docs/07-governance/data-governance.md`：
  - 补充安全技术服务编码全局唯一规则；
  - 补充前端默认不展示来源行列，优先展示业务关系和关系链路。
- 修正代码：
  - `src/sapd_wiki/parsers.py` 跳过 `安全技术模块清单` C/D 列纯数字统计值，并支持 `LC-AP` 无标点编号如 `16 应定期...`；
  - `src/sapd_wiki/transformers.py` 支持把 `I-AP&AD.SA-01` 规范为 `I-AP&T-AD.SA-01`；
  - `src/sapd_wiki/candidates.py` 将 `security_technical_service` 设为编码唯一对象；
  - `src/sapd_wiki/exports.py` 与 `src/sapd_wiki/cli.py` 增加 active 端点默认关系导出和 `--include-deprecated` 审计开关。
- 备份数据库：
  - `data/database/backups/sapd_wiki-before-oi017-summary-skip-20260511.sqlite3`
  - `data/database/backups/sapd_wiki-before-first-batch-confirmation-20260511.sqlite3`
- 重新导入并审批：
  - 核心 Sheet import job `0762309c-1d65-4ae0-9619-1c01a375ce48`，`validations: []`，`warnings: []`；
  - 第三批 `LC-AP` import job `83424e80-d875-4b97-bba9-8753bd0dc16b`，`validations: []`，`warnings: []`。
- 重新导出：
  - `frontend/capability-browser/public/data/capability-tree.json`
  - `frontend/capability-browser/public/data/management-knowledge.json`
  - `frontend/capability-browser/public/data/lifecycle-knowledge.json`
  - `frontend/capability-browser/public/data/content-views.json`
  - `data/exports/items-latest/knowledge-items.*`
  - `data/exports/relations-latest/knowledge-relations.*`
  - `data/exports/relations-with-history-latest/knowledge-relations.*`
- 更新 `docs/06-implementation/open-issues.md`：
  - `OI-017`：已修复，C/D 列数字统计值不再生成 active 对象；
  - `OI-027`：策略编号重复已修复，安全技术服务 active 同编码多对象已清零；仍保留同编码不同标题的源数据冲突报告待用户核对；
  - `OI-028`：已修复，默认关系导出只含 active 端点；
  - `OI-029`：新增信息化对象同名 active 对象问题，等待用户核对。

验证结果：

- `security_system 29` 和 `security_technology_module 98` 已为 `deprecated`。
- active `security_policy_requirement` 重复编码组数为 0。
- active 同编码多对象数量为 0。
- 默认 active 端点关系导出为 4615 条；含历史审计关系导出为 6648 条。
- `data/exports/data-quality/security-technical-service-code-conflicts.csv`：22 个冲突编码，284 条来源记录。
- `data/exports/data-quality/security-technical-service-code-conflict-summary.csv` / `.md`：已把 284 条明细压缩成 22 行人工核对表。
- `data/exports/data-quality/information-object-duplicate-titles.csv`：8 组同名 active `information_object`，24 个对象，89 行来源记录。

仍待用户确认：

- `OI-027` 中安全技术服务同编码不同标题的源数据冲突，需核对 `data/exports/data-quality/security-technical-service-code-conflicts.csv`。
- `OI-029` 中同名信息化对象是否为源数据错误、对象分类字段误用，还是允许跨环境复用，需核对 `data/exports/data-quality/information-object-duplicate-titles.csv`。

## 2026-05-12 OI-027 权威来源规则落地与复导

用户补充确认：

- 原始 Excel 已修正。
- `安全能力-安全技术服务` 中的安全技术服务编号和名称是准确值。
- 同编码服务在其他表中出现时，只表示映射关系，不应覆盖标准服务名称。

已完成：

- 备份数据库：
  - `data/database/backups/sapd_wiki-before-oi027-authoritative-service-reimport-20260512-002207.sqlite3`
- 修正 ETL：
  - `security_technical_service` 继续按编码全局唯一；
  - `安全技术模块清单`、`作用域-安全技术服务-安全技术模块映射`、`LC-DT 数据生命周期` 中同编码服务统一取 `安全能力-安全技术服务` 的标准名称；
  - 新增服务名称规范化，重复尾部括号只保留一次，例如 `（签名验签）（签名验签）` 规范为 `（签名验签）`。
- 重新导入并审批：
  - 核心 Sheet import job `c00c291f-4682-4a1a-8862-91cd0fe1a570`，`validations: []`，`warnings: []`；
  - 第三批 import job `79a17f64-3790-469b-b72e-5af72de1985b`，`validations: []`，`warnings: []`。
- 重新导出：
  - `frontend/capability-browser/public/data/capability-tree.json`
  - `frontend/capability-browser/public/data/management-knowledge.json`
  - `frontend/capability-browser/public/data/lifecycle-knowledge.json`
  - `frontend/capability-browser/public/data/content-views.json`
  - `data/exports/items-latest/knowledge-items.*`
  - `data/exports/relations-latest/knowledge-relations.*`
  - `data/exports/relations-with-history-latest/knowledge-relations.*`
  - `data/exports/import-review-latest/import-result-report-c00c291f.md`
  - `data/exports/import-review-latest/import-result-report-79a17f64.md`
- 更新文档：
  - `docs/06-implementation/open-issues.md` 中 `OI-027` 改为 `已修复`；
  - `docs/07-governance/data-governance.md` 增加安全技术服务权威来源规则；
  - `docs/03-import-etl/completed-sheet-business-confirmation.md` 更新第一批确认口径；
  - `task_plan.md` 更新最新导入任务和数据库统计。

验证结果：

- active `security_technical_service` 同编码多对象数量为 0。
- active `security_policy_requirement` 重复编码组数量为 0。
- 抽查标准名称已正确：
  - `I-AP&T-AS.CG-02` -> `应用程序完整性校验（含操作签名验签）`
  - `I-AP&T-PD.TP-02` -> `应用异常特征检测（API、Web应用）`
  - `I-DI&T-AS.CG-02` -> `数据完整性校验（签名验签）`
  - `I-NT&T-AD.SA-01` -> `网络高级威胁检测（启发式、行为式）`
  - `I-OS&T-AS.DS-03` -> `组件安全管理`
- `data/exports/data-quality/security-technical-service-code-conflict-summary.md` 结论为已修复，冲突记录数为 0。

仍待确认：

- `OI-029` 信息化对象同名 active 对象仍待用户核对。

## 2026-05-12 OI-029 信息化对象两表一致性检查

用户补充确认：

- `信息化环境-信息化对象-安全作用域映射` 和 `作用域-安全技术服务-安全技术模块映射` 中的信息化对象应使用同一套主数据。
- 用户已确认两张表里的信息化对象数据现在应该一致。

检查结果：

- 按最新原始 Excel 正确列位解析：
  - `B=信息化环境`
  - `C=环境分段/子类`
  - `D=信息化对象`
  - `E=作用域`
  - `F=安全技术服务`
- 两张表均为 754 条有效业务行。
- 两张表均为 66 个 `信息化环境/环境分段/信息化对象` 三元组。
- 两张表均为 49 个唯一信息化对象名称。
- 对象名称集合差异为 0。
- 三元组集合差异为 0。
- `对象 + 作用域 + 安全技术服务` 组合差异为 0。

结论：

- 原始数据当前没有发现两表不一致问题。
- `OI-029` 根因转为 ETL 规则问题：
  - `信息化环境-信息化对象-安全作用域映射` parser 仍按旧列位读取；
  - `information_object` 当前仍按环境/分段拆分对象身份；
  - 应修正为两张表共用 `information_object` 主数据，按对象名称全局去重。

已更新：

- `docs/06-implementation/open-issues.md` 中 `OI-029` 状态改为 `处理中`，并记录最新根因和验证结果。

## 2026-05-12 OI-029 ETL 修复与复导

已完成：

- 修正 `src/sapd_wiki/parsers.py`：
  - `信息化环境-信息化对象-安全作用域映射` 改为按当前源表列位读取：`B=信息化环境`、`C=环境分段/子类`、`D=信息化对象`、`E=作用域`、`F=安全技术服务`；
  - `信息化环境-信息化对象-安全作用域映射` 中的安全技术服务也生成 `protects_object` 与 `applies_to_scope` 关系；
  - `信息化环境-信息化对象-安全作用域映射` 与 `作用域-安全技术服务-安全技术模块映射` 共用 `information_object` 主数据；
  - `information_object` 按对象名称全局去重，环境/分段不再参与对象主键。
- 备份数据库：
  - `data/database/backups/sapd_wiki-before-oi029-information-object-etl-20260512.sqlite3`
- 重新导入核心 Sheet：
  - import job `7ac14b99-3827-46e1-9e3b-aa557ed637b7`
  - `validations: []`
  - `warnings: []`
  - `items_created: 49`
  - `items_updated: 626`
  - `items_deprecated: 100`
  - `relations_created: 686`
- 重新导出：
  - `frontend/capability-browser/public/data/capability-tree.json`
  - `frontend/capability-browser/public/data/management-knowledge.json`
  - `frontend/capability-browser/public/data/lifecycle-knowledge.json`
  - `frontend/capability-browser/public/data/content-views.json`
  - `data/exports/items-latest/knowledge-items.*`
  - `data/exports/relations-latest/knowledge-relations.*`
  - `data/exports/relations-with-history-latest/knowledge-relations.*`
  - `data/exports/import-review-latest/import-result-report-7ac14b99.md`
  - `data/exports/data-quality/information-object-duplicate-titles.csv`
  - `data/exports/data-quality/information-object-duplicate-titles.md`
- 更新文档：
  - `docs/06-implementation/open-issues.md` 中 `OI-029` 改为 `已修复`；
  - `docs/07-governance/data-governance.md` 补充 `information_object` 主数据规则；
  - `docs/03-import-etl/completed-sheet-business-confirmation.md` 更新两张信息化对象表的业务口径；
  - `task_plan.md` 更新最新导入任务和数据库统计。

验证结果：

- active `information_object` 数量为 49。
- active `information_object` distinct title 数量为 49。
- active 同名 `information_object` 重复数量为 0。
- `information-object-duplicate-titles.csv` 仅剩表头。
- `management-knowledge.json` 统计：
  - `information_environments: 10`
  - `information_objects: 66`
  - `environment_scope_mappings: 96`
  - `environment_service_mappings: 1256`
  - `environment_module_mappings: 4895`

说明：

- `management-knowledge.json` 中 `information_objects: 66` 是按环境/分段展示的对象条目数，不是主数据条数；主数据条数以数据库 active `information_object = 49` 为准。

## 2026-05-12 后端接口边界与前端重构调度

用户要求主控 Agent review 当前进度和计划，并明确前后端分离：后端逻辑和接口架构需要形成设计文档，前端则参考用户提供的 `chatgpt ui code.md` 与 `impeccable` 设计原则继续重构。

已完成：

- 阅读当前计划、问题和前端任务文档：
  - `task_plan.md`
  - `findings.md`
  - `docs/06-implementation/open-issues.md`
  - `docs/04-frontend/frontend-redesign-brief.md`
  - `docs/04-frontend/frontend-information-architecture.md`
  - `frontend/capability-browser/README.md`
  - `frontend/capability-browser/index.html`
  - `frontend/capability-browser/styles.css`
  - `frontend/capability-browser/app.js`
- 新增 `docs/01-architecture/backend-interface-design.md`：
  - 明确后端负责来源登记、ETL、标准化、主数据、关系生成、校验、staging、正式入库、查询投影和导出；
  - 明确前端负责页面导航、树/表格/矩阵/关系链/详情面板、筛选、拖拽调宽和交互；
  - 明确当前静态 JSON 是 MVP API 契约，后续本地 `/api/v1/*` 应保持同一语义；
  - 定义能力维度、信息化环境维度、专项知识维护、生命周期、内容视图、导入审查、数据质量和导出接口方向；
  - 明确前端默认不展示来源证据，来源只用于审计和数据排查。
- 更新 `docs/01-architecture/architecture.md`：
  - 增加后端逻辑边界和前后端接口契约入口，指向 `docs/01-architecture/backend-interface-design.md`。
- 更新 `task_plan.md`：
  - 新增 `Phase 5 Backend/Frontend Separation Tasks`；
  - 更新下一步推荐工作为“接口契约固化 -> 能力维度关系页重构 -> 主控验收 -> 已导入 Sheet 业务复核”。
- 更新 `docs/06-implementation/open-issues.md`：
  - `OI-018` 补充后端接口设计文档和当前前端重构处理方式；
  - `OI-024` 补充同一阶段优先复用同一个 Frontend Design Agent 的执行规则。

Agent 管理修正：

- 本轮已启动的 `Herschel` 固定作为 Frontend Design Agent，负责 `frontend/capability-browser/` 前端重构。
- 主控 Agent 不再启动新的前端 Agent，不因短等待窗口未返回就判断 Agent 失效。
- 主控 Agent 当前只负责接口文档、计划/issue 同步和最终验收，不并行改同一批前端文件。

下一步：

- 等待并验收 `Herschel` 的前端输出；
- 验收重点是是否参考 `chatgpt ui code.md` 做到关系工作台，而不是卡片墙；
- 若前端需要新增数据字段，由主控先调整后端 JSON/API 契约，再交给 ETL/Data 线处理。

验证结果：

- `git diff --check` 通过。

## 2026-05-12 Frontend Design Agent 输出验收

`Herschel` 已完成前端重构并回报，实际修改范围只包含：

- `frontend/capability-browser/index.html`
- `frontend/capability-browser/styles.css`
- `frontend/capability-browser/app.js`
- `frontend/capability-browser/README.md`

主控验收结果：

- 未发现 `Herschel` 修改 `src/`、`docs/`、`data/`、`task_plan.md`、`progress.md`、`open-issues.md`。
- 前端从顶部横向 tab 改为左侧主导航，保留 7 个页面入口。
- 能力维度强化为树、矩阵、关系链和窄详情面板。
- 能力关系矩阵新增表头筛选和列宽拖拽。
- 保留既有区域拖拽、专项表格筛选、专项表格列宽拖拽和静态 JSON 加载方式。
- `impeccable` 项目内 `.agents` loader 不存在，前端 Agent 按 fallback 使用其产品 UI 原则继续执行。

验证结果：

- `node --check frontend/capability-browser/app.js` 通过。
- `git diff --check` 通过。
- `rg -n "来源|sourceSummary|source evidence|Source" frontend/capability-browser/index.html frontend/capability-browser/app.js frontend/capability-browser/styles.css` 无命中。
- 旧 `8000` 端口存在不可访问的 Python 监听，主控未杀进程，改用 `8001` 启动新的本地静态服务。
- 当前预览地址：`http://127.0.0.1:8001/`
- 以同权限层验证：
  - `http://127.0.0.1:8001/` 返回 HTTP 200；
  - `http://127.0.0.1:8001/styles.css` 返回 HTTP 200；
  - `http://127.0.0.1:8001/app.js` 返回 HTTP 200；
  - `http://127.0.0.1:8001/public/data/capability-tree.json` 返回 HTTP 200。

问题状态更新：

- `OI-018` 从 `处理中` 改为 `待确认`，等待用户浏览确认前端关系工作台方向。

Agent 管理说明：

- 主控未关闭 `Herschel`。
- 用户界面如仍显示 `Herschel` 执行中，以子 Agent 回报和主控 wait 结果为准：本轮任务已完成；本地服务进程不等同于子 Agent 仍在编码。

## 2026-05-12 字段级 API 契约与前端设计文档同步

用户要求生成完整接口文档，并明确接口字段；随后要求接口文档完成后同步 GitHub，同时确认前后端分离后前端设计文档是否有更新。

已完成：

- 新增 `docs/01-architecture/api-field-contract.md`：
  - 定义通用响应结构、错误响应、通用对象字段、来源字段、校验问题字段；
  - 定义当前静态 JSON 与未来 `/api/v1/*` 接口的对应关系；
  - 定义系统状态、能力维度、信息化环境维度、专项知识维护、标准与岗位参考、生命周期、内容视图、导入、数据质量和导出接口字段；
  - 定义字段成熟度和前端接入规则；
  - 明确下一步先建立前端 `dataClient`，再继续扩展页面。
- 更新 `docs/01-architecture/backend-interface-design.md`：
  - 增加字段级契约入口，说明字段以 `api-field-contract.md` 为准。
- 更新 `docs/04-frontend/frontend-redesign-brief.md`：
  - 明确前端必须以 `backend-interface-design.md` 和 `api-field-contract.md` 为数据边界；
  - 明确页面组件通过 `dataClient` 消费字段契约；
  - 明确前端不得自行合并对象、纠正编码或推断主数据；
  - 明确来源字段默认不展示。
- 更新 `docs/04-frontend/frontend-information-architecture.md`：
  - 新增“前后端分离后的数据接入方式”；
  - 明确当前 MVP 为 `public/data/*.json -> dataClient -> 页面组件`；
  - 明确未来本地 API 为 `/api/v1/* -> dataClient -> 页面组件`；
  - 将来源证据调整为导入审查、数据质量排查或调试模式下查看，不作为默认业务页面字段。
- 更新 `task_plan.md`：
  - 将字段级 API 契约和前端设计文档同步纳入 Phase 5 已完成任务。

回答用户问题：

- 前端设计文档已经同步更新。
- 更新文件为：
  - `docs/04-frontend/frontend-redesign-brief.md`
  - `docs/04-frontend/frontend-information-architecture.md`

下一步：

- 运行文档和脚本验证；
- 统一提交并推送到 GitHub。
