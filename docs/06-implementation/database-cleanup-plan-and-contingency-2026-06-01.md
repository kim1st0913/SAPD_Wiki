# 数据库整体清理计划与预案（2026-06-01）

本文档用于指导 SAPD Wiki 本地数据库、历史备份、导出产物和前端离线数据包的整体清理。它不是立即执行脚本，而是清理前的作战图：明确清理对象、执行顺序、验收标准、回滚办法和暂停条件。

相关交接事实见 `docs/06-implementation/database-cleanup-handoff-2026-06-01.md`。由于 2026-06-01 后续已执行过 `bootstrap-local-data --reset`，本文以当前只读体检结果为准。

## 1. 清理目标

本次清理解决四类问题：

| 类别 | 当前现象 | 目标 |
|---|---|---|
| 历史备份过大 | `data/database/backups/` 约 `9.6GB`，共 34 个历史 SQLite 备份 | 保留关键恢复点，其余转移或归档 |
| 当前主库运行痕迹 | 当前主库约 `69MB`，仍包含 staging / review 记录 | 只在确认不再需要逐条审查后瘦身 |
| 导出目录膨胀 | `data/exports/` 约 `600MB` | 区分当前必要导出、人工校对材料和过期中间产物 |
| 数据一致性尾项 | `OI-124` 仍有 `ALL / 全部作用域` 口径和 4 个生命周期技术措施非权威 ID 引用 | 走 ETL/export 修复，不用 SQL 临时替换 |

不在本轮做：

- 不重构数据库 schema。
- 不新增数据源或 Sheet。
- 不删除 active 正式业务对象。
- 不把真实数据库、原始数据或生成数据提交到 GitHub。
- 不通过前端 ViewModel 临时修数据。

## 2. 当前基线

2026-06-01 当前只读体检：

| 项目 | 当前值 |
|---|---:|
| `data/database/sapd_wiki.sqlite3` | 约 `69MB` |
| `data/database/` | 约 `10GB` |
| `data/database/backups/` | 约 `9.6GB` |
| `frontend/capability-browser/public/data/` | 约 `135MB` |
| `data/exports/` | 约 `600MB` |
| `data/database/backups/*.sqlite3` | `34` 个 |
| `data/database/sapd_wiki.db` | `0B` |
| `data/database/sapd_wiki.sqlite` | `0B` |

当前主库表计数：

| 表 | 数量 |
|---|---:|
| `knowledge_items` | 4,648 |
| `knowledge_relations` | 7,642 |
| `source_references` | 25,515 |
| `source_files` | 1 |
| `import_jobs` | 4 |
| `staging_items` | 4,822 |
| `staging_relations` | 7,642 |
| `change_logs` | 12,464 |
| `review_decisions` | 12,464 |

当前一致性体检：

| 检查项 | 结果 |
|---|---:|
| 孤儿 `knowledge_relations` | 0 |
| 连接 deprecated endpoint 的关系 | 0 |
| 孤儿 `source_references` | 0 |
| 非 active `knowledge_items` | 0 |
| `import_jobs.status` | 4 个均为 `approved` |

当前主库体积大头：

| 表 / 索引 | 约占用 |
|---|---:|
| `staging_items` | 16MB |
| `knowledge_items` | 12MB |
| `staging_relations` | 8.9MB |
| `source_references` | 8.0MB |
| `knowledge_relations` | 4.7MB |
| `change_logs` | 2.8MB |
| `review_decisions` | 2.0MB |

## 3. 总体执行策略

采用“四轮清理 + 一轮修复”的顺序：

| 轮次 | 名称 | 风险级别 | 是否改主库 | 目标 |
|---|---|---|---|---|
| R0 | 清理前冻结与备份 | 低 | 否 | 固定恢复点和基线指标 |
| R1 | 文件层瘦身 | 中 | 否 | 处理 0 字节库、历史备份、过期导出 |
| R2 | 主库 staging / review 瘦身 | 中高 | 是 | 删除已审批导入的暂存审查痕迹并 `VACUUM` |
| R3 | 数据包再生成与页面回归 | 中 | 间接 | 确认前端仍能从当前主库生成一致数据 |
| R4 | `OI-124` 数据一致性修复 | 高 | 可能 | 修 ETL/export 权威引用，不直接 SQL 补丁 |

