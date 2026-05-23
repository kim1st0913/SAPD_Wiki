# 信息化环境安全能力映射图谱策略交接

日期：2026-05-20
适用页面：`信息化环境安全能力映射`（`/environment-mapping`）
当前目标：在进入前端实现前，先固化信息化环境页的图谱层级策略、节点边界和验收口径。

## 1. 设计结论

信息化环境页不应复制安全能力页早期“大网全展开”逻辑。它的主语是环境、环境子类和信息化对象，图谱应按层级回答不同问题：

| 层级 | 选中对象 | 图谱回答的问题 | 展开深度 |
|---|---|---|---|
| `E0` | 信息化环境 | 当前环境由哪些环境子类和信息化对象组成 | 只展示结构 |
| `E1` | 环境子类 | 当前子类下有哪些对象，以及对象关联哪些作用域、服务和能力概览 | 展示概览关系 |
| `E2` | 信息化对象 | 当前对象需要哪些作用域、服务、模块 / 措施、系统 / 产品和能力 / 关注点支撑 | 完整展示可用关系 |

核心原则：

- 高层节点只看结构和概览，不展示所有下游明细。
- 叶子对象才完整展开技术支撑链和能力关联。
- 系统、产品、技术措施、能力关注点可以在 `E2` 完整展示，但不应在 `E0` / `E1` 造成大网膨胀。
- 标准 / 框架、管理流程如尚未进入 `environment-workbench.json` 可靠投影，不在环境图谱中临时补造；可通过能力 / 关注点跳转到安全能力页查看。

## 2. 数据基础

当前可用数据包：

```text
frontend/capability-browser/public/data/environment-workbench.json
```

当前包已存在，顶层字段符合 `environment-workbench.json` 规格：

- `meta`
- `page`
- `navigator`
- `overview`
- `relationshipGroups`
- `objects`
- `relations`
- `evidenceRefs`
- `compatibility`

当前数据规模：

| 对象类型 | 数量 |
|---|---:|
| `information_environment` | 10 |
| `environment_segment` | 29 |
| `information_object` | 49 |
| `scope_type` | 6 |
| `security_technical_service` | 92 |
| `security_technology_module` | 98 |
| `security_technical_measure` | 29 |
| `security_system` | 28 |
| `product` | 62 |
| `capability` | 13 |
| `capability_focus` | 33 |
| `relations` | 2413 |

当前关系类型已覆盖：

- `contains_segment`
- `contains_object`
- `applies_to_scope`
- `protects_object`
- `deployed_in_environment`
- `supports_focus`
- `supports_capability`
- `implements_service`
- `implemented_by_module`
- `part_of_system`
- `maps_to_product`
- `has_measure`

注意：`meta.generated_at` 可以存在于数据包元数据中，但主展示区不得显示 `generated_at`。

## 3. E0 信息化环境结构图

选中 `information_environment` 时，图谱只展示当前环境下的结构：

```text
信息化环境 -> 环境子类 -> 信息化对象
```

展示节点：

- 当前 `information_environment`
- 直属 `environment_segment`
- 子类下的 `information_object`

不展示：

- `scope_type`
- `security_technical_service`
- `security_technology_module`
- `security_technical_measure`
- `security_system`
- `product`
- `capability`
- `capability_focus`
- 标准 / 框架控制项
- 管理流程

说明文案建议：

```text
E0 结构图：展示当前信息化环境下的环境子类和信息化对象，不展开作用域、服务、模块、系统、产品和能力关注点。
```

示例：`云数据中心` 只展示它的 18 个环境子类和对应对象，不把 92 个服务或 2413 条关系带入图谱。

## 4. E1 环境子类映射概览

选中 `environment_segment` 时，图谱展示当前环境子类下对象的概览关系：

```text
环境子类 -> 信息化对象 -> 作用域 -> 安全技术服务 -> 能力 / 关注点概览
```

展示节点：

- 当前 `environment_segment`
- 子类下的 `information_object`
- 对象关联的 `scope_type`
- 作用域下的 `security_technical_service`
- 服务支撑的 `capability` 和 `capability_focus` 概览节点

不继续展开：

- 服务下的 `security_technology_module`
- 服务 / 模块下的 `security_technical_measure`
- `security_system`
- `product`
- 标准 / 框架控制项
- 管理流程 L2 / L3 / L4

说明文案建议：

```text
E1 映射概览：展示当前环境子类下的信息化对象、作用域、安全技术服务和能力 / 关注点概览；模块、措施、系统和产品仅在具体对象中展开。
```

节点控制建议：

- 对象数量通常较小，可完整展示。
- 作用域只有 6 类，可完整展示。
- 服务和关注点按当前子类实际命中完整展示；如果单个子类异常超过 120 个业务节点，应聚合为服务组或能力组。
- 不生成无业务名称的占位节点。

## 5. E2 信息化对象完整图

选中 `information_object` 时，图谱完整展示当前对象的可用业务关系：

```text
信息化对象
  -> 作用域
  -> 安全技术服务
  -> 安全技术模块 / 安全技术措施
  -> 安全系统
  -> 产品
  -> 能力 / 关注点
```

展示节点：

- 当前 `information_object`
- 所属 `information_environment`
- 所属 `environment_segment`
- `scope_type`
- `security_technical_service`
- `security_technology_module`
- `security_technical_measure`
- `security_system`
- `product`
- `capability`
- `capability_focus`

