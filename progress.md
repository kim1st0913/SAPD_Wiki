# progress.md

本文件是当前会话恢复入口，只保留最近状态、最近完成事项、关键验证和历史索引。完整执行历史已归档到 `docs/05-archive/progress-history/2026-05.md`。

## 当前状态（2026-05-25）

- 当前分支：`codex-frontend-backend-separation-closure`。
- 当前主线：Phase 5 知识浏览与搜索 / 关系化前端工作台校正；重点仍是已导入 Sheet 的业务语义复核、前端关系展示校正、数据契约治理和员工端字段边界收口。
- Frontend Baseline 1.0 当前仍以三页为核心：`安全能力映射`、`LC-AP开发安全生命周期`、`信息化环境维度`；不默认启动 Phase 7 多格式增强、maturity M1、新 Sheet 扩展、schema 重构或 React / Vue 重构。
- 本轮已完成 GitHub checkpoint commit `3447e9b chore: checkpoint lifecycle data governance updates` 并推送到远端分支 `codex-frontend-backend-separation-closure`。
- 当前工作区新增本轮全量 ETL 复核记录和 `DSP策略清单（2026）` 解析性能修复，待验证后再做第二个小 checkpoint。

## 最近完成事项

### 2026-05-25 全量 ETL 复核与 DSP 2026 解析性能修复

- 已备份当前 SQLite 到 `data/database/backups/sapd_wiki-before-full-etl-20260525.sqlite3`，备份大小约 575MB。
- 已按当前导入 profile 完成全量 ETL：`core`、`second-batch`、`third-batch`、`standard-framework`。所有 stage 均 `validations=[]`，所有 approve 均 `warnings=[]`。
- 全量 ETL 过程中发现 `DSP策略清单（2026）` 解析器在 read-only Excel 模式下使用 `ws.cell(row, col)` 随机访问，导致单表 stage 长时间卡住；已改为 `iter_rows` 顺序读取，单表解析约 0.48 秒完成。
- 已清理旧的卡住 `stage-excel` / parse-only 进程，避免晚点写入重复 staging。
- 已重新导出 `maintenance-knowledge.json`、`shared-lookups.json`、`lifecycle-knowledge.json`、三份 workbench、`capability-tree.json`、`content-views.json` 和 standards 相关数据包。
- 当前数据包摘要均为 `data_state=ready`：`capability-workbench`、`environment-workbench`、`lifecycle-workbench`、`maintenance`。
- 定向异常检查通过：active `网络数据防泄露` 为 0，active 安全技术模块 `数据交易沙箱` 为 0，active `/CD流水线` 为 0，active `CI/CD流水线` 为 1，active 安全技术措施 `数据销毁` 为 1。
- 当前判断：不需要立即干净重建数据库；业务输出包稳定，旧异常对象均非 active。但 SQLite 已积累较多历史 `staging_*`、`review_decisions`、`source_references` 和 `change_logs`，若后续准备顾问端种子库或压缩包交付，建议另开“干净重建 + 全量导入 + 体积压缩”专项。

### 2026-05-25 LC-AP 主表显示优化

- 已将 `LC-AP开发安全生命周期` 主表改为上下两块字段记录表：上方 `开发技术相关` 展示阶段主要活动、参考来源、软件开发模式、开发技术服务、实际产品示例和潜在安全威胁场景；下方 `安全相关` 展示安全活动、策略、参考来源、补充安全策略、安全技术服务和安全技术模块。
- `软件开发模式` 已追加 `LC-AP 应用安全开发生命周期元素目录` 的软件开发类型定义，例如 `自研应用：本地软件开发；有源代码`。
- 已继续缩小默认宽度：LC-AP 阶段目录运行时默认宽度从 `220px` 调整为 `200px`，主表不再使用 12 列横向宽表，记录表横向溢出为 0。
- 已移除 LC-AP 阶段标题旁的 `8` 计数徽标，阶段栏只保留标题和 `收起目录` 操作。
- 已复核字段边界：主展示区未命中 `sheet`、`row`、`column`、`raw_value`、`source_file`、`import_id`、`source_id`、`source_ref`、`source_label`、`debug`、`raw`、`metadata`、`intermediate`、`generated_at`。
- 验证通过：`node --check`、`python3 scripts/data_package_summary.py --package lifecycle-workbench`、LC-AP 页面 1440px / 1024px smoke、自定义 DOM/CSS 探针和 `git diff --check`；本轮仅改前端展示文件与 `progress.md`，未修改 ETL、数据库 schema、原始 Excel 或生成数据包。

