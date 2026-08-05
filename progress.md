# progress.md

> 状态：`active / recent milestones`
>
> 更新日期：2026-08-05

本页只保留最近的重要结果。完整执行记录从 `docs/05-archive/progress-history/` 和各专题归档进入。

## 2026-08-05

- `G2 与 macOS Runtime 指纹收敛`：G2 稳定身份字段已通过正式 `006_stable_identity.sql` 接入 migration，并覆盖已有字段、并发和失败回滚。真实签名 App 复核发现新增启动全树 hash 会因 `codesign` 修改受控 Mach-O 而与签名前记录值不一致，同时产生约 `0.72—0.79s` 启动开销；已按最小原则回退启动全树重算和复制后强制复验，恢复原有构建指纹标记比较，保留内容资产数据库 hash、写路径软链接保护及既有签名流程。SwiftPM 编译、Runtime / DMG 定向 `16/16`、delivery `7/7`、文档治理和差异检查通过；本轮不构建 DMG、不启动 App、不修改正式数据或真实用户库。
- `第八轮代码审计修复完成`：3 个 P1、9 个 P2 已按根因最小修复。stable maturity smoke 不再调用报告写端点；跨路由 `inert` 和事件绑定由显式 unmount 收尾；完成评估递增 revision 并同时保护后台成功 / 失败响应。项目名恢复为列表主身份和搜索字段；报告后端成功、本地保存失败时保留当前 receipt，同会话只重试本地保存，跨刷新按双 hash 获取最新匹配工件；同 hash 不同来源路径 fail closed，重导按来源路径与选中 sheet 清理消失类型并保留有效其他 owner；报告顶层与导出分类 symlink 写前拒绝。full / release-full 补入内容、导入、Electron 和 MCP，默认无 Chrome smoke 验证真实业务 API，runner 正常退出也清理 POSIX 后代进程。定向回归为导入 `19/19`、用户路径 `36/36`、交付控制 `19/19`、成熟度 `43/43 + 236/236`、Electron `14/14`；最终 9 个 suite、82 个非 DMG 命令全部通过，新增内容回归再以 `-W error::ResourceWarning` 验证 `25/25`。5173 PID 20739 保持 stable；正式用户库 `0e3db122...`、`demo-project-002` manifest `9192e778...`、27 个工件及全报告树摘要前后不变。未重启服务、未启动系统 Chrome、未构建 DMG、未测试最新实包 28776。
- `第六至七轮代码审计与当时矩阵收敛`：修复 migration 原子性 / 并发与显式事务逃逸、导入来源 owner handoff / 权威空关系集及未解析关系误删、报告路径及 symlink 越界、成熟度 hydrate / restore / import / report 的异步竞态和 localStorage 失败、runner 进程树中断、完整矩阵缺 MCP、Bundle 必需 rewrite owner、文档日期门禁及 Runtime smoke 误写正式报告。后置三方二审发现的 2 个 P1 / 5 个 P2 均补回归；定向后端 `51/51`、交付 `21/21`、成熟度行为 `34/34`、V2.1 `236/236`、自定义模板 `58/58` 通过，最终 `static / boundaries / data / frontend / runtime / mcp / user / delivery` 80 个非 DMG 命令全部通过。该结果只表示当时已编排矩阵通过，已被第八轮发现的覆盖缺口降级，不再作为“无剩余 P1 / P2”证据。

## 2026-08-04

