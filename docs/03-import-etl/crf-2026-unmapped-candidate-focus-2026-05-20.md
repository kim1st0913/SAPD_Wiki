# CRF Core 2026 未映射项候选关注点清单（2026-05-20）

本清单基于 2026-05-20 语义复核时的 CRF 未映射项生成。用户确认后，除 `AI`、`PHY` 外，其余候选已按“多候选全部挂入”的口径写回原始映射表；`AI`、`PHY` 不映射，保留为后期能力体系优化 issue。

- 当前 CRF Core 主数据条数：476
- 写回后已映射唯一 Safeguard ID：443
- 写回后未映射 Safeguard ID：33，仅剩 `AI` 18 条、`PHY` 15 条

## AI（18 条）

| Safeguard ID | 保障措施域 | 候选关注点 | 依据摘要 |
|---|---|---|---|
| `AI-01` | 人工智能管理（Artificial Intelligence Management） | `M-SA.RM-02 / M-SA.RE-02` | 维护人工智能可接受使用标准，以治理组织对人工智能技术的采用和使用。 |
| `AI-02` | 人工智能管理（Artificial Intelligence Management） | `T-AS.DG-01 / T-AS.DG-02` | 确保组织的人工智能可接受使用标准定义可输入 AI 系统的数据类型，并确保符合组织的数据分类要求。 |
| `AI-03` | 人工智能管理（Artificial Intelligence Management） | `T-AS.DG-01 / T-AS.DG-02` | 确保组织的人工智能可接受使用标准建立指导原则，区分本地维护的 AI 系统和公开可用的 AI 解决方案，并与组织的数据分类要求保持一致。 |
| `AI-04` | 人工智能管理（Artificial Intelligence Management） | `M-SA.RM-02 / M-SE.SE-01` | 确保组织的人工智能可接受使用标准定义在组织采用新 AI 技术之前对其进行评估和批准的准则。 |
| `AI-05` | 人工智能管理（Artificial Intelligence Management） | `M-SA.RM-02 / M-SA.RE-02` | 确保组织的人工智能可接受使用标准根据组织的软件清单要求，定义软件中嵌入式 AI 的可接受使用。 |
| `AI-06` | 人工智能管理（Artificial Intelligence Management） | `T-AS.IA-03 / T-PD.AC-01` | 确保组织的人工智能可接受使用标准定义 AI 使用的授权要求，确保只有授权用户能够根据组织的访问控制策略访问和使用 AI 系统。 |
| `AI-07` | 人工智能管理（Artificial Intelligence Management） | `M-SA.RE-02 / M-SA.RE-03` | 确保组织的人工智能可接受使用标准处理知识产权和版权相关事项，以确保符合法律和监管要求。 |
| `AI-08` | 人工智能管理（Artificial Intelligence Management） | `M-SA.RE-02 / M-SA.RE-03` | 确保组织的人工智能可接受使用标准包含管理高风险 AI 系统使用的规定，包括能够在没有直接人工发起的情况下发起或执行动作的智能体或半自主 AI 系统，以缓解潜在的安全、隐私和运营风险... |
| `AI-09` | 人工智能管理（Artificial Intelligence Management） | `M-SA.RM-02 / M-SA.RE-02` | 确保组织的人工智能可接受使用标准定义识别、缓解和处理 AI 系统偏见的指导原则。 |
| `AI-10` | 人工智能管理（Artificial Intelligence Management） | `M-SA.RM-02 / M-SA.RE-02` | 确保组织的人工智能可接受使用标准要求所有 AI 使用符合伦理准则和原则，以防止误用或非预期后果。 |
| `AI-11` | 人工智能管理（Artificial Intelligence Management） | `M-SA.RM-02 / M-SA.RE-02` | 确保组织的人工智能可接受使用标准定义监测要求，以检测和防止 AI 误用、滥用或非预期后果，包括由智能体或半自主 AI 行为导致的非预期动作或结果，并包含报告和响应此类事件的机制。 |
| `AI-12` | 人工智能管理（Artificial Intelligence Management） | `M-SA.RM-02 / M-SA.RE-02` | 确保组织的人工智能可接受使用标准定义 AI 辅助决策中人工监督的必要性，包括约束 AI 系统（如智能体 AI）何时可以建议动作、何时可以发起或执行动作，以及在适当情况下对 AI 生... |
| `AI-13` | 人工智能管理（Artificial Intelligence Management） | `T-AS.IA-03 / T-PD.AC-01` | 维护经批准的人工智能软件清单，以跟踪和管理已授权的 AI 解决方案。 |
| `AI-14` | 人工智能管理（Artificial Intelligence Management） | `M-SA.RM-02 / M-SA.RE-02` | 确保组织的人工智能清单包含由组织开发和管理的 AI 解决方案，以确保适当的治理和监督。 |
| `AI-15` | 人工智能管理（Artificial Intelligence Management） | `M-SA.RM-02 / M-SA.RE-02` | 确保组织的人工智能清单跟踪组织内部使用的软件即服务（SaaS）AI 解决方案。 |
| `AI-16` | 人工智能管理（Artificial Intelligence Management） | `M-SA.RM-02 / M-SE.SE-01` | 确保组织的人工智能清单覆盖已批准软件应用中嵌入的 AI 能力，以保持对 AI 使用的可见性和控制。 |
| `AI-17` | 人工智能管理（Artificial Intelligence Management） | `T-AS.DG-01 / T-AS.DG-02` | 确保组织的人工智能清单跟踪第三方 AI 使用情况，以确保这些第三方可接受地使用 AI，尤其是在涉及组织数据使用时。 |
| `AI-18` | 人工智能管理（Artificial Intelligence Management） | `T-AS.DG-01 / T-AS.DG-02` | 确保组织的人工智能可接受使用标准定义经授权可发起或执行影响信息系统、数据或业务流程动作的 AI 系统（包括智能体 AI 系统）的批准和撤销要求。 |

