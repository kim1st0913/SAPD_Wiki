# SAPD Wiki 本地 MCP：证书与系统信任管理设计 v1

| 项目 | 内容 |
|---|---|
| 文档状态 | `方案一已确认 / 产品与工程设计基线 / 实施仍需单独授权` |
| 日期 | 2026-07-23 |
| 适用范围 | Web 人工开发验证、macOS App、Windows App |
| 上游基线 | `sapd-wiki-local-mcp-requirements-and-prd-v0.5.md`、`local-mcp-web-first-development-and-client-validation-plan-v0.2.md` |
| 已确认方案 | 每用户、每安装实例独立的 App 管理本地 CA；CurrentUser 信任；加密 PKCS#8 服务器私钥 |
| 非授权事项 | 本文不授权写入 Keychain、Windows 证书存储、Codex 配置，不授权 App、打包或真实数据接入 |

> 本文冻结本地 MCP 的证书产品体验、生命周期、状态合同和双平台所有权。它取代 PRD v0.5 第 9.2 节“仍需选择正式 TLS 方案”的未决状态，但不扩大当前代码和系统写入授权。

---

## 1. 决策摘要

### 1.1 已确认

1. 不再把“每次启动临时生成 CA”作为人工开发验证或正式 App 的目标行为。
2. Web 人工开发验证、macOS 和 Windows 使用同一证书生命周期合同：
   - 首次启用时生成；
   - App/MCP 重启、端口修改和普通版本升级时保持不变；
   - 临近到期时由用户确认更新；
   - 信任丢失时可以修复；
   - 重置 AI 集成时删除旧身份，并回到首次启用流程生成新身份。
3. 每个 OS 用户、安装实例和发布通道使用独立 CA，不跨用户、设备、stable/beta/dev 复用。
4. CA 公共证书只写入当前用户信任范围，不写系统全局信任。
5. CA 私钥只在首次签发服务器证书时短暂存在，签发完成后删除，不作为长期 CA 服务保存。
6. 服务器私钥以加密 PKCS#8 保存；随机解密口令由 macOS Keychain 或 Windows DPAPI CurrentUser 保管。
7. 不安装长期运行的 CA 服务，不把 `openssl ca` 包装成生产证书管理器。

### 1.2 用户问题的正式答复

| 问题 | 决策 |
|---|---|
| 设置中是否需要证书存储路径 | 显示只读“存储位置/信任范围”，不允许用户修改路径 |
| 是否显示证书到期与续期 | 必须显示有效期、剩余天数和更新动作 |
| 重置是否重新生成证书 | 重置先删除旧身份，再自动进入首次启用流程；仍需用户明确确认生成和信任新证书 |
| 首页状态是否显示有效期 | 顶部状态浮层必须显示证书状态、到期日和剩余天数 |
| 首次生成是否填写国家、组织等字段 | 不需要；字段由产品自动生成，避免把本机私有 CA 表述成公共或组织身份认证 |

---

## 2. 产品原则

### 2.1 用户面对的是“安全连接”，不是 PKI 管理台

主界面使用以下业务语言：

- 安全连接证书；
- 当前用户信任；
- 有效至；
- 更新证书；
- 修复安全连接；
- 查看证书详情。

主界面不使用：

- X.509 Distinguished Name；
- PKCS#8 路径；
- Root Store 注册表路径；
- Keychain access group；
- CA 私钥、PEM 口令或证书链调试字段。

技术信息只进入“查看证书详情”或脱敏诊断，不进入首次启用表单。

### 2.2 路径不是用户配置项

证书和密钥不跟随“App 保存位置”“文件上传路径”“文件下载路径”，也不允许用户选择同步盘、网络盘或普通业务目录。

AI 功能集成页面显示：

- macOS：`当前用户登录钥匙串 / SAPD Wiki 安全存储`；
- Windows：`当前用户证书存储 / SAPD Wiki 安全存储`；
- Web 开发：`SAPD Wiki Dev 当前用户安全存储`。

