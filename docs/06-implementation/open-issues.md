# Open Issues

本文件现在只保留当前仍需处理或确认的问题、问题模板和治理入口。已关闭问题的完整记录已归档，避免当前入口继续膨胀。

## 治理入口

- 当前未关闭问题数：4
- 已关闭归档问题数：192
- 全量索引：`docs/06-implementation/open-issues-index.md`
- 已关闭问题归档：`docs/05-archive/open-issues-history/2026-06.md`
- 重复编号待治理：`OI-044`、`OI-092`，索引中使用 `OI-xxx#n` 区分历史条目。

## 建单门槛

默认不为小问题新建 `OI`。小问题应直接修复、在 `progress.md` 记录，并在任务完成反馈中给出验证结果和必要的页面验收入口。

不建单的典型情形：文案、轻微样式、单页局部交互、小范围空态；本轮可直接修复且自动验证已覆盖；不涉及业务判断、数据源、审计矩阵、安全边界或多页面契约；代码清理、命名修正、测试补充。

满足以下至少一项才建 `OI`：影响多个页面、多个数据域或全局契约；涉及源 Excel、SQLite、正式 JSON、字典、标准、LC、环境、导入或导出边界；涉及安全、用户数据、GitHub 同步边界或本地 API/token 边界；需要新增 / 扩展审计脚本、防回归矩阵或长期观察；需要用户业务判断或人工验收后才能关闭；本轮无法完整修复，或严重性为中 / 高。

修复后处理：自动验证已覆盖、无需用户业务判断的问题，可以直接标记为 `已关闭 / 自动验收通过` 并归档；需要用户验收的问题，状态可为 `已修复 / 待用户验收`，但最终反馈必须给出固定入口、导航路径、预期现象和关闭条件；用户确认后必须及时关闭 / 归档，不能长期停留在“已修复 / 待页面验收”。

## 当前未关闭问题

| 编号 | 状态 | 标题 |
|---|---|---|
| OI-199 | 0.4.0 自动矩阵通过 / 人工安装态 UAT 非阻塞保留 | 本地 MCP 正式知识访问已接入，安装态与客户端矩阵仍待完成 |
| OI-200 | 已规划 / 待用户明确启动，不进入当前开发 | MCP 2026-07-28 双时代协议与 Web/App 前端分流 |
| OI-197 | V3 提案已就绪 / 分批业务复核中 | 成熟度评分依据与当前能力字典尚未全量映射 |
| OI-138 | 暂不修复 / 已回退 | 关注点关系图谱标签与节点 / 连线碰撞 |

## 最近关闭问题

| 编号 | 状态 | 标题 |
|---|---|---|
| OI-128 | 已关闭 / 自动验收通过 | USER-WRITE-UI-1：批注 / 工作台用户写入入口 |

## 问题记录模板

## OI-000：问题标题

- 状态：
- 严重性：低 / 中 / 高
- 类型：数据 / 前端 / ETL / 文档 / 需求
- 对象或页面：
- 现象：
- 影响：
- 建单理由：
- 当前处理：
- 需要确认：
- 验收入口：
- 关闭条件：
- 修复说明：
- 验证结果：

## 当前问题详情

## OI-199：本地 MCP 正式知识访问已接入，安装态与客户端矩阵仍待完成