## CSP（3 条）

| Safeguard ID | 保障措施域 | 候选关注点 | 依据摘要 |
|---|---|---|---|
| `CSP-01` | 云服务提供商管理（Cloud Service Provider Management） | `M-SA.TP-01 / T-AS.AM-01` | 维护组织授权云服务提供商 (CSP) 的清单。 |
| `CSP-02` | 云服务提供商管理（Cloud Service Provider Management） | `M-SA.TP-01 / T-AS.AM-01` | 维护每个授权云服务提供商 (CSP) 授权使用的每项服务的清单。 |
| `CSP-03` | 云服务提供商管理（Cloud Service Provider Management） | `M-SA.TP-01 / T-AS.AM-01` | 维护组织授权的软件即服务（SaaS）提供商清单。 |

## DTA（18 条）

| Safeguard ID | 保障措施域 | 候选关注点 | 依据摘要 |
|---|---|---|---|
| `DTA-01` | 数据清单管理（Data Inventory Management） | `T-AS.DG-01 / T-AS.DG-02` | 维护数据清单管理系统，跟踪组织管理的数据。 |
| `DTA-02` | 数据清单管理（Data Inventory Management） | `T-AS.DG-01 / T-AS.DG-02` | 确保组织的数据清单管理系统维护由组织管理并受其控制的数据清单。 |
| `DTA-03` | 数据清单管理（Data Inventory Management） | `T-AS.DG-01 / T-AS.DG-02` | 确保组织的数据清单管理系统维护由组织管理并受第三方控制的数据清单。 |
| `DTA-04` | 数据清单管理（Data Inventory Management） | `T-AS.DG-01 / T-AS.DG-02` | 确保组织的数据清单管理系统维护组织管理的数据类别的文档化定义。 |
| `DTA-05` | 数据清单管理（Data Inventory Management） | `T-AS.DG-01 / T-AS.DG-02` | 确保组织的数据清单管理系统为组织管理的所有数据定义数据所有者。 |
| `DTA-06` | 数据清单管理（Data Inventory Management） | `T-AS.DG-01 / T-AS.DG-02` | 确保组织的数据清单管理系统，在组织的数据所有者批准后，跟踪组织管理的数据的必要性。 |
| `DTA-07` | 数据清单管理（Data Inventory Management） | `T-AS.DG-01 / T-AS.DG-02` | 确保组织的数据清单管理系统跟踪组织管理的所有数据的业务目的。 |
| `DTA-08` | 数据清单管理（Data Inventory Management） | `T-PD.DP-02 / T-AS.DG-01` | 确保组织的数据清单管理系统跟踪信息系统中应屏蔽的数据。 |
| `DTA-10` | 数据清单管理（Data Inventory Management） | `T-AS.DG-01 / T-AS.DG-02` | 确保组织的数据库存管理系统记录处理生命周期内管理的所有数据的位置。 |
| `DTA-11` | 数据清单管理（Data Inventory Management） | `T-AS.DG-01 / T-AS.DG-02` | 维护系统对组织管理的物品（无论是现场物品还是第三方物品）进行自动清点和分类。 |
| `DTA-12` | 数据清单管理（Data Inventory Management） | `T-AS.DG-01 / T-AS.DG-02` | 确保组织的数据清单系统能自动发现组织管理的数据（无论是现场数据还是第三方数据）。 |
| `DTA-13` | 数据清单管理（Data Inventory Management） | `T-AS.DG-01 / T-AS.DG-02` | 确保组织的数据清单系统自动对组织管理的数据（无论是现场数据还是位于第三方的数据）进行分类和标记。 |
| `DTA-14` | 数据清单管理（Data Inventory Management） | `T-AS.DG-01 / T-AS.DG-02` | 确保组织的数据清单系统能自动发现其私人数据是否位于公开位置。 |
| `DTA-15` | 数据清单管理（Data Inventory Management） | `T-AS.DG-01 / T-AS.DG-02` | 确保组织的数据清单系统与组织的资产清单系统集成。 |
| `DTA-16` | 数据清单管理（Data Inventory Management） | `T-PD.DP-04 / T-AS.DG-02` | 确保组织的数据清单系统记录与组织管理的数据相关的事件（如访问、更改和删除）并告警。 |
| `DTA-17` | 数据清单管理（Data Inventory Management） | `T-PD.DP-04 / T-AS.DG-02` | 确保组织的数据清单系统记录与组织管理的系统配置文件相关的事件（如访问、更改和删除）并告警。 |
| `DTA-18` | 数据清单管理（Data Inventory Management） | `T-PD.DP-06 / T-AS.DG-02` | 定义组织为组织管理的不同类型数据定义数据保留期的流程。 |
| `DTA-19` | 数据清单管理（Data Inventory Management） | `T-PD.DP-05 / T-AS.DG-02` | 定义组织在可能的情况下将组织管理的数据归档的流程。 |

