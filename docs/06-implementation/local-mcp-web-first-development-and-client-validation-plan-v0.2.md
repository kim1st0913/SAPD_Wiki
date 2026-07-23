# SAPD Wiki 本地 MCP：Web 优先开发与客户端验证计划 v0.2

| 项目 | 内容 |
|---|---|
| 状态 | `BATCH B PASS / AWAITING C1 AUTHORIZATION` |
| 日期 | 2026-07-23 |
| 取代计划 | `local-mcp-product-development-and-client-validation-plan-v0.1.md` 的后续执行顺序 |
| 设计基线 | `sapd-wiki-local-mcp-requirements-and-prd-v0.5.md` |
| 门禁补充 | `sapd-wiki-local-mcp-development-gate-addendum-v0.7.md` |
| 当前基线 | 批次 B Web 真实闭环通过；当前 Codex 真实连接尚未验证 |
| 新执行顺序 | `Web 真实闭环 → 当前 Codex 本机验证 → 桌面运行时开发 → 双平台打包 → 客户端兼容 → 内容与发布` |
| 稳定 Web 入口 | `http://127.0.0.1:5173/` |
| MCP 目标地址 | `https://127.0.0.1:{configured_port}/mcp` |
| 数据边界 | Web 开发和客户端技术验证只使用 synthetic fixture；真实内容另走 D0 门禁 |
| 远程边界 | 不授权 push、PR、merge 或发布 |

> 本文件记录用户确认的“先在 Web 环境跑通，再考虑 Windows 和 macOS 打包”顺序。升级计划不等于授权执行。每个批次仍按本文件的授权边界单独确认。

---

## 1. 计划修正结论

v0.1 将双平台 Supervisor/Bridge 的接口、模拟器和 fail-closed 占位适配记为 D5 PASS，并把真实进程、Keychain/DPAPI、证书信任和真实客户端联调留到 L1。这不符合“先完成开发，再验证”的业务顺序，也会让“开发完成”被误解为“产品已经可以连接 Codex”。

v0.2 重新定义当前状态：

1. 已完成的是 synthetic-only 核心、协议栈、控制合同、Web 骨架和平台边界；
2. 尚未完成的是 5173 对真实 Sidecar 的控制、真实授权闭环和真实 Codex 连接；
3. macOS/Windows 的生产适配与打包全部后移，不阻塞 Web 跑通；
4. Web 跑通必须包含真实 HTTPS、OAuth、MCP initialize/tools/list/tools/call 和撤销，不以静态页面或内存状态机代替；
5. 真实内容、用户库和正式发布继续受 D0-Release 阻断。

v0.1 保留为批次 A 历史记录，不再作为后续执行顺序。

---

## 2. 业务目标

第一目标是在当前开发环境完成一个可用但只读取 synthetic 数据的本地 MCP：

1. 用户在 5173 的“系统设置 → AI 功能集成”启动真实 MCP；
2. 页面显示真实端口、TLS、OAuth、客户端授权和工具使用状态；
3. Codex 通过 `https://127.0.0.1:{port}/mcp` 完成认证；
4. Codex 可以发现并调用五项只读知识工具；
5. 用户可以在页面查看和撤销客户端；
6. 服务停止、端口变化、授权过期和异常都有可执行恢复动作；
7. 全程不读取正式数据、用户库或用户内容。

只有上述 Web 闭环通过后，才开始 macOS/Windows 产品化和打包。

---

## 3. 当前可复用基线

独立分支 `codex/local-mcp-product-development` 已提供：

- 正式只读知识查询核心与五项 Tool；
- Streamable HTTP 无状态协议栈；
- 本地 OAuth Authorization Server、PKCE、Token 轮换与撤销；
- TLS 身份和平台秘密存储接口；
- MCP 控制合同、状态、动作、诊断和 Web 安全投影；
- 旧版 AI 集成页面与 synthetic 控制；
- macOS/Windows Supervisor、Bridge、模拟器和自动化测试；
- T0–T2 `53/53` 及批次 A 各组回归证据。

这些实现可以复用，但以下内容不能被宣称为已完成：

- 当前 5173 新“系统设置”页面与独立分支真实控制面的集成；
- Web 后端真实启动和停止 Sidecar；
- 真实授权请求的允许/拒绝结果闭环；
- 当前 Codex 的真实注册、回调和 OAuth 凭据；
- macOS Keychain、Windows 安全存储和系统信任生产适配；
- macOS/Windows 安装包。

---

## 4. 总体阶段与授权批次

