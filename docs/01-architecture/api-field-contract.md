# API 字段级接口契约

本文档定义 SAPD Wiki 前后端分离后的字段级接口契约。它面向前端 UI 集成、后端接口实现、离线 JSON 数据包导出和数据校验。

当前工程已经明确执行 API / 后端契约优先。`public/data/*.json` 仅作为后端生成的离线兼容数据包或本地 API 不可用时的 fallback；新功能默认通过 `dataClient` 和 `/api/v1/*` 契约进入前端。

## 1. 契约原则

| 原则 | 说明 |
|---|---|
| 后端给事实 | 前端只消费后端给出的对象、关系、统计和缺失状态 |
| 前端不推断关系 | 前端不从原始 Sheet 字段自行拼装业务关系 |
| 来源默认隐藏 | 来源字段保留在数据中，但默认 UI 不展示 |
| 字段稳定优先 | 字段新增可以，字段改名或删除必须先更新本文档 |
| 空值显式表达 | 缺失 L4 活动等业务缺口用状态字段表达，前端显示 `待补充` |
| API 与离线包同构 | `/api/v1/*` 与 `public/data/*.json` 使用同一字段语义，离线包是 API 的兼容 fallback |

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

知识库字典权威值：数据确认后，`安全能力清单`、`安全作用域清单`、`安全技术服务清单`、`安全技术模块/措施`、`安全管理工作`、`流程清单`、`安全职能清单` 中的对象是全局权威值。其他接口、workbench 和离线包引用这些对象时，`id`、`code`、`title` / `name` 必须与字典一致；引用一致性由 `node scripts/audit_dictionary_reference_consistency.mjs` 检查。

## 3. 通用响应结构

### 3.1 API 响应包

本地 API 推荐统一使用响应包。历史静态 JSON 可暂时不包 `meta/data`，但字段语义必须保持一致。

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

## 5. 当前离线 JSON 文件映射

| 离线数据包 | 对应 API | 用途 |
|---|---|---|
| `capability-tree.json` | `/api/v1/capabilities/tree`、`/api/v1/capabilities/matrix`、`/api/v1/capabilities/workspace-projection` | 能力树、关注点、服务、作用域、流程、职能关系 |
| `maintenance-index.json` + `maintenance/*.json` | `/api/v1/maintenance/*`、`/api/v1/references/*` | 安全知识目录索引与作用域、流程、职能、模块、措施、岗位参考分片 |
| `source-evidence/maintenance/*.sources.json` | `/api/v1/maintenance/source-evidence/*` | 安全知识来源证据 sidecar，按页面对象 ID 延迟读取 |
| `maintenance-knowledge.json` | `/api/v1/data-packages/maintenance` | 旧版聚合兼容包，仅作 fallback，不作为新增页面首选入口 |
| `environment-workbench.json` | `/api/v1/environments/*` | 信息化环境页面级投影 |
| `shared-lookups.json` | `/api/v1/maintenance/service-module-index` | 全站共享服务-模块索引 |
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

### 7.3 `GET /api/v1/capabilities/workspace-projection`

用途：安全能力映射页的后端页面投影。该接口把“关注点 -> 作用域 -> 安全技术服务 -> 技术模块 / 技术措施”和“关注点 -> 安全工作 -> 流程 / 职能”提前整理成前端可直接展示的行数据，避免 ViewModel 重新推断业务关系。

返回字段：

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `data_state` | string | 是 | `ready`、`empty` 等 |
| `technicalMappingRows` | array<CapabilityTechnicalMappingRow> | 是 | 技术视角映射行 |
| `managementMappingRows` | array<CapabilityManagementMappingRow> | 是 | 管理视角映射行 |
| `stats.technical_rows` | number | 是 | 技术映射行数量 |
| `stats.management_rows` | number | 是 | 管理映射行数量 |
| `stats.focuses` | number | 是 | 覆盖关注点数量 |

`CapabilityTechnicalMappingRow` 字段：

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `focus` | KnowledgeObjectRef | 是 | 能力关注点 |
| `scope` | KnowledgeObjectRef | 是 | 作用域 |
| `services` | array<KnowledgeObjectRef> | 是 | 已确认安全技术服务 |
| `candidateServices` | array<KnowledgeObjectRef> | 是 | 候选安全技术服务；存在多候选时用于人工确认 |
| `technologyModules` | array<KnowledgeObjectRef> | 是 | 安全技术模块 |
| `technicalMeasures` | array<KnowledgeObjectRef> | 是 | 安全技术措施 |
| `modules` | array<KnowledgeObjectRef> | 是 | 前端展示用的模块 / 措施合并列表 |
| `status` | string | 是 | `covered`、`no_service`、`ambiguous_service_mapping` |
| `exceptionType` | string | 否 | 异常类型 |
| `exceptionMessage` | string | 否 | 异常说明 |

