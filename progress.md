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
