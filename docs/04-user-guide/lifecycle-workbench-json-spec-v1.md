# lifecycle-workbench.json 实现规格 V1

> 状态：`contract / implemented`

本文档定义 `lifecycle-workbench.json` 的目标数据契约、字段迁移规则、`dataClient` 兼容策略和后续代码实施验收标准。

本文最初冻结实现规格；当前数据包、`dataClient` 和 ViewModel 已实现。后续变更仍须保持
本合同的生命周期和关系粒度。

## 1. 页面定位

服务对象：

```text
LC-AP 开发安全生命周期专项关系投影
```

当前定位：

```text
开发安全 domain-module 下的受控专项关系投影
```

边界：

- 不等同于 P1 核心工作台。
- 不扩成完整开发安全模块。
- 不承载完整开发安全、DevSecOps、代码安全、供应链安全专题数据。
- 不把 LC-AP 参考库维护数据放回同页参考区。
- 不侵入 `capability-workbench.json`。
- 不侵入 `environment-workbench.json`。

页面目标：

- 围绕 LC-AP 开发安全生命周期阶段，展示阶段、活动 / 控制点、策略要求、能力映射、关注点映射、服务 / 模块关联和来源证据。
- 只做受控专项关系投影，不把开发安全专题扩展成完整模块。

## 2. `lifecycle-knowledge.json` 当前问题

当前 `lifecycle-knowledge.json` 顶层字段：

```text
generated_at
stats
application_security_development
data_lifecycle
service_module_index
```

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

当前混入的数据：

| 数据块 | 当前含义 | 归因 |
|---|---|---|
| `application_security_development.processes` | LC-AP 生命周期过程 / 阶段及关系 | 页面主视图，迁入 `lifecycle-workbench.json` |
| `application_security_development.software_development_types` | 软件开发类型参考 | 专项知识维护 |
| `application_security_development.application_system_types` | 应用系统类型和组件参考 | 专项知识维护 |
| `application_security_development.development_product_components` | 开发类产品组件 | LC-AP 弱参考或专项知识维护 |
| `application_security_development.security_technical_measures` | 生命周期相关技术措施 | 页面局部投影或共享措施字典 |
| `data_lifecycle` | LC-DT 数据生命周期 | 后续数据安全专题或独立数据生命周期工作台，不属于 LC-AP 主视图 |
| `service_module_index` | 全站服务模块索引 | `shared-lookups.json` 或页面局部投影 |
| `sources` / `metadata` | 来源和内部字段 | `source-evidence.json` 或 export 内部 |

结论：

- `lifecycle-knowledge.json` 当前混入 LC-AP、LC-DT 和共享服务模块索引。
- LC-AP 页面主视图只应使用受控专项关系投影。
- 参考库维护数据进入专项知识维护，不回到同页参考区。

## 3. 推荐顶层结构

与另外两个 workbench 保持一致：

```json
{
  "meta": {},
  "page": {},
  "navigator": {},
  "overview": {},
  "relationshipGroups": [],
  "objects": {},
  "relations": [],
  "evidenceRefs": [],
  "compatibility": {}
}
```

建议 `meta`：

```json
{
  "version": "v1",
  "viewModelVersion": "lifecycle-workbench-1.0",
  "generated_at": "string",
  "sourcePackage": "lifecycle-knowledge.json",
  "stats": {
    "lifecycleDomains": 0,
    "lifecycleStages": 0,
    "lifecycleActivities": 0,
    "lifecycleControls": 0,
    "lifecycleRequirements": 0,
    "capabilities": 0,
    "focuses": 0,
    "technicalServices": 0,
    "technologyModules": 0,
    "relations": 0,
    "evidenceRefs": 0
  }
}
```

建议 `page`：

```json
{
  "route": "/development-security/lc-ap",
  "pageType": "domain-module-relation-projection",
  "parentModule": "development-security",
  "subject": "LC-AP lifecycle stage / activity / control",
  "title": "LC-AP 开发安全生命周期关系投影",
  "description": "在开发安全专题模块下，以 LC-AP 生命周期阶段为主语展示活动、控制点、能力、服务、模块和来源证据。"
}
```

说明：`pageType` 可在实现阶段映射为现有 `domain-module` 下的专项页面，不新增菜单页面类型枚举。

## 4. navigator 结构

建议围绕 LC-AP 生命周期组织：

1. `lifecycle_domain`
2. `lifecycle_stage`
3. `lifecycle_activity`
4. `lifecycle_control`
5. `lifecycle_requirement`

如果现有数据不足，应标注为目标结构，不伪造数据。

推荐结构：

