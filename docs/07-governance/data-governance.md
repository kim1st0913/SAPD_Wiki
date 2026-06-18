# 数据治理规则

本文档集中记录 SAPD Wiki 当前阶段必须遵守的数据治理规则。目标不是建立复杂治理体系，而是防止 ETL、人工修正、前端展示和后续 Agent 分工出现口径漂移。

## 1. 治理原则

| 原则 | 说明 |
|---|---|
| 数据优先 | 字段定义、映射规则和 ETL 规则先于页面扩展 |
| 来源可追溯 | 每个正式对象和关系必须能追溯来源文件、Sheet、行列、hash 和导入任务 |
| staging-first | 自动导入必须先进入 staging，经 review/approval 后进入正式库 |
| 主数据优先 | 有编码、已确认的主数据优先于映射表中的临时文本 |
| 知识库字典权威 | 数据确认后，知识库字典中的能力、作用域、技术服务、技术模块 / 措施、管理工作、流程和职能是全局引用的权威值 |
| 渐进固化 | 不稳定字段先进入 `metadata_json`，稳定后再提升为正式字段 |
| 问题集中 | bug、数据问题、待确认事项统一进入 `docs/06-implementation/open-issues.md` |

## 1.0 GitHub 数据边界

GitHub 仓库只保存代码、文档、配置模板和脱敏 fixture，不保存真实原始数据和生成数据。

提交前应执行：

```bash
python scripts/check_github_data_boundary.py
```

同一检查已接入 `.github/workflows/data-boundary.yml`，在 push / pull request 时自动运行。CI 失败时，优先检查是否有原始数据、SQLite 数据库、导出包或前端生成数据被 Git 追踪。

禁止提交清单、文件放置清单和本地数据重建流程见 `docs/03-import-etl/github-local-data-initialization.md`。

## 1.1 本地数据库备份保留规则

本地数据库备份目录为 `data/database/backups/`。该目录只用于本机恢复，不提交 GitHub。

全局保留规则：

- 默认只保留最新 `5` 个 `.sqlite3` 备份文件。
- “最新”按文件修改时间排序；时间相同时按路径名稳定排序。
- 出现新备份后，如果备份总数超过 `5`，删除时间戳最早的旧备份。
- 删除前应先运行 dry-run，确认将保留和删除的文件。
- 当前主库 `data/database/sapd_wiki.sqlite3` 不属于备份文件，不参与该规则。

执行脚本：

```bash
python3 scripts/prune_database_backups.py
python3 scripts/prune_database_backups.py --apply
```

脚本默认 dry-run；只有传入 `--apply` 才会删除旧备份。需要临时改变保留数量时使用 `--keep <N>`。

## 1.2 原始表建模确认规则

每建模或导入一张新的原始 Sheet 前，必须先完成业务确认，不允许只根据字段名直接写 parser。

确认内容：

| 确认项 | 必须明确的问题 |
|---|---|
| 业务含义 | 这张表是主数据、映射表、参考资料、说明文档，还是统计汇总？ |
| 主键 | 哪个字段是稳定编码？没有编码时是否使用标题、上下文或复合键？ |
| 字段角色 | 哪些字段是对象，哪些是描述、备注、统计、辅助列？ |
| 关系基数 | 一对一、一对多、多对一、多对多是否允许？ |
| 主从关系 | 与已导入表发生冲突时，以哪张表为准？ |
| 前端用途 | 这张表适合独立维护页、关系页、矩阵页，还是只作为详情补充？ |
| 错误处理 | 统计合计、占位符、半截文本、错字和重复编号如何处理？ |

当前已完成映射表的复核清单维护在 `docs/03-import-etl/completed-sheet-business-confirmation.md`。后续新增 Sheet 时，先补充该清单，再开始 ETL 实现。

## 2. Canonicalization Rules

标准化规则用于把同一业务含义的不同写法统一到稳定编码或标准名称。

| 规则 | 当前处理 |
|---|---|
| `ALL&TI.*` | 标准化为 `ALL&T-IN.*` |
| `ALL&T-TI.*` | 标准化为 `ALL&T-IN.*` |
| `I_US` | 标准化为 `I-US` |
| `&TI.` | 标准化为 `&T-IN.` |
| `&T-TI.` | 标准化为 `&T-IN.` |
| `...` / `…` | 视为占位空值，不生成正式对象 |
| 组织职能字段中的顿号 `、` | 不作为多值分隔符，避免拆坏正式职能名 |

新增标准化规则前，应先在 `open-issues.md` 记录原因、影响和验证结果。

## 3. Deduplication Rules

去重优先级：

```text
稳定编码
>
确认别名
>
标题 + 类型 + 限定上下文
```

当前规则：

