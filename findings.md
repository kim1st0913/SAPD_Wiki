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
| 问题管理 | bug、数据问题、页面问题统一维护在 `open-issues.md` | `docs/06-implementation/open-issues.md` |
| maturity 边界 | maturity 是主工程下独立模块；运行数据使用 `maturity_*`，不写入 `knowledge_items` | `docs/08-maturity/` |
| SAPD 成熟度评估入口 | 已补入前端菜单和数据契约规划，路由建议为 `/sapd-maturity-assessment`，页面类型暂用 `domain-module`，代码实现另开会话 | `docs/00-overview/frontend-menu-and-page-type-definition-v1.md`, `docs/04-user-guide/frontend-data-contract-baseline-1.0.md` |
| 后续项目推进方式 | 后续计划拆成“前端页面设计线”和“后端数据 / 逻辑线”；每页按后端投影契约 -> 前端页面实现 -> 验收回归推进 | `task_plan.md` |
| 页面优先级 | 先收敛安全能力映射页作为关系画布基准，再推进信息化环境维度页，最后推进 LC-AP 页 | `task_plan.md` |
| 信息化环境图谱策略 | 信息化环境页按层级回答不同问题：`E0` 信息化环境只展示环境子类和对象结构，`E1` 环境子类展示对象、作用域、服务和能力 / 关注点概览，`E2` 信息化对象完整展示作用域、服务、模块 / 措施、系统、产品和能力 / 关注点；标准 / 流程不从能力页反向拼接 | `frontend/design-handoff/implementation-specs/environment-security-capability-graph-strategy-2026-05-20.md` |
| 安全知识目录信息架构 | `安全知识` 复用 `maintenanceWorkspace`，不是独立新页面；外层二级入口收口为安全能力作用域清单、安全技术模块/措施清单、安全管理工作/流程清单、安全职能清单、Hype Cycle、其他知识目录；模块/措施、管理工作/流程、职能/岗位参考在页面内部用 Tab 切换，兼容旧直达路由但不作为主导航入口 | `frontend/design-handoff/implementation-specs/security-knowledge-frontend-data-handoff-2026-05-21.md`, `frontend/capability-browser/components/AppShell.js` |
| 安全技术模块目录展示边界 | 领域分类来自原始 `安全技术模块清单` B 列，安全系统来自 C 列；模块目录按“领域分类 -> 安全系统 -> 安全技术模块”两级分组并保持原表行顺序；模块-措施、模块-作用域、模块-信息化对象若未进入维护包契约，显示为契约缺口，不在前端组件临时反推 | `frontend/design-handoff/implementation-specs/security-knowledge-frontend-data-handoff-2026-05-21.md`, `src/sapd_wiki/parsers.py`, `src/sapd_wiki/staging.py`, `frontend/capability-browser/viewModels.js` |
| BE-0 契约盘点 | 当前仅安全能力映射页有页面级投影；环境页和 LC-AP 页仍主要依赖 `data-packages` + ViewModel 整理 | `docs/01-architecture/api-offline-package-contract-inventory.md` |
| 全站菜单与页面类型 | 最新全站菜单、页面类型枚举、路由建议、导航 Manifest、Stitch 交接说明和全局导航 / 应用壳 Stitch Prompt 已固化；Manifest 与 Stitch 输出不接入运行代码，需先转 implementation spec | `docs/00-overview/frontend-menu-and-page-type-definition-v1.md`, `frontend/design-handoff/README.md`, `frontend/design-handoff/navigation/nav-manifest.v1.json`, `frontend/design-handoff/stitch-prompts/00-application-shell.md` |
| 前端数据契约治理 | 当前有必要进行数据治理；Frontend Baseline 1.0 建议修正为“P1 双核心工作台 + LC-AP 受控专项关系投影”；先治理 export / 页面数据包，再统一前端组件 | `docs/04-user-guide/frontend-data-contract-baseline-1.0.md` |
| 前端 JSON 数据包台账 | 新增 `frontend-json-data-package-inventory.md` 作为所有 `public/data/*.json` 的用途、页面归属、legacy 状态、发布处理和退役条件入口；后续新增 / 删除 / 拆分 JSON 必须同步更新 | `docs/01-architecture/frontend-json-data-package-inventory.md` |
| 三份 workbench 规格 | `capability-workbench.json`、`environment-workbench.json`、`lifecycle-workbench.json` 三份规格已齐；最终目标数据文件清单冻结为 P0 四件套 + P1 三件套；`management-knowledge.json` 已从顾问端运行路径退役，`lifecycle-knowledge.json` 仅保留生命周期专项数据 | `docs/04-user-guide/capability-workbench-json-spec-v1.md`, `docs/04-user-guide/environment-workbench-json-spec-v1.md`, `docs/04-user-guide/lifecycle-workbench-json-spec-v1.md` |
| 三份 workbench 数据出口 | `capability-workbench.json`、`environment-workbench.json`、`lifecycle-workbench.json` 已能由 CLI 生成；`dataClient` / ViewModel 已提供稳定读取入口；旧 JSON 保留为过渡兼容，不作为新 UI 主输入 | `src/sapd_wiki/exports.py`, `src/sapd_wiki/cli.py`, `frontend/capability-browser/dataClient.js`, `frontend/capability-browser/viewModels.js` |
| `management-knowledge.json` 退役边界 | 已完成退役：`assets`、顶层 `service_module_index`、安全知识重复数据和环境旧树均不再作为顾问端发布包、API 数据包或前端 fallback；安全知识由 `maintenance-knowledge.json` 承接，环境关系由 `environment-workbench.json` 承接，共享索引由 `shared-lookups.json` 承接 | `frontend/capability-browser/public/data/shared-lookups.json`, `frontend/capability-browser/public/data/maintenance-knowledge.json`, `frontend/capability-browser/public/data/environment-workbench.json`, `src/sapd_wiki/exports.py`, `src/sapd_wiki/api_server.py` |
| BE-4 数据质量首轮审计 | 三份 workbench 顶层结构、关系端点、孤立对象和主展示字段边界均通过静态检查；`CI/CD流水线` 拆词异常已在 BE-4.2 修复；当前主要剩余缺口为能力页标准映射为空、LC-AP 措施未进入 lifecycle workbench | `docs/06-implementation/be-4-workbench-data-quality-gap-list.md`, `docs/06-implementation/open-issues.md` |

