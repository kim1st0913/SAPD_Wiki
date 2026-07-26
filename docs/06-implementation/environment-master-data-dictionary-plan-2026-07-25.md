# 信息化环境主数据与对象字典改造计划

日期：2026-07-25  
计划编号：`PLAN-ENV-MD`  
状态：`p3_completed_p4_not_started`

## 1. 目标

建立信息化环境、环境子类类型、信息化对象三类唯一主数据，并让环境映射关系只引用主数据身份，不再把映射树中的重复上下文直接当作字典记录。

本计划不删除、不合并、不重建现有环境关系事实；正式数据库、源 Excel、现有 `environment-workbench.json` 和用户数据库在取得单独 apply 授权前保持不变。

当前脏工作区中已经存在基于旧环境树的 `EnvironmentObjectDirectoryTable.js` 页面实现。它属于本计划的 legacy fallback/交互参考，不代表主数据改造已经实施；后续不得覆盖或清理该文件，应在明确差异后小范围演进。

## 1.1 复审后补充的关键结论

本轮计划级 Product Design 与数据边界复审确认，原计划方向正确，但必须补齐以下四个门禁：

1. 当前“16 个唯一名称”只是按现有标题得到的技术候选，不自动等于16条已经确认的业务主数据。同名可能同义，也可能只是不同环境下的同名概念；必须逐条确认定义和别名后才能合并到同一 `environment_segment_type`。
2. 现有 `staging._match_item()` 在没有编码时按 `type + title` 匹配，没有使用 `environment_segment` 的环境 qualifier。若只迁移当前数据库而不修复未来导入匹配，后续重导仍可能把同名环境子类匹配到错误上下文。
3. 环境运行时不只包含 `environment-workbench.json`，还包含 `public/data/environment/` 拆分导航与详情、`environmentBasemap.node-details.json`、Dashboard 统计和运行时搜索索引。它们必须进入兼容检查与回退清单。
4. 正式切换必须采用“加法迁移 + 影子验证 + 显式开关”的 expand/contract 路径。前端、数据包或基础库任一层失败时，应只回退受影响层，不使用删关系或重建旧数据的方式救火。

## 1.2 P0执行结果

P0合同冻结已完成，正式入口为：

- `docs/01-architecture/contracts/environment-master-data/v1/environment-master-data.contract.json`
- `docs/01-architecture/contracts/environment-master-data/v1/environment-dictionary.schema.json`
- `docs/01-architecture/contracts/environment-master-data/v1/master-data-decision-manifest.schema.json`
- `tests/fixtures/environment-master-data/v1/`
- `scripts/audit_environment_master_data_p0_contract.mjs`

P0已冻结对象类型、业务文案、编号格式、身份保护、关系方向与唯一性、API主展示结构、统计grain、首期只读页面、旧树fallback、兼容范围和停止条件。P0未分配真实业务编号，未确认16个候选的业务合并结论，也未授权修改运行代码、正式包或数据库。

## 1.3 P1执行结果

P1只读盘点已完成，权威报告位于：

- `data/exports/worker-verify/plan-env-md/p1-20260725T154921Z/p1-inventory.md`
- `data/exports/worker-verify/plan-env-md/p1-20260725T154921Z/master-object-ledger.csv`
- `data/exports/worker-verify/plan-env-md/p1-20260725T154921Z/relationship-ledger.csv`
- `data/exports/worker-verify/plan-env-md/p1-20260725T154921Z/environment-segment-title-groups.csv`
- `data/exports/worker-verify/plan-env-md/p1-20260725T154921Z/master-data-decision-manifest.p1.json`

盘点确认数据库与 `environment-workbench.json` 在10个信息化环境、29个环境子类上下文、51个信息化对象和67个环境对象上下文上完全一致；16个同标题组均带上下文与来源证据。29条 segment→environment 和67条 object→segment/environment 关系均有来源证据，无孤儿、无多环境segment、无端点错误或 qualifier 错配。90条现有记录仍未分配业务编号，这是P2待裁定事项，不是身份缺失。

