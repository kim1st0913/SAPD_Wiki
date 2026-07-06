# CURRENT_STATE: SAPD Wiki

本文件用于 Codex 每次开工前快速读取，帮助主控 Agent 避免默认加载过长历史文档。

## 当前主线

- 2026-07-06 `OI-189` 已关闭，用户确认验收通过：LC-DT 数据重要程度安全策略矩阵以源表 `LC-DT 安全技术服务、模块、策略映射表` 的单行作为权威粒度，禁止按阶段全集或模块全集扩展单行服务。已重新导出 `lifecycle-knowledge.json`、`lifecycle-workbench.json`，并固化全局 / 局部搜索定位规则：生命周期搜索结果必须通过 `route + selected_process_id + target_ref` 定位到矩阵行或具体 chip。源 Excel、SQLite、字典包、标准包、环境包、用户 Issue / 批注数据库和 macOS 打包产物未修改。
- 2026-07-06 文档与 Issue 治理规则已收敛：当前非归档 Markdown 文档约 `107` 个、`31540` 行，后续默认不为小修、小 bug、一次性排查或临时方案新增文档；默认不为低严重性小问题新建 `OI`。只有全局契约、数据 / 审计 / 安全边界、中高严重性、无法本轮闭环、或需要用户业务判断 / 人工验收的问题才进入 `docs/06-implementation/open-issues.md`。修复后若需要用户验收，最终反馈必须明确给出固定入口、导航路径、预期现象和关闭条件。
- 2026-07-06 问题台账继续按用户验收口径收敛：`OI-146 / OI-147` 已按源表 `作用域-安全技术服务-安全技术模块映射` H 列合并单元格展开后的目标级安全系统关系修复并二次复核关闭；`OI-135` 已按用户确认关闭归档。当前 `docs/06-implementation/open-issues.md` 未关闭问题数为 `3`，已关闭归档问题数为 `188`。剩余未关闭项为 `OI-157`、`OI-138`、`OI-128`。本轮固化规则：环境映射中的安全系统关系只允许来自源表行级服务-目标组合及其 H 列事实；不得从安全技术服务级聚合系统反推到模块 / 措施，不得让源表 H 列为空的目标继承系统，也不得保留源表不存在的服务-目标组合。`API网关` 的权威源行为第 `205-209` 行，均归属 `应用安全防护`；此前把第 `198` 行 `I-AP&T-AS.AM-01 / API安全防护` 误写成 `API网关` 的反例已纠正。`OI-135` 最终契约为“发布级干净基础库 + 用户库独立迁移 + 中间产物隔离”：`security_work` 源表关系行可重复，但 `knowledge_items` 主对象必须唯一；已正式替换 `data/database/sapd_wiki.sqlite3` 为 clean base stable candidate，正式基础库 `security_work=80`、重复标题 `0`、`knowledge_items.stable_ref=4678/4678`。真实 `data/user/sapd_wiki_user.sqlite3` 已完成 2 条 legacy target_ref 迁移，`user_target_ref_migrations` 写入 `applied=2`，正式库组合审计 `legacyBaseRefs=0`；运行时和打包创建入口已统一到 `user_schema_0.3`，触发用户 API 后正式用户库 `user_meta.schema_version=user_schema_0.3`。正式 apply 报告与回退路径见 `data/exports/worker-verify/oi-135-formal-apply/20260706T063552Z/oi135-formal-apply-report.md`。
- 2026-07-06 `OI-188` 已关闭，用户确认验收通过：`M-* -00` 管理类安全技术服务全局搜索最终契约为“双目标返回 + 精确定位”，即 `/knowledge/technical-services` 字典定义结果和 `/capability-mapping` 能力关系结果都是合法目标；字典结果必须展开并定位服务清单具体行，能力关系结果必须打开 `技术视角` 并定位对应安全技术服务 chip。不得再把两类结果误判为竞争关系并过滤其中一个。
- 2026-07-05 `OI-176 / OI-177` 已关闭，用户确认验收通过：字典引用的 `type/id/code/title` 必须以权威字典为准，`scope_type` 统一从 `maintenance/scopes.json` / 安全能力作用域目录取 canonical title；安全技术模块与安全技术措施不得跨粒度兜底，`主机防火墙`、`主机恶意代码防护`、`主机入侵防御（HIPS）`、`终端安全工作区` 不得以 `security_technical_measure` 类型出现在运行包或 split projection。已修改导出层、split 生成层、字典一致性审计，并受控修正当前正式 `public/data` 运行包；未修改源 Excel、SQLite、标准包、用户 Issue / 批注数据库或 macOS 打包产物。当前验证：字典引用审计 `errors=0`（仅剩既有 `work-function-candidate` warnings）、定向反例探针 `scopeOldTitle=0 / forbiddenMeasureTyped=0`、OI-149 split candidate / formal runtime、基线完整性、JSON 边界、GitHub 数据边界和内容 smoke 均通过。
- 2026-06-20 Object Scope `163 vs 230` 已定性并修正审计口径：原始 `作用域-安全技术服务-安全技术模块映射` E 列中一个合并单元格可包含多个作用域，必须按 scope code 拆分为多个规范 `objectScopeRelations`；不得把整格组合文本作为一个独立 scope。已修正 `scripts/audit_scope_service_module_mapping.py` 的 current helper：优先读取正式 `relations.applies_to_scope`，tree fallback 也会拆分组合 scope 文本；回归计数 `currentCompositeScopeTitleIssueCount=0`。当前 `sourceObjectScopeRelations=163`、`candidateObjectScopeRelations=163`、`formalRelationsAppliesToScope=163`、`helperNormalizedObjectScopeRelations=163`、`helperOnly=0`、`candidateMissing=0`。本次只修审计口径和 worker-verify 报告，未改原始 Excel、SQLite 或正式 `environment-workbench.json`。
- 2026-06-20 Environment Mapping 业务规则已修正并固化：`信息化环境 - 信息化对象 - 安全技术服务 - 安全技术模块 / 措施` 是架构师定义的字典型结构，对象下已填写的服务、模块和措施就是对象级正式定义。不得用全局安全技术服务-模块理论关系反推每个对象必须补齐全部模块 / 服务；原 `581 / 59 coverage gap` 口径废弃，只保留为全局目录对照项，不是业务缺口、错误、风险、blocker 或业务待确认主流程。后续 Environment Mapping hard error 只检查服务引用一致性、模块 / 措施引用一致性、已填写服务+模块/措施组合一致性、系统+模块归属一致性、信息化环境 / 对象引用、1:N 关系导出展示、`pendingRelationCount`、`invalidRowCount` 和 code/title/id 一致性。当前状态为 `environmentMappingStatus=CONTROLLED_SOURCE_CANDIDATE_HARD_ERRORS_CLEAR_PRE_APPLY_VERIFICATION_READY`，可以做 pre-apply verification，但仍不是 `READY_TO_REPLACE`，不得未经用户确认正式替换 `environment-workbench.json`、`node-details` 或正式 review checklist。
- 2026-06-15 P0 临时优先级：`OI-140` 知识库字典、安全标准 / 框架和生命周期基线事故已止血，并完成 SQLite 事实源重建；当前运行基线与 SQLite 导出基线已对齐，关闭前只读巡检通过，`OI-140` 已关闭并归档。标准 canonical title 已由用户确认并作为正式显示名，4 个生命周期来源安全技术措施已确认并补入前端维护基线。当前不再继续 P0 事故修复写入线，后续任何原始数据修改、导入、导出或 workbench 重建，都必须先基于 runtime baseline 生成候选包和 normalized diff，不允许全量重导或直接覆盖。
- 2026-06-15 `OI-142 / Security Technical Service Catalog Visibility` 已完成 `AD-01` 分组位置修复和真实浏览器取证，用户已验收：上一轮曾错误将安全技术服务清单改为按服务编号优先排序，现已回退。随后用户截图证明 `I-DI&T-AS.AD-01 数据分库分表` 被排到 `I-DI` 分组底部；真实根因是 `compareTechnicalServiceRows` 使用 `(Number(sortOrder) || 999999)`，把能力树第一个关注点的合法 `sortOrder=0` 误判为缺失。当前已改为保留 `0` 的有限数字比较，默认排序为 `安全能力 / 关注点顺序 -> 服务字典 sourceOrder -> 服务编号兜底`，实际加载版本为 `technical-service-order-visibility-20260615-2`。专项审计和真实 Chrome 截图确认 `I-DI&T-AS.AD-01`、`I-NT&T-AS.AD-01`、`I-AP&T-AS.AD-01`、`I-HD&T-AS.AD-01`、`I-OS&T-AS.AD-01`、`I-PE&T-AS.AD-01` 均为各自分组第 1 行；服务字典、split 包和 index 均为 `160`，最终表格服务行 `160`，`missingRenderedServices=0`。
- 2026-06-16 `OI-143 / Security Technical Service Reference Integrity` 已修复并进入待观察：清单页和服务字典已对齐，此前全工程服务引用专项审计发现正式运行包、supporting data 和 review 派生产物仍有旧安全技术服务引用。当前按“只修引用、不改字典、不重导、不恢复 Environment Mapping 写入线”的边界新增候选生成脚本，输出目录为 `data/exports/worker-verify/security-technical-service-reference-candidate/`。用户已逐文件确认并正式替换 `lifecycle-knowledge.json`、`lifecycle-workbench.json`、`maintenance/scopes.json`、`shared-lookups.json`，备份分别位于 `formal-apply/20260616T023312Z/`、`formal-apply/20260616T030941Z/`、`formal-apply/20260616T031255Z/maintenance/`、`formal-apply/20260616T031710Z/`。随后备份并重生成 `review/environment-manual-review-checklist.json`；因生成脚本原样带入源表 / consistency rows 中旧服务 raw value，已最小修正 `scripts/build_environment_manual_review_checklist.py`，让 review 输出按 `maintenance/services.json` canonical 化安全技术服务字段，重生成前备份位于 `formal-apply/20260616T032739Z/review/`。当前安全技术服务引用专项审计已 `pass`：`issueCount=0`、`formalRuntimeIssueCount=0`、`nonRuntimeIssueCount=0`；未修改服务字典、SQLite、原始 Excel、Environment Mapping、标准包或前端 UI。
- 2026-06-15 `OI-141 / LC-DT Source Update` 当前状态：安全技术服务字典已受控更新到 `160` 条；用户确认的 LC-DT 源表问题 1-6 已按字典写回原始 `data/raw-samples/wiki sample.xlsx`，问题 7 的 `数据流转监测和泄漏防护` 已补入 `LC-DT 数据生命周期` 表。当前 LC-DT 源表审计为 `ready`：双表 7 个阶段一致、服务引用 `156/156` 命中字典、模块 / 措施引用无新增候选、待确认问题为 0。已按用户确认正式替换 `frontend/capability-browser/public/data/lifecycle-workbench.json`，替换前备份为 `data/exports/worker-verify/lcdt-source-update/formal-apply/20260615T115526Z/lifecycle-workbench.before-lcdt-preapply-20260615T115526Z.json`；旧 hash 为 `c0f727ff1f74c83a9f9f48b5af9231b8fb11b76c9313a82ee9647691f73a7a83`，正式替换后 hash 为 `f69e7afc7dbae2d784769b0c81cf3f39e9b4f6041e3ef6d56d0f3f4e753a0674`，业务内容与候选包语义一致。维护包、能力包、环境包、标准包、SQLite 和原始 Excel 未在本轮替换中修改。
- 2026-06-15 已按用户批准完成 `P0 Source-of-Truth Reconciliation 1.2`：替换前已备份当前 SQLite 到 `data/exports/worker-verify/p0-source-of-truth-reconciliation-1.2/pre-replacement-backup/sapd_wiki.before-p0-sotr-1.2.20260615-162417.sqlite3`。替换前 current hash 为 `52470cbd6fd7cb15852fba352705dd6f028b21f06ffa580cbf7f6edcd5c49f0b`，候选库与替换后 current hash 均为 `7880968a6d10cf2ed4d4b3546329098d555ca265e5965c2f3e23327c058fc8eb`。替换后 6 类受保护类型计数为 `work_function_layer=4`、`work_function=86`、`security_work=80`、`process_reference=78`、`application_system_type=3`、`standard_control=3416`；`audit_dictionary_standard_baseline_integrity.py`、`audit_protected_baseline_no_regression.py`、`audit_json_package_boundary.py`、正式 JSON hash check 和内容级 smoke 均通过。正式 `public/data` 未覆盖，runtime baseline JSON hash 保持一致，未执行全量导出 / core reset，未恢复 Environment Mapping 写入线；`OI-140` 已关闭，归档于 `docs/05-archive/open-issues-history/2026-06.md`。
- 2026-06-15 已完成 `P0 Recovery Runtime Baseline Freeze 1.0`：当前前端冻结 JSON 已固化为运行基线，产物目录为 `data/exports/worker-verify/p0-runtime-baseline-freeze/`，包含 `runtime-baseline-manifest.*`、`runtime-baseline-counts.*`、`runtime-baseline-risk-boundary.*` 和 `future-source-data-change-procedure.md`。关键计数为 `securityWorks=80`、`securityProcesses=10`、`workFunctionLayers=4`、`securityTechnicalMeasures=30`、`standards.controls=4893`、`managementMapping=613`、`standardMapping=4033`、`lifecycle.relations=542`、`standards.frameworks=7`。冻结当时 SQLite hash 记录为 `52470cbd6fd7cb15852fba352705dd6f028b21f06ffa580cbf7f6edcd5c49f0b`，6 类受保护类型计数均为 `0`；该缺口已在 1.2 替换后补齐。
- 2026-06-15 已完成 `P0 Source-of-Truth Reconciliation 1.1`：基于当前运行冻结 JSON、当前 SQLite 和 2026-06-01 SQLite 备份生成隔离候选库 `data/exports/worker-verify/p0-source-of-truth-reconciliation-1.1/protected-baseline-reconciled-candidate.sqlite`，候选库 hash 为 `7880968a6d10cf2ed4d4b3546329098d555ca265e5965c2f3e23327c058fc8eb`。当前 SQLite 6 类受保护类型在候选库中已补齐；候选导出目录为 `data/exports/worker-verify/p0-source-of-truth-reconciliation-1.1/exports-candidate-sqlite/`，未覆盖正式 `public/data`。候选导出 vs 运行冻结 JSON normalized diff 为 `0`，候选库 baseline audit 与 JSON boundary audit 均通过，readiness 为 `ready_for_manual_approval`；该候选库已在 1.2 用户批准后替换正式 SQLite。
- 2026-06-15 新主控接手后完成页面运行态轻量验收与恢复状态封存：`review_standard_framework_canonical_names.mjs` 返回 `requires_user_confirmation=0`；`audit_capability_standard_mapping_canonicalization.mjs` 返回重复标准组、重复控制项、占位控制项、未匹配标准映射均为 `0`；`frontend_content_smoke_check.mjs --url http://127.0.0.1:5173` 返回 `pass`，代表对象 API 均为 `dataState=ready`；`frontend_smoke_check.mjs` 覆盖 `/standards/mlps-level-3`、`/standards/cis-csc-v8`、`/knowledge/management-workflows` 均通过且未启动系统 Chrome。已重新生成 `data/exports/worker-verify/p0-recovery-stable-snapshot/`，快照 `fileCount=54`，`audit_json_package_boundary.py` 为 `errors=0 warnings=0`，`check_github_data_boundary.py` 为 OK。
- 2026-06-15 已完成 `P0 Baseline Canonical Data Correction 1.1`：已按用户确认正式补入 4 个生命周期来源安全技术措施，正式维护包 `security_technical_measures=30`；新增项为 `应用程序威胁建模`、`制品安全加固`、`IaC代码安全测试`、`数据销毁`，来源证据来自 LC-AP / LC-DT。标准 / 框架名称后续已按用户确认，以 `安全能力映射` 中的 canonical 名称同步到左侧目录、`standards-data.json`、`standards-index.json` 和标准分片标题；报告入口为 `data/exports/worker-verify/standard-framework-canonical-name-review.json/md`，当前 `requires_user_confirmation=0`。
- 2026-06-15 已完成 `P0 Source-of-Truth Reconciliation 1.0`：只读对账与候选库生成完成，产物位于 `data/exports/worker-verify/p0-source-of-truth-reconciliation/`。候选库 `protected-baseline-reconciled-candidate.sqlite` 复制当前 SQLite 后只补入当前缺失且 2026-06-01 备份存在的 reconciliation 范围对象；6 类受保护缺失类型在候选库中已补齐，候选库基线审计 `errors=0 warnings=0`。此前候选 / 2026-06-01 备份比正式前端维护包多出的 4 个 `security_technical_measures` 已在 `P0 Baseline Canonical Data Correction 1.1` 中正式补入前端维护基线，不再作为旧 B 类误恢复风险；SQLite 恢复已在 1.2 用户批准后按备份、替换、审计流程完成。
- 2026-06-15 已完成 `P0 Baseline Recovery Closure 1.5`：当前可运行恢复状态已备份到 `data/exports/worker-verify/p0-recovery-stable-snapshot/`，manifest 为 `snapshot-manifest.json/md`；修改边界、根因分析、防复发方案和人工核对计划分别位于 `data/exports/worker-verify/p0-recovery-modification-boundary.*`、`p0-root-cause-analysis.*`、`p0-prevention-plan.*`、`p0-post-recovery-manual-validation-plan.md`。当前应先人工核对数据准确性，不继续 Environment Mapping Triage、正式 UI 字段对齐、maturity、新页面或视觉修复。
- 2026-06-15 追加完成 `P0 Capability & Work Dictionary Binding Recovery 1.4` 和 `P0 Security Work List Empty Page Fix`：`安全管理工作/流程清单`、`安全能力映射 -> 管理视角`、`安全能力映射 -> 标准 / 框架映射` 的前端数据投影已恢复；当前 `securityWorks=80`、`securityWorkRows=92`、`navigationSecurityWorks=80`、`tabSecurityWorks=80`、`securityWorkFocuses=91/91`、`managementMapping=613`、`standardControl=1745`、`standardMapping=4033`。已将 `index.html` 脚本版本提升到 `p0-capability-work-binding-20260615-2`，并修正安全工作清单计数优先取维护包，避免浏览器继续加载旧 `viewModels.js` 或维护页计数来源不足造成空表 / 0 计数。报告入口：`data/exports/worker-verify/p0-capability-work-binding-audit.json/md`；内容级 smoke 入口：`node scripts/frontend_content_smoke_check.mjs --url http://127.0.0.1:5173`。
- 标准 / 框架页面卡死已定位为 `standards-index.json` / `standards-data.json` 的 `dataPath` 指向 `/private/tmp/...` 临时恢复目录；当前已修复为 `./public/data/standards/...` 相对路径，并在导出器、审计脚本和前端加载兜底中加防线。
- `P0 Baseline Incident Containment & Selective Recovery 1.2` 历史结果：当时将 `security_technical_measures` 从 30 回滚到 26；2026-06-15 后续复核确认其中 4 项生命周期来源措施应纳入，`P0 Baseline Canonical Data Correction 1.1` 已正式补回到 30。`lifecycle-workbench.json` 已补回 `relations=542`；报告入口为 `data/exports/worker-verify/p0-*.json/md`。
- `bootstrap-local-data --profile core --reset` 已在 `src/sapd_wiki/cli.py` 增加保护基线拦截；如确需执行，必须先取得用户明确授权并使用 `--allow-protected-baseline-reset`。
- 在用户确认前，暂停 Environment Mapping 后续治理、正式 UI 字段对齐、reimport 和 maturity / Phase 7。
- 已导入 Sheet 的业务含义复核 + 前端关系展示校正。
- 用户已明确优先解决“执行线太多 / 子 Agent 不稳定 / 长会话效率下降”问题；后续默认先按 `docs/07-governance/execution-line-convergence-workflow.md` 收敛到单一主控和单一写入主线，再继续新功能。
- Delivery Bundle 1.0-alpha ZIP 解压即用交付版已完成 macOS alpha 准备，但当前打包任务先往后排；后续待用户库长期治理和 `stable_key` / 基础库升级兼容设计稳定后再恢复。
- 当前重点不是新增数据源，也不是扩展新模块，而是把已导入数据的业务语义、页面归属和关系展示校正清楚。
- Frontend Baseline 1.0 已确认作为当前前端对齐工作的基线说明。
- 前后端分离本轮已阶段性收口，收口说明见 `docs/01-architecture/frontend-backend-separation-closure.md`。

