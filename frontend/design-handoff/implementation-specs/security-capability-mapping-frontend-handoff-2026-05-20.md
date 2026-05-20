# 安全能力映射前端调整交接文档

日期：2026-05-20
适用会话：单独调整 `安全能力映射` 界面的前端实现
当前目标：先固化实现边界、已有状态、可改文件、验收方式；后续再进入代码调整。

## 0. 2026-05-20 图谱交接补充

本会话已经围绕 `能力关系图谱` 做过多轮试错，当前上下文较重，建议新会话轻量恢复后接手，不要继续在本会话内迭代布局算法。

### 当前用户最新诉求

用户认为当前图谱节点“被拖死 / 限定死”，希望交接到其他会话继续处理。核心诉求如下：

1. 图谱不要固定角度或固定树杈路径。
2. 需要更接近自由、自适应的星形分布。
3. 技术视角、管理视角、标准 / 框架映射都要遵循同一原则。
4. 图谱需要支持放大 / 缩小。
5. 空节点、装饰灰点、无业务含义节点不要显示。
6. 当前节点不要显示 `能力-关注点`，只显示业务名称和编号。

### 当前已改实现

已修改的核心文件：

- `frontend/capability-browser/components/LocalRelationNetworkGraph.js`
- `frontend/capability-browser/styles.css`
- `frontend/capability-browser/app.js`
- `frontend/capability-browser/index.html`

当前实现状态：

- `LocalRelationNetworkGraph.js` 已从固定坐标 / 固定角度改为组件内自定义力导向排布。
- 默认 `viewBox` 改为完整画布 `0 0 1680 940`。
- 图谱右上角新增 `- / 100% / + / 1:1` 缩放控件。
- 支持鼠标拖拽平移和滚轮缩放。
- `renderDecorative()` 当前返回空字符串，旧装饰灰点不再渲染。
- 当前节点文案已改为业务标题 + 编号，不显示 `能力-关注点`。
- 资源版本号已提升到 `capability-map-graph-pan-20260520-6` 和 `capability-map-ui-20260520-6`。

### 当前实现的主要问题

虽然当前实现通过了语法检查和基本浏览器回归，但用户仍认为视觉不合理。新会话应重点重新评估以下问题：

- 当前力导向布局仍带有较强的 anchor / gravity 约束，可能让用户感觉节点仍被“限定死”。
- 默认完整画布能展示全局，但局部节点文字变小，宽屏下需要缩放才能看清。
- 管理视角和标准映射节点虽然纳入同一布局，但视觉分区和交叉线仍可能不够自然。
- 组件内部遗留了一些早期布局 helper，例如 `placeRing`、`placeChildrenAdaptive`、`placeChildrenWithOpenSector` 等，后续如果重做布局应先清理或明确保留边界。

### 接手建议

建议新会话不要在现有算法上继续微调固定角度。更好的方向：

1. 先保留当前节点 / 边的数据生成逻辑，不动 `relationGraphModel.js` 的业务口径。
2. 在 `LocalRelationNetworkGraph.js` 内把布局算法重新简化为“确定性 force simulation”：
   - 只固定当前关注点；
   - 视角节点、作用域、职能、标准状态都只给弱中心引力；
   - 通过 link distance、charge、collision 和 group gravity 自适应展开；
   - 不按技术 / 管理 / 标准写死角度。
3. 如原生实现继续难以稳定，可考虑引入轻量图布局库，但要先评估依赖成本；当前项目没有 React / Vue，不宜大改技术栈。
4. 如果继续自研 SVG，建议新增一个小型布局调试函数，只输出：
   - 节点数；
   - 重叠数；
   - 最小间距；
   - `viewBox`；
   - 每类节点中心点范围。
5. 视觉上优先保证：
   - 同级节点围绕父节点自然散开；
   - 不出现明显重叠；
   - 空节点不显示；
   - 缩放 / 平移稳定；
   - 默认态不要让重要节点贴边。

### 已验证结果

本会话曾验证：