详情页可以显示只读逻辑位置和公有 CA 证书位置，但不得显示私钥口令、秘密引用或可复制的私钥路径。实际文件位置由平台适配器固定：

```text
macOS:
~/Library/Application Support/SAPD Wiki/security/mcp/{profile}/

Windows:
%LOCALAPPDATA%\SAPD Wiki\security\mcp\{profile}\

macOS Web Dev:
~/Library/Application Support/SAPD Wiki Dev/security/mcp/{profile}/
```

目录及文件使用当前用户最小权限，不进入项目 Git、业务数据目录、上传/下载目录和普通诊断包。

---

## 3. 证书身份与字段

### 3.1 CA 证书

每个安装实例自动生成：

```text
CN = SAPD Wiki Local CA {short_install_id}
```

开发 profile 使用：

```text
CN = SAPD Wiki Local Dev CA {short_install_id}
```

不要求用户填写国家、地区、公司、部门、邮箱或个人姓名。这些字段不能给本机私有 CA 增加公共可信度，反而会造成“正式机构认证”的错误理解。

CA 必须满足：

- `basicConstraints = CA:TRUE, pathLen:0`；
- `keyUsage = keyCertSign, cRLSign`；
- 随机序列号；
- SHA-256 或更强签名；
- 公共证书进入 CurrentUser 信任；
- CA 私钥在签发服务器证书后删除。

### 3.2 服务器证书

服务器身份固定为：

```text
Subject CN = 127.0.0.1
SAN IP = 127.0.0.1
Extended Key Usage = serverAuth
basicConstraints = CA:FALSE
```

端口不属于证书身份，用户修改端口不触发证书更新。除非目标客户端验证证明必须支持 `::1` 或 `localhost`，否则不扩大 SAN。

建议默认有效期：

- CA：5 年；
- 服务器证书：365 天；
- 到期前 60 天允许更新；
- 到期前 30 天进入“即将到期”；
- 到期前 7 天进入“需要尽快更新”；
- 到期后 MCP fail closed，不允许降级 HTTP 或跳过验证。

### 3.3 服务器私钥

- 只保存加密 PKCS#8；
- 文件位于 App 管理的固定安全目录；
- macOS 文件权限为当前用户可读写；
- Windows 使用当前用户最小 ACL；
- 随机口令由 Keychain/DPAPI CurrentUser 保管；
- 口令不得进入设置、环境变量、命令行、剪贴板、日志或诊断包；
- Sidecar 只在进程内取得口令，使用 `SSLContext.load_cert_chain(..., password=...)` 加载。

---

## 4. 生命周期

### 4.1 状态合同

| 状态 | 用户文案 | MCP 行为 | 主动作 |
|---|---|---|---|
| `not_configured` | 尚未建立安全连接 | 不启动 | 生成并信任证书 |
| `provisioning` | 正在建立安全连接 | 等待 | 无 |
| `valid` | 证书有效 | 可启动 | 查看详情 |
| `expiring` | 证书即将到期 | 可继续 | 更新证书 |
| `renewal_required` | 证书需要尽快更新 | 可继续并持续提示 | 更新证书 |
| `expired` | 证书已过期 | fail closed | 更新证书 |
| `trust_missing` | 当前用户信任缺失 | 不启动 | 修复安全连接 |
| `key_unavailable` | 安全密钥不可用 | 不启动 | 重新建立安全连接 |
| `rotating` | 正在更新证书 | 短暂停止/切换 | 无 |
| `error` | 安全连接异常 | 不启动 | 检查并修复 |

证书状态和 MCP 运行状态是两个独立维度，不得用“已启动”代替“证书有效”。

### 4.2 首次启用

用户首次点击“启动 MCP”而证书尚未配置时，先显示：

**标题：建立本机安全连接**

**说明：**

> SAPD Wiki 将为当前用户生成一套仅用于 `127.0.0.1` 的本机证书，并把公开 CA 证书加入当前用户信任。证书不会发送到第三方，不会写入系统全局信任，可以通过“重置 AI 集成”删除。

