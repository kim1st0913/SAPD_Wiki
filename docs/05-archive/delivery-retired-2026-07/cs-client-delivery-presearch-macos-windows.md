# macOS / Windows C/S 客户端交付预研

> 归档状态：`historical / presearch superseded`

> 状态：draft
> 日期：2026-06-03
> 适用项目：SAPD Wiki
> 目标：评估在现有 ZIP 解压即用版之后，如何向 macOS / Windows 桌面 C/S 客户端交付演进。

> 2026-07-21 实施决策：本文原有 Tauri 推荐仅保留为历史预研。当前 macOS 已采用原生 App + DMG，Windows 已采用 Electron + Python sidecar + NSIS；Windows 后端由 GitHub CI 生成，安装器可在 Mac 组装。现行流程以 `delivery-bundle-1.0-prebuilt-database.md` 和 `windows-electron-build-guide.md` 为准。

## 1. 预研结论

当前不建议跳过 ZIP alpha 直接做正式安装包。更稳的路线是：

```text
P0：继续完成分平台 ZIP 解压即用版
P1：Tauri 桌面壳 + 本地 sidecar 后端，形成真正的 C/S 客户端
P2：签名、公证、安装包、企业内部分发和更新
P3：远程 C/S / 多用户服务端，作为后续独立架构线
```

推荐 P1 技术路线：

```text
Tauri Client
+ embedded frontend-dist
+ SAPD-Wiki-Backend sidecar
+ base/user 双库
+ 127.0.0.1 本地 API
+ 本地应用数据目录
+ macOS .app / .dmg
+ Windows NSIS .exe 或 MSI
```

这条路线的好处是：复用当前前端、复用当前 Python 本地服务、复用 `sapd_wiki_base.sqlite3` / `sapd_wiki_user.sqlite3` 双库边界，不需要在客户端阶段重做 ETL、数据库 schema 或页面。

## 2. 本项目里的 C/S 含义

本预研把 C/S 分成两类。

| 类型 | 含义 | 当前建议 |
|---|---|---|
| 本地 C/S | 桌面客户端负责窗口、启动、菜单、文件路径、进程生命周期；本地服务端 sidecar 负责 API、SQLite、日志和诊断 | P1 主线 |
| 远程 C/S | 桌面客户端连接公司内网或云端服务端，多用户共享数据 | P3 后置 |

SAPD Wiki 当前更适合先做本地 C/S。原因是现有系统是本地知识库、预构建基础库和用户本地写入，不需要先引入账号、权限、同步、服务端运维和数据安全合规链路。

## 3. 路线对比

| 路线 | 交付物 | 优点 | 风险 | 建议 |
|---|---|---|---|---|
| 继续 ZIP | `.zip` + 启动脚本 + 本地浏览器 | 最快、最容易内部试发、便于定位运行问题 | 用户体验像工具包，不像正式客户端；macOS Gatekeeper / Windows SmartScreen 仍可能提示 | 保持 P0 |
| Tauri + sidecar | macOS `.app/.dmg`、Windows `.exe/.msi` | 体积较轻，适合包装现有 Web UI；可嵌入 Python API server sidecar；能统一窗口、菜单、启动和诊断体验 | 需要 Rust / Tauri 构建链；sidecar 要分平台构建；签名、公证、更新需要单独治理 | 推荐 P1 |
| Electron + sidecar | macOS / Windows 桌面安装包 | 生态成熟，Node 侧能力强，打包资料多 | 包体大；对当前静态前端和 Python 后端来说收益不明显 | 备选，不作为首选 |
| Tauri + Rust 后端重写 | 单一 Rust 应用或 Rust API sidecar | 体积和安全软件误报风险可能更好 | 会重写当前后端，影响大 | beta 后再评估 |
| 原生 Swift / WinUI 双端 | 原生客户端 | 原生体验最好 | 两套 UI，维护成本高；不复用当前前端 | 不建议 |

## 4. 推荐架构

```text
用户双击 SAPD Wiki App
→ Tauri 主进程启动
→ 检查 app resource 与用户数据目录
→ 复制或定位 base manifest
→ 创建 / 打开 user db
→ 启动 SAPD-Wiki-Backend sidecar
→ sidecar 绑定 127.0.0.1 随机可用端口
→ Tauri WebView 加载本地前端
→ 前端通过 dataClient 调用本地 API
```

关键边界：

