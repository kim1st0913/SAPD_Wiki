# 安全能力映射页变更控制

## 目标

安全能力映射页当前是项目中最容易反复回退的页面。治理目标不是马上大拆页面，而是先把修改边界、验证门槛和暂停条件固定下来，避免继续用局部补丁处理结构问题。

## 当前阻塞入口

- 工程 review：`docs/06-implementation/project-blocker-review-2026-05-30.md`
- 统一问题项：`docs/06-implementation/open-issues.md` 中 `OI-122`
- 审计脚本：`node scripts/audit_frontend_governance.mjs`
- 对象一致性审计：`node scripts/audit_capability_viewmodel_contract.mjs --url http://127.0.0.1:5173`
- 基线配置：`config/frontend-governance-baseline.json`

## 修改分级

| 级别 | 修改类型 | 是否允许直接做 | 必须验证 |
|---|---|---:|---|
| G0 | 文案、说明、问题记录、非行为文档 | 允许 | `git diff --check` |
| G1 | 单个组件内的纯展示小修，例如局部间距、局部 class 名修正 | 谨慎允许 | `node --check` 目标文件、`frontend_smoke_check.mjs --page capability` |
| G2 | `app.js` 选择 / 加载流程、`viewModels.js` 数据来源、`CapabilityLocalRelationMap.js` 三视角矩阵、`LocalRelationNetworkGraph.js` 图谱布局 | 需要先写明改动目标 | projection audit、ViewModel 对象一致性审计、capability smoke、前端治理审计 |
| G3 | `styles.css` 跨页面覆盖、图谱布局策略、数据契约变更、后端 projection 语义变更 | 不建议和其它任务混做 | 单独任务、单独验证、必要时截图或浏览器回归 |

## 暂停条件

出现以下任一情况，应先停下来记录问题，不继续叠补丁：

- 为修安全能力映射页，需要改 `styles.css` 中多个跨页面选择器。
- 一次修改同时触及 `app.js`、`viewModels.js`、`styles.css` 和图谱组件。
- 轻量 smoke 通过，但用户截图显示图谱中心、tab、列宽或 chip 颜色不一致。
- 需要解释“为什么这次不会误伤 LC-AP / 环境映射 / 安全知识维护”，但代码边界说不清。
- `node scripts/audit_frontend_governance.mjs` 失败。

## 后续治理顺序

1. 先让安全能力映射页有唯一对象级页面契约，避免完整 workbench、projection 和 fallback 三套来源混用。
2. 再拆 `renderCapabilities()`，把选择、加载、ViewModel、渲染分离。
3. 然后统一三视角矩阵 shell，删除或标记 legacy renderer。
4. 再拆 CSS token / table / chip / capability-map 边界。
5. 最后单独治理图谱布局，并建立截图或 DOM / SVG 验收基线。

## 审计脚本口径

`audit_frontend_governance.mjs` 不是审美评分工具。它只做一件事：防止已经过大的高风险文件继续无意识膨胀。

当前基线是项目现状上限，不是理想目标。后续如果确实需要提高上限，必须同时说明：

- 为什么不能通过拆分或删除旧代码解决；
- 是否影响 `OI-122`；
- 是否已经补充对应验证。
