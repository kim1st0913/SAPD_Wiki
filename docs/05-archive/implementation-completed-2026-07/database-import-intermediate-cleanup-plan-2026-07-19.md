# 数据库导入中间数据清理方案（2026-07-19）

> 归档状态：`completed / one-time cleanup evidence`。后续导入审批与清理以
> `docs/03-import-etl/import-approval-idempotency-and-retention-contract.md` 为准。

## 1. 状态与目标

- 状态：`complete`，已于 `2026-07-19T13:24:50Z` 按本方案执行并通过验收。
- 目标：一次性清理当前正式主库中已经完成或废弃的导入 staging / review 载荷，保留正式知识、来源追踪和导入摘要。
- 执行方式：直接在当前 `data/database/sapd_wiki.sqlite3` 内事务清理并原地压缩，不新建主库、不替换主库、不执行数据迁移。
- 影响面：`data / ETL / package`；正式对象、正式关系、用户库和前端正式数据包不得变化。

## 2. 当前基线

| 对象 | 当前数量 | 清理后目标 |
|---|---:|---:|
| `knowledge_items` | 4,678 | 4,678 |
| `knowledge_relations` | 7,757 | 7,757 |
| `source_references` | 194,074 | 194,074 |
| `import_jobs` | 29 | 29 |
| `staging_items` | 12,994 | 0 |
| `staging_relations` | 37,335 | 0 |
| `review_decisions` | 48,003 | 0 |

任务状态与中间载荷：

| 状态 | 任务数 | staging items | staging relations | review decisions |
|---|---:|---:|---:|---:|
| `approved` | 27 | 12,527 | 35,476 | 48,003 |
| `reviewing` | 2 | 467 | 1,859 | 0 |

三张中间表及其索引当前约占 `134.9MB`。清理后若不执行 `VACUUM`，空间会成为 SQLite 内部可复用页，但主库文件不会立即缩小。

## 3. 固定清理边界

### 3.1 清理

1. 清理截至 `2026-07-05 13:36:35` 已批准的 27 个历史任务所关联的：
   - `review_decisions`
   - `staging_relations`
   - `staging_items`
2. 将以下两个未完成任务标记为 `rejected`，补充 `finished_at`，保留原 `summary_json`：
   - `ecdcd493-7b2b-474c-b53a-072760d46460`
   - `3e828d78-98dc-48c3-95e0-56383b55714a`
3. 清理上述两个任务的 staging / review 载荷。

预计删除总量：

- `staging_items=12,994`
- `staging_relations=37,335`
- `review_decisions=48,003`
- 合计 `98,332` 行

### 3.2 保留

- 29 条 `import_jobs` 及其 `summary_json`，作为导入摘要和审计入口。
- 全部 `knowledge_items`、`knowledge_relations`、`source_files`、`source_references` 和 `change_logs`。
- 当前用户库 `data/user/sapd_wiki_user.sqlite3`。
- `data/exports/worker-verify/`、正式前端 JSON、原始 Excel、受保护字典与基线。
- 65,824 条完全重复的来源引用不并入本次清理，另行制定精确去重方案。

## 4. 执行工具

新增受控脚本 `scripts/cleanup_import_intermediate_data.py`，要求：

- 默认仅 dry-run；必须显式传入 `--apply` 才允许写入。
- 仅接受当前项目主库路径，并设置项目真实库显式确认门。
- 使用固定截止时间、两个 reviewing job ID 和预期计数建立 allowlist；任一计数不一致立即停止。
- 记录清理前后计数、任务 ID、删除行数、文件大小和验证结果。
- 使用 `PRAGMA foreign_keys=ON` 和 `BEGIN IMMEDIATE`，所有删除与任务状态更新必须在一个事务内完成。
- 删除顺序固定为 `review_decisions -> staging_relations -> staging_items`。
- 事务提交前校验正式表逻辑指纹；任一指纹、计数或完整性断言变化则回滚。
- `VACUUM` 独立为显式参数，不与删除事务隐式绑定。

## 5. 回滚预案

按用户执行前备份要求，本轮没有迁移或替换主库，而是用 SQLite online backup 建立完整恢复点：

