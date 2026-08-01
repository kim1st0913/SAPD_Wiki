# `styles.css` P1 优化计划

> 状态：`web_verified / app_pending`
>
> 日期：2026-07-29
>
> 影响面：`shared runtime`（Web 与 App 共用前端样式）

## 1. 目标与原则

本计划只处理 `frontend/capability-browser/styles.css` 中已经确认的三类 P1 债务：

1. 共享选择器被多轮后置规则反复覆盖；
2. 生命周期区域依赖大量 `!important` 维持最终状态；
3. 同一 owner 的响应式规则分散在多个相同或相邻断点。

执行优先级服从两个硬条件：

- 系统功能、路由、交互、数据和用户状态必须保持不变；
- CSS 体积、选择器复杂度、浏览器样式计算和页面渲染性能不得变差。

行数下降和固定压缩比例都不是目标。只有能够通过静态层叠证明确认“删除前后获胜
声明完全相同”的规则才允许删除；无法证明时保持原样，不以浏览器抽样通过代替
静态等价证明。

## 2. 当前证据

| 指标 | 当前值 | P1 判断 |
|---|---:|---|
| 文件规模 | 32,178 行，约 752 KB | 规模本身不构成修复理由 |
| 重复选择器名 | 1,030 个 | 只处理跨 owner 或后置覆盖形成的高风险组 |
| `!important` | 322 个 | 生命周期后置覆盖区最集中，优先处理 |
| `@media` | 54 个 | `1180 / 1440 / 1500 / 1800px` 等条件分散 |
| `:root` 块 | 11 个 | 属于 P2 token 治理，本计划不处理 |

已确认的高风险选择器：

- `.app-shell.app-shell-integrated`：22 次；
- `.app-shell-integrated .capability-workspace`：16 次；
- `.topbar`：14 次；
- `.dev-lifecycle-workspace .lifecycle-stage-tabs`：12 次；
- `.dev-lifecycle-workspace .lifecycle-stage-tabs .lifecycle-nav-row`：15 次。

## 3. 范围与非目标

### 本轮范围

- 生命周期和 Apple Shell 中完全重复或被无条件覆盖的失效声明；
- 删除后不改变任何获胜声明的完整失效规则块；
- 为防止重复回归而增加的只读 CSS 结构审计。

### 明确不做

- 不改 DOM、JavaScript、路由、搜索、滚动、评分、数据或用户状态逻辑；
- 不改 `:root` token、颜色体系、圆角体系或页面视觉方向；
- 不批量删除全部 `!important`，不碰批注选区、底图等已知保护规则；
- 不重命名共享 class，不拆分新的 CSS 架构，不引入预处理器或构建链；
- 不移动任何仍生效的声明，不跨文件迁移规则，不改变 stylesheet 加载顺序；
- 不合并非相邻 `@media`，不调整断点，不改变 selector specificity 或 source order；
- 不修改成熟度专用样式、Draw.io/SVG、正式数据、源 Excel、SQLite 或用户库；
- 不为本项单独构建 DMG；App 实包验收并入下一次最新打包矩阵。

## 4. 执行顺序

### CSS-P1-A：只读建立层叠清单

在删除任何规则前，建立可重复比较的层叠清单：

1. 记录目标选择器的 stylesheet、source order、at-rule ancestry、specificity、
   `!important`、简写/长写关系、状态伪类和最终获胜声明；
2. 在代表路由记录 `getComputedStyle`、关键元素 `getBoundingClientRect()`、
   横纵向 overflow、滚动 owner、console error/warning；
3. 记录 CSS 响应字节数、规则数、选择器数，以及同机同服务下重复页面渲染结果；
4. 保存目标规则计数和 `!important` 计数，作为优化前基线。

最小代表矩阵：

| owner | 代表路由 | 必测视口 |
|---|---|---|
| 生命周期 | `/development-security`、`/data-security` | `1920×1080`、`1440×900`、`1181×800`、`1180×800` |
| 共享壳 | `/`、`/capability-mapping`、`/workbench/annotations`、`/settings/system` | `1920×1080`、`1024×768` |
| 断点负向检查 | `/capability-mapping`、`/development-security` | `1181×800`、`1180×800`、`390×844` |

