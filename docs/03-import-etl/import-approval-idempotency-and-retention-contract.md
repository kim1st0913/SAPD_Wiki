# 导入审批幂等与中间数据保留契约

## 1. 文档状态

- 契约版本：`1.0`
- 确认日期：`2026-07-19`
- 当前状态：`specified / not implemented`
- 适用范围：项目正式基础库的 Excel 导入、审批、来源追踪、导入摘要导出和 staging / review 生命周期。
- 不适用范围：用户库导入、成熟度客户资料导入、前端页面导入向导和历史重复来源引用的存量去重。

本文档补充 `excel-import-mvp-design.md`。两者不一致时，审批状态门禁、来源引用幂等、按 job 清理和默认导出任务选择以本文档为准。

## 2. 背景与已验证问题

2026-07-19 清理正式主库历史导入中间数据后，在 `/private/tmp` 的主库副本上使用 `安全工作职能清单` 完成新导入 smoke：

- staging 正常生成 `162` 个对象和 `247` 条关系；
- 第一次 approve 正常更新 `162` 个对象，复用既有关系，并新增 `651` 条来源引用；
- 对同一 job 再次执行 approve，当前实现再次新增 `651` 条来源引用和 `162` 条变更日志；
- `review_decisions` 因已有局部去重没有重复增长；
- `export-second-batch-summary` 未指定 job 时选择了结束时间最新的 rejected job，而不是最新 approved job。

上述 smoke 未写入正式主库。它证明新导入不依赖已清理的历史 staging，但当前实现缺少审批幂等、来源引用幂等、中间数据终结和默认导出状态过滤。

## 3. 导入任务生命周期

正式主库导入遵循以下生命周期：

```text
pending / parsed
    -> reviewing
    -> approved
    -> verified
    -> intermediate_purged

reviewing
    -> rejected / failed
    -> diagnosed
    -> intermediate_purged
```

数据库可以继续使用现有 `import_jobs.status` 枚举。`verified` 和 `intermediate_purged` 是治理状态，第一版可记录在 `summary_json.import_lifecycle`，不要求立即扩展 schema。

稳定流程为：

```text
stage
-> review
-> approve once
-> export / package verification
-> business acceptance
-> finalize-import dry-run
-> finalize-import apply
```

禁止在 approve 后立即无条件删除 staging。逐行审查证据应保留到本 job 的导出、数据审计和业务验收完成。

## 4. 批准状态门禁

### 4.1 允许状态

只有 `status=reviewing` 的 job 可以进入 approve。状态判定必须与正式表写入位于同一个 `BEGIN IMMEDIATE` 事务中。

| 当前状态 | approve 行为 |
|---|---|
| `reviewing` | 允许继续，执行现有 validation 和正式表写入 |
| `approved` | 拒绝且不写入，返回 `IMPORT_ALREADY_APPROVED` |
| `pending` / `parsed` | 拒绝且不写入，返回 `IMPORT_NOT_STAGED` |
| `rejected` / `failed` | 拒绝且不写入，返回 `IMPORT_JOB_CLOSED` |
| job 不存在 | 返回 `IMPORT_JOB_NOT_FOUND` |

### 4.2 原子性

- 进入事务后重新读取 job 状态，不使用事务外缓存状态。
- SQLite 单写者锁保证并发 approve 串行化；第二个请求必须在第一个提交后看到 `approved` 并停止。
- 正式对象、关系、来源引用、变更日志、review decision 和 job 状态更新必须同事务提交。
- 任一步失败时全部回滚，job 保持 `reviewing`。
- job 只有在正式写入和完整性断言通过后才能更新为 `approved`。

### 4.3 重复操作响应

重复 approve 不是成功重放。CLI 应返回非零退出码，API 后续应返回冲突状态，并明确显示原 job 已批准。不得再次更新正式对象，不得追加来源引用、变更日志或 review decision。

### 4.4 验收断言

