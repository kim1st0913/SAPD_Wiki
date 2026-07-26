# AI 功能集成授权流程与客户端状态 Design QA（2026-07-26）

- source visual truth：用户提供的待确认授权截图 `/var/folders/81/8nwy3h2n00s1dw1g5bnvj7j40000gn/T/codex-clipboard-bb0ab489-dea1-4eca-aead-ec5e37827d68.png`（`2660×804`）和客户端授权截图 `/var/folders/81/8nwy3h2n00s1dw1g5bnvj7j40000gn/T/codex-clipboard-b4564628-31c3-4c1e-b3df-c311131bd02c.png`（`1474×554`）。
- implementation：`http://127.0.0.1:5173/#/settings/ai-integration`；真实已授权状态与生产组件的 synthetic 待确认状态，均使用应用内浏览器，未启动系统 Chrome。
- browser-rendered evidence：`/private/tmp/sapd-ai-integration-client-qa-20260726.png`、`/private/tmp/sapd-ai-integration-pending-qa-20260726.png`。
- viewport / normalization：实现使用 `1440×1000` CSS 视口、设备密度 `1`；源图为用户浏览器局部裁切，因此比较聚焦信息层级、换行、操作位置和内容密度，不比较浏览器外框或绝对像素缩放。
- same-input comparison：待确认源图与当前生产组件待确认渲染、客户端授权源图与真实 5173 已授权渲染，分别放入同一视觉比较输入。

## Findings 与比较历史

无剩余 AI 集成页面 P0 / P1 / P2 设计阻塞。

- P1 待确认请求不醒目：原请求位于页面下方，用户需要自行寻找。修复后概况下方立即显示 sticky `role=alert` 提示，直接说明请求方、只读权限、截止时间和成功后的浏览器文案，并提供“查看授权请求”入口。
- P1 授权判断被技术字段淹没：原卡片首先展示 Client ID、Redirect URI、Scope、Resource 与数据策略。修复后默认只展示“谁在请求、能读取什么、什么时候失效、允许或拒绝”；五项技术字段收进“查看技术信息”。
- P1 客户端表格窄列竖排：原六列表格使 Client ID、日期与“最近使用”断裂。修复后改为响应式管理列表，客户端身份、业务权限、授权时间、最近使用和撤销动作形成两行三轨；`618px` 卡片 `scrollWidth=clientWidth=618`。
- P2 状态含义不清：“未验证”改为“发布方未验证”，并明确说明动态注册不等于 HTTPS 不安全；原断链图标移除，撤销动作改为可读文字按钮。
- P2 窄屏布局：`390×844` 下客户端信息自然回流为单列，撤销动作占整行，客户端容器 `scrollWidth=clientWidth=275`，页面滚动区 `313/313`，无横向溢出。

## Required fidelity surfaces

- Fonts / typography：沿用 SAPD Apple Shell 系统字体和既有 `14 / 12px` 工作台层级；Client ID 使用紧凑等宽短标识，不再多行暴露完整 UUID。
- Spacing / layout rhythm：待确认提示、请求决策区和客户端管理列表均复用现有 panel、divider、control radius 与紧凑间距；证书和客户端继续并排，审计区独占下一行。
- Colors / tokens：仅使用既有 blue、warning、ready、panel、quiet surface 与 divider token；没有新增渐变、装饰色或营销式卡片。
- Image quality / assets：本页没有业务图片；本轮没有新增手绘 SVG、CSS 图形、emoji 或占位资源。
- Copy / content：主层只使用业务语言；OAuth scope、Resource、Redirect URI 和 policy version 只在技术详情中提供。

## Primary interactions and runtime evidence

- 真实 5173 已授权状态可见“发布方未验证”“只读访问基础知识库”“授权时间 / 最近使用”和“撤销授权”，旧六列表格已移除。
- synthetic 待确认状态使用当前生产 `SystemSettings.render` 与同一 CSS 渲染；顶部提示与“允许只读访问 / 拒绝”主决策均可见，根滚动区与请求卡片均无横向溢出。
- 应用内浏览器真实页面与待确认组件预览 console error 均为 `0`。
- `node --check frontend/capability-browser/components/SystemSettings.js`、`node scripts/audit_frontend_system_settings_contract.mjs`、定向 `git diff --check` 通过。
- 未点击真实允许、拒绝、撤销或重置，未修改真实授权、系统信任、正式数据或用户数据。

## Scope boundary

- `/oauth/authorize` 在等待 SAPD Wiki 决策期间仍是服务端挂起请求，浏览器没有等待正文；这属于 OAuth 路由与安全轮询协议的独立实现，不在本轮 AI 集成页面视觉改动中伪造解决。
- 回调页 “Authentication complete. You may close this window.” 由 Codex 临时 callback 服务生成，不属于 SAPD Wiki 可定制页面。
- 当前 macOS / Windows 安装包尚未接入 MCP Sidecar、证书平台桥和 OAuth 提醒；继续由 `OI-199` 跟踪，不能用本轮 Web 页面验收替代 App / 打包验收。

final result: passed

---

# AI 功能集成信息架构与 MCP 状态浮层第三轮 Design QA（2026-07-24）

- source visual truth：用户问题截图 `/var/folders/81/8nwy3h2n00s1dw1g5bnvj7j40000gn/T/codex-clipboard-1edc417f-a4b2-4266-a3e7-b897f74a08d1.png`（`700×544`）与 `/var/folders/81/8nwy3h2n00s1dw1g5bnvj7j40000gn/T/codex-clipboard-95fff6ae-960b-4cf5-8d22-4de7765e56b1.png`（`2612×1442`）。
- implementation：`http://127.0.0.1:5173/#/settings/ai-integration`；应用内浏览器，未启动系统 Chrome。
- browser-rendered evidence：`/private/tmp/sapd-ai-settings-final-2612x1442-20260724.png`、`/private/tmp/sapd-mcp-popover-final-2612x1442-20260724.png`、`/private/tmp/sapd-ai-settings-mobile-final-390x844-20260724.png`。
- normalization：页面源图与最终桌面实现均使用 `2612×1442` 像素 / 同 CSS 视口；浮层源图是用户提供的局部裁切，最终实现同时以完整页面和可读局部状态检查。
- same-input comparison：两张源图与对应最终实现已放入同一视觉比较输入，分别检查浮层对齐 / 遮挡和页面密度 / 内容层级。

## Findings 与比较历史

无剩余 Web P0 / P1 / P2 设计阻塞。

- P1 浮层错位：顶部通用按钮的固定尺寸与 `place-items:center` 覆盖了证书行网格，导致该行标签和值偏移；五个最终状态行现在共用 `112px + minmax(0, 1fr)` 网格，标签左边界均为 `1563px`，值右边界均为 `1885px`。
- P1 浮层遮挡：原浮层继承半透明 Shell surface，页面“刷新状态”“已停止”等控件透出并干扰读数；最终改为现有不透明 `--panel`，保持 Apple Shell 边框和阴影，但不再透出底层内容。
- P1 页面信息不足：原首屏重复显示运行状态，却没有回答“能否连接、是否授权、能读什么、是否留痕、最近是否用过”；新增“AI 集成概况”，直接展示本机服务、客户端授权、知识访问、隐私审计和最近使用。
- P1 空间利用率：原运行配置四个等高宽列在宽屏形成大量空白；最终改为“服务与 Codex 连接 + 数据访问范围”双栏 pane，端口、服务地址、复制配置和访问边界集中在一个视区。
- P1 数据边界缺失：按正式 MCP 产品合同新增“当前开放、访问方式、网络边界、明确排除”四项，只显示已批准事实：策略允许的公开摘要、5 个只读工具、仅本机回环 HTTPS，并明确排除用户数据、原始文件、本地路径、完整标准正文和非受控 SQL。
- P2 窄屏状态折行：`390px` 下概况状态徽标曾被压成竖排；最终改为标题下方单行状态，宽 `106px`、高 `33px`，页面横向溢出 `0`。
- 缓存可见性：相关 CSS / JS 统一升级到 `apple-shell-settings-20260724-6`，最终页面实际加载四个该版本资源。

## Content decision

默认首屏应该让用户看到：

1. 当前是否可以连接：服务、证书和知识策略状态。
2. 当前谁可以连接：已授权客户端数与待确认请求。
3. Codex 如何连接：端口、服务地址、复制 Codex 配置和检查服务。
4. Codex 能读取什么：仅公开摘要、只读工具和明确排除项。
5. 使用是否可追踪：审计状态、记录数、保留期与最近成功时间。

证书指纹、授权 scope、单个客户端、审计明细和诊断检查继续留在下方对应 pane 或折叠详情，不塞入首屏摘要。

## Fidelity review

- Typography：沿用系统中文字体和 `20 / 14 / 12px` 工作台层级；浮层五行标签和值分别固定左右轨道，长说明使用次级小字。
- Spacing / layout：桌面主区保持 `1280px` 逻辑宽度；概况为五列连续摘要，服务与数据访问采用 `1.55 : 0.85` 双栏，未引入卡片墙。
- Colors / tokens：仅使用既有 Apple blue、panel、quiet surface、divider 和状态 token；没有新颜色、渐变或装饰效果。
- Images / assets：该页面没有业务图片资产，本轮未新增伪图标、CSS 插画、SVG 或占位图。
- Copy / content：新增内容均来自 `sapd-mcp-control-v1` 状态合同和正式 MCP 数据边界；没有展示调试字段、私钥材料、真实路径、Token 或原始查询内容。

## Interaction 与响应式

- 系统设置 / AI 功能集成页签、刷新状态和浮层底部入口通过真实点击；最终路由稳定为 `#/settings/ai-integration`。
- `1024×768`：概况五列仍可扫描，服务与数据访问回流为上下两个 pane，运行配置保持三列，横向溢出 `0`。
- `390×844`：概况、运行配置与数据访问回流为单列，状态徽标不再竖排，横向溢出 `0`。
- 验收没有点击启动 / 停止 MCP、保存端口、修改证书、确认授权、清除审计或写入用户数据。

## Validation

- `node --check frontend/capability-browser/app.js`、`SystemSettings.js`、`AppShell.js`：通过。
- `node scripts/audit_frontend_system_settings_contract.mjs`：通过。
- `git diff --check`：通过。
- 应用内浏览器 console error：`0`。
- 全工程 `static` 套件此前进入 MCP 保留端口检查时，被当前 Python 环境缺少已声明依赖 `cryptography` 阻断；不是本轮前端实现失败。

final result: passed

---

# 成熟度评估报告指定 HTML 模板 Design QA（2026-07-17）

- source visual truth：用户指定的 `/Users/kim1st/.codex/.chatgpt-projects/g-p-6a0141ade554819195eb79578e83c85f/maturity-report-01a3bc396ad2a47ddee7-executive.html`。
- implementation：`demo-project-002` 通过当前共享报告导出运行时生成的自包含 HTML；目标页面 `http://127.0.0.1:5173/workbench/maturity/demo-project-002`。
- browser-rendered evidence：`/private/tmp/sapd-report-executive-template-top.png`、`/private/tmp/sapd-report-executive-template-page2.png`、`/private/tmp/sapd-report-executive-template-appendix.png`、`/private/tmp/sapd-report-executive-template-narrow.png`。
- viewport：Codex 内置浏览器 `1280×720` 与 `520×900`，未启动系统 Chrome。

## Findings

无剩余 Web P0 / P1 / P2 设计阻塞。

- 模板继承：从 `Executive report refinement` 开始的完整响应式与打印 CSS 与指定 HTML 逐字一致；管理层摘要、成熟度跃迁路径、目标达成度、Top 3、关键事实、双雷达、人工填写页和附录结构均已接入。
- 数据边界：指定 HTML 中的示例企业、静态分数、固定轨迹位置和静态完成率没有进入模板；项目名称、当前 / 目标成熟度、轨迹位置、目标达成度、低于目标数量、范围、完成度、证据覆盖和 Top 3 均由当前报告模型动态生成。
- Typography / colors：保留指定模板的宋体标题、无衬线正文、深海军蓝主色、铜色目标与关注色、鼠尾草绿完成度语义。
- Layout / spacing：桌面首屏形成“管理层结论—成熟度轨迹—重点研究—关键事实—双雷达”的顺序；窄屏按单列回流，页面横向溢出 `0px`。
- Interaction / accessibility：四个人工填写区均保留 `contenteditable`，运行时补充 `role=textbox`、`aria-multiline=true` 与 `tabindex=0`；占位字段在导出 HTML 中按模板规则着色。
- Appendix：第三页附录视觉与上一版保持不变，仍包含 `hierarchy_statistics`、`evaluation`、`dimension_rankings`、`capability_results`、`overall_rankings`、`score_appendix`、`traceability` 七个完整分区。
- Content：两个雷达图均由真实评估结果内联绘制；结果哈希、报告快照和算法版本等非业务字段继续不展示。

## Validation

- 指定模板与动态实现的关键模板块 `7 / 7` 一致，报告页数均为 `3`。
- 浏览器验证：雷达 `2`、人工填写区 `4`、附录分区 `7`、console 可执行脚本与无横向溢出均通过。
- 动态样本验证：将项目名及目标统一改为 `L5` 后，标题与目标轨迹标记随数据更新到 `100.0%`，证明没有固化指定 HTML 的示例数字。
- `py_compile`、专项报告断言与 `git diff --check` 通过；完整成熟度审计仍停在既有评分页滚动 owner 断言，本轮报告断言位于其前并已通过。

final result: passed

---

# 成熟度评估报告 V2 编制工作台 Design QA（2026-07-18）

- source visual truth：当前评估报告运行截图 `/private/tmp/sapd-maturity-report-design-audit-20260718/01-current-report-page.png`、人工结论内容设计 `/Users/kim1st/.codex/.chatgpt-projects/g-p-6a0141ade554819195eb79578e83c85f/SAPD_成熟度评估人工结论内容设计_V1.1.md`，以及 Figma 实施评审板 `https://www.figma.com/design/QTozvhOuhoqMrj1VPkApdG`。
- implementation：新增独立“评估报告 V2”页签；目标页面 `http://127.0.0.1:5173/workbench/maturity/demo-project-001`，原“评估报告”页面未改。
- browser-rendered evidence：`/private/tmp/sapd-maturity-report-v2-implementation-20260718.png`；应用内浏览器 `1280×720`，未启动系统 Chrome。
- same-canvas comparison：`/private/tmp/sapd-maturity-report-v2-current-vs-implementation-20260718.png`；左侧为原评估报告，右侧为 V2 编制工作台，同一项目、同一视口。

## Findings

无剩余 Web P0 / P1 / P2 设计阻塞。

- 信息架构：原报告将四项人工内容直接放入结果页；V2 改为“编制工作台 → 正式报告预览”两层结构，五阶段为解释数据、形成研判、提出行动、压缩摘要、形成决议。
- 字段契约：15 项结论默认空白；每项均以“系统依据 / 填写参考 / 人工填写”三列呈现，并与正式报告预览按字段 ID 实时同步。
- 数据真实性：当前成熟度、目标成熟度、L2 差距、证据覆盖、行动登记、双雷达、Top 5 与附录继续读取当前项目评估结果，不在 V2 页面重新计算评分口径。
- 视觉：沿用 SAPD Apple Shell、系统中文字体、低彩度蓝灰层级、紧凑项目 Tab 和既有报告图表组件；没有引入营销式 hero、渐变或独立视觉语言。
- 页面几何：`1280×720` 页面横向溢出 `0px`，全页仅一个 `h1`；五阶段字段分布为 `2 / 2 / 3 / 4 / 4`，两类雷达均可见且有实际数据。
- 隔离边界：原评估报告仍显示“更新评估报告 / 导出 HTML / 导出 Markdown”，V2 不接管原报告导出，也不修改评分逻辑、ETL、数据口径或用户数据库。
- Figma：实施评审板包含现状证据、审计结论、V2 架构与首版边界；第二张项目截图因外部传输审批未通过，保留了明确占位说明，没有绕过审批上传。

## Primary interactions tested

- 进入“评估报告 V2”后，刷新仍停留在 V2；测试输入已清空，项目恢复 `0 / 15`。
- 第一阶段输入后，工作台、正式报告字段、完成度与缺项提示同步更新；清空后再次刷新仍为空。
- 五个阶段逐项切换，DOM 字段 ID 合计 15 项且无重复。
- 在原“评估报告”和 V2 之间往返，两个页面互斥渲染，原报告动作保持可用。

## Remaining risk

- 本轮按用户要求只新增 Web/共享前端页面，未重建或回归 macOS DMG App；共享前端变更需在下一次发布矩阵补 App 运行证据。

final result: passed

---

# 成熟度评估报告方案 2 与完整附录 Design QA（2026-07-17）

- source visual truth：Product Design 方案 2 参考图 `/Users/kim1st/.codex/generated_images/019f6f8d-7a79-7f90-9a12-28a984deacef/exec-2a42ed13-36dc-47a7-b093-59a0e609ea96.png`。
- implementation：`demo-project-002` 基于真实评估结果生成的自包含 HTML；应用内浏览器 `1440×1024`，未启动系统 Chrome。
- browser-rendered evidence：`/private/tmp/sapd-report-option2-top.png`、`/private/tmp/sapd-report-option2-lower.png`。
- same-canvas comparison：`/private/tmp/sapd-report-option2-comparison.png`；首屏重点区域比较为 `/private/tmp/sapd-report-option2-focused-comparison.png`。
- validated state：正式报告已生成；第一页管理层决策记分卡、第二页人工结论、第三页完整数据附录。

## Findings 与比较历史

无剩余 Web P0 / P1 / P2 设计阻塞。

- 用户否决前一版方案 3 后，前两页改为方案 2 的管理层决策记分卡：白底编辑式版面、深海军蓝与克制橙色强调、`L3 → L4` 直接表达当前与目标，不再使用会产生层级歧义的边缘箭头。
- 附录沿用用户确认的正式表格风格，没有随方案切换改版；第三页继续完整承载层级统计、评分统计、维度排名、能力结果、总体排名、评分明细和评估口径说明。
- Fonts / typography：使用系统中文字体、紧凑数字字面与清晰标题层级；管理层结论、数值和附录表格均能在浏览器中完整阅读。
- Spacing / layout：首屏形成“成熟度跃迁—决议议题—核心指标—双雷达—关键差距”的稳定阅读顺序；三页容器均无横向溢出。参考图为纵向概念稿，实现为适配真实全量数据的宽版自包含 HTML，这是有意差异。
- Colors / tokens：深海军蓝承载结论和数据，橙色仅用于目标与行动优先级；没有引入营销式渐变、玻璃拟态或高饱和装饰。
- Image quality / asset fidelity：雷达图由报告内联 SVG 根据当前评估数据动态绘制，不依赖外部图片资产；全 L2 雷达在单轴缺失时保留缺口并继续绘制其余有效边，四维雷达完整呈现当前值和目标值。
- Copy / content：决议议题、关键差距、四维和 T/G/M 数据均来自当前评估结果；不展示结果摘要哈希、快照 ID、算法版本等非业务字段。四个人工区继续使用“评估概况、关键发现、提升建议、下一步计划”。

## Primary interactions tested

- 四个人工文字区均保留 `contenteditable` 编辑能力。
- DOM 验证：报告页 `3`、人工区 `4`、雷达图 `2`、附录分区 `7`；决议议题与四维雷达均存在。
- 单个 L2 缺失的专项验证：当前 / 目标雷达各绘制 `30` 条有效相邻边，不再出现整张雷达无数据。
- 应用内浏览器 console error `0`，页面横向溢出 `0px`。

## Intentional deviations

- 方案 2 概念图只定义管理层主视图；生产报告必须容纳真实的 32 项 L2 数据和后续可扩展统计，因此第二页保留人工结论，第三页保留可扩展完整附录。
- 动态内联 SVG 是自包含 HTML 导出与真实数据驱动的产品约束，不是装饰性手工图形。

final result: passed

---

# 成熟度 L2 四维均值同一数值行第三十轮 Design QA（2026-07-17）

- source visual truth：用户截图 `/var/folders/81/8nwy3h2n00s1dw1g5bnvj7j40000gn/T/codex-clipboard-668a3a59-2650-4f45-9d6a-d6f377e70e60.png`。
- implementation：`http://127.0.0.1:5173/#/workbench/maturity/demo-project-001` 的“评分执行”L2 汇总；应用内浏览器 `1280×720`，未启动系统 Chrome。
- browser-rendered evidence：`/private/tmp/sapd-maturity-r30-after-1280x720.png`。
- same-canvas comparison evidence：`/private/tmp/sapd-maturity-r30-reference-vs-after.png`；上方是用户的两列两行反例，下方是同一 L2 汇总的修复后四列渲染。两张图的具体评分值因浏览器 demo 本地状态不同而不同，比较只判断用户裁定的读数几何、完整标签和横向比较能力。

## Findings 与比较历史

无剩余 Web P0 / P1 / P2 设计阻塞。

- P1 根因：`1130px` 容器查询把仍有足够读数宽度的中宽工作台提前切成两列两行；四维区域随之出现纵向空白，破坏四个值的一排比较。
- 修复：三组宽度调整为成熟度 / 四维均值 / 评估点 `0.85 : 1.40 : 0.85`，四维均值保持四列；仅容器小于 `480px` 才回流两列两行。
- Fonts / typography：系统字体保持；完整四维标签不省略，四个 `28px` 数字均位于 `Y=480.3px`，数值跨度 `0`，继续使用 `tabular-nums`。
- Spacing / layout rhythm：`1280×720` 下四列各 `169.25px`，当前 / 目标与评估点各自保留所属边界；汇总高度由 `444.1px` 收敛为 `372.1px`，没有引入横向页面滚动。
- Colors / tokens：沿用低彩度 Apple Shell、当前蓝和目标金棕的既有语义；没有增加 token 或装饰性样式。
- Image quality / assets：本区域没有图像资产；本轮没有新增 SVG、CSS 图形或占位资源。
- Copy / content：组织与角色、制度与流程、平台与工具、数据与信息均完整显示；未新增主展示字段，禁显字段命中 `0`。

## Primary interactions tested

- 固定项目直达“评分执行”，检查同一 L2 汇总的四维数值单行、当前 / 目标边界、适用性 / 评估进度和横向溢出。
- 资源实际加载版本为 `maturity-assessment-v2.1-dimension-single-row-20260717-35`；专项审计 `220/220`、maturity HTTP/API smoke 通过。

## Open Questions

Web 无设计阻塞，`OI-192` 保持“已修复 / 待用户验收”。macOS DMG App 未重建、未回归；共享前端变更在下一次发布矩阵补 App 证据。

final result: passed

---

# 成熟度评估项目概览与解锁编辑 Design QA（2026-07-17）

- visual truth：用户提供的项目概览、评估进度与全局搜索基准截图。
- implementation：`http://127.0.0.1:5173/workbench/maturity/demo-project-002`
- viewport：Codex 内置浏览器 `2048 x 1024`，未启动系统 Chrome。
- full-view comparison：`/private/tmp/sapd-maturity-overview-comparison-20260717.png`（左：用户现状；右：本轮实现）。
- focused search comparison：`/private/tmp/sapd-maturity-search-comparison-20260717.png`（左：全局基准；右：局部搜索实现与 `1 / 10` 匹配状态）。

## 验证结论

无剩余 P0 / P1 / P2 设计问题。

- 项目基本信息与评估进度卡片顶线一致，高度均为 `581.59375px`；页面横向溢出为 `0px`。
- 进度区域显示总体完成率，并分别展示能力、关注点、评估点的总计、适用、适用对象完成率、已完成、待完成和不适用数量。
- 项目基本信息新增历史修改记录；解锁、再次完成和报告快照动作写入项目本地历史。
- 已完成或已生成报告的项目显示“修改评估分数”。取消确认保持锁定；确认后保留现有评分并回到“待完成评估”，评分检查页“完成评估”按钮恢复可用；再次完成后重新锁定，报告快照可重新生成。
- 局部搜索复用全局胶囊输入、搜索图标、匹配序号与前后定位控件；实测“安全”返回 `10` 项，下一项从 `1 / 10` 更新到 `2 / 10`，`Esc` 清空结果。

## Interaction Verification

| 路径 | 结果 | 状态断言 |
|---|---|---|
| 修改评估分数 → 取消 | 通过 | 弹窗关闭，项目继续锁定，主动作仍为“修改评估分数” |
| 修改评估分数 → 确认解锁 | 通过 | 状态回到“待完成评估”，评分执行恢复，提示明确报告失效 |
| 评分检查 → 完成评估 | 通过 | 按钮可点击，完成后重新锁定 |
| 报告快照 → 生成报告快照 | 通过 | 状态恢复“已生成报告” |
| 局部搜索 → 下一项 → Esc | 通过 | 匹配索引更新，键盘清空成功 |

