# 映射规则草案：第一批核心 Sheet 与第二批管理/职能 Sheet

本文档定义 `data/raw-samples/wiki sample.xlsx` 中第一批 5 个核心 Sheet，以及第二批 5 个管理/职能 Sheet 如何映射为知识对象、字段和关系。

重要边界：

- 26 个 Sheet 后续都要纳入知识库建设范围。
- 第一批 5 个核心 Sheet 构成“安全能力 -> 作用域 -> 技术服务 -> 技术模块 -> 安全系统/产品”的主链路。
- 第二批 5 个管理/职能 Sheet 构成“能力关注点 -> 安全工作 -> 流程 -> 组织职能/参考岗位”的管理落地视角。
- 其他 Sheet 后续分批补充到本文件，或按主题拆成新的映射规则文件。

## 1. 第一批 Sheet

| Sheet | 规则前缀 | 处理目标 |
|---|---|---|
| 安全能力目录 | MAP-CAP | 生成能力分类、L1 能力、L2 能力、能力关注点和层级关系 |
| 安全能力作用域目录 | MAP-SCOPE | 生成安全作用域 |
| 安全能力-安全技术服务 | MAP-SVC | 生成安全技术服务，以及服务到能力关注点、作用域的关系 |
| 安全技术模块清单 | MAP-MOD | 生成安全技术模块、安全系统、产品，以及模块到服务/系统/产品的关系 |
| 作用域-安全技术服务-安全技术模块映射 | MAP-SCENE | 生成信息化环境、环境片区、信息化对象，以及场景到服务/模块/系统的关系 |
| 安全能力-安全工作 | MAP-WORK | 生成安全工作，以及关注点到安全工作的关系 |
| 安全能力-安全管理元素（high level） | MAP-MGMT-HL | 生成/匹配流程组、流程参考、组织职能相关方，以及能力到流程/职能的关系 |
| 安全职能流程清单（完善L4） | MAP-PROC | 生成流程域、流程组、流程参考、关键活动主数据 |
| 安全工作职能清单 | MAP-FUNC | 生成工作职能层级、职能组、工作职能、工作任务、GB/T 42446-2023 引用 |
| gartner工作岗位参考 | MAP-GARTNER | 生成 Gartner 岗位/角色参考库 |

## 2. 通用处理顺序

所有 Sheet 先走同一条处理流程：

```text
读取 workbook
→ 识别目标 Sheet
→ 定位表头行和数据起始行
→ 读取每一行
→ 对需要继承的列执行 fill_down
→ 清洗单元格文本
→ 拆分编码和名称
→ 生成或匹配知识对象
→ 生成关系
→ 记录来源位置
→ 进入导入预览
```

## 3. 通用清洗规则

| 规则编码 | 规则名称 | 输入示例 | 输出示例 | 说明 |
|---|---|---|---|---|
| T-TRIM | 清理文本 | ` 加强补丁信息的运营管理。 ` | `加强补丁信息的运营管理。` | 去除前后空格和多余换行 |
| T-FILL-DOWN | 向下继承 | 当前行分类为空 | 使用上一条非空分类 | 处理合并单元格或视觉分组 |
| T-IGNORE | 忽略占位符 | `/` | 不生成对象 | 适用于服务映射空值 |
| T-CODE-TITLE | 拆编码和名称 | `T-AS.AD-01 遵循安全设计原则` | code=`T-AS.AD-01`, title=`遵循安全设计原则` | 按第一个空格或已知编码模式拆分 |
| T-SCOPE-CODE | 标准化作用域编码 | `I_US 用户` | `I-US 用户` | 将下划线统一为横线 |
| T-WIDE-LONG | 宽表转长表 | 多个作用域列 | 多条服务记录 | 用于 `安全能力-安全技术服务` |
| T-SPLIT-SCOPE | 拆多作用域 | `I-NT 网络 I-DI 数据与信息` | `I-NT 网络`、`I-DI 数据与信息` | 用于场景映射 |
| T-DEDUP-CODE | 按编码去重 | 同一 `T-AS.AD-01` 多次出现 | 合并为同一对象 | 多个来源保留多条关系 |
| T-KEEP-RAW | 保留原始值 | 任意单元格 | raw_value | 所有导入记录保留原文 |
| T-MERGED-HEADER | 合并表头识别 | 表头行有空列或合并区域 | 按列位和上级表头组合识别 | 用于 `安全工作职能清单` 的 GB/T 42446-2023 区域 |
| T-SPLIT-MULTI | 拆多值 | 一个单元格多个职能/流程 | 多条对象或关系 | 用于组织职能相关方和流程参考 |