## 当前页面范围

Frontend Baseline 1.0 当前覆盖四页：

1. `安全能力映射`
   - 主视角：安全能力 / 安全关注点。
   - 技术视角：安全关注点 -> 作用域 -> 安全技术服务 -> 安全技术模块 / 安全技术措施。
   - 管理视角：安全关注点 -> 管理工作 -> 安全流程（L2 流程组 / L3 流程 / L4 活动）或安全职能（4 层）。
2. `LC-AP安全开发生命周期`
   - 主视角：LC-AP 安全开发生命周期阶段。
   - 核心关系：阶段、主要活动、安全活动、安全策略要求、开发技术服务、安全技术服务、安全技术模块、安全技术措施、开发类产品组件、来源证据。
3. `信息化环境维度`
   - 主视角：信息化环境 / 环境子类 / 信息化对象。
   - 核心关系：环境、环境子类、对象、作用域、安全技术服务、安全技术模块、安全系统、产品、来源证据。
   - 该页是第一批核心数据的第三个业务视角，不是新 Sheet 扩展。
4. `LC-DT数据生命周期安全`
   - 主视角：LC-DT 数据处理过程。
   - 核心关系：数据处理过程、处理子场景、安全技术服务、安全技术模块、安全技术措施、来源证据。

## 当前禁止事项

