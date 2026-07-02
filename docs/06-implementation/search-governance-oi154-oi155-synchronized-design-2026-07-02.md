# OI-154 / OI-155 搜索治理同步设计

日期：2026-07-02

关联问题：`OI-155`、`OI-154`、`OI-149`、`OI-144`

## 设计结论

`OI-155` 和 `OI-154` 必须同步设计，但不能合并实施。

- `OI-155` 管全局搜索：跨知识域查找、独立搜索结果页、结果筛选、打开目标、业务锚点定位。
- `OI-154` 管页面内搜索：当前页面、当前树、当前表格、当前映射图内的局部筛选、展开、定位和空态。
- `OI-149` 只提供性能底座：`search-index`、JSON split、projection、懒加载和加载预算。
- `OI-144` 作为历史状态隔离基线，不再承载新搜索产品任务。

最终形态是：

```text
顶部全局搜索
  -> 轻量结果面板
  -> Enter / 查看全部
  -> #/search?q=...
  -> 搜索结果页筛选、打开、定位

页面内搜索
  -> 当前页面局部筛选
  -> 当前上下文内展开 / 定位
  -> 不进入全局搜索历史
```

## 当前事实基线

截至 2026-07-02：

- `OI-149` 已进入 `P4 正式 split apply 已完成 / 待页面人工验收与观察`。
- `/api/v1/search-index` 已存在，`dataClient.getSearchIndex()` 已接入。
- `audit_global_search_index_contract.mjs` 在可访问 5173 的执行上下文中通过。
- `audit_search_state_isolation.mjs` 已通过，当前 `globalSearch` 与 `pageSearches` 已隔离。
- 现有顶部全局搜索仍是轻量结果面板形态，`Enter` 仍激活第一条结果，尚未进入 `#/search?q=...`。
- 当前代码仍存在历史行为：全局搜索结果激活后可能把关键词写入目标页页面搜索，用于过滤和高亮。该行为应在 `OI-155` 中收敛为 `targetRef` 定位，不再污染页面内搜索。
- 页面内搜索入口已存在，但还不是统一组件 / 统一契约。环境页搜索不可用仍归 `OI-154`。

## 产品分工

### OI-155：全局搜索

用户意图是“我知道一个对象、标准、服务、模块、环境或页面名称，帮我跨域找到它在哪里”。

全局搜索负责：

- 顶部搜索框。
- 轻量结果面板。
- 独立结果页 `#/search?q=...`。
- 结果类型 / 知识域筛选。
- 结果摘要、所属路径、可定位状态。
- 点击结果后打开目标页面并按 `targetRef` 定位。

全局搜索不负责：

- 过滤当前能力树。
- 过滤当前环境对象树。
- 过滤当前标准表。
- 过滤当前字典清单。
- 作为页面内搜索失败后的兜底扫描器。

### OI-154：页面内搜索

用户意图是“我已经在某个页面里了，只想在当前上下文里快速筛选或定位”。

页面内搜索负责：

- 当前页面局部筛选。
- 树节点展开。
- 当前表格 / 当前映射图 / 当前阶段栏内定位。
- 无结果时显示局部空态。
- 保持当前页面上下文，不跳全局结果页。

页面内搜索不负责：

- 跨知识域搜索。
- 搜索历史。
- 结果页聚合筛选。
- 加载 `search-index`。
- 改变顶部全局搜索框。

## Dashboard 与搜索页关系

Dashboard 可以承载全局搜索入口，但不承载完整搜索结果页。

推荐关系：

```text
Dashboard
  - 顶部全局搜索入口
  - 最近访问
  - 常用对象
  - 数据状态与 Issue 入口

#/search?q=...
  - 搜索结果筛选
  - 结果列表
  - 结果摘要
  - 打开 / 定位
```

理由：

- Dashboard 的职责是“整体状态与工作入口”。
- 搜索结果页的职责是“跨域结果审查与定位”。
- 两者共享 AppShell 和顶部搜索框，但不共享加载链路。
- Dashboard 继续走 `analytics_summary` / dashboard summary；全局搜索继续走 `search-index`。

## 信息架构

### 顶部轻量面板

用途：快速跳转，不做完整搜索工作区。

行为：

