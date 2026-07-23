# Open Issues

本文件现在只保留当前仍需处理或确认的问题、问题模板和治理入口。已关闭问题的完整记录已归档，避免当前入口继续膨胀。

## 治理入口

- 当前未关闭问题数：7
- 已关闭归档问题数：194
- 全量索引：`docs/06-implementation/open-issues-index.md`
- 已关闭问题归档：`docs/05-archive/open-issues-history/2026-06.md`、`docs/05-archive/open-issues-history/2026-07.md`
- 重复编号待治理：`OI-044`、`OI-092`，索引中使用 `OI-xxx#n` 区分历史条目。

## 建单门槛

默认不为小问题新建 `OI`。小问题应直接修复、在 `progress.md` 记录，并在任务完成反馈中给出验证结果和必要的页面验收入口。

不建单的典型情形：文案、轻微样式、单页局部交互、小范围空态；本轮可直接修复且自动验证已覆盖；不涉及业务判断、数据源、审计矩阵、安全边界或多页面契约；代码清理、命名修正、测试补充。

满足以下至少一项才建 `OI`：影响多个页面、多个数据域或全局契约；涉及源 Excel、SQLite、正式 JSON、字典、标准、LC、环境、导入或导出边界；涉及安全、用户数据、GitHub 同步边界或本地 API/token 边界；需要新增 / 扩展审计脚本、防回归矩阵或长期观察；需要用户业务判断或人工验收后才能关闭；本轮无法完整修复，或严重性为中 / 高。

修复后处理：自动验证已覆盖、无需用户业务判断的问题，可以直接标记为 `已关闭 / 自动验收通过` 并归档；需要用户验收的问题，状态可为 `已修复 / 待用户验收`，但最终反馈必须给出固定入口、导航路径、预期现象和关闭条件；用户确认后必须及时关闭 / 归档，不能长期停留在“已修复 / 待页面验收”。

## 当前未关闭问题

| 编号 | 状态 | 标题 |
|---|---|---|
| OI-199 | T0-T2 完成 / 等待新授权 | 本地 MCP M0-T T0–T2 隔离技术验证 |
| OI-198 | 待实现 / 契约已确认 | 导入审批缺少幂等门禁、中间数据终结和 approved 默认导出契约 |
| OI-197 | 待业务确认 / 映射门禁阻断 | 成熟度评分依据与当前能力字典尚未全量映射 |
| OI-192 | 已修复 / 待用户验收 | 成熟度评分工作台服务、评分定义与主动作契约未按截图落地 |
| OI-191 | 已修复 / 待用户验收 | 全局共享标题区视觉 token 偏离旧 DMG 基线 |
| OI-138 | 暂不修复 / 已回退 | 关注点关系图谱标签与节点 / 连线碰撞 |
| OI-128 | 部分完成 | USER-WRITE-UI-1：批注 / 工作台用户写入入口 |

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

## OI-199：本地 MCP M0-T T0–T2 隔离技术验证

