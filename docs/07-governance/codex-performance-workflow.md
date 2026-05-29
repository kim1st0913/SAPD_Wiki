# Codex 轻量开发与验证工作流

本文档定义 SAPD Wiki 项目中的默认 Codex 执行方式。目标是让用户只需要说“继续执行”“排查一下”“修一下”，Codex 也能自动采用轻量、可恢复、可验证的工程流程，避免因大输出、大上下文或重复服务导致卡顿和重连。

## 适用范围

本规则适用于所有 Codex 会话，尤其是：

- 前端页面优化和浏览器验证；
- 数据导入、标准 / 框架核对和导出验证；
- API 投影、离线数据包和 ViewModel 调整；
- 用户只说“继续执行”“执行”“排查一下”等短指令时。

## 默认执行原则

1. 先轻量恢复上下文：读取 `CURRENT_STATE.md`、`progress.md`，必要时再读 `task_plan.md`、`findings.md`。
2. 不默认读取归档、大 JSON、完整导出目录、完整数据库备份或完整历史日志。
3. 不默认输出全量 `git diff`、全量 DOM、全量 console log、全量 `ps -ax`。
4. 先看摘要和计数，发现异常再按文件、函数、对象 id 或页面区块深入。
5. 验证脚本只输出摘要指标，截图只保存本地路径，不把大图、DOM 或长日志塞进对话。
6. 大任务分阶段 checkpoint：只读 Gap Check、实现 Patch、摘要 Smoke、必要时 commit。
7. 如果出现多次重连、响应明显变慢或工具输出过大，先执行“减负流程”，再继续业务开发。

## 用户短指令处理规则

当用户只说“继续执行”“执行”“继续”“修一下”“排查一下”时，Codex 默认执行：

1. 读取 `CURRENT_STATE.md` 和 `progress.md`。
2. 用 `git status --short --branch` 查看工作区状态。
3. 若任务目标明确，继续当前任务；若目标不明确，只问 1 个问题。
4. 不读取 `docs/05-archive/`、`data/exports/`、`frontend/capability-browser/public/data/*.json`，除非任务明确需要。
5. 不运行全量 `ps -ax`；检查端口使用 `python3 scripts/dev_server_guard.py --status`。
6. 不输出全量 diff；先用 `git diff --stat`，再按目标文件读取局部 diff。
7. 验证使用轻量脚本，输出摘要。

## 推荐命令

### 服务状态和端口治理

```bash
python3 scripts/dev_server_guard.py --status
python3 scripts/dev_server_guard.py --start
python3 scripts/dev_server_guard.py --restart
python3 scripts/dev_server_guard.py --fix-duplicates --start
python3 scripts/dev_server_guard.py --port <temp-port> --stop
```

用途：

- 检查 `5173` 是否被重复占用；
- 优先保留 `scripts/sapd_wiki.py serve` 项目服务；
- 关闭重复的普通 `python -m http.server`；
- 确认首页和关键 API 是否响应。

端口约定：

- `5173` 是 SAPD Wiki 唯一常驻预览端口。
- 前端展示、用户验收和最终截图默认都使用 `http://127.0.0.1:5173/`。
- 修改 `frontend/capability-browser/` 后必须确认 `5173` 已加载最新文件；优先依赖本地项目服务的 `Cache-Control: no-store` 和浏览器刷新完成热刷新。
- 如果刷新后仍看到旧页面，先执行 `python3 scripts/dev_server_guard.py --restart` 重启固定端口项目服务；不要另起一个长期预览端口。
- 多个线程同时需要验证时，可以临时使用其它端口，例如 `5174`、`5175`。
- 临时端口只用于验证，验证完成后必须执行 `python3 scripts/dev_server_guard.py --port <temp-port> --stop` 关闭。
- 不把临时端口写入长期文档、截图说明或最终交付入口；面向用户的默认访问地址始终使用 `http://127.0.0.1:5173/`。
- 不使用 `python -m http.server 5173` 作为常驻服务；该方式没有 `/api/v1/*` 能力，也容易造成刷新和数据状态误判。

### 数据包摘要

```bash
python3 scripts/data_package_summary.py --package standards
python3 scripts/data_package_summary.py --package capability
python3 scripts/data_package_summary.py --package all
```

用途：

- 输出数据包存在性、大小、顶层字段、关键计数；
- 检查主展示结构中是否疑似泄露 `sheet`、`row`、`raw_value`、`debug`、`metadata` 等非业务字段；
- 只输出摘要，不打印完整 JSON。

标准 / 框架数据包的额外要求：

- `standards` 摘要应指向 `frontend/capability-browser/public/data/standards-index.json`。
- `standards-index.json` 应保持小索引，不承载 `rows`。
- `standards-data.json` 仅作旧入口兼容索引，不得恢复为全量大包。
- 新前端通过 `/api/v1/data-packages/standards-index` 或静态 `standards-index.json` 读取小索引；旧 API 入口 `/api/v1/data-packages/standards` 只允许运行时兼容组装，不允许落盘为全量静态包。
- `frontend/capability-browser/public/data/standards/**` 承载框架和 Tab 分包；只按需抽样，不默认全量读取。

