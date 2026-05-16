# SAPD Wiki Stitch Design Handoff V2

本文档用于把 SAPD Wiki 当前菜单结构、页面类型、数据契约状态和已知缺口交接给 Stitch / UI 设计流程。它不是前端实现任务，不接入运行代码。

## 1. 设计目标

SAPD Wiki 的设计目标是本地结构化知识工作台 UI，用于承载安全能力、信息化环境、生命周期、知识目录、标准框架和指南文档的浏览、映射和核对。

本轮设计输入明确不做：

- 不做营销官网首页。
- 不做安全运营大屏。
- 不做复杂全局知识图谱。
- 不做只追求视觉冲击的科技感展示页。
- 不把关系数据压成卡片墙。

Stitch 设计应围绕“可查、可核对、可追溯、可逐步落地”的工作台体验展开。

## 2. 页面范围

| 优先级 | 页面 / 模块 | 页面类型 | 当前定位 |
|---|---|---|---|
| P0 | 全局导航 / Application Shell | `application-shell` | 全站统一导航、搜索、页面容器和上下文入口 |
| P1 | 安全能力映射页 | `capability-mapping-workbench` | 以安全能力 / 关注点为主语的核心关系工作台 |
| P1 | 信息化环境安全能力映射页 | `environment-mapping-workbench` | 以信息化环境 / 信息化对象为主语的核心对象映射工作台 |
| 受控专项投影 | LC-AP 开发安全生命周期页 | `domain-module` 下的受控专项关系投影 | 以生命周期阶段 / 活动 / 控制点为主语，不扩成完整开发安全模块 |
| P2 | 安全知识目录 | `knowledge-directory` | 作用域、模块、措施、工作、职能、流程、岗位参考等目录检索和详情核对 |
| P2 | 安全标准 / 框架目录 | `standard-framework-directory` / `standard-framework-page` | 标准目录、控制项、版本信息和映射关系 |
| P2 | 安全指南文档页 | `document-hub` / `document-page` | 方法论集合页和正文阅读页 |
| P2 | SAPD 成熟度评估 | `domain-module` | 独立模块，承载评分填报、结果生成和评估报告入口，代码实现另开会话 |
| P3 | 开发安全 | `domain-module` | 专题扩展入口，当前不扩成完整模块 |
| P3 | 数据安全 | `domain-module` | 专题扩展入口，当前不扩成完整模块 |
| P3 | Hype Cycle / 其他指南 / 其他知识 / 其他标准 | `knowledge-directory` 或 `placeholder-page` | 预留入口和建设状态说明 |

## 3. 当前核心口径

Frontend Baseline 1.0 已从“三个同级关系工作台”修正为：

> P1 双核心工作台 + LC-AP 受控专项关系投影。

当前口径如下：

- 安全能力映射页是 `capability-mapping-workbench`。
- 信息化环境安全能力映射页是 `environment-mapping-workbench`。
- LC-AP 开发安全生命周期页不是 P1 核心工作台，不扩成完整开发安全模块。
- SAPD 成熟度评估是独立 `domain-module`，不并入三份 workbench JSON。
- 后续 UI 设计应优先服务两个 P1 工作台，再逐步迁移知识目录、标准页和指南页。

## 4. 数据输入状态

| 数据文件 | 当前状态 | 设计含义 |
|---|---|---|
| `capability-workbench.json` | 已生成并接入 | 安全能力映射页的关系工作台主数据 |
| `environment-workbench.json` | 已生成并加载 | 信息化环境页目标主数据，展示结构尚未完全切换 |
| `lifecycle-workbench.json` | 已生成并接入 | LC-AP 受控专项关系投影主数据 |
| `capability-tree.json` | 继续保留 | 只作为能力目录树，不再作为关系工作台主输入 |
| `management-knowledge.json` | 过渡兼容 | 旧环境 / 管理知识数据包，不作为新 UI 主输入 |
| `lifecycle-knowledge.json` | 过渡兼容 | 旧生命周期知识数据包，不作为新 UI 主输入 |
| `shared-lookups.json` | 后续 P1 项 | 共享字典、枚举和标签候选 |
| `source-evidence.json` | 后续 P1 项 | 来源证据集中索引，主页面只保留引用和折叠入口 |

设计时应以 `*-workbench.json` 目标契约为准，不以旧 JSON 的临时展示结构为准。

## 5. 重要缺口

当前必须显式交接给 Stitch 的缺口：

