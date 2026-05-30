# 2026-05-30 工程阻塞点 Review

## 结论

本轮 review 的核心结论是：安全能力映射页反复优化失败，不是因为某一次配色、列宽或图谱参数没有调好，而是页面当前把数据加载、对象选择、ViewModel 聚合、图谱布局和全局 CSS 覆盖耦合在一起。任何一次小改动都可能同时触发表格、图谱、缓存、首屏加载和其它页面样式，因此很容易出现“修 A、坏 B、再回退”的循环。

建议短期停止在安全能力映射页继续做局部视觉补丁，先把页面契约和样式边界收拢，再继续推进 Apple / Morandi 视觉方向。

## P1：安全能力映射页仍有双数据源和全局投影合并风险

- 证据：`frontend/capability-browser/app.js:244` 的 `mergeCapabilityProjection()` 会把新旧 projection 合并进全局 `state.capabilityProjection`，并且 `localRelationMap` 可以回退到 previous。
- 证据：`frontend/capability-browser/viewModels.js:1052` 到 `viewModels.js:1097` 同时尝试使用完整 `capability-workbench`、后端 projection 和前端 fallback 构建技术 / 管理 / 图谱数据。
- 证据：`src/sapd_wiki/api_server.py:889` 到 `api_server.py:970` 已经提供对象粒度 projection，但前端非关注点对象仍主要依赖完整 workbench 和本地 ViewModel 聚合。
- 影响：同一页面存在“完整工作台数据”和“当前对象投影数据”两套事实来源。只要加载顺序、默认选中或缓存版本变化，就可能出现 L0 / L1 / L2 误用关注点数据、图谱中心不一致、初始空态闪现、统计数不同步。
- 建议：建立一个唯一页面契约，例如 `/api/v1/capabilities/workspace-view?object_type=&object_id=`，直接返回当前对象需要的 header、summary、tabs、graph、technicalRows、managementRows、standardRows。前端只消费这一份对象级 ViewModel，不再在全局状态里混合不同对象 projection。

## P1：渲染函数中仍在做选择修正和异步加载触发

- 证据：`frontend/capability-browser/app.js:1327` 的 `renderCapabilities()` 内部同时负责加载保护、默认选中、ViewModel 构建、目录展开、详情区渲染。
- 证据：`frontend/capability-browser/app.js:1341` 先按旧 `state.selectedCapabilityId` 触发完整 workbench 加载，`app.js:1363` 到 `app.js:1366` 又在 ViewModel 构建后写回默认选中对象，`app.js:1387` 到 `app.js:1392` 再按 effective selection 触发一次加载保护。
- 影响：首屏、刷新恢复和快速切换时，页面可能在“旧选择、默认选择、新选择”之间切换。此前 OI-115、OI-118、OI-120 都是这类问题的不同表现。
- 建议：拆成四段固定流程：`resolveCapabilitySelection()`、`ensureCapabilityDataForSelection()`、`buildCapabilityViewModel()`、`renderCapabilityView()`。渲染函数只渲染，不再修正 state 或发起新的数据请求。

## P1：CSS 已经成为覆盖层堆叠，缺少可控设计系统边界

- 证据：`frontend/capability-browser/styles.css` 当前约 18,405 行，存在 8 个 `:root`、541 个 hex 颜色、58 个 `!important`、117 处 `relation-chip` 相关选择器。
- 证据：`frontend/capability-browser/styles.css:18066` 到 `styles.css:18370` 是一段后置全局覆盖，覆盖十多类表格、chip、生命周期、环境和维护页面。
- 影响：视觉改动无法局部推理。一次为了修安全能力映射页表格字号的规则，可能误伤 LC-AP、环境映射、安全知识维护或标准表格。这也是 OI-116 这类回归的直接工程原因。
- 建议：冻结大范围 CSS 覆盖，先拆出 `tokens.css`、`tables.css`、`chips.css`、`capability-map.css`、`lifecycle.css`。后续 Apple 方向只改 token 和组件级样式，不再追加跨页面大选择器。

## P2：安全能力映射页存在两代矩阵渲染器并存

- 证据：`frontend/capability-browser/components/CapabilityLocalRelationMap.js:240` 到 `CapabilityLocalRelationMap.js:390` 保留了通用 `preview-mapping-table` 矩阵渲染器。
- 证据：`CapabilityLocalRelationMap.js:684` 到 `CapabilityLocalRelationMap.js:840` 实际又调用原始 `FocusScopeServiceMatrix`、`FocusManagementMapping` 和新的标准矩阵。
- 影响：技术视角、管理视角、标准视角并没有真正共用一个表格抽象。样式修复容易只覆盖其中一个分支，导致“图 1 和图 3 还没统一”“标准表格和管理表格字体不一致”反复出现。
- 建议：确定唯一矩阵组件协议，三个 tab 都走同一套 table shell、chip token、空值规则和列宽策略。旧的 generic renderer 要么删除，要么标记为 legacy fallback，不能继续作为隐形分支存在。

