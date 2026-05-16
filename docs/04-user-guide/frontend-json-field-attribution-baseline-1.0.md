# Frontend JSON Field Attribution Baseline 1.0

本文档用于对当前前端 JSON 数据文件做字段归因分析，作为后续拆分 `capability-workbench.json`、`environment-workbench.json`、`lifecycle-workbench.json`、`shared-lookups.json` 和 `source-evidence.json` 的实施前置。

本轮只做字段归因，不修改前端代码、不修改 JSON、不修改 ETL、不修改数据库 schema、不重新导入数据、不运行 npm、不启动前端、不打开浏览器。

当前口径已确认：

```text
Frontend Baseline 1.0 后续按“P1 双核心工作台 + LC-AP 受控专项关系投影”执行。
```

## 1. 当前前端 JSON 文件清单

当前 `frontend/capability-browser/public/data/` 下存在以下前端数据文件：

| 文件 | 类型 | 当前顶层字段 | 当前状态 |
|---|---|---|---|
| `capability-tree.json` | JSON object | `generated_at`、`stats`、`categories`、`unlinked_focuses` | 职责过重，应收缩为能力目录树 |
| `management-knowledge.json` | JSON object | `generated_at`、`stats`、`work_function_layers`、`security_processes`、`gbt_42446_references`、`gartner_roles`、`scope_types`、`security_technology_modules`、`security_technical_measures`、`service_module_index`、`environment_scope_tree`、`assets` | 职责混杂，应拆出环境工作台、共享索引和专项知识维护 |
| `lifecycle-knowledge.json` | JSON object | `generated_at`、`stats`、`application_security_development`、`data_lifecycle`、`service_module_index` | 职责混杂，应新增 `lifecycle-workbench.json` 作为稳定契约 |
| `content-views.json` | JSON object | `generated_at`、`stats`、`html_documents`、`diagram_views`、`guide_pages` | 当前职责相对清晰，暂不作为 P1 工作台拆分重点 |
| `assets/*.png` | 图片资产 | 安全工作职能清单图片 | 属于专项知识维护 / 内容资产，不应进入工作台主 JSON |

## 2. 每个 JSON 的当前职责

| 文件 | 当前实际职责 | 目标职责 |
|---|---|---|
| `capability-tree.json` | 能力树 + 关注点服务映射 + 作用域映射 + 安全工作 + 流程映射 + 来源证据 | 只保留能力分类、L1、L2、关注点和树顺序 |
| `management-knowledge.json` | 管理知识目录 + 职能目录 + 流程目录 + GB/T + Gartner + 作用域 + 模块 + 措施 + 环境对象树 + 服务模块索引 + 图片资产 | 收缩为安全知识 / 专项维护数据；环境、模块、措施和共享索引迁出 |
| `lifecycle-knowledge.json` | LC-AP + LC-DT + 应用类型 / 组件参考 + 技术措施 + 全站服务模块索引 | 保留旧兼容；新增 `lifecycle-workbench.json` 只承载 LC-AP 受控专项关系投影 |
| `content-views.json` | Draw.io / PPT / HTML 内容视图 | 保持内容视图数据包，后续可纳入安全指南或内容资产治理 |

## 3. 主要字段 / 数据块归因总表

