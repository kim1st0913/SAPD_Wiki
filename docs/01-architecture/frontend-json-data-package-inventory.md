# 前端 JSON 数据包台账

本文档记录 `frontend/capability-browser/public/data/` 下所有前端 JSON 数据包的用途、页面归属、当前状态和后续处理方式。

维护目的：

- 避免不同页面继续共用职责混杂的大包；
- 明确哪些 JSON 是正式页面契约，哪些只是 legacy fallback；
- 支撑顾问端压缩包发布时决定哪些数据包应随包发布；
- 为后续 API 契约、Tauri 一键初始化和发布 manifest 提供数据清单。

## 1. 当前原则

- 新页面优先使用页面级 workbench 数据包或 `/api/v1/*` 契约。
- `public/data/*.json` 只作为后端生成的离线兼容包或 API 不可用时的 fallback。
- 顾问端发布包不应包含已确认无用的 legacy 大包。
- 含 `sheet`、`row`、`column`、`raw_value` 等来源追踪字段的数据包可以保留在数据层，但员工端主展示区不得直接展示这些字段。
- 大型共享索引不应藏在某个页面包中，应迁入 `shared-lookups.json` 或独立共享包。

## 2. 页面级主数据包

| 数据包 | 当前大小 | 主要用途 | 加载页面 / 入口 | 当前状态 | 后续处理 |
|---|---:|---|---|---|---|
| `capability-workbench.json` | 约 5.2MB | 安全能力映射页页面级关系投影：能力、关注点、作用域、服务、模块、措施、管理工作、流程、标准映射 | `安全能力映射` | 正式主包 | 保留；后续尽量让页面直接消费 workbench，减少 legacy fallback |
| `environment-workbench.json` | 约 3.5MB | 信息化环境维度页面级关系投影：环境、子类、对象、作用域、服务、模块、系统、产品、能力关联 | `信息化环境维度` | 正式主包 | 保留；已取消对 `management-knowledge.json.environment_scope_tree` 的运行时 fallback |
| `lifecycle-workbench.json` | 约 424KB | LC-AP 开发安全生命周期页面级投影：阶段、活动、控制、策略要求、服务、模块、能力关联 | `LC-AP开发安全生命周期` | 正式主包 | 保留；补齐必要服务 / 模块关系后替代 legacy 生命周期包中的页面职责 |
| `maintenance-knowledge.json` | 约 5.4MB | 安全知识维护数据：作用域、流程、职能、技术模块、技术措施、GB/T 42446、Gartner roles | `安全知识` 各维护页 | 正式主包 | 保留；后续可按页面继续拆成索引 + 分包 |
| `content-views.json` | 约 4KB | 内容视图索引：HTML、Draw.io、指南页入口 | `说明与视图`、指南入口 | 正式索引包 | 保留；图片 / 预览资源只记录索引，不把大资源内联进 JSON |

## 3. 轻量索引与专项资源包

| 数据包 | 当前大小 | 主要用途 | 加载页面 / 入口 | 当前状态 | 后续处理 |
|---|---:|---|---|---|---|
| `standards-index.json` | 约 8KB | 标准 / 框架索引，指向拆分后的标准明细包 | `安全标准 / 框架` | 正式索引包 | 保留；标准页默认先加载索引，再按路由加载明细 |
| `shared-lookups.json` | 约 5.5MB | 全站共享索引，当前包含 `service_module_index` | 能力 / 生命周期 workbench 生成、后续运行时投影 | 正式共享包 | 保留；继续把跨页面共享索引从 legacy 包迁入这里 |
| `guides/data-security-design.json` | 约 1KB | 数据安全设计方法指南元数据和幻灯片路径模式 | `/guides/data-security-design` | 正式专项包 | 保留；实际 PNG 资源在 `guides/data-security-design/slides/` |
| `guides/security-architecture-design.json` | 约 1KB | 安全技术架构设计方法指南元数据和幻灯片路径模式 | `/guides/security-architecture-design` | 正式专项包 | 保留；实际 PNG 资源在 `guides/security-architecture-design/slides/` |

## 4. 标准 / 框架拆分包

| 数据包 | 当前大小 | 主要用途 | 当前状态 |
|---|---:|---|---|
| `standards/mlps-level-3.json` | 约 69KB | 等保三级明细表 | 正式分包 |
| `standards/cis-csc-v8.json` | 约 109KB | CIS CSC V8 明细表 | 正式分包 |
| `standards/iso-27001-2022.json` | 约 49KB | ISO 27001:2022 明细表 | 正式分包 |
| `standards/nist-800-53-rev5.json` | 约 496KB | NIST 800-53 Rev.5 明细表 | 正式分包 |
| `standards/nist-csf-2/csf-core.json` | 约 52KB | NIST CSF 2.0 Core 明细表 | 正式分包 |
| `standards/nist-csf-2/csf-tiers.json` | 约 5KB | NIST CSF 2.0 Tiers 明细表 | 正式分包 |
| `standards/dsp-level-2/dsp-scf-controls-2026.json` | 约 1.1MB | DSP / SCF 控制项明细表 | 正式分包 |
| `standards/dsp-level-2/dsp-scf-maturity-2026.json` | 约 6.1MB | DSP / SCF 成熟度明细表 | 正式分包 |
| `standards/crf/crf-safeguards-core-2026.json` | 约 260KB | CRF Safeguards Core 明细表 | 正式分包 |
| `standards/crf/crf-maturity-model-2026.json` | 约 5KB | CRF Maturity Model 明细表 | 正式分包 |