- 不默认启动 Phase 7 多格式增强。
- 不默认启动 maturity M1。
- 不默认新增 Sheet 扩展。
- 不默认重构数据库 schema。
- 不默认大改 ETL。
- 不默认引入 React / Vue 重构当前静态 MVP 前端。
- 不默认大规模搬迁目录、重排文档编号或大拆 `app.js` / `styles.css`；结构治理优先采用索引、说明、归档和小步收口。
- 不在主展示区暴露非业务字段：`sheet`、`row`、`column`、`raw_value`、`source_file`、`import_id`、`source_id`、`source_ref`、`source_label`、`debug`、`raw`、`metadata`、`intermediate`、`generated_at`。
- 不静默覆盖用户文件或未确认业务判断。
- 不允许提交或同步原始数据、SQLite 数据库、ETL 中间产物、前端生成 JSON、指南 / 标准生成资源或导出包到 GitHub；提交前可用 `python3 scripts/check_github_data_boundary.py` 检查。
- 不允许新增页面绕过 `dataClient` 或 `/api/v1/*` 契约直接读取原始数据、数据库或临时 JSON。
- 不允许前端组件实现 ETL、主数据归一、跨表匹配、成熟度评分或业务关系推断。

## 全工程前后端分离规则

- 后端负责数据导入、清洗、标准化、匹配、关系生成、评分、校验、导出和页面数据投影。
- 前端负责导航、布局、筛选、交互状态、表格 / 树 / 关系视图展示和用户反馈。
- 所有页面数据优先通过 `/api/v1/*` 本地 API 和 `dataClient` 消费；`public/data/*.json` 仅作为后端生成的离线兼容包或 API 不可用时的 fallback。
- 新增页面、字段、关系或 maturity 能力前，先更新后端契约和文档，再进入前端实现。
- ViewModel 只能做展示层整理，不承担业务事实生成、关系推断、评分和客户评估结论。