| 当前文件 | 字段 / 数据块 | 当前含义 | 目标归因 |
|---|---|---|---|
| `capability-tree.json` | `generated_at` | 生成时间 | 保留在当前 JSON；后续也可进入 `app-manifest.json` |
| `capability-tree.json` | `stats` | 能力树统计 + 服务统计 | 树统计保留；服务 / 关系统计迁入 `capability-workbench.json` |
| `capability-tree.json` | `categories` | 能力分类树根 | 保留在 `capability-tree.json` |
| `capability-tree.json` | `categories[].domains` | L1 能力 | 保留在 `capability-tree.json` |
| `capability-tree.json` | `domains[].capabilities` | L2 能力 | 保留在 `capability-tree.json` |
| `capability-tree.json` | `capabilities[].focuses` | 关注点目录 | 保留基础字段；关系字段迁出 |
| `capability-tree.json` | `focuses[].services` | 关注点关联服务 | 迁入 `capability-workbench.json` |
| `capability-tree.json` | `focuses[].scope_mappings` | 关注点作用域映射 | 迁入 `capability-workbench.json` |
| `capability-tree.json` | `focuses[].security_works` | 关注点安全工作 | 迁入 `capability-workbench.json` |
| `capability-tree.json` | `focuses[].process_mappings` | 关注点流程和职能映射 | 迁入 `capability-workbench.json` |
| `capability-tree.json` | `sources` | 来源证据 | 迁入 `source-evidence.json` |
| `capability-tree.json` | `metadata` | 内部排序、来源计数、对象 key | 展示所需字段白名单保留；其余迁入 export 内部或 `shared-lookups.json` |
| `management-knowledge.json` | `work_function_layers` | 四层安全职能目录 | 专项知识维护；能力页只消费 `capability-workbench.json.management.workFunctionsByLayer` |
| `management-knowledge.json` | `security_processes` | L1 / L2 / L3 / L4 流程目录 | 专项知识维护；能力页只消费投影后的 `processTree` |
| `management-knowledge.json` | `gbt_42446_references` | GB/T 职能参考 | 专项知识维护 / 知识目录 |
| `management-knowledge.json` | `gartner_roles` | Gartner 岗位参考 | 专项知识维护 / 知识目录 |
| `management-knowledge.json` | `scope_types` | 安全能力作用域目录 | `shared-lookups.json` 或知识目录；环境页按需投影 |
| `management-knowledge.json` | `security_technology_modules` | 安全技术模块目录 | 知识目录 / `shared-lookups.json`；工作台使用页面投影 |
| `management-knowledge.json` | `security_technical_measures` | 安全技术措施目录 | 知识目录 / `shared-lookups.json`；工作台使用页面投影 |
| `management-knowledge.json` | `service_module_index` | 服务到模块 / 系统 / 产品索引 | `shared-lookups.json` 或页面工作台局部投影 |
| `management-knowledge.json` | `environment_scope_tree` | 环境、对象、作用域、服务、模块关系树 | 迁入 `environment-workbench.json` |
| `management-knowledge.json` | `assets` | 图片资产 | 专项知识维护 / 内容资产 |
| `lifecycle-knowledge.json` | `application_security_development` | LC-AP 相关阶段、活动、策略、服务、模块、措施、组件 | 拆入 `lifecycle-workbench.json` |
| `lifecycle-knowledge.json` | `data_lifecycle` | LC-DT 数据生命周期 | 后续进入数据安全专题或独立 `data-lifecycle-workbench.json` |
| `lifecycle-knowledge.json` | `service_module_index` | 全站服务模块索引 | `shared-lookups.json` 或页面局部投影，不应留在 LC-AP 包 |
| `content-views.json` | `diagram_views` | Draw.io 视图 | 保留在内容视图；后续归入安全指南 / 内容资产 |
| `content-views.json` | `guide_pages` | PPT 指南页 | 保留在内容视图；后续归入安全指南 |

## 4. `capability-tree.json` 字段归因

当前统计：

| 指标 | 数量 |
|---|---:|
| `categories` | 3 |
| domains | 10 |
| capabilities | 32 |
| focuses | 91 |
| services | 157 |
| focus_scope_mappings | 379 |

### 4.1 保留字段清单

以下字段应保留在 `capability-tree.json`：

