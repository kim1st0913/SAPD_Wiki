# Windows GitHub Installer 迁移计划

> 状态：`W0-W3 + W5 complete / W4 watcher repair pending / W6 real Windows UAT pending / W7 formal promotion pending`
>
> 日期：2026-07-27
>
> 目标产物：Windows x64 NSIS `Setup.exe`
>
> 当前日常操作入口：[`desktop-packaging-runbook.md`](desktop-packaging-runbook.md)

## 1. 冻结决策

本迁移只改变 Windows 交付链路：

- macOS 继续在正式 Mac 主工作区本地构建、验证和生成 DMG。
- macOS 不迁移到 GitHub Actions，也不改用远端 Delivery Data。
- Windows 源码以 `main` 为唯一事实源；已完全并入 `main` 的
  `codex/windows-electron` 本地和远端分支已删除。
- Windows 的 PyInstaller 后端、Electron Runtime 和 NSIS 安装器全部在 GitHub `windows-2022` Runner 构建。
- 正式基础库、内容资产库、真实用户库、恢复包、原始资料和生成安装包不得进入公开源码仓库。

当前源码仓库 `kim1st0913/SAPD_Wiki` 为公开仓库。公开 Release、公开 Actions Artifact 或 Git 历史均不得承载正式知识数据库或包含这些数据库的 `Setup.exe`。

## 2. 目标架构

采用“私有交付仓主动轮询公开源码 + 私有 Windows 构建”的双仓结构。这样公开仓无需保存任何可读取私有 Artifact 的跨仓凭据：

```text
公开源码仓 SAPD_Wiki/main
            ↑ 每10分钟只读检查 main SHA / 路径差异
私有交付仓 SAPD_Wiki_Delivery_Private
  ├─ 已批准 Windows Delivery Data Release
  ├─ schedule / workflow_dispatch
  ├─ 私有 windows-2022 workflow
  ├─ checkout 公开源码的精确 SHA
  ├─ 构建并验证 Windows backend
  ├─ 组装 Electron Runtime
  ├─ 生成并验证 NSIS Setup.exe
  └─ 上传私有 Installer Artifact
            ↓
Windows 10/11 人工 UAT
            ↓
显式批准后晋级为私有 Release
```

私有交付仓已经固定为 `kim1st0913/SAPD_Wiki_Delivery_Private`。workflow、
token 和文档必须使用该精确仓库身份，不允许运行时猜测。

## 3. 为什么不用公开仓直接打最终安装器

GitHub checkout 不包含受保护的 `data/database/`。最终 Runtime 至少需要：

- `sapd_wiki.sqlite3` 的批准只读快照；
- `sapd_content_assets.sqlite3` 的批准只读快照；
- 由打包工具创建的空用户库模板；
- 与数据库匹配的 manifest、版本和 SHA-256。

把数据库直接提交、上传到公开 Release，或把包含数据库的安装器上传到公开 Artifact，都会越过当前数据边界。CI 也不得以空库、旧 staging 库或只含前端 JSON 的降级包冒充正式安装器。

## 4. Windows Delivery Data 合同

Delivery Data 只服务 Windows CI，不替代或介入 macOS DMG 输入。建议资产结构：

```text
SAPD-Wiki-Windows-Delivery-Data-<release-id>.zip
├── data/
│   └── base/
│       ├── sapd_wiki_base.sqlite3
│       └── sapd_content_assets.sqlite3
├── delivery-data-manifest.json
└── SHA256SUMS.txt
```

`delivery-data-manifest.json` 最少包含：

- `schemaVersion`
- `releaseId`
- `createdAtUtc`
- `sourceMainRevision`
- 两座数据库的逻辑角色、字节数和 SHA-256
- SQLite `integrity_check`、`foreign_key_check` 和业务 schema/version 摘要
- 内容对象、关系、证据和资产数量
- 用户数据库状态固定为 `not_included`
- `approvedForWindowsPackaging=true`
- 审批人、审批时间和对应验收报告引用

生成规则：

