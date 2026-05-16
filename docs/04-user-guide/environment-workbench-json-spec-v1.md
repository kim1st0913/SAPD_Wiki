# environment-workbench.json 实现规格 V1

本文档定义 `environment-workbench.json` 的目标数据契约、字段迁移规则、`dataClient` 兼容策略和后续代码实施步骤。

本轮只做实现规格设计，不修改前端代码、不修改现有 JSON、不修改 ETL、不修改数据库 schema、不重新导入数据、不运行 npm、不启动前端。

## 1. 页面定位

`environment-workbench.json` 服务页面：

```text
/environment-mapping
```

页面类型：

```text
environment-mapping-workbench
```

定位：

```text
P1 核心工作台
```

主语：

```text
信息化环境 / 信息化对象
```

边界：

- 这是 Frontend Baseline 1.0 的 P1 双核心工作台之一。
- 不是新 Sheet 扩展。
- 不是 maturity 模块。
- 不进入 Phase 7 多格式增强。
- 不直接复用安全能力映射页主语。
- 不要求立刻重构 AppShell 或全站导航。

页面目标：

- 从信息化环境、环境分段、信息化对象出发，查看对象关联的安全能力作用域。
- 展示作用域对应的安全技术服务、技术模块、技术措施、安全系统和产品。
- 支撑对象 / 服务与安全能力、关注点的反向关联。
- 来源证据默认通过引用展开，不把来源全文堆到主 JSON 结构中。

## 2. 当前可复用数据来源

### 2.1 主要来源

当前最重要的可复用来源是：

```text
frontend/capability-browser/public/data/management-knowledge.json
```

其中环境页核心数据位于：

```text
management-knowledge.json.environment_scope_tree
```

当前 `environment_scope_tree` 已包含：

| 数据 | 当前字段 |
|---|---|
| 信息化环境 | `environment_scope_tree[]` |
| 信息化对象 | `environment_scope_tree[].objects[]` |
| 环境分段 | `objects[].segments[]` |
| 对象与作用域映射 | `objects[].scope_mappings[]` |
| 作用域 | `scope_mappings[].scope` |
| 安全技术服务 | `scope_mappings[].services[]` |
| 安全技术模块 | `services[].modules[]` |
| 安全系统 | `modules[].systems[]` |
| 产品 | `modules[].products[]` |
| 来源 | 多层级 `sources`、`mapping_sources` |

当前统计：

| 指标 | 数量 |
|---|---:|
| `information_environments` | 10 |
| `information_objects` | 66 |
| `environment_scope_mappings` | 96 |
| `environment_service_mappings` | 1256 |
| `environment_module_mappings` | 3962 |

### 2.2 当前 JSON 中可复用对象

| 对象 | 当前来源 |
|---|---|
| `information_environment` | `management-knowledge.json.environment_scope_tree[]` |
| `environment_segment` | `environment_scope_tree[].objects[].segments[]` |
| `information_object` | `environment_scope_tree[].objects[]` |
| `scope_type` | `environment_scope_tree[].objects[].scope_mappings[].scope`；也存在于 `management-knowledge.json.scope_types` |
| `security_technical_service` | `scope_mappings[].services[]` |
| `security_technology_module` | `services[].modules[]`；也存在于 `management-knowledge.json.security_technology_modules` |
| `security_technical_measure` | `management-knowledge.json.security_technical_measures`，后续需按对象 / 服务投影进入环境工作台 |
| `security_system` | `modules[].systems[]` |
| `product` | `modules[].products[]` |
| `capability` / `capability_focus` | 可从服务编码、能力树和后续 capability workbench 投影反向关联 |

### 2.3 当前 export 逻辑中已有关系

当前 `src/sapd_wiki/exports.py` 的 `export_management_knowledge()` 已经聚合出环境关系树，核心逻辑包括：

