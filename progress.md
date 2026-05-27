# progress.md

本文件是当前会话恢复入口，只保留最近状态、最近完成事项、关键验证和历史索引。完整执行历史已归档到 `docs/05-archive/progress-history/2026-05.md`。

## 当前状态（2026-05-27）

- 当前分支：`codex-frontend-backend-separation-closure`。
- 当前主线：Frontend Baseline 1.0 四页关系工作台校正；重点仍是已导入 Sheet 的业务语义复核、前端关系展示校正、数据契约治理和字段边界收口。
- 固定预览入口：`http://127.0.0.1:5173/`。多个线程并行验证时可以临时使用其它端口，但验证后必须关闭；面向用户的常驻预览页只保留 `5173`。
- 本轮处理开发体验问题：前端验证频繁弹出 `Google Chrome 意外退出`，以及固定 `5173` 刷新后偶尔看不到最新页面。

## 最近完成事项

- 2026-05-27 high-level 新流程复核与同步：按 `安全能力-安全管理元素（high level）!H` 与 `安全职能流程清单（完善L4）!E` 做规范化精确比对。用户修改原始数据后，当前 high-level 表 78 个唯一 L3 流程参考已全部存在于流程目录主表，原 6 条待复核项已解除；随后重新 stage / approve 第二批 job `6bfc916c-efc9-4b6b-805c-9ac7c279485d`，重新导出 `maintenance-knowledge.json`、`capability-tree.json`、`capability-workbench.json` 和 second-batch summary。当前 `maintenance-knowledge.json` 已同步为 `process_references=78`，`攻防演练/沙盘推演流程` 已进入流程目录导出包。
- 2026-05-27 安全知识全量数据审计：按源表 -> parser -> 数据包 -> 页面契约链路只读核对 `wiki sample.xlsx`、`maintenance-knowledge.json`、`lifecycle-knowledge.json`、`capability-workbench.json`。通过项：安全技术模块目录 102/102、安全管理工作映射审计通过、工作职能 86/86、GB/T 27/27、Gartner 28/28。发现并记录 `OI-093` 至 `OI-096`：作用域主数据被关联表覆盖、流程目录混入 high-level 并发生顿号误拆、措施目录混入 LC-AP/LC-DT 措施、应用系统目录顺序丢失。新增审计报告 `docs/06-implementation/security-knowledge-data-audit-2026-05-27.md`。本轮未修改 Excel、数据库、ETL、前端运行代码或 public data JSON。
- 2026-05-27 安全知识 093-096 确认后修复：按用户确认完成数据边界收口。`安全能力作用域清单` 只按 `安全能力作用域目录` 导出 9 条，`ALL` 和关联表短标题不进目录主表；`安全职能流程清单` 只展示 `安全职能流程清单（完善L4）` 原表显式 L3 流程，high-level 流程不补入目录；`安全技术措施目录` 保留 4 条 LC-AP / LC-DT 生命周期措施并补充 `source_label` / `source_kind` / `mapping_status_label`，前端显示来源标签和待补充关联；`应用系统目录` 按 `LC-AP 应用安全开发生命周期元素目录` 来源行排序。已重新导出 `maintenance-knowledge.json`、`lifecycle-knowledge.json`，并更新 `OI-093` 至 `OI-096` 为已修复。
- 2026-05-27 安全知识 093-096 复查：按用户要求重新执行数据包摘要、管理映射审计、093-096 源表对数据包定点审计和安全知识页面 smoke。复查结论为通过：`scope_types=9`、`process_references=77`、`security_technical_measures=32`、`application_system_types=3`、`application_components=13`；`/knowledge/scopes`、`/knowledge/technical-measures`、`/knowledge/management-workflows`、`/knowledge/application-systems` smoke 均通过。
- 2026-05-26 安全能力映射页加载慢修复：新增 `/api/v1/capabilities/workspace-initial` 轻量初始投影和 `workspace-projection?focus_id=<id>` 按关注点投影，直接进入 `#/capability-mapping` 约 `1.0MB`，业务 fetch 仅 `workspace-initial≈204KB`；`OI-081` 已修复。
- 2026-05-26 全局刷新状态恢复：刷新时恢复当前路由、当前页面选中对象、目录展开状态、维护页 Tab、指南页选中内容和生命周期选择；如果 URL 明确指定页面则优先尊重 URL。
- 2026-05-26 安全能力映射页数据语义修正：`OI-085`、`OI-086`、`OI-087`、`OI-088` 已修复，分别覆盖小投影加载中状态、无服务矩阵计数、管理 high level `/` 空值继承和标准 / 框架空态样式。
- 2026-05-27 开发体验修复：`OI-089` 已修复，`frontend_smoke_check.mjs` 改为优雅关闭 headless Chrome；本地静态预览禁用浏览器缓存；`dev_server_guard.py` 增加 `--restart` 并可清理旧 `http.server` / 失效 Python 预览占用。
- 2026-05-27 Chrome 崩溃报告二次止血：系统 Google Chrome 148 在 Codex 拉起的 headless 场景下仍会触发 macOS `SIGABRT` 报告，因此 `frontend_smoke_check.mjs` 改为默认不启动系统 Chrome，只做轻量 HTTP/API smoke；只有用户明确同意时才允许 `--allow-system-chrome`。
- 2026-05-27 全局前端预览规则：项目级规则已明确，前端展示和用户验收默认只使用 `http://127.0.0.1:5173/`；修改前端后必须确认该端口热刷新到最新文件，失效时用 `python3 scripts/dev_server_guard.py --restart`，不再把 `python -m http.server 5173` 作为常驻服务。
- 2026-05-27 整体能力节点刷新加载修复：`OI-090` 已修复。安全能力映射页刷新恢复到 `T-OF 进攻 Offense`、`安全治理能力 G`、`安全管理能力 M` 等非关注点节点时，会自动补载完整 `capability-workbench` 并重渲染，避免轻量初始投影导致整体关系数据空白。
- 2026-05-27 标准 / 框架空态微调：按用户截图将 `标准 / 框架映射` 空矩阵行收敛为单句 `暂无条款/控制项对应能力关注点`，不再显示额外说明文字。
- 2026-05-27 关注点刷新管理视角修复：`OI-091` 已修复，`workspace-projection?focus_id=...` 同时支持关注点 UUID 和业务 code，前端不再用轻量首屏空壳 workbench 覆盖后端投影，`T-OF.AT-02` 刷新后可恢复管理映射。
- 2026-05-27 管理视角 ETL 全量审计与修复：`OI-092` 已修复。`安全能力-安全管理元素（high level）` 解析现在按 Excel 合并单元格锚点值读取 L2 流程组、L3 流程参考和四层职能，L3 流程名不再按中文顿号拆分，显式 `/` 继续清空对应职能层级；新增 `scripts/audit_capability_management_mappings.py` 做全量回归审计。
- 2026-05-27 LC-DT 页面数据全面复核：已按源表 -> parser -> `lifecycle-knowledge.json` -> `lifecycle-workbench.json` -> `/data-security` 页面链路检查继承、换行拆分、漏导入和模块 / 措施归类；业务数据核对通过，7 个过程、31 个场景、74 个过程级服务关联、29 个模块关联、1 个措施关联均与源表一致，parser validation 为 0，workbench 端点缺失 0；发现来源证据重复记录治理问题，已新增 `OI-092`，不影响当前主展示。
- 2026-05-27 标准 / 框架模块全量数据复核：新增 `scripts/audit_standard_framework_data.py`，按原始 workbook、标准拆包 JSON 和 capability-first 标准映射表检查 7 个页面 / 8 个源表的行数、唯一编号、继承字段、错误换行、漏导入、索引 dataPath 和映射双向一致性；审计报告已写入 `data/processed/reviews/standard-framework-full-data-audit-20260527.md`，问题明细 CSV 只有表头。

