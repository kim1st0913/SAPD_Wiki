# CIS Controls v8.1.2 与原始数据表 `CIS CSC V8` 页比对结果

生成日期：2026-05-18

## 1. 输入文件

| 类型 | 文件 / 工作表 |
|---|---|
| 官方 v8.1.2 Excel | `/Users/kim1st/Documents/work@qax/01.战略咨询规划部/技术架构组/安全规划方法论设计研究/架构参考材料/网络安全框架材料/CIS CSC/V8.1/20260518/CIS_Controls_Version_8.1.2___March_2025.xlsx` / `Controls v8.1.2` |
| 项目原始数据表 | `data/raw-samples/wiki sample.xlsx` / `CIS CSC V8` |

说明：本报告基于 2026-05-18 复核后的原始表状态。原始表当前已有 `安全功能` 列，位置为 `I` 列；`描述` 位于 `J` 列。

## 2. 总体结论

- 两边都包含 153 个 Safeguard，编号集合完全一致，未发现新增或缺失的 Safeguard。
- `Implementation Group` 最低实施组完全一致：IG1 为 56 条、IG2 为 74 条、IG3 为 23 条。
- 原始表已有 `安全功能` 字段，但本轮处理前 `I3:I155` 为空；已按官方 v8.1.2 填入 153 条 `Security Function`。
- 原始表的 `资产类型` 与 v8.1.2 `Asset Class` 已完全一致。
- 原始表的 `1.1`、`17.5` 明显错位问题已不再存在；`17.5` 当前语义已正确，但建议补全官方的审查频率表述。
- 原始表此前存在若干 v8.1.2 文案增强未完全体现在中文描述中的问题；本轮已按第 5 节建议写回 6 条描述。

## 3. 结构比对

### 3.1 字段结构

| 项目 | 官方 v8.1.2 | 原始数据表 `CIS CSC V8` | 影响 |
|---|---|---|---|
| Control 编号 | `CIS Control` | `安全控制项` | 可对齐 |
| Control 名称 | `Title` 的 Control 行 | `安全控制项名称` | 可作为中文显示名，但需版本标注 |
| Control 描述 | `Description` 的 Control 行 | `控制项描述` | 可作为中文描述，但需核对版本 |
| Safeguard 编号 | `CIS Safeguard` | `保护措施编号` | 完全对齐 |
| Safeguard 名称 | `Title` | `名称` | 可作为中文显示名 |
| Asset Class | `Asset Class` | `资产类型` | 复核后已完全一致 |
| Security Function | `Security Function` | `安全功能` | 本轮已从 `I3` 开始填入官方 v8.1.2 值 |
| Implementation Group | `IG1` / `IG2` / `IG3` 标记 | `实施组` 单列 | 可转换为最低实施组 |
| Safeguard 描述 | `Description` | `描述` | 本轮已补齐第 5 节识别的 v8.1.2 文案增强 |

### 3.2 数量与分布

| 统计项 | 官方 v8.1.2 | 原始表 `CIS CSC V8` | 结论 |
|---|---:|---:|---|
| Safeguard 数量 | 153 | 153 | 一致 |
| 编号缺失 | 0 | 0 | 一致 |
| 额外编号 | 0 | 0 | 一致 |
| IG1 最低实施组 | 56 | 56 | 一致 |
| IG2 最低实施组 | 74 | 74 | 一致 |
| IG3 最低实施组 | 23 | 23 | 一致 |

Asset Class / 资产类型分布：

| 分类 | 官方 v8.1.2 | 原始表 | 差异说明 |
|---|---:|---:|---|
| Devices / 设备 | 25 | 25 | 一致 |
| Software / 软件 | 24 | 24 | 一致 |
| Data / 数据 | 32 | 32 | 一致 |
| Network / 网络 | 23 | 23 | 一致 |
| Users / 用户 | 29 | 29 | 一致 |
| Documentation / 文档 | 20 | 20 | 一致 |

### 3.3 Security Function 填充结果