## EM（4 条）

| Safeguard ID | 保障措施域 | 候选关注点 | 依据摘要 |
|---|---|---|---|
| `EM-01` | 电子邮件管理（Email Management） | `T-AS.AM-01 / T-AS.CM-02` | 维护有权使用电子邮件的每个域名的清单。 |
| `EM-02` | 电子邮件管理（Email Management） | `T-AS.AM-01 / T-AS.CM-02` | 维护为组织批准的每个电子邮件域授权的邮件传输代理 (MTA) 的清单。 |
| `EM-03` | 电子邮件管理（Email Management） | `T-AS.AM-01 / T-AS.CM-02` | 为组织批准的每个电子邮件域维护适当的域名系统 (DNS) 记录（包括 SPF、DKIM 和 DMARC）。 |
| `EM-12` | 电子邮件管理（Email Management） | `T-PD.DP-05 / M-SA.CO-02` | 维护一个独立于组织电子邮件系统的文件传输门户系统，组织可利用该系统向组织外的个人发送大型文件。 |

## NDM（7 条）

| Safeguard ID | 保障措施域 | 候选关注点 | 依据摘要 |
|---|---|---|---|
| `NDM-08` | 网络设备管理（Network Device Management） | `T-AS.AM-01 / T-AS.CM-01` | 维护网络设备管理系统来管理每个组织经批准的网络设备。 |
| `NDM-09` | 网络设备管理（Network Device Management） | `T-AS.AM-01` | 确保组织的网络设备管理系统定期扫描新的网络设备，并将其添加到组织的网络设备清单中。 |
| `NDM-10` | 网络设备管理（Network Device Management） | `T-AD.SA-02 / T-PD.TP-04` | 确保组织的网络设备管理系统监控每个网络设备的状态，并在设备离线时记录和告警。 |
| `NDM-11` | 网络设备管理（Network Device Management） | `T-AS.AM-01` | 确保组织的网络设备管理系统为每个网络（包括 DHCP 范围）执行 IP 地址管理 (IPAM)。 |
| `NDM-12` | 网络设备管理（Network Device Management） | `T-AD.SA-02 / T-PD.TP-04` | 确保组织的网络设备管理系统记录每个网络设备的网络流数据。 |
| `NDM-13` | 网络设备管理（Network Device Management） | `T-AD.SA-02 / T-PD.TP-04` | 确保组织的网络设备管理系统定期比较每个网络设备的配置，以记录配置的任何变化并告警。 |
| `NDM-14` | 网络设备管理（Network Device Management） | `T-AS.CM-01 / T-AS.CM-02` | 确保组织的网络设备管理系统确保每台网络设备都使用该网络设备的最新固件。 |

