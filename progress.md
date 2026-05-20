# progress.md

本文件是当前会话恢复入口，只保留最近状态和历史索引。完整执行历史已归档到 `docs/05-archive/progress-history/2026-05.md`。

## 当前状态（2026-05-20 22:45:18）

- 当前分支：`codex-frontend-backend-separation-closure`。
- 当前重点：安全能力映射前端体验、标准 / 框架数据映射收口，以及 Codex 轻量开发与验证机制落地。
- 本地预览：`127.0.0.1:5174` 项目服务已由 `scripts/dev_server_guard.py --port 5174 --start` 拉起，用于安全能力映射验证。
- 注意：当前工作区已有多项未提交业务改动；继续开发前应先用轻量摘要确认范围，避免全量 diff 和大文件输出。

## 最近完成事项

### 2026-05-20 安全能力映射图谱自适应星形布局再评估

- 仅处理 `安全能力映射` 的 `能力关系图谱`，未修改原始 Excel、ETL、schema、数据库或 `public/data/*.json`。
- `LocalRelationNetworkGraph.js` 已移除技术 / 管理 / 标准按类型绑定的固定坐标锚点，改为只固定当前关注点，其余业务节点统一使用确定性 force 布局。
- 新布局统一使用连线距离、节点排斥、碰撞整理、弱中心力、径向层级力和边界留白，不再按技术视角、管理视角、标准 / 框架映射写死角度或树杈扇区。
- 保留缩放、拖拽平移、装饰灰点不渲染、空节点不显示，以及节点文案不显示 `能力-关注点`。
- 右边缘节点标签改为自动向左对齐，避免长业务名称贴边或被裁剪。
- 已提升 `app.js` 动态加载图谱相关资源版本，避免浏览器继续命中旧缓存。
- 能力目录文字显示已收紧：`DimensionTree.js` 将编号和标题合并为文字组，`styles.css` 减少层级缩进和列间距，关注点长标题改为编号下方显示，避免标签、编号、标题之间出现大块空白。
- 安全能力映射工作台头部已重排：当前关注点详情和图二统计上移到工作台头部，移除“当前关注点工作台”、路径 chip 和图三旧统计；6 个统计块在右侧单行排布，搜索框位于统计下方，说明文字向右延展并完整落在 112px 头部内。
- 能力目录收起态已优化：收起后左侧目录列为 `0px`，目录内容完全隐藏，仅在关系区左侧保留竖向“目录”展开标签；标签不会遮挡头部内容。
- 能力关系图谱文字显示已优化：节点标签缩短为最多两行，扩大标签碰撞半径，减少图谱内长标准 / 职能名称互相穿插。
- 已修复 `OI-060` / `OI-062`：能力目录支持分类、L1、L2 逐级展开，分类标签显示为 `L0`；图谱改为分层策略，L0 展示能力-关注点结构，L1 / L2 展示关注点映射概览，L3 具体关注点保留完整图谱。浏览器验证：L0 `安全技术能力 T` 显示 19 个能力和 63 个关注点，L1 `T-AS` 显示 27 个关注点及作用域、服务、L2流程组、安全工作、标准 / 框架种类。

### 2026-05-20 `OI-056` 标准 / 框架空映射收口