建议一次只做一轮。每轮结束后生成小结，再决定是否进入下一轮。

## 4. R0：清理前冻结与备份

目标：让任何后续误操作都能回到当前状态。

执行前检查：

```bash
git status --short --branch
python3 scripts/dev_server_guard.py --status
sqlite3 data/database/sapd_wiki.sqlite3 "PRAGMA integrity_check;"
python3 scripts/sapd_wiki.py summary
node scripts/audit_dictionary_reference_consistency.mjs
python3 scripts/check_github_data_boundary.py
```

建议建立两个恢复点：

1. Git checkpoint：只包含代码、文档、脚本，不包含数据库和生成数据。
2. 数据库 checkpoint：复制当前 `data/database/sapd_wiki.sqlite3` 到 `data/database/backups/`，文件名带 `before-cleanup` 和时间戳。

验收标准：

- `PRAGMA integrity_check` 返回 `ok`。
- 确认当前主库路径是 `data/database/sapd_wiki.sqlite3`。
- 记录清理前主库大小、备份目录大小、导出目录大小和核心表计数。

回滚方式：

- 代码/文档回滚：使用 Git checkpoint。
- 数据回滚：用 checkpoint SQLite 覆盖当前主库；覆盖前先保存失败现场副本。

## 5. R1：文件层瘦身

目标：先清理不影响业务数据结构的磁盘空间。

### 5.1 0 字节占位库

候选：

- `data/database/sapd_wiki.db`
- `data/database/sapd_wiki.sqlite`

处理建议：

- 删除前用 `ls -lh` 确认仍为 `0B`。
- 删除后确认代码默认库仍指向 `data/database/sapd_wiki.sqlite3`。

风险：

- 低。若外部脚本误指向这些文件，删除后会暴露配置错误，反而有利于修正。

### 5.2 历史备份库

当前 `data/database/backups/` 是最大磁盘来源，约 `9.6GB`。

建议保留：

- 最近一次 `before-cleanup` 备份。
- 最近一次 `bootstrap-local-data --reset` 前后可用备份。
- 与重大数据修复相关的 3-5 个关键备份，例如标准/框架导入、LC-AP/LC-DT 修复、服务对齐修复。

建议处理：

- 不直接永久删除第一批历史备份。
- 先移动到项目外部归档目录或压缩包。
- 保留一份 `backup-retention-manifest.md`，记录保留/转移/删除原因。

风险：

- 中。历史备份删除后，会降低回看早期导入状态的能力。

停止条件：

- 用户仍需要对比某个历史 Sheet 导入状态。
- 备份文件名无法判断用途。
- 当前主库或当前前端数据包仍未验收。

### 5.3 导出目录

`data/exports/` 当前约 `600MB`，清理前先分类，不直接清空。

建议分类：

| 类型 | 处理 |
|---|---|
| 当前人工校对材料 | 保留，例如 `worker-verify` 中仍服务于 `OI-038` 的候选映射 |
| 当前 release / bundle 依赖 | 保留，直到交付包重新生成 |
| 过期中间产物 | 移入 `data/exports/archive/` 或项目外归档 |
| 可再生导出 | 可删除，但要记录重建命令 |

停止条件：

- 不确定某个导出是否仍被文档或用户校对流程引用。
- `OI-038` 仍未人工校对完成。

## 6. R2：主库 staging / review 瘦身

目标：减小当前主库中的导入暂存和审批痕迹。

当前主库只有 4 个 `approved` import job，没有 `reviewing` 或 `parsed` 任务。理论上可删除这些已审批任务的 `staging_items`、`staging_relations`、`review_decisions`，保留正式表、`import_jobs.summary_json`、`source_references` 和 `change_logs`。

执行前必须确认：

