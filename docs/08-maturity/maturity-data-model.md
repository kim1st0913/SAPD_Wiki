# 成熟度模块数据模型

本文档定义第一轮样本驱动后的 maturity 数据表草案。当前只做逻辑建模，不新增迁移，不修改主工程核心 schema。

业务逻辑来源：

- 模型设计严格参考 `sample文档介绍.docx` 第 3.1 章“网络安全能力成熟度模型”；
- 评估逻辑严格参考 `sample文档介绍.docx` 第 4 章“网络安全能力成熟度评估”；
- 数据表只承载上述业务逻辑的结构化实现，不额外发明新的评分层级。

## 1. 总体结构

```text
assessment_project
  ├─ maturity_model_version
  │   ├─ maturity_level_definition
  │   ├─ maturity_capability_baseline
  │   │   └─ maturity_scope_service_baseline
  │   └─ maturity_mainline_match_result
  ├─ assessment_source_file
  ├─ assessment_input_raw
  │   └─ assessment_input_normalized
  │       ├─ maturity_match_result
  │       └─ maturity_score_result
  ├─ maturity_gap_item
  ├─ maturity_recommendation
  └─ maturity_report_snapshot
```

## 2. `assessment_project`

记录一次客户成熟度评估项目。

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | text | 评估项目 ID |
| `project_name` | text | 评估项目名称 |
| `customer_name` | text | 客户名称 |
| `industry` | text | 行业 |
| `assessment_scope` | text | 评估范围 |
| `assessment_date` | text | 评估日期 |
| `assessor` | text | 评估人员 |
| `target_level` | text | 默认目标等级，如 `L3` |
| `template_version` | text | 模板版本 |
| `model_version` | text | 成熟度模型版本 |
| `rule_set_version` | text | 评分规则版本 |
| `knowledge_base_snapshot` | text | 主工程能力库快照 |
| `status` | text | parsed / normalized / matched / scored / finalized / archived |
| `summary_json` | text | 评估摘要 |
| `created_at` | text | 创建时间 |
| `updated_at` | text | 更新时间 |

说明：当前样例 XLSX 缺少这些项目级字段，正式模板必须新增 `Assessment_Info` Sheet。

## 3. 模型基准专用表

新版 `sample 评分表.xlsx` 是评价基准表，Word 是模型方法论基准。二者不应写入 `knowledge_items`，也不应混入客户评分输入表。最佳实践是进入 maturity 专用模型基准表，并通过版本号与后续评估项目绑定。

### 3.1 `maturity_model_version`

记录一个成熟度模型基准版本。

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | text | 模型版本 ID |
| `model_code` | text | 模型编码，如 `security_maturity` |
| `model_name` | text | 模型名称 |
| `model_version` | text | 模型版本，如 `v0.2-sample-202605` |
| `methodology_source_file_id` | text | Word 方法论来源文件 |
| `baseline_source_file_id` | text | XLSX 评价基准来源文件 |
| `l2_baseline_source_file_id` | text | Markdown V2 L2 能力评价基准来源文件，可为空 |
| `status` | text | draft / matched / reviewed / active / archived |
| `description` | text | 模型版本说明 |
| `created_at` | text | 创建时间 |
| `updated_at` | text | 更新时间 |

### 3.2 `maturity_level_definition`

记录 L1-L5 通用等级定义，以及四个固定评分要素的等级解释。

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | text | 等级定义 ID |
| `model_version_id` | text | 所属模型版本 |
| `level_code` | text | L1 / L2 / L3 / L4 / L5 |
| `level_name` | text | 等级名称 |
| `general_definition` | text | 通用等级定义 |
| `organization_role_criteria` | text | 组织与角色口径 |
| `process_system_criteria` | text | 制度与流程口径 |
| `platform_tool_criteria` | text | 平台与工具口径 |
| `data_information_criteria` | text | 数据与信息口径 |
| `source_sheet` | text | 来源 Sheet |
| `source_row` | integer | 来源行号 |
| `created_at` | text | 创建时间 |

### 3.3 `maturity_capability_baseline`

