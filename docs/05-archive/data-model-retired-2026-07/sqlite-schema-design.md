# SQLite Schema 设计草案

> 归档状态：`retired / superseded schema draft`。当前 schema 以 `db/migrations/`、
> `src/sapd_wiki/` 和运行审计为准。

本文档把第一版逻辑数据模型转成 SQLite 表结构设计草案，并已生成对应 migration SQL。

实际迁移脚本位于：

- `db/migrations/001_init_core.sql`
- `db/migrations/002_source_tracking.sql`
- `db/migrations/003_staging_review.sql`
- `db/migrations/004_search.sql`
- `db/migrations/005_guides_diagrams.sql`

本地校验结果：5 个 migration 已在临时 SQLite 数据库中顺序执行通过。

## 1. 设计目标

第一版数据库要先支撑 5 件事：

1. 登记来源文件；
2. 记录导入任务；
3. 保存正式知识对象和关系；
4. 保存来源追踪；
5. 支持 Excel 导入预览、人工审查和正式入库。

V1 不追求为每种知识对象建立专用表。统一对象表先跑通主流程，后续等 26 个 Sheet 都稳定后再决定是否拆表。

## 2. 表优先级

| 表名 | 优先级 | 是否 V1 必须 | 作用 |
|---|---|---|---|
| source_files | P0 | 是 | 来源文件 |
| import_jobs | P0 | 是 | 导入任务 |
| knowledge_items | P0 | 是 | 正式知识对象 |
| knowledge_relations | P0 | 是 | 正式知识关系 |
| source_references | P0 | 是 | 来源追踪 |
| staging_items | P0 | 是 | 导入预览对象 |
| staging_relations | P0 | 是 | 导入预览关系 |
| item_aliases | P1 | 建议 | 别名和标准化 |
| review_decisions | P1 | 建议 | 人工审查记录 |
| change_logs | P1 | 建议 | 正式数据变更记录 |
| app_settings | P1 | 建议 | 本地配置 |
| guide_pages | P2 | 后续 | PPT 使用说明页 |
| diagram_views | P2 | 后续 | Draw.io 视图 |

## 3. 命名约定

| 类型 | 约定 |
|---|---|
| 表名 | 小写复数，如 `knowledge_items` |
| 主键 | `id`，文本 UUID |
| 时间字段 | ISO 字符串，如 `created_at`、`updated_at` |
| JSON 字段 | 后缀 `_json` |
| 状态字段 | 使用小写枚举文本 |
| 软删除 | 用 `status` 或 `deleted_at`，不直接物理删除 |

## 4. P0 表设计

### 4.1 source_files

记录原始文件和展示文件。

| 字段 | 类型 | 必填 | 索引 | 说明 |
|---|---|---|---|---|
| id | text | 是 | PK | 文件 ID |
| file_name | text | 是 | 是 | 文件名 |
| file_type | text | 是 | 是 | xlsx、pptx、drawio 等 |
| file_path | text | 是 | 否 | 受控相对路径 |
| file_hash | text | 是 | unique | 文件 hash |
| file_size | integer | 否 | 否 | 文件大小 |
| usage_policy | text | 是 | 是 | import_source、guide、view_only、attachment |
| sensitive_level | text | 是 | 是 | unknown、internal、public、confidential |
| status | text | 是 | 是 | active、archived、missing |
| created_at | text | 是 | 否 | 创建时间 |
| updated_at | text | 是 | 否 | 更新时间 |

建议约束：

- `file_hash` 唯一；
- `file_type` 使用枚举校验；
- `usage_policy` 使用枚举校验。

### 4.2 import_jobs

记录导入过程。

| 字段 | 类型 | 必填 | 索引 | 说明 |
|---|---|---|---|---|
| id | text | 是 | PK | 导入任务 ID |
| source_file_id | text | 是 | FK | 来源文件 |
| job_type | text | 是 | 是 | initial_import、reimport、batch_import |
| status | text | 是 | 是 | pending、parsed、reviewing、approved、rejected、failed |
| started_at | text | 是 | 否 | 开始时间 |
| finished_at | text | 否 | 否 | 完成时间 |
| summary_json | text | 否 | 否 | 导入统计 |
| error_json | text | 否 | 否 | 错误摘要 |

关系：

- `import_jobs.source_file_id` -> `source_files.id`

### 4.3 knowledge_items

正式知识对象统一表。

