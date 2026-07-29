# 评估表 V2 样本分析

> 归档状态：阶段性分析记录。当前有效要求以 `docs/08-maturity/requirements.md` 的 V2.1 合同为准。

本文档分析新增 `data/raw-samples/maturity/评估表v2.md`。该文件实际标题和元数据版本为 `网络安全能力成熟度评估表 V1.2`，本项目中暂按“评估表 V2 样本”处理。

本轮只做样本驱动建模，不修改主工程 schema，不修改主工程业务代码，不把成熟度模型或客户评估数据写入 `knowledge_items`。

## 1. 文件定位

| 项目 | 结论 |
|---|---|
| 文件路径 | `data/raw-samples/maturity/评估表v2.md` |
| 文件类型 | Markdown 模型基准 |
| 样本版本 | `V1.2` |
| 业务定位 | L2 安全能力成熟度评价基准 |
| 是否客户评分输入 | 否 |
| 是否进入 `knowledge_items` | 否 |
| 建议目标表 | maturity 专用模型基准表 |

该文件不是正式客户评分表，而是把每个 L2 安全能力合并成一个评价对象，并为每个 L2 能力提供 `L1` 到 `L5` 的成熟度描述。

## 2. 文件结构

| 结构 | 含义 | 建模用途 |
|---|---|---|
| YAML front matter | 文件类型、版本、变更记录、输入来源 | 进入 `assessment_source_file` 和 `maturity_model_version` 的来源元数据 |
| `L2 安全能力成熟度定义` | 通用 `L1` 到 `L5` 等级定义 | 进入 `maturity_level_definition` |
| `L2 安全能力评估明细` | 按能力分类、能力域、L2 能力展开 | 进入 `maturity_capability_baseline` |
| `##### <capability_code> <title>` | 一个 L2 安全能力评价对象 | `baseline_object_type = capability` |
| `能力描述` | L2 能力合并后的能力说明 | `capability_description` |
| `级别 / 描述` 表 | 该 L2 能力专属 `L1` 到 `L5` 判定标准 | `level_criteria_json` |
| `使用说明` | 成熟度判定和 L5 现实性说明 | 进入模板说明或评分规则说明 |

## 3. 结构化解析结果

本轮生成了以下结构化导出，供后续人工确认和代码实现使用：

| 文件 | 用途 |
|---|---|
| `data/exports/maturity/maturity-v2-l2-capability-baseline.csv` | V2 L2 能力基准明细 |
| `data/exports/maturity/maturity-v2-l2-capability-baseline.json` | V2 L2 能力基准机器可读结果 |
| `data/exports/maturity/maturity-v2-mainline-capability-diff.csv` | V2 与主工程 L2 能力差异清单 |
| `data/exports/maturity/maturity-v2-mainline-capability-diff.json` | V2 与主工程 L2 能力差异机器可读结果 |
| `data/exports/maturity/maturity-v2-mainline-summary.json` | V2 一致性摘要 |

说明：2026-05-15 已按当前 SQLite 主库 `data/database/sapd_wiki.sqlite3` 重新核对。旧的 `data/exports/items-latest/knowledge-items.json` 仍可能保留上一次导出的旧标题，不作为本轮 V2 核对依据。

解析结果：

| 项目 | 数量 | 说明 |
|---|---:|---|
| V2 L2 能力条目 | 31 | 每条包含能力描述和 `L1` 到 `L5` 描述 |
| 主工程 active L2 能力 | 32 | 来自当前 `knowledge_items` 导出 |
| 按编码完全匹配 | 31 | 编码和标题均一致 |
| 标题差异 | 0 | 当前 SQLite 主库中 `T-AD.SV` 已调整为“安全架构评估能力”，与 V2 一致 |
| V2 缺失主工程 L2 能力 | 1 | `M-PS.CT` 未出现在 V2 |
| V2 中主工程不存在的 L2 能力 | 0 | 未发现 |

## 4. 与主工程 L2 能力差异

### 4.1 标题差异

当前 SQLite 主库已将 `T-AD.SV` 调整为“安全架构评估能力”，与 V2 标题一致。本项不再作为待确认差异。

### 4.2 V2 未覆盖的主工程 L2 能力