- 状态：0.4.0 自动矩阵通过 / 人工安装态 UAT 非阻塞保留
- 严重性：高
- 类型：架构 / 本地 API / OAuth / TLS / 数据授权 / 审计 / macOS / Windows
- 对象或页面：本地 MCP Sidecar、正式基础库只读 Runtime、Codex MCP 配置、系统设置 AI 集成页、独立 MCP 控制面、macOS / Windows CurrentUser 信任。
- 现象：正式知识访问、OAuth/Streamable HTTP、固定 5 个 Tool、Web 控制面和隔离 Sidecar 已实现；macOS Web 开发入口已完成真实 CurrentUser 证书、Keychain 密钥、系统信任、MCP 启停和一个当前 Codex CLI 版本的五工具真实闭环。Windows 私有 Runner 已能生成包含 MCP backend 的完整 `Setup.exe`。2026-08-01 已从当前工作树构建 0.4.0 license / no-license 双 DMG 并通过自动 release matrix；仍未完成 macOS 最新实包人工路径、Windows 10/11 安装态、目标客户端版本和双时代协议矩阵。
- 影响：知识查询功能和 Windows 可重复构建链路已经可用，但在真实安装态与客户端矩阵完成前，不能宣称跨版本 Codex 或 macOS / Windows MCP 实包交付全部通过。
- 建单理由：涉及跨平台 App、OAuth/TLS、本地 API、正式基础数据、来源许可、审计和用户隐私，且本轮只完成设计合同，无法自动关闭。
- 当前处理：用户已明确裁定正式基础知识库全部业务内容可由 AI 调用。正式 `MCP-BASE-KNOWLEDGE-ACCESS-v1`、只读 Runtime、固定参数化查询、系统设置说明和 Web Sidecar 已统一落地；Keychain 故障处理保持 `36 / 51` 临时错误分类、明确解锁提示、运行中 Sidecar 保持和解锁后手动重试。0.4.0 双 DMG 的 pre-DMG、签名、挂载、Runtime 和空用户库自动检查已通过。2026-08-03 App MCP `28776` 仍监听且 Token 持续刷新，但最新 `TOOL_CALL` 仍为 2026-07-28，不能作为 0.4.0 实包五工具证据。同日静态核对私有 GitHub workflow 发现 watcher 未向 builder 传递必填 `app_version`；手工 dispatch 可显式传值，自动触发在修复并成功运行前不得声明健康。
- 需要确认：人工 UAT 作为持续保留的非阻塞项，条件允许时在现有 0.4.0 实包验证首次路径、完全退出重开、锁屏 / 解锁恢复，以及 App MCP `28776` 的 OAuth、五工具和新 `TOOL_CALL` 审计；不要求为完成该项立即重打包。未完成只阻止“最新实包完整 UAT”和正式外部分发声明，不阻塞当前内部开发。Developer ID、notarization、stapling、Gatekeeper、真实 Windows 10/11 和目标客户端矩阵仍需独立验收；OI-200 未获启动授权前不改变当前 canonical 版本。
- 验收入口：`/settings/ai-integration`、`docs/01-architecture/contracts/mcp/base-knowledge/v1/`、`tests/mcp/test_base_query_service.py`、`tests/mcp_e2e/test_web_dev_mcp_e2e.py`。
- 关闭条件：目标 Codex 版本在 macOS/Windows 最新实包中完成 HTTPS、发现、注册、PKCE、resource/audience、五工具调用、刷新、撤销、升级/回滚/卸载和负向安全矩阵；macOS 登录钥匙串临时不可访问时不误判为密钥永久丢失，不删除或重建健康证书，解锁后按明确路径恢复；真实 CurrentUser 信任与密钥保管验证通过；MCP 始终不创建、打开或修改用户库。OI-200 不阻塞当前 Legacy 交付关闭，且不得直接替换现有稳定协议。
- 修复说明：新增正式基础知识库访问合同与 scope `sapd.base.knowledge.read`；Sidecar 改为只读打开正式基础库并通过 5 个固定工具返回全部业务对象内容、关系和脱敏来源证据。旧 synthetic 公开摘要合同保留为历史测试基线。系统设置明确显示“基础知识库全部业务内容，包括完整标准正文”，并继续排除用户数据、源文件本体、本地路径、系统配置与凭据、日志和非受控 SQL。
- 验证结果：2026-07-26 Web `28775` 五工具和审计闭环通过；2026-07-28 回退后的 MCP 完整套件 `218 PASS / 5 SKIP`、证书 / Sidecar 专项 `33/33`、前端 AI 集成合同和 SwiftPM 编译通过。2026-08-01 0.4.0 双 DMG 自动 release matrix、`hdiutil verify`、只读挂载、Runtime `--check-only` 和隔离启动通过，正式双库只读且包内用户库为空模板。2026-08-03 `28776` 监听与 Token 刷新仍正常，但没有 0.4.0 实包产生的新五工具 `TOOL_CALL`；人工路径、Windows 安装态和目标客户端矩阵继续保留。
## OI-200：MCP 2026-07-28 双时代协议与 Web/App 前端分流

