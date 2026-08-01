# Findings Index: SAPD 工作知识库系统

本文档只保留当前仍有效的关键决策、重要风险和历史入口。详细过程记录、阶段性发现和旧判断已归档。

## 当前关键决策

- 2026-07-31 成熟度本地资产生命周期冻结为“显式保存 + 所有权删除约束”：模板节点属性
  由常驻底栏一次提交，不再在失焦阶段写入并重绘；成功后关闭详情栏，失败时保留输入。
  模板 Tab 固定占满项目工作区且项目页自身不滚动，模板总保存和节点保存入口保持可达。
  首页默认显示全部项目并同时展示项目名 / 客户名，避免把筛选或字段隐藏误判为测试数据
  丢失。标准模板操作区只显示导出，不用禁用按钮表达不可删除。
  评估项目删除必须应用内双重确认并写本地 tombstone；项目自定义模板默认原子保留为
  “原项目已删除”资产。标准模板永久置顶且不可删除，活动项目模板只能先回项目或先删除
  项目，原项目删除后的保留模板、模板管理自建模板和导入模板才可单独删除。当前删除仅
  管理浏览器本地工作区引用，不宣称物理删除 API 项目或外部报告工件。
- 2026-07-31 成熟度模板资产冻结为“标准定义只读来源 + 自定义模板内覆盖 + 校验后保存”：
  L0 / L1 / L2 / 关注点定义由后端从知识对象投影，安全技术服务使用知识库已有定义；
  标准来源节点只能在当前自定义模板副本中修改，修改后成为“标准修改”，不得写回保护
  字典或固定模板。新增节点定义为可选。首页新增模板与项目评估模板共用同一图谱编辑器，
  但首页模板工作区不进入项目队列或评分流程；项目模板只有校验保存后才进入模板管理并
  显示来源项目。项目来源原件只能回到来源项目优化；在模板管理独立维护必须先创建副本。
  新项目只在“固定 / 自定义”两类中选择，自定义再从模板管理选择来源并生成项目专属
  新 ID，不能改写已保存来源模板。当前 `isCritical` 不参与校验、评分、优先级或报告，
  因此界面不再提供“设为关键能力”；如未来需要关键短板，应另建可解释的阈值 / 封顶
  规则。脑图目录浮层因与画布重复而移除，顶部搜索承担展开祖先、居中定位和打开属性的
  唯一快速导航。当前共享资产保存在受控浏览器本地状态，不改变正式 SQLite、源 Excel、
  评分公式、Rubric 或真实用户数据库。
- 2026-07-31 成熟度自定义模板的服务角色冻结为“按能力类型系统判定，不允许用户选择”：
  T 类能力下的安全技术服务固定为 `ASSESSMENT_POINT` 并形成独立 `SERVICE` 评估点；
  G / M 类能力下的服务固定为 `PLATFORM_EVIDENCE_REFERENCE`，只支撑关注点评估点的
  平台与工具维度；T 类关注点没有服务时也由关注点形成 `FOCUS` 评估点。平台工具参考
  不是知识库独立对象类型，而是 maturity 对 `security_technical_service →
  supports_focus → capability_focus` 关系赋予的模板语义。能力类型按当前 L0 → L1 →
  L2 路径识别，无法识别的自定义路径按 T 处理；加载、创建、移动、XLSX 导入和后端
  校验必须共用该规则。当前基础模板 160 条服务关系中，154 条为 T 类独立评估点、6 条
  为 M 类平台参考，G 类当前没有服务关系。该裁定改变模板结构校验与导入约束，不改变
  评分公式、Rubric、保护字典、正式 SQLite 或历史结果。
- 2026-07-30 自定义模板通用评分依据冻结为“后端单一内容源 + 仅补新建对象”：
  `sapd-maturity-custom-generic-rubric-v3-2026-07-30` 同时维护 L1—L5 通用描述和
  4 个维度 × 5 个等级的精炼 Rubric，前端只投影，不得另写第二套文案。自定义模板
  中新建且没有对象专用评分依据的评估点使用 `CUSTOM_GENERIC_FALLBACK`；从基础模板
  复制的对象专用评分依据必须保留，固定模板缺失依据仍保持阻塞，不能用通用基线静默
  掩盖业务缺口。L4 通用语义为稳定运行、结果可比较、依据批准目标或控制边界识别偏差、
  纠正并验证效果，不预设 KPI；L5 必须以稳定 L4 证据为基础，验证并固化改进，不以
  AI 为必要条件。该裁定改变 shared runtime 的自定义模板草稿及 XLSX 交换，不修改
  正式 Rubric 字典、评分公式、历史结果、SQLite 或真实用户库。
- 2026-07-30 自定义评估模板的信息架构冻结为“完整模型 + 默认收起到 L1 + 逐层披露”：
  基础模板仍保留 3 个 L0、10 个 L1、32 个 L2、91 个关注点和 160 条服务关系，进入
  无限画布时默认只显示 1 个模板根、3 个 L0、10 个 L1 和 13 条关系线。模板根及所有
  存在下级的能力 / 关注点常驻收起 / 展开按钮，L1 → L2 → 关注点 → 服务逐层展开；
  节点边缘不再用“＋”新增，新增下级 / 同级统一进入右键菜单。目录定位深层对象自动
  展开祖先路径；能力、关注点和服务换父级时带上完整下级子树。模板编辑继续使用有类型
  树约束，不开放任意 Node-Edge 连线；该决定只改变 shared frontend 与项目自定义模板
  草稿，不改变基础模板、评分规则、Rubric、正式数据或真实用户库。
- 2026-07-30 SAPD 成熟度 V3 评分依据治理冻结为“逐关注点连续范围 + 评估点继承 /
  有理由覆盖 + 量化控制与效果验证”：不采用统一默认 L1—L5，也不新增 Level 0 或“未执行 /
  无充分证据”结果状态；每个关注点基于能力性质、最佳实践、证据可得性和实际运行方式
  独立确定连续起止等级。项目“不适用”、模板“等级不设置”和三档“目标等级建议”必须
  分离。L4 保持“量化控制”名称，以稳定运行、跨周期可比较结果、正式批准的控制目标 /
  质量要求 / 时限 / 容忍边界、偏差纠正和效果验证为判定核心；V3 不预设通用或关注点
  专用指标，未经来源、口径、数据质量和批准机制验证的候选指标不得进入评分正文。
  自动化只是支撑。L5 不以 AI/ML 为必要条件，且必须同时具备稳定 L4 基础、明确改进
  触发和目标、结果验证、前后效果比较及有效改进固化。当前逐项复核结果为 78 个关注点
  L1—L5、9 个 L2—L5、4 个 L3—L5；全部结束于 L5 是逐关注点确认仍存在独立、
  可验证的持续优化对象后的本轮结果，不是统一的最高等级硬规则。T-IN.IP 按 L2—L5；
  T-OF 条件适用并从 L3 起评。V3 指南、基线主表、差异说明、结构化提案和
  离线工作台均为业务审阅提案，不得在未完成裁定和正式迁移授权时改写 V2.1 正式字典、
  API、评分结果、源 Excel、SQLite、历史项目或用户库。
- 2026-07-28 Keychain 故障处理收敛为 0.3.0 最小修复：用户确认交互解锁
  `login.keychain-db` 后，原证书、OAuth 和 MCP 链路可以恢复，因此当前不再把该事件
  定性为证书失效或口令永久丢失。源码恢复 `/usr/bin/security` 登录钥匙串路径；
  Native Security Broker、Data Protection Keychain 接线、桌面 `app` profile 强制和
  因本事件扩展的签名 / 公证实现均已回退。未来如需更换安全存储架构或正式发布链路，
  必须作为独立任务取得复现证据、范围和验收授权，不能混入临时 Keychain 故障修复。
- 2026-07-28 MCP 安全存储错误分类冻结为“临时不可访问不等于密钥丢失”：平台安全
  存储的临时错误投影为 `error / CERTIFICATE_SECRET_STORE_UNAVAILABLE`，不得终止
  已完成一次性口令消费且 TLS 健康的 Sidecar，安全存储恢复后由用户重新启动；
  macOS Keychain 读取、写入或删除阶段的交互禁止 / 认证失败返回码 `36 / 51` 同样
  归类为 `SECRET_STORE_UNAVAILABLE`，证书事务自动回滚并提示用户解锁“登录”钥匙串，
  不得转换成泛化 500、不得继续建议重置，也不得尝试保存或猜测用户登录密码；
  只有明确条目不存在、设备绑定永久失效或密钥材料不可解密才进入
  `key_unavailable` 并要求重新建立安全连接。
- 2026-07-28 对外项目介绍冻结为“本地优先的可追溯安全架构知识系统”：公开 README
  和 GitHub About 只说明多来源知识治理、关系工作台、桌面交付与只读 MCP，不把项目
  描述成静态网站、单次 ETL、公开数据集或云端知识服务。公开仓只含代码、合同、文档
  和脱敏样例；正式知识库、源资料、用户数据、Delivery Data 和安装器始终留在本地或
  私有交付域。当前业务愿景与架构入口分别为 `docs/00-overview/project-vision.md` 和
  `docs/01-architecture/architecture.md`。
