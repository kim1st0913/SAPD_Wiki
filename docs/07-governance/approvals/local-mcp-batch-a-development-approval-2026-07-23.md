# Local MCP 批次 A 开发审批记录

## 1. 审批结论

- 日期：2026-07-23
- 审批来源：当前 Codex 任务中的用户明确确认
- Decision：`APPROVED`
- 计划：`docs/06-implementation/local-mcp-product-development-and-client-validation-plan-v0.1.md`
- 计划 SHA-256：`15cb88886567ad355a9891a73b8fc8001b98dcbb04003cedc05b8866b9cd5cc4`
- 门禁补充：`docs/01-architecture/sapd-wiki-local-mcp-development-gate-addendum-v0.6.md`
- 门禁补充 SHA-256：`f3c06ed7782f48c078730e65c8efef37fe20a3945c24972bdb478dd4021e4c7c`
- 执行分支：`codex/local-mcp-product-development`
- Git base：`0286a24c6f49de842a4aa8f6f37ec79bbe80f91d`
- 远程操作：不授权 push、PR、merge

本记录只保存可验证的会话事实，不推断审批人实名、组织或角色。

## 2. 已完成基线

- T0：合同、Schema 和 synthetic fixture `6/6 PASS`
- T1：只读 Runtime probe `13/13 PASS`
- T2：协议、TLS/OAuth 和五 Tool harness `34/34 PASS`
- 合并回归：`53/53 PASS`
- 真实/用户数据访问：0
- 系统信任修改：0
- 真实客户端配置修改：0
- push 或远程状态修改：0

## 3. 本次明确授权

1. P0：版本化开发门禁补充决策、执行计划和审批记录，建立独立正式开发分支和干净基线。
2. D1：正式只读知识服务及 synthetic-only 测试。
3. D2：正式 MCP Sidecar、Transport、OAuth/TLS、Tool、控制面、状态和审计代码。
4. D3：Web/App 共用的本地 MCP 状态与控制 API。
5. D4：Web“系统设置 → AI 集成”完整功能。
6. D5：macOS/Windows Supervisor 和安全桥接代码及隔离测试。
7. D6：自动化、浏览器、数据边界、恢复和开发完成门禁。
8. 独立 worktree、隔离依赖、临时 synthetic SQLite、测试证书和本地阶段提交。

## 4. 明确未授权

- push、PR、merge 或远程状态修改；
- 用户本机真实 Codex/ChatGPT/IDE 配置修改；
- macOS Keychain 信任、Windows CurrentUser 证书存储或其他系统信任写入；
- 真实 OAuth 授权、真实 token 或真实客户端状态；
- D0-Pilot、D0-Release、真实摘要、正式数据和用户数据；
- 用户库读取、复制、迁移或修改；
- App packaging、签名、公证、安装包或发布。

## 5. 用户确认

用户在当前任务中明确回复：

> 确认按 v0.1 执行批次 A。

该确认只授权第 3 节范围，不覆盖第 4 节禁止项。D6 通过后必须停止，用户本机验证和兼容矩阵需要新的明确授权。
