# Task Plan: SAPD 工作知识库系统

本文档只保留当前阶段计划入口和未完成主线。完整历史计划已归档，避免每次开工默认加载过长上下文。

## 当前状态

- Status: `data_update_engineering_and_cross_platform_delivery_active`
- Started: 2026-05-09
- 当前主线：完成数据更新工程化、知识内容增量发布、导入治理和跨平台交付验收
- 快速状态入口：`CURRENT_STATE.md`
- 完整历史计划归档：`docs/05-archive/context-slimming-2026-05-15/task_plan-full-before-slimming.md`

## 2026-07-27 阶段收口

- 源码 checkpoint：`62e682d`；计划同步：`f683df7`。
- Windows 长期分支：`origin/codex/windows-electron=f683df7`，已与当时 `main` 快进一致；保留不删除。
- OI-198：`complete / verified / archived`。
- 知识内容增量发布：工程链路已实现，真实基线 release `65f9425b4e3550513f127ea57abe2094eb65e01f389a00fc62ad463cf44c5257` 已双次幂等构建并通过 verify，状态停在 `gated`；正式 apply、runtime restart、MCP五工具和 accept 需在下一次明确发布窗口执行。
- OI-197：15项业务裁定清单已形成，等待用户逐项选择；在裁定前不写字典、评分规则、源Excel或正式数据。

## 今晚执行主线：基础知识与内容统一查询（2026-07-26）

- 状态：`t6_complete`
- 截止：2026-07-26 23:59（Asia/Singapore）
- 目标：使基础对象、基础关系、关系 provenance、Draw.io 和正式指南内容在不依赖仓库原始文件的交付程序中通过数据库统一查询；Draw.io/指南原文件进入受控资产数据库，抽取文本和结构进入正式查询库。
- 正式数据边界：ArchiMate Poster 不做 OCR；语义源优先级为 Markdown、语义 HTML、PPTX、带文本层 PDF、普通指南 OCR PDF；原文件进入资产库，规范化内容进入查询库，用户数据库禁止修改。
- T0 结果：已冻结 9 个正式文档、2 个派生资产、4 个派生集合、9 个 stable ref 和 11 个正式英文逻辑文件名；禁止 `sample` / `samle` / `~$` 命名，源文件保持只读且不重命名；只读清单审计通过，正式基础库 hash 未变化。
- T1 准入：从冻结清单构建 additive query schema、独立资产库 schema 和格式导入器；所有写入先落候选库，不直接修改正式基础库。
- T1 结果：查询/资产 schema 与五类导入器已完成；候选库两次完整导入幂等，当前为9个文档、610个片段、685条关系、619条内容证据和182个内容寻址资产（`195,646,574` bytes）。Draw.io 3页/199节点/82边，3套PDF 164页，两份PPTX 80页，Markdown 51节，HTML 24节，Poster 7个人工目录区域；正式库和源文件hash未变，用户库未访问。
- T2 准入：基于现有候选库检查内容质量，并仅对数据安全PDF第43页、知识库PPTX第32页执行已批准的普通内容fallback；Poster继续禁止OCR。
- T2 结果：两个普通内容fallback均已完成视觉核对、OCR和人工复核，状态为`ocr_reviewed`，原始OCR文本不入库但保留其hash；`ocr_pending=0`，Poster OCR=0。Draw.io/PDF/PPTX/Markdown/HTML/Poster计数、FTS命中、171个页面/区域预览绑定、关系端点、HTML清洗、命名、两次幂等导入和资产round-trip全部通过；正式库/源资产未变，用户库未访问。
- T3 准入：复用候选库现有FTS、内容关系和内容证据，扩展统一查询投影，使基础对象/基础关系与内容文档/片段/Draw.io连线可按同一stable-ref合同读取。
- T3 结果：共享`BaseKnowledgeQueryService`已兼容基础库-only与完整内容schema两种状态；候选库可联合查询5,313个对象和8,471条关系，基础关系7,786/7,786、内容关系685/685均有provenance。基础对象、内容文档/片段、Draw.io页面/节点/边、基础/内容关系ref及其证据代表性读取通过；中文FTS+substring fallback、真实`base_relation:`命名空间、响应字段边界和只读authorizer已固化。核心查询35项、MCP集成19项、统一内容专项4项和基础查询专项7项通过。
- T4 准入：把已验收共享core接入正式MCP五工具与Web/App API；二进制资产只经独立asset API读取，MCP继续禁止BLOB。
- T4 结果：正式MCP Sidecar已通过显式联合查询库路径复用五工具core；Web与打包App后端新增同源`/api/v1/knowledge/*`五类只读接口，独立`/api/v1/content/assets`只返回资产元数据，`/api/v1/content/assets/{sha256}`使用SQLite BLOB增量读取并支持单段HTTP Range。版本工具同时返回基础、内容和资产manifest digest，MCP不打开资产库。真实OAuth MCP候选五工具E2E、Web/App handler、SVG/PNG/PDF Range、核心35项和候选边界审计通过；正式基础库未变，用户库未访问。
- T5 准入：执行离线打包模拟、移除原始目录依赖后的代表性查询/展示、候选diff和完整只读边界验收；本阶段仍不正式apply。
- T5 结果：离线模拟包携带候选查询库、资产库和空用户库；包内成熟度HTML与Poster PDF原件均改由稳定owner/role资产接口读取，所有与资产库`original`同hash的外部副本已删除。阻断仓库原始/生成目录后，MCP五类代表性读取和App的SVG/PNG/PDF/HTML Range读取全部通过；候选diff、数据库只读边界、8项定向测试、打包合同和完整pre-DMG通过。
- T6 准入：在正式写入前建立查询库与资产库双备份、恢复命令和验收快照；取得明确正式apply授权后再替换正式库并重跑版本一致性与回退演练。
- T6 结果：正式写入前停止5173与MCP Sidecar，验证候选完整性、固定计数、182个BLOB hash和T5证据；旧基础库备份及资产库“应用前不存在”状态进入恢复包。正式查询库/资产库已原子应用并与候选hash一致；独立恢复演练、稳定5173双库profile、MCP/Web/App正式读取、MCP 186项和完整pre-DMG均通过，真实用户库未修改。T0—T6执行主线已完成。
- 详细计划：`docs/06-implementation/base-content-unified-query-tonight-plan-2026-07-26.md`

## 当前收敛任务：Git 工作区归一化（2026-07-24）

### 目标与最终状态

本任务不采用“把每个分支都执行一次 `git merge`”的机械做法。当前 MCP 分支由同一批内容的多轮重建、cherry-pick 和集成分支组成，直接逐支 merge 会把重复实现和冲突历史重新带回主线。

最终验收标准是：

1. 所有仍有价值的已提交成果和未提交成果均进入本地 `main`，或被证明已由 `main` 中更新实现取代。
2. 每个旧分支都必须取得 `absorbed`、`superseded` 或用户明确确认的 `abandoned` 结论；没有结论不得删除。
3. 项目唯一日常工作目录恢复为 `/Users/kim1st/Documents/kim note/06_dev_projects/SAPD_Wiki`，且该目录检出 `main`。
4. 本地最终只保留 `main`；附加 worktree 全部移除。远端 `origin/codex/windows-electron` 是否删除作为最后一个独立外部写操作确认。
5. `data/`、用户数据库、成熟度报告历史、生成数据包、虚拟环境、构建产物、DMG 和临时挂载不进入 Git，也不因收敛被清理或覆盖。
6. 完整验收必须在主工作目录的真实本地数据路径上执行；不得通过放宽 `_frontend_data_path()` 的目录边界来迁就 `/private/tmp` symlink。

### 已核对现场（收敛前快照）

| 范围 | 当前事实 | 处理原则 |
|---|---|---|
| 本地 `main` | `/private/tmp/SAPD_Wiki-main-merged`，HEAD `75a5c49`，比 `origin/main` 领先 4 个 MCP 集成提交 | 作为临时集成台；不是最终项目目录 |
| 主工作目录 | `codex/windows-electron`，HEAD `8b46b83`，包含大量 tracked / untracked 用户工作 | 冻结为主要恢复源，最后才切换到 `main` |
| 第二处 dirty worktree | `codex/local-mcp-web-integration`，含证书 / 信任设计、端口测试和治理记录等未提交内容 | 单独建清单并评审，不得随 worktree 删除 |
| 其他 MCP worktree | 多数 clean，但分支历史与重建后的 `main` 不同 | 按交付物等价性审计，不逐支 merge |
| `main` 临时挂载 | `.venv-local-mcp-web`、`data/` 和 frontend data symlink 为 untracked | 仅作临时运行环境；绝不 stage |
| 搜索质量检查 | 主工作目录原生数据路径为 `38/38`；临时 `main` 外部 symlink 被安全边界拒绝后出现 5 项失败 | 属于错误验证挂载，不是产品搜索回归；最终必须在原生数据路径复验 |

本地收敛结果：正式主目录已检出 `main`，10 个旧本地功能分支和 8 个 linked worktree 已移除；`git branch` 与 `git worktree list` 均只剩正式主目录 `main`。`origin/main` 已同步到 `e87027a`；本地 `main` 已在 `62e682d` 形成 MCP refresh 与 Draw.io 空页修复的显式源码 checkpoint。保留的 `origin/codex/windows-electron` 已按用户授权 fast-forward 到当前主线，不删除；本任务不隐式追加推送 `origin/main`。

### 收敛策略

