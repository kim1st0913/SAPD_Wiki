# Dashboard 数据统计模块方案

状态：草案
日期：2026-06-08
适用范围：`analytics_summary` 扩展、dashboard 数据统计模块、模块入口统计展示

## 1. 方案结论

Dashboard 可以增加“数据统计”模块，但定位应是“知识库规模与业务对象总览”，不是“数据资产健康”或“治理待办”。

推荐做法：

- 首屏保留当前“能力知识地图 / 覆盖率 / 模块入口”的业务主线。
- 在首屏或第二屏增加一条“核心数据统计”摘要，展示用户直观关心的规模数字。
- 在摘要下方提供“全部数据统计”可展开区域，按业务域分组展示能力、基础数据字典、环境、生命周期、标准、内容和证据规模。
- 基础数据字典是知识库平台的主数据层，必须和 workbench 入口同级纳入统计，而不是只放进管理员折叠区。
- 所有统计从 `analytics-summary.json` 生成，不让前端临时跨包统计。

## 2. 为什么可以加

此前不建议把 dashboard 做成“数据资产健康”，原因是它会暗示普通用户要处理数据治理、复核和修补问题。

但“数据统计”本身是有价值的：

- 用户进入系统后需要知道知识库规模：多少能力、多少关注点、多少环境、多少技术服务。
- 用户也需要知道平台底层沉淀了哪些主数据字典：作用域、技术服务、技术模块、技术措施、流程、职能、标准引用和岗位参考。
- 管理员也需要快速判断当前数据包是否覆盖主要业务对象。
- 这些数字可以帮助解释后续图谱、表格和导出的范围。

关键边界是：**统计对象规模可以展示，治理状态不要前置**。

## 3. Dashboard 展示位置

### 3.1 推荐信息层级

```text
Dashboard
├─ Hero：安全能力知识地图
│  ├─ 能力地图层级：3 / 10 / 32 / 91
│  ├─ 技术服务支撑覆盖
│  └─ 标准映射覆盖
├─ 核心数据统计
│  ├─ 能力 32
│  ├─ 关注点 91
│  ├─ 信息化环境 10
│  ├─ 信息化对象 50
│  └─ 安全技术服务 158
├─ 覆盖率矩阵
├─ 模块入口
└─ 全部数据统计（可展开）
   ├─ 能力体系
   ├─ 基础数据字典
   ├─ 技术资源
   ├─ 管理与流程
   ├─ 信息化环境
   ├─ 生命周期
   ├─ 标准框架
   ├─ 内容视图
   └─ 图谱与证据
```

### 3.2 视觉建议

- “核心数据统计”使用紧凑 KPI 卡片或横向指标条。
- 每个指标只放一个主数字、一行短标签、一句 tooltip 或辅助说明。
- “全部数据统计”默认可以展开，也可以默认折叠；如果首屏空间紧张，建议默认折叠。
- 不把统计数字塞进 tab、导航按钮或页面标题右上角堆叠区。
- 不用红绿状态、不用健康分、不用“待治理 / 待复核”措辞。

## 4. 核心数据统计

首屏建议展示 8 个左右最容易理解的数字；如果页面空间不足，前 4 个作为固定核心，其他放入横向滚动或第二行紧凑指标。

| 指标 | 值 | 口径 | 控制数据源 | 展示位置 |
|---|---:|---|---|---|
| 能力 | 32 | `capability` 去重数 | `capability-workbench` | 核心统计 |
| 关注点 | 91 | `capability_focus` 去重数 | `capability-workbench` | 核心统计 |
| 信息化环境 | 10 | `information_environment` 去重数 | `environment-workbench` | 核心统计 |
| 信息化对象 | 50 | `information_object` 去重数 | `environment-workbench` | 核心统计 |
| 安全技术服务 | 158 | 全局服务字典去重数 | `maintenance-knowledge` / `shared-lookups` | 核心统计 |
| 安全技术模块 | 102 | 全局模块字典去重数 | `maintenance-knowledge` | 核心统计 |
| 标准体系 | 7 | `standards-index.stats.frameworks` | `standards-index` | 核心统计 |
| 标准条款 / 控制项 | 4893 | 标准索引展示行合计 | `standards-index` | 核心统计 |
| 主要字典展示项 | 567 | 主要字典分组展示项合计 | `maintenance-knowledge` | 第二行 / 展开区 |

