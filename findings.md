# Findings Index: SAPD 工作知识库系统

本文档只保留当前仍有效的关键决策、重要风险和历史入口。详细过程记录、阶段性发现和旧判断已归档。

## 当前关键决策

| 决策 | 当前结论 | 详细来源 |
|---|---|---|
| 当前主线 | 已导入 Sheet 的业务含义复核 + 前端关系展示校正 | `CURRENT_STATE.md`, `task_plan.md` |
| Frontend Baseline 1.0 范围 | 关系工作台实现重点仍为三页：`安全能力映射`、`LC-AP开发安全生命周期`、`信息化环境维度`；全站菜单和数据契约规划另纳入 `SAPD成熟度评估` 独立模块 | `docs/04-user-guide/frontend-baseline-1.0-plan.md`, `docs/00-overview/frontend-menu-and-page-type-definition-v1.md` |
| 信息化环境维度定位 | 第一批核心数据的第三个业务视角，不是新 Sheet 扩展 | `docs/04-user-guide/frontend-baseline-1.0-plan.md` |
| 前后端边界 | 全工程遵守前后端分离；后端负责业务事实、关系、评分和投影；前端只消费 `dataClient` / `/api/v1/*` 契约并做展示交互 | `AGENTS.md`, `docs/01-architecture/backend-interface-design.md`, `docs/01-architecture/api-field-contract.md` |
| MVP 前端技术路线 | 当前继续使用静态页面 + 原生 JS + `dataClient` + ViewModel | `task_plan.md` |
| 数据优先 | 字段定义、映射规则、schema、ETL 先于页面扩展 | `docs/02-data-model/`, `docs/03-import-etl/` |
| 导入方式 | 坚持 `source -> staging -> review -> approval -> formal tables` | `docs/03-import-etl/excel-import-mvp-design.md` |
| 来源追踪 | 知识对象和关系必须保留来源文件、位置、hash 和导入任务 | `docs/06-implementation/local-data-layout.md` |
| 顾问端交付模型 | V1 面向咨询顾问交付压缩包；首次打开后由应用一键初始化预置 SQLite 数据库、页面数据包和预览资源；顾问端不安装开发依赖、不自行导入资料、不执行 ETL / migration；V1 不做登录、注册、账号和权限体系 | `docs/01-architecture/consultant-delivery-model.md`, `docs/06-implementation/local-data-layout.md` |
| Delivery Bundle 1.0 交付版 | 正式边界收紧为“预构建知识库运行版”，不是“一键导入版”：制作者 / 管理员端负责原始资料、ETL、清洗、审查、审批和构建只读 `sapd_wiki_base.sqlite3`；普通用户端安装 App 后读取 base，并把备注、收藏、个人标签、overlay、修正建议和用户新增数据写入 `sapd_wiki_user.sqlite3` | `docs/09-delivery/delivery-bundle-1.0-prebuilt-database.md`, `docs/01-architecture/delivery-bundle-1.0-prebuilt-database.md` |
| Delivery Bundle 1.0-alpha 路线 | 第一优先级正式改为 `.zip` 解压即用版：后端可执行文件同时提供 API 和前端静态页面，浏览器访问 `127.0.0.1`；包内携带 `sapd_wiki_base.sqlite3`、自动创建 `sapd_wiki_user.sqlite3`、manifest、start/stop 脚本、logs 和 diagnostics。Tauri 壳、`.dmg`、`.msi/.exe`、签名和自动更新均后置 | `docs/09-delivery/zip-bundle-1.0-alpha-design.md`, `docs/09-delivery/delivery-bundle-1.0-prebuilt-database.md`, `task_plan.md` |
| ZIP-DB-1 最小运行闭环 | ZIP alpha 已补齐最小运行契约和脚手架：`base-manifest.json` 契约、`sapd_wiki_user.sqlite3` 最小 schema、bundle root 启动检查、端口选择、诊断包内容、用户库创建脚本、bundle 检查脚本、诊断导出脚本和 bundle builder 骨架；后续仍需进入 `stable_key` 策略和真实后端可执行文件打包 | `docs/09-delivery/zip-bundle-1.0-alpha-runtime-design.md`, `docs/09-delivery/base-manifest-contract.md`, `docs/09-delivery/user-database-minimum-schema.md`, `scripts/create_user_db.py`, `scripts/check_bundle_runtime.py`, `scripts/export_diagnostics.py`, `scripts/build_zip_bundle.py` |
| ZIP-RUN-1 分平台运行闭环 | ZIP alpha 交付边界进一步明确为分平台 ZIP，不是 exe 安装器；Windows ZIP 内部使用 `SAPD-Wiki-Backend.exe`，macOS ZIP 内部使用 `SAPD-Wiki-Backend` / `.command`。`scripts/run_local_server.py` 已作为平台运行组件源码入口，支持 runtime check、静态前端、base 只读 API、user 收藏写入 API、日志和诊断。macOS 未签名可执行文件、`.command` 执行权限和 Gatekeeper 提示为 alpha 已知风险，后续签名阶段解决 | `docs/09-delivery/zip-bundle-1.0-alpha-runtime-design.md`, `scripts/run_local_server.py`, `scripts/build_zip_bundle.py` |
| ZIP-PACK-1 打包工具与实包状态 | alpha 打包工具冻结为 PyInstaller，Nuitka 保留备选；原因是当前本地后端仍为 Python，PyInstaller 能最快生成平台运行组件。PyInstaller 不是交叉编译器：当前 macOS arm64 机器已生成并验证真实 `SAPD-Wiki-v0.1.0-mac-arm64.zip`；Windows `SAPD-Wiki-Backend.exe` 只能在 Windows x64 环境构建和验证，当前状态为构建脚本与验收清单就绪、未实机验证 | `scripts/package_backend_pyinstaller.py`, `scripts/package_backend_windows.ps1`, `docs/09-delivery/windows-zip-build-guide.md` |
| ZIP-UAT-0 内部试发边界 | macOS arm64 已具备 1-3 人内部小范围试发条件，alpha 试发材料已固定到 `/Users/kim1st/Documents/kim note/04_workspace/research/知识库工程/sapd wiki bundle/dist/releases/0.1.0-alpha/`；Windows x64 仍为构建脚本就绪 / 未实机验证，release manifest 中标记为 `pending / not_verified`。完整双平台 UAT 必须等 Windows x64 实包验证通过后再启动 | `docs/09-delivery/zip-uat-0-internal-trial-guide.md`, `docs/09-delivery/zip-uat-0-checklist.md`, `docs/09-delivery/zip-uat-feedback-template.md` |
| C/S 客户端交付路线 | ZIP alpha 不被 Tauri / 安装包替代；后续 macOS / Windows C/S 客户端建议走 `Tauri Client + SAPD-Wiki-Backend sidecar + base/user 双库 + 127.0.0.1 本地 API`，先做 macOS arm64 P1 Spike，再进入签名、公证、Windows installer、自动更新和企业分发治理 | `docs/09-delivery/cs-client-delivery-presearch-macos-windows.md` |
| Delivery Bundle 1.0 设计沟通边界 | 设计团队先聚焦首次启动准备态、初始化失败 / 修复、本地数据状态、升级提示和 zip 用户说明；不设计登录、导入、数据库选择器、ETL 配置器或开发者控制台 | `frontend/design-handoff/implementation-specs/delivery-bundle-1.0-design-brief-2026-05-28.md` |
| 问题与文档管理 | 小修、小 bug 和一次性排查默认直接修复，不新增文档、不新建 `OI`；只有全局契约、数据 / 审计 / 安全边界、中高严重性、无法本轮闭环或需要用户判断 / 验收的问题才进入 `open-issues.md`；新文档必须有读者、长期用途、索引和退役条件 | `AGENTS.md`, `docs/07-governance/governance-index.md`, `docs/06-implementation/open-issues.md` |
| 设计文档治理 | 设计文档按用途分层管理：`docs/04-frontend/` 放信息架构 / brief，`docs/06-implementation/frontend-*` 放全局设计基线和跨页契约，`frontend/design-handoff/implementation-specs/` 是唯一页面实现规格入口，`stitch-*` 只作 reference。小 UI 修复、文案和局部样式不新增设计文档 | `docs/README.md`, `docs/07-governance/governance-index.md`, `frontend/design-handoff/README.md` |
| 全工程前端优化交付口径 | 审计风险、通用设计原则和页面优化方案必须分层记录；每条已识别风险都要有具体改法、不改边界、验收和优先级。用户单独补充的能力图谱碰撞、Draw.io 不可变和成熟度完整设计是对应页面约束，不能替代其他风险方案 | `frontend/design-handoff/implementation-specs/frontend-global-optimization-plan-2026-07-11.md` |
| P0-1 正确性与安全边界 | 当前对象只能由显式选中 ID 驱动；Draw.io 原图用固定哈希保护且定位只走外部 overlay；状态色与对象角色色使用独立命名空间；`sourceEvidence` 等技术来源证据不得进入 `localRelationMap` 主展示模型；键盘焦点和动态状态必须持续通过统一门禁 | `config/frontend-p0-1-correctness-boundary.json`, `scripts/audit_frontend_p0_1_correctness_boundary_contract.mjs` |
| P0-2 Apple Shell 与共享布局 | 共享壳只能有一个页面标题所有者；全局导航任一时刻只展开一个业务域并保证当前项可见；普通页面最多一个 resident auxiliary，第二辅助层必须按需 overlay。成熟度不是例外：全部成熟度路由使用 `main-only`，主动作进入共享页头，业务区不得再造主页头，新建项目只能使用居中 workflow overlay；评分目录属于业务主区，不算 Shell auxiliary layer。共享壳字号收敛为 `12 / 14 / 16 / 24px`、圆角收敛为 `6 / 10 / 14px`；标题区以旧 DMG `0.1.7` 为视觉真值，固定 `96px` 高、`24px / 1.13` 标题、`12px / 1.45` 说明、`12px 18px` 内边距和 `5px` 文本组间距，业务页不得局部覆写。不得借此全局覆盖业务表格或改变成熟度业务 / 评分规则 | `config/frontend-p0-2-apple-shell-layout.json`, `scripts/audit_frontend_p0_2_apple_shell_layout_contract.mjs` |
| P0-4 标准与 Issue 壳层派生 | 标准深链的当前位置由全局 `AppShell` 标准域与标准页面当前框架共同表达，刷新不能只恢复其中一层；Issue 详情只由显式 `workbenchSelectedIssueId` 打开，批量勾选集合不得替代当前详情对象，禁止 `rows[0]`、旧路由选择或单项勾选隐式打开 inspector。未选择时 inspector 不渲染且占宽为 0；关闭详情后恢复队列宽度与行焦点；Issue 路由只展开工作台域 | `frontend-global-optimization-plan-2026-07-11.md`, `frontend/capability-browser/components/AppShell.js`, `frontend/capability-browser/app.js` |
| maturity 边界 | maturity 是主工程下独立模块；运行数据使用 `maturity_*`，不写入 `knowledge_items` | `docs/08-maturity/` |
| SAPD 成熟度评估入口 | `/workbench/maturity/demo-project-001` 第六轮评分工作台根因纠偏已完成 Web 实现并待用户验收。根因规则：服务 Tab 的状态、完整名称和适用性必须属于同一卡片；选中分数不是旁边定义区的触发器，而是自身从 `42px` 平滑扩展到至少 `300px` 并在格内承载数字、等级名和定义；滚动锁定对象是项目名称 / 模板 / 更新时间与六个项目步骤组成的完整 `100px` 项目区，不是其中一行。关注点统计、底部主动作、目标等级术语和不适用排除规则继续沿用第五轮有效契约。正式持久化与 DMG App 证据仍后置 | `maturity-assessment-v2-1-complete-frontend-design-2026-07-12.md`, `frontend-global-optimization-plan-2026-07-11.md`, `SAPD_成熟度评估业务设计_V2.1_20260712.md`, `design-qa.md`, `OI-192` |
| 成熟度评分输入粒度 | 关注点只承担对象定义与下级未评分时的一次性批量初始化，不展示由下级服务分数回写的关注点评级；下级已有任一评分后，不再允许关注点统一初始化。安全技术服务评估点按四维逐项评分，结果计算仍由后端按既有聚合契约生成，前端不得把汇总结果改造成父级输入 | 用户 2026-07-13 第 9 项裁定、三份成熟度 V2.1 文档、`src/sapd_wiki/maturity.py` |
| 成熟度操作后跳顶根因 | 实际纵向滚动容器是重渲染区域内部的 `.maturity-v1-project-page`；旧 `captureRenderPosition()` 只保存 `model.root` 及其祖先，并把评分面板保存成即将被 `innerHTML` 替换的旧 DOM 节点，因而评分按钮触发重渲染后真实滚动容器回到 `0`。修复必须按稳定选择器重新获取新滚动容器并恢复 `scrollTop`，不能继续保存旧节点引用 | 应用内浏览器 1486×1058 修复前 `431 → 0`；修复后评分与适用性真实坐标点击前后及试算完成均为 `512.5`；`MaturityAssessmentWorkbench.js` |
| 成熟度设计图人工评审基线 | 图 1 是结构与密度基线，图 2—9 是本轮必须关闭的验收差距。评估点列表与安全技术服务评估区必须是两个清晰区域；当前项显示蓝色状态，已完成项显示真实勾选状态；适用性用方框勾选；当前下级对象不用下拉；选中等级后只就地显示当前等级定义 | 用户 2026-07-13 九张截图、`frontend/capability-browser/components/MaturityAssessmentWorkbench.js`, `frontend/capability-browser/maturity-assessment-workbench.css`, `design-qa.md` |
| 2026-07-12 项目计划队列 | `PLAN-MAT-WS` 已完成 V2.1 受控 demo 实现及 Web 回归，正式持久化与 DMG App 验收后置；`PLAN-STD-NICE` 仍为组织岗位设计的数据源前置，`PLAN-ORG-ROLE` 仍在计划池 | `task_plan.md`, `CURRENT_STATE.md` |
| Demo-first 数据与前端试验 | 后续新数据、实验数据和前端试验先在当前 `main` 通过受控 demo 页 / demo 数据验证业务口径；正式接入基础库、字典、标准、SQLite、正式 JSON 或 DMG 前，必须另行确认权威源、对象粒度、写入范围、回退方案和审计清单 | `AGENTS.md`, `CURRENT_STATE.md`, `task_plan.md` |
| AI 安全能力体系扩展 | 新增 AI / 人工智能安全 L2 能力或关注点时，先做 demo 页 / demo 数据和关系样例，确认业务口径后再决定是否正式进入基础库或用户库；不能直接改正式能力清单、字典、SQLite、JSON 或 DMG | `task_plan.md`, `CURRENT_STATE.md` |
| 后续项目推进方式 | 后续计划拆成“前端页面设计线”和“后端数据 / 逻辑线”；每页按后端投影契约 -> 前端页面实现 -> 验收回归推进 | `task_plan.md` |
| 页面优先级 | 先收敛安全能力映射页作为关系画布基准，再推进信息化环境维度页，最后推进 LC-AP 页 | `task_plan.md` |
| 信息化环境图谱策略 | 信息化环境页按层级回答不同问题：`E0` 信息化环境只展示环境子类和对象结构，`E1` 环境子类展示对象、作用域、服务和能力 / 关注点概览，`E2` 信息化对象完整展示作用域、服务、模块 / 措施、系统、产品和能力 / 关注点；标准 / 流程不从能力页反向拼接 | `frontend/design-handoff/implementation-specs/environment-security-capability-graph-strategy-2026-05-20.md` |
| 安全知识目录信息架构 | `安全知识` 复用 `maintenanceWorkspace`，不是独立新页面；外层二级入口收口为安全能力作用域清单、安全技术模块/措施清单、安全管理工作/流程清单、安全职能清单、Hype Cycle、其他知识目录；模块/措施、管理工作/流程、职能/岗位参考在页面内部用 Tab 切换，兼容旧直达路由但不作为主导航入口 | `frontend/design-handoff/implementation-specs/security-knowledge-frontend-data-handoff-2026-05-21.md`, `frontend/capability-browser/components/AppShell.js` |
| 安全技术模块目录展示边界 | 领域分类来自原始 `安全技术模块清单` B 列，安全系统来自 C 列；模块目录按“领域分类 -> 安全系统 -> 安全技术模块”两级分组并保持原表行顺序；模块-措施、模块-作用域、模块-信息化对象若未进入维护包契约，显示为契约缺口，不在前端组件临时反推 | `frontend/design-handoff/implementation-specs/security-knowledge-frontend-data-handoff-2026-05-21.md`, `src/sapd_wiki/parsers.py`, `src/sapd_wiki/staging.py`, `frontend/capability-browser/viewModels.js` |
| BE-0 契约盘点 | 当前仅安全能力映射页有页面级投影；环境页和 LC-AP 页仍主要依赖 `data-packages` + ViewModel 整理 | `docs/01-architecture/api-offline-package-contract-inventory.md` |
| 全站菜单与页面类型 | 最新全站菜单、页面类型枚举、路由建议、导航 Manifest、Stitch 交接说明和全局导航 / 应用壳 Stitch Prompt 已固化；Manifest 与 Stitch 输出不接入运行代码，需先转 implementation spec | `docs/00-overview/frontend-menu-and-page-type-definition-v1.md`, `frontend/design-handoff/README.md`, `frontend/design-handoff/navigation/nav-manifest.v1.json`, `frontend/design-handoff/stitch-prompts/00-application-shell.md` |
| 前端数据契约治理 | 当前有必要进行数据治理；Frontend Baseline 1.0 建议修正为“P1 双核心工作台 + LC-AP 受控专项关系投影”；先治理 export / 页面数据包，再统一前端组件 | `docs/04-user-guide/frontend-data-contract-baseline-1.0.md` |
| 前端 JSON 数据包台账 | 新增 `frontend-json-data-package-inventory.md` 作为所有 `public/data/*.json` 的用途、页面归属、legacy 状态、发布处理和退役条件入口；后续新增 / 删除 / 拆分 JSON 必须同步更新 | `docs/01-architecture/frontend-json-data-package-inventory.md` |
| 字典与标准框架只读基准 | `知识库字典` 和 `安全标准 / 框架` 是全局只读基准；环境映射、能力映射、生命周期和临时核对表只能引用或输出差异报告，不得反向改写基准包。每次导入 / 导出 / 重导入或前端正式数据包替换后必须运行 `python3 scripts/audit_dictionary_standard_baseline_integrity.py` | `AGENTS.md`, `docs/07-governance/data-governance.md`, `docs/06-implementation/open-issues.md` |
| 三份 workbench 规格 | `capability-workbench.json`、`environment-workbench.json`、`lifecycle-workbench.json` 三份规格已齐；最终目标数据文件清单冻结为 P0 四件套 + P1 三件套；`management-knowledge.json` 已从顾问端运行路径退役，`lifecycle-knowledge.json` 仅保留生命周期专项数据 | `docs/04-user-guide/capability-workbench-json-spec-v1.md`, `docs/04-user-guide/environment-workbench-json-spec-v1.md`, `docs/04-user-guide/lifecycle-workbench-json-spec-v1.md` |
| 三份 workbench 数据出口 | `capability-workbench.json`、`environment-workbench.json`、`lifecycle-workbench.json` 已能由 CLI 生成；`dataClient` / ViewModel 已提供稳定读取入口；旧 JSON 保留为过渡兼容，不作为新 UI 主输入 | `src/sapd_wiki/exports.py`, `src/sapd_wiki/cli.py`, `frontend/capability-browser/dataClient.js`, `frontend/capability-browser/viewModels.js` |
| `management-knowledge.json` 退役边界 | 已完成退役：`assets`、顶层 `service_module_index`、安全知识重复数据和环境旧树均不再作为顾问端发布包、API 数据包或前端 fallback；安全知识由 `maintenance-knowledge.json` 承接，环境关系由 `environment-workbench.json` 承接，共享索引由 `shared-lookups.json` 承接 | `frontend/capability-browser/public/data/shared-lookups.json`, `frontend/capability-browser/public/data/maintenance-knowledge.json`, `frontend/capability-browser/public/data/environment-workbench.json`, `src/sapd_wiki/exports.py`, `src/sapd_wiki/api_server.py` |
| BE-4 数据质量首轮审计 | 三份 workbench 顶层结构、关系端点、孤立对象和主展示字段边界均通过静态检查；`CI/CD流水线` 拆词异常、能力页标准 / 框架映射和 LC-AP 阶段级措施投影均已修复；当前继续跟踪 `OI-073` 源数据一致性待确认项 | `docs/06-implementation/be-4-workbench-data-quality-gap-list.md`, `docs/06-implementation/open-issues.md` |

