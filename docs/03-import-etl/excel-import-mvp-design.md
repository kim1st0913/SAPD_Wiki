# Excel 导入 MVP 设计

本文档定义第一版 Excel 导入 MVP。目标是先把 5 个核心 Sheet 的主链路跑通，不一次性处理完整 26 个 Sheet。

当前实现状态：5 个核心 Sheet 的命令行导入链路已经跑通，包括来源登记、暂存、校验提示、审批入正式表和基础查询。后续仍需要补导出命令、前端页面和剩余 21 个 Sheet 的规则。

2026-07-19 后续治理：审批状态门禁、来源引用幂等、按 job 的验收后中间数据清理和默认导出只选择 approved 任务，以 `import-approval-idempotency-and-retention-contract.md` 为权威契约。四项能力当前状态为 `specified / not implemented`，不得把现有 MVP 链路表述为已具备重复审批防护或自动清理。

## 1. MVP 目标

第一版 Excel 导入要做到：

1. 读取 `wiki sample.xlsx`；
2. 识别 5 个核心 Sheet；
3. 根据映射规则生成对象和关系；
4. 生成导入预览；
5. 保留来源文件、Sheet、行号、单元格；
6. 用户确认后写入正式库；
7. 可导出导入结果。

## 2. MVP 不做什么

| 暂不做 | 原因 |
|---|---|
| 不一次性处理 26 个 Sheet | 先验证核心链路，避免范围失控 |
| 不解析 PPT 成章节 | 后续使用说明页面再做 |
| 不深度解析 Draw.io 节点关系 | 后续只读视图展示优先 |
| 不做复杂图谱可视化 | 关系先结构化保存 |
| 不做 AI/RAG | 数据和来源追踪稳定后再考虑 |
| 不自动覆盖人工修改 | 所有更新先进入导入预览 |

## 3. 输入和输出

### 输入

| 输入 | 说明 |
|---|---|
| Excel 文件 | `data/raw-samples/wiki sample.xlsx`，后续可换成用户选择文件 |
| 映射规则 | `docs/03-import-etl/mapping-rules-draft.md` |
| 字段字典 | `docs/02-data-model/field-dictionary-draft.md` |
| SQLite schema | `docs/02-data-model/sqlite-schema-design.md` |

### 输出

| 输出 | 说明 |
|---|---|
| import_job | 一次导入任务 |
| source_file | 来源文件记录 |
| staging_items | 待审查对象 |
| staging_relations | 待审查关系 |
| validation_report | 错误、冲突、待确认记录 |
| knowledge_items | 用户确认后的正式对象 |
| knowledge_relations | 用户确认后的正式关系 |
| source_references | 来源追踪 |

## 4. 第一批 Sheet 范围

| Sheet | 处理目标 |
|---|---|
| 安全能力目录 | 能力分类、L1、L2、关注点、层级关系 |
| 安全能力作用域目录 | 作用域 |
| 安全能力-安全技术服务 | 服务、服务-关注点、服务-作用域 |
| 安全技术模块清单 | 模块、系统、产品、模块-服务、模块-系统、模块-产品 |
| 作用域-安全技术服务-安全技术模块映射 | 环境、环境片区、信息化对象、场景关系 |

## 5. 导入流程

```text
选择 Excel 文件
→ 登记 source_file
→ 创建 import_job
→ 读取 workbook
→ 识别 5 个核心 Sheet
→ 按 Sheet 执行解析器
→ 执行清洗规则
→ 生成对象候选
→ 生成关系候选
→ 与正式库匹配去重
→ 写入 staging_items / staging_relations
→ 生成 validation_report
→ 用户审查
→ 写入 knowledge_items / knowledge_relations / source_references
→ 写入 change_logs
→ 导出与数据验收
→ 按 import_job 清理 staging / review 中间数据
```

## 6. 模块设计

### 6.1 file_registry 来源文件登记

职责：

- 接收 Excel 文件路径；
- 计算文件 hash；
- 判断文件是否已登记；
- 写入或复用 `source_files`；
- 创建 `import_jobs`。

关键规则：

- 同 hash 文件重复导入时提示用户；
- 同名但 hash 不同，视为新版本或重新导入；
- raw sample 文件仍不提交 GitHub。

### 6.2 workbook_reader 工作簿读取

职责：

- 打开 Excel；
- 获取 Sheet 清单；
- 校验 5 个核心 Sheet 是否存在；
- 提供按行读取接口。

失败处理：

| 错误 | 处理 |
|---|---|
| 文件不存在 | import_job 标记 failed |
| 文件无法打开 | import_job 标记 failed |
| 缺少核心 Sheet | validation_report 报错 |
| Sheet 名不一致 | 提示用户检查版本 |

### 6.3 sheet_parser Sheet 解析器

每个核心 Sheet 一个解析器。

| 解析器 | 处理 Sheet |
|---|---|
| capability_parser | 安全能力目录 |
| scope_parser | 安全能力作用域目录 |
| service_parser | 安全能力-安全技术服务 |
| module_parser | 安全技术模块清单 |
| scene_parser | 作用域-安全技术服务-安全技术模块映射 |

解析器输出统一格式：

```text
object_candidates[]
relation_candidates[]
validation_messages[]
```

### 6.4 transformer 清洗和转换

职责：

- `trim` 文本；
- `fill_down` 继承合并单元格语义；
- 忽略 `/`；
- 拆分编码和名称；
- 统一 `I_US` 到 `I-US`；
- 把宽表转成长表；
- 拆分多作用域。

### 6.5 matcher 匹配去重

