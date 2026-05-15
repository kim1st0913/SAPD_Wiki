# SAPD Wiki Frontend Design Handoff

`frontend/design-handoff/` 用于承接 SAPD Wiki 前端设计交接材料，包括：

- Stitch 设计输入
- Stitch 设计输出
- 导航 Manifest
- 样例数据
- 页面实现规格
- Codex 前端改造依据

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