## Open Questions

- Web 设计无阻塞；macOS DMG App 本轮未重建，共享前端行为需在下次发布矩阵中补 App 证据。
- 仓库外业务设计文档尚未同步，需用户明确授权后写入。

final result: passed

---

# 成熟度 L2 四维均值完整标签与数值基线第二十九轮 Design QA（2026-07-17）

- source visual truth：用户截图 `/var/folders/81/8nwy3h2n00s1dw1g5bnvj7j40000gn/T/codex-clipboard-7ed7513f-8598-4e1f-88e0-2aad22034d01.png`。
- implementation：`http://127.0.0.1:5173/#/workbench/maturity/demo-project-001` 的“评分执行”L2 汇总；应用内浏览器 `2048×1152`、`1280×720` 与 `786×900`，未启动系统 Chrome。
- browser-rendered evidence：`/private/tmp/sapd-maturity-r29-after-2048x1152.png`。
- same-canvas comparison evidence：`/private/tmp/sapd-maturity-r29-reference-vs-after.png`；用户图与修复后同一 L2 汇总区域已经放入一张画布后判断。

## Findings 与比较历史

无剩余 Web P0 / P1 / P2 设计阻塞。

- P1 根因：四维均值的直接子项沿用横向标签—数值压缩模型，标签同时被 `overflow: hidden + text-overflow: ellipsis` 限制；视觉上出现“组织…”并使维度归属与数值基线模糊。
- 修复：每个维度改为独立的“标签在上 / 数值在下”读数列；完整标签启用 visible / clip，数值使用 `tabular-nums`。宽屏四列与“适用性 / 评估进度”标题、数值轨道偏差均不超过 `1.4px`；中窄宽度回流两列两行，不省略标签。
- Fonts / typography：系统字体保持；四维标签完整可读、主数值 `28px`，四个维度数值轨道跨度 `0`。
- Spacing / layout rhythm：宽屏维度与评估点两组高度一致；`1280×720 / 786×900` 合理回流且页面横向溢出 `0`，不引入第二个滚动 owner。
- Colors / tokens：沿用已有低彩度 Apple Shell 与数值色，无新增 token。
- Image quality / assets：本区域无图片资产，本轮未新增 SVG、CSS 图形或占位资源。
- Copy / content：四项业务名称均完整显示；无新增主展示字段，禁显字段命中 `0`。

## Primary interactions tested

- 固定项目直达“评分执行”，检查 L2 汇总的完整四维名称、数值列与响应式回流。
- `2048×1152` 宽屏标题 / 数值基线，`1280×720 / 786×900` 两列回流，横向溢出均为 `0`。
- 资源实际加载版本为 `maturity-assessment-v2.1-dimension-metric-grid-20260717-34`；console warning / error 为 `0`。

## Open Questions

Web 无设计阻塞，`OI-192` 保持“已修复 / 待用户验收”。macOS DMG App 未重建、未回归；共享前端变更在下一次发布矩阵补 App 证据。

final result: passed

---

# 成熟度当前 / 目标双单元第二十八轮 Design QA（2026-07-17）

- source visual truth：用户截图 `/var/folders/81/8nwy3h2n00s1dw1g5bnvj7j40000gn/T/codex-clipboard-fa8dc53a-04df-4fe2-a620-cb78e670dd30.png`。
- implementation：`http://127.0.0.1:5173/#/workbench/maturity/demo-project-001` 的“评分执行”L2 汇总；应用内浏览器实际验收视口 `2048×1152`、`1600×900` 与 `786×900`，未启动系统 Chrome。
- browser-rendered evidence：`/private/tmp/sapd-maturity-r28-before-2048x1152.png`、`/private/tmp/sapd-maturity-r28-after-1600x900.png`、`/private/tmp/sapd-maturity-r28-after-2048x1152.png`。
- same-canvas comparison evidence：`/private/tmp/sapd-maturity-r28-reference-vs-after.png`、`/private/tmp/sapd-maturity-r28-focused-reference-vs-after.png`；用户标注与修复后真实渲染已放入同一画布后判断。

## Findings 与比较历史

无剩余 Web P0 / P1 / P2 设计阻塞。

- P1 根因：父 `.maturity-v22-maturity-summary` 被错误分成标题轨道与空内容轨道，两个直接子格只获得约 `24px` 高度，等级 / 分数依靠 `overflow: visible` 溢出显示；成熟度组收窄到最小宽度时，两组读数因此靠近分隔线并形成视觉粘连。
- 修复：父组改为单一完整高度轨道，两个子格分别承担 `20px` 标题和不小于 `56px` 的数值区；宽桌面为成熟度组保留 `280px` 最小宽度，中宽工作台在 `1130px` 进入三列结构，组内等级—分数间距收敛为 `8px`，未缩小 `28px` 主字号。
- 修复后几何：`1600×900` 下两个子格高度均为 `108.8px`，主数字组间距 `32.2px`，当前值距分隔线 `20.2px`；`2048×1152` 间距 `41.7px`，`786×900` 间距 `202.4px`。三视口页面横向溢出均为 `0`。
- Fonts / typography：继续使用系统字体，等级与连续分数均为 `28px`、同一水平中线；没有用缩字号掩盖空间问题。
- Spacing / layout rhythm：当前 / 目标各自留在所属格子，分隔线和留白清晰；评估维度、评估点、滚动和下方评分表单几何未改。
- Colors / tokens：沿用现有蓝色当前值、金棕目标值和 Apple Shell 低彩度边框，无新增 token。
- Image quality / assets：本区域无图片资产，本轮未新增 SVG、CSS 图形或占位资源。
- Copy / content：标签和值均未改；主区禁显字段命中 `0`，console warning / error 为 `0`。

## Primary interactions tested

- 固定项目直达“评分执行”，显式选中 `T-AS.AD` 的 L2 汇总。
- `2048×1152 / 1600×900 / 786×900` 响应式几何、双格高度、主数字间距和页面横向溢出。
- 资源实际加载版本为 `maturity-assessment-v2.1-maturity-cell-layout-20260717-33`。

## Open Questions

Web 设计与交互无阻塞，`OI-192` 保持“已修复 / 待用户验收”。macOS DMG App 未重建、未回归；共享前端变更在下一次发布矩阵补 App 证据。

final result: passed

---

# 成熟度评估外层滚动、摘要回流、能力类别评分与双格式报告第二十七轮 Design QA（2026-07-17）

- source visual truth：用户截图 `/var/folders/81/8nwy3h2n00s1dw1g5bnvj7j40000gn/T/codex-clipboard-26d68b95-4ef7-4e55-9257-b8d55c1f046f.png`、`/var/folders/81/8nwy3h2n00s1dw1g5bnvj7j40000gn/T/codex-clipboard-355340db-ca64-40ba-be47-107c8e68e130.png`、`/var/folders/81/8nwy3h2n00s1dw1g5bnvj7j40000gn/T/codex-clipboard-02ca7d62-47a1-4441-8f18-9535c359d2db.png`、`/var/folders/81/8nwy3h2n00s1dw1g5bnvj7j40000gn/T/codex-clipboard-d9bf4f19-dfcd-481d-a762-363fb85e6e3d.png`。
- implementation：`http://127.0.0.1:5173/#/workbench/maturity/demo-project-001`、`http://127.0.0.1:5173/#/workbench/maturity/demo-project-002`；应用内浏览器实际验收视口 `2048×1152` 与 `786×1458`，未启动系统 Chrome。
- browser-rendered evidence：`/private/tmp/sapd-maturity-r27-after-scoring-2048x1152.png`、`/private/tmp/sapd-maturity-r27-after-scoring-786x1458-v2.png`、`/private/tmp/sapd-maturity-r27-after-overview-2048x1152.png`、`/private/tmp/sapd-maturity-r27-after-results-2048x1152.png`、`/private/tmp/sapd-maturity-r27-after-report-2048x1152.png`。
- same-canvas comparison evidence：`/private/tmp/sapd-maturity-r27-reference-vs-after-scoring.png`、`/private/tmp/sapd-maturity-r27-reference-vs-after-category.png`；参考与实现已经放入同一画布后判断。

## Findings 与比较历史

无剩余 Web P0 / P1 / P2 设计阻塞。

- P1 双滚动：旧页面同时有项目外层和评分表单滚动。宽屏现为项目页 `client=1000 / scroll=1524 / overflow=auto`，评分表单 `1104 / 1104 / visible`；窄屏为项目页 `1306 / 2774 / auto`，评分表单 `1622 / 1622 / visible`，四维区同样不独立滚动。参考 / 实现同画布确认右侧只剩项目外层滚动条。
- P1 窄屏摘要：第一版虽把等级 / 分数统一为 `28px`，但 `786px` 下仍把三组统计塞在同排。第二轮用 `760px` 容器查询按“成熟度 → 维度均值 → 评估点情况”回流；成熟度双格 `673×78px`，等级与分数均 `28px` 且不重叠，页面横向溢出 `0`。
- P2 概览密度：取消概览最小视口高度和阶段区 `margin-top:auto`；项目情况 / 进度实测 `1160 / 580px = 2.0`，网格 `min-height=0`，不显示知识快照。
- P2 能力类别：旧“分层评价”改为“能力类别评分”，标题 computed font-size `14px`。T / G / M 与当前分数间距均为 `7px`，目标和类别名称留在同一类别第二行；旧名称命中 `0`。
- 报告：页面保持四个人工文字区，右栏明确两个独立文件和共同内容范围；Markdown / HTML 两个按钮分别具有唯一 `data-format`。HTML 预览 `srcdoc` 长度 `11200`，专项审计验证两种后端输出都含项目事实、总体成熟度、四维、能力类别、L2、差距、限制和人工文字。应用内浏览器不暴露 Blob download 事件，因此以可点击 DOM、独立处理分支和后端输出审计共同验收。
- Typography / color / spacing：沿用 Apple Shell 系统字体、蓝 / 金成熟度角色色和现有低彩度边框；没有新增图片资产、SVG、CSS 插画或新视觉语言。
- 字段边界：未新增主展示字段；页面继续不展示 `sheet / row / column / raw_value / source_file / import_id / source_id / source_ref / source_label / debug / raw / metadata / intermediate / generated_at`。

## Primary interactions tested

- 评分页 `2048×1152 / 786×1458` 外层滚动、摘要分组回流和页面横向溢出。
- 项目概览 `2:1` 几何与知识快照禁显。
- 已完成项目“评估结果 → 报告快照”切换；结果主摘要、能力类别分组、四个文字区、两个独立导出按钮和完整 HTML 预览均存在。
- 资源实际加载版本为 `maturity-assessment-v2.1-outer-scroll-report-20260717-32`。

## Open Questions

Web 设计与交互无阻塞，`OI-192` 保持“已修复 / 待用户验收”。macOS DMG App 未重建、未回归；共享前端变更在下一次发布矩阵补 App 证据。

final result: passed

---

# 首页“工作事项”与知识统计 Mosaic V8 Design QA（2026-07-17）

- source visual truth：用户截图 `/var/folders/81/8nwy3h2n00s1dw1g5bnvj7j40000gn/T/codex-clipboard-adf6ea07-44c8-48dd-950a-2d918d64fd5c.png`、`/var/folders/81/8nwy3h2n00s1dw1g5bnvj7j40000gn/T/codex-clipboard-be9c29df-090f-4d9d-870a-61002f4a5538.png`，以及用户裁定“ISSUE 与评估工作不能混合统计；知识库统计使用不规则大小区块”。
- implementation：`http://127.0.0.1:5173/#/`；应用内浏览器实际验收视口 `1280×720` 与 `720×900`，未启动系统 Chrome。
- browser-rendered evidence：`/private/tmp/sapd-dashboard-v8-final-1280x720.png`。
- same-canvas comparison evidence：`/private/tmp/sapd-dashboard-v8-reference-vs-final.png`；左侧为用户指出的混合统计与等尺寸知识区块，右侧为同一首页的 V8 实现。

## Findings 与比较历史

无剩余 Web P0 / P1 / P2 设计阻塞。

- P1：V7 的“本地工作进展”把 ISSUE 总数 / 待处理数与成熟度项目 / 正式结果放进同一统计带，暗示两类对象存在共同进度。V8 删除该区域和全部相关样式，面板改名为“工作事项”，两条工作流各自持有数量、快捷入口、最近记录和更多菜单。
- P2：旧知识统计为规则 `3×2` 等尺寸网格，视觉节奏弱。V8 使用 6 列 Mosaic：能力与服务跨两行，关注点与技术模块 / 措施占中间短区块，标准与字典各占半行；实测 6 个区块形成 3 种尺寸，不改变任何统计值或对象粒度。
- Typography / color：继续使用系统字体、Apple Shell 的低彩度蓝 / 紫 / 青 / 金和既有字号角色；较大区块只放大主数字，不增加营销文案或装饰图形。
- Spacing / layout：`1280×720` 下工作事项和知识统计并排，知识区块实际尺寸为 `136×204`、`136×102`、`204×108px`；`720×900` 下工作流单列、知识统计两列回流，页面横向溢出均为 `0`。
- Copy / content：旧“继续工作 / 本地工作进展 / 继续评审与评估”命中均为 `0`；新标题为“工作事项”。主区禁显字段命中 `0`，console warning / error 为 `0`。

## Primary interactions tested

- DOM 断言：混合概览 `0`、独立工作流 `2`、ISSUE 行 `5`、成熟度项目行 `3`、更多菜单 `2`、快捷入口 `2`、知识统计区块 `6`。
- ISSUE 三点菜单打开后显示“查看全部 40 条 ISSUE”；`Escape` 关闭并把焦点恢复到“ISSUE清单更多”触发器。
- `1280×720` 与 `720×900` 响应式布局，横向溢出均为 `0`；真实数据数值与 P2 权威摘要保持不变。

## Open Questions

Web 设计与交互无阻塞。macOS DMG App 未重建、未回归；共享前端变更在下一次发布矩阵补 App 证据。

final result: passed

---

# 成熟度评估整区滚动、页面比例与结果表达第二十六轮 Design QA（2026-07-16）

- source visual truth：用户截图 `/var/folders/81/8nwy3h2n00s1dw1g5bnvj7j40000gn/T/codex-clipboard-d3eb6741-7c8d-4310-9e2b-52e5076d5ef4.png`、`/var/folders/81/8nwy3h2n00s1dw1g5bnvj7j40000gn/T/codex-clipboard-6c8b38a4-be35-4dcf-9fa7-ce26e277c581.png`、`/var/folders/81/8nwy3h2n00s1dw1g5bnvj7j40000gn/T/codex-clipboard-cba8f681-2c0c-4f83-b78f-2926c038722d.png`、`/var/folders/81/8nwy3h2n00s1dw1g5bnvj7j40000gn/T/codex-clipboard-c2455b83-ee5b-4638-afa7-68f7623cd8bb.png`、`/var/folders/81/8nwy3h2n00s1dw1g5bnvj7j40000gn/T/codex-clipboard-3b4ca01d-4033-4353-b2cc-82fcdffb3bf9.png`、`/var/folders/81/8nwy3h2n00s1dw1g5bnvj7j40000gn/T/codex-clipboard-21f3f96d-dcc6-434a-b6ab-2e4f0752b43d.png`、`/var/folders/81/8nwy3h2n00s1dw1g5bnvj7j40000gn/T/codex-clipboard-c11d345e-ea84-4cd7-bc6e-3136541731a3.png`、`/var/folders/81/8nwy3h2n00s1dw1g5bnvj7j40000gn/T/codex-clipboard-d161bb77-73de-4505-9057-9264e4804252.png`。
- implementation：`http://127.0.0.1:5173/#/workbench/maturity`、`http://127.0.0.1:5173/#/workbench/maturity/demo-project-001`、`http://127.0.0.1:5173/#/workbench/maturity/demo-project-002`；应用内浏览器实际验收视口 `1280×720` 与 `2048×1152`，未启动系统 Chrome。
- browser-rendered evidence：`/private/tmp/sapd-maturity-r26-after-home-2048x1152.png`、`/private/tmp/sapd-maturity-r26-after-overview-2048x1152.png`、`/private/tmp/sapd-maturity-r26-after-scoring-2048x1152.png`、`/private/tmp/sapd-maturity-r26-after-results-2048x1152.png`、`/private/tmp/sapd-maturity-r26-after-radars-v2-2048x1152.png`。
- same-canvas comparison evidence：`/private/tmp/sapd-maturity-r26-compare-scoring.png`、`/private/tmp/sapd-maturity-r26-compare-radars.png`、`/private/tmp/sapd-maturity-r26-compare-overview.png`、`/private/tmp/sapd-maturity-r26-compare-home.png`；每张都把用户参考与同一功能状态的实现放在同一画布后再判断，不以分离截图代替比较。

## Findings 与比较历史

无剩余 Web P0 / P1 / P2 设计阻塞。

- 第一轮 P1：第二十五轮只让四维打分列滚动，产生用户标注的内部滚动条。修复后 `maturity-v3-score-form` 为唯一纵向滚动 owner，实测 `clientHeight=915 / scrollHeight=1104 / overflow-y=auto`；四维打分列 `overflow-y=visible`，右侧概览 `position=sticky`。评分定位也优先回退到真实可滚动的评分表单。
- 第一轮 P1：结果左视觉列没有消化右侧统计高度，四维雷达又被 `cssHeight × 0.34` 二次压小。修复后左视觉列与分层统计同高，能力雷达 `1142×531`、四维区 `1142×663`、四维 canvas `682×390`；真实绘图使用宽度 `0.36`、高度 `0.39`、半径上限 `150px`，同图对照中小雷达和外部空轨道均已消除。
- 第一轮 P2：四维精确值使用贯穿侧栏的长横线。修复为两列紧凑信息块，`dl` 两列且每项独立轻边框，不再用长分隔线表达四个值。
- 第一轮 P2：L2 摘要四标题 top 分别为 `278 / 278 / 278 / 278px`，目标等级与分数 computed font-size 均为 `26px`；页面横向溢出 `0`。
- 第一轮 P2：结果主标题从 `L3 成熟度` 改为后端等级加既有等级名称，实测 `L3 充分定义`；没有修改后端 currentLevel 或等级映射。
- 第一轮 P1：项目概览旧比例把进度区放大。修复后项目情况 / 进度实测 `1160px / 580px = 2.0`，概览“知识快照”命中 `0`；默认模板在首页、页头与概览统一显示“SAPD标准能力成熟度模板”。
- 第一轮 P1：首页旧版纵向堆叠项目和模板。`2048×1152` 下现为项目 `1135px`、模板 `613px` 同排，接近 `1.85:1`；`1280×720` 安全回流为单列，两个视口横向溢出均为 `0`。
- Typography / color / spacing：继续使用工程现有系统字体、蓝 / 金成熟度角色色和 Apple Shell 边框 / 圆角；本轮只校正字号基线、区域比例和密度，没有新造视觉语言。
- Image quality：没有新增图片资产、占位图、CSS 插画或手写 SVG；雷达继续由既有 canvas 和同一后端 calculation run 绘制。
- Copy / content：客户结果标题补充等级名称；概览删除知识快照；默认模板 canonical 名称统一。主区禁显字段命中 `0`，console warning / error `0`。

## Primary interactions tested

- 评分执行页宽屏与中等桌面响应式；评分表单、四维打分列和评估概览三者的 computed overflow / sticky 契约。
- “评分明细清单 → 客户评估结果”双向切换，两个 Tab 的 `aria-selected` 均正确更新。
- 结果区页面滚动到雷达组合区，检查能力雷达、四维雷达、四维精确值和右侧分层统计的完整呈现。
- 首页 `2048×1152` 双栏与 `1280×720` 单列回流；项目概览 2:1 和模板 canonical 名称。

## Open Questions

Web 设计与交互无阻塞，`OI-192` 继续保持“已修复 / 待用户验收”，等待用户在固定 5173 入口复验后关闭。macOS DMG App 未重建、未回归；共享前端修复在下一次发布矩阵补 App 证据。

final result: passed

---

# 首页“继续工作”完整 Dashboard V7 Design QA（2026-07-16）

- source visual truth：用户截图 `/var/folders/81/8nwy3h2n00s1dw1g5bnvj7j40000gn/T/codex-clipboard-7e36ab4c-d7e6-41af-b177-5360b9bee9e6.png`，以及用户裁定“保留刚才的工作台效果，清单只是其中一部分”。
- implementation：`http://127.0.0.1:5173/#/`；应用内浏览器实际视口 `1280×720`，未启动系统 Chrome。
- state：真实本地用户库 `40` 条 ISSUE、`33` 条待处理；成熟度 `3` 个项目、`2` 个正式结果就绪；最近清单分别为 `5 / 3`。
- browser-rendered evidence：`/private/tmp/sapd-dashboard-v7-final-1280x720.png`。
- full-view and focused region comparison evidence：`/private/tmp/sapd-dashboard-v7-reference-vs-final.png`；源截图与实现中的“继续工作”面板已进入同一 `1400×720` 对照图，重点比较整体层级、两条工作流、清单归属、字体、色彩和密度，无独立图片资产需要额外局部放大。

## Findings 与比较历史

无剩余 Web P0 / P1 / P2 设计阻塞。

- 第一轮 P1：V6 把整个继续工作区降级成两个扁平清单，丢失原图中的 Dashboard 状态、入口和工作流层级。V7 恢复单一工作台，加入 4 项本地工作概览、ISSUE / 成熟度工作流摘要、显式“继续处理 / 继续评估”入口，再把 5 / 3 条最近记录作为内部清单。
- 第一轮 P2：两条工作流纵向排列时，5 条 ISSUE 把成熟度摘要和项目结果推到 `720px` 首屏之外，左区仍像 ISSUE 列表页。修复为桌面并排工作流后，两种业务、两个快捷入口和两组最近清单同时可见。
- 第二轮 P2：初始并排比例 `1.12 / 0.88` 令成熟度项目名截断过多。修复为等宽双列，3 个项目的名称、组织、状态和结果读数均可扫读。
- Typography：继续使用系统字体与既有 Apple Shell 字重；`WORKBENCH / 继续工作 / 工作流标题 / 清单行` 四级层次清晰，业务长标题只在清单行省略，不挤压状态和结果。
- Spacing / layout：面板按“页头 → 工作概览 → 双工作流摘要 → 内嵌清单 → 本地更新”组织；桌面主网格实测 `540px / 428px`，页面横向溢出 `0`。
- Colors / tokens：ISSUE 使用低彩度蓝，成熟度使用低彩度淡紫；状态使用既有注意 / 正向语义，不引入新的高饱和色或装饰玻璃。
- Image quality：源设计与实现均不依赖图片资产，本轮没有用占位图、CSS 插画或自制 SVG 替代视觉素材。
- Copy / content：保留原图的 `WORKBENCH / 继续工作 / 本地用户库 / ISSUE清单 / 成熟度评估`；新增文案只解释真实工作流，不出现达成率、覆盖率或虚构 KPI。

## Primary interactions tested

- 两个三点更多菜单分别显示“查看全部 40 条 ISSUE / 查看全部 3 个项目”；`Esc` 关闭并恢复到菜单触发器焦点。
- “继续处理”打开显式 Issue `930bba9f-aebb-44c3-912c-a54e330df956`，Inspector ID 与入口 ID 一致。
- “继续评估”打开显式项目 `/workbench/maturity/demo-project-002`。
- DOM 断言：工作概览 `1`、统计项 `4`、工作流 `2`、ISSUE 行 `5`、成熟度行 `3`、更多菜单 `2`、快捷入口 `2`、纯列表退化 `false`。
- console warning / error `0`，主区禁显字段命中 `0`。

## Open Questions

Web 设计与交互无阻塞。全局 AppShell 的 390px 主内容可达性仍属于既有 P2-4，不在本轮从首页组件越权修改；macOS DMG App 在下一次发布矩阵补共享前端证据。

final result: passed

---

# 成熟度评估评分滚动、结果雷达与目标摘要第二十五轮 Design QA（2026-07-16）