### 2026-05-25 安全技术模块相关 Sheet 重新 ETL

- 已备份当前 SQLite 到 `data/database/backups/sapd_wiki-before-scope-module-sync-etl-20260525141109.sqlite3`。
- 已重新 stage 并 approve 4 张相关 Sheet：`安全技术模块清单`、`作用域-安全技术服务-安全技术模块映射`、`LC-DT 数据生命周期`、`LC-DT 安全技术服务、模块、策略映射表`；import job 为 `d9c0c34b-f334-4ff6-a7cb-48fb309c1e86`。
- stage 结果无 validation，approve 结果为 `items_created=1`、`items_updated=471`、`items_deprecated=0`、`relations_created=28`、`warnings=[]`。
- 已重新导出 `maintenance-knowledge.json`、`lifecycle-knowledge.json`、`shared-lookups.json`、`capability-workbench.json`、`environment-workbench.json`、`lifecycle-workbench.json` 和 standards 相关前端数据包。
- 当前 DB active 统计：`security_system=32`、`security_technology_module=102`、`security_technical_service=192`、`security_technical_measure=4`；`网络数据防泄露` 与 `数据交易沙箱` 在 DB 中均为 deprecated 模块。
- 只读 parser 复核 `作用域-安全技术服务-安全技术模块映射`：`validations=0`，`网络数据防泄露=0`、`数据交易沙箱=0`、`数据流转监测和泄漏防护=5`、`数据安全存储=3`、`数据备份与恢复=3`、`隐私计算平台=1`、`知情同意管理=5`、`隐私安全影响评估=0`。
- 已将 `OI-073` 标记为已修复；本轮未修改 Excel 原始文件结构、前端代码或数据库 schema。
- 已复核 `安全技术模块/措施清单` 中“未归入安全技术模块清单”的 5 个主安全系统、13 个模块；确认它们均存在于原始 `安全技术模块清单`，属于前端数据包来源摘要截断导致的误分组。
- 已调整 `src/sapd_wiki/exports.py`：`security_system` 与 `security_technology_module` 的简要来源优先保留 `安全技术模块清单`；重新导出后有分类但无目录来源的安全技术模块数量为 0。
- 已补跑并复核核心 JSON 投影：`capability-tree.json`、`maintenance-knowledge.json`、`shared-lookups.json`、三类 workbench、`lifecycle-knowledge.json`、`standards-index.json`、`standards-data.json` 和 `content-views.json` 均为当前导出状态；`capability-workbench.json` 的 `generated_at` 已刷新到本轮导出时间。
- 用户再次修订原始表后，已只读检查 `安全技术模块清单`、`LC-DT 数据生命周期`、`LC-DT 安全技术服务、模块、策略映射表`：stage `validations=[]`，数据安全模块清单为 3 个安全系统、14 个模块；发现 `I-DI&T-AS.AD-03 数据备份` 与安全技术服务基准 `I-DI&T-AS.DG-03 数据备份` 不一致，已登记 `OI-076`。

### 2026-05-25 开发安全页面数据检查

