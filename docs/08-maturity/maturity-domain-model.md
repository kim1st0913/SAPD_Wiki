# 成熟度模块领域模型

本文档基于第一轮样本分析，定义 maturity 模块的领域对象和对象关系。本文档只描述业务领域模型，不修改主工程核心 schema。

## 1. 领域边界

maturity 模块属于 SAPD Wiki 主工程下的独立业务模块。它读取主工程的安全能力知识库，生成客户成熟度评估输入、匹配、评分、差距和报告，但客户评估数据不进入 `knowledge_items`。

业务逻辑来源：

- 成熟度模型设计严格参考 `sample文档介绍.docx` 第 3.1 章“网络安全能力成熟度模型”，包括模型架构、能力等级定义、能力要素解析、能力域及能力子域；
- 成熟度评估逻辑严格参考 `sample文档介绍.docx` 第 4 章“网络安全能力成熟度评估”，包括评估逻辑、计分方式、评估流程和评估方式；
- 后续代码实现只实现上述两部分业务逻辑，不另起一套成熟度模型。

边界原则：

- `knowledge_items` 保存长期知识资产；
- `knowledge_relations` 保存长期知识关系；
- maturity 保存评估运行数据、客户输入、评分结果和报告快照；
- maturity 可以引用主工程能力对象，但不把客户评估结果回写为知识对象。

## 2. 核心对象

| 对象 | 中文名称 | 业务含义 |
|---|---|---|
| `assessment_project` | 评估项目 | 一次客户成熟度评估的项目级容器 |
| `assessment_source_file` | 评估来源文件 | 本次评估使用的 XLSX、DOCX、PPTX 等输入材料 |
| `assessment_input_raw` | 原始输入行 | 从样例或正式模板中读取的原始行数据 |
| `assessment_input_normalized` | 标准化输入项 | 清洗、向下填充和拆分后的评估输入项 |
| `maturity_model_version` | 成熟度模型版本 | Word 方法论、XLSX 评价基准表和配置版本形成的模型基准版本 |
| `maturity_level_definition` | 成熟度等级定义 | L1-L5 通用等级定义，以及四个固定评分要素的等级说明 |
| `maturity_capability_baseline` | 能力基准项 | 从评价基准表抽取的能力分类、L1、L2、关注点和等级判定标准，支持 `capability` 与 `capability_focus` 两种粒度 |
| `maturity_scope_service_baseline` | 技术输入基准项 | 从评价基准表抽取的作用域和安全技术服务 / 实践项，用于支撑平台与工具评分 |
| `maturity_mainline_match_result` | 主线数据匹配结果 | maturity 模型基准与主工程已治理安全能力、关注点、安全技术服务的匹配结果 |
| `maturity_match_result` | 评估输入匹配结果 | 客户输入项与主工程能力、关注点的匹配结果，并记录安全技术服务作为技术输入 |
| `maturity_score_result` | 成熟度评分结果 | 能力、关注点或聚合维度的评分结果 |
| `maturity_gap_item` | 成熟度差距项 | 当前成熟度与目标成熟度之间的差距 |
| `maturity_recommendation` | 改进建议 | 针对差距项生成或人工维护的改进建议 |
| `maturity_report_snapshot` | 报告快照 | 一次评估报告的 JSON/Markdown/HTML 结果快照 |

## 3. 与主工程安全能力的关系

主工程当前能力树是 maturity 的评分主轴。

```text
knowledge_items
  capability_category
    └─ capability_domain
        └─ capability
            └─ capability_focus
```

maturity 的引用关系：

| maturity 对象 | 引用主工程对象 | 用途 |
|---|---|---|
| `maturity_capability_baseline.mainline_item_id` | `knowledge_items.id` | 模型基准中的能力分类、L1、L2、关注点与主工程权威对象对齐 |
| `maturity_scope_service_baseline.mainline_service_item_id` | `knowledge_items.id` | 模型基准中的作用域安全技术服务与主工程权威服务对象对齐，用作技术输入 |
| `maturity_mainline_match_result.mainline_item_id` | `knowledge_items.id` | 记录模型基准与主工程治理数据的匹配、冲突和缺失 |
| `assessment_input_normalized.assessment_object_code` | `knowledge_items.code` | 评估输入中填写的能力或关注点编码 |
| `maturity_match_result.matched_item_id` | `knowledge_items.id` | 命中的评分对象，可为 `capability` 或 `capability_focus` |
| `maturity_score_result.dimension_item_id` | `knowledge_items.id` | 明细或聚合评分绑定的主工程对象 |

