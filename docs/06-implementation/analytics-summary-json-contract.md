# analytics_summary JSON 契约

状态：`contract / implemented`
日期：2026-06-06
适用范围：Dashboard 首屏统计、模块入口统计、跨模块覆盖概览、关系图谱入口摘要

## 1. 设计目标

`analytics_summary` 是面向 dashboard 的分析型数据契约，用来把现有知识库数据从“安全咨询顾问视角的对象堆叠”整理成“以能力为核心的业务洞察摘要”。

本契约只定义未来后端 / exporter 应产出的 JSON 结构，不代表本轮已经新增数据文件、API、前端页面或 ETL 逻辑。

核心目标：

- Dashboard 第一屏优先回答“平台沉淀了哪些能力、这些能力被哪些维度支撑、哪里可以继续深入”。
- 统计口径围绕 `capability_focus` 展开，避免把标准条款数、关系边数、来源证据数当成用户主指标。
- 管理员维护类信息只放入折叠区或调试入口，不作为普通用户第一屏重点。
- 所有展示指标必须能追溯到数据包、对象粒度、关系类型、分母和分子。
- 前端只消费契约，不在组件内重新计算跨表匹配、覆盖率、评分和关系推断。

## 2. 契约边界

### 2.1 未来交付形态

建议未来同时支持离线数据包和 API：

- 离线数据包：`frontend/capability-browser/public/data/analytics-summary.json`
- API：`/api/v1/data-packages/analytics-summary`
- 前端入口：`dataClient.getAnalyticsSummary()`

当前草案不创建上述文件或接口，只作为后续实现依据。

### 2.2 数据来源

P0 阶段只聚合已经存在的工作台数据包：

| sourcePackage | 用途 | 当前状态 |
| --- | --- | --- |
| `capability-workbench` | 能力、关注点、技术服务、管理工作、流程、标准映射 | `ready` |
| `environment-workbench` | 环境、分区、对象、环境到能力的可达关系 | `ready` |
| `lifecycle-workbench` | `LC-AP` / `LC-DT` 生命周期能力支撑 | `ready` |
| `standards-index` | 标准体系索引和标准控制项总量 | `ready` |
| `content-views` | HTML / diagram / guide 页面入口 | `ready` |

SQLite 全库统计只用于管理员折叠区和口径校验，不直接作为普通用户主指标。

### 2.3 不纳入 P0 的内容

- 不引入用户复核 / 治理任务指标。
- 不引入健康分、完整度分、质量分等容易暗示用户需要治理的数据资产指标。
- 不使用 `process_activity` 作为主指标；当前数据中该对象数为 `0`，只能作为后续补数状态。
- 不把 `source_file`、`row`、`raw_value`、`metadata` 等来源追踪字段展示在 dashboard 主区域。

## 3. 顶层结构

建议顶层使用面向前端 ViewModel 的 camelCase 字段。若后端最终选择 snake_case，需要在 `dataClient` 中显式映射，不应让页面组件同时理解两套命名。

```json
{
  "meta": {},
  "page": {},
  "businessSummary": {},
  "coverageSummary": {},
  "moduleSummary": {},
  "navigationSummary": {},
  "relationshipSummary": {},
  "evidenceSummary": {},
  "adminSummary": {},
  "reconciliationSummary": {},
  "compatibility": {}
}
```

### 3.1 `meta`

`meta` 描述契约版本、生成时间、数据状态和来源包。`generated_at` 可保留在数据契约中，但不得作为 dashboard 主展示字段。

```json
{
  "version": "v1",
  "viewModelVersion": "analytics-summary-1.0",
  "generated_at": "2026-06-06 22:09:38",
  "dataState": "ready",
  "apiEquivalent": "/api/v1/data-packages/analytics-summary",
  "sourcePackages": [
    "capability-workbench",
    "environment-workbench",
    "lifecycle-workbench",
    "standards-index",
    "content-views"
  ],
  "stats": {
    "primaryGrain": "capability_focus",
    "focusCount": 91,
    "capabilityCount": 32,
    "sourcePackageCount": 5
  }
}
```

字段说明：

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `version` | string | 是 | 契约主版本，破坏性变更时递增 |
| `viewModelVersion` | string | 是 | dashboard 消费方识别版本 |
| `generated_at` | string | 是 | 后端生成时间，仅用于调试 / 管理折叠区 |
| `dataState` | enum | 是 | `ready` / `empty` / `missing_file` / `partial` |
| `apiEquivalent` | string | 否 | 离线包对应的未来 API |
| `sourcePackages` | string[] | 是 | 参与聚合的数据包 |
| `stats.primaryGrain` | string | 是 | P0 统一主统计粒度，固定为 `capability_focus` |

