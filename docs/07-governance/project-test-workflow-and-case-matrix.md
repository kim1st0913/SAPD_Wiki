# SAPD Wiki 项目测试流程与用例矩阵

本文档固定 SAPD Wiki 的工程测试流程。目标是让每个环节可以独立执行，也可以按发布链路完整执行；同时覆盖当前 macOS DMG 打包交付。

后续 Codex 会话可以直接调用 `$sapd-wiki-project-test` skill 执行本流程；skill 负责轻量恢复、选择测试套件、保护禁止范围，并以本文档作为测试矩阵权威来源。

## 使用场景

| 场景 | 执行入口 | 是否构建 DMG | 用途 |
|---|---|---:|---|
| 快速自检 | `node scripts/run_project_test_suite.mjs --suite quick` | 否 | 开工前、轻量修改后确认基础边界 |
| 提交前 | `node scripts/run_project_test_suite.mjs --suite pre-commit` | 否 | 代码 / 文档 / 契约修改进入 checkpoint 前 |
| 打包前 | `node scripts/run_project_test_suite.mjs --suite pre-dmg --url http://127.0.0.1:5173` | 否 | 确认 5173、数据边界、用户库和交付契约可进入打包 |
| 完整工程回归 | `node scripts/run_project_test_suite.mjs --full --url http://127.0.0.1:5173` | 否 | 覆盖当前工程主要自动验证，不生成新产物 |
| 发布完整链路 | `node scripts/run_project_test_suite.mjs --suite release-full --include-dmg-build --url http://127.0.0.1:5173` | 是 | 真实构建双 DMG；构建后还必须执行本文的 DMG 产物验收 |

默认不启动系统 Chrome；只有用户明确批准真实浏览器回归时，才追加 `--allow-system-chrome`。

## 流程总览

1. 范围确认：确认本轮是否涉及代码、前端、数据、用户库、导出或打包。工作区脏时，只 stage / 提交明确相关文件。
2. 静态检查：先跑语法、脚本入口和交付契约静态审计。
3. 数据边界：确认 GitHub 不同步数据、正式 JSON 包边界、受保护字典 / 标准 / 生命周期基线未破坏。
4. 业务数据契约：按变更范围执行能力、环境、LC-AP / LC-DT、字典引用、搜索索引等专项审计。
5. 5173 运行态：固定只验 `http://127.0.0.1:5173/`；先确认服务，再跑内容 smoke 和页面 smoke。
6. 用户写入链路：用户库 schema、批注、Issue、数据篮和导出只在临时库或明确测试库上验证，不污染真实用户库。
7. 打包前闸门：DMG 与 5173 一致性契约、Runtime helper、base DB、空用户库模板和双变体规则必须通过。
8. DMG 构建：发布链路必须强制重建 backend，生成 `license` / `no-license` 双 DMG。
9. DMG 产物验收：校验 DMG、codesign、Info.plist、包内空用户库、Runtime `--check-only`、授权差异和核心页面 smoke。
10. 人工 UAT：只验证自动化不能覆盖的桌面窗口、授权弹窗、系统设置、文件保存位置、菜单和真实用户操作。

## 自动测试套件

| 套件 | 可独立执行 | 主要命令 |
|---|---:|---|
| `static` | 是 | Python / Node 语法检查、测试 runner 和 smoke 脚本检查 |
| `boundaries` | 是 | `check_github_data_boundary.py`、`audit_json_package_boundary.py`、受保护基线审计 |
| `data` | 是 | 字典引用、搜索索引质量、能力映射、LC-DT 策略矩阵、模块 / 措施目录审计 |
| `frontend` | 是 | 前端治理、按需加载、路由刷新、滚动 owner、搜索状态、全局搜索锚点审计 |
| `runtime` | 是 | 5173 服务状态、内容 smoke、搜索 / 能力 / 环境 / 生命周期 / 标准页 smoke |
| `user` | 是 | 用户库治理、批注锚点、批注完整性、迁移临时库、数据篮 / 导出 API smoke |
| `delivery` | 是 | DMG / 5173 一致性契约和 Runtime helper 检查，不构建 DMG |
| `dmg-build` | 是，但需显式授权 | `SAPD_WIKI_REBUILD_BACKEND=1 apps/macos/SAPDWiki/script/package_dmg.sh` |

查询可用套件：

```bash
node scripts/run_project_test_suite.mjs --list
```

只预览命令，不执行：

```bash
node scripts/run_project_test_suite.mjs --suite pre-dmg --dry-run
```

## 用例矩阵