## PHY（15 条）

| Safeguard ID | 保障措施域 | 候选关注点 | 依据摘要 |
|---|---|---|---|
| `PHY-01` | 物理安全管理（Physical Security Management） | `M-SA.RE-01 / T-PD.AC-01（后续建议新增物理安全关注点）` | 为组织维护一份记录在案的物理安全计划，记录组织将实施的物理安全保障措施。 |
| `PHY-02` | 物理安全管理（Physical Security Management） | `M-SE.SE-01 / T-AD.SA-02` | 定义组织用于监控和发现违反组织物理安全计划行为的流程。 |
| `PHY-03` | 物理安全管理（Physical Security Management） | `T-AS.AM-02 / T-PD.DP-06` | 确保组织记录的物理安全计划定义了安全处置物理资产的保障措施。 |
| `PHY-04` | 物理安全管理（Physical Security Management） | `T-PD.AC-01 / M-SE.SE-01` | 确保组织记录在案的物理安全计划定义了组织设施边界访问控制的保障措施。 |
| `PHY-05` | 物理安全管理（Physical Security Management） | `T-PD.AC-01 / M-SE.SE-01` | 确保组织记录在案的物理安全计划定义了在组织设施内授权、识别和监控访客的保障措施。 |
| `PHY-06` | 物理安全管理（Physical Security Management） | `T-PD.AC-01 / M-SE.SE-01` | 确保组织记录在案的物理安全计划定义了处理组织设施内部物理访问控制的保障措施。 |
| `PHY-07` | 物理安全管理（Physical Security Management） | `T-PD.AC-01 / M-SE.SE-01` | 确保组织记录在案的物理安全计划定义了安全处理物理访问设备（例如钥匙或卡）的保护措施。 |
| `PHY-08` | 物理安全管理（Physical Security Management） | `T-AS.AM-02 / T-PD.DP-06` | 确保组织记录在案的物理安全计划定义了明显标识组织技术资产分类级别的保障措施。 |
| `PHY-09` | 物理安全管理（Physical Security Management） | `T-AS.AM-02 / T-PD.DP-06` | 确保组织记录在案的物理安全计划定义了保护组织设施和技术资产的环境保障措施。 |
| `PHY-10` | 物理安全管理（Physical Security Management） | `T-PD.AC-01 / M-SE.SE-01` | 确保组织记录在案的物理安全计划定义了解决物理计算设备访问控制的保障措施。 |
| `PHY-11` | 物理安全管理（Physical Security Management） | `T-AS.AM-02 / T-PD.DP-06` | 确保组织记录在案的物理安全计划定义了个人如何从组织设施中移除技术资产的保障措施。 |
| `PHY-12` | 物理安全管理（Physical Security Management） | `M-SA.RE-01 / T-PD.AC-01（后续建议新增物理安全关注点）` | 确保组织记录在案的实体安全计划定义了保障措施以及组织如何确保无人值守空间的安全（如清空桌面策略）。 |
| `PHY-13` | 物理安全管理（Physical Security Management） | `T-AS.AM-02 / T-PD.DP-06` | 确保组织记录在案的物理安全计划定义了保护打印机、复印机或多功能设备等技术资产安全的保障措施。 |
| `PHY-14` | 物理安全管理（Physical Security Management） | `T-PD.AC-01 / M-SE.SE-01` | 确保组织记录在案的物理安全计划定义了记录设施实体访问日志的保障措施。 |
| `PHY-15` | 物理安全管理（Physical Security Management） | `M-SA.RE-01 / T-PD.AC-01（后续建议新增物理安全关注点）` | 定期对每个设施进行物理渗透测试，确保组织的物理安全保障措施按预期运行。 |

