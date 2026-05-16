# capability-workbench.json 实现规格 V1

本文档定义 `capability-workbench.json` 的目标数据契约、字段迁移规则、`dataClient` 兼容策略和后续代码实施验收标准。

本轮只做实现规格设计，不修改前端代码、不修改现有 JSON、不修改 ETL、不修改数据库 schema、不重新导入数据、不运行 npm、不启动前端。

## 1. 页面定位

`capability-workbench.json` 服务路由：

```text
/capability-mapping
```

页面类型：

```text
capability-mapping-workbench
```

定位：

```text
P1 核心工作台
```

主语：

```text
安全能力 / 关注点
```

作用：

- 承载安全能力映射页的关系工作台数据。
- 支撑技术视角、管理视角、流程、标准、模块、作用域和来源证据。
- 与 `capability-tree.json` 分工：`capability-tree.json` 只做目录树，`capability-workbench.json` 做关系工作台。

边界：

- 不承载完整信息化环境工作台数据。
- 不承载 LC-AP 专项投影数据。
- 不替代 `capability-tree.json`。
- 不直接承担安全知识目录、专项知识维护和标准框架全文数据。

## 2. `capability-tree.json` 职责收缩

后续 `capability-tree.json` 只保留：

- `capability_category`
- `capability_domain`
- `capability`
- `capability_focus`
- `tree_order` 或等价排序字段
- 展开 / 折叠所需目录结构
- 目录统计字段，如分类数、L1 数、L2 数、关注点数

以下内容应迁出 `capability-tree.json`：

- 安全技术服务；
- 安全技术模块；
- 安全技术措施；
- 安全工作；
- 流程映射；
- 标准 / 框架映射；
- 作用域映射；
- 来源证据全文；
- 页面关系表所需复杂数据；
- `metadata.object_key`、`metadata.source_count` 等非展示字段。

迁移后，能力目录树不再承担页面业务关系拼装职责，前端组件也不应从树节点中寻找复杂关系。

## 3. 推荐顶层结构

与 `environment-workbench.json` 保持一致：

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

字段职责：

| 顶层字段 | 职责 |
|---|---|
| `meta` | 数据版本、生成时间、统计、来源包说明 |
| `page` | 页面路由、页面类型、页面主语和边界 |
| `navigator` | 能力目录导航和索引，不包含完整关系 |
| `overview` | 当前能力 / 关注点概览结构 |
| `relationshipGroups` | 技术、管理、流程、标准、模块、作用域等关系分组 |
| `objects` | 标准对象字典，按类型组织 |
| `relations` | 标准关系清单，按目标语义关系名输出 |
| `evidenceRefs` | 来源证据引用 ID |
| `compatibility` | 旧 `capability-tree.json` 关系字段 fallback 说明 |

建议 `meta`：

```json
{
  "version": "v1",
  "viewModelVersion": "capability-workbench-1.0",
  "generated_at": "string",
  "sourcePackages": ["capability-tree.json", "management-knowledge.json"],
  "apiEquivalent": "/api/v1/capabilities/workspace-projection",
  "stats": {
    "categories": 0,
    "domains": 0,
    "capabilities": 0,
    "focuses": 0,
    "technicalServices": 0,
    "technologyModules": 0,
    "technicalMeasures": 0,
    "securityWorks": 0,
    "processReferences": 0,
    "standardMappings": 0,
    "relations": 0,
    "evidenceRefs": 0
  }
}
```

建议 `page`：

```json
{
  "route": "/capability-mapping",
  "pageType": "capability-mapping-workbench",
  "priority": "P1",
  "subject": "capability / capability_focus",
  "title": "安全能力映射",
  "description": "以安全能力和关注点为主语，展示技术视角、管理视角、流程、标准、模块、作用域和来源证据。"
}
```

## 4. navigator 结构

左侧能力导航按以下层级组织：

1. `capability_category`
2. `capability_domain`
3. `capability`
4. `capability_focus`

