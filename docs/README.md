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

## 要查历史

优先看：

1. `05-archive/progress-history/2026-05.md`
2. `05-archive/findings-history/2026-05.md`
3. `05-archive/document-retirement-2026-05/README.md`

历史归档只在需要追溯过程时读取，不作为日常开工入口。