- source visual truth：用户截图 `/var/folders/81/8nwy3h2n00s1dw1g5bnvj7j40000gn/T/codex-clipboard-40e86939-ed68-49ca-9be8-499e58007609.png`、`/var/folders/81/8nwy3h2n00s1dw1g5bnvj7j40000gn/T/codex-clipboard-5917a37a-7ce3-4944-ae02-2a4049f4b1e0.png`、`/var/folders/81/8nwy3h2n00s1dw1g5bnvj7j40000gn/T/codex-clipboard-fff1d5b1-a998-4fd1-a9a3-c76ea3b02910.png`、`/var/folders/81/8nwy3h2n00s1dw1g5bnvj7j40000gn/T/codex-clipboard-1c51ba39-a997-4bb8-87d2-10a30aaba581.png`、`/var/folders/81/8nwy3h2n00s1dw1g5bnvj7j40000gn/T/codex-clipboard-1c51cffb-db16-410c-a1a6-ecbf7cc52afd.png`。
- implementation：`http://127.0.0.1:5173/#/workbench/maturity/demo-project-002`；应用内浏览器实际视口 `1280×720`，未启动系统 Chrome。
- state：完成态项目的“评分执行 / 评估结果”，覆盖打分区局部滚动、客户 / 明细视图切换、目标摘要、能力雷达、四维雷达和分层统计。
- browser-rendered evidence：`/private/tmp/sapd-maturity-r25-after-scoring.png`、`/private/tmp/sapd-maturity-r25-after-result-top.png`、`/private/tmp/sapd-maturity-r25-after-radar.png`、`/private/tmp/sapd-maturity-r25-after-radar-dimension.png`。
- full-view comparison evidence：`/private/tmp/sapd-maturity-r25-reference-vs-after-scoring.png`；参考与实现已进入同一 `2560×720` 对照图。参考为 `2266×982` 宽桌面，运行证据为 `1280×720` 响应式桌面，故不对跨视口字号做像素级断言。
- focused region comparison evidence：`/private/tmp/sapd-maturity-r25-reference-vs-after-radar.png`；同一画布直接比较用户标注空白区与四维雷达嵌套后的结果。

## Findings 与比较历史

无剩余 Web P0 / P1 / P2 设计阻塞。

- 第一轮 P1：旧结构把四维雷达放在能力 + 分层统计两列之后，右列过高时左列产生大面积空轨道。修复后宽桌面计算网格为 `600px + 360px`；左列能力雷达后紧接四维雷达，右列分层统计继续向下展开，对照图中红框空白已由四维雷达占用。
- 第一轮 P1：第二十三轮 sticky 评分上下文与共享页面滚动挤压真实打分区。修复后上下文随页面自然滚动，评分表单独立；实测打分区 `scrollTop 0 → 360` 时项目页 `scrollTop=359` 和评估概览 `top=638px` 均不变，只有打分区滚动。
- 第一轮 P2：结果首排重复当前成熟度，并显示“目标指数 / 5.00”“同粒度后端聚合”。修复后当前卡数量 `0`、目标卡数量 `1`，读数为 `L4 + 3.68`；两段冗余文字命中 `0`。
- 第一轮 P2：`客户结果 / 内部明细` 名称模糊且胶囊选中态偏离共享基准。修复后名称为“客户评估结果 / 评分明细清单”，透明背景、2px 下划线选中态；两次切换的 `aria-selected=true` 均通过。
- Typography：继续使用工程现有字体、字重与数字等宽角色；L2 摘要移除重复 `/ 5.00` 小字，等级和分数不再重叠。
- Spacing / layout：结果双列、雷达视觉列和评分滚动区均有明确 owner；页面横向溢出 `0`，没有固定高度空占位。
- Colors / tokens：目标沿用低彩度金棕，T / G / M 沿用现有蓝 / 紫 / 绿语义；没有新造颜色系统。
- Image quality：本轮没有新增或替换图片资产；雷达继续使用既有 canvas 绘制和后端结果。
- Copy / content：删除两段冗余说明，新增两个用户裁定名称；主区 14 个禁显字段命中 `0`。

## Primary interactions tested

- “评分明细清单 → 客户评估结果”双向切换。
- 项目页保持原位时滚动四维打分区，确认概览与页面位置稳定。
- 结果页能力雷达 / 四维雷达 / 分层统计几何和响应式无横向溢出。
- console warning / error：`0`。

## Open Questions

Web 设计与交互无阻塞，等待用户按固定入口业务复验。macOS DMG App 未重建、未回归；共享前端修复在下次发布矩阵补 App 证据。参考截图为超宽桌面而应用内 Browser 固定为 `1280×720`，宽桌面结构通过计算网格和同图局部证据验证，最终手感仍由用户超宽显示器复验。

final result: passed

---

# 成熟度评估首页、结果与报告第二十四轮 Design QA（2026-07-16）

- visual truth：用户本轮六张截图，覆盖完成提示、雷达空白、更多菜单、等级 / 分数、完成门禁和返回后残留。
- implementation：`http://127.0.0.1:5173/#/workbench/maturity`；应用内浏览器 `1280×720`，雷达同参考 CSS 视口 `1405×653`，未启动系统 Chrome。
- comparison：`/private/tmp/sapd-maturity-v24-reference-vs-after-20260716.png`；报告证据 `/private/tmp/sapd-maturity-v24-report-20260716.png`。

## Findings

无剩余 Web P0 / P1 / P2 设计阻塞。

- 首页：页面第一内容区为项目进展，模板管理作为第二个可见资产区；首页“更多”按钮数量 `0`、模板管理区数量 `1`，模板导入、默认 / 自定义模板和导入任务形成独立闭环。
- 状态：项目动作反馈使用路由内联区域；生成报告后返回首页，反馈节点数量从 `1` 清为 `0`，没有固定右上角残留。完成门禁专项断言只保留适用项未完成与目标冲突，不适用和无证据均为信息项。
- 结果：雷达栈真实 DOM 顺序为 `maturity-v21-capability-radar-layout → maturity-v21-dimension-radar-row`；全能力分组雷达与四维雷达属于同一结果组合区，删除旧空轨道。当前 / 目标卡片分别显示 `L3 + 2.82`、`L4 + 3.68`，离散等级与连续指数使用不同字号和语义标签。
- 报告：四个汇报文字区、一个自包含 HTML 预览和 Markdown / HTML 两个导出动作均存在；JSON / 项目包导出数量 `0`。HTML 包含管理层摘要、四维成熟度、T / G / M、主要差距、L2 表和 `contenteditable` 汇报文字区。
- 运行态：页面横向溢出 `0`、console warning / error `0`；主展示区禁显字段命中 `0`。
- 视觉对照：参考图与修复后截图已放入同一比较画布人工检查。首页由入口菜单变为资产区域，等级与指数层级分离，能力雷达填补旧空白并在其后连续显示四维雷达；没有用固定高度、空占位或第二个模板入口补齐版面。

## Open Questions

Web 设计与交互无阻塞，等待用户按固定入口业务复验。macOS DMG App 未重建、未回归；共享前端修复需在下次发布矩阵补 App 证据。组合 `frontend + runtime` 的 `runtime:content` 仍被并行技术服务分组改动造成的旧“默认 160 行全部可见”断言阻断，不属于本轮成熟度页面缺陷，未越权修改该共享文件。

final result: passed

---

# 成熟度模型使用指南 v1.3“评估工具使用”Design QA（2026-07-16）

- source visual truth：用户截图 `/var/folders/81/8nwy3h2n00s1dw1g5bnvj7j40000gn/T/codex-clipboard-26124e0a-0687-46eb-99d6-dd1ed93729c9.png`，显示旧指南仍把文件解析、对象匹配与低置信度审查作为默认主流程。
- business truth：`SAPD_成熟度评估业务设计_V2.1_20260712.md`、成熟度完整前端设计规格和当前 `MaturityAssessmentWorkbench.js` 真实页面。
- implementation：`http://127.0.0.1:5173/#/guides/maturity-model-usage`；应用内浏览器 `1440×1024 / 820×1024`，未启动系统 Chrome。
- after evidence：`/private/tmp/sapd-maturity-guide-v13-tool-1440x1024.png`、`/private/tmp/sapd-maturity-guide-v13-tool-820x1024.png`。

## Findings

无剩余 Web P0 / P1 / P2 设计阻塞。

- 主流程：第 3 章改为项目队列、三步新建浮层、模板确认、评分执行、评分检查、评估结果与报告快照；旧默认流程短语命中为 `0`。
- 真实页面：补齐项目六步导航、评分目录、SERVICE / FOCUS 两类评估点、四维 L1—L5、目标等级、逐点评估适用性、唯一可选说明、自动保存、“保存并转到下一项”和“下级评估设置”。
- 辅助路径：文件交换、对象匹配和人工审查只在导入评分数据、自定义模板结构或未来问卷材料时触发；低置信度候选不得直接形成评分。
- 文档契约：源文档升级为 v1.3；AppShell 唯一下载名同步为 `SAPD-成熟度模型使用指南-v1.3.html`，六个章节锚点、244px 目录、隔离 iframe 和自包含图片保持。
- 运行态：桌面 App 与 iframe 横向溢出均为 `0`；窄屏 App / iframe 分别为 `820 / 820`、`785 / 785`，第 3 章表格局部溢出为 `0`；唯一 iframe 与唯一下载入口保持，console warning / error 为 `0`。
- 字段边界：主区与第 3 章对 `sheet / row / column / raw_value / source_file / import_id / source_id / source_ref / source_label / debug / raw / metadata / intermediate / generated_at` 命中为 `0`。

## Open Questions

Web 内容与交互无阻塞。macOS DMG App 的 WKWebView 下载落盘行为仍按既有发布矩阵后置；本轮未重打 DMG。

final result: passed

---

# 成熟度评估第二十三轮分组结果、固定评分上下文与检查门禁 Design QA（2026-07-16）

- visual truth：用户本轮结果热力表、评分检查和固定评分上下文截图，分别为 `/var/folders/81/8nwy3h2n00s1dw1g5bnvj7j40000gn/T/codex-clipboard-563a1128-c1d2-4194-b7da-3b5f7e408478.png`、`/var/folders/81/8nwy3h2n00s1dw1g5bnvj7j40000gn/T/codex-clipboard-31600431-6926-4c9a-82b5-3d58c33ad6a7.png`、`/var/folders/81/8nwy3h2n00s1dw1g5bnvj7j40000gn/T/codex-clipboard-0fde630b-d83c-435e-8e2d-137699c42a1e.png`。
- implementation：`http://127.0.0.1:5173/#/workbench/maturity/demo-project-001`；完成态结果对照使用受控项目 `demo-project-002`。
- viewport / state：应用内浏览器 `1440 × 1024`；另复核 `820 × 1024`。覆盖评估结果、评分检查、SERVICE 评分与 DIRECT FOCUS 评分，未启动系统 Chrome。
- combined comparison：`/private/tmp/sapd-maturity-round23-design-comparison.png`；同一输入中左侧为用户参考区域，右侧为真实运行实现。

## Findings 与修正历史

无剩余 Web P0 / P1 / P2 设计阻塞。

- 结果页：热力表、总体优先级、维度优先级严格按顺序排列并支持整区折叠；L2 精确值只在 T / G / M 分组热力表出现一次，雷达下无重复精确值区和空白占位。
- 评分检查：目标冲突、未完成、不适用核对、无证据信息四组均可独立折叠；只有前两类进入完成门禁，所有可定位条目保留“返回评分”。
- 评分上下文：第一轮固定容器复核发现旧直接子节点选择器未覆盖嵌套汇总卡，`104px` 旧高度裁切统计；最终改为自然高度，并在中宽桌面形成“能力标题 + 当前/目标、维度均值、评估点情况三列”，实测 `clientHeight=160 / scrollHeight=160`。
- 滚动与响应式：共享项目滚动从 `0` 到 `742.5` 后固定上下文 `top=252px` 保持不变；桌面和窄屏页面级横向溢出均为 `0`，热力表只在声明的局部容器横向滚动。
- 对象与字段：目录可见关注点真实点击前后 `scrollTop=177` 保持；DIRECT FOCUS 无单项伪 Tab；主区 14 个禁显字段命中 `0`；控制台 error / warning 均为 `0`。

## Comparison Evidence

- 结果页：`/private/tmp/sapd-maturity-round23-results-desktop.png`。
- 评分检查：`/private/tmp/sapd-maturity-round23-review-desktop.png`。
- 固定评分上下文：`/private/tmp/sapd-maturity-round23-scoring-desktop.png`。
- 窄屏结果页：`/private/tmp/sapd-maturity-round23-results-narrow.png`。

final result: passed

---

# 成熟度指南下载入口 Design QA（2026-07-16）

- source visual truth：用户截图 `/var/folders/81/8nwy3h2n00s1dw1g5bnvj7j40000gn/T/codex-clipboard-cb54dbfb-221e-4ced-8809-ccd1c468efcd.png`，目标是为指南提供真实下载入口。
- implementation：`http://127.0.0.1:5173/#/guides/maturity-model-usage`；应用内浏览器实际视口 `1280×720`，未启动系统 Chrome。
- after evidence：`/private/tmp/sapd-maturity-guide-download-after-20260716.png`。
- focused comparison：`/private/tmp/sapd-maturity-guide-download-reference-vs-after-20260716.png`；上方为用户截图，下方为最终实现。

## Findings

无剩余 Web P0 / P1 / P2 设计阻塞。

- 入口所有权：唯一“下载指南”位于 AppShell 页面标题栏右侧，不占用指南目录和 iframe 正文，不与章节动作混排。
- 文件语义：链接直接指向权威自包含 HTML，下载名为 `SAPD-成熟度模型使用指南-v1.2.html`；正文图片已内嵌，当前无正式 PDF，因此未伪造 PDF 或导出临时页面状态。
- 视觉：按钮复用 Apple Shell `30px` 控件高度、发丝边框、共享圆角和键盘焦点；与标题、说明、文档类型标签保持清晰的主次关系。
- 运行态：应用内浏览器确认按钮可见且唯一，`href / download / data-guide-download / aria-label` 完整；下载媒体命令通过，页面仍停留原路由，隔离 iframe 保持 `1` 个。
- 几何与稳定性：按钮为 `70×30px`；`1280×720` 与窄屏 `390×844` 均保持可见，页面横向溢出 `0`，console warning / error `0`；指南正文和目录未发生视觉回归。

## Comparison History

1. 用户截图中的页头右侧为空，没有指南下载入口。
2. 初版沿用通用 `.page-header-actions` 后，旧 `1500px` 响应式规则会在当前 `1280px` 视口隐藏操作。
3. 最终把指南操作声明为独立 `guide-header-actions`，只恢复该页面级动作可见性，不放开其他页头操作；视觉对照和真实下载命令均通过。

## Open Questions

无 Web 设计阻塞。macOS DMG App 的 WKWebView 下载落盘行为未在本轮重打包验证，进入下一次发布矩阵。

final result: passed

---

# 成熟度第二十二轮反馈层、目标强调与摘要顺序 Design QA（2026-07-16）

- visual truth：用户提供的冲突提示重叠、L2 层级统计和 L2 摘要三张真实工程截图。
- implementation：`http://127.0.0.1:5173/#/workbench/maturity/demo-project-001`。
- viewport：应用内浏览器 `1440 × 1024`、宽屏栅格检查和 `820 × 1024`；未启动系统 Chrome。

## Findings

无剩余 P0 / P1 / P2 设计问题。

- 冲突反馈：短时 toast 为 `346 × 40px`，位于 `y=116—156px`；底部主按钮位于 `y=970—1004px`，几何相交为 `false`，页面级横向溢出为 `0`。目标设置区仍保留归属当前评分点的行内冲突说明。
- 受控数据：“某集团网络安全成熟度评估”的 API 和评分检查页均显示恰好 `3` 个目标冲突；评分检查仅出现 `I-HD / I-NT / I-PE` 三个冲突评估点。
- 层级统计：L0、L1、L2 的目标等级均为低彩度金棕强调；最终目标卡片为横向 `目标等级 / L4 量化控制`，等级值 `18px / 840`、`white-space: nowrap`。L0 / L1 / L2 的左侧显式对象、层级面板和雷达 `data-hierarchy-id` 一致。
- L2 摘要：宽容器从左到右为当前成熟度、目标成熟度、评估维度均值、评估点情况；评估点情况与维度均值共享标题—子项—数值语法，只显示 `适用性 13 / 14` 与 `评估进度 8 / 13`。中等容器按相同阅读顺序回流，不改变数据口径。
- 响应式：`820 × 1024` 下目标卡片完整可见、等级名称不断字，页面 `scrollWidth = clientWidth = 820`。
- 字段边界：主区 `sheet / row / column / raw_value / source_file / import_id / source_id / source_ref / source_label / debug / raw / metadata / intermediate / generated_at` 命中 `0`；应用内浏览器 console error 为 `0`。

## Comparison Evidence

- 冲突提示：`/private/tmp/sapd-maturity-round22-toast-comparison.png`。
- 层级目标：`/private/tmp/sapd-maturity-round22-hierarchy-target-comparison.png`。
- L2 摘要：`/private/tmp/sapd-maturity-round22-summary-comparison.png`。
- 窄屏：`/private/tmp/sapd-maturity-round22-narrow.png`。

final result: passed

---

# 能力目录双按钮操作条 Design QA（2026-07-16）

- source visual truth：用户最终裁定截图 `/var/folders/81/8nwy3h2n00s1dw1g5bnvj7j40000gn/T/codex-clipboard-b418de11-e5b9-4288-8c30-02a47721722d.png`。
- implementation：`http://127.0.0.1:5173/#/knowledge/capabilities`；应用内浏览器实际视口 `1280×720`，未启动系统 Chrome。
- after evidence：`/private/tmp/sapd-capability-toolbar-v5-after-1280x720.jpg`。
- focused comparison：`/private/tmp/sapd-capability-toolbar-v5-reference-vs-after.png`；上方为用户反馈状态，下方为最终实现。

## Findings

无剩余 Web P0 / P1 / P2 设计阻塞。

- 内容：能力目录操作条只有“全部展开 / 收起到 L0”两个直接子按钮；“目录层级”“默认全部收起”说明与“定位最近”均为 `0`。
- 容器：操作条计算样式为 `border-top-width: 0px`、`background: transparent`、`padding: 0px`、`min-height: auto`，只保留 `30px` 按钮行并右对齐，不再形成额外卡片外框或空白说明区。
- 交互：实际点击“全部展开”后可见表格行由 `3` 增至 `136`，点击“收起到 L0”后恢复 `3`；默认收起和搜索祖先路径展开契约保持不变。
- 版式：聚焦前后对照确认第三按钮、说明和工具栏外框均已移除；表格直接承接操作条，页面横向溢出为 `0`。
- 稳定性：运行态工具栏动作严格为 `2`，控制台日志 `0`；未引入新颜色、图标、资产或交互模式。

## Comparison History

1. 初始状态包含两个层级动作、一个最近定位动作和独立外框容器。
2. 第一轮删除最近定位动作及其状态，但仍保留目录说明与外框。
3. 用户最终裁定后，说明文字与容器视觉全部删除，只保留两个业务动作；同画布对照与运行态交互复验通过。

final result: passed

---

# 成熟度正式门禁、纵向雷达与项目内搜索 Design QA（2026-07-16）

- source visual truth：结果首排反例 `/var/folders/81/8nwy3h2n00s1dw1g5bnvj7j40000gn/T/codex-clipboard-cc72fb86-6f1f-48ef-b881-1ea693ceec27.png`，全能力雷达粗线反例 `/var/folders/81/8nwy3h2n00s1dw1g5bnvj7j40000gn/T/codex-clipboard-1b3d91fe-178b-44f3-84fe-fecff967d0cd.png`，用户文字裁定为正式目标。
- implementation：`http://127.0.0.1:5173/#/workbench/maturity/demo-project-001`；正式结果视觉使用只读历史项目 `demo-project-002`，评分门禁与搜索使用固定项目 `demo-project-001`。
- viewport：应用内浏览器桌面 `1440 × 1024`，窄屏 `820 × 1024`；未启动系统 Chrome。
- implementation screenshots：`/private/tmp/sapd-maturity-round21-desktop-score.png`、`/private/tmp/sapd-maturity-round21-review.png`、`/private/tmp/sapd-maturity-round21-formal-result-desktop.png`、`/private/tmp/sapd-maturity-round21-formal-result-lower-radar.png`、`/private/tmp/sapd-maturity-round21-formal-result-narrow.png`、`/private/tmp/sapd-maturity-round21-score-narrow.png`。
- full-view comparison evidence：`/private/tmp/sapd-maturity-round21-radar-comparison.png`；上方为用户粗分割线反例，下方为浏览器正式结果的全能力雷达和原右侧分层统计。
- focused comparison evidence：`/private/tmp/sapd-maturity-round21-metrics-comparison.png`；上方为用户旧首排，下方为最终当前 / 目标 / 适用性 / 进度 / 分层评价首排。
- state：正在评分项目包含未完成项和目标冲突；历史锁定项目输出完整正式结果。

## Findings

无剩余 Web P0 / P1 / P2 设计阻塞。

- 字体与信息层级：结果主结论、当前 / 目标值、双分母和分层评价保持可扫描的三级层级；删除“成熟度差距 / 目标达成率”，没有用解释性标题重复页面内容。评分 Rubric 与目标冲突提示可完整换行。
- 间距与布局：结果首排为五组可行动口径；同一 Vibrancy 总区内四维雷达在上、全能力雷达在下，下方右侧继续承载 T / G / M、L1 与结果评价。评分页项目步骤与局部搜索共用 `52px` 行，桌面概览 sticky 且完整，窄屏概览回到自然文档流。
- 色彩与视觉令牌：当前结果为蓝、目标为金棕；T / G / M 使用 `rgba(47,120,196,.16)`、`rgba(116,103,184,.16)`、`rgba(79,138,114,.16)` 低彩度底色。旧粗辐射线删除，材质继续使用共享 `sapd-stat-vibrancy`。
- 图表与资产：Canvas 雷达直接读取后端结果；未评分留空，总体目标仅作等轴参考。没有新增或伪造 logo、插画、图标、图片资产或 CSS 图形替代物。
- 文案与业务内容：评分检查四统计为已完成、未完成、不适用、无证据（信息），已完成行隐藏；每个问题行都有“返回评分”。不完整项目结果页只显示门禁说明，不泄露成熟度、雷达、热力表或优先级。
- 核心交互：局部搜索真实命中 `L2 T-AS.AD` 和 `安全技术服务 I-AP&T-AS.AD-01`，选择后清空查询并按显式对象 ID 跳转。把完整评分点目标从 L4 临时改为 L1 后，后端返回 `当前 L4 3.75 / 最低 L4`，跨评分点切换被阻止；恢复 L4 后可继续导航。演示值已恢复。
- 历史兼容：浏览器回归发现 `statisticsReady` 上线前的已完成快照被误挡。修复后只对 `completed / reported / archived` 锁定状态保留后端历史结论；正在评分项目仍必须显式满足 `statisticsReady=true`。
- 响应式与稳定性：`1440 × 1024` 与 `820 × 1024` 的 `document.scrollWidth === clientWidth`；结果、评分和检查状态 console error 均为 `0`，主展示禁显字段命中 `0`。

## Comparison History

1. 用户反例：结果首排包含无行动价值的差距与达成率；全能力雷达使用突兀粗线；双雷达与分层统计关系不符合上下结构；评分检查仍可能泄露半成品统计。
2. 首轮实现：完成首排重排、正式门禁、纵向雷达、T / G / M 底色、检查清单和局部搜索。应用内浏览器发现旧正式快照缺少新字段，被错误阻断为 P1 兼容回归。
3. 修复：在评分后端仅对活动评分状态执行新目标下限；字段上线前已锁定且后端摘要明确完整的正式快照继续可读。重新加载后正式结果恢复，活动评分项目仍有 `64` 个未完成 / 无效项并保持结果门禁。
4. 最终对照：两张同画布比较确认首排语义、上下雷达关系、低彩度分组和原右侧分层统计均符合裁定；桌面与窄屏无剩余 P0 / P1 / P2。

## Primary Interaction Verification

- 评分检查：“完成评估”禁用；已完成行不在问题表中；未完成 / 目标冲突 / 不适用行可逐条返回评分。
- 正式结果：历史完成项目显示 `L3 2.82`、适用性 `182 / 185`、评估进度 `182 / 182`、四维雷达、32 项全能力雷达和右侧分层统计。
- 项目内搜索：只覆盖 L0 / L1 / L2 / 关注点 / 安全技术服务，未读取 DOM 文本或跨项目对象。
- 控制台、横向溢出与字段边界：全部通过。

## Open Questions

无 Web 设计阻塞。macOS DMG App 本轮未重建、未回归；共享前端和正式快照兼容需进入下一次 DMG 发布矩阵。

## Implementation Checklist

