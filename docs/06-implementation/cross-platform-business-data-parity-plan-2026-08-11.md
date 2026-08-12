# Web / Windows / macOS 业务数据与关系等价计划

> 状态：`Phase 0 PASS / Phase 1 PASS / Phase 2 Batch 1 Web + macOS ACCEPTED / Windows release permission gate / Batch 2 not authorized`
>
> 日期：2026-08-11
>
> 目标平台：本地 Web Runtime、macOS WKWebView App、Windows Electron App

## 1. 目标

本计划的验收目标不是“删除全部 JSON”，而是：

> 当前 Web 页面能够显示、搜索、定位和展开的全部业务数据与关系，必须由同一正式基础
> SQLite 生成，并在 Windows 与 macOS App 中以相同对象粒度和关系语义正常显示。

最终运行合同固定为：

```text
正式基础 SQLite
  -> 共享只读查询 / Projection Service
  -> /api/v1/* 稳定 ViewModel
  -> dataClient
  -> Web / macOS WKWebView / Windows Electron
```

桌面核心页面不得把 `public/data/*.json` 当成隐性必需数据源。JSON 可以继续承担配置、
manifest、测试 fixture、非业务静态素材索引或显式静态预览快照，但不能独立定义业务对象、
关系、统计或搜索结果。

## 2. 完成标准

只有同时满足以下条件，才能声明跨平台数据等价完成：

1. Web、macOS Runtime、Windows Runtime 使用同一发布版本和同一正式基础库 SHA-256。
2. 三个平台的关键 API 对同一查询返回相同业务对象 ID 集、关系边集合、统计口径和定位字段。
3. 当前 Web 可见的核心页面、字典、详情、关系、首页统计和搜索结果在两个 App 中可见且可定位。
4. 从干净 checkout 构建的桌面 Runtime 删除或改名业务 JSON 后，核心页面仍通过；若 SQLite
   或必要 API 缺失，Runtime 必须明确失败，不能静默回退陈旧文件。
5. macOS / Windows 包内用户库模板保持空白，真实用户笔记、收藏、Issue、历史、成熟度结果
   和恢复包不被读取、覆盖或带入发布物。
6. 迁移后的路由加载、搜索和对象切换不出现相对当前基线的实质性能退化；数据库 hash 不得在
   每次请求或每次页面打开时重算。

## 3. 当前事实与问题边界

2026-08-11 只读盘点：

- `frontend/capability-browser/public/data/` 当前共有 358 个 JSON：305 个 tracked、53 个 ignored。
- `src/sapd_wiki/api_server.py::DATA_PACKAGES` 当前公开 23 个名称、映射 22 个唯一 JSON 文件。
- 多个 `/api/v1/*` 端点内部仍调用 `read_data_package()`，属于“API 包装 JSON”，不是 SQLite 查询。
- 首页统计和全局搜索会跨 capability、environment、lifecycle、maintenance、standards、content
  等 JSON 重新聚合，因此 API health 成功不能证明业务数据完整或同源。
- Windows LC-AP 空数据只是该双事实源问题首次在 clean package 中暴露；当前 OI-149 split loader
  和 Windows 必需文件检查属于 0.4.0 止血，不是最终事实源合同。
- 当前 5173 监听记录不可作为稳定 Web 基线；后续基线采集必须先通过项目 guard，或使用隔离的
  ephemeral Runtime，不能复用不可达的 listener。

并非所有 JSON 都要迁移进基础库。必须先按以下所有权分类：

| 类别 | 示例 | 最终处理 |
|---|---|---|
| 基础业务对象 | 能力、关注点、环境、信息化对象、生命周期对象、服务、模块、措施、流程、职能、标准控制项 | SQLite 唯一事实源，API 投影 |
| 业务关系 | 能力支撑、环境映射、生命周期关联、服务 / 模块 / 措施关系、标准映射、证据引用 | SQLite 唯一事实源，API 投影 |
| 分析与检索 | 首页统计、全局搜索索引、分类计数、定位字段 | 从同一 SQLite 生成，不读取独立业务 JSON |
| 用户业务状态 | 笔记、收藏、Issue、历史、用户标签、成熟度项目 / 报告引用 | 保持既有用户状态所有权；只做平台等价和保护验证 |
| 内容资产 | PDF、PPT、图片、HTML、Draw.io、指南页面 | 继续作为受控包内资产；索引可进入内容资产库或受控 manifest |
| 运行配置 | release manifest、schema version、Runtime 配置、证书配置 | 可保留 JSON，不是业务事实源 |
| 测试证据 | fixture、golden sample、审计输出 | 可保留 JSON，不进入正式 Runtime 事实源 |

## 4. 页面与数据验收范围

“全部 Web 可见数据和关系”按业务表面分组，不按文件名逐个迁移：

