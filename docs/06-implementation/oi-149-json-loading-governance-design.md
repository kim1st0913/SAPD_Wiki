# OI-149 JSON 加载治理设计

## 目标

`OI-149` 不是单个页面的慢加载 bug，而是前端数据加载边界反复被绕开的治理问题。本方案目标是把“页面慢、切换卡、偶发不可点击、前后端 fallback 混乱”拆成可度量、可验证、可回退的加载契约，避免继续用局部补丁修一处坏一处。

## 当前事实

当前主要数据包体量如下：

| 包 | 当前大小 | 说明 |
|---|---:|---|
| `maintenance-knowledge.json` | 10193.2 KB | 字典全量包，包含大量来源字段 |
| `environment-workbench.json` | 7109.0 KB | 信息化环境全量 workbench |
| `capability-tree.json` | 6394.8 KB | 能力树与映射基础包 |
| `capability-workbench.json` | 5659.7 KB | 能力 workbench 全量包 |
| `lifecycle-knowledge.json` | 5652.7 KB | 生命周期全量知识包 |
| `shared-lookups.json` | 5143.7 KB | 共享索引包 |
| standards split 总量 | 8463.5 KB | `standards-index.json` 很小，但详情分片总量大 |
| `lifecycle-workbench.json` | 1871.1 KB | 生命周期 workbench |

2026-06-30 继续实施后，P0 / P1 / P2 / P3 已完成代码级收口，P4 已完成候选拆包与预算审计：

- P0：`dataClient.getHealth()` 已只读运行健康，不再预热全部 `DATA_PATHS`；全局搜索输入阶段不再预加载完整 workbench、完整字典、环境全量包或标准详情全表。
- P1：新增 `/api/v1/search-index` 运行时轻量索引，前端全局搜索优先读取索引结果，并只合并当前会话已加载数据作为补充；`audit_global_search_index_contract.mjs` 已防止回退为全包扫描。
- P2：能力页 L0 / L1 / L2 / 关注点对象级 projection 已补齐聚合 `localRelationMap` 和 `localRelationMapsByFocusId`；`audit_capability_viewmodel_contract.mjs` 样本全部为 `backend_projection`。
- P3：后端 `read_data_package()` 与 standards compat 读取已增加按 `size + mtime_ns` 的进程内缓存。
- P4：已新增 `scripts/build_oi149_split_candidate.mjs`、`scripts/audit_oi149_split_candidate.mjs`、`scripts/audit_oi149_split_runtime_contract.mjs`、`scripts/apply_oi149_split_candidate.mjs` 和 `scripts/audit_oi149_readiness.mjs`，生成候选目录 `data/exports/worker-verify/oi-149-p4-json-split-candidate/`。用户已接受 P4 候选方向、预算、顶层能力标准明细延迟加载和 `shared-lookups` 暂不继续拆；随后完成 Fix-A 和 P4-B：能力页加载态请求结束后会重渲染，projection mismatch / error 会进入失败态并支持重试；能力 L0 / L1 projection 改为总览型，不默认携带完整标准控制项、技术映射明细和管理映射明细。最新候选首屏最大 `758.7 KB`、对象详情最大 `915.5 KB`、字段边界失败 `0`。正式 apply 已于 2026-06-30 执行：`frontend/capability-browser/public/data/` 新增 `oi149-split-manifest.json`、`capability/`、`environment/`、`lifecycle/`、`maintenance/`、`shared-lookups/`、`standards/` 分片目录，共创建 `315` 个分片文件，`wouldOverwriteCount=0`；旧全量包继续保留作为 fallback。前端 `dataClient` 已具备 manifest 探测、`capability/index.json` 能力首屏读取、`environment/navigator.json` 环境首屏导航读取和 `environment/projections/*` 环境详情 projection 读取路径：manifest 缺失时仍回退 `/api/v1/capabilities/workspace-initial` 或旧 `environment-workbench.json`。post-apply readiness 已通过 `commandCount=27`、`failedCommandCount=0`、`failedGateCount=0`。后续重点不是继续扩大拆包，而是人工验收核心页面、保留旧全量包观察，并在 `OI-156` 中一次性修批注终态。