## PNA（1 条）

| Safeguard ID | 保障措施域 | 候选关注点 | 依据摘要 |
|---|---|---|---|
| `PNA-15` | 边界网络访问管理（Perimeter Network Access Management） | `T-PD.PP-02 / T-PD.PP-03` | 确保组织的基于 Web 的 URL 过滤系统阻止未经批准的Web 服务（例如电子邮件、存储或类似服务）连接。 |

## SDM（10 条）

| Safeguard ID | 保障措施域 | 候选关注点 | 依据摘要 |
|---|---|---|---|
| `SDM-03` | 软件开发标准化（Software Development Standardization） | `T-AS.DS-01 / M-PM.PR-01` | 维护记录在案的软件开发生命周期（SDLC），以管理组织的软件应用程序开发和维护。 |
| `SDM-04` | 软件开发标准化（Software Development Standardization） | `T-AS.DS-01 / M-PM.PR-01` | 确保组织的每个软件应用程序开发团队都遵循组织批准的软件开发生命周期 (SDLC)。 |
| `SDM-05` | 软件开发标准化（Software Development Standardization） | `T-AS.DS-06 / T-AS.AM-01` | 维护组织的软件应用程序开发团队（按团队）使用的每种软件开发编码语言的批准清单。 |
| `SDM-06` | 软件开发标准化（Software Development Standardization） | `T-AS.DS-06 / T-AS.DS-01` | 为组织的软件应用程序开发团队所使用的每种软件开发编码语言维护一套记录在案的编码标准。 |
| `SDM-07` | 软件开发标准化（Software Development Standardization） | `T-AS.DS-06 / T-AS.DS-01` | 确保每个组织的软件开发编码标准都规定了软件应用程序开发人员如何在其软件应用程序中执行输入验证。 |
| `SDM-09` | 软件开发标准化（Software Development Standardization） | `T-AS.DS-06 / T-AS.DS-01` | 确保每个组织的软件开发编码标准定义了软件应用程序开发人员如何在其软件应用程序中只使用组织和行业批准的数据交换协议。 |
| `SDM-10` | 软件开发标准化（Software Development Standardization） | `T-AS.DS-06 / T-AS.DS-01` | 确保每个组织的软件开发编码标准都明确规定软件应用程序开发人员如何在软件应用程序中执行错误处理。 |
| `SDM-11` | 软件开发标准化（Software Development Standardization） | `T-AS.DS-06 / T-AS.DS-01` | 确保组织的每项软件开发编码标准都规定了软件应用程序开发人员如何在其软件应用程序中纳入数据隐私值。 |
| `SDM-15` | 软件开发标准化（Software Development Standardization） | `T-AS.DS-06 / T-AS.DS-01` | 确保组织的软件开发编码标准要求自定义软件应用明确识别并记录应用暴露的应用程序编程接口（API），包括每个 API 的目的以及通过这些接口交换的数据类型。 |
| `SDM-16` | 软件开发标准化（Software Development Standardization） | `T-AS.DS-06 / T-AS.DS-01` | 确保组织的软件开发编码标准明确适用于应用程序编程接口（API），包括通过这些接口实现的输入处理、错误处理、认证、授权和数据暴露要求。 |