- 状态：T0-T2 完成 / 等待新授权
- 严重性：高
- 类型：架构 / 安全 / MCP / 隔离验证 / 治理
- 对象或页面：四份 MCP 机器合同、synthetic fixture、只读 Runtime probe、loopback HTTPS / OAuth / Tool harness。
- 现象：v0.5 已通过 M0 评审，但正式实现前必须先冻结合同，并证明 synthetic base 只读、用户库零访问、业务目录零副作用以及协议 / 策略负向路径可执行。
- 影响：若跳过合同与隔离验证，后续正式 Runtime 可能把实验性网络、密钥或数据访问路径接入生产启动链路。
- 建单理由：涉及跨模块架构、安全、认证、数据边界和后续 App / packaging 门禁，必须保留阶段证据与授权边界。
- 当前处理：G0、T0、T1、T2 已在独立 `codex/local-mcp-m0t` 完成并形成本地阶段提交。当前已按授权停止，不进入 T3、D0 或 M1。
- 需要确认：T0–T2 完成后仍需单独确认是否进入 T3；本轮不得生成 D0 数据或创建 M1 正式实现计划。
- 验收入口：`docs/06-implementation/local-mcp-m0t-t0-t2-execution-plan.md`。
- 关闭条件：G0、T0、T1、T2 各自合同、测试和阶段提交通过，并清楚保留 T3 / D0 / M1 未授权状态；完成 T0–T2 不等于 M0-T 总体 PASS。
- 修复说明：本轮写入仅限 G0 治理文档以及 `docs/01-architecture/contracts/mcp/**`、`tests/fixtures/mcp/**`、`spikes/local-mcp/**`。
- 验证结果：T0 `6/6`、T1 `13/13`、T2 `34/34`，合并回归 `53/53`；branch allowlist、提交制品 / secret、生产 import、端口与临时证书清理审计通过。macOS 本机隔离结果为 PASS；Windows 和 T3 真实 Codex 客户端 pending。真实 / 用户数据访问、系统信任、真实客户端配置、App / packaging 与远程 push 均为 0。

## OI-198：导入审批缺少幂等门禁、中间数据终结和 approved 默认导出契约

- 状态：待实现 / 契约已确认
- 严重性：高
- 类型：ETL / SQLite / 来源追踪 / 导入导出 / 数据治理
- 对象或页面：`approve_import`、`source_references`、`import_jobs`、`staging_items`、`staging_relations`、`review_decisions`、导入摘要导出命令。
- 现象：清理后主库副本 smoke 证明新导入链路可以正常 staging 和 approve，但同一 job 第二次 approve 仍会再次追加来源引用和变更日志；approved job 的 staging / review 不会在业务验收后按 job 终结；默认 `export-second-batch-summary` 会按所有状态的结束时间选择 rejected job。
- 影响：重复操作会持续放大来源追踪和变更日志，长期导入会重新累积 staging / review；默认导出可能把失败或拒绝任务当成正式导入结果，降低来源审计可信度并重复制造数据库清理任务。
- 建单理由：涉及正式 SQLite 写入、来源证据唯一性、导入状态机、导出选择器和长期审计边界，不能作为一次性文档说明关闭。
- 当前处理：用户已确认四项契约方向，权威文档为 `docs/03-import-etl/import-approval-idempotency-and-retention-contract.md`。契约要求 approve 只能从 reviewing 原子进入；来源引用按完整证据键幂等复用；新增默认 dry-run、显式 apply 的按 job finalize 命令；未指定 job ID 的正式导出只选择最新 approved 任务。当前只完成文档，代码、schema / migration 和测试均未修改。
- 需要确认：无需额外业务判断；实施时不得顺带清理现存 65,824 条重复来源引用，不得改变对象匹配、旧对象停用、Sheet 解析或用户库边界。
- 验收入口：`docs/03-import-etl/import-approval-idempotency-and-retention-contract.md` 第 4 至第 10 节。
- 关闭条件：重复 approve 与并发 approve 无二次写入；同证据来源引用只复用不新增；`finalize-import` dry-run / apply / 重复执行 / 错误状态矩阵通过；默认导出忽略 rejected / failed / reviewing / parsed / pending；临时库全链路、数据边界和受保护基线检查通过。
- 修复说明：本轮仅补齐契约、索引、治理发现和问题追踪，不修改 ETL / CLI / schema、正式 SQLite、源 Excel、正式 JSON、用户库或 DMG。
- 验证结果：2026-07-19 临时库 smoke 中，第一次 approve 新增来源引用 `651`、变更日志 `162`；第二次 approve 再次新增相同数量，确认当前状态门禁和来源幂等缺口。默认 second-batch 导出选择了 rejected job `3e828d78-98dc-48c3-95e0-56383b55714a`。这些证据只用于确定契约，不计为实现通过。

## OI-197：成熟度评分依据与当前能力字典尚未全量映射

