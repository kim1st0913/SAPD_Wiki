# Task Plan: SAPD 工作知识库系统

## Goal

规划并逐步建设一个本地化结构化工作知识库系统，支持多格式知识资料导入、结构化数据库存储、来源追踪、更新审查、关联查询、多维导出和本地页面展示。

## Current Status

- Status: phase_5_second_batch_review_confirmed_pending_landing
- Started: 2026-05-09
- Current phase: Phase 5 - 已导入 Sheet 业务含义复核与关系展示校正
- Primary reference: `docs/00-overview/project-roadmap.md`

## Phases

| Phase | Name | Status | Output |
|---|---|---|---|
| 0 | 需求澄清与项目规划 | complete | `AGENTS.md`, overview docs, planning files |
| 1 | 数据发现与字段定义 | in_progress | knowledge asset inventory, knowledge objects, field dictionary, mapping rules |
| 2 | 工程骨架 | in_progress | README, `.gitignore`, directory structure |
| 3 | 数据模型设计 | complete | `docs/02-data-model/data-model.md`, SQLite schema, migrations |
| 4 | 导入 MVP | in_progress | Excel + Markdown/DOCX import prototype |
| 5 | 知识浏览与搜索 | in_progress | relation-oriented static frontend, capability/environment/specialist maintenance pages |
| 6 | 导出与备份 | pending | CSV/JSON/Excel/ZIP export |
| 7 | 多格式增强 | pending | PPT and Draw.io parsing/preview |
| 8 | 更新审查与关系管理 | pending | diff, conflict review, relations |
| 9 | 打包交付 | pending | local packaged app and user guide |
| 10 | AI/RAG 增强 | optional | semantic search and cited Q&A |
| G0 | 轻量治理 | complete | governance index, data governance, findings index |
| M | 成熟度分析模块 | m0_complete | `docs/08-maturity/`, `config/maturity/`, later independent `maturity` module |

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
- [x] Run overall frontend regression, close frozen Step 6.7 issues and document security technical measure contracts.
- [x] User / ChatGPT review: review the latest plan and decide the next data business-confirmation batch. This is a review gate, not a formal project Phase 7.
- [x] Confirm external ChatGPT step numbers, UI prototype and prototype code are review inputs only, not formal project phases.
- [x] Confirm the next mainline is mapped Sheet business semantics review, not formal Phase 7 multi-format enhancement.

## Phase 5 Backend/Frontend Separation Tasks

- [x] Define backend logic and interface architecture in `docs/01-architecture/backend-interface-design.md`.
- [x] Define field-level API contract in `docs/01-architecture/api-field-contract.md`.
- [x] Update frontend design documents to follow backend/API contract and `dataClient` boundary.
- [x] Confirm backend owns ETL, normalization, master data, relation generation, validation and frontend projection export.
- [x] Confirm frontend owns navigation, table/matrix/relation-chain rendering, filtering, resizing and detail interaction only.
- [x] Confirm static JSON is the MVP API contract, with future `/api/v1/*` local API preserving the same semantics.
- [x] Add or refactor frontend `dataClient` so pages do not directly scatter business data fetching and shaping logic.
- [x] Add ViewModel layer between `dataClient` and page rendering for capability, environment and maintenance views.
- [x] Confirm frontend pages consume business projections through `dataClient` + ViewModel instead of scattered direct fetch and business shaping.
- [x] Align current frontend JSON exports with the documented backend interface contract.
- [x] Add `security_technical_measures` field contract and backend interface notes.
- [x] Complete first-stage specialist maintenance closure for 6 pages: scope, process, work function, technology module, technical measure, standard/role reference.
- [x] Review the Frontend Design Agent output against `chatgpt ui code.md`, `frontend-redesign-brief.md` and `backend-interface-design.md`.
- [x] Complete first refactored capability relationship workspace technical baseline and regression.
- [ ] User confirms business semantics of mapped sheets/pages before broader feature expansion.

## Phase 5 Frontend Baseline Completion

- [x] 能力维度完成第一阶段关系展示：能力树、当前关注点工作台、技术视角、管理视角、来源证据折叠区。
- [x] 信息化环境维度完成第一阶段关系展示：环境 / 对象树，对象概览，对象-作用域-服务-模块/措施映射表。
- [x] 专项知识维护完成第一阶段统一框架和 6 个页面闭环：
  - [x] 作用域清单
  - [x] 流程清单
  - [x] 职能清单
  - [x] 安全技术模块清单
  - [x] 安全技术措施清单
  - [x] 标准与岗位参考