- 不创建新的长期功能分支。
- 继续使用现有临时 `main` worktree 直接形成逻辑清晰的 `main` 提交；主工作目录在此期间只读冻结。
- 稳定 `5173` 只能由正式主工作目录启动；临时 `main` worktree 只做代码整合和无需数据的静态检查，不得占用 `5173` 或创建替代用户库。
- 不执行整分支 merge、整分支 cherry-pick、`git add .`、`reset --hard`、`checkout --`、`clean` 或目录级覆盖。
- 每个提交只使用显式文件清单，先比较 `main`、主工作目录和相关 worktree 三方内容，再做语义整合。
- 历史分支是否可删不以 `git cherry` 为唯一依据。由于 MCP 已在 `main` 重建为新提交，旧分支会显示大量非祖先提交；必须以文件、合同、测试和运行结果等价性为准。

### 阶段与门禁

| 阶段 | 工作 | 完成门禁 | 状态 |
|---|---|---|---|
| C0 冻结现场 | 停止其他 writer；记录全部 branch tip、worktree、dirty 状态和运行进程 | 两处 dirty worktree 都进入清单；无并发写入 | `complete` |
| C1 建立恢复点 | 创建全 refs Git bundle；分别导出两处 dirty worktree 的 binary patch；按显式 allowlist 备份 untracked 代码并生成 SHA-256 清单 | `git bundle verify` 通过；patch 可解析；备份不含 `data/`、用户库、构建产物 | `complete` |
| C2 建立差异台账 | 对 10 个旧分支逐一登记提交、独有文件、在 `main` 的替代实现、未提交内容和处置结论 | 每个分支都有 `absorbed / superseded / abandoned` 证据；`abandoned` 必须用户确认 | `complete` |
| C3 重建到 `main` | 按下列提交批次把有效成果直接集成到临时 `main` worktree | 每批定向测试通过；显式 stage；无数据边界越界 | `complete` |
| C4 迁回主目录 | 清理临时 worktree 中明确的测试挂载；解除临时 `main` worktree 占用；把主项目目录安全切换到 `main` | 主目录 branch=`main`；原生 `data/` 与用户状态未移动、未覆盖；产品文件与集成态一致 | `complete` |
| C5 主目录完整验收 | 在真实本地数据路径运行 quick、pre-commit、MCP 和 5173 验收 | 搜索质量 `38/38`；MCP `102/102`；5173 home / health / workspace 与 runtime smoke 通过 | `complete` |
| C6 删除旧结构 | 移除 clean 附加 worktree；删除已完成处置的本地旧分支；执行 worktree prune | `git worktree list` 只剩主目录；`git branch` 只剩 `main` | `complete` |
| C7 远端同步 | `origin/main` 已完成既定同步；保留的 `origin/codex/windows-electron` 已 fast-forward 到当前主线 | Windows 长期分支保留且不删除；`origin/main` 不因本任务隐式追加 push | `complete` |

### C1 恢复点内容

恢复点必须放在仓库外的持久目录，并包含：

1. `SAPD_Wiki-all-refs-20260724.bundle`：保存当前全部已提交 refs。
2. 主工作目录 `codex/windows-electron` 的 tracked binary patch。
3. `codex/local-mcp-web-integration` dirty worktree 的 tracked binary patch。
4. 两处 worktree 的 untracked 代码 allowlist 压缩包和逐文件 SHA-256。
5. `git branch -vv`、`git worktree list --porcelain`、两处 `git status --porcelain=v1`、所有 branch tip 和远端 refs 清单。

明确排除：

- `data/**`，特别是 `data/user/**`、SQLite、报告历史和备份；
- `.venv*`、`node_modules`、Electron / macOS 构建目录、installer、ZIP、DMG；
- `frontend/capability-browser/public/data/**` 生成包和临时 symlink；
- logs、diagnostics、Runtime 临时文件和测试证书私钥。

### C2 分支处置矩阵

| 分支 | 当前判断 | 计划处置 |
|---|---|---|
| `main` | 已含 4 个本地 MCP 重建 / 集成提交 | 唯一保留分支 |
| `codex/local-mcp-main-integration` | tip `4087b5e` 已是 `main` 祖先 | 验收后直接删除 |
| `codex/local-mcp-core` / `control` / `sidecar` / `app` / `web` | MCP 组件历史分支；提交 ID 与 `main` 不同，但主要交付物已在 `f18b5b7` / `4087b5e` 重建 | 对合同、源码、测试逐项等价审计；不直接 merge |
| `codex/local-mcp-m0t` | MCP T0–T2 早期检查点 | 由最终 MCP 套件、合同和 fixture 台账证明吸收后删除 |
| `codex/local-mcp-product-development` | 旧 Batch A/B 集成链 | 与最终 `main` 的 MCP 和系统设置实现对照，避免把旧 synthetic 状态机带回 |
| `codex/local-mcp-web-integration` | 旧 Web 集成 tip + 一处 dirty 证书 / 信任后续工作 | 已提交历史按等价性处理；dirty 内容独立评审、测试、集成或经用户明确放弃 |
| `codex/windows-electron` | 有唯一 Windows workflow 提交，也是当前大量未提交工作的容器 | Windows / Electron 和共享产品改动全部进入 `main` 后，最后删除 |

### C3 建议的 `main` 提交批次

每批允许根据实际耦合小幅拆分，但禁止合成一个无法审查的大提交。

1. `fix(governance): correct main integration and validation facts`
   - 修正“完整 pre-commit 有 5 个原有搜索失败”的错误结论；
   - 明确临时 symlink 越过 `DATA_PACKAGE_ROOT` 被拒绝是正确安全行为；
   - 记录当前分支 / worktree 真实状态和收敛门禁。
2. `feat(windows): integrate Electron delivery runtime`
   - Windows GitHub workflow、`apps/electron/`、Runtime 准备脚本、Windows 指南；
   - 不提交构建产物、Artifact ZIP、installer、`node_modules` 或真实数据。
3. `feat(frontend): converge shared product workspace changes`
   - Dashboard 统计跳转 / 纯展示规则、Draw.io 下载、`+N` 展开、雷达图、环境关系和共享 Shell / 设置页改动；
   - 以现有 Apple Shell、`DESIGN.md` 和 frontend `AGENTS.md` 为准，不回退已验收页面。
4. `feat(maturity): converge current and target assessment workflow`
   - 当前 / 目标四维评分、说明、统一下级设置、`目标 >= 当前` 全入口规则、旧目标数据兼容和对应审计；
   - 不修改正式用户库、评分基准数据或 ETL。
5. `feat(runtime): converge local directory and export contracts`
   - macOS wrapper、API / CLI、本地 import / export / Runtime 目录契约及相关审计；
   - Web 下载 fallback 与 App 真实路径返回保持分层。
6. `feat(mcp): reconcile certificate and trust continuation`
   - 只纳入 dirty Web integration worktree 中经过评审并达到完成态的证书 / 信任、端口和测试内容；
   - 不把测试私钥、系统信任修改、真实客户端配置或不完整实验带入 `main`。
7. `docs: close workspace convergence records`
   - 同步 `CURRENT_STATE.md`、`progress.md`、`findings.md`、测试矩阵和相关文档；
   - 更新 `.gitignore`，覆盖 `.venv-local-mcp-web`、Electron build 和 `data/user/` 本地用户状态，同时保持数据边界脚本继续拒绝误提交。

### 冲突处理规则

1. `main` 当前 MCP 安全修订优先于旧 MCP 分支，不恢复旧 `synthetic_web`、弱 loopback / Origin 校验或父进程不清理 Sidecar 的实现。
2. 主工作目录中更新的成熟度、Dashboard、环境、App / 导出实现优先于旧分支对应文件，但必须保留 `main` 已完成的 MCP API / 设置入口。
3. `api_server.py`、`cli.py`、`app.js`、`AppShell.js`、`dataClient.js`、`dev_server_guard.py` 和测试编排属于高冲突共享 owner，必须逐段语义合并，不使用整文件 ours / theirs。
4. 数据、用户状态、生成包和打包产物从不参与冲突解决。
5. 发现未完成或无法证明安全的 WIP 时停止删除对应分支；先完成、拆成文档化 backlog，或取得用户明确放弃确认。

### C4 主目录切换方法

1. 在临时 `main` 集成完成后，对照主工作目录生成产品文件差异清单；所有差异必须有处置结论。
2. 停止 5173 / MCP 进程，并确认 `28775` 等测试端口释放。
3. 将主工作目录中会与 `main` tracked 文件冲突的 untracked 代码移动到 C1 恢复目录的 quarantine；不删除 `data/`。
4. 验证并移走临时 `main` worktree 中的已知测试 symlink / 虚拟环境后，正常执行 `git worktree remove`，禁止用 broad `rm -rf`。
5. 主工作目录切换到 `main`；如 Git 报覆盖风险，停止并回到差异台账，不使用 force。
6. 逐项核对 quarantine 内容与 `main`；只恢复尚未吸收且明确应保留的文件。

### C5 验收矩阵

最低门禁：

- `node scripts/run_project_test_suite.mjs --suite quick`
- `node scripts/run_project_test_suite.mjs --suite pre-commit`
- `node scripts/run_project_test_suite.mjs --suite mcp`
- `python3 scripts/audit_search_index_quality_probes.py`：必须 `38/38`
- `python3 scripts/dev_server_guard.py --port 5173 --start`
- `python3 scripts/dev_server_guard.py --port 5173 --status`
- 5173 home / health / workspace projection / MCP stopped → ready → stopped / 端口释放
- `python3 scripts/check_github_data_boundary.py`
- `python3 scripts/audit_json_package_boundary.py`
- `git diff --check` 和最终 staged file allowlist 复核

边界说明：

- 不启动系统 Chrome；前端需要视觉验收时使用应用内浏览器。
- 不构建或验证 DMG，除非收敛差异触及 App release blocker 且用户另行授权。
- 不写真实用户数据库；测试使用临时副本或 synthetic fixture。
- `/private/tmp` main worktree 的外部 data symlink 不作为搜索质量验收环境，也不放宽后端路径安全。
- `dev_server_guard --start` 必须同时校验项目根目录、base DB、user DB 和 data root；发现 5173 来自错误 worktree 时应重启到正式目录。

