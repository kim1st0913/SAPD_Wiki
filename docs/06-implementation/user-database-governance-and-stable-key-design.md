# 用户库长期治理与 stable_key 设计

日期：2026-06-06
状态：真实库 apply 已完成 / 自动验证通过 / 待用户确认关闭
适用范围：`OI-135`、`DB-11`、`DB-2`，以及后续工作台、数据篮、导出、用户自定义能力、导入草稿、基础库升级兼容。

## 1. 设计结论

当前下一步不应直接改前端按钮，也不应继续推进打包。应先把用户库长期治理和基础对象稳定引用设计清楚。

核心结论：

- `sapd_wiki_base.sqlite3` 继续只读；用户写入全部进入 `sapd_wiki_user.sqlite3`。
- `user_notes` 已成为正式批注入口，`user_favorites` 只保留为历史兼容 / 关注清单，不再作为主业务动作。
- 所有用户写入必须指向稳定 `target_ref`，优先使用 `base:<object_type>:<stable_key>`，不得长期依赖基础库重建后可能变化的 UUID。
- `stable_key` 和 `base_id_redirects` 是 Delivery、批注、数据篮、导出、能力重组和基础库升级的共同底座。
- 本轮已完成设计、dry-run、临时库 smoke、正式迁移脚本三段式、基础库 clean candidate、用户库 legacy target_ref 迁移 dry-run 和真实库 apply；正式基础库已替换为 clean base stable candidate，正式用户库已迁移 2 条旧 UUID 引用，不直接改前端、不修改正式 JSON 数据包。

## 2. 当前事实

### 2.1 已有用户库最小能力

`scripts/create_user_db.py` 当前使用 `user_schema_0.3`，已具备：

- `user_meta`
- `user_favorites`
- `user_notes`
- `user_tags`
- `user_item_tags`
- `user_custom_items`
- `user_custom_relations`
- `user_import_jobs`
- `user_change_logs`
- `user_schema_migrations`

`user_notes` 已扩展为正式批注表，包含：

- `target_ref`
- `body`
- `status`
- `page_route`
- `page_title`
- `anchor_type`
- `object_type`
- `object_title`
- `tags_json`

本地后端当前已支持：

- `GET /api/v1/user/favorites`
- `POST /api/v1/user/favorites`
- `DELETE /api/v1/user/favorites`
- `GET /api/v1/user/notes`
- `POST /api/v1/user/notes`
- `PATCH /api/v1/user/notes/:id`
- `DELETE /api/v1/user/notes/:id`

用户写入 API 当前需要本地 loopback 上下文和会话校验，写入类请求应保持 `Content-Type`、`X-SAPD-Session-Token`、`Host`、`Origin` / `Referer` 的本地安全边界，不应在前端绕过后端直接写 SQLite。

`user_notes.status` 当前代码口径包含：

- `todo`
- `reviewing`
- `waiting_confirm`
- `confirmed`
- `closed`
- `deferred`

这些状态可以作为后续工作台筛选和待复核队列的最小状态集。

### 2.2 子 Agent fan-in 结论

本设计已 fan-in 三个只读子 Agent 的结论：

| Agent | 任务 | 关键结论 |
|---|---|---|
| Ptolemy / `019e9d61-57ed-74e3-b017-74abb2b650c8` | 现有用户库 schema 和 API | `user_notes` 已是正式批注入口；`user_favorites` 只有关注 / 轻备注兼容能力；现有最小 schema 文档仍写 `user_schema_0.1`，而代码默认已是 `user_schema_0.2`，后续需要文档同步或迁移说明 |
| Kuhn / `019e9d61-83d2-7501-9376-170e117a3a66` | `stable_key`、deterministic ID、`base_id_redirects` | `DB-2` 与 `DB-11` 必须相邻推进；关系 stable key 要基于端点 stable ref、关系类型和业务限定维度，不能依赖重建 UUID；`split` / `deprecated` 不能静默迁移，需要待确认或 orphan 标记 |
| Nash / `019e9d61-add5-70f0-8077-e8ee081db5f6` | 工作台、数据篮、导出、自定义能力、导入草稿 | V1A 收藏 / 轻备注、V1B 批注、V2 工作区、V3 / V4 数据篮、导出和能力重组需要统一排期；当前不应先做前端按钮，先固化用户库对象和 read model |

### 2.3 当前差距

当前差距不是“没有用户库”，而是用户库还没有长期治理口径：

