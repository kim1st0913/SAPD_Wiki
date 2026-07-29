# 导入与 ETL 文档索引

> 状态：`active / current import index`
>
> 更新日期：2026-07-28

## 当前合同与操作入口

| 文档 | 用途 |
|---|---|
| `import-rules.md` | 多来源登记、解析、staging、校验、审批、正式入库和更新规则 |
| `mapping-rules.md` | 核心 Sheet 与管理 / 职能 Sheet 的已实现映射基线 |
| `import-approval-idempotency-and-retention-contract.md` | 审批幂等、来源证据键、按 job finalize 和 approved 默认导出 |
| `completed-sheet-business-confirmation.md` | 已实现 Sheet 的业务含义、主键、粒度和关系确认 |
| `sample-file-inventory.md` | 本地知识资产与样例来源盘点 |
| `github-local-data-initialization.md` | 开发者从公开源码在本地重建数据的边界 |

正式知识内容发布还必须遵守 release-id 驱动的候选构建、质量门禁、apply、runtime
restart、MCP 验收和 accept 流程；MCP 本身不负责导入。

## 历史材料

早期 5-Sheet MVP、剩余 21 Sheet 建模、第一至第三批合同、业务复核和 warning 清单已移入：

- `../05-archive/import-etl-completed-2026-07/`
- `../05-archive/document-retirement-2026-05/03-import-etl/`

这些材料只用于追溯，不覆盖当前合同和运行代码。

## 维护方式

- 新增来源类型前先更新 `import-rules.md` 和相应 parser / 测试；
- 映射粒度变化时同步 `mapping-rules.md`、业务确认清单和自动审计；
- 正式数据写入必须有明确授权、恢复路径和验收证据；
- 一次性核对报告和已完成批次不留在当前目录。