记录评价基准表中的能力分类、L1、L2、能力关注点和专属 L1-L5 判定标准。

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | text | 能力基准项 ID |
| `model_version_id` | text | 所属模型版本 |
| `baseline_object_type` | text | capability_category / capability_domain / capability / capability_focus |
| `criteria_granularity` | text | capability / capability_focus，用于区分 V2 L2 基准和 XLSX 关注点基准 |
| `baseline_source_kind` | text | word_chapter_3_1 / xlsx_focus_baseline / markdown_l2_baseline_v1_2 |
| `capability_category_ref` | text | 能力分类原文 |
| `capability_domain_ref` | text | L1 高阶战略能力原文 |
| `capability_ref` | text | L2 安全能力原文 |
| `capability_focus_code` | text | 能力关注点编码 |
| `capability_focus_title` | text | 能力关注点标题 |
| `capability_focus_description` | text | 能力关注点描述 |
| `capability_description` | text | L2 能力描述，V2 L2 基准使用 |
| `level_criteria_json` | text | 该能力或关注点专属 L1-L5 判定标准 |
| `mainline_item_id` | text | 匹配到的主工程 `knowledge_items.id`，可为空 |
| `mainline_match_status` | text | unverified / matched / ambiguous / missing / conflict / approved |
| `source_sheet` | text | 来源 Sheet |
| `source_row` | integer | 来源行号 |
| `created_at` | text | 创建时间 |
| `updated_at` | text | 更新时间 |

### 3.4 `maturity_scope_service_baseline`

记录能力关注点下的作用域安全技术服务 / 实践项。

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | text | 作用域服务基准项 ID |
| `model_version_id` | text | 所属模型版本 |
| `capability_baseline_id` | text | 所属 `maturity_capability_baseline.id` |
| `capability_focus_code` | text | 继承的能力关注点编码 |
| `scope_type` | text | 作用域原文 |
| `scope_type_code` | text | 标准化作用域编码 |
| `security_technical_service_name` | text | 安全技术服务 / 实践项名称 |
| `mainline_service_item_id` | text | 匹配到的主工程服务对象 ID，可为空 |
| `mainline_match_status` | text | unverified / matched / ambiguous / missing / conflict / approved |
| `source_sheet` | text | 来源 Sheet |
| `source_row` | integer | 来源行号 |
| `created_at` | text | 创建时间 |
| `updated_at` | text | 更新时间 |

### 3.5 `maturity_mainline_match_result`

记录 maturity 模型基准与主工程已治理安全能力、关注点、安全技术服务的一致性核对结果。

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | text | 匹配核对结果 ID |
| `model_version_id` | text | 所属模型版本 |
| `baseline_object_type` | text | capability_category / capability_domain / capability / capability_focus / security_technical_service_input |
| `baseline_object_id` | text | 对应 maturity 基准表 ID |
| `baseline_code` | text | 基准对象编码 |
| `baseline_title` | text | 基准对象名称 |
| `mainline_item_id` | text | 主工程候选或命中对象 ID |
| `mainline_item_type` | text | 主工程对象类型 |
| `match_method` | text | exact_code / exact_title / relation / keyword / manual |
| `match_score` | real | 0-100 匹配置信度 |
| `match_status` | text | matched / ambiguous_match / missing_in_mainline / missing_in_maturity / name_conflict / parent_conflict / scope_conflict / service_conflict / approved / rejected |
| `difference_json` | text | 编码、名称、父级、作用域、服务关系等差异明细 |
| `suggested_action` | text | accept_match / update_maturity_baseline / update_mainline_candidate / create_open_issue / ignore |
| `review_status` | text | pending / confirmed / resolved / deferred |
| `reviewer_note` | text | 人工确认说明 |
| `created_at` | text | 创建时间 |
| `updated_at` | text | 更新时间 |

## 4. `assessment_source_file`

记录一次评估使用的来源文件。

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | text | 来源文件 ID |
| `project_id` | text | 所属评估项目 |
| `source_file_id` | text | 可选关联主工程 `source_files.id` |
| `file_name` | text | 文件名 |
| `file_type` | text | xlsx / docx / pptx / pdf / other |
| `file_path` | text | 本地相对路径 |
| `file_hash` | text | 文件 hash |
| `usage_role` | text | scoring_input / model_baseline / evaluation_baseline / evidence / tutorial / report_reference |
| `sensitive_level` | text | unknown / internal / confidential |
| `created_at` | text | 创建时间 |

样例映射：

| 文件 | `usage_role` |
|---|---|
| `sample 评分表.xlsx` | evaluation_baseline |
| `sample文档介绍.docx` | model_baseline / report_reference |
| `samle 使用教程.pptx` | tutorial / report_reference |

## 5. `assessment_input_raw`

保存从来源文件读取的原始行。它保留原始字段和原始位置，不做业务解释。

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | text | 原始输入 ID |
| `project_id` | text | 所属评估项目 |
| `assessment_source_file_id` | text | 来源文件 |
| `source_sheet` | text | 来源 Sheet |
| `source_row` | integer | 来源行号 |
| `source_column_range` | text | 来源列范围 |
| `raw_row_json` | text | 原始行 JSON |
| `raw_text` | text | 原始文本摘要 |
| `row_hash` | text | 行内容 hash |
| `created_at` | text | 创建时间 |

