# 剩余 Excel Sheet 建模草案

本文档用于在写代码前，对 `wiki sample.xlsx` 中尚未进入第一批 ETL 的 Sheet 做建模。它是需求调整和字段讨论的工作底稿，不是最终实现承诺。

2026-06-11 退役说明：旧 Sheet `信息化环境-信息化对象-安全作用域映射` 已从当前样本和核心导入链路下线归档，不再作为剩余建模对象；归档记录见 `docs/05-archive/retired-sheets/2026-06-11-information-environment-scope-mapping.md`。

## 1. 建模目标

当前已经打通的 5 个核心 Sheet 负责主链路：

```text
安全能力 -> 关注点 -> 作用域 -> 安全技术服务 -> 安全技术模块 -> 安全系统/产品
```

剩余 22 个 Sheet 的价值不是再造一套主链路，而是围绕现有能力体系补充 4 类维度：

| 维度 | 解决的问题 | 页面价值 |
|---|---|---|
| 流程/职能/工作 | 某个能力需要哪些安全工作、流程、活动和职能参与 | 能力详情页增加“管理落地”视角 |
| 生命周期 | 数据生命周期、应用安全开发生命周期如何关联能力、服务、模块 | 增加生命周期视图 |
| 标准/框架/制度 | 某个能力对应哪些标准控制项、制度要求、策略项 | 增加合规映射和导出 |
| 目录/版本/维护 | 工作簿有哪些页面、版本如何演进 | 增加维护和版本追踪 |

## 2. 剩余 Sheet 分组

| 组别 | Sheet | 建模优先级 | 主控判断 |
|---|---|---:|---|
| A. 目录与版本 | `目录`、`版本控制记录` | P3 | 作为维护元数据，不先做核心页面 |
| B. 安全工作/流程/职能 | `安全能力-安全工作`、`安全能力-安全管理元素（high level）`、`安全能力-安全管理元素（细化版本）`、`安全职能流程清单（完善L4）`、`安全工作职能清单`、`gartner工作岗位参考` | P1 | 第二批最适合先做，能直接扩展能力详情页 |
| C. 生命周期 | `LC-DT 数据生命周期`、`LC-DT 安全技术服务、模块、策略映射表`、`LC-AP 应用安全开发生命周期`、`LC-AP 应用安全开发生命周期元素目录` | P2 | 结构独立，适合做生命周期专题页 |
| D. 标准/框架/控制项 | `安全能力-网络安全制度、框架映射`、`等保三级测评清单`、`CSF2.0`、`27001-2022`、`DSP策略清单（2026）`、`CIS CSC V8`、`CRF`、`CRF Safeguards Core 2026`、`CRF Maturity Model 2026`、`NIST 800-53rev5` | P2 | 数据量大，建议在流程/职能稳定后做；DSP 只保留 2026 版本 |

## 3. 建议实施批次

### 第二批：能力到工作、流程、职能

建议先做这些 Sheet：

| Sheet | 原因 |
|---|---|
| `安全能力-安全工作` | 每个关注点对应一项安全工作，颗粒度最接近当前能力详情页 |
| `安全能力-安全管理元素（high level）` | 能力到流程组、流程参考、组织职能的高层映射 |
| `安全职能流程清单（完善L4）` | 流程主数据，补全流程分类、L1流程域、L2流程组、L3流程参考、L4关键活动 |
| `安全工作职能清单` | 职能主数据，补全决策层、管理层、执行层、监督层下的工作职能、GB/T 42446-2023 引用和页面图片 |
| `gartner工作岗位参考` | Gartner 安全工作岗位/角色分类参考，作为独立知识展示和后续岗位映射候选 |

暂缓 `安全能力-安全管理元素（细化版本）`，因为它列更多、职能矩阵更细，适合等 high level 版本确认后再做。

### 第三批：生命周期

建议做这些 Sheet：

| Sheet | 原因 |
|---|---|
| `LC-DT 数据生命周期` | 生命周期过程与服务、模块直接关联 |
| `LC-DT 数据生命周期场景目录` | 生命周期过程下的场景主数据 |
| `LC-AP 应用安全开发生命周期` | 应用安全阶段、活动、策略、开发模式 |
| `LC-AP 应用安全开发生命周期元素目录` | 应用类型、开发模式等基础字典 |

