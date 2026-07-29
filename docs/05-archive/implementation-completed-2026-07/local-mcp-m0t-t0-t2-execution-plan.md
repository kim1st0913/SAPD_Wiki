# SAPD Wiki 本地 MCP：M0-T T0–T2 执行计划

> 归档状态：`completed / superseded MCP execution plan`

| 项目 | 内容 |
|---|---|
| 状态 | `PROPOSED / AWAITING USER CONFIRMATION` |
| 日期 | 2026-07-23 |
| 权威设计 | `docs/01-architecture/sapd-wiki-local-mcp-requirements-and-prd-v0.5.md` |
| 跟踪问题 | `OI-199` |
| 已获评审结论 | PRD `PASS`；无新增技术 P0 |
| 本计划拟授权范围 | 治理前置 G0，以及串行执行 `T0 → T1 → T2` |
| 明确未授权 | T3、D0-Pilot、M1、真实数据、用户数据、App integration、packaging |
| 影响面 | 隔离技术验证；不接入 shared runtime、Web、App 或发布包 |

> 本文件是待用户确认的开发计划，不是执行授权。用户确认前不得创建合同、fixture、probe、监听端口、测试证书、分支提交或依赖环境。

---

## 1. 目标与完成边界

### 1.1 本轮目标

在完全隔离于生产 Runtime、正式数据和用户状态的前提下，完成：

1. `T0 Contracts & Fixtures`：四份机器合同、摘要/fixture Schema、synthetic 正负样本与可重复校验；
2. `T1 Runtime Probe`：证明 synthetic base 只读、UserStore 零访问、零业务目录副作用；
3. `T2 Protocol Harness`：证明 Streamable HTTP、OAuth 状态机、Tool、策略、限额和多实例合同在隔离 harness 中可执行。

### 1.2 本轮不是 M0-T 总体 PASS

T0–T2 完成后只能形成“隔离技术基线通过”的阶段结论，不能宣称：

- 真实 Codex 客户端兼容已通过；
- macOS/Windows 系统信任和密钥保管已通过；
- `D0-Pilot` 或 `D0-Release` 已通过；
- 正式 `ReadOnlyRuntimeContext`、Sidecar、App UI 或安装包可实施；
- M0-T 总体已经 PASS。

以上结论分别受 T3、D0、M1–M5 的独立门禁约束。

### 1.3 成功标准

- v0.5、审批记录和本计划已在独立分支形成纯文档基线提交；
- 所有 T0–T2 变更严格位于 v0.5 允许的三个目录；
- 三项评审 P1 已进入机器合同和自动负向测试；
- synthetic fixture、Runtime probe 和协议 harness 的 targeted tests 全部通过；
- 没有打开或生成真实用户库、正式基础库副本、业务目录、系统信任、真实客户端配置或 OAuth 状态；
- 没有私钥、口令、Token、绝对用户路径或真实知识内容进入 Git；
- 每阶段都有独立证据、停止条件和用户可复核的 PASS/BLOCKED 判定。

---

## 2. 当前工程事实与执行隔离

### 2.1 当前事实

- 当前 checkout 分支：`codex/windows-electron`；
- 当前 tracked base：`8b46b837965cc88c9dc5480f5537a67e237ac11a`；
- 当前工作树包含 Windows Electron、前端、治理文档等多组无关未提交修改；
- v0.5 当前仍为未跟踪文件；
- 根 `pyproject.toml` 只有 `openpyxl`，当前默认 Python/Node 环境没有 `mcp`、`jsonschema`、`rfc8785` 等验证依赖；
- 当前 `BundleRuntime` 会以 `mode=rwc` 打开用户库、迁移用户表并创建 import/export 业务目录，不能被 T1/T2 导入。

### 2.2 工作区策略

用户确认本计划后，先建立独立分支和 worktree：

```text
branch: codex/local-mcp-m0t
base:   8b46b837965cc88c9dc5480f5537a67e237ac11a
```

执行前重新核对 base；若 tracked HEAD 已变化，停止并比较差异，不自动换基线。

