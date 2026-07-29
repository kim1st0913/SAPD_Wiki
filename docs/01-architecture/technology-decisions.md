# SAPD Wiki 技术决策

> 状态：`active / current technology decisions`
>
> 更新日期：2026-07-28

本页只记录仍然有效的技术选择。早期 React、Tauri、ZIP alpha 和顾问端一键初始化设想
不再是当前实现依据。

## 当前运行架构

| 层次 | 当前选择 | 边界 |
|---|---|---|
| 共享前端 | 原生 HTML、CSS、JavaScript ES modules | Web、macOS、Windows 共用；业务数据只经 `dataClient` / `/api/v1/*` |
| 后端 | Python 3.11+ 本地 API、ETL 和导出 | 负责清洗、关系、评分、投影和数据门禁 |
| 基础知识库 | SQLite + FTS5 | 只读运行，受控发布替换 |
| 内容资产 | 独立 SQLite 资产库 | 内容寻址、hash 校验，不混入用户库 |
| 用户状态 | 独立 SQLite 用户库 | 批注、数据篮和工作台；升级不得覆盖 |
| macOS 壳 | SwiftPM + Swift / WKWebView | 正式 Mac 主工作区本地生成 DMG |
| Windows 壳 | Electron + NSIS | 私有 `windows-2022` Runner 生成 `Setup.exe` |
| MCP | Python MCP SDK、HTTPS、OAuth、CurrentUser Runtime | 只读基础知识访问；loopback 监听 |

## 数据与前端决策

- 前端不得读取原始 Excel、直接查询 SQLite 或重做 ETL / 评分逻辑。
- `public/data/*.json` 是后端生成的离线兼容包或 API fallback，不是新的业务权威源。
- 基础库、内容资产库和用户库分离；真实用户库永远不进入安装包或 GitHub。
- 新知识通过审批、候选构建、质量门禁、正式 apply、runtime restart 和 MCP 验收发布。
- 当前字段合同见 `api-field-contract.md`，数据包职责见
  `frontend-json-data-package-inventory.md`。

## 桌面交付决策

### macOS

- 不迁移到 GitHub Runner；在正式 Mac 主工作区本地打 DMG。
- 正式外部分发需要签名、notarization 和实包 UAT。
- Web 5173 验收不能替代 WKWebView / DMG 验收。

### Windows

- 公开 `main` 是源码事实源；私有 Delivery Data 保存正式数据输入。
- 私有 Windows Runner 按精确源码 SHA 生成 backend、Electron Runtime 和 NSIS
  `Setup.exe`，校验后上传私有 Internal Release。
- 旧 `codex/windows-electron` 分支、backend-only 和 Mac 手工组装流程已经退役。

当前操作手册：`docs/09-delivery/desktop-packaging-runbook.md`。

## 安全决策

- MCP 只监听本机回环地址，使用 TLS、OAuth 和受控 CurrentUser 证书 / 信任。
- MCP 不开放用户库、源文件、本机路径、凭据、写入或客户端 SQL。
- 导入、测试和打包不得写真实用户库，除非用户明确批准写入和恢复范围。
- GitHub 只保存代码、文档、配置和脱敏 fixture；数据边界由
  `scripts/check_github_data_boundary.py` 审计。

## 维护规则

技术选型变化时，应先更新本页和对应合同，再修改代码与交付流程。已退役方案移入
`docs/05-archive/`，不得在多个当前文档中并行维护不同答案。