### 前端页面 smoke

```bash
node scripts/frontend_smoke_check.mjs --page capability
node scripts/frontend_smoke_check.mjs --page standards
node scripts/frontend_smoke_check.mjs --page environment
node scripts/frontend_smoke_check.mjs --page lifecycle
```

用途：

- 默认不启动系统 Google Chrome，只做轻量 HTTP/API 检查，避免 macOS 反复弹出 `Google Chrome 意外退出` 报告。
- 如果确实需要 DOM / 截图 / console 验证，优先使用 Codex in-app browser；只有用户明确同意时，才允许执行 `node scripts/frontend_smoke_check.mjs --page <page> --allow-system-chrome`。
- 启动系统 Chrome 的验证结束必须通过 DevTools `Browser.close` 优雅关闭；只有优雅关闭失败时才允许发送进程终止信号。

## 大文件读取规则

| 场景 | 默认做法 | 允许升级 |
|---|---|---|
| JSON 数据包 | 用 `data_package_summary.py` 看字段和计数 | 按对象 id 或抽样读取 |
| 前端 diff | `git diff --stat` + 目标文件 diff | 用户要求审查完整 diff 时再读 |
| 浏览器验证 | in-app browser 或 `frontend_smoke_check.mjs` 轻量 HTTP/API 摘要 | 用户明确同意后才允许 `--allow-system-chrome` |
| 进程排查 | `dev_server_guard.py --status` / `lsof -iTCP:5173` | 只有定位不到端口问题时再扩大 |
| 历史追溯 | `progress.md` / `findings.md` 轻量入口 | 明确追溯时读取归档局部 |

## 减负流程

当出现以下任一情况：

- `Reconnecting...` 多次出现；
- 简单任务也明显变慢；
- `progress.md` 超过 120 行；
- 工作区存在大量未提交 diff；
- 浏览器验证输出过大；
- 5173 有重复服务或存在未关闭的临时项目预览端口；

Codex 应优先执行：

1. `git status --short --branch`
2. `wc -l CURRENT_STATE.md task_plan.md findings.md progress.md AGENTS.md`
3. `python3 scripts/dev_server_guard.py --status`
4. 如 `progress.md` 超过 120 行，先归档瘦身。
5. 如工作区改动较大，建议 checkpoint commit。
6. 完成减负后再继续业务任务。

## 子 Agent 与长任务运行规则

当主控使用子 Agent 或启动长时间运行的导入、导出、审计、打包、前端验证任务时，必须采用“运行证据优先”的判断方式：

1. `wait_agent` 超时、工具轮询暂无新输出、日志暂时不刷新，只能说明“暂无新结果”，不得直接等同于“无响应”。
2. 只要 Agent 状态仍在运行，或相关进程、日志、产物文件、导出目录、数据库文件仍有活动，就视为任务仍在执行。
3. 主控不得因为一两次短轮询无输出就关闭 Agent；关闭前必须完成三次确认：
   - 确认 Agent / 进程状态；
   - 确认日志、产物文件或输出目录是否变化；
   - 向用户说明证据，询问是继续等待、停止任务，还是转为主控接管。
4. 除非用户明确要求停止、Agent 明确完成、Agent 明确报错退出，或三次确认后用户批准停止，否则不得关闭仍在运行的 Agent。
5. 子 Agent 运行中，主控不得重复执行同一写入任务；如果需要降低风险，可以做只读旁路检查，但必须说明不会覆盖或干扰子 Agent。
6. 长任务状态反馈应使用固定口径：
   - `运行中`：进程或 Agent 仍在，继续等待；
   - `暂无新输出`：没有新文本，但不代表失败；
   - `疑似卡住`：必须列出证据；
   - `请求决定`：给用户明确选项，例如继续等、停止、转主控接管。
7. 子 Agent 完成后，主控必须 fan-in：读取结果、复核关键结论、决定是否采纳、记录到 `progress.md`，再关闭不再需要的 Agent。

推荐反馈模板：

```text
Agent <id> 仍在运行，最近一次等待暂无新输出。
已确认：状态未完成 / 产物目录仍有变化 / 未见明确报错。
我会继续等待，不关闭它；主控只做非重叠的只读或集成工作。
```

## 子 Agent 并行使用边界

主控可以使用子 Agent，但必须把它们当作“有边界的并行工作线程”，不能让它们替代主控做最终业务判断。

### 适合并行的任务