- 有稳定编码的对象，优先按 `type + code` 去重。
- 没有稳定编码的对象，按 `type + title + qualifier` 去重。
- 能匹配正式主数据的映射文本，不创建新的无编码对象。
- 同一层级存在同名有编码对象时，无编码重复对象不得导出到前端。
- `security_technical_service` 已确认为全局编码唯一对象；编码由 `作用域 + 能力关注点编号` 组合而成。
- `安全能力-安全技术服务` 是 `security_technical_service` 编码和名称的权威来源。
- 其他表中的同编码安全技术服务只用于建立映射关系，不允许覆盖权威服务名称。
- 如果 active 安全技术服务对象名称与权威表不一致，必须输出数据质量报告并进入 `open-issues.md`。
- `information_object` 使用同一套主数据，按对象名称全局去重；信息化环境和环境分段只作为关系或上下文字段，不参与信息化对象主键。

## 3.1 知识库字典权威引用规则

数据确认后，知识库字典是以下对象的全局权威来源：

| 权威对象 | 权威入口 | 约束 |
|---|---|---|
| 安全能力分类 / 能力域 / 安全能力 / 安全关注点 | `安全能力清单` | 其他页面只能引用同一 `id` / `code` / `title`，不得在引用处改名或新建临时同义对象 |
| 安全作用域 | `安全作用域清单` | 作用域引用以字典中的 `scope_type` 为准 |
| 安全技术服务 | `安全技术服务清单` | 服务编码、名称和 ID 以字典为准，其他 Sheet 只建立关系 |
| 安全技术模块 / 措施 | `安全技术模块/措施` | 模块和措施引用以字典为准，不能把系统、产品或自由文本当作模块 / 措施 |
| 安全管理工作 | `安全管理工作` | 关注点关联的安全工作以字典为准 |
| 流程清单 | `流程清单` | L1 流程域、L2 流程组、L3 流程参考、L4 关键活动以字典为准 |
| 安全职能清单 | `安全职能清单` | 职能编码、名称和层级以字典为准，映射文本只能归并到正式职能 |

执行规则：

- 任何页面、workbench、标准映射或生命周期 / 环境关系包引用上述对象时，若带有 `id`、`code`、`title` 或 `name`，必须与知识库字典权威值一致。
- 只允许后端 ETL / 导出层做主数据归一、别名匹配和对象合并；前端组件和 ViewModel 不得在页面侧自行改名、拼接或推断权威对象。
- 引用数据发现与权威值不一致时，应先输出全量审计报告；若影响页面展示或关系正确性，必须进入 `open-issues.md`。
- 新增导入表、标准映射表或页面投影前，应运行：

```bash
node scripts/audit_dictionary_reference_consistency.mjs
```

## 3.2 字典与标准框架只读基准保护规则

`知识库字典` 与 `安全标准 / 框架` 是业务模块引用的只读基准，不是环境映射、能力映射、生命周期页面或临时核对表的反向写入目标。

受保护数据包：

- `frontend/capability-browser/public/data/maintenance-knowledge.json`
- `frontend/capability-browser/public/data/maintenance/*`
- `frontend/capability-browser/public/data/source-evidence/maintenance/*`
- `frontend/capability-browser/public/data/lifecycle-knowledge.json` 中的应用系统目录
- `frontend/capability-browser/public/data/standards-index.json`
- `frontend/capability-browser/public/data/standards-data.json`
- `frontend/capability-browser/public/data/standards/*`

执行规则：

- 业务模块只能引用、映射或生成差异报告，不得把业务模块的推断结果写回上述基准包。
- 调整字典或标准框架数据必须有用户明确授权；未授权时，只能输出 issue / findings / audit report。
- `coverage gap`、别名、跨表不一致和选择性引用不等于错误，不得自动补齐到基准包。
- 不允许用空数组 fallback 掩盖导出失败；数据包文件存在但核心数组为 0 必须视为基准完整性问题。
- 不允许用 `bootstrap-local-data --profile core --reset` 或 core-only 导出覆盖已存在的字典 / 标准 / 生命周期保护基线；当前 CLI 已默认拦截该操作。确需执行时，必须先取得用户明确授权，使用 `--allow-protected-baseline-reset`，并保留自动备份和后续审计结果。
- 当前 SQLite 若缺少 `work_function_layer`、`process_reference`、`application_system_type`、`standard_control` 等保护类型，不得作为重新生成字典 / 标准基准包的来源。
- 每次数据导入、导出、重导入或正式前端数据包替换后，必须执行：

```bash
python3 scripts/audit_dictionary_standard_baseline_integrity.py
```

如果该脚本出现 `errors>0`，不得继续交付；如果出现 `current_database_missing_protected_baseline_type` 警告，说明当前前端包可能已恢复，但当前 SQLite 不足以重新导出这些基准包，后续导出前必须先确认恢复策略。

## 3.3 P0 恢复收口与修改边界

2026-06-15 已完成 `P0 Baseline Recovery Closure 1.5`，当前恢复状态已冻结为本地快照：

