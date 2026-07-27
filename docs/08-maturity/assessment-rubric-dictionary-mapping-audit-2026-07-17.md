---
title: SAPD 成熟度评分依据与当前能力字典映射审计
version: V2.1-dictionary-mapping-audit-1
date: 2026-07-17
status: blocked
module: 工作台 / 成熟度评估
authority: current-engineering-dictionary
---

# SAPD 成熟度评分依据与当前能力字典映射审计

## 1. 结论

映射门禁当前为 **`BLOCKED`**。工程字典自身完整性检查通过，但评分依据覆盖没有全量通过：当前 91 个关注点中，76 个关注点的编码、父 L2 和名称均对齐，8 个虽编码和父 L2 一致但名称语义需要复核，7 个在源表中不存在。对应 185 个当前评估点中，147 个已映射、28 个待身份复核、10 个没有来源绑定。

在这 7 个关注点完成 rubric set 绑定前，暂停输出和确认缺级、遗漏、业务不可评分等问题分类。源 Excel 中已经看到的空白和四维缺项只保留为初步库存，不进入业务确认。

## 2. 权威来源与映射规则

### 2.1 工程当前字典是主表

| 用途 | 权威文件 / 运行路径 | SHA-256 / 快照 |
|---|---|---|
| L0—L2、关注点和字典统计 | `frontend/capability-browser/public/data/capability-tree.json` | `e6cd5ca4ea7725d38300464e1826816bcd7cd30c030de0db2c0bc879b3cf0adc` |
| 当前对象、关系和 maturity 运行输入 | `frontend/capability-browser/public/data/capability-workbench.json` | `2a3cc84192b926d5fceb35d9bf3ac1e7e170e2e400cb253c207ab475bd482b03` |
| maturity 当前基础模板 | `build_maturity_base_template(capability-workbench)` | `maturity-template-074553b73aec4505` |
| 评分依据来源 | `data/raw-samples/assesment samples.xlsx` | `9fa80061f7281814e96d70215b16460f5b8b0f0221de330c27bfbb80a0167f62` |

层级、关注点名称、安全技术服务、作用域、评分粒度和服务角色全部取工程当前字典；源 Excel 只提供 rubric 内容、源关注点编码和合并区域证据。源 Excel 的能力 / 服务名称与服务清单不得覆盖工程字典。

### 2.2 稳定映射键

```text
current L0 → current L1 → current L2 → current focus_code
                                              │
                                              └─ exact focus_code → rubric_set
                                                     ├─ SERVICE 评估点继承
                                                     └─ FOCUS 评估点直接使用
```

- 第一匹配键固定为当前 `focus_code`；必须唯一且父 L2 能力编码一致。
- 技术服务编码不作为 rubric 的第一匹配键。当前字典中的服务关系通过所属关注点继承 rubric set。
- 源服务列表只用于漂移审计；即使源服务与当前服务不同，也不得删改当前服务或把源服务复制进模板。
- 当前关注点在源表不存在时，候选兄弟组只能供业务判断，不得自动继承。

## 3. 门禁检查

| 检查项 | 结果 | 状态 |
|---|---:|---|
| maturity 当前模板校验错误 / 警告 | 0 / 0 | 通过 |
| 当前 L0 / L1 / L2 / 关注点 | 3 / 10 / 32 / 91 | 通过 |
| 当前服务对象 / 服务关系 | 160 / 160 | 通过 |
| 当前 SERVICE / FOCUS 评估点 | 154 / 31 | 通过 |
| 当前能力 / 关注点 / 服务编码重复 | 0 / 0 / 0 | 通过 |
| 源关注点在当前字典中找不到 | 0 | 通过 |
| 已匹配关注点父 L2 不一致 | 0 | 通过 |
| 关注点编码 / 父级一致但名称待复核 | 8 | 阻断 |
| 当前关注点没有源 rubric set | 7 | 阻断 |
| 当前服务关系：已映射 / 待复核 / 无来源 | 125 / 27 / 8 | 阻断 |
| 当前评估点：已映射 / 待复核 / 无来源 | 147 / 28 / 10 | 阻断 |

## 4. 阻断项：当前字典存在、源评分依据不存在

以下对象必须先完成“绑定既有 rubric set”或“新建 rubric set”的业务决定。候选组不代表已映射。

| L0 | L1 | L2 能力 | 当前关注点 | 当前评分粒度 | 当前服务关系 | 当前评估点 | 候选 rubric set | 状态 |
|---|---|---|---|---|---:|---:|---|---|
| `T` | `T-AS` | `T-AS.AM` 信息化资产安全管理能力 | `T-AS.AM-02` 实现主机、终端等信息化资产的安全管理 | SERVICE | 3 | 3 | `ARS-002` | `BLOCKED_NO_SOURCE_FOCUS` |
| `T` | `T-AS` | `T-AS.DS` 开发安全管控能力 | `T-AS.DS-06` 持续管理可复用的开发安全资源 | SERVICE | 1 | 1 | `ARS-006` | `BLOCKED_NO_SOURCE_FOCUS` |
| `T` | `T-AS` | `T-AS.DG` 数据安全管理和治理能力 | `T-AS.DG-03` 确保数据的可靠性与可恢复性 | SERVICE | 1 | 1 | `ARS-009` | `BLOCKED_NO_SOURCE_FOCUS` |
| `T` | `T-PD` | `T-PD.TP` 威胁检测与防护能力 | `T-PD.TP-05` 对仅允许预定义的程序或行为进行控制 | SERVICE | 2 | 2 | `ARS-012` | `BLOCKED_NO_SOURCE_FOCUS` |
| `T` | `T-AD` | `T-AD.SV` 安全架构评估能力 | `T-AD.SV-03` 开展攻防演练和沙盘推演 | SERVICE | 1 | 1 | `ARS-016` | `BLOCKED_NO_SOURCE_FOCUS` |
| `M` | `M-PS` | `M-PS.HS` 人员安全管理能力 | `M-PS.HS-02` 建立组织的网络安全专家团队 | FOCUS | 0 | 1 | `ARS-031` | `BLOCKED_NO_SOURCE_FOCUS` |
| `M` | `M-PS` | `M-PS.HS` 人员安全管理能力 | `M-PS.HS-03` 建设组织的红蓝军团队/紫军 | FOCUS | 0 | 1 | `ARS-031` | `BLOCKED_NO_SOURCE_FOCUS` |

## 5. 源服务清单漂移审计

源表 84 个可匹配关注点中，有 22 个关注点的源服务集合与当前工程字典不同。共有 123 对服务关系编码直接一致、20 对仅存在于源表、37 对仅存在于当前字典。

这些差异不阻断已匹配关注点的 rubric 继承，因为当前服务清单由工程字典决定；它们只证明不能使用源 Excel 的服务行作为模板结构。

| 关注点 | rubric set | 仅源表服务编码 | 仅当前字典服务编码 | 处理 |
|---|---|---|---|---|
| `T-AS.AD-03` | `ARS-001` | `I-AP&T-AS.AD-02`、`I-DI&T-AS.AD-03`、`I-OS&T-AS.AD-02` | `I-AP&T-AS.AD-03`、`I-OS&T-AS.AD-03` | 保留当前字典服务；按关注点继承 rubric |
| `T-AS.CM-02` | `ARS-003` | `I-HD&T-AS.AM-02` | `I-HD&T-AS.CM-02` | 保留当前字典服务；按关注点继承 rubric |
| `T-AS.IA-04` | `ARS-005` | `I-AP&T-AS.IA-03`、`I-HD&T-AS.IA-03`、`I-OS&T-AS.IA-03`、`I-US&T-AS.IA-03` | `I-AP&T-AS.IA-04`、`I-HD&T-AS.IA-04`、`I-OS&T-AS.IA-04`、`I-US&T-AS.IA-04` | 保留当前字典服务；按关注点继承 rubric |
| `T-AS.DS-01` | `ARS-006` | `I-OS&T-AS.DS-01` | `I-AP&T-AS.DS-01` | 保留当前字典服务；按关注点继承 rubric |
| `T-AS.DS-02` | `ARS-006` | `I-OS&T-AS.DS-02` | `I-AP&T-AS.DS-02` | 保留当前字典服务；按关注点继承 rubric |
| `T-AS.DS-03` | `ARS-006` | `I-OS&T-AS.DS-03` | `I-AP&T-AS.DS-03` | 保留当前字典服务；按关注点继承 rubric |
| `T-AS.DS-04` | `ARS-006` | `I-OS&T-AS.DS-04` | `I-AP&T-AS.DS-04` | 保留当前字典服务；按关注点继承 rubric |
| `T-AS.DS-05` | `ARS-006` | `I-OS&T-AS.DS-05` | `I-AP&T-AS.DS-05` | 保留当前字典服务；按关注点继承 rubric |
| `T-AS.LA-02` | `ARS-007` | — | `I-US&T-AS.LA-02` | 保留当前字典服务；按关注点继承 rubric |
| `T-PD.PP-03` | `ARS-010` | — | `I-OS&T-PD.PP-03` | 保留当前字典服务；按关注点继承 rubric |
| `T-PD.DP-01` | `ARS-013` | — | `I-AP&T-PD.DP-01` | 保留当前字典服务；按关注点继承 rubric |
| `T-PD.DP-02` | `ARS-013` | — | `I-AP&T-PD.DP-02` | 保留当前字典服务；按关注点继承 rubric |
| `T-AD.SA-01` | `ARS-014` | `I-AP&AD.SA-01`、`I-NT&AD.SA-01`、`I-OS&AD.SA-01`、`I-US&AD.SA-01` | `I-AP&T-AD.SA-01`、`I-NT&T-AD.SA-01`、`I-OS&T-AD.SA-01`、`I-US&T-AD.SA-01` | 保留当前字典服务；按关注点继承 rubric |
| `T-IN.IO-01` | `ARS-017` | `ALL&TI.IO-01` | `ALL&T-IN.IO-01` | 保留当前字典服务；按关注点继承 rubric |
| `T-IN.IO-02` | `ARS-017` | `ALL&TI.IO-02` | `ALL&T-IN.IO-02` | 保留当前字典服务；按关注点继承 rubric |
| `T-IN.IO-03` | `ARS-017` | `ALL&TI.IO-03` | `ALL&T-IN.IO-03` | 保留当前字典服务；按关注点继承 rubric |
| `M-PM.PR-01` | `ARS-022` | — | `M-PM.PR-00` | 保留当前字典服务；按关注点继承 rubric |
| `M-SA.RM-01` | `ARS-024` | — | `M-SA.RM-00` | 保留当前字典服务；按关注点继承 rubric |
| `M-SA.RE-01` | `ARS-025` | — | `M-SA.RE-00` | 保留当前字典服务；按关注点继承 rubric |
| `M-SA.CO-01` | `ARS-028` | — | `M-SA.CO-00` | 保留当前字典服务；按关注点继承 rubric |
| `M-SE.PE-01` | `ARS-030` | — | `M-SE.PE-00` | 保留当前字典服务；按关注点继承 rubric |
| `M-PS.CT-01` | `ARS-032` | — | `M-PS.CT-00` | 保留当前字典服务；按关注点继承 rubric |

## 6. 关注点身份复核：编码相同但名称不同

当前有 8 个关注点的稳定编码和父 L2 一致，但工程当前名称与源表名称不同。工程字典名称是权威名称；在确认源 rubric 仍适用于当前语义之前，这些对象保持 `REVIEW_FOCUS_TITLE_MISMATCH`，不计为映射通过。

| 关注点编码 | 工程当前名称 | 源表名称 | 候选 rubric set | 状态 |
|---|---|---|---|---|
| `T-AS.AD-01` | 遵循安全设计原则对网络安全架构进行设计和管控 | 遵循安全设计原则对网络安全架构进行管控 | `ARS-001` | `REVIEW_FOCUS_TITLE_MISMATCH` |
| `T-AS.AD-02` | 实施网络安全架构的冗余设计 | 实施网络安全架构的冗余管控 | `ARS-001` | `REVIEW_FOCUS_TITLE_MISMATCH` |
| `T-AS.AD-03` | 确保系统、应用的可靠性与可恢复性 | 确保系统、应用与数据的可靠性与可恢复性 | `ARS-001` | `REVIEW_FOCUS_TITLE_MISMATCH` |
| `T-AS.CG-01` | 确保信息传输或是存储状态下不被未授权的访问或泄露 | 确保加解密算法的合规与正确应用 | `ARS-008` | `REVIEW_FOCUS_TITLE_MISMATCH` |
| `T-AS.CG-02` | 确保在信息交互过程中，主体和客体均源自可信赖的来源，并且不被非法篡改或删除 | 依据业务需求合理使用密码应用服务 | `ARS-008` | `REVIEW_FOCUS_TITLE_MISMATCH` |
| `T-AD.SV-01` | 实现网络安全策略可视化（全局网络安全策略集合管理） | 实现网络安全策略可视化 | `ARS-016` | `REVIEW_FOCUS_TITLE_MISMATCH` |
| `T-AD.SV-02` | 对安全架构和网络防护策略进行评估验证 | 对网络防护策略进行有效性验证 | `ARS-016` | `REVIEW_FOCUS_TITLE_MISMATCH` |
| `M-SE.SE-02` | 持续开展管理体系有效性检查与整改 | 定期开展网络攻防演习，并对演练结果进行评价 | `ARS-029` | `REVIEW_FOCUS_TITLE_MISMATCH` |

### 6.1 用户业务裁定记录

以下15项只能由用户作业务裁定。工程侧不得把候选 rubric set 自动生效，也不得因同属一个 L2 自动继承。用户可直接回复“序号 + 选择 + 说明”；裁定完成前保持 `PENDING_USER_DECISION`。

| 序号 | 类型 | 当前关注点 | 候选 rubric set | 可选业务决定 | 用户裁定 | 业务说明 |
|---:|---|---|---|---|---|---|
| 1 | 名称语义复核 | `T-AS.AD-01` 遵循安全设计原则对网络安全架构进行设计和管控 | `ARS-001` | 沿用候选 / 拒绝并新建专用 rubric | `PENDING_USER_DECISION` | — |
| 2 | 名称语义复核 | `T-AS.AD-02` 实施网络安全架构的冗余设计 | `ARS-001` | 沿用候选 / 拒绝并新建专用 rubric | `PENDING_USER_DECISION` | — |
| 3 | 名称语义复核 | `T-AS.AD-03` 确保系统、应用的可靠性与可恢复性 | `ARS-001` | 沿用候选 / 拒绝并新建专用 rubric | `PENDING_USER_DECISION` | — |
| 4 | 名称语义复核 | `T-AS.CG-01` 确保信息传输或是存储状态下不被未授权的访问或泄露 | `ARS-008` | 沿用候选 / 拒绝并新建专用 rubric | `PENDING_USER_DECISION` | — |
| 5 | 名称语义复核 | `T-AS.CG-02` 确保在信息交互过程中主体和客体可信且不被非法篡改或删除 | `ARS-008` | 沿用候选 / 拒绝并新建专用 rubric | `PENDING_USER_DECISION` | — |
| 6 | 名称语义复核 | `T-AD.SV-01` 实现网络安全策略可视化（全局网络安全策略集合管理） | `ARS-016` | 沿用候选 / 拒绝并新建专用 rubric | `PENDING_USER_DECISION` | — |
| 7 | 名称语义复核 | `T-AD.SV-02` 对安全架构和网络防护策略进行评估验证 | `ARS-016` | 沿用候选 / 拒绝并新建专用 rubric | `PENDING_USER_DECISION` | — |
| 8 | 名称语义复核 | `M-SE.SE-02` 持续开展管理体系有效性检查与整改 | `ARS-029` | 沿用候选 / 拒绝并新建专用 rubric | `PENDING_USER_DECISION` | — |
| 9 | 无源 rubric | `T-AS.AM-02` 实现主机、终端等信息化资产的安全管理 | `ARS-002` | 继承候选 / 新建专用 rubric | `PENDING_USER_DECISION` | — |
| 10 | 无源 rubric | `T-AS.DS-06` 持续管理可复用的开发安全资源 | `ARS-006` | 继承候选 / 新建专用 rubric | `PENDING_USER_DECISION` | — |
| 11 | 无源 rubric | `T-AS.DG-03` 确保数据的可靠性与可恢复性 | `ARS-009` | 继承候选 / 新建专用 rubric | `PENDING_USER_DECISION` | — |
| 12 | 无源 rubric | `T-PD.TP-05` 对仅允许预定义的程序或行为进行控制 | `ARS-012` | 继承候选 / 新建专用 rubric | `PENDING_USER_DECISION` | — |
| 13 | 无源 rubric | `T-AD.SV-03` 开展攻防演练和沙盘推演 | `ARS-016` | 继承候选 / 新建专用 rubric | `PENDING_USER_DECISION` | — |
| 14 | 无源 rubric | `M-PS.HS-02` 建立组织的网络安全专家团队 | `ARS-031` | 继承候选 / 新建专用 rubric | `PENDING_USER_DECISION` | — |
| 15 | 无源 rubric | `M-PS.HS-03` 建设组织的红蓝军团队/紫军 | `ARS-031` | 继承候选 / 新建专用 rubric | `PENDING_USER_DECISION` | — |