## 4. 对象匹配和去重键

| 对象 | 首选去重键 | 备用去重键 | 说明 |
|---|---|---|---|
| capability_category | `type + code` | `type + title` | 分类编码可能只有末尾字母 |
| capability_domain | `type + code` | `type + title` | L1 能力一般有稳定编码 |
| capability | `type + code` | `type + title` | L2 能力必须优先按编码 |
| capability_focus | `type + code` | 不建议备用 | 关注点编号是关键主键 |
| scope_type | `type + code` | `type + title` | 作用域编码稳定 |
| security_technical_service | `type + code` | `type + scope_code + title` | 服务编码包含作用域和关注点 |
| security_technology_module | `type + title` | `type + title + security_system` | 当前样例模块没有独立编号 |
| security_system | `type + title` | `type + category + title` | 系统名称作为主键 |
| product | `type + title` | 无 | 第一批只保留产品名 |
| information_environment | `type + title` | 无 | 环境名称作为主键 |
| environment_segment | `type + parent_environment + title` | `type + title` | 用户确认第 3 列命名可用 |
| information_object | `type + environment_segment + title` | `type + title` | 同名对象可能出现在不同环境 |
| security_work | `type + capability_focus_code + title` | `type + title` | 安全工作可能跨关注点复用，来源关系必须保留 |
| process_domain | `type + title` | `type + category + title` | 流程树 L1 |
| process_group | `type + title` | `type + process_domain + title` | 流程树 L2 |
| process_reference | `type + process_group + title` | `type + title` | L3流程参考，同名不同组时优先保留组上下文 |
| process_activity | `type + process_reference + title` | `type + title` | L4关键活动当前可为空 |
| work_function_layer | `type + title` | 无 | 四类固定层级 |
| work_function_group | `type + layer + title` | `type + title` | 职能层级下的分组 |
| work_function | `type + code` | `type + layer + group + title` | 序号可用时优先按序号 |
| work_task | `type + work_function + title` | `type + title` | 内部工作任务 |
| gbt_42446_task_reference | `type + category + title` | `type + title` | GB/T 42446-2023 引用任务 |
| work_role_reference | `type + category + title` | `type + title` | Gartner 岗位参考 |
| relation | `source_id + relation_type + target_id + source_sheet + source_row` | 无 | 保留来源行，避免丢失多来源证据 |

## 5. Sheet 映射规则

### 5.1 安全能力目录

数据起始行：第 4 行。

需要向下继承的列：安全能力分类、L1 高阶战略能力、L2安全能力、能力定义。

| 规则编号 | 来源列 | 目标对象 | 目标字段 | 转换规则 | 必填 | 说明 |
|---|---|---|---|---|---|---|
| MAP-CAP-001 | 安全能力分类 | capability_category | title | T-TRIM | 是 | 如“安全技术能力 T” |
| MAP-CAP-002 | 安全能力分类 | capability_category | code | T-CODE-TITLE | 否 | 提取末尾编码，如 `T` |
| MAP-CAP-003 | L1 高阶战略能力 | capability_domain | title | T-TRIM | 是 | 如“基础架构安全 Architectural Security T-AS” |
| MAP-CAP-004 | L1 高阶战略能力 | capability_domain | code | T-CODE-TITLE | 否 | 提取 `T-AS` |
| MAP-CAP-005 | L2安全能力 | capability | title | T-TRIM | 是 | 如“网络安全体系架构管控能力 T-AS.AD” |
| MAP-CAP-006 | L2安全能力 | capability | code | T-CODE-TITLE | 是 | 提取 `T-AS.AD` |
| MAP-CAP-007 | 能力定义 | capability | description | T-TRIM | 否 | 能力定义正文 |
| MAP-CAP-008 | 序号 | capability_focus | code | T-TRIM | 是 | 如 `T-AS.AD-01` |
| MAP-CAP-009 | 关注点 | capability_focus | title | T-TRIM | 是 | 关注点名称 |
| MAP-CAP-010 | 关注点描述 | capability_focus | description | T-TRIM | 否 | 关注点说明 |

