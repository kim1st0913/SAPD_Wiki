# API 字段级接口契约

本文档定义 SAPD Wiki 前后端分离后的字段级接口契约。它面向后续前端 UI 集成、后端接口实现、静态 JSON 导出和数据校验。

当前阶段仍以静态 JSON 作为 MVP 接口实现；未来改为本地 `/api/v1/*` API 时，应尽量保持本文档字段语义不变。

## 1. 契约原则

| 原则 | 说明 |
|---|---|
| 后端给事实 | 前端只消费后端给出的对象、关系、统计和缺失状态 |
| 前端不推断关系 | 前端不从原始 Sheet 字段自行拼装业务关系 |
| 来源默认隐藏 | 来源字段保留在数据中，但默认 UI 不展示 |
| 字段稳定优先 | 字段新增可以，字段改名或删除必须先更新本文档 |
| 空值显式表达 | 缺失 L4 活动等业务缺口用状态字段表达，前端显示 `待补充` |
| 静态与 API 同构 | 当前 `public/data/*.json` 是未来 API 的离线实现 |

## 2. 命名与类型约定

### 2.1 基础类型

| 类型 | 含义 | 示例 |
|---|---|---|
| `string` | 字符串 | `"T-AS.IA-01"` |
| `number` | 数值 | `91` |
| `boolean` | 布尔值 | `true` |
| `datetime` | ISO 8601 时间字符串 | `"2026-05-12T10:00:00+08:00"` |
| `array<T>` | 数组 | `[]` |
| `object` | 对象 | `{}` |
| `null` | 空值 | `null` |

### 2.2 字段规则

| 字段 | 规则 |
|---|---|
| `id` | 系统内部稳定 ID，前端用作选择、展开、行 key |
| `type` | 知识对象类型，如 `capability_focus` |
| `code` | 业务编码，可为空 |
| `title` | 业务名称，前端主显示字段 |
| `description` | 描述，可为空 |
| `category` | 业务分类，可为空 |
| `status` | 数据状态，默认只向前端输出 `active` |
| `metadata` | 仍在演化的扩展字段 |
| `sources` | 来源证据，默认 UI 不展示 |
| `generated_at` | 导出时间或接口生成时间 |

## 3. 通用响应结构

### 3.1 API 响应包

未来本地 API 推荐统一使用响应包。当前静态 JSON 可暂时不包 `meta/data`，但字段语义保持一致。

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `meta.version` | string | 是 | 接口版本，默认 `v1` |
| `meta.generated_at` | datetime | 是 | 响应生成时间 |
| `meta.data_version` | string | 否 | 对应导入任务或导出批次 |
| `meta.warnings_count` | number | 是 | 当前响应包含的警告数量 |
| `data` | object/array | 是 | 业务数据 |
| `warnings` | array<ValidationIssue> | 是 | 非阻断问题 |

示例：

```json
{
  "meta": {
    "version": "v1",
    "generated_at": "2026-05-12T10:00:00+08:00",
    "data_version": "7ac14b99-3827-46e1-9e3b-aa557ed637b7",
    "warnings_count": 0
  },
  "data": {},
  "warnings": []
}
```

### 3.2 错误响应

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `error.code` | string | 是 | 机器可读错误码 |
| `error.message` | string | 是 | 用户可读错误说明 |
| `error.details` | array<object> | 否 | 具体错误明细 |

常见错误码：

| code | 说明 |
|---|---|
| `SOURCE_FILE_NOT_FOUND` | 来源文件不存在 |
| `WORKBOOK_OPEN_FAILED` | Excel 打开失败 |
| `SHEET_MISSING` | 必要 Sheet 缺失 |
| `VALIDATION_FAILED` | 校验失败 |
| `DUPLICATE_MASTER_DATA` | 主数据重复 |
| `RELATION_TARGET_MISSING` | 关系目标缺失 |
| `IMPORT_JOB_NOT_FOUND` | 导入任务不存在 |
| `EXPORT_JOB_NOT_FOUND` | 导出任务不存在 |

## 4. 通用对象字段

### 4.1 KnowledgeObjectRef

所有知识对象引用都应遵守这个最小结构。

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `id` | string | 是 | 系统 ID |
| `type` | string | 是 | 对象类型 |
| `code` | string/null | 否 | 业务编码 |
| `title` | string | 是 | 名称 |
| `description` | string/null | 否 | 描述 |
| `category` | string/null | 否 | 分类 |
| `status` | string | 否 | `active`、`deprecated` 等 |
| `metadata` | object | 否 | 扩展字段 |
| `sources` | array<SourceReference> | 否 | 来源证据 |

### 4.2 SourceReference

来源字段默认用于审计和排查，前端普通页面不展示。

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `sheet` | string | 否 | Excel Sheet 名 |
| `row` | number | 否 | 原始行号 |
| `column` | string | 否 | 原始列名或列号 |
| `cell` | string | 否 | 原始单元格 |
| `raw_value` | string/null | 否 | 原始值 |

### 4.3 ValidationIssue

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `id` | string | 是 | 问题 ID，如 `OI-029` 或校验报告 ID |
| `severity` | string | 是 | `error`、`warning`、`info` |
| `type` | string | 是 | 问题类型 |
| `object_type` | string/null | 否 | 涉及对象类型 |
| `object_id` | string/null | 否 | 涉及对象 ID |
| `message` | string | 是 | 问题说明 |
| `suggested_action` | string/null | 否 | 建议处理方式 |
| `status` | string | 是 | `open`、`fixed`、`accepted`、`ignored` |

### 4.4 Stats

统计字段按接口不同而变化，但命名规则统一。

| 字段形式 | 类型 | 说明 |
|---|---|---|
| `*_count` | number | 某类对象或关系数量 |
| `stats.<name>` | number | 页面级统计 |
| `warnings_count` | number | 警告数量 |
| `issue_count` | number | 问题数量 |

## 5. 当前静态 JSON 文件映射

