# SAPD Wiki 关系工作台前端

这是 SAPD Wiki 的本地静态关系工作台，用来浏览导出的能力、信息化环境、安全开发、数据生命周期、专项知识和内容视图 JSON 数据。

## 运行方式

先生成页面数据：

```bash
python scripts/sapd_wiki.py export-capability-tree
```

再启动本地静态服务器：

```bash
cd frontend/capability-browser
python -m http.server 5173
```

浏览器打开：

```text
http://localhost:5173
```

## 当前范围

- 左侧主导航：7 个页面入口，保持静态 HTML/JS 切换。
- 工作区：树、矩阵、表格、关系链和较窄详情面板。
- 能力维度：能力树、关系矩阵、关系链、对象详情。
- 专项知识维护：表头筛选、表格列宽拖拽、实体关系详情。
- 区域拖拽：主要工作区面板支持横向调宽。

当前版本只读，不做在线编辑；数据仍来自 `public/data/*.json`。