## SDO（24 条）

| Safeguard ID | 保障措施域 | 候选关注点 | 依据摘要 |
|---|---|---|---|
| `SDO-01` | 软件开发运营（DevOps）（Software Development Operations） | `T-AS.DS-05 / M-PM.PR-02` | 维护应用发布管理流程，以治理软件开发团队维护的应用发生重大变更时的设计、审查、测试、批准和部署。 |
| `SDO-02` | 软件开发运营（DevOps）（Software Development Operations） | `T-AS.DS-05 / M-PM.PR-02` | 确保组织的应用发布管理流程要求，软件开发团队维护的应用变更请求包含一份清单，用于表明所有必要的网络安全任务已经完成。 |
| `SDO-03` | 软件开发运营（DevOps）（Software Development Operations） | `T-AS.DS-05 / M-PM.PR-02` | 确保组织的应用发布管理流程要求，软件开发团队维护的应用变更至少由一名非该变更作者的开发人员进行审查。 |
| `SDO-04` | 软件开发运营（DevOps）（Software Development Operations） | `T-AS.DS-05 / M-PM.PR-02` | 确保组织的应用发布管理流程要求，网络安全主题专家批准软件开发团队维护的应用中面向网络安全的模块变更（例如通过 CODEOWNERS）。 |
| `SDO-05` | 软件开发运营（DevOps）（Software Development Operations） | `T-AS.DS-05 / M-PM.PR-02` | 确保组织的应用发布管理流程要求，在软件开发团队维护的应用部署流水线中运行网络安全检查。 |
| `SDO-06` | 软件开发运营（DevOps）（Software Development Operations） | `T-AS.DS-05 / M-PM.PR-02` | 确保组织的应用发布管理流程要求，在开发流水线中运行网络安全检查，并在软件开发团队维护的应用部署到生产环境前通过这些检查。 |
| `SDO-07` | 软件开发运营（DevOps）（Software Development Operations） | `T-AS.DS-05 / M-PM.PR-02` | 确保组织的应用发布管理流程将应用程序编程接口（API）纳入软件开发团队维护应用的设计审查、测试、批准和部署活动范围。 |
| `SDO-08` | 软件开发运营（DevOps）（Software Development Operations） | `T-AS.DS-05 / M-PM.PR-02` | 确保组织的应用发布管理流程要求，软件开发团队维护的应用所使用的密钥（如 API 密钥）存储在经批准的安全保管库中。 |
| `SDO-09` | 软件开发运营（DevOps）（Software Development Operations） | `T-AS.DS-05 / M-PM.PR-02` | 确保组织的应用发布管理流程要求，软件开发团队维护的应用所使用的认证密钥按照组织认证标准的要求进行轮换。 |
| `SDO-10` | 软件开发运营（DevOps）（Software Development Operations） | `T-AS.DS-05 / M-PM.PR-02` | 确保组织的应用发布管理流程要求，根据组织批准的访问控制和身份管理要求，将源代码仓库和持续集成/持续部署（CI/CD）平台的访问限制为授权用户和系统。 |
| `SDO-11` | 软件开发运营（DevOps）（Software Development Operations） | `T-AS.DS-05 / M-PM.PR-02` | 确保组织的应用发布管理流程要求，源代码仓库强制执行分支保护和变更控制机制，以防止对受保护分支进行未经授权或未经审查的变更。 |
| `SDO-12` | 软件开发运营（DevOps）（Software Development Operations） | `T-AS.DS-05 / M-PM.PR-02` | 确保组织的应用发布管理流程要求，将构建和部署执行限制为授权的 CI/CD 运行器，并确保已批准的软件制品不能在组织定义的发布管理流程之外被修改。 |
| `SDO-13` | 软件开发运营（DevOps）（Software Development Operations） | `T-AS.DS-05 / M-PM.PR-02` | 确保组织的应用发布管理流程要求，软件开发团队使用的功能开关按照组织的安全和部署要求进行审查、批准和管理。 |
| `SDO-14` | 软件开发运营（DevOps）（Software Development Operations） | `T-AS.DS-05 / M-PM.PR-02` | 确保组织的应用发布管理流程要求记录所有构建、批准和部署事件，以支持发布活动的可追溯性、审计和调查。 |
| `SDO-15` | 软件开发运营（DevOps）（Software Development Operations） | `T-AS.DS-05 / M-PM.PR-02` | 确保组织的应用发布管理流程要求，软件开发团队生成的所有软件制品在批准或部署前进行加密签名和验证。 |
| `SDO-16` | 软件开发运营（DevOps）（Software Development Operations） | `T-AS.DS-05 / M-PM.PR-02` | 维护组织应用发布管理流程所使用平台的清单，包括所有开发、预发布和生产环境，以及支持这些环境的数据库、服务和基础设施组件。 |
| `SDO-17` | 软件开发运营（DevOps）（Software Development Operations） | `T-AS.DS-05 / M-PM.PR-02` | 维护技术保障措施，以强制组织开发、预发布和生产应用平台之间的隔离。 |
| `SDO-18` | 软件开发运营（DevOps）（Software Development Operations） | `T-AS.DS-05 / M-PM.PR-02` | 确保用于强制开发、预发布和生产应用平台隔离的技术保障措施，将应用开发人员的访问限制为履行开发职责所必需的源代码仓库和代码管理系统。 |
| `SDO-19` | 软件开发运营（DevOps）（Software Development Operations） | `T-AS.DS-05 / M-PM.PR-02` | 确保用于强制开发、预发布和生产应用平台隔离的技术保障措施，将应用开发人员的访问限制为开发和测试活动所必需的应用平台和系统，并防止其对生产应用平台拥有特权访问。 |
| `SDO-20` | 软件开发运营（DevOps）（Software Development Operations） | `T-AS.DS-05 / M-PM.PR-02` | 确保用于强制开发、预发布和生产应用平台隔离的技术保障措施，将应用开发人员的访问限制为开发和测试活动所必需的数据库和数据集。 |
| `SDO-21` | 软件开发运营（DevOps）（Software Development Operations） | `T-AS.DS-05 / M-PM.PR-02` | 确保用于强制开发、预发布和生产应用平台隔离的技术保障措施，防止非生产应用平台存储超出测试和验证必要范围的敏感信息或个人可识别信息。 |
| `SDO-22` | 软件开发运营（DevOps）（Software Development Operations） | `T-AS.DS-05 / M-PM.PR-02` | 确保用于强制开发、预发布和生产应用平台隔离的技术保障措施，防止部署在开发和测试环境中的应用程序编程接口（API）暴露超出测试和验证目的所必需范围的敏感数据或生产数据。 |
| `SDO-23` | 软件开发运营（DevOps）（Software Development Operations） | `T-AS.DS-06 / M-PM.PR-02` | 为组织中每个需要实时保护的自定义软件应用维护运行时保护能力（如 Web 应用防火墙 WAF 或运行时应用自我保护 RASP），确保这些能力集成到应用架构中，并用于检测和阻断恶意运行... |
| `SDO-24` | 软件开发运营（DevOps）（Software Development Operations） | `T-AS.DS-05 / M-PM.PR-02` | 维护基础设施即代码（IaC）能力，以确保组织的应用平台和环境能够以一致且可重复的方式部署和重建。 |

