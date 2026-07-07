# 治理入口

本文档是 SAPD Wiki 的轻量治理入口。当前项目仍处于 MVP 阶段，治理原则是：

```text
轻治理
+
渐进治理
+
按复杂度演进
```

不要一次性建立过重的治理体系。治理文档只在能降低返工、减少分歧或保护数据质量时新增；小修、小页面调整和一次性排查不新增文档。

## 当前治理文档

| 文档 | 用途 |
|---|---|
| `docs/07-governance/data-governance.md` | GitHub 数据边界、数据标准化、去重、冲突、旧对象停用、验证等级、metadata 字段升级和前端数据包拆分规则 |
| `docs/07-governance/capability-mapping-change-control.md` | 安全能力映射页变更分级、暂停条件、验证门槛和前端治理审计入口 |
| `docs/07-governance/project-test-workflow-and-case-matrix.md` | 全工程分层测试流程、测试用例矩阵、独立套件、完整回归和 DMG 打包验收入口 |
| `docs/03-import-etl/github-local-data-initialization.md` | 从 GitHub 拉取代码后的本地文件放置、一键数据初始化和生成数据不同步说明 |
| `docs/07-governance/codex-performance-workflow.md` | Codex 轻量开发、验证摘要、重连减负和用户短指令默认执行规则 |
| `docs/07-governance/execution-line-convergence-workflow.md` | 多会话 / 子 Agent 不稳定后的执行线收敛规则：单一主控、单一写入主线、dirty diff 优先验收和 checkpoint |
| `docs/07-governance/current-execution-lines.md` | 当前已展开任务线和模块线程映射台账，用于暂停但不丢失任务，记录状态、证据、恢复条件、写入权限和下一步 |
| `docs/README.md` + `frontend/design-handoff/README.md` | 设计文档入口和生命周期规则：区分实现规格、设计基线、Stitch 参考材料、专题契约和交付体验说明 |
| `docs/06-implementation/global-search-contract-2026-07-05.md` | 全局搜索完整契约：产品职责、命中通道、禁止推断、计数 / 展示窗口、标准明细索引、定位和审计样例 |
| `docs/06-implementation/open-issues.md` | 当前未关闭 bug、数据问题、页面问题和待确认事项的维护入口 |
| `docs/06-implementation/open-issues-index.md` | Open Issues 全量索引，定位当前问题和历史归档问题 |
| `docs/05-archive/open-issues-history/2026-06.md` | 已关闭 Open Issues 历史长记录归档 |
| `findings.md` | 当前关键决策、重要风险和历史记录索引 |
| `progress.md` | 执行日志、文件变更、命令和验证结果 |
| `task_plan.md` | 当前阶段、任务状态和下一步 |

## 文档瘦身规则

当前 `docs/` 非归档 Markdown 文档约 `107` 个、`31540` 行；若把 `frontend/design-handoff/` 设计交接材料一并纳入设计文档治理口径，非归档 Markdown 约 `125` 个。项目已经进入需要控增量的阶段。后续默认先复用现有入口，不为每次修复新增设计文档或说明文档。

新增文档必须同时说明：

- 读者是谁；
- 解决什么长期问题；
- 为什么不能写入现有入口；
- 后续由哪个入口索引；
- 何时可以归档或退役。

允许新增文档的情形：

- 跨模块稳定契约，例如全局搜索、数据治理、前后端边界；
- 用户需要单独阅读的交付说明、UAT 指南或打包说明；
- 数据、安全、审计、发布等中高风险边界；
- 现有入口继续追加会明显破坏可读性。

不应新增文档的情形：

- 单页小 bug、文案、样式、局部交互或一次性验证；
- 已在 `progress.md` 和最终反馈说清楚的执行过程；
- 未经确认的 brainstorming、临时方案或废弃方案；
- 与已有治理文档重复的规则。

文档维护默认规则：

- `CURRENT_STATE.md` 只放恢复入口和最新关键状态。
- `progress.md` 只放最近动作、改动范围、命令和验证摘要。
- `findings.md` 只放长期有效决策和重要风险。
- `task_plan.md` 只放当前阶段和未完成主线。
- 过期过程、长记录和已关闭问题进入 `docs/05-archive/`。