- 前端仍然只通过 `dataClient` 或 `/api/v1/*` 消费数据。
- sidecar 负责 SQLite、base/user 合并、用户写入、日志和诊断。
- Tauri 负责桌面窗口、菜单、启动状态、关闭时清理 sidecar、打开诊断目录。
- 不把 ETL、主数据归一、评分和关系生成搬进前端。
- 不把可写用户库放进 `.app`、`.dmg`、`Program Files` 或包内只读目录。

## 5. macOS 交付要点

### 5.1 产物形态

建议阶段：

```text
P1-dev：未签名 / ad-hoc signed .app，仅开发测试
P1-alpha：Developer ID 签名 + notarization 的 .app / .dmg
P2：稳定 .dmg + 自动更新产物
```

Tauri 官方支持 macOS `.app` 和 `.dmg` 打包。正式从浏览器下载分发时，macOS 需要签名与 notarization，否则用户会遇到 Gatekeeper 或“无法验证 / 已损坏”类提示。Apple 官方说明，Mac App Store 外分发的软件需要 Developer ID 证书并提交 Apple notarization，Gatekeeper 会检查软件是否已知恶意或被篡改。

### 5.2 证书与账号

正式交付需要：

- Apple Developer Program 或 Apple Developer Enterprise Program；
- `Developer ID Application` 证书；
- notarization 所需 App Store Connect API 或 Apple ID 凭据；
- CI 或构建 Mac 上的签名密钥管理。

免费 Apple Developer 账号可以用于测试签名，但不能完成正式 notarization，不适合作为内部团队稳定交付路径。

### 5.3 数据目录

建议：

```text
只读资源：App bundle resources
用户数据：~/Library/Application Support/SAPD Wiki/
日志：~/Library/Logs/SAPD Wiki/
诊断导出：用户选择目录或 Application Support 下 diagnostics/
```

不要把 `sapd_wiki_user.sqlite3` 放在 `.app` 包内。`.app`、`.dmg` 和后续升级流程都不应承载用户可写数据。

### 5.4 架构包

第一阶段建议继续分包：

```text
SAPD-Wiki-mac-arm64.dmg
SAPD-Wiki-mac-x64.dmg
```

如果内部用户机器分布复杂，再评估 universal binary。分包更容易定位 sidecar、Python 打包和签名问题。

## 6. Windows 交付要点

### 6.1 产物形态

Tauri Windows 主要交付为：

- NSIS `setup.exe`
- MSI

Tauri 官方说明，Windows Tauri 应用可用 WiX 生成 `.msi`，也可用 NSIS 生成 `setup.exe`；`.msi` 只能在 Windows 上创建，因为 WiX 只能在 Windows 上运行。当前项目若进入正式 Windows 客户端，应继续在 Windows x64 环境或 Windows CI runner 上构建。

建议优先顺序：

| 阶段 | 产物 | 原因 |
---|---|---|
| P1-alpha | NSIS `setup.exe` | 用户双击安装体验直接，适合内部试发 |
| P1-beta | NSIS + MSI 二选一或并行 | 若企业 IT 需要集中部署，再补 MSI |
| P2-enterprise | MSIX / Intune 路线评估 | 适合企业受管设备，但签名、证书和部署链路更重 |

### 6.2 SmartScreen 与签名

Windows 正式分发必须面对 SmartScreen。Microsoft 官方说明，SmartScreen 同时看发布者声誉和文件 hash 声誉；即使文件已签名，新二进制也可能在积累声誉前显示“未识别应用”提示。

推荐策略：

- alpha 内部试发：可以接受说明性 SmartScreen 提示，但必须记录。
- beta 起：每个 `.exe`、`.msi` 和 sidecar `.exe` 都应使用可信证书签名。
- 不把 EV 证书作为绕过 SmartScreen 的核心方案。Microsoft 已说明 EV 不再给新文件提供即时 SmartScreen 绕过，仍需要声誉积累。
- 如果企业内部分发有 Intune / GPO / 证书策略，可把企业 IT 分发作为降低提示的主路径。

### 6.3 数据目录

建议：

```text
只读安装目录：%ProgramFiles%\SAPD Wiki\
用户数据：%LOCALAPPDATA%\SAPD Wiki\
日志：%LOCALAPPDATA%\SAPD Wiki\logs\
诊断导出：%LOCALAPPDATA%\SAPD Wiki\diagnostics\ 或用户选择目录
```

不要把用户库写入安装目录。普通用户可能没有写权限，升级或卸载也可能影响数据。

### 6.4 WebView2

Windows Tauri 使用 WebView2。Tauri 文档说明 Windows 10 2018 年 4 月更新及之后版本、Windows 11 通常随系统分发 WebView2 runtime；离线环境可考虑 `offlineInstaller` 或固定版本 WebView2，但包体会显著增大。SAPD Wiki 内部团队如果存在离线电脑，需要单独做 WebView2 runtime 验收。

