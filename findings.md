# Findings Index: SAPD 工作知识库系统

本文档只保留当前仍有效的关键决策、重要风险和历史入口。详细过程记录、阶段性发现和旧判断已归档。

## 当前关键决策

| 决策 | 当前结论 | 详细来源 |
|---|---|---|
| 当前主线 | 已导入 Sheet 的业务含义复核 + 前端关系展示校正 | `CURRENT_STATE.md`, `task_plan.md` |
| Frontend Baseline 1.0 范围 | 三页：`安全能力映射`、`LC-AP开发安全生命周期`、`信息化环境维度` | `docs/04-user-guide/frontend-baseline-1.0-plan.md` |
| 信息化环境维度定位 | 第一批核心数据的第三个业务视角，不是新 Sheet 扩展 | `docs/04-user-guide/frontend-baseline-1.0-plan.md` |
| 前后端边界 | 全工程遵守前后端分离；后端负责业务事实、关系、评分和投影；前端只消费 `dataClient` / `/api/v1/*` 契约并做展示交互 | `AGENTS.md`, `docs/01-architecture/backend-interface-design.md`, `docs/01-architecture/api-field-contract.md` |
| MVP 前端技术路线 | 当前继续使用静态页面 + 原生 JS + `dataClient` + ViewModel | `task_plan.md` |
| 数据优先 | 字段定义、映射规则、schema、ETL 先于页面扩展 | `docs/02-data-model/`, `docs/03-import-etl/` |
| 导入方式 | 坚持 `source -> staging -> review -> approval -> formal tables` | `docs/03-import-etl/excel-import-mvp-design.md` |
| 来源追踪 | 知识对象和关系必须保留来源文件、位置、hash 和导入任务 | `docs/06-implementation/local-data-layout.md` |
| 问题管理 | bug、数据问题、页面问题统一维护在 `open-issues.md` | `docs/06-implementation/open-issues.md` |
| maturity 边界 | maturity 是主工程下独立模块；运行数据使用 `maturity_*`，不写入 `knowledge_items` | `docs/08-maturity/` |

## 当前重要风险

| 风险 | 当前处理 |
|---|---|
| 上下文过大导致主控卡死 | 默认读取 `AGENTS.md` + `CURRENT_STATE.md`，长历史放入 `docs/05-archive/` |
| 过早进入新功能 | Phase 7、maturity M1、新 Sheet 扩展均不默认启动 |
| 前端硬编码业务关系 | 发现数据缺口时记录为数据契约或待确认问题，不在页面临时编造 |
| 前后端边界漂移 | 新页面、新字段和新关系先更新后端契约，再进入前端实现；禁止组件直接读取原始数据或临时 JSON |
| 非业务字段泄露 | 主展示区不得出现 `sheet`、`row`、`raw_value`、`metadata` 等非业务字段 |
| 成熟度模块污染主知识库 | maturity 只读引用主知识库，客户输入、证据、评分和报告留在 maturity 运行域 |

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
