# 文件导入、字段映射与 ETL 规则

本文件定义多来源文件如何进入知识库。它是开发前必须先稳定的规则文件。

## 1. 导入原则

- 原始文件必须保留。
- 结构化数据必须保留来源文件、来源位置和导入任务。
- 自动导入不能静默覆盖人工编辑。
- 所有批量导入先进入暂存区或预览区。
- 只有用户确认后，数据才进入正式知识表。
- 失败记录、冲突记录和变更记录必须可查看。

## 2. 导入流程

```text
选择文件
→ 识别文件类型
→ 计算文件 hash
→ 提取内容
→ 清洗标准化
→ 字段映射
→ 数据校验
→ 进入暂存区
→ 用户审查
→ 写入正式库
→ 记录变更日志
```

## 3. 文件类型处理策略

| 文件类型 | V1 策略 | 后续增强 |
|---|---|---|
| Excel | 优先支持，按 sheet 和行生成知识条目 | 多 sheet 关系、复杂公式、合并单元格处理 |
| Markdown | 优先支持，按标题层级和段落解析 | 代码块、引用、表格结构化 |
| DOCX | 优先支持基础标题、段落、表格 | 图片、批注、脚注、复杂样式 |
| PPT | V1 可先登记来源和页级摘要 | 页内元素、备注、图示结构化 |
| Draw.io | V1 可先登记来源和基础 XML 信息 | 节点、连线、分组、关系抽取 |
| PDF | 暂缓 | OCR、页级解析、表格抽取 |

## 4. 映射规则结构

每条映射规则应包含：

| 字段 | 说明 |
|---|---|
| `rule_id` | 规则编号 |
| `source_type` | 文件类型，如 xlsx/docx/pptx/drawio |
| `source_pattern` | 文件名、sheet 名、标题模式等匹配条件 |
| `source_location` | 来源位置，如列名、标题级别、节点文本 |
| `target_object_type` | 目标知识对象类型 |
| `target_field` | 目标字段 |
| `transform` | 清洗或转换规则 |
| `required` | 是否必填 |
| `conflict_policy` | 冲突处理策略 |

## 5. Excel 映射示例

| 规则编号 | 文件匹配 | Sheet | 来源列 | 目标对象 | 目标字段 | 转换规则 | 必填 |
|---|---|---|---|---|---|---|---|
| XLSX-001 | `*能力*` | 能力清单 | 能力名称 | capability | title | trim | 是 |
| XLSX-002 | `*能力*` | 能力清单 | 一级分类 | capability | category | map_category | 否 |
| XLSX-003 | `*能力*` | 能力清单 | 标签 | capability | tags | split_by_comma | 否 |
| XLSX-004 | `*能力*` | 能力清单 | 成熟度 | capability | maturity_level | normalize_level | 否 |
| XLSX-005 | `*能力*` | 能力清单 | 说明 | capability | content | keep_text | 否 |

## 5.1 安全能力成熟度评估表示例

一个 Excel 行不一定只生成一个对象。比如“安全能力成熟度评估表.xlsx”可以拆成能力项、指标项、评估结果、改进任务和关系。

原始字段：

```text
一级域
二级能力
能力说明
评分标准
当前得分
目标得分
改进建议
```

字段映射：

| 原始字段 | 标准对象 | 标准字段 | 处理规则 |
|---|---|---|---|
| 一级域 | Capability | capability_domain | 映射到标准能力域 |
| 二级能力 | Capability | capability_name | 作为能力标题 |
| 能力说明 | Capability | description | 保留原文 |
| 评分标准 | Indicator | scoring_criteria | 生成指标项 |
| 当前得分 | AssessmentResult | current_score | 转为数字 |
| 目标得分 | AssessmentResult | target_score | 转为数字 |
| 改进建议 | ImprovementTask | recommendation | 生成改进任务候选 |

关系生成：

| 起点 | 关系 | 终点 |
|---|---|---|
| 能力项 | 属于 | 能力域 |
| 指标项 | 评估 | 能力项 |
| 评估结果 | 对应 | 指标项 |
| 改进任务 | 改进 | 能力项 |

## 6. DOCX / Markdown 映射示例