- 2026-07-27 文档权威顺序冻结为“当前状态 / 现行合同 / 操作手册 / 历史证据”四层：`CURRENT_STATE.md` 说明当前事实，`task_plan.md` 只保留未完成主线，`docs/README.md` 按场景导航，`docs/DOCUMENT_GOVERNANCE.md` 定义状态和归档；completed / historical / retired 文档不得指导新实现。依赖已删除分支、旧任务机制、ZIP alpha 或 Mac 手工组装 Windows 安装器的材料统一进入 `docs/05-archive/`，不再留在当前治理和交付目录。
- 2026-07-27 Windows GitHub Installer 迁移冻结为“macOS 本地不迁移 + 私有仓主动拉取公开源码 + 私有构建”：Windows 源码以公开 `main` 为唯一事实源，私有仓按精确 `source_sha` 与不可变 Delivery Data 在 `windows-2022` Runner 生成完整 MCP backend、Electron Runtime 和 NSIS `Setup.exe`；正式 SQLite、Delivery Data 和安装器不进入公开仓。W0—W5、相同输入双构建和指纹比较已完成，旧 backend-only / Mac组装流程与 `codex/windows-electron` 分支已经退役；当前安装包作为 Internal Release 可直接使用，未执行真实 Windows 10/11 UAT 时不得伪装为正式实测通过。macOS 继续读取正式 Mac 主工作区批准数据库并本地打 DMG，不依赖 Windows Delivery Data。详细入口见 `docs/09-delivery/desktop-packaging-runbook.md` 与 `docs/09-delivery/windows-github-installer-migration-plan-2026-07-27.md`。
- 2026-07-27 MCP 凭据与审计展示合同冻结为“1小时短期访问 + 原始审计逐条保留 + 低风险成功事件界面聚合”：Access Token 默认TTL为3600秒，refresh token仍为30天并保持单次轮换、复用即撤销及Resource/scope/runtime绑定。只允许在控制API展示投影合并24小时内同一客户端的成功`TOKEN_REFRESHED`和同名成功`TOOL_CALL`，次数、最早/最近时间、返回数和耗时必须显式投影；任何授权、签发、撤销、失败、异常或其他安全事件均不得合并并切断当前聚合段。`event_count`、保留上限和清理策略继续基于独立控制库的原始逐条记录，不得为了界面降噪修改或删除底层审计。
- 2026-07-26 Draw.io 内容入库粒度冻结为“有效页签独立内容、空页不入库、来源物理定位不重编号”：0节点且0连线的页签不是知识对象，不得生成片段、关系、证据或有效数量；有内容页签各自可精确查询。为保持可追溯性，过滤空页后仍沿用源文件物理页签序号和定位，因此本例有效ref为 `page:001` 与 `page:003`，不得把底图伪装成物理第2页。对外文档元数据只声明 `contentUnitCount` 和 `contentUnitMode=independent`，不把源文件物理页签数描述为业务内容页数；源Draw.io与其资产BLOB保持不变。
- 2026-07-26 信息化环境主数据P7.1冻结“定义来自受控裁定、关联使用来自真实上下文投影”：原始Excel没有环境或对象定义列，环境子类定义本来也来自P2基于名称和关系上下文的人工作业裁定；因此新增的10条环境和51条对象定义必须明确标记为裁定文本，不能冒充源原文，也不得由前端运行时临时推断。字典关系上下文仍保持29个环境子类和67个对象上下文，正式关系不增不删；环境主数据的展开列表必须投影其所属29个真实子类上下文，而不是10条环境自身占位，故三类关联使用口径固定为29/29/67共125条。摘要和按钮数量只能来自同一可展开集合，逐环境为3/5/3/1/4/4/2/1/3/3。P7.1恢复包同时保护基础库、用户库和字典包；关系、身份、来源证据、用户库或源Excel任一漂移都触发基础库/字典恢复。
- 2026-07-26 信息化环境主数据P7正式采用“主数据字典默认启用 + 旧目录明确兜底”的受控运行策略：`environmentMasterDictionary=true` 只改变shared runtime展示来源，不重写数据库或关系包；主数据仍为10/16/51，关系上下文仍为29/67，Dashboard仍单独使用10环境、51对象、6作用域类型的投影口径。开关、API、包或schema异常时继续回退旧10/29/67目录；若出现用户引用失效、关系错配、计数混算或空白页，第一回退动作是关闭开关，不恢复已验证的P6加法迁移。P7已通过正式API、环境映射深链、40条用户批注引用、受保护边界和应用内浏览器观察，当前门禁进入P8；系统Chrome、App和DMG证据仍未完成，P6恢复包在P8通过且用户允许前不得归档。
- 2026-07-26 信息化环境主数据P6正式迁移已执行并冻结为“非破坏性expand + 可验证热备份回退”：正式库仅回填61个空编号，并新增16个子类类型、29条 `instance_of`、58条来源引用和106条审计，不删除29/67上下文、不改旧7757关系端点或证据；重复执行写入为0。P6恢复判据同时保留SQLite热备份、完整性/外键、逻辑快照、逐关系哈希、保护文件哈希和用户引用解析，不能仅依赖物理SQLite文件哈希；恢复包 `data/exports/worker-verify/plan-env-md/p6-20260726T015418Z/` 必须保留到P8通过并由用户明确允许归档。P4影子字典与正式投影字节一致，因此P6原位晋级而未替换旧环境树或拆分投影。P6当时对P7保持未授权，现已由上一条用户授权的P7决策取代。
- 2026-07-26 信息化环境主数据P4—P5冻结为“加法影子包 + 默认关闭开关 + 旧树明确兜底”：`environment-dictionary-v1` 分离10/16/51条唯一主数据与29/67条关系上下文，前端只能消费声明的主数据集合和106条用法关系，不得按标题去重或推断归属；主数据统计与上下文统计始终分开。关系导航必须显式使用环境/子类/对象ID，不能以名称或默认首项代替当前对象。开关关闭、包缺失、API失败或schema不兼容回退旧10/29/67目录；合法空集必须保持空集，不得伪造成旧数据。P4/P5阶段保持开关关闭的历史门禁已经完成，正式启用状态以上一条P7决策为准。
- 2026-07-25 macOS Chrome 真实验证推翻了“hostname-scoped CurrentUser trust settings 可直接供 Chrome 使用”的旧假设：macOS `security verify-cert` 可以接受 `sslServer + 127.0.0.1` 策略条目，但 Chrome 仍返回 `ERR_CERT_AUTHORITY_INVALID`。正式兼容决策改为当前用户 `trustRoot`，同时把有效范围锁在 CA critical `nameConstraints=127.0.0.1/32`、服务器 leaf IP SAN 和 Sidecar loopback 监听三重边界；启动检查必须同时通过服务器 SSL 和 CA `basic` 根信任验证，旧策略条目必须显示“信任缺失”并经用户确认迁移。该决策不授权系统级/LocalMachine 信任、其他地址、持久 CA 私钥或后台静默批准。
- 2026-07-26 信息化环境对象字典冻结为“唯一主数据 + 保留关系上下文”，P1—P3均已通过：信息化环境和信息化对象复用既有稳定身份；16个子类标题组经上下文语义逐条裁定为16条 `environment_segment_type`，跨环境同名的网络、人员、PC终端、移动终端和工作负载复用同一类型，“业务应用”与“应用及数据”因云/传统运行结构不同保持独立。正式编号清单为10条 `IE-*`、16条 `ES-*`、51条 `IO-*`；29个 `environment_segment` 是不编号的上下文实例，每个精确规划一条 `instance_of`，现有29/67上下文不删除、不按标题合并。导入必须按环境 qualifier 匹配 segment，父环境变化必须清空子状态，`instance_of` 以来源端唯一且目标变化停止裁定。P3临时库已证明首次应用、重复应用、候选包开关回退、精确逆向回退和事务故障回退，回滚判据使用业务表/FTS/Schema逻辑快照而非易受SQLite页布局影响的物理文件字节；正式输入全程未变。重复审批追加来源引用和审计日志的既有限制继续由 `OI-198` 管理。正式合同位于 `docs/01-architecture/contracts/environment-master-data/v1/`，P3报告位于 `data/exports/worker-verify/plan-env-md/p3-20260725T162703Z/`；P4只做影子导出/API，P6正式apply仍需单独授权。
- 2026-07-25 MCP 生命周期合同冻结为“显式意图 + 自动恢复”：用户点击启动表示持续启用，SAPD Wiki 后续启动应自动恢复 MCP；用户点击停止、修改端口或重置表示持续禁用，不得擅自拉起。平台集成 Runtime 固定在当前用户应用私有目录，持久化非明文授权验证材料、稳定 instance/runtime identity、客户端与 token-family verifier；不保存 bearer / refresh token 明文。Sidecar 意外退出按有界退避自动重启，证书无效、密钥不可用、信任冲突和端口占用仍失败关闭，不进入无限重试。Streamable HTTP 客户端断开本身不需要服务器主动外连；“断线恢复”由服务恢复 + 客户端 refresh token 重连共同完成。MCP 传输以 `2025-11-25` 为 canonical 版本，但请求头校验必须接受当前 MCP SDK 声明支持的正式协议版本以完成协商，未知版本仍返回 `PROTOCOL_VERSION_UNSUPPORTED`；不得把 canonical 版本误当成唯一允许的客户端版本。未来 `2026-07-28` 仅在成为正式规范、Python MCP SDK 与目标客户端具备支持后进入触发式 G 阶段，实施 Legacy `2025-11-25` / Modern `2026-07-28` 双时代兼容；不得在 Draft 阶段提前切换 canonical 或删除 Legacy 路径。Web 5173 通过不等于 App / DMG 或 Windows 验收。
- 2026-07-24 MCP 数据授权的业务口径由用户最终裁定为：正式基础知识库一经入库治理，其全部业务知识内容均允许 AI 通过受控只读工具检索和使用，包括完整标准条款、非 public 来源对应的入库业务内容以及 deprecated 对象；不再建立 `public_summary / ai_summary` 二次内容门禁。该授权不等于开放整台电脑或数据库直连：用户数据库、源文件本体、文件系统、本机路径、内部数据库 ID、系统配置与凭据、日志、写入、ATTACH 和客户端 SQL 永久排除；来源追踪只返回基础库中的脱敏 provenance。正式机器合同为 `docs/01-architecture/contracts/mcp/base-knowledge/v1/`，scope 为 `sapd.base.knowledge.read`；旧 `docs/01-architecture/contracts/mcp/v1/` 仅保留为 M0-T synthetic 历史验证合同。返回内容始终标记为 `untrusted_reference`，不得解释为系统指令。
- 2026-07-24 Git 工作区治理已落地为“正式主目录 + 本地 `main`”单分支日常模型。10 个旧本地功能分支和全部 linked worktree 已在 complete-history bundle、dirty patch / untracked archive、用户库热备份与报告历史恢复点验证后移除；有效分支 tip 均成为 `main` 祖先，并由完整 pre-commit、搜索 `38/38`、MCP `102/102` 和正式目录 runtime suite 证明集成态。后续功能分支与 worktree 不再作为默认开发方式；只有明确需要隔离的独立长期任务才创建，并且不得与正式主目录并发写同一 owner。远端 push 与远端分支删除始终是两个独立、需要用户明确授权的外部写操作；打包源码、真实 `data/` 和未完成设计 WIP 不因本地收敛自动进入 Git。
- 2026-07-24 “Issue 归零 + 指南待补充”并非真实数据删除，而是稳定 `5173` 被 `/private/tmp/SAPD_Wiki-main-merged` 占用：该 worktree 有独立空用户库 `user_notes=0`，而正式主目录用户库仍为 `user_notes=40`；指南 JSON、75 页幻灯片元数据和图片也均完整。原 `dev_server_guard --start` 只判断端口上的 SAPD 进程与基础 health，不检查服务所属项目根目录，因此会错误接受临时 worktree。现守卫把 primary Git worktree、base DB、user DB 和 data root 纳入 5173 profile；从 linked worktree 启动 5173 会被阻止，主目录执行 `--start` 遇到错误 profile 会自动重启。该问题属于运行实例错配，不允许通过复制/覆盖数据库、放宽数据路径边界或把临时空库当正式库处理。
- 2026-07-24 Git 工作区最终模型改为“单一主工作目录 + 单一 `main` 分支”。现有 10 个功能分支不能逐支机械 merge：MCP 旧链与 `main` 的 4 个重建提交历史不同，直接 merge 会引入重复实现和冲突。收敛按交付物等价性执行，所有旧分支必须取得 `absorbed / superseded / 用户确认 abandoned` 结论；两处 dirty worktree 先建立 bundle、binary patch 和 untracked allowlist 恢复点，再把有效成果按 Windows / Electron、shared frontend、成熟度、App / 导出、MCP 证书与治理批次直接重建到 `main`。最终验证必须在主项目目录的原生数据路径运行；临时 `/private/tmp` main worktree 的外部 data symlink 被 `_frontend_data_path()` 拒绝是正确安全行为，由此产生的 5 项搜索检查失败不属于原有产品基线，不得通过放宽目录边界修复。
- 2026-07-24 C1 前稳定证书边界冻结为：证书轮换必须先 stage 新代、安装并验证新信任，再切换 active；任何中断都由持久 journal 恢复，旧代在切换后保留 24 小时并按完整 SHA-256 精确清理。同 profile 只允许一个写者，未知 journal schema、跨 profile、密钥不可用、信任冲突或运行中信任漂移均失败关闭。Web 5173 在用户尚未建立 CurrentUser MCP Runtime 时使用隔离 fake；首次平台集成仍需显式授权，但一旦已建立持久 Runtime，稳定启动守卫必须自动复用同一 Runtime，不得回落到会丢失页面授权 / 审计投影的临时目录。真实证书写入、轮换和重置仍需用户确认。Windows 仅冻结 CurrentUser Root 合同，实机写入验证留在平台阶段。该 C0 完成不代表 App 接线或打包获批。
- 2026-07-23 系统设置的产品入口固定在 shared frontend 的 `/settings/system` 与 `/settings/ai-integration`，开发验收入口固定为 stable `5173`。`5173` 是 Web 保留端口，MCP Sidecar、synthetic fixture 和测试进程都不得占用；Web 控制层只允许 loopback host，并通过同源会话 API 管理隔离 Sidecar。旧 `synthetic_web` 状态机不得与真实控制链路并存。路径修改不得开放“任意路径字符串写入”HTTP 接口：Web 只读展示，macOS / Electron 必须通过无参数原生目录选择器桥返回受控结果；`文件上传路径` 沿用既有 `importDirectory / import_dir`。顶部 MCP 状态监测是服务状态、客户端授权和产品授权的唯一全局摘要。父 Runtime 必须拥有并清理 Sidecar 生命周期，MCP 依赖使用独立项目虚拟环境，不污染 stable 5173 的系统 Python。