### C6 删除与回滚

- 先移除 clean worktree，再删除其分支。
- `codex/local-mcp-main-integration` 可在确认祖先关系后用普通安全删除。
- 其余 MCP 分支因重建历史通常不是 `main` 祖先，普通 `git branch -d` 会拒绝。只有在 C1 bundle 已验证、C2 台账全绿、C5 完整验收通过且用户确认执行删除后，才允许对精确分支名使用强制删除。
- `codex/windows-electron` 最后删除；删除前主目录必须已在 `main`，Windows / Electron 文件必须通过定向验收。
- 本地回滚依赖 bundle + 两处 patch + untracked allowlist archive；远端 push 前可完全回到收敛前现场。
- 远端分支删除不是本地收敛的自动步骤，必须单独确认。

### 停止条件

出现以下任一情况立即停止，不继续删除或 push：

- 任一 dirty worktree 没有可验证恢复点；
- `data/`、SQLite、用户库、报告历史或生成包进入 staged 列表；
- 高冲突共享文件仍存在未解释差异；
- 搜索质量未在原生数据路径通过 `38/38`；
- MCP / quick / pre-commit 出现无法归因的新失败；
- 主工作目录无法无 force 切换到 `main`；
- 任一分支仍有无法判定的独有 WIP。

## 当前阶段

当前处于 Phase 5：知识浏览与搜索 / 关系化前端工作台校正。

### PLAN-ENV-MD：信息化环境主数据与对象字典（2026-07-25）

- 状态：`p8_web_completed_app_dmg_uat_pending`
- 目标：建立信息化环境、环境子类、信息化对象三类唯一主数据；保留现有29个环境—子类上下文和67个环境—子类—对象上下文，由关系引用主数据身份。
- 核心决定：10个环境和51个信息化对象复用现有稳定身份；16个环境子类标题组已逐条裁定为16条独立 `environment_segment_type`，跨环境同名类型复用同一身份。原29个 `environment_segment` 保持上下文实例身份，并规划各增加且仅增加一条 `instance_of`。
- 导入门禁：必须同步修复 `environment_segment` 的 qualifier/stable-key 匹配；同源二次导入新增0、重复关系0、上下文错配0。
- 页面边界：环境映射继续使用树；知识库字典显示唯一主数据，29/67只作为关系数量和展开明细；首期只读，不在前端实现新增、合并或改号。
- 切换/回退：采用加法迁移、影子包、显式能力开关和分层回退；恢复包覆盖基础库、用户库只读证明、环境拆分投影、node-details、analytics、编号/关系清单和哈希。
- 安全门禁：正式基础库、正式JSON、源Excel和用户库在单独 apply 授权前不修改；P3必须先完成临时库完整回退演练。
- P0结果：主数据合同、字典响应schema、裁定清单schema、最小夹具和定向审计已冻结并通过；没有分配真实编号，没有裁定16个候选，也没有修改运行代码或正式数据。
- P1结果：只读盘点确认10/29/候选16/51/67与环境包完全一致，29+67条上下文关系均有来源证据，孤儿/错配/未解析用户引用均为0；14次用户域引用可解析，输入哈希前后不变。77条P2裁定输入仍全部为 `hold`，未分配编号、未写正式库/用户库/正式包。
- P2结果：冻结10条 `IE-*`、16条 `ES-*`、51条 `IO-*` 共77条编号及29条精确 `instance_of` 计划；修复 segment qualifier 匹配、父环境切换和 `instance_of` 来源唯一性。临时副本第二次同源导入新增/停用对象0、新增/删除关系0、错配0，保护输入哈希不变；重复审批的来源引用/审计日志增长继续由 `OI-198` 跟踪。
- P3结果：临时库首次应用回填61个编号、新增16个环境子类类型、29条 `instance_of`、58条来源引用和106条审计，重复应用全部为0；候选包开关回退、精确逆向回退与事务故障注入回退均恢复演练前逻辑快照，保护输入哈希不变。报告为 `data/exports/worker-verify/plan-env-md/p3-20260725T162703Z/`。
- P4—P8 Web 结果：影子字典、只读 API/schema、前端开关、正式加法迁移、受控切换和 Web 发布回归均已完成；当前主数据为10环境、16子类类型、51对象，定义77条，关联使用125条。当前源码 App/DMG 仍待新包发布矩阵与人工 UAT，5173 Web 结论不替代 App 证据。
- 详细计划：`docs/06-implementation/environment-master-data-dictionary-plan-2026-07-25.md`

本阶段不是新增 Sheet，也不是进入 Phase 7 多格式增强，而是把已导入数据的业务语义、页面范围、关系链路和前端展示方式校正清楚。

当前验收任务：`OI-196` 已于 2026-07-16 按用户确认关闭。P1-2、P1-4、P1-5 的 Issue 范围唯一入口、全局 Apple Shell segmented、能力摘要图边界、能力清单滚动、标准默认收起、单内容页无伪 Tab 与 Web / App 下载目的地契约均已固化；DMG App 证据仍按发布矩阵后置。不得把本轮扩展为图谱算法、Draw.io 内容、正式数据或 DMG 重打。

2026-07-16 P2-1—P2-3 用户复验修订已完成 Web shared runtime 收口：总览新增环境 / 对象 / 作用域、双生命周期与指南内容类型的轻量统计；全部可折叠字典和标准框架默认收起；能力目录 Grid 空白已修复；成熟度指南使用 `244px` 目录和 `1120px / 17px` 阅读列，并在 v1.3 将“评估工具使用”同步到 V2.1 真实工程流程。P2-4 继续作为后续 DMG App 发布矩阵回归，不扩大为正式数据、评分、图谱或打包改造。

2026-07-16 用户确认关闭：P2-1、P2-3 已关闭；P2-2 已完成并沿用同一轮用户复验结论。P2-4 仍是后续 DMG App 发布矩阵与全工程发布收口任务，不属于本轮已关闭范围。

2026-07-16 PLAN-MAT-WS 第二十三轮已完成 Web shared runtime 收口：结果行动区按“成熟度热力表 → 总体优先级 → 维度优先级”排列并整区折叠；评分目录位置、DIRECT FOCUS、固定评分上下文和四类检查分组已完成真实浏览器验收；不适用与无证据为信息口径，不阻塞完成评估。后续只在下一次 DMG 发布矩阵补 App 证据，不扩大为评分算法、正式数据、ETL 或打包改造。

2026-07-16 PLAN-MAT-WS 第二十五轮已完成 Web shared runtime 复验修订：第二十四轮完成门禁、模板管理和报告导出契约保持；评分上下文取消 sticky，稳定评分表单中只有四维打分列滚动，概览与保存区不动；结果宽桌面左列按“全能力分组雷达 → 紧接四维雷达”，右列分层统计；结果首排只保留目标成熟度，二级页签改为“客户评估结果 / 评分明细清单”。专项审计 `207/207`、应用内 Browser、5173 stable、语法、数据边界与 diff-check 通过；完整套件剩余失败来自其他活动会话的 Issue v6、技术服务可见行和 `app.js` 治理预算，未越权修改。正式库、正式数据包和 DMG 未修改；用户固定入口复验与 DMG App 发布矩阵证据后置。

2026-07-16 PLAN-MAT-WS 第二十六轮已完成 Web shared runtime 复验修订：以最新 8 张截图覆盖第二十五轮局部滚动历史契约，完整评分表单单滚动、打分列无内部滚动、概览 sticky；摘要标题 / 数字号、结果等级名称、双雷达真实比例、项目概览 `2:1`、首页宽屏左右分栏和默认模板 canonical 名称已固化。专项审计 `213/213`，应用内 Browser `1280×720 / 2048×1152` Design QA 通过；用户在固定入口复验后再关闭 `OI-192`，DMG App 仍在下一次发布矩阵补证据。

2026-07-17 PLAN-MAT-WS 第二十七轮已完成 Web shared runtime 复验修订：用户最新裁定覆盖第二十六轮“评分表单唯一滚动”历史契约，项目页外层成为唯一纵向 owner，窄屏摘要按组换行且等级 / 分数同为 `28px`；概览按内容收拢，结果摘要改为“能力类别评分”并把 T / G / M 与分数紧邻，报告明确完整结果 + 人工文字以及 Markdown / HTML 两个独立出口。专项审计 `214/214`，应用内 Browser `2048×1152 / 786×1458` Design QA 和同画布对照通过；用户固定入口复验后再关闭 `OI-192`，DMG App 仍在下一次发布矩阵补证据。

## Frontend Baseline 1.0

Frontend Baseline 1.0 当前关系工作台实现重点仍覆盖三页：

1. `安全能力映射`
   - 主视角：安全能力 / 安全关注点。
   - 技术视角：安全关注点 -> 作用域 -> 安全技术服务 -> 安全技术模块 / 安全技术措施。
   - 管理视角：安全关注点 -> 管理工作 -> 安全流程（L2 流程组 / L3 流程 / L4 活动）或安全职能（4 层）。
2. `LC-AP开发安全生命周期`
   - 主视角：LC-AP 开发安全生命周期阶段。
   - 核心关系：阶段、主要活动、安全活动、安全策略要求、开发技术服务、安全技术服务、安全技术模块、安全技术措施、开发类产品组件、来源证据。
3. `信息化环境维度`
   - 主视角：信息化环境 / 环境子类 / 信息化对象。
   - 核心关系：环境、环境子类、对象、作用域、安全技术服务、安全技术模块、安全系统、产品、来源证据。
   - 该页是第一批核心数据的第三个业务视角，不是新 Sheet 扩展。

