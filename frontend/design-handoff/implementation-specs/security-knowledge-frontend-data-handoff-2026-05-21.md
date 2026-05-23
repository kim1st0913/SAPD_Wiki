# 安全知识及下级子页面前端与数据交接

日期：2026-05-21

## 1. 当前定位

“安全知识”不是新的独立技术栈页面，目前运行在 `frontend/capability-browser/` 的静态 MVP 前端中，复用 `maintenanceWorkspace` 工作台。

当前路由入口在 `frontend/capability-browser/components/AppShell.js`：

| 路由 | 当前 section | 页面含义 |
|---|---|---|
| `/knowledge` | `scopes` | 默认进入安全能力作用域目录 |
| `/knowledge/scopes` | `scopes` | 安全能力作用域目录 |
| `/knowledge/technical` | `modules` / `measures` | 安全技术模块/措施清单；内部 Tab 为安全技术模块目录、安全技术措施目录 |
| `/knowledge/management-workflows` | `security-works` / `processes` | 安全管理工作/流程清单；内部 Tab 为安全工作清单、安全职能流程清单 |
| `/knowledge/functions` | `work-functions` / `references` | 安全职能清单；内部 Tab 为安全工作职能清单、岗位 / 职能参考目录 |
| `/knowledge/hype-cycle` | `content` placeholder | 预留页 |
| `/knowledge/others` | `content` placeholder | 预留页 |

兼容路由：`/knowledge/technical-modules`、`/knowledge/technical-measures`、`/knowledge/work-items`、`/knowledge/processes`、`/knowledge/role-references` 可继续映射到对应 section，但不作为主导航二级入口。

页面类型在 `docs/00-overview/frontend-menu-and-page-type-definition-v1.md` 中定义为 `knowledge-directory`，目标是目录检索、表格浏览、标签筛选、详情抽屉、来源证据和对象间关联；不适合做成长文档页、卡片墙或默认复杂关系图。

## 2. 关键原则

1. 数据事实在后端和 export 层生成，前端不推断业务关系。
2. `dataClient.js` 是页面数据入口，组件不得直接读取 `public/data/*.json`。
3. `viewModels.js` 只做展示层整理：过滤、排序、计数、字段改名、空状态、详情面板结构。
4. 主展示区不得出现 `sheet`、`row`、`column`、`raw_value`、`source_file`、`import_id`、`source_id`、`source_ref`、`source_label`、`debug`、`raw`、`metadata`、`intermediate`、`generated_at`。
5. 来源证据只进入折叠的 `SourceEvidencePanel`，默认不作为表格主列。
6. 不为了某个子页面临时硬编码 Excel 口径；缺字段时记录为数据契约缺口或 open issue。

## 3. 当前数据链路

```text
data/raw-samples/wiki sample.xlsx
  -> stage-excel / approve-import
  -> SQLite formal tables
  -> src/sapd_wiki/exports.py
  -> export-maintenance-knowledge
  -> frontend/capability-browser/public/data/maintenance-knowledge.json
  -> frontend/capability-browser/dataClient.js
  -> frontend/capability-browser/viewModels.js
  -> components/*MaintenanceTable.js + MaintenanceDetailPanel.js
```

标准 / 框架页面不再使用单一大包。当前安全标准 / 框架数据链路为：

```text
SQLite formal tables
  -> src/sapd_wiki/exports.py
  -> export-standard-frameworks-data
  -> frontend/capability-browser/public/data/standards-index.json
  -> frontend/capability-browser/public/data/standards/<framework>/<tab>.json
  -> frontend/capability-browser/dataClient.js
  -> frontend/capability-browser/viewModels.js
  -> components/StandardFrameworkTable.js
```

`standards-index.json` 只提供导航、统计、Tab 元数据和 `dataPath`，不得放表格 `rows`。`standards-data.json` 仅作为旧入口兼容索引，同样不得放全量 `rows`。单个标准或 Tab 的行数据必须进入 `public/data/standards/**` 分包，前端按当前页面和当前 Tab 按需加载。

当前首选数据包：