- 当前 4 个 import job 均为完整重建后的导入任务。
- 不再需要逐条查看 staging 审批明细。
- `source_references` 和 `change_logs` 足够满足追溯。

建议 SQL：

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

空间回收：

```sql
PRAGMA integrity_check;
VACUUM;
ANALYZE;
PRAGMA optimize;
```

更稳妥的做法是先不用原地 `VACUUM`，而是生成新库：

```sql
VACUUM INTO 'data/database/sapd_wiki.cleaned.sqlite3';
```

验收标准：

- `staging_items=0`。
- `staging_relations=0`。
- `review_decisions=0`。
- `knowledge_items=4648` 左右，不因清 staging 变化。
- `knowledge_relations=7642` 左右，不因清 staging 变化。
- `source_references=25515` 左右，不因清 staging 变化。
- `PRAGMA integrity_check` 返回 `ok`。

回滚预案：

- 如果执行后发现导出异常或页面异常，立即停用 cleaned 主库，用 R0 数据库 checkpoint 覆盖恢复。
- 如果只是 `VACUUM INTO` 生成的新库异常，删除新库即可，原主库不动。

## 7. R3：数据包再生成与页面回归

目标：确认清理后的主库仍能生成当前前端所需数据。

推荐命令：

```bash
python3 scripts/sapd_wiki.py export-frontend-workbenches
python3 scripts/sapd_wiki.py export-maintenance-knowledge
python3 scripts/sapd_wiki.py export-shared-lookups
python3 scripts/sapd_wiki.py export-lifecycle-knowledge
python3 scripts/sapd_wiki.py export-standard-frameworks-data
python3 scripts/data_package_summary.py --package maintenance
python3 scripts/data_package_summary.py --package capability-workbench
python3 scripts/data_package_summary.py --package lifecycle-workbench
python3 scripts/dev_server_guard.py --status
node scripts/frontend_smoke_check.mjs --page /knowledge/scopes
node scripts/frontend_smoke_check.mjs --page /knowledge/technical
node scripts/frontend_smoke_check.mjs --page /knowledge/functions
node scripts/frontend_smoke_check.mjs --page /capability-mapping
```

验收标准：

- 核心数据包 `data_state=ready`。
- 页面 smoke 通过。
- 不新增主展示区字段泄露。
- `check_github_data_boundary.py` 通过，确认生成数据未被 Git 追踪提交。

回滚预案：

- 如果导出后的前端页面异常，先恢复上一版前端数据包或重新用 R0 数据库重导。
- 如果问题只出现在某个数据包，优先回看该导出命令和 `src/sapd_wiki/exports.py`，不要在前端硬补。

## 8. R4：`OI-124` 数据一致性修复

目标：清掉剩余权威引用问题，但不和空间清理混在同一轮。

当前尾项：

| 问题 | 当前状态 | 推荐处理 |
|---|---|---|
| `ALL / 全部作用域` | 审计 warning | 需要用户确认是否作为正式 `scope_type` 纳入字典，还是作为跨作用域特殊标记 |
| 4 个生命周期安全技术措施非权威 ID | 审计 fail | 修 ETL/export，让生命周期引用复用知识库字典权威措施 ID |
| Gartner 候选工作职能 | 随 `OI-038` 保持待确认 | 不纳入 `OI-124` 强制修复 |

执行原则：

- 先修 parser / transformer / export 归一逻辑。
- 再 `bootstrap-local-data --reset` 或重导相关数据包。
- 再跑 `audit_dictionary_reference_consistency.mjs`。
- 不用 SQL 直接替换 JSON 或数据库对象 ID。

验收标准：

- `node scripts/audit_dictionary_reference_consistency.mjs` 中 `security_technical_measure` 错误归零。
- `ALL / 全部作用域` 要么进入字典并通过审计，要么在审计脚本中有明确业务接受逻辑。
- `OI-124` 更新修复说明和验证结果。

回滚预案：

- 修 ETL/export 前创建 Git checkpoint。
- 如重建后对象数量大幅异常，恢复 R0 主库并回退代码。
- 如只剩业务口径未确认，保持 `OI-124` 打开，不强行关闭。

