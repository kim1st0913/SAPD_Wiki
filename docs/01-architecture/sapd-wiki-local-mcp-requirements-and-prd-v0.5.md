# SAPD Wiki 本地 MCP：需求与产品设计 PRD v0.5

| 项目 | 内容 |
|---|---|
| 文档状态 | `M0-T / D0` 有条件批准的工程评审基线；替代工程内 `v0.4` 与外部 `v0.3 Draft` |
| 日期 | 2026-07-23 |
| 适用范围 | SAPD Wiki macOS DMG、Windows Electron 桌面版 |
| 目标能力 | App 管理的本机只读 Streamable HTTP MCP |
| 当前批准范围 | `M0-T` 隔离技术验证、威胁验证与四份合同冻结；`D0` 只定义门禁，数据工作须另行授权 |
| 未批准范围 | M1 及以后正式实现、正式数据接入、用户数据访问、App 设置接入、发布打包 |
| 默认数据边界 | 仅允许经过独立 AI 使用策略审定的基础知识库公开摘要 |
| 上游输入 | `SAPD-Wiki-Local-MCP-Requirement-Design-and-PRD-v0.3.md` |

> 本文是长期跨模块设计合同，不是生产实现授权。`M0-T` 经单独执行批准后，可在本文指定的隔离边界内编写 synthetic fixture、spike、测试证书和非正式 Runtime probe；不得接入生产启动路径、正式数据库、App 设置或交付包。`D0` 的任何数据产出须取得独立数据变更授权。正式代码、正式数据、用户库、系统信任库、App 设置和打包改动仍须逐阶段批准。

> 2026-07-23 追加决策：用户已确认“每用户、每安装实例独立的 App 管理本地 CA”作为正式方向。证书字段、首次启用、CurrentUser 信任、更新、修复、重置、设置页和顶部状态的详细合同由 `sapd-wiki-local-mcp-certificate-and-trust-management-design-v1.md` 冻结；该设计取代本文第 9.2 节的未决选型状态，但不授权实际写入系统信任或安全存储。

---

## 0. 评审结论

工程内 v0.4 已正确吸收外部 v0.3 的主要评审意见，尤其是：默认仅公开摘要、用户库不可达、独立审计控制面、完整 OAuth 边界、状态拆分、无状态 P0 Profile、目标只读 RuntimeContext 和 Tool 合同门禁。

v0.5 接受 Work 侧“有条件批准”结论，并进一步修正以下问题：

1. 当前基础库没有 `ai_summary` 字段，15 个来源文件中 `public=0`；因此正式 P0 当前可开放内容为 0，不能把现有 `description` 自动当作公开摘要。
2. 当前稳定身份并非“覆盖率待验证”：只读审计确认 4,678 个对象与 7,757 条关系均已有 `stable_key / stable_ref / public_id`；待验证的是 redirect 实例和跨版本行为。
3. 当前基础库实际有 37 种对象类型，v0.3 候选白名单同时存在漏项和不存在的类型；白名单必须由实际枚举与公开摘要资产共同生成，不能凭文档名称模糊映射。
4. 客户端注册不再假定 DCR 优先。`M0-T` 按“预注册 → CIMD → DCR”验证目标 Codex 的真实行为，并冻结唯一可交付路径。
5. 本机 TLS 的关键问题不是“把私钥放 Keychain/DPAPI”一句话，而是谁终止 TLS、Sidecar 如何在不落明文 PEM 的前提下完成握手。
6. OAuth loopback callback 按 RFC 8252 处理：注册项除端口外精确匹配；实际授权请求与 Token 请求中的完整 redirect URI 必须精确一致。
7. 无状态 HTTP 不展示持续性的“已连接”，改为“近期已使用 / 上次使用时间”。
8. 增加 `audit_state`、授权事务超时、重置/卸载清理和 macOS 关闭窗口后的持续运行提示。
9. 删除“中文字符数约等于固定 Token 数”的假设。Tool 先以 item、字符和 UTF-8 byte 为硬上限，`M0-T` 再对目标 Codex 实测上下文成本。
10. 新 `/api/v1/knowledge/*` 不再是 M1 必选生产接口；优先直接验证共享服务，只有现有 UI 确有消费者时才增加受保护 Web Adapter。
11. 增加同一 OS 用户权限边界、策略签名信任根、提示词注入防护和本地指标口径。
12. 设置窗口继续沿用当前产品“系统设置”心智，一级页面为“基础设置 / AI 集成”；“连接 Codex”是主动作，复制 URL 是次动作。
13. Gate 0 拆成可并行但授权独立的 `M0-T` 技术验证轨与 `D0` 内容就绪轨，消除“禁止写代码”与“必须做 spike”的冲突。
14. `M0-T` 只验证最小原型、状态机和合同；正式 `ReadOnlyRuntimeContext` 属于 M1，双平台设置 UI 与窗口行为验收属于 M3。
15. `D0` 分为 `D0-Pilot` 与 `D0-Release`：前者是 M1 计划准入条件，后者是任何真实数据接入与发布的准入条件。
16. TLS 增加“加密 PKCS#8（PEM 编码）+ Keychain/DPAPI 口令”候选，并要求口令只在进程内存或受认证私有通道出现，不进入命令行、环境变量或日志。
17. 增加版本化 fixture 合同，以及公开摘要的 `summary_hash`、唯一键、manifest digest 和内部审核追责规则。

结论：v0.5 可作为 `M0-T` 执行计划与隔离原型的有条件基线，也可作为 `D0` 单独授权的验收合同；它仍不构成 M1 正式实现、正式数据接入或发布批准。

---

## 1. 用户目标与产品边界

### 1.1 用户目标

用户希望在不部署远程 SAPD Wiki 服务、不手工复制知识正文的前提下，让本机 Codex 使用结构化 SAPD 知识，并在输出中明确区分：

- SAPD Wiki 授权知识；
- 联网资料；
- 用户输入的事实；
- 模型分析与建议。

### 1.2 产品目标

| ID | 目标 |
|---|---|
| G-01 | 用户从 SAPD Wiki App 内启用、诊断和停止 MCP |
| G-02 | MCP 故障不阻断主 Web 后端和主界面 |
| G-03 | macOS 与 Windows 共享后端、查询、协议和数据策略合同 |
| G-04 | MCP 依赖图中不存在 UserStore，且不创建、打开或迁移用户库 |
| G-05 | 默认仅返回被政策明确允许的基础库公开摘要 |
| G-06 | 每次请求均执行认证、授权、策略和版本检查 |
| G-07 | 用户能看清客户端、权限、数据类别、有效期和可能的云端数据流 |
| G-08 | 服务、授权、近期活动、知识、审计状态分别可观察 |
| G-09 | Tool 返回稳定身份、知识版本、策略版本和安全证据状态 |
| G-10 | App 退出时 Sidecar 可验证地退出，不误杀其他实例 |

### 1.3 明确非目标

