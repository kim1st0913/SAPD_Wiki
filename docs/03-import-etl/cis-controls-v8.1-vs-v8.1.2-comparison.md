# CIS Controls v8.1 与 v8.1.2 文件比对结果

生成日期：2026-05-18

## 1. 输入文件

| 类型 | v8.1 文件 | v8.1.2 文件 |
|---|---|---|
| Excel | `/Users/kim1st/Documents/work@qax/01.战略咨询规划部/技术架构组/安全规划方法论设计研究/架构参考材料/网络安全框架材料/CIS CSC/V8.1/20240624/CIS_Controls_Version_8.1_Change_Log_2024_06_24_Final_Revised__1_.xlsx` | `/Users/kim1st/Documents/work@qax/01.战略咨询规划部/技术架构组/安全规划方法论设计研究/架构参考材料/网络安全框架材料/CIS CSC/V8.1/20260518/CIS_Controls_Version_8.1.2___March_2025.xlsx` |
| PDF | `/Users/kim1st/Documents/work@qax/01.战略咨询规划部/技术架构组/安全规划方法论设计研究/架构参考材料/网络安全框架材料/CIS CSC/V8.1/20240624/CIS_Controls__v8.1_Guide__2024_0801.pdf` | `/Users/kim1st/Documents/work@qax/01.战略咨询规划部/技术架构组/安全规划方法论设计研究/架构参考材料/网络安全框架材料/CIS CSC/V8.1/20260518/CIS_Controls_Guide_v8.1.2_0325_v2.pdf` |

说明：本报告只比较文件内容，不修改原始 CIS 文件。Excel 以核心控制清单工作表为主，PDF 以正文抽取和 v8.1.2 内置 Change Log 交叉核对。

## 2. 总体结论

- Excel 层面：`Controls v8.1` 与 `Controls v8.1.2` 均包含 18 个 Control、153 个 Safeguard；未发现 Safeguard 新增或删除。
- Excel 层面：共发现 16 个 Safeguard 存在字段级变化，主要是描述勘误、Asset Class 调整、Security Function 调整。
- PDF 层面：v8.1 PDF 为 144 页，v8.1.2 PDF 为 146 页；v8.1.2 新增 `Change Log` 页，并导致后续 Glossary / Index 页码后移。
- PDF 层面：v8.1.2 官方 Change Log 说明变更类型包括 Asset Class / Glossary 小错修正、全文件链接更新、Security Function 勘误，以及若干 Safeguard 文案勘误。
- 重要口径差异：给定的 v8.1 Excel 是 2024-06-24 change log workbook，而 v8.1 PDF 是 2024-08-01 guide。两者不是完全同一天发布物，所以部分 Excel 差异在 v8.1 PDF 中已经体现，不能简单认为“Excel 差异 = PDF 差异”。

## 3. Excel 比对结果

### 3.1 Workbook 结构变化

| 项目 | v8.1 Excel | v8.1.2 Excel |
|---|---:|---:|
| 工作表数量 | 10 | 5 |
| 核心控制清单工作表 | `Controls v8.1` | `Controls v8.1.2` |
| 核心清单列数 | 12 | 9 |
| 核心清单行数 | 6637，实际有效控制数据为 18 个 Control + 153 个 Safeguard，其余主要为空白 / 格式行 | 172，包含表头、18 个 Control 行、153 个 Safeguard 行 |

v8.1 Excel 额外包含以下变更日志类工作表，v8.1.2 Excel 中未保留：

- `Security Function Changes Only`
- `Asset Class Methodology`
- `Asset Class Changes Only`
- `Safeguard Description Changes`
- `Glossary Updates`

v8.1.2 Excel 核心清单字段更精简：

- `Asset Type v8.1` 更名为 `Asset Class`
- `Security Function v8.1` 更名为 `Security Function`
- `Description v8.1` 更名为 `Description`
- 移除了 `Asset Type v8`、`Security Function v8`、`Description v8` 三个历史对照列

### 3.2 汇总统计变化

| 统计项 | v8.1 Excel | v8.1.2 Excel | 变化 |
|---|---:|---:|---|
| Control 数量 | 18 | 18 | 不变 |
| Safeguard 数量 | 153 | 153 | 不变 |
| 新增 Safeguard | 0 | 0 | 不变 |
| 删除 Safeguard | 0 | 0 | 不变 |
| 有字段变化的 Safeguard | - | 16 | 见下表 |

