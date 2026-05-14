# 后端逻辑与接口设计

本文档定义 SAPD Wiki 的后端逻辑边界、接口分层和前后端集成契约。目标是把“数据导入、清洗、映射、关系生成、校验、导出”与“页面布局、交互、筛选、展示”明确分开，避免前端重构时重复实现业务规则。

字段级接口契约以 `docs/01-architecture/api-field-contract.md` 为准；本文档只定义后端职责、模块边界和接口分组。

当前阶段的接口可以先由静态 JSON 文件承载；后续切换为本地 API 服务时，应保持同一套数据契约。

## 1. 设计目标

SAPD Wiki 的后端不是传统互联网服务端，而是本地知识库的数据处理与关系投影层。

它需要解决四类问题：

| 问题 | 后端职责 |
|---|---|
| 原始文件如何进入系统 | 登记来源、计算 hash、创建导入任务 |
| Excel 数据如何变成知识对象 | 解析 Sheet、清洗字段、统一主数据、生成对象和关系 |
| 错误数据如何处理 | 输出校验问题、进入 staging、等待确认或修复 |
| 前端如何展示关系 | 输出稳定的页面数据契约，不让前端自己推断业务关系 |

## 2. 前后端边界

### 2.1 后端负责什么

后端负责所有业务事实和关系事实：

- 来源文件登记；
- Excel workbook 读取；
- Sheet 解析；
- 字段清洗、标准化和 canonicalization；
- 主数据统一；
- 对象去重；
- 关系生成；
- staging 暂存；
- validation warning/error 生成；
- 审批入正式库；
- 数据生命周期状态；
- 查询用关系投影；
- 专项知识清单导出；
- 全量备份和多维导出。

### 2.2 前端负责什么

前端负责用户体验和展示方式：

- 页面导航；
- 树、表格、矩阵、关系链、详情面板；
- 搜索框和筛选控件；
- 行展开/收起；
- 区域宽度调整；
- 表格列宽调整；
- 表头筛选；
- 空状态、加载状态、错误提示；
- HTML 说明页和 Draw.io 只读视图的展示容器。

### 2.3 前端不应负责什么

前端不应实现以下逻辑：

- 从原始 Sheet 字段推断业务关系；
- 自行决定哪个对象是主数据；
- 自行合并重复对象；
- 自行修正错误编码；
- 自行计算导入冲突；
- 自行判断关系是否有效；
- 默认展示来源字段作为主要内容。

来源信息保留在后端和数据库中，但前端默认不展示。只有在排查导入问题、审查数据证据或用户主动展开“来源证据”时才展示。

## 3. 当前运行模式

### 3.1 MVP 静态契约模式

当前前端是本地静态页面，推荐先采用：

```text
SQLite
→ 后端导出脚本
→ frontend/capability-browser/public/data/*.json
→ 静态 HTML/CSS/JS 前端读取 JSON
```

这一阶段不强制启动本地 HTTP API，目的是降低部署复杂度，让用户能直接打开本地页面查看结果。

### 3.2 后续本地 API 模式

当导入审查、人工编辑、导出下载和更多交互变多后，再切换为：

```text
SQLite
→ 本地 API 服务
→ /api/v1/*
→ 前端 data client
→ 页面组件
```

API 服务可以由 Python FastAPI 或 Node.js 实现，具体技术选型在实现阶段决定。无论选择哪种技术，接口语义应保持与本文档一致。

### 3.3 打包交付模式

桌面交付阶段推荐：

```text
Tauri 壳
├─ 前端静态资源
├─ 本地 SQLite
├─ 后端命令或本地 API
└─ 原始文件 / 导出 / 预览目录
```

## 4. 后端逻辑模块

### 4.1 Source Registry 来源文件服务

职责：

- 登记原始文件；
- 计算 `source_hash`；
- 判断是否重复导入；
- 创建 `source_file`；
- 创建 `import_job`。

输出：

- source file id；
- import job id；
- 文件类型、大小、hash、路径。

### 4.2 Workbook Reader 工作簿读取服务

职责：

- 打开 Excel；
- 列出 Sheet；
- 读取单元格、合并单元格语义和行列位置；
- 输出标准行记录。

边界：

- 只负责读取，不解释业务含义。

### 4.3 Sheet Parser Sheet 解析服务

职责：

- 按 Sheet 名识别解析器；
- 把原始行转成对象候选和关系候选；
- 记录字段来源。

已完成或已纳入的重点 Sheet：