### 第四批：标准/框架/制度

建议拆成两步：

| 子批次 | Sheet | 原因 |
|---|---|---|
| 4A 能力到标准映射 | `安全能力-网络安全制度、框架映射` | 先把能力关注点和外部控制项的映射关系抽出来 |
| 4B 标准控制项主数据 | `等保三级测评清单`、`CSF2.0`、`27001-2022`、`DSP策略清单（2026）`、`CIS CSC V8`、`CRF`、`NIST 800-53rev5` | 再建立每套标准自己的控制项对象 |

### 第五批：目录和版本

| Sheet | 处理方式 |
|---|---|
| `目录` | 生成 `workbook_section`，用于后续页面导航和数据覆盖检查 |
| `版本控制记录` | 生成 `version_record`，用于导入报告和维护历史 |

## 4. 新增对象类型草案

| type | 中文名 | 来源 Sheet | 用途 |
|---|---|---|---|
| `security_work` | 安全工作 | 安全能力-安全工作 | 能力关注点的工作落地项 |
| `process_domain` | 流程域 | 安全职能流程清单 | 流程树 L1 |
| `process_group` | 流程组 | 安全职能流程清单、管理元素 Sheet | 流程树 L2 |
| `process_reference` | 流程参考 | 安全职能流程清单、管理元素 Sheet | 流程树 L3 |
| `process_activity` | 关键活动 | 安全职能流程清单、细化管理元素、LC-AP | 流程树 L4 |
| `work_function_layer` | 工作职能层级 | 安全工作职能清单 | 网络安全决策层、管理层、执行层、监督层 |
| `work_function_group` | 工作职能组 | 安全工作职能清单 | 同一职能层级下的职能分组 |
| `work_function` | 工作职能 | 安全工作职能清单、管理元素 Sheet | 组织职能或岗位职责 |
| `work_task` | 工作任务 | 安全工作职能清单 | 职能承担的具体任务 |
| `gbt_42446_task_reference` | GB/T 42446-2023 工作任务引用 | 安全工作职能清单 | 外部标准中的工作类别和承担的工作任务；与安全职能支持双向查看 |
| `work_role_reference` | 岗位参考 | gartner工作岗位参考 | 外部岗位/角色参考；与安全职能生成双向候选映射 |
| `lifecycle_process` | 生命周期过程 | LC-DT、LC-AP | 数据或应用生命周期阶段 |
| `lifecycle_scene` | 生命周期场景 | LC-DT 数据生命周期场景目录 | 生命周期下的场景 |
| `application_type` | 应用开发类型 | LC-AP 元素目录 | 自研、定制、外购、SaaS 等 |
| `standard_framework` | 标准/框架 | 标准框架类 Sheet | ISO、CSF、等保、CIS 等 |
| `standard_control` | 标准控制项 | 标准框架类 Sheet | 具体控制项或保护措施 |
| `policy_item` | 策略项 | DSP 等策略类 Sheet | DSP/SCF 等策略条目 |
| `workbook_section` | 工作簿目录项 | 目录 | 页面导航和维护 |
| `version_record` | 版本记录 | 版本控制记录 | 版本追踪 |

## 5. 新增关系类型草案

| relation_type | 中文显示 | 起点 | 终点 | 说明 |
|---|---|---|---|---|
| `maps_to_work` | 映射到安全工作 | `capability_focus` | `security_work` | 关注点对应安全工作 |
| `maps_to_process` | 映射到流程 | `capability_focus` / `security_work` | `process_group` / `process_reference` | 能力或工作对应流程 |
| `has_activity` | 包含活动 | `process_reference` / `lifecycle_process` | `process_activity` | L3 流程或生命周期阶段包含 L4 活动 |
| `stakeholder_by` | 相关方为 | `capability_focus` / `process_reference` | `work_function` | high level 管理元素中的决策层、管理层、执行层、监督层相关方 |
| `belongs_to_layer` | 属于职能层级 | `work_function` / `work_function_group` | `work_function_layer` | 支持按四个职能层级展示 |
| `performs_task` | 承担任务 | `work_function` | `work_task` | 安全工作职能清单中的内部工作任务 |
| `maps_to_gbt_task` | 映射到 GB/T 工作任务 | `work_function` | `gbt_42446_task_reference` | 安全工作职能清单中的 GB/T 42446-2023 映射；存储方向为安全职能 -> GB/T，展示支持反向查看 |
| `references_role_candidate` | 参考岗位候选映射 | `work_role_reference` | `work_function` | 第二批自动生成双向候选映射投影，用户复核前不作为最终强关系 |
| `maps_to_lifecycle` | 映射到生命周期 | `security_technical_service` / `security_technology_module` / `process_activity` | `lifecycle_process` / `lifecycle_scene` | 生命周期视角 |
| `maps_to_standard_control` | 映射到标准控制项 | `capability_focus` | `standard_control` | 能力到标准/框架控制项 |
| `belongs_to_framework` | 属于标准框架 | `standard_control` | `standard_framework` | 控制项归属 |
| `equivalent_to_control` | 控制项等价/近似 | `standard_control` | `standard_control` | 不同标准之间的映射，先保留为候选 |
| `documents_sheet` | 记录 Sheet | `version_record` | `workbook_section` | 版本记录涉及哪些 Sheet |