## 当前重要风险

| 风险 | 当前处理 |
|---|---|
| 上下文过大导致主控卡死 | 默认读取 `AGENTS.md` + `CURRENT_STATE.md`，长历史放入 `docs/05-archive/` |
| 过早进入新功能 | Phase 7、maturity M1、新 Sheet 扩展均不默认启动 |
| 前端硬编码业务关系 | 发现数据缺口时记录为数据契约或待确认问题，不在页面临时编造 |
| 前后端边界漂移 | 新页面、新字段和新关系先更新后端契约，再进入前端实现；禁止组件直接读取原始数据或临时 JSON |
| 非业务字段泄露 | 主展示区不得出现 `sheet`、`row`、`raw_value`、`metadata` 等非业务字段 |
| 成熟度模块污染主知识库 | maturity 只读引用主知识库，客户输入、证据、评分和报告留在 maturity 运行域 |
| 前端画布反复试错导致结构漂移 | 安全能力映射页先作为基准页收敛验收标准；未确认前不复制到环境页和 LC-AP 页 |
| 已规划接口与已实现接口不一致 | `api-field-contract.md` 中部分 `/api/v1/environments/*`、`/api/v1/lifecycle/*`、`/api/v1/maintenance/technical-measures` 等接口尚未在 `api_server.py` 中实现；后续实现前需明确“规划接口”和“实际接口” |
| 前端 JSON 职责混杂 | `management-knowledge.json` 的职责混杂已完成退役；后续重点是继续缩小 `capability-tree.json` 与 `lifecycle-knowledge.json` 的非页面级职责 |
| workbench 投影仍有业务缺口 | BE-4 已确认 `capability-workbench.json` 缺标准 / 框架映射，`lifecycle-workbench.json` 缺措施投影；`CI/CD流水线` 拆词异常已修复并关闭 `OI-050` |

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