展示四项摘要：

1. 使用范围：当前用户；
2. 服务身份：`127.0.0.1`；
3. 默认有效期：服务器证书 365 天；
4. 删除方式：重置 AI 集成。

动作：

- 取消；
- **生成并信任证书**。

不增加国家、组织、邮箱、有效期或存储路径表单。平台系统弹窗承担最终信任确认；用户拒绝时保持 `not_configured`，MCP 不启动。

### 4.3 日常启动

普通 App/MCP 重启：

1. 校验证书指纹、有效期、SAN 和信任状态；
2. 从平台安全存储取得服务器私钥口令；
3. 验证通过后启动 Sidecar；
4. 任何一步失败均 fail closed，并给出单一恢复动作。

普通升级、端口修改和客户端重新授权不重新生成证书。

### 4.4 更新证书

证书“续期”在技术上是重新生成和替换，不修改原证书有效期。

用户点击“更新证书”后必须先提示：

> 更新会生成新的本机 CA 和服务器证书，MCP 将短暂停止；已授权客户端可能需要重新连接。旧证书只会在新证书验证成功后删除。

原子更新顺序：

1. 在 staging 安全目录生成新 CA、服务器证书和加密私钥；
2. 请求用户把新 CA 加入 CurrentUser 信任；
3. 验证新证书链、SAN、有效期和本机 HTTPS；
4. 停止当前 Sidecar；
5. 原子切换服务器身份并重新启动；
6. 完成健康检查和目标客户端连接检查；
7. 删除旧 CurrentUser 信任、旧证书、旧加密私钥和旧口令；
8. 写入轮换审计。

新身份验证失败时保留旧信任和旧身份并回滚；不得先删旧证书。

### 4.5 修复信任

若证书仍有效但 CurrentUser 信任缺失，“修复安全连接”只重新安装同一 CA 公共证书，不生成新证书。修复前后必须核对记录的 SHA-256 指纹。

若加密私钥或口令已损坏，不能伪装成信任修复，必须进入“重新建立安全连接”，执行完整更新流程。

### 4.6 重置 AI 集成

重置预览必须明确列出：

- 停止 MCP；
- 撤销全部客户端授权和 Token；
- 删除 App 管理的 CA 信任；
- 删除服务器证书、加密私钥和安全存储口令；
- 审计记录由用户选择保留或清除；
- 知识库内容、用户数据和 License 不受影响。

重置完成后状态变为 `not_configured`，并自动进入首次启用流程。默认主动作是“生成新证书并重新启用”，但不得在没有用户确认和系统信任确认时静默生成或安装新 CA。

---

## 5. “AI 功能集成”页面设计

页面继续使用现有“系统设置 / AI 功能集成”两级结构。内容顺序调整为：

1. 本地运行配置；
2. **安全连接证书**；
3. 待确认授权；
4. 客户端授权；
5. 隐私与审计；
6. 诊断与重置。

### 5.1 安全连接证书区

主区只显示用户决策需要的信息：

| 字段 | 示例 |
|---|---|
| 证书状态 | 有效 / 即将到期 / 需要修复 |
| 保护地址 | `127.0.0.1` |
| 信任范围 | 当前用户 |
| 存储位置 | 由 SAPD Wiki 和系统安全存储管理 |
| 有效期 | `2026-07-23 — 2027-07-23` |
| 剩余时间 | `剩余 365 天` |
| 最近更新 | `2026-07-23 21:30` |

动作按状态出现：

- 尚未配置：生成并信任证书；
- 有效：查看详情；
- 到期提醒：更新证书、查看详情；
- 信任缺失：修复安全连接、查看详情；
- 异常：检查并修复；
- 重置只保留在“诊断与重置”，不与普通证书动作并排。

“查看详情”可以显示：

- CA 名称；
- 服务器证书序列号；
- SHA-256 指纹；
- SAN；
- 签发时间、到期时间；
- profile/install id；
- 平台信任存储名称；
- App 管理状态。

