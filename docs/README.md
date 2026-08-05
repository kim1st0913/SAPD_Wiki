# SAPD Wiki 文档导航

> 状态：`active / primary documentation index`
>
> 更新日期：2026-07-28

从场景进入，不按目录逐个阅读。历史文件只用于追溯，不能覆盖当前合同和代码。

## 先看什么

日常恢复只读：

1. [`CURRENT_STATE.md`](../CURRENT_STATE.md)
2. [`task_plan.md`](../task_plan.md)
3. 本轮直接相关的 1—3 份专题文档

需要最近执行证据时再看 [`progress.md`](../progress.md)；需要长期决策时看
[`findings.md`](../findings.md)。

文档状态、归档和新增规则见
[`DOCUMENT_GOVERNANCE.md`](DOCUMENT_GOVERNANCE.md)。

## 按场景进入

### 项目现状和路线

- [`CURRENT_STATE.md`](../CURRENT_STATE.md)：当前实现、风险和恢复入口
- [`task_plan.md`](../task_plan.md)：未完成主线和下一步
- [`00-overview/project-vision.md`](00-overview/project-vision.md)：当前产品定位、业务版图和产品原则
- [`00-overview/project-roadmap.md`](00-overview/project-roadmap.md)：面向用户的路线说明
- [`06-implementation/open-issues.md`](06-implementation/open-issues.md)：仍未关闭的问题

### 架构、API 和 MCP

- [`01-architecture/architecture.md`](01-architecture/architecture.md)
- [`01-architecture/api-field-contract.md`](01-architecture/api-field-contract.md)
- [`01-architecture/sapd-wiki-local-mcp-requirements-and-prd-v0.5.md`](01-architecture/sapd-wiki-local-mcp-requirements-and-prd-v0.5.md)
- [`01-architecture/sapd-wiki-local-mcp-certificate-and-trust-management-design-v1.md`](01-architecture/sapd-wiki-local-mcp-certificate-and-trust-management-design-v1.md)
- [`01-architecture/contracts/mcp/`](01-architecture/contracts/mcp/)

### 数据、导入和 ETL

- [`02-data-model/data-model.md`](02-data-model/data-model.md)
- [`03-import-etl/README.md`](03-import-etl/README.md)
- [`03-import-etl/import-rules.md`](03-import-etl/import-rules.md)
- [`03-import-etl/mapping-rules.md`](03-import-etl/mapping-rules.md)
- [`03-import-etl/import-approval-idempotency-and-retention-contract.md`](03-import-etl/import-approval-idempotency-and-retention-contract.md)
- [`03-import-etl/completed-sheet-business-confirmation.md`](03-import-etl/completed-sheet-business-confirmation.md)
- [`03-import-etl/github-local-data-initialization.md`](03-import-etl/github-local-data-initialization.md)
- [`07-governance/data-governance.md`](07-governance/data-governance.md)

### 前端和用户状态

- [`04-frontend/frontend-information-architecture.md`](04-frontend/frontend-information-architecture.md)
- [`04-user-guide/user-guide.md`](04-user-guide/user-guide.md)
- [`06-implementation/frontend-global-design-baseline-2026-05-30.md`](06-implementation/frontend-global-design-baseline-2026-05-30.md)
- [`06-implementation/local-data-layout.md`](06-implementation/local-data-layout.md)
- [`06-implementation/user-database-governance-and-stable-key-design.md`](06-implementation/user-database-governance-and-stable-key-design.md)
- [`frontend/design-handoff/implementation-specs/`](../frontend/design-handoff/implementation-specs/)

页面代码只能直接采用 `implementation-specs/` 中标记为 active /
implementation-source 的规格。Stitch 输出、截图和旧 brief 只是参考。

### 成熟度

- [`08-maturity/requirements.md`](08-maturity/requirements.md)
- [`08-maturity/maturity-domain-model.md`](08-maturity/maturity-domain-model.md)
- [`08-maturity/maturity-data-model.md`](08-maturity/maturity-data-model.md)
- [`08-maturity/maturity-template-mapping.md`](08-maturity/maturity-template-mapping.md)
- [`08-maturity/assessment-rubric-dictionary-mapping-audit-2026-07-17.md`](08-maturity/assessment-rubric-dictionary-mapping-audit-2026-07-17.md)
- [`08-maturity/assessment-rubric-source-appendix-2026-07-17.md`](08-maturity/assessment-rubric-source-appendix-2026-07-17.md)

当前 OI-197 的 15 项业务裁定未完成前，不得把候选 Rubric 写入正式字典或评分规则。

### 测试和治理

- [`07-governance/governance-index.md`](07-governance/governance-index.md)
- [`07-governance/project-test-workflow-and-case-matrix.md`](07-governance/project-test-workflow-and-case-matrix.md)
- [`scripts/README.md`](../scripts/README.md)
- [`06-implementation/open-issues.md`](06-implementation/open-issues.md)

### macOS / Windows 打包和发布

- [`09-delivery/packaging-directory-map.md`](09-delivery/packaging-directory-map.md)
- [`09-delivery/desktop-packaging-runbook.md`](09-delivery/desktop-packaging-runbook.md)
- [`09-delivery/mac-dmg-browser-parity-contract.md`](09-delivery/mac-dmg-browser-parity-contract.md)
- [`09-delivery/release-acceptance-matrix-0.1.md`](09-delivery/release-acceptance-matrix-0.1.md)
- [`09-delivery/windows-github-installer-migration-plan-2026-07-27.md`](09-delivery/windows-github-installer-migration-plan-2026-07-27.md)

Windows 当前使用公开 `main` 精确 SHA + 私有 Delivery Data + 私有 Windows Runner；
macOS 继续在正式 Mac 主工作区本地生成 DMG。历史 DMG 仅代表其构建快照，新包必须
从当前源码重建并通过实包门禁。

## 历史材料

历史和退役材料统一从 [`05-archive/README.md`](05-archive/README.md) 进入。

以下内容不得作为当前执行依据：

- 已删除分支和旧 worktree 流程；
- Windows backend-only + Mac 手工组装安装器流程；
- ZIP alpha 试发流程；
- 已停用的固定执行线 / task ID 台账；
- 已完成阶段计划、旧截图和被替代设计稿。

## 新增文档前

优先更新现有入口。只有跨模块合同、数据 / 安全 / 发布边界、长期操作手册或用户
独立交付物才新增文档。

新文档必须包含：

- 状态；
- 目标读者；
- 权威来源；
- 验收或维护方式；
- 完成、替代或退役后的归档条件。