推荐文案：

```text
核心数据统计
当前知识库已沉淀 32 项安全能力、91 个关注点、10 类信息化环境、50 类信息化对象、158 项安全技术服务和 7 套标准体系。
```

注意：

- `安全技术服务` 使用全局字典数 `158`，不要把环境可达服务 `90`、生命周期可达服务 `35` 加总。
- `信息化环境` 使用 `information_environment=10`，不要和 `environment_segment=29` 混为一类。
- `主要字典展示项=567` 是按主要字典分组展示项合计，不是去重后的全库对象总数。
- `关注点` 仍是 dashboard 的核心锚点，统计模块不能替代覆盖率矩阵。

## 5. 全部数据统计分组

### 5.1 能力体系

| 指标 | 值 | 口径 | 展示建议 |
|---|---:|---|---|
| 能力大类 | 3 | `capability_category` | 显示 |
| 能力域 | 10 | `capability_domain` | 显示 |
| 能力 | 32 | `capability` | 显示 |
| 关注点 | 91 | `capability_focus` | 显示 |
| 作用域类型 | 8 | `scope_type` | 显示 |

用途：解释能力地图的层级规模。

### 5.2 基础数据字典

基础数据字典是知识库的主数据底座，应进入“全部数据统计”的一级分组。

| 指标 | 值 | 口径 | 展示建议 |
|---|---:|---|---|
| 作用域类型 | 10 | `maintenance-knowledge.scope_types` | 显示 |
| 安全流程域 | 10 | `maintenance-knowledge.stats.process_domains` | 显示 |
| 流程组 | 32 | `maintenance-knowledge.stats.process_groups` | 显示 |
| 流程参考 | 78 | `maintenance-knowledge.stats.process_references` | 显示 |
| 安全职能层级 | 4 | `maintenance-knowledge.work_function_layers` | 显示 |
| 安全职能 | 86 | `maintenance-knowledge.stats.work_functions` | 显示 |
| 安全技术服务 | 158 | `maintenance-knowledge.security_technical_services` / `shared-lookups.service_module_index` | 显示 |
| 安全技术模块 | 102 | `maintenance-knowledge.security_technology_modules` | 显示 |
| 安全技术措施 | 32 | `maintenance-knowledge.security_technical_measures` | 显示 |
| GB/T 42446 工作任务引用 | 27 | `maintenance-knowledge.gbt_42446_references` | 显示 |
| Gartner 岗位参考 | 28 | `maintenance-knowledge.gartner_roles` | 显示 |

主要字典展示项合计：

```text
10 + 10 + 32 + 78 + 4 + 86 + 158 + 102 + 32 + 27 + 28 = 567
```

这个合计只用于 dashboard 摘要，不作为数据库去重对象总数。原因是它混合了目录、层级、叶子项和参考项，适合表达“字典覆盖规模”，不适合表达“唯一知识对象数”。

### 5.3 技术资源

| 指标 | 值 | 口径 | 展示建议 |
|---|---:|---|---|
| 安全技术服务 | 158 | 全局服务字典 | 显示 |
| 安全技术模块 | 102 | 全局模块字典 | 显示 |
| 安全技术措施 | 32 | 全局措施字典 | 显示 |
| 能力可达技术措施 | 28 | 能力工作台可达措施 | tooltip / 辅助说明 |
| 环境可达技术服务 | 90 | 环境视角可达服务 | 显示为“环境可达” |
| 生命周期可达技术服务 | 35 | 生命周期视角可达服务 | 显示为“生命周期可达” |

用途：解释“安全能力通过哪些技术资源支撑”。

口径说明：

- `security_technical_service=158` 是全局主口径。
- `environment-workbench.security_technical_service=90` 是环境视角可达服务，不是另一个全局服务总数。
- `lifecycle-workbench.security_technical_service=35` 是生命周期视角可达服务，不是另一个全局服务总数。
- 安全技术措施存在 `32 / 28` 双口径：dashboard 主展示建议用“全局措施字典 32”，tooltip 说明“能力工作台可达措施 28”。