- 2026-07-23 的 `docs/01-architecture/sapd-wiki-local-mcp-requirements-and-prd-v0.5.md` 保留为原始 M0-T / D0 评审基线，其中 TLS、OAuth、零用户库副作用、unsafe key-passphrase IPC `BLOCKED`、stable identity 与真实平台验证要求继续有效；其中“只有公开摘要可开放、`ai_summary=0` 因而正式可开放量为 0”的内容授权结论，已被 2026-07-24 用户裁定和 `MCP-BASE-KNOWLEDGE-ACCESS-v1` 正式替代。后续不得再用旧 D0 摘要门禁阻止基础知识库业务内容查询，也不得借新授权放宽用户库、源文件、路径、凭据、客户端 SQL、平台信任和 App/打包边界。
- 2026-07-20 成熟度目标状态的正式输入粒度由单一目标等级升级为与当前评分对称的四个维度：`targetElements` 与 `targetDimensionNotes` 是新契约，`targetLevel / targetReason` 只保留为旧数据兼容投影。当前与目标使用相同维度权重分别计算综合指数；所有入口统一执行 `目标状态 >= 当前状态`，相等是合法值，只有目标低于同维度当前状态才形成 `targetDimensionConflicts` 并阻塞切换、统计和完成。批量目标下限等于适用下级四维当前最高等级，批量当前上限等于已有目标最低等级，L5 当前允许 L5 目标。新版 XLSX 逐维校验，旧版单一目标按当前四维最高等级校验。旧数据只在新字段缺失时展开，显式但未完成或低于当前的四维目标继续原值展示并给出冲突，不静默抬高或回退旧值。
- 2026-07-20 成熟度测试项目数量按运行场景分层：开发工作台保留 `5` 条受控项目，便于状态、筛选、分页和编辑回归；Mac App / ZIP bundle 交付运行时只包含 `2` 条测试项目。该差异必须由后端 workspace profile 和显式 runtime label 决定，前端不得自行截断。项目基本信息属于可维护项目事实，修改后必须同步 `customerContextSnapshot`、历史记录并使旧结果 / 报告失效重算，但不得改变模板、评分、状态或完成门禁。
- 2026-07-17 成熟度第三十一轮根因结论：L2 摘要不是单纯的列宽问题，而是两个后置共享规则共同破坏了业务子格归属——评估点内部从等宽 grid 被覆盖为 intrinsic flex，成熟度 level / score 又继承旧 `align-self:end`。正确契约是收窄评估点、恢复两个等宽状态子格，让当前 / 目标、四维、适用性、进度分别在自身子格水平居中，并让成熟度等级 / 连续分数与四维均值共享 `28px` token、围绕“维度名称 + 数值”组合块中线对齐。该结论适用于所有 L2 评分上下文，不适用于 L2 聚合统计或项目概览；不改变评分、聚合、门禁、对象粒度或正式数据。
- 2026-07-17 成熟度第二十七轮根因结论：滚动 owner 必须继续上移到能覆盖“目录上下文 → 摘要 → 当前评估点 → 完整评分”的项目页外层，评分表单不能再作为第二个滚动窗口；窄屏的摘要问题不是缩小字体，而是按业务组换行。结果 T / G / M 不是“分层评价”抽象统计，而是三个能力类别评分，代码必须与其当前分数紧邻、目标留在同类别辅助行。报告的 Markdown / HTML 是两个独立交付物，但都必须复刻同一后端完整评估结果并合并人工文字，不能把“人工填写区”误当作报告主体。本轮只改变 shared frontend scroll / visual layout 和 report presentation，不改变评分、聚合、完成门禁、数据粒度或正式数据。
- 2026-07-16 成熟度第二十六轮根因结论：滚动 owner 必须对应完整用户任务，而不是对应某个可滚动 DOM 子列。评分执行的正确契约是完整评分表单单滚动、四维打分列自然展开、评估概览在该 owner 内 sticky；第二十五轮“四维列唯一滚动”历史结论由本轮用户复验覆盖。页面比例也必须对应信息权重：项目概览为项目情况 / 进度 `2:1`，宽屏首页为项目 / 模板约 `1.85:1`，四维雷达必须同时放大画布和真实半径，不能只拉高容器。默认模板 canonical 显示名为“SAPD标准能力成熟度模板”；这些均为 shared frontend / display contract，不改变评分、聚合、门禁、模板结构或正式数据。
- 2026-07-16 成熟度第二十五轮根因结论：评分上下文、打分区和评估概览不能共享同一个页面滚动 owner；正确契约是上下文随页面自然滚动，而评分表单内部只有四维打分列滚动，概览与保存操作保持静止。结果雷达也不是简单纵向追加：宽桌面左列必须把全能力分组雷达与压缩四维雷达作为一个视觉组，右列才是分层统计。结果标题已拥有当前等级，指标条只保留目标 `level + index`；删除说明文字不改变后端同粒度数据所有权。浏览器与专项 `207/207` 已把滚动几何、雷达 DOM 嵌套、目标唯一卡和共享 Tab 名称固化为反回归契约。
- 2026-07-16 成熟度评估第二十四轮实施验证：反馈、模板、雷达、等级 / 指数和报告并非五个孤立样式问题，而是“项目瞬时状态不得越过路由、模板资产必须可见且导入不可覆写基准、结果图表必须按诊断顺序连续、离散等级与连续指数不能同层、报告快照必须可供汇报二次编辑”的同一交付契约。应用内 Browser 已验证返回首页后反馈数 `0`、首页 `更多` 按钮 `0` / 模板管理区 `1`、雷达栈顺序为 capability → dimension、报告四个文字区与 Markdown / HTML 双导出、页面横向溢出 `0`、console warning / error `0`；专项审计 `205/205` 固化完成门禁、模板副本和报告格式反例。
- 2026-07-16 成熟度评估第二十轮截图首批结论：四维成熟雷达不是独立尾部板块，必须与全能力分组雷达放在同一结果分析区域，并紧随全能力分组雷达之后；两张雷达分别回答“能力分组差距”和“总体四维均衡性”，不能互相替代。现有结果页在分组雷达左侧下方留下大块空白，说明组合区仍按不对称双栏固定高度布局，修复应调整结果区 DOM 顺序和内容驱动网格，不得用空占位或固定高度补齐。
- 2026-07-16 成熟度评估第二十轮模板与指标展示结论：`更多` 菜单中的“模板管理 / 历史导入任务”只是入口堆叠，缺少首页上的资产可见性与任务闭环；首页应同时承载项目进展与模板资产两个区域，模板管理拥有独立的默认模板、自定义模板、导入、导出和历史任务视图。模板导入必须以模板版本为粒度，默认模板可复制/导出但不得被导入静默覆盖。当前/目标成熟度不能把 `L3 3.29`、`L4 4.09`拼成同一层级的大字串；等级是离散分类，分数是精确连续值，必须使用“等级主标 + 分数次标”或等价清晰层级，并保留当前蓝、目标金的非颜色文本区分。
- 2026-07-16 成熟度评估第二十轮完成与返回状态结论：完成评估只由真正阻塞条件决定，`不适用`与`无证据（信息）`属于已解释或可补充状态，不进入阻塞集合；成功提示必须属于项目页动作反馈区，不能固定在全局右上角，也不能在返回成熟度首页后残留。项目返回动作必须同时清理项目级瞬时通知、当前项目 Tab/选择和待执行跳转，仅保留已经提交的后端项目状态。图 5 的 `未完成=0 / 目标冲突=0 / 不适用=19 / 无证据=16` 是完成规则黄金样例，返回图 6 首页后通知数量必须为 `0`。
- 2026-07-15 成熟度第十六轮用户视觉裁定：评分五档单元格只保留 `L1—L5`，删除“非正式执行 / 计划跟踪 / 充分定义 / 量化控制 / 持续优化”等等级名称；维度名、档位和当前对象 Rubric 正文放大并建立更清楚的字号层级。目标等级保留，`目标理由` 与 `评估证据说明` 合并为一个非必填说明字段。评估概览删除项目适用评估点、强项 / 待加强和目标达成率，标题与核心数值放大。L0 / L1 / L2 的当前汇总、当前四维雷达和第二雷达在桌面同排；第二雷达分别命名为 `下属能力域雷达图 / 归属能力雷达图 / 归属关注点雷达图`。`当前轮廓 / 目标参考` 改为更直白的当前结果 / 总体目标参照语义，并继续明确总体目标不是逐维目标。
- 当前 `MaturityAssessmentWorkbench.js` 仍把 `targetReason` 纳入 `isScoreEntryComplete`、状态“待补目标理由”和提交复核阻塞条件，且同时渲染 `targetReason` 与 `evidenceSummary` 两个文本框；因此本轮不能只删标签，必须把完成条件调整为“四维评分 + 目标等级”，并以现有字段兼容方式合并说明入口，避免 UI 显示可选但流程继续阻塞。首次全仓搜索误带不存在的 `backend/`、`packages/` 路径并返回路径错误，已改用 `src/sapd_wiki/maturity.py` 与实际目录继续核对，不重复该错误命令。

