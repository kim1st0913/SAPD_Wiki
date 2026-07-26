# 信息化环境主数据合同 v1

本目录冻结 `PLAN-ENV-MD` 的主数据合同及受控语义裁定。阶段执行状态以项目状态文档和对应证据包为准。

文件：

- `environment-master-data.contract.json`：对象类型、身份、编号、关系、统计、页面和迁移门禁。
- `environment-dictionary.schema.json`：`environment-dictionary-v1` API/静态包主展示结构。
- `master-data-decision-manifest.schema.json`：P1盘点、P2人工裁定和编号分配清单结构。
- `environment-segment-type-adjudication.p2.json`：16条环境子类类型的冻结定义和上下文裁定。
- `environment-and-object-definition-adjudication.p7-1.json`：10条信息化环境和51条信息化对象的冻结定义；定义基于原始名称与既有上下文形成，不声明为源Excel原文。

测试夹具：

- `tests/fixtures/environment-master-data/v1/environment-dictionary.valid.json`
- `tests/fixtures/environment-master-data/v1/master-data-decision-manifest.valid.json`

定向验证：

```bash
node scripts/audit_environment_master_data_p0_contract.mjs
```

P0只冻结规则。正式主数据数量、业务编号和别名映射必须在P1只读盘点后，于P2逐条裁定；当前16个环境子类标题只是同标题候选组，不是固定数量或上限，同名异义允许拆分、异名同义允许合并。

P7.1沿用P2的受控语义裁定方式补齐环境和对象定义，不改变主数据身份、编号、29个环境子类上下文、67个对象上下文或既有关系。字典中的“关联使用”是关系上下文投影：信息化环境29条、环境子类类型29条、信息化对象67条。