## 6. 逐 Sheet 建模草案

### 6.1 `目录`

| 项 | 草案 |
|---|---|
| 每行代表 | 一个工作簿目录项 |
| 对象 | `workbook_section` |
| 字段 | `section_order`、`title` |
| 关系 | 暂无，后续可关联到 source sheet |
| 当前策略 | P3，先作为维护元数据，不进入第二批 ETL |

### 6.2 `版本控制记录`

| 项 | 草案 |
|---|---|
| 每行代表 | 一次知识库版本修订 |
| 对象 | `version_record` |
| 字段 | `record_no`、`revision_date`、`version_no`、`change_summary`、`reviser`、`changed_sheets` |
| 关系 | `version_record documents_sheet workbook_section` |
| 当前策略 | P3，导入报告增强时处理 |

### 6.3 `安全能力-安全工作`

| 项 | 草案 |
|---|---|
| 每行代表 | 一个能力关注点对应的一项安全工作 |
| 复用对象 | `capability_category`、`capability_domain`、`capability`、`capability_focus` |
| 新对象 | `security_work` |
| 字段 | 能力分类、L1、L2、关注点编码、关注点名称、安全工作 |
| 关系 | `capability_focus maps_to_work security_work` |
| 当前策略 | 第二批优先 |

### 6.5 `安全能力-安全管理元素（high level）`

| 项 | 草案 |
|---|---|
| 每行代表 | 能力关注点到流程组、流程参考、组织职能层级的映射 |
| 复用对象 | `capability_focus` |
| 新对象 | `process_group`、`process_reference`、`work_function` |
| 字段 | L2流程组、L3流程参考（结合信息化对象）、决策层、管理层、执行层、监督层等 |
| 关系 | `capability_focus maps_to_process process_group/process_reference`、`capability_focus stakeholder_by work_function`、`process_reference stakeholder_by work_function` |
| 当前策略 | 第二批优先，先做高层版本，不先做细化版本 |
| 建模说明 | L2流程组与 L2安全能力建立映射；关注点与 L3流程参考建立映射，允许 1对1、多对1、1对多；组织职能相关方来自 `安全工作职能清单`，按四个职能层级归类 |

### 6.6 `安全能力-安全管理元素（细化版本）`

| 项 | 草案 |
|---|---|
| 每行代表 | 能力关注点到流程、L4活动、细分职能矩阵的映射 |
| 新对象 | `process_activity`、更细粒度 `work_function` |
| 字段 | L2流程组、L3流程参考、L4关键活动、网络安全领导小组、业务管理、信息化管理等多列职能 |
| 关系 | `process_reference has_activity process_activity`、`process_activity responsible_by work_function` |
| 当前策略 | 第二批后半段。等 high level 模型确认后处理，避免职能矩阵返工。 |

### 6.7 `安全职能流程清单（完善L4）`

| 项 | 草案 |
|---|---|
| 每行代表 | 流程树中的 L2流程组 / L3流程参考 / L4关键活动 |
| 新对象 | `process_domain`、`process_group`、`process_reference`、`process_activity` |
| 字段 | 流程分类、L1流程域、L2流程组、L3流程参考、L4关键活动 |
| 关系 | `process_group belongs_to process_domain`、`process_reference belongs_to process_group`、`process_reference has_activity process_activity` |
| 当前策略 | 第二批优先，作为流程主数据来源 |
| 建模说明 | 当前 L4关键活动允许为空；导入时只在有内容时创建 `process_activity`，模型保留未来一个 L3流程映射多个 L4关键活动的能力 |

