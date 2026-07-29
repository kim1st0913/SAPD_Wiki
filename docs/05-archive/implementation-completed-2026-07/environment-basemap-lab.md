# Environment Basemap Lab 1.0

> 归档状态：`historical / implemented experiment`

## 目标

新增隔离实验页 `环境底图实验页`，验证 Hybrid Viewer 方案：

- 官方 Draw.io SVG 作为唯一视觉层；
- HTML 透明 hit layer 作为交互层；
- `environmentBasemap.semantic.json` 提供节点清单、绑定状态和 fallback 几何；
- `environmentBasemap.node-details.json` 提供 bound / ignored 节点详情；
- 支持适应屏幕、缩放、拖拽平移和点击节点查看详情。

该实验页不替换现有 `信息化环境维度 -> 环境底图` Tab。

## 页面入口

- 路由：`/environment-basemap-lab`
- 导航：`安全指南 / 环境底图实验页`
- `activeView`：`environment-basemap-lab`

## 资源

- SVG：`frontend/capability-browser/generated/environmentBasemap.svg`
- semantic：`frontend/capability-browser/generated/environmentBasemap.semantic.json`
- node details：`frontend/capability-browser/generated/environmentBasemap.node-details.json`

如果 SVG 缺失，页面显示明确空状态：缺少官方 Draw.io 导出的 `environmentBasemap.svg`，需要放入 `generated` 目录。

## 坐标策略

Lab 内联官方 SVG，优先通过 SVG 中的 `data-cell-id` 读取节点真实 `getBBox()`，再用 semantic 节点列表生成对应透明 hit button。

当 SVG bbox 不可用时，才按 `semantic.contentBounds`、`canvas` 和 `normalizedGeometry` 计算 fallback 坐标。当前官方 SVG 中 semantic 节点 `mxId` 可全量匹配 `97 / 97`。

## 字段边界

右侧详情只展示：

- 节点 label；
- 对象名称；
- 对象类型；
- 所属环境；
- 环境子类；
- 作用域；
- 安全技术服务；
- 安全技术模块；
- 安全技术措施。

默认不展示 `sheet`、`row`、`column`、`raw_value`、`source_file`、`import_id`、`source_id`、`source_ref`、`source_label`、`debug`、`raw`、`metadata`、`intermediate`、`generated_at`。

## 当前验收状态

- SVG 存在，`viewBox=0 0 11967 8124`；
- semantic 保持 `nodes=97`、`edges=73`；
- node-details 保持 `nodeDetails=91`、`ignoredNodes=6`；
- 正式环境页未替换，仍由 `EnvironmentLocalRelationMap` 渲染。
