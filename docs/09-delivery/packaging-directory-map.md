# 桌面端打包目录地图

> 状态：`生效中 / 当前事实源`
>
> 更新日期：2026-08-03

本文档用于区分打包源码、流程编排、生成产物、发布证据和已停用的打包材料，并补充 `desktop-packaging-runbook.md` 中的具体操作步骤。

## 1. 生产责任归属

| 平台 | 源码责任方 | 编排责任方 | 发布权威来源 |
|---|---|---|---|
| Windows x64 | 公开仓 `kim1st0913/SAPD_Wiki/main` 的精确 SHA | 私有仓 `kim1st0913/SAPD_Wiki_Delivery_Private` 的 GitHub Actions | 不可变的私有 Delivery Data 和安装器 Release |
| macOS ARM64 | 已确认的 Mac 主工作区状态 | `apps/macos/SAPDWiki/script/package_dmg.sh` | 本地验证通过的 DMG 及其哈希和验收证据 |

公开仓不得包含正式 SQLite 数据库、Delivery Data、安装器、恢复包、用户数据库或私有发布凭据。

## 2. 本地目录合同

```text
.github/workflows/
  data-boundary.yml                       生效中的公开数据边界门禁

apps/
  README.md                               平台目录索引
  electron/                               Windows Electron 源码
    .build/                               已忽略、可清理的 Runtime 和构建工作区
      archive/                            保留的本地过期 Runtime 快照，禁止作为构建输入
    dist/                                 已忽略的当前本地安装器副本或构建输出
      archive/                            保留的本地历史输出
  macos/SAPDWiki/                         macOS Swift App 源码
    script/                               本地 macOS 构建和 DMG 入口
    .build/                               已忽略的构建和缓存工作区
      archive/                            保留的旧缓存目录结构
    dist/                                 已忽略的当前 App、staging 和 DMG 输出
      license/archive/                    历史 license DMG
      no-license/archive/                 历史 no-license DMG

scripts/
  build_zip_bundle.py                     共用的受控 Runtime 组装器
  check_bundle_runtime.py                 共用的 Runtime 校验器
  package_backend_pyinstaller.py          共用的原生 backend 打包器
  create_user_db.py                       空用户数据库模板创建器
  prepare_windows_electron_runtime.py     Windows Runtime 组装责任脚本
  package_backend_windows.ps1             Windows backend 打包封装
  verify_windows_installer.ps1            Windows 安装器验证责任脚本
  windows_delivery_data.py                不可变 Windows 数据包合同
  retired/zip-alpha/                      历史 ZIP 发布封装和启停模板

docs/05-archive/delivery-retired-2026-07/
  workflows/build-windows-backend.yml     已退役的公开 backend-only workflow
```

当前生产脚本继续保留在 `scripts/` 根目录，因为私有 Windows workflow 使用这些精确的公开路径。移动这些脚本时，必须同时修改公开仓和私有仓，并在私有 Runner 上完成一次实包验证。

## 3. GitHub Workflow 合同

公开仓不负责生成生产安装器。当前公开仓的 `.github/workflows/` 目录只保留可公开运行的安全门禁。

私有交付仓负责以下流程：

| Workflow | 职责 |
|---|---|
| `watch-public-main.yml` | 检查公开 `main`，并以精确的相关 SHA 触发构建 |
| `windows-installer.yml` | 组合精确公开源码和已批准 Delivery Data，构建并验证 `Setup.exe`，发布内部预发布版本 |
| `compare-windows-builds.yml` | 在源码、数据和 Runtime 哈希层面对比两次不可变构建 |
| `promote-windows-installer.yml` | 只有取得 Windows 10/11 UAT 证据后，才能晋级同一个已测试安装器 |

2026-08-03 静态检查发现一处私有 workflow 合同不一致：`windows-installer.yml` 要求传入 `app_version`，但 `watch-public-main.yml` 尚未传递该参数。在私有 workflow 修复并取得成功运行证据前，不得宣称自动触发链路健康；手工触发时必须传入精确的语义化版本号。

## 4. 本地产物保存规则

- 各平台供验证脚本使用的活动 `dist/` 位置只保留当前本地安装器或 DMG。
- 较早的本地产物移入对应平台的 `dist/archive/`，不得与当前构建根目录混放。
- 过期的 Electron `.build/runtime-template` 存在被 Electron Builder 误打包的风险。必须将旧快照移入 `.build/archive/`，使下一次本地构建在重新准备 Runtime 前保持失败关闭。
- `dist/archive/` 和 `.build/archive/` 只是便于整理的本地保留区，不是备份权威或发布权威。
- Windows 安装器证据保存在私有 Release；macOS 证据记录在任务或进度文档中，并包含 DMG 路径和 SHA-256。
- 除非某个明确的验证任务规定了证据路径，否则不得把打包产物复制到 `data/exports/worker-verify/`。

## 5. 当前本地分类

2026-08-03 完成目录整理后：

- 当前本地 Windows 副本：`apps/electron/dist/SAPD-Wiki-Setup-0.4.0-win-x64.exe`；
- 过期的本地 Windows `0.3.0` Runtime：`apps/electron/.build/archive/local-windows-0.3.0/`；
- 较早的本地 Windows 安装器和构建输出：`apps/electron/dist/archive/local-history/`；
- 当前本地 macOS DMG：`dist/license/` 和 `dist/no-license/` 分别保留一个 `0.4.0` 文件；
- 较早的本地 macOS DMG：各变体对应的 `dist/*/archive/` 目录；
- 旧的嵌套 Swift 模块缓存：`.build/archive/legacy-nested-swift-cache-20260803/`。
