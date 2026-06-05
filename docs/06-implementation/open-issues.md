# Open Issues

本文件现在只保留当前仍需处理或确认的问题、问题模板和治理入口。已关闭问题的完整记录已归档，避免当前入口继续膨胀。

## 治理入口

- 当前未关闭问题数：4
- 已关闭归档问题数：133
- 全量索引：`docs/06-implementation/open-issues-index.md`
- 已关闭问题归档：`docs/05-archive/open-issues-history/2026-06.md`
- 重复编号待治理：`OI-044`、`OI-092`，索引中使用 `OI-xxx#n` 区分历史条目。

## 当前未关闭问题

| 编号 | 状态 | 标题 |
|---|---|---|
| OI-038 | 待确认 | Gartner 与安全职能候选映射需后续人工校对 |
| OI-128 | 部分完成 | USER-WRITE-UI-1：批注 / 工作台用户写入入口 |
| OI-133 | 待设计 | ArchiMate 建模语言页显示效果与加载效率优化 |
| OI-135 | 待设计 | 用户库治理与兼容表迁移清理 |

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
## OI-128：USER-WRITE-UI-1：批注 / 工作台用户写入入口

- 状态：部分完成
- 类型：前端 / 用户数据 / Delivery Bundle
- 对象或页面：ZIP alpha 桌面包、`sapd_wiki_user.sqlite3`、安全能力映射 / 知识库字典 / 标准框架 / 安全指南、右侧浮层批注抽屉与工作台。
- 现象：ZIP alpha 后端已具备 `user_favorites` 写入 API 和 user DB 自动创建能力；`OI-128A / OI-128B` 已验证页面可写入用户库，但当前横向 `加入关注清单 / 收藏备注` 条语义较弱，不适合作为长期用户工作入口。
- 影响：当前 Windows 包只能验收解压启动、页面访问、base 数据读取、user DB 自动创建、日志和诊断包；页面级用户写入能力不能作为本轮验收项。
- 当前处理：2026-06-03 已新增正式设计文档 `docs/06-implementation/user-workspace-v1-to-v4-design.md`，固定 V1A 收藏 / 轻备注、V1B 备注 / 标签、V2 我的工作区、V3 新增 / 复制编辑、V4 导出路线。`OI-128A` 已先在安全能力映射页对象详情区实现关注清单 / 收藏备注入口，并补齐开发 API 与 ZIP runtime 的收藏保存 / 撤销路径；`OI-128B` 已把同一用户动作组件复用到安全知识、标准 / 框架和安全指南页面。2026-06-04 已新增 `docs/06-implementation/workspace-annotation-and-capability-remix-design.md`，固定后续下线横向收藏条，改为右侧上浮批注抽屉和工作台方向；同日 `OI-128C` 已实现右侧浮层批注抽屉第一版。2026-06-04 用户截图复核发现第一版存在列表冗余、不可编辑、切页不收起、上下文重复、当前页计数错误、搜索框异常、草稿跨页残留和行 / 字段锚点缺失等问题；`OI-128C` 修正版已继续收敛右侧抽屉 UX / 逻辑、Apple shell 组件基线和 Office Word 式批注栏设计，新增精确上下文锚点定位、固定宽度抽屉、长标题截断悬停展示和原页面纯高亮标记。2026-06-05 进一步确认 LC-AP / LC-DT 页面缺少统一值级锚点，已把生命周期字段、生命周期 chip、数据场景、策略文本和参考数据接入 `data-annotation-value` / `data-copy-text` 契约；共享 `display.relationChip` 也默认输出同一锚点属性。2026-06-05 追加全工程批注契约治理：普通 `td` 表格单元格增加值级兜底，知识库字典、标准 / 框架折叠目录定位可自动展开父级分组，手写关系 chip 和详情字段统一接入 `display.annotationValueAttrs`，`scripts/audit_user_annotation_contract.mjs` 升级为跨页面动态渲染审计，防止值批注再次退化为行批注。2026-06-05 用户再次截图验证发现：`/standards/nist-csf-2` 保存后无可见常驻高亮、`/development-security` 高亮样式偏离约定基准、`/data-security` / 模块值定位后高亮不可见或回退；已新增 `docs/06-implementation/global-annotation-requirements-and-regression-matrix.md` 作为全局批注需求与页面级验收矩阵。2026-06-05 继续按用户“批注是叠加层”判断修复 overlay 架构：知识库表格行渲染后统一挂载稳定 `data-annotation-target-ref`，批注标记 / 定位优先使用稳定目标，再退回旧 `field_value` / `table_row` 兼容锚点；行级和单元格级高亮穿透到 `td` / `th`，避免被标准页、CSF 行、生命周期矩阵等表格背景盖住；资源版本更新到 `annotation-global-20260605-2`。2026-06-05 最新严格回归已收口：当前用户库 24 条保存批注真实 Chrome 严格回归 `24/24 pass`，覆盖值级 / 行级粒度、点击后常态保留、无批注误高亮、模块 / 措施 chip 定位和多页面上下文恢复。2026-06-05 二次人工抽查问题已修复：安全技术措施 / 模块 / 服务常态与定位高亮、点击页面后常态保留、非首屏定位抽屉滚动保持、抽屉视口完整性均纳入真实 Chrome 严格回归并通过；下一步只做最终人工抽查和 checkpoint，不继续扩大批注功能。
- 追加修复：2026-06-05 用户再次确认安全技术措施 / 模块 / 服务仍无常态和定位高亮。复查确认根因是旧回归只验证 `data-user-note-anchor-marked / active` 属性，未验证视觉样式；技术 chip 的语义色规则，尤其 `.relation-chip.technical-chip:not(.module-chip):not(.measure-chip)`，会覆盖批注背景。已将批注 chip 覆盖层放到所有 chip 语义色规则之后，并补齐 `technical-chip service-chip` specificity；资源版本更新到 `annotation-global-20260605-4`。
- 追加视觉修复：2026-06-05 用户截图确认普通态高亮仍呈横向黄色长条。已将普通态从背景铺底改为贴文字的琥珀下划线；行级普通态只保留左侧标识，不再铺整行黄色；关系 chip 保留原语义底色并叠加低噪声下划线 / 边框。脚本新增 `normalStripeOk` 和 `normal_visual_stripe_too_wide`，防止普通态宽背景条再次被验收脚本放过；资源版本更新到 `annotation-global-20260605-5`。
- 追加后续变更：2026-06-05 用户继续反馈定位后高亮落到文字后方、L0-L2 批注无常态高亮、普通态高亮线需要加深加粗但不遮挡文字、几个指南 / 幻灯片页无法添加批注。已补齐 L0-L2 树节点对象高亮、幻灯片页 / slide stage 批注目标、定位滚动 `inline: nearest`、普通态下划线加深加粗，以及标准映射按需加载后的值锚点。标准映射 ViewModel 固定为 projection / workbench 为主，已加载 standards 包只补充不覆盖，避免 `NIST CSF` 加载后覆盖后端 projection 中的 `AT-6`；同时把 ISO 等按需加载标准框架 / 控制项补入 `localRelationMap`，保证关注点页 DOM 具备稳定 `standard-framework-name` 值锚点。
- 基线固化：2026-06-05 用户确认该问题基本验收通过，后续有问题再按 bug fix 处理。当前批注设计已作为全局基线固化到 `global-annotation-requirements-and-regression-matrix.md` 与 `frontend-global-design-baseline-2026-05-30.md`，并新增“新页面接入清单”。后续新增页面必须先声明页面对象、值锚点、行锚点、幻灯片 / 子页上下文和回归命令，不再逐页重新调试批注样式、定位逻辑和抽屉行为。
- 最新验证：2026-06-05 带视觉断言和长条防回归的真实 Chrome 回归通过：`node scripts/audit_saved_user_annotations.mjs --url http://127.0.0.1:5173 --allow-system-chrome --debug-port 9410 --width 1800 --height 1200 --compact` 返回 `noteCount=24`、`passed=24`、`failed=0`、`failures=[]`、`consoleIssues=[]`。脚本已新增 `normalVisualHighlight` / `activeVisualHighlight` / `normalStripeOk`，第 6 安全技术措施、第 7 安全技术模块、第 8 安全技术服务、第 24 安全技术模块均满足常态与定位视觉高亮，截图对应的 `1.6 接收其他应用数据` 也满足 `normalStripeOk=true`。
- 最新验证：2026-06-05 后续变更真实 Chrome 全量回归通过：`node scripts/audit_saved_user_annotations.mjs --url http://127.0.0.1:5173 --allow-system-chrome --debug-port 9433 --width 1800 --height 1200 --compact` 返回 `noteCount=28`、`auditedNoteCount=28`、`passed=28`、`failed=0`、`failures=[]`、`consoleIssues=[]`。单点与连续场景验证包括 `--only-ordinal 1` 的 ISO 标准框架值、`--only-ordinal 23` 的 `AT-6` 控制项，以及 `--from-ordinal 15 --to-ordinal 23 --debug-state` 的标准包加载后不覆盖 projection 场景，均通过。
- 提交后补充验证：2026-06-05 checkpoint 提交后发现当前用户库已扩展到 33 条保存批注，首次补跑全量回归抓出 4 条指南 / 幻灯片缩略图批注缺少定位态视觉高亮。已只针对 `.guide-slide-stage` / `.guide-thumb` 定位态补齐琥珀下沿并推进 `styles.css` 缓存版本到 `annotation-global-20260605-8`。随后定点 4 条回归通过，全量真实 Chrome 回归 `node scripts/audit_saved_user_annotations.mjs --url http://127.0.0.1:5173 --allow-system-chrome --debug-port 9446 --width 1800 --height 1200 --compact` 返回 `noteCount=33`、`auditedNoteCount=33`、`passed=33`、`failed=0`、`failures=[]`、`consoleIssues=[]`。
- 需要确认：后续是否进入工作台总览、数据篮 / 导出、能力重组、导入和 Skill 集成。
- 修复说明：`OI-128A / OI-128B / OI-128C` 已实现，`OI-128C` 二次严格回归已通过，待最终人工抽查与 checkpoint。当前入口以 `user_notes` 承载正式批注，`user_favorites.note` 仅作为过渡收藏备注显示；收藏不再作为主业务动作，正式入口改为 `批注`、`待复核`、`数据篮` 和 `工作台`。新建行 / 字段 / 值批注使用带 route、view、目录 / 子页面、对象、tab 和表格坐标的 `v2` 锚点，旧缺上下文批注不再为了视觉反馈误高亮所有同名值。页面组件必须显式声明 `data-annotation-value`；普通业务 `td` 作为全局兜底值锚点；折叠目录定位必须先展开父级并恢复常驻标记；知识库对象行通过稳定 `data-annotation-target-ref` 暴露 overlay 锚点；批注层负责右键、抽屉、保存、状态、tooltip、常驻提示和定位高亮，原页面只暴露锚点，不承担批注业务逻辑。用户写入只影响 `sapd_wiki_user.sqlite3`，不回写基础库。
- 验证结果：2026-06-03 通过本地 `5173` API 写入 / 读取 / 删除闭环验证：`POST /api/v1/user/favorites` 写入 `base:capability_focus:OI-128A-SMOKE` 成功，`GET` 可读，`DELETE` 后列表消失；`node scripts/frontend_smoke_check.mjs --page capability --url http://127.0.0.1:5173` 通过。2026-06-03 `OI-128B` 真实 Chrome 回归覆盖 `/knowledge/technical-services`、`/knowledge/capabilities`、`/standards/mlps-level-3`、`/guides/security-architecture-modeling-language`，均有 `userObjectActionsProbe.count=1`、`consoleIssues=0`。2026-06-04 `OI-128C` 通过 `POST /api/v1/user/notes`、`GET`、`PATCH`、`DELETE` 本地 API 闭环；真实 Chrome 回归覆盖 `/capability-mapping`、`/knowledge/technical-services`、`/standards/mlps-level-3`、`/guides/security-architecture-modeling-language`，均确认右侧批注抽屉存在、可展开、旧横向条数量为 0、`workspaceWidthDelta=0`、`consoleIssues=0`。2026-06-05 `node scripts/audit_user_annotation_contract.mjs` 通过，动态渲染样例确认 `LC-AP=14`、`LC-DT=11`、参考数据 `3` 个值级锚点。2026-06-05 全局版审计通过，覆盖能力映射技术 / 管理、信息化环境、技术服务、技术模块、技术措施、LC-AP 参考数据、详情面板、标准 / 框架和折叠目录定位契约。2026-06-05 overlay 修复后 `node --check frontend/capability-browser/app.js`、`node scripts/audit_user_annotation_contract.mjs`、`node scripts/audit_frontend_display_contract.mjs`、`node scripts/audit_frontend_lazy_load_contract.mjs`、`python3 scripts/dev_server_guard.py --status`、`git diff --check` 均通过；轻量 smoke 覆盖 `/capability-mapping`、`/environment-mapping`、`/development-security`、`/data-security`、`/knowledge/capabilities`、`/knowledge/technical-services`、`/knowledge/technical`、`/knowledge/technical-measures`、`/knowledge/functions`、`/knowledge/processes`、`/standards/nist-csf-2`、`/standards/mlps-level-3`、`/standards/iso-27001-2022`、`/standards/cis-csc-v8`、`/standards/crf`、`/standards/nist-800-53-rev5`、`/standards/dsp-level-2`、`/guides/security-architecture-modeling-language` 均通过；本轮未启动系统 Chrome，避免复现 Chrome 崩溃。2026-06-05 严格真实 Chrome 回归通过：`node scripts/audit_saved_user_annotations.mjs --url http://127.0.0.1:5173 --allow-system-chrome --debug-port 9397 --width 1800 --height 1200 --compact` 返回 `noteCount=24`、`passed=24`、`failed=0`、`consoleIssues=[]`，并逐条满足 `granularityOk=true`、`persistentAfterClick=true`、`unexpectedMarkedCount=0`。2026-06-05 二次严格真实 Chrome 回归通过：`node scripts/audit_saved_user_annotations.mjs --url http://127.0.0.1:5173 --allow-system-chrome --debug-port 9404 --width 1800 --height 1200 --compact` 返回 `noteCount=24`、`passed=24`、`failed=0`、`consoleIssues=[]`，并逐条满足 `normalMarkedBeforeLocate=true`、`activeAfterJump=true`、`granularityOk=true`、`persistentAfterClick=true`、`drawerPanelOk=true`、`currentNoteCardOk=true`、`drawerScrollPreserved=true`、`locateButtonClicked=true`、`unexpectedMarkedCount=0`。
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
## OI-135：用户库治理与兼容表迁移清理

- 状态：待设计
- 类型：数据 / 前端 / Delivery Bundle / 治理
- 对象或页面：`sapd_wiki_user.sqlite3`、`user_notes`、`user_favorites`、右侧批注抽屉、后续用户工作台 / 数据篮 / 导出 / 自定义能力。
- 现象：正式批注入口已切到 `user_notes`，旧 `user_favorites` 仍作为收藏 / 轻备注兼容表存在；后续工作台、数据导出、能力重组、导入和 Skill 集成都依赖用户库长期治理。
- 影响：若不治理，旧表语义、测试数据、迁移 / 备份 / 恢复边界和 base/user read model 合并规则会影响 Delivery Bundle 与用户工作台稳定性。
- 当前处理：已纳入 `task_plan.md` 的 `DB-11 用户库治理与兼容表迁移清理`；本轮只登记治理任务，不修改 schema、不迁移数据。
- 需要确认：是否保留 `user_favorites` 历史兼容、是否把旧收藏语义迁移到 `user_notes` / 数据篮、用户库备份 / 导出 / 清空测试数据的优先级。
- 修复说明：待设计。
- 验证结果：待验证。