| 层级 | 字段 | 原因 |
|---|---|---|
| 顶层 | `generated_at` | 树数据生成时间 |
| 顶层 | `stats.categories`、`stats.domains`、`stats.capabilities`、`stats.focuses` | 能力目录统计 |
| 顶层 | `categories` | 能力树根 |
| 分类 / L1 / L2 / 关注点 | `id` | 前端选择和引用 |
| 分类 / L1 / L2 / 关注点 | `type` | 区分节点类型 |
| 分类 / L1 / L2 / 关注点 | `code` | 业务编码 |
| 分类 / L1 / L2 / 关注点 | `title` | 展示名称 |
| 分类 / L1 / L2 / 关注点 | `description` | 简短说明 |
| 分类 / L1 / L2 / 关注点 | `status` | 生效状态 |
| 分类 / L1 / L2 / 关注点 | `domain_count`、`capability_count`、`focus_count` | 导航统计，可保留 |
| 分类 / L1 / L2 | `domains`、`capabilities`、`focuses` | 树层级 |

### 4.2 迁移字段清单

| 字段 | 迁移目标 | 说明 |
|---|---|---|
| `stats.services` | `capability-workbench.json` | 属于工作台关系统计，不是目录树统计 |
| `stats.focus_scope_mappings` | `capability-workbench.json` | 属于关注点关系统计 |
| `service_count` | `capability-workbench.json` 或 overview 投影 | 可作为工作台摘要，不应在树层层重复 |
| `scope_count` | `capability-workbench.json` | 关注点工作台摘要 |
| `focuses[].services` | `capability-workbench.json.technical` | 技术视角关系 |
| `focuses[].scope_mappings` | `capability-workbench.json.technical.scopeServicePairs` | 作用域到服务 pair |
| `focuses[].security_works` | `capability-workbench.json.management.securityWorks` | 管理视角关系 |
| `focuses[].process_mappings` | `capability-workbench.json.management.processTree` / `workFunctionsByLayer` | 流程和职能投影 |
| `sources` | `source-evidence.json` | 来源证据不应进入主树结构 |
| `metadata.object_key` | export 内部或 `shared-lookups.json` | 非展示字段 |
| `metadata.source_count` | `source-evidence.json` 或工作台统计 | 来源统计 |
| `metadata.tree_order` | 可保留为 `order` | 仅保留排序语义，建议改名为展示字段 |

### 4.3 当前问题

- `capability-tree.json` 文件名表达的是树，但内部已承担能力页工作台关系数据。
- `services` 内嵌完整服务对象、作用域对象和来源证据，前端容易直接暴露 `sheet`、`row`、`raw_value`。
- `process_mappings` 同时包含流程、L4 缺失状态、stakeholders 和 sources，语义过重。
- `metadata` 与 `sources` 混在主数据结构中，组件需要知道哪些字段能展示、哪些不能展示。

## 5. `lifecycle-knowledge.json` 字段归因

当前统计：

| 指标 | 数量 |
|---|---:|
| `application_processes` | 8 |
| `data_processes` | 8 |
| `lifecycle_activities` | 43 |
| `lifecycle_scenes` | 36 |
| `security_activities` | 6 |
| `policy_requirements` | 76 |
| `software_development_types` | 4 |
| `application_system_types` | 3 |
| `application_components` | 13 |
| `development_product_components` | 14 |
| `security_technical_measures` | 3 |
| `service_module_index` | 192 |

### 5.1 短期保留字段

为了兼容当前页面，短期可保留整个 `lifecycle-knowledge.json`，但不再扩展其职责。

短期保留：

- `generated_at`
- `stats`
- `application_security_development`
- `data_lifecycle`
- `service_module_index`

### 5.2 迁移字段清单

