# Dashboard 与模块数据展示优化方案

> 归档状态：`historical / implemented design`

日期：2026-06-06
状态：方案设计稿
适用范围：`/` Dashboard、`安全能力映射`、`信息化环境维度`、`LC-AP安全开发生命周期`、`LC-DT数据生命周期安全`、知识库字典 / 标准 / 指南的全局入口展示。

## 1. 设计结论

SAPD Wiki 的 dashboard 不应定位为“数据资产健康”或“数据治理看板”。这些是管理员维护视角，不是知识库用户进入系统时最需要回答的问题。

当前业务定位应改为：

```text
以安全能力为中心的结构化知识库工作台。
Dashboard 用来回答：当前有哪些能力、这些能力被哪些环境 / 生命周期 / 标准 / 指南支撑、哪些关系链路可以继续进入查看。
```

因此 dashboard 的统计重点应从：

- `Workbench 数据包`
- `对象总数`
- `关系总数`
- `来源引用`
- `dataState`
- 导入 / 复核 / 治理状态

调整为：

- `能力覆盖`
- `多维支撑`
- `场景可达`
- `标准支撑`
- `关系链路`
- `知识入口`

管理员维护信息可以保留，但应进入折叠维护区、调试页或后续管理员工作台，不作为普通 dashboard 的主信息。

## 2. 当前展示问题

### 2.1 Dashboard 视角偏工程统计

当前首页以 workbench 数据包为核心，展示对象、关系、来源引用、数据包 ready 状态。这些数字对开发 / 管理员有用，但对知识库使用者缺少直接业务含义。

用户真正想知道的不是“数据包是否 ready”，而是：

- 我现在能从哪些安全能力开始看？
- 哪些能力已经有技术、管理、标准、环境、生命周期支撑？
- 哪些模块适合从业务场景进入？
- 某个能力能否反查到安全技术服务、模块、措施、标准控制项或生命周期阶段？

### 2.2 生命周期统计存在重复计数风险

当前 `LC-AP安全开发生命周期` 与 `LC-DT数据生命周期安全` 共用 `lifecycle-workbench` 数据包。如果 dashboard 把它们作为两个独立 workbench 直接累加，会把同一份生命周期对象、关系和来源引用重复计入“全局总数”。

后续 dashboard 总量口径必须区分：

- `unique_package_total`：按真实数据包去重统计，`capability-workbench`、`environment-workbench`、`lifecycle-workbench` 各算一次。
- `entry_view_total`：按页面入口展示统计，允许 `LC-AP` / `LC-DT` 拆成两个视角，但不能作为全局对象 / 关系总量相加。

### 2.3 “健康度”不符合当前用户视角

“数据资产健康”通常意味着用户需要治理、复核、修复、补数据。但当前用户明确说明这些属于管理员工作，不需要普通使用者在 dashboard 上承担。

因此主视图不展示：

- 数据质量评分
- 待治理数量
- 导入任务状态
- 用户复核率
- hash / source / generated_at 等工程状态
- raw source 或中间字段

可替代为“业务可用性”表达：

- `可浏览能力`
- `已建立支撑关系`
- `可进入业务视角`
- `可追溯参考依据`
- `待补充关系`，仅在确实来自业务口径时展示

## 3. Dashboard 应强调的五类指标

### 3.1 能力全景指标

目标：让用户第一眼知道知识库的主骨架是什么。

建议主指标：

| 指标 | 业务含义 | 推荐口径 |
|---|---|---|
| 安全能力域 | 当前安全能力体系的 L0 / L1 / L2 主结构 | 按能力树节点类型统计，不与关注点混算 |
| 能力关注点 | 可进入详细映射的最小能力分析单元 | `capability_focus` 去重数 |
| 能力视角 | 当前已可从哪些维度查看能力 | 技术、管理、标准、环境、生命周期、指南 |
| 可浏览知识对象 | 已经进入用户可读页面的对象范围 | 只统计主展示页面可达对象，不统计 staging / 中间表 |

