# CRF 2026 导入投影说明

本文档记录 `CRF Safeguards Core Edition v2026` 与 `CRF Maturity Model v2026` 的投影与入库口径。2026-05-19 已按用户确认将投影数据写入原始工作簿并导入标准/框架数据包。

## 输出文件

- `data/processed/crf/crf-2026-projection-review.xlsx`
- `data/raw-samples/wiki sample.xlsx` / `CRF Safeguards Core 2026`
- `data/raw-samples/wiki sample.xlsx` / `CRF Maturity Model 2026`

入库前原始工作簿备份：

- `data/raw-samples/backups/wiki sample.before-crf-2026-sheets-20260519-160759.xlsx`

## 投影结构

投影工作簿包含 4 个 sheet：

| Sheet | 说明 | 行数 |
|---|---|---:|
| `CRF Safeguards Core 2026` | 未来标准/框架页主展示数据，按用户要求使用中文字段和中文翻译 | 476 |
| `CRF Maturity Model 2026` | CRF 成熟度模型 5 级定义展示数据 | 5 |
| `翻译复核清单` | 翻译来源、2026 英文原文、2024 中文参考和待复核状态 | 476 |
| `导入说明` | 数据源、生成时间和导入注意事项 | 6 |

## CRF Safeguards Core 2026 字段

| 展示字段 | 2026 来源字段 | 处理口径 |
|---|---|---|
| `保障措施分类` | `Safeguard Category` | 翻译为 `中文（English）` |
| `保障措施域` | `Safeguard Domain` | 翻译为 `中文（English）` |
| `CRF成熟度等级` | `Level` | 翻译为 `中文（English Level n）` |
| `Safeguard ID` | `Safeguard ID` | 保持原值，不翻译 |
| `保障措施描述` | `Safeguard Description` | 中文描述；共同 ID 优先复用当前原始 `CRF` sheet 的中文描述，2026 新增 ID 先做机器初译 |
| `保障措施系统` | `Safeguard System` | 翻译为 `中文（English）` |
| `关联安全能力/关注点` | 无 | 预留空列，后续映射处理 |

## CRF Maturity Model 2026 字段

| 展示字段 | 处理口径 |
|---|---|
| `等级编号` | `Level 1` 至 `Level 5` |
| `成熟度等级` | 基础级、卫生级、治理级、受控级、监测级 |
| `英文等级` | Foundational、Hygiene、Governed、Controlled、Monitored |
| `等级定义` | 从 `CRF-Maturity-Model-v2026.pdf` 对应等级章节提炼并翻译 |
| `高层特征` | 从每级 high-level characteristics 提炼并翻译 |
| `边界说明` | 从每级 `does not imply` 或等价说明提炼并翻译 |

## 翻译复核状态

| 状态 | 数量 | 说明 |
|---|---:|---|
| 复用 2024 中文翻译 | 427 | 2026 与当前原始 `CRF` sheet 共有的 Safeguard ID |
| 2026 新增机器初译 | 49 | `AI-*`、`SDO-*`、新增 `SDM-*` / `SDV-*` 控制项 |

共同 ID 中，若 2026 英文描述相对 2024 英文描述发生变化，已在 `翻译复核清单` 的 `处理状态` 中标注 `2026英文描述变化，需复核`，后续正式入库前建议优先确认这些项。

## 入库状态

- staging job：`8cff3da9-29aa-4631-96d6-a927e1e18737`
- staging 结果：`standard_control=476`、`standard_framework=2`、`standard_tier=5`、`belongs_to_framework=481`，`validations=[]`
- approve 结果：`items_created=483`、`relations_created=481`、`source_references_created=964`，`warnings=[]`
- approve 前数据库备份：`data/database/backups/sapd_wiki-before-crf-2026-import-20260519-161452.sqlite3`
- 前端数据包：已重新导出 `frontend/capability-browser/public/data/standards-data.json`

2026-05-19 补充修正：

- 按用户要求，`CRF Safeguards Core 2026` sheet 已重排为严格跟随官方 `CRF-Safeguards-Core-Edition-v2026-1.xlsx` 的 Safeguard ID 顺序。
- 重排前原始工作簿备份：`data/raw-samples/backups/wiki sample.before-crf-core-order-fix-20260519-163112.xlsx`
- 重排后 staging job：`6a0d844a-d199-4948-a416-5734576adbbe`
- approve 结果：`items_updated=483`、`items_created=0`、`warnings=[]`
- approve 前数据库备份：`data/database/backups/sapd_wiki-before-crf-core-order-fix-20260519-163356.sqlite3`
- 前端 tab 标题已调整为 `Core` 和 `成熟度`。
- 验证结果：原始 sheet 顺序与官方 CRF 2026 Excel 一致，导出后的 `standards-data.json` 中 Core tab 顺序也与官方一致。

## 后续页面建议

1. `/standards/crf` 已导出为双 tab：
   - `Core`
   - `成熟度`
2. 前端复用当前 `StandardFrameworkTable`，按 `保障措施分类 / 保障措施域` 两级汇总展示 Safeguards tab。
3. `翻译复核清单` 不进入主展示区，后续如需修订翻译，应先改原始工作簿中的 `CRF Safeguards Core 2026` sheet，再重新 staging / approve / export。

## 字段边界

主展示 sheet 不包含以下非业务字段：

- `sheet`
- `row`
- `column`
- `raw_value`
- `source_file`
- `import_id`
- `source_id`
- `source_ref`
- `source_label`
- `debug`
- `raw`
- `metadata`
- `intermediate`
- `generated_at`