- 快照目录：`data/exports/worker-verify/p0-recovery-stable-snapshot/`
- Manifest：`data/exports/worker-verify/p0-recovery-stable-snapshot/snapshot-manifest.json`
- 修改边界：`data/exports/worker-verify/p0-recovery-modification-boundary.md`
- 根因分析：`data/exports/worker-verify/p0-root-cause-analysis.md`
- 防复发方案：`data/exports/worker-verify/p0-prevention-plan.md`
- 人工核对计划：`data/exports/worker-verify/p0-post-recovery-manual-validation-plan.md`
- JSON 分拆边界审计：`python3 scripts/audit_json_package_boundary.py`

收口后默认冻结规则：

- `A 类 Protected Baseline`：知识库字典、安全标准 / 框架、能力 / 作用域 / 服务 / 模块 / 措施 / 管理工作 / 流程 / 职能 / 应用系统目录，只读引用，修改必须用户明确授权。
- `B 类 Workbench Projection`：`capability-workbench.json`、`environment-workbench.json`、`lifecycle-workbench.json`、`capability-tree.json`、`environmentBasemap.node-details.json` 只允许确认后的定向重建，必须先备份、后 diff、再验证，不得反向写回基线。
- `C 类 Review / Worker-verify`：`data/exports/worker-verify/*` 与 `frontend/capability-browser/public/data/review/*` 只能作为临时审计材料，不得进入正式业务页面或成为正式事实源。
- `D 类禁止触碰数据`：原始 Excel、Draw.io / SVG、数据库 schema、胶囊样式、maturity / Phase 7 数据，除非用户明确授权，否则不得修改。

在完成人工数据准确性核对前，不建议继续 Environment Mapping Triage、正式 UI 字段对齐、maturity、新页面功能或视觉修复。

### 3.3.1 P0 Runtime Baseline Freeze 1.0

2026-06-15 已完成 `P0 Recovery Runtime Baseline Freeze 1.0`，当前前端冻结 JSON 固化为运行基线：

- 冻结目录：`data/exports/worker-verify/p0-runtime-baseline-freeze/`
- Manifest：`data/exports/worker-verify/p0-runtime-baseline-freeze/runtime-baseline-manifest.json`
- 计数报告：`data/exports/worker-verify/p0-runtime-baseline-freeze/runtime-baseline-counts.md`
- 风险边界：`data/exports/worker-verify/p0-runtime-baseline-freeze/runtime-baseline-risk-boundary.md`
- 后续原始数据修改流程：`data/exports/worker-verify/p0-runtime-baseline-freeze/future-source-data-change-procedure.md`
- 生成脚本：`scripts/build_p0_runtime_baseline_freeze.py`

运行基线结论：

- 前端冻结 JSON：当前可运行基线，已人工基本通过。
- 页面运行态：恢复完成。
- 当前 SQLite：1.2 已按用户批准替换为 reconciled candidate，6 类受保护类型已补齐并通过替换后审计。
- `OI-140`：P0 事故已止血，运行基线冻结和 SQLite Source-of-Truth Reconciliation 已完成；关闭前只读巡检通过，当前已关闭。

关键计数：

| 指标 | 当前值 |
|---|---:|
| `securityWorks` | 80 |
| `securityProcesses` | 10 |
| `workFunctionLayers` | 4 |
| `securityTechnicalMeasures` | 30 |
| `standards.controls` | 4893 |
| `managementMapping` | 613 |
| `standardMapping` | 4033 |
| `lifecycle.relations` | 542 |
| `standards.frameworks` | 7 |

后续原始数据修改必须遵守 `future-source-data-change-procedure.md`：用户明确修改项、确认原始表 / 字段 / 关系、判断是否影响 Protected Baseline 与 Workbench Projection、只读审计、候选导入 / 候选 JSON / 候选 workbench、normalized diff、人工确认、备份当前正式数据、定向替换、内容级 smoke、更新 runtime baseline manifest。

禁止事项：

- 全量导入、全量导出、全量恢复。
- 从不完整 SQLite 生成正式包。
- 用业务映射反向改字典 / 标准。
- 忽略 Excel merged ranges；合并单元格是业务关系边界。
- 新增复杂导入条件判断，除非先形成明确业务规则和审计样例。

## 3.4 P0 Source-of-Truth Reconciliation 1.0

2026-06-15 已完成只读事实源对账：

- 对账报告：`data/exports/worker-verify/p0-source-of-truth-reconciliation/p0-source-of-truth-reconciliation-report.md`
- 候选库：`data/exports/worker-verify/p0-source-of-truth-reconciliation/protected-baseline-reconciled-candidate.sqlite`
- 候选导出：`data/exports/worker-verify/p0-source-of-truth-reconciliation/exports-candidate-sqlite/`

本轮边界：

- 不替换 `data/database/sapd_wiki.sqlite3`。
- 不覆盖 `frontend/capability-browser/public/data`。
- 不修改正式页面、原始 Excel、Draw.io / SVG 或数据库 schema。
- 候选库只作为审计材料，不能自动成为正式事实源。

对账结论：

