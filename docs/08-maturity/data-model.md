# 成熟度分析模块数据模型设计

本文档定义 maturity 模块的逻辑数据模型。当前只做设计，不新增数据库迁移，不修改主线业务代码。

## 1. 建模原则

| 原则 | 说明 |
|---|---|
| 专用评估表 | 客户输入、匹配候选、评分结果和报告记录全部使用 `maturity_*` 专用表 |
| 不污染知识库 | 不把成熟度评估结果写入 `knowledge_items`，也不把客户资料变成长期知识对象 |
| 只读引用知识库 | 评分对象通过 `knowledge_items.id` 引用现有能力、能力域和能力关注点 |
| 追踪评估口径 | 每次评估记录模板版本、评分规则版本和知识库快照 |
| 保留来源证据 | 记录来源文件、Sheet、行号、输入字段、证据摘要、匹配方法和评分规则 |
| 本地敏感数据 | 运行数据默认位于 `data/maturity/` 或 SQLite 本地库，不提交 GitHub |

## 2. 与主数据模型关系

```text
knowledge_items（只读能力库）
  ├─ capability_category
  ├─ capability_domain
  ├─ capability
  └─ capability_focus

maturity_assessments
  ├─ maturity_input_rows
  ├─ maturity_evidence_items
  ├─ maturity_match_candidates
  ├─ maturity_capability_scores
  ├─ maturity_dimension_scores
  └─ maturity_reports
```

maturity 模块可以读取 `knowledge_relations` 来做关系扩展匹配，例如从安全技术服务、安全技术模块、流程、职能反推到能力关注点。但评估运行结果不回写为知识关系。

## 3. 建议新增表

### 3.1 `maturity_assessments`

记录一次客户成熟度评估。

| 字段 | 类型 | 说明 |
|---|---|---|
| id | text | 评估 ID |
| assessment_name | text | 评估名称 |
| customer_name | text | 客户名称 |
| industry | text | 行业 |
| assessment_date | text | 评估日期 |
| assessor | text | 填写人 |
| target_level | text | 默认目标等级 |
| assessment_scope | text | 评估范围 |
| template_version | text | 模板版本 |
| rule_set_version | text | 评分规则版本 |
| knowledge_base_snapshot | text | 知识库快照或导出批次 |
| status | text | parsed / matching / reviewing / scored / finalized / archived |
| source_file_id | text | 来源模板文件，可关联 `source_files.id` |
| import_job_id | text | 导入任务，可关联 `import_jobs.id` |
| summary_json | text | 评估摘要 |
| created_at | text | 创建时间 |
| updated_at | text | 更新时间 |

### 3.2 `maturity_input_rows`

记录员工填写的每一行客户现状。

| 字段 | 类型 | 说明 |
|---|---|---|
| id | text | 输入行 ID |
| assessment_id | text | 所属评估 |
| row_id | text | 模板中的行编号 |
| source_sheet | text | 来源 Sheet |
| source_row | integer | 来源行号 |
| business_scope | text | 业务范围 |
| scenario | text | 场景 |
| selected_capability_code | text | 员工选择的能力编码 |
| selected_capability_title | text | 员工选择的能力标题 |
| current_state_summary | text | 现状总结 |
| organization_status | text | 组织职责描述 |
| process_status | text | 制度流程描述 |
| technology_status | text | 技术工具描述 |
| operation_status | text | 运营执行描述 |
| metric_status | text | 指标度量描述 |
| improvement_status | text | 改进闭环描述 |
| evidence_summary | text | 证据摘要 |
| known_gaps | text | 已知差距 |
| expected_target_level | text | 单行目标等级 |
| importance_weight | real | 重要性权重，默认 1 |
| metadata_json | text | 扩展字段 |
| validation_status | text | ok / warning / error |
| validation_message | text | 校验说明 |
| created_at | text | 创建时间 |

### 3.3 `maturity_evidence_items`

记录模板 `Evidence_List` 中的证据材料。V1 可只保存证据摘要，不强制解析 Word/PPTX 附件全文。