| 业务表面 | 主要页面 / 能力 | 必须等价的内容 |
|---|---|---|
| 首页与导航 | `/` | 模块状态、对象统计、关系摘要、入口可用性 |
| 全局搜索 | `/search`、顶部搜索 | 结果对象、分类计数、排序、分页、`targetRef` 和落点 |
| 能力映射 | `/capability-mapping` | L0/L1/L2/关注点、技术 / 管理 / 标准关系、当前对象详情 |
| 环境映射 | `/environment-mapping` | 环境、子类、信息化对象、服务 / 模块 / 措施 / 系统关系 |
| 应用生命周期 | `/development-security` | LC-AP 阶段、活动、关系、证据和安全控制表 |
| 数据生命周期 | `/data-security` | LC-DT 阶段、策略矩阵、服务集合、证据和对象定位 |
| 安全知识字典 | `/knowledge/*` | 服务、模块、措施、流程、职能、工作清单及相互关系 |
| 标准 / 框架 | `/standards/*` | 框架、表、控制项、岗位参考、关系和搜索定位 |
| 指南与内容 | `/guides/*`、内容视图 | 页面索引、静态素材、正文与业务对象引用 |
| 成熟度 | `/workbench/maturity/*` | 模板、项目、评分、报告及知识对象引用；用户状态不被覆盖 |
| 用户工作台 | Issue、批注、收藏、历史、数据篮、导出 | 读写结果、对象锚点和跨平台持久化行为 |

UI 像素完全一致不是本计划的数据验收条件；对象身份、字段语义、关系集合、统计、搜索和定位
必须一致。平台外壳差异按各自 App 合同验收。

## 5. 目标后端合同

### 5.1 查询与投影所有权

- 复用现有正式基础库只读查询能力和 `BaseKnowledgeQueryService` 的版本 / 身份基础，不复制一套
  SQLite 访问层。
- 页面级树、图谱、矩阵和列表由共享 Projection Service 生成；MCP 策略和 UI ViewModel
  保持不同适配层，避免把 MCP 五工具权限模型直接变成页面 API。
- `api_server.py` 只负责 HTTP 路由、参数、响应 envelope 和错误映射，不继续累积跨域业务拼装。
- 首页统计和搜索使用同一 repository / projection 输入；前端不得从已加载页面包二次拼装全局事实。

### 5.2 版本与同源证明

每个发布候选生成一次不可变数据标识：

```json
{
  "knowledge_version": "...",
  "database_schema_version": "...",
  "source_db_sha256": "...",
  "projection_contract_version": "...",
  "content_asset_version": "..."
}
```

- 该标识进入 release manifest、Runtime health/version 响应和验收证据。
- SHA-256 在构建 / 发布验证阶段计算，不在每次 API 请求或 App 启动时遍历全树重算。
- API projection cache 只能按 `knowledge_version + projection_contract_version` 命中；基础库版本变化
  必须产生新 cache key，不能读取上一版本结果。

### 5.3 前端合同

- 页面组件只调用 `dataClient`。
- `dataClient` 的桌面 Runtime 模式只调用 `/api/v1/*`；API 缺失时显示明确错误，不自动读取业务 JSON。
- Web 开发也默认依赖本地 API。若需要纯静态预览，必须通过显式 preview 模式使用由同一
  Projection Service 生成且带数据库指纹的 snapshot，不能自动回退。
- 清理 `app.js` 中直接读取业务 `public/data` 的入口；静态素材读取不在此禁令内。

## 6. 分阶段实施

### Phase 0：建立 Web 业务基线与完整映射

产物：

- 页面 / dataClient 方法 / API / JSON / SQLite 表与字段的完整矩阵。
- 每个页面的黄金对象、黄金关系、数量口径、搜索词和定位目标。
- 当前 Web 的 API 响应摘要、语义 digest 和关键 DOM 验收证据。
- SQLite 尚未覆盖字段和关系的缺口清单；缺口未裁定前不得从前端 JSON 反向写库。

门：每个当前可见业务字段必须能归属为 `SQLite 字段`、`受控投影规则`、`用户状态` 或
`静态资产`。来源不明即为阻断项。

### Phase 1：建立共享查询、Projection 与发布身份基础

产物：

- 页面投影共用的只读 repository / service 边界。
- 统一 response envelope、错误状态、knowledge version 和 projection version。
- Web/macOS/Windows 共用的 release data manifest 与只读校验器。
- 语义 digest 工具：对对象 ID、关系三元组、计数和定位字段规范化后比较，不比较生成时间或文件顺序。

门：使用隔离候选数据库完成 API contract 测试；不修改正式 SQLite 和真实用户库。

### Phase 2：分域迁移业务页面

按耦合关系分五批，每批独立完成 SQLite -> API -> dataClient -> 页面：