- 只从已验收的正式数据库读取，不执行 ETL、migration 或内容增量 apply。
- 生成前后正式数据库 SHA-256 必须一致。
- 不包含真实用户库；空用户库继续由 `build_zip_bundle.py` 在 Runner 上按 schema 创建。
- 不包含 `data/exports/`、恢复包、日志、诊断、源 Excel、原始内容文件或本机路径。
- ZIP 只上传到私有交付仓的私有 Release，并以资产 SHA-256 锁定；禁止覆盖同名资产。更新必须创建新的 `releaseId`。

## 5. 权限和秘密边界

公开源码仓不保存跨仓 token、GitHub App 私钥或其他私有交付凭据。GitHub 的 Actions `write` 权限包含 Actions `read`，不存在“只能触发但不能读取私有 Artifact”的原生权限，因此把 dispatch token 放进公开仓不满足最小权限边界。

私有交付仓使用自身 `GITHUB_TOKEN`：

- 读取私有 Delivery Data Release；
- 读取私有配置；
- 在隔离 job 之间传递短期 Actions Artifact；
- 发布新的不可变 Internal Prerelease；
- 不覆盖已有 Release 或同名资产。

PR 只运行无秘密的源码和配置检查。来自 fork 的代码永远不能接触 dispatch token 或 Delivery Data。

## 6. main 自动触发范围

私有仓 watcher 每10分钟读取公开 `main`，与最近成功构建的公开 SHA 比较路径；只有下列路径变化才调用同仓 builder：

- `apps/electron/**`
- `frontend/capability-browser/**`
- `scripts/build_zip_bundle.py`
- `scripts/check_bundle_runtime.py`
- `scripts/check_github_data_boundary.py`
- `scripts/create_user_db.py`
- `scripts/prepare_windows_electron_runtime.py`
- `scripts/package_backend_pyinstaller.py`
- `scripts/package_backend_windows.ps1`
- `scripts/run_local_server.py`
- `scripts/verify_windows_installer.ps1`
- `scripts/windows_delivery_data.py`
- `src/sapd_wiki/**`
- Windows/MCP 相关定向测试与依赖锁文件

公开仓原 `.github/workflows/build-windows-backend.yml` 属于已退役 backend-only
链路，现归档于 `docs/05-archive/delivery-retired-2026-07/workflows/`。生产 workflow
只存在于私有交付仓。

以下变化不触发 Windows 安装器：

- `apps/macos/**`
- macOS DMG、签名和 notarization 脚本
- `data/**`
- 文档和纯治理记录
- 本地恢复包、虚拟环境与构建产物

数据版本升级不依赖公开仓 `data/**` 变化，而由私有交付仓发布新的 Delivery Data 后触发一次私有构建。

## 7. 私有 Windows 构建流水线

私有 workflow 接收并冻结 `source_sha`，然后顺序执行：

1. 验证 SHA 来自公开仓 `main` 历史，拒绝任意 fork 或游离提交。
2. checkout 精确 SHA，不使用漂移的分支头。
3. 读取私有仓当前已批准的 Delivery Data 指针。
4. 下载精确 Release 资产并验证资产 SHA-256。
5. 安全解压并验证 manifest、SQLite 完整性、外键、数据库内部版本和固定业务计数。
6. 安装锁定的 Python、Node 和 Electron 依赖；优先使用 lockfile 和精确版本。
7. 运行 Windows backend/MCP 定向测试。
8. 使用 PyInstaller 构建 `SAPD-Wiki-Backend.exe`，验证 `--help` 和 `--mcp-sidecar --help`。
9. 调用 `prepare_windows_electron_runtime.py`，显式传入已验证的 backend 目录、基础库和内容资产库。
10. 运行 `check_bundle_runtime.py`、Electron 单元测试和 GitHub 数据边界检查。
11. 用 Electron Builder 在 Windows Runner 生成 x64 NSIS `Setup.exe`。
12. 验证 `win-unpacked` 内容和最终安装器：
    - backend EXE、`_internal/`、MCP 依赖存在；
    - 前端入口、配置、runtime fingerprint 存在；
    - 两座只读数据库 hash 与 Delivery Data manifest 一致；
    - 空用户库业务表为 0；
    - `app.asar`、卸载器和 NSIS 安装器存在；
    - 安装器文件名、版本、PE 头、大小和 SHA-256 合法；
    - 当前未签名状态被记录，不伪装为签名通过。
