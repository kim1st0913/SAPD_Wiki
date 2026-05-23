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

这些文档主要用于记录某个标准、PDF、原始表或映射关系的历史核对结论。它们是重要证据，但不一定都是当前导入规则入口。

| 文档 | 用途 |
|---|---|
| `cis-controls-v8.1-vs-v8.1.2-comparison.md` | CIS v8.1 与 v8.1.2 差异核对 |
| `cis-controls-v8.1.2-vs-raw-cis-csc-v8-comparison.md` | CIS v8.1.2 与原始 Sheet 核对 |
| `csf-2.0-raw-sheet-content-confirmation.md` | CSF 2.0 原始 Sheet 内容确认 |
| `csf-2.0-translation-review-and-import-notes.md` | CSF 2.0 翻译与导入说明 |
| `gbt22239-2019-level3-vs-raw-debao3-check.md` | 等保三级原始资料核对 |
| `iso27001-2022-vs-pdf-check.md` | ISO 27001:2022 与 PDF 核对 |
| `iso27002-2022-attributes-vs-raw-27001-check.md` | ISO 27002 属性与原始 27001 Sheet 核对 |
| `nist-800-53rev5-vs-raw-check.md` | NIST SP 800-53 Rev.5 与原始表核对 |
| `standard-framework-mapping-semantic-review-2026-05-20.md` | 标准 / 框架映射语义核对 |
| `crf-2026-import-projection-notes.md` | CRF 2026 导入投影说明 |
| `crf-2026-unmapped-candidate-focus-2026-05-20.md` | CRF 2026 未映射候选关注点 |

## 维护方式

- 新增文档时只在对应表格补一行。
- 规则正文写入具体专题文档，不在本索引重复展开。