### 6.8 `安全工作职能清单`

| 项 | 草案 |
|---|---|
| 每行代表 | 一个工作职能及其定义、GB/T 42446-2023 映射、引用工作类别和引用任务 |
| 新对象 | `work_function_layer`、`work_function_group`、`work_function`、`work_task`、`gbt_42446_task_reference` |
| 字段 | 职能类、职能分组、序号、工作职能、职能定义、GB/T 42446-2023 对应、工作类别、承担的工作任务 |
| 关系 | `work_function belongs_to_layer work_function_layer`、`work_function performs_task work_task`、`work_function maps_to_gbt_task gbt_42446_task_reference` |
| 当前策略 | 第二批优先，作为独立“安全工作职能/知识维护”页面的数据来源，不从能力关注点往下强制映射 |
| 页面说明 | 页面按网络安全决策层、管理层、执行层、监督层展示；同时展示本 Sheet 中附带的 Draw.io 导出图片 |
| ETL 注意 | 用户说明 G 列为 GB/T 42446-2023 映射，I/J 列为引用数据。当前 Excel 存在合并表头和空列，导入时应按单元格区域和实际列位识别，不仅依赖读取到的列标题 |

### 6.9 `gartner工作岗位参考`

| 项 | 草案 |
|---|---|
| 每行代表 | 一个 Gartner 安全岗位/角色参考 |
| 新对象 | `work_role_reference` |
| 字段 | 分类、角色、描述 |
| 关系 | 第二批自动生成到内部安全职能的双向候选映射投影；后续由用户复核后确认是否转为正式关系 |
| 当前策略 | 第二批纳入，作为 Gartner 安全工作岗位参考库和展示页数据 |

### 6.10 `LC-DT 数据生命周期`

| 项 | 草案 |
|---|---|
| 每行代表 | 数据生命周期过程及其服务/模块设计 |
| 新对象 | `lifecycle_process` |
| 复用对象 | `security_technical_service`、`security_technology_module` |
| 字段 | 序号、过程、安全技术服务设计、安全技术模块设计 |
| 关系 | `security_technical_service maps_to_lifecycle lifecycle_process`、`security_technology_module maps_to_lifecycle lifecycle_process` |
| 当前策略 | 第三批优先 |

### 6.11 `LC-DT 数据生命周期场景目录`

| 项 | 草案 |
|---|---|
| 每行代表 | 生命周期过程下的一个场景 |
| 新对象 | `lifecycle_scene` |
| 字段 | 过程、过程定义、场景编号、场景名称 |
| 关系 | `lifecycle_scene belongs_to lifecycle_process` |
| 当前策略 | 第三批优先，和 `LC-DT 数据生命周期` 配套 |

### 6.12 `LC-AP 应用安全开发生命周期`

| 项 | 草案 |
|---|---|
| 每行代表 | 应用安全开发阶段、活动、策略与适用开发模式 |
| 新对象 | `lifecycle_process`、`process_activity`、`standard_control` 或 `policy_item` 候选 |
| 字段 | 阶段、阶段目标、阶段主要活动、安全活动定义、安全活动对应安全策略、软件开发模式 |
| 关系 | `lifecycle_process has_activity process_activity`、`process_activity maps_to_standard_control/policy_item` |
| 当前策略 | 第三批优先，需确认“安全活动对应安全策略”是否作为控制项还是普通文本字段 |

### 6.13 `LC-AP 应用安全开发生命周期元素目录`

| 项 | 草案 |
|---|---|
| 每行代表 | 应用开发类型或生命周期元素字典 |
| 新对象 | `application_type` |
| 字段 | 类型、定义 |
| 关系 | `lifecycle_process applies_to application_type` |
| 当前策略 | 第三批配套字典 |

### 6.14 `安全能力-网络安全制度、框架映射`