| 批次 | 阶段 | 目标 | 执行状态 |
|---|---|---|---|
| A | 既有 synthetic 基线 | 核心、协议、合同、Web 骨架和平台边界 | `PASS，历史基线` |
| B | `B0 → B1 → B2 → B3 → B4 → B5` | 完成 Web 真实开发闭环 | `PASS` |
| C | `C1` | 当前电脑、当前 Codex 真实连接验证 | `待 B5 PASS 后授权` |
| D | `D1 → D2` | macOS/Windows 生产运行时开发 | `待 C1 PASS 后规划` |
| E | `E1 → E2` | macOS/Windows 打包与实包验证 | `待 D 阶段 PASS 后规划` |
| F | `F1` | 多入口、多版本、双平台客户端矩阵 | `待实包可用后规划` |
| G | `G1` | D0、真实内容与发布 | `独立数据与发布授权` |

---

## 5. 批次 B：Web 真实闭环开发

### 5.1 B0：干净集成基线

#### 工作任务

1. 以 `codex/local-mcp-product-development` 为 MCP 代码来源；
2. 以当前 5173 shared frontend 的 `SystemSettings`、顶部状态浮层、统一返回逻辑和端口配置为 UI 权威；
3. 在新的独立集成 worktree 中只引入经过核对的最小文件；
4. 保留原 dirty checkout，不提交、stash、reset 或覆盖用户修改；
5. 冻结 Web Runtime、Sidecar、控制 API、前端 `dataClient` 的所有权；
6. 明确 dev-only 文件、状态库、证书和日志只能写入隔离目录。

#### 完成标准

- 没有并发 writer 或重叠文件所有权；
- 旧 `AiIntegrationSettings` 与新 `SystemSettings` 不形成两套产品页面；
- 5173 仍是唯一 Web 验收入口；
- 批次 A 回归可在新基线上运行。

### 5.2 B1：Web 后端真实 Sidecar 编排

#### 工作任务

1. 将正式只读 Core、Sidecar 和控制服务组合成 dev Runtime；
2. 由本地开发后端启动、停止、重试和观察 Sidecar 进程；
3. Sidecar 只绑定 `127.0.0.1`，禁止 `0.0.0.0` 和局域网地址；
4. 端口来自 AI 功能集成页的用户配置；
5. 实现端口占用、重复启动、进程退出、残留锁和崩溃恢复；
6. MCP 失败不得影响 5173 主 Web Runtime；
7. 只加载 synthetic SQLite/fixture，不导入 `BundleRuntime`，不打开用户库；
8. Web 的 synthetic 内存状态机保留为显式测试模式，不再冒充真实服务。

#### 完成标准

- 点击“启动 MCP”后确有独立 Sidecar 监听配置端口；
- 点击“停止 MCP”后端口和进程释放；
- 页面状态来自真实 Runtime 快照；
- Web 主站在 Sidecar 缺失、失败或停止时仍可使用；
- 正式数据与用户库访问均为 0。

### 5.3 B2：本地 HTTPS、OAuth 与可选 OIDC

#### 必做 OAuth

1. 提供 Protected Resource Metadata；
2. 提供 Authorization Server Metadata；
3. 实现 Authorization Code + PKCE S256；
4. 实现 `resource`、audience、scope、redirect URI 和 Host/Origin 精确校验；
5. 实现预注册、CIMD、DCR 的兼容优先级；
6. 实现短期 opaque Access Token、Refresh Token 轮换、reuse detection；
7. 实现单客户端、单 grant 和全部客户端撤销；
8. Token、私钥和解密口令不得进入 URL、Cookie、设置、环境变量或日志；
9. 授权和控制状态存入独立控制库，不接触用户库。

#### Web 开发 TLS

1. 使用只包含 loopback 身份的测试证书；
2. 私钥必须是加密 PKCS#8；
3. 开发口令保存在隔离秘密提供器中，不进入 Git；
4. B 阶段测试客户端显式信任测试 CA，不修改系统信任；
5. 证书和临时控制状态在测试结束后可清理。

#### OIDC 决策

Codex MCP 的必需认证是 OAuth，不要求 OIDC ID Token。若产品需要本地身份层，则只实现本地 OIDC，不接入第三方服务器：

```text
issuer = https://127.0.0.1:{configured_port}
GET /.well-known/openid-configuration
scope = openid
```

本地 OIDC 还需稳定 opaque `sub`、ID Token 签名、nonce、issuer、audience 和 key rotation。OIDC ID Token 不能代替 MCP Access Token，也不能作为 `/mcp` 的 Bearer Token。

是否启用完整 OIDC 在 B2 checkpoint 冻结；默认不阻塞 OAuth/Codex Web 闭环。

#### 完成标准