当前 dirty checkout 只作为只读来源。不得在其中提交、stash、reset、checkout 或覆盖任何现有用户修改。独立 worktree 仅复制经核对的 MCP 文档与后续允许文件。

### 2.3 唯一写入范围

治理前置 G0 可以写：

- `docs/01-architecture/sapd-wiki-local-mcp-requirements-and-prd-v0.5.md`；
- `docs/06-implementation/local-mcp-m0t-t0-t2-execution-plan.md`；
- `docs/07-governance/approvals/local-mcp-m0t-t0-t2-approval-2026-07-23.md`；
- 为索引上述文件所需的 `docs/README.md`、`CURRENT_STATE.md`、`findings.md`、`progress.md`、`docs/06-implementation/open-issues*.md`，且只能带入 MCP 相关最小 hunk。

T0–T2 只能写：

- `docs/01-architecture/contracts/mcp/**`；
- `tests/fixtures/mcp/**`；
- `spikes/local-mcp/**`。

以下均为写入禁区：

- `src/**`、现有 `scripts/run_local_server.py` 和其他生产脚本；
- `frontend/**`、`apps/**`、App Bridge、系统设置和打包配置；
- `data/**`、正式/候选 SQLite、源 Excel、正式 JSON 和 generated package；
- `~/.codex/config.toml`、ChatGPT Desktop/IDE 配置、Keychain、Windows Credential Manager、系统信任库；
- 用户库、用户导入/导出目录、真实诊断和真实 OAuth 状态。

---

## 3. G0：版本控制与审批记录

### 3.1 触发条件

仅在用户明确回复同意本计划后执行。

### 3.2 审批记录内容

新建：

`docs/07-governance/approvals/local-mcp-m0t-t0-t2-approval-2026-07-23.md`

至少记录：

- v0.5 文件 SHA-256、Git base、审批时间和审批来源；
- `Decision: PASS` 与“无新增技术 P0”；
- 允许范围：G0、T0、T1、T2；
- 禁止范围：T3、D0-Pilot、M1、真实/用户数据、App、packaging；
- 三项 P1 必须进入 T0 合同；
- 系统信任、真实客户端配置、真实 OAuth 状态仍需逐次授权；
- 用户对本执行计划的最终确认记录。

不得猜测审批人实名或组织角色；只记录可验证的会话事实。

### 3.3 纯文档基线提交

在独立 worktree 中只暂存 2.3 所列 G0 文档，先查看 staged diff，再创建单独提交：

```text
docs: approve local MCP M0-T T0-T2 plan
```

不使用 `git add .`，不提交当前 Windows/前端 dirty tree，不 push，不开 PR。

### 3.4 G0 PASS

- v0.5、计划、审批记录都由 Git 跟踪；
- 审批记录中的 v0.5 SHA-256 与 staged/committed 文件一致；
- commit 只包含获准文档；
- `git diff --check` 通过；
- 独立 worktree 无其他来源的修改。

任一项失败，不得进入 T0。

---

## 4. T0：Contracts & Fixtures

### 4.1 目标产物

建议目录：

```text
docs/01-architecture/contracts/mcp/v1/
├── README.md
├── contract-set.json
├── profiles/
│   ├── MCP-AUTH-v1.contract.json
│   ├── MCP-DATA-POLICY-v1.contract.json
│   ├── MCP-RUNTIME-STATE-v1.contract.json
│   └── MCP-PROTOCOL-TOOLS-v1.contract.json
└── schemas/
    ├── auth.schema.json
    ├── data-policy.schema.json
    ├── runtime-state.schema.json
    ├── protocol-tools.schema.json
    ├── fixture.schema.json
    └── public-summary.schema.json

tests/fixtures/mcp/v1/
├── manifest.json
├── synthetic-base-schema.sql
└── cases/*.json

spikes/local-mcp/
├── README.md
├── requirements-m0t.lock
├── tools/
│   ├── canonical_json.py
│   └── validate_contracts.py
├── tests/test_t0_contracts.py
└── evidence/t0-contract-report.json
```