| 字段 / 数据块 | 迁移目标 | 说明 |
|---|---|---|
| `application_security_development.processes` | `lifecycle-workbench.json` | LC-AP 受控专项关系投影主数据 |
| `processes[].main_activities` | `lifecycle-workbench.json` | 阶段到主要活动 |
| `processes[].security_activities` | `lifecycle-workbench.json` | 安全活动 |
| `processes[].policy_requirements` | `lifecycle-workbench.json` | 策略要求 / 控制点 |
| `processes[].technical_services` | `lifecycle-workbench.json` | 阶段关联服务 |
| `processes[].technology_modules` | `lifecycle-workbench.json` | 阶段关联模块 |
| `processes[].technical_measures` | `lifecycle-workbench.json` | 阶段关联措施 |
| `processes[].development_product_components` | `lifecycle-workbench.json` | 弱参考，不扩展为完整产品模块 |
| `application_security_development.software_development_types` | 专项知识维护 | 软件开发类型参考 |
| `application_security_development.application_system_types` | 专项知识维护 | 应用系统类型和组件参考 |
| `application_security_development.development_product_components` | 专项知识维护 / LC-AP 弱参考 | 不作为通用产品主数据 |
| `data_lifecycle` | 后续数据安全专题或 `data-lifecycle-workbench.json` | 不属于 LC-AP |
| `service_module_index` | `shared-lookups.json` 或页面局部投影 | 全站共享索引 |
| `sources` | `source-evidence.json` | 来源证据引用 |
| `metadata` | export 内部或白名单字段 | 不直接进入组件主展示 |

### 5.3 当前问题

- `application_security_development` 和 `data_lifecycle` 是两个不同页面主语，不宜长期同包。
- LC-AP 是受控专项关系投影，不应承载完整开发安全模块。
- `service_module_index` 在 `management-knowledge.json` 和 `lifecycle-knowledge.json` 中重复。
- `software_development_types`、`application_system_types`、`application_components` 更像参考库或专项维护，不应挤进 LC-AP 主画布。

## 6. `management-knowledge.json` 字段归因

当前统计：

| 指标 | 数量 |
|---|---:|
| `work_function_layers` | 4 |
| `work_functions` | 86 |
| `security_processes` | 10 |
| `process_groups` | 32 |
| `process_references` | 85 |
| `gbt_42446_references` | 27 |
| `gartner_roles` | 28 |
| `scope_types` | 10 |
| `security_technology_modules` | 121 |
| `security_technical_measures` | 29 |
| `service_module_index` | 192 |
| `information_environments` | 10 |
| `information_objects` | 66 |
| `environment_scope_mappings` | 96 |
| `environment_service_mappings` | 1256 |
| `environment_module_mappings` | 3962 |
| `assets` | 2 |

### 6.1 可短期保留字段

| 字段 | 原因 |
|---|---|
| `generated_at` | 兼容旧数据包 |
| `stats` | 兼容旧页面统计 |
| `work_function_layers` | 短期仍服务安全工作职能目录 |
| `security_processes` | 短期仍服务安全职能流程目录 |
| `gbt_42446_references` | 短期仍服务岗位 / 职能参考目录 |
| `gartner_roles` | 短期仍服务岗位 / 职能参考目录 |
| `assets` | 短期仍服务安全工作职能清单图片 |

### 6.2 迁移字段清单

| 字段 / 数据块 | 迁移目标 | 说明 |
|---|---|---|
| `environment_scope_tree` | `environment-workbench.json` | 环境页 P1 核心工作台主数据来源 |
| `environment_scope_tree[].objects` | `environment-workbench.json.navigator` / `workspacesByObjectId` | 信息化对象导航和对象工作台 |
| `objects[].scope_mappings` | `environment-workbench.json.relationshipGroups` | 对象到作用域、服务、模块的关系 |
| `scope_types` | `shared-lookups.json` 或安全知识目录 | 作用域字典 |
| `security_technology_modules` | 安全知识目录 / `shared-lookups.json` | 模块字典；页面使用局部投影 |
| `security_technical_measures` | 安全知识目录 / `shared-lookups.json` | 措施字典；页面使用局部投影 |
| `service_module_index` | `shared-lookups.json` 或页面局部投影 | 共享索引，不属于管理知识专属 |
| `work_function_layers` 局部投影 | `capability-workbench.json.management.workFunctionsByLayer` | 能力页只需要当前关注点关联职能 |
| `security_processes` 局部投影 | `capability-workbench.json.management.processTree` | 能力页只需要当前关注点关联流程 |
| `sources` | `source-evidence.json` | 来源证据 |

