# SAPD Wiki 本地 MCP：稳定证书产品化与客户端验证计划 v0.4

| 项目 | 内容 |
|---|---|
| 状态 | `C0/C1 WEB COMPLETE / D1–F PENDING / G PLANNED` |
| 日期 | 2026-07-26 |
| 上游计划 | `local-mcp-web-first-development-and-client-validation-plan-v0.2.md` |
| 设计基线 | `sapd-wiki-local-mcp-certificate-and-trust-management-design-v1.md`（内容版本 v1.1） |
| 当前事实 | B0–B5、稳定证书 C0 与当前 Codex C1 Web 闭环已 PASS；Windows、App Runtime、DMG 与目标客户端矩阵待验收 |
| 顺序调整 | 在真实 Codex C1 前新增稳定证书产品化 C0 |
| 数据边界 | 正式基础知识库只读访问已获批；用户库、源文件、本机路径、写工具和非受控 SQL 继续排除 |

> 本计划最初用于修正 B5 之后的执行顺序；截至 2026-07-26，C0 与当前 Codex C1 Web 闭环已经完成。后续 D1–F 仍需按平台范围单独授权。本次新增的 G 只登记未来协议升级门禁，不授权依赖升级、App 修改、系统信任写入、打包、push 或发布。

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
→ G MCP 2026-07-28 双时代协议升级（触发式）
```

当前每次启动临时生成、停止即删除的 `SAPD Wiki Web Dev CA` 继续作为自动化测试证据，不再作为人工 C1 或最终产品体验。

---

## 2. C0 工作包

### C0-1：证书、所有权清单与操作 Schema

交付：

- `certificate` 只读状态投影；
- 版本化 identity manifest 和 `install_id / profile / generation_id` 合同；
- prepare/confirm/operation 的生成、更新、修复、恢复、清理和重置动作合同；
- `not_configured / valid / expiring / renewal_required / expired / trust_missing / trust_conflict / key_unavailable / clock_invalid / rotating / recovery_required / error` 状态；
- 有效期、剩余天数、CurrentUser 范围、CA/leaf 指纹、受限信任策略、当前操作和清理标志；
- 私钥路径、口令和 secret reference 禁止进入 API/前端。

完成标准：

- JSON Schema 与正负样本通过；
- 状态、reason code 和恢复动作一一对应；
- Schema 版本过高、清单损坏、generation 不一致时 fail closed；
- 控制面并发版本、幂等、operation journal 和审计合同冻结。

### C0-2：共享证书生成与固定目录安全核心

交付：

- 每用户、每安装实例、每 profile 独立 CA；
- CA 签发服务器证书后删除 CA 私钥；
- `127.0.0.1` SAN；
- `pathLen:0`、最小 KeyUsage、serverAuth、SKI/AKI、完整 chain 和候选 loopback nameConstraints；
- 400 天 CA、365 天服务器证书和 35 天链覆盖余量；
- 加密 PKCS#8 服务器私钥；
- 固定安全目录、当前用户最小权限和同卷原子 generation 切换；
- symlink/hardlink/junction/reparse point、宽 ACL、跨卷覆盖和明文私钥阻断；
- 指纹、有效期、安装 ID 和轮换元数据。

完成标准：

- App/MCP 重启、端口修改和普通升级后指纹不变；
- 不同用户/安装/profile 指纹不同；
- CA 私钥不持久化；
- 未加密私钥、口令环境变量、命令行和日志为 0；
- Codex/macOS/Windows 对证书算法、chain 和 nameConstraints 的兼容结论已记录，不能静默放宽。

### C0-3：秘密保管与安全 Sidecar 传递

交付：

- macOS Data Protection Keychain 非同步 ThisDeviceOnly 适配；
- Windows DPAPI CurrentUser blob 与最小 DACL 适配；
- install/profile/generation 绑定的秘密别名和设备一致性检查；
- 父进程创建的一次性匿名管道/继承句柄或等价安全通道；
- 同用户、预期进程、nonce、generation、最小 ACL 和一次读取证明。

完成标准：

- 口令不经 argv、环境变量、普通文件、剪贴板、日志或未认证 socket；
- `KEY_PASSPHRASE_IPC_UNSAFE` 的跨用户、错误进程、错误 generation、宽 ACL、重复读取负向用例全部 `BLOCKED`；
- macOS Keychain 不同步迁移，Windows 不使用 `CRYPTPROTECT_LOCAL_MACHINE`；
- Sidecar 只能消费身份，不能生成长期证书或修改系统信任。

### C0-4：Web Dev CurrentUser 信任适配

交付：

- 人工 Web Dev 使用稳定 Dev CA；
- 首次信任、拒绝、修复、更新和删除；
- macOS User trust 的受限 SSL trust settings，禁止 `NULL` always-trust；
- Windows `CurrentUser\Root` 适配合同，禁止 `LocalMachine`；
- 前后信任快照；
- 精确按 SHA-256 指纹清理；
- 同名不同指纹冲突识别，不自动接管或删除；
- 自动化测试继续使用隔离 CA，不写系统信任。

完成标准：

- 当次用户明确授权后才写 CurrentUser；
- 拒绝时 MCP fail closed、5173 主页面继续可用；
- 修复不无故更换证书；
- 受限 trust policy 与完整指纹验证通过；
- 当前用户之外的证书库前后不变；
- 系统信任写入实验仍需当次单独授权和可恢复快照。

### C0-5：事务轮换、恢复、升级与卸载

交付：

- `planned → staged → new_trust_installed → switched → validated → retiring → completed` operation journal；
- active generation 原子指针、profile 独占锁和第二实例只读模式；
- 每个中断阶段的恢复/回滚；
- 旧 generation 最长 24 小时回滚窗口与幂等清理；
- 升级/降级、备份恢复、设备迁移、重装冲突和卸载残留合同。

完成标准：

- 强杀、重启、磁盘写满、秘密不可用、信任取消和清理失败均不会产生两个 active 身份；
- 新身份验证前不删除旧身份，旧过期身份不恢复服务；
- 普通升级不换证，旧版本不理解 Schema 时不覆盖身份；
- 重置后旧信任、秘密、generation 和 OAuth grant 无残留；
- macOS 直接删除 App、Windows 非当前用户卸载的残留风险和人工指纹清理说明可执行。

### C0-6：AI 功能集成与顶部状态

交付：

- “安全连接证书”设置区；
- 首次启用“建立本机安全连接”确认；
- 有效期、剩余天数、CurrentUser 范围、只读存储位置；
- 更新证书、修复安全连接、查看详情；
- 重置影响预览与重新初始化；
- 同名冲突、系统时间异常、秘密不可用和恢复待处理的独立文案；
- 应用签名/MCP 证书/OAuth/License 的概念分离；
- 顶部状态浮层的证书到期信息和直达入口。

完成标准：

- 不展示 DN、口令或路径配置表单；
- 60/30/7/0 天文案和状态准确；
- hover、focus、键盘、aria-live、窄屏、200% 缩放可用；
- 页面存在独立证书区，不把启动失败提示当作证书管理；
- 与现有 Apple shell、低噪声状态和非卡片墙基线一致。

### C0-7：生命周期自动化与人工验收

至少验证：

1. 首次生成和用户拒绝；
2. App/MCP 多次重启；
3. 修改端口；
4. CurrentUser 信任被手工删除后修复；
5. 60/30/7/0 天阈值；
6. 系统唤醒、时间变化和运行中证书/信任失效；
7. 更新成功；
8. 更新中断与回滚；
9. 重置并重新初始化；
10. 同名不同指纹、系统时间异常和秘密丢失；
11. 同 profile 双实例、升级、降级、备份恢复和设备迁移；
12. 卸载前重置、直接删除 App 和重装残留；
13. Sidecar 秘密传递负向矩阵；
14. CurrentUser/LocalMachine 前后信任快照；
15. synthetic 数据和用户库边界不变。

---

## 3. C1 调整后的真实连接门禁

状态：`PASS（Web/macOS 当前开发环境）`。Windows、App Runtime、DMG 和目标客户端版本矩阵仍属于 D1–F。

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
- Security Framework / `kSecTrustSettingsDomainUser` 的受限 SSL 信任；
- Data Protection Keychain、非同步 ThisDeviceOnly 口令；
- GUI 登录会话和系统身份验证取消/失败处理；
- 原生确认、修复、更新、重置和残留检查；
- DMG 拖入废纸篓不能自动清理信任的用户提示和人工清理；
- 普通 App 更新不得更换证书。

### D2 Windows

- 复用 C0 证书核心和状态合同；
- CurrentUser Root 证书存储；
- DPAPI CurrentUser 口令；
- Electron 主进程最小权限 Bridge；
- Renderer 无证书库、DPAPI、文件路径和任意 shell 能力；
- 修复、更新、重置和残留检查；
- 当前用户卸载清理与其他用户残留边界；
- 普通 App 更新不得更换证书。

平台 API 可以不同，用户文案、状态、动作、证书 profile 和验收结果必须一致。

---

## 5. G：MCP 2026-07-28 双时代协议升级（触发式）

### 5.1 当前决策

- 当前生产 canonical 版本继续使用官方最新稳定版 `2025-11-25`；
- 服务端继续接受当前 MCP SDK 声明支持的正式协议版本，未知版本仍 fail closed；
- `2026-07-28` 当前只作为 Modern 协议候选进入计划，不因 Draft 文档存在而提前切换生产 canonical 版本；
- 升级目标不是删除旧版本，而是在过渡期同时支持 Legacy `2025-11-25` 与 Modern `2026-07-28`，保证现有已验证客户端可继续使用。

### 5.2 启动条件

只有以下条件全部满足，才允许创建 G 阶段执行计划：

1. MCP 官方将 `2026-07-28` 发布为稳定规范，而非 Draft；
2. 项目采用的 Python MCP SDK 正式声明支持该版本，并完成依赖、安全公告和破坏性变更评估；
3. 当前 Codex / ChatGPT Desktop 目标版本及至少一个第三方 MCP 客户端具备可验证的 Modern 协议支持；
4. C1、目标客户端版本矩阵及 macOS / Windows App Runtime 基础验收已经形成可回归基线；
5. 用户单独确认升级实施范围；本计划登记不自动授权依赖升级、App 修改、系统信任写入、打包或发布。

任一条件不满足时，G 阶段状态保持 `PLANNED / NOT STARTED`，不得用 Draft 字段改写当前正式协议合同。

### 5.3 开发范围

- 建立 Legacy / Modern 双时代版本协商与确定性回退；
- 按正式规范实现 Modern 时代的发现、请求级元数据、必需请求头和无状态交互合同；
- 保留现有 OAuth、PKCE、resource/audience、TLS、只读 scope、五工具和审计边界；
- 对协议版本、发现结果、请求元数据和授权资源进行组合校验，未知或不一致请求继续 fail closed；
- 将协议能力作为 Runtime 状态展示，不要求普通用户人工选择协议版本；
- 不扩大到用户数据库、源文件、本机路径、客户端 SQL、写工具或第三方云身份服务。

### 5.4 验收矩阵

1. 现有 Legacy Codex 五工具、刷新、撤销和自动恢复回归继续通过；
2. Modern 客户端完成发现、授权、五工具、刷新、撤销和重连；
3. Legacy 客户端不能因 Modern 支持而被迫升级；
4. Draft、未知版本、缺失必需头、错误请求元数据、错误 resource/audience 和跨时代混用全部被明确拒绝；
5. macOS、Windows、Web 开发环境与 App Runtime 使用同一协议能力合同；
6. 升级前后基础库、用户库和五工具数据边界不变；
7. 记录兼容客户端版本、SDK 版本、规范版本和回退结果，形成可重复自动化回归。

### 5.5 退出条件

只有 Legacy 与 Modern 两套正向矩阵、负向协议矩阵、OAuth/TLS、安全边界和双平台回归全部通过，才可把 Modern 版本列为默认 canonical 候选。是否正式切换 canonical 版本必须另行评审；在旧目标客户端仍受支持期间，不得仅因新规范发布删除 Legacy 路径。

参考：

- [MCP 2025-11-25 稳定规范](https://modelcontextprotocol.io/specification/2025-11-25)
- [MCP 协议版本生命周期](https://modelcontextprotocol.io/specification/2025-11-25/basic/lifecycle)
- [MCP Draft 版本与 Dual-era 说明](https://modelcontextprotocol.io/specification/draft/basic/versioning)

---

## 6. 实施授权边界

若后续用户批准 C0，允许范围应逐项写明：

- 是否允许 macOS 当前用户信任写入；
- 是否允许 Keychain/DPAPI 开发 profile secret；
- 目标固定安全目录；
- 证书/信任/秘密的前置快照；
- 受限 trust policy、目标 profile、完整 CA 指纹和回滚 generation；
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

## 7. 下一确认点

当前下一执行顺序为：

```text
D1 macOS App Runtime
→ D2 Windows Runtime
→ E1/E2 双平台打包
→ F 目标客户端版本矩阵
```

建议下一授权先覆盖 D1 的 App Runtime 接线与 macOS 安装态验证；D2、打包和跨客户端矩阵继续逐批确认。G 阶段不属于当前下一批，只有第 5.2 节全部触发条件满足后才进入单独计划与授权。