- 复核 `data/raw-samples/wiki sample.xlsx` 中 `安全能力-网络安全制度、框架映射`、6 组标准框架 Sheet 和当前 `capability-workbench.json`，确认 `T-AS.DG-03` 原始映射行为空。
- 已备份原始表到 `data/raw-samples/backups/wiki sample.before-t-as-dg-03-standard-mapping-20260520.xlsx`。
- 已为 `T-AS.DG-03 确保数据的可靠性与可恢复性` 补入数据备份、数据恢复、备份保护和恢复完整性相关映射：ISO 3 条、CSF 2 条、等保 4 条、CIS 5 条、CRF 5 条、NIST 13 条。
- 已同步更新各标准框架 Sheet 的 `关联安全能力/关注点` 列；NIST 800-53 Rev.5 按用户确认支持 enhancement 级映射，有具体增强项时显示增强项，没有具体增强项时才显示父控制项。
- 根据用户确认，NIST 800-53 Rev.5 已进一步支持 enhancement 级映射：`T-AS.DG-03` 的 NIST 映射从父控制项 3 条扩展为 13 条，包含 `CP-6(2)`、`CP-9(1)` 至 `CP-9(8)`、`CP-10(2)`、`CP-10(4)` 等具体增强项。
- 已把全量 capability-first NIST 映射同步投影到 `NIST 800-53rev5` Sheet 的 `关联安全能力/关注点` 列；用户已把历史错误编码修订为 `M-PS.CT-01/02`，本轮随后重跑 core 与 standard 导入，使双向校验闭合。
- 已备份原始表到 `data/raw-samples/backups/wiki sample.before-oi-056-empty-mapping-followup-20260520.xlsx`，并继续处理剩余空映射：补齐 `T-IN.IP-01` 4 条、`M-PS.HS-02` 8 条；在映射表末尾补入缺失行 `T-PD.TP-05` 15 条。
- `T-OF.AT-01/02/03` 保持空映射：原始能力说明属于进攻反制并注明“民间机构不适用”，现有标准框架不强行挂防御类控制项。
- 已重跑标准框架 staging / approve，并重新导出 `frontend/capability-browser/public/data/standards-data.json` 与 `frontend/capability-browser/public/data/capability-workbench.json`；`OI-056` 已同步更新。
- 已修复 `OI-057`：能力关系图谱标准 / 框架节点原先只显示泛化节点，是因为 `relationGraphModel.js` 不识别 `standardTableRows` 的 `standard` 字段，且没有把标准框架继续连到条款 / 控制项；现已展开到控制项节点，并更新 `app.js` 资源版本。
- 已修复 `OI-058` / `OI-059` / `OI-061` / `OI-063`：标准 / 框架映射与能力关系页签统计口径已收口；技术视角 `技术模块/措施` 列不再折叠；具体关注点图谱的标准框架和控制项完整展示，`T-AS.AD-01` 浏览器验证为 6 个框架、35 个控制项、NIST 800-53 15 条。

### 2026-05-20 安全能力映射图谱自适应与缩放修正

- `能力关系图谱` 从固定角度 / 树杈式布局改为自适应力导向星形排布，技术视角、管理视角和标准 / 框架映射统一使用同一套布局原则。
- 默认图谱视窗改为完整画布 `0 0 1680 940`，避免初始状态裁切星形分布；局部查看通过拖拽和缩放完成。
- 新增图谱 `+ / - / 1:1` 缩放控制，并支持滚轮缩放；保留按住鼠标拖拽平移。
- 空占位 / 装饰灰点继续不渲染；当前节点文案保持业务名称和编号，不再显示 `能力-关注点`。
- 本轮未修改 ETL、数据包、schema 或原始数据文件。

### 2026-05-20 标准 / 框架映射 tooltip 与编号展示优化

- 优化能力页“标准 / 框架映射”中标准条目编号 chip：主界面只显示条款 / 控制项编号，细节改由浅色悬浮气泡展示。
- 将悬浮气泡从 CSS 伪元素改为全局浮层，避免被标准表格和能力映射表的滚动容器裁剪；底色改为浅色，支持较长内容滚动查看。
- 标准 / 框架页面的“关联安全能力/关注点”列改为仅显示关注点编号；鼠标悬停或键盘聚焦时显示关注点所属分类、能力、标题和描述。
- 调整“关联安全能力/关注点”悬浮气泡格式为四行：能力域路径、能力编号与名称、关注点编号与名称、关注点内容，避免把关注点编号放到气泡最前导致层级混乱。
- 保持 `参考要求` 等衍生字段不在主展示区输出；本轮未改原始 Excel、未改 schema、未重做导入。

### 2026-05-20 Codex 轻量开发与验证机制

- 新增 `docs/07-governance/codex-performance-workflow.md`，定义短指令默认执行、轻量恢复、前端 smoke、数据包摘要和重连减负流程。
- 新增 `scripts/dev_server_guard.py`：只检查指定端口，识别项目服务和重复静态服务，并输出短 JSON 摘要。
- 新增 `scripts/data_package_summary.py`：对前端数据包输出大小、状态、统计、顶层字段和非业务字段命中摘要，不打印完整 JSON。
- 新增 `scripts/frontend_smoke_check.mjs`：用 Chrome headless 做页面 smoke，输出 console、横向溢出、关键节点和截图路径摘要。
- 更新 `AGENTS.md`、`CURRENT_STATE.md`、`docs/07-governance/governance-index.md`，让后续“继续执行 / 执行 / 排查一下 / 修一下”默认遵守轻量协议。
- 已将本次瘦身前 `progress.md` 快照追加到月度归档，根目录 `progress.md` 保持轻量。

