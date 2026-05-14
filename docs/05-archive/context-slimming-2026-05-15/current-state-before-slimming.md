# CURRENT_STATE: SAPD Wiki

本文件用于 Codex 每次开工前快速读取，帮助主控 Agent 避免默认加载过长历史文档。

## 当前主线

- 已导入 Sheet 的业务含义复核 + 前端关系展示校正。
- 当前重点不是新增数据源，也不是扩展新模块，而是把已导入数据的业务语义、页面归属和关系展示校正清楚。
- Frontend Baseline 1.0 已确认作为当前前端对齐工作的基线说明。

## 当前页面范围

Frontend Baseline 1.0 当前覆盖三页：

1. `安全能力映射`
   - 主视角：安全能力 / 安全关注点。
   - 核心关系：关注点、作用域、安全技术服务、安全技术模块、安全技术措施、管理工作、流程 / 职能、来源证据。
2. `LC-AP开发安全生命周期`
   - 主视角：LC-AP 开发安全生命周期阶段。
   - 核心关系：阶段、主要活动、安全活动、安全策略要求、开发技术服务、安全技术服务、安全技术模块、安全技术措施、开发类产品组件、来源证据。
3. `信息化环境维度`
   - 主视角：信息化环境 / 环境子类 / 信息化对象。
   - 核心关系：环境、环境子类、对象、作用域、安全技术服务、安全技术模块、安全系统、产品、来源证据。
   - 该页是第一批核心数据的第三个业务视角，不是新 Sheet 扩展。

## 当前禁止事项

- 不默认启动 Phase 7 多格式增强。
- 不默认启动 maturity M1。
- 不默认新增 Sheet 扩展。
- 不默认重构数据库 schema。
- 不默认大改 ETL。
- 不默认引入 React / Vue 重构当前静态 MVP 前端。
- 不在主展示区暴露非业务字段：`sheet`、`row`、`column`、`raw_value`、`source_file`、`import_id`、`source_id`、`source_ref`、`source_label`、`debug`、`raw`、`metadata`、`intermediate`、`generated_at`。
- 不静默覆盖用户文件或未确认业务判断。

## 当前下一步

优先推进 Frontend Baseline 1.0 的三页 Gap Check 和必要校正：

1. 先做只读差距检查，明确页面现状、缺口、风险和涉及文件。
2. 用户确认后，再进入小范围前端实现。
3. 实现时优先复用当前静态前端、`dataClient`、ViewModel、现有 JSON 投影和统一组件风格。
4. 若发现数据缺口，记录为数据契约或待确认问题，不在前端临时硬编码业务关系。

## 必读文件

每次开工建议先读：

- `AGENTS.md`
- `CURRENT_STATE.md`

按任务类型追加读取：

- 复杂阶段判断：`task_plan.md`
- 当前关键决策和风险：`findings.md`
- 近期执行恢复：`progress.md`
- Frontend Baseline 1.0 相关任务：`docs/04-user-guide/frontend-baseline-1.0-plan.md`
- 问题修复或 bug 核对：`docs/06-implementation/open-issues.md`

## 不必默认读取的长文档

以下文件或目录不要每次开工默认读取，只在任务明确相关时读取：

- `task_plan.md` 的完整历史段落
- `findings-history/`
- `progress-history/`
- `docs/08-maturity/`
- `docs/05-archive/`
- `data/exports/`
- `frontend/capability-browser/public/data/*.json`
- 大型前端源码文件，除非任务需要检查或修改对应页面

## 当前 Agent 工作规则

- 对用户不是开发人员这一点保持友好解释，把复杂任务拆成可确认、可回退的小步骤。
- 复杂任务开始前说明：要解决什么、会读或改哪些文件、完成后得到什么、是否需要用户判断。
- 做较大实现、重构或技术选型前，先确认任务边界并读取必要上下文。
- 默认中文记录说明性内容；代码标识、文件名、命令、字段名、对象 `type`、API 路径保留英文原文。
- 只读任务不得修改文件。
- 如果用户明确禁止读取、运行或打开某类内容，严格遵守。
- 每次任务完成后输出任务完成反馈，说明结论、修改范围、功能结果、验证结果、前端页面提示、数据状态、字段边界和下一步建议。
- 如使用子 Agent，必须明确角色、写入范围、禁止范围和验收标准；完成后主控必须 fan-in 并关闭。