- 状态：已规划 / 待用户明确启动，不进入当前开发
- 严重性：中
- 类型：架构 / MCP 协议 / OAuth / shared runtime / Web / App / 客户端兼容 / 打包
- 对象或页面：`src/sapd_wiki/local_mcp/transport.py`、五工具注册与 OAuth、`/settings/ai-integration`、Web MCP `28775`、App MCP `28776`、Codex、WorkBuddy / `mcp-remote`、macOS / Windows 打包运行时。
- 现象：当前服务固定以 MCP `2025-11-25` 为 canonical 版本并依赖 Python MCP SDK v1；MCP `2026-07-28` 和 Python SDK v2 已正式发布，但当前 WorkBuddy 链路中的 `mcp-remote 0.1.38` 仍使用旧版 `initialize` 流程，Codex 对新版协议的实际协商和 OAuth UI 兼容矩阵尚未形成发布证据。直接替换旧协议或拆分多套开发环境都会扩大当前稳定链路风险。
- 影响：若维持旧协议，现有客户端可继续工作，但未来只支持 `2026-07-28` 的客户端可能无法连接；若直接切为 modern-only，则 WorkBuddy 和旧 Codex 会中断。Web 与 App 共用前端代码，但必须分别控制各自后端和 Sidecar，不能因协议升级发生端口、证书、授权或控制状态串线。
- 建单理由：涉及协议、OAuth、安全、Web/App 共享前端、客户端矩阵、打包与回退边界，需跨版本长期验证；用户明确要求先保留计划，只有后续再次明确要求开发时才执行。
- 当前处理：采用“一套代码、一个依赖环境、两个产品端口、每个端口一个双协议服务”的方案；不建立额外虚拟环境、长期 Sidecar、协议专用端口或并行代码分支。`28775` 始终属于 Web，`28776` 始终属于 App；同一 `/mcp` 端点按客户端自动协商 Legacy `2025-11-25` 或 Modern `2026-07-28`。开发顺序固定为：先在当前 SDK 下增加不改变行为的协议适配层；随后在同一依赖环境中一次性升级 SDK，但仍以 legacy profile 验证旧链；再仅在 Web `28775` 启用 dual 作为先行门禁；最后经打包与客户端矩阵通过后才在 App `28776` 启用 dual。不得把协议选择作为普通用户开关。
- 前端分流：继续复用同一前端 bundle 和相对 `/api/v1/*` 数据入口，由后端控制快照以向后兼容的可选字段返回 `runtime_surface=web|desktop_app`、`protocol_profile=legacy|dual` 和 `supported_protocol_versions`。Web 页面只显示、复制和控制 `28775`，建议配置名 `sapd_wiki_web`；App 页面只显示、复制和控制 `28776`，建议配置名 `sapd_wiki_app`。WorkBuddy 正式引导只由 App 当前 Runtime 生成 `28776` URL 与 CA 路径；Web 只提供当前 `28775` 的开发测试配置，不推测或跨控 App。客户端第一次成功调用后可记录最近协议版本和连接方式，但 OAuth 授权不按协议重复创建。
- 不变边界：继续保留 DCR、旧 `initialize`、五个只读工具、现有 `/mcp` URL、OAuth scope、控制库、token/refresh token、证书、Keychain / DPAPI、端口分工和用户数据边界；不得为协议升级重新生成证书、清空授权、修改真实用户数据库或停止另一运行面的 Sidecar。现代协议能力只允许增量加入，不得删除 Legacy 直到目标客户端矩阵明确允许。
- 需要确认：只有用户后续明确提出“开始 OI-200”后才允许升级 SDK、增加 dual profile 或修改前端协议呈现；在此之前保持当前 canonical `2025-11-25` 和运行行为不变。
- 验收入口：Legacy `initialize → tools/list → tools/call`；Modern `server/discover → tools/list → tools/call`；`/settings/ai-integration`；Codex 直连；WorkBuddy → `mcp-remote` → App `28776`；Web `28775` / App `28776` 并行进程、控制状态、OAuth、证书与审计隔离矩阵。
- 关闭条件：`28775` 与 `28776` 均在同一端点稳定支持双时代协议；WorkBuddy 旧链和目标 Codex 版本通过 OAuth、五工具、刷新、撤销、重启和负向安全矩阵；Web/App 前端只控制各自运行面；macOS / Windows 安装态通过；legacy 回退不改 URL、证书、授权或用户数据。只有目标客户端不再需要 Legacy 且用户另行批准，才可讨论移除旧协议。
- 回退方案：第一层把内部 `protocol_profile` 从 `dual` 恢复为 `legacy`，不改变 URL、证书和授权；第二层保留当前 `mcp==1.28.1` 依赖锁与 0.3.0 App 构建产物，在 SDK v2 本身回归时恢复已记录的依赖与适配层变更。回退不得删除控制库、token、Keychain 条目或用户数据。
- 修复说明：本 Issue 仅固化后续开发方案和边界，当前未升级 MCP SDK、未实现 modern 协议、未修改前端、未改变运行中的 `28775` / `28776`。
- 验证结果：计划建立时确认当前 `mcp-remote 0.1.38` 内置 `@modelcontextprotocol/sdk 1.25.3`，仍以 `2025-11-25 + initialize` 工作；当前代码依赖锁为 `mcp==1.28.1`。阶段 0 的 OAuth discovery issuer 精确匹配作为独立小修复实施，不视为 OI-200 已启动。
## OI-197：成熟度评分依据 V3 提案业务复核

