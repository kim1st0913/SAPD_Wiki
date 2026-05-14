# 第三批 LC-AP / LC-DT 数据契约与验收标准

状态：LC-AP 第一阶段契约已更新
最近更新：2026-05-14

本文档定义第三批生命周期 Sheet 的建模、ETL 和验收边界。当前重点是 `LC-AP 应用安全开发生命周期` 的数据契约；`LC-DT` 保留为后续数据生命周期维度输入。

本轮不补充 Google SLSA 内容，不启动前端实现，不修改 SQLite schema。

## 1. 第三批范围

| Sheet | 角色 | 当前处理策略 |
|---|---|---|
| `LC-AP 应用安全开发生命周期` | 应用安全开发阶段、IT L4 主要活动、安全活动、安全策略、软件开发模式适用性、关联安全技术服务、关联安全技术模块、开发类产品组件 | P0，本轮契约重点 |
| `LC-AP 应用安全开发生命周期元素目录` | 软件开发类型、应用系统类型、应用组件字典 | P0，作为安全开发维度字典 |
| `LC-DT 数据生命周期` | 数据生命周期过程，以及过程到安全技术服务、技术模块的映射 | 后置到数据生命周期维度 |
| `LC-DT 数据生命周期场景目录` | 数据生命周期过程下的场景清单 | 后置到数据生命周期维度 |

暂不处理：

- Google SLSA 补充内容；
- 标准/框架控制项 Sheet；
- 安全开发维度前端页面实现；
- 数据生命周期维度页面实现；
- 复杂图谱、AI 问答或语义检索。

## 2. LC-AP 业务对象契约

| type | 中文名 | 来源 | 稳定身份 | 说明 |
|---|---|---|---|---|
| `lifecycle_process` | 应用安全开发阶段 | `阶段（L3流程）` | `lifecycle_type + order + title` | 这里的 L3 是 IT 开发过程阶段，不是安全职能流程中的 L3 安全流程。 |
| `lifecycle_activity` | 阶段主要活动 | `阶段主要活动（L4流程活动）` | `lifecycle_process + activity_order + title` | IT L4 流程活动，随阶段展示，不单独作为知识来源维护。 |
| `security_activity` | 安全活动 | `安全活动定义` | `lifecycle_process + title` | 该阶段需考虑或执行的安全工作。`/` 映射为“无安全活动”，不生成安全活动对象。 |
| `security_policy_requirement` | 安全策略条目 | `安全活动对应安全策略` | `lifecycle_process + security_activity + sequence + text_hash` | 不是现有独立维护页；第一阶段在安全开发维度中跟随安全活动展示。 |
| `software_development_type` | 软件开发类型 | 元素目录；生命周期表黄色底色列 | `title` | 黄色底色表示该开发模式在该阶段适用。 |
| `security_technical_service` | 关联安全技术服务 | `开发技术服务`、`安全服务（带管理类）`、`安全技术服务` | 优先复用已有安全技术服务编码/名称 | LC-AP 不建立独立开发技术服务主数据。 |
| `security_technology_module` | 关联安全技术模块 | `安全技术模块` | 既有安全技术模块清单中的模块主数据 | 必须映射校验到既有 `安全技术模块清单`。无法匹配时输出数据问题。 |
| `development_product_component` | 开发类产品组件 | `实际产品示例` | `title`，必要时加 `lifecycle_process` 消歧 | 只在安全开发维度展示，不进入通用产品主数据，也不进入安全技术模块清单。 |
| `application_system_type` | 应用系统类型 | `LC-AP 应用安全开发生命周期元素目录` | `title` | 与软件开发类型没有映射关系。 |
| `application_component` | 应用组件 | `LC-AP 应用安全开发生命周期元素目录` | `application_system_type + title` | 应用系统类型 1:N 应用组件。 |

## 3. LC-AP 字段契约

### 3.1 `lifecycle_process`

