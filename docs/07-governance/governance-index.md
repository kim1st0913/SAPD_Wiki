# SAPD Wiki 治理入口

> 状态：`active`
>
> 更新日期：2026-07-27

本页只索引当前仍执行的治理规则。文档生命周期和归档规则见
[`../DOCUMENT_GOVERNANCE.md`](../DOCUMENT_GOVERNANCE.md)。

## 当前治理文件

| 文档 | 当前职责 |
|---|---|
| [`data-governance.md`](data-governance.md) | 正式数据、GitHub 数据边界、生成包和来源证据规则 |
| [`capability-mapping-change-control.md`](capability-mapping-change-control.md) | 安全能力映射页变更分级、暂停条件和验收门槛 |
| [`project-test-workflow-and-case-matrix.md`](project-test-workflow-and-case-matrix.md) | quick、pre-commit、pre-DMG、release 等分层测试入口 |
| [`codex-performance-workflow.md`](codex-performance-workflow.md) | Codex 轻量开发、验证摘要和上下文控制 |
| [`../06-implementation/open-issues.md`](../06-implementation/open-issues.md) | 当前未关闭的跨模块、数据、安全、发布和待裁定问题 |
| [`../06-implementation/open-issues-index.md`](../06-implementation/open-issues-index.md) | Open Issues 全量索引 |

已停用的固定执行线、task ID、fan-in 和旧多会话机制已经移入
`docs/05-archive/governance-retired-2026-07/`；历史 backlog 排序快照也从该目录进入。

## 轻治理原则

- 小修、小页面调整和一次性排查不新增治理文档；
- 数据、安全、用户状态、跨模块合同和发布边界才建立长期规则；
- 当前事实进入 `CURRENT_STATE.md`，未完成工作进入 `task_plan.md`；
- 执行结果进入 `progress.md`，长期决策进入 `findings.md`；
- 已完成阶段、旧任务台账和被替代流程进入 `docs/05-archive/`；
- 页面实现只使用 active implementation spec，不直接使用 Stitch / 截图 / 历史 brief。

## Issue 建立门槛

以下情况才建立或保留 Open Issue：

- 影响多个页面、模块或数据域；
- 涉及正式 SQLite、源 Excel、用户写入、安全或 GitHub 边界；
- 属于 App / DMG / Windows release blocker；
- 需要业务裁定或人工验收；
- 本轮无法完成，或需要长期防回归。

单页文案、样式、小交互和本轮能完成的小修，直接修复并记录验证，不建立长期 Issue。

## 测试与交付

常用入口：

```bash
node scripts/run_project_test_suite.mjs --suite quick
node scripts/run_project_test_suite.mjs --suite pre-commit
node scripts/run_project_test_suite.mjs --suite pre-dmg --url http://127.0.0.1:5173
node scripts/audit_document_governance.mjs
python3 scripts/check_github_data_boundary.py
```

真实 App、DMG、Setup 和用户数据边界仍按各自交付手册验收；5173 通过不能替代实包
验收。

## 当前不做

- 不恢复固定执行线或把 task ID 当作项目事实源；
- 不为每个模块建立一套重复的治理文件；
- 不把历史报告重新放回当前导航；
- 不用文档声明替代代码、测试或真实运行证据；
- 不因整理文档删除数据、恢复包、用户库或构建证据。