| 决策 | 当前结论 | 详细来源 |
|---|---|---|
| 当前主线 | 已导入 Sheet 的业务含义复核 + 前端关系展示校正 | `CURRENT_STATE.md`, `task_plan.md` |
| 当前前端范围 | 关系工作台覆盖安全能力、LC-AP / LC-DT、信息化环境、知识目录、标准 / 框架与成熟度；页面实现必须遵守当前信息架构、全局设计基线和 implementation specs | `docs/04-frontend/frontend-information-architecture.md`, `docs/06-implementation/frontend-global-design-baseline-2026-05-30.md`, `frontend/design-handoff/implementation-specs/` |
| 信息化环境维度定位 | 第一批核心数据的独立业务视角，不是新 Sheet 扩展；对象身份和关系粒度以后端合同为准 | `docs/01-architecture/contracts/environment-master-data/v1/`, `docs/01-architecture/api-field-contract.md` |
| 前后端边界 | 全工程遵守前后端分离；后端负责业务事实、关系、评分和投影；前端只消费 `dataClient` / `/api/v1/*` 契约并做展示交互 | `AGENTS.md`, `docs/01-architecture/backend-interface-design.md`, `docs/01-architecture/api-field-contract.md` |
| MVP 前端技术路线 | 当前继续使用静态页面 + 原生 JS + `dataClient` + ViewModel | `task_plan.md` |
| 数据优先 | 字段定义、映射规则、schema、ETL 先于页面扩展 | `docs/02-data-model/`, `docs/03-import-etl/` |
| 导入方式 | 坚持 `source -> staging -> review -> approval -> formal tables`，审批状态和来源证据必须幂等，正式写入具备恢复与验收证据 | `docs/03-import-etl/import-rules.md`, `docs/03-import-etl/import-approval-idempotency-and-retention-contract.md` |
| 导入审批与中间数据生命周期 | approve 只能从 `reviewing` 原子进入且同一 job 只允许一次；来源引用按完整证据键幂等复用；业务验收后使用默认 dry-run、显式 apply 和正式库写授权的按 job finalize 命令清理 staging / review；恢复包具备可协调状态；未显式传 job ID 的正式导出只选择最新 approved 任务。实现与临时库验收已完成，`OI-198` 于2026-07-27自动关闭；不追溯清理历史重复证据 | `docs/03-import-etl/import-approval-idempotency-and-retention-contract.md`, `docs/05-archive/open-issues-history/2026-07.md` |
| 知识内容增量发布 | T0—T6 的受控发布已封装为 release-id 驱动的 prepare/build/verify/apply/accept/rollback。输入使用run-scoped不可变快照；双库apply/rollback受global lock、durable journal、hash CAS和恢复包保护；删除必须提供精确ref审批，MCP五工具证据必须绑定release、双库、runtime、授权client和时间窗口。当前真实基线只完成双次幂等build与verify=`gated`，没有正式apply或accept | `config/content-release-manifest.v2.json`, `scripts/publish_content_release.py`, `scripts/audit_content_formal_t6.py` |
| 来源追踪 | 知识对象和关系必须保留来源文件、位置、hash 和导入任务 | `docs/06-implementation/local-data-layout.md` |
| 桌面交付模型 | macOS 在正式 Mac 主工作区本地生成 DMG；Windows 由私有 Runner 按公开 `main` 精确 SHA 和批准 Delivery Data 生成 `Setup.exe`；两端只携带受控基础数据和空用户库模板 | `docs/09-delivery/desktop-packaging-runbook.md`, `docs/06-implementation/local-data-layout.md` |
| 当前桌面交付路线 | macOS 使用原生 App + 本地主工作区 DMG；Windows 使用 Electron + Python sidecar，并由私有 GitHub Windows Runner 把公开 `main` 精确 SHA 与私有不可变 Delivery Data 组合为 NSIS `Setup.exe`。两个平台都只携带受控只读双库和空用户库模板，真实用户库始终留在用户数据目录 | `docs/09-delivery/desktop-packaging-runbook.md`, `docs/09-delivery/mac-dmg-browser-parity-contract.md`, `docs/09-delivery/windows-github-installer-migration-plan-2026-07-27.md` |
| 历史 ZIP alpha / Tauri 预研 | ZIP alpha、backend-only Windows CI、Mac 手工组装 Windows 安装器和 Tauri 预研已被当前 DMG / 私有 Windows Runner 路线替代；脚本可继续作为 Runtime 诊断或历史工具，但相关文档只从归档入口读取，不再指导生产发布 | `docs/05-archive/delivery-retired-2026-07/`, `docs/05-archive/README.md` |
| Delivery Bundle 1.0 设计沟通边界 | 设计团队先聚焦首次启动准备态、初始化失败 / 修复、本地数据状态、升级提示和 zip 用户说明；不设计登录、导入、数据库选择器、ETL 配置器或开发者控制台 | `frontend/design-handoff/implementation-specs/delivery-bundle-1.0-design-brief-2026-05-28.md` |
| 问题与文档管理 | 小修、小 bug 和一次性排查默认直接修复，不新增文档、不新建 `OI`；只有全局契约、数据 / 审计 / 安全边界、中高严重性、无法本轮闭环或需要用户判断 / 验收的问题才进入 `open-issues.md`；新文档必须有读者、长期用途、索引和退役条件 | `AGENTS.md`, `docs/07-governance/governance-index.md`, `docs/06-implementation/open-issues.md` |
| 设计文档治理 | 设计文档按用途分层管理：`docs/04-frontend/` 放信息架构 / brief，`docs/06-implementation/frontend-*` 放全局设计基线和跨页契约，`frontend/design-handoff/implementation-specs/` 是唯一页面实现规格入口，`stitch-*` 只作 reference。小 UI 修复、文案和局部样式不新增设计文档 | `docs/README.md`, `docs/07-governance/governance-index.md`, `frontend/design-handoff/README.md` |
| 全工程前端优化交付口径 | 审计风险、通用设计原则和页面优化方案必须分层记录；每条已识别风险都要有具体改法、不改边界、验收和优先级。用户单独补充的能力图谱碰撞、Draw.io 不可变和成熟度完整设计是对应页面约束，不能替代其他风险方案 | `frontend/design-handoff/implementation-specs/frontend-global-optimization-plan-2026-07-11.md` |
| P0-1 正确性与安全边界 | 当前对象只能由显式选中 ID 驱动；Draw.io 原图用固定哈希保护且定位只走外部 overlay；状态色与对象角色色使用独立命名空间；`sourceEvidence` 等技术来源证据不得进入 `localRelationMap` 主展示模型；键盘焦点和动态状态必须持续通过统一门禁 | `config/frontend-p0-1-correctness-boundary.json`, `scripts/audit_frontend_p0_1_correctness_boundary_contract.mjs` |
| P0-2 Apple Shell 与共享布局 | 共享壳只能有一个页面标题所有者；全局导航任一时刻只展开一个业务域并保证当前项可见；普通页面最多一个 resident auxiliary，第二辅助层必须按需 overlay。成熟度不是例外：全部成熟度路由使用 `main-only`，主动作进入共享页头，业务区不得再造主页头，新建项目只能使用居中 workflow overlay；评分目录属于业务主区，不算 Shell auxiliary layer。共享壳字号收敛为 `12 / 14 / 16 / 24px`、圆角收敛为 `6 / 10 / 14px`；标题区以旧 DMG `0.1.7` 为视觉真值，固定 `96px` 高、`24px / 1.13` 标题、`12px / 1.45` 说明、`12px 18px` 内边距和 `5px` 文本组间距，业务页不得局部覆写。全局 segmented 必须保持外层 `42px / 16px`、按钮 `34px / 12px` 的位置无关几何；页面局部搜索必须同时包含输入、匹配计数、上一个和下一个按钮，禁止只复用外壳 class。不得借此全局覆盖业务表格或改变成熟度业务 / 评分规则 | `config/frontend-p0-2-apple-shell-layout.json`, `scripts/audit_frontend_p0_2_apple_shell_layout_contract.mjs` |
| P0-4 标准与 Issue 壳层派生 | 标准深链的当前位置由全局 `AppShell` 标准域与标准页面当前框架共同表达，刷新不能只恢复其中一层；Issue 详情只由显式 `workbenchSelectedIssueId` 打开，批量勾选集合不得替代当前详情对象，禁止 `rows[0]`、旧路由选择或单项勾选隐式打开 inspector。未选择时 inspector 不渲染且占宽为 0；关闭详情后恢复队列宽度与行焦点；Issue 路由只展开工作台域 | `frontend-global-optimization-plan-2026-07-11.md`, `frontend/capability-browser/components/AppShell.js`, `frontend/capability-browser/app.js` |
| P1-1 共享运行状态模板 | 页面运行状态必须来自 API / `dataClient` 的显式状态、HTTP 结果和显式选择，不得由 DOM、`rows.length` 或默认首项猜测。404=`missing_file`，非 404 / 解析 / 请求异常=`error`，成功且无业务记录=`empty`，未选择=`no-selection`；五态使用共享模板，加载用骨架，错误 / 缺文件局部重试。重试只失效对应缓存；只有路由与九类选择快照都未被用户新操作替代时才恢复原对象，不覆盖异步期间的新导航或新选择。成熟度可复用该模板，但本轮不改其业务和评分 | `config/frontend-p1-1-runtime-state.json`, `scripts/audit_frontend_p1_1_runtime_state_contract.mjs`, `frontend/capability-browser/components/RuntimeState.js`, `frontend-global-optimization-plan-2026-07-11.md` |
| P1-3 生命周期展示边界 | 生命周期页面的当前阶段 / 过程上下文只读取既有 ViewModel 的 `code / title / description / facts`；宽表横向滚动只能发生在表格局部，表头 / 首列冻结，正文不低于 13px，缺失值使用 `—`。不得借视觉优化重算阶段、场景或技术映射 | `config/frontend-p1-3-lifecycle-workbench.json`, `audit_frontend_p1_3_lifecycle_workbench_contract.mjs`, `p1-lifecycle-workbench.css` |
| P1-4 结构与选择语义 | 用户截图证明“层级样式统一”不能覆盖页面行为：标准 / 框架的展开状态默认必须全部为收起，能力清单的滚动 owner 必须保持原生连续滚动；只有两个以上同级内容视图时才渲染 Tab，单一内容页直接显示内容标题。结构使用中性色、蓝色只表示显式选择，字典 / 标准内容不变 | `config/frontend-p1-4-reference-tables.json`, `audit_frontend_p1_4_reference_tables_contract.mjs`, `p1-reference-tables.css` |
| P1-5 队列与搜索状态 | “复用搜索组件”必须包含完整 `.page-search-control` 契约：输入、匹配计数、上一个和下一个按钮、统一宽度与键盘状态，不能只借用 class 和胶囊外框。Issue 箭头以筛选后 Issue 稳定 ID 为业务粒度，不按偶然 DOM 文本跳转。页面范围只由左侧目录持有，顶部不得再出现范围下拉或范围状态 chip，“清除筛选”不得重置目录范围。导出目的地按运行面区分：Web 生成 Markdown Blob 并交给浏览器下载设置，DMG App 写入系统设置中的“文件下载路径”；只有 Blob 下载已触发或 App 返回真实 `output_path` 才显示成功。筛选、排序、搜索索引和用户数据不变 | `config/frontend-p1-5-review-search.json`, `audit_frontend_p1_5_review_search_contract.mjs`, `p1-review-search.css`, `app.js`, `dataClient.js` |
| P1-2 外部画布与共享 Tab 边界 | 图 1 的 `42px` segmented 容器、`34px` 选中按钮、`16/12px` 圆角是全局 Apple Shell Tab 权威，组件放在标题区不能改变几何；页面不得用位置选择器另造紧凑变体。能力摘要图的边框所有者必须是按原始比例缩放后的真实 `<img>` 盒，而不是填满轨道的外容器；T 根能力用全宽单区优先呈现五象限图，图片按可用宽高 `contain` 且无内部滚动。内部图谱布局、Draw.io 原图与 P0-3 冻结资产不得修改 | `styles.css`, `config/frontend-p1-2-canvas-workbench.json`, `audit_frontend_p1_2_canvas_workbench_contract.mjs`, `p1-canvas-workbench.css` |
| P1-6 指南样式所有权 | 指南源 HTML 是正文样式唯一所有者，并自行处理 `embed=1`；App 只提供目录和隔离 iframe 两层，不得从父页面注入 iframe 正文 CSS。文档封面控制在 160—220px，章节锚点必须保持稳定 | `config/frontend-p1-6-guide-reading.json`, `audit_frontend_p1_6_guide_reading_contract.mjs`, `p1-guide-reading.css` |
| P0-3 能力图谱碰撞治理 | 2026-07-14 已按用户裁定完整回退并暂停。根因不是某个坐标，而是专项审计只覆盖少量黄金对象 / 合成压力图，未把全部 91 个关注点的真实关系输入、UUID 禁显、控制语义和页面人工可读性作为同一验收面；因此“局部指标通过”不能宣称全局治理完成。回退恢复三项冻结运行文件并移除控制器、视图策略、配置、专项审计和测试挂钩；旧版碰撞保留为 `OI-138` 已知限制。若未来重启，必须先建立全量真实输入与业务控制契约，不得继续局部坐标补丁 | `frontend-global-optimization-plan-2026-07-11.md`, `design-qa.md`, `OI-138`, `data/exports/worker-verify/frontend-p0-3-collision-governance/20260714T021947Z/rollback-manifest.md` |
| maturity 边界 | maturity 是主工程下独立模块；运行数据使用 `maturity_*`，不写入 `knowledge_items` | `docs/08-maturity/` |
| SAPD 成熟度评估入口 | `/workbench/maturity/demo-project-001` 第十一轮继承项目概览的项目事实 / 评估进度 / 评估结果分层，并以 Codex Desktop 强度控件作为 Slider 比例真值：单项和批量滑块共用最大 `290px` 长、`30px` 厚轨道与 `34px` thumb。“下级评估设置”始终可打开；无评分时可统一应用，有任一自评 / 复核四维评分时只能确认清空，清空所有下级 SERVICE 的 `elements / reviewElements` 后才可重新统一设置。清空保留适用性、目标、理由、依据、证据和备注；评分、聚合、适用分母、对象粒度和正式数据不变 | `maturity-assessment-v2-1-complete-frontend-design-2026-07-12.md`, `frontend-global-optimization-plan-2026-07-11.md`, `SAPD_成熟度评估业务设计_V2.1_20260712.md`, `design-qa.md`, `OI-192` |
| 成熟度评分输入粒度 | 关注点只承担对象定义与下级未评分时的一次性批量初始化，不展示由下级服务分数回写的关注点评级；下级已有任一评分后，必须先显式清空全部下级四维评分，才能再次统一初始化。安全技术服务评估点按四维逐项评分，结果计算仍由后端按既有聚合契约生成，前端不得把汇总结果改造成父级输入 | 用户 2026-07-14 第十一轮裁定、三份成熟度 V2.1 文档、`src/sapd_wiki/maturity.py` |
| 成熟度操作后跳顶根因 | 实际纵向滚动容器是重渲染区域内部的 `.maturity-v1-project-page`；旧 `captureRenderPosition()` 只保存 `model.root` 及其祖先，并把评分面板保存成即将被 `innerHTML` 替换的旧 DOM 节点，因而评分按钮触发重渲染后真实滚动容器回到 `0`。修复必须按稳定选择器重新获取新滚动容器并恢复 `scrollTop`，不能继续保存旧节点引用 | 应用内浏览器 1486×1058 修复前 `431 → 0`；修复后评分与适用性真实坐标点击前后及试算完成均为 `512.5`；`MaturityAssessmentWorkbench.js` |
| 成熟度设计图人工评审基线 | 图 1 是结构与密度基线，图 2—9 是本轮必须关闭的验收差距。评估点列表与安全技术服务评估区必须是两个清晰区域；当前项显示蓝色状态，已完成项显示真实勾选状态；适用性用方框勾选；当前下级对象不用下拉；选中等级后只就地显示当前等级定义 | 用户 2026-07-13 九张截图、`frontend/capability-browser/components/MaturityAssessmentWorkbench.js`, `frontend/capability-browser/maturity-assessment-workbench.css`, `design-qa.md` |
| 2026-07-12 项目计划队列 | `PLAN-MAT-WS` 已完成 V2.1 受控 demo 实现及 Web 回归，正式持久化与 DMG App 验收后置；`PLAN-STD-NICE` 仍为组织岗位设计的数据源前置，`PLAN-ORG-ROLE` 仍在计划池 | `task_plan.md`, `CURRENT_STATE.md` |
| Demo-first 数据与前端试验 | 后续新数据、实验数据和前端试验先在当前 `main` 通过受控 demo 页 / demo 数据验证业务口径；正式接入基础库、字典、标准、SQLite、正式 JSON 或 DMG 前，必须另行确认权威源、对象粒度、写入范围、回退方案和审计清单 | `AGENTS.md`, `CURRENT_STATE.md`, `task_plan.md` |
| AI 安全能力体系扩展 | 新增 AI / 人工智能安全 L2 能力或关注点时，先做 demo 页 / demo 数据和关系样例，确认业务口径后再决定是否正式进入基础库或用户库；不能直接改正式能力清单、字典、SQLite、JSON 或 DMG | `task_plan.md`, `CURRENT_STATE.md` |
| 后续项目推进方式 | 后续计划拆成“前端页面设计线”和“后端数据 / 逻辑线”；每页按后端投影契约 -> 前端页面实现 -> 验收回归推进 | `task_plan.md` |
| 页面优先级 | 先收敛安全能力映射页作为关系画布基准，再推进信息化环境维度页，最后推进 LC-AP 页 | `task_plan.md` |
| 信息化环境图谱策略 | 信息化环境页按层级回答不同问题：`E0` 信息化环境只展示环境子类和对象结构，`E1` 环境子类展示对象、作用域、服务和能力 / 关注点概览，`E2` 信息化对象完整展示作用域、服务、模块 / 措施、系统、产品和能力 / 关注点；标准 / 流程不从能力页反向拼接 | `frontend/design-handoff/implementation-specs/environment-security-capability-graph-strategy-2026-05-20.md` |
| 安全知识目录信息架构 | `安全知识` 复用 `maintenanceWorkspace`，不是独立新页面；外层二级入口收口为安全能力作用域清单、安全技术模块/措施清单、安全管理工作/流程清单、安全职能清单、Hype Cycle、其他知识目录；模块/措施、管理工作/流程、职能/岗位参考在页面内部用 Tab 切换，兼容旧直达路由但不作为主导航入口 | `frontend/design-handoff/implementation-specs/security-knowledge-frontend-data-handoff-2026-05-21.md`, `frontend/capability-browser/components/AppShell.js` |
| 安全技术模块目录展示边界 | 领域分类来自原始 `安全技术模块清单` B 列，安全系统来自 C 列；模块目录按“领域分类 -> 安全系统 -> 安全技术模块”两级分组并保持原表行顺序；模块-措施、模块-作用域、模块-信息化对象若未进入维护包契约，显示为契约缺口，不在前端组件临时反推 | `frontend/design-handoff/implementation-specs/security-knowledge-frontend-data-handoff-2026-05-21.md`, `src/sapd_wiki/parsers.py`, `src/sapd_wiki/staging.py`, `frontend/capability-browser/viewModels.js` |
| BE-0 历史契约盘点 | 早期盘点已完成并归档；当前接口边界以 API 合同、数据包台账和运行代码为准 | `docs/05-archive/architecture-retired-2026-07/api-offline-package-contract-inventory.md`, `docs/01-architecture/api-field-contract.md`, `docs/01-architecture/frontend-json-data-package-inventory.md` |
| 全站菜单与页面类型 | 当前导航以 AppShell、前端信息架构和 active implementation specs 为准；Stitch、Manifest 和旧菜单定义只作为设计来源，不直接指导运行代码 | `frontend/capability-browser/components/AppShell.js`, `docs/04-frontend/frontend-information-architecture.md`, `frontend/design-handoff/implementation-specs/` |
| 前端数据契约治理 | export 负责业务归一和关系生成，`dataClient` 负责 API / 离线包兼容，ViewModel 只做展示整理；当前数据包职责由统一台账和三份 workbench 规格维护 | `docs/01-architecture/frontend-json-data-package-inventory.md`, `docs/04-user-guide/capability-workbench-json-spec-v1.md`, `docs/04-user-guide/environment-workbench-json-spec-v1.md`, `docs/04-user-guide/lifecycle-workbench-json-spec-v1.md` |
| 前端 JSON 数据包台账 | 新增 `frontend-json-data-package-inventory.md` 作为所有 `public/data/*.json` 的用途、页面归属、legacy 状态、发布处理和退役条件入口；后续新增 / 删除 / 拆分 JSON 必须同步更新 | `docs/01-architecture/frontend-json-data-package-inventory.md` |
| 字典与标准框架只读基准 | `知识库字典` 和 `安全标准 / 框架` 是全局只读基准；环境映射、能力映射、生命周期和临时核对表只能引用或输出差异报告，不得反向改写基准包。每次导入 / 导出 / 重导入或前端正式数据包替换后必须运行 `python3 scripts/audit_dictionary_standard_baseline_integrity.py` | `AGENTS.md`, `docs/07-governance/data-governance.md`, `docs/06-implementation/open-issues.md` |
| 三份 workbench 规格 | `capability-workbench.json`、`environment-workbench.json`、`lifecycle-workbench.json` 三份规格已齐；最终目标数据文件清单冻结为 P0 四件套 + P1 三件套；`management-knowledge.json` 已从顾问端运行路径退役，`lifecycle-knowledge.json` 仅保留生命周期专项数据 | `docs/04-user-guide/capability-workbench-json-spec-v1.md`, `docs/04-user-guide/environment-workbench-json-spec-v1.md`, `docs/04-user-guide/lifecycle-workbench-json-spec-v1.md` |
| 三份 workbench 数据出口 | `capability-workbench.json`、`environment-workbench.json`、`lifecycle-workbench.json` 已能由 CLI 生成；`dataClient` / ViewModel 已提供稳定读取入口；旧 JSON 保留为过渡兼容，不作为新 UI 主输入 | `src/sapd_wiki/exports.py`, `src/sapd_wiki/cli.py`, `frontend/capability-browser/dataClient.js`, `frontend/capability-browser/viewModels.js` |
| `management-knowledge.json` 退役边界 | 已完成退役：`assets`、顶层 `service_module_index`、安全知识重复数据和环境旧树均不再作为顾问端发布包、API 数据包或前端 fallback；安全知识由 `maintenance-knowledge.json` 承接，环境关系由 `environment-workbench.json` 承接，共享索引由 `shared-lookups.json` 承接 | `frontend/capability-browser/public/data/shared-lookups.json`, `frontend/capability-browser/public/data/maintenance-knowledge.json`, `frontend/capability-browser/public/data/environment-workbench.json`, `src/sapd_wiki/exports.py`, `src/sapd_wiki/api_server.py` |
| BE-4 历史数据质量审计 | 三份 workbench 首轮结构、关系端点和展示字段审计已经完成；当前缺口只从 Open Issues 进入 | `docs/05-archive/implementation-completed-2026-07/be-4-workbench-data-quality-gap-list.md`, `docs/06-implementation/open-issues.md` |

