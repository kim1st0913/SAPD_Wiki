# 数据库清理交接文档（2026-06-01）

> 归档状态：`completed / dated cleanup handoff`

本文档用于下一轮清理 `data/database/sapd_wiki.sqlite3` 中的垃圾数据、陈旧数据和可归档运行痕迹。目标是减小本地库体积、清掉明显无效引用，同时不破坏当前前端页面、导出数据包、来源追踪和后续审计能力。

## 1. 当前结论

- 当前正式数据库：`data/database/sapd_wiki.sqlite3`。
- 当前数据库大小约 `708MB`，`data/database/` 总大小约 `10GB`，其中 `data/database/backups/` 约 `9.6GB`。
- 旁边存在两个 0 字节占位库：`data/database/sapd_wiki.db`、`data/database/sapd_wiki.sqlite`。
- 前端生成数据包目录 `frontend/capability-browser/public/data/` 约 `132MB`。
- `data/exports/` 约 `568MB`。
- 当前未关闭数据问题：
  - `OI-038`：Gartner 与安全职能候选映射待人工校对。
  - `OI-124`：知识库字典权威引用不一致，待修复。

本轮只整理交接，不执行删除、重建或数据库写入。

## 2. 只读盘点基线

2026-06-01 只读检查结果：

| 对象 | 数量 |
|---|---:|
| `knowledge_items` | 5,241 |
| `knowledge_relations` | 7,678 |
| `source_references` | 408,923 |
| `source_files` | 46 |
| `import_jobs` | 101 |
| `staging_items` | 56,221 |
| `staging_relations` | 128,093 |
| `review_decisions` | 162,044 |
| `change_logs` | 66,869 |

按 SQLite `dbstat` 粗看，体积主要集中在：

| 表 / 索引 | 约占用 |
|---|---:|
| `staging_relations` | 173MB |
| `staging_items` | 157MB |
| `source_references` | 137MB |
| `idx_source_references_location` | 46MB |
| `review_decisions` | 26MB |
| `idx_source_references_target` | 25MB |
| `change_logs` | 18MB |
| `knowledge_items` | 13MB |

导入任务状态：

| `import_jobs.status` | 数量 | 时间范围 |
|---|---:|---|
| `approved` | 83 | 2026-05-11 至 2026-05-28 |
| `parsed` | 4 | 2026-05-11 至 2026-05-25 |
| `reviewing` | 14 | 2026-05-18 至 2026-05-26 |

已发现一致性信号：

| 检查项 | 数量 | 处理建议 |
|---|---:|---|
| 孤儿 `knowledge_relations` | 0 | 无需处理 |
| active relation 连接 deprecated endpoint | 36 | 可进入关系清理候选 |
| 孤儿 `source_references` | 9 | 可安全清理 |

`deprecated` 对象数量较多的类型：

| 类型 | deprecated 数量 |
|---|---:|
| `security_technical_service` | 235 |
| `information_object` | 143 |
| `security_technology_module` | 66 |
| `work_function` | 22 |
| `scope_type` | 20 |
| `process_reference` | 18 |
| `product` | 14 |

## 3. 清理原则

1. 先备份，再清理，再 `VACUUM`。
2. 不直接硬删 active 正式业务对象。
3. `deprecated` 对象默认保留，除非已确认属于垃圾数据且不需要历史追踪。
4. `staging_*` 和 `review_decisions` 是最大体积来源，可优先归档或删除已审批导入任务的暂存痕迹。
5. `source_references` 是来源追踪核心，不做大面积删除，只清明显孤儿记录或按保留策略瘦身。
6. `OI-124` 不建议用 SQL 直接改名；应先修 ETL / export 归一逻辑，再重新导出并跑审计。
7. 清理后必须重新导出前端数据包，并用审计脚本验证字段边界和权威引用。

## 4. 推荐清理顺序

### Step 0：停止服务并备份

```bash
python3 scripts/dev_server_guard.py --status
cp data/database/sapd_wiki.sqlite3 data/database/backups/sapd_wiki-before-cleanup-$(date +%Y%m%d%H%M%S).sqlite3
sqlite3 data/database/sapd_wiki.sqlite3 "PRAGMA integrity_check;"
```

如果 `5173` 服务正在运行，建议先停止或确认没有写入操作。

### Step 1：文件层清理候选

可清理候选：