全站菜单和数据契约规划另纳入 `SAPD 成熟度评估` 独立模块，承载评分填报、结果生成和评估报告入口；该模块后续另开实现会话，不并入三份 workbench JSON。

详细说明见：`docs/04-user-guide/frontend-baseline-1.0-plan.md`

## 当前下一步

前后端分离本轮已阶段性收口，收口说明见 `docs/01-architecture/frontend-backend-separation-closure.md`。

2026-06-06 已新增总 backlog 收敛入口：`docs/07-governance/backlog-convergence-2026-06-06.md`。后续恢复未开展任务时，先用该文件区分 `Gate 0`、`P0`、可并行只读评估、后续开发和后置任务，避免用某一条前端或交付线覆盖整个项目计划。

2026-07-06 已新增文档与 Issue 控增量规则：当前默认不为小修、小 bug、一次性排查或临时方案新增文档；低严重性问题直接修复并在 `progress.md` 和任务完成反馈记录。只有全局契约、数据 / 审计 / 安全边界、中高严重性、无法本轮闭环或需要用户判断 / 验收的问题才进入 `open-issues.md`。后续继续功能线前，应先按该规则检查是否真的需要新文档或新 `OI`。

2026-07-06 追加设计文档治理规则：设计材料分为信息架构 / brief、全局设计基线、页面实现规格、Stitch / Product Design 参考材料、专题设计契约和交付体验设计。后续页面实现只以 `frontend/design-handoff/implementation-specs/` 中 active / implementation-source 规格为直接依据；Stitch 输入 / 输出、截图、prompt 和旧 brief 必须先转成 implementation spec 或补进现有 spec，不能直接驱动代码。

后续继续推进时，建议按“前端页面设计线”和“后端数据 / 逻辑线”分开管理，并按页面逐个闭环：

1. 先确认对应页面的后端投影契约是否稳定。
2. 再进入前端页面设计和组件实现。
3. 每页完成后执行浏览器切换回归、字段边界检查和静态 / API fallback 检查。
4. 若发现数据缺口，记录为数据契约或待确认问题，不在前端临时硬编码业务关系。

本轮已完成首个前后端分离落点：安全能力映射页新增 `/api/v1/capabilities/workspace-projection`，用于承载技术视角和管理视角的关系投影；静态模式下保留 ViewModel fallback。

2026-06-06 用户调整优先级：`analytics_summary` 是 P0，但不独占当前最高优先级；Delivery Bundle / 打包任务先往后排。当前已完成 `analytics_summary` dashboard 消费、`OI-135 + DB-11 + DB-2` 正式迁移脚本三段式，以及 `OI-128 / OI-135` 工作台总览和数据篮最小 API；2026-07-06 已按用户确认方向生成基础库 clean candidate，验证 `security_work` 主对象唯一且 `maps_to_work` 关系保留；用户库 legacy `target_ref` 迁移 dry-run 已通过，随后已正式 apply 到 `data/database/sapd_wiki.sqlite3` 和 `data/user/sapd_wiki_user.sqlite3`，正式库组合 `legacyBaseRefs=0`。运行时和打包用户库创建入口已统一到 `user_schema_0.3`，正式用户库 `user_meta.schema_version=user_schema_0.3`；`OI-135` 已关闭归档。备份和回退报告见 `data/exports/worker-verify/oi-135-formal-apply/20260706T063552Z/oi135-formal-apply-report.md`。

## 当前 P0 主线队列

| 优先级组 | 工作包 | 当前状态 | 推荐下一步 | 改动边界 |
|---|---|---|---|---|
| P0-A | 用户库长期治理 | `OI-135` / `DB-11` 已关闭 / 自动验证通过 | 已有默认 dry-run、临时库 apply、自动备份和项目库写入确认门；工作台、数据篮、导出配置、导出预览、导出执行和下载 API 已完成 token 防护与临时 ZIP runtime smoke；2026-07-06 基础库 clean candidate 已将 `security_work` 主对象收敛为 `80` 个唯一标题并保留 `92` 条 `maps_to_work` 关系，且已正式替换基础库；用户库 target_ref 迁移已将 2 条旧 UUID 引用迁到 stable ref，`pending=0`、`legacyBaseRefs=0`；运行时和打包用户库创建入口已统一到 `user_schema_0.3`，正式用户库 `user_meta.schema_version=user_schema_0.3`；用户已确认第一批导出以原始业务数据口径为主，优先 Excel / CSV / Markdown，幻灯片导出 PDF；`capability_full_mapping`、`environment_technology_mapping`、`reference_dictionary_and_standards` 三个业务数据集的 CSV / Excel sheet 字段草案已固化，后续进入导出器实现 | 后端最小 API 先行，不直接改前端按钮；当前导出文件为受控 JSON 验证闭环，不是最终多格式契约 |
| P0-A | `stable_key` / 基础库升级兼容 | `DB-2` 真实库 apply 已完成 / 自动验证通过 | 已对正式基础库补齐 `stable_key` / `stable_ref` / `public_id` 和 `base_id_redirects`；2026-07-06 clean candidate 已正式替换基础库，基础库侧重复主对象已收敛；用户库 target_ref 迁移后 stable key 审计 `legacyBaseRefs=0` | 支撑批注、收藏、Delivery 和后续基础库升级 |
| P0-B | `analytics_summary` 落地 | exporter / audit / `data_package_summary` / `dataClient` / dashboard 消费已完成 / 已提交 | 后续只按视觉或业务反馈小修 | 已按数据契约消费，不在前端重新拼跨包指标 |
| P0-C | 深层路由稳定性 | `OI-136 / FE-ROUTE` 已修复 / 待 checkpoint | 已通过根 `base href` 修复 `/guides/*`、`/knowledge/*`、`/standards/*` 直接访问资源相对路径问题；轻量 smoke 已覆盖三类深链根资源加载 | 单线写入，不和 dashboard 或批注混写 |
| P0-D | ArchiMate 建模语言页优化 | `OI-133` 已修复 / 待人工验收 | 已按用户最新纠偏修正：恢复两层标题，最大标题为 `安全架构建模语言`，第二标题为 `ArchiMate® 3.2 - 企业架构建模标准`；tab 跟在最大标题后面，工具按钮跟在第二标题后面；主体只保留可滚动整张 Poster 且图片贴合容器；点击图片或 `全页面显示` 时打开页面内 Image Lightbox / Fullscreen Modal，不使用新窗口或 `Blob` 页面；预览工具栏无下载按钮，支持滚轮缩放和拖动平移，高分整图为 `6741 x 4768` | 不改数据库、不改数据包、不改 `SAPD 元素图例` registry |
| P0-E | 信息化环境首页底图导入 | `OI-137` 已修复 / 待人工验收 | 已从 draw.io 第三页 `信息化环境及对象底图` 生成语义 HTML 底图：vertex 按 `mxGeometry` 转为绝对定位 HTML 节点，edge 转为 SVG overlay 连线，并输出 `environmentBasemap.semantic.json`；`/environment-mapping` 第一个 tab 为 `环境底图`，提供适应、缩放、拖拽平移、全屏和节点点击高亮 | 不使用 `SAPD 元素图例` 样例文字，不按截图 / 业务语义重排，不做 CSS grid / flex 自动布局；本机无 `drawio` / `diagrams.net` CLI，复杂私有图标和 edgeStyle 路由为直接解析近似 |
| P1 | Delivery Bundle 1.0-alpha | macOS alpha 已准备，Windows 未实测 | 打包任务后排；待 user DB / stable_key 前置设计稳定后，再决定是否恢复 Windows UAT 或正式打包 | 不和前端 UI 混写 |

## 新增规划队列（2026-07-08）

本队列记录后续项目计划和当前可进入主线的前置数据源。`PLAN-MAT-WS` 受控 demo 已升级到 V2.1 并完成第二十五轮专项回归与应用内 Browser 验收，当前待用户按固定入口复验，正式持久化和 DMG App 验收后置；未写正式 SQLite、正式 JSON、源 Excel、用户库或 DMG。`PLAN-ORG-ROLE` 仍只进入计划池；`PLAN-STD-NICE` 保留数据源接入前置状态。

| 编号 | 工作包 | 当前状态 | 目标产出 | 关键边界 |
|---|---|---|---|---|
| PLAN-MAT-WS | 工作台 `SAPD 成熟度评估` 模块 | V2.1 第二十五轮 Web 已完成 / 待用户复验 / 正式持久化与 DMG 后置 | 首页项目进展与模板管理双区域；评分表单只有四维打分滚动；默认 / 自定义模板导入导出；左列全能力雷达后紧接四维雷达；目标唯一摘要；汇报型 HTML / Markdown 报告快照 | 同粒度数据只有一个展示所有者；完成门禁只检查适用项完整度和后端目标下限；不适用与无证据不阻塞；模板导入不覆盖默认模板；不写正式库、正式包或主知识库关系；DMG App 证据后置 |
| PLAN-STD-NICE | `标准 / 框架` 接入 NICE | 当前主线 / 数据源接入前置 / 待确认权威源与版本 | 先把 NICE 作为可审计的数据源接入标准 / 框架或岗位能力参考体系，支持后续目录、明细、检索和映射；该项是 `PLAN-ORG-ROLE` 的前置 | 先确认 NICE 的权威来源、版本、对象粒度和字段；先用受控 demo 数据和审计验证，不直接改写已保护的标准包；若属于 workforce / role 框架，需明确它与岗位设计模块、GB/T 42446、Gartner 参考的关系 |
| PLAN-ORG-ROLE | 工作台 `组织岗位设计` 模块 | 已进入项目计划 / 非当前主线 / 暂不打包 | 在工作台内支撑组织职责、岗位 / 角色、工作任务、能力 / 关注点关联和岗位设计输出 | 以现有安全职能、流程、GB/T 42446、Gartner 和 NICE 数据源作为参考；`PLAN-STD-NICE` 未完成前不启动本模块；参考源不等同于最终内部职责事实；客户组织和岗位方案属于用户运行数据，不进入公开基准包；本轮不进入打包范围 |
| PLAN-AI-CAP-EXT | AI / 人工智能安全能力体系扩展 | 回到 demo-first / 数据接入未启动 / 暂不打包 | 先在当前 `main` 形成 AI 能力或关注点的 demo 页 / demo 数据和关系样例，验证业务口径、页面路径和检索需求 | 正式接入前必须另行确认权威源、对象粒度、字段、写入范围、回退方案、审计清单和用户批准；本轮不修改源 Excel、SQLite、正式 JSON 或 DMG |

