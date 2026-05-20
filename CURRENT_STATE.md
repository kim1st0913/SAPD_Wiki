# CURRENT_STATE: SAPD Wiki

本文件用于 Codex 每次开工前快速读取，帮助主控 Agent 避免默认加载过长历史文档。

## 当前主线

- 已导入 Sheet 的业务含义复核 + 前端关系展示校正。
- 当前重点不是新增数据源，也不是扩展新模块，而是把已导入数据的业务语义、页面归属和关系展示校正清楚。
- Frontend Baseline 1.0 已确认作为当前前端对齐工作的基线说明。
- 前后端分离本轮已阶段性收口，收口说明见 `docs/01-architecture/frontend-backend-separation-closure.md`。

## 当前页面范围

Frontend Baseline 1.0 当前覆盖三页：

1. `安全能力映射`
   - 主视角：安全能力 / 安全关注点。
   - 技术视角：安全关注点 -> 作用域 -> 安全技术服务 -> 安全技术模块 / 安全技术措施。
   - 管理视角：安全关注点 -> 管理工作 -> 安全流程（L2 流程组 / L3 流程 / L4 活动）或安全职能（4 层）。
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
- 不允许新增页面绕过 `dataClient` 或 `/api/v1/*` 契约直接读取原始数据、数据库或临时 JSON。
- 不允许前端组件实现 ETL、主数据归一、跨表匹配、成熟度评分或业务关系推断。

## 全工程前后端分离规则

- 后端负责数据导入、清洗、标准化、匹配、关系生成、评分、校验、导出和页面数据投影。
- 前端负责导航、布局、筛选、交互状态、表格 / 树 / 关系视图展示和用户反馈。
- 所有页面数据优先通过 `/api/v1/*` 本地 API 和 `dataClient` 消费；`public/data/*.json` 仅作为后端生成的离线兼容包或 API 不可用时的 fallback。
- 新增页面、字段、关系或 maturity 能力前，先更新后端契约和文档，再进入前端实现。
- ViewModel 只能做展示层整理，不承担业务事实生成、关系推断、评分和客户评估结论。

## 当前下一步

优先推进 Frontend Baseline 1.0 的三页 Gap Check 和必要校正：

1. 先做只读差距检查，明确页面现状、缺口、风险和涉及文件。
2. 用户确认后，再进入小范围前端实现。
3. 实现时优先复用当前前端、`dataClient`、后端 API / 数据包契约、ViewModel 展示整理和统一组件风格。
4. 若发现数据缺口，记录为数据契约或待确认问题，不在前端临时硬编码业务关系。

## 必读文件

每次开工建议先读：

- `AGENTS.md`
- `CURRENT_STATE.md`
- `docs/00-overview/master-context-restore.md`

按任务类型追加读取：

- 复杂阶段判断：`task_plan.md`
- 当前关键决策和风险：`findings.md`
- 近期执行恢复：`progress.md`
- Frontend Baseline 1.0 相关任务：`docs/04-user-guide/frontend-baseline-1.0-plan.md`
- 前后端分离继续推进：`docs/01-architecture/frontend-backend-separation-closure.md`
- 问题修复或 bug 核对：`docs/06-implementation/open-issues.md`

## 不必默认读取的长文档

以下文件或目录不要每次开工默认读取，只在任务明确相关时读取：

- `task_plan.md` 的完整历史段落
- `docs/05-archive/findings-history/`
- `docs/05-archive/progress-history/`
- `docs/05-archive/context-slimming-2026-05-15/`
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

## 重连处理规则

如果后续再次出现多次对话重连、主控长时间不继续、或上下文恢复明显变慢：

- 先执行只读检查：`git status --short --branch`、`wc -l CURRENT_STATE.md task_plan.md findings.md progress.md AGENTS.md`。
- 不要默认读取 `docs/05-archive/`、`data/exports/` 或大型前端 JSON。
- 优先确认是否有未提交的大型上下文文件、未关闭子 Agent 记录或重复计划文件。
- 先做上下文减负和 Git 收口，再继续业务开发。

## Codex 轻量执行入口

当用户只说“继续执行”“执行”“排查一下”“修一下”时，默认按以下顺序处理：

1. 读取 `CURRENT_STATE.md` 和 `progress.md`，必要时读取 `task_plan.md`、`findings.md`。
2. 执行 `git status --short --branch`，确认当前工作区状态。
3. 如果当前任务明确，继续执行；如果不明确，只问用户 1 个问题。
4. 不默认读取 `docs/05-archive/`、`data/exports/`、`frontend/capability-browser/public/data/*.json`、数据库备份或完整历史日志。
5. 不默认运行全量 `ps -ax`、全量 `git diff`、完整 DOM dump 或长 console log。
6. 前端验证优先使用 `node scripts/frontend_smoke_check.mjs --page <page>`。
7. 数据包检查优先使用 `python3 scripts/data_package_summary.py --package <name>`。
8. 本地服务检查优先使用 `python3 scripts/dev_server_guard.py --status`。
9. 如 `progress.md` 超过 120 行，先归档瘦身；如工作区 diff 很大，建议 checkpoint commit。

详细规则见 `docs/07-governance/codex-performance-workflow.md`。
