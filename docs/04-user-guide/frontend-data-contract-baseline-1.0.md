# Frontend Data Contract Baseline 1.0

本文档用于治理 Frontend Baseline 1.0 的前端数据出口、离线 JSON 文件职责、`dataClient` / ViewModel 边界，以及后续页面实现前的数据契约顺序。

本轮只做方案设计，不修改前端代码、不修改现有 JSON、不修改 ETL、不修改数据库 schema、不重新导入数据。

## 1. 背景与问题

当前前端同事反馈的核心问题是：`capability-tree.json` 和 `lifecycle-knowledge.json` 这类文件已经不再是单一语义的数据包，前端读取时需要理解多个 Excel Sheet、多个知识对象类型和多个页面视角，导致页面逻辑越来越重。

只说“一个 JSON 混了多张表”还不够准确。多张表进入同一个页面 JSON 不一定错；错误的是缺少稳定页面数据契约。页面 JSON 应围绕页面视角组织，而不是围绕 Excel Sheet 组织。

当前实际观察：

| 文件 | 当前顶层结构 | 当前问题 |
|---|---|---|
| `capability-tree.json` | `generated_at`、`stats`、`categories`、`unlinked_focuses` | 文件名是能力树，但每个关注点下已经包含 `services`、`scope_mappings`、`security_works`、`process_mappings`、`sources`、`metadata` 等工作台数据 |
| `management-knowledge.json` | `work_function_layers`、`security_processes`、`gbt_42446_references`、`gartner_roles`、`scope_types`、`security_technology_modules`、`security_technical_measures`、`service_module_index`、`environment_scope_tree` | 实际承担管理知识、技术字典、环境工作台、共享索引和知识目录多重职责 |
| `lifecycle-knowledge.json` | `application_security_development`、`data_lifecycle`、`service_module_index` | 同时承载 LC-AP、LC-DT 和技术服务模块索引，不适合直接作为开发安全专题页面的稳定工作台契约 |
| `content-views.json` | `html_documents`、`diagram_views`、`guide_pages` | 当前职责相对清晰，可暂不纳入本轮拆分重点 |

## 2. 与 `frontend-menu-and-page-type-definition-v1.md` 的关系

`docs/00-overview/frontend-menu-and-page-type-definition-v1.md` 已将全站页面类型固化为导航和设计输入。数据契约应跟随页面类型，而不是跟随历史导出文件名或 Excel Sheet。

关键对应关系：

| 菜单 / 页面 | 页面类型 | 数据契约方向 |
|---|---|---|
| 安全能力映射 | `capability-mapping-workbench` | 需要 `capability-tree.json` + `capability-workbench.json` |
| 信息化环境安全能力映射 | `environment-mapping-workbench` | 需要独立 `environment-workbench.json` |
| 开发安全 | `domain-module` | LC-AP 只能作为受控专项关系投影，不应扩成完整开发安全模块 |
| SAPD 成熟度评估 | `domain-module` | 需要独立 maturity 评估数据契约；不并入三份 workbench JSON |
| 安全知识 | `knowledge-directory` | 职能、流程、岗位、模块、措施等应进入知识目录或专项知识维护数据包 |
| 安全标准 / 框架 | `standard-framework-directory` / `standard-framework-page` | 后续应独立标准框架数据包，不应塞入能力树或生命周期包 |

## 3. Frontend Baseline 1.0 口径修正

建议将 Frontend Baseline 1.0 从“三个同级关系工作台”修正为：

```text
P1 双核心工作台 + LC-AP 受控专项关系投影
```

其中：

1. `安全能力映射页` 是 P1 核心工作台 1，主语是安全能力 / 关注点。
2. `信息化环境安全能力映射页` 是 P1 核心工作台 2，主语是信息化对象 / 信息化环境。
3. `LC-AP 开发安全生命周期页` 是开发安全 `domain-module` 下的受控专项关系投影页，不等同于 P1 核心工作台，不直接扩成完整开发安全模块。
4. `SAPD 成熟度评估` 是独立业务模块，承载评分填报、结果生成和评估报告，不并入三份 workbench JSON，不写入主知识库关系数据。

这样调整后，数据出口优先服务两个 P1 工作台；LC-AP 保持边界清晰，避免把开发安全参考库、生命周期全量知识和专项维护数据塞进一个页面 JSON。
成熟度评估另走 maturity 专用数据域，后续由独立实现会话定义导出、API 和前端交互。