## analytics_summary P0 落地计划

设计入口：

- `docs/06-implementation/dashboard-and-module-data-display-optimization-design.md`
- `docs/06-implementation/analytics-summary-json-contract-draft.md`

实施原则：

- 先生成后端 / 离线数据契约，再接入 `dataClient`，最后改 dashboard 展示。
- Dashboard 第一屏围绕 `capability_focus`、能力覆盖、多维支撑、场景可达和标准支撑，不展示数据治理 / 导入健康 / 工程状态。
- 标准控制项必须区分三类 grain：能力映射可达控制项、标准索引控制项、SQLite 全库 reconciliation；不得混成一个“标准控制项总数”。
- 普通用户主展示区不得出现 `sheet`、`row`、`column`、`raw_value`、`source_file`、`import_id`、`source_id`、`source_ref`、`source_label`、`debug`、`raw`、`metadata`、`intermediate`、`generated_at`。

| 顺序 | 编号 | 任务 | 状态 | 改动范围 | 验收重点 |
|---|---|---|---|---|---|
| 1 | AN-SUM-EXPORT | exporter 生成 `analytics-summary.json` | 已完成 / 已提交 | 新增 `scripts/export_analytics_summary.mjs`；输出 `frontend/capability-browser/public/data/analytics-summary.json`，该生成包不纳入 Git | 顶层包含 `meta`、`businessSummary`、`coverageSummary`、`moduleSummary`、`navigationSummary`、`relationshipSummary`、`evidenceSummary`、`adminSummary`、`reconciliationSummary`、`compatibility`；覆盖率有分子、分母、relation type、source package |
| 2 | AN-SUM-PKG | `data_package_summary.py` 增加摘要检查 | 已完成 / 已提交 | `scripts/data_package_summary.py`、`scripts/README.md` | `--package analytics-summary` 能显示 `dataState`、主 grain、关键计数、覆盖维度、标准控制项三类 grain，不打印完整 JSON |
| 3 | AN-SUM-CLIENT | `dataClient.getAnalyticsSummary()` | 已完成 / 已提交 | `frontend/capability-browser/dataClient.js`；`audit_analytics_summary_contract.mjs` 增加客户端契约检查 | 统一处理 API `/api/v1/data-packages/analytics-summary` 与离线包 fallback；页面组件不直接读取 raw workbench JSON 重新计算 P0 指标 |
| 4 | AN-SUM-DASHBOARD | dashboard 消费 `analytics_summary` | 已完成 / 已提交 | `frontend/capability-browser/app.js`；`audit_analytics_summary_contract.mjs` 增加 dashboard 消费契约检查 | 首页从数据包健康统计转为能力知识地图入口；管理员 / reconciliation 信息只进折叠维护区；不做营销页、卡片墙或装饰 dashboard |
| 5 | AN-SUM-AUDIT | audit 脚本验证覆盖率、标准控制项 grain 和禁止字段泄露 | 已完成 / 已提交 | 新增 `scripts/audit_analytics_summary_contract.mjs` | 验证覆盖率分母固定为 `capability_focus`、标准控制项三类 grain 不混用、主展示字段不泄露禁止字段 |

推荐实施顺序：

1. 先做 `AN-SUM-EXPORT`，把 Data Analytics 方案变成稳定离线数据包。
2. 同步做 `AN-SUM-AUDIT` 的最小契约审计，先让错误可被脚本抓住。
3. 做 `AN-SUM-PKG`，把 `data_package_summary.py` 变成轻量验收入口。
4. 做 `AN-SUM-CLIENT`，只加读取契约，不改页面视觉。
5. 最后做 `AN-SUM-DASHBOARD`，用已经稳定的数据包替换当前首页工程统计。

不建议同时做：

- 不同时做 dashboard 视觉重构和 exporter 口径调整。
- 不让 dashboard 组件直接从 `capability-workbench`、`environment-workbench`、`lifecycle-workbench` 拼统计。
- 不把 `OI-136 / FE-ROUTE`、批注 UI 微调、导航重构和 `analytics_summary` 落地混在一个提交里。

## 未来项目计划：前端页面设计线

