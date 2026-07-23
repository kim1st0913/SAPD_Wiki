# SAPD Wiki 本地 MCP 批次 B Web 开发授权记录

| 项目 | 内容 |
|---|---|
| 日期 | 2026-07-23 |
| 状态 | `APPROVED` |
| 授权计划 | `docs/06-implementation/local-mcp-web-first-development-and-client-validation-plan-v0.2.md` |
| 授权批次 | `B0 → B1 → B2 → B3 → B4 → B5` |
| 执行分支 | `codex/local-mcp-product-development` 的后续独立集成线 |

## 用户确认

用户在当前 Codex 任务中明确回复：

> 确认按 v0.2 执行批次 B（B0–B5）。

## 允许范围

- 独立 worktree；
- 当前 5173 shared frontend 与既有 MCP 代码的受控集成；
- Web dev Runtime、MCP Core、Sidecar、控制 API 和前端接线；
- synthetic fixture 与隔离 synthetic SQLite；
- 只绑定 loopback 的临时 HTTPS；
- 加密测试私钥、隔离秘密提供器和显式测试 CA；
- 自有测试客户端与自动化端到端验证；
- 本地阶段提交。

## 明确不允许

- 修改真实 Codex/ChatGPT/IDE 配置或 OAuth 凭据；
- 写入系统信任、Keychain 或 DPAPI 正式状态；
- macOS/Windows 生产运行时适配；
- DMG、Windows 安装包或其他 packaging；
- D0-Pilot、D0-Release、真实内容或用户数据；
- 打开、创建、迁移或修改用户库；
- push、PR、merge 或发布。

## 停止点

B5 报告形成后停止。当前 Codex 真实连接必须等待 C1 单独授权。
