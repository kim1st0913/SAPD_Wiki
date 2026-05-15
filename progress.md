# Progress: SAPD 工作知识库系统

本文档只保留最近记录和历史索引。完整执行历史已迁入 `docs/05-archive/`，避免主控 Agent 每次恢复时加载过大上下文。

## 恢复入口

- 快速当前状态：`CURRENT_STATE.md`
- 当前计划入口：`task_plan.md`
- 当前关键决策：`findings.md`
- 统一问题清单：`docs/06-implementation/open-issues.md`
- 主控轻量恢复说明：`docs/00-overview/master-context-restore.md`
- 完整历史进度归档：`docs/05-archive/progress-history/2026-05.md`

## 当前状态摘要

- 当前主线：已导入 Sheet 的业务含义复核 + 前端关系展示校正。
- Frontend Baseline 1.0 范围已修正为三页：`安全能力映射`、`LC-AP开发安全生命周期`、`信息化环境维度`。
- 成熟度分析模块当前处于 M0 文档和配置规划完成状态；M1 不应在主线优先级确认前启动。
- 后续开工默认读取 `AGENTS.md` + `CURRENT_STATE.md`，按任务需要再读取 `task_plan.md`、`findings.md`、`progress.md` 和相关 docs。

## 最近记录

### 2026-05-15 前后端分离阶段性收口

任务：用户要求先把前后端分离工作收口。

本次调整：

- 新增 `docs/01-architecture/frontend-backend-separation-closure.md`，集中说明本轮收口结论、已完成接口、fallback 边界、验收标准和后续受控事项。
- 更新 `README.md`、`CURRENT_STATE.md` 和 `task_plan.md`，将前后端分离收口说明作为后续恢复和继续推进的入口。
- 明确本轮不继续扩展新页面投影，后续应按单独小任务推进信息化环境维度页或 LC-AP 页的后端投影。

验证：

- `python3 -m py_compile src/sapd_wiki/api_server.py src/sapd_wiki/cli.py` 通过。
- `node --check frontend/capability-browser/dataClient.js`、`node --check frontend/capability-browser/app.js`、`node --check frontend/capability-browser/viewModels.js` 通过。
- `PYTHONPATH=src python3 -c ...` 验证能力投影为 `ready`，技术映射 379 行、管理映射 91 行、关注点 91 个；专项 `scopes` 为 10 条。
- `python3 scripts/sapd_wiki.py serve --help` 通过。
- `rg -n ...` 检查当前有效文档，未发现待补充占位或旧口径冲突。
- `git diff --check` 通过。
- Git：已创建本地提交 `frontend backend separation closure`；推送到 GitHub 时被当前环境安全策略拦截，未完成远端推送。

### 2026-05-15 能力映射关系投影下沉

任务：执行前后端分离下一步，把现有前端 `ViewModel` 中承担的业务关系整理逐步下沉到后端 API / 数据包投影层。

本次调整：

- 新增 `GET /api/v1/capabilities/workspace-projection`，由 `src/sapd_wiki/api_server.py` 生成安全能力映射页的技术视角和管理视角关系投影。
- 更新 `frontend/capability-browser/dataClient.js`，新增 `getCapabilityWorkspaceProjection()`，优先读取后端投影接口。
- 更新 `frontend/capability-browser/app.js` 和 `frontend/capability-browser/viewModels.js`，安全能力映射页优先消费后端投影；API 不可用时保留 ViewModel fallback。
- 更新 `docs/01-architecture/backend-interface-design.md`、`docs/01-architecture/api-field-contract.md`、`README.md`、`frontend/capability-browser/README.md` 和 `task_plan.md`，记录新接口和边界。

验证：

- `python3 -m py_compile src/sapd_wiki/api_server.py src/sapd_wiki/cli.py` 通过。
- `node --check frontend/capability-browser/dataClient.js`、`node --check frontend/capability-browser/app.js`、`node --check frontend/capability-browser/viewModels.js` 通过。
- `PYTHONPATH=src python3 -c ...` 直接调用 `capability_workspace_projection()` 通过，结果为 `ready`，技术映射 379 行、管理映射 91 行、关注点 91 个。
- 本地 API 路由验证首次因沙箱禁止绑定 `127.0.0.1` 失败；使用授权后的同进程临时服务验证 `/api/v1/capabilities/workspace-projection` 返回 200，结果为 `ready`。
- `git diff --check` 通过。