- 当前 SQLite 缺 6 类受保护基线：`work_function_layer`、`work_function`、`security_work`、`process_reference`、`application_system_type`、`standard_control`。
- 候选库从 2026-06-01 备份补入当前缺失的 reconciliation 范围对象后，针对候选库执行 `audit_dictionary_standard_baseline_integrity.py --db ...candidate.sqlite` 已返回 `errors=0 warnings=0`。
- `P0 Baseline Canonical Data Correction 1.1` 已按用户确认把 4 个生命周期来源安全技术措施正式补入前端维护基线，当前正式前端维护包 `maintenance.security_technical_measures=30`；新增项为 `IaC代码安全测试`、`制品安全加固`、`应用程序威胁建模`、`数据销毁`。
- 这 4 个差异不再对应旧 B 类误恢复风险；当前 SQLite 曾缺 6 类受保护基线，后续已在 `P0 Source-of-Truth Reconciliation 1.2` 经用户批准、备份和替换后补齐。

后续若进入 `P0 Source-of-Truth Reconciliation 1.1`，必须由用户明确批准，并至少满足：

- 确认是否用 reconciliation 候选库修复当前 SQLite 的 6 类受保护基线缺口。
- 替换前再次备份当前 SQLite。
- 用候选库导出到隔离目录，normalized diff 通过后才允许替换。
- 替换后立即运行 protected baseline 审计、JSON 分拆边界审计、内容级 smoke 和 GitHub 数据边界检查。

### 3.4.1 P0 Source-of-Truth Reconciliation 1.1

2026-06-15 已完成 `P0 Source-of-Truth Reconciliation 1.1`，只生成隔离候选库、候选导出和 normalized diff；未替换当前 SQLite，未覆盖正式 `frontend/capability-browser/public/data`。

- 输出目录：`data/exports/worker-verify/p0-source-of-truth-reconciliation-1.1/`
- 候选库：`data/exports/worker-verify/p0-source-of-truth-reconciliation-1.1/protected-baseline-reconciled-candidate.sqlite`
- 候选库 hash：`7880968a6d10cf2ed4d4b3546329098d555ca265e5965c2f3e23327c058fc8eb`
- 候选导出：`data/exports/worker-verify/p0-source-of-truth-reconciliation-1.1/exports-candidate-sqlite/`
- 2026-06-01 备份：`data/database/backups/sapd_wiki-before-cleanup-20260601-current.sqlite3`
- 2026-06-01 备份 hash：`d78d974ef1479609218ba42de5e6cbeab4d832fb3872dee9e2f0de0fac3ec4a7`

候选库补齐结果：

| 类型 | 当前 SQLite | 2026-06-01 备份 | 候选库 |
|---|---:|---:|---:|
| `work_function_layer` | 0 | 4 | 4 |
| `work_function` | 0 | 86 | 86 |
| `security_work` | 0 | 80 | 80 |
| `process_reference` | 0 | 78 | 78 |
| `application_system_type` | 0 | 3 | 3 |
| `standard_control` | 0 | 3416 | 3416 |

Normalized diff 结论：

| 对比 | count diff | key-set diff |
|---|---:|---:|
| 当前 SQLite 导出 vs 运行冻结 JSON | 2 | 19 |
| 2026-06-01 备份导出 vs 运行冻结 JSON | 0 | 0 |
| 候选库导出 vs 运行冻结 JSON | 0 | 0 |

候选 readiness：`ready_for_manual_approval`。

说明：

- 候选导出阶段仅在 `worker-verify` 隔离目录内按候选库 `standard_framework` 标题同步标准 canonical title，不修改正式标准数据包。
- 候选库 baseline audit 返回 `errors=0 warnings=0`。
- 候选导出 JSON boundary audit 返回 `errors=0 warnings=0`。
- 1.1 阶段未自动替换当前 SQLite；该候选库已在 1.2 阶段经用户明确批准后用于正式 SQLite 替换。

### 3.4.2 P0 Source-of-Truth Reconciliation 1.2

2026-06-15 用户明确批准后，已完成 `P0 Source-of-Truth Reconciliation 1.2`：用 1.1 reconciled candidate 替换当前正式 SQLite，并完成替换后完整审计。

替换边界：

- 替换对象：`data/database/sapd_wiki.sqlite3`
- 候选库：`data/exports/worker-verify/p0-source-of-truth-reconciliation-1.1/protected-baseline-reconciled-candidate.sqlite`
- 替换前备份：`data/exports/worker-verify/p0-source-of-truth-reconciliation-1.2/pre-replacement-backup/sapd_wiki.before-p0-sotr-1.2.20260615-162417.sqlite3`
- 替换报告：`data/exports/worker-verify/p0-source-of-truth-reconciliation-1.2/sqlite-replacement-report.md`
- 替换后审计报告：`data/exports/worker-verify/p0-source-of-truth-reconciliation-1.2/post-replacement-baseline-audit.md`
- 正式 JSON hash check：`data/exports/worker-verify/p0-source-of-truth-reconciliation-1.2/post-replacement-json-hash-check.md`
- 内容级 smoke：`data/exports/worker-verify/p0-source-of-truth-reconciliation-1.2/post-replacement-content-smoke-report.md`