当前本地数据基线可作为首版口径参考：

- `capability_focus`：91
- `security_technical_service`：158
- `information_object`：50
- `lifecycle_stage`：15
- 能力映射可达 `standard_control`：1745，来自 `capability-workbench`
- 全库 `standard_control`：3416，来自 SQLite `knowledge_items`
- 标准索引 `controls`：4893，来自 `standards-index`

以上三个标准控制项数字不是同一个 grain。Dashboard 首屏如果表达“能力标准支撑”，优先使用能力映射可达控制项；标准 / 框架入口可以显示标准索引规模；SQLite 全库数量只用于 reconciliation，不直接作为首屏 KPI。

这些数字后续应由后端或离线导出生成 `analytics_summary`，前端不再临时从 workbench 里拼口径。

### 3.2 多维支撑指标

目标：展示“能力不是孤立目录”，而是已经被不同业务维度支撑起来。

建议主指标：

| 指标 | 业务含义 | 推荐口径 | P0 关系类型 |
|---|---|---|---|
| 技术服务支撑覆盖 | 有安全技术服务直接支撑的关注点占比 | `被 supports_focus 命中的 capability_focus / 全部 capability_focus` | `supports_focus` |
| 技术作用域覆盖 | 已落到作用域的关注点占比 | `有 applies_to_scope 的 capability_focus / 全部 capability_focus` | `applies_to_scope` |
| 管理工作覆盖 | 有安全工作支撑的关注点占比 | `有 maps_to_work 的 capability_focus / 全部 capability_focus` | `maps_to_work` |
| 标准支撑覆盖 | 有标准控制项映射的关注点占比 | `有 maps_to_standard 的 capability_focus / 全部 capability_focus` | `maps_to_standard` |
| 管理流程覆盖 | 有流程参考映射的关注点占比 | `有 maps_to_process 的 capability_focus / 全部 capability_focus` | `maps_to_process` |
| 环境可达覆盖 | 可从信息化对象 / 服务链路反查到的关注点占比 | `environment-workbench 中被 supports_focus 命中的 capability_focus / 全部 capability_focus` | `supports_focus` |
| 生命周期可达覆盖 | 可从 LC-AP / LC-DT 阶段反查到的关注点占比 | `lifecycle-workbench 中被 maps_to_focus 命中的 capability_focus / 全部 capability_focus` | `maps_to_focus` |

展示方式建议：

- 用一张 `能力 x 支撑维度` 矩阵替代“对象 / 关系 / 来源柱状图”。首屏优先显示 L0 / L1 聚合矩阵，关注点级 91 行矩阵放到下钻或第二屏，避免首屏过密。
- 每个维度显示覆盖数量、覆盖比例和可进入页面。
- 覆盖为 0 时显示可信空状态，不推断不存在的关系。
- 同一维度只允许使用已声明 relation type 计算；如果后续要把“技术支撑”从 `supports_focus` 扩展为 `supports_focus OR applies_to_scope`，必须在 `analytics_summary` 中新增单独指标，不能替换旧定义。

### 3.3 场景可达指标

目标：体现用户可以从业务场景进入知识库，而不是只能从能力目录进入。

建议主指标：

| 入口 | 应回答的问题 | 推荐统计 | 控制数据源 |
|---|---|---|---|
| 信息化环境 | 哪些环境对象能反查到安全能力？ | 环境、分段、信息化对象、作用域、安全技术服务链路数 | `environment-workbench` |
| LC-AP | 开发生命周期每个阶段有哪些活动 / 策略 / 技术支撑？ | LC-AP 阶段、活动、策略、服务 / 模块 / 措施关系 | `lifecycle-workbench` 中 `lifecycle_domain:LC-AP` |
| LC-DT | 数据生命周期每个过程 / 场景有哪些安全要求？ | LC-DT 阶段 / 过程、场景、策略、服务 / 模块 / 措施关系 | `lifecycle-workbench` 中 `lifecycle_domain:LC-DT` |
| 标准 / 框架 | 标准控制项能否回到能力关注点？ | 框架、能力映射可达控制项、全量标准索引入口 | `capability-workbench` + `standards-index` |
| 安全指南 | 方法论、图、PPT 是否能作为解释入口？ | 指南页、图视图、幻灯片页 | `content-views` |