### 3.2 `page`

`page` 控制 dashboard 的业务标题和入口定位，避免页面再硬编码文案。

```json
{
  "title": "安全能力知识地图",
  "subtitle": "以能力关注点为核心查看技术、环境、生命周期、标准和工作方法的支撑关系",
  "primaryRoute": "/capability-mapping",
  "defaultView": "capability_overview",
  "audience": "knowledge_user",
  "adminPanelDefault": "collapsed"
}
```

## 4. 业务摘要 `businessSummary`

`businessSummary` 是 dashboard 第一屏的主数据来源。它应该强调平台覆盖的能力体系，而不是强调数据文件、导入任务或治理事项。

```json
{
  "headline": {
    "label": "能力知识地图",
    "titleMetric": {
      "id": "capability_focus_count",
      "label": "能力关注点",
      "value": 91,
      "unit": "个",
      "grain": "capability_focus",
      "sourcePackage": "capability-workbench"
    },
    "supportingText": "当前知识库围绕 3 个能力大类、10 个能力域、32 项能力和 91 个关注点组织知识。"
  },
  "heroMetrics": [
    {
      "id": "capability_map_depth",
      "label": "能力地图层级",
      "value": "3 / 10 / 32 / 91",
      "unit": "类 / 域 / 能力 / 关注点",
      "displayRole": "primary",
      "route": "/capability-mapping"
    },
    {
      "id": "technical_service_coverage",
      "label": "技术服务支撑",
      "value": 72.5,
      "unit": "%",
      "displayRole": "primary",
      "route": "/capability-mapping",
      "denominator": 91,
      "numerator": 66,
      "relationTypes": ["supports_focus"]
    },
    {
      "id": "standard_mapping_coverage",
      "label": "标准映射覆盖",
      "value": 96.7,
      "unit": "%",
      "displayRole": "primary",
      "route": "/standards"
    },
    {
      "id": "module_entry_count",
      "label": "分析入口",
      "value": 6,
      "unit": "个",
      "displayRole": "secondary",
      "route": "/"
    }
  ],
  "capabilityMap": {
    "categories": 3,
    "domains": 10,
    "capabilities": 32,
    "focuses": 91
  }
}
```

字段规则：

- `headline.titleMetric` 必须使用 `capability_focus` 粒度。
- `heroMetrics` 建议限制为 4 个以内，避免 dashboard 变成管理员统计页。
- `value` 可以是 number 或短文本；可排序、可比较的指标必须使用 number。
- 所有覆盖类指标必须提供 `denominator`、`numerator`、`relationTypes`。

## 5. 覆盖摘要 `coverageSummary`

`coverageSummary` 用于回答“91 个能力关注点分别被哪些维度支撑”。这是 dashboard 作为数据分析入口的核心。

```json
{
  "grain": "capability_focus",
  "totalFocuses": 91,
  "dimensions": [
    {
      "id": "technical_service",
      "label": "技术服务",
      "covered": 66,
      "total": 91,
      "percent": 72.5,
      "sourcePackage": "capability-workbench",
      "relationTypes": ["supports_focus"],
      "route": "/capability-mapping",
      "displayRole": "primary"
    },
    {
      "id": "technical_scope",
      "label": "适用范围",
      "covered": 76,
      "total": 91,
      "percent": 83.5,
      "sourcePackage": "capability-workbench",
      "relationTypes": ["applies_to_scope"],
      "route": "/capability-mapping",
      "displayRole": "primary"
    },
    {
      "id": "management_work",
      "label": "管理工作",
      "covered": 91,
      "total": 91,
      "percent": 100,
      "sourcePackage": "capability-workbench",
      "relationTypes": ["maps_to_work"],
      "route": "/capability-mapping",
      "displayRole": "primary"
    },
    {
      "id": "standard_control",
      "label": "标准控制项",
      "covered": 88,
      "total": 91,
      "percent": 96.7,
      "sourcePackage": "capability-workbench",
      "relationTypes": ["maps_to_standard"],
      "route": "/standards",
      "displayRole": "primary"
    },
    {
      "id": "process_reference",
      "label": "流程参考",
      "covered": 89,
      "total": 91,
      "percent": 97.8,
      "sourcePackage": "capability-workbench",
      "relationTypes": ["maps_to_process"],
      "route": "/capability-mapping",
      "displayRole": "secondary"
    },
    {
      "id": "environment_reach",
      "label": "信息环境可达",
      "covered": 35,
      "total": 91,
      "percent": 38.5,
      "sourcePackage": "environment-workbench",
      "relationTypes": ["supports_focus"],
      "route": "/environment",
      "displayRole": "secondary"
    },
    {
      "id": "lifecycle_reach",
      "label": "生命周期可达",
      "covered": 27,
      "total": 91,
      "percent": 29.7,
      "sourcePackage": "lifecycle-workbench",
      "relationTypes": ["maps_to_focus"],
      "route": "/development-security",
      "displayRole": "secondary"
    }
  ],
  "emptyStates": {
    "noCoverage": "当前维度尚未建立与能力关注点的关系",
    "partialCoverage": "当前维度已建立部分关系，可从对应模块继续查看明细"
  }
}
```

