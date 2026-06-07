# progress.md

本文件是当前会话恢复入口，只保留最近状态、最近关键动作、验证摘要和历史索引。完整执行历史已归档到 `docs/05-archive/progress-history/`。

## 当前状态（2026-06-07）

- 当前分支：`main`。
- 固定预览入口：`http://127.0.0.1:5173/`。前端展示和用户验收默认只看该端口。
- 当前主控主线：三个 P0 已完成代码闭环。`analytics_summary` 已完成 exporter / audit / `data_package_summary` / `dataClient` / dashboard 消费；`OI-135 + DB-11 + DB-2` 已完成设计、审计脚本、dry-run、临时库 smoke、正式迁移脚本三段式、工作台总览最小 API 和数据篮最小 API；真实基础库 / 用户库未写入，后续 apply 必须显式确认并自动备份。Delivery Bundle / 打包任务继续后排。
- Open Issues 当前未关闭：`OI-038`、`OI-128`、`OI-133`、`OI-135`；`OI-133` 已按用户最新纠偏完成整图优先修复 / 待人工验收，`OI-136` 已修复并归档。
- 当前禁止事项：不默认改 ETL、数据库、数据模型、基础数据包、导出 JSON、用户库数据或业务关系推断；不 `git add .`；主展示区不得暴露 `sheet`、`row`、`column`、`raw_value`、`source_file`、`import_id`、`source_id`、`source_ref`、`source_label`、`debug`、`raw`、`metadata`、`intermediate`、`generated_at`。
- 会话卡顿交接规则已固化：只有用户明确说“当前会话卡顿，需要交接”或等价表达时，Codex 才能自动创建同名递增新线程、写入交接包并在当前会话最终回复后归档；没有明确卡顿交接请求时，不得自动创建新线程。

## 当前子 Agent fan-in（2026-06-06）

- `019e9d71-9d02-7870-bdc6-300f99012487` / Faraday / worker：`completed / fan-in / closed`。
- `019e9d71-9ef8-7861-bd5d-dd1710dbb5a8` / Arendt / explorer：`completed / fan-in / closed`。
- `019e9d61-57ed-74e3-b017-74abb2b650c8` / Ptolemy / explorer：`completed / fan-in / closed`。
- `019e9d61-83d2-7501-9376-170e117a3a66` / Kuhn / explorer：`completed / fan-in / closed`。
- `019e9d61-add5-70f0-8077-e8ee081db5f6` / Nash / explorer：`completed / fan-in / closed`。

## 最近完成事项

