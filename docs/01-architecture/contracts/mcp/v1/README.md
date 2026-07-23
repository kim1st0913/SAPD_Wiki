# SAPD Wiki MCP M0-T v1 机器合同

本目录是 T0 的机器可读基线，覆盖：

- `MCP-AUTH-v1`
- `MCP-DATA-POLICY-v1`
- `MCP-RUNTIME-STATE-v1`
- `MCP-PROTOCOL-TOOLS-v1`

`contract-set.json` 绑定四份 profile 的 SHA-256、Schema Draft、依赖版本和跨合同规则。任何 profile 变化都必须同步 digest，并重新运行：

```bash
spikes/local-mcp/.venv/bin/python spikes/local-mcp/tools/validate_contracts.py
spikes/local-mcp/.venv/bin/python -m unittest discover -s spikes/local-mcp/tests -p 'test_t0_*.py'
```

此基线仅用于 synthetic fixture 和隔离 spike。它不授权 T3、D0 数据生成、M1、正式 Runtime、真实/用户数据、App integration 或 packaging。

## Fixture 完整性

- `fixture_id` 在仓库 `tests/fixtures/mcp/**` 内全局唯一；
- 字符串必须已是 Unicode NFC；
- 仅允许 JavaScript safe integer，不允许 float；
- hash 输入只排除顶层 `fixture_hash`；
- 使用 RFC 8785 JCS UTF-8 bytes 后计算 SHA-256；
- manifest 按 `fixture_id` 排序，并绑定四份 profile digest。

## D0 与密钥口令边界

T0 只冻结 D0-Pilot 非空门禁，不生成候选摘要。未认证、peer user 不匹配或跨用户可读的密钥口令 IPC 均必须进入 `KEY_PASSPHRASE_IPC_UNSAFE / BLOCKED`。