口径规则：

- 分母统一为 `capability_focus` 总数，P0 当前为 `91`。
- `covered` 统计的是至少存在一条对应关系的关注点去重数。
- `percent = covered / total * 100`，保留 1 位小数。
- `environment_reach` 和 `lifecycle_reach` 是跨模块可达范围，不应与 `technical_service` 直接比较优劣。

## 6. 模块摘要 `moduleSummary`

`moduleSummary` 用于 dashboard 的模块入口卡片。它不是数据健康统计，而是告诉用户“从哪个业务视角进入知识库”。

```json
{
  "uniquePackageTotals": {
    "packages": 3,
    "objects": 3231,
    "relations": 8918,
    "evidenceRefs": 9911,
    "displayRole": "admin_only"
  },
  "entryViews": [
    {
      "id": "capability",
      "label": "能力地图",
      "route": "/capability-mapping",
      "sourcePackage": "capability-workbench",
      "primaryMetric": {
        "label": "关注点",
        "value": 91,
        "unit": "个"
      },
      "secondaryMetrics": [
        { "label": "能力", "value": 32, "unit": "项" },
        { "label": "技术服务", "value": 158, "unit": "项" },
        { "label": "能力映射可达标准控制项", "value": 1745, "unit": "条" }
      ]
    },
    {
      "id": "environment",
      "label": "环境视图",
      "route": "/environment",
      "sourcePackage": "environment-workbench",
      "primaryMetric": {
        "label": "信息环境",
        "value": 10,
        "unit": "类"
      },
      "secondaryMetrics": [
        { "label": "环境分区", "value": 29, "unit": "个" },
        { "label": "信息对象", "value": 50, "unit": "类" },
        { "label": "可达关注点", "value": 35, "unit": "个" }
      ]
    },
    {
      "id": "lc_ap",
      "label": "应用研发安全",
      "route": "/development-security",
      "sourcePackage": "lifecycle-workbench",
      "viewFilter": {
        "lifecycleDomain": "LC-AP"
      },
      "primaryMetric": {
        "label": "阶段",
        "value": 8,
        "unit": "个"
      },
      "secondaryMetrics": [
        { "label": "活动", "value": null, "unit": "项", "status": "requires_domain_projection" },
        { "label": "可达关注点", "value": null, "unit": "个", "status": "requires_domain_projection" }
      ]
    },
    {
      "id": "lc_dt",
      "label": "数字技术安全",
      "route": "/development-security",
      "sourcePackage": "lifecycle-workbench",
      "viewFilter": {
        "lifecycleDomain": "LC-DT"
      },
      "primaryMetric": {
        "label": "阶段",
        "value": 7,
        "unit": "个"
      },
      "secondaryMetrics": [
        { "label": "活动", "value": null, "unit": "项", "status": "requires_domain_projection" },
        { "label": "可达关注点", "value": null, "unit": "个", "status": "requires_domain_projection" }
      ]
    },
    {
      "id": "standards",
      "label": "标准索引",
      "route": "/standards",
      "sourcePackage": "standards-index",
      "primaryMetric": {
        "label": "标准体系",
        "value": 7,
        "unit": "套"
      },
      "secondaryMetrics": [
        { "label": "标准索引控制项", "value": 4893, "unit": "条" },
        { "label": "能力映射可达控制项", "value": 1745, "unit": "条" }
      ]
    },
    {
      "id": "content_views",
      "label": "内容视图",
      "route": "/content",
      "sourcePackage": "content-views",
      "primaryMetric": {
        "label": "内容入口",
        "value": 6,
        "unit": "个"
      },
      "secondaryMetrics": [
        { "label": "HTML 文档", "value": 3, "unit": "个" },
        { "label": "图谱视图", "value": 1, "unit": "个" },
        { "label": "指南页", "value": 2, "unit": "个" }
      ]
    }
  ]
}
```

