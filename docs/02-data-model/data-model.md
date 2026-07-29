# SAPD Wiki 当前数据模型

> 状态：`active / conceptual data model`
>
> 更新日期：2026-07-28

本页说明当前数据域和所有权。具体字段、约束和迁移以 `db/migrations/`、
`src/sapd_wiki/`、API 合同和 JSON schema 为准。

## 1. 数据域

| 数据域 | 主要内容 | 所有权 |
|---|---|---|
| 基础知识 | 能力、关注点、环境、作用域、服务、模块、措施、流程、标准等 | 正式基础库，只通过受控发布更新 |
| 内容查询 | 文档、页面 / 幻灯片 / 章节 / 图节点、内容关系和来源证据 | 正式查询库 |
| 内容资产 | 原件派生资源、预览、内容寻址 BLOB 和 hash | 独立内容资产库 |
| 用户状态 | 批注、收藏、待复核、数据篮、工作台和用户配置 | 独立用户库 |
| 成熟度 | 项目、模板、评估点、四维评分、目标、证据和报告 | 独立 `maturity_*` 运行域 |
| 导入过程 | source、import job、staging、review、审批和审计 | 受控导入生命周期 |
| MCP 控制 | 客户端、授权、token family、Runtime 状态和安全审计 | 独立控制库 |

这些数据域不得因为页面方便而合并。尤其禁止把真实用户数据写回基础知识库，或把 MCP
控制信息写入业务数据库。

## 2. 核心对象关系

```text
source_file
  └─ import_job
      ├─ staging_item / staging_relation
      ├─ review_decision
      └─ approved formal objects and relations

knowledge object
  ├─ typed business fields
  ├─ stable_ref
  ├─ relations to other knowledge objects
  └─ source evidence

content_document
  ├─ content_fragment
  ├─ content_relation
  ├─ content_evidence
  └─ asset owner / role references

user object
  └─ target_ref → stable knowledge or content reference
```

对象身份必须使用明确 ID、编码或 `stable_ref`。前端不得用数组首项、标题匹配或默认焦点
代替当前对象身份。

## 3. 正式数据更新

正式知识更新遵循：

```text
source registration
→ staging
→ validation and review
→ approval
→ immutable candidate build
→ quality gate
→ formal apply
→ runtime restart and acceptance
```

同一审批任务只能完成一次状态转换；来源证据按完整证据键幂等。正式 apply 必须具备
备份、hash CAS、durable journal 和回退证据。

## 4. 当前权威合同

- API 字段：`docs/01-architecture/api-field-contract.md`
- 环境主数据：`docs/01-architecture/contracts/environment-master-data/v1/`
- MCP 基础知识：`docs/01-architecture/contracts/mcp/base-knowledge/v1/`
- 导入审批：`docs/03-import-etl/import-approval-idempotency-and-retention-contract.md`
- 成熟度：`docs/08-maturity/requirements.md`
- 本地目录：`docs/06-implementation/local-data-layout.md`

## 5. 保护规则

- 原始文件、正式库、资产库和用户库必须分开备份与恢复；
- Excel 合并单元格表达业务关系时必须在导入阶段保留，不能事后全局 forward-fill；
- 生成 JSON 是后端投影，不是新的业务来源；
- 测试使用临时库或空模板，不静默写真实用户库；
- schema 变化必须使用迁移和自动审计，不能只修改文档。