样例中 `成熟度级别`、`成熟度分级描述` 的每个非空行都可以先进入本表，再由标准化过程识别行类型。新版样例不包含客户评分输入。

新增 `评估表v2.md` 为 Markdown 基准来源。解析时建议将每个 `##### <capability_code> <capability_title>` 块保存为一条 `maturity_capability_baseline`，并记录：

- `criteria_granularity = capability`
- `baseline_source_kind = markdown_l2_baseline_v1_2`
- `baseline_object_type = capability`
- `capability_description`
- `level_criteria_json`

## 6. `assessment_input_normalized`

保存清洗后的评估输入项，是后续匹配和评分的核心输入。

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | text | 标准化输入 ID |
| `project_id` | text | 所属评估项目 |
| `raw_input_id` | text | 对应 `assessment_input_raw.id` |
| `row_type` | text | level_definition / focus_definition / scope_practice / score_detail / focus_subtotal / capability_subtotal / domain_subtotal / view_summary |
| `assessment_object_type` | text | capability / capability_focus |
| `assessment_object_code` | text | 评估对象编码，可为能力或关注点编码 |
| `assessment_object_title` | text | 评估对象名称 |
| `capability_category_ref` | text | 能力分类引用 |
| `capability_domain_ref` | text | L1 能力域引用 |
| `capability_ref` | text | L2 能力引用 |
| `capability_focus_code` | text | 能力关注点编码 |
| `capability_focus_title` | text | 能力关注点标题 |
| `capability_focus_description` | text | 能力关注点描述 |
| `scope_type` | text | 作用域 |
| `security_technical_service_name` | text | 作用域安全技术服务 / 实践项 |
| `organization_role_score` | real | 组织角色得分，正式 `Score_Input` 使用 |
| `process_system_score` | real | 制度流程得分，正式 `Score_Input` 使用 |
| `platform_tool_score` | real | 平台工具得分，正式 `Score_Input` 使用 |
| `data_information_score` | real | 数据信息得分，正式 `Score_Input` 使用 |
| `level_criteria_json` | text | L1-L5 分级描述 |
| `computed_score_from_sample` | real | 旧版样例公式结果兼容字段，新版样例为空 |
| `validation_status` | text | ok / warning / error |
| `validation_message` | text | 校验说明 |
| `metadata_json` | text | 扩展字段 |
| `created_at` | text | 创建时间 |

字段说明：

- `level_definition`、`focus_definition`、`scope_practice` 行用于模型基准描述；
- `score_detail` 行用于后续正式 `Score_Input` 的客户评分输入；
- 小计行不作为人工输入评分，只作为校验或迁移兼容信息。

## 7. `maturity_match_result`

保存标准化输入项与主工程能力库之间的匹配结果。

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | text | 匹配结果 ID |
| `project_id` | text | 所属评估项目 |
| `normalized_input_id` | text | 标准化输入项 |
| `assessment_object_type` | text | capability / capability_focus |
| `assessment_object_code` | text | 评估对象编码 |
| `matched_item_id` | text | 命中的主工程知识对象 |
| `matched_item_type` | text | 命中对象类型 |
| `capability_id` | text | 关联 L2 安全能力 ID，可为空 |
| `capability_focus_id` | text | 关联能力关注点 ID，可为空 |
| `security_technical_service_input_id` | text | 关联平台与工具维度的安全技术服务输入 ID，可为空 |
| `match_method` | text | exact_code / title / relation_expansion / keyword / manual |
| `match_score` | real | 0-100 匹配置信度 |
| `match_status` | text | auto_accepted / needs_review / weak_candidate / unmatched / approved / rejected / replaced |
| `explanation` | text | 匹配说明 |
| `reviewer` | text | 审查人 |
| `review_note` | text | 审查说明 |
| `created_at` | text | 创建时间 |
| `updated_at` | text | 更新时间 |

样例中 `安全关注点` 编码可优先使用 `exact_code` 匹配主工程 `capability_focus`。安全技术服务先使用 `scope_type + security_technical_service_name + capability_focus_code` 组合匹配，用于支持 `platform_tool_score`，不单独形成成熟度评分对象。

## 8. `maturity_score_result`

