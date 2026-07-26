# 信息化环境主数据合同 v1

本目录冻结 `PLAN-ENV-MD` 的 P0 合同，不代表已经执行数据库、ETL、数据包或前端迁移。

文件：

- `environment-master-data.contract.json`：对象类型、身份、编号、关系、统计、页面和迁移门禁。
- `environment-dictionary.schema.json`：`environment-dictionary-v1` API/静态包主展示结构。
- `master-data-decision-manifest.schema.json`：P1盘点、P2人工裁定和编号分配清单结构。

测试夹具：

- `tests/fixtures/environment-master-data/v1/environment-dictionary.valid.json`
- `tests/fixtures/environment-master-data/v1/master-data-decision-manifest.valid.json`

定向验证：

```bash
node scripts/audit_environment_master_data_p0_contract.mjs
```

P0只冻结规则。正式主数据数量、业务编号和别名映射必须在P1只读盘点后，于P2逐条裁定；当前16个环境子类标题只是同标题候选组，不是固定数量或上限，同名异义允许拆分、异名同义允许合并。