## 4. 页面结构驱动的数据治理原则

最终原则：

```text
页面结构驱动数据契约；
数据契约驱动 ViewModel / dataClient；
ViewModel / dataClient 驱动前端组件；
前端组件不直接适配混乱 JSON；
不以 Excel Sheet 直接驱动页面；
不以数据库 schema 直接驱动页面。
```

治理原则：

| 原则 | 说明 |
|---|---|
| 页面主语优先 | 能力页按关注点组织，环境页按对象组织，LC-AP 按阶段 / 活动组织 |
| 树与工作台分离 | 导航树只提供目录和选择上下文，工作台 JSON 承载关系数据 |
| 主展示与来源证据分离 | 页面主结构使用白名单业务字段，来源证据通过 `evidenceRefs` 引用 |
| 字典与页面数据分离 | 对象类型、关系类型、状态、字段展示名进入 `shared-lookups.json` |
| API 与静态包同构 | `/api/v1/*` 与 `public/data/*.json` 应尽量使用同一页面契约 |

## 5. P1 双核心工作台数据契约

### 5.1 安全能力映射页

页面类型：`capability-mapping-workbench`

路由：`/capability-mapping`

主语：安全能力 / 关注点。

建议数据文件：

```text
capability-tree.json
capability-workbench.json
```

`capability-tree.json` 只负责左侧能力目录：

```json
{
  "generated_at": "string",
  "treeVersion": "1.0",
  "categories": []
}
```

`capability-workbench.json` 负责当前关注点工作台关系：

```json
{
  "generated_at": "string",
  "viewModelVersion": "1.0",
  "focuses": [],
  "workspacesByFocusId": {},
  "workspacesByFocusCode": {}
}
```

单个关注点工作台建议结构：

```json
{
  "focus": {},
  "overview": {},
  "technical": {
    "scopeServicePairs": [],
    "serviceModuleMeasureLinks": [],
    "standardMappings": []
  },
  "management": {
    "securityWorks": [],
    "workFunctionsByLayer": {},
    "processTree": []
  },
  "tables": {
    "technicalRows": [],
    "managementRows": []
  },
  "evidenceRefs": []
}
```

当前 `/api/v1/capabilities/workspace-projection` 已经接近该方向，后续静态 `capability-workbench.json` 应与该 API 投影保持同构，而不是让前端继续从 `capability-tree.json` 和 `management-knowledge.json` 拼关系。

### 5.2 信息化环境安全能力映射页

页面类型：`environment-mapping-workbench`

路由：`/environment-mapping`

主语：信息化对象 / 信息化环境。

建议新增：

```text
environment-workbench.json
```

建议对象：

```text
information_environment
environment_segment
information_object
scope_type
security_technical_service
security_technology_module
security_technical_measure
security_system
product
```

建议关系：

```text
protects_object
deployed_in_environment
applies_to_scope
implements_service
part_of_system
maps_to_product
```

当前环境数据主要藏在 `management-knowledge.json` 的 `environment_scope_tree` 中。该结构可以作为迁移输入，但不应继续留在管理知识包里承担 P1 环境工作台职责。

## 6. LC-AP 受控专项关系投影数据契约

LC-AP 应定位为开发安全 `domain-module` 下的受控专项关系投影页，而不是 P1 核心工作台。

建议新增或替代：

```text
lifecycle-workbench.json
```

职责只包括：

- LC-AP 生命周期阶段；
- 主要活动；
- 安全活动；
- 策略要求 / 控制点；
- 与安全技术服务、模块、措施的受控映射；
- 与开发类产品组件的弱参考；
- 来源证据引用。

不应包括：

- 完整开发安全模块数据；
- LC-AP 参考库维护数据；
- 数据生命周期 LC-DT 全量知识；
- 专项知识维护数据；
- 全站共享 `service_module_index`。

如需兼容当前文件，可短期保留 `lifecycle-knowledge.json`，但新增 `lifecycle-workbench.json` 作为稳定契约；等 `dataClient` 和页面消费完成迁移后，再决定是否废弃旧文件。

## 6A. SAPD 成熟度评估独立数据契约口径

`SAPD 成熟度评估` 是全站一级菜单中的独立业务模块，页面类型暂归入 `domain-module`，路由建议为：

```text
/sapd-maturity-assessment
```

该模块目标：

- 支撑成熟度评分填报；
- 基于已确认的 maturity 模型、模板和字段映射生成评估结果；
- 输出能力 / 关注点 / 维度级成熟度结果；
- 支撑差距摘要、改进建议和报告导出；
- 与安全能力映射、环境映射、LC-AP 关系投影保持边界隔离。