- 公网、局域网或多设备访问；
- App 未运行时继续提供 MCP；
- 任意 SQL、任意文件、原始文档或完整数据包读取；
- 读取或写入笔记、收藏、标签、成熟度项目、评分、报告和用户导入数据；
- MCP 内置联网搜索；
- 静态长期 Bearer Token；
- 正式环境 HTTP 降级；
- P0 SSE、持久 Session、恢复和服务端主动通知；
- 防御已经取得当前 OS 用户等价权限、管理员/root、调试器或可读取 App 进程内存的恶意代码。

最后一项必须出现在威胁模型和对外说明中。产品可以抵御未授权网页、DNS rebinding、错误客户端、其他 OS 用户和意外本地访问，但不能宣传为能抵御已完全控制当前登录用户会话的攻击者。

---

## 2. 当前工程证据

### 2.1 Runtime 副作用

当前 `scripts/run_local_server.py` 的 `BundleRuntime` 构造会：

- 以 `mode=rwc` 打开用户库；
- 创建或迁移用户表；
- 创建 import/export 与业务子目录；
- 在启动检查中使用 `create_user=true`。

因此正式 MCP 不得在 `BundleRuntime` 构造后才分流。M1 实施时，MCP composition root 必须在最早入口直接构造 `ReadOnlyRuntimeContext`；`M0-T` 只用隔离的 `ReadOnlyRuntimeProbe` 验证这一依赖边界。

### 2.2 数据现状

2026-07-22 只读核对结果：

| 项目 | 当前值 | 对 MCP 的含义 |
|---|---:|---|
| `knowledge_items` | 4,678 | 可作为身份与查询结构基础 |
| 对象类型 | 37 | 白名单必须对照真实枚举冻结 |
| `knowledge_relations` | 7,757 | 关系暴露需双端点与关系类型共同授权 |
| 关系类型 | 28 | 未在策略列出的类型全部 deny |
| `knowledge_items.ai_summary` | 不存在 | 不得把 `description` 自动替代为公开摘要 |
| `source_files` | 15 | 当前均非 public |
| `source_files.sensitive_level=public` | 0 | 当前正式公开摘要可用量为 0 |
| confidential / unknown 来源 | 10 / 5 | 默认全部拒绝 |

正式数据开放前，必须另行形成经审定的公开摘要资产及授权依据。`M0-T` 可以使用不含真实敏感内容的 fixture 验证协议，但 fixture 通过不等于 `D0-Pilot` 或 `D0-Release` 通过，更不等于正式数据已可开放。

### 2.3 稳定身份现状

现有审计已通过：

- 4,678 / 4,678 对象具有显式 `stable_key` 与确定性 `public_id`；
- 7,757 / 7,757 关系具有显式 `stable_key` 与确定性 `public_id`；
- 用户库 legacy base ref 为 0。

`M0-T` 不再重复证明“是否有 stable key”，而应验证：

- rename / merge / split / deprecated redirect fixture；
- 旧 `canonical_ref` 在策略过滤后的解析；
- knowledge version 变化后的游标失效；
- redirect 目标不可访问时不泄露其存在。

---

## 3. 核心用户旅程

### 3.1 首次启用

1. 用户打开“系统设置 → AI 集成”。
2. 页面先展示默认开放范围与明确排除的数据。
3. 用户选择“启用 SAPD Wiki MCP”。
4. App 执行 Runtime、端口、策略和 TLS 前置检查。
5. 需要安装本机信任时，App 说明影响、范围和撤销方式，再请求用户确认。
6. Sidecar 准备完成后显示“服务已就绪，尚未授权客户端”。
7. 页面主动作变为“连接 Codex”。

不得在用户打开开关后直接表示“已连接”。

### 3.2 连接 Codex

“连接 Codex”打开分步引导：

1. 选择当前使用界面：ChatGPT Desktop、Codex CLI 或 IDE。
2. 展示目标客户端实际需要的配置步骤；不自动改写 `~/.codex/config.toml`，除非未来单独取得外部写入授权。
3. 检查 SAPD Wiki MCP 是否已出现在客户端工具列表。
4. 引导用户选择 Authenticate 或执行 `codex mcp login <server-name>`。
5. 收到授权请求时，App 将授权窗口置前或发出明确系统通知。
6. 用户确认客户端、redirect URI、scope、数据字段、策略版本与云端数据流。
7. 真实 `initialize / tools/list / tools/call` 成功后显示“近期已使用”，并记录上次使用时间。

复制服务 URL 是次要动作，不能替代完整连接引导。

### 3.3 日常使用

- App 启动时，若用户保持启用，Sidecar 异步启动；主界面不等待它。
- 授权仍有效但近期无调用时显示“已授权，等待使用”。
- 最近 60 秒内有成功认证请求时显示“近期已使用”。
- 60 秒后回到待机状态，保留“上次使用时间”。

### 3.4 停止、撤销与重置

三个动作语义必须分开：

| 动作 | 服务 | 客户端授权 | TLS 信任与密钥 | 审计 |
|---|---|---|---|---|
| 停止服务 | 停止 | 保留 | 保留 | 保留 |
| 撤销客户端 | 可继续运行 | 删除指定 grant/token family | 保留 | 记录撤销元数据 |
| 重置 AI 集成 | 停止 | 全部删除 | 删除 App 管理的信任身份与秘密 | 用户选择清除或导出后清除 |

卸载说明必须告诉用户如何执行“重置 AI 集成”，避免在系统信任库、Keychain/Credential Manager 和控制面中遗留不可解释的凭据。

### 3.5 错误恢复

错误必须给出单一、可执行的恢复动作，例如：

- 端口冲突：查看占用者 / 修改端口；
- TLS 未信任：修复安全连接；
- 授权失败：重新授权；
- 策略损坏：修复 Runtime，不允许绕过；
- Codex 未配置：打开连接引导。

主界面始终可用，错误只影响 AI 集成。

---

## 4. 总体架构与所有权

```text
SAPD Wiki Desktop App
├─ Web Runtime（现有业务运行面）
│  └─ BundleRuntime → BaseStore + UserStore + Web/API
├─ MCP Supervisor（App 所有）
│  ├─ 进程、端口、锁、lease、状态聚合
│  ├─ 原生授权确认
│  └─ 平台安全存储 / TLS 信任生命周期
└─ MCP Sidecar（独立进程）
   ├─ Streamable HTTP Resource Server
   ├─ OAuth Authorization Server 协议端
   ├─ ReadOnlyRuntimeContext
   │  ├─ BaseKnowledgeRepository(mode=ro, query_only=ON)
   │  ├─ KnowledgeQueryService
   │  ├─ IdentityResolver / EvidenceResolver
   │  └─ AiExposurePolicy
   └─ 独立 MCP 控制面
```

上图是 M1-M3 的目标架构，不是 `M0-T` 的交付物。`M0-T` 只能在隔离目录实现最小 `ReadOnlyRuntimeProbe`、协议端和状态机模拟；不得把 probe 命名或接线为正式 `ReadOnlyRuntimeContext`，也不得被生产启动入口、App Bridge 或交付包导入。

### 4.1 所有权表

