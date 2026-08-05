# SAPD Wiki macOS / Windows 打包操作手册

> 状态：`active / current source of truth`
>
> 更新日期：2026-08-03
>
> 适用产物：macOS ARM64 DMG、Windows x64 NSIS `Setup.exe`

## 1. 最简单的使用方式

### Windows

在 Windows 打包任务 `019f18c8-7065-70a1-9ad6-2b54862f0913` 中说：

> 我要打最新的包

这句话默认表示：

1. 使用公开仓 `main` 的最新已推送代码；
2. 检查正式基础库和内容资产库是否比当前私有 Delivery Data 更新；
3. 数据有变化时先创建新的、不可变的私有 Delivery Data Release；
4. 数据没有变化时复用当前已批准的数据 Release；
5. 在 GitHub Windows Runner 上生成完整 `Setup.exe`；
6. 上传到私有仓 `SAPD_Wiki_Delivery_Private` 的 Internal Prerelease；
7. 返回唯一正确的安装包文件名、下载链接和 SHA-256；
8. 停在 Windows 10 / 11 人工 UAT，不自动晋级正式版。

### macOS

在 SAPD Wiki 主工作区任务中说：

> 打最新的 macOS 包。先检查最新代码和正式数据，只生成 no-license DMG，完成 pre-DMG 和实包校验，不写真实用户库。

macOS 不迁移到 GitHub Runner。DMG 继续在正式 Mac 主工作区本地构建。
默认命令生成 ad-hoc 测试包；当前脚本不实现正式外部分发、公证或自动晋级。

## 2. 两个平台的区别

| 项目 | Windows | macOS |
|---|---|---|
| 代码来源 | 公开仓 `main` 的精确 40 位 SHA | 当前 Mac 主工作区中已确认的源码状态 |
| 正式数据来源 | 私有、不可变的 Delivery Data Release | Mac 主工作区正式基础库和内容资产库 |
| 构建位置 | GitHub `windows-2022` Runner | 当前 Mac 本机 |
| 桌面外壳 | Electron | Swift / SwiftUI + WKWebView |
| 最终格式 | NSIS `Setup.exe` | `.dmg` |
| 产物位置 | 私有 GitHub Release | `apps/macos/SAPDWiki/dist/` |
| 用户数据库 | 不包含真实用户库；Runner 创建空模板 | 不包含真实用户库；构建时创建空模板 |
| 正式发布前 | Windows 10 / 11 实机 UAT | DMG 挂载、App Runtime、证书和目标客户端 UAT |

目录、脚本、GitHub workflow 和本地产物的 owner 统一见
`docs/09-delivery/packaging-directory-map.md`。本地 `.build/`、`dist/archive/`
以及归档 workflow 都不是当前发布入口。

## 3. 共同数据规则

所有桌面包都必须携带同一类受控只读数据：

- 基础知识库；
- 内容资产库；
- 与数据库匹配的 manifest、版本和 SHA-256；
- 空用户库模板。

任何平台都不得把以下内容打进安装包或上传到公开 GitHub：

- 真实 `sapd_wiki_user.sqlite3`；
- 用户笔记、收藏、标签、历史记录和个人报告；
- `data/exports/`、恢复包和备份；
- 原始 Excel、客户原始资料和本机绝对路径；
- 开发日志、缓存、虚拟环境和 `node_modules/`。

“最新代码”不等于“最新数据”。打包前必须分别判断：

1. 代码是否更新；
2. 正式基础库是否更新；
3. 正式内容资产库是否更新；
4. 数据是否已经形成批准的交付快照。

正式数据库只能只读检查和复制。打包过程不得顺带运行 ETL、数据迁移、候选 apply 或评分规则更新。

所有 macOS / Windows 安装包的 Runtime 配置必须显式包含：

```json
{
  "mcp_platform_integration": true
}
```

当前 macOS 0.3.0 路径通过 `/usr/bin/security` 使用登录钥匙串；Keychain 暂时不可
访问时提示用户解锁并重试，不把它误判为证书永久失效。任何后续安全存储架构或正式
签名 / 公证改造必须单独立项和验收。

## 4. Windows 打包流程

### 4.1 自动入口（当前修复前仅允许手工 dispatch）

设计上，私有仓 workflow 每 10 分钟检查一次公开仓 `main`。Electron、前端、Python backend、MCP、Windows 打包脚本或相关测试发生变化时应自动触发 Windows 构建；纯文档或 macOS-only 修改不触发。