## 2026-07-11 全工程前端设计外部参考

- Apple HIG `Materials`：材质层应主要服务导航和控件，内容层保持清晰、稳定，避免把玻璃效果铺满业务表格和工作区。来源：<https://developer.apple.com/design/human-interface-guidelines/materials>
- Apple HIG `Sidebars`：侧栏适合扁平业务域导航；层级更深或可用宽度不足时应切换为 split view / 更紧凑导航，而不是持续增加常驻层级。来源：<https://developer.apple.com/design/human-interface-guidelines/sidebars>
- SAP Fiori `Flexible Column Layout`：列表—详情类流程可以使用可变列；不应以空详情列开场，也不应默认三列同时出现；工作台附加内容更适合按需 dynamic side content。来源：<https://experience.sap.com/fiori-design-web/flexible-column-layout/>
- SAP Fiori `Toolbar` / `Table Overview`：表格级搜索、筛选和动作应靠近表格并进入单一 toolbar；宽度不足时动作进入 overflow；复杂表格优先减少列、使用多行单元格或渐进披露。来源：<https://experience.sap.com/fiori-design-web/toolbar-overview/>、<https://experience.sap.com/fiori-design-web/table-overview/>
- 以上外部资料只作为设计模式参考，不覆盖 SAPD Wiki 的字段边界、对象粒度、语义色和前后端契约。

