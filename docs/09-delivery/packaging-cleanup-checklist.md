# 打包清理与保留清单

> 状态：active
> 日期：2026-06-02
> 适用范围：Delivery Bundle 1.0-alpha 分平台 ZIP 打包、测试、清理和 GitHub 数据边界确认。

## 1. 结论

打包清理按四类处理：

| 类别 | 处理 |
|---|---|
| 进 GitHub | 代码、脚本、治理文档、配置模板、脱敏 fixture、`.gitkeep` |
| 本地保留但不进 GitHub | 原始资料、SQLite 数据库、数据库备份、导出校对材料、前端生成 JSON、ZIP 产物 |
| 可清理 / 可再生成 | 前端生成 JSON、临时打包目录、PyInstaller build / spec / dist 中间产物、日志、缓存 |
| 打包必须带入 ZIP | 平台后端可执行文件、前端静态资源、基础库、manifest、启动脚本、诊断脚本 |

原则：

- 不删除用户库 `data/user/sapd_wiki_user.sqlite3`。
- 不删除当前基础库 `data/database/sapd_wiki.sqlite3`。
- 不删除仍服务于 `OI-038` 的 `data/exports/worker-verify/`。
- 不把原始数据、数据库、导出包、前端生成 JSON 或 ZIP 产物提交到 GitHub。

## 2. GitHub 边界

GitHub 只保存代码、脚本、文档、配置模板和占位文件。

禁止提交：

| 类型 | 路径 |
|---|---|
| 原始资料 | `data/raw/`、`data/raw-samples/` |
| SQLite 数据库 | `data/database/`、`*.sqlite3`、`*.sqlite`、`*.db` |
| ETL 中间产物 | `data/processed/` |
| 导出和备份包 | `data/exports/`、`*.zip` |
| 成熟度运行数据 | `data/maturity/` |
| 前端生成 JSON | `frontend/capability-browser/public/data/*.json`、`maintenance/`、`source-evidence/`、`standards/`、`assets/`、`guides/` |

提交前固定执行：

```bash
python3 scripts/check_github_data_boundary.py
git status --short --branch
```

预期：

- `check_github_data_boundary.py` 输出 `GitHub data boundary check: OK`。
- `git status` 中不得出现准备提交的数据库、ZIP、导出包或前端生成 JSON。

## 3. 必须保留

### 3.1 本地开发 / 重建必须保留

| 文件或目录 | 原因 |
|---|---|
| `data/raw-samples/wiki sample.xlsx` | 本地重建 SQLite 和前端数据包的主输入 |
| `data/database/sapd_wiki.sqlite3` | 当前主知识库 |
| `data/database/backups/` 最新 5 个 `.sqlite3` | 本地回滚恢复点 |
| `data/exports/worker-verify/` | 仍可能支撑 `OI-038` Gartner 候选映射人工校对 |
| 当前 alpha release 目录 | 已试发 ZIP、checksum、`release-manifest.json` 和 UAT 材料 |

### 3.2 用户解压包内必须保留

| 文件或目录 | 原因 |
|---|---|
| `data/base/sapd_wiki_base.sqlite3` | 只读基础知识库 |
| `data/base/base-manifest.json` | 启动校验和基础库 hash |
| `data/user/sapd_wiki_user.sqlite3` | 用户收藏、备注、标签和后续个人数据 |
| `config/app-config.json` | 端口、路径、日志和平台配置 |
| `logs/` | 运行日志和排障线索 |
| `diagnostics/` | 导出脱敏诊断包 |

升级或复制新包时，不能覆盖用户已有 `data/user/`。

## 4. 可以清理

### 4.1 低风险可清理

| 文件或目录 | 条件 |
|---|---|
| `__pycache__/`、`*.pyc` | 任意时间可删 |
| `.DS_Store` | 任意时间可删 |
| `.vite/`、`node_modules/` | 确认可重新安装依赖后可删 |
| 解压测试包中的 `logs/*` | 问题反馈和诊断包已留存后可删 |
| PyInstaller `build/`、`spec/` 中间目录 | 后端可执行文件已生成并验收后可删 |

### 4.2 可删除后重建

| 文件或目录 | 重建方式 |
|---|---|
| `frontend/capability-browser/public/data/**` | 重新运行本地导出或 `bootstrap-local-data --profile full --reset` |
| `data/exports/import-review-latest/` | 重新执行对应导入或导出命令 |
| `data/exports/clean-*` | 确认不再引用后归档或删除 |

### 4.3 暂不清理

| 文件或目录 | 暂停原因 |
|---|---|
| `data/exports/worker-verify/` | `OI-038` 未完成人工校对 |
| 当前 release / bundle 目录 | Windows / macOS UAT 仍在进行 |
| 最近数据库备份 | 需要保留恢复点 |

## 5. Windows 每次打包

