# scripts 目录说明

本目录只登记脚本分类和维护状态。具体命令、输入文件和操作步骤放在对应专题文档，避免和 README / 治理文档重复。

## 长期工具

这些脚本是项目日常开发和交付流程的一部分，可以被 README、CI、Agent 工作流或其他开发者长期引用。

| 脚本 | 用途 | 常用场景 |
|---|---|---|
| `sapd_wiki.py` | 项目主 CLI 入口，包含 `bootstrap-local-data` 一键初始化子命令 | README、`docs/03-import-etl/github-local-data-initialization.md` |
| `run_project_test_suite.mjs` | 全工程测试套件编排入口，支持 `quick`、`pre-commit`、`pre-dmg`、`full`、`release-full` 等分层执行；默认不启动系统 Chrome、不构建 DMG | `docs/07-governance/project-test-workflow-and-case-matrix.md` |
| `check_github_data_boundary.py` | GitHub 数据边界检查 | `docs/07-governance/data-governance.md` |
| `data_package_summary.py` | 前端数据包摘要检查 | `CURRENT_STATE.md` |
| `export_analytics_summary.mjs` | 从现有 workbench / standards / content 数据包生成 `analytics-summary.json` 离线契约；默认输出到已忽略的 `frontend/capability-browser/public/data/` | `docs/06-implementation/analytics-summary-json-contract-draft.md` |
| `audit_analytics_summary_contract.mjs` | 审计 `analytics-summary.json` 的主 grain、覆盖率分母、标准控制项三类 grain 和禁止字段泄露 | `docs/06-implementation/analytics-summary-json-contract-draft.md` |
| `audit_environment_master_data_p0_contract.mjs` | 审计信息化环境主数据P0合同、字典响应schema、裁定清单、29/67上下文保护、编号/身份规则、`instance_of` 唯一性和首期只读fallback边界 | `docs/01-architecture/contracts/environment-master-data/v1/` |
| `audit_environment_master_data_p1_inventory.py` | 以只读SQLite连接盘点信息化环境主数据、上下文、来源证据、环境包一致性及用户引用，输出P2裁定输入；不分配编号或修改正式数据 | `data/exports/worker-verify/plan-env-md/p1-*/` |
| `audit_environment_master_data_p1_inventory.mjs` | 独立验收P1报告、清单行数、用户引用解析、输入哈希和正式apply禁用状态 | `data/exports/worker-verify/plan-env-md/p1-*/` |
| `build_environment_master_data_p2_plan.py` | 只读P1基线与正式库，生成77条主数据编号、16条环境子类裁定及29条 `instance_of` 计划；不写正式库 | `data/exports/worker-verify/plan-env-md/p2-*/` |
| `verify_environment_master_data_p2_reimport.py` | 通过SQLite临时副本验证同源双重导入的对象/业务关系幂等、segment上下文匹配和保护输入哈希 | `data/exports/worker-verify/plan-env-md/p2-*/` |
| `audit_environment_master_data_p2_contract.mjs` | 独立验收P2裁定、编号、关系计划、临时重导报告、文件manifest和导入修复标记 | `data/exports/worker-verify/plan-env-md/p2-*/` |
| `rehearse_environment_master_data_p3_migration.py` | 在SQLite临时备份副本执行主数据首次/重复应用、候选字典开关、精确回退和事务故障注入；拒绝写正式库且不保留候选包 | `data/exports/worker-verify/plan-env-md/p3-*/` |
| `audit_environment_master_data_p3_contract.mjs` | 独立验收P3写入/回退数量、逻辑快照、保护输入哈希、候选包清理、rollback manifest和产物manifest | `data/exports/worker-verify/plan-env-md/p3-*/` |
| `export_environment_dictionary_p4_shadow.py` | 从临时迁移副本导出加法型 `environment-dictionary-v1` 影子包，保留旧环境树、拆分投影、底图和Dashboard包 | `data/exports/worker-verify/plan-env-md/p4-*/` |
| `audit_environment_master_data_p4_contract.mjs` | 独立验收P4字典schema、10/16/51主数据、29/67上下文、106条用法关系、API注册和保护文件哈希；兼容P6后的正式库状态 | `data/exports/worker-verify/plan-env-md/p4-*/` |
| `audit_environment_master_data_p5_contract.mjs` | 验收主数据字典前端的默认关闭开关、主数据/关系展示、搜索展开状态及缺包/API/schema fallback | `data/exports/worker-verify/plan-env-md/p5-*/` |
| `apply_environment_master_data_p6.py` | 默认dry-run；经精确确认后先生成完整恢复包并取得单写者锁，再对正式基础库执行幂等P6迁移，失败时自动从热备份回退 | `data/exports/worker-verify/plan-env-md/p6-*/` |
| `audit_environment_master_data_p6_contract.mjs` | 独立验收P6报告、恢复文件哈希、正式库完整性/外键/计数、用户与保护输入未变及P7开关仍关闭 | `data/exports/worker-verify/plan-env-md/p6-*/` |
| `audit_maturity_assessment_v2_1_contract.py` | 审计成熟度 V2.1 的企业组织项目、固定模板只读、服务角色、四维评分、目标达成率、可选证据、文件交换、L2 结果和报告契约 | `PLAN-MAT-WS`、`docs/08-maturity/` |
| `dev_server_guard.py` | 本地预览服务守护；默认守护当前工作区固定预览入口，不承担数据接入策略切换 | `CURRENT_STATE.md` |
| `frontend_smoke_check.mjs` | 前端页面轻量 HTTP/API smoke 检查；默认不启动系统 Google Chrome | `CURRENT_STATE.md` |
| `audit_frontend_governance.mjs` | 前端高风险文件治理审计，防止安全能力映射相关 CSS / 核心文件继续无意识膨胀 | `docs/07-governance/capability-mapping-change-control.md` |
| `audit_frontend_p0_1_correctness_boundary_contract.mjs` | P0-1 正确性与安全边界统一门禁：核对四级当前对象、Draw.io 原图不可变、语义色分层、代表键盘 / 动态播报与主区禁显字段 | `frontend/design-handoff/implementation-specs/frontend-global-optimization-plan-2026-07-11.md` |
| `audit_frontend_p0_2_apple_shell_layout_contract.mjs` | P0-2 Apple Shell 与共享布局基座门禁：核对 1440×1024 主区高度、唯一页面标题、单业务域导航、当前项滚入、常驻辅助层上限、共享字号 / 圆角 token，以及能力、环境、专项知识、内容四类目录的单一外轮廓 | `frontend/design-handoff/implementation-specs/frontend-global-optimization-plan-2026-07-11.md` |
| `audit_frontend_p0_4_standard_issue_shell_contract.mjs` | P0-4 标准与 Issue 壳层派生门禁：核对标准深链双层当前位置、Issue 显式当前对象、按需 inspector、关闭归宽、路由选择隔离与键盘队列 | `frontend/design-handoff/implementation-specs/frontend-global-optimization-plan-2026-07-11.md` |
| `audit_frontend_p1_1_runtime_state_contract.mjs` | P1-1 共享运行状态模板门禁：核对 loading / empty / missing_file / error / no-selection 五态、局部重试、路由与当前对象保留、代表页面接入和非业务字段禁显 | `frontend/design-handoff/implementation-specs/frontend-global-optimization-plan-2026-07-11.md` |
| `audit_frontend_p1_2_canvas_workbench_contract.mjs` | P1-2 画布工作台门禁：核对能力映射单控制头、目录宽度/窄屏折叠、环境底图外部缩放与焦点回返、按需详情归宽，并冻结 P0-3 图谱布局和 Draw.io 原图 | `frontend/design-handoff/implementation-specs/frontend-global-optimization-plan-2026-07-11.md` |
| `audit_frontend_p1_3_lifecycle_workbench_contract.mjs` | P1-3 生命周期宽表门禁：核对隔离且唯一的纵向滚动 owner、非粘滞表格单元格、单轴局部横向滚动、无提示文案、13px 正文、纯斜杠/横线空值统一为 `—`、禁止字段，以及全部 LC-AP / LC-DT 阶段渲染和模块字典 ID 引用 | `frontend/design-handoff/implementation-specs/frontend-global-optimization-plan-2026-07-11.md` |
| `audit_frontend_p1_4_reference_tables_contract.mjs` | P1-4 字典/标准门禁：核对中性层级、单一蓝色选择、静态数量、轻量 Tab、键盘切换和发丝分隔行 | `frontend/design-handoff/implementation-specs/frontend-global-optimization-plan-2026-07-11.md` |
| `audit_frontend_p1_5_review_search_contract.mjs` | P1-5 Issue/搜索门禁：核对紧凑队列、单一主搜索框、20 条分页、首个命中高亮和 query/filter/page/scrollTop 恢复 | `frontend/design-handoff/implementation-specs/frontend-global-optimization-plan-2026-07-11.md` |
| `audit_frontend_p1_6_guide_reading_contract.mjs` | P1-6 指南阅读门禁：核对 160—220px 文档式封面、重点章节入口、稳定锚点、目录+隔离正文双层结构、App 不越界注入 iframe 正文样式，以及页面标题栏下载权威自包含 HTML 的真实入口 | `frontend/design-handoff/implementation-specs/frontend-global-optimization-plan-2026-07-11.md` |
| `audit_frontend_p2_product_workspace_contract.mjs` | P2 工作事项、知识统计、字典 / 标准默认收起和指南密度门禁：核对 ISSUE / 成熟度工作流独立、最近 `5 / 3` 条记录、非对称六区块知识统计、环境 / 生命周期 / 内容轻量摘要、六类可折叠目录默认收起、能力目录批量操作，以及 `244px` 目录与 `1120px / 17px` 阅读列 | `frontend/design-handoff/implementation-specs/frontend-global-optimization-plan-2026-07-11.md` |
| `audit_frontend_lazy_load_contract.mjs` | 前端按需加载契约审计，检查知识库字典和安全标准 / 框架的 required / supplemental 分片、标准页 tab loader 和组件内取数边界 | `docs/06-implementation/frontend-global-design-baseline-2026-05-30.md` |
| `audit_service_scope_chip_color_contract.mjs` | 安全技术服务胶囊作用域颜色契约审计，检查共享展示 helper、表格 / 详情 / SVG 关联映射和缓存版本是否统一按服务作用域着色 | `docs/07-governance/data-governance.md` |
| `audit_user_annotation_contract.mjs` | 用户批注全局锚点契约审计，检查统一值选择器、普通表格单元格兜底、共享 relation chip、知识库字典 / 标准框架 / 能力映射 / 环境映射 / LC-AP / LC-DT 渲染样例、折叠目录定位恢复、批注视觉状态和逐页回归需求基线 | `docs/06-implementation/global-annotation-requirements-and-regression-matrix.md` |
| `audit_annotation_drawer_tab.mjs` | 用户批注右侧标签真实浏览器交互审计，检查默认窄标签、数量徽标、hover 预展开、点击完全展开和再次点击平滑收起 | `docs/06-implementation/global-annotation-requirements-and-regression-matrix.md` |
| `audit_user_db_governance_contract.mjs` | 用户库长期治理契约审计，默认检查设计 / 代码一致性，传 `--db` 时只读检查真实用户库 | `docs/06-implementation/user-database-governance-and-stable-key-design.md` |
| `audit_mac_dmg_browser_parity_contract.mjs` | macOS DMG 与 5173 开发版一致性契约静态审计，检查前端 / base DB / backend hash 输入、双变体打包、用户库模板、Web/DMG 差异契约、bug 影响面分类和发布验收矩阵门禁 | `docs/09-delivery/mac-dmg-browser-parity-contract.md`、`docs/09-delivery/release-acceptance-matrix-0.1.md` |
| `plan_user_schema_0_3_migration.mjs` | `user_schema_0.3` 只读 dry-run 计划，输出拟建表、legacy favorite note 候选和 target_ref 风险分类，不写真实用户库 | `docs/06-implementation/user-database-governance-and-stable-key-design.md` |
| `audit_stable_key_contract.mjs` | 基础库 `stable_key` / deterministic ID / `base_id_redirects` 契约审计；当前用于暴露 DB-2 未落地缺口 | `docs/06-implementation/base-stable-key-and-redirect-migration-design-2026-06-06.md` |
| `migrate_db_contracts.mjs` | `OI-135 / DB-11 / DB-2` 正式迁移工具；默认只复制到 `/private/tmp` dry-run，`--apply` 才写目标库，真实项目库还必须传 `--confirm-project-db-write` 并先自动备份 | `docs/06-implementation/user-database-governance-and-stable-key-design.md` |
| `smoke_db_migration_contracts.mjs` | 只复制 base/user SQLite 到 `/private/tmp` 并在复制库上执行 `user_schema_0.3` 与基础库 `stable_key` / `base_id_redirects` migration smoke，不写真实项目数据库 | `docs/06-implementation/user-database-governance-and-stable-key-design.md` |
| `smoke_user_data_basket_api.mjs` | 构造临时 ZIP bundle 并启动本地 runtime，验证 `/api/v1/user/workspaces`、`/api/v1/user/data-baskets`、`/api/v1/user/export-profiles`、`/api/v1/user/exports/preview`、`POST /api/v1/user/exports` 和导出下载的创建、读取、删除、预览、执行、下载、字段边界和 token 防护闭环 | `OI-128` / `OI-135` 用户写入最小 API |
| `audit_capability_viewmodel_contract.mjs` | 安全能力映射页 ViewModel 当前对象一致性审计，验证 L0 / L1 / L2 / 关注点不会误用默认关注点或错粒度 projection | `docs/07-governance/data-governance.md` |
| `audit_dictionary_reference_consistency.mjs` | 知识库字典权威引用一致性审计，检查能力、作用域、技术服务、技术模块 / 措施、管理工作、流程和职能引用是否与字典一致 | `docs/07-governance/data-governance.md` |
| `govern_open_issues.mjs` | `open-issues.md` 轻量治理：保留未关闭问题入口，归档已关闭长记录，生成全量索引 | `docs/06-implementation/open-issues.md` |
| `create_user_db.py` | 创建 ZIP alpha 的 `sapd_wiki_user.sqlite3` 最小用户库 | `docs/09-delivery/user-database-minimum-schema.md` |
| `check_bundle_runtime.py` | 检查 ZIP alpha bundle root、manifest、base/user 数据库、日志目录和端口 | `docs/09-delivery/zip-bundle-1.0-alpha-runtime-design.md` |
| `export_diagnostics.py` | 导出 ZIP alpha 脱敏诊断包 | `docs/09-delivery/zip-bundle-1.0-alpha-runtime-design.md` |
| `run_local_server.py` | ZIP alpha 本地后端源码入口：执行 runtime check、服务静态前端和最小 API | `docs/09-delivery/zip-bundle-1.0-alpha-runtime-design.md` |
| `package_backend_pyinstaller.py` | 使用 PyInstaller 在当前平台生成 ZIP 内部后端运行组件 | `docs/09-delivery/zip-bundle-1.0-alpha-runtime-design.md` |
| `package_backend_windows.ps1` | Windows x64 上生成 `SAPD-Wiki-Backend.exe` 的 PowerShell 入口 | `docs/09-delivery/windows-zip-build-guide.md` |
| `build_zip_bundle.py` | 生成 ZIP alpha bundle 目录骨架，可选压缩为 zip；默认输出到 `/Users/kim1st/Documents/kim note/04_workspace/research/知识库工程/sapd wiki bundle/package-work`，真实运行 ZIP 必须传入 `--backend-binary` | `docs/09-delivery/zip-bundle-1.0-alpha-design.md` |
| `create_alpha_release.py` | 将已验证 ZIP、checksum 和 release manifest 组装到本地 alpha release 目录；平台产物分入 `mac-arm64/`、`win-x64/` 子目录，默认不重复复制 ZIP 内已有 README，Windows 未实测时在 manifest 中标记为 `pending` | `docs/09-delivery/zip-uat-0-internal-trial-guide.md` |
| `create_update_package.py` | 对比上一版完整 ZIP 和新版完整 ZIP，生成内部 alpha update 包；默认排除 `data/user/` 和 `logs/` | `docs/09-delivery/zip-uat-0-internal-trial-guide.md` |
| `prune_database_backups.py` | 本地 SQLite 备份保留脚本；默认 dry-run，只保留最新 5 个 `.sqlite3`，传 `--apply` 后删除更早备份 | `docs/07-governance/data-governance.md` |
| `start-windows.bat` / `start-macos.command` / `stop-windows.bat` / `stop-macos.command` | 分平台 ZIP alpha 启停脚本模板 | `docs/09-delivery/zip-bundle-1.0-alpha-design.md` |