展示方式建议：

- 首页提供 3-5 个“场景入口”，例如 `从能力进入`、`从环境对象进入`、`从开发阶段进入`、`从数据过程进入`、`从标准控制项进入`。
- 每个入口用短说明 + 关键数量 + 进入按钮，不展示工程状态。
- 不使用营销式 hero，也不做大面积卡片墙。

### 3.4 关系链路指标

目标：把“关系是产品核心”体现在 dashboard 和模块页面中。

建议主指标：

| 指标 | 业务含义 | 推荐口径 | P0 关系类型 |
|---|---|---|---|
| 能力到技术链路 | 关注点如何落到作用域、服务、模块、措施 | 按内部关系键去重后分组展示 | `applies_to_scope`、`supports_focus`、`implemented_by_module`、`has_measure` |
| 能力到管理链路 | 关注点如何落到工作、职能、流程 | 按内部关系键去重后分组展示 | `maps_to_work`、`maps_to_process`、`stakeholder_by` |
| 能力到标准链路 | 关注点如何被标准 / 控制项支撑 | 按内部关系键去重后分组展示 | `maps_to_standard`、`belongs_to_framework` |
| 环境到能力链路 | 信息化对象如何连到作用域、服务、能力 | 按内部关系键去重后分组展示 | `protects_object`、`applies_to_scope`、`supports_focus` |
| 生命周期到能力链路 | 生命周期阶段如何连到活动 / 场景、服务、能力 | 按内部关系键去重后分组展示 | `contains_activity`、`contains_scene`、`maps_to_service`、`maps_to_focus` |

内部关系键可以使用 `sourceId + type + targetId` 或等价稳定键计算，但不得展示在普通页面中。

展示方式建议：

- 首页只展示关系类型分布和高价值入口，不展示全量关系图。
- 图谱用于局部对象的关系探索，不作为首页默认唯一答案。
- 全局关系图如果保留，应作为“关系探索入口”，而不是把所有节点一次性摊开。

### 3.5 参考依据指标

目标：让用户知道知识库可追溯，但不让来源证据压过业务内容。

建议口径：

- `参考依据可达`：业务对象是否能打开折叠来源依据。
- `来源引用数`：只作为二级辅助，不做 hero KPI。
- `业务参考来源`：如果原始业务字段中有用户可读的参考来源，可以在业务表格中按现有低噪声 `参考来源` 组件展示。

不建议在主 dashboard 显示：

- `source_file`
- `source_id`
- `source_ref`
- `source_label`
- `sheet`
- `row`
- `column`
- `raw_value`
- `generated_at`

## 4. 推荐 Dashboard 信息架构

### 4.1 首屏：能力地图总览

首屏不做营销 hero，不做“数据关系总览”的大工程说明。建议改成任务型标题：

```text
安全能力知识地图
```

首屏包含：

- 左侧：能力体系摘要，展示能力层级、关注点数量、主要支撑维度。
- 中间：`能力 x 支撑维度` 覆盖矩阵，首屏按 L0 / L1 聚合展示，点击后下钻到 L2 / 关注点。
- 右侧：当前可进入的业务入口，包含能力映射、环境维度、LC-AP、LC-DT、标准 / 框架、指南。

首屏主文案建议：

```text
从安全能力出发，查看技术服务、管理流程、标准控制项、信息化环境和生命周期阶段之间的结构化关系。
```

### 4.2 第二屏：多维覆盖分析

第二屏用于解释“哪些维度已经支撑能力体系”。

推荐组件：

