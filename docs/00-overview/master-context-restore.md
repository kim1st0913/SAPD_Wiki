# 主控 Agent 轻量恢复入口

本文档用于降低后续主控线程恢复时的上下文负担。除非任务明确要求考古历史过程，否则不要从完整 `docs/05-archive/` 开始读取。

## 恢复读取顺序

后续主控开始复杂任务时，优先按以下顺序读取：

1. `AGENTS.md`
2. `CURRENT_STATE.md`
3. `progress.md` 的当前状态摘要和最近执行记录
4. `findings.md` 的当前关键决策、当前重要风险、最近重要发现
5. `task_plan.md` 的 `Current Status`、当前阶段和相关任务段落
6. `docs/06-implementation/open-issues.md` 中与本轮任务相关的问题
7. 与本轮任务直接相关的专题文档或代码文件

## 默认不要读取的内容

除非需要核对历史细节、追踪某次回归或恢复旧子 Agent 记录，否则不要默认读取：

- `docs/05-archive/progress-history/2026-05.md`
- `docs/05-archive/findings-history/`
- `docs/05-archive/context-slimming-2026-05-15/`
- 大段旧前端回归记录
- 已关闭子 Agent 的历史等待日志
- 与当前任务无关的 maturity、frontend、ETL 专题文档全集

## 判断当前工作线

当前项目主线仍是：

- 已导入 Sheet 的业务含义复核；
- 前端关系展示校正；
- Frontend Baseline 1.0 三页对齐；
- maturity 模块保持旁路 M0 状态，M1 需等主线优先级和输入 / 输出边界确认后再启动。

## 子 Agent 恢复规则

如果历史记录里出现子 Agent：

- 先看 `progress.md` 是否写明 `已 fan-in`、`已关闭`、`completed`；
- 不要仅凭历史 `wait_agent` 超时判断卡住；
- 不要恢复已经关闭或当前运行时不可管理的旧 agent id；
- 新启动子 Agent 前，必须说明角色、写入范围、禁止范围和验收标准，并在 `progress.md` 记录 agent id；
- 子 Agent 完成后必须及时 fan-in 并关闭。

## 上下文减负规则

- `CURRENT_STATE.md` 是默认开工入口，只记录当前主线、禁止事项、下一步和必读文件。
- `progress.md` 只保留当前恢复入口、近期关键动作和本轮执行日志。
- 完整执行历史按月归档到 `docs/05-archive/progress-history/`。
- `findings.md` 只保留当前有效判断和历史入口，不承载长篇过程记录。
- 新的 bug、数据问题、页面问题和待确认事项继续统一进入 `docs/06-implementation/open-issues.md`。

## 推荐启动语句

后续可对主控说：

> 请按 `CURRENT_STATE.md` 和 `docs/00-overview/master-context-restore.md` 恢复上下文，只读取当前任务相关文件，不读取完整历史归档。