## SDV（5 条）

| Safeguard ID | 保障措施域 | 候选关注点 | 依据摘要 |
|---|---|---|---|
| `SDV-16` | 软件开发漏洞管理（Software Development Vulnerability Management） | `T-AS.VM-02 / T-AS.DS-02` | 维护文档化的服务级别协议（SLA），定义组织缓解其自定义软件应用中发现的网络安全漏洞的时间目标。 |
| `SDV-17` | 软件开发漏洞管理（Software Development Vulnerability Management） | `T-AS.VM-02 / T-AS.DS-02` | 确保组织文档化的服务级别协议（SLA）要求，组织问题跟踪系统中跟踪的每个网络安全漏洞均在 SLA 定义的时间范围内得到修复。 |
| `SDV-18` | 软件开发漏洞管理（Software Development Vulnerability Management） | `T-AS.VM-02 / T-AS.DS-02` | 确保组织文档化的服务级别协议（SLA）要求，组织自定义软件应用使用的已批准软件库和第三方模块中识别出的网络安全漏洞，在 SLA 定义的时间范围内得到修复，包括应用与网络安全相关的更... |
| `SDV-19` | 软件开发漏洞管理（Software Development Vulnerability Management） | `T-AS.VM-02 / T-AS.DS-02` | 确保组织文档化的服务级别协议（SLA）要求，对组织漏洞修复时间范围的任何例外均正式记录、批准，并在组织的问题跟踪系统中跟踪。 |
| `SDV-20` | 软件开发漏洞管理（Software Development Vulnerability Management） | `T-AS.VM-02 / T-AS.DS-02` | 确保组织文档化的服务级别协议（SLA）要求，定期向适当的利益相关方报告组织问题跟踪系统中跟踪的每个网络安全漏洞的状态。 |

