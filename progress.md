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

## 2026-05-12 修正能力维度技术服务映射口径

用户明确：原表中 `/` 表示该关注点在该作用域下没有安全技术服务，不是待补充。

已完成：

- 修正 `src/sapd_wiki/exports.py`：
  - 能力维度 `scope_mappings` 只使用 `安全能力-安全技术服务` 权威表中的服务自身作用域；
  - 下游表中的 `安全技术服务 -> 作用域` 关系不再反向补入能力维度；
  - 服务详情中的 `scopes` 也只保留权威作用域。
- 修正 `src/sapd_wiki/parsers.py`：
  - `/` 单元格转为 `no_service_in_scope` 关系；
  - 该关系用于表示 `关注点 + 作用域` 明确无安全技术服务。
- 重新执行核心 Sheet 导入：
  - staging import job：`98e896b6-1ecb-42a3-897b-51ee5a854e96`；
  - staging 识别 `no_service_in_scope: 223`；
  - approve 新增关系 `223` 条，warnings 为空。
- 修正前端能力维度文案：
  - 空服务口径从 `待补充` 调整为 `无服务`；
  - 概览区增加 `无服务作用域` 统计；
  - 顶部摘要增加 `无服务` 统计；
  - 删除无业务含义的 `技术映射`、`管理映射`切换按钮。
- 更新 `docs/06-implementation/open-issues.md`：
  - `OI-030` 状态调整为 `已修复`；
  - 补充 `/` 的业务含义和后端导出修复方式。
  - `OI-031` 状态调整为 `已修复`。

验证结果：

- 已重新导出 `frontend/capability-browser/public/data/capability-tree.json`。
- 导出统计：`services: 157`，`focus_scope_mappings: 374`。
- 显式 `无服务` 映射：`217` 条。
- 检查同一 `关注点 + 作用域` 下多个服务：`0` 条。
- 抽查 `T-AS.AD-02 + I-DI 数据与信息`：仅保留 `I-DI&T-AS.AD-02 冗余存储`。
- 抽查原表 `T-AS.AD-02 + I-US 用户`：值为 `/`，导出为 `status: no_service`，来源包含 `G5:/`。
- `python3 -m py_compile src/sapd_wiki/parsers.py src/sapd_wiki/exports.py` 通过。
- `node --check frontend/capability-browser/viewModels.js` 和相关组件检查通过。

## 2026-05-12 追踪 `终端安全工作区` 来源

用户在能力维度页面发现 `T-AS.AD-01 + I-OS 操作系统` 的 `技术模块/措施` 列出现 `终端安全工作区`，但在原始表中未找到对应主数据。

追踪结果：

- `终端安全工作区` 来自 `作用域-安全技术服务-安全技术模块映射` 第 620 行，`G620`。
- `安全技术模块清单` 中同一服务 `I-OS&T-AS.AD-01 主机/终端安全工作区划分` 对应两条模块主数据：
  - 第 26 行 `D26`：`安全工作区`；
  - 第 294 行 `D294`：`移动终端安全工作区`。
- `安全技术模块清单` 中未找到 `终端安全工作区`。
- 已新增 `OI-032`，记录为待确认的数据契约问题：当前页面把映射表中的自由文本模块/措施与标准技术模块混在同一列展示。

## 2026-05-12 检查 `/` 无服务映射与 G 列底色

用户要求继续检查 `安全能力-安全技术服务` 中是否仍有 `/` 未完成映射，并确认 `作用域-安全技术服务-安全技术模块映射` 的 G 列是否能识别浅蓝色和浅灰色底色。

检查结果：

- `安全能力-安全技术服务` 原始 `/` 单元格：228 个。
- 已导出 `status: no_service`：217 个。
- 尚未完成显式 `无服务` 映射：11 个。
- 未完成映射集中在：
  - `T-AS.DS-01` 到 `T-AS.DS-06` 的 `I-OS` 作用域；
  - `T-PD.TP-05` 的 `I-PE` 作用域；
  - `T-AD.IR-02` 的 `I-HD`、`I-PE` 作用域；
  - `T-AD.SV-02` 的 `I-HD`、`I-PE` 作用域。
- 已将 `OI-031` 状态从 `已修复` 调整为 `部分修复`，并补充 11 个未完成映射。

G 列底色检查结果：

- 可以识别底色。
- `作用域-安全技术服务-安全技术模块映射` 的 G 列存在 3 组填充样式：
  - 浅蓝色样式：198 行；
  - 浅灰色样式：138 行；
  - 特殊深色样式：2 行，行号为 60、338。
- 按 `安全技术模块清单` D 列作为唯一模块主数据，G 列存在 61 个唯一非主数据值、228 次命中。
- 已更新 `OI-032`，补充底色识别结果和主数据一致性统计。

用户进一步确认 G 列底色业务含义：

- 浅蓝色：安全技术模块，应与 `安全技术模块清单` D 列安全技术模块完成映射。
- 浅灰色：安全技术措施，没有单独维护原始表，建议在专项知识维护中增加页面单独维护展示。

按新口径重新统计：

- 浅蓝色安全技术模块：198 行。
- 浅灰色安全技术措施：138 行。
- 特殊说明类：2 行。
- 浅蓝色未匹配 `安全技术模块清单` D 列的唯一值：32 个。
- 浅蓝色未匹配命中次数：88 次。
- 已更新 `OI-032`，将“浅灰色不匹配”从模块主数据错误中剥离，改为安全技术措施口径。
- 新增 `OI-033`：后续新增安全技术措施专项维护页面。

用户补充部分数据修正与例外映射规则后，重新检查 `OI-032`：

- 浅蓝色安全技术模块行：197 行。
- 按用户确认的相似映射和例外规则归并后，仍未匹配唯一值：3 个。
- 仍未匹配命中次数：5 次。
- 剩余待确认：
  - `数据脱敏(应用自带或SDK嵌入)`：3 次，行号 `165,231,389`，参考 `数据脱敏(去标识化)`；
  - `应用程序控制`：1 次，行号 `734`；
  - `文件完整性监控`：1 次，行号 `735`。
- 已更新 `OI-032` 的重新计算结果。

用户二次确认 `OI-032` 剩余项处理方式：

- 原第 3 项 `虚拟主机部署:主机安全管理 容器环境部署:容器镜像安全` 无问题，解析为 `主机安全管理` 与 `容器镜像安全`。
- 原第 8 项 `零信任访问代理 ... 零信任访问控制台` 无问题，解析为 `零信任访问代理` 与 `零信任访问控制台`。
- 原第 25 项 `单向光闸 双向网闸` 无问题，解析为 `单向光闸` 与 `双向网闸`。
- `数据脱敏(应用自带或SDK嵌入)` 直接映射到 `数据脱敏(去标识化)`。
- `应用程序控制` 修正为 `主机安全管理`。
- `文件完整性监控` 修正为 `主机入侵防御（HIPS）`。

再次检查结果：

- 浅蓝色安全技术模块行：197 行。
- 浅蓝色安全技术模块 token：197 个。
- 未匹配唯一值：0 个。
- 未匹配命中次数：0 次。
- 已将 `OI-032` 状态调整为 `已修复`。

## 2026-05-12 修正能力维度技术视角派生列

用户指出能力维度技术视角中的 `覆盖状态` 和 `说明` 两列需要确认来源与业务含义。

确认结果：

- `覆盖状态` 不是原始表字段，是前端根据是否存在非空安全技术服务派生出的显示状态。
- `说明` 不是原始表字段，是前端为 `/` 无服务和映射异常生成的解释文本。
- 两列无独立业务属性，不应作为技术视角表格列展示。

已完成：

- 修正 `frontend/capability-browser/components/FocusScopeServiceMatrix.js`：
  - 删除 `覆盖状态` 列；
  - 删除 `说明` 列；
  - 技术视角表格仅保留 `作用域`、`安全技术服务`、`技术模块/措施`；
  - `映射异常` 保留在 `安全技术服务` 单元格内展示候选服务详情。
- 修正 `frontend/capability-browser/viewModels.js`：
  - 移除技术映射行中的 `coverageStatus` 和 `note` 派生展示字段。
- 更新 `docs/06-implementation/open-issues.md`：
  - 新增 `OI-034` 并标记为 `已修复`；
  - 将 `OI-033` 调整为 `部分修复`，记录安全技术措施前端入口已完成、ETL 数据仍待后续补齐。

验证结果：

- `node --check frontend/capability-browser/app.js` 通过。
- `node --check frontend/capability-browser/viewModels.js` 通过。
- `node --check frontend/capability-browser/dataClient.js` 通过。
- `node --check frontend/capability-browser/components/*.js` 通过。
- `git diff --check` 通过。

## 2026-05-13 修正安全技术措施导出口径

用户确认安全技术措施清单的数据处理规则：

- 10 条 `N/A(...)` 说明类数据应进入安全技术措施清单；
- 导出时去掉外层 `N/A` 与括号，只保留括号内措施名称；
- `分类` 没有独立原始字段，不新增推断分类，所有措施分类暂为空；
- `N/A(...)` 说明类语义不进入分类字段，仅通过 `status=pending` 保留为待确认状态；
- 安全技术措施不关联安全技术模块；
- 操作系统、云平台、应用系统、数据库系统自带能力类对象可作为措施保留；
- `17/29` 按 `29` 为准、`19/30` 按 `19` 为准，用户已修复原始数据；
- 带 `(无部分服务)` 的措施名称完整保留。

已完成：

- 修正 `src/sapd_wiki/exports.py`：
  - `N/A(...)` 名称导出时去包装；
  - 保留 `N/A(...)` 的待确认状态，导出为 `category=null`、`status=pending`；
  - 不生成安全技术模块关联。
- 重新导出 `frontend/capability-browser/public/data/management-knowledge.json`。
- 更新 `docs/06-implementation/open-issues.md`：
  - `OI-033` 状态调整为 `已修复`；
  - 记录安全技术措施导出口径和验证结果。

验证结果：

- `python3 -m py_compile src/sapd_wiki/exports.py` 通过。
- `python3 scripts/sapd_wiki.py export-management-knowledge --output frontend/capability-browser/public/data/management-knowledge.json` 通过。
- 重新导出后 `security_technical_measures` 为 29 条。
- 分类字段填充值为 0 条。
- 其中 `pending` 为 10 条。
- 安全技术模块关联为 0 条，符合“不关联数据模块”的口径。
- `git diff --check` 通过。

## 2026-05-13 重新 ETL 安全技术措施相关数据

用户要求重新 ETL 安全技术措施相关数据。

已完成：

- 重新执行 `stage-excel "data/raw-samples/wiki sample.xlsx" --sheets all --sensitive-level confidential`。
- 新 staging/import job：`9afb8c92-462d-4c05-827d-d2ffa57af6a2`。
- 审批导入任务：
  - 新增对象：2；
  - 更新对象：658；
  - 停用旧对象：17；
  - 新增关系：53；
  - warning：0。
- 重新导出：
  - `frontend/capability-browser/public/data/capability-tree.json`；
  - `frontend/capability-browser/public/data/management-knowledge.json`。
- 更新 `task_plan.md` 中最新第一批 clean approved import job 为 `9afb8c92-462d-4c05-827d-d2ffa57af6a2`。

重新导出结果：

- `security_technical_measures`：29 条；
- `pending`：10 条；
- 分类填充值：0 条；
- 安全技术模块关联：0 条。

说明：

- 当前源 Excel 经正式 ETL 后仍导出 29 个唯一安全技术措施；
- 原因是安全技术措施按“同名措施 + 同分类”去重合并，而当前分类统一为空；
- 如果业务期望 31 条，需要继续核对是否存在同名但业务上应拆分的措施。

验证结果：

- `git diff --check` 通过。

## 2026-05-13 Step 6.7 前端整体回归

用户要求执行 Step 6.7：前端整体回归 + 遗留问题清单冻结。

范围控制：

- 仅检查和必要小修 `frontend/capability-browser/`；
- 未进入 Step 7；
- 未做视觉重构或 Impeccable polish；
- 未修改后端、ETL、数据模型。

必要小修：

- 修正 `frontend/capability-browser/app.js`：
  - 总览页不再把 `generated_at` 作为主展示字段；
  - 原位置改为固定展示 `本地数据`。

回归页面：

- 总览；
- 能力维度；
- 信息化环境维度；
- 专项知识维护：
  - 作用域清单；
  - 流程清单；
  - 职能清单；
  - 安全技术模块清单；
  - 安全技术措施清单；
  - 标准与岗位参考。

Playwright 回归结果：

- 控制台错误：0；
- 总览页未主展示 `generated_at`；
- 能力维度技术视角和管理视角均可见；
- 信息化环境维度对象树和映射表可打开；
- 专项知识维护 6 个页面均可打开；
- 安全技术措施清单当前显示 29 条；
- 安全技术措施清单表头为：
  - 序号；
  - 安全技术措施；
  - 关联安全技术服务；
  - 适用作用域；
  - 关联信息化环境；
  - 关联信息化对象。
