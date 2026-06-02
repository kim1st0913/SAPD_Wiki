# Open Issues

本文件现在只保留当前仍需处理或确认的问题、问题模板和治理入口。已关闭问题的完整记录已归档，避免当前入口继续膨胀。

## 治理入口

- 当前未关闭问题数：2
- 已关闭归档问题数：128
- 全量索引：`docs/06-implementation/open-issues-index.md`
- 已关闭问题归档：`docs/05-archive/open-issues-history/2026-06.md`
- 重复编号待治理：`OI-044`、`OI-092`，索引中使用 `OI-xxx#n` 区分历史条目。

## 当前未关闭问题

| 编号 | 状态 | 标题 |
|---|---|---|
| OI-038 | 待确认 | Gartner 与安全职能候选映射需后续人工校对 |
| OI-127 | 待修复 | 知识库字典与安全标准 / 框架多分片按需加载契约需全局治理 |

## 问题记录模板

## OI-000：问题标题

- 状态：
- 类型：数据 / 前端 / ETL / 文档 / 需求
- 对象或页面：
- 现象：
- 影响：
- 当前处理：
- 需要确认：
- 修复说明：
- 验证结果：

## 当前问题详情

## OI-038：Gartner 与安全职能候选映射需后续人工校对

- 状态：待确认
- 类型：数据 / 需求
- 对象或页面：岗位参考页面，`Gartner 工作岗位参考` 页签
- 现象：Sheet Review 2.1 / 2.2 已生成 28 条 Gartner 岗位参考到安全职能的候选映射，其中 20 条候选范围偏宽；2026-06-01 复查发现页面数据包未带入候选映射，`Gartner 工作岗位参考` 页签未显示映射数据。
- 影响：当前候选映射可先用于页面格式和关系展示落地，但不能视为最终业务确认结果。
- 当前处理：用户确认 Gartner 映射先按当前候选结果执行，页面格式先做好；2026-06-01 已把 `sheet-review-2-2-gartner-to-work-function-candidates.csv` 接入 `maintenance-knowledge.json` 导出，并在页面表格 / 详情显示候选安全职能、映射状态和匹配依据；后续单独验证校对。
- 需要确认：后续由用户逐条检查 `data/exports/worker-verify/sheet-review-2-2-gartner-to-work-function-candidates.csv`，确认哪些候选接受、删除或调整。
- 修复说明：页面显示缺口已修复；候选映射继续作为 `待复核` 数据保留，不作为最终正式关系。
- 验证结果：2026-06-01 重新导出 `maintenance-knowledge.json` 后，`gartner_roles=28`，其中 28 条均包含 `candidate_work_functions`；组件渲染断言确认 `Gartner 工作岗位参考` 表格包含“候选安全职能”列，示例“首席信息安全官（CISO）”显示 `2 安全负责职能`、`10 安全管理职能`、`27 规划计划管理职能`。
## OI-127：知识库字典与安全标准 / 框架多分片按需加载契约需全局治理

- 状态：待修复
- 类型：前端 / 数据契约 / 治理
- 对象或页面：`知识库字典`、`安全标准 / 框架`、`frontend/capability-browser/app.js`、`frontend/capability-browser/components/StandardFrameworkTable.js`、`frontend/capability-browser/viewModels.js`
- 现象：`maintenance-index.json`、`maintenance/*.json`、`standards-index.json` 和 `standards/**/*.json` 已采用索引先行与分片按需加载；安全职能清单、岗位 / 职能参考、技术服务、技术模块以及多 tab 标准 / 框架页面存在主分片和补充分片分离。如果页面只等待主分片，或组件内部自行懒加载 tab 数据，就可能出现首次进入停留在 loading、关系气泡显示假 `0`、刷新后偶发恢复、tab 切换加载状态不统一等问题。
- 影响：后续继续拆分数据包或优化页面时，同类问题可能在知识库字典和安全标准 / 框架页面反复出现，难以通过轻量 HTTP smoke 提前发现。
- 当前处理：已将 `Frontend Lazy Data Contract Baseline 1.0` 作为全局基准落地；页面必须显式声明 `required` 与 `supplemental` 数据依赖；组件不得直接调用 `dataClient` 做业务数据加载；新增 `scripts/audit_frontend_lazy_load_contract.mjs` 检查加载契约、标准页组件内取数和标准 / 框架 tab `dataPath`。
- 需要确认：后续如新增知识库字典二级入口、标准 / 框架、多 tab 数据表或跨包关系气泡，必须先补加载契约和审计规则，再进入页面展示实现。
- 修复说明：本轮完成全局基准、知识库字典加载契约集中化、标准页 `activeStandardTableId` 与统一 table loader、标准页组件内取数上移和审计脚本；关系气泡更细粒度 `partialReady` 文案可作为后续体验增强，不影响本轮契约治理关闭。
- 验证结果：2026-06-02 执行 `node --check frontend/capability-browser/app.js frontend/capability-browser/viewModels.js frontend/capability-browser/components/StandardFrameworkTable.js scripts/audit_frontend_lazy_load_contract.mjs` 通过；`node scripts/audit_frontend_lazy_load_contract.mjs` 返回 `result=pass`、`standardFrameworks=7`、`standardTabs=6`、`issues=[]`；`python3 scripts/dev_server_guard.py --status` 通过；`/knowledge/functions`、`/knowledge/technical-services`、`/standards/nist-csf-2`、`/standards/dsp-level-2`、`/standards/crf`、`/standards/nist-800-53-rev5` 轻量 smoke 通过，未启动系统 Chrome。