- 2026-06-07 按用户最新纠偏继续修正 `OI-133 / ArchiMate 建模语言页`：恢复两层标题结构，最大标题为 `安全架构建模语言`，第二标题为 `ArchiMate® 3.2 - 企业架构建模标准`；tab 组跟在最大标题后面并居右，`全页面显示` / `下载 PDF` 跟在第二标题后面；删除下方 `区域阅读`、区域目录、区域卡片和不精确热区；主体只保留可纵向滚动的整张 ArchiMate Poster；点击图片或 `全页面显示` 时在当前页面内打开 Image Lightbox / Fullscreen Modal，并对预览容器调用 Fullscreen API；不再使用 `window.open`、`target="_blank"`、`Blob` 页面或浏览器原生新窗口 UI；预览层支持右上关闭、Esc 关闭、点击遮罩空白关闭、放大、缩小、适应、鼠标滚轮缩放和按住拖动平移；预览工具栏已删除下载按钮；缩放以适应屏幕后的显示宽度为基准，按钮和滚轮均采用小步进并带宽度过渡，避免第一次操作直接跳成超大图；本地整图预览资源从 PDF 重新导出为 `6741 x 4768` 高分辨率 JPG；正常页面 Poster 去掉多余 padding，让图片与容器宽度贴合。同步 `open-issues.md`、`task_plan.md`、`CURRENT_STATE.md` 和优化计划。本轮不改数据库、ETL、用户库或 `SAPD 元素图例` registry；高分 JPG 位于已忽略前端资源目录，不纳入 Git 提交。
- 2026-06-07 继续微调 `OI-133 / ArchiMate 建模语言页`：第二标题栏 `ArchiMate® 3.2 - 企业架构建模标准` 及 `全页面显示` / `下载 PDF` 操作区改为 sticky 锁定在内容区顶部，避免向下滚动查看 Poster 时标题栏消失。本轮只改 `frontend/capability-browser/styles.css`，不改数据、数据库、ETL 或其他页面。
- 2026-06-07 继续微调 `OI-133 / ArchiMate 建模语言页`：取消外侧内容区滚动条，`content-list` 改为 `overflow: hidden`，页面高度由 `modeling-language-guide-panel` 吃满，只有 Poster viewer 保留 `overflow: auto`。这样页面不再出现外侧和图片容器双滚动条。
- 2026-06-07 修复 `OI-133 / SAPD 元素图例` 滚动回归：前一条单滚动条规则只应作用于 `ArchiMate® 3.2` Poster tab，不能影响 `SAPD 元素图例`。本轮给 `contentWorkspace` 增加 `data-modeling-language-tab` 标记，CSS 按 tab 区分：`overview` 隐藏外层滚动、只保留 Poster viewer 滚动；`elements` 恢复 `.content-list` 外层滚动，分组展开后内容可以撑开并滚动。
- 2026-06-07 修复 dashboard 显示不全回归：前一轮为 ArchiMate 单滚动条增加的通用 `overview-workspace` 高度 / overflow 规则覆盖了工作台总览自身滚动，导致 dashboard 内容被裁切。本轮在更靠后的样式层恢复 `.app-shell-integrated .overview-workspace` 的 `display: block`、`overflow: auto` 和原有内边距，确保 dashboard 使用自身滚动条完整展示。
- 2026-06-07 修复 `OI-133 / SAPD 元素图例` 折叠交互回归：按用户要求元素图例页默认全部收起，移除第一个分组默认 `open`；同时为 `.modeling-legend-section-summary` 增加显式点击与键盘 Enter / Space 切换逻辑，避免当前页面事件链导致原生 `<details>` 展开 / 收起不生效。
- 2026-06-07 继续修正 `OI-133 / SAPD 元素图例` 折叠控制：删除每个图例分组标题右侧的 `展开 / 收起` 文字状态胶囊，仅保留数量和箭头；在 `SAPD 元素图例` 二级标题行右侧新增 `全部展开` / `全部收起` 两个胶囊按钮，统一控制四个图例分组。
- 2026-06-07 固化会话卡顿交接规则：更新 `docs/07-governance/execution-line-convergence-workflow.md`，明确只有用户说“当前会话卡顿，需要交接”或等价表达时，Codex 才能停止当前执行、整理交接包、创建同名递增新线程、写入新线程初始提示并在当前会话最终回复后归档；没有明确卡顿交接请求时，不得自动创建新线程。同步 `CURRENT_STATE.md` 和 `docs/00-overview/master-context-restore.md`。本轮只改治理文档，不改代码、前端、数据库、数据包或用户库。
- 2026-06-07 根目录 `progress.md` 再次瘦身：将 2026-06-05 至 2026-06-07 的长验证清单归档摘要写入 `docs/05-archive/progress-history/2026-06.md`，根目录保留轻量恢复入口。
- 2026-06-07 完成 `OI-133 / ArchiMate 建模语言页` 第一轮页面优化：页面曾从“整页海报 + 6 个区域缩略图”调整为“区域目录 + 当前区域阅读器 + SAPD 映射说明”；该方案已被用户否定，后续热区点击方案也因切割不够精确被暂缓，当前以整图优先和近满屏查看为准。
- 2026-06-07 完成 `OI-128 / OI-135` 工作台总览和数据篮最小 API：`/api/v1/user/workspaces`、`/api/v1/user/data-baskets` 和 `/items` 支持创建、读取、条目 upsert、删除和 token 防护 smoke。真实基础库 / 用户库未写入。
- 2026-06-07 完成 `OI-135 + DB-11 + DB-2` 正式迁移脚本三段式：`scripts/migrate_db_contracts.mjs` 默认 dry-run，只写 `/private/tmp` 复制库；`--apply` 才写目标库，真实项目库写入还需 `--confirm-project-db-write` 并自动备份。
- 2026-06-07 完成 `analytics_summary` P0 代码闭环：exporter、audit、`data_package_summary`、`dataClient.getAnalyticsSummary()` 和 dashboard 消费均已落地；生成 JSON 属于已忽略前端离线数据包，不纳入 Git。

## 最近验证