- 维度覆盖条形图：技术、管理、标准、环境、生命周期。
- Top 能力关注点：按“维度覆盖数 + 每维 capped count”排序，不直接按全量关系数排序，避免标准控制项数量把榜单刷高。
- 待补充维度：只展示已定义但缺关系的业务维度，不展示数据治理问题。

注意：这里的“待补充”必须来自业务口径，例如“该关注点当前没有标准控制项映射”。不能变成导入质量、source 缺失或 ETL 错误列表。

### 4.3 第三屏：业务场景入口

推荐组件：

- 信息化环境入口：环境 -> 分段 -> 信息化对象 -> 作用域 -> 服务。
- 开发生命周期入口：阶段 -> 活动 -> 策略 -> 服务 / 模块 / 措施。
- 数据生命周期入口：过程 -> 数据场景 -> 策略 -> 服务 / 模块 / 措施。
- 标准框架入口：框架 -> 控制项 -> 能力关注点。
- 指南入口：方法论 / 图 / PPT -> 对应能力或页面。

每个入口只显示足够支持用户选择的信息，不展示 raw 数量堆叠。

### 4.4 管理员维护区

建议 dashboard 底部或独立维护入口保留维护信息：

- 数据包状态
- 最后导出时间
- 导入任务
- 数据包对象 / 关系 / 来源引用总数
- 用户批注 / 收藏 / 数据篮数量
- 需要维护处理的 open issue

该区域默认折叠、低权重展示或放入独立“维护视角”。当前本地静态 MVP 不引入登录和权限系统，不把这里写成必须具备角色权限的功能。

## 5. 现有模块展示优化方案

### 5.1 安全能力映射

定位：能力中心主工作台。

应强调：

- 当前选中能力 / 关注点是什么。
- 它有哪些技术支撑：作用域、安全技术服务、模块、措施。
- 它有哪些管理支撑：安全工作、安全职能、流程、活动。
- 它有哪些标准支撑：标准框架、控制项、参考要求。
- 它能否被环境对象或生命周期阶段反查。

推荐布局：

```text
左侧能力树
主区：能力关系图谱 / 技术视角 / 管理视角 / 标准支撑 / 来源依据
右侧：当前对象摘要 + 关系摘要 + 批注入口
```

优化点：

- 主展示标题必须始终来自左侧显式选中对象，不能使用默认关注点或旧投影数据。
- 图谱中心、右侧标题、表格当前对象必须一致。
- 关系数量必须有清单可达，不能只显示裸数字。
- 来源依据默认折叠。
- 当前 `capability-workbench` 的 `process_activity=0`，因此能力管理链路首版以 `security_work`、`work_function`、`process_reference` 为主。L4 活动如果没有可用投影，只能显示可信待补充，不进入首版 KPI。

### 5.2 信息化环境维度

定位：从业务环境 / 信息化对象反查安全能力。

应强调：

- 信息化环境和分段是什么。
- 信息化对象属于哪些作用域。
- 作用域对应哪些安全技术服务。
- 这些服务如何反查能力关注点。

推荐布局：

```text
左侧：环境 / 分段 / 信息化对象目录
主区：对象-作用域-服务链路表 + 环境关系图谱
右侧：当前对象摘要 + 可反查能力
```

优化点：

- 不套用能力映射的列宽和颜色规则。
- 环境对象、系统、服务、模块使用环境语义色。
- 首页入口统计用“可反查能力数 / 关联服务数 / 信息化对象数”，不使用来源引用数作为主指标。

### 5.3 LC-AP 安全开发生命周期

定位：从应用安全开发阶段查看安全活动、策略和技术支撑。

应强调：

- 当前阶段的位置。
- 阶段下有哪些安全活动。
- 活动对应哪些安全策略 / 要求。
- 策略如何连接到安全技术服务、模块、措施和能力关注点。

推荐布局：

```text
顶部：阶段序列导航
主区：阶段摘要 + 活动 / 策略 / 技术支撑表
右侧：当前阶段关系摘要
```