用户库只读扫描命中14次本域引用，包括当前环境基图上下文锚点和已应用迁移历史，未解析引用为0。基础库、用户库、环境工作台包和环境基图语义文件的运行前后 SHA-256 均未变化。P1阶段结束时，77条裁定项全部保持 `hold`，正式apply未授权。

## 1.4 P2执行结果

P2已完成16个环境子类候选的逐组语义裁定，冻结 `IE-001—IE-010`、`ES-001—ES-016`、`IO-001—IO-051` 共77条主数据编号。29个既有 `environment_segment` 明确为上下文实例，不分配主数据编号；每个上下文已精确映射到一条类型并生成29条 `instance_of` 计划。跨环境同名类型复用同一主数据；`业务应用` 与 `应用及数据` 因云数据中心与传统数据中心的运行结构差异保持独立。

导入实现已按本计划修复环境 qualifier 精确匹配、父环境切换清理子状态、`environment_segment_type` 编码身份和 `instance_of` 来源端唯一性。10项定向测试通过；在临时 SQLite 副本连续导入同一环境映射 Sheet 两次后，第二次新增/停用对象为0、新增/删除关系为0、上下文错配为0，既有10/29/51对象身份和96条上下文关系保持。重复审批仍追加来源引用与审计日志，按 `OI-198` 作为既有非阻断限制，不扩大本阶段的幂等声明。

P2权威输出位于 `data/exports/worker-verify/plan-env-md/p2-20260725T161109Z/`。P2结束时正式基础库、用户库、源Excel、环境工作台包和底图语义文件均未修改，正式apply尚未授权；后续P6执行状态见第11节。

## 2. 当前事实与目标粒度

| 对象 | 当前事实 | 目标主数据 | 保留的关系/上下文 |
|---|---:|---:|---:|
| 信息化环境 | 10 个唯一对象 | 10 条 | 继续作为关系根节点 |
| 环境子类 | 29 个环境上下文 ID、16 个同标题候选组 | 以P2人工裁定清单为准；同标题组允许拆分、异标题组允许合并，最多不超过29条 `environment_segment_type` | 29 个 `environment_segment` 上下文实例继续保留 |
| 信息化对象 | 51 个唯一对象、67 次上下文出现 | 51 条 | 67 条环境—子类—对象上下文继续保留 |

当前解析器使用 `信息化环境` 作为 `environment_segment` qualifier，因此29个子类 ID 是环境上下文实例，不应直接删除或按名称合并。当前信息化对象已经按名称全局 canonicalize，计划优先复用现有51个身份，但仍要在P1验证不存在同名异义、别名重复、停用记录或孤儿身份。

## 3. 身份与编号契约

每条主数据同时保留三类身份：

| 字段 | 用途 | 规则 |
|---|---|---|
| `id` | SQLite 外键与现有 API 兼容 | 现有 UUID 不变；新增对象生成一次后不可重算 |
| `stable_ref` / `public_id` | 用户批注、搜索、导出和跨版本引用 | 沿用现有 stable identity 合同 |
| `code` | 用户可读业务编号 | 信息化环境 `IE-*`、环境子类类型 `ES-*`、信息化对象 `IO-*` |

编号规则：

1. 编号格式固定为三位序号：`IE-001`、`ES-001`、`IO-001`；初次分配写入显式编号清单，运行时不得按标题或页面顺序计算。
2. 业务编号一次分配并持久化，不回收、不复用、不因删除或停用补位；扩容时只追加新号。
3. 初次分配前验证同类型内无重复编号、无重复 stable identity、无一条 stable identity 对应多个编号。
4. 修改名称不改变 `id`、`stable_ref`、`public_id` 或 `code`。
5. 合并使用 `base_id_redirects`；拆分进入人工确认，不自动迁移用户引用。
6. 不把名称、前端行号、树位置或当前排序当作主键。
7. 给既有记录补 `code` 不得重算或覆盖其 `stable_key`、`stable_ref`、`public_id`、旧 `metadata.object_key`；若现有非空 code 与分配清单冲突，停止并人工裁定。

P0先冻结编号清单的字段和决策规则；P1填充盘点结果，P2在人工裁定后冻结正式编号分配清单。清单至少包含：

```text
master_type
stable_ref
public_id
code
canonical_title
aliases[]
definition
status
decision
decision_note
```

