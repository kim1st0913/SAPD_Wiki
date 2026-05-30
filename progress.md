# progress.md

本文件是当前会话恢复入口，只保留最近状态、最近完成事项、关键验证和历史索引。完整执行历史已归档到 `docs/05-archive/progress-history/2026-05.md`。

## 当前状态（2026-05-30）

- 当前分支：`main`。
- 当前主线：Frontend Baseline 1.0 四页关系工作台校正；重点仍是业务语义复核、前端关系展示校正、数据契约治理和字段边界收口。
- 固定预览入口：`http://127.0.0.1:5173/`。前端展示和用户验收默认只看该端口。
- 当前前端设计方向：以 `frontend/capability-browser/apple-morandi-color-demo.html` 为正式颜色基准，走 Apple / iOS / macOS shell 风格。
- 当前禁止事项：不修改 ETL、数据库、数据模型、导出 JSON、workbench JSON、`dataClient` 数据来源边界或 ViewModel 业务逻辑；主展示区不得暴露 `sheet`、`row`、`column`、`raw_value`、`source_file`、`import_id`、`source_id`、`source_ref`、`source_label`、`debug`、`raw`、`metadata`、`intermediate`、`generated_at`。

## 最近完成事项

- 2026-05-30 全局侧边栏图标对比度修正：提高左侧一级导航彩色图标中前景图案的对比度，使用白色前景、轻描边和阴影，并单独处理选中态图标内层底色；同步写入全局基线和展示原则，未修改数据链路、ETL、数据库、ViewModel 或导出 JSON。
- 2026-05-30 轻规划 PDF 指南接入：已将 `data/raw-samples/ds design/03 轻规划设计报告模版-v0.3-20250814.pdf` 按现有指南标准导出为 46 张 `2400x1350` 幻灯片，新增 `light-planning.json`，接入 `dataClient`、本地 API、`GUIDE_ROUTE_PACKAGES`、`content-views.json` 和 `/guides/light-planning`；固定端口 `5173` smoke 通过，未绑定 PDF 的其他指南二级页仍保持空状态。
- 2026-05-30 能力映射标题区 L0 编码与统计修正：`安全技术能力 T`、`安全治理能力 G`、`安全管理能力 M` 这类 L0 分类在标题区改为编码位显示 `T/G/M`，标题去掉尾码；右侧轻量统计删除 `标准` 卡，统计网格从 6 格改为 5 格；同步更新脚本和样式缓存版本，未修改数据链路、ETL、数据库、ViewModel 或导出 JSON。
- 2026-05-30 能力映射标题区与四视角 Tab 位置修正：删除关注点标题区的“从当前关注点核对技术、管理和标准 / 框架映射。”说明行，提升标题文字尺寸和位置；为四视角 Tab 与工作台外框增加内侧呼吸位。
- 2026-05-30 能力映射四视角 Tab 视觉收敛：将 `能力关系图谱 / 技术视角 / 管理视角 / 标准 / 框架映射` 局部覆盖为轻量 Apple segmented control，并写入全局基线和展示原则。
- 2026-05-30 业务参考来源展示统一：LC-AP / LC-DT 表格内 `参考来源` 统一为“标签 + 浅色圆角引用框”；补齐 LC-DT `policy.reference` 渲染路径，避免来源裸文本显示。
- 2026-05-30 多 Tab 设计原则补充：全局基线明确视角切换类、阶段序列类、业务分类类和筛选 chip 的不同宽度与信息承载规则。
- 2026-05-30 LC-AP / LC-DT 阶段 Tab 测算等宽修正：阶段 Tab 宽度由当前 AP / DT 阶段组中最长阶段名称和编码测算，箭头移除，保留 hover / click / active 动效。
- 2026-05-30 生命周期 Tab 与能力矩阵交互收口：能力映射技术 / 管理矩阵移除行级 `data-capability-id`，避免点击安全技术服务、模块或措施误触发能力选择 / 能力图谱跳转。
- 2026-05-30 全局字体权重与安全技术服务 chip 统一：全局字体族改为 macOS system UI 优先，标题、导航、Tab、阶段按钮和 chip 字重收敛；安全技术服务统一为浅蓝语义 chip。