`navigator` 只服务目录浏览，不塞完整关系数据。

推荐结构：

```json
{
  "defaultSelectedFocusId": "string",
  "tree": [
    {
      "id": "category_id",
      "type": "capability_category",
      "code": "T",
      "name": "安全技术能力",
      "children": [
        {
          "id": "domain_id",
          "type": "capability_domain",
          "code": "T-AS",
          "name": "基础架构安全",
          "children": [
            {
              "id": "capability_id",
              "type": "capability",
              "code": "T-AS.AD",
              "name": "网络安全体系架构管控能力",
              "focusCount": 0,
              "children": [
                {
                  "id": "focus_id",
                  "type": "capability_focus",
                  "code": "T-AS.AD-01",
                  "name": "关注点名称",
                  "linkedServiceCount": 0,
                  "linkedWorkCount": 0
                }
              ]
            }
          ]
        }
      ]
    }
  ],
  "indexes": {
    "categoryIds": [],
    "domainIds": [],
    "capabilityIds": [],
    "focusIds": []
  }
}
```

说明：

- 树节点只放展示、筛选和定位字段。
- 技术服务、安全工作、流程、来源证据等必须进入 workbench 关系区。
- 旧 `capability-tree.json.focuses[].services` 只作为过渡兼容，不作为新组件输入。

## 5. overview 结构

选中能力 / 关注点后，概览字段至少包括：

- `code`
- `title`
- `object_type`
- `parent_category`
- `parent_domain`
- `parent_capability`
- `focus_count`
- `linked_service_count`
- `linked_work_count`
- `linked_process_count`
- `linked_module_count`
- `linked_standard_count`
- `evidence_ref_count`

推荐结构：

```json
{
  "selectedObjectId": "string",
  "object": {
    "id": "string",
    "type": "capability_focus",
    "code": "string",
    "name": "string",
    "description": "string",
    "status": "active"
  },
  "context": {
    "parentCategory": {},
    "parentDomain": {},
    "parentCapability": {}
  },
  "counts": {
    "focuses": 0,
    "technicalServices": 0,
    "securityWorks": 0,
    "processes": 0,
    "technologyModules": 0,
    "technicalMeasures": 0,
    "standards": 0,
    "evidenceRefs": 0
  },
  "tags": [],
  "evidenceRefs": []
}
```

## 6. relationshipGroups 结构

至少定义以下关系组：

| 分组 ID | 标题 | 关系类型 |
|---|---|---|
| `capability-hierarchy` | 能力层级 | `belongs_to` |
| `focus-list` | 关注点清单 | `belongs_to` |
| `technical-mapping` | 技术视角映射 | `supports_focus`、`applies_to_scope` |
| `management-mapping` | 管理视角映射 | `maps_to_work` |
| `process-mapping` | 流程映射 | `maps_to_process` |
| `standard-mapping` | 标准 / 框架映射 | `maps_to_standard` |
| `module-measure-mapping` | 技术模块 / 技术措施映射 | `implements_service`、`implemented_by_module`、`has_measure` |
| `scope-mapping` | 作用域映射 | `applies_to_scope` |
| `source-evidence` | 来源证据引用 | `has_evidence` |

推荐结构：

```json
[
  {
    "id": "technical-mapping",
    "title": "技术视角映射",
    "relationTypes": ["supports_focus", "applies_to_scope", "implemented_by_module", "has_measure"],
    "items": []
  }
]
```

## 7. objects 标准对象清单

至少包括：

- `capability_category`
- `capability_domain`
- `capability`
- `capability_focus`
- `security_technical_service`
- `security_technology_module`
- `security_technical_measure`
- `security_work`
- `process_group`
- `process_reference`
- `standard_framework`
- `standard_control`
- `scope_type`

标准对象字段：

```json
{
  "id": "string",
  "type": "capability_focus",
  "code": "string|null",
  "name": "string",
  "description": "string|null",
  "category": "string|null",
  "status": "active|draft|deprecated|pending",
  "tags": [],
  "evidenceRefs": []
}
```

