# Local MCP M0-T isolated spike

该目录只承载 G0 已授权的 T0–T2 隔离技术验证，不被任何生产入口导入。

边界：

- 只使用 `tests/fixtures/mcp/**` 和运行时临时生成的 synthetic SQLite；
- 不导入 `BundleRuntime`、`src/**`、App Bridge 或现有生产脚本；
- 不读取或创建真实用户库，不创建 import/export 等业务目录；
- 不修改 Codex/ChatGPT Desktop 配置、系统信任库、Keychain/DPAPI；
- 测试证书、私钥、Token 和临时库不得提交。

隔离环境：

```bash
python3 -m venv spikes/local-mcp/.venv
spikes/local-mcp/.venv/bin/python -m pip install \
  --no-index \
  --find-links /private/tmp/sapd-m0t-wheels-20260723 \
  --require-hashes \
  -r spikes/local-mcp/requirements-m0t.lock
```

`requirements-m0t.lock` 当前冻结 Python 3.14 / macOS arm64 的 T0–T2 spike 依赖。Windows 实机与真实客户端验证属于 T3，不由本锁文件宣称通过。
