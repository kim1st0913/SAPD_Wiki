# 文档导航

本文档是 `docs/` 的总入口。原则是：先按场景找入口，不从目录树逐个翻。

## 日常读取规则

默认只读：

1. `../CURRENT_STATE.md`
2. `../progress.md`
3. 本轮任务直接相关的 1-3 个文档

不要默认读取 `05-archive/`、长历史、导出包记录或大型数据说明。需要追溯时再按索引进入。

## 新增文档规则

当前文档已经偏重，默认不为小修、小 bug、一次性排查或临时方案新增文档。

新增文档前先判断：

- 能否写入现有入口；
- 是否是跨模块稳定契约、用户交付说明、数据 / 安全 / 审计边界；
- 是否需要长期维护；
- 是否有清晰索引和退役条件。

不满足上述条件时，只更新 `progress.md`、必要时更新 `CURRENT_STATE.md` 或相关现有文档。

## 只想了解项目现状

优先看：

1. `../CURRENT_STATE.md`
2. `../progress.md`
3. `00-overview/project-roadmap.md`
4. `06-implementation/open-issues.md`

## 要理解顾问端交付方式

优先看：

1. `01-architecture/consultant-delivery-model.md`
2. `06-implementation/local-data-layout.md`
3. `03-import-etl/github-local-data-initialization.md`
4. `09-delivery/mac-dmg-browser-parity-contract.md`

## 要做本地 MCP

优先看：

1. `01-architecture/sapd-wiki-local-mcp-requirements-and-prd-v0.5.md`
2. `06-implementation/local-mcp-m0t-t0-t2-execution-plan.md`
3. `07-governance/approvals/local-mcp-m0t-t0-t2-approval-2026-07-23.md`
4. `01-architecture/contracts/mcp/`（T0 开始后生成）

当前仅授权隔离的 G0 与 T0–T2。不得据此进入 T3、D0、M1、真实数据、用户数据、App integration 或 packaging。

## 要做测试、回归或发布前验收

优先看：

1. `07-governance/project-test-workflow-and-case-matrix.md`
2. `../scripts/README.md`
3. `09-delivery/mac-dmg-browser-parity-contract.md`

## 要从 GitHub 拉代码并初始化本地数据

优先看：

1. `03-import-etl/github-local-data-initialization.md`
2. `../scripts/README.md`
3. `07-governance/data-governance.md`

## 要做导入、ETL 或 Sheet 建模

优先看：

1. `03-import-etl/README.md`
2. `03-import-etl/import-rules.md`
3. `03-import-etl/completed-sheet-business-confirmation.md`
4. `02-data-model/data-model.md`

## 要做前端页面或数据契约

优先看：

1. `01-architecture/backend-interface-design.md`
2. `01-architecture/api-field-contract.md`
3. `01-architecture/frontend-json-data-package-inventory.md`
4. `04-frontend/frontend-information-architecture.md`

## 要查设计文档或继续前端设计

优先看：

1. `04-frontend/frontend-information-architecture.md`
2. `04-frontend/frontend-redesign-brief.md`
3. `06-implementation/frontend-global-design-baseline-2026-05-30.md`
4. `06-implementation/frontend-display-design-principles-2026-05-30.md`
5. `../frontend/design-handoff/README.md`
6. `../frontend/design-handoff/implementation-specs/`

设计文档按用途分层，不从文件名相似度随便选：

- `frontend/design-handoff/implementation-specs/` 是页面实现规格入口，只有这里的 active spec 可以作为代码实现依据。
- `frontend/design-handoff/stitch-*` 是 Stitch / Product Design 原始交接或参考材料，不能直接作为代码实现依据，必须先转成 implementation spec。
- `docs/06-implementation/*design*`、`*baseline*`、`*contract*` 只承载跨页面稳定设计规则、全局交互契约或已经验收的专题设计结论。
- `docs/04-frontend/` 只保留当前信息架构和前端设计 brief，不继续堆页面级细节。
- `docs/09-delivery/` 只放交付、打包、首次启动、诊断和用户交付体验，不放普通前端页面设计。

小 UI 调整、文案、单页局部样式和一次性截图反馈默认不新增设计文档；直接修改代码并在 `progress.md` 和任务完成反馈里说明验收入口。

## 要查历史

优先看：

1. `05-archive/progress-history/2026-05.md`
2. `05-archive/findings-history/2026-05.md`
3. `05-archive/document-retirement-2026-05/README.md`

历史归档只在需要追溯过程时读取，不作为日常开工入口。
