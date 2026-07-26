# 基础知识、Draw.io 与指南内容统一入库查询：今晚执行计划

- 状态：`t6_complete_post_apply_drawio_repair_complete`
- 修订日期：2026-07-26
- 开工前检查：2026-07-26 20:55（Asia/Singapore）
- 截止：2026-07-26 23:59（Asia/Singapore）
- 影响面：`data / ETL / package`、正式基础知识查询、内容资产数据库、Web/App API、SAPD MCP
- 用户决定：
  - 打包程序不依赖仓库原始文件，Draw.io 与正式指南文件必须进入数据库；
  - 入库后的 Draw.io、SVG、PPTX、PDF、Markdown、HTML 等资产使用正式业务名称的英文文件名，禁止使用 `sample`、`samle` 或 Office 临时文件名；
  - 仓库中的原始源文件保持只读且不重命名；正式英文名称作为资产库、asset API、下载和交付导出的逻辑文件名；
  - ArchiMate Poster 不做 OCR；
  - PPTX 与 PDF 同时存在时，优先使用 PPTX 作为语义抽取源，PDF作为发布快照或兼容来源；
  - Markdown 与 HTML 同时表达同一内容时，优先使用 Markdown 作为语义源、HTML作为展示派生物；只有权威 HTML 时，HTML 同时作为原始资产和语义抽取源。

## 1. 目标

交付包在没有 `data/raw-samples`、`frontend/generated` 或开发仓库的情况下，仍能从数据库完成：

1. 查询全部基础知识对象和业务关系；
2. 查询对象与关系的 provenance；
3. 展示并查询 Draw.io 页面、节点与连线；
4. 展示并查询正式安全指南的文档、章节或幻灯片；
5. 通过 Web/App API 和 MCP 五工具读取同一稳定身份、文本、结构、关系和版本；
6. 在需要展示或下载时，从受控资产数据库读取原文件或派生预览，不依赖本机路径。

## 2. 当前数据状态

| 数据域 | 当前正式库 | 当前运行来源 | 目标 |
|---|---:|---|---|
| 基础对象 | 4,694 | `knowledge_items` | 保持全部可查询 |
| 基础关系 | 7,786 | `knowledge_relations` | 增加关系直接读取与关系 provenance |
| provenance | 194,132 | `source_references` | 对象、关系和内容片段统一查询 |
| Draw.io | `diagram_views=0` | 原始 `.drawio`、中间 SVG、generated SVG/JSON | 原文件、SVG、页面、节点、连线正式入库 |
| PDF 指南 | `guide_pages=0` | 3 个源 PDF + 164 张派生 PNG | 正式文件、单页文本和预览正式入库 |
| PPTX | 未入库 | 两份样例 PPTX，不是当前三套指南的等价源 | 只导入被正式选定的指南；不自动把样例当正式指南 |
| 成熟度指南 | 未入库 | 自包含 HTML | HTML 原文件、章节和锚点正式入库 |
| Markdown | 未入库 | `data/raw-samples/maturity/评估表v2.md` 等候选文件 | 提供解析能力；只有进入正式内容清单的 Markdown 才入库 |
| ArchiMate Poster | 未入库 | PDF + JPG 区域图 | 文件和人工目录元数据入库，不做 OCR |

`content-views.json`、guide manifest 和 `frontend/generated` 是文件系统派生资源，不代表已经入数据库。

## 3. PPTX 与 PDF 选择规则

### 3.1 优先级

1. 同一指南同时具有原生 PPTX 和 PDF：PPTX 为语义源，PDF为发布快照。
2. 只有 PDF：使用 PDF 文本层；仅对文本层为空的普通指南页做 OCR。
3. ArchiMate Poster：禁止 OCR，只登记标题、人工区域目录、PDF/JPG 资产和版本。
4. PPTX 若主要由整页图片组成，仍需对图片页做 OCR；不能因为扩展名是 PPTX 就假设存在结构化正文。

### 3.2 Token 边界

- MCP 不读取原始 Markdown、HTML DOM、PPTX XML、PDF content stream、Draw.io XML、SVG 源码或 BLOB。
- 导入阶段先把内容标准化为每页/每节点短文本。
- 搜索只返回标题、命中片段和稳定引用。
- 精确读取默认返回一个页面、幻灯片或节点，不返回整份 Deck。
- 因此 token 成本由“接口返回的规范化文本”决定，不由原文件大小决定；PPTX 的优势是抽取结构更干净、阅读顺序更稳定、较少需要 OCR 和纠错。

