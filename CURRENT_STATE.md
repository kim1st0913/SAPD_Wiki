# CURRENT_STATE: SAPD Wiki

> 状态：`active / primary recovery entry`
>
> 更新日期：2026-07-31

本页只保留恢复工作所需的当前事实、保护边界、风险和下一步。详细执行历史从 `progress.md` 和 `docs/05-archive/README.md` 进入。

## 1. Git 与工作区

- 当前分支：`main`
- 当前 HEAD：`8ccb870308d0`
- 2026-07-29 只读核对：`main` 与 `origin/main` 为 `0 / 0`
- 工作树仍为 dirty；包含文档治理五轮改动，以及此前已有的 App、前端、脚本、
  `data/`、生成资产和 Sites 改动
- 未对本轮文档治理执行 stage、commit 或 push
- `data/`、SQLite、恢复包、DMG、Setup、虚拟环境、`node_modules` 和构建产物不得
  进入 Git

旧 `codex/windows-electron` 本地和远端分支已经删除，不得恢复为日常生产分支。

## 2. 当前产品状态

### 知识与数据

- 基础内容统一查询 T0—T6 已正式应用；Draw.io 空页不再生成内容对象
- 当前正式内容口径为 9 个文档、609 个片段、684 条内容关系和 1,302 条内容证据
- OI-198 导入审批幂等、任务终结、approved 默认导出和正式写入门禁已实现并验证
- 增量发布链路已具备 `prepare / build / verify / apply / accept / rollback`
- 当前增量发布状态为 `gated`；没有新发布授权时不得写正式查询库或资产库
- 信息化环境主数据 P0—P8 已完成 Web 验收：10 个环境、16 个子类类型、51 个对象，
  共 77 条定义和 125 条关联使用

正式数据、源 Excel、真实用户库、评分规则和 ETL 只有在新请求明确授权并给出备份 /
恢复路径后才能修改。

### 成熟度

- V2.1 需求、领域模型、数据模型和模板映射仍是当前正式合同
- 自定义模板创建后已直接进入“评估模板”，并提供可持续优化的 Apple Shell
  脑图工作台：完整模型保持 3 个 L0、10 个 L1、32 个 L2、91 个关注点、160 条服务关系，
  首次默认只展开到 L1，可见 1 个模板根、3 个 L0、10 个 L1 和 13 条关系线。模板根及
  所有存在下级的能力 / 关注点节点常驻收起 / 展开按钮，L1、L2、关注点逐层披露下一级；
  目录定位深层对象时自动展开祖先路径。画布支持空白拖动平移、5%—130% 缩放、适配全图、
  节点增删改、合法层级移动及右键编辑。新建以及结构尚未初始化的
  自定义项目默认带出基础模板；模板根和各级节点可复制完整子树；空白处可创建并编辑
  类型的自由节点，再拖到合法父级吸附。目录和属性为可收起悬浮面板。节点边缘按钮
  专用于收起 / 展开，新增下级和同级统一从右键菜单进入；能力、关注点和服务拖到合法
  新父级时带上全部下级。所有入口共用有类型层级约束。结构编辑支持 15 步会话级撤销 /
  重做和子树复制快捷键。1280×720 与
  1440×900 真实页面无横向溢出，新增关注点 185 → 186、撤销 / 重做和刷新清理链路
  通过，浏览器 error / warning 为 0。该实现只修改 shared runtime
  前端与浏览器本地模板草稿，不改变正式模板、评分规则或真实用户库
- 自定义模板节点属性已收敛为当前节点自身属性，结构操作只在画布和右键菜单完成；行内
  新增为后续分支预留高度，不再覆盖节点。“标准 / 标准修改 / 新增”使用中性实线、
  金棕实线和蓝色虚线形成可见三态。服务角色改为模板硬规则：T 类能力下服务固定为
  `ASSESSMENT_POINT` 独立服务评估点，G / M 类服务固定为
  `PLATFORM_EVIDENCE_REFERENCE` 平台工具参考，无服务时由关注点形成 `FOCUS`
  评估点。该规则覆盖自定义模板加载、创建、拖拽换父级、XLSX 导入和后端校验；页面
  只读展示角色，不提供选择。当前基础模板仍为 160 条服务关系，其中 154 条 T 类独立
  服务评估点、6 条 M 类平台参考、G 类 0 条。未改评分公式、Rubric、保护字典、正式
  SQLite 或真实用户数据