后续建议独立定义 maturity 数据契约，不并入：

- `capability-workbench.json`
- `environment-workbench.json`
- `lifecycle-workbench.json`
- `management-knowledge.json`
- `lifecycle-knowledge.json`

建议后续单独规划的数据文件或 API 方向：

| 数据契约 | 职责 | 状态 |
|---|---|---|
| `maturity-assessment-template.json` | 评估模板、评分维度、评分项、选项、权重和字段映射 | 后续单独设计 |
| `maturity-assessment-session.json` | 单次填报任务、客户输入、证据引用、填报进度 | 后续单独设计；本地运行数据不应提交为公共静态包 |
| `maturity-assessment-result.json` | 评分结果、差距摘要、建议、报告投影 | 后续单独设计 |

边界要求：

- maturity 运行数据使用 `maturity_*` 专用域，不写入 `knowledge_items` 作为普通知识关系。
- 前端组件不自行计算成熟度结论；评分、汇总和结果生成应由后端 / maturity 服务层负责。
- 成熟度评估可以只读引用能力、关注点、服务、措施、标准等主知识对象，但不得反向污染主知识库。
- 本次 Frontend Data Contract Governance Step 4-6 已生成的三份 workbench JSON 不包含 maturity 评估运行数据，这是有意边界，不是遗漏。

## 7. 当前 JSON 混杂问题分析

### 7.1 `capability-tree.json`

当前统计：

| 指标 | 数量 |
|---|---:|
| `categories` | 3 |
| domains | 10 |
| capabilities | 32 |
| focuses | 91 |
| focuses with `security_works` | 79 |
| focuses with `process_mappings` | 91 |

当前问题：

- 树节点下包含完整 `services` 对象，前端会读到服务、作用域、来源和元数据。
- 关注点下包含 `security_works`、`process_mappings`，让树文件承担管理视角工作台职责。
- `sources` 中包含 `sheet`、`row`、`column`、`raw_value`，如果组件误用，容易泄露非业务字段。
- `metadata` 中有 `object_key`、`source_count`、`tree_order`，这些适合 export / ViewModel 内部使用，不适合成为页面主结构。

结论：`capability-tree.json` 必须职责收缩。

### 7.2 `management-knowledge.json`

当前统计：

| 指标 | 数量 |
|---|---:|
| `work_function_layers` | 4 |
| `security_processes` | 10 |
| `gbt_42446_references` | 27 |
| `gartner_roles` | 28 |
| `scope_types` | 10 |
| `security_technology_modules` | 121 |
| `security_technical_measures` | 29 |
| `service_module_index` | 192 |
| `information_environments` | 10 |
| `information_objects` | 66 |
| `environment_scope_mappings` | 96 |
| `environment_service_mappings` | 1256 |
| `environment_module_mappings` | 3962 |

当前问题：

- 文件名是管理知识，但实际包含环境工作台、技术模块、技术措施、服务模块索引。
- `environment_scope_tree` 应服务 `/environment-mapping`，不应藏在管理知识包。
- `service_module_index` 是共享技术索引，不应在多个页面数据包中重复。

结论：`management-knowledge.json` 应逐步收缩为知识目录 / 专项维护数据，不继续承担环境工作台数据出口。

### 7.3 `lifecycle-knowledge.json`

当前统计：

| 指标 | 数量 |
|---|---:|
| `application_processes` | 8 |
| `data_processes` | 8 |
| `lifecycle_activities` | 43 |
| `lifecycle_scenes` | 36 |
| `security_activities` | 6 |
| `policy_requirements` | 76 |
| `software_development_types` | 4 |
| `application_system_types` | 3 |
| `application_components` | 13 |
| `development_product_components` | 14 |
| `security_technical_measures` | 3 |
| `service_module_index` | 192 |

当前问题：

- `application_security_development` 与 `data_lifecycle` 放在同一包，页面主语不同。
- `service_module_index` 与管理包重复，不应作为生命周期包内部事实。
- LC-AP 页面不需要承载完整开发安全模块，也不应把参考库维护数据塞回同页参考区。

结论：`lifecycle-knowledge.json` 应重构或被 `lifecycle-workbench.json` 替代。

## 8. 推荐前端数据文件结构

建议目标结构：