## 7. 91 个当前关注点映射总表

| L0 | L1 | L2 | 当前关注点 | 粒度 | 当前服务关系 | 当前评估点 | rubric set | 源行 | 映射状态 |
|---|---|---|---|---|---:|---:|---|---:|---|
| `T` | `T-AS` | `T-AS.AD` 网络安全体系架构管控能力 | `T-AS.AD-01` 遵循安全设计原则对网络安全架构进行设计和管控 | SERVICE | 6 | 6 | `ARS-001` | 3—8 | `REVIEW_FOCUS_TITLE_MISMATCH` |
| `T` | `T-AS` | `T-AS.AD` 网络安全体系架构管控能力 | `T-AS.AD-02` 实施网络安全架构的冗余设计 | SERVICE | 6 | 6 | `ARS-001` | 9—14 | `REVIEW_FOCUS_TITLE_MISMATCH` |
| `T` | `T-AS` | `T-AS.AD` 网络安全体系架构管控能力 | `T-AS.AD-03` 确保系统、应用的可靠性与可恢复性 | SERVICE | 2 | 2 | `ARS-001` | 15—17 | `REVIEW_FOCUS_TITLE_MISMATCH` |
| `T` | `T-AS` | `T-AS.AM` 信息化资产安全管理能力 | `T-AS.AM-01` 监测和持续管理组织的动态资产清单（IT&OT） | SERVICE | 5 | 5 | `ARS-002` | 18—22 | `MAPPED_EXACT_FOCUS_CODE_AND_TITLE` |
| `T` | `T-AS` | `T-AS.AM` 信息化资产安全管理能力 | `T-AS.AM-02` 实现主机、终端等信息化资产的安全管理 | SERVICE | 3 | 3 | — | — | `BLOCKED_NO_SOURCE_FOCUS` |
| `T` | `T-AS` | `T-AS.CM` 安全配置与加固措施管理能力 | `T-AS.CM-01` 持续管理和维护组织的安全配置基线集合 | SERVICE | 4 | 4 | `ARS-003` | 23—26 | `MAPPED_EXACT_FOCUS_CODE_AND_TITLE` |
| `T` | `T-AS` | `T-AS.CM` 安全配置与加固措施管理能力 | `T-AS.CM-02` 实施对信息化资产的安全加固 | SERVICE | 3 | 3 | `ARS-003` | 27—29 | `MAPPED_EXACT_FOCUS_CODE_AND_TITLE` |
| `T` | `T-AS` | `T-AS.VM` 漏洞与补丁管理能力 | `T-AS.VM-01` 实施漏洞本地化管理以降低资产安全风险 | SERVICE | 3 | 3 | `ARS-004` | 30—32 | `MAPPED_EXACT_FOCUS_CODE_AND_TITLE` |
| `T` | `T-AS` | `T-AS.VM` 漏洞与补丁管理能力 | `T-AS.VM-02` 加强补丁信息的运营管理。 | SERVICE | 3 | 3 | `ARS-004` | 33—35 | `MAPPED_EXACT_FOCUS_CODE_AND_TITLE` |
| `T` | `T-AS` | `T-AS.IA` 身份、凭证与访问管理能力 | `T-AS.IA-01` 实现组织数字化身份的身份生命周期管理 | SERVICE | 4 | 4 | `ARS-005` | 36—39 | `MAPPED_EXACT_FOCUS_CODE_AND_TITLE` |
| `T` | `T-AS` | `T-AS.IA` 身份、凭证与访问管理能力 | `T-AS.IA-02` 针对不同访问主体执行满足安全需求的身份认证机制 | SERVICE | 4 | 4 | `ARS-005` | 40—43 | `MAPPED_EXACT_FOCUS_CODE_AND_TITLE` |
| `T` | `T-AS` | `T-AS.IA` 身份、凭证与访问管理能力 | `T-AS.IA-03` 实施人员实体的访问控制管理 | SERVICE | 6 | 6 | `ARS-005` | 44—49 | `MAPPED_EXACT_FOCUS_CODE_AND_TITLE` |
| `T` | `T-AS` | `T-AS.IA` 身份、凭证与访问管理能力 | `T-AS.IA-04` 管理和维护凭证的完整生命周期 | SERVICE | 4 | 4 | `ARS-005` | 50—53 | `MAPPED_EXACT_FOCUS_CODE_AND_TITLE` |
| `T` | `T-AS` | `T-AS.DS` 开发安全管控能力 | `T-AS.DS-01` 持续管理软件安全需求 | SERVICE | 1 | 1 | `ARS-006` | 54—54 | `MAPPED_EXACT_FOCUS_CODE_AND_TITLE` |
| `T` | `T-AS` | `T-AS.DS` 开发安全管控能力 | `T-AS.DS-02` 实施代码安全检查 | SERVICE | 1 | 1 | `ARS-006` | 55—55 | `MAPPED_EXACT_FOCUS_CODE_AND_TITLE` |
| `T` | `T-AS` | `T-AS.DS` 开发安全管控能力 | `T-AS.DS-03` 实施软件供应链安全检查 | SERVICE | 1 | 1 | `ARS-006` | 56—56 | `MAPPED_EXACT_FOCUS_CODE_AND_TITLE` |
| `T` | `T-AS` | `T-AS.DS` 开发安全管控能力 | `T-AS.DS-04` 实施软件制品安全检查 | SERVICE | 1 | 1 | `ARS-006` | 57—57 | `MAPPED_EXACT_FOCUS_CODE_AND_TITLE` |
| `T` | `T-AS` | `T-AS.DS` 开发安全管控能力 | `T-AS.DS-05` 实施软件上线安全检查 | SERVICE | 1 | 1 | `ARS-006` | 58—58 | `MAPPED_EXACT_FOCUS_CODE_AND_TITLE` |
| `T` | `T-AS` | `T-AS.DS` 开发安全管控能力 | `T-AS.DS-06` 持续管理可复用的开发安全资源 | SERVICE | 1 | 1 | — | — | `BLOCKED_NO_SOURCE_FOCUS` |
| `T` | `T-AS` | `T-AS.LA` 日志收集与审计能力 | `T-AS.LA-01` 在信息化资产上记录保存日志 | SERVICE | 4 | 4 | `ARS-007` | 59—62 | `MAPPED_EXACT_FOCUS_CODE_AND_TITLE` |
| `T` | `T-AS` | `T-AS.LA` 日志收集与审计能力 | `T-AS.LA-02` 实现日志的收集与集中存储机制 | SERVICE | 5 | 5 | `ARS-007` | 63—66 | `MAPPED_EXACT_FOCUS_CODE_AND_TITLE` |
| `T` | `T-AS` | `T-AS.LA` 日志收集与审计能力 | `T-AS.LA-03` 对安全日志进行审计分析 | SERVICE | 6 | 6 | `ARS-007` | 67—72 | `MAPPED_EXACT_FOCUS_CODE_AND_TITLE` |
| `T` | `T-AS` | `T-AS.CG` 密码服务能力 | `T-AS.CG-01` 确保信息传输或是存储状态下不被未授权的访问或泄露 | SERVICE | 5 | 5 | `ARS-008` | 73—77 | `REVIEW_FOCUS_TITLE_MISMATCH` |
| `T` | `T-AS` | `T-AS.CG` 密码服务能力 | `T-AS.CG-02` 确保在信息交互过程中，主体和客体均源自可信赖的来源，并且不被非法篡改或删除 | SERVICE | 4 | 4 | `ARS-008` | 78—81 | `REVIEW_FOCUS_TITLE_MISMATCH` |
| `T` | `T-AS` | `T-AS.DG` 数据安全管理和治理能力 | `T-AS.DG-01` 持续管理数据分类分级策略，执行数据分类分级 | SERVICE | 1 | 1 | `ARS-009` | 82—82 | `MAPPED_EXACT_FOCUS_CODE_AND_TITLE` |
| `T` | `T-AS` | `T-AS.DG` 数据安全管理和治理能力 | `T-AS.DG-02` 制定并实施数据安全策略 | SERVICE | 1 | 1 | `ARS-009` | 83—83 | `MAPPED_EXACT_FOCUS_CODE_AND_TITLE` |
| `T` | `T-AS` | `T-AS.DG` 数据安全管理和治理能力 | `T-AS.DG-03` 确保数据的可靠性与可恢复性 | SERVICE | 1 | 1 | — | — | `BLOCKED_NO_SOURCE_FOCUS` |
| `T` | `T-PD` | `T-PD.PP` 网络边界防护能力 | `T-PD.PP-01` 构建和维护安全可靠的网络访问路径 | SERVICE | 4 | 4 | `ARS-010` | 84—87 | `MAPPED_EXACT_FOCUS_CODE_AND_TITLE` |
| `T` | `T-PD` | `T-PD.PP` 网络边界防护能力 | `T-PD.PP-02` 实施控制措施以监测和管理网络异常流量 | SERVICE | 1 | 1 | `ARS-010` | 88—88 | `MAPPED_EXACT_FOCUS_CODE_AND_TITLE` |
| `T` | `T-PD` | `T-PD.PP` 网络边界防护能力 | `T-PD.PP-03` 执行网络的隔离与边界保护措施 | SERVICE | 5 | 5 | `ARS-010` | 89—92 | `MAPPED_EXACT_FOCUS_CODE_AND_TITLE` |
| `T` | `T-PD` | `T-PD.AC` 网络访问控制能力 | `T-PD.AC-01` 实施非人员实体的访问控制管理 | SERVICE | 4 | 4 | `ARS-011` | 93—96 | `MAPPED_EXACT_FOCUS_CODE_AND_TITLE` |
| `T` | `T-PD` | `T-PD.AC` 网络访问控制能力 | `T-PD.AC-02` 对访问实体执行信誉评估 | SERVICE | 3 | 3 | `ARS-011` | 97—99 | `MAPPED_EXACT_FOCUS_CODE_AND_TITLE` |
| `T` | `T-PD` | `T-PD.TP` 威胁检测与防护能力 | `T-PD.TP-01` 对恶意代码进行检测和防护，抑制或阻止恶意代码带来威胁 | SERVICE | 2 | 2 | `ARS-012` | 100—101 | `MAPPED_EXACT_FOCUS_CODE_AND_TITLE` |
| `T` | `T-PD` | `T-PD.TP` 威胁检测与防护能力 | `T-PD.TP-02` 识别与检测已知及新出现安全威胁 | SERVICE | 3 | 3 | `ARS-012` | 102—104 | `MAPPED_EXACT_FOCUS_CODE_AND_TITLE` |
| `T` | `T-PD` | `T-PD.TP` 威胁检测与防护能力 | `T-PD.TP-03` 实施入侵防护技术和策略，及时阻断攻击行为 | SERVICE | 3 | 3 | `ARS-012` | 105—107 | `MAPPED_EXACT_FOCUS_CODE_AND_TITLE` |
| `T` | `T-PD` | `T-PD.TP` 威胁检测与防护能力 | `T-PD.TP-04` 收集网络安全流量 | SERVICE | 1 | 1 | `ARS-012` | 108—108 | `MAPPED_EXACT_FOCUS_CODE_AND_TITLE` |
| `T` | `T-PD` | `T-PD.TP` 威胁检测与防护能力 | `T-PD.TP-05` 对仅允许预定义的程序或行为进行控制 | SERVICE | 2 | 2 | — | — | `BLOCKED_NO_SOURCE_FOCUS` |
| `T` | `T-PD` | `T-PD.DP` 数据安全防护能力 | `T-PD.DP-01` 实施水印技术，加强数据泄漏的追踪溯源 | SERVICE | 3 | 3 | `ARS-013` | 109—111 | `MAPPED_EXACT_FOCUS_CODE_AND_TITLE` |
| `T` | `T-PD` | `T-PD.DP` 数据安全防护能力 | `T-PD.DP-02` 实施敏感数据的脱敏处理措施 | SERVICE | 3 | 3 | `ARS-013` | 112—114 | `MAPPED_EXACT_FOCUS_CODE_AND_TITLE` |
| `T` | `T-PD` | `T-PD.DP` 数据安全防护能力 | `T-PD.DP-03` 实施数据防泄漏控制技术和策略 | SERVICE | 2 | 2 | `ARS-013` | 115—116 | `MAPPED_EXACT_FOCUS_CODE_AND_TITLE` |
| `T` | `T-PD` | `T-PD.DP` 数据安全防护能力 | `T-PD.DP-04` 实施数据访问控制技术 | SERVICE | 1 | 1 | `ARS-013` | 117—117 | `MAPPED_EXACT_FOCUS_CODE_AND_TITLE` |
| `T` | `T-PD` | `T-PD.DP` 数据安全防护能力 | `T-PD.DP-05` 监测数据全生命周期流转过程 | SERVICE | 1 | 1 | `ARS-013` | 118—118 | `MAPPED_EXACT_FOCUS_CODE_AND_TITLE` |
| `T` | `T-PD` | `T-PD.DP` 数据安全防护能力 | `T-PD.DP-06` 在数据生命周期结束时执行数据销毁策略 | SERVICE | 1 | 1 | `ARS-013` | 119—119 | `MAPPED_EXACT_FOCUS_CODE_AND_TITLE` |
| `T` | `T-PD` | `T-PD.DP` 数据安全防护能力 | `T-PD.DP-07` 执行隐私数据识别和监控以保护隐私数据 | SERVICE | 1 | 1 | `ARS-013` | 120—120 | `MAPPED_EXACT_FOCUS_CODE_AND_TITLE` |
| `T` | `T-AD` | `T-AD.SA` 态势感知能力 | `T-AD.SA-01` 实施高级威胁检测，识别复杂、隐蔽的攻击行为 | SERVICE | 4 | 4 | `ARS-014` | 121—124 | `MAPPED_EXACT_FOCUS_CODE_AND_TITLE` |
| `T` | `T-AD` | `T-AD.SA` 态势感知能力 | `T-AD.SA-02` 执行网络安全监控 | SERVICE | 1 | 1 | `ARS-014` | 125—125 | `MAPPED_EXACT_FOCUS_CODE_AND_TITLE` |
| `T` | `T-AD` | `T-AD.SA` 态势感知能力 | `T-AD.SA-03` 建立并维护态势感知 | SERVICE | 1 | 1 | `ARS-014` | 126—126 | `MAPPED_EXACT_FOCUS_CODE_AND_TITLE` |
| `T` | `T-AD` | `T-AD.IR` 网络安全事件分析与响应能力 | `T-AD.IR-01` 网络安全事件分析与事件定性、公布 | SERVICE | 1 | 1 | `ARS-015` | 127—127 | `MAPPED_EXACT_FOCUS_CODE_AND_TITLE` |
| `T` | `T-AD` | `T-AD.IR` 网络安全事件分析与响应能力 | `T-AD.IR-02` 管理网络安全事件 | SERVICE | 1 | 1 | `ARS-015` | 128—128 | `MAPPED_EXACT_FOCUS_CODE_AND_TITLE` |
| `T` | `T-AD` | `T-AD.IR` 网络安全事件分析与响应能力 | `T-AD.IR-03` 持续维护应急计划，执行网络安全事件响应处置 | SERVICE | 1 | 1 | `ARS-015` | 129—129 | `MAPPED_EXACT_FOCUS_CODE_AND_TITLE` |
| `T` | `T-AD` | `T-AD.IR` 网络安全事件分析与响应能力 | `T-AD.IR-04` 对网络安全事件造成的影响执行恢复操作 | SERVICE | 1 | 1 | `ARS-015` | 130—130 | `MAPPED_EXACT_FOCUS_CODE_AND_TITLE` |
| `T` | `T-AD` | `T-AD.IR` 网络安全事件分析与响应能力 | `T-AD.IR-05` 对网络安全事件执行调查取证 | SERVICE | 4 | 4 | `ARS-015` | 131—134 | `MAPPED_EXACT_FOCUS_CODE_AND_TITLE` |
| `T` | `T-AD` | `T-AD.IR` 网络安全事件分析与响应能力 | `T-AD.IR-06` 对网络攻击进行诱捕 | SERVICE | 5 | 5 | `ARS-015` | 135—139 | `MAPPED_EXACT_FOCUS_CODE_AND_TITLE` |
| `T` | `T-AD` | `T-AD.SV` 安全架构评估能力 | `T-AD.SV-01` 实现网络安全策略可视化（全局网络安全策略集合管理） | SERVICE | 3 | 3 | `ARS-016` | 140—142 | `REVIEW_FOCUS_TITLE_MISMATCH` |
| `T` | `T-AD` | `T-AD.SV` 安全架构评估能力 | `T-AD.SV-02` 对安全架构和网络防护策略进行评估验证 | SERVICE | 1 | 1 | `ARS-016` | 143—143 | `REVIEW_FOCUS_TITLE_MISMATCH` |
| `T` | `T-AD` | `T-AD.SV` 安全架构评估能力 | `T-AD.SV-03` 开展攻防演练和沙盘推演 | SERVICE | 1 | 1 | — | — | `BLOCKED_NO_SOURCE_FOCUS` |
| `T` | `T-IN` | `T-IN.IO` 威胁情报运营能力 | `T-IN.IO-01` 选取来自不同渠道的威胁情报源 | SERVICE | 1 | 1 | `ARS-017` | 144—144 | `MAPPED_EXACT_FOCUS_CODE_AND_TITLE` |
| `T` | `T-IN` | `T-IN.IO` 威胁情报运营能力 | `T-IN.IO-02` 对多源异构威胁情报进行融合与治理 | SERVICE | 1 | 1 | `ARS-017` | 145—145 | `MAPPED_EXACT_FOCUS_CODE_AND_TITLE` |
| `T` | `T-IN` | `T-IN.IO` 威胁情报运营能力 | `T-IN.IO-03` 在组织内部共享成品威胁情报 | SERVICE | 1 | 1 | `ARS-017` | 146—146 | `MAPPED_EXACT_FOCUS_CODE_AND_TITLE` |
| `T` | `T-IN` | `T-IN.IP` 威胁情报生产能力 | `T-IN.IP-01` 生产组织本地威胁情报 | SERVICE | 1 | 1 | `ARS-018` | 147—147 | `MAPPED_EXACT_FOCUS_CODE_AND_TITLE` |
| `T` | `T-OF` | `T-OF.AT` 进攻反制能力 | `T-OF.AT-01` 对攻击行为进行溯源 | FOCUS | 0 | 1 | `ARS-019` | 148—148 | `MAPPED_EXACT_FOCUS_CODE_AND_TITLE` |
| `T` | `T-OF` | `T-OF.AT` 进攻反制能力 | `T-OF.AT-02` 网络攻击入侵目标选择及评估分析 | FOCUS | 0 | 1 | `ARS-019` | 149—149 | `MAPPED_EXACT_FOCUS_CODE_AND_TITLE` |
| `T` | `T-OF` | `T-OF.AT` 进攻反制能力 | `T-OF.AT-03` 网络攻击执行与效果评估 | FOCUS | 0 | 1 | `ARS-019` | 150—150 | `MAPPED_EXACT_FOCUS_CODE_AND_TITLE` |
| `G` | `G-SP` | `G-SP.SM` 安全战略管理能力 | `G-SP.SM-01` 具有明确的网络安全战略计划与目标 | FOCUS | 0 | 1 | `ARS-020` | 151—151 | `MAPPED_EXACT_FOCUS_CODE_AND_TITLE` |
| `G` | `G-SP` | `G-SP.SM` 安全战略管理能力 | `G-SP.SM-02` 完善网络安全组织架构，合理分配网络安全组织职责 | FOCUS | 0 | 1 | `ARS-020` | 152—152 | `MAPPED_EXACT_FOCUS_CODE_AND_TITLE` |
| `G` | `G-SP` | `G-SP.SM` 安全战略管理能力 | `G-SP.SM-03` 对组织网络安全活动执行决策监督 | FOCUS | 0 | 1 | `ARS-020` | 153—153 | `MAPPED_EXACT_FOCUS_CODE_AND_TITLE` |
| `M` | `M-PM` | `M-PM.PL` 安全规划管理能力 | `M-PM.PL-01` 定期开展网络安全规划及持续更新修订 | FOCUS | 0 | 1 | `ARS-021` | 154—154 | `MAPPED_EXACT_FOCUS_CODE_AND_TITLE` |
| `M` | `M-PM` | `M-PM.PR` 安全建设管理能力 | `M-PM.PR-01` 网络安全与信息化项目生命周期紧密结合 | FOCUS | 1 | 1 | `ARS-022` | 155—155 | `MAPPED_EXACT_FOCUS_CODE_AND_TITLE` |
| `M` | `M-PM` | `M-PM.PR` 安全建设管理能力 | `M-PM.PR-02` 有完整的安全项目生命周期管理 | FOCUS | 0 | 1 | `ARS-022` | 156—156 | `MAPPED_EXACT_FOCUS_CODE_AND_TITLE` |
| `M` | `M-SA` | `M-SA.AM` 安全保障管理能力 | `M-SA.AM-01` 保障与落实网络安全投资 | FOCUS | 0 | 1 | `ARS-023` | 157—157 | `MAPPED_EXACT_FOCUS_CODE_AND_TITLE` |
| `M` | `M-SA` | `M-SA.AM` 安全保障管理能力 | `M-SA.AM-02` 实现信创环境网络安全防护措施的适配与推广 | FOCUS | 0 | 1 | `ARS-023` | 158—158 | `MAPPED_EXACT_FOCUS_CODE_AND_TITLE` |
| `M` | `M-SA` | `M-SA.RM` 安全风险管理能力 | `M-SA.RM-01` 持续优化组织网络安全风险管理策略和计划 | FOCUS | 1 | 1 | `ARS-024` | 159—159 | `MAPPED_EXACT_FOCUS_CODE_AND_TITLE` |
| `M` | `M-SA` | `M-SA.RM` 安全风险管理能力 | `M-SA.RM-02` 开展组织网络安全风险识别、分析、处置与后评估 | FOCUS | 0 | 1 | `ARS-024` | 160—160 | `MAPPED_EXACT_FOCUS_CODE_AND_TITLE` |
| `M` | `M-SA` | `M-SA.RE` 安全合规管理能力 | `M-SA.RE-01` 完善网络安全制度体系 | FOCUS | 1 | 1 | `ARS-025` | 161—161 | `MAPPED_EXACT_FOCUS_CODE_AND_TITLE` |
| `M` | `M-SA` | `M-SA.RE` 安全合规管理能力 | `M-SA.RE-02` 开展网络安全合规审查，满足国内外法律法规与监管要求 | FOCUS | 0 | 1 | `ARS-025` | 162—162 | `MAPPED_EXACT_FOCUS_CODE_AND_TITLE` |
| `M` | `M-SA` | `M-SA.RE` 安全合规管理能力 | `M-SA.RE-03` 满足个人隐私保护要求 | FOCUS | 0 | 1 | `ARS-025` | 163—163 | `MAPPED_EXACT_FOCUS_CODE_AND_TITLE` |
| `M` | `M-SA` | `M-SA.TP` 第三方管理能力 | `M-SA.TP-01` 强化软件供应商及其它第三方的安全管理 | FOCUS | 0 | 1 | `ARS-026` | 164—164 | `MAPPED_EXACT_FOCUS_CODE_AND_TITLE` |
| `M` | `M-SA` | `M-SA.TP` 第三方管理能力 | `M-SA.TP-02` 实施第三方人员生命周期安全控制 | FOCUS | 0 | 1 | `ARS-026` | 165—165 | `MAPPED_EXACT_FOCUS_CODE_AND_TITLE` |
| `M` | `M-SA` | `M-SA.OP` 安全运行管理能力 | `M-SA.OP-01` 持续优化组织的安全运行流程与操作规程 | FOCUS | 0 | 1 | `ARS-027` | 166—166 | `MAPPED_EXACT_FOCUS_CODE_AND_TITLE` |
| `M` | `M-SA` | `M-SA.OP` 安全运行管理能力 | `M-SA.OP-02` 持续优化网络安全运行指标，开展运行活动效果评价 | FOCUS | 0 | 1 | `ARS-027` | 167—167 | `MAPPED_EXACT_FOCUS_CODE_AND_TITLE` |
| `M` | `M-SA` | `M-SA.CO` 安全协同能力 | `M-SA.CO-01` 在组织内共享网络安全信息 | FOCUS | 1 | 1 | `ARS-028` | 168—168 | `MAPPED_EXACT_FOCUS_CODE_AND_TITLE` |
| `M` | `M-SA` | `M-SA.CO` 安全协同能力 | `M-SA.CO-02` 对外部通报进行响应、处置与反馈 | FOCUS | 0 | 1 | `ARS-028` | 169—169 | `MAPPED_EXACT_FOCUS_CODE_AND_TITLE` |
| `M` | `M-SE` | `M-SE.SE` 网络安全监督检查能力 | `M-SE.SE-01` 持续开展信息化环境网络安全（控制措施）检查与整改 | FOCUS | 0 | 1 | `ARS-029` | 170—170 | `MAPPED_EXACT_FOCUS_CODE_AND_TITLE` |
| `M` | `M-SE` | `M-SE.SE` 网络安全监督检查能力 | `M-SE.SE-02` 持续开展管理体系有效性检查与整改 | FOCUS | 0 | 1 | `ARS-029` | 171—171 | `REVIEW_FOCUS_TITLE_MISMATCH` |
| `M` | `M-SE` | `M-SE.SE` 网络安全监督检查能力 | `M-SE.SE-03` 执行网络安全监督工作（建设监督、运营监督、整改监督） | FOCUS | 0 | 1 | `ARS-029` | 172—172 | `MAPPED_EXACT_FOCUS_CODE_AND_TITLE` |
| `M` | `M-SE` | `M-SE.PE` 网络安全绩效考核能力 | `M-SE.PE-01` 定义组织网络安全绩效考核指标，开展网络安全考核工作 | FOCUS | 1 | 1 | `ARS-030` | 173—173 | `MAPPED_EXACT_FOCUS_CODE_AND_TITLE` |
| `M` | `M-PS` | `M-PS.HS` 人员安全管理能力 | `M-PS.HS-01` 实施内部人员生命周期安全控制 | FOCUS | 0 | 1 | `ARS-031` | 174—174 | `MAPPED_EXACT_FOCUS_CODE_AND_TITLE` |
| `M` | `M-PS` | `M-PS.HS` 人员安全管理能力 | `M-PS.HS-02` 建立组织的网络安全专家团队 | FOCUS | 0 | 1 | — | — | `BLOCKED_NO_SOURCE_FOCUS` |
| `M` | `M-PS` | `M-PS.HS` 人员安全管理能力 | `M-PS.HS-03` 建设组织的红蓝军团队/紫军 | FOCUS | 0 | 1 | — | — | `BLOCKED_NO_SOURCE_FOCUS` |
| `M` | `M-PS` | `M-PS.CT` 安全意识教育与技能培养能力 | `M-PS.CT-01` 提高组织全员网络安全意识 | FOCUS | 1 | 1 | `ARS-032` | 175—175 | `MAPPED_EXACT_FOCUS_CODE_AND_TITLE` |
| `M` | `M-PS` | `M-PS.CT` 安全意识教育与技能培养能力 | `M-PS.CT-02` 培养网络安全人才，提升网络安全人员能力 | FOCUS | 0 | 1 | `ARS-032` | 176—176 | `MAPPED_EXACT_FOCUS_CODE_AND_TITLE` |