主工程关系表 `knowledge_relations` 可用于辅助匹配：

- 从技术服务反推能力关注点；
- 从技术模块反推安全技术服务，再反推能力关注点；
- 从流程、职能或生命周期上下文辅助解释评分；
- 从作用域和信息化对象辅助筛选评估范围。

这些引用只读使用，不把客户评估行为写回主知识库。

## 4. 对象关系

```text
maturity_model_version
  ├─ maturity_level_definition
  ├─ maturity_capability_baseline
  │   ├─ maturity_scope_service_baseline
  │   └─ maturity_mainline_match_result

assessment_project
  ├─ assessment_source_file
  ├─ assessment_input_raw
  │   └─ assessment_input_normalized
  │       ├─ maturity_match_result
  │       └─ maturity_score_result
  ├─ maturity_gap_item
  │   └─ maturity_recommendation
  └─ maturity_report_snapshot
```

关系说明：

| 起点 | 关系 | 终点 | 说明 |
|---|---|---|---|
| `maturity_model_version` | 包含 | `maturity_level_definition` | 一个模型版本包含一组 L1-L5 通用等级定义 |
| `maturity_model_version` | 包含 | `maturity_capability_baseline` | 一个模型版本包含能力分类、L1、L2、关注点和专属等级标准 |
| `maturity_capability_baseline` | 包含 | `maturity_scope_service_baseline` | 关注点下可以有多个作用域安全技术服务 / 实践项，作为平台与工具评分的技术输入 |
| `maturity_capability_baseline` | 核对为 | `maturity_mainline_match_result` | 与主工程已治理能力树进行一致性检查 |
| `assessment_project` | 包含 | `assessment_source_file` | 一次评估可以有多个输入来源 |
| `assessment_source_file` | 产生 | `assessment_input_raw` | 来源文件解析后形成原始输入行 |
| `assessment_input_raw` | 标准化为 | `assessment_input_normalized` | 合并单元格填充、字段映射、行类型识别 |
| `assessment_input_normalized` | 匹配为 | `maturity_match_result` | 连接客户输入与能力关注点 |
| `assessment_input_normalized` | 评分为 | `maturity_score_result` | 四要素评分和系统推导结果 |
| `maturity_score_result` | 形成 | `maturity_gap_item` | 与目标等级对比后形成差距 |
| `maturity_gap_item` | 生成 | `maturity_recommendation` | 差距对应改进建议 |
| `assessment_project` | 导出 | `maturity_report_snapshot` | 固化报告结果和规则版本 |

## 5. 样例驱动的行粒度

新版 `sample 评分表.xlsx` 中最重要的行粒度来自 `成熟度分级描述` Sheet。新增 `评估表v2.md` 则提供 L2 能力合并后的 `L1` 到 `L5` 判定标准。

```text
一条关注点定义行 =
能力分类
+ L1 高阶战略能力
+ L2 安全能力
+ 能力关注点编码
+ 能力关注点标题
+ 能力关注点描述
+ L1-L5 专属分级描述

一条作用域实践行 =
上方继承的能力关注点
+ 作用域
+ 技术服务 / 实践项

一条 V2 L2 能力基准 =
能力分类标题
+ L1 能力域标题
+ L2 安全能力编码
+ L2 安全能力标题
+ L2 安全能力描述
+ L1-L5 专属成熟度描述
```

这意味着当前样例提供的是成熟度模型基准，不是客户评分输入。正式评估模板仍需额外设计 `Score_Input`，用于承载客户现状、证据和四要素评分。

本轮确认成熟度正式评分对象有两类，安全技术服务作为技术输入：