| 项 | 草案 |
|---|---|
| 每行代表 | 能力关注点与多套标准/框架控制项的映射 |
| 复用对象 | `capability_focus` |
| 新对象 | `standard_framework`、`standard_control` |
| 字段 | ISO 27001:2022、CSF 2.0、等保、CIS、CRF 等列 |
| 关系 | `capability_focus maps_to_standard_control standard_control` |
| 当前策略 | 第四批 4A。先抽关系，再补各标准主数据。 |

### 6.15 `等保三级测评清单`

| 项 | 草案 |
|---|---|
| 每行代表 | 一个等保三级控制要求 |
| 新对象 | `standard_framework`、`standard_control` |
| 字段 | 等级保护、等保要求、等保控制项、等保三级控制要求；`DSP安全策略项` 已确认不入库 |
| 关系 | `standard_control belongs_to_framework standard_framework`、`standard_control equivalent_to_control policy_item` 候选 |
| 当前策略 | 2026-05-18 已先入库为标准框架控制项；F 列不参与映射、不进入数据库 |

### 6.16 `CSF2.0`

| 项 | 草案 |
|---|---|
| 每行代表 | CSF 2.0 子类别控制项 |
| 新对象 | `standard_control` |
| 字段 | 功能、分类、分类标识符、分类标识符说明 |
| 关系 | 控制项属于 CSF 2.0 框架和分类 |
| 当前策略 | 2026-05-18 已先入库为标准框架控制项 |

### 6.17 `27001-2022`

| 项 | 草案 |
|---|---|
| 每行代表 | ISO 27001:2022 控制项 |
| 新对象 | `standard_control` |
| 字段 | 控制类别、控制编号、控制名称、控制描述、控制类型、信息安全特性、网络安全概念、运营能力、安全域 |
| 关系 | 控制项属于 ISO 27001:2022；标签字段进入 metadata |
| 当前策略 | 2026-05-19 已入库为标准框架控制项；B 列合并单元格按源表保留，导入时沿用当前分类值 |

### 6.18 `DSP策略清单（2026）`

| 项 | 草案 |
|---|---|
| 每行代表 | 一个 DSP / SCF 2026 控制项 |
| 新对象 | `policy_item` 或 `standard_control` |
| 字段 | SCF域、策略原则、策略意图、SCF编号、SCF控制描述、安全策略项、控制目标 |
| 关系 | 策略项属于 DSP / SCF 2026 框架；可与等保等控制项建立候选映射 |
| 当前策略 | 已确认 2024 版本作废，后续只参考 `DSP策略清单（2026）`；当前已按标准框架数据包导出。 |

### 6.19 `CIS CSC V8`

| 项 | 草案 |
|---|---|
| 每行代表 | 一个 CIS 保护措施 |
| 新对象 | `standard_control` |
| 字段 | 安全控制项、控制项名称、控制项描述、保护措施编号、名称、资产类型、实施组、描述 |
| 关系 | 保护措施属于 CIS CSC V8 框架和安全控制项 |
| 当前策略 | 第四批 4B |

### 6.20 `CRF`

| 项 | 草案 |
|---|---|
| 每行代表 | 一个 CRF 保障措施 |
| 新对象 | `standard_control` |
| 字段 | 2026 版已更新为保障措施分类、保障措施域、CRF成熟度等级、Safeguard ID、保障措施描述、保障措施系统、关联安全能力/关注点 |
| 关系 | 保障措施属于 CRF 框架；页面按保障措施分类 / 保障措施域两级汇总 |
| 当前策略 | 已按 CRF Safeguards Core 2026 和 CRF Maturity Model 2026 入库并导出到标准/框架页面 |

### 6.21 `NIST 800-53rev5`

| 项 | 草案 |
|---|---|
| 每行代表 | 一个 NIST 800-53 rev5 控制或控制增强项 |
| 新对象 | `standard_control` |
| 字段 | 安全控制族、控制编号、英文名称、安全级别、安全类型、中文名称、控制描述 |
| 关系 | 控制项属于 NIST 800-53 rev5 框架和控制族 |
| 当前策略 | 第四批 4B，数据量最大，建议最后做 |

## 7. 第二批详细建模建议

第二批已按用户澄清调整为 5 个 Sheet：

1. `安全能力-安全工作`
2. `安全能力-安全管理元素（high level）`
3. `安全职能流程清单（完善L4）`
4. `安全工作职能清单`
5. `gartner工作岗位参考`