| 字段 | 中文名 | 来源 | 必填 | 规则 |
|---|---|---|---:|---|
| `id` | 稳定 ID | 生成 | 是 | `lcap-stage-{order}` 或等价稳定规则。 |
| `lifecycle_type` | 生命周期类型 | 固定值 | 是 | `application_security_development`。 |
| `order` | 阶段顺序 | Sheet 行顺序 / 阶段序号 | 是 | 用于页面排序。 |
| `title` | 阶段名称 | `阶段（L3流程）` | 是 | 开发过程阶段名称。 |
| `goal` | 阶段目标 | `阶段目标` | 否 | 作为阶段说明展示。 |
| `main_activities` | 阶段主要活动 | `阶段主要活动（L4流程活动）` | 否 | 数组；不作为独立知识来源维护。 |
| `source_evidence` | 来源证据 | Sheet/row/column | 是 | 只进入来源证据区。 |

### 3.2 `security_activity`

| 字段 | 中文名 | 来源 | 必填 | 规则 |
|---|---|---|---:|---|
| `id` | 稳定 ID | 生成 | 是 | `lcap-activity-{stage_order}-{hash(title)}`。 |
| `title` | 安全活动名称 | `安全活动定义` | 是 | `/` 不生成对象，阶段显示“无安全活动”。 |
| `description` | 安全活动说明 | `安全活动定义` | 否 | 如名称和说明无法拆分，可同值。 |
| `stage_id` | 所属阶段 | `阶段（L3流程）` | 是 | 指向 `lifecycle_process.id`。 |
| `source_evidence` | 来源证据 | Sheet/row/column | 是 | 只进入来源证据区。 |

### 3.3 `security_policy_requirement`

中文显示名：安全策略条目。

| 字段 | 中文名 | 来源 | 必填 | 规则 |
|---|---|---|---:|---|
| `id` | 稳定 ID | 生成 | 是 | `lcap-policy-{stage_order}-{sequence}-{text_hash}`。 |
| `sequence` | 策略序号 | `安全活动对应安全策略` | 否 | 按编号拆分；无编号时生成稳定序号。 |
| `text` | 策略内容 | `安全活动对应安全策略` | 是 | 按编号列表拆成多条。 |
| `source_type` | 策略来源类型 | 固定/来源 | 是 | 当前为 `LC-AP`；后续 SLSA 为 `Google SLSA`。 |
| `stage_id` | 关联阶段 | `阶段（L3流程）` | 是 | 指向 `lifecycle_process.id`。 |
| `security_activity_id` | 关联安全活动 | `安全活动定义` | 否 | 如果该阶段无安全活动，可为空并直接挂阶段。 |
| `source_evidence` | 来源证据 | Sheet/row/column | 是 | 只进入来源证据区。 |

说明：

- 当前不做独立“安全策略条目”维护页。
- 可在专项知识维护预留入口，等后续补充 Google SLSA 内容时再启用。
- SLSA 本轮不补充，不作为当前 ETL 验收范围。

### 3.4 `software_development_type`

| 字段 | 中文名 | 来源 | 必填 | 规则 |
|---|---|---|---:|---|
| `id` | 稳定 ID | 生成 | 是 | `dev-type-{slug(title)}`。 |
| `title` | 软件开发类型 | 元素目录 / 生命周期表列名 | 是 | 如自研、定制、外购、SaaS。 |
| `description` | 类型说明 | 元素目录 | 否 | 作为字典说明。 |
| `source_evidence` | 来源证据 | Sheet/row/column | 是 | 只进入来源证据区。 |

黄色底色规则：

- 生命周期表中 4 个软件开发模式列需要读取单元格底色。
- 黄色 = 该软件开发模式在该阶段适用。
- 非黄色/空白 = 不生成适用关系。
- 后续前端可以用一列集中展示某阶段适用的软件开发模式。

### 3.5 `security_technical_service`