## 当前下一步

2026-06-05 起主控接管到当前线程 `019e966d-81e1-7261-bd89-370c41a8c90e`；旧 `product design Review` 线程 `019e8b6d-8ae3-7d20-8436-3024c4683891` 降级为历史产物来源 / 待 fan-in，不再默认拥有写入权。后续复杂实现优先采用“轻主控 + 专项 subagent / 专项会话 + fan-in 验收”，主控只做调度、边界、验收、状态更新和 checkpoint。

`OI-128C` 最新结论：用户 2026-06-05 后续抽查提出的定位高亮落到文字后方、L0-L2 批注无常态高亮、普通态高亮线需要加深加粗但不遮挡文字、指南 / 幻灯片页无法添加批注等问题已修复，并已基本验收通过。当前批注设计已作为全局基线固化到 `docs/06-implementation/global-annotation-requirements-and-regression-matrix.md` 和 `docs/06-implementation/frontend-global-design-baseline-2026-05-30.md`；后续新增页面必须按“新页面接入清单”声明页面对象、值锚点、行锚点、幻灯片 / 子页上下文和回归命令，不再逐页重新调试。2026-06-06 已完成 `OI-128C` checkpoint：`b93a9f1 Finalize OI-128C annotation baseline`。后续只按 bug fix 处理，不继续开发新的批注功能或混入工作台 V2 / V3。