| 编号 | 任务 | 当前状态 | 目标产出 | 依赖 |
|---|---|---|---|---|
| FE-0 | 安全能力映射页关系画布收敛 | 已完成（F3-GRAPH-P2） | 已恢复预览页式结构，以 `本地关联摘要 / 技术视角 / 管理视角 / 标准框架` 四个同级 Tabs 承载工作台；右侧栏已删除；技术 / 管理 Tab 已恢复原 `FocusScopeServiceMatrix` / `FocusManagementMapping` 矩阵组件；已诊断并修复管理职能层级展示投影丢失问题；默认本地关联摘要已升级为原生 SVG 网络图，并进一步收敛为以当前能力-关注点为唯一中心锚点的径向星形关系图：`技术视角`、`管理视角`、`标准 / 框架映射` 三个一级分支星形分散，管理视角下按 `安全职能 / 安全工作 / 流程` 展开，安全职能展示四类层级，流程按 L2/L3/L4 真实数据展开 | 已有能力页投影、用户确认的预览图、`security-capability-workbench-visual-spec-v1.md` |
| FE-IA | 全站菜单与页面类型定义 | 已完成 | 固化全站菜单、页面类型、导航 Manifest、Stitch 交接说明、全局导航 Stitch Prompt、设计输出目录和 implementation specs 目录 | `docs/00-overview/frontend-menu-and-page-type-definition-v1.md`, `frontend/design-handoff/README.md` |
| FE-AS | Application Shell 集成实现 | 已完成 | 已接入 Manifest 导航、顶部栏、页面标题区、面包屑、通用 WorkbenchLayout / RightInsightPanel 骨架，并保持现有页面可用 | `frontend/design-handoff/implementation-specs/application-shell-implementation-spec-v1.md`, `frontend/design-handoff/navigation/nav-manifest.v1.json` |
| FE-AS-V | Application Shell 视觉对齐 | 已完成 | 已按 Stitch 输出对齐蓝灰低阴影工作台风格，移除重复品牌，降低顶部状态区和安全能力映射页视觉噪声，并生成 1440px / 1920px 截图 | F2-P1.5 应用壳集成、`application-shell-v1.png` |
| FE-CAP-SPEC | 安全能力映射工作台视觉实现规格 | 已完成 | 已新增视觉实现规格，明确拒绝验收原因、三视角关系图、右侧关联洞察区和响应式验收标准 | `frontend/design-handoff/implementation-specs/security-capability-workbench-visual-spec-v1.md` |
| FE-CAP-W | 安全能力映射工作台专项实现 | 已完成（F3-GRAPH-P2） | F3-P1R 与 F3-IMPL-P1 均已被用户拒绝；R2 恢复预览页结构，R3/R4 完成矩阵语义校正与 Tab IA，R5 删除右侧栏；RECOVERY 恢复原技术 / 管理矩阵组件到对应 Tabs；F3-DIAG 修复四类职能层级投影；P2/P3/P4 将默认摘要收敛为同源图式总览；GRAPH-P1-V2 新增原生 SVG `LocalRelationNetworkGraph` 和 `relationGraphModel`；GRAPH-P2 将其改为径向星形网络图，确保能力-关注点为唯一中心锚点、三视角星形分散、无数据业务节点不显示，技术 / 管理 Tabs 继续保留表格式明细 | `CapabilityLocalRelationMap.js`, `LocalRelationNetworkGraph.js`, `relationGraphModel.js`, `FocusScopeServiceMatrix.js`, `FocusManagementMapping.js`, `viewModels.js`, `app.js` |
| FE-ROUTE | 深层路由直接访问与刷新稳定性治理 | 已修复 / 待 checkpoint（`OI-136`） | 已在 `index.html` 固化根 `base href="/"`，并扩展 `frontend_smoke_check.mjs` 的深层路由轻量资源断言，覆盖 `/guides/*`、`/knowledge/*`、`/standards/*` 直接访问样式和主脚本加载 | `frontend-global-design-baseline-2026-05-30.md`, `index.html`, `scripts/frontend_smoke_check.mjs` |
| FE-ML | ArchiMate 建模语言页显示与加载优化 | 已修复 / 待人工验收（`OI-133`） | 已按用户最新纠偏调整为整图优先：恢复两层标题，最大标题为 `安全架构建模语言`，第二标题为 `ArchiMate® 3.2 - 企业架构建模标准`；tab 跟在最大标题后面，工具按钮跟在第二标题后面；整张 Poster 可纵向滚动且贴合容器；全页面显示改为页面内 Image Lightbox / Fullscreen Modal，工具栏无下载按钮，支持滚轮缩放和拖动平移 | `docs/06-implementation/archimate-modeling-page-optimization-plan.md`, `frontend/capability-browser/app.js`, `frontend/capability-browser/styles.css`, `frontend/capability-browser/index.html`, `frontend/capability-browser/components/AppShell.js` |
| FE-DASHBOARD-AS | Dashboard 消费 `analytics_summary` | P0 待启动 | 首页从工程数据包统计切换为“安全能力知识地图”入口，只消费 `dataClient.getAnalyticsSummary()`，不在组件内重新计算跨包覆盖率、标准控制项 grain 或关系推断 | `docs/06-implementation/dashboard-and-module-data-display-optimization-design.md`, `docs/06-implementation/analytics-summary-json-contract-draft.md`, `dataClient.js`, `app.js` |
| FE-1 | 关系画布设计基线固化 | 待启动 | 抽象 `LocalRelationCanvas` / `RelationNode` / `RelationLane` / `FoldedDetail` 等可复用模式，不急于跨页抽组件文件 | FE-0 验收结果、FE-IA |
| FE-2 | 安全能力映射页前端验收清单 | 待启动 | 固化能力页验收项：左侧关注点、技术视角、管理视角、矩阵折叠、来源折叠、字段边界、无控制台错误 | FE-0 |
| FE-3 | 信息化环境维度页设计 | 第一版实现已完成 | 已新增信息化环境安全能力映射图谱策略，并接入环境页本地关系图谱：`E0` 信息化环境只展示结构、`E1` 环境子类展示对象 / 作用域 / 服务 / 能力概览、`E2` 信息化对象完整展示作用域、服务、模块 / 措施、系统、产品和能力 / 关注点；保留原环境映射表作为核对入口 | `frontend/design-handoff/implementation-specs/environment-security-capability-graph-strategy-2026-05-20.md`, `environmentRelationGraphModel.js`, `EnvironmentLocalRelationMap.js`, BE-2 |
| FE-4 | LC-AP 开发安全生命周期页设计 | 待启动 | 形成生命周期页局部关系画布：阶段 -> 活动 -> 策略 -> 服务 -> 模块 / 措施 / 组件 | BE-3 |
| FE-M | 工作台 SAPD 成熟度评估页面设计 | 第二十二轮 Web 已完成 / App 待验 | 目标冲突提示进入顶部反馈槽；L0 / L1 / L2 目标等级使用紧凑金棕强调；L2 摘要顺序与“维度均值 / 评估点情况”同构完成 | `maturity-assessment-v2-1-complete-frontend-design-2026-07-12.md`；只读后端同粒度结果与目标下限，前端不重算冲突数、适用性或进度；DMG App 证据后置 |
| FE-STD-NICE | 标准 / 框架 NICE 页面接入 | 后置 / 等 `BE-STD-NICE` 数据源接入后再启动 | 在标准 / 框架体系中承载 NICE 目录、明细、检索和后续映射视图 | 当前只做数据源接入前置；先确认 NICE 权威源、版本和对象粒度；不得把 workforce 参考误当成普通控制项 |
| FE-ORG-ROLE | 工作台组织岗位设计页面 | 后置 / 非当前主线 / 暂不打包 | 形成组织职责、岗位 / 角色、工作任务、能力 / 关注点关联和方案输出工作台 | 以安全职能、流程、GB/T 42446、Gartner、NICE 等为参考；依赖 `BE-STD-NICE`；不把参考源直接当成客户组织事实；本轮不启动页面实现 |
| FE-5 | 三页共同组件和交互一致性整理 | 后置 | 统一导航、对象头、关系画布、折叠明细、来源证据、空状态和标签风格 | FE-2 / FE-3 / FE-4 |
| FE-6 | 专项知识维护页面稳定化 | 第二轮结构调整已完成 | 已按安全知识目录链路完成收口：外层二级入口为作用域、技术模块/措施、管理工作/流程、职能、Hype Cycle、其他知识目录；模块/措施、管理工作/流程、职能/岗位参考改为内部 Tab；维护表格密度与列宽统一；后续继续梳理详情面板和缺口字段 | 后端专项接口稳定 |
| FE-ANN | 全局批注与工作台锚点契约 | 基本验收通过 / checkpoint 已完成（OI-128C 设计已固化为全局基线，真实回归 33/33 通过） | 右侧浮层批注抽屉已替代横向收藏条；批注模块按 overlay 层治理，基础页面只暴露稳定锚点，批注层统一处理右键、抽屉、保存、状态、tooltip、常驻提示和定位高亮；全局值级锚点覆盖能力映射、环境映射、知识库字典、标准 / 框架、指南和 LC-AP / LC-DT；普通 `td` 单元格具备值级兜底，知识库对象行挂载稳定 `data-annotation-target-ref`，折叠目录定位可自动展开父级并恢复常驻标记。普通态视觉已从背景铺底收口为贴文字的琥珀下划线，行级普通态只保留左侧标识，关系 chip 保留语义底色并叠加低噪声下划线 / 边框；定位态保留更明显的黄色 + Apple blue 聚焦，指南 slide / thumb 定位态额外补齐琥珀下沿，避免 active 蓝底覆盖批注 ink。2026-06-06 已完成 `OI-128C` checkpoint：`b93a9f1 Finalize OI-128C annotation baseline`。当前设计已写入全局基线和新页面接入清单，后续新增页面必须先接入页面对象、值锚点、行锚点、幻灯片 / 子页上下文并跑契约审计，不再逐页重新调试。后续批注只按 bug fix 处理；当前进入 P0 主线队列，不再把批注作为新功能主线 | `docs/06-implementation/global-annotation-requirements-and-regression-matrix.md`, `docs/06-implementation/workspace-annotation-and-capability-remix-design.md`, `scripts/audit_user_annotation_contract.mjs`, `scripts/audit_saved_user_annotations.mjs` |

前端页面设计线的边界：

- 前端负责布局、交互、折叠、筛选、表格、节点视觉和验收体验。
- 前端不得生成业务事实，不得从原始 JSON 推断关系，不得绕过 `dataClient` 或 `/api/v1/*`。
- 页面设计不追求一次性 Impeccable polish，先把业务关系表达清楚，再做视觉细节。

## 未来项目计划：后端数据 / 逻辑线

| 编号 | 任务 | 当前状态 | 目标产出 | 依赖 |
|---|---|---|---|---|
| BE-0 | API / 离线数据包契约盘点 | 已完成 | 已形成三页所需字段、关系、状态、来源证据契约清单，确认哪些来自 API，哪些来自 fallback JSON | `docs/01-architecture/api-offline-package-contract-inventory.md` |
| BE-1 | 安全能力映射页投影补强 | 已完成 | 已输出 `scopeServicePairs`、`serviceModuleMeasureLinks`、`workFunctionsByLayer`、`processTree`，后续前端可直接消费 `localRelationMap` | 现有 `/api/v1/capabilities/workspace-projection` |
| BE-DG | Frontend Baseline 1.0 前端数据契约治理 | 已完成 | 三份 workbench 规格已齐；三个 P0 workbench JSON 已能生成；`dataClient` / ViewModel 已提供稳定读取入口；契约验收通过 | `docs/04-user-guide/frontend-data-contract-baseline-1.0.md`, `frontend/capability-browser/public/data/*-workbench.json` |
| BE-DPS-1 | Data Package Split 1.0 专项维护包拆分 | 已完成 | 新增 `maintenance-knowledge.json`，专项知识维护页和 `dataClient` 优先读取该包；`management-knowledge.json` 已退役，不再作为前端 fallback 或 API 数据包 | `frontend/capability-browser/public/data/maintenance-knowledge.json`, `dataClient.js`, `viewModels.js` |
| BE-2 | 信息化环境维度页投影 | 已完成（数据包投影） | 已输出 `environment-workbench.json`，承载环境 / 对象 / 作用域 / 服务 / 模块 / 系统 / 产品 / 能力关联 | `frontend/capability-browser/public/data/environment-workbench.json` |
| BE-3 | LC-AP 生命周期页投影 | 已完成（数据包投影） | 已输出 `lifecycle-workbench.json`，承载阶段 / 活动 / 控制点 / 策略要求 / 服务 / 模块 / 能力关联 | `frontend/capability-browser/public/data/lifecycle-workbench.json` |
| BE-4 | 数据质量与缺口清单 | 已完成（首轮静态审计，BE-4.2 已修复；`OI-040` 已修复） | 已新增三份 workbench 数据质量与缺口清单，确认三包顶层结构、关系端点和字段边界正常；`OI-040`、`OI-049`、`OI-050` 已修复，当前继续跟踪源数据一致性待确认问题 `OI-073` | `docs/06-implementation/be-4-workbench-data-quality-gap-list.md`, `docs/06-implementation/open-issues.md` |
| BE-AN-SUM-1 | `analytics_summary` 离线数据包生成 | 已完成 / 已提交 | 新增 exporter 生成 `frontend/capability-browser/public/data/analytics-summary.json`，聚合 `capability-workbench`、`environment-workbench`、`lifecycle-workbench`、`standards-index`、`content-views`，以 `capability_focus` 为主 grain，输出覆盖率、模块入口、关系摘要、证据摘要和 reconciliation；生成包不提交到 Git | `docs/06-implementation/analytics-summary-json-contract-draft.md`, `docs/06-implementation/dashboard-and-module-data-display-optimization-design.md` |
| BE-AN-SUM-2 | `analytics_summary` 数据包摘要与审计 | 已完成 / 已提交 | 扩展 `scripts/data_package_summary.py` 支持 `analytics-summary` 摘要；新增 `scripts/audit_analytics_summary_contract.mjs`，验证覆盖率、标准控制项三类 grain 和禁止字段泄露 | `BE-AN-SUM-1` |
| BE-M | 工作台 SAPD 成熟度评估数据契约 | 受控 demo V2.1 已完成 / 只读稳定字典 + 无正式持久化 / DMG 待验 | 已实现无项目作用域、`ASSESSMENT_POINT` / `PLATFORM_EVIDENCE_REFERENCE` 服务角色、四维评分、当前 / 目标同集合聚合、达成率、文件交换、L2 结果、差距建议和报告快照契约 | `docs/08-maturity/` 与 V2.1 业务设计；不新增或写入正式 `maturity_*` 表；正式持久化另行确认 |
| BE-STD-NICE | NICE 标准 / 框架数据源接入 | 当前主线 / 数据源接入前置 | 确认 NICE 权威源、版本、对象粒度、字段、导入方式和与能力 / 岗位 / 标准映射的关系；先形成可审计 demo 数据源 | `PLAN-STD-NICE`；作为 `PLAN-ORG-ROLE` 前置；先 demo 数据和审计，不直接覆盖受保护标准包 |
| BE-ORG-ROLE | 组织岗位设计数据契约 | 后置 / 非当前主线 / 暂不打包 | 定义组织单元、岗位 / 角色、职责、工作任务、能力 / 关注点关联、参考源和方案导出契约 | 客户组织方案属于用户运行数据；GB/T、Gartner、NICE 等只作为参考源或候选映射；依赖 `BE-STD-NICE`；本轮不启动实现 |
| BE-AI-CAP-EXT | AI / 人工智能安全能力扩展数据接入 | 回到 demo-first / 待权威源和范围确认 | 先生成 demo 页 / demo 数据和关系样例，支撑后续 AI 能力是否正式接入的业务判断 | `PLAN-AI-CAP-EXT`；先 demo、审计和用户确认，不直接覆盖受保护字典、标准、workbench、SQLite 或原始 Excel |
| BE-5 | 导入 / 校验 / 审批链路回补 | 后置 | 将当前 Excel 导入 MVP 进一步整理为 source -> staging -> review -> formal tables 的可维护链路 | 当前导入脚本和 SQLite |
| BE-6 | Delivery Bundle 1.0-alpha ZIP 解压即用交付版 | 后排保留；ZIP-UAT-0 macOS 内部试发准备已完成，Windows 待实机验证 | 当前 macOS arm64 alpha 试发材料已固定到 `/Users/kim1st/Documents/kim note/04_workspace/research/知识库工程/sapd wiki bundle/dist/releases/0.1.0-alpha/`，并已固化 ZIP、checksum、release manifest、试发指南、UAT checklist 和反馈模板；Windows `SAPD-Wiki-Backend.exe` 构建脚本和验收清单已就绪，但需 Windows x64 环境继续实测。打包任务先往后排，待 user DB / `stable_key` 前置设计稳定后再恢复 | `docs/09-delivery/zip-uat-0-internal-trial-guide.md`, `docs/09-delivery/zip-uat-0-checklist.md`, `docs/09-delivery/zip-uat-feedback-template.md`, `docs/09-delivery/windows-zip-build-guide.md` |