| 静态文件 | 对应未来接口 | 用途 |
|---|---|---|
| `capability-tree.json` | `/api/v1/capabilities/tree`、`/api/v1/capabilities/matrix` | 能力树、关注点、服务、作用域、流程、职能关系 |
| `management-knowledge.json` | `/api/v1/environments/*`、`/api/v1/maintenance/*`、`/api/v1/references/*` | 信息化环境、作用域、流程、职能、模块、标准、岗位 |
| `lifecycle-knowledge.json` | `/api/v1/lifecycle/application`、`/api/v1/lifecycle/data` | 安全开发生命周期、数据生命周期 |
| `content-views.json` | `/api/v1/content/*` | HTML、Draw.io、PPT 使用说明 |

## 6. 系统状态接口

### 6.1 `GET /api/v1/health`

用途：检查本地后端服务是否可用。

返回字段：

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `status` | string | 是 | `ok`、`degraded`、`error` |
| `app` | string | 是 | 应用名，默认 `SAPD Wiki` |
| `version` | string | 否 | 应用版本 |
| `database_path` | string | 否 | 当前数据库路径，前端普通页面不展示 |
| `database_ready` | boolean | 是 | 数据库是否可访问 |
| `generated_data_ready` | boolean | 是 | 前端 JSON 是否可访问 |
| `checked_at` | datetime | 是 | 检查时间 |

### 6.2 `GET /api/v1/catalog/summary`

用途：全局数据摘要。

返回字段：

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `source_files` | number | 是 | 来源文件数量 |
| `import_jobs` | number | 是 | 导入任务数量 |
| `knowledge_items` | number | 是 | active 知识对象数量 |
| `knowledge_relations` | number | 是 | active 关系数量 |
| `open_issues` | number | 是 | 未关闭问题数量 |
| `last_import_job_id` | string/null | 否 | 最近一次导入任务 |
| `last_import_at` | datetime/null | 否 | 最近导入时间 |
| `last_export_at` | datetime/null | 否 | 最近导出时间 |
| `data_packages` | array<object> | 是 | 当前可用前端数据包 |

`data_packages[]` 字段：

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `name` | string | 是 | 数据包名称 |
| `path` | string | 是 | 静态文件路径 |
| `generated_at` | datetime/string | 否 | 生成时间 |
| `size_bytes` | number | 否 | 文件大小 |
| `stats` | object | 否 | 数据包统计 |

## 7. 能力维度接口

### 7.1 `GET /api/v1/capabilities/tree`

当前静态文件：`capability-tree.json`

用途：提供能力分类、L1、L2、关注点树，以及关注点关联的服务、作用域、流程、职能。

顶层字段：

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `generated_at` | datetime/string | 是 | 数据生成时间 |
| `stats` | object | 是 | 能力维度统计 |
| `categories` | array<CapabilityCategory> | 是 | 能力分类列表 |
| `unlinked_focuses` | array<CapabilityFocus> | 是 | 未挂接关注点，正常应为空 |

`stats` 字段：

| 字段 | 类型 | 说明 |
|---|---|---|
| `categories` | number | 能力分类数量 |
| `domains` | number | L1 能力域数量 |
| `capabilities` | number | L2 能力数量 |
| `focuses` | number | 能力关注点数量 |
| `services` | number | 安全技术服务数量 |
| `focus_scope_mappings` | number | 关注点-作用域映射数量 |
| `unlinked_focuses` | number | 未挂接关注点数量 |

`CapabilityCategory` 字段：

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `id` | string | 是 | 分类 ID |
| `type` | string | 是 | `capability_category` |
| `code` | string/null | 否 | 分类编码 |
| `title` | string | 是 | 分类名称 |
| `description` | string/null | 否 | 描述 |
| `category` | string/null | 否 | 上级分类文本 |
| `status` | string | 否 | 数据状态 |
| `metadata` | object | 否 | 扩展字段，含 `tree_order` 等 |
| `sources` | array<SourceReference> | 否 | 来源 |
| `domains` | array<CapabilityDomain> | 是 | L1 能力域 |
| `domain_count` | number | 是 | L1 数量 |
| `capability_count` | number | 是 | L2 数量 |
| `focus_count` | number | 是 | 关注点数量 |
| `service_count` | number | 是 | 服务数量 |

`CapabilityDomain` 字段：

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `id` | string | 是 | L1 ID |
| `type` | string | 是 | `capability_domain` |
| `code` | string/null | 否 | L1 编码 |
| `title` | string | 是 | L1 名称 |
| `description` | string/null | 否 | 描述 |
| `category` | string/null | 否 | 分类 |
| `status` | string | 否 | 数据状态 |
| `metadata` | object | 否 | 扩展字段 |
| `sources` | array<SourceReference> | 否 | 来源 |
| `capabilities` | array<Capability> | 是 | L2 能力 |
| `capability_count` | number | 是 | L2 数量 |
| `focus_count` | number | 是 | 关注点数量 |
| `service_count` | number | 是 | 服务数量 |

`Capability` 字段：

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `id` | string | 是 | L2 ID |
| `type` | string | 是 | `capability` |
| `code` | string/null | 否 | L2 编码 |
| `title` | string | 是 | L2 名称 |
| `description` | string/null | 否 | 描述 |
| `category` | string/null | 否 | 分类 |
| `status` | string | 否 | 数据状态 |
| `metadata` | object | 否 | 扩展字段 |
| `sources` | array<SourceReference> | 否 | 来源 |
| `focuses` | array<CapabilityFocus> | 是 | 关注点 |
| `focus_count` | number | 是 | 关注点数量 |
| `service_count` | number | 是 | 服务数量 |

`CapabilityFocus` 字段：

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `id` | string | 是 | 关注点 ID |
| `type` | string | 是 | `capability_focus` |
| `code` | string | 是 | 关注点编码 |
| `title` | string | 是 | 关注点名称 |
| `description` | string/null | 否 | 关注点描述 |
| `category` | string/null | 否 | 分类 |
| `status` | string | 否 | 数据状态 |
| `metadata` | object | 否 | 扩展字段 |
| `sources` | array<SourceReference> | 否 | 来源 |
| `services` | array<SecurityTechnicalService> | 是 | 关联安全技术服务 |
| `service_count` | number | 是 | 服务数量 |
| `scope_mappings` | array<FocusScopeMapping> | 是 | 关注点-作用域映射 |
| `scope_count` | number | 是 | 作用域数量 |
| `security_works` | array<KnowledgeObjectRef> | 是 | 安全工作 |
| `process_mappings` | array<ProcessMapping> | 是 | 流程与职能映射 |

