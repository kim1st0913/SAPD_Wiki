# 知识库字典前端页面交接

日期：2026-06-01

## 1. 本轮结论

知识库字典仍然复用 `frontend/capability-browser/` 的 `maintenanceWorkspace`，不是独立新页面。

本轮重点已经从“新增页面”转为“统一知识库字典二级目录的页面结构、字段边界、表格密度和可读性”。当前最需要交接的是：

1. 安全能力清单已新增为二级页面，并按 `L0 能力分类 -> L1 能力域 -> L2 安全能力 -> 关注点` 展示。
2. 知识库字典目录类表格的长文本基线已调整为：关键定义 / 描述字段完整换行展示，不再用固定行数省略隐藏主业务信息。
3. 安全能力清单打开时默认全部收起；搜索状态自动展开命中结构。
4. 知识库字典页面主表不得展示未经用户确认的衍生字段、维护字段、来源字段或调试字段。
5. 安全能力清单应作为同类型层级目录页的全局开发基准，知识库字典、安全标准 / 框架下的同类页面都可以复用这套要求。

## 2. 当前知识库字典二级入口

当前主导航中的知识库字典二级入口包括：

| 页面 | 路由 | 说明 |
|---|---|---|
| 安全能力清单 | `/knowledge/capabilities` | 新增页面，展示能力分类、能力域、安全能力、关注点 |
| 安全能力作用域目录 | `/knowledge/scopes` | 作用域目录 |
| 安全技术服务清单 | `/knowledge/technical-services` | 技术服务目录 |
| 安全技术模块/措施清单 | `/knowledge/technical` | 模块 / 措施复合页 |
| 安全管理工作/流程清单 | `/knowledge/management-workflows` | 安全工作 / 流程复合页 |
| 应用系统目录 | `/knowledge/application-systems` | 应用系统类型目录 |
| 安全职能清单 | `/knowledge/functions` | 安全工作职能、GB/T 42446、Gartner 岗位参考 |
| Hype Cycle | `/knowledge/hype-cycle` | 预留 |
| 其他知识目录 | `/knowledge/others` | 预留 |

相关路由和菜单主要在：

- `frontend/capability-browser/components/AppShell.js`
- `frontend/capability-browser/viewModels.js`
- `frontend/capability-browser/components/MaintenanceShell.js`

## 3. 当前数据链路

知识库字典页面仍按以下链路处理：

```text
原始 Excel / PDF / 维护数据
  -> ETL / export
  -> public/data/*.json 或本地 API
  -> dataClient.js
  -> viewModels.js
  -> components/*MaintenanceTable.js
  -> MaintenanceDetailPanel.js
```

本轮安全能力清单页面的数据来源是 `capability-tree.json`，不是 `maintenance-knowledge.json` 中临时拼出来的关系。前端只消费 ViewModel 投影后的业务字段：

- `capabilityGroups`
- `code`
- `title`
- `capabilityDefinition`
- `focusDescription`
- `focuses`

不要在组件里直接从原始 Sheet、来源字段或中间字段推断业务关系。

## 4. 已落地的关键页面规则

### 4.1 字段边界

主展示区不得出现以下字段：

```text
sheet, row, column, raw_value, source_file, import_id, source_id,
source_ref, source_label, debug, raw, metadata, intermediate, generated_at
```

用户已明确要求：非原始业务字段不要进入前端主表。即使数据包里有候选映射、维护状态、来源追踪或中间统计，也不能自动上表。

典型例子：

- `Gartner 工作岗位参考` 主表已移除 `候选安全职能`、`映射状态`、`匹配依据`。
- 岗位参考页保留原始业务字段，候选映射后续只能在用户明确要求的校对 / 维护视图中展示。

### 4.2 表格长文本基线

全局基线文件：

- `docs/06-implementation/frontend-global-design-baseline-2026-05-30.md`

当前规则：

- 关键定义 / 描述字段必须完整换行展示。
- 适用对象包括：安全能力定义、关注点描述、工作任务描述、技术模块定义、技术措施定义。
- 次要说明字段才允许折叠、省略或放到详情里。
- 不能为追求表格密度把主业务定义截断成省略号。

对应样式调整在：

- `frontend/capability-browser/styles.css`
  - `.maintenance-description-cell span`
  - `.standard-group-description`

### 4.3 层级目录默认行为

安全能力清单当前默认全部收起：

- 无搜索词：所有 L0 能力分类默认收起。
- 有搜索词：自动展开命中结构，避免看不到搜索结果。

实现位置：

- `frontend/capability-browser/components/CapabilityDirectoryMaintenanceTable.js`

关键逻辑：

```js
const expanded = expandAll;
```

不要恢复为 `expandAll || index === 0`，否则页面首次打开又会自动展开第一组。

## 5. 当前关键文件

