# progress.md

本文件是当前会话恢复入口，只保留最近状态和历史索引。完整执行历史已归档到 `docs/05-archive/progress-history/2026-05.md`。

## 当前状态（2026-05-23）

- 当前分支：`codex-frontend-backend-separation-closure`。
- 当前主线：Phase 5 知识浏览与搜索 / 关系化前端工作台校正；重点仍是已导入 Sheet 的业务语义复核、前端关系展示校正、数据契约治理和员工端字段边界收口。
- Frontend Baseline 1.0 当前仍以三页为核心：`安全能力映射`、`LC-AP开发安全生命周期`、`信息化环境维度`；不默认启动 Phase 7 多格式增强、maturity M1、新 Sheet 扩展、schema 重构或 React / Vue 重构。
- 标准 / 框架静态数据保持拆分：`standards-index.json` 为小索引，`frontend/capability-browser/public/data/standards/**` 承载明细分包；旧 `/api/v1/data-packages/standards` 由后端运行时组装完整明细。
- 安全指南幻灯片页面已完成目录交互、底部翻页浮层、独立数据包和双 PDF 重新导入验证；数据安全设计方法为 43 页，安全技术架构设计方法为 75 页。
- 安全知识已有数据表格已同步表头、居中、列宽和 smoke 验收规则；`/knowledge/management-workflows` 缺少 `capability` 依赖导致表格不渲染的问题已修复。
- 员工端非业务字段展示已收口：`SourceEvidencePanel.js` 已从员工端移除，内容详情页不再展示来源文件或路径字段；来源追踪数据仍保留给后续维护端。
- 本地 API 安全边界已收口：不再发送通配 `Access-Control-Allow-Origin: *`；`dataClient` 不再支持 URL 参数 `?api=` 切换 API Base。
- 数据安全安全技术模块原表替换已完成并重新 ETL / 导出：`maintenance-knowledge.json` 为 `ready`，安全技术模块 102 条，安全技术措施 29 条；`网络数据防泄露` 和 `数据交易沙箱` 已不再作为 active 模块出现在维护包。
- 当前待确认问题：`OI-073`。源 Sheet `作用域-安全技术服务-安全技术模块映射` 仍有 5 行 G 列旧值 `网络数据防泄露`，是否统一改为 `数据流转监测和泄漏防护` 待用户确认。
- 工作区仍有大量历史未提交改动，继续开发前建议先做 checkpoint commit；如暂不提交，后续任务应继续用轻量摘要确认范围，避免全量 diff 和大文件输出。

## 最近完成事项

### 2026-05-23 GitHub 数据不同步与本地一键初始化

- 已新增 `scripts/bootstrap_local_data.py`，用于从本地 `data/raw-samples/wiki sample.xlsx` 一键重建开发数据库、审批导入已实现 parser 的 Sheet，并导出前端离线数据包。
- 已新增 `scripts/check_github_data_boundary.py`，用于提交前检查 Git 是否误追踪原始数据、SQLite 数据库、导出包、前端生成 JSON 或生成资源目录。
- 已新增 `docs/03-import-etl/github-local-data-initialization.md`，明确 GitHub 拉取后需要放哪些文件、放到哪个目录、执行哪个初始化命令，以及哪些本地数据永不同步。
- 已同步修订 `README.md`、`docs/06-implementation/local-data-layout.md`、`docs/07-governance/data-governance.md` 和 `docs/07-governance/governance-index.md`，把“GitHub 工程不包含原始数据和生成数据”固化为工程规则。

### 2026-05-23 顾问端压缩包交付模型确认