`SecurityTechnicalService` 字段：

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `id` | string | 是 | 服务 ID |
| `type` | string | 是 | `security_technical_service` |
| `code` | string | 是 | 服务编码，按当前规则全局唯一 |
| `title` | string | 是 | 标准服务名称，权威来源为 `安全能力-安全技术服务` |
| `description` | string/null | 否 | 描述 |
| `category` | string/null | 否 | 分类 |
| `status` | string | 否 | 数据状态 |
| `metadata` | object | 否 | 扩展字段 |
| `sources` | array<SourceReference> | 否 | 来源 |
| `scopes` | array<ScopeType> | 是 | 适用作用域 |

`ScopeType` 字段：

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `id` | string | 是 | 作用域 ID |
| `type` | string | 是 | `scope_type` |
| `code` | string/null | 否 | 作用域编码或类型 |
| `title` | string | 是 | 作用域名称 |
| `description` | string/null | 否 | 作用域描述 |
| `category` | string/null | 否 | 分类 |
| `scenario` | string/null | 否 | 情景；空值前端显示为 `网络空间` |
| `sources` | array<SourceReference> | 否 | 来源 |

`FocusScopeMapping` 字段：

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `scope` | ScopeType | 是 | 作用域 |
| `services` | array<SecurityTechnicalService> | 是 | 在该作用域下的服务 |
| `service_count` | number | 是 | 服务数量 |
| `sources` | array<SourceReference> | 否 | 来源 |

`ProcessMapping` 字段：

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `process_group` | KnowledgeObjectRef | 是 | L2 流程组 |
| `process_reference` | ProcessReference | 是 | L3 流程参考 |
| `activities` | array<ProcessActivity> | 是 | L4 关键活动，当前可为空 |
| `missing_activity` | boolean | 是 | 是否缺少 L4 活动 |
| `activity_status` | string | 是 | `missing`、`available` 等 |
| `activity_status_label` | string | 是 | 前端显示值，如 `待补充` |
| `stakeholders` | object | 是 | 按职能层级分组的相关方 |
| `sources` | array<SourceReference> | 否 | 来源 |

`stakeholders` 对象字段：

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `<职能层级名称>` | array<WorkFunction> | 否 | 如 `网络安全决策层`、`网络安全管理层`、`网络安全执行层`、`网络安全监督层` |

### 7.2 `GET /api/v1/capabilities/matrix`

用途：前端能力关系矩阵的后端投影。当前前端仍可由 `capability-tree.json` 计算；后续建议由后端直接输出。

查询参数：

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `capability_id` | string | 否 | 能力分类、L1、L2 或关注点 ID |
| `q` | string | 否 | 搜索关键字 |
| `scope_id` | string | 否 | 作用域过滤 |
| `service_id` | string | 否 | 服务过滤 |

返回字段：

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `selected` | KnowledgeObjectRef/null | 否 | 当前选中节点 |
| `rows` | array<CapabilityMatrixRow> | 是 | 矩阵行 |
| `stats` | object | 是 | 统计 |

`CapabilityMatrixRow` 字段：

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `focus` | CapabilityFocus | 是 | 能力关注点 |
| `services` | array<SecurityTechnicalService> | 是 | 安全技术服务 |
| `scopes` | array<ScopeType> | 是 | 作用域 |
| `process_groups` | array<KnowledgeObjectRef> | 是 | L2 流程组 |
| `process_references` | array<ProcessReference> | 是 | L3 流程 |
| `activities` | array<ProcessActivity> | 是 | L4 关键活动 |
| `has_missing_activity` | boolean | 是 | 是否存在缺失 L4 |
| `stakeholders` | array<WorkFunctionWithLayer> | 是 | 组织职能相关方 |
| `modules` | array<SecurityTechnologyModule> | 是 | 技术模块 |
| `systems_products` | array<KnowledgeObjectRef> | 是 | 安全系统或产品 |

### 7.3 `GET /api/v1/capabilities/{id}/relationships`

用途：右侧详情面板或关系链。

返回字段：

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `object` | KnowledgeObjectRef | 是 | 当前对象 |
| `path` | object | 是 | 所属能力路径 |
| `relationships` | object | 是 | 各类关系集合 |
| `warnings` | array<ValidationIssue> | 是 | 当前对象相关问题 |

`path` 字段：

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `category` | KnowledgeObjectRef/null | 否 | 能力分类 |
| `domain` | KnowledgeObjectRef/null | 否 | L1 能力域 |
| `capability` | KnowledgeObjectRef/null | 否 | L2 能力 |
| `focus` | KnowledgeObjectRef/null | 否 | 关注点 |

`relationships` 字段：

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `services` | array<SecurityTechnicalService> | 是 | 关联服务 |
| `scopes` | array<ScopeType> | 是 | 关联作用域 |
| `process_groups` | array<KnowledgeObjectRef> | 是 | L2 流程组 |
| `process_references` | array<ProcessReference> | 是 | L3 流程 |
| `activities` | array<ProcessActivity> | 是 | L4 活动 |
| `stakeholders` | array<WorkFunctionWithLayer> | 是 | 相关职能 |
| `modules` | array<SecurityTechnologyModule> | 是 | 技术模块 |
| `systems` | array<KnowledgeObjectRef> | 是 | 安全系统 |
| `products` | array<KnowledgeObjectRef> | 是 | 产品 |

## 8. 信息化环境维度接口

### 8.1 `GET /api/v1/environments/tree`

当前静态文件：`management-knowledge.json` 的 `environment_scope_tree`

用途：提供信息化环境、信息化对象、作用域、服务、模块、系统/产品连续映射。

返回字段：

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `generated_at` | datetime/string | 是 | 数据生成时间 |
| `stats` | object | 是 | 信息化环境统计 |
| `environments` | array<InformationEnvironment> | 是 | 信息化环境列表 |