- 已检查 `LC-AP开发安全生命周期` 页面当前主数据包 `lifecycle-workbench.json` 和兼容旧包 `lifecycle-knowledge.json`。
- 已按用户重新确认的新口径复核 LC-AP 的 Q/R/S/M/N 列：安全技术服务基准为 `安全能力-安全技术服务`，安全技术模块基准为 `安全技术模块清单`，M/N 分别为独立的开发技术服务和开发技术模块。
- 已修正 LC-AP ETL 新口径并重新导入：M/N 分别为 `development_technical_service` / `development_technical_module`，Q 为统一 `security_technical_service`，R 为 `security_technology_module` 或 `security_technical_measure`；最新 job `e98a576e-00d8-4eeb-ae8c-9256fd1e7649`，`validations=[]`、`relations_deleted=120`、`warnings=[]`，`OI-075` 已修复。
- 已重新检查生成 JSON：`lifecycle-knowledge.json` 和 `lifecycle-workbench.json` 均为 `data_state=ready`；workbench 对象计数为 `development_technical_service=11`、`development_technical_module=14`、`security_technical_service=6`、`security_technology_module=4`、`security_technical_measure=3`，关系端点缺失 0，旧 `development_product_component` 字段/关系残留 0，开发技术服务混入安全技术服务 0。
- 本轮未修改数据库、原始数据或 Excel stage / approve 状态；生成数据包属于本地运行数据，不纳入 Git 跟踪。

### 2026-05-25 工程进度同步

- 已按轻量恢复规则核对 `CURRENT_STATE.md`、`progress.md`、`task_plan.md`、`findings.md`、`open-issues.md` 和 Git 工作区状态。
- 已确认当前主线仍为 Phase 5 关系化前端工作台校正；不默认启动 Phase 7、多格式增强、maturity M1、新 Sheet 扩展或 React / Vue 重构。
- 已同步文档中的过期状态：`OI-040`、`OI-049`、`OI-050` 均为已修复；当前明确待确认问题仍是 `OI-073`。
- 本轮未修改前端代码、数据库、原始数据或 Excel stage / approve 状态；生成数据包属于本地运行数据，不纳入 Git 跟踪。

### 2026-05-23 轻量项目结构治理

- 已完成只读结构体检，确认当前适合做轻量治理，不建议做大规模目录搬迁、React / Vue 重构或大拆 `app.js` / `styles.css`。
- 已新增 `scripts/README.md`，把脚本分为长期工具和专题脚本，明确新增脚本登记规则。
- 已新增 `docs/03-import-etl/README.md`，为导入规则、数据契约、业务复核和标准 / 框架核对报告建立索引。
- 已按“一个地方讲完整，其它地方只做入口索引”的原则压缩重复说明，避免 `README`、治理文档、脚本索引和初始化说明同质化。
- 已新增 `docs/README.md` 作为文档总导航，按项目现状、顾问端交付、GitHub 初始化、ETL、前端契约和历史追溯分场景给入口。
- 已将根目录 `progress.md` 瘦身为轻量恢复入口，长历史归档到 `docs/05-archive/progress-history/2026-05.md`。

### 2026-05-23 安全知识表格字段收口

- 已按“只展示原始业务字段”收口参考目录：`GB/T 42446-2023` 主表只展示 `工作类别`、`承担的工作任务`，`Gartner 工作岗位参考` 主表只展示 `分类`、`角色`、`描述`。
- `maintenance-knowledge.json` 已回填 27 条 GB/T 工作类别和 28 条 Gartner 分类，并按原始表行号排序。
- 已将 `GB/T 42446-2023` 按 `工作类别`、`Gartner 工作岗位参考` 按 `分类` 做归纳展开；最终改为“分类折叠面板 + 组内明细表”，避免大表空白列、大面积横条和标题到表格的大空白。
- 本轮未修改原始 Excel、schema 或数据库结构；涉及前端展示组件、样式、数据导出投影、页面字段契约和治理文档。

