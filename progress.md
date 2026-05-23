# progress.md

本文件是当前会话恢复入口，只保留最近状态、最近完成事项、关键验证和历史索引。完整执行历史已归档到 `docs/05-archive/progress-history/2026-05.md`。

## 当前状态（2026-05-23）

- 当前分支：`codex-frontend-backend-separation-closure`。
- 当前主线：Phase 5 知识浏览与搜索 / 关系化前端工作台校正；重点仍是已导入 Sheet 的业务语义复核、前端关系展示校正、数据契约治理和员工端字段边界收口。
- Frontend Baseline 1.0 当前仍以三页为核心：`安全能力映射`、`LC-AP开发安全生命周期`、`信息化环境维度`；不默认启动 Phase 7 多格式增强、maturity M1、新 Sheet 扩展、schema 重构或 React / Vue 重构。
- GitHub 数据边界已接入本地脚本和 CI：原始数据、SQLite、导出包、前端生成 JSON、指南 / 标准生成资源不得提交。
- 当前待确认问题：`OI-073`。源 Sheet `作用域-安全技术服务-安全技术模块映射` 仍有 5 行 G 列旧值 `网络数据防泄露`，是否统一改为 `数据流转监测和泄漏防护` 待用户确认。
- 当前工作区存在未提交改动，包含安全知识表格字段收口、治理说明和本轮结构治理文件；继续开发前建议 checkpoint commit。

## 最近完成事项

### 2026-05-23 轻量项目结构治理

- 已完成只读结构体检，确认当前适合做轻量治理，不建议做大规模目录搬迁、React / Vue 重构或大拆 `app.js` / `styles.css`。
- 已新增 `scripts/README.md`，把脚本分为长期工具和专题脚本，明确新增脚本登记规则。
- 已新增 `docs/03-import-etl/README.md`，为导入规则、数据契约、业务复核和标准 / 框架核对报告建立索引。
- 已按“一个地方讲完整，其它地方只做入口索引”的原则压缩重复说明，避免 `README`、治理文档、脚本索引和初始化说明同质化。
- 已新增 `docs/README.md` 作为文档总导航，按项目现状、顾问端交付、GitHub 初始化、ETL、前端契约和历史追溯分场景给入口。
- 已将根目录 `progress.md` 瘦身为轻量恢复入口，长历史归档到 `docs/05-archive/progress-history/2026-05.md`。

### 2026-05-23 安全知识表格字段收口

- 已按“只展示原始业务字段”收口参考目录：`GB/T 42446-2023` 主表只展示 `工作类别`、`承担的工作任务`，`Gartner 工作岗位参考` 主表只展示 `分类`、`角色`、`描述`。
- `maintenance-knowledge.json` 已回填 27 条 GB/T 工作类别和 28 条 Gartner 分类，并按原始表行号排序。
- 已将 `GB/T 42446-2023` 按 `工作类别`、`Gartner 工作岗位参考` 按 `分类` 做归纳展开；默认展开第一组，组行显示条数；已收紧参考页 section 布局和组行高度，避免标题与表格之间出现大空白。
- 本轮未修改原始 Excel、schema 或数据库结构；涉及前端展示组件、样式、数据导出投影、页面字段契约和治理文档。

### 2026-05-23 GitHub 数据不同步与本地一键初始化

- 已将本地一键数据初始化收敛为主 CLI 子命令 `python scripts/sapd_wiki.py bootstrap-local-data`，不再保留独立 `scripts/bootstrap_local_data.py` 入口。
- 已新增 `scripts/check_github_data_boundary.py` 和 `.github/workflows/data-boundary.yml`，用于本地和 GitHub CI 检查是否误追踪原始数据、SQLite、导出包或生成数据。
- 已新增 `docs/03-import-etl/github-local-data-initialization.md`，明确 GitHub 拉取后需要放哪些文件、放到哪个目录、执行哪个初始化命令，以及哪些本地数据永不同步。

## 最近验证

- `python3 scripts/check_github_data_boundary.py`：通过，当前 Git 未追踪原始数据、数据库、导出包或前端生成数据。
- `python3 -m py_compile scripts/sapd_wiki.py src/sapd_wiki/cli.py scripts/check_github_data_boundary.py`：通过。
- `python3 scripts/sapd_wiki.py bootstrap-local-data --print-inputs` 与 `--help`：通过，主 CLI 一键初始化子命令可用。
- 结构治理行数检查通过：`progress.md` 已从 117 行瘦身到 61 行；新增 `scripts/README.md` 33 行，`docs/03-import-etl/README.md` 48 行。
- 参考目录原始字段复核通过：本地 API `/api/v1/data-packages/maintenance` 返回 `gbt_42446_references=27` 且 `category_non_empty=27`，`gartner_roles=28` 且 `category_non_empty=28`；页面 smoke `/knowledge/gbt-42446`、`/knowledge/role-references` 通过。
- 参考目录分组 DOM 复核通过：GB/T 组为 `网络安全管理 6 项工作任务` 等，Gartner 组为 `安全和风险管理 (SRM) 领导者 10 个角色` 等；标题到表格间距约 8px，首组可折叠，`bodyOverflowX=0`。
- `node --check frontend/capability-browser/dataClient.js`、`node --check frontend/capability-browser/app.js`、`node --check scripts/frontend_smoke_check.mjs`：通过。
- `python3 -m py_compile src/sapd_wiki/exports.py src/sapd_wiki/cli.py src/sapd_wiki/api_server.py scripts/data_package_summary.py scripts/dev_server_guard.py`：通过。
- `git diff --check`：通过。

## 历史索引

| 归档文件 | 内容 |
|---|---|
| `docs/05-archive/progress-history/2026-05.md` | 2026-05 完整执行记录、根目录 `progress.md` 瘦身快照和本轮轻量结构治理记录 |
| `docs/05-archive/findings-history/2026-05.md` | 2026-05 历史发现 |
| `docs/05-archive/context-slimming-2026-05-15/` | 2026-05-15 上下文瘦身快照 |

## 维护规则

- 本文件只保留最近 1-3 次重要执行和当前恢复信息。
- 超过 120 行时继续归档到 `docs/05-archive/`。
- 详细过程、长命令输出和阶段性历史不写入根目录 `progress.md`。
