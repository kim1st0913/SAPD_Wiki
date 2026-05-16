# 成熟度模板字段映射设计

本文档定义新版 `sample 评分表.xlsx` 字段到 maturity 标准字段的映射关系，并提出后续正式模板建议。

补充说明：新增 `data/raw-samples/maturity/评估表v2.md` 是 Markdown 格式的 L2 能力评价基准，字段映射见本文件第 2.3 节和 `config/maturity/field-mapping.evaluation-table-v2.yaml`。

## 1. 映射原则

| 原则 | 说明 |
|---|---|
| 新版样例定位为模型基准 | `sample 评分表.xlsx` 不再包含客户评分输入，只用于等级定义、能力关注点和分级标准 |
| 先保留原始行 | 所有样例行先进入 `assessment_input_raw` 或后续模型基准原始表 |
| 再标准化拆分 | 根据 Sheet 和行内容生成模型基准对象或参考字段 |
| 区分行类型 | 关注点定义行和作用域实践行不能混为一类 |
| 引用主能力库 | 能力分类、L1、L2、关注点编码只读引用主工程能力对象 |
| 评分对象收敛 | 正式模板评分对象只支持 `capability`、`capability_focus` |
| 技术服务作输入 | 安全技术服务作为 `platform_tool_score` 的技术输入、证据和匹配线索 |
| 先做一致性核对 | 模型基准启用前，先输出与主工程已治理数据不一致的清单 |
| 客户数据不进知识主表 | 后续评估输入和结果只进入 maturity 专用模型 |
| 业务逻辑来源固定 | 模型设计参考 Word 第 3.1 章，评估逻辑参考 Word 第 4 章 |

## 2. 样例字段到标准字段映射

### 2.1 `成熟度级别`

| 样例字段 / 区域 | 标准字段 | 必填 | 字段类型 | 用途 |
|---|---|---|---|---|
| `Level 1 非正式执行` | `level_definitions.L1` | 是 | 枚举定义 | L1 通用等级标准 |
| `Level 2 / 计划跟踪` | `level_definitions.L2` | 是 | 枚举定义 | L2 通用等级标准 |
| `Level 3/ 充分定义` | `level_definitions.L3` | 是 | 枚举定义 | L3 通用等级标准 |
| `Level 4/ 量化控制` | `level_definitions.L4` | 是 | 枚举定义 | L4 通用等级标准 |
| `Level 5 / 持续优化` | `level_definitions.L5` | 是 | 枚举定义 | L5 通用等级标准 |

说明：每个等级文本内部包含固定四类评分要素。导入 maturity 专用模型表时应拆为：

- `organization_role_criteria`
- `process_system_criteria`
- `platform_tool_criteria`
- `data_information_criteria`

### 2.2 `成熟度分级描述`

| 样例字段 | 标准字段 | 必填 | 字段类型 | 用途 |
|---|---|---|---|---|
| `安全能力分类` | `capability_category_ref` | 是 | 引用字段 | 能力分类上下文 |
| `L1 高阶战略能力` | `capability_domain_ref` | 是 | 引用字段 | L1 能力域上下文 |
| `L2安全能力` | `capability_ref` | 是 | 引用字段 | L2 能力上下文 |
| `安全关注点` / `序号` | `capability_focus_code` | 是 | 引用字段 | 能力关注点编码 |
| `关注点` | `capability_focus_title` | 是 | 引用字段 | 匹配校验和展示 |
| `关注点描述` | `capability_focus_description` | 否 | 说明字段 | 评分解释 |
| `作用域` | `scope_type` | 否 | 上下文字段 | 适用范围 |
| `技术服务` | `security_technical_service_name` | 否 | 技术输入字段 | 作用域安全技术服务 / 实践项，用于支持平台与工具评分 |
| `Level 1 非正式执行` | `level_criteria.L1` | 否 | 模型基准字段 | L1 专属描述 |
| `Level 2 / 计划跟踪` | `level_criteria.L2` | 否 | 模型基准字段 | L2 专属描述 |
| `Level 3/ 充分定义` | `level_criteria.L3` | 否 | 模型基准字段 | L3 专属描述 |
| `Level 4/ 量化控制` | `level_criteria.L4` | 否 | 模型基准字段 | L4 专属描述 |
| `Level 5 / 持续优化` | `level_criteria.L5` | 否 | 模型基准字段 | L5 专属描述 |

