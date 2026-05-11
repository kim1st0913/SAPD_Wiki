# 字段字典草案：第一批核心 Sheet 与第二批管理/职能 Sheet

本文档是 Phase 1 的字段字典草案，当前已细化 `data/raw-samples/wiki sample.xlsx` 中第一批 5 个核心 Sheet，并补充第二批 5 个管理/职能 Sheet 的字段草案。

完整 Excel 的 26 个 Sheet 后续都要纳入知识库建设范围；第一批 5 个 Sheet 是为了先打通主链路，不代表其他 Sheet 不处理。

当前目标不是一次性设计最终数据库，而是回答四个问题：

1. Excel 里的每一行代表什么；
2. 哪些内容应该变成知识对象；
3. 哪些列应该变成字段；
4. 哪些列应该变成对象之间的关系。

## 1. 当前范围

| Sheet | 批次 | 作用 |
|---|---|---|
| 安全能力目录 | 是 | 建立安全能力、能力关注点的核心目录 |
| 安全能力作用域目录 | 是 | 建立安全能力作用对象和生命周期作用域 |
| 安全能力-安全技术服务 | 是 | 建立能力关注点到安全技术服务的映射 |
| 安全技术模块清单 | 是 | 建立安全技术模块、安全系统、产品、技术服务映射 |
| 作用域-安全技术服务-安全技术模块映射 | 是 | 建立场景/对象/作用域/服务/模块/系统之间的落地关系 |
| 安全能力-安全工作 | 第二批 | 建立能力关注点到安全工作内容的映射 |
| 安全能力-安全管理元素（high level） | 第二批 | 建立 L2安全能力、关注点、流程、组织职能相关方映射 |
| 安全职能流程清单（完善L4） | 第二批 | 建立 L2流程组、L3流程参考、L4关键活动主数据 |
| 安全工作职能清单 | 第二批 | 建立四类组织职能、GB/T 42446-2023 映射和嵌入图片展示来源 |
| gartner工作岗位参考 | 第二批 | 建立 Gartner 安全岗位/角色参考库 |

当前暂不深度处理：

| 内容 | 当前策略 |
|---|---|
| PPT 使用说明 | 后续单独建立使用说明页面，支持预览和全文搜索 |
| Draw.io 架构图 | 后续作为只读视图展示，不做在线编辑 |
| 标准框架 Sheet | 放到后续批次，等核心能力、服务、模块、流程和职能模型稳定后处理 |
| 管理元素细化版本 | 暂缓，等 high level 模型确认后再做 |

## 2. 第一批知识对象

这些对象可以先理解为“知识库里可搜索、可查看、可关联的数据卡片”。开发时不一定每个对象都单独建一张表，V1 可以先用统一的 `knowledge_item` 加 `type` 实现。

