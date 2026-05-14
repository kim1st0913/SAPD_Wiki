# Sheet Review 2.2 数据核对报告

生成时间：2026-05-13T22:37:06

## 检查结论摘要

| 检查项 | 结果 | 判断 |
|---|---:|---|
| 安全工作记录 | 80 | 全部需要独立编码确认 |
| 缺少正式安全工作编码 | 80 | 需用户确认建议编码，暂不写成正式编码 |
| 非空编码重复 | 0 | 未发现 |
| L2 能力对应多个 L2 流程组 | 0 | 未发现违反严格约束 |
| 同名 L3 跨 L2 流程组 | 0 | 已清零 |
| GB/T 反向映射条目 | 27 | 反向核对表已生成 |
| GB/T 未映射条目 | 0 | 已清零 |
| Gartner 候选映射 | 28 | 全部按待复核候选关系处理 |
| Gartner 过宽候选 | 20 | 后续单独校验 |

## 1. 安全工作编码检查

- 发现 80 条安全工作缺少正式独立编码。
- 已按 `SW-关注点编码-序号` 生成建议编码，仅供核对。
- 本轮没有把建议编码写入正式数据对象。
- 核对文件：`data/exports/worker-verify/sheet-review-2-2-security-work-code-suggestions.csv`

## 2. L2 安全能力到 L2 流程组严格约束

- 违反约束数量：0
- 核对文件：`data/exports/worker-verify/sheet-review-2-2-l2-process-group-constraint.csv`

## 3. 同名 L3 流程跨 L2 流程组

- 复验结果：0 条。
- 说明：用户修正原始 Excel 后，`日志管理与审计流程` / `日志管理与审计流程组` 命名差异已消除。
- 核对文件：`data/exports/worker-verify/sheet-review-2-2-l3-cross-process-group-check.csv`

## 4. GB/T 到安全职能反向映射

- GB/T 任务参考：27 条。
- 未映射：0 条。
- 说明：用户修正原始 Excel 后，`网络安全建设-密码技术应用` 与 `网络安全建设-网络数据安全保护` 已形成安全职能映射。
- 所有反向映射均为 `pending_review`，不自动作为最终事实。
- 核对文件：`data/exports/worker-verify/sheet-review-2-2-gbt-to-work-function-review.csv`

## 5. Gartner 到安全职能候选映射

- Gartner 岗位候选：28 条。
- 待复核：28 条。
- 过宽候选：20 条。
- 用户已确认先按候选映射做页面格式，后续单独验证校对。
- 核对文件：`data/exports/worker-verify/sheet-review-2-2-gartner-to-work-function-candidates.csv`

## 6. 仍需用户确认

1. 安全工作建议编码是否采用 `SW-关注点编码-序号` 作为正式编码规则。
2. Gartner 候选映射后续需要单独人工校验，当前只进入前端待复核展示。

## 7. 禁止事项执行情况

- 未修改前端代码。
- 未修改 ETL 代码。
- 未修改 SQLite schema。
- 未修改原始 Excel。
- 未自动确认 Gartner 候选映射为正式关系。
- 未把安全工作建议编码写成正式编码规则。
