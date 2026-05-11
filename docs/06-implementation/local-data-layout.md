# 本地数据目录约定

本文档定义开发阶段和打包后运行阶段的数据存放边界。

## 1. 开发阶段目录

| 目录 | 是否提交 GitHub | 用途 |
|---|---|---|
| `data/raw-samples/` | 否 | 用户手工放入的样例文件 |
| `data/raw/` | 否 | 后续正式导入的原始文件仓库 |
| `data/database/` | 否 | 本地 SQLite 数据库 |
| `data/processed/` | 否 | ETL 中间产物 |
| `data/previews/` | 否 | PPT、Draw.io 等预览文件 |
| `data/exports/` | 否 | 导出文件 |
| `db/migrations/` | 是 | 数据库迁移脚本 |
| `docs/` | 是 | 设计、规则、说明文档 |

开发阶段默认数据库路径：

```text
data/database/sapd_wiki.sqlite3
```

## 2. 打包后运行阶段

打包成桌面应用后，不应把数据库写在安装目录里，而应写入应用数据目录。

建议逻辑路径：

```text
<app_data_dir>/SAPD_Wiki/database/sapd_wiki.sqlite3
<app_data_dir>/SAPD_Wiki/raw/
<app_data_dir>/SAPD_Wiki/previews/
<app_data_dir>/SAPD_Wiki/exports/
```

具体 `<app_data_dir>` 由 Tauri 在不同操作系统上解析。

## 3. 样例文件策略

当前 `data/raw-samples/` 中的文件只用于本地分析和开发验证：

- 不提交 GitHub；
- 不作为测试 fixture 直接入库；
- 不写入迁移脚本；
- 不在文档中记录敏感内容全文；
- 后续如需测试数据，应生成脱敏小样例。

## 4. 测试 fixture 策略

后续开发测试需要固定输入时，采用两种方式：

| 类型 | 策略 |
|---|---|
| 单元测试 fixture | 手工构造极小 CSV/JSON/XLSX，放在 `tests/fixtures/`，不得含真实敏感内容 |
| 集成测试 fixture | 由真实样例抽取少量脱敏行，另存为脱敏样例后才可提交 |

## 5. 备份和导出

全量备份建议包含：

- SQLite 数据库；
- 原始文件仓库；
- 预览文件；
- 导出 manifest；
- 当前映射规则版本。

备份包默认输出到：

```text
data/exports/
```