- `data/database/sapd_wiki.db`：0 字节，占位文件。
- `data/database/sapd_wiki.sqlite`：0 字节，占位文件。
- `data/database/backups/`：历史备份约 `9.6GB`，建议保留最近 3-5 个关键备份，其余移动到外部归档盘或压缩归档。
- `data/exports/worker-verify/*.sqlite3`：属于核对过程库，不应进入正式运行路径，清理前确认不再用于人工校对。

不要清理：

- `data/database/sapd_wiki.sqlite3` 当前主库。
- 当前 release / bundle 目录中的 alpha 试发材料，除非另做交付归档。
- `frontend/capability-browser/public/data/*.json`，这些是前端离线 fallback 包，清理数据库后应重新生成，而不是手工删。

### Step 2：清理已审批任务的 staging / review 痕迹

这一步能释放最大空间，但会丢失逐条暂存审查痕迹。`import_jobs.summary_json`、`change_logs` 和正式表仍保留导入历史摘要。

先只读估算：

```sql
SELECT job.status, COUNT(*) AS jobs,
       COUNT(staging_items.id) AS staging_items,
       COUNT(staging_relations.id) AS staging_relations,
       COUNT(review_decisions.id) AS review_decisions
FROM import_jobs AS job
LEFT JOIN staging_items ON staging_items.import_job_id = job.id
LEFT JOIN staging_relations ON staging_relations.import_job_id = job.id
LEFT JOIN review_decisions ON review_decisions.import_job_id = job.id
GROUP BY job.status;
```

建议首轮只清 `approved` 的暂存数据：

```sql
BEGIN;

DELETE FROM review_decisions
WHERE import_job_id IN (
  SELECT id FROM import_jobs WHERE status = 'approved'
);

DELETE FROM staging_relations
WHERE import_job_id IN (
  SELECT id FROM import_jobs WHERE status = 'approved'
);

DELETE FROM staging_items
WHERE import_job_id IN (
  SELECT id FROM import_jobs WHERE status = 'approved'
);

COMMIT;
```

`reviewing` 的 14 个任务必须先人工确认是否废弃。确认废弃后，建议先把任务标记为 `rejected` 或 `failed`，再按相同策略清 staging。

### Step 3：清理明显孤儿来源引用

当前只读检查发现 9 条孤儿 `source_references`。可用以下 SQL 清理：

```sql
BEGIN;

DELETE FROM source_references
WHERE target_type = 'item'
  AND NOT EXISTS (
    SELECT 1 FROM knowledge_items
    WHERE knowledge_items.id = source_references.target_id
  );

DELETE FROM source_references
WHERE target_type = 'relation'
  AND NOT EXISTS (
    SELECT 1 FROM knowledge_relations
    WHERE knowledge_relations.id = source_references.target_id
  );

COMMIT;
```

### Step 4：处理连接 deprecated endpoint 的关系

当前存在 36 条 active relation 连接 deprecated endpoint。因为 `knowledge_relations` 没有独立 `status` 字段，建议删除这些关系前同步删除对应 relation 来源引用。

先导出候选，人工扫一眼：

```sql
SELECT rel.id,
       rel.relation_type,
       source.type AS source_type,
       source.code AS source_code,
       source.title AS source_title,
       source.status AS source_status,
       target.type AS target_type,
       target.code AS target_code,
       target.title AS target_title,
       target.status AS target_status
FROM knowledge_relations AS rel
JOIN knowledge_items AS source ON source.id = rel.source_item_id
JOIN knowledge_items AS target ON target.id = rel.target_item_id
WHERE source.status != 'active'
   OR target.status != 'active';
```

确认后再执行：

```sql
BEGIN;

CREATE TEMP TABLE cleanup_relation_ids(id TEXT PRIMARY KEY);

INSERT INTO cleanup_relation_ids(id)
SELECT rel.id
FROM knowledge_relations AS rel
JOIN knowledge_items AS source ON source.id = rel.source_item_id
JOIN knowledge_items AS target ON target.id = rel.target_item_id
WHERE source.status != 'active'
   OR target.status != 'active';

DELETE FROM source_references
WHERE target_type = 'relation'
  AND target_id IN (SELECT id FROM cleanup_relation_ids);

DELETE FROM knowledge_relations
WHERE id IN (SELECT id FROM cleanup_relation_ids);

DROP TABLE cleanup_relation_ids;

COMMIT;
```

### Step 5：`deprecated` 对象处理策略

不建议首轮硬删 `deprecated` 对象。原因：

- 这些对象记录了历史导入和自动停用结果。
- 后续 `stable_key` / redirect 机制还没完全落地。
- `source_references`、`change_logs`、`item_aliases` 可能仍需要它们做追溯。