`decision` 只允许 `reuse`、`create`、`merge_review`、`split_review`、`hold`。存在 `merge_review`、`split_review` 或 `hold` 时，不得进入正式 apply。

### 3.1 名称、别名与生命周期

1. 候选归并前只允许做 Unicode、全半角、首尾空白和连续空白的受控规范化；不得自动移除业务标点、缩写、层级词或括号内容。
2. 同名不等于同义，异名也不等于不同对象。每个环境子类候选必须有定义、别名和至少一个现有上下文证据。
3. 主数据状态使用 `active`、`deprecated`、`merged`；停用或合并记录保留 identity 和 redirect，不物理复用编号。
4. 首轮不自动重命名现有10个环境或51个对象；发现争议只进入人工复核清单。

## 4. 目标数据模型

### 4.1 主数据

- `information_environment`：10条，复用现有对象，补齐唯一业务编号。
- `environment_segment_type`：新增经P2逐条裁定的权威子类主数据；16只是当前同标题候选组数，不是固定结果或数量上限。同名异义可以拆分，异名同义可以合并，最终最多不超过29个现有上下文实例。
- `information_object`：51条，复用现有全局主数据，补齐唯一业务编号。

### 4.2 关系与上下文

现有关系保持原 ID、来源证据和业务语义：

```text
information_environment
  <- belongs_to - environment_segment
  <- belongs_to - information_object
```

新增：

```text
environment_segment
  - instance_of -> environment_segment_type
```

迁移后：

- 原29个环境—子类上下文不减少。
- 原67个环境—子类—对象上下文不减少。
- 每个现有 `environment_segment` 必须且只能有一条 `instance_of`；当前基线应新增且仅新增29条该关系。
- 原关系 ID、source reference、import job 和 evidence 不改写。
- `instance_of` 关系以 `(source_item_id, relation_type)` 唯一，重复 apply 不新增第二条；目标变更必须进入人工裁定而不是静默覆盖。
- 允许信息化对象直接属于环境的现有合法关系；不得为凑齐子类层级虚构 `environment_segment`。
- 任一孤儿 segment、孤儿对象、多重 `instance_of` 或未解析端点都会阻止正式 apply。
- `environment_segment_type` 和 `instance_of` 必须进入受控对象/关系词汇表、导出 allowlist、API schema和审计脚本；不得依赖通用 JSON 容忍未知类型而绕过契约。

### 4.3 未来导入保持

本改造不能只修当前快照。P2前必须先冻结以下导入规则：

1. `environment_segment` 上下文身份使用 `type + environment identity/qualifier + normalized title` 或其稳定 key 匹配，不再回落为全局 `type + title`。
2. `environment_segment_type` 使用业务编号优先、canonical title/alias 辅助匹配；模糊或多义匹配进入 staging 人工复核。
3. 解析器在生成上下文 segment 时同步解析其 `environment_segment_type` 候选和 `instance_of`，但不得由前端或导出器临时推断。
4. 同一源数据连续导入两次，第二次必须为幂等更新：新增主数据0、重复关系0、错误上下文匹配0。
5. 不允许为修复 segment 匹配而改变其他对象类型的既有 canonicalization 规则；staging 修复需有定向单测和反例。

## 5. 数据包与 API 边界

### 5.1 环境映射

`environment-workbench.json` 和 `/api/v1/environments/tree` 继续承载映射树：

```text
信息化环境 -> 环境子类上下文 -> 信息化对象
```

树允许同一子类类型和信息化对象出现在多个业务上下文。

### 5.2 对象字典

新增独立字典投影，建议：

- 数据包：`environment-dictionary.json`
- API：`GET /api/v1/environments/dictionary`

字典投影包含：

- `information_environments`
- `environment_segment_types`
- `information_objects`
- `usage_relations`
- 主数据数量和关系数量

前端不得从 `environment_scope_tree` 按标题临时去重，不得在 ViewModel 中重新实现 canonicalization。

字典投影还必须声明：

- `schema_version`
- `data_state`
- `generated_at`
- `source_package_versions`
- `master_counts`
- `context_counts`
- `evidence_ref_count`