原始排查时，现有懒加载审计通过，但仍有四类绕过点；下列绕过点中的 P0 / P1 / P2 / P3 项已在 2026-06-30 收口，保留在这里作为根因记录和防回归依据：

1. `dataClient.getHealth()` 曾经会 `Promise.allSettled(Object.keys(DATA_PATHS).map(fetchPackage))`，健康检查会触发全部数据包读取与解析。
2. 全局搜索 `ensureGlobalSearchPackages()` 曾经会一次性加载 `capability`、`maintenanceKnowledge`、`lifecycle`、`lifecycleWorkbench`、`content`、`standards`、`environmentWorkbench`；随后 `ensureGlobalSearchStandardDetails()` 会继续加载所有标准详情表。
3. 能力页虽然有 `/api/v1/capabilities/workspace-view`，但原始契约审计曾显示 L0 / L1 / L2 样本仍为 `viewmodel_fallback`，只有关注点级样本为 `backend_projection`。这会让上层能力选择重新依赖前端完整 workbench 兜底。
4. 后端 `capability_workspace_projection()` 每次请求曾经都会重新读取并解析 `capability`、`maintenance`、`shared-lookups`，标准摘要还会读取 `capability-workbench`；`read_data_package()` 当时没有包级缓存。

因此，慢加载反复出现的根因不是“某个 JSON 偶然大”，而是加载职责没有硬边界：健康检查、搜索、fallback、后端 projection 都可能绕过路由懒加载。

## 搜索问题边界补充

2026-06-30 用户进一步确认：全局搜索本身需要重新设计，不能只作为 `OI-149` 的性能子项处理。

边界调整如下：

| 问题 | 归属 |
|---|---|
| 全局搜索输入阶段加载过多 JSON | `OI-149` |
| `search-index` 生成、预算和懒加载契约 | `OI-149` |
| 顶部全局搜索是否保留、是否新增独立搜索结果页 | `OI-155` |
| 全局搜索与模块内搜索的产品职责划分 | `OI-155` |
| 环境页等页面内搜索无法使用 | `OI-154` |
| 批注定位慢、定位不到、高亮不稳定 | `OI-150` / `OI-151` / `OI-156` |

因此，`OI-149` 后续实施不得直接重做搜索 UI 或搜索结果页；它只负责确保全局搜索不再绕过懒加载和数据包边界。全局搜索产品形态以 `docs/06-implementation/global-search-contract-2026-07-05.md` 为准。

## 批注准出边界

2026-06-30 用户修正主线：批注定位 / 高亮终态修复不应抢在 `OI-149` 前完成。批注依赖页面 DOM、当前选中对象、`target_ref`、projection 字段和懒加载后的节点；如果 JSON 分片和 projection key 还会变化，先全面修批注会反复失效。

`OI-149` 的批注准出只做三件事：

1. projection 必须明确稳定对象身份字段：`object_type` / `object_id` / `code` / `title` / `target_ref` 或等价字段不能在拆包后丢失。
2. 旧批注兼容策略必须在 apply 前写清楚：旧 `target_ref` 能直接命中、需要进入子节点 / 关注点、或只能显示“目标未加载 / 可重试”的场景要可区分。
3. 批注失败定位不能拖死页面：`jumpToUserNote()` 的失败重试、DOM 标记刷新和文本 fallback 必须有次数 / 耗时熔断。

本阶段不把环境页、能力页、LC 页面旧批注兼容、高亮统一样式和真实浏览器定位作为终态修复目标；这些归入 `OI-156` 后续专项，在 `OI-149` 正式 apply 稳定后一次性修。

## 治理原则

1. **健康检查只检查服务健康**
   `/api/v1/health` 和 `dataClient.getHealth()` 不能读取或解析业务数据包。数据包健康另走 manifest / audit，不放进运行时首屏。

2. **页面只加载当前路由的最小 projection**
   每个页面必须声明首屏包、按选择加载包、可延后包和禁止首屏包。路由加载不得被搜索、健康检查或全局组件隐式扩大。

