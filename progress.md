# progress.md

> 状态：`active / recent milestones`
>
> 更新日期：2026-09-17

本页只保留最近的重要结果；历史记录从 `docs/05-archive/progress-history/` 进入。

## 2026-09-17

- `安全运行 R2.1 独立审阅 Demo / 主版本边界`：将当前安全运行七页及其 28 个图示资产提取为独立可运行 Demo：`demos/security-operations-r2/`（本地预览 `http://127.0.0.1:5192/index.html`）。Demo 仅读取自带 `data/snapshot.json`，无 `/api/v1`、SQLite 或用户库依赖；845 / 1280 / 1920 / 3440 视口矩阵通过，图谱 35 节点、35 条可见边、0 overlap、无整页横溢出；正文 104 标题、28 图示及资产 → 暴露面 → 原文阅读路径通过。主版本移除安全运行前端入口、专用 API / backend route、candidate 配置 / 脚本 / 数据包和专用测试，历史 route 保留明确 placeholder；`viewModels.js` 中“安全运行类安全技术服务”正式业务分组保持不变。可恢复备份为 `artifacts/security-operations-r2-extraction-backup-20260917/`，`MANIFEST.json` SHA-256=`b17a4c42d199d9d6296afb4278843083ca5001660e5e782f3ed65376fccef7a8`。frontend / renderer / MCP 定向测试、静态边界审计、语法与 diff 检查通过；macOS / Windows placeholder staging 均未包含 Demo 或 SOK 路径，合成 macOS backend health / projection 通过且旧 SOK API 404。未复制或写入真实正式库 / 用户库，未 formal apply、未提交 / 推送、未生成 DMG / Setup；原生 App、Windows GUI 和未来迁移 UAT 仍未验证。
- 追加当前剥离源码验收：临时 5189 源码服务使用正式 base/content 只读库与 `memory://isolated-web-dev` 用户态，首页、能力字典（含 L0→L2→关注点）、成熟度工作台、`RASP` 搜索及结果跳转均通过，控制台无 error；`/api/v1/security-operations` 返回 404，历史 `#/security-operations/*` 仅显示“安全运行页面已移入独立审阅 Demo”提示且不加载 SOK workspace。验证后已停止 5189；stable 5173 未重启、未借其旧进程结果替代当前源码验收。
- `0.4.2 源码版本统一 / 前置状态记录`：Electron、macOS、API / CLI、本地服务、Windows runtime 及相关审计 / 测试默认版本已统一为 0.4.2；本轮不生成 DMG / Setup / Release，不 dispatch workflow。9/17 的 0.4.1 DMG 为 pre-dmg 门禁未过候选；历史 0.4.1 Windows Public Run `35186432363` 成功，Synthetic Run `35186801694` 因名称校验失败；当时两文件私有补丁尚未推送。
- `0.4.2 源码冻结 / 待打包`：上述版本 owner 与共享前端搜索 / 批注修复已完成源码验收，Public 源码待以本轮最终 checkpoint 作为双平台唯一 `source_sha`；0.4.2 尚无 DMG、Windows Setup 或 Release。旧 Public/Synthetic Run 仅作 0.4.1 历史证据；私有 Synthetic 修复已推送为 `f8346be`，本轮不触发 workflow。

## 2026-09-14

- `安全运行资产知识阅读路径 / 5173`：用户指出原验收忽略正常导航体验后，改为“导航图 → 独立阅读状态 → 返回原图”。主控实际从图谱点击资产，1280×720 首屏可见正文及继续阅读；暴露面 → 漏洞 → 威胁、关系原文、Esc、浏览器 Back、原图节点及键盘焦点恢复通过。845 窄屏可读；2560 / 3840 阅读区沿共享自适应保持合适行宽，无横向溢出。定向测试 10/10，最后焦点修改相关 3 项复验通过；旧 32/32 只保留为上一轮机制检查。改动限 shared frontend 组件、模块样式和测试；数据 / API / 用户库未改，未新增哈希或安全校验机制，未提交、推送、打包或设定时任务。只验本条路径及 5173 Web，不代表其他六页、整个知识产品或 App 完成。详见 `frontend/design-handoff/implementation-specs/asset-knowledge-path-design.md`。

## 2026-09-08