### 6.3 `environment-workbench.json` 的抽取来源

`environment-workbench.json` 应优先从 `management-knowledge.json.environment_scope_tree` 和 export 逻辑中抽取。

建议抽取映射：

| 当前字段 | 目标字段 |
|---|---|
| `environment_scope_tree[]` | `navigator.environments[]`、`environmentsById` |
| `environment_scope_tree[].objects[]` | `objectsById`、`workspacesByObjectId` |
| `objects[].segments` | `workspace.context.segments` |
| `objects[].scope_mappings[]` | `workspace.technical.scopeServiceLinks[]` |
| `scope_mappings[].scope` | `scope` |
| `scope_mappings[].services[]` | `services` |
| `services[].modules` | `modules` |
| `modules[].systems` | `securitySystems` |
| `modules[].products` | `products` |
| `sources` | `evidenceRefs` |

### 6.4 当前问题

- 文件名是 `management-knowledge`，但环境、模块、措施和服务索引均在其中。
- `environment_scope_tree` 数据量大，且是环境工作台核心数据，不应隐藏在管理知识包。
- `security_technical_measures` 字段与 lifecycle 中的 `security_technical_measures` 语义接近但来源和适用范围不同，后续应统一命名和归属。
- `sources` 在多个对象层级重复，数据包体积和前端字段边界风险都偏高。

## 7. `content-views.json` 字段归因

| 字段 / 数据块 | 当前含义 | 目标归因 |
|---|---|---|
| `html_documents` | HTML 文档视图 | 保留，后续可归入安全指南文档资产 |
| `diagram_views` | Draw.io 图视图 | 保留，后续归入内容视图 / 安全指南 |
| `guide_pages` | PPT 指南页 | 保留，后续归入文档页或指南页 |
| `sources` | 来源证据 | 后续可迁入 `source-evidence.json` |

当前不建议优先拆 `content-views.json`，因为它不阻塞 P1 双核心工作台。

## 8. 页面展示字段

页面主展示字段应限于白名单业务字段：

| 字段 | 用途 |
|---|---|
| `id` | 稳定引用 |
| `type` | 对象类型 |
| `code` | 业务编码 |
| `title` / `name` | 展示名称 |
| `description` | 说明 |
| `category` | 分类 |
| `status` | 状态 |
| `order` / `tree_order` | 排序，建议统一为 `order` |
| `count` / `*_count` | 摘要统计 |
| `scope` | 作用域 |
| `service` | 安全技术服务 |
| `modules` | 安全技术模块 |
| `measures` | 安全技术措施 |
| `securityWorks` | 安全工作 |
| `workFunctionsByLayer` | 四层职能投影 |
| `processTree` | 流程树 |
| `relationshipGroups` | 页面关系分组 |
| `evidenceRefs` | 来源证据引用 |

## 9. 共享字典字段

适合进入 `shared-lookups.json`：

| 字段 / 数据 | 说明 |
|---|---|
| `objectTypeLabels` | 对象类型中文名 |
| `relationTypeLabels` | 关系类型中文名 |
| `fieldLabels` | 字段展示名 |
| `statusLabels` | 状态标签 |
| `pageTypeLabels` | 页面类型标签 |
| `scope_types` 简表 | 作用域字典 |
| `security_technology_modules` 简表 | 模块字典，可按需引用 |
| `security_technical_measures` 简表 | 措施字典，可按需引用 |
| `service_module_index` 简表 | 如果多个页面共用，可进入共享索引 |

注意：共享字典不应放完整来源证据，也不应放页面主关系链。