### 3.3 Markdown 与 HTML

1. Markdown 是首选纯文本语义源：解析标题、段落、列表、表格、引用、代码块、链接和图片 alt text。
2. HTML 只提取语义正文：`main`、`article`、`section`、标题、段落、列表、表格、图片 alt 和内部锚点。
3. `script`、`style`、导航、工具栏、下载按钮、隐藏调试区和重复页头页脚不进入 FTS。
4. HTML 原文件可以作为 App 展示资产，但必须通过受控 asset API 和 CSP / sandbox 读取；查询服务只返回规范化章节文本。
5. Markdown 中的 raw HTML 按 HTML 清洗规则处理，不能绕过字段和脚本边界。

## 4. 数据库分层

### 4.1 正式查询库：`sapd_wiki.sqlite3`

新增 additive schema：

- `content_documents`
  - 文档 stable ref、格式、语义源类型、标题、版本、状态、主资产 hash、来源策略；
- `content_fragments`
  - 指南章节、幻灯片、PDF 页、Draw.io 页面与节点；
- `content_relations`
  - 文档包含、页面顺序、Draw.io 连线、显式知识绑定；
- `content_bindings`
  - 内容片段与 `knowledge_items` / `knowledge_relations` 的显式绑定；
- `content_fragments_fts`
  - 只索引允许返回的标题、正文、备注和批准的 OCR 文本。

现有 `guide_pages`、`diagram_views` 保留为兼容投影或迁移入口，不作为最终统一查询主表。

### 4.2 内容资产库：`sapd_content_assets.sqlite3`

使用独立、只读、内容寻址的资产数据库，避免将大 BLOB 和业务查询热表混在一起：

- `content_assets`
  - `asset_hash`、MIME、资产类型、原始/派生角色、bytes、尺寸、创建工具版本；
- `document_assets`
  - 文档、页面或节点到资产的关联；
- 同一内容 hash 只保存一次；
- App 通过受控 asset API 获取 Markdown、HTML、PDF、PPTX、Draw.io、SVG、PNG 或 JPG；
- MCP 不能读取 bytes，只能看到受控资产元数据。

交付包同时携带正式查询库和内容资产库，因此不依赖仓库原始文件。

## 5. 入库规则

### 5.1 Draw.io

- `.drawio` 是可编辑结构真值，原始 bytes 必须进入资产库；
- SVG 是派生展示资产，也进入资产库，但不替代 `.drawio`；
- 解析全部页面名、`mxCell`、节点文本、节点类型、边端点、标签和必要几何；
- Draw.io 边作为内容关系保存，不凭标题自动升级为正式业务关系；
- 显式绑定到基础知识对象后，才产生 `visualizes`、`represents` 等跨域关系。

### 5.2 PDF 指南

- 当前三套正式指南只有 PDF 等价源，因此以 PDF 文本层入库；
- 每页保存页码、标题、规范化正文、文本抽取状态和预览资产；
- 164 张 PNG 作为派生预览进入资产库；
- PDF 原文件进入资产库，运行时不再依赖 `data/raw-samples`。

### 5.3 PPTX

- 当前两份样例 PPTX 与三套正式 PDF 指南不是同一内容，不自动替换或混入；
- 只有经过正式清单确认的 PPTX 才进入内容库；
- 提取 slide XML 文本、页面顺序、备注、表格、图片 alt text 和媒体引用；
- Office 临时文件 `~$*.pptx` 永久排除。

### 5.4 Markdown

- 原始 Markdown bytes 进入资产库；
- 按标题层级切分章节，保留段落、列表、表格、引用、代码块和链接语义；
- 内部链接形成章节关系，外部链接只作为受控引用元数据；
- 当前 `评估表v2.md` 只作为候选源，除非进入正式内容清单，否则不自动发布为安全指南；
- 若同一指南同时存在 Markdown 和 HTML，Markdown 为语义真值，HTML记录 `derived_from` 关系。

### 5.5 HTML 与 Poster

- 成熟度模型使用指南 HTML 原文件进入资产库，标题、章节、锚点和正文进入查询库；
- HTML 中的脚本、样式、导航和隐藏内容不进入查询正文；
- ArchiMate Poster PDF/JPG 进入资产库；
- Poster 查询库只保存人工维护的标题、区域名称和说明，不运行 OCR。

