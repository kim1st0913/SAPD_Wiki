# Open Issues

本文件现在只保留当前仍需处理或确认的问题、问题模板和治理入口。已关闭问题的完整记录已归档，避免当前入口继续膨胀。

## 治理入口

- 当前未关闭问题数：4
- 已关闭归档问题数：131
- 全量索引：`docs/06-implementation/open-issues-index.md`
- 已关闭问题归档：`docs/05-archive/open-issues-history/2026-06.md`
- 重复编号待治理：`OI-044`、`OI-092`，索引中使用 `OI-xxx#n` 区分历史条目。

## 当前未关闭问题

| 编号 | 状态 | 标题 |
|---|---|---|
| OI-038 | 待确认 | Gartner 与安全职能候选映射需后续人工校对 |
| OI-128 | 待实现 | USER-WRITE-UI-1：收藏 / 备注最小前端入口 |
| OI-132 | 待治理 | 安全能力映射页数据加载稳定性与空态可信度治理 |
| OI-133 | 待设计 | ArchiMate 建模语言页显示效果与加载效率优化 |

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
## OI-128：USER-WRITE-UI-1：收藏 / 备注最小前端入口

- 状态：待实现
- 类型：前端 / 用户数据 / Delivery Bundle
- 对象或页面：ZIP alpha 桌面包、`sapd_wiki_user.sqlite3`、安全能力映射 / 知识库字典等对象详情页。
- 现象：ZIP alpha 后端已具备 `user_favorites` 写入 API 和 user DB 自动创建能力，但当前前端页面没有暴露收藏、备注、用户标签或编辑入口，Windows / macOS UAT 无法通过页面操作验证 user DB 写入。
- 影响：当前 Windows 包只能验收解压启动、页面访问、base 数据读取、user DB 自动创建、日志和诊断包；页面级用户写入能力不能作为本轮验收项。
- 当前处理：Windows release manifest 已将 `page_user_write` 标记为 `not_available_current_frontend`；本问题作为后续独立最小实现任务保留。
- 需要确认：第一版优先做“收藏”还是“备注”；建议先做收藏，再做备注。
- 修复说明：待实现。
- 验证结果：待实现后验证页面操作写入 `sapd_wiki_user.sqlite3`，重启后保留，且不修改 `sapd_wiki_base.sqlite3`。
## OI-132：安全能力映射页数据加载稳定性与空态可信度治理

- 状态：待治理
- 类型：前端 / 数据契约 / 验证
- 对象或页面：`安全能力映射` 页面，尤其是能力关系图谱、技术视角、管理视角、标准 / 框架映射四个 tab。
- 现象：安全能力映射页的数据加载和空态在多轮修复后仍可能复现异常；例如 2026-06-03 用户截图中当前选择 `T-AS.AD-01`，`标准 / 框架映射` tab 显示 `0 控制项 / 暂无条款/控制项对应能力关注点`，但当前页面无法让用户或审计脚本明确区分“源数据确实无映射”“对象级 workspace-view 未加载完成”“fallback 数据源被使用”“当前选中对象与右侧数据不一致”或“重渲染未触发”。
- 影响：用户无法信任空态是否代表业务事实；后续任何 UI、tab、ViewModel 或加载流程小修都可能再次破坏安全能力页，导致同类问题反复出现。
- 当前处理：不继续做局部补丁；新增独立执行线 `EL-024`，先治理数据加载可观测性、对象一致性断言、空态原因和回归审计，再决定是否修改 `app.js`、`viewModels.js`、`dataClient.js` 或组件。
- 需要确认：用户后续可指定截图中的关注点或其他复现对象，确认该对象在源数据 / 后端 projection 中是否应有标准 / 框架控制项。
- 修复说明：待治理。建议分四步执行：1）为安全能力页建立加载状态诊断口径；2）扩展对象级 workspace-view 审计，覆盖 L0 / L1 / L2 / L3 关注点和四个 tab；3）禁止 ViewModel 在数据源不明时静默把标准映射降级为空数组；4）把“真实空数据”和“加载 / fallback / mismatch”渲染为不同状态。
- 验证结果：2026-06-03 EL-001 初验中，`node scripts/audit_capability_viewmodel_contract.mjs --url http://127.0.0.1:5173` 与 `node scripts/audit_capability_projection_contract.mjs --url http://127.0.0.1:5173` 在提升本地网络权限后均通过；其中截图复现对象 `T-AS.AD-01` 的 ViewModel 审计返回 `standardRows=1`，说明页面显示 `0 控制项` 不能直接判定为真实无数据，后续必须继续排查 tab rows、加载状态、fallback 或重渲染。
## OI-133：ArchiMate 建模语言页显示效果与加载效率优化

- 状态：待设计
- 类型：前端 / 设计 / 性能
- 对象或页面：`安全指南 / 安全架构建模语言`，路由 `/guides/security-architecture-modeling-language`。
- 现象：`archimate建模` 会话已把 PDF iframe 改为整页 JPG + 6 个区域 JPG，并提供 PDF 下载，但页面效果仍未达到用户预期。当前页面更像“Poster 素材陈列”，还没有形成清晰的建模语言阅读路径、区域导航、SAPD 映射说明和高效加载策略。
- 影响：用户查看标准海报和 SAPD 元素图例时容易迷路；首屏仍可能加载整页图和多张区域图；后续如果继续局部调 UI，可能再次造成视觉杂糅和性能回退。
- 当前处理：新增优化评估文档 `docs/06-implementation/archimate-modeling-page-optimization-plan.md`，建议将该页从图片查看器升级为“建模语言参考工作页”，并作为独立执行线处理。
- 需要确认：后续是否先实现 `P1 区域导航 + 当前区域阅读器`，还是先补 `SAPD 元素图例 -> ArchiMate 区域` 的映射说明。
- 修复说明：待设计 / 待实现。当前不直接修改前端运行代码。
- 验证结果：待后续执行页面截图 / DOM 摘要、图片请求数、首屏加载、固定 `5173` smoke 和字段边界检查。