完整展示原则：

- 当前对象下的作用域、服务、模块、措施、系统、产品和能力 / 关注点不做固定条数截断。
- 如数据中存在 `/`、空值、`待补充`、`不适用`，不生成正式业务节点；由表格或空状态表达。
- 技术模块和技术措施必须保持不同节点类型，不混成 `模块/措施` 单一类型。
- 系统和产品属于支撑明细，不反向变成图谱中心。

说明文案建议：

```text
E2 对象完整图：展示当前信息化对象的作用域、服务、模块 / 措施、系统、产品和能力 / 关注点关联。
```

## 6. 标准 / 流程边界

当前 `environment-workbench.json` 可以可靠表达环境、对象、作用域、服务、模块、措施、系统、产品和能力关联，但不应在环境页直接生成标准控制项或管理流程。

建议边界：

- 环境页图谱显示 `capability` / `capability_focus`，帮助用户知道对象支撑哪些安全能力。
- 点击能力或关注点后，后续可跳转到 `安全能力映射` 页查看该关注点的标准 / 框架、管理流程和控制项。
- 除非后端明确输出环境对象到标准 / 流程的关系投影，否则环境页不从能力页数据反向拼接标准控制项。

这样能避免两个风险：

1. 同一个信息化对象命中多个服务和关注点后，标准控制项会迅速膨胀成不可读大网。
2. 前端会被迫跨数据包推断业务事实，违背前后端分离规则。

## 7. 交互与布局建议

图谱组件可以复用安全能力页 `LocalRelationNetworkGraph` 的基础能力，但应先抽象输入模型，不直接把安全能力页的 `currentFocus` 结构套到环境页。

建议新增环境图谱模型：

```text
frontend/capability-browser/models/environmentRelationGraphModel.js
```

建议新增环境图谱容器：

```text
frontend/capability-browser/components/EnvironmentLocalRelationMap.js
```

实现边界：

- `EnvironmentLocalRelationMap` 只负责渲染环境页关系摘要和切换 Tab。
- `environmentRelationGraphModel` 负责把 `environment-workbench` ViewModel 转为 nodes / edges。
- `LocalRelationNetworkGraph` 继续只负责 SVG 渲染、缩放、拖拽和平移。
- 不在组件中遍历原始 Sheet、解析来源字段或临时生成业务关系。

布局建议：

- `E0` 使用清晰树形 / 分层布局，优先可读，不追求星形复杂度。
- `E1` 使用中心节点 + 分组概览，服务和关注点自然散开。
- `E2` 使用对象中心的径向关系图，支撑链路分成“作用域 / 服务”“模块 / 措施”“系统 / 产品”“能力 / 关注点”几个语义组。
- 节点量大时降低布局迭代次数，保留缩放、拖拽、`1:1` 复位。

## 8. 页面结构建议

当前环境页已经有：

- `EnvironmentTree`
- `EnvironmentRelationshipOverview`
- `EnvironmentScopeServiceMatrix`
- `EnvironmentDetailPanel`

后续实施可把右侧详情调整为：

1. 对象 / 环境概览头部；
2. `本地关系图谱`；
3. `作用域与服务矩阵`；
4. `模块 / 措施 / 系统 / 产品明细`；
5. `能力 / 关注点关联`；
6. `来源证据` 折叠面板。

其中 `E0` 和 `E1` 默认先看图谱与矩阵概览，`E2` 才打开完整明细。

## 9. 验收标准

实现后至少验证：

- `E0` 选中一个信息化环境时，只显示环境子类和信息化对象，不显示作用域、服务、模块、系统、产品、能力或关注点。
- `E1` 选中一个环境子类时，显示对象、作用域、服务和能力 / 关注点概览，不展开模块、措施、系统、产品、标准控制项或管理流程。
- `E2` 选中一个信息化对象时，完整显示当前对象的作用域、服务、模块 / 措施、系统、产品和能力 / 关注点。
- 图谱业务节点不出现空文本、`/`、`待投影`、`待补充` 伪业务节点。
- 主展示区不出现 `sheet`、`row`、`column`、`raw_value`、`source_file`、`import_id`、`source_id`、`source_ref`、`source_label`、`debug`、`raw`、`metadata`、`intermediate`、`generated_at`。
- 页面横向溢出为 `0`。
- `environment-workbench.json` 缺失时可显示受控 fallback 状态；正常存在时优先使用该包。
- 静态预览和 API fallback 行为不破坏安全能力映射页、LC-AP 页和专项维护页。

建议验证命令：

```bash
python3 scripts/data_package_summary.py --package environment-workbench
node --check frontend/capability-browser/app.js frontend/capability-browser/viewModels.js
node scripts/frontend_smoke_check.mjs --page environment --url http://127.0.0.1:5174/
git diff --check
```

## 10. 本轮不做事项

本策略交接不要求立即：

- 修改前端代码；
- 修改 `environment-workbench.json`；
- 修改 ETL；
- 修改 SQLite schema；
- 重跑全量导入；
- 引入 React / Vue；
- 把标准控制项或管理流程硬塞进环境页；
- 手工编辑 `public/data/*.json`。

下一步若进入实现，应先只做环境页图谱模型和容器组件的小范围改动，并保留现有表格作为业务核对入口。