`CapabilityManagementMappingRow` 字段：

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `focus` | KnowledgeObjectRef | 是 | 能力关注点 |
| `securityWorks` | array<KnowledgeObjectRef> | 是 | 安全工作 |
| `stakeholders` | array<WorkFunctionWithLayer> | 是 | 安全职能 |
| `processGroups` | array<KnowledgeObjectRef> | 是 | L2 流程组 |
| `processReferences` | array<KnowledgeObjectRef> | 是 | L3 流程 |
| `activities` | array<KnowledgeObjectRef> | 是 | L4 活动 |
| `activityStatusLabels` | array<string> | 是 | 活动补全状态 |
| `hasMissingActivity` | boolean | 是 | 是否存在待补充 L4 活动 |

### 7.4 `GET /api/v1/capabilities/{id}/relationships`

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

当前静态文件：`environment-workbench.json` 的 `navigator` 和 `relations`

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

### 8.3 `GET /api/v1/environments/dictionary`

状态：`PLAN-ENV-MD P0 contract frozen / implementation not started`

当前拟新增静态包：`environment-dictionary.json`

用途：以唯一主数据粒度提供信息化环境、环境子类和信息化对象字典；环境映射树继续由8.1承载，不从树按标题临时去重。

机器合同：

- `docs/01-architecture/contracts/environment-master-data/v1/environment-master-data.contract.json`
- `docs/01-architecture/contracts/environment-master-data/v1/environment-dictionary.schema.json`

固定顶层字段：

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `schema_version` | string | 是 | 固定为 `environment-dictionary-v1` |
| `data_state` | string | 是 | `ready` 或 `empty` |
| `generated_at` | string | 是 | 包生成时间，不作为可见业务字段 |
| `source_package_versions` | object | 是 | 基础库/环境包版本清单 |
| `master_counts` | object | 是 | 环境、唯一环境子类、信息化对象主数据数量 |
| `context_counts` | object | 是 | 环境子类上下文、环境对象上下文数量 |
| `information_environments` | array<EnvironmentMasterRecord> | 是 | 唯一信息化环境 |
| `environment_segment_types` | array<EnvironmentMasterRecord> | 是 | P2裁定后的唯一环境子类 |
| `information_objects` | array<EnvironmentMasterRecord> | 是 | 唯一信息化对象 |
| `usage_relations` | array<EnvironmentMasterUsage> | 是 | 主数据到现有环境上下文的关系投影 |
| `evidence_ref_count` | integer | 是 | 来源证据引用数量 |

主数据记录必须包含 `id`、`stable_ref`、`public_id`、`type`、`code`、`title`、`description`、`aliases`、`status`、`usage_summary`。页面首期只读；新包缺失或版本不兼容时回退现有环境目录树，但前端不得在fallback中自行推导唯一主数据。

## 9. 专项知识维护接口

### 9.0 安全知识拆包与按需加载契约

安全知识页面与安全标准 / 框架页面统一采用“索引先行、详情按需”的协同策略：

- 安全知识入口先加载 `maintenance-index.json`，获得二级入口、统计、分片路径和来源证据 sidecar 路径。
- 安全知识主数据按二级入口加载 `maintenance/<section>.json`，例如 `maintenance/scopes.json`、`maintenance/services.json`、`maintenance/modules.json`、`maintenance/measures.json`、`maintenance/processes.json`、`maintenance/work-functions.json`、`maintenance/references.json`。
- 安全知识来源证据只保存在 `source-evidence/maintenance/<section>.sources.json`，前端普通主表、概览和筛选不得依赖 `sheet`、`row`、`column`、`raw_value`、`source_label` 等来源字段。
- `maintenance-knowledge.json` 保留为旧版聚合兼容包；新增页面、字段和修复默认不得继续以该聚合包作为首选数据入口。
- 安全标准 / 框架页面继续先加载 `standards-index.json`，再按当前框架加载 `standards/<framework>/*.json` 或框架分片；两类模块共享 `dataClient` 的索引、分片和 legacy fallback 边界。