职责：

- 根据对象类型选择去重键；
- 在当前导入批次内去重；
- 与正式库已有对象匹配；
- 判定 `create`、`update`、`skip`、`conflict`。

匹配优先级：

1. `type + code`；
2. `type + title`；
3. 规则定义的组合键；
4. 无法确定时标记为 `warning`。

### 6.6 staging_writer 暂存写入

职责：

- 写入 `staging_items`；
- 写入 `staging_relations`；
- 写入来源信息 JSON；
- 保存校验状态。

暂存记录不进入正式库，直到用户审查通过。

### 6.7 review_loader 审查入库

职责：

- 读取用户审查决策；
- 把 approve 的暂存对象写入 `knowledge_items`；
- 把 approve 的暂存关系写入 `knowledge_relations`；
- 写入 `source_references`；
- 写入 `change_logs`；
- 更新 import_job 状态。

审批只能从 `reviewing` 状态进入，同一 job 不得重复写入；来源引用必须按完整证据键幂等复用。详细状态、错误语义和验收矩阵见 `import-approval-idempotency-and-retention-contract.md`。

## 7. 解析规则摘要

### 7.1 安全能力目录

| 输入 | 输出 |
|---|---|
| 安全能力分类 | capability_category |
| L1 高阶战略能力 | capability_domain |
| L2安全能力 | capability |
| 序号、关注点、关注点描述 | capability_focus |

生成关系：

- L1 属于能力分类；
- L2 属于 L1；
- 关注点属于 L2。

### 7.2 安全能力作用域目录

| 输入 | 输出 |
|---|---|
| 情景 | scope_type.scenario |
| 作用域类型 | scope_type.code + title |
| 描述 | scope_type.description |

### 7.3 安全能力-安全技术服务

特殊处理：

- 这是宽表；
- 每个作用域列转成长表；
- 非空且非 `/` 的单元格生成服务；
- 服务连接能力关注点和作用域。

生成关系：

- 服务支撑关注点；
- 服务适用于作用域。

### 7.4 安全技术模块清单

特殊处理：

- 模块可能跨多行；
- 分类、系统、模块、定义、产品需要向下继承；
- 每行服务映射生成模块到服务关系。

生成关系：

- 模块属于安全系统；
- 模块实现技术服务；
- 模块对应产品。

### 7.5 作用域-安全技术服务-安全技术模块映射

特殊处理：

- 第 3 列命名为 `environment_segment`；
- 作用域可能多值；
- 服务和模块优先匹配已有对象，找不到则生成待确认对象。

生成关系：

- 环境片区属于信息化环境；
- 信息化对象属于环境片区；
- 信息化对象适用于作用域；
- 服务作用于信息化对象；
- 模块实现服务；
- 模块属于安全系统；
- 模块部署或适用于信息化环境。

## 8. 导入预览页面设计

第一版导入预览至少展示这些区域：

| 区域 | 内容 |
|---|---|
| 导入摘要 | 文件名、hash、Sheet 数、核心 Sheet 检测结果 |
| 对象统计 | 按对象类型展示 create、update、skip、conflict 数量 |
| 关系统计 | 按关系类型展示 create、skip、conflict 数量 |
| 错误列表 | 必填字段缺失、Sheet 缺失、无法解析 |
| 冲突列表 | 同编码不同标题、同模块不同定义 |
| 待确认列表 | 无法匹配已有服务、模块、系统的记录 |
| 来源预览 | Sheet、行号、单元格、原始值 |
| 操作按钮 | 全部通过、按类型通过、跳过、导出预览 |

## 9. 验收标准

MVP 完成时必须满足：

| 验收项 | 通过标准 |
|---|---|
| 文件登记 | 能写入 source_files，并计算 hash |
| 导入任务 | 能创建 import_job，并记录状态 |
| Sheet 识别 | 能识别 5 个核心 Sheet |
| 能力目录解析 | 能生成能力分类、L1、L2、关注点和层级关系 |
| 作用域解析 | 能生成作用域 |
| 服务解析 | 能从宽表生成服务和关系 |
| 模块解析 | 能生成模块、系统、产品和关系 |
| 场景解析 | 能生成环境、片区、对象和关系 |
| 来源追踪 | 每条对象和关系能追溯到 Sheet、行、列 |
| 暂存审查 | 不直接写入正式表，先进入 staging |
| 正式入库 | 审查通过后写入正式表 |
| 基础查询 | 能查看摘要、导入任务和对象列表 |
| 导出预览 | 能导出导入预览 CSV 或 JSON |

## 10. 后续扩展点

| 扩展 | 说明 |
|---|---|
| 第二批 Sheet | 管理流程、职能、岗位、生命周期 |
| 标准框架 Sheet | 等保、CSF、ISO、CIS、CRF、NIST |
| PPT 使用说明页 | 从 PPT 抽取页标题、正文和备注 |
| Draw.io 只读视图 | 保存页面名、节点数、边数和预览文件 |
| 前端导入向导 | 从命令式导入升级为页面操作 |
| 差异对比 | 同一文件新旧版本 diff |

## 11. 推荐开发顺序

| 顺序 | 工作 |
|---|---|
| 1 | 创建工程骨架和 SQLite migration |
| 2 | 实现 source_file 和 import_job |
| 3 | 实现 Excel workbook reader |
| 4 | 实现 5 个 Sheet parser |
| 5 | 实现 staging writer |
| 6 | 实现导入预览 CLI 或简单页面 |
| 7 | 实现审查通过入库 |
| 8 | 实现基础查询和导出 |
