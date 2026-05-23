# 数据治理规则

本文档集中记录 SAPD Wiki 当前阶段必须遵守的数据治理规则。目标不是建立复杂治理体系，而是防止 ETL、人工修正、前端展示和后续 Agent 分工出现口径漂移。

## 1. 治理原则

| 原则 | 说明 |
|---|---|
| 数据优先 | 字段定义、映射规则和 ETL 规则先于页面扩展 |
| 来源可追溯 | 每个正式对象和关系必须能追溯来源文件、Sheet、行列、hash 和导入任务 |
| staging-first | 自动导入必须先进入 staging，经 review/approval 后进入正式库 |
| 主数据优先 | 有编码、已确认的主数据优先于映射表中的临时文本 |
| 渐进固化 | 不稳定字段先进入 `metadata_json`，稳定后再提升为正式字段 |
| 问题集中 | bug、数据问题、待确认事项统一进入 `docs/06-implementation/open-issues.md` |

## 1.0 GitHub 数据边界

GitHub 仓库只保存代码、文档、配置模板和脱敏 fixture，不保存真实原始数据和生成数据。

提交前应执行：

```bash
python scripts/check_github_data_boundary.py
```

同一检查已接入 `.github/workflows/data-boundary.yml`，在 push / pull request 时自动运行。CI 失败时，优先检查是否有原始数据、SQLite 数据库、导出包或前端生成数据被 Git 追踪。

禁止提交清单、文件放置清单和本地数据重建流程见 `docs/03-import-etl/github-local-data-initialization.md`。

## 1.1 原始表建模确认规则

每建模或导入一张新的原始 Sheet 前，必须先完成业务确认，不允许只根据字段名直接写 parser。

确认内容：

| 确认项 | 必须明确的问题 |
|---|---|
| 业务含义 | 这张表是主数据、映射表、参考资料、说明文档，还是统计汇总？ |
| 主键 | 哪个字段是稳定编码？没有编码时是否使用标题、上下文或复合键？ |
| 字段角色 | 哪些字段是对象，哪些是描述、备注、统计、辅助列？ |
| 关系基数 | 一对一、一对多、多对一、多对多是否允许？ |
| 主从关系 | 与已导入表发生冲突时，以哪张表为准？ |
| 前端用途 | 这张表适合独立维护页、关系页、矩阵页，还是只作为详情补充？ |
| 错误处理 | 统计合计、占位符、半截文本、错字和重复编号如何处理？ |

当前已完成映射表的复核清单维护在 `docs/03-import-etl/completed-sheet-business-confirmation.md`。后续新增 Sheet 时，先补充该清单，再开始 ETL 实现。

## 2. Canonicalization Rules

标准化规则用于把同一业务含义的不同写法统一到稳定编码或标准名称。

| 规则 | 当前处理 |
|---|---|
| `ALL&TI.*` | 标准化为 `ALL&T-IN.*` |
| `ALL&T-TI.*` | 标准化为 `ALL&T-IN.*` |
| `I_US` | 标准化为 `I-US` |
| `&TI.` | 标准化为 `&T-IN.` |
| `&T-TI.` | 标准化为 `&T-IN.` |
| `...` / `…` | 视为占位空值，不生成正式对象 |
| 组织职能字段中的顿号 `、` | 不作为多值分隔符，避免拆坏正式职能名 |

新增标准化规则前，应先在 `open-issues.md` 记录原因、影响和验证结果。

## 3. Deduplication Rules

去重优先级：

```text
稳定编码
>
确认别名
>
标题 + 类型 + 限定上下文
```

当前规则：

- 有稳定编码的对象，优先按 `type + code` 去重。
- 没有稳定编码的对象，按 `type + title + qualifier` 去重。
- 能匹配正式主数据的映射文本，不创建新的无编码对象。
- 同一层级存在同名有编码对象时，无编码重复对象不得导出到前端。
- `security_technical_service` 已确认为全局编码唯一对象；编码由 `作用域 + 能力关注点编号` 组合而成。
- `安全能力-安全技术服务` 是 `security_technical_service` 编码和名称的权威来源。
- 其他表中的同编码安全技术服务只用于建立映射关系，不允许覆盖权威服务名称。
- 如果 active 安全技术服务对象名称与权威表不一致，必须输出数据质量报告并进入 `open-issues.md`。
- `information_object` 使用同一套主数据，按对象名称全局去重；信息化环境和环境分段只作为关系或上下文字段，不参与信息化对象主键。

