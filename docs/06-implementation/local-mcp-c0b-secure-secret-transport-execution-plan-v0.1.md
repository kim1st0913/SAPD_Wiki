# 本地 MCP C0-B：安全秘密传递执行计划 v0.1

| 项目 | 内容 |
|---|---|
| 状态 | `PASS / READY FOR MANUAL WEB UAT` |
| 日期 | 2026-07-24 |
| 上游 | MCP 整体开发计划 v0.5、证书产品化 C0-3 |
| 前置 | C0-A 证书合同、稳定身份核心、模拟 CurrentUser 信任和前端已通过 |
| 影响面 | Web MCP shared runtime；不写真实平台秘密或系统信任 |

## 目标

把 C0-A 的稳定证书身份接入 Web Sidecar。父控制进程保管证书口令，Sidecar
只能通过一次性、实例绑定的匿名进程通道消费口令，不得自行生成长期证书或修改信任。

## 本批交付

1. fake-first 的平台秘密保管合同，绑定 install/profile/generation/device；
2. 双向一次性匿名通道，完成 challenge、子进程身份回执和单帧秘密交付；
3. 稳定证书 chain、加密 PKCS#8 与口令接入 Sidecar；
4. `KEY_PASSPHRASE_IPC_UNSAFE` fail-closed 状态；
5. 跨用户、错误进程、错误 generation、nonce、非匿名端点和重放负向矩阵；
6. 口令不进入 argv、环境变量、普通文件、日志、控制 API 或前端；
7. MCP 全套回归与 5173 Web 闭环验证。

## 明确不在本批

- 真实 macOS Keychain 或 Windows DPAPI 写入；
- macOS / Windows CurrentUser 系统信任写入；
- 当前 Codex 配置、真实客户端授权；
- App、DMG、Windows 安装包；
- 正式数据、用户数据、push 或发布。

## 验收

- 未建立或不可验证证书身份时 Sidecar 不启动；
- 正确父子进程、同用户、同 generation 和同 nonce 时只交付一次；
- 任一身份或协议不匹配均返回 `KEY_PASSPHRASE_IPC_UNSAFE`，且端口不监听；
- 同一 Web 进程内 MCP 重启继续使用同一证书指纹；
- Sidecar 启动参数、环境、日志和公开状态中秘密哨兵为 0；
- 现有 HTTPS、OAuth、五项 Tool、撤销、停止和重置回归通过。

## 当前进度

- [x] C0-3 差距与攻击面复核
- [x] 一次性匿名通道与 fake secret custody
- [x] 稳定身份接入 Sidecar
- [x] 安全负向矩阵
- [x] MCP 全套回归
- [x] 5173 人工测试入口

## 执行结果

- 父进程只在子进程完成 PID、UID、nonce、generation 和父进程身份回执后读取口令；
- 口令只经继承的匿名本地通道传递，子进程单次消费后清理可变缓冲；
- Sidecar 不再生成启动期临时证书，停止和再次启动继续使用同一 CA 指纹；
- 不安全通道统一 fail closed 为 `KEY_PASSPHRASE_IPC_UNSAFE`，且不建立监听；
- 密钥哨兵与 secret reference 在 argv、环境、日志、lease 和控制快照中均为 `0`；
- `node scripts/run_project_test_suite.mjs --suite mcp` 通过：Python `126` 项及系统设置前端合同审计全部通过；
- 5173 页面通过“建立本机安全连接 → 启动 MCP → loopback TLS 正常 → 停止 MCP”，停止后证书仍为有效状态，console warning / error 为 `0`。

## 当前边界

- macOS Keychain、Windows DPAPI 和两平台 CurrentUser 信任仍是 fake-first 合同，没有真实系统写入；
- Web 开发身份只保证同一 Web 父进程内的启停稳定；跨 App 重启持久化等待平台适配；
- 当前未配置真实 Codex，未执行真实客户端授权，未接入 App 或安装包。