## 2026-07-15 成熟度评估重设计约束

- 用户已裁定评估执行采用显示顺序方案 1 的四行五档刻度矩阵；评估概览采用显示顺序方案 2 的可折叠 Vibrancy 检视器，但删除“维度得分明细”。概览保留综合得分、目标/进度、四维雷达和强弱洞察，不再重复逐维表格。
- 五档成熟度是离散有序等级，不应只表现为连续 Slider；等级编号、等级名称和当前对象 Rubric 必须形成同一条选择反馈链，长定义进入当前行保留槽或按需详情，不跨行遮挡。
- 评估页空白的根因是固定双栏高度不匹配；后续方案应以内容驱动主栏、按需/粘性统计栏和明确的纵向接续区消化空间，不把表单与统计强行等高。
- Vibrancy 的可感知性依赖半透明层后方存在真实内容或色调层次；只提高模糊半径而保持均匀浅色底不会产生材质感。统计材质仍限于汇总、结果和报告，不扩散到评分表单、目录或导航。
- 雷达图粒度冻结为两类：四维雷达只读当前对象后端 `dimensionResults`；下级能力雷达只读当前节点直接下级同粒度 `currentIndex`，轴标签使用稳定业务短码并配精确列表。没有后端逐维目标时只能显示等距“总体目标参考”，不得虚构逐维目标。
- Apple `Materials` 强调材质按语义选型、让背景内容提供上下文，并以足够对比的 vibrant foreground 保证可读性；SAP Fiori `Dynamic Side Content` 建议桌面主/辅区约 `3:1` 或 `2:1`、辅区最小 `320px`，窄屏转到主区下方；这两条共同支持“统计材质作为任务相关辅区、不是整页装饰”。来源：<https://developer.apple.com/design/human-interface-guidelines/materials>、<https://experience.sap.com/fiori-design-web/dynamic-side-content-web-component/>
- SAP Fiori Slider 明确固定步长应常显 tick/label 且拖动吸附；Microsoft Agentic AI maturity model 建议用雷达关注不均衡形状而非只看平均分；SAP LeanIX 则用 capability 分组、颜色与可钻取明细并列支撑比较。因此本项目应保留精确值列表与未评分态，雷达只负责暴露强弱形状。来源：<https://experience.sap.com/fiori-design-web/slider-web-component/>、<https://learn.microsoft.com/en-us/agents/adoption-maturity-model/maturity-model-how-to-use>、<https://help.sap.com/docs/leanix/ea/landscape-report>