```text
frontend/capability-browser/public/data/
├── app-manifest.json
├── capability-tree.json
├── capability-workbench.json
├── environment-workbench.json
├── lifecycle-workbench.json
├── maturity-assessment-template.json
├── maturity-assessment-result.json
├── shared-lookups.json
└── source-evidence.json
```

文件职责：

| 文件 | 职责 | 主要服务页面 |
|---|---|---|
| `app-manifest.json` | 声明数据版本、生成时间、页面入口、数据文件清单和兼容信息 | 全局 |
| `capability-tree.json` | 只保留能力分类、L1、L2、关注点、树顺序 | 安全能力映射 |
| `capability-workbench.json` | 安全能力映射页关系数据 | `/capability-mapping` |
| `environment-workbench.json` | 信息化环境安全能力映射页关系数据 | `/environment-mapping` |
| `lifecycle-workbench.json` | LC-AP 受控专项关系投影 | 开发安全下 LC-AP 页 |
| `maturity-assessment-template.json` | SAPD 成熟度评估模板、评分项和字段映射 | `/sapd-maturity-assessment` |
| `maturity-assessment-result.json` | SAPD 成熟度评估结果投影、差距摘要和报告数据 | `/sapd-maturity-assessment` |
| `shared-lookups.json` | 展示名、枚举、对象类型、关系类型、状态标签 | 全局 |
| `source-evidence.json` | 来源证据索引 | 全局 |

### 8.1 最终前端数据文件清单冻结

本阶段冻结的最终目标清单为：

| 文件 | 优先级 | 当前处理 | 说明 |
|---|---|---|---|
| `capability-tree.json` | P0 | 必须生成 | 能力目录树；只保留分类、L1、L2、关注点和树顺序 |
| `capability-workbench.json` | P0 | 必须生成 | `/capability-mapping` 关系工作台数据 |
| `environment-workbench.json` | P0 | 必须生成 | `/environment-mapping` 关系工作台数据 |
| `lifecycle-workbench.json` | P0 | 必须生成 | LC-AP 受控专项关系投影 |
| `app-manifest.json` | P1 | 可以 P1 生成 | 数据版本、页面入口、文件清单和兼容信息 |
| `shared-lookups.json` | P1 | 可以 P1 生成 | 对象类型、关系类型、字段名、状态和共享索引 |
| `source-evidence.json` | P1 | 可以 P1 生成 | 来源证据索引，页面工作台只保留 `evidenceRefs` |
| `maturity-assessment-template.json` | P2 | 后续单独设计 | 成熟度评估模板、评分项、权重和字段映射，不属于三份 workbench P0 |
| `maturity-assessment-result.json` | P2 | 后续单独设计 | 成熟度评估结果投影；客户填报运行数据不应作为公共静态包默认提交 |
| `management-knowledge.json` | 过渡兼容 | 暂保留 | 专项知识维护和旧环境数据 fallback；不作为环境页长期主数据源 |
| `lifecycle-knowledge.json` | 过渡兼容 | 暂保留 | 旧 LC-AP / LC-DT 数据 fallback；不作为新 LC-AP workbench 长期主数据源 |

说明：

- P0 文件是后续进入 export / dataClient 代码阶段时优先落地的数据出口。
- P1 文件用于增强全局版本治理、共享字典和来源证据治理，可在 P0 文件稳定后推进。
- maturity 文件属于独立业务模块的 P2 契约，后续在单独实现会话中设计和生成。
- 旧文件不立即删除，避免破坏当前页面；但新页面和新 ViewModel 不应长期直接消费旧混合结构。

## 9. `capability-tree.json` 职责收缩方案

应保留：

- `capability_category`
- `capability_domain`
- `capability`
- `capability_focus`
- `code`
- `title`
- `description`
- `status`
- `tree_order`
- 必要的统计信息

应迁出：

- `services`
- `scope_mappings`
- `security_works`
- `process_mappings`
- `sources` 全量
- `metadata` 中非展示字段
- 标准 / 框架映射详情
- 环境对象关系
- 生命周期数据

迁入目标：

| 当前内容 | 目标文件 |
|---|---|
| 关注点技术关系 | `capability-workbench.json` |
| 关注点管理关系 | `capability-workbench.json` |
| 来源证据 | `source-evidence.json` |
| 展示名 / 枚举 | `shared-lookups.json` |

## 10. `capability-workbench.json` 新增方案

该文件应成为安全能力映射页的离线稳定数据包，与 `/api/v1/capabilities/workspace-projection` 对齐。

