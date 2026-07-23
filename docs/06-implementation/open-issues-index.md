# Open Issues Index

本索引用于快速定位当前问题和历史归档问题。完整历史正文请到对应位置查看。

## 摘要

- 生成日期：2026-07-23
- 问题总数：201
- 当前未关闭问题数：7
- 已关闭归档问题数：194
- 当前入口：`docs/06-implementation/open-issues.md`
- 已关闭归档：`docs/05-archive/open-issues-history/2026-06.md`、`docs/05-archive/open-issues-history/2026-07.md`

## 状态分布

| 状态 | 数量 |
|---|---:|
| T0-T2 完成 / 等待新授权 | 1 |
| 部分完成 | 1 |
| 业务接受 | 6 |
| 已关闭 | 54 |
| 已关闭 / 自动验收通过 | 3 |
| 已关闭 / 用户验收通过 | 2 |
| 已回退 | 1 |
| 已修复 | 127 |
| 已修复 / 待用户验收 | 2 |
| 已修复，后续可继续优化 | 1 |
| 长期保留 / 按需继续修复 | 1 |
| 待业务确认 / 映射门禁阻断 | 1 |
| 待实现 / 契约已确认 | 1 |

## 重复编号

| 索引键 | 原编号 | 状态 | 标题 | 位置 |
|---|---|---|---|---|
| OI-044#1 | OI-044 | 已修复 | 新版 LC-DT 映射表引入新增场景和模块候选 | docs/05-archive/open-issues-history/2026-06.md |
| OI-044#2 | OI-044 | 已修复 | 原始 `CIS CSC V8` 页与 CIS Controls v8.1.2 存在待修订差异 | docs/05-archive/open-issues-history/2026-06.md |
| OI-092#1 | OI-092 | 已修复 | 安全能力管理视角 ETL 合并单元格和顿号解析导致流程/职能映射错误 | docs/05-archive/open-issues-history/2026-06.md |
| OI-092#2 | OI-092 | 已修复 | LC-AP 安全技术模块/措施列用规范关系回填导致原始字段值少一项 | docs/05-archive/open-issues-history/2026-06.md |
| OI-092#3 | OI-092 | 业务接受 | LC-DT 来源证据存在重复 source_references | docs/05-archive/open-issues-history/2026-06.md |

## 全量索引