## 2026-07-11 全工程前端设计外部参考

- Apple HIG `Materials`：材质层应主要服务导航和控件，内容层保持清晰、稳定，避免把玻璃效果铺满业务表格和工作区。来源：<https://developer.apple.com/design/human-interface-guidelines/materials>
- Apple HIG `Sidebars`：侧栏适合扁平业务域导航；层级更深或可用宽度不足时应切换为 split view / 更紧凑导航，而不是持续增加常驻层级。来源：<https://developer.apple.com/design/human-interface-guidelines/sidebars>
- SAP Fiori `Flexible Column Layout`：列表—详情类流程可以使用可变列；不应以空详情列开场，也不应默认三列同时出现；工作台附加内容更适合按需 dynamic side content。来源：<https://experience.sap.com/fiori-design-web/flexible-column-layout/>
- SAP Fiori `Toolbar` / `Table Overview`：表格级搜索、筛选和动作应靠近表格并进入单一 toolbar；宽度不足时动作进入 overflow；复杂表格优先减少列、使用多行单元格或渐进披露。来源：<https://experience.sap.com/fiori-design-web/toolbar-overview/>、<https://experience.sap.com/fiori-design-web/table-overview/>
- 以上外部资料只作为设计模式参考，不覆盖 SAPD Wiki 的字段边界、对象粒度、语义色和前后端契约。