Windows ZIP 必须在 Windows x64 机器、Windows VM 或 Windows CI runner 上生成和验证。macOS 不能交叉生成真实 `SAPD-Wiki-Backend.exe`。

### 5.1 构建后端

```powershell
python -m pip install pyinstaller

powershell -ExecutionPolicy Bypass -File scripts\package_backend_windows.ps1 -OutputDir dist\zip-alpha
```

期望产物：

```text
dist\zip-alpha\backend\win-x64\SAPD-Wiki-Backend.exe
```

### 5.2 构建 ZIP

```powershell
python scripts\build_zip_bundle.py `
  --output-dir dist\zip-alpha\bundle `
  --platform win-x64 `
  --frontend-dist frontend\capability-browser `
  --backend-binary dist\zip-alpha\backend\win-x64\SAPD-Wiki-Backend.exe `
  --base-db data\database\sapd_wiki.sqlite3 `
  --make-zip
```

期望产物：

```text
dist\zip-alpha\bundle\SAPD-Wiki-v0.1.0-win-x64.zip
```

### 5.3 验收

1. 解压 ZIP。
2. 双击 `start-windows.bat`。
3. 不安装 Python、Node、Docker。
4. 检查浏览器是否打开本地页面。
5. 检查日志：
   - `logs/launcher.log`
   - `logs/backend-console.log`
   - `logs/runtime.log`
   - `logs/runtime-state.json`
   - `logs/startup-check-result.json`
6. 运行 `diagnostics/export-diagnostics.bat`，确认诊断包可导出且不包含用户库原文件。
7. 记录 `SAPD-Wiki-Backend.exe` hash、ZIP hash、Windows 版本和安全软件拦截情况。

## 6. macOS 每次打包

macOS ZIP 必须在对应架构的 Mac 上生成和验证。当前主工作区是 `mac-arm64`。

### 6.1 构建后端

```bash
python3 -m pip install pyinstaller

python3 scripts/package_backend_pyinstaller.py \
  --output-dir dist/zip-alpha \
  --platform mac-arm64 \
  --require-native
```

期望产物：

```text
dist/zip-alpha/backend/mac-arm64/SAPD-Wiki-Backend
```

### 6.2 构建 ZIP

```bash
python3 scripts/build_zip_bundle.py \
  --output-dir "<bundle输出目录>" \
  --platform mac-arm64 \
  --frontend-dist frontend/capability-browser \
  --backend-binary dist/zip-alpha/backend/mac-arm64/SAPD-Wiki-Backend \
  --base-db data/database/sapd_wiki.sqlite3 \
  --make-zip
```

### 6.3 验收

1. 解压 ZIP。
2. 运行：

```bash
python3 scripts/check_bundle_runtime.py "<解压后的 bundle root>" --create-user-db
```

3. 双击 `start-macos.command`。
4. 如遇权限问题：

```bash
chmod +x start-macos.command SAPD-Wiki-Backend
```

5. 如遇 Gatekeeper：

```bash
xattr -dr com.apple.quarantine .
```

6. 检查浏览器、本地 API、`logs/runtime.log` 和诊断包。

## 7. 发行目录

内部 alpha 发行目录：

```text
"/Users/kim1st/Documents/kim note/04_workspace/research/知识库工程/sapd wiki bundle/dist/releases/0.1.0-alpha/"
```

发行目录应包含：

| 文件 | 说明 |
|---|---|
| 平台 ZIP | 只放已构建并完成对应状态确认的 ZIP |
| `.sha256` | 对应 ZIP checksum |
| `release-manifest.json` | 记录平台状态、hash、schema、限制和验证状态 |
| UAT checklist / feedback template | 内部试用反馈材料 |
| Windows validation report | Windows 未完成完整 UAT 时必须保留状态说明 |

Windows 未真实验证前，manifest 中 Windows 必须保持 `pending` 或 `ready_pending_full_uat` 等非完全通过状态。

## 8. 打包前后固定检查

### 打包前

```bash
git status --short --branch
python3 scripts/check_github_data_boundary.py
python3 scripts/data_package_summary.py --package maintenance
python3 scripts/data_package_summary.py --package capability-workbench
python3 scripts/data_package_summary.py --package lifecycle-workbench
```

### ZIP 生成后

```bash
python3 scripts/check_bundle_runtime.py "<bundle root>" --create-user-db
```

Windows 还要实机双击 `start-windows.bat`；macOS 还要实机双击 `start-macos.command`。

## 9. 暂停条件

出现以下情况，先停止清理或打包：

- 准备永久删除数据库备份。
- 准备移动或删除 `data/exports/worker-verify/`。
- `check_github_data_boundary.py` 失败。
- ZIP 中缺少真实 `--backend-binary`。
- `check_bundle_runtime.py` 失败。
- Windows 双击后没有 `logs/launcher.log`，说明用户双击的不是当前脚本或脚本未正确进入包内。
- 用户库 `data/user/` 可能被覆盖。