## 4. Work Function 主数据规则

`安全工作职能清单` 是工作职能主数据来源。

规则：

- 有编码的 `work_function` 为正式主数据。
- `安全能力-安全管理元素（high level）` 中的组织职能相关方只作为映射文本。
- 映射文本若能匹配正式职能，只创建 `stakeholder_by` 关系，不创建新的无编码 `work_function`。
- 明显半截文本不生成对象，例如 `身份`、`技术实施）`、`安全实施职能（方案设计`。
- 新出现的错字、简称或业务别名，需要先在 `open-issues.md` 确认，再加入 ETL 别名规则。

已确认案例：

- `身份、凭证及访问管理运营职能` 是完整正式职能名，不允许按顿号拆分。
- `安全实施职能（咨询规划）` 等当前源表残留变体，归并到正式职能 `69 安全实施职能（规划咨询、方案设计、技术实施、项目管理）`。

## 5. Conflict Resolution Rules

当前优先级：

```text
人工确认
>
正式主数据
>
当前来源 ETL
>
历史导入结果
```

处理规则：

- 自动导入不得静默覆盖人工确认结果。
- 批量导入必须进入 staging，并保留 proposed action。
- 冲突记录应进入 review，不直接写入正式库。
- 用户确认的数据修正，应记录到 `open-issues.md` 或对应治理文档中。

## 6. 旧对象停用规则

已确认规则：

- 前端导出只展示 `active` 对象和 active 端点关系。
- 用户明确确认的历史错误对象，可以局部标记为 `deprecated`。
- 同一来源文件、同一 Sheet 全量同步时，本次未出现、且非人工维护保护对象的旧 ETL 对象，自动标记为 `deprecated`。
- 如果曾经被停用的 ETL 对象重新出现在来源 Sheet 中，审批入库时恢复为 `active`。
- 自动停用必须写入 `change_logs`，并保留 `import_job_id`、来源文件路径、来源 Sheet 和停用原因。

保护规则：

- `metadata_json` 中存在 `manual_protected`、`manual_override`、`manual_edit`、`source_mode = manual` 或 `managed_by = manual` 的对象，不允许自动停用。
- 本次导入存在 `error` 或 `blocking` 校验信息时，跳过旧对象自动停用，避免因解析不完整导致误停用。
- 自动停用只在当前导入实际覆盖的 Sheet 范围内生效，不跨 Sheet 推断。

实现状态：

- `OI-013` 已落地 MVP 机制。
- 当前实现以来源文件路径、来源 Sheet、对象类型和 `object_key` 判断旧对象是否消失。

## 7. Stable ID Rules

当前实现：

- 数据库主键 `id` 使用 UUID。
- 业务稳定身份通过候选对象的 `object_key` 保存于 `metadata_json`。
- 有编码对象的稳定身份主要来自 `type + code`。
- 无编码对象的稳定身份主要来自 `type + title + qualifier`。

允许变化：

- 标题轻微修正；
- 描述补充；
- 来源引用追加；
- `metadata_json` 中的扩展字段。

需要谨慎处理：

- `type` 改变；
- 稳定编码改变；
- 同一对象拆分为多个对象；
- 多个对象合并为一个对象。

这些情况应进入 staging/review 或在 `open-issues.md` 建立问题记录。

## 8. Validation Severity

当前代码层使用：

| 等级 | 含义 | 是否阻止导入 |
|---|---|---|
| ok | 校验通过 | 否 |
| warning | 可继续，但需要用户审查 | 否 |
| error | 阻止该条记录入库 | 是 |

治理层补充：

| 等级 | 含义 |
|---|---|
| info | 提示，不影响导入 |
| warning | 可继续，建议审查 |
| error | 阻止记录导入 |
| blocking | 必须先修复，不能进入审批 |
| business_accept | 业务接受，不再作为 bug 处理 |

后续如果代码扩展验证等级，应保持和本文档一致。

## 9. Metadata Promotion Rules

`metadata_json` 当前是合理的 MVP 设计，用于承载尚未稳定的字段。