| 字段 | 类型 | 必填 | 索引 | 说明 |
|---|---|---|---|---|
| id | text | 是 | PK | 对象 ID |
| type | text | 是 | 是 | 对象类型 |
| code | text | 否 | 是 | 业务编号 |
| title | text | 是 | 是 | 名称 |
| description | text | 否 | FTS | 描述 |
| category | text | 否 | 是 | 分类 |
| status | text | 是 | 是 | draft、active、deprecated |
| parent_id | text | 否 | 是 | 上级对象 |
| source_file_id | text | 否 | 是 | 首次来源文件 |
| source_hash | text | 否 | 否 | 首次来源 hash |
| metadata_json | text | 否 | 否 | 扩展字段 |
| created_at | text | 是 | 否 | 创建时间 |
| updated_at | text | 是 | 否 | 更新时间 |

建议索引：

- `(type, code)`；
- `(type, title)`；
- `(parent_id)`；
- `(status)`。

去重策略：

- 有 `code` 的对象优先用 `type + code` 匹配；
- 没有 `code` 的对象用 `type + title` 或规则指定的组合键匹配；
- 不建议直接对 `(type, title)` 建唯一约束，因为同名对象可能属于不同场景。

### 4.4 knowledge_relations

正式知识关系表。

| 字段 | 类型 | 必填 | 索引 | 说明 |
|---|---|---|---|---|
| id | text | 是 | PK | 关系 ID |
| source_item_id | text | 是 | 是 | 起点对象 |
| target_item_id | text | 是 | 是 | 终点对象 |
| relation_type | text | 是 | 是 | 关系类型 |
| relation_label | text | 否 | 否 | 中文显示 |
| confidence | text | 是 | 是 | exact、inferred、manual |
| source_file_id | text | 否 | 是 | 来源文件 |
| import_job_id | text | 否 | 是 | 导入任务 |
| metadata_json | text | 否 | 否 | 扩展字段 |
| created_at | text | 是 | 否 | 创建时间 |
| updated_at | text | 是 | 否 | 更新时间 |

建议索引：

- `(source_item_id, relation_type)`；
- `(target_item_id, relation_type)`；
- `(source_item_id, relation_type, target_item_id)`。

建议唯一策略：

- 同一来源导入时，`source_item_id + relation_type + target_item_id + source_file_id + import_job_id` 不重复；
- 跨来源可以产生相同关系，但要通过 `source_references` 保留多个证据。

### 4.5 source_references

记录对象或关系的来源。

| 字段 | 类型 | 必填 | 索引 | 说明 |
|---|---|---|---|---|
| id | text | 是 | PK | 来源引用 ID |
| target_type | text | 是 | 是 | item、relation |
| target_id | text | 是 | 是 | 对象或关系 ID |
| source_file_id | text | 是 | 是 | 来源文件 |
| source_sheet | text | 否 | 是 | Sheet 名 |
| source_row | integer | 否 | 是 | 行号 |
| source_column | text | 否 | 否 | 列名或列号 |
| source_cell | text | 否 | 否 | 单元格位置 |
| raw_value | text | 否 | 否 | 原始值 |
| source_hash | text | 是 | 否 | 当时文件 hash |
| created_at | text | 是 | 否 | 创建时间 |

建议索引：

- `(target_type, target_id)`；
- `(source_file_id, source_sheet, source_row)`。

### 4.6 staging_items

导入预览对象表。

| 字段 | 类型 | 必填 | 索引 | 说明 |
|---|---|---|---|---|
| id | text | 是 | PK | 暂存对象 ID |
| import_job_id | text | 是 | 是 | 导入任务 |
| proposed_action | text | 是 | 是 | create、update、skip、conflict |
| matched_item_id | text | 否 | 是 | 匹配到的正式对象 |
| type | text | 是 | 是 | 对象类型 |
| code | text | 否 | 是 | 业务编号 |
| title | text | 是 | 是 | 名称 |
| description | text | 否 | 否 | 描述 |
| metadata_json | text | 否 | 否 | 扩展字段 |
| source_reference_json | text | 是 | 否 | 来源信息 |
| validation_status | text | 是 | 是 | ok、warning、error |
| validation_message | text | 否 | 否 | 校验说明 |
| created_at | text | 是 | 否 | 创建时间 |

### 4.7 staging_relations

导入预览关系表。

| 字段 | 类型 | 必填 | 索引 | 说明 |
|---|---|---|---|---|
| id | text | 是 | PK | 暂存关系 ID |
| import_job_id | text | 是 | 是 | 导入任务 |
| proposed_action | text | 是 | 是 | create、update、skip、conflict |
| matched_relation_id | text | 否 | 是 | 匹配到的正式关系 |
| source_item_key | text | 是 | 是 | 起点对象匹配键 |
| target_item_key | text | 是 | 是 | 终点对象匹配键 |
| relation_type | text | 是 | 是 | 关系类型 |
| metadata_json | text | 否 | 否 | 扩展字段 |
| source_reference_json | text | 是 | 否 | 来源信息 |
| validation_status | text | 是 | 是 | ok、warning、error |
| validation_message | text | 否 | 否 | 校验说明 |
| created_at | text | 是 | 否 | 创建时间 |