SQLite hash：

| name | sha256 |
|---|---|
| currentBefore | `52470cbd6fd7cb15852fba352705dd6f028b21f06ffa580cbf7f6edcd5c49f0b` |
| candidate | `7880968a6d10cf2ed4d4b3546329098d555ca265e5965c2f3e23327c058fc8eb` |
| backup | `52470cbd6fd7cb15852fba352705dd6f028b21f06ffa580cbf7f6edcd5c49f0b` |
| currentAfter | `7880968a6d10cf2ed4d4b3546329098d555ca265e5965c2f3e23327c058fc8eb` |

替换后受保护类型计数：

| 类型 | 替换后计数 |
|---|---:|
| `work_function_layer` | 4 |
| `work_function` | 86 |
| `security_work` | 80 |
| `process_reference` | 78 |
| `application_system_type` | 3 |
| `standard_control` | 3416 |

替换后审计结论：

- `audit_dictionary_standard_baseline_integrity.py`：`pass`，`errors=0 warnings=0`
- `audit_protected_baseline_no_regression.py`：`pass`，`errors=0 warnings=0`
- `audit_json_package_boundary.py`：`pass`，`errors=0 warnings=0`
- 正式 JSON hash check：`pass`，runtime baseline JSON hash 全部一致。
- 内容级 smoke：`pass`，代表对象均为 `dataState=ready`，关键计数保持 `securityWorks=80`、`securityTechnicalMeasures=30`、`securityProcesses=10`、`managementMapping=613`、`standardMapping=4033`、`standards.controls=4893`、`lifecycle.relations=542`。

安全边界：

- 已替换正式 SQLite，且替换前已完成备份。
- 未覆盖正式 `frontend/capability-browser/public/data`。
- 未执行全量 `public/data` 导出。
- 未执行 `bootstrap-local-data --profile core --reset`。
- 未恢复 Environment Mapping 写入线。
- 未修改前端 UI。

治理结论：`OI-140` 已关闭。当前运行基线与 SQLite 导出基线已对齐；后续任何原始数据修改、导入、导出或 workbench 重建，都必须先基于 runtime baseline 生成候选包和 normalized diff，不允许全量重导或直接覆盖，且不能绕过备份、人工确认、定向替换和内容级 smoke。后续恢复 Environment Mapping 时必须基于当前 runtime baseline，不得触碰字典、标准、LC、能力基线。

## 4. Work Function 主数据规则

`安全工作职能清单` 是工作职能主数据来源。

规则：

- 有编码的 `work_function` 为正式主数据。
- `安全能力-安全管理元素（high level）` 中的组织职能相关方只作为映射文本。
- 映射文本若能匹配正式职能，只创建 `stakeholder_by` 关系，不创建新的无编码 `work_function`。
- 明显半截文本不生成对象，例如 `身份`、`技术实施）`、`安全实施职能（方案设计`。
- 新出现的错字、简称或业务别名，需要先在 `open-issues.md` 确认，再加入 ETL 别名规则。

已确认案例：

- `身份、凭证及访问管理运营职能` 是完整正式职能名，不允许按顿号拆分。
- `安全实施职能（咨询规划）` 等当前源表残留变体，归并到正式职能 `69 安全实施职能（规划咨询、方案设计、技术实施、项目管理）`。

## 5. Conflict Resolution Rules

当前优先级：

```text
人工确认
>
正式主数据
>
当前来源 ETL
>
历史导入结果
```

处理规则：

- 自动导入不得静默覆盖人工确认结果。
- 批量导入必须进入 staging，并保留 proposed action。
- 冲突记录应进入 review，不直接写入正式库。
- 用户确认的数据修正，应记录到 `open-issues.md` 或对应治理文档中。

## 6. 旧对象停用规则

已确认规则：

- 前端导出只展示 `active` 对象和 active 端点关系。
- 用户明确确认的历史错误对象，可以局部标记为 `deprecated`。
- 同一来源文件、同一 Sheet 全量同步时，本次未出现、且非人工维护保护对象的旧 ETL 对象，自动标记为 `deprecated`。
- 如果曾经被停用的 ETL 对象重新出现在来源 Sheet 中，审批入库时恢复为 `active`。
- 自动停用必须写入 `change_logs`，并保留 `import_job_id`、来源文件路径、来源 Sheet 和停用原因。

保护规则：

- `metadata_json` 中存在 `manual_protected`、`manual_override`、`manual_edit`、`source_mode = manual` 或 `managed_by = manual` 的对象，不允许自动停用。
- 本次导入存在 `error` 或 `blocking` 校验信息时，跳过旧对象自动停用，避免因解析不完整导致误停用。
- 自动停用只在当前导入实际覆盖的 Sheet 范围内生效，不跨 Sheet 推断。

