# 治理入口

本文档是 SAPD Wiki 的轻量治理入口。当前项目仍处于 MVP 阶段，治理原则是：

```text
轻治理
+
渐进治理
+
按复杂度演进
```

不要一次性建立过重的治理体系。治理文档只在能降低返工、减少分歧或保护数据质量时新增。

## 当前治理文档

| 文档 | 用途 |
|---|---|
| `docs/07-governance/data-governance.md` | GitHub 数据边界、数据标准化、去重、冲突、旧对象停用、验证等级、metadata 字段升级和前端数据包拆分规则 |
| `docs/03-import-etl/github-local-data-initialization.md` | 从 GitHub 拉取代码后的本地文件放置、一键数据初始化和生成数据不同步说明 |
| `docs/07-governance/codex-performance-workflow.md` | Codex 轻量开发、验证摘要、重连减负和用户短指令默认执行规则 |
| `docs/06-implementation/open-issues.md` | 所有 bug、数据问题、页面问题和待确认事项的唯一维护文件 |
| `findings.md` | 当前关键决策、重要风险和历史记录索引 |
| `progress.md` | 执行日志、文件变更、命令和验证结果 |
| `task_plan.md` | 当前阶段、任务状态和下一步 |

## 治理边界

当前立即执行：

- 数据治理规则集中化。
- GitHub 只同步代码 / 文档 / 配置模板 / 脱敏 fixture，原始数据和生成数据通过本地初始化脚本重建。
- 前端离线数据包按页面契约拆分，禁止恢复大一统业务 JSON。
- `findings.md` 索引化。
- `progress.md` 职责收缩。
- 问题统一维护在 `open-issues.md`。

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