| 对象编码 | 中文名称 | 来源 Sheet | 每条记录代表什么 | 第一批用途 |
|---|---|---|---|---|
| source_file | 来源文件 | 所有 Sheet | 一个被导入或展示的原始文件 | 来源追踪、版本和 hash |
| capability_category | 安全能力分类 | 安全能力目录 | 最高层能力分类，如“安全技术能力 T” | 导航、筛选 |
| capability_domain | L1 高阶战略能力 | 安全能力目录 | 能力大类，如“基础架构安全 Architectural Security T-AS” | 能力树一级节点 |
| capability | L2 安全能力 | 安全能力目录 | 具体安全能力，如“网络安全体系架构管控能力 T-AS.AD” | 能力树二级节点、详情页 |
| capability_focus | 安全能力关注点 | 安全能力目录 | 能力下的关注点，如 `T-AS.AD-01` | 关联查询的核心颗粒度 |
| scope_type | 安全作用域 | 安全能力作用域目录 | 安全能力作用于什么对象或生命周期 | 筛选、服务映射 |
| information_environment | 信息化环境 | 作用域-安全技术服务-安全技术模块映射 | 业务或技术环境，如“网络周界” | 场景筛选 |
| information_object | 信息化对象 | 作用域-安全技术服务-安全技术模块映射 | 环境中的具体对象，如“互联网入口边界” | 场景定位 |
| security_technical_service | 安全技术服务 | 安全能力-安全技术服务 | 面向作用域的安全技术服务，如“网络隔离” | 能力到技术落地的中间层 |
| security_technology_module | 安全技术模块 | 安全技术模块清单 | 可部署或可选型的安全技术模块，如“网络防火墙” | 技术方案和产品映射 |
| security_system | 安全系统 | 安全技术模块清单 | 多个模块协同组成的系统，如“网络边界安全防护” | 技术架构展示 |
| product | 产品 | 安全技术模块清单 | 对应我司产品 | 产品映射和后续导出 |
| security_work | 安全工作 | 安全能力-安全工作 | 能力关注点对应的一项安全工作内容 | 管理落地视角 |
| process_domain | 流程域 | 安全职能流程清单（完善L4） | L1 流程域 | 流程导航 |
| process_group | 流程组 | 安全职能流程清单（完善L4）、安全能力-安全管理元素（high level） | L2 流程组 | 能力到流程映射 |
| process_reference | 流程参考 | 安全职能流程清单（完善L4）、安全能力-安全管理元素（high level） | L3 流程参考 | 关注点到流程映射 |
| process_activity | 关键活动 | 安全职能流程清单（完善L4） | L4 关键活动 | 后续补充和细化 |
| work_function_layer | 工作职能层级 | 安全工作职能清单 | 决策层、管理层、执行层、监督层 | 独立职能页面分组 |
| work_function_group | 工作职能组 | 安全工作职能清单 | 同一层级下的职能分组 | 职能页面二级分组 |
| work_function | 工作职能 | 安全工作职能清单、安全能力-安全管理元素（high level） | 具体组织工作职能 | 组织职能展示和相关方映射 |
| work_task | 工作任务 | 安全工作职能清单 | 工作职能承担的任务 | 职能详情 |
| gbt_42446_task_reference | GB/T 42446-2023 工作任务引用 | 安全工作职能清单 | 外部标准中的工作类别和任务 | 标准引用展示 |
| work_role_reference | 岗位参考 | gartner工作岗位参考 | Gartner 安全岗位/角色参考 | 外部岗位参考库 |
| relation | 关系 | 映射类 Sheet | 两个对象之间的关系 | 关联查询、图谱、导出 |

## 3. 通用字段

所有知识对象都建议保留这些字段。它们是后续搜索、导出、更新审查和来源追踪的底座。

| 字段编码 | 中文名称 | 类型 | 必填 | 说明 |
|---|---|---|---|---|
| id | 系统 ID | text | 是 | 系统生成的唯一 ID |
| type | 对象类型 | enum | 是 | 对应本文档的对象编码 |
| code | 业务编号 | text | 否 | 如 `T-AS.AD-01`、`I-NT` 等 |
| title | 名称 | text | 是 | 列表和详情页显示名称 |
| description | 描述 | long_text | 否 | 定义、说明、关注点描述 |
| category | 分类 | text | 否 | 用于导航和筛选 |
| parent_id | 上级对象 | reference | 否 | 用于能力树、分类树 |
| source_file_id | 来源文件 | reference | 是 | 指向 `source_file` |
| source_sheet | 来源 Sheet | text | 是 | Excel Sheet 名 |
| source_row | 来源行号 | number | 否 | Excel 行号 |
| source_column | 来源列 | text | 否 | Excel 列名或列号 |
| import_job_id | 导入任务 | reference | 否 | 后续用于批量导入审查 |
| source_hash | 来源文件 hash | text | 是 | 判断文件是否变化 |
| status | 状态 | enum | 是 | draft、active、deprecated |
| raw_value | 原始值 | long_text | 否 | 保留未清洗前内容，方便追溯 |
| metadata_json | 扩展元数据 | json | 否 | 暂不稳定字段先放这里 |