实现状态：

- `OI-013` 已落地 MVP 机制。
- 当前实现以来源文件路径、来源 Sheet、对象类型和 `object_key` 判断旧对象是否消失。

## 7. Stable ID Rules

当前实现：

- 数据库主键 `id` 使用 UUID。
- 业务稳定身份通过候选对象的 `object_key` 保存于 `metadata_json`。
- 有编码对象的稳定身份主要来自 `type + code`。
- 无编码对象的稳定身份主要来自 `type + title + qualifier`。

允许变化：

- 标题轻微修正；
- 描述补充；
- 来源引用追加；
- `metadata_json` 中的扩展字段。

需要谨慎处理：

- `type` 改变；
- 稳定编码改变；
- 同一对象拆分为多个对象；
- 多个对象合并为一个对象。

这些情况应进入 staging/review 或在 `open-issues.md` 建立问题记录。

## 8. Validation Severity

当前代码层使用：

| 等级 | 含义 | 是否阻止导入 |
|---|---|---|
| ok | 校验通过 | 否 |
| warning | 可继续，但需要用户审查 | 否 |
| error | 阻止该条记录入库 | 是 |

治理层补充：

| 等级 | 含义 |
|---|---|
| info | 提示，不影响导入 |
| warning | 可继续，建议审查 |
| error | 阻止记录导入 |
| blocking | 必须先修复，不能进入审批 |
| business_accept | 业务接受，不再作为 bug 处理 |

后续如果代码扩展验证等级，应保持和本文档一致。

## 9. Metadata Promotion Rules

`metadata_json` 当前是合理的 MVP 设计，用于承载尚未稳定的字段。

字段生命周期：

| 阶段 | 说明 | 存储建议 |
|---|---|---|
| experimental | 来源不稳定、只用于探索 | `metadata_json` |
| semi-stable | 多次导入出现，已有查询或展示需求 | `metadata_json` + 导出字段 |
| stable | 业务定义稳定，需要索引、筛选或高频查询 | 正式 column 或独立表 |

提升为正式字段的条件：

- 字段含义稳定；
- 至少两个导入批次重复使用；
- 前端、导出或查询有明确需求；
- 去重、排序、筛选或性能需要依赖该字段；
- 已有迁移和回填方案。

禁止：

- 因为单次页面展示需要就立刻新增 column。
- 在字段含义未确认前拆出专用表。

## 10. Frontend Rendering Rules

当前不实现复杂 schema-driven frontend 引擎，只先遵守渲染治理规则：

- 新对象类型优先进入通用“清单 + 详情 + 关系链路”工作台。
- 只有当对象拥有独立工作流时，才新增独立页面。
- 列表字段应少而稳定：编码、标题、分组、层级、状态。
- 关系信息优先以 badge、chip 或详情区展示，不在列表中堆满。
- 默认 UI 展示处理、映射、关联后的业务结果；来源 Sheet、行号、字段名不作为主界面内容。
- 来源追踪作为治理和排错能力保留在数据层，需要时可通过审计导出或折叠区查看。
- 基础知识表应尽量保留原表的业务组织方式，例如作用域目录、流程清单、职能清单、安全技术模块清单。
- 映射表应优先形成关系页或矩阵页，例如能力关注点 -> 服务 -> 作用域 -> 模块 -> 系统/产品。

后续对象类型继续增加后，再评估是否新增 `frontend/schema/` 配置层。

## 10.1 前端数据包拆分规则

前端离线 JSON 是后端投影结果，不是原始 Sheet 的搬运结果。任何新导出包都必须按“页面契约 + 业务边界”组织，不允许为了方便把多个大表继续塞进一个大 JSON。

通用规则：

- 索引包只承载导航、标题、版本、统计、Tab 元数据和分包路径，不承载主表 `rows`。
- 详情包按页面、框架、对象类型或 Tab 拆分，进入页面或切换 Tab 时再按需加载。
- 单个 JSON 如果超过约 `1MB`，应评估拆分；超过约 `3MB` 必须拆分或给出治理说明。
- 长文本矩阵、成熟度描述、标准控制项、参考条款等高膨胀数据不得进入全局首屏包。
- 兼容旧文件名时，旧文件只能作为小索引或重定向兼容包，不得继续承载全量行数据。
- 前端组件不得直接拼接多个原始包重新推断业务事实；只能通过 `dataClient`、`/api/v1/*` 或后端生成的契约化分包读取。

安全标准 / 框架包的强制规则：

```text
frontend/capability-browser/public/data/
├── standards-index.json
├── standards-data.json          # 兼容索引，不承载 rows
└── standards/
    ├── <framework>.json
    └── <framework>/<tab>.json
```