- [x] 正式结果门禁与目标下限使用后端契约。
- [x] 历史锁定快照兼容不放宽活动评分门禁。
- [x] 结果首排删除差距 / 达成率并前置分层评价。
- [x] 四维在上、全能力与原分层统计在下。
- [x] 评分检查只列问题与不适用核对项。
- [x] 项目内五类对象搜索与显式 ID 跳转。
- [x] 桌面 / 窄屏、console、溢出、字段边界和自动审计。

final result: passed

---

# 成熟度结果信息架构、评分检查与共享滚动 Design QA（2026-07-16）

- source visual truth：用户本轮结果雷达反例 `/var/folders/81/8nwy3h2n00s1dw1g5bnvj7j40000gn/T/codex-clipboard-1b3d91fe-178b-44f3-84fe-fecff967d0cd.png`，评分摘要与概览反例 `/var/folders/81/8nwy3h2n00s1dw1g5bnvj7j40000gn/T/codex-clipboard-170cc3f7-aa49-4746-a65d-67b182a733d0.png`，用户文字裁定为本轮设计目标。
- implementation：`http://127.0.0.1:5173/#/workbench/maturity/demo-project-001`。
- implementation screenshots：`/private/tmp/sapd-maturity-round20-result-1440x1024.png`、`/private/tmp/sapd-maturity-round20-score-1440x1024.png`。
- viewport：应用内浏览器桌面 `1440 × 1024`，响应式补测 `640 × 800`；未启动系统 Chrome。
- state：客户结果页；评分执行选中 `T-AS.AD` 与 `T-AS.AD-01`；评分检查包含真实阻塞项。

## Findings

无剩余 P0 / P1 / P2 设计问题。

- 字体与信息层级：结果首屏用 `28px` 结论、`24px` 当前 / 目标主值和 `20px` 统计值形成清晰层级；评分摘要中适用性、进度、四维均值、当前与目标均可单行扫描。小型图例维持次级层级，没有覆盖核心数据。
- 间距与布局：结果统计带先于图表；桌面四维雷达与全能力雷达为 `411px / 730px` 同区双列，窄屏转为单列；评分执行恢复项目级共享滚动，右侧概览 sticky 后完整位于 `260—650px` 视口范围。
- 色彩与材质：当前结果使用冷蓝、目标使用金棕；T / G / M 以低彩度蓝、紫、绿底色区分，删除粗分割线。统计面使用共享 `sapd-stat-vibrancy`，普通表单和表格保持实体表面。
- 图像与图表：本轮没有外部图像资产、logo 或插画替换。两张 Canvas 雷达都读取后端结果；未评分不补 `0`，总体目标只作等轴参考。
- 文案与内容：删除重复试算警告、`待复核 / 已确认` 和逐项确认；检查页只保留“阻塞 / 已完成 / 不适用”和有业务后果的“完成评估”。适用性为 `applicable / total`，评估进度为 `completed / applicable`。
- 响应式：`1440 × 1024` 和 `640 × 800` 的页面级横向溢出均为 `0`；窄屏统计带为两列、雷达和四维 Top 10 为单列，概览回到自然文档流。

## Full-view Comparison Evidence

- 结果：`/private/tmp/sapd-maturity-round20-result-comparison.png`，左侧为用户反例，右侧为同一结果域的浏览器实现。可见粗分割线被低彩度区域替代，结果统计先于双雷达，当前 / 目标 / 差距 / 范围口径合并为一排。
- 评分：`/private/tmp/sapd-maturity-round20-score-comparison.png`，上方为用户反例，下方为浏览器实现。可见 L2 摘要改为适用性 `13 / 14`、评估进度 `11 / 13`，概览在共享滚动容器中保持完整。

## Focused Comparison Evidence

- 结果统计带和雷达同区在 full-view 中已能清晰读取，不再另做裁切；DOM 进一步确认桌面双列为 `410.758px 730.242px`，窄屏为单列 `511px`。
- 评分滚动通过返回阻塞项后的实际位置验证：`.maturity-v1-project-page.scrollTop = 891.5`，评分维度 `overflow-y: visible`，概览 `position: sticky` 且下边界 `649.5px < 1024px`。

## Comparison History

1. 用户反例显示：粗分组线穿过全能力雷达、结果数据分散；评分摘要把适用与完成口径混在一起，概览的固定语义被误实现为隔离评分滚动。
2. 第一轮实现把结果统计、双雷达和优先级视图合并，但应用内浏览器验证发现阻塞返回仍尝试滚动已经 `overflow: visible` 的评分列。
3. 修复 `scheduleScoringLanding`：仅当评分列实际可滚动时使用局部滚动，否则回退到 `.maturity-v1-project-page` 共享滚动；重新点击逐条“返回评分”后 `scrollTop` 正确变化，概览保持完整。
4. 最终桌面与窄屏对照无剩余 P0 / P1 / P2；四维 Top 10 只做后端维度分数升序，并复用后端总体优先级，没有新增前端阈值。

## Primary Interaction Verification

- 评分检查：界面中 `待复核` 与 `已确认` 命中 `0`，逐条“返回评分”共 `22` 个，“完成评估”共 `1` 个。
- 阻塞定位：点击首个“返回评分”后回到评分执行，项目共享滚动变为 `891.5`，评分概览仍完整可见。
- 统计口径：总体适用性 `175 / 185`、评估进度 `154 / 175`；选中 L2 适用性 `13 / 14`、评估进度 `11 / 13`。
- 结果视图：无试算警告；四维与全能力雷达同区；四个维度 Top 10 与 L2 优先级列均存在。
- 控制台与门禁：应用内浏览器交互未出现页面错误，最终以成熟度 HTTP smoke 和静态契约审计补充确认。

## Open Questions

无 Web 设计阻塞。macOS DMG App 本轮未重建、未回归；共享前端需在下一次 DMG 发布矩阵补 App 证据，5173 通过不替代 DMG 验收。

## Implementation Checklist

- [x] 结果统计带先于图表并删除重复警告。
- [x] 四维与全能力雷达同区，T / G / M 使用低彩度底色。
- [x] 成熟度与证据分布移入结果评价。
- [x] L2 优先级列与四维 Top 10 只使用后端字段。
- [x] 删除装饰性逐项确认，阻塞项逐条返回评分。
- [x] 评分共享滚动、sticky 概览与双分母口径。
- [x] 桌面、窄屏、自动审计和字段边界检查。

## Follow-up Polish

无阻断性设计项。若后端未来提供逐维目标与逐维优先级，再单独扩展四维 Top 10 的业务含义；当前前端不得预设。

final result: passed

---

# 首页标题所有权与指定内容替换 Design QA（2026-07-16）

- source visual truth：用户指定内容截图 `/var/folders/81/8nwy3h2n00s1dw1g5bnvj7j40000gn/T/codex-clipboard-9c962439-9f1a-468f-885c-17c83c638b14.png`；待替换旧标题截图 `/var/folders/81/8nwy3h2n00s1dw1g5bnvj7j40000gn/T/codex-clipboard-a846d09f-a046-4598-bb62-e0b14eb203ae.png`。
- implementation：`http://127.0.0.1:5173/#/`；应用内浏览器实际视口 `1280×720`，未启动系统 Chrome。
- full-view evidence：修改前 `/private/tmp/sapd-header-v3-design-qa-before.png`，修改后稳定态 `/private/tmp/sapd-header-v3-design-qa-after-stable.png`，同视口并排 `/private/tmp/sapd-header-v3-before-after-stable.png`。
- focused comparison evidence：指定内容与实现标题区同画布 `/private/tmp/sapd-header-v3-target-vs-implementation.png`。参考图是 Dashboard 正文标题，最终实现按用户“替换图 3 内容”的要求沿用 AppShell 紧凑标题几何，只匹配内容与信息层级，不复制正文大标题尺寸。

## Findings

无剩余 Web P0 / P1 / P2 设计阻塞。

- 字体与文案：AppShell 唯一标题区显示 `SAPD WIKI / 工作台与知识库概览 / 继续本地工作，并按业务粒度查看能力、环境、生命周期、技术服务、标准、字典与指南内容。`；旧 `全局导航 / 应用壳` 标题内容已移除，侧栏导航入口名称仍保留。
- 间距与布局：标题区继续使用既有 `96px` 应用壳高度，正文直接进入“继续工作 / 知识库统计”两块业务面板；未复制参考图的大幅正文标题，从而消除双标题和额外纵向占用。
- 色彩与令牌：沿用既有 Apple Shell 冷色中性背景、文字和分隔线，仅给 `SAPD WIKI` 使用现有 P2 蓝色 kicker；未引入新色板、渐变或装饰素材。
- 图片与资产：目标只包含界面文字和既有壳层，没有需要生成或替换的图像资产。
- 内容与交互：标题文本出现次数为 `1`，`.dashboard-p2-heading` 为 `0`，Dashboard 两个业务面板仍正常呈现；页面横向溢出 `0`，console error `0`。

## Comparison History

1. 初始状态：AppShell 显示旧“全局导航 / 应用壳”，Dashboard 正文另有“工作台与知识库概览”，首页存在两个标题所有者。
2. 实现：根路由增加显式 PageHeader 元数据，并从 P2 Dashboard 正文移除重复标题与重复运行状态。
3. 最终对照：同视口并排与聚焦对照确认指定三段内容已进入唯一 AppShell 标题区，页面结构与 Dashboard 统计无回归。

final result: passed

---

# 成熟度评估复核闭环、结果首屏与评分锁定 Design QA（2026-07-16）

- visual truth：用户本轮复核、L2 汇总、评分毛玻璃、下级文字、均值与 Rubric 六张截图。
- implementation：`http://127.0.0.1:5173/#/workbench/maturity/demo-project-001`。
- viewport：应用内浏览器 `1440 × 1024`，响应式复验 `760 × 900`；未启动系统 Chrome。
- combined comparison：`/private/tmp/sapd-maturity-round19-design-qa-combined.png`，左列为用户参考，右列为复核、评分执行和评估结果运行实现。

## 验证结论

无剩余 Web P0 / P1 / P2 设计阻塞。

- 复核语义：`待复核` 明确为评分完整但尚未显式确认，`已确认` 明确为已执行确认；每个完整项有“查看评分 / 确认”，阻塞项有“去调整”。
- 精确跳转：点击“阻塞项 21”进入 `I-AP&T-AS.AD-01`，活动元素属于首个缺失的 `data` 维度，评分列滚动到该行；没有用首行或旧对象替代当前评分点。
- 复核几何：1440 桌面复核表内部横向溢出为 `0`，状态 / 操作列右边界为 `1391px`，按钮完整可见。
- 结果顺序：客户结果 DOM 顺序固定为视图切换、试算提示、全能力分组雷达、总体结论、四维结果；全能力雷达先于总体结论。
- 分组与优先级：T / G / M 组间粗线可见；T / G / M 与 L1 共 `13` 个优先级统计块，只展示后端 `gapItems[].priority` 的高 / 中 / 低计数。
- 评分锁定：四维评分列可滚动 `673px`；滚动到 `420px` 前后 L2 汇总、关注点、服务 Tab、评分表头和右侧概览坐标不变，概览内部溢出为 `0`。
- L2 口径：`T-AS.AD` 显示适用 / 全部 `13 / 14`，完成适用项 `11 / 13`；顺序为评估进度、评估维度均值、当前成熟度、目标成熟度。
- 对象粒度：L0 雷达为 `category:*`、L1 为 `domain:*`、L2 主雷达与下级雷达均为同一 `capability:*`；关注点评分时不残留层级雷达。
- 响应式与字段边界：`1440 × 1024` 和 `760 × 900` 页面横向溢出均为 `0`；主区禁显字段命中 `0`；应用内浏览器控制台日志为空。

## Evidence

- 评分执行：`/private/tmp/sapd-maturity-round19-after-scoring-1440x1024.jpg`。
- 评分复核：`/private/tmp/sapd-maturity-round19-after-review-1440x1024.jpg`。
- 评估结果：`/private/tmp/sapd-maturity-round19-after-results-1440x1024.jpg`。
- 窄屏结果：`/private/tmp/sapd-maturity-round19-after-results-760x900.jpg`。

## Open Questions

无 Web 设计阻塞。macOS DMG App 本轮未重建、未回归；共享前端视觉进入下一次 DMG 发布矩阵。

final result: passed

---

# P2 Dashboard、目录折叠与成熟度指南 Design QA（2026-07-16）

- source visual truth：用户目录空白截图 `/var/folders/81/8nwy3h2n00s1dw1g5bnvj7j40000gn/T/codex-clipboard-71d8e86e-14da-4c27-848c-d47752fba89f.png`，成熟度指南密度截图 `/var/folders/81/8nwy3h2n00s1dw1g5bnvj7j40000gn/T/codex-clipboard-e7bdec31-2a1f-46ec-8d39-fa5ded0b11e6.png`。
- implementation：`http://127.0.0.1:5173/#/`、`#/knowledge/capabilities`、`#/guides/maturity-model-usage`；应用内浏览器 `2048×1024`，未启动系统 Chrome。
- after evidence：`/private/tmp/sapd-p2-v2-design-qa/04-after-dashboard.png`、`05-after-ability-directory.png`、`06-after-maturity-guide.png`。
- comparison evidence：`/private/tmp/sapd-p2-v2-design-qa/07-compare-ability.png`、`08-compare-dashboard.png`、`09-compare-guide.png`；每张均为同视口左侧修改前、右侧修改后。

## Findings

无剩余 Web P0 / P1 / P2 设计阻塞。

- 目录空白：根因是 `.source-local-search-body` 的隐式 Grid 行把工具栏拉伸到约 `503px`。修复后 Grid 行为 `60px / 684px / 0px`，工具栏为 `52px` 且 `position: static`，表格滚动区为 `684px`，截图中的无效空白归零。
- 默认折叠：应用内浏览器逐页核对能力目录 `45` 个、技术服务 `9` 个、技术模块 `38` 个、工作职能 `15` 个、等级保护标准 `36` 个可折叠节点，首次进入展开数均为 `0`；平面字典表保持可见，不伪造折叠。
- Dashboard：有效内容宽度由约 `1240px` 扩至 `1560px`，基础统计 `6` 项、业务统计带 `3` 组；运行值为环境 `10`、对象 `51`、作用域类型 `6`、LC-AP `8`、LC-DT `7`、指南 `5`、幻灯片类 `3`、建模语言 `1`、图示视图 `1`。各粒度独立呈现，没有跨粒度求和或恢复达成率。
- 指南：目录为 `244px`，按钮 `44px / 14px`；iframe 正文为 `17px / 28.9px`，阅读列 `1120px`，封面 `194px`。页面与 iframe 横向溢出均为 `0`。
- 色彩与层级：Apple 亮色壳保持冷色中性背景；颜色只加强统计表面，以蓝、青、琥珀和紫区分业务域，不使用渐变文字、装饰玻璃或无意义大数字英雄区。
- 字段边界：主展示区未新增 `sheet / row / column / raw_value / source_file / import_id / source_id / source_ref / source_label / debug / raw / metadata / intermediate / generated_at`。

## Comparison History

1. 初始状态：能力目录工具栏被拉伸；Dashboard 内容窄、色彩弱且缺环境 / 生命周期 / 内容类型；成熟度目录与正文过小。
2. 第一轮实现：修复 Grid 行所有权，建立轻量统计摘要，扩大指南阅读画布，并把所有可折叠字典 / 标准统一为默认收起。
3. 最终对照：三组同视口并排图确认空白、密度和色彩问题已消除；自动审计与运行态计算样式一致。

final result: passed

---

# 成熟度下一项落点、关注点双统计与文字几何 Design QA（2026-07-16）

- source visual truth：用户本轮四张复验截图，分别为 `/var/folders/81/8nwy3h2n00s1dw1g5bnvj7j40000gn/T/codex-clipboard-246cb905-5d35-4842-aa7a-a8d0654ce259.png`、`/var/folders/81/8nwy3h2n00s1dw1g5bnvj7j40000gn/T/codex-clipboard-e6ea2b62-6d82-4c30-95b7-700cbdf98534.png`、`/var/folders/81/8nwy3h2n00s1dw1g5bnvj7j40000gn/T/codex-clipboard-9e5c266c-2171-495b-b755-29dcb89051df.png`、`/var/folders/81/8nwy3h2n00s1dw1g5bnvj7j40000gn/T/codex-clipboard-d8c30575-29ee-4ef7-8111-1c850708654e.png`。
- implementation：`http://127.0.0.1:5173/#/workbench/maturity/demo-project-001`；只使用应用内浏览器，覆盖 `1440×1024`、参考图同尺寸 `2458×1280` 和窄屏 `640×800`，未启动系统 Chrome。
- implementation evidence：`/private/tmp/sapd-maturity-round18-desktop-1440x1024.png`、`/private/tmp/sapd-maturity-round18-comparison-2458x1280.png`、`/private/tmp/sapd-maturity-round18-narrow-640x800.png`。
- comparison evidence：参考图与同尺寸实现并排为 `/private/tmp/sapd-maturity-round18-reference-implementation.png`。

## Findings

- 下一项落点：真实点击“保存并转到下一项”后，score item ID 发生变化；`1440×1024` 下 sticky header 底边为 `252px`，下一项“组织与角色”行顶边为 `264.07px`，恰好保留约 `12px` 间距。活动元素为该行 `radio`，没有停在旧按钮或表单中部。
- 双统计：真实关注点 `T-AS.AD-01` 有六个下级，其中五个适用、一个不适用，当前两个适用项尚未满足完成条件，因此页面如实显示“完成 `4/6`、适用性 `5/6`”。同一公式在五个适用项全部完成时显示用户要求的“完成 `6/6`、适用性 `5/6`”；不适用项只计入已处理数，不进入评分或聚合分母。
- 适用性所有权：控件位于关注点标题容器内并靠标题末端；真实计算样式为 checkbox `20×20px`、标签 `13px`，部分适用明确显示文字状态。服务 Tab 的逐项适用性仍独立保留。
- 数字几何：L2 评估完成值使用 `white-space: nowrap` 和 tabular 数字；实测 `11 / 13` 的标题与主值上下分离，未换行或叠压。该规则同样覆盖用户截图中的 `14 / 14`。
- Rubric 行长：桌面最大宽度固定为 `760px` 并与五档矩阵左边界对齐；真实较窄工作区按可用列宽收缩，窄容器恢复 `100%`，对象定义完整换行且不进入浮层。
- 粒度与响应式：L0 `T`、L1 `T-AS`、L2 `T-AS.AD` 三次显式选择中，左侧 selected ID、四维雷达和下级雷达 `data-hierarchy-id / level` 全部一致；关注点标题与左侧选中对象一致。`1440 / 2458 / 640px` 页面级横向溢出均为 `0`，主展示禁显字段命中 `0`，console error `0`。

## Comparison History

1. 用户复验指出旧实现只迁移焦点、合并统计分母、让适用性脱离标题，并允许计数和 Rubric 形成不稳定文字几何。
2. 实现改为基于真实滚动 owner 与 sticky header 几何定位；关注点标题承载适用性；完成与适用性分别使用 `resolved / total`、`applicable / total`；计数禁止换行，Rubric 控制最大行长。
3. 参考图和 `2458×1280` 实现已在同一 comparison 画布复核；未发现剩余 P0 / P1 / P2 设计问题。

final result: passed

---

# 成熟度连续评分、复核摘要与分层统计 Design QA（2026-07-16）

- source visual truth：用户八张问题截图，重点为 `/var/folders/81/8nwy3h2n00s1dw1g5bnvj7j40000gn/T/codex-clipboard-a1bbb34f-7f28-426d-a524-c9dfda62e2d1.png`（关注点摘要）、`/var/folders/81/8nwy3h2n00s1dw1g5bnvj7j40000gn/T/codex-clipboard-f3dcbae7-398b-4264-9506-3e64b4c11b7b.png`（层级完成度）和 `/var/folders/81/8nwy3h2n00s1dw1g5bnvj7j40000gn/T/codex-clipboard-c4df68ad-b671-4f01-9feb-a38f09d69209.png`（分层统计裁切）。
- implementation：`http://127.0.0.1:5173/#/workbench/maturity/demo-project-001`；应用内浏览器 `1440×1024` 与 `640×800`，未启动系统 Chrome。
- full-view evidence：`/private/tmp/sapd-maturity-round17-scoring-1440x1024.png`、`/private/tmp/sapd-maturity-round17-review-1440x1024.png`、`/private/tmp/sapd-maturity-round17-results-1440x1024.png`、`/private/tmp/sapd-maturity-round17-scoring-640x800.png`。
- comparison evidence：全画布 `/private/tmp/sapd-maturity-round17-qa-comparison.png`；统计缺陷与修复后局部对照 `/private/tmp/sapd-maturity-round17-qa-focused.png`。
- states tested：评分关注点 `T-AD.SA-02`、层级 L0 `T` / L1 `T-AD` / L2 `T-AD.IR`、复核 `T-AS.AD-01`、结果页全能力雷达与 T / G / M 分层统计。

## Findings

- 字体与文案：关注点定义完整显示；删除“当前关注点”“当前 L2 · 下级汇总”“评分标准”等重复标签；Rubric 直接显示 `L1 非正式执行` 等等级名，定义字号、行高与对比度提升；未新增图片或图标资产。
- 间距与布局：评估概览固定展开，目标等级与等级名横向强化；目标设置收敛为目标选择 + 单一可选说明；保存并转到下一项后，显式进入下一关注点并聚焦首个“组织与角色”评分格。
- 完成语义：关注点头部统一为“适用性”，以 `评估完成 5 / 6` 为主表达；层级比较行显示后端 `completed / applicable` 计数，并把百分比降为辅助信息。用户截图中的 `83%` 即 `5 / 6`，不是该关注点已全部完成。
- 复核：没有复制一套可编辑评分表；展开项使用只读对象摘要、目标与说明、四个维度当前等级及对象 Rubric。实测可编辑字段数量为 `0`，保留“返回评分执行”修订入口。
- 分层统计：统计表面使用与背景有明确分离的 Vibrancy（`blur(28px) saturate(1.2) brightness(1.03)`、半透明填充和细边框）；全能力雷达与 T / G / M 分层统计完整显示，L1 行数 `10`，不再由固定高度裁切。
- 响应式：`1440×1024` 三列层级分析保持横向；`640×800` 顺序堆叠。两种视口的页面级横向溢出均为 `0`；复核表在窄屏仅由自身滚动，不把溢出传到页面。
- 数据与粒度：L0 / L1 / L2 显式选择后，左侧选中对象、右侧标题和 `data-hierarchy-id` 一致；第二雷达标题分别为“下属能力域雷达图 / 归属能力雷达图 / 归属关注点雷达图”。四维雷达仍只读同粒度后端 `dimensionResults`，未评分下级留空。
- 交互与运行：保存后焦点为 `organization` 的当前 `radio`；概览 DOM 为常驻 `SECTION`；应用内浏览器 console error 为 `0`。无剩余 P0 / P1 / P2 设计问题。

## Comparison History

1. 初始问题：上下文标签重复、长定义被截断、完成率百分比缺乏分母、目标区和复核区结构松散、统计卡裁切且玻璃层次弱。
2. 首轮实现：收敛标签与表单字段，固定概览，保存后迁移对象与焦点；复核改为只读同构摘要；统计区取消内部裁切并强化材质。
3. 修复后证据：桌面与窄屏全局溢出 `0`，复核可编辑字段 `0`，分层 L1 行 `10` 全部可见，L0 / L1 / L2 对象与雷达 ID 全部一致。

final result: passed

---

# OI-196 Issue 范围唯一入口 Design QA（2026-07-15）

- source visual truth：用户截图 `/var/folders/81/8nwy3h2n00s1dw1g5bnvj7j40000gn/T/codex-clipboard-aa74f50a-1ae8-4063-8762-b715b1ae5b37.png`，该截图中的顶部“Issue 范围”下拉是明确要求删除的冗余入口。
- implementation：`http://127.0.0.1:5173/#/workbench/annotations`；应用内浏览器 `1280×720`，左侧选中“安全能力映射”，顶部状态和优先级均为“全部”。
- full-view evidence：修改前 `/private/tmp/sapd-issue-scope-before-20260715.png`；修改后 `/private/tmp/sapd-issue-scope-after-20260715.png`。
- focused comparison evidence：用户截图与修改后工具栏同画布对照 `/private/tmp/sapd-issue-scope-reference-vs-after-20260715.png`。聚焦区域已足以判断控件删除和工具栏回收，不需要额外字体细节裁切。

## Findings

