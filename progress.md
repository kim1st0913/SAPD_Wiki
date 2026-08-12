# progress.md

> 状态：`active / recent milestones`
>
> 更新日期：2026-08-12

本页只保留最近的重要结果。完整执行记录从 `docs/05-archive/progress-history/` 和各专题归档进入。

## 2026-08-12

- `用户截图否决后的 5173 运行态恢复`：用户在 active 开发环境实际看到能力映射请求失败、能力
  清单持续加载和 NIST CSF 2.0 请求失败，直接证明此前隔离 / packaged 验收不能外推到 active
  5173。根因为旧 PID 20739 自 7 月 30 日运行，进程内无新 projection 路由；受控重启到 PID
  89268 后进一步暴露 `data/database/base-manifest.json` 缺失，三条路由按合同返回 503。
- 专用任务用共享 `build_release_projection_identity()` 生成唯一新增的开发 projection manifest，
  SHA `6d86aa24...153e`；正式 base `188f20ef...cf3680`、parent `30d14679...f54c9e`、content
  `adaa19bf...5bce6` 均通过 CAS。主控复核 5173 capability-catalog / maintenance /
  shared-lookups=200、wrong ID=404，并执行真实 `dataClient` 调用链：能力目录 ready（3 / 10 /
  32 / 91）、workbench ready（136 对象 / 133 关系）、维护 ready（8 sections、160 服务）、
  standards ready（8 frameworks），NIST CSF Core 106 行 loaded。
- 验收工具根因同时修复：`dev_server_guard.py` 现在检查三条 Batch 1 projection，任一 404 / 503
  会令 overall warn / 非零；主控复验 `test_reserved_preview_port` 16/16 和 `diff --check` 通过，
  当前 guard PASS。正式双库、Excel、项目 / App 用户库未写，未读用户业务行；未使用系统 Chrome、
  未打包、commit / push、真实回退或进入 Batch 2。应用内浏览器策略拒绝 localhost，因此三个页面
  的可见 DOM / 控制台仍需用户刷新确认或另获系统浏览器验收授权，当前不声明 DOM PASS。

## 2026-08-11

- `Phase 2 Batch 1 同候选发布门完成至 Windows 权限边界`：专用任务按主控逐门授权修复 frozen
  import root、packaged handler projection 分派和 DMG 跨变体稳定 Mach-O code identity，限定六个
  production / test 文件；未复制投影业务逻辑、未启用 JSON fallback，也未修改打包脚本。主控停写后
  独立完成 `diff --check`、bundle / verifier `28/28` 和 packaged HTTP `5/5`，均通过。packaged Web
  owner audit / TC-010 通过，业务请求仅为 `/api/v1/projections/*`，`T-AS.AD-01` 为 6 服务，
  `has_measure=53`。
- 新 0.4.0 双 DMG stamp 为 `20260811-143546Z`：license SHA `29ff90cf...b620`、no-license SHA
  `4973bb7c...485`，TC-023—027 全部通过；两包 stable App code identity `9cf0dc10...d3e8`、
  Runtime core `8d5b3f84...02ab2` 一致，每包独立 codesign / 架构 / Info.plist / 空用户库 /
  manifest / Runtime / API smoke 均通过。Windows Delivery Data ZIP SHA `969c405e...ecdd`，
  integrity `ok`、FK=0、用户库未包含，base / content 与 Web / macOS 相同。
- Windows Runtime / Setup 未生成：当前 dirty snapshot 没有对应的原生 Windows x64 backend，
  retired / archive 二进制未被复用；Delivery manifest 只绑定公开 HEAD `4ea02233...b1382`，不能
  代表本地 tracked patch。下一门须用户授权 commit / push、私有不可变 Delivery Data 和私有
  Windows Runner。正式 base `188f20ef...cf3680`、content `adaa19bf...5bce6`、Excel
  `81272914...890f` 不变；5173 未操作，系统 Chrome 未启动，未执行真实回退、未进入 Batch 2。
  真实用户库未传给候选、未读业务行；验收期间有外部 App 使用该 Runtime，因此不声明全局静止。
  完整证据位于 `data/exports/worker-verify/release-acceptance/0.4.0-20260811-150420Z/gate-report.md`。
- `Phase 2 Batch 1 页面 / dataClient owner switch 主控验收 PASS`：经用户授权，专用任务将
  capability、maintenance、shared lookups 切换为 `/api/v1/projections/*`，移除当前批业务
  JSON fallback、前端 split 扫描和搜索首项自动选择；未迁移域 owner 保持不变。主控验收先用
  空 `data-root` 暴露并阻断了 TC-010 对旧 data-package owner 的隐性依赖，随后又暴露 L0 /
  L1 聚合关系重复稳定键和 catalog / ViewModel schema mode 不一致；专用任务分别以“相同载荷
  去重、冲突 fail closed”和纯 dataClient catalog adapter 最小修复，未扩大到后端全局模式或
  ViewModel 推断。
- 专用任务最终证据位于 `data/exports/worker-verify/phase2-batch1-owner-switch*`、
  `phase2-batch1-projection-dedup` 和 `phase2-batch1-catalog-adapter`；最终 catalog adapter
  patch SHA 为 `fc2a0531...3ef5`，projection dedup patch SHA 为 `58c55cf7...23a2d`。主控独立
  完成 Node syntax / fixture owner audit、正式环境 Python `22/22`（`ResourceWarning` 为
  error）、TC-010、live owner audit 和应用内浏览器 DOM 验收：全部业务 owner 请求均为
  projection API，错误 ID=404 无 fallback，L0 / L1 / L2 为 `viewmodel_fallback`、focus 为
  `backend_projection`；`T-AS.AD-01` 显示 6 服务，维护页显示 102 模块、32 措施、160 服务，
  “应用系统自身认证模块”同时关联 I-AP / I-US，控制台无 error / warn。