- 同一 job 连续 approve 两次，第二次正式表写入数必须为 `0`。
- 两个并发 approve 只有一个成功。
- 第二次 approve 前后 `knowledge_items`、`knowledge_relations`、`source_references` 和 `change_logs` 指纹一致。

## 5. 来源引用幂等写入

### 5.1 证据唯一键

`source_references` 的逻辑证据键为：

```text
target_type
+ target_id
+ source_file_id
+ source_sheet
+ source_row
+ source_column
+ source_cell
+ raw_value
+ source_hash
```

可空字段必须按“值 + 是否为 NULL”稳定序列化，不能依赖普通 SQLite UNIQUE 对 NULL 的默认行为。不得对 `raw_value` 做会改变来源证据的 trim、大小写转换或业务归一化。

### 5.2 写入行为

- 写入前按完整证据键检查已有记录。
- 已存在时复用，不生成新 UUID；审批摘要增加 `source_references_reused`。
- 不存在时新增；审批摘要保留 `source_references_created`。
- 不同 target、不同文件 hash、不同 Sheet / 单元格或不同原始值仍是独立合法证据。
- 不允许仅按 `source_hash` 或 `raw_value` 合并来源引用。

第一版可以使用应用层 `SELECT ... WHERE NOT EXISTS`。如增加数据库约束，必须使用可空字段规范化后的表达式唯一索引，并先单独治理存量重复记录。

### 5.3 存量边界

当前已识别的 `65,824` 条完全重复来源引用属于历史存量，不在本契约实施时自动删除。实现幂等写入的目标是停止新增重复；存量去重必须使用独立备份、候选报告和验收任务。

### 5.4 验收断言

- 相同 job 被门禁阻止后，来源引用新增数为 `0`。
- 使用同 hash 文件创建新 job 并批准，已存在的完全相同证据只计入 reused。
- 文件 hash 或单元格位置变化时，合法新证据仍能写入。
- 来源引用 orphan 数保持 `0`。

## 6. 按 job 的验收后清理命令

### 6.1 计划命令

以下是待实现的规范命令，当前尚不可用：

```bash
python3 scripts/sapd_wiki.py finalize-import <import-job-id>
python3 scripts/sapd_wiki.py finalize-import <import-job-id> \
  --apply \
  --allow-project-db-write
```

第一条默认 dry-run，只打印 job 状态、预计删除数量、正式表基线和停止原因。第二条才允许写入真实主库。

### 6.2 可清理状态

| job 状态 | 是否允许 finalize |
|---|---|
| `approved` | 仅在该 job 的导出、数据审计和业务验收完成后允许 |
| `rejected` / `failed` | 在错误报告和诊断证据留存后允许 |
| `reviewing` | 禁止，仍可能需要逐行审查 |
| `pending` / `parsed` | 禁止；应先明确转为 failed / rejected 或继续 staging |

### 6.3 清理范围

命令只能按一个显式 job ID 删除：

1. `review_decisions`
2. `staging_relations`
3. `staging_items`

必须保留：

- `import_jobs` 记录；
- 原 `summary_json`，并追加 `import_lifecycle.intermediate_cleanup` 的时间、删除计数和验证结果；
- `source_files`、`source_references`、`change_logs`；
- 正式对象和正式关系。

### 6.4 安全与回退

- 默认 dry-run；真实主库 apply 必须显式确认。
- 使用 `BEGIN IMMEDIATE`，删除计数与 dry-run 不一致时回滚。
- 普通单 job 清理先导出该 job 的三张中间表为临时局部恢复包；批量清理或同时执行 `VACUUM` 时必须建立完整主库 checkpoint。
- 清理后执行 `integrity_check`、`foreign_key_check` 和正式表逻辑指纹检查。
- 已清理 job 再次 finalize 应返回 `already_finalized`，删除数为 `0`。
- 不默认执行 `VACUUM`。删除页留给 SQLite 复用；只有达到维护阈值或批量清理时独立执行原地压缩。

## 7. 默认导出只选择 approved 任务