如果用户明确确认某类对象属于垃圾数据，再按类型逐步处理。建议优先只做候选导出：

```sql
SELECT type, code, title, created_at, updated_at
FROM knowledge_items
WHERE status = 'deprecated'
ORDER BY type, code, title;
```

硬删前必须确认：

- 不属于 `OI-038` 待确认数据；
- 不属于 `OI-124` 待修复权威引用问题；
- 不再被 `knowledge_relations`、`source_references`、`item_aliases`、`change_logs` 需要。

### Step 6：修复 `OI-124`

`OI-124` 的正确处理路径是：

1. 运行当前审计确认问题分布：

```bash
node scripts/audit_dictionary_reference_consistency.mjs
```

2. 在 `src/sapd_wiki/exports.py` 或相关 parser / transformer 中把引用归一到知识库字典权威对象。
3. 重新生成相关数据包：

```bash
python3 scripts/sapd_wiki.py export-frontend-workbenches
python3 scripts/sapd_wiki.py export-maintenance-knowledge
python3 scripts/sapd_wiki.py export-shared-lookups
python3 scripts/sapd_wiki.py export-lifecycle-knowledge
python3 scripts/sapd_wiki.py export-standard-frameworks-data
```

4. 再跑审计，确认 `scope_type` 和 `security_technical_measure` 错误归零或全部有明确业务接受说明。

不要用 SQL 直接批量替换旧名称，否则前端包、导出逻辑和下一次重建会再次漂移。

### Step 7：回收 SQLite 空间

执行删除后，SQLite 文件不会自动变小。确认清理结果无误后执行：

```sql
PRAGMA integrity_check;
VACUUM;
ANALYZE;
PRAGMA optimize;
```

如果想先生成一份压缩后的新库而不覆盖当前文件，可用：

```sql
VACUUM INTO 'data/database/sapd_wiki.cleaned.sqlite3';
```

确认新库通过验证后，再决定是否替换主库。

## 5. 验证清单

清理后至少执行：

```bash
sqlite3 data/database/sapd_wiki.sqlite3 "PRAGMA integrity_check;"
python3 scripts/sapd_wiki.py summary
node scripts/audit_dictionary_reference_consistency.mjs
python3 scripts/data_package_summary.py --package maintenance-knowledge
python3 scripts/data_package_summary.py --package capability-workbench
python3 scripts/dev_server_guard.py --status
node scripts/frontend_smoke_check.mjs --page /knowledge/scopes
node scripts/frontend_smoke_check.mjs --page /knowledge/technical
node scripts/frontend_smoke_check.mjs --page /knowledge/functions
node scripts/frontend_smoke_check.mjs --page /capability-mapping
python3 scripts/check_github_data_boundary.py
```

如果本轮只做数据库和数据包，不改前端代码，默认不用启动系统 Chrome。

## 6. 字段边界检查

主展示区仍不得出现以下非业务字段：

```text
sheet, row, column, raw_value, source_file, import_id, source_id,
source_ref, source_label, debug, raw, metadata, intermediate, generated_at
```

清理或重新导出后，重点检查：

- `maintenance-knowledge.json` 和 `maintenance/*.json` 主分片不泄露来源追踪字段。
- source evidence 分片可以保留来源证据，但不得被主表直接展示。
- `dataClient` 和 ViewModel 不新增绕过 `/api/v1/*` 或后端生成数据包的读取路径。

## 7. 建议分工

推荐拆成三轮小任务：

| 轮次 | 目标 | 输出 |
|---|---|---|
| A | 文件层瘦身 | 清理 0 字节库、归档老备份、保留当前主库和关键恢复点 |
| B | 数据库内部瘦身 | 清 approved staging / review、孤儿来源引用、deprecated endpoint 关系，执行 `VACUUM` |
| C | 权威引用修复 | 修 `OI-124` 的 ETL/export 归一逻辑，重新生成前端数据包并审计 |

不建议把三轮混在一起做。A / B 是空间和历史痕迹清理，C 是业务数据一致性修复，风险不同。

## 8. 完成后必须更新

- `progress.md`：记录清理命令、清理前后大小、表计数和验证结果。
- `docs/06-implementation/open-issues.md`：如果修复 `OI-124`，更新状态、修复说明和验证结果。
- `docs/07-governance/data-governance.md`：如果新增清理保留周期或硬删策略，写入治理规则。
- `docs/01-architecture/frontend-json-data-package-inventory.md`：如果新增、删除或拆分前端数据包，更新台账。