- 修改前同时存在顶部范围下拉和左侧范围目录，属于同一页面范围的双入口；修改后顶部范围控件数量为 `0`，左侧范围目录数量为 `1`。
- 工具栏回收为“状态、优先级、完整局部搜索、清除筛选”；搜索宽度为 `440px`，页面横向溢出为 `0`，无空列或残留标签。
- 左侧选中 `/capability-mapping` 后，队列为 `12 / 40 条`；把状态改为“处理中”再执行“清除筛选”，状态恢复“全部”，左侧范围仍保持 `/capability-mapping`。范围所有权没有被清除按钮绕过。
- 字体、间距、颜色、图片资产和文案均沿用既有 Apple Shell；本轮没有新增视觉资产，也没有改变列表、搜索、导出或详情结构。无剩余 P0 / P1 / P2 设计问题。

## Comparison History

- 首轮问题：顶部范围下拉与左侧目录重复，且“清除筛选”会重置左侧目录范围。
- 修复：删除顶部下拉和范围状态 chip，工具栏从五列收敛为四列；清除筛选只清理状态、优先级和关键词，页面范围只由左侧目录修改。
- 修复后证据：`topScopeCount=0`、`leftScopeCount=1`、`activeRoute=/capability-mapping`、`htmlOverflow=0`、控制台 warning / error 为 `0`。

final result: passed

---

# 成熟度字体、单一评估说明与层级双雷达 Design QA（2026-07-15）

- visual truth：`/var/folders/81/8nwy3h2n00s1dw1g5bnvj7j40000gn/T/codex-clipboard-d47d8a74-cc4d-400e-83c6-761d9f64d979.png`、`/var/folders/81/8nwy3h2n00s1dw1g5bnvj7j40000gn/T/codex-clipboard-f43d383f-fa71-4bf2-9b91-258b95866076.png`。
- implementation：`http://127.0.0.1:5173/#/workbench/maturity/demo-project-001`；应用内浏览器 `1440 × 1024`，另覆盖 `640 × 800`，未启动系统 Chrome。
- comparison：`/private/tmp/maturity-v16-design-qa-comparison.png`；左列为用户截图，右列为真实运行实现。
- after evidence：`/private/tmp/maturity-v16-score-desktop-1440x1024.jpg`、`/private/tmp/maturity-v16-target-desktop-1440x1024.jpg`、`/private/tmp/maturity-v16-l0-desktop-final-1440x1024.jpg`、`/private/tmp/maturity-v16-l2-desktop-1440x1024.jpg`、`/private/tmp/maturity-v16-l2-narrow-640x800.jpg`。

## 对照结论

- 评分矩阵：四个维度均为五个稳定 `radio` 格，格内仅显示 `L1—L5`；实测维度名 `14px`、等级 `17px`、评分标准标题 `12px`、Rubric 正文 `14px`，等级名第二行已删除。
- Rubric 所有权：当前对象 Rubric 固定显示在本维度行内，不再依赖跨行浮层；真实点击组织与角色 `L5 → L4 → L5` 后，反馈准确切换并恢复。
- 目标区：目标等级与唯一“评估说明（可选）”同区排列；`targetReason` 文本框计数 `1`、`evidenceSummary` 文本框计数 `0`，说明为空不再阻塞完整评分。
- 评估概览：核心数字实测 `38px`，只保留综合得分、当前等级、目标等级和四维雷达；项目适用评估点、目标达成率、强项、待加强、维度得分明细均未出现。
- 层级统计：L0 / L1 / L2 的当前汇总、四维成熟度雷达和第二雷达在桌面同排；标题分别为“下属能力域雷达图 / 归属能力雷达图 / 归属关注点雷达图”。左侧选中对象、右侧标题、两张雷达的 `data-hierarchy-id` 与层级均一致。
- 第一轮视觉复核发现当前汇总列约 `220px` 时四维精确值挤压；最终调整为 `250px / 260px / 300px` 三列下限，并将汇总内四维值改为单列纵排。最终桌面无文字重叠，`640px` 下三块顺序堆叠。
- 结果页：同时存在后端总体 `dimensionResults` 驱动的四维雷达和 32 项 L2 能力分组雷达；未评分能力不按 `0` 补值。
- 响应式与运行：`1440 × 1024`、`640 × 800` 的页面级横向溢出均为 `0`；应用内浏览器日志为空。

## 开放项

无 Web 设计阻塞。macOS DMG App 本轮未重建、未回归；共享前端与完成条件变更在下一次 DMG 发布矩阵中补验收。

final result: passed

---

# 成熟度评估第十五轮方案 1 + 方案 2 Design QA（2026-07-15）

- visual truth（方案 1，评估执行）：`/Users/kim1st/.codex/generated_images/019f650d-d236-7b63-a3b4-2f1170f36f4b/exec-2769a36b-fc7a-462d-a406-7086ac5f22a1.png`
- visual truth（方案 2，评估概览）：`/Users/kim1st/.codex/generated_images/019f650d-d236-7b63-a3b4-2f1170f36f4b/exec-49acc140-1815-46fe-8bbc-bcb3212007e1.png`
- implementation：`http://127.0.0.1:5173/#/workbench/maturity/demo-project-001`
- implementation screenshot：`/private/tmp/maturity-v15-final-desktop-1440x1024.png`
- combined comparison：`/private/tmp/maturity-v15-design-qa-comparison.png`
- viewport / state：应用内浏览器 `1440×1024`，当前关注点 `T-AD.SA-02`；另验 `640×800` 窄屏。

## 对照与交互结论

- Full view：方案 1 的四行五档矩阵、行内当前 Rubric 和证据输入已落入左侧执行区；方案 2 的折叠 Vibrancy inspector 落入右侧，综合分、目标 / 完成度、四维雷达和强弱 / 极差完整保留，“维度得分明细”已删除。双栏在真实工作区宽度下为约 `574px / 290px`，没有参考图的大块空白。
- Focused view：将“平台与工具”从 L4 切换至 L3 后，当前 radio、行反馈和对象 Rubric 同步更新；恢复 L4 后其余三维选择不变。反馈槽只属于当前评分行，不跨行覆盖。
- 层级与结果：L0、L1、L2 的左侧选中 ID、右侧标题、当前四维雷达和直属下级雷达 ID / level 一致；结果页同时存在总体四维雷达和全部 L2 能力雷达。缺失项显示未评分，不补 `0 / L1`；总体目标明确为等轴参考，不代表逐维目标。
- 响应式：`1440×1024`、`1024px`、`800px` 和 `640×800` 页面级横向溢出均为 `0`；成熟度窄屏保持 icon rail + 可达主区，矩阵在单列内完整显示。
- 运行证据：console error `0`；主展示区禁显字段命中 `0`；`dataState=ready`。

## Comparison History

1. 视觉真值分别固定评估执行方案 1 和评估概览方案 2。
2. 首轮运行实现发现真实工作区宽度 `864px` 被旧 `920px` 断点过早堆叠，导致右侧大空白；断点收窄到 `790px` 后恢复双栏。
3. 窄屏进一步发现旧 App Shell 在 `860px` 以下仍按隐藏的宽侧栏堆叠主区；新增只作用于成熟度路由的 grid 修正后，`640px` 主区恢复可达。
4. 最终把两张视觉真值与同状态运行截图合成单张 comparison 复核，未发现剩余 P0 / P1 / P2 设计问题。

final result: passed

---

# 成熟度统计口径、层级聚合与评分密度 Design QA（2026-07-15）

- visual truth：真实页面结构以当前 5173 工程评分页为底板；用户图 2 `/var/folders/81/8nwy3h2n00s1dw1g5bnvj7j40000gn/T/codex-clipboard-712c7e7b-72fd-4c54-9c16-e80db47754a2.png` 是统计区读数层级、Vibrancy 和四维滑杆表达的视觉真值；图 3 / 图 5 分别是删除重复定义和滑杆端点的验收样例。
- implementation：`http://127.0.0.1:5173/#/workbench/maturity/demo-project-001`；应用内浏览器固定 `1600×1000`，同一会话核对关注点评分、已完成评估点及 L0 / L1 / L2 聚合。
- comparison evidence：参考图与最终真实页面在同一次视觉比较输入中并排检查；最终已完成评估点截图为 `/private/tmp/sapd-maturity-v13-complete-1600x1000.png`。
- geometry evidence：滑杆轨道 `290px`、thumb `34px`，range 覆盖完整胶囊；五个定位点各内收 `17px`，L1 / L5 thumb 中心与端点圆心一致；统计层 `backdrop-filter = blur(28px) saturate(1.2) brightness(1.03)`。

## Findings

- 统计卡已按参考图恢复“综合得分 + 成熟度 + 目标等级 + 完成 / 适用 + 四维值”的一体化层级；冷蓝灰半透明、28px 模糊和受控景深阴影只应用在统计表面，不扩散到表单、目录或 Draw.io。
- `目标达成率` 进度条绑定后端 `targetAchievementRate`。层级实测：L0 为 `83.4%`、L1 为 `83.3%`、L2 为 `99.7%`；`gapIndex` 只解释为“距目标尚差”，评分完成度独立呈现。
- L0 / L1 / L2 点击后分别展示 `categoryResults / subCategoryResults / capabilityResults` 的同粒度汇总和下级对象；实测右侧标题、当前 / 目标、完成率均与左侧选中层级一致。只有关注点进入可编辑评分。
- 四维评分行删除可见的重复等级名称和定义，只保留对应端点 Tip；保留四条隐藏 `aria-describedby` 定义。行高从重复双行收敛为维度、滑杆、依据三列，未压缩依据输入宽度。
- range 不再在胶囊内部二次内缩；L1 未评分端点和 L5 已评分端点截图均没有 thumb 外侧残留蓝色半圆。五个定位点仍常显，Tip 和 reduced-motion 契约保持。
- 对照后无剩余自动可判定的 P0 / P1 / P2 设计问题。

## Interaction Verification

| 验收项 | 结果 | 状态断言 |
|---|---|---|
| 真实工程结构 | 通过 | 项目头、六步导航、目录、关注点和服务 Tab 均保留 |
| L0 / L1 / L2 统计 | 通过 | `3.20 / 3.22 / 3.82`，分别显示 5 个 L1、9 个 L2、3 个关注点 |
| 统计口径 | 通过 | 目标达成率取后端值，差距和评分完成度分离；已完成评估点为 `4.50 / L5 / 100%` |
| 五档 Slider 与 Tip | 通过 | 五点常显、端点圆心一致、无重复静态定义、四条无障碍说明保留 |
| 右侧统计 | 通过 | 当前分 / 成熟度 / 目标 / 完成适用 / 四维统计同卡表达，使用共享 `28px` Vibrancy |
| 契约与数据边界 | 通过 | 成熟度 `134/134`、P0-1 / P0-2、完整 `static / frontend`、maturity smoke 均通过；主区禁显字段命中 `0` |

final result: passed

---

# OI-196 第三轮共享组件基线修正 Design QA（2026-07-15）

- visual truth：用户图 1 是全局 Apple Shell segmented Tab 权威，图 3 是完整页面局部搜索权威，图 5 是能力摘要参考图的全宽卡片与完整四边框权威；图 2 / 图 4 仅作为被拒绝的局部变体。
- implementation：`http://127.0.0.1:5173/`；代表路由 `#/environment-mapping`、`#/workbench/annotations`、`#/capability-mapping`。
- viewport：应用内浏览器固定 `1280×720`，未启动系统 Chrome。P0-2 自动契约另以 `1440×1024` 验证共享 Shell。
- comparison evidence：用户参考与最终能力摘要同画布对照 `/private/tmp/sapd-oi196-r4-capability-reference-vs-final.png`；最终截图 `/private/tmp/sapd-oi196-r4-environment-after-final.png`、`/private/tmp/sapd-oi196-r4-issues-after-final.png`、`/private/tmp/sapd-oi196-r4-capability-after-final.png`。

## Findings

- 根因：共享组件验收曾只检查 class、圆角或 `object-fit` 字符串，没有检查完整 DOM、几何是否随放置位置变化、箭头是否按业务对象工作，以及边框是否属于真实图片缩放盒；因此旧审计出现假通过。
- 全局 Tab：删除 `#appPageHeader` 对共享 segmented 的 `30/26px` 私有压缩；信息化环境实测外层 / 按钮 `42/34px`、圆角 `16/12px`、间距 `4px`，与图 1 相同。
- Issue 搜索：恢复输入、`1/N` 计数与前后箭头的完整 `.page-search-control`；默认宽 `404px`，无冗余“关键词”标题或空筛选胶囊。输入“安全”后实测 `1/33 → 2/33`，选中稳定 Issue ID 随之变化。
- 能力摘要：T 根能力改为全宽单区，覆盖结构不再抢占五象限图宽高；图片边框由真实 `<img>` 盒持有。`1280×720` 下由前一版约 `100×45px` 提升为 `455×202px`，四边均 `1px`，原图 `1116×492` 按比例 `contain`，figure 无内部滚动。
- 字段边界：未新增或展示 `sheet / row / column / raw_value / source_file / import_id / source_id / source_ref / source_label / debug / raw / metadata / intermediate / generated_at`。

## Interaction Verification

| 路径 | 自动 / 浏览器结果 | 用户复验预期 |
|---|---|---|
| 信息化环境双视图 | 通过；共享几何 `42/34px + 16/12px` | 与图 1 同一全局胶囊，选中项白色凸起 |
| Issue 清单搜索 | 通过；完整 DOM，稳定 Issue ID `1/33 → 2/33` | 与图 3 同一胶囊、计数和前后箭头 |
| 能力映射摘要 | 通过；`455×202px`、四边 `1px`、无内部滚动 | 五张下级卡片全宽，图完整、四边连续，随可用宽高缩放 |
| 页面溢出 | 三个代表页均为 `0` | 页面不出现横向滚动条 |

## Open Questions

- 应用内浏览器无法模拟用户所有显示器最大化尺寸；响应式合同与 `1440×1024` P0-2 已通过，真实 1440p / 4K 的最终可读尺寸需要用户在固定入口复验。
- 本轮属于 Web / App shared runtime；DMG App 未重打，WKWebView 视觉与下载路径仍在下次发布矩阵补证。

final result: Web QA passed；等待用户与后续 DMG 验收

---

# OI-196 第二轮用户复验修正 Design QA（2026-07-15）

- visual truth：以用户最新四项复验意见为准，重新对照能力摘要图、Issue 导出、信息化环境双视图和 Issue 搜索；不沿用上一轮已经被用户否决的“图内滚动 / 线型导航 / 仓库导出路径 / 私有搜索框”结论。
- implementation：`http://127.0.0.1:5173/`；代表路由 `#/capability-mapping`、`#/workbench/annotations`、`#/environment-mapping`。
- viewport：应用内浏览器固定视口 `1280×720`；未启动系统 Chrome。能力摘要图现在同时受可用宽度和可用高度约束，保持原图比例并完整缩放，不再依赖面板内滚动。
- comparison evidence：修复前 `/private/tmp/sapd-oi196-r2-capability-current-1280.png`、`/private/tmp/sapd-oi196-r2-issues-before.png`、`/private/tmp/sapd-oi196-r2-environment-before.png`；修复后 `/private/tmp/sapd-oi196-r2-capability-summary-after3-1280.png`、`/private/tmp/sapd-oi196-r2-issues-after3-1280.png`、`/private/tmp/sapd-oi196-r2-environment-after3-1280.png`。

## Findings

- 能力摘要图：原始 PNG `1116×492` 含完整外框；`object-fit: contain` 同时适配剩余宽高，父面板和图容器均不产生内部滚动。`1280×720` 下摘要面板 `clientHeight = scrollHeight = 363px`，图片按可用区域完整缩放；更高的最大化窗口会随可用高度增长。
- Issue 导出：Web 运行面改为浏览器标准下载，保存位置由浏览器下载设置决定，通常进入用户默认下载目录；macOS App 继续使用“文件下载路径”配置。成功提示不再暴露仓库内 `data/exports` 路径。
- 信息化环境双视图：恢复工程共享 Apple Shell segmented 胶囊 Tab；未新增线型导航私有变体。
- Issue 搜索：复用全局 `page-search-control` / `page-search-input-shell`，圆角、边框、背景和输入框内层规则与其他工作台一致。
- 字段边界：本轮仅调整共享前端布局、交互和运行时导出分流；未新增或展示 `sheet / row / column / raw_value / source_file / import_id / source_id / source_ref / source_label / debug / raw / metadata / intermediate / generated_at`。

## Interaction Verification

| 路径 | 自动验证结果 | 用户复验预期 |
|---|---|---|
| 能力映射摘要 | 应用内浏览器通过 | 图片完整、有四边外框、随窗口可用宽高缩放且无内部滚动 |
| Issue 导出全部 | 应用内浏览器通过 | 显示“下载已开始；保存位置由浏览器下载设置决定”，不出现仓库路径 |
| 信息化环境双视图 | 应用内浏览器通过 | 两个入口使用全局胶囊 Tab，选中项为白色凸起态 |
| Issue 搜索 | 应用内浏览器通过 | 搜索框与全局 Apple Shell 搜索控件一致 |

## Open Questions

- macOS DMG App 本轮未重打包；“文件下载路径”选择和 WKWebView 下载落盘需在下次 DMG 发布矩阵补证。
- 应用内浏览器没有多显示器最大化切换能力；响应式契约已自动验证，真实 1440p / 4K 最大化窗口的最终视觉尺寸仍需用户复验。

final result: Web QA passed；等待用户与后续 DMG 验收

---

# P1-2 / P1-4 / P1-5 用户复验回归 Design QA（2026-07-14）

- visual truth：用户本轮七张缺陷截图，重点对照能力摘要图、Issue 筛选、环境双视图和安全职能单页。已在同一次视觉检查中按“用户样例 / 当前实现”成对输入，未用文字替代视觉对照。
- implementation：`http://127.0.0.1:5173/`；代表路由 `#/capability-mapping`、`#/knowledge/capabilities`、`#/workbench/annotations`、`#/standards/nist-csf-2`、`#/environment-mapping`、`#/knowledge/functions` 和 `#/search?q=纵深|运营`。
- viewport：应用内浏览器当前可用固定视口 `1280×720`；未启动系统 Chrome。参考图的其他最大化显示器尺寸由响应式宽高、原图比例和局部滚动契约覆盖，仍需用户在真实多显示器上完成最终手感复验。
- evidence：`/private/tmp/sapd-p1-regression-audit-20260714/05-issues-fixed-1440.png`、`10-search-context-depth.png`、`11-search-context-operations.png`、`12-environment-line-tabs.png`、`13-functions-no-tab.png`、`14-capability-reference-fit.png`。

## Findings

无剩余自动可判定的 P0 / P1 / P2 设计问题。

- 能力参考图：真实 PNG 上框线为 `1px solid rgb(31, 41, 55)`；当前可用宽度下保持 `1116×492` 原始比例，渲染为 `379×168px`，不拉伸。摘要面板高度不足时 `overflow-y:auto`，滚动后图片上下边均位于 panel 内，不再被父级 `overflow:hidden` 裁切。
- 能力清单：外层目录退出滚动，`.maintenance-table-scroll` 是唯一纵向 owner；重绘快照同时保存展开 group 和 scrollTop。应用内自动点击会为保证目标可见而先滚动 locator，因此不把该自动滚动误判为用户滚轮跳动；DOM 重绘前后 scrollHeight 与展开组数保持一致。
- Issue：筛选字段有明确标签并保持一行阅读顺序；范围、队列与详情复用共享发丝线表面，普通记录不是独立卡片。所选 1 条与全部 40 条真实点击均获得实际 `output_path`，分别生成 372B 与 21KB Markdown。
- 搜索：查询“纵深”和“运营”时上下文均为 `justify-content:center`，中心坐标差 `7.5px`，差异来自结果页滚动条宽度而非不同对齐规则。
- 标准：NIST CSF、等保三级、ISO 27001 三个代表页面首次进入 `aria-expanded=true` 均为 `0`。
- 导航：环境双视图改为透明底、蓝色下划线的页面级线型导航；安全职能清单的 `.maintenance-section-tabs` 和 `[role=tablist]` 均为 `0`。
- 字段边界：主展示代码未新增 `sheet / row / column / raw_value / source_file / import_id / source_id / source_ref / source_label / debug / raw / metadata / intermediate / generated_at`。

## Interaction Verification

| 路径 | 结果 | 状态断言 |
|---|---|---|
| Issue 导出所选 | 应用内浏览器通过 | 返回并显示真实 `data/exports/sapd-issues-selected-*.md` |
| Issue 导出全部 | 应用内浏览器通过 | 返回并显示真实 `data/exports/user-notes-export-*.md` |
| 标准 / 框架首次进入 | 应用内浏览器通过 | 三条代表路由全部收起 |
| 全局搜索两组关键词 | 应用内浏览器通过 | 查询提示采用同一居中布局 |
| 环境双视图 | 应用内浏览器通过 | 无 segmented 胶囊，当前页使用蓝色下划线 |
| 安全职能单页 | 应用内浏览器通过 | 无伪 Tab，搜索与表格直接进入主任务 |
| 能力参考图 | 应用内浏览器通过 | 上框线存在、原图比例保持、面板内部滚动可完整查看 |

## Open Questions

- macOS DMG App 本轮未重打包、未做 WKWebView 回归；shared runtime 变更在下次发布矩阵补证。
- 应用内浏览器没有提供可生效的多显示器最大化视口，本轮未用系统 Chrome 规避规则；用户需在实际 1440p / 4K 最大化窗口确认参考图视觉尺寸和能力清单滚轮手感。

final result: passed

---

# 成熟度评分执行底部连续性 Design QA（2026-07-14）

- visual truth：用户缺陷截图 `/var/folders/81/8nwy3h2n00s1dw1g5bnvj7j40000gn/T/codex-clipboard-54896900-3e86-43d5-921e-0feffbc2b32d.png`；只修复评分执行页底部空带、背景露出和操作栏脱节，不改变目录、评分表单、Slider 或业务字段。
- implementation：`http://127.0.0.1:5173/#/workbench/maturity/demo-project-001`，应用内浏览器固定视口 `2048×1152`。
- height contract：评分正文可用高度为 `100dvh - 56px topbar - 96px page header - 100px project sticky header = 900px`；项目正文底部 padding 为 `0`；目录最大高度为同一 `900px` 并由内部 tree 承担滚动。
- comparison evidence：修复前 `/private/tmp/maturity-scoring-bottom-before-2048x1152.png`；修复后 `/private/tmp/maturity-scoring-bottom-after-2048x1152.png`。

## Findings

- 根因不是按钮样式或黑色线条本身，而是评分壳层错误只扣减 `43px`，比真实 `100px` 项目锁定头少扣 `57px`；项目正文又额外保留 `22px` bottom padding。
- 左侧目录的完整树高曾参与父 grid 的固有高度计算，使宽屏壳层从应有 `900px` 被继续撑到 `950px`。现目录上限与 Apple Shell 可用高度一致，树内容在目录内部滚动，不再反向改变主工作区高度。
- 评分表单、保存动作、目录行、聚合口径、数据接口和正式数据均未修改；没有新增图片资产或页面专用视觉标准。

## Interaction Verification

| 路径 | 结果 | 状态断言 |
|---|---|---|
| 2048×1152 宽屏 | 应用内浏览器通过 | 项目锁定头 `100px`；正文 / 评分壳层基准 `900px`；项目正文 bottom padding `0` |
| 左侧评分目录 | 应用内浏览器通过 | 目录最大高度 `900px`；tree `overflow:auto`，目录内容不再撑高父壳层 |
| 底部操作区 | 应用内浏览器通过 | “保存并转到下一项”保持在评分表单底部；壳层后无独立空白带或黑色 App 背景 |
| 成熟度业务契约 | 自动通过 | `126/126`；未修改评分、聚合、Rubric、模板或数据边界 |

## Open Questions

- 本轮为 shared runtime，5173 Web 已完成应用内浏览器验收；macOS DMG App 未重打包或执行 WKWebView 人工回归。

final result: passed

---

# 共享目录外壳四角与组件统一 Design QA（2026-07-14）

- visual truth：用户缺陷截图 `/var/folders/81/8nwy3h2n00s1dw1g5bnvj7j40000gn/T/codex-clipboard-894fbcb2-ef37-41ba-94e6-a33cba2d0c1d.png`。红框只标记四角双弧缺陷；目录行、层级缩进、文字、选中态和折叠行为均保持原样。
- implementation：`http://127.0.0.1:5173/#/capability-mapping`；应用内浏览器固定视口 `1280×720`。能力、环境、维护和内容目录统一注册 `.shell-directory-pane`。
- geometry contract：只有目录外壳持有 `1px border + 10px radius + overflow:hidden`；目录头最小高度 `40px`；滚动正文固定 `border:0 / border-radius:0 / box-shadow:none`，不再形成第二条内轮廓。
- comparison evidence：全视图 `/private/tmp/sapd-shared-directory-reference-vs-final.png`；底角对照 `/private/tmp/sapd-shared-directory-bottom-corners-reference-vs-final.png`；最终实现截图 `/private/tmp/sapd-shared-directory-capability-final-full.png`。