### 7.1 默认选择

所有“未显式传 import job ID”的导入结果导出必须调用同一个 latest-approved selector：

```sql
SELECT id
FROM import_jobs
WHERE status = 'approved'
ORDER BY finished_at DESC, started_at DESC
LIMIT 1;
```

禁止按所有状态的 `finished_at` 选择最新任务。`rejected`、`failed`、`reviewing`、`parsed` 和 `pending` 不得成为默认正式导出来源。

### 7.2 显式选择

- 用户显式传 `--import-job-id` 时，可以导出 reviewing / rejected / failed 的诊断报告。
- 非 approved 报告必须在顶层携带真实 `job_status`，不得使用“正式导入结果”措辞。
- 指定 job 已 finalize 时，导出使用 `summary_json` 和正式追踪摘要；需要逐行 staging 的报告应明确返回 `intermediate_detail_purged`。
- 没有 approved job 时，默认正式导出必须失败并返回 `NO_APPROVED_IMPORT_JOB`，不得退回任意最新任务。

## 8. 每次导入后的标准操作

1. `stage-excel` 创建新的 reviewing job。
2. 检查 validation、候选数量、来源 hash 和 selected sheets。
3. 显式记录本次 job ID，后续命令不依赖“最新任务”猜测。
4. 只批准一次；重复批准必须被状态门禁阻止。
5. 使用本 job ID 生成导入摘要、数据包和审计报告。
6. 验证正式对象、关系、来源、受保护基线和页面 / API 投影。
7. 用户或任务验收通过后，对该 job 执行 `finalize-import` dry-run。
8. dry-run 计数一致后 apply，保留 import job 摘要和正式追踪。
9. 不为每个 job 执行 `VACUUM`；按 freelist 和磁盘维护计划批量处理。

## 9. 验收矩阵

| 场景 | 预期结果 |
|---|---|
| reviewing job 首次 approve | 正常写入并转为 approved |
| approved job 再次 approve | 明确拒绝，所有正式表写入为 0 |
| 两个并发 approve | 只有一个成功，另一个在状态门禁停止 |
| 同 hash 文件重新导入 | 来源文件复用，完全相同来源证据不重复新增 |
| 新 hash 或新单元格证据 | 写入新的来源引用 |
| finalize-import 默认执行 | 只输出 dry-run，不写数据库 |
| finalize approved job | 只删除该 job 的三类中间数据，正式表指纹不变 |
| finalize reviewing job | 拒绝且删除数为 0 |
| 重复 finalize | 返回 already_finalized，删除数为 0 |
| rejected job 时间最新 | 默认正式导出仍选择最新 approved job |
| 无 approved job | 默认正式导出失败，不回退到其他状态 |
| 用户库边界 | 全流程不建立用户库写连接，用户库 hash 不变 |

## 10. 实施顺序与完成条件

建议按以下顺序实现，避免一个修复掩盖另一个问题：

1. 为重复 approve、并发 approve 和错误状态补失败测试。
2. 在 `approve_import` 增加事务内状态门禁。
3. 为来源引用增加逻辑证据键和 created / reused 计数。
4. 实现 `finalize-import` dry-run、apply、局部恢复和重复执行语义。
5. 把默认导出切换到共享 latest-approved selector。
6. 在临时数据库完成 stage -> approve -> duplicate approve -> export -> finalize 全链路测试。
7. 通过数据边界和受保护基线检查后，才允许在真实主库使用新命令。

四项能力全部实现并通过第 9 节矩阵后，本文档状态才能改为 `implemented / verified`。在此之前不得声称后续导入已自动防重复或自动清理。

## 11. 非目标

- 本契约不自动删除历史 65,824 条重复来源引用。
- 不把 staging/review 清理并入 approve 同一动作。
- 不改变对象匹配键、旧对象停用、Sheet 解析或业务映射规则。
- 不覆盖人工保护对象、源 Excel、正式前端 JSON 或用户库。
- 不要求每次导入新建或迁移主库。