## 8. 160 条当前关注点—安全技术服务关系映射

<details>
<summary>展开完整服务关系映射</summary>

| L2 | 关注点 | 作用域 | 当前服务 | 服务角色 | rubric set | 状态 |
|---|---|---|---|---|---|---|
| `T-AS.AD` | `T-AS.AD-01` | `I-AP` | `I-AP&T-AS.AD-01` 应用架构管控 | `ASSESSMENT_POINT` | `ARS-001` | `REVIEW_FOCUS_IDENTITY` |
| `T-AS.AD` | `T-AS.AD-01` | `I-DI` | `I-DI&T-AS.AD-01` 数据分库分表 | `ASSESSMENT_POINT` | `ARS-001` | `REVIEW_FOCUS_IDENTITY` |
| `T-AS.AD` | `T-AS.AD-01` | `I-HD` | `I-HD&T-AS.AD-01` 计算与存储分离 | `ASSESSMENT_POINT` | `ARS-001` | `REVIEW_FOCUS_IDENTITY` |
| `T-AS.AD` | `T-AS.AD-01` | `I-NT` | `I-NT&T-AS.AD-01` 网络平面及区域划分 | `ASSESSMENT_POINT` | `ARS-001` | `REVIEW_FOCUS_IDENTITY` |
| `T-AS.AD` | `T-AS.AD-01` | `I-OS` | `I-OS&T-AS.AD-01` 主机/终端安全工作区划分 | `ASSESSMENT_POINT` | `ARS-001` | `REVIEW_FOCUS_IDENTITY` |
| `T-AS.AD` | `T-AS.AD-01` | `I-PE` | `I-PE&T-AS.AD-01` 物理区域分区 | `ASSESSMENT_POINT` | `ARS-001` | `REVIEW_FOCUS_IDENTITY` |
| `T-AS.AD` | `T-AS.AD-02` | `I-AP` | `I-AP&T-AS.AD-02` 应用冗余 | `ASSESSMENT_POINT` | `ARS-001` | `REVIEW_FOCUS_IDENTITY` |
| `T-AS.AD` | `T-AS.AD-02` | `I-DI` | `I-DI&T-AS.AD-02` 冗余存储 | `ASSESSMENT_POINT` | `ARS-001` | `REVIEW_FOCUS_IDENTITY` |
| `T-AS.AD` | `T-AS.AD-02` | `I-HD` | `I-HD&T-AS.AD-02` 设备冗余 | `ASSESSMENT_POINT` | `ARS-001` | `REVIEW_FOCUS_IDENTITY` |
| `T-AS.AD` | `T-AS.AD-02` | `I-NT` | `I-NT&T-AS.AD-02` 网络冗余 | `ASSESSMENT_POINT` | `ARS-001` | `REVIEW_FOCUS_IDENTITY` |
| `T-AS.AD` | `T-AS.AD-02` | `I-OS` | `I-OS&T-AS.AD-02` 主机/终端冗余 | `ASSESSMENT_POINT` | `ARS-001` | `REVIEW_FOCUS_IDENTITY` |
| `T-AS.AD` | `T-AS.AD-02` | `I-PE` | `I-PE&T-AS.AD-02` 物理环境冗余 | `ASSESSMENT_POINT` | `ARS-001` | `REVIEW_FOCUS_IDENTITY` |
| `T-AS.AD` | `T-AS.AD-03` | `I-AP` | `I-AP&T-AS.AD-03` 应用备份 | `ASSESSMENT_POINT` | `ARS-001` | `REVIEW_FOCUS_IDENTITY` |
| `T-AS.AD` | `T-AS.AD-03` | `I-OS` | `I-OS&T-AS.AD-03` 操作系统备份 | `ASSESSMENT_POINT` | `ARS-001` | `REVIEW_FOCUS_IDENTITY` |
| `T-AS.AM` | `T-AS.AM-01` | `I-AP` | `I-AP&T-AS.AM-01` 软件资产清单 | `ASSESSMENT_POINT` | `ARS-002` | `MAPPED_BY_CURRENT_FOCUS` |
| `T-AS.AM` | `T-AS.AM-01` | `I-DI` | `I-DI&T-AS.AM-01` 数据资产清单 | `ASSESSMENT_POINT` | `ARS-002` | `MAPPED_BY_CURRENT_FOCUS` |
| `T-AS.AM` | `T-AS.AM-01` | `I-HD` | `I-HD&T-AS.AM-01` 硬件资产清单 | `ASSESSMENT_POINT` | `ARS-002` | `MAPPED_BY_CURRENT_FOCUS` |
| `T-AS.AM` | `T-AS.AM-01` | `I-NT` | `I-NT&T-AS.AM-01` 网络资产清单 | `ASSESSMENT_POINT` | `ARS-002` | `MAPPED_BY_CURRENT_FOCUS` |
| `T-AS.AM` | `T-AS.AM-01` | `I-OS` | `I-OS&T-AS.AM-01` 主机/终端资产清单 | `ASSESSMENT_POINT` | `ARS-002` | `MAPPED_BY_CURRENT_FOCUS` |
| `T-AS.AM` | `T-AS.AM-02` | `I-AP` | `I-AP&T-AS.AM-02` 软件资产安全管控 | `ASSESSMENT_POINT` | — | `BLOCKED_FOCUS_UNMAPPED` |
| `T-AS.AM` | `T-AS.AM-02` | `I-NT` | `I-NT&T-AS.AM-02` 网络资产安全管控 | `ASSESSMENT_POINT` | — | `BLOCKED_FOCUS_UNMAPPED` |
| `T-AS.AM` | `T-AS.AM-02` | `I-OS` | `I-OS&T-AS.AM-02` 主机/终端资产安全管控 | `ASSESSMENT_POINT` | — | `BLOCKED_FOCUS_UNMAPPED` |
| `T-AS.CM` | `T-AS.CM-01` | `I-AP` | `I-AP&T-AS.CM-01` 应用安全基线配置管理 | `ASSESSMENT_POINT` | `ARS-003` | `MAPPED_BY_CURRENT_FOCUS` |
| `T-AS.CM` | `T-AS.CM-01` | `I-HD` | `I-HD&T-AS.CM-01` 固件安全基线配置管理 | `ASSESSMENT_POINT` | `ARS-003` | `MAPPED_BY_CURRENT_FOCUS` |
| `T-AS.CM` | `T-AS.CM-01` | `I-NT` | `I-NT&T-AS.CM-01` 网络安全基线配置管理 | `ASSESSMENT_POINT` | `ARS-003` | `MAPPED_BY_CURRENT_FOCUS` |
| `T-AS.CM` | `T-AS.CM-01` | `I-OS` | `I-OS&T-AS.CM-01` 主机/终端安全基线配置管理 | `ASSESSMENT_POINT` | `ARS-003` | `MAPPED_BY_CURRENT_FOCUS` |
| `T-AS.CM` | `T-AS.CM-02` | `I-AP` | `I-AP&T-AS.CM-02` 应用安全加固 | `ASSESSMENT_POINT` | `ARS-003` | `MAPPED_BY_CURRENT_FOCUS` |
| `T-AS.CM` | `T-AS.CM-02` | `I-HD` | `I-HD&T-AS.CM-02` 硬件安全加固 | `ASSESSMENT_POINT` | `ARS-003` | `MAPPED_BY_CURRENT_FOCUS` |
| `T-AS.CM` | `T-AS.CM-02` | `I-OS` | `I-OS&T-AS.CM-02` 主机/终端安全加固 | `ASSESSMENT_POINT` | `ARS-003` | `MAPPED_BY_CURRENT_FOCUS` |
| `T-AS.VM` | `T-AS.VM-01` | `I-AP` | `I-AP&T-AS.VM-01` 应用漏洞管理 | `ASSESSMENT_POINT` | `ARS-004` | `MAPPED_BY_CURRENT_FOCUS` |
| `T-AS.VM` | `T-AS.VM-01` | `I-HD` | `I-HD&T-AS.VM-01` 固件漏洞管理 | `ASSESSMENT_POINT` | `ARS-004` | `MAPPED_BY_CURRENT_FOCUS` |
| `T-AS.VM` | `T-AS.VM-01` | `I-OS` | `I-OS&T-AS.VM-01` 主机/终端漏洞管理 | `ASSESSMENT_POINT` | `ARS-004` | `MAPPED_BY_CURRENT_FOCUS` |
| `T-AS.VM` | `T-AS.VM-02` | `I-AP` | `I-AP&T-AS.VM-02` 应用补丁管理 | `ASSESSMENT_POINT` | `ARS-004` | `MAPPED_BY_CURRENT_FOCUS` |
| `T-AS.VM` | `T-AS.VM-02` | `I-HD` | `I-HD&T-AS.VM-02` 固件补丁管理 | `ASSESSMENT_POINT` | `ARS-004` | `MAPPED_BY_CURRENT_FOCUS` |
| `T-AS.VM` | `T-AS.VM-02` | `I-OS` | `I-OS&T-AS.VM-02` 主机/终端补丁管理 | `ASSESSMENT_POINT` | `ARS-004` | `MAPPED_BY_CURRENT_FOCUS` |
| `T-AS.IA` | `T-AS.IA-01` | `I-AP` | `I-AP&T-AS.IA-01` 应用身份管理 | `ASSESSMENT_POINT` | `ARS-005` | `MAPPED_BY_CURRENT_FOCUS` |
| `T-AS.IA` | `T-AS.IA-01` | `I-HD` | `I-HD&T-AS.IA-01` 设备身份管理 | `ASSESSMENT_POINT` | `ARS-005` | `MAPPED_BY_CURRENT_FOCUS` |
| `T-AS.IA` | `T-AS.IA-01` | `I-OS` | `I-OS&T-AS.IA-01` 主机/终端身份管理 | `ASSESSMENT_POINT` | `ARS-005` | `MAPPED_BY_CURRENT_FOCUS` |
| `T-AS.IA` | `T-AS.IA-01` | `I-US` | `I-US&T-AS.IA-01` 用户身份管理 | `ASSESSMENT_POINT` | `ARS-005` | `MAPPED_BY_CURRENT_FOCUS` |
| `T-AS.IA` | `T-AS.IA-02` | `I-AP` | `I-AP&T-AS.IA-02` 应用身份认证 | `ASSESSMENT_POINT` | `ARS-005` | `MAPPED_BY_CURRENT_FOCUS` |
| `T-AS.IA` | `T-AS.IA-02` | `I-HD` | `I-HD&T-AS.IA-02` 设备身份认证 | `ASSESSMENT_POINT` | `ARS-005` | `MAPPED_BY_CURRENT_FOCUS` |
| `T-AS.IA` | `T-AS.IA-02` | `I-PE` | `I-PE&T-AS.IA-02` 物理环境身份认证 | `ASSESSMENT_POINT` | `ARS-005` | `MAPPED_BY_CURRENT_FOCUS` |
| `T-AS.IA` | `T-AS.IA-02` | `I-US` | `I-US&T-AS.IA-02` 用户认证 | `ASSESSMENT_POINT` | `ARS-005` | `MAPPED_BY_CURRENT_FOCUS` |
| `T-AS.IA` | `T-AS.IA-03` | `I-AP` | `I-AP&T-AS.IA-03` 应用资源授权 | `ASSESSMENT_POINT` | `ARS-005` | `MAPPED_BY_CURRENT_FOCUS` |
| `T-AS.IA` | `T-AS.IA-03` | `I-DI` | `I-DI&T-AS.IA-03` 数据资源授权 | `ASSESSMENT_POINT` | `ARS-005` | `MAPPED_BY_CURRENT_FOCUS` |
| `T-AS.IA` | `T-AS.IA-03` | `I-HD` | `I-HD&T-AS.IA-03` 硬件资源授权 | `ASSESSMENT_POINT` | `ARS-005` | `MAPPED_BY_CURRENT_FOCUS` |
| `T-AS.IA` | `T-AS.IA-03` | `I-NT` | `I-NT&T-AS.IA-03` 网络资源授权 | `ASSESSMENT_POINT` | `ARS-005` | `MAPPED_BY_CURRENT_FOCUS` |
| `T-AS.IA` | `T-AS.IA-03` | `I-OS` | `I-OS&T-AS.IA-03` 操作系统资源授权 | `ASSESSMENT_POINT` | `ARS-005` | `MAPPED_BY_CURRENT_FOCUS` |
| `T-AS.IA` | `T-AS.IA-03` | `I-PE` | `I-PE&T-AS.IA-03` 物理环境授权 | `ASSESSMENT_POINT` | `ARS-005` | `MAPPED_BY_CURRENT_FOCUS` |
| `T-AS.IA` | `T-AS.IA-04` | `I-AP` | `I-AP&T-AS.IA-04` 应用凭证管理 | `ASSESSMENT_POINT` | `ARS-005` | `MAPPED_BY_CURRENT_FOCUS` |
| `T-AS.IA` | `T-AS.IA-04` | `I-HD` | `I-HD&T-AS.IA-04` 硬件凭证管理 | `ASSESSMENT_POINT` | `ARS-005` | `MAPPED_BY_CURRENT_FOCUS` |
| `T-AS.IA` | `T-AS.IA-04` | `I-OS` | `I-OS&T-AS.IA-04` 操作系统凭证管理 | `ASSESSMENT_POINT` | `ARS-005` | `MAPPED_BY_CURRENT_FOCUS` |
| `T-AS.IA` | `T-AS.IA-04` | `I-US` | `I-US&T-AS.IA-04` 用户凭证管理 | `ASSESSMENT_POINT` | `ARS-005` | `MAPPED_BY_CURRENT_FOCUS` |
| `T-AS.DS` | `T-AS.DS-01` | `I-AP` | `I-AP&T-AS.DS-01` 软件威胁建模 | `ASSESSMENT_POINT` | `ARS-006` | `MAPPED_BY_CURRENT_FOCUS` |
| `T-AS.DS` | `T-AS.DS-02` | `I-AP` | `I-AP&T-AS.DS-02` 代码安全检测 | `ASSESSMENT_POINT` | `ARS-006` | `MAPPED_BY_CURRENT_FOCUS` |
| `T-AS.DS` | `T-AS.DS-03` | `I-AP` | `I-AP&T-AS.DS-03` 组件安全管理 | `ASSESSMENT_POINT` | `ARS-006` | `MAPPED_BY_CURRENT_FOCUS` |
| `T-AS.DS` | `T-AS.DS-04` | `I-AP` | `I-AP&T-AS.DS-04` 制品安全管理 | `ASSESSMENT_POINT` | `ARS-006` | `MAPPED_BY_CURRENT_FOCUS` |
| `T-AS.DS` | `T-AS.DS-05` | `I-AP` | `I-AP&T-AS.DS-05` 软件安全测试 | `ASSESSMENT_POINT` | `ARS-006` | `MAPPED_BY_CURRENT_FOCUS` |
| `T-AS.DS` | `T-AS.DS-06` | `I-AP` | `I-AP&T-AS.DS-06` 安全组件和函数管理 | `ASSESSMENT_POINT` | — | `BLOCKED_FOCUS_UNMAPPED` |
| `T-AS.LA` | `T-AS.LA-01` | `I-AP` | `I-AP&T-AS.LA-01` 应用日志记录 | `ASSESSMENT_POINT` | `ARS-007` | `MAPPED_BY_CURRENT_FOCUS` |
| `T-AS.LA` | `T-AS.LA-01` | `I-HD` | `I-HD&T-AS.LA-01` 固件日志记录 | `ASSESSMENT_POINT` | `ARS-007` | `MAPPED_BY_CURRENT_FOCUS` |
| `T-AS.LA` | `T-AS.LA-01` | `I-NT` | `I-NT&T-AS.LA-01` 网络设备日志记录 | `ASSESSMENT_POINT` | `ARS-007` | `MAPPED_BY_CURRENT_FOCUS` |
| `T-AS.LA` | `T-AS.LA-01` | `I-OS` | `I-OS&T-AS.LA-01` 操作系统日志记录 | `ASSESSMENT_POINT` | `ARS-007` | `MAPPED_BY_CURRENT_FOCUS` |
| `T-AS.LA` | `T-AS.LA-02` | `I-AP` | `I-AP&T-AS.LA-02` 应用日志存储 | `ASSESSMENT_POINT` | `ARS-007` | `MAPPED_BY_CURRENT_FOCUS` |
| `T-AS.LA` | `T-AS.LA-02` | `I-HD` | `I-HD&T-AS.LA-02` 固件日志存储 | `ASSESSMENT_POINT` | `ARS-007` | `MAPPED_BY_CURRENT_FOCUS` |
| `T-AS.LA` | `T-AS.LA-02` | `I-NT` | `I-NT&T-AS.LA-02` 网络设备日志存储 | `ASSESSMENT_POINT` | `ARS-007` | `MAPPED_BY_CURRENT_FOCUS` |
| `T-AS.LA` | `T-AS.LA-02` | `I-OS` | `I-OS&T-AS.LA-02` 操作系统日志存储 | `ASSESSMENT_POINT` | `ARS-007` | `MAPPED_BY_CURRENT_FOCUS` |
| `T-AS.LA` | `T-AS.LA-02` | `I-US` | `I-US&T-AS.LA-02` 身份、凭证与访问管理日志记录 | `ASSESSMENT_POINT` | `ARS-007` | `MAPPED_BY_CURRENT_FOCUS` |
| `T-AS.LA` | `T-AS.LA-03` | `I-AP` | `I-AP&T-AS.LA-03` 应用操作审计 | `ASSESSMENT_POINT` | `ARS-007` | `MAPPED_BY_CURRENT_FOCUS` |
| `T-AS.LA` | `T-AS.LA-03` | `I-DI` | `I-DI&T-AS.LA-03` 数据访问和操作审计 | `ASSESSMENT_POINT` | `ARS-007` | `MAPPED_BY_CURRENT_FOCUS` |
| `T-AS.LA` | `T-AS.LA-03` | `I-HD` | `I-HD&T-AS.LA-03` 硬件操作审计 | `ASSESSMENT_POINT` | `ARS-007` | `MAPPED_BY_CURRENT_FOCUS` |
| `T-AS.LA` | `T-AS.LA-03` | `I-NT` | `I-NT&T-AS.LA-03` 网络流量（行为）日志审计 | `ASSESSMENT_POINT` | `ARS-007` | `MAPPED_BY_CURRENT_FOCUS` |
| `T-AS.LA` | `T-AS.LA-03` | `I-OS` | `I-OS&T-AS.LA-03` 操作系统操作审计 | `ASSESSMENT_POINT` | `ARS-007` | `MAPPED_BY_CURRENT_FOCUS` |
| `T-AS.LA` | `T-AS.LA-03` | `I-US` | `I-US&T-AS.LA-03` 用户行为审计 | `ASSESSMENT_POINT` | `ARS-007` | `MAPPED_BY_CURRENT_FOCUS` |
| `T-AS.CG` | `T-AS.CG-01` | `I-AP` | `I-AP&T-AS.CG-01` 应用层数据加解密 | `ASSESSMENT_POINT` | `ARS-008` | `REVIEW_FOCUS_IDENTITY` |
| `T-AS.CG` | `T-AS.CG-01` | `I-DI` | `I-DI&T-AS.CG-01` 数据内容加解密 | `ASSESSMENT_POINT` | `ARS-008` | `REVIEW_FOCUS_IDENTITY` |
| `T-AS.CG` | `T-AS.CG-01` | `I-HD` | `I-HD&T-AS.CG-01` 固件加解密 | `ASSESSMENT_POINT` | `ARS-008` | `REVIEW_FOCUS_IDENTITY` |
| `T-AS.CG` | `T-AS.CG-01` | `I-NT` | `I-NT&T-AS.CG-01` 网络传输通道加解密 | `ASSESSMENT_POINT` | `ARS-008` | `REVIEW_FOCUS_IDENTITY` |
| `T-AS.CG` | `T-AS.CG-01` | `I-OS` | `I-OS&T-AS.CG-01` 操作系统加解密 | `ASSESSMENT_POINT` | `ARS-008` | `REVIEW_FOCUS_IDENTITY` |
| `T-AS.CG` | `T-AS.CG-02` | `I-AP` | `I-AP&T-AS.CG-02` 应用程序完整性校验（含操作签名验签） | `ASSESSMENT_POINT` | `ARS-008` | `REVIEW_FOCUS_IDENTITY` |
| `T-AS.CG` | `T-AS.CG-02` | `I-DI` | `I-DI&T-AS.CG-02` 数据完整性校验（签名验签） | `ASSESSMENT_POINT` | `ARS-008` | `REVIEW_FOCUS_IDENTITY` |
| `T-AS.CG` | `T-AS.CG-02` | `I-HD` | `I-HD&T-AS.CG-02` 固件签名 | `ASSESSMENT_POINT` | `ARS-008` | `REVIEW_FOCUS_IDENTITY` |
| `T-AS.CG` | `T-AS.CG-02` | `I-OS` | `I-OS&T-AS.CG-02` 操作系统文件完整性校验 | `ASSESSMENT_POINT` | `ARS-008` | `REVIEW_FOCUS_IDENTITY` |
| `T-AS.DG` | `T-AS.DG-01` | `I-DI` | `I-DI&T-AS.DG-01` 数据分类分级 | `ASSESSMENT_POINT` | `ARS-009` | `MAPPED_BY_CURRENT_FOCUS` |
| `T-AS.DG` | `T-AS.DG-02` | `I-DI` | `I-DI&T-AS.DG-02` 数据安全策略管控 | `ASSESSMENT_POINT` | `ARS-009` | `MAPPED_BY_CURRENT_FOCUS` |
| `T-AS.DG` | `T-AS.DG-03` | `I-DI` | `I-DI&T-AS.DG-03` 数据备份 | `ASSESSMENT_POINT` | — | `BLOCKED_FOCUS_UNMAPPED` |
| `T-PD.PP` | `T-PD.PP-01` | `I-AP` | `I-AP&T-PD.PP-01` 应用安全访问 | `ASSESSMENT_POINT` | `ARS-010` | `MAPPED_BY_CURRENT_FOCUS` |
| `T-PD.PP` | `T-PD.PP-01` | `I-DI` | `I-DI&T-PD.PP-01` 数据安全访问 | `ASSESSMENT_POINT` | `ARS-010` | `MAPPED_BY_CURRENT_FOCUS` |
| `T-PD.PP` | `T-PD.PP-01` | `I-NT` | `I-NT&T-PD.PP-01` 网络安全接入 | `ASSESSMENT_POINT` | `ARS-010` | `MAPPED_BY_CURRENT_FOCUS` |
| `T-PD.PP` | `T-PD.PP-01` | `I-PE` | `I-PE&T-PD.PP-01` 物理环境安全访问 | `ASSESSMENT_POINT` | `ARS-010` | `MAPPED_BY_CURRENT_FOCUS` |
| `T-PD.PP` | `T-PD.PP-02` | `I-NT` | `I-NT&T-PD.PP-02` 网络异常流量检测与迁移 | `ASSESSMENT_POINT` | `ARS-010` | `MAPPED_BY_CURRENT_FOCUS` |
| `T-PD.PP` | `T-PD.PP-03` | `I-AP` | `I-AP&T-PD.PP-03` 应用隔离 | `ASSESSMENT_POINT` | `ARS-010` | `MAPPED_BY_CURRENT_FOCUS` |
| `T-PD.PP` | `T-PD.PP-03` | `I-DI` | `I-DI&T-PD.PP-03` 数据隔离 | `ASSESSMENT_POINT` | `ARS-010` | `MAPPED_BY_CURRENT_FOCUS` |
| `T-PD.PP` | `T-PD.PP-03` | `I-HD` | `I-HD&T-PD.PP-03` 硬件隔离 | `ASSESSMENT_POINT` | `ARS-010` | `MAPPED_BY_CURRENT_FOCUS` |
| `T-PD.PP` | `T-PD.PP-03` | `I-NT` | `I-NT&T-PD.PP-03` 网络隔离 | `ASSESSMENT_POINT` | `ARS-010` | `MAPPED_BY_CURRENT_FOCUS` |
| `T-PD.PP` | `T-PD.PP-03` | `I-OS` | `I-OS&T-PD.PP-03` 操作系统隔离 | `ASSESSMENT_POINT` | `ARS-010` | `MAPPED_BY_CURRENT_FOCUS` |
| `T-PD.AC` | `T-PD.AC-01` | `I-AP` | `I-AP&T-PD.AC-01` 应用访问控制 | `ASSESSMENT_POINT` | `ARS-011` | `MAPPED_BY_CURRENT_FOCUS` |
| `T-PD.AC` | `T-PD.AC-01` | `I-HD` | `I-HD&T-PD.AC-01` 设备访问控制 | `ASSESSMENT_POINT` | `ARS-011` | `MAPPED_BY_CURRENT_FOCUS` |
| `T-PD.AC` | `T-PD.AC-01` | `I-NT` | `I-NT&T-PD.AC-01` 网络访问控制 | `ASSESSMENT_POINT` | `ARS-011` | `MAPPED_BY_CURRENT_FOCUS` |
| `T-PD.AC` | `T-PD.AC-01` | `I-OS` | `I-OS&T-PD.AC-01` 操作系统访问控制 | `ASSESSMENT_POINT` | `ARS-011` | `MAPPED_BY_CURRENT_FOCUS` |
| `T-PD.AC` | `T-PD.AC-02` | `I-AP` | `I-AP&T-PD.AC-02` 应用软件信誉评估 | `ASSESSMENT_POINT` | `ARS-011` | `MAPPED_BY_CURRENT_FOCUS` |
| `T-PD.AC` | `T-PD.AC-02` | `I-OS` | `I-OS&T-PD.AC-02` 主机/终端信誉评估 | `ASSESSMENT_POINT` | `ARS-011` | `MAPPED_BY_CURRENT_FOCUS` |
| `T-PD.AC` | `T-PD.AC-02` | `I-US` | `I-US&T-PD.AC-02` 用户信誉评估 | `ASSESSMENT_POINT` | `ARS-011` | `MAPPED_BY_CURRENT_FOCUS` |
| `T-PD.TP` | `T-PD.TP-01` | `I-NT` | `I-NT&T-PD.TP-01` 网络恶意代码防护 | `ASSESSMENT_POINT` | `ARS-012` | `MAPPED_BY_CURRENT_FOCUS` |
| `T-PD.TP` | `T-PD.TP-01` | `I-OS` | `I-OS&T-PD.TP-01` 操作系统恶意代码防护 | `ASSESSMENT_POINT` | `ARS-012` | `MAPPED_BY_CURRENT_FOCUS` |
| `T-PD.TP` | `T-PD.TP-02` | `I-AP` | `I-AP&T-PD.TP-02` 应用异常特征检测（API、Web应用） | `ASSESSMENT_POINT` | `ARS-012` | `MAPPED_BY_CURRENT_FOCUS` |
| `T-PD.TP` | `T-PD.TP-02` | `I-NT` | `I-NT&T-PD.TP-02` 网络流量特征检测 | `ASSESSMENT_POINT` | `ARS-012` | `MAPPED_BY_CURRENT_FOCUS` |
| `T-PD.TP` | `T-PD.TP-02` | `I-OS` | `I-OS&T-PD.TP-02` 操作系统异常特征检测 | `ASSESSMENT_POINT` | `ARS-012` | `MAPPED_BY_CURRENT_FOCUS` |
| `T-PD.TP` | `T-PD.TP-03` | `I-AP` | `I-AP&T-PD.TP-03` 应用攻击入侵防御 | `ASSESSMENT_POINT` | `ARS-012` | `MAPPED_BY_CURRENT_FOCUS` |
| `T-PD.TP` | `T-PD.TP-03` | `I-NT` | `I-NT&T-PD.TP-03` 网络攻击入侵防御 | `ASSESSMENT_POINT` | `ARS-012` | `MAPPED_BY_CURRENT_FOCUS` |
| `T-PD.TP` | `T-PD.TP-03` | `I-OS` | `I-OS&T-PD.TP-03` 操作系统攻击入侵防御 | `ASSESSMENT_POINT` | `ARS-012` | `MAPPED_BY_CURRENT_FOCUS` |
| `T-PD.TP` | `T-PD.TP-04` | `I-NT` | `I-NT&T-PD.TP-04` 网络流量识别与收集 | `ASSESSMENT_POINT` | `ARS-012` | `MAPPED_BY_CURRENT_FOCUS` |
| `T-PD.TP` | `T-PD.TP-05` | `I-AP` | `I-AP&T-PD.TP-05` 应用程序白名单 | `ASSESSMENT_POINT` | — | `BLOCKED_FOCUS_UNMAPPED` |
| `T-PD.TP` | `T-PD.TP-05` | `I-OS` | `I-OS&T-PD.TP-05` 操作系统进程白名单 | `ASSESSMENT_POINT` | — | `BLOCKED_FOCUS_UNMAPPED` |
| `T-PD.DP` | `T-PD.DP-01` | `I-AP` | `I-AP&T-PD.DP-01` 应用页面水印 | `ASSESSMENT_POINT` | `ARS-013` | `MAPPED_BY_CURRENT_FOCUS` |
| `T-PD.DP` | `T-PD.DP-01` | `I-DI` | `I-DI&T-PD.DP-01` 数据内容水印 | `ASSESSMENT_POINT` | `ARS-013` | `MAPPED_BY_CURRENT_FOCUS` |
| `T-PD.DP` | `T-PD.DP-01` | `I-OS` | `I-OS&T-PD.DP-01` 操作系统屏幕水印 | `ASSESSMENT_POINT` | `ARS-013` | `MAPPED_BY_CURRENT_FOCUS` |
| `T-PD.DP` | `T-PD.DP-02` | `I-AP` | `I-AP&T-PD.DP-02` 应用动态数据脱敏 | `ASSESSMENT_POINT` | `ARS-013` | `MAPPED_BY_CURRENT_FOCUS` |
| `T-PD.DP` | `T-PD.DP-02` | `I-DI` | `I-DI&T-PD.DP-02` 静态数据脱敏 | `ASSESSMENT_POINT` | `ARS-013` | `MAPPED_BY_CURRENT_FOCUS` |
| `T-PD.DP` | `T-PD.DP-02` | `I-NT` | `I-NT&T-PD.DP-02` 网络动态数据脱敏 | `ASSESSMENT_POINT` | `ARS-013` | `MAPPED_BY_CURRENT_FOCUS` |
| `T-PD.DP` | `T-PD.DP-03` | `I-NT` | `I-NT&T-PD.DP-03` 网络数据防泄漏 | `ASSESSMENT_POINT` | `ARS-013` | `MAPPED_BY_CURRENT_FOCUS` |
| `T-PD.DP` | `T-PD.DP-03` | `I-OS` | `I-OS&T-PD.DP-03` 操作系统数据防泄漏 | `ASSESSMENT_POINT` | `ARS-013` | `MAPPED_BY_CURRENT_FOCUS` |
| `T-PD.DP` | `T-PD.DP-04` | `I-DI` | `I-DI&T-PD.DP-04` 数据访问鉴权 | `ASSESSMENT_POINT` | `ARS-013` | `MAPPED_BY_CURRENT_FOCUS` |
| `T-PD.DP` | `T-PD.DP-05` | `I-DI` | `I-DI&T-PD.DP-05` 数据流转监测 | `ASSESSMENT_POINT` | `ARS-013` | `MAPPED_BY_CURRENT_FOCUS` |
| `T-PD.DP` | `T-PD.DP-06` | `I-DI` | `I-DI&T-PD.DP-06` 数据销毁 | `ASSESSMENT_POINT` | `ARS-013` | `MAPPED_BY_CURRENT_FOCUS` |
| `T-PD.DP` | `T-PD.DP-07` | `I-DI` | `I-DI&T-PD.DP-07` 隐私数据检测 | `ASSESSMENT_POINT` | `ARS-013` | `MAPPED_BY_CURRENT_FOCUS` |
| `T-AD.SA` | `T-AD.SA-01` | `I-AP` | `I-AP&T-AD.SA-01` 应用异常行为检测 | `ASSESSMENT_POINT` | `ARS-014` | `MAPPED_BY_CURRENT_FOCUS` |
| `T-AD.SA` | `T-AD.SA-01` | `I-NT` | `I-NT&T-AD.SA-01` 网络高级威胁检测（启发式、行为式） | `ASSESSMENT_POINT` | `ARS-014` | `MAPPED_BY_CURRENT_FOCUS` |
| `T-AD.SA` | `T-AD.SA-01` | `I-OS` | `I-OS&T-AD.SA-01` 操作系统异常行为检测 | `ASSESSMENT_POINT` | `ARS-014` | `MAPPED_BY_CURRENT_FOCUS` |
| `T-AD.SA` | `T-AD.SA-01` | `I-US` | `I-US&T-AD.SA-01` 用户高级威胁检测（行为式） | `ASSESSMENT_POINT` | `ARS-014` | `MAPPED_BY_CURRENT_FOCUS` |
| `T-AD.SA` | `T-AD.SA-02` | `ALL` | `ALL&T-AD.SA-02` 安全告警监测 | `ASSESSMENT_POINT` | `ARS-014` | `MAPPED_BY_CURRENT_FOCUS` |
| `T-AD.SA` | `T-AD.SA-03` | `ALL` | `ALL&T-AD.SA-03` 态势感知 | `ASSESSMENT_POINT` | `ARS-014` | `MAPPED_BY_CURRENT_FOCUS` |
| `T-AD.IR` | `T-AD.IR-01` | `ALL` | `ALL&T-AD.IR-01` 安全事件分析 | `ASSESSMENT_POINT` | `ARS-015` | `MAPPED_BY_CURRENT_FOCUS` |
| `T-AD.IR` | `T-AD.IR-02` | `ALL` | `ALL&T-AD.IR-02` 安全事件管理 | `ASSESSMENT_POINT` | `ARS-015` | `MAPPED_BY_CURRENT_FOCUS` |
| `T-AD.IR` | `T-AD.IR-03` | `ALL` | `ALL&T-AD.IR-03` 安全响应处置 | `ASSESSMENT_POINT` | `ARS-015` | `MAPPED_BY_CURRENT_FOCUS` |
| `T-AD.IR` | `T-AD.IR-04` | `ALL` | `ALL&T-AD.IR-04` 恢复 | `ASSESSMENT_POINT` | `ARS-015` | `MAPPED_BY_CURRENT_FOCUS` |
| `T-AD.IR` | `T-AD.IR-05` | `I-AP` | `I-AP&T-AD.IR-05` 应用调查取证 | `ASSESSMENT_POINT` | `ARS-015` | `MAPPED_BY_CURRENT_FOCUS` |
| `T-AD.IR` | `T-AD.IR-05` | `I-DI` | `I-DI&T-AD.IR-05` 数据调查取证 | `ASSESSMENT_POINT` | `ARS-015` | `MAPPED_BY_CURRENT_FOCUS` |
| `T-AD.IR` | `T-AD.IR-05` | `I-NT` | `I-NT&T-AD.IR-05` 网络调查取证 | `ASSESSMENT_POINT` | `ARS-015` | `MAPPED_BY_CURRENT_FOCUS` |
| `T-AD.IR` | `T-AD.IR-05` | `I-OS` | `I-OS&T-AD.IR-05` 操作系统调查取证 | `ASSESSMENT_POINT` | `ARS-015` | `MAPPED_BY_CURRENT_FOCUS` |
| `T-AD.IR` | `T-AD.IR-06` | `I-AP` | `I-AP&T-AD.IR-06` 应用仿真 | `ASSESSMENT_POINT` | `ARS-015` | `MAPPED_BY_CURRENT_FOCUS` |
| `T-AD.IR` | `T-AD.IR-06` | `I-DI` | `I-DI&T-AD.IR-06` 诱饵数据 | `ASSESSMENT_POINT` | `ARS-015` | `MAPPED_BY_CURRENT_FOCUS` |
| `T-AD.IR` | `T-AD.IR-06` | `I-NT` | `I-NT&T-AD.IR-06` 网络仿真 | `ASSESSMENT_POINT` | `ARS-015` | `MAPPED_BY_CURRENT_FOCUS` |
| `T-AD.IR` | `T-AD.IR-06` | `I-OS` | `I-OS&T-AD.IR-06` 系统仿真 | `ASSESSMENT_POINT` | `ARS-015` | `MAPPED_BY_CURRENT_FOCUS` |
| `T-AD.IR` | `T-AD.IR-06` | `I-US` | `I-US&T-AD.IR-06` 诱饵账号 | `ASSESSMENT_POINT` | `ARS-015` | `MAPPED_BY_CURRENT_FOCUS` |
| `T-AD.SV` | `T-AD.SV-01` | `I-AP` | `I-AP&T-AD.SV-01` 应用安全策略管理 | `ASSESSMENT_POINT` | `ARS-016` | `REVIEW_FOCUS_IDENTITY` |
| `T-AD.SV` | `T-AD.SV-01` | `I-NT` | `I-NT&T-AD.SV-01` 网络安全策略管理 | `ASSESSMENT_POINT` | `ARS-016` | `REVIEW_FOCUS_IDENTITY` |
| `T-AD.SV` | `T-AD.SV-01` | `I-OS` | `I-OS&T-AD.SV-01` 主机/终端安全策略管理 | `ASSESSMENT_POINT` | `ARS-016` | `REVIEW_FOCUS_IDENTITY` |
| `T-AD.SV` | `T-AD.SV-02` | `ALL` | `ALL&T-AD.SV-02` 策略有效性验证 | `ASSESSMENT_POINT` | `ARS-016` | `REVIEW_FOCUS_IDENTITY` |
| `T-AD.SV` | `T-AD.SV-03` | `ALL` | `ALL&T-AD.SV-03` 攻防模拟 | `ASSESSMENT_POINT` | — | `BLOCKED_FOCUS_UNMAPPED` |
| `T-IN.IO` | `T-IN.IO-01` | `ALL` | `ALL&T-IN.IO-01` 威胁情报源 | `ASSESSMENT_POINT` | `ARS-017` | `MAPPED_BY_CURRENT_FOCUS` |
| `T-IN.IO` | `T-IN.IO-02` | `ALL` | `ALL&T-IN.IO-02` 威胁情报治理 | `ASSESSMENT_POINT` | `ARS-017` | `MAPPED_BY_CURRENT_FOCUS` |
| `T-IN.IO` | `T-IN.IO-03` | `ALL` | `ALL&T-IN.IO-03` 威胁情报分发 | `ASSESSMENT_POINT` | `ARS-017` | `MAPPED_BY_CURRENT_FOCUS` |
| `T-IN.IP` | `T-IN.IP-01` | `ALL` | `ALL&T-IN.IP-01` 威胁情报生产 | `ASSESSMENT_POINT` | `ARS-018` | `MAPPED_BY_CURRENT_FOCUS` |
| `M-PM.PR` | `M-PM.PR-01` | `I-US` | `M-PM.PR-00` 网络安全项目管理 | `PLATFORM_EVIDENCE_REFERENCE` | `ARS-022` | `MAPPED_BY_CURRENT_FOCUS` |
| `M-SA.RM` | `M-SA.RM-01` | `I-US` | `M-SA.RM-00` 网络安全风险管理 | `PLATFORM_EVIDENCE_REFERENCE` | `ARS-024` | `MAPPED_BY_CURRENT_FOCUS` |
| `M-SA.RE` | `M-SA.RE-01` | `I-US` | `M-SA.RE-00` 网络安全合规管理 | `PLATFORM_EVIDENCE_REFERENCE` | `ARS-025` | `MAPPED_BY_CURRENT_FOCUS` |
| `M-SA.CO` | `M-SA.CO-01` | `I-US` | `M-SA.CO-00` 网络安全指挥调度 | `PLATFORM_EVIDENCE_REFERENCE` | `ARS-028` | `MAPPED_BY_CURRENT_FOCUS` |
| `M-SE.PE` | `M-SE.PE-01` | `I-US` | `M-SE.PE-00` 网络安全考核管理 | `PLATFORM_EVIDENCE_REFERENCE` | `ARS-030` | `MAPPED_BY_CURRENT_FOCUS` |
| `M-PS.CT` | `M-PS.CT-01` | `I-US` | `M-PS.CT-00` 网络安全学习管理 | `PLATFORM_EVIDENCE_REFERENCE` | `ARS-032` | `MAPPED_BY_CURRENT_FOCUS` |