后端数据 / 逻辑线的边界：

- 后端负责导入、清洗、主数据统一、关系生成、校验、页面投影和来源证据。
- 后端投影应直接服务前端页面，不把 Sheet 原始字段泄露给主展示区。
- 每新增一个页面关系字段，先更新契约或投影说明，再进入前端消费。

### Delivery Bundle 1.0-alpha ZIP 前置任务

| 编号 | 任务 | 当前状态 | 目标产出 |
|---|---|---|---|
| DB-1 | base/user 双数据库边界 | 最小运行契约已完成 | 明确 `sapd_wiki_base.sqlite3` 只读基础库和 `sapd_wiki_user.sqlite3` 可写用户库 schema 分界 |
| DB-2 | `stable_key` / deterministic ID 策略 | P0 真实库 apply 已完成 / 自动验证通过 | 已新增 `scripts/audit_stable_key_contract.mjs`、`scripts/smoke_db_migration_contracts.mjs`、`scripts/migrate_db_contracts.mjs` 和 `base-stable-key-and-redirect-migration-design-2026-06-06.md`；2026-07-06 clean candidate 已正式替换基础库，基础库 `4678` 个对象和 `7757` 条关系已补齐 `stable_key` / `stable_ref` / `public_id`，并保留 `80` 个 `security_work` 主对象和 `92` 条 `maps_to_work` 关系；用户库 target_ref 迁移后 `legacyBaseRefs=0` |
| DB-3 | base manifest 与版本规范 | 最小契约已完成 | 生成 `base-manifest.json`，绑定 app 版本、base 数据版本、schema 版本、fallback JSON hash 和关键计数 |
| DB-4 | 用户库 schema / migration | 最小 schema 与创建脚本已完成 | 初始化用户库，覆盖备注、收藏、个人标签、overlay、修正建议、用户导入 staging / review / change log |
| DB-11 | 用户库治理与兼容表迁移清理 | P0 已关闭 / 自动验证通过 | 已新增 `scripts/audit_user_db_governance_contract.mjs`、用户库兼容报告、`scripts/plan_user_schema_0_3_migration.mjs`、`scripts/smoke_db_migration_contracts.mjs` 和 `scripts/migrate_db_contracts.mjs`；真实用户库已具备 `user_schema_0.3` 13 张新表；runtime 已确保 `user_workspaces` / `user_workspace_items` / `user_data_baskets` / `user_data_basket_items` / `user_export_profiles` / `user_export_jobs` 表，并提供工作台、数据篮、导出配置、导出预览、导出执行和下载最小 API；用户库 target_ref 迁移已覆盖 2 条旧 UUID 引用并写入 `user_target_ref_migrations.applied=2`，运行时和打包用户库创建入口已统一到 `user_schema_0.3`，备份和回退报告见 `data/exports/worker-verify/oi-135-formal-apply/20260706T063552Z/oi135-formal-apply-report.md` |
| DB-5 | base/user 合并 read model | 连接与命名空间规则已设计 | API 层输出 `base:<id>` / `user:<id>` 命名空间，前端不关心数据来自哪个 SQLite |
| DB-6 | ZIP Bundle Builder alpha | 真实运行 ZIP 构建规则已收紧 | 从已审批正式库生成 `sapd_wiki_base.sqlite3`、manifest、`frontend-dist`、分平台 start/stop / diagnostics 脚本、logs、diagnostics 和平台 zip 目录；默认输出到 `/Users/kim1st/Documents/kim note/04_workspace/research/知识库工程/sapd wiki bundle`；真实 ZIP 必须传入 `--backend-binary`，结构验证包必须显式 `--allow-placeholder` |
| DB-7 | 本地后端可执行文件 alpha | macOS arm64 已打包验证，Windows 待实测 | `scripts/run_local_server.py` 已用 PyInstaller 打包为 macOS arm64 `SAPD-Wiki-Backend` 并完成 ZIP 解压启动验证；Windows 构建脚本 `scripts/package_backend_windows.ps1` 和 `docs/09-delivery/windows-zip-build-guide.md` 已就绪，待 Windows x64 环境生成并验证 `SAPD-Wiki-Backend.exe` |
| DB-9 | ZIP-UAT-0 内部试发准备 | macOS arm64 已完成，Windows 前置已收口 | macOS alpha 试发材料已固定到本地 release 目录，包含 ZIP、checksum、release manifest、README、UAT checklist、问题反馈模板和 Windows pending 验证报告；Windows x64 实机构建前置条件已固化 |
| DB-8 | Tauri / 安装包体验增强 | 后置 | ZIP alpha 成立后再评估 Tauri 壳、macOS `.dmg/.app`、Windows `.msi/.exe`、签名和自动更新 |

## PLAN-FE-GLOBAL：全工程前端设计审计与优化方案

