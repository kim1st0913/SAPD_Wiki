# 前后端分离收口说明

> 归档状态：`completed / current boundary lives in AGENTS and API contracts`

本文档用于收口本轮 SAPD Wiki 前后端分离工作，明确已经完成的边界、当前可用接口、前端消费方式、未完成但已受控的事项，以及后续继续推进时的入口。

## 1. 收口结论

本轮前后端分离已完成阶段性收口。

当前工程规则已经从“专项知识维护页面先行分离”提升为“全工程必须遵守前后端分离”：

- 后端负责数据导入、字段清洗、标准化、主数据归一、跨表匹配、关系生成、成熟度评分、数据校验、导出和页面数据投影。
- 前端负责导航、布局、筛选、交互状态、表格 / 树 / 关系视图展示和用户反馈。
- 页面数据必须通过 `dataClient` 或 `/api/v1/*` 契约进入前端。
- `public/data/*.json` 仅作为后端生成的离线兼容数据包或 API 不可用时的 fallback。
- ViewModel 只允许做展示层整理，不承担 ETL、主数据归一、跨表匹配、评分或业务关系推断。

## 2. 本轮已完成内容

### 2.1 本地 API 入口

已新增本地 API 服务：

```bash
python scripts/sapd_wiki.py serve --host 127.0.0.1 --port 5173
```

该命令同时提供：

- 前端静态页面；
- `/api/v1/health` 健康检查；
- `/api/v1/data-packages/*` 数据包接口；
- `/api/v1/maintenance/*` 专项知识维护接口；
- `/api/v1/capabilities/workspace-projection` 安全能力映射页关系投影接口。

### 2.2 dataClient 边界

`frontend/capability-browser/dataClient.js` 已成为前端数据入口：

- 优先读取本地 API；
- 本地 API 不可用时回退到 `public/data/*.json`；
- 页面组件不应直接 fetch 原始数据文件；
- 新增页面或字段时，应先扩展 `dataClient` 契约。

### 2.3 专项知识维护 API 过渡

专项知识维护已经具备 API 读取边界，当前覆盖：

- `scopes`
- `processes`
- `work-functions`
- `security-works`
- `modules`
- `measures`
- `lcap-references`
- `references`

### 2.4 安全能力映射页关系投影

安全能力映射页已新增后端投影：

```text
GET /api/v1/capabilities/workspace-projection
```

该接口输出：

- `technicalMappingRows`：技术视角关系行；
- `managementMappingRows`：管理视角关系行；
- `stats`：投影统计。

当前验证结果：

| 指标 | 数量 |
|---|---:|
| 技术映射行 | 379 |
| 管理映射行 | 91 |
| 关注点 | 91 |

前端安全能力映射页已优先消费该后端投影。静态降级模式下，保留 ViewModel fallback，避免本地静态预览不可用。

## 3. 当前接口清单

| 接口 | 当前状态 | 用途 |
|---|---|---|
| `GET /api/v1/health` | 已实现 | 本地 API 健康检查 |
| `GET /api/v1/data-packages` | 已实现 | 当前可用数据包清单 |
| `GET /api/v1/data-packages/capability` | 已实现 | 安全能力数据包 |
| `GET /api/v1/data-packages/maintenance` | 已实现 | 专项知识维护数据包 |
| `GET /api/v1/data-packages/shared-lookups` | 已实现 | 全站共享索引数据包 |
| `GET /api/v1/data-packages/lifecycle` | 已实现 | 生命周期数据包 |
| `GET /api/v1/data-packages/content` | 已实现 | 内容视图数据包 |
| `GET /api/v1/maintenance` | 已实现 | 专项知识维护导航 |
| `GET /api/v1/maintenance/{section}` | 已实现 | 专项知识维护单页数据 |
| `GET /api/v1/capabilities/workspace-projection` | 已实现 | 安全能力映射页关系投影 |

## 4. 当前保留的 fallback

以下 fallback 是为了保证当前本地静态 MVP 不中断，不代表新增功能可以继续把业务逻辑放在前端：

- API 不可用时，`dataClient` 回退读取 `public/data/*.json`。
- 安全能力映射页投影接口不可用时，`viewModels.js` 保留旧的展示计算逻辑。
- 静态预览仍可通过 `python -m http.server 5173` 打开。

后续开发时，fallback 只能用于兼容，不应作为新增业务逻辑的首选实现方式。

## 5. 后续受控事项

以下事项尚未全部下沉，但已经被前后端分离规则约束：

| 事项 | 当前处理 |
|---|---|
| 信息化环境维度页关系投影 | 后续应新增后端 API 投影，不继续扩大前端推断 |
| LC-AP 开发安全生命周期页关系投影 | 后续应新增后端 API 投影 |
| 专项知识维护详情页高级查询 | 后续通过 API 扩展，不在组件内跨数据包拼接 |
| maturity 模块 | 使用独立 `maturity_*` 运行域和 API / CLI 契约，不写入 `knowledge_items` |
| ViewModel 中历史展示整理 | 暂时保留，但新增业务事实不得继续写入 ViewModel |

## 6. 验收标准

本轮收口按以下标准验收：

- `AGENTS.md`、`CURRENT_STATE.md`、`task_plan.md`、`findings.md` 已写入全工程前后端分离规则。
- `docs/01-architecture/backend-interface-design.md` 和 `docs/01-architecture/api-field-contract.md` 已记录 API 优先、离线 JSON fallback 的边界。
- `README.md` 和 `frontend/capability-browser/README.md` 已补充本地 API 运行方式和投影接口。
- `dataClient` 已作为前端数据入口，优先读取 API。
- 安全能力映射页已具备后端关系投影。
- 当前未修改 SQLite schema、migration、ETL 入库流程、复杂评分算法、图表代码或 UI 页面结构。

## 7. 建议下一步

本轮前后端分离已经收口，不建议继续在同一任务里扩展新功能。

后续如果继续推进，建议单独启动一个小任务：

1. 为 `信息化环境维度页` 设计并实现后端投影接口；
2. 或为 `LC-AP开发安全生命周期页` 设计并实现后端投影接口；
3. 或进入 maturity 模块专用后端建模 / 导入 MVP。

每个后续任务都应先更新接口契约，再实现前端消费。
