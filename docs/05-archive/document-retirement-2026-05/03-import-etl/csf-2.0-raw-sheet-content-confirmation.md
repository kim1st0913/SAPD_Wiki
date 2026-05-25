# NIST CSF 2.0 与原始表 `CSF2.0` 内容确认结果

生成日期：2026-05-18

## 1. 输入文件

| 类型 | 文件 / 工作表 |
|---|---|
| 标准 PDF | `/Users/kim1st/Documents/work@qax/01.战略咨询规划部/技术架构组/安全规划方法论设计研究/架构参考材料/网络安全框架材料/CSF/V2.0/NIST.CSWP.29.The NIST Cybersecurity Framework (CSF) 2.0.pdf` |
| 项目原始数据表 | `data/raw-samples/wiki sample.xlsx` / `CSF2.0` |

## 2. 总体结论

- 原始表 `CSF2.0` 中实际有两张表。
- 第一张表是 CSF Core 表，范围为 `B2:E108`，数据行为 `B3:E108`，共 106 条 Subcategory。
- 第二张表是 CSF Tiers 表，范围为 `B111:D115`，数据行为 `B112:D115`，共 4 条 Tier。
- 第一张表的 106 个 Subcategory 编号与 NIST CSF 2.0 PDF 附录 A 抽取出的 106 个编号完全一致。
- 第二张表的 4 个 Tier 与 NIST CSF 2.0 PDF 附录 B 的 Tier 1 到 Tier 4 对应。
- 当前未发现 `CSF2.0` sheet 需要补行、删行或调整编号的问题。

## 3. 第一张表：CSF Core

表头位于第 2 行：

| Excel 列 | 表头 | 说明 |
|---|---|---|
| B | `功能` | Function，例如 `治理 GOVERN (GV)` |
| C | `分类` | Category，例如 `组织背景（Organizational Context）` |
| D | `分类标识符` | Category Identifier，例如 `GV.OC` |
| E | `分类标识符说明` | Subcategory Identifier + 说明，例如 `GV.OC-01: ...` |

数量核对：

| 项目 | 数量 |
|---|---:|
| Function | 6 |
| Category | 22 |
| Subcategory | 106 |
| Subcategory 编号重复 | 0 |
| PDF 有但原始表缺失 | 0 |
| 原始表有但 PDF 未匹配 | 0 |

按 Function 统计：

| Function | 原始表条数 |
|---|---:|
| `GV` | 31 |
| `ID` | 21 |
| `PR` | 22 |
| `DE` | 11 |
| `RS` | 13 |
| `RC` | 8 |
| 合计 | 106 |

原始表中的 22 个 Category：

| Category Identifier | 起始行 | Category |
|---|---:|---|
| `GV.OC` | 3 | `组织背景（Organizational Context）` |
| `GV.RM` | 8 | `风险管理战略（Risk Management Strategy）` |
| `GV.PO` | 15 | `策略（Policy）` |
| `GV.RR` | 17 | `角色、责任和权限（Roles, Responsibilities, and Authorities）` |
| `GV.OV` | 21 | `监督（Oversight）` |
| `GV.SC` | 24 | `网络安全供应链风险管理（Cybersecurity Supply Chain Risk Management）` |
| `ID.AM` | 34 | `资产管理（Asset Management）` |
| `ID.RA` | 41 | `风险评估（Risk Assessment）` |
| `ID.IM` | 51 | `改进（Improvement）` |
| `PR.AA` | 55 | `身份管理、认证和访问控制（Identity Management, Authentication, and Access Control）` |
| `PR.AT` | 61 | `意识和培训（Awareness and Training）` |
| `PR.DS` | 63 | `数据安全（Data Security）` |
| `PR.PS` | 67 | `平台安全（Platform Security）` |
| `PR.IR` | 73 | `技术基础设施韧性（Technology Infrastructure Resilience）` |
| `DE.CM` | 77 | `持续监控（Continuous Monitoring）` |
| `DE.AE` | 82 | `不良事件分析（Adverse Event Analysis）` |
| `RS.MA` | 88 | `事件管理（Incident Management）` |
| `RS.AN` | 93 | `事件分析（Incident Analysis）` |
| `RS.CO` | 97 | `事件响应报告和沟通（Incident Response Reporting and Communication）` |
| `RS.MI` | 99 | `事件缓解（Incident Mitigation）` |
| `RC.RP` | 101 | `执行事件恢复计划（Incident Recovery Plan Execution）` |
| `RC.CO` | 107 | `事件恢复沟通（Incident Recovery Communication）` |

说明：`B:D` 列存在类似合并单元格的稀疏填写方式，后续行空白代表沿用上一条 Function / Category / Category Identifier，不应判定为缺失。

## 4. 第二张表：CSF Tiers

表头位于第 111 行：

| Excel 列 | 表头 | 对应 PDF 附录 B |
|---|---|---|
| B | `层级` | `Tier` |
| C | `网络安全风险治理(Cybersecurity Risk Governance,GV)` | `Cybersecurity Risk Governance` |
| D | `网络安全风险管理(Cybersecurity Risk Management,IPDRR)` | `Cybersecurity Risk Management` |

数据行：

| Excel 行 | 层级 |
|---:|---|
| 112 | `第一层：部分的` |
| 113 | `第二层：风险告知` |
| 114 | `第三层：可重复` |
| 115 | `第四层：自适应` |

与 PDF 附录 B 对应关系：

| 原始表层级 | PDF Tier |
|---|---|
| `第一层：部分的` | `Tier 1: Partial` |
| `第二层：风险告知` | `Tier 2: Risk Informed` |
| `第三层：可重复` | `Tier 3: Repeatable` |
| `第四层：自适应` | `Tier 4: Adaptive` |

## 5. 空白区域和非表格列

- 第 1 行为空白或标题预留区。
- 第 109 到 110 行为空白分隔行，用于分隔两张表。
- 第 116 行为空白。
- A 列、F:H 列在本 sheet 中未承载本轮识别到的业务表字段。

## 6. 后续入库建议

- 若后续要入库，建议把第一张表建模为 `standard_framework_control` 类控制项数据，字段至少包含：`功能`、`分类`、`分类标识符`、`分类标识符说明`，并从 `分类标识符说明` 中解析出 Subcategory 编号。
- 第二张表不建议混入第一张表的控制项清单，应作为 CSF 框架的分层说明或 maturity / tier reference 独立投影。
- 入库前需要确认中文翻译是否作为主展示文本；如果需要保留英文原文，应从 PDF 或官方可机读数据源补充英文原文列。
