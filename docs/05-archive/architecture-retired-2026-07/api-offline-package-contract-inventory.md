# API / 离线数据包契约盘点

> 归档状态：`completed / BE-0 inventory`

本文档用于执行 BE-0：盘点 Frontend Baseline 1.0 三页所需的 API、离线数据包、字段、关系、状态和来源证据。

盘点日期：2026-05-15

## 1. 当前结论

| 结论项 | 当前判断 |
|---|---|
| 总体运行模式 | 已形成 `本地 API 优先 + public/data/*.json fallback` 的过渡模式 |
| 已有页面级投影 | `安全能力映射页` 已有 `/api/v1/capabilities/workspace-projection`，且已补充 `localRelationMap` 画布投影结构 |
| 未有页面级投影 | `信息化环境维度页`、`LC-AP 开发安全生命周期页` 仍主要依赖 `data-packages` 和前端 ViewModel 整理 |
| 离线数据包 | 已从 4 个基础包演进为页面级包 + 共享索引：`capability-tree.json`、`maintenance-knowledge.json`、`shared-lookups.json`、`lifecycle-knowledge.json`、`content-views.json` 等；`management-knowledge.json` 已退役 |
| 主要契约风险 | 文档中已有若干规划接口，但当前 `api_server.py` 尚未全部实现；后续必须区分“已实现 API”和“计划接口” |
| 前端边界 | 前端可以排序、筛选、分组和折叠，但不应生成业务关系事实 |
| 来源证据 | 各数据包均保留 `sources`；主展示区应默认隐藏，仅进入折叠证据区 |

## 2. 当前已实现 API

以 `src/sapd_wiki/api_server.py` 为准，当前实际可用接口如下。

| API | 当前用途 | 数据来源 | 状态 |
|---|---|---|---|
| `GET /api/v1/health` | 本地 API 健康检查 | 运行时生成 | 已实现 |
| `GET /api/v1/data-packages` | 数据包索引 | `DATA_PACKAGES` 配置 | 已实现 |
| `GET /api/v1/data-packages/capability` | 安全能力数据包 | `capability-tree.json` | 已实现 |
| `GET /api/v1/data-packages/maintenance` | 专项知识维护数据包 | `maintenance-knowledge.json` | 已实现；缺失时返回 `__data_state=missing_file`，不回退到 `management-knowledge.json` |
| `GET /api/v1/data-packages/shared-lookups` | 全站共享索引数据包 | `shared-lookups.json` | 已实现；当前包含 `service_module_index` |
| `GET /api/v1/data-packages/lifecycle` | 生命周期数据包 | `lifecycle-knowledge.json` | 已实现 |
| `GET /api/v1/data-packages/content` | 说明与视图数据包 | `content-views.json` | 已实现 |
| `GET /api/v1/capabilities/workspace-projection` | 安全能力映射页页面级投影，含技术 / 管理映射行和局部关系画布投影 | `capability-tree.json` + `maintenance-knowledge.json` + `shared-lookups.json` | 已实现 |
| `GET /api/v1/maintenance` | 专项知识维护导航 | 三个主数据包汇总 | 已实现 |
| `GET /api/v1/maintenance/{section}` | 专项知识维护单页数据 | 数据包切片 | 已实现 |

当前 `maintenance/{section}` 支持的 section：

| section | 含义 |
|---|---|
| `scopes` | 作用域清单 |
| `processes` | 流程清单 |
| `work-functions` | 职能清单 |
| `security-works` | 安全工作清单 |
| `modules` | 安全技术模块清单 |
| `measures` | 安全技术措施清单 |
| `lcap-references` | LC-AP 参考数据 |
| `references` | 岗位参考页面 |

## 3. 当前规划但尚未实现为独立 API 的接口

以下接口已在架构或字段契约文档中出现，但当前 `api_server.py` 尚未实现为独立路由。前端现在通过 `/api/v1/data-packages/*` fallback 包和 `dataClient` / ViewModel 获得等价数据。

