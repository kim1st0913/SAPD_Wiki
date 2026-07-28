# SAPD Wiki

SAPD Wiki 是一个本地优先、可追溯的安全架构知识系统。它将 Excel、DOCX、PPT、
Draw.io 和 Markdown 等资料转化为结构化知识，并通过关系工作台、桌面应用和只读
MCP 接口提供统一查询。

> 公开仓库只包含代码、合同、文档和脱敏样例，不包含正式数据、用户数据或安装包。

## 主要能力

- 安全能力、关注点、技术与管理视角关系浏览
- 信息化环境、对象、作用域、服务、模块与措施映射
- LC-AP 安全开发生命周期和 LC-DT 数据生命周期工作台
- 知识字典、标准 / 框架、来源证据和全文检索
- 成熟度评估、批注、待复核、数据篮和本地工作区
- 基于 HTTPS、OAuth 的五个只读 MCP 知识工具

## 设计原则

```text
来源登记 → 解析与映射 → 质量检查 → 业务审批
        → 候选知识库 → 受控发布 → Web / App / MCP
```

- 后端负责 ETL、关系、评分、校验和数据投影。
- 前端只通过 `dataClient` / `/api/v1/*` 使用契约化数据。
- 基础知识、内容资产、用户状态和成熟度数据相互隔离。
- 知识更新必须可追溯、可审查、可验证、可回退。

## 当前状态

核心关系工作台、搜索、增量发布、MCP 和 Windows 自动构建链路已经可用。Windows
安装包由私有 Runner 生成；macOS DMG 在正式 Mac 工作区本地生成。成熟度 Rubric
正式映射和跨平台实包 UAT 仍按业务裁定与发布门禁推进。

详细状态见 [CURRENT_STATE.md](CURRENT_STATE.md) 和 [task_plan.md](task_plan.md)。

## 本地预览

```bash
python3 scripts/dev_server_guard.py --port 5173 --start
```

访问 <http://127.0.0.1:5173/>。工程检查入口：

```bash
node scripts/run_project_test_suite.mjs --suite quick
node scripts/run_project_test_suite.mjs --suite runtime --url http://127.0.0.1:5173
```

## 数据边界

不要向公开仓库提交源资料、SQLite、用户库、恢复包、DMG、Setup、凭据或其他构建
产物。安装包只携带受控基础数据和空用户库模板。

## 文档

- [项目愿景](docs/00-overview/project-vision.md)
- [当前架构](docs/01-architecture/architecture.md)
- [文档导航](docs/README.md)
- [桌面打包流程](docs/09-delivery/desktop-packaging-runbook.md)
- [数据初始化](docs/03-import-etl/github-local-data-initialization.md)