- `node --check frontend/capability-browser/components/LocalRelationNetworkGraph.js frontend/capability-browser/app.js`：通过。
- `git diff --check`：通过。
- 浏览器回归：`能力关系图谱` 标题和说明正确；空装饰节点不显示；旧 `能力-关注点` 文案不显示；缩放按钮可用；点击放大后 `network-pan-layer` 变为 `translate(0 0) scale(1.16)`。
- 本地 `5175` 项目服务健康检查返回 200。

### 注意事项

- 当前工作区还有其他未提交业务改动，尤其是标准 / 框架映射相关文件，不要回滚。
- 新会话开工时只读轻量入口：`CURRENT_STATE.md`、`progress.md`、`task_plan.md`、`findings.md`，不要默认读取完整 archive、大 JSON、全量 diff。
- 如果只处理图谱，不要修改原始 Excel、ETL、schema、数据库或 `public/data/*.json`。

## 1. 本轮要解决什么

本会话只处理 `安全能力映射` 页面内部前端体验，不扩展新数据源，不重做后端投影，不引入 React / Vue。

优先目标：

1. 收敛当前 `安全能力映射` 页面内部布局和关系表达。
2. 保持当前“本地关联摘要 / 技术视角 / 管理视角 / 标准 / 框架映射”四个页签的业务边界。
3. 重点调整前端可见结构、CSS、交互和组件组织，使页面更像关系审查工作台，而不是详情卡片堆叠。
4. 保留技术 / 管理明细矩阵作为核对入口，不在前端重新推断业务关系。

完成后用户应得到：

- 一个更清楚的安全能力映射工作台界面；
- 当前关注点、技术视角、管理视角、标准映射空状态的边界更明确；
- 可通过浏览器回归确认的页面改动。

## 2. 当前项目状态

当前阶段仍是 Phase 5：知识浏览与搜索 / 关系化前端工作台校正。

`CURRENT_STATE.md` 和 `task_plan.md` 中已经明确：

- 当前主线是已导入 Sheet 的业务含义复核 + 前端关系展示校正；
- `安全能力映射` 是关系画布基准页；
- 当前继续使用静态 HTML、原生 JS、CSS、`dataClient.js` 和 `viewModels.js`；
- 不默认启动 maturity、Phase 7 多格式增强、新 Sheet 扩展或数据库 schema 重构。

当前 Git 状态提醒：

- 当前分支：`codex-frontend-backend-separation-closure`，相对远端 ahead 1。
- 开工前已有未提交改动：
  - `frontend/capability-browser/index.html`
  - `frontend/capability-browser/styles.css`
  - `progress.md`
- 后续改动时必须先阅读这些文件的当前 diff，避免覆盖用户或上一轮已有工作。

## 3. 必读上下文

后续进入实现前，应先读以下文件：

1. `CURRENT_STATE.md`
2. `task_plan.md`
3. `findings.md`
4. `progress.md`
5. `PRODUCT.md`
6. `DESIGN.md`
7. `frontend/design-handoff/implementation-specs/security-capability-workbench-visual-spec-v1.md`
8. `docs/04-user-guide/capability-workbench-json-spec-v1.md`
9. `docs/06-implementation/open-issues.md` 中的 `OI-049`

前端设计类任务还应按项目约定先运行：

```bash
node .agents/skills/impeccable/scripts/load-context.mjs
```

本次交接已确认：

- `PRODUCT.md` 存在，产品定位为本地优先的安全架构关系工作台；
- `DESIGN.md` 存在，设计原则是轻量、密集、专业、关系审查优先；
- 当前不需要生成营销首页、装饰性 Dashboard 或卡片墙。

## 4. 当前运行结构

主要入口：

- `frontend/capability-browser/app.js`
  - `renderCapabilities()` 构建能力页 ViewModel；
  - 将 `viewModel.localRelationMap`、`viewModel.focusOverview`、`technicalMappingRows`、`managementMappingRows` 传给 `CapabilityLocalRelationMap.render()`。

主要组件：