## SW（4 条）

| Safeguard ID | 保障措施域 | 候选关注点 | 依据摘要 |
|---|---|---|---|
| `SW-06` | 软件管理（Software Management） | `T-AS.VM-02 / T-AS.AM-01` | 确保组织的软件清点系统验证组织软件清单中的所有操作系统软件都是最新的。 |
| `SW-07` | 软件管理（Software Management） | `T-AS.VM-02 / T-AS.AM-01` | 确保组织的软件清点系统验证组织软件清单中的所有应用软件都是最新的。 |
| `SW-08` | 软件管理（Software Management） | `T-AS.VM-02 / T-AS.AM-01` | 为组织维护服务水平协议 (SLA)，定义每个软件应用程序的软件更新频率。 |
| `SW-15` | 软件管理（Software Management） | `T-AS.AM-02` | 定义组织应使用的流程，以便及时从每个计算机系统中删除未经授权的软件。 |

## VAL（2 条）

| Safeguard ID | 保障措施域 | 候选关注点 | 依据摘要 |
|---|---|---|---|
| `VAL-01` | 保障措施验证管理（Safeguard Validation Management） | `M-SE.SE-01 / T-AD.SV-02` | 维护网络安全保障验证（审计）计划，记录组织为验证组织网络安全保障措施的质量而应执行的评估。 |
| `VAL-02` | 保障措施验证管理（Safeguard Validation Management） | `M-SE.SE-01 / T-AD.SV-02` | 确保组织的网络安全保障验证（审计）计划是一项多年期计划，定期对组织应评估的所有范围进行处理。 |
