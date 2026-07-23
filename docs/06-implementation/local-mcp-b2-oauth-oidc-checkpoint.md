# 本地 MCP 批次 B2：OAuth / OIDC 决策检查点

| 项目 | 结论 |
| --- | --- |
| 日期 | 2026-07-23 |
| 状态 | PASS |
| MCP 必需认证 | 本机 OAuth 2.1 风格 Authorization Code + PKCE S256 |
| OIDC 决策 | 本批次不启用 |
| 第三方身份服务 | 不需要、不配置 |

## 决策

当前 Codex 连接本地 MCP 所需的是 OAuth Access Token，不需要 OIDC ID Token。批次 B 已在同一 loopback HTTPS 服务内提供 Protected Resource Metadata、Authorization Server Metadata、PKCE、opaque Access Token、Refresh Token 轮换、reuse detection、撤销和精确的 Host / Origin / resource / scope / redirect URI 校验。

因此本阶段不增加完整 OIDC。这样可以避免在没有业务身份需求时引入 `openid` scope、`sub`、ID Token 签名、nonce、JWKS 和 key rotation 等第二套身份合同。该决定不降低 MCP 认证强度，也不依赖第三方服务器或外部网络。

如果后续产品确实需要“本地用户身份”而不仅是“客户端授权”，OIDC 只能作为同源本地可选层：

```text
issuer = https://127.0.0.1:{configured_port}
GET /.well-known/openid-configuration
scope = openid
```

即使未来启用，OIDC ID Token 也只表达本地身份，不能替代访问 `/mcp` 的 OAuth Access Token。

## 已冻结的 B2 合同

- 客户端注册优先级：预注册 → CIMD → DCR；
- DCR 客户端默认显示为“未验证”，并受速率限制；
- loopback callback 只允许 `127.0.0.1` / `::1` 的临时端口例外；
- 测试 TLS 只包含 loopback 身份，私钥为加密 PKCS#8；
- 测试客户端显式信任隔离 CA，不修改系统信任；
- Token、私钥、解密口令不进入 URL、Cookie、前端设置、环境变量或日志；
- 授权超时与用户拒绝是两个不同的失败结果，均 fail closed；
- 授权和审计只写独立控制库，不访问用户库。

## 后续边界

完整 OIDC、当前 Codex 的真实配置、系统信任、Keychain / DPAPI、桌面生产接线和安装包均不属于批次 B。若后续需要 OIDC，必须先补充明确的业务身份场景和独立授权。
