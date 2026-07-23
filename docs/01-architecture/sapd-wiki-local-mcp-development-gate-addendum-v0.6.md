# SAPD Wiki 本地 MCP 开发门禁补充决策 v0.6

| 项目 | 内容 |
|---|---|
| 状态 | `APPROVED FOR BATCH A` |
| 日期 | 2026-07-23 |
| 基础设计 | `sapd-wiki-local-mcp-requirements-and-prd-v0.5.md` |
| 执行计划 | `local-mcp-product-development-and-client-validation-plan-v0.1.md` |
| 影响范围 | 开发准入顺序；不修改数据开放、安全边界或发布门禁 |

## 1. 决策

本补充决策只替换 v0.5 中“M1 正式开发必须等待 M0-T 总体 PASS 和 D0-Pilot PASS”的阶段顺序。

新的执行顺序为：

1. 以已完成的 T0–T2 合同、synthetic fixture、只读 Runtime probe 和协议 harness 作为 synthetic-only 正式功能开发的准入条件；
2. 先完成正式只读知识服务、MCP Sidecar、控制 API、Web AI 集成页面和双平台控制桥接；
3. 开发完成并通过自动化门禁后，再在用户本机验证当前 Codex 客户端；
4. 用户本机通过后，再验证不同客户端版本、入口和 macOS/Windows；
5. 内容与发布继续执行 D0-Pilot、D0-Release 和发布门禁。

## 2. 不变的安全与数据边界

以下 v0.5 规则保持有效：

- 正式 MCP 不得通过 `BundleRuntime` 构造后再分流，必须使用独立 `ReadOnlyRuntimeContext`；
- MCP 不得创建、打开、读取、迁移或修改用户库；
- Web 页面不得持有 MCP OAuth Token、私钥或解密口令；
- 未知类型、未知字段、策略缺失、签名错误和摘要状态异常必须 fail closed；
- 客户端兼容失败不得通过 HTTP、长期明文 Token、未加密私钥、放宽 PKCE/resource/audience/Host/Origin 或数据策略来解决；
- D0-Release 通过前，任何真实摘要不得进入 Runtime、产品展示或交付包；
- 用户本机真实客户端配置、系统信任和真实 OAuth 状态仍需单独授权、快照和恢复/保留证据；
- push、PR、merge、真实数据、用户数据、D0 和 packaging 不在批次 A 授权内。

## 3. 新门禁

### 3.1 开发准入

批次 A 可以开始的前提：

- T0–T2 `53/53 PASS`；
- 四份机器合同和 synthetic fixture 已版本化；
- 独立开发分支和 worktree 已建立；
- 生产代码只使用 synthetic fixture 或临时 synthetic SQLite；
- 当前 dirty checkout 保持只读，不自动提交、stash、reset 或覆盖。

### 3.2 开发完成

只有以下条件全部满足，才可申请用户本机验证：

- 正式只读知识服务、Sidecar、控制 API、Web 配置和双平台桥接代码完成；
- 正式实现的单元、集成、协议、API、前端和平台适配测试通过；
- T0–T2 回归不退化；
- 真实数据访问、用户数据访问、系统信任修改、真实客户端配置和真实 OAuth 状态写入均为 0；
- 主 Web Runtime 在 MCP 禁用、缺失或失败时仍正常工作；
- 形成开发完成报告，明确“尚未通过真实客户端验收”。

### 3.3 用户本机验证

本机验证不是批次 A 的一部分。执行前必须另行确认：

- 目标客户端和版本；
- 允许修改的配置文件或客户端状态；
- 是否允许写入 CurrentUser 系统信任；
- 变更前快照；
- 测试后的恢复、保留或用户选择。

### 3.4 多版本与双平台

多版本和双平台验证必须在用户本机主要客户端通过后执行。Windows PASS 必须来自真实 Windows 环境，不能用 macOS 模拟替代。

## 4. 与 v0.5 的解释顺序

对本地 MCP 开发准入顺序存在冲突时，本补充决策优先于 v0.5 第 5.5、17、18 节中“D0-Pilot/T3 必须先于 M1”的表述。

除上述顺序调整外，v0.5 的协议、TLS/OAuth、数据策略、Tool、状态、UI、威胁边界和停止条件继续有效。

## 5. 批次 A 授权记录

用户在当前 Codex 任务中明确回复：

> 确认按 v0.1 执行批次 A。

该确认授权：

- `P0 → D1 → D2 → D3 → D4 → D5 → D6`；
- 独立 worktree、隔离依赖、正式代码、Web/App 功能、自动化测试和本地阶段提交。

该确认不授权：

- push、PR、merge；
- 真实 Codex/ChatGPT/IDE 配置；
- 系统信任写入和真实 OAuth；
- D0-Pilot、D0-Release、真实数据、用户数据；
- App packaging、签名、公证或发布。