| 文件 | 当前职责 |
|---|---|
| `frontend/capability-browser/components/CapabilityDirectoryMaintenanceTable.js` | 安全能力清单表格，控制 L0 / L1 / L2 / 关注点层级展示、默认收起和搜索展开 |
| `frontend/capability-browser/components/TechnologyModuleMaintenanceTable.js` | 安全技术模块目录表格，已按“领域分类 / 安全系统”层级基线调整过 |
| `frontend/capability-browser/components/StandardRoleReferenceTable.js` | GB/T 42446 与 Gartner 岗位参考表格，Gartner 主表已收回到原始业务字段 |
| `frontend/capability-browser/styles.css` | 全局表格、长文本、导航、工作区样式；当前文件已超过治理基线，后续谨慎追加 |
| `frontend/capability-browser/index.html` | 静态脚本缓存版本，改组件后需要更新对应 `?v=` |
| `frontend/capability-browser/viewModels.js` | 知识库字典 ViewModel 投影，允许做展示整理，不做 ETL 或关系推断 |
| `docs/06-implementation/frontend-global-design-baseline-2026-05-30.md` | 当前前端全局设计基线 |
| `docs/06-implementation/open-issues.md` | 当前未关闭问题入口 |
| `progress.md` | 轻量恢复入口，本轮已保持 120 行以内 |

## 6. 本轮验证状态

最近知识库字典相关验证通过项：

```bash
node --check frontend/capability-browser/components/CapabilityDirectoryMaintenanceTable.js
git diff --check
python3 scripts/dev_server_guard.py --status
node scripts/frontend_smoke_check.mjs --page maintenance --route /knowledge/capabilities --url http://127.0.0.1:5173/
python3 scripts/check_github_data_boundary.py
```

已做过的定点断言包括：

- 安全能力清单默认无搜索时不再输出 `depth-0 expanded`。
- 搜索态仍输出展开结构。
- 安全能力清单组件不再使用 2 行 clamp 截断关键描述字段。
- 缓存版本已更新到 `knowledge-collapsed-default-20260601-1`。

未完全通过项：

```bash
node scripts/audit_frontend_governance.mjs
```

失败原因是既有样式文件超过当前治理基线：

- `frontend/capability-browser/styles.css` 行数超过基线。
- `frontend/capability-browser/styles.css` 中 `important` 数超过基线。

本轮没有新增 `important`。下一轮如果继续改 `styles.css`，应优先考虑收敛旧样式或局部组件化，避免继续膨胀。

## 7. 当前待注意问题

### 7.1 文档和代码存在多轮历史修正

`progress.md` 中早期记录包含“描述字段单行省略”“两行 clamp”等中间状态。最新状态以本文和以下文件为准：

- `docs/06-implementation/frontend-global-design-baseline-2026-05-30.md`
- `frontend/capability-browser/styles.css`
- `frontend/capability-browser/components/CapabilityDirectoryMaintenanceTable.js`

最新规则是：关键定义 / 描述字段完整换行展示。

### 7.2 `styles.css` 已是治理风险点

后续不建议继续在 `styles.css` 末尾追加大量覆盖。更稳妥的顺序：

1. 先确认是否已有全局类可复用。
2. 小范围改已有选择器。
3. 新增组件内 class 时保持 scoped。
4. 修改后运行 `audit_frontend_governance.mjs`，如果失败要说明是否既有债务。

### 7.3 知识库字典还有页面需要统一默认行为

用户已明确：`安全能力清单` 应作为全局设计基准。下一轮同类层级目录应统一为：

- 默认收起。
- 搜索展开。
- 关键定义完整展示。
- 不展示非业务衍生字段。

适用范围不只限于知识库字典，也包括安全标准 / 框架下同类型的层级目录、标准分组、条款 / 控制项目录。优先检查：

- 安全技术模块/措施清单
- 安全管理工作/流程清单
- 安全职能清单
- 安全标准 / 框架下同类型层级目录

## 8. 下一轮建议

建议下一轮按以下顺序继续：

1. 抽查安全技术模块/措施清单是否仍有关键定义被截断、层级默认展开过多、非业务字段进入主表。
2. 把“默认收起、搜索展开、关键描述完整展示”的规则推广到同类层级目录。
3. 不要马上做大范围 `styles.css` 重构；先用现有基线补齐页面行为。
4. 若要继续治理前端体积，单独开任务处理 `styles.css` 超基线和 `important` 超基线问题。

## 9. 交接给下一进程的快速入口

下一进程开工建议先读：

1. `CURRENT_STATE.md`
2. `progress.md`
3. 本文
4. `docs/06-implementation/frontend-global-design-baseline-2026-05-30.md`
5. 目标页面对应的 `*MaintenanceTable.js`

如果只继续安全能力清单，不需要读取完整归档、不需要读取 `public/data/*.json` 全量内容、不需要重跑 ETL。