`InformationEnvironment` 字段：

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `id` | string | 是 | 环境 ID |
| `type` | string | 是 | `information_environment` |
| `code` | string/null | 否 | 编码 |
| `title` | string | 是 | 环境名称 |
| `description` | string/null | 否 | 描述 |
| `category` | string/null | 否 | 分类 |
| `sources` | array<SourceReference> | 否 | 来源 |
| `objects` | array<InformationObjectContext> | 是 | 环境下对象上下文 |
| `object_count` | number | 是 | 对象上下文数量 |
| `scope_mapping_count` | number | 是 | 作用域映射数量 |
| `service_count` | number | 是 | 服务数量 |
| `module_count` | number | 是 | 模块数量 |

`InformationObjectContext` 字段：

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `id` | string | 是 | 信息化对象主数据 ID |
| `type` | string | 是 | `information_object` |
| `code` | string/null | 否 | 编码 |
| `title` | string | 是 | 信息化对象名称 |
| `description` | string/null | 否 | 描述 |
| `category` | string/null | 否 | 分类 |
| `segments` | array<string> | 是 | 环境分段/子类上下文 |
| `sources` | array<SourceReference> | 否 | 来源 |
| `scope_mappings` | array<EnvironmentScopeMapping> | 是 | 作用域映射 |
| `scope_count` | number | 是 | 作用域数量 |
| `service_count` | number | 是 | 服务数量 |
| `module_count` | number | 是 | 模块数量 |

`EnvironmentScopeMapping` 字段：

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `scope` | ScopeType | 是 | 作用域 |
| `services` | array<EnvironmentService> | 是 | 服务 |
| `service_count` | number | 是 | 服务数量 |
| `module_count` | number | 是 | 模块数量 |
| `sources` | array<SourceReference> | 否 | 来源 |

`EnvironmentService` 字段：

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `id` | string | 是 | 服务 ID |
| `type` | string | 是 | `security_technical_service` |
| `code` | string | 是 | 服务编码 |
| `title` | string | 是 | 服务名称 |
| `description` | string/null | 否 | 描述 |
| `modules` | array<SecurityTechnologyModule> | 是 | 对应模块 |
| `sources` | array<SourceReference> | 否 | 来源 |

### 8.2 `GET /api/v1/environments/matrix`

用途：环境对象到作用域、服务、模块、系统/产品的扁平矩阵。

查询参数：

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `environment_id` | string | 否 | 环境过滤 |
| `object_id` | string | 否 | 信息化对象过滤 |
| `scope_id` | string | 否 | 作用域过滤 |
| `q` | string | 否 | 搜索关键字 |

`EnvironmentMatrixRow` 字段：

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `environment` | KnowledgeObjectRef | 是 | 信息化环境 |
| `segments` | array<string> | 是 | 环境分段 |
| `information_object` | KnowledgeObjectRef | 是 | 信息化对象 |
| `scope` | ScopeType | 是 | 作用域 |
| `services` | array<SecurityTechnicalService> | 是 | 服务 |
| `modules` | array<SecurityTechnologyModule> | 是 | 模块 |
| `systems` | array<KnowledgeObjectRef> | 是 | 安全系统 |
| `products` | array<KnowledgeObjectRef> | 是 | 产品 |

## 9. 专项知识维护接口

### 9.1 `GET /api/v1/maintenance/scopes`

当前静态字段：`management-knowledge.json.scope_types`

用途：安全能力作用域目录和作用域名目录。

`ScopeMaintenanceItem` 字段：

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `id` | string | 是 | 作用域 ID |
| `type` | string | 是 | `scope_type` |
| `code` | string/null | 否 | 作用域编码或类型 |
| `title` | string | 是 | 作用域名称 |
| `description` | string/null | 否 | 描述 |
| `category` | string/null | 否 | 分类 |
| `scenario` | string/null | 否 | 情景，空值前端显示 `网络空间` |
| `services` | array<SecurityTechnicalService> | 是 | 关联服务 |
| `information_objects` | array<KnowledgeObjectRef> | 是 | 关联信息化对象 |
| `sources` | array<SourceReference> | 否 | 来源，默认隐藏 |

### 9.2 `GET /api/v1/maintenance/processes`

当前静态字段：`management-knowledge.json.security_processes`

用途：安全职能流程清单，以流程域、流程组、L3 流程参考、L4 活动组织。

`ProcessDomain` 字段：

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `id` | string | 是 | 流程域 ID |
| `code` | string/null | 否 | 编码 |
| `title` | string | 是 | 流程域名称 |
| `description` | string/null | 否 | 描述 |
| `category` | string/null | 否 | 分类 |
| `sources` | array<SourceReference> | 否 | 来源 |
| `groups` | array<ProcessGroup> | 是 | L2 流程组 |

`ProcessGroup` 字段：

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `id` | string | 是 | 流程组 ID |
| `code` | string/null | 否 | 编码 |
| `title` | string | 是 | 流程组名称 |
| `description` | string/null | 否 | 描述 |
| `sources` | array<SourceReference> | 否 | 来源 |
| `references` | array<ProcessReference> | 是 | L3 流程参考 |

`ProcessReference` 字段：

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `id` | string | 是 | L3 流程 ID |
| `type` | string | 是 | `process_reference` |
| `code` | string/null | 否 | 编码 |
| `title` | string | 是 | L3 流程名称 |
| `description` | string/null | 否 | 描述 |
| `capability_focus_code` | string/null | 否 | 关联关注点编码 |
| `activities` | array<ProcessActivity> | 是 | L4 活动 |
| `missing_activity` | boolean | 是 | 是否缺失 L4 |
| `activity_status` | string | 是 | L4 状态 |
| `activity_status_label` | string | 是 | 前端显示，如 `待补充` |
| `stakeholders` | object | 是 | 职能相关方 |
| `sources` | array<SourceReference> | 否 | 来源 |

`ProcessActivity` 字段：

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `id` | string | 是 | L4 活动 ID |
| `type` | string | 是 | `process_activity` |
| `code` | string/null | 否 | 编码 |
| `title` | string | 是 | 活动名称 |
| `description` | string/null | 否 | 描述 |
| `status` | string | 否 | 数据状态 |

### 9.3 `GET /api/v1/maintenance/work-functions`

当前静态字段：`management-knowledge.json.work_function_layers`

用途：安全工作职能清单，按决策层、管理层、执行层、监督层展示。

