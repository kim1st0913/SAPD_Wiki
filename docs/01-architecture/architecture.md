# SAPD Wiki 当前架构

> 状态：`active / current architecture overview`
>
> 更新日期：2026-07-28

本页描述当前已经采用的系统分层和边界。字段、路由、数据包和平台细节以对应专项合同
及实际代码为准。

## 1. 架构目标

SAPD Wiki 需要同时满足：

- 多来源知识可导入、校验、审批和追溯；
- 业务对象及关系可查询、可展示、可导出；
- Web、macOS、Windows 和 MCP 使用可识别版本的同一正式知识；
- 本地用户状态和客户评估不会污染基础知识；
- 更新、打包和回退都有明确恢复路径。

## 2. 当前系统分层

```text
体验与集成层
├─ Web 关系工作台
├─ macOS Swift / WKWebView App
├─ Windows Electron / NSIS App
└─ HTTPS + OAuth MCP 五工具

应用与投影层
├─ 本地 /api/v1/*
├─ dataClient 与 ViewModel
├─ 搜索、导出和用户工作区服务
└─ 成熟度评估服务

知识治理与发布层
├─ 来源登记、hash 与解析
├─ staging、映射、质量门禁和审批
├─ 候选双库 build / verify
└─ apply / accept / rollback 与 Runtime 重启

数据层
├─ 基础知识 SQLite + FTS
├─ 内容资产 SQLite
├─ 用户状态 SQLite
├─ maturity 运行数据
└─ 原始来源、恢复包和生成数据
```

## 3. 数据域

| 数据域 | 内容 | 写入边界 |
|---|---|---|
| 基础知识 | 能力、环境、生命周期、字典、标准及关系 | 仅受控发布写入，运行时只读 |
| 内容资产 | 文档片段、内容关系、内容证据和内容寻址信息 | 与基础库同一 release 验证 |
| 用户状态 | 批注、待复核、数据篮和工作区 | 仅当前用户写入，升级和测试不得覆盖 |
| 成熟度运行域 | 项目、评估输入、证据、评分和报告 | 只读引用基础知识，不回写基础库 |
| 来源与恢复域 | 原始文件、候选包、manifest、备份和恢复证据 | 受保护，不进入公开 Git |

## 4. 数据进入正式运行态

```text
来源登记与 hash
→ 解析 / staging
→ 字段与关系映射
→ 数据质量检查
→ 审批与任务终结
→ 构建候选基础库和内容资产库
→ verify
→ 正式 apply
→ immutable runtime restart
→ Web / MCP 五工具验收
→ accept
```

重复 build、verify、apply 和 accept 必须保持幂等。任何失败都应绑定 release manifest
和恢复包执行 rollback，不得用临时脚本直接覆盖正式 SQLite。

## 5. 前后端边界

- 后端负责解析、标准化、关系生成、评分、聚合、校验、权限边界和数据投影。
- 前端只消费 `dataClient` / `/api/v1/*`；离线 JSON 只是后端生成的兼容包或 fallback。
- 当前对象必须来自显式选择 ID 或同等精确的后端响应，不能用第一行、默认焦点或旧缓存
  代替。
- 页面不得直接读取源 Excel、SQLite 或临时 JSON，也不得重算业务关系和评分规则。

API 细节见
[`backend-interface-design.md`](backend-interface-design.md)、
[`api-field-contract.md`](api-field-contract.md) 和
[`frontend-json-data-package-inventory.md`](frontend-json-data-package-inventory.md)。

## 6. 桌面运行与交付

### macOS

- SwiftPM + Swift / WKWebView 壳承载共享前端和本地后端。
- 在正式 Mac 主工作区执行 pre-DMG、本地打包和实包验证。
- 正式外部分发按范围执行签名、notarization、证书、OAuth 和首次路径 UAT。

### Windows

- Electron + NSIS 承载共享前端和 Windows 后端。
- 公开 `main` 提供精确源码 SHA；私有交付仓提供批准的 Delivery Data。
- 私有 `windows-2022` Runner 生成、校验并上传最终 `Setup.exe`。

两端安装包都只能携带受控基础数据和空用户库模板，不能携带开发者真实用户库。

## 7. MCP 边界

- 只监听 `127.0.0.1`，使用 HTTPS、OAuth/PKCE 和 CurrentUser 证书信任。
- 提供搜索、对象读取、关系读取、来源证据和版本查询五个只读工具。
- 不通过 MCP 导入、审批或修改知识。
- Runtime 必须绑定明确的基础库、内容资产库、release 和持久授权资源身份。

MCP 合同见 [`contracts/mcp/`](contracts/mcp/)。

## 8. 权威顺序

出现冲突时，按以下顺序判断：

1. 当前用户要求和验收标准；
2. 最近适用的 `AGENTS.md`；
3. 当前业务、API、数据、实施和设计合同；
4. 实际代码、测试和已验证运行态；
5. 历史计划、截图、旧交接和归档材料。

当前项目状态从根目录 [`CURRENT_STATE.md`](../../CURRENT_STATE.md) 恢复，未完成事项从
[`task_plan.md`](../../task_plan.md) 和
[`open-issues.md`](../06-implementation/open-issues.md) 进入。