当前先进入执行线收敛 P0：验收 dirty worktree、同步治理入口、明确 checkpoint，再继续前端、数据或 Delivery Bundle 功能线。不要在 dirty diff 未验收前启动新的并行写入任务。

2026-06-06 已完成总 backlog 收敛，入口为 `docs/07-governance/backlog-convergence-2026-06-06.md`。当前 dirty worktree checkpoint 已完成：`e23c6d7 Document backlog convergence and frontend planning` 固化 Product Design 审阅、dashboard 契约草案和 backlog 收敛；`f305d1a Checkpoint DB governance and route stability` 固化用户库 / stable key 治理、临时库 smoke 和 `OI-136 / FE-ROUTE` 深层路由修复。用户已明确：`analytics_summary` 是 P0，但不独占当前最高优先级；Delivery Bundle / 打包任务先往后排。当前已完成三个 P0 代码闭环：`analytics_summary` 已完成 exporter / audit / `data_package_summary` / `dataClient` / dashboard 消费；`OI-135 + DB-11 + DB-2` 已新增 `scripts/migrate_db_contracts.mjs`，提供默认 dry-run、临时库 apply、自动备份、项目真实库写入显式确认门和审计闭环；`OI-128 / OI-135` 已完成工作台总览、数据篮和导出最小闭环，`/api/v1/user/workspaces`、`/api/v1/user/data-baskets`、`/api/v1/user/export-profiles`、`/api/v1/user/exports/preview`、`POST /api/v1/user/exports` 和 `GET /api/v1/user/exports/:id/download` 均具备 token / 临时 runtime smoke；2026-07-06 `OI-135` 已完成真实库 apply：clean base stable candidate 已替换正式 `data/database/sapd_wiki.sqlite3`，真实用户库 2 条旧 UUID target_ref 已迁到 stable ref 并记录 `user_target_ref_migrations`。当前导出文件为受控 JSON 验证闭环，不是最终多格式契约。导出格式与字段边界契约入口为 `docs/06-implementation/user-export-format-contract.md`；用户已确认后续导出表格基本参考原始数据，优先 Excel / CSV / Markdown，幻灯片材料导出 PDF，第一批业务数据集为能力全量映射、信息化环境安全映射、字典与标准框架数据，且 CSV / Excel sheet 字段草案已固化。`scripts/audit_analytics_summary_contract.mjs` 可验证 `capability_focus=91`、覆盖率分母、标准控制项 `1745 / 4893` grain 分离、禁止字段泄露、`dataClient` 契约和 dashboard 消费契约；生成 JSON 仍属于前端离线数据包，不纳入 Git。下一步如继续后端主线，可确认关闭 `OI-135` 或进入第一批业务导出数据集的导出器实现，不再做泛化周边评估。