`MaintenanceIndex` 关键字段：

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `data_state` | string | 是 | `ready`、`empty` 或 `missing_file` |
| `package_type` | string | 是 | 固定为 `maintenance-index` |
| `stats` | object | 是 | 兼容统计 |
| `section_counts` | object | 是 | 二级入口计数，供导航在未加载分片时显示 |
| `sections` | array<object> | 是 | 分片清单 |
| `sections[].id` | string | 是 | 分片 ID，如 `scopes`、`services`、`references` |
| `sections[].dataPath` | string | 是 | 主数据分片路径 |
| `sections[].sourceEvidencePath` | string | 是 | 来源证据 sidecar 路径 |

### 9.1 `GET /api/v1/maintenance/scopes`

当前静态字段：`maintenance/scopes.json.scope_types`

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
| `sources` | array<SourceReference> | 否 | 旧兼容字段；拆包后迁移到 `source-evidence/maintenance/scopes.sources.json.evidenceById` |

### 9.2 `GET /api/v1/maintenance/processes`

当前静态字段：`maintenance/processes.json.security_processes`

用途：安全职能流程清单，以流程域、流程组、L3 流程参考、L4 活动组织。

`ProcessDomain` 字段：

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `id` | string | 是 | 流程域 ID |
| `code` | string/null | 否 | 编码 |
| `title` | string | 是 | 流程域名称 |
| `description` | string/null | 否 | 描述 |
| `category` | string/null | 否 | 分类 |
| `sources` | array<SourceReference> | 否 | 旧兼容字段；拆包后迁移到 `source-evidence/maintenance/processes.sources.json.evidenceById` |
| `groups` | array<ProcessGroup> | 是 | L2 流程组 |

`ProcessGroup` 字段：

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `id` | string | 是 | 流程组 ID |
| `code` | string/null | 否 | 编码 |
| `title` | string | 是 | 流程组名称 |
| `description` | string/null | 否 | 描述 |
| `sources` | array<SourceReference> | 否 | 旧兼容字段；拆包后迁移到来源证据 sidecar |
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
| `sources` | array<SourceReference> | 否 | 旧兼容字段；拆包后迁移到来源证据 sidecar |

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

当前静态字段：`maintenance/work-functions.json.work_function_layers`

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
| `sources` | array<SourceReference> | 否 | 旧兼容字段；拆包后迁移到 `source-evidence/maintenance/work-functions.sources.json.evidenceById` |

`WorkFunctionWithLayer` 额外字段：

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `layer` | string | 是 | 所属职能层名称 |
| `group` | string/null | 否 | 所属职能组名称 |

### 9.4 `GET /api/v1/maintenance/technology-modules`

当前静态字段：`maintenance/modules.json.security_technology_modules`

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
| `sources` | array<SourceReference> | 否 | 旧兼容字段；拆包后迁移到 `source-evidence/maintenance/modules.sources.json.evidenceById` |

### 9.5 `GET /api/v1/maintenance/technical-measures`

当前静态字段：`maintenance/measures.json.security_technical_measures`

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
| `sources` | array<SourceReference> | 否 | 旧兼容字段；拆包后迁移到 `source-evidence/maintenance/measures.sources.json.evidenceById`，仅用于来源证据区 |

字段边界：

- `security_technical_measures` 位于 `maintenance/measures.json` 顶层；旧 `maintenance-knowledge.json` 仅保留兼容。
- 后端不得把安全技术模块直接当作安全技术措施返回。
- 后端不得把安全系统或产品当作安全技术措施返回。
- `related_service_names`、`related_scope_names`、`related_environment_names`、`related_environment_object_names` 都必须按数组保留多值关系，不得压成单值。
- `sources` / `sourceEvidence` / `mapping_sources` 只允许出现在来源证据 sidecar 或旧兼容包中，不进入主分片、主表列、概览区或筛选主维度。
- `sheet`、`row`、`column`、`raw_value`、`source_file`、`import_id`、`source_id`、`generated_at` 等非业务字段不得进入主展示区。

### 9.6 `GET /api/v1/maintenance/service-module-index`

当前静态字段：`shared-lookups.json.service_module_index`

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

当前静态字段：`maintenance/references.json.gbt_42446_references`