优化点：

- 阶段导航继续使用阶段式横向结构，不改成通用胶囊 tab。
- 统计只在阶段标题区或摘要区显示，不塞进 tab。
- `LC-AP` 的页面入口统计只展示应用安全开发视角，不参与 lifecycle 数据包全局重复累加。

### 5.4 LC-DT 数据生命周期安全

定位：从数据生命周期过程和数据场景查看安全要求。

应强调：

- 当前数据过程 / 场景是什么。
- 场景对应哪些安全策略 / 要求。
- 策略如何连接到安全技术服务、模块、措施和能力关注点。

推荐布局：

```text
顶部：数据生命周期过程导航
主区：过程 / 场景 / 策略 / 技术支撑矩阵
右侧：当前过程关系摘要
```

优化点：

- 与 `LC-AP` 共用底层 lifecycle workbench，但 dashboard 统计中按视角拆分、按包去重汇总。
- 数据生命周期不应被展示成普通能力表，也不应和应用开发阶段混在一个总量里。
- 场景名称、策略文本、参考数据应保持可读，不用 chip 压缩长文本。

### 5.5 知识库字典、标准 / 框架、安全指南

定位：支撑型知识入口，不是 dashboard 主视角。

应强调：

- 字典页用于查对象、看定义、看关联清单。
- 标准 / 框架页用于查控制项，并能回到能力关注点。
- 指南页用于承载方法论、图和 PPT 解释材料。

优化点：

- dashboard 可展示这些入口的可达数量，但不把它们和能力 / 环境 / 生命周期 workbench 混算。
- 标准控制项数量很大，适合做“标准支撑入口”，不适合压成首页最大 KPI。
- 指南和 PPT 是解释材料，不应和结构化关系对象合并成“内容视图总数”作为主 KPI。

## 6. 统计口径设计

### 6.1 统计对象分层

后续建议新增一个独立统计契约，例如：

```text
analytics_summary
```

建议分层：

| 层级 | 说明 | 是否进入普通 dashboard |
|---|---|---|
| `business_summary` | 能力、支撑维度、场景入口、关系链路 | 是 |
| `module_summary` | 每个页面的核心对象和关系摘要 | 是 |
| `coverage_summary` | 能力 x 维度覆盖矩阵 | 是 |
| `navigation_summary` | 可进入页面和入口描述 | 是 |
| `evidence_summary` | 来源依据可达情况 | 辅助 |
| `admin_summary` | 数据包、导入、导出、用户库、异常 | 默认折叠 / 维护视角 |

### 6.1A 控制数据源优先级

Dashboard 统计必须先声明控制数据源，再生成数字。

推荐优先级：

| 统计类型 | 控制数据源 | 用途 | 说明 |
|---|---|---|---|
| 用户可见能力统计 | `capability-workbench` / `/api/v1/capabilities/workspace-view` | 首页能力地图、能力页摘要 | 以页面可达的业务投影为准 |
| 用户可见环境统计 | `environment-workbench` | 环境入口、环境对象反查 | 不从 SQLite 临时拼环境链路 |
| 用户可见生命周期统计 | `lifecycle-workbench` | LC-AP / LC-DT 入口和覆盖 | 按 `lifecycle_domain` 拆视角，按数据包去重 |
| 标准入口规模 | `standards-index` | 标准 / 框架入口 | 展示全量标准索引规模 |
| 能力标准支撑 | `capability-workbench` | 能力覆盖矩阵 | 只统计能力映射可达控制项 |
| 全库 reconciliation | SQLite `knowledge_items` / `knowledge_relations` | 校验和审计 | 不直接作为普通 dashboard KPI |
| 来源依据辅助 | workbench `evidenceRefs` / sidecar | 折叠来源依据 | 不做 hero KPI |

### 6.2 去重规则

后续所有总量类指标必须声明 grain。

推荐规则：