- 未发现 `undefined`、`null`、`NaN`、`[object Object]`；
- 未发现主展示区泄露 `sheet`、`row`、`column`、`raw_value`、`source_file`、`import_id`、`source_id`、`generated_at` 等非业务字段；
- `SourceEvidencePanel` 默认折叠。

验收命令：

- `node --check frontend/capability-browser/dataClient.js` 通过；
- `node --check frontend/capability-browser/viewModels.js` 通过；
- `node --check frontend/capability-browser/app.js` 通过；
- `node --check frontend/capability-browser/components/*.js` 通过；
- `git diff --check` 通过；
- Playwright 页面切换回归通过。

遗留问题冻结：

- `api-field-contract.md` 尚未补充 `security_technical_measures` 字段契约；
- `backend-interface-design.md` 尚未补充安全技术措施接口/字段说明；
- `frontend-redesign-brief.md` 与 `frontend-information-architecture.md` 尚未补充安全技术措施页面说明；
- `src/sapd_wiki/parsers.py` 与 `docs/03-import-etl/mapping-rules-draft.md` 仍存在把 G 列 `安全技术模块/措施` 按 `security_technology_module` 处理的历史口径记录，需要后续统一；
- 首页 `generated_at` 主展示风险已在本轮前端修复。

## 2026-05-13 Step 6.8 冻结遗留问题逐项关闭

用户要求逐项关闭 Step 6.7 冻结的 4 个遗留问题。

范围控制：

- 未进入 Step 7；
- 未修改前端页面逻辑或视觉；
- 未做安全开发维度、数据生命周期维度或 Impeccable polish；
- 未做大规模 ETL 重构。

关闭结果：

1. `api-field-contract.md` 已补充 `security_technical_measures` 字段契约：
   - 明确数据位于 `management-knowledge.json` 顶层；
   - 明确主对象是“安全技术措施”，不同于 `security_technology_modules`；
   - 明确当前前端 6 列展示口径；
   - 明确 `related_service_names`、`related_scope_names`、`related_environment_names`、`related_environment_object_names` 支持 1:N / N:M；
   - 明确 `sources` 仅进入来源证据，默认折叠；
   - 明确 `sheet`、`row`、`column`、`raw_value`、`generated_at` 等非业务字段不得进入主展示区。
2. `backend-interface-design.md` 已补充安全技术措施读取和未来接口说明：
   - 当前静态阶段由 `dataClient.getMaintenanceTechnologyMeasures()` 读取；
   - 未来接口建议为 `GET /api/v1/maintenance/technical-measures` 和 `GET /api/v1/maintenance/technical-measures/{id}`；
   - 明确不得把安全技术模块、系统或产品返回为安全技术措施。
3. `frontend-redesign-brief.md` 和 `frontend-information-architecture.md` 已补充安全技术措施页面说明：
   - 页面位于“专项知识维护”；
   - 定位为维护和核对安全技术措施，不是来源文件浏览器；
   - 明确不同于安全技术模块清单；
   - 明确当前 6 列主表和多值关系展示边界；
   - 明确来源证据默认折叠，非业务字段不得主展示。
4. G 列 `安全技术模块/措施` 历史口径已收口：
   - `mapping-rules-draft.md` 已新增 `T-G-COLUMN-SPLIT`；
   - 明确 G 列需要分流为安全技术模块、安全技术措施、说明类 / 待确认项；
   - 明确 `/` 不生成安全技术服务，也不生成安全技术措施；
   - `parsers.py` 已做最小修正：只有浅蓝底 G 列值继续作为 `security_technology_module` 解析，浅灰措施或说明类不再伪造成模块。

验证结果：

- `python3 -m py_compile src/sapd_wiki/parsers.py` 通过；
- `git diff --check` 通过。

结论：

- Step 6.7 冻结的 4 个遗留问题均已关闭；
- 可以进入 Step 7.0，但需由用户确认后再开始。

## 2026-05-13 项目计划同步与 ChatGPT Review 资料生成

用户要求按项目计划执行下一步，并明确：

- `Step 7.0` 是外部 ChatGPT 自己的临时编码 / review 语境；
- 不建议直接纳入既有正式项目计划；
- 除非外部建议与项目主线有明确共通性，才由主控 Agent 整合进正式计划；
- 本轮完成后，需要把最新计划同步给 ChatGPT 帮助 review。

已完成：

1. 更新 `task_plan.md`：
   - 当前状态调整为 `phase_5_contracts_and_frontend_baseline_ready_for_business_review`；
   - 当前阶段调整为“关系化前端基线、接口契约与业务含义复核”；
   - 将 Phase 5 标记为进行中；
   - 将 `dataClient`、静态 JSON 接口契约对齐、能力维度前端技术基线回归标记为已完成；
   - 新增外部 review / ChatGPT handoff 边界；
   - 下一步推荐调整为“已完成映射 Sheet 的业务含义复核 + 前端关系展示校正”。
2. 更新 `docs/00-overview/project-roadmap.md`：
   - 将 Phase 3 标记为已完成；
   - 将 Phase 4、Phase 5 标记为进行中；
   - 补充 Phase 5 当前实际进展；
   - 明确正式 Phase 7 多格式增强不同于外部 ChatGPT UI prototype / 临时编码步骤。
3. 更新 `findings.md`：
   - 新增关键决策：外部 ChatGPT 协作只作为输入，不自动进入正式项目 Phase。
4. 新增 `docs/00-overview/current-plan-for-chatgpt-review.md`：
   - 用于同步给 ChatGPT 做外部 review；
   - 汇总当前定位、边界、已完成内容、当前不建议做的事、下一步主线和希望 ChatGPT review 的问题。

当前下一步：

- 用户可先把 `docs/00-overview/current-plan-for-chatgpt-review.md` 同步给 ChatGPT；
- 等外部 review 返回后，主控 Agent 再判断是否调整正式计划；
- 若无重大调整，下一轮进入“已完成映射 Sheet 的业务含义复核”。

## 2026-05-13 Plan Sync 1.0 正式项目计划状态校准

用户要求执行 Plan Sync 1.0：正式项目计划状态校准 + 下一主线冻结。

范围控制：

- 未修改 `frontend/capability-browser/`；
- 未修改 `src/sapd_wiki/`；
- 未修改 ETL/export；
- 未修改数据库模型；
- 未进入正式 Phase 7；
- 未做 PPT / Draw.io / DOCX 多格式增强；
- 未做 UI 视觉重构或 Impeccable polish；
- 未启动新的功能开发 Agent。

已同步文件：

- `task_plan.md`
- `findings.md`
- `docs/00-overview/current-plan-for-chatgpt-review.md`
- `docs/00-overview/project-roadmap.md`
- `progress.md`

`task_plan.md` 状态校准：

- 当前状态调整为 `phase_5_business_semantics_review_ready`；
- 当前阶段调整为“已导入 Sheet 业务含义复核与关系展示校正”；
- 外部 ChatGPT review gate 标记为已完成；
- 明确外部 ChatGPT 临时 Step 编号、UI prototype、prototype code 只作为 review / prototype 输入，不自动进入正式项目 Phase；
- 明确下一主线不是正式 Phase 7 多格式增强，而是“已导入 Sheet 的业务含义复核 + 前端关系展示校正”。

标记为已完成的任务：

- `dataClient` 抽象完成；
- ViewModel 层完成；
- 静态 JSON 已作为 MVP API 契约使用；
- 前端页面已通过 `dataClient` + ViewModel 消费业务投影；
- `api-field-contract.md` 和 `backend-interface-design.md` 已补齐 `security_technical_measures`；
- 能力维度完成第一阶段关系展示；
- 信息化环境维度完成第一阶段关系展示；
- 专项知识维护 6 个页面完成第一阶段闭环：
  - 作用域清单；
  - 流程清单；
  - 职能清单；
  - 安全技术模块清单；
  - 安全技术措施清单；
  - 标准与岗位参考。
- `security_technical_measures` 已导出、已补字段契约、已完成前端回归；
- G 列 `安全技术模块/措施` 分流口径已固化。

仍保留为待用户确认的任务：

- 已完成映射 Sheet 的业务含义、主键和关系基数确认；
- 第一批核心 Sheet 逐张复核；
- 第二批管理、流程、职能、岗位相关 Sheet 逐张复核；
- 第三批 LC-AP 生命周期相关 Sheet 业务语义确认；
- `lifecycle-knowledge.json` 是否需要后续 ETL/export 生成；
- 在第三批确认前，不进入完整安全开发维度页面深化。

技术栈表述修正：

- 当前 MVP frontend 调整为：静态浏览器页面 + 原生 JS + `dataClient` + ViewModel；
- React + TypeScript 调整为后续可选重构方向；
- 当前阶段不因旧技术决策强行引入 React/Vue。

`findings.md` 记录：

- 外部 ChatGPT Step 编号不进入正式 Phase；
- 当前最重要的是业务含义复核，不是 UI 扩展；
- Phase 7 多格式增强后置；
- 前端继续作为数据关系排查工作台；
- 后端负责业务关系生成，前端消费投影。

下一主线：

- 已导入 Sheet 的业务含义复核 + 前端关系展示校正。

验证结果：

- `git diff --check` 通过。

## 2026-05-13 Sheet Review 1.0 第一批核心 Sheet 业务复核

用户要求执行 Sheet Review 1.0：第一批核心 Sheet 业务含义复核与前端关系展示校正。

范围控制：

- 未修改 `frontend/capability-browser/`；
- 未修改 `src/sapd_wiki/`；
- 未修改 ETL/export；
- 未修改数据库模型；
- 未进入正式 Phase 7；
- 未做安全开发维度、数据生命周期维度、多格式增强或视觉 polish；
- 未自动修改原始数据。

已复核 Sheet：

1. `安全能力目录`
2. `安全能力作用域目录`
3. `信息化环境-信息化对象-安全作用域映射`
4. `安全能力-安全技术服务`
5. `安全技术模块清单`
6. `作用域-安全技术服务-安全技术模块映射`

已新增文档：

- `docs/03-import-etl/core-sheet-business-review.md`

复核内容：

- 每张 Sheet 的业务含义；
- 主对象；
- 主键 / 唯一约束；
- 关系基数；
- 当前前端展示位置；
- 当前展示判断；
- 问题归属；
- 后续动作。

当前判断：

- `安全能力目录` 展示准确，需用户确认层级、编码和排序为最终业务口径；
- `安全能力作用域目录` 基本准确，需确认是否完全按原表字段展示；
- `信息化环境-信息化对象-安全作用域映射` 基本准确，需确认同名信息化对象是否全局唯一，以及 `environment_segment` 是否作为正式层级；
- `安全能力-安全技术服务` 展示准确，继续保持 `/` 为无适用服务和多服务异常检测；
- `安全技术模块清单` 基本准确但需优化，需确认模块唯一约束是否应包含安全系统，以及系统/产品是否只作为详情字段；
- `作用域-安全技术服务-安全技术模块/措施映射` 基本准确但需校正展示语义，后续前端应更清楚地区分安全技术模块和安全技术措施。

仍需用户确认：

- `information_object` 是否按名称全局唯一；
- `environment_segment` 是辅助字段还是信息化环境树正式层级；
- `security_technology_module` 唯一约束是否为 `type + title`，还是 `type + security_system + title`；
- 安全技术模块清单中的系统 / 产品是否不作为主表列，只进入详情或关系说明；
- 前端是否需要显式标签区分 `安全技术模块` 和 `安全技术措施`。

计划同步：

- `task_plan.md` 中第一批核心 Sheet 已标记为“Sheet Review 1.0 草案完成，待用户确认”；
- `findings.md` 已记录第一批核心 Sheet Review 1.0 草案完成及待确认关键点。

验证结果：

- `git diff --check` 通过。

## 2026-05-13 Sheet Review 1.0 用户反馈更新

用户对照前端界面和原始表回复第一批核心 Sheet 复核结论，并补充需求修正。

已更新：

- `docs/03-import-etl/core-sheet-business-review.md`
- `docs/06-implementation/open-issues.md`
- `task_plan.md`
- `findings.md`
- `progress.md`

已确认口径：

- `安全能力目录` 的层级、编码、排序为最终口径；
- 前端页面 `能力维度` 后续应调整为 `安全能力映射`；
- `安全能力作用域目录` 原始数据已补充 `I-PE 物理环境`；
- 作用域清单按原表字段展示，派生 `作用域类型` 和 `状态` 不显示；
- 多个页面里的派生 `状态` 字段和 `待补充` 统计摘要不显示；
- 信息化对象出现在多个类似信息化环境中是正常业务逻辑；
- `安全能力-安全技术服务` 保持 `/` 为无适用服务，并保留多服务异常检测；
- 安全系统是多个安全技术模块的上级分类；
- 产品字段表示对应产品名称，`我司无相关产品` 是正常值；
- 作用域-服务-模块/措施连续映射中，前端需要显式标签区分 `安全技术模块` 和 `安全技术措施`。