说明：

- 对外统一使用 `name`，export 层可从旧字段 `title` 映射。
- 标准对象可以来自多个旧数据包，但同一对象在 `objects` 中只出现一次。
- `standard_framework`、`standard_control` 是目标对象类型；如果当前数据不足，第一版可输出空字典或不输出对应关系。

## 8. relations 标准关系清单

至少包括以下目标语义关系名：

| relation type | 起点 | 终点 | 说明 |
|---|---|---|---|
| `belongs_to` | 子级能力对象 | 父级能力对象 | 能力层级 |
| `supports_focus` | `security_technical_service` | `capability_focus` | 服务支撑关注点 |
| `implements_service` | `security_technology_module` | `security_technical_service` | 当前后端关系口径 |
| `implemented_by_module` | `security_technical_service` | `security_technology_module` | 前端正向展示关系 |
| `has_measure` | `security_technical_service` / `security_technology_module` | `security_technical_measure` | 服务 / 模块关联措施 |
| `maps_to_work` | `capability_focus` | `security_work` | 关注点映射安全工作 |
| `maps_to_process` | `capability` / `capability_focus` | `process_group` / `process_reference` | 能力 / 关注点映射流程 |
| `maps_to_standard` | `capability` / `capability_focus` | `standard_control` | 能力映射标准控制项 |
| `applies_to_scope` | `security_technical_service` / `capability_focus` | `scope_type` | 作用域映射 |

如果当前库或导出逻辑中关系名不同，本规格记录为“目标语义关系名”，本轮不改底层关系名。

标准关系字段：

```json
{
  "id": "string",
  "type": "supports_focus",
  "sourceId": "string",
  "sourceType": "security_technical_service",
  "targetId": "string",
  "targetType": "capability_focus",
  "label": "支撑关注点",
  "status": "active",
  "confidence": "exact|derived|pending",
  "evidenceRefs": []
}
```

## 9. 字段迁移规则

### 9.1 留在 `capability-tree.json`

| 字段 | 说明 |
|---|---|
| `generated_at` | 目录树生成时间 |
| `stats.categories`、`stats.domains`、`stats.capabilities`、`stats.focuses` | 目录树统计 |
| `categories` | 树根 |
| `categories[].domains` | L1 能力 |
| `domains[].capabilities` | L2 能力 |
| `capabilities[].focuses` | 关注点目录 |
| `id`、`type`、`code`、`title/name`、`description`、`status` | 导航基础字段 |
| `tree_order` / `order` | 目录排序字段 |

### 9.2 迁入 `capability-workbench.json`

| 当前字段 / 数据块 | 目标位置 |
|---|---|
| `focuses[].services` | `objects.security_technical_service`、`relations.supports_focus` |
| `focuses[].scope_mappings` | `relationshipGroups.scope-mapping`、`relations.applies_to_scope` |
| `focuses[].security_works` | `objects.security_work`、`relations.maps_to_work` |
| `focuses[].process_mappings` | `objects.process_group`、`objects.process_reference`、`relations.maps_to_process` |
| `management-knowledge.json.service_module_index` 局部投影 | `relations.implemented_by_module`、`objects.security_technology_module` |
| `management-knowledge.json.security_technical_measures` 局部投影 | `relations.has_measure`、`objects.security_technical_measure` |
| 后续标准映射数据 | `objects.standard_framework`、`objects.standard_control`、`relations.maps_to_standard` |

### 9.3 进入 `shared-lookups.json`

- 对象类型展示名；
- 关系类型展示名；
- 状态标签；
- 字段展示名；
- `scope_type` 简表；
- 安全技术模块 / 措施简表；
- `service_module_index` 共享索引，如多个页面都需要全量索引。

### 9.4 进入 `source-evidence.json`