`StandardReference` 字段：

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `id` | string | 是 | 引用 ID |
| `type` | string | 是 | `gbt_42446_task_reference` 或其他标准引用类型 |
| `code` | string/null | 否 | 标准条目编码 |
| `title` | string | 是 | 原始表 `承担的工作任务` |
| `description` | string/null | 否 | `GB/T 42446-2023` 原文表 2 `工作任务描述`，按工作任务名称匹配补充 |
| `category` | string/null | 否 | 原始表 `工作类别` |
| `sources` | array<SourceReference> | 否 | 旧兼容字段；拆包后迁移到 `source-evidence/maintenance/references.sources.json.evidenceById` |

### 10.2 `GET /api/v1/references/roles`

当前静态字段：`maintenance/references.json.gartner_roles`

`RoleReference` 字段：

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `id` | string | 是 | 岗位参考 ID |
| `type` | string | 是 | `work_role_reference` |
| `code` | string/null | 否 | 编码 |
| `title` | string | 是 | 原始表 `角色` |
| `description` | string/null | 否 | 原始表 `描述` |
| `category` | string/null | 否 | 原始表 `分类` |
| `sources` | array<SourceReference> | 否 | 旧兼容字段；拆包后迁移到 `source-evidence/maintenance/references.sources.json.evidenceById` |

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
| `development_technical_services` | array<KnowledgeObjectRef> | 是 | 开发技术服务，来自原“开发技术服务” |
| `development_technical_service_count` | number | 是 | 开发技术服务数量 |
| `development_technical_modules` | array<KnowledgeObjectRef> | 是 | 开发技术模块，来自原“实际产品示例” |
| `development_technical_module_count` | number | 是 | 开发技术模块数量 |
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

`SecurityTechnicalService` 在 LC-AP 中说明：

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `service_category` | string | 否 | 旧字段，仅兼容历史数据；新 LC-AP 不再按管理类、开发类、网络空间类拆分 |

`development_technical_services` / `development_technical_modules` 说明：

- 开发技术服务不等同于安全技术服务。
- 开发技术模块不等同于安全技术模块，也不进入安全技术模块清单。
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

## 19. [历史] 安全运行知识 API（WP2 scoped P0 Gate 2 / WP2I 本地受控预览）

> 状态（2026-09-17，R2.1）：本节是已从主版本运行时移除的 candidate-only 合同，仅保留作历史迁移参考。当前可运行副本位于 [`demos/security-operations-r2/`](../../demos/security-operations-r2/)；主版本不再注册本节列出的安全运行 API 或图示预览路由。其源文档、候选包和专用测试均保存在 Demo 的 `archive/` 下。

本组端点只读取通过 scoped Gate 1 且包含 `content_projection` 和同级私有预览包合同的 WP1I 候选包，不读取原始 Excel、Markdown、外部图片目录、正式 SQLite 或用户库。这是 P0 页面集成合同，不表示所有 P1 分类与关系已经完成。当前尚未授权 formal set freeze / apply，因此每个成功响应的 `data` 都必须包含：

| 字段 | 固定值 | 说明 |
|---|---|---|
| `data_state` | `partial` | 内容可用于页面集成，但仍有显式暂缓项 |
| `data_scope` | `scoped_candidate` | 不得显示为正式 active 数据 |
| `candidate_only` | `true` | 当前只读候选投影 |
| `gate_status` | `scoped_passed` | 仅表示 scoped Gate 1 已通过 |
| `formal_apply_authorized` | `false` | 不授权写正式库 |

### 19.1 端点

| 端点 | 主要返回 | 精确引用参数 |
|---|---|---|
| `GET /api/v1/security-operations` | 模块、来源版次、七页目录、01-000 第 1—10 章总体思路来源投影、第 4 章五点、功能状态、计数和候选包版本 | 无 |
| `GET /api/v1/security-operations/sections/{section_ref}` | 精确章节、安全有序内容段、已解析链接和 source-only 图示占位 | 路径 `section_ref` |
| `GET /api/v1/security-operations/knowledge` | 总体概念、活动、视角、维度、证据要求及显式业务关系 | `ref / relation_ref` |
| `GET /api/v1/security-operations/capability-mappings` | 主题与能力 / 关注点的同一关系记录集合 | `relation_ref` |
| `GET /api/v1/security-operations/threat-models` | 检测规则及其场景、日志、响应建议 | `rule_ref` |
| `GET /api/v1/security-operations/questions` | 458 个调研问题 | `question_ref` |
| `GET /api/v1/security-operations/metrics` | 指标设计参考，不含当前值和趋势 | `metric_ref` |
| `GET /api/v1/security-operations/sources` | 八类来源及许可 / 核验状态 | `source_ref` |
| `GET /api/v1/security-operations/graph` | candidate-only 图谱 node / edge 投影、`projection_version` 与 `projection_digest` | 精确 `focus`；可选 `depth` |
| `GET /api/v1/security-operations/figures/{figure_ref}/preview` | 本地受控的精确 PNG 图示预览 | 路径 `figure_ref` |