## 4. 对象字段定义

### 4.1 source_file 来源文件

| 字段编码 | 中文名称 | 类型 | 必填 | 来源 | 处理规则 |
|---|---|---|---|---|---|
| file_name | 文件名 | text | 是 | 本地文件名 | 保留原名 |
| file_type | 文件类型 | enum | 是 | 文件扩展名 | 标准化为 xlsx、pptx、drawio |
| file_path | 本地路径 | text | 是 | 本地路径 | 只保存相对路径或受控路径，不写入隐私绝对路径 |
| file_hash | 文件 hash | text | 是 | 系统计算 | 用于判断重复导入和变更 |
| file_size | 文件大小 | number | 否 | 系统计算 | 用于展示 |
| imported_at | 导入时间 | datetime | 否 | 系统生成 | 记录导入批次 |
| usage_policy | 使用策略 | enum | 是 | 人工确认 | raw_sample、import_source、attachment、view_only |

### 4.2 capability_category 安全能力分类

| 字段编码 | 中文名称 | 类型 | 必填 | 来源列 | 处理规则 |
|---|---|---|---|---|---|
| code | 分类编码 | text | 否 | 安全能力分类 | 从末尾编码提取，如 `T` |
| title | 分类名称 | text | 是 | 安全能力分类 | 保留中文和英文，后续可拆分 |
| source_sheet | 来源 Sheet | text | 是 | 安全能力目录 | 固定记录 |
| source_row | 来源行号 | number | 是 | 安全能力目录行号 | 合并单元格需要向下继承 |

### 4.3 capability_domain L1 高阶战略能力

| 字段编码 | 中文名称 | 类型 | 必填 | 来源列 | 处理规则 |
|---|---|---|---|---|---|
| code | L1 编码 | text | 否 | L1 高阶战略能力 | 从末尾编码提取，如 `T-AS` |
| title | L1 名称 | text | 是 | L1 高阶战略能力 | 保留原文 |
| parent_category_id | 所属能力分类 | reference | 是 | 安全能力分类 | 生成 relation 或 parent_id |
| source_row | 来源行号 | number | 是 | 行号 | 合并单元格向下继承 |

### 4.4 capability L2 安全能力

| 字段编码 | 中文名称 | 类型 | 必填 | 来源列 | 处理规则 |
|---|---|---|---|---|---|
| code | L2 编码 | text | 是 | L2安全能力 | 从末尾编码提取，如 `T-AS.AD` |
| title | L2 名称 | text | 是 | L2安全能力 | 保留原文 |
| description | 能力定义 | long_text | 否 | 能力定义 | 保留原文 |
| parent_domain_id | 所属 L1 能力 | reference | 是 | L1 高阶战略能力 | 生成 parent_id 或 relation |
| source_row | 来源行号 | number | 是 | 行号 | 合并单元格向下继承 |

### 4.5 capability_focus 安全能力关注点

| 字段编码 | 中文名称 | 类型 | 必填 | 来源列 | 处理规则 |
|---|---|---|---|---|---|
| code | 关注点编号 | text | 是 | 序号 | 如 `T-AS.AD-01` |
| title | 关注点名称 | text | 是 | 关注点 | 去除前后空格 |
| description | 关注点描述 | long_text | 否 | 关注点描述 | 保留原文 |
| parent_capability_id | 所属 L2 能力 | reference | 是 | L2安全能力 | 合并单元格向下继承后关联 |
| source_row | 来源行号 | number | 是 | 行号 | 记录 Excel 行号 |

### 4.6 scope_type 安全作用域