| 状态/资源 | 唯一所有者 | 其他组件权限 |
|---|---|---|
| `mcp.enabled / port` | App 设置 | Sidecar 只读 |
| Sidecar 启停与锁 | App Supervisor | Sidecar 可自我退出 |
| 服务活性 | Sidecar | App 聚合 |
| 授权请求最终确认 | App 原生 UI | Sidecar 持有协议事务 |
| OAuth grant/token family | MCP 控制面 | App 经安全 Bridge 管理 |
| 基础库 | Delivery Runtime | MCP 只读 |
| 用户库 | Web Runtime | MCP 不可达 |
| AI 策略 | 签名发布资产 | Sidecar 校验并执行 |
| 前端状态 | App Bridge 投影 | 前端不得直接信任状态文件 |

### 4.2 安全不变量

- 仅绑定显式回环地址，不绑定 `0.0.0.0`。
- MCP 每个 HTTP 请求都认证；Session ID 不能替代认证。
- MCP 依赖图不存在 `UserStore`、import/export 路径和迁移服务。
- 未知对象、字段、关系、策略或版本一律 deny。
- 隐藏对象不得通过计数、排序、耗时或错误差异泄露。
- Token、code、查询、知识正文、绝对路径和用户内容不进入普通日志。
- 端口、TLS、OAuth 和策略失败不阻断主界面。
- 不自动杀死不能完整证明所有权的进程。
- 策略收紧立即生效；策略扩权必须重新同意。
- 动态知识内容始终视为不可信参考数据，不能覆盖系统或用户指令。

---

## 5. Gate 0 双轨范围与准入门禁

Gate 0 由两条可以并行、但授权和产物必须隔离的轨道组成：

- `M0-T`：技术验证轨，证明协议、安全边界和工程可行性；
- `D0`：内容就绪轨，证明公开摘要可以被合法、可追责、可重复地生成与发布。

`M0-T PASS` 不代表内容就绪；`D0-Pilot PASS` 也不代表技术方案可行。

### 5.1 M0-T 允许与禁止的工作

`M0-T` 取得执行批准后，允许：

- 在 `spikes/local-mcp/**` 编写不被生产入口导入的最小 MCP、OAuth、TLS 和状态机 spike；
- 在 `tests/fixtures/mcp/**` 编写版本化、无真实敏感内容的 synthetic fixture 与负向样本；
- 在 `docs/01-architecture/contracts/mcp/**` 形成四份机器可读合同、JSON Schema、黄金查询和兼容矩阵；
- 仅针对 synthetic base fixture 使用 `ReadOnlyRuntimeProbe`，证明只读打开、查询、失败和退出的零用户库副作用；正式基础库路径只作为“不得打开”的 sentinel，不作为查询输入；
- 对 macOS 与 Windows 的目标 Codex 做真实连接实验；优先使用临时 profile 或 project-scoped 配置，未经当次授权不得改写真实 `~/.codex/config.toml` 或共享客户端配置；
- 使用测试证书验证 HTTPS、证书信任和密钥保管；测试私钥不得进入 Git，默认仅存放在本次运行专属、当前用户最小权限的临时目录并在留证后清理；
- 模拟 App / Sidecar 状态机和授权确认流程，不制作或接入正式双平台设置 UI。

`M0-T` 禁止：

- 修改或接入生产启动路径、正式 `BundleRuntime`、正式 `ReadOnlyRuntimeContext`、Web API 或 App Bridge；
- 打开、创建、迁移或写入真实用户库，或创建 import/export 等业务目录；
- 修改正式基础库、源文件、正式 JSON、签名策略、App 设置、安装包或发布流水线；
- 把测试证书、私钥或 OAuth 凭据放入交付包；
- 未经逐次确认修改当前用户或系统信任库。必须修改信任库的实验需单独记录目标、影响、回滚动作和清理证据。
- 未经逐次确认写入真实 Codex/ChatGPT Desktop/IDE 配置、OAuth 凭据或客户端状态；获准写入时必须先做最小快照，并在实验结束后提供恢复或保留选择。

### 5.2 D0 允许与禁止的工作

本文件只定义 `D0` 门禁，不自动授权数据变更。取得单独数据变更授权后，候选摘要默认只写入 `data/exports/worker-verify/mcp-public-summary/**` 或该次授权指定的等价隔离目录，并遵守：

- 来源文件和正式基础库只读；
- 不覆盖源 Excel、protected dictionary、正式 SQLite、正式 JSON 或 generated package；
- 候选摘要在 `D0-Release PASS` 前不得进入正式 Runtime；
- 内部审核身份、来源证据和许可依据可追责，但不得通过 MCP DTO 暴露；
- 每次授权必须写明输入、输出、对象粒度、恢复路径和验收证据。

### 5.3 四份合同

| 合同 ID | 内容 | Gate 0 交付证据 |
|---|---|---|
| MCP-AUTH-v1 | 发现、注册、授权、PKCE、Token、撤销 | 时序、响应 fixture、客户端矩阵、负向测试 |
| MCP-DATA-POLICY-v1 | 对象、字段、关系、证据、AI 使用权 | Schema、默认 deny 策略、D0 状态、泄漏测试 |
| MCP-RUNTIME-STATE-v1 | App、Sidecar、端口、TLS、锁、lease、状态 | 状态机、冲突矩阵、崩溃与升级模拟 |
| MCP-PROTOCOL-TOOLS-v1 | Transport Profile、Tool Schema、错误、限额 | JSON Schema、黄金查询、协议兼容和注入测试 |

四份合同的版本、依赖和 digest 必须互相引用；任一合同变化都必须触发兼容性影响判断，不能只改人类可读说明。

### 5.4 Synthetic fixture 合同

fixture 是四份合同共用的测试资产，不构成第五个产品合同。每条记录至少包含：

- `fixture_schema_version`、稳定唯一的 `fixture_id` 与 `fixture_hash`；
- `contains_real_data=false`；
- `case_class`、输入对象/关系/策略/客户端状态；
- `expected_policy_decision`、`expected_tool_visibility`、`expected_error`；
- `expected_side_effects` 与 `expected_observability`；
- 适用的合同版本和知识/身份/策略版本。

`contains_real_data=false` 不能只靠声明：fixture 的 `canonical_ref` 必须使用保留的 `fixture://` 命名空间，每条记录必须声明 `provenance.kind=hand_authored_synthetic` 且不得带真实 source ref。构建检查必须扫描绝对路径、源文件名、凭据形态和非 fixture 标识；任何阶段都不得为“查重”打开或导出真实用户库。

最小 fixture 集必须覆盖：

- `public_summary`、`metadata_only`、`deny`、`internal`、`confidential`、`unknown`；
- 允许关系、单端隐藏关系、双端隐藏关系和未知关系类型；
- 有效 redirect、目标被拒绝的 redirect、redirect cycle 与跨版本 redirect；
- 重名对象、未知类型、空查询、超限请求、过大单对象和陈旧游标；
- 提示词注入、控制字符、路径/URI/SQL 注入和策略签名或 manifest digest 失败；
- “用户库陷阱”：仅使用 synthetic sentinel 路径和打开探针，测试通过条件是零访问尝试，不得拿真实用户库充当样本。

### 5.5 M1 计划准入条件

只有同时满足以下顶层条件，产品、安全和工程才可评审是否创建 M1 正式实现计划：