保存评分结果。评分结果可以是明细评分，也可以是聚合评分。

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | text | 评分结果 ID |
| `project_id` | text | 所属评估项目 |
| `normalized_input_id` | text | 明细评分来源，可为空 |
| `score_level_type` | text | detail / focus / capability / domain / category / overall |
| `assessment_object_type` | text | capability / capability_focus / aggregate |
| `assessment_object_id` | text | 当前评分对象 ID，可为主工程对象或 maturity 基准对象 |
| `dimension_item_id` | text | 对应主工程能力对象，可为空 |
| `capability_id` | text | L2 安全能力 ID，可为空 |
| `capability_focus_id` | text | 能力关注点 ID，可为空 |
| `scope_type` | text | 作用域，可为空 |
| `security_technical_service_name` | text | 作用域安全技术服务 / 实践项，可为空 |
| `organization_role_score` | real | 组织角色得分 |
| `process_system_score` | real | 制度流程得分 |
| `platform_tool_score` | real | 平台工具得分 |
| `data_information_score` | real | 数据信息得分 |
| `target_organization_role_score` | real | 组织角色目标得分 |
| `target_process_system_score` | real | 制度流程目标得分 |
| `target_platform_tool_score` | real | 平台工具目标得分 |
| `target_data_information_score` | real | 数据信息目标得分 |
| `maturity_score` | real | 综合成熟度分数 |
| `maturity_level` | text | L1-L5，系统内部可支持 L0 |
| `target_level` | text | 四维目标加权后的派生目标等级；不再作为点级唯一目标输入 |
| `gap_score` | real | 分数差距 |
| `confidence` | real | 评分置信度 |
| `score_method` | text | manual_input / average / weighted_average / minimum / override |
| `scoring_detail_json` | text | 评分明细；包含当前/目标四维等级、各维度可选说明及“目标维度不得低于同维度当前状态”的校验结果 |
| `created_at` | text | 创建时间 |
| `updated_at` | text | 更新时间 |

评分结果层级固定为：

```text
detail
  → focus
  → capability
  → domain
  → category
  → overall
```

如果某次评估只在 `capability` 粒度填写，系统可以直接生成 `capability` 评分；如果填写到 `capability_focus` 粒度，则再向上聚合到 `capability`、`domain`、`category` 和 `overall`。安全技术服务只作为 `platform_tool_score` 的输入证据，不生成独立评分层级。

## 9. `maturity_gap_item`

保存当前分数与目标之间的差距项。

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | text | 差距项 ID |
| `project_id` | text | 所属评估项目 |
| `score_result_id` | text | 对应评分结果 |
| `gap_level_type` | text | focus / capability / domain / category / overall |
| `dimension_item_id` | text | 对应主工程能力对象 |
| `current_level` | text | 当前等级 |
| `target_level` | text | 目标等级 |
| `gap_level` | integer | 等级差距 |
| `gap_score` | real | 分数差距 |
| `priority` | text | high / medium / low |
| `priority_reason` | text | 优先级原因 |
| `evidence_summary` | text | 证据摘要 |
| `created_at` | text | 创建时间 |

## 10. `maturity_recommendation`

保存面向差距项的改进建议。

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | text | 建议 ID |
| `project_id` | text | 所属评估项目 |
| `gap_item_id` | text | 对应差距项 |
| `recommendation_type` | text | organization / process / technology / data / roadmap / other |
| `title` | text | 建议标题 |
| `description` | text | 建议内容 |
| `related_capability_focus_id` | text | 关联能力关注点 |
| `related_security_technical_service_id` | text | 关联作用域安全技术服务，可为空 |
| `suggested_priority` | text | high / medium / low |
| `suggested_phase` | text | short_term / mid_term / long_term |
| `source` | text | generated / manual / template |
| `created_at` | text | 创建时间 |

## 11. `maturity_report_snapshot`

保存报告快照和导出路径。

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | text | 报告快照 ID |
| `project_id` | text | 所属评估项目 |
| `report_version` | text | 报告版本 |
| `report_type` | text | json / markdown / html / excel / pptx |
| `file_path` | text | 本地报告路径 |
| `snapshot_json` | text | 报告核心数据快照 |
| `model_version` | text | 模型版本 |
| `rule_set_version` | text | 评分规则版本 |
| `knowledge_base_snapshot` | text | 主工程能力库快照 |
| `created_at` | text | 创建时间 |

## 12. 与已有 M0 表设计的关系

此前 M0 文档中提出了 `maturity_assessments`、`maturity_input_rows` 等表名。本轮样本分析后，建议后续 M1 采用更贴近评估业务的命名：

| M0 表名 | 本轮建议表名 | 原因 |
|---|---|---|
| `maturity_assessments` | `assessment_project` | 更明确表达一次客户评估项目 |
| `maturity_input_rows` | `assessment_input_raw` + `assessment_input_normalized` | 样例需要同时保留原始行和标准化行 |
| `maturity_match_candidates` | `maturity_match_result` | 支持候选、审查和最终结果统一记录 |
| `maturity_capability_scores` / `maturity_dimension_scores` | `maturity_score_result` | 用 `score_level_type` 统一明细和聚合评分 |
| `maturity_reports` | `maturity_report_snapshot` | 强调报告可回放和版本固化 |
