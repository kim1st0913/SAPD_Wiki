# SAPD Wiki Windows Changelog

## 0.4.1

- Phase 2 Batch 1 将能力、维护和共享索引的数据 owner 切换到 SQLite-backed `/api/v1/projections/*`；本批业务数据不再回退到 `public/data` JSON。
- 正式基础库 artifact SHA-256 从 `30d14679c7d8b7743fba129af38afde7b943bcdd707ff7b8a57bce5146f54c9e` 更新为 `188f20efed31631f1f53219d4d8ef6f5e8c4fa5f2f07309b6bbe185994cf3680`；对象和 owner 保持不变，`has_measure` 关系增至 53 条。
- 能力页默认进入摘要视图，关系图谱改为用户选择后按需初始化，保留显式图谱深链，减少首屏不必要的图谱构建。
- Runtime 发布身份绑定源码、基础库、内容资产库和 projection 合同；5173 启动健康门新增三条 Batch 1 projection 检查，路由返回 404 或 503 时不再判定健康。
- Windows Runtime 继续只携带受控只读基础库、内容资产库和空用户库模板，不包含真实用户批注、Issue、收藏、历史记录或恢复包。

## 0.4.0

- 成熟度评估新增可持续维护的自定义模板工作台，以脑图方式编辑 L0、L1、L2、关注点和安全技术服务，支持逐层展开、拖动定位、缩放、搜索、合法层级移动、子树复制及会话级撤销/重做。
- 自定义模板可以从成熟度首页直接创建，也可以从项目模板校验发布后进入模板管理；项目草稿、已发布模板和正式评分数据继续保持隔离。
- 自定义评估点补充统一的 L1-L5 通用成熟度描述和 4 个评分维度；已有对象专用评分依据保持原样，缺失的固定模板依据仍然阻塞，不会被通用文本静默覆盖。
- 安全技术服务角色改为按能力类型自动判定：T 类形成独立服务评估点，G/M 类作为平台工具参考；加载、创建、移动、XLSX 导入和后端校验使用同一规则。
- 优化“系统设置 > AI功能集成”的 MCP Runtime 状态和 WorkBuddy 配置流程，提供受控的 JSON 模板与配置提示词，并明确校验证书清单、CA 指纹、Node/npx 路径和 OAuth 授权边界。
- Windows Runtime 同时交付 `README-FIRST.md` 和独立 `CHANGELOG.md`；安装后的版本说明位于用户选择的数据目录 `SAPDWiki/Runtime`，私有 Internal Prerelease 也提供独立 Changelog 供安装前阅读。
- Runtime 继续携带已批准的正式基础知识库和内容资产库，用户数据库使用干净模板；不包含真实用户批注、Issue、收藏、历史记录、恢复包或开发机导出文件。
- 当前仍为未签名内测版本，可能出现“未知发布者”或 SmartScreen 提示；正式发布前仍需完成 Windows 10 和 Windows 11 实机 UAT。

## 0.3.5

- 使用 Electron、Python 后端和 NSIS 交付 Windows x64 桌面安装程序，安装向导支持选择程序安装位置，并提供标准卸载程序。
- 首次启动支持选择数据父目录，应用会分别创建 `SAPDWiki/import`、`SAPDWiki/export` 和 `SAPDWiki/Runtime`；“系统设置”可以继续调整工作目录、文件上传路径和文件下载路径。
- Windows Runtime 完整启用本机 MCP 服务，在“系统设置 > AI功能集成”中管理安全连接、服务状态、客户端授权和审计；提供五个基础知识只读工具。
- 修复 Windows MCP 控制状态、固定 Runtime 路径、命名管道、DPAPI 二进制密钥材料和 CurrentUser 证书信任处理。
- 首页提供批注一键导出，导出为便于阅读和反馈的 Markdown 文件。
- Runtime 携带已批准的正式基础知识库和内容资产库，用户库使用干净模板；升级和卸载默认保留用户选择的数据目录。
- Windows 安装包改由私有 GitHub Windows Runner 按公开 `main` 精确提交和不可变 Delivery Data 构建，并执行安装、卸载、MCP、数据边界及哈希验证。
- 当前仍为未签名内测版本，可能出现“未知发布者”或 SmartScreen 提示；正式发布前仍需完成 Windows 10 和 Windows 11 实机 UAT。

## 0.3.0（macOS）

- 升级为 0.3.0 macOS 测试包；本次交付只生成无授权版，不显示授权窗口或 30 天倒计时。
- Runtime 同步当前最新前端、后端、正式基础查询库、内容资产库和成熟度评估测试数据。
- 新增本机 MCP Sidecar，可在“系统设置 > AI功能集成”中建立本机 HTTPS 连接、启动服务、确认客户端只读授权并查看审计。
- MCP 提供 `search_knowledge`、`get_knowledge_object`、`get_related_knowledge`、`get_evidence`、`get_knowledge_version` 五个只读工具。
- MCP 不读取用户批注、Issue、收藏、用户 SQLite、源文件、本地路径、密钥或不受限 SQL；授权与审计使用独立控制库。

## 0.2.0（macOS）

- 升级为 0.2.0 双版本测试包，授权版与无授权版使用同一构建时间戳。
- 包含当前成熟度评估完整运行模块，以及 2 个受控测试案例：1 个已完成、1 个正在进行。
- 仅已完成案例携带 1 份与当前评分哈希一致的正式报告；进行中案例不携带报告。
- 成熟度报告作为首次安装测试种子写入 `Runtime/data/user/maturity-reports`；已有报告目录不会被覆盖。
- 用户 SQLite 继续使用干净模板，不携带开发机批注、Issue、收藏或其他个人数据。
- 用户目录统一为 `SAPDWiki/import`、`SAPDWiki/export` 和 `SAPDWiki/Runtime`；导出按报告、评分表、模板、Issue 和诊断包分类保存。

## 0.1.7（macOS）

- 基于当时最新工作区重新打包，便于后续验证。
- 授权版和无授权版继续同版本、同时间戳、分目录交付。
- 保存位置继续使用父级目录规则，App 自动创建 `SAPDWiki/Runtime` 和 `SAPDWiki/export`。
- 本版本仍按内测交付处理，不启用正式签名公证、安装器或自动更新机制。

## 0.1.6（macOS）

- 按打包要求同时生成授权版和无授权版 DMG。
- 授权版和无授权版使用同一版本号与构建时间戳，文件名和存储目录分别带 `license` / `no-license`。
- 保存位置选择改为父级目录，App 自动创建 `SAPDWiki/Runtime` 和 `SAPDWiki/export`。
- `README-FIRST.md` 增加 Changelog，后续打包持续记录版本变化。
