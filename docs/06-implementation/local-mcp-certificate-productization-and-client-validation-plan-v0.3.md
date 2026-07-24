# SAPD Wiki 本地 MCP：稳定证书产品化与客户端验证计划 v0.3

| 项目 | 内容 |
|---|---|
| 状态 | `DESIGN FROZEN / IMPLEMENTATION NOT AUTHORIZED` |
| 日期 | 2026-07-23 |
| 上游计划 | `local-mcp-web-first-development-and-client-validation-plan-v0.2.md` |
| 设计基线 | `sapd-wiki-local-mcp-certificate-and-trust-management-design-v1.md` |
| 当前事实 | B0–B5 Web 协议闭环已 PASS；当前实现仍使用每次启动临时 CA |
| 顺序调整 | 在真实 Codex C1 前新增稳定证书产品化 C0 |
| 数据边界 | C0/C1 仍只允许 synthetic fixture，不接入正式数据或用户数据 |

> 本计划只修正 B5 之后的执行顺序。它不重新执行 B0–B5，不授权系统信任写入、Codex 配置、App 打包、真实数据、push 或发布。

---

## 1. 调整结论

原 v0.2 计划在 B5 后直接进入 C1，并允许临时 CurrentUser 信任用于当前 Codex 验证。用户现已确认：真实客户端验证必须建立在与 macOS/Windows 产品一致的稳定证书生命周期上。

因此新顺序为：

```text
B5 Web 协议闭环 PASS
→ C0 稳定证书产品化
→ C1 当前 Codex 真实连接
→ D1 macOS 生产适配
→ D2 Windows 生产适配
→ E1/E2 双平台打包
→ F 客户端兼容矩阵
```

当前每次启动临时生成、停止即删除的 `SAPD Wiki Web Dev CA` 继续作为自动化测试证据，不再作为人工 C1 或最终产品体验。

---

## 2. C0 工作包

### C0-1：证书合同与状态 Schema

交付：

- `certificate` 只读状态投影；
- 生成、更新、修复、重置动作合同；
- `not_configured / valid / expiring / renewal_required / expired / trust_missing / key_unavailable / rotating / error` 状态；
- 有效期、剩余天数、CurrentUser 范围、指纹和脱敏存储后端；
- 私钥路径、口令和 secret reference 禁止进入 API/前端。

完成标准：

- JSON Schema 与正负样本通过；
- 状态和恢复动作一一对应；
- 控制面并发版本、幂等和审计合同冻结。

### C0-2：共享证书管理核心

交付：

- 每用户、每安装实例、每 profile 独立 CA；
- CA 签发服务器证书后删除 CA 私钥；
- `127.0.0.1` SAN；
- 365 天服务器证书；
- 加密 PKCS#8 服务器私钥；
- 固定安全目录和当前用户最小权限；
- 指纹、有效期、安装 ID 和轮换元数据。

完成标准：

- App/MCP 重启、端口修改和普通升级后指纹不变；
- 不同用户/安装/profile 指纹不同；
- CA 私钥不持久化；
- 未加密私钥、口令环境变量、命令行和日志为 0。

### C0-3：Web Dev CurrentUser 信任适配

交付：

- 人工 Web Dev 使用稳定 Dev CA；
- 首次信任、拒绝、修复、更新和删除；
- 前后信任快照；
- 精确按 SHA-256 指纹清理；
- 自动化测试继续使用隔离 CA，不写系统信任。

完成标准：

- 当次用户明确授权后才写 CurrentUser；
- 拒绝时 MCP fail closed、5173 主页面继续可用；
- 修复不无故更换证书；
- 更新失败可回滚旧身份；
- 重置后旧信任和秘密无残留。

### C0-4：AI 功能集成与顶部状态

交付：

- “安全连接证书”设置区；
- 首次启用“建立本机安全连接”确认；
- 有效期、剩余天数、CurrentUser 范围、只读存储位置；
- 更新证书、修复安全连接、查看详情；
- 重置影响预览与重新初始化；
- 顶部状态浮层的证书到期信息和直达入口。

完成标准：

- 不展示 DN、口令或路径配置表单；
- 60/30/7/0 天文案和状态准确；
- hover、focus、键盘、窄屏、200% 缩放可用；
- 与现有 Apple shell、低噪声状态和非卡片墙基线一致。

### C0-5：生命周期验收

至少验证：

1. 首次生成和用户拒绝；
2. App/MCP 多次重启；
3. 修改端口；
4. CurrentUser 信任被手工删除后修复；
5. 60/30/7/0 天阈值；
6. 更新成功；
7. 更新中断与回滚；
8. 重置并重新初始化；
9. 卸载前重置；
10. synthetic 数据和用户库边界不变。

---

## 3. C1 调整后的真实连接门禁

C1 不再临时信任一次性 CA。它必须使用 C0 生成的稳定 Dev 身份，并验证：

- Codex 重启后仍可连接；
- MCP 重启和端口变化后的证书行为符合合同；
- OAuth、五项 Tool、撤销和重新授权通过；
- 设置页、顶部状态和实际证书指纹一致；
- C1 结束后由用户选择保留稳定 Dev 信任，或执行“重置 AI 集成”完整清理。

C1 仍需单独授权当前 Codex 配置、OAuth 凭据和 CurrentUser 信任写入。

---

## 4. D1/D2 平台适配

### D1 macOS

- 复用 C0 证书核心和状态合同；
- Security Framework / 登录钥匙串 CurrentUser 信任；
- Keychain 口令；
- 原生确认、修复、更新、重置和残留检查；
- 普通 App 更新不得更换证书。

### D2 Windows

- 复用 C0 证书核心和状态合同；
- CurrentUser Root 证书存储；
- DPAPI CurrentUser 口令；
- Electron 主进程最小权限 Bridge；
- 修复、更新、重置和残留检查；
- 普通 App 更新不得更换证书。

平台 API 可以不同，用户文案、状态、动作、证书 profile 和验收结果必须一致。

---

## 5. 实施授权边界

若后续用户批准 C0，允许范围应逐项写明：

- 是否允许 macOS 当前用户信任写入；
- 是否允许 Keychain 开发 profile secret；
- 目标固定安全目录；
- 证书/信任/秘密的前置快照；
- 测试结束保留或清理方式；
- 独立 worktree 和本地阶段提交。

默认不允许：

- 系统级或 LocalMachine 信任；
- 写入真实 Codex 配置；
- Windows 实机状态；
- App/DMG/Windows 安装包；
- 真实数据、用户数据、D0；
- push、PR、merge 或发布。

---

## 6. 下一确认点

建议下一授权只覆盖：

```text
C0-1 → C0-2 → C0-4
```

这三项可先完成合同、稳定证书核心和 UI，不写真实系统信任。`C0-3` CurrentUser 信任实验应在前置快照和清理方案明确后单独批准；C1 继续后置。