字段生命周期：

| 阶段 | 说明 | 存储建议 |
|---|---|---|
| experimental | 来源不稳定、只用于探索 | `metadata_json` |
| semi-stable | 多次导入出现，已有查询或展示需求 | `metadata_json` + 导出字段 |
| stable | 业务定义稳定，需要索引、筛选或高频查询 | 正式 column 或独立表 |

提升为正式字段的条件：

- 字段含义稳定；
- 至少两个导入批次重复使用；
- 前端、导出或查询有明确需求；
- 去重、排序、筛选或性能需要依赖该字段；
- 已有迁移和回填方案。

禁止：

- 因为单次页面展示需要就立刻新增 column。
- 在字段含义未确认前拆出专用表。

## 10. Frontend Rendering Rules

当前不实现复杂 schema-driven frontend 引擎，只先遵守渲染治理规则：

- 新对象类型优先进入通用“清单 + 详情 + 关系链路”工作台。
- 只有当对象拥有独立工作流时，才新增独立页面。
- 列表字段应少而稳定：编码、标题、分组、层级、状态。
- 关系信息优先以 badge、chip 或详情区展示，不在列表中堆满。
- 默认 UI 展示处理、映射、关联后的业务结果；来源 Sheet、行号、字段名不作为主界面内容。
- 来源追踪作为治理和排错能力保留在数据层，需要时可通过审计导出或折叠区查看。
- 基础知识表应尽量保留原表的业务组织方式，例如作用域目录、流程清单、职能清单、安全技术模块清单。
- 映射表应优先形成关系页或矩阵页，例如能力关注点 -> 服务 -> 作用域 -> 模块 -> 系统/产品。

后续对象类型继续增加后，再评估是否新增 `frontend/schema/` 配置层。

## 10.1 前端数据包拆分规则

前端离线 JSON 是后端投影结果，不是原始 Sheet 的搬运结果。任何新导出包都必须按“页面契约 + 业务边界”组织，不允许为了方便把多个大表继续塞进一个大 JSON。

通用规则：

- 索引包只承载导航、标题、版本、统计、Tab 元数据和分包路径，不承载主表 `rows`。
- 详情包按页面、框架、对象类型或 Tab 拆分，进入页面或切换 Tab 时再按需加载。
- 单个 JSON 如果超过约 `1MB`，应评估拆分；超过约 `3MB` 必须拆分或给出治理说明。
- 长文本矩阵、成熟度描述、标准控制项、参考条款等高膨胀数据不得进入全局首屏包。
- 兼容旧文件名时，旧文件只能作为小索引或重定向兼容包，不得继续承载全量行数据。
- 前端组件不得直接拼接多个原始包重新推断业务事实；只能通过 `dataClient`、`/api/v1/*` 或后端生成的契约化分包读取。

安全标准 / 框架包的强制规则：

```text
frontend/capability-browser/public/data/
├── standards-index.json
├── standards-data.json          # 兼容索引，不承载 rows
└── standards/
    ├── <framework>.json
    └── <framework>/<tab>.json
```

- `standards-index.json` 和兼容 `standards-data.json` 必须是 `package_type = standards-index`。
- `standards-index.json.frameworks[]` 不得包含 `rows`。
- `/api/v1/data-packages/standards-index` 返回小索引；旧入口 `/api/v1/data-packages/standards` 可由后端运行时组装完整明细用于兼容，但不得重新写回静态全量大包。
- 多 Tab 框架必须按 Tab 分包，例如 DSP SCF 2026 的 `SCF Controls` 和 `SCF成熟度`。
- 前端首屏只加载索引和当前框架 / 当前 Tab；切换到其他 Tab 后才加载对应分包。
- 主展示区不得出现非用户需求的衍生字段、占位字段、中间字段或调试字段；新增列前必须确认它来自原始业务字段或已被用户明确要求展示。
- 标准 / 框架主展示包不得出现 `sheet`、`row`、`column`、`raw_value`、`source_file`、`source_ref`、`metadata`、`debug`、`intermediate` 等非业务字段。

当前已固化的标准 / 框架分包：

