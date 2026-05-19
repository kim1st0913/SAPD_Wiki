# BE-4 三份 workbench 数据质量与缺口清单

日期：2026-05-18

本轮只做三份 workbench 数据包的静态审计，不修改前端页面、不修改 ETL、不修改数据库 schema、不重新导入数据、不启动前端。

## 检查范围

| 数据包 | 页面定位 | 文件路径 |
|---|---|---|
| `capability-workbench.json` | 安全能力映射 P1 工作台 | `frontend/capability-browser/public/data/capability-workbench.json` |
| `environment-workbench.json` | 信息化环境安全能力映射 P1 工作台 | `frontend/capability-browser/public/data/environment-workbench.json` |
| `lifecycle-workbench.json` | LC-AP 受控专项关系投影 | `frontend/capability-browser/public/data/lifecycle-workbench.json` |

参考规格：

- `docs/04-user-guide/capability-workbench-json-spec-v1.md`
- `docs/04-user-guide/environment-workbench-json-spec-v1.md`
- `docs/04-user-guide/lifecycle-workbench-json-spec-v1.md`

## 总体结论

三份 workbench JSON 均已具备统一顶层结构：

```text
meta
page
navigator
overview
relationshipGroups
objects
relations
evidenceRefs
compatibility
```

本轮未发现以下阻断问题：

- JSON 无法解析；
- 顶层结构缺失；
- 关系端点缺失；
- 关系端点类型不一致；
- 完全孤立对象；
- 语义重复关系；
- 主展示结构泄露 `sheet`、`row`、`column`、`raw_value`、`source_file`、`import_id`、`source_id`、`source_ref`、`source_label`、`debug`、`raw`、`metadata`、`intermediate` 等非业务字段。

需要进入问题清单或后续治理的主要缺口：

1. `capability-workbench.json` 预留了标准 / 框架映射，但 `standard_framework`、`standard_control` 和 `maps_to_standard` 仍为空。
2. `capability-workbench.json` 规格中的 `implements_service` 目标语义关系尚未落地，当前使用 `supports_focus` + `applies_to_scope` + `implemented_by_module` 组合表达。
3. `lifecycle-workbench.json` 未承载 `security_technical_measure` 对象和措施关系，LC-AP 已确认的措施仍主要留在旧 `lifecycle-knowledge.json`。
4. `lifecycle-workbench.json` 中存在 1 条明显拆词问题：`CI/CD流水线` 被拆为 `code=CI`、`name=/CD流水线`。
5. 三份数据包仍有部分对象 `status` 为空，部分派生关系无 `evidenceRefs`，需要后续契约化说明哪些是合法派生关系、哪些需要补来源。

## capability-workbench.json

### 结构与规模

| 项 | 结果 |
|---|---:|
| 对象总数 | 699 |
| 关系总数 | 2171 |
| 来源引用数 | 3884 |
| 缺失关系端点 | 0 |
| 关系端点类型不一致 | 0 |
| 孤立对象 | 0 |
| 主展示非业务字段泄露 | 0 |

### 对象计数

| 对象类型 | 数量 | 备注 |
|---|---:|---|
| `capability_category` | 3 | 正常 |
| `capability_domain` | 10 | 正常 |
| `capability` | 32 | 正常 |
| `capability_focus` | 91 | 正常 |
| `scope_type` | 8 | 正常 |
| `security_technical_service` | 157 | 正常 |
| `security_technology_module` | 103 | 正常 |
| `security_technical_measure` | 28 | 正常 |
| `security_work` | 80 | 正常 |
| `work_function` | 75 | 规格外但符合管理视角四层职能展示需要 |
| `process_group` | 32 | 正常 |
| `process_reference` | 80 | 正常 |
| `process_activity` | 0 | L4 活动仍未补齐，符合既有业务接受状态 |
| `standard_framework` | 0 | 缺口 |
| `standard_control` | 0 | 缺口 |

### 关系计数