任何非空精确引用找不到时返回 HTTP `404`，并在 `data` 中返回 `error = target_missing` 和原请求 `target_ref`；禁止回退到第一条、父级对象或默认焦点。运行时必须同时配置候选包和预期 SHA-256；候选包缺失、未配置摘要、摘要不符或 Gate 边界不符时返回 HTTP `503 / candidate_bundle_unavailable`。

### 19.2 列表、过滤和游标

- 列表按稳定 ref 排序，`page` 包含 `total / returned / limit / next_cursor`；`limit` 范围为 `1..200`。
- 游标绑定端点及全部过滤条件；改变条件后复用旧游标返回 `400 / bad_request`。
- `knowledge` 支持 `page_id / object_type(s) / status(es) / source_ref(s) / q`；`include_relations=true` 或关系过滤时，附带非能力映射业务关系。关系支持 `relation_ref / relation_type(s) / relation_state(s) / subject_ref / target_ref`，关系使用独立的 `relation_cursor / relation_limit`，不得混入 capability mapping。`page_id` 只按候选包显式 page ownership 过滤，禁止标题或类型猜测。
- `capability-mappings` 支持 `page_id / source_ref / target_ref / target_code(s) / capability_domain_ref / capability_domain_code / relation_type(s) / decision_state / status(es) / q`；`domain_ref` 和 `domain_code` 是能力域过滤的兼容别名。能力域字段只能从候选包 `capability_target_context[target_ref].domain` 取得，不得从目标编码前缀或标题推断。`page_id` 只按关系的显式 page ownership 过滤。正向与反向查询必须返回同一批 `relation_ref` 记录，而不是重建两套关系。
- `threat-models` 支持 `rule_ref / scenario_ref / log_ref / response_ref / domain / record_role / source_ref / q`；场景、日志和响应端点只能通过候选包显式关系反查规则，并返回原关系 ref 与状态。
- `questions` 的 scoped P0 过滤为 `q / domain_ref / domain / source_ref / status`。响应中的 `filter_contract.supported_filters` 是前端可显示的控件清单；`activity_ref / survey_facet` 在映射或分类冻结前列入 `deferred_filters`，前端必须隐藏对应 P1 控件，调用方传入这些参数时返回 `400 / bad_request`。
- `questions[].ordinal` 来自 WP1I 保留的冻结顺序，458 题均非空且每个域内从 1 连续编号；唯一缺少来源显式题号的问题仍使用该 ordinal，不按问题文本推断编号。响应 `coverage` 必须显式报告 `questions / domain_ref / ordinal / survey_facets_classified / survey_assesses_relations`。
- `metrics` 支持 `metric_domain`（`domain` 为兼容别名）、`claim_status / completeness / source_ref / activity_ref / relation_state(s) / capability_ref / capability_code / capability_domain_ref / capability_domain_code / q`。`activity_ref` 只使用指标自身的显式 `measures_activity`；capability 和能力域只使用 `source_ref = metric_ref` 的直接能力映射及 `capability_target_context` 精确 join。不得把活动的全部能力继承给指标，也不得按标题或编码前缀推断。
- `sources` 支持 `edition_role(s) / verification_status(es) / q`。

### 19.3 字段边界