建议包括：

- `focuses`：关注点索引；
- `workspacesByFocusId` / `workspacesByFocusCode`：每个关注点的页面级投影；
- `technical.scopeServicePairs`：保留作用域到服务 pair；
- `technical.serviceModuleMeasureLinks`：按服务组织模块与措施；
- `management.securityWorks`：安全工作；
- `management.workFunctionsByLayer`：决策层、管理层、执行层、监督层、unknown；
- `management.processTree`：L2 / L3 / L4；
- `tables.technicalRows` / `tables.managementRows`：明细核对表；
- `evidenceRefs`：来源引用 ID。

不应包括：

- 原始 Sheet 行列；
- `raw_value`；
- 未白名单字段；
- 全量职能目录；
- 全量流程目录；
- 全量技术模块目录。

## 11. `environment-workbench.json` 新增方案

该文件应成为 `/environment-mapping` 的 P1 核心数据出口。

建议结构：

```json
{
  "generated_at": "string",
  "viewModelVersion": "1.0",
  "navigator": [],
  "objectsById": {},
  "workspacesByObjectId": {},
  "relationshipGroups": [],
  "evidenceRefs": []
}
```

单个对象工作台建议包括：

- 当前信息化对象 / 环境概览；
- 所属环境和环境子类；
- 关联作用域；
- 作用域到安全技术服务；
- 服务到模块 / 措施；
- 模块到安全系统 / 产品；
- 能力和关注点反向关联；
- 来源证据引用。

`management-knowledge.json.environment_scope_tree` 可作为第一版迁移输入，但需要在 export 层转为页面契约，不建议前端继续直接理解该树内部来源和多层聚合。

## 12. `lifecycle-knowledge.json` 重构 / 改名方案

建议策略：

1. 短期保留 `lifecycle-knowledge.json`，避免破坏当前页面。
2. 新增 `lifecycle-workbench.json` 作为稳定契约。
3. `lifecycle-workbench.json` 只服务 LC-AP 受控专项关系投影。
4. 将 `data_lifecycle` 后续归入数据安全专题或单独 `data-lifecycle-workbench.json`，不要继续与 LC-AP 共包。
5. 将 `service_module_index` 迁入 `shared-lookups.json` 或由页面工作台按引用消费。
6. 将 LC-AP 参考数据维护入口放入专项知识维护，不放回 LC-AP 页面参考区。

## 13. `shared-lookups.json` 与 `source-evidence.json` 拆分建议

### 13.1 `shared-lookups.json`

适合放入：

- `objectTypeLabels`
- `relationTypeLabels`
- `fieldLabels`
- `priorityLabels`
- `statusLabels`
- `pageTypeLabels`
- 简短颜色 / badge 语义 token

不适合放入：

- 页面主数据；
- 完整对象详情；
- 完整来源证据；
- 大型关系链。

### 13.2 `source-evidence.json`

建议统一来源证据索引：

```json
{
  "generated_at": "string",
  "evidenceById": {},
  "evidenceRefsByObjectId": {},
  "evidenceRefsByRelationId": {}
}
```

页面工作台只保存：

```json
{
  "evidenceRefs": ["ev_001", "ev_002"]
}
```

这样能减少重复来源信息，也能防止 `sheet`、`row`、`column`、`raw_value` 进入主展示结构。

## 14. ViewModel / dataClient / export 层责任边界

| 层 | 应负责 | 不应负责 |
|---|---|---|
| export | 多表聚合、字段清洗、对象/关系标准化、页面数据包生成、`evidenceRefs` 生成 | 页面交互状态、视觉布局 |
| `dataClient` | 读取稳定 JSON 或 API、屏蔽文件名变化、处理加载状态、处理缺失文件和版本兼容 | 业务关系推断、跨表匹配、清洗脏数据 |
| ViewModel | 排序、分组、空状态、展示标签、折叠默认值、轻量派生统计 | 主数据归一、去重、编码纠正、关系生成 |
| 前端组件 | 展示、交互、筛选、折叠、详情抽屉、用户反馈 | 理解 Excel Sheet、解析来源字段、拼业务关系 |

## 15. 数据清洗责任边界

前端不应直接理解 Excel Sheet。前端不应关心：

- 某字段来自哪张 Excel；
- 某关系来自哪几列拼接；
- 某对象为什么在原始表中有多个名称；
- 某来源行是否是说明行或合并单元格继承。

前端不应负责：