1. `M0-T=PASS`；
2. `D0-Pilot=PASS`；
3. `MCP-AUTH-v1 / MCP-DATA-POLICY-v1 / MCP-RUNTIME-STATE-v1 / MCP-PROTOCOL-TOOLS-v1` 已冻结并可机器校验；
4. 产品、安全和工程完成联合评审并给出新的书面实施授权。

其中 `M0-T PASS` 至少要求：

1. 目标 Codex 客户端真实完成发现、注册、PKCE、resource、audience、刷新和撤销。
2. TLS 私钥无需未加密临时文件即可被已选 TLS 终止组件使用。
3. App 管理的本机信任生命周期已通过隔离实验；所有信任库写入均有明确授权和清理证据。
4. probe 启动、查询、失败和退出均不创建或打开用户库，不创建业务目录。
5. 当前 37 种对象类型与 28 种关系类型已逐项决策，未知类型 fail closed。
6. 稳定身份 redirect fixture 与跨版本行为通过。
7. 无状态 Streamable HTTP Profile 与目标客户端兼容。
8. Tool Schema、排序、游标、错误、字符/byte/item 上限和黄金查询冻结。
9. 多实例、升级、回滚和卸载状态机模拟通过。
10. 同一 OS 用户权限威胁边界已被产品文案准确表达。

其中 `D0-Pilot PASS` 的定义见 6.5。任何顶层条件失败，对应轨道状态为 `BLOCKED`；不得以 HTTP、长期 Token、读取用户库、放宽策略或把 fixture 当正式数据作为回退。

---

## 6. 数据暴露与内容就绪合同

### 6.1 P0 唯一业务 scope

```text
sapd.base.public.summary.read
```

该 scope 仅表示“可以请求策略允许的公开摘要”，不表示能读取所有基础库内容。

### 6.2 最终允许条件

一个字段只有同时满足以下条件才可返回：

```text
Store=base read-only
∩ canonical_ref 可稳定解析
∩ object_type / relation_type 在白名单
∩ field 在显式 DTO 白名单
∩ effective_sensitive_level=public
∩ ai_use_policy=public_summary 或 metadata_only
∩ source/license basis 允许 AI 使用
∩ client scope 与 grant 允许
∩ policy/knowledge/identity version 有效
∩ Runtime 完整性通过
```

任一未知或 deny 优先。

### 6.3 当前对象类型处理

当前 37 种实际类型只能作为 `M0-T / D0` 盘点输入，不直接等于允许清单。机器合同必须为每一种实际类型给出：

- `deny`；
- `metadata_only`；
- `public_summary`；
- 业务 owner；
- 来源与许可依据；
- 可返回字段；
- 允许关系；
- 当前符合条件的对象数量。

文档中不存在于数据库的类型不得自动映射；数据库中新出现的类型必须保持 deny，直到合同升级。

### 6.4 公开摘要资产

P0 正式数据需要一个独立、可审计的摘要投影。资产 Schema 至少包含：

- `summary_schema_version`；
- `canonical_ref`；
- `locale`；
- `ai_summary`；
- `summary_version`；
- `summary_hash`；
- `review_status`；
- `reviewed_by_role`；
- `reviewed_by_principal`，仅写入内部 provenance ledger，不进入 MCP DTO；
- `reviewed_at`；
- `source_and_license_basis`；
- `source_basis_digest`；
- `base_manifest_digest`；
- `effective_sensitive_level`；
- `ai_use_policy`；
- `policy_version`；
- `release_status` 与可选 `valid_until`。

版本与完整性规则：

- 唯一键为 `(canonical_ref, locale, summary_version)`；
- `summary_version` 在同一 `(canonical_ref, locale)` 内单调递增；内容变化必须升版；
- `summary_hash = SHA-256(UTF-8(NFC(ai_summary.replace(CRLF|CR, LF))))`；同一唯一键出现不同 hash 时硬失败；
- 发布 manifest 必须列出每条摘要的唯一键与 `summary_hash`，并绑定 `base_manifest_digest`、`policy_version` 和摘要 Schema 版本；
- 每个发布 manifest 中，同一 `(canonical_ref, locale)` 最多存在一个生效摘要；
- `reviewed_by_principal`、内部备注和审核证据只用于追责与复核，MCP 只能看到合同允许的公开投影字段。

不得从 `description`、`metadata_json` 或前端 JSON 临时生成公开摘要。摘要资产如何进入正式 base package 属于独立数据/ETL任务，不在本设计任务中实施。

### 6.5 D0 内容就绪标准

`D0` 在单独数据变更授权下运行，分为两级：

#### D0-Pilot

用于判断是否可以创建 M1 正式实现计划，必须满足：

- 摘要 Schema、唯一键、版本、hash、manifest 绑定和内部审核合同已冻结；
- 候选集绑定一个明确的 `MCP-DATA-POLICY-v1` candidate digest；allowlist、字段、关系或来源规则变化后，已有 `D0-Pilot` 结果立即变为 `STALE`；
- 每一种拟开放的 `public_summary` 对象类型至少有一条代表性候选摘要；
- 代表集同时覆盖重名、redirect、长文本、来源组合、许可边界和易发生提示词注入的内容；
- 每条候选均有明确来源/许可依据、敏感级别、AI 使用策略、内部审核主体和时间；
- Schema、digest、重复键、敏感词/路径泄漏、提示词注入形态和默认 deny 检查全部通过；
- 候选资产只存在于隔离工作区，未写入正式基础库、Runtime 或交付包。

#### D0-Release

用于判断真实摘要能否接入 Runtime 和发布，必须满足：

- 本次发布 allowlist 内的摘要资产 100% 通过 Schema、来源/许可、审核、hash 和版本校验；
- 没有 `unknown`、`deny`、审核未完成、过期或 manifest 未绑定记录；
- 生成过程可重复，输入快照、规则版本、输出 digest 和审核记录可追溯；
- 签名 `ai-access-policy.json` 与摘要发布 manifest 相互绑定，并绑定正式 base manifest digest；
- 产品、安全、数据 owner 和工程完成发布评审，另行批准正式数据接入。

`D0-Pilot PASS` 只解除“M1 可以立项”的内容阻断；Gate 0 联合评审时，D0-Pilot 绑定的 policy digest 必须与待冻结的 `MCP-DATA-POLICY-v1` 完全一致。任何真实数据接入、产品展示或交付发布仍必须等待 `D0-Release PASS`。

### 6.6 关系与搜索防泄漏

- 关系只有两端对象、关系类型和字段均允许时才返回。
- 隐藏对象在搜索候选、rank、facet、计数和分页前即被排除。
- 不返回“还有 N 条隐藏结果”、占位对象或区别性错误。
- 对象不存在与无权限统一返回 `OBJECT_NOT_AVAILABLE`。

### 6.7 P0 明确拒绝

- 用户 SQLite 及所有用户生成内容；
- 成熟度项目、模板副本、评分、证据和报告；
- 导入、暂存、复核、批准和导出记录；
- 原始文件、完整标准全文和受许可限制内容；
- 前端数据包、文件系统搜索和任意 SQL；
- 通用 `description`、`metadata_json`、`raw_text/raw_value`、本地路径和调试字段。

