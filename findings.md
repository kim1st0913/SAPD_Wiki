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
| 外部 ChatGPT 协作 | 外部 UI prototype、临时 Step 编号或 review 建议只作为输入，不自动进入正式项目 Phase | `task_plan.md`, `docs/00-overview/current-plan-for-chatgpt-review.md` |
| 当前下一主线 | 已导入 Sheet 的业务含义复核 + 前端关系展示校正 | `task_plan.md` |
| 前后端边界 | 后端负责业务关系生成和前端投影；前端消费投影并作为数据关系排查工作台 | `docs/01-architecture/backend-interface-design.md`, `docs/01-architecture/api-field-contract.md` |
| 成熟度分析模块边界 | maturity 是主工程下的独立模块；评估运行数据使用 `maturity_*` 专用表，不写入 `knowledge_items` | `docs/08-maturity/`, `task_plan.md` |
| 成熟度模块接入方式 | 沿用 `docs/08-maturity/`，不新增重复 `docs/08-maturity-assessment/`，只做轻量接入 review 和治理补充 | `docs/08-maturity/module-integration-review.md` |

## 当前重要风险

| 风险 | 当前处理 |
|---|---|
| 文档堆积 | `findings.md` 已改为索引页，历史内容按月归档 |
| 过度治理 | 当前只新增轻量治理入口和数据治理文档，不一次性建立完整治理体系 |
| 旧对象生命周期 | `OI-013` 已实现同来源 Sheet 复导后的旧对象自动停用和重新出现对象恢复 |
| `metadata_json` 技术债 | MVP 阶段保留；稳定字段再按治理规则提升为正式列 |
| 新对象类型导致页面膨胀 | 先定义前端渲染治理原则，暂不实现复杂 schema 引擎 |
| 过早进入多格式增强 | Phase 7 PPT / Draw.io / DOCX 多格式增强后置，先完成 Excel 已导入数据的业务语义确认 |
| 成熟度模块污染主知识库 | 已固化为独立 `maturity_*` 运行数据模型，只读引用能力知识对象 |

## 最近重要发现

- 第二批 5 个 Sheet 已完成本地导入、导出和页面验证。
- `知识来源` 页面已改为“导航 + 清单 + 详情”的工作台结构。
- `OI-010` 已修复并合并回统一问题清单。
- `OI-013` 已补齐 MVP 数据生命周期机制：源数据修正后，复导会停用消失的旧 ETL 对象，并在对象重新出现时恢复为 `active`。
- 外部 ChatGPT review 已完成；其 Step 编号、UI prototype 和 prototype code 不进入正式 Phase。
- 当前最重要的工作不是 UI 扩展，而是已导入 Sheet 的业务含义、主键、关系基数和页面归属复核。
- 第一批核心 Sheet Review 1.0 已收到用户回复：能力层级/编码/排序、`/` 无适用服务、多环境复用信息化对象、安全系统与产品口径、模块/措施显式区分均已确认；`environment_segment` 已确认作为正式层级，中文口径为“环境子类”。
- 第三批生命周期 Sheet 已完成建模、ETL staging 和审批入库；在业务语义确认前，不进入完整安全开发维度页面深化。
- 成熟度分析模块 M0 已规划为旁路模块：先文档与 YAML 配置，后续再以 CLI + Excel 模板 + 离线报告闭环推进。
- 成熟度模块接入 review 结论：不做全局文件结构重构，不合并计划/发现/进度文件，不新增重复目录；当前只补架构入口、治理边界和 `data/maturity/` 忽略规则。

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