| 规则编号 | 来源结构 | 目标对象 | 目标字段 | 转换规则 | 说明 |
|---|---|---|---|---|---|
| DOC-001 | 一级标题 | methodology | title | trim | 章节标题作为方法论标题 |
| DOC-002 | 一级标题下正文 | methodology | content | merge_paragraphs | 合并正文段落 |
| DOC-003 | 表格第一列 | control | title | trim | 每行生成控制措施 |
| DOC-004 | 表格第二列 | control | summary | keep_text | 控制措施说明 |
| MD-001 | `#` 标题 | methodology | title | trim | 一级标题 |
| MD-002 | `##` 标题 | knowledge_item | title | trim | 二级知识点 |

## 7. PPT 映射示例

| 规则编号 | 来源结构 | 目标对象 | 目标字段 | 转换规则 | V1 是否实现 |
|---|---|---|---|---|---|
| PPT-001 | 文件名 | knowledge_source | file_name | keep_text | 是 |
| PPT-002 | 页标题 | slide_item | title | trim | 后续 |
| PPT-003 | 页面要点 | slide_item | content | merge_bullets | 后续 |
| PPT-004 | 备注 | slide_item | note | keep_text | 后续 |

## 8. Draw.io 映射示例

| 规则编号 | 来源结构 | 目标对象 | 目标字段 | 转换规则 | V1 是否实现 |
|---|---|---|---|---|---|
| DRAW-001 | 文件名 | knowledge_source | file_name | keep_text | 是 |
| DRAW-002 | 节点文本 | architecture_element | title | trim | 后续 |
| DRAW-003 | 节点形状 | architecture_element | type | infer_shape_type | 后续 |
| DRAW-004 | 连线 | knowledge_relation | relation_type | default_relation | 后续 |
| DRAW-005 | 连线标签 | knowledge_relation | note | keep_text | 后续 |

## 9. 清洗和标准化规则

| 规则名 | 作用 | 示例 |
|---|---|---|
| `trim` | 去掉前后空格 | `" 资产 "` → `"资产"` |
| `split_by_comma` | 拆分多值 | `"资产,基线"` → `["资产", "基线"]` |
| `normalize_level` | 标准化等级 | `"一级"` → `"L1"` |
| `map_category` | 映射标准分类 | `"安全运营"` → `"security_operations"` |
| `keep_text` | 保留原文本 | 不改动 |
| `merge_paragraphs` | 合并连续段落 | 多段正文合并 |
| `generate_id` | 自动生成编号 | 空能力编号 → CAP-0001 |
| `strip_html` | 清理 HTML 标签 | Draw.io value 清理 |
| `infer_type_by_keyword` | 根据关键词推断类型 | 标题含“风险” → risk |

## 10. 数据校验规则

| 校验项 | 规则 | 失败处理 |
|---|---|---|
| 标题 | `title` 不能为空 | 进入错误列表 |
| 类型 | `type` 必须在知识对象类型清单中 | 进入错误列表 |
| 来源 | 必须有 `source_file_id` | 阻止入库 |
| 重复 | 同来源同位置重复 | 提示重复 |
| 标签 | 多值标签不能为空字符串 | 自动清理 |
| 枚举 | 等级、状态必须在允许值内 | 进入待审核 |

## 11. 冲突处理规则

| 冲突场景 | 处理策略 |
|---|---|
| 自动导入修改人工编辑字段 | 保留人工字段，自动内容进入待审核 |
| 同一来源文件重新导入字段变化 | 生成 diff，由用户确认 |
| 不同来源产生相同标题 | 提示可能重复，不自动合并 |
| 来源文件 hash 未变化 | 跳过重复导入 |
| 来源文件被删除 | 标记来源失效，不删除知识条目 |

## 12. V1 最小导入验收标准

第一版导入功能只要做到：

- 能选择一个 Excel 文件；
- 能识别一个指定 Sheet；
- 能按映射规则把每行变成知识条目；
- 能记录来源文件、hash、sheet、行号；
- 能发现标题为空的错误；
- 能先进入导入预览；
- 用户确认后写入 SQLite；
- 能导出导入结果为 CSV/JSON。