## 2026-07-16 成熟度评估第十七轮截图裁定

- 图 1 的“当前关注点”与图 2 的“当前 L2 · 下级汇总”都是重复上下文标签，应删除；对象编号与名称继续作为唯一标题。关注点定义必须完整换行显示，不得用固定高度或省略号截断。
- 图 3 的三格“完成 / 适用 / 不适用”把状态与分母拆散。关注点摘要应收敛为单一“适用性”标签和 `已完成 / 适用 = 5 / 6` 计数；不适用数量只在确有排除项时以弱说明显示，不再占固定一格。
- 图 4 的 `L2 评分标准` 是实现语言，不是业务等级。行内反馈标题应直接使用 `L2 计划跟踪`，Rubric 定义提高字号、行高和对比度；矩阵格仍只保留 L1—L5。
- 图 5 的目标区虽然已合并为两个字段，但大面积同色圆角容器和高文本框形成“卡片套表单”。应改为清晰的两列设置条：目标等级使用更强的标签与高对比选择器，评估说明压缩到与任务相称的高度；窄屏再堆叠。
- 图 6 的 `83%` 是 `5 / 6` 的评估完成度，不是“目标达成率”。该关注点下仍有 1 个适用下级评估点未满足完成条件；界面应把列名改为“评估完成”，优先显示 `5 / 6`，百分比作为弱辅助，避免用户把 83% 理解为业务目标或误以为三条关注点标题都完成就等于所有下级评分完成。
- 图 7 证明复核页直接复用执行页表单但没有复用其完整工作台宽度、滚动 owner 和底部栏契约，导致说明文字纵排、目标区越界和主动作漂移。修复不能只加宽单个控件；复核应拥有独立的两列布局：左侧待复核队列，右侧完整只读评分摘要与复核操作，窄屏顺序堆叠。
- 图 8 的分层统计右栏内容被固定高度 / overflow 裁掉，且表面缺少统计类材质层次。结果页只允许在“分层统计”统计表面使用共享 `sapd-stat-vibrancy`，同时取消内部纵向裁切，让 T / G / M 与 L1 能力域统计在页面主滚动 owner 中完整展示；不得给业务表格或雷达画布本体额外套玻璃卡。
- 保存并转到下一项的目标不仅是切换对象，还必须把键盘焦点放到下一对象“组织与角色”的第一个 L1—L5 评分格，形成连续键盘评分流。
- 复核页不复制一套可编辑评分执行表。复用同一对象 Rubric 和四维结果生成只读评分摘要，复核动作单独保留，避免自评与复核输入所有权混淆。
- 83% 必须按后端适用评估点完成数解释为评估完成度，不得按目标达成率或前端主观“看起来已填完”解释；需用对应对象的 `completedItemCount / applicableItemCount` 反查缺失项。
- Product Design 保存上下文预检首次误用了插件根目录下不存在的脚本路径；已定位正确入口为 `skills/user-context/scripts/user_context_preflight.py`，后续不得重复错误路径。

## 2026-07-16 成熟度评估第十八轮用户复验裁定

- 图 1 证明连续评分的验收对象不是“焦点是否进入下一项 radio”，而是“下一评估点的起始上下文是否进入可视区”。保存后必须先把下一项表单顶部对齐到评分正文起点，再把键盘焦点放到组织与角色的当前评分格；`focus({ preventScroll: true })` 只能保住正确落点，不能代替表单级滚动。
- 图 2 的两个分母回答不同问题，不能合并：`完成 6 / 6` 表示六个下级均已被处理，其中不适用项也算已明确处理；`适用性 5 / 6` 表示当前关注点下适用下级数 / 全部下级数。不适用项仍不进入评分或聚合分母，两项统计都来自当前项目评分记录，不从目录 DOM 反推。
- 关注点适用性是对象级开关，应归属关注点标题行末端，不应与完成统计抢占下一行。复选框和“适用性”标签需同步放大，状态值保留清楚的“适用 / 不适用”。
- 图 3 的 `14 / 14` 重叠不是数据错误，而是统计单元格同时使用超大字号、窄列与允许换行，标签和数值没有各自的尺寸所有权。完成统计必须采用稳定横排或可控两行，不得让分子 / 斜杠 / 分母任意断行。
- 图 4 的 Rubric 定义盒宽度过大，长句被视觉拉成横向横幅。桌面端应设置受控最大宽度并与五档矩阵左边界对齐，正文仍完整换行；窄屏恢复占满可用宽度。