- [x] 安全技术措施 `security_technical_measures` 已导出、已补契约、已完成前端回归。
- [x] G 列 `安全技术模块/措施` 分流口径已固化为安全技术模块、安全技术措施、说明类 / 待确认项。
- [x] 当前 MVP 前端已通过静态浏览器页面 + 原生 JS + `dataClient` + ViewModel 跑通；不因旧技术决策强行引入 React/Vue。

## Frontend Baseline 1.0: Relationship Workspace Alignment

定位：本阶段不是新增功能，也不是进入新 Sheet 扩展，而是把当前已形成的三类核心业务视角统一到同一套“本地关系知识库工作台”产品标准中。

页面范围从原先两页修正为三页：

1. `安全能力映射`
   - 主视角：安全能力 / 关注点；
   - 表达关系：关注点、作用域、安全技术服务、管理工作、流程、安全技术模块 / 措施、来源证据。
2. `LC-AP开发安全生命周期`
   - 主视角：开发安全生命周期阶段；
   - 表达关系：阶段、主要活动、安全活动、安全策略要求、开发技术服务、安全技术服务、安全技术模块、安全技术措施、开发类产品组件；
   - LC-AP 参考数据不放在同页参考区，进入 `专项知识维护 > LC-AP参考数据`。
3. `信息化环境维度`
   - 主视角：信息化环境 / 环境子类 / 信息化对象；
   - 表达关系：信息化环境、环境子类、信息化对象、作用域、安全技术服务、安全技术模块、安全系统、产品；
   - 这是第一批核心数据的第三个业务视角，不是新 Sheet 扩展。

三页统一组件基线：

- `AppShell`
- `LocalNavigator`
- `ObjectOverview`
- `RelationshipTable`
- `SourceEvidencePanel`

三页可有不同主对象、概览字段和关系表字段，但必须保持同一套视觉语言、信息密度、表格样式、标签规则和来源证据处理方式。

信息化环境维度待检查和补齐项：

- 数据对象或等价能力：
  - `information_environment`
  - `environment_segment`（中文口径：环境子类）
  - `information_object`
  - `scope_type`
  - `security_technical_service`
  - `security_technology_module`
  - `security_system`
  - `product`
- 关系或等价关系：
  - `protects_object`
  - `deployed_in_environment`
  - `applies_to_scope`
  - `implements_service`
  - `maps_to_product`
  - `part_of_system`
- 前端消费层：
  - 检查信息化环境维度前端数据文件是否覆盖环境、环境子类、对象、作用域、服务、模块、系统和产品；
  - 检查 `dataClient` 是否有稳定读取方法；
  - 检查 ViewModel 是否输出白名单业务字段；
  - 检查页面是否复用统一组件基线；
  - 检查信息化环境页设计文档是否与另外两页一致。

本阶段明确不做：

- 新 Sheet 扩展；
- Phase 7 PPT / Draw.io / DOCX 多格式增强；
- maturity M1；
- 数据库 schema 重构；
- 底层 ETL 大改；
- 引入 React / Vue 重构当前 MVP 前端。

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
- [x] Create completed mapped Sheet business confirmation checklist.
- [x] User confirmed first-batch core Sheet business meaning, primary keys and relation cardinality.
- [x] Reimport first-batch core Sheets after user source updates and refresh frontend JSON exports.
- [x] Reimport third-batch LC-AP after user fixed duplicate policy sequence numbers.
- [x] User confirms completed mapped Sheet business meaning, primary keys and relation cardinality for the first and second core batches.

## Maturity Module Implementation Plan

定位：成熟度分析模块是 SAPD Wiki 主工程下的独立 `maturity` 模块，读取现有安全能力知识库，评估运行数据使用 `maturity_*` 专用表，不写入 `knowledge_items`。

当前边界：

- 不直接修改主线业务代码；
- 不实现复杂评分代码、图表代码和 UI；
- 不改变当前 Phase 4/5 导入、关系展示和业务语义复核主线；
- 初始 raw sample 以后按一个 Word、一个 PPTX 和一个 XLSX 准备，默认放在本地 `data/raw-samples/maturity/`，不提交 GitHub。

| M Phase | Name | Status | Output |
|---|---|---|---|
| M0 | 需求固化、配置占位、接入 review 与主线集成检查 | complete | `docs/08-maturity/`, `docs/08-maturity/module-integration-review.md`, `docs/08-maturity/mainline-integration-check.md`, `config/maturity/*.yaml` |
| M1 | 模型基准建模与主线一致性核对 | in_progress | `maturity_model_version`、`maturity_level_definition`、`maturity_capability_baseline`、`maturity_scope_service_baseline`、`maturity_mainline_match_result` 逻辑模型；第一版一致性差异清单已输出 |
| M2 | 数据库与模板生成 MVP | pending | `maturity_*` 迁移、独立 maturity 包、`maturity-template` CLI、Reference_Capabilities / Reference_Level_Criteria / Reference_Mainline_Diff Sheet |
| M3 | 模板导入与暂存 | pending | `maturity-import` CLI、Assessment_Info / Score_Input / Evidence_List 解析、导入校验报告 |
| M4 | 匹配引擎、审查表与评分 | pending | exact code/title/relation/keyword 匹配、`maturity_match_result`、主线差异确认、L1-L5 聚合评分 |
| M5 | 离线报告 | pending | 差距项、建议项、Markdown/HTML/JSON 报告快照 |
| M6 | 前端页面接入 | pending | 成熟度评估入口、列表、上传、总览、能力明细和后续匹配审查页 |