| 字段编码 | 中文名称 | 类型 | 必填 | 来源列 | 处理规则 |
|---|---|---|---|---|---|
| code | 作用域编码 | text | 是 | 作用域类型 | 从开头提取，如 `I-US`、`LC-DT` |
| title | 作用域名称 | text | 是 | 作用域类型 | 保留编码后的中文名 |
| scenario | 情景 | text | 否 | 情景 | 空值向下继承，如“网络空间”“过程” |
| description | 描述 | long_text | 否 | 描述 | 保留原文 |
| source_row | 来源行号 | number | 是 | 行号 | 记录 Excel 行号 |

### 4.7 information_environment 信息化环境

| 字段编码 | 中文名称 | 类型 | 必填 | 来源列 | 处理规则 |
|---|---|---|---|---|---|
| title | 信息化环境 | text | 是 | 信息化环境 | 空值向下继承 |
| parent_environment | 上级环境 | text | 否 | 信息化环境相邻列 | 当前样例中第 2、3 列需要人工确认层级含义 |
| source_row | 来源行号 | number | 是 | 行号 | 记录 Excel 行号 |

说明：`作用域-安全技术服务-安全技术模块映射` 中第 2 列是“信息化环境”，第 3 列没有明确表头，但样例值如“互联网边界”。已确认第一批正式命名为 `environment_segment`。

### 4.8 information_object 信息化对象

| 字段编码 | 中文名称 | 类型 | 必填 | 来源列 | 处理规则 |
|---|---|---|---|---|---|
| title | 信息化对象 | text | 是 | 信息化对象 | 空值向下继承 |
| environment_id | 所属信息化环境 | reference | 否 | 信息化环境 | 生成 relation |
| scope_codes | 关联作用域 | list | 否 | 作用域 | 拆分多个作用域编码 |
| source_row | 来源行号 | number | 是 | 行号 | 记录 Excel 行号 |

### 4.9 security_technical_service 安全技术服务

| 字段编码 | 中文名称 | 类型 | 必填 | 来源列 | 处理规则 |
|---|---|---|---|---|---|
| code | 服务编码 | text | 是 | 安全技术服务单元格 | 从 `I-NT&T-AS.AD-01 网络平面及区域划分` 中提取 `I-NT&T-AS.AD-01` |
| title | 服务名称 | text | 是 | 安全技术服务单元格 | 提取编码后的中文名称 |
| scope_code | 作用域编码 | text | 是 | 安全技术服务单元格或列名 | 如 `I-NT`、`I-AP` |
| capability_focus_code | 关注点编号 | text | 是 | 安全技术服务单元格或当前行关注点 | 如 `T-AS.AD-01` |
| source_sheet | 来源 Sheet | text | 是 | 安全能力-安全技术服务 | 固定记录 |
| source_row | 来源行号 | number | 是 | 行号 | 记录 Excel 行号 |

说明：`安全能力-安全技术服务` 是宽表。列 `I_US 用户`、`I-DI 数据`、`I-NT 网络` 等需要被转成长表：每个非空服务单元格生成一条 `security_technical_service` 或一条“关注点-服务-作用域”关系。

### 4.10 security_technology_module 安全技术模块

| 字段编码 | 中文名称 | 类型 | 必填 | 来源列 | 处理规则 |
|---|---|---|---|---|---|
| title | 安全技术模块 | text | 是 | 安全技术模块 | 空值向下继承 |
| description | 模块定义 | long_text | 否 | 安全技术模块定义 | 空值向下继承 |
| category | 分类 | text | 否 | 分类 | 空值向下继承 |
| security_system_id | 所属安全系统 | reference | 否 | 安全系统 | 生成 relation |
| product_names | 对应产品 | list | 否 | 对应我司产品 | 多产品时拆分 |
| source_row | 来源行号 | number | 是 | 行号 | 记录 Excel 行号 |

### 4.11 security_system 安全系统

