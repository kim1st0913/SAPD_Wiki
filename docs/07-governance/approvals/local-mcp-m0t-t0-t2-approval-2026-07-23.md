# Local MCP M0-T T0–T2 审批记录

## 1. 审批结论

- 日期：2026-07-23
- 审批来源：当前 Codex 任务中的用户明确确认
- Decision：`PASS`
- P0 blockers：无新增技术 P0
- 可开始范围：治理前置 `G0`，随后串行执行 `T0 → T1 → T2`
- 远程操作：不授权 push、PR 或 merge

本记录只保存可验证的会话事实，不推断审批人实名、组织或角色。

## 2. 受控基线

- Git base：`8b46b837965cc88c9dc5480f5537a67e237ac11a`
- 执行分支：`codex/local-mcp-m0t`
- 独立 worktree：`/private/tmp/SAPD_Wiki-local-mcp-m0t`
- PRD：`docs/01-architecture/sapd-wiki-local-mcp-requirements-and-prd-v0.5.md`
- PRD SHA-256：`c1661b9950458c3b5adb94fde889623107a2b39c84ace22f2865b9cd6121cf21`
- 执行计划：`docs/06-implementation/local-mcp-m0t-t0-t2-execution-plan.md`
- 获批执行计划快照 SHA-256：`099fbda9acbef55481cc4920c2139b6f335b7cb74f9c4c0e2692f667a064601c`

PRD 已作为 M0 评审基线通过。它不能单独扩大本审批记录的授权范围；实现必须同时满足执行计划和本记录。

## 3. 明确授权

1. 创建并使用独立 worktree 和 `codex/local-mcp-m0t` 本地分支。
2. 创建 G0 纯文档基线提交，以及 T0、T1、T2 的本地阶段提交。
3. 在 `spikes/local-mcp/**` 内使用隔离测试依赖。
4. T2 使用测试证书和临时 loopback HTTPS；不得写入系统信任库。
5. T0–T2 只使用版本化、无真实敏感内容的 synthetic fixture 和临时 synthetic SQLite。

## 4. 明确未授权

- push、PR、merge 或修改任何远程状态；
- T3 的真实客户端配置、系统信任库修改、真实 OAuth 或真实密钥传递；
- D0-Pilot / D0-Release 数据生成、候选摘要生成或正式摘要资产接入；
- M1 或任何正式 Runtime、Sidecar、App 设置、App integration、packaging；
- 读取、复制、迁移或修改正式数据、用户数据、真实用户数据库；
- 修改 Web/App 生产启动路径、根依赖或交付包。

上述事项必须另行取得明确授权。

## 5. T0 必须固化的 P1

### 5.1 Fixture 哈希与唯一性

- 冻结 `fixture_hash` 的规范化算法、唯一允许排除的字段以及 `fixture_id` 唯一性范围；
- `fixture_id` 在仓库 `tests/fixtures/mcp/**` 范围全局唯一；
- 顶层仅排除 `fixture_hash`，其他字段不得被隐式排除；
- 使用 RFC 8785 JCS canonical bytes 和 SHA-256 小写十六进制；
- 重复 ID、hash 不一致和 revision 回退必须硬失败。

### 5.2 D0-Pilot 非空门禁

- 候选集合必须非空；
- 拟开放类型集合为空时只能是 `NOT_READY`，不得 `PASS`；
- T0 只固化 Schema、状态机和负向 fixture，不生成 D0 数据。

### 5.3 Unsafe IPC 必须 BLOCKED

以下负向用例必须固化：

- `key-passphrase-ipc-unauthenticated`
- `key-passphrase-ipc-peer-user-mismatch`
- `key-passphrase-ipc-cross-user-readable`

预期统一为：

```text
service_state=error
knowledge_state=blocked
secret_transport_state=blocked
error_code=KEY_PASSPHRASE_IPC_UNSAFE
```

T0/T2 只做合同与状态模拟，不创建真实 IPC channel，不传输真实密钥口令。

## 6. 用户最终确认

用户在当前任务中明确回复：

> 确认按计划执行 T0–T2。这将授权独立 worktree、本地阶段提交、隔离测试依赖和临时 loopback HTTPS，但不授权 push、T3、D0-Pilot、M1、真实数据、用户数据、App 或打包。

该确认只授权本记录第 3 节列出的范围，不覆盖第 4 节禁止项。