`WorkFunctionLayer` 字段：

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `id` | string | 是 | 职能层 ID |
| `title` | string | 是 | 职能层名称 |
| `groups` | array<WorkFunctionGroup> | 是 | 职能组 |

`WorkFunctionGroup` 字段：

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `id` | string | 是 | 职能组 ID |
| `title` | string | 是 | 职能组名称 |
| `functions` | array<WorkFunction> | 是 | 职能列表 |

`WorkFunction` 字段：

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `id` | string | 是 | 职能 ID |
| `type` | string | 是 | `work_function` |
| `code` | string/null | 否 | 编码 |
| `title` | string | 是 | 职能名称 |
| `description` | string/null | 否 | 描述 |
| `category` | string/null | 否 | 分类 |
| `tasks` | array<string/object> | 是 | 工作任务 |
| `gbt_42446_refs` | array<StandardReference> | 是 | GB/T 42446-2023 引用 |
| `sources` | array<SourceReference> | 否 | 来源 |

`WorkFunctionWithLayer` 额外字段：

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `layer` | string | 是 | 所属职能层名称 |
| `group` | string/null | 否 | 所属职能组名称 |

### 9.4 `GET /api/v1/maintenance/technology-modules`

当前静态字段：`management-knowledge.json.security_technology_modules`

用途：安全技术模块清单。

`SecurityTechnologyModule` 字段：

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `id` | string | 是 | 模块 ID |
| `type` | string | 是 | `security_technology_module` |
| `code` | string/null | 否 | 模块编码 |
| `title` | string | 是 | 模块名称 |
| `description` | string/null | 否 | 模块描述 |
| `category` | string/null | 否 | 分类 |
| `services` | array<SecurityTechnicalService> | 是 | 实现的服务 |
| `systems` | array<KnowledgeObjectRef> | 是 | 所属安全系统 |
| `products` | array<KnowledgeObjectRef> | 是 | 对应产品 |
| `environments` | array<KnowledgeObjectRef> | 是 | 适用环境 |
| `sources` | array<SourceReference> | 否 | 来源 |

### 9.5 `GET /api/v1/maintenance/technical-measures`

当前静态字段：`management-knowledge.json.security_technical_measures`

用途：安全技术措施清单。主对象是“安全技术措施”，不同于 `security_technology_modules`。安全技术模块偏能力构件或技术模块，安全技术措施偏具体控制措施、实施措施或技术措施。

当前前端主展示列：

1. 序号：前端按当前排序生成，不使用后端 `id`。
2. 安全技术措施：来自 `name`。
3. 关联安全技术服务：来自 `related_service_names`。
4. 适用作用域：来自 `related_scope_names`。
5. 关联信息化环境：来自 `related_environment_names`。
6. 关联信息化对象：来自 `related_environment_object_names`。

`SecurityTechnicalMeasure` 字段：

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `id` | string | 是 | 稳定 ID |
| `type` | string | 否 | 建议为 `security_technical_measure` |
| `name` | string | 是 | 安全技术措施名称，主显示字段，不得为空 |
| `category` | string/null | 否 | 措施分类；无法可靠获得时为 null 或 `待补充`，不得编造 |
| `related_service_ids` | array<string> | 是 | 关联安全技术服务 ID，支持 1:N / N:M |
| `related_service_names` | array<string> | 是 | 关联安全技术服务名称，支持 1:N / N:M |
| `related_scope_ids` | array<string> | 是 | 适用作用域 ID，支持 1:N / N:M |
| `related_scope_names` | array<string> | 是 | 适用作用域名称，支持 1:N / N:M |
| `related_environment_names` | array<string> | 是 | 关联信息化环境名称，支持 1:N / N:M；无法可靠推导时为空数组 |
| `related_environment_object_names` | array<string> | 是 | 关联信息化对象名称，支持 1:N / N:M；无法可靠推导时为空数组 |
| `related_module_ids` | array<string> | 否 | 关联安全技术模块 ID；仅在可靠映射时输出 |
| `related_module_names` | array<string> | 否 | 关联安全技术模块名称；仅在可靠映射时输出 |
| `related_capability_focus_ids` | array<string> | 否 | 关联能力关注点 ID；仅在可靠映射时输出 |
| `related_capability_focus_names` | array<string> | 否 | 关联能力关注点名称；仅在可靠映射时输出 |
| `status` | string/null | 否 | `normal`、`pending`、`missing` 或说明类状态 |
| `sources` | array<SourceReference> | 否 | 来源证据，仅用于 SourceEvidencePanel 或来源证据区，默认折叠 |

字段边界：

- `security_technical_measures` 位于 `management-knowledge.json` 顶层。
- 后端不得把安全技术模块直接当作安全技术措施返回。
- 后端不得把安全系统或产品当作安全技术措施返回。
- `related_service_names`、`related_scope_names`、`related_environment_names`、`related_environment_object_names` 都必须按数组保留多值关系，不得压成单值。
- `sources` 只用于来源证据，默认折叠，不进入主表列、概览区或筛选主维度。
- `sheet`、`row`、`column`、`raw_value`、`source_file`、`import_id`、`source_id`、`generated_at` 等非业务字段不得进入主展示区。

### 9.6 `GET /api/v1/maintenance/service-module-index`

当前静态字段：`management-knowledge.json.service_module_index`

用途：服务到模块、系统、产品的索引。

`ServiceModuleIndexItem` 字段：

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `service` | SecurityTechnicalService | 是 | 安全技术服务 |
| `modules` | array<SecurityTechnologyModule> | 是 | 对应模块 |
| `scopes` | array<ScopeType> | 是 | 作用域 |
| `sources` | array<SourceReference> | 否 | 来源 |
| `module_count` | number | 是 | 模块数量 |
| `system_count` | number | 是 | 系统数量 |
| `product_count` | number | 是 | 产品数量 |
| `environment_count` | number | 是 | 环境数量 |

## 10. 标准与岗位参考接口

### 10.1 `GET /api/v1/references/standards`

当前静态字段：`management-knowledge.json.gbt_42446_references`

