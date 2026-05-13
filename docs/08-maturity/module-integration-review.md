# 成熟度分析模块接入 Review

本文档用于评估成熟度分析模块如何以最小扰动方式接入 SAPD Wiki 主工程。结论基于当前工程文件、`docs/08-maturity/` 已有 M0 文档、`config/maturity/` 配置占位，以及外部 review 建议。

本次 review 只做架构与文件结构判断，不实现代码，不修改数据库 schema，不改前端页面。

## 1. 总体结论

成熟度分析模块需要做接入 review，但不需要做全工程文件结构重构。

推荐路线：

```text
保留现有 SAPD Wiki 文档结构
+ 使用 docs/08-maturity/ 作为 maturity 模块唯一文档目录
+ 使用 config/maturity/ 存放规则与模板配置
+ 后续使用 maturity_* 专用表保存评估运行数据
+ 不把客户评估数据写入 knowledge_items
```

不推荐路线：

```text
新增 docs/08-maturity-assessment/ 与 docs/08-maturity/ 并存
把 task_plan.md / findings.md / progress.md 合并成大文档
现在重排 docs 全目录
现在新增完整治理六件套
现在改数据库 schema 或前端页面
```

## 2. 是否需要文件结构优化

需要轻量结构校准，不需要整体重构。

| 建议 | 建议类型 | 影响范围 | 风险等级 | 结论 |
|---|---|---|---|---|
| 保留现有 `docs/08-maturity/` | 保留 | 文档 | 低 | 已满足模块独立目录要求 |
| 不新增 `docs/08-maturity-assessment/` | 延后 | 文档 | 中 | 避免 maturity 文档入口重复 |
| 新增本文件作为接入 review | 新增 | 文档 / 架构 | 低 | 用一个索引型 review 文件承接外部建议 |
| 不合并 `task_plan.md`、`findings.md`、`progress.md` | 保留 | 项目治理 | 中 | 三者职责不同，合并会降低可维护性 |
| 不归档当前主线文档 | 保留 | 文档 | 低 | 当前仍在使用，不应提前归档 |
| 后续只归档过期计划或关闭问题 | 延后 | 文档 | 低 | 使用 `docs/05-archive/` 即可 |

## 3. 是否建议文件合并

不建议。

当前关键文件职责清晰：

| 文件 | 当前职责 | 处理建议 |
|---|---|---|
| `task_plan.md` | 阶段计划和任务状态 | 保留 |
| `findings.md` | 当前关键决策、重要风险和历史索引 | 保留 |
| `progress.md` | 执行日志和验证结果 | 保留 |
| `docs/01-architecture/architecture.md` | 主工程轻量架构 | 保留并补 maturity 接入位置 |
| `docs/02-data-model/data-model.md` | 主知识库数据模型 | 保留，不写入 maturity 运行数据 |
| `docs/03-import-etl/import-rules.md` | 主知识库导入规则 | 保留，maturity 输入另行定义 |
| `docs/07-governance/data-governance.md` | 数据治理规则 | 保留并补 maturity 敏感数据和人工覆盖规则 |
| `docs/08-maturity/*.md` | maturity 模块需求、模型、规则、模板和计划 | 保留 |

## 4. 推荐目录

当前推荐目录如下：

```text
docs/08-maturity/
├── module-integration-review.md
├── requirements.md
├── data-model.md
├── scoring-rules.md
├── template-design.md
└── implementation-plan.md

config/maturity/
├── maturity-levels.yaml
├── aspect-weights-v1.yaml
├── scoring-rules-v1.yaml
├── matching-keywords-v1.yaml
├── template-schema-v1.yaml
└── report-template-v1.yaml
```

不建议新增：

```text
docs/08-maturity-assessment/
```

原因：

- `docs/08-maturity/` 已经存在并且覆盖需求、模型、规则、模板和计划；
- 新增相近目录会让后续 Agent 不知道以哪个目录为准；
- 当前更需要“接入边界清晰”，不是“目录更多”。

## 5. 推荐更新的现有文件

