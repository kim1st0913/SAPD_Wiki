# 用户库兼容报告

日期：2026-06-06
状态：当前事实报告 / 不迁移
适用范围：`OI-135`、`DB-11`、`DB-2`，用于后续 `user_schema_0.3` migration、`stable_key` 和 `base_id_redirects` 落地前的风险判断。

## 1. 报告结论

当前用户库可以继续作为 `user_schema_0.2` 运行，不需要立即迁移真实用户数据。

但在进入 `user_schema_0.3` 和基础库升级能力前，需要先处理三类兼容风险：

1. 当前基础库没有显式 `stable_key` / `stable_ref` 字段，也没有 `base_id_redirects` 表。
2. 用户库中存在大量 v2 页面坐标锚点，这些不是基础对象 stable ref，后续必须保留页面上下文解析器，不能简单替换成基础对象引用。
3. `user_favorites.note` 仍有 1 条 legacy 轻备注，适合生成迁移候选，不应自动迁移。

本报告只读生成，不修改 `sapd_wiki_user.sqlite3`、不修改 `sapd_wiki_base.sqlite3`、不输出用户正文。

## 2. 数据库状态

只读检查对象：

- 用户库：`data/user/sapd_wiki_user.sqlite3`
- 基础库：`data/database/sapd_wiki.sqlite3`

用户库当前状态：

| 项 | 当前值 |
|---|---:|
| schema version | `user_schema_0.2` |
| `user_schema_migrations` | `user_schema_0.1`、`user_schema_0.2` |
| `user_notes` | 34 |
| `user_favorites` | 1 |
| 非空 `user_favorites.note` | 1 |
| `user_change_logs` | 104 |

`user_notes.status` 分布：

| status | 数量 |
|---|---:|
| `todo` | 29 |
| `closed` | 3 |
| `reviewing` | 1 |
| `waiting_confirm` | 1 |

## 3. target_ref 风险分类

### 3.1 用户批注维度

`user_notes` 共 34 条：

| 类型 | 数量 | 风险 |
|---|---:|---|
| v2 页面坐标锚点 | 24 | 高 |
| 非 v2 引用 | 10 | 低 / 中，需按对象类型继续拆分 |

v2 页面坐标锚点分布在：

- `/capability-mapping`
- `/development-security`
- `/data-security`
- `/knowledge/*`
- `/standards/*`

风险说明：

- v2 锚点依赖页面 route、tab、表格坐标、值级锚点和前端渲染结构。
- 它们能支持精确批注定位，但不能直接当成基础库对象 stable ref。
- 后续基础库升级时，v2 锚点应先走页面上下文恢复，再在可行时补充基础对象 stable ref。

### 3.2 用户库全量 target/source ref 抽样

`scripts/audit_stable_key_contract.mjs` 对 `user_notes`、`user_favorites`、`user_change_logs`、`user_custom_relations` 等引用做只读抽样，当前共 139 条引用：

| 分类 | 数量 |
|---|---:|
| stable base-like ref | 45 |
| v2 / 指南 / 幻灯片页面锚点 | 94 |
| 旧两段式 `base:<id>` | 0 |
| `user:*` ref | 0 |
| unknown ref | 0 |

说明：

- 这里包含 `user_change_logs.target_ref`，所以数量大于 `user_notes + user_favorites`。
- 页面锚点数量高，说明批注系统已经大量依赖页面级精确定位。
- 当前没有发现旧两段式 `base:<id>`，这是好消息。

### 3.3 指南 / 幻灯片引用

当前存在：

- `base:security_guide_slide:guide:<route>#<page>` 形态引用。
- `base:security_guide:/guides/security-architecture-design` 形态引用。

这些引用不应通过 `knowledge_items` 的普通 `type + code` 直接匹配，而应按 route、guide id、slide page 单独解析。

## 4. legacy favorite note

当前有 1 条 `user_favorites.note` 非空，目标为：

```text
base:security_guide:/guides/security-architecture-design
```

报告只记录 `note_length=3`，不输出正文。

建议处理：

1. 保留 `user_favorites` 表，不删除。
2. 将该记录列为 `legacy_favorite_note_migration_candidate`。
3. 若用户确认迁移，可生成候选 `user_notes`：
   - `anchor_type = 'object'`
   - `status = 'todo'`
   - `tags_json = ['legacy_favorite_note']`
   - `body = user_favorites.note`
4. 迁移前不清空 `user_favorites.note`，避免误删用户输入。

## 5. 基础库 stable key 状态

`scripts/audit_stable_key_contract.mjs` 当前对基础库检查结果为失败，原因是设计目标尚未实现：

| 检查项 | 当前状态 |
|---|---|
| `knowledge_items.stable_key` / `stable_ref` | 缺失 |
| `knowledge_relations.stable_key` / `stable_ref` | 缺失 |
| `knowledge_items.id` deterministic public id | 未满足，4660 条 UUID-like |
| `knowledge_relations.id` deterministic public id | 未满足，7654 条 UUID-like |
| `base_id_redirects` | 缺失 |

同时，脚本发现基础库当前已有可用候选键：

| 对象 | 候选覆盖 |
|---|---:|
| `knowledge_items` candidate stable key | 4660 / 4660 |
| `knowledge_relations` candidate stable key | 7654 / 7654 |

建议下一步不是直接改用户库，而是先确认这些 candidate key 是否可提升为正式 `stable_key` 来源。

## 6. 兼容处理矩阵

| 风险对象 | 当前状态 | 建议动作 |
|---|---|---|
| v2 页面坐标锚点 | 24 条 `user_notes`，全量抽样 94 条 page ref | 保留 contextual resolver；不要直接替换成基础对象 ref |
| 指南 / 幻灯片 ref | route / page 形态 | 单独按 route + page 解析，不走普通 `knowledge_items` 匹配 |
| legacy favorite note | 1 条 | 生成迁移候选，用户确认后再写 `user_notes` |
| 旧两段式 `base:<id>` | 0 条 | 继续监控；新写入禁止生成 |
| 基础库 stable key 字段 | 缺失 | 先做 DB-2 migration 设计 |
| `base_id_redirects` | 缺失 | 先设计表和示例 redirect，再做真实迁移 |

## 7. 下一步

推荐顺序：

1. 使用 `scripts/audit_user_db_governance_contract.mjs --db data/user/sapd_wiki_user.sqlite3` 作为用户库治理基线审计。
2. 使用 `scripts/audit_stable_key_contract.mjs` 作为 DB-2 前置审计；当前失败结果是预期缺口，不是脚本错误。
3. 设计基础库 `stable_key` migration，把当前 `metadata_json.object_key` / `relation_key` 或等价 candidate key 提升为正式字段。
4. 设计 `base_id_redirects` 最小表和示例数据，先覆盖 `rename`、`merge`、`split`、`deprecated`。
5. 再设计 `user_schema_0.3` migration；迁移真实用户库前先生成 dry-run 报告。

不建议：

- 不直接迁移真实 `sapd_wiki_user.sqlite3`。
- 不自动迁移 `user_favorites.note`。
- 不把 v2 页面坐标锚点当成 stable base ref。
- 不先做工作台、数据篮或导出前端按钮。