---

## 7. 策略签名与版本

发布包包含版本化 `ai-access-policy.json`，默认规则为 deny。至少包含：

- Schema、policy 和 identity version；
- base manifest digest；
- 对象、字段、关系和证据规则；
- canonical override；
- 来源与许可依据；
- 生效/失效时间；
- signer、key id 和 signature。

策略信任根必须明确：

- 发布公钥或其摘要固定在签名 App/Runtime 的受保护 manifest 中；
- 策略签名不能使用策略文件自己声明且未经锚定的公钥；
- key rotation、撤销和旧策略兼容必须有版本规则；
- 策略过期、签名失败、manifest digest 不匹配或未知 key id 时 `knowledge_state=blocked`。

授权 grant 绑定 `policy_version`。收紧立即生效；扩权必须展示差异并重新确认。

---

## 8. OAuth 与授权确认

### 8.1 协议角色

- Sidecar：OAuth Protected Resource；可同时提供同源 Authorization Server 协议端。
- App：可信用户确认、生命周期和平台安全存储 owner。
- Codex：OAuth public client。
- 用户：授权主体。

### 8.2 发现端点

`M0-T` 至少验证：

```text
GET  /.well-known/oauth-protected-resource/mcp
GET  /.well-known/oauth-authorization-server
GET  /oauth/authorize
POST /oauth/token
POST /oauth/revoke
POST /mcp
```

`registration_endpoint` 仅在冻结的注册方式确实需要 DCR 时声明。未认证资源请求返回 401，并通过 `WWW-Authenticate` 指向 Protected Resource Metadata 和最小 scope。

### 8.3 客户端注册决策

`M0-T` 按目标 Codex 实际行为验证以下顺序：

1. 可用的预注册客户端信息；
2. Client ID Metadata Documents（CIMD）；
3. Dynamic Client Registration（DCR）兼容回退。

不得先把 DCR 写成正式唯一方案。若采用 CIMD，必须增加 SSRF、DNS、缓存、文档签名/可信域和离线失败测试；若采用 DCR，必须增加注册滥用、速率限制、未验证身份提示和记录清理测试。

### 8.4 redirect URI

- public native client 必须使用 Authorization Code + PKCE S256。
- loopback callback 优先使用 IP literal，不使用 `localhost` 作为默认。
- 注册的 loopback URI 除端口外精确匹配，允许客户端使用临时端口。
- 同一次授权请求与 Token 请求的完整 redirect URI 必须精确一致。
- 非 loopback URI 必须完整精确匹配，不允许通配符、前缀匹配或开放重定向。
- 授权页突出显示 redirect scheme、host、port 和 path，并把未验证客户端标为未验证。

### 8.5 授权事务体验

- 使用外部用户代理完成 OAuth 跳转，不用可被客户端控制的嵌入式 WebView 静默批准。
- Sidecar 创建一次性授权事务并通知 App。
- App 将原生确认窗口置前；用户不在前台时发出明确通知。
- 每个事务绑定 client、redirect、scope、resource、PKCE、policy version 和 `instance_id`。
- 事务默认 2 分钟超时；关闭窗口或 App 退出均视为拒绝。
- 不允许后台静默批准；并发事务必须排队或逐个显示，不能覆盖前一个请求。

### 8.6 Token 与撤销

- opaque Access Token，至少 256 位随机熵，建议初始有效期 10 分钟；
- Refresh Token 轮换，检测 reuse 时撤销整个 family；
- Token 绑定 client、runtime、resource、scope、grant 和 policy version；
- 每次请求校验 resource/audience；
- Token 只进入 `Authorization: Bearer`，不进入 URL、Cookie、设置、环境变量或静态 header；
- 撤销单客户端、单 grant 和全部客户端均立即生效，包括已签发 Access Token。

具体有效期在 `M0-T` 兼容与风险测试后冻结。

---

## 9. 本机 TLS 与密钥保管门禁

### 9.1 Canonical resource

```text
https://127.0.0.1:{configured_port}/mcp
```

P0 只为实际 canonical host 签发 SAN。除非 `M0-T` 证明目标客户端必须使用 `localhost` 或 `::1`，否则不增加别名，也不把同一授权跨主机形式复用。

### 9.2 已冻结的 TLS 身份与终止方案

正式方向已冻结为：

1. 每个 OS 用户、安装实例和 release profile 独立生成本地 CA；
2. CA 公共证书只加入 CurrentUser 信任；
3. CA 私钥只用于首次签发服务器证书，签发后删除，不安装长期运行的 CA 服务；
4. 服务器私钥以加密 PKCS#8 保存，随机口令由 Keychain/DPAPI CurrentUser 保管；
5. Sidecar 使用 `SSLContext.load_cert_chain(..., password=...)` 终止 TLS；
6. App/Bridge 负责生成、信任确认、有效期、修复、更新、精确指纹删除和重置；
7. 开发人工验收、macOS 和 Windows 共享生命周期合同，平台信任写入分别使用原生适配器；
8. 自动化测试继续使用临时 CA 与显式测试客户端信任，不写系统状态。

以下方案保留为已评估替代项，不作为首版正式方向：

| 方案 | 说明 | 主要门禁 |
|---|---|---|
| App 终止 TLS | App 使用平台密钥 API，转发到经认证的私有 Sidecar 通道 | 代理不能放宽 Origin/Host/audience；私有通道必须绑定实例 |
| 签名 Helper 终止 TLS | 独立签名 Helper 通过 Keychain access group / Windows 平台 API 使用密钥 | Helper 签名、entitlement、升级和打包必须可验证 |
| Sidecar 原生密钥 Provider | Sidecar 的 TLS 栈直接调用平台密钥句柄 | 目标库必须支持非导出私钥句柄，不能要求 PEM 路径 |
| 客户端指定 CA / 证书固定 | 客户端显式加载 App 公共 CA | 只作为 CLI、自动化和受限企业环境兼容路径，不能替代默认 CurrentUser 信任体验 |
| STDIO/本地桥接器 | 客户端经本地进程转发到服务 | 改变 Streamable HTTP/OAuth 产品合同，只作为未来兼容备选 |

Python 标准 `SSLContext.load_cert_chain` 接受 `password` 参数，可读取加密私钥文件；“加密私钥文件 + 平台安全存储口令”符合当前威胁边界。它只保护静态文件与离线副本，不抵御已完全控制当前用户会话或 Sidecar 进程内存的攻击者。

若使用该候选：

- 私钥文件使用当前用户最小 ACL，禁止进入 Git、备份同步、普通临时目录和诊断导出；
- 随机口令由 Keychain/DPAPI 保管，Sidecar 直接调用平台 API，或由 App 通过绑定 `instance_id` 的受认证私有 IPC 交付；
- 禁止通过 CLI 参数、环境变量、普通文件、剪贴板、标准日志或崩溃诊断传递口令；
- 轮换必须原子替换证书、加密私钥和口令引用，并验证失败回滚不会恢复过期或已撤销身份；
- 运行结束后尽力清理口令缓冲；不得宣称能防御同用户权限下的调试器或进程内存读取。