- 能力总量：按 `capability` / `capability_focus` 的业务 ID 去重。
- 页面入口总量：按 route / view 统计，不作为全局对象总数。
- workbench 总量：按真实数据包统计，不按页面入口重复计入。
- 关系链路：按内部关系键 `sourceId + type + targetId` 或等价稳定键去重。该键只用于统计，不在普通页面展示。
- 标准控制项：按标准框架内控制项 ID 去重。
- 来源依据：按业务对象可达证据数统计，辅助展示。

### 6.3 推荐首版指标清单

P0 首版只建议落 8-10 个高信号指标：

| 优先级 | 指标 | 位置 |
|---|---|---|
| P0 | 能力关注点数 | 首屏 |
| P0 | 支撑维度数 | 首屏 |
| P0 | 技术支撑覆盖 | 首屏矩阵 |
| P0 | 管理支撑覆盖 | 首屏矩阵 |
| P0 | 标准支撑覆盖 | 首屏矩阵 |
| P0 | 环境可达覆盖 | 第二屏 |
| P0 | 生命周期可达覆盖 | 第二屏 |
| P0 | 核心场景入口数 | 首屏 / 第三屏 |
| P1 | Top 关系丰富关注点 | 第二屏 |
| P1 | Top 场景对象 | 第三屏 |
| P1 | 来源依据可达 | 辅助区 |
| P2 | 维护统计 | 维护折叠区 |

### 6.4 P0 指标口径附录

P0 指标必须同时具备分母、分子、关系类型、控制数据源和空状态。后续 `analytics_summary` 可以直接按本表生成。

| 指标 | Dashboard 角色 | 分母 | 分子 | P0 关系类型 / 取数规则 | 控制数据源 | 空状态 |
|---|---|---|---|---|---|---|
| 能力关注点数 | 首屏主骨架 | 无 | `capability_focus` 去重数 | 统计对象类型 | `capability-workbench` | 缺数据包时显示“能力工作台数据未加载” |
| 支撑维度数 | 首屏主骨架 | 已声明维度数 | 覆盖数大于 0 的维度数 | 技术服务、技术作用域、管理工作、标准、流程、环境、生命周期 | `analytics_summary.coverage_summary` | 维度未声明时不展示 |
| 技术服务支撑覆盖 | 首屏矩阵 | 全部 `capability_focus` | 被 `supports_focus` 命中的 `capability_focus` | `supports_focus` | `capability-workbench` | 显示“当前未提供直接服务支撑关系” |
| 技术作用域覆盖 | 诊断指标 | 全部 `capability_focus` | 有 `applies_to_scope` 的 `capability_focus` | `applies_to_scope` | `capability-workbench` | 显示“当前未提供作用域映射” |
| 管理工作覆盖 | 首屏矩阵 | 全部 `capability_focus` | 有 `maps_to_work` 的 `capability_focus` | `maps_to_work` | `capability-workbench` | 显示“当前未提供管理工作映射” |
| 标准支撑覆盖 | 首屏矩阵 | 全部 `capability_focus` | 有 `maps_to_standard` 的 `capability_focus` | `maps_to_standard` | `capability-workbench` | 显示“当前未提供标准控制项映射” |
| 管理流程覆盖 | 第二屏诊断 | 全部 `capability_focus` | 有 `maps_to_process` 的 `capability_focus` | `maps_to_process` | `capability-workbench` | 显示“当前未提供流程参考映射” |
| 环境可达覆盖 | 场景入口 / 第二屏 | 全部 `capability_focus` | `environment-workbench` 中被 `supports_focus` 命中的 `capability_focus` | `supports_focus` | `environment-workbench` | 显示“当前环境视角未提供能力反查关系” |
| 生命周期可达覆盖 | 场景入口 / 第二屏 | 全部 `capability_focus` | `lifecycle-workbench` 中被 `maps_to_focus` 命中的 `capability_focus` | `maps_to_focus` | `lifecycle-workbench` | 显示“当前生命周期视角未提供能力反查关系” |
| 信息化对象覆盖 | 环境入口 | 全部 `information_object` | 有 `protects_object` 或 `applies_to_scope` 链路的信息化对象 | `protects_object`、`applies_to_scope` | `environment-workbench` | 显示“当前未提供对象到作用域 / 服务链路” |
| LC-AP 阶段可达 | 生命周期入口 | LC-AP `lifecycle_stage` | 有活动、策略、服务或能力关系的 LC-AP 阶段 | `contains_activity`、`contains_control`、`maps_to_service`、`maps_to_focus` | `lifecycle-workbench` | 显示“当前 LC-AP 阶段暂无支撑关系” |
| LC-DT 阶段可达 | 生命周期入口 | LC-DT `lifecycle_stage` | 有场景、策略、服务或能力关系的 LC-DT 阶段 | `contains_scene`、`contains_control`、`maps_to_service`、`maps_to_focus` | `lifecycle-workbench` | 显示“当前 LC-DT 阶段暂无支撑关系” |
| 能力标准可达控制项 | 标准支撑入口 | 无 | 能力映射可达 `standard_control` 去重数 | `maps_to_standard` 目标控制项 | `capability-workbench` | 显示“当前能力视角暂无标准控制项映射” |
| 标准索引控制项 | 标准 / 框架入口 | 无 | `standards-index.stats.controls` | 标准索引统计 | `standards-index` | 显示“标准索引未加载” |