- 编码纠正；
- 去重；
- 合并同义对象；
- 过滤说明行；
- 推断关系；
- 标准化对象类型；
- 标准化关系类型；
- 处理历史脏数据。

前端最多负责：

- 空值显示；
- 字段缺省展示；
- 排序；
- 筛选；
- 折叠展开；
- 视觉分组；
- 交互状态。

export / ViewModel 层应负责：

- 把多张表聚合成页面可读数据契约；
- 清洗空值和占位值；
- 标准化字段名；
- 标准化对象类型和关系类型；
- 生成 `relationshipGroups`；
- 生成 `navigator` 数据；
- 生成 `overview` 数据；
- 生成 `evidenceRefs`。

## 16. 不建议现在做的事项

当前不建议：

- 直接重写前端组件来适配现有混乱 JSON；
- 直接删除旧 JSON；
- 直接改 SQLite schema；
- 重新导入 Excel；
- 启动 Phase 7 多格式增强；
- 启动 maturity M1；
- 把 LC-AP 扩成完整开发安全模块；
- 把 LC-AP 参考数据塞回同页参考区；
- 在组件里写临时字段兼容和业务推断逻辑。

## 17. 最小实施步骤

建议按以下顺序实施：

| 步骤 | 动作 | 输出 | 是否改代码 |
|---|---|---|---|
| Step 1 | 确认数据契约 | `frontend-data-contract-baseline-1.0.md` | 否 |
| Step 2 | 现有 JSON 归因分析 | `capability-tree.json` / `lifecycle-knowledge.json` / `management-knowledge.json` 字段迁移清单 | 否 |
| Step 3 | 补齐缺失页面数据出口 | 优先设计 `environment-workbench.json` | 否，先出 spec |
| Step 4 | 拆分或新增稳定 JSON | `capability-workbench.json`、`environment-workbench.json`、`lifecycle-workbench.json`、可选 `shared-lookups.json`、`source-evidence.json` | 是，进入 export 阶段后 |
| Step 5 | 更新 `dataClient` / ViewModel | 稳定接口、fallback、版本兼容、页面消费切换 | 是 |
| Step 6 | 再做组件基线统一 | `AppShell`、`LocalNavigator`、`ObjectOverview`、`RelationshipTable`、`SourceEvidencePanel` | 是 |

实施优先级：

1. 先新增 `capability-workbench.json`，对齐现有能力页 API 投影。
2. 再新增 `environment-workbench.json`，因为环境映射是 P1 双核心工作台之一，当前缺口最大。
3. 再新增或替代 `lifecycle-workbench.json`，收紧 LC-AP 受控专项边界。
4. 根据重复来源量决定是否立即拆 `source-evidence.json`；根据标签 / 枚举重复量决定是否立即拆 `shared-lookups.json`。

## 18. 需要用户确认的问题

| 问题 | 建议判断 |
|---|---|
| 是否确认 Frontend Baseline 1.0 调整为“P1 双核心工作台 + LC-AP 受控专项关系投影”？ | 建议确认 |
| 是否允许后续新增 `capability-workbench.json`？ | 建议确认 |
| 是否允许后续新增 `environment-workbench.json`？ | 建议确认，优先级最高 |
| `lifecycle-knowledge.json` 是改名还是保留旧文件并新增 `lifecycle-workbench.json`？ | 建议先保留旧文件，新增稳定契约 |
| 是否立即拆 `source-evidence.json`？ | 建议视重复和泄露风险决定，可作为第二步 |
| 是否立即拆 `shared-lookups.json`？ | 建议视字段标签和枚举复用情况决定，可作为第二步 |
| 是否暂不改 ETL / schema，只先改 export 数据出口？ | 建议确认 |

## 19. 关键结论

1. 当前有必要进行数据治理。
2. 数据治理必须结合页面结构进行，不能只按 JSON 文件名或 Excel Sheet 修补。
3. 当前三页基线需要优化为“P1 双核心工作台 + LC-AP 受控专项关系投影”。
4. `capability-tree.json` 应职责收缩，只做能力目录树。
5. `lifecycle-knowledge.json` 应重构或由 `lifecycle-workbench.json` 逐步替代。
6. `environment-workbench.json` 必须新增，因为信息化环境安全能力映射是 P1 核心工作台且当前缺少稳定数据出口。
7. 应优先治理数据出口，再做前端组件统一。
8. 当前暂不应改 ETL / schema；先在 export / 页面数据包契约层治理，确认字段后再决定是否需要底层调整。