- `sources`
- `mapping_sources`
- `sheet`
- `row`
- `column`
- `cell`
- `raw_value`
- `source_file_id`

`capability-workbench.json` 只保留 `evidenceRefs`。

### 9.5 过渡兼容字段

| 字段 | 过渡方式 |
|---|---|
| `focuses[].services` | 旧页面 fallback，后续只由 `capability-workbench.json` 消费 |
| `focuses[].security_works` | 旧页面 fallback，后续迁入 management relationship group |
| `focuses[].process_mappings` | 旧页面 fallback，后续迁入 process relationship group |
| `metadata` | 只保留白名单展示字段，其余不应由前端消费 |
| `unlinked_focuses` | 如无业务消费，可后续迁入 validation 或兼容区 |

不应由前端继续消费：

- `metadata.object_key`
- `metadata.source_count`
- `sources[].sheet`
- `sources[].row`
- `sources[].raw_value`
- 任何 Excel Sheet 专用字段。

## 10. 与 `environment-workbench.json` 的一致性

一致性要求：

- 顶层结构一致：`meta`、`page`、`navigator`、`overview`、`relationshipGroups`、`objects`、`relations`、`evidenceRefs`、`compatibility`。
- 标准对象字段一致：`id`、`type`、`code`、`name`、`description`、`category`、`status`、`tags`、`evidenceRefs`。
- 标准关系字段一致：`id`、`type`、`sourceId`、`sourceType`、`targetId`、`targetType`、`label`、`status`、`confidence`、`evidenceRefs`。
- 来源证据都通过 `evidenceRefs`。

差异要求：

- `capability-workbench` 主语是安全能力 / 关注点。
- `environment-workbench` 主语是信息化环境 / 信息化对象。
- 不为了结构一致而抹平业务语义。
- 能力页不承载完整环境对象工作台，环境页不承载完整能力目录树。

## 11. dataClient 后续兼容策略

后续代码阶段建议新增：

```js
getCapabilityTree()
getCapabilityWorkbench()
```

策略：

1. `capability-tree.json` 继续作为目录树数据。
2. `capability-workbench.json` 作为关系工作台数据。
3. `dataClient` 优先读取 `/api/v1/capabilities/workspace-projection` 或 `capability-workbench.json`。
4. 如果新数据包不存在，旧页面可以 fallback 到 `capability-tree.json` 中的关系字段。
5. fallback 只作为过渡，不应长期保留。
6. 新 UI 不应直接从 `capability-tree.json` 读取关系数据。

建议兼容状态：

```json
{
  "dataState": "fallback_legacy_capability_tree",
  "warning": "capability-workbench.json missing; using capability-tree.json relationship fields as transitional fallback."
}
```

## 12. 验收标准

后续实现阶段至少满足：

| 验收项 | 标准 |
|---|---|
| 树 / 工作台分离 | 能清楚区分 `capability-tree.json` 和 `capability-workbench.json` |
| 页面支撑 | 能支撑 `/capability-mapping` |
| 技术视角 | 能展示关注点、作用域、服务、模块、措施 |
| 管理视角 | 能展示安全工作、流程、职能 |
| 标准映射 | 能预留或展示标准 / 框架映射 |
| 来源证据 | 通过 `evidenceRefs` 引用 |
| 边界 | 不侵入 `environment-workbench` |
| 边界 | 不侵入 `lifecycle-workbench` |
| 工程边界 | 不修改 schema / ETL |
| 工程边界 | 不修改前端代码，除非进入后续实现阶段 |

## 13. 不建议现在做的事项

当前不建议：

- 不直接删除 `capability-tree.json` 里的旧关系字段。
- 不直接重写前端组件。
- 不把环境对象关系塞进 `capability-workbench.json`。
- 不把 LC-AP 阶段关系塞进 `capability-workbench.json`。
- 不改底层 relation type。
- 不改数据库 schema。
- 不重跑全量 ETL。
- 不启动 Phase 7 或 maturity。