已同步到统一问题清单：

- 更新 `OI-019`：作用域清单需去掉派生 `作用域类型` 和 `状态`，并等待 `I-PE 物理环境` 重导入验证；
- 更新 `OI-029`：信息化对象可在多个类似环境中复用，属于正常业务逻辑；
- 更新 `OI-033`：前端需显式标签区分安全技术模块和安全技术措施；
- 新增 `OI-035`：多个页面不显示非原表字段 `状态` 和 `待补充` 统计摘要；
- 新增 `OI-036`：`能力维度` 页面需更名为 `安全能力映射`。

仍未完全确认：

- `environment_segment` 是辅助字段，还是信息化环境树的正式层级。

验证结果：

- `git diff --check` 通过。

## 2026-05-13 Sheet Review 1.0 环境子类口径确认

用户确认 `environment_segment` 为信息化环境维度的正式层级，中文口径为 `环境子类`。

已更新：

- `docs/03-import-etl/core-sheet-business-review.md`
- `docs/06-implementation/open-issues.md`
- `task_plan.md`
- `findings.md`
- `progress.md`

同步结果：

- 第一批核心 Sheet 复核中的 `SR1-UC-001` 已从“仍需用户确认”调整为“已确认，待前端执行”；
- `信息化环境-信息化对象-安全作用域映射` 的关系口径调整为 `信息化环境 -> 环境子类 -> 信息化对象 -> 安全作用域`；
- 统一问题清单新增 `OI-037`，用于后续前端将 `environment_segment` 展示为正式层级“环境子类”；
- `task_plan.md` 中第一批核心 Sheet Review 1.0 的剩余未清事项已标记为完成。

后续动作：

- 下一轮前端修正时，需要同步调整信息化环境维度的树层级、页面文案和 ViewModel 语义；
- 后续提问类似字段问题时，必须同时带出原始 Sheet、原始列位、原始表头 / 含义、系统字段名、当前用途和需要确认的问题。

## 2026-05-13 成熟度分析模块 M0 规划落地

用户要求基于当前 SAPD Wiki 工程文件和外部 PRD `security_maturity_analysis_prd_v0_2.md`，使用 `planning-with-files` 方式规划独立 maturity 模块。

本次只做文档与配置占位，未修改主线业务代码，未新增数据库迁移，未实现评分代码、图表代码或 UI。

已新增文档：

- `docs/08-maturity/requirements.md`
- `docs/08-maturity/data-model.md`
- `docs/08-maturity/scoring-rules.md`
- `docs/08-maturity/template-design.md`
- `docs/08-maturity/implementation-plan.md`

已新增配置：

- `config/maturity/maturity-levels.yaml`
- `config/maturity/aspect-weights-v1.yaml`
- `config/maturity/scoring-rules-v1.yaml`
- `config/maturity/matching-keywords-v1.yaml`
- `config/maturity/template-schema-v1.yaml`
- `config/maturity/report-template-v1.yaml`

已更新：

- `task_plan.md`：新增 maturity 模块 M0-M5 分阶段计划，标记 M0 完成；
- `README.md`：新增 maturity 模块能力说明、文档入口和 CLI 命令占位；
- `findings.md`：记录 maturity 模块边界为独立运行数据模型，不写入 `knowledge_items`；
- `progress.md`：记录本次新增内容和验证结果。

关键设计结论：

- maturity 是 SAPD Wiki 主工程下的独立模块；
- 评估运行数据后续使用 `maturity_*` 专用表；
- 成熟度评分主轴只读引用现有 `capability_category`、`capability_domain`、`capability`、`capability_focus`；
- V1 推荐先做 CLI + Excel 模板 + JSON/Markdown/HTML 报告闭环；
- V1 不做完整前端，V1.1/M5 再接入页面；
- 客户输入、报告和审查表默认写入本地 `data/maturity/`，不提交 GitHub；
- 初始 raw sample 按一个 Word、一个 PPTX 和一个 XLSX 准备，建议后续放在本地 `data/raw-samples/maturity/`。

验证结果：

- `git diff --check` 通过；
- 使用 Ruby YAML 解析器验证 `config/maturity/*.yaml` 全部可读取。

下一步建议：

1. 用户确认 L0-L5 等级、三维模型、V1 先 CLI 不做 UI 的默认口径。
2. 准备 maturity 样例文件：一个 Word、一个 PPTX、一个 XLSX，放入本地 `data/raw-samples/maturity/`。
3. 进入 M1 时，再新增 `maturity_*` 数据库迁移和 `maturity-template` CLI，不改 `knowledge_items`。

## 2026-05-13 Sheet Review 1.1 第一批核心 Sheet 修正落地与回归

本轮按用户已确认的第一批核心 Sheet 业务口径执行修正落地，不进入第二批 / 第三批 Sheet 复核，不进入正式 Phase 7。

执行内容：

- 备份当前本地数据库到 `data/database/backups/sapd_wiki-before-sheet-review-1-1-20260513.sqlite3`；
- 重新执行核心 Sheet staging，import job 为 `e5bef425-c8f9-43bb-b6a8-1a7508ed6c4b`；
- approve 本轮 staging 数据；
- 重新导出：
  - `frontend/capability-browser/public/data/capability-tree.json`
  - `frontend/capability-browser/public/data/management-knowledge.json`
- 确认 `I-PE 物理环境` 已进入 `management-knowledge.json` 的 `scope_types`；
- 确认 `security_technical_measures` 当前为 29 条，其中 10 条为 `pending`；
- 保持 `/` 为无适用服务，不生成安全技术服务和安全技术措施；
- 保持 G 列模块 / 措施分流口径。

前端修正：

- 用户可见的 `能力维度` 已调整为 `安全能力映射`；
- `frontend/capability-browser/README.md` 中的页面说明同步改为 `安全能力映射`；
- `专项知识维护 > 作用域清单` 主表调整为 `序号 / 情景 / 作用域编码 / 作用域名称 / 描述`，不再显示派生 `作用域类型` 和 `状态`；
- 信息化环境树调整为 `信息化环境 -> 环境子类 -> 信息化对象`，对象映射继续表达对象到安全作用域、服务、模块 / 措施的关系；
- 能力映射和信息化环境映射中的 `技术模块/措施` 已显式标签区分 `安全技术模块`、`安全技术措施`、`说明类 / 待确认`；
- 通用 `状态` 主列和 `待补充` 摘要统计已从专项维护主展示区移除；
- 来源证据仍只进入折叠区，不进入主表。

统一问题清单更新：

- `OI-019`：标记为已修复，记录 `I-PE` 重导入和作用域清单字段收敛；
- `OI-033`：标记为已修复，记录模块 / 措施 / 说明类标签展示；
- `OI-035`：标记为已修复，记录派生状态和待补充摘要收敛；
- `OI-036`：标记为已修复，记录 `安全能力映射` 命名调整；
- `OI-037`：标记为已修复，记录 `环境子类` 四层关系中的正式层级展示。

验证结果：

- `python3 -m py_compile src/sapd_wiki/exports.py` 通过；
- `node --check frontend/capability-browser/dataClient.js` 通过；
- `node --check frontend/capability-browser/viewModels.js` 通过；
- `node --check frontend/capability-browser/app.js` 通过；
- `node --check frontend/capability-browser/components/*.js` 通过；
- `git diff --check` 通过；
- Playwright 页面切换回归通过，覆盖 `总览`、`安全能力映射`、`信息化环境维度`、`专项知识维护 > 作用域清单`、`专项知识维护 > 安全技术措施清单`，无控制台错误。

待用户复核：

- 页面实际浏览时确认 `作用域清单` 的字段顺序是否完全贴合原表核对习惯；
- 页面实际浏览时确认 `信息化环境 -> 环境子类 -> 信息化对象` 的展开方式是否适合后续排查。

## 2026-05-13 Markdown 文档语言规则更新

用户要求后续所有 `.md` 文件中使用中文描述。

已更新：

- `AGENTS.md`
- `progress.md`

规则：

- 后续所有 Markdown 文档中的说明性描述默认使用中文；
- 代码标识、文件名、命令、字段名、对象 `type`、API 路径等保留英文原文；
- 本规则适用于后续新增和修改的 `.md` 文件。

## 2026-05-13 成熟度模块第一轮样本驱动建模

用户要求基于当前 SAPD Wiki 工程、maturity 模块 PRD 和本地 sample 文件，完成成熟度模块的数据建模和输入模板分析。

本轮只做样本分析、领域建模、数据模型和字段映射配置，未修改主工程核心 schema，未实现评分算法，未做前端页面。

样例文件：

- `data/raw-samples/maturity/sample文档介绍.docx`
- `data/raw-samples/maturity/samle 使用教程.pptx`
- `data/raw-samples/maturity/sample 评分表.xlsx`

已新增：

- `docs/08-maturity/sample-analysis.md`
- `docs/08-maturity/maturity-domain-model.md`
- `docs/08-maturity/maturity-data-model.md`
- `docs/08-maturity/maturity-template-mapping.md`
- `config/maturity/field-mapping.sample.yaml`

样本分析结论：

- `sample 评分表.xlsx` 是本轮主样本，包含 `成熟度级别`、`成熟度分级描述`、`成熟度评分`、`成熟度视图`、`成熟度分级描述 (2)` 5 个 Sheet；
- 当前 XLSX 不是完整客户输入模板，而是“成熟度模型定义 + 手工评分表 + 汇总视图”的混合工作簿；
- `成熟度分级描述` 包含 3 个能力分类、10 个 L1 高阶战略能力、32 个 L2 安全能力、84 个能力关注点、7 个作用域和 145 条技术服务 / 实践项；
- `成熟度评分` 中识别到 137 条明细评分行、31 条关注点小计行、30 条 L2 小计行、9 条 L1 小计行；
- 明细评分行的一行代表“能力关注点 × 作用域 / 技术服务实践项 × 四类评分要素”；
- 样例中的直接评分字段为 `组织角色`、`制度流程`、`平台工具`、`数据信息`；
- 当前样例评分值只出现 2 和 3，但正式模板仍应支持 1-5；
- Word 样例主要提供模型概念、能力等级、能力要素、评估流程和计分方式；
- PPT 样例主要提供工具使用流程、交付场景、报告视图和培训说明；
- 第一轮样本建模建议优先采用四要素口径：组织与角色、制度与流程、平台与工具、数据与信息；
- 客户评估数据继续明确不进入 `knowledge_items`，后续进入 maturity 专用模型。

模型建议：

- 新增领域对象：`assessment_project`、`assessment_source_file`、`assessment_input_raw`、`assessment_input_normalized`、`maturity_match_result`、`maturity_score_result`、`maturity_gap_item`、`maturity_recommendation`、`maturity_report_snapshot`；
- 正式模板应补齐当前样例缺少的 `Assessment_Info`、`Evidence_List`、`Manual_Adjustment`；
- 正式模板中应显式填充每行能力路径和评分字段，避免继续依赖合并单元格；
- Excel 小计公式只作为样例兼容参考，后续系统应重新计算并记录规则版本。

验证结果：

- `config/maturity/*.yaml` 全部通过 Ruby YAML 解析；
- `git diff --check` 通过。

下一步建议：

1. 用户确认 maturity 正式模型是否采用“四要素评分口径”，即组织与角色、制度与流程、平台与工具、数据与信息。
2. 基于 `maturity-template-mapping.md` 设计正式 `Score_Input` 模板字段。
3. 进入下一轮时再考虑 M1：创建 `maturity_*` 迁移和模板生成 CLI，但仍不得把客户评估数据写入 `knowledge_items`。

## 2026-05-13 成熟度评分表样例更新后重分析

用户更新了 `data/raw-samples/maturity/sample 评分表.xlsx`，要求基于新原始表继续成熟度模块建模。

本次只重新分析新版 XLSX 并修订 maturity 文档与字段映射配置，未修改主工程核心 schema，未实现评分算法，未做前端页面。

新版 XLSX 结构：

- `成熟度级别`
- `成熟度分级描述`

关键变化：

- 旧版中的 `成熟度评分`、`成熟度视图`、`成熟度分级描述 (2)` 已不存在；
- 新版 XLSX 从“模型定义 + 手工评分 + 汇总视图”变为“成熟度模型基准表”；
- 新版 XLSX 不包含客户评分输入、项目字段、客户字段、证据字段、人工调整字段或汇总公式；
- 新版 XLSX 不能直接生成客户成熟度评分结果，只能用于生成参考能力清单和分级判定标准。

重新统计结果：

- `成熟度分级描述` 包含 3 个能力分类、10 个 L1 高阶战略能力、32 个 L2 安全能力、84 个能力关注点、7 个作用域、145 条技术服务 / 实践项；
- 只有 30 个关注点含任一专属 L1-L5 分级描述；
- L1-L5 专属描述覆盖情况分别为：L1 28 条、L2 29 条、L3 29 条、L4 28 条、L5 19 条；
- 作用域枚举仍包括 `I-DI 数据`、`I-NT 网络`、`I-AP 软件应用`、`I-OS 操作系统`、`I-HD 硬件`、`I-PE 物理环境`、`I_US 用户`。

