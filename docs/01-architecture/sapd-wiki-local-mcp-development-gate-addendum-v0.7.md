# SAPD Wiki 本地 MCP 开发门禁补充决策 v0.7

| 项目 | 内容 |
|---|---|
| 状态 | `WEB-FIRST PLAN BASELINE / EXECUTION NOT AUTHORIZED` |
| 日期 | 2026-07-23 |
| 基础设计 | `sapd-wiki-local-mcp-requirements-and-prd-v0.5.md` |
| 历史补充 | `sapd-wiki-local-mcp-development-gate-addendum-v0.6.md` |
| 现行计划 | `local-mcp-web-first-development-and-client-validation-plan-v0.2.md` |
| 影响范围 | 后续开发、验证与打包顺序；不修改协议、数据或安全边界 |

## 1. 决策

用户确认本地 MCP 后续采用 Web 优先顺序：

1. 先在稳定 5173 Web 开发环境完成真实 Sidecar、HTTPS、OAuth、授权确认、MCP Tool 和页面状态闭环；
2. Web 自有客户端端到端通过后，再单独授权当前电脑、当前 Codex 的真实连接；
3. 当前 Codex 通过后，才规划 macOS/Windows 生产运行时适配；
4. 桌面运行时通过后，才进行 DMG/Windows 安装包构建；
5. 实包可用后再做多入口、多版本、双平台兼容矩阵；
6. D0、真实内容和发布继续独立授权。

## 2. 对既有状态的校准

v0.1 的批次 A 保留为 synthetic-only 历史基线。其 D5/D6 PASS 表示接口、Supervisor、Bridge、模拟器和 fail-closed 平台边界通过，不表示：

- 5173 已控制真实 Sidecar；
- 当前 Codex 已连接；
- macOS Keychain 或 Windows 安全存储已生产接线；
- CurrentUser 系统信任已实现或修改；
- macOS/Windows App 已可运行 MCP；
- DMG/Windows 安装包已包含 MCP。

后续不得再使用“产品开发完成”描述上述状态；应使用“synthetic 基线通过，Web 真实闭环待开发”。

## 3. 不变边界

- MCP 只绑定 loopback；
- Web 页面不持有 Token、私钥或解密口令；
- OAuth 使用 Authorization Code + PKCE S256；
- 客户端兼容不得降低 TLS、resource/audience、Host/Origin 或数据策略；
- 批次 B 只使用 synthetic fixture 和隔离测试状态；
- 真实 Codex 配置、OAuth 凭据和系统信任属于后续 C1 单独授权；
- D0-Release 继续阻塞真实摘要接入和发布；
- 用户库和用户内容始终不进入 MCP；
- push、PR、merge、packaging 和发布不由本计划升级自动授权。

## 4. OIDC

本地 OAuth Authorization Server 是 Codex MCP 的必需认证能力。完整 OIDC 是可选本地身份层：

- 如启用，Issuer 只使用 `https://127.0.0.1:{configured_port}`；
- 不依赖第三方身份服务器；
- OIDC ID Token 不得代替 MCP Access Token；
- 是否启用完整 OIDC 在 Web 批次 B2 checkpoint 冻结，不阻塞 OAuth Web 闭环。

## 5. 授权解释

用户本次“升级优化计划”授权 v0.2 计划和本补充决策文档，不授权执行批次 B。

下一可申请授权范围为：

```text
B0 → B1 → B2 → B3 → B4 → B5
```

该范围不包含真实 Codex 配置、系统信任、桌面生产适配、打包、真实/用户数据、D0 或 push。
