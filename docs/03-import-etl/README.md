# 导入与 ETL 文档索引

本目录索引原始资料盘点、Sheet 业务确认、字段映射、导入规则、数据契约和历史核对报告。本文档只做入口，不重复各文档正文。

## 当前有效入口

| 文档 | 用途 |
|---|---|
| `github-local-data-initialization.md` | GitHub 拉代码后的本地文件放置、一键数据初始化和生成数据不同步边界 |
| `import-rules.md` | 通用导入、字段映射、ETL 和更新规则 |
| `sample-file-inventory.md` | 知识资产和样例文件盘点 |
| `completed-sheet-business-confirmation.md` | 已完成业务确认的 Sheet 清单 |
| `mapping-rules-draft.md` | 第一批核心 Sheet 映射规则草案 |
| `excel-import-mvp-design.md` | Excel 导入 MVP 设计 |
| `remaining-21-sheets-modeling.md` | 剩余 Sheet 建模草案 |

## 数据契约与批次说明

| 文档 | 用途 |
|---|---|
| `second-batch-data-contract.md` | 第二批数据契约 |
| `third-batch-data-contract.md` | 第三批数据契约 |
| `core-sheet-business-review.md` | 核心 Sheet 业务复核 |
| `second-batch-business-review.md` | 第二批业务复核 |
| `import-warning-review.md` | 导入 warning 审查说明 |

## 标准 / 框架核对报告

标准 / 框架、PDF、原始表和映射关系的一次性历史核对报告已退役到：

- `../05-archive/document-retirement-2026-05/03-import-etl/`

这些报告只在追溯历史证据时读取，不再作为当前导入规则入口。

## 维护方式

- 新增文档时只在对应表格补一行。
- 规则正文写入具体专题文档，不在本索引重复展开。