主展示数据不携带 raw 来源字段；来源证据进入独立 sidecar 或既有折叠证据区。

### 5.3 兼容范围与切换开关

以下旧契约在本计划内保持可用：

- `environment-workbench.json`
- `/api/v1/environments/tree`
- `frontend/capability-browser/public/data/environment/navigator.json`
- `frontend/capability-browser/public/data/environment/projections/`
- `frontend/capability-browser/generated/environmentBasemap.node-details.json`

新增字典投影先以影子模式生成，不立即替换知识库字典页面。前端通过单一显式能力开关选择：

- 开启：读取新的字典 API/数据包；
- 关闭：继续显示当前环境对象目录树；
- 新包缺失、版本不兼容或校验失败：自动回到旧目录树，不在前端从旧树推导10/16/51主数据。

fallback 时应显示低噪声的兼容提示，避免把旧树误认为已经完成主数据去重。

运行时搜索索引继续由后端受控生成；新字典结果必须使用主数据 stable identity，并与环境映射上下文结果分型去重。Dashboard 只使用已声明的主数据/上下文统计字段，不从新增对象类型推测总数。Local MCP 的基础知识查询仅以只读方式暴露新对象/关系，并验证分页、稳定引用和旧类型查询无回归。

## 6. 页面改造

入口保持：

```text
知识库字典 -> 信息化环境-对象目录
```

页面改为三个可折叠字典分类：

1. 信息化环境：10条。
2. 环境子类：显示经P2确认的唯一主数据；技术类型仍为 `environment_segment_type`。
3. 信息化对象：51条。

每个主数据只显示一次；展开某条记录后展示关系摘要：

- 关联环境数量与清单。
- 关联环境子类上下文数量。
- 关联信息化对象或子类类型。
- 关系上下文数量。

页面统计明确区分：

- `唯一环境子类主数据 = P2裁定数（当前16个标题候选）`
- `环境子类上下文 = 29`
- `信息化对象 = 51`
- `环境对象上下文 = 67`

原信息化环境安全能力映射页继续使用树，不改成交叉字典。

### 6.1 首期页面边界

首期是只读主数据字典，不提供行内新增、删除、合并或改号。若后续需要维护能力，应另行设计具备权限、校验、审计日志和合并/拆分复核的写接口，不把维护逻辑塞进当前前端组件。

每条主数据至少展示：

- 业务编号、规范名称、定义/描述、状态。
- 别名数量。
- 关联环境数、上下文数或对象数。
- 展开后的关系上下文清单及可回到环境映射页的明确入口。

用户界面使用“环境子类”，不把内部模型名“环境子类类型”直接暴露为主要业务文案；统计说明中可明确“唯一环境子类主数据”和“环境子类上下文”的差异。

### 6.2 交互与可用性门禁

- 三个分类默认收起，沿用安全能力清单的折叠、展开、搜索和表格样式 owner。
- 搜索命中折叠内容时自动展开到命中记录；清空搜索恢复用户操作前的折叠状态。
- 支持键盘聚焦、Enter/Space 展开、`aria-expanded`、可见焦点和非颜色唯一提示。
- 明确定义 loading、empty、missing package、API error、schema incompatible 五种状态，禁止用空白表格冒充“无数据”。
- 在共享 compact layout 下先进行表格局部横向滚动和内容换行，不新增第二套缩放。
- 关系链接必须带明确目标 ID；不得用首行、标题模糊匹配或默认对象代替用户选择。

### 6.3 产品验收样例

- `网络`：若P2裁定为同一语义，字典只出现一条并展开全部环境/上下文；若裁定为同名异义，则以不同编号、定义和上下文分别展示，不丢失原树位置。
- `PC终端操作系统`：信息化对象只出现一次，展开后能看到所有关联环境与子类上下文。
- 选择任一关系上下文后，环境映射页定位到同一 `environment_segment` / `information_object`，返回字典后保持原分类与搜索状态。
- 同名异义候选若未裁定，不合并展示为一条“已确认主数据”，而显示待确认状态并阻止正式 apply。

## 7. 实施阶段与门禁

采用 expand/contract 顺序，任何阶段失败都停在仍兼容旧运行时的状态：

