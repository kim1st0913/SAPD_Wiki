> 归档状态：`superseded / pre-round-5 public README snapshot`
>
> 当前公开介绍以仓库根目录 `README.md` 为准。

# SAPD Wiki

本项目用于规划和建设一个本地化结构化安全架构知识库系统。

目标是把 Excel、DOCX、PPT、Draw.io、Markdown 等多来源工作资料，整理为可查询、可关联、可定位、可导出、可追溯来源的本地知识库，并通过关系化工作台支持安全能力、信息化环境、生命周期和标准 / 框架之间的交叉浏览。

当前工程已从早期 Excel 导入 MVP 推进到本地关系工作台阶段。固定预览入口为 `http://127.0.0.1:5173/`，核心页面包括：

- `安全能力映射`：从安全能力、关注点、技术视角、管理视角和标准 / 框架映射浏览能力关系。
- `信息化环境安全能力映射`：从信息化环境、对象、作用域、服务、模块、措施和安全系统查看环境侧安全技术关系。
- `LC-AP安全开发生命周期` 与 `LC-DT数据生命周期安全`：按生命周期阶段查看活动、策略要求、服务、模块、措施和来源证据。
- `知识库字典`、`安全标准 / 框架`、`工作台`：维护字典、标准控制项、Issue / 批注和轻量运营入口。
- 全局搜索与页面内搜索：全局搜索负责跨域发现和结果页定位；页面内搜索负责当前页面的局部筛选、上一个 / 下一个、词级高亮和内容区定位。

全工程执行前后端分离：后端负责导入、清洗、标准化、关系生成、校验、评分、导出和页面数据投影；前端只通过 `dataClient` / `/api/v1/*` 消费契约化数据并负责展示交互。`public/data/*.json` 仅作为后端生成的离线兼容数据包或 API fallback。

面向使用者的交付形态是本地桌面应用：macOS 由正式 Mac 主工作区生成 DMG，
Windows 由私有 GitHub Runner 生成 `Setup.exe`。安装包携带受控基础数据和空用户库模板，
不携带真实用户数据库；使用者不需要自行执行 ETL 或 migration。当前流程见
`docs/09-delivery/desktop-packaging-runbook.md`。

GitHub 工程只提交代码、配置模板、文档和脱敏样例；不提交原始数据、生成数据、SQLite 数据库、导出包或预览资源。数据初始化细节见 `docs/03-import-etl/github-local-data-initialization.md`。

## 通过 MCP 连接 AI 客户端

SAPD Wiki 通过仅监听本机回环地址的 HTTPS MCP 服务向兼容的 AI 客户端提供知识查询能力。第一次使用需要完成一次本机安全连接设置和客户端授权；以后只要授权没有被撤销，通常打开 SAPD Wiki 后即可继续使用。

### 客户端范围与验证状态