| 规划接口 | 当前实际来源 | 风险 / 处理建议 |
|---|---|---|
| `/api/v1/capabilities/tree` | `/api/v1/data-packages/capability` 或 `capability-tree.json` | 可后置；能力树已稳定 |
| `/api/v1/capabilities/matrix` | 前端 `dataClient.getCapabilityMatrix()` 从能力包 + 维护包 + 共享索引整理 | 后续若继续前后端分离，应下沉 |
| `/api/v1/capabilities/{id}/relationships` | 前端 `dataClient.getCapabilityRelationships()` 整理 | 可由能力页投影补强覆盖 |
| `/api/v1/environments/tree` | `environment-workbench.json.navigator` | BE-2 应优先实现 |
| `/api/v1/environments/matrix` | 前端 `dataClient.getEnvironmentMatrix()` 整理 | BE-2 应优先实现 |
| `/api/v1/environments/dictionary` | P4已实现 `environment-dictionary-v1` 只读包/路由，P6正式库迁移完成，P7已受控启用 | 禁止前端按标题去重或跳过旧树fallback；P8仍需App/离线包回归 |
| `/api/v1/environments/objects/{id}/relationships` | 前端 `dataClient.getEnvironmentRelationships()` 整理 | BE-2 应输出页面级关系投影 |
| `/api/v1/lifecycle/application` | `lifecycle-knowledge.json.application_security_development` | BE-3 应优先实现 |
| `/api/v1/lifecycle/data` | `lifecycle-knowledge.json.data_lifecycle` | 数据生命周期页后续处理 |
| `/api/v1/lifecycle/{id}/relationships` | 前端 ViewModel 整理 | BE-3 应输出页面级关系投影 |
| `/api/v1/maintenance/technology-modules` | 当前实际为 `/api/v1/maintenance/modules` | 需统一命名或在文档中说明别名 |
| `/api/v1/maintenance/technical-measures` | 当前实际为 `/api/v1/maintenance/measures` | 需统一命名或在文档中说明别名 |
| `/api/v1/maintenance/service-module-index` | `shared-lookups.json.service_module_index` | 可后置；当前通过 `/api/v1/data-packages/shared-lookups` 提供 |

## 4. 离线数据包盘点

| 离线包 | 顶层字段 | 当前统计 | 覆盖页面 |
|---|---|---|---|
| `capability-tree.json` | `generated_at`、`stats`、`categories`、`unlinked_focuses` | 分类 3、L1 10、L2 32、关注点 91、服务 157、关注点-作用域映射 379 | 安全能力映射页 |
| `maintenance-knowledge.json` | `scope_types`、`security_processes`、`work_function_layers`、`security_technology_modules`、`security_technical_measures`、`gbt_42446_references`、`gartner_roles` | 作用域 10、流程域 10、职能层 4、模块 118、措施 29、GB/T 42446 参考 27、Gartner 角色 28 | 专项知识维护 |
| `shared-lookups.json` | `service_module_index` | 服务模块索引 192 | 全站共享索引 |
| `lifecycle-knowledge.json` | `application_security_development`、`data_lifecycle` | LC-AP 过程 8、数据生命周期过程 8、安全策略 76、开发产品组件 14、安全技术措施 3 | LC-AP 页、数据生命周期页；顶层共享索引改由 `shared-lookups.json` 承载 |
| `content-views.json` | `html_documents`、`diagram_views`、`guide_pages` | Draw.io 1、PPT guide 1 | 说明与视图 |
| `standards-data.json` | `frameworks`、`stats` | 等保 113、CIS 153、CSF Core 106、CSF Tiers 4 | 标准/框架页面 |

## 5. 安全能力映射页契约

### 5.1 页面需要的主数据

| 数据 | 当前来源 | 当前状态 |
|---|---|---|
| 能力分类 / L1 / L2 / 关注点树 | `capability-tree.json.categories` 或 `/api/v1/data-packages/capability` | 已有 |
| 当前关注点概览 | 能力包中的 `CapabilityFocus` + 页面投影统计 | 已有 |
| 关注点-作用域 pair | `/api/v1/capabilities/workspace-projection.technicalMappingRows[].scope` | 已有 |
| 作用域-服务 pair | `/api/v1/capabilities/workspace-projection.technicalMappingRows[].services` | 已有，但多服务候选需继续后端确认 |
| 服务自己的模块 | `technologyModules`、`localRelationMap.technical.serviceModuleMeasureLinks[].modules` | 已有 |
| 服务自己的措施 | `technicalMeasures`、`localRelationMap.technical.serviceModuleMeasureLinks[].measures` | 已有 |
| 安全工作 | `managementMappingRows[].securityWorks` | 已有 |
| 安全职能四层 | `localRelationMap.management.workFunctionsByLayer` | 已有 |
| L2 / L3 / L4 流程 | `localRelationMap.management.processTree` | 已有，L4 缺失通过状态表达 |
| 来源证据 | `sources` 和 ViewModel 聚合 | 已有，默认隐藏 |

