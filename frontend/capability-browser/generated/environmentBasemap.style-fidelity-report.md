# Environment Basemap Style Fidelity Report

生成时间：2026-06-08T09:54:44.219Z

## 图例样式来源

SAPD 元素图例页 archimateNotationRegistry + renderArchimateCornerIcon

## 已识别 drawioType

actor, application_component, communication_network, data_object, device, facility, grouping, location, network_boundary, node, system_software

## 已识别 iconType

actor, application_component, communication_network, data_object, device, facility, grouping, location, node, system_software

## Renderer 指标

```json
{
  "edgeRouteKinds": {
    "orthogonal_fallback": 32,
    "orthogonal_straight": 36,
    "original_waypoints": 5
  },
  "textModes": {
    "horizontal": 79,
    "vertical": 18
  },
  "zIndexLayers": {
    "container": 28,
    "node": 69
  },
  "whiteboardBackgroundRendered": false,
  "unsupportedEdges": 0,
  "overflowRiskNodes": 0
}
```

## 角标还原

| iconType | 状态 | legendIconType | 样式来源 |
| --- | --- | --- | --- |
| application_component | restored | component | SAPD 元素图例页 archimateNotationRegistry + renderArchimateCornerIcon |
| application_function | rule_ready_not_present_in_source | function | SAPD 元素图例页 archimateNotationRegistry + renderArchimateCornerIcon |
| application_service | rule_ready_not_present_in_source | service | SAPD 元素图例页 archimateNotationRegistry + renderArchimateCornerIcon |
| data_object | restored | data | SAPD 元素图例页 archimateNotationRegistry + renderArchimateCornerIcon |
| system_software | restored | system-software | SAPD 元素图例页 archimateNotationRegistry + renderArchimateCornerIcon |
| device | restored | device | SAPD 元素图例页 archimateNotationRegistry + renderArchimateCornerIcon |
| node | restored | node | SAPD 元素图例页 archimateNotationRegistry + renderArchimateCornerIcon |
| communication_network | restored | network | SAPD 元素图例页 archimateNotationRegistry + renderArchimateCornerIcon |
| facility | restored | facility | SAPD 元素图例页 archimateNotationRegistry + renderArchimateCornerIcon |
| location | restored | location | SAPD 元素图例页 archimateNotationRegistry + renderArchimateCornerIcon |
| grouping | restored | grouping | SAPD 元素图例页 archimateNotationRegistry + renderArchimateCornerIcon |
| actor | restored | actor | SAPD 元素图例页 archimateNotationRegistry + renderArchimateCornerIcon |

## 字体规则

- 优先级：mxCell style.fontSize > mxCell style.fontStyle > mxCell style.align / verticalAlign / spacing > mxCell style.textDirection / rotation > container label box > drawioElementStyleMap fallback
- 大标签：IT / OT / L1-L4 / 园区 / 分支机构 / 数据中心机房 / 传统数据中心 / 云数据中心 / 运维管理网使用更大字号和粗体。
- 竖排文字：textDirection=vertical-lr 使用 writing-mode: vertical-lr；窄矩形按 label box 显示，不用浏览器默认横排挤压。
- 单行短文本：无显式换行且估算宽度可容纳时使用 nowrap，避免短文本被拆行。
- 多行文本：显式换行或估算宽度过长时才允许 multiline，并限制在 label box 内。

## 文本溢出风险节点

| mxId | label | textMode | size | fontSize |
| --- | --- | --- | --- | --- |
| 无 | 无 | 无 | 无 | 无 |

## 连线规则

- waypoint 优先：mxPoint waypoints are rendered as source -> waypoints -> target polyline.
- 正交 fallback：orthogonalEdgeStyle / elbowEdgeStyle without waypoints route as H-V-H or V-H-V polyline.
- 默认行为：source-center to target-center diagonal is not used for orthogonal/elbow edges.
- 图层：All current edges render in backgroundEdgeLayer under nodes and label/icon overlays.

## 层级规则

- background：Viewer grid only; generated basemap background is transparent.
- container：large containers and grouped blocks render in businessContainerLayer.
- edge：SVG edges render in backgroundEdgeLayer above container fills and below ordinary nodes.
- node：ordinary business/object nodes render above edges.
- labelIcon：container labels and all corner icons render in label/icon overlay above edges.
- interactionOverlay：hover/focus/selected outline only; binding state does not recolor or gray nodes.

## contentBounds

```json
{
  "canvas": {
    "x": 112,
    "y": 102,
    "width": 3086,
    "height": 2126
  },
  "contentBounds": {
    "minX": 160,
    "minY": 150,
    "maxX": 3150,
    "maxY": 2180,
    "padding": 48
  },
  "stats": {
    "cells": 170,
    "nodes": 97,
    "edges": 73,
    "ignoredEdges": 0
  }
}
```

## 仍无法还原的样式

- 未执行 diagrams.net 官方 shape renderer，因此复杂边线自动避障和浏览器抗锯齿不会与原工具逐像素一致。
- edgeStyle 使用直接 renderer：原始 waypoint 优先；无 waypoint 的 orthogonal / elbow 使用直角 fallback；不执行 diagrams.net 自动避障。