| 数据包 | 用途 | 说明 |
|---|---|---|
| `maintenance-knowledge.json` | 安全知识目录首选数据包 | `dataClient.getMaintenanceKnowledgePayload()` 优先读取 |
| `management-knowledge.json` | legacy fallback | 仅在 `maintenance-knowledge.json` 缺失时回退 |
| `capability-tree.json` | 安全工作清单需要能力 / 关注点树 | `security-works` 由关注点下 `security_works` 展示 |
| `lifecycle-knowledge.json` | LC-AP 参考数据 | 不应混入安全知识主目录，除非 section 明确是 `lcap-references` |
| `standards-index.json` | 安全标准 / 框架索引 | 只放标准目录、统计和分包路径 |
| `standards/<framework>/<tab>.json` | 安全标准 / 框架分包 | 只承载对应框架或 Tab 的行数据 |

当前 `maintenance-knowledge.json` 核心字段：

| 字段 | 页面 |
|---|---|
| `scope_types` | 作用域目录 |
| `security_processes` | 流程目录 |
| `work_function_layers` | 职能目录 |
| `security_technology_modules` | 安全技术模块目录 |
| `security_technical_measures` | 安全技术措施目录 |
| `gbt_42446_references` | GB/T 岗位 / 职能参考 |
| `gartner_roles` | Gartner 岗位参考 |

## 4. 当前前端文件分工

| 文件 | 职责 | 调整边界 |
|---|---|---|
| `components/AppShell.js` | 全站菜单、路由到 view/section 的映射 | 只改菜单、路由、页面标题，不写数据处理 |
| `dataClient.js` | API / 静态包读取和 fallback | 新数据包、新 API、新 section 入口先在这里接入 |
| `viewModels.js` | 安全知识各 section 的展示投影 | 可以做 UI-safe 字段整理，不做跨表业务推断 |
| `components/MaintenanceNavigation.js` | 旧左侧目录组件 | 安全知识页当前不再作为主入口展示，保留兼容 |
| `components/MaintenanceShell.js` | 页面标题、摘要、内部 Tab | 复合二级页面内部只做 section 切换，不生成业务关系 |
| `components/*MaintenanceTable.js` | 各目录表格 | 只渲染 ViewModel 字段 |
| `components/MaintenanceDetailPanel.js` | 右侧详情抽屉 | 只渲染 detailPanel，不直接读原始对象 |
| `components/SourceEvidencePanel.js` | 来源证据折叠区 | 允许展示来源字段，但必须保持折叠或次级位置 |
| `styles.css` | 安全知识工作台布局和表格视觉 | 统一表格密度、列宽、悬停、选中态 |

## 5. 建议的页面调整顺序

### 第一步：先统一页面骨架

目标：所有安全知识子页面使用一致的目录工作台结构。

建议结构：

```text
上方：页面标题 + 数量摘要 + 内部 Tab
中间：搜索 + 主表格
右侧：选中对象详情 + 关联对象 + 来源证据折叠
```

内部页面参考 `安全标准 / 框架` 的 CRF 页面：页面标题区承载数量徽标和搜索；工作区只保留主表格分区；页签在表格上方；表格保持密集、可核对。短表不做垂直居中，保持顶部对齐，并在表格底部显示“已显示全部 X 条记录”的收尾提示；长表继续使用工作区内滚动。实体详情和来源证据不作为默认分栏抢占主表空间，后续如需恢复，应做成次级抽屉或折叠区。不要在每个子页面重新设计完全不同结构。差异只体现在表格列和内部 Tab。

### 第二步：按二级页面分组

当前二级页面结构：

| 二级页面 | 路由 | 内部 Tab |
|---|---|---|
| 安全能力作用域清单 | `/knowledge/scopes` | 无 |
| 安全技术模块/措施清单 | `/knowledge/technical` | 安全技术模块目录、安全技术措施目录 |
| 安全管理工作/流程清单 | `/knowledge/management-workflows` | 安全工作清单、安全职能流程清单 |
| 安全职能清单 | `/knowledge/functions` | 安全工作职能清单、岗位 / 职能参考目录 |
| Hype Cycle | `/knowledge/hype-cycle` | 后续 |
| 其他知识目录 | `/knowledge/others` | 后续 |