说明：`standards-index.json` 是标准页入口；明细包按路由懒加载。顾问端发布包应包含索引和当前可访问的标准明细包。

## 5. Legacy / 过渡兼容包

| 数据包 | 当前大小 | 当前内容 | 当前用途 | 处理结论 |
|---|---:|---|---|---|
| `management-knowledge.json` | 已退役 | 原安全知识、环境旧树 legacy 包 | 不再作为顾问端发布包、API 数据包或前端 fallback | 停止发布；公开 `public/data` 中应删除 |
| `lifecycle-knowledge.json` | 约 6.7MB | LC-AP、LC-DT；生命周期过程内仍保留必要的服务-模块嵌入信息 | 数据生命周期页仍使用 | 暂保留；后续拆 LC-DT 包 |
| `capability-tree.json` | 约 7.5MB | 能力树和旧能力页关系数据 | 能力树导航仍使用；部分 fallback 仍依赖 | 暂保留；后续可拆成轻量 `capability-index.json` + workbench 关系包 |
| `standards-data.json` | 约 8KB | 标准索引兼容文件 | 旧入口兼容 | 可保留短期兼容；正式入口使用 `standards-index.json` |

## 6. `management-knowledge.json` 拆分状态

| 顶层字段 | 当前大小 | 是否已有替代 | 替代数据包 | 处理方式 |
|---|---:|---|---|---|
| `scope_types` | 约 529KB | 是 | `maintenance-knowledge.json` | 可从 management 退役 |
| `security_processes` | 约 1.1MB | 是 | `maintenance-knowledge.json` | 可从 management 退役 |
| `work_function_layers` | 约 141KB | 是 | `maintenance-knowledge.json` | 可从 management 退役 |
| `security_technology_modules` | 约 1.1MB | 是 | `maintenance-knowledge.json` | 可从 management 退役 |
| `security_technical_measures` | 约 249KB | 是 | `maintenance-knowledge.json` | 可从 management 退役 |
| `gbt_42446_references` | 约 14KB | 是 | `maintenance-knowledge.json` | 可从 management 退役 |
| `gartner_roles` | 约 14KB | 是 | `maintenance-knowledge.json` | 可从 management 退役 |
| `environment_scope_tree` | 约 20.1MB | 是 | `environment-workbench.json` | 已退役；环境页运行时只读 `environment-workbench.json` |
| `service_module_index` | 约 5.5MB | 是 | `shared-lookups.json` | 已从 `management-knowledge.json` 和 `lifecycle-knowledge.json` 顶层移除；legacy fallback 需要时从 `shared-lookups.json` 合并 |
| `assets` | 小于 1KB | 否 | 无 | 用户已确认暂不考虑旧图片页面，已从 `management-knowledge.json` 导出中移除 |

## 7. 共享包

已新增：

```text
frontend/capability-browser/public/data/shared-lookups.json
```

第一期字段：

| 字段 | 用途 |
|---|---|
| `generated_at` | 生成时间 |
| `stats.service_module_index` | 服务索引数量 |
| `service_module_index` | 全站安全技术服务 -> 作用域 / 模块 / 系统 / 产品 / 环境索引 |

迁移步骤：

1. 已在后端导出层新增 `export-shared-lookups`；
2. 已让 `capability-workbench.json`、`lifecycle-workbench.json` 和 `/api/v1/capabilities/workspace-projection` 改为读取 `shared-lookups.json` 或同源共享索引；
3. 已在前端 `dataClient` 新增 `sharedLookups` 路径；
4. 已删除 `management-knowledge.json` 中的 `assets`，并移除 management / lifecycle 顶层重复 `service_module_index`；
5. 顾问端发布包不再包含 `management-knowledge.json`。

## 8. 维护规则

- 新增、删除或拆分任何 `public/data/*.json` 时，必须同步更新本文档。
- 如果某个 JSON 是 legacy fallback，必须写明退役条件。
- 如果某个页面直接依赖某个 JSON，必须写明页面入口和字段边界。
- 发布顾问端压缩包前，应按本文档生成发布 manifest，不应靠人工记忆判断要带哪些文件。