| Sheet | 当前定位 |
|---|---|
| 安全能力目录 | 能力层级与关注点基础主数据 |
| 安全能力作用域目录 | 作用域类型基础主数据 |
| 信息化环境-信息化对象-安全作用域映射 | 信息化环境、对象、作用域与服务关系 |
| 安全能力-安全技术服务 | 安全技术服务权威主数据 |
| 安全技术模块清单 | 系统、模块、产品与服务关系 |
| 作用域-安全技术服务-安全技术模块映射 | 作用域、服务、模块、系统/产品连续映射 |
| 安全能力-安全工作 | 关注点到安全工作 |
| 安全能力-安全管理元素（high level） | 能力/关注点到流程与组织相关方 |
| 安全职能流程清单（完善L4） | 流程清单专项知识维护 |
| 安全工作职能清单 | 职能清单专项知识维护 |
| Gartner 工作岗位参考 | 岗位参考专项知识维护 |

### 4.4 Normalization 标准化服务

职责：

- 文本 trim；
- 合并单元格向下填充；
- `/`、空值、占位值处理；
- 编码格式统一；
- 多值拆分；
- 名称规范化；
- 主数据 canonicalization。

当前已明确的权威规则：

| 规则 | 说明 |
|---|---|
| 安全技术服务 | 以 `安全能力-安全技术服务` 中的服务编号和名称为权威值 |
| 信息化对象 | 全局按名称统一为同一套主数据 |
| 作用域类型 | 以 `安全能力作用域目录` 为作用域唯一来源 |
| L4 关键活动 | 缺失时保留占位，前端显示 `待补充` |
| 数据来源 | 默认用于审计和排查，不作为关系展示主内容 |

### 4.5 Matcher 匹配与去重服务

职责：

- 批次内去重；
- 与正式库匹配；
- 识别新增、更新、停用、冲突；
- 输出 validation issue。

默认匹配优先级：

1. `type + code`；
2. 权威主数据规则；
3. `type + normalized title`；
4. 业务定义的组合键；
5. 无法确定时进入待确认问题。

### 4.6 Staging & Review 暂存与审查服务

职责：

- 写入 `staging_items`；
- 写入 `staging_relations`；
- 生成 validation report；
- 记录用户接受、拒绝、业务接受或待修复；
- 审批后写入正式库；
- 写入 `review_decisions` 和 `change_logs`。

原则：

- 自动导入不直接覆盖人工编辑；
- 错误数据不静默吞掉；
- 删除或消失的对象先标记 stale，不直接物理删除。

### 4.7 Knowledge Query 知识查询服务

职责：

- 按能力维度、信息化环境维度、安全开发维度、数据生命周期维度查询；
- 查询对象详情；
- 查询上下游关系；
- 查询专项知识清单；
- 查询缺失关系和待补充项。

它输出前端直接可用的“关系投影”，而不是让前端自己从散表拼装。

### 4.8 Projection Export 页面投影导出服务

职责：

- 把数据库对象和关系导出为前端数据包；
- 保持 JSON schema 稳定；
- 兼容静态页面和未来 API。

当前静态文件建议继续放在：

```text
frontend/capability-browser/public/data/
```

### 4.9 Maturity Service 成熟度分析服务边界

成熟度分析后续应作为独立后端模块或服务层，不混入现有知识投影导出逻辑。

职责：

- 读取主知识库安全能力、关注点、作用域、技术服务、技术模块 / 措施、流程和职能；
- 生成成熟度评估 Excel 模板；
- 解析客户评估模板；
- 输出自动匹配候选和人工审查表；
- 根据版本化评分规则生成评分结果和报告数据。

边界：

- 不把客户输入、客户证据、客户评分结果写入 `knowledge_items`；
- 不由前端执行自动匹配和评分；
- 不在当前静态 capability browser JSON 中混入真实客户评估数据；
- 后续如提供 API，应使用独立路径，例如 `/api/v1/maturity/*`；
- M1 启动前不新增接口实现，不修改当前 `/api/v1/maintenance/*` 和能力 / 环境数据契约。

## 5. 接口响应约定

### 5.1 成功响应

本地 API 模式下，建议统一使用：

```json
{
  "meta": {
    "version": "v1",
    "generated_at": "2026-05-12T10:00:00+08:00",
    "data_version": "import-job-id",
    "warnings_count": 0
  },
  "data": {},
  "warnings": []
}
```

静态 JSON 模式可以保留同等字段，便于未来平滑切换。

### 5.2 错误响应

```json
{
  "error": {
    "code": "VALIDATION_FAILED",
    "message": "导入数据存在待确认问题",
    "details": []
  }
}
```

错误类型建议：