### 第三步：按 section 梳理表格列

表格主列只保留业务核对所需字段：

| section | 建议主列 |
|---|---|
| `scopes` | 作用域编码、名称、情景、描述、关联服务数、关联对象数 |
| `modules` | 领域分类、安全系统、安全技术模块 / 定义、映射安全技术服务、措施 / 作用域 / 对象 / 环境 |
| `measures` | 措施名称、关联服务、适用作用域、关联环境、关联对象 |
| `security-works` | 安全工作编码、名称、能力、关注点、状态 |
| `processes` | 流程域、L2 流程组、L3 流程、L4 状态、关联关注点数、关联职能数 |
| `work-functions` | 职能层、职能组、职能编码、职能名称、关联安全工作数、关联流程数 |
| `references` | 来源、分类、参考条目、候选 / 关联职能、映射状态 |

安全技术模块目录的当前数据边界：

- `description` 已在 `maintenance-knowledge.json.security_technology_modules[].description` 中，主表应显示模块定义。
- 安全系统已在 `security_technology_modules[].systems[]` 中，属于安全技术模块的上级分类，应在主表显示。
- 安全技术服务已在 `security_technology_modules[].services[]` 中，主表不只显示数量，应显示映射到哪些服务。
- 领域分类来自原始 `安全技术模块清单` B 列，安全系统来自 C 列；B/C 两列是模块目录的两级分组，前端应按“领域分类 -> 安全系统 -> 安全技术模块”展开。
- 模块顺序应优先按原始 `安全技术模块清单` 行号，即 `display_order` / 来源行顺序；其他映射表带入且未进入基础清单的模块排在“未归入安全技术模块清单”分组。
- 模块到技术措施、作用域、信息化对象的关系当前维护包未提供稳定映射输入，不在前端临时反推；主表显示“当前维护包未包含模块-措施 / 作用域 / 对象映射”。信息化环境当前可由 `security_technology_modules[].environments[]` 展示，但不能替代信息化对象。

长描述不要挤满表格。表格里保留短文本或省略，完整内容放右侧详情或次级抽屉。

### 第四步：统一详情面板

每个 section 的详情面板建议保持同一结构：

```text
对象类型 / 编码
对象名称
定义或描述
关键事实 facts
关联对象 sections
来源证据 SourceEvidencePanel
```

现有入口在 `buildMaintenanceDetailPanel()`。下一轮调整时优先改这里，而不是在各表格组件里重复写详情逻辑。

### 第五步：再考虑关联视图

安全知识目录默认不做复杂关系图。只有当某类知识对象需要回答“它和哪些能力、作用域、服务、流程有关”时，才加轻量关联区。

推荐做法：

- 表格列显示数量或短 chip。
- 右侧详情显示完整关联 chip。
- 如需图谱，做成局部小图或可展开区域，不作为默认主视图。

## 6. 数据调整方法

### 6.1 如果只是改显示字段

只改：

1. `viewModels.js` 对应 `build*MaintenanceViewModel()`。
2. 对应 `components/*MaintenanceTable.js`。
3. 必要时改 `MaintenanceDetailPanel.js` 或 `styles.css`。

不要改 export，也不要重导数据。

### 6.2 如果现有数据包有字段但 ViewModel 没投影

先抽样检查数据包字段，建议用脚本或小段 Node 只输出字段摘要，不打印完整 JSON。

然后改：

1. `viewModels.js`：把字段纳入 UI-safe row。
2. 对应表格 / 详情组件。
3. 若字段来自 `sources` 或 `metadata`，只进入 `sourceEvidence`，不进入主表。

### 6.3 如果数据包没有字段

这是后端数据契约问题，不在组件里拼。

处理顺序：

1. 在 `docs/06-implementation/open-issues.md` 记录缺口。
2. 更新或新增数据契约说明。
3. 在 `src/sapd_wiki/exports.py` 补投影字段。
4. 运行：

```bash
python3 scripts/sapd_wiki.py export-maintenance-knowledge --output frontend/capability-browser/public/data/maintenance-knowledge.json
```

5. 再回到前端消费。

