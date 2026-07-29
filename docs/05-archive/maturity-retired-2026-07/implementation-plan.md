# 成熟度分析模块实施计划

> 归档状态：早期实施计划，里程碑已完成或被后续实现与现行合同取代。

本文档定义 maturity 模块的分阶段实施计划。当前 M0 只落地规划文档和配置，不实现业务代码。

## 1. 总体路线

```text
M0 文档与配置规划
→ M1 数据库与模板生成 MVP
→ M2 模板导入与暂存
→ M3 匹配引擎与审查表
→ M4 评分与离线报告
→ M5 前端页面接入
```

## 2. M0：需求固化与配置占位

状态：本轮执行。

目标：

- 固化 maturity 模块边界；
- 明确不写入 `knowledge_items`；
- 输出需求、数据模型、评分规则和模板设计；
- 新增基础 YAML 配置；
- 同步 `task_plan.md`、`README.md`、`progress.md`。

产物：

- `docs/08-maturity/requirements.md`
- `docs/08-maturity/data-model.md`
- `docs/08-maturity/scoring-rules.md`
- `docs/08-maturity/template-design.md`
- `docs/08-maturity/implementation-plan.md`
- `config/maturity/*.yaml`

不做：

- 不新增迁移；
- 不新增 Python maturity 模块；
- 不改前端；
- 不实现评分、图表或报告生成代码。

## 3. M1：数据库与模板生成 MVP

目标：能从当前能力库生成 Excel 评估模板。

任务：

1. 新增 `maturity_*` 表迁移，不修改 `knowledge_items`；
2. 新增独立 `maturity` Python 包；
3. 实现 `maturity-template` CLI；
4. 生成 `Reference_Capabilities` Sheet；
5. 输出 `data/maturity/templates/customer-maturity-template-v1.xlsx`；
6. 使用一个 XLSX 样例验证模板字段齐全。

验收：

- 断网可生成模板；
- 模板包含当前能力树引用；
- 模板版本、规则版本、知识库快照可追踪。

## 4. M2：模板导入与暂存

目标：能读取员工填写模板，并保存客户现状输入。

任务：

1. 解析 `Assessment_Info`；
2. 解析 `Current_State_Input`；
3. 解析可选 `Evidence_List`；
4. 记录来源文件和导入任务；
5. 写入 `maturity_assessments`、`maturity_input_rows`、`maturity_evidence_items`；
6. 输出导入校验报告。

验收：

- 可导入 50-200 行现状输入；
- 缺少必要 Sheet 或模板版本不支持时给出错误；
- 客户敏感输入不进入 Git。

## 5. M3：匹配引擎与审查表

目标：把客户现状匹配到能力关注点，并保留可解释审查。

任务：

1. 实现能力编码精确匹配；
2. 实现标题 / 别名匹配；
3. 基于 `knowledge_relations` 做服务、模块、流程、职能到能力的关系扩展匹配；
4. 基于 `matching-keywords-v1.yaml` 做关键词匹配；
5. 写入 `maturity_match_candidates`；
6. 导出低置信度匹配审查表；
7. 支持重新导入审查表。

验收：

- 明确编码匹配置信度为 100；
- 低置信度项不直接评分；
- 每条候选有匹配方法、命中文本和解释。

## 6. M4：评分与报告

目标：生成成熟度结果和离线报告。

任务：

1. 加载 `maturity-levels.yaml`、`aspect-weights-v1.yaml`、`scoring-rules-v1.yaml`；
2. 按能力关注点评分；
3. 聚合到 L2、L1、分类和整体；
4. 写入 `maturity_capability_scores` 和 `maturity_dimension_scores`；
5. 生成 `charts-data.json`；
6. 生成 Markdown 和 HTML 报告；
7. 记录 `maturity_reports`。

验收：

- 每个分数可解释；
- 人工覆盖有原因记录；
- 报告可离线打开。

## 7. M5：前端页面接入

目标：把 maturity 结果作为独立页面接入 SAPD Wiki 本地工作台。

任务：

1. 新增成熟度评估导航入口；
2. 新增评估列表页；
3. 新增上传 / 导入状态页；
4. 新增结果总览页；
5. 新增能力明细页；
6. 后续新增匹配审查页。

前端约束：

- 前端只消费后端导出的评估结果和图表数据；
- 不在前端实现业务匹配、评分和关系推断；
- 图表依赖必须离线可用，不依赖 CDN。

## 8. 与当前主线的关系

maturity 是旁路模块，不改变当前 Phase 4/5 的导入、关系展示和业务语义复核主线。进入 M1 前，应先确认当前主线是否允许新增迁移和 CLI 子命令；如主线仍在密集复核，maturity 开发应保持 feature 分支或独立提交。