3. **全局搜索只读专用索引**
   全局搜索首个输入不能加载全量 workbench、全量字典或标准详情。必须使用独立 `search-index`，只包含 `title/code/type/route/target_ref/target_text` 等定位所需字段。

4. **fallback 必须显式、可观测、可阻断**
   fallback 不能静默拉完整包。每次 fallback 必须写入 `data_state` / `load_source` / `warnings`，并被审计脚本统计。禁止把 full package fallback 当成正常路径。

5. **后端 projection 负责对象粒度**
   能力 L0 / L1 / L2 / 关注点、环境 / 子类 / 对象、LC 阶段 / 过程，都应由后端或 dataClient 契约返回当前对象 projection。ViewModel 只做展示整理，不再拼业务事实。

6. **加载性能要有预算**
   治理不是“感觉快”。每条核心路由必须有预算：首屏请求数、首屏 JSON 字节数、主线程解析时间、fallback 次数、最大并发数。

## 分阶段方案

### P0：止血与可观测

目标：不重建正式 JSON，先切断最容易绕过懒加载的入口。

- `dataClient.getHealth()` 改为只读 `/api/v1/health`，不再 `fetchPackage()` 全量数据包。
- 增加加载追踪：记录每个 `loadDataPackage()` 的包名、触发原因、路由、耗时、字节数、是否 fallback。
- 增加审计脚本，断言：
  - `getHealth()` 不包含 `Object.keys(DATA_PATHS).map(fetchPackage)`。
  - 全局搜索不直接加载 `environmentWorkbench`、`maintenanceKnowledge`、`lifecycleWorkbench`、标准详情全表。
  - 能力页首屏只允许 `capabilityInitial` 和运行时 health。
- 全局搜索先降级为“当前已加载数据 + 轻量导航索引”，未加载领域显示可点击跳转，不在输入时预热全量包。

验收：

- 固定入口 `/capability-mapping` 首屏不加载 `capability-tree.json`、`capability-workbench.json`、`maintenance-knowledge.json`、`standards` 详情分片。
- 健康检查不会触发任何业务包读取。
- 不改正式 JSON，不改原始 Excel，不写 SQLite。

### P1：搜索索引独立化

目标：把全局搜索从“全包扫描”改为“索引检索 + 目标懒加载”。

- 生成 `search-index.json` 或 `/api/v1/search-index`，字段仅限：
  - `id`
  - `type`
  - `typeLabel`
  - `title`
  - `code`
  - `subtitle`
  - `route`
  - `target_ref`
  - `target_text`
  - `object_type`
  - `object_id`
- 索引预算建议小于 `800 KB`，超过则按领域拆分。
- 点击结果时再按 route 加载对应 projection，不在搜索输入阶段加载详情。
- 标准 / 框架搜索先查索引，进入某个标准表后再加载该表分片。

验收：

- 输入全局搜索首个有效字符，只加载 search index，不加载标准详情、环境 workbench、能力 workbench。
- 搜索结果点击后仍能定位到目标页面和业务锚点。

### P2：能力页 projection 收口

目标：关闭能力页 L0 / L1 / L2 对完整 workbench 的依赖。

- `/api/v1/capabilities/workspace-view` 对 L0 / L1 / L2 / 关注点都返回完整当前对象 projection：
  - `selected`
  - `graph`
  - `summary`
  - `technicalMappingRows`
  - `managementMappingRows`
  - `standardMappingRows`
  - `localRelationMap`
  - `localRelationMapsByFocusId`
  - `data_state`
  - `load_source`
- 前端 `renderCapabilities()` 不再因为上层对象进入 `viewmodel_fallback` 拉 full workbench。
- 保留 full workbench 作为开发诊断或离线 fallback，但必须显示 `load_source=full_workbench_fallback` 并被审计计数。

验收：

- `audit_capability_viewmodel_contract.mjs` 中 L0 / L1 / L2 / 关注点样本全部为 `backend_projection` 或等价对象级 projection。
- 任一对象选择下，左侧选中、右侧标题、图谱中心、`localRelationMap.focus` 粒度一致。