口径规则：

- `entryViews` 是用户入口，不是数据包去重统计。
- `LC-AP` / `LC-DT` 都来自 `lifecycle-workbench`，不能把同一包的对象数和关系数重复累加为全库总量。
- 生命周期域级活动数、可达关注点数如果当前 exporter 尚未提供域级 projection，应使用 `null + status`，不要让前端临时过滤关系推断。

## 7. 导航摘要 `navigationSummary`

`navigationSummary` 让 dashboard 可以稳定渲染入口，不需要页面组件到处拼接路由。

```json
{
  "primaryEntries": [
    {
      "id": "capability_mapping",
      "label": "能力地图",
      "route": "/capability-mapping",
      "metricId": "capability_focus_count",
      "intent": "browse_capability"
    },
    {
      "id": "environment",
      "label": "环境视图",
      "route": "/environment",
      "metricId": "environment_count",
      "intent": "browse_environment"
    },
    {
      "id": "development_security",
      "label": "研发安全",
      "route": "/development-security",
      "metricId": "lifecycle_stage_count",
      "intent": "browse_lifecycle"
    },
    {
      "id": "standards",
      "label": "标准索引",
      "route": "/standards",
      "metricId": "standard_framework_count",
      "intent": "browse_standard"
    }
  ],
  "secondaryEntries": [
    {
      "id": "content",
      "label": "内容视图",
      "route": "/content",
      "intent": "read_content"
    },
    {
      "id": "graph",
      "label": "关系图谱",
      "route": "/graph",
      "intent": "explore_relations"
    }
  ]
}
```

## 8. 关系摘要 `relationshipSummary`

`relationshipSummary` 用于图谱入口和模块说明，不建议作为 dashboard 第一屏的大数字堆叠。

```json
{
  "graphGrain": "business_relation",
  "groups": [
    {
      "id": "capability_to_standard",
      "label": "能力到标准",
      "sourcePackage": "capability-workbench",
      "fromGrain": "capability_focus",
      "toGrain": "standard_control",
      "relationTypes": [
        { "type": "maps_to_standard", "count": 2288 },
        { "type": "belongs_to_framework", "count": 1745 }
      ],
      "route": "/standards"
    },
    {
      "id": "capability_to_service",
      "label": "能力到技术服务",
      "sourcePackage": "capability-workbench",
      "fromGrain": "security_technical_service",
      "toGrain": "capability_focus",
      "relationTypes": [
        { "type": "supports_focus", "count": 158 }
      ],
      "route": "/capability-mapping"
    },
    {
      "id": "environment_to_object",
      "label": "环境到信息对象",
      "sourcePackage": "environment-workbench",
      "fromGrain": "environment_segment",
      "toGrain": "information_object",
      "relationTypes": [
        { "type": "protects_object", "count": 550 }
      ],
      "route": "/environment"
    },
    {
      "id": "lifecycle_to_focus",
      "label": "生命周期到关注点",
      "sourcePackage": "lifecycle-workbench",
      "fromGrain": "lifecycle_activity",
      "toGrain": "capability_focus",
      "relationTypes": [
        { "type": "maps_to_focus", "count": 73 }
      ],
      "route": "/development-security"
    }
  ],
  "displayPolicy": {
    "dashboard": "summary_only",
    "graphPage": "interactive",
    "adminDetail": "available"
  }
}
```

口径规则：

- `count` 是关系边数，不等于覆盖对象数。
- 覆盖率使用 `coverageSummary.dimensions`，不要用关系边数直接换算。
- 图谱页面可以使用 `relationshipSummary.groups` 做入口说明，但节点和边明细仍应来自对应工作台数据包或后端图谱 API。

## 9. 证据摘要 `evidenceSummary`

证据和来源追踪对系统可信度很重要，但不是普通用户第一屏主指标。建议默认折叠。

```json
{
  "displayPolicy": "folded_by_default",
  "heroEligible": false,
  "totalEvidenceRefs": 9911,
  "byPackage": [
    {
      "sourcePackage": "capability-workbench",
      "evidenceRefs": 4419
    },
    {
      "sourcePackage": "environment-workbench",
      "evidenceRefs": 4341
    },
    {
      "sourcePackage": "lifecycle-workbench",
      "evidenceRefs": 1151
    }
  ]
}
```