- 主控隔离 Runtime 使用只读正式库副本、有效临时 manifest、空 `data-root` 和 ephemeral user
  state，端口 53288 已停止且临时目录已清理。正式 base `188f20ef...cf3680`、content asset
  `adaa19bf...5bce6`、源 Excel `81272914...890f` 不变；真实用户库仍为
  `user_schema_0.3` / 23 表 / 249856 bytes，mtime 未变，未读业务行。未核对或重启 5173，
  未启动系统 Chrome，未打 DMG / Setup，未 stage / commit / push。下一门是同一候选
  Web / macOS / Windows 实包等价和整体回退验收；Batch 2 仍未授权。
- `Phase 2 Batch 1 代码整合与主控验收 PASS`：经用户授权，专用任务按封闭清单把 18 个已验收
  production / tool / test 文件安全整合到主工作区；两个已有主工作区 dirty 文件采用 hunk 级合并，
  原 lifecycle split 防护保持。整合证据位于
  `data/exports/worker-verify/phase2-batch1-code-integration/phase2-batch1-code-integration-20260811T095935Z`，
  final patch SHA 为 `c4cd56ae...798ed`，反向 `git apply -R --check` 通过。专用任务停写后，主控
  独立完成投影 / CAS `13/13`、正式投影一致性 `6/6`、Bundle / Windows identity `25/25`、
  parser / import `12/12`，均以 `ResourceWarning` 为 error；18 文件内存编译与 `git diff --check`
  通过。正式 base `188f20ef...cf3680`、content asset `adaa19bf...5bce6`、源 Excel
  `81272914...890f` 保持不变，真实用户库仍为 `user_schema_0.3` / 23 表且 size / mtime 未变。
  该代码整合检查点尚未切换页面 owner，也未写正式数据、启动 5173 / Chrome、打包、stage /
  commit / push；owner switch 随后已由本节上方独立里程碑完成，Batch 2 仍未授权。
- `Phase 2 Batch 1 relation-only 正式 apply 与主控验收 PASS`：经用户明确授权，在正式 base
  `30d14679...f54c9e`、源 Excel `81272914...890f`、content asset `adaa19bf...5bce6` CAS 和
  完整回退门通过后，以 `fsync + os.replace` 原子替换正式基础库，新 artifact SHA 为
  `188f20ef...cf3680`。主控停写后独立核对：SQLite integrity / FK 通过，4694 个对象及 owner
  全行零差异，关系 7786→7788 且无删除，仅新增 `I-AP&T-AS.IA-02`、`I-US&T-AS.IA-02`
  到“应用系统自身认证模块”的两条 `uses_measure`；provenance 为 F/G `16 / 6`，正式
  projection/API 合同 `6/6`，`has_measure=53`。
- `完整回退包主控验收 PASS`：run-scoped bundle 位于
  `data/exports/worker-verify/phase2-batch1-formal-apply/phase2-batch1-20260811T090151Z/rollback-bundle`，
  含旧 base/content asset、候选、完整 legacy Web 树和 environment 生成 JSON、当前源码 / dirty
  identity、历史双 DMG、Windows Setup、可用 manifests、实际 App 用户库只读 schema 摘要及恢复
  工具；库存为 559 文件、1,697,767,965 bytes，manifest SHA `5044be68...d5df6`。专用任务两次
  恢复演练后，主控又从持久化包独立逐文件 verify 并完成第三次 `188f20ef...→30d14679...`
  恢复演练，结果为 `integrity_check=ok / FK=0`。
- 源 Excel、content asset、533 文件 legacy Web 树、双 DMG、Windows Setup hash 均保持不变；
  实际 App 用户库 `/Users/kim1st/Documents/SAPD Wiki/Runtime/data/user/sapd_wiki_user.sqlite3`
  仅核对 schema / mtime / size，未复制、未计算整库 hash、未读业务行、未写入。本次未启动或
  重启 5173、未启动系统 Chrome、未打 DMG / Setup、未 commit / push。该正式 apply 检查点的
  页面 owner switch 当时仍 blocked，随后已由本节上方独立里程碑完成；当前 dirty Web 源码与
  历史三件桌面实包仍非共同验收发布集，Batch 2 未授权。

## 2026-08-10

- `DMG staging 链接与 Obsidian 索引故障收敛`：8 月 1 日双 DMG staging 遗留的两个
  `Applications -> /Applications` 目录软链接使物理嵌套的主 / 开发 Vault 越界遍历系统
  应用目录，并污染旧 Vault ID 对应的全局索引。移除链接并为两个 Vault 建立干净 ID 后，
  主 Vault 60 秒稳定为 Renderer `0% CPU / 约 843 MB`，开发 Vault 120 秒稳定为
  `0% CPU / 约 394 MB`；旧状态为三分钟后仍约 `100% CPU / 4.8 GB`。`package_dmg.sh`
  现只在仓库 / Vault 外的系统临时目录生成镜像 staging 和安装链接，成功后保留无外部链接的
  staged App，失败或中断时统一清理临时目录；macOS parity 合同新增路径和当前残留检查。
  Bash 语法、合同审计和 `git diff --check` 通过；未重打 DMG，未修改正式数据、SQLite、
  真实用户库或历史交付物。

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