当前 OpenAI 产品中，ChatGPT 桌面应用同时包含 ChatGPT 与 Codex，并不是两个互不相关的桌面应用。ChatGPT 桌面应用中的 Codex、Codex CLI 和 Codex IDE 扩展支持 MCP，并在同一 Codex host 上共享 MCP 配置。官方说明见 [Model Context Protocol](https://learn.chatgpt.com/docs/extend/mcp?surface=app)。

SAPD Wiki MCP 不把服务端协议绑定到 Codex。原则上，满足以下全部条件的本机 AI 客户端都可以连接：

- 与 SAPD Wiki 运行在同一台电脑、同一个当前登录用户下，能够访问 `https://127.0.0.1:<端口>/mcp`；
- 支持 MCP Streamable HTTP；
- 支持 OAuth 授权码流程与 PKCE；
- 使用操作系统当前用户证书信任，能够验证 SAPD Wiki 的本机 CA；
- 能完成 MCP `initialize`、`tools/list` 和 `tools/call`。

当前验证状态：

| 客户端或类型 | 状态 | 说明 |
|---|---|---|
| ChatGPT 桌面应用中的 Codex、Codex CLI、Codex IDE 扩展 | 基本测试通过 | 已验证 Streamable HTTP、OAuth 发现与授权入口、只读工具协议和本机 HTTPS 基础链路；迁移到持久 Runtime 后的真实授权跨重启保持仍需完成最终人工 UAT |
| 其他支持 Streamable HTTP、OAuth/PKCE 和系统当前用户证书信任的本机 MCP 客户端 | 原则兼容，尚未逐个认证 | 每个客户端需要单独发起并确认授权；正式支持结论以客户端兼容矩阵为准 |
| 仅支持 STDIO 的客户端 | 当前不可直接连接 | 后续如有明确需求，再评估本地桥接器 |
| 纯云端 Agent | 当前不可直接连接 | 云端通常无法访问用户电脑的 `127.0.0.1`；需要由客户端提供可信的本机运行或桥接能力 |

以下操作以 ChatGPT 桌面应用中的 Codex、Codex CLI 或 Codex IDE 扩展为当前基本验证示例。其他兼容客户端的字段名称可能不同，但服务地址、OAuth 和授权边界相同。

### 使用前确认

- SAPD Wiki 与 MCP 客户端必须运行在同一台电脑、同一个当前登录用户下。
- MCP 服务地址固定使用 `https://127.0.0.1:<端口>/mcp`，不会对局域网或互联网开放。
- 不要在浏览器中绕过证书警告。若出现证书错误，请回到 SAPD Wiki 使用“修复安全连接”。
- SAPD Wiki 不会自动修改 MCP 客户端的配置，也不会要求填写固定 Bearer Token 或自定义 Headers。

### 第一次连接的完整流程

#### 1. 打开 AI 功能集成

1. 启动 SAPD Wiki。
2. 进入“系统设置”。
3. 选择“AI 功能集成”。
4. 先查看页面顶部的“本机服务”“客户端授权”和“知识访问”状态。

此时主知识库已经可以正常使用；MCP 尚未启动不影响 SAPD Wiki 的其他功能。

#### 2. 建立本机安全连接

首次点击“启动 MCP”时，如果尚未配置证书，SAPD Wiki 会先显示“建立本机安全连接”确认页。也可以直接在“安全连接证书”区域点击“建立本机安全连接”。

确认页会说明：

- 证书只用于 `127.0.0.1`；
- 信任范围仅为当前登录用户；
- 不写入系统全局信任；
- 可通过“重置 AI 集成”完整删除。

核对后点击“生成并信任证书”，并按操作系统提示完成确认：

- macOS：证书公共部分以 Chrome 可识别的当前用户根信任加入登录钥匙串，私密信息由 SAPD Wiki 的安全存储保管。CA 证书自身通过 critical `nameConstraints` 只允许 `127.0.0.1/32`，不会信任其他网站或地址。系统可能要求使用密码或 Touch ID 确认。
- Windows：证书公共部分加入 `CurrentUser\Root`，私密信息使用当前用户的 DPAPI 保护；不写入 `LocalMachine`，正常情况下不需要管理员权限。

证书由 SAPD Wiki 自动生成、安装和验证，用户不需要寻找或手工导入 `.cer`、`.crt`、`.pem` 文件。操作完成后，页面应显示“连接安全”。

如果 Chrome、ChatGPT 桌面应用或其他 AI 客户端在证书安装前已经打开，请先完整退出并重新打开，使客户端重新加载当前用户的证书信任。macOS 上需要使用 `⌘Q` 完全退出 Chrome，只关闭标签页或窗口不够。

#### 3. 启动 MCP 服务

1. 回到“MCP 连接配置”区域。
2. 保留默认端口，或在服务停止时设置一个 `1024–65535` 之间的端口；`5173` 不可用。
3. 点击“启动 MCP”。
4. 等待状态变为“已启动”。
5. 点击“立即检查”，确认本机服务、安全证书和知识访问均正常。

页面显示的服务地址类似：

```text
https://127.0.0.1:28775/mcp
```

实际端口以当前页面为准。手动停止 MCP 后，端口才允许修改；修改端口后必须重新复制连接配置。

#### 4. 把 SAPD Wiki 添加到 Codex

在“MCP 连接配置”区域点击“复制连接配置”。复制内容包含：

```text
名称：SAPD Wiki
类型：流式 HTTP
URL：https://127.0.0.1:<当前端口>/mcp
Bearer Token：留空
Headers：留空
```

如果使用带图形配置界面的 Codex 客户端：

1. 打开 Codex 的 MCP 服务配置入口。
2. 新增一个 MCP 服务。
3. 名称填写 `SAPD Wiki`。
4. 类型选择“流式 HTTP”或“Streamable HTTP”。
5. URL 粘贴 SAPD Wiki 页面复制的完整地址。
6. Bearer Token 和 Headers 保持为空。
7. 保存配置。

如果使用 Codex CLI，可执行：

```bash
codex mcp add sapd_wiki --url "https://127.0.0.1:<当前端口>/mcp"
codex mcp login sapd_wiki
```

第二条命令会发起 OAuth 授权。不要把示例端口原样使用，应替换为 SAPD Wiki 页面当前显示的端口。若已经存在同名旧配置，应先核对其 URL，不要重复添加。

#### 5. 从 Codex 发起连接

添加配置后，在 Codex 中对 `SAPD Wiki` 选择“连接”“Authenticate”或“登录”；Codex CLI 使用：

```bash
codex mcp login sapd_wiki
```

Codex 会打开系统浏览器或显示一个需要打开的本机授权 URL。此时：

1. 不要关闭等待授权的浏览器页面。
2. 返回 SAPD Wiki 的“系统设置 → AI 功能集成”。
3. 页面会出现“待确认授权”区域。

如果浏览器出现 `ERR_CERT_AUTHORITY_INVALID` 或“连接不是私密连接”，不要选择“继续访问”，按下文“证书不受信任”处理。

#### 6. 在 SAPD Wiki 确认授权

在“待确认授权”区域核对：

- 客户端名称和 Client ID；
- Redirect URI；
- Scope；
- Resource；
- 数据策略版本；
- 授权请求到期时间。

确认该请求由自己刚才操作的 Codex 发起后，点击“允许”。不认识的客户端、不是本机回环的 Redirect URI，或并非自己刚刚发起的请求，应点击“拒绝”。

授权请求默认约 2 分钟内有效。超时后，请回到 Codex 重新选择连接或重新执行 `codex mcp login sapd_wiki`。

允许后，浏览器会把结果返回给 Codex；SAPD Wiki 的“客户端授权”区域会显示该客户端。页面顶部状态应依次变为：

- 本机服务：已启动；
- 客户端授权：已授权；
- 知识访问：可用。

#### 7. 验证连接并开始使用

回到 Codex，确认 `SAPD Wiki` 已出现在 MCP 服务或工具列表中。随后可直接提出知识问题，例如：

```text
请在 SAPD Wiki 中查找与零信任架构有关的知识，并列出相关标准和来源证据。
```

SAPD Wiki 向 Codex 提供 5 个只读工具：

| 工具 | 用途 |
|---|---|
| `search_knowledge` | 按关键词搜索基础知识库 |
| `get_knowledge_object` | 按唯一引用读取一个知识对象 |
| `get_related_knowledge` | 查询对象之间的上下游关系 |
| `get_source_evidence` | 查询脱敏后的来源和证据元数据，不返回源文件路径 |
| `get_knowledge_version` | 查询知识、策略和对象标识版本 |

成功调用后，SAPD Wiki 会更新“最近使用”和“隐私与审计”信息。审计只记录脱敏的本地操作元数据，不记录查询正文或知识正文。

### 日常使用

第一次设置完成后，日常流程为：

1. 打开 SAPD Wiki。
2. 进入“系统设置 → AI 功能集成”查看状态；如果之前保持启用，MCP 会自动恢复。
3. 确认顶部显示“本机服务已启动、客户端已授权、知识访问可用”。
4. 直接在 Codex 中使用 SAPD Wiki 工具。

已授权客户端通常不需要每次重新批准。只有撤销授权、重置 AI 集成、资源身份变化，或 Codex 丢失授权状态时，才需要重新执行授权流程。

### 停止、撤销和重置的区别

| 操作 | 适用场景 | 结果 |
|---|---|---|
| 停止 MCP | 暂时不让 Codex 访问 | 停止服务；保留客户端授权、证书和审计记录 |
| 撤销授权 | 不再允许某个 Codex 客户端访问 | 该客户端的授权和 Token 立即失效；其他客户端与证书不受影响 |
| 清除审计记录 | 删除本机 MCP 操作历史 | 只清除审计元数据；不影响知识库、证书和授权 |
| 重置 AI 集成 | 彻底恢复为未启用状态，或卸载前清理 | 停止服务、撤销全部客户端、删除 SAPD Wiki 管理的证书信任和密钥；知识库、用户数据和 License 不受影响 |

客户端授权被撤销后，需要在 Codex 中重新发起连接，并在 SAPD Wiki 中重新允许，才能恢复使用。

### 常见问题

#### 证书不受信任

现象包括浏览器显示 `ERR_CERT_AUTHORITY_INVALID`、Codex 无法打开授权页，或页面显示“信任缺失”。

1. 不要点击浏览器的“继续前往（不安全）”。
2. 如果证书刚刚建立，而 Chrome 或 Codex 在建立证书前已经运行，先完整退出并重新打开浏览器和 Codex。macOS Chrome 必须使用 `⌘Q`，不能只关闭窗口。
3. 再次打开 Codex 给出的授权 URL。
4. 如果仍然失败，返回“系统设置 → AI 功能集成”并点击“刷新状态”。
5. 只有页面显示“信任缺失”时，才在“安全连接证书”区域点击“修复安全连接”，按系统提示确认后再次完整重启浏览器和 Codex。
6. 修复完成后点击“重试启动”，确认 MCP 恢复为“已启动”，再重新执行 `codex mcp login sapd_wiki`。

“修复安全连接”会重新安装同一张 CA 公共证书，不会无故更换客户端授权。不要在浏览器中绕过安全警告。

#### `codex mcp list` 显示 `Auth: Unsupported`

当前 Codex CLI 在 OAuth 尚未完成、服务未启动或尚未保存授权状态时，列表可能仍显示 `Auth: Unsupported`。该列不能单独证明 SAPD Wiki 不支持 OAuth。

正确的判断方式是：

1. 先在 SAPD Wiki 确认 MCP 状态为“已启动”；
2. 再执行 `codex mcp login sapd_wiki`；
3. 如果命令显示本机 `/oauth/authorize` 地址，说明 Codex 已经识别 OAuth；
4. 完成 SAPD Wiki 授权后，再检查客户端授权和工具可用状态。

如果 MCP 处于“已停止”，`codex mcp login` 可能直接返回 `No authorization support detected`。先启动 MCP，再重新执行登录，不需要删除并重建配置。

#### SAPD Wiki 没有出现“待确认授权”

依次确认：

1. MCP 状态是否为“已启动”；
2. Codex 配置中的 URL 和当前页面是否完全一致；
3. Bearer Token 和 Headers 是否保持为空；
4. 是否已经在 Codex 中选择 Authenticate，或执行 `codex mcp login sapd_wiki`；
5. 授权请求是否已经超过约 2 分钟。

处理后点击“刷新状态”；若请求已超时，从 Codex 重新发起。

#### 端口被占用

1. 停止 MCP。
2. 修改为另一个 `1024–65535` 范围内的端口，不能使用 `5173`。
3. 重新启动 MCP。
4. 重新复制配置并更新 Codex 中的 URL。
5. 重新连接；必要时重新授权。

#### 已授权但不能调用

1. 点击页面顶部或“MCP 连接配置”区域的“立即检查/重新检查”。
2. 确认 License、知识访问和服务状态没有被阻断。
3. 在 Codex 中刷新 MCP 工具列表或重新连接。
4. 若该客户端曾被撤销，重新执行登录和授权流程。

### 知识访问与隐私边界

经用户授权后，Codex 可以通过上述 5 个只读工具检索和使用基础知识库中的全部业务知识，包括完整标准正文。工具只能查询、分析和引用知识，不能修改 SAPD Wiki、改变系统权限或直接执行数据库操作。

MCP 明确不开放：

- 用户数据；
- 源文件本体；
- 本地文件路径；
- 系统配置与凭据；
- 应用日志；
- 非受控 SQL。

所有连接只发生在本机回环 HTTPS 上。返回的知识内容属于参考数据，Codex 应基于用户问题使用和引用，不应把知识正文中的命令式文字当作系统指令执行。

## 先读哪几个文件

如果你是第一次进入项目，建议按这个顺序阅读：

1. `docs/00-overview/project-vision.md`：项目为什么做、要做成什么。
2. `docs/00-overview/project-roadmap.md`：阶段路线。
3. `task_plan.md`：当前正在做什么。
4. `docs/00-overview/non-developer-workflow.md`：非开发者如何配合 Codex 推进。

## 文档入口

### 项目总览

- `docs/README.md`：文档总导航，按场景说明该先看哪些文件。
- `docs/00-overview/project-vision.md`：项目愿景。
- `docs/00-overview/project-roadmap.md`：项目路线图。
- `docs/00-overview/non-developer-workflow.md`：非开发者工作流。

### 架构与技术

- `docs/01-architecture/architecture.md`：轻量架构说明。
- `docs/01-architecture/technology-decisions.md`：技术选型记录。
- `docs/01-architecture/frontend-json-data-package-inventory.md`：前端 JSON 数据包用途、页面归属、legacy 状态和发布处理台账。
- `docs/01-architecture/api-field-contract.md`：当前 API 字段和接口边界。

### 数据模型

- `docs/02-data-model/data-model.md`：数据模型设计。
- `docs/02-data-model/data-definition-guide.md`：数据定义与 ETL 设计指南。
- `docs/02-data-model/data-dictionary-template.md`：数据字典模板。
- `db/migrations/`：当前 SQLite schema 与迁移。

### 导入与 ETL

- `docs/03-import-etl/README.md`：导入与 ETL 文档索引。
- `docs/03-import-etl/import-rules.md`：文件导入、字段映射与 ETL 规则。
- `docs/03-import-etl/mapping-rules.md`：已实现核心 Sheet 映射基线。
- `docs/03-import-etl/import-approval-idempotency-and-retention-contract.md`：审批幂等与中间数据生命周期合同。
- `docs/03-import-etl/completed-sheet-business-confirmation.md`：已实现 Sheet 业务确认。
- `docs/03-import-etl/sample-file-inventory.md`：知识资产与样例文件盘点表。
- `docs/03-import-etl/github-local-data-initialization.md`：GitHub 拉取后的本地文件放置、一键数据初始化和数据不同步边界。

### 实施与数据库

- `db/migrations/`：SQLite migration SQL。
- `db/README.md`：数据库迁移顺序。
- `docs/06-implementation/local-data-layout.md`：本地数据目录约定。
- `docs/06-implementation/open-issues.md`：当前所有 bug、数据问题、页面问题和待确认事项的唯一维护文件。

### 前端与展示

- `docs/04-frontend/frontend-information-architecture.md`：当前前端信息架构。
- `docs/06-implementation/frontend-global-design-baseline-2026-05-30.md`：全局设计基线。
- `frontend/design-handoff/implementation-specs/`：当前页面实现规格。

### 治理

- `docs/07-governance/governance-index.md`：轻量治理入口。
- `docs/07-governance/data-governance.md`：数据标准化、去重、冲突、旧对象停用、验证等级和 metadata 字段升级规则。

### 成熟度分析模块

- `docs/08-maturity/requirements.md`：V2.1 当前有效需求、评分与聚合合同。
- `docs/08-maturity/maturity-domain-model.md`：当前领域模型。
- `docs/08-maturity/maturity-data-model.md`：当前 `maturity_*` 数据模型。
- `docs/08-maturity/maturity-template-mapping.md`：当前模板字段映射。
- `docs/08-maturity/assessment-rubric-dictionary-mapping-audit-2026-07-17.md`：OI-197 待裁定映射审计。
- `docs/08-maturity/assessment-rubric-source-appendix-2026-07-17.md`：OI-197 来源附录。
- `config/maturity/`：成熟度等级、评分规则、关键词、模板 schema 和报告结构配置。

### 用户说明

- `docs/04-user-guide/user-guide.md`：用户指南。
- `docs/README.md`：文档总导航，包含当前用户指南、工程入口和历史归档入口。

### 归档

- `docs/05-archive/old-plans/`：旧计划和历史构想。
- `docs/05-archive/closed-issues/`：已闭环的问题记录。

## Codex 工作入口

- `AGENTS.md`：Codex / Agent 工作规则。
- `task_plan.md`：当前任务权威表。
- `findings.md`：当前关键决策、重要风险和历史记录索引。
- `findings-history/`：历史发现归档。
- `progress.md`：执行日志、文件变更、命令和验证结果。
- `docs/06-implementation/open-issues.md`：bug 和问题清单；修复后也在这里改状态。
- `scripts/README.md`：脚本分类、长期工具和专题脚本说明。

## 本地命令

初始化本地数据库：

```bash
python scripts/sapd_wiki.py init-db
```

从 GitHub 拉代码后的推荐一键数据初始化：

```bash
python scripts/sapd_wiki.py bootstrap-local-data --print-inputs
python scripts/sapd_wiki.py bootstrap-local-data --reset
```

提交前检查是否误追踪原始数据或生成数据：

```bash
python scripts/check_github_data_boundary.py
```

同一检查已接入 GitHub Actions：每次 push / pull request 会自动运行 `.github/workflows/data-boundary.yml`，如果原始数据、SQLite、导出包或前端生成数据被误追踪，CI 会失败。

登记并检查 Excel 样例：

```bash
python scripts/sapd_wiki.py inspect-excel "data/raw-samples/wiki sample.xlsx" --sensitive-level confidential
```

把 5 个核心 Sheet 解析到暂存区：

```bash
python scripts/sapd_wiki.py stage-excel "data/raw-samples/wiki sample.xlsx" --sheets all --sensitive-level confidential
```

审批某次暂存导入并写入正式表：

```bash
python scripts/sapd_wiki.py approve-import <import_job_id>
```

查看当前数据库摘要和基础查询：

```bash
python scripts/sapd_wiki.py summary
python scripts/sapd_wiki.py list-items --type capability_focus --limit 8
python scripts/sapd_wiki.py imports --limit 5
```

导出对象、关系和本次导入结果报告：

```bash
python scripts/sapd_wiki.py export-items --format all
python scripts/sapd_wiki.py export-relations --format all
python scripts/sapd_wiki.py export-report --sample-limit 20
```

导出文件默认生成在 `data/exports/`，该目录不提交 GitHub。

成熟度分析模块命令占位：

```bash
python scripts/sapd_wiki.py maturity-template --output data/maturity/templates/customer-maturity-template-v1.xlsx
python scripts/sapd_wiki.py maturity-import data/maturity/inputs/<customer-assessment>.xlsx
python scripts/sapd_wiki.py maturity-match <assessment_id>
python scripts/sapd_wiki.py maturity-export-review <assessment_id> --type match
python scripts/sapd_wiki.py maturity-score <assessment_id>
python scripts/sapd_wiki.py maturity-report <assessment_id> --format html
```

上述 maturity 命令尚未实现，目前只是后续独立模块的 CLI 规划占位。成熟度评估运行数据后续使用 `maturity_*` 专用表，不写入 `knowledge_items`。

当前干净重建后的正式验收报告位于：

```text
data/exports/clean-d1c3fe17/import-result-report-d1c3fe17.md
```

启动第一版能力目录浏览页：

```bash
python scripts/sapd_wiki.py export-capability-tree
cd frontend/capability-browser
python -m http.server 5173
```

然后打开：

```text
http://127.0.0.1:5173
```

启动带本地 API 的关系工作台：

```bash
python scripts/sapd_wiki.py serve --host 127.0.0.1 --port 5173
```

该模式会同时提供：

```text
http://127.0.0.1:5173/
http://127.0.0.1:5173/api/v1/health
http://127.0.0.1:5173/api/v1/data-packages/maintenance
http://127.0.0.1:5173/api/v1/data-packages/shared-lookups
http://127.0.0.1:5173/api/v1/capabilities/workspace-projection
http://127.0.0.1:5173/api/v1/maintenance
```

前端会优先读取 `/api/v1/data-packages/*`，如果本地 API 不存在，则自动回退到 `public/data/*.json` 静态文件。

数据库默认生成在：

```text
data/database/sapd_wiki.sqlite3
```

## 数据安全

真实原始资料、数据库文件、导出包和本地缓存默认不应提交到 GitHub。请优先提交文档、代码、配置模板和脱敏样例。