- `安全运行 R2 七页 / 5173 主控 Web 验收`：保留已集成的 35 节点 / 35 来源关系 Atlas，完成其余六页的按需 Context、真实来源阅读与缺失态。主控首轮退回 7 项问题，复验再退回暂缓筛选口径；最终修正后验收通过：13 运行活动、603 威胁来源记录、9 域 / 458 问题、59 指标（53 暂缓）、8 来源、01-010 的 104 标题 / 28 原图。六页 845 / 1280 / 3008 / 3840 实际视口无整页横向溢出，窄屏问题域横向滚动及末项可达；关闭 / Esc 焦点回返、未知记录 / 章节 fail closed、状态筛选刷新与跨页 Back、零结果清旧详情通过。主控前端定向 29/29；执行任务正文渲染 5/5、语法与 diff 检查通过。验收组件 SHA `d14c097c…`、CSS `0d19ba83…` 与最终文件一致；开发任务已停止写入。仅 shared frontend / 5173 Web 验收，未重跑完整 API 或 App / DMG 验收，未修改源数据 / 正式库 / 用户库，未提交、推送、打包；不设定时任务。

- `MaturityAssessmentWorkbench L2 下级统一评估设置`：L2 能力范围覆盖 FOCUS 直接项与 SERVICE 项；当前 / 目标独立锁定、清空与既有逐维上下界保持一致，统一写入仅作用适用项，清空可处理不适用草稿且保留当前说明、证据和适用性。新增真实事件 / VM 隔离回归通过混合项、部分评分 / 复核、目标独立性、不适用、只读、取消确认、兄弟 L2 隔离、保存重载和 FOCUS 旧入口；`node --check`、`git diff --check` 通过。主控在隔离 54173 运行态完成 L2 评分、清空 / 重设、1920 与 1366 容器布局及 console 验收；未写真实用户库、未提交 / 推送。

## 2026-09-07

- `OI-201 图谱与七页重设计最终 Web checkpoint`：01-000 唯一主轴；8 来源、43 节点 / 57 关系，21 条跨材料关联待业务确认；整体设计 V2、PRD、页面、数据/API/MCP 合同已同步。定向 32/32（frontend 27 + helper 5），API 21 PASS + 1 SKIP；5173 PID 22252 guard PASS，候选 SHA 未变。
- 主控在实际 1920 / 1280 验证图谱 / 根页面无横向溢出，console=0；图谱查询、来源回链、精确章节与能力往返、缓存 focus 选中和自动分页 / 手动分页不回拉、无结果清旧详情通过。正文保留 104 标题、28 原图，14 表格 / 19 rowspan；MCRA 61 与最终截图已同输入比较。845、全量无障碍、App / DMG 未验；candidate-only，未正式 apply / MCP 激活、提交、推送、打包或发布。

- `OI-201 早期 MCRA 导航 checkpoint（本轮重设计前，非当前验收）`：前端定向测试最终 12 / 12；主控当前 5173 Web 运行态在 845 / 1280 / 1920 视口无 root 横向溢出，1920 主图底座首屏完整；分支刷新、文档深链返回、旧 `chapter6` 兼容恢复、未知节点提示、关闭 hash 清理、Esc focus 回原触发及 `inert=0` 通过。此处仅记录 本轮 Web 验收，未重跑旧 candidate / API 数字，App / DMG / formal MCP 不在本轮范围。

## 2026-08-25

- `stable 5173 安全运行恢复 / 启动合同修复 PASS`：修复“通用 health 通过但候选未绑定”的假健康； 当前候选和 28 图预览包已固化到项目候选目录，guard 同时校验文件 SHA、接口 200 与实际 digest。 定向 19 / 19 tests、普通启动、浏览器 01-000 / 五节点和 console 均通过；PID 76948，5189 已停止，正式双库、用户库和来源未写。
- `OI-201 总体思路来源主轴重构 / 主控运行态验收 PASS`：`总体思路` 不再使用六阶段整理稿，改为 以 `01-000 保护对象牵引的安全运营总体思路` 为唯一主轴；第 1—3 章为背景，第 4 章五个核心 思路为可互动核心，第 5—8 章逐层展开，第 9—10 章收束。V0.2、调研方案、威胁资料与指标资料 只作为对应章节的深化入口；`30-010` 降为 V0.2 体系内的数据视角补充，不形成第二主线。 新候选 bundle SHA-256 为 `5fb801e33ef6bf907cd92179735c8ea34f47073a1f04b29fe73665fedeba68a6`； candidate 27 / 27、API 22 / 22、frontend 12 / 12、独立 audit PASS。主控在隔离 5189 预览完成 1024 / 1280 / 1920 / 2560 / 3396 五档验收，无整页横向溢出或正文尾部空白，核心节点定位与 V0.2 章节深链通过，console error=0。正式三库、用户库和来源未写。