| 文件 | 建议类型 | 影响范围 | 风险等级 | 建议 |
|---|---|---|---|---|
| `docs/01-architecture/architecture.md` | 修改 | 架构 | 低 | 增加成熟度分析模块在系统分层中的位置 |
| `docs/07-governance/data-governance.md` | 修改 | 治理 | 中 | 增加客户评估输入、评分规则版本、人工覆盖、敏感数据规则 |
| `.gitignore` | 修改 | 数据安全 | 高 | 明确忽略 `data/maturity/` |
| `README.md` | 保留 | 文档 | 低 | 当前已经有 maturity 文档入口和命令占位，暂不重复扩写 |
| `task_plan.md` | 保留 | 计划 | 低 | 当前已有 M0-M5 maturity 计划，暂不新增阶段 |
| `project-roadmap.md` | 保留 | 计划 | 低 | 当前主路线仍以 Sheet 复核为主，maturity 不抢主线 |

## 6. 成熟度模块定位

成熟度分析模块是 SAPD Wiki 主工程下的独立业务模块，不是完全独立系统，也不是主知识库对象的一部分。

定位：

```text
SAPD Wiki 主知识库
  维护安全能力、关注点、作用域、服务、模块、流程、职能等知识资产

maturity 模块
  读取主知识库能力资产
  导入客户现状评估模板
  匹配能力关注点
  生成评分、图表数据和离线报告
  不污染主知识库主数据
```

模块关系：

| 问题 | 结论 |
|---|---|
| 是主工程子模块还是独立系统 | 主工程子模块 |
| 是否复用现有能力对象 | 是，只读复用 |
| 是否写入 `knowledge_items` | 否 |
| 是否需要 source traceability | 是 |
| 是否需要 staging / review | 是，但建议使用 maturity 专用导入与审查流程 |
| 是否写入 SQLite | M1 以后写入 `maturity_*` 专用表 |
| 是否需要前端页面 | 需要，但放到 M5，不是当前 P0 |

## 7. 复用对象与新增对象

### 7.1 复用现有对象

maturity 模块应优先只读复用：

- `capability_category`
- `capability_domain`
- `capability`
- `capability_focus`
- `scope_type`
- `security_technical_service`
- `security_technology_module`
- `security_technical_measure`
- `security_process`
- `work_function`
- `gbt_42446_reference`
- `gartner_role`

复用方式：

- 用现有能力树生成 `Reference_Capabilities`；
- 用现有关系做匹配扩展；
- 用流程、职能、服务、模块辅助解释成熟度短板；
- 不修改现有知识主数据。

### 7.2 新增对象能力

建议新增以下 `maturity_*` 专用表或等价能力，不进入通用 `knowledge_item + type + metadata_json`：

| 对象 / 能力 | 建议存储 | 原因 |
|---|---|---|
| `maturity_model` | 配置文件或专用表 | 评分模型会版本化，不是知识条目 |
| `maturity_dimension` | 配置文件或专用表 | 维度是评分结构，不是来源知识 |
| `maturity_level` | `config/maturity/maturity-levels.yaml`，后续可入库 | 当前配置化足够 |
| `assessment_template` | 配置 + 生成记录 | 模板版本需要追踪 |
| `assessment_input` | `maturity_input_rows` | 客户敏感运行数据 |
| `assessment_result` | `maturity_assessments` / `maturity_reports` | 评估运行结果 |
| `assessment_score` | `maturity_capability_scores` / `maturity_dimension_scores` | 评分结果需要查询和版本化 |
| `assessment_evidence` | `maturity_evidence_items` | 证据与客户材料敏感 |
| `assessment_recommendation` | `maturity_reports` 或后续专表 | 建议依赖规则版本和评分上下文 |
| `capability_maturity_mapping` | `maturity_match_candidates` 或规则配置 | 是评估匹配结果，不是主知识关系 |

## 8. 关系类型接入建议

以下关系不建议直接写入主表 `knowledge_relations`，应写入 `maturity_*` 专用表，避免把客户评估运行过程污染为长期知识关系。

