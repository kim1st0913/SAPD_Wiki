# Apple 方向配色交接说明（2026-05-29）

本文件用于后续把 SAPD Wiki 前端从当前 Morandi 基线，继续推进到更接近 iOS / macOS 的轻量、明亮、低负担视觉方向。它是颜色和视觉落地交接，不改变数据契约、ETL、业务字段或页面信息架构。

## 当前结论

- 正式页当前已经统一到 Morandi 低饱和基线。
- `apple-morandi-color-demo.html` 是当前前端颜色设计要求的基准样张，不是正式业务页面实现。
- 后续新增或调整前端颜色时，必须先对照该 demo，确保 shell neutral、Apple blue 选中态、tabs、状态徽标、关系 chip、表格行色、标准 / 框架行色、生命周期 tone 和图谱语义色不发生口径漂移。
- 后续推进应先替换全局 token，再逐步治理组件，不建议在组件里零散写局部色值。
- 业务语义颜色必须保留：安全技术服务、模块、措施、当前关注点、管理视角、标准 / 框架不能混成同一种绿色或灰色。

## 可查看入口

- 正式前端：`http://127.0.0.1:5173/`
- Apple 方向 demo：`http://127.0.0.1:5173/apple-morandi-color-demo.html`
- Demo 文件：`frontend/capability-browser/apple-morandi-color-demo.html`
- 正式样式主文件：`frontend/capability-browser/styles.css`
- 显示标签和 chip 类型入口：`frontend/capability-browser/displayLabels.js`

## 设计目标

Apple 方向不是把页面做成系统设置的复制品，而是借鉴这些特征：

- 明亮、干净、低噪音的背景。
- 轻微 tinted neutral，而不是纯白、纯灰或高饱和蓝。
- 选中态明确，普通状态克制。
- 左侧导航可以更像 macOS sidebar，但仍保持企业知识工作台的密度。
- 控件可以更圆润、轻盈，但表格和矩阵不能变成大卡片墙。
- 语义颜色服务于识别关系，不做装饰性渐变。

## 推荐色板

正式页当前使用 OKLCH token，demo 使用更直观的十六进制色。后续推进时建议以 OKLCH token 为准，必要时参考 demo 的观感。

| 语义 | 当前正式 token | Demo 参考色 | 用途 |
|---|---|---:|---|
| 安全技术服务 | `--morandi-blue: oklch(0.49 0.055 224)` | `#5a9fd8` | 服务 chip、技术视角、服务图谱节点 |
| 安全技术模块 | `--morandi-sage: oklch(0.51 0.048 150)` | `#78af92` | 模块 chip、管理视角、模块节点 |
| 安全技术措施 | `--morandi-clay: oklch(0.56 0.054 48)` | `#cf9a75` | 措施 chip、补偿策略、需要区分模块的措施项 |
| 当前关注点 | `--morandi-lavender: oklch(0.53 0.05 300)` | `#8e7ac8` | 图谱中心、当前选择、焦点 halo |
| 标准 / 框架 | `--morandi-sand: oklch(0.68 0.04 76)` | `#c8a15d` | 标准节点、标准映射 chip |
| 环境 / 中性结构 | `--morandi-slate: oklch(0.46 0.025 246)` | `#858a96` | 环境、弱关系、结构层级 L3 |

## 正式页 token 落点

优先维护 `styles.css` 中这些集中位置：

- 颜色 demo 基准：`frontend/capability-browser/apple-morandi-color-demo.html`，用于集中核对所有颜色角色和组件状态。
- 全局语义色：`--morandi-blue`、`--morandi-sage`、`--morandi-clay`、`--morandi-lavender`、`--morandi-sand`、`--morandi-slate`。
- 生命周期 chip：`--lifecycle-service-*`、`--lifecycle-module-*`、`--lifecycle-measure-*`。
- 图谱语义色：`--graph-role-current`、`--graph-role-technical`、`--graph-role-management`、`--graph-role-standard`。
- 图谱层级色：`--graph-node-l1-*`、`--graph-node-l2-*`、`--graph-node-l3-*`。
- 关系 chip：`.relation-chip.service-chip`、`.relation-chip.module-chip`、`.relation-chip.measure-chip`、`.relation-chip.system-chip`、`.relation-chip.environment-chip`。
- 旧矩阵兼容区：`.original-matrix-panel .relation-chip.*`，这里必须和全局 chip 同步。

## 语义映射规则