1. `capability + maintenance + shared lookups`：能力树、关注点、服务、模块、措施、流程、职能和关系。
2. `environment`：环境、子类、信息化对象和全部对象级映射。
3. `lifecycle`：LC-AP、LC-DT、活动、策略、服务关系和证据；通过后替换当前 split 止血 loader。
4. `standards + content/guides index`：框架、控制项、岗位参考、内容入口和业务对象引用。
5. `dashboard + global search`：最后切换，确保聚合与索引只消费已经迁移完成的同源服务。

每批通过条件：

- API 与当前 Web 基线的对象、关系和字段语义等价。
- 页面不新增 ETL、匹配、关系推断或默认首对象 fallback。
- 当前批业务 JSON 缺失和陈旧两种负向场景均不影响 API 模式；SQLite 缺失则明确失败。
- 已迁移批次的定向性能不低于 Phase 0 基线允许范围；若变慢，先查查询 / 索引，不在前端复制缓存事实。

#### Phase 2 Batch 1 当前结论（2026-08-11）

- `capability + maintenance + shared lookups` 的 SQLite projection/API、ETL owner 修复和页面 /
  `dataClient` owner switch 已由专用任务安全整合到主工作区，并通过主控独立验收。当前批业务
  请求只使用 `/api/v1/projections/*`，无 JSON fallback、首项默认选择或前端 ETL。
- 用户授权的 relation-only 正式 apply 已通过主控验收：正式 artifact SHA 为
  `188f20efed31631f1f53219d4d8ef6f5e8c4fa5f2f07309b6bbe185994cf3680`，4694 个对象及
  owner 不变，关系 7786→7788，仅新增 I-AP / I-US 两条物理 `uses_measure`，projection
  `has_measure=53`，F/G provenance 为 `16 / 6`。
- apply 前完整回退包、逐文件 inventory 和三次候选→旧 SHA 恢复演练均已通过；后续发布门没有
  执行真实回退。owner switch、
  聚合关系去重和 catalog adapter 均保留精确反向 patch 与 pre-files。主控在空 `data-root`、
  只读正式库副本和 ephemeral user state 下完成 TC-010、API owner 与可见 DOM 验收。
- 同候选 packaged Web 与 macOS license / no-license 双 DMG 已完成：Batch 1 owner / TC-010、
  TC-023—027 均通过，base / content / knowledge / projection / frontend identity 一致；Windows
  Delivery Data 也已本地生成并验证。Windows Runtime / Setup 因没有当前 dirty snapshot 对应的
  原生 Windows x64 backend 而停在精确 commit / push、私有 Delivery Data 和私有 Windows Runner
  权限门。不得使用 retired 二进制替代，也不得开始 Batch 2 或声称 Windows 等价已完成。
- 2026-08-12 用户真实截图证明 active 5173 未被前述隔离 / packaged 验收覆盖：旧进程对新路由
  返回 404，重启后因开发 projection manifest 缺失返回 503。现已补齐与正式双库 CAS 一致的
  `data/database/base-manifest.json`，真实 `dataClient` 调用链恢复；`dev_server_guard` 也新增三条
  Batch 1 路由健康门，今后 404 / 503 不再显示 PASS。应用内浏览器策略拒绝 localhost，因此
  active 5173 的三个用户页面可见 DOM / 控制台仍需单独验收，不能以 dataClient 结果替代。

### Phase 3：用户状态、成熟度与静态资产平台等价

这些数据不因基础知识迁移而改所有权，只验证：

- 用户 SQLite 升级和空模板边界；笔记、收藏、Issue、用户标签、历史和导出不丢失。
- 成熟度项目、模板、评分和报告引用在三个 Runtime 指向同一知识对象身份。
- 指南 PDF/PPT/图片/HTML 等受控资产在两个桌面包完整，内容索引与 asset manifest 同源。
- 不把真实用户库、报告正文、源 Excel 或开发机缓存带入安装包。

### Phase 4：前端 API-only 与 clean Runtime

产物：

- 移除桌面核心方法的业务 JSON fallback 和直接 `fetch`。
- `/api/v1/data-packages/*` 中已迁移的“包装 JSON”入口退役或改为明确兼容 endpoint。
- Windows/macOS Runtime 必需文件清单改为“基础库 + backend + frontend + 受控资产 + manifest”，
  不再把业务 JSON 文件存在性作为核心页面健康条件。
- clean-package 测试从未携带 legacy / ignored JSON 的 checkout 构建并运行核心页面。

门：在 packaged-like Runtime 中对业务 JSON 返回 404，核心 API 和页面仍全部通过。

### Phase 5：双平台实包验收与旧 JSON 退役

顺序：