当前多任务、模块线程和实际 Codex thread id 追踪入口为 `docs/07-governance/current-execution-lines.md`。暂停任务前必须先登记状态、证据、恢复条件和下一步；已有模块线程必须映射到 `EL-xxx` 执行线，避免多会话收敛后丢失任务线。当前已盘点 18 个 cwd 属于本工程的 Codex 线程；`archimate建模` 已进入 idle / 待验收状态，后续页面效果与加载优化走 `OI-133 / EL-025`；`数据安全页面1` 仍显示为运行中线程，主控只做 fan-in，不默认停止或抢写同一范围。长会话需要换新会话时，按 `docs/07-governance/execution-line-convergence-workflow.md` 的“长会话轮换协议”执行；只有用户明确说“当前会话卡顿，需要交接”或等价表达时，Codex 才能自动创建同名递增新线程、写入交接包并在当前会话最终回复后归档。没有明确卡顿交接请求时，不得自动创建新线程。

安全能力映射页数据加载反复回退已登记为 `OI-132 / EL-024`。后续继续修改安全能力页前，必须先做数据加载稳定性治理：区分真实空数据、workspace-view 未加载、projection fallback、完整 workbench fallback、对象 mismatch 和重渲染缺失；不得再用局部空态文案或组件补丁替代加载契约治理。

ArchiMate 建模语言页显示效果和加载效率已登记为 `OI-133 / EL-025`。当前页面已按用户最新纠偏修正：恢复两层标题结构，最大标题为 `安全架构建模语言`，第二标题为 `ArchiMate® 3.2 - 企业架构建模标准`；tab 组跟在最大标题后面并居右，`全页面显示` / `下载 PDF` 跟在第二标题后面；下方区域阅读器和不精确热区均已删除；主体只保留可纵向滚动的整张 ArchiMate Poster；点击图片或 `全页面显示` 时在当前页面内打开 Image Lightbox / Fullscreen Modal，不使用新窗口、`Blob` 页面或浏览器原生下载栏；预览层深色底色、默认 contain 适配屏幕、右上角关闭、Esc 关闭、点击遮罩空白关闭，工具栏只保留放大、缩小和适应，支持鼠标滚轮缩放和按住拖动平移；本地整图预览资源已从 PDF 重新导出为 `6741 x 4768` 高分辨率 JPG；正常页面 Poster 已去掉多余 padding，让图片与容器宽度贴合。当前状态为 `已修复 / 待人工验收`。

信息化环境首页 draw.io 底图导入已登记为 `OI-137`。用户明确要求导入 draw.io 第三页 `信息化环境及对象底图`，作为信息化环境安全能力映射首页实例图，不能复用 `SAPD 元素图例` 样例文字；最新方向已改为“可绑定业务数据的语义 HTML 底图”，不是纯 SVG Viewer，也不是重新设计。当前按 fallback 直接解析 `.drawio` 第三页 `mxGraphModel`，以原始 `mxCell` / `mxGeometry` / `style` / `edge` 为唯一结构和坐标来源，生成 `frontend/capability-browser/generated/environmentBasemap.html`、`environmentBasemap.css`、`environmentBasemap.generated.js` 和 `environmentBasemap.semantic.json`：每个 vertex 转成带 `data-mx-id` 等属性的绝对定位 HTML 节点，每条 edge 转成 SVG overlay 连线。当前状态为 `已修复 / 待人工验收`；由于本机没有 `drawio` / `diagrams.net` CLI，复杂 draw.io 私有图标和 edgeStyle 自动路由为近似映射，若人工验收要求官方像素级一致，再恢复官方 draw.io / diagrams.net 导出器链路。