| 类型 | 标准对象类型 | 说明 |
|---|---|---|
| 安全能力 | `capability` | 评估某个 L2 安全能力是否具备，通常来自多个关注点的汇总 |
| 能力关注点 | `capability_focus` | 评估某个关注点是否具备，是连接主工程能力树和成熟度基准的核心对象 |
| 作用域安全技术服务 | `security_technical_service_input` | 不单独作为成熟度评分对象，而是作为平台与工具维度的技术输入、证据和匹配线索 |

成熟度评分最终落到 `capability_focus` 或 `capability`。安全技术服务用于说明技术侧是否具备、覆盖哪些作用域，以及能否支撑 `platform_tool_score` 的判定。

`评估表v2.md` 对评分粒度的影响：

- V2 更适合作为 `capability` 粒度评分基准；
- 旧版 XLSX 的 `成熟度分级描述` 更适合作为 `capability_focus` 和安全技术服务输入基准；
- 如果后续选择 L2 能力直接评分，V2 可以作为首版评分解释基准；
- 如果后续选择关注点逐项评分，仍需要确认关注点级 `L1` 到 `L5` 标准是否完整。

## 6. 模型基准与客户输入分离

样例中 `成熟度分级描述` 是模型基准，不是客户输入。建议后续分为两类数据：

| 数据类型 | 来源 | 是否客户评估数据 | 是否进入 `knowledge_items` |
|---|---|---|---|
| 模型基准 | `成熟度级别`、`成熟度分级描述`、Word/PPT 方法论 | 否 | 否，进入 maturity 专用模型基准表 |
| 客户评估输入 | 后续正式模板 `Score_Input` | 是 | 否，进入 maturity 专用表 |
| 评估输出 | 小计、L1 汇总、总体分、差距、建议、报告 | 是 | 否，进入 maturity 专用表 |

## 7. 评分要素口径

本模块固定使用 4 个评分要素：

| 样例口径 | 标准字段 | 说明 |
|---|---|---|
| 组织与角色 | `organization_role` | 责任、角色、组织分工、责任落实 |
| 制度与流程 | `process_system` | 制度、流程、SOP、审批、例外管理 |
| 平台与工具 | `platform_tool` | 平台、工具、技术措施、自动化能力 |
| 数据与信息 | `data_information` | 安全数据记录、采集、关联、决策支持 |

此前 PRD 中的 6 要素模型不作为当前模块口径。后续如需扩展，只能作为新模型版本进入 maturity 专用配置和版本表，不能混入当前固定口径。

## 8. 与主工程治理数据的一致性核对

maturity 模型基准中的安全能力、能力关注点和作用域安全技术服务必须与主工程已经治理好的数据做一次匹配核对。

核对对象：

| maturity 基准对象 | 主工程权威对象 | 核对目的 |
|---|---|---|
| 能力分类 | `capability_category` | 检查分类名称和层级是否一致 |
| L1 高阶战略能力 | `capability_domain` | 检查 L1 能力域是否存在、命名是否一致 |
| L2 安全能力 | `capability` | 检查 L2 能力是否存在、归属是否一致 |
| 能力关注点 | `capability_focus` | 检查编码、标题、描述和父级能力是否一致 |
| 作用域安全技术服务 | 主工程安全技术服务类对象 | 检查作用域、服务名称、服务归属和能力关系是否一致 |

不一致项不自动改主工程，也不自动改 maturity 基准。系统应输出待确认清单，进入人工确认：

- `missing_in_mainline`：maturity 基准中存在，主工程未找到；
- `missing_in_maturity`：主工程存在，maturity 基准未覆盖；
- `name_conflict`：编码或层级相同，但名称不一致；
- `parent_conflict`：对象存在，但父级归属不一致；
- `scope_conflict`：作用域编码、名称或归属不一致；
- `service_conflict`：安全技术服务名称、定义或关联能力不一致；
- `ambiguous_match`：一个基准对象匹配到多个候选，需要人工选择。

## 9. 不进入 `knowledge_items` 的数据

以下数据明确不进入 `knowledge_items`：

- 客户名称；
- 评估项目；
- 客户评分；
- 客户现状说明；
- 客户证据；
- 匹配候选；
- 审查意见；
- 成熟度差距；
- 改进建议；
- 报告快照。

这些数据后续全部进入 maturity 专用表，并默认保存在本地数据库和 `data/maturity/` 运行目录。