- `frontend/capability-browser/components/CapabilityLocalRelationMap.js`
  - 页面内部四个页签的主要渲染组件；
  - 当前使用 radio + CSS 控制页签切换；
  - 默认页签为 `本地关联摘要`；
  - 技术页签调用 `FocusScopeServiceMatrix.render()`；
  - 管理页签调用 `FocusManagementMapping.render()`；
  - 标准页签在缺少投影时展示受控空状态。
- `frontend/capability-browser/components/LocalRelationNetworkGraph.js`
  - 原生 SVG 本地关联摘要图；
  - 当前以当前关注点为中心，展示技术、管理、标准三类分支；
  - 布局由组件内部 `buildLayout()` 固定坐标生成。
- `frontend/capability-browser/models/relationGraphModel.js`
  - 把 ViewModel 安全字段转成网络图 nodes / edges；
  - 不应在这里补造业务事实；
  - 当前会为标准映射缺失创建 `待投影` 节点。
- `frontend/capability-browser/components/FocusScopeServiceMatrix.js`
  - 技术视角原矩阵。
- `frontend/capability-browser/components/FocusManagementMapping.js`
  - 管理视角原矩阵。
- `frontend/capability-browser/styles.css`
  - 当前安全能力映射页样式集中在 `preview-*`、`network-*`、`relation-*`、`capability-map-*` 等选择器附近；
  - 文件较大，修改前用 `rg -n` 精确定位，不做大范围重排。

主要数据入口：

- API 优先：`/api/v1/capabilities/workspace-projection`
- 静态包 fallback：`frontend/capability-browser/public/data/capability-workbench.json`
- ViewModel：`frontend/capability-browser/viewModels.js`

## 5. 本轮允许修改范围

优先允许：

- `frontend/capability-browser/components/CapabilityLocalRelationMap.js`
- `frontend/capability-browser/components/LocalRelationNetworkGraph.js`
- `frontend/capability-browser/models/relationGraphModel.js`
- `frontend/capability-browser/styles.css`
- 必要时少量调整 `frontend/capability-browser/app.js` 的能力页挂载逻辑
- 必要时更新 `frontend/design-handoff/implementation-specs/*`
- 必须更新 `progress.md`

谨慎修改：

- `frontend/capability-browser/viewModels.js`
  - 只有展示层字段命名或安全投影适配确实需要时才改；
  - 不把 ETL、主数据归一、跨表匹配或业务关系推断放进 ViewModel。
- `frontend/capability-browser/index.html`
  - 仅当资源版本号或脚本加载顺序需要调整时改。

禁止修改：

- 原始 Excel、PDF、DOCX、Draw.io 等业务资料；
- SQLite schema、migrations、数据库文件；
- ETL 导入逻辑；
- `public/data/*.json` 手工改数据；
- maturity 相关文件；
- 环境页、LC-AP 页、专项知识维护页的业务结构。

## 6. 数据与业务边界

前端必须只消费 `dataClient`、`/api/v1/*` 或 ViewModel 已整理字段。

不得在组件中：

- 直接读取原始 Sheet、数据库或临时 JSON；
- 用字符串匹配临时推断标准、流程、职能、技术服务关系；
- 把没有后端投影的数据伪造成已映射事实；
- 静默补造标准 / 框架控制项。

标准 / 框架映射当前边界：

- `OI-049` 仍有效：`capability-workbench.json` 中标准 / 框架映射为空。
- 页面必须保留 `标准 / 框架映射` 页签。
- 如果当前关注点没有直接标准投影，展示受控空状态。
- 不从 GB/T 42446 职能参考间接推断当前关注点到标准条款的映射。

## 7. 字段边界

主展示区不得出现以下非业务字段：

```text
sheet, row, column, raw_value, source_file, import_id, source_id, source_ref, source_label, debug, raw, metadata, intermediate, generated_at
```

允许范围：

- 以上字段只可出现在来源证据折叠面板或开发核查文档中；
- 如果页面上出现，应记录到 `docs/06-implementation/open-issues.md` 并修复。

## 8. 推荐实现顺序

建议按小步闭环推进：