基线阶段不修改生产文件。当前 `app.js / index.html` 已有另一批本地变更；
后续 CSS cache tag 必须作为同一交付包的原子更新，在单一写者下手工合并，不能覆盖
现有修改，也不能发布“新 CSS + 旧 cache tag”或“旧 CSS + 新 cache tag”的组合。

### CSS-P1-B：筛选允许删除的规则

候选规则必须先满足以下全部条件，才进入修改：

1. 删除项与后置获胜项具有完全相同的 selector list、at-rule 条件和状态条件；
2. 每个被删除属性都被后置规则以相同或更高 importance 无条件覆盖；
3. 不涉及 shorthand/longhand 交叉、`all`、`revert`、`unset`、CSS 变量定义、
   animation/keyframes、伪元素或动态插入 stylesheet；
4. 删除不改变任意 viewport、路由、交互状态下的获胜声明；
5. 规则不是 fallback、兼容性分支、reduced-motion、打印样式或无障碍保护；
6. 对“当前 DOM 未命中”的规则不做死代码推断，因为它可能由路由或交互动态生成。

允许修改的类型仅有两种：

- 同一 stylesheet、同一 at-rule 中完全相同的重复声明；
- 每个属性都能静态证明被后置同条件规则无条件覆盖的完整失效规则块。

以下候选一律拒绝：

- 需要把有效声明迁入 `p1-lifecycle-workbench.css` 才能删除的规则；
- 需要降低或取消仍生效 `!important` 的规则；
- 需要提高 specificity、改变 selector 或新增覆盖规则才能达到目标的规则；
- 仅凭截图、当前 DOM 未命中或单个 viewport 判断“无用”的规则。

### CSS-P1-C：按风险分批执行纯删除

执行仍按生命周期、Apple Shell 的顺序，但每批只做已经通过 CSS-P1-B 的纯删除：

1. 生命周期：只删 `styles.css` 内静态证明失效的完整声明或规则块；
2. Apple Shell：只删 `.topbar`、`.app-shell.app-shell-integrated`、
   `.app-shell-integrated .capability-workspace` 中同样可证明失效的内容；
3. 每个选择器单独形成 diff 和前后层叠清单，验证通过后再进入下一个；
4. 不移动剩余规则，不整理注释，不格式化无关代码，不顺带处理相邻 debt。

本轮取消原来的选择器次数和 `!important` 降幅目标。最终可能只安全删除少量规则，
也可能一个都不能删除；这仍然是合格结果，不能为了优化数字引入功能或性能风险。

响应式断点碎片化本轮只审计、不修改。非相邻 media 合并会改变 source order，不能
满足零影响要求，因此移出本 P1 执行范围。

## 5. 每批验证与停止条件

每个执行包独立验证，上一包通过后才进入下一包。

### 自动门禁

```bash
node scripts/audit_frontend_p0_2_apple_shell_layout_contract.mjs --url http://127.0.0.1:5173
node scripts/audit_frontend_p1_2_canvas_workbench_contract.mjs --url http://127.0.0.1:5173
node scripts/audit_frontend_p1_3_lifecycle_workbench_contract.mjs --url http://127.0.0.1:5173
node scripts/audit_frontend_p1_4_reference_tables_contract.mjs --url http://127.0.0.1:5173
node scripts/audit_frontend_scroll_contract.mjs
node scripts/audit_frontend_governance.mjs
```

集成快照再运行：

```bash
node scripts/run_project_test_suite.mjs --suite frontend --url http://127.0.0.1:5173
node scripts/run_project_test_suite.mjs --suite pre-commit --url http://127.0.0.1:5173
git diff --check
```

已存在且与本 CSS 变更无关的 pre-commit 阻断项必须单独记录，不能通过扩展本方案
顺手修改。

### 浏览器验收

- 生命周期：阶段切换、搜索、横向滚动、LC-AP/LC-DT 内容、滚动 owner 不变；
- 共享壳：导航展开、当前项可见、页头、辅助列、segmented、Issue 和设置入口不变；
- 目标矩阵中页面横向溢出为 0，console error/warning 不新增；
- 删除规则覆盖到的每个现存元素，其完整 `getComputedStyle` 快照必须相同；
- 关键元素几何、scrollWidth/scrollHeight、滚动位置和可见状态必须相同；
- hover、focus、active、selected、展开/收起和 reduced-motion 状态必须抽样；
- 抗锯齿造成的截图像素差不作为单独失败，但任何可见位移、换行、遮挡、颜色、
  动效或滚动变化都失败。