已更新：

- `docs/08-maturity/sample-analysis.md`
- `docs/08-maturity/maturity-template-mapping.md`
- `docs/08-maturity/maturity-domain-model.md`
- `docs/08-maturity/maturity-data-model.md`
- `config/maturity/field-mapping.sample.yaml`
- `progress.md`

建模修正：

- 将 `sample 评分表.xlsx` 明确定位为 `model_reference_only`；
- 后续正式模板必须新增 `Score_Input`，用于客户现状和四要素评分输入；
- 新版样例字段映射只保留 `成熟度级别` 和 `成熟度分级描述`；
- `Reference_Level_Criteria` 应由新版 `成熟度分级描述` 生成；
- 客户评估数据继续只进入 maturity 专用模型，不进入 `knowledge_items`。

验证结果：

- `config/maturity/*.yaml` 全部通过 Ruby YAML 解析；
- `git diff --check` 通过。

下一步建议：

1. 基于新版模型基准表，设计正式 `Score_Input` Sheet。
2. 确认 `I_US 用户` 是否需要统一为主工程作用域编码。
3. 进入 M1 前，先决定是否把模型基准也落入 maturity 专用表，还是先只用 YAML / JSON 生成参考 Sheet。

## 2026-05-13 成熟度模块接入 Review 落地

用户提供外部 ChatGPT review 文件 `sapd-maturity-module-integration-review-request.md`，要求主控 Agent 判断是否需要整体架构 review、文件合并或主工程文件结构优化。

本轮结论：

- 应做成熟度模块接入 review；
- 不做全工程文件结构重构；
- 不合并 `task_plan.md`、`findings.md`、`progress.md`；
- 不新增重复的 `docs/08-maturity-assessment/`；
- 沿用现有 `docs/08-maturity/` 和 `config/maturity/`；
- 当前只补架构入口、数据治理边界和本地敏感数据忽略规则；
- 不修改数据库 schema，不改前端，不实现 maturity 代码。

已新增：

- `docs/08-maturity/module-integration-review.md`

已更新：

- `docs/01-architecture/architecture.md`：新增“成熟度分析模块”边界，明确只读复用主知识库、运行数据使用 `maturity_*`，前端页面后置；
- `docs/07-governance/data-governance.md`：新增成熟度评估数据治理规则，明确客户输入、证据、评分、报告默认不提交 GitHub，人工审查优先；
- `.gitignore`：新增 `data/maturity/`；
- `README.md`：补充 `module-integration-review.md` 文档入口；
- `findings.md`：记录成熟度模块接入方式的关键结论；
- `progress.md`：记录本轮执行结果。

后续建议：

1. 用户确认 maturity M1 前的关键问题：L0-L5、V1 Excel 模板、低置信度人工审查、CLI + HTML/Markdown/JSON 先行。
2. 继续当前主线：第二批管理 / 流程 / 职能 / 岗位 Sheet 业务含义复核。
3. 等主线允许新增迁移和 CLI 子命令时，再进入 maturity M1。

## 2026-05-13 Mainline Integration Check 1.0 主工程与 maturity 集成边界校准

用户要求结合外部 ChatGPT 建议，执行主工程与 maturity 模块集成边界校准。本轮只做边界检查，不做 maturity 功能开发。

范围控制：

- 未修改 `frontend/`；
- 未修改 `src/`；
- 未修改 ETL/export；
- 未修改 SQLite schema；
- 未新增 `maturity_*` 表；
- 未实现 maturity 评分逻辑；
- 未实现 maturity 前端页面；
- 未进入 maturity M1；
- 未打断当前 Sheet 复核主线。

已新增：

- `docs/08-maturity/mainline-integration-check.md`

已更新：

- `docs/02-data-model/data-model.md`：补充 maturity 数据模型边界，明确客户输入、证据、评分和报告不进入 `knowledge_item`；
- `docs/01-architecture/backend-interface-design.md`：补充 maturity service 后端边界，明确未来使用独立 `/api/v1/maturity/*` 语义，前端不负责匹配评分；
- `task_plan.md`：补充 maturity M1 进入条件；
- `findings.md`：记录主工程与 maturity 集成边界结论；
- `progress.md`：记录本轮执行结果。

核心结论：

- 主工程已具备承接 maturity 的基本边界；
- maturity 是 SAPD Wiki 主工程子模块；
- maturity 只读复用主工程的安全能力、作用域、服务、模块 / 措施、流程、职能等知识对象；
- maturity 客户输入、证据、匹配候选、评分和报告不进入 `knowledge_items`；
- maturity 运行数据后续使用 `maturity_*` 专用表或 `data/maturity/` 本地运行文件；
- 客户评估输入、证据和报告默认不提交 GitHub；
- 当前不建议立即启动 M1。

M1 前还缺：

- 用户确认 L0-L5 成熟度等级；
- 用户确认 V1 只以 Excel 评估模板作为主输入；
- 用户确认 Word / PPTX 只作为证据和报告风格参考；
- 用户确认 V1 先 CLI + JSON/Markdown/HTML 报告，不做完整前端；
- 用户准备 maturity 样例文件路径；
- 主控确认新增 `maturity_*` 迁移和 CLI 子命令不会打断当前 Sheet 复核主线。

当前主线：

- 保持不变，继续“已导入 Sheet 的业务含义复核 + 前端关系展示校正”；
- 下一优先工作仍建议为第二批管理 / 流程 / 职能 / 岗位 Sheet 业务含义复核。

## 2026-05-13 Sheet Review 2.0 第二批管理 / 流程 / 职能 / 岗位 Sheet 业务含义复核

用户要求继续主工程当前主线，复核第二批管理、流程、职能、岗位相关 Sheet。本轮只做业务含义复核和问题归属判断，不做开发。

范围控制：

- 未修改 `frontend/`；
- 未修改 `src/`；
- 未修改 ETL/export；
- 未修改 SQLite schema；
- 未修改 `management-knowledge.json`；
- 未启动 maturity M1；
- 未进入 Step 7；
- 未做安全开发维度、数据生命周期维度、多格式增强或视觉 polish；
- 未自动修复原始数据。

已新增：

- `docs/03-import-etl/second-batch-business-review.md`

已更新：

- `task_plan.md`：将当前状态更新为第二批复核待用户确认，并在下一主线中记录 Sheet Review 2.0 草案已完成；
- `findings.md`：记录第二批复核的关键未决判断；
- `progress.md`：记录本轮执行结果。

已复核 Sheet：

1. `安全能力-安全工作`
2. `安全能力-安全管理元素（high level）`
3. `安全职能流程清单（完善L4）`
4. `安全工作职能清单`
5. `Gartner 工作岗位参考`

本轮结论：

- 5 张 Sheet 的基础业务含义、主对象、关系方向和当前前端归属已经可以形成草案；
- `安全职能流程清单`、`Gartner 工作岗位参考` 的边界相对清楚；
- `安全能力-安全工作`、`安全能力-安全管理元素（high level）`、`安全工作职能清单` 仍有业务边界需要用户确认；
- 当前不建议直接进入前端或 ETL 修正，应先完成用户确认。

待用户确认问题：

1. `安全工作` 是否需要独立编码并跨关注点复用；
2. `一个能力 -> 一个 L2 流程组` 是否为严格业务约束；
3. `安全工作` 与 `安全职能` 是否存在直接关系；
4. 同名 L3 流程是否允许出现在不同 L2 流程组下；
5. GB/T 42446 引用是否只在“标准与岗位参考”主展示；
6. Gartner 岗位参考是否后续需要与内部安全职能做人工映射。

## 2026-05-13 Sheet Review 2.0 二次确认落地

用户逐项回复了第二批管理 / 流程 / 职能 / 岗位 Sheet 的待确认问题，并明确本线程除非主动提到成熟度模块，否则不再考虑 maturity。

已完成：

- 更新 `docs/03-import-etl/second-batch-business-review.md`，将 Sheet Review 2.0 从“待确认草案”改为“业务口径确认版”。
- 更新 `docs/03-import-etl/second-batch-data-contract.md`，同步安全工作独立编码、独立页面、L2 能力到 L2 流程组严格约束、Gartner 候选映射等口径。
- 更新 `task_plan.md`，将第二批 5 张 Sheet 复核标记为已确认，并新增“第二批修正落地”待办。
- 更新 `findings.md`，记录第二批复核的最新关键结论。

确认结论：

- `安全能力-安全工作`：安全工作独立编码，并在专项知识维护中独立页面展示；关注点与安全工作为 1:1 或 1:N。
- `安全能力-安全管理元素（high level）`：L2 安全能力到 L2 流程组为严格约束；组织职能相关方分为决策层、管理层、执行层和监督层；每个 L2 安全能力 - L2 流程组组合可关联 1 个、多个或 `/` 无相关职能。
- `安全职能流程清单（完善L4）`：同名 L3 流程原则上不会跨 L2 流程组；如出现需输出具体数据给用户检查。
- `安全工作职能清单`：安全工作与安全职能不存在直接关系，只能通过其他数据间接关联；GB/T 引用需要与安全职能清单建立双向映射展示并输出复核。当前已有安全职能 -> GB/T 的单向映射基础，后续需要支持从 GB/T 反查安全职能。
- `Gartner 工作岗位参考`：与安全职能清单自动生成双向候选映射，用户检查后确认。

仍需二次输出核对：

- 安全工作独立编码缺失、重复或冲突清单。
- 单一 L2 安全能力对应多个 L2 流程组的异常清单。
- 同名 L3 流程出现在不同 L2 流程组下的具体数据。
- GB/T 与安全职能清单的双向映射结果。
- Gartner 与安全职能清单的双向候选映射结果。

范围控制：

- 未修改前端代码；
- 未修改 ETL 代码；
- 未修改数据库 schema；
- 未进入第三批生命周期复核；
- 未进入正式 Phase 7；
- 未处理 maturity 模块。

## 2026-05-13 Sheet Review 2.1 第二批落地前数据核对清单

用户补充确认：原“标准与岗位参考”页面后续应改名为“岗位参考页面”，下面分为 `GB/T 42446-2023` 和 `Gartner 工作岗位参考` 两个页签；GB/T 与 Gartner 和安全职能的映射需要支持双向展示 / 查询，其中 GB/T 当前已有安全职能到 GB/T 的单向映射基础。

本轮目标是生成落地前核对清单，不自动修复数据，不修改前端，不修改 ETL，不修改原始 Excel，不修改 SQLite schema。

已新增：

- `docs/06-implementation/sheet-review-2-1-data-check.md`
- `data/exports/worker-verify/sheet-review-2-1-security-work-code-check.csv`
- `data/exports/worker-verify/sheet-review-2-1-l2-process-group-constraint.csv`
- `data/exports/worker-verify/sheet-review-2-1-l3-cross-process-group-check.csv`
- `data/exports/worker-verify/sheet-review-2-1-gbt-to-work-function-review.csv`
- `data/exports/worker-verify/sheet-review-2-1-gartner-to-work-function-candidates.csv`

检查结果：

- 安全工作编码检查：80 条安全工作记录，80 条缺少独立安全工作编码。原始表当前没有独立安全工作编码列，本轮不自动生成编码。
- L2 安全能力 -> L2 流程组严格约束检查：未发现违反约束记录。
- 同名 L3 流程跨 L2 流程组检查：发现 3 条异常，均涉及 `安全职能流程清单（完善L4）` 中开发安全相关 L3 流程疑似因 L2 流程组空白继承到 `身份访问管理运营流程组`。
- GB/T -> 安全职能反向映射：生成 27 条 GB/T 任务参考核对记录，25 条有映射，2 条未映射。
- Gartner -> 安全职能候选映射：生成 28 条岗位参考候选映射记录，28 条有候选，0 条未匹配，20 条候选范围偏宽，需要重点复核。

需用户确认：

- 是否在原始表为 80 条安全工作补充独立编码；
- 3 条同名 L3 跨 L2 流程组异常是否为原始数据空白/归属错误；
- 2 条未映射 GB/T 引用任务是否需要补充安全职能映射；
- Gartner 候选映射中哪些接受、删除或调整；
- 后续前端是否按“岗位参考页面 > GB/T / Gartner”落地页面命名。

验证：

- `git diff --check` 通过。

用户随后补充确认：

- 安全工作需要独立编码，编码参考能力关注点，可增加部分简写；
- “岗位参考页面”命名确认，下面分为 `GB/T 42446-2023` 和 `Gartner 工作岗位参考` 两个页签。

用户继续确认：

- L3 流程异常已在原始表修复，且同步修订了该表部分其他错误；
- GB/T 未映射的 2 条已添加到原始数据表；
- Gartner 映射先按当前候选结果执行，页面格式先做好，后续单独校对。

已新增：