- 自定义模板节点现统一维护名称、编号和定义；标准来源 L0 / L1 / L2 / 关注点定义由
  后端从知识对象投影，模板内修改后进入“标准修改”，不写回标准模板。新增节点定义为
  可选，安全技术服务继续额外维护作用域和只读系统角色。悬浮属性栏改为内容驱动高度，
  超出后只在面板内部滚动，临时节点已移除“在右侧完成”等方位提示。成熟度首页新增
  “新增模板”，与项目评估模板复用同一图谱编辑器；首页新增草稿不进入项目列表或评分。
  项目模板仅在校验发布后进入首页模板管理并显示来源项目，再次修改后恢复草稿并退出
  已发布项目模板列表。当前资产仍只写受控浏览器本地状态，未写正式 SQLite 或真实用户库
- 自定义模板的通用评分依据由后端 / ViewModel 单一维护，版本为
  `sapd-maturity-custom-generic-rubric-v3-2026-07-30`。模板根属性区可查看 L1—L5
  通用描述；新建且没有对象专用评分依据的评估点，按“5 个等级 × 4 个维度”生成
  `CUSTOM_GENERIC_FALLBACK`。从基础模板复制的对象专用评分依据保持原样，固定模板中
  缺失的对象专用评分依据仍保持阻塞，不以通用文本静默补齐。该通用基线的 L4 不预设
  KPI，以稳定运行、可比较结果、偏差纠正和效果验证为核心；L5 不以 AI 为必要条件
- OI-197 已形成 V3 业务审阅提案包：指南 v1.4、91 个关注点评分基线主表、
  差异说明、185 个评估点 / 3,700 个等级维度单元的离线复核工作台和结构化提案；
  候选指标库已退出正式提案
- V3 提案逐关注点设计连续有效等级范围，不采用统一的 L1—L5 硬门槛；T-IN.IP 为
  L2—L5，T-OF 采用条件适用并从 L3 起评。原 15 项 Rubric 裁定已进入工作台统一复核
- V3 业务审阅完成并取得正式迁移授权前，不得写 Rubric 字典、评分规则、源 Excel、
  正式成熟度数据或历史项目结果

### MCP

- MCP Web 五工具、TLS / OAuth、CurrentUser 持久 Runtime、refresh-token 兼容、
  自动生命周期和受控基础知识访问均已实现
- 2026-07-28 已修复 macOS 安全存储临时不可访问被误判为密钥永久丢失的问题：
  运行中的 Sidecar 不再因锁屏期间的临时读取失败被终止，未运行服务会在安全存储恢复后
  由用户重新启动；真实条目缺失仍保持 fail closed
- Web 证书重建曾因 `login.keychain-db` 返回 `36 / 51` 自动回滚，现已分类为可恢复的
  `SECRET_STORE_UNAVAILABLE`；用户交互解锁后恢复，确认是 CLI 安全会话而非钥匙串损坏
- 5173 正式工作区的 home、health、workspace projection、正式双库 / 用户库路径、
  数据根目录、持久 Runtime 和保留端口单测均通过；系统 Chrome 未启动

### macOS / Windows 交付

- macOS 保留正式 Mac 主工作区本地打 DMG；2026-07-29 已从同一当前源码构建
  `0.3.5` license / no-license 双包，最终交付时间戳为 `20260729-133600Z`，其中
  no-license 为本轮主要测试包
- 两份 `0.3.5` 均通过完整 pre-DMG、arm64 ad-hoc 签名、`hdiutil verify`、只读挂载、
  Runtime `--check-only` 和实际冷启动验收；正式双库哈希与当前源库一致，内置用户库为
  `user_schema_0.3` 空模板。包内 MCP 新 Runtime 默认端口保持 `28775`；已有本地
  `control.sqlite3` 的持久配置优先加载，因此当前用户的 `28776` 无需重新打包
- 下一次 DMG 构建会在镜像根目录加入指向 `/Applications` 的 `Applications` 图标，
  用户可按 macOS 常规方式拖动 `SAPD Wiki.app` 完成安装；当前 `0.3.5` 历史包不重建