## 10. 来源证据字段

以下字段属于来源证据或内部追踪，不应进入主展示结构：

| 字段 | 归因 |
|---|---|
| `sources` | `source-evidence.json` |
| `sheet` | `source-evidence.json` |
| `row` | `source-evidence.json` |
| `column` | `source-evidence.json` |
| `cell` | `source-evidence.json` |
| `raw_value` | `source-evidence.json` |
| `source_file_id` | `source-evidence.json` |
| `source_sheet` | `source-evidence.json` |
| `source_count` | `source-evidence.json` 或摘要统计 |
| `metadata.source_count` | `source-evidence.json` 或摘要统计 |

页面工作台只保留 `evidenceRefs`。

## 11. 临时过渡字段

以下字段可短期保留，但不建议作为新页面契约：

| 字段 | 当前位置 | 过渡原因 | 后续处理 |
|---|---|---|---|
| `metadata` | 多个对象 | 当前 export 内部信息仍在使用 | 白名单拆出展示字段，其余留在 export 内部 |
| `object_key` | `metadata` | 去重 / 调试用途 | 不进入前端主契约 |
| `service_module_index` | `management-knowledge.json`、`lifecycle-knowledge.json` | 多页面共用且当前已被前端消费 | 迁入 `shared-lookups.json` 或局部工作台投影 |
| `activity_status`、`activity_status_label`、`missing_activity` | 流程映射 | 当前用于 L4 缺失展示 | 保留为 `processTree` 的业务状态字段 |
| `unlinked_focuses` | `capability-tree.json` | 当前为空，兼容旧导出 | 后续如无消费可移除或放入 validation |
| `data_lifecycle` | `lifecycle-knowledge.json` | 当前与 LC-AP 共包 | 后续迁出到数据安全专题 |

## 12. 命名不一致、语义混杂、空值、重复和前端难消费问题

| 问题类型 | 现象 | 建议 |
|---|---|---|
| 命名不一致 | `title`、`name` 混用；`security_technical_measures` 在不同包语义范围不同 | 页面契约统一展示字段名，原始差异在 export 层处理 |
| 语义混杂 | `management-knowledge.json` 同时放职能、流程、环境、模块、措施、索引 | 拆出 `environment-workbench.json`、`shared-lookups.json` |
| 来源泄露风险 | 多层对象都带 `sources`、`raw_value`、`sheet`、`row` | 改为 `source-evidence.json` + `evidenceRefs` |
| 重复索引 | `service_module_index` 同时出现在 management 和 lifecycle | 迁入共享索引或由页面工作台局部生成 |
| 空值 / 缺失 | `process_activity_missing` 为 85，L4 活动大量缺失 | 在工作台中作为业务状态展示，不让组件推断 |
| 前端难消费 | 树、目录、工作台关系混在同一对象层级 | 树和工作台拆包，ViewModel 只做展示整理 |
| 页面边界不清 | LC-AP 与 LC-DT 共包 | LC-AP 用 `lifecycle-workbench.json`，LC-DT 后续进入数据安全专题 |

## 13. 最小拆分顺序建议

建议按以下顺序拆分：

1. `capability-tree.json` 职责收缩方案先冻结，不立即删除旧字段。
2. 新增 `capability-workbench.json`，对齐现有 `/api/v1/capabilities/workspace-projection`。
3. 新增 `environment-workbench.json`，从 `management-knowledge.json.environment_scope_tree` 和 export 逻辑抽取。
4. 新增 `lifecycle-workbench.json`，只承载 LC-AP 受控专项关系投影。
5. 抽 `source-evidence.json`，先从 P1 两个工作台开始。
6. 抽 `shared-lookups.json`，收纳对象类型、关系类型、字段标签、作用域、模块、措施简表和共享索引。
7. 更新 `dataClient`，让页面读取稳定契约，而不是直接读取历史混合包。
8. 最后再统一 `LocalNavigator`、`ObjectOverview`、`RelationshipTable`、`SourceEvidencePanel`。