1. 读取当前 diff，确认已有 `index.html`、`styles.css`、`progress.md` 改动来源。
2. 启动本地服务，进入 `安全能力映射` 页面做现状截图或浏览器观察。
3. 先处理页面信息架构：
   - 当前关注点对象头是否轻量；
   - 四个页签是否清楚；
   - 默认摘要图是否真正帮助理解；
   - 技术 / 管理矩阵是否位置合理。
4. 再处理 CSS：
   - 压缩视觉噪声；
   - 修复宽屏 / 1440px / 小屏布局；
   - 避免嵌套卡片和过度装饰。
5. 再处理组件：
   - 必要时调整 `CapabilityLocalRelationMap.js` 内部结构；
   - 必要时调整 `LocalRelationNetworkGraph.js` 的节点尺寸、布局、空状态和可读性；
   - 不改业务数据生成规则。
6. 最后浏览器回归和字段边界检查。

## 9. 验收标准

功能验收：

- 可以通过侧边导航进入 `安全能力映射`。
- 左侧能力目录可选择关注点。
- 主区域可见当前关注点对象头。
- 四个页签可切换：
  - `本地关联摘要`
  - `技术视角`
  - `管理视角`
  - `标准 / 框架映射`
- 技术视角仍显示作用域 / 安全技术服务 / 模块 / 措施明细。
- 管理视角仍显示安全工作 / 安全职能 / L2/L3/L4 流程明细。
- 标准 / 框架缺投影时显示受控空状态，不伪造映射。

视觉验收：

- 1920px 下像关系工作台，不像详情卡片堆叠。
- 1440px 下主关系区域仍可读，不被侧栏挤扁。
- 顶部对象头不超过主体高度的轻量区域。
- 明细表和来源证据不挤压主关系视图。
- 不出现文字溢出、控件重叠或主内容横向不可读。

数据验收：

- `dataState` 应为 `ready`，除非本地数据包缺失。
- 不手工修改 `public/data/*.json`。
- 不新增绕过 `dataClient` 的数据路径。

字段验收：

- 主展示区不得出现第 7 节列出的非业务字段。

## 10. 建议验证命令

语法检查：

```bash
node --check frontend/capability-browser/app.js frontend/capability-browser/viewModels.js frontend/capability-browser/components/CapabilityLocalRelationMap.js frontend/capability-browser/components/LocalRelationNetworkGraph.js frontend/capability-browser/models/relationGraphModel.js
```

差异空白检查：

```bash
git diff --check
```

本地预览：

```bash
python3 scripts/sapd_wiki.py serve --host 127.0.0.1 --port 5174
```

接口检查：

```bash
curl -s -o /tmp/sapd_health.json -w '%{http_code}\n' http://127.0.0.1:5174/api/v1/health
curl -s -o /tmp/sapd_projection.json -w '%{http_code}\n' http://127.0.0.1:5174/api/v1/capabilities/workspace-projection
```

浏览器回归：

- 打开 `http://127.0.0.1:5174/`
- 从侧边导航进入 `安全能力映射`
- 选择至少 1 个有技术映射和管理映射的关注点
- 分别检查四个页签
- 检查浏览器控制台是否无错误
- 视口至少覆盖 1440px 和 1920px

## 11. 不建议本轮做什么

- 不建议重做整个 Application Shell。
- 不建议把能力页迁到 React / Vue。
- 不建议为了视觉效果引入第三方图库。
- 不建议把所有关系做成全局知识图谱。
- 不建议在标准 / 框架映射为空时临时用 GB/T 或 NIST 全量表填充。
- 不建议抽象跨页面通用关系画布，除非能力页这次已稳定验收。

## 12. 需要用户确认的问题

进入实现前建议确认：

1. 本轮是优先修“默认本地关联摘要图”，还是优先修“技术 / 管理页签里的明细矩阵可读性”？
2. 是否保留当前 `本地关联摘要` 作为默认页签？
3. 标准 / 框架映射在投影补齐前，是否只保留空状态和跳转提示？

如用户没有额外指定，建议默认优先级为：

1. 默认本地关联摘要图可读性；
2. 技术 / 管理矩阵布局；
3. 1440px / 1920px 响应式；
4. 标准 / 框架受控空状态。