### P3：后端包缓存与 projection 服务化

目标：减少重复磁盘读取和 JSON parse。

- `read_data_package()` 增加进程内缓存，缓存 key 至少包含 path、mtime、size。
- 数据包变更后自动失效，开发环境保持 no-store 前端语义，但后端不重复 parse 未变化包。
- 对重包 projection 做领域级 helper：
  - capability selected object projection
  - environment selected object projection
  - lifecycle selected process projection
  - maintenance selected section projection
  - standards selected table projection

验收：

- 连续请求同一 projection 不重复读取和解析未变更 JSON。
- 服务重启后缓存清空，数据包更新后能自动失效。

### P4：正式 JSON 分层

目标：让包结构天然符合页面加载，而不是靠前端约束救火。

- `capability-tree` 拆为：
  - `capability-index`
  - `capability-object-projections`
  - `capability-evidence`
- `environment-workbench` 拆为：
  - `environment-navigator`
  - `environment-object-projections`
  - `environment-evidence`
- `maintenance-knowledge` 以现有 section split 为主，逐步让页面不再加载全量 `maintenance-knowledge.json`。
- `shared-lookups` 拆为按用途的小索引，避免为了一个服务模块索引读取 5MB。
- standards 保持 index + per-table split，但搜索改走 search index，不直接扫详情。

验收：

- 任何核心页面首屏 JSON 小于 `1 MB`。
- 当前对象详情加载 JSON 小于 `1.5 MB`，特殊大标准表除外。
- 能力 L0 / L1 projection 必须是总览型：能力关系图谱、子能力列表、统计和主要覆盖摘要；不得默认携带完整 `objects` / `relations` 明细、完整标准控制项或完整映射行。
- 能力 L2 projection 可以按体量进入 `detail` 或 `mixed_summary`；关注点 projection 必须保留完整明细。
- 全量包只允许在导出、诊断或显式“加载全部”场景出现。
- `environment-navigator` 中每个导航行必须携带唯一 `projectionKey` / `projectionPath`；即使原始 navigator 存在重复 `node.id`，也必须满足 `navigator -> projection` 一行一文件、一 key 一命中。
- `audit_oi149_split_candidate.mjs` 必须检查 manifest path 唯一、navigator projection 字段完整、projection path 存在且唯一、projection 本体 roundtrip 一致、projection index 与 navigator 对齐、能力 L0 / L1 总览型 projection 和关注点明细 projection。
- `audit_user_annotation_contract.mjs` 在本阶段只作为批注熔断和基础锚点门禁：必须保证失败定位受控、失败态可见、目标身份字段不被 projection 调整删除；不得要求本轮提前完成旧批注全模块兼容和高亮终态修复。

## 可能导致页面不可用的影响面

治理本身如果做错，容易导致以下页面不可用或降级：

| 页面 | 风险 | 防护 |
|---|---|---|
| 安全能力映射 | L0 / L1 / L2 projection 不完整会导致图谱或关系表空 | 先补 API 契约和审计，再禁 fallback |
| 信息化环境映射 | 拆包后对象上下文、系统关系、批注锚点可能断开 | 先输出 selected object projection，不直接删 full workbench |
| 知识库字典 | section split 如果缺字段会导致某些目录空 | 保留 `maintenanceIndex` + section fallback |
| 标准 / 框架 | search index 不含表内目标会导致搜索只能跳页面 | 索引保留 `framework/table/control` 三级 target |
| LC-AP / LC-DT | projection 若不含原始业务字段搜索文本，旧批注恢复会失败 | 身份字段和兼容策略纳入 projection 验收，终态恢复后置到 `OI-156` |
| 指南 / 幻灯片 | 如果全局搜索不再全量扫 content，可能短期搜不到正文 | content 可先保留轻量索引，不加载完整 slide 内容 |
| 批注抽屉 | 依赖当前页面锚点和用户 API，不能被搜索/加载改造误伤 | 本轮只保证失败定位熔断和失败态，不提前做全模块高亮终态 |

## 防失败机制

