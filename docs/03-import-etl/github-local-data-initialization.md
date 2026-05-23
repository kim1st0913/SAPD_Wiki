# GitHub 拉取后的本地数据初始化

本文档说明两件事：

1. GitHub 工程只保存代码、文档、配置模板和脱敏 fixture；
2. 从 GitHub 拉代码的人，把原始资料放到指定本地目录后，执行一个命令即可生成本地数据库和前端离线数据包。

## 1. GitHub 不同步哪些内容

以下内容不提交 GitHub：

| 类型 | 本地路径 |
|---|---|
| 原始资料 | `data/raw/`、`data/raw-samples/` |
| SQLite 数据库 | `data/database/`、`*.sqlite3`、`*.db` |
| ETL 中间产物 | `data/processed/` |
| 预览资源 | `data/previews/` |
| 导出报告 / 备份包 | `data/exports/`、`*.zip` |
| 成熟度运行数据 | `data/maturity/` |
| 前端生成 JSON | `frontend/capability-browser/public/data/*.json` |
| 前端生成资源包 | `frontend/capability-browser/public/data/assets/`、`guides/`、`standards/` |

如果需要检查当前 Git 是否误追踪了这些文件，执行：

```bash
python scripts/check_github_data_boundary.py
```

输出 `GitHub data boundary check: OK` 才能继续提交。

该检查已经接入 GitHub Actions：

```text
.github/workflows/data-boundary.yml
```

每次 push / pull request 会自动执行脚本语法检查和数据边界检查。如果误追踪了原始资料、SQLite 数据库、导出包或前端生成数据，CI 会失败。

## 2. 拉代码后需要放哪些文件

当前一键初始化工具的必需输入是主 Excel 工作簿：

| 文件 | 放置位置 | 是否必需 | 用途 |
|---|---|---|---|
| `wiki sample.xlsx` | `data/raw-samples/wiki sample.xlsx` | 是 | 生成 SQLite 主知识库、三大工作台数据包、维护数据包、标准索引 |

可选输入：

| 文件 | 放置位置 | 是否必需 | 用途 |
|---|---|---|---|
| `wiki sample ppt.pptx` | `data/raw-samples/wiki sample ppt.pptx` | 否 | 生成 `content-views.json` 中的 PPT 占位记录 |
| `drawio sample.drawio` | `data/raw-samples/drawio sample.drawio` | 否 | 生成 `content-views.json` 中的 Draw.io 占位记录 |
| `T00-面向业务的数据安全专项设计方法（V2.1）.pdf` | `data/raw-samples/ds design/T00-面向业务的数据安全专项设计方法（V2.1）.pdf` | 否 | 指南资源构建输入，当前不由本工具自动转 PNG |
| `安全技术架构设计方法 V2.0.pdf` | `data/raw-samples/ds design/安全技术架构设计方法 V2.0.pdf` | 否 | 指南资源构建输入，当前不由本工具自动转 PNG |

如果本地没有目录，先创建：

```bash
mkdir -p "data/raw-samples/ds design"
```

## 3. 一键初始化命令

首次初始化推荐执行：

```bash
python scripts/sapd_wiki.py bootstrap-local-data --reset
```

脚本会自动完成：

1. 创建本地数据目录；
2. 初始化 SQLite migration；
3. 从 `data/raw-samples/wiki sample.xlsx` 依次导入已实现 parser 的 Sheet：
   - `core`
   - `second-batch`
   - `third-batch`
   - `standard-framework`
4. 每批先进入 staging，再自动审批进入正式表；
5. 生成前端离线数据包：
   - `capability-workbench.json`
   - `environment-workbench.json`
   - `lifecycle-workbench.json`
   - `maintenance-knowledge.json`
   - `shared-lookups.json`
   - `lifecycle-knowledge.json`
   - `standards-index.json`
   - `standards/**`
   - `content-views.json`
   - `capability-tree.json`
6. 生成基础导出报告；
7. 打印数据库摘要。

生成位置：

```text
data/database/sapd_wiki.sqlite3
frontend/capability-browser/public/data/
data/exports/
```

这些都是本地生成文件，不提交 GitHub。

## 4. 常用命令

只查看需要放哪些文件：

```bash
python scripts/sapd_wiki.py bootstrap-local-data --print-inputs
```

本地已有数据库时，脚本默认不会覆盖。确认重建时执行：

```bash
python scripts/sapd_wiki.py bootstrap-local-data --reset
```

只重建 SQLite，不导出前端离线包：

```bash
python scripts/sapd_wiki.py bootstrap-local-data --reset --skip-frontend-export
```

只检查 GitHub 数据边界：

```bash
python scripts/check_github_data_boundary.py
```

## 5. 当前边界

本工具服务的是“开发者从 GitHub 拉代码后，在本机重建数据”的场景。

它不是顾问端产品的一键初始化。顾问端一键初始化应复制发布包内的种子库和资源包，不要求顾问提供原始 Excel、执行 ETL 或安装 Python / Node。顾问端交付边界见 `docs/01-architecture/consultant-delivery-model.md`。

指南 PDF 转 PNG、发布种子库打包、资源 manifest 和 hash 校验仍属于后续发布构建任务；当前脚本先固化主 Excel 到 SQLite / 前端数据包的可重复初始化流程。