- `user_favorites.note` 与正式 `user_notes` 的关系未定。
- 数据篮、导出配置、工作区、能力重组、导入草稿还没有长期 schema。
- `target_ref` 仍可能混用旧 `base:<id>`、`base:<object_type>:<id>`、`base:<object_type>:<stable_key>` 和批注 v2 坐标。
- 基础库重建或对象改名后，用户批注、收藏、数据篮和用户关系可能失效。
- 还没有统一的 base/user read model 合并策略。
- 还没有用户库备份、恢复、迁移失败回滚和测试数据清理策略。
- 2026-07-06 已正式迁移当前 2 条旧 `base:<type>:<uuid>` 引用：`数据分析层` 从 `base:information_object:418bd2f6-ff6e-431e-b2ef-059df3cdd2ae` 迁到 `base:information_object:information_object:hash:9055299c885b70a0`，覆盖 `user_notes.target_ref` 和 `user_change_logs.target_ref` 各 1 条，并写入 `user_target_ref_migrations.applied=2`。
- `docs/05-archive/delivery-retired-2026-07/user-database-minimum-schema.md` 是历史 ZIP alpha
  最小模板，不再代表当前用户库合同。
- `user-workspace-v1-to-v4-design.md` 与当前 backlog 中关于 V3 / V4 的表述存在轻微顺序差异，后续以本设计中的“先 schema / read model，后 UI”的顺序为准。

## 3. 长期对象引用规范

### 3.1 引用格式

后续用户库所有面向基础对象的引用统一使用：

```text
base:<object_type>:<stable_key>
```

用户对象使用：

```text
user:<object_type>:<id>
```

关系引用使用：

```text
base_relation:<relation_type>:<stable_key>
user_relation:<relation_type>:<id>
```

保留兼容：

- 旧 `base:<id>` 可以读，但新增写入不得再生成。
- 旧 `base:<object_type>:<id>` 可以读，但应通过迁移映射转成 stable ref。
- 批注 v2 坐标仍可作为锚点上下文，但其 `target_ref` 的基础对象段必须能回到 stable ref。

### 3.2 stable_key 生成规则

| 对象类型 | stable_key 推荐规则 |
|---|---|
| 能力 L0 / L1 / L2 | 业务编码，例如 `T`、`T-PD`、`T-PD.AC` |
| 能力关注点 | 关注点编码；没有编码时使用父能力 stable_key + 规范化标题 hash |
| 安全技术服务 | 服务编码；没有编码时使用字典类型 + 规范化名称 |
| 安全技术模块 / 措施 | 模块 / 措施编码；没有编码时使用类别 + 规范化名称 |
| 管理工作 / 流程 / 职能 | 层级编码；没有编码时使用父 stable_key + 规范化标题 |
| 信息化环境 / 对象 / 作用域 | 环境分类编码或路由 slug + 规范化标题 |
| 生命周期阶段 / 活动 / 场景 | `LC-AP` 或 `LC-DT` + 阶段 / 活动编码 |
| 标准框架 | 标准 slug，例如 `iso-27001-2022` |
| 标准控制项 | 标准 slug + 控制项编号，例如 `iso-27001-2022:A.5.1` |
| 指南页 | 内容 route，例如 `security-architecture-design` |
| 幻灯片页 | 内容 route + 页码，例如 `security-architecture-design#30` |
| 关系 | source stable ref + relation_type + target stable ref + 关键限定维度的 hash |

### 3.3 deterministic public id

为了兼容前端和 API 中仍需要短 ID 的地方，后端可以生成 deterministic public id：

```text
public_id = short_hash(namespace + ":" + object_type + ":" + stable_key)
```

但业务引用和用户库引用不应依赖 `public_id`，而应依赖 stable ref。`public_id` 只是展示、缓存或内部索引用途。

## 4. base_id_redirects 设计

基础库升级时需要处理对象改名、合并、拆分、废弃。建议基础库或伴随 manifest 增加：

