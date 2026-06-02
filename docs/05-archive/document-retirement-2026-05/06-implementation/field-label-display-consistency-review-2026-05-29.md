# 全局字段命名与显示样式一致性 Review（2026-05-29）

## 结论

本次检查确认：当前主要问题不是 JSON 中同一业务值发生明显错配，而是同一类业务对象在不同页面、不同 ViewModel、不同组件中使用了不同表头、不同空态文案和不同 chip / status 样式。

根因是展示层缺少统一的字段标签字典和显示组件约定。现在大量中文表头、摘要标签、空态文案和 chip 类型直接散落在 `viewModels.js`、各页面组件和 `styles.css` 中，导致同一对象在不同上下文里被叫成不同名字。

## 检查范围

- 前端展示层：`frontend/capability-browser/app.js`
- ViewModel：`frontend/capability-browser/viewModels.js`
- 前端组件：`frontend/capability-browser/components/*.js`
- 样式：`frontend/capability-browser/styles.css`
- 数据包摘要：`capability`、`maintenance`、`standards`、`lifecycle`、`content`、`shared-lookups`、`capability-workbench`、`environment-workbench`、`lifecycle-workbench`

## 自动扫描摘要

- 展示层中文标签扫描：约 463 处中文标签 / 表头 / 空态文案，约 233 个唯一标签。
- 数据包状态：本次抽查的 9 类数据包均为 `ready` 或摘要检查通过。
- 典型重复对象：同一安全技术服务，例如 `I-NT&T-AS.AD-01 / 网络平面及区域划分`，同时出现在 `capability-workbench.json`、`environment-workbench.json`、`maintenance-knowledge.json`、`shared-lookups.json`，业务值一致，但页面表头和 chip 展示并不完全一致。

## 主要发现

| 编号 | 严重度 | 问题 | 典型位置 | 建议 |
|---|---|---|---|---|
| GFL-001 | P1 | `security_technical_service` 同类值存在 `安全技术服务`、`技术服务`、`服务`、`关联技术服务`、`映射安全技术服务` 等叫法。 | `viewModels.js`、`EnvironmentRelationshipOverview.js`、`TechnologyModuleMaintenanceTable.js`、`TechnicalMeasureMaintenanceTable.js` | 建立标准标签：实体列统一 `安全技术服务`；关系列统一 `关联安全技术服务`；摘要短标签如确需压缩，必须在字典中登记。 |
| GFL-002 | P1 | `scope_type` 在不同页面显示为 `作用域`、`安全作用域`、`适用作用域`、`关联作用域`，同一对象边界不清。 | `FocusScopeServiceMatrix.js`、`EnvironmentScopeServiceMatrix.js`、`TechnicalMeasureMaintenanceTable.js` | 建议统一为：目录页 `安全能力作用域`，矩阵列 `作用域`，关系列 `关联作用域`；避免新增未登记变体。 |
| GFL-003 | P1 | `security_technology_module` 与 `security_technical_measure` 有时合并为 `安全技术模块/措施`，有时拆成 `安全技术模块` / `安全技术措施`，空态还出现 `暂无模块`，容易遗漏“措施”。 | `FocusScopeServiceMatrix.js`、`EnvironmentScopeServiceMatrix.js`、`ApplicationSecurityLifecycle.js`、`TechnicalServiceMaintenanceTable.js` | 合并列统一 `安全技术模块/措施`；关系列统一 `关联安全技术模块/措施`；空态统一 `暂无安全技术模块/措施`。 |
| GFL-004 | P2 | 安全策略类字段存在 `策略要求`、`安全策略`、`安全活动对应安全策略`、`补充安全策略` 等变体。 | `ApplicationSecurityLifecycle.js`、`viewModels.js` | 建议围绕对象类型 `security_policy_requirement` 统一为 `安全策略要求`，上下文列使用 `安全活动对应策略要求`、`补充策略要求`。 |
| GFL-005 | P2 | L4 流程字段存在 `L4活动`、`L4 关键活动`、`L4 关键活动状态`、`L4 状态`、`L4 待补`，空格和语义均不统一。 | `CapabilityLocalRelationMap.js`、`FocusManagementMapping.js`、`ProcessMaintenanceTable.js`、`DetailInspector.js` | 建议统一实体名 `L4 活动`，状态字段 `L4 活动状态`，空态 `L4 活动待补充`。 |
| GFL-006 | P1 | 空态 / 异常态展示没有统一语义：`待补充`、`暂无`、`不适用`、`无适用服务`、`待确认`、`映射异常`、`待契约补充` 使用场景交叉。 | 多个组件的 `empty-inline`、`missing-pill`、`preview-chip.is-empty`、`module-mapping-status` | 建议建立 `displayState` 字典：`missing`、`empty`、`not_applicable`、`pending_review`、`mapping_exception`，统一文案和样式。 |
| GFL-007 | P1 | 同一类“关联对象”在不同区域使用 `relation-chip`、`preview-chip`、`standard-tooltip-chip`、`status-badge`、`module-mapping-status`，视觉重量不一致。 | `styles.css`、`CapabilityLocalRelationMap.js`、`StandardFrameworkTable.js`、`TechnicalServiceMaintenanceTable.js` | 建议沉淀统一展示组件或 helper：`renderRelationChip()`、`renderStatusPill()`、`renderCodeTooltipChip()`。 |
| GFL-008 | P2 | Workbench JSON 与 knowledge JSON 中同一对象字段形态不完全一致：workbench 常见 `name/title/status/evidenceRefs`，maintenance / shared lookups 常见 `title/sources`。 | `capability-workbench.json`、`maintenance-knowledge.json`、`shared-lookups.json` | 数据值本身可接受，但需要前端显示契约：页面只消费 ViewModel 的统一字段，不直接根据原 JSON 字段名决定表头。 |