## Findings

- 根因不是某个底角像素，而是 `.tree / .environment-tree / .source-nav` 仍持有旧 `18px` 边框圆角，同时 Apple Shell 父 pane 又持有 `10px` 轮廓，形成双 contour owner。
- 统一粒度是“常驻目录外壳”，不是业务目录行。能力、环境、维护、内容四类目录共用外壳契约；成熟度评分目录属于业务专用工作台，本轮不扩散修改，避免触发无关成熟度规则变化。
- 首轮交互检查发现共享边框优先级覆盖了折叠态，目录收起后残留 `2px` 细缝；最终补齐 capability / environment 折叠态 `border:0 / background:transparent / box-shadow:none`，折叠宽度恢复为 `0`。
- 字体、文案、行高、层级缩进、颜色 token、业务数据与选择逻辑均未变化；没有新增图片资产或第三套圆角标准。

## Interaction Verification

| 路径 | 结果 | 状态断言 |
|---|---|---|
| 能力目录展开态 | 应用内浏览器通过 | pane 四边 `1px`、`radius=10px`；body 四边 `0px`、`radius=0px`、可滚动 |
| 能力目录折叠 / 恢复 | 应用内浏览器通过 | 折叠宽度 `0`、无边框 / 背景 / 阴影；恢复后仍为单轮廓 |
| 环境对象树 | 应用内浏览器通过 | pane `1px + 10px`；body `0px + 0px`；滚动正常 |
| 内容目录 | 应用内浏览器通过 | pane `1px + 10px`；body `0px + 0px`；滚动正常 |
| 维护目录 | 静态契约通过 | 旧 source-nav 当前路由隐藏，但已注册共享 class，重新启用时不会恢复双弧 |
| 页面运行质量 | 应用内浏览器通过 | console error `0`；未启动系统 Chrome |

## Comparison History

1. 缺陷基线：父 pane 与滚动 body 同时画圆角，底部清晰出现内外双弧。
2. 交互修正：单轮廓已生效，但折叠态出现 `2px` 残留，立即补齐折叠优先级。
3. 最终状态：展开态仅父外壳拥有轮廓；折叠态完全退出布局；业务目录内容未移动。

## Open Questions

- Web 端已完成自动与应用内浏览器验收；shared runtime 会同步影响 macOS App，但本轮未重打 DMG，也未做 WKWebView 人工回归。

final result: passed

---

# 全工程前端 P1-2 V2 能力 / 环境画布外壳 Design QA（2026-07-14）

- visual truth：能力页以用户本轮图 2 `codex-clipboard-b71e2876-be6a-4568-89a7-5ccbb93245da.png` 和既有 OI-159 为唯一视觉权威；环境页以用户图 3 / 图 4 的连续弧角为缺陷证据。图谱节点布局、Draw.io 原图均不是本轮视觉修改对象。
- implementation：`http://127.0.0.1:5173/#/capability-mapping` 与 `http://127.0.0.1:5173/#/environment-mapping`；系统 Chrome 视口固定 `1898×1064`。
- 能力结构：当前对象位于画布容器外；画布控制层内部只有左侧 `关系图谱 / 摘要总览` 与右侧搜索；surface / canvas 圆角为 `26px / 18px`。目录保持 `240px` 默认、`220—300px` 拖拽与窄屏折叠。
- 环境结构：工具栏和 Draw.io 图面位于同一个 `.environment-basemap-lab-main`，主容器为 `18px + overflow:hidden`；原图颜色、字体、坐标与边线样式不改。

## Findings

- 初版失败不是颜色或某个间距，而是把图 2 的“对象标题层”和“画布控制层”误合并为一个头部；同时 P1 CSS 把 OI-159 已成熟的 `26px / 18px` 圆角、单行左右布局和画布 padding 覆盖成另一套 grid，造成结构虽统一但视觉退化。
- V2 不再重新设计近似样式，直接恢复图 2 当时的 DOM 分层，并把 OI-159 设为视觉权威；P1 CSS 只保留目录轨道、可用高度、环境外壳与 drawer 行为。
- 环境弧角缺失来自外层 grid 把主容器圆角清零；V2 由 main 自身恢复 `18px` 裁切，工具栏不另起独立标准。
- 图谱碰撞和 Draw.io 图形仍按冻结哈希保护；本轮没有改节点、边、标签、transform 数据源或生成图样式。

## Interaction Verification

| 路径 | 结果 | 状态断言 |
|---|---|---|
| 能力页对象标题与控制层 | 系统 Chrome 通过 | `titleOutsideSurface=true`、`titleAboveSurface=true`、`controlInsideSurface=true` |
| 能力页圆角与布局 | 系统 Chrome 通过 | `surfaceRadius=26`、`canvasRadius=18`；Tab 左、搜索右；横向溢出 `0` |
| 环境页连续弧角 | 系统 Chrome 通过 | `mainRadius=18`、`mainOverflowHidden=true`、`toolbarInsideMain=true` |
| 页面运行质量 | 系统 Chrome 通过 | 两页 console issue `0`、body / workspace 横向溢出 `0` |
| P0 / P1 总回归 | 自动通过 | `static / frontend / quick`；P0-1、P0-2、P0-4、P1-1—P1-6 与治理均通过 |
| 冻结边界 | 自动通过 | P0-3 两个图谱文件、环境 SVG / CSS 四项 SHA-256 不变；未构建 DMG |

## Open Questions

- 需要用户在固定 5173 入口重新确认能力页是否已恢复图 2 的舒适度，以及环境工具栏 / 图面弧角是否符合图 3 / 图 4 预期。
- 本轮是 shared runtime；5173 Web 已验证，macOS DMG App 未重打包或人工回归，发布前按验收矩阵补做。

final result: pass（Web 自动与视觉对照通过，待用户业务视觉验收）

---

# 全工程前端 P1-1 共享运行状态模板 Design QA（2026-07-14）

- design source：`frontend/design-handoff/implementation-specs/frontend-global-optimization-plan-2026-07-11.md` 的 `FE-R48 / P1-1`，并继承 P0-2 Apple Shell token；真实工程入口为 `http://127.0.0.1:5173/`。
- implementation：`RuntimeState.js + runtime-state.css` 为共享状态基座；能力映射、信息化环境、标准 / 字典为代表接入页面。没有创建新路由、独立 demo 或第二套视觉标准。
- 状态口径：`loading / empty / missing_file / error / no-selection` 分别回答“仍在加载 / 已加载但无业务记录 / 数据包缺失 / 请求失败 / 未选对象”，不得统一显示成“暂无”。
- 交互口径：loading 使用骨架；error 与 missing_file 提供局部重试；重试清理对应数据包缓存并保留路由和当前对象；环境映射无选择使用 no-selection，搜索无结果使用 empty。

## Findings

- 原问题不是空态文案不统一，而是 `dataClient.fetchPackage()` 把所有非成功响应和异常都标记为 `missing_file`，页面又用“未加载”或空数组推断状态，导致缺文件、服务错误、空数据和未选择互相伪装。
- 本轮把状态权威收回到 `dataClient`：静态 404 才是 `missing_file`，其他 HTTP / JSON / 请求失败是 `error`；页面只消费显式状态，不从空 DOM 或默认首项反推。
- 共享视觉沿用 Apple Shell 的中性色、选择蓝、警告金和错误语义色；状态面不新增大卡片、渐变、图标体系或嵌套边框。骨架只使用透明度动画，并支持 `prefers-reduced-motion`。
- 未重新引入 P0-3 控制器、视图策略或图谱算法；成熟度业务 / 评分、Draw.io 原图和正式数据均未修改。

## Interaction Verification

| 路径 | 结果 | 状态断言 |
|---|---|---|
| 五态组件渲染 | 自动通过 | 五个独立 `data-runtime-state`；loading 有 skeleton / `aria-busy`，error 使用 `role=alert` |
| 404 / 503 / 重试 | 自动通过 | 404=`missing_file`；503=`error`；失效缓存后第二次请求恢复 `ready` |
| 能力映射 | 自动通过 / 视觉待验 | 初始数据 loading / empty / missing / error 不画空图，错误可局部重试 |
| 信息化环境 | 自动通过 / 视觉待验 | 数据状态与 no-selection / 搜索 empty 分开；不修改 Draw.io 源样式 |
| 标准 / 字典 | 自动通过 / 视觉待验 | 索引、框架和表格加载 / 错误 / 空记录复用共享模板 |
| 路由与对象保留 | 自动通过 | 仅原路由和九类选择快照均未被替代时恢复；用户已切路由或新选对象时不回写旧快照 |
| 字段边界 | 自动通过 | 共享状态主区不显示来源、原始值、导入、调试和生成时间字段 |
| DMG App | 后置 | shared runtime 会影响 App，但本轮未重打包或做 WKWebView 人工验收 |

## Open Questions

- 需用户在固定 5173 入口人工确认状态面的密度、文案和局部重试反馈；系统 Chrome 未经授权未启动，DMG App 视觉与键盘证据按发布矩阵后置。

# 成熟度评估第十一轮滑块比例与下级评估设置 Design QA（2026-07-14）

- visual truth：用户当前实现截图 `codex-clipboard-86cc6b7a-59b4-4e83-b691-8c924afffe04.png` 与 Codex Desktop 强度控件参考 `codex-clipboard-b2d239c8-d23a-4d92-b3bb-a9bf7b83907c.png`；参考图是本轮长度、轨道厚度和 thumb 比例真值。
- implementation：`http://127.0.0.1:5173/#/workbench/maturity/demo-project-001`，覆盖“评分执行”的四维单项 Slider 和关注点“下级评估设置”。
- 尺寸契约：桌面轨道最大长度 `290px`、轨道厚度 `30px`、圆形 thumb 直径 `34px`；轨道厚度接近 thumb 直径，五个离散点内嵌于蓝色轨道。
- 状态契约：下级无评分时可统一应用、不可清空；存在任一自评 / 复核四维评分时可清空、不可统一应用；确认清空后状态反转。设置入口全程可打开。

## Findings

- 上一轮不验收的根因是轨道仍横跨大部分评分列，厚度与大号 thumb 不成比例。本轮直接收紧控件几何，不增加新色彩、外框或装饰层。
- 原入口在已有评分后消失，无法承载用户要求的“清空后重新统一设置”流程。新入口不再受是否已评分影响，只在面板内用两个互斥动作表达当前可执行状态。
- 清空是破坏性评分动作，因此使用内联确认；其写入边界限定为当前关注点的下级 SERVICE `elements / reviewElements`，不删除评估点，不清理适用性、目标、理由、依据、证据或备注。
- 应用内 Browser 运行库仍在建立会话时报 `Cannot redefine property: process`；项目规则禁止未经授权启动系统 Chrome，因此无法完成同视口截图并排比对。

## Interaction Verification

| 路径 | 结果 | 状态断言 |
|---|---|---|
| 单项五档 Slider | 自动通过 / 视觉待验 | `290 / 30 / 34px` 几何契约；只提交 L1—L5；其他维度不重建 |
| 下级评估设置入口 | 自动通过 / 人工待验 | `CHILD_ROLLUP` 下始终显示且可打开；只读项目仍可查看 |
| 无下级评分 | 自动通过 / 人工待验 | 清空禁用，统一应用可用；拖动只预览 |
| 已有下级评分 | 自动通过 / 人工待验 | 清空可用，统一应用禁用 |
| 确认清空 | 自动通过 / 人工待验 | 只清空 SERVICE 自评 / 复核四维评分；状态反转并保留其他输入 |
| 项目总控 | 自动通过 | 成熟度 `126/126`、maturity smoke、数据边界、语法、diff-check 与 5173 guard |
| 实现截图对比 | 阻断 | 应用内 Browser 无法建立会话；未启动系统 Chrome |

## Open Questions

- 用户需在固定入口人工确认 Slider 短厚比例与“有分先清空、清空后再统一设置”的两态流程；确认前 `OI-192` 不关闭。
- macOS DMG App 未重建、未回归；本轮属于 shared runtime，App 证据后置到发布矩阵。

final result: blocked

---

# 成熟度评估第十轮项目概览分区与 macOS 滑块 Design QA（2026-07-14）

- visual truth：用户提供 Codex 产品五档滑块、当前带外框 / 数字刻度滑杆和当前项目概览截图；项目概览按用户文字固定为左侧项目基本信息、右侧评估进度，滑块以用户图 2 为第一视觉真值，并参考 Apple macOS Slider 的轨道、thumb 与离散刻度原则。
- implementation：`http://127.0.0.1:5173/#/workbench/maturity/demo-project-001`，覆盖“评分执行”和“项目概览”。
- 数据分析口径：总体完成率是右侧唯一主指标；能力、关注点、评估点分别显示完成 / 适用、待完成、不适用。不同对象粒度的不适用数量不相加；不适用对象从各自层级分母排除。当前结果不进入概览。
- 自动契约：左右职责分区、三层分母解释、无当前结果概览、无外框五档滑块、评分与统一设置下级复用滑块、批量初始化显式应用均纳入 `scripts/audit_maturity_assessment_v2_1_contract.py`。

## Findings

- 第九轮失败点不是有没有进度指标，而是仍让进度、项目字段和当前结果争夺概览主区。新结构把项目事实和执行进度分成两个同高区域；结果指标退出概览。
- 滑杆失败点是共享输入样式残留的矩形外框、数字标签和偏细 thumb。新控件显式清除 range 边框 / 阴影，使用 `14px` 圆角轨道、五个离散点和 `38px` 浅色圆形 thumb；当前等级和 Rubric 保持局部更新。
- “统一设置下级”不再保留五个按钮，而是复用相同滑块；拖动只更新待应用等级，点击“应用到下级”后才调用既有 `FOCUS_BATCH` 初始化，避免拖动过程多次覆盖。
- 后端 summary 与评分 / 聚合规则本轮无变化；正式数据无变化。
- 应用内 Browser 运行库仍在建立会话时报 `Cannot redefine property: process`；项目规则禁止未经授权启动系统 Chrome，因此无法生成本轮实现截图和真实滑杆手感证据。

## Interaction Verification

| 路径 | 结果 | 状态断言 |
|---|---|---|
| 单项五档评分滑块 | 自动通过 / 视觉待验 | 原生 range 只允许 1—5；无表单外框 / 数字标签；等级名和 Rubric 同控件局部更新 |
| 统一设置下级滑块 | 自动通过 / 视觉待验 | 复用相同轨道与 thumb；拖动只预览；点击“应用到下级”后一次性初始化 |
| 局部评分更新 | 自动通过 | 当前维度 `{ rerender: false }`；静默试算只刷新汇总与当前结果 |
| 稀疏 / 密集服务 Tab | 自动通过 / 视觉待验 | 1—3 项左对齐；4 项以上保持单行 Apple Shell |
| 项目概览左区 | 自动通过 / 视觉待验 | 只显示项目基本信息和当前阶段；无当前结果 / 进度 KPI |
| 项目概览右区 | 自动通过 / 视觉待验 | 能力 / 关注点 / 评估点分别显示完成、适用、待完成、不适用和分母说明 |
| 继续评分 | 自动通过 / 视觉待验 | 未完成能力可作为继续位置；右侧主按钮通过 flex 贴底 |
| 项目总控 | 通过 | `static,frontend`、成熟度 `125/125`、maturity smoke、5173 guard、数据边界、语法与 diff-check 通过 |
| 实现截图与滑杆手感 | 阻断 | 应用内 Browser 无法建立会话；未启动系统 Chrome |

## Open Questions

- 用户需在固定入口人工确认两种滑块视觉 / 手感、概览左右分区和一屏节奏；确认前 `OI-192` 不关闭。
- macOS DMG App 未重建、未回归；本轮属于 shared runtime，App 证据后置到发布矩阵。

final result: blocked

---

# P0-3 能力图谱碰撞治理回退 Design QA（2026-07-14）

- 用户裁定：上一版不能按局部黄金样例宣称治理完成，P0-3 完整回退并暂停，不再继续修补。
- 失败证据：全量 91 个关注点复核中，总览模式仍有标签重叠 `6`、连线侵入 `18`、连线交叉 `483`；跨全部视图仍有 `8` 个关注点发生标签重叠、`24` 个关注点发生连线侵入、`80` 个关注点发生交叉。`T-AS.AD-02 / 03` 继续出现节点 / 连线交叉；标准分支暴露 UUID 编码节点；“恢复自动布局”同时承担重置过滤、分支、聚合和拖拽位置，业务含义不清且截图场景无可见反馈。
- 根因结论：专项审计的输入和真实组件运行图不完全同构，且对 L2 / 关注点未把交叉作为阻断；四个代表对象与一个合成压力图不能代表全部 91 个关注点。该验收模型本身不成立，继续调坐标只会制造新的局部回归。
- 运行回退：`app.js`、`styles.css`、`LocalRelationNetworkGraph.js` 精确恢复为冻结的实施前 SHA-256；`relationGraphModel.js` 本轮从未修改。P0-3 控制器、视图策略、配置、专项审计和项目测试挂钩全部移除。
- 边界：Apple Shell、P0-1、P0-2、P0-4、能力数据、关系模型语义、环境 / Draw.io、成熟度、正式 JSON / SQLite、源 Excel、用户库和 DMG 均未纳入回退。
- 回退验证：定向 JS 语法、前端治理、完整 `static / frontend` 总控、P0-1、P0-2、P0-4、能力 ViewModel、capability HTTP/API smoke 和 5173 守护通过。P0-3 专项状态是“已删除 / 已停用”，不是“通过”。
- 产品状态：`OI-138` 标记为“暂不修复 / 已回退”；旧版星形图谱的既有碰撞作为已知限制保留。若未来重启，必须先完成全量真实输入、业务控制语义、UUID 禁显和人工可读性验收设计，再讨论实现。
- 回退证据：`data/exports/worker-verify/frontend-p0-3-collision-governance/20260714T021947Z/rollback-manifest.md`。

final result: rolled back

---

# 成熟度评估第八轮 Dock 密度与稀疏 Tab Design QA（2026-07-14）

- visual truth：用户提供 macOS Dock 正常 / 放大状态、Codex 强度滑杆和当前稀疏 Tab 四张截图；本轮选择 Dock 作为离散 L1—L5 的选中反馈参照，滑杆只作为密度参照，不改变输入类型。
- implementation：`http://127.0.0.1:5173/#/workbench/maturity/demo-project-001`。
- 自动契约：内容宽度五格轨道、仅当前格放大、旧格直接收回、1—3 项稀疏 Tab、4 项及以上密集 Tab 和三文档同步已写入 `scripts/audit_maturity_assessment_v2_1_contract.py`，专项审计 `121/121`。

## Findings

- 根因不是单个 margin，而是同一控件用全宽轨道表达离散五级、同一 Tab 算法同时处理 2 项和 6 项。评分控件已改为紧凑 Dock 轨道；Tab 已按真实数量分为稀疏和密集两种密度，但共享 Apple Shell 语义不变。
- 评分、聚合、适用分母、Rubric、`targetLevel`、API projection、对象粒度和正式数据均无变化。
- 应用内 Browser 运行库仍在建立会话时报 `Cannot redefine property: process`；项目规则禁止未经授权启动系统 Chrome，因此无法生成本轮实现截图和真实动效证据。

## Interaction Verification

| 路径 | 结果 | 状态断言 |
|---|---|---|
| 评分格静态契约 | 自动通过 | 五格组按内容宽度居中；未选格紧凑；当前格 `100 × 100px` 正方形凸起 |
| 评分切换 | 自动通过 / 视觉待验 | 旧格直接移除 active；无离场计时；任一时刻只有一个放大格 |
| 稀疏服务 Tab | 自动通过 / 视觉待验 | 1—3 项使用居中内容宽度分段控件并完整显示文字 |
| 密集服务 Tab | 自动通过 / 视觉待验 | 4 项及以上保持单行自适应，选中项凸起并显示完整名称 |
| 项目总控 | 通过 | `static,frontend`、maturity smoke、5173 guard、数据边界与 diff-check 通过 |
| 实现截图与动效 | 阻断 | 应用内 Browser 无法建立会话；未启动系统 Chrome |

## Open Questions

- 用户需在固定入口人工确认评分格间距、单格放大动效和 1—3 个服务时的紧凑 Tab；确认前 `OI-192` 不关闭。
- macOS DMG App 未重建、未回归；本轮属于 shared runtime，App 证据后置到发布矩阵。

final result: blocked

---

# 成熟度评估第七轮 Apple Shell 与局部评分更新 Design QA（2026-07-14）

- visual truth：用户本轮五张截图，分别约束 L2 汇总指标基线、删除“差距”、中文“关注点”、单行 Apple Shell Tab 和正方形选中评分格；路径为 `/var/folders/81/8nwy3h2n00s1dw1g5bnvj7j40000gn/T/codex-clipboard-ef779b95-e31f-4018-92bf-b940a931ed9c.png`、`/var/folders/81/8nwy3h2n00s1dw1g5bnvj7j40000gn/T/codex-clipboard-b5dfbb36-3a39-48f1-861d-5d6608a8b480.png`、`/var/folders/81/8nwy3h2n00s1dw1g5bnvj7j40000gn/T/codex-clipboard-c2775712-d8e1-4d2c-b012-12e03b8dfa4d.png`、`/var/folders/81/8nwy3h2n00s1dw1g5bnvj7j40000gn/T/codex-clipboard-541a8cfd-ef76-42b8-9139-f7ca258645f0.png`、`/var/folders/81/8nwy3h2n00s1dw1g5bnvj7j40000gn/T/codex-clipboard-4f3a2114-d385-4a31-b8f9-086adf3c9af2.png`。
- implementation：`http://127.0.0.1:5173/#/workbench/maturity/demo-project-001`。
- 自动契约：L2 汇总三项对齐、无“差距”、术语替换、单行 Tab、固定五格、`112 × 112px` 选中方格、当前维度局部 DOM 更新、静默结果摘要刷新和连续打分补算均已写入 `scripts/audit_maturity_assessment_v2_1_contract.py`，专项审计 `118/118`。

## Findings

- 代码实现已按第七轮契约完成，业务评分、聚合、适用分母、Rubric、`targetLevel`、API projection 和正式数据没有变化。
- 应用内 Browser 插件在建立会话时持续报 `Cannot redefine property: process`；按 Browser 技能允许的回退顺序尝试 Computer Use，但 Computer Use 明确禁止控制 `com.openai.codex`。项目规则又禁止未经用户授权启动系统 Chrome，因此无法生成本轮实现截图、同图对照或多视口 DOM 几何证据。
- 完整 `static,frontend` 套件在前端治理步骤发现 `LocalRelationNetworkGraph.js` 为 `1324` 行、超过既有基线 `1313` 行；该文件属于另一活动任务且本轮未修改，故保留为共享工作区外部阻断，不擅自调整治理基线或覆盖他人改动。其余本轮相关与后续前端契约均通过。

## Interaction Verification

| 路径 | 结果 | 状态断言 |
|---|---|---|
| L2 汇总与术语 | 自动契约通过 | 无“差距”；显示“评估维度均值”；外部标签为“关注点” |
| 服务 Tab | 自动契约通过 / 视觉待验 | 单行 Apple Shell、选中项凸起、完整文字与适用方框同属当前项 |
| 四维评分 | 自动契约通过 / 视觉待验 | 固定五格，选中方格 `112 × 112px`，定义位于方格内部 |
| 局部更新 | 自动契约通过 / 交互待验 | 打分不调用整页 `render()`；静默试算只更新汇总与当前结果；连续打分最终补算 |
| 5173 与 API | 通过 | guard、workspace、maturity validate / calculate / report / export 均为 `ready` |
| 多视口同图对照 | 阻断 | 应用内 Browser 运行库无法建立会话；未启动系统 Chrome |

## Open Questions

- 用户需在固定入口人工确认单行 Tab、正方形格内定义动画和其他维度不闪烁；确认前 `OI-192` 不关闭。
- macOS DMG App 未重建、未回归；本轮属于 shared runtime，App 证据继续后置到发布矩阵。

final result: blocked

---

# 成熟度评估第六轮 Tab、格内评分定义与整体锁定 Design QA（2026-07-14）