| 关系类型 | 数量 | 备注 |
|---|---:|---|
| `belongs_to` | 220 | 能力层级关系 |
| `supports_focus` | 157 | 服务支撑关注点 |
| `applies_to_scope` | 536 | 作用域映射 |
| `implemented_by_module` | 345 | 服务 / 模块关系 |
| `has_measure` | 32 | 服务 / 措施关系 |
| `maps_to_work` | 80 | 管理工作映射 |
| `maps_to_process` | 92 | 流程映射 |
| `stakeholder_by` | 709 | 规格外但用于安全职能四层展示 |
| `implements_service` | 0 | 目标语义关系未落地 |
| `maps_to_standard` | 0 | 标准 / 框架映射未落地 |

### 主要缺口

| 缺口 | 影响 | 建议 |
|---|---|---|
| 标准 / 框架对象和关系为空 | 安全能力映射页无法直接展示与标准 / 框架的映射关系 | 新增 `OI-049`，后续由标准导入结果生成 `standard_framework`、`standard_control`、`maps_to_standard` |
| `implements_service` 未生成 | 与规格中的目标语义关系名不一致，后续 API / 前端设计理解成本高 | 下一轮 export 治理时决定是补 `implements_service`，还是修订规格采用当前 `supports_focus` 语义 |
| `process_activity=0` | 管理视角无法展示 L4 关键活动 | 继续沿用 `OI-009` 业务接受状态，待源数据补齐 |
| 部分 `status` 为空 | 前端后续如按状态筛选会出现不稳定行为 | 统一在 export 层将缺省业务对象状态设为 `active` 或明确空状态合法 |

## environment-workbench.json

### 结构与规模

| 项 | 结果 |
|---|---:|
| 对象总数 | 449 |
| 关系总数 | 2413 |
| 来源引用数 | 4233 |
| 缺失关系端点 | 0 |
| 关系端点类型不一致 | 0 |
| 孤立对象 | 0 |
| 主展示非业务字段泄露 | 0 |

### 对象计数

| 对象类型 | 数量 | 备注 |
|---|---:|---|
| `information_environment` | 10 | 正常 |
| `environment_segment` | 29 | 正常，已作为“环境子类”正式层级 |
| `information_object` | 49 | 正常 |
| `scope_type` | 6 | 正常 |
| `security_technical_service` | 92 | 正常 |
| `security_technology_module` | 98 | 正常 |
| `security_technical_measure` | 29 | 正常 |
| `security_system` | 28 | 正常 |
| `product` | 62 | 正常 |
| `capability` | 13 | 正常 |
| `capability_focus` | 33 | 正常 |

### 关系计数

| 关系类型 | 数量 | 备注 |
|---|---:|---|
| `contains_segment` | 29 | 环境包含分段 |
| `contains_object` | 66 | 分段包含对象 |
| `applies_to_scope` | 322 | 对象 / 服务适用作用域 |
| `protects_object` | 546 | 服务保护对象 |
| `deployed_in_environment` | 412 | 模块部署环境 |
| `implements_service` | 312 | 作用域实现服务 |
| `implemented_by_module` | 312 | 服务由模块实现 |
| `has_measure` | 35 | 服务关联措施 |
| `part_of_system` | 109 | 模块归属系统 |
| `maps_to_product` | 86 | 模块映射产品 |
| `supports_capability` | 92 | 派生能力关联 |
| `supports_focus` | 92 | 派生关注点关联 |

### 主要缺口

| 缺口 | 影响 | 建议 |
|---|---|---|
| 对象 `status` 大量为空 | 后续状态筛选、变更审查和质量标识不稳定 | 在 export 层统一填充缺省 `active`，或在契约中声明空状态含义 |
| `supports_capability` / `supports_focus` 为派生关系且无 `evidenceRefs` | 前端可以展示，但用户追溯时只能回到服务编码推导逻辑 | 后续把派生说明写入 `compatibility.warnings` 或生成关系级 `derivationNote` |
| 来源证据仍是 `available_in_legacy_source_package` 引用 | 已满足不泄露主展示字段，但还不是独立 `source-evidence.json` | 按前端数据契约 P1 项继续拆分 `source-evidence.json` |

## lifecycle-workbench.json

### 结构与规模

| 项 | 结果 |
|---|---:|
| 对象总数 | 239 |
| 关系总数 | 353 |
| 来源引用数 | 755 |
| 缺失关系端点 | 0 |
| 关系端点类型不一致 | 0 |
| 孤立对象 | 0 |
| 主展示非业务字段泄露 | 0 |

### 对象计数

