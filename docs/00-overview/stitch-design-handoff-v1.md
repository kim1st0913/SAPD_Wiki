# SAPD Wiki Stitch Design Handoff V1

本文档用于把 SAPD Wiki 的全站菜单、页面类型和设计边界交接给 Stitch 设计流程。它不是前端实现任务，不接入运行代码。

## 1. 交接目标

- 让 Stitch 基于统一菜单结构生成全站设计方向。
- 区分工作台、目录、文档、标准、专题预留和占位页面。
- 避免把 SAPD Wiki 设计成营销官网、卡片墙、纯 PDF 文件库或复杂知识图谱。
- 为后续 Codex 前端实现提供稳定信息架构输入。

## 2. 输入文件

| 文件 | 用途 |
|---|---|
| `docs/00-overview/frontend-menu-and-page-type-definition-v1.md` | 菜单、页面类型、设计重点和不适合方式 |
| `frontend/design-handoff/navigation/nav-manifest.v1.json` | 机器可读导航 Manifest |
| `PRODUCT.md` | 产品定位和信息架构边界 |
| `DESIGN.md` | 视觉语言、组件边界和字段边界 |
| `docs/01-architecture/api-offline-package-contract-inventory.md` | API / 离线数据包契约现状 |

## 3. Stitch 设计顺序

| 顺序 | 设计对象 | 页面类型 | 输出目标 |
|---|---|---|---|
| 1 | 全局导航 / 应用壳 | `application-shell` | 顶栏、侧栏、二级菜单、搜索入口、主内容容器 |
| 2 | 安全能力映射 | `capability-mapping-workbench` | 以安全能力为主语的核心关系工作台 |
| 3 | 信息化环境安全能力映射 | `environment-mapping-workbench` | 以信息化对象为主语的对象映射工作台 |
| 4 | 安全知识目录 | `knowledge-directory` | 通用目录检索、表格、筛选、详情抽屉和来源证据 |
| 5 | 安全标准 / 框架 | `standard-framework-directory` / `standard-framework-page` | 标准目录、控制项、版本和映射关系 |
| 6 | 安全指南 | `document-hub` / `document-page` | 方法论阅读和章节导航 |
| 7 | 开发安全 / 数据安全 | `domain-module` | 专题预留页 |
| 8 | 其他页面 | `placeholder-page` | 统一占位说明 |

## 4. 全局设计边界

- SAPD Wiki 是本地安全架构关系知识库，不是营销站。
- 核心页面是工作台，不是大面积 Hero 首页。
- 关系表达应偏向树、表、矩阵、分栏和局部关系画布。
- 来源证据默认折叠，不能挤压主业务阅读。
- 非业务字段不得进入主展示区。
- 预留页面必须明确建设状态，不伪造未准备好的数据或功能。

## 5. 页面类型设计提示

| 页面类型 | Stitch 应重点表达 | 避免 |
|---|---|---|
| `application-shell` | 全站框架、搜索、一级/二级导航、页面上下文 | 大 Hero、营销首页 |
| `capability-mapping-workbench` | 能力目录、当前能力、技术/管理/标准映射、折叠来源 | 复杂网络图、卡片墙 |
| `environment-mapping-workbench` | 信息化对象、作用域、服务、模块/措施层级 | 直接套用能力页 |
| `knowledge-directory` | 表格检索、标签筛选、详情抽屉、来源证据 | 长文档页、纯卡片页 |
| `standard-framework-page` | 条款/控制项、能力/措施/管理映射、版本说明 | PDF 阅读器 |
| `document-page` | 章节目录、正文、页内目录、引用 | 关系图或卡片海报 |
| `domain-module` | 专题说明、建设状态、相关入口 | 伪造未建设功能 |
| `placeholder-page` | 页面说明、建设状态、后续规划、返回入口 | 空白页 |

## 6. Codex 后续实现边界

- Stitch 输出只作为设计参考，不能直接替代数据契约。
- 后续实现时先确认对应页面是否已有后端投影。
- 前端只消费 `dataClient` / `/api/v1/*` / 离线兼容数据包，不直接读取原始 Excel 或临时 JSON。
- 不在前端组件中实现 ETL、主数据归一、关系推断或成熟度评分。
- 当前 Manifest 不接入运行代码，后续接入前需单独评审。

## 7. 交付检查

- 全站一级菜单完整。
- 二级菜单完整。
- 页面类型枚举未超出定义范围。
- 优先级只使用 `P0`、`P1`、`P2`、`P3`。
- 工作台页、目录页、文档页、标准页和占位页有明显不同的信息结构。
- 预留页面有建设状态，不表现为已完成页面。
