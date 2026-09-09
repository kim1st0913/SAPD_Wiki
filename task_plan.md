# Task Plan: SAPD Wiki 当前主线

> 状态：`active / 0.4.1 final candidate / OI-201 overview source-axis accepted`
>
> 更新日期：2026-08-25

## 当前目标

把已完成的 Phase 2 Batch 1、Keychain 修复和成熟度优化收口为同一精确源码 SHA，并生成
macOS no-license DMG 与 Windows Runtime / Setup 的共同 0.4.1 内测候选。

## 当前门状态

| 主线 | 状态 | 下一步 | 停止条件 |
|---|---|---|---|
| Git checkpoint | `ready_after_memory_slim` | Git 专用任务显式 stage 当前 30 个源码文件和本轮 3 个项目记忆文件，commit / push main | 数据边界、测试、文件清单或 main/origin 不满足即停止 |
| Web / Phase 2 Batch 1 | `accepted` | 新 SHA 后复核 5173 guard 与 projection identity | 不修改正式库，不进入 Batch 2 |
| macOS 0.4.1 | `previous_package_superseded` | 新 SHA 只构建 no-license，验收覆盖升级、Keychain、模板保存、高分辨率菜单、28776 | 不生成 license；实包失败不复用旧包冒充 |
| Windows 0.4.1 | `delivery_r1_published / setup_missing` | 新 SHA 生成新的不可变 Delivery Data，触发私有 Runner，下载最终 Setup 本地副本 | 不复用 abcb6a7 manifest；未通过 Win10/11 UAT 不晋级 |
| Phase 2 Batch 2 | `not_authorized` | Batch 1 三平台完成后请求用户决定 | 未授权不改 environment owner 或正式数据 |
| OI-197 V3 Rubric | `proposal_ready` | 分批复核全局规则和争议对象 | 未获正式迁移授权不写 Rubric、评分规则或历史结果 |

## 待主控编排的独立工作流

| 工作流 | 状态 | 可安排范围 | 独立授权门 |
|---|---|---|---|
| OI-201 安全运行知识参考 | `overview_source_axis_runtime_accepted / open` | 继续逐页复核其余 Tab 的页面职责与来源分配；若明确授权，再做 formal freeze / apply，其后做 App / DMG 集成验收 | 不把 UI 或内容复核当 formal apply；未授权不写正式库，不启动 App / DMG、Windows、commit / push、打包或发布 |

执行依据为 `docs/06-implementation/security-operations-knowledge-prd-v1.md`、
`docs/02-data-model/security-operations-knowledge-data-and-mcp-contract-v1.md`、active 前端实施规格和
`docs/06-implementation/security-operations-knowledge-execution-plan-v1.md`。WP0—WP5 candidate-only Web
和 candidate-only 集成门已完成；权威候选包 SHA-256 为
`5fb801e33ef6bf907cd92179735c8ea34f47073a1f04b29fe73665fedeba68a6`。技术身份、能力映射和图示无需
用户逐项审核：有来源且关系合理的映射默认接纳为候选，证据不足系统暂缓，图示原样 `source-only`
保留。该工作流仍保持 open，但下一步产品内容 / UAT 复核是用户可选项，不阻断 Gate，也不改变
当前 0.4.1 发布主线顺序。总体思路已按 01-000 第 1—10 章及第 4 章五个核心思路重构；V0.2 的
104 个正文标题节点 / 28 张原图阅读器和 13 / 8 / 7 运行体系结构已通过 shared Web runtime 验收；
5173 静态资源直接生效不替代 App / DMG 验收。

## 当前执行顺序

1. 主控完成当前项目记忆压缩；Git 专用任务复跑治理、数据边界和定向门。
2. 只 stage 授权源码与 `CURRENT_STATE.md / progress.md / task_plan.md`，创建一次 checkpoint，
   push 后记录唯一完整 SHA。
3. macOS 任务基于该 SHA 构建唯一 no-license DMG；不覆盖旧 DMG，记录 stamp、大小和 SHA-256。
4. macOS 自动门通过后，执行状态保护的覆盖升级 UAT：旧证书 / OAuth 不变、权限修复可用、
   模板保存错误分类正确、成熟度菜单完整、28776 五工具产生新 TOOL_CALL。
5. Windows 任务基于同一 SHA 生成新的不可变 Delivery Data ID；私有 Runner 构建原生 backend、
   Runtime 与 Setup，完成 manifest / TC-010 / Phase 2 / 空用户库 / Windows 10/11 验收。
6. 将成功 Windows Release 下载至 `apps/electron/releases/0.4.1/`，核对远端与本地哈希。
7. 更新最终进度；由用户决定是否进入 Phase 2 Batch 2 或继续 OI-197 业务复核。

## 发布身份与目录

- 当前旧 checkpoint：`abcb6a718cf83d3173b30411dfc5184ca9bf929a`。
- 当前正式数据：base `188f20ef...cf3680`，content `adaa19bf...5bce6`。
- macOS 最终目录：`apps/macos/SAPDWiki/dist/releases/0.4.1/no-license/`。
- Windows 本地目录：`apps/electron/releases/0.4.1/`；远端事实源为私有不可变 Release。
- 旧 `windows-data-20260812-phase2-batch1-r1` 与 Run 31561038164 仅保留为历史证据。

## 保护边界

- 不提交 `data/`、SQLite、源 Excel、DMG、Setup、ZIP、恢复包、生成底图或真实用户数据。
- 不重置或覆盖当前 dirty，不使用 `git add .`、`-A`、`reset`、`checkout` 或 `clean`。
- 不把 5173 通过当成 DMG / Windows 实包通过；不把回退预案当成每步实际回退。
- 当前为 ad-hoc / 未 notarize 内测发布；外部分发签名另行立项。