## 6. 统一查询合同

保留 MCP 五工具：

- `search_knowledge`
  - 查询基础对象、指南章节、幻灯片、Draw.io 页面/节点；
- `get_knowledge_object`
  - 按 stable ref 读取一个业务对象、文档、页面、幻灯片或节点；
- `get_related_knowledge`
  - 遍历业务关系、文档层级、Draw.io 连线和显式内容绑定；
  - 支持按 `relation_ref` 直接读取；
- `get_source_evidence`
  - 支持业务对象、业务关系和内容片段；
- `get_knowledge_version`
  - 同时返回基础知识 digest、内容 digest、资产 manifest digest、策略和 schema 版本。

Web/App API 与 MCP 复用同一个查询服务；二进制资源通过独立 asset API 流式读取。

## 7. 今晚实施时间盒

| 时间盒 | 工作 | 完成门禁 |
|---|---|---|
| T0 20 分钟 | 冻结正式内容清单、源 hash、稳定引用、候选库和回退路径 | 样例 PPTX不误归类；Poster OCR 明确禁用 |
| T1 45 分钟 | additive schema、资产库 schema、Draw.io/PDF/PPTX/Markdown/HTML 导入器 | 临时库重复导入幂等；原文件 hash 一致 |
| T2 40 分钟 | 导入 Draw.io、3 个 PDF 指南、PNG 预览、成熟度 HTML、批准的 Markdown、Poster 资产 | Draw.io 物理页签完成解析；经后续业务裁定，仅2个有效页签入库，空页不生成内容；其余资产计数吻合 |
| T3 40 分钟 | 统一查询投影、FTS、内容关系、关系 provenance | 基础对象/关系与内容对象均可精确读取 |
| T4 40 分钟 | MCP 五工具、Web/App API、asset API | MCP 不读 BLOB；App 能从资产库显示代表性 SVG/PNG/PDF |
| T5 35 分钟 | E2E、只读边界、离线打包模拟、候选 diff | 移除原始目录后代表性查询和展示仍成功 |
| T6 20 分钟 | 基础查询库与资产库备份、正式 apply、回退证据和计划收口 | 用户库未修改；正式库/资产库版本一致；回退可执行 |

## 8. 验收矩阵

1. 4,694 个基础对象和 7,786 条基础关系均可查询。
2. 122,816 条关系 provenance 可按关系稳定引用读取。
3. Draw.io 3个物理页签中2个有效页签、节点和有端点连线进入查询库；空 `page:002` 不生成对象、关系或证据，`page:001` / `page:003` 保留物理来源定位。
4. `.drawio` 和 SVG 可从资产库恢复，hash 与入库前一致。
5. 三套 PDF 指南 164/164 页均有文本抽取状态；普通文本层无需 OCR。
6. 搜索指南词条返回具体页，不只返回 Deck 标题。
7. 成熟度 HTML 可按章节搜索和精确读取。
8. 正式 Markdown 可按标题、列表、表格和链接查询；候选 Markdown 不自动发布。
9. HTML 的脚本、样式、导航和隐藏内容不会进入搜索结果。
10. ArchiMate Poster 可按人工标题/区域检索，但不存在 OCR 文本。
11. `~$*.pptx` 和未正式选定的样例 PPTX 不进入正式指南目录。
12. 删除或隔离开发仓库原始目录后，App 仍能展示代表性 Draw.io SVG、指南 PNG/PDF 和 HTML。
13. MCP 响应不包含原始 Markdown/HTML、BLOB、XML、SVG 源码、原始 PDF stream、本机路径或用户数据。
14. 正式 apply 前有查询库与资产库备份、候选 diff、回退命令和 E2E 报告。

## 9. 安全与止损

- 用户数据库不修改、不附加、不复制到内容库。
- 原始文件只读导入；不覆盖或格式转换原件。
- 自动文本匹配只能生成候选绑定，不能直接写正式业务关系。
- 任一文件 hash 异常、资产 bytes 无法 round-trip、Draw.io 边端点异常或候选库不幂等时，停止正式 apply。
- 当前 Codex 任务无法发现 SAPD MCP 时，服务端 E2E 继续，但客户端加载层必须作为独立完成门记录，不能误报已完成。

## 10. 开工前检查