## 2026-08-24

- `OI-201 candidate-only 投影更新 / 页面职责重建`：当前权威 bundle SHA-256 为 `c03cded4bc57fb4986c24fb603bda564b0dcdc36ea66b3c010b5516565de1785`；包含 2445 个知识项、 2096 条关系、393 个 section、458 个调研问题、59 个指标、8 个来源与 4 个显式缺口、119 条 能力映射（`formal_active=0 / policy=66 / deferred=53`）和 603 条当前威胁记录。候选 27 / 27、 API 22 / 22、独立 audit PASS，candidate 与正式 MCP 隔离保持成立。
- `WP5 Web 运行与回归验收 PASS`：stable 5173 PID 40320 的六页在 1280 / 1024 / 1920 三个视口通过；筛选切页后恢复、控制台无 error、页面整体无横向溢出。前端定向测试 10 / 10、API 19 / 19、MCP 49 / 49、交付回归正确环境复跑 57 / 57，独立 WP5 audit PASS。 首次 quick suite 的 6 项失败是缺少 `PYTHONPATH` 与沙箱 loopback 限制，正确环境复跑全部通过，不作为产品缺陷。
- `用户技术审核队列取消 / source-only 边界固化`：技术身份、236 / 264 等能力映射旧审核流和逐图确认不再作为用户待办；来源充分且关系合理的映射默认接纳为候选，证据不足由系统暂缓，28 张图示原样保留且不确认图意、不提供原件下载或外发。 人工内容复核仅为可选产品 / UAT 反馈，不阻断 Gate。本轮未写正式 base / content、来源或用户库；formal freeze / apply、App / DMG、Windows、commit / push、打包和发布仍未授权或未完成。
- `OI-201 页面设计复核与运行态验收 PASS`：七个独立 Tab 已按职责收敛。总体思路显示六阶段 `整理稿 · 待确认`、真实来源依据和可达链接；完整正文只显示 `实战化安全运行解决方案（2025版 V0.2）` 的 104 个正文标题节点与 28 张原图，目录独立按需打开， 不再在正文重复源目录；运行体系只显示 13 / 8 / 7 三组主题和 58 条相关映射，去除空说明与全文。 前端 12 / 12、diff-check、内置浏览器 1280×720 的目录定位 / 刷新恢复 / 原图放大 / 来源跳转通过， console error=0、整页无横向溢出。stable 5173 PID 58567；不代表 App / DMG 或正式 apply。

## 2026-08-18

- `stable 5173 Runtime 恢复 PASS`：清理旧监听并恢复 PID 8893；项目根目录、正式 base / content 双库、真实用户库、data root、export root、`stable` 标签和 persistent CurrentUser MCP 身份全部 匹配，home / health / workspace 与三条 Batch 1 projection 均为 200。一次受沙箱阻止的本地连接 曾被误判为服务失效，获准的回环验收已排除该误判。真实用户库 SHA-256 前后保持 `0e3db1224b4c2044bcd0dfe4a7fbe9e3e5a28cf081a8ab1ff0b2622030c0af81`。
- `成熟度脑图拖动第一阶段主控验收 PASS`：document 高频 mousemove 由 rAF 合并，候选矩形按失效 条件缓存，drop target 仅在变化时更新，ghost 跟手延迟和全页 dragging 样式重算已收窄，边缘平移 使用独立帧循环。运行态 5.34 秒内 14,717 次 mousemove 合并为 330 帧，p95=0.4 ms、p99=0.5 ms、 Long Task=0；同级移动、46px / 88px 跨层级吸附、持久化、自动平移和滚动通过。写集保留未提交。
- `Windows watcher 根因确认`：私有提交 `e46f8384…` 后的 schedule watcher 仍锁定旧 `windows-data-20260727-r1`，并把失败结论视为下一轮可自动重试，造成 Run 32100869419、 32102863152、32104736344 连续触发。最新 Run 使用正确 public SHA `d2a644c4`，但旧数据只有 51 个 measure 且缺两份 workbench JSON，因此在 Phase 2 门禁停止；没有 Runtime / Setup / Internal Release，正式数据和用户库未写入。修正由指定 Windows 专用任务在隔离 checkout 处理， 未获 commit / push / dispatch 授权前不改变远端状态。
- `Windows 改为严格手工打包 / 本地补丁 PASS / 未上线`：按用户更正的产品合同删除 `watch-public-main.yml`，彻底移除 schedule、空闲期 manifest / hash 检查和自动 dispatch；只保留 人工 `windows-installer.yml` 入口。人工构建启动后才一次性校验 archive / base / content SHA、 不可变 Release、manifest 与 `user.status=not_included`。精确差异 `+41 / -123`，Workflow YAML、 Bash、权限及手工触发合同通过；本机无 pwsh / actionlint，未做 PowerShell 专用解析或 Windows Runtime 验收。当前无排队或运行中 Run；私有远端仍是 `e46f8384…`，旧 watcher 在补丁推送前 仍可能再次触发，私有 README 的“自动检查”说明也待同步。
- `公开源码与私有手工打包合同已推送`：公开仓提交 `4f9090440c5e295bf7ac289c67e99990690adf61` 含精确 5 文件，成熟度 63 项、P2 43 项、文档治理、 5173 guard 与 GitHub 数据边界通过；私有仓提交 `966c2f64af149db3cc2a6c3398868159561d9493` 含 README、删除 watcher、收紧 installer 三项。 远端已确认无 schedule，Windows installer 仅 `workflow_dispatch`；两仓 main / origin 均 0/0， 推送未触发 Windows Run。上一条“未上线”记录作为执行前阶段证据保留，当前状态以本条为准。

