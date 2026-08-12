# CURRENT_STATE: SAPD Wiki

> 状态：`active / primary recovery entry`
>
> 更新日期：2026-08-12

本页只保留恢复工作所需的当前事实、保护边界、风险和下一步。详细过程从 `progress.md`
和 `docs/05-archive/README.md` 进入。

## 1. Git 与工作区

- 当前分支 `main`，HEAD `4ea0223326817d5b180c21b928460ab24f1b1382`；2026-08-11
  核对与 `origin/main` 为 `0 / 0`。Phase 2 专用 worktree 处于同一 HEAD，但两边 dirty / untracked
  快照不同，不能只凭 HEAD 相同视为同一发布输入。
- 工作树 dirty 分为七个待收口范围：macOS 0.4.0 交付、成熟度模板工作台前端、OI-197
  业务审阅、桌面打包目录治理、第一至八轮 P1 / P2 代码审计修复、Phase 2 Batch 1
  投影 / API、当前状态治理；未跟踪 `data/` 和生成底图继续保留。
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
- 2026-08-11 经用户明确授权，Phase 2 Batch 1 relation-only 候选已原子应用并通过主控独立验收：
  正式基础库 artifact SHA 从 `30d14679...f54c9e` 变为 `188f20ef...cf3680`，4694 个对象及
  owner 全行不变，关系从 7786 变为 7788，仅新增 `I-AP&T-AS.IA-02`、`I-US&T-AS.IA-02`
  到“应用系统自身认证模块”的两条 `uses_measure`；F/G provenance 为 `16 / 6`，projection
  `has_measure=53`。
- apply 前完整回退包位于
  `data/exports/worker-verify/phase2-batch1-formal-apply/phase2-batch1-20260811T090151Z/rollback-bundle`；
  rollback manifest SHA 为 `5044be68...d5df6`。专用任务完成临时与持久化两次恢复演练，主控
  又从持久化包独立完成逐文件库存校验和第三次候选→旧 SHA 恢复演练，均为
  `integrity_check=ok / FK=0`。
- 2026-08-11 经用户授权，专用任务把 Phase 2 Batch 1 已验收实现按 18 个文件的封闭清单安全
  整合到主工作区，主控独立验收通过。新增能力 / 维护 / shared lookups 的 SQLite-backed
  projection/API、relation-only candidate/apply 门和发布身份校验均为 additive。
- 2026-08-11 经用户授权，专用任务完成 Phase 2 Batch 1 页面 / `dataClient` owner switch，
  主控在空 `data-root`、只读正式库副本、有效临时 manifest 和 ephemeral user state 的隔离
  Runtime 独立验收通过。能力、维护和 shared lookups 只请求 `/api/v1/projections/*`，无
  `public/data` fallback；搜索不自动选择首项，错误 ID 为 404。TC-010 的 L0 / L1 / L2 /
  focus 明确身份、黄金焦点 6 服务、`has_measure=53`、维护服务 160 及两条新增措施关系的可见
  DOM 均通过。正式 base、content asset、源 Excel 和真实用户库保持不变。
- owner switch 验收中发现并最小修复两处真实合同缺口：L0 / L1 聚合投影对完全相同的稳定关系
  去重、冲突重复 fail closed；catalog 只在 dataClient 适配为 `initial_projection`，同时保留
  `sourceMode=sqlite_projection`、identity、contract 与 digest。未修改未迁移的 environment、
  lifecycle、standards、content/search/maturity/user-state owner。
- 2026-08-11 同候选发布门已完成至 Windows 权限边界：packaged Web Runtime 的 Batch 1 owner /
  TC-010 通过；0.4.0 license / no-license 双 DMG 已生成并通过 TC-023—027；Windows Delivery
  Data 候选已生成并通过完整性、外键和空用户库边界校验。两份 DMG 与 Windows Delivery Data
  均绑定正式 base `188f20ef...cf3680` 和 content asset `adaa19bf...5bce6`。本轮没有执行真实
  回退；既有回退包仅保留为恢复路径。
- 2026-08-12 用户真实截图否决了对 active 5173 的错误外推：旧 PID 20739 自 7 月 30 日运行，
  对新 projection 路由返回 404；受控重启为 PID 89268 后又因正式库同目录缺
  `base-manifest.json` 返回 503。现已用共享 identity builder 新增开发环境 manifest，三条
  Batch 1 projection 均为 200；真实 `dataClient` 调用链确认能力目录 3 / 10 / 32 / 91、
  workbench 136 对象 / 133 关系、维护 8 sections、NIST CSF Core 106 行完成加载。
