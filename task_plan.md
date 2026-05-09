# Task Plan: SAPD 工作知识库系统

## Goal

规划并逐步建设一个本地化结构化工作知识库系统，支持多格式知识资料导入、结构化数据库存储、来源追踪、更新审查、关联查询、多维导出和本地页面展示。

## Current Status

- Status: planning
- Started: 2026-05-09
- Current phase: Phase 0 - 需求澄清与项目规划
- Primary reference: `work-knowledge-base-project-plan.md`

## Phases

| Phase | Name | Status | Output |
|---|---|---|---|
| 0 | 需求澄清与项目规划 | in_progress | `AGENTS.md`, `docs/project-plan.md`, planning files |
| 1 | 数据发现与字段定义 | pending | knowledge asset inventory, knowledge objects, field dictionary, mapping rules |
| 2 | 工程骨架 | pending | README, `.gitignore`, directory structure |
| 3 | 数据模型设计 | pending | `docs/data-model.md`, SQLite schema, migrations |
| 4 | 导入 MVP | pending | Excel + Markdown/DOCX import prototype |
| 5 | 知识浏览与搜索 | pending | list/detail/search/tag/category pages |
| 6 | 导出与备份 | pending | CSV/JSON/Excel/ZIP export |
| 7 | 多格式增强 | pending | PPT and Draw.io parsing/preview |
| 8 | 更新审查与关系管理 | pending | diff, conflict review, relations |
| 9 | 打包交付 | pending | local packaged app and user guide |
| 10 | AI/RAG 增强 | optional | semantic search and cited Q&A |

## Phase 0 Tasks

- [x] Read existing project concept document.
- [x] Create planning files for persistent Codex workflow.
- [x] Create `AGENTS.md` for future Codex behavior.
- [x] Create formal `docs/project-plan.md`.
- [x] Create lightweight `docs/architecture.md`.
- [x] Add pre-development data definition and ETL planning guidance.
- [x] Create practical data definition and import rule documents.
- [x] Integrate supplemental non-developer implementation guide.
- [ ] Confirm V1 sample file types and real data examples with user.
- [ ] Decide whether GitHub repository should store only code/config or also sample data.

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
| 第一批样例文件有哪些？ | 决定字段模型和导入规则 |
| 主要知识类型有哪些？ | 决定 `knowledge_item.type` 和页面模板 |
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

1. 让用户准备 5 到 10 个代表性样例文件。
2. 完成知识资产盘点，先用 `docs/sample-file-inventory.md`，后续可生成 `knowledge_asset_inventory.xlsx`。
3. 完成知识对象定义，先用 `docs/data-dictionary-template.md`，后续可生成 `knowledge_objects.xlsx`。
4. 完成字段字典，后续可生成 `field_dictionary.xlsx`。
5. 完成映射规则，先用 `docs/import-rules.md`，后续可生成 `mapping_rules.xlsx`。
6. 再创建工程骨架和实现数据库导入 MVP。

## Errors Encountered

| Date | Error | Attempt | Resolution |
|---|---|---|---|
| 2026-05-09 | `git status` reported this directory is not a Git repository | Verification | Treat Git initialization as Phase 1 task |
