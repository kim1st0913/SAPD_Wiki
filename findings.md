# Findings Index: SAPD 工作知识库系统

本文档只保留当前阶段仍然有效的关键决策、重要风险和历史记录入口。详细过程记录不再继续堆积在这里。

## 当前关键决策

| 决策 | 当前结论 | 详细来源 |
|---|---|---|
| 数据优先 | 字段定义、映射规则、schema、ETL 先于页面扩展 | `docs/02-data-model/`, `docs/03-import-etl/` |
| V1 数据模型 | 使用 `knowledge_items` + `knowledge_relations` + `metadata_json` 的通用模型 | `docs/02-data-model/data-model.md` |
| 导入方式 | 坚持 `source -> staging -> review -> approval -> formal tables` | `docs/03-import-etl/excel-import-mvp-design.md` |
| 来源追踪 | 知识对象和关系必须保留来源文件、位置、hash 和导入任务 | `docs/06-implementation/local-data-layout.md` |
| 问题管理 | 所有 bug、数据问题、页面问题统一维护在 `open-issues.md` | `docs/06-implementation/open-issues.md` |
| Agent 使用 | 保留逻辑角色；实际运行以主控 Agent + 必要 Worker 为主 | `docs/07-governance/governance-index.md` |

## 当前重要风险

| 风险 | 当前处理 |
|---|---|
| 文档堆积 | `findings.md` 已改为索引页，历史内容按月归档 |
| 过度治理 | 当前只新增轻量治理入口和数据治理文档，不一次性建立完整治理体系 |
| 旧对象不会自动停用 | 已记录为 `OI-013`，需要后续确定按 Sheet 全量同步的停用规则 |
| `metadata_json` 技术债 | MVP 阶段保留；稳定字段再按治理规则提升为正式列 |
| 新对象类型导致页面膨胀 | 先定义前端渲染治理原则，暂不实现复杂 schema 引擎 |

## 最近重要发现

- 第二批 5 个 Sheet 已完成本地导入、导出和页面验证。
- `知识来源` 页面已改为“导航 + 清单 + 详情”的工作台结构。
- `OI-010` 已修复并合并回统一问题清单。
- 当前最重要的治理缺口是数据生命周期规则，尤其是源数据修正后的旧对象停用策略。

## 历史记录

| 文件 | 内容 |
|---|---|
| `findings-history/2026-05.md` | 2026-05 期间的完整发现、实现判断和阶段性记录 |
| `progress.md` | 每次执行记录、文件变更和验证结果 |
| `task_plan.md` | 当前阶段、任务状态、风险和下一步 |

## 后续维护规则

- 新的长期有效判断可以先写入本文档的“当前关键决策”或“当前重要风险”。
- 过程性发现、实现细节、验证输出写入 `progress.md`。
- bug、数据问题、页面问题和待确认事项写入 `docs/06-implementation/open-issues.md`。
- 当本文档再次超过 200 行时，应把旧内容按月归档到 `findings-history/`。