- `objects_by_environment`
- `object_to_segments`
- `scopes_by_object`
- `services_by_object`
- `scopes_by_service`
- `modules_by_service`
- `systems_by_module`
- `products_by_module`
- `environments_by_module`
- `relation_sources()`
- `environment_scope_tree`

这说明下一阶段不需要先改 schema 或重跑全量 ETL，可以先新增 export 方法，把当前可用关系重组为稳定页面数据契约。

### 2.4 不应继续承担环境数据职责的文件

| 文件 | 原因 |
|---|---|
| `capability-tree.json` | 应回归能力目录树，不承担环境工作台数据 |
| `lifecycle-knowledge.json` | 应收敛为 LC-AP 受控专项关系投影，不承担环境数据 |
| `management-knowledge.json` | 可作为过渡 fallback，但不应长期作为 `/environment-mapping` 主数据源 |

## 3. 目标 JSON 顶层结构

建议目标结构：

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
| `meta` | 数据版本、生成时间、来源版本、统计 |
| `page` | 页面定位、路由、页面类型、主语 |
| `navigator` | 左侧导航树和索引 |
| `overview` | 默认对象或当前对象的概览结构模板 |
| `relationshipGroups` | 页面关系分组定义和当前可消费关系组 |
| `objects` | 标准对象字典，按类型组织 |
| `relations` | 标准关系清单，使用统一 relation type |
| `evidenceRefs` | 本数据包引用到的来源证据 ID 列表 |
| `compatibility` | 兼容旧数据包和 fallback 状态说明 |

建议 `meta`：

```json
{
  "version": "v1",
  "viewModelVersion": "environment-workbench-1.0",
  "generated_at": "string",
  "sourcePackage": "management-knowledge.json",
  "stats": {
    "informationEnvironments": 0,
    "environmentSegments": 0,
    "informationObjects": 0,
    "scopeTypes": 0,
    "technicalServices": 0,
    "technologyModules": 0,
    "technicalMeasures": 0,
    "securitySystems": 0,
    "products": 0,
    "relations": 0,
    "evidenceRefs": 0
  }
}
```

建议 `page`：

```json
{
  "route": "/environment-mapping",
  "pageType": "environment-mapping-workbench",
  "priority": "P1",
  "subject": "information_environment / information_object",
  "title": "信息化环境安全能力映射",
  "description": "以信息化环境和信息化对象为主语，展示对象、作用域、安全技术服务、模块、措施、系统、产品和能力之间的映射关系。"
}
```

## 4. navigator 结构

信息化环境维度页左侧导航建议以“环境 -> 分段 -> 对象”为主，作用域作为筛选或对象下摘要，不建议把 `scope_type` 提升为第一层导航主语。

推荐结构：

```json
{
  "defaultSelectedObjectId": "string",
  "tree": [
    {
      "id": "env_id",
      "type": "information_environment",
      "code": null,
      "name": "信息化环境",
      "objectCount": 0,
      "children": [
        {
          "id": "segment_id",
          "type": "environment_segment",
          "name": "环境分段",
          "objectCount": 0,
          "children": [
            {
              "id": "object_id",
              "type": "information_object",
              "name": "信息化对象",
              "scopeCount": 0,
              "serviceCount": 0,
              "moduleCount": 0
            }
          ]
        }
      ]
    }
  ],
  "indexes": {
    "environmentIds": [],
    "segmentIds": [],
    "objectIds": [],
    "scopeTypeIds": []
  },
  "filters": {
    "scopeTypes": [],
    "objectTypes": [],
    "environments": []
  }
}
```

说明：

- 一级导航：`information_environment`。
- 二级导航：`environment_segment`。
- 三级导航：`information_object`。
- `scope_type` 不作为默认树层级，但应作为筛选项和对象详情里的关系节点。
- 如果某对象没有明确环境分段，可归入 `未分组` 逻辑分组，但主数据字段应保留为空或 `null`，不要伪造成正式分段对象。

## 5. overview 结构

选中对象后的概览建议结构：