- 状态：V3 提案已就绪 / 分批业务复核中
- 严重性：高
- 类型：数据 / 成熟度 / 当前字典 / 源 Excel / 业务确认
- 对象或页面：成熟度基础模板中的 3 个 L0、10 个 L1、32 个 L2、91 个关注点、160 条关注点—安全技术服务关系和 185 个评估点。
- 现象：早期映射审计识别的 8 个名称漂移和 7 个无来源关注点已经纳入统一 V3 业务审阅提案。当前已形成指南 v1.4、91 个关注点评分基线主表、差异说明、185 个评估点 / 3,700 个等级维度单元的离线工作台和结构化提案，但尚未取得完整业务裁定和正式迁移授权。
- 影响：V3 提案可以继续审阅和修订，但在业务裁定完成前不能替换正式 V2.1 Rubric 字典、评分规则、API、XLSX、正式数据或历史结果。
- 建单理由：涉及源 Excel、受保护当前字典、成熟度评分对象粒度、导入 / 导出和业务判断，且本轮无法自动关闭。
- 当前处理：采用分批复核，不要求用户一次人工逐格验收全部 3,700 个单元。第一批确认连续等级范围、自定义模板通用基线、T-IN.IP L2—L5、T-OF 条件适用与 L3 起评、L4 的受控运行 / 可比较结果 / 偏差纠正 / 效果验证，以及 L5 去 AI 必选化；第二批只处理工作台中被否决或标记争议的对象。早期 15 项映射裁定继续作为重点对象，不再单独维护另一套候选表。
- 需要确认：用户先裁定上述全局规则和例外，再按争议对象复核拆分 / 补齐 Rubric、建议校准标题和具体评分文字；未标记争议的对象保留当前 V3 提案。指标库已经退出本轮正式提案，未来如立项必须另行确认来源、口径、数据质量和批准机制。
- 验收入口：`docs/08-maturity/oi-197-maturity-rubric-review-workbench.html`、`docs/08-maturity/sapd-v3-scoring-baseline-master.md` 和结构化提案 JSON。
- 关闭条件：91 个关注点、160 条服务关系和 185 个评估点全部唯一绑定评分依据，争议项有明确裁定，生成物与审阅结果一致；随后由用户另行决定是否授权正式迁移。
- 修复说明：当前仅推进业务审阅提案、生成器和契约审计，不修改当前字典、源 Excel、正式 JSON / SQLite、正式评分数据、历史项目、用户库、ETL 或 DMG。
- 验证结果：V3 提案保持 91 个关注点、160 条服务关系、185 个评估点和 3,700 个等级维度单元；2026-08-03 当前工作树成熟度合同 `236 / 236` 和相关 Python 语法检查通过，当前正式 V2.1 和保护数据未被替换。
## OI-138：关注点关系图谱标签与节点 / 连线碰撞