关系生成：

| 规则编号 | 起点 | 关系 | 终点 | 条件 |
|---|---|---|---|---|
| MAP-CAP-R001 | capability_domain | belongs_to | capability_category | L1 和分类均存在 |
| MAP-CAP-R002 | capability | belongs_to | capability_domain | L2 和 L1 均存在 |
| MAP-CAP-R003 | capability_focus | belongs_to | capability | 关注点编号和 L2 均存在 |

校验规则：

| 校验编号 | 规则 | 失败处理 |
|---|---|---|
| MAP-CAP-V001 | `capability_focus.code` 不能为空 | 进入错误列表 |
| MAP-CAP-V002 | `capability_focus.title` 不能为空 | 进入错误列表 |
| MAP-CAP-V003 | 同一关注点编号重复但标题不一致 | 进入冲突列表 |

### 5.2 安全能力作用域目录

数据起始行：第 3 行。

需要向下继承的列：情景。

| 规则编号 | 来源列 | 目标对象 | 目标字段 | 转换规则 | 必填 | 说明 |
|---|---|---|---|---|---|---|
| MAP-SCOPE-001 | 情景 | scope_type | scenario | T-FILL-DOWN + T-TRIM | 否 | 如“网络空间”“过程” |
| MAP-SCOPE-002 | 作用域类型 | scope_type | code | T-SCOPE-CODE + T-CODE-TITLE | 是 | 如 `I-US`、`LC-DT` |
| MAP-SCOPE-003 | 作用域类型 | scope_type | title | T-SCOPE-CODE + T-CODE-TITLE | 是 | 如“用户”“数据生命周期” |
| MAP-SCOPE-004 | 描述 | scope_type | description | T-TRIM | 否 | 作用域说明 |

校验规则：

| 校验编号 | 规则 | 失败处理 |
|---|---|---|
| MAP-SCOPE-V001 | `scope_type.code` 不能为空 | 进入错误列表 |
| MAP-SCOPE-V002 | 同一作用域编码重复但名称不一致 | 进入冲突列表 |

### 5.3 安全能力-安全技术服务

数据起始行：第 4 行。

需要向下继承的列：安全能力分类、L1 高阶战略能力、L2安全能力。

特殊结构：这是宽表。第 7 列到第 13 列是作用域列，每个非空、非 `/` 单元格都应转成一条服务记录或服务关系。

| 规则编号 | 来源列 | 目标对象 | 目标字段 | 转换规则 | 必填 | 说明 |
|---|---|---|---|---|---|---|
| MAP-SVC-001 | 安全能力分类 | capability_category | title / code | T-FILL-DOWN + T-CODE-TITLE | 否 | 与能力目录对齐，不重复造概念 |
| MAP-SVC-002 | L1 高阶战略能力 | capability_domain | title / code | T-FILL-DOWN + T-CODE-TITLE | 否 | 与能力目录对齐 |
| MAP-SVC-003 | L2安全能力 | capability | title / code | T-FILL-DOWN + T-CODE-TITLE | 否 | 与能力目录对齐 |
| MAP-SVC-004 | 序号 | capability_focus | code | T-TRIM | 是 | 与能力目录对齐 |
| MAP-SVC-005 | 关注点 | capability_focus | title | T-TRIM | 否 | 用于校验标题是否一致 |
| MAP-SVC-006 | 作用域列表头 | scope_type | code / title | T-SCOPE-CODE + T-CODE-TITLE | 是 | 如 `I-NT 网络` |
| MAP-SVC-007 | 作用域列单元格 | security_technical_service | code | T-IGNORE + T-CODE-TITLE | 是 | 如 `I-NT&T-AS.AD-01` |
| MAP-SVC-008 | 作用域列单元格 | security_technical_service | title | T-IGNORE + T-CODE-TITLE | 是 | 如“网络平面及区域划分” |
| MAP-SVC-009 | 作用域列单元格 | security_technical_service | scope_code | T-SCOPE-CODE | 是 | 优先取单元格编码中的作用域 |
| MAP-SVC-010 | 作用域列单元格 | security_technical_service | capability_focus_code | T-CODE-TITLE | 是 | 优先取单元格编码中的关注点编号 |