- 状态：待业务确认 / 映射门禁阻断
- 严重性：高
- 类型：数据 / 成熟度 / 当前字典 / 源 Excel / 业务确认
- 对象或页面：成熟度基础模板中的 3 个 L0、10 个 L1、32 个 L2、91 个关注点、160 条关注点—安全技术服务关系和 185 个评估点。
- 现象：以工程当前字典为主表对 `assesment samples.xlsx` 的评分依据进行映射后，只有 76 个关注点的编码、父 L2 和名称同时对齐；8 个关注点编码和父级一致但名称语义不同，7 个当前关注点在源表中不存在。对应服务关系为 `125 已映射 / 27 待复核 / 8 无来源`，评估点为 `147 已映射 / 28 待复核 / 10 无来源`。
- 影响：在对象身份和 rubric set 绑定未完成前，缺级、遗漏、业务不可评分和 KPI 未结构化分类都可能落到错误的当前对象，不能进入正式评分数据、API、页面或 XLSX 模板实现。
- 建单理由：涉及源 Excel、受保护当前字典、成熟度评分对象粒度、导入 / 导出和业务判断，且本轮无法自动关闭。
- 当前处理：已形成 `docs/08-maturity/assessment-rubric-dictionary-mapping-audit-2026-07-17.md`，逐项列出 91 个关注点、160 条服务关系和 185 个评估点；`assessment-rubric-source-appendix-2026-07-17.md` 已把问题分类改为映射门禁通过前冻结。源服务在 22 个关注点与当前字典漂移，固定以当前字典为准，不回写源服务。
- 需要确认：一是确认 8 个同编码但名称不同的关注点是否仍使用候选 rubric set；二是为 7 个无来源关注点确认继承候选组还是新建专用组。候选组不得自动生效。
- 验收入口：上述映射审计文档第 4、6、7—9 章。
- 关闭条件：91 个关注点、160 条服务关系和 185 个评估点全部唯一绑定 rubric set，父 L2 和名称语义复核完成，映射门禁为 `PASS`；随后重新按当前字典生成问题分类。
- 修复说明：本轮只完成只读对比与设计门禁，不修改运行代码、当前字典、源 Excel、正式 JSON / SQLite、模板、评分数据、用户库、ETL 或 DMG。
- 验证结果：当前 maturity 基础模板校验错误 / 警告为 `0 / 0`；能力 / 关注点 / 服务编码重复为 `0 / 0 / 0`；源关注点孤立数和父 L2 冲突均为 `0`。工程字典和源 Excel 哈希保持不变。

## OI-192：成熟度评分工作台服务、评分定义与主动作契约未按截图落地