Maturity 模块关键决策：

- V1 先采用 CLI + Excel 模板 + JSON/Markdown/HTML 报告闭环；
- V1 前端页面暂缓到 M6，不影响当前关系化工作台主线；
- 客户输入、评估报告和 staging 审查表默认写入 `data/maturity/`，不提交 GitHub；
- 后端负责模板、匹配、评分和报告数据；前端只消费评估结果，不自行推断关系或评分。
- 成熟度模型设计严格参考 Word 第 3.1 章，评估逻辑严格参考 Word 第 4 章，后续代码实现这两部分业务逻辑；
- 成熟度评分对象固定为 `capability`、`capability_focus`；
- 安全技术服务是平台与工具维度的技术输入、证据和匹配线索，不作为独立成熟度评分对象；
- 评分要素固定为组织与角色、制度与流程、平台与工具、数据与信息；
- Word 作为模型方法论基准，XLSX 作为评价基准表，二者进入 maturity 专用模型基准表；
- 模型基准启用前必须与主工程已治理的安全能力、关注点、安全技术服务做一致性核对，并输出不一致项供人工确认。

M1 进入条件：

- 用户确认模型设计参考 Word 第 3.1 章，评估逻辑参考 Word 第 4 章；
- 用户确认评分对象为 `capability`、`capability_focus`；
- 用户确认安全技术服务作为平台与工具维度输入；
- 用户确认四个固定评分要素；
- 用户确认 Word 是模型方法论基准，XLSX 是评价基准表；
- 用户确认模型基准需要与主工程已治理数据做一致性核对；
- 用户确认后续正式客户评估以 Excel 评估模板作为主输入；
- 用户确认 PPTX 作为教程、证据和报告风格参考；
- 用户确认 V1 先 CLI + JSON/Markdown/HTML 报告，不做完整前端；
- `data/maturity/` 本地数据隔离边界保持有效；
- 第二批管理 / 流程 / 职能 / 岗位 Sheet 业务含义复核建议先完成；
- 主控确认新增 `maturity_*` 迁移和 CLI 子命令不会打断当前主工程 Sheet 复核主线。

M1 当前已完成：

- 从新版 `sample 评分表.xlsx` 抽取成熟度能力基准和安全技术服务输入；
- 与主工程 active `knowledge_items` 做只读一致性核对；
- 输出 `docs/08-maturity/mainline-consistency-check.md`；
- 输出 `data/exports/maturity/mainline-consistency-diff.csv/json`、`mainline-consistency-summary.json`；
- 在 `config/maturity/field-mapping.sample.yaml` 中记录第一轮编码归一候选。

## Next Mainline: Mapped Sheet Business Semantics Review

下一主线冻结为：已导入 Sheet 的业务含义复核 + 前端关系展示校正。

目标：

- 逐 Sheet 复核业务含义；
- 确认每张 Sheet 的主对象；
- 确认主键或唯一约束；
- 确认关系基数：`1:1`、`1:N`、`N:1`、`N:M`；
- 确认主展示字段；
- 确认来源证据字段；
- 确认每张 Sheet 的关系应进入能力维度、信息化环境维度、专项知识维护、安全开发维度或数据生命周期维度；
- 识别当前页面哪些只是“技术上可显示”，但业务表达仍需校正。

复核优先顺序：

第一优先级：第一批核心 Sheet

- [x] 安全能力目录（Sheet Review 1.0 已复核，用户已确认层级、编码、排序）
- [x] 安全能力作用域目录（Sheet Review 1.0 已复核，用户已补充 `I-PE 物理环境` 并提出前端展示修正）
- [x] 信息化环境-信息化对象-安全作用域映射（Sheet Review 1.0 已复核，用户已确认环境子类正式层级和同名对象跨环境复用口径）
- [x] 安全能力-安全技术服务（Sheet Review 1.0 已复核，用户已确认 `/` 无适用服务和多服务异常检测）
- [x] 安全技术模块清单（Sheet Review 1.0 已复核，用户已确认安全系统、模块、产品口径）
- [x] 作用域-安全技术服务-安全技术模块映射（Sheet Review 1.0 已复核，用户已确认模块 / 措施需显式区分）
- [x] 用户回复第一批核心 Sheet Review 1.0，并确认大部分业务口径与前端修正方向。
- [x] 用户确认第一批核心 Sheet Review 1.0 的剩余未清事项：`environment_segment` 为正式层级，中文口径为“环境子类”；前端修正项已进入统一问题清单，待下一轮执行。

