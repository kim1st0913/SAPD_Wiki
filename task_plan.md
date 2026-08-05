# Task Plan: SAPD Wiki 当前主线

> 状态：`active`
>
> 更新日期：2026-08-05

本文件只保留未完成主线、下一步和停止条件。已完成阶段的详细过程进入专题文档、
`progress.md` 或 `docs/05-archive/`，不再复制到当前计划。

## 当前目标

把 SAPD Wiki 从“功能和数据主体已完成”推进到可重复维护、可审计发布和可跨平台
交付的稳定状态。

当前恢复入口：

- 实现状态：`CURRENT_STATE.md`
- 当前关键决策：`findings.md`
- 最近执行记录：`progress.md`
- 文档导航：`docs/README.md`
- 文档治理：`docs/DOCUMENT_GOVERNANCE.md`

## 已完成任务：第八轮代码审计问题收敛

> 状态：`complete / 3 P1 + 9 P2 fixed and verified`

- P1：stable 报告写探针、跨路由 `inert` 和完成评估异步覆盖均已修复并补负向回归。
- P2：矩阵漏测、runner 后代清理、页面 smoke 假绿、项目身份、报告对账、来源 owner、
  重导消失类型及报告 / 导出 symlink 越界均已修复。
- 验收：定向导入 `19/19`、用户路径 `36/36`、交付控制 `19/19`、成熟度
  `43/43 + 236/236`、Electron `14/14`；最终 9 个 suite、82 个非 DMG 命令全部通过。
  正式用户库、报告 manifest 和 27 个现有工件未变化。
- 边界：最新实包 28776 与 DMG UAT 仍按用户要求后置，不纳入本轮通过声明。

## 已完成任务：G2 与 macOS 启动全树哈希回退

> 状态：`complete / targeted rollback`

- G2 稳定身份字段已进入正式 `006_stable_identity.sql` migration，新库、已有字段库、并发
  执行和失败回滚通过。
- macOS 启动时 Runtime 全树重算及复制后强制复验已回退，恢复原有构建指纹标记比较；
  内容资产数据库 hash、写路径软链接保护和原签名流程不变。
- 当前源码尚未重打 DMG；下一次明确打包时由 `release-full` 验证真实签名 App 和 28776。

## 已完成记录：第六至七轮代码审计与故障回归复核

> 状态：`historical matrix pass / superseded by round 8 audit`

- P1：SQLite migration 原子提交 / 并发互斥、来源关系安全收敛、成熟度异步状态与本地持久化、runner 进程树中断已修复。
- P2：连接资源、报告路径 / symlink、Bundle 必需 rewrite owner、文档日期和 Runtime smoke 用户状态边界已修复。
- 长期门禁：新增 database resource、关系审批、报告路径、成熟度行为、进程树、Bundle 缺 owner 和日期最大值负向回归。
- 保护边界：不构建 DMG、不重启 5173/28776、不修改真实用户库、正式 SQLite、源 Excel 或现有打包产物。
- 结果：定向后端 `51/51`、交付 `21/21`、成熟度行为 `34/34`、V2.1 `236/236`、自定义模板 `58/58` 通过；最终 8 个 suite、80 个非 DMG 编排命令全部通过。最新源码尚未打包，28776 与实包 UAT 继续后置。

## 已完成任务：代码审计 P2 首轮收敛

> 状态：`complete / 10 findings`

- 用户状态：降低成熟度报告输入持久化频率，修复并发报告 manifest 丢记录、首页滚动丢失和删除弹窗焦点约束。
- 安全边界：用户导出产生本地文件时必须校验当前会话写入令牌。
- 交付边界：backend 自动重建哈希覆盖 MCP contract，移除退役 0.3.0 backend 搜索路径，严格源码模式缺 staging 必须失败。
- 发布门禁：`release-full` 必须完成产物验收后才能 PASS；pre-commit / pre-DMG 覆盖关键打包脚本与 Windows 合同测试。
- 验收：全部使用临时用户库、临时报告目录和 dry-run / 静态产物合同；不构建 DMG，不修改现有产物或真实用户库。
- 结果：10 项 P2 已完成定向回归；完整 pre-commit 已通过 static、boundaries、data，进入 frontend 后因 5173 当前未运行而停止，未为测试重启服务。

## 并行保留任务：OI-197 V3 业务复核推进

> 状态：`proposal_ready / staged_business_review`

- 目标：不要求一次人工逐格验收全部 3,700 个单元，先确认会影响全表的业务规则和例外，
  再在离线工作台按争议项收口 91 个关注点和 185 个评估点。
- 第一批复核：连续等级范围、自定义模板通用 L1—L5 基线、T-IN.IP 的 L2—L5、T-OF
  的条件适用与 L3 起评、L4 的受控运行 / 可比较结果 / 偏差纠正 / 效果验证，以及 L5
  去 AI 必选化。
- 第二批复核：原 15 项映射争议、拆分 / 补齐 Rubric 和建议校准标题；只记录用户否决或
  要求修改的对象，其余保留当前 V3 提案。
- 完成条件：91 个关注点、160 条服务关系和 185 个评估点唯一绑定评分依据，业务复核
  结果可追溯；正式迁移仍需用户另行授权。
- 数据边界：本阶段只改业务审阅提案、生成器和契约审计，不写 Rubric 字典、评分规则、
  源 Excel、正式 SQLite、历史项目或真实用户库。

## 未完成主线