- `standards-index.json` 和兼容 `standards-data.json` 必须是 `package_type = standards-index`。
- `standards-index.json.frameworks[]` 不得包含 `rows`。
- `/api/v1/data-packages/standards-index` 返回小索引；旧入口 `/api/v1/data-packages/standards` 可由后端运行时组装完整明细用于兼容，但不得重新写回静态全量大包。
- 多 Tab 框架必须按 Tab 分包，例如 DSP SCF 2026 的 `SCF Controls` 和 `SCF成熟度`。
- 前端首屏只加载索引和当前框架 / 当前 Tab；切换到其他 Tab 后才加载对应分包。
- 主展示区不得出现非用户需求的衍生字段、占位字段、中间字段或调试字段；新增列前必须确认它来自原始业务字段或已被用户明确要求展示。
- 标准 / 框架主展示包不得出现 `sheet`、`row`、`column`、`raw_value`、`source_file`、`source_ref`、`metadata`、`debug`、`intermediate` 等非业务字段。

当前已固化的标准 / 框架分包：

| 文件 | 角色 |
|---|---|
| `standards-index.json` | 标准 / 框架导航、统计、分包路径 |
| `standards-data.json` | 旧入口兼容索引 |
| `standards/dsp-level-2/dsp-scf-controls-2026.json` | DSP SCF 2026 控制项 Tab |
| `standards/dsp-level-2/dsp-scf-maturity-2026.json` | DSP SCF 2026 成熟度 Tab |

验证要求：

- `python3 scripts/data_package_summary.py --package standards` 应显示 `standards-index.json` 为小索引，并输出 `split_files`。
- 抽样检查 `standards-index.json` 和 `standards-data.json` 时，`frameworks[]` 及其 `tabs[]` 不得包含 `rows`。
- 浏览器验证应确认首屏没有提前请求非当前 Tab 的大分包。

## 10.2 前端数据粒度边界规则

按需加载、轻量首屏投影、局部 projection、fallback、缓存和刷新恢复都必须遵守数据粒度边界。性能优化不能改变当前对象语义。

强制规则：

- 关注点级 projection 只能服务 `capability_focus` 节点，不得用于 L0 / L1 / L2 能力层级节点。
- L0 / L1 / L2 节点必须使用同粒度的后端聚合数据，或使用能力树已有关系构造展示层聚合；不得借用默认关注点或第一条关注点的局部关系。
- 禁止用 `rows[0]`、默认关注点、首个子节点、最近一次选中对象、上一次 projection 或旧缓存来决定主展示区当前对象。
- 主展示区当前对象必须来自左侧显式选中 ID、URL / workspace state 中恢复的选中 ID，或后端明确返回的同粒度对象。
- `localRelationMap.focus`、图谱中心节点、详情标题、关系摘要的当前对象必须与选中对象同粒度一致；如果当前选择是 L1，图谱范围应是 L1 聚合，而不是某个 L3 关注点。
- 轻量首屏包可以只返回默认关注点投影，但前端必须在非关注点选择时忽略该关注点投影，改用聚合 fallback 或后台补载完整数据。
- Capability Workspace View Contract 1.0 固定为 `GET /api/v1/capabilities/workspace-view?object_type={type}&object_id={id}`；支持 `capability_category`、`capability_domain`、`capability`、`capability_focus`。旧 `workspace-projection` 仅保留为兼容入口。
- 对象粒度 workspace view 必须返回 `contract`、`selected`、`graphScope`、`dataState`、`graph.center`、`summary`、`tabs`、`technicalMappingRows`、`managementMappingRows`、`standardMappingRows` 和 `sourceEvidence`；`graph.center.id/type/code` 必须与 `selected.id/type/code` 一致。
- 对象不存在时必须返回 `dataState = invalid_object`，不得回退到默认关注点。
- 契约审计必须覆盖有效对象和无效对象：无效对象也必须保留上述顶层字段，且 `technicalMappingRows`、`managementMappingRows`、`standardMappingRows`、`sourceEvidence` 必须为空数组。
- 非 `capability_focus` projection 不得返回关注点级 `localRelationMap` 作为主图谱来源；关注点 projection 可以返回完整局部 `localRelationMap`。

涉及以下文件或能力时，必须执行粒度边界验证：

- `frontend/capability-browser/dataClient.js`
- `frontend/capability-browser/app.js`
- `frontend/capability-browser/viewModels.js`
- `scripts/audit_capability_viewmodel_contract.mjs`
- 图谱输入模型和本地关系图组件
- `/api/v1/capabilities/workspace-initial`
- `/api/v1/capabilities/workspace-view`
- `/api/v1/capabilities/workspace-projection`
- 刷新状态恢复、缓存版本、分包加载、fallback 数据路径

最小验证矩阵：

| 选择对象 | 预期数据粒度 | 必须断言 |
|---|---|---|
| L0 分类，例如 `T` | `capability_category` 聚合 | 图谱中心 / 当前对象是 L0 分类，不是第一个关注点 |
| L1 领域，例如 `T-AS` | `capability_domain` 聚合 | `localRelationMap.focus.code = T-AS` 或等价当前对象 |
| L2 能力，例如 `T-AS.AD` | `capability` 聚合 | `localRelationMap.focus.code = T-AS.AD` 或等价当前对象 |
| L3 关注点，例如 `T-AS.AD-01` | `capability_focus` 局部投影 | 可以使用关注点 projection，但不得复用到上层节点 |

