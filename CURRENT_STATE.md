# CURRENT_STATE: SAPD Wiki

> 状态：`active / primary recovery entry`
>
> 更新日期：2026-08-05

本页只保留恢复工作所需的当前事实、保护边界、风险和下一步。详细过程从 `progress.md`
和 `docs/05-archive/README.md` 进入。

## 1. Git 与工作区

- 当前分支 `main`，HEAD `9f4cae28c357`；2026-08-03 核对与 `origin/main` 为 `0 / 0`。
- 工作树 dirty 分为六个待收口范围：macOS 0.4.0 交付、成熟度模板工作台前端、OI-197
  业务审阅、桌面打包目录治理、第一至八轮 P1 / P2 代码审计修复、当前状态治理；未跟踪 `data/` 和生成底图继续保留。
- 上述改动未 stage、commit 或 push。后续必须分范围 checkpoint，不混入 `data/`、SQLite、
  DMG、Setup、恢复包、虚拟环境、`node_modules` 或构建产物。
- 旧 `codex/windows-electron` 本地和远端分支已删除，不得恢复为日常生产分支。

## 2. 当前产品状态

### 知识、数据与用户状态

- 基础内容统一查询 T0—T6 已正式应用；当前口径为 9 个文档、609 个片段、684 条内容
  关系和 1,302 条内容证据。Draw.io 空页不再生成内容对象。
- OI-198 导入审批幂等、任务终结、approved 默认导出和写入门禁已实现；增量发布具备
  `prepare / build / verify / apply / accept / rollback`，当前为 `gated`。
- G2 稳定身份遗漏已由 `006_stable_identity.sql` 纳入正式 migration；新库、已有字段库、
  并发执行和失败回滚均由定向测试覆盖，未修改正式数据库。
- 信息化环境主数据 P0—P8 已完成 Web 验收：10 个环境、16 个子类类型、51 个对象、
  77 条定义和 125 条关联使用。
- 正式数据、源 Excel、真实用户库、Rubric、评分规则和 ETL 只有在明确授权及具备恢复
  路径后才能修改。

### 成熟度

- V2.1 需求、领域模型、数据模型和模板映射仍是正式合同；V3 当前只是业务审阅提案。
- 自定义模板图谱工作台已支持分层展开、节点增删改、合法拖拽、复制、撤销 / 重做、
  目录定位、模板发布与项目选模；标准来源保持只读，修改只进入本地自定义副本。
- 服务角色固定为 T 类 `ASSESSMENT_POINT`、G / M 类
  `PLATFORM_EVIDENCE_REFERENCE`；无服务关注点形成 `FOCUS`。基础模板仍为 3 个 L0、
  10 个 L1、32 个 L2、91 个关注点、160 条服务关系和 185 个评估点。
- 自定义通用依据版本为 `sapd-maturity-custom-generic-rubric-v3-2026-07-30`；L4 以受控
  运行、可比较结果、偏差纠正和效果验证为核心，L5 不以 AI 为必要条件。
- OI-197 已形成指南 v1.4、评分基线主表、差异说明、离线工作台和结构化提案，共
  91 个关注点、185 个评估点、3,700 个等级维度单元。T-IN.IP 为 L2—L5，T-OF 条件
  适用并从 L3 起评；指标库已退出本轮正式提案。
- 第七轮首次真实 Runtime smoke 写入的单个 `demo-project-002` 报告工件已按用户授权做
  manifest-safe 清理，manifest 从 28 条恢复为 27 条；删除前副本位于
  `/private/tmp/sapd-report-cleanup-recovery-lwojrvc4`。第八轮已把报告写探针限制到 ephemeral
  Runtime；stable 5173 成熟度 smoke 只验证只读 / 无持久化能力并明确跳过报告写端点。
- 业务复核按两步推进：先确认全局规则和例外，再只处理工作台中有争议的对象；不要求
  用户一次逐格验收全部单元。取得完整裁定和正式迁移授权前不得替换 V2.1 正式数据。

### MCP

- Web MCP 五工具、TLS / OAuth、CurrentUser 持久 Runtime、refresh-token、自动生命周期
  和正式基础知识只读访问已实现。
- Keychain 故障保持最小修复：`36 / 51` 归类为 `SECRET_STORE_UNAVAILABLE`，显示解锁
  提示；运行中 Sidecar 不因临时不可读退出，真实条目缺失仍 fail closed。
- 2026-08-05 5173 stable guard 已确认 PID 20739 为项目服务，home、health、workspace
  projection、正式数据路径和持久 Runtime 检查通过；第八轮 3 个 P1、9 个 P2 已全部修复，
  补齐后的 `static / boundaries / data / frontend / runtime / mcp / user / delivery /
  core-regressions` 共 82 个非 DMG 命令全部通过。正式用户库 SHA-256、`demo-project-002`
  report manifest SHA-256 及 27 个工件前后不变。未重启服务、未启动系统 Chrome、未构建 DMG。