| 索引键 | 状态 | 标题 | 类型 | 位置 |
|---|---|---|---|---|
| OI-001 | 已修复 | 关注点被误判为未挂接 | ETL | docs/05-archive/open-issues-history/2026-06.md |
| OI-002 | 已修复 | `ALL&T-AD.IR-02` 与 `ALL&T-AD.IR-03` 源数据编码混淆 | 数据 | docs/05-archive/open-issues-history/2026-06.md |
| OI-003 | 已修复 | 左侧能力树编码和标题重叠 | 前端 | docs/05-archive/open-issues-history/2026-06.md |
| OI-004 | 已修复 | `T-AS.DS` 开发安全管控能力编码需按源数据修正后验证 | 数据 | docs/05-archive/open-issues-history/2026-06.md |
| OI-005 | 已修复 | 能力树未严格按 Excel 原始层级顺序展示 | ETL / 前端 | docs/05-archive/open-issues-history/2026-06.md |
| OI-006 | 已修复 | 左侧能力树不同层级视觉区分不够 | 前端 | docs/05-archive/open-issues-history/2026-06.md |
| OI-007 | 已修复 | 左侧能力树展开/收起交互不明显或无效 | 前端 | docs/05-archive/open-issues-history/2026-06.md |
| OI-008 | 已修复 | 安全工作职能名称存在源数据错误 | 数据 | docs/05-archive/open-issues-history/2026-06.md |
| OI-009 | 业务接受 | L4关键活动暂未生成 | 需求 / 数据 | docs/05-archive/open-issues-history/2026-06.md |
| OI-010 | 已修复 | 网络安全执行层存在较多未分组职能 | 数据 / ETL | docs/05-archive/open-issues-history/2026-06.md |
| OI-014 | 已修复 | 无编码“人力负责职能”仍出现在未分组中 | 数据 / ETL | docs/05-archive/open-issues-history/2026-06.md |
| OI-015 | 已修复 | `75 合规管理职能` 页面层级错误 | 数据 / ETL | docs/05-archive/open-issues-history/2026-06.md |
| OI-011 | 已修复 | 安全职能流程清单需要独立维护页，不能只作为能力映射展示 | 需求 / 前端 / ETL | docs/05-archive/open-issues-history/2026-06.md |
| OI-012 | 已修复 | 知识来源页面结构需要拆分为二级页面 | 需求 / 前端 | docs/05-archive/open-issues-history/2026-06.md |
| OI-013 | 已修复 | 源数据修正后旧对象不会自动停用 | ETL / 更新机制 | docs/05-archive/open-issues-history/2026-06.md |
| OI-016 | 已修复 | 安全作用域和安全技术模块缺少知识来源独立维护页 | 需求 / 前端 / 导出 | docs/05-archive/open-issues-history/2026-06.md |
| OI-017 | 已修复 | 安全技术模块清单存在疑似数字标题对象 `29` / `98` | 数据质量 / ETL 复核 | docs/05-archive/open-issues-history/2026-06.md |
| OI-018 | 已修复 | 前端整体过度卡片化，无法有效展现业务关系 | 前端 / 需求 | docs/05-archive/open-issues-history/2026-06.md |
| OI-022 | 已修复 | 需要单独 Frontend Design Owner 接管前端设计 | 前端 / Agent 分工 / 需求 | docs/05-archive/open-issues-history/2026-06.md |
| OI-023 | 已修复 | 前端信息架构数据契约待确认 | 前端 / ETL / 需求 | docs/05-archive/open-issues-history/2026-06.md |
| OI-019 | 已修复 | 安全能力作用域目录需要按原始表格样式展示 | 前端 / 需求 | docs/05-archive/open-issues-history/2026-06.md |
| OI-020 | 已修复 | 信息化环境-信息化对象-安全作用域映射缺少一级页面和连续映射展示 | ETL / 前端 / 需求 | docs/05-archive/open-issues-history/2026-06.md |
| OI-024 | 已修复 | 主控 Agent 过早判断子 Agent 无响应 | Agent 分工 / 治理 | docs/05-archive/open-issues-history/2026-06.md |
| OI-025 | 已修复 | 关系工作台需要支持人工调宽、表格筛选和作用域清单核对 | 前端 / 需求 | docs/05-archive/open-issues-history/2026-06.md |
| OI-026 | 已修复 | 前端页面不应展示原始数据来源 | 前端 / 需求 | docs/05-archive/open-issues-history/2026-06.md |
| OI-027 | 已修复 | 安全技术服务编码冲突与 LC-AP 策略编号重复 | 数据质量 / ETL 复核 | docs/05-archive/open-issues-history/2026-06.md |
| OI-028 | 已修复 | 已停用对象仍存在关系残留 | ETL / 数据生命周期 / 导出 | docs/05-archive/open-issues-history/2026-06.md |
| OI-029 | 已修复 | 信息化对象出现同名 active 对象 | 数据质量 / ETL 复核 | docs/05-archive/open-issues-history/2026-06.md |
| OI-030 | 已修复 | 同一关注点与作用域下出现多个安全技术服务候选 | 数据契约 / 后端导出 / 前端兜底 | docs/05-archive/open-issues-history/2026-06.md |
| OI-031 | 已修复 | `/` 无服务单元格尚未作为显式映射导出 | 数据契约 / ETL / 前端展示 | docs/05-archive/open-issues-history/2026-06.md |
| OI-032 | 已修复 | 技术模块列混入非主数据模块名称 | 数据质量 / 数据契约 / 前端展示 | docs/05-archive/open-issues-history/2026-06.md |
| OI-033 | 已修复 | 新增安全技术措施专项维护页面 | 前端页面 / 数据契约 / 专项知识维护 | docs/05-archive/open-issues-history/2026-06.md |
| OI-034 | 已修复 | 能力维度技术视角展示了无原始字段的派生列 | 前端 / 数据语义 | docs/05-archive/open-issues-history/2026-06.md |
| OI-035 | 已修复 | 多个页面展示了非原表字段的 `状态` 和 `待补充` 统计摘要 | 前端 / 需求 | docs/05-archive/open-issues-history/2026-06.md |
| OI-036 | 已修复 | 能力维度页面需更名为安全能力映射 | 前端 / 需求 | docs/05-archive/open-issues-history/2026-06.md |
| OI-037 | 已修复 | 信息化环境维度需将 `environment_segment` 展示为正式层级“环境子类” | 前端 / 数据契约 / 需求 | docs/05-archive/open-issues-history/2026-06.md |
| OI-039 | 已修复 | LC-AP 安全技术模块未匹配既有模块清单 | 数据 / ETL 校验 | docs/05-archive/open-issues-history/2026-06.md |
| OI-040 | 已修复 | LC-AP 安全技术措施未进入 lifecycle workbench 主投影 | 数据契约 / ETL 粒度 / 前端展示 | docs/05-archive/open-issues-history/2026-06.md |
| OI-041 | 已修复 | 主控会话多次重连影响工程开发 | Agent 工作流 / 上下文治理 | docs/05-archive/open-issues-history/2026-06.md |
| OI-043 | 已修复 | LC-DT staging 将表头 / 定义列误识别为正式对象 | ETL / 数据导入 | docs/05-archive/open-issues-history/2026-06.md |
| OI-044#1 | 已修复 | 新版 LC-DT 映射表引入新增场景和模块候选 | 数据 / ETL 导入确认 | docs/05-archive/open-issues-history/2026-06.md |
| OI-044#2 | 已修复 | 原始 `CIS CSC V8` 页与 CIS Controls v8.1.2 存在待修订差异 | 数据 / 标准框架导入 / 版本一致性 | docs/05-archive/open-issues-history/2026-06.md |
| OI-045 | 已修复 | 原始 `等保三级测评清单` 缺少 GB/T 22239-2019 `8.2.3.1 访问控制` | 数据 / 标准框架导入 / 原文完整性 | docs/05-archive/open-issues-history/2026-06.md |
| OI-046 | 已修复 | 原始 `CSF2.0` 页存在待确认翻译修订项 | 数据 / 标准框架导入 / 翻译一致性 | docs/05-archive/open-issues-history/2026-06.md |
| OI-047 | 已修复 | 标准/框架页面表格未占满工作区 | 前端 | docs/05-archive/open-issues-history/2026-06.md |
| OI-048 | 已修复 | 原始 `27001-2022` 页存在分类合并单元格和少量翻译术语待确认 | 数据 / 标准框架导入 / 原文完整性 | docs/05-archive/open-issues-history/2026-06.md |
| OI-051 | 已修复 | 原始 `27001-2022` 页与 ISO/IEC 27002:2022 属性矩阵存在 10 处属性差异 | 数据 / 标准框架导入 / 属性字段一致性 | docs/05-archive/open-issues-history/2026-06.md |
| OI-049 | 已修复 | `capability-workbench.json` 标准 / 框架映射仍为空 | 数据契约 / export / 标准框架映射 | docs/05-archive/open-issues-history/2026-06.md |
| OI-050 | 已修复 | LC-AP `CI/CD流水线` 被拆成 `CI` 与 `/CD流水线` | ETL / 数据清洗 / workbench 投影 | docs/05-archive/open-issues-history/2026-06.md |
| OI-052 | 已修复 | CRF 标准框架页缺少 Core / 成熟度 tab 且底部出现空表格 | 前端 / 标准框架页面 / 布局 | docs/05-archive/open-issues-history/2026-06.md |
| OI-054 | 已修复 | 标准 / 框架映射语义合理性与未映射候选待确认 | 数据治理 / 标准框架映射 / 业务语义复核 | docs/05-archive/open-issues-history/2026-06.md |
| OI-055 | 已修复 | CRF `AI` / `PHY` 新治理域缺少专门能力关注点 | 数据治理 / 能力体系优化 / 标准框架映射 | docs/05-archive/open-issues-history/2026-06.md |
| OI-056 | 已修复 | 部分能力关注点在原始标准 / 框架映射表中为空或缺行 | 数据 / 标准框架映射 / 原始表复核 | docs/05-archive/open-issues-history/2026-06.md |
| OI-057 | 已修复 | 能力关系图谱中标准 / 框架节点未展开到控制项 | 前端展示 / 图谱模型 / 标准框架映射 | docs/05-archive/open-issues-history/2026-06.md |
| OI-058 | 已修复 | 标准 / 框架映射徽标统计与可见条款数量不一致 | 前端展示 / 统计口径 / 标准框架映射 | docs/05-archive/open-issues-history/2026-06.md |
| OI-059 | 已修复 | 能力关系页签存在无意义默认与映射行数统计 | 前端展示 / 信息层级 / 统计口径 | docs/05-archive/open-issues-history/2026-06.md |
| OI-060 | 已修复 | 能力目录需要支持按层级逐级展开 | 前端交互 / 能力目录 / 层级浏览 | docs/05-archive/open-issues-history/2026-06.md |
| OI-061 | 已修复 | 技术视角技术模块 / 措施列不应折叠为 `+N` | 前端展示 / 技术视角 / 信息完整性 | docs/05-archive/open-issues-history/2026-06.md |
| OI-062 | 已修复 | 能力关系图谱高层节点加载过慢 | 前端性能 / 能力关系图谱 / 分层显示策略 | docs/05-archive/open-issues-history/2026-06.md |
| OI-063 | 已修复 | 具体关注点图谱中标准 / 框架控制项被预算截断 | 前端展示 / 能力关系图谱 / 标准框架映射 | docs/05-archive/open-issues-history/2026-06.md |
| OI-064 | 已修复 | 管理视角职能统计正确但职能列展示被截断 | 前端展示 / 管理视角 / 信息完整性 | docs/05-archive/open-issues-history/2026-06.md |
| OI-065 | 已修复 | 进入安全能力映射时默认落到第一个关注点 | 前端交互 / 菜单入口 / 能力目录默认状态 | docs/05-archive/open-issues-history/2026-06.md |
| OI-067 | 已修复 | 标准 / 框架页面列宽、描述列对齐和 tooltip 显示不稳定 | 前端 / 标准框架页面 / 交互 | docs/05-archive/open-issues-history/2026-06.md |
| OI-068 | 已修复 | 刷新页面后没有停留在当前业务页面 | 前端交互 / 路由状态 / 本地静态预览 | docs/05-archive/open-issues-history/2026-06.md |
| OI-069 | 已修复 | 刷新时全局数据包加载过重导致页面可用变慢 | 前端性能 / 数据包加载 / 本地静态预览 | docs/05-archive/open-issues-history/2026-06.md |
| OI-070 | 已修复 | 安全知识表格样式未统一且安全工作清单缺少依赖数据 | 前端展示 / 安全知识页面 / 数据包依赖 | docs/05-archive/open-issues-history/2026-06.md |
| OI-071 | 已修复 | 员工端页面展示了来源追踪和调试类非业务字段 | 前端页面问题 / 字段边界问题 | docs/05-archive/open-issues-history/2026-06.md |
| OI-072 | 已修复 | 员工端本地 API 可被任意网页跨源读取且前端支持 URL 参数切换 API | 本地 API 安全 / 前端数据入口边界 | docs/05-archive/open-issues-history/2026-06.md |
| OI-073 | 已修复 | 作用域映射表仍残留旧安全技术模块名称 | 原始数据一致性 / ETL warning | docs/05-archive/open-issues-history/2026-06.md |
| OI-074 | 已修复 | 安全职能清单列宽不合理且缺少前两列归纳展开 | 前端展示 / 安全知识页面 / 表格结构 | docs/05-archive/open-issues-history/2026-06.md |
| OI-076 | 已修复 | LC-DT 数据备份服务编码与安全技术服务基准不一致 | 原始数据一致性 / LC-DT / 安全技术服务编码 | docs/05-archive/open-issues-history/2026-06.md |
| OI-077 | 已修复 | 操作系统隔离服务曾未进入安全技术服务基准 | 原始数据一致性 / 安全技术模块清单 / 安全技术服务编码 | docs/05-archive/open-issues-history/2026-06.md |
| OI-078 | 已修复 | 两张作用域映射表安全技术服务旧口径不一致 | 原始数据一致性 / 作用域映射 / 安全技术服务编码 | docs/05-archive/open-issues-history/2026-06.md |
| OI-084 | 已修复 | 应用异常行为检测服务编码与名称之间空格不一致 | 原始数据一致性 / 安全技术服务文本规范 | docs/05-archive/open-issues-history/2026-06.md |
| OI-079 | 已修复 | `DSP策略清单（2026）` 解析器在全量 ETL 中长时间卡住 | ETL 性能 / 标准框架导入 | docs/05-archive/open-issues-history/2026-06.md |
| OI-080 | 已修复 | 两个安全指南幻灯片页面索引数据被导出覆盖为空 | 前端数据包 / 内容视图索引 / 安全指南幻灯片 | docs/05-archive/open-issues-history/2026-06.md |
| OI-081 | 已修复，后续可继续优化 | 安全能力映射页首屏加载数据包过大 | 前端性能 / 安全能力映射 / 数据加载 | docs/05-archive/open-issues-history/2026-06.md |
| OI-082 | 已修复 | 能力关系图谱把无技术服务作用域显示为业务节点 | 前端展示 / 能力关系图谱 / 数据语义边界 | docs/05-archive/open-issues-history/2026-06.md |
| OI-083 | 已修复 | 安全职能层级节点附近连线和标签贴合 | 前端展示 / 能力关系图谱 / 管理视角连线 | docs/05-archive/open-issues-history/2026-06.md |
| OI-085 | 已修复 | 关注点图谱首次点击出现短暂空数据 | 前端加载时序 / 安全能力映射 / 关注点关系投影 | docs/05-archive/open-issues-history/2026-06.md |
| OI-086 | 已修复 | 技术视角矩阵把无适用服务显示为 1 个服务 | 前端展示 / 安全能力映射 / 技术视角矩阵 | docs/05-archive/open-issues-history/2026-06.md |
| OI-087 | 已修复 | 管理视角把上一行监督层职能继承到空值关注点 | 数据解析 / 安全能力映射 / 管理视角矩阵 | docs/05-archive/open-issues-history/2026-06.md |
| OI-088 | 已修复 | 标准 / 框架无直接映射时空态样式方向错误 | 前端展示 / 安全能力映射 / 标准框架映射空态 | docs/05-archive/open-issues-history/2026-06.md |
| OI-089 | 已修复 | 前端验证频繁弹出 Chrome 意外退出且 5173 刷新不稳定 | 开发体验 / 本地预览 / 前端验证 | docs/05-archive/open-issues-history/2026-06.md |
| OI-090 | 已修复 | 整体能力节点刷新后关系数据不显示或不完整 | 前端加载时序 / 安全能力映射 / 整体能力节点 | docs/05-archive/open-issues-history/2026-06.md |
| OI-091 | 已修复 | 关注点刷新后管理视角被轻量空壳数据覆盖 | 前端加载时序 / API 投影 / 安全能力映射 / 关注点节点 | docs/05-archive/open-issues-history/2026-06.md |
| OI-092#1 | 已修复 | 安全能力管理视角 ETL 合并单元格和顿号解析导致流程/职能映射错误 | ETL 解析 / 安全能力映射 / 管理视角 / 职能映射 | docs/05-archive/open-issues-history/2026-06.md |
| OI-092#2 | 已修复 | LC-AP 安全技术模块/措施列用规范关系回填导致原始字段值少一项 | 前端展示 / 数据投影 / LC-AP安全开发生命周期 | docs/05-archive/open-issues-history/2026-06.md |
| OI-093 | 已修复 | 安全能力作用域清单主数据被关联表同编码作用域覆盖 | ETL / 数据投影 / 安全知识 / 作用域主数据 | docs/05-archive/open-issues-history/2026-06.md |
| OI-094 | 已修复 | 安全职能流程清单混入 high-level 流程参考并发生顿号误拆 | ETL / 数据投影 / 安全知识 / 流程目录 | docs/05-archive/open-issues-history/2026-06.md |
| OI-095 | 已修复 | 安全技术措施目录混入 LC-AP / LC-DT 生命周期措施 | 数据边界 / ETL 投影 / 安全知识 / 安全技术措施 | docs/05-archive/open-issues-history/2026-06.md |
| OI-096 | 已修复 | 应用系统目录系统类型和组件顺序未按原表保留 | 数据投影 / 安全知识 / 应用系统目录 / 排序 | docs/05-archive/open-issues-history/2026-06.md |
| OI-097 | 已修复 | 作用域映射表 E 列作用域未覆盖安全技术服务编号作用域 | ETL 解析 / 数据投影 / 信息化环境映射 / 安全技术服务 | docs/05-archive/open-issues-history/2026-06.md |
| OI-098 | 业务接受 | 安全技术措施清单多来源口径澄清 | 数据治理 / 主数据边界 / 安全技术措施 | docs/05-archive/open-issues-history/2026-06.md |
| OI-099 | 已修复 | ZIP 本地写接口缺少 token 和来源校验 | 安全 / Delivery Bundle / 本地后端 | docs/05-archive/open-issues-history/2026-06.md |
| OI-100 | 已修复 | ZIP 本地后端可被配置为非 localhost 监听 | 安全 / Delivery Bundle / 运行检查 | docs/05-archive/open-issues-history/2026-06.md |
| OI-101 | 已修复 | 诊断包脱敏范围不完整 | 安全 / 隐私 / Delivery Bundle | docs/05-archive/open-issues-history/2026-06.md |
| OI-102 | 已修复 | `dataClient` 环境旧接口无法消费 `environment-workbench` | 前端 / 数据契约兼容 | docs/05-archive/open-issues-history/2026-06.md |
| OI-103 | 已修复 | maintenance API 与当前前端知识导航 section 不一致 | 后端 API / 前后端契约 | docs/05-archive/open-issues-history/2026-06.md |
| OI-104 | 已修复 | 轻量前端 smoke 未真正覆盖传入 route | 测试 / 前端回归 | docs/05-archive/open-issues-history/2026-06.md |
| OI-105 | 已修复 | ZIP manifest 数据库路径未限制在 bundle 内 | 安全 / Delivery Bundle / 路径边界 | docs/05-archive/open-issues-history/2026-06.md |
| OI-106 | 已修复 | 损坏 app-config 会让 runtime check 和 diagnostics 崩溃 | 可靠性 / Delivery Bundle / 诊断 | docs/05-archive/open-issues-history/2026-06.md |
| OI-107 | 已修复 | IPv6 loopback 被允许但 ZIP alpha 实际不支持 | 兼容性 / Delivery Bundle / 本地服务 | docs/05-archive/open-issues-history/2026-06.md |
| OI-108 | 已修复 | 开发 API standards split dataPath 缺少读取范围限制 | 安全 / 后端 API / 路径边界 | docs/05-archive/open-issues-history/2026-06.md |
| OI-109 | 已修复 | health token 缺少 Host 防护 | 安全 / Delivery Bundle / 本地后端 | docs/05-archive/open-issues-history/2026-06.md |
| OI-110 | 已修复 | user DB 初始化日志手工拼 JSON | 可靠性 / Delivery Bundle / 用户库 | docs/05-archive/open-issues-history/2026-06.md |
| OI-111 | 已修复 | ZIP macOS 包中关注点关系面板持续加载 | 打包 / 前端状态 / Delivery Bundle | docs/05-archive/open-issues-history/2026-06.md |
| OI-112 | 已修复 | 同一业务值在不同页面 / JSON / 表格中显示名称和样式不一致 | 前端 / ViewModel / 数据契约展示治理 | docs/05-archive/open-issues-history/2026-06.md |
| OI-113 | 已修复 | 前端整体色系未统一到莫兰迪低饱和体系 | 前端 / 视觉系统 / 色彩治理 | docs/05-archive/open-issues-history/2026-06.md |
| OI-114 | 已回退 | 能力关系图谱布局修复尝试造成视觉回退 | 前端 / 图谱布局 / 视觉回归 | docs/05-archive/open-issues-history/2026-06.md |
| OI-115 | 已修复 | 刷新后层级能力节点误用默认关注点投影数据 | 前端 / ViewModel / 按需投影回归 | docs/05-archive/open-issues-history/2026-06.md |
| OI-116 | 已修复 | Apple demo 组件级对齐误伤 LC-AP 阶段 Tab 和模块表默认展开 | 前端 / 视觉回归 / 默认展开状态 | docs/05-archive/open-issues-history/2026-06.md |
| OI-117 | 已修复 | 安全能力 projection 缺少对象粒度契约 | 后端 / 数据投影契约 / 防串包治理 | docs/05-archive/open-issues-history/2026-06.md |
| OI-118 | 已修复 | 关注点 projection 前端缺少请求防串包校验 | 前端 / 数据加载 / 防串包治理 | docs/05-archive/open-issues-history/2026-06.md |
| OI-119 | 已修复 | 全局表格字号、空值和安全技术对象 chip 口径不统一 | 前端 / 全局表格规范 / 视觉一致性 | docs/05-archive/open-issues-history/2026-06.md |
| OI-120 | 已修复 | L0 能力节点在完整 workbench 未返回前显示 0 服务 | 前端 / 数据加载 / 初始轻量包回归 | docs/05-archive/open-issues-history/2026-06.md |
| OI-121 | 已修复 | 能力映射标准表格和管理表格字体口径不一致 | 前端 / 视觉一致性 / 表格规范 | docs/05-archive/open-issues-history/2026-06.md |
| OI-122 | 已修复 | 安全能力映射页数据加载、ViewModel、图谱和 CSS 覆盖耦合导致反复回退 | 前端 / 架构治理 / 回归风险 | docs/05-archive/open-issues-history/2026-06.md |
| OI-092#3 | 业务接受 | LC-DT 来源证据存在重复 source_references | 数据治理 / ETL 来源追踪 | docs/05-archive/open-issues-history/2026-06.md |
| OI-042 | 业务接受 | 成熟度评估表 V2 与主工程 L2 能力存在待确认差异 | maturity 模型基准 / 数据一致性 | docs/05-archive/open-issues-history/2026-06.md |
| OI-021 | 已修复 | 能力详情中流程与组织职能相关方重复显示 | ETL / 前端 | docs/05-archive/open-issues-history/2026-06.md |
| OI-053 | 已修复 | 原始 `NIST 800-53rev5` 页存在 1 处英文控制名称单复数差异 | 数据 / 标准框架导入 / 原文一致性 | docs/05-archive/open-issues-history/2026-06.md |
| OI-066 | 业务接受 | DSP2级策略清单 2024 版本缺少 SCF 顶层控制项 AST-31 | 数据一致性 / 原始表复核 / 标准框架 | docs/05-archive/open-issues-history/2026-06.md |
| OI-075 | 已修复 | LC-AP Q/R/S/M/N 列与安全技术服务和模块基准存在口径差异 | 数据一致性 / LC-AP / ETL 口径 | docs/05-archive/open-issues-history/2026-06.md |
| OI-123 | 已修复 | `maintenance-knowledge.json` 单体过大且跨页面耦合，需要拆分与按需加载治理 | 数据契约 / 前端性能 / 治理 | docs/05-archive/open-issues-history/2026-06.md |
| OI-125 | 已修复 | 安全职能清单依赖分片加载后未重新渲染 | 前端 | docs/05-archive/open-issues-history/2026-06.md |
| OI-126 | 已修复 | 安全职能清单和参考页补充映射分片加载 / 合并导致映射列长期为 0 | 前端 / 数据映射 | docs/05-archive/open-issues-history/2026-06.md |
| OI-124 | 已修复 | 知识库字典权威引用全量审计发现作用域与技术措施引用不一致 | 数据契约 / ETL / 数据治理 | docs/05-archive/open-issues-history/2026-06.md |
| OI-127 | 已修复 | 知识库字典与安全标准 / 框架多分片按需加载契约需全局治理 | 前端 / 数据契约 / 治理 | docs/05-archive/open-issues-history/2026-06.md |
| OI-129 | 已修复 | 安全能力映射页签切换重置与矩阵滚动不稳定 | 前端 / 交互 / 滚动契约 | docs/05-archive/open-issues-history/2026-06.md |
| OI-131 | 已修复 | LC-DT 阶段技术模块/措施统计被服务下挂模块膨胀 | 前端 / 数据展示 | docs/05-archive/open-issues-history/2026-06.md |
| OI-132 | 已修复 | 安全能力映射页数据加载稳定性与空态可信度治理 | 前端 / 数据契约 / 验证 | docs/05-archive/open-issues-history/2026-06.md |
| OI-134 | 已修复 | 安全能力 T-AD.SA 权威名称缺少“能力”后缀 | 数据 / 前端 | docs/05-archive/open-issues-history/2026-06.md |
| OI-136 | 已修复 | 深层路由直接访问未加载前端样式 | 前端 / 路由 / 交付体验 | docs/05-archive/open-issues-history/2026-06.md |
| OI-140 | 已关闭 | 知识库字典与安全标准 / 框架基准包被 core-only 导出覆盖 | 数据 / ETL / 前端数据包 / 治理 | docs/05-archive/open-issues-history/2026-06.md |
| OI-133 | 已关闭 | ArchiMate 建模语言页显示效果与加载效率优化 | 前端 / 设计 / 性能 | docs/05-archive/open-issues-history/2026-06.md |
| OI-143 | 已关闭 | 安全技术服务字典更新后运行包和派生产物仍有旧服务引用 | 数据 / ETL / 引用一致性 | docs/05-archive/open-issues-history/2026-06.md |
| OI-158 | 已关闭 | 指南幻灯片页面响应式尺寸不稳定且翻页控件不可用 | 前端 / 指南幻灯片 / 响应式布局 / 打包 App | docs/05-archive/open-issues-history/2026-06.md |
| OI-139 | 已关闭 | 作用域-安全技术服务-安全技术模块映射导入关系与当前 JSON 投影不一致 | 数据 / ETL / 投影 | docs/05-archive/open-issues-history/2026-06.md |
| OI-038 | 已关闭 | Gartner 与安全职能候选映射需后续人工校对 | 数据 / 需求 | docs/05-archive/open-issues-history/2026-06.md |
| OI-160 | 已关闭 | 知识库字典维护页页签未冻结导致滚动后被遮挡 | 前端 / 交互 / 知识库字典 / sticky tab | docs/05-archive/open-issues-history/2026-06.md |
| OI-188 | 已关闭 | `M-* -00` 管理类安全技术服务全局搜索双目标返回与定位契约 | 全局搜索 / 索引覆盖 / 安全技术服务 / 安全能力映射 / 防回归审计 | docs/05-archive/open-issues-history/2026-06.md |
| OI-185 | 已关闭 | 搜索索引覆盖矩阵、局部搜索历史域隔离和 Issue 筛选体验修复 | 前端搜索 / 搜索索引质量 / 工作台 Issue 体验 / 防回归审计 | docs/05-archive/open-issues-history/2026-06.md |
| OI-177 | 已关闭 | 作用域名称未按字典权威标题规范化 | 数据投影 / 字典规范化 / 能力映射 / 环境映射 / 生命周期 / 防回归审计 | docs/05-archive/open-issues-history/2026-06.md |
| OI-176 | 已关闭 | 能力 / 环境 split projection 残留模块误作安全技术措施引用 | 数据投影 / OI-149 split / 能力映射 / 信息化环境映射 / 安全技术模块与措施粒度 / 防回归审计 | docs/05-archive/open-issues-history/2026-06.md |
| OI-167 | 已关闭 | I-AP 数据水印 / 脱敏服务名疑似误套 I-DI canonical 名称 | 数据 / 原始 Excel / 安全技术服务字典 / ETL / 前端投影 | docs/05-archive/open-issues-history/2026-06.md |
| OI-166 | 已关闭 | 安全技术模块 / 措施 / 服务清单缺少信息化环境 / 对象反向映射 | 前端 / 产品设计 / 知识库字典 / 关系反向映射 | docs/05-archive/open-issues-history/2026-06.md |
| OI-165 | 已关闭 | 前端业务文本无法稳定选中复制 | 前端 / 基础交互 / 文本选择 / 复制体验 | docs/05-archive/open-issues-history/2026-06.md |
| OI-163 | 已关闭 | GB/T 42446 与 Gartner 参考页归属错误且 GB/T 表 2 缺少独立呈现 | 数据 / 前端 / 标准框架 / 知识库字典 | docs/05-archive/open-issues-history/2026-06.md |
| OI-142 | 已关闭 | 安全技术服务清单能力-关注点顺序下服务显示不全 | 前端 / 数据消费链路 / 页面可见性 | docs/05-archive/open-issues-history/2026-06.md |
| OI-182 | 已关闭 | 信息化对象与 LC-DT 服务集合按业务合理性纠偏与投影同步 | 数据 / ETL / 信息化环境 / LC-DT / 防回归审计 | docs/05-archive/open-issues-history/2026-06.md |
| OI-164 | 已关闭 | AppShell 页面滚动容器嵌套导致滚动卡顿 | 前端 / 滚动架构 / AppShell / 防回归审计 | docs/05-archive/open-issues-history/2026-06.md |
| OI-189 | 已关闭 | LC-DT 策略矩阵行级数据与搜索锚点不同步 | 数据 QA / 生命周期投影 / 全局搜索 / 局部搜索 / 防回归审计 | docs/05-archive/open-issues-history/2026-06.md |
| OI-186 | 已关闭 | 安全能力映射页关系投影加载阻塞主画布 | 前端 / 加载契约 / 安全能力映射 / 性能体验 | docs/05-archive/open-issues-history/2026-06.md |
| OI-172 | 已关闭 | LC-AP / LC-DT 阶段 tab 胶囊宽度导致横向滚动条 | 前端 / 产品体验 / 生命周期阶段导航 / 防回归审计 | docs/05-archive/open-issues-history/2026-06.md |
| OI-187 | 已关闭 | 安全能力映射三视角数据准确性与关系一致性审计 | 数据 QA / 安全能力映射 / 技术视角 / 管理视角 / 标准框架映射 / 防回归审计 | docs/05-archive/open-issues-history/2026-06.md |
| OI-184 | 已关闭 | 页面内搜索历史基线和搜索索引质量探针补齐 | 前端搜索 / 搜索索引质量 / 防回归审计 | docs/05-archive/open-issues-history/2026-06.md |
| OI-183 | 已关闭 | 全局搜索历史提交时机和分页按钮宽度回归 | 前端搜索 / 产品体验 / 防回归审计 | docs/05-archive/open-issues-history/2026-06.md |
| OI-181 | 已关闭 | 全局搜索结果页分页窗口、预览串线和搜索历史基线不统一 | 前端搜索 / API 搜索窗口 / 产品体验 / 防回归审计 | docs/05-archive/open-issues-history/2026-06.md |
| OI-180 | 已关闭 | 全局搜索结果页缺少分页和固定查询上下文 | 前端搜索 / 产品体验 / 搜索结果页信息架构 / 防回归审计 | docs/05-archive/open-issues-history/2026-06.md |
| OI-179 | 已关闭 | 全局搜索计数使用返回窗口导致短词 / 长词分类数不一致 | 前端搜索 / 后端 API / 产品契约 / 计数口径 / 防回归审计 | docs/05-archive/open-issues-history/2026-06.md |
| OI-178 | 已关闭 | 安全能力非关注点级投影返回关注点关系图 | 前端投影 / 安全能力映射 / 数据粒度契约 / 防回归审计 | docs/05-archive/open-issues-history/2026-06.md |
| OI-175 | 已关闭 | 全局搜索未覆盖标准 / 框架明细行 | 后端 API / 前端搜索 / 标准框架 / 结果队列 / 防回归审计 | docs/05-archive/open-issues-history/2026-06.md |
| OI-174 | 已关闭 | 安全技术措施清单被映射表候选项污染为 36 条 | ETL / 前端投影 / 知识库字典 / 数据粒度契约 / 防回归审计 | docs/05-archive/open-issues-history/2026-06.md |
| OI-173 | 已关闭 | 安全技术模块清单 module.systems 投影不完整 | ETL / 前端投影 / 知识库字典 / 防回归审计 | docs/05-archive/open-issues-history/2026-06.md |
| OI-171 | 已关闭 | LC-AP / LC-DT 正文区域出现嵌套纵向滚动条 | 前端 / 产品体验 / 滚动架构 / 防回归审计 | docs/05-archive/open-issues-history/2026-06.md |
| OI-169 | 已关闭 | 安全技术模块清单 module.services 投影不完整 | ETL / 前端投影 / 知识库字典 / 防回归审计 | docs/05-archive/open-issues-history/2026-06.md |
| OI-168 | 已关闭 | 信息化对象-安全技术服务源表补充与上下文投影同步 | 数据 / 原始 Excel / ETL / SQLite / 前端投影 | docs/05-archive/open-issues-history/2026-06.md |
| OI-162 | 已关闭 | 安全能力管理视角安全工作合并单元格修正重导 | 数据 / ETL / 能力映射 / 安全管理工作 | docs/05-archive/open-issues-history/2026-06.md |
| OI-159 | 已关闭 | 能力页 L0 / L1 双 tab 总览型阅读模式 | 前端 / 产品设计 / 性能 / 能力映射 / projection | docs/05-archive/open-issues-history/2026-06.md |
| OI-155 | 已关闭 | 全局搜索产品形态与搜索结果页重设计 | 前端 / 产品设计 / 搜索 / 信息架构 / 性能边界 | docs/05-archive/open-issues-history/2026-06.md |
| OI-154 | 已关闭 | 页面内搜索功能回归与环境页搜索不可用 | 前端 / 搜索 / 页面内筛选 / 信息化环境映射 | docs/05-archive/open-issues-history/2026-06.md |
| OI-153 | 已关闭 | 批注抽屉底部卡片展开后当前批注显示不完整 | 前端 / 批注 / 交互 / 滚动可见性 | docs/05-archive/open-issues-history/2026-06.md |
| OI-152 | 已关闭 | LC-AP / LC-DT 旧批注阶段 ID 失效导致定位不到 | 前端 / 批注 / 生命周期页面 / 定位恢复 | docs/05-archive/open-issues-history/2026-06.md |
| OI-151 | 已关闭 | 信息化环境汇聚图节点缺少稳定业务锚点导致定位不到 | 前端 / 批注 / 信息化环境映射 / 锚点契约 | docs/05-archive/open-issues-history/2026-06.md |
| OI-149 | 已关闭 | 前端 JSON 加载体量与首屏性能需分层治理 | 前端 / 数据包 / 性能 / JSON 治理 | docs/05-archive/open-issues-history/2026-06.md |
| OI-148 | 已关闭 | 全局批注在新环境页面缺少值级锚点与路由切换遮挡治理 | 前端 / 批注 / 全局交互 / 信息化环境映射 | docs/05-archive/open-issues-history/2026-06.md |
| OI-144 | 已关闭 | 全局搜索与页面内搜索状态串线 | 前端 / 交互 / 状态管理 | docs/05-archive/open-issues-history/2026-06.md |
| OI-137 | 已关闭 | 信息化环境首页需导入 draw.io 第三页实例底图 | 前端 / 设计 / Draw.io 导入 | docs/05-archive/open-issues-history/2026-06.md |
| OI-170 | 已关闭 | LC-DT 加工/使用阶段双表模块/措施集合差异 | 数据 / 原始 Excel / LC-DT / 待业务确认 | docs/05-archive/open-issues-history/2026-06.md |
| OI-161 | 已关闭 | 工作台 ISSUE清单入口与列表项点击失效 | 前端 / 工作台 / Issue / 交互 | docs/05-archive/open-issues-history/2026-06.md |
| OI-156 | 已关闭 | 全局批注定位 / 高亮性能退化导致页面假死 | 前端 / 批注 / 性能 / 定位 / 高亮 | docs/05-archive/open-issues-history/2026-06.md |
| OI-150 | 已关闭 | 全局批注值定位缺少运行时索引导致定位慢 | 前端 / 批注 / 性能 / 定位索引 | docs/05-archive/open-issues-history/2026-06.md |
| OI-145 | 已关闭 | 本地 API Host/token 边界未统一拦截 | 安全 / 本地 API / 用户数据 | docs/05-archive/open-issues-history/2026-06.md |
| OI-141 | 已关闭 | LC-DT 原始数据更新后的服务、模块与分类候选问题 | 数据 / ETL / 候选包 | docs/05-archive/open-issues-history/2026-06.md |
| OI-147 | 已关闭 | 信息化环境安全技术汇聚图措施误继承安全系统 | 数据 / 前端 / ViewModel / 信息化环境映射 | docs/05-archive/open-issues-history/2026-06.md |
| OI-146 | 已关闭 | 信息化环境安全技术汇聚图安全系统列未带出 | 前端 / ViewModel / 信息化环境映射 | docs/05-archive/open-issues-history/2026-06.md |
| OI-135 | 已关闭 | 用户库治理与兼容表迁移清理 | 数据 / 前端 / Delivery Bundle / 治理 | docs/05-archive/open-issues-history/2026-06.md |
| OI-157 | 已关闭 / 自动验收通过 | 打包测试反馈需要单独导出用户批注 | Delivery Bundle / 用户数据 / 批注 / 诊断 | docs/05-archive/open-issues-history/2026-06.md |
| OI-190 | 业务接受 | macOS DMG 外部分发签名公证、安装与更新机制待确认 | macOS 交付 / 签名公证 / 安装更新机制 | docs/05-archive/open-issues-history/2026-06.md |
| OI-193 | 已关闭 / 自动验收通过 | `viewModels.js` 行数超过前端治理基线但来源未说明 | 前端 / 治理门禁 / 变更边界 | docs/05-archive/open-issues-history/2026-07.md |
| OI-194 | 已关闭 / 自动验收通过 | 生命周期宽表双轴滚动、上下文覆盖与模块字典引用回归 | 前端布局 / ViewModel / 字典引用 / 防回归审计 | docs/05-archive/open-issues-history/2026-07.md |
| OI-195 | 已关闭 / 用户验收通过 | P1-3 生命周期纵向滚动卡顿、提示残留与空值不统一 | 前端 / 性能 / 生命周期工作台 / 防回归审计 | docs/05-archive/open-issues-history/2026-07.md |
| OI-196 | 已关闭 / 用户验收通过 | P1-2 / P1-4 / P1-5 前端验收结论与真实交互契约不一致 | 前端 / shared runtime / 本地 API / 产品设计 / 防回归审计 | docs/05-archive/open-issues-history/2026-07.md |
| OI-192 | 已修复 / 待用户验收 | 成熟度评分工作台服务、评分定义与主动作契约未按截图落地 | 前端 / 成熟度评分 / 产品设计 / 防回归审计 | docs/06-implementation/open-issues.md |
| OI-191 | 已修复 / 待用户验收 | 全局共享标题区视觉 token 偏离旧 DMG 基线 | 前端 / 共享 App Shell / 设计 / 审计 | docs/06-implementation/open-issues.md |
| OI-138 | 长期保留 / 按需继续修复 | 关注点关系图谱标签与节点 / 连线碰撞 | 前端 / 图谱布局 / 设计 | docs/06-implementation/open-issues.md |
| OI-128 | 部分完成 | USER-WRITE-UI-1：批注 / 工作台用户写入入口 | 前端 / 用户数据 / Delivery Bundle | docs/06-implementation/open-issues.md |
| OI-197 | 待业务确认 / 映射门禁阻断 | 成熟度评分依据与当前能力字典尚未全量映射 | 数据 / 成熟度 / 当前字典 / 源 Excel / 业务确认 | docs/06-implementation/open-issues.md |
| OI-198 | 待实现 / 契约已确认 | 导入审批缺少幂等门禁、中间数据终结和 approved 默认导出契约 | ETL / SQLite / 来源追踪 / 导入导出 / 数据治理 | docs/06-implementation/open-issues.md |
| OI-199 | 批次 A 开发中 / P0 | 本地 MCP 产品开发与客户端验证 | 架构 / 安全 / MCP / Web / App / 兼容性 / 治理 | docs/06-implementation/open-issues.md |