### 6.5 Top 榜单计算规则

P1 可以展示 Top 关注点或 Top 场景对象，但必须避免“关系多等于重要”的误导。

推荐 score：

```text
score = 覆盖维度数 * 10 + min(技术关系数, 3) + min(管理关系数, 3) + min(标准关系数, 3) + min(环境关系数, 3) + min(生命周期关系数, 3)
```

规则：

- 每个维度 capped，避免 `maps_to_standard` 因数量大而压过其他维度。
- Top 榜单必须展示“为什么上榜”，例如技术、管理、标准、环境、生命周期各自命中数量。
- 如果某个维度没有可达清单，不参与 score，不显示裸数字。

## 7. 前端展示边界

### 7.1 主展示区允许展示

- 能力名称、能力定义、关注点描述。
- 安全技术服务、模块、措施。
- 安全工作、职能、流程、活动。
- 信息化环境、环境分段、信息化对象、作用域、系统。
- 生命周期阶段、过程、活动、数据场景、策略。
- 标准框架、控制项、参考要求。
- 业务参考来源。
- 关系数量及其可达清单。

### 7.2 主展示区禁止展示

以下字段不得出现在 dashboard 和模块主展示区：

- `sheet`
- `row`
- `column`
- `raw_value`
- `source_file`
- `import_id`
- `source_id`
- `source_ref`
- `source_label`
- `debug`
- `raw`
- `metadata`
- `intermediate`
- `generated_at`

如需追溯来源，只能放在默认折叠的来源依据面板或管理员维护区。

### 7.3 前端职责边界

前端只负责：

- 展示已计算好的统计契约。
- 做排序、分组、筛选、空状态和导航。
- 保持图谱中心、左侧选中对象、右侧标题和表格对象一致。

前端不负责：

- 主数据归一。
- 跨表匹配。
- 评分或成熟度推断。
- 把 `LC-AP` / `LC-DT` 重复数据自行合并。
- 临时解释 raw source 字段。

## 8. 实施路线

### P0：确认统计口径

目标：先定 dashboard 展示什么、每个指标如何计算。

产出：

- 本方案评审通过。
- 新增 `analytics_summary` 数据契约草案。
- 明确哪些指标是用户主视图，哪些是管理员维护视图。
- 固定 P0 指标的分母、分子、relation type、控制数据源和空状态。

不做：

- 不改 UI。
- 不改数据库 schema。
- 不改 ETL 主流程。
- 不引入成熟度评分。

### P1：生成统计契约

目标：由后端 / 离线脚本生成 dashboard 可消费的聚合数据。