## 9. 总体验收清单

全部轮次完成后应确认：

```bash
sqlite3 data/database/sapd_wiki.sqlite3 "PRAGMA integrity_check;"
python3 scripts/sapd_wiki.py summary
node scripts/audit_dictionary_reference_consistency.mjs
python3 scripts/data_package_summary.py --package maintenance
python3 scripts/data_package_summary.py --package capability-workbench
python3 scripts/data_package_summary.py --package environment-workbench
python3 scripts/data_package_summary.py --package lifecycle-workbench
python3 scripts/dev_server_guard.py --status
node scripts/frontend_smoke_check.mjs --page /knowledge/scopes
node scripts/frontend_smoke_check.mjs --page /knowledge/technical
node scripts/frontend_smoke_check.mjs --page /knowledge/functions
node scripts/frontend_smoke_check.mjs --page /capability-mapping
node scripts/frontend_smoke_check.mjs --page /development-security
node scripts/frontend_smoke_check.mjs --page /environment-mapping
python3 scripts/check_github_data_boundary.py
```

必须记录：

- 清理前后 `data/database/` 大小。
- 清理前后 `data/database/backups/` 大小。
- 清理前后 `data/exports/` 大小。
- 清理前后 `sapd_wiki.sqlite3` 大小。
- 核心表计数。
- 审计结果。
- 页面 smoke 结果。

## 10. 字段边界

清理和重导后，主展示区仍不得出现：

```text
sheet, row, column, raw_value, source_file, import_id, source_id,
source_ref, source_label, debug, raw, metadata, intermediate, generated_at
```

允许存在但不能直接上主表：

- source evidence 分片。
- `source_references`。
- `metadata_json`。
- 导入审计报告。
- `change_logs`。

## 11. 风险预案

| 风险 | 触发信号 | 预案 |
|---|---|---|
| 当前主库损坏 | `PRAGMA integrity_check` 非 `ok` | 停止所有后续操作，复制失败现场，用 R0 checkpoint 恢复 |
| 页面数据变空 | `data_package_summary.py` 显示 `missing_file` / `empty` | 回滚数据库或重跑对应 export，不改前端组件 |
| 审计问题扩大 | `audit_dictionary_reference_consistency.mjs` 错误数上升 | 停止进入下一轮，保留失败数据包和日志，回滚 R4 代码 |
| 误删仍需校对的导出 | 用户发现 `OI-038` 校对材料缺失 | 从外部归档或 R0 备份恢复 `data/exports/worker-verify` |
| 历史备份删得过早 | 需要追溯早期导入状态 | 从外部归档恢复；若无归档，只能用 Git 文档和当前源文件重建，信息会缺失 |
| `VACUUM` 后库异常 | 页面或 SQL 查询异常 | 用 R0 checkpoint 覆盖恢复；下一次改用 `VACUUM INTO` |
| Git 误追踪生成数据 | `check_github_data_boundary.py` 失败 | 不提交，检查 `.gitignore` 和 tracked 文件，必要时从 Git index 移除 |

## 12. 暂停条件

出现以下任一情况，停止清理并先向用户确认：

- 需要永久删除历史备份或人工校对材料。
- `OI-038` 所需候选映射文件可能被影响。
- `OI-124` 需要决定 `ALL / 全部作用域` 是否纳入正式字典。
- 清理后核心对象数量变化超过预期。
- 前端任一核心页面 smoke 失败且无法快速定位为数据包生成问题。
- 工作区存在大量未提交改动，且本轮要开始数据库写操作。

## 13. 推荐下一步

建议先执行 R0 + R1：

1. 建立当前主库 checkpoint。
2. 删除两个 0 字节占位库。
3. 整理 `data/database/backups/`，先移动归档，不做永久删除。
4. 只分类 `data/exports/`，暂不清 `worker-verify`。

R2 需要用户确认是否接受“已审批 staging 明细不再保留在主库中”。确认后再执行主库瘦身。