| 编码 | 主工程标题 | 初步判断 |
|---|---|---|
| `M-PS.CT` | 安全意识教育与技能培养能力 | V2 未提供该 L2 能力的独立 `L1` 到 `L5` 成熟度描述，需确认是否补入 V2 基准或暂不纳入本版成熟度评分 |

## 5. 对上一轮关注点缺口的影响

上一轮基于 `sample 评分表.xlsx` 发现 7 个主工程 active 关注点没有在成熟度基准中逐项出现。V2 采用 L2 能力合并描述后，这些关注点的父级 L2 能力均已出现在 V2 中。

| 关注点编码 | 主工程关注点 | 父级 L2 能力 | V2 覆盖状态 |
|---|---|---|---|
| `M-PS.HS-02` | 建立组织的网络安全专家团队 | `M-PS.HS` 人员安全管理能力 | 父级 L2 已覆盖 |
| `M-PS.HS-03` | 建设组织的红蓝军团队/紫军 | `M-PS.HS` 人员安全管理能力 | 父级 L2 已覆盖 |
| `T-AD.SV-03` | 开展攻防演练和沙盘推演 | `T-AD.SV` 安全架构评估能力 | 父级 L2 已覆盖 |
| `T-AS.AM-02` | 实现主机、终端等信息化资产的安全管理 | `T-AS.AM` 信息化资产安全管理能力 | 父级 L2 已覆盖 |
| `T-AS.DG-03` | 确保数据的可靠性与可恢复性 | `T-AS.DG` 数据安全管理和治理能力 | 父级 L2 已覆盖 |
| `T-AS.DS-06` | 持续管理可复用的开发安全资源 | `T-AS.DS` 开发安全管控能力 | 父级 L2 已覆盖 |
| `T-PD.TP-05` | 对仅允许预定义的程序或行为进行控制 | `T-PD.TP` 威胁检测与防护能力 | 父级 L2 已覆盖 |

建模结论：

- 如果正式评分粒度采用 `capability`，V2 可以作为主要 L2 评分基准；
- 如果正式评分粒度采用 `capability_focus`，V2 只能作为父级能力判定标准，仍需要保留或补充关注点级基准；
- 上一轮的 7 个缺口不再视为 L2 模型缺失，但仍是“关注点级细化标准未覆盖”的待确认项。

## 6. 字段字典

| V2 字段 / 结构 | 标准字段 | 必填 | 用途 |
|---|---|---|---|
| `version` | `model_version` | 是 | 模型版本 |
| `changelog` | `version_note` | 否 | 版本变更说明 |
| `input` | `source_dependency_json` | 否 | 上游文件来源 |
| 三级标题，如 `一、安全技术能力（T）` | `capability_category_ref` | 是 | 能力分类上下文 |
| 四级标题，如 `1.1 基础架构安全` | `capability_domain_ref` | 是 | L1 能力域上下文 |
| 五级标题编码 | `capability_code` | 是 | L2 安全能力编码 |
| 五级标题名称 | `capability_title` | 是 | L2 安全能力名称 |
| `能力描述` | `capability_description` | 是 | L2 能力说明 |
| `L1` 到 `L5` 描述 | `level_criteria_json` | 是 | L2 能力专属成熟度判定标准 |
| `使用说明` | `template_help_text` | 否 | 后续模板说明和报告说明 |

## 7. 建模建议

1. 在 `maturity_capability_baseline` 中增加或使用 `criteria_granularity` 字段，区分 `capability` 与 `capability_focus`。
2. V2 的 `criteria_granularity` 应为 `capability`，上一轮 XLSX 的关注点基准应为 `capability_focus`。
3. 在 `maturity_model_version` 中记录多个基准来源：Word 第 3.1 章、Word 第 4 章、XLSX 关注点评价基准、Markdown V2 L2 评价基准。
4. 模板中新增 `Reference_L2_Capability_Criteria`，由 V2 生成；保留 `Reference_Level_Criteria` 作为通用等级说明。
5. 正式评分优先支持 `capability` 评分，再按需要扩展 `capability_focus` 评分；扩展前必须确认关注点级标准是否完整。
6. `M-PS.CT` 需要业务确认：补入 V2 基准、从本版成熟度评分范围排除，或只作为主工程知识对象引用。

## 8. 暂不做事项

- 不实现评分算法；
- 不实现图表；
- 不新增前端页面；
- 不修改主工程核心 schema；
- 不修改 `knowledge_items`；
- 不自动改主工程能力标题或能力范围。
