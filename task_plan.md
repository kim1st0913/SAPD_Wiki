# Task Plan: SAPD 工作知识库系统

## Goal

规划并逐步建设一个本地化结构化工作知识库系统，支持多格式知识资料导入、结构化数据库存储、来源追踪、更新审查、关联查询、多维导出和本地页面展示。

## Current Status

- Status: phase_5_dual_track_data_frontend_sync_started
- Started: 2026-05-09
- Current phase: Phase 5 - 数据处理与关系化前端双轨并行
- Primary reference: `docs/00-overview/project-roadmap.md`

## Phases

| Phase | Name | Status | Output |
|---|---|---|---|
| 0 | 需求澄清与项目规划 | complete | `AGENTS.md`, overview docs, planning files |
| 1 | 数据发现与字段定义 | in_progress | knowledge asset inventory, knowledge objects, field dictionary, mapping rules |
| 2 | 工程骨架 | in_progress | README, `.gitignore`, directory structure |
| 3 | 数据模型设计 | complete | `docs/02-data-model/data-model.md`, SQLite schema, migrations |
| 4 | 导入 MVP | in_progress | Excel + Markdown/DOCX import prototype |
| 5 | 知识浏览与搜索 | pending | list/detail/search/tag/category pages |
| 6 | 导出与备份 | pending | CSV/JSON/Excel/ZIP export |
| 7 | 多格式增强 | pending | PPT and Draw.io parsing/preview |
| 8 | 更新审查与关系管理 | pending | diff, conflict review, relations |
| 9 | 打包交付 | pending | local packaged app and user guide |
| 10 | AI/RAG 增强 | optional | semantic search and cited Q&A |
| G0 | 轻量治理 | complete | governance index, data governance, findings index |

## Phase 0 Tasks

- [x] Read existing project concept document.
- [x] Create planning files for persistent Codex workflow.
- [x] Create `AGENTS.md` for future Codex behavior.
- [x] Create formal overview docs.
- [x] Create lightweight `docs/01-architecture/architecture.md`.
- [x] Add pre-development data definition and ETL planning guidance.
- [x] Create practical data definition and import rule documents.
- [x] Integrate supplemental non-developer implementation guide.
- [x] Decide initial GitHub storage boundary: commit docs/config/templates, ignore raw data/databases/exports by default.
- [x] Move sample file confirmation into Phase 1 because it depends on actual user-provided examples.

## Phase 1 Tasks

- [x] Create local `data/raw-samples/` folder for unsynced sample files.
- [x] Prepare first batch sample files: 1 PPT, 1 Excel workbook, 1 multi-page Draw.io.
- [x] Fill `docs/03-import-etl/sample-file-inventory.md`.
- [x] Identify first V1 knowledge object types.
- [x] Draft first field dictionary from actual sample files.
- [x] Draft first mapping rules from actual sample files.
- [x] Draft first logical data model from field dictionary and mapping rules.
- [x] Plan later expansion batches for all 26 Excel sheets.
- [x] Decide which sample files are safe to commit and which must stay local.

## Phase 3 Tasks

- [x] Draft logical data model.
- [x] Draft SQLite schema design.
- [x] Generate actual SQLite migration SQL.
- [x] Decide database file location and local app data directory.
- [x] Define seed/test fixture strategy without committing raw samples.

## Phase 4 Tasks

- [x] Draft Excel import MVP design.
- [x] Create import MVP engineering skeleton.
- [x] Implement migration runner and local database initialization.
- [x] Implement source file registration.
- [x] Implement Excel workbook reader.
- [x] Implement first parser for `安全能力目录`.
- [x] Generate capability object candidates and relation candidates.
- [x] Write first staging preview for capability objects and `belongs_to` relations.
- [x] Add validation report output for missing titles/codes and duplicate/inconsistent service codes.
- [x] Implement 5 core Sheet parsers.
- [x] Implement staging item/relation writer.
- [x] Implement import preview and validation report.
- [x] Implement review-approved load into formal tables.
- [x] Implement basic local query commands.
- [x] Create warning review checklist for the first approved import.
- [x] Implement JSON/CSV export commands for items and relations.
- [x] Generate first local import result report under `data/exports/`.
- [x] Rebuild local SQLite database cleanly from the corrected Excel.
- [x] Generate fresh official import report with `validations: none`.