1. 每个阶段只允许一个写入主线，不并行重构 `dataClient`、`app.js`、后端 API 和 JSON 生成器。
2. 每次只关闭一个 fallback；关闭前必须有等价 projection 审计通过。
3. 禁止直接覆盖正式 JSON。涉及拆包时先生成候选包和 diff，再由用户确认 apply。
4. 每轮必须记录：
   - 改了哪个加载入口；
   - 禁止了哪个隐式全包加载；
   - 哪些页面可能降级；
   - 如何回退。
5. 如果真实浏览器仍慢，先取加载 trace 和 network 摘要，不再凭感觉改 UI。

## P4 正式 Apply 结果与回退

当前 P4 已完成正式 apply，执行原则仍是“小步启用、旧包兜底、可回退”。

1. **Pre-apply 冻结**
   - 先运行 `node scripts/audit_oi149_readiness.mjs --url http://127.0.0.1:5173`，确认总控报告 `result=pass`、`failedCommandCount=0`、`failedGateCount=0`；如沙箱阻止访问本机 5173，只能先运行 `node scripts/audit_oi149_readiness.mjs --skip-runtime` 作为离线门禁，完整 runtime 门禁仍需在允许访问本机服务的执行上下文重跑。
   - 重新运行 `scripts/build_oi149_split_candidate.mjs` 和 `scripts/audit_oi149_split_candidate.mjs`。
   - 确认候选 `public-data` 运行文件为 `dataState=ready`，不得出现 `dataState=candidate` 或 `packageType` 含 `candidate` 的正式待复制文件。
   - 先运行 `node scripts/apply_oi149_split_candidate.mjs` 默认 dry-run，确认 `writesPerformed=false`、`formalPublicDataModified=false`、候选写入数量、备份目录和回退说明。
   - 记录候选目录、manifest、预算和 `navigator -> projection` 唯一命中结果。
   - 备份将要新增 / 替换的 `frontend/capability-browser/public/data/capability/`、`environment/`、`lifecycle/`、`maintenance/`、`shared-lookups/`、`standards/` 分片目录；旧全量包先保留，不删除。

2. **数据文件 apply**
   - 已运行 `node scripts/apply_oi149_split_candidate.mjs --apply --confirm-oi149-public-data-write`，将候选 `public-data/*` 复制到正式 `frontend/capability-browser/public/data/*` 的同名分片目录。
   - Apply 报告：`data/exports/worker-verify/oi-149-p4-json-split-candidate/formal-apply-reports/oi149-p4-apply-20260630T123957Z.json/md`。
   - 本次 `candidateFileCount=315`、`wouldWriteCount=315`、`wouldOverwriteCount=0`、`backupFileCount=0`，即只新增分片文件，没有覆盖旧文件。
   - 保留 `capability-tree.json`、`capability-workbench.json`、`environment-workbench.json`、`lifecycle-workbench.json`、`maintenance-knowledge.json`、`shared-lookups.json` 一轮作为兼容 fallback。
   - 已新增 split manifest，用于前端和审计确认当前运行的是 `OI-149 P4` 分片契约。

3. **运行时切换**
  - `dataClient` 先探测 split manifest / index；存在且版本匹配时，优先按 index + projection 读取。
   - `capability`：首屏读 `capability/index.json`；对象详情第一阶段继续走旧 `/api/v1/capabilities/workspace-view`，保持当前 ViewModel 契约稳定。后续再逐步把 L0 / L1 总览型 projection、L2 / 关注点 projection 接入运行时，不和正式数据 apply 混在一步里。
   - `environment`：首屏读 `environment/navigator.json`；选择环境 / 子类 / 对象后可按 `projectionKey`、`projectionPath`、`navOrdinal` 或对象 ID 读取 `environment/projections/*`；projection 缺失时回退旧 `environment-workbench.json`。页面 UI 是否立即切到 projection 详情可单独小步接入，不和正式数据复制混在一个不可回退步骤里。
   - `lifecycle`、`maintenance`、`standards` 按 index / section / projection 渐进切换；不在首屏加载全量知识包。

