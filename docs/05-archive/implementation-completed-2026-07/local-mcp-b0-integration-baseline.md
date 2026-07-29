# 本地 MCP 批次 B0 集成基线

> 归档状态：`completed / MCP stage evidence`

| 项目 | 结论 |
| --- | --- |
| 基线日期 | 2026-07-23 |
| 集成分支 | `codex/local-mcp-web-integration` |
| Web 验收入口 | `http://127.0.0.1:5173/` |
| 数据边界 | synthetic-only；禁止正式数据和用户库 |
| B0 状态 | PASS |

## 文件所有权

| 边界 | 权威 owner | 本批规则 |
| --- | --- | --- |
| 全局路由、返回、顶部设置按钮、MCP 状态浮层 | `frontend/capability-browser/components/AppShell.js` | 所有非根页面返回 `/`；`/settings/basic` 只作为兼容重定向 |
| 唯一系统设置页面 | `frontend/capability-browser/components/SystemSettings.js` | 只保留 `/settings/system` 与 `/settings/ai-integration` 两个标签 |
| 设置样式 | `frontend/capability-browser/system-settings.css` | 使用现有设计 token；不保留第二套 AI 设置样式 |
| 前端页面状态与动作 | `frontend/capability-browser/app.js` | 控制动作使用 `request_id + expected_state_version`；真实端口以控制库为权威 |
| 前端 API | `frontend/capability-browser/dataClient.js` | 只调用 `/api/v1/mcp/*` 闭合合同；禁止返回 OAuth Token、私钥、口令和原始日志 |
| Web 控制入口 | `src/sapd_wiki/api_server.py` | MCP 失败不得影响 5173 主站 |
| 控制合同 | `src/sapd_wiki/local_mcp/control_*.py` | B1–B3 共用一个版本化控制快照 |
| Sidecar、OAuth、TLS、Tool | `src/sapd_wiki/local_mcp/` | 仅监听 `127.0.0.1`，仅使用隔离 synthetic Runtime |

## 隔离写入边界

B1–B5 只允许将进程状态、synthetic SQLite、控制库、短期证书、加密私钥、测试 CA 和日志写入显式传入的临时目录。禁止接受 `BundleRuntime`、正式数据库、用户数据库、App 设置目录、系统信任库、Keychain/DPAPI 生产状态或真实客户端配置。

## B0 验收

- 独立 worktree 与独立分支已建立，原 dirty checkout 未提交、stash、reset 或覆盖；
- `SystemSettings` 是唯一设置页，旧 `AiIntegrationSettings` 与旧 CSS 已移除；
- `/settings/system`、`/settings/ai-integration` 和顶部两个入口已冻结；
- 兼容 `/settings/basic` 时只重定向到 `/settings/system`；
- 前端语法检查与 `audit_frontend_system_settings_contract.mjs` 通过；
- B1 从此基线开始；不会在 5187 建立第二个验收入口。