| 页面对象 | 颜色角色 | 说明 |
|---|---|---|
| 当前关注点 / 当前能力 | Lavender | 图谱中心和当前选中状态，优先级最高 |
| 技术视角 / 安全技术服务 | Blue | 不再使用灰蓝，服务需要和模块明显区分 |
| 管理视角 / 管理关系 | Sage | 可与模块同色系，但模块 chip 要靠边框和背景深度区分 |
| 安全技术模块 | Sage | 比服务更偏绿，和措施不能混 |
| 安全技术措施 | Clay | 用暖 clay，避免继续被看成模块 |
| 标准 / 框架 | Sand / Amber | 标准节点和标准 chip，避免和措施同色 |
| 环境 / 结构 / 弱关系 | Slate / Blue gray | 只做辅助，不抢主语义 |

## 推进顺序

1. 先改全局 token，不先改单个组件。
2. 再改应用壳：topbar、sidebar、搜索框、运行状态按钮、工具按钮。
3. 再改核心控件：tabs、segmented controls、tree row selected state、普通按钮、disabled state。
4. 再改关系组件：relation chip、mapping table、matrix header、empty / missing pill。
5. 再改图谱：图例、节点、边、halo、缩放控件。
6. 最后改 LC-AP、环境映射、维护页等二级页面的局部残留色。

## Apple 方向可以引入的视觉特征

- Sidebar 使用轻微蓝灰 tint，可以参考 demo 的 `--sidebar: rgba(235, 242, 248, 0.72)`。
- 搜索框可以使用系统感圆角和浅灰填充，但不要变成巨大的 hero 搜索。
- 选中态可以使用更明确的 iOS blue，但只用于当前路由、当前树节点或主按钮。
- 面板可以更轻、更透气，但不要使用大面积玻璃模糊覆盖数据表。
- Icon tile 可以用于导航，不建议用于表格行、关系 chip 或每个业务对象。
- 分段控件适合模式切换、视图切换，不替代数据表 tabs。

## 禁止项

- 不使用纯 `#fff` / `#000` 作为新 token。
- 不把所有关系 chip 改成同一种绿色或同一种蓝色。
- 不用高饱和 candy blue、bright green、orange、purple gradient。
- 不做大面积 glassmorphism。可以轻微 translucent，但关系表、矩阵和图谱要保持清晰。
- 不新增营销式 hero、KPI 大卡、嵌套卡片。
- 不在组件中写绕过 token 的局部颜色，除非先补充到设计 token。
- 不改变数据字段、ViewModel 业务整理、ETL 或 `/api/v1/*` 契约。

## 验收清单

视觉验收：

- `apple-morandi-color-demo.html` 能覆盖当前所有前端颜色角色，不只展示单一色板。
- 服务、模块、措施三个 chip 在同一行时能一眼区分。
- 图谱中心、技术、管理、标准四类节点和图例一致。
- L0 / L1 / L2 / L3 在低饱和体系下有明显亮度差。
- LC-AP 当前好看的 chip 观感保留，但已经纳入统一 token。
- 列宽保持收敛，不因圆角和 padding 回到过宽状态。
- 页面仍像工作台，不像营销页或卡片墙。

技术验收：

- `node --check frontend/capability-browser/app.js`
- `node --check frontend/capability-browser/displayLabels.js`
- `node --check frontend/capability-browser/components/LocalRelationNetworkGraph.js`
- `git diff --check`
- `python3 scripts/check_github_data_boundary.py`
- `node scripts/frontend_smoke_check.mjs --page capability --route /capability-mapping --url http://127.0.0.1:5173/`
- `node scripts/frontend_smoke_check.mjs --page environment --route /environment-mapping --url http://127.0.0.1:5173/`
- `node scripts/frontend_smoke_check.mjs --page lifecycle --route /development-security --url http://127.0.0.1:5173/`

旧色扫描建议：

```bash
rg -n "#2563eb|#16a34a|#c56b2c|#0c56d0|#0052cc|#168957|#b86a1f|#6754c8|#e8f0ff|#e8f6ef|#fff3df|#f0edff" frontend/capability-browser/styles.css
```

如果命令没有输出，说明没有发现这批旧高饱和或旧 pastel 色残留。

## 交接给前端的最小任务包

第一步建议只做这些，不做更大结构改造：

1. 把 `apple-morandi-color-demo.html` 中的整体 neutral、sidebar、search、segmented control 观感迁移到 `styles.css` 的全局 token 和 app shell。
2. 只调整颜色、背景、边框、阴影和圆角，不改业务布局和数据读取。
3. 保持关系表、矩阵、图谱的现有 DOM 结构，避免把验证范围扩大。
4. 完成后用上面的三条 smoke 覆盖 `capability`、`environment`、`lifecycle`。

## 当前状态

- `apple-morandi-color-demo.html` 已扩展为当前颜色系统 demo，可通过 `5173` 打开。
- `capability-workbench` 当前 `data_state=ready`。
- 本轮配色交接不需要重新生成数据包。
