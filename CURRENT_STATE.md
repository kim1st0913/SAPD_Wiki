# CURRENT_STATE: SAPD Wiki

> 状态：`active / primary recovery entry`
>
> 更新日期：2026-07-29

本页只保留恢复工作所需的当前事实、保护边界、风险和下一步。详细执行历史从 `progress.md` 和 `docs/05-archive/README.md` 进入。

## 1. Git 与工作区

- 当前分支：`main`
- 当前 HEAD：`c5d83e0362c3`
- 2026-07-29 只读核对：`main` 与 `origin/main` 为 `0 / 0`
- 工作树仍为 dirty；包含文档治理五轮改动，以及此前已有的 App、前端、脚本、
  `data/`、生成资产和 Sites 改动
- 未对本轮文档治理执行 stage、commit 或 push
- `data/`、SQLite、恢复包、DMG、Setup、虚拟环境、`node_modules` 和构建产物不得
  进入 Git

旧 `codex/windows-electron` 本地和远端分支已经删除，不得恢复为日常生产分支。

## 2. 当前产品状态

### 知识与数据

- 基础内容统一查询 T0—T6 已正式应用；Draw.io 空页不再生成内容对象
- 当前正式内容口径为 9 个文档、609 个片段、684 条内容关系和 1,302 条内容证据
- OI-198 导入审批幂等、任务终结、approved 默认导出和正式写入门禁已实现并验证
- 增量发布链路已具备 `prepare / build / verify / apply / accept / rollback`
- 当前增量发布状态为 `gated`；没有新发布授权时不得写正式查询库或资产库
- 信息化环境主数据 P0—P8 已完成 Web 验收：10 个环境、16 个子类类型、51 个对象，
  共 77 条定义和 125 条关联使用

正式数据、源 Excel、真实用户库、评分规则和 ETL 只有在新请求明确授权并给出备份 /
恢复路径后才能修改。

### 成熟度

- V2.1 需求、领域模型、数据模型和模板映射是当前合同
- OI-197 仍等待用户完成 15 项 Rubric 业务裁定：8 个名称漂移、7 个无来源
- 15 项全部裁定前，不得写 Rubric 字典、评分规则、源 Excel 或正式成熟度数据

### MCP

- MCP Web 五工具、TLS / OAuth、CurrentUser 持久 Runtime、refresh-token 兼容、
  自动生命周期和受控基础知识访问均已实现
- 2026-07-28 已修复 macOS 安全存储临时不可访问被误判为密钥永久丢失的问题：
  运行中的 Sidecar 不再因锁屏期间的临时读取失败被终止，未运行服务会在安全存储恢复后
  由用户重新启动；真实条目缺失仍保持 fail closed
- Web 证书重建曾因 `login.keychain-db` 返回 `36 / 51` 自动回滚，现已分类为可恢复的
  `SECRET_STORE_UNAVAILABLE`；用户交互解锁后恢复，确认是 CLI 安全会话而非钥匙串损坏
- 5173 正式工作区的 home、health、workspace projection、正式双库 / 用户库路径、
  数据根目录、持久 Runtime 和保留端口单测均通过；系统 Chrome 未启动

### macOS / Windows 交付

- macOS 保留正式 Mac 主工作区本地打 DMG；0.3.0 no-license DMG 仅是历史构建快照
- 用户确认当前已安装的 0.3.0 在交互解锁 `login.keychain-db` 后，原证书、OAuth 和
  MCP 链路可以恢复；没有证据表明最初故障是证书损坏或口令永久丢失
- 2026-07-28 quick 门禁确认历史 license / no-license staging 前端不一致，且最新
  DMG staging 落后当前源码；下次新包必须从同一当前源码重建两个 staging
- 2026-07-28 已按用户要求回退 Native Security Broker、Data Protection Keychain
  接线、桌面 `app` profile 强制门禁及因本次故障扩展的签名 / 公证实现，恢复 0.3.0
  使用的 `/usr/bin/security` 登录钥匙串路径；只保留 `36 / 51` 临时错误分类、解锁提示、
  运行中 Sidecar 保持和解锁后手动重试
- App MCP `28776` 的既有运行态已确认监听、授权和 Token 签发，但没有用当前最新源码
  重新打包，也未完成实包内五工具与 `TOOL_CALL` 审计；该项并入下一次最新 DMG 验收，
  不以现有安装包或 Web `28775` 代替
- 未完成签名 / notarization、证书、OAuth 和首次路径人工 UAT 时，不得宣称正式外部分发
- Windows 以公开 `main` 精确 SHA 和私有 Delivery Data 为输入，由私有
  `windows-2022` Runner 生成、校验并上传完整 `Setup.exe`
- Windows 当前为 `internal_release_ready`；未执行真实 Windows 10/11 UAT 的版本不得
  标记为正式实测通过

当前交付操作入口：

- `docs/09-delivery/desktop-packaging-runbook.md`
- `docs/09-delivery/release-acceptance-matrix-0.1.md`

## 3. 当前文档权威入口

- 当前状态：`CURRENT_STATE.md`
- 当前未完成主线：`task_plan.md`
- 最近执行结果：`progress.md`
- 长期决策与风险：`findings.md`
- 场景导航：`docs/README.md`
- 文档状态与归档规则：`docs/DOCUMENT_GOVERNANCE.md`
- 历史材料：`docs/05-archive/README.md`

completed、historical 和 retired 文档只用于追溯，不得覆盖当前合同和运行代码。

2026-07-28 文档治理第五轮已完成；旧版进入 `docs/05-archive/`，当前对外介绍只描述
本地优先、可追溯知识治理、关系工作台、桌面交付和只读 MCP。

## 4. 当前未完成主线

1. 等待用户完成 OI-197 的 15 项业务裁定。
2. 新知识发布时执行正式 apply → immutable runtime restart → MCP 五工具验收 → accept。
3. Windows 打包时使用最新 `main` 和最新批准 Delivery Data 触发私有 Runner。
4. 用户要求打最新 macOS 包时，从同一当前源码重建 license / no-license 双 staging；
   随后在最新实包中验证首次建证、完全退出重开、锁屏 / 解锁后的明确恢复路径、
   App MCP `28776` 的 OAuth / 五工具 / `TOOL_CALL` 审计和用户数据边界。正式外部分发
   所需 Developer ID / notarization 必须另行立项和验收。

更详细的停止条件见 `task_plan.md`。

## 5. 恢复与停止条件

- 开始修改前先看 `git status`，保留所有已有 dirty work
- 不使用 `git add .`、`reset`、`checkout` 覆盖或 `clean`
- Web 5173 通过不能替代 App、DMG 或 Windows 实包验收
- 数据、用户状态、打包或发布边界发生变化时，必须同步更新本页和 `progress.md`
- 详细历史状态已归档到
  `docs/05-archive/current-state-history/CURRENT_STATE-before-third-round-2026-07-28.md`