| 关系能力 | 建议落点 | 说明 |
|---|---|---|
| `assesses_capability` | `maturity_capability_scores` | 表示某次评估覆盖某能力关注点 |
| `matches_focus` | `maturity_match_candidates` | 表示输入行匹配候选 |
| `uses_evidence` | `maturity_evidence_items` 或关联表 | 表示评分使用了哪些证据 |
| `generates_recommendation` | `maturity_reports` 或后续建议表 | 表示评分生成建议 |
| `maps_to_maturity_level` | `maturity_capability_scores` | 表示能力评分等级 |

原则：

- 主知识库关系描述“知识之间的稳定关系”；
- maturity 关系描述“某次客户评估中的运行关系”；
- 运行关系应可删除、归档、版本化，不应污染主知识图谱。

## 9. ETL / 输入模板建议

成熟度输入应视为新的导入类型：

```text
客户现状评估模板导入
```

第一版建议只支持 Excel 模板作为主输入。

| 问题 | 建议 |
|---|---|
| 输入模板用 Excel、Markdown、DOCX 还是表单 | V1 使用 Excel；DOCX / PPTX 先作为证据或报告风格参考 |
| 第一版是否只支持 Excel | 是 |
| 是否进入 staging / review | 是，至少进入 maturity 专用暂存和匹配审查 |
| 自动匹配是否需要人工确认 | 低置信度必须人工确认 |
| 评估结果是否进入正式库 | 进入 `maturity_*` 运行表，不进入 `knowledge_items` |
| 是否保留每次评估版本 | 必须保留 |

建议输入字段沿用 `docs/08-maturity/template-design.md`：

- `Assessment_Info`
- `Current_State_Input`
- `Evidence_List`
- `Manual_Adjustment`
- `Reference_Capabilities`
- `Readme`

客户现状文本映射到安全能力的优先级：

```text
能力编码精确匹配
>
标题 / 别名匹配
>
现有知识关系扩展匹配
>
关键词匹配
>
本地模糊匹配
>
人工审查
```

## 10. 前端页面建议

成熟度分析需要独立页面，但不应现在开发。

| 阶段 | 前端建议 |
|---|---|
| P0 | 不改前端，只补架构和治理文档 |
| P1 | 设计页面信息架构，但不编码 |
| P2 | M4 生成稳定 `maturity-result.json` 后，再接入只读结果页 |
| P3 | 增加上传、匹配审查、历史对比和报告管理 |

未来页面建议：

- 成熟度评估列表；
- 模板生成 / 导入状态；
- 匹配审查；
- 评估结果总览；
- 能力明细；
- 证据覆盖；
- 报告导出。

前端必须遵守：

- 不在前端实现匹配；
- 不在前端实现评分；
- 不从客户原始文本推断能力关系；
- 只消费后端或静态导出的评估结果和图表数据。

## 11. 导出与报告建议

V1 报告输出建议：

| 输出 | V1 建议 | 说明 |
|---|---|---|
| JSON | 必做 | 给前端或后续流程消费 |
| Markdown | 必做 | 便于审阅和版本比较 |
| HTML | 必做 | 本地离线打开 |
| Excel | 可选 | 用于明细和审查表 |
| PDF | 延后 | 可由 HTML 或 DOCX 后续转换 |
| DOCX | 延后 | 适合正式交付报告，但不作为 MVP 起点 |
| PPTX | 延后 | V2 再考虑 |

图表数据建议输出到：

```text
data/maturity/reports/<assessment_id>/charts-data.json
```

前端数据 JSON 建议独立于现有 capability browser 数据：

```text
data/maturity/reports/<assessment_id>/maturity-result.json
```

后续如需要进入静态前端，可再导出到：

```text
frontend/capability-browser/public/data/maturity/<assessment_id>/
```

该目录应默认忽略真实客户数据，只允许提交脱敏示例。

## 12. 治理与安全建议

maturity 模块涉及客户现状、证据、评分和建议，敏感级别高于当前普通知识主数据。

治理规则：