| 对象类型 | 数量 | 备注 |
|---|---:|---|
| `lifecycle_domain` | 1 | LC-AP |
| `lifecycle_stage` | 8 | 正常 |
| `lifecycle_activity` | 43 | 正常 |
| `lifecycle_control` | 6 | 正常 |
| `lifecycle_requirement` | 76 | 正常 |
| `capability` | 7 | 正常 |
| `capability_focus` | 16 | 正常 |
| `security_technical_service` | 41 | 存在 1 条拆词异常 |
| `security_technology_module` | 41 | 正常 |
| `security_technical_measure` | 0 | 缺口 |

### 关系计数

| 关系类型 | 数量 | 备注 |
|---|---:|---|
| `belongs_to` | 84 | 阶段 / 要求归属 |
| `contains_activity` | 43 | 阶段包含活动 |
| `contains_control` | 6 | 阶段包含控制点 |
| `maps_to_capability` | 26 | 派生能力映射 |
| `maps_to_focus` | 38 | 派生关注点映射 |
| `maps_to_service` | 91 | 生命周期映射服务 |
| `implemented_by_module` | 65 | 服务 / 模块关系 |

### 主要缺口

| 缺口 | 影响 | 建议 |
|---|---|---|
| `security_technical_measure` 未进入 workbench | LC-AP 已确认的措施不能被新 workbench 直接消费，前端仍可能回读旧 `lifecycle-knowledge.json` | 更新 `OI-040`，下一轮 export 将 LC-AP 措施投影进 `lifecycle-workbench.json`，并明确阶段级 / 服务级关系粒度 |
| `CI/CD流水线` 被拆成 `code=CI`、`name=/CD流水线` | 页面会展示错误标题，且后续按编码匹配会误判 | 新增 `OI-050`，修正服务编码解析规则，避免把业务名称中的 `/` 当成编码分隔 |
| 37 个 `security_technology_module.status` 为空 | 后续状态筛选不稳定 | 与环境页同口径，在 export 层统一状态默认值 |
| `maps_to_capability` / `maps_to_focus` 为派生关系且无 `evidenceRefs` | 可用于导航，但不应被误认为源表显式映射 | 保持 `confidence=derived`，后续增加派生说明或独立校验输出 |

## 字段边界检查

本轮递归扫描以下主展示结构：

- `page`
- `navigator`
- `overview`
- `relationshipGroups`
- `objects`
- `relations`

未发现以下非业务字段进入主展示结构：

```text
sheet
row
column
raw_value
source_file
import_id
source_id
source_ref
source_label
debug
raw
metadata
intermediate
generated_at
```

说明：

- `meta.generated_at` 属于数据包元信息，不属于主展示结构。
- `evidenceRefs` 当前只保留 `id`、`kind`、`status`，未携带原始 `sheet` / `row` / `raw_value`。
- 后续 `source-evidence.json` 拆分后，应继续保持主展示数据只引用 `evidenceRefs`。

## 新增 / 更新问题

| 问题编号 | 标题 | 状态 |
|---|---|---|
| `OI-040` | LC-AP 安全技术措施暂未细化到具体安全技术服务 | 已追加 BE-4 发现 |
| `OI-049` | `capability-workbench.json` 标准 / 框架映射仍为空 | 待处理 |
| `OI-050` | LC-AP `CI/CD流水线` 被拆成 `CI` 与 `/CD流水线` | 已修复 |

## 后续建议

1. `CI/CD流水线` 解析问题已在 BE-4.2 修复，旧错误对象已停用。
2. 下一步建议补齐 LC-AP 措施进入 `lifecycle-workbench.json` 的投影，不强行细化到服务时，应显式标注为阶段级措施。
3. 再将标准 / 框架导入结果映射到 `capability-workbench.json` 的 `standard_framework`、`standard_control`、`maps_to_standard`。
4. 后续统一处理 workbench 对象缺省 `status` 和派生关系来源说明。

## 本轮不做事项

- 不修改前端页面；
- 不修改样式；
- 不修改 dataClient / ViewModel；
- 不修改 ETL / export；
- 不修改 SQLite schema；
- 不重新导入数据；
- 不启动 npm；
- 不启动浏览器；
- 不进入 maturity；
- 不进入 Phase 7。