- 2026-06-07 `OI-133 / ArchiMate` 最新验证：`rg 'download="archimate-poster-overview|下载图片|>下载<|window.open|target="_blank"|createObjectURL|new Blob|Blob\(' frontend/capability-browser/app.js frontend/capability-browser/styles.css` 无命中；`sips -g pixelWidth -g pixelHeight frontend/capability-browser/public/data/guides/archimate-poster/archimate-poster-overview.jpg` 确认为 `6741 x 4768`；`node --check frontend/capability-browser/app.js`、`node --check frontend/capability-browser/components/AppShell.js` 通过；`python3 scripts/dev_server_guard.py --status` 通过，固定 `5173` 单一项目服务健康；`node scripts/frontend_smoke_check.mjs --page content --route /guides/security-architecture-modeling-language --url http://127.0.0.1:5173` 轻量 HTTP smoke 通过，未启动系统 Chrome；内置浏览器检查确认点击 `全页面显示` 后工具栏文本为 `− 适应 ＋` 且下载控件数量为 0，图片自然尺寸为 `6741 x 4768`，初始适应宽约 `984px`，第一次滚轮仅放大到约 `1063px`，再点一次放大按钮约 `1240px`，拖动后滚动位置发生变化，Esc 可关闭并恢复原页面；源码确认 `requestModelingPosterFullscreen()` 会在浏览器提供 `requestFullscreen` 时对预览容器调用 Fullscreen API，内置浏览器运行时本身未暴露该 API，无法在该环境断言 `document.fullscreenElement`；`git diff --check` 通过；`python3 scripts/check_github_data_boundary.py` 通过。
- 2026-06-07 `OI-133 / ArchiMate` sticky 标题栏验证：`node --check frontend/capability-browser/app.js`、`python3 scripts/dev_server_guard.py --status`、`node scripts/frontend_smoke_check.mjs --page content --route /guides/security-architecture-modeling-language --url http://127.0.0.1:5173`、`git diff --check` 均通过；内置浏览器检查确认 `.modeling-language-guide-header` 为 `position: sticky`，滚动查看时标题栏保持在内容区顶部。
- 2026-06-07 `OI-133 / ArchiMate` 单滚动条验证：`node --check frontend/capability-browser/app.js`、`node scripts/frontend_smoke_check.mjs --page content --route /guides/security-architecture-modeling-language --url http://127.0.0.1:5173`、`git diff --check` 均通过；内置浏览器检查确认外层 `.content-list` 为 `overflowY: hidden` 且 `scrollHeight == clientHeight`，Poster viewer 为 `overflowY: auto` 且只保留图片内部滚动。
- 2026-06-07 `OI-133 / SAPD 元素图例` 滚动验证：`node --check frontend/capability-browser/app.js`、`python3 scripts/dev_server_guard.py --status`、`node scripts/frontend_smoke_check.mjs --page content --route /guides/security-architecture-modeling-language --url http://127.0.0.1:5173`、`git diff --check` 均通过；内置浏览器检查确认切到 `SAPD 元素图例` 后 `.content-list` 为 `overflowY=auto`，分组展开时内容高度可超过容器高度并触发滚动。
- 2026-06-07 dashboard 显示不全回归验证：`git diff --check -- frontend/capability-browser/styles.css`、`python3 scripts/dev_server_guard.py --status` 均通过；内置浏览器检查 `http://127.0.0.1:5173/` 确认 `#overviewWorkspace` 为 `overflowY=auto`、`scrollHeight=2395` 大于 `clientHeight=560`，滚动后 `scrollTop` 从 `0` 到 `900`，页面整体 `documentScrollTop` 保持 `0`。
- 2026-06-07 `OI-133 / SAPD 元素图例` 折叠交互验证：`node --check frontend/capability-browser/app.js`、`node scripts/frontend_smoke_check.mjs --page content --route /guides/security-architecture-modeling-language --url http://127.0.0.1:5173`、`git diff --check -- frontend/capability-browser/app.js` 均通过；内置浏览器检查确认进入 `SAPD 元素图例` 后四个分组默认 `open=false`，点击第一个标题后变为 `open=true`，再次点击恢复 `open=false`。
- 2026-06-07 `OI-133 / SAPD 元素图例` 总控验证：`node --check frontend/capability-browser/app.js`、`node scripts/frontend_smoke_check.mjs --page content --route /guides/security-architecture-modeling-language --url http://127.0.0.1:5173`、`git diff --check -- frontend/capability-browser/app.js frontend/capability-browser/styles.css` 均通过；内置浏览器检查确认分组内 `.modeling-legend-section-state` 数量为 `0`，二级标题行右侧存在 `全部展开` / `全部收起`，点击后四个图例分组可全部 `open=true` / 全部 `open=false`。
- 2026-06-07 会话卡顿交接规则固化验证：`rg '当前会话卡顿，需要交接|同名递增|不得自动创建新线程|交接包' CURRENT_STATE.md docs/00-overview/master-context-restore.md docs/07-governance/execution-line-convergence-workflow.md progress.md -n` 通过；`git diff --check -- CURRENT_STATE.md docs/00-overview/master-context-restore.md docs/07-governance/execution-line-convergence-workflow.md progress.md docs/05-archive/progress-history/2026-06.md` 通过。
- 2026-06-07 `OI-133 / ArchiMate`：`node --check frontend/capability-browser/app.js`、`python3 scripts/dev_server_guard.py --status`、`node scripts/frontend_smoke_check.mjs --page content --route /guides/security-architecture-modeling-language --url http://127.0.0.1:5173`、`git diff --check -- frontend/capability-browser/app.js frontend/capability-browser/styles.css` 均通过；未启动系统 Chrome。
- 2026-06-07 `AN-SUM-DASHBOARD`：`node --check frontend/capability-browser/app.js`、`node scripts/audit_analytics_summary_contract.mjs`、`node scripts/frontend_smoke_check.mjs --page overview --url http://127.0.0.1:5173`、`python3 scripts/check_github_data_boundary.py`、`git diff --check` 均通过。
- 2026-06-07 `OI-135 / DB-2`：`node --check scripts/migrate_db_contracts.mjs`、默认 dry-run、临时库 apply、迁移后 `audit_user_db_governance_contract.mjs --require-v03` 和 `audit_stable_key_contract.mjs` 均通过；真实项目库 `--apply` 被确认门拦截。
- 2026-06-07 数据篮 API：`python3 -m py_compile scripts/run_local_server.py`、`node --check scripts/smoke_user_data_basket_api.mjs`、`node scripts/audit_user_db_governance_contract.mjs`、`node scripts/smoke_user_data_basket_api.mjs` 均通过，真实项目库未写入。
- 2026-06-06 `OI-136 / FE-ROUTE`：`node --check scripts/frontend_smoke_check.mjs`、`node --check frontend/capability-browser/app.js`、`python3 scripts/dev_server_guard.py --status` 和三类深层路由轻量 HTTP smoke 均通过；本轮未启动系统 Chrome。