- 已新增 `docs/01-architecture/consultant-delivery-model.md`，明确 V1 顾问端交付为压缩包应用：首次打开后一键初始化，自动部署预置 SQLite 数据库、页面数据包和预览资源，然后直接使用。
- 已确认 V1 顾问端不做登录、注册、账号或权限体系；不要求用户安装 Python / Node / SQLite CLI；不提供顾问自行导入 Excel / PDF / PPT / DOCX、执行 ETL、执行 migration 或选择数据库的入口。
- 已同步修订 `README.md`、`docs/01-architecture/technology-decisions.md`、`docs/01-architecture/backend-interface-design.md`、`docs/06-implementation/local-data-layout.md`、`docs/00-overview/project-roadmap.md`、`task_plan.md` 和 `findings.md`。
- 继续核对 `management-knowledge.json` 拆分状态：安全知识 7 个业务块已由 `maintenance-knowledge.json` 100% 覆盖；`environment_scope_tree` 已由 `environment-workbench.json` 覆盖；剩余需要迁移的是共享 `service_module_index` 和极小的 `assets` 旧资源记录。
- 用户确认 `assets` 对应的旧图片页面暂不考虑，可删除；已新增 `shared-lookups.json` 承接 `service_module_index=192`，并让 `capability-workbench.json`、`lifecycle-workbench.json` 和 `/api/v1/capabilities/workspace-projection` 使用共享索引，后续可继续清理 `management-knowledge.json`。
- 已新增 `docs/01-architecture/frontend-json-data-package-inventory.md`，作为所有前端 JSON 数据包用途、页面归属、legacy 状态、发布处理和退役条件的台账；后续新增 / 删除 / 拆分 `public/data/*.json` 必须同步更新。
- 已完成 `service_module_index` 拆分落地：新增 `frontend/capability-browser/public/data/shared-lookups.json`，补充 `export-shared-lookups` CLI、API 数据包注册、前端 `dataClient` 懒加载入口，并让能力 / 生命周期工作台改读共享索引。
- 已重新导出前端工作台数据包，当前 `shared-lookups.json` 为 `ready`，`service_module_index=192`；`capability-workbench.json`、`lifecycle-workbench.json` 的 `sourcePackages` 已包含 `shared-lookups.json`。
- 已继续清理 legacy 重复数据：`management-knowledge.json` 不再导出 `assets` 和顶层 `service_module_index`；`lifecycle-knowledge.json` 不再导出顶层 `service_module_index`；必要的 legacy fallback 由 `dataClient` 从 `shared-lookups.json` 合并共享索引。
- 已一次性完成 `management-knowledge.json` 退役：前端 `DATA_PATHS` / `PACKAGE_GETTERS`、本地 API `DATA_PACKAGES`、公开 CLI `export-management-knowledge`、`data_package_summary` 均不再暴露 management 包；公开 `public/data/management-knowledge.json` 已删除，环境 workbench 导出改为从数据库临时投影生成，不依赖公开 legacy 文件。

### 2026-05-23 数据安全安全技术模块原表替换

- 已备份原始工作簿到 `data/raw-samples/backups/wiki sample.before-data-security-module-replace-20260523.xlsx`。
- 已用 `/Users/kim1st/Desktop/数据安全 - 安全技术模块清单.xlsx` 替换 `data/raw-samples/wiki sample.xlsx` / `安全技术模块清单` 中第 200 行开始的 `数据安全` 区块；原区块 32 行，新区块 41 行，后续 `工业安全` 区块整体下移但内容未改。
- 已更新同 Sheet 统计行：`C393` 安全系统数量为 29，`D393` 安全技术模块数量为 102；parser 复核未把数字统计解析为业务对象。
- 已按相关范围重新 ETL 和导出，最新 job `46485818-7c4c-493a-ab3b-d21e418977d4` 更新 471 个对象、停用 1 个旧对象、approve warning 为 0。
- 已补导出 `management-knowledge.json` 后重导 capability/environment/lifecycle workbench，确认 `capability-workbench.json` 中 `网络数据防泄露=0`、`数据交易沙箱=0`，新增模块已进入安全能力映射数据。
- 已用临时端口 `6299` 运行能力页 smoke：`node scripts/frontend_smoke_check.mjs --page capability --route /capability-mapping --url http://127.0.0.1:6299/ --debug-port 9440`，结果通过，`consoleIssues=0`、`bodyOverflowX=0`、`workspaceOverflowX=0`、`capabilityMap=true`；临时服务已关闭。
- 新增 `OI-073` 跟踪源映射表 5 行旧模块名称残留；当前数据库和前端数据包已正确停用旧模块。