- 当前分支：`main`。
- 正式基础库 SHA-256：`1c9d7c70574585df43656dec2c869faec6a6d1d2bb807352e534d567015b1400`。
- 本机可用解析工具：`sqlite3`、`pdftotext`、`pdfinfo`、`tesseract`、`unzip`。
- 当前 tracked 工作树只包含本计划与 `task_plan.md` 的计划修改；`data/` 为未跟踪保护目录，禁止整体 stage、删除或清理。
- 当前 Codex 任务精确发现仍未返回 SAPD MCP 五工具；该问题归入客户端加载层，T0先记录和核对，不能阻塞候选库、服务端 MCP 与 API 实现，但仍是最终端到端完成门。
- 首个执行动作必须建立精确正式内容 allowlist、候选库和资产库路径；不得先改正式数据库。

## 11. T0 完成记录

- 完成时间：2026-07-26（Asia/Singapore）。
- 正式内容清单：`config/content-source-manifest.v1.json`。
- 只读审计入口：`node scripts/audit_content_source_manifest.mjs`。
- 清单已冻结 9 个正式文档、2 个独立派生资产和 4 个派生集合；共 9 个文档 stable ref、11 个独立正式英文逻辑文件名。
- Draw.io 正式逻辑文件名：`sapd-security-architecture-model.drawio`。
- Draw.io SVG 正式逻辑文件名：`sapd-information-environment-basemap.svg`。
- 两份 PPTX 正式逻辑文件名：
  - `strategic-consulting-planning-department-knowledge-base-v2.2.pptx`；
  - `network-security-capability-maturity-model-introduction-2025-01.pptx`。
- 命名审计已确认：所有逻辑文件名均为小写 ASCII kebab-case，且不含 `sample`、`samle`、`~$`。
- ArchiMate Poster 已固定为 `manual_catalog_only`，`ocr_policy=never`。
- 候选查询库、候选资产库、备份和回退报告路径均限定在 `data/exports/worker-verify/base-content-unified-query/`。
- T0 审计结果：`pass`，问题数 `0`；正式基础库 SHA-256 仍为 `1c9d7c70574585df43656dec2c869faec6a6d1d2bb807352e534d567015b1400`。
- T0 未修改正式基础库、用户数据库或任何源文件，已满足进入 T1 的门禁。

## 12. T1 完成记录

- 完成时间：2026-07-26（Asia/Singapore）。
- additive 查询 schema：`config/sql/content-query-schema-v1.sql`。
- 独立资产库 schema：`config/sql/content-asset-schema-v1.sql`。
- 候选构建与格式导入器：`scripts/build_content_candidate.py`。
- 自动合同测试：`tests/test_content_candidate_t1.py`，`5/5` 通过。
- 候选查询库：`data/exports/worker-verify/base-content-unified-query/candidate/sapd_wiki.content-candidate.sqlite3`。
- 候选资产库：`data/exports/worker-verify/base-content-unified-query/candidate/sapd_content_assets.candidate.sqlite3`。
- T1 报告：`data/exports/worker-verify/base-content-unified-query/reports/t1-report.json`。
- 五类解析器均已执行：
  - Draw.io：3 页、199 个节点、82 条边；75 条有端点连线均无悬空引用；
  - PDF：3 套正式指南共 164 页；
  - PPTX：两份正式内容共 80 张幻灯片；
  - Markdown：51 个章节；
  - HTML：24 个语义章节，脚本、样式、导航和隐藏控制内容未进入正文；
  - ArchiMate Poster：7 个纯人工目录区域，OCR 为 0。
- 查询候选状态：9 个文档、610 个内容片段、685 条内容关系、619 条内容来源证据；FTS 完整性通过。
- 资产候选状态：182 个内容寻址资产和182条资产关联，共 `195,646,574` bytes；所有 BLOB SHA-256 round-trip 通过，逻辑文件名无 `sample` / `samle` / `~$`。
- 完整导入连续执行两次，查询与资产逻辑 digest 均相同，幂等门禁通过。
- SQLite `integrity_check` 与外键检查均通过；正式基础库 hash 前后不变，源资产前后不变，用户数据库未访问。
- 已识别 T2 普通内容 fallback 输入：数据安全 PDF 第43页和战略咨询规划部知识库 PPTX 第32页为 `ocr_pending`；ArchiMate Poster 不进入该队列。
- T1 已满足进入 T2 的门禁；T2基于现有候选库完成内容质量检查、批准的 fallback 抽取和计数收口，不重建命名或 stable ref。