不得提交二进制 SQLite、私钥、证书、Token、真实知识内容或真实对象 stable ref。

### 4.2 四份合同最小内容

#### MCP-AUTH-v1

- Protected Resource / Authorization Server discovery；
- 注册优先级：预注册 → CIMD → DCR；
- Authorization Code + PKCE S256；
- loopback callback 端口例外与完整 redirect 精确匹配；
- resource/audience/scope、opaque token、refresh rotation/reuse、撤销；
- 授权事务、超时、并发、拒绝和错误枚举。

#### MCP-DATA-POLICY-v1

- 对象、字段、关系、证据的显式 allow/deny；
- 未知类型和版本 fail closed；
- `public_summary / metadata_only / deny`；
- hidden endpoint、count/rank/error/timing 防泄漏；
- public summary 唯一键、hash、manifest digest 与 policy digest；
- `D0-Pilot` 与 `D0-Release` 状态机。

#### MCP-RUNTIME-STATE-v1

- desired/service/authorization/activity/knowledge/audit 六类状态；
- instance、lock、lease、port、crash、stale owner 与升级/回滚；
- TLS/key custody 候选与 BLOCKED 状态；
- T3 真实配置/系统信任的独立授权标志。

#### MCP-PROTOCOL-TOOLS-v1

- Streamable HTTP 无状态 Profile；
- `POST /mcp`、notification 202、GET/DELETE 405、无 `MCP-Session-Id`；
- initialize、协议版本、Origin/Host、取消、超时和并发；
- 五个只读 Tool、DTO、错误、游标和字符/byte/item 上限。

### 4.3 P1-1：fixture hash 与 ID 合同

T0 必须冻结以下算法，不留到实现者临时决定：

1. `fixture_id` 在整个 `tests/fixtures/mcp/**` 当前仓库快照内全局唯一；格式：

   ```text
   m0t.v<fixture-schema-major>.<case-class>.<slug>
   ```

2. 每条 fixture 必须有整数 `fixture_revision >= 1`。同一逻辑用例修正输入或期望时递增 revision；不得把既有 ID 改作其他 case class。
3. 所有字符串必须已经是 Unicode NFC；验证器遇到非 NFC 直接失败，不静默改写。
4. 数字只允许布尔值之外的整数，范围限制为 JavaScript safe integer；不允许 float、NaN 或 Infinity。
5. 计算 `fixture_hash` 时，复制完整 fixture 对象，只排除顶层 `fixture_hash`；没有其他排除字段，也不允许 `generated_at` 等易变字段。
6. 使用 RFC 8785 JSON Canonicalization Scheme 生成 UTF-8 bytes，再计算：

   ```text
   fixture_hash = "sha256:" + lowercase_hex(SHA-256(canonical_bytes))
   ```

7. `manifest.json` 按 `fixture_id` 排序，对 `{fixture_id, fixture_revision, fixture_hash}` 列表和四份合同 digest 计算 `fixture_set_hash`。
8. duplicate ID、hash 不匹配、ID/revision 回退或不同内容共用 hash 均硬失败。

### 4.4 P1-2：D0-Pilot 非空门禁

虽然本轮不执行 D0，T0 必须在 Schema 和语义校验中冻结：

- `pilot_candidates` 使用 `minItems: 1`；
- 拟开放 `public_summary` 对象类型集合为空时，D0-Pilot 只能是 `NOT_READY`，不得 PASS；
- 每个拟开放类型至少绑定一条候选摘要；
- 候选集绑定 `MCP-DATA-POLICY-v1` candidate digest；digest 变化后状态为 `STALE`；
- 当前正式内容为 0 不得被解释为空集合 PASS。

T0 只验证合同和 negative fixture，不生成任何候选摘要。

### 4.5 P1-3：T3 IPC BLOCKED 负向合同

T0 增加至少三条 negative fixture：

- `key-passphrase-ipc-unauthenticated`；
- `key-passphrase-ipc-peer-user-mismatch`；
- `key-passphrase-ipc-cross-user-readable`。

预期结果统一为：