展示规则：

- 主展示区不得显示来源追踪字段名或原始文件字段。
- 用户进入对象详情页时，可以显示“来源依据 / 引用来源”折叠区。
- 管理员需要核验时，可进入 `adminSummary` 或后续维护页查看来源明细。

## 10. 管理摘要 `adminSummary`

`adminSummary` 用于管理员了解数据包状态、生成批次和离线包体量。它不属于普通用户主路径。

```json
{
  "visibleByDefault": false,
  "label": "数据包状态",
  "packages": [
    {
      "id": "capability-workbench",
      "dataState": "ready",
      "objects": 2460,
      "relations": 6060,
      "evidenceRefs": 4419
    },
    {
      "id": "environment-workbench",
      "dataState": "ready",
      "objects": 448,
      "relations": 2319,
      "evidenceRefs": 4341
    },
    {
      "id": "lifecycle-workbench",
      "dataState": "ready",
      "objects": 323,
      "relations": 539,
      "evidenceRefs": 1151
    },
    {
      "id": "standards-index",
      "dataState": "ready",
      "frameworks": 7,
      "controls": 4893
    },
    {
      "id": "content-views",
      "dataState": "ready",
      "views": 6
    }
  ]
}
```

## 11. 口径校验 `reconciliationSummary`

`reconciliationSummary` 用于解释为什么不同页面看到的标准控制项数量不一致，避免未来 dashboard 把不同粒度混在一起。

```json
{
  "visibleByDefault": false,
  "standardControlGrains": [
    {
      "id": "capability_reachable_standard_controls",
      "label": "能力映射可达标准控制项",
      "value": 1745,
      "source": "capability-workbench",
      "grain": "standard_control reachable from capability_focus",
      "dashboardRole": "business_summary"
    },
    {
      "id": "standards_index_controls",
      "label": "标准索引控制项",
      "value": 4893,
      "source": "standards-index",
      "grain": "standard_control index projection",
      "dashboardRole": "module_entry"
    },
    {
      "id": "sqlite_standard_control_items",
      "label": "SQLite 标准控制项知识条目",
      "value": 3416,
      "source": "SQLite",
      "grain": "knowledge_item where type = standard_control",
      "dashboardRole": "admin_reconciliation"
    }
  ],
  "sqliteBaseline": {
    "knowledgeItems": 4660,
    "knowledgeRelations": 7654,
    "sourceReferences": 25551,
    "sourceFiles": 1
  }
}
```

口径规则：

- dashboard 第一屏使用 `capability_reachable_standard_controls` 时，必须明确标签为“能力映射可达标准控制项”。
- 标准索引页使用 `standards_index_controls` 时，标签必须明确为“标准索引控制项”。
- SQLite 全库数量只用于管理员核对，不用于普通用户第一屏。

## 12. 兼容策略 `compatibility`

```json
{
  "fallback": {
    "enabled": true,
    "sourceOrder": [
      "api",
      "offline_package"
    ],
    "missingFileBehavior": "show_empty_state"
  },
  "frontendRules": [
    "dashboard 组件只消费 analytics_summary，不直接读取 raw workbench JSON 重新计算 P0 指标",
    "dataClient 负责版本兼容和字段映射",
    "ViewModel 只允许做排序、分组、空状态和展示格式化",
    "覆盖率、去重、跨包关系推断必须由后端或 exporter 完成"
  ],
  "forbiddenDisplayFields": [
    "sheet",
    "row",
    "column",
    "raw_value",
    "source_file",
    "import_id",
    "source_id",
    "source_ref",
    "source_label",
    "debug",
    "raw",
    "metadata",
    "intermediate",
    "generated_at"
  ]
}
```

## 13. 最小完整样例

以下样例用于表达结构，不要求 P0 exporter 完全照抄字段顺序。

