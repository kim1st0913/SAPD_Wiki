# Task Plan: SAPD Wiki 当前主线

> 状态：`active`
>
> 更新日期：2026-07-30

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

## 当前执行任务：成熟度图谱模板权限与项目选模闭环

> 状态：`implemented / user_review_pending`

- 目标：让首页新增模板与项目内评估模板共用同一图谱编辑器；节点定义可编辑，项目来源
  原件与模板管理副本具有明确权限，新项目从固定 / 自定义两类中选择且不改写来源模板。
- 成功标准：标准来源节点带出知识库定义；节点属性有显式确认；属性面板无大面积无效
  留白；目录退出后顶部搜索可定位脑图；项目来源模板只能回项目优化或创建独立副本；
  新建项目按钮位于项目进展；自定义来源复制为项目专属新模板；工作区返回成熟度首页。
- 数据边界：标准模板与知识库字典继续只读；定义修改只写本地自定义模板副本，不覆盖
  保护基线、正式 SQLite、源 Excel、评分规则或真实用户库。
- 验收：专项前端契约、后端模板定义 / 校验契约、5173 首页与模板工作台闭环；App /
  DMG 留给发布矩阵。
- 当前结果：实现和长期合同已同步，专项前端契约 `41 / 41`、JS 语法、差异检查及
  5173 home / health 通过；标准定义动态检查为分类 `13 / 13`、L2 `32 / 32`、关注点
  `91 / 91`。应用内 Browser 被当前本地访问策略阻止，未绕过；等待用户直接页面复核
  后关闭本任务。全量 V2.1 / XLSX / 历史报告审计的既有环境或历史基线阻断已单独记录，
  不作为本轮页面闭环的通过证据。

## 未完成主线

| 主线 | 当前状态 | 下一步 | 停止条件 |
|---|---|---|---|
| 知识内容增量发布 | `gated` | 在下一次明确发布窗口执行正式 apply、immutable runtime restart、MCP 五工具验收和 accept | 未取得正式发布授权前不写正式双库 |
| OI-197 成熟度 Rubric 映射 | `v3_proposal_ready / business_review_pending` | 在 V3 离线工作台复核 91 个关注点范围和 185 个评估点的 3,700 个等级维度单元；同时复核自定义模板 L1—L5 通用基线。L4 按量化控制与效果验证审阅，不预设指标，L5 按最低门槛裁定 | 取得完整业务裁定和正式迁移授权前不写 Rubric 字典、评分规则、源 Excel、正式数据或历史结果 |
| `styles.css` P1 收敛 | `web_verified / app_pending` | Web 已纯删除 4 个完整重复规则块并通过专项、Runtime 与浏览器断点验收；下一次最新 DMG 与 `28776` MCP 一起复验 App | 最新实包矩阵完成前不宣称 shared runtime 通过；不为行数门禁继续删除有效声明 |
| macOS 交付 | `keychain_minimal_fix / latest_package_uat_pending` | 用户要求新包时，从同一当前源码重建双 staging，并在最新实包内验证首次建证、退出重开、锁屏 / 解锁恢复路径和 App MCP `28776` 的 OAuth、五工具及审计 | staging 与当前源码不一致时不得宣称当前源码已打包；最新实包矩阵完成前不得宣称 App MCP 或钥匙串连续性验收通过 |
| Windows 交付 | `operational / internal_release_ready` | 日常按“最新 main + 最新批准 Delivery Data”构建；发现实机问题再修复 | 不伪造 Windows 10/11 UAT；未实测版本保持 Internal Release 标识 |

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
- Windows GitHub 构建迁移已完成：公开 `main` 为源码事实源，私有 Runner 生成完整
  `Setup.exe`，旧 `codex/windows-electron` 分支已删除。
- Git 工作树和历史 MCP 分支收敛已经完成；旧工作树 / 分支过程不再进入当前计划。

详细历史入口：

- `docs/05-archive/README.md`
- `docs/05-archive/implementation-completed-2026-07/base-content-unified-query-tonight-plan-2026-07-26.md`
- `docs/05-archive/implementation-completed-2026-07/environment-master-data-dictionary-plan-2026-07-25.md`
- `docs/09-delivery/windows-github-installer-migration-plan-2026-07-27.md`

## 当前执行顺序

1. 用户批准执行后，按零影响模式执行
   `docs/06-implementation/frontend-styles-css-p1-optimization-plan-2026-07-29.md`
   的静态等价审计和纯删除；不与当前 `app.js / index.html` dirty 变更并发写同一文件。
2. 用户复核 OI-197 V3 提案包及自定义模板 L1—L5 通用基线；优先处理连续等级范围、
   T-OF 授权边界、拆分 / 补齐 Rubric、建议校准标题、Level 4 量化控制证据和
   Level 5 最低门槛。
3. 用户要求发布新知识内容时，执行增量发布的正式 apply → restart → MCP 验收 →
   accept。
4. 用户要求打最新 Windows 包时，检查最新代码和正式数据后触发私有 Runner。
5. 用户要求打最新 macOS 包时，先核对当前源码与正式数据，再同步重建双 staging；
   对最新实包验证首次系统认证、完全退出重开、锁屏 / 解锁后的明确恢复路径，以及
   App MCP `28776` 的 OAuth、五工具、`TOOL_CALL` 审计和用户数据边界。

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