`data/database/backups/sapd_wiki.before-import-intermediate-cleanup-20260719T132403Z.sqlite3`

- 大小：`283496448` bytes
- SHA-256：`d819d66553afac0368b96dc9c619ad5f2e5dfc436d9be439ad56a77b8618d280`
- `integrity_check=ok`
- 正式表逻辑指纹、中间表计数与清理前主库完全一致
- 已纳入全局最新 5 个备份保留规则

回滚分两层：

1. 提交前失败：事务自动 `ROLLBACK`，主库不变化。
2. 提交后验证失败：先保存失败现场，再停止数据库写入，用上述完整恢复点执行 SQLite restore，随后重跑完整性与正式表指纹检查。

## 6. 验收门禁

必须全部通过后才算完成：

1. `PRAGMA integrity_check` 返回 `ok`。
2. `PRAGMA foreign_key_check` 返回 `0` 条；当前 5 条 staging 悬空告警应随中间载荷清理消失。
3. `knowledge_items=4678`、`knowledge_relations=7757`、`source_references=194074`。
4. `staging_items=0`、`staging_relations=0`、`review_decisions=0`。
5. `import_jobs=29`，状态为 `approved=27 / rejected=2`。
6. `knowledge_items`、`knowledge_relations`、`source_files`、`source_references`、`change_logs` 的清理前后逻辑指纹完全一致。
7. 用户库文件 hash、大小和修改时间不变；用户库不建立写连接。
8. `python3 scripts/sapd_wiki.py summary` 通过。
9. `python3 scripts/audit_protected_baseline_no_regression.py` 通过。
10. `python3 scripts/audit_json_package_boundary.py` 与 `python3 scripts/check_github_data_boundary.py` 通过。

## 7. 空间回收

删除事务和验收通过后执行原地主库维护：

```sql
VACUUM;
ANALYZE;
PRAGMA optimize;
```

这一步只压缩当前主库，不生成或替换新主库。预计可释放约 `120-135MB`，实际结果以执行后的文件大小为准。执行 `VACUUM` 前应确认没有正在运行的导入写任务，并预留不少于当前主库大小的临时磁盘空间。

## 8. 停止条件

出现以下任一情况立即停止，不提交清理：

- 任务数或预计删除行数与本方案不一致。
- 出现新的 `pending`、`parsed` 或 `reviewing` 导入任务。
- 正式表逻辑指纹发生变化。
- 用户库被打开为可写或修改时间发生变化。
- `integrity_check` 不为 `ok`。
- 当前运行时或导出代码被发现直接依赖 staging / review 明细。

## 9. 实际执行结果

- 清理脚本：`scripts/cleanup_import_intermediate_data.py`
- 执行报告：`data/database/cleanup-reports/import-intermediate-cleanup-20260719T132403Z.json`
- 删除：`review_decisions=48003`、`staging_relations=37335`、`staging_items=12994`，合计 `98332` 行。
- 任务状态：`approved=27 / rejected=2`，`import_jobs=29` 保留。
- 正式数据：`knowledge_items=4678`、`knowledge_relations=7757`、`source_references=194074`，清理前后逻辑指纹一致。
- 数据库检查：`integrity_check=ok`、`foreign_key_check=0`。
- 文件大小：`283496448 -> 136200192` bytes，释放 `147296256` bytes，约 `140.5MiB`。
- 用户库：大小、修改时间和 SHA-256 均未变化。
- 独立验收：主库 summary、受保护基线、JSON package boundary、GitHub data boundary 均通过。
- 备份保留：新增恢复点后已删除最早的 1 个旧备份，`data/database/backups/` 恢复为最新 5 个。

## 10. 后续导入防复发

本轮脚本是固定基线的一次性历史清理工具，不作为后续 import job 的常规终结命令。后续导入的批准状态门禁、来源引用幂等、按 job 的验收后清理命令和默认 approved 导出契约，统一见：

`docs/03-import-etl/import-approval-idempotency-and-retention-contract.md`

该契约当前为 `specified / not implemented`。实现完成前，同一 job 不得重复 approve；导出命令应显式传入已批准 job ID；验收后的中间数据不得使用本轮固定 allowlist 脚本清理。