13. 生成 `windows-installer-build-info.json` 和 `SHA256SUMS.txt`。
14. 只向私有交付仓上传：
    - `SAPD-Wiki-Setup-<version>-win-x64.exe`
    - `windows-installer-build-info.json`
    - `SHA256SUMS.txt`
    - `windows-runner-uat.json`

任一数据、来源、版本或内容门禁失败时不得上传安装器。

## 8. 阶段计划

| 阶段 | 工作 | 完成门禁 | 状态 |
|---|---|---|---|
| W0 决策与恢复点 | 确认私有交付仓身份、管理员、触发方式、Artifact 保留期；导出当前 workflow 和分支 refs | 精确目标仓与权限矩阵确认；现有 backend-only workflow 可恢复 | `complete` |
| W1 数据包工具 | 实现 Windows Delivery Data 的只读 build/verify 工具和 manifest schema | 双次构建逻辑内容一致；正式双库 hash 未变；真实用户库未读取或写入 | `complete` |
| W2 私有交付仓 | 建立私有仓、环境保护、Delivery Data Release 规则和最小权限 | 公开匿名访问不能读取数据或安装器；secret 不出现在日志 | `complete` |
| W3 私有构建器 | 在私有仓实现 Windows backend → Runtime → NSIS → Artifact 全链路；完成 Windows MCP D2 平台接线 | 固定源码 SHA 和数据 release 可重复生成安装器；DPAPI CurrentUser、CurrentUser Root、Windows 安全 IPC、固定受保护 Runtime 和 Electron 控制面全部通过 | `complete` |
| W4 main watcher | 私有仓定时检查公开 `main` 相关路径并选择精确 SHA | watcher 传递必填 `app_version`，相关 push 在下一轮询周期触发一次；无关文档/macOS 变化不触发；公开仓无 secret | `repair_pending`：历史实现已完成，当前输入合同回归待修复和成功运行取证 |
| W5 并行试运行 | 连续完成至少两次新链路构建并比较不可变候选 | 相同输入的 Runtime 指纹一致；安装器 manifest 可追溯；无公开数据泄漏 | `complete` |
| W6 Windows UAT | 在真实 Windows 10/11 安装、启动、搜索、MCP、导入导出、退出和卸载 | UAT 清单全绿；用户目录保留；进程清理；SmartScreen 状态记录 | `pending` |
| W7 切换与收口 | 新链路成为唯一 Windows 生产构建；旧 workflow 改为诊断或退役 | main 自动链路稳定；恢复手册、当前状态和交付指南同步 | `pending` |

W0—W4 属于迁移实现；W5—W7 属于发布切换。W4 曾完成迁移实现，但当前 watcher 未传
必填 `app_version`，因此恢复为待修复状态；在私有 workflow 修复并取得成功运行证据前，
不得宣称自动触发健康。未完成 W6 前，CI 生成的安装器只能标记为 `internal testing`。

## 9. 验收矩阵

### 数据与隐私

- `python3 scripts/check_github_data_boundary.py`
- `python3 scripts/audit_json_package_boundary.py`
- 公开 Git 历史、公开 Release 和公开 Artifact 不含 SQLite、Delivery Data ZIP 或 Setup。
- 两座正式数据库构包前后 hash 不变。
- 安装器内用户库是空模板，真实用户库保持原 hash。

### CI 与可追溯性

- 每个安装器同时绑定公开 `source_sha`、私有 `data_release_id`、两座数据库 hash、backend hash、Runtime fingerprint 和 installer hash。
- 相同输入重复执行不选择“latest”漂移资产。
- Delivery Data 缺失、资产被替换、hash 不符或 schema 不兼容时 fail closed。
- `main` 的 macOS-only、文档-only 提交不触发 Windows 构建。

### Windows Runtime

- backend 与 MCP Sidecar 的 CLI smoke 通过。
- Runtime 内容检查通过。
- Electron 测试通过。
- `win-unpacked` 静态结构检查通过。
- Windows 10/11 实机完成安装位置、首次数据目录、核心页面、搜索、MCP、退出、覆盖安装和卸载保留数据验收。

### macOS 不回归

- 不修改 `apps/macos/**`、DMG 输入、签名、公证或本地数据库选择逻辑。
- macOS 继续读取正式 Mac 主工作区中的批准数据库。
- Windows Delivery Data Release 不成为 macOS 构建依赖。

