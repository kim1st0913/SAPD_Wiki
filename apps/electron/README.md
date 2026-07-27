# SAPD Wiki Windows Electron 客户端

这是 Windows 客户端独立支线，不修改当前 Web 主线，也不把用户数据库放进安装包。

## 交付链路

```text
GitHub Windows CI
  -> SAPD-Wiki-Backend-win-x64-<revision>.zip
  -> Mac 本地组装干净 Runtime
  -> Electron Builder 生成 Windows NSIS Setup.exe
```

本机是 macOS 也可以执行最后两步。Windows 环境只负责生成 PyInstaller 后端，不负责 Electron 安装器的日常组装。

## 第一次准备

在仓库根目录执行：

```bash
cd apps/electron
npm install
```

不需要把下载的 ZIP 放进 Git。`*.zip` 和 `apps/electron/.build/` 都是本地构建输入或产物。

## 组装并生成安装器

把下载的 GitHub Artifact 路径传给环境变量。示例：

```bash
export SAPD_WIKI_WINDOWS_BACKEND_ARTIFACT="$HOME/Downloads/SAPD-Wiki-Backend-win-x64-8b46b837965cc88c9dc5480f5537a67e237ac11a.zip"
npm run package:win
```

命令会依次完成：

1. 校验 ZIP 内同时存在 `SAPD-Wiki-Backend.exe` 和 `_internal/`。
2. 用 `scripts/build_zip_bundle.py` 生成干净的 Windows Runtime。
3. 从当前 `frontend/capability-browser` 和 `data/database/sapd_wiki.sqlite3` 复制前端、基础库和空用户库模板。
4. 计算 Runtime 指纹。
5. 用 Electron Builder 生成 `dist/SAPD-Wiki-Setup-0.3.0-win-x64.exe`。

## 只生成目录包

用于检查安装内容，不制作安装器：

```bash
npm run package:win:dir
```

## 安装、数据目录与设置

NSIS 安装向导允许选择程序安装位置。首次启动还会要求选择数据父目录；如果选择 `D:\Work`，应用会创建：

```text
D:\Work\SAPDWiki\
├── import\
├── export\
└── Runtime\
```

用户库位于 `Runtime/data/user/sapd_wiki_user.sqlite3`，日志位于 `Runtime/logs/`。App 菜单的“系统设置”可以分别更改工作目录、导入目录和导出目录，修改后重启生效。路径偏好保存在 `%LOCALAPPDATA%\SAPD Wiki\settings.json`；应用不会自动移动或覆盖旧目录中的数据。

## 卸载

可通过 Windows “设置 > 应用 > 已安装的应用”或开始菜单卸载 SAPD Wiki。卸载默认保留用户选择的 `SAPDWiki` 数据目录和路径设置，避免误删用户库；完全重置需由用户备份后手工删除。

完整流程见 `docs/09-delivery/windows-electron-build-guide.md`。

## 当前边界

- 当前只生成 Windows x64 NSIS 安装器。
- 当前未配置 Windows 代码签名，内测用户可能看到 SmartScreen 提示。
- Electron 安装器不携带 GitHub Artifact ZIP、不携带开发机真实用户数据库、不携带 `data/exports/`。
- 安装器生成后仍需在真实 Windows 10/11 机器上做启动、写入、退出和卸载保留数据验收。
