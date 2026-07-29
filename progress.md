# progress.md

> 状态：`active / recent milestones`
>
> 更新日期：2026-07-29

本页只保留最近的重要结果。完整执行记录从 `docs/05-archive/progress-history/` 和各专题归档进入。

## 2026-07-29

- `OI-191 / OI-192 关闭`：用户确认 demo 成熟度页面不再作为正式交付阻塞；共享标题区三条代表路由完成 `1280×720` 应用内 Browser 验收，两项进入关闭归档。
- `Keychain / macOS 交付权威文档冲突收口`：统一 `CURRENT_STATE.md`、`task_plan.md`、
  OI-199 和桌面打包手册为 0.3.0 最小修复后的当前事实，删除回退前 Native Security
  Broker、Data Protection Keychain、`app` profile 无 CLI 和正式签名门禁仍属现行
  方案的表述。App MCP `28776` 的既有运行态只记录为监听、授权和 Token 签发；用户
  裁定不单独验收，改为下一次从同一当前源码重建双 staging 后，在最新实包内完成
  OAuth、五工具和 `TOOL_CALL` 审计。同步实际 HEAD `c5d83e0362c3`；本轮只修改文档，
  未改源码、服务、Keychain、正式数据、用户库或构建产物。

## 2026-07-28

- `Keychain 最小修复回退`：按用户确认的事实恢复到 0.3.0 已验证可用路径，撤销
  Swift / Python Native Security Broker、匿名管道、Data Protection Keychain 接线、
  桌面 `app` profile 强制门禁，以及因本次故障扩展的 Developer ID / notarization
  实现；未改 OAuth、证书生命周期和五个只读工具。保留 macOS `/usr/bin/security`
  返回码 `36 / 51` 的 `SECRET_STORE_UNAVAILABLE` 分类、明确解锁提示、运行中 Sidecar
  不因临时锁定退出，以及解锁后的用户手动重试。回退前完整 tracked binary patch和
  四个新增文件已保存到
  `/private/tmp/sapd-keychain-minimal-rollback-20260728-MTkRpM/`。未操作真实 Keychain、
  现有 DMG、正式数据库或用户库。MCP 完整套件 `218 PASS / 5 SKIP`、最终证书 /
  Sidecar 专项 `33/33`、离线 bundle `2/2`、前端 AI 集成合同和 SwiftPM 编译均通过；
  DMG parity 的源码合同均通过，仍只被既有双 staging 前端不一致阻断。未检查 5173、
  未启动系统 Chrome、未构建 DMG。回退前 Native Broker、正式 profile 和签名 / 公证
  结果属于已撤销的中间状态，不再保留在当前近期进展页。
- `Web Keychain 恢复确认`：用户在 Terminal 交互解锁 `login.keychain-db` 后，Web 证书可以重新生成。
  `show-keychain-info` 恢复为 `no-timeout`，默认与搜索列表仍只有登录钥匙串；代码与
  系统日志均未发现 `lock-keychain`、修改钥匙串密码 / 设置或切换默认钥匙串操作。
  结论修订为后台 `/usr/bin/security` 安全会话认证丢失，而非钥匙串损坏。
- `Web 证书重建错误分类修复 PASS / 系统解锁后已恢复`：重置后
  `certificate_provision` 在 Keychain 写入口令阶段返回 `SECRET_WRITE_FAILED` 并完整
  回滚，未留下 active 证书或半成品信任。进一步只读检查确认默认与搜索列表均为
  `login.keychain-db`，但系统返回认证失败；一次性临时钥匙串写入 / 读取 / 删除成功，
  排除命令语法错误，测试钥匙串随后已删除。源码现将 macOS Keychain 返回码 `36 / 51`
  投影为可恢复 `SECRET_STORE_UNAVAILABLE / unlock_keychain`，控制面捕获该错误并显示
  明确解锁提示。证书专项与错误处理 `6/6`、Sidecar `66 PASS / 1 SKIP`、E2E `2/2`
  通过；5173 已重启到 PID `64172`，三项运行态检查通过。用户后续完成系统交互式
  解锁并成功重新生成证书；真实用户库和正式数据库未修改。