## 2026-08-13

- `Windows workflow Artifact 峰值优化已提交 / 未 dispatch`：Run 31687536086 日志复核确认 Delivery Data 下载、分片大小与 SHA-256 校验均成功，唯一失败点为约 198 MB 中间 Artifact 上传命中配额。私有仓提交 `e46f8384bc5c1175eac4786b6a3971b485240b17` 删除该中间 Artifact，build 直接读取不可变私有 Release；执行公开源码的 job 只有 `contents:read`， 无发布权限，令牌只显式注入首个受控下载步骤。安装器 Artifact 保留期改为 1 天，发布成功后 由独立 `actions:write` job 按上传返回的 artifact ID 精确删除。YAML、固定 Action SHA、 job 权限与边界断言通过；未触发 Runner、未生成 Setup / Release，正式数据和用户库未写入。
- `成熟度高分辨率与存储诊断主控验收 PASS`：源码区分 viewport 与逻辑坐标，只在进入图谱模型 时按 adaptive scale 换算；`elementFromPoint` 保持原始坐标。右键菜单删除快捷装饰，保留业务 动作和下级数量；渲染后按真实矩形二次收口。主控隔离复验 1920×1080 与 3008×1092，后者 节点菜单 `top=574.08 / bottom=1072.99 / height=498.91`，编辑属性可用，画布菜单在界内， 控制台无 error。模板合同 61/61、P2 43/43、V2.1 236/236、XLSX 23/23 通过。
- `本地存储失败分类 PASS`：读取拒绝、损坏 JSON / 结构、序列化、QuotaExceeded、DOMException 和未知写错均保留中性诊断；读取异常 fail closed，不用空对象覆盖原数据；真实 WKWebView 保存 仍留待新 DMG 状态保护验收。
- `Keychain 源码修复已验收`：条目访问修复使用 App 内原生 helper，失败不改变 secret bytes、 CA/server 指纹或 OAuth；确认仅消费一次，失败审计和精确 recoverable error 已有永久测试。 未触碰真实 Keychain 或 28775/28776，需在新 no-license DMG 做覆盖升级验收。
- Git 专用任务对当前 30 个源码文件完成范围、GitHub 数据边界、Keychain/MCP 53/53、系统设置、 成熟度及交付定向门；因旧 `CURRENT_STATE.md` / `progress.md` 超行而按合同停止，未 stage、commit 或 push。主控随后将当前状态、进度和计划压缩为最新 0.4.1 事实，等待重新 checkpoint。

## 当前保护边界

- 不把 `data/`、SQLite、DMG、Setup、恢复包、虚拟环境、`node_modules` 或生成底图加入 Git。
- 不用 5173、旧 DMG 或旧 Windows Run 代替同一新 SHA 的双平台实包验收。
- 测试默认使用临时数据；真实用户库、Keychain 和正式双库不得作为写目标。