## 7. 安全边界

本地 C/S 客户端必须固定以下安全边界：

- sidecar 只绑定 `127.0.0.1`，不得绑定 `0.0.0.0`。
- 每次启动生成 session token，前端请求写入 API 时携带 token。
- 写入 API 限制 `Content-Type: application/json`，并校验 schema。
- 诊断包必须脱敏，不包含用户库原文件、备注全文、标签全文或用户自定义对象全文。
- base 数据库只读挂载，启动和写入测试后检查 hash 不变。
- 客户端关闭时应停止 sidecar；异常退出时下次启动能识别并清理旧进程。

## 8. 自动更新

自动更新不建议进入 P1-alpha。原因：

- macOS 更新包需要签名 / notarization 链路稳定。
- Windows 更新包需要签名和 SmartScreen 预期管理。
- Tauri updater 需要更新包签名，私钥丢失会导致已安装用户无法继续收到更新。

建议 P2 再引入自动更新，并先从“手动下载新版安装包 + manifest 显示版本提示”开始。

## 9. 对现有工程的最小改造清单

P1 原型建议新增，不改当前 ZIP 主线：

| 模块 | 最小任务 |
|---|---|
| Tauri app | 新增 `apps/desktop` 或 `src-tauri`，加载现有 `frontend-dist` |
| sidecar | 复用 `SAPD-Wiki-Backend`，按 Tauri target triple 放入 `externalBin` |
| 启动管理 | Tauri 启动 sidecar，等待 `/api/v1/health`，注入 API base URL |
| 数据路径 | sidecar 支持从 OS app data 目录读取 / 创建 user db |
| 诊断 | 客户端菜单提供“导出诊断包”“打开日志目录” |
| 构建 | macOS arm64 / x64、Windows x64 分平台构建 |
| 验收 | 启动、关闭、写入、base hash、日志、诊断、离线、杀软 / Gatekeeper 记录 |

## 10. 验收清单

### macOS

- `.app` 能启动。
- `.dmg` 能安装或拖入 Applications。
- sidecar 被正确签名并随 `.app` 携带。
- notarization 通过。
- 首次启动不要求用户打开终端。
- 用户库创建在 Application Support。
- 关闭 App 后 sidecar 停止。
- base hash 不变。
- 诊断包可导出且脱敏。

### Windows

- `setup.exe` 或 `.msi` 能安装。
- 安装后普通用户权限可启动。
- sidecar `.exe` 存在且可运行。
- WebView2 缺失或离线时有明确处理策略。
- SmartScreen / Defender 结果已记录。
- 用户库创建在 `%LOCALAPPDATA%`。
- 关闭 App 后 sidecar 停止。
- base hash 不变。
- 诊断包可导出且脱敏。

## 11. 当前建议的下一步

建议下一步只做一个 P1 Spike，不进入正式安装器：

```text
CS-CLIENT-R0：Tauri + sidecar 本地 C/S 原型
```

目标：

- 用 Tauri 打开当前前端；
- 启动现有后端 sidecar；
- 前端能访问 `/api/v1/health` 和 `/api/v1/base/summary`；
- 能在 macOS arm64 本机跑通；
- Windows 只形成构建说明，不承诺本机验证。

暂不建议：

- 暂不做自动更新；
- 暂不做远程服务端；
- 暂不重写 Rust 后端；
- 暂不把 C/S 客户端作为当前 ZIP alpha 的阻塞项；
- 暂不为了安装包体验修改数据模型或前端数据契约。

## 12. 官方参考资料

- Apple Developer：Developer ID 与 notarization
  `https://developer.apple.com/support/developer-id/`
- Tauri：Embedding External Binaries / sidecar
  `https://v2.tauri.app/develop/sidecar/`
- Tauri：Windows Installer
  `https://v2.tauri.app/distribute/windows-installer/`
- Tauri：macOS Code Signing
  `https://v2.tauri.app/distribute/sign/macos/`
- Tauri：Updater
  `https://v2.tauri.app/plugin/updater/`
- Microsoft Learn：SmartScreen reputation
  `https://learn.microsoft.com/en-us/windows/apps/package-and-deploy/smartscreen-reputation`
- Microsoft Learn：Windows code signing options
  `https://learn.microsoft.com/en-us/windows/apps/package-and-deploy/code-signing-options`
- Microsoft Learn：Choose a distribution path
  `https://learn.microsoft.com/en-us/windows/apps/package-and-deploy/choose-distribution-path`