不得显示私钥内容、口令、秘密引用和可编辑路径。

### 5.2 提示规则

- 正常有效期不使用大面积成功色；
- 30 天内使用低饱和 warning 状态；
- 7 天内和已过期提供清晰主动作；
- 错误文案不显示堆栈、OpenSSL 命令或 Keychain/注册表内部错误码；
- 技术错误进入脱敏诊断。

---

## 6. 顶部状态浮层

现有悬浮状态入口增加“安全证书”，顺序为：

1. MCP 服务；
2. 客户端授权；
3. 安全证书；
4. License 授权。

证书行始终显示：

```text
安全证书
有效至 2027-07-23 · 剩余 365 天
```

状态变化：

- `valid`：中性“有效”；
- `expiring`：提示“即将到期”；
- `renewal_required`：提示“需要更新”；
- `expired/trust_missing/key_unavailable/error`：提示“需要处理”。

点击证书行进入：

```text
#/settings/ai-integration
```

并定位到“安全连接证书”区。浮层支持 hover、focus 和键盘进入；状态不能只依赖颜色。

全局状态圆点采用最高优先级：

```text
证书过期/信任缺失
> MCP 运行错误
> License 无效
> 证书即将到期
> 待确认客户端授权
> 正常
```

---

## 7. 控制 API 与安全投影

控制面增加只读 `certificate` 投影：

```json
{
  "state": "valid",
  "managed_by_app": true,
  "profile": "dev",
  "subject": "127.0.0.1",
  "san": ["127.0.0.1"],
  "ca_display_name": "SAPD Wiki Local Dev CA A1B2C3D4",
  "fingerprint_sha256": "AA:BB:...",
  "valid_from": "2026-07-23T00:00:00Z",
  "valid_until": "2027-07-23T00:00:00Z",
  "remaining_days": 365,
  "trust_scope": "current_user",
  "storage_backend": "macos_keychain",
  "last_rotated_at": "2026-07-23T00:00:00Z",
  "next_action": null
}
```

不得投影：

- 私钥路径；
- 私钥内容；
- 解密口令；
- Keychain/DPAPI secret reference；
- 原始平台错误堆栈。

控制能力增加：

```text
certificate_provision
certificate_renew
certificate_repair_trust
certificate_view_details
certificate_reset
```

所有变更动作继续使用 `request_id + expected_state_version`、显式确认、幂等处理和审计。

---

## 8. 平台一致性

一致的是业务合同、证书 profile、状态机、页面字段、审计和回滚；平台 API 不要求相同。

| 能力 | Web 人工开发 | macOS | Windows |
|---|---|---|---|
| CA/服务器证书生成 | 共享 Python `cryptography` | 共享 Python `cryptography` | 共享 Python `cryptography` |
| CA 公共信任 | 当前用户 Dev trust adapter | Security Framework / 登录钥匙串 | CurrentUser Root store |
| 服务器私钥 | 加密 PKCS#8 | 加密 PKCS#8 | 加密 PKCS#8 |
| 口令保管 | 开发专用安全适配，不进入环境变量 | Keychain | DPAPI CurrentUser |
| 信任确认 | 明确开发确认 | 系统用户确认 | CurrentUser 安装确认 |
| 删除 | 精确指纹 | 精确指纹移除信任和秘密 | 精确指纹移除证书和秘密 |

自动化测试继续使用临时 CA 和显式客户端信任，不写系统状态。它验证相同合同，但不冒充人工开发或打包验收。

---

## 9. 不采用的方案

### 9.1 `openssl ca` 生产包装

OpenSSL CLI 可以用于诊断、查看和测试证书，但不作为产品生命周期所有者。正式实现继续使用库 API 生成证书，平台原生 API 管理信任。

### 9.2 长期运行的 CA 服务

首版不安装后台 CA 服务。CA 只在首次签发或更新时短暂出现；长期服务会扩大高权限攻击面、升级和卸载复杂度。