正式停止条件：若唯一可行方案要求把未加密私钥写入普通文件、临时目录、命令行或环境变量，则 TLS 方案不通过，M1 不批准。

### 9.3 信任生命周期

必须验证：

- App/MCP 重启、普通升级和端口修改后证书指纹保持不变；
- 证书路径由 App 固定管理，用户界面只读显示逻辑位置，不提供路径修改；
- CA、服务器证书和私钥不跟随 App 数据目录、上传/下载目录或同步盘；
- 首次启用只要求用户确认用途、CurrentUser 范围、`127.0.0.1` 和删除方式，不要求填写国家、组织、邮箱或有效期；
- 到期前 60 天允许更新、30 天提示即将到期、7 天提示尽快更新，到期后 fail closed；
- 更新先安装并验证新身份，成功后再按记录指纹删除旧信任与秘密；失败回滚旧身份；
- CurrentUser 信任缺失但身份完整时只修复同一 CA，不无故轮换；
- CA 私钥签发服务器证书后删除；更新时生成新的 CA/服务器身份；
- 当前用户范围安装，不写系统范围共享私钥；
- 首次安装、用户拒绝、修复、证书到期、轮换、App 更新与回滚；
- 禁用服务不自动删除信任，重置 AI 集成明确删除；
- 卸载前后清理说明；
- macOS Keychain helper access group 与代码签名；
- Windows CurrentUser 存储的同用户权限边界和可选附加保护。

任何会写入 macOS Keychain 信任设置、Windows CurrentUser 证书存储或其他系统状态的 `M0-T` 实验，都需要当次明确授权，并在实验结束后提供清理或保留选择与证据。

---

## 10. 生命周期、多实例与状态

### 10.1 固定端口

默认端口：stable `18775`、beta `18776`、dev `28775`。用户可修改当前 profile 端口；冲突时不随机换端口。

端口变化后：

- 旧 token/grant 失效；
- Codex URL 需要更新；
- 重新发现和授权；
- 不提供跨端口兼容层。

### 10.2 实例所有权

至少由以下字段共同判断：

- OS 用户；
- installation、runtime、release channel、app version；
- instance ID、PID、process start time；
- executable path/content hash；
- configured port；
- lease epoch、created/heartbeat time。

PID 或进程名不能单独证明所有权。无法完整确认时不杀进程，只展示诊断。

### 10.3 状态维度

```text
desired_state: disabled | enabled
service_state: stopped | starting | ready | stopping | error
authorization_state: no_clients | pending | authorized | revoked | error
activity_state: never | idle | recent
knowledge_state: ready | degraded | blocked
audit_state: disabled | ready | degraded
```

用户可见映射：

| 条件 | 文案 |
|---|---|
| disabled | MCP 未启用 |
| starting | MCP 正在启动 |
| ready + no_clients | 服务已就绪，等待授权 |
| authorized + never/idle | 已授权，等待使用 |
| authorized + recent | 近期已使用 |
| knowledge degraded | MCP 可用，知识状态受限 |
| knowledge blocked | MCP 知识不可用 |
| audit degraded | MCP 可用，审计记录异常 |

“近期已使用”必须同时显示上次成功时间，不能暗示存在持续网络连接。

### 10.4 平台窗口行为

- Windows 主窗口关闭即退出时，Sidecar 同步停止。
- macOS 关闭窗口但 App 仍驻留时，Sidecar 可以继续运行，但菜单栏必须显示可理解的运行状态和“停止 MCP”动作。
- 授权请求到达时，即使主窗口关闭，也必须能把确认 UI 带回前台。

---

## 11. 系统设置与状态入口

### 11.1 信息架构

保持现有“系统设置”窗口名称，一级导航为：

1. 基础设置
2. AI 集成

不把包含路径、版本和 Runtime 的整个设置窗口更名为“系统集成”。

### 11.2 AI 集成页面

按用户任务分组：

1. **服务状态**：启用开关、运行状态、最近错误、启动/停止/重试。
2. **安全连接证书**：证书状态、保护地址、CurrentUser 信任、只读存储位置、有效期、剩余天数、查看详情、更新和修复。
3. **连接 Codex**：主动作、客户端选择、配置引导、服务 URL 次动作。
4. **授权客户端**：身份状态、scope、授权/使用时间、策略版本、逐个撤销。
5. **数据访问**：当前开放范围、明确排除项、对象/字段白名单。
6. **隐私与审计**：审计状态、保留期、查看、导出、清除、关闭。
7. **诊断与重置**：TLS、OAuth、Runtime、策略、端口、日志、脱敏诊断、重置 AI 集成。

首次启用未配置证书时，先显示“建立本机安全连接”确认，不展示 DN、存储路径或有效期输入框。重置完成后删除旧身份并回到首次启用流程；生成和信任新 CA 仍需用户明确确认。

### 11.3 顶部入口

现有“本地数据包”按钮的能力迁入“基础设置 / 诊断”后，顶部位置可以显示紧凑 MCP 状态入口：

- MCP 未启用时使用中性“AI 集成”入口，不持续展示错误式状态；
- 启用后显示运行、授权、证书、License 和近期活动的最高优先级状态；
- 状态浮层始终显示证书有效期和剩余天数，30/7/0 天阈值提供明确提示；
- 点击证书状态直接进入“AI 功能集成 → 安全连接证书”；
- 错误状态提供直接恢复动作；
- 所有原本地数据包、Runtime、日志和诊断动作仍可到达。

### 11.4 可访问性

- 状态不只依赖颜色；
- 动态状态使用节流后的 `aria-live`；
- 所有开关、按钮和列表支持键盘与可见焦点；
- 授权窗口提供清晰标题、权限说明、拒绝与允许；
- 200% 缩放下不遮挡全局搜索与主动作；
- reduced-motion 下不依赖动画传达状态；
- macOS/Windows 语义一致，控件遵循各自平台习惯。

---

## 12. Streamable HTTP P0 Profile

- 单一 endpoint：`POST /mcp`；
- request 返回 `application/json`；
- notification 成功接受返回 202；
- 不发 `MCP-Session-Id`；
- `GET /mcp` 与 `DELETE /mcp` 返回 405；
- 不提供 SSE、恢复或服务端通知；
- initialize 后校验 `MCP-Protocol-Version`；缺失按规范兼容，未知版本返回 400；
- 有 Origin 时精确校验；无 Origin 仍执行 Host、TLS、Bearer、resource/audience 检查；
- 只接受 canonical Host，防 DNS rebinding；
- 取消只允许同一已认证 client 取消自己的 in-flight request；
- 网络断开不自动等同取消；
- 超时、并发、Header、request body 和 response body 均有硬上限。

若目标 Codex 必须依赖 Session 或 SSE，返回 `M0-T` 重新评审，不在实现中暗加兼容分支。

---

## 13. P0 Tool 合同

五个只读 Tool：

1. `search_knowledge`
2. `get_knowledge_object`
3. `get_related_knowledge`
4. `get_source_evidence`
5. `get_knowledge_version`

### 13.1 通用规则