```json
{
  "meta": {
    "version": "v1",
    "viewModelVersion": "analytics-summary-1.0",
    "generated_at": "2026-06-06 22:09:38",
    "dataState": "ready",
    "sourcePackages": [
      "capability-workbench",
      "environment-workbench",
      "lifecycle-workbench",
      "standards-index",
      "content-views"
    ],
    "stats": {
      "primaryGrain": "capability_focus",
      "focusCount": 91,
      "capabilityCount": 32,
      "sourcePackageCount": 5
    }
  },
  "page": {
    "title": "安全能力知识地图",
    "subtitle": "以能力关注点为核心查看技术、环境、生命周期、标准和工作方法的支撑关系",
    "primaryRoute": "/capability-mapping",
    "adminPanelDefault": "collapsed"
  },
  "businessSummary": {
    "headline": {
      "label": "能力知识地图",
      "titleMetric": {
        "id": "capability_focus_count",
        "label": "能力关注点",
        "value": 91,
        "unit": "个",
        "grain": "capability_focus",
        "sourcePackage": "capability-workbench"
      }
    },
    "heroMetrics": [
      {
        "id": "capability_map_depth",
        "label": "能力地图层级",
        "value": "3 / 10 / 32 / 91",
        "unit": "类 / 域 / 能力 / 关注点",
        "route": "/capability-mapping"
      },
      {
        "id": "technical_service_coverage",
        "label": "技术服务支撑",
        "value": 72.5,
        "unit": "%",
        "denominator": 91,
        "numerator": 66,
        "relationTypes": ["supports_focus"],
        "route": "/capability-mapping"
      },
      {
        "id": "standard_mapping_coverage",
        "label": "标准映射覆盖",
        "value": 96.7,
        "unit": "%",
        "denominator": 91,
        "numerator": 88,
        "relationTypes": ["maps_to_standard"],
        "route": "/standards"
      }
    ]
  },
  "coverageSummary": {
    "grain": "capability_focus",
    "totalFocuses": 91,
    "dimensions": [
      {
        "id": "technical_service",
        "label": "技术服务",
        "covered": 66,
        "total": 91,
        "percent": 72.5,
        "sourcePackage": "capability-workbench",
        "relationTypes": ["supports_focus"]
      },
      {
        "id": "management_work",
        "label": "管理工作",
        "covered": 91,
        "total": 91,
        "percent": 100,
        "sourcePackage": "capability-workbench",
        "relationTypes": ["maps_to_work"]
      },
      {
        "id": "environment_reach",
        "label": "信息环境可达",
        "covered": 35,
        "total": 91,
        "percent": 38.5,
        "sourcePackage": "environment-workbench",
        "relationTypes": ["supports_focus"]
      }
    ]
  },
  "moduleSummary": {
    "entryViews": [
      {
        "id": "capability",
        "label": "能力地图",
        "route": "/capability-mapping",
        "primaryMetric": {
          "label": "关注点",
          "value": 91,
          "unit": "个"
        }
      },
      {
        "id": "standards",
        "label": "标准索引",
        "route": "/standards",
        "primaryMetric": {
          "label": "标准体系",
          "value": 7,
          "unit": "套"
        }
      }
    ]
  },
  "adminSummary": {
    "visibleByDefault": false
  },
  "compatibility": {
    "fallback": {
      "enabled": true,
      "sourceOrder": ["api", "offline_package"],
      "missingFileBehavior": "show_empty_state"
    }
  }
}
```

## 14. 后续实现建议

P0 推荐顺序：

1. 在 exporter 层新增 `analytics-summary` 生成器，只聚合现有 `ready` 数据包。
2. 新增离线包 `analytics-summary.json`，并在 `data_package_summary.py` 中加入摘要检查。
3. 新增 `dataClient.getAnalyticsSummary()`，由它处理 API / 离线包 fallback。
4. Dashboard 页面只消费 `analytics_summary`，不直接跨包计算覆盖率。
5. 为覆盖率、标准控制项三类口径、生命周期域级 projection 增加最小审计脚本。

暂不建议：

- 暂不做“数据资产健康”主卡片。
- 暂不做用户复核 / 治理待办。
- 暂不让前端临时推断 `LC-AP` / `LC-DT` 的域级活动数和可达关注点数。
- 暂不把全库 SQLite 对象总数作为 dashboard 主指标。

## 15. 验证清单

契约实现后至少验证：

| 检查项 | 建议命令 / 方法 | 通过条件 |
| --- | --- | --- |
| 数据包状态 | `python3 scripts/data_package_summary.py --package all` | 相关包 `dataState` 为 `ready` |
| JSON 结构 | 未来新增 `node scripts/audit_analytics_summary_contract.mjs` | 必填字段存在，枚举合法 |
| 覆盖率口径 | exporter 单元测试或审计脚本 | 分母固定为 `91` 个 `capability_focus` |
| 标准控制项口径 | 审计脚本 | 三类标准控制项数量标签不混用 |
| 字段边界 | smoke / audit | 主展示区不出现禁止展示字段 |
| 前端入口 | `node scripts/frontend_smoke_check.mjs --page dashboard` | dashboard 可加载并显示空状态或 ready 数据 |