| 字段 | 中文名 | 来源 | 必填 | 规则 |
|---|---|---|---:|---|
| `id` | 服务 ID | 既有主数据 / 生成 | 是 | 优先匹配既有安全技术服务主数据。 |
| `name` | 服务名称 | 开发技术服务 / 安全服务 / 安全技术服务 | 是 | 复用安全技术服务对象类型。 |
| `service_category` | 服务分类 | 来源字段分区 | 是 | 仅 LC-AP 使用，取值 `管理类`、`开发类`、`网络空间类`。 |
| `source_evidence` | 来源证据 | Sheet/row/column | 是 | 只进入来源证据区。 |

分类规则：

- “安全服务（带管理类）”映射为 `管理类` 安全技术服务。
- `安全技术服务` 列中横线分割的上半部分映射为 `开发类` 安全技术服务。
- `安全技术服务` 列中横线分割的下半部分映射为 `网络空间类` 安全技术服务。
- 该 `service_category` 当前只在 LC-AP 表中使用，不要求污染全局安全技术服务主数据。

### 3.6 `security_technology_module`

| 字段 | 中文名 | 来源 | 必填 | 规则 |
|---|---|---|---:|---|
| `id` | 模块 ID | 既有主数据 | 是 | 必须匹配既有 `安全技术模块清单`。 |
| `name` | 安全技术模块 | `安全技术模块` | 是 | 不能静默新增为正式模块主数据。 |
| `validation_status` | 校验状态 | 映射结果 | 是 | `matched` 或 `unmatched`。 |
| `source_evidence` | 来源证据 | Sheet/row/column | 是 | 只进入来源证据区。 |

校验规则：

- 匹配成功：生成服务/阶段到安全技术模块的关系。
- 匹配失败：不生成正式模块关系；输出数据问题清单给用户检查原始表。
- 数据问题至少包含：来源 Sheet、行号、列、原始模块名称、所属阶段、关联服务、问题类型、建议动作。

### 3.7 `development_product_component`

| 字段 | 中文名 | 来源 | 必填 | 规则 |
|---|---|---|---:|---|
| `id` | 稳定 ID | 生成 | 是 | `dev-product-component-{hash(title)}`，必要时附加阶段消歧。 |
| `title` | 开发类产品组件 | `实际产品示例` | 是 | 原“实际产品示例”统一定义为开发类产品组件。 |
| `stage_id` | 关联阶段 | 阶段 | 否 | 可用于阶段详情展示。 |
| `service_id` | 关联服务 | 安全技术服务 | 否 | 仅在来源可可靠判断时生成。 |
| `source_evidence` | 来源证据 | Sheet/row/column | 是 | 只进入来源证据区。 |

边界：

- 不进入通用产品主数据。
- 不进入安全技术模块清单。
- 不作为安全技术模块。
- 第一阶段只在安全开发维度展示。

### 3.8 应用系统类型与应用组件

| type | 字段 | 中文名 | 来源 | 必填 | 规则 |
|---|---|---|---|---:|---|
| `application_system_type` | `title` | 应用系统类型 | 元素目录 | 是 | 标题唯一。 |
| `application_system_type` | `description` | 类型说明 | 元素目录 | 否 | 说明字段。 |
| `application_component` | `title` | 应用组件 | 元素目录 | 是 | 在所属应用系统类型下唯一。 |
| `application_component` | `system_type_id` | 所属应用系统类型 | 元素目录 | 是 | 空白行按原表层级继承。 |

页面口径：

- 软件开发类型与应用系统类型没有映射关系。
- 后续在同一个安全开发字典页面上下分别展示：
  - 上方：软件开发类型。
  - 下方：应用系统类型及应用组件。

## 4. 关系契约