`OI-137` 信息化环境页设计要求已按用户 2026-06-08 多轮反馈固化，后续继续修改该页必须先按以下约束验收，不能再凭感觉补控件：

- 视觉基准：严格参考 `安全架构建模语言 / ArchiMate® 3.2 - 企业架构建模标准` 页面内容面板，而不是重新设计一套底图工具栏。
- 主标题区：`信息化环境安全能力映射` 右侧只保留 `环境底图 / 归纳表格` tab；`导出数据`、`编辑映射` 属于未定义功能入口，必须删除，后续由用户单独定义后再加。
- 内容面板：使用 ArchiMate 内容面板同类结构和视觉语言；二级标题为 `信息化环境及对象底图`，语义与字体必须和 ArchiMate 二级标题一致，即 `h2` + 同一 CSS 标题规则。
- 二级标题右侧：只放真实可用操作。当前没有 PDF 下载，因此只保留和 ArchiMate 同样按钮样式的 `全页面显示`；不得显示统计胶囊，不得显示 `适应 / − / +` 可见缩放按钮组，不得让工具条单独换行漂出。
- 底图下方：删除固定提示栏 `点击底图中的业务对象查看详情。`；节点详情 / 关系高亮如需恢复，必须另行按用户定义设计，不得默认加一条说明栏。
- 交互保留：底图仍可默认适应、滚轮缩放、拖拽平移和全页面显示，但这些能力不等于需要在标题栏暴露一组可见缩放按钮。
- 底图内部：`Environment Basemap Draw.io Style Fidelity & Canvas Bounds Fix 1.0` 已执行。必须按 draw.io 图例渲染信息化对象右上角角标，当前 semantic 区分视觉 `drawioType / iconType` 与业务 `objectType / bindStatus`；已识别 `grouping`、`location`、`communication_network`、`facility`、`application_component`、`node`、`device`、`system_software`、`data_object` 和 `actor`。有效内容边界归一化为 `contentBounds={minX:160,minY:150,maxX:3150,maxY:2180,padding:48}`，canvas 为 `3086×2126`；生成底图自身背景为透明，不再叠加 Draw.io 白板网格。没有 source / target 的自由箭头按 mxPoint 绘制；带 source / target 但显式端点漂出对象过远的边线回贴到源 / 目标对象之间。
- 验收断言：`AppShell` 不含 `导出数据` / `编辑映射`，`EnvironmentLocalRelationMap` 不渲染 `data-environment-basemap-action` / `data-environment-basemap-zoom-label` / `environmentBasemapSelection`，标题使用 `h2`，CSS 不保留旧 `environment-basemap-toolbar` / `environment-basemap-tool` 可见工具条样式。

Delivery Bundle 1.0-alpha 当前后排保留：正式设计入口为 `docs/09-delivery/zip-bundle-1.0-alpha-design.md`；ZIP-UAT-0 已完成 macOS arm64 内部试发准备，alpha 试发材料已固定到 `/Users/kim1st/Documents/kim note/04_workspace/research/知识库工程/sapd wiki bundle/dist/releases/0.1.0-alpha/`，包含 macOS ZIP、checksum、release manifest、README、UAT checklist 和反馈模板。Windows 构建脚本和验收清单已就绪，但 Windows 原生 `SAPD-Wiki-Backend.exe` 仍需 Windows x64 环境实测；release manifest 中 Windows 保持 `pending / not_verified`。后续待 user DB / `stable_key` 前置设计稳定后再恢复打包任务。

优先推进 Frontend Baseline 1.0 的三页 Gap Check 和必要校正：

1. 先做只读差距检查，明确页面现状、缺口、风险和涉及文件。
2. 用户确认后，再进入小范围前端实现。
3. 实现时优先复用当前前端、`dataClient`、后端 API / 数据包契约、ViewModel 展示整理和统一组件风格。
4. 若发现数据缺口，记录为数据契约或待确认问题，不在前端临时硬编码业务关系。

## 必读文件

每次开工建议先读：

- `AGENTS.md`
- `CURRENT_STATE.md`
- `docs/00-overview/master-context-restore.md`

按任务类型追加读取：

- 复杂阶段判断：`task_plan.md`
- 当前关键决策和风险：`findings.md`
- 近期执行恢复：`progress.md`
- Frontend Baseline 1.0 相关任务：`docs/04-user-guide/frontend-baseline-1.0-plan.md`
- 前后端分离继续推进：`docs/01-architecture/frontend-backend-separation-closure.md`
- 问题修复或 bug 核对：`docs/06-implementation/open-issues.md`；查历史已关闭问题时先看 `docs/06-implementation/open-issues-index.md`

## 不必默认读取的长文档

以下文件或目录不要每次开工默认读取，只在任务明确相关时读取：

- `task_plan.md` 的完整历史段落
- `docs/05-archive/findings-history/`
- `docs/05-archive/progress-history/`
- `docs/05-archive/context-slimming-2026-05-15/`
- `docs/08-maturity/`
- `docs/05-archive/`
- `data/exports/`
- `frontend/capability-browser/public/data/*.json`
- 大型前端源码文件，除非任务需要检查或修改对应页面