| Security Function | 条数 |
|---|---:|
| Protect | 78 |
| Govern | 25 |
| Detect | 24 |
| Identify | 14 |
| Respond | 6 |
| Recover | 6 |

## 4. 资产类型不一致清单

2026-05-18 复核后，未发现资产类型不一致。`8.4` 已为 `网络`，`9.3` 已为 `网络`。

## 5. v8.1.2 关键变化在原始表中的状态

下表聚焦上一轮 v8.1 -> v8.1.2 比对中识别出的变化点，检查原始 `CIS CSC V8` 页是否已经体现。

| Safeguard | v8.1.2 变化点 | 原始表状态 | 建议 |
|---|---|---|---|
| 2.1 | 描述新增 `number of licenses` | 已修订 | 已把“部署机制和停用日期”改为“部署机制、停用日期和许可证数量” |
| 2.7 | 描述标点 / 示例修正 | 原始中文语义基本可用 | 可保留 |
| 5.1 | `administrator accounts` 调整为 `administrator` | 原始中文语义基本可用 | 可保留 |
| 8.4 | Asset Class 从 Data 调整为 Network | 原始表已为 `网络` | 已体现 |
| 8.9 | 示例措辞加入 `primarily` | 已修订 | 已把“实施实例包括”改为“实施实例主要包括” |
| 11.1 | 描述新增 `includes detailed backup procedures` | 已修订 | 已把“成文的数据恢复流程”改为“包含详细备份程序的成文数据恢复流程” |
| 12.1 | `network as a service` 术语格式修正 | 原始中文为“网络即服务（NaaS）” | 可保留 |
| 12.2 | 示例措辞改为 `may include documentation, policy, and design components` | 已修订 | 已把“实施范例不仅包括文档，还包括政策和设计组件”改为“实施范例可包括文档、政策和设计组件” |
| 12.6 | 描述重写，区分网络管理协议和通信协议 | 已修订 | 已整句替换为“采用安全的网络管理协议（如 802.1X）和安全通信协议（如 Wi-Fi Protected Access 2 (WPA2) Enterprise 或更安全的替代方案）。” |
| 16.2 | 标点修正 | 原始中文语义基本可用 | 可保留 |
| 16.3 | Security Function 调整为 Detect | 本轮已填 `Detect` | 已体现 |
| 16.11 | Security Function 调整为 Protect；描述标点修正 | 本轮已填 `Protect`，中文描述基本可用 | 已体现 |
| 16.13 | Security Function 调整为 Detect | 本轮已填 `Detect` | 已体现 |
| 17.2 | `service vendors` 调整为 `service providers` | 原始中文已使用“服务供应商” | 已体现 |
| 17.3 | 语法修正 | 原始中文语义基本可用 | 可保留 |
| 17.5 | 描述增加 / 明确相关第三方和角色范围，并要求定期审查 | 已修订 | 已把“并定期审查”改为“每年审查一次，或在企业发生可能影响本保障措施的重大变化时进行审查” |

## 6. 原始表疑似数据质量问题

复核后，`1.1` 描述、`17.5` 描述、`8.4` 资产类型、`9.3` 资产类型均已不再是阻塞性错位问题。

第 5 节列出的 6 条中文描述已写回原始表：`2.1`、`8.9`、`11.1`、`12.2`、`12.6`、`17.5`。

## 7. 对 SAPD Wiki 导入的建议

1. 原始表现在已经具备 v8.1.2 关键结构字段：编号、资产类型、最低实施组、安全功能。
2. 第 5 节列出的 6 条中文描述已经修订；正式导入前建议再做一次人工抽查。
3. 如需保留原始中文，应将其作为中文翻译 / 本地整理字段，并与官方 v8.1.2 英文字段分开保存。
4. 若后续要同时支持中文和英文，建议以官方 v8.1.2 的 `control_id + safeguard_id` 作为主键，以原始表中文内容作为 `zh_title`、`zh_description`，并记录 `translation_source_file_id`。