## Phase 5 Preparation Tasks

- [x] Draft first capability browser page design.
- [x] Export frontend-ready `capability-tree.json`.
- [x] Create first local capability browser frontend.
- [x] Verify local page loads in Chrome.

## Phase 5 Dual-Track Data/Frontend Tasks

- [x] Confirm that frontend must move from card-centric display to relation-centric data review workbench.
- [x] Create `docs/04-frontend/frontend-redesign-brief.md` as the shared contract for Master, ETL/Data Worker and Frontend Worker.
- [x] ETL/Data Worker: verify and complete `信息化环境-信息化对象-安全作用域映射` and continuous scope-service-module-system export.
- [x] ETL/Data Worker: remove duplicate process/stakeholder display causes in `capability-tree.json`.
- [x] Frontend Worker/Main: redesign `frontend/capability-browser/` around tables, mapping chains and relation workbench.
- [x] Master Agent: integrate worker outputs, update unified issues and run local verification.
- [x] Revise frontend target: business relationship dimensions are primary; source row/field tracing is secondary.
- [x] Frontend Design Owner: produce a unified frontend information architecture for capability, environment, security development, data lifecycle, specialist maintenance, HTML explanation and Draw.io/PPT views.
- [x] Master Agent: review Frontend Design Owner output and record open data-contract questions.
- [x] Confirm FE-IA data-contract questions before the next frontend implementation batch.
- [x] ETL/Data Worker: export explicit focus-scope mappings, service indexes, lifecycle knowledge and content view stubs.
- [x] Frontend/Main: restore a runnable 7-page relation-oriented navigation skeleton and rename `知识来源` to `专项知识维护`.
- [x] Master Agent: integrate ETL and frontend outputs, then run local verification.
- [ ] User review: inspect the restored 7-page frontend baseline and identify the next focused frontend page to deepen.

## Phase 1 Remaining Sheet Modeling Tasks

- [x] Scan all 26 Excel sheets and identify the 21 sheets not in the first ETL batch.
- [x] Group the remaining 21 sheets by theme and implementation priority.
- [x] Draft object types and relation types for the remaining 21 sheets.
- [x] Recommend the second implementation batch before parallel coding starts.
- [x] User clarified the second batch scope as 5 sheets: security work, high-level management elements, process list, work function list, and Gartner role reference.
- [x] Draft second-batch field dictionary and mapping rules for the 5 confirmed sheets.
- [x] Update the logical data model with second-batch object and relation types.
- [x] Define second-batch data contract and acceptance criteria.
- [x] Decide parallel coding split for second-batch ETL, frontend module, and export updates.
- [x] Integrate second-batch ETL, frontend, and export worker outputs.
- [x] Run second-batch local import/export verification.
- [x] Update issue tracker and progress after second-batch verification.

## Phase 4 Current Local Verification

Latest first-batch clean approved import job:

- `e3a30211-a138-4bd7-80af-66e5ddff4bb5`

Latest second-batch approved import job:

- `a4b77945-380e-457d-b87f-7ba05b5dcf01`

Current local database summary:

| Table | Count |
|---|---:|
| source_files | 1 |
| import_jobs | 2 |
| staging_items | 1244 |
| staging_relations | 4195 |
| knowledge_items | 1122 |
| knowledge_relations | 4195 |
| source_references | 14973 |
| review_decisions | 5439 |
| change_logs | 5439 |

Current local export files:

| File | Purpose |
|---|---|
| `data/exports/items-latest/knowledge-items.csv` | Knowledge item review in spreadsheet tools |
| `data/exports/items-latest/knowledge-items.json` | Knowledge item machine-readable export |
| `data/exports/relations-latest/knowledge-relations.csv` | Knowledge relation review in spreadsheet tools |
| `data/exports/relations-latest/knowledge-relations.json` | Knowledge relation machine-readable export |
| `data/exports/import-review-latest/import-summary-e3a30211.json` | Import job summary |
| `data/exports/import-review-latest/import-result-report-e3a30211.md` | Human-readable import result report |
| `data/exports/import-review-latest/warning-review-e3a30211.csv` | Warning review checklist, now 0 rows |
| `frontend/capability-browser/public/data/capability-tree.json` | Frontend data with capability tree plus security work and process mappings |
| `frontend/capability-browser/public/data/management-knowledge.json` | Frontend data for security work functions, GB/T references, Gartner roles and image assets |
| `data/exports/second-batch-summary-latest/second-batch-summary.json` | Second-batch verification summary |

## Key Decisions

| Decision | Current Choice | Reason |
|---|---|---|
| V1 database | SQLite | Local, simple, easy to back up |
| V1 frontend | React + TypeScript | Mature ecosystem, easy UI expansion |
| Desktop packaging | Tauri | Lightweight local app packaging |
| V1 import priority | Excel, Markdown, DOCX | Best balance of value and difficulty |
| Pre-development priority | Data discovery before coding | User needs guidance to define fields and ETL mappings |
| Pre-development deliverables | Inventory, object definitions, field dictionary, mapping rules | These are the real inputs for database and ETL implementation |
| Update policy | Review before merge | Prevents automatic imports from overwriting manual edits |
| AI/RAG | Later phase | Data model and search must stabilize first |

## Open Questions

| Question | Why It Matters |
|---|---|
| 数据是否包含敏感资料？ | 决定 `.gitignore` 和 GitHub 存储边界 |
| 是否需要 Windows/macOS 双平台打包？ | 影响 Tauri 配置和测试方式 |
| 导出最常用格式是什么？ | 决定 V1 导出优先级 |

## Risks

| Risk | Mitigation |
|---|---|
| 一开始支持所有格式导致范围失控 | V1 只做 Excel、Markdown、DOCX |
| 系统退化为文件预览器 | 强制建立知识对象和来源追踪 |
| 人工编辑被批量导入覆盖 | 导入生成 diff，用户审核后合并 |
| 原始文件和数据库脱节 | 每条记录保留 source/hash/location/import_job |
| 过早引入 AI | AI/RAG 放到结构化数据稳定后 |

## Next Recommended Actions

1. 由 ETL/Data Worker 完成信息化对象、作用域、服务、模块、系统连续映射导出。
2. 由 Frontend Worker 按 `docs/04-frontend/frontend-redesign-brief.md` 重构前端关系工作台。
3. 主控 Agent 集成两个 worker 的输出，统一更新 `open-issues.md` 和 `progress.md`。
4. 用户确认关系化前端后，再恢复第三批生命周期页面和后续第四批 Sheet 建模。

Issue tracking rule:

- All bugs and issues are maintained in `docs/06-implementation/open-issues.md`.
- Fixed issues must be marked as `已修复` in that file.

## Governance P0 Tasks

- [x] Confirm lightweight governance approach instead of full governance document suite.
- [x] Add `docs/07-governance/governance-index.md`.
- [x] Add `docs/07-governance/data-governance.md`.
- [x] Archive old `findings.md` content to `findings-history/2026-05.md`.
- [x] Convert root `findings.md` into a lightweight index.
- [x] Update `AGENTS.md` and `README.md` to point to the governance entry.
- [x] Clarify `progress.md` responsibility as execution log only.

## Errors Encountered

| Date | Error | Attempt | Resolution |
|---|---|---|---|
| 2026-05-09 | `git status` reported this directory is not a Git repository | Verification | Treat Git initialization as Phase 1 task |