## 最近验证

- 临时静态预览 + 本机 Chrome headless 回归：`能力关系图谱` 可渲染；业务节点 `41`；`data-layout-overlaps=0`；`data-layout-min-gap=22`；装饰节点 `0`；空文本节点 `0`；禁止字段命中 `0`；缩放控件 `3` 个，点击放大后 `network-pan-layer` 为 `translate(0 0) scale(1.16)`。
- 本机 Chrome headless 复核工作台头部：当前关注点详情位于 `.capability-focus-head-slot`，关系卡片内不再保留 `.preview-focus-strip`；旧标题未出现，路径 chip 隐藏，搜索框居中，统计右侧上三下三排布；描述全文位于头部内，页面横向溢出 `0`。
- 本机 Chrome headless 复核目录收起和图谱文字：收起后 grid 为 `0px 1192px`，目录树可见行 `0`，竖向“目录”标签可见且不遮挡头部；图谱最大标签长度 `14`，多行标签 `18`，页面横向溢出 `0`。
- 说明：静态预览模式下 `/api/v1/*` 请求返回 404 后按 `dataClient` fallback 加载本地 JSON，浏览器 console 会出现静态服务 404 记录；这不是本轮图谱代码错误。本轮已停止临时 `5175` / `5176` 验证服务。