| 文件 | 角色 |
|---|---|
| `standards-index.json` | 标准 / 框架导航、统计、分包路径 |
| `standards-data.json` | 旧入口兼容索引 |
| `standards/dsp-level-2/dsp-scf-controls-2026.json` | DSP SCF 2026 控制项 Tab |
| `standards/dsp-level-2/dsp-scf-maturity-2026.json` | DSP SCF 2026 成熟度 Tab |

验证要求：

- `python3 scripts/data_package_summary.py --package standards` 应显示 `standards-index.json` 为小索引，并输出 `split_files`。
- 抽样检查 `standards-index.json` 和 `standards-data.json` 时，`frameworks[]` 及其 `tabs[]` 不得包含 `rows`。
- 浏览器验证应确认首屏没有提前请求非当前 Tab 的大分包。

## 11. 错误数据处理流程

未来数据导入遇到错误数据时，按以下流程处理：

| 步骤 | 处理方式 | 输出 |
|---|---|---|
| 1. 暂存 | Excel、PPT、Draw.io、DOCX 等来源先进入 staging 或登记表，不直接覆盖正式库 | `import_jobs`、`staging_items`、`staging_relations` |
| 2. 校验 | ETL 输出 `ok`、`warning`、`error`、`blocking` 等等级 | 导入摘要、warning review、问题记录 |
| 3. 分类 | 判断是源数据错误、ETL 规则缺失、模型设计缺口，还是业务可接受差异 | `open-issues.md` |
| 4. 修复 | 源数据错误优先修 Excel；规则缺失再修 ETL；模型缺口先补设计再编码 | 源文件修订或代码修订 |
| 5. 复导 | 重新 staging，检查 validation 和差异结果 | 新 import job |
| 6. 审批 | 确认无阻断问题后 approve，正式表更新、旧对象停用或恢复 | `knowledge_items`、`knowledge_relations`、`change_logs` |
| 7. 验证 | 重新导出前端 JSON 或清单，检查页面和统计 | 导出文件、验证记录 |

处理原则：

- `error` 和 `blocking` 优先修复，不进入正式审批。
- `warning` 可以审批，但必须在报告或 `open-issues.md` 中留痕。
- 源数据错误由用户修正源 Excel 后复导，系统通过同来源 Sheet 同步机制处理旧对象停用。
- ETL 规则错误由代码修复，并在 `data-governance.md` 或映射规则文档中沉淀稳定规则。
- 业务接受的差异标记为 `business_accept`，后续不再作为 bug 反复处理。

## 12. 成熟度评估数据治理规则

成熟度分析模块使用现有安全能力知识库，但客户评估输入、证据、匹配候选、评分结果和报告属于评估运行数据，默认不进入主知识库对象。

治理规则：

| 规则 | 当前口径 |
|---|---|
| 数据边界 | maturity 运行数据使用 `maturity_*` 专用表或 `data/maturity/` 本地运行文件，不写入 `knowledge_items` |
| 主数据引用 | 只读引用现有能力、关注点、服务、模块、流程、职能等知识对象 |
| 来源追踪 | 记录模板文件、Sheet、行号、字段、证据摘要、模板版本、规则版本和知识库快照 |
| staging / review | 客户模板导入和低置信度匹配必须进入 maturity 专用暂存或审查流程，不直接评分 |
| 人工优先 | 自动匹配、自动评分与人工审查冲突时，人工确认结果优先 |
| 人工覆盖 | 覆盖评分必须记录原始自动结果、覆盖后结果、原因、审查人和时间 |
| 版本化 | 成熟度等级、评分规则、模板 schema 和报告模板必须带版本号 |
| 敏感数据 | 客户输入、证据、评分结果和报告默认存放在 `data/maturity/`，不提交 GitHub |
| 前端边界 | 前端只展示导出的评估结果，不从客户原始文本自行推断能力或评分 |

默认忽略路径：

```text
data/maturity/
```

如需提交 maturity 示例数据，必须先脱敏，并明确标记为示例，不得使用真实客户名称、真实证据文件或可识别业务描述。

## 13. 维护规则

- 本文档记录稳定规则，不记录每次执行日志。
- 执行日志写入 `progress.md`。
- 具体 bug 和数据问题写入 `open-issues.md`。
- 若本文档规则与代码行为不一致，应新增 issue 并决定是改代码还是改规则。