- `docs/06-implementation/open-issues.md` 中新增 `OI-038`，用于跟踪 Gartner 与安全职能候选映射后续人工校对。

下一步：

- 进入 `Sheet Review 2.2：第二批数据修正落地`，先复导用户已修订的原始 Excel，再生成安全工作建议编码清单，并落地岗位参考页面命名 / 页签 / Gartner 候选映射待复核状态。

## 2026-05-13 Sheet Review 2.2A / 2.2B 并行调度与主控接管

本轮尝试按 fan-out / fan-in 方式并行推进第二批数据修正落地：

- `Dewey`：ETL/export Agent，实际 agent id 为 `019e2191-e54e-7712-9a94-acb1dee54c3a`；
- `Singer`：Data QA / Contract Agent，实际 agent id 为 `019e219e-653c-71f0-a612-4b422653bd7d`；
- `Plato`：Frontend Agent，因当前子 Agent 线程上限暂未启动。

调度情况：

- 第一次尝试同时启动 3 个子 Agent 时，工具返回 `agent thread limit reached`，只成功启动 Dewey。
- Dewey 完成后已关闭。
- Singer 启动后多次等待超时，未返回结果；为避免任务悬空，主控 Agent 已关闭 Singer，并接管 `Sheet Review 2.2B` 数据核对。
- 后续需要改进主控调度节奏：启动、等待超时、完成、关闭四个节点都必须主动反馈，并记录 agent id。

Dewey 2.2A 输出摘要：

- 使用 `data/exports/worker-verify/sheet-review-2-2a.sqlite3` 副本复导第二批数据；
- 重新生成 `frontend/capability-browser/public/data/management-knowledge.json`；
- `security_work=80`，`maps_to_work=80`；
- `process_group=33`，`process_reference=87`；
- `work_function_layers=4`，`work_functions=86`；
- `gbt_42446_references=27`，其中仍有 2 条未映射；
- `gartner_roles=28`；
- `security_technical_measures=29`；
- 第一批核心 Sheet active item / relation 计数未发现破坏；
- `/` 规则仍生效。

主控接管 2.2B 后新增：

- `docs/06-implementation/sheet-review-2-2-data-check.md`
- `data/exports/worker-verify/sheet-review-2-2-security-work-code-suggestions.csv`
- `data/exports/worker-verify/sheet-review-2-2-l2-process-group-constraint.csv`
- `data/exports/worker-verify/sheet-review-2-2-l3-cross-process-group-check.csv`
- `data/exports/worker-verify/sheet-review-2-2-gbt-to-work-function-review.csv`
- `data/exports/worker-verify/sheet-review-2-2-gartner-to-work-function-candidates.csv`
- `data/exports/worker-verify/sheet-review-2-2-data-check-summary.json`

2.2B 检查结果：

- 安全工作编码：80 条安全工作均缺少正式独立编码；已按 `SW-关注点编码-序号` 生成建议编码，仅供用户核对，不写入正式数据。
- L2 安全能力 -> L2 流程组严格约束：未发现违反约束记录。
- 同名 L3 跨 L2 流程组：仍发现 2 条，分别为 `安全日志审计流程`、`安全日志持续管理流程`，涉及 `日志管理与审计流程` / `日志管理与审计流程组` 命名差异。
- GB/T 反向映射：27 条任务参考中仍有 2 条未映射，分别为 `网络安全建设-密码技术应用`、`网络安全建设-网络数据安全保护`。
- Gartner 候选映射：28 条，全部标记为 `pending_user_review`；其中 20 条为过宽候选，后续单独校验。

验证：

- `git diff --check` 通过。

下一步：

- 先由用户确认 2.2B 报告中的安全工作建议编码、2 条 L3 命名差异、2 条 GB/T 未映射；
- 再启动或由主控执行 `Sheet Review 2.2C` 前端接收准备：安全工作清单、岗位参考页面、GB/T / Gartner 页签、Gartner 候选映射待复核状态。

用户随后说明 `安全日志持续管理流程组` 相关原始数据已修正，并指出 GB/T 两条原始映射也已经处理过。

复验处理：

- 直接读取 `data/raw-samples/wiki sample.xlsx`：
  - `安全职能流程清单（完善L4）` 第 23 行为 `日志管理与审计流程组` / `安全日志持续管理流程`；
  - `安全能力-安全管理元素（high level）` 第 23 行也为 `日志管理与审计流程组` / `安全日志持续管理流程`。
- 使用新的 worker-verify 副本 `data/exports/worker-verify/sheet-review-2-2b-verify.sqlite3` 重新 stage + approve 第二批 Sheet；
- 使用该副本重新导出 `frontend/capability-browser/public/data/management-knowledge.json`；
- 更新 `docs/06-implementation/sheet-review-2-2-data-check.md` 和相关 2.2 核对 CSV。

复验结果：

- 同名 L3 跨 L2 流程组：0 条；
- GB/T 未映射：0 条；
- `process_groups=32`；
- `process_references=85`；
- `gbt_42446_references=27`；
- `maps_to_gbt_task=32`；
- `security_technical_measures=29`。

当前剩余需确认：

- 80 条安全工作建议编码是否采用 `SW-关注点编码-序号` 作为正式编码规则；
- Gartner 候选映射仍按 `pending_user_review` 展示，后续单独校对。

验证：

- `git diff --check` 通过。

## 2026-05-13 子 Agent 调度规则固化

用户要求固定子 Agent 管理规则，避免再次出现“以为无响应 / 实际还在跑 / 线程上限”的混乱。

已更新：

- `AGENTS.md` 新增“子 Agent 调度规则”。

规则摘要：

- 每次启动子 Agent 后，必须立刻在 `progress.md` 记录 agent id、角色、任务、状态和启动时间；
- 子 Agent 等待超时、完成或异常关闭时，必须主动反馈；
- 子 Agent 完成后，主控 Agent 必须及时汇总并主动 `close_agent`；
- 子 Agent 卡住或多次等待超时后，主控 Agent 应关闭并说明后续处理方式；
- 多 Agent 不得修改同一文件，跨域问题只记录并交由主控汇总。

接下来的主线：

1. 用户确认安全工作正式编码规则是否采用 `SW-关注点编码-序号`。
2. 执行 `Sheet Review 2.2C` 前端接入准备：
   - 新增 / 完善 `专项知识维护 > 安全工作清单`；
   - 将 `标准与岗位参考` 用户可见名称调整为 `岗位参考页面`；
   - 增加 `GB/T 42446-2023` 与 `Gartner 工作岗位参考` 两个页签；
   - Gartner 候选映射只显示为 `待复核`，不作为正式关系；
   - 非业务字段仍只进入来源证据折叠区。
3. 完成 2.2C 后做主控 fan-in 回归，确认是否可以进入 `Sheet Review 2.3`。

## 2026-05-13 Sheet Review 2.2C 前端子 Agent 启动

用户确认：

- 80 条安全工作正式编码规则采用 `SW-关注点编码-序号`；
- 执行 `Sheet Review 2.2C` 前端接入；
- 执行 2.2 fan-in 回归。

已启动子 Agent：

- 角色：`Plato` / Frontend Worker Agent；
- 实际 agent id：`019e21ce-066f-7262-b928-a781f9b70541`；
- 状态：运行中；
- 任务：接入 `专项知识维护 > 安全工作清单`，将 `标准与岗位参考` 用户可见名调整为 `岗位参考页面`，增加 `GB/T 42446-2023` 与 `Gartner 工作岗位参考` 页签，并确保 Gartner 候选映射显示为 `待复核`；
- 写入范围：仅 `frontend/capability-browser/`；
- 禁止范围：`src/`、`docs/`、`public/data/*.json`、SQLite schema、maturity 相关文件。

子 Agent 完成与关闭：

- `019e21d4-a610-78d2-ae1b-73c3c1d07da5` 已完成并已关闭，线程名额已释放。

2.2C 完成结果：

- 前端修改集中在：
  - `frontend/capability-browser/app.js`
  - `frontend/capability-browser/dataClient.js`
  - `frontend/capability-browser/index.html`
  - `frontend/capability-browser/styles.css`
  - `frontend/capability-browser/viewModels.js`
  - `frontend/capability-browser/components/MaintenanceShell.js`
  - `frontend/capability-browser/components/StandardRoleReferenceTable.js`
- `专项知识维护` 已接入 `安全工作清单`，ViewModel 回归显示 80 条安全工作。
- 安全工作编码按 `SW-关注点编码-序号` 展示，首条示例为 `SW-T-AS.AD-01-01`。
- `标准与岗位参考` 用户可见名已统一调整为 `岗位参考页面`。
- `岗位参考页面` 已拆为：
  - `GB/T 42446-2023`，27 条；
  - `Gartner 工作岗位参考`，28 条。
- Gartner 候选映射显示为 `待复核`，不作为正式关系。
- 主控补充修正：来源证据不再夹带在主表 row 中，主展示 row 不包含 `source_sheet`、`source_row`、`raw_value`、`generated_at` 等非业务字段。

主控回归：

- `node --check frontend/capability-browser/dataClient.js` 通过；
- `node --check frontend/capability-browser/viewModels.js` 通过；
- `node --check frontend/capability-browser/app.js` 通过；
- `node --check frontend/capability-browser/components/*.js` 通过；
- `git diff --check` 通过；
- ViewModel 数据校验：
  - 安全工作清单：80 条；
  - GB/T 页签：27 条；
  - Gartner 页签：28 条；
  - Gartner 状态：`待复核`；
  - 主表 row 来源字段泄露：未发现。

任务状态：

- `task_plan.md` 已将第二批修正落地标记为完成。
- `OI-038` 保留为 Gartner 候选映射后续人工校对任务，但页面待复核展示已完成。

## 2026-05-13 修复 impeccable skill 项目内可用性

用户要求先解决 `impeccable` skill 不能正常使用的问题，后续前端设计统一使用该 skill。

问题原因：

- `impeccable` skill 本体存在于 `/Users/kim1st/Documents/kim note/10_agent_system/01 Codex/CodexSkill/impeccable`；
- 项目根目录缺少 `.agents/skills/impeccable` 入口；
- 项目根目录缺少 `PRODUCT.md` 和 `DESIGN.md`，导致 `impeccable` 的上下文 loader 无法按项目预期读取产品与设计上下文。

已处理：

- 新增 `PRODUCT.md`，记录 SAPD Wiki 的产品定位、用户、语气、设计反模式和战略原则；
- 新增 `DESIGN.md`，记录关系工作台的布局、视觉语言、组件、字段边界和当前前端架构；
- 在 `.gitignore` 中忽略 `.agents/skills/`，避免提交本机 skill symlink；
- 创建本机 symlink：`.agents/skills/impeccable -> /Users/kim1st/Documents/kim note/10_agent_system/01 Codex/CodexSkill/impeccable`；
- 更新 `AGENTS.md`，明确后续前端设计、重构、视觉评审、信息架构和交互优化默认使用 `impeccable`，并先运行 `node .agents/skills/impeccable/scripts/load-context.mjs`。

验证：

- `node .agents/skills/impeccable/scripts/load-context.mjs` 通过；
- loader 输出 `hasProduct=true`、`hasDesign=true`；
- `productPath=PRODUCT.md`；
- `designPath=DESIGN.md`；
- `.agents/skills/` 被 `.gitignore` 忽略，不会污染 GitHub。

## 2026-05-13 Sheet Review 2.3 子 Agent 启动：Data QA

已启动子 Agent：

- 角色：Sheet Review 2.3 Data QA Agent；
- 实际 agent id：`019e21fe-9b4e-7c51-afce-76987748b309`；
- 状态：运行中；
- 任务：只读第三批 LC-AP Sheet，输出字段、对象、关系、异常清单；
- 写入范围：`data/exports/worker-verify/sheet-review-2-3-lcap-*.csv/json/md`；
- 禁止范围：`frontend/`、`src/sapd_wiki/`、ETL/export、SQLite schema、原始 Excel、正式 docs 文档、maturity 相关文件。

尝试启动第二个 `Sheet Review 2.3 Contract Agent` 时，工具返回 `agent thread limit reached`。

处理方式：

- 不继续强行启动新线程；
- 先等待 Data QA Agent 完成并关闭释放线程；
- Contract 报告由主控 Agent 接管，或在释放线程后再启动 Contract Agent。

用户指出：前端工作此前已切换为 `impeccable` skill，不应再按 `frontend-design` 口径执行。

处理：

- 主控确认本轮前端任务虽然是功能接入而非视觉重构，但涉及页面组织和信息架构，应遵循 `impeccable` 的产品 UI 治理口径；
- 已关闭前端子 Agent `019e21ce-066f-7262-b928-a781f9b70541`，避免其继续按不一致的前端 skill 方向执行；
- 后续若继续使用子 Agent，应重新以 `impeccable` 口径启动，并继续遵守 agent id 记录和完成后主动关闭规则。

已重新启动前端子 Agent：