- 2026-08-05 App MCP `28776` 正由 PID 84224 监听；本轮未对最新实包执行 28776 工具
  调用，因此不能作为 0.4.0 最新实包五工具验收证据。

### macOS / Windows 交付

- 2026-08-01 从当时的 main 分支 dirty 工作树构建 0.4.0 license / no-license 双 DMG，
  时间戳 `20260801-033335Z`；两包实物和记录的 SHA-256 已于 2026-08-03 再次核对一致。
- 双包通过完整 pre-DMG、arm64 ad-hoc codesign、`hdiutil verify`、只读挂载、版本 / 模式、
  Runtime `--check-only`、隔离启动、正式双库和空 `user_schema_0.3` 用户库检查；两个
  staging 前端一致，镜像均包含 `Applications -> /Applications`。
- 0.4.0 人工 UAT 持续保留但不阻塞内部开发：条件允许时验证首次路径、license /
  no-license 入口、首次建证、退出重开、锁屏 / 解锁和 App MCP `28776` 五工具及新
  `TOOL_CALL`。未完成只限制“最新实包完整 UAT”和正式外部分发声明。
- 当前 dirty 源码已收紧下一轮 `release-full`：双变体复用同一当前源码 backend，并在挂载后
  核对源码 stamp、完整前端树、Runtime 版本 / 平台、App 架构、严格空用户库和合法的
  Runtime 构建标记；新增临时 Runtime API / 核心页面 smoke、完整用户库 DDL、Runtime
  可执行权限 / 软链接及同轮构建锁检查。该批源码尚未重打 DMG，现有 0.4.0 包只能作为
  历史实包证据。
- 2026-08-05 已回退新增的 macOS 启动 Runtime 全树重算与复制后强制复验：该方案会把
  `codesign` 的正常修改误判为篡改，并为每次启动增加约 `0.72—0.79s`。当前恢复为原有
  构建指纹标记比较；内容资产数据库 hash 与 Runtime 写路径软链接保护继续保留。
- 当前仍为 ad-hoc signing、未 notarize 的 arm64 内测包；Developer ID、notarization、
  stapling 和 Gatekeeper 需另行立项。
- Windows 现有手工 dispatch 路径为 `internal_release_ready`，可按公开 `main` 精确 SHA、
  私有 Delivery Data 和显式 `app_version` 触发 `windows-2022` Runner；自动 watcher 当前
  阻断，未完成 Windows 10/11 实机 UAT 的版本不得标记正式通过。
- 桌面打包目录已按 `docs/09-delivery/packaging-directory-map.md` 收口：公开仓当前只保留
  数据边界 workflow，退役 backend-only workflow 与 ZIP alpha 工具已归档；本地活动层
  只保留 0.4.0 Setup / DMG，所有旧产物原样移入平台 archive，未删除文件。
- 2026-08-03 GitHub 静态核对确认私有 `windows-installer.yml` 要求必填
  `app_version`，但 `watch-public-main.yml` 尚未传入。该事实只证明 workflow 合同不一致，
  不等同于已观察到某次运行失败；私有仓修复并取得成功运行前不得声明自动触发健康，
  手工 dispatch 必须显式传版本。

## 3. 当前未完成主线

1. 分批完成 OI-197 V3 业务复核，争议项裁定后再决定是否正式迁移。
2. 将 dirty 工作树按 macOS 0.4.0、成熟度模板工作台、OI-197 业务审阅、桌面打包目录、
   P1 / P2 代码审计修复和状态治理分别收口；未获明确指令前不 stage、commit 或 push。
3. 新知识发布时执行 apply → immutable runtime restart → MCP 五工具验收 → accept。
4. 0.4.0 人工 UAT、外部分发签名和 Windows 实机矩阵作为持续保留项，不阻塞内部开发，
   但未通过前不得扩大验收声明；下一次自动 Windows 构建前先修复私有 watcher 的
   `app_version` 输入并取得成功 Actions 证据。
5. OI-200 只有用户明确启动后才进入开发；OI-138 保持暂停。OI-128 已关闭，未来扩展另立
   范围。

## 4. 权威入口与停止条件

- 当前状态：`CURRENT_STATE.md`；未完成主线：`task_plan.md`；最近结果：`progress.md`；
  长期决策：`findings.md`；问题：`docs/06-implementation/open-issues.md`。
- 开始修改前先看 `git status`；不使用 `git add .`、`reset`、`checkout` 或 `clean` 覆盖
  现有工作。Web 5173 通过不能替代 App、DMG 或 Windows 实包验收。
- 数据、用户状态、打包或发布边界变化时同步本页和 `progress.md`；历史入口为
  `docs/05-archive/README.md`。