```json
{
  "defaultSelectedStageId": "string",
  "tree": [
    {
      "id": "domain_id",
      "type": "lifecycle_domain",
      "name": "LC-AP 开发安全生命周期",
      "children": [
        {
          "id": "stage_id",
          "type": "lifecycle_stage",
          "code": "string",
          "name": "阶段名称",
          "activityCount": 0,
          "controlCount": 0,
          "children": []
        }
      ]
    }
  ],
  "indexes": {
    "domainIds": [],
    "stageIds": [],
    "activityIds": [],
    "controlIds": [],
    "requirementIds": []
  }
}
```

当前 `application_security_development.processes[]` 可作为 `lifecycle_stage` 的第一版来源；`main_activities`、`security_activities`、`policy_requirements` 可分别映射到 activity / control / requirement 目标对象。

## 5. overview 结构

选中阶段 / 活动 / 控制点后，概览字段至少包括：

- `code`
- `title`
- `object_type`
- `lifecycle_domain`
- `lifecycle_stage`
- `activity_count`
- `control_count`
- `linked_capability_count`
- `linked_focus_count`
- `linked_service_count`
- `evidence_ref_count`

推荐结构：

```json
{
  "selectedObjectId": "string",
  "object": {
    "id": "string",
    "type": "lifecycle_stage",
    "code": "string",
    "name": "string",
    "description": "string",
    "status": "active"
  },
  "context": {
    "lifecycleDomain": {},
    "lifecycleStage": {}
  },
  "counts": {
    "activities": 0,
    "controls": 0,
    "requirements": 0,
    "capabilities": 0,
    "focuses": 0,
    "technicalServices": 0,
    "technologyModules": 0,
    "evidenceRefs": 0
  },
  "tags": [],
  "evidenceRefs": []
}
```

## 6. relationshipGroups 结构

至少定义：

| 分组 ID | 标题 | 关系类型 |
|---|---|---|
| `lifecycle-stages` | 生命周期阶段 | `belongs_to` |
| `activity-control` | 活动 / 控制点 | `contains_activity`、`contains_control` |
| `capability-mapping` | 能力映射 | `maps_to_capability` |
| `focus-mapping` | 关注点映射 | `maps_to_focus` |
| `service-module` | 服务 / 模块关联 | `maps_to_service`、`implemented_by_module` |
| `source-evidence` | 来源证据引用 | `has_evidence` |

推荐结构：

```json
[
  {
    "id": "activity-control",
    "title": "活动 / 控制点",
    "relationTypes": ["contains_activity", "contains_control"],
    "items": []
  }
]
```

## 7. objects 标准对象清单

至少包括：

- `lifecycle_domain`
- `lifecycle_stage`
- `lifecycle_activity`
- `lifecycle_control`
- `lifecycle_requirement`
- `capability`
- `capability_focus`
- `security_technical_service`
- `security_technology_module`

如当前数据中对象命名不同，本规格记录为目标对象类型，本轮不改底层数据。

建议映射：

| 目标对象 | 当前可能来源 |
|---|---|
| `lifecycle_domain` | 固定 LC-AP 域，或当前 `lifecycle_type` 派生 |
| `lifecycle_stage` | `application_security_development.processes[]` |
| `lifecycle_activity` | `processes[].main_activities`、`processes[].security_activities` |
| `lifecycle_control` | `processes[].security_activities` 或控制点字段，数据不足时标记目标结构 |
| `lifecycle_requirement` | `processes[].policy_requirements` |
| `security_technical_service` | `processes[].technical_services` |
| `security_technology_module` | `processes[].technology_modules` |

标准对象字段与其他 workbench 保持一致：

```json
{
  "id": "string",
  "type": "lifecycle_stage",
  "code": "string|null",
  "name": "string",
  "description": "string|null",
  "category": "string|null",
  "status": "active|draft|deprecated|pending",
  "tags": [],
  "evidenceRefs": []
}
```

## 8. relations 标准关系清单

至少包括目标语义关系名：

| relation type | 起点 | 终点 | 说明 |
|---|---|---|---|
| `belongs_to` | 子级生命周期对象 | 父级生命周期对象 | 层级归属 |
| `contains_activity` | `lifecycle_stage` | `lifecycle_activity` | 阶段包含活动 |
| `contains_control` | `lifecycle_stage` / `lifecycle_activity` | `lifecycle_control` | 阶段 / 活动包含控制点 |
| `maps_to_capability` | `lifecycle_stage` / `lifecycle_control` | `capability` | 映射 L2 能力 |
| `maps_to_focus` | `lifecycle_stage` / `lifecycle_control` | `capability_focus` | 映射关注点 |
| `maps_to_service` | `lifecycle_stage` / `lifecycle_activity` / `lifecycle_control` | `security_technical_service` | 映射服务 |
| `implemented_by_module` | `security_technical_service` | `security_technology_module` | 服务由模块实现 |

如果当前关系名不同，本规格记录目标语义关系名，后续 export 层负责转换。

标准关系字段：