- 本节覆盖并取代下文第五轮中“适用性仍与名称分离”“定义在选中格外展示”和“只锁定项目页签”的结论；旧记录仅保留为否决与修正过程追踪。
- visual truth：用户本轮提供的 3 张截图，分别约束服务 Tab、选中评分格内的定义动画和完整项目上下文锁定；路径为 `/var/folders/81/8nwy3h2n00s1dw1g5bnvj7j40000gn/T/codex-clipboard-94201573-1c9b-4391-91aa-20b7df20f24f.png`、`/var/folders/81/8nwy3h2n00s1dw1g5bnvj7j40000gn/T/codex-clipboard-4200c61a-2830-4a0c-a029-d74be1b32315.png`、`/var/folders/81/8nwy3h2n00s1dw1g5bnvj7j40000gn/T/codex-clipboard-4bcdfd70-0717-4b86-8aed-006c61d9baf4.png`。
- implementation：`http://127.0.0.1:5173/#/workbench/maturity/demo-project-001`；应用内浏览器最终聚焦证据为 `/private/tmp/sapd-maturity-sixth-focus-755x466.jpg`、`/private/tmp/sapd-maturity-sixth-project-header-1034x100.jpg`，三组参考与最终实现同屏对照为 `/private/tmp/sapd-maturity-sixth-tabs-reference-vs-final.jpg`、`/private/tmp/sapd-maturity-sixth-score-reference-vs-final.jpg`、`/private/tmp/sapd-maturity-sixth-header-reference-vs-final.jpg`。
- viewport：应用内浏览器覆盖 `1280 × 720`、`1024 × 900`、`390 × 844`；未启动系统 Chrome。

## Findings

无剩余本轮范围内的 Web P0 / P1 / P2 设计问题。

- 服务 Tab：每个安全技术服务使用单一卡片边界，状态点、完整服务名和适用性方框形成一个连续阅读单元；1280px 下为三列两行，名称溢出计数为 `0`，checkbox 实测 `17 × 17px`。1024px 仍保持三列，390px 只允许 Tab 导航内部水平滚动。
- 评分反馈：定义不再占据独立列或独立卡片。未选格保持 `42px`，当前选中格实测扩展为约 `432 × 66px`，数字、`Lx` 等级名和定义全部在同一蓝色格内；真实点击时轨道从 `42 42 432 42 42` 平滑切换为 `42 432 42 42 42`，再恢复为 `42 42 432 42 42`。减少动态效果偏好下自动取消动画。
- 项目导航：项目名称 / 模板 / 最近更新时间和六个项目步骤合并为同一 sticky 容器，实测总高 `100px`（项目上下文 `48px` + 项目步骤 `52px`）；评分区滚动 `520px` 后两个子区仍固定在内容顶部。
- 视觉系统：字体、字重、蓝灰层级、圆角、边界、间距、checkbox 和已选蓝色继续复用现有 Apple Shell token；没有引入新的图片、图标资产或营销文案。服务卡片、评分格和锁定区的文字均在各自边界内完整可读。
- 既有第五轮有效项继续保留：用户可见术语为“目标等级”；关注点摘要分组；重复服务头和展开 / 收起删除；底部承载排除规则与“保存并转到下一项”；不适用服务不进入评分、聚合或完成率分母。
- 业务边界：不适用服务不进入评分、聚合或完成率分母；关注点仍只作定义和一次性初始化入口，不在执行页回填下级聚合分。

## Interaction Verification

| 路径 | 结果 | 状态断言 |
|---|---|---|
| 服务 Tab | 通过 | 1280px 下 6 项按 `3 × 2` 排列，完整名称溢出 `0`，适用方框 `17 × 17px` 并与对象共享卡片边界 |
| 四维评分 | 通过 | 真实点击 `3 → 2 → 3` 后定义同步为 L2 / L3；当前轨道宽约 `432px`，定义节点位于当前按钮内部，独立定义节点计数 `0` |
| 动画与滚动保持 | 通过 | 格宽与定义进入动画均生效；实际坐标点击后工作台滚动位置保持 `253.5 → 253.5`，页面不跳顶 |
| 完整项目锁定 | 通过 | 滚动 `520px` 后 `100px` 项目上下文 + 项目步骤整体保持在主内容顶部，两个子区没有分离 |
| 响应式边界 | 通过 | 1280 / 1024 / 390px 的 html、项目页、工作台和评分表单页面级横向溢出均为 `0`；窄屏仅 Tab 和五格轨道内部局部滚动 |
| 视觉与字段 | 通过 | 字体、间距、颜色、圆角、边界、图标 / 图片资产和文案面均完成聚焦核对；主展示区禁显字段命中 `0` |
| 契约审计 | 通过 | 成熟度 V2.1 专项审计 `109/109`；maturity smoke、完整 `static,frontend` 套件、数据边界和 diff-check 通过 |

## Open Questions

- macOS DMG App 本轮未重建、未回归；本轮属于 `shared runtime`，共享前端会同时影响 Web 与 App，但 5173 证据不替代下次 DMG 发布矩阵验收。
- 应用内浏览器在滚动态截取带透明 / fixed 图层的整页图时，顶部曾出现黑色合成伪影；DOM 计算值、滚动固定断言和滚动前截图均确认实际页面背景正常，因此不作为产品缺陷。
- `OI-192` 保持“已修复 / 待用户验收”；用户需在固定 5173 入口核对 Tab、格内定义动画和完整项目区锁定后再关闭。

final result: passed

---

# P0-4 标准深链与 Issue 按需详情 Design QA（2026-07-13）

- source：P0-4 修复前真实工程 `http://127.0.0.1:5173/#/standards/nist-csf-2-0` 与 `http://127.0.0.1:5173/#/workbench/annotations`；应用内浏览器源状态截图为 `/private/tmp/sapd-p04-standard-before.png`、`/private/tmp/sapd-p04-issue-before.png`。
- implementation：标准深链、Issue 初始 / 打开 / 关闭状态均来自同一 5173 真实工程；截图为 `/private/tmp/sapd-p04-standard-workforce-after.png`、`/private/tmp/sapd-p04-issue-initial-after.png`、`/private/tmp/sapd-p04-issue-open-after.png`。
- viewport：应用内浏览器 `1280 × 720`；未启动系统 Chrome。
- 对照方式：Issue 修复前源状态与修复后初始状态以同一视口放入同一视觉对照输入，另以打开态核对按需详情层；标准页保持既有 Apple Shell 视觉语言，只对深链导航定位和边界留白做功能性校正。

## Findings

无剩余本轮范围内的 Web P0 / P1 / P2 设计问题。

- 标准深链：当前业务域和当前框架同时可见；最靠近导航底部的框架也保留 `10px` 安全留白，没有出现已选项贴边、被裁切或与下一业务域混淆。
- Issue 初始态：页面只常驻作用域栏与队列，空 inspector 不再挤占约 `320px`；队列可用宽度由约 `520px` 恢复为约 `734px`，页面无横向溢出。
- Issue 打开态：明确点击或键盘打开后，详情才进入第三列；边界、圆角、密度和按钮继续使用 P0-2 Apple Shell 既有 token，没有新增独立视觉标准。
- Issue 关闭态：详情完全退出布局，队列宽度恢复，焦点返回来源行；批量 checkbox 保持未勾选，避免“查看”被误表达为“批量选择”。
- 路由隔离：从标准页重新进入 Issue 时无旧详情、旧激活行或旧批量勾选泄漏，只展开工作台业务域。

## Interaction Verification

| 路径 | 结果 | 状态断言 |
|---|---|---|
| 8 个标准深链 | 通过 | `standards` 域展开，当前框架可见，导航边界留白 `10px` |
| Issue 首次进入 | 通过 | `data-review-inspector-open=false`，inspector 宽度 `0`，队列约 `734px` |
| 行点击打开 | 通过 | 显式 `workbenchSelectedIssueId` 驱动详情，批量勾选数仍为 `0` |
| 键盘打开 | 通过 | `ArrowUp / ArrowDown` 移动焦点，`Enter / Space` 打开当前行 |
| 关闭详情 | 通过 | inspector 移除、队列恢复约 `734px`、焦点回到来源行 |
| 路由重入 | 通过 | 详情、激活行和批量选择均为 `0`，仅工作台域展开 |
| 页面边界 | 通过 | 1280px 页面无横向溢出，应用内浏览器错误日志为空 |

## Open Questions

- macOS DMG App 本轮未重建、未回归；P0-4 属于共享前端，需在下次发布矩阵补 App 证据，5173 通过不替代 DMG 验收。
- 用户仍需在固定 5173 入口完成标准深链和 Issue 工作台的最终业务 / 视觉人工验收。

final result: passed

---

# 全局共享标题区旧 DMG 对照 Design QA（2026-07-13）

- visual truth：用户提供的旧 DMG 截图 `/var/folders/81/8nwy3h2n00s1dw1g5bnvj7j40000gn/T/codex-clipboard-7bd26c67-9dfd-4d09-81a9-22d211d9d901.png`，并在同一应用内浏览器中读取已挂载旧 DMG `0.1.7` 的 `http://127.0.0.1:18765/`。
- 反例：用户提供的当前程序截图 `/var/folders/81/8nwy3h2n00s1dw1g5bnvj7j40000gn/T/codex-clipboard-6726336c-4f54-438e-b604-aae3e82c2b57.png`。
- implementation：`http://127.0.0.1:5173/#/`；同尺寸旧 DMG 与修复后证据为 `/private/tmp/sapd-global-header-old-dmg-20260713.png`、`/private/tmp/sapd-global-header-fixed-20260713.png`。
- 根因：上轮 P0-2 舒适度修正把旧 DMG 的 `24px` 标题、`12px` 说明和 `12px 18px` 页头内边距漂移为 `26px / 14px / 10px 24px`；问题属于共享 App Shell token，不是“全局导航”单页样式。
- 修正后计算值：页头 `96px`、标题 `24px / 27.12px`、说明 `12px / 17.4px`、页头内边距 `12px 18px`、页头 gap `12px`、文本组 gap `5px`、标题与标签 gap `7px`，与旧 DMG 同值。
- 全局抽查：`全局导航`、`安全能力映射`、`成熟度评估` 三条路由参数一致；页面横向溢出为 `0`，主区禁显字段命中为 `0`。

final result: passed

---

# 成熟度评估共享几何、评分反馈与左图右数 Design QA（2026-07-13）

- visual truth：用户本轮 5 张截图；项目页签与高度基线为 `/var/folders/81/8nwy3h2n00s1dw1g5bnvj7j40000gn/T/codex-clipboard-fd9b0853-e8a4-4795-9c09-54036a73f6ac.png`、`/var/folders/81/8nwy3h2n00s1dw1g5bnvj7j40000gn/T/codex-clipboard-a6b22162-d2e7-4325-953a-d6586925adb9.png`；评分反馈基线为 `/var/folders/81/8nwy3h2n00s1dw1g5bnvj7j40000gn/T/codex-clipboard-c137936e-dfa3-480c-9daf-07a06939eee6.png`；雷达基线为 `/var/folders/81/8nwy3h2n00s1dw1g5bnvj7j40000gn/T/codex-clipboard-63c22e30-6f06-4faf-9477-7f9c72540203.png`。
- implementation：`http://127.0.0.1:5173/#/workbench/maturity/project-001`。
- 评分区证据：`/private/tmp/sapd-maturity-score-qa.png`。
- 雷达区证据：`/private/tmp/sapd-maturity-radar-qa-final.png`。
- viewport：应用内浏览器 `1280 × 720`；未启动系统 Chrome。

## Findings

无剩余本轮范围内的 Web P0 / P1 / P2 设计问题。

- 共享几何：评分复核不再定义独立页签高度；评估模板、评分执行、评分复核和评估结果均复用同一项目上下文与 `52px` 项目页签，内容起点一致。
- 服务 Tab：桌面端按可用宽度等分，6 个评估点一屏展示；删除重复作用域后缀，仅保留业务码与名称。窄屏才允许 Tab 容器内部横向滚动，页面本身不产生横向溢出。
- 评分反馈：每个维度的 1—5 按钮在评分区居中。切换采用 `180ms` 平滑过渡，选中项放大到 `1.14`；下方只显示当前等级完整定义，例如 `L3 充分定义。职责和责任已正式分配，各角色定义清楚，流程所有者和责任人明确。`，不再显示“对照全部 L1—L5”。减少动态效果偏好有降级规则。
- 图表表达：结果页使用全部 `32` 项 L2 后端能力结果，量尺固定 `1—5`，当前值为蓝色实线、目标为金色虚线；轴标签使用中文简写，不再以代码环绕占据阅读空间。
- 左图右数：雷达居左，右侧按后端 `categoryResults / subCategoryResults / capabilityResults / gapItems` 展示 T / G / M 当前值、目标值、L2 数量、L1 分层与低于目标数量。评价只陈述覆盖、差距和后端候选，不由前端重新计算成熟度或生成正式业务结论。
- 视觉对照：评分参考与运行评分区、旧代码雷达与中文简写左图右数实现分别放入同一视觉输入比较；最终结果无标签碰撞、卡片裁切或页面级横向溢出。

## Interaction Verification

| 路径 | 结果 | 状态断言 |
|---|---|---|
| 项目页签高度 | 通过 | 评估模板 / 评分执行 / 评分复核 / 评估结果页签均为 `52px`，项目上下文与内容起点一致 |
| 服务 Tab | 通过 | 当前关注点 6 项全部可见，作用域后缀计数为 `0`，桌面 Tab 条无溢出 |
| 四维评分 | 通过 | 每个维度均为 5 个居中按钮；选中态计算变换为 `matrix(1.14, 0, 0, 1.14, 0, 0)`，当前定义随选择平滑切换 |
| 等级定义 | 通过 | 仅显示当前完整等级定义，“对照全部 L1—L5”计数为 `0` |
| 结果雷达 | 通过 | 全部 32 项 L2 保持可核对；T / G / M 数量为 `19 / 1 / 12`，中文简写与右侧统计并列展示 |
| 页面边界 | 通过 | 1280px 页面无横向溢出，应用内浏览器错误日志为空 |

## Open Questions

- 完整 `frontend` 套件中的成熟度、P0-1、P0-2 与本轮专项检查均通过；仅前端治理检查发现未由本轮修改的 `styles.css` 比既有行数基线多 `8` 行，本轮不擅自改治理基线。
- macOS DMG App 本轮未重建、未回归；共享前端代码需在下次发布矩阵补 App 证据，5173 通过不替代 DMG 验收。
- 用户仍需在固定 5173 入口完成最终业务和视觉人工验收。

final result: passed

---

# 成熟度评估评分目录与能力雷达 Design QA（2026-07-13）

- 目录 visual truth：`http://127.0.0.1:5173/#/capability-mapping`，截图 `/private/tmp/sapd-capability-directory-reference-20260713.png`。
- 旧结果页基线：`/private/tmp/sapd-maturity-results-before-20260713.png`。
- implementation：`http://127.0.0.1:5173/#/workbench/maturity/demo-project-001`。
- 评分目录证据：`/private/tmp/sapd-maturity-v2-1-directory-workbench-final-20260713.png`。
- 评分目录标签微调证据：`/private/tmp/sapd-maturity-v2-1-directory-status-tags-final-20260713.png`；节点状态标签视觉上仅保留圆点，文字状态通过 `aria-label` / `title` 提供。
- 能力雷达证据：`/private/tmp/sapd-maturity-v2-1-capability-radar-final-20260713.png`。
- viewport：应用内浏览器当前可见区 `1280 × 720`；不使用系统 Chrome。

## Findings

无剩余 P0 / P1 / P2 设计问题。

- 信息架构：评分执行页从“横向 L0 / L1 / L2 + 关注点列表 + 上一 / 下一服务”三套位置模型收口为“左侧 L0 / L1 / L2 / FOCUS 评分目录 + 右侧评分工作台”。目录形态复用安全能力映射的树轨道、缩进、轻分隔线和紧凑编码层级。
- 状态语义：目录节点使用绿色 / 黄色 / 冷灰 / 中性灰圆点标签表达“已完成 / 进行中 / 未开始 / 不适用”，不重复显示文字；文字由目录图例、`aria-label` 和 `title` 保留，蓝色只表达当前选中路径。
- 服务切换：当前关注点的安全技术服务改为可换行 Tab，Tab 显示逐项状态并保留模板顺序；评分表单右上角显示“保存并转到下一项”，不再使用上一 / 下一服务分页作为主导航。
- 评分反馈：等级按钮选中后计算样式为 `transform: matrix(1.14, 0, 0, 1.14, 0, 0)`，当前维度定义立即显现；减少动态效果偏好有独立降级规则。
- 结果叙事：旧结果页同时平铺能力域条形、成熟度分布和证据分布，首屏竞争明显。新结果页先给总体结论，再并列 L2 能力四维雷达与覆盖 / 排除口径；成熟度和证据分布默认折叠，能力域结果后置。
- 图表诚实性：雷达四轴固定为组织与角色、制度与流程、平台与工具、数据与信息，量尺固定 `1—5`；当前实线、人工目标虚线和四个精确值同时出现，不通过截断量尺放大差异，不用雷达面积表达评估点数量。
- 不适用口径：结果统计单独显示适用、已完成、待完成和不适用并排除数量；不适用项不进入当前分、目标分、能力聚合或完成率分母。
- 对照方式：安全能力映射目录参考与评分目录实现、旧结果页与新雷达 / 覆盖组件分别在同一视觉输入中完成对照；未发现裁切、重叠、错误状态色或层级漂移。

## Interaction Verification

| 路径 | 结果 | 状态断言 |
|---|---|---|
| 目录定位 | 通过 | L0 / L1 / L2 / FOCUS 当前路径一致，节点状态标签仅显示圆点；完成数 / 适用数仍在节点右侧，目录图例保留文字 |
| 服务 Tab | 通过 | 当前关注点 6 个真实评估点可直接定位，完成 / 进行中 / 不适用状态可辨 |
| 保存并转到下一项 | 通过 | 当前评分项 ID 从 `score:…:0fd95cca…` 切换为模板顺序下一项 `score:…:80bc9f9f…`，活动 Tab 同步为 `I-DI&T-AS.AD-01` |
| 四维评分 | 通过 | 选中等级后按钮放大至 `1.14`，定义区显示所选 L5 文本，自动保存与试算正常 |
| 结果雷达 | 通过 | 后端重算后能力选择可用，四维值 `4.11 / 4.17 / 3.89 / 3.11` 与人工目标 `3.83` 同时显示 |
| 排除统计 | 通过 | 页面显示 `175` 个适用、`154` 个已完成、`21` 个待完成、`10` 个不适用并排除，完成率 `88%` |
| 页面日志 | 通过 | 应用内浏览器 `dev.logs()` 返回空数组 |

## Open Questions

- macOS DMG App 本轮未重建、未回归；共享前端和 API 投影需在下次发布矩阵补 App 证据，5173 通过不替代 DMG 验收。
- 用户仍需在固定 5173 入口进行最终业务与视觉人工验收。

final result: passed

---

# 成熟度评估方案 1 真实工程复刻收口 Design QA（2026-07-13）

- SERVICE visual truth：`/Users/kim1st/.codex/generated_images/019f4ca2-3fc5-7511-aca7-28474f497efc/exec-179723e8-8ebc-4b69-8049-d870814a2b73.png`。
- FOCUS visual truth：`/Users/kim1st/.codex/generated_images/019f4ca2-3fc5-7511-aca7-28474f497efc/exec-39512eed-fd52-42cb-818c-f7af84861ffc.png`。
- implementation：`http://127.0.0.1:5173/#/workbench/maturity/demo-project-001`。
- SERVICE evidence：`/private/tmp/sapd-maturity-service-final-1440x1024.png`。
- FOCUS evidence：`/private/tmp/sapd-maturity-focus-final-1440x1024.png`。
- viewport：应用内浏览器 `1440 × 1024` 进行视觉对照；另检查 `1024 × 900`、`390 × 844`。截图文件记录可见 WebView 区域，不使用系统 Chrome。

## Findings

无剩余 P0 / P1 / P2 设计问题。

- 本质根因：上一轮运行实现同时保留 App Shell 页头、项目详情头和常驻评分工具条，使评分主内容相对方案 1 下移约 `190px`；三级能力切换又被实现成高密度换行区，破坏了参考图的首屏几何关系。这不是单个颜色或间距问题，而是页面壳职责重复。
- 壳层修复：评分执行页不再渲染重复项目详情头；进度、自动保存和“更多”迁入真实 App Shell 页头。“更多”以 `720px` 浮层承接能力跳转、搜索、状态 / 证据筛选、导入导出与返回项目列表，保留功能但不占用主工作区。
- 主工作区：保持方案 1 的项目内导航、两行 L0 / L1 / L2 能力切换、不可折叠 L2 汇总、当前关注点摘要、`280px` 关注点列表和右侧单点四维评分表单。评分依据保持长输入区，当前等级定义下沉，全部 L1—L5 通过就地浮层对照。
- 两种形态：SERVICE 与无服务 FOCUS 使用同一壳、同一层级和同一评分表单；仅由真实对象类型决定下级服务分页、直接评估标签和对象文案，不拼接、不另造页面。
- 真实数据差异：参考图中的关注点数量和数值只是视觉样例。运行实现保留 `T-AS.AD` 当前真实 3 个关注点及其实际汇总，并保留 `G-SP.SM-01—03` 直接关注点评估，不为了像图而伪造第 4—6 行或覆盖真实评分结果。
- 响应式：`1440`、`1024`、`390px` 均无 document 或项目页面级横向溢出；能力 Tab 只在自己的局部区域滚动且隐藏原生滚动条。`1024px` 下关注点摘要改用 `minmax(0, 1fr) auto auto`，消除内部 `83px` 溢出。
- 字段边界：主评分区未出现 `sheet / row / column / raw_value / source_file / import_id / source_id / source_ref / source_label / debug / raw / metadata / intermediate / generated_at`。

## Interaction Verification

- “更多”可在 App Shell 页头展开，浮层宽 `720px`，原搜索、筛选、导入、导出和返回功能可用。
- 评分表单可收起 / 展开，不改变当前能力、关注点或评分项。
- 从安全技术 `T` 切到安全治理 `G` 后进入无服务 `FOCUS` 直接评分；返回 `T` 后恢复 SERVICE 状态。
- SERVICE 与 FOCUS 分别独立截图，并与各自 visual truth 在同一输入中完成目视对照。
- 控制台无 `error`；专项成熟度契约审计扩展到 `82/82`，新增 App Shell 页头归属、“更多”功能保留、评分面板收起和中宽度无溢出断言。

## Open Questions

- macOS DMG App 本轮未回归；共享前端代码会进入 App，但 5173 结论不能替代下次发布矩阵验收。
- 参考图的样例数量与当前工程真实数据不同，按数据契约保留真实数据，需由用户在 5173 做最终视觉人工评审。
- 5173 页面及 maturity HTTP/API smoke 均可用；`dev_server_guard --status` 初检短暂 `warn`，未干预现有服务后复检为 `pass`。全量 content smoke 的本地包检查通过，但 API 阶段仍出现 `fetch failed`；该检查超出本轮成熟度专项范围，未被写成通过证据。

final result: passed

---

# 成熟度评估第二轮业务验收 Design QA（2026-07-13）

- visual truth：用户本轮图 1—9，主基线为 `/var/folders/81/8nwy3h2n00s1dw1g5bnvj7j40000gn/T/codex-clipboard-397bada4-2377-4c83-a4e4-77e9787beb85.png`，评分区基线为 `/var/folders/81/8nwy3h2n00s1dw1g5bnvj7j40000gn/T/codex-clipboard-8e9881c6-2b94-4632-886a-a0a8ebff3bb3.png`。
- implementation：`http://127.0.0.1:5173/#/workbench/maturity/demo-project-001`；用户可见页面不显示 demo / 演示身份，路由中的稳定内部 ID 不作为界面文案。
- viewport：应用内浏览器 `1486 × 1058`；另检查 `1024 × 900`、`390 × 844`。未启动系统 Chrome。
- implementation screenshot：`/private/tmp/sapd-maturity-v2-1-second-acceptance-final-1486x1058.jpg`。
- full-view comparison：`/private/tmp/sapd-maturity-reference-vs-final.jpg`，左侧用户图 1，右侧运行实现。
- focused comparison：`/private/tmp/sapd-maturity-scoring-focused-reference-vs-final.jpg`，左侧用户图 2，右侧运行评分区。

## Findings

无剩余 P0 / P1 / P2 设计问题。

