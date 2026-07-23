# 本地 MCP 批次 B5：Web 真实闭环 PASS 报告

| 项目 | 结论 |
| --- | --- |
| 日期 | 2026-07-23 |
| 决策 | PASS |
| 分支 | `codex/local-mcp-web-integration` |
| 实现提交 | `aa51f78` |
| Web 入口 | `http://127.0.0.1:5173/` |
| MCP 地址 | `https://127.0.0.1:29875/mcp` |
| 当前 Codex 验证 | 未执行，等待 C1 单独授权 |

## 业务结论

5173 已经可以真实管理本地 MCP，而不是只展示模拟状态：

- 用户可在“系统设置 → AI 功能集成”启动、停止、重试和检查 MCP；
- 本地端口可在服务停止时修改，服务地址同步更新；
- 页面和顶部悬浮监测显示真实 MCP、客户端授权和 License 状态；
- 授权请求支持排队、允许、拒绝和超时，客户端可撤销；
- 系统设置保留“系统设置 / AI 功能集成”两个标签，上传路径未配置时明确显示“未配置”，不再误显示根目录 `/`；
- 页面返回按钮直接回到全局导航；
- MCP 失败或停止时，5173 主 Web 仍可使用。

## 真实协议闭环

工程自有测试客户端已完成：

1. 启动真实 Sidecar 和 loopback HTTPS；
2. 读取 OAuth/MCP discovery；
3. DCR、用户授权、PKCE 和 Token 交换；
4. `initialize`、`tools/list`；
5. 调用五项只读 Tool，并只返回 synthetic fixture；
6. Refresh Token 轮换、reuse detection；
7. 用户拒绝、1 秒测试超时、撤销和重新授权；
8. 停止服务并释放端口和临时 TLS 运行状态。

五项 Tool 为：

- `search_knowledge`
- `get_knowledge_object`
- `get_related_knowledge`
- `get_evidence`
- `get_knowledge_version`

## 安全与数据边界

- Sidecar 只绑定 `127.0.0.1`；
- TLS 私钥为加密 PKCS#8，测试客户端显式信任隔离 CA；
- 没有修改系统信任、当前 Codex 配置或真实 OAuth 凭据；
- 只加载 synthetic SQLite，不读取正式数据库、正式数据或用户内容；
- 5173 验收使用 `memory://isolated-web-dev` 临时内存状态，未打开或创建用户库文件；
- 测试过程中曾由旧 Web 默认行为创建的一个 `/private/tmp` synthetic 用户库文件已在进程关闭后删除，随后加入反回归测试；真实用户库始终未访问；
- 未进入 App、macOS/Windows 生产适配、Keychain/DPAPI、packaging、D0 或发布；
- 未 push、未创建 PR。

## 验证证据

自动化共 `89` 项通过：

| 测试组 | 数量 | 结果 |
| --- | ---: | --- |
| MCP Core | 24 | PASS |
| Policy Signature | 7 | PASS |
| Web Integration | 4 | PASS |
| Control API | 24 | PASS |
| Sidecar / OAuth / TLS | 29 | PASS |
| 真实 HTTPS/OAuth/MCP E2E | 1 | PASS |

附加检查：

- 控制合同 JSON 可解析；
- Python / JavaScript 语法检查通过；
- `audit_frontend_system_settings_contract.mjs` 通过；
- `git diff --check` 通过；
- 5173 宽屏与 `980×900` 窄屏均无横向溢出；
- 键盘 Enter 可执行“刷新状态”；
- 浏览器 console warning / error 为 0；
- 页面启停后 29875 无残留监听；
- synthetic 用户库 sentinel 文件不存在。

## 当前运行状态

5173 保持为隔离 Web 开发预览，MCP 当前为“已停止”，配置端口为 `29875`。这便于用户继续查看页面，同时避免后台保留测试 Sidecar。

## 下一门禁

批次 B 到此停止。下一步只能在用户单独批准 C1 后，修改当前 Codex 的 MCP 配置并进行真实客户端验证。C1 仍需明确配置快照、证书信任方案和结束后的保留/恢复方式。