- 状态：暂不修复 / 已回退
- 类型：前端 / 图谱布局 / 设计
- 对象或页面：`安全能力映射` 关注点关系图谱，路由 `/capability-mapping`，组件 `LocalRelationNetworkGraph`。
- 现象：用户截图指出关注点图谱中部分圆点、标签和连线仍存在碰撞，例如底部节点标签贴近或压到纵向连线，局部空间没有被充分利用。
- 影响：图谱阅读时会误解节点归属或连线路径，降低关系图谱作为“关系检查视图”的可读性。
- 当前处理：2026-06-08 已按“小步修正、不大调”的原则，仅在 `LocalRelationNetworkGraph` 中新增标签候选位选择器。每个非中心节点标签会在右、左、上、下和四个斜向位置中选择碰撞成本最低的位置，避让其它节点、已放置标签和主要连线；节点布局、业务关系、颜色语义和整体图谱结构不变。Canvas 新增 `data-layout-label-overlaps` 指标，便于后续回归。用户反馈首次修复后页面“没有变化”，复查发现动态加载的 `LocalRelationNetworkGraph.js` 版本号未递增，浏览器可能仍使用旧组件；已同步递增 `app.js` 和图谱组件动态加载版本，并提高曲线路径避让权重、让外圈叶子节点优先把标签放到上下外侧。随后用户继续通过 Product Design 复核指出截图中仍能看到曲线贴近 / 穿过非目标节点附近；已追加轻量边线避障，不移动节点，只在普通曲线靠近无关圆点时调整控制点向外侧绕开。2026-06-08 曾尝试为具体关注点图谱新增结构化径向扇区布局，但用户明确反馈“不是扇区，而是星形分布，分散的，不碰撞”；现已撤回 `focus_relation_overview` 扇区策略，恢复原先星形 / 力导向分散效果，只保留并收紧标签候选位和边线轻量避让，避免因硬分区造成节点集中。2026-06-08 用户进一步指出“节点碰撞=0”不能代表最深层连线不交叉；已将图谱质量指标扩展为四项：`data-layout-overlaps`、`data-layout-label-overlaps`、`data-layout-edge-crossings`、`data-layout-edge-node-intrusions`，分别覆盖节点、标签、边线交叉和边线侵入非端点节点安全区。2026-06-08 按用户明确复现对象 `T-AS.AD-01` 重新测试后确认，默认图谱测试无效；真实对象初始为 `edgeCrossings=5`、`edgeNodeIntrusions=2`、`labelOverlaps=1`。当前已针对技术视角分支做局部解缠：只处理 `view_technical` 下的作用域 / 服务 / 模块子树，按作用域语义让数据、网络、物理、软件、主机、硬件分散占位，用户截图中的 `软件应用` 与 `数据与信息 -> 数据分库分表 -> 数据安全存储` 局部交叉已消除；全图仍有管理视角 2 处交叉、标准分支若干侵入和 1 处标签重叠。2026-07-06 用户明确要求 `OI-138` 不关闭，作为老问题长期保留，后续想修时随时继续。
- 最新处理：2026-07-14 用户裁定按冻结清单完整回退 P0-3。全量 91 个关注点复核证明上一版仍有跨对象标签重叠、连线侵入 / 交叉，`T-AS.AD-02 / 03` 未解决，标准分支仍可出现 UUID 编码节点，“恢复自动布局”业务含义不清且部分场景无可见效果。上一版只通过少数黄金对象和合成压力图，不能作为系统性修复。
- 需要确认：本轮无需页面验收，回退已由文件哈希和自动回归确认。后续保持此 Issue 打开但暂停；只有用户重新启动该问题时，才进入新的全量业务设计与验收方案。
- 关闭条件：用户明确接受旧版碰撞为长期限制并要求关闭，或未来独立方案通过全部 91 个关注点、UUID 禁显、控制语义、几何指标和人工可读性验收。不得用少量黄金样例关闭。
- 修复说明：本轮恢复 `app.js`、`styles.css`、`LocalRelationNetworkGraph.js` 到冻结的实施前 SHA-256；`relationGraphModel.js` 未修改。删除 P0-3 控制器、视图策略、配置、专项审计，移除测试套件 / 脚本索引挂钩并恢复前端治理基线。2026-06-08 以前的星形图谱基线与轻量避让保留，P0-1、P0-2、P0-4 及其他活动改动不变。
- 验证结果：回退后三项运行文件哈希分别为 `0d0e742642c17c5fd490fab737dfdba15d5573d6c4dd253e434f1ebec55f0c4b`、`9ccaedf89190bacc74fa1a37781047cb62e88b409b8ebb3d9a3462e6839ec31b`、`4726413d5504c76174b1783d6898c76c09838faf2237ca83a550d0dcfe316fee`，与冻结备份一致。完整 `static / frontend`、P0-1、P0-2、P0-4、能力 ViewModel、前端治理、capability HTTP/API smoke、5173 守护和定向 JS 语法通过；P0-3 专项已删除 / 停用，不计为通过。旧版图谱碰撞仍是已知限制。
## OI-128：USER-WRITE-UI-1：批注 / 工作台用户写入入口（已关闭）

