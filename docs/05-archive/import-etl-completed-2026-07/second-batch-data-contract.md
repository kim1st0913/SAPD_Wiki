# 第二批数据契约与验收标准

> 归档状态：`completed / historical batch contract`。当前业务合同以运行 schema、API
> 合同和已确认 Sheet 清单为准。

本文档是第二批并行编码的共同契约。ETL、前端、导出验证三个 Agent 必须按本文档实现，主控 Agent 负责最终合并和验收。

## 1. 第二批范围

第二批只处理 5 个 Sheet：

| Sheet | 角色 |
|---|---|
| `安全能力-安全工作` | 能力关注点到安全工作内容的映射；安全工作独立编码并在专项知识维护中独立展示 |
| `安全能力-安全管理元素（high level）` | L2安全能力到 L2流程组、关注点到 L3流程参考、关注点/流程到组织职能相关方 |
| `安全职能流程清单（完善L4）` | 流程主数据，包含 L1流程域、L2流程组、L3流程参考、L4关键活动 |
| `安全工作职能清单` | 组织职能主数据，按决策层、管理层、执行层、监督层展示，并包含 GB/T 42446-2023 引用、嵌入图片和安全职能 -> GB/T 映射基础 |
| `gartner工作岗位参考` | Gartner 安全岗位/角色参考库，自动生成与安全职能清单的双向候选映射，用户复核后确认 |

暂不处理：

- `安全能力-安全管理元素（细化版本）`
- 生命周期 Sheet
- 标准/框架/控制项 Sheet
- 在线编辑功能

## 2. 知识对象类型

| type | 中文名 | 去重策略 |
|---|---|---|
| `security_work` | 安全工作 | 优先 `type + code`；无编码时暂用 `type + capability_focus_code + title` 并输出待补编码问题 |
| `process_domain` | 流程域 | `type + title` |
| `process_group` | 流程组 | `type + title`，必要时加 `process_domain` |
| `process_reference` | 流程参考 | `type + process_group + title` |
| `process_activity` | 关键活动 | `type + process_reference + title`，空值不生成 |
| `work_function_layer` | 工作职能层级 | `type + title` |
| `work_function_group` | 工作职能组 | `type + layer + title` |
| `work_function` | 工作职能 | 优先 `type + code`，否则 `type + layer + group + title` |
| `work_task` | 工作任务 | `type + work_function + title` |
| `gbt_42446_task_reference` | GB/T 42446-2023 工作任务引用 | `type + category + title` |
| `work_role_reference` | Gartner 岗位参考 | `type + source + category + title` |
| `asset` | 展示资产 | `type + source_sheet + anchor + file_name` |

## 3. 关系类型

| relation_type | 起点 | 终点 | 来源 |
|---|---|---|---|
| `maps_to_work` | `capability_focus` | `security_work` | `安全能力-安全工作` |
| `maps_to_process` | `capability` | `process_group` | `安全能力-安全管理元素（high level）` |
| `maps_to_process` | `capability_focus` | `process_reference` | `安全能力-安全管理元素（high level）` |
| `belongs_to` | `process_group` | `process_domain` | `安全职能流程清单（完善L4）` |
| `belongs_to` | `process_reference` | `process_group` | `安全职能流程清单（完善L4）` |
| `has_activity` | `process_reference` | `process_activity` | `安全职能流程清单（完善L4）` |
| `stakeholder_by` | `capability` + `process_group` / `process_reference` | `work_function` | `安全能力-安全管理元素（high level）` |
| `belongs_to_layer` | `work_function_group` / `work_function` | `work_function_layer` | `安全工作职能清单` |
| `performs_task` | `work_function` | `work_task` | `安全工作职能清单` |
| `maps_to_gbt_task` | `work_function` | `gbt_42446_task_reference` | `安全工作职能清单`；存储方向为安全职能 -> GB/T，前端/API 必须支持从 GB/T 反查安全职能 |

第二批自动生成候选关系，但必须保持可审查：

| relation_type | 起点 | 终点 | 处理规则 |
|---|---|---|---|
| `references_role_candidate` | `work_role_reference` | `work_function` | Gartner 岗位参考与安全职能清单的候选映射，用户复核前不作为最终强关系；前端/API 必须支持双向查看 |

## 4. 前端数据契约

前端至少需要两个 JSON 文件：

| 文件 | 用途 |
|---|---|
| `frontend/capability-browser/public/data/capability-tree.json` | 保持现有能力树兼容，并为关注点补充管理落地数据 |
| `frontend/capability-browser/public/data/management-knowledge.json` | 新增安全工作职能、GB/T 引用、Gartner 岗位参考和图片资产 |

### 4.1 capability-tree.json 扩展字段

每个 `capability_focus` 可以新增：

```json
{
  "security_works": [
    {
      "id": "string",
      "type": "security_work",
      "code": null,
      "title": "string",
      "description": "string",
      "sources": []
    }
  ],
  "process_mappings": [
    {
      "process_group": {
        "id": "string",
        "type": "process_group",
        "title": "string"
      },
      "process_reference": {
        "id": "string",
        "type": "process_reference",
        "title": "string"
      },
      "stakeholders": {
        "决策层": [],
        "管理层": [],
        "执行层": [],
        "监督层": []
      },
      "sources": []
    }
  ]
}
```

若暂无第二批数据，字段可以为空数组。现有字段和现有页面行为不能破坏。

### 4.2 management-knowledge.json

