# 数据库备份整理清单（2026-06-01）

> 归档状态：`completed / dated cleanup evidence`

本清单记录 2026-06-01 本地数据库清理 R0 / R1 的实际文件动作。

## 本轮动作

| 动作 | 结果 |
|---|---|
| 当前主库完整性检查 | `sqlite3 data/database/sapd_wiki.sqlite3 "PRAGMA integrity_check;"` 返回 `ok` |
| 当前主库 checkpoint | 已复制为 `data/database/backups/sapd_wiki-before-cleanup-20260601-current.sqlite3` |
| 0 字节占位库 | 已删除 `data/database/sapd_wiki.db`、`data/database/sapd_wiki.sqlite` |
| 历史备份整理 | 已将 34 个旧 `.sqlite3` 备份移动到 `data/database/backups/archive-historical-2026-06-01/` |
| 永久删除历史备份 | 未执行 |
| 压缩历史备份 | 未执行 |

## 2026-06-01 追加清理

用户确认全局规则调整为：只保留最新 `5` 个数据库备份；若出现新备份，则删除时间戳最早的旧备份。

当前执行结果：

| 动作 | 结果 |
|---|---|
| 最新备份保留规则 | 已写入 `docs/07-governance/data-governance.md` |
| 执行脚本 | 已新增 `scripts/prune_database_backups.py`，默认 dry-run，`--apply` 才删除 |
| 当前保留备份数 | `3`，未达到 `5` 上限 |
| 已删除旧备份 | 已从归档目录中删除除最新 3 个以外的旧 `.sqlite3` 备份 |
| `worker-verify` | 未移动、未删除 |

## 当前备份目录结构

| 路径 | 用途 | 当前大小 |
|---|---|---:|
| `data/database/backups/sapd_wiki-before-cleanup-20260601-current.sqlite3` | 本轮清理前主库 checkpoint | 约 `69MB` |
| `data/database/backups/archive-historical-2026-06-01/` | 2026-05 历史备份归档区，当前只保留最新 2 个历史备份 | 约 `1.2GB` |

## 保留策略

- `sapd_wiki-before-cleanup-20260601-current.sqlite3` 是本轮后续 R2 / R3 / R4 的优先恢复点。
- `archive-historical-2026-06-01/` 当前只保留 2 个历史备份；后续与根目录 checkpoint 合计遵守“最新 5 个”规则。
- 新增备份后运行 `python3 scripts/prune_database_backups.py --apply`，自动删除时间戳最早的旧备份。
- 当前主库仍为 `data/database/sapd_wiki.sqlite3`，本轮未改写数据库内容。

## 回滚方式

如后续清理导致主库异常：

1. 先复制异常现场库，保留证据。
2. 用 `data/database/backups/sapd_wiki-before-cleanup-20260601-current.sqlite3` 覆盖 `data/database/sapd_wiki.sqlite3`。
3. 执行：

```bash
sqlite3 data/database/sapd_wiki.sqlite3 "PRAGMA integrity_check;"
python3 scripts/sapd_wiki.py summary
```