```text
service_state=error
knowledge_state=blocked
secret_transport_state=blocked
error_code=KEY_PASSPHRASE_IPC_UNSAFE
```

允许状态只有 Sidecar 直接读取平台安全存储，或通过绑定 `instance_id`、验证 peer user/进程且最小 ACL 的认证私有 IPC 在内存中接收。T0/T2 只做合同与状态模拟，不传输真实口令。

### 4.6 依赖隔离

- 不修改根 `pyproject.toml`、`package.json` 或生产 lockfile；
- T0 在 `spikes/local-mcp/requirements-m0t.lock` 固定 JSON Schema、RFC 8785 和后续 MCP SDK 的确切版本与来源 hash；
- 依赖只安装到 spike 专用、Git 忽略的 virtualenv；
- 安装前记录包名、版本、来源和用途；若需要联网下载，按工具审批流程执行；
- 无法形成可重复 lock 时，T0 为 BLOCKED。

### 4.7 T0 验收

- 四份 profile 均通过对应 JSON Schema；
- Schema 自身通过目标 Draft meta-schema；
- fixture 全局 ID、revision、RFC 8785 hash、manifest digest 全部通过；
- PRD 要求的 public、metadata-only、deny、internal/confidential/unknown、隐藏关系、redirect、重名、超限、提示词注入、用户库陷阱等样本齐备；
- D0 空集合和 T3 IPC 三类负向样本按预期 BLOCKED；
- synthetic provenance、绝对路径/真实 source ref/凭据形态扫描通过；
- `evidence/t0-contract-report.json` 包含合同 digest、fixture 数量、case coverage、依赖版本和 PASS/BLOCKED。

---

## 5. T1：ReadOnlyRuntimeProbe

### 5.1 目标产物

```text
spikes/local-mcp/m0t/runtime_probe.py
spikes/local-mcp/m0t/build_synthetic_base.py
spikes/local-mcp/tests/test_t1_runtime_probe.py
spikes/local-mcp/evidence/t1-runtime-probe-report.json
```

synthetic SQLite 在测试时生成到本次专属临时目录，测试结束清理，不进 Git。

### 5.2 Probe 约束

- 只接受显式 synthetic base 路径与 test root；
- base URI 固定使用 `mode=ro&immutable=1`；
- 连接后立即执行 `PRAGMA query_only=ON`；
- `PRAGMA database_list` 只能存在 `main`，禁止 ATTACH；
- 不接受 user DB 参数，不解析 App 配置，不创建父目录；
- 不导入 `scripts.run_local_server`、`BundleRuntime`、`src.sapd_wiki.db.connect` 或任何 UserStore；
- 不读取 `data/**`，不使用真实 stable ref、对象标题或摘要；
- 日志只允许 synthetic fixture ID、计数、结果和 correlation ID，不记录绝对路径。

### 5.3 自动测试

- synthetic base 文件 hash 在 probe 前后完全一致；
- sqlite connect spy 只观察到一个 synthetic base `mode=ro&immutable=1` URI；
- synthetic user-store sentinel 不存在时不创建，存在且不可读时零打开尝试；
- 正式 base/user 路径 sentinel 被拒绝且零打开尝试；
- import/export、diagnostics、maturity 等业务目录前后快照一致；
- symlink escape、URI 注入、ATTACH、写语句、PRAGMA 写入、缺失文件和权限异常 fail closed；
- query、异常和关闭后无残留连接、锁、临时 DB 或 journal/WAL；
- `sys.modules` 与静态 import 检查确认没有生产 Runtime/UserStore 依赖。

### 5.4 T1 PASS

- 全部自动测试通过；
- synthetic base 只读与 UserStore 零访问证据完整；
- 没有真实数据读取、业务目录副作用或生产代码接线；
- 报告明确平台、Python/SQLite 版本、测试数量和未覆盖的 Windows 证据。

当前本机 T1 PASS 只能记为 `macOS local PASS / Windows pending`，不提升为 M0-T 总体 PASS。

---

## 6. T2：Protocol Harness

### 6.1 目标产物