- 本轮未操作 Keychain / 信任设置，真实用户库哈希保持
  `0e3db1224b4c2044bcd0dfe4a7fbe9e3e5a28cf081a8ab1ff0b2622030c0af81`
- 用户确认当前已安装的 0.3.0 在交互解锁 `login.keychain-db` 后，原证书、OAuth 和
  MCP 链路可以恢复；没有证据表明最初故障是证书损坏或口令永久丢失
- 2026-07-28 quick 门禁确认历史 license / no-license staging 前端不一致，且最新
  DMG staging 落后当前源码；下次新包必须从同一当前源码重建两个 staging
- 2026-07-28 已按用户要求回退 Native Security Broker、Data Protection Keychain
  接线、桌面 `app` profile 强制门禁及因本次故障扩展的签名 / 公证实现，恢复 0.3.0
  使用的 `/usr/bin/security` 登录钥匙串路径；只保留 `36 / 51` 临时错误分类、解锁提示、
  运行中 Sidecar 保持和解锁后手动重试
- App MCP `28776` 的既有运行态已确认监听、授权和 Token 签发，但没有用当前最新源码
  重新打包，也未完成实包内五工具与 `TOOL_CALL` 审计；该项并入下一次最新 DMG 验收，
  不以现有安装包或 Web `28775` 代替
- 未完成签名 / notarization、证书、OAuth 和首次路径人工 UAT 时，不得宣称正式外部分发
- Windows 以公开 `main` 精确 SHA 和私有 Delivery Data 为输入，由私有
  `windows-2022` Runner 生成、校验并上传完整 `Setup.exe`
- Windows 当前为 `internal_release_ready`；未执行真实 Windows 10/11 UAT 的版本不得
  标记为正式实测通过

当前交付操作入口：

- `docs/09-delivery/desktop-packaging-runbook.md`
- `docs/09-delivery/release-acceptance-matrix-0.1.md`

## 3. 当前文档权威入口

- 当前状态：`CURRENT_STATE.md`
- 当前未完成主线：`task_plan.md`
- 最近执行结果：`progress.md`
- 长期决策与风险：`findings.md`
- 场景导航：`docs/README.md`
- 文档状态与归档规则：`docs/DOCUMENT_GOVERNANCE.md`
- 历史材料：`docs/05-archive/README.md`

completed、historical 和 retired 文档只用于追溯，不得覆盖当前合同和运行代码。

2026-07-28 文档治理第五轮已完成；旧版进入 `docs/05-archive/`，当前对外介绍只描述
本地优先、可追溯知识治理、关系工作台、桌面交付和只读 MCP。

## 4. 当前未完成主线

1. 用户在 OI-197 V3 离线工作台中复核 91 个关注点范围和 185 个评估点评分依据；
   Level 4 重点复核受控运行、可比较结果、偏差处理和效果验证，不预设统一指标；
   如后续立项指标库，须另行确认来源、口径、数据质量和批准机制。争议项完成裁定后
   再单独决定是否迁移正式数据。
2. 新知识发布时执行正式 apply → immutable runtime restart → MCP 五工具验收 → accept。
3. Windows 打包时使用最新 `main` 和最新批准 Delivery Data 触发私有 Runner。
4. 在 `0.3.5` 最新实包中完成人工 UAT：首次保存路径、首次建证、完全退出重开、锁屏 /
   解锁后的明确恢复路径，以及 App MCP `28776` 的 OAuth / 五工具 / `TOOL_CALL` 审计。
   正式外部分发所需 Developer ID / notarization 必须另行立项和验收。

更详细的停止条件见 `task_plan.md`。

## 5. 恢复与停止条件

- 开始修改前先看 `git status`，保留所有已有 dirty work
- 不使用 `git add .`、`reset`、`checkout` 覆盖或 `clean`
- Web 5173 通过不能替代 App、DMG 或 Windows 实包验收
- 数据、用户状态、打包或发布边界发生变化时，必须同步更新本页和 `progress.md`
- 详细历史状态已归档到
  `docs/05-archive/current-state-history/CURRENT_STATE-before-third-round-2026-07-28.md`