| 主线 | 当前状态 | 下一步 | 停止条件 |
|---|---|---|---|
| 知识内容增量发布 | `gated` | 在下一次明确发布窗口执行正式 apply、immutable runtime restart、MCP 五工具验收和 accept | 未取得正式发布授权前不写正式双库 |
| OI-197 成熟度 Rubric 映射 | `v3_proposal_ready / staged_business_review` | 先复核全局规则与例外，再在 V3 离线工作台只处理争议对象；不要求用户一次逐格验收全部 3,700 个单元 | 取得完整业务裁定和正式迁移授权前不写 Rubric 字典、评分规则、源 Excel、正式数据或历史结果 |
| dirty 工作树收口 | `five_scopes_identified / targeted_validation_pass` | macOS parity、模板工作台 `54 / 54`、成熟度合同 `236 / 236`、桌面打包目录治理、文档治理和差异检查已通过；后续按五个范围收口 | 未获明确提交指令前不 stage、commit 或 push，不把不同业务范围混成一个 checkpoint |
| `styles.css` P1 收敛 | `web_verified / app_uat_nonblocking` | Web 已完成；条件允许时在现有 0.4.0 实包中抽查共享样式，不继续为行数门禁拆分 | App 抽查未完成只限制 shared runtime 完整验收声明，不阻塞当前开发 |
| macOS 交付 | `0.4.0_auto_matrix_pass / manual_uat_nonblocking` | 保留现有 0.4.0 双包；条件允许时补首次路径、锁屏恢复和 App MCP `28776` 五工具审计 | 未完成人工 UAT 不阻塞当前内部开发，但不得宣称最新实包完整 UAT 或正式外部分发通过 |
| Windows 交付 | `manual_dispatch_ready / auto_trigger_blocked` | 先修复私有 watcher 缺失的 `app_version` 输入并取得成功 Actions 证据；修复前仅允许显式传版本的手工 dispatch | 不伪造自动触发健康或 Windows 10/11 UAT；未实测版本保持 Internal Release 标识 |

## 已完成并关闭

- 文档治理第一至五轮已完成：当前索引、根计划、状态词、归档规则和自动审计已收敛；
  `CURRENT_STATE.md` 已缩短为恢复页，旧交付 / 治理 / 实施 / 架构 / 前端 / 成熟度材料
  及早期数据模型 / 分批 ETL / 公开介绍材料已进入 `docs/05-archive/`；根 README、
  项目愿景和主架构已经同步当前业务设计。
- OI-198 导入审批幂等、任务终结和 approved 默认导出合同已实现并验证。
- 基础内容统一查询 T0—T6 已完成正式应用及 Draw.io 空页纠正。
- 信息化环境主数据 P0—P8 已完成 Web 验收。
- MCP Web 五工具、TLS / OAuth、持久 Runtime、refresh-token 兼容和自动生命周期已完成。
- Keychain 故障已收敛为 0.3.0 路径上的最小修复：回退 Native Security Broker、
  Data Protection Keychain 和 `app` profile 强制门禁，只保留 `36 / 51` 临时错误分类、
  解锁提示、运行中 Sidecar 保持和解锁后手动重试；相关定向与完整 MCP 回归已通过。
- Windows GitHub 构建基础迁移已完成：公开 `main` 为源码事实源，私有 Runner 可生成完整
  `Setup.exe`，旧 `codex/windows-electron` 分支已删除；当前 watcher 输入回归仍列在未完成主线。
- Git 工作树和历史 MCP 分支收敛已经完成；旧工作树 / 分支过程不再进入当前计划。
- OI-128 批注 / 工作台用户写入入口已实现并通过自动回归，2026-08-03 按当前范围关闭；
  导出格式扩展、能力重组、导入或 Skill 集成属于未来独立范围，不继续占用当前 Issue。

详细历史入口：

- `docs/05-archive/README.md`
- `docs/05-archive/implementation-completed-2026-07/base-content-unified-query-tonight-plan-2026-07-26.md`
- `docs/05-archive/implementation-completed-2026-07/environment-master-data-dictionary-plan-2026-07-25.md`
- `docs/09-delivery/windows-github-installer-migration-plan-2026-07-27.md`

## 当前执行顺序

1. 用户分批复核 OI-197 V3 提案包及自定义模板 L1—L5 通用基线；优先处理连续等级范围、
   T-OF 授权边界、拆分 / 补齐 Rubric、建议校准标题、Level 4 量化控制证据和
   Level 5 最低门槛。
2. 将当前 dirty 改动按 macOS 0.4.0、成熟度模板工作台、OI-197 业务审阅、桌面打包目录、
   P1 / P2 审计修复和状态治理六个 checkpoint 准备；只有用户明确要求提交时才定向 stage / commit。
3. 用户要求发布新知识内容时，执行增量发布的正式 apply → restart → MCP 验收 →
   accept。
4. 用户要求打最新 Windows 包时，先检查最新代码和正式数据；自动 watcher 修复取证前，
   只能用显式 `app_version` 的手工 dispatch 触发私有 Runner。
5. 现有 macOS 0.4.0 双包继续作为当前内测包；人工 UAT 持续保留但不阻塞，只有新增源码
   需要进入新包或用户明确要求时才重新构建。

## 保护边界

- 不因计划整理修改正式 SQLite、源 Excel、ETL、评分规则或真实用户库。
- 不把 `data/`、恢复包、DMG、Setup、虚拟环境、`node_modules` 或构建产物加入 Git。
- 不用 Web 5173 通过替代 App / DMG / Windows 实包验收。
- 不重建已删除的 `codex/windows-electron` 生产分支。
- 不把 completed / historical / retired 文档重新作为当前实现依据。

## 本轮文档治理验收

- `docs/README.md` 只列当前入口；
- 明确退役材料移入 `docs/05-archive/`；
- `docs/09-delivery/` 只保留当前交付入口；
- `docs/07-governance/` 不再保留已停用执行线文件；
- `node scripts/audit_document_governance.mjs` 通过；
- `git diff --check` 和 GitHub 数据边界检查通过；
- 不提交、不推送，除非用户另行授权。