- 角色：`Plato` / Frontend Worker Agent；
- 实际 agent id：`019e21d4-a610-78d2-ae1b-73c3c1d07da5`；
- 状态：运行中；
- 任务：按 `impeccable` 产品 UI 口径执行 `Sheet Review 2.2C`，接入安全工作清单、岗位参考页面、GB/T / Gartner 页签和 Gartner 待复核状态；
- preflight 说明：当前仓库没有 `.agents/skills/impeccable/scripts/load-context.mjs`，也没有 `PRODUCT.md / DESIGN.md`，完整 impeccable preflight 无法运行；本轮为功能接入而非视觉重构，因此按 impeccable 产品 UI 原则降级执行；
- 写入范围：仅 `frontend/capability-browser/`；
- 禁止范围：`src/`、`docs/`、`public/data/*.json`、SQLite schema、maturity 相关文件。

## 2026-05-13 Sheet Review 2.3：LC-AP 生命周期相关 Sheet 复核草案

任务：执行第三批 LC-AP / LC-DT 生命周期相关 Sheet 的业务语义复核，只做只读分析和报告，不改前端、不改 ETL、不进入 Step 7。

子 Agent 状态：

- `019e21fe-9b4e-7c51-afce-76987748b309`，角色：Data QA Agent，任务：只读检查第三批 LC-AP / LC-DT Sheet 字段、对象、关系和异常清单，状态：已完成并关闭。
- Contract Agent：启动失败，原因：当前达到 agent thread limit；由主控 Agent 根据 Data QA 输出完成复核报告整理。

新增文件：

- `docs/06-implementation/sheet-review-2-3-lcap-business-review.md`
- `data/exports/worker-verify/sheet-review-2-3-lcap-field-check.csv`
- `data/exports/worker-verify/sheet-review-2-3-lcap-relation-check.csv`
- `data/exports/worker-verify/sheet-review-2-3-lcap-data-qa-summary.json`

更新文件：

- `task_plan.md`
- `findings.md`
- `progress.md`

复核结果：

- 第三批实际 Sheet 为 `LC-DT 数据生命周期`、`LC-DT 数据生命周期场景目录`、`LC-AP 应用安全开发生命周期`、`LC-AP 应用安全开发生命周期元素目录`。
- `LC-AP 应用安全开发生命周期` 是安全开发维度核心来源，但开发技术服务、主要活动、产品示例和元素目录重复列仍需用户确认。
- `LC-DT` 两张表建议后置到数据生命周期维度，不混入安全开发维度主页面。

下一步建议：

- 用户确认 LC-AP 待确认问题后，进入 LC-AP 数据契约设计。
- 当前不生成正式 `lifecycle-knowledge.json`，不进入安全开发维度页面实现。

## 2026-05-13 Agent Thread 清理检查

用户要求暂停启动任何新 Agent，先检查并清理当前 Agent thread 混乱问题。

执行结果：

- 当前工具环境没有可直接执行 UI `/agent` 命令的接口，也没有全局列出所有 Agent thread 的工具。
- 主控改用 `progress.md` 中已记录的 agent id 作为可追踪清单，共识别历史 agent id 9 个。
- 对 9 个历史 agent id 逐个执行 `close_agent`。
- 工具返回均为 `agent ... not found`，说明这些 id 在当前可管理运行时中已不存在，等价于没有可继续关闭的活动 agent。

检查到的历史 agent id：

- `019e1618-b647-7e22-b2d3-640aab3cfb8f`
- `019e1618-b692-7e83-bc4c-7829ef81c985`
- `019e1629-0cf4-7e01-a61d-9b53b3556401`
- `019e163e-4728-7f73-8746-00183d43ece5`
- `019e2191-e54e-7712-9a94-acb1dee54c3a`
- `019e219e-653c-71f0-a612-4b422653bd7d`
- `019e21ce-066f-7262-b928-a781f9b70541`
- `019e21d4-a610-78d2-ae1b-73c3c1d07da5`
- `019e21fe-9b4e-7c51-afce-76987748b309`

释放统计：

- 释放前：按 `progress.md` 历史记录口径为 9 个已知 agent id；按当前工具可管理运行时口径为 0 个可关闭活动 agent。
- 释放后：0 个可关闭活动 agent。

后续约定：

- 本轮最多启动 3 个子 Agent。
- 优先复用已有 agent-id；如需新建，先说明原因。
- 子 Agent 不得再启动子 Agent。
- 每个子 Agent 必须有明确写入范围。
- 只读 Agent 不得修改文件。
- 写入 Agent 不得修改其他 Agent 的文件范围。
- 完成后必须 fan-in，由主控汇总并主动关闭。

## 2026-05-14 Sheet Review 2.3：LC-AP 业务口径补充确认

用户补充并确认了 `LC-AP 应用安全开发生命周期` 的关键业务含义。

已更新：

- `docs/06-implementation/sheet-review-2-3-lcap-business-review.md`

确认内容：

- 软件开发模式 4 个类型的黄色底色表示该开发模式在该阶段需要考虑相关安全活动，后续可考虑用一列展示。
- 阶段是开发过程阶段，即 IT L3 流程；阶段主要活动是 IT L4 流程活动分解，不单独作为知识来源维护。
- 红色底色的“安全活动定义”定义为该阶段需考虑的安全活动。
- 红色底色的“安全活动对应安全策略”定义为安全活动对应安全策略。
- “策略要求表”不是现有独立维护页面，后续统一口径为 LC-AP 数据契约中的“安全策略条目 / 安全策略要求”对象。
- 开发技术服务就是安全技术服务，不建立独立开发技术服务主数据。
- 关联安全技术服务按 `管理类`、`开发类`、`网络空间类` 三类分类。
- 安全技术模块定义为关联安全技术模块，需要到既有 `安全技术模块清单` 进行映射校验。
- 实际产品示例定义为开发类产品组件。
- 潜在安全威胁场景 `/` 直接映射为“无”。
- Google SLSA 可作为补充安全策略来源。
- `LC-AP 应用安全开发生命周期元素目录` 重复数据已处理。

仍待确认：

- 底色是否作为正式 ETL 规则输入；
- 安全活动定义 `/` 是否统一映射为“无安全活动”；
- Google SLSA 补充策略是否全部进入安全策略条目并标记来源；
- 服务分类字段是否命名为 `service_category`；
- 横线分割的服务是否拆分为开发类与网络空间类；
- 安全技术模块无法匹配主数据时，是标记 `待校验` 还是输出为原始数据问题；
- 开发类产品组件是否只在安全开发维度展示；
- 软件开发类型与应用系统类型之间是否存在映射关系。

## 2026-05-14 Sheet Review 2.3：LC-AP 剩余口径关闭

用户进一步确认 LC-AP 剩余业务口径。

已更新：

- `docs/06-implementation/sheet-review-2-3-lcap-business-review.md`

确认内容：

- 黄色底色需要识别，用于判断软件开发模式在阶段中的适用性。
- 红色底色不作为 ETL 识别条件，只需要按用户定义字段正常映射“安全活动定义”和“安全活动对应安全策略”。
- “安全活动定义”中的 `/` 统一映射为“无安全活动”。
- “安全策略条目”当前不做独立知识维护表，可在专项知识维护中预留入口；后续补充 Google SLSA 内容时再启用。
- 关联安全技术服务分类字段可命名为 `service_category`，取值为 `管理类`、`开发类`、`网络空间类`，且目前仅在 LC-AP 表中使用。
- 安全技术服务列中横线分割的上下内容，需要拆分为开发类安全技术服务和网络空间类安全技术服务。
- 关联安全技术模块无法匹配既有 `安全技术模块清单` 时，输出数据问题给用户检查，不静默新增主数据。
- 开发类产品组件只在安全开发维度展示，不进入既有“安全技术模块清单”和通用产品主数据。
- 软件开发类型与应用系统类型没有映射关系，后续在同一页面上下分别展示。

当前剩余实现层问题：

- Google SLSA 补充内容尚未提供，后续需要明确来源文件、字段和导入方式。
- 安全技术模块无法匹配主数据时的数据问题输出格式，需要在 LC-AP 数据契约设计中定义。

## 2026-05-14 LC-AP 数据契约设计

用户要求执行下一步，并明确 SLSA 先不补充。

本轮未启动任何新 Agent，未修改前端、ETL 代码或数据库 schema。

已更新：

- `docs/03-import-etl/third-batch-data-contract.md`
- `docs/03-import-etl/mapping-rules-draft.md`
- `docs/03-import-etl/completed-sheet-business-confirmation.md`
- `docs/02-data-model/data-model.md`
- `docs/02-data-model/field-dictionary-draft.md`
- `docs/01-architecture/api-field-contract.md`
- `task_plan.md`
- `findings.md`
- `progress.md`

契约结论：

- `LC-AP 应用安全开发生命周期` 第一阶段对象包括：应用安全开发阶段、阶段主要活动、安全活动、安全策略条目、软件开发类型、关联安全技术服务、关联安全技术模块、开发类产品组件。
- `security_policy_requirement` 中文口径统一为“安全策略条目”，当前不做独立知识维护页；后续可预留入口，等 SLSA 内容补充后再启用。
- 黄色底色用于识别软件开发模式适用性；红色底色不作为 ETL 条件。
- `service_category` 仅在 LC-AP 中使用，取值为 `管理类`、`开发类`、`网络空间类`。
- 安全技术模块必须匹配既有 `安全技术模块清单`，无法匹配时输出数据问题，不静默新增主数据。
- 实际产品示例统一定义为开发类产品组件，只在安全开发维度展示，不进入通用产品主数据。
- 软件开发类型与应用系统类型没有映射关系，后续在同一页面上下分别展示。

下一步建议：

- 进入 `LC-AP ETL/export 设计与验证`：实现或校验底色识别、服务分类、模块匹配问题输出，并准备 `lifecycle-knowledge.json`。
- 在 `lifecycle-knowledge.json` 验证完成前，不进入完整安全开发维度页面深化。

## 2026-05-14 前端技术映射说明类标签小修

用户指出能力映射技术视角中 `说明类 / 待确认`、`说明类` 都不是业务口径；如果对象是安全技术措施，就应显示为 `安全技术措施`。

处理：

- 修改 `frontend/capability-browser/viewModels.js`。
- 将 `security_technical_measure` 的主显示标签统一为 `安全技术措施`。
- 不再在前端能力映射技术视角中展示 `说明类` 或 `说明类 / 待确认`。

验证：

- `node --check frontend/capability-browser/viewModels.js` 通过。

## 2026-05-14 LC-AP ETL/export 第一轮验证与安全架构评估能力复验

本轮未启动新 Agent。

LC-AP ETL/export：

- 重新导入第三批 Sheet，导入任务：`6c02fb17-1a1f-46e0-9aba-8ffe80a30e45`。
- 重新生成 `frontend/capability-browser/public/data/lifecycle-knowledge.json`。
- 导出统计：
  - `application_processes`: 8
  - `data_processes`: 8
  - `lifecycle_activities`: 43
  - `lifecycle_scenes`: 36
  - `security_activities`: 6
  - `policy_requirements`: 76
  - `software_development_types`: 4
  - `application_system_types`: 3
  - `application_components`: 13
  - `development_product_components`: 14
  - `service_module_index`: 192
- 生成导入报告：
  - `data/exports/worker-verify/import-result-report-6c02fb17.md`
  - `data/exports/worker-verify/warning-review-6c02fb17.csv`
  - `data/exports/worker-verify/import-summary-6c02fb17.json`
- 发现 7 条 LC-AP 安全技术模块未匹配既有 `安全技术模块清单`，已登记为 `OI-039`，待用户确认原始数据或主数据补充。

安全架构评估能力复验：

- 用户提示“安全架构评估能力”原始数据此前有问题，本轮重新检查 Excel、SQLite 和前端导出。
- 当前原始 Excel 中：
  - `安全能力目录!D57` 为 `安全架构评估能力 T-AD.SV`；
  - `安全能力-安全技术服务!D57` 为 `安全架构评估能力 T-AD.SV`；
  - `安全能力-安全管理元素（high level）!D55` 为 `安全架构评估能力 T-AD.SV`。
- 重新导入核心 Sheet，导入任务：`cb7c37ef-b8a2-48b8-8548-ce66383805e3`，`validations: []`。
- 重新导入第二批 Sheet，导入任务：`d656ff68-437b-4b02-bd27-2944a960ffcf`，`validations: []`。
- 重新生成：
  - `frontend/capability-browser/public/data/capability-tree.json`
  - `frontend/capability-browser/public/data/management-knowledge.json`
- 复验结果：
  - SQLite active 数据中 `T-AD.SV` 仅 1 条，标题为 `安全架构评估能力`；
  - `T-AD.SV-01`、`T-AD.SV-02`、`T-AD.SV-03` 各 1 条 active 关注点；
  - `capability-tree.json` 中不再包含旧名称 `安全有效性验证能力`；
  - `capability-tree.json` 中 `T-AD.SV` 标题已为 `安全架构评估能力`。

