# 基础库 stable_key 与 base_id_redirects 迁移设计

日期：2026-06-06
状态：设计完成 / 待实现
适用范围：`DB-2`、`DB-11`、Delivery Bundle 基础库升级、批注 / 收藏 / 数据篮 / 用户关系跨版本兼容。

## 1. 结论

当前不应直接迁移真实基础库。应先把基础库中已经存在的候选稳定键提升为正式字段，再建立 redirect 表和审计脚本闭环。

当前基础库事实：

| 项 | 当前状态 |
|---|---:|
| `knowledge_items` | 4660 |
| `knowledge_relations` | 7654 |
| `knowledge_items.stable_key` / `stable_ref` | 缺失 |
| `knowledge_relations.stable_key` / `stable_ref` | 缺失 |
| `base_id_redirects` | 缺失 |
| `knowledge_items.id` UUID-like | 4660 |
| `knowledge_relations.id` UUID-like | 7654 |
| `metadata_json.object_key` 候选覆盖 | 4660 / 4660 |
| `metadata_json.relation_key` 候选覆盖 | 7654 / 7654 |

所以本轮判断是：

- `metadata_json.object_key` 可作为 `knowledge_items.stable_key` 的首选候选来源。
- `metadata_json.relation_key` 可作为 `knowledge_relations.stable_key` 的首选候选来源。
- 当前不要直接把 `id` 改成 deterministic public id；先新增正式 `stable_key`，保持 `id` 兼容，后续再决定 public id 策略。
- `base_id_redirects` 先建空表和示例 / 测试 fixture，不急于写真实 redirect。

## 2. 当前基础库字段

`knowledge_items` 当前字段：

```text
id, type, code, title, description, category, status, parent_id,
source_file_id, source_hash, metadata_json, created_at, updated_at
```

`knowledge_relations` 当前字段：

```text
id, source_item_id, target_item_id, relation_type, relation_label,
confidence, source_file_id, import_job_id, metadata_json, created_at, updated_at
```

当前样例：

```json
{
  "object_key": "capability_focus::T-AS.AD-01",
  "relation_key": "capability_focus::T-AS.AD-01::belongs_to::capability::T-AS.AD"
}
```

这些 key 比 UUID 更接近业务稳定键，但还没有成为数据库字段，因此前端 / 用户库 / Delivery 无法用 SQL 层稳定依赖它。

## 3. 目标 schema

### 3.1 `knowledge_items`

新增字段：

```sql
ALTER TABLE knowledge_items ADD COLUMN stable_key TEXT;
ALTER TABLE knowledge_items ADD COLUMN stable_ref TEXT;
ALTER TABLE knowledge_items ADD COLUMN public_id TEXT;
```

推荐写入：

```text
stable_key = metadata_json.object_key
stable_ref = "base:" || type || ":" || stable_key
public_id = deterministic short hash("knowledge_item:" || type || ":" || stable_key)
```

约束建议：

```sql
CREATE UNIQUE INDEX IF NOT EXISTS idx_knowledge_items_stable_key
ON knowledge_items(type, stable_key);

CREATE UNIQUE INDEX IF NOT EXISTS idx_knowledge_items_stable_ref
ON knowledge_items(stable_ref);
```

### 3.2 `knowledge_relations`

新增字段：

```sql
ALTER TABLE knowledge_relations ADD COLUMN stable_key TEXT;
ALTER TABLE knowledge_relations ADD COLUMN stable_ref TEXT;
ALTER TABLE knowledge_relations ADD COLUMN public_id TEXT;
```

推荐写入：

```text
stable_key = metadata_json.relation_key
stable_ref = "base_relation:" || relation_type || ":" || stable_key
public_id = deterministic short hash("knowledge_relation:" || relation_type || ":" || stable_key)
```

约束建议：