| 类别 | 建议 Agent | 可并行拆法 | 输出给主控 |
|---|---|---|---|
| 页面只读 Gap Check / QA 审计 | Frontend Review Agent | 按页面拆分，如安全能力、信息化环境、LC-AP、标准 / 框架 | 页面缺口、字段泄露风险、验证建议 |
| 数据质量核对但不修复 | Data QA Agent | 按数据包、open issue、源 Sheet 局部拆分 | 数据事实、异常、是否需要用户判断 |
| 前端视觉 / 交互评估 | Frontend Review Agent | 按页面或组件族拆分 | 视觉一致性、空状态、交互风险 |
| 文档整理 / UAT 草案 | Documentation Agent | 限定单一文档或只读草案 | 验收清单、交付说明、问题复盘 |
| Delivery Bundle 平台验证准备 | Delivery QA Agent | macOS、Windows、ZIP 结构、更新包脚本分别核查 | 平台验证结果和缺口 |
| 归档任务线梳理 | Archive Review Agent | 只读 `progress-history`、`findings-history` 的标题和索引 | 可恢复任务线和不再需要任务线 |

### 不适合并行写入的任务

| 类别 | 原因 | 处理方式 |
|---|---|---|
| ETL / parser / export 逻辑修改 | 会影响数据库、导出包、页面契约和后续验证 | 主控串行修改，子 Agent 只做只读核对 |
| `dataClient`、ViewModel、API projection contract | 高耦合，容易出现对象粒度串包和 fallback 误用 | 主控串行修改并统一验证 |
| `app.js`、`styles.css`、跨页公共组件大改 | 多页面共享，容易互相覆盖和视觉误伤 | 单线控制，小步提交 |
| `open-issues.md` 权威状态 | 唯一问题源，不允许多线程争抢编号和状态 | 子 Agent 只能提交 issue 草案，主控统一合并 |
| `CURRENT_STATE.md`、`task_plan.md`、`findings.md`、`progress.md` | 项目状态入口，写散后会误导后续会话 | 只由主控更新 |
| 需要用户业务判断的源数据修正 | AI 不能替代用户确认业务口径 | 子 Agent 列事实和选项，主控向用户确认 |

### Fan-out 模板

每个子 Agent 启动前必须写清：

```text
Agent 角色：
任务目标：
只读 / 写入范围：
禁止范围：
验收标准：
超时与 fan-in 格式：
```

常用角色：

```text
Data QA Agent
- 只读范围：指定数据包摘要、指定 issue、必要源文档局部
- 禁止：修改 ETL、JSON、数据库、open-issues

Frontend Review Agent
- 只读范围：指定页面源码、CSS 局部、smoke 结果
- 禁止：修改 dataClient、ViewModel、业务关系模型

Documentation / UAT Agent
- 写入范围：单一指定文档，或只输出草案
- 禁止：修改项目状态入口和问题权威文件
```

### Fan-in 模板

主控在子 Agent 完成后必须统一做：

1. 汇总每个子 Agent 的事实结论。
2. 区分 `已验证事实`、`推测`、`需要用户确认`。
3. 只由主控更新 `open-issues.md`、`progress.md`、`task_plan.md`。
4. 对跨域问题重新排序优先级。
5. 明确是否采纳结果，并关闭不再需要的子 Agent。

## 标准 / 框架分包验证

涉及 `安全标准 / 框架` 导出或前端加载时，默认按以下顺序验证：

1. 运行导出：

```bash
python3 scripts/sapd_wiki.py export-standard-frameworks-data
```

2. 摘要检查：

```bash
python3 scripts/data_package_summary.py --package standards
```

预期：

- `path` 为 `frontend/capability-browser/public/data/standards-index.json`；
- `data_state=ready`；
- `split_files` 大于 0；
- `standards-index.json` 和兼容 `standards-data.json` 都是小索引。

3. 精确抽样检查索引不含行数据：

```bash
python3 - <<'PY'
import json
from pathlib import Path
for rel in [
    "frontend/capability-browser/public/data/standards-index.json",
    "frontend/capability-browser/public/data/standards-data.json",
]:
    data = json.loads(Path(rel).read_text(encoding="utf-8"))
    print(rel, data.get("package_type"), any("rows" in f for f in data.get("frameworks", [])))
PY
```

4. 浏览器验证：

- 进入具体标准页时，首屏只请求索引和当前框架 / 当前 Tab 分包；
- 切换 Tab 后才请求对应 Tab 分包；
- 页面横向溢出为 0；
- 主展示区不出现非业务字段。

## 验证输出格式

验证结论应尽量短，例如：

```text
page: capability
consoleErrors: 0
horizontalOverflow: 0
criticalNodes: pass
screenshot: /private/tmp/sapd-capability.png
result: pass
```

不要把完整 DOM、完整 JSON、完整浏览器日志或长截图说明贴入对话。

## 不会遗漏内容的原则

轻量工作流不是“不看内容”，而是“先摘要、后深入”：

- 摘要正常：继续开发或验收。
- 摘要异常：读取异常对象、异常字段或异常页面局部。
- 用户指出具体数据：按 id 精确查询。
- 发布前或重大导入后：可以跑完整验证脚本，但仍只输出摘要。