关系生成：

| 规则编号 | 起点 | 关系 | 终点 | 条件 |
|---|---|---|---|---|
| MAP-SVC-R001 | security_technical_service | supports_focus | capability_focus | 服务和关注点均存在 |
| MAP-SVC-R002 | security_technical_service | applies_to_scope | scope_type | 服务和作用域均存在 |

校验规则：

| 校验编号 | 规则 | 失败处理 |
|---|---|---|
| MAP-SVC-V001 | 作用域单元格为 `/` 或空值时不生成记录 | 自动跳过 |
| MAP-SVC-V002 | 服务编码中的关注点编号与当前行关注点编号不一致 | 进入冲突列表 |
| MAP-SVC-V003 | 服务编码中的作用域编码与列头作用域不一致 | 进入冲突列表 |

### 5.4 安全技术模块清单

数据起始行：第 3 行。

需要向下继承的列：分类、安全系统、安全技术模块、安全技术模块定义、对应我司产品。

特殊结构：一个模块可能占多行，每行列出一个安全技术服务映射。

| 规则编号 | 来源列 | 目标对象 | 目标字段 | 转换规则 | 必填 | 说明 |
|---|---|---|---|---|---|---|
| MAP-MOD-001 | 分类 | security_system | category | T-FILL-DOWN + T-TRIM | 否 | 如“终端安全” |
| MAP-MOD-002 | 安全系统 | security_system | title | T-FILL-DOWN + T-TRIM | 是 | 如“终端安全管控” |
| MAP-MOD-003 | 分类 | security_technology_module | category | T-FILL-DOWN + T-TRIM | 否 | 继承模块分类 |
| MAP-MOD-004 | 安全技术模块 | security_technology_module | title | T-FILL-DOWN + T-TRIM | 是 | 如“桌面安全管理（UEM）” |
| MAP-MOD-005 | 安全技术模块定义 | security_technology_module | description | T-FILL-DOWN + T-TRIM | 否 | 模块定义 |
| MAP-MOD-006 | 安全技术服务映射 | security_technical_service | code / title | T-CODE-TITLE | 是 | 用于匹配已有服务，缺失则生成待确认服务 |
| MAP-MOD-007 | 对应我司产品 | product | title | T-FILL-DOWN + T-TRIM | 否 | 第一批只存产品名 |

关系生成：

| 规则编号 | 起点 | 关系 | 终点 | 条件 |
|---|---|---|---|---|
| MAP-MOD-R001 | security_technology_module | part_of_system | security_system | 模块和系统均存在 |
| MAP-MOD-R002 | security_technology_module | implements_service | security_technical_service | 服务映射存在 |
| MAP-MOD-R003 | security_technology_module | maps_to_product | product | 产品名称存在 |

校验规则：

| 校验编号 | 规则 | 失败处理 |
|---|---|---|
| MAP-MOD-V001 | 模块名称不能为空 | 进入错误列表 |
| MAP-MOD-V002 | 服务映射无法匹配已有服务时 | 生成待确认服务，并进入提醒列表 |
| MAP-MOD-V003 | 同一模块名对应多个不同定义 | 进入冲突列表 |

### 5.5 作用域-安全技术服务-安全技术模块映射

数据起始行：第 3 行。

需要向下继承的列：信息化环境、environment_segment、信息化对象、作用域、安全系统。

已确认命名：第 3 列无表头，第一批命名为 `environment_segment`。