## 建议的统一规则

1. 新增前端显示字典，例如 `frontend/capability-browser/displayLabels.js` 或 `viewModels.js` 内部 `DISPLAY_LABELS`，集中维护对象类型、关系类型、状态和空态文案。
2. 表头命名采用三层规则：
   - 实体列：对象名，例如 `安全技术服务`。
   - 关系列：`关联 + 对象名`，例如 `关联安全技术服务`。
   - 页面标题 / 目录：使用业务场景全称，例如 `安全技术服务清单`。
3. 同一对象的 chip 样式不再由页面各自决定，改为统一 helper 输出。
4. 允许少量上下文差异，但必须进入字典登记；未登记的中文表头和空态文案应视为 review warning。
5. 后续整改应先做字典和 helper，再逐页替换，不建议继续在单个组件里局部改文案。

## 后续整改优先级

1. P0：先定 `DISPLAY_LABELS` 和 `DISPLAY_STATES`，明确标准对象名、关系列名、空态/状态文案。
2. P1：替换安全技术服务、作用域、安全技术模块/措施三类高频字段。
3. P2：替换 L4 活动、安全策略要求、流程字段等中频字段。
4. P3：增加一个轻量检查脚本，扫描前端新增中文表头是否来自字典，防止后续继续分叉。

## 本轮边界

本轮只做全局检查和报告输出，未修改前端运行逻辑、数据包、数据库、ETL 或样式实现。

## 第一轮整改结果

2026-05-29 已按本报告的 8 项问题完成第一轮展示层收口：

- 新增 `frontend/capability-browser/displayLabels.js`，集中维护对象标签、关系列名、状态 / 空态文案和 relation chip helper。
- 已替换高频页面中的 `安全技术服务`、`作用域`、`安全技术模块/措施`、`安全策略要求`、`L4 活动` 相关表头和摘要标签。
- 已将 `暂无模块` 等容易误导的空态统一为 `暂无安全技术模块/措施`。
- 已将 `关联服务`、`适用作用域`、`技术服务`、`技术模块` 等短标签在主要维护表、映射表和详情摘要中改为统一业务口径。
- 已把安全技术模块、措施、系统、环境、关注点等关联 chip 输出收敛到统一 helper，保留必要的类型前缀，但不再由各组件各自决定基础样式。
- 已通过固定 `5173` 轻量 smoke 覆盖 `/knowledge/technical-services`、`/capability-mapping`、`/environment-mapping`、`/development-security`，均返回 200；按项目规则未启动系统 Google Chrome。

仍允许搜索框占位、导航维度短词和说明性长句使用压缩表达；这些不是表头或主字段名，不作为本轮阻断项。