- 状态：已关闭 / 自动验收通过（2026-08-03）
- 类型：前端 / 用户数据 / Delivery Bundle
- 对象或页面：ZIP alpha 桌面包、`sapd_wiki_user.sqlite3`、安全能力映射 / 知识库字典 / 标准框架 / 安全指南、右侧浮层批注抽屉与工作台。
- 现象：ZIP alpha 后端已具备 `user_favorites` 写入 API 和 user DB 自动创建能力；`OI-128A / OI-128B` 已验证页面可写入用户库，但当前横向 `加入关注清单 / 收藏备注` 条语义较弱，不适合作为长期用户工作入口。
- 影响：当前 Windows 包只能验收解压启动、页面访问、base 数据读取、user DB 自动创建、日志和诊断包；页面级用户写入能力不能作为本轮验收项。
- 当前处理：2026-06-03 已新增正式设计文档 `docs/06-implementation/user-workspace-v1-to-v4-design.md`，固定 V1A 收藏 / 轻备注、V1B 备注 / 标签、V2 我的工作区、V3 新增 / 复制编辑、V4 导出路线。`OI-128A` 已先在安全能力映射页对象详情区实现关注清单 / 收藏备注入口，并补齐开发 API 与 ZIP runtime 的收藏保存 / 撤销路径；`OI-128B` 已把同一用户动作组件复用到安全知识、标准 / 框架和安全指南页面。2026-06-04 已新增 `docs/06-implementation/workspace-annotation-and-capability-remix-design.md`，固定后续下线横向收藏条，改为右侧上浮批注抽屉和工作台方向；同日 `OI-128C` 已实现右侧浮层批注抽屉第一版。2026-06-04 用户截图复核发现第一版存在列表冗余、不可编辑、切页不收起、上下文重复、当前页计数错误、搜索框异常、草稿跨页残留和行 / 字段锚点缺失等问题；`OI-128C` 修正版已继续收敛右侧抽屉 UX / 逻辑、Apple shell 组件基线和 Office Word 式批注栏设计，新增精确上下文锚点定位、固定宽度抽屉、长标题截断悬停展示和原页面纯高亮标记。2026-06-05 进一步确认 LC-AP / LC-DT 页面缺少统一值级锚点，已把生命周期字段、生命周期 chip、数据场景、策略文本和参考数据接入 `data-annotation-value` / `data-copy-text` 契约；共享 `display.relationChip` 也默认输出同一锚点属性。2026-06-05 追加全工程批注契约治理：普通 `td` 表格单元格增加值级兜底，知识库字典、标准 / 框架折叠目录定位可自动展开父级分组，手写关系 chip 和详情字段统一接入 `display.annotationValueAttrs`，`scripts/audit_user_annotation_contract.mjs` 升级为跨页面动态渲染审计，防止值批注再次退化为行批注。2026-06-05 用户再次截图验证发现：`/standards/nist-csf-2` 保存后无可见常驻高亮、`/development-security` 高亮样式偏离约定基准、`/data-security` / 模块值定位后高亮不可见或回退；已新增 `docs/06-implementation/global-annotation-requirements-and-regression-matrix.md` 作为全局批注需求与页面级验收矩阵。2026-06-05 继续按用户“批注是叠加层”判断修复 overlay 架构：知识库表格行渲染后统一挂载稳定 `data-annotation-target-ref`，批注标记 / 定位优先使用稳定目标，再退回旧 `field_value` / `table_row` 兼容锚点；行级和单元格级高亮穿透到 `td` / `th`，避免被标准页、CSF 行、生命周期矩阵等表格背景盖住；资源版本更新到 `annotation-global-20260605-2`。2026-06-05 最新严格回归已收口：当前用户库 24 条保存批注真实 Chrome 严格回归 `24/24 pass`，覆盖值级 / 行级粒度、点击后常态保留、无批注误高亮、模块 / 措施 chip 定位和多页面上下文恢复。2026-06-05 二次人工抽查问题已修复：安全技术措施 / 模块 / 服务常态与定位高亮、点击页面后常态保留、非首屏定位抽屉滚动保持、抽屉视口完整性均纳入真实 Chrome 严格回归并通过；下一步只做最终人工抽查和 checkpoint，不继续扩大批注功能。
- 追加修复：2026-06-05 用户再次确认安全技术措施 / 模块 / 服务仍无常态和定位高亮。复查确认根因是旧回归只验证 `data-user-note-anchor-marked / active` 属性，未验证视觉样式；技术 chip 的语义色规则，尤其 `.relation-chip.technical-chip:not(.module-chip):not(.measure-chip)`，会覆盖批注背景。已将批注 chip 覆盖层放到所有 chip 语义色规则之后，并补齐 `technical-chip service-chip` specificity；资源版本更新到 `annotation-global-20260605-4`。
- 追加视觉修复：2026-06-05 用户截图确认普通态高亮仍呈横向黄色长条。已将普通态从背景铺底改为贴文字的琥珀下划线；行级普通态只保留左侧标识，不再铺整行黄色；关系 chip 保留原语义底色并叠加低噪声下划线 / 边框。脚本新增 `normalStripeOk` 和 `normal_visual_stripe_too_wide`，防止普通态宽背景条再次被验收脚本放过；资源版本更新到 `annotation-global-20260605-5`。
- 追加后续变更：2026-06-05 用户继续反馈定位后高亮落到文字后方、L0-L2 批注无常态高亮、普通态高亮线需要加深加粗但不遮挡文字、几个指南 / 幻灯片页无法添加批注。已补齐 L0-L2 树节点对象高亮、幻灯片页 / slide stage 批注目标、定位滚动 `inline: nearest`、普通态下划线加深加粗，以及标准映射按需加载后的值锚点。标准映射 ViewModel 固定为 projection / workbench 为主，已加载 standards 包只补充不覆盖，避免 `NIST CSF` 加载后覆盖后端 projection 中的 `AT-6`；同时把 ISO 等按需加载标准框架 / 控制项补入 `localRelationMap`，保证关注点页 DOM 具备稳定 `standard-framework-name` 值锚点。
- 基线固化：2026-06-05 用户确认该问题基本验收通过，后续有问题再按 bug fix 处理。当前批注设计已作为全局基线固化到 `global-annotation-requirements-and-regression-matrix.md` 与 `frontend-global-design-baseline-2026-05-30.md`，并新增“新页面接入清单”。后续新增页面必须先声明页面对象、值锚点、行锚点、幻灯片 / 子页上下文和回归命令，不再逐页重新调试批注样式、定位逻辑和抽屉行为。
- 追加修复：2026-06-08 用户要求右侧批注抽屉顶部“当前页 N 条 / 批注 / 收起”区域锁定不滑动，并指出首次 sticky 修法遮挡内容、过于草率。已撤回 sticky 叠层方案，改为 `.annotation-drawer-panel` 固定外框不滚动、`.annotation-drawer-header` 作为普通固定头部、`.annotation-drawer-fixed` 固定对象信息 / 添加批注 / 保存按钮、`.annotation-drawer-scroll` 仅承载下方批注列表滚动；抽屉底部增加 48px 留白，不再贴到页面最底；删除保存按钮左侧“写入用户库，不修改基础数据”说明文字；同步切换滚动记忆和重绘保留逻辑，递增 `styles.css` 缓存版本，并在 `scripts/audit_user_annotation_contract.mjs` 增加 `annotation_drawer_locked_header_contract_missing` 防回归断言。
- 最新验证：2026-06-05 带视觉断言和长条防回归的真实 Chrome 回归通过：`node scripts/audit_saved_user_annotations.mjs --url http://127.0.0.1:5173 --allow-system-chrome --debug-port 9410 --width 1800 --height 1200 --compact` 返回 `noteCount=24`、`passed=24`、`failed=0`、`failures=[]`、`consoleIssues=[]`。脚本已新增 `normalVisualHighlight` / `activeVisualHighlight` / `normalStripeOk`，第 6 安全技术措施、第 7 安全技术模块、第 8 安全技术服务、第 24 安全技术模块均满足常态与定位视觉高亮，截图对应的 `1.6 接收其他应用数据` 也满足 `normalStripeOk=true`。
- 最新验证：2026-06-05 后续变更真实 Chrome 全量回归通过：`node scripts/audit_saved_user_annotations.mjs --url http://127.0.0.1:5173 --allow-system-chrome --debug-port 9433 --width 1800 --height 1200 --compact` 返回 `noteCount=28`、`auditedNoteCount=28`、`passed=28`、`failed=0`、`failures=[]`、`consoleIssues=[]`。单点与连续场景验证包括 `--only-ordinal 1` 的 ISO 标准框架值、`--only-ordinal 23` 的 `AT-6` 控制项，以及 `--from-ordinal 15 --to-ordinal 23 --debug-state` 的标准包加载后不覆盖 projection 场景，均通过。
- 提交后补充验证：2026-06-05 checkpoint 提交后发现当前用户库已扩展到 33 条保存批注，首次补跑全量回归抓出 4 条指南 / 幻灯片缩略图批注缺少定位态视觉高亮。已只针对 `.guide-slide-stage` / `.guide-thumb` 定位态补齐琥珀下沿并推进 `styles.css` 缓存版本到 `annotation-global-20260605-8`。随后定点 4 条回归通过，全量真实 Chrome 回归 `node scripts/audit_saved_user_annotations.mjs --url http://127.0.0.1:5173 --allow-system-chrome --debug-port 9446 --width 1800 --height 1200 --compact` 返回 `noteCount=33`、`auditedNoteCount=33`、`passed=33`、`failed=0`、`failures=[]`、`consoleIssues=[]`。
- 后续范围：导出格式扩展、能力重组、导入和 Skill 集成不属于 OI-128 关闭条件；如用户启动，按独立需求或新 Issue 处理，不重新把已验收基线改回“部分完成”。
- 修复说明：`OI-128A / OI-128B / OI-128C` 已实现并通过多轮 API、契约、页面和真实批注回归，当前范围已满足关闭条件。正式入口由 `user_notes` 承载批注，并提供 `待复核`、`数据篮` 和 `工作台`；用户写入只影响 `sapd_wiki_user.sqlite3`，不回写基础库。后续新增页面继续复用既有锚点和回归契约。
- 验证结果：2026-06-03 通过本地 `5173` API 写入 / 读取 / 删除闭环验证：`POST /api/v1/user/favorites` 写入 `base:capability_focus:OI-128A-SMOKE` 成功，`GET` 可读，`DELETE` 后列表消失；`node scripts/frontend_smoke_check.mjs --page capability --url http://127.0.0.1:5173` 通过。2026-06-03 `OI-128B` 真实 Chrome 回归覆盖 `/knowledge/technical-services`、`/knowledge/capabilities`、`/standards/mlps-level-3`、`/guides/security-architecture-modeling-language`，均有 `userObjectActionsProbe.count=1`、`consoleIssues=0`。2026-06-04 `OI-128C` 通过 `POST /api/v1/user/notes`、`GET`、`PATCH`、`DELETE` 本地 API 闭环；真实 Chrome 回归覆盖 `/capability-mapping`、`/knowledge/technical-services`、`/standards/mlps-level-3`、`/guides/security-architecture-modeling-language`，均确认右侧批注抽屉存在、可展开、旧横向条数量为 0、`workspaceWidthDelta=0`、`consoleIssues=0`。2026-06-05 `node scripts/audit_user_annotation_contract.mjs` 通过，动态渲染样例确认 `LC-AP=14`、`LC-DT=11`、参考数据 `3` 个值级锚点。2026-06-05 全局版审计通过，覆盖能力映射技术 / 管理、信息化环境、技术服务、技术模块、技术措施、LC-AP 参考数据、详情面板、标准 / 框架和折叠目录定位契约。2026-06-05 overlay 修复后 `node --check frontend/capability-browser/app.js`、`node scripts/audit_user_annotation_contract.mjs`、`node scripts/audit_frontend_display_contract.mjs`、`node scripts/audit_frontend_lazy_load_contract.mjs`、`python3 scripts/dev_server_guard.py --status`、`git diff --check` 均通过；轻量 smoke 覆盖 `/capability-mapping`、`/environment-mapping`、`/development-security`、`/data-security`、`/knowledge/capabilities`、`/knowledge/technical-services`、`/knowledge/technical`、`/knowledge/technical-measures`、`/knowledge/functions`、`/knowledge/processes`、`/standards/nist-csf-2`、`/standards/mlps-level-3`、`/standards/iso-27001-2022`、`/standards/cis-csc-v8`、`/standards/crf`、`/standards/nist-800-53-rev5`、`/standards/dsp-level-2`、`/guides/security-architecture-modeling-language` 均通过；本轮未启动系统 Chrome，避免复现 Chrome 崩溃。2026-06-05 严格真实 Chrome 回归通过：`node scripts/audit_saved_user_annotations.mjs --url http://127.0.0.1:5173 --allow-system-chrome --debug-port 9397 --width 1800 --height 1200 --compact` 返回 `noteCount=24`、`passed=24`、`failed=0`、`consoleIssues=[]`，并逐条满足 `granularityOk=true`、`persistentAfterClick=true`、`unexpectedMarkedCount=0`。2026-06-05 二次严格真实 Chrome 回归通过：`node scripts/audit_saved_user_annotations.mjs --url http://127.0.0.1:5173 --allow-system-chrome --debug-port 9404 --width 1800 --height 1200 --compact` 返回 `noteCount=24`、`passed=24`、`failed=0`、`consoleIssues=[]`，并逐条满足 `normalMarkedBeforeLocate=true`、`activeAfterJump=true`、`granularityOk=true`、`persistentAfterClick=true`、`drawerPanelOk=true`、`currentNoteCardOk=true`、`drawerScrollPreserved=true`、`locateButtonClicked=true`、`unexpectedMarkedCount=0`。2026-06-07 数据篮最小 API smoke 通过：`node scripts/smoke_user_data_basket_api.mjs` 在临时 ZIP bundle / 临时 user DB 中验证 token 拒绝、创建数据篮、条目 upsert、读取、删除条目和删除数据篮闭环。2026-06-08 批注抽屉固定表单 / 独立列表滚动区验证通过：`node --check frontend/capability-browser/components/UserAnnotationDrawer.js`、`node --check frontend/capability-browser/app.js`、`node --check scripts/audit_user_annotation_contract.mjs`、`node scripts/audit_user_annotation_contract.mjs`、定向结构断言 `node -e ...`、定向 `git diff --check`、`python3 scripts/dev_server_guard.py --status`、`node scripts/frontend_smoke_check.mjs --page capability --route /capability-mapping --url http://127.0.0.1:5173` 均通过；内置 Browser 在 `/capability-mapping` 验证抽屉展开后固定区 bottom 为 `430`、保存按钮 bottom 为 `415`、列表滚动区 top 为 `430`、底部留白为 `48px`、保存按钮左侧文案仅剩 `保存批注`，滚动列表后固定区 top 保持 `152` 不变；本轮未启动系统 Chrome。