```sql
CREATE TABLE IF NOT EXISTS base_id_redirects (
  id TEXT PRIMARY KEY,
  old_ref TEXT NOT NULL,
  new_ref TEXT,
  redirect_type TEXT NOT NULL,
  release_version TEXT NOT NULL,
  confidence TEXT NOT NULL DEFAULT 'high',
  note TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

`redirect_type`：

| 类型 | 说明 | 处理方式 |
|---|---|---|
| `rename` | 对象改名但语义延续 | 自动迁移到 `new_ref` |
| `merge` | 多个旧对象合并到一个新对象 | 多个 `old_ref` 指向同一个 `new_ref` |
| `split` | 一个旧对象拆成多个新对象 | 记录多条候选，用户写入进入待确认 |
| `deprecated` | 对象废弃且无替代 | 保留用户记录，标记为 orphan / deprecated |
| `retype` | 对象类型变化但语义延续 | 自动迁移并记录类型变化 |

`split` 不能自动选一个新对象作为唯一结果。后续 read model 应把受影响用户记录标记为 `pending_redirect_review`，在工作台或维护页让用户确认归属；如果无法提供候选，则保留为 orphan，不删除用户正文。

读取用户库时，后端应先解析 `target_ref`：

```text
target_ref -> normalize -> redirect resolve -> active base/user object
```

迁移用户库时，应记录：

```sql
CREATE TABLE IF NOT EXISTS user_target_ref_migrations (
  id TEXT PRIMARY KEY,
  old_target_ref TEXT NOT NULL,
  new_target_ref TEXT,
  redirect_type TEXT NOT NULL,
  affected_table TEXT NOT NULL,
  affected_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  applied_at TEXT
);
```

## 5. user_schema_0.3 建议

### 5.1 保留并治理现有表

| 表 | 处理 |
|---|---|
| `user_notes` | 作为正式批注主表保留，继续承载页面 / 对象 / 行 / 字段 / 值锚点 |
| `user_favorites` | 保留兼容，不再作为主业务动作；未来可作为关注清单或迁移到工作台 |
| `user_tags` / `user_item_tags` | 保留，后续用于工作台筛选 |
| `user_custom_items` / `user_custom_relations` | 保留，后续作为用户新增对象 / 关系的底层表 |
| `user_import_jobs` | 保留，但需要扩展为导入草稿和审核链路 |
| `user_change_logs` | 保留，所有用户写入必须记录 |
| `user_schema_migrations` | 保留，所有 schema 升级必须记录 |

`user_notes` 当前已经有 `page_route`、`anchor_type`、`object_type`、`object_title`、`tags_json` 等批注上下文字段。后续如果值级 / 幻灯片 / 表格复合锚点继续增长，建议新增 `anchor_json` 承载结构化上下文；但本轮不拆表、不迁移真实数据。

### 5.2 新增工作台表

```sql
CREATE TABLE IF NOT EXISTS user_workspaces (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS user_workspace_items (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  target_ref TEXT NOT NULL,
  item_status TEXT NOT NULL DEFAULT 'active',
  sort_order INTEGER,
  payload_json TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(workspace_id, target_ref),
  FOREIGN KEY(workspace_id) REFERENCES user_workspaces(id) ON DELETE CASCADE
);
```

### 5.3 新增数据篮表

数据篮是导出的前置容器，不等同于收藏。

```sql
CREATE TABLE IF NOT EXISTS user_data_baskets (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS user_data_basket_items (
  id TEXT PRIMARY KEY,
  basket_id TEXT NOT NULL,
  target_ref TEXT NOT NULL,
  object_type TEXT,
  object_title TEXT,
  payload_json TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(basket_id, target_ref),
  FOREIGN KEY(basket_id) REFERENCES user_data_baskets(id) ON DELETE CASCADE
);
```

### 5.4 新增导出配置和导出任务

```sql
CREATE TABLE IF NOT EXISTS user_export_profiles (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  export_type TEXT NOT NULL,
  config_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS user_export_jobs (
  id TEXT PRIMARY KEY,
  profile_id TEXT,
  export_type TEXT NOT NULL,
  source_ref TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  preview_json TEXT,
  output_path TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

### 5.5 新增用户能力模型

用户能力模型用于“能力重组 / 自定义分类”，不改基础能力树。

```sql
CREATE TABLE IF NOT EXISTS user_capability_models (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS user_capability_model_nodes (
  id TEXT PRIMARY KEY,
  model_id TEXT NOT NULL,
  parent_id TEXT,
  source_ref TEXT,
  node_type TEXT NOT NULL,
  code TEXT,
  title TEXT NOT NULL,
  description TEXT,
  sort_order INTEGER,
  payload_json TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS user_capability_model_relations (
  id TEXT PRIMARY KEY,
  model_id TEXT NOT NULL,
  source_node_id TEXT NOT NULL,
  target_ref TEXT NOT NULL,
  relation_type TEXT NOT NULL,
  payload_json TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

### 5.6 新增导入草稿和审核表

`user_import_jobs` 保留，但需要配套 staging 和 review。

```sql
CREATE TABLE IF NOT EXISTS user_import_staging_items (
  id TEXT PRIMARY KEY,
  import_job_id TEXT NOT NULL,
  target_ref TEXT,
  item_type TEXT NOT NULL,
  action_type TEXT NOT NULL DEFAULT 'create',
  payload_json TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS user_import_staging_relations (
  id TEXT PRIMARY KEY,
  import_job_id TEXT NOT NULL,
  source_ref TEXT NOT NULL,
  target_ref TEXT NOT NULL,
  relation_type TEXT NOT NULL,
  action_type TEXT NOT NULL DEFAULT 'create',
  payload_json TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS user_review_decisions (
  id TEXT PRIMARY KEY,
  target_ref TEXT NOT NULL,
  decision_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  note TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

## 6. `user_favorites` 兼容策略

不建议删除 `user_favorites`。建议：

1. 保留 `user_favorites` 作为历史关注清单。
2. 不再把 `收藏` 作为主业务入口。
3. 若 `user_favorites.note` 不为空，可迁移为 `user_notes`：
   - `anchor_type = 'object'`
   - `status = 'todo'`
   - `tags_json = ['legacy_favorite_note']`
   - `body = user_favorites.note`
4. 迁移后保留 `user_favorites.note`，但前端不再把它当正式批注来源。
5. 所有迁移写入 `user_change_logs` 和 `user_target_ref_migrations`。

## 7. API 与 read model 边界

### 7.1 后续 API 分组

批注 API 已有，不在本轮扩展。

建议后续新增：

```text
GET /api/v1/user/workspaces
POST /api/v1/user/workspaces
PATCH /api/v1/user/workspaces/:id
GET /api/v1/user/workspaces/:id/items
POST /api/v1/user/workspaces/:id/items
DELETE /api/v1/user/workspaces/:id/items/:item_id

GET /api/v1/user/data-baskets
POST /api/v1/user/data-baskets
GET /api/v1/user/data-baskets/:id/items
POST /api/v1/user/data-baskets/:id/items
DELETE /api/v1/user/data-baskets/:id/items/:item_id

GET /api/v1/user/export-profiles
POST /api/v1/user/export-profiles
GET /api/v1/user/export-profiles/:id
DELETE /api/v1/user/export-profiles/:id
POST /api/v1/user/exports/preview
POST /api/v1/user/exports
GET /api/v1/user/exports/:id
GET /api/v1/user/exports/:id/download

GET /api/v1/user/capability-models
POST /api/v1/user/capability-models
GET /api/v1/user/capability-models/:id/nodes
POST /api/v1/user/capability-models/:id/nodes

GET /api/v1/user/import-drafts
POST /api/v1/user/import-drafts
PATCH /api/v1/user/import-drafts/:id
```

导出格式契约入口：`docs/06-implementation/user-export-format-contract.md`。当前 runtime 只完成受控 JSON 最小闭环；2026-06-07 用户已确认后续表格导出基本参考原始数据，优先 Excel / CSV / Markdown，幻灯片材料单独导出 PDF；第一批业务数据集为能力全量映射、信息化环境安全映射、字典与标准框架数据。

### 7.2 read model 合并原则

前端不直接判断数据来自 base 还是 user。后端或 `dataClient` 输出合并后的 read model：

```text
base object
  + user_notes
  + user_tags
  + user_workspace membership
  + user_data_basket membership
  + user_correction_suggestions
```

用户对象输出：

```text
user object
  + user_notes
  + user_tags
  + user_workspace membership
  + user_data_basket membership
```

页面展示必须标记来源：

- `基础对象`
- `我的版本`
- `用户草稿`
- `待复核`
- `已废弃基础对象`

## 8. 迁移策略

### Phase 0：设计确认

本阶段只确认：

- `target_ref` 规范。
- `user_schema_0.3` 新增表范围。
- `user_favorites` 兼容策略。
- `stable_key` 和 `base_id_redirects` 规则。
- read model 合并边界。

### Phase 1：审计脚本先行

新增审计脚本建议：

```text
scripts/audit_user_db_governance_contract.mjs
scripts/audit_stable_key_contract.mjs
```

审计内容：

- `user_notes`、`user_favorites`、数据篮、工作台等表是否存在。
- 新写入是否使用 stable ref。
- 是否存在无法解析的旧 `target_ref`。
- `base_id_redirects` 是否覆盖 rename / merge / split / deprecated。
- 用户库迁移前后 `user_change_logs` 是否记录。

### Phase 2：用户库 schema migration

新增 `user_schema_0.3` migration：

1. 创建新增表。
2. 创建 `user_target_ref_migrations`。
3. 扫描 `user_notes`、`user_favorites`、`user_item_tags`、`user_change_logs`、`user_custom_relations`、工作台、数据篮、导出、导入 staging 和 review decisions 中的 `target_ref` / `source_ref`。
4. 可自动迁移的 ref 写入新 stable ref。
5. 无法自动迁移的 ref 标记为 `pending`，不删除原记录。
6. 所有操作写入 `user_change_logs`。

### Phase 3：基础库 stable key 审计

基础数据导出或 base DB 生成时必须输出：

- 基础对象 stable ref。
- 基础关系 stable ref。
- `base_id_redirects`。
- base manifest 中的 stable key 版本。

### Phase 4：read model 合并

在后端或 `dataClient` 增加：

- stable ref 解析。
- redirect 解析。
- orphan / deprecated 标记。
- base/user overlay 合并。

### Phase 5：前端入口

前端入口最后做：

- 工作台总览。
- 数据篮。
- 导出中心。
- 能力重组。
- 用户导入草稿。

## 9. 当前不做

本设计明确不做：

- 不直接改前端按钮或页面。
- 不删除 `user_favorites`。
- 不无备份、无确认地迁移真实用户库。
- 不修改基础数据包。
- 不改 ETL 主流程。
- 不启动 Windows ZIP UAT。
- 不让用户写入回写基础库。

## 10. 验收标准

设计确认后，后续实现至少满足：

- `user_schema_0.3` 可从空用户库创建。
- 旧 `user_schema_0.2` 可迁移到 `0.3`，且失败可回滚。
- 旧 `user_favorites.note` 可生成正式 `user_notes` 迁移候选。
- 新增用户写入使用 stable ref。
- 基础库升级后，用户批注、收藏、数据篮和用户关系可通过 redirect 找回。
- orphan / deprecated 对象不丢失用户数据，只在 read model 标记。
- 诊断包不得包含 `sapd_wiki_user.sqlite3` 原文件或用户正文。
- 主展示区不暴露非业务字段。

## 11. 后续工作计划

当前执行状态：

| 顺序 | 任务 | 状态 | 产物 |
|---|---|---|---|
| 1 | 新增 user DB 治理契约审计 | 已完成 | `scripts/audit_user_db_governance_contract.mjs` |
| 2 | 新增 stable key 契约审计 | 已完成 | `scripts/audit_stable_key_contract.mjs` |
| 3 | 生成当前用户库兼容报告 | 已完成 | `docs/05-archive/implementation-completed-2026-07/user-db-compatibility-report-2026-06-06.md` |
| 4 | 设计 `user_schema_0.3` migration dry-run | 已完成 | `scripts/plan_user_schema_0_3_migration.mjs`，只读输出 0.3 表创建、legacy favorite note 候选和 target_ref 风险分类 |
| 5 | 设计基础库 `stable_key` / `base_id_redirects` migration | 已完成 | `docs/05-archive/implementation-completed-2026-07/base-stable-key-and-redirect-migration-design-2026-06-06.md` |
| 6 | 临时库 migration smoke | 已完成 | `scripts/smoke_db_migration_contracts.mjs` 只对 `/private/tmp` 复制库执行，真实基础库 / 用户库不写 |
| 7 | 正式迁移脚本三段式 | 已完成 | `scripts/migrate_db_contracts.mjs` 默认 dry-run；`--apply` 才写目标库；项目真实库还需 `--confirm-project-db-write` 并自动备份 |
| 8 | OI-135 真实库 apply | 已完成 | `data/exports/worker-verify/oi-135-formal-apply/20260706T063552Z/oi135-formal-apply-report.md`，正式基础库替换、用户库 target_ref 迁移、备份与回退路径 |
| 9 | 第一批业务导出器实现 | 后续 | 基于 `docs/06-implementation/user-export-format-contract.md`，不回到历史库逐条补丁 |

下一步不应直接进入前端按钮或历史库补丁。建议先由用户确认是否关闭 `OI-135`，随后进入第一批业务导出器实现。
