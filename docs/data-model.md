# 数据模型设计

本文档是 Phase 3 的占位文档。详细 SQLite schema、迁移脚本和字段说明，需要在 Phase 1 的知识对象、字段字典和映射规则稳定后生成。

当前权威输入：

- `docs/data-definition-guide.md`
- `docs/data-dictionary-template.md`
- `docs/import-rules.md`
- `docs/sample-file-inventory.md`
- `task_plan.md`

## 当前原则

- 不在字段字典稳定前提前固化完整数据库表。
- 所有正式知识记录必须保留来源追踪。
- 自动导入数据先进入 staging，再经人工审查进入正式表。
- 数据模型必须支持 `source_file_id`、`source_location`、`import_job_id`、`change_log` 和版本记录。

## 计划输出

Phase 3 将补充：

- SQLite 逻辑模型；
- 通用表说明；
- 扩展对象表说明；
- staging 表说明；
- FTS 全文索引说明；
- migration SQL 文件清单。

