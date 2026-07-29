# 当前执行线台账（已停用）

> 归档状态：`retired / historical`

> 状态：2026-07-17 停止维护。历史 task ID、`EL-xxx`、模块线程映射和 fan-in 状态不再作为 SAPD 当前执行依据。

此前台账用于在内部子 Agent 不稳定、长会话缺少恢复机制时保存多会话状态。当前已经改为父 Agent 编排内部子 Agent，因此继续维护静态线程台账会制造过期上下文和错误写入权。

当前状态只从以下入口恢复：

1. 用户最新请求和验收标准；
2. 最近的 `AGENTS.md`；
3. 当前 dirty working tree 和运行证据；
4. `CURRENT_STATE.md` 的当前主线；
5. `progress.md` 最近相关记录和必要的 `findings.md` 决策。

长期 backlog 使用 `task_plan.md` 和 Open Issues；当前任务内并行由父 Agent 管理，独立 Codex task 只在用户明确要求时创建。旧台账内容保留在 Git 历史中，不复制到新提示词或交接包。