| 规则编号 | 来源列 | 目标对象 | 目标字段 | 转换规则 | 必填 | 说明 |
|---|---|---|---|---|---|---|
| MAP-SCENE-001 | 信息化环境 | information_environment | title | T-FILL-DOWN + T-TRIM | 是 | 如“网络周界” |
| MAP-SCENE-002 | 第 3 列 | environment_segment | title | T-FILL-DOWN + T-TRIM | 否 | 如“互联网边界” |
| MAP-SCENE-003 | 信息化对象 | information_object | title | T-FILL-DOWN + T-TRIM | 是 | 如“互联网入口边界” |
| MAP-SCENE-004 | 作用域 | scope_type | code / title | T-SPLIT-SCOPE + T-SCOPE-CODE | 否 | 多作用域拆分 |
| MAP-SCENE-005 | 安全技术服务 | security_technical_service | code / title | T-CODE-TITLE | 是 | 匹配已有服务，缺失则生成待确认服务 |
| MAP-SCENE-006 | 安全技术模块/措施 | security_technology_module | title | T-TRIM | 否 | 匹配已有模块，缺失则生成待确认模块 |
| MAP-SCENE-007 | 安全系统 | security_system | title | T-FILL-DOWN + T-TRIM | 否 | 匹配已有系统 |

关系生成：

| 规则编号 | 起点 | 关系 | 终点 | 条件 |
|---|---|---|---|---|
| MAP-SCENE-R001 | environment_segment | belongs_to | information_environment | environment_segment 存在 |
| MAP-SCENE-R002 | information_object | belongs_to | environment_segment | environment_segment 存在 |
| MAP-SCENE-R003 | information_object | belongs_to | information_environment | environment_segment 不存在时 |
| MAP-SCENE-R004 | information_object | applies_to_scope | scope_type | 作用域存在 |
| MAP-SCENE-R005 | security_technical_service | protects_object | information_object | 服务和对象均存在 |
| MAP-SCENE-R006 | security_technology_module | implements_service | security_technical_service | 模块和服务均存在 |
| MAP-SCENE-R007 | security_technology_module | part_of_system | security_system | 模块和系统均存在 |
| MAP-SCENE-R008 | security_technology_module | deployed_in_environment | information_environment | 模块和环境均存在 |

校验规则：

| 校验编号 | 规则 | 失败处理 |
|---|---|---|
| MAP-SCENE-V001 | 信息化环境不能为空 | 进入错误列表 |
| MAP-SCENE-V002 | 信息化对象不能为空 | 进入错误列表 |
| MAP-SCENE-V003 | 服务无法匹配已有服务 | 生成待确认服务，并进入提醒列表 |
| MAP-SCENE-V004 | 模块无法匹配已有模块 | 生成待确认模块，并进入提醒列表 |

### 5.6 安全能力-安全工作

数据起始行：第 4 行。

需要向下继承的列：安全能力分类、L1 高阶战略能力、L2安全能力。

| 规则编号 | 来源列 | 目标对象 | 目标字段 | 转换规则 | 必填 | 说明 |
|---|---|---|---|---|---|---|
| MAP-WORK-001 | 序号 | capability_focus | code | T-TRIM | 是 | 对齐已有关注点 |
| MAP-WORK-002 | 关注点 | capability_focus | title | T-TRIM | 否 | 用于校验标题一致性 |
| MAP-WORK-003 | 安全工作 | security_work | title / description | T-TRIM | 是 | 生成安全工作对象 |

关系生成：

| 规则编号 | 起点 | 关系 | 终点 | 条件 |
|---|---|---|---|---|
| MAP-WORK-R001 | capability_focus | maps_to_work | security_work | 关注点和安全工作均存在 |

### 5.7 安全能力-安全管理元素（high level）

数据起始行：第 4 行。