- 自有测试客户端可发现本地授权服务并完成 PKCE；
- 错误 callback、resource、scope、PKCE、Host 和 Origin 全部拒绝；
- Token 刷新、重放检测和撤销生效；
- 不需要第三方身份或网络服务；
- 没有系统信任写入。

### 5.4 B3：真实授权确认与 Web 页面接线

#### 工作任务

1. 5173 当前“AI 功能集成”页面接入真实控制 API；
2. 服务状态、端口、地址、客户端和审计不再来自模拟列表；
3. 授权请求展示客户端名称、client ID、redirect URI、scope、resource 和数据策略版本；
4. 提供“允许”“拒绝”，默认两分钟超时；
5. 多个授权请求排队，不覆盖前一请求；
6. 允许结果进入 OAuth code 交换，拒绝/关闭/超时返回明确错误；
7. 客户端列表显示授权时间、最近使用、scope、策略版本和信任状态；
8. 撤销操作立即失效并刷新页面和顶部状态浮层；
9. 增加“复制 MCP 地址”“复制 Codex 配置”“检查服务”；
10. License 只决定功能是否可启用，不作为 Agent 凭据；
11. 端口变化停止服务、撤销旧 grant，并提示更新 Codex URL。

#### 完成标准

- 页面上的所有 MCP 状态均能追溯到真实 Runtime；
- 授权允许、拒绝、超时、撤销形成完整闭环；
- 页面不持有 OAuth Token、私钥或口令；
- 鼠标、键盘、刷新、路由恢复和窄屏均可用；
- 不存在第二套独立设置页或 5187 验收入口。

### 5.5 B4：Web 自有客户端端到端验证

#### 工作任务

使用工程自有测试客户端，不修改真实 Codex 配置：

1. 启动真实 Sidecar；
2. 读取 OAuth/MCP discovery；
3. 完成注册、授权、PKCE 和 Token 交换；
4. 完成 `initialize` 和 `tools/list`；
5. 调用五项只读 Tool；
6. 验证 Refresh Token 轮换和 reuse detection；
7. 验证拒绝、超时、撤销和重新授权；
8. 验证停止、重启、端口冲突和端口变化；
9. 验证 UI、控制 API、审计和实际协议状态一致；
10. 验证查询只返回 synthetic 数据。

#### 完成标准

- 一条自动化 E2E 覆盖“启动 → 授权 → 调用 → 撤销 → 停止”；
- 五项 Tool 结果符合合同；
- 撤销后旧 Token 立即失败；
- 所有失败都有页面可执行恢复动作；
- 真实 Codex 配置、系统信任、用户库和正式数据修改均为 0。

### 5.6 B5：Web 开发完成门禁

只有以下条件全部满足，才可申请 C1：

1. 5173 能启动和停止真实 MCP；
2. `https://127.0.0.1:{port}/mcp` 提供真实协议；
3. OAuth 授权、刷新和撤销通过；
4. `initialize`、`tools/list` 和五项 `tools/call` 通过；
5. AI 功能集成页和顶部状态与真实 Runtime 一致；
6. 端口修改、异常恢复和重置通过；
7. Web 宽/窄视口、键盘和刷新验收通过；
8. 主 Web Runtime 不依赖 MCP 成功启动；
9. 用户库、真实数据、系统信任、真实客户端配置和 packaging 写入均为 0；
10. 形成“Web 真实闭环 PASS / 当前 Codex 尚未验证”的报告。

---

## 6. 批次 C：当前电脑、当前 Codex 验证

### 6.1 前置授权

C1 会修改用户当前 Codex 配置、OAuth 凭据，并可能写入 CurrentUser 证书信任。执行前必须再次确认：

- 目标客户端与确切版本；
- 允许修改的 Codex 配置；
- 是否允许 CurrentUser 信任写入；
- 配置、证书和凭据的前置快照；
- 结束后恢复、保留或由用户选择的处理方式。

### 6.2 验证任务

1. 在 Codex 中配置 Streamable HTTP：

   ```text
   名称：SAPD Wiki
   URL：https://127.0.0.1:{configured_port}/mcp
   Bearer Token：留空
   Headers：留空
   ```

2. 完成 Authenticate / `codex mcp login sapd_wiki`；
3. 验证真实 callback 临时端口和 PKCE；
4. 验证 `initialize`、`tools/list`、五项 Tool；
5. 验证授权拒绝、超时、撤销和重新授权；
6. 验证页面客户端信息、最近使用和审计；
7. 验证停止、重启、Codex 重启和端口变化；
8. 核对配置、信任和凭据的最终保留/恢复结果；
9. 修复问题后重新通过 B5。