产出：

- `business_summary`
- `coverage_summary`
- `module_summary`
- `navigation_summary`
- `admin_summary`
- `reconciliation_summary`，只用于维护视角和校验，不进入普通用户主 dashboard。

验收：

- 数字能与现有 workbench / SQLite 数据对齐。
- lifecycle 不重复计入全局总量。
- 所有指标都有 grain、denominator、relation type 和控制数据源。
- 标准控制项必须区分能力映射可达控制项、标准索引控制项和 SQLite 全库控制项。

### P2：重构 Dashboard 展示

目标：把 dashboard 改成能力知识地图入口。

产出：

- 首屏能力地图。
- 支撑维度覆盖矩阵。
- 场景入口区。
- 维护信息折叠区。

验收：

- 主展示区不出现 `dataState`、`Workbench 数据包`、raw/source/debug 字段。
- 普通用户能从 dashboard 清楚进入能力、环境、LC-AP、LC-DT、标准、指南。
- `LC-AP` / `LC-DT` 不造成全局统计重复。
- 首屏矩阵按 L0 / L1 聚合展示，关注点级矩阵可下钻，不把 91 个关注点直接压进首屏。

### P3：优化核心模块展示

目标：让四个核心模块各自承担明确分析视角。

产出：

- 安全能力映射：能力中心。
- 信息化环境：环境对象反查能力。
- LC-AP：应用安全开发阶段。
- LC-DT：数据生命周期过程 / 场景。

验收：

- 每个模块的标题、图谱中心、表格对象和右侧摘要一致。
- 关系数字有清单可达。
- 来源依据默认折叠。

### P4：维护视图

目标：把导入、数据包、用户库、治理问题从普通 dashboard 中移出。

产出：

- 维护摘要。
- 数据包状态。
- 用户库状态。
- Open Issues / 待处理入口。

验收：

- 维护者仍能看到维护信息。
- 普通用户主 dashboard 不被治理语言干扰。
- 不以本轮优化为前提新增登录、角色权限或复杂权限系统。

## 9. 需要用户补充原始素材的触发条件

当前方案阶段不需要新增原始素材。只有出现以下情况时，再请用户补充：

- 某个指标的业务定义无法从现有字段判断，例如“支撑”到底是否要求直接关系还是允许间接关系。
- 同一对象在多个原始来源中含义冲突，需要确定权威来源。
- 某个关系是否成立需要业务判断，而不是 ETL 规则能决定。
- 用户希望 dashboard 展示具体业务目标，例如某类能力必须覆盖到 100%。
- 需要区分普通使用者和维护者的视图范围；如果只是本地单人使用，优先用折叠维护区，不新增权限系统。

## 10. 验收标准

后续真正进入实现时，dashboard 和模块展示优化必须同时满足：

1. Dashboard 首屏回答“能力知识地图能从哪里进入”，而不是“数据包是否健康”。
2. 主 KPI 使用能力、支撑、可达、链路、入口等业务语言。
3. 全局总量不重复计算 `LC-AP` / `LC-DT` 共用的 `lifecycle-workbench`。
4. 管理员维护信息不占据普通用户主视图。
5. 所有统计指标有明确 grain、denominator 和数据来源。
6. 前端只消费统计契约或 ViewModel，不在组件内重新推断业务关系。
7. 关系图谱、表格、右侧摘要使用同一当前对象。
8. 主展示区不泄露 raw/source/debug/intermediate 字段。
9. 空状态可信，不伪造标准、模块、措施、成熟度或证据。
10. 视觉遵守 `Apple shell + restrained Morandi + 专业安全架构工作台`，不做营销页、卡片墙或装饰 dashboard。
11. 每个 P0 指标必须能追溯到 `6.4 P0 指标口径附录` 中的分母、分子、relation type 和控制数据源。
12. 标准控制项展示必须标明当前使用的是能力映射可达控制项、标准索引控制项还是全库 reconciliation 数量，不能混用。