### 5.2 当前缺口

| 缺口 | 影响 | 建议动作 |
|---|---|---|
| 前端尚未改为直接消费 `localRelationMap` | ViewModel 中仍保留历史 fallback 和本地组装逻辑 | 后续 FE-0 / FE-2 可只做消费替换，不再新增业务推导 |
| 当前前端画布结构仍在收敛 | 不宜复制到环境页和 LC-AP 页 | 先完成 FE-0 / FE-2 验收 |

### 5.3 BE-1 页面级局部关系投影

`GET /api/v1/capabilities/workspace-projection` 已补充以下字段：

```text
localRelationMap
├─ focus
│  ├─ id
│  ├─ code
│  ├─ name
│  └─ description
├─ technical
│  ├─ scopeServicePairs[]
│  └─ serviceModuleMeasureLinks[]
├─ management
│  ├─ securityWorks[]
│  ├─ workFunctionsByLayer
│  │  ├─ decision[]
│  │  ├─ management[]
│  │  ├─ execution[]
│  │  ├─ supervision[]
│  │  └─ unknown[]
│  └─ processTree[]
└─ sourceEvidence[]
```

同时输出：

- `localRelationMaps[]`：所有关注点的局部关系投影；
- `localRelationMapsByFocusId`：按关注点 `id` 索引的局部关系投影；
- `stats.local_relation_maps`：局部关系投影数量。

业务规则：

- `scopeServicePairs` 保留 `作用域 -> 安全技术服务` pair；
- `serviceModuleMeasureLinks` 按安全技术服务分别输出，不把多个服务汇总成一个统一模块框；
- 安全技术模块和安全技术措施分开输出；
- 安全职能按 `decision`、`management`、`execution`、`supervision`、`unknown` 五组输出；
- L2 / L3 / L4 流程进入 `processTree`；
- `sheet`、`row`、`column`、`source_file` 等来源追踪字段只进入 `sourceEvidence`，不进入主展示结构。

## 6. 信息化环境维度页契约

### 6.1 页面需要的主数据

| 数据 | 当前来源 | 当前状态 |
|---|---|---|
| 信息化环境 | `environment-workbench.json.objects.information_environment` | 已有 |
| 环境子类 / segment | `environment-workbench.json.objects.environment_segment` | 已有 |
| 信息化对象 | `environment-workbench.json.objects.information_object` | 已有 |
| 唯一环境主数据字典 | `environment-dictionary.json` / `/api/v1/environments/dictionary` | P4影子包与只读API已实现；P6正式库已迁移；P7能力开关已受控启用，旧目录fallback保留 |
| 对象-作用域关系 | `environment-workbench.json.relations` | 已有 |
| 作用域-服务关系 | `environment-workbench.json.relations` | 已有 |
| 服务-模块关系 | `environment-workbench.json.relations` | 已有 |
| 服务-系统 / 产品关系 | `service_module_index[].systems/products` | 数据结构有规划，但当前样本中常为空或不稳定 |
| 来源证据 | environment / object / mapping / service 的 `sources`、`mapping_sources` | 已有，默认隐藏 |

### 6.2 当前缺口

| 缺口 | 影响 | 建议动作 |
|---|---|---|
| 没有 `/api/v1/environments/*` 独立 API | 环境页仍通过数据包 + 前端 ViewModel 整理 | BE-2 新增环境页页面级投影 |
| 没有 `EnvironmentLocalRelationMap` 对应的后端投影 | 前端若直接画图会继续承担关系组装 | BE-2 输出 `localRelationMap` 或等价页面投影 |
| 系统 / 产品关系不宜直接画入主链路 | 容易和“对象 -> 作用域 -> 服务 -> 模块”主链路混淆 | 后端投影中拆成参考区或详情字段 |
| 来源字段来源多层嵌套 | 前端容易误展示 `sources` 原始字段 | 后端投影应输出业务字段 + evidence 独立数组 |

### 6.3 建议 BE-2 输出结构

