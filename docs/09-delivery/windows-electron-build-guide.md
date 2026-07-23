# Windows Electron 客户端打包指南

> 状态：implemented / internal testing
> 日期：2026-07-21
> 适用产物：Windows x64 NSIS `Setup.exe`

## 1. 交付链路

```text
GitHub Actions windows-2022
  -> PyInstaller Windows 后端 Artifact
  -> Mac 本地准备 Electron Runtime
  -> electron-builder 跨平台生成 NSIS Setup.exe
  -> Windows 10/11 真机 UAT
```

日常打包不要求本地 Windows 环境。Windows CI 只生成平台相关的 Python 后端；前端、基础库、空用户库模板和 Electron 安装器在 Mac 上组装。正式发布前仍必须在真实 Windows 10/11 上验收。

## 2. 获取 Windows 后端

1. 在 GitHub 打开仓库的 **Actions**。
2. 运行 Windows 后端构建工作流，目标分支为 `codex/windows-electron`。
3. 等待 `windows-2022` job 完成并下载 Artifact。
4. 保留 ZIP 原样，不解压、不提交 Git。

Artifact 应包含 `SAPD-Wiki-Backend.exe` 和 `_internal/`。当前已验证样例：

```text
SAPD-Wiki-Backend-win-x64-8b46b837965cc88c9dc5480f5537a67e237ac11a.zip
```

## 3. Mac 首次准备

```bash
cd apps/electron
npm install
```

Node/npm 只用于制作者打包，不要求最终 Windows 用户安装。`node_modules/`、Artifact ZIP、`.build/` 和 `dist/` 均不得进入 Git。

## 4. 生成安装器

```bash
cd apps/electron
export SAPD_WIKI_WINDOWS_BACKEND_ARTIFACT="$HOME/Downloads/SAPD-Wiki-Backend-win-x64-<revision>.zip"
npm test
npm run package:win
```

命令按顺序执行：

1. 校验 Artifact 的 Windows 后端文件。
2. 从当前源码复制前端静态资源。
3. 复制正式基础库和空用户库模板，不读取真实用户库。
4. 生成 Runtime 指纹与配置模板。
5. electron-builder 生成 assisted NSIS 安装器和内置卸载程序。

输出：

```text
apps/electron/dist/SAPD-Wiki-Setup-<version>-win-x64.exe
```

只检查展开目录时使用：

```bash
npm run package:win:dir
```

## 5. 安装和目录定义

安装向导允许用户选择程序安装目录。安装目录只存程序和只读资源，不保存业务用户数据。

首次启动会要求选择数据父目录。如果用户选择 `D:\Work`，应用创建：

```text
D:\Work\SAPDWiki\
├── import\
├── export\
└── Runtime\
    ├── data\user\sapd_wiki_user.sqlite3
    └── logs\
```

选择的目录本身已叫 `SAPDWiki` 时不会重复追加。App 菜单的“系统设置”可分别修改工作、导入和导出目录；修改后重启生效。应用不会自动迁移或覆盖旧目录中的数据。

路径偏好保存在 `%LOCALAPPDATA%\SAPD Wiki\settings.json`，与业务数据目录分离。这一结构与 macOS App 的 `dataRoot / importDirectory / downloadDirectory` 定义一致。

## 6. 卸载

NSIS 安装器提供两种卸载入口：

- Windows **设置 > 应用 > 已安装的应用 > SAPD Wiki > 卸载**。
- 开始菜单中的 SAPD Wiki 卸载入口。

默认卸载程序文件，不删除用户选择的 `SAPDWiki` 数据目录，也不删除 `%LOCALAPPDATA%\SAPD Wiki\settings.json`。这样重装和升级不会误删用户库。需要完全重置时，必须先备份导出内容，再由用户手工删除这两个目录。

## 7. 发布前验收

- 安装向导可更改程序安装位置。
- 首次启动可选择数据父目录，并建立 `import / export / Runtime`。
- App 可启动后端，首页、搜索、安全能力和成熟度指南可用。
- 导入和导出实际写入设置中的目录。
- 退出 App 后 sidecar 进程结束。
- 覆盖安装保留用户库。
- 卸载入口存在，卸载后程序消失且用户数据仍在。
- 安装器 SHA-256、版本、大小和签名状态已记录。

当前安装器未配置 Windows 代码签名，内测机可能出现 SmartScreen 提示。签名和公开分发信誉是正式发布前的独立门禁。