`StandardReference` 字段：

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `id` | string | 是 | 引用 ID |
| `type` | string | 是 | `gbt_42446_task_reference` 或其他标准引用类型 |
| `code` | string/null | 否 | 标准条目编码 |
| `title` | string | 是 | 标准条目名称 |
| `description` | string/null | 否 | 说明 |
| `category` | string/null | 否 | 标准分类 |
| `sources` | array<SourceReference> | 否 | 来源 |

### 10.2 `GET /api/v1/references/roles`

当前静态字段：`management-knowledge.json.gartner_roles`

`RoleReference` 字段：

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `id` | string | 是 | 岗位参考 ID |
| `type` | string | 是 | `work_role_reference` |
| `code` | string/null | 否 | 编码 |
| `title` | string | 是 | 岗位/角色名称 |
| `description` | string/null | 否 | 描述 |
| `category` | string/null | 否 | 分类 |
| `sources` | array<SourceReference> | 否 | 来源 |

## 11. 生命周期接口

### 11.1 `GET /api/v1/lifecycle/application`

当前静态字段：`lifecycle-knowledge.json.application_security_development`

用途：应用安全开发生命周期维度。

顶层字段：

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `processes` | array<ApplicationSecurityProcess> | 是 | 生命周期过程/阶段 |
| `software_development_types` | array<KnowledgeObjectRef> | 是 | 软件开发类型 |
| `application_system_types` | array<ApplicationSystemType> | 是 | 应用系统类型 |

`ApplicationSecurityProcess` 字段：

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `id` | string | 是 | 过程 ID |
| `type` | string | 是 | `lifecycle_process` |
| `code` | string/null | 否 | 编码 |
| `title` | string | 是 | 过程名称 |
| `description` | string/null | 否 | 描述 |
| `category` | string/null | 否 | 分类 |
| `lifecycle_type` | string | 是 | 生命周期类型 |
| `order` | number/null | 否 | 展示顺序 |
| `goal` | string/null | 否 | 阶段目标 |
| `main_activities` | array<string/object> | 是 | 主要活动 |
| `security_activities` | array<SecurityActivity> | 是 | 安全活动 |
| `security_activity_count` | number | 是 | 安全活动数量 |
| `policy_requirements` | array<SecurityPolicyRequirement> | 是 | 安全策略要求 |
| `policy_requirement_count` | number | 是 | 策略数量 |
| `technical_services` | array<SecurityTechnicalService> | 是 | 技术服务 |
| `technical_service_count` | number | 是 | 技术服务数量 |
| `development_types` | array<KnowledgeObjectRef> | 是 | 适用开发类型 |
| `development_product_components` | array<KnowledgeObjectRef> | 是 | 开发类产品组件，来自原“实际产品示例” |
| `development_product_component_count` | number | 是 | 开发类产品组件数量 |
| `technology_modules` | array<SecurityTechnologyModule> | 是 | 关联安全技术模块，必须来自既有安全技术模块清单 |
| `technology_module_count` | number | 是 | 关联安全技术模块数量 |
| `technical_measures` | array<SecurityTechnicalMeasure> | 是 | 关联安全技术措施，不同于安全技术模块 |
| `technical_measure_count` | number | 是 | 关联安全技术措施数量 |
| `issues` | array<ValidationIssue> | 否 | 模块未匹配、服务无法归类等数据问题 |
| `metadata` | object | 否 | 扩展字段 |
| `sources` | array<SourceReference> | 否 | 来源 |

`SecurityActivity` 字段：

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `id` | string | 是 | 活动 ID |
| `type` | string | 是 | `security_activity` |
| `code` | string/null | 否 | 活动编码 |
| `title` | string | 是 | 活动名称 |
| `description` | string/null | 否 | 描述 |
| `policy_requirements` | array<SecurityPolicyRequirement> | 是 | 策略要求 |
| `policy_count` | number | 是 | 策略数量 |
| `technical_services` | array<SecurityTechnicalService> | 是 | 关联安全技术服务 |
| `technology_modules` | array<SecurityTechnologyModule> | 是 | 关联安全技术模块 |
| `sources` | array<SourceReference> | 否 | 来源 |

`SecurityPolicyRequirement` 字段：

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `id` | string | 是 | 策略 ID |
| `type` | string | 是 | `security_policy_requirement` |
| `code` | string | 是 | 策略编码 |
| `title` | string | 是 | 安全策略条目文本或名称 |
| `text` | string | 是 | 安全策略条目正文 |
| `sequence` | string/null | 否 | 原始策略序号 |
| `source_type` | string | 是 | 当前为 `LC-AP`；后续 SLSA 为 `Google SLSA` |
| `description` | string/null | 否 | 描述 |
| `category` | string/null | 否 | 分类 |
| `status` | string | 否 | 数据状态 |
| `metadata` | object | 否 | 扩展字段 |
| `sources` | array<SourceReference> | 否 | 来源 |

`SecurityTechnicalService` 在 LC-AP 中额外允许：

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `service_category` | string | 否 | 仅 LC-AP 使用，取值为 `管理类`、`开发类`、`网络空间类` |

`development_product_components` 说明：

- 不等同于通用产品主数据。
- 不进入安全技术模块清单。
- 第一阶段只在安全开发维度展示。

`ApplicationSystemType` 字段：

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `id` | string | 是 | 应用系统类型 ID |
| `type` | string | 是 | `application_system_type` |
| `code` | string/null | 否 | 编码 |
| `title` | string | 是 | 名称 |
| `description` | string/null | 否 | 描述 |
| `components` | array<KnowledgeObjectRef> | 是 | 应用组件 |
| `component_count` | number | 是 | 组件数量 |
| `sources` | array<SourceReference> | 否 | 来源 |

### 11.2 `GET /api/v1/lifecycle/data`

当前静态字段：`lifecycle-knowledge.json.data_lifecycle`

用途：数据生命周期维度。

顶层字段：

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `processes` | array<DataLifecycleProcess> | 是 | 数据生命周期过程 |