| 项目 | 当前状态 | 目标产出 |
|---|---|---|
| 真实页面审计 | 已完成 / 用户认可主体结论 | 已覆盖全局壳、关系画布、生命周期、字典、标准、指南、Issue、成熟度和共享交互层 |
| 成熟度 V2.1 完整设计与受控 demo | 已完成 / Web 回归通过 / 正式持久化与 App 后置 | 项目列表、项目创建、模板、四维评分、文件交换、复核、结果和报告的完整页面体系 |
| 安全能力图谱碰撞治理 | 已完整回退 / 暂不修复 | 全量 91 个关注点业务验收未通过，控制器、视图策略、配置、专项审计和测试挂钩已移除；旧版碰撞作为 `OI-138` 已知限制保留 |
| 信息化环境设计边界 | 已修订 / 运行实现待启动 | Draw.io 原图颜色、字体、位置和连线全部不可变，只优化外部壳、定位、控制和详情 |
| P0-1 正确性与安全边界门禁 | 已完成 / 自动验收通过 / DMG App 后置 | 四级当前对象一致、Draw.io 原图哈希与 overlay-only、状态 / 对象语义色、键盘焦点与动态播报、14 个主区禁显字段统一门禁 |
| P0-2 Apple Shell 与共享布局基座 | 已完成 / 旧 DMG 标题舒适度修正、自动与应用内浏览器验收通过 / 待用户验收、DMG App 后置 | `56 / 96px` 壳层高度、`24px / 1.13` 页面标题、`12px / 1.45` 说明、`12px 18px` 页头内边距、`5px` 文本组间距、唯一 `h1`、单域导航与当前项滚入、一个 resident auxiliary 上限、overlay 第二辅助层、共享字号 / 圆角 token；成熟度统一 `main-only`、六页签项目上下文、共享服务 Tab、紧凑目录和居中新建 workflow overlay |
| P0-3 能力图谱碰撞治理 | 已完整回退 / 暂不修复 | 全量关注点复核未通过，上一版控制器、视图策略、配置、专项审计及测试挂钩已移除，三项运行文件恢复到冻结哈希；`OI-138` 保留为已知限制，后续如重启必须以全量 91 关注点、UUID 禁显和控制语义为新前置门禁 |
| P0-4 标准与 Issue 壳层派生修复 | 已完成 / 自动与应用内浏览器验收通过 / DMG App 后置 | 8 个标准深链恢复全局入口与当前框架双层定位；Issue 取消 `rows[0]` 和批量勾选隐式详情，首次 inspector 宽度为 0，显式打开、关闭还宽并返回焦点，路由重入不泄漏旧选择 |
| P1-1 共享运行状态模板 | 已关闭 / 专项、5173 与用户验收通过，DMG App 后置 | 显式区分 loading / empty / missing_file / error / no-selection；骨架加载、局部重试、环境未选择和搜索空结果分离；重试保留路由与当前对象；能力、环境、标准 / 字典代表页面接入 |
| P1-3 生命周期宽表与上下文 | V3 已关闭 / 专项、5173 与用户复验通过，DMG App 后置 | 当前阶段 / 过程上下文、局部横向滚动、表头 / 首列退出 sticky、13px 正文、`—` 缺失值和 LC-AP / LC-DT 分段；ViewModel 与数据包不变 |
| P1-4 字典与标准层级语义 | V2 已关闭 / 自动验收与用户复验通过，DMG App 后置 | 标准 / 框架所有页面默认全部收起；能力清单只保留一个纵向滚动 owner并恢复重绘位置；单一内容页面不渲染伪 Tab；字典 / 标准内容不变 |
| P1-5 Issue 队列与全局搜索 | V5 已关闭 / 自动验收与用户复验通过，DMG App 后置 | Issue 使用完整全局页面局部搜索组件，包含计数与前后箭头；左侧目录是唯一范围所有者，清除筛选不重置目录范围；箭头按筛选后的稳定 Issue ID 导航。导出目的地、全局搜索上下文、队列列表和用户数据边界保持上一轮契约 |
| P1-2 能力 / 环境外部画布壳层 | V11 已关闭 / 自动验收与用户复验通过，DMG App 后置 | 全局 Apple Shell Tab 固定 `42/34px + 16/12px`，标题区不得压缩；T 根能力摘要为全宽单区，真实图片盒绘制四边框并按可用宽高缩放，无内部滚动；fit / zoom / focus、按需详情、P0-3 冻结和 Draw.io 原图均不变 |
| P1-6 指南文档阅读层 | 已关闭 / 5173 自动验收与用户视觉复验通过，DMG App 后置 | 成熟度模型指南使用 `194px` 文档式封面、重点章节入口和源 HTML 自有嵌入样式；App 只保留目录 + 隔离正文两层 |
| 全工程逐风险方案矩阵 | 已完成 / P0-1、P0-2、P0-4、P1-1—P1-6 已实施，P0-3 已回退 | 以 `FE-R01—FE-R70` 覆盖全局壳、总览、能力、环境、LC-AP、LC-DT、字典、标准、指南、Issue、成熟度、搜索和共享组件；P0-3 保留方案历史与失败证据，不再作为已完成能力 |
| 全局设计系统与实施路线 | 已完成 / P1 页面族基座全部进入真实工程 | Apple Shell token、页面模板、P0 / P1 / P2 顺序、验收矩阵和禁止事项；下一阶段进入 P2 收口，不重启 P0-3 图谱算法 |

全局方案入口为 `frontend/design-handoff/implementation-specs/frontend-global-optimization-plan-2026-07-11.md`，成熟度 V2.1 入口为 `frontend/design-handoff/implementation-specs/maturity-assessment-v2-1-complete-frontend-design-2026-07-12.md`。成熟度 MAT-P0 / MAT-P1 / MAT-P2 已在受控 demo 中完成首轮实现和 Web 回归；正式持久化、客户数据治理和 DMG App 证据仍需另行进入发布链路。

## 页面推进顺序建议

| 顺序 | 页面 / 模块 | 推荐原因 | 工作方式 |
|---|---|---|---|
| 1 | 安全能力映射页 | 已经有投影和多轮前端试错，最适合作为关系画布基准页 | 先收敛当前画布，再固化验收标准 |
| 2 | 信息化环境维度页 | 关系链较清晰，但要严格控制系统 / 产品不要混入主箭头 | 先补后端投影，再做页面 |
| 3 | LC-AP 开发安全生命周期页 | 关系类型最多，最容易前端硬推断 | 先补后端投影，再做页面 |
| 4 | 三页组件一致性 | 只有三页都跑通后，才有足够事实抽象公共组件 | 小步重构，不做框架迁移 |
| 5 | 专项知识维护和治理入口 | 作为数据核对与修复入口，不抢主线关系画布优先级 | 保持稳定，按问题修复 |

## 全工程前后端分离规则

- 后端负责数据导入、清洗、标准化、匹配、关系生成、评分、校验、导出和页面数据投影。
- 前端负责导航、布局、筛选、交互状态、表格 / 树 / 关系视图展示和用户反馈。
- 所有页面数据优先通过 `/api/v1/*` 和 `dataClient` 进入前端；`public/data/*.json` 仅作为后端生成的离线兼容包或 API 不可用时的 fallback。
- 新增页面、字段、关系或 maturity 能力前，先更新后端契约和文档，再进入前端实现。
- ViewModel 只做展示层整理，不承担 ETL、主数据归一、跨表匹配、成熟度评分或业务关系推断。

## 当前禁止事项

- 不默认启动 Phase 7 PPT / Draw.io / DOCX 多格式增强。
- maturity 代码实现已由用户在 2026-07-10 明确启动；本轮只允许受控 demo API 和前端工作台，不写正式数据或打包产物。
- 不默认新增 Sheet 扩展。
- 不默认重构 SQLite schema。
- 不默认大改 ETL。
- 不默认引入 React / Vue 重构当前静态 MVP 前端。
- 不在主展示区暴露非业务字段。
- 不新增绕过 `dataClient` 或 `/api/v1/*` 契约的数据读取路径。
- `PLAN-MAT-WS` 受控 demo V2.1 已完成并待用户业务验收，尚未进入正式持久化或 DMG；`PLAN-ORG-ROLE` 仍不纳入当前主线，`PLAN-STD-NICE` 当前只作为数据源接入前置。
- 不把新数据或 AI 能力扩展直接写入正式能力清单、字典、SQLite、正式 JSON 或 DMG；必须先在当前 `main` 用受控 demo 页 / demo 数据验证业务口径，再经用户确认正式写入范围和审计清单。

## 长期阶段索引

| Phase | Name | 当前处理 |
|---|---|---|
| 0 | 需求澄清与项目规划 | 已完成，历史见归档 |
| 1 | 数据发现与字段定义 | 主体完成，后续随 Sheet 复核补充 |
| 2 | 工程骨架 | 已建立，按需维护 |
| 3 | 数据模型设计 | 已完成，当前不重构 schema |
| 4 | 导入 MVP | 已跑通，当前不大改 ETL |
| 5 | 知识浏览与搜索 | 当前主线 |
| 6 | 导出与备份 | 后续 |
| 7 | 多格式增强 | 后置 |
| 8 | 更新审查与关系管理 | 后续 |
| 9 | 打包交付 | Delivery Bundle 1.0-alpha ZIP 主目标已锁定，工程待启动 |
| 10 | AI/RAG 增强 | 可选后续 |
| M | 成熟度分析模块 | M0 完成，M1 暂不默认启动 |

## 成熟度模块侧线

成熟度模块已按 `PLAN-MAT-WS` 完成受控 demo V2.1，当前等待用户在 5173 做业务验收，未重建 DMG。说明类归 `安全指南`，评估工作模块归 `工作台 > SAPD 成熟度评估`；能力、关注点、服务和作用域关系只读引用当前权威字典；真实服务评估点、治理 / 管理平台参考、四维当前与目标聚合、L2 结果、差距、文件交换和报告由后端 maturity 服务层生成，正式持久化继续后置。

| 阶段 | 状态 | 当前结论 |
|---|---|---|
| M0 | 已完成 | 完成 maturity 模块需求、领域模型、数据模型、评分规则、模板设计和基础配置规划 |
| M1.1 | 已完成 | 基于 `sample 评分表.xlsx` 完成关注点级基准和安全技术服务输入建模 |
| M1.2 | 已完成 | 基于 `评估表v2.md` 完成 L2 能力级成熟度基准解析和主工程 L2 一致性核对 |
| M1.3 | 待确认 | 确认 `M-PS.CT` 是否补入 V2 L2 基准；`T-AD.SV` 已确认与当前主工程一致 |
| M2 | 受控 demo V2.1 已完成 / 对应 `BE-M` | 已实现不落正式库的模板快照、真实服务角色、四维当前 / 目标聚合、达成率、文件交换、L2 结果和报告 API；maturity 专用 SQLite 迁移与正式持久化另行确认 |
| M3 | 受控 demo V2.1 第二十二轮已完成 / 对应 `FE-M` | 已形成企业组织项目、只读固定模板、自定义模板、L1—L5 对象 Rubric 评分矩阵、后端目标下限与统计就绪门禁、问题型评分检查、上下双雷达、精确 3 个冲突的受控 demo、顶部冲突反馈和有序 L2 摘要；前端只提交评分输入并展示后端同粒度结果和报告投影；5173 已验，DMG 待验 |

## 历史归档

| 归档文件 | 内容 |
|---|---|
| `docs/05-archive/context-slimming-2026-05-15/task_plan-full-before-slimming.md` | 本文件瘦身前的完整 `task_plan.md` |
| `docs/05-archive/findings-history/2026-05.md` | 2026-05 历史发现 |
| `docs/05-archive/progress-history/2026-05.md` | 2026-05 完整执行记录 |

## 维护规则

- 本文件只保留当前阶段、下一步、禁止事项和历史索引。
- 已完成阶段、长列表、导出文件清单、历史错误和详细过程不再继续写入本文件。
- 需要恢复完整上下文时，再读取归档文件。