- 状态：已修复 / 待用户验收
- 严重性：中
- 类型：前端 / 成熟度评分 / 产品设计 / 防回归审计
- 对象或页面：`工作台 → 成熟度评估` 首页、项目内“评分检查 / 评估结果 / 报告快照”和模板管理，固定入口 `/workbench/maturity`。
- 现象：用户连续复验成熟度工作台后指出完成提示固定在右上角并跨路由残留，不适用 / 无证据仍被误解为阻塞；模板管理藏在“更多”且缺少默认 / 自定义模板导入导出闭环；首页缺少模板资产区；返回项目列表后残留项目提示；报告快照没有面向汇报的 HTML 版式和文字补充区。第二十四至第二十七轮复验又指出评分上下文锁定、四维列内部滚动或评分表单内部滚动都会破坏完整打分任务；窄屏摘要仍可能挤压；项目概览过空；T / G / M 名称与分数分离；完整评估报告与 Markdown / HTML 双出口表达不清。
- 影响：问题同时覆盖项目状态、模板资产、结果诊断与报告交付四条核心路径，影响 Web 和后续 DMG App 共享前端；若继续按单个截图打补丁，会再次出现跨路由状态泄漏、模板基准被覆盖、结果阅读顺序漂移和导出格式扩散。
- 建单理由：属于用户重复拒绝的多组件 shared runtime 契约问题，需要同步三份成熟度文档并扩展专项审计和多视口浏览器验收。
- 当前处理：第三十一轮按用户最新截图只收口 L2 摘要列宽与组内对齐。中宽成熟度 / 四维均值 / 评估点改为约 `0.90 : 1.60 : 0.65`，评估点内部恢复适用性 / 进度两个等宽子格；当前 / 目标、四维、适用性和进度均在自身子格水平居中。成熟度等级 / 连续分数与四维均值共享 `28px` 主读数 token，并覆盖旧 `align-self:end`，使值组与“维度名称 + 均值”组合块垂直中心差不超过 `3px`。第三十轮四维单行和 `480px` 回流、第二十八轮 current / target 双单元、第二十七轮外层单滚动及后续业务契约保持。
- 需要确认：请用户只在固定项目的“评分执行”确认评估点区域已明显窄于四维区域；当前 / 目标、四维、适用性和进度各自在子格内居中；成熟度等级 / 分数与“组织与角色 + 均值”字号一致、位于同一视觉中线。
- 验收入口：`http://127.0.0.1:5173/#/workbench/maturity/demo-project-001`。保持“评分执行”，查看顶部 `T-AS.AD 网络安全体系架构管控能力` 的 L2 汇总；预期评估点更紧凑、六类读数组居中、当前 / 目标与四维主读数均为 `28px`，页面无横向滚动。
- 关闭条件：用户确认上述五组人工验收通过；DMG App 证据在下次发布矩阵补充，不以 5173 Web 结论替代。
- 修复说明：第三十一轮只修改成熟度 CSS、缓存版本和专项审计；同步成熟度前端规格、业务设计、全局优化计划、发现、进度和状态入口。未修改评分 / 聚合、`MaturityAssessmentWorkbench.js` 业务输出、源 Excel、SQLite、正式 public/data JSON、字典 / 标准 / 生命周期基线、用户库、Draw.io 原图或 DMG。
- 验证结果：第三十一轮专项审计 `222/222`、JS / Python 语法、maturity HTTP/API smoke、GitHub 数据边界、定向 diff-check 与 5173 stable 通过。应用内 Browser `1600×900` 实测评估点 / 四维宽度 `210 / 503.68px`、每个子格标签中心偏差不超过 `0.5px`、成熟度 / 四维主读数均为 `28px`、垂直中心差 `2.5px`、页面横向溢出和 console warning / error 为 `0`；`T-AS.AD / T-AS.AM / G-SP.SM` 三个 L2 与项目概览负向对照通过，`1280×720 / 540×900` 回流无溢出。治理检查仅命中其他活动改动的 `app.js=12772 > 12758`，本轮未抬阈值；未启动系统 Chrome，未重建 DMG App。

## OI-191：全局共享标题区视觉 token 偏离旧 DMG 基线