`DataLifecycleProcess` 字段：

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `id` | string | 是 | 过程 ID |
| `type` | string | 是 | `lifecycle_process` |
| `code` | string/null | 否 | 编码 |
| `title` | string | 是 | 过程名称 |
| `description` | string/null | 否 | 描述 |
| `category` | string/null | 否 | 分类 |
| `lifecycle_type` | string | 是 | 数据生命周期类型 |
| `order` | number/null | 否 | 展示顺序 |
| `scenes` | array<DataLifecycleScene> | 是 | 生命周期场景 |
| `scene_count` | number | 是 | 场景数量 |
| `technical_services` | array<SecurityTechnicalService> | 是 | 技术服务 |
| `technical_service_count` | number | 是 | 服务数量 |
| `technology_modules` | array<SecurityTechnologyModule> | 是 | 技术模块 |
| `technology_module_count` | number | 是 | 模块数量 |
| `metadata` | object | 否 | 扩展字段 |
| `sources` | array<SourceReference> | 否 | 来源 |

`DataLifecycleScene` 字段：

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `id` | string | 是 | 场景 ID |
| `type` | string | 是 | `lifecycle_scene` |
| `code` | string/null | 否 | 编码 |
| `title` | string | 是 | 场景名称 |
| `description` | string/null | 否 | 描述 |
| `category` | string/null | 否 | 分类 |
| `status` | string | 否 | 数据状态 |
| `metadata` | object | 否 | 扩展字段 |
| `sources` | array<SourceReference> | 否 | 来源 |

## 12. 内容视图接口

### 12.1 `GET /api/v1/content/guide-pages`

当前静态字段：`content-views.json.guide_pages`

用途：PPT 使用说明页面。

`GuidePage` 字段：

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `id` | string | 是 | 页面 ID |
| `title` | string | 是 | 页面标题 |
| `slide_number` | number/null | 否 | PPT 页码 |
| `content` | string/null | 否 | 抽取文本或 HTML |
| `note` | string/null | 否 | 备注 |
| `preview_path` | string/null | 否 | 预览图路径 |
| `media_count` | number | 否 | 媒体数量 |
| `source_file_id` | string | 是 | 来源文件 ID |
| `updated_at` | datetime/string | 否 | 更新时间 |
| `sources` | array<SourceReference> | 否 | 来源 |

### 12.2 `GET /api/v1/content/diagram-views`

当前静态字段：`content-views.json.diagram_views`

用途：Draw.io 只读视图。

`DiagramView` 字段：

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `id` | string | 是 | 视图 ID |
| `title` | string | 是 | 视图标题 |
| `view_type` | string | 是 | `drawio`、`svg`、`png` 等 |
| `page_index` | number/null | 否 | Draw.io 页序号 |
| `drawio_path` | string/null | 否 | 原始 Draw.io 文件路径 |
| `preview_path` | string/null | 否 | 预览图路径 |
| `vertex_count` | number | 否 | 节点数量 |
| `edge_count` | number | 否 | 连线数量 |
| `source_file_id` | string | 是 | 来源文件 ID |
| `updated_at` | datetime/string | 否 | 更新时间 |
| `sources` | array<SourceReference> | 否 | 来源 |

### 12.3 `GET /api/v1/content/html-documents`

当前静态字段：`content-views.json.html_documents`

用途：HTML 知识说明文档。当前样例数量为 0，但字段先保留。

`HtmlDocument` 字段：

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `id` | string | 是 | 文档 ID |
| `title` | string | 是 | 标题 |
| `description` | string/null | 否 | 描述 |
| `html_path` | string/null | 否 | HTML 文件路径 |
| `content` | string/null | 否 | 内联 HTML 或摘要 |
| `category` | string/null | 否 | 分类 |
| `updated_at` | datetime/string | 否 | 更新时间 |
| `sources` | array<SourceReference> | 否 | 来源 |

## 13. 导入接口

以下接口为后续本地应用阶段使用，当前静态前端不必立即实现。

### 13.1 `POST /api/v1/imports/excel/stage`

用途：选择或上传 Excel，生成暂存导入任务。

请求字段：

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `file_path` | string | 是 | 本地 Excel 路径 |
| `import_mode` | string | 是 | `initial_import`、`reimport`、`batch_import` |
| `sheet_names` | array<string> | 否 | 指定 Sheet，空表示按规则识别 |
| `dry_run` | boolean | 否 | 是否只生成预览 |
| `notes` | string/null | 否 | 导入说明 |

返回字段：

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `import_job_id` | string | 是 | 导入任务 ID |
| `source_file_id` | string | 是 | 来源文件 ID |
| `status` | string | 是 | `parsed`、`reviewing`、`failed` |
| `summary` | ImportSummary | 是 | 导入摘要 |
| `validations` | array<ValidationIssue> | 是 | 校验结果 |
| `warnings` | array<ValidationIssue> | 是 | 警告 |

`ImportSummary` 字段：

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `sheets_seen` | array<string> | 是 | 识别到的 Sheet |
| `sheets_parsed` | array<string> | 是 | 已解析 Sheet |
| `items_staged` | number | 是 | 暂存对象数 |
| `relations_staged` | number | 是 | 暂存关系数 |
| `items_created` | number | 否 | 预计新增对象数 |
| `items_updated` | number | 否 | 预计更新对象数 |
| `items_deprecated` | number | 否 | 预计停用对象数 |
| `relations_created` | number | 否 | 预计新增关系数 |
| `validations_count` | number | 是 | 校验问题数 |
| `warnings_count` | number | 是 | 警告数 |

### 13.2 `GET /api/v1/imports/{job_id}`

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `id` | string | 是 | 导入任务 ID |
| `source_file_id` | string | 是 | 来源文件 ID |
| `job_type` | string | 是 | 导入类型 |
| `status` | string | 是 | `pending`、`parsed`、`reviewing`、`approved`、`rejected`、`failed` |
| `started_at` | datetime/string | 否 | 开始时间 |
| `finished_at` | datetime/string | 否 | 结束时间 |
| `summary` | ImportSummary | 是 | 摘要 |
| `validations` | array<ValidationIssue> | 是 | 校验问题 |
| `warnings` | array<ValidationIssue> | 是 | 警告 |

### 13.3 `GET /api/v1/imports/{job_id}/preview`

返回字段：

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `items` | array<StagingItemPreview> | 是 | 暂存对象预览 |
| `relations` | array<StagingRelationPreview> | 是 | 暂存关系预览 |
| `summary` | ImportSummary | 是 | 摘要 |