## 最近验证

- 2026-05-27 high-level 新流程复核与同步验证：`stage-excel --sheets second-batch` 输出 `objects_staged=512`、`process_reference=78`、`validations=[]`；`approve-import 6bfc916c-efc9-4b6b-805c-9ac7c279485d` 输出 `items_updated=512`、`items_deprecated=5`、`relations_created=45`、`relations_deleted=50`、`warnings=[]`；导出后 `maintenance` data package summary 通过，`process_references=78`；定点 `openpyxl` + JSON 审计输出 `high_level_not_in_directory=[]`、`directory_not_in_maintenance_export=[]`、`attack_drill_in_export=true`；`audit_capability_management_mappings.py` 通过，`issue_count=0`；固定 `5173` 项目服务已恢复，`/knowledge/management-workflows` smoke 通过，`consoleIssues=0`、`bodyOverflowX=0`。
- 2026-05-27 安全知识全量数据审计验证：`python3 scripts/data_package_summary.py --package maintenance`、`python3 scripts/data_package_summary.py --package lifecycle`、`python3 scripts/data_package_summary.py --package capability-workbench`、`python3 scripts/audit_capability_management_mappings.py`、直接 parser validation 脚本均通过；直接 `openpyxl` + JSON 审计输出已写入 `docs/06-implementation/security-knowledge-data-audit-2026-05-27.md`。
- 2026-05-27 安全知识 093-096 修复验证：`python3 -m py_compile src/sapd_wiki/exports.py`、`node --check frontend/capability-browser/viewModels.js frontend/capability-browser/components/TechnicalMeasureMaintenanceTable.js`、`python3 scripts/sapd_wiki.py export-maintenance-knowledge`、`python3 scripts/sapd_wiki.py export-lifecycle-knowledge`、`python3 scripts/data_package_summary.py --package maintenance`、`python3 scripts/data_package_summary.py --package lifecycle`、`python3 scripts/audit_capability_management_mappings.py`、定点 `openpyxl` + JSON 093-096 审计、目标文件 `git diff --check` 均通过；修复后 `scope_types=9`、`process_references=77`、`security_technical_measures=32`、`application_system_types=3`、`application_components=13`。固定 `5173` 旧服务清理需提升权限，已用 `python3 scripts/dev_server_guard.py --fix-duplicates --start` 恢复项目服务；`/knowledge/scopes`、`/knowledge/technical-measures`、`/knowledge/management-workflows`、`/knowledge/application-systems` smoke 均通过，`consoleIssues=0`、`bodyOverflowX=0`。
- 2026-05-27 安全知识复查命令：`python3 -m py_compile src/sapd_wiki/exports.py`、`node --check frontend/capability-browser/viewModels.js`、`node --check frontend/capability-browser/components/TechnicalMeasureMaintenanceTable.js`、`python3 scripts/data_package_summary.py --package maintenance`、`--package lifecycle`、`--package capability-workbench`、`python3 scripts/audit_capability_management_mappings.py`、定点 `openpyxl` + JSON 审计、`git diff --check`、4 个 `node scripts/frontend_smoke_check.mjs --page maintenance --route ...` 均通过；本轮只检查并更新 `progress.md`，未改业务代码或数据包。
- 2026-05-26 capability smoke：固定 `5173` 页面通过，刷新选中关注点可恢复并按需加载小投影，未拉完整 `capability-workbench` 大包。
- 2026-05-26 lifecycle / data-lifecycle / guides / maintenance 等页面近几轮 smoke 均通过；详细命令和截图路径见 `docs/05-archive/progress-history/2026-05.md`。
- 2026-05-27 开发体验验证：`node --check scripts/frontend_smoke_check.mjs`、`python3 -m py_compile src/sapd_wiki/api_server.py scripts/dev_server_guard.py`、`python3 scripts/dev_server_guard.py --restart`、capability smoke、`curl -I http://127.0.0.1:5173/app.js` 和目标文件 `git diff --check` 通过；固定端口 `5173` 当前为项目服务，`app.js` 已返回 `Cache-Control: no-store`。
- 2026-05-27 Chrome 二次止血验证：`node --check scripts/frontend_smoke_check.mjs` 通过；`node scripts/frontend_smoke_check.mjs --page capability --url http://127.0.0.1:5173/` 轻量模式通过，输出 `browserSkipped=true`，未启动系统 Chrome。
- 2026-05-27 全局预览规则文档更新：`AGENTS.md`、`CURRENT_STATE.md`、`docs/07-governance/codex-performance-workflow.md`、`frontend/capability-browser/README.md` 已同步；待执行 `git diff --check`。
- 2026-05-27 整体能力节点刷新验证：`node --check frontend/capability-browser/app.js`、`node --check scripts/frontend_smoke_check.mjs` 通过；用 `--workspace-state-json` 模拟刷新恢复到 `T-OF`、`安全治理能力 G`、`安全管理能力 M`，三次 capability smoke 均通过，`capabilityMap=true`、`consoleIssues=0`、`bodyOverflowX=0`。
- 2026-05-27 标准 / 框架空态微调验证：`node --check frontend/capability-browser/components/CapabilityLocalRelationMap.js`、目标文件 `git diff --check`、组件定点渲染断言通过；`python3 scripts/dev_server_guard.py --restart` 已恢复 `5173` 项目服务；capability smoke 受本机 Chrome DevTools target 不可用影响未完成。
- 2026-05-27 关注点刷新管理视角验证：`python3 -m py_compile src/sapd_wiki/api_server.py`、`node --check frontend/capability-browser/viewModels.js`、`python3 scripts/dev_server_guard.py --restart`、`T-OF.AT-02` API 定点检查、刷新 ViewModel 模拟和 capability 定点 smoke 通过；API 返回 `managementRows=1`、安全工作 `入侵目标选择及评估分析`、职能层级 `1/1/2/0`。
- 2026-05-27 管理视角 ETL 全量审计验证：重新 `stage-excel --sheets second-batch` 并 approve `f270bf0f-e2ae-4003-8c7f-f0bdec4c5bcb`，审批结果 `items_updated=517`、`relations_created=21`、`relations_deleted=22`、`warnings=[]`；重新导出 `capability-tree`、`capability-workbench`、second-batch summary；`python3 scripts/audit_capability_management_mappings.py` 通过，`issue_count=0`、`placeholder_leak_count=0`。
- 2026-05-27 LC-DT 数据复核验证：`python3 scripts/data_package_summary.py --package lifecycle-workbench`、`--package lifecycle`、LC-DT 源表 / 投影定点 Python 审计、`node --check frontend/capability-browser/viewModels.js`、`node --check frontend/capability-browser/components/ApplicationSecurityLifecycle.js`、`python3 scripts/dev_server_guard.py --fix-duplicates --start`、`node scripts/frontend_smoke_check.mjs --page data-lifecycle --route /data-security --url http://127.0.0.1:5173/ --debug-port 9340`、`git diff --check` 通过。
- 2026-05-27 LC-AP 数据全面复核：对 `LC-AP 应用安全开发生命周期` 源表 8 个阶段、13 个主展示字段与 `lifecycle-workbench` / ViewModel 做字段级比对，阶段数、开发模式填充色继承、开发技术服务/模块、安全技术服务、安全技术模块/措施均已核对；发现并修复 `OI-092`，AP-03 `应用程序静态安全测试（安全函数和组件库）` 不再因规范关系回填而从页面少显示；`node --check`、`git diff --check` 和固定 `5173` lifecycle smoke 通过，`5173` 项目服务已恢复。
- 2026-05-27 标准 / 框架全量复核验证：`python3 scripts/audit_standard_framework_data.py --stamp 20260527` 通过，`errors=0`、`warnings=0`、原始 / JSON 行数均一致（等保 113、CIS 153、CSF core 106、ISO 93、DSP 1468、CRF core 476、CRF maturity 5、NIST 1007），标准映射 `sourcePairs=2288`、`projectionPairs=2288`、缺失 / 额外均为 0；`python3 -m py_compile scripts/audit_standard_framework_data.py`、`python3 scripts/data_package_summary.py --package standards` 通过。

## 历史索引

| 归档文件 | 内容 |
|---|---|
| `docs/05-archive/progress-history/2026-05.md` | 2026-05 完整执行记录、根目录 `progress.md` 瘦身快照和本轮轻量结构治理记录 |
| `docs/05-archive/findings-history/2026-05.md` | 2026-05 历史发现 |
| `docs/05-archive/context-slimming-2026-05-15/` | 2026-05-15 上下文瘦身快照 |

## 维护规则

- 本文件只保留最近 1-3 次重要执行；超过 120 行时继续归档到 `docs/05-archive/`。
- 详细过程、长命令输出和阶段性历史不写入根目录 `progress.md`。