| code | 说明 |
|---|---|
| `SOURCE_FILE_NOT_FOUND` | 来源文件不存在 |
| `WORKBOOK_OPEN_FAILED` | Excel 打开失败 |
| `SHEET_MISSING` | 必要 Sheet 缺失 |
| `VALIDATION_FAILED` | 校验失败 |
| `DUPLICATE_MASTER_DATA` | 主数据重复 |
| `RELATION_TARGET_MISSING` | 关系目标缺失 |
| `IMPORT_JOB_NOT_FOUND` | 导入任务不存在 |

## 6. 查询接口设计

### 6.1 系统状态

| 接口 | 用途 |
|---|---|
| `GET /api/v1/health` | 本地服务健康检查 |
| `GET /api/v1/catalog/summary` | 全局对象、关系、问题、导入批次数量摘要 |

### 6.2 能力维度

| 接口 | 用途 |
|---|---|
| `GET /api/v1/capabilities/tree` | 能力分类、L1、L2、关注点树 |
| `GET /api/v1/capabilities/{id}` | 能力或关注点详情 |
| `GET /api/v1/capabilities/{id}/relationships` | 能力相关的服务、作用域、流程、职能、模块 |
| `GET /api/v1/capabilities/matrix` | 能力关注点关系矩阵 |

### 6.3 信息化环境维度

| 接口 | 用途 |
|---|---|
| `GET /api/v1/environments/tree` | 信息化环境、片区、信息化对象树 |
| `GET /api/v1/environments/objects/{id}/relationships` | 信息化对象相关的作用域、服务、模块、系统/产品 |
| `GET /api/v1/environments/matrix` | 环境对象到服务、模块、系统的映射矩阵 |

### 6.4 专项知识维护

| 接口 | 用途 |
|---|---|
| `GET /api/v1/maintenance/scopes` | 安全能力作用域目录和作用域名目录 |
| `GET /api/v1/maintenance/processes` | 安全职能流程清单 |
| `GET /api/v1/maintenance/work-functions` | 安全工作职能清单 |
| `GET /api/v1/maintenance/technology-modules` | 安全技术模块清单 |
| `GET /api/v1/maintenance/technical-measures` | 安全技术措施清单 |
| `GET /api/v1/maintenance/technical-measures/{id}` | 单个安全技术措施详情 |
| `GET /api/v1/references/standards` | 标准引用，如 GB/T 42446-2023 |
| `GET /api/v1/references/roles` | Gartner 等岗位参考 |

安全技术措施读取说明：

- 当前静态数据阶段由 `dataClient.getMaintenanceTechnologyMeasures()` 从 `management-knowledge.json` 顶层 `security_technical_measures` 读取。
- 未来本地 API 推荐使用 `GET /api/v1/maintenance/technical-measures` 返回列表，使用 `GET /api/v1/maintenance/technical-measures/{id}` 返回单个措施详情。
- 返回对象必须符合 `docs/01-architecture/api-field-contract.md` 中 `SecurityTechnicalMeasure` 契约。
- 后端不得把 `security_technology_modules` 中的安全技术模块直接返回为安全技术措施。
- 后端不得把安全系统或产品返回为安全技术措施。
- `sources` 是来源证据字段，不是主展示字段；`sheet`、`row`、`column`、`raw_value`、`source_file`、`import_id`、`source_id`、`generated_at` 等非业务字段只能进入来源证据区，默认折叠。

### 6.5 生命周期维度

| 接口 | 用途 |
|---|---|
| `GET /api/v1/lifecycle/application` | 安全开发维度数据 |
| `GET /api/v1/lifecycle/data` | 数据生命周期维度数据 |
| `GET /api/v1/lifecycle/{id}/relationships` | 生命周期节点相关服务、策略、活动、产品 |

### 6.6 说明和视图

| 接口 | 用途 |
|---|---|
| `GET /api/v1/content/guide-pages` | PPT/HTML 使用说明页面 |
| `GET /api/v1/content/diagram-views` | Draw.io 只读视图列表 |
| `GET /api/v1/content/diagram-views/{id}` | 单个 Draw.io 视图数据 |

## 7. 导入与数据质量接口设计

这些接口是后续从静态浏览器升级到本地应用时使用，不要求当前前端立即实现。

| 接口 | 用途 |
|---|---|
| `POST /api/v1/imports/excel/stage` | 上传或选择 Excel 后生成暂存导入任务 |
| `GET /api/v1/imports/{job_id}` | 查看导入任务状态 |
| `GET /api/v1/imports/{job_id}/preview` | 查看对象和关系预览 |
| `GET /api/v1/imports/{job_id}/warnings` | 查看校验问题 |
| `POST /api/v1/imports/{job_id}/approve` | 审批入正式库 |
| `POST /api/v1/imports/{job_id}/reject` | 拒绝导入 |
| `GET /api/v1/data-quality/issues` | 查看当前数据质量问题 |
| `GET /api/v1/data-quality/reports/{report_id}` | 查看校验报告 |