- `openpyxl` 复核：`T-AS.DG-03` 原始映射行已补齐，位于第 31 行；映射分布为 ISO 3、CSF 2、等保 4、CIS 5、CRF 5、NIST 13；NIST `CP-6`、`CP-6(2)`、`CP-9`、`CP-9(1)` 至 `CP-9(8)`、`CP-10`、`CP-10(2)`、`CP-10(4)` 的 `关联安全能力/关注点` 均包含 `T-AS.DG-03`。
- `openpyxl` 复核：当前原始表未再命中点号版历史错误编码，并可命中修订后的 `M-PS.CT-01/02`。
- `python3 scripts/sapd_wiki.py stage-excel 'data/raw-samples/wiki sample.xlsx' --sheets core --sensitive-level confidential --json`：通过，job `f638eb81-d1ae-4e6d-8d62-1a383af8f484`，`objects_staged=630`、`relations_staged=2319`、`validations=[]`。
- `python3 scripts/sapd_wiki.py approve-import f638eb81-d1ae-4e6d-8d62-1a383af8f484 --json`：通过，`items_created=2`、`items_updated=628`、`items_deprecated=2`、`relations_created=3`、`warnings=[]`。
- `python3 scripts/sapd_wiki.py export-capability-tree`：通过，`focuses=91`、`focus_scope_mappings=379`、`unlinked_focuses=0`。
- `python3 scripts/sapd_wiki.py stage-excel 'data/raw-samples/wiki sample.xlsx' --sheets standard-framework --sensitive-level confidential --json`：通过，最新 job `beab43c1-845d-4311-af61-16d1bd9cde9f`，`objects_staged=1964`、`relations_staged=1957`、`validations=[]`。
- `python3 scripts/sapd_wiki.py approve-import beab43c1-845d-4311-af61-16d1bd9cde9f --json`：通过，`items_updated=1964`、`warnings=[]`。
- `python3 scripts/sapd_wiki.py export-standard-frameworks-data`：通过，`frameworks=6`、`controls=1957`。
- `python3 scripts/sapd_wiki.py export-capability-workbench`：通过，`standard_control=1650`、`relations=5898`。
- `T-AS.DG-03` 数据包复查：`maps_to_standard=32`，框架分布为 ISO 3、CSF 2、等保 4、CIS 5、CRF 5、NIST 13；`CP-9(1)`、`CP-9(2)`、`CP-9(8)`、`CP-10(4)` 均可在能力工作台映射中命中。
- `OI-056` 剩余项复查：`T-PD.TP-05 maps_to_standard=15`、`T-IN.IP-01 maps_to_standard=4`、`M-PS.HS-02 maps_to_standard=8`；`T-OF.AT-01/02/03 maps_to_standard=0`，按进攻反制不适用口径保留空映射。
- NIST enhancement 双向校验：`standardMappingValidation` 显示 `missingControls=0`、`unmatchedFocuses=0`、`missingInStandardProjection=0`、`extraInStandardProjection=0`。
- `T-AS.AD-01` 标准映射统计复核：真实标准框架 6 个、控制项 35 条，旧徽标 41、旧可见条款 24；修复后徽标应显示 35，表格展示全部 35 条控制项。
- `python3 scripts/data_package_summary.py --package standards`：通过，`data_state=ready`，6 个框架、1957 条控制 / 层级记录。
- `python3 scripts/data_package_summary.py --package capability-workbench`：通过，`standard_control=1650`；该包未声明 `data_state`，脚本显示 `unknown`。
- `python3 -m py_compile src/sapd_wiki/exports.py`：通过。
- `node --check frontend/capability-browser/components/LocalRelationNetworkGraph.js frontend/capability-browser/app.js`：通过。
- `git diff --check`：通过（2026-05-20 图谱自适应与缩放修正后复查）。
- 非业务字段泄露检查：`能力关系图谱` 文本未命中 `sheet`、`row`、`column`、`raw_value`、`source_file`、`import_id`、`source_id`、`source_ref`、`source_label`、`debug`、`raw`、`metadata`、`intermediate`、`generated_at`。
- 能力数据包摘要：`data_state=ready`，`categories=3`、`domains=10`、`capabilities=32`、`focuses=91`、`services=157`、`focus_scope_mappings=379`、`unlinked_focuses=0`。
- `node --check frontend/capability-browser/app.js`：通过。
- `node --check frontend/capability-browser/components/CapabilityLocalRelationMap.js`：通过。
- `node --check frontend/capability-browser/components/StandardFrameworkTable.js`：通过。
- `node -e "... M-SA.CO-02 ..."`：抽样确认关注点 tooltip 输出为四行结构：`安全管理能力-安全支撑与资源保障 Supportance and Assurance`、`M-SA.CO-安全协同能力`、`M-SA.CO-02-对外部通报进行响应、处置与反馈`、关注点内容。
- `git diff --check -- frontend/capability-browser/index.html frontend/capability-browser/app.js frontend/capability-browser/components/CapabilityLocalRelationMap.js frontend/capability-browser/components/StandardFrameworkTable.js frontend/capability-browser/styles.css`：通过。
- `rg -n "title=|data-tooltip|floating-standard-tooltip|#253044|问号|cursor: help" ...`：确认 tooltip 使用 `data-tooltip` 与浅色浮层，未保留原生 `title=`、深色底和问号光标。
- `node scripts/frontend_smoke_check.mjs --page standards --url http://127.0.0.1:5175/ --debug-port 9345`：未通过，原因是当前未提供可连接的 Chrome DevTools target；临时静态服务已停止，未留下本轮启动的后台服务。
- `python3 -m py_compile scripts/dev_server_guard.py scripts/data_package_summary.py`：通过。
- `node --check scripts/frontend_smoke_check.mjs`：通过。
- `python3 scripts/data_package_summary.py --package standards`：通过，`data_state=ready`，标准框架 6 个，控制 / 层级记录 1957 条。
- `python3 scripts/dev_server_guard.py --port 5174 --status`：普通沙箱下可降级返回 `warn`，提升权限后识别项目服务并返回 `pass`。
- `node scripts/frontend_smoke_check.mjs --page overview --url http://127.0.0.1:5174/ --debug-port 9344`：通过，`consoleIssues=0`，`bodyOverflowX=0`。
- `git diff --check`：通过。

## 历史索引

| 归档文件 | 内容 |
|---|---|
| `docs/05-archive/progress-history/2026-05.md` | 2026-05 完整执行记录与根目录 `progress.md` 瘦身快照 |
| `docs/05-archive/findings-history/2026-05.md` | 2026-05 历史发现 |
| `docs/05-archive/context-slimming-2026-05-15/` | 2026-05-15 上下文瘦身快照 |

## 维护规则

- 本文件只保留最近 1-3 次重要执行和当前恢复信息。
- 超过 120 行时继续归档到 `docs/05-archive/`。
- 详细过程、长命令输出和阶段性历史不写入根目录 `progress.md`。