- 字体与排版：项目步骤、L0 / L1 / L2、L2 指标、关注点和维度名称建立了可辨层级；关注点列表计算字号为编码 `12px`、名称 `13px`、计数 `12px`。评分依据提示与当前等级定义为 `11px`，不再抢占主评分。
- 间距与布局：评估点列表与安全技术服务评分区使用独立表面和分隔线；当前项为原生蓝色 radio，完成项为原生绿色 checkbox。右侧表单保留宽评分依据，未引入卡片墙或未授权重排。
- 颜色与 token：沿用 SAPD Wiki Apple Shell 的蓝色选中态、绿色完成态、冷灰表面和细分隔线；禁用批量入口有明确低对比状态。
- 内容：当前关注点带出后端定义；评分执行页只显示下级数量、完成度和“评分结果在评估结果页统一计算”，不回写下级汇总出的关注点评级。当前等级只显示等级、名称和定义，不显示“通用等级定义 / 适用等级定义 · 模型”标签。
- 图像与图标：本页没有业务图片资产；当前 / 完成状态使用原生表单控件，没有新增 CSS 图、手绘 SVG、emoji 或占位资产。
- 响应式：`1486 / 1024 / 390px` 下 `html`、`.maturity-v1-project-page`、能力导航和评分表单均满足 `scrollWidth === clientWidth`；1024px 评分区改为上下分层，390px 维度和结果栅格为单列，无裁切和页面级横向滚动。
- 可访问性：适用性使用带可访问名称的原生 checkbox；评分为 `button + aria-pressed`；目录状态圆点带 `aria-label` / `title`，评分工作台仍显示文字状态；服务导航使用 Tab。

## Primary Interaction Verification

| 路径 | 结果 | 状态断言 |
|---|---|---|
| 四维评分按钮 | 通过 | 真实坐标点击前、点击后、自动保存和试算完成后 `.maturity-v1-project-page.scrollTop` 均为 `512.5` |
| 是否适用方框 | 通过 | 取消与重新勾选全程 `scrollTop = 512.5`；四维控件保留原位并置灰，不因内容收缩跳位 |
| 关注点批量入口 | 通过 | 任一下级任一维度已有评分时显示“已有下级评分”且禁用；静态审计确认仅全空白时选择一个等级初始化全部下级四维 |
| 下级服务切换 | 通过 | 当前下级无下拉菜单；显示第 N / 总数及上一服务 / 下一服务 |
| 当前等级提示 | 通过 | 选中等级后就地显示该等级定义；“对照全部 L1—L5”按需展开 |
| 页面运行日志 | 通过 | 应用内浏览器 `dev.logs()` 返回空数组 |

## Comparison History

1. 用户图 1—9：指出跳顶、分区弱、能力栏滚动、字号 / 对齐、demo 暴露、适用性与下级下拉、等级提示和关注点批量 / 聚合边界问题。
2. 第一轮实现：功能边界已落地，但 1024px 评分双列内部 `scrollWidth > clientWidth`，判定为 P1；改为 `< 1280px` 上下分层。
3. 移动复核：后置密度样式覆盖了 720px 单列规则，导致评分内部裁切，判定为 P1；在最终样式层补回维度、等级按钮、结果和次级字段单列规则。
4. 最终对照：三档视口无横向溢出；真实评分和适用性点击不跳位；执行页无聚合回写与用户可见 demo 文案；无剩余 P0 / P1 / P2。

## Open Questions

无 Web 设计阻塞。macOS DMG App 本轮未重建、未回归；共享前端需在下次发布矩阵补 App 证据，5173 通过不替代 DMG 验收。

final result: passed

---

# 成熟度模型使用指南 Design QA

- source visual truth: `/var/folders/81/8nwy3h2n00s1dw1g5bnvj7j40000gn/T/codex-clipboard-2dfcc904-9e0e-40af-a4ec-22e3bf4db963.png`
- follow-up visual truth: `/var/folders/81/8nwy3h2n00s1dw1g5bnvj7j40000gn/T/codex-clipboard-dc2fa4bf-c51b-427b-94f9-deac319cb0b8.png`
- removal target: `/var/folders/81/8nwy3h2n00s1dw1g5bnvj7j40000gn/T/codex-clipboard-119924d1-d78f-43bd-836d-b2916f98235b.png`
- compact-height target: `/var/folders/81/8nwy3h2n00s1dw1g5bnvj7j40000gn/T/codex-clipboard-bb28ac43-72a6-444d-9de4-0f5abca19999.png`
- source document: `/Users/kim1st/Downloads/SAPD_成熟度模型使用指南_v1.2_20260709.html`
- implementation screenshot: `/private/tmp/sapd-maturity-guide-compact-desktop.png`
- focused comparison: `/private/tmp/sapd-maturity-guide-compact-comparison.png`
- responsive screenshot: `/private/tmp/sapd-maturity-guide-compact-mobile-390.png`
- viewport: `1440 x 900` desktop；`820 x 900` tablet；`390 x 844` mobile
- state: 从 `/overview` 展开“安全指南”并点击“成熟度模型使用方法”；另验证刷新态和第 6 项目录跳转

## Findings

无剩余 P0 / P1 / P2 问题。

- 字体与排版：实现继续使用原始 HTML 的系统字体栈、字号、字重和层级；按用户裁定仅将 hero 正文行高收紧到 `1.58`，窄屏换行无截断。
- 间距与布局：右侧通用内容标题条已隐藏；文档面顶部 `20px`，封面圆角 `28px`；desktop hero 从约 `355px` 收紧到 `265px`，仍完整显示标题与两段说明。
- 颜色与视觉 token：封面计算样式保留原始 `radial-gradient` 与 `linear-gradient(135deg, #0b1f4d, #1f5bd6 54%, #00a1c9)`，白色文案和右下装饰圆形一致。
- 图片与资产：正文图片、表格和全部内嵌资产来自用户原始 HTML，没有占位图、CSS 仿图或二次生成资产。
- 文案与内容：标题、说明、章节和图表内容来自原始 HTML；只按用户明确要求删除重复眉标“SAPD Wiki 指南”。
- 响应式：`820px` 和 `390px` 下主页面与 iframe 均满足 `scrollWidth === clientWidth`；窄屏隐藏章节侧栏，正文无横向溢出。
- 交互与可访问性：iframe 使用 `aria-label` 保留可访问名称，不再设置会触发 Chrome 原生悬浮标题的 `title`；整页容器不携带 `data-annotation-tooltip` 或 `data-annotation-target-ref`，页面级 Issue 目标仍由 `setCurrentAnnotationTarget` 维护。

## Full-view Comparison Evidence

桌面全屏实现截图显示：SAPD Wiki 主壳、左侧指南目录和右侧完整 HTML 文档面同时存在；悬浮标题和 hero 眉标均不存在；压缩后的封面与第一章开头可同时进入首屏。

## Focused Comparison Evidence

`/private/tmp/sapd-maturity-guide-compact-comparison.png` 将用户问题截图与修复后桌面实现置于同一画面。实现删除悬浮标题和眉标，减少 hero 垂直占用，同时保留渐变方向、浅蓝径向高光、标题层级、正文颜色、圆角和右下装饰圆形。

## Comparison History

1. 用户初始证据：首次点击出现空白，刷新后出现重复标题条，且手工迁移样式不等于原始 HTML。修复为原始 HTML 同源隔离文档面，复用幻灯片两栏布局。
2. 第一轮实现截图 `/private/tmp/sapd-maturity-guide-implementation.png`：发现默认目录选中态触发自动滚动，首屏跳过封面，判定为 P1。修复为“目录选中态”和“用户主动跳转”分离。
3. 第二轮桌面截图与 focused comparison：首屏封面恢复，重复标题条隐藏，首次点击、刷新、目录跳转、桌面和窄屏均通过；无剩余 P0 / P1 / P2。
4. 用户 follow-up 指出整页悬浮标题、重复眉标和 hero 偏高。先修复整页批注锚点误绑定，随后根据用户复验继续移除 iframe 原生 `title`；删除 hero pill，并将 desktop hero 收紧为 `265px`。自定义与原生 tooltip 来源均已清除。

## Open Questions

无设计阻塞。macOS DMG App 本轮未回归，5173 结论不替代下次 DMG 验收。

## Implementation Checklist

- [x] 原始 HTML 保持正文与视觉基线，用户明确裁定的嵌入外观覆盖单独记录。
- [x] 首次点击与刷新态一致。
- [x] 删除右侧重复标题条。
- [x] 保留 6 项章节目录并可跳转。
- [x] 完成桌面、tablet、mobile 和浏览器错误检查。
- [x] 删除整页悬浮标题、hero 眉标并压缩封面高度。

## Follow-up Polish

无阻断性交互或视觉优化项。

final result: passed

---

# Apple Shell 舒适度与成熟度全能力结果 Design QA（2026-07-13）

- visual truth：用户本轮 7 张截图；关键对照为旧标题 `/var/folders/81/8nwy3h2n00s1dw1g5bnvj7j40000gn/T/codex-clipboard-00ba84c2-06bd-46c7-86db-db9bdbd544eb.png`、评分项目上下文 `/var/folders/81/8nwy3h2n00s1dw1g5bnvj7j40000gn/T/codex-clipboard-1086aabe-685b-4101-884b-4349abf66bf8.png`、旧单 L2 四维雷达 `/var/folders/81/8nwy3h2n00s1dw1g5bnvj7j40000gn/T/codex-clipboard-1770208b-9c2f-4e64-b1d7-c7c591a19186.png`。
- implementation：`http://127.0.0.1:5173/#/workbench/maturity/demo-project-002`；应用内浏览器 `1280 × 720`，未启动系统 Chrome。
- after evidence：`/var/folders/81/8nwy3h2n00s1dw1g5bnvj7j40000gn/T/sapd-frontend-regression-2026-07-13/post-overview-apple-shell.png`、`post-scoring-shared-service-tabs.png`、`post-results-all-l2-radar.png`、`post-results-radar-bottom.png`。

## Findings 与验证结论

无剩余 Web P0 / P1 / P2 设计阻塞。

- 标题节奏：该轮先把 `82px / 22px` 恢复到 `96px / 26px`，但后续旧 DMG 精确对照确认 `26px` 仍偏大；当前最终契约已由本文顶部的标题专项 QA 修正为页头 `96px`、标题 `24px`、说明 `12px`、页面 `h1=1`。
- 项目上下文：项目概览、评估模板、评分执行、评分复核、评估结果、报告快照逐项真实点击，六个页面均存在且只存在一条 `.maturity-v5-project-context`，项目名保持一致。
- 结果粒度：雷达契约为 `l2-capability-by-top-category`，32 条轴全部来自后端能力结果，分组为技术 `19`、治理 `1`、管理 `12`；未评分不写 0，精确值可展开核对。
- 共享 Tab：`T-AS.AD-01` 真实 6 个服务使用 `maintenance-section-tabs / maintenance-section-tab`，单行、不压缩业务名称，`scrollWidth=1779 / clientWidth=730` 时只在 Tab 容器内部滚动，页面无横向溢出。
- 目录密度：节点网格不再为已删除状态文字保留固定列宽，状态圆点到层级标签间距 `6px`，层级与名称作为连续信息组呈现。
- 字段边界：主区 14 个禁显字段命中 `0`；应用内浏览器控制台日志为空。
- 浏览器截图中局部半透明层仍可能出现黑块，这是既有内置截图工具合成伪影；DOM、计算样式、交互和自动门禁均未出现对应黑色表面。

final result: passed

---

# 成熟度评估方案 1 与新建退出交接收口 Design QA（2026-07-13）

- visual truth：用户提供的 SERVICE 图 `/var/folders/81/8nwy3h2n00s1dw1g5bnvj7j40000gn/T/codex-clipboard-6a256b44-4caa-4e9b-ba3a-7de302e4eb3d.png`、FOCUS 图 `/var/folders/81/8nwy3h2n00s1dw1g5bnvj7j40000gn/T/codex-clipboard-4dec9f3d-26df-4f5d-a8b8-5526626ed9f2.png` 和旧关闭确认反例 `/var/folders/81/8nwy3h2n00s1dw1g5bnvj7j40000gn/T/codex-clipboard-42039948-a4a6-4b33-861a-e4b925fff3f3.png`。
- implementation：`http://127.0.0.1:5173/#/workbench/maturity` 与 `http://127.0.0.1:5173/#/workbench/maturity/demo-project-001`。
- visual viewport：应用内浏览器 `1486 × 1058`；另检查 `1024 × 900`、`390 × 844`。未启动系统 Chrome。
- SERVICE state：`T-AS.AD 网络安全体系架构管控能力`，左侧当前 L2 的 3 个关注点，右侧 `I-AP&T-AS.AD-01 应用架构管控`。
- FOCUS state：`G-SP.SM 安全战略管理能力`，左侧 `G-SP.SM-01—03`，右侧直接评估 `G-SP.SM-01`。

## Findings

无剩余 P0 / P1 / P2 设计问题。

- 结构：方案 1 的项目内导航、L0 / L1 / L2 能力切换、L2 汇总、聚焦摘要、当前 L2 关注点列表和主评分表单均保持原位置与顺序；SERVICE / FOCUS 使用同一壳和同一控件体系。
- 数据粒度：SERVICE 只显示当前关注点的真实服务评估点；FOCUS 不显示空服务、伪作用域或重复评估对象。前端没有生成 rubric、评分或聚合结果。
- 排版：首轮实现的关注点列表、维度名、当前 rubric、评分依据和目标 / 证据标签仍为 `8—11px`，判定为 P1；修复后计算字号分别为 `13px / 13px / 12px / 10px / 11px`，核心信息恢复到规格的可读层级。
- 主动作：`.maturity-v1-project-page` 滚动到 `422.5 / 423px` 后，评分底部动作保持在视口 `965—1023px`，可继续操作且没有覆盖评分输入。
- 响应式：`1024 × 900` 与 `390 × 844` 均无页面级横向溢出；L2 导航和评分内容只在声明的局部区域处理宽度。
- 字段边界：主展示区对 `sheet / row / column / raw_value / source_file / import_id / source_id / source_ref / source_label / debug / raw / metadata / intermediate / generated_at` 的命中数为 `0`。

## Full-view Comparison Evidence

- SERVICE：`/private/tmp/sapd-maturity-v3-service-comparison-20260713-final.png`，左侧用户图、右侧运行实现。
- FOCUS：`/private/tmp/sapd-maturity-v3-focus-comparison-20260713-final.png`，左侧用户图、右侧运行实现。
- 对照结论：两种状态的页面壳、层级、汇总、左右分栏、评分按钮、评分依据和目标 / 证据区一致；实现新增的跳转、搜索、筛选和文件交换工具条属于三份规格明确允许的 demo 功能迁移，不是未授权重排。
- 应用内浏览器对局部半透明层偶发黑块；该现象与本项目既有截图工具伪影一致，已通过 DOM、计算样式和可见控件交互复核，不作为页面缺陷。

## Focused Comparison Evidence

- SERVICE：`/private/tmp/sapd-maturity-v3-service-focused-comparison-20260713-final.png`。
- FOCUS：`/private/tmp/sapd-maturity-v3-focus-focused-comparison-20260713-final.png`。
- 主动作证据：`/private/tmp/sapd-maturity-v3-service-sticky-footer-20260713.png`、`/private/tmp/sapd-maturity-v3-focus-sticky-footer-20260713.png`。
- 浏览器接口不支持评分区元素级 screenshot，PNG 探测也超时；因此 focused 证据采用同一视口滚动到评分区后的画面对照，并辅以计算样式、滚动坐标和 DOM 断言。

## Comparison History

1. 用户参考图：方案 1 的 SERVICE / FOCUS 完整页面与旧“保留当前填写内容”关闭确认反例。
2. 第一轮运行对照：结构与对象粒度正确，但核心业务信息大量使用 `8—11px`，判定为 P1；主动作位于首屏以下。
3. 第二轮实现：只调整成熟度局部排版、评分底部动作滚动可见性和旧关闭确认残留，不移动方案 1 不可变区；重新载入缓存版本后字号与 sticky 状态生效。
4. 最终对照：SERVICE / FOCUS 同构，主动作滚动后可见，`1024 / 390px` 无页面级横向溢出，无剩余 P0 / P1 / P2。

## Primary Interaction Verification

| 路径 | 结果 | 状态断言 |
|---|---|---|
| 右上角 `X` | 通过 | 浮层关闭、焦点回到 `maturityNewProjectButton`、项目行仍为 `1`、无测试项目 |
| 第一步“取消” | 通过 | 与 `X` 完全相同，不保存草稿、不出现确认层 |
| `Esc` | 通过 | 与 `X` 完全相同，键盘焦点恢复 |
| 背景遮罩 | 通过 | `12,12` 命中 `.maturity-v2-create-scrim`，应用内浏览器真实坐标点击后浮层关闭；locator 的相对位置参数未被该浏览器接口采用，不是页面失败 |

- 旧 `.maturity-v2-close-confirm` 组件、样式与 `createCloseConfirm` 状态均已删除。
- 专项静态审计同时断言关闭按钮、第一步取消、`Esc`、遮罩和无旧确认层。
- 运行页控制台 error 数为 `0`。

## Open Questions

无 Web 设计阻塞。macOS DMG App 本轮未重建、未回归；共享前端修复需在下次发布矩阵中补 App 证据，5173 通过不替代 DMG 验收。

## Implementation Checklist

- [x] SERVICE / FOCUS 独立同构运行状态。
- [x] 同一视口全画面和评分区对照。
- [x] 核心排版 P1 修复并读取计算样式。
- [x] `X / 取消 / Esc / 背景遮罩` 四路径真实回归。
- [x] 1024 / 390px 页面级横向溢出检查。
- [x] 字段边界、控制台错误、专项审计和 maturity smoke。
- [x] 三份成熟度文档同步记录“本轮无业务规则变化”。

final result: passed

---

# 成熟度评估评分执行 Design QA（2026-07-12）

- visual truth：用户提供的层级评分、位置稳定和分层汇总问题截图。
- implementation：`http://127.0.0.1:5173/#/workbench/maturity/demo-project-001`
- viewport：应用内浏览器 `1280 x 720`，未启动系统 Chrome。

## 验证结论

无剩余 P0 / P1 / P2 设计问题。

- 首次进入和刷新只显示 3 个能力 L0，L1 / L2 / 关注点 / 服务均未预展开，页面无横向溢出。
- 按 L0、L1、L2、关注点逐级展开后，层级标题显示当前、目标、完成度和状态；同一关注点下的服务连续排列。
- 关注点统一设置四维 L3、目标 L4 后，5 个适用服务同步带入；1 个不适用服务保持置灰且不计分。
- 单个服务组织维度覆盖为 L1 后，关注点统一值显示“混合”，关注点指数由 `3` 更新为 `2.9`，能力 L2 指数由 `3.35` 更新为 `3.31`。
- 连续下拉重渲染前后，当前控件屏幕位置均为 `812.0859375px`；路由、展开路径和滚动位置未变化。
- 刷新后评分草稿恢复，同时层级回到默认 L0 折叠；恢复演示数据后无控制台错误。

final result: passed

---

# 成熟度方案 2 逐维当前 / 目标评分 Design QA（2026-07-20）

- source visual truth：用户原页面截图 `/var/folders/81/8nwy3h2n00s1dw1g5bnvj7j40000gn/T/codex-clipboard-e9ca2571-588b-412a-8dc5-ccda6e36e24d.png`、对齐 / 文案 / 颜色截图 `/var/folders/81/8nwy3h2n00s1dw1g5bnvj7j40000gn/T/codex-clipboard-0bc65f32-8fc7-483f-9cea-ca466d2869ad.png` 与批量目标严格递增截图 `/var/folders/81/8nwy3h2n00s1dw1g5bnvj7j40000gn/T/codex-clipboard-bcb085be-68ac-4172-93cb-513a4400bece.png`。
- implementation：`http://127.0.0.1:5173/workbench/maturity/demo-project-002` 与可编辑契约样本 `demo-project-001`；应用内浏览器 `2040×1000`，未启动系统 Chrome。
- browser-rendered evidence：`/private/tmp/sapd-target-batch-aligned-gold-20260720.png`、`/private/tmp/sapd-strict-batch-target-20260720.png`。

## Findings

无剩余 Web P0 / P1 / P2 设计阻塞。

- Visual fidelity：保留 SAPD Wiki 现有 Apple Shell、目录、页签、蓝灰色 token、五档矩阵、Rubric 定义盒和评估概览；没有重做页面视觉系统。四个维度均在原评分行内形成“当前状态 / 目标状态”对称双栏。
- Data migration：`demo-project-002` 的旧目标 `L3` 和既有说明自动带入四个目标维度；DOM 实测目标选中值为 `L3 / L3 / L3 / L3`，四个目标说明均保留，旧单一目标控件数量为 `0`。
- Batch setting：原“下级评估设置”卡片内使用“下级当前状态设置 / 下级目标状态设置”；文案固定为“清空下级所有评分 / 清空下级所有目标 / 统一设置下级目标状态”。当前与目标继续独立锁定、统一设置和清空。
- Layout / color：两行共用 `180px 0.7fr / 300px 1.35fr / 310px 1fr` 三列轨道，实测两行 label、slider、actions 的左右边界分别完全一致；目标矩阵、滑块与主按钮为既有金棕 `rgb(163, 104, 31)`，当前状态继续使用 Apple 蓝。目标视口页面横向溢出 `0px`。
- Business guard：逐项编辑继续禁选低于同维度当前状态的目标；批量“统一设置下级目标状态”改为严格递增。`demo-project-002 / T-AS.AM-02` 的下级四维当前最高为 `L4`，目标滑块实测 `min=5 / value=5` 并显示“必须高于…L4”；`demo-project-001 / T-AS.AD-01` 当前最高为 `L5`，目标滑块和统一按钮均禁用并提示“无法统一设置更高目标”。既有目标保留原值，没有静默修改历史数据。
- Runtime：浏览器 console warning / error 为 `0`；验收仅导航、展开和读取 DOM，没有点击评分、清空或保存动作，没有修改演示评分或真实用户数据。

## Validation

- `python3 scripts/audit_maturity_assessment_v2_1_contract.py`：`230 / 230`。
- `python3 scripts/audit_maturity_xlsx_exchange_contract.py`：`21 / 21`，包含“加权目标不低但单维倒退”反例。
- `python3 scripts/audit_maturity_report_surface_parity.py`、P1-5 专项与 `node scripts/run_project_test_suite.mjs --suite static`：通过。
- 参考图与实现截图已在同一比较输入中人工检查；下级原页面与实现截图也已在同一比较输入中核对。

final result: passed

---

# 成熟度目标等级大于等于当前等级规则更正 Design QA（2026-07-20）

- supersedes：上一节“批量目标严格递增”的业务判断已被本次用户更正取代；当前有效规则为“目标等级大于等于当前等级”。
- implementation：`http://127.0.0.1:5173/workbench/maturity/demo-project-002` 与 `demo-project-001`；应用内浏览器 `1280×720`，未启动系统 Chrome。
- browser-rendered evidence：`/private/tmp/sapd-target-gte-current-20260720.jpg`。

## Findings

- 单项评分、复核编辑、关注点统一当前、关注点统一目标和旧版兼容入口均按同一规则执行：目标可等于当前，目标不得低于当前；反向设置当前时，当前可等于已有目标，当前不得高于已有目标。
- `demo-project-002` 当前关注点的下级四维当前最高为 `L4`：目标滑块保持物理 `L1—L5`，业务范围实测为 `L4—L5`，显示“目标状态不能低于下级当前最高等级 L4”；当前滑块上界实测等于已有目标最低等级 `L4`。
- `demo-project-001` 当前关注点的下级四维当前最高为 `L5`：目标滑块业务范围实测为 `L5—L5`、值为 `L5`，显示“目标状态不能低于下级当前最高等级 L5”，证明 `L5→L5` 是合法状态。
- 综合兼容校验改用真实四维指数比较；当前与目标四维完全相同时，`targetBelowCurrent=false`、统计和完成门禁均可通过。
- 页面横向溢出为 `0px`，浏览器 console warning / error 为 `0`。浏览器验收只导航、展开和读取 DOM，没有点击统一设置、清空或保存，没有写入演示评分或真实用户数据。

## Validation

- `python3 scripts/audit_maturity_assessment_v2_1_contract.py`：`231 / 231`，包含前端所有入口与后端相等向量动态用例。
- `python3 scripts/audit_maturity_xlsx_exchange_contract.py`：`22 / 22`，包含逐维当前与目标完全相等的导入用例。
- `node scripts/frontend_smoke_check.mjs --page maturity --route /workbench/maturity/demo-project-002 --url http://127.0.0.1:5173/`：通过。
- 既有报告历史未改写；报告表面巡检发现 `demo-project-002` 一份旧模型历史报告，不属于当前实时评分规则失败。

final result: passed