## 轻量结构治理入口

- `scripts/README.md`：脚本分类、长期工具和专题脚本边界。
- `docs/03-import-etl/README.md`：导入与 ETL 文档索引。
- `docs/06-implementation/open-issues.md`：当前未关闭问题入口；已关闭问题通过 `docs/06-implementation/open-issues-index.md` 定位到归档。
- `node scripts/govern_open_issues.mjs`：Open Issues 轻量治理脚本，用于归档已关闭长记录并刷新全量索引。
- `docs/07-governance/capability-mapping-change-control.md`：安全能力映射页变更分级、暂停条件和治理审计入口。
- `node scripts/audit_frontend_governance.mjs`：前端高风险文件基线审计，防止 `styles.css`、`app.js`、`viewModels.js` 和能力映射关键组件继续无意识膨胀。
- `node scripts/audit_frontend_lazy_load_contract.mjs`：前端按需加载契约审计，检查知识库字典和安全标准 / 框架的 `required` / `supplemental` 分片、标准页 tab loader 和组件内取数边界。
- `node scripts/audit_capability_viewmodel_contract.mjs --url http://127.0.0.1:5173`：安全能力映射页 ViewModel 当前对象一致性审计，验证 L0 / L1 / L2 / 关注点不会误用默认关注点或错粒度 projection。
- 安全能力映射页 `renderCapabilities()` 已拆出显式 `loadState` 阶段，后续继续治理时优先沿该边界推进，不要重新把加载判断写回渲染主体。
- 安全能力映射页对象级契约入口为 `/api/v1/capabilities/workspace-view`；前端通过 `dataClient.getCapabilityWorkspaceView()` 按当前选中对象读取，旧 `workspace-projection` 仅作为兼容 fallback。

## 当前 Agent 工作规则

- 对用户不是开发人员这一点保持友好解释，把复杂任务拆成可确认、可回退的小步骤。
- 复杂任务开始前说明：要解决什么、会读或改哪些文件、完成后得到什么、是否需要用户判断。
- 做较大实现、重构或技术选型前，先确认任务边界并读取必要上下文。
- 默认中文记录说明性内容；代码标识、文件名、命令、字段名、对象 `type`、API 路径保留英文原文。
- 只读任务不得修改文件。
- 如果用户明确禁止读取、运行或打开某类内容，严格遵守。
- 每次任务完成后输出任务完成反馈，说明结论、修改范围、功能结果、验证结果、前端页面提示、数据状态、字段边界和下一步建议。
- 如使用子 Agent，必须明确角色、写入范围、禁止范围和验收标准；完成后主控必须 fan-in 并关闭。

## 重连处理规则

如果后续再次出现多次对话重连、主控长时间不继续、或上下文恢复明显变慢：

- 先执行只读检查：`git status --short --branch`、`wc -l CURRENT_STATE.md task_plan.md findings.md progress.md AGENTS.md`。
- 不要默认读取 `docs/05-archive/`、`data/exports/` 或大型前端 JSON。
- 优先确认是否有未提交的大型上下文文件、未关闭子 Agent 记录或重复计划文件。
- 先做上下文减负和 Git 收口，再继续业务开发。

## Codex 轻量执行入口

当用户只说“继续执行”“执行”“排查一下”“修一下”时，默认按以下顺序处理：

1. 读取 `CURRENT_STATE.md` 和 `progress.md`，必要时读取 `task_plan.md`、`findings.md`。
2. 执行 `git status --short --branch`，确认当前工作区状态。
3. 如果当前任务明确，继续执行；如果不明确，只问用户 1 个问题。
4. 不默认读取 `docs/05-archive/`、`data/exports/`、`frontend/capability-browser/public/data/*.json`、数据库备份或完整历史日志。
5. 不默认运行全量 `ps -ax`、全量 `git diff`、完整 DOM dump 或长 console log。
6. 前端验证默认不启动系统 Google Chrome；优先使用 `python3 scripts/dev_server_guard.py --status`、数据包摘要、语法检查和 `node scripts/frontend_smoke_check.mjs --page <page>` 的轻量 HTTP/API 模式。只有用户明确同意时，才允许传 `--allow-system-chrome` 做系统 Chrome headless 验证。
7. 数据包检查优先使用 `python3 scripts/data_package_summary.py --package <name>`。
8. 本地服务检查优先使用 `python3 scripts/dev_server_guard.py --status`。
9. 本项目常驻预览页固定为 `http://127.0.0.1:5173/`；前端展示和用户验收默认只看该端口。修改 `frontend/capability-browser/` 后必须确认 `5173` 已热刷新到最新文件；若刷新仍旧，执行 `python3 scripts/dev_server_guard.py --restart`，不要另起长期预览端口。
10. 多个线程并行验证时可临时使用其它端口，但验证后必须用 `python3 scripts/dev_server_guard.py --port <temp-port> --stop` 关闭，最终交付地址仍回到 `5173`。
10. 如 `progress.md` 超过 120 行，先归档瘦身；如工作区 diff 很大，建议 checkpoint commit。

详细规则见 `docs/07-governance/codex-performance-workflow.md`。