```json
{
  "selectedObjectId": "string",
  "object": {
    "id": "string",
    "type": "information_object",
    "code": "string",
    "name": "string",
    "description": "string",
    "status": "active"
  },
  "context": {
    "environment": {},
    "segments": []
  },
  "counts": {
    "scopeTypes": 0,
    "technicalServices": 0,
    "technologyModules": 0,
    "technicalMeasures": 0,
    "securitySystems": 0,
    "products": 0,
    "capabilities": 0,
    "focuses": 0
  },
  "tags": [],
  "evidenceRefs": []
}
```

必须支持的概览字段：

- 对象名称；
- 对象类型；
- 所属信息化环境；
- 所属环境分段；
- 关联作用域数量；
- 关联服务数量；
- 关联模块 / 措施数量；
- 关联系统 / 产品数量。

## 6. relationshipGroups 结构

`relationshipGroups` 用于直接服务页面关系视图，不要求组件再从原始树里推断关系。

推荐结构：

```json
[
  {
    "id": "environment-object",
    "title": "环境 / 分段 / 对象",
    "relationTypes": ["contains_segment", "contains_object"],
    "items": []
  },
  {
    "id": "object-scope",
    "title": "对象与作用域",
    "relationTypes": ["applies_to_scope"],
    "items": []
  },
  {
    "id": "scope-service",
    "title": "作用域与安全技术服务",
    "relationTypes": ["protects_object"],
    "items": []
  },
  {
    "id": "service-module-measure",
    "title": "服务与技术模块 / 技术措施",
    "relationTypes": ["implemented_by_module", "has_measure"],
    "items": []
  },
  {
    "id": "module-system-product",
    "title": "模块与安全系统 / 产品",
    "relationTypes": ["part_of_system", "maps_to_product"],
    "items": []
  },
  {
    "id": "capability-links",
    "title": "对象 / 服务与安全能力关联",
    "relationTypes": ["supports_capability", "supports_focus"],
    "items": []
  },
  {
    "id": "source-evidence",
    "title": "来源证据引用",
    "relationTypes": ["has_evidence"],
    "items": []
  }
]
```

至少定义以下关系组：

1. 环境 / 分段 / 对象；
2. 对象与作用域；
3. 作用域与安全技术服务；
4. 服务与技术模块 / 技术措施；
5. 模块与安全系统 / 产品；
6. 对象 / 服务与安全能力关联；
7. 来源证据引用。

## 7. objects 标准对象清单

`objects` 建议按类型分组，避免页面遍历混合数组：

```json
{
  "information_environment": {},
  "environment_segment": {},
  "information_object": {},
  "scope_type": {},
  "security_technical_service": {},
  "security_technology_module": {},
  "security_technical_measure": {},
  "security_system": {},
  "product": {},
  "capability": {},
  "capability_focus": {}
}
```

标准对象字段：

```json
{
  "id": "string",
  "type": "string",
  "code": "string|null",
  "name": "string",
  "description": "string|null",
  "category": "string|null",
  "status": "active|draft|deprecated|pending",
  "tags": [],
  "evidenceRefs": []
}
```

字段说明：

- 对外统一使用 `name`，export 层可从旧字段 `title` 映射。
- `code` 允许为空，但对象 ID 必须稳定。
- `evidenceRefs` 只保存引用，不保存 `sheet`、`row`、`raw_value`。
- `security_technology_module` 和 `security_technical_measure` 必须保持语义区分，不能混成同一类标签。

## 8. relations 标准关系清单

`relations` 建议使用扁平标准关系数组，便于页面、调试和后续 API 同构。

标准关系字段：

```json
{
  "id": "string",
  "type": "protects_object",
  "sourceId": "string",
  "sourceType": "security_technical_service",
  "targetId": "string",
  "targetType": "information_object",
  "label": "保护对象",
  "status": "active",
  "confidence": "exact|derived|pending",
  "evidenceRefs": []
}
```

至少支持以下关系：