```text
spikes/local-mcp/m0t/protocol_harness.py
spikes/local-mcp/m0t/oauth_harness.py
spikes/local-mcp/m0t/policy_engine.py
spikes/local-mcp/m0t/tool_handlers.py
spikes/local-mcp/m0t/runtime_state.py
spikes/local-mcp/m0t/test_certificate.py
spikes/local-mcp/tests/test_t2_transport.py
spikes/local-mcp/tests/test_t2_oauth.py
spikes/local-mcp/tests/test_t2_policy_tools.py
spikes/local-mcp/tests/test_t2_runtime_state.py
spikes/local-mcp/evidence/t2-protocol-harness-report.json
```

Harness 只能消费 T0 fixture 与 T1 probe，不允许导入或被生产代码导入。

### 6.2 HTTPS 与测试证书

- 仅绑定 `127.0.0.1`；默认验证 dev port `28775`，冲突时显式失败，不随机换端口；
- 测试证书和加密 PKCS#8（PEM 编码）私钥只生成到本次专属临时目录；
- 随机口令只经进程内存/匿名 stdin 交给测试工具，不进入 CLI 参数、环境变量、文件或日志；
- harness client 使用显式测试 CA 文件，不写 macOS/Windows 信任库；
- 结束后验证临时私钥、证书、口令引用和监听端口均已清理；
- Git contamination scan 发现任何 private key block 时立即 BLOCKED。

### 6.3 Transport

- `POST /mcp` 支持 JSON-RPC initialize、tools/list、tools/call；
- notification 成功返回 202；
- `GET /mcp`、`DELETE /mcp` 返回 405；
- 不发 `MCP-Session-Id`，不提供 SSE、resume 或 server notification；
- 校验 `MCP-Protocol-Version`、canonical Host 和精确 Origin；
- 缺失/错误 auth、超长 Header/body、并发、超时和取消 fail closed；
- 测试断连不等同取消，同 client 才能取消自身 request。

### 6.4 OAuth 状态机

- Protected Resource / Authorization Server metadata；
- 预注册、CIMD、DCR 优先级与 capability fixture；
- PKCE S256、授权事务、CSRF state、一次性 code、超时和重放；
- redirect URI 完整匹配与 loopback 临时端口规则；
- opaque access token、resource/audience/scope、refresh rotation/reuse 和撤销；
- Token、code、query、口令和 redirect query 不进入日志。

这是自有测试 client 的协议 harness，不修改真实 Codex/ChatGPT Desktop/IDE 配置，也不形成真实 OAuth credential。

### 6.5 Policy 与五个 Tool

- 只读取 synthetic base fixture；
- 实现五个只读 Tool 的 T0 Schema：search/object/related/evidence/version；
- DTO 显式构造，policy 过滤先于 rank/count/page；
- 未知对象/字段/关系、隐藏端点、deny/internal/confidential/unknown 全部 fail closed；
- 不存在与无权限统一 `OBJECT_NOT_AVAILABLE`；
- HMAC opaque cursor 绑定 client/grant/scope/policy/knowledge/identity/sort；
- item、字符、UTF-8 byte 和单字段上限均执行；
- 提示词注入内容只作为 `untrusted_reference` 返回，不能进入 Tool description 或 server instructions。

### 6.6 Runtime 与 T3 负向模拟

- 模拟 desired/service/authorization/activity/knowledge/audit 状态；
- 覆盖双开、stale lease、PID reuse、crash、版本不兼容和端口冲突；
- T0 的三类 unsafe key-passphrase IPC fixture 必须进入 `BLOCKED`；
- 不创建真实 IPC channel，不调用 Keychain/DPAPI，不传真实口令；
- 不实现生产 Supervisor、App Bridge 或设置 UI。

### 6.7 T2 PASS

- Transport、OAuth、Policy/Tool、Runtime 四组 targeted tests 全部通过；
- HTTPS 只使用临时测试 CA，系统信任前后无变化；
- 五个 Tool golden cases 与错误/限额/注入负向用例通过；
- 端口、进程、证书和临时目录无残留；
- 报告列出 MCP spec、SDK、Python/OpenSSL/SQLite 版本、用例数和未覆盖项；
- 明确结论为 self-client harness PASS，不宣称真实 Codex 或 Windows PASS。

