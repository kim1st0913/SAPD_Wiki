# 非开发者使用 Codex 推进 SAPD Wiki

> 状态：`active / user workflow`
>
> 更新日期：2026-07-28

项目负责人不需要自己写代码。你的主要职责是提供业务材料、裁定业务含义、确认发布
范围和完成必要的人工验收；Codex 负责实现、自动检查和记录恢复证据。

## 1. 日常怎么提需求

直接说明目标和验收结果即可，例如：

- “把这批批准资料发布到知识库，并验证 MCP 能查询到。”
- “用最新代码和最新批准数据打 Windows 包。”
- “修复信息化环境页面这个问题，其他页面不要改。”
- “检查当前有哪些事项必须由我人工裁定。”

涉及正式数据、用户库、打包或发布时，说明是否允许写入；没有授权时，Codex 应停在
候选、dry-run 或验收门禁。

## 2. 新资料进入知识库

新资料不是直接交给 MCP。标准流程是：

1. 登记来源并计算 hash；
2. 解析到 staging；
3. 校验和业务审批；
4. 构建候选查询库与内容资产库；
5. 运行质量门禁；
6. 经明确授权后正式 apply；
7. 重启 immutable MCP runtime；
8. 验收五个只读工具并 accept。

如失败，应使用本次发布的恢复包回退，不覆盖真实用户库。

## 3. 页面和功能修改

- 页面只消费 `dataClient` / `/api/v1/*`，不在前端重做 ETL、评分和关系推断。
- 小修直接修复并做定向验证，不建立新计划文档。
- 数据、API、用户状态、App、打包和发布边界变化时，才更新长期合同和项目状态。
- Web 5173 通过只证明浏览器运行态，不能替代 DMG 或 Windows 实包验收。

## 4. 打最新安装包

### Windows

说“打最新 Windows 包”默认表示：

- 使用公开 `main` 的最新确认提交；
- 使用私有仓中最新批准 Delivery Data；
- 在私有 Windows Runner 生成、校验并上传 `Setup.exe`；
- 用户从私有 Internal Release 下载并在 Windows 10/11 测试。

### macOS

说“打最新 macOS 包”默认表示：

- 在正式 Mac 主工作区检查最新代码和批准数据；
- 执行 pre-DMG；
- 本地生成并校验 DMG；
- 正式外部分发前另做签名、notarization 和人工 UAT。

## 5. 你必须亲自完成的事项

- 对业务名称、来源缺口、评分规则和正式数据范围作最终裁定；
- 在真实 Windows / macOS 环境完成自动化无法覆盖的安装与交互验收；
- 决定是否正式发布、提交、推送或删除不可恢复内容；
- 保管私有 Delivery Data、真实用户库和发布凭据。

## 6. 当前入口

- 当前状态：`CURRENT_STATE.md`
- 未完成主线：`task_plan.md`
- 当前问题：`docs/06-implementation/open-issues.md`
- 文档导航：`docs/README.md`
- 打包流程：`docs/09-delivery/desktop-packaging-runbook.md`
