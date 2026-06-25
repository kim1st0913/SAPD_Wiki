# Windows ZIP 构建与实机验收说明

本文档用于在 Windows x64 环境生成并验证真实 `SAPD-Wiki-v0.1.0-win-x64.zip`。当前 macOS 环境不能交叉生成或验证 Windows 原生 `SAPD-Wiki-Backend.exe`。

当前状态：

```text
Windows 构建脚本就绪 / 未实机验证
```

只有在 Windows x64 机器、Windows VM 或 Windows CI runner 上完成本指南的构建与验收后，Windows ZIP 才能标记为真实运行验证通过。

## 1. 前提

- Windows x64 机器、Windows VM 或 Windows CI runner。
- Python 3.11+。
- PyInstaller。
- 已取得前端静态资源目录、预构建 `sapd_wiki_base.sqlite3` 和本仓库代码。

安装 PyInstaller：

```powershell
python -m pip install pyinstaller
```

## 2. 打包后端

```powershell
powershell -ExecutionPolicy Bypass -File scripts\package_backend_windows.ps1 -OutputDir dist\zip-alpha
```

期望产物：

```text
dist\zip-alpha\backend\win-x64\SAPD-Wiki-Backend.exe
```

## 3. 构建 Windows ZIP

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

注意：`build_zip_bundle.py` 必须传入真实 `--backend-binary`。如果没有真实 `SAPD-Wiki-Backend.exe`，不要生成或试发 Windows ZIP。`--allow-placeholder` 只能用于目录结构检查，不能用于用户试发。

说明：本项目在 macOS 主工作区的默认打包输出目录为 `/Users/kim1st/Documents/kim note/04_workspace/research/知识库工程/sapd wiki bundle`。Windows 实机构建建议继续显式传入 `--output-dir`，避免误用 macOS 本地路径。真实 Windows ZIP 回传到 macOS 后，统一放入：

```text
"/Users/kim1st/Documents/kim note/04_workspace/research/知识库工程/sapd wiki bundle/dist/releases/0.1.0-alpha/"
```

路径包含空格和中文，命令或脚本示例中必须加引号。

## 4. Windows 实机验收清单

- 解压 `SAPD-Wiki-v0.1.0-win-x64.zip`。
- 双击 `start-windows.bat`。
- 不安装 Python、Node、Docker。
- 启动前执行 runtime check。
- 缺失 `data/user/sapd_wiki_user.sqlite3` 时自动创建。
- 浏览器打开本地页面，或用 HTTP 请求访问本地地址。
- `GET /api/v1/base/summary` 可读取 base DB。
- `GET /api/v1/health` 可返回本轮启动的 `X-SAPD-Session-Token`。
- `POST /api/v1/user/favorites` 在携带 `Content-Type: application/json` 和 `X-SAPD-Session-Token` 后可写入 user DB。
- 写入后 `data/base/sapd_wiki_base.sqlite3` hash 不变。
- `logs/runtime.log`、`logs/runtime-state.json`、`logs/startup-check-result.json` 正常生成。
- `diagnostics/export-diagnostics.bat` 可导出诊断包。
- 诊断包不包含用户库原文件、用户备注全文、用户标签全文或用户自定义对象全文。
- 记录 Windows Defender、SmartScreen 或第三方安全软件是否拦截。
- 如被拦截，记录软件名称、提示截图、是否允许继续运行。

## 5. Windows 验收记录模板

```text
Windows 机器：
CPU / 架构：
Windows 版本：
Python 版本：
PyInstaller 版本：
SAPD-Wiki-Backend.exe hash：
ZIP 文件名：
ZIP hash：
是否启动成功：
是否被安全软件拦截：
base summary 是否通过：
user favorite 写入是否通过：
diagnostics 是否导出：
阻塞问题：
```

## 6. 当前状态

本指南提供 Windows 真实构建链路。本仓库当前 macOS arm64 环境只能完成 macOS ZIP 实包验证；Windows ZIP 必须在 Windows 环境继续实测后才能标记为真实运行验证通过。

当前 release manifest 已将 Windows 标记为：

```text
status = pending
verification_status = not_verified
```

不得在未取得真实 Windows `SAPD-Wiki-Backend.exe` 和实机验证报告前，把 `SAPD-Wiki-v0.1.0-win-x64.zip` 放入内部试发目录。