| relation type | 起点 | 终点 | 说明 |
|---|---|---|---|
| `contains_segment` | `information_environment` | `environment_segment` | 环境包含分段 |
| `contains_object` | `environment_segment` 或 `information_environment` | `information_object` | 分段 / 环境包含对象 |
| `applies_to_scope` | `information_object` | `scope_type` | 对象适用作用域 |
| `protects_object` | `security_technical_service` | `information_object` | 服务保护对象 |
| `deployed_in_environment` | `security_technology_module` / `security_system` / `product` | `information_environment` | 模块 / 系统 / 产品部署或适用于环境 |
| `implements_service` | `security_technology_module` | `security_technical_service` | 模块实现服务 |
| `implemented_by_module` | `security_technical_service` | `security_technology_module` | 服务由模块实现，供前端正向展示 |
| `has_measure` | `security_technical_service` / `security_technology_module` | `security_technical_measure` | 服务 / 模块关联措施 |
| `part_of_system` | `security_technology_module` | `security_system` | 模块属于安全系统 |
| `maps_to_product` | `security_system` / `security_technology_module` | `product` | 系统 / 模块映射产品 |
| `supports_capability` | `security_technical_service` / `scope_type` / `information_object` | `capability` | 支撑 L2 能力 |
| `supports_focus` | `security_technical_service` / `scope_type` / `information_object` | `capability_focus` | 支撑关注点 |

说明：

- `implements_service` 是当前后端关系口径。
- `implemented_by_module` 可作为前端展示用反向关系；export 层生成即可，组件不反向推断。
- `supports_capability` 和 `supports_focus` 可从服务编码、能力树或后续 capability workbench 中生成，若缺少可靠数据，应标记为 `pending` 或暂不输出。

## 9. 字段迁移规则

### 9.1 从 `management-knowledge.json.environment_scope_tree` 迁入

| 当前字段 | 目标字段 |
|---|---|
| `environment_scope_tree[]` | `objects.information_environment`、`navigator.tree[]` |
| `environment_scope_tree[].objects[]` | `objects.information_object`、`navigator`、`overview` |
| `objects[].segments[]` | `objects.environment_segment`、`relations.contains_segment`、`relations.contains_object` |
| `objects[].scope_mappings[]` | `relationshipGroups.object-scope`、`relations.applies_to_scope` |
| `scope_mappings[].scope` | `objects.scope_type` |
| `scope_mappings[].services[]` | `objects.security_technical_service`、`relations.protects_object` |
| `services[].modules[]` | `objects.security_technology_module`、`relations.implemented_by_module` |
| `modules[].systems[]` | `objects.security_system`、`relations.part_of_system` |
| `modules[].products[]` | `objects.product`、`relations.maps_to_product` |
| `sources`、`mapping_sources` | `source-evidence.json`；本文件只保留 `evidenceRefs` |

### 9.2 仍保留在 `management-knowledge.json`

| 字段 | 保留原因 |
|---|---|
| `work_function_layers` | 安全工作职能目录 / 专项知识维护 |
| `security_processes` | 安全职能流程目录 / 专项知识维护 |
| `gbt_42446_references` | 岗位 / 职能参考目录 |
| `gartner_roles` | 岗位 / 职能参考目录 |
| `assets` | 安全工作职能清单图片资产 |

### 9.3 后续进入 `shared-lookups.json`

| 字段 | 说明 |
|---|---|
| `scope_types` | 作用域字典 |
| `security_technology_modules` 简表 | 模块字典 |
| `security_technical_measures` 简表 | 措施字典 |
| `service_module_index` | 共享服务模块索引，或按页面拆局部投影 |
| 对象类型 / 关系类型展示名 | `objectTypeLabels`、`relationTypeLabels` |
| 状态 / 字段展示名 | `statusLabels`、`fieldLabels` |

### 9.4 后续进入 `source-evidence.json`

