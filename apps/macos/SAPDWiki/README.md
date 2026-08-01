# SAPD Wiki macOS App

本目录是 SAPD Wiki 的 macOS App / DMG 支线，不并入当前前端数据治理主线。

## 目标

- 用 SwiftPM 构建一个原生 macOS `.app` 壳。
- App 启动现有 `SAPD-Wiki-Backend` 本地服务。
- App 用 `WKWebView` 打开 `127.0.0.1` 本地页面。
- 首次启动要求用户选择父级保存位置，并在 `<所选父级保存位置>/SAPDWiki` 下分开创建用户导入区 `import`、用户导出区 `export` 和系统运行区 `Runtime`。
- `.app` 包内携带干净的 `sapd_wiki_user.sqlite3` 空库模板；仅当所选保存位置下缺少用户库时，wrapper 才从包内模板创建新用户库。已有用户库默认复用，不因 Runtime 指纹变化被覆盖。

## 构建

```bash
apps/macos/SAPDWiki/script/build_and_run.sh build
```

默认会用 PyInstaller 从当前仓库源码构建目录式 `SAPD-Wiki-Backend`，入口可执行文件位于：

```text
apps/macos/SAPDWiki/.build/backend-work/backend/mac-arm64/SAPD-Wiki-Backend
```

同目录下的 `_internal/` 是 PyInstaller `onedir` 运行依赖，打包进 `.app` 后会放在 Runtime 根目录。不要只复制单个 `SAPD-Wiki-Backend` 文件，否则后端无法启动。

如果本地没有 PyInstaller 或 MCP 依赖，先准备支线专用 venv：

```bash
python3 -m venv apps/macos/SAPDWiki/.build/pyinstaller-venv
apps/macos/SAPDWiki/.build/pyinstaller-venv/bin/python -m pip install pyinstaller 'openpyxl>=3.1.0' 'cryptography==49.0.0' 'mcp[cli]==1.28.1' 'rfc8785==0.1.4' 'uvicorn==0.51.0'
```

产物：

```text
apps/macos/SAPDWiki/dist/SAPD Wiki.app
```

## 运行

```bash
apps/macos/SAPDWiki/script/build_and_run.sh
```

一般不应复用外部 backend。仅在诊断旧包时，可以显式允许外部 backend：

```bash
SAPD_WIKI_ALLOW_EXTERNAL_BACKEND=1 \
SAPD_WIKI_MAC_BACKEND="/path/to/SAPD-Wiki-Backend" \
apps/macos/SAPDWiki/script/build_and_run.sh
```

## 打 DMG

```bash
apps/macos/SAPDWiki/script/package_dmg.sh
```

只生成无授权版：

```bash
SAPD_WIKI_DMG_VARIANT=no-license \
SAPD_WIKI_APP_VERSION=0.3.5 \
apps/macos/SAPDWiki/script/package_dmg.sh
```

产物：

```text
apps/macos/SAPDWiki/dist/license/SAPD-Wiki-<version>-license-<timestamp>-mac-arm64.dmg
apps/macos/SAPDWiki/dist/no-license/SAPD-Wiki-<version>-no-license-<timestamp>-mac-arm64.dmg
```

从下一次构建开始，DMG 根目录会同时包含 `SAPD Wiki.app` 和指向
`/Applications` 的 `Applications` 图标。用户将 App 拖到该图标即可完成安装，
随后从 macOS“应用程序”启动。

## 内测分发与 Gatekeeper

当前默认是 ad-hoc 签名、未 notarize 的内测包。通过微信、浏览器或网盘分发到其他 Mac 后，首次打开外层 `SAPD Wiki.app` 仍可能出现“Apple 无法验证”的系统提示，需要在 `系统设置 -> 隐私与安全性` 中允许打开。

App 首次启动会要求设置父级保存位置，并在该位置下创建统一的 `SAPDWiki` 工作目录：

```text
SAPDWiki/
├── import/
│   ├── maturity-templates/
│   └── maturity-scores/
├── export/
│   ├── maturity-reports/
│   ├── maturity-scores/
│   ├── maturity-templates/
│   ├── issues/
│   └── diagnostics/
└── Runtime/
    └── data/user/
        ├── sapd_wiki_user.sqlite3
        └── maturity-reports/<projectId>/artifacts/<artifactId>/
```

- `import` 是默认文件选择入口，模板和评分文件仍可从任意本地目录选择，App 不移动或覆盖源文件。
- `export` 是用户交付文件目录；报告、评分表、模板、Issue 和诊断包按类别保存。
- `Runtime` 是系统内部目录，用于数据库、报告历史和日志；正常操作不要求用户进入该目录。
- “系统设置”可分别查看或更改本地工作目录、默认导入文件夹和导出文件夹，并可在 Finder 中打开对应位置。
- “系统设置 > AI功能集成”管理本机 MCP Sidecar、HTTPS 证书、客户端只读授权与审计。MCP 控制状态保存在 `Runtime/data/mcp`，不写入用户 SQLite。

为避免内置后端 `SAPD-Wiki-Backend` 在该目录下被 Gatekeeper 再次单独拦截，wrapper 会在启动后端前递归清理复制后 Runtime 的 `com.apple.quarantine` 属性。打包脚本也会显式签名 Runtime 内的 Mach-O 文件，再签外层 `.app`。

如需分发给无需手动放行的测试用户，需要配置 Developer ID 证书并完成 notarization。构建时可先指定签名身份：

```bash
SAPD_WIKI_CODESIGN_IDENTITY="Developer ID Application: <Name> (<TEAMID>)" \
apps/macos/SAPDWiki/script/package_dmg.sh
```

## 当前边界

- 当前是本地日常测试 App，不是正式签名 / 公证版。
- 目前使用 ad-hoc signing。
- 不做自动更新。
- 不修改原始 Excel、SQLite、正式前端数据包或用户批注数据库。
- DMG 是当前 macOS 交付链路；ZIP / bundle 脚本仍作为 Runtime 构建输入和诊断入口，不作为用户交付主入口。
- 后端采用 PyInstaller `onedir`，避免 `onefile` 每次启动自解压带来的等待。
- 同一 `.app` 版本重复启动时，会复用所选保存位置下指纹一致的 Runtime，避免每次复制完整前端包、基础库和后端依赖目录。
- 新 DMG / 新 Runtime 只在目标位置缺少用户库时创建空 `user_schema_0.3` 用户库；已有用户库默认保留。若旧测试库仍是 `user_schema_0.1`，应新选保存位置或做显式迁移，不通过打包流程静默覆盖用户数据。