## 专题脚本

这些脚本服务于某次数据处理、标准翻译或专项 ETL。它们可以保留用于复核历史，但不应默认作为通用开发入口。

| 脚本 | 用途 | 状态 |
|---|---|---|
| `translate_dsp_2026_sheet.py` | DSP 2026 Sheet 翻译辅助 | 专题脚本 |
| `verify_dsp_2026_translation.py` | DSP 2026 翻译结果验证 | 专题脚本 |
| `etl_dsp_2026_csf_maturity.py` | DSP 2026 / CSF 成熟度相关 ETL | 专题脚本 |

## 新增脚本规则

- 能被多人长期复用的脚本，放在“长期工具”表。
- 只服务于某次导入、校验、翻译、修表或数据修复的脚本，放在“专题脚本”表。
- 不要把真实原始资料路径、个人桌面路径或敏感文件名硬编码成唯一入口；需要默认路径时，应提供命令行参数覆盖。ZIP bundle 中间打包目录固定为 `/Users/kim1st/Documents/kim note/04_workspace/research/知识库工程/sapd wiki bundle/package-work`，仍可通过 `--output-dir` 或 `SAPD_WIKI_BUNDLE_OUTPUT_DIR` 覆盖；正式分发产物只保留在 `/Users/kim1st/Documents/kim note/04_workspace/research/知识库工程/sapd wiki bundle/dist/releases/0.1.0-alpha/`，可通过 `--release-dir` 或 `SAPD_WIKI_RELEASE_DIR` 覆盖。
- 新脚本如果会生成数据，应默认输出到已忽略的本地目录，例如 `data/processed/`、`data/exports/` 或 `frontend/capability-browser/public/data/`。
- 新脚本如果用于提交前或 CI 检查，应尽量不依赖本地原始数据。