- 状态：已修复 / 待用户验收
- 严重性：中
- 类型：前端 / 共享 App Shell / 设计 / 审计
- 对象或页面：所有使用 `.app-page-header` 的 Web 与 DMG App 共享前端路由，代表入口为 `/`、`/capability-mapping`、`/workbench/maturity/demo-project-001`。
- 现象：用户对照当前程序与旧 DMG 后指出标题字号、说明字号、左侧留白和三层间距不一致；上次修正后仍不舒适。
- 影响：共享 token 同时影响全工程页面；单页补丁会继续造成标题区在不同页面漂移，Web 与下次 DMG App 都会继承错误节奏。
- 建单理由：影响多个页面与 Web / App 共享运行面，属于重复出现的全局视觉契约问题，并扩展了自动审计。
- 当前处理：以用户旧 DMG 截图和已挂载 `0.1.7` 运行前端为视觉真值，把共享标题恢复为页头 `96px`、标题 `24px / 1.13`、说明 `12px / 1.45`、页头内边距 `12px 18px`、文本组间距 `5px`、标题与标签间距 `7px`；参数写入 P0-2 配置与审计，业务页不得局部覆写。
- 需要确认：用户在固定入口对照旧 DMG，确认标题大小、左侧留白和面包屑 / 标题 / 说明节奏是否恢复舒适。
- 验收入口：`http://127.0.0.1:5173/#/`；可再抽查“安全能力映射”和“工作台 → 成熟度评估”。预期三页标题参数一致，视觉接近旧 DMG。
- 关闭条件：用户确认 5173 标题区可验收；DMG App 证据在下次发布矩阵补充，不以当前 Web 结论替代。
- 修复说明：修改共享 `styles.css` token、P0-2 契约配置和审计脚本，并递增样式缓存版本；同步全局设计基线、成熟度三文档、计划、发现、状态和 Design QA。未修改页面文案、业务数据、评分、聚合、API、SQLite、正式 JSON、源 Excel、用户库或 DMG。
- 验证结果：P0-2 v4 静态与 5173 runtime 审计通过；应用内浏览器在 1280×720 对照旧 DMG，三条代表路由计算样式一致且无页面横向溢出、主区禁显字段命中 0；未启动系统 Chrome，未重建 DMG App。
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
## OI-128：USER-WRITE-UI-1：批注 / 工作台用户写入入口