| 规则编号 | 来源列 | 目标对象 | 目标字段 | 转换规则 | 必填 | 说明 |
|---|---|---|---|---|---|---|
| MAP-MGMT-HL-001 | L2安全能力 | capability | code / title | T-FILL-DOWN + T-CODE-TITLE | 是 | 用于 L2能力到 L2流程组映射 |
| MAP-MGMT-HL-002 | 序号 | capability_focus | code | T-TRIM | 是 | 关注点编码 |
| MAP-MGMT-HL-003 | L2流程组 | process_group | title | T-TRIM | 否 | 来自流程主数据 |
| MAP-MGMT-HL-004 | L3流程参考（结合信息化对象） | process_reference | title | T-SPLIT-MULTI + T-TRIM | 否 | 允许一行多个流程参考 |
| MAP-MGMT-HL-005 | 决策层/管理层/执行层/监督层 | work_function | title | T-SPLIT-MULTI + T-TRIM | 否 | 匹配 `安全工作职能清单` |

关系生成：

| 规则编号 | 起点 | 关系 | 终点 | 条件 |
|---|---|---|---|---|
| MAP-MGMT-HL-R001 | capability | maps_to_process | process_group | L2能力和 L2流程组均存在 |
| MAP-MGMT-HL-R002 | capability_focus | maps_to_process | process_reference | 关注点和 L3流程参考均存在 |
| MAP-MGMT-HL-R003 | capability_focus | stakeholder_by | work_function | 关注点和职能相关方均存在 |
| MAP-MGMT-HL-R004 | process_reference | stakeholder_by | work_function | 流程参考和职能相关方均存在 |

### 5.8 安全职能流程清单（完善L4）

数据起始行：第 4 行。

| 规则编号 | 来源列 | 目标对象 | 目标字段 | 转换规则 | 必填 | 说明 |
|---|---|---|---|---|---|---|
| MAP-PROC-001 | 流程分类 | process_domain / process_group | category | T-FILL-DOWN + T-TRIM | 否 | 作为流程分类 |
| MAP-PROC-002 | L1流程域 | process_domain | title | T-FILL-DOWN + T-TRIM | 是 | 流程树 L1 |
| MAP-PROC-003 | L2流程组 | process_group | title | T-FILL-DOWN + T-TRIM | 是 | 流程树 L2 |
| MAP-PROC-004 | L3流程参考 | process_reference | title | T-FILL-DOWN + T-TRIM | 是 | 流程树 L3 |
| MAP-PROC-005 | L4关键活动 | process_activity | title | T-TRIM | 否 | 空值不生成对象 |

关系生成：

| 规则编号 | 起点 | 关系 | 终点 | 条件 |
|---|---|---|---|---|
| MAP-PROC-R001 | process_group | belongs_to | process_domain | L1、L2 均存在 |
| MAP-PROC-R002 | process_reference | belongs_to | process_group | L2、L3 均存在 |
| MAP-PROC-R003 | process_reference | has_activity | process_activity | L4关键活动非空 |

### 5.9 安全工作职能清单

数据起始行：第 4 行。该 Sheet 还包含一张嵌入图片，需要作为页面展示资产提取。

| 规则编号 | 来源列 | 目标对象 | 目标字段 | 转换规则 | 必填 | 说明 |
|---|---|---|---|---|---|---|
| MAP-FUNC-001 | 职能类 | work_function_layer | title | T-FILL-DOWN + T-TRIM | 是 | 网络安全决策层、管理层、执行层、监督层 |
| MAP-FUNC-002 | 职能分组列 | work_function_group | title | T-FILL-DOWN + T-TRIM | 否 | 当前读取到的空表头列，需按列位识别 |
| MAP-FUNC-003 | 序号 | work_function | code | T-TRIM | 否 | 作为职能编号 |
| MAP-FUNC-004 | 工作职能 | work_function | title | T-TRIM | 是 | 具体工作职能 |
| MAP-FUNC-005 | 职能定义 | work_function | description | T-TRIM | 否 | 职能定义 |
| MAP-FUNC-006 | GB/T 42446-2023 对应 | work_function | metadata_json.gbt_mapping_raw | T-MERGED-HEADER + T-TRIM | 否 | 按用户说明重点识别 G 列映射区域 |
| MAP-FUNC-007 | 工作类别 | gbt_42446_task_reference | category | T-MERGED-HEADER + T-TRIM | 否 | GB/T 42446-2023 引用数据 |
| MAP-FUNC-008 | 承担的工作任务 | gbt_42446_task_reference / work_task | title | T-MERGED-HEADER + T-TRIM | 否 | 既可作为引用任务，也可作为职能承担任务 |
| MAP-FUNC-009 | 嵌入图片 | attachment asset | file_path / anchor | extract image | 否 | 提取 Draw.io 导出 PNG，用于职能页面展示 |