## P2：图谱布局是高风险区，缺少视觉验收基线

- 证据：`frontend/capability-browser/components/LocalRelationNetworkGraph.js:407` 到 `LocalRelationNetworkGraph.js:580` 在渲染过程中执行自定义力导向布局，节点碰撞是双层循环，迭代次数按节点数可达 96、150、320。
- 证据：`docs/06-implementation/open-issues.md` 中 OI-114 已记录一次图谱布局优化造成视觉回退并被撤回。
- 影响：图谱布局参数不是孤立参数，任何颜色、半径、字体、边长和 viewBox 变化都会影响用户看到的结构。只靠 HTTP smoke 无法证明图谱好看、居中、不卡顿。
- 建议：图谱布局单独立项，不再和配色 / 表格一起改。先固定 `T`、`T-AS`、`T-AS.AD`、`T-AS.AD-01`、`T-PD.AC-01` 等验收样例，增加截图或 DOM / SVG 指标检查，再修改布局。

## P2：当前验证偏向“能打开”，不足以防止用户可见回归

- 已通过的验证包括 `node --check`、`git diff --check`、数据边界检查、数据包摘要、projection contract audit 和轻量 smoke。
- 风险：当前 smoke 多数是 HTTP / API 模式，并且未启动系统 Chrome。它能证明页面资源和接口可访问，但不能证明安全能力映射页当前选中对象、tab 状态、图谱中心、行数、chip 颜色、列宽和滚动行为符合截图预期。
- 建议：为安全能力映射页补一个专用视觉回归脚本，至少断言四类对象 L0 / L1 / L2 / 关注点的标题、图谱中心、当前 tab、技术服务行数、管理职能行数、标准控制项数，以及关键 chip 的 computed style。

## P2：未提交变更过大，回退成本高

- 证据：当前工作区涉及 16 个文件，约 1,506 行新增、225 行删除，覆盖 `app.js`、`viewModels.js`、多个组件、`styles.css`、后端 export 和文档。
- 影响：没有按“数据契约、加载状态、矩阵组件、视觉 token、导出逻辑”拆分 checkpoint 时，任何视觉回退都会带着其它改动一起被迫回滚。
- 建议：后续每次只允许一个主题进入修改区。安全能力映射页先建立 checkpoint，再按小 PR / 小 commit 推进。

## P3：数据包当前不是主要阻塞点

- `capability-workbench`、`capability`、`maintenance`、`environment-workbench` 数据包摘要均为 `ready`。
- 当前 blocker 更偏向页面契约、加载生命周期、组件分层和 CSS 治理，不是“缺数据导致页面坏”。
- 但不同包的安全技术服务和措施数量存在口径差异，例如 capability / workbench 与 maintenance 的服务数不完全相同。这个差异后续应写入数据口径说明，避免误判为前端 bug。

## 立即建议

1. 暂停继续在 `styles.css` 尾部追加跨页面覆盖规则。
2. 安全能力映射页先做“对象级页面契约治理”，不要同时改颜色、图谱和表格。
3. 把 `renderCapabilities()` 拆成选择、加载、ViewModel、渲染四段，并加 L0 / L1 / L2 / 关注点回归断言。
4. 图谱布局单独开问题，不和 Apple 配色一起推进。
5. 当前未提交变更先按主题 checkpoint，避免下一次回退把已经正确的修复一起撤掉。

## 本轮验证

- `node --check`：覆盖 `app.js`、`viewModels.js`、安全能力映射图谱组件、图谱模型和显示标签，均通过。
- `git diff --check`：通过。
- `python3 scripts/check_github_data_boundary.py`：通过。
- `python3 scripts/data_package_summary.py`：`capability-workbench`、`capability`、`maintenance`、`environment-workbench` 均为 `ready`。
- `python3 scripts/dev_server_guard.py --status`：固定 `5173` 服务健康。
- `node scripts/audit_capability_projection_contract.mjs --url http://127.0.0.1:5173`：对象粒度 projection 契约通过。
- `node scripts/frontend_smoke_check.mjs`：`capability`、`environment`、`dev-lifecycle`、`data-lifecycle` 轻量 smoke 通过。
- 限制：本轮未做系统 Chrome / Playwright 视觉回归，因此不声明截图级视觉验收通过。