### 2026-05-25 安全知识应用系统目录
- 已在安全知识中新增 `/knowledge/application-systems` 二级页面，数据来自 `lifecycle-knowledge.json.application_security_development.application_system_types`。
- 页面按原始 `LC-AP 应用安全开发生命周期元素目录` 的 `应用系统`、`定义`、`应用组件` 三个业务字段单表展示；组件全量展开为标签，不使用折叠层级或 `+N` 截断。
- 已把短表规则同步到技术措施、技术模块和 LC-AP 参考表，并更新页面目录设计文档和安全知识交接稿；未修改原始 Excel、schema、数据库或 ETL 导出逻辑。

## 最近验证

- `python3 scripts/sapd_wiki.py stage-excel "data/raw-samples/wiki sample.xlsx" --sheets "安全技术模块清单,作用域-安全技术服务-安全技术模块映射,LC-DT 数据生命周期,LC-DT 安全技术服务、模块、策略映射表" --sensitive-level confidential --json`：通过，`validations=[]`，staged 对象 472 个、关系 1857 条。
- `python3 scripts/sapd_wiki.py approve-import d9c0c34b-f334-4ff6-a7cb-48fb309c1e86 --json`：通过，`warnings=[]`。
- `python3 scripts/sapd_wiki.py export-maintenance-knowledge`、`python3 scripts/sapd_wiki.py export-lifecycle-knowledge`、`python3 scripts/sapd_wiki.py export-shared-lookups`、`python3 scripts/sapd_wiki.py export-frontend-workbenches`：通过，相关前端数据包已刷新。
- `python3 scripts/data_package_summary.py --package maintenance`：通过，`data_state=ready`，`security_technology_modules=102`、`security_technical_measures=28`；自定义复核显示有分类但无 `安全技术模块清单` 来源的模块数量为 0。
- `python3 scripts/data_package_summary.py --package all`：通过，核心数据包均存在且 `data_state=ready`；`capability-tree.json`、`capability-workbench.json`、`environment-workbench.json`、`content-views.json` 已补跑到本轮修改时间。
- `python3 scripts/sapd_wiki.py stage-excel "data/raw-samples/wiki sample.xlsx" --sheets "安全技术模块清单,LC-DT 数据生命周期,LC-DT 安全技术服务、模块、策略映射表" --sensitive-level confidential --json`：通过，`validations=[]`，未 approve；自定义单元格比对发现 3 处 `I-DI&T-AS.AD-03 数据备份` 未命中安全技术服务基准。
- 临时端口 `6302` 页面 smoke：`/knowledge/technical` 通过，`activeView=maintenance`，`maintenanceTable=true`，`consoleIssues=0`，截图 `/var/folders/81/8nwy3h2n00s1dw1g5bnvj7j40000gn/T/sapd-maintenance-smoke.png`；临时服务已停止。
- `python3 scripts/data_package_summary.py --package capability-workbench`、`--package environment-workbench`、`--package lifecycle-workbench`：通过，三个 workbench 数据包均为 `data_state=ready`。
- 自定义 parser / JSON 复核：通过，`作用域-安全技术服务-安全技术模块映射` parser `validations=0`；导出包中 `网络数据防泄露` 不再出现，`数据交易沙箱` 不再作为 `security_technology_module` 标题出现。
- 临时端口 `6301` 页面 smoke：`capability`、`environment`、`lifecycle` 均通过，`consoleIssues=0`；截图分别为 `/var/folders/81/8nwy3h2n00s1dw1g5bnvj7j40000gn/T/sapd-capability-smoke.png`、`/var/folders/81/8nwy3h2n00s1dw1g5bnvj7j40000gn/T/sapd-environment-smoke.png`、`/var/folders/81/8nwy3h2n00s1dw1g5bnvj7j40000gn/T/sapd-lifecycle-smoke.png`；临时服务已停止。
- `python3 scripts/check_github_data_boundary.py`：通过，当前 Git 未追踪原始数据、数据库、导出包或前端生成数据。
- `git status --short --branch`：通过，当前分支 `codex-frontend-backend-separation-closure` 与远端无 ahead / behind 提示；同步后仅 `progress.md`、`task_plan.md`、`findings.md` 存在文档改动。
- `python3 scripts/sapd_wiki.py export-lifecycle-workbench`：通过，重新生成 `frontend/capability-browser/public/data/lifecycle-workbench.json`；`security_technical_measure=3`、`relations=356`。
- `python3 scripts/data_package_summary.py --package lifecycle-workbench`：通过，`data_state=ready`，`lifecycle_stage=8`、`lifecycle_activity=43`、`lifecycle_control=6`、`lifecycle_requirement=76`、`security_technical_service=41`、`security_technology_module=41`、`security_technical_measure=3`。
- `python3 scripts/data_package_summary.py --package lifecycle`：通过，`data_state=ready`，旧包 `security_technical_measures=4`。
- 自定义 `lifecycle-workbench.json` 端点和异常检查：通过，关系端点缺失 0，`uses_measure=3`；阶段级措施关系为 `AP-02 -> 应用程序威胁建模`、`AP-04 -> 制品安全加固`、`AP-05 -> IaC代码安全测试`；`CI/CD流水线` 无错误拆分对象，`/` 占位对象 0。
- 自定义 LC-AP 目录一致性比对：通过，`servicesMissingSharedIndex=0`、`directModulesMissingCatalog=0`、`workbenchModulesMissingCatalog=0`、`sharedModulesMissingCatalog=0`；发现 22 个服务未进入模块目录服务-模块关系，已记录到 `OI-075`。
- `node --check frontend/capability-browser/dataClient.js`、`node --check frontend/capability-browser/viewModels.js`、`node --check frontend/capability-browser/components/ApplicationSecurityLifecycle.js`：通过。
- 临时端口 `5174` 页面 smoke：`node scripts/frontend_smoke_check.mjs --page lifecycle --url http://127.0.0.1:5174/ --debug-port 9334` 通过，`activeView=dev-lifecycle`，`consoleIssues=0`，`bodyOverflowX=0`，截图 `/var/folders/81/8nwy3h2n00s1dw1g5bnvj7j40000gn/T/sapd-lifecycle-smoke.png`；临时服务已停止。
- 2026-05-25 文档归档复核：旧路径扫描排除 `docs/05-archive/**` 后无命中；`git diff --check` 通过。
- `python3 -m py_compile scripts/sapd_wiki.py src/sapd_wiki/cli.py scripts/check_github_data_boundary.py`、`python3 scripts/sapd_wiki.py bootstrap-local-data --print-inputs` 与 `--help`：通过。
- 参考目录原始字段复核通过：本地 API `/api/v1/data-packages/maintenance` 返回 `gbt_42446_references=27` 且 `category_non_empty=27`，`gartner_roles=28` 且 `category_non_empty=28`；页面 smoke `/knowledge/gbt-42446`、`/knowledge/role-references` 通过。
- 参考目录分组 DOM 复核通过：GB/T 为 5 个折叠面板，首组 `网络安全管理 6 项工作任务`；Gartner 为 4 个折叠面板，首组 `安全和风险管理 (SRM) 领导者 10 个角色`；标题到内容间距约 8px，`bodyOverflowX=0`。
- `node --check frontend/capability-browser/dataClient.js`、`node --check frontend/capability-browser/app.js`、`node --check scripts/frontend_smoke_check.mjs`：通过。
- `python3 -m py_compile src/sapd_wiki/exports.py src/sapd_wiki/cli.py src/sapd_wiki/api_server.py scripts/data_package_summary.py scripts/dev_server_guard.py`：通过。
- `node --check frontend/capability-browser/app.js`、`viewModels.js`、`components/AppShell.js`、`components/ApplicationSystemDirectoryTable.js`：通过。
- `node scripts/frontend_smoke_check.mjs --page maintenance --route /knowledge/application-systems --url http://127.0.0.1:6305/ --debug-port 9317`：通过，`consoleIssues=0`、`bodyOverflowX=0`，截图 `/var/folders/81/8nwy3h2n00s1dw1g5bnvj7j40000gn/T/sapd-maintenance-smoke.png`；临时服务已停止。
- `node --check frontend/capability-browser/components/TechnicalMeasureMaintenanceTable.js`、`TechnologyModuleMaintenanceTable.js`、`LcapReferenceMaintenanceTable.js`、`ApplicationSystemDirectoryTable.js` 通过；临时端口 `6307` 回归 `/knowledge/application-systems`、`/knowledge/technical`、`/knowledge/technical-measures` 均通过，`consoleIssues=0`、`bodyOverflowX=0`、`workspaceOverflowX=0`，临时服务已停止。
- 2026-05-25 安全技术服务严格比对：已修订原始表中 `I-DI&T-AS.AD-03 数据备份`、数据安全相关 `IA-03/DP-04` 以及全量 `安全技术模块清单` 60 条可自动判定的不一致；LC-DT 两张表剩余严格比对问题为 0，最新 staging `7506c69d-6346-4acc-8191-9c9dbe6ca5b0` 仅剩 `安全技术模块清单!F27/F304` 两条 `I-OS&T-PD.PP-03 操作系统隔离` 待业务确认，未 approve。
- 2026-05-25 LC-AP 页面投影收口：开发安全页左侧目录仅保留阶段标题，中间区以所选阶段标题和阶段定义开头，主表按原表 `B:R` 业务字段展示 `主要活动`、两类 `参考来源`、`安全活动定义`、`安全策略要求`、`软件开发模式`、`开发技术服务`、`实际产品示例`、`潜在安全威胁场景`、`补充安全策略`、`安全技术服务`、`安全技术模块`；重新 approve `bdbf5860-317e-4912-91c4-0ec7b72fa895` 并导出 `lifecycle-knowledge.json`、`lifecycle-workbench.json`，DOM 复核无圆角标签且缺失字段为 0。
- 2026-05-25 LC-AP 左侧目录样式调整：开发安全页阶段目录默认宽度收窄为 `220px`，阶段按钮字号降为 `13px`，目录支持 `收起目录` 与侧边 `目录` 展开入口；DOM 复核折叠后左侧宽度约 `0px`，展开后恢复 `220px`。
- 2026-05-25 安全技术服务复核同步：已输出 60 条 `安全技术模块清单` 修正复核表 `data/processed/reviews/security-service-fix-review-20260525.xlsx`；用户已在 `安全能力-安全技术服务!K33` 补充 `I-OS&T-PD.PP-03 操作系统隔离` 并恢复相关映射，后续按用户确认修复 `OI-078`：两张作用域映射表 95 处编码旧口径按权威建议值更新，权威表 3 处重复括号名称按映射表原值回退，并同步回退 `安全技术模块清单` 9 处名称；最新 approve `668045e9-47bd-4e6a-a2fe-74094e239124`，`validations=[]`、`items_updated=558`、`relations_created=45`、`relations_deleted=67`，已重导出能力树、维护知识、shared lookups 和 workbench。
- `git diff --check`：通过。

## 历史索引

| 归档文件 | 内容 |
|---|---|
| `docs/05-archive/progress-history/2026-05.md` | 2026-05 完整执行记录、根目录 `progress.md` 瘦身快照和本轮轻量结构治理记录 |
| `docs/05-archive/findings-history/2026-05.md` | 2026-05 历史发现 |
| `docs/05-archive/context-slimming-2026-05-15/` | 2026-05-15 上下文瘦身快照 |

## 维护规则

- 本文件只保留最近 1-3 次重要执行；超过 120 行时继续归档到 `docs/05-archive/`。
- 详细过程、长命令输出和阶段性历史不写入根目录 `progress.md`。