关系生成：

| 规则编号 | 起点 | 关系 | 终点 | 条件 |
|---|---|---|---|---|
| MAP-FUNC-R001 | work_function_group | belongs_to_layer | work_function_layer | 分组和层级均存在 |
| MAP-FUNC-R002 | work_function | belongs_to_layer | work_function_layer | 职能和层级均存在 |
| MAP-FUNC-R003 | work_function | performs_task | work_task | 工作任务非空 |
| MAP-FUNC-R004 | work_function | maps_to_gbt_task | gbt_42446_task_reference | GB/T 引用非空 |

### 5.10 gartner工作岗位参考

数据起始行：第 3 行。

| 规则编号 | 来源列 | 目标对象 | 目标字段 | 转换规则 | 必填 | 说明 |
|---|---|---|---|---|---|---|
| MAP-GARTNER-001 | 分类 | work_role_reference | category | T-FILL-DOWN + T-TRIM | 是 | Gartner 角色分类 |
| MAP-GARTNER-002 | 角色 | work_role_reference | title | T-TRIM | 是 | 岗位/角色名称 |
| MAP-GARTNER-003 | 描述 | work_role_reference | description | T-TRIM | 否 | 角色说明 |

关系生成：

| 规则编号 | 起点 | 关系 | 终点 | 条件 |
|---|---|---|---|---|
| MAP-GARTNER-R001 | work_function | references_role | work_role_reference | 第二批不自动生成，仅为后续人工维护预留 |

## 6. 导入预览需要展示的内容

第一版导入预览不需要复杂，但必须让用户看清楚将发生什么。

| 预览项 | 说明 |
|---|---|
| 新增对象数量 | 按对象类型统计 |
| 新增关系数量 | 按关系类型统计 |
| 跳过记录数量 | 空行、`/`、重复等 |
| 错误记录 | 必填字段缺失 |
| 冲突记录 | 同一编码对应不同名称或定义 |
| 待确认记录 | 无法匹配已有服务、模块、系统的记录 |
| 来源摘要 | 文件名、Sheet、行号范围、文件 hash |

## 7. 第一批验收标准

这批映射规则完成后，开发 Agent 写 ETL 时至少要做到：

1. 能识别 5 个核心 Sheet。
2. 能正确跳过表头和空行。
3. 能处理合并单元格造成的空值继承。
4. 能把 `安全能力-安全技术服务` 从宽表转成长表。
5. 能把同一个对象多次出现时合并为一个对象。
6. 能保留每个对象和关系的来源 Sheet、行号、单元格。
7. 能生成导入预览，而不是直接写入正式库。
8. 能把无法匹配的服务或模块标记为待确认。

## 8. 后续 26 个 Sheet 扩展策略

完整 Excel 的 26 个 Sheet 后续都要处理。建议按主题分批扩展：

| 批次 | Sheet 类型 | 目标 |
|---|---|---|
| 第二批 | 安全工作、管理元素、流程、职能、Gartner 岗位参考 | 扩展 `security_work`、`process_*`、`work_function_*`、`gbt_42446_task_reference`、`work_role_reference` |
| 第三批 | LC-DT、LC-AP 生命周期相关 Sheet | 扩展 Lifecycle、LifecycleScene、ApplicationType 对象 |
| 第四批 | 标准框架、制度、控制项 | 扩展 StandardFramework、StandardControl、PolicyItem 对象 |
| 第五批 | 目录、版本控制、引用性 Sheet | 支持页面导航、版本追踪、数据维护 |

扩展时遵循同一原则：先盘点 Sheet，再补字段字典，再补映射规则，再开发 ETL。