### 5.4 管理与流程

| 指标 | 值 | 口径 | 展示建议 |
|---|---:|---|---|
| 安全管理工作 | 92 | 能力映射可达 `security_work` | 显示 |
| 安全职能 | 86 | 全局职能字典 `work_functions` | 显示 |
| 能力可达安全职能 | 75 | 能力工作台可达 `work_function` | tooltip / 辅助说明 |
| 安全流程域 | 10 | `process_domains` | 显示 |
| 流程组 | 32 | `process_groups` | 显示 |
| 流程参考 | 78 | `process_references` | 显示 |
| 流程活动 | 0 | `process_activity` | 默认隐藏 |

用途：解释“能力如何连接管理工作和流程参考”。

`process_activity=0` 当前不建议出现在普通 dashboard 统计区，避免用户误以为系统故障。可以在管理员口径说明里记录为“当前尚未导入 L4 流程活动”。

### 5.5 信息化环境

| 指标 | 值 | 口径 | 展示建议 |
|---|---:|---|---|
| 信息化环境 | 10 | `information_environment` | 显示 |
| 环境分区 | 29 | `environment_segment` | 显示 |
| 信息化对象 | 50 | `information_object` | 显示 |
| 安全系统 | 29 | `security_system` | 显示 |
| 产品 | 67 | `product` | 显示 |
| 环境可达安全技术服务 | 90 | 环境视角可达服务 | 显示为“可达服务” |
| 环境可达关注点 | 35 | 环境视角可达关注点 | 显示为“可达关注点” |

用途：解释“安全能力在信息化环境中的落点”。

### 5.6 生命周期

| 指标 | 值 | 口径 | 展示建议 |
|---|---:|---|---|
| 生命周期域 | 2 | `lifecycle_domain` | 显示 |
| 生命周期阶段 | 15 | `lifecycle_stage` | 显示 |
| 生命周期活动 / 场景 | 74 | `lifecycle_activity` | 显示 |
| 生命周期要求 | 76 | `lifecycle_requirement` | 显示 |
| 软件开发类型 | 4 | `software_development_type` | 显示 |
| 开发技术服务 | 11 | `development_technical_service` | 显示 |
| 开发技术模块 | 14 | `development_technical_module` | 显示 |
| 生命周期可达关注点 | 27 | 生命周期视角可达关注点 | 显示为“可达关注点” |

用途：解释 `LC-AP` 和 `LC-DT` 两类生命周期视角的规模。

注意：`LC-AP` / `LC-DT` 共用 `lifecycle-workbench`，全局对象数不能重复相加。

### 5.7 标准框架

标准框架统计只回答三个问题：

1. 当前有多少个标准 / 框架。
2. 每个标准 / 框架有多少条款 / 控制项。
3. 全部标准 / 框架综合有多少条款 / 控制项。

| 指标 | 值 | 口径 | 展示建议 |
|---|---:|---|---|
| 标准体系 | 7 | `standards-index.stats.frameworks` | 显示 |
| 标准条款 / 控制项综合 | 4893 | `standards-index.stats.controls` | 显示 |

每个标准 / 框架的控制项数：

| 标准 / 框架 | 控制项数 | 明细口径 |
|---|---:|---|
| 等级保护三级 | 113 | 113 条控制要求 |
| CIS CSC V8 | 153 | 153 条保护措施 |
| NIST CSF 2.0 | 110 | CSF Core 106 + CSF Tiers 4 |
| ISO/IEC 27001:2022 | 93 | 93 项控制项 |
| DSP Secure Controls Framework (SCF) - 2026 | 2936 | SCF 控制项 1468 + 成熟度描述 1468 |
| CRF | 481 | 保障措施 476 + 成熟度等级 5 |
| NIST SP 800-53 Rev.5 | 1007 | 1007 条安全策略 |
| **综合合计** | **4893** | 7 个标准 / 框架合计 |

用途：解释“标准库里有多少个框架、每个框架多少条款 / 控制项、全部合计多少”。

标准框架统计不展示 `1745`。`1745` 是能力映射可达控制项，属于能力覆盖 / reconciliation 口径，不属于标准框架自身规模统计。