1. Web 基准 Runtime 完整通过。
2. macOS 当前源码构建 DMG，挂载后使用包内 Runtime 验证。
3. Windows clean runner 构建 Setup，安装后使用包内 Runtime 验证。
4. 比较三平台 data manifest、API 语义 digest、页面样例和搜索落点。
5. 只有同一候选实包通过后，才删除对应业务 JSON、旧 exporter 和发布规则。

不重新打包已经验收过的候选来“修证据”；任何修复都产生新的 build stamp 并重走本阶段。

## 7. 自动验收矩阵

| Gate | 验证 | 通过标准 |
|---|---|---|
| D0 数据身份 | 三 Runtime manifest | `knowledge_version`、schema、base DB SHA、projection version 一致 |
| D1 API 契约 | 全域 API golden tests | 对象 ID、字段、关系三元组、统计和错误状态一致 |
| D2 JSON 独立性 | packaged-like 业务 JSON 404 / stale | 核心 API 与页面仍通过；没有业务 JSON 请求 |
| D3 首页 | 首页统计探针 | 数量和入口状态来自 SQLite 投影，与 Web 基线一致 |
| D4 搜索 | 黄金词、反例、分页和定位 | 三平台结果集 / facets / `targetRef` 一致并能落到明确对象 |
| D5 核心页面 | capability/environment/lifecycle/maintenance/standards | 黄金对象详情和关系集合一致，无空页和首项伪成功 |
| D6 用户状态 | 临时用户库 + 旧 schema fixture | 写入、升级和重新打开通过；正式用户库 hash / 计数不变 |
| D7 资产 | 指南与内容 manifest | 包内资源存在、索引可用、不得依赖开发机绝对路径 |
| D8 性能 | Phase 0 与候选同机对比 | 无实质回退；搜索维持现有响应体预算，禁止请求时全库 / 全树 hash |
| D9 clean package | macOS staging / DMG、Windows Runtime / Setup | 未包含必需业务 JSON，核心路由和 API smoke 全通过 |

自动化负责对象、关系、计数、搜索和 API 等价；人工 UAT 只保留平台外壳无法可靠自动化的
安装、首次路径选择、窗口生命周期、文件选择器、系统权限和视觉可用性，降低用户验收负担。

## 8. 回滚与数据保护

- 每个域迁移独立提交和独立开关，下一域不得在上一域未通过时并行替换同一 dataClient owner。
- 迁移期间保留旧 JSON 仅用于测试对照和显式 preview，不作为桌面自动 fallback。
- 每批记录旧 API 语义 digest、新 API 语义 digest和基础库 hash；失败时回退代码和 Runtime，
  不回写正式数据库。
- 需要新增表、字段、索引或重生成正式基础库时，单独提交 migration / release 提案，包含备份、
  candidate、verify、apply、accept 和 rollback；本计划本身不授权该写入。
- 所有测试默认使用临时基础库副本、空用户库或 fixture。真实用户数据库和正式数据不得作为测试写目标。
- 本次 relation-only apply 的完整回退入口为
  `data/exports/worker-verify/phase2-batch1-formal-apply/phase2-batch1-20260811T090151Z/rollback-bundle/RECOVERY.md`，
  rollback manifest SHA 为 `5044be68f738caef0397274be5595902208b6232501fe5ff2d33c553937d5df6`。
  它冻结旧 base/content asset、完整 legacy Web 数据树、源码 / dirty identity、历史双 DMG、Windows
  Setup、可用 manifests 和用户库只读 schema 摘要，可执行恢复本次 DB apply。
- 当前 dirty Web 源码与历史三件桌面实包不是同一共同验收发布集，因此该 bundle 不能替代最终
  owner 切换前的 Web/macOS/Windows 新共同发布集和整体往返演练；恢复时禁止混搭旧 frontend 与
  新 DB，真实用户库必须原位保留。

## 9. 当前实施边界与下一步

Phase 0、Phase 1 已通过；Phase 2 Batch 1 data apply、代码整合、页面 owner switch、packaged
Web 和 macOS 双 DMG 已验收，Windows Delivery Data 已本地验收；Batch 2 `environment` 未授权。
当前仍不授权：

- 删除现有 JSON；
- 继续修改或重建正式 SQLite；
- 重打 macOS DMG 或构建 Windows Setup；
- 修改源 Excel、用户库、恢复包或真实用户状态；
- commit、push 或发布。

下一步仅在用户明确授权后将已验收 dirty snapshot 收口为精确 commit / push，发布私有不可变
Delivery Data，并由私有 Windows Runner 构建原生 backend 后完成 Windows Runtime / Setup
验收；未通过前不得开始 Batch 2，不得删除 legacy JSON 或扩大跨平台完成声明。既有完整回退包
作为恢复路径保留，除非发生需恢复的故障或用户明确要求，不执行实际回退。