- 普通响应只返回业务字段、稳定 ref、受控 `source_ref` 和候选治理状态，不返回 raw `body`、`metadata` dump、`source_locator`、`source_token`、`source_image_token`、文件名、原始行列、绝对路径、asset blob、token 或 MCP 控制字段。
- manifest 严格消费 `content_projection.editions / pages / section_index / feature_contract / overview_guide`。正文页面的 `default_section_ref` 必须属于默认版次 TOC；来源导航和纯结构化页面必须显式返回 `default_section_ref = null`，不得伪造章节。`integrated_edition_state` 必须诚实返回 `unavailable_not_authored`。语义镜像文档不是可选版次，不进入 selectable TOC。七页模式固定为：`overview = source_guided_overview`、`document = primary_document_reader`、`framework / threat-modeling / metrics = structured_workspace`、`assessment = document_reader`、`sources = source_catalog`。`overview` 不暴露 TOC；`document` 是 01-010 正文 106 节的唯一完整正文 reader；`framework.document_refs / edition_refs` 必须为空，30-010 仅通过来源 provenance 与数据视角对象融合。来源页可以列出版次元数据，但 `toc = [] / edition_tocs = {}`，不得重复正文页目录。
- `overview_guide` 返回 `schema_version=security-operations-overview-guide-v2`、`content_role=source_projection`、01-000 来源标题，以及 `context_chapters / core_model / expansion_chapters / closeout_chapters`。章序固定为 1—10；第 4 章固定五个核心点，两条并列主线保留为该点下的 branches。每章只返回业务 `id / ordinal / anchor / title / lead / content_role=source_fact / subsections / dimensions / deepening_links`；核心点另返回业务标题、原文 body 和安全目标 anchor。深化链接只包含 `role / label / page_route / anchor`，不返回内部 source/document/edition/section ref、原路径、hash 或 token。页面 route 不含查询串或 `#`，页内定位通过独立 anchor，支持刷新恢复。
- 章节 `content_segments` 按原始顺序返回纯文本、精确章节链接、精确 `route_link`、source-only 图示占位和 unresolved 占位。API 识别 Obsidian `[[...]] / ![[...]]` 与标准 Markdown `[]() / ![]()` 四种来源语法，但只能使用 WP1I `link_index` 提供的 exact target；不得让前端解析来源 token，也不得从 token、标题或文件名匹配目标。每个来源链接必须有章节内从 1 连续的安全 `source_ordinal`，后端按“同节正文链接出现顺序 = source_ordinal”逐一绑定；数量、序号或保留的非图示 source token 不一致即 fail closed。图示链接不得在候选页面合同中保留原文件名 token。`route_link` 只能使用 WP1I 的 `page_link` 投影，返回业务 label 和 exact `page_route`。`content_figure` 不进入 `knowledge`；图示占位只在有序 `content_segments` 返回，不再另设顶层重复图示列表。图示占位仅新增 `preview_available` 与同源 `preview_url`；仍不得返回 owner、内部相对路径、文件名、独立 hash/digest、源图 token 或绝对路径。`figure_ref` 是正式稳定 opaque ref，可作为 `target_ref / annotation_target` 身份，即使其字符串含摘要派生后缀也属于稳定 ref 豁免；前端不得把该 ref 作为可见业务文案渲染，也不得另造 public id。
- 关系状态只使用 `formal_active / policy_accepted_candidate / system_deferred_candidate`。不得使用 `confirmed` 命名候选关系；WP1I 当前正式 active 数为 0。
- 每条能力映射返回 focus 目标、L2 `capability_ref / capability_code / capability_title` 及 `domain_ref / domain_code / domain_title`；这些字段只能来自 `capability_target_context[target_ref]`。状态分桶与七域数量之和必须等于同一批关系总数。
- 章节、知识对象和关系、能力映射、威胁规则及子对象、调研问题、指标、来源和来源缺口统一返回 `annotation_target.target_ref / page_route / anchor_type / object_type / object_title`。`feature_contract.annotations = deferred` 表示本阶段不实现用户状态叠加，不影响提供稳定注释目标元数据。
- 指标仅返回名称、领域、定义、公式、建议数据来源、周期、责任角色、适用条件、资料完整性和来源；不得返回客户当前值、趋势、告警、工单或处置执行状态。
- 来源接口只返回逻辑名称、版本角色、核验状态、4 个稳定来源缺口和许可边界。权限与可用性必须分开：若 WP1I 私有预览包成功验签，本地受控预览 `permission = allowed / availability = supported`；权限允许但预览包缺失、摘要不符、越界或内容漂移时为 `permission = allowed / availability = deferred_unpublished`；来源边界禁止时为 `permission = forbidden / availability = not_available`。本地只读知识访问固定 `permission = allowed_redacted / availability = supported`，原件下载及外部分发固定 `permission = forbidden`。不得把全局 `source_scope` 的 v0.2 作者或版本身份状态复制到八条来源；Gate B 的身份缺口只通过对应来源的 `open_gap_refs` 和稳定 gap 投影表达。
- `version.candidate_bundle_digest / source_manifest_digest` 只用于缓存、摘要门禁和运行诊断，不是图示 hash，也不是面向用户的展示字段；前端不得可见渲染。