## 13. T2 完成记录

- 完成时间：2026-07-26（Asia/Singapore）。
- OCR 复核清单：`config/content-ocr-review.v1.json`。
- T2 报告：`data/exports/worker-verify/base-content-unified-query/reports/t2-report.json`，结果 `pass`。
- PDF 第43页经页面渲染确认是品牌结束页；候选正文已复核为“奇安信 / 新一代网络安全领军者”。
- PPTX 第32页经完整幻灯片渲染确认是整页图片；候选正文已复核为“从价值链角度看安全的角色”及其活动分类、业务影响表格和结论。
- OCR 采用“视觉资产 hash 锁定 + Tesseract 原始输出 hash + 人工复核正文”策略；原始 OCR 错字不进入查询正文，原始 OCR 文本不保存。
- 两个 fallback 均为 `ocr_reviewed`，对应 provenance 的 extraction method 为 `tesseract-ocr-reviewed`；`ocr_pending=0`。
- ArchiMate Poster 仍为7个人工目录区域，`posterOcrCount=0`。
- 内容计数继续为 Draw.io 3页、PDF 164页、PPTX 80页、Markdown 51节、HTML 24节和Poster 7个区域；182条资产关联全部存在。
- 164个页面预览和7个Poster区域预览均绑定到真实内容 stable ref，缺失绑定为0。
- FTS 已能命中复核正文，“价值链”和“奇安信”代表性查询通过。
- 完整导入再次连续执行两次，查询和资产逻辑快照保持一致；无悬空内容关系、HTML危险内容或不合规逻辑文件名。
- 正式基础库、全部源资产未改变；用户数据库未访问。
- T2 已满足进入 T3 的门禁；T3 接入统一查询投影、内容关系/provenance读取和基础对象/关系联合查询。

## 14. T3 完成记录

- 完成时间：2026-07-26（Asia/Singapore）。
- 统一查询 owner：`src/sapd_wiki/local_mcp/base_query_service.py`。
- 只读 runtime 白名单：`src/sapd_wiki/local_mcp/readonly_runtime.py`。
- T3 候选查询审计：`scripts/audit_content_query_t3.py`。
- T3 查询报告：`data/exports/worker-verify/base-content-unified-query/reports/t3-query-report.json`，结果 `pass`。
- T3 重建报告：`data/exports/worker-verify/base-content-unified-query/reports/t3-build-report.json`，结果 `pass`。
- 现有五工具共享查询 core 已支持两种兼容状态：
  - 正式库没有内容表时，保持既有4,694个基础对象和7,786条基础关系行为；
  - 存在完整内容 schema 时，额外启用9个文档、610个片段和685条内容关系。
- 联合查询对象总量为5,313，关系总量为8,471；基础关系7,786/7,786、内容关系685/685均有数据库 provenance。
- `search_knowledge` 已联合基础对象、内容文档和内容片段；中文查询使用FTS与安全substring fallback，代表性“价值链”和基础能力搜索通过。
- `get_knowledge_object` 可精确读取基础对象、文档、PDF页、PPTX幻灯片、Markdown/HTML章节、Draw.io页面/节点/边和人工目录区域。
- `get_related_knowledge` 可遍历基础关系和内容关系，并支持把真实 `base_relation:` 或内容 relation ref 直接作为输入。
- `get_source_evidence` 可读取基础对象、基础关系、内容文档/片段和内容关系的脱敏 provenance，不返回原文、BLOB、XML、SVG源码或本机路径。
- 内容关系已补齐685条 provenance，因此内容证据总量为1,304（9文档 + 610片段 + 685关系）。
- SQLite authorizer 仅为FTS5放行只读 `PRAGMA data_version`；其他PRAGMA、非白名单表、ATTACH和写操作继续拒绝。
- 核心查询回归35项通过，MCP集成回归在项目隔离环境中19项通过；新增统一内容专项4项、基础查询专项7项均通过。
- 真实候选读取前后物理hash一致，正式基础库hash不变，用户数据库未访问，禁止输出字段命中为0。
- T3 已满足进入 T4 的门禁；T4 将共享查询 core 接到正式 MCP 五工具、Web/App API和独立asset API。

## 15. T4 完成记录