</details>

## 9. 185 个当前评估点映射

<details>
<summary>展开完整评估点映射</summary>

| L2 | 关注点 | 评估粒度 | 作用域 | 当前安全技术服务 | rubric set | 状态 |
|---|---|---|---|---|---|---|
| `T-AS.AD` | `T-AS.AD-01` 遵循安全设计原则对网络安全架构进行设计和管控 | `SERVICE` | `I-AP` | `I-AP&T-AS.AD-01` 应用架构管控 | `ARS-001` | `REVIEW_FOCUS_IDENTITY` |
| `T-AS.AD` | `T-AS.AD-01` 遵循安全设计原则对网络安全架构进行设计和管控 | `SERVICE` | `I-DI` | `I-DI&T-AS.AD-01` 数据分库分表 | `ARS-001` | `REVIEW_FOCUS_IDENTITY` |
| `T-AS.AD` | `T-AS.AD-01` 遵循安全设计原则对网络安全架构进行设计和管控 | `SERVICE` | `I-HD` | `I-HD&T-AS.AD-01` 计算与存储分离 | `ARS-001` | `REVIEW_FOCUS_IDENTITY` |
| `T-AS.AD` | `T-AS.AD-01` 遵循安全设计原则对网络安全架构进行设计和管控 | `SERVICE` | `I-NT` | `I-NT&T-AS.AD-01` 网络平面及区域划分 | `ARS-001` | `REVIEW_FOCUS_IDENTITY` |
| `T-AS.AD` | `T-AS.AD-01` 遵循安全设计原则对网络安全架构进行设计和管控 | `SERVICE` | `I-OS` | `I-OS&T-AS.AD-01` 主机/终端安全工作区划分 | `ARS-001` | `REVIEW_FOCUS_IDENTITY` |
| `T-AS.AD` | `T-AS.AD-01` 遵循安全设计原则对网络安全架构进行设计和管控 | `SERVICE` | `I-PE` | `I-PE&T-AS.AD-01` 物理区域分区 | `ARS-001` | `REVIEW_FOCUS_IDENTITY` |
| `T-AS.AD` | `T-AS.AD-02` 实施网络安全架构的冗余设计 | `SERVICE` | `I-AP` | `I-AP&T-AS.AD-02` 应用冗余 | `ARS-001` | `REVIEW_FOCUS_IDENTITY` |
| `T-AS.AD` | `T-AS.AD-02` 实施网络安全架构的冗余设计 | `SERVICE` | `I-DI` | `I-DI&T-AS.AD-02` 冗余存储 | `ARS-001` | `REVIEW_FOCUS_IDENTITY` |
| `T-AS.AD` | `T-AS.AD-02` 实施网络安全架构的冗余设计 | `SERVICE` | `I-HD` | `I-HD&T-AS.AD-02` 设备冗余 | `ARS-001` | `REVIEW_FOCUS_IDENTITY` |
| `T-AS.AD` | `T-AS.AD-02` 实施网络安全架构的冗余设计 | `SERVICE` | `I-NT` | `I-NT&T-AS.AD-02` 网络冗余 | `ARS-001` | `REVIEW_FOCUS_IDENTITY` |
| `T-AS.AD` | `T-AS.AD-02` 实施网络安全架构的冗余设计 | `SERVICE` | `I-OS` | `I-OS&T-AS.AD-02` 主机/终端冗余 | `ARS-001` | `REVIEW_FOCUS_IDENTITY` |
| `T-AS.AD` | `T-AS.AD-02` 实施网络安全架构的冗余设计 | `SERVICE` | `I-PE` | `I-PE&T-AS.AD-02` 物理环境冗余 | `ARS-001` | `REVIEW_FOCUS_IDENTITY` |
| `T-AS.AD` | `T-AS.AD-03` 确保系统、应用的可靠性与可恢复性 | `SERVICE` | `I-AP` | `I-AP&T-AS.AD-03` 应用备份 | `ARS-001` | `REVIEW_FOCUS_IDENTITY` |
| `T-AS.AD` | `T-AS.AD-03` 确保系统、应用的可靠性与可恢复性 | `SERVICE` | `I-OS` | `I-OS&T-AS.AD-03` 操作系统备份 | `ARS-001` | `REVIEW_FOCUS_IDENTITY` |
| `T-AS.AM` | `T-AS.AM-01` 监测和持续管理组织的动态资产清单（IT&OT） | `SERVICE` | `I-AP` | `I-AP&T-AS.AM-01` 软件资产清单 | `ARS-002` | `MAPPED_BY_CURRENT_FOCUS` |
| `T-AS.AM` | `T-AS.AM-01` 监测和持续管理组织的动态资产清单（IT&OT） | `SERVICE` | `I-DI` | `I-DI&T-AS.AM-01` 数据资产清单 | `ARS-002` | `MAPPED_BY_CURRENT_FOCUS` |
| `T-AS.AM` | `T-AS.AM-01` 监测和持续管理组织的动态资产清单（IT&OT） | `SERVICE` | `I-HD` | `I-HD&T-AS.AM-01` 硬件资产清单 | `ARS-002` | `MAPPED_BY_CURRENT_FOCUS` |
| `T-AS.AM` | `T-AS.AM-01` 监测和持续管理组织的动态资产清单（IT&OT） | `SERVICE` | `I-NT` | `I-NT&T-AS.AM-01` 网络资产清单 | `ARS-002` | `MAPPED_BY_CURRENT_FOCUS` |
| `T-AS.AM` | `T-AS.AM-01` 监测和持续管理组织的动态资产清单（IT&OT） | `SERVICE` | `I-OS` | `I-OS&T-AS.AM-01` 主机/终端资产清单 | `ARS-002` | `MAPPED_BY_CURRENT_FOCUS` |
| `T-AS.AM` | `T-AS.AM-02` 实现主机、终端等信息化资产的安全管理 | `SERVICE` | `I-AP` | `I-AP&T-AS.AM-02` 软件资产安全管控 | — | `BLOCKED_FOCUS_UNMAPPED` |
| `T-AS.AM` | `T-AS.AM-02` 实现主机、终端等信息化资产的安全管理 | `SERVICE` | `I-NT` | `I-NT&T-AS.AM-02` 网络资产安全管控 | — | `BLOCKED_FOCUS_UNMAPPED` |
| `T-AS.AM` | `T-AS.AM-02` 实现主机、终端等信息化资产的安全管理 | `SERVICE` | `I-OS` | `I-OS&T-AS.AM-02` 主机/终端资产安全管控 | — | `BLOCKED_FOCUS_UNMAPPED` |
| `T-AS.CM` | `T-AS.CM-01` 持续管理和维护组织的安全配置基线集合 | `SERVICE` | `I-AP` | `I-AP&T-AS.CM-01` 应用安全基线配置管理 | `ARS-003` | `MAPPED_BY_CURRENT_FOCUS` |
| `T-AS.CM` | `T-AS.CM-01` 持续管理和维护组织的安全配置基线集合 | `SERVICE` | `I-HD` | `I-HD&T-AS.CM-01` 固件安全基线配置管理 | `ARS-003` | `MAPPED_BY_CURRENT_FOCUS` |
| `T-AS.CM` | `T-AS.CM-01` 持续管理和维护组织的安全配置基线集合 | `SERVICE` | `I-NT` | `I-NT&T-AS.CM-01` 网络安全基线配置管理 | `ARS-003` | `MAPPED_BY_CURRENT_FOCUS` |
| `T-AS.CM` | `T-AS.CM-01` 持续管理和维护组织的安全配置基线集合 | `SERVICE` | `I-OS` | `I-OS&T-AS.CM-01` 主机/终端安全基线配置管理 | `ARS-003` | `MAPPED_BY_CURRENT_FOCUS` |
| `T-AS.CM` | `T-AS.CM-02` 实施对信息化资产的安全加固 | `SERVICE` | `I-AP` | `I-AP&T-AS.CM-02` 应用安全加固 | `ARS-003` | `MAPPED_BY_CURRENT_FOCUS` |
| `T-AS.CM` | `T-AS.CM-02` 实施对信息化资产的安全加固 | `SERVICE` | `I-HD` | `I-HD&T-AS.CM-02` 硬件安全加固 | `ARS-003` | `MAPPED_BY_CURRENT_FOCUS` |
| `T-AS.CM` | `T-AS.CM-02` 实施对信息化资产的安全加固 | `SERVICE` | `I-OS` | `I-OS&T-AS.CM-02` 主机/终端安全加固 | `ARS-003` | `MAPPED_BY_CURRENT_FOCUS` |
| `T-AS.VM` | `T-AS.VM-01` 实施漏洞本地化管理以降低资产安全风险 | `SERVICE` | `I-AP` | `I-AP&T-AS.VM-01` 应用漏洞管理 | `ARS-004` | `MAPPED_BY_CURRENT_FOCUS` |
| `T-AS.VM` | `T-AS.VM-01` 实施漏洞本地化管理以降低资产安全风险 | `SERVICE` | `I-HD` | `I-HD&T-AS.VM-01` 固件漏洞管理 | `ARS-004` | `MAPPED_BY_CURRENT_FOCUS` |
| `T-AS.VM` | `T-AS.VM-01` 实施漏洞本地化管理以降低资产安全风险 | `SERVICE` | `I-OS` | `I-OS&T-AS.VM-01` 主机/终端漏洞管理 | `ARS-004` | `MAPPED_BY_CURRENT_FOCUS` |
| `T-AS.VM` | `T-AS.VM-02` 加强补丁信息的运营管理。 | `SERVICE` | `I-AP` | `I-AP&T-AS.VM-02` 应用补丁管理 | `ARS-004` | `MAPPED_BY_CURRENT_FOCUS` |
| `T-AS.VM` | `T-AS.VM-02` 加强补丁信息的运营管理。 | `SERVICE` | `I-HD` | `I-HD&T-AS.VM-02` 固件补丁管理 | `ARS-004` | `MAPPED_BY_CURRENT_FOCUS` |
| `T-AS.VM` | `T-AS.VM-02` 加强补丁信息的运营管理。 | `SERVICE` | `I-OS` | `I-OS&T-AS.VM-02` 主机/终端补丁管理 | `ARS-004` | `MAPPED_BY_CURRENT_FOCUS` |
| `T-AS.IA` | `T-AS.IA-01` 实现组织数字化身份的身份生命周期管理 | `SERVICE` | `I-AP` | `I-AP&T-AS.IA-01` 应用身份管理 | `ARS-005` | `MAPPED_BY_CURRENT_FOCUS` |
| `T-AS.IA` | `T-AS.IA-01` 实现组织数字化身份的身份生命周期管理 | `SERVICE` | `I-HD` | `I-HD&T-AS.IA-01` 设备身份管理 | `ARS-005` | `MAPPED_BY_CURRENT_FOCUS` |
| `T-AS.IA` | `T-AS.IA-01` 实现组织数字化身份的身份生命周期管理 | `SERVICE` | `I-OS` | `I-OS&T-AS.IA-01` 主机/终端身份管理 | `ARS-005` | `MAPPED_BY_CURRENT_FOCUS` |
| `T-AS.IA` | `T-AS.IA-01` 实现组织数字化身份的身份生命周期管理 | `SERVICE` | `I-US` | `I-US&T-AS.IA-01` 用户身份管理 | `ARS-005` | `MAPPED_BY_CURRENT_FOCUS` |
| `T-AS.IA` | `T-AS.IA-02` 针对不同访问主体执行满足安全需求的身份认证机制 | `SERVICE` | `I-AP` | `I-AP&T-AS.IA-02` 应用身份认证 | `ARS-005` | `MAPPED_BY_CURRENT_FOCUS` |
| `T-AS.IA` | `T-AS.IA-02` 针对不同访问主体执行满足安全需求的身份认证机制 | `SERVICE` | `I-HD` | `I-HD&T-AS.IA-02` 设备身份认证 | `ARS-005` | `MAPPED_BY_CURRENT_FOCUS` |
| `T-AS.IA` | `T-AS.IA-02` 针对不同访问主体执行满足安全需求的身份认证机制 | `SERVICE` | `I-PE` | `I-PE&T-AS.IA-02` 物理环境身份认证 | `ARS-005` | `MAPPED_BY_CURRENT_FOCUS` |
| `T-AS.IA` | `T-AS.IA-02` 针对不同访问主体执行满足安全需求的身份认证机制 | `SERVICE` | `I-US` | `I-US&T-AS.IA-02` 用户认证 | `ARS-005` | `MAPPED_BY_CURRENT_FOCUS` |
| `T-AS.IA` | `T-AS.IA-03` 实施人员实体的访问控制管理 | `SERVICE` | `I-AP` | `I-AP&T-AS.IA-03` 应用资源授权 | `ARS-005` | `MAPPED_BY_CURRENT_FOCUS` |
| `T-AS.IA` | `T-AS.IA-03` 实施人员实体的访问控制管理 | `SERVICE` | `I-DI` | `I-DI&T-AS.IA-03` 数据资源授权 | `ARS-005` | `MAPPED_BY_CURRENT_FOCUS` |
| `T-AS.IA` | `T-AS.IA-03` 实施人员实体的访问控制管理 | `SERVICE` | `I-HD` | `I-HD&T-AS.IA-03` 硬件资源授权 | `ARS-005` | `MAPPED_BY_CURRENT_FOCUS` |
| `T-AS.IA` | `T-AS.IA-03` 实施人员实体的访问控制管理 | `SERVICE` | `I-NT` | `I-NT&T-AS.IA-03` 网络资源授权 | `ARS-005` | `MAPPED_BY_CURRENT_FOCUS` |
| `T-AS.IA` | `T-AS.IA-03` 实施人员实体的访问控制管理 | `SERVICE` | `I-OS` | `I-OS&T-AS.IA-03` 操作系统资源授权 | `ARS-005` | `MAPPED_BY_CURRENT_FOCUS` |
| `T-AS.IA` | `T-AS.IA-03` 实施人员实体的访问控制管理 | `SERVICE` | `I-PE` | `I-PE&T-AS.IA-03` 物理环境授权 | `ARS-005` | `MAPPED_BY_CURRENT_FOCUS` |
| `T-AS.IA` | `T-AS.IA-04` 管理和维护凭证的完整生命周期 | `SERVICE` | `I-AP` | `I-AP&T-AS.IA-04` 应用凭证管理 | `ARS-005` | `MAPPED_BY_CURRENT_FOCUS` |
| `T-AS.IA` | `T-AS.IA-04` 管理和维护凭证的完整生命周期 | `SERVICE` | `I-HD` | `I-HD&T-AS.IA-04` 硬件凭证管理 | `ARS-005` | `MAPPED_BY_CURRENT_FOCUS` |
| `T-AS.IA` | `T-AS.IA-04` 管理和维护凭证的完整生命周期 | `SERVICE` | `I-OS` | `I-OS&T-AS.IA-04` 操作系统凭证管理 | `ARS-005` | `MAPPED_BY_CURRENT_FOCUS` |
| `T-AS.IA` | `T-AS.IA-04` 管理和维护凭证的完整生命周期 | `SERVICE` | `I-US` | `I-US&T-AS.IA-04` 用户凭证管理 | `ARS-005` | `MAPPED_BY_CURRENT_FOCUS` |
| `T-AS.DS` | `T-AS.DS-01` 持续管理软件安全需求 | `SERVICE` | `I-AP` | `I-AP&T-AS.DS-01` 软件威胁建模 | `ARS-006` | `MAPPED_BY_CURRENT_FOCUS` |
| `T-AS.DS` | `T-AS.DS-02` 实施代码安全检查 | `SERVICE` | `I-AP` | `I-AP&T-AS.DS-02` 代码安全检测 | `ARS-006` | `MAPPED_BY_CURRENT_FOCUS` |
| `T-AS.DS` | `T-AS.DS-03` 实施软件供应链安全检查 | `SERVICE` | `I-AP` | `I-AP&T-AS.DS-03` 组件安全管理 | `ARS-006` | `MAPPED_BY_CURRENT_FOCUS` |
| `T-AS.DS` | `T-AS.DS-04` 实施软件制品安全检查 | `SERVICE` | `I-AP` | `I-AP&T-AS.DS-04` 制品安全管理 | `ARS-006` | `MAPPED_BY_CURRENT_FOCUS` |
| `T-AS.DS` | `T-AS.DS-05` 实施软件上线安全检查 | `SERVICE` | `I-AP` | `I-AP&T-AS.DS-05` 软件安全测试 | `ARS-006` | `MAPPED_BY_CURRENT_FOCUS` |
| `T-AS.DS` | `T-AS.DS-06` 持续管理可复用的开发安全资源 | `SERVICE` | `I-AP` | `I-AP&T-AS.DS-06` 安全组件和函数管理 | — | `BLOCKED_FOCUS_UNMAPPED` |
| `T-AS.LA` | `T-AS.LA-01` 在信息化资产上记录保存日志 | `SERVICE` | `I-AP` | `I-AP&T-AS.LA-01` 应用日志记录 | `ARS-007` | `MAPPED_BY_CURRENT_FOCUS` |
| `T-AS.LA` | `T-AS.LA-01` 在信息化资产上记录保存日志 | `SERVICE` | `I-HD` | `I-HD&T-AS.LA-01` 固件日志记录 | `ARS-007` | `MAPPED_BY_CURRENT_FOCUS` |
| `T-AS.LA` | `T-AS.LA-01` 在信息化资产上记录保存日志 | `SERVICE` | `I-NT` | `I-NT&T-AS.LA-01` 网络设备日志记录 | `ARS-007` | `MAPPED_BY_CURRENT_FOCUS` |
| `T-AS.LA` | `T-AS.LA-01` 在信息化资产上记录保存日志 | `SERVICE` | `I-OS` | `I-OS&T-AS.LA-01` 操作系统日志记录 | `ARS-007` | `MAPPED_BY_CURRENT_FOCUS` |
| `T-AS.LA` | `T-AS.LA-02` 实现日志的收集与集中存储机制 | `SERVICE` | `I-AP` | `I-AP&T-AS.LA-02` 应用日志存储 | `ARS-007` | `MAPPED_BY_CURRENT_FOCUS` |
| `T-AS.LA` | `T-AS.LA-02` 实现日志的收集与集中存储机制 | `SERVICE` | `I-HD` | `I-HD&T-AS.LA-02` 固件日志存储 | `ARS-007` | `MAPPED_BY_CURRENT_FOCUS` |
| `T-AS.LA` | `T-AS.LA-02` 实现日志的收集与集中存储机制 | `SERVICE` | `I-NT` | `I-NT&T-AS.LA-02` 网络设备日志存储 | `ARS-007` | `MAPPED_BY_CURRENT_FOCUS` |
| `T-AS.LA` | `T-AS.LA-02` 实现日志的收集与集中存储机制 | `SERVICE` | `I-OS` | `I-OS&T-AS.LA-02` 操作系统日志存储 | `ARS-007` | `MAPPED_BY_CURRENT_FOCUS` |
| `T-AS.LA` | `T-AS.LA-02` 实现日志的收集与集中存储机制 | `SERVICE` | `I-US` | `I-US&T-AS.LA-02` 身份、凭证与访问管理日志记录 | `ARS-007` | `MAPPED_BY_CURRENT_FOCUS` |
| `T-AS.LA` | `T-AS.LA-03` 对安全日志进行审计分析 | `SERVICE` | `I-AP` | `I-AP&T-AS.LA-03` 应用操作审计 | `ARS-007` | `MAPPED_BY_CURRENT_FOCUS` |
| `T-AS.LA` | `T-AS.LA-03` 对安全日志进行审计分析 | `SERVICE` | `I-DI` | `I-DI&T-AS.LA-03` 数据访问和操作审计 | `ARS-007` | `MAPPED_BY_CURRENT_FOCUS` |
| `T-AS.LA` | `T-AS.LA-03` 对安全日志进行审计分析 | `SERVICE` | `I-HD` | `I-HD&T-AS.LA-03` 硬件操作审计 | `ARS-007` | `MAPPED_BY_CURRENT_FOCUS` |
| `T-AS.LA` | `T-AS.LA-03` 对安全日志进行审计分析 | `SERVICE` | `I-NT` | `I-NT&T-AS.LA-03` 网络流量（行为）日志审计 | `ARS-007` | `MAPPED_BY_CURRENT_FOCUS` |
| `T-AS.LA` | `T-AS.LA-03` 对安全日志进行审计分析 | `SERVICE` | `I-OS` | `I-OS&T-AS.LA-03` 操作系统操作审计 | `ARS-007` | `MAPPED_BY_CURRENT_FOCUS` |
| `T-AS.LA` | `T-AS.LA-03` 对安全日志进行审计分析 | `SERVICE` | `I-US` | `I-US&T-AS.LA-03` 用户行为审计 | `ARS-007` | `MAPPED_BY_CURRENT_FOCUS` |
| `T-AS.CG` | `T-AS.CG-01` 确保信息传输或是存储状态下不被未授权的访问或泄露 | `SERVICE` | `I-AP` | `I-AP&T-AS.CG-01` 应用层数据加解密 | `ARS-008` | `REVIEW_FOCUS_IDENTITY` |
| `T-AS.CG` | `T-AS.CG-01` 确保信息传输或是存储状态下不被未授权的访问或泄露 | `SERVICE` | `I-DI` | `I-DI&T-AS.CG-01` 数据内容加解密 | `ARS-008` | `REVIEW_FOCUS_IDENTITY` |
| `T-AS.CG` | `T-AS.CG-01` 确保信息传输或是存储状态下不被未授权的访问或泄露 | `SERVICE` | `I-HD` | `I-HD&T-AS.CG-01` 固件加解密 | `ARS-008` | `REVIEW_FOCUS_IDENTITY` |
| `T-AS.CG` | `T-AS.CG-01` 确保信息传输或是存储状态下不被未授权的访问或泄露 | `SERVICE` | `I-NT` | `I-NT&T-AS.CG-01` 网络传输通道加解密 | `ARS-008` | `REVIEW_FOCUS_IDENTITY` |
| `T-AS.CG` | `T-AS.CG-01` 确保信息传输或是存储状态下不被未授权的访问或泄露 | `SERVICE` | `I-OS` | `I-OS&T-AS.CG-01` 操作系统加解密 | `ARS-008` | `REVIEW_FOCUS_IDENTITY` |
| `T-AS.CG` | `T-AS.CG-02` 确保在信息交互过程中，主体和客体均源自可信赖的来源，并且不被非法篡改或删除 | `SERVICE` | `I-AP` | `I-AP&T-AS.CG-02` 应用程序完整性校验（含操作签名验签） | `ARS-008` | `REVIEW_FOCUS_IDENTITY` |
| `T-AS.CG` | `T-AS.CG-02` 确保在信息交互过程中，主体和客体均源自可信赖的来源，并且不被非法篡改或删除 | `SERVICE` | `I-DI` | `I-DI&T-AS.CG-02` 数据完整性校验（签名验签） | `ARS-008` | `REVIEW_FOCUS_IDENTITY` |
| `T-AS.CG` | `T-AS.CG-02` 确保在信息交互过程中，主体和客体均源自可信赖的来源，并且不被非法篡改或删除 | `SERVICE` | `I-HD` | `I-HD&T-AS.CG-02` 固件签名 | `ARS-008` | `REVIEW_FOCUS_IDENTITY` |
| `T-AS.CG` | `T-AS.CG-02` 确保在信息交互过程中，主体和客体均源自可信赖的来源，并且不被非法篡改或删除 | `SERVICE` | `I-OS` | `I-OS&T-AS.CG-02` 操作系统文件完整性校验 | `ARS-008` | `REVIEW_FOCUS_IDENTITY` |
| `T-AS.DG` | `T-AS.DG-01` 持续管理数据分类分级策略，执行数据分类分级 | `SERVICE` | `I-DI` | `I-DI&T-AS.DG-01` 数据分类分级 | `ARS-009` | `MAPPED_BY_CURRENT_FOCUS` |
| `T-AS.DG` | `T-AS.DG-02` 制定并实施数据安全策略 | `SERVICE` | `I-DI` | `I-DI&T-AS.DG-02` 数据安全策略管控 | `ARS-009` | `MAPPED_BY_CURRENT_FOCUS` |
| `T-AS.DG` | `T-AS.DG-03` 确保数据的可靠性与可恢复性 | `SERVICE` | `I-DI` | `I-DI&T-AS.DG-03` 数据备份 | — | `BLOCKED_FOCUS_UNMAPPED` |
| `T-PD.PP` | `T-PD.PP-01` 构建和维护安全可靠的网络访问路径 | `SERVICE` | `I-AP` | `I-AP&T-PD.PP-01` 应用安全访问 | `ARS-010` | `MAPPED_BY_CURRENT_FOCUS` |
| `T-PD.PP` | `T-PD.PP-01` 构建和维护安全可靠的网络访问路径 | `SERVICE` | `I-DI` | `I-DI&T-PD.PP-01` 数据安全访问 | `ARS-010` | `MAPPED_BY_CURRENT_FOCUS` |
| `T-PD.PP` | `T-PD.PP-01` 构建和维护安全可靠的网络访问路径 | `SERVICE` | `I-NT` | `I-NT&T-PD.PP-01` 网络安全接入 | `ARS-010` | `MAPPED_BY_CURRENT_FOCUS` |
| `T-PD.PP` | `T-PD.PP-01` 构建和维护安全可靠的网络访问路径 | `SERVICE` | `I-PE` | `I-PE&T-PD.PP-01` 物理环境安全访问 | `ARS-010` | `MAPPED_BY_CURRENT_FOCUS` |
| `T-PD.PP` | `T-PD.PP-02` 实施控制措施以监测和管理网络异常流量 | `SERVICE` | `I-NT` | `I-NT&T-PD.PP-02` 网络异常流量检测与迁移 | `ARS-010` | `MAPPED_BY_CURRENT_FOCUS` |
| `T-PD.PP` | `T-PD.PP-03` 执行网络的隔离与边界保护措施 | `SERVICE` | `I-AP` | `I-AP&T-PD.PP-03` 应用隔离 | `ARS-010` | `MAPPED_BY_CURRENT_FOCUS` |
| `T-PD.PP` | `T-PD.PP-03` 执行网络的隔离与边界保护措施 | `SERVICE` | `I-DI` | `I-DI&T-PD.PP-03` 数据隔离 | `ARS-010` | `MAPPED_BY_CURRENT_FOCUS` |
| `T-PD.PP` | `T-PD.PP-03` 执行网络的隔离与边界保护措施 | `SERVICE` | `I-HD` | `I-HD&T-PD.PP-03` 硬件隔离 | `ARS-010` | `MAPPED_BY_CURRENT_FOCUS` |
| `T-PD.PP` | `T-PD.PP-03` 执行网络的隔离与边界保护措施 | `SERVICE` | `I-NT` | `I-NT&T-PD.PP-03` 网络隔离 | `ARS-010` | `MAPPED_BY_CURRENT_FOCUS` |
| `T-PD.PP` | `T-PD.PP-03` 执行网络的隔离与边界保护措施 | `SERVICE` | `I-OS` | `I-OS&T-PD.PP-03` 操作系统隔离 | `ARS-010` | `MAPPED_BY_CURRENT_FOCUS` |
| `T-PD.AC` | `T-PD.AC-01` 实施非人员实体的访问控制管理 | `SERVICE` | `I-AP` | `I-AP&T-PD.AC-01` 应用访问控制 | `ARS-011` | `MAPPED_BY_CURRENT_FOCUS` |
| `T-PD.AC` | `T-PD.AC-01` 实施非人员实体的访问控制管理 | `SERVICE` | `I-HD` | `I-HD&T-PD.AC-01` 设备访问控制 | `ARS-011` | `MAPPED_BY_CURRENT_FOCUS` |
| `T-PD.AC` | `T-PD.AC-01` 实施非人员实体的访问控制管理 | `SERVICE` | `I-NT` | `I-NT&T-PD.AC-01` 网络访问控制 | `ARS-011` | `MAPPED_BY_CURRENT_FOCUS` |
| `T-PD.AC` | `T-PD.AC-01` 实施非人员实体的访问控制管理 | `SERVICE` | `I-OS` | `I-OS&T-PD.AC-01` 操作系统访问控制 | `ARS-011` | `MAPPED_BY_CURRENT_FOCUS` |
| `T-PD.AC` | `T-PD.AC-02` 对访问实体执行信誉评估 | `SERVICE` | `I-AP` | `I-AP&T-PD.AC-02` 应用软件信誉评估 | `ARS-011` | `MAPPED_BY_CURRENT_FOCUS` |
| `T-PD.AC` | `T-PD.AC-02` 对访问实体执行信誉评估 | `SERVICE` | `I-OS` | `I-OS&T-PD.AC-02` 主机/终端信誉评估 | `ARS-011` | `MAPPED_BY_CURRENT_FOCUS` |
| `T-PD.AC` | `T-PD.AC-02` 对访问实体执行信誉评估 | `SERVICE` | `I-US` | `I-US&T-PD.AC-02` 用户信誉评估 | `ARS-011` | `MAPPED_BY_CURRENT_FOCUS` |
| `T-PD.TP` | `T-PD.TP-01` 对恶意代码进行检测和防护，抑制或阻止恶意代码带来威胁 | `SERVICE` | `I-NT` | `I-NT&T-PD.TP-01` 网络恶意代码防护 | `ARS-012` | `MAPPED_BY_CURRENT_FOCUS` |
| `T-PD.TP` | `T-PD.TP-01` 对恶意代码进行检测和防护，抑制或阻止恶意代码带来威胁 | `SERVICE` | `I-OS` | `I-OS&T-PD.TP-01` 操作系统恶意代码防护 | `ARS-012` | `MAPPED_BY_CURRENT_FOCUS` |
| `T-PD.TP` | `T-PD.TP-02` 识别与检测已知及新出现安全威胁 | `SERVICE` | `I-AP` | `I-AP&T-PD.TP-02` 应用异常特征检测（API、Web应用） | `ARS-012` | `MAPPED_BY_CURRENT_FOCUS` |
| `T-PD.TP` | `T-PD.TP-02` 识别与检测已知及新出现安全威胁 | `SERVICE` | `I-NT` | `I-NT&T-PD.TP-02` 网络流量特征检测 | `ARS-012` | `MAPPED_BY_CURRENT_FOCUS` |
| `T-PD.TP` | `T-PD.TP-02` 识别与检测已知及新出现安全威胁 | `SERVICE` | `I-OS` | `I-OS&T-PD.TP-02` 操作系统异常特征检测 | `ARS-012` | `MAPPED_BY_CURRENT_FOCUS` |
| `T-PD.TP` | `T-PD.TP-03` 实施入侵防护技术和策略，及时阻断攻击行为 | `SERVICE` | `I-AP` | `I-AP&T-PD.TP-03` 应用攻击入侵防御 | `ARS-012` | `MAPPED_BY_CURRENT_FOCUS` |
| `T-PD.TP` | `T-PD.TP-03` 实施入侵防护技术和策略，及时阻断攻击行为 | `SERVICE` | `I-NT` | `I-NT&T-PD.TP-03` 网络攻击入侵防御 | `ARS-012` | `MAPPED_BY_CURRENT_FOCUS` |
| `T-PD.TP` | `T-PD.TP-03` 实施入侵防护技术和策略，及时阻断攻击行为 | `SERVICE` | `I-OS` | `I-OS&T-PD.TP-03` 操作系统攻击入侵防御 | `ARS-012` | `MAPPED_BY_CURRENT_FOCUS` |
| `T-PD.TP` | `T-PD.TP-04` 收集网络安全流量 | `SERVICE` | `I-NT` | `I-NT&T-PD.TP-04` 网络流量识别与收集 | `ARS-012` | `MAPPED_BY_CURRENT_FOCUS` |
| `T-PD.TP` | `T-PD.TP-05` 对仅允许预定义的程序或行为进行控制 | `SERVICE` | `I-AP` | `I-AP&T-PD.TP-05` 应用程序白名单 | — | `BLOCKED_FOCUS_UNMAPPED` |
| `T-PD.TP` | `T-PD.TP-05` 对仅允许预定义的程序或行为进行控制 | `SERVICE` | `I-OS` | `I-OS&T-PD.TP-05` 操作系统进程白名单 | — | `BLOCKED_FOCUS_UNMAPPED` |
| `T-PD.DP` | `T-PD.DP-01` 实施水印技术，加强数据泄漏的追踪溯源 | `SERVICE` | `I-AP` | `I-AP&T-PD.DP-01` 应用页面水印 | `ARS-013` | `MAPPED_BY_CURRENT_FOCUS` |
| `T-PD.DP` | `T-PD.DP-01` 实施水印技术，加强数据泄漏的追踪溯源 | `SERVICE` | `I-DI` | `I-DI&T-PD.DP-01` 数据内容水印 | `ARS-013` | `MAPPED_BY_CURRENT_FOCUS` |
| `T-PD.DP` | `T-PD.DP-01` 实施水印技术，加强数据泄漏的追踪溯源 | `SERVICE` | `I-OS` | `I-OS&T-PD.DP-01` 操作系统屏幕水印 | `ARS-013` | `MAPPED_BY_CURRENT_FOCUS` |
| `T-PD.DP` | `T-PD.DP-02` 实施敏感数据的脱敏处理措施 | `SERVICE` | `I-AP` | `I-AP&T-PD.DP-02` 应用动态数据脱敏 | `ARS-013` | `MAPPED_BY_CURRENT_FOCUS` |
| `T-PD.DP` | `T-PD.DP-02` 实施敏感数据的脱敏处理措施 | `SERVICE` | `I-DI` | `I-DI&T-PD.DP-02` 静态数据脱敏 | `ARS-013` | `MAPPED_BY_CURRENT_FOCUS` |
| `T-PD.DP` | `T-PD.DP-02` 实施敏感数据的脱敏处理措施 | `SERVICE` | `I-NT` | `I-NT&T-PD.DP-02` 网络动态数据脱敏 | `ARS-013` | `MAPPED_BY_CURRENT_FOCUS` |
| `T-PD.DP` | `T-PD.DP-03` 实施数据防泄漏控制技术和策略 | `SERVICE` | `I-NT` | `I-NT&T-PD.DP-03` 网络数据防泄漏 | `ARS-013` | `MAPPED_BY_CURRENT_FOCUS` |
| `T-PD.DP` | `T-PD.DP-03` 实施数据防泄漏控制技术和策略 | `SERVICE` | `I-OS` | `I-OS&T-PD.DP-03` 操作系统数据防泄漏 | `ARS-013` | `MAPPED_BY_CURRENT_FOCUS` |
| `T-PD.DP` | `T-PD.DP-04` 实施数据访问控制技术 | `SERVICE` | `I-DI` | `I-DI&T-PD.DP-04` 数据访问鉴权 | `ARS-013` | `MAPPED_BY_CURRENT_FOCUS` |
| `T-PD.DP` | `T-PD.DP-05` 监测数据全生命周期流转过程 | `SERVICE` | `I-DI` | `I-DI&T-PD.DP-05` 数据流转监测 | `ARS-013` | `MAPPED_BY_CURRENT_FOCUS` |
| `T-PD.DP` | `T-PD.DP-06` 在数据生命周期结束时执行数据销毁策略 | `SERVICE` | `I-DI` | `I-DI&T-PD.DP-06` 数据销毁 | `ARS-013` | `MAPPED_BY_CURRENT_FOCUS` |
| `T-PD.DP` | `T-PD.DP-07` 执行隐私数据识别和监控以保护隐私数据 | `SERVICE` | `I-DI` | `I-DI&T-PD.DP-07` 隐私数据检测 | `ARS-013` | `MAPPED_BY_CURRENT_FOCUS` |
| `T-AD.SA` | `T-AD.SA-01` 实施高级威胁检测，识别复杂、隐蔽的攻击行为 | `SERVICE` | `I-AP` | `I-AP&T-AD.SA-01` 应用异常行为检测 | `ARS-014` | `MAPPED_BY_CURRENT_FOCUS` |
| `T-AD.SA` | `T-AD.SA-01` 实施高级威胁检测，识别复杂、隐蔽的攻击行为 | `SERVICE` | `I-NT` | `I-NT&T-AD.SA-01` 网络高级威胁检测（启发式、行为式） | `ARS-014` | `MAPPED_BY_CURRENT_FOCUS` |
| `T-AD.SA` | `T-AD.SA-01` 实施高级威胁检测，识别复杂、隐蔽的攻击行为 | `SERVICE` | `I-OS` | `I-OS&T-AD.SA-01` 操作系统异常行为检测 | `ARS-014` | `MAPPED_BY_CURRENT_FOCUS` |
| `T-AD.SA` | `T-AD.SA-01` 实施高级威胁检测，识别复杂、隐蔽的攻击行为 | `SERVICE` | `I-US` | `I-US&T-AD.SA-01` 用户高级威胁检测（行为式） | `ARS-014` | `MAPPED_BY_CURRENT_FOCUS` |
| `T-AD.SA` | `T-AD.SA-02` 执行网络安全监控 | `SERVICE` | `ALL` | `ALL&T-AD.SA-02` 安全告警监测 | `ARS-014` | `MAPPED_BY_CURRENT_FOCUS` |
| `T-AD.SA` | `T-AD.SA-03` 建立并维护态势感知 | `SERVICE` | `ALL` | `ALL&T-AD.SA-03` 态势感知 | `ARS-014` | `MAPPED_BY_CURRENT_FOCUS` |
| `T-AD.IR` | `T-AD.IR-01` 网络安全事件分析与事件定性、公布 | `SERVICE` | `ALL` | `ALL&T-AD.IR-01` 安全事件分析 | `ARS-015` | `MAPPED_BY_CURRENT_FOCUS` |
| `T-AD.IR` | `T-AD.IR-02` 管理网络安全事件 | `SERVICE` | `ALL` | `ALL&T-AD.IR-02` 安全事件管理 | `ARS-015` | `MAPPED_BY_CURRENT_FOCUS` |
| `T-AD.IR` | `T-AD.IR-03` 持续维护应急计划，执行网络安全事件响应处置 | `SERVICE` | `ALL` | `ALL&T-AD.IR-03` 安全响应处置 | `ARS-015` | `MAPPED_BY_CURRENT_FOCUS` |
| `T-AD.IR` | `T-AD.IR-04` 对网络安全事件造成的影响执行恢复操作 | `SERVICE` | `ALL` | `ALL&T-AD.IR-04` 恢复 | `ARS-015` | `MAPPED_BY_CURRENT_FOCUS` |
| `T-AD.IR` | `T-AD.IR-05` 对网络安全事件执行调查取证 | `SERVICE` | `I-AP` | `I-AP&T-AD.IR-05` 应用调查取证 | `ARS-015` | `MAPPED_BY_CURRENT_FOCUS` |
| `T-AD.IR` | `T-AD.IR-05` 对网络安全事件执行调查取证 | `SERVICE` | `I-DI` | `I-DI&T-AD.IR-05` 数据调查取证 | `ARS-015` | `MAPPED_BY_CURRENT_FOCUS` |
| `T-AD.IR` | `T-AD.IR-05` 对网络安全事件执行调查取证 | `SERVICE` | `I-NT` | `I-NT&T-AD.IR-05` 网络调查取证 | `ARS-015` | `MAPPED_BY_CURRENT_FOCUS` |
| `T-AD.IR` | `T-AD.IR-05` 对网络安全事件执行调查取证 | `SERVICE` | `I-OS` | `I-OS&T-AD.IR-05` 操作系统调查取证 | `ARS-015` | `MAPPED_BY_CURRENT_FOCUS` |
| `T-AD.IR` | `T-AD.IR-06` 对网络攻击进行诱捕 | `SERVICE` | `I-AP` | `I-AP&T-AD.IR-06` 应用仿真 | `ARS-015` | `MAPPED_BY_CURRENT_FOCUS` |
| `T-AD.IR` | `T-AD.IR-06` 对网络攻击进行诱捕 | `SERVICE` | `I-DI` | `I-DI&T-AD.IR-06` 诱饵数据 | `ARS-015` | `MAPPED_BY_CURRENT_FOCUS` |
| `T-AD.IR` | `T-AD.IR-06` 对网络攻击进行诱捕 | `SERVICE` | `I-NT` | `I-NT&T-AD.IR-06` 网络仿真 | `ARS-015` | `MAPPED_BY_CURRENT_FOCUS` |
| `T-AD.IR` | `T-AD.IR-06` 对网络攻击进行诱捕 | `SERVICE` | `I-OS` | `I-OS&T-AD.IR-06` 系统仿真 | `ARS-015` | `MAPPED_BY_CURRENT_FOCUS` |
| `T-AD.IR` | `T-AD.IR-06` 对网络攻击进行诱捕 | `SERVICE` | `I-US` | `I-US&T-AD.IR-06` 诱饵账号 | `ARS-015` | `MAPPED_BY_CURRENT_FOCUS` |
| `T-AD.SV` | `T-AD.SV-01` 实现网络安全策略可视化（全局网络安全策略集合管理） | `SERVICE` | `I-AP` | `I-AP&T-AD.SV-01` 应用安全策略管理 | `ARS-016` | `REVIEW_FOCUS_IDENTITY` |
| `T-AD.SV` | `T-AD.SV-01` 实现网络安全策略可视化（全局网络安全策略集合管理） | `SERVICE` | `I-NT` | `I-NT&T-AD.SV-01` 网络安全策略管理 | `ARS-016` | `REVIEW_FOCUS_IDENTITY` |
| `T-AD.SV` | `T-AD.SV-01` 实现网络安全策略可视化（全局网络安全策略集合管理） | `SERVICE` | `I-OS` | `I-OS&T-AD.SV-01` 主机/终端安全策略管理 | `ARS-016` | `REVIEW_FOCUS_IDENTITY` |
| `T-AD.SV` | `T-AD.SV-02` 对安全架构和网络防护策略进行评估验证 | `SERVICE` | `ALL` | `ALL&T-AD.SV-02` 策略有效性验证 | `ARS-016` | `REVIEW_FOCUS_IDENTITY` |
| `T-AD.SV` | `T-AD.SV-03` 开展攻防演练和沙盘推演 | `SERVICE` | `ALL` | `ALL&T-AD.SV-03` 攻防模拟 | — | `BLOCKED_FOCUS_UNMAPPED` |
| `T-IN.IO` | `T-IN.IO-01` 选取来自不同渠道的威胁情报源 | `SERVICE` | `ALL` | `ALL&T-IN.IO-01` 威胁情报源 | `ARS-017` | `MAPPED_BY_CURRENT_FOCUS` |
| `T-IN.IO` | `T-IN.IO-02` 对多源异构威胁情报进行融合与治理 | `SERVICE` | `ALL` | `ALL&T-IN.IO-02` 威胁情报治理 | `ARS-017` | `MAPPED_BY_CURRENT_FOCUS` |
| `T-IN.IO` | `T-IN.IO-03` 在组织内部共享成品威胁情报 | `SERVICE` | `ALL` | `ALL&T-IN.IO-03` 威胁情报分发 | `ARS-017` | `MAPPED_BY_CURRENT_FOCUS` |
| `T-IN.IP` | `T-IN.IP-01` 生产组织本地威胁情报 | `SERVICE` | `ALL` | `ALL&T-IN.IP-01` 威胁情报生产 | `ARS-018` | `MAPPED_BY_CURRENT_FOCUS` |
| `T-OF.AT` | `T-OF.AT-01` 对攻击行为进行溯源 | `FOCUS` | — | — | `ARS-019` | `MAPPED_BY_CURRENT_FOCUS` |
| `T-OF.AT` | `T-OF.AT-02` 网络攻击入侵目标选择及评估分析 | `FOCUS` | — | — | `ARS-019` | `MAPPED_BY_CURRENT_FOCUS` |
| `T-OF.AT` | `T-OF.AT-03` 网络攻击执行与效果评估 | `FOCUS` | — | — | `ARS-019` | `MAPPED_BY_CURRENT_FOCUS` |
| `G-SP.SM` | `G-SP.SM-01` 具有明确的网络安全战略计划与目标 | `FOCUS` | — | — | `ARS-020` | `MAPPED_BY_CURRENT_FOCUS` |
| `G-SP.SM` | `G-SP.SM-02` 完善网络安全组织架构，合理分配网络安全组织职责 | `FOCUS` | — | — | `ARS-020` | `MAPPED_BY_CURRENT_FOCUS` |
| `G-SP.SM` | `G-SP.SM-03` 对组织网络安全活动执行决策监督 | `FOCUS` | — | — | `ARS-020` | `MAPPED_BY_CURRENT_FOCUS` |
| `M-PM.PL` | `M-PM.PL-01` 定期开展网络安全规划及持续更新修订 | `FOCUS` | — | — | `ARS-021` | `MAPPED_BY_CURRENT_FOCUS` |
| `M-PM.PR` | `M-PM.PR-01` 网络安全与信息化项目生命周期紧密结合 | `FOCUS` | — | — | `ARS-022` | `MAPPED_BY_CURRENT_FOCUS` |
| `M-PM.PR` | `M-PM.PR-02` 有完整的安全项目生命周期管理 | `FOCUS` | — | — | `ARS-022` | `MAPPED_BY_CURRENT_FOCUS` |
| `M-SA.AM` | `M-SA.AM-01` 保障与落实网络安全投资 | `FOCUS` | — | — | `ARS-023` | `MAPPED_BY_CURRENT_FOCUS` |
| `M-SA.AM` | `M-SA.AM-02` 实现信创环境网络安全防护措施的适配与推广 | `FOCUS` | — | — | `ARS-023` | `MAPPED_BY_CURRENT_FOCUS` |
| `M-SA.RM` | `M-SA.RM-01` 持续优化组织网络安全风险管理策略和计划 | `FOCUS` | — | — | `ARS-024` | `MAPPED_BY_CURRENT_FOCUS` |
| `M-SA.RM` | `M-SA.RM-02` 开展组织网络安全风险识别、分析、处置与后评估 | `FOCUS` | — | — | `ARS-024` | `MAPPED_BY_CURRENT_FOCUS` |
| `M-SA.RE` | `M-SA.RE-01` 完善网络安全制度体系 | `FOCUS` | — | — | `ARS-025` | `MAPPED_BY_CURRENT_FOCUS` |
| `M-SA.RE` | `M-SA.RE-02` 开展网络安全合规审查，满足国内外法律法规与监管要求 | `FOCUS` | — | — | `ARS-025` | `MAPPED_BY_CURRENT_FOCUS` |
| `M-SA.RE` | `M-SA.RE-03` 满足个人隐私保护要求 | `FOCUS` | — | — | `ARS-025` | `MAPPED_BY_CURRENT_FOCUS` |
| `M-SA.TP` | `M-SA.TP-01` 强化软件供应商及其它第三方的安全管理 | `FOCUS` | — | — | `ARS-026` | `MAPPED_BY_CURRENT_FOCUS` |
| `M-SA.TP` | `M-SA.TP-02` 实施第三方人员生命周期安全控制 | `FOCUS` | — | — | `ARS-026` | `MAPPED_BY_CURRENT_FOCUS` |
| `M-SA.OP` | `M-SA.OP-01` 持续优化组织的安全运行流程与操作规程 | `FOCUS` | — | — | `ARS-027` | `MAPPED_BY_CURRENT_FOCUS` |
| `M-SA.OP` | `M-SA.OP-02` 持续优化网络安全运行指标，开展运行活动效果评价 | `FOCUS` | — | — | `ARS-027` | `MAPPED_BY_CURRENT_FOCUS` |
| `M-SA.CO` | `M-SA.CO-01` 在组织内共享网络安全信息 | `FOCUS` | — | — | `ARS-028` | `MAPPED_BY_CURRENT_FOCUS` |
| `M-SA.CO` | `M-SA.CO-02` 对外部通报进行响应、处置与反馈 | `FOCUS` | — | — | `ARS-028` | `MAPPED_BY_CURRENT_FOCUS` |
| `M-SE.SE` | `M-SE.SE-01` 持续开展信息化环境网络安全（控制措施）检查与整改 | `FOCUS` | — | — | `ARS-029` | `MAPPED_BY_CURRENT_FOCUS` |
| `M-SE.SE` | `M-SE.SE-02` 持续开展管理体系有效性检查与整改 | `FOCUS` | — | — | `ARS-029` | `REVIEW_FOCUS_IDENTITY` |
| `M-SE.SE` | `M-SE.SE-03` 执行网络安全监督工作（建设监督、运营监督、整改监督） | `FOCUS` | — | — | `ARS-029` | `MAPPED_BY_CURRENT_FOCUS` |
| `M-SE.PE` | `M-SE.PE-01` 定义组织网络安全绩效考核指标，开展网络安全考核工作 | `FOCUS` | — | — | `ARS-030` | `MAPPED_BY_CURRENT_FOCUS` |
| `M-PS.HS` | `M-PS.HS-01` 实施内部人员生命周期安全控制 | `FOCUS` | — | — | `ARS-031` | `MAPPED_BY_CURRENT_FOCUS` |
| `M-PS.HS` | `M-PS.HS-02` 建立组织的网络安全专家团队 | `FOCUS` | — | — | — | `BLOCKED_FOCUS_UNMAPPED` |
| `M-PS.HS` | `M-PS.HS-03` 建设组织的红蓝军团队/紫军 | `FOCUS` | — | — | — | `BLOCKED_FOCUS_UNMAPPED` |
| `M-PS.CT` | `M-PS.CT-01` 提高组织全员网络安全意识 | `FOCUS` | — | — | `ARS-032` | `MAPPED_BY_CURRENT_FOCUS` |
| `M-PS.CT` | `M-PS.CT-02` 培养网络安全人才，提升网络安全人员能力 | `FOCUS` | — | — | `ARS-032` | `MAPPED_BY_CURRENT_FOCUS` |

</details>

## 10. 通过条件与后续顺序

映射门禁只有在以下条件同时满足后才能改为 `PASS`：

1. 91 个当前关注点全部绑定唯一 rubric set，父 L2 能力一致，名称语义差异完成业务复核。
2. 160 条当前关注点—服务关系全部可通过当前关注点解析 rubric set。
3. 185 个当前评估点全部可解析唯一 rubric set。
4. 候选继承均有业务确认记录；不得因为同属一个 L2 能力而自动继承。
5. 映射通过后，重新以当前字典对象清单投影 rubric 完整性，再输出缺级、单维缺项、业务不可评分和遗漏分类。

本轮不修改工程字典、源 Excel、成熟度运行代码、正式 JSON / SQLite、模板、评分数据、用户库或 DMG。