Asset Class 分布变化：

| Asset Class | v8.1 | v8.1.2 | 差异 |
|---|---:|---:|---:|
| Data | 33 | 32 | -1 |
| Network | 22 | 23 | +1 |
| Users | 29 | 29 | 0 |
| Devices | 25 | 25 | 0 |
| Software | 24 | 24 | 0 |
| Documentation | 20 | 20 | 0 |

Security Function 分布变化：

| Security Function | v8.1 | v8.1.2 | 差异 |
|---|---:|---:|---:|
| Detect | 22 | 24 | +2 |
| Govern | 26 | 25 | -1 |
| Identify | 15 | 14 | -1 |
| Protect | 78 | 78 | 0 |
| Respond | 6 | 6 | 0 |
| Recover | 6 | 6 | 0 |

### 3.3 Safeguard 字段级变化清单

| Safeguard | 字段 | v8.1 | v8.1.2 | 影响判断 |
|---|---|---|---|---|
| 2.1 | Description | 软件清单字段包括 `decommission date` | 调整为 `decommission date, and number of licenses` | 增加许可证数量要求，应影响字段字典 / 控制项细粒度解析 |
| 2.7 | Description | `.ps1, and .py files` | `.ps1 and .py files,` | 文案标点修正 |
| 5.1 | Description | `user, administrator accounts, and service accounts` | `user, administrator, and service accounts` | 文案语法修正 |
| 8.4 | Asset Class | Data | Network | 资产类别实质变化，应更新映射 |
| 8.9 | Description | `Example implementations include...` | `Example implementations primarily include...` | 示例措辞收窄 |
| 11.1 | Description | `documented data recovery process` | 增加 `that includes detailed backup procedures` | 增加备份程序细节要求 |
| 12.1 | Description | `network-as-a-service` | `network as a service` | 术语格式修正 |
| 12.2 | Description | `will not solely include documentation, but also...` | `may include documentation, policy, and design components` | 示例措辞简化 |
| 12.6 | Description | `Use secure network management and communication protocols... or greater` | `Adopt secure network management protocols... and secure communication protocols... or more secure alternatives` | 描述重写，语义更清晰 |
| 16.2 | Description | `severity ratings, and metrics` | `severity ratings and metrics` | 标点修正 |
| 16.3 | Security Function | Protect | Detect | 安全功能分类实质变化，应更新映射 |
| 16.11 | Security Function | Identify | Protect | 安全功能分类实质变化，应更新映射 |
| 16.11 | Description | `encryption, and auditing and logging` | `encryption, auditing, and logging` | 文案修正 |
| 16.13 | Security Function | Govern | Detect | 安全功能分类实质变化，应更新映射 |
| 17.2 | Description | `service vendors` | `service providers` | 术语修正 |
| 17.3 | Description | `an documented enterprise process` | `a documented enterprise process` | 语法修正 |
| 17.5 | Description | 包含 `legal, IT, information security, facilities, public relations, human resources, incident responders, and analysts` | 调整为 `incident responders, analysts, and relevant third parties` 前保留上述角色并补充 `relevant third parties` | 角色范围调整，应作为内容更新 |

## 4. PDF 比对结果

### 4.1 文件结构变化

| 项目 | v8.1 PDF | v8.1.2 PDF |
|---|---:|---:|
| 封面版本 | Version 8.1 August 2024 | Version 8.1 March 2025 / 文档页眉为 v8.1.2 |
| 页数 | 144 | 146 |
| Change Log | 无单独 Change Log 页 | 新增 `Change Log`，位于 Appendix A3 |
| Glossary 起始位置 | Appendix A3 | Appendix A4 |
| Controls and Safeguards Index 起始位置 | A8 附近 | A10 附近 |

v8.1.2 PDF 新增的 Change Log 页说明两次 minor release：`v8.1.1 - August 2024` 与 `v8.1.2 - March 2025`，带来的变化包括：

- Asset Class section 与 Glossary 的小错修正；
- 全文 hyperlink 更新，指向新版 CIS Controls Resources 网页；
- Security Function 勘误：Safeguard 16.11 调整为 `Protect`，Safeguard 16.13 调整为 `Detect`；
- Safeguard 5.1、8.9、11.1、16.11、17.5 的小文案修正。

### 4.2 PDF 中可确认的正文 / 元数据变化

