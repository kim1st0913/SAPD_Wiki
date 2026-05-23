# 安全能力映射 L2 能力关系图谱交接

日期：2026-05-21
适用会话：继续校正 `安全能力映射 > 能力关系图谱` 的 L2 能力级关系表达
当前目标：先让用户肉眼确认 L2 分簇图谱是否已经能体现“每个关注点后面的联系”，不要默认继续改代码。

## 1. 当前任务背景

项目目录：`/Users/kim1st/Documents/kim note/06_dev_projects/SAPD_Wiki`

当前页面：`frontend/capability-browser/` 的 `安全能力映射 > 能力关系图谱`

当前重点：安全能力映射 L2 能力级图谱的显示优化。用户认为 L2 图谱原来“每个关注点后面的联系体现不出来，线交叉在一起”。

## 2. 重要约束

- 轻量恢复：优先读 `CURRENT_STATE.md`、`progress.md`，必要时读 `docs/06-implementation/open-issues.md` 和目标文件局部。
- 不默认读 `docs/05-archive/`、大 JSON、全量 diff、全量 `ps`。
- 前端设计类任务先运行 `node .agents/skills/impeccable/scripts/load-context.mjs`。
- 不引入 React / Vue，继续静态 HTML / CSS / vanilla JS。
- 前端不得直接做 ETL、主数据归一或业务推断，只做 ViewModel 展示整理。
- 主展示区不得泄露：`sheet`、`row`、`column`、`raw_value`、`source_file`、`import_id`、`source_id`、`source_ref`、`source_label`、`debug`、`raw`、`metadata`、`intermediate`、`generated_at`。
- 完成后按 `AGENTS.md` 输出“任务完成反馈”。

## 3. 本轮已完成的图谱改动

### 3.1 `relationGraphModel.js`

文件：`frontend/capability-browser/models/relationGraphModel.js`

- L2 图谱中，作用域、安全工作、L2 流程组、标准 / 框架叶子节点已改为按关注点上下文生成。
- 新增 `contextualStableId(prefix, contextId, item, fallback)`。
- `buildFocusMappingOverviewGraph()` 中的 `scope`、`process_l2`、`security_work`、`standard_status` 节点 id 都已加入关注点上下文。
- 目的：不再让不同关注点共用同名叶子节点，避免多个关注点被同一个节点拉成交叉网。

### 3.2 `LocalRelationNetworkGraph.js`

文件：`frontend/capability-browser/components/LocalRelationNetworkGraph.js`

- 新增 L2 专用关注点分簇布局：
  - `polar()`
  - `spreadAngles()`
  - `seedFocusMappingClusterLayout()`
- `focus_mapping_overview` 策略优先走关注点扇区布局。
- L2 中 current 与第一层关注点固定，减少力导向把簇拉散。
- 降低 L2 力导向对初始布局的干预：
  - link force 从 `0.22` 降为 `0.12`
  - center pull 降低
  - radial strength 降低
  - layout iterations 对 L2 设为 `140`
- 目标：L2 能力中心在中间，第二层是 L3 关注点，每个关注点自己的技术 / 管理 / 标准分支贴着它向外展开。

### 3.3 `app.js`

文件：`frontend/capability-browser/app.js`

- 图谱模型和组件缓存版本已更新为 `capability-graph-strategy-20260521-8`。

### 3.4 `styles.css` 与 `index.html`

文件：

- `frontend/capability-browser/styles.css`
- `frontend/capability-browser/index.html`

当前请求不是继续改颜色，而是 L2 布局关系表达。颜色已在前序工作中优化为：

- 能力 / 关注点：结构靛紫色系
- 技术：蓝青色系
- 管理：绿色系
- 标准 / 框架：金色系

## 4. 问题记录与进度记录

`docs/06-implementation/open-issues.md` 已更新 `OI-062`：

- 记录 L2 叶子按关注点上下文显示。
- 记录 L2 增加关注点扇区分簇布局。
- 记录验证指标。

`progress.md` 已记录当前状态：

- “安全能力映射 L2 图谱已改为关注点分簇...”

## 5. 已通过验证

静态检查：

```bash
node --check frontend/capability-browser/models/relationGraphModel.js
node --check frontend/capability-browser/components/LocalRelationNetworkGraph.js
node --check frontend/capability-browser/app.js
git diff --check -- frontend/capability-browser/models/relationGraphModel.js frontend/capability-browser/components/LocalRelationNetworkGraph.js frontend/capability-browser/app.js docs/06-implementation/open-issues.md progress.md
```

本地预览端口曾使用：

```bash
python3 -m http.server 6190 --bind 127.0.0.1
```

访问地址：

```text
http://127.0.0.1:6190/frontend/capability-browser/
```

Chrome 定点检查 `T-AS.AD`：

- `businessNodes=49`
- `overlaps=0`
- `minGap=22`
- `focusNodes=3`
- `technicalViews=3`
- `managementViews=3`
- `standardViews=3`
- `scopeNodes=14`
- `processNodes=3`
- `workNodes=3`
- `standardLeafNodes=16`
- `bodyOverflowX=0`

smoke：

```bash
node scripts/frontend_smoke_check.mjs --page capability --url http://127.0.0.1:6190/frontend/capability-browser/ --debug-port 9369
```

结果：`pass`，`consoleIssues=0`

字段泄露检查：主展示区 forbidden hits 为 `[]`

数据包摘要：

```bash
python3 scripts/data_package_summary.py --package capability
```

结果：`data_state=ready`，`categories=3`、`domains=10`、`capabilities=32`、`focuses=91`、`services=157`

## 6. 当前工作区相关修改状态

以下文件处于修改状态，包含本轮和之前安全能力映射图谱相关改动。不要回滚这些文件：

- `docs/06-implementation/open-issues.md`
- `frontend/capability-browser/app.js`
- `frontend/capability-browser/components/LocalRelationNetworkGraph.js`
- `frontend/capability-browser/index.html`
- `frontend/capability-browser/models/relationGraphModel.js`
- `frontend/capability-browser/styles.css`
- `progress.md`

## 7. 新会话恢复建议

第一步只读：

```bash
sed -n '1,90p' CURRENT_STATE.md
sed -n '1,35p' progress.md
rg -n "OI-062|focus_mapping_overview|seedFocusMappingClusterLayout|contextualStableId|capability-graph-strategy-20260521-8" docs/06-implementation/open-issues.md frontend/capability-browser/models/relationGraphModel.js frontend/capability-browser/components/LocalRelationNetworkGraph.js frontend/capability-browser/app.js
```

第二步开预览：

```bash
python3 -m http.server 6190 --bind 127.0.0.1
```

访问：

```text
http://127.0.0.1:6190/frontend/capability-browser/
```

建议让用户重点查看这些 L2 节点：

- `T-AS.AD`
- `T-PD.AC`
- `M-PM`

判断它们是否已经能体现“每个关注点后面的联系”。

## 8. 后续判断路径

首要任务不是继续改代码，而是先让用户看当前 L2 图谱是否更符合预期。

如果仍不满意，下一步不要继续随机调力导向，建议从以下方向选择一个：

1. 每个关注点簇增加淡色背景扇区或隐性边界。
2. 把 L2 图谱改成“关注点列式 / 泳道式关系图”：中心能力在左侧，关注点纵向排列，每个关注点右侧展开技术、管理、标准三列。
3. 增加只看单个关注点簇的 hover / 点击聚焦模式。

从产品设计角度，优先考虑第 2 个方向。它更符合 SAPD Wiki 的关系审查工作台定位，也能避免继续用复杂力导向去表达结构化映射。
