# SAPD Wiki 文档治理规则

> 状态：`active / documentation source of truth`
>
> 更新日期：2026-07-28

## 1. 目标

项目文档只保留四种职责：

1. **当前状态**：说明现在做到哪里、剩余什么；
2. **现行合同**：约束代码、数据、安全、交付或用户状态；
3. **操作手册**：告诉维护者和用户怎样执行；
4. **历史证据**：保留已经完成、替代或退役方案的可追溯记录。

同一事实只能有一个当前权威入口。历史文档可以保留，但不得继续指导执行。

## 2. 权威顺序

发生冲突时按以下顺序判断：

1. 当前用户请求；
2. 最近的 `AGENTS.md`；
3. `CURRENT_STATE.md`；
4. `task_plan.md` 中未完成主线；
5. 本文件索引的现行合同和操作手册；
6. 已验证代码、测试和运行行为；
7. completed / historical / retired 文档。

归档文档永远不能覆盖当前代码和当前合同。

## 3. 状态词

非归档文档应在标题后的前 12 行内使用以下状态之一：

| 状态 | 含义 | 能否指导实现 |
|---|---|---|
| `active` | 当前维护入口或操作手册 | 可以 |
| `contract` | 已冻结且仍有效的合同 | 可以 |
| `blocked` | 仍有效，但等待业务裁定或外部条件 | 只能用于说明阻断 |
| `completed` | 阶段已完成，保留验收和恢复证据 | 不作为新计划 |
| `historical` | 仅用于解释历史决策 | 不可以 |
| `retired` | 已被明确替代 | 不可以 |

草案使用 `draft`，但必须说明谁裁定、何时转 active 或何时归档。

## 4. 根目录文件职责

| 文件 | 只允许保留 |
|---|---|
| `CURRENT_STATE.md` | 最近关键状态、保护边界、当前风险和恢复入口 |
| `task_plan.md` | 当前目标、未完成主线、下一步和停止条件 |
| `progress.md` | 最近执行结果和验证摘要 |
| `findings.md` | 长期有效决策、稳定风险和证据入口 |

规则：

- `task_plan.md` 目标不超过 160 行，不再保存完整阶段日志；
- `CURRENT_STATE.md` 超过约 120 行时，应把较早状态按月份移入 `05-archive/`；
- `progress.md` 只保留最近阶段，旧日志按月份归档；
- completed 计划不得继续出现在 `task_plan.md` 的当前主线；
- 详细报告留在专题文档或恢复包，不复制到四个根文件。

## 5. 目录职责

| 目录 | 当前职责 |
|---|---|
| `00-overview/` | 项目愿景、路线和恢复入口 |
| `01-architecture/` | 当前架构、API、安全和机器合同 |
| `02-data-model/` | 当前数据模型、字典和 schema |
| `03-import-etl/` | 导入、审批、ETL 和本地初始化 |
| `04-frontend/` | 当前信息架构和前端方向 |
| `04-user-guide/` | 面向用户的当前使用说明；实现规格逐步迁出 |
| `05-archive/` | 历史、退役、已关闭和被替代材料 |
| `06-implementation/` | 仍在执行或仍有阻断意义的跨模块计划与合同 |
| `07-governance/` | 当前治理和测试规则 |
| `08-maturity/` | 成熟度 V2.1 需求、领域 / 数据 / 模板模型和待裁定项 |
| `09-delivery/` | 当前 App、DMG、Setup、发布和 UAT 入口 |

页面级可执行设计规格仍以
`frontend/design-handoff/implementation-specs/` 为唯一入口。

## 6. 当前核心入口

### 项目状态

- `../CURRENT_STATE.md`
- `../task_plan.md`
- `../progress.md`
- `../findings.md`

### 架构与数据

- `01-architecture/architecture.md`
- `01-architecture/api-field-contract.md`
- `01-architecture/contracts/mcp/`
- `02-data-model/data-model.md`
- `03-import-etl/README.md`
- `03-import-etl/import-approval-idempotency-and-retention-contract.md`

### 前端与用户状态

- `04-frontend/frontend-information-architecture.md`
- `06-implementation/local-data-layout.md`
- `06-implementation/user-database-governance-and-stable-key-design.md`
- `frontend/design-handoff/implementation-specs/`

### 治理与测试

- `07-governance/governance-index.md`
- `07-governance/data-governance.md`
- `07-governance/project-test-workflow-and-case-matrix.md`
- `06-implementation/open-issues.md`

### 成熟度

- `08-maturity/requirements.md`
- `08-maturity/maturity-domain-model.md`
- `08-maturity/maturity-data-model.md`
- `08-maturity/maturity-template-mapping.md`
- `08-maturity/assessment-rubric-dictionary-mapping-audit-2026-07-17.md`
- `08-maturity/assessment-rubric-source-appendix-2026-07-17.md`

### 交付

- `09-delivery/desktop-packaging-runbook.md`
- `09-delivery/mac-dmg-browser-parity-contract.md`
- `09-delivery/release-acceptance-matrix-0.1.md`
- `09-delivery/windows-github-installer-migration-plan-2026-07-27.md`

## 7. 归档规则

满足任一条件即可归档：

- 已被新的合同或操作手册替代；
- 阶段已完成，内容主要是执行过程；
- 依赖已删除的分支、任务、工具或打包链路；
- 只描述一次性评审、试验、截图或旧版本；
- 与当前入口重复，且没有独立长期合同价值。

归档时：

1. 移入 `05-archive/<主题>/`；
2. 文件顶部标明 `historical` 或 `retired`；
3. 更新当前索引和仍需保留的引用；
4. 不删除审计结论、恢复命令和来源证据；
5. 不把归档材料继续列为“当前优先阅读”。

## 8. 新增和更新规则

新增文档前必须回答：

- 读者是谁；
- 它解决哪个长期问题；
- 为什么不能更新现有入口；
- 由哪个索引负责发现；
- 完成或被替代后归档到哪里。

以下情况不新增文档：

- 单页小修、文案或样式；
- 一次性排查和命令日志；
- 已能写进 `progress.md` 的验证结果；
- 没有负责人、状态和退役条件的构想。

更新现行合同后，应同步：

- 对应代码或测试；
- `docs/README.md` 或专题索引；
- 必要时的 `CURRENT_STATE.md` / `task_plan.md`；
- 受影响的历史入口状态。

## 9. 验收

文档治理变更至少运行：

```bash
node scripts/audit_document_governance.mjs
git diff --check -- <文档文件>
python3 scripts/check_github_data_boundary.py
```

验收重点：

- 当前入口不指向已移动文件；
- 退役流程不会被误认为生产流程；
- 根计划只含未完成事项；
- 归档不改变正式数据、用户库和运行代码；
- 不把本地数据、备份或构建产物加入 Git。