验证：

- `python3 -m py_compile src/sapd_wiki/parsers.py src/sapd_wiki/exports.py src/sapd_wiki/cli.py` 通过。
- `node --check frontend/capability-browser/viewModels.js` 通过。

## 2026-05-14 主工程安全技术服务旧编码复验与重导

用户提示 `wiki sample.xlsx` 中部分安全技术服务编码已修正，本轮只处理主工程，不处理 maturity 线程。

检查范围：

- `data/raw-samples/wiki sample.xlsx`
- 主工程 SQLite `knowledge_items`
- 前端导出：
  - `frontend/capability-browser/public/data/capability-tree.json`
  - `frontend/capability-browser/public/data/management-knowledge.json`

检查结果：

- 原始 Excel 中旧编码模式命中数为 0：
  - `I-US&AD.SA`
  - `I-NT&AD.SA`
  - `I-AP&AD.SA`
  - `I-OS&AD.SA`
  - `ALL&TI.IO`
- 原始 Excel 中对应新编码共命中 69 处，例如：
  - `I-US&T-AD.SA-01`
  - `I-NT&T-AD.SA-01`
  - `I-AP&T-AD.SA-01`
  - `I-OS&T-AD.SA-01`
  - `ALL&T-IN.IO-01/02/03`

执行：

- 重新导入核心 Sheet，导入任务：`25704313-f3b7-4475-b397-a025287e682c`。
- 审批导入结果：`items_updated: 630`，`warnings: []`。
- 重新生成：
  - `capability-tree.json`
  - `management-knowledge.json`

验证：

- SQLite 中 `security_technical_service` 旧编码模式 `%&AD.SA-%`、`%&TI.IO-%` 命中数均为 0。
- `capability-tree.json` 和 `management-knowledge.json` 全量文本中旧编码命中数均为 0。
- 前端 JSON 可正常解析。
- 已将追加验证结果记录到 `OI-027`。

## 2026-05-14 LC-AP 模块 / 措施口径修正与重导

用户确认 `OI-039` 的处理口径：

- `应用程序威胁建模`、`制品安全加固`、`IaC代码安全测试` 三条按安全技术措施处理。
- `软件成分分析` 原始数据已修正为 `软件成分分析（SCA）`。
- `安全函数和组件库` 通过 `应用程序静态安全测试（安全函数和组件库）` 关联正式安全技术模块 `应用程序静态安全测试`。
- `软件物料清单` 已移动到开发技术服务列，不再作为安全技术模块处理。

本轮未启动新 Agent。

修改：

- `src/sapd_wiki/parsers.py`
  - 新增 LC-AP 安全技术措施白名单。
  - 新增 LC-AP 模块别名归一规则：`软件成分分析` -> `软件成分分析（SCA）`，`应用程序静态安全测试（安全函数和组件库）` -> `应用程序静态安全测试`。
  - LC-AP S 列中用户确认的措施导出为 `security_technical_measure`，关系为 `uses_measure`。
- `src/sapd_wiki/exports.py`
  - `lifecycle-knowledge.json` 增加 `security_technical_measures`、`technical_measures` 和 `technical_measure_count`。
- 同步更新：
  - `docs/03-import-etl/third-batch-data-contract.md`
  - `docs/02-data-model/data-model.md`
  - `docs/02-data-model/field-dictionary-draft.md`
  - `docs/01-architecture/api-field-contract.md`
  - `docs/06-implementation/open-issues.md`
  - `task_plan.md`

执行：

- 重新导入第三批 Sheet，导入任务：`1105f088-5a35-48b4-9776-40f5b25e5f2b`。
- 审批导入结果：`items_created: 3`、`items_updated: 294`、`warnings: []`。
- 重新生成 `frontend/capability-browser/public/data/lifecycle-knowledge.json`。
- 重新生成导入报告：
  - `data/exports/worker-verify/import-result-report-1105f088.md`
  - `data/exports/worker-verify/warning-review-1105f088.csv`
  - `data/exports/worker-verify/import-summary-1105f088.json`

验证结果：

- 第三批导入 `validations: []`。
- 导入报告 `validation_count: 0`。
- `lifecycle-knowledge.json` 统计：
  - `security_technical_measures: 3`
  - `uses_measure: 3`
  - `uses_module: 6`
- 阶段映射抽查：
  - 架构设计：措施 `应用程序威胁建模`
  - 编码开发：模块 `应用程序静态安全测试`、`软件成分分析（SCA）`
  - 集成构建：模块 `软件成分分析（SCA）`，措施 `制品安全加固`
  - 测试验证：模块 `应用程序动态安全测试`、`应用程序交互式安全测试`，措施 `IaC代码安全测试`
- `OI-039` 已更新为已修复。

## 2026-05-14 Maturity：样本驱动建模口径校正

任务：根据用户补充确认，校正 maturity 模块第一轮样本驱动建模，不开发功能、不修改主工程核心 schema、不实现评分算法、不做前端页面。

用户确认的关键口径：

- 成熟度模型设计严格参考 `sample文档介绍.docx` 第 3.1 章“网络安全能力成熟度模型”；
- 成熟度评估逻辑严格参考 `sample文档介绍.docx` 第 4 章“网络安全能力成熟度评估”；
- 成熟度评分对象包括 `capability`、`capability_focus`，核心都是判断是否具备相关能力；
- 安全技术服务是平台与工具维度的技术输入、证据和匹配线索，不作为独立成熟度评分对象；
- 评分要素固定为组织与角色、制度与流程、平台与工具、数据与信息；
- Word 是模型方法论基准，XLSX 是评价基准表，二者进入 maturity 专用模型基准表；
- 成熟度结果按 detail → focus → L2 capability → L1/domain → category → overall 聚合；
- maturity 模型中的安全能力、关注点、安全技术服务必须与主工程已治理数据做匹配，并输出不一致项供人工确认。

更新文件：

- `docs/08-maturity/maturity-domain-model.md`
- `docs/08-maturity/maturity-data-model.md`
- `docs/08-maturity/scoring-rules.md`
- `docs/08-maturity/sample-analysis.md`
- `docs/08-maturity/maturity-template-mapping.md`
- `config/maturity/field-mapping.sample.yaml`
- `task_plan.md`
- `progress.md`

建模结论：

- 新增 maturity 模型基准专用对象：`maturity_model_version`、`maturity_level_definition`、`maturity_capability_baseline`、`maturity_scope_service_baseline`；
- 新增主工程一致性核对对象：`maturity_mainline_match_result`；
- 新版 `sample 评分表.xlsx` 不作为客户评分输入，不直接产生 `maturity_score_result`；
- 安全技术服务保留在 `maturity_scope_service_baseline` 中，用于支撑 `platform_tool_score` 和主工程一致性核对；
- 客户评估输入和输出继续明确不进入 `knowledge_items`；
- `task_plan.md` 已把 maturity 下一阶段调整为“模型基准建模与主线一致性核对”，避免跳过建模直接进入模板或功能实现。

下一步建议：

- 先做只读一致性核对设计：从 XLSX 基准抽取能力、关注点和安全技术服务输入，与主工程已治理 JSON/DB 数据做匹配，输出 `Reference_Mainline_Diff` 草案；
- 待用户确认差异处理口径后，再进入 `maturity_*` 迁移和模板生成 MVP；
- 暂不启动前端、不写复杂评分算法。

## 2026-05-14 Maturity：业务逻辑来源与技术输入口径修正

用户进一步确认：

- 成熟度模型设计必须严格参考 Word 第 3.1 章；
- 评估逻辑必须严格参考 Word 第 4 章；
- 后续代码也是实现这两部分业务逻辑；
- 安全技术服务是对技术侧的输入，不是独立成熟度评分对象。

本次修正：

- 在 `requirements.md`、`maturity-domain-model.md`、`maturity-data-model.md`、`scoring-rules.md` 中补充业务逻辑来源；
- 将 `maturity-template-mapping.md` 和 `field-mapping.sample.yaml` 中的 `security_technical_service_name` 调整为平台与工具维度输入；
- 将 `task_plan.md` 的 maturity 决策和 M1 进入条件调整为评分对象仅 `capability` / `capability_focus`。

验证：

- `git diff --check` 通过；
- 使用 Ruby `YAML.load_file` 校验 `config/maturity/field-mapping.sample.yaml` 可解析；
- `supported_assessment_object_types` 校验为 `capability, capability_focus`。

## 2026-05-14 Maturity：模型基准与主工程一致性核对第一版

任务：开展 maturity M1 下一步工作，对新版 `sample 评分表.xlsx` 抽取出的成熟度模型基准与主工程 active 已治理数据做只读一致性核对。

本轮边界：

- 不修改主工程 schema；
- 不修改 `knowledge_items`；
- 不实现评分算法；
- 不做前端页面；
- 安全技术服务只作为 `platform_tool_score` 的技术输入、证据和匹配线索。

输入：

- `data/raw-samples/maturity/sample 评分表.xlsx`
- `data/exports/items-latest/knowledge-items.json`

新增 / 更新文件：

- 新增 `docs/08-maturity/mainline-consistency-check.md`
- 新增 `data/exports/maturity/maturity-baseline-capabilities.csv`
- 新增 `data/exports/maturity/maturity-baseline-technical-inputs.csv`
- 新增 `data/exports/maturity/mainline-consistency-diff.csv`
- 新增 `data/exports/maturity/mainline-consistency-diff.json`
- 新增 `data/exports/maturity/mainline-consistency-summary.json`
- 更新 `config/maturity/field-mapping.sample.yaml`
- 更新 `task_plan.md`
- 更新 `findings.md`
- 更新 `progress.md`

核对结果：

- 成熟度基准抽取：3 个能力分类、10 个 L1 能力域、32 个 L2 安全能力、84 个能力关注点、145 个安全技术服务输入；
- 主工程 active 数据：3 个能力分类、10 个 L1 能力域、32 个 L2 安全能力、91 个能力关注点、183 个安全技术服务；
- 能力分类、L1、L2 均能按编码 / 归一口径命中；
- 成熟度基准中的 84 个关注点全部按编码命中主工程；
- 主工程有 7 个 active 关注点未被成熟度基准覆盖；
- 安全技术服务输入中 138 项按编码匹配，6 项按名称匹配但编码不一致，1 项存在多候选；
- 主工程另有 42 个 active 安全技术服务未被成熟度评价基准表覆盖。

待用户确认的重点：

- `T-AD.SV` 的成熟度基准名称“安全有效性验证能力”与主工程“安全架构评估”是否需要统一；
- `M-SE.SE-02` 的关注点标题差异较大，建议优先确认；
- 7 个主工程 active 关注点是否纳入 maturity 模型基准；
- `AD.SA` 缺少 `T-` 前缀、`TI.IO` 与 `T-IN.IO` 的编码归一候选是否接受；
- `I-AP&AD.SA-01 应用异常行为检测` 命中多个 active 候选，需人工选择。

验证：

- `ruby -e 'require "yaml"; YAML.load_file(...)'` 校验 `field-mapping.sample.yaml` 通过；
- `git diff --check` 通过。

## 2026-05-14 主工程：LC-AP 安全开发维度前端接入 MVP

任务：执行 LC-AP Frontend 1.0，只做安全开发维度的数据接入、ViewModel 和基础页面骨架，不进入多格式增强，不做视觉 polish，不处理成熟度模块。

执行边界：

- 未启动新的子 Agent；
- 未修改 `src/`、ETL/export、SQLite schema 或原始 Excel；
- 仅把已生成的 `lifecycle-knowledge.json` 接入前端安全开发维度页面；
- 遵守 impeccable 上下文：关系表、树、矩阵优先，来源证据默认折叠，主展示区不展示 `sheet`、`row`、`column`、`raw_value`、`generated_at` 等非业务字段。

本次修改：

- `frontend/capability-browser/dataClient.js`
  - 补齐 `getApplicationSecurityLifecycle()`；
  - 为 `lifecycle` fallback 补齐 `development_product_components`、`security_technical_measures` 等结构；
  - 为安全开发数据增加 `missing_file` / `empty` / `ready` 状态口径。
- `frontend/capability-browser/viewModels.js`
  - 新增 `buildApplicationSecurityLifecycleViewModel()`；
  - 输出阶段树、当前阶段、阶段概览、活动 / 策略行、服务映射行、同页参考区和来源证据。
- `frontend/capability-browser/components/ApplicationSecurityLifecycle.js`
  - 新增安全开发维度原生 JS 组件；
  - 展示 LC-AP 阶段导航、阶段概览、活动与安全策略、开发服务映射、软件开发类型和应用系统类型 / 应用组件参考区。
- `frontend/capability-browser/app.js`
  - 将“安全开发维度”接入新的 ViewModel 和组件；
  - 数据生命周期维度仍保持原有逻辑，本轮未展开。
- `frontend/capability-browser/index.html`
  - 增加新组件脚本。
- `frontend/capability-browser/styles.css`
  - 增加安全开发维度基础表格与参考区样式。