| 字段编码 | 中文名称 | 类型 | 必填 | 来源列 | 处理规则 |
|---|---|---|---|---|---|
| title | 安全系统 | text | 是 | 安全系统 | 空值向下继承 |
| category | 分类 | text | 否 | 分类 | 空值向下继承 |
| source_row | 来源行号 | number | 是 | 行号 | 记录首次出现行号 |

### 4.12 product 产品

| 字段编码 | 中文名称 | 类型 | 必填 | 来源列 | 处理规则 |
|---|---|---|---|---|---|
| title | 产品名称 | text | 是 | 对应我司产品 | 去除前后空格 |
| vendor | 厂商 | text | 否 | 对应我司产品 | 第一批不拆，先放 metadata |
| source_row | 来源行号 | number | 是 | 行号 | 记录 Excel 行号 |

### 4.13 第二批管理/职能对象字段概览

| 对象 | 核心字段 | 来源 Sheet | 说明 |
|---|---|---|---|
| security_work | code、title、focus_code、work_content | 安全能力-安全工作 | `focus_code` 对齐 `capability_focus.code`，安全工作内容进入 `title` 或 `description` |
| process_domain | title、category | 安全职能流程清单（完善L4） | 对应 L1流程域，流程分类进入 `category` |
| process_group | title、domain_title、category | 安全职能流程清单（完善L4）、安全能力-安全管理元素（high level） | 对应 L2流程组 |
| process_reference | title、process_group_title、information_object_context | 安全职能流程清单（完善L4）、安全能力-安全管理元素（high level） | 对应 L3流程参考（结合信息化对象） |
| process_activity | title、process_reference_title | 安全职能流程清单（完善L4） | L4关键活动可为空，只有非空时生成对象 |
| work_function_layer | title、display_order | 安全工作职能清单 | 固定为网络安全决策层、管理层、执行层、监督层 |
| work_function_group | title、layer_title | 安全工作职能清单 | 作为层级下的分组字段 |
| work_function | code、title、description、layer_title、group_title | 安全工作职能清单 | `code` 可来自序号，`description` 来自职能定义 |
| work_task | title、work_function_code | 安全工作职能清单 | 表示内部承担的工作任务 |
| gbt_42446_task_reference | category、title、raw_mapping | 安全工作职能清单 | 表示 GB/T 42446-2023 的引用类别和任务 |
| work_role_reference | category、title、description | gartner工作岗位参考 | Gartner 参考库，不自动映射内部职能 |

### 4.14 relation 关系

| 字段编码 | 中文名称 | 类型 | 必填 | 来源 | 处理规则 |
|---|---|---|---|---|---|
| source_id | 起点对象 | reference | 是 | 映射关系 | 指向一个知识对象 |
| target_id | 终点对象 | reference | 是 | 映射关系 | 指向一个知识对象 |
| relation_type | 关系类型 | enum | 是 | 规则生成 | 使用下方关系类型 |
| relation_label | 关系显示名 | text | 否 | 规则生成 | 中文展示 |
| source_sheet | 来源 Sheet | text | 是 | Excel Sheet | 记录来源 |
| source_row | 来源行号 | number | 是 | Excel 行号 | 记录来源 |
| source_cell | 来源单元格 | text | 否 | Excel 单元格 | 例如 `安全能力-安全技术服务!I4` |
| confidence | 置信度 | enum | 否 | 规则生成 | exact、inferred、manual |

## 5. 关系类型

