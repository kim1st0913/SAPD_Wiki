# 正式基础库知识与关系统一查询：今晚执行计划

- 状态：`ready_for_execution_revised`
- 修订时间：2026-07-26
- 截止：2026-07-26 23:59（Asia/Singapore）
- 影响面：正式基础库只读查询、Web/App API、SAPD MCP
- 数据写入边界：不修改正式基础库，不修改真实用户数据库，不读取或解析原始 Draw.io、PPTX、PDF、HTML、Markdown、图片文件。

## 1. 修订后的业务目标

只对当前已经存在于正式基础数据库 `data/database/sapd_wiki.sqlite3` 中的业务知识提供查询服务：

1. 全部基础知识对象；
2. 全部基础知识关系；
3. 数据库内已有的对象与关系 provenance；
4. 基础库内容版本和查询目录摘要。

原始文件、前端生成包和静态媒体不是本轮查询数据源。ArchiMate Poster 不做 OCR。

## 2. 正式基础库现场

| 数据域 | 当前数量 | 本轮处理 |
|---|---:|---|
| `knowledge_items` | 4,694 | 全部业务对象可搜索、枚举和精确读取 |
| `knowledge_relations` | 7,786 | 全部关系可枚举、过滤、直接读取和从端点遍历 |
| `source_references` | 194,132 | 对象和关系 provenance 均提供脱敏查询 |
| `source_files` | 15 | 全部为 `xlsx / import_source`；只作为 provenance 关联，不打开文件 |
| `guide_pages` | 0 | 当前没有数据库内容，不进入本轮 |
| `diagram_views` | 0 | 当前没有数据库内容，不进入本轮 |
| `asset` 知识对象 | 2 | 按普通基础对象查询；不读取对应图片 |

当前数据库没有 Draw.io 页面、指南页或幻灯片页记录。它们目前只存在于原始文件、前端静态资源或生成数据包中，因此不属于“已经在数据库中的数据”。

## 3. 今晚明确排除

- ArchiMate Poster OCR；
- Draw.io XML、页面、节点和连线解析；
- PDF 文本抽取或 OCR；
- PPTX 幻灯片、备注和媒体解析；
- HTML / Markdown 指南解析；
- `public/data`、generated 目录或原始文件系统搜索；
- 把原始文件或静态资源导入正式基础库；
- 读取或修改真实用户数据库；
- 对 `import_jobs`、`change_logs`、`schema_migrations` 建立管理员接口；
- 返回 `raw_value`、文件路径、内部数据库 ID、凭据、客户端 SQL 或原始文件正文。

如果未来需要查询 Draw.io、指南或幻灯片，应先作为独立任务完成正式入库；本计划不预建空接口并宣称已有内容。

## 4. 查询合同

保持当前 MCP 五个只读工具，不增加客户端工具数量。

### 4.1 `search_knowledge`

- 查询全部 4,694 个基础对象；
- 支持 `type`、`status`、`category`、关键词和分页；
- 搜索字段限定为允许返回的业务字段，禁止隐藏 metadata 影响搜索命中；
- 返回 `canonical_ref`、类型、编码、标题、描述、分类、状态和受控业务 metadata。

### 4.2 `get_knowledge_object`

- 按 `canonical_ref` 精确读取一个对象；
- active 与 deprecated 均可读取；
- 不返回内部 ID、父 ID、导入 ID、时间戳或路径。

### 4.3 `get_related_knowledge`

- 按对象读取 incoming、outgoing 或 both；
- 支持 `relation_type`、方向和分页；
- 增加按 `relation_ref` 直接读取一条关系的能力；
- 返回关系稳定引用、类型、标签、置信度、稳定端点和受控业务 metadata。

### 4.4 `get_source_evidence`

- 输入统一为 `target_ref`；
- 支持对象引用和关系引用；
- 对象证据覆盖数据库已有 71,316 条 item references；
- 关系证据覆盖数据库已有 122,816 条 relation references；
- 26 个无正式对象 provenance 的技术措施返回明确 `provenance_status=missing`，不伪造来源；
- 只返回数据库已有的脱敏文件名、类型、Sheet、行、列、单元格和 source hash。

### 4.5 `get_knowledge_version`

- 返回正式基础库内容 digest、策略版本、身份版本和 schema/data version；
- 不把控制库、授权库、审计库或用户库纳入知识版本。

## 5. Web/App 只读 API

第一批接口：