### 2026-05-23 安全知识表格体验和职能分组

- 已将 `安全工作职能清单` 改为按 `安全职能层 -> 职能组 -> 安全职能明细` 两级归纳展开，并保留选中明细自动展开所在分组；明细表不再重复显示 `安全职能层` 和 `职能组` 两列。
- 已统一优化安全知识表格密度、短字段列宽、统计列宽和参考目录表格类名；`安全职能名称` 列已收窄，`定义` / `描述` / 映射信息列获得更多横向空间。
- 已修正安全工作职能清单导出顺序：职能组按 `安全工作职能清单` 原表来源行号排序，职能明细按编码顺序兜底；`GB/T 42446-2023` 与 `Gartner 工作岗位参考` 已提升为 `安全职能清单` 的同级页签。
- 已更新 `index.html` 和 `dataClient.js` 资源版本，避免浏览器继续加载旧的合并页签与旧维护数据包缓存。
- 已修复同级参考页签点击事件：顶部 `GB/T 42446-2023` / `Gartner 工作岗位参考` 页签不再被旧内部 reference tab 逻辑截获。
- 已新增并修复 `OI-074`，记录本轮安全知识表格结构和列宽问题。
- 本轮只改前端展示组件和样式，未修改 ETL、数据包、schema 或原始 Excel。

### 2026-05-23 员工端字段与 API 安全边界收口

- 已修复 `OI-071`：员工端页面不再加载 `SourceEvidencePanel.js`，并移除环境详情、LC-AP 详情、专项知识详情、通用详情检查器和内容详情页中的来源证据 / 路径字段展示。
- 已修复 `OI-072`：本地 API 不再向所有来源发送 `Access-Control-Allow-Origin: *`；前端 `dataClient` 不再读取 URL 参数 `?api=` 覆盖 API 地址。
- 本轮未删除数据层来源追踪字段，后续维护端仍可使用。

### 2026-05-21 至 2026-05-22 前端体验和数据包治理

- 已修复 `OI-068`：刷新后保持当前 hash 路由，不再回到默认入口。
- 已修复 `OI-069`：首屏不再全量等待多个大型数据包，改为按当前路由懒加载；54MB `management-knowledge.json` 不再作为全局刷新默认加载。
- 已修复 `OI-070`：安全知识已有数据表格统一表头字号、字重、居中、单元格垂直对齐和短值列宽。
- 已完成标准 / 框架 7 页表格体验收口、tooltip 去重和 smoke 规则补强。
- 已完成数据安全设计方法和安全技术架构设计方法幻灯片页面标准化、独立数据包接入和目录交互回归。

## 最近验证