### 2.3 `评估表v2.md`

| Markdown 结构 | 标准字段 | 必填 | 字段类型 | 用途 |
|---|---|---|---|---|
| YAML `version` | `model_version` | 是 | 版本字段 | 模型版本 |
| YAML `changelog` | `version_note` | 否 | 说明字段 | 版本变更说明 |
| 三级标题 | `capability_category_ref` | 是 | 引用字段 | 能力分类上下文 |
| 四级标题 | `capability_domain_ref` | 是 | 引用字段 | L1 能力域上下文 |
| 五级标题编码 | `capability_code` | 是 | 引用字段 | L2 安全能力编码 |
| 五级标题名称 | `capability_title` | 是 | 引用字段 | L2 安全能力名称 |
| `能力描述` | `capability_description` | 是 | 说明字段 | L2 能力合并描述 |
| `L1` 到 `L5` 描述 | `level_criteria.L1` 到 `level_criteria.L5` | 是 | 模型基准字段 | L2 能力专属成熟度判定标准 |

V2 的 `criteria_granularity` 固定为 `capability`。它不替代 XLSX 中的关注点级基准，而是为 L2 能力直接评分提供更完整的判定口径。

## 3. 必填字段

### 3.1 模型基准字段

从新版样例导入模型基准时，建议必填：

| 标准字段 | 原因 |
|---|---|
| `source_file_id` | 保留来源追踪 |
| `source_sheet` | 保留来源 Sheet |
| `source_row` | 保留来源行号 |
| `row_type` | 区分关注点定义行和作用域实践行 |
| `capability_focus_code` | 匹配主工程能力关注点 |
| `capability_focus_title` | 展示和匹配校验 |

模型基准入库建议进入：

- `maturity_model_version`
- `maturity_level_definition`
- `maturity_capability_baseline`
- `maturity_scope_service_baseline`
- `maturity_mainline_match_result`

### 3.2 正式评分输入字段

新版样例没有评分输入。后续正式 `Score_Input` 建议必填：

| 标准字段 | 原因 |
|---|---|
| `project_id` | 绑定评估项目 |
| `row_id` | 便于人工沟通和追踪 |
| `assessment_object_type` | 标识评分对象是能力还是关注点 |
| `assessment_object_code` 或 `assessment_object_title` | 至少需要一个评估对象匹配依据 |
| `organization_role_score` | 直接评分字段 |
| `process_system_score` | 直接评分字段 |
| `platform_tool_score` | 直接评分字段 |
| `data_information_score` | 直接评分字段 |

项目级字段建议必填：

- `project_name`
- `customer_name`
- `assessment_date`
- `assessor`
- `assessment_scope`
- `template_version`
- `model_version`
- `rule_set_version`

## 4. 可选字段

| 标准字段 | 说明 |
|---|---|
| `industry` | 用于行业基准或报告展示 |
| `target_level` | 可项目级默认，也可逐项覆盖 |
| `scope_type` | 作为评估范围和筛选条件 |
| `security_technical_service_name` | 作为平台与工具维度的安全技术服务输入或证据 |
| `capability_focus_description` | 有助于报告解释，但可从主工程能力库补齐 |
| `level_criteria_json` | 若某关注点没有专属分级描述，可回退通用等级定义 |
| `current_state_summary` | 客户现状说明 |
| `evidence_summary` | 证据摘要 |
| `reviewer_note` | 匹配或评分人工审查时使用 |
| `importance_weight` | 后续差距优先级排序使用 |

