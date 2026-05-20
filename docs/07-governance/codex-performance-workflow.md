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
python3 scripts/dev_server_guard.py --fix-duplicates --start
```

用途：

- 检查 `5173` 是否被重复占用；
- 优先保留 `scripts/sapd_wiki.py serve` 项目服务；
- 关闭重复的普通 `python -m http.server`；
- 确认首页和关键 API 是否响应。

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

### 前端页面 smoke

```bash
node scripts/frontend_smoke_check.mjs --page capability
node scripts/frontend_smoke_check.mjs --page standards
node scripts/frontend_smoke_check.mjs --page environment
node scripts/frontend_smoke_check.mjs --page lifecycle
```

用途：

- 用 Chrome headless 打开本地页面；
- 切换到指定页面；
- 检查 console error、横向溢出、关键 DOM 节点；
- 保存截图路径；
- 只输出 JSON 摘要。

## 大文件读取规则

| 场景 | 默认做法 | 允许升级 |
|---|---|---|
| JSON 数据包 | 用 `data_package_summary.py` 看字段和计数 | 按对象 id 或抽样读取 |
| 前端 diff | `git diff --stat` + 目标文件 diff | 用户要求审查完整 diff 时再读 |
| 浏览器验证 | `frontend_smoke_check.mjs` 摘要 | 截图异常时查看截图或局部 DOM |
| 进程排查 | `dev_server_guard.py --status` / `lsof -iTCP:5173` | 只有定位不到端口问题时再扩大 |
| 历史追溯 | `progress.md` / `findings.md` 轻量入口 | 明确追溯时读取归档局部 |

## 减负流程

当出现以下任一情况：

- `Reconnecting...` 多次出现；
- 简单任务也明显变慢；
- `progress.md` 超过 120 行；
- 工作区存在大量未提交 diff；
- 浏览器验证输出过大；
- 5173 有重复服务；

Codex 应优先执行：

1. `git status --short --branch`
2. `wc -l CURRENT_STATE.md task_plan.md findings.md progress.md AGENTS.md`
3. `python3 scripts/dev_server_guard.py --status`
4. 如 `progress.md` 超过 120 行，先归档瘦身。
5. 如工作区改动较大，建议 checkpoint commit。
6. 完成减负后再继续业务任务。

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
