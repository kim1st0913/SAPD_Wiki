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
| `frontend/capability-browser/public/data/*.json` | 否 | 后端生成的前端离线数据包 |
| `frontend/capability-browser/public/data/guides/` | 否 | 后端或发布流程生成的指南资源包 |
| `frontend/capability-browser/public/data/standards/` | 否 | 后端生成的标准 / 框架明细数据包 |

开发阶段默认数据库路径：

```text
data/database/sapd_wiki.sqlite3
```

## 2. 打包后运行阶段

打包成桌面应用后，不应把数据库写在安装目录里，而应写入应用数据目录。

桌面交付以 `docs/09-delivery/desktop-packaging-runbook.md` 为准：macOS 使用 DMG，
Windows 使用私有 Runner 生成的 `Setup.exe`。普通用户不需要安装开发依赖、选择数据库、
执行迁移、运行 ETL 或自行导入原始资料。

建议逻辑路径：

```text
<app_data_dir>/SAPD_Wiki/database/sapd_wiki.sqlite3
<app_data_dir>/SAPD_Wiki/resources/
<app_data_dir>/SAPD_Wiki/exports/
<app_data_dir>/SAPD_Wiki/backups/
```

具体 `<app_data_dir>` 由 macOS Swift 壳或 Windows Electron 壳按当前用户解析。

发布包内置的数据库建议作为只读种子库保存，例如：

```text
resources/database/sapd_wiki.seed.sqlite3
```

首次初始化时复制为运行库：

```text
<app_data_dir>/SAPD_Wiki/database/sapd_wiki.sqlite3
```

后续应用读取和可能产生的用户偏好、导出、备份都写入应用数据目录，不写入安装目录。

桌面安装包不应包含：

- 开发备份库；
- `data/raw-samples/` 中的真实样例资料；
- ETL 中间产物；
- 需要用户手工执行的导入脚本；
- 未经脱敏或未确认可分发的原始文件。

## 3. 样例文件策略

当前 `data/raw-samples/` 中的文件只用于本地分析和开发验证：

- 不提交 GitHub；
- 不作为测试 fixture 直接入库；
- 不写入迁移脚本；
- 不在文档中记录敏感内容全文；
- 后续如需测试数据，应生成脱敏小样例。

## 3.1 GitHub 拉取后的数据初始化

从 GitHub 拉代码的人不会拿到原始数据、SQLite 数据库或前端生成数据包。标准流程是：

1. 把授权的主 Excel 文件放到 `data/raw-samples/wiki sample.xlsx`；
2. 如有 Draw.io / PPT / 指南 PDF，本地放到 `data/raw-samples/` 下对应目录；
3. 执行：

```bash
python scripts/sapd_wiki.py bootstrap-local-data --reset
```

脚本会生成：

```text
data/database/sapd_wiki.sqlite3
frontend/capability-browser/public/data/*.json
frontend/capability-browser/public/data/standards/**
data/exports/**
```

这些文件仍然只存在本地，不提交 GitHub。完整说明见 `docs/03-import-etl/github-local-data-initialization.md`。

## 4. 测试 fixture 策略

后续开发测试需要固定输入时，采用两种方式：

| 类型 | 策略 |
|---|---|
| 单元测试 fixture | 手工构造极小 CSV/JSON/XLSX，放在 `tests/fixtures/`，不得含真实敏感内容 |
| 集成测试 fixture | 由真实样例抽取少量脱敏行，另存为脱敏样例后才可提交 |

## 5. 备份和导出

全量备份建议包含：

- SQLite 数据库；
- 已部署资源 manifest；
- 预览资源；
- 导出 manifest；
- 当前映射规则版本。

备份包默认输出到：

```text
data/exports/
```