```json
{
  "generated_at": "string",
  "stats": {
    "security_works": 0,
    "work_function_layers": 0,
    "work_functions": 0,
    "gbt_42446_references": 0,
    "gartner_roles": 0,
    "assets": 0
  },
  "security_works": [
    {
      "id": "string",
      "type": "security_work",
      "code": "string",
      "title": "string",
      "description": "string",
      "related_focus_ids": [],
      "related_focus_names": [],
      "sources": []
    }
  ],
  "work_function_layers": [
    {
      "id": "string",
      "title": "网络安全决策层",
      "groups": [
        {
          "id": "string",
          "title": "string",
          "functions": [
            {
              "id": "string",
              "code": "string",
              "title": "string",
              "description": "string",
              "tasks": [],
              "gbt_42446_refs": [],
              "sources": []
            }
          ]
        }
      ]
    }
  ],
  "gbt_42446_references": [
    {
      "id": "string",
      "category": "string",
      "title": "string",
      "sources": []
    }
  ],
  "gartner_roles": [
    {
      "id": "string",
      "category": "string",
      "title": "string",
      "description": "string",
      "sources": []
    }
  ],
  "assets": [
    {
      "id": "string",
      "title": "安全工作职能清单图片",
      "type": "image",
      "source_sheet": "安全工作职能清单",
      "path": "./public/data/assets/security-work-functions.png"
    }
  ]
}
```

## 5. 页面验收标准

| 编号 | 验收项 | 标准 |
|---|---|---|
| A2-FE-001 | 现有能力树 | 原能力树、搜索、展开/收起、来源追踪仍可用 |
| A2-FE-002 | 能力详情扩展 | 选中关注点后能看到安全工作、流程参考、组织职能相关方 |
| A2-FE-003 | 新模块 | 页面有独立“安全工作清单”和“安全工作职能”模块或标签，不把职能清单塞进左侧能力树 |
| A2-FE-004 | 四层级展示 | 安全工作职能按决策层、管理层、执行层、监督层展示 |
| A2-FE-005 | GB/T 引用 | 能展示 GB/T 42446-2023 引用类别、任务，以及 GB/T 与安全职能的双向映射查看 |
| A2-FE-006 | Gartner 参考 | 能展示 Gartner 分类、角色、描述和安全职能双向候选映射 |
| A2-FE-007 | 图片展示 | 能展示 `安全工作职能清单` 中嵌入的 Draw.io 导出图片 |

## 6. ETL 验收标准

| 编号 | 验收项 | 标准 |
|---|---|---|
| A2-ETL-001 | 第二批 Sheet 解析 | 5 个 Sheet 均能解析，缺 Sheet 时给出明确 validation |
| A2-ETL-002 | 来源追踪 | 新对象和关系均保留 source sheet、row、cell、raw_value |
| A2-ETL-003 | 关系生成 | `maps_to_work`、`maps_to_process`、`stakeholder_by`、`belongs_to_layer`、`maps_to_gbt_task` 至少生成非零关系；GB/T 支持反向查询投影 |
| A2-ETL-004 | L4 空值处理 | `L4关键活动` 为空时不生成空标题对象 |
| A2-ETL-005 | 嵌入图片 | 能提取 `安全工作职能清单` 中的嵌入图片到本地 ignored 目录 |
| A2-ETL-006 | 兼容第一批 | 第一批 5 个 Sheet 导入结果不回退，现有 clean import 无 error |
| A2-ETL-007 | 严格约束校验 | 单一 L2 安全能力不得映射多个 L2 流程组；如出现输出异常 |
| A2-ETL-008 | L3 流程唯一性校验 | 同名 L3 流程原则上不得出现在不同 L2 流程组下；如出现输出具体数据 |
| A2-ETL-009 | Gartner 候选映射 | 自动生成 Gartner 岗位参考与安全职能的双向候选映射投影，并输出复核清单 |

## 7. 导出与验证验收标准

| 编号 | 验收项 | 标准 |
|---|---|---|
| A2-EXP-001 | 前端数据 | 生成 `capability-tree.json` 和 `management-knowledge.json` |
| A2-EXP-002 | 审查报告 | 生成第二批导入摘要，列出对象类型、关系类型、validation |
| A2-EXP-003 | CSV/JSON 导出 | 第二批对象和关系可以通过现有 export-items/export-relations 导出 |
| A2-EXP-004 | 未匹配清单 | 能报告 high level 表中未匹配到流程主数据或职能主数据的条目 |

## 8. 并行 Agent 写入边界

| Agent | 主要职责 | 允许修改 |
|---|---|---|
| ETL Agent | 第二批 Sheet parser、对象关系候选、图片提取 | `src/sapd_wiki/parsers.py`、`src/sapd_wiki/transformers.py`、必要时新增 `src/sapd_wiki/assets.py` |
| Frontend Agent | 页面模块、交互、样式，兼容空数据 | `frontend/capability-browser/index.html`、`frontend/capability-browser/app.js`、`frontend/capability-browser/styles.css` |
| Export/Verify Agent | 前端 JSON、第二批报告、验证辅助 | `src/sapd_wiki/exports.py`、必要时新增导出文档或验证脚本 |
| 主控 Agent | CLI 入口、合并冲突、最终导入、验收记录 | `src/sapd_wiki/cli.py`、`task_plan.md`、`progress.md`、`findings.md`、`docs/06-implementation/open-issues.md` |