| 字段 | 类型 | 说明 |
|---|---|---|
| id | text | 证据 ID |
| assessment_id | text | 所属评估 |
| evidence_id | text | 模板中的证据编号 |
| evidence_type | text | docx / pptx / xlsx / pdf / screenshot / interview / other |
| file_name | text | 证据文件名 |
| file_path | text | 本地相对路径，可为空 |
| source_location | text | 页码、章节、Sheet、行号或访谈位置 |
| summary | text | 证据摘要 |
| linked_input_row_id | text | 关联输入行，可为空 |
| sensitive_level | text | unknown / internal / confidential |
| created_at | text | 创建时间 |

### 3.4 `maturity_match_candidates`

记录输入行到能力对象的匹配候选。

| 字段 | 类型 | 说明 |
|---|---|---|
| id | text | 候选 ID |
| assessment_id | text | 所属评估 |
| input_row_id | text | 输入行 |
| matched_item_id | text | 命中的知识对象 |
| matched_item_type | text | 命中的对象类型 |
| mapped_capability_focus_id | text | 最终评分能力关注点，对应 `knowledge_items.id` |
| match_method | text | exact_code / alias / relation_expansion / keyword / fuzzy |
| match_score | real | 0-100 |
| match_status | text | auto_accepted / needs_review / weak_candidate / unmatched / rejected / approved / replaced |
| explanation | text | 匹配解释 |
| review_note | text | 人工审查备注 |
| created_at | text | 创建时间 |
| updated_at | text | 更新时间 |

### 3.5 `maturity_capability_scores`

记录每个能力关注点的评分结果。

| 字段 | 类型 | 说明 |
|---|---|---|
| id | text | 评分 ID |
| assessment_id | text | 所属评估 |
| capability_focus_id | text | 能力关注点，对应 `knowledge_items.id` |
| context_key | text | 场景上下文，可为空 |
| maturity_level | text | L0-L5 |
| maturity_score | real | 0-100 |
| target_level | text | 目标等级 |
| gap_level | integer | 等级差距 |
| gap_score | real | 分数差距 |
| confidence | real | 评分置信度 |
| evidence_count | integer | 有效证据数量 |
| scoring_detail_json | text | 各要素命中、得分、规则和缺失项 |
| reviewer_override | integer | 是否人工覆盖 |
| reviewer_note | text | 人工说明 |
| status | text | draft / reviewed / finalized |
| created_at | text | 创建时间 |
| updated_at | text | 更新时间 |

### 3.6 `maturity_dimension_scores`

记录聚合层级评分。

| 字段 | 类型 | 说明 |
|---|---|---|
| id | text | 汇总 ID |
| assessment_id | text | 所属评估 |
| dimension_type | text | overall / category / domain / capability / scenario |
| dimension_item_id | text | 对应 `knowledge_items.id`，整体评分可为空 |
| title | text | 展示名称 |
| maturity_level | text | L0-L5 |
| maturity_score | real | 平均分 |
| target_level | text | 目标等级 |
| gap_score | real | 差距分 |
| coverage_rate | real | 覆盖率 |
| confidence | real | 置信度 |
| detail_json | text | 明细 |
| created_at | text | 创建时间 |

### 3.7 `maturity_reports`

记录报告导出文件。

| 字段 | 类型 | 说明 |
|---|---|---|
| id | text | 报告 ID |
| assessment_id | text | 所属评估 |
| report_type | text | html / markdown / json / excel |
| file_path | text | 本地路径 |
| created_at | text | 创建时间 |

## 4. 本地文件目录建议

```text
data/maturity/
├─ templates/
├─ inputs/
├─ staging/
├─ reports/
└─ exports/
```

目录用途：

| 目录 | 用途 | 是否提交 |
|---|---|---|
| `data/maturity/templates/` | 生成的评估模板，可重新生成 | 默认不提交生成文件 |
| `data/maturity/inputs/` | 客户填写模板和敏感输入 | 否 |
| `data/maturity/staging/` | 匹配审查表、评分审查表 | 否 |
| `data/maturity/reports/` | HTML/Markdown/JSON 报告 | 否 |
| `data/maturity/exports/` | 后续打包或汇总导出 | 否 |

## 5. 迁移策略

M0 不新增迁移。M1 才新增类似 `db/migrations/006_maturity_assessment.sql` 的迁移文件，并在迁移中只创建 `maturity_*` 表，不修改现有 `knowledge_items` 表结构。