## 2026-07-16 成熟度评估第十九轮复核、结果与评分锁定裁定

- 图 1 暴露的不是状态文案问题，而是复核状态没有对应的逐项操作：`待复核` 应只表示“适用且四维与目标已完整、尚未被复核确认”，`已确认` 必须来自显式逐项或批量确认；不适用项不进入复核分母。复核队列需要为阻塞项提供“去调整”，为完整项提供“确认此项”，避免只显示状态而没有动作。
- 阻塞跳转的验收对象是精确评估点和首个缺失评分维度。用户从复核页点击后，必须切回评估执行、选中同一 `scoreItemId`，并把首个缺失维度的当前评分行置入锁定标题下方；禁止只切换 Tab 或落到关注点首项。
- 图 2 的 L2 摘要把“评估完成”误写成适用项完成百分比，并把四类信息按旧顺序分散。新口径固定为同一行内的“适用评估点 / 全部评估点”和“已完成适用评估点 / 适用评估点”；摘要从左到右为评估进度、评估维度均值、当前成熟度、目标成熟度，当前与目标使用不同强调色。
- 评估维度均值不是脚注，而是与当前 / 目标成熟度同级的诊断结果；标题、四个值和成熟度数值需要共享同一信息层级。Rubric 区则相反，应减少上下 padding 和空白，在不截断定义的前提下让一至两行定义紧凑完整显示。
- 图 3 的评分概览虽然已有统计材质，但随评分正文滚动会离开视区。评分标题上下文与列标题应由一个稳定 sticky 契约持有，右侧概览在可视高度内完整 sticky；Rubric 定义区同步收高，避免锁定区吞噬评分正文。
- 图 4 的“下级评估设置 / 已有下级评分”承担可操作入口和状态反馈，当前字号与圆点都低于同页正文层级。两段文字应提高到正文级字号并保持一行，状态圆点只辅助语义，不能成为唯一识别线索。
- 全能力分组雷达是结果页的首要诊断入口，应先于四维总览和差距表出现；T / G / M 的扇区边界属于业务分组边界，必须用比普通轴线更粗、更高对比的线表达。既有后端差距候选已提供 `priority / priorityScore`，优先级只能读取该结果，不在前端新建阈值。
- 5173 改前基线确认 demo 项目总体为适用 `175`、已完成 `154`；当前 L2 `T-AS.AD` 为已完成适用项 `11 / 13`，当前关注点为完成处理 `4 / 6`、适用性 `5 / 6`。这些数量来自页面现有投影，可作为改后“评估进度”口径的黄金样例；不得把关注点计数冒充 L2 计数。
- 改前浏览器取证确认复核页 80 条可见队列里没有逐项业务按钮，只有展开后的“返回评估执行”；因此 `待复核 154 / 已确认 0` 是单纯状态展示。结果页 DOM 顺序则是总体结论 → 四维雷达 / 覆盖 → 全能力分组雷达，和用户要求的“全能力分组雷达最优先”相反。

## 当前重要风险

| 风险 | 当前处理 |
|---|---|
| 上下文过大导致主控卡死 | 默认读取 `AGENTS.md` + `CURRENT_STATE.md`，长历史放入 `docs/05-archive/` |
| 文档和 Issue 继续膨胀 | 默认不为小修新增文档或 `OI`；修复后需要用户验收的问题必须在完成反馈给入口，用户确认后及时关闭 / 归档 |
| 设计文档散乱导致实现依据不清 | 只把 active / implementation-source 的 `frontend/design-handoff/implementation-specs/` 作为页面代码实现依据；Stitch 输出、截图和旧 brief 必须先转成 spec 或降级为 reference |
| 过早正式化成熟度模块 | 受控 demo V2 通过不等于正式库或 DMG 已交付；正式 `maturity_*` 持久化、客户数据、发布包和 App 验收必须另行确认 |
| 前端硬编码业务关系 | 发现数据缺口时记录为数据契约或待确认问题，不在页面临时编造 |
| 前后端边界漂移 | 新页面、新字段和新关系先更新后端契约，再进入前端实现；禁止组件直接读取原始数据或临时 JSON |
| 非业务字段泄露 | 主展示区不得出现 `sheet`、`row`、`raw_value`、`metadata` 等非业务字段 |
| 成熟度模块污染主知识库 | maturity 只读引用主知识库，客户输入、证据、评分和报告留在 maturity 运行域 |
| 前端画布反复试错导致结构漂移 | 安全能力映射页先作为基准页收敛验收标准；未确认前不复制到环境页和 LC-AP 页 |
| 已规划接口与已实现接口不一致 | `api-field-contract.md` 中部分 `/api/v1/environments/*`、`/api/v1/lifecycle/*`、`/api/v1/maintenance/technical-measures` 等接口尚未在 `api_server.py` 中实现；后续实现前需明确“规划接口”和“实际接口” |
| 桌面交付签名和本地后端适配风险 | macOS 正式外部分发需要签名和 notarization；Windows 需要处理 SmartScreen、杀毒误报、安装目录和应用数据目录；如采用本地 API sidecar，必须固定 `127.0.0.1` 并管理端口、进程生命周期和 fallback |
| PyInstaller 打包边界 | PyInstaller 首次在沙箱内运行会尝试写 `~/Library/Application Support/pyinstaller`，本项目打包脚本已把 `PYINSTALLER_CONFIG_DIR` 指向输出目录；一文件模式在 Codex 沙箱内直接运行可能遇到系统信号量限制，真实 macOS 验证需使用普通本机权限执行 |
| 前端 JSON 职责混杂 | `management-knowledge.json` 的职责混杂已完成退役；后续重点是继续缩小 `capability-tree.json` 与 `lifecycle-knowledge.json` 的非页面级职责 |
| 字典 / 标准基准被导出覆盖风险 | 2026-06-15 已确认当前项目 SQLite 被 `bootstrap-local-data --profile core --reset` 压成 core-only，导致维护字典、应用系统目录和标准框架前端包被导出为空。`P0 Baseline Canonical Data Correction 1.1` 已按用户确认正式补入 4 个生命周期来源安全技术措施，当前正式前端维护包 `security_technical_measures=30`；`lifecycle-workbench.json` 已补回 `relations=542`。当前 SQLite 仍缺 `work_function_layer`、`process_reference`、`application_system_type`、`standard_control` 等保护类型。后续不得从当前 SQLite 直接导出字典 / 标准基准包，`bootstrap-local-data --profile core --reset` 已增加保护基线拦截，除非用户明确授权并先确认数据库恢复策略 |
| 信息化环境映射源表结构丢失风险 | `作用域-安全技术服务-安全技术模块映射` 审计确认该 Sheet 依赖 417 个 merged ranges 和样式区分模块 / 措施；对象实例唯一键已修订为 `信息化环境 + 环境子类 + 信息化对象`，原 8 个同名对象降级为 `sameNameDifferentContexts` 信息提示；1.4 已正式替换 `environment-workbench.json` 与 `environmentBasemap.node-details.json`，替换后 `detailReadyNodes=91`、`missingDetailNodes=0`、`moduleSystemRelations=214`、`securitySystemCells=566`、`moduleCells=612`、`measureCells=123`。当前仍需人工页面验收，并单独决定是否让前端展示已进入数据包的 `securitySystems` 字段 |
| 跨表目录差异人工核对噪声 | `Environment Mapping Dual-table Review UI 1.1` 已把临时核对页拆成 `环境对象核对` 与 `双表对照核对` 两个模式；双表模式以 `安全系统分类 -> 安全系统 -> 安全技术模块 -> 安全技术服务` 为目录基准，展示 455 条目录关系、68 条环境有目录无、230 条目录有环境未精确引用、27 条模块-服务不一致关系和 43 条系统-模块不一致关系。最新 UI 将中间主区改为 `目录表这一边 / 环境映射表这一边 / 对照结论` 的双边对照，并对冲突筛选显示单条件命中数与清空入口。完整重复和 B 类分类问题已清零，coverage gap / 目录未精确引用仍按选择性引用候选处理，不默认视为错误或自动补齐 |

## 历史入口

| 归档文件 | 内容 |
|---|---|
| `docs/05-archive/context-slimming-2026-05-15/findings-full-before-slimming.md` | 本文件瘦身前的完整 `findings.md` |
| `docs/05-archive/findings-history/2026-05.md` | 2026-05 期间完整发现、实现判断和阶段性记录 |
| `docs/05-archive/context-slimming-2026-05-15/task_plan-full-before-slimming.md` | `task_plan.md` 瘦身前完整计划 |
| `docs/05-archive/progress-history/2026-05.md` | 2026-05 完整执行记录 |

## 维护规则

- 新的长期有效判断可以写入“当前关键决策”或“当前重要风险”。
- 过程性发现、执行日志和验证输出写入 `progress.md`。
- bug、数据问题、页面问题和待确认事项写入 `docs/06-implementation/open-issues.md`。
- 当本文档超过 120 行时，继续归档到 `docs/05-archive/`。