| 位置 | 变化类型 | v8.1 PDF | v8.1.2 PDF | 备注 |
|---|---|---|---|---|
| 封面 | 版本与日期 | Version 8.1 August 2024 | Version 8.1 March 2025 / v8.1.2 | 版本页眉全篇更新为 v8.1.2 |
| Appendix | 新增页面 | 无 Change Log | 新增 Change Log | 导致后续附录页码后移 |
| 多处资源链接 | hyperlink | 多处指向 `/controls/v8/` 或旧 white paper URL | 多处更新为 `/controls/resources?crc=environment-specific-guidance` | 主要是资源入口统一 |
| Glossary | 结构 / 勘误 | Glossary 从 A3 开始 | Change Log 插入后 Glossary 从 A4 开始 | 还包含术语页局部措辞修正 |
| Safeguard 5.1 | 文案 | `administrator accounts` | `administrator` | 语法修正 |
| Safeguard 8.4 | Asset Type | Data | Network | 正文中可确认 |
| Safeguard 8.9 | 文案 | `Example implementations include...` | `Example implementations primarily include...` | 正文中可确认 |
| Safeguard 8.10-8.12 | 标题抽取 | 标题中出现 `8.` 前缀，如 `8.Retain Audit Logs` | 去除多余 `8.` 前缀 | PDF 文本抽取可见，属于排版 / 文本勘误 |
| Safeguard 11.1 | 文案 | `documented data recovery process` | 增加 `includes detailed backup procedures` | 正文中可确认 |
| Safeguard 12.6 | 文案 | `Use secure network management and communication protocols...` | `Adopt secure network management protocols... and secure communication protocols...` | 正文中可确认，v8.1.2 描述更明确 |
| Safeguard 16.11 | Security Function | Identify | Protect | 正文中可确认 |
| Safeguard 16.11 | 文案 | `encryption, and auditing and logging` | `encryption, auditing, and logging` | 正文中可确认 |
| Safeguard 17.5 | 文案 | `incident responders, analysts, and relevant third parties` 或正文处较短角色清单 | 增加 / 明确 `legal, IT, information security, facilities, public relations, human resources, incident responders, analysts, and relevant third parties` | 正文和索引处可确认 |

### 4.3 Excel 与 PDF 口径差异

| 差异点 | 观察结果 | 处理建议 |
|---|---|---|
| v8.1 Excel 与 v8.1 PDF 发布时间不同 | Excel 文件为 2024-06-24 change log workbook；PDF 文件为 2024-08-01 guide | 做知识库导入时应把两份文件作为不同 source version 记录，不要强行合并为同一基线 |
| 2.1、2.7、12.1、12.2、16.2、17.2、17.3 等变化 | 在 Excel v8.1 -> v8.1.2 中可见；但 v8.1 PDF 中部分内容已经是修正后的表述 | 如果以 PDF 为准，这些不一定是 v8.1 PDF -> v8.1.2 PDF 的新增变化 |
| 16.13 Security Function | Excel 显示 v8.1 为 `Govern`、v8.1.2 为 `Detect`；v8.1.2 PDF Change Log 也声明 16.13 应为 `Detect`；但给定 v8.1 PDF 正文抽取已显示 `Detect` | 说明 v8.1 PDF 可能已经包含该修正，导入时应记录来源文件版本和发布日期 |
| 16.3 Security Function | Excel 显示 v8.1 为 `Protect`、v8.1.2 为 `Detect`；PDF 正文也可见 8.1 为 `Protect`、8.1.2 为 `Detect`，但 v8.1.2 Change Log 未点名 16.3 | 建议在正式导入前人工确认 CIS 官方是否还有对应 release note 或 workbook 更正 |

## 5. 对 SAPD Wiki 导入 / 建模的建议

1. 若后续要把 CIS Controls 纳入知识库，建议以 `control_id + safeguard_id + source_version + source_file_id` 作为稳定来源键，避免 v8.1 Excel 与 v8.1 PDF 发布口径不同导致覆盖。
2. `Asset Class`、`Security Function` 应作为结构化字段导入；本轮变化中 `8.4`、`16.3`、`16.11`、`16.13` 属于高优先级映射变化。
3. Safeguard 描述应保留 versioned text，不建议只保留最新版文本；否则无法解释 v8.1 到 v8.1.2 的差异。
4. PDF 的 Change Log 可以作为来源证据单独入库，连接到受影响 Safeguard。
5. 本轮仅完成比对报告，未生成正式 ETL 映射、未写入数据库、未更新前端数据包。
