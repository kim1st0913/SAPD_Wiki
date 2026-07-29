# SAPD Wiki Windows Electron 客户端

这是 Windows Electron 客户端源码。当前正式 Windows 安装器由私有 GitHub
`windows-2022` Runner 从公开 `main` 的精确提交构建，不把正式数据库、用户数据库
或安装器放进公开仓。

## 交付链路

```text
公开 SAPD_Wiki/main 精确 SHA
  + 私有不可变 Delivery Data Release
  -> 私有 GitHub Windows Runner
  -> PyInstaller backend + Electron Runtime + NSIS Setup.exe
  -> 私有 Internal Prerelease
  -> Windows 10/11 UAT
  -> 私有正式 Release
```

日常生产打包不再使用 `codex/windows-electron` 分支，也不在 Mac 上下载 backend
后手工组装。完整当前流程见
`docs/09-delivery/desktop-packaging-runbook.md`。

## 本地命令的用途

本目录仍保留 Electron 单元测试和诊断命令：

```bash
cd apps/electron
npm install
npm test
```

`npm run package:win` 和 `npm run package:win:dir` 只用于维护者诊断旧的本地组装
边界，不是当前生产发布入口。它们仍要求显式提供 Windows backend Artifact：

```bash
export SAPD_WIKI_WINDOWS_BACKEND_ARTIFACT="$HOME/Downloads/SAPD-Wiki-Backend-win-x64-8b46b837965cc88c9dc5480f5537a67e237ac11a.zip"
npm run package:win
```

不得把下载的 ZIP、`.build/`、`dist/`、SQLite、Delivery Data 或安装器提交到公开 Git。

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

当前完整流程见 `docs/09-delivery/desktop-packaging-runbook.md`。

## 当前边界

- 当前只生成 Windows x64 NSIS 安装器。
- 当前未配置 Windows 代码签名，内测用户可能看到 SmartScreen 提示。
- Electron 安装器不携带真实用户数据库、`data/exports/` 或恢复包。
- 安装器生成后仍需在真实 Windows 10/11 机器上做启动、写入、退出和卸载保留数据验收。