理由：

- `安全能力-安全工作` 和 `安全能力-安全管理元素（high level）` 直接扩展当前能力详情页，形成“关注点 -> 安全工作 -> 流程/职能相关方”的管理落地视角。
- `安全职能流程清单（完善L4）` 是流程主数据，支持从能力关注点映射到 L3流程参考，并预留 L4关键活动。
- `安全工作职能清单` 不是能力关注点的下级内容，应作为独立模块展示，按决策层、管理层、执行层、监督层组织页面。
- `gartner工作岗位参考` 是岗位/角色参考库，第二批先作为知识展示，不做自动匹配，避免把外部岗位参考误当成内部职能。
- `安全能力-安全管理元素（细化版本）` 仍然暂缓，等 high level 模型和页面确认后再做，降低职能矩阵返工风险。

### 7.1 第二批页面边界

| 页面/模块 | 数据来源 | 页面职责 |
|---|---|---|
| 能力详情页扩展 | `安全能力-安全工作`、`安全能力-安全管理元素（high level）`、`安全职能流程清单（完善L4）` | 在选中能力关注点后展示安全工作、L2流程组、L3流程参考、组织职能相关方 |
| 安全工作职能模块 | `安全工作职能清单` | 按网络安全决策层、管理层、执行层、监督层展示工作职能、职能定义、GB/T 42446-2023 映射和嵌入图片 |
| 参考库模块 | `gartner工作岗位参考`、`安全工作职能清单` 中的 GB/T 42446-2023 引用数据 | 展示外部参考数据；GB/T 与安全职能双向查看，Gartner 与安全职能双向候选映射 |

### 7.2 第二批实现边界

- 可以先实现 ETL 和静态展示，不先做复杂编辑功能。
- 允许一个关注点映射多个 L3流程参考，也允许多个关注点映射同一个 L3流程参考。
- `安全工作职能清单` 里的工作职能以组织职责维度展示，不作为关注点树的下级节点。
- `gartner工作岗位参考` 建立 `work_role_reference`，并自动生成 `work_role_reference references_role_candidate work_function` 候选映射，同时导出安全职能到 Gartner 的反向投影；用户复核前不作为最终强关系。
- 内嵌图片先作为展示资产处理，后续再考虑是否作为可检索知识对象。

## 8. 需要用户确认的问题

| 编号 | 问题 | 建议默认处理 |
|---|---|---|
| Q21-001 | `安全能力-安全管理元素（high level）` 和 `细化版本` 是否都要展示，还是 high level 面向用户、细化版本作为来源补充？ | 已确定先展示 high level，细化版本后续增强 |
| Q21-002 | 组织职能相关方列是做成“职能对象”，还是只作为流程的责任标签？ | 已确定引用 `安全工作职能清单`，作为 `work_function` 对象 |
| Q21-003 | 同一个流程名称在多个能力下出现时，是同一流程对象还是不同能力下的实例？ | 已确定来自 `安全职能流程清单（完善L4）`，同名流程作为同一主数据对象，关系保留来源 |
| Q21-004 | `安全工作职能清单` 是否挂在能力详情页下？ | 已确定不挂在能力主页面下，新增独立模块展示 |
| Q21-005 | Gartner 岗位参考是否要自动匹配内部职能？ | 已确定自动生成双向候选映射，并输出给用户复核 |
| Q21-006 | 标准控制项是否需要一开始就做跨标准等价映射？ | 暂不做，只保留同一能力下多标准并列映射 |
| Q21-007 | `安全工作职能清单` 中 GB/T 42446-2023 的列位和合并表头如何识别？ | 按用户说明和实际单元格位置双重校验，ETL 不只依赖标题文本 |
| Q21-008 | 安全工作职能页面模块名称用什么？ | 暂定为“安全工作职能”，后续可改为“知识维护/组织职能与岗位参考” |

## 9. 下一步

主控 Agent 建议：

1. 字段字典已补到 `docs/02-data-model/field-dictionary-draft.md`。
2. 映射规则已补到 `docs/03-import-etl/mapping-rules-draft.md`。
3. 逻辑数据模型已补到 `docs/02-data-model/data-model.md`。
4. 下一步确认并行编码拆分，再让开发 Agent 分线程写第二批 ETL、页面模块和导出扩展。
