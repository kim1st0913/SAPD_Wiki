# 第三批数据契约与验收标准

本文档定义第三批生命周期 Sheet 的建模、ETL 和验收边界。第三批只做生命周期知识，不引入标准框架控制项，也不改动第二批流程/职能页面。

## 1. 第三批范围

| Sheet | 角色 | 处理优先级 |
|---|---|---|
| `LC-DT 数据生命周期` | 数据生命周期过程，以及过程到安全技术服务、技术模块的映射 | P0 |
| `LC-DT 数据生命周期场景目录` | 数据生命周期过程定义和场景主数据 | P0 |
| `LC-AP 应用安全开发生命周期` | 应用安全开发阶段、主要活动、安全活动、安全策略、开发技术服务和产品示例 | P0 |
| `LC-AP 应用安全开发生命周期元素目录` | 软件开发类型、应用系统类型、应用组件字典 | P1 |

暂不处理：

- 标准/框架控制项 Sheet；
- `安全能力-网络安全制度、框架映射`；
- 生命周期相关页面的复杂图谱交互；
- AI 问答或语义检索。

## 2. 对象契约

| type | 中文名 | 来源 Sheet | 稳定身份 |
|---|---|---|---|
| `lifecycle_process` | 生命周期过程/阶段 | LC-DT、LC-AP | `lifecycle_type + order + title` |
| `lifecycle_scene` | 数据生命周期场景 | LC-DT 数据生命周期场景目录 | `scene_code + title` |
| `security_activity` | 安全活动 | LC-AP 应用安全开发生命周期 | `lifecycle_process + title` |
| `security_policy_requirement` | 安全策略要求 | LC-AP 应用安全开发生命周期 | `lifecycle_process + sequence + text_hash` |
| `software_development_type` | 软件开发类型 | LC-AP 元素目录 | `title` |
| `application_system_type` | 应用系统类型 | LC-AP 元素目录 | `title` |
| `application_component` | 应用组件 | LC-AP 元素目录 | `application_system_type + title` |

复用既有对象：

| 既有 type | 用途 |
|---|---|
| `security_technical_service` | LC-DT 和 LC-AP 中的安全技术服务/开发技术服务 |
| `security_technology_module` | LC-DT 中的安全技术模块 |
| `product` | LC-AP 中的实际产品示例 |

## 3. 关系契约

| relation_type | 中文显示 | 起点 | 终点 | 来源 |
|---|---|---|---|---|
| `has_scene` | 包含场景 | `lifecycle_process` | `lifecycle_scene` | LC-DT 数据生命周期场景目录 |
| `maps_to_lifecycle` | 映射到生命周期 | `security_technical_service` / `security_technology_module` | `lifecycle_process` | LC-DT 数据生命周期 |
| `has_activity` | 包含活动 | `lifecycle_process` | `security_activity` | LC-AP 应用安全开发生命周期 |
| `requires_policy` | 要求策略 | `security_activity` / `lifecycle_process` | `security_policy_requirement` | LC-AP 应用安全开发生命周期 |
| `applies_to_development_type` | 适用于开发类型 | `lifecycle_process` / `security_activity` | `software_development_type` | LC-AP 应用安全开发生命周期 |
| `uses_service` | 使用服务 | `lifecycle_process` / `security_activity` | `security_technical_service` | LC-AP 应用安全开发生命周期 |
| `uses_product` | 使用产品示例 | `lifecycle_process` / `security_activity` | `product` | LC-AP 应用安全开发生命周期 |
| `has_component` | 包含组件 | `application_system_type` | `application_component` | LC-AP 元素目录 |

## 4. 解析规则

| 规则 | 说明 |
|---|---|
| `fill_down` | LC-DT 场景目录和 LC-AP 元素目录存在空白延续行，过程、应用系统类型需要向下继承 |
| `split_lines` | 多行单元格按换行拆分为多个服务、模块、产品或策略条目 |
| `split_numbered_list` | LC-AP 安全策略字段按 `1.`、`2.` 等编号拆分为多条 `security_policy_requirement` |
| `ignore_placeholder` | `/`、空值不生成对象 |
| `match_existing_service` | 能匹配已有安全技术服务名称或编码时复用现有对象 |
| `match_existing_module` | 能匹配已有安全技术模块名称时复用现有对象 |
| `source_trace_required` | 每个对象和关系必须保留 Sheet、行号、列或单元格 |

## 5. 前端边界

第三批建议新增 `生命周期` 模块，采用二级页面：

| 页面 | 内容 |
|---|---|
| `数据生命周期` | 数据生命周期过程、场景、相关安全技术服务、技术模块 |
| `应用安全开发生命周期` | 应用安全开发阶段、活动、策略、开发技术服务、产品示例 |
| `应用类型字典` | 软件开发类型、应用系统类型、应用组件 |

第一版页面只要求清单、详情和关联展示，不做图谱编辑和复杂筛选。

## 6. 验收标准

| 编号 | 验收点 | 标准 |
|---|---|---|
| A3-ETL-001 | 4 个 Sheet 可识别 | 缺 Sheet 时输出明确 validation |
| A3-ETL-002 | 数据生命周期过程 | 至少生成 8 个 `lifecycle_process` |
| A3-ETL-003 | 数据生命周期场景 | 至少生成 36 个 `lifecycle_scene` |
| A3-ETL-004 | 应用安全开发阶段 | 至少生成 8 个 LC-AP `lifecycle_process` |
| A3-ETL-005 | 策略拆分 | 编号策略应拆为可单独展示的 `security_policy_requirement` |
| A3-ETL-006 | 来源追踪 | 对象和关系均可追溯到 Sheet 和行号 |
| A3-EXP-001 | 导出 | 第三批对象和关系可通过现有 export-items/export-relations 导出 |
| A3-FE-001 | 页面 | 新增生命周期入口，不影响能力目录和知识来源模块 |

## 7. Agent 分工建议

| 角色 | 责任 |
|---|---|
| 主控 Agent | 确认契约、拆分任务、集成验收、维护 issue/progress |
| ETL Worker | 实现第三批 parser、候选对象、关系、validation |
| Export/Verify Worker | 扩展导出 JSON 和第三批验证报告 |
| Frontend Worker | 在数据契约稳定后实现生命周期页面 |

当前阶段先完成契约和建模，暂不启动前端 Worker。