当前私有仓生产 workflow 为 `watch-public-main.yml`、`windows-installer.yml`、
`compare-windows-builds.yml` 和 `promote-windows-installer.yml`。公开仓原
`build-windows-backend.yml` 已随 backend-only / Mac 手工组装链路退役，归档在
`docs/05-archive/delivery-retired-2026-07/workflows/`，不得从 GitHub Actions 手工运行。

2026-08-03 静态核对发现 watcher 尚未向 builder 传递必填 `app_version`。在私有仓修复并取得成功运行证据前，不得宣称自动触发健康；手工 dispatch 必须显式传入精确版本号。

需要注意：GitHub watcher 看不到 Mac 上尚未发布的数据。用户说“我要打最新的包”时，Agent 必须先完成数据新鲜度检查，不能只等待 watcher。

### 4.2 数据没有变化

继续使用当前已批准的私有 Delivery Data Release。构建记录必须写入：

- 公开源码 SHA；
- Delivery Data release ID；
- 基础库 SHA-256；
- 内容资产库 SHA-256。

### 4.3 数据发生变化

先执行以下步骤，再打安装包：

1. 只读定位正式基础库和内容资产库；
2. 记录构包前 SHA-256；
3. 验证 SQLite 完整性、外键、版本和必要业务计数；
4. 明确确认真实用户库状态为 `not_included`；
5. 生成新的 Delivery Data release ID；
6. 创建 manifest 和分片校验清单；
7. 上传到私有交付仓的不可变 Release；
8. 再次确认正式输入库 SHA-256 未被打包过程改变。

不得覆盖旧数据 Release，也不得使用含义漂移的 `latest` 文件。

### 4.4 GitHub Runner 自动完成

私有 workflow 使用精确源码 SHA 和精确数据 release ID：

1. 下载并校验私有 Delivery Data；
2. checkout 公开 `main` 的精确提交；
3. 安装锁定版本的 Python、Node.js 和构建依赖；
4. 运行 Windows、MCP、DPAPI、CurrentUser、Electron 和数据边界门禁；
5. 用 PyInstaller 生成 Windows backend；
6. 组装 Electron Runtime；
7. 用 Electron Builder / NSIS 生成 `Setup.exe`；
8. 校验 Runtime、数据库、空用户库、卸载器和安装器；
9. 发布不可变的私有 Internal Prerelease。

当前生产链路不使用 `codex/windows-electron` 分支。该分支已经删除，也不再在 Mac 上下载 backend 后手工组装 Windows 安装器。

### 4.5 用户需要下载什么

打开私有仓 `SAPD_Wiki_Delivery_Private` 的最新 `internal-windows-*` Release，只下载：

```text
SAPD-Wiki-Setup-<version>-win-x64.exe
```

以下文件通常不需要手工下载：

- `SHA256SUMS.txt`
- `windows-installer-build-info.json`
- `windows-runner-uat.json`

它们用于校验、审计和正式晋级。

### 4.6 Windows 人工 UAT

Internal Prerelease 不是正式版。必须在真实 Windows 10 和 Windows 11 上分别检查：

- 安装和首次启动；
- 首页、导航和搜索；
- 导入与导出；
- MCP 五工具；
- DPAPI CurrentUser；
- CurrentUser Root 写入、确认和清理；
- 原生确认、TLS / OAuth 和目标 Codex 客户端；
- 覆盖升级；
- 退出后的进程清理；
- 卸载后保留用户数据；
- Defender 和 SmartScreen 实际状态。

当前安装包未配置 Windows 代码签名，出现“未知发布者”或 SmartScreen 提示不等于包损坏，但必须记录。

Windows 10 / 11 证据通过后，才允许把已测试的同一个 `Setup.exe` 晋级为私有 `windows-v*` 正式 Release。晋级不得重新打包。

## 5. macOS 打包流程

### 5.1 打包前

macOS 使用当前 Mac 主工作区，不从 Windows Delivery Data 取数据。开始前必须：

1. 检查 `git status`、当前 HEAD 和预期包含的未提交改动；
2. 不把来源不明的 dirty 文件带入发布；
3. 核对正式基础库和内容资产库路径、大小和 SHA-256；
4. 记录真实用户库 SHA-256，但不读取业务内容、不写入、不复制进 App；
5. 确认版本号、`license` / `no-license` 变体和签名方式。

默认正式数据输入由 `build_and_run.sh` 读取：

```text
data/database/sapd_wiki.sqlite3
data/database/sapd_content_assets.sqlite3
```

### 5.2 打包前门禁

稳定 5173 已启动时运行：

```bash
node scripts/run_project_test_suite.mjs \
  --suite pre-dmg \
  --url http://127.0.0.1:5173
```

