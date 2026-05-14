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
| maturity 业务逻辑来源 | 模型设计严格参考 Word 第 3.1 章，评估逻辑严格参考 Word 第 4 章；安全技术服务作为平台与工具输入，不作为独立评分对象 | `docs/08-maturity/maturity-domain-model.md`, `docs/08-maturity/scoring-rules.md` |
| maturity 主线一致性核对 | 成熟度基准与主工程 active 能力树可按编码对齐；需人工确认标题差异、7 个额外关注点和安全技术服务输入覆盖差异 | `docs/08-maturity/mainline-consistency-check.md` |

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
- 第三批 LC-AP / LC-DT 生命周期相关 Sheet 已完成只读业务语义复核草案；LC-AP 第一阶段数据契约已更新，SLSA 暂不补充，下一步可进入 LC-AP ETL/export 设计与验证，但仍不直接进入前端安全开发维度页面深化。
- 成熟度分析模块 M0 已规划为旁路模块：先文档与 YAML 配置，后续再以 CLI + Excel 模板 + 离线报告闭环推进。
- 成熟度模块接入 review 结论：不做全局文件结构重构，不合并计划/发现/进度文件，不新增重复目录；当前只补架构入口、治理边界和 `data/maturity/` 忽略规则。
- 主工程与 maturity 集成检查结论：maturity 可只读复用主知识库对象，但客户输入、证据、匹配、评分和报告必须留在 maturity 运行域；M1 需等输入/输出边界和主线优先级确认后再启动。
- 成熟度 M1 第一版一致性核对已完成：基准表 84 个关注点全部命中主工程 active 关注点；主工程另有 7 个 active 关注点未被基准覆盖；安全技术服务作为平台与工具输入，存在编码不一致、多候选和覆盖差异，需用户确认。
- 第二批管理 / 流程 / 职能 / 岗位 Sheet Review 2.0 已完成用户确认：安全工作独立编码并独立页面维护，正式编码规则为 `SW-关注点编码-序号`，关注点到安全工作为 1:1 / 1:N；L2 安全能力到 L2 流程组为严格约束；安全工作与安全职能无直接关系；同名 L3 跨 L2 需输出核对；GB/T 与 Gartner 作为岗位参考页签，并与安全职能清单支持双向映射 / 双向候选映射供用户复核，其中 GB/T 已有安全职能 -> GB/T 的单向映射基础。

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