- JSON Schema `additionalProperties=false`；
- 封闭枚举、输入长度和数组数量上限；
- Unicode NFKC 规范化，拒绝控制字符；
- 所有分页请求重新认证和执行当前策略；
- DTO 显式构造，不序列化整行数据库记录；
- 返回内容标记为不可信参考数据，不允许动态内容进入 Tool description 或 server instructions；
- Tool 声明只读 annotation；
- server instructions 前 512 字符自包含，只描述来源边界和使用规则，不包含动态知识内容。

### 13.2 通用输出

```json
{
  "contract_version": "sapd-mcp-tools-v1",
  "source_channel": "sapd_wiki",
  "knowledge_version": "string",
  "policy_version": "string",
  "identity_version": "string",
  "grant_version": "string",
  "content_trust": "untrusted_reference",
  "data": {},
  "page": { "next_cursor": null, "has_more": false },
  "warnings": [],
  "correlation_id": "request-scoped opaque id"
}
```

### 13.3 初始业务上限

Token 数依赖具体模型/tokenizer，服务器不得承诺“中文 N 字符约等于固定 Token 数”。`M0-T` 先使用下列保守上限，再按目标 Codex 实测冻结：

| Tool | 默认/最大记录 | 文本字符目标上限 |
|---|---:|---:|
| search | 8 / 15 | 6,000 |
| object | 1 | 8,000 |
| related | 15 / 30 | 8,000 |
| evidence | 8 / 15 | 4,000 |
| version | 1 | 2,000 |

全局响应绝对上限初始为 64 KiB，同时限制 UTF-8 byte、记录数和单字段长度。触达业务上限时分页；单对象不能完整返回时返回 `RESPONSE_TOO_LARGE`，不截断成半条事实。

### 13.4 游标

HMAC 保护的 opaque 游标至少绑定：

- Tool 与规范化参数；
- client、grant 和 scope；
- policy、knowledge、identity 和排序版本；
- 最后排序键与签发时间。

任一版本变化时返回 `CURSOR_STALE`。游标不得被客户端解析或构造。

### 13.5 Tool 关键语义

- `search_knowledge`：空查询不转全库；策略过滤先于 rank、count 和分页。
- `get_knowledge_object`：只接受精确 `canonical_ref`。
- `get_related_knowledge`：明确 outgoing/incoming/both；both 以关系稳定身份去重。
- `get_source_evidence`：P0 强制 `include_excerpt=false`，只返回安全证据元数据。
- `get_knowledge_version`：不返回路径、主机名、用户名或数据库文件名。

---

## 14. 服务层与 Web API 边界

目标依赖方向：

```text
BaseKnowledgeRepository
      ↓
IdentityResolver / EvidenceResolver
      ↓
KnowledgeQueryService
      ↓
Web Adapter（按需） / MCP Adapter
```

`KnowledgeQueryService` 不知道 HTTP、MCP、OAuth 和前端状态。MCP Adapter 在查询前后执行 `AiExposurePolicy`，禁止通过前端隐藏字段代替授权过滤。

新 `/api/v1/knowledge/*` 不是 M1 必选项：

- 第一阶段直接对共享服务做黄金查询对照；
- 只有主界面存在明确消费者时才增加 Web Adapter；
- 若增加，必须复用现有 Web session/Host/Origin 安全边界；
- 不允许形成一个无需授权即可读取 AI 友好摘要的本地 HTTP 后门；
- 浏览器永不持有 MCP OAuth Token。

---

## 15. 审计、控制面与指标

### 15.1 独立控制面

控制面可保存 OAuth client、grant、token family verifier、撤销、策略同意、状态、锁和非内容审计元数据。它：

- 与用户库和基础库物理分离；
- 不 ATTACH 两个业务数据库；
- 不存原始 Token、查询正文和知识正文；
- 使用当前用户最小文件权限；
- 损坏或回滚时 fail closed，不自动恢复旧授权。

### 15.2 审计

查询指纹使用 `HMAC-SHA-256(period_key, normalized_query)`；period key 存入平台安全存储并定期轮换。允许记录 Tool、scope、返回数量、耗时、版本、结果和 correlation ID；禁止记录原始查询、正文、Token、redirect query、用户内容和绝对路径。

默认本地开启，保留建议为 30 天或 20 MiB，以先到者为准。用户可查看、导出、清除和关闭。写入失败进入 `audit_state=degraded`，不得转写用户库。

### 15.3 产品指标

P0 不默认上传遥测。首次启用成功率、授权完成率、错误恢复率和 Tool 成功率只能来自：

- 受控 `M0-T` 测试矩阵；或
- 用户明确选择导出的本地诊断统计；或
- 未来另行批准的匿名、可关闭遥测。

任何“成功率”都必须声明分母、客户端/OS版本和测量来源。未建立收集机制前不得作为发布宣传指标。

---

## 16. Gate 0 验收矩阵

### 16.1 M0-T：真实客户端

- ChatGPT Desktop 的本地 MCP 配置入口；
- Codex CLI；
- Codex IDE；
- macOS 与 Windows 当前目标版本；
- stable/dev 并存、自定义数据目录、升级和回滚。

记录每个客户端的发现路径、注册方式、callback 端口、PKCE、resource、audience、刷新、撤销、Origin、协议版本和实际工具调用。

### 16.2 M0-T：Runtime probe 零副作用

- synthetic user-store 目标不存在时不创建；存在 sentinel 时不打开、不修改；真实用户库不作为测试对象；
- synthetic user-store sentinel 和正式基础库路径 sentinel 不可读时，synthetic base fixture 查询仍可工作且没有打开尝试；
- import/export 不存在时不创建；
- synthetic base fixture 在只读文件系统上运行；
- 路径、URI、ATTACH 和 SQL 注入被拒绝；
- 只有明确控制面发生写入。

不得为验证这些断言改变真实用户库权限或把真实用户库作为测试目标。

### 16.3 M0-T：fixture 与数据策略

- fixture Schema、hash、唯一 ID、版本绑定和 `contains_real_data=false`；
- `fixture://` 命名空间、synthetic provenance 和真实路径/来源/凭据禁入检查通过；
- 缺失、损坏、过期或未知策略；
- 签名 key 未锚定、签名错误、manifest digest 不匹配；
- 未知对象/字段/关系；
- public 但 `ai_use_policy=deny`；
- internal/confidential/unknown；
- 关系一端被拒绝；
- 标准全文、excerpt、用户数据请求；
- 通过 count/rank/error/timing 探测隐藏对象；
- 知识文本包含提示词注入语句。

全部 fail closed。

### 16.4 M0-T：OAuth/TLS

- CIMD/DCR/预注册真实行为；
- loopback 临时 callback port；
- redirect exact match 与端口例外；
- PKCE 缺失/plain/verifier 错误；
- code 重放、超时和并发授权；
- CSRF、点击劫持、开放重定向；
- wrong resource/audience/scope/runtime/port；
- refresh reuse、单客户端/全部撤销；
- TLS 首装、拒绝、修复、更新、重置和卸载的隔离实验；
- 每安装实例 CA、CurrentUser 信任、签发后删除 CA 私钥和加密 PKCS#8 服务器私钥的决策记录；
- App/MCP 重启、端口变化和普通升级后证书指纹稳定；
- 到期前 60/30/7/0 天状态、原子切换、失败回滚和旧指纹精确删除；
- 私钥无未加密 PEM 落盘，口令不经 CLI、环境变量或日志；
- 信任库写入有当次授权、前后快照和清理/保留证据。
- 真实客户端配置或 OAuth 状态写入有当次授权、最小快照和恢复/保留证据。

