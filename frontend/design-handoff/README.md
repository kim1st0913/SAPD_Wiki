# SAPD Wiki Frontend Design Handoff

`frontend/design-handoff/` 用于承接 SAPD Wiki 前端设计交接材料，包括：

- Stitch 设计输入
- Stitch 设计输出
- 导航 Manifest
- 样例数据
- 页面实现规格
- Codex 前端改造依据

## 状态和使用规则

本目录不是“所有设计想法的仓库”，只保存会被前端实现或设计交接复用的材料。

| 材料 | 目录 | 状态 | 使用规则 |
|---|---|---|---|
| 导航基线 | `navigation/` | `reference-baseline` | 作为设计和实现交接基线，不直接接入运行代码 |
| Stitch prompt | `stitch-prompts/` | `reference-only` | 只记录生成设计稿的提示词，不作为实现依据 |
| Stitch 输入 | `stitch-input-*` | `reference-only` | 只保存给设计工具的输入材料 |
| Stitch 输出 | `stitch-outputs/` | `reference-only` | 不能直接改代码，必须先转成 implementation spec |
| 页面实现规格 | `implementation-specs/` | `implementation-source` | Codex 改造前端时优先读取，且必须给出验收点 |
| 样例数据 | `sample-data/` | `reference-fixture` | 仅用于设计和实现沟通，不反向改写正式数据包 |

后续新增页面设计材料时，优先更新既有 implementation spec。只有当一个页面、流程或交付体验会长期复用，且现有 spec 无法承载时，才新增文件。

每份新的 implementation spec 顶部应包含：

- `状态`：`active`、`implementation-source`、`reference-only`、`superseded` 或 `archived`。
- `读者`：例如 Codex、用户、设计工具、打包会话。
- `使用方式`：说明是否能直接指导代码修改。
- `权威来源`：上游 brief、baseline、issue、截图或用户确认。
- `验收入口`：页面路由、导航路径、自动检查或人工验收点。
- `退役条件`：被哪个新 spec 替代、实现完成后转 reference、或进入归档。

## 当前导航基线

当前导航结构以以下文件为准：

`frontend/design-handoff/navigation/nav-manifest.v1.json`

该文件只是设计和实现交接基线，不直接接入运行代码。

## Stitch 设计顺序

后续 Stitch 设计顺序固定为：

```text
第 1 轮：全局导航 / 应用壳
第 2 轮：安全能力映射工作台
第 3 轮：信息化环境安全能力映射工作台
第 4 轮：安全知识目录页模板
第 5 轮：安全标准 / 框架目录页模板
第 6 轮：安全指南文档页模板
第 7 轮：开发安全、数据安全专题模块占位页
```

## Stitch 输出使用规则

1. Stitch 输出不得直接作为运行代码接入主工程。
2. Stitch 输出必须先转化为 implementation spec。
3. Codex 只能基于 implementation spec 改造前端。
4. 前端实现过程中不得擅自修改 ETL。
5. 前端实现过程中不得擅自修改数据库。
6. 前端实现过程中不得擅自修改数据模型。
7. 前端实现过程中不得擅自修改导出 JSON 结构。
8. Stitch 设计应服务于数据密集型安全知识门户，而不是营销展示网站。

## 新增和退役规则

- 小 UI 修复、文案调整、局部空态、单个按钮 / chip / tab 的样式问题，不在本目录新增设计文档。
- 截图反馈如果能直接修复，只更新代码、`progress.md` 和完成反馈中的验收入口。
- 已经落地且不会继续作为实现依据的 spec，应把状态改为 `reference-only` 或 `superseded`，不要继续追加新需求。
- 同一页面同时存在多份 spec 时，必须在本 README 或最新 spec 中声明哪一份是当前 active source。
- 需要长期保留但不再日常读取的材料，后续统一迁入 `docs/05-archive/`，不在本轮零散移动。

## 建议目录结构

```text
frontend/design-handoff/
├── README.md
├── navigation/
│   └── nav-manifest.v1.json
├── sample-data/
├── stitch-prompts/
├── stitch-outputs/
└── implementation-specs/
```