| 阶段 | 工作 | 写入边界 | 完成门禁 |
|---|---|---|---|
| P0 合同冻结（已完成） | 冻结技术类型、UI名称、编号规则/清单格式、别名/状态、关系唯一性、API schema和统计口径 | 只写合同和测试 fixture | 定向合同审计通过；正式apply保持未授权 |
| P1 只读盘点（已完成） | 输出10/29/候选16/51/67台账、重复名称、现有 identity、来源、直接隶属、孤儿和用户引用命中 | 只读正式库和用户库；报告写 `data/exports/worker-verify` | 盘点完整；0 blocker；所有争议候选均有上下文证据 |
| P2 业务裁定、Dry-run 与导入修复（已完成） | 冻结正式编号/别名清单，生成 `instance_of`、关系保持、parser/staging匹配计划及二次重导反例 | 不写正式库 | 无 `merge_review` / `split_review` / `hold`；候选映射100%；同源二次导入新增0、错配0 |
| P3 临时库 apply/rollback 演练（已完成） | 在基础库副本执行事务性迁移并完整回退一次 | 只写临时副本和临时输出 | apply、重复 apply、候选包切换、精确回退和故障注入回退均通过 |
| P4 加法导出/API（已完成） | 生成影子 `environment-dictionary.json`、字典 API和 schema；旧树、拆分投影、底图保持 | 只写候选输出和代码 | 字典候选计数正确；旧树10/29/67；无 raw 字段泄漏 |
| P5 影子前端（已完成） | 新字典页面接入能力开关，默认仍可回退旧目录树 | shared runtime，不写正式数据 | 开关开/关、包缺失、API失败、schema不兼容均可用 |
| P6 正式 apply（已完成） | 暂停导入/MCP写者，生成恢复包后在正式基础库执行经验证的幂等迁移 | 用户已单独授权；只写正式基础库及P6证据 | 事务提交、重复执行0新增、保护基线、关系、用户引用和恢复包验证通过 |
| P7 受控切换与观察 | 开启字典能力开关；清理运行时缓存；Web、搜索、Dashboard、批注/收藏定位回归 | shared runtime | 观察期无回退触发；旧树 fallback 仍保留 |
| P8 发布回归 | App Runtime、离线数据包和导出回归 | 不自动构建 DMG | Web通过；App/DMG证据按发布矩阵另行完成 |

## 8. 代码所有者

预计涉及：

- 解析与对象候选：`src/sapd_wiki/parsers.py`
- staging 匹配与审批：`src/sapd_wiki/staging.py`
- 数据导出：`src/sapd_wiki/exports.py`
- CLI：`src/sapd_wiki/cli.py`
- API：`src/sapd_wiki/api_server.py`
- Local MCP只读查询兼容：`src/sapd_wiki/local_mcp/base_query_service.py`
- 数据客户端与 ViewModel：`frontend/capability-browser/dataClient.js`、`viewModels.js`
- 字典页面：`components/EnvironmentObjectDirectoryTable.js`
- 全局搜索、Dashboard统计和导出字段：按现有共享 owner 定向修改

新增脚本应拆为：

- 只读盘点/审计。
- dry-run 迁移计划生成器。
- 临时库 apply。
- 正式 apply，默认 dry-run，必须显式指定数据库、备份目录和 `--apply`。
- 回退与前后哈希/计数验证。

所有写脚本还必须具备：

- 明确的输入数据库绝对路径、期望 schema/version、迁移编号和运行 ID。
- 默认拒绝正式项目库；正式 apply 需要独立确认参数。
- 单事务 apply、幂等检测、并发写锁检查和失败自动 rollback。
- 逐对象/关系 before/after manifest，不依赖 `git reset`、`checkout` 或宽泛文件清理。

## 9. 验收矩阵

### 9.1 主数据

- 三类业务编号在各自类型内唯一且非空。
- `stable_ref`、`public_id` 覆盖率100%。
- 信息化环境10、环境子类主数据为P2裁定数且每个现有上下文恰好归属一条、信息化对象51；不得把16个同标题组当作强制数量或上限。
- 名称变更不改变身份；不存在按前端排序重新编号。
- 同名异义不自动合并，异名同义不自动创建第二条；待确认项为0后方可 apply。