`StagingItemPreview` 字段：

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `staging_id` | string | 是 | 暂存记录 ID |
| `action` | string | 是 | `create`、`update`、`skip`、`conflict`、`deprecate` |
| `object` | KnowledgeObjectRef | 是 | 候选对象 |
| `matched_item_id` | string/null | 否 | 匹配到的正式对象 |
| `diff` | object | 否 | 字段差异 |
| `validations` | array<ValidationIssue> | 是 | 对象级校验 |

`StagingRelationPreview` 字段：

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `staging_id` | string | 是 | 暂存关系 ID |
| `action` | string | 是 | `create`、`skip`、`conflict`、`deprecate` |
| `source` | KnowledgeObjectRef | 是 | 起点对象 |
| `target` | KnowledgeObjectRef | 是 | 终点对象 |
| `relation_type` | string | 是 | 关系类型 |
| `relation_label` | string | 否 | 中文关系名 |
| `metadata` | object | 否 | 扩展字段 |
| `validations` | array<ValidationIssue> | 是 | 关系级校验 |

### 13.4 `POST /api/v1/imports/{job_id}/approve`

请求字段：

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `decision_scope` | string | 是 | `all`、`items_only`、`relations_only`、`selected` |
| `selected_staging_ids` | array<string> | 否 | 选中的暂存 ID |
| `notes` | string/null | 否 | 审批说明 |

返回字段：

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `import_job_id` | string | 是 | 导入任务 ID |
| `status` | string | 是 | 审批后状态 |
| `summary` | ImportSummary | 是 | 入库摘要 |
| `change_log_ids` | array<string> | 是 | 变更记录 ID |

## 14. 数据质量接口

### 14.1 `GET /api/v1/data-quality/issues`

用途：查看当前数据质量问题。

查询参数：

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `status` | string | 否 | `open`、`fixed`、`accepted` |
| `severity` | string | 否 | 严重级别 |
| `object_type` | string | 否 | 对象类型 |

返回字段：

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `issues` | array<ValidationIssue> | 是 | 问题列表 |
| `stats` | object | 是 | 按状态、级别统计 |

### 14.2 `GET /api/v1/data-quality/reports/{report_id}`

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `id` | string | 是 | 报告 ID |
| `title` | string | 是 | 报告标题 |
| `generated_at` | datetime/string | 是 | 生成时间 |
| `source` | string | 否 | 报告来源 |
| `summary` | object | 是 | 报告摘要 |
| `rows` | array<object> | 是 | 报告明细 |
| `download_paths` | object | 否 | CSV/Markdown/JSON 下载路径 |

## 15. 导出接口

### 15.1 `POST /api/v1/exports`

请求字段：

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `export_type` | string | 是 | `items`、`relations`、`matrix`、`backup`、`all` |
| `format` | string | 是 | `csv`、`json`、`xlsx`、`md`、`html`、`zip` |
| `scope` | object | 否 | 导出范围 |
| `include_deprecated` | boolean | 否 | 是否包含停用对象，默认 `false` |
| `include_sources` | boolean | 否 | 是否包含来源证据 |
| `notes` | string/null | 否 | 导出说明 |

返回字段：

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `export_id` | string | 是 | 导出任务 ID |
| `status` | string | 是 | `pending`、`running`、`completed`、`failed` |
| `created_at` | datetime/string | 是 | 创建时间 |

### 15.2 `GET /api/v1/exports/{export_id}`

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `id` | string | 是 | 导出任务 ID |
| `export_type` | string | 是 | 导出类型 |
| `format` | string | 是 | 格式 |
| `status` | string | 是 | 状态 |
| `created_at` | datetime/string | 是 | 创建时间 |
| `finished_at` | datetime/string/null | 否 | 完成时间 |
| `file_path` | string/null | 否 | 导出文件路径 |
| `file_size` | number/null | 否 | 文件大小 |
| `summary` | object | 否 | 导出摘要 |

## 16. 字段演进规则

字段按成熟度分为三类：

| 成熟度 | 说明 | 处理规则 |
|---|---|---|
| `experimental` | 试验字段 | 可新增、可调整，但不得作为前端关键逻辑唯一依据 |
| `semi-stable` | 半稳定字段 | 可新增，不建议改名；改名需同步文档和前端 |
| `stable` | 稳定字段 | 不允许随意改名或删除；必要变更需提供兼容期 |

当前建议：

| 字段 | 成熟度 | 说明 |
|---|---|---|
| `id`、`type`、`code`、`title`、`description` | stable | 通用对象基本字段 |
| `services`、`scopes`、`modules`、`systems`、`products` | stable | 关系展示核心字段 |
| `process_mappings`、`scope_mappings` | semi-stable | 结构已基本明确，但可能继续优化命名 |
| `metadata` | experimental | 用于承载未稳定扩展字段 |
| `sources` | stable | 数据治理字段，UI 默认隐藏 |
| `stats` | semi-stable | 统计项可增加 |

## 17. 前端接入要求

前端接入时必须遵守：

1. 页面组件只通过 `dataClient` 访问数据。
2. `dataClient` 当前读取静态 JSON，未来切换 `/api/v1/*` 时页面组件不应大改。
3. 前端不根据 `sources` 推断业务关系。
4. 前端不自行合并同名对象或同编码对象。
5. 前端默认只展示 active 数据。
6. 需要显示缺失项时使用后端字段，如 `missing_activity`、`activity_status_label`。
7. 新页面需要新字段时，先更新本文档，再修改后端导出，再接前端。

## 18. 下一步接口落地顺序

| 顺序 | 工作 | 说明 |
|---|---|---|
| 1 | 前端建立 `dataClient` | 统一读取静态 JSON，避免页面散落 fetch 和业务拼装 |
| 2 | 后端补齐能力矩阵投影 | 将当前前端计算的 matrix 下沉到导出层 |
| 3 | 后端补齐环境矩阵投影 | 输出环境对象到服务、模块、系统/产品扁平矩阵 |
| 4 | 完成第二批/第三批业务确认 | 确认主键、关系基数、展示口径 |
| 5 | 再考虑本地 API 服务 | 在静态契约稳定后实现 `/api/v1/*` |