### 2026-05-15 全工程前后端分离规则固化

任务：用户明确要求“整个工程都要遵守前后端分离”。

本次调整：

- 更新 `AGENTS.md`，将前后端分离写入全工程开发规则。
- 更新 `CURRENT_STATE.md`、`task_plan.md` 和 `findings.md`，把 API / 后端契约优先作为后续恢复、计划和风险判断的当前有效口径。
- 更新 `docs/01-architecture/backend-interface-design.md`，将运行模式从“静态 JSON MVP、未来 API”修正为“本地 API 优先、离线数据包 fallback”。
- 更新 `docs/01-architecture/api-field-contract.md` 和 `docs/04-user-guide/frontend-baseline-1.0-plan.md`，明确 `dataClient`、`/api/v1/*`、ViewModel 和离线 JSON 的边界。
- 更新 `README.md`，补充全工程前后端分离说明。

验证：

- `rg -n "未来 API|未来接口|静态 JSON 作为 MVP|后续切换|不强制启动本地 HTTP API|再切换为" docs README.md AGENTS.md CURRENT_STATE.md task_plan.md findings.md`：除历史归档外，未发现当前有效文档中残留冲突口径。
- `python3 -m py_compile src/sapd_wiki/api_server.py src/sapd_wiki/cli.py` 通过。
- `node --check frontend/capability-browser/dataClient.js` 通过。
- `python3 scripts/sapd_wiki.py serve --help` 通过。
- `PYTHONPATH=src python3 -c ...` 验证 `management` 数据包可读取，`scopes` 专项页面为 10 条。
- `git diff --check` 通过。

### 2026-05-15 专项知识维护前后端分离过渡

任务：用户要求先把专项知识维护这部分做前后端分离。

本次调整：

- 新增 `src/sapd_wiki/api_server.py`，使用 Python 标准库提供本地 HTTP API 和静态前端服务。
- 更新 `src/sapd_wiki/cli.py`，新增 `serve` 命令。
- 更新 `frontend/capability-browser/dataClient.js`，前端优先读取 `/api/v1/data-packages/*`，API 不可用时自动回退到 `public/data/*.json`。
- 更新 `README.md`、`frontend/capability-browser/README.md` 和 `docs/01-architecture/backend-interface-design.md`，补充本地 API 运行方式和接口边界。
- 更新 `docs/04-user-guide/special-maintenance-pages-prototype-brief.md`，补充专项知识维护本地 API 过渡模式。

验证：

- `python3 -m py_compile src/sapd_wiki/api_server.py src/sapd_wiki/cli.py` 通过。
- `node --check frontend/capability-browser/dataClient.js` 通过。
- `python3 scripts/sapd_wiki.py serve --help` 通过。
- `PYTHONPATH=src python3` 直接读取 API 数据包和 8 个专项页面 payload，通过。
- 临时启动 `python3 scripts/sapd_wiki.py serve --host 127.0.0.1 --port 8765`，验证 `/api/v1/health`、`/api/v1/maintenance`、`/api/v1/data-packages/management` 均返回 200；验证后已关闭本轮启动的服务进程。

## 历史索引

| 归档文件 | 内容 |
|---|---|
| `docs/05-archive/context-slimming-2026-05-15/task_plan-full-before-slimming.md` | `task_plan.md` 瘦身前完整内容 |
| `docs/05-archive/context-slimming-2026-05-15/findings-full-before-slimming.md` | `findings.md` 瘦身前完整内容 |
| `docs/05-archive/context-slimming-2026-05-15/progress-full-before-slimming.md` | `progress.md` 瘦身前完整内容 |
| `docs/05-archive/context-slimming-2026-05-15/current-state-before-slimming.md` | `CURRENT_STATE.md` 本轮瘦身前快照 |
| `docs/05-archive/findings-history/2026-05.md` | 2026-05 历史发现 |
| `docs/05-archive/progress-history/2026-05.md` | 2026-05 完整执行记录 |

## 维护规则

- 本文件只记录最近 1-3 次重要执行。
- 超过 120 行时继续归档到 `docs/05-archive/`。
- 详细过程、长命令输出和阶段性历史不再写入根目录 `progress.md`。
