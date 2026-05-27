# SAPD Wiki 关系工作台前端

这是 SAPD Wiki 的本地关系工作台，用来浏览能力、信息化环境、安全开发、数据生命周期、专项知识和内容视图数据。

当前支持两种运行模式：

- 本地 API 模式：前端通过 `/api/v1/data-packages/*` 读取后端数据包，并通过 `/api/v1/capabilities/workspace-projection` 读取安全能力映射页关系投影。
- 静态降级模式：如果 API 不可用，前端回退读取 `public/data/*.json`。

## 运行方式

先生成页面数据：

```bash
python scripts/sapd_wiki.py export-capability-tree
```

推荐启动带本地 API 的服务：

```bash
python3 scripts/dev_server_guard.py --fix-duplicates --start
```

项目默认且长期只使用 `5173` 作为前端预览端口。不要用 `python -m http.server 5173` 作为常驻服务，因为它没有 `/api/v1/*` 后端投影接口，也容易导致刷新后仍看到旧页面。

如果修改前端文件后刷新仍未看到最新效果，重启固定预览服务：

```bash
python3 scripts/dev_server_guard.py --restart
```

浏览器打开：

```text
http://127.0.0.1:5173/
```

## 当前范围

- 左侧主导航：7 个页面入口，保持静态 HTML/JS 切换。
- 工作区：树、矩阵、表格、关系链和较窄详情面板。
- 安全能力映射：能力树、关系矩阵、关系链、对象详情。
- 专项知识维护：表头筛选、表格列宽拖拽、实体关系详情。
- 区域拖拽：主要工作区面板支持横向调宽。

当前版本只读，不做在线编辑。安全能力映射页的技术 / 管理映射行已优先由后端投影提供；静态降级模式下仍保留 ViewModel fallback。