该门禁检查代码、数据、前端、Runtime、用户库边界和 DMG / Web 一致性，但不会生成 DMG。

### 5.3 生成 DMG

只生成 `no-license` 内测包：

```bash
SAPD_WIKI_DMG_VARIANT=no-license \
SAPD_WIKI_APP_VERSION=<version> \
SAPD_WIKI_REBUILD_BACKEND=1 \
apps/macos/SAPDWiki/script/package_dmg.sh
```

生成全部变体：

```bash
SAPD_WIKI_APP_VERSION=<version> \
SAPD_WIKI_REBUILD_BACKEND=1 \
apps/macos/SAPDWiki/script/package_dmg.sh
```

产物位于：

```text
apps/macos/SAPDWiki/dist/license/
apps/macos/SAPDWiki/dist/no-license/
```

每个 DMG 的 staging 根目录必须包含：

```text
SAPD Wiki.app
Applications -> /Applications
README-FIRST.md
```

用户打开 DMG 后，将 `SAPD Wiki.app` 拖到 `Applications` 图标完成安装，再从
macOS“应用程序”启动。该拖拽只安装 App，不改变首次初始化、Runtime、import、
export 或用户数据库的位置。

### 5.4 macOS 实包校验

打包完成后至少确认：

- `hdiutil verify` 通过；
- DMG 可只读挂载；
- 镜像内 `Applications` 是指向 `/Applications` 的符号链接，App 可拖动安装；
- `.app`、Runtime backend、前端和两座只读数据库存在；
- 包内数据库 SHA-256 与正式输入一致；
- 包内用户库业务表为空；
- Runtime 实际启动、health、核心页面和搜索通过；
- App 退出后 backend / MCP Sidecar 进程清理；
- 真实用户库、Keychain 和正式数据库未被测试写入；
- DMG 文件名、大小、版本、SHA-256 和签名状态已记录。

当前包是 ad-hoc signing、未 notarize 的内测包。其他 Mac 首次打开或 App
Translocation 变化后可能再次要求手工允许。正式分发仍需另行实现和验收 Developer ID、
notarization 与 stapling；不得用当前脚本产物冒充正式包。

当前 macOS App 已恢复 0.3.0 的 `/usr/bin/security` 登录钥匙串路径；Native Security
Broker、Data Protection Keychain 和 `app` profile 强制门禁不属于当前源码或当前
打包合同。首次安装用户 CA 信任时允许出现 macOS 系统认证面板；Keychain 暂时不可访问
时应提示用户解锁，不得误判为证书永久失效，也不得删除或重建健康证书。

下一次出包必须从同一当前源码重建 license / no-license 双 staging，并在最新实包内
验证首次建证、完全退出重开、锁屏 / 解锁后的明确恢复路径，以及 App MCP `28776` 的
OAuth、五工具和 `TOOL_CALL` 审计。现有 0.3.0 安装包或 Web `28775` 的结果不能替代
该验收。任何 Native Broker、Data Protection Keychain、Developer ID 或 notarization
方案都必须作为独立任务重新取得范围与验收授权。

## 6. 用户数据与升级

两个平台的安装包都只带空用户库模板。首次启动时，只有目标数据目录不存在用户库才创建新库。

升级时：

- 程序 Runtime 可以更新；
- 正式只读数据库可以随新版本替换；
- 已存在的用户数据库必须保留；
- MCP 控制状态、证书和用户选择的数据目录不得被静默删除；
- 卸载默认不得删除用户选择的 `SAPDWiki` 数据目录。

任何需要迁移真实用户库 schema 的版本，都必须单独提供备份、dry-run、迁移和恢复证据，不能借打包流程静默执行。

## 7. 完成反馈必须包含

每次打包完成后向用户报告：

- 平台、版本和变体；
- 源码 SHA 及 dirty 状态；
- 数据 release ID 或正式数据输入 SHA-256；
- 安装包文件名、位置或私有 Release 链接；
- 安装包大小和 SHA-256；
- 签名 / notarization 状态；
- 自动门禁结果；
- 尚需人工完成的 Windows 10 / 11 或 macOS 实包 UAT；
- 真实用户库是否保持不变。

## 8. 相关入口

- Windows 迁移与安全边界：`windows-github-installer-migration-plan-2026-07-27.md`
- macOS App 具体命令：`../../apps/macos/SAPDWiki/README.md`
- macOS DMG / Web 一致性：`mac-dmg-browser-parity-contract.md`
- 发布验收矩阵：`release-acceptance-matrix-0.1.md`
- 私有 Windows UAT 模板：私有交付仓 `windows-uat-evidence.template.json`