### 5.8 内容视图

| 指标 | 值 | 口径 | 展示建议 |
|---|---:|---|---|
| HTML 文档 | 3 | `content-views.html_documents` | 显示 |
| 图谱视图 | 1 | `content-views.diagram_views` | 显示 |
| 指南页 | 2 | `content-views.guide_pages` | 显示 |

用途：解释“材料入口规模”。

### 5.9 图谱与证据

| 指标 | 值 | 口径 | 展示建议 |
|---|---:|---|---|
| 工作台对象 | 3231 | 三个 workbench 去重包对象合计 | 默认折叠 |
| 关系边 | 8918 | 三个 workbench 关系合计 | 默认折叠 |
| 来源依据 | 9911 | 三个 workbench `evidenceRefs` 合计 | 默认折叠 |

用途：管理员了解图谱和证据规模。

普通用户可看到“来源依据丰富”，但不建议把 `9911` 放到 hero 区。

## 6. `analytics_summary` 契约扩展建议

建议在现有 `analytics-summary.json` 中新增 `dataStatisticsSummary`，不要把所有统计塞进 `businessSummary.heroMetrics`。

```json
{
  "dataStatisticsSummary": {
    "displayRole": "secondary",
    "title": "数据统计",
    "description": "按能力、基础数据字典、环境、生命周期、标准和内容维度查看当前知识库规模。",
    "headlineMetrics": [
      {
        "id": "capability_count",
        "label": "能力",
        "value": 32,
        "unit": "项",
        "grain": "capability",
        "sourcePackage": "capability-workbench",
        "route": "/capability-mapping"
      },
      {
        "id": "capability_focus_count",
        "label": "关注点",
        "value": 91,
        "unit": "个",
        "grain": "capability_focus",
        "sourcePackage": "capability-workbench",
        "route": "/capability-mapping"
      },
      {
        "id": "information_environment_count",
        "label": "信息化环境",
        "value": 10,
        "unit": "类",
        "grain": "information_environment",
        "sourcePackage": "environment-workbench",
        "route": "/environment-mapping"
      },
      {
        "id": "information_object_count",
        "label": "信息化对象",
        "value": 50,
        "unit": "类",
        "grain": "information_object",
        "sourcePackage": "environment-workbench",
        "route": "/environment-mapping"
      },
      {
        "id": "security_technical_service_count",
        "label": "安全技术服务",
        "value": 158,
        "unit": "项",
        "grain": "security_technical_service",
        "sourcePackage": "maintenance-knowledge",
        "route": "/capability-mapping",
        "note": "全局服务字典口径，环境和生命周期中的服务数为可达子集。"
      },
      {
        "id": "security_technology_module_count",
        "label": "安全技术模块",
        "value": 102,
        "unit": "项",
        "grain": "security_technology_module",
        "sourcePackage": "maintenance-knowledge",
        "route": "/knowledge/technical-services"
      },
      {
        "id": "standard_framework_count",
        "label": "标准体系",
        "value": 7,
        "unit": "套",
        "grain": "standard_framework",
        "sourcePackage": "standards-index",
        "route": "/standards"
      },
      {
        "id": "standard_control_index_count",
        "label": "标准条款 / 控制项",
        "value": 4893,
        "unit": "条",
        "grain": "standard_control_index",
        "sourcePackage": "standards-index",
        "route": "/standards"
      },
      {
        "id": "dictionary_display_entry_count",
        "label": "主要字典展示项",
        "value": 567,
        "unit": "项",
        "grain": "dictionary_display_entry",
        "sourcePackage": "maintenance-knowledge",
        "route": "/knowledge/technical-services",
        "displayRole": "secondary",
        "note": "按主要字典分组展示项合计，不作为去重后的全库对象总数。"
      }
    ],
    "groups": [
      {
        "id": "capability_system",
        "label": "能力体系",
        "defaultOpen": true,
        "metrics": []
      },
      {
        "id": "data_dictionary",
        "label": "基础数据字典",
        "defaultOpen": true,
        "metrics": [
          {
            "id": "scope_type_dictionary_count",
            "label": "作用域类型",
            "value": 10,
            "unit": "类",
            "grain": "scope_type",
            "sourcePackage": "maintenance-knowledge"
          },
          {
            "id": "security_process_domain_count",
            "label": "安全流程域",
            "value": 10,
            "unit": "类",
            "grain": "process_domain",
            "sourcePackage": "maintenance-knowledge"
          },
          {
            "id": "process_reference_dictionary_count",
            "label": "流程参考",
            "value": 78,
            "unit": "条",
            "grain": "process_reference",
            "sourcePackage": "maintenance-knowledge"
          },
          {
            "id": "work_function_dictionary_count",
            "label": "安全职能",
            "value": 86,
            "unit": "项",
            "grain": "work_function",
            "sourcePackage": "maintenance-knowledge"
          },
          {
            "id": "gbt_42446_reference_count",
            "label": "GB/T 42446 工作任务引用",
            "value": 27,
            "unit": "条",
            "grain": "gbt_42446_task_reference",
            "sourcePackage": "maintenance-knowledge"
          },
          {
            "id": "gartner_role_reference_count",
            "label": "Gartner 岗位参考",
            "value": 28,
            "unit": "条",
            "grain": "work_role_reference",
            "sourcePackage": "maintenance-knowledge"
          }
        ]
      },
      {
        "id": "technical_resources",
        "label": "技术资源",
        "defaultOpen": true,
        "metrics": []
      },
      {
        "id": "management_process",
        "label": "管理与流程",
        "defaultOpen": false,
        "metrics": []
      },
      {
        "id": "environment",
        "label": "信息化环境",
        "defaultOpen": true,
        "metrics": []
      },
      {
        "id": "lifecycle",
        "label": "生命周期",
        "defaultOpen": false,
        "metrics": []
      },
      {
        "id": "standard_frameworks",
        "label": "标准框架",
        "defaultOpen": false,
        "metrics": [
          {
            "id": "standard_framework_count",
            "label": "标准 / 框架",
            "value": 7,
            "unit": "套",
            "grain": "standard_framework",
            "sourcePackage": "standards-index"
          },
          {
            "id": "standard_control_total_count",
            "label": "标准条款 / 控制项综合",
            "value": 4893,
            "unit": "条",
            "grain": "standard_control_index",
            "sourcePackage": "standards-index"
          }
        ],
        "frameworks": [
          {
            "id": "mlps-level-3",
            "label": "等级保护三级",
            "controlItemCount": 113,
            "breakdown": "113 条控制要求"
          },
          {
            "id": "cis-csc-v8",
            "label": "CIS CSC V8",
            "controlItemCount": 153,
            "breakdown": "153 条保护措施"
          },
          {
            "id": "nist-csf-2",
            "label": "NIST CSF 2.0",
            "controlItemCount": 110,
            "breakdown": "CSF Core 106 + CSF Tiers 4"
          },
          {
            "id": "iso-27001-2022",
            "label": "ISO/IEC 27001:2022",
            "controlItemCount": 93,
            "breakdown": "93 项控制项"
          },
          {
            "id": "dsp-level-2",
            "label": "DSP Secure Controls Framework (SCF) - 2026",
            "controlItemCount": 2936,
            "breakdown": "SCF 控制项 1468 + 成熟度描述 1468"
          },
          {
            "id": "crf",
            "label": "CRF",
            "controlItemCount": 481,
            "breakdown": "保障措施 476 + 成熟度等级 5"
          },
          {
            "id": "nist-800-53-rev5",
            "label": "NIST SP 800-53 Rev.5",
            "controlItemCount": 1007,
            "breakdown": "1007 条安全策略"
          }
        ],
        "totalControlItemCount": 4893
      },
      {
        "id": "content_views",
        "label": "内容视图",
        "defaultOpen": false,
        "metrics": []
      },
      {
        "id": "graph_evidence",
        "label": "图谱与证据",
        "defaultOpen": false,
        "displayRole": "admin_assist",
        "metrics": []
      }
    ]
  }
}
```

