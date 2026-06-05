# progress.md

本文件是当前会话恢复入口，只保留最近状态、最近完成事项、关键验证和历史索引。完整执行历史已归档到 `docs/05-archive/progress-history/`。

## 当前状态（2026-06-05）

- 当前分支：`main`。
- 固定预览入口：`http://127.0.0.1:5173/`。前端展示和用户验收默认只看该端口。
- 当前主控主线：`OI-128C` 批注模块收口；不继续开发新批注功能，不混入工作台 V2 / V3。
- Open Issues 当前未关闭：`OI-038`、`OI-128`、`OI-133`、`OI-135`。
- 当前禁止事项：不默认改 ETL、数据库、数据模型、基础数据包、导出 JSON、用户库数据或业务关系推断；不 `git add .`；主展示区不得暴露 `sheet`、`row`、`column`、`raw_value`、`source_file`、`import_id`、`source_id`、`source_ref`、`source_label`、`debug`、`raw`、`metadata`、`intermediate`、`generated_at`。

## 最近完成事项

- 2026-06-05 `OI-128C` checkpoint 提交后补充真实回归：提交后发现当前用户库已扩展到 33 条保存批注，首次全量回归抓出 4 条指南 / 幻灯片缩略图批注缺少定位态视觉高亮。已只针对 `.guide-slide-stage` / `.guide-thumb` 定位态补齐琥珀下沿并推进 `styles.css` 缓存版本到 `annotation-global-20260605-8`，保留 Apple blue 聚焦圈。定点 4 条和全量 33 条真实 Chrome 严格回归均通过，最终 `33/33 pass`、`failures=[]`、`consoleIssues=[]`。
- 2026-06-05 `OI-128C` checkpoint 前治理状态同步：已将 `docs/07-governance/current-execution-lines.md` 中过期的 `24/24 pass`、最终人工抽查口径同步为当前事实：用户已基本验收通过，批注设计已作为全局基线固化，当前用户库保存批注真实 Chrome 严格回归最终口径为 `33/33 pass`、`failures=[]`、`consoleIssues=[]`。下一步进入 checkpoint amend 收口；仍不 `git add .`，不混入工作台 V2 / V3。
- 2026-06-05 `OI-128C` 批注设计全局基线固化：用户确认本问题基本验收通过，后续有问题再按 bug fix 处理。已将当前批注设计固化为全局基线，新增 `global-annotation-requirements-and-regression-matrix.md` 的“基线固化状态”“新页面接入清单”“维护边界”，并同步 `frontend-global-design-baseline-2026-05-30.md`。后续新增页面必须先声明页面对象、值锚点、行锚点、幻灯片 / 子页上下文并跑契约审计，避免每个新页面重新调试批注。
- 2026-06-05 `OI-128C` 后续变更收口：修复定位后高亮落到文字后方、L0-L2 对象批注常态不高亮、普通态高亮线需要加深加粗但不遮挡文字、指南 / 幻灯片页无法添加批注，以及能力映射标准页 ISO / NIST 标准行按需加载后值锚点丢失的问题。标准映射 ViewModel 改为“projection / workbench 为主、已加载 standards 包只补充不覆盖”，避免 `NIST CSF` 加载后覆盖 `AT-6`；`localRelationMap` 同步补入 fallback 标准框架 / 控制项，保证页面 DOM 有稳定值锚点。当前用户库保存批注真实 Chrome 严格回归已从 24 条扩展到 28 条，最终 `28/28 pass`。
- 2026-06-05 `OI-128C` 常态高亮视觉收口：用户截图指出普通高亮仍呈横向黄色长条，影响 Apple shell / Office Word 式批注质感。已把普通态批注从背景铺底改为贴文字的琥珀下划线；行级普通态仅保留左侧标识，不再铺整行黄色；关系 chip 保留原有语义底色，只叠加低噪声下划线 / 边框。定位态仍保留更明显的黄色 + Apple blue 聚焦，方便查找。资源版本更新到 `annotation-global-20260605-5`。
- 2026-06-05 `OI-128C` 视觉防回归脚本升级：`scripts/audit_saved_user_annotations.mjs` 新增 `normalStripeOk`、`normal_visual_stripe_too_wide`，同时识别 text-decoration 式普通批注；后续如果普通态又出现用户截图中的宽背景条，真实 Chrome 回归会直接失败。
- 2026-06-05 `OI-128C` 安全技术服务 / 模块 / 措施高亮五次回归问题根因修复：旧脚本只验证 `data-user-note-anchor-marked / active` 属性，未验证真实视觉样式；技术 chip 语义色规则会覆盖批注样式。已把批注 chip 覆盖层放到语义色规则之后，并补齐 `technical-chip service-chip` specificity。
- 2026-06-05 `OI-128C` 二次人工抽查问题修复完成：安全技术措施 / 模块 / 服务常态与定位高亮、点击页面后常态保留、非首屏定位抽屉滚动保持、抽屉视口完整性均纳入真实 Chrome 严格回归并通过。
- 2026-06-05 新主控接收旧会话交接并同步状态入口：当前线程接管主控；旧慢会话降级为历史产物来源 / 待 fan-in。后续复杂任务采用“轻主控 + 专项 subagent / 专项会话 + fan-in 验收”，主控只负责边界、调度、验收、状态更新和 checkpoint。