---

## 7. 统一验证命令与证据

实现后以最终实际入口为准，计划中的命令形态为：

```bash
python3 spikes/local-mcp/tools/validate_contracts.py
python3 -m unittest discover -s spikes/local-mcp/tests -p 'test_t0_*.py'
python3 -m unittest discover -s spikes/local-mcp/tests -p 'test_t1_*.py'
python3 -m unittest discover -s spikes/local-mcp/tests -p 'test_t2_*.py'
git diff --check
```

另执行只读审计：

- 变更文件是否全部命中 G0/T0–T2 allowlist；
- 是否出现 `BEGIN ... PRIVATE KEY`、Token、口令、真实用户名/绝对路径；
- 是否新增 `.sqlite/.sqlite3/.db`、证书、Keychain/DPAPI 或客户端配置文件；
- 生产入口是否 import `spikes.local_mcp` 或等价路径；
- synthetic fixture 是否包含非 `fixture://` 标识或真实 source ref；
- 正式数据目录和真实用户库路径是否始终位于进程文件访问记录之外；不得为“证明未修改”而 stat、hash 或打开真实用户库。

每阶段报告至少包含：

```text
stage
status: PASS | BLOCKED
git_commit
contract_set_digest
fixture_set_hash
platform/runtime versions
tests passed/failed
side_effects observed
forbidden-boundary audit
known gaps
next authorized stage
```

---

## 8. 串行门禁与停止规则

```text
用户确认计划
  → G0 文档基线提交 PASS
  → T0 合同/fixture PASS
  → 用户查看 T0 checkpoint
  → T1 probe PASS
  → 用户查看 T1 checkpoint
  → T2 harness PASS
  → T0–T2 阶段总结
  → 停止，等待 T3 或 D0 的新授权
```

任何阶段出现以下情况立即停止：

- 需要改生产代码、根依赖、App 设置、真实客户端配置或系统信任；
- 需要读取/复制正式基础库或打开/导出真实用户库；
- 测试私钥、口令、Token、证书或真实知识内容将进入 Git；
- 无法隔离依赖或无法重现 contract/fixture digest；
- synthetic fixture 缺少来源证明或出现真实标识；
- D0 空集合可 PASS；
- unsafe IPC 未被判定 BLOCKED；
- T2 必须以 Session/SSE、HTTP 降级、长期 Token 或放宽策略才能通过；
- 当前 dirty checkout 与独立 worktree 出现并发写入或文件所有权重叠。

BLOCKED 时保留最小失败证据，不扩大授权、不进入下一阶段。

---

## 9. 提交策略

计划采用小而可审查的本地提交，不 push：

1. `docs: approve local MCP M0-T T0-T2 plan`
2. `test: freeze local MCP M0-T contracts and fixtures`
3. `test: add isolated local MCP readonly runtime probe`
4. `test: add isolated local MCP protocol harness`

每次提交前只暂存对应阶段 allowlist 文件，检查 staged diff 和敏感信息扫描。不得 amend、rebase 或整理现有 `codex/windows-electron` 分支历史。

---

## 10. 用户确认点

用户确认本计划时，将同时授权：

- 创建独立 `codex/local-mcp-m0t` 分支/worktree；
- 创建并提交 G0 审批记录与文档基线；
- 按 `T0 → T1 → T2` 串行实现、测试和创建本地阶段提交；
- 在 spike 专用隔离环境中安装已审计并锁定的测试依赖；
- 启动仅绑定 loopback 的 T2 临时 HTTPS harness，并生成/清理临时测试证书。

该确认不授权：

- push、PR、合并；
- T3 真实客户端配置、真实 OAuth 状态、Keychain/DPAPI 或系统信任；
- D0-Pilot 数据生成；
- M1、真实数据、用户数据、App integration 或 packaging。

计划获确认后，先执行 G0 并反馈其 commit、文件清单和审批记录 digest，再进入 T0。