### 19.4 P1 延后边界

当前候选包没有冻结“问题 → 运行活动”关系，也没有完成调研 facet 分类，因此 activity / facet 过滤不属于本轮 scoped P0 Gate 2。该缺口通过 `filter_contract` 和 `coverage` 显式返回，不得把 P0 可用描述成完整目标合同，也不得在 API 或前端按问题文本、标题关键词或相邻行推断。后续只有 WP1 提供稳定映射 / 分类后才能启用对应 P1 控件。

### 19.5 WP2I 本地受控图示预览边界

- 预览资产只允许位于候选包同级的 `private/figure-preview-pack-v1/`；API 不接受外部绝对路径、运行参数中的图源目录或公开静态目录。候选包迁移时必须连同私有包整体迁移。
- 后端严格校验 manifest 自摘要、候选包 SHA 绑定、28 个 `figure_ref -> preview_asset_ref` owner、内部相对路径、PNG MIME、字节数、内容 SHA、宽高和完整覆盖。私有目录、manifest、任一中间目录或资产为软链、路径越界、摘要不符或读取后内容变化时，所有已知图示预览均 fail closed。
- 私有包缺失或无效不阻断 manifest、section 等 JSON 知识接口；对应图示返回 `preview_available = false / preview_url = null`。精确预览请求返回 `503 / preview_unavailable`。不存在的 `figure_ref` 始终返回 `404 / target_missing`，不得用第一张图或相邻图替代。
- 成功预览仅允许 `GET /api/v1/security-operations/figures/{figure_ref}/preview`，响应 `Content-Type: image/png`、`Content-Disposition: inline`、`X-Content-Type-Options: nosniff`、`Cache-Control: private, no-store`。不提供 list、download、Range、公开文件路径或外发接口。
- 普通 JSON 响应不得暴露预览包 manifest、内部相对路径、asset SHA、宽高、文件名或 backend owner。`candidate_bundle_digest` 继续仅作非展示诊断；预览端点返回二进制，不把图片内容或摘要嵌入 JSON。

### 19.6 V2 candidate graph projection 增量

`GET /api/v1/security-operations/graph` 复用本节 19 的通用 envelope、candidate-only 与错误语义。当前候选实测为 43 nodes、57 edges；descriptor 的 `material_source_count=8`，nodes 按 kind 统计 `foundation_dimension=8`、`profile_dimension=8`，跨来源 `editorial_pending` 为 21 条；数量是快照证据，不是前端常量。

| 字段 / 参数 | 约束 |
|---|---|
| `manifest.knowledge_graph` | 仅包含 `schema_version / status / projection_version / projection_digest / node_count / edge_count / material_source_count`；8 个 `foundation_dimension` 与 8 个 `profile_dimension` 来自 nodes 按 kind 统计，不是 descriptor 字段 |
| `projection_version` | 当前 `2026-09-07.2`；独立于 candidate bundle version |
| `projection_digest` | 当前 `sha256:989023d6fec4d7264b249b73b127d8e7a502209ceb23d6561b99c5deb453da17`；不得用 bundle digest 代替 |
| `nodes[]` | 使用 graph config 的 `id / kind / label / visual_role / page_id` 及按类型声明的 `item_ref / source_section_ref / anchor`；仅 material node 使用 `source_ref`，不另造 `source_refs / evidence_refs` |
| `edges[]` | 使用 graph config 的 `id / source / target / relation_type / relation_state / label / source_section_ref`，深化边可带 `business_reason / endpoint_evidence`；不得使用 `edge.status` 或未声明别名 |
| `focus` | 只接受声明的精确值；当前 `asset / profile-data-asset / support-threat-modeling / metric-definition` 均可精确返回，未知值 404，不回退首项或父级 |
| `depth` | 非法值 fail closed；当前 `depth=99` 返回 400 |

graph 的 `relation_state` 是 overview 导航专用 enum，不得直接喂给 `/knowledge` 的 `relation_state(s)` 过滤器或未来 MCP 业务关系字段。

图谱缺失或结构无效时返回 `graph_unavailable`，七页 manifest 仍保留；loading 是 UI 异步状态，不写入 API envelope。`candidate_only=true`、`formal_apply=false`，正式 MCP/apply 未授权。
