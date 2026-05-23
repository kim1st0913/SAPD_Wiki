# 技术选型记录

本文档集中记录当前技术选型，避免在多个文档中各自维护不同版本。

## V1 默认选型

| 层次 | 选型 | 原因 |
|---|---|---|
| 前端 | React + TypeScript | 生态成熟，适合逐步扩展知识库页面 |
| 桌面壳 | Tauri | 适合轻量本地桌面交付 |
| 本地数据库 | SQLite | 单机可靠、易备份、易迁移 |
| 全文检索 | SQLite FTS5 | V1 足够，减少额外组件 |
| ETL | Python 或 Node.js | 适合处理 Excel、DOCX、PPT、Markdown 等文件 |
| 文件存储 | 本地 data 目录 | 保留原始文件和预览文件 |
| 导出 | CSV、JSON、Excel、Markdown、HTML、ZIP | 覆盖常见知识复用和备份需求 |

## V1 顾问端交付决策

第一期面向咨询顾问的交付形态不是开发环境，也不是让顾问自行导入数据的工具。

| 决策 | 当前结论 |
|---|---|
| 交付方式 | 压缩包交付，用户解压后打开应用 |
| 首次使用 | 应用内提供“一键初始化”，自动部署预置数据库和资源 |
| 数据来源 | 由内部维护流程提前完成 ETL、审批、校验和发布构建 |
| 顾问端数据库 | 初始化后使用 `<app_data_dir>/SAPD_Wiki/database/sapd_wiki.sqlite3` |
| 程序包内置数据 | 使用发布种子库和资源包，例如 `resources/database/sapd_wiki.seed.sqlite3` |
| 登录需求 | V1 不做登录、注册、账号和权限体系 |
| 顾问端导入 | V1 不提供顾问自行导入 Excel / PDF / PPT / DOCX 的入口 |
| 开发依赖 | 顾问无需安装 Python、Node.js、SQLite CLI 或其他开发工具 |

详细交付模型见 `docs/01-architecture/consultant-delivery-model.md`。

## 后续可选增强

| 能力 | 建议阶段 | 说明 |
|---|---|---|
| DuckDB | V2/V3 | 用于更复杂分析查询 |
| Draw.io 深度解析 | V2 | 节点、连线和关系抽取 |
| PPT 深度解析 | V2 | 页级、备注、图形元素结构化 |
| 知识图谱 | V2/V3 | 在关系数据稳定后引入 |
| RAG/AI 问答 | V3 | 在结构化和来源追踪稳定后引入 |