- 输入 1 个有效字符后触发 `search-index` 查询。
- 显示前 6-8 条高置信结果。
- `Enter` 进入 `#/search?q=关键词`。
- 面板底部提供 `查看全部结果`。
- 点击面板结果可以直接打开目标，但仍只能通过 `targetRef` 定位。

### 全局搜索结果页

路由：`#/search?q=...`

布局采用现有 SAPD 工作台模式，不做营销式页面：

- 左侧：范围筛选。
- 中间：结果列表。
- 右侧：选中结果摘要 / 路径 / 操作。

结果页筛选：

| 筛选维度 | 第一阶段取值 |
|---|---|
| 知识域 | 安全能力、信息化环境、知识库字典、标准 / 框架、LC-AP、LC-DT、指南 |
| 对象类型 | 能力、关注点、服务、模块、措施、安全系统、环境对象、标准控制项、生命周期阶段、页面 |
| 定位状态 | 可定位、只能打开、需要加载详情 |
| 匹配字段 | 标题、编码、路径、摘要、关键词 |

结果项字段：

| 字段 | 说明 |
|---|---|
| `title` | 用户可读业务标题 |
| `code` | 编码，如 `I-AP&T-AS.AD-01`、`AP-01` |
| `typeLabel` | 安全技术服务、标准控制项、环境对象等 |
| `domainLabel` | 所属知识域 |
| `path` | 用户可读路径 |
| `summary` | 命中摘要 |
| `route` | 目标页面 |
| `targetRef` | 业务定位锚点 |
| `locatable` | 是否可直接定位 |

### 页面内搜索组件契约

建议抽象为 `PageSearch` 等价契约，不必先做新框架组件，但所有页面使用同一组输入 / 输出约定。

```js
{
  scopeId: "environment-mapping",
  label: "筛选环境、对象、服务或模块",
  value: state.pageSearches[scopeId],
  placeholder: "筛选环境、对象、作用域、服务或模块",
  targetContainer: "#environmentDetail",
  mode: "filter-and-locate",
  onChange: setScopedSearch,
  emptyState: "未找到匹配项"
}
```

第一阶段页面落位：

| 页面 | 入口位置 | scope | 行为 |
|---|---|---|---|
| 安全能力映射 | 工作区控制轨右侧 | `capability-mapping` | 筛能力树和当前工作台，定位首个命中 |
| 信息化环境映射 | 环境对象树上方 | `environment-mapping` | 筛环境 / 子类 / 对象 / 服务 / 模块 / 措施 / 系统 |
| 知识库字典 | `app-page-header` 右侧 | `knowledge:*` | 筛当前目录 |
| 标准 / 框架 | `app-page-header` 右侧 | `standards:*` | 筛当前标准分片 |
| LC-AP | 阶段栏右侧 | `development-security` | 筛阶段 / 活动 / 服务 / 模块 |
| LC-DT | 过程栏右侧 | `data-security` | 筛过程 / 场景 / 服务 / 模块 |

## 状态模型

必须保留三类状态：

| 状态 | 用途 | 写入者 |
|---|---|---|
| `globalSearch.query` | 顶部全局搜索输入 | 顶部搜索框 |
| `searchPage.query` | 结果页查询，由 URL 驱动 | `#/search?q=...` |
| `pageSearches[scopeId]` | 页面内局部搜索 | 页面搜索框 |

禁止：

- 全局搜索写入 `pageSearches`。
- 页面内搜索写入 `globalSearch.query`。
- 搜索结果点击后把关键词灌入目标页搜索框。
- 结果定位失败后反复全 DOM 扫描。

允许：

- 全局搜索结果携带 `targetRef`。
- 目标页加载 projection 后按 `targetRef` 定位。
- 如果目标页未暴露锚点，显示“已打开页面，未能定位到具体项”。

## 数据与加载边界

### 全局搜索

首选数据源：`/api/v1/search-index`。

输入阶段不得加载：

- `environment-workbench.json`
- `capability-workbench.json`
- `maintenance-knowledge.json`
- `lifecycle-workbench.json`
- 标准详情全表
- 指南 / 幻灯片完整正文包

### 页面内搜索

只使用当前页面已经加载的 projection。

环境页第一阶段应使用：

- `environment/navigator.json` 或等价导航 projection。
- 当前选中对象的 `environment/projections/*`。
- 不读取全量 `environment-workbench.json`，除非 split manifest 不可用且进入显式 fallback。