| 关系类型 | 中文显示 | 起点 | 终点 | 来源 |
|---|---|---|---|---|
| belongs_to | 属于 | capability_domain / capability / capability_focus | 上级能力对象 | 安全能力目录 |
| applies_to_scope | 适用于作用域 | security_technical_service | scope_type | 安全能力-安全技术服务 |
| supports_focus | 支撑关注点 | security_technical_service | capability_focus | 安全能力-安全技术服务 |
| implements_service | 实现技术服务 | security_technology_module | security_technical_service | 安全技术模块清单 |
| part_of_system | 属于安全系统 | security_technology_module | security_system | 安全技术模块清单 |
| maps_to_product | 对应产品 | security_technology_module | product | 安全技术模块清单 |
| deployed_in_environment | 部署/适用于环境 | security_technology_module | information_environment | 作用域-安全技术服务-安全技术模块映射 |
| maps_to_work | 映射到安全工作 | capability_focus | security_work | 安全能力-安全工作 |
| maps_to_process | 映射到流程 | capability / capability_focus | process_group / process_reference | 安全能力-安全管理元素（high level） |
| has_activity | 包含活动 | process_reference | process_activity | 安全职能流程清单（完善L4） |
| stakeholder_by | 相关方为 | capability_focus / process_reference | work_function | 安全能力-安全管理元素（high level） |
| belongs_to_layer | 属于职能层级 | work_function / work_function_group | work_function_layer | 安全工作职能清单 |
| performs_task | 承担任务 | work_function | work_task | 安全工作职能清单 |
| maps_to_gbt_task | 映射到 GB/T 工作任务 | work_function | gbt_42446_task_reference | 安全工作职能清单 |
| protects_object | 作用于信息化对象 | security_technical_service / security_technology_module | information_object | 作用域-安全技术服务-安全技术模块映射 |
| used_by_mapping | 映射到 | information_object / scope_type / service / module / system | 相关对象 | 作用域-安全技术服务-安全技术模块映射 |

## 6. 清洗规则草案

| 规则编码 | 规则名称 | 适用位置 | 说明 |
|---|---|---|---|
| trim_text | 去空格 | 所有文本字段 | 去除前后空格、换行归一 |
| fill_down | 向下继承 | 合并单元格或空白延续行 | 如果当前行为空，沿用上一条非空值 |
| ignore_placeholder | 忽略占位符 | 服务映射单元格 | `/`、空字符串不生成对象或关系 |
| split_code_title | 拆分编码和名称 | 作用域、能力、技术服务 | 从 `编码 名称` 或 `编码&编码 名称` 拆出 code 和 title |
| normalize_scope_code | 统一作用域编码 | 作用域列、服务列 | `I_US` 统一为 `I-US` |
| wide_to_long | 宽表转长表 | 安全能力-安全技术服务 | 多个作用域列转为多条服务/关系记录 |
| split_multi_scope | 拆分多作用域 | 作用域列 | `I-NT 网络 I-DI 数据与信息` 拆成多个 scope |
| deduplicate_by_code | 按编码去重 | 能力、关注点、服务 | 同一 code 多次出现时合并为同一对象，保留多个来源关系 |
| keep_raw_value | 保留原始值 | 所有导入字段 | 清洗后的字段之外保留原始单元格文本 |

## 7. Sheet 到对象的初步映射

### 7.1 安全能力目录

| 来源列 | 目标对象 | 目标字段 | 说明 |
|---|---|---|---|
| 安全能力分类 | capability_category | title / code | 需要向下继承 |
| L1 高阶战略能力 | capability_domain | title / code | 需要向下继承 |
| L2安全能力 | capability | title / code | 需要向下继承 |
| 能力定义 | capability | description | 需要向下继承 |
| 序号 | capability_focus | code | 关注点唯一编号 |
| 关注点 | capability_focus | title | 关注点名称 |
| 关注点描述 | capability_focus | description | 关注点说明 |

### 7.2 安全能力作用域目录

| 来源列 | 目标对象 | 目标字段 | 说明 |
|---|---|---|---|
| 情景 | scope_type | scenario | 空值向下继承 |
| 作用域类型 | scope_type | code / title | 如 `I-US 用户` |
| 描述 | scope_type | description | 作用域说明 |

### 7.3 安全能力-安全技术服务