```text
environmentWorkspaceProjection
├─ data_state
├─ navigationTree
├─ selected
├─ overview
├─ localRelationMap
│  ├─ focusObject
│  ├─ scopeServicePairs
│  ├─ serviceModuleLinks
│  ├─ referenceSystems
│  └─ referenceProducts
├─ relationshipRows
└─ sourceEvidence
```

## 7. LC-AP 开发安全生命周期页契约

### 7.1 页面需要的主数据

| 数据 | 当前来源 | 当前状态 |
|---|---|---|
| 生命周期阶段 / 过程 | `lifecycle-knowledge.json.application_security_development.processes[]` | 已有 |
| 阶段主要活动 | `processes[].main_activities[]` | 已有 |
| 安全活动 | `processes[].security_activities[]` | 已有 |
| 策略要求 | `processes[].policy_requirements[]` | 已有 |
| 开发技术服务 | `technical_services[]` 中按类别 / 服务类型区分，或现有 ViewModel 整理 | 部分依赖前端整理 |
| 安全技术服务 | `technical_services[]` | 已有 |
| 安全技术模块 | `technology_modules[]` 或服务内 `modules[]` | 当前样本中阶段级数组可能为空，服务内模块更可靠 |
| 安全技术措施 | `technical_measures[]` | 当前样本中部分为空 |
| 开发类产品组件 | `development_product_components[]` | 已有 |
| 来源证据 | process 及各子对象 `sources` | 已有，默认隐藏 |

### 7.2 当前缺口

| 缺口 | 影响 | 建议动作 |
|---|---|---|
| 没有 `/api/v1/lifecycle/application` 独立 API | LC-AP 页仍通过数据包 + ViewModel 整理 | BE-3 新增生命周期页面级投影 |
| 没有 `LifecycleLocalRelationMap` 对应后端投影 | 前端容易从 lifecycle JSON 推断关系 | BE-3 输出阶段级局部关系图数据 |
| 开发技术服务 / 安全技术服务分类需要后端明确 | 前端不应靠名称或 category 临时判断 | 后端投影中明确 `serviceRole` 或拆分数组 |
| 模块 / 措施关系粒度不稳定 | 图上可能出现空模块或空措施 | 后端投影输出缺失状态和解释 |
| 产品组件是弱关系 | 不宜作为主技术链路的硬下游 | 投影中作为参考对象或侧栏字段 |

### 7.3 建议 BE-3 输出结构

```text
lifecycleWorkspaceProjection
├─ data_state
├─ navigationTree
├─ selectedStage
├─ stageOverview
├─ localRelationMap
│  ├─ stage
│  ├─ mainActivities
│  ├─ securityActivities
│  ├─ policyRequirements
│  ├─ developmentServices
│  ├─ securityServices
│  ├─ serviceModuleMeasureLinks
│  └─ referenceProductComponents
├─ relationshipRows
└─ sourceEvidence
```

## 8. 字段边界

主展示区不得展示以下字段：

```text
sheet
row
column
raw_value
source_file
import_id
source_id
source_ref
source_label
debug
raw
metadata
intermediate
generated_at
```

允许存在但默认隐藏：

| 字段 | 使用边界 |
|---|---|
| `sources` | 只进入 `SourceEvidencePanel` 或折叠证据抽屉 |
| `metadata` | 当前主展示区不直接展示；必要时后端先转成业务字段 |
| `generated_at` | 可用于数据包状态、运行信息，不进入关系节点 |
| `mapping_sources` | 只用于来源证据或后端投影追溯 |

## 9. 后续动作

| 优先级 | 动作 | 说明 |
|---|---|---|
| 1 | 执行 BE-1：安全能力映射页投影补强 | 把 `serviceModuleMeasureLinks`、`workFunctionsByLayer`、`processTree` 从 ViewModel 继续下沉 |
| 2 | 执行 FE-0 / FE-2：能力页画布验收收敛 | 能力页是三页关系画布基准，前端结构需先稳定 |
| 3 | 执行 BE-2：信息化环境维度页投影 | 输出环境页页面级投影后再做前端 |
| 4 | 执行 BE-3：LC-AP 页投影 | 先明确服务分类、模块 / 措施、产品组件弱关系 |
| 5 | 更新 `api-field-contract.md` | 在 BE-1/2/3 实现后，把“已实现接口”和“规划接口”分段整理 |