| relation_type | 中文显示 | 起点 | 终点 | 来源 | 规则 |
|---|---|---|---|---|---|
| `has_activity` | 包含安全活动 | `lifecycle_process` | `security_activity` | LC-AP 主表 | 安全活动定义非 `/`。 |
| `has_main_activity` | 包含阶段主要活动 | `lifecycle_process` | `lifecycle_activity` | LC-AP 主表 | 阶段主要活动按行/换行拆分。 |
| `requires_policy` | 要求安全策略 | `security_activity` / `lifecycle_process` | `security_policy_requirement` | LC-AP 主表 | 有安全活动时挂安全活动；无安全活动时可挂阶段。 |
| `applies_to_development_type` | 适用于软件开发类型 | `lifecycle_process` | `software_development_type` | LC-AP 主表 | 对应开发模式列黄色底色。 |
| `uses_service` | 关联安全技术服务 | `lifecycle_process` / `security_activity` | `security_technical_service` | LC-AP 主表 | 按管理类、开发类、网络空间类拆分。 |
| `uses_module` | 关联安全技术模块 | `lifecycle_process` / `security_activity` / `security_technical_service` | `security_technology_module` | LC-AP 主表 | 仅在模块匹配既有主数据时生成。 |
| `uses_measure` | 关联安全技术措施 | `lifecycle_process` / `security_activity` / `security_technical_service` | `security_technical_measure` | LC-AP 主表 | 用户确认的实施措施不伪造成安全技术模块。 |
| `uses_development_product_component` | 关联开发类产品组件 | `lifecycle_process` / `security_technical_service` | `development_product_component` | LC-AP 主表 | 来源可可靠判断时生成；否则只挂阶段。 |
| `has_component` | 包含组件 | `application_system_type` | `application_component` | 元素目录 | 组件非空。 |

## 5. 解析与校验规则

| 规则 | 说明 |
|---|---|
| `fill_down` | 元素目录存在层级空白行时，应用系统类型需要向下继承。 |
| `split_lines` | 多行单元格按换行拆分。 |
| `split_numbered_list` | 安全活动对应安全策略按编号拆分为多条安全策略条目。 |
| `ignore_placeholder` | 空值不生成对象；安全活动定义 `/` 映射为“无安全活动”。 |
| `yellow_fill_as_applicability` | 软件开发模式列黄色底色表示适用关系。 |
| `red_fill_ignored` | 红色底色不作为 ETL 识别条件。 |
| `split_service_by_separator` | 安全技术服务列按横线分割为开发类与网络空间类服务。 |
| `classify_lcap_service` | LC-AP 服务分类为管理类、开发类、网络空间类。 |
| `match_existing_service` | 关联安全技术服务优先匹配既有服务主数据。 |
| `match_existing_module` | 关联安全技术模块必须匹配既有安全技术模块清单。 |
| `lcap_measure_override` | LC-AP 中用户确认的 `应用程序威胁建模`、`制品安全加固`、`IaC代码安全测试` 作为安全技术措施处理。 |
| `lcap_module_alias` | `软件成分分析` 归一到 `软件成分分析（SCA）`；`应用程序静态安全测试（安全函数和组件库）` 归一到 `应用程序静态安全测试`。 |
| `emit_module_unmatched_issue` | 模块无法匹配时输出数据问题，不静默新增主数据。 |
| `source_trace_required` | 每个对象和关系必须保留 Sheet、行号、列或单元格。 |

## 6. 问题输出契约

LC-AP ETL/export 至少应输出以下数据问题：

| issue_type | 触发条件 | 输出字段 |
|---|---|---|
| `lcap_unmatched_security_technology_module` | 安全技术模块无法匹配既有 `安全技术模块清单` | source_sheet、source_row、source_column、raw_module_name、stage_name、related_service_name、suggested_action |
| `lcap_unknown_service_category` | 服务无法归类为管理类、开发类、网络空间类 | source_sheet、source_row、source_column、raw_service_name、stage_name、suggested_action |
| `lcap_policy_parse_warning` | 安全策略条目无法按编号稳定拆分 | source_sheet、source_row、source_column、raw_value、stage_name、suggested_action |
| `lcap_missing_stage` | 行缺少阶段且无法继承 | source_sheet、source_row、suggested_action |
| `lcap_duplicate_policy_identity` | 同阶段同安全活动下策略稳定身份冲突 | stage_name、security_activity_name、sequence、text_hash、source_rows |