```sql
CREATE UNIQUE INDEX IF NOT EXISTS idx_knowledge_relations_stable_key
ON knowledge_relations(relation_type, stable_key);

CREATE UNIQUE INDEX IF NOT EXISTS idx_knowledge_relations_stable_ref
ON knowledge_relations(stable_ref);
```

## 4. `base_id_redirects`

新增表：

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

约束建议：

```sql
CREATE INDEX IF NOT EXISTS idx_base_id_redirects_old_ref
ON base_id_redirects(old_ref);

CREATE INDEX IF NOT EXISTS idx_base_id_redirects_new_ref
ON base_id_redirects(new_ref);
```

处理规则：

| redirect_type | 自动迁移 | 说明 |
|---|---|---|
| `rename` | 是 | 语义延续，旧 ref 可自动指向新 ref |
| `merge` | 是 | 多个旧 ref 指向一个新 ref |
| `split` | 否 | 一个旧 ref 对多个新 ref，必须进入 `pending_redirect_review` |
| `deprecated` | 否 | 不删除用户数据，read model 标记 orphan / deprecated |
| `retype` | 是 | 类型变化但语义延续，记录类型变化 |

## 5. 迁移顺序

### Phase 1：dry-run

只读执行：

```bash
node scripts/audit_stable_key_contract.mjs
```

当前预期结果是 `fail`，失败项代表真实缺口：

- 缺少 `knowledge_items.stable_key` / `stable_ref`
- 缺少 `knowledge_relations.stable_key` / `stable_ref`
- 缺少 `base_id_redirects`
- `id` 仍为 UUID-like

### Phase 2：生成迁移计划

后续新增脚本建议：

```text
scripts/plan_base_stable_key_migration.mjs
```

只读输出：

- `metadata_json.object_key` 覆盖率。
- `metadata_json.relation_key` 覆盖率。
- 重复 key。
- 非法 key。
- 建议 DDL。
- 建议 public id 样例。

### Phase 3：测试库迁移

只允许对临时复制库执行写入：

```text
/private/tmp/sapd_wiki_base_stable_key_smoke.sqlite3
```

不直接写 `data/database/sapd_wiki.sqlite3`。

### Phase 4：真实库迁移

只有当以下条件全部满足，才允许真实库迁移：

- `plan_base_stable_key_migration` dry-run 无 fatal issue。
- 临时复制库迁移后 `audit_stable_key_contract.mjs` 通过。
- `base_id_redirects` 至少具备表结构和 redirect type 校验。
- `user_schema_0.3` dry-run 明确不会丢用户数据。
- 用户确认可以进入基础库 schema migration。

## 6. 与用户库的关系

用户库不应等基础库真实迁移后才具备保护策略。当前就应保持：

- v2 页面坐标锚点继续走 contextual resolver。
- 指南 / 幻灯片 ref 继续按 route + page 解析。
- legacy `user_favorites.note` 只生成迁移候选。
- 旧 `base:<id>` 持续监控，当前发现数量为 0。

基础库 stable key 迁移完成后，用户库 read model 再做：

```text
target_ref -> normalize -> stable_ref -> base_id_redirects -> active/orphan/deprecated object
```

## 7. 验收标准

真实迁移完成后，至少满足：

- `knowledge_items.stable_key` 覆盖 4660 / 4660。
- `knowledge_relations.stable_key` 覆盖 7654 / 7654。
- `knowledge_items.stable_ref`、`knowledge_relations.stable_ref` 唯一。
- `base_id_redirects` 表存在，字段完整。
- `audit_stable_key_contract.mjs` 不再因 stable key / redirects 基础契约失败。
- 不修改用户库正文，不输出用户正文。
- 不把 v2 页面坐标锚点误判为基础对象 stable ref。

## 8. 当前不做

- 不直接写真实基础库。
- 不改 ETL 主流程。
- 不改前端。
- 不修改真实 `sapd_wiki_user.sqlite3`。
- 不自动迁移 `user_favorites.note`。
- 不把 `knowledge_items.id` 立即替换为 deterministic id。
