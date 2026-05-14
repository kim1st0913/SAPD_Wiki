# Frontend Baseline 1.0 Plan

## 目标

`Frontend Baseline 1.0` 的目标不是新增功能，也不是继续扩展新 Sheet，而是把当前三类核心业务视角统一到同一套“本地关系知识库工作台”产品标准中。

本阶段需要统一：

- 页面骨架；
- 组件语言；
- 信息密度；
- 表格样式；
- 多值标签展示；
- 来源证据折叠；
- 非业务字段边界。

## 页面范围

本阶段页面范围从原先两页修正为三页。

### 1. 安全能力映射页

主视角：

- 安全能力；
- 能力关注点。

主要表达：

- 关注点与作用域；
- 安全技术服务；
- 安全管理工作；
- 流程；
- 安全技术模块 / 安全技术措施；
- 来源证据。

该页面继续作为当前关系工作台的基准页。

### 2. LC-AP开发安全生命周期页

主视角：

- LC-AP 开发安全生命周期阶段。

主要表达：

- 阶段；
- 主要活动；
- 安全活动；
- 安全策略要求；
- 开发技术服务；
- 安全技术服务；
- 安全技术模块；
- 安全技术措施；
- 开发类产品组件。

边界：

- LC-AP 参考数据不放在同页参考区；
- LC-AP 参考数据进入 `专项知识维护 > LC-AP参考数据`；
- 不做流程海报、大屏、复杂图谱或卡片墙。

### 3. 信息化环境维度页

主视角：

- 信息化环境；
- 环境子类；
- 信息化对象。

主要表达：

- 信息化环境；
- 环境子类；
- 信息化对象；
- 作用域；
- 安全技术服务；
- 安全技术模块；
- 安全系统；
- 产品。

定位：

- 信息化环境维度是第一批核心数据的第三个业务视角；
- 它不是新 Sheet 扩展；
- 不应被后置到未来功能扩展中。

## 信息化环境维度数据需求清单

至少需要覆盖以下对象或等价能力：

| 对象 | 中文口径 | 说明 |
|---|---|---|
| `information_environment` | 信息化环境 | 一级业务环境 |
| `environment_segment` | 环境子类 | 信息化环境下的正式层级 |
| `information_object` | 信息化对象 | 可跨多个环境出现 |
| `scope_type` | 安全作用域 | 作用域主数据 |
| `security_technical_service` | 安全技术服务 | 作用域下需要具备的安全技术服务 |
| `security_technology_module` | 安全技术模块 | 服务实现相关模块 |
| `security_system` | 安全系统 | 安全技术模块的上级系统分类 |
| `product` | 产品 | 对应产品；`我司无相关产品` 是正常值 |

至少需要覆盖以下关系或等价关系：

| 关系 | 含义 |
|---|---|
| `protects_object` | 安全能力 / 服务保护或作用于信息化对象 |
| `deployed_in_environment` | 对象、模块或产品部署 / 适用于信息化环境 |
| `applies_to_scope` | 信息化对象或服务适用于安全作用域 |
| `implements_service` | 模块 / 措施支撑安全技术服务 |
| `maps_to_product` | 安全技术模块映射到产品 |
| `part_of_system` | 安全技术模块归属于安全系统 |

## 信息化环境维度前端组件结构

信息化环境维度页应复用三页统一组件基线：

| 组件 | 信息化环境页用法 |
|---|---|
| `AppShell` | 全局导航、搜索、本地模式状态 |
| `LocalNavigator` | 信息化环境 -> 环境子类 -> 信息化对象 |
| `ObjectOverview` | 当前环境 / 环境子类 / 信息化对象概览 |
| `RelationshipTable` | 对象、作用域、安全技术服务、安全技术模块、安全系统、产品关系表 |
| `SourceEvidencePanel` | 来源证据默认折叠 |

推荐页面结构：

```text
AppShell
└── 信息化环境维度 Workspace
    ├── LocalNavigator：信息化环境 / 环境子类 / 信息化对象
    ├── ObjectOverview：当前对象概览
    ├── RelationshipTable：对象 -> 作用域 -> 服务 -> 模块 -> 系统 / 产品
    ├── LocalRelationNotes：局部关系说明
    └── SourceEvidencePanel：来源证据
```

## 需要补齐的数据导出 / ViewModel / dataClient 项

### 数据导出检查

需要检查当前前端数据文件是否稳定输出：

- 信息化环境列表；
- 环境子类列表；
- 信息化对象列表；
- 对象到作用域关系；
- 作用域到安全技术服务关系；
- 安全技术服务到安全技术模块 / 措施关系；
- 安全技术模块到安全系统和产品关系。

如当前数据已经存在，应复用，不新增重复数据结构。

### dataClient 检查

需要确认或补齐：

- `getEnvironmentTree()`
- `getEnvironmentMatrix(params)`
- `getEnvironmentRelationships(id)`

这些方法应返回业务投影，不暴露原始 Sheet 字段给页面组件。

### ViewModel 检查

需要确认或补齐：

- `buildEnvironmentWorkspaceViewModel()`

ViewModel 应输出：

```text
navigationTree
selectedEnvironment
selectedSegment
selectedObject
relationshipSummary
scopeServiceRows
detailPanel
sourceEvidence
emptyState
```

主展示字段必须经过白名单筛选。

### 前端设计文档检查

需要确认 `docs/04-frontend/` 中的信息化环境页说明与安全能力映射页、LC-AP 页保持一致：

- 同一套 AppShell；
- 同一套导航、概览、关系表和来源证据模式；
- 不做卡片墙；
- 不做复杂图谱；
- 不把系统 / 产品作为所有页面的主链路，但在信息化环境维度中可作为该视角的关系字段展示。

## 明确不做

本阶段不做：

- 新 Sheet 扩展；
- Phase 7 PPT / Draw.io / DOCX 多格式增强；
- maturity M1；
- 数据库 schema 重构；
- 底层 ETL 大改；
- React / Vue 重构；
- 复杂全量知识图谱；
- 大屏或流程海报式设计。

## 验收标准

1. 三页范围明确包含：
   - 安全能力映射；
   - LC-AP开发安全生命周期；
   - 信息化环境维度。
2. 信息化环境维度被定义为第一批核心数据的第三个业务视角。
3. 三页统一组件基线为：
   - `AppShell`
   - `LocalNavigator`
   - `ObjectOverview`
   - `RelationshipTable`
   - `SourceEvidencePanel`
4. 信息化环境维度数据需求清单已明确。
5. 信息化环境维度 dataClient / ViewModel / 前端数据检查项已明确。
6. 明确本阶段不改 ETL、schema、新 Sheet、Phase 7 和 maturity。
