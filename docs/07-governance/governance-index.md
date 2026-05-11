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
| `docs/07-governance/data-governance.md` | 数据标准化、去重、冲突、旧对象停用、验证等级和 metadata 字段升级规则 |
| `docs/06-implementation/open-issues.md` | 所有 bug、数据问题、页面问题和待确认事项的唯一维护文件 |
| `findings.md` | 当前关键决策、重要风险和历史记录索引 |
| `progress.md` | 执行日志、文件变更、命令和验证结果 |
| `task_plan.md` | 当前阶段、任务状态和下一步 |

## 治理边界

当前立即执行：

- 数据治理规则集中化。
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

## 后续可选治理

当项目复杂度继续上升时，再逐步补充：

| 时机 | 可新增内容 |
|---|---|
| 出现多个稳定架构决策 | `docs/07-governance/adr/ADR-xxx.md` |
| 对象类型继续扩展 | 前端渲染治理规则 |
| `metadata_json` 查询变多 | metadata promotion 计划 |
| 关系类型冲突增加 | relation governance |
| 引入 AI/RAG | 语义层和引用来源治理 |
