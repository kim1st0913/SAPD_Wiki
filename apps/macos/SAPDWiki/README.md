# SAPD Wiki macOS App

本目录是 SAPD Wiki 的 macOS App / DMG 支线，不并入当前前端数据治理主线。

## 目标

- 用 SwiftPM 构建一个原生 macOS `.app` 壳。
- App 启动现有 `SAPD-Wiki-Backend` 本地服务。
- App 用 `WKWebView` 打开 `127.0.0.1` 本地页面。
- 运行时数据复制到 `~/Library/Application Support/SAPD Wiki/Runtime`。
- `sapd_wiki_user.sqlite3` 保留在 Application Support，不放在 `.app` 包内作为长期写入位置。

## 构建

```bash
apps/macos/SAPDWiki/script/build_and_run.sh build
```

默认会用 PyInstaller 从当前仓库源码构建目录式 `SAPD-Wiki-Backend`，入口可执行文件位于：

```text
apps/macos/SAPDWiki/.build/backend-work/backend/mac-arm64/SAPD-Wiki-Backend
```

同目录下的 `_internal/` 是 PyInstaller `onedir` 运行依赖，打包进 `.app` 后会放在 Runtime 根目录。不要只复制单个 `SAPD-Wiki-Backend` 文件，否则后端无法启动。

如果本地没有 PyInstaller，先准备支线专用 venv：

```bash
python3 -m venv apps/macos/SAPDWiki/.build/pyinstaller-venv
apps/macos/SAPDWiki/.build/pyinstaller-venv/bin/python -m pip install pyinstaller
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

产物：

```text
apps/macos/SAPDWiki/dist/SAPD-Wiki-mac-arm64.dmg
```

## 内测分发与 Gatekeeper

当前默认是 ad-hoc 签名、未 notarize 的内测包。通过微信、浏览器或网盘分发到其他 Mac 后，首次打开外层 `SAPD Wiki.app` 仍可能出现“Apple 无法验证”的系统提示，需要在 `系统设置 -> 隐私与安全性` 中允许打开。

App 启动后会把 Runtime 复制到：

```text
~/Library/Application Support/SAPD Wiki/Runtime
```

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
- 不替代当前 ZIP alpha 打包链路。
- 后端采用 PyInstaller `onedir`，避免 `onefile` 每次启动自解压带来的等待。
- 同一 `.app` 版本重复启动时，会复用 `Application Support` 中指纹一致的只读 Runtime，避免每次复制完整前端包、基础库和后端依赖目录。