- `task_plan.md`
  - 将安全开发维度 LC-AP 前端接入 MVP 标记为完成；
  - 新增下一步：用户核对 LC-AP 主展示字段、参考区和关系表。

验证：

- `node .agents/skills/impeccable/scripts/load-context.mjs` 通过，`hasProduct = true`，`hasDesign = true`；
- `node --check frontend/capability-browser/dataClient.js` 通过；
- `node --check frontend/capability-browser/viewModels.js` 通过；
- `node --check frontend/capability-browser/app.js` 通过；
- `node --check frontend/capability-browser/components/*.js` 通过；
- ViewModel 只读抽样显示：`dataState = ready`，LC-AP 阶段 8 个，默认阶段为“需求分析”，软件开发类型 4 个，应用系统类型 3 个；
- `git diff --check` 通过。

待用户核对：

- 安全开发维度页面中的“阶段活动与安全策略”是否符合你对 LC-AP 第一张表的业务表达；
- “安全开发服务映射”中开发类、管理类、网络空间类服务是否满足核对需要；
- “软件开发类型 / 应用系统类型与组件”作为同页参考区展示是否足够，不再伪造成正式关系。

## 2026-05-14 主工程：LC-AP 安全开发页面快速收敛

任务：根据用户反馈，减少前置解释，直接把 LC-AP 安全开发维度页面做出更可核对的效果。

本次调整：

- 页面标题从 `LC-AP 生命周期泳道` 改为 `LC-AP 安全开发生命周期`；
- 在阶段概览和活动表中显式展示 `适用开发模式`，该数据来自已导出的 `development_types`，对应原表黄色底色；
- 将 `安全开发服务映射` 从分类汇总改为服务级明细行；
- 保留 `开发类 / 管理类 / 网络空间类` 作为本表内服务分类，不扩展为全局主数据；
- `安全技术措施` 和 `开发类产品组件` 当前只到阶段粒度时，显示为 `阶段关联对象`，不再假装已经关联到某个具体服务；
- 更新 `OI-040`，记录“LC-AP 安全技术措施暂未细化到具体安全技术服务”为后续处理问题；
- 固化 `/` 规则：任何原始数据中的 `/` 均代表“没有相关定义 / 不适用”，后续不再重复询问。

验证：

- `node --check frontend/capability-browser/viewModels.js` 通过；
- `node --check frontend/capability-browser/components/ApplicationSecurityLifecycle.js` 通过；
- `node --check frontend/capability-browser/app.js` 通过；
- `git diff --check` 通过；
- Playwright 页面回归通过：
  - 页面标题为 `LC-AP 安全开发生命周期`；
  - 阶段导航 8 条；
  - 已展示 `适用开发模式`；
  - 当前默认阶段服务级关系表行数 14；
  - 存在 `阶段关联对象` 行；
  - 来源证据默认折叠。

## 2026-05-14 子 Agent 调度记录：LC-AP 服务-模块/措施核对

- agent_id：`019e259f-7144-7be3-a5ec-b68b35031b1d`
- nickname：`Peirce`
- 角色：Data QA 子 Agent
- 任务：生成 LC-AP `阶段 → 安全技术服务 → 安全技术模块 / 安全技术措施 / 开发类产品组件` 全量核对清单和样例说明。
- 写入范围：仅 `data/exports/worker-verify/`
- 禁止范围：不得修改 `frontend/`、`src/`、`docs/`、`task_plan.md`、`progress.md`、`findings.md`、`open-issues.md` 或原始 Excel。
- 状态：completed，已关闭
- 完成时间：2026-05-14 16:39:45 CST
- 输出文件：
  - `data/exports/worker-verify/lcap-service-module-measure-review.md`：494 行
  - `data/exports/worker-verify/lcap-service-module-measure-review.csv`：108 行，含表头；107 条记录
- 发现摘要：
  - LC-AP 共 8 个阶段；
  - 阶段服务记录共 91 条；
  - 其中 39 条服务可通过 `service_module_index` 找到关联安全技术模块；
  - 52 条服务当前没有服务级模块映射，需要后续 ETL 或业务确认；
  - 阶段级安全技术模块共 4 个：SAST、SCA、IAST、DAST；
  - 阶段级安全技术措施共 3 个：应用程序威胁建模、制品安全加固、IaC代码安全测试；
  - 阶段级开发类产品组件共 14 个，例如 Jira、Artifactory、Jenkins、Ansible、Prometheus 等。

## 2026-05-14 前端修正：LC-AP 安全开发生命周期页面重做

任务：根据用户最新反馈，修正 LC-AP 页面中“开发技术服务”和“安全技术服务”被混合展示的问题，并整理页面显示。

本次调整：

- 用户可见标题改为 `LC-AP安全开发生命周期`；
- 阶段活动表中的 `适用开发模式` 改为 `模式`，只展示模式值；
- 将 `开发技术服务` 从安全技术服务中拆出，单独作为页面区域展示；
- 将 `安全技术服务` 按本页专用分类展示为 `管理类 / 开发类 / 网络空间类`；
- 对来自旧导出中 Q / R 列合并后的服务，在 ViewModel 层做本页专用分类修正；
- 安全技术服务标签显示编码 + 名称，避免只看到名称导致误判；
- 页面服务区改为：
  - 开发技术服务；
  - 安全技术服务；
  - 阶段关联安全技术模块；
  - 阶段关联安全技术措施；
  - 开发类产品组件。

验证：

- `node --check frontend/capability-browser/viewModels.js` 通过；
- `node --check frontend/capability-browser/components/ApplicationSecurityLifecycle.js` 通过；
- `node --check frontend/capability-browser/app.js` 通过；
- `node --check frontend/capability-browser/dataClient.js` 通过；
- `node --check frontend/capability-browser/components/SourceEvidencePanel.js` 通过；
- `git diff --check` 通过；
- Playwright 页面回归通过：
  - 页面标题为 `LC-AP安全开发生命周期`；
  - 阶段导航 8 条；
  - AP-02 页面能看到 `开发技术服务` 下的 `需求管理系统`；
  - 活动表只显示 `模式`，不再显示 `适用开发模式`；
  - 安全技术服务分类包含 `管理类 / 开发类 / 网络空间类`；
  - 控制台无 error / warning。

输出截图：

- `data/exports/worker-verify/lcap-page-regression.png`

## 2026-05-14 前端调整：LC-AP 参考数据移入专项知识维护

任务：根据用户反馈，将 LC-AP 页面中的“参考数据”移动到“专项知识维护”中，不再在 `LC-AP开发安全生命周期` 主页面展示。

本次调整：

- 在“专项知识维护”二级导航中新增 `LC-AP参考数据`；
- `LC-AP参考数据` 页面展示两块内容：
  - `软件开发类型`；
  - `应用系统类型 / 应用组件`；
- `LC-AP开发安全生命周期` 主页面移除参考数据区；
- 参考数据页面明确作为维护 / 核对页面，不伪造成正式映射关系；
- 详情区仍使用 `SourceEvidencePanel` 展示来源证据，默认折叠。

验证：

- `node --check frontend/capability-browser/viewModels.js` 通过；
- `node --check frontend/capability-browser/app.js` 通过；
- `node --check frontend/capability-browser/components/LcapReferenceMaintenanceTable.js` 通过；
- `git diff --check` 通过；
- Playwright 页面回归通过：
  - 专项知识维护中出现 `LC-AP参考数据`，数量为 7；
  - 页面标题为 `LC-AP参考数据`；
  - 页面包含 `软件开发类型`，可见 `SaaS应用`、`自研应用`；
  - 页面包含 `应用系统类型 / 应用组件`，可见 `传统应用`、`数据库`；
  - `LC-AP开发安全生命周期` 主页面不再出现 `参考数据`；
  - 控制台无 error / warning。

## 2026-05-14 前端收敛：LC-AP 页面复用安全能力映射工作台标准

任务：按用户要求重做 `LC-AP安全开发生命周期` 页面，但不重新设计；必须对齐“安全能力映射”页面的工作台结构、表格样式、来源证据处理方式和信息密度。

本次调整：

- 安全开发维度页面从三栏详情结构收敛为两栏工作台：
  - 左侧：`LC-AP 生命周期` 阶段导航；
  - 中间上方：当前阶段概览；
  - 中间主体：`LC-AP 阶段关系表`；
  - 下方：当前阶段局部关系说明、参考数据、来源证据折叠区。
- 移除安全开发页独立右侧详情栏，不再让页面变成“左树 + 主表 + 右详情”的额外结构。
- 主体关系表按用户确认的阶段语义展示：
  - 主要活动；
  - 安全活动；
  - 安全策略要求；
  - 安全技术服务；
  - 安全技术模块；
  - 安全技术措施；
  - 开发类产品 / 组件参考；
  - 状态。
- `适用开发模式` 改为 `模式`，页面主内容不再出现旧称。
- 继续保持 `开发技术服务` 与 `安全技术服务` 分离；安全技术服务分类仅作为本页展示口径。
- 来源证据继续只进入 `SourceEvidencePanel`，默认折叠。
- 参考数据区标注为参考，不伪造成正式映射关系。

验证：

- `node --check frontend/capability-browser/dataClient.js` 通过；
- `node --check frontend/capability-browser/viewModels.js` 通过；
- `node --check frontend/capability-browser/app.js` 通过；
- `node --check frontend/capability-browser/components/*.js` 通过；
- `python3 -m py_compile src/sapd_wiki/parsers.py src/sapd_wiki/exports.py` 通过；
- `git diff --check` 通过；
- Playwright 页面切换回归通过：
  - `安全能力映射`、`信息化环境维度`、`专项知识维护`、`安全开发维度` 均可切换；
  - `LC-AP安全开发生命周期` 标题正确；
  - 右侧详情栏已隐藏；
  - 左侧显示 `LC-AP 生命周期 / 8 个阶段`；
  - 中间存在当前阶段概览和阶段关系表；
  - 来源证据显示为折叠面板；
  - 页面主内容不再出现 `适用开发模式`；
  - 控制台无 error / warning。

## 2026-05-14 项目规则：补充任务完成反馈协议

任务：根据用户要求，将“任务完成反馈协议”写入项目级 `AGENTS.md`，作为后续主控 Agent 和子 Agent 的固定执行规则。

本次调整：

- 在 `AGENTS.md` 新增 `任务完成反馈协议`；
- 明确每次任务完成后必须输出：
  - 任务结论；
  - 修改范围；
  - 功能结果；
  - 验证结果；
  - 前端页面提示；
  - 数据状态；
  - 字段边界；
  - 下一步建议；
- 补充子 Agent 任务完成后必须说明：
  - Agent 名称 / ID；
  - 是否复用已有 Agent；
  - 是否已 fan-in 到主控；
  - 是否需要关闭 / 归档；
- 强化子 Agent 调度规则：
  - 本轮并行最多 3 个；
  - 优先复用已有 agent id；
  - 如需新建必须说明原因；
  - 子 Agent 不得再启动子 Agent；
  - 只读 Agent 不得修改文件；
  - 写入 Agent 不得越权修改其他 Agent 的文件范围。

验证：

- 本轮未修改前端、ETL、数据模型和导出数据；
- `git diff --check` 待本轮执行完成后统一验证。

## 2026-05-14 计划修正：Frontend Baseline 1.0 范围扩展为三页

任务：根据用户补充修正，将 `Frontend Baseline 1.0` 的页面范围从“两页”修正为“三页”，并同步主控判断和后续计划。

本次调整：

- 新增 `frontend-baseline-1.0-plan.md`；
- 更新 `task_plan.md`，新增 `Frontend Baseline 1.0: Relationship Workspace Alignment` 计划段；
- 更新 `findings.md`，记录 Frontend Baseline 1.0 范围修正为三页；
- 明确三页范围：
  - `安全能力映射`；
  - `LC-AP开发安全生命周期`；
  - `信息化环境维度`；
- 明确信息化环境维度是第一批核心数据的第三个业务视角，不是新 Sheet 扩展；
- 明确信息化环境维度至少覆盖：
  - `information_environment`；
  - `environment_segment`（环境子类）；
  - `information_object`；
  - `scope_type`；
  - `security_technical_service`；
  - `security_technology_module`；
  - `security_system`；
  - `product`；
- 明确需要检查或补齐的信息化环境维度关系：
  - `protects_object`；
  - `deployed_in_environment`；
  - `applies_to_scope`；
  - `implements_service`；
  - `maps_to_product`；
  - `part_of_system`；
- 明确三页统一组件基线：
  - `AppShell`；
  - `LocalNavigator`；
  - `ObjectOverview`；
  - `RelationshipTable`；
  - `SourceEvidencePanel`。

边界：

- 本轮未修改前端代码；
- 本轮未修改 ETL/export；
- 本轮未修改数据库 schema；
- 本轮未进入新 Sheet 扩展、Phase 7 或 maturity M1。

验证：

- `git diff --check` 待本轮执行完成后统一验证。