| 规则 | 建议 |
|---|---|
| 客户输入是否提交 GitHub | 默认不提交 |
| 报告是否提交 GitHub | 默认不提交 |
| 自动匹配与人工修正冲突 | 人工审查结果优先 |
| 成熟度等级版本化 | 使用 `maturity-levels.yaml` 的 `version`，入库时记录 |
| 评分规则版本化 | 使用 `scoring-rules-v1.yaml` 的 `version`，入库时记录 |
| 模板版本化 | 使用 `template-schema-v1.yaml` 的 `version`，导入时强校验 |
| 知识库快照 | 每次评估记录知识库导出批次或 snapshot id |
| 来源追踪 | 保留模板文件、Sheet、行号、字段、证据摘要 |
| 低置信度匹配 | 不直接评分，必须进入审查 |
| 人工覆盖评分 | 必须记录覆盖原因、审查人和时间 |

`.gitignore` 应明确忽略：

```text
data/maturity/
```

## 13. 分阶段执行计划

| 阶段 | 建议 | 建议类型 | 影响范围 | 风险等级 |
|---|---|---|---|---|
| P0 | 新增本接入 review 文件 | 新增 | 文档 / 架构 | 低 |
| P0 | 在 `architecture.md` 补 maturity 模块边界 | 修改 | 架构 | 低 |
| P0 | 在 `data-governance.md` 补 maturity 数据治理规则 | 修改 | 治理 | 中 |
| P0 | 在 `.gitignore` 补 `data/maturity/` | 修改 | 数据安全 | 高 |
| P0 | 不改 schema、不改前端、不改 ETL | 保留 | 全局 | 低 |
| P1 | 用户确认 PRD 和模板字段 | 修改 | 文档 / 数据模型 | 中 |
| P1 | 细化 `maturity_*` 迁移设计 | 修改 | 数据模型 | 中 |
| P1 | 明确匹配审查表格式 | 修改 | ETL / 治理 | 中 |
| P2 | 实现模板生成 CLI | 新增 | ETL / 导出 | 中 |
| P2 | 实现模板导入与 maturity staging | 新增 | ETL / 数据库 | 中 |
| P2 | 实现匹配、评分和报告导出 | 新增 | 后端 / 导出 | 高 |
| P3 | 接入成熟度前端页面 | 新增 | 前端 | 中 |
| P3 | 增加 DOCX / PPTX 报告 | 新增 | 导出 | 中 |
| P3 | 增加历史评估对比 | 新增 | 前端 / 数据模型 | 中 |

## 14. 不建议现在做的事项

| 事项 | 原因 |
|---|---|
| 新增 `docs/08-maturity-assessment/` | 与现有 `docs/08-maturity/` 重复 |
| 合并计划、发现、进度文件 | 会破坏当前治理分工 |
| 重排 `docs/` 全目录 | 当前主线仍在 Sheet 业务复核，重排会增加认知负担 |
| 新增完整治理六件套 | 当前治理成本会超过收益 |
| 修改 SQLite schema | M0 只做接入 review，schema 留到 M1 |
| 改前端 | 没有稳定评估结果数据前，页面会返工 |
| 实现自动评分 | 规则和模板还需样例验证 |
| 提交客户评估输入输出 | 涉及敏感数据，必须默认本地保存 |

## 15. 需要用户确认的问题

进入 M1 前，需要用户确认：

1. 成熟度等级是否正式采用 L0-L5。
2. V1 是否确认只做 Excel 模板作为主输入。
3. Word / PPTX 是否仅作为证据和报告风格参考，不作为自动评分必需输入。
4. 是否接受 V1 先 CLI + HTML/Markdown/JSON 报告，不做完整前端。
5. 低置信度匹配是否必须人工审查后才能评分。
6. 客户输入、证据和报告是否一律默认保存在 `data/maturity/`。
7. 是否需要脱敏示例数据用于 GitHub。
8. 成熟度报告第一版是否需要给客户正式交付，还是先作为内部分析报告。

## 16. 本次 review 结论

本次 review 建议：

```text
做轻量接入
不做全局重构
沿用 docs/08-maturity/
补架构入口和治理规则
明确客户数据不进 GitHub
等 PRD 和样例确认后再进入 M1
```

成熟度模块可以作为 SAPD Wiki 的重要后续能力，但不应打断当前主线：

```text
已导入 Sheet 的业务含义复核
+
前端关系展示校正
```