| 字段 | 说明 |
|---|---|
| `sources` | 对象来源 |
| `mapping_sources` | 关系来源 |
| `sheet` | 来源 Sheet |
| `row` | 来源行 |
| `column` | 来源列 |
| `cell` | 来源单元格 |
| `raw_value` | 原始值 |
| `source_file_id` | 来源文件 |

## 10. dataClient 兼容策略

后续代码阶段建议：

1. 在 `DATA_PATHS` 中新增：

```js
environmentWorkbench: "./public/data/environment-workbench.json"
```

2. 在 API 包路径中新增等价入口，例如：

```js
environmentWorkbench: "/api/v1/data-packages/environment-workbench"
```

或后续新增更明确接口：

```text
/api/v1/environments/workbench
```

3. 新增方法：

```js
getEnvironmentWorkbench()
```

4. 若 `environment-workbench.json` 不存在，可以 fallback 到旧：

```text
management-knowledge.json.environment_scope_tree
```

5. fallback 只作为过渡，不作为新页面长期数据源。

6. 前端页面不应直接读取旧结构。兼容转换应在 `dataClient` 或 ViewModel 里完成，并输出稳定的 `environment-workbench` ViewModel。

建议 fallback 状态：

```json
{
  "dataState": "fallback_legacy_management_package",
  "warning": "environment-workbench.json missing; using management-knowledge.json.environment_scope_tree as transitional fallback."
}
```

## 11. export / ViewModel 责任边界

| 层 | 职责 | 禁止 |
|---|---|---|
| export | 聚合环境、对象、作用域、服务、模块、措施、系统、产品和能力关联；生成标准对象和关系；生成 `evidenceRefs` | 不处理页面交互状态 |
| ViewModel | 轻量排序、分组、默认选中对象、空状态、展示标签 | 不做跨表匹配、不做编码纠错、不做业务关系推断 |
| `dataClient` | 读取稳定 JSON / API；处理 fallback；处理缺失文件和版本兼容 | 不理解 Excel Sheet、不清洗脏数据 |
| 前端组件 | 消费稳定 ViewModel，展示导航、概览、关系组、表格和来源入口 | 不直接读取原始 Sheet 语义、不去重、不纠错 |

前端不处理：

- Excel Sheet 名称；
- 合并单元格继承；
- 服务编码拆解；
- 对象去重；
- 模块 / 措施语义判定；
- 来源字段展开；
- 关系反向推断。

## 12. 数据清洗规则

### 12.1 空值处理

- `null` 和空字符串保留为空值，不生成伪对象。
- 页面展示时由 ViewModel 转成 `暂无数据`、`待补充`、`未关联` 等文案。
- 统计字段缺失时置为 `0`。

### 12.2 占位值处理

| 原始值 | 处理 |
|---|---|
| `/` | 表示无适用对象或无映射，不生成对象和关系 |
| `...` / `……` | 作为展示省略标记时不生成正式对象；如已有明确对象 ID，则只作为 UI 截断文案 |
| `未分组` | 仅作为导航虚拟分组，不写入正式 `environment_segment` 主对象 |
| `N/A(...)` | 标记为 `pending` 或说明类，不作为正式措施 |
| 空白合并单元格 | export 层按既有规则继承或保留为空，组件不处理 |

### 12.3 重复对象合并

- `information_environment`：按 `type + title` 合并。
- `environment_segment`：按 `type + parent_environment + title` 合并。
- `information_object`：按 `type + environment_segment + title` 合并；同名跨分段对象保留上下文。
- `scope_type`：按 `type + code` 合并。
- `security_technical_service`：按 `type + code` 合并。
- `security_technology_module`：按 `type + title` 合并，必要时加系统上下文。
- `security_technical_measure`：按 `type + name + related_service` 合并。
- `security_system`：按 `type + title` 合并。
- `product`：按 `type + title` 合并。

### 12.4 技术模块与技术措施区分