## 最近验证

- `node scripts/audit_user_annotation_contract.mjs`：通过，新增检查已覆盖“全局设计基线已固化”“33/33 pass”“新页面接入清单”“页面对象声明”“锚点声明”“视觉接入”“回归准入”等硬条款，结果 `issues=[]`。
- `node scripts/audit_saved_user_annotations.mjs --url http://127.0.0.1:5173 --allow-system-chrome --debug-port 9446 --width 1800 --height 1200 --compact`：提交后真实 Chrome 严格逐条保存批注回归通过，`noteCount=33`、`auditedNoteCount=33`、`passed=33`、`failed=0`、`failures=[]`、`consoleIssues=[]`；覆盖新增指南 / 幻灯片缩略图对象批注、L0-L2 对象 / 行批注、ISO 标准框架值、`AT-6` 标准控制项、技术服务 / 模块 / 措施 chip、常态视觉、定位视觉、值 / 行粒度、点击后常态保留、抽屉滚动保持和误高亮防护。
- `node --check scripts/audit_user_annotation_contract.mjs`：通过。
- `git diff --check -- docs/06-implementation/global-annotation-requirements-and-regression-matrix.md docs/06-implementation/frontend-global-design-baseline-2026-05-30.md scripts/audit_user_annotation_contract.mjs`：通过。
- `node scripts/audit_saved_user_annotations.mjs --url http://127.0.0.1:5173 --allow-system-chrome --debug-port 9433 --width 1800 --height 1200 --compact`：真实 Chrome 严格逐条保存批注回归通过，`noteCount=28`、`auditedNoteCount=28`、`passed=28`、`failed=0`、`failures=[]`、`consoleIssues=[]`；覆盖 L0-L2 对象 / 行批注、ISO 标准框架值、`AT-6` 标准控制项、技术服务 / 模块 / 措施 chip、幻灯片页、常态视觉、定位视觉、值 / 行粒度、点击后常态保留、抽屉滚动保持和误高亮防护。
- `node scripts/audit_saved_user_annotations.mjs --url http://127.0.0.1:5173 --allow-system-chrome --debug-port 9432 --width 1800 --height 1200 --compact --from-ordinal 15 --to-ordinal 23 --debug-state`：通过，确认 `NIST CSF 2.0` 标准包加载后不会覆盖后端 projection 中的 `AT-6` 锚点。
- `node --check scripts/audit_saved_user_annotations.mjs`：通过。
- `node --check frontend/capability-browser/app.js`：通过。
- `node --check frontend/capability-browser/viewModels.js`：通过。
- `node --check frontend/capability-browser/components/CapabilityLocalRelationMap.js`：通过。
- `node --check scripts/audit_user_annotation_contract.mjs`：通过。
- `git diff --check -- frontend/capability-browser/app.js frontend/capability-browser/viewModels.js frontend/capability-browser/components/CapabilityLocalRelationMap.js frontend/capability-browser/styles.css frontend/capability-browser/index.html scripts/audit_saved_user_annotations.mjs scripts/audit_user_annotation_contract.mjs`：通过。
- `python3 scripts/dev_server_guard.py --status`：通过，固定 `5173` 只有一个项目服务进程，home / workspace projection 均为 `200`。
- `node scripts/audit_user_annotation_contract.mjs`：通过，确认全局锚点契约、共享关系 chip 值锚点、LC-AP / LC-DT 值锚点、折叠分组定位契约、视觉范围基线和全局批注需求矩阵均合格。

## 当前问题索引

- `OI-038`：Gartner 与安全职能候选映射需后续人工校对，状态 `待确认`。
- `OI-128`：USER-WRITE-UI-1：批注 / 工作台用户写入入口，状态 `部分完成`；`OI-128A/B/C` 已实现，`OI-128C` 已基本验收，当前进入 checkpoint 确认。
- `OI-133`：ArchiMate 建模语言页显示效果与加载效率优化，状态 `待设计`。
- `OI-135`：用户库治理与兼容表迁移清理，状态 `待设计`。

## 历史索引

| 归档文件 | 内容 |
|---|---|
| `docs/05-archive/progress-history/2026-06.md` | 2026-06 完整执行记录、Open Issues 治理、前端治理、数据口径确认和本轮 progress 瘦身摘要 |
| `docs/05-archive/progress-history/2026-05.md` | 2026-05 完整执行记录、根目录 `progress.md` 瘦身快照和结构治理记录 |
| `docs/05-archive/findings-history/2026-05.md` | 2026-05 历史发现 |
| `docs/05-archive/open-issues-history/2026-06.md` | 已关闭 Open Issues 长记录 |
| `docs/05-archive/context-slimming-2026-05-15/` | 2026-05-15 上下文瘦身快照 |

## 维护规则

- 本文件只保留最近状态、最近 5-10 条重要执行和恢复入口；超过 120 行时继续归档到 `docs/05-archive/progress-history/`。
- 详细过程、长命令输出和阶段性历史不写入根目录 `progress.md`。