### 性能门槛

- CSS 响应字节数、规则数、选择器数和 selector complexity 均不得增加；
- 修改必须是纯删除，禁止通过新增规则、脚本或更复杂选择器补偿；
- 同机重复测量出现任何可复现的样式计算或渲染变慢即判定失败，不设允许退化比例；
- 不新增运行时 CSS 注入、DOM 观察器、定时器或 JavaScript 补偿逻辑。

### 立即停止

出现以下任一情况，停止后续阶段并只撤销当前执行包：

- 路由、交互、滚动、选择、搜索或页面可见内容变化；
- 关键几何、断点行为或 App Shell 契约变化；
- 任一获胜声明变化，或 CSS 字节数、规则复杂度、性能复测确认退化；
- 必须修改 DOM/JS、业务数据或全局 token 才能继续；
- 发现同一文件存在另一活跃写者。

回退只反向撤销本批 patch，不使用 `reset`、`checkout` 或覆盖工作树，不触碰现有
`app.js / index.html / data/` 变更。

## 6. 完成定义

P1 Web 源码阶段完成必须同时满足：

- 所有实际删除项都具有可复核的静态层叠等价证明；
- 生命周期和 Apple Shell 执行包通过各自专项门禁和浏览器验收；
- 功能、数据、交互、布局和用户状态与基线一致；
- CSS 字节数、规则数和复杂度只减不增，性能无任何确认回归；
- cache tag 与 CSS 在同一交付包更新，重新加载后实际命中新版本；
- 未扩展到 P2 token、颜色和历史死代码治理；
- 只报告 `web_verified / app_pending`，不得宣称 shared runtime 完整验收。

最终状态只能在最新 DMG 中复验 Apple Shell、生命周期、缓存命中和 console 后改为
`shared_runtime_pass`；该实包验收与用户要求的 `28776` MCP 测试放在同一次发布矩阵。

## 7. 2026-07-29 实施与验收结果

本轮只删除 4 个完整重复规则块，均保留同一 selector、同一 at-rule 条件下的最后一份
等值规则：

- `@media (max-width: 1180px)` 下 1 个重复的
  `.app-shell.app-shell-integrated` 规则块；
- `@media (min-width: 1800px)` 下 3 个重复的
  `.app-shell-integrated .capability-workspace` 规则块。

没有删除生命周期声明、没有修改生效的 `!important`，也没有移动声明、合并 media、
改变 selector、specificity、断点或加载顺序。结果指标：

| 指标 | 修改前 | 修改后 |
|---|---:|---:|
| 治理审计行数 | 32,178 | 32,161 |
| 文件字节数 | 752,170 | 751,750 |
| 解析规则数 | 4,283 | 4,279 |
| 目标规则数 | 64 | 60 |
| `!important` | 322 | 322 |
| 目标完整重复规则组 | 2 | 0 |

Web 验收结果：

- 前端功能契约 P0-1、P0-2、P0-4、P1-1 至 P1-6、P2 全部通过；
- 滚动契约 `36/36` 通过，Runtime suite 全部通过；
- 浏览器实测 `/capability-mapping` 的 `1180 / 1181 / 1799 / 1800px`
  断点，及 `/development-security`、`/data-security` 的阶段切换和溢出行为，均通过；
- 页面未出现横向溢出，console error/warning 为 0，新 CSS cache tag 已实际命中；
- `git diff --check` 和交付目录契约、Runtime helper 语法检查通过。

完整 pre-commit 仍有两个既有阻断，均未通过扩大本 CSS 任务处理：

1. 前端治理基线：`styles.css` 仍比 32,140 行基线多 21 行，`app.js` 仍比
   13,828 行基线多 131 行；
2. 旧 license / no-license DMG staging 前端与当前源码不一致。

上述两项不影响本轮 Web 功能验收。最新 DMG、App 样式和 `28776` MCP 仍按用户要求
留到下一次实际打包矩阵一起验证。