## 最近验证

- 2026-05-30 全局侧边栏图标对比度修正验证：`git diff --check` 通过；固定 `5173` 服务状态通过；overview 轻量 smoke 通过；GitHub 数据边界检查通过。
- 2026-05-30 轻规划 PDF 指南验证：`pdftoppm -r 180` 生成 46 张 PNG，首尾页均为 `2400x1350`；`python3 scripts/sapd_wiki.py export-content-views` 后 `html_documents=3`；`node --check` 覆盖 `dataClient.js`、`app.js`、`AppShell.js`、`frontend_smoke_check.mjs` 通过；`python3 -m py_compile src/sapd_wiki/api_server.py src/sapd_wiki/exports.py` 通过；`/guides/light-planning` 浏览器 smoke 通过，`guideThumbs=46`、`guideImageLoaded=true`、`consoleIssues=0`；`/guides/security-governance-model` 仍为空占位页。
- 2026-05-30 能力映射标题区 L0 编码与统计修正验证：`node --check frontend/capability-browser/components/CapabilityLocalRelationMap.js` 和 `node --check frontend/capability-browser/app.js` 通过；`git diff --check` 通过；固定 `5173` 服务状态通过；capability 轻量 smoke 通过；GitHub 数据边界检查通过。
- 2026-05-30 能力映射标题区与四视角 Tab 位置修正验证：`node --check frontend/capability-browser/components/CapabilityLocalRelationMap.js` 通过；`git diff --check` 通过；`node scripts/frontend_smoke_check.mjs --page capability --route /capability-mapping --url http://127.0.0.1:5173/` 通过；固定 `5173` 服务状态通过；GitHub 数据边界检查通过。
- 2026-05-30 能力映射四视角 Tab 视觉收敛验证：`git diff --check` 通过；固定 `5173` 服务状态通过；capability 轻量 smoke 通过；GitHub 数据边界检查通过。
- 2026-05-30 业务参考来源漏点修复验证：`rg` 确认 `policy.reference` 只进入 `sourceNote(policy.reference)`；`node --check frontend/capability-browser/components/ApplicationSecurityLifecycle.js` 通过；`git diff --check` 通过；`/data-security` 轻量 smoke 通过。
- 2026-05-30 全局字体权重与安全技术服务 chip 验证：固定 `5173` 服务状态通过；HTTP smoke 覆盖 `capability /capability-mapping`、`dev-lifecycle`、`maintenance /knowledge/technical-services`、`standards /standards/nist-csf-2` 均通过。

## 当前问题索引

- `OI-112`：全局字段命名与显示样式一致性，已修复。
- `OI-113`：前端整体色系未统一到 Apple / Morandi 体系，已修复并继续做组件级增强。
- `OI-114`：能力关系图谱布局修复尝试造成视觉回退，已回退。
- `OI-115`：刷新后层级能力节点误用默认关注点投影数据，已修复。
- `OI-116`：Apple demo 组件级对齐误伤 LC-AP 阶段 Tab 和模块表默认展开，已修复。
- `OI-117`：安全能力 projection 缺少对象粒度契约，已修复。
- `OI-118`：关注点 projection 前端缺少请求防串包校验，已修复。
- `OI-119`：全局表格字号、空值和安全技术对象 chip 口径不统一，已修复。
- `OI-120`：L0 能力节点在完整 workbench 未返回前显示 0 服务，已修复。
- `OI-121`：能力映射标准表格和管理表格字体口径不一致，已修复。

## 历史索引

| 归档文件 | 内容 |
|---|---|
| `docs/05-archive/progress-history/2026-05.md` | 2026-05 完整执行记录、根目录 `progress.md` 瘦身快照和本轮轻量结构治理记录 |
| `docs/05-archive/findings-history/2026-05.md` | 2026-05 历史发现 |
| `docs/05-archive/context-slimming-2026-05-15/` | 2026-05-15 上下文瘦身快照 |

## 维护规则

- 本文件只保留最近 1-3 次重要执行；超过 120 行时继续归档到 `docs/05-archive/`。
- 详细过程、长命令输出和阶段性历史不写入根目录 `progress.md`。