优先级最高的是 `environment-workbench.json`，因为它对应 P1 核心工作台，且当前缺少稳定出口。

## 13.1 三份 workbench 规格后的最终迁移复核

基于以下三份规格：

- `docs/04-user-guide/capability-workbench-json-spec-v1.md`
- `docs/04-user-guide/environment-workbench-json-spec-v1.md`
- `docs/04-user-guide/lifecycle-workbench-json-spec-v1.md`

字段归因最终复核如下：

| 目标文件 | 迁入字段 / 数据块 | 迁出来源 |
|---|---|---|
| `capability-tree.json` | `capability_category`、`capability_domain`、`capability`、`capability_focus`、`tree_order`、目录展开所需结构 | 保留自 `capability-tree.json` |
| `capability-workbench.json` | `focuses[].services`、`focuses[].scope_mappings`、`focuses[].security_works`、`focuses[].process_mappings`、局部 `service_module_index`、局部技术措施、后续标准映射 | `capability-tree.json`、`management-knowledge.json`、后续标准数据 |
| `environment-workbench.json` | `environment_scope_tree[]`、`objects[]`、`segments[]`、`scope_mappings[]`、`services[]`、`modules[]`、`systems[]`、`products[]` | `management-knowledge.json.environment_scope_tree` |
| `lifecycle-workbench.json` | `application_security_development.processes`、`main_activities`、`security_activities`、`policy_requirements`、`technical_services`、`technology_modules`、局部措施和开发产品组件弱引用 | `lifecycle-knowledge.json.application_security_development` |
| `shared-lookups.json` | `objectTypeLabels`、`relationTypeLabels`、`fieldLabels`、`statusLabels`、`scope_types` 简表、模块 / 措施简表、可选 `service_module_index` | `management-knowledge.json`、`lifecycle-knowledge.json`、后续配置 |
| `source-evidence.json` | `sources`、`mapping_sources`、`sheet`、`row`、`column`、`cell`、`raw_value`、`source_file_id` | 当前所有前端 JSON 中的来源字段 |
| 专项知识维护 | `work_function_layers`、`security_processes`、`gbt_42446_references`、`gartner_roles`、`assets`、`software_development_types`、`application_system_types`、`application_components`、`development_product_components` | `management-knowledge.json`、`lifecycle-knowledge.json`、`content-views.json` |

## 14. 不建议现在做的事项

当前不建议：

- 不直接改前端组件去适配当前混杂 JSON。
- 不直接删除 `capability-tree.json`、`management-knowledge.json`、`lifecycle-knowledge.json` 的旧字段。
- 不重新导入数据。
- 不修改 SQLite schema。
- 不大改 ETL。
- 不启动 npm / 前端页面验证。
- 不把 LC-AP 扩成完整开发安全模块。
- 不把 LC-AP 参考数据塞回同页参考区。
- 不把信息化环境页当成新 Sheet 扩展。
- 不把多张表汇聚视为错误；真正要治理的是页面契约稳定性。

## 15. 结论

本次字段归因结论：

1. `capability-tree.json` 应回归能力目录树。
2. `capability-workbench.json` 应承载安全能力映射页的关注点工作台关系。
3. `environment-workbench.json` 必须新增，主要从 `management-knowledge.json.environment_scope_tree` 抽取。
4. `lifecycle-workbench.json` 应新增，作为 LC-AP 受控专项关系投影。
5. `management-knowledge.json` 应收缩为安全知识 / 专项维护数据包，不继续承担 P1 环境工作台职责。
6. `service_module_index`、对象类型展示名、关系类型展示名等应进入 `shared-lookups.json` 或页面局部投影。
7. `sources`、`sheet`、`row`、`column`、`raw_value` 等应进入 `source-evidence.json`，页面只保留 `evidenceRefs`。
