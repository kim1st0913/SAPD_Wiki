# ZIP Alpha 用户库最小 Schema

> 归档状态：`historical / ZIP alpha`

本文档定义 Delivery Bundle 1.0-alpha 中 `sapd_wiki_user.sqlite3` 的最小 schema。用户库用于保存用户自己的备注、收藏、个人标签、用户新增知识对象、用户新增关系、导入任务占位和变更日志。

基础库 `sapd_wiki_base.sqlite3` 必须只读；用户产生的数据都写入 `sapd_wiki_user.sqlite3`。

## 1. 文件位置

```text
SAPD-Wiki-v0.1.0-{platform}/
└── data/
    └── user/
        └── sapd_wiki_user.sqlite3
```

如果用户库不存在，后端启动时自动创建。

## 2. Schema 版本

当前最小版本：

```text
user_schema_0.1
```

版本写入：

- `user_meta.schema_version`
- `user_schema_migrations.version`

## 3. 表清单

| 表 | 用途 |
|---|---|
| `user_meta` | 用户库元信息和 schema 版本 |
| `user_favorites` | 用户收藏 |
| `user_notes` | 用户备注 |
| `user_tags` | 用户个人标签 |
| `user_item_tags` | 用户标签和对象的关系 |
| `user_custom_items` | 用户新增知识对象 |
| `user_custom_relations` | 用户新增知识关系 |
| `user_import_jobs` | 用户导入任务占位 |
| `user_change_logs` | 用户库变更日志 |
| `user_schema_migrations` | 用户库 schema migration 记录 |

## 4. 目标对象引用格式

所有指向对象或关系的字段统一使用 namespaced ref：

```text
base:<stable_key-or-id>
user:<id>
```

ZIP alpha 优先支持指向基础对象的 `base:<id>` 或 `base:<stable_key>`。进入正式升级能力前，应优先改为稳定的 `stable_key`。

## 5. SQL 草案

```sql
CREATE TABLE IF NOT EXISTS user_meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS user_favorites (
  id TEXT PRIMARY KEY,
  target_ref TEXT NOT NULL,
  note TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(target_ref)
);

CREATE TABLE IF NOT EXISTS user_notes (
  id TEXT PRIMARY KEY,
  target_ref TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS user_tags (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  color TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS user_item_tags (
  id TEXT PRIMARY KEY,
  target_ref TEXT NOT NULL,
  tag_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(target_ref, tag_id),
  FOREIGN KEY(tag_id) REFERENCES user_tags(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS user_custom_items (
  id TEXT PRIMARY KEY,
  item_type TEXT NOT NULL,
  title TEXT NOT NULL,
  code TEXT,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  source_ref TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS user_custom_relations (
  id TEXT PRIMARY KEY,
  relation_type TEXT NOT NULL,
  source_ref TEXT NOT NULL,
  target_ref TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS user_import_jobs (
  id TEXT PRIMARY KEY,
  import_type TEXT NOT NULL,
  source_path TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  summary TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS user_change_logs (
  id TEXT PRIMARY KEY,
  action TEXT NOT NULL,
  target_ref TEXT,
  payload_json TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS user_schema_migrations (
  version TEXT PRIMARY KEY,
  applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

## 6. 初始元数据

创建用户库后写入：

```text
user_meta.schema_version = user_schema_0.1
user_meta.created_by = sapd-wiki-zip-alpha
```

## 7. 写入边界

| 用户动作 | 写入表 |
|---|---|
| 收藏基础对象 | `user_favorites` |
| 给基础对象写备注 | `user_notes` |
| 创建个人标签 | `user_tags` |
| 给对象打标签 | `user_item_tags` |
| 新增用户知识对象 | `user_custom_items` |
| 新增用户知识关系 | `user_custom_relations` |
| 用户导入任务 | `user_import_jobs` |
| 所有用户写操作审计 | `user_change_logs` |

用户端不得写入 `sapd_wiki_base.sqlite3`。

ZIP-RUN-1 的最小写入 API 使用：

```text
POST /api/v1/user/favorites
```

该接口必须携带 `Content-Type: application/json` 和启动期 `X-SAPD-Session-Token`，token 通过同源 `GET /api/v1/health` 获取。接口只写入 `user_favorites` 和 `user_change_logs`，用于验证用户动作进入 `sapd_wiki_user.sqlite3`，同时保持 `sapd_wiki_base.sqlite3` hash 不变。备注、个人标签、新增对象和新增关系仍按上表进入 user 库，后续逐步开放 API。

## 8. 后续扩展

后续可扩展：

- 用户导入 staging 表；
- 用户 review decisions；
- 用户附件索引；
- 用户覆盖规则 `user_overrides`；
- 用户修正建议 `user_correction_suggestions`；
- 用户库备份索引。