## 设计文档治理规则

当前设计文档的问题不是缺材料，而是实现规格、设计基线、Stitch 原始交接和专题记录混在一起。后续按“用途分层 + 少增量 + 可退役”管理。

设计文档分层：

| 层级 | 权威入口 | 用途 | 使用规则 |
|---|---|---|---|
| 信息架构 / brief | `docs/04-frontend/` | 当前前端信息架构、页面类型和阶段设计 brief | 只保留方向和范围，不堆页面实现细节 |
| 全局设计基线 | `docs/06-implementation/frontend-*baseline*`、`frontend-*principles*` | 跨页面稳定视觉、交互、字段边界和全局契约 | 只有已验收或长期有效规则进入 |
| 页面实现规格 | `frontend/design-handoff/implementation-specs/` | Codex 可直接据此改代码的页面级规格 | 必须标注状态、读者、权威来源、验收点和退役条件 |
| Stitch / Product Design 交接材料 | `frontend/design-handoff/stitch-*` | 设计输入、输出、prompt、截图和参考稿 | 只能作为 reference，不能直接接入代码 |
| 专题设计 / 问题契约 | `docs/06-implementation/` | 全局问题、审计规则、跨页面专题设计结论 | 必须能关联 `open-issues.md`、审计脚本或长期契约 |
| 交付体验设计 | `docs/09-delivery/` | DMG / ZIP / 诊断 / 首次启动 / 用户交付体验 | 不承载普通前端页面设计 |

新增或修改设计文档前必须先判断：

- 是否能写入现有 implementation spec、设计基线或 brief；
- 是否会被代码实现直接使用；
- 是否需要用户长期阅读或验收；
- 是否有清晰退役条件。

默认不新增设计文档的情形：

- 单页小 UI 调整、文案、按钮、chip、表格密度或局部空态；
- 截图反馈能在本轮直接修复并自动验证；
- 只用于解释本轮实现过程的临时说明；
- 已经能在 `progress.md` 和任务完成反馈说清楚的验收信息。

必须形成设计文档或更新既有设计文档的情形：

- 会改变全站导航、页面类型、布局基线、字段展示边界或交互范式；
- 会作为后续实现依据的页面级规格；
- 涉及前后端数据契约、搜索 / 批注 / 导出 / 打包等跨页面体验；
- 用户需要单独验收或交给其他会话 / 设计工具继续执行。

页面实现时只允许把 `implementation-specs/` 中状态为 active / implementation-source 的规格作为直接实现依据。Stitch 输出、设计截图、历史 brief 和专题记录必须先转成 implementation spec，或在现有 spec 中补充为明确验收项。

## Issue 建立门槛

`docs/06-implementation/open-issues.md` 只记录需要持续追踪的问题，不再承接所有小修。

默认不建 `OI`，直接修复并在 `progress.md` 和任务完成反馈中说明：

- 文案、轻微样式、单个按钮 / chip / tab 的局部问题；
- 单页小交互且本轮可修复、可自动验证；
- 无业务判断、无数据风险、无全局防回归需求的问题；
- 代码清理、命名修正或测试补充。

满足以下至少一项才建 `OI`：

- 影响多个页面、多个数据域或全局契约；
- 涉及源 Excel、SQLite、正式 JSON、字典、标准、LC、环境或导入 / 导出边界；
- 涉及安全、数据边界、GitHub 同步边界或用户写入数据；
- 需要新增或扩展审计脚本、防回归矩阵；
- 需要用户业务判断或人工验收后才能关闭；
- 本轮无法完整修复，或严重性为中 / 高。

建单后必须写清楚：

- 严重性；
- 建单理由；
- 自动验证命令；
- 用户验收入口和预期现象；
- 关闭条件。

修复后若自动验证已经覆盖且不需要用户判断，可以直接关闭；若需要用户验收，最终反馈必须明确提示用户验收，不能让问题长期停在“已修复 / 待页面验收”而没有入口。

## 治理边界

当前立即执行：