```json
{
  "id": "string",
  "type": "maps_to_service",
  "sourceId": "string",
  "sourceType": "lifecycle_stage",
  "targetId": "string",
  "targetType": "security_technical_service",
  "label": "映射服务",
  "status": "active",
  "confidence": "exact|derived|pending",
  "evidenceRefs": []
}
```

## 9. 字段迁移规则

### 9.1 从 `lifecycle-knowledge.json` 迁入 `lifecycle-workbench.json`

| 当前字段 / 数据块 | 目标位置 |
|---|---|
| `application_security_development.processes` | `objects.lifecycle_stage`、`navigator.tree`、`overview` |
| `processes[].main_activities` | `objects.lifecycle_activity`、`relations.contains_activity` |
| `processes[].security_activities` | `objects.lifecycle_activity` 或 `objects.lifecycle_control` |
| `processes[].policy_requirements` | `objects.lifecycle_requirement`、`relations.contains_control` |
| `processes[].technical_services` | `objects.security_technical_service`、`relations.maps_to_service` |
| `processes[].technology_modules` | `objects.security_technology_module`、`relations.implemented_by_module` |
| `processes[].technical_measures` | 可作为后续 `security_technical_measure`，当前不列入最低对象清单 |
| `processes[].development_product_components` | 弱参考；进入专项知识维护或 compatibility，不扩成产品主数据 |
| `sources` | `source-evidence.json`；本文件保留 `evidenceRefs` |

### 9.2 后续进入 `shared-lookups.json`

- `service_module_index`
- 软件开发类型简表；
- 应用系统类型简表；
- 状态标签；
- 对象类型 / 关系类型展示名；
- 字段展示名。

### 9.3 后续进入 `source-evidence.json`

- `sources`
- `sheet`
- `row`
- `column`
- `cell`
- `raw_value`
- `source_file_id`
- `metadata.source_count`

### 9.4 进入专项知识维护

| 字段 / 数据块 | 原因 |
|---|---|
| `software_development_types` | 软件开发类型参考库 |
| `application_system_types` | 应用系统类型参考库 |
| `application_components` | 应用组件参考 |
| `development_product_components` | 开发类产品组件参考；LC-AP 页面只弱引用 |
| LC-AP 参考库维护数据 | 不放回同页参考区 |

### 9.5 过渡兼容字段

| 字段 | 过渡方式 |
|---|---|
| `lifecycle-knowledge.json` 全包 | 短期保留旧页面 fallback |
| `data_lifecycle` | 后续迁入数据安全专题，当前不进入 LC-AP workbench |
| `service_module_index` | 短期保留，后续迁入 `shared-lookups.json` |
| `metadata` | export 内部使用，不作为组件主展示字段 |

不应由前端继续消费：

- `metadata.object_key`
- `metadata.source_count`
- `sources[].sheet`
- `sources[].row`
- `sources[].raw_value`
- LC-DT 数据作为 LC-AP 页面主数据。

## 10. dataClient 后续兼容策略

后续代码阶段建议新增：

```js
getLifecycleWorkbench()
```

策略：

1. `lifecycle-workbench.json` 作为 LC-AP 受控专项关系投影数据。
2. `lifecycle-knowledge.json` 可短期保留为过渡。
3. 若新文件不存在，可 fallback 到 `lifecycle-knowledge.json.application_security_development`。
4. fallback 只作为过渡，不应长期保留。
5. 新 UI 不应长期直接读取 `lifecycle-knowledge.json`。
6. `data_lifecycle` 不进入 LC-AP workbench fallback。

建议兼容状态：

```json
{
  "dataState": "fallback_legacy_lifecycle_package",
  "warning": "lifecycle-workbench.json missing; using lifecycle-knowledge.json.application_security_development as transitional fallback."
}
```

## 11. 验收标准

后续实现阶段至少满足：

| 验收项 | 标准 |
|---|---|
| 新旧区分 | 能清楚区分 `lifecycle-knowledge.json` 和 `lifecycle-workbench.json` |
| 页面支撑 | 能支撑 LC-AP 受控专项关系投影 |
| 边界 | 不把 LC-AP 扩成完整开发安全模块 |
| 边界 | 不侵入 `capability-workbench` |
| 边界 | 不侵入 `environment-workbench` |
| 数据边界 | LC-DT 不作为 LC-AP 主数据 |
| 来源证据 | 通过 `evidenceRefs` 引用 |
| 工程边界 | 不修改 schema / ETL |
| 工程边界 | 不修改前端代码，除非进入后续实现阶段 |

## 12. 不建议现在做的事项

当前不建议：

- 不直接删除 `lifecycle-knowledge.json`。
- 不把 LC-DT 混入 LC-AP workbench。
- 不把开发安全专题扩成 DevSecOps / 代码安全 / 供应链安全全集。
- 不把 LC-AP 参考库维护数据放回同页参考区。
- 不改底层 relation type。
- 不改数据库 schema。
- 不重跑全量 ETL。
- 不启动 Phase 7 或 maturity。