### 6.1 Metric 字段定义

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `id` | string | 是 | 稳定指标 ID |
| `label` | string | 是 | 页面展示短标签 |
| `value` | number | 是 | 统计值 |
| `unit` | string | 是 | `个`、`项`、`类`、`条` 等 |
| `grain` | string | 是 | 统计对象粒度 |
| `sourcePackage` | string | 是 | 控制数据源 |
| `route` | string | 否 | 点击后进入的页面 |
| `displayRole` | string | 否 | `primary` / `secondary` / `admin_assist` |
| `note` | string | 否 | tooltip 或折叠说明 |
| `alternateValue` | object | 否 | 存在第二口径时使用，例如技术措施 `28 / 32` |

## 7. P0 实施建议

P0 只做最小可用：

1. `export_analytics_summary.mjs` 新增 `dataStatisticsSummary`。
2. `audit_analytics_summary_contract.mjs` 增加断言：
   - `headlineMetrics` 必须包含能力、关注点、信息化环境、信息化对象、安全技术服务、安全技术模块、标准体系、标准控制项和主要字典展示项。
   - 安全技术服务主值必须是 `158`，不能是 `90` 或 `35`。
   - 安全技术模块主值必须是 `102`。
   - 主要字典展示项必须是 `567`，并标记为展示项合计而非全库去重总数。
   - 标准框架统计必须包含 `frameworkCount=7`、7 个框架的 `controlItemCount` 和 `totalControlItemCount=4893`。
   - `1745` 只允许作为能力映射可达控制项，保留在覆盖率 / reconciliation 说明中，不进入标准框架自身规模统计。
   - 主展示指标不得包含禁止字段。
