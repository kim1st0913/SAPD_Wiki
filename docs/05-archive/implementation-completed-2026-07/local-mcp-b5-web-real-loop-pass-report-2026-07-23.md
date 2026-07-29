# 本地 MCP 批次 B5：Web 真实闭环 PASS 报告

> 归档状态：`completed / MCP stage report`

| 项目 | 结论 |
| --- | --- |
| 日期 | 2026-07-23 |
| 决策 | PASS（协议闭环）；5173 隔离错误已补正 |
| 分支 | `codex/local-mcp-web-integration` |
| 实现提交 | `aa51f78` |
| 稳定 Web 入口 | `http://127.0.0.1:5173/`，只允许默认 stable Runtime |
| Synthetic Web 验收入口 | 必须使用非 5173 loopback 端口 |
| MCP 地址 | `https://127.0.0.1:29875/mcp` |
| 当前 Codex 验证 | 未执行，等待 C1 单独授权 |

## 业务结论

Web 控制面已经可以真实管理本地 MCP，而不是只展示模拟状态：

- 用户可在“系统设置 → AI 功能集成”启动、停止、重试和检查 MCP；
- 本地端口可在服务停止时修改，服务地址同步更新；
- 页面和顶部悬浮监测显示真实 MCP、客户端授权和 License 状态；
- 授权请求支持排队、允许、拒绝和超时，客户端可撤销；
- 系统设置保留“系统设置 / AI 功能集成”两个标签，上传路径未配置时明确显示“未配置”，不再误显示根目录 `/`；
- 页面返回按钮直接回到全局导航；
- MCP 失败或停止时，5173 stable 主 Web 仍可使用。

## 5173 隔离补正

原 B5 浏览器验收把 `dev + synthetic-base + ephemeral user state` 测试 Runtime 放在固定 5173，并在结束后留下该监听。这使稳定业务页面连接到 fixture Runtime，出现空数据、`invalid_object` 和 `missing_file`。协议和 synthetic 安全边界本身通过，但“5173 主 Web 仍可使用”的运行验收因此不成立。

现已补正：

- 停止遗留 synthetic 进程并恢复默认 stable 5173；
- `dev_server_guard.py` 在 stop/restart 前拒绝 5173 上的 fixture、dev、ephemeral 和自定义数据路径；
- 后端 `serve()` 同步拒绝绕过 guard 的直接 CLI；
- 相同 synthetic 配置在非 5173 端口仍允许；
- 负向测试确认拦截不会停止既有 stable 服务；
- stable 5173 的完整内容/API smoke 已重新通过。

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
- Synthetic Web 验收使用非 5173 loopback 端口和 `memory://isolated-web-dev` 临时内存状态，未打开或创建用户库文件；
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

5173 已恢复为稳定业务预览；MCP synthetic Runtime 当前为“已停止”，配置端口为 `29875`。后续 fixture/dev/ephemeral Web 验收必须使用非 5173 loopback 端口，结束时释放监听和临时 Sidecar。

## 下一门禁

批次 B 到此停止。下一步只能在用户单独批准 C1 后，修改当前 Codex 的 MCP 配置并进行真实客户端验证。C1 仍需明确配置快照、证书信任方案和结束后的保留/恢复方式。