- `文档治理第五轮 PASS`：根 README、项目愿景和主架构说明已按当前安全能力、
  信息化环境、生命周期、知识 / 标准、成熟度、用户工作区、桌面交付和 MCP 业务版图
  重写；三份旧版完整归档。GitHub About 从空简介更新为本地优先、可追溯知识系统定位。
- `5173 稳定运行态 PASS`：PID `8060` 经项目守卫确认属于正式主工作区；没有终止或
  重启进程。home、health、workspace projection、stable runtime profile、正式基础库、
  内容资产库、用户库、数据根目录和 CurrentUser 持久 MCP Runtime 全部通过。
  `.venv-local-mcp-web` 保留端口单测 `13/13`，完整 runtime suite 通过；搜索、能力、
  环境、LC-AP、标准和成熟度 HTTP/API smoke 全绿。系统 Chrome 未启动。
- `文档治理第四轮 PASS`：早期导航、路线图、第一版数据模型、SQLite schema 草案、
  5-Sheet MVP、剩余 Sheet 建模和第一至第三批 ETL 合同 / 复核已归档。项目路线图、
  非开发者工作流和当前数据模型重写为现行口径；映射规则晋级为已实现合同。
- `quick 工程门禁核对`：static 与数据 / GitHub 边界检查通过；delivery parity
  仅因历史 license / no-license staging 前端不一致且最新 DMG staging 落后当前源码
  未通过。本轮未重建 DMG；下次 macOS 打包必须从同一当前源码重建两个 staging。
- `文档治理第三轮 PASS`：16 份旧实施、搜索、stable-key、ZIP 交付、前端基线和
  MCP 安全评审材料归档；`CURRENT_STATE.md` 从 268 行收敛为短恢复页，技术选型、
  用户指南和桌面交付口径更新为当前实现。

## 2026-07-27

- `文档治理第一、二轮 PASS`：建立文档状态、权威顺序、场景导航、归档索引和自动
  审计；退役交付 / 治理材料、完成计划、旧架构盘点和成熟度 V1 文档进入归档。
- `Windows 交付迁移 PASS`：公开 `main` 为源码事实源，私有 Delivery Data 和
  `windows-2022` Runner 生成、校验并上传完整 NSIS `Setup.exe`；旧
  `codex/windows-electron` 分支和 Mac 手工组装链路已删除 / 退役。
- `macOS 0.3.0 no-license DMG 历史构建快照`：该包此前通过后端、Swift App、DMG
  校验和空用户库模板检查，但当前 staging 已落后源码；新包需重建 license /
  no-license staging，证书、目标客户端 OAuth、首次保存路径、签名和 notarization
  仍按发布范围执行人工验收。
- `OI-198 PASS`：审批事务幂等、来源证据键复用、按 job finalize、恢复状态和
  latest-approved 默认导出实现并验证。
- `增量发布候选门禁 PASS`：release-id 驱动的
  `prepare / build / verify / apply / accept / rollback` 已建立；真实基线完成重复
  build 与 verify 并停在 `gated`，未执行新的正式 apply。
- `OI-197 等待用户裁定`：8 个名称漂移和 7 个无来源 Rubric 对象保持
  `PENDING_USER_DECISION`。

## 2026-07-26

- `基础内容统一查询 T0—T6 PASS`：正式双库、内容资产读取、MCP 五工具和恢复路径
  已建立；Draw.io 空页不再生成内容对象。
- `信息化环境主数据 P0—P8 Web PASS`：10 个环境、16 个子类类型、51 个对象，
  77 条定义和 125 条关联使用；App / DMG 结论按交付矩阵单独验收。
- `MCP Web 闭环 PASS`：TLS / OAuth、五工具、持久 Runtime、自动生命周期和
  refresh-token resource 兼容完成。

## 保护边界

- 上述文档治理和 5173 验收没有修改正式数据、源 Excel、真实用户业务数据或构建产物。
- 本轮没有 stage、commit 或 push；完整旧记录保存在
  `docs/05-archive/progress-history/progress-before-round-4-2026-07-28.md`。