验证命令建议：

```bash
node --check frontend/capability-browser/viewModels.js
node --check frontend/capability-browser/app.js
node scripts/audit_capability_projection_contract.mjs --url http://127.0.0.1:5173
node scripts/audit_capability_viewmodel_contract.mjs --url http://127.0.0.1:5173
node scripts/frontend_smoke_check.mjs --page capability --url http://127.0.0.1:5173/frontend/capability-browser/
```

如修改涉及首屏投影或图谱输入，还应补充 Node 定点断言，至少覆盖 L1、L2、关注点三类对象，并输出当前对象 code、`localRelationMap.focus.code` 和图谱 `graphScope`。

Capability Projection Contract 1.0 的固定审计命令：

```bash
node scripts/audit_capability_projection_contract.mjs --url http://127.0.0.1:5173
```

固定审计对象：

- `T`
- `T-AS`
- `T-AS.AD`
- `T-AS.AD-01`
- `T-OF`
- `T-OF.AT`
- `T-OF.AT-02`
- `G-SP.SM-02`
- 一个不存在的能力对象，用于验证 `invalid_object`

## 11. 错误数据处理流程

未来数据导入遇到错误数据时，按以下流程处理：

| 步骤 | 处理方式 | 输出 |
|---|---|---|
| 1. 暂存 | Excel、PPT、Draw.io、DOCX 等来源先进入 staging 或登记表，不直接覆盖正式库 | `import_jobs`、`staging_items`、`staging_relations` |
| 2. 校验 | ETL 输出 `ok`、`warning`、`error`、`blocking` 等等级 | 导入摘要、warning review、问题记录 |
| 3. 分类 | 判断是源数据错误、ETL 规则缺失、模型设计缺口，还是业务可接受差异 | `open-issues.md` |
| 4. 修复 | 源数据错误优先修 Excel；规则缺失再修 ETL；模型缺口先补设计再编码 | 源文件修订或代码修订 |
| 5. 复导 | 重新 staging，检查 validation 和差异结果 | 新 import job |
| 6. 审批 | 确认无阻断问题后 approve，正式表更新、旧对象停用或恢复 | `knowledge_items`、`knowledge_relations`、`change_logs` |
| 7. 验证 | 重新导出前端 JSON 或清单，检查页面和统计 | 导出文件、验证记录 |

处理原则：

- `error` 和 `blocking` 优先修复，不进入正式审批。
- `warning` 可以审批，但必须在报告或 `open-issues.md` 中留痕。
- 源数据错误由用户修正源 Excel 后复导，系统通过同来源 Sheet 同步机制处理旧对象停用。
- ETL 规则错误由代码修复，并在 `data-governance.md` 或映射规则文档中沉淀稳定规则。
- 业务接受的差异标记为 `business_accept`，后续不再作为 bug 反复处理。

## 12. 成熟度评估数据治理规则

成熟度分析模块使用现有安全能力知识库，但客户评估输入、证据、匹配候选、评分结果和报告属于评估运行数据，默认不进入主知识库对象。

治理规则：

| 规则 | 当前口径 |
|---|---|
| 数据边界 | maturity 运行数据使用 `maturity_*` 专用表或 `data/maturity/` 本地运行文件，不写入 `knowledge_items` |
| 主数据引用 | 只读引用现有能力、关注点、服务、模块、流程、职能等知识对象 |
| 来源追踪 | 记录模板文件、Sheet、行号、字段、证据摘要、模板版本、规则版本和知识库快照 |
| staging / review | 客户模板导入和低置信度匹配必须进入 maturity 专用暂存或审查流程，不直接评分 |
| 人工优先 | 自动匹配、自动评分与人工审查冲突时，人工确认结果优先 |
| 人工覆盖 | 覆盖评分必须记录原始自动结果、覆盖后结果、原因、审查人和时间 |
| 版本化 | 成熟度等级、评分规则、模板 schema 和报告模板必须带版本号 |
| 敏感数据 | 客户输入、证据、评分结果和报告默认存放在 `data/maturity/`，不提交 GitHub |
| 前端边界 | 前端只展示导出的评估结果，不从客户原始文本自行推断能力或评分 |

默认忽略路径：

```text
data/maturity/
```

如需提交 maturity 示例数据，必须先脱敏，并明确标记为示例，不得使用真实客户名称、真实证据文件或可识别业务描述。

## 13. 维护规则

- 本文档记录稳定规则，不记录每次执行日志。
- 执行日志写入 `progress.md`。
- 具体 bug 和数据问题写入 `open-issues.md`。
- 若本文档规则与代码行为不一致，应新增 issue 并决定是改代码还是改规则。