- 状态：部分完成
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
- 需要确认：后续是否进入导出格式扩展、能力重组、导入和 Skill 集成。
- 修复说明：`OI-128A / OI-128B / OI-128C` 已实现，`OI-128C` 二次严格回归已通过，待最终人工抽查与 checkpoint。当前入口以 `user_notes` 承载正式批注，`user_favorites.note` 仅作为过渡收藏备注显示；收藏不再作为主业务动作，正式入口改为 `批注`、`待复核`、`数据篮` 和 `工作台`。2026-06-07 已补齐工作台总览和数据篮最小 API：`/api/v1/user/workspaces` 与 `/api/v1/user/data-baskets` 均支持创建、读取、删除容器，`/:id/items` 支持读取和 upsert 条目，`/items/:item_id` 支持删除条目，所有写入仍走本地 token 和 loopback 校验。新建行 / 字段 / 值批注使用带 route、view、目录 / 子页面、对象、tab 和表格坐标的 `v2` 锚点，旧缺上下文批注不再为了视觉反馈误高亮所有同名值。页面组件必须显式声明 `data-annotation-value`；普通业务 `td` 作为全局兜底值锚点；折叠目录定位必须先展开父级并恢复常驻标记；知识库对象行通过稳定 `data-annotation-target-ref` 暴露 overlay 锚点；批注层负责右键、抽屉、保存、状态、tooltip、常驻提示和定位高亮，原页面只暴露锚点，不承担批注业务逻辑。用户写入只影响 `sapd_wiki_user.sqlite3`，不回写基础库。
- 验证结果：2026-06-03 通过本地 `5173` API 写入 / 读取 / 删除闭环验证：`POST /api/v1/user/favorites` 写入 `base:capability_focus:OI-128A-SMOKE` 成功，`GET` 可读，`DELETE` 后列表消失；`node scripts/frontend_smoke_check.mjs --page capability --url http://127.0.0.1:5173` 通过。2026-06-03 `OI-128B` 真实 Chrome 回归覆盖 `/knowledge/technical-services`、`/knowledge/capabilities`、`/standards/mlps-level-3`、`/guides/security-architecture-modeling-language`，均有 `userObjectActionsProbe.count=1`、`consoleIssues=0`。2026-06-04 `OI-128C` 通过 `POST /api/v1/user/notes`、`GET`、`PATCH`、`DELETE` 本地 API 闭环；真实 Chrome 回归覆盖 `/capability-mapping`、`/knowledge/technical-services`、`/standards/mlps-level-3`、`/guides/security-architecture-modeling-language`，均确认右侧批注抽屉存在、可展开、旧横向条数量为 0、`workspaceWidthDelta=0`、`consoleIssues=0`。2026-06-05 `node scripts/audit_user_annotation_contract.mjs` 通过，动态渲染样例确认 `LC-AP=14`、`LC-DT=11`、参考数据 `3` 个值级锚点。2026-06-05 全局版审计通过，覆盖能力映射技术 / 管理、信息化环境、技术服务、技术模块、技术措施、LC-AP 参考数据、详情面板、标准 / 框架和折叠目录定位契约。2026-06-05 overlay 修复后 `node --check frontend/capability-browser/app.js`、`node scripts/audit_user_annotation_contract.mjs`、`node scripts/audit_frontend_display_contract.mjs`、`node scripts/audit_frontend_lazy_load_contract.mjs`、`python3 scripts/dev_server_guard.py --status`、`git diff --check` 均通过；轻量 smoke 覆盖 `/capability-mapping`、`/environment-mapping`、`/development-security`、`/data-security`、`/knowledge/capabilities`、`/knowledge/technical-services`、`/knowledge/technical`、`/knowledge/technical-measures`、`/knowledge/functions`、`/knowledge/processes`、`/standards/nist-csf-2`、`/standards/mlps-level-3`、`/standards/iso-27001-2022`、`/standards/cis-csc-v8`、`/standards/crf`、`/standards/nist-800-53-rev5`、`/standards/dsp-level-2`、`/guides/security-architecture-modeling-language` 均通过；本轮未启动系统 Chrome，避免复现 Chrome 崩溃。2026-06-05 严格真实 Chrome 回归通过：`node scripts/audit_saved_user_annotations.mjs --url http://127.0.0.1:5173 --allow-system-chrome --debug-port 9397 --width 1800 --height 1200 --compact` 返回 `noteCount=24`、`passed=24`、`failed=0`、`consoleIssues=[]`，并逐条满足 `granularityOk=true`、`persistentAfterClick=true`、`unexpectedMarkedCount=0`。2026-06-05 二次严格真实 Chrome 回归通过：`node scripts/audit_saved_user_annotations.mjs --url http://127.0.0.1:5173 --allow-system-chrome --debug-port 9404 --width 1800 --height 1200 --compact` 返回 `noteCount=24`、`passed=24`、`failed=0`、`consoleIssues=[]`，并逐条满足 `normalMarkedBeforeLocate=true`、`activeAfterJump=true`、`granularityOk=true`、`persistentAfterClick=true`、`drawerPanelOk=true`、`currentNoteCardOk=true`、`drawerScrollPreserved=true`、`locateButtonClicked=true`、`unexpectedMarkedCount=0`。2026-06-07 数据篮最小 API smoke 通过：`node scripts/smoke_user_data_basket_api.mjs` 在临时 ZIP bundle / 临时 user DB 中验证 token 拒绝、创建数据篮、条目 upsert、读取、删除条目和删除数据篮闭环。2026-06-08 批注抽屉固定表单 / 独立列表滚动区验证通过：`node --check frontend/capability-browser/components/UserAnnotationDrawer.js`、`node --check frontend/capability-browser/app.js`、`node --check scripts/audit_user_annotation_contract.mjs`、`node scripts/audit_user_annotation_contract.mjs`、定向结构断言 `node -e ...`、定向 `git diff --check`、`python3 scripts/dev_server_guard.py --status`、`node scripts/frontend_smoke_check.mjs --page capability --route /capability-mapping --url http://127.0.0.1:5173` 均通过；内置 Browser 在 `/capability-mapping` 验证抽屉展开后固定区 bottom 为 `430`、保存按钮 bottom 为 `415`、列表滚动区 top 为 `430`、底部留白为 `48px`、保存按钮左侧文案仅剩 `保存批注`，滚动列表后固定区 top 保持 `152` 不变；本轮未启动系统 Chrome。