- 完成时间：2026-07-26（Asia/Singapore）。
- 正式MCP运行时继续只打开联合查询库，五工具通过`BaseKnowledgeQueryService`读取基础知识、内容和关系；资产库不传入Sidecar，MCP不读取BLOB。
- Web与打包App后端均接入同一组只读接口：`/api/v1/knowledge/search`、`object`、`related`、`evidence`、`version`。
- 独立资产API为`/api/v1/content/assets`与`/api/v1/content/assets/{sha256}`；元数据响应不含BLOB或本机路径，字节响应从SQLite BLOB按64 KiB块流式读取，并支持单段HTTP Range、`ETag`、`Content-Range`和正式英文逻辑文件名。
- `get_knowledge_version`新增基础库、内容投影和资产manifest三类digest；资产digest由构建器写入查询库元数据，MCP无需打开资产库。
- 候选重建报告：`data/exports/worker-verify/base-content-unified-query/reports/t4-runtime-build-report.json`，结果`pass`；内容digest为`sha256:93f774f9ce51fc1558580c1d9998c037c621d2acdf0928775912f569a9a1a56e`，资产manifest digest为`sha256:c8c463ffaf8ba316b36e5e286af4ef253f15c334a554c05229fd4f26b9cbd0c7`。
- 查询审计报告：`data/exports/worker-verify/base-content-unified-query/reports/t4-query-report.json`，结果`pass`。
- 真实TLS/OAuth Sidecar针对候选联合库完成五工具E2E；原有fixture OAuth/撤销/超时控制面回归继续通过。
- Web handler和打包App `build_handler`均完成真实回环HTTP验收；代表性SVG、PNG、PDF分别返回正确MIME、`206`及文件签名。
- 定向回归：MCP core 35项、候选/保留端口19项、Web/App/API资产5项、基础+统一内容15项全部通过；首次沙箱回环绑定失败属于权限假阴性，获准本机回环后通过。
- 候选查询库和资产库在只读API测试前后hash一致；正式基础库hash仍为`1c9d7c70574585df43656dec2c869faec6a6d1d2bb807352e534d567015b1400`，用户库未访问，源资产未改变。
- T4已满足进入T5的门禁；T5执行离线打包模拟、去原始目录依赖验收、候选diff和完整只读边界。

## 16. T5 完成记录

- 完成时间：2026-07-26（Asia/Singapore）。
- 离线模拟包：`data/exports/worker-verify/base-content-unified-query/t5-offline-bundle/SAPD-Wiki-vt5-content-offline-mac-arm64`。
- T5报告：`data/exports/worker-verify/base-content-unified-query/reports/t5-offline-bundle-report.json`，结果`pass`。
- 包内携带候选联合查询库、独立内容资产库和新建空`user_schema_0.3`用户库；当前backend为placeholder，只用于结构与离线运行链模拟，不是正式二进制或DMG。
- 新增稳定资产流式入口`/api/v1/content/assets/by-owner?owner_ref=...&asset_role=...`，Web与打包App handler均支持单段HTTP Range。
- 打包前端会把成熟度HTML和ArchiMate Poster PDF原件引用改为稳定owner/role资产接口，并删除与资产库`original`记录同hash的前端副本；开发源码目录不被改写。
- 离线包共626个文件、`545,494,779` bytes；不存在`.drawio`、`.pptx`、`data/raw-samples`目录或任何原件同hash外部副本。
- 隔离运行时主动拒绝读取仓库`data/raw-samples`和`frontend/capability-browser/generated`，服务仍完成MCP core及Web/App代表性读取。
- 打包MCP core通过搜索、对象、关系、证据和版本读取；App HTTP对SVG、PNG、PDF、HTML均返回`206`、正确MIME、`Content-Range`和文件签名。
- 候选查询库和包内查询库hash一致；候选资产库和包内资产库hash一致。正式基础库、候选查询库、候选资产库、真实用户库在验收前后均未变化；包内用户库notes/favorites均为0。
- 定向资产/API测试8项、Python语法、macOS DMG/browser打包合同和完整pre-DMG通过；pre-DMG继续存在138条既有候选work-function reference warning、无显式fullscreen bridge和旧DMG staging差异提示，均不属于T5阻断项。
- T5已满足进入T6的门禁；T6必须先建立双库备份和可执行恢复证据，再取得正式apply授权，不得把本次placeholder离线包误作正式交付物。

## 17. T6 完成记录