4. **Post-apply 验证**
   - 已运行 `node scripts/audit_oi149_readiness.mjs --mode postapply --url http://127.0.0.1:5173`。
   - post-apply readiness 已确认正式 `frontend/capability-browser/public/data/oi149-split-manifest.json` 存在、`contract=oi149-p4-split-v1`、`dataState=ready`，关键 split 文件存在，旧全量包仍保留作为 fallback；结果为 `commandCount=27`、`failedCommandCount=0`、`failedGateCount=0`。

5. **缓存版本**
   - `index.html` 中 `app.js`、`dataClient.js`、相关组件和 `styles.css` 版本已在本轮 OI-149 相关变更中提升。
   - 若用户浏览器仍出现旧链路，先看加载的脚本版本和 network 摘要，不直接改业务逻辑。

6. **回退方案**
   - 第一层回退：前端禁用 split manifest / split path，恢复读取旧全量包。
   - 第二层回退：删除或移走新增分片目录，保留旧全量包不变。
   - 第三层回退：按 `scripts/apply_oi149_split_candidate.mjs` 写出的 apply report 恢复 `formal-apply-backups/<timestamp>/public-data` 中的备份文件；对 apply 前不存在的新 split 文件按 report 删除；随后重跑 `frontend_content_smoke_check`、`audit_json_package_boundary`、`check_github_data_boundary`、5173 状态检查。

正式 apply 后不能立即删除旧全量包；至少保留到能力、环境、LC、维护、标准和批注熔断门禁全部通过并完成人工验收。

## 必跑验证

基础验证：

- `node scripts/audit_oi149_readiness.mjs --url http://127.0.0.1:5173`
- `node scripts/audit_oi149_readiness.mjs --skip-runtime`（仅在本机 5173 访问受限时作为离线补充，不替代完整 runtime 门禁）
- 正式 apply 后：`node scripts/audit_oi149_readiness.mjs --mode postapply --url http://127.0.0.1:5173`
- `node --check` 修改的 JS 文件。
- `node scripts/audit_frontend_lazy_load_contract.mjs`
- `node scripts/audit_capability_viewmodel_contract.mjs --url http://127.0.0.1:5173`
- `node scripts/audit_user_annotation_contract.mjs`
- `node scripts/audit_oi149_split_runtime_contract.mjs`
- `node scripts/frontend_content_smoke_check.mjs --skip-api`
- `python3 scripts/audit_json_package_boundary.py`
- `python3 scripts/check_github_data_boundary.py`
- `python3 scripts/dev_server_guard.py --status`
- `git diff --check`

新增治理验证：

- `audit_data_loading_budget`：检查每条核心路由允许加载的包和大小预算。
- `audit_global_search_index_contract`：检查全局搜索不加载全量 workbench / 标准详情。
- `audit_runtime_health_boundary`：检查 health 不读取业务包。
- `audit_projection_fallbacks`：统计 full package fallback，超过 0 必须解释。

真实浏览器验证需要用户明确批准后执行，重点看：

- `/capability-mapping` 首屏 network。
- 全局搜索输入首字的 network。
- L0 / L1 / L2 / 关注点切换耗时。
- 标准详情 tab 切换是否按表加载。
- 路由切换后页面是否可点击。

## 建议实施顺序

1. 先做 P0：切断 `getHealth()` 全包预热，限制全局搜索全包预热，补加载预算审计。
2. 再做 P2：能力页 L0 / L1 / L2 全部收口到对象级 projection，减少 full workbench fallback。
3. 再做 P3：后端包缓存，降低 projection 重复读取成本。
4. 最后做 P1 / P4：搜索索引和正式 JSON 分层。涉及正式数据包生成，必须先候选包、审计、用户确认，再 apply。

## 当前结论

`OI-149` 的治理方向应从“前端哪里慢修哪里”改成“加载契约 + 搜索索引 + projection 收口 + 后端缓存 + 拆包候选”的组合方案。优先级最高的不是立刻拆 JSON，而是先关掉 health / search / fallback 这些绕过懒加载的入口，并用审计脚本防止以后再次回退。