## 5. 系统推导字段

| 字段 | 推导方式 |
|---|---|
| `row_hash` | 根据原始行 JSON 计算 |
| `row_type` | 根据 Sheet 名、关键字段和值判断 |
| `capability_focus_id` | 通过 `capability_focus_code` 匹配主工程能力库 |
| `capability_id` | 通过能力名称、父级 L1 和主工程关系推导 |
| `security_technical_service_input_id` | 通过 `scope_type + security_technical_service_name + capability_focus_code` 匹配主工程安全技术服务，作为平台与工具评分输入 |
| `scope_type_code` | 从 `scope_type` 或 `security_technical_service_name` 中解析 |
| `mainline_match_status` | 根据模型基准与主工程治理数据一致性核对结果生成 |
| `computed_score` | 根据四要素评分和规则计算，不能从新版样例读取 |
| `maturity_level` | 根据综合分数区间或等级规则计算 |
| `gap_score` | 目标分数减当前分数 |
| `knowledge_base_snapshot` | 读取主工程数据库或导出批次生成 |

## 6. 后续正式模板建议

正式客户评估模板不应直接照搬新版样例。建议设计为 7 个 Sheet：

| Sheet | 用途 | 说明 |
|---|---|---|
| `Assessment_Info` | 评估项目信息 | 补齐客户、项目、范围、版本字段 |
| `Score_Input` | 成熟度评分输入 | 一行代表一个客户评分输入项 |
| `Evidence_List` | 证据清单 | 记录文件、页码、章节、访谈记录和证据摘要 |
| `Manual_Adjustment` | 人工调整 | 记录匹配替换、评分覆盖和原因 |
| `Reference_Capabilities` | 能力参考 | 从主工程能力库生成，不手工维护 |
| `Reference_Level_Criteria` | 分级标准参考 | 从新版 `成熟度分级描述` 生成 |
| `Reference_L2_Capability_Criteria` | L2 能力分级标准参考 | 从 `评估表v2.md` 生成 |
| `Reference_Mainline_Diff` | 主线差异清单 | 从 `maturity_mainline_match_result` 生成，供人工确认 |
| `Readme` | 填写说明 | 来自 Word/PPT 方法论和工具说明 |

`Score_Input` 推荐字段：

| 字段 | 必填 | 说明 |
|---|---|---|
| `row_id` | 是 | 行编号 |
| `assessment_object_type` | 是 | `capability` / `capability_focus` |
| `assessment_object_code` | 强烈建议 | 评分对象编码 |
| `assessment_object_title` | 否 | 评分对象名称 |
| `capability_focus_code` | 强烈建议 | 能力关注点编码 |
| `capability_focus_title` | 否 | 能力关注点名称 |
| `scope_type` | 否 | 作用域 |
| `security_technical_service_name` | 否 | 平台与工具维度的安全技术服务输入 / 实践项 |
| `current_state_summary` | 否 | 客户现状说明 |
| `organization_role_score` | 是 | 1-5 |
| `process_system_score` | 是 | 1-5 |
| `platform_tool_score` | 是 | 1-5 |
| `data_information_score` | 是 | 1-5 |
| `evidence_summary` | 否 | 证据摘要 |
| `target_level` | 否 | 目标等级 |
| `importance_weight` | 否 | 重要性权重 |
| `assessor_note` | 否 | 评估人员备注 |

## 7. 不进入正式模板的样例结构

| 样例字段 / 结构 | 处理建议 |
|---|---|
| Excel 合并单元格结构 | 不用于正式模板，正式模板每行显式填充 |
| 关注点定义和作用域实践混排 | 正式模板拆成参考 Sheet，不让用户直接填写 |
| `Level 1` 到 `Level 5` 长文本 | 进入参考 Sheet 或帮助说明，不作为用户评分输入列 |
| 空白占位列 | 删除 |