### 9.2 关系

- 环境—子类上下文29不变。
- 环境—子类—对象上下文67不变。
- `instance_of` 准确29条。
- 每个 `environment_segment` 恰好一条 `instance_of`，重复 apply 后仍为29条。
- 所有关系 source/target 均能解析到主数据或保留的上下文实例。
- 原关系 ID、stable ref、来源证据和导出语义不变。
- `environment-workbench.json`、拆分 navigator/projections 和底图 node-details 的旧对象身份与导航定位不变。
- Local MCP 按新 stable ref 可读取子类主数据和 `instance_of`，既有类型分页/游标结果不变。

### 9.3 前端

- 字典页不重复展示主数据。
- 映射树结构、默认选中、搜索和节点定位无回归。
- Dashboard 不把16个类型、29个上下文和67条关系混为一个指标。
- 全局搜索能区分“字典主数据结果”和“环境映射上下文结果”。
- 主展示区不暴露 `sheet`、`row`、`column`、`raw_value`、`source_file`、`generated_at`。
- API/包加载失败时显示明确错误或旧目录 fallback，不出现空白页、假0条或无法恢复的折叠状态。
- 分类折叠、键盘操作、焦点、窄屏重排和关系深链通过定向浏览器/DOM验收。

### 9.4 数据安全

- 源 Excel 不修改。
- P6正式字典投影与P4影子包字节一致，已原位晋级；未替换旧环境树、拆分投影、底图或Dashboard包。
- 正式基础库已在P6授权下完成加法迁移；后续不得绕过新的独立授权再次执行正式写入。
- 用户数据库不修改；现有批注、收藏和 stable ref 可解析。
- 每次 apply 前生成可恢复 SQLite 备份、逻辑清单和 SHA-256。
- 正式 apply 期间无导入、MCP或其他数据库写者；用户库仅做只读哈希和引用命中验证。

## 10. 回退方案

### 10.1 回退原则

1. 正式迁移采用非破坏性 expand：新增子类主数据、只填充空业务编号、增加 `instance_of`；不覆盖既有非空编号，不删除29/67上下文，不改旧关系端点。
2. 前端开关、数据包、基础库分层回退。能只关开关解决的问题，不恢复数据库；能只恢复数据包解决的问题，不删除主数据。
3. SQLite apply 在单事务内完成；事务未提交时直接 rollback。事务已提交且数据语义错误时，优先原子恢复 apply 前热备份，不用逐行猜测删除。
4. 用户数据库不在本计划写入范围；任何用户库哈希变化都视为立即停止并进入事故恢复。
5. 禁止使用 `git reset --hard`、`git checkout --`、批量清理或宽泛递归删除执行回退。

### 10.2 apply 前恢复包

P6每次运行创建独立 `run_id` 恢复目录，至少保存：

- 基础库 SQLite hot backup、`PRAGMA integrity_check`、schema version、表计数和 SHA-256。
- 用户库只读备份或平台允许的热备份、表计数和 SHA-256；用于证明未修改。
- `environment-workbench.json`。
- 完整 `frontend/capability-browser/public/data/environment/` 目录清单与文件哈希。
- `environmentBasemap.node-details.json`。
- `analytics-summary.json`。
- 新旧字典包、API schema、编号分配清单、29条 `instance_of` 候选和原关系逐 ID/hash 清单。
- 当前功能开关值、运行时版本、Git HEAD和本计划允许改动文件清单。
- 当前 `git status`、计划允许文件的精确 diff/未跟踪文件清单；仅用于保留并发用户工作，不作为数据回退手段。

恢复包写入 `data/exports/worker-verify/plan-env-md/<run_id>/`，生成不可变 `manifest.json`；基础库、用户库、包文件和清单任一缺失或哈希失败时禁止 apply。

### 10.3 回退触发条件

出现任一情况立即停止切换：