3. `data_package_summary.py --package analytics-summary` 输出 `data_statistics_headline`、`data_dictionary_summary` 和 `standard_framework_summary` 摘要。
4. Dashboard 渲染新增“核心数据统计”区和“全部数据统计”展开区。
5. 前端只消费 `dataStatisticsSummary`，不直接读取其他 workbench JSON 重新计算。

P0 不做：

- 不做趋势图，因为当前数据没有时间序列。
- 不做健康分和质量分。
- 不做用户复核任务数。
- 不把所有指标一次性放到首屏。
- 不把 `process_activity=0` 显示成显眼异常。

## 8. 验收标准

| 验收项 | 通过标准 |
|---|---|
| 核心统计 | dashboard 能看到能力 `32`、关注点 `91`、信息化环境 `10`、信息化对象 `50`、安全技术服务 `158`、安全技术模块 `102`、标准体系 `7`、标准条款 / 控制项 `4893` |
| 字典统计 | 可展开查看基础数据字典，包含作用域 `10`、安全流程域 `10`、流程参考 `78`、安全职能 `86`、GB/T 引用 `27`、Gartner 岗位参考 `28` |
| 分组统计 | 可展开查看能力体系、基础数据字典、技术资源、管理与流程、信息化环境、生命周期、标准框架、内容视图、图谱与证据 |
| 去重口径 | 安全技术服务不重复累加环境 / 生命周期子集 |
| 字典口径 | `主要字典展示项 567` 标记为展示项合计，不作为全库去重对象总数 |
| 标准口径 | 标准框架只统计 `7` 个框架、每个框架控制项数和综合合计 `4893`；`1745` 不进入标准框架统计 |
| 字段边界 | 页面不显示 `sheet`、`row`、`raw_value`、`source_file`、`metadata`、`generated_at` 等字段 |
| 前端边界 | dashboard 组件不跨包计算统计 |
| 空状态 | `analytics-summary.json` 缺失时显示空状态，不回退到前端临时拼统计 |

## 9. 交给主控的任务拆分

建议主控后续按以下任务名推进：

```text
AN-SUM-STATS-1 Dashboard 数据统计模块
```

写入范围：

- `scripts/export_analytics_summary.mjs`
- `scripts/audit_analytics_summary_contract.mjs`
- `scripts/data_package_summary.py`
- `frontend/capability-browser/app.js`
- 必要时更新 `frontend/capability-browser/styles.css`
- 对应状态文档

禁止范围：

- 不改数据库 schema。
- 不改 ETL 原始映射。
- 不改基础 workbench JSON 的业务关系。
- 不写真实用户库。
- 不把生成的 `analytics-summary.json` 纳入 Git。
