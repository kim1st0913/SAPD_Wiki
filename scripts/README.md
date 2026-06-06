# scripts 目录说明

本目录只登记脚本分类和维护状态。具体命令、输入文件和操作步骤放在对应专题文档，避免和 README / 治理文档重复。

## 长期工具

这些脚本是项目日常开发和交付流程的一部分，可以被 README、CI、Agent 工作流或其他开发者长期引用。

| 脚本 | 用途 | 常用场景 |
|---|---|---|
| `sapd_wiki.py` | 项目主 CLI 入口，包含 `bootstrap-local-data` 一键初始化子命令 | README、`docs/03-import-etl/github-local-data-initialization.md` |
| `check_github_data_boundary.py` | GitHub 数据边界检查 | `docs/07-governance/data-governance.md` |
| `data_package_summary.py` | 前端数据包摘要检查 | `CURRENT_STATE.md` |
| `export_analytics_summary.mjs` | 从现有 workbench / standards / content 数据包生成 `analytics-summary.json` 离线契约；默认输出到已忽略的 `frontend/capability-browser/public/data/` | `docs/06-implementation/analytics-summary-json-contract-draft.md` |
| `audit_analytics_summary_contract.mjs` | 审计 `analytics-summary.json` 的主 grain、覆盖率分母、标准控制项三类 grain 和禁止字段泄露 | `docs/06-implementation/analytics-summary-json-contract-draft.md` |
| `dev_server_guard.py` | 本地预览服务守护 | `CURRENT_STATE.md` |
| `frontend_smoke_check.mjs` | 前端页面轻量 HTTP/API smoke 检查；默认不启动系统 Google Chrome | `CURRENT_STATE.md` |
| `audit_frontend_governance.mjs` | 前端高风险文件治理审计，防止安全能力映射相关 CSS / 核心文件继续无意识膨胀 | `docs/07-governance/capability-mapping-change-control.md` |
| `audit_frontend_lazy_load_contract.mjs` | 前端按需加载契约审计，检查知识库字典和安全标准 / 框架的 required / supplemental 分片、标准页 tab loader 和组件内取数边界 | `docs/06-implementation/frontend-global-design-baseline-2026-05-30.md` |
| `audit_user_annotation_contract.mjs` | 用户批注全局锚点契约审计，检查统一值选择器、普通表格单元格兜底、共享 relation chip、知识库字典 / 标准框架 / 能力映射 / 环境映射 / LC-AP / LC-DT 渲染样例、折叠目录定位恢复、批注视觉状态和逐页回归需求基线 | `docs/06-implementation/global-annotation-requirements-and-regression-matrix.md` |
| `audit_annotation_drawer_tab.mjs` | 用户批注右侧标签真实浏览器交互审计，检查默认窄标签、数量徽标、hover 预展开、点击完全展开和再次点击平滑收起 | `docs/06-implementation/global-annotation-requirements-and-regression-matrix.md` |
| `audit_user_db_governance_contract.mjs` | 用户库长期治理契约审计，默认检查设计 / 代码一致性，传 `--db` 时只读检查真实用户库 | `docs/06-implementation/user-database-governance-and-stable-key-design.md` |
| `plan_user_schema_0_3_migration.mjs` | `user_schema_0.3` 只读 dry-run 计划，输出拟建表、legacy favorite note 候选和 target_ref 风险分类，不写真实用户库 | `docs/06-implementation/user-database-governance-and-stable-key-design.md` |
| `audit_stable_key_contract.mjs` | 基础库 `stable_key` / deterministic ID / `base_id_redirects` 契约审计；当前用于暴露 DB-2 未落地缺口 | `docs/06-implementation/base-stable-key-and-redirect-migration-design-2026-06-06.md` |
| `smoke_db_migration_contracts.mjs` | 只复制 base/user SQLite 到 `/private/tmp` 并在复制库上执行 `user_schema_0.3` 与基础库 `stable_key` / `base_id_redirects` migration smoke，不写真实项目数据库 | `docs/06-implementation/user-database-governance-and-stable-key-design.md` |
| `audit_capability_viewmodel_contract.mjs` | 安全能力映射页 ViewModel 当前对象一致性审计，验证 L0 / L1 / L2 / 关注点不会误用默认关注点或错粒度 projection | `docs/07-governance/data-governance.md` |
| `audit_dictionary_reference_consistency.mjs` | 知识库字典权威引用一致性审计，检查能力、作用域、技术服务、技术模块 / 措施、管理工作、流程和职能引用是否与字典一致 | `docs/07-governance/data-governance.md` |
| `govern_open_issues.mjs` | `open-issues.md` 轻量治理：保留未关闭问题入口，归档已关闭长记录，生成全量索引 | `docs/06-implementation/open-issues.md` |
| `create_user_db.py` | 创建 ZIP alpha 的 `sapd_wiki_user.sqlite3` 最小用户库 | `docs/09-delivery/user-database-minimum-schema.md` |
| `check_bundle_runtime.py` | 检查 ZIP alpha bundle root、manifest、base/user 数据库、日志目录和端口 | `docs/09-delivery/zip-bundle-1.0-alpha-runtime-design.md` |
| `export_diagnostics.py` | 导出 ZIP alpha 脱敏诊断包 | `docs/09-delivery/zip-bundle-1.0-alpha-runtime-design.md` |
| `run_local_server.py` | ZIP alpha 本地后端源码入口：执行 runtime check、服务静态前端和最小 API | `docs/09-delivery/zip-bundle-1.0-alpha-runtime-design.md` |
| `package_backend_pyinstaller.py` | 使用 PyInstaller 在当前平台生成 ZIP 内部后端运行组件 | `docs/09-delivery/zip-bundle-1.0-alpha-runtime-design.md` |
| `package_backend_windows.ps1` | Windows x64 上生成 `SAPD-Wiki-Backend.exe` 的 PowerShell 入口 | `docs/09-delivery/windows-zip-build-guide.md` |
| `build_zip_bundle.py` | 生成 ZIP alpha bundle 目录骨架，可选压缩为 zip；默认输出到 `/Users/kim1st/Documents/kim note/04_workspace/analysis/research/知识库工程/sapd wiki bundle/package-work`，真实运行 ZIP 必须传入 `--backend-binary` | `docs/09-delivery/zip-bundle-1.0-alpha-design.md` |
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
- 不要把真实原始资料路径、个人桌面路径或敏感文件名硬编码成唯一入口；需要默认路径时，应提供命令行参数覆盖。ZIP bundle 中间打包目录固定为 `/Users/kim1st/Documents/kim note/04_workspace/analysis/research/知识库工程/sapd wiki bundle/package-work`，仍可通过 `--output-dir` 或 `SAPD_WIKI_BUNDLE_OUTPUT_DIR` 覆盖；正式分发产物只保留在 `/Users/kim1st/Documents/kim note/04_workspace/analysis/research/知识库工程/sapd wiki bundle/dist/releases/0.1.0-alpha/`，可通过 `--release-dir` 或 `SAPD_WIKI_RELEASE_DIR` 覆盖。
- 新脚本如果会生成数据，应默认输出到已忽略的本地目录，例如 `data/processed/`、`data/exports/` 或 `frontend/capability-browser/public/data/`。
- 新脚本如果用于提交前或 CI 检查，应尽量不依赖本地原始数据。