## 当前问题索引

- `OI-038`：Gartner 与安全职能候选映射需后续人工校对，状态 `待确认`。
- `OI-128`：USER-WRITE-UI-1：批注 / 工作台用户写入入口，状态 `部分完成`；`OI-128A/B/C` 已实现，`OI-128C` 已基本验收。
- `OI-133`：ArchiMate 建模语言页显示效果与加载效率优化，状态 `已修复 / 待人工验收`；当前已按用户最新纠偏改为整图优先、上方 tab、可滚动 Poster 和页面内 Image Lightbox / Fullscreen Modal，不做不精确热区，不打开新窗口或 `Blob` 页面。
- `OI-135`：用户库治理与兼容表迁移清理，状态 `正式迁移脚本完成 / 真实库 apply 待显式确认`。
- `OI-136`：深层路由直接访问未加载前端样式，状态 `已修复 / 已归档`。

## 历史索引

| 归档文件 | 内容 |
|---|---|
| `docs/05-archive/progress-history/2026-06.md` | 2026-06 完整执行记录、Open Issues 治理、前端治理、数据口径确认和本轮 progress 瘦身摘要 |
| `docs/05-archive/progress-history/2026-05.md` | 2026-05 完整执行记录、根目录 `progress.md` 瘦身快照和结构治理记录 |
| `docs/05-archive/findings-history/2026-05.md` | 2026-05 历史发现 |
| `docs/05-archive/open-issues-history/2026-06.md` | 已关闭 Open Issues 长记录 |
| `docs/05-archive/context-slimming-2026-05-15/` | 2026-05-15 上下文瘦身快照 |

## 维护规则

- 本文件只保留最近状态、最近 5-10 条重要执行和恢复入口；超过 120 行时继续归档到 `docs/05-archive/progress-history/`。
- 详细过程、长命令输出和阶段性历史不写入根目录 `progress.md`。