## OI-154 环境页优先修复范围

环境页搜索是 `OI-154` 第一优先级。

必须覆盖：

- 信息化环境标题。
- 环境子类标题。
- 信息化对象标题。
- 作用域。
- 安全技术服务。
- 安全技术模块。
- 安全技术措施。
- 安全系统。

行为规则：

- 命中树节点时展开父级并选中首个命中。
- 命中当前对象映射图节点时滚动并高亮。
- 命中非当前对象时先切换到对应对象，再定位。
- 无结果显示局部空态，不显示数据包缺失。
- 搜索不改变顶部全局搜索框。

## 实施顺序

### P0：提交与边界收口

- 先 checkpoint 当前 `OI-149` / 能力页 dirty worktree。
- 本设计作为 `OI-154` 和 `OI-155` 的共同入口。
- `OI-144` 后续标记为历史基线，不再追加任务。

### P1：OI-155 全局搜索结果页骨架

目标：建立产品形态，不扩大数据面。

改动范围建议：

- `AppShell.js`：新增 `/search` 路由和页面标题。
- `app.js`：新增 `search` view 或 workbench 分支。
- `styles.css`：新增搜索结果页工作区样式。
- `dataClient.js`：复用已有 `getSearchIndex()`。
- `audit_search_state_isolation.mjs`：断言 `Enter -> #/search?q=...`。

验收：

- 顶部搜索 `Enter` 进入 `#/search?q=...`。
- 轻量面板保留，但有 `查看全部结果`。
- 搜索结果页能显示结果列表和筛选。
- 点击结果不写页面搜索框，只带 `targetRef`。

### P2：OI-154 PageSearch 契约与环境页修复

目标：先把环境页页面内搜索修到可用，再推广统一契约。

改动范围建议：

- `EnvironmentLocalRelationMap.js`
- `EnvironmentTree.js`
- `viewModels.js`
- `app.js`
- 新增 `audit_environment_search_contract.mjs`

验收：

- 环境页能搜索环境、子类、对象、作用域、服务、模块、措施、安全系统。
- 命中对象外内容时能切换对象并定位。
- 页面搜索不触发全局搜索、不读全局索引。

### P3：页面内搜索统一治理

按页逐步收口：

1. 能力页。
2. 字典页。
3. 标准 / 框架页。
4. LC-AP / LC-DT。
5. 工作台 Issue 页如需纳入，再作为独立 scope。

不得把所有页面搜索在一个提交里一起改。

## 验收矩阵

| 验收项 | OI-155 | OI-154 |
|---|---:|---:|
| 顶部搜索不写页面搜索 | 必须 | 回归 |
| 页面搜索不写顶部搜索 | 回归 | 必须 |
| `Enter` 进入 `#/search?q=...` | 必须 | 不涉及 |
| 搜索结果页筛选 | 必须 | 不涉及 |
| 结果点击用 `targetRef` | 必须 | 支撑 |
| 环境页局部搜索可用 | 不涉及 | 必须 |
| 不加载大 JSON | 必须 | 必须 |
| 无结果局部空态 | 不涉及 | 必须 |

必跑命令：

```bash
node scripts/audit_search_state_isolation.mjs
node scripts/audit_global_search_index_contract.mjs --url http://127.0.0.1:5173
node scripts/audit_frontend_lazy_load_contract.mjs
node scripts/frontend_content_smoke_check.mjs --skip-api --url http://127.0.0.1:5173
python3 scripts/dev_server_guard.py --status
git diff --check
```

`OI-154` 环境页修复后新增：

```bash
node scripts/audit_environment_search_contract.mjs --url http://127.0.0.1:5173
```

## 回退策略

- `OI-155` 搜索结果页可通过路由回退，不影响现有业务页面。
- 顶部搜索轻量面板可保留作为 fallback。
- `OI-154` 每次只改一个页面搜索，环境页失败只回退环境页相关改动。
- `search-index` 继续作为新增轻量源，不替换正式业务包。
- 任何阶段不得删除旧全量 JSON fallback。

## 设计确认点

进入代码前需要确认两点：

1. `OI-155 P1` 是否按“先搜索结果页骨架，不做复杂排序和收藏 / 批注搜索”实施。
2. `OI-154 P2` 是否按“环境页优先，其它页面逐页治理”实施。