- 执行线收敛：当前优先解决多会话并行、长会话变慢和子 Agent fan-in 不稳定导致的主线漂移；默认采用单一主控、单一写入主线和 dirty diff 优先验收。
- 数据治理规则集中化。
- GitHub 只同步代码 / 文档 / 配置模板 / 脱敏 fixture，原始数据和生成数据通过本地初始化脚本重建。
- 前端离线数据包按页面契约拆分，禁止恢复大一统业务 JSON。
- 索引先行、分片按需加载、跨包补关系页面执行 `Frontend Lazy Data Contract Baseline 1.0`；知识库字典和安全标准 / 框架必须用显式加载契约区分 `required` / `supplemental`，并通过 `node scripts/audit_frontend_lazy_load_contract.mjs` 审计。
- 知识库字典作为安全能力、作用域、技术服务、技术模块 / 措施、管理工作、流程和职能的权威值；相关引用用 `node scripts/audit_dictionary_reference_consistency.mjs` 做全量一致性检查。
- 安全能力映射页按 `capability-mapping-change-control.md` 执行变更分级和前端治理审计。
- 全工程测试按 `project-test-workflow-and-case-matrix.md` 执行分层验证；默认复用 `node scripts/run_project_test_suite.mjs`，DMG 构建和系统 Chrome 回归必须显式启用。
- `findings.md` 索引化。
- `progress.md` 职责收缩。
- 当前未关闭中高严重性、全局、审计、安全、数据和待业务确认问题维护在 `open-issues.md`；小问题直接修复并在完成反馈提示验收；已关闭问题长记录归档到 `docs/05-archive/open-issues-history/`，全量定位通过 `open-issues-index.md`。

当前不执行：

- 不建立复杂 findings 子目录树。
- 不一次性新增 schema、命名、关系、前端等六件套治理文档。
- 不立即重构 `metadata_json` 为大量正式字段。
- 不立即实现完整 schema-driven frontend 引擎。

## Agent 治理

逻辑角色可以保留，用于说明职责边界：

- Master Agent
- ETL Worker
- Frontend Worker
- Export / Verify Worker
- Data Definition Worker

实际运行时默认只使用：

```text
Master Agent
+
必要时的 Worker Agent
```

只有当任务满足以下条件时，才建议启动 Worker：

- 写入范围清晰且互不冲突；
- 数据契约或验收标准已经明确；
- Worker 的结果可以被主控独立验证；
- 并行收益大于上下文同步成本。

### Worker 稳定性与打断规则

主控 Agent 不能仅凭 `wait_agent` 超时判断 Worker 无响应。超时只表示“当前等待窗口没有最终结果”，不等于 Worker 卡死。

后续执行规则：

- 已启动的 Worker 如果仍显示为运行中，主控默认认为它仍在工作。
- 主控可以发送状态请求，但不能因为一次或两次等待超时就关闭 Worker。
- 对前端、ETL 等复杂任务，默认等待窗口按任务复杂度设置，不能用短等待反复催促。
- Worker 正在重构文件时，临时出现删除、迁移或拆分状态，应先视为中间态；除非已经破坏运行且 Worker 明确无响应，不能立即打断。
- 只有满足以下任一条件，主控才可以中断或关闭 Worker：
  - 用户明确要求停止该 Worker；
  - Worker 修改了明确禁止的文件范围；
  - Worker 与另一个 Worker 发生写入冲突且继续运行会扩大损坏；
  - Worker 长时间无状态更新，并且主控已经至少发送一次状态请求、记录等待结果、确认用户侧没有仍在运行的有效反馈；
  - Worker 已造成可验证的运行阻断，且需要主控止损。
- 关闭 Worker 前，主控必须在 `progress.md` 记录原因、等待时长、已发送的状态请求和当前文件风险。
- 同一职责 Worker 已有可用 `agent_id` 时，优先复用；但已完成“设计任务”的 Worker 进入“代码实现任务”前，主控必须明确这是新任务，并给出新的边界和验收标准。

## 后续可选治理

当项目复杂度继续上升时，再逐步补充：

| 时机 | 可新增内容 |
|---|---|
| 出现多个稳定架构决策 | `docs/07-governance/adr/ADR-xxx.md` |
| 对象类型继续扩展 | 前端渲染治理规则 |
| `metadata_json` 查询变多 | metadata promotion 计划 |
| 关系类型冲突增加 | relation governance |
| 引入 AI/RAG | 语义层和引用来源治理 |
