# 成熟度评估模板设计

本文档定义 maturity 模块 V1 的 Excel 模板结构。当前只做模板设计和 YAML schema 占位，不生成实际模板文件。

## 1. 模板原则

| 原则 | 说明 |
|---|---|
| 动态生成 | `Reference_Capabilities` 必须从当前 SQLite 能力库生成 |
| 模板可追踪 | `Assessment_Info.template_version` 必填 |
| 方便非开发者填写 | 使用清晰字段、示例和下拉参考，避免要求用户理解数据库结构 |
| 一行一事 | `Current_State_Input` 每行描述一个相对明确的客户现状点 |
| 证据可选但推荐 | V1 允许只填证据摘要，后续再关联附件 |
| 支持人工修正 | 通过 `Manual_Adjustment` 或审查表记录替换、拒绝和评分覆盖 |

## 2. Workbook Sheet

| Sheet | 必需 | 用途 |
|---|---|---|
| `Assessment_Info` | 是 | 客户、项目、范围、目标等级、模板版本 |
| `Current_State_Input` | 是 | 员工填写客户现状，作为核心输入 |
| `Evidence_List` | 否 | 证据材料清单，记录文件名、类型、位置和摘要 |
| `Manual_Adjustment` | 否 | 人工修正能力匹配或评分 |
| `Reference_Capabilities` | 是 | 当前 Wiki 能力库导出的能力参考 |
| `Reference_L2_Capability_Criteria` | 是 | 从 `评估表v2.md` 生成的 L2 能力 `L1` 到 `L5` 判定标准 |
| `Reference_Level_Criteria` | 是 | 通用成熟度等级定义 |
| `Reference_Mainline_Diff` | 否 | 模型基准与主工程能力库差异确认表 |
| `Readme` | 是 | 填写说明、字段解释、示例和注意事项 |

## 3. `Assessment_Info`

采用 key-value 结构。

| 字段 | 必填 | 示例 | 说明 |
|---|---|---|---|
| assessment_name | 是 | A 公司安全成熟度评估 | 评估名称 |
| customer_name | 是 | A 公司 | 客户名称 |
| industry | 否 | 金融 / 制造 / 政务 | 行业 |
| assessment_date | 是 | 2026-05-13 | 评估日期 |
| assessor | 是 | 张三 | 填写人 |
| target_level | 否 | L3 | 默认目标等级 |
| assessment_scope | 是 | 总部核心系统 | 评估范围 |
| template_version | 是 | v1 | 模板版本 |
| confidentiality | 否 | confidential | 敏感级别 |
| note | 否 | - | 备注 |

## 4. `Current_State_Input`

| 字段 | 必填 | 说明 |
|---|---|---|
| row_id | 是 | 行编号，便于追踪 |
| business_scope | 否 | 客户业务范围 |
| scenario | 否 | 场景 |
| selected_capability_code | 否 | 员工选择的能力关注点编码，强烈建议填写 |
| selected_capability_title | 否 | 员工选择的能力名称 |
| current_state_summary | 是 | 客户现状总结 |
| organization_status | 否 | 组织职责、部门、岗位、责任边界 |
| process_status | 否 | 制度、流程、SOP、审批、例外管理 |
| technology_status | 否 | 工具、平台、产品、技术措施 |
| operation_status | 否 | 日常运营、监控、审计、告警、报表 |
| metric_status | 否 | 指标、度量、SLA、覆盖率、有效性评价 |
| improvement_status | 否 | 复盘、整改、优化、闭环机制 |
| evidence_summary | 否 | 证据摘要 |
| known_gaps | 否 | 已知差距 |
| expected_target_level | 否 | 针对此行的目标等级 |
| importance_weight | 否 | 重要性权重，默认 1 |
| assessor_note | 否 | 备注 |

## 5. `Evidence_List`

| 字段 | 必填 | 说明 |
|---|---|---|
| evidence_id | 是 | 证据编号 |
| evidence_type | 否 | docx / pptx / xlsx / pdf / screenshot / interview / other |
| file_name | 否 | 证据文件名 |
| source_location | 否 | 页码、章节、Sheet、行号或访谈位置 |
| summary | 是 | 证据摘要 |
| linked_row_id | 否 | 关联 `Current_State_Input.row_id` |
| sensitive_level | 否 | unknown / internal / confidential |

初始 raw sample 包括一个 Word、一个 PPTX 和一个 XLSX。V1 模板导入以 XLSX 为主；Word 和 PPTX 先作为证据或报告风格参考，不进入自动评分必需链路。

## 6. `Manual_Adjustment`

| 字段 | 必填 | 说明 |
|---|---|---|
| row_id | 是 | 输入行编号 |
| adjustment_type | 是 | approve_match / reject_match / replace_match / override_score |
| capability_code | 否 | 替换或确认后的能力编码 |
| maturity_level | 否 | 人工覆盖等级 |
| maturity_score | 否 | 人工覆盖分数 |
| reviewer | 否 | 审查人 |
| reviewer_note | 是 | 审查说明 |

## 7. `Reference_Capabilities`

该 Sheet 由系统从当前知识库生成，用户不应手工维护。

| 字段 | 说明 |
|---|---|
| category_code | 能力分类编码 |
| category_title | 能力分类名称 |
| domain_code | L1 能力域编码 |
| domain_title | L1 能力域名称 |
| capability_code | L2 能力编码 |
| capability_title | L2 能力名称 |
| focus_code | 能力关注点编码 |
| focus_title | 能力关注点名称 |
| path | 完整路径 |
| description | 描述 |
| status | 数据状态 |

## 8. 模板校验

| 规则 | 等级 | 处理 |
|---|---|---|
| 缺少 `Assessment_Info` | error | 终止导入 |
| 缺少 `Current_State_Input` | error | 终止导入 |
| `customer_name` 为空 | error | 要求补录 |
| `current_state_summary` 为空 | warning | 不参与自动评分 |
| `selected_capability_code` 不存在 | warning | 进入候选匹配 |
| 模板版本不支持 | error | 提示重新生成模板 |
| `row_id` 重复 | warning | 系统生成内部 ID，保留原始 row_id |

## 9. `Reference_L2_Capability_Criteria`

该 Sheet 由 `data/raw-samples/maturity/评估表v2.md` 生成，用户不应手工维护。

| 字段 | 说明 |
|---|---|
| capability_category_ref | 能力分类上下文 |
| capability_domain_ref | L1 能力域上下文 |
| capability_code | L2 安全能力编码 |
| capability_title | L2 安全能力名称 |
| capability_description | L2 能力描述 |
| criteria_granularity | 固定为 `capability` |
| L1 | L1 非正式执行描述 |
| L2 | L2 计划跟踪描述 |
| L3 | L3 充分定义描述 |
| L4 | L4 量化控制描述 |
| L5 | L5 持续优化描述 |
| source_file | 来源文件 |
| source_line | 来源行号 |

## 10. 生成路径占位

后续 M1 默认模板输出：

```text
data/maturity/templates/customer-maturity-template-v1.xlsx
```

该文件为生成产物，默认不提交 GitHub。