| 用例 | 环节 | 触发条件 | 验收点 | 自动命令 / 人工动作 |
|---|---|---|---|---|
| TC-001 | 工作区边界 | 任意提交 / 打包前 | 只提交相关文件；不混入 JSON、SQLite、原始资料、导出包 | `git status -sb`；必要时定向 `git diff --check -- <files>` |
| TC-002 | 语法入口 | 任意代码改动 | Python / Node 入口无语法错误 | `node scripts/run_project_test_suite.mjs --suite static` |
| TC-003 | GitHub 同步边界 | 同步 GitHub 前 | 原始资料、SQLite、正式生成 JSON、导出包不进入 GitHub | `python3 scripts/check_github_data_boundary.py` |
| TC-004 | JSON 包边界 | 数据包、前端投影或打包前 | 正式 JSON 包无禁止字段 / 越界内容 | `python3 scripts/audit_json_package_boundary.py` |
| TC-005 | 受保护基线 | 字典、标准、LC、数据库或导出链路变化 | 字典 / 标准 / 生命周期基线不被清空或回退 | `python3 scripts/audit_dictionary_standard_baseline_integrity.py` |
| TC-006 | 字典引用 | 能力、环境、LC、维护包变化 | `type/id/code/title` 以权威字典为准，不跨粒度兜底 | `node scripts/audit_dictionary_reference_consistency.mjs` |
| TC-007 | 能力映射 | 安全能力页、能力数据或标准映射变化 | 关注点粒度关系、管理视角、技术视角、标准映射与源契约一致 | `python3 scripts/audit_capability_mapping_integrity.py` |
| TC-008 | 环境映射 | 信息化环境页或环境数据变化 | 不从服务级聚合反推模块 / 措施，不继承 H 列空值 | 环境专项审计 + 5173 环境页 smoke |
| TC-009 | LC-DT 矩阵 | LC-DT 表格、搜索、生命周期包变化 | 单行策略矩阵等于源表行级粒度，不按阶段全集扩展 | `python3 scripts/audit_lcdt_policy_projection_contract.py` |
| TC-010 | 前端加载 | `dataClient`、ViewModel、投影、缓存变化 | L0 / L1 / L2 / 关注点当前对象一致，不误用默认关注点 | `node scripts/audit_capability_viewmodel_contract.mjs` |
| TC-011 | 全局搜索 | 搜索索引、页面定位、路由变化 | `route + object_type + target_ref` 决定目标页面和锚点；按搜索专项用例矩阵验证 golden query、反例和字段边界 | `node scripts/audit_global_search_index_contract.mjs` + `python3 scripts/audit_search_index_quality_probes.py` |
| TC-012 | 搜索历史 | 搜索框、局部搜索或工作台搜索变化 | 不同业务域搜索历史隔离，删除 / 清空只影响当前域 | `node scripts/audit_search_state_isolation.mjs` |
| TC-013 | 滚动与按钮 | 工作台、表格、三栏布局、底部操作区变化 | 页面外层高度明确，面板是本地滚动 owner，按钮可触达 | `node scripts/audit_frontend_scroll_contract.mjs` |
| TC-014 | 5173 服务 | 前端 / 后端 / 数据改动后 | 5173 是项目服务，首页和工作区投影正常 | `python3 scripts/dev_server_guard.py --status` |
| TC-015 | 5173 内容 smoke | 打包前、数据改动后 | 核心数据包和 API `dataState` 为 `ready` | `node scripts/frontend_content_smoke_check.mjs --url http://127.0.0.1:5173` |
| TC-016 | 页面 smoke | 页面代码或路由变化 | 搜索、能力、环境、LC、标准页 HTTP/API 正常 | `node scripts/run_project_test_suite.mjs --suite runtime --url http://127.0.0.1:5173` |
| TC-017 | 批注锚点 | 批注、选区、高亮、页面锚点变化 | 批注能绑定稳定锚点，不泄露调试字段 | `node scripts/audit_user_annotation_contract.mjs` |
| TC-018 | 用户库 schema | 用户库、导出、打包 Runtime 变化 | 新用户库为 `user_schema_0.3`；真实用户库不被静默覆盖 | `node scripts/audit_user_db_governance_contract.mjs` |
| TC-019 | 用户写入 API | 数据篮、导出、工作台用户态变化 | 临时 Runtime 上创建、预览、导出、下载、删除闭环通过 | `node scripts/smoke_user_data_basket_api.mjs` |
| TC-020 | 打包一致性 | 任意 DMG 前 | DMG 与 5173 同源构建输入；允许差异进入白名单 | `node scripts/audit_mac_dmg_browser_parity_contract.mjs` |
| TC-021 | backend 构建输入 | 后端源码或 helper 变化 | helper 变化会触发 PyInstaller backend 重建，不复用旧 backend | `node scripts/audit_mac_dmg_browser_parity_contract.mjs` |
| TC-022 | DMG 构建 | 发布完整链路 | 生成 `license` / `no-license` 双 DMG，版本和时间戳一致 | `SAPD_WIKI_REBUILD_BACKEND=1 apps/macos/SAPDWiki/script/package_dmg.sh` |
| TC-023 | DMG 校验 | DMG 生成后 | 两个 DMG 均可挂载 / 校验 | `hdiutil verify <dmg>` |
| TC-024 | App 签名 | DMG 生成后 | staging `.app` codesign 验证通过 | `codesign --verify --deep --strict <staging-app>` |
| TC-025 | 授权变体 | DMG 生成后 | `license` 包启用授权；`no-license` 包不弹授权 | `plutil` 查 `SAPDWikiLicenseMode` + 人工打开验证 |
| TC-026 | 包内用户库 | DMG 生成后 | 包内 `sapd_wiki_user.sqlite3` 为空且 schema 为 `user_schema_0.3` | `sqlite3 <user-db> "select value from user_meta where key='schema_version';"` |
| TC-027 | Runtime 健康 | DMG Runtime 复制到临时目录后 | `--check-only` 通过；API smoke 能访问核心路径 | 从 staging App 复制 `Runtime` 到 `/private/tmp` 后执行 backend check |
| TC-028 | 首次启动体验 | 人工 UAT | 用户选择父级保存位置后创建 `SAPDWiki/import`、分类 `SAPDWiki/export` 和内部 `SAPDWiki/Runtime`；设置页可查看并在 Finder 中打开 | 打开 DMG 内 App，按首次启动流程验证 |
| TC-029 | 授权体验 | 人工 UAT | 授权版可跳过试用 / 输入 `Passc0de` 激活；无授权版不显示授权窗口 | 人工打开两个变体 |
| TC-030 | 导出体验 | 人工 UAT | 评估报告、评分表、模板、Issue 和诊断包写入设置的导出根目录及对应分类子目录，前端显示真实完成路径 | 在 DMG App 中逐类执行导出 |