- 完成时间：2026-07-26（Asia/Singapore）。
- 正式应用工具：`scripts/apply_content_candidate_t6.py`；默认dry-run，正式应用和正式恢复分别要求独立显式确认值。
- 正式应用报告：`data/exports/worker-verify/base-content-unified-query/formal-apply/t6-20260726T143422Z/t6-formal-apply.json`，结果`pass`。
- 正式运行时报告：`data/exports/worker-verify/base-content-unified-query/reports/t6-runtime-audit.json`，结果`pass`。
- 应用前精确停止5173主进程和28775 MCP Sidecar，确认两个端口均无监听者；应用完成后稳定5173与持久MCP自动恢复。
- 正式写入前重新验证T5报告、候选与基线hash、SQLite完整性、外键、固定业务计数和182个资产BLOB SHA-256，问题数为0。
- 恢复包在写入前创建：旧基础库保存在`recovery/database/sapd_wiki.before-t6.sqlite3`；正式资产库应用前不存在，因此恢复语义明确为删除本次新增的`data/database/sapd_content_assets.sqlite3`。
- 正式查询库由`1c9d7c70574585df43656dec2c869faec6a6d1d2bb807352e534d567015b1400`更新为`78a721231a483072a9b22d47ff1e113073fd2be77d8612814840cf14ef99ce6a`。
- 正式资产库新增，hash为`3e04c0f57fc31846828232490caa9173b76d28a835eb32b18ad75c59cc3f1840`。
- 独立恢复演练在副本上恢复旧基础库hash并删除新增资产库，结果`pass`；正式恢复命令已写入T6报告，实际正式环境未触发回退。
- 正式应用当时包含4,694个基础对象、7,786条基础关系、9个内容文档、610个内容片段、685条内容关系和1,304条内容证据；后续 Draw.io 空页受控纠正后，正式状态为9个内容文档、609个内容片段、684条内容关系和1,302条内容证据。资产库仍包含182个内容寻址资产、182条关联和9个原件。
- 稳定5173 health明确返回正式基础/内容查询库和正式资产库路径；知识搜索返回6条代表结果，PDF对象精确读取通过，版本返回基础/内容/资产三类digest。
- 正式SVG、PNG、PDF和HTML均通过owner/role资产接口返回`206`、正确MIME、`Content-Range`和文件签名；响应禁止字段/本机路径命中为0。
- MCP控制面状态为`ready / authorized / knowledge ready`，保留3个已注册客户端；完整MCP套件186项通过。
- 完整pre-DMG在正式新库上通过，覆盖static、boundaries、data、frontend、runtime、user和delivery；系统Chrome跳过，未构建DMG。
- 真实用户库在应用、正式读取、MCP与pre-DMG前后hash均为`0e3db1224b4c2044bcd0dfe4a7fbe9e3e5a28cf081a8ab1ff0b2622030c0af81`，未修改真实用户数据。
- 138条既有候选work-function reference warning、无显式fullscreen bridge及旧DMG staging差异继续记录为非阻断提示，不属于本主线新增问题。
- T0—T6全部完成，当前无剩余执行阶段；真实App/DMG构建及人工视觉UAT属于后续独立发布任务。

### 17.1 T6 后 Draw.io 空页内容纠正

- `SAPD 安全架构模型` 的物理页签2“元模型”为0节点/0连线空页，不再作为知识内容；有效页签仍使用物理来源 ref `page:001` 和 `page:003`，不得重编号。
- 文档业务元数据改为 `contentUnitCount=2 / contentUnitMode=independent`；导入器自动跳过0节点且0连线的 Draw.io 页签。
- 受控修复工具为 `scripts/repair_empty_drawio_content.py`，具备显式 apply/restore 确认、双库备份、原子替换和用户库不变门禁。
- 恢复包位于 `data/exports/worker-verify/base-content-unified-query/empty-drawio-content-repair/repair-20260726T155139Z/`；18项定向回归、SQLite完整性/外键、FTS、稳定5173和MCP运行态通过。

## 18. 恢复入口

恢复执行时依次读取：

1. 本计划；
2. 正式内容清单和 hash；
3. 候选查询库与资产库报告；
4. 当前重叠文件 `git diff`；
5. MCP、API、asset API 的定向测试摘要。

完成内容导入、MCP/API E2E 和正式 apply 后，分别更新本计划状态；最终只在 `progress.md` 写一条紧凑完成记录。