- `GET /api/v1/catalog/summary`
- `GET /api/v1/knowledge/search`
- `GET /api/v1/knowledge/objects/{canonical_ref}`
- `GET /api/v1/knowledge/objects/{canonical_ref}/relationships`
- `GET /api/v1/knowledge/relations/{relation_ref}`
- `GET /api/v1/knowledge/evidence/{target_ref}`
- `GET /api/v1/knowledge/version`

API 与 MCP 复用同一个只读查询服务，不直接读取原始文件，不从前端 JSON 反推业务关系。

## 6. 今晚时间盒

| 时间 | 工作包 | 交付物 | 完成门禁 |
|---|---|---|---|
| 20:30—20:50 | T0 现场与客户端门禁 | DB hash、表计数、工作树重叠检查、SAPD MCP 客户端发现诊断 | 正式库和用户库只读；确认现有写集 owner |
| 20:50—21:30 | T1 查询服务补齐 | 对象结构化过滤、关系直接读取、关系 provenance、版本字段 | 4,694 对象、7,786 关系均可从服务层访问 |
| 21:30—22:10 | T2 MCP 合同与测试 | 五工具输入/输出合同、字段边界、分页和错误测试 | MCP 定向测试全绿；无隐藏字段侧信道 |
| 22:10—22:50 | T3 Web/App API | catalog/search/object/relation/evidence/version | API 与 MCP 代表性结果一致 |
| 22:50—23:25 | T4 全量覆盖审计 | 38 个对象类型、29 个关系类型、对象/关系 evidence 覆盖报告 | 对象和关系无不可寻址行；26 个 provenance 缺口显式报告 |
| 23:25—23:50 | T5 E2E 与安全边界 | Sidecar/MCP/API E2E、只读 authorizer、用户库不连接证明 | 禁止 SQL、写入、路径和用户数据；全部通过 |
| 23:50—23:59 | T6 收口 | 计划状态、验证摘要、剩余外部阻塞 | 当前客户端发现五工具，或明确唯一宿主加载阻塞 |

## 7. 代表性验收

1. 枚举 38 种对象类型并核对合计 4,694。
2. 枚举 29 种关系类型并核对合计 7,786。
3. 搜索 active、deprecated 和内部生成对象，均按合同返回。
4. 按 `canonical_ref` 精确读取一个基础对象。
5. 按 `relation_ref` 精确读取一条关系。
6. 从关系两端分别遍历，必须得到同一关系稳定引用。
7. 查询该关系来源证据，返回数据库已有 Sheet / Cell provenance。
8. 查询无 provenance 的技术措施，明确返回 missing，不返回伪造证据。
9. 搜索只命中可返回业务字段；被过滤 metadata 不能通过命中与否泄漏。
10. API、MCP 和数据库计数、stable ref、version digest 一致。
11. `guide_pages=0`、`diagram_views=0` 如实反映为空，不从原始文件或静态包补数据。
12. 正式基础库和真实用户数据库执行前后 hash 不变。

## 8. 写入和兼容边界

- 本轮是查询服务补齐，不需要数据库 migration，也不需要正式基础库 apply。
- MCP 控制库、授权库和审计库允许产生端到端测试所需记录。
- 现有 Web/API/MCP 未提交改动属于用户工作；修改重叠文件前必须检查 diff，不得整文件覆盖。
- 运行时只能使用预定义参数化只读查询；SQLite authorizer 继续限制允许读取的正式知识表。

## 9. 止损规则

- 当前 Codex 任务仍无法发现 SAPD MCP 工具时，先完成服务端 E2E，同时将客户端加载层保留为唯一外部完成门；不能把控制面健康误报为客户端已可用。
- 任一测试尝试读取用户数据库、原始文件或未允许治理表，立即停止并修正依赖图。
- 任一对象或关系缺少稳定引用、关系端点不可解析或计数发生非预期变化，停止接口发布。
- 23:25 后不扩大到内容导入、OCR、前端视觉、DMG 或 Windows 打包。

## 10. 恢复入口

恢复执行时依次读取：

1. 本计划；
2. 当前重叠文件的 `git diff`；
3. `src/sapd_wiki/local_mcp/base_query_service.py`；
4. `src/sapd_wiki/local_mcp/readonly_runtime.py`；
5. `src/sapd_wiki/api_server.py`；
6. MCP 合同和本轮定向测试摘要。

完成 T2、T4、T5 后更新本计划状态；完成全部门禁后在 `progress.md` 写一条紧凑记录。