## 搜索专项用例

搜索测试不是只验证页面能打开。全局搜索必须验证业务域覆盖、点击定位、反例排除、字段边界、分页计数和结果高亮；局部搜索必须验证业务对象队列、上一条 / 下一条和历史隔离。

| 用例 | 搜索范围 | 样例词 | 反例 | 验收点 | 自动命令 |
|---|---|---|---|---|---|
| SC-001 | 全局搜索 / 能力 | `RASP` | `数据中心` 不应漏入能力路由 | 命中 `安全能力`，路由为 `/capability-mapping`，结果携带 `route` + `target_ref` 或 `object_id` | `python3 scripts/audit_search_index_quality_probes.py` |
| SC-002 | 全局搜索 / 环境 | `数据中心` | `ISSUE清单` 不应漏入环境路由 | 命中 `信息化环境`，路由为 `/environment-mapping`，点击可定位环境对象或对象关系节点 | `python3 scripts/audit_search_index_quality_probes.py` |
| SC-003 | 全局搜索 / LC-AP | `Ansible` | `人工智能` 不应漏入 LC-AP 路由 | 命中 `生命周期`，路由为 `/development-security`，结果定位所属开发安全阶段 | `python3 scripts/audit_search_index_quality_probes.py` |
| SC-004 | 全局搜索 / LC-DT | `数据脱敏` | `Ansible` 不应漏入 LC-DT 路由 | 命中 `/data-security`，覆盖服务 / 模块 / 措施和策略矩阵行级目标 | `python3 scripts/audit_search_index_quality_probes.py` |
| SC-005 | 全局搜索 / 知识库 | `WAF` | `ISSUE清单` 不应漏入知识库路由 | 命中 `/knowledge/`，结果对象为服务、模块、措施或知识库路由，并可定位具体行 | `python3 scripts/audit_search_index_quality_probes.py` |
| SC-006 | 全局搜索 / 标准 | `人工智能` | `数据中心` 不应漏入标准路由 | 命中 `标准 / 框架`，路由为 `/standards/`，对象粒度为 `standard_control` | `python3 scripts/audit_search_index_quality_probes.py` |
| SC-007 | 全局搜索 / 工作台 | `ISSUE清单` | `人工智能` 不应漏入工作台路由 | 命中 `/workbench/`，对象类型为 `route` | `python3 scripts/audit_search_index_quality_probes.py` |
| SC-008 | 全局搜索 / 大结果集 | `管理`、`组织` | 无 | `facets.total` 使用全量计数，结果窗口只返回当前页；`组织` 的 offset `100` 和 `460` 均可访问 | `python3 scripts/audit_search_index_quality_probes.py` |
| SC-009 | 全局搜索 / 弱命中裁剪 | `密码`、`数据脱敏`、`应用页面水印` | `密码` 不提升弱上下文命中；`应用页面水印` 不串到 `数据内容水印` | 结果只保留目标对象标题或强相关命中，不靠关系上下文误召回 | `python3 scripts/audit_search_index_quality_probes.py` |
| SC-010 | 全局搜索 / 空结果 | `zzzz` | 无 | 返回空结果窗口，`facets.total=0`，不出现假空态数据 | `python3 scripts/audit_search_index_quality_probes.py` |
| SC-011 | 全局搜索 / 能力关系定位 | `M-PM.PR-00` | 不能只打开关系图谱 | 字典结果进 `/knowledge/technical-services` 并展开服务行；能力关系结果进 `/capability-mapping` 技术视角并定位 chip | `node scripts/audit_global_search_index_contract.mjs` |
| SC-012 | 全局搜索 / 标准行定位 | `纵深` 或 `SEA-03` | 不能停在标准页首页 | 标准结果携带 `standard_control:<framework>:<table>:<row>`，点击后补入并定位具体标准行 | `node scripts/audit_global_search_index_contract.mjs` |
| SC-013 | 局部搜索 / LC-AP | `外包`、`部署` | 无 | `外包` 命中多个阶段；`部署` 按字段级 occurrence 计数，不只按阶段行计数 | `node scripts/frontend_content_smoke_check.mjs --skip-api` |
| SC-014 | 局部搜索 / LC-DT | `PR.07` | 无 | 命中策略矩阵行，`target_ref` 可定位到矩阵行或行内服务 / 模块 chip | `node scripts/frontend_content_smoke_check.mjs --skip-api` |
| SC-015 | 局部搜索 / 能力页 | `持续` | 无 | 上一条 / 下一条基于业务对象队列，选中能力行同步右侧详情，不靠当前 DOM 文本 | `node scripts/frontend_content_smoke_check.mjs --skip-api` |
| SC-016 | 搜索状态 / 历史隔离 | `capability`、`environment`、`lc-ap`、`lc-dt`、`knowledge`、`standards`、`workbench-issues` | 删除一个域历史不影响其他域 | 全局搜索与页面搜索状态隔离；各业务域搜索历史独立；IME 输入和焦点恢复不破坏查询 | `node scripts/audit_search_state_isolation.mjs` |