### 6.3 完成标准

- 用户当前 Codex 可以稳定使用 synthetic-only SAPD MCP；
- UI 和实际连接状态一致；
- 没有 insecure fallback；
- 变更和恢复记录完整；
- 真实内容和用户库仍未接入。

---

## 7. 批次 D：桌面运行时开发

C1 PASS 后才规划和授权，不与 Web 闭环并行。

### 7.1 D1 macOS

- App Supervisor 真实启动和停止 Sidecar；
- Keychain 秘密存储；
- CurrentUser 证书信任生命周期；
- 原生授权确认窗口；
- 菜单栏状态、窗口恢复和退出清理；
- 多实例、崩溃、升级和重置；
- WebView 与 5173 使用同一状态合同。

### 7.2 D2 Windows

- Electron 主进程管理 Sidecar；
- CurrentUser 范围安全存储和证书信任；
- 授权确认窗口；
- 进程退出、残留锁和多实例；
- renderer 最小权限桥；
- 真实 Windows 环境验证，不能以 macOS 模拟替代。

---

## 8. 批次 E：双平台打包

桌面运行时开发通过后才开始：

### E1 macOS

- App bundle 资源与 Sidecar 收集；
- 签名、entitlements、安装、升级、回滚和卸载；
- DMG 构建与实包运行；
- 证书、Keychain、配置和进程残留检查。

### E2 Windows

- Electron/Sidecar 安装包；
- CurrentUser 证书和安全存储；
- 安装、升级、回滚和卸载；
- Windows 实机包验证；
- 配置、证书、凭据和进程残留检查。

打包不得早于 B5 和 C1，也不得以打包结果代替 Web 协议验收。

---

## 9. 批次 F：客户端兼容矩阵

在 Web、macOS 和 Windows 可用后，验证：

- Codex Desktop、Codex CLI、Codex IDE；
- 当前 stable、上一 stable、preview/dev；
- macOS 当前支持版本、Windows 当前支持版本；
- 首次安装、升级、回滚、自定义端口和多版本并存；
- OAuth 注册、callback、refresh、撤销和工具调用；
- 支持、有条件支持和不支持结论。

客户端兼容失败不得通过 HTTP、固定长期 Token、放宽 PKCE/resource/audience/Host/Origin 或扩大数据范围解决。

---

## 10. 批次 G：内容与发布

单独授权：

1. D0-Pilot 代表性候选摘要；
2. D0-Release 审核、hash、签名 manifest 和可重复构建；
3. 真实公开摘要接入；
4. 正式安装包、签名、公证、隐私说明和用户验收。

D0-Release 通过前：

- MCP 只返回 synthetic fixture；
- 不读取、复制或迁移用户库；
- 不把 synthetic 内容宣称为正式知识；
- 不制作对外发布包。

---

## 11. 建议下一授权

下一次只建议授权批次 B：

```text
B0 → B1 → B2 → B3 → B4 → B5
```

允许：

- 独立 worktree；
- Web、MCP Core、Sidecar、控制 API 和前端接线；
- synthetic fixture；
- 隔离测试证书、控制库和测试客户端；
- 自动化测试和本地阶段提交。

不允许：

- 修改真实 Codex 配置或 OAuth 凭据；
- 写入系统信任、Keychain 或 DPAPI 正式状态；
- macOS/Windows 生产适配与打包；
- 真实数据、用户数据、D0；
- push、PR、merge 或发布。

批次 B 完成后必须停止并提交 B5 报告，等待用户决定是否授权 C1。

---

## 12. 停止条件

出现以下任一情况立即停止，不自动扩大范围：

- Web 闭环必须依赖 macOS/Windows 打包才能运行；
- 必须使用 HTTP、明文私钥、固定长期 Token 或静态 Bearer Token；
- 必须访问或创建用户库；
- 必须接入真实内容才能完成协议测试；
- Web 页面必须持有 Token、私钥或口令；
- 当前 dirty checkout 与目标文件无法安全隔离；
- 必须修改真实 Codex 配置或系统信任才能完成批次 B；
- 客户端只能通过降低 OAuth/TLS/Host/Origin/数据策略连接；
- 需要 push、打包或发布才能继续。

---

## 13. 用户确认点

用户已确认计划顺序：

> 先在 Web 环境跑通，然后才考虑 Windows 和 macOS 的打包。

用户随后明确回复：

> 确认按 v0.2 执行批次 B（B0–B5）。

该确认授权本计划第 11 节列明的批次 B 范围；不授权真实 Codex 配置、系统信任、桌面生产适配、packaging、D0、真实/用户数据或 push。