- `security_technology_module` 是能力构件 / 技术模块，通常可关联安全系统和产品。
- `security_technical_measure` 是具体控制措施 / 实施措施 / 技术措施，通常作为服务或模块的细粒度落实标签。
- 两者不得混成单一 `moduleOrMeasure` 字段。
- 如果来源字段无法可靠区分，export 层应标记为 `pending`，不要由前端组件猜测。

### 12.5 source evidence 处理

- 主 JSON 中不堆 `sheet`、`row`、`column`、`cell`、`raw_value` 全文。
- 对象和关系只保留 `evidenceRefs`。
- `source-evidence.json` 负责保存完整来源证据。
- 如果 `source-evidence.json` 暂未实施，第一版可在 `environment-workbench.json.compatibility.embeddedEvidence` 标记为 `true`，但页面主展示仍不得直接渲染来源字段。

## 13. 最小实施步骤

下一阶段真正改代码时，建议顺序：

1. 新增 export 方法：

```text
export_environment_workbench()
```

输出：

```text
frontend/capability-browser/public/data/environment-workbench.json
```

2. 新增 CLI 入口：

```text
python3 scripts/sapd_wiki.py export-environment-workbench
```

3. 新增或扩展 API 数据包入口：

```text
/api/v1/data-packages/environment-workbench
```

或：

```text
/api/v1/environments/workbench
```

4. 新增 `dataClient` 方法：

```text
getEnvironmentWorkbench()
```

5. 在 ViewModel 中将旧 `management.environment_scope_tree` 转换逻辑迁移到稳定 `environment-workbench` 消费。

6. 接入信息化环境映射页 ViewModel。

7. 最后再做前端组件展示。

8. 不优先改 schema / ETL。只有当 export 层无法可靠生成字段时，再回到数据质量或 ETL 问题清单。

## 14. 验收标准

后续实现阶段至少满足：

| 验收项 | 标准 |
|---|---|
| 独立文件 | 能独立生成 `frontend/capability-browser/public/data/environment-workbench.json` |
| 页面支撑 | 能支撑 `/environment-mapping` 页面读取 |
| 数据完整 | 能展示对象、作用域、服务、模块、措施、系统、产品、能力关联 |
| 数据边界 | 前端不再从 `management-knowledge.json` 直接读取环境映射主数据 |
| fallback | 文件缺失时可过渡 fallback 到 `management-knowledge.json.environment_scope_tree` |
| 来源证据 | 来源证据默认通过 `evidenceRefs` 引用 |
| 兼容性 | 不破坏现有 capability / lifecycle 页面数据 |
| 字段边界 | 主展示不暴露 `sheet`、`row`、`column`、`raw_value`、`source_file`、`metadata` 等非业务字段 |
| 清洗责任 | 前端组件不做 Excel 语义解析、去重、编码纠错或关系推断 |

## 15. 不建议现在做的事项

当前不建议：

- 不改数据库 schema。
- 不重跑全量 ETL。
- 不清洗原始 Excel。
- 不改前端组件。
- 不做完整 AppShell。
- 不进入 maturity。
- 不进入 Phase 7。
- 不继续扩新 Sheet。
- 不把信息化环境页当作新 Sheet 扩展。
- 不把 LC-AP 数据混入环境工作台。
- 不让前端组件继续适配 `management-knowledge.json.environment_scope_tree` 的旧结构。

## 16. 需要用户确认后再进入代码阶段的事项

进入代码阶段前建议确认：

1. 是否接受 `environment-workbench.json` 顶层结构：`meta`、`page`、`navigator`、`overview`、`relationshipGroups`、`objects`、`relations`、`evidenceRefs`、`compatibility`。
2. 是否确认 `environment_scope_tree` 作为第一版主要迁移来源。
3. 是否确认 `management-knowledge.json` 只作为过渡 fallback，不再作为环境页长期主数据源。
4. 是否允许后续新增 `export_environment_workbench()`、CLI 入口和 `dataClient.getEnvironmentWorkbench()`。
5. 是否将 `source-evidence.json` 作为第二阶段拆分，第一阶段先保留 `evidenceRefs` 契约。