## DMG 打包完整验收

打包前先跑：

```bash
node scripts/run_project_test_suite.mjs --suite pre-dmg --url http://127.0.0.1:5173
```

构建双 DMG：

```bash
SAPD_WIKI_REBUILD_BACKEND=1 apps/macos/SAPDWiki/script/package_dmg.sh
```

构建后必须记录：

- 授权版 DMG 路径、大小、SHA-256；
- 无授权版 DMG 路径、大小、SHA-256；
- `Info.plist` 中 `CFBundleShortVersionString`、`SAPDWikiDisplayVersion`、`SAPDWikiLicenseMode`；
- 包内用户库 `user_notes=0` 和 `schema_version=user_schema_0.3`；
- 两个 DMG 的 `hdiutil verify`；
- 两个 staging App 的 `codesign --verify --deep --strict`；
- Runtime `--check-only` 和必要 API smoke；
- 授权版 / 无授权版人工 UAT 差异。

验收失败时不得发布 DMG。5173 通过不能替代 DMG Runtime 通过；DMG 可打开也不能替代数据 / 用户库 / 授权模式验收。

## 失败处理

- 静态检查失败：先修脚本 / 语法，不进入数据或打包。
- 数据边界失败：停止提交和打包，先确认是否误改正式数据或生成包。
- 业务数据审计失败：如果是源数据 / ETL / 字典 / 标准 / SQLite / 正式 JSON 问题，按 `open-issues.md` 门槛建单；小范围代码回归直接修。
- 5173 smoke 失败：不进入 DMG 构建。
- DMG 契约失败：不打包；先修构建输入、backend hash、用户库模板或文档冲突。
- DMG 产物失败：不发布；保留路径、日志、失败命令和 SHA，必要时重打。
- 人工 UAT 失败：若自动验证未覆盖，补审计脚本或用例，再修复。

## 维护规则

- 新增长期测试必须优先接入 `scripts/run_project_test_suite.mjs`，再写入本文用例矩阵。
- 单次小问题验证不新增长期用例；只在 `progress.md` 和完成反馈记录。
- 涉及发布、数据边界、用户库、搜索锚点、导出或 DMG 的回归，必须补长期用例或复用现有用例。
- 本文由 `docs/07-governance/governance-index.md` 和 `docs/README.md` 索引；若未来接入 CI，可把本文件作为 CI 分层依据。