- 信息化环境页已经加载 `environment-workbench.json`，但页面展示结构尚未完全切换到 `environment-workbench` 的对象 / 关系模型。
- Stitch 设计信息化环境页时，必须以 `environment-workbench.json` 的目标数据结构为准，而不是以旧 `management-knowledge.json.environment_scope_tree` 或旧页面表格方式为准。
- 信息化环境页的主语是“信息化环境 / 信息化对象”，不应直接套用安全能力映射页。
- 环境页后续实现必须完成 `environment-workbench` 消费替换，避免前端继续从旧结构直接解释环境关系。
- `shared-lookups.json` 和 `source-evidence.json` 尚未拆出，设计中应保留共享字典与来源证据的扩展入口。

## 6. 页面设计约束

### 6.1 全局约束

- 页面数据必须通过 `dataClient`、`/api/v1/*` 或后端生成的离线兼容包进入前端。
- 前端组件不得重新实现 ETL、主数据归一、业务关系推断、成熟度评分或编码纠错。
- 来源证据默认折叠，不挤压主工作区。
- 主展示区不得出现 `sheet`、`row`、`column`、`raw_value`、`source_file`、`import_id`、`source_id`、`source_ref`、`source_label`、`debug`、`raw`、`metadata`、`intermediate`、`generated_at`。
- 技术模块和技术措施即使视觉上相邻或合并呈现，也必须保留显式标签区分。
- 关系表达优先使用目录、表格、分栏、矩阵、局部关系画布和可折叠明细，不默认使用复杂全局网络图。

### 6.2 安全能力映射页

- 主语是安全能力 / 关注点。
- 技术视角表达：关注点 -> 作用域 -> 安全技术服务 -> 安全技术模块 / 安全技术措施。
- 管理视角表达：关注点 -> 安全工作 -> 四层安全职能 -> L2 / L3 / L4 流程。
- 来源证据默认折叠。
- 关联模块、措施、工作和流程应服务当前关注点理解，不应挤压主工作区。

### 6.3 信息化环境安全能力映射页

- 主语是信息化环境 / 信息化对象。
- 核心表达：环境 -> 分段 -> 对象 -> 作用域 -> 服务 -> 模块 / 措施 / 系统 / 产品 -> 能力关联。
- 系统 / 产品可作为落地对象或参考对象展示，但不应把环境页弱化成能力页筛选条件。
- 后续实现必须优先消费 `environment-workbench.json` 的 objects / relations，而不是旧 `environment_scope_tree` 展示结构。

### 6.4 LC-AP 开发安全生命周期页

- 主语是生命周期阶段 / 活动 / 控制点。
- 当前定位是受控专项关系投影。
- 不扩成完整开发安全、DevSecOps、代码安全或供应链安全模块。
- LC-AP 参考数据不放在同页参考区，后续进入专项知识维护。

### 6.5 成熟度评估模块

- `SAPD 成熟度评估` 是独立 `domain-module`。
- 页面目标是评分填报、结果生成和评估报告入口。
- 不复用关系画布作为主界面。
- 不并入三份 workbench JSON，后续使用 maturity 专用数据契约。

## 7. 推荐设计顺序

| 顺序 | 设计对象 | 说明 |
|---|---|---|
| 1 | Application Shell | 先定全站顶栏、窄侧栏、二级菜单、搜索、页面容器和面包屑 |
| 2 | 安全能力映射页 | 先收敛一个 P1 核心工作台，作为关系表达基准 |
| 3 | 信息化环境映射页 | 以 `environment-workbench.json` 为准设计对象映射工作台 |
| 4 | 安全知识目录页 | 统一目录检索、表格浏览、详情抽屉和来源入口 |
| 5 | 安全标准 / 框架页 | 设计标准目录、控制项、版本和映射关系 |
| 6 | 指南文档页 | 设计方法论文档集合和正文阅读体验 |
| 7 | LC-AP 受控专项页 | 可单独设计，但不要扩成完整开发安全模块 |
| 8 | 成熟度评估模块 | 另开设计输入和数据契约，不抢当前 P1 工作台主线 |

## 8. Stitch 输入摘要