建议输出位置：

- `data/exports/worker-verify/lcap-data-contract-issues.csv`
- 后续如进入 open issue，再汇总到 `docs/06-implementation/open-issues.md`。

## 7. lifecycle-knowledge.json 建议结构

后续如生成 `frontend/capability-browser/public/data/lifecycle-knowledge.json`，建议第一阶段结构如下：

```json
{
  "application_security_development": {
    "processes": [],
    "main_activities": [],
    "security_activities": [],
    "security_policy_requirements": [],
    "software_development_types": [],
    "security_technical_services": [],
    "security_technology_modules": [],
    "security_technical_measures": [],
    "development_product_components": [],
    "application_system_types": [],
    "application_components": [],
    "relations": [],
    "issues": []
  },
  "data_lifecycle": {
    "processes": [],
    "scenes": [],
    "relations": [],
    "issues": []
  }
}
```

注意：

- 本轮只定义契约，不生成正式文件。
- SLSA 暂不进入当前结构，后续作为补充安全策略来源扩展。
- 非业务来源字段不得进入主展示对象顶层；只能进入 `sources` 或 `source_evidence`。

## 8. 前端边界

后续前端实现应遵守：

- 安全开发维度页面展示 LC-AP 阶段、主要活动、安全活动、安全策略条目、软件开发模式适用性、关联服务、模块、开发类产品组件。
- 软件开发类型与应用系统类型/组件在同一页面上下分区展示，不建立映射。
- 安全策略条目第一阶段不做独立维护页；只可预留入口。
- 开发类产品组件只在安全开发维度展示。
- 模块未匹配问题不在前端静默吞掉，应能通过问题清单或校验区看到。

## 9. 验收标准

| 编号 | 验收点 | 标准 |
|---|---|---|
| LCAP-ETL-001 | 识别 2 张 LC-AP Sheet | 缺 Sheet 时输出明确 validation。 |
| LCAP-ETL-002 | 阶段对象 | 至少生成 8 个 `application_security_development` 阶段。 |
| LCAP-ETL-003 | 主要活动 | 阶段主要活动按数组或独立 `lifecycle_activity` 输出。 |
| LCAP-ETL-004 | 安全活动 | `/` 映射为“无安全活动”，不生成空对象。 |
| LCAP-ETL-005 | 安全策略条目 | 按编号拆分为可单独展示的 `security_policy_requirement`。 |
| LCAP-ETL-006 | 软件开发模式 | 黄色底色生成适用关系。 |
| LCAP-ETL-007 | 服务分类 | 管理类、开发类、网络空间类分类可区分。 |
| LCAP-ETL-008 | 模块校验 | 模块必须匹配既有安全技术模块清单；未匹配输出数据问题。 |
| LCAP-ETL-009 | 开发类产品组件 | 实际产品示例输出为开发类产品组件，不进入通用产品主数据。 |
| LCAP-ETL-010 | 元素目录 | 软件开发类型和应用系统类型/组件可上下分区展示。 |
| LCAP-ETL-011 | 来源追踪 | 对象和关系均可追溯到 Sheet 和行号。 |
| LCAP-EXP-001 | 导出边界 | 如生成 `lifecycle-knowledge.json`，结构符合第 7 节。 |

## 10. 后续 Agent 分工建议

本轮不启动 Agent。后续进入实现时再按以下边界拆分：

| 角色 | 责任 | 写入范围 |
|---|---|---|
| ETL Worker | 实现 LC-AP parser、底色识别、服务分类、模块校验、问题输出 | `src/sapd_wiki/`、`data/exports/worker-verify/` |
| Export Worker | 生成或刷新 `lifecycle-knowledge.json`，验证静态 JSON 合法性 | `frontend/capability-browser/public/data/`、验证输出 |
| Frontend Worker | 在契约稳定后实现安全开发维度页面 | `frontend/capability-browser/` |

所有 Worker 均不得启动子 Agent，完成后必须由主控 fan-in。