## 当前重要风险

| 风险 | 当前处理 |
|---|---|
| 上下文过大导致主控卡死 | 默认读取 `AGENTS.md` + `CURRENT_STATE.md`，长历史放入 `docs/05-archive/` |
| 文档和 Issue 继续膨胀 | 默认不为小修新增文档或 `OI`；修复后需要用户验收的问题必须在完成反馈给入口，用户确认后及时关闭 / 归档 |
| 设计文档散乱导致实现依据不清 | 只把 active / implementation-source 的 `frontend/design-handoff/implementation-specs/` 作为页面代码实现依据；Stitch 输出、截图和旧 brief 必须先转成 spec 或降级为 reference |
| 过早正式化成熟度模块 | 受控 demo V2 通过不等于正式库或 DMG 已交付；正式 `maturity_*` 持久化、客户数据、发布包和 App 验收必须另行确认 |
| 前端硬编码业务关系 | 发现数据缺口时记录为数据契约或待确认问题，不在页面临时编造 |
| 前后端边界漂移 | 新页面、新字段和新关系先更新后端契约，再进入前端实现；禁止组件直接读取原始数据或临时 JSON |
| 非业务字段泄露 | 主展示区不得出现 `sheet`、`row`、`raw_value`、`metadata` 等非业务字段 |
| 成熟度模块污染主知识库 | maturity 只读引用主知识库，客户输入、证据、评分和报告留在 maturity 运行域 |
| 前端画布反复试错导致结构漂移 | 安全能力映射页先作为基准页收敛验收标准；未确认前不复制到环境页和 LC-AP 页 |
| 已规划接口与已实现接口不一致 | `api-field-contract.md` 中部分 `/api/v1/environments/*`、`/api/v1/lifecycle/*`、`/api/v1/maintenance/technical-measures` 等接口尚未在 `api_server.py` 中实现；后续实现前需明确“规划接口”和“实际接口” |
| 桌面交付签名和本地后端适配风险 | macOS 正式外部分发需要签名和 notarization；Windows 需要处理 SmartScreen、杀毒误报、安装目录和应用数据目录；如采用本地 API sidecar，必须固定 `127.0.0.1` 并管理端口、进程生命周期和 fallback |
| macOS ZIP alpha 权限风险 | `.command` 脚本和 `SAPD-Wiki-Backend` 可能在 ZIP 解压后缺少执行权限；未签名可执行文件可能触发 Gatekeeper。ZIP alpha 先在 `README-FIRST.md` 和文档中说明，正式签名 / notarization 后置 |
| PyInstaller 打包边界 | PyInstaller 首次在沙箱内运行会尝试写 `~/Library/Application Support/pyinstaller`，本项目打包脚本已把 `PYINSTALLER_CONFIG_DIR` 指向输出目录；一文件模式在 Codex 沙箱内直接运行可能遇到系统信号量限制，真实 macOS 验证需使用普通本机权限执行 |
| Delivery Bundle 缺少稳定业务键风险 | 如果基础库 clean rebuild 后 UUID 改变，用户库中指向基础对象的备注、收藏、个人标签、关系和修正建议会断裂；进入正式交付前必须补 `stable_key` / deterministic ID、`base_id_redirects` 和 base release 兼容策略 |
| 前端 JSON 职责混杂 | `management-knowledge.json` 的职责混杂已完成退役；后续重点是继续缩小 `capability-tree.json` 与 `lifecycle-knowledge.json` 的非页面级职责 |
| 字典 / 标准基准被导出覆盖风险 | 2026-06-15 已确认当前项目 SQLite 被 `bootstrap-local-data --profile core --reset` 压成 core-only，导致维护字典、应用系统目录和标准框架前端包被导出为空。`P0 Baseline Canonical Data Correction 1.1` 已按用户确认正式补入 4 个生命周期来源安全技术措施，当前正式前端维护包 `security_technical_measures=30`；`lifecycle-workbench.json` 已补回 `relations=542`。当前 SQLite 仍缺 `work_function_layer`、`process_reference`、`application_system_type`、`standard_control` 等保护类型。后续不得从当前 SQLite 直接导出字典 / 标准基准包，`bootstrap-local-data --profile core --reset` 已增加保护基线拦截，除非用户明确授权并先确认数据库恢复策略 |
| 信息化环境映射源表结构丢失风险 | `作用域-安全技术服务-安全技术模块映射` 审计确认该 Sheet 依赖 417 个 merged ranges 和样式区分模块 / 措施；对象实例唯一键已修订为 `信息化环境 + 环境子类 + 信息化对象`，原 8 个同名对象降级为 `sameNameDifferentContexts` 信息提示；1.4 已正式替换 `environment-workbench.json` 与 `environmentBasemap.node-details.json`，替换后 `detailReadyNodes=91`、`missingDetailNodes=0`、`moduleSystemRelations=214`、`securitySystemCells=566`、`moduleCells=612`、`measureCells=123`。当前仍需人工页面验收，并单独决定是否让前端展示已进入数据包的 `securitySystems` 字段 |
| 跨表目录差异人工核对噪声 | `Environment Mapping Dual-table Review UI 1.1` 已把临时核对页拆成 `环境对象核对` 与 `双表对照核对` 两个模式；双表模式以 `安全系统分类 -> 安全系统 -> 安全技术模块 -> 安全技术服务` 为目录基准，展示 455 条目录关系、68 条环境有目录无、230 条目录有环境未精确引用、27 条模块-服务不一致关系和 43 条系统-模块不一致关系。最新 UI 将中间主区改为 `目录表这一边 / 环境映射表这一边 / 对照结论` 的双边对照，并对冲突筛选显示单条件命中数与清空入口。完整重复和 B 类分类问题已清零，coverage gap / 目录未精确引用仍按选择性引用候选处理，不默认视为错误或自动补齐 |
| 源数据一致性仍有待确认项 | `OI-073` 记录源 Sheet `作用域-安全技术服务-安全技术模块映射` 仍残留 5 行旧模块名 `网络数据防泄露`，是否统一替换为 `数据流转监测和泄漏防护` 需要用户确认 |

## 历史入口

| 归档文件 | 内容 |
|---|---|
| `docs/05-archive/context-slimming-2026-05-15/findings-full-before-slimming.md` | 本文件瘦身前的完整 `findings.md` |
| `docs/05-archive/findings-history/2026-05.md` | 2026-05 期间完整发现、实现判断和阶段性记录 |
| `docs/05-archive/context-slimming-2026-05-15/task_plan-full-before-slimming.md` | `task_plan.md` 瘦身前完整计划 |
| `docs/05-archive/progress-history/2026-05.md` | 2026-05 完整执行记录 |

## 维护规则

- 新的长期有效判断可以写入“当前关键决策”或“当前重要风险”。
- 过程性发现、执行日志和验证输出写入 `progress.md`。
- bug、数据问题、页面问题和待确认事项写入 `docs/06-implementation/open-issues.md`。
- 当本文档超过 120 行时，继续归档到 `docs/05-archive/`。