| 页面 / 模块 | 页面类型 | 主语 | 核心区域 | 不适合的设计方式 | 数据源 | 当前实现状态 | 优先级 |
|---|---|---|---|---|---|---|---|
| 全局导航 / Application Shell | `application-shell` | 全站页面上下文 | 顶栏、一级导航、二级菜单、搜索、面包屑、主内容容器 | 营销首页、大 Hero、炫技大屏 | `nav-manifest.v1.json`、菜单定义文档 | 已有设计交接 Manifest，未实现完整 AppShell | P0 |
| 安全能力映射页 | `capability-mapping-workbench` | 安全能力 / 关注点 | 能力目录、对象头、技术视角、管理视角、标准映射、折叠明细、来源入口 | 复杂全局网络图、卡片墙、所有关系塞进一个卡片 | `capability-workbench.json`、`capability-tree.json` | 已优先接入 `capability-workbench`，视觉仍待 Stitch 重构 | P1 |
| 信息化环境安全能力映射页 | `environment-mapping-workbench` | 信息化环境 / 信息化对象 | 环境目录、对象概览、作用域、服务、模块、措施、系统、产品、能力关联、来源入口 | 直接套能力页、把对象做成普通筛选、旧表格主导设计 | `environment-workbench.json` | 已加载数据，但展示结构尚未完全切换到对象 / 关系模型 | P1 |
| LC-AP 开发安全生命周期页 | 受控专项关系投影 | 生命周期阶段 / 活动 / 控制点 | 阶段导航、活动 / 控制点、能力映射、关注点映射、服务 / 模块关联、来源入口 | 扩成完整 DevSecOps 平台、同页塞参考库维护 | `lifecycle-workbench.json` | 已优先接入 `lifecycle-workbench` | 受控专项 |
| 安全知识目录 | `knowledge-directory` | 知识对象 | 检索、表格、标签筛选、详情抽屉、来源证据、对象关联 | 长文档页、纯卡片页、每类知识完全不同结构 | 现有知识数据包，后续 `shared-lookups.json` | 待设计和后续迁移 | P2 |
| 安全标准 / 框架目录 | `standard-framework-directory` / `standard-framework-page` | 标准 / 控制项 | 标准目录、版本信息、控制项列表、能力 / 措施 / 管理映射、来源证据 | PDF 阅读器、静态链接集合、不可读长表 | 后续标准 / 框架数据契约 | 待设计 | P2 |
| 安全指南 | `document-hub` / `document-page` | 方法论文档 | 指南目录、章节目录、正文、页内目录、引用、相关指南 | 卡片海报页、复杂关系图 | 文档类数据和 Markdown / Docs 内容 | 待设计 | P2 |
| SAPD 成熟度评估 | `domain-module` | 评估模板 / 填报会话 / 结果 | 评分填报、结果摘要、成熟度分析、报告入口 | 关系画布主界面、伪造未建设功能 | 后续 maturity 专用契约 | 已纳入菜单规划，代码另开会话 | P2 |
| 开发安全 / 数据安全 | `domain-module` | 专题模块 | 专题说明、建设状态、后续规划、相关入口 | 强行接入未准备数据、伪造完整功能 | 后续专题契约 | 预留入口 | P3 |
| Hype Cycle / 其他页面 | `placeholder-page` 或 `knowledge-directory` | 预留对象 | 页面说明、建设状态、后续规划、返回入口 | 空白页、假完成页 | 后续数据契约 | 预留入口 | P3 |

## 9. 后续实现建议

- Stitch 输出后，不要一次性重构全站。
- 第一阶段先落 Application Shell，确保全站导航、二级菜单、搜索入口和主内容容器稳定。
- 第二阶段落两个 P1 工作台：安全能力映射页和信息化环境安全能力映射页。
- 信息化环境页实现时必须完成 `environment-workbench.json` 消费替换，把对象 / 关系模型作为主输入。
- 第三阶段迁移安全知识目录、标准 / 框架页和指南文档页。
- LC-AP 可作为受控专项页单独实现，不要扩成完整开发安全模块。
- SAPD 成熟度评估应另开设计输入和实现会话，不并入当前关系工作台重构。
- 每个页面实现前都应先确认数据契约、字段边界、来源证据折叠方式和 fallback 策略。

## 10. 交付检查清单

- 已包含 P0、P1、P2、P3 页面范围。
- 已明确 P1 双核心工作台和 LC-AP 受控专项投影。
- 已明确三份 workbench JSON 的数据状态。
- 已明确 `capability-tree.json`、`management-knowledge.json`、`lifecycle-knowledge.json` 的过渡定位。
- 已明确信息化环境页尚未完全切换到 `environment-workbench` 的缺口。
- 已明确非业务字段不得进入主展示区。
- 已明确来源证据默认折叠。
- 已明确技术模块和技术措施必须显式区分。
- 已明确 Stitch 后续实现不应一次性重构全站。