- 10个环境、29个 segment 上下文、51个信息化对象或67个对象上下文出现非预期变化。
- `instance_of` 不是恰好29条、任一 segment 没有/有多条类型、出现孤儿端点。
- 任一旧关系 ID/stable ref/source evidence 丢失或变更。
- 任一旧用户 `target_ref`、收藏、Issue或批注无法解析，或用户库哈希变化。
- 环境树、拆分导航/详情、底图 node-details 的既有定位失败。
- 搜索出现主数据/上下文错误去重、错误跳转；Dashboard 把主数据和上下文计数混算。
- 字典页面出现空白页、假0条、schema不兼容未 fallback 或控制台未处理错误。
- App离线包与Web API/静态包版本不兼容。

### 10.4 按故障层级回退

| 故障层 | 例子 | 回退动作 | 基础库处理 |
|---|---|---|---|
| UI | 折叠、搜索、布局、深链错误 | 关闭字典能力开关，恢复旧目录树 | 保留已验证的加法迁移 |
| API/新字典包 | schema、字段、加载或缓存错误 | 下线新API/包，恢复旧包清单，清空受控运行时缓存 | 保留已验证的加法迁移 |
| 旧环境投影/底图/统计 | navigator、projection、node-details、analytics差异 | 从恢复包原子恢复对应文件并重启稳定预览 | 若DB审计通过则保留 |
| 基础库语义 | 错配、重复、缺失、旧关系变化 | 停止所有写者；原子恢复SQLite热备份；再恢复依赖包 | 恢复到apply前 |
| 用户引用/用户库 | target_ref失效或用户库发生写入 | 立即停止；恢复基础库和用户库备份；执行引用完整性审计 | 恢复到apply前 |

### 10.5 标准回退顺序

1. 冻结导入、MCP和API写入，不再生成新包。
2. 关闭字典能力开关，让用户界面立即回到旧目录树。
3. 按故障层恢复 `environment-workbench.json`、完整 `public/data/environment/`、node-details、analytics 等包；搜索索引是运行时派生缓存，只清理已声明的缓存键并让后端从恢复后的包重建，不伪造持久化搜索索引文件。
4. 若触发基础库回退，停止数据库连接后把热备份原子替换回正式路径，执行 `PRAGMA integrity_check` 和SHA-256核验。
5. 仅在用户库哈希变化或引用迁移实际发生时恢复用户库；正常回退不得碰用户库。
6. 启动稳定5173，验证home/health、旧环境树、拆分投影、底图、搜索、Dashboard、Issue/批注/收藏引用。
7. 输出回退报告，包含触发原因、恢复文件、前后哈希、计数、未恢复项；未经新授权不得再次 apply。

### 10.6 回退演练与保留

- P3必须在临时基础库和候选包上完成一次“apply → 重复apply → 开关切换 → 数据包回退 → SQLite回退”的完整演练。
- 回退演练后，临时库应与原副本的保护对象/旧关系哈希一致；新增项为0；用户库全程只读。
- P6执行前已确认工作区只有一个正式数据写者，并停止其他导入、MCP写操作和包替换。
- 恢复包至少保留到P8发布回归完成并由用户确认可归档；过期清理需单独列出精确目录，不自动执行。

## 11. 当前停止点

P0—P6已经完成。P6在停止5173与MCP写者、取得单写者锁并生成独立恢复包后，对正式基础库执行P2冻结计划：首次回填61个编号、新增16个 `environment_segment_type`、29条 `instance_of`、58条来源引用和106条迁移审计，重复执行新增全部为0；正式状态为10/16/51条主数据、29/67条上下文，旧7757条关系及保护文件保持。P6报告和恢复包位于 `data/exports/worker-verify/plan-env-md/p6-20260726T015418Z/`，含169个恢复文件、基础库和用户库热备份，均已完成完整性、外键与临时恢复验证。正式字典包与P4影子包字节一致；旧环境树、拆分投影、底图、Dashboard、源Excel及用户库未修改。

当前仍未授权：

- 开启P7正式能力开关或清理运行时缓存；
- 修改用户数据库；
- 替换旧环境树、拆分投影、底图或Dashboard包；
- 删除或归档P6恢复包；
- 构建或发布 DMG。

当前停止在P7受控切换门禁，`environmentMasterDictionary` 必须保持false。P7需要单独取得用户授权；如在此之前发现异常，按第10节关闭开关并从P6恢复包分层回退。