### 6.4 如果涉及安全标准 / 框架数据

安全标准 / 框架必须遵守分包契约：

1. 不再新增或恢复单一全量 `standards-data.json`。
2. `standards-index.json` 只能包含索引元数据、统计、列定义、Tab 定义和 `dataPath`。
3. 大表行数据写入 `public/data/standards/**`。
4. 多 Tab 标准按 Tab 拆分，例如 DSP SCF 2026 的 `SCF Controls` 与 `SCF成熟度`。
5. `dataClient.js` 负责读取索引和按需读取分包；组件不得直接 `fetch` 分包。
6. `viewModels.js` 可以透传 `dataPath`、`totalRows`、`loaded` 等展示状态，但不得反推标准映射关系。

## 7. 验证方法

### 7.1 静态检查

```bash
node --check frontend/capability-browser/app.js frontend/capability-browser/viewModels.js
node --check frontend/capability-browser/components/ScopeMaintenanceTable.js frontend/capability-browser/components/TechnologyModuleMaintenanceTable.js frontend/capability-browser/components/TechnicalMeasureMaintenanceTable.js frontend/capability-browser/components/ProcessMaintenanceTable.js frontend/capability-browser/components/WorkFunctionMaintenanceTable.js frontend/capability-browser/components/StandardRoleReferenceTable.js frontend/capability-browser/components/MaintenanceDetailPanel.js
git diff --check
```

### 7.2 数据包摘要

```bash
python3 scripts/data_package_summary.py --package maintenance
python3 scripts/data_package_summary.py --package standards
```

关注：

- `data_state` 是否为 `ready`。
- `scope_types`、`security_processes`、`work_function_layers`、`security_technology_modules`、`security_technical_measures`、`gbt_42446_references`、`gartner_roles` 数量是否符合预期。
- `standards` 摘要中 `path` 应为 `standards-index.json`，并显示 `split_files`。
- `standards-index.json` 和 `standards-data.json` 不得包含框架或 Tab 的 `rows`。
- 进入标准页时，只加载当前框架 / 当前 Tab 分包；切换 Tab 后才加载对应分包。
- 非业务字段是否只作为来源证据存在。

### 7.3 浏览器 smoke

建议服务已启动后执行：

```bash
node scripts/frontend_smoke_check.mjs --page maintenance --url http://127.0.0.1:5174/
```

如果 smoke 脚本尚未覆盖所有知识子路由，则至少手工检查：

- `/knowledge/scopes`
- `/knowledge/technical`
- `/knowledge/management-workflows`
- `/knowledge/functions`
- `/knowledge/hype-cycle`
- `/knowledge/others`

检查项：

- 全局导航二级入口显示为 6 个安全知识页面。
- 复合页面内部 Tab 数量和选中态显示正常。
- 搜索不报错。
- 表格选中行后右侧详情刷新。
- 详情区不显示原始来源字段。
- 来源证据只在折叠证据区域出现。
- 控制台无错误，页面无横向溢出。

## 8. 下一轮建议任务拆分

建议按下面顺序推进：

1. 只读核对安全知识所有子页面：截图、列宽、空状态、详情面板、来源证据、非业务字段。
2. 先修统一骨架和视觉密度：表格列宽、详情区层级、内部 Tab 样式。
3. 再按三组复合页面梳理模块 / 措施、管理工作 / 流程、职能 / 岗位参考的信息架构。
4. 最后才补数据字段或 export 投影。

不建议一开始做：

- 大规模改 `exports.py`。
- 把安全知识做成复杂大图谱。
- 把每个知识目录做成完全不同交互。
- 在组件里通过字符串匹配生成新业务关系。

## 9. 推荐验收口径

完成后应能回答：

1. 用户从“安全知识”进入后，能清楚看到有哪些知识目录。
2. 每个子页面都能快速检索、浏览、选中并查看详情。
3. 作用域、模块、措施、工作、流程、职能、岗位参考之间的关联以数量、chip 或详情 sections 表达清楚。
4. 主展示区没有泄露原始 Excel 字段。
5. 数据缺口有明确 open issue 或数据契约说明，而不是被前端临时隐藏。