- `dev_server_guard.py` 已补三条 Batch 1 projection 健康门；任一 404 / 503 会令状态为 warn
  和非零退出，不能再以旧 workspace API 的 200 掩盖页面失败。当前 guard 为 PASS。应用内
  浏览器因策略拒绝 localhost，三个页面的主控可见 DOM / 控制台验收仍未完成，不能声称该项通过。
- Windows Runtime / Setup 尚未生成：当前 dirty snapshot 没有对应的原生 Windows x64 backend，
  且 Delivery manifest 只能绑定公开 HEAD `4ea02233...b1382`，不能冒充精确源码候选。下一权限门
  是将已验收源码收口为精确 commit / push，再发布私有不可变 Delivery Data，由私有 Windows
  Runner 构建 backend 后完成 Runtime / Setup 验收。Batch 2 未授权。
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

- 2026-08-10 已修复 DMG staging 遗留目录软链接：镜像 staging 现在只在仓库 / Obsidian
  Vault 外的系统临时目录创建，`Applications -> /Applications` 不再进入工程；脚本在正常、
  失败和中断退出路径清理临时目录，成功后仅把已移除安装链接的 staged App 留给前端 parity
  审计。现有两个遗留链接已移出工程。未重打 DMG，历史镜像内容及哈希未修改。
- 2026-08-01 从当时的 main 分支 dirty 工作树构建 0.4.0 license / no-license 双 DMG，
  时间戳 `20260801-033335Z`；两包实物和记录的 SHA-256 已于 2026-08-03 再次核对一致。
- 双包通过完整 pre-DMG、arm64 ad-hoc codesign、`hdiutil verify`、只读挂载、版本 / 模式、
  Runtime `--check-only`、隔离启动、正式双库和空 `user_schema_0.3` 用户库检查；两个
  staging 前端一致，镜像均包含 `Applications -> /Applications`。
- 0.4.0 人工 UAT 持续保留但不阻塞内部开发：条件允许时验证首次路径、license /
  no-license 入口、首次建证、退出重开、锁屏 / 解锁和 App MCP `28776` 五工具及新
  `TOOL_CALL`。未完成只限制“最新实包完整 UAT”和正式外部分发声明。
- 2026-08-11 新同候选双 DMG（stamp `20260811-143546Z`）已通过完整 `release-full` /
  TC-023—027：license SHA `29ff90cf...b620`，no-license SHA `4973bb7c...485`；两包
  stable App code identity 均为 `9cf0dc10...d3e8`，Runtime core 均为 `8d5b3f84...02ab2`。
  跨变体比较排除各自 `LC_CODE_SIGNATURE` blob，但仍分别强制 `codesign --verify --deep
  --strict`、架构、Info.plist、空用户库、manifest、Runtime `--check-only` 和 API smoke。
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

1. Phase 2 Batch 1 data apply、代码整合、页面 / `dataClient` owner switch、packaged Web 和
   macOS 双 DMG 均已验收；Windows Delivery Data 也已本地验收。下一门需另行授权 commit / push
   精确源码、发布私有不可变 Delivery Data，并由私有 Windows Runner 完成原生 backend、Runtime
   和 Setup 验收。此前不进入 Batch 2 `environment`，也不声称 Windows 或跨平台迁移完成。
2. 分批完成 OI-197 V3 业务复核，争议项裁定后再决定是否正式迁移。
3. 将 dirty 工作树按 macOS 0.4.0、成熟度模板工作台、OI-197 业务审阅、桌面打包目录、
   P1 / P2 代码审计修复和状态治理分别收口；未获明确指令前不 stage、commit 或 push。
4. 新知识发布时执行 apply → immutable runtime restart → MCP 五工具验收 → accept。
5. 0.4.0 人工 UAT、外部分发签名和 Windows 实机矩阵作为持续保留项，不阻塞内部开发，
   但未通过前不得扩大验收声明；下一次自动 Windows 构建前先修复私有 watcher 的
   `app_version` 输入并取得成功 Actions 证据。
6. OI-200 只有用户明确启动后才进入开发；OI-138 保持暂停。OI-128 已关闭，未来扩展另立
   范围。

## 4. 权威入口与停止条件

- 当前状态：`CURRENT_STATE.md`；未完成主线：`task_plan.md`；最近结果：`progress.md`；
  长期决策：`findings.md`；问题：`docs/06-implementation/open-issues.md`。
- 开始修改前先看 `git status`；不使用 `git add .`、`reset`、`checkout` 或 `clean` 覆盖
  现有工作。Web 5173 通过不能替代 App、DMG 或 Windows 实包验收。
- 数据、用户状态、打包或发布边界变化时同步本页和 `progress.md`；历史入口为
  `docs/05-archive/README.md`。