第二优先级：第二批管理、流程、职能、岗位相关 Sheet

- [x] Sheet Review 2.0 复核草案已完成，结论见 `docs/03-import-etl/second-batch-business-review.md`
- [x] 用户确认第二批 Sheet Review 2.0 的待确认事项
- [x] 安全能力-安全工作（已确认安全工作独立编码、正式编码规则为 `SW-关注点编码-序号`、独立维护页，关注点到安全工作为 1:1 / 1:N）
- [x] 安全能力-安全管理元素（high level）（已确认 L2 安全能力到 L2 流程组严格约束，组织职能相关方按四类展示）
- [x] 安全职能流程清单（完善L4）（已确认同名 L3 原则上不跨 L2，发现异常需输出核对）
- [x] 安全工作职能清单（已确认安全工作与安全职能无直接关系，GB/T 与安全职能支持双向映射查看；现有数据已有安全职能 -> GB/T 单向映射基础）
- [x] Gartner 工作岗位参考（已确认与安全职能清单自动生成双向候选映射，用户复核后确认）
- [x] 第二批修正落地：安全工作清单独立页面、L2 能力到 L2 流程组严格校验、GB/T 双向映射核对输出、Gartner 双向候选映射核对输出和待复核展示

第三优先级：第三批 LC-AP 生命周期相关 Sheet

- [x] 生成 LC-AP / LC-DT 生命周期相关 Sheet 业务语义复核草案
- [x] 用户确认 LC-AP 生命周期相关 Sheet 的核心业务口径
- [x] 完成 LC-AP 第一阶段数据契约设计（SLSA 暂不补充）
- [x] 确认后续需要生成 `lifecycle-knowledge.json`
- [x] 完成 LC-AP ETL/export 第一轮验证并生成 `lifecycle-knowledge.json`
- [x] 用户确认并关闭 LC-AP 安全技术模块未匹配清单（见 `OI-039`）
- [x] 完成安全开发维度 LC-AP 前端数据接入与 MVP 页面骨架。
- [ ] 用户基于前端页面核对 LC-AP 主展示字段、参考区和关系表是否符合业务表达。

## Phase 4 Current Local Verification

Latest first-batch clean approved import job:

- `9afb8c92-462d-4c05-827d-d2ffa57af6a2`

Latest second-batch approved import job:

- `a4b77945-380e-457d-b87f-7ba05b5dcf01`

Latest third-batch approved import job:

- `79a17f64-3790-469b-b72e-5af72de1985b`

Current local database summary:

| Table | Count |
|---|---:|
| source_files | 6 |
| import_jobs | 17 |
| staging_items | 7954 |
| staging_relations | 25323 |
| knowledge_items | 1649 |
| knowledge_relations | 7352 |
| source_references | 97056 |
| review_decisions | 33277 |
| change_logs | 15676 |

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
| Current MVP frontend | Static browser pages + native JS + `dataClient` + ViewModel | 已经跑通本地静态关系工作台，避免当前阶段强行引入框架 |
| Future optional frontend refactor | React + TypeScript | 作为后续可选重构方向，不是当前阶段强制技术栈 |
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

1. 进入已导入 Sheet 的业务含义复核，先从第一批核心 Sheet 开始。
2. 每张 Sheet 按业务含义、主对象、主键/唯一约束、关系基数、主展示字段、来源证据字段和页面归属逐项确认。
3. 根据复核结果修正前端关系展示，优先解决“技术上可显示但业务表达不准确”的页面。
4. 完成第一、第二、第三批复核后，再决定是否生成 `lifecycle-knowledge.json` 并深化安全开发维度。
5. PPT / Draw.io 多格式增强仍属于后续正式 Phase 7，不在当前立即启动。

## External Review / ChatGPT Handoff

- 最新外部 review 资料：`docs/00-overview/current-plan-for-chatgpt-review.md`
- 外部 ChatGPT review 已完成，当前采纳结论是：先做已导入 Sheet 业务含义复核，不进入正式 Phase 7。
- 外部 ChatGPT 生成的 UI 代码或临时 Step 编号，只作为 review / prototype 输入，不自动成为本项目正式 Phase。
- 只有当外部建议与本项目的数据契约、ETL、前端信息架构、用户工作流存在明确共通性时，才由主控 Agent 整合进 `task_plan.md`、`docs/` 或 `open-issues.md`。

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