## 8. 导出接口设计

| 接口 | 用途 |
|---|---|
| `POST /api/v1/exports` | 创建导出任务 |
| `GET /api/v1/exports/{export_id}` | 查看导出状态 |
| `GET /api/v1/exports/{export_id}/download` | 下载导出文件 |

导出范围应支持：

- 当前查询结果；
- 当前维度矩阵；
- 专项知识清单；
- 全量知识库；
- 数据库备份；
- 原始文件和 manifest。

## 9. 静态 JSON 与未来 API 的映射

当前前端已经使用静态 JSON。后续重构时，应把静态文件视为 API 的离线实现。

| 未来 API | 当前静态文件建议 |
|---|---|
| `/api/v1/capabilities/tree` | `capability-tree.json` |
| `/api/v1/capabilities/matrix` | `capability-tree.json` 中的能力关系投影，后续可拆分 |
| `/api/v1/maintenance/processes` | `management-knowledge.json` |
| `/api/v1/maintenance/work-functions` | `management-knowledge.json` |
| `/api/v1/maintenance/scopes` | `management-knowledge.json` 或后续 `maintenance-knowledge.json` |
| `/api/v1/maintenance/technical-measures` | `management-knowledge.json` 顶层 `security_technical_measures` |
| `/api/v1/lifecycle/application` | `lifecycle-knowledge.json` |
| `/api/v1/lifecycle/data` | `lifecycle-knowledge.json` |
| `/api/v1/content/guide-pages` | `content-views.json` |
| `/api/v1/content/diagram-views` | `content-views.json` |

重构建议：

1. 先在前端建立 `dataClient`，统一读取静态 JSON；
2. 页面组件只调用 `dataClient`，不直接 `fetch` 多个文件；
3. 未来切换 API 时，只替换 `dataClient` 实现；
4. JSON 字段变化必须先更新本文档或对应 schema 说明。

## 10. 前端集成规则

前端重构必须遵守以下规则：

| 规则 | 说明 |
|---|---|
| 关系优先 | 页面以树、表、矩阵、关系链为主，不做卡片墙 |
| 来源后置 | 来源证据默认折叠，除数据排查页外不作为主内容 |
| 后端给事实 | 前端只展示后端给出的对象、关系、数量、缺失项 |
| 缺失要显式 | L4 关键活动缺失显示 `待补充` |
| 页面可扩展 | 能力、环境、安全开发、数据生命周期、专项维护是独立维度 |
| 本地优先 | 静态文件可打开，后续再接本地 API |

## 11. Agent 分工规则

为避免前端和数据处理互相覆盖，后续多 Agent 分工如下：

| 角色 | 负责范围 | 不负责范围 |
|---|---|---|
| 主控 Agent | 计划、架构、接口契约、问题管理、最终验收 | 不直接长期接管前端细节 |
| 后端/ETL Agent | `src/sapd_wiki/`、`scripts/`、`data/database/`、导出 JSON | 不改前端布局和视觉 |
| 前端设计 Agent | `frontend/capability-browser/` | 不改数据库、ETL、导入规则 |
| 验证 Agent | 运行检查、截图、数据一致性报告 | 不做大范围重构 |

稳定性要求：

- 同一阶段优先复用同一个前端 Agent；
- 不因为一次等待超时就判断 Agent 失效；
- 只有在明确卡住、任务范围变化过大或用户同意时才更换 Agent；
- 主控 Agent 负责整合结果，不重复并行改同一批文件。

## 12. 下一步实施建议

当前最合理的下三步：

1. 固化后端接口与静态 JSON 契约，建立前端 `dataClient` 抽象；
2. 前端按关系工作台重构能力维度页面，先不追求所有页面一次完成；
3. 对第二批、第三批已导入 Sheet 做业务含义复核，确认主键、关系类型、1:N/N:M 逻辑，再决定是否补充导出投影。

验收标准：

- 前端页面不直接依赖原始 Sheet 字段；
- 能力维度关系页能展示能力树、关系矩阵、关系链和详情；
- 专项知识维护页面能展示作用域、流程、职能、技术模块清单；
- 后端导出的 JSON 字段能明确对应未来 API；
- 数据问题继续统一记录到 `docs/06-implementation/open-issues.md`。