### 16.5 M0-T：Runtime 与交互状态合同

- 用状态机和自动化模拟覆盖同 Runtime 双开、stable/dev、不同数据目录、旧版本、未知占用、stale lease 和 PID 复用；
- 模拟 App crash、Sidecar crash、状态 Schema 不兼容和授权事务超时；
- 冻结未启用、启动中、等待授权、已授权待用、近期已使用、空闲、知识阻断、审计降级和各错误态的状态与文案合同；
- 冻结 macOS 关闭窗口、Windows 关闭退出、授权置前和诊断迁移的交互说明。

`M0-T` 不要求制作正式设置页面，也不以生产双平台 UI、键盘、屏幕阅读器、200% 缩放或 reduced-motion 验收为 PASS 条件。这些属于 M3；若 M0-T 制作线框或交互原型，只用于合同评审。

### 16.6 D0-Pilot

- 资产 Schema 与唯一键可机器校验；
- 候选集绑定的 `MCP-DATA-POLICY-v1` candidate digest 与联合评审版本一致；
- 代表性候选集覆盖全部拟开放对象类型和 6.5 所列高风险内容；
- 每条候选具备来源/许可、敏感级别、AI 使用策略、内部审核和 digest；
- 不存在重复键不同 hash、未知来源、未审核或默认 allow；
- 候选输出与正式基础库、Runtime 和 package 隔离。

### 16.7 D0-Release

- 发布 allowlist 资产 100% 通过 Schema、来源/许可、审核、hash 和版本校验；
- 签名策略、摘要 manifest 与正式 base manifest digest 一致；
- 可重复生成、可回滚，且有产品、安全、数据 owner 和工程审批证据；
- 任何真实数据接入前单独通过受保护数据边界验收。

---

## 17. 分阶段路线

### Gate 0：并行双轨

#### M0-T：当前可批准执行的技术验证轨

交付：四份合同、synthetic fixture MCP、双平台真实客户端证据、TLS/key custody spike、OAuth 注册矩阵、`ReadOnlyRuntimeProbe` 零副作用证明、Tool Schema、状态机模拟和负向测试。

所有代码与证书均受 5.1 的隔离边界约束；不产生正式 Runtime、App UI 或交付包。

#### D0：需单独数据变更授权的内容就绪轨

- `D0-Pilot`：代表性候选摘要、Schema、来源/许可、审核和完整性合同；
- `D0-Release`：全量发布 allowlist、签名 manifest、可重复构建、正式审批和接入证据。

`D0` 可与 `M0-T` 并行，但不共享写权限，也不得借 `M0-T` 授权修改正式数据。

### M1：共享只读知识服务——未批准

前提：`M0-T=PASS`、`D0-Pilot=PASS`、四份合同冻结并经联合评审后取得新的实施授权。交付正式 `ReadOnlyRuntimeContext`、repositories、KnowledgeQueryService、identity/evidence/policy resolver 和黄金查询对照。

M1 可继续使用 fixture 或隔离候选资产；在 `D0-Release PASS` 前不得接入真实摘要。

### M2：MCP Sidecar——未批准

交付冻结的 Transport、Tools、OAuth、TLS、控制面、审计和状态。

### M3：App 集成——未批准

交付双平台 Supervisor、系统设置、连接引导、原生授权、状态入口和诊断迁移；在本阶段完成生产 UI、平台窗口行为、键盘、屏幕阅读器、200% 缩放和 reduced-motion 验收。

### M4：Codex 工作流——未批准

交付配置引导、source channel 规则、server instructions 和推荐提示词。

### M5：打包发布——未批准

前提包括 `D0-Release=PASS`。交付签名、公证、Windows 签名、证书/凭据升级保护、空白机/升级机/回滚/卸载矩阵和隐私说明。

---

## 18. 停止条件与完成定义

出现以下任一情况，`M0-T` 记为 `BLOCKED`，停止生产集成并回到技术方案评审：

- 目标客户端只能通过 HTTP 或长期明文 Token 连接；
- TLS 私钥必须落普通明文文件；
- MCP 无法保证不创建或打开用户库；
- 无法校验 resource/audience 或精确 redirect；
- 无法按客户端确认和撤销授权；
- 策略不能 fail closed；
- 无状态 Profile 与目标客户端不兼容；
- 多实例回收可能误杀其他进程；
- 产品文案无法准确表达同一 OS 用户权限边界。

出现以下任一情况，`D0` 对应级别记为 `BLOCKED`，不得让真实数据进入 Runtime 或发布：

- 无法证明摘要来源与许可依据；
- 审核主体不可追责；
- 摘要唯一键、hash、版本或 manifest digest 不能稳定绑定；
- 仍存在 `unknown`、`deny`、未审核、过期或默认 allow 资产；
- 候选工作区无法与正式基础库、用户库和交付包隔离。

完成定义分三层：

1. 只有 `M0-T=PASS`、`D0-Pilot=PASS`、四份合同冻结并取得产品/安全/工程新的联合授权，才允许创建 M1 正式实现计划。
2. 只有 `D0-Release=PASS` 并取得产品/安全/数据 owner/工程的正式数据接入授权，真实摘要才可进入 Runtime。
3. synthetic fixture 通过只证明技术与策略合同可执行，不证明任何真实 SAPD Wiki 内容可以开放。

在本文件成为正式工程门禁前，必须进入版本控制并关联审批记录。评审阶段可以保持未提交，但未跟踪文件不能被视为已经生效的发布合同。

---

## 19. 参考依据

### 工程证据

- `scripts/run_local_server.py`
- `scripts/check_bundle_runtime.py`
- `scripts/audit_stable_key_contract.mjs`
- `frontend/capability-browser/components/AppShell.js`
- `apps/macos/SAPDWiki/Sources/SAPDWiki/main.swift`
- `apps/electron/main.cjs`
- `docs/06-implementation/user-database-governance-and-stable-key-design.md`
- `docs/09-delivery/base-manifest-contract.md`

### 外部规范

- [OpenAI Codex MCP](https://learn.chatgpt.com/docs/extend/mcp?surface=cli)
- [MCP Authorization 2025-11-25](https://modelcontextprotocol.io/specification/2025-11-25/basic/authorization)
- [MCP Transports 2025-11-25](https://modelcontextprotocol.io/specification/2025-11-25/basic/transports)
- [RFC 8252: OAuth 2.0 for Native Apps](https://www.rfc-editor.org/info/rfc8252/)
- [Python `SSLContext.load_cert_chain`](https://docs.python.org/3/library/ssl.html#ssl.SSLContext.load_cert_chain)

规范和客户端均会演进。正式实现必须记录 MCP SDK、Codex、ChatGPT Desktop、操作系统和打包版本，并在升级后重跑兼容矩阵。