## 5. P1 表设计

### 5.1 item_aliases

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| id | text | 是 | 别名 ID |
| item_id | text | 是 | 知识对象 |
| alias | text | 是 | 别名 |
| alias_type | text | 是 | original、normalized、manual |
| source_reference_id | text | 否 | 来源引用 |
| created_at | text | 是 | 创建时间 |

### 5.2 review_decisions

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| id | text | 是 | 审查记录 ID |
| import_job_id | text | 是 | 导入任务 |
| staging_type | text | 是 | item、relation |
| staging_id | text | 是 | 暂存记录 |
| decision | text | 是 | approve、reject、merge、keep_manual、needs_fix |
| note | text | 否 | 备注 |
| decided_at | text | 是 | 决策时间 |

### 5.3 change_logs

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| id | text | 是 | 变更记录 ID |
| target_type | text | 是 | item、relation |
| target_id | text | 是 | 对象或关系 |
| change_type | text | 是 | create、update、deprecate、merge |
| before_json | text | 否 | 变更前 |
| after_json | text | 否 | 变更后 |
| import_job_id | text | 否 | 导入任务 |
| changed_at | text | 是 | 变更时间 |

### 5.4 app_settings

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| key | text | 是 | 配置键 |
| value_json | text | 是 | 配置值 |
| updated_at | text | 是 | 更新时间 |

## 6. P2 表设计

### 6.1 guide_pages

用于 PPT 使用说明页。

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| id | text | 是 | 页面 ID |
| source_file_id | text | 是 | 来源 PPT |
| slide_number | integer | 是 | 页码 |
| title | text | 否 | 页标题 |
| content | text | 否 | 抽取正文 |
| note | text | 否 | 备注 |
| media_count | integer | 否 | 媒体数量 |
| metadata_json | text | 否 | 扩展字段 |

### 6.2 diagram_views

用于 Draw.io 只读视图。

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| id | text | 是 | 视图 ID |
| source_file_id | text | 是 | 来源 Draw.io |
| page_index | integer | 是 | 页面序号 |
| title | text | 是 | 页面名 |
| vertex_count | integer | 否 | 节点数量 |
| edge_count | integer | 否 | 连线数量 |
| preview_path | text | 否 | 后续预览图路径 |
| metadata_json | text | 否 | 扩展字段 |

## 7. FTS 全文索引设计

V1 建议先为 `knowledge_items` 建 FTS。

索引字段：

| 字段 | 来源 |
|---|---|
| title | knowledge_items.title |
| description | knowledge_items.description |
| code | knowledge_items.code |
| category | knowledge_items.category |

暂不对 `metadata_json` 做全文索引。等字段稳定后，再把常用字段提升为正式列。

## 8. 第一批查询场景

| 场景 | 主要表 |
|---|---|
| 搜索能力关注点 | knowledge_items + FTS |
| 查看能力树 | knowledge_items + knowledge_relations |
| 查某能力关注点对应服务 | knowledge_items + knowledge_relations |
| 查某服务对应模块 | knowledge_items + knowledge_relations |
| 查某模块所属系统和产品 | knowledge_items + knowledge_relations |
| 查某信息化对象需要的服务和模块 | knowledge_items + knowledge_relations |
| 查看来源 | source_references + source_files |
| 查看导入预览 | staging_items + staging_relations + import_jobs |

## 9. 迁移脚本规划

已按以下 migration 拆分：

| 脚本 | 内容 |
|---|---|
| 001_init_core.sql | source_files、import_jobs、knowledge_items、knowledge_relations |
| 002_source_tracking.sql | source_references、item_aliases |
| 003_staging_review.sql | staging_items、staging_relations、review_decisions、change_logs |
| 004_search.sql | FTS5 索引 |
| 005_guides_diagrams.sql | guide_pages、diagram_views |

## 10. 验收标准

SQLite schema 设计进入实现前，需要满足：

- 能保存第一批 5 个核心 Sheet 产生的对象；
- 能保存对象之间的关系；
- 能追溯到文件、Sheet、行、列；
- 能保存导入预览；
- 能记录审查结果；
- 能支持基础搜索；
- 能导出正式对象、关系和来源。
