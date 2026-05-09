# 非开发者使用 Codex 推进知识库项目的工作流

这份文档是给项目负责人使用的。你不需要自己写代码，也不需要一开始懂数据库。你的核心职责是提供样例资料、判断业务含义、确认字段和规则。Codex 负责把这些判断转成文档、配置、数据库和程序。

## 1. 你真正需要掌控的三件事

在开发前，你只需要逐步回答：

```text
1. 知识对象是什么？
2. 字段是什么？
3. 映射规则是什么？
```

只要这三件事清楚，后面的数据库、ETL、页面、导出都可以交给 Codex 逐步实现。

## 2. 推荐五周准备节奏

### 第 1 周：知识资产盘点

目标：知道有哪些文件，哪些值得优先结构化。

输出：

- `docs/sample-file-inventory.md`
- 后续可生成 `knowledge_asset_inventory.xlsx`

你要准备：

- 5 到 10 个代表性样例文件；
- 每个文件的用途；
- 哪些文件最重要；
- 哪些文件包含敏感信息，不能提交 GitHub。

可以对 Codex 说：

```text
请根据 docs/sample-file-inventory.md，帮我设计知识资产盘点表，并告诉我每个字段怎么填。
```

### 第 2 周：知识对象建模

目标：确定系统第一版管理哪些对象。

输出：

- `knowledge_objects.xlsx` 或等价 Markdown 表；
- 第一版知识对象清单。

优先考虑：

- Capability 能力项；
- Process 流程项；
- ArchitectureElement 架构元素；
- Control 控制措施；
- Risk 风险项；
- Indicator 指标项；
- SourceFile 来源文件；
- Relation 知识关系；
- Tag 标签。

可以对 Codex 说：

```text
请根据我提供的样例文件，提取候选知识对象，并按 V1 必须、V2 可选、暂缓 三类整理。
```

### 第 3 周：字段字典设计

目标：明确每类知识对象有哪些字段。

输出：

- `field_dictionary.xlsx` 或等价 Markdown 表；
- 通用字段和专属字段。

可以对 Codex 说：

```text
请根据 docs/data-dictionary-template.md，为这些知识对象生成字段字典，标明字段类型、是否必填、是否唯一、是否用于搜索筛选导出。
```

### 第 4 周：样本文件映射

目标：建立原始字段到标准字段的对应关系。

输出：

- `mapping_rules.xlsx` 或等价 Markdown 表；
- 第一批 Excel/DOCX/Markdown 映射规则。

可以对 Codex 说：

```text
请根据这个 Excel 样例和字段字典，生成 mapping_rules：原始字段、标准对象、标准字段、转换规则、是否必填、异常处理。
```

### 第 5 周：形成开发输入

目标：让 Codex 可以稳定开始写工程和 ETL。

开发输入至少包括：

- `docs/project-plan.md`
- `docs/sample-file-inventory.md`
- `docs/data-dictionary-template.md`
- `docs/import-rules.md`
- 5 到 10 个样例文件

可以对 Codex 说：

```text
请读取项目计划、字段字典、映射规则和样例文件，创建工程骨架并生成 SQLite schema。先不要做完整页面。
```

## 3. 每处理一个文件时问五个问题

```text
1. 这个文件里有什么知识对象？
2. 这些知识对象有哪些字段？
3. 哪些字段是系统标准字段？
4. 原始字段和标准字段怎么对应？
5. 这些知识对象和其他对象有什么关系？
```

如果这五个问题暂时答不清楚，就先把该文件作为附件或来源文件登记，不急着深度结构化。

## 4. Codex 任务拆分模板

### 任务 1：建立项目骨架

```text
请根据 docs/project-plan.md 建立本地结构化知识库系统工程骨架。
要求：
1. 使用 Tauri + React + SQLite；
2. 建立 docs、etl、config、data、packages、migrations、tests 等目录；
3. 创建 README 和 .gitignore；
4. 暂不实现复杂业务。
```

### 任务 2：根据字段字典生成数据库

```text
请读取字段字典和知识对象定义，生成 SQLite 数据库 schema。
要求：
1. 包含 knowledge_item、source_file、tag、relation、import_job、change_log 等通用表；
2. 针对 Capability、Risk、Process、ArchitectureElement、Indicator 生成扩展表；
3. 输出 migration SQL 文件和字段说明文档。
```

### 任务 3：实现 Excel ETL

```text
请根据 mapping_rules 实现 Excel 导入 ETL。
要求：
1. 读取指定 Excel；
2. 根据映射规则转换为标准知识对象；
3. 生成 source_file 和 source_location；
4. 检查必填字段；
5. 输出导入预览 JSON；
6. 暂不直接写入正式库，先进入 staging。
```

### 任务 4：实现导入审查

```text
请实现导入审查功能。
要求：
1. 显示 staging 中的待导入记录；
2. 标记新增、修改、重复、冲突；
3. 支持人工确认入库；
4. 入库时写入 change_log；
5. 冲突记录不得自动覆盖人工修改字段。
```

### 任务 5：实现基础页面

```text
请实现知识库基础页面。
要求：
1. 首页展示知识总数、来源文件数、最近更新；
2. 知识列表支持搜索、分类、标签筛选；
3. 知识详情页显示字段、来源、关联关系；
4. 来源文件页显示文件信息和导入记录；
5. 支持 CSV/JSON 导出。
```

## 5. 最小闭环

第一版只需要跑通：

```text
选样本文件
→ 识别知识对象
→ 设计字段
→ 建立映射规则
→ Codex 生成 ETL
→ 导入 SQLite
→ 页面展示
→ 查询和导出
```

不要一开始追求所有文件类型、所有页面和 AI 问答。先让一类 Excel 或 DOCX 完成闭环，系统就有了骨架。