| 来源列 | 目标对象 | 目标字段 | 说明 |
|---|---|---|---|
| 安全能力分类 | capability_category | title / code | 可与安全能力目录对齐 |
| L1 高阶战略能力 | capability_domain | title / code | 可与安全能力目录对齐 |
| L2安全能力 | capability | title / code | 可与安全能力目录对齐 |
| 序号 | capability_focus | code | 与安全能力目录对齐 |
| 关注点 | capability_focus | title | 与安全能力目录对齐 |
| 各作用域列 | security_technical_service | code / title / scope_code | 宽表转长表 |
| 各作用域列 | relation | supports_focus / applies_to_scope | 生成服务到关注点、服务到作用域关系 |

### 7.4 安全技术模块清单

| 来源列 | 目标对象 | 目标字段 | 说明 |
|---|---|---|---|
| 分类 | security_technology_module / security_system | category | 空值向下继承 |
| 安全系统 | security_system | title | 空值向下继承 |
| 安全技术模块 | security_technology_module | title | 空值向下继承 |
| 安全技术模块定义 | security_technology_module | description | 空值向下继承 |
| 安全技术服务映射 | security_technical_service / relation | code / implements_service | 一行可能生成一条模块到服务的关系 |
| 对应我司产品 | product / relation | title / maps_to_product | 第一批只拆产品名称，不做产品库细分 |

### 7.5 作用域-安全技术服务-安全技术模块映射

| 来源列 | 目标对象 | 目标字段 | 说明 |
|---|---|---|---|
| 信息化环境 | information_environment | title | 空值向下继承 |
| 第 3 列无表头 | environment_segment | title | 已确认先命名为 `environment_segment` |
| 信息化对象 | information_object | title | 空值向下继承 |
| 作用域 | scope_type / relation | code / applies_to_scope | 多作用域拆分 |
| 安全技术服务 | security_technical_service / relation | code / title | 与服务对象对齐 |
| 安全技术模块/措施 | security_technology_module / relation | title | 与模块对象对齐 |
| 安全系统 | security_system / relation | title | 与系统对象对齐 |

## 8. 第一批页面和导出影响

字段字典会直接影响后续页面设计。第一批页面可以围绕这些数据组织：

| 页面 | 主要对象 | 核心查询 |
|---|---|---|
| 安全能力目录 | capability、capability_focus | 看某个能力有哪些关注点 |
| 能力详情页 | capability_focus | 看关注点关联哪些作用域、服务、模块 |
| 安全技术服务页 | security_technical_service | 看服务支撑哪些能力、适用于哪些作用域 |
| 安全技术模块页 | security_technology_module | 看模块实现哪些服务、属于哪个安全系统、对应什么产品 |
| 场景映射页 | information_environment、information_object | 看某个信息化对象需要哪些服务和模块 |
| 使用说明页 | PPT 使用说明 | 单独页面，后续处理 |
| 架构视图页 | Draw.io 页面 | 只读展示，不编辑 |

第一批导出建议：

| 导出名称 | 内容 |
|---|---|
| 能力-关注点清单 | capability、capability_focus |
| 能力-服务映射 | capability_focus、security_technical_service、scope_type |
| 服务-模块映射 | security_technical_service、security_technology_module、security_system、product |
| 场景-服务-模块映射 | information_environment、information_object、scope_type、service、module、system |
| 全量关系导出 | relation 全表 |

## 9. 已确认问题

| 问题 | 当前确认 |
|---|---|
| `作用域-安全技术服务-安全技术模块映射` 第 3 列无表头如何命名？ | 先命名为 `environment_segment` |
| 安全能力分类、L1、L2 是否需要独立详情页？ | 可以有独立详情页，页面重点仍放在 L2 和关注点 |
| 产品是否需要独立产品库字段？ | 可以先建立产品对象，第一批只保存产品名称，后续再扩展厂商、版本、链接 |
| Draw.io 节点是否要和 Excel 模块自动关联？ | 第一批不做自动关联，先保留只读视图展示 |
| PPT 是否要拆成章节？ | 后续再进行，不影响第一批数据模型 |