- `第五轮代码审计与 P1 / P2 故障回归收敛`：P1 已修复成熟度门禁误判、本地存储读取失败后误覆盖、全局 API 永久熔断、前端软链接越界、构建时间戳复验和 DMG Runtime API smoke 缺口；P2 已修复报告目录隔离与碰撞 / 异常清理、Web 与 Bundle 同名导出覆盖、导出任务 JSON 非原子覆盖、并发 Token 刷新竞态、动态查询失败缓存跨查询误阻断 / 无界增长、空用户库完整 DDL 对比、Runtime 可执行权限 / 软链接、DMG 与直接 build 中断不及时、dry-run 误报、成熟度交互测试空覆盖、Windows 文件锁分支和 SQLite 连接泄漏。成熟度行为 `22/22`、V2.1 合同 `236/236`、Windows 合同 `10/10`、用户态 `27/27`、Bundle / DMG 验收行为 `25/25` 通过；`static / boundaries / data / delivery` 共 38 个编排命令通过，离线前端治理 / 搜索 / 滚动 / 成熟度 9 组通过，文档治理新增未关闭 Issue 声明数与权威表一致性门禁。第五轮收口时 5173 被非项目 listener 占用且 HTTP 不可达，未重启或清理进程，因此 10 组依赖本机 HTTP 的前端壳层审计不声明通过；既有候选职能 ID 审计仍为 `138 warning / 0 error`。未启动系统 Chrome、未构建 DMG、未写真实用户库或正式数据。

## 2026-08-03

- 桌面打包目录与 GitHub owner 整理 PASS：GitHub connector 核对公开
  `kim1st0913/SAPD_Wiki` 和私有 `SAPD_Wiki_Delivery_Private` 当前文件后，公开仓退役
  backend-only workflow 归档到 `docs/05-archive/delivery-retired-2026-07/workflows/`，
  六个 ZIP alpha 发布 / 启停文件归档到 `scripts/retired/zip-alpha/`；当前生产脚本路径保持
  不变。未删除任何本地产物：Electron 0.3.0 Runtime 和 0.2.0—0.3.5 输出移入
  `.build/archive/` / `dist/archive/`，macOS 旧 DMG 移入两个变体的 `archive/`，活动层只
  保留 0.4.0 Setup 与双 DMG。活动 SHA-256 为 Windows `e2f62716...`、macOS license
  `5ba1ed70...`、no-license `5bfe59d3...`。新增
  `docs/09-delivery/packaging-directory-map.md`；Windows 目录合同 `10/10`、Electron
  `14/14`、macOS 打包合同、Python / Bash 语法、文档治理、GitHub 数据边界和
  `git diff --check` 均通过。静态核对另发现私有 watcher 未向必填 `app_version` 传值；
  未改私有仓，也未把合同不一致误报为已观察运行失败，下一次自动构建前需修复并取证。
- `data/exports` 第二批精确白名单清理 PASS：三套相同输入、未进入 accepted 的旧内容
  release 仅删除 candidate 双库，原 `release-state`、输入 manifest 和 reports 原位保留；
  T5 离线 bundle 的 README、配置和启动验收日志迁入 reports 后删除完整运行副本。总删除
  `1,537,456 KiB`，扣除 `28 KiB` 保留证据后净释放 `1,537,428 KiB`（约
  `1.47 GiB`），`data/exports` 从 `7,956,200 KiB` 降至 `6,418,772 KiB`。当前仅最新
  `65f942...` release 保留 candidate 双库，候选库及正式基础库、内容资产库、用户库均
  `integrity_check=ok / foreign_key_check=0`，三套正式库哈希不变。未清理当前 candidate、
  最新 release、T6 recovery、`plan-env-md`、Windows 正式 ZIP、源 Excel 或用户导出。
  报告为 `data/exports/cleanup-reports/exports-second-batch-cleanup-20260803T021733Z.json`。

- `data/exports` 第一批精确白名单清理 PASS：删除三套已发布 Windows Delivery Data ZIP
  分片、`.tmp-manual-swap` 字节重复副本、T6 restore-rehearsal 重复库、两份 2026-05
  临时验证库，以及已过期的对象 / 关系批量导出和三个 `clean-*` 目录，共释放
  `1,223,636 KiB`（约 `1.17 GiB`）；`data/exports` 从 `9,179,832 KiB` 降至
  `7,956,196 KiB`。正式基础库、内容资产库和用户库哈希保持
  `30d14679... / adaa19bf... / 0e3db122...`，三库 `integrity_check=ok`、外键异常为
  `0`；保留的 Windows ZIP、环境正式备份和 T6 recovery 哈希复核通过。未清理
  `plan-env-md`、当前内容 candidate、4 套 release、正式恢复包、源 Excel、用户导出或
  其他 `worker-verify` 证据。报告为
  `data/exports/cleanup-reports/exports-first-batch-cleanup-20260803T021256Z.json`。