### 9.3 打包共享 CA/共享私钥

禁止把同一 CA、服务器私钥或口令放入 DMG、Windows 安装包或 Git。每个安装实例必须独立生成。

### 9.4 公共 CA

公共 CA 不能为保留地址 `127.0.0.1` 提供本产品所需的公开信任证书，也不符合离线、本机和无第三方依赖目标。

### 9.5 仅依赖客户端自定义 CA

`CODEX_CA_CERTIFICATE` 等客户端私有 CA 配置保留为 CLI/测试兼容路径，不作为默认产品体验，也不能替代双平台 CurrentUser 信任生命周期。

---

## 10. 验收矩阵

### 10.1 生成与持久性

- 首次启用前无 App 管理 CA；
- 用户确认后只增加当前用户信任；
- 重启 App、MCP 和修改端口后 CA/服务器证书指纹不变；
- 不同用户、安装实例和 profile 的指纹不同；
- CA 私钥在签发后不存在；
- 服务器私钥只以加密 PKCS#8 存在。

### 10.2 状态与交互

- AI 功能集成页显示状态、有效期、剩余天数、信任范围和恢复动作；
- 顶部状态浮层显示证书到期日；
- 60/30/7/0 天阈值状态正确；
- 首次启用无 DN、路径或有效期输入表单；
- hover、focus、键盘和 200% 缩放可用；
- Web 与 App 文案、状态和动作语义一致。

### 10.3 更新与回滚

- 新证书验证成功前不删除旧信任；
- 用户拒绝新信任时旧服务可恢复；
- 切换失败时回滚旧证书；
- 成功后只删除记录指纹对应的旧证书和秘密；
- 过期时 fail closed，不降级 HTTP。

### 10.4 重置与卸载

- 重置预览列出全部影响；
- 重置不修改知识库、用户数据和 License；
- 重置后旧 CA、服务器证书、私钥、口令和 OAuth grant 不残留；
- 重新启用必须再次明确确认；
- 卸载说明提供“重置 AI 集成”入口和残留检查。

---

## 11. 后续执行顺序

在真实 Codex C1 之前新增证书产品化门禁：

```text
C0-1 证书合同与状态 Schema
→ C0-2 Web Dev 稳定证书管理器
→ C0-3 当前用户信任生成/修复/更新/重置
→ C0-4 AI 功能集成与顶部状态
→ C0-5 证书生命周期自动化与人工验收
→ C1 当前 Codex 真实连接
→ D1 macOS 生产适配
→ D2 Windows 生产适配
→ E 双平台打包
```

C0 实施、CurrentUser 信任写入和真实 Codex 配置仍需用户单独授权。

---

## 12. 参考依据

- `src/sapd_wiki/local_mcp/dev_tls.py`
- `src/sapd_wiki/local_mcp/dev_supervisor.py`
- `src/sapd_wiki/local_mcp/control_service.py`
- `frontend/capability-browser/components/SystemSettings.js`
- `sapd-wiki-local-mcp-requirements-and-prd-v0.5.md`
- Apple Security Framework Trust Settings：<https://developer.apple.com/documentation/security/sectrustsettingssettrustsettings%28_%3A_%3A_%3A%29>
- Windows CurrentUser Certificate Store：<https://learn.microsoft.com/en-us/windows-hardware/drivers/install/local-machine-and-current-user-certificate-stores>
- Windows DPAPI：<https://learn.microsoft.com/en-us/windows/win32/api/dpapi/nf-dpapi-cryptprotectdata>
- Python `SSLContext.load_cert_chain`：<https://docs.python.org/3.12/library/ssl.html>
- OpenSSL `openssl-ca` production warning：<https://docs.openssl.org/master/man1/openssl-ca/>
- CA/Browser Forum reserved IP rule：<https://cabforum.org/working-groups/server/baseline-requirements/requirements/>
- MCP Streamable HTTP security：<https://modelcontextprotocol.io/specification/2025-06-18/basic/transports>