## 10. 回退方案

新链路失败时：

- 停用或暂停私有 watcher，不触发新的候选；
- 保留不可变 Delivery Data Release、Internal Prerelease 和构建证据；
- 继续使用上一份已验收安装包，不覆盖、不删除；
- 修复后用精确源码 SHA 和精确 data release ID 重新运行私有 workflow；
- 不恢复已退役的 backend-only + Mac 手工组装生产流程；
- 不修改正式数据库、不改变 macOS DMG 链路，也不得把数据库移回公开仓。

## 11. 明确不做

- 不迁移或重写 macOS 打包流程。
- 不把正式数据库、内容资产库或 Setup 上传到公开仓。
- 不自动发布公开 GitHub Release。
- 不在本阶段实施 Windows 代码签名、证书采购或 SmartScreen 信誉建设。
- 不修改 ETL、知识内容、评分规则、源 Excel 或正式用户库。
- 不恢复或重新建立已经退役的 `codex/windows-electron` 生产分支。

## 12. 已冻结的用户决策

1. 私有交付仓固定为 `kim1st0913/SAPD_Wiki_Delivery_Private`，仅授权成员可读取 Delivery Data 和安装器。
2. 私有 Actions 日志和 Artifact 保留 30 天；通过 UAT 后再晋级不可变私有 Release。
3. Windows `0.3.0` **必须包含完整 MCP**。禁止通过设置 `mcp_platform_integration=false`、隐藏入口或降级为 `MCP unavailable` 推进 W3—W7。
4. Windows MCP D2 的发布门禁包括：真实 DPAPI CurrentUser、`CurrentUser\Root` 精确证书治理、Windows 一次性安全 IPC、固定 `%LOCALAPPDATA%` 受保护 Runtime、Electron 最小权限控制面和 Windows 原生 Runner 验收。
5. macOS 永久保持正式 Mac 主工作区本地 DMG 流程，不读取 Windows Delivery Data，也不迁移到 GitHub Actions。

## 13. 2026-07-27 执行状态

- W0 恢复点位于 `data/exports/worker-verify/windows-github-installer-migration/w0-20260727/`；全 refs bundle 已通过 `git bundle verify`。
- W1 已生成 `windows-data-20260727-r1`：归档 SHA-256 为 `1f90ec0645f9bb811dff0f27b8047eaa681f6e0a9bd41d521ed9fce05011433b`，基础库/内容资产库 SHA-256 分别为 `30d14679c7d8b7743fba129af38afde7b943bcdd707ff7b8a57bce5146f54c9e` / `adaa19bf1fb641eb6e54da74b33b3f0510126ed9208d0d97ed565398db05bce6`；正式输入构包前后未变，真实用户库未包含。
- W1/W3 来源与 Runtime 定向测试当前为 `8/8 PASS`；包含 ZIP 路径/重复/额外成员门禁、分片重组、Delivery manifest 与双库校验、backend provenance、构建机绝对路径排除和相同 backend+data 的 Runtime fingerprint 一致性。
- 私有仓 `kim1st0913/SAPD_Wiki_Delivery_Private` 已创建；Actions 已限制为 GitHub-owned + full SHA、默认只读 token、30天日志/Artifact，并启用 immutable releases。
- Delivery Data `windows-data-20260727-r1` 已作为不可变私有 Release 发布；真实用户库未包含。
- Windows MCP D2、DPAPI CurrentUser、只读 CurrentUser Root、Windows secret transport、受保护 Runtime、Electron native confirmation 和完整 MCP runtime 的 Runner 门禁已通过。
- 两次独立同输入构建 `30273664928` / `30273682743` 成功；比较运行 `30275164610` 已确认源码、数据、Runtime、backend 和双库 hash 一致。
- 当前推荐候选为 `internal-windows-0.3.0-48edc6009ffd-windows-data-20260727-r1-run30273682743-1`，安装器 SHA-256 为 `15df979db8621d4794806eb5cbad35c94737c76df67621b262a6640c880eb222`。
- W6 仍必须在真实 Windows 10 / 11 上完成交互 UAT；通过前不得执行正式 `windows-v*` 晋级。