- `权威状态冲突 P0 收敛`：当前状态、主线计划和 Open Issues 已统一为 macOS 0.4.0
  双包已构建并通过自动矩阵；人工 UAT 持续保留但不阻塞内部开发，只限制最新实包完整
  UAT 和正式外部分发声明。`task_plan.md` 不再要求重复执行已完成的 CSS P1 或重打现有包。
- `OI-197 分批业务复核 READY`：业务复核改为先确认连续等级范围、通用基线、T-IN.IP、
  T-OF、L4 / L5 等全局规则，再只处理离线工作台中的争议对象，不要求用户一次逐格验收
  3,700 个单元。正式 Rubric、评分规则、源 Excel、SQLite 和历史结果未修改。
- `OI-128 CLOSED`：批注 / 工作台用户写入入口已实现并通过多轮 API、契约、页面与真实
  批注回归，按当前范围关闭。导出格式扩展、能力重组、导入和 Skill 集成作为未来独立
  范围，不继续占用该 Issue。
- `dirty 范围拆分`：收尾期间另有成熟度模板工作台前端改动进入同一工作树，最终按
  macOS 0.4.0、模板工作台、OI-197 业务审阅和状态治理四组管理。定向验证通过 macOS
  parity、模板工作台 `54 / 54`、成熟度合同 `236 / 236`、脚本语法、文档治理和
  `git diff --check`。未 stage、commit、push，未触碰 `data/`、DMG、正式库或真实用户库。

## 2026-08-01

- `成熟度评估依据文档分层治理 PASS`：业务设计维护 L1—L5 规范语义，V3 评分基线维护
  91 个关注点、185 个评估点的具体提案，前端设计只维护实现合同；删除重复和过期矩阵，
  未修改正式评分数据、Rubric 字典、SQLite、源 Excel、历史项目或真实用户数据。
- `macOS 0.4.0 双版本 DMG 自动验收 PASS`：从当时的 main 分支 dirty 工作树强制重建
  license / no-license 双 staging。产物分别为
  `SAPD-Wiki-0.4.0-license-20260801-033335Z-mac-arm64.dmg`，SHA-256
  `5ba1ed70c9b16baf72fdb97a32ad177fba04fdf8a8521033f67c6a62dd43843a`，以及
  `SAPD-Wiki-0.4.0-no-license-20260801-033335Z-mac-arm64.dmg`，SHA-256
  `5bfe59d3d5c02d5fa90155a910a32e794ae4eb8e7c4b865b11196cb18a44370b`。
- `0.4.0 release matrix PASS`：完整 pre-DMG、`hdiutil verify`、只读挂载、arm64 ad-hoc
  codesign、版本 / 模式、Runtime `--check-only`、隔离启动、正式双库和空用户库模板检查
  通过；真实用户库未写入。双 staging 前端一致，源码与 staging 的两处内容资产 API
  改写属于交付合同允许差异。
- `0.4.0 人工 UAT 非阻塞保留`：拖拽安装、首次保存路径、license / no-license 入口、
  首次建证、退出重开、锁屏 / 解锁和 App MCP `28776` 五工具 / 新 `TOOL_CALL` 条件允许
  时继续验证；当前仍为 ad-hoc signing、未 notarize 的 arm64 内测包。

## 历史入口

- 2026-07-29 至 2026-07-31：
  `docs/05-archive/progress-history/progress-2026-07-29-to-2026-07-31.md`
- 2026-07-28 以前：`docs/05-archive/progress-history/` 和
  `docs/05-archive/progress-history/progress-before-round-4-2026-07-28.md`

## 保护边界

- 不修改正式 SQLite、源 Excel、保护字典、Rubric、用户库或已生成交付产物，除非用户
  明确授权并提供恢复路径。
- 不把 `data/`、DMG、Setup、恢复包、虚拟环境、`node_modules` 或构建物加入 Git。
- 5173 通过不能替代 App、DMG 或 Windows 实包验收。