- `python3 scripts/data_package_summary.py --package maintenance`：通过；`maintenance-knowledge.json` 为 `ready`，安全技术模块 102 条，安全技术措施 29 条。
- `python3 -m py_compile src/sapd_wiki/api_server.py`：通过。
- `node --check frontend/capability-browser/dataClient.js`：通过。
- `node --check frontend/capability-browser/components/WorkFunctionMaintenanceTable.js`、`node --check frontend/capability-browser/components/StandardRoleReferenceTable.js`、`git diff --check -- frontend/capability-browser/components/WorkFunctionMaintenanceTable.js frontend/capability-browser/components/StandardRoleReferenceTable.js frontend/capability-browser/styles.css`：通过。
- 安全知识表格 smoke 复测通过：`/knowledge/functions`、`/knowledge/scopes`、`/knowledge/technical`、`/knowledge/management-workflows`、`/knowledge/role-references`，均 `consoleIssues=0`、`bodyOverflowX=0`、表头字号 / 字重 / 居中检查通过；`/knowledge/functions` 复核页签为同级展示，执行层职能组顺序与原表行号一致。
- 点击回归通过：从 `/knowledge/functions` 点击 `Gartner 工作岗位参考` 后 active 页签和表格标题均切换为 `Gartner 工作岗位参考`，表格行数 28，横向溢出 0。
- `node --check frontend/capability-browser/app.js`、`node --check scripts/frontend_smoke_check.mjs`、关键表格 / 详情组件 `node --check`：通过。
- 指南页 smoke：`/guides/security-architecture-design` 和 `/guides/data-security-design` 均通过；缩略图数量分别为 75 和 43，图片加载比例约 `1.7778`，目录点击和键盘切换不回弹。
- 安全知识 7 个已有数据表格入口 smoke 均通过：`/knowledge/scopes`、`/knowledge/technical`、`/knowledge/technical-measures`、`/knowledge/management-workflows`、`/knowledge/processes`、`/knowledge/functions`、`/knowledge/role-references`。
- 代表性标准页回归通过：`/standards/mlps-level-3`、`/standards/nist-800-53-rev5`；表头字号 / 字重 / 对齐和 tooltip 数量检查通过。
- 字段边界扫描通过：员工端渲染入口未再发现 `SourceEvidencePanel`、`来源证据`、`source_file`、`raw_value` 等展示调用。
- `python3 scripts/data_package_summary.py --package shared-lookups`：通过；`shared-lookups.json` 为 `ready`，`service_module_index=192`。数据层仍保留来源追踪字段样本命中，前端主展示区未新增这些字段展示。
- `python3 -m py_compile src/sapd_wiki/exports.py src/sapd_wiki/cli.py src/sapd_wiki/api_server.py scripts/data_package_summary.py scripts/dev_server_guard.py`：通过。
- `node --check frontend/capability-browser/dataClient.js`、`node --check frontend/capability-browser/app.js`、`node --check scripts/frontend_smoke_check.mjs`：通过。
- `python3 -m py_compile scripts/bootstrap_local_data.py scripts/check_github_data_boundary.py`：通过。
- `python3 scripts/bootstrap_local_data.py --print-inputs`：通过，输出必需 / 可选本地文件放置清单。
- `python3 scripts/check_github_data_boundary.py`：通过，当前 Git 未追踪原始数据、数据库、导出包或前端生成数据。
- `git diff --check`：通过。
- 安全能力映射页 smoke：`node scripts/frontend_smoke_check.mjs --page capability --url http://127.0.0.1:6190/ --debug-port 9432` 通过，`consoleIssues=0`、`bodyOverflowX=0`、`workspaceOverflowX=0`、`capabilityMap=true`；临时 6190 服务已关闭。
- legacy 去重后数据包复核通过：`management-knowledge.json` 顶层已无 `assets` / `service_module_index`，约 52.5MB；`lifecycle-knowledge.json` 顶层已无 `service_module_index`，约 6.7MB；`shared-lookups.json` 继续为 `ready`，`service_module_index=192`。
- legacy 去重后页面 smoke 通过：`capability`、`lifecycle`、`/knowledge/technical` 均 `consoleIssues=0`；临时 6191 服务已关闭。`lifecycle` 工作区仍有 32px 横向溢出指标，脚本判定通过，后续若做视觉收口可单独处理。
- management 退役复核通过：`test ! -e frontend/capability-browser/public/data/management-knowledge.json` 通过；`/api/v1/data-packages` 不再列出 `management`；`/api/v1/data-packages/management` 返回 404；`/api/v1/maintenance` 返回 8 个 section。
- management 退役后页面 smoke 通过：`capability`、`environment`、`/knowledge/technical` 均 `consoleIssues=0`；临时 6192 服务已关闭。`environment` 工作区仍有 32px 横向溢出指标，脚本判定通过，后续若做视觉收口可单独处理。

## 历史索引

| 归档文件 | 内容 |
|---|---|
| `docs/05-archive/progress-history/2026-05.md` | 2026-05 完整执行记录与根目录 `progress.md` 瘦身快照 |
| `docs/05-archive/findings-history/2026-05.md` | 2026-05 历史发现 |
| `docs/05-archive/context-slimming-2026-05-15/` | 2026-05-15 上下文瘦身快照 |

## 维护规则

- 本文件只保留最近 1-3 次重要执行和当前恢复信息。
- 超过 120 行时继续归档到 `docs/05-archive/`。
- 详细过程、长命令输出和阶段性历史不写入根目录 `progress.md`。
