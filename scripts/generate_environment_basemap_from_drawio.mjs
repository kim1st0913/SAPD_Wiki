#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const SOURCE_PATH = "data/raw-samples/drawio sample.drawio";
const OUTPUT_DIR = "frontend/capability-browser/generated";
const OUTPUT_HTML_PATH = `${OUTPUT_DIR}/environmentBasemap.html`;
const OUTPUT_CSS_PATH = `${OUTPUT_DIR}/environmentBasemap.css`;
const OUTPUT_SEMANTIC_PATH = `${OUTPUT_DIR}/environmentBasemap.semantic.json`;
const OUTPUT_JS_PATH = `${OUTPUT_DIR}/environmentBasemap.generated.js`;
const OUTPUT_STYLE_REPORT_JSON_PATH = `${OUTPUT_DIR}/environmentBasemap.style-fidelity-report.json`;
const OUTPUT_STYLE_REPORT_MD_PATH = `${OUTPUT_DIR}/environmentBasemap.style-fidelity-report.md`;
const OUTPUT_FIDELITY_REPORT_JSON_PATH = `${OUTPUT_DIR}/environmentBasemap.fidelity-report.json`;
const OUTPUT_FIDELITY_REPORT_MD_PATH = `${OUTPUT_DIR}/environmentBasemap.fidelity-report.md`;
const PAGE_NAME = "信息化环境及对象底图";
const CANVAS_PADDING = 48;

const LEGEND_STYLE_SOURCE = "SAPD 元素图例页 archimateNotationRegistry + renderArchimateCornerIcon";
const DRAWIO_ELEMENT_STYLE_MAP = Object.freeze({
  actor: {
    fillColor: "#ffff99",
    strokeColor: "#2f3b4d",
    strokeWidth: 1.5,
    borderStyle: "solid",
    borderRadius: 0,
    fontSize: 20,
    fontWeight: 700,
    textAlign: "center",
    verticalAlign: "middle",
    writingMode: "horizontal-tb",
    rotation: 0,
    cornerIcon: "actor",
    legendIconType: "actor",
    opacity: 1,
    zIndexLayer: "node",
    styleSource: LEGEND_STYLE_SOURCE,
  },
  system_software: {
    fillColor: "#AFFFAF",
    strokeColor: "#2f3b4d",
    strokeWidth: 2,
    borderStyle: "solid",
    borderRadius: 0,
    fontSize: 20,
    fontWeight: 700,
    textAlign: "center",
    verticalAlign: "middle",
    writingMode: "horizontal-tb",
    rotation: 0,
    cornerIcon: "system-software",
    legendIconType: "system-software",
    opacity: 1,
    zIndexLayer: "node",
    styleSource: LEGEND_STYLE_SOURCE,
  },
  device: {
    fillColor: "#AFFFAF",
    strokeColor: "#2f3b4d",
    strokeWidth: 2,
    borderStyle: "solid",
    borderRadius: 0,
    fontSize: 20,
    fontWeight: 700,
    textAlign: "center",
    verticalAlign: "middle",
    writingMode: "horizontal-tb",
    rotation: 0,
    cornerIcon: "device",
    legendIconType: "device",
    opacity: 1,
    zIndexLayer: "node",
    styleSource: LEGEND_STYLE_SOURCE,
  },
  node: {
    fillColor: "#AFFFAF",
    strokeColor: "#2f3b4d",
    strokeWidth: 2,
    borderStyle: "solid",
    borderRadius: 0,
    fontSize: 20,
    fontWeight: 700,
    textAlign: "center",
    verticalAlign: "middle",
    writingMode: "horizontal-tb",
    rotation: 0,
    cornerIcon: "node",
    legendIconType: "node",
    opacity: 1,
    zIndexLayer: "node",
    styleSource: LEGEND_STYLE_SOURCE,
  },
  communication_network: {
    fillColor: "#AFFFAF",
    strokeColor: "#2f3b4d",
    strokeWidth: 2,
    borderStyle: "solid",
    borderRadius: 0,
    fontSize: 20,
    fontWeight: 700,
    textAlign: "center",
    verticalAlign: "middle",
    writingMode: "horizontal-tb",
    rotation: 0,
    cornerIcon: "network",
    legendIconType: "network",
    opacity: 1,
    zIndexLayer: "node",
    styleSource: LEGEND_STYLE_SOURCE,
  },
  facility: {
    fillColor: "#AFFFAF",
    strokeColor: "#2f3b4d",
    strokeWidth: 2,
    borderStyle: "solid",
    borderRadius: 0,
    fontSize: 40,
    fontWeight: 700,
    textAlign: "center",
    verticalAlign: "bottom",
    writingMode: "horizontal-tb",
    rotation: 0,
    cornerIcon: "facility",
    legendIconType: "facility",
    opacity: 1,
    zIndexLayer: "container",
    styleSource: LEGEND_STYLE_SOURCE,
  },
  location: {
    fillColor: "#efd1e4",
    strokeColor: "#2f3b4d",
    strokeWidth: 1.5,
    borderStyle: "solid",
    borderRadius: 0,
    fontSize: 40,
    fontWeight: 700,
    textAlign: "left",
    verticalAlign: "bottom",
    writingMode: "horizontal-tb",
    rotation: 0,
    cornerIcon: "location",
    legendIconType: "location",
    opacity: 1,
    zIndexLayer: "container",
    styleSource: LEGEND_STYLE_SOURCE,
  },
  grouping: {
    fillColor: "transparent",
    strokeColor: "#7d8997",
    strokeWidth: 1.5,
    borderStyle: "dashed",
    borderRadius: 0,
    fontSize: 40,
    fontWeight: 700,
    textAlign: "right",
    verticalAlign: "top",
    writingMode: "horizontal-tb",
    rotation: 0,
    cornerIcon: "grouping",
    legendIconType: "grouping",
    opacity: 1,
    zIndexLayer: "container",
    styleSource: LEGEND_STYLE_SOURCE,
  },
  application_component: {
    fillColor: "#99ffff",
    strokeColor: "#2f3b4d",
    strokeWidth: 2,
    borderStyle: "solid",
    borderRadius: 0,
    fontSize: 20,
    fontWeight: 700,
    textAlign: "center",
    verticalAlign: "middle",
    writingMode: "horizontal-tb",
    rotation: 0,
    cornerIcon: "component",
    legendIconType: "component",
    opacity: 1,
    zIndexLayer: "node",
    styleSource: LEGEND_STYLE_SOURCE,
  },
  application_function: {
    fillColor: "#99ffff",
    strokeColor: "#2f3b4d",
    strokeWidth: 2,
    borderStyle: "solid",
    borderRadius: 14,
    fontSize: 20,
    fontWeight: 700,
    textAlign: "center",
    verticalAlign: "middle",
    writingMode: "horizontal-tb",
    rotation: 0,
    cornerIcon: "function",
    legendIconType: "function",
    opacity: 1,
    zIndexLayer: "node",
    styleSource: LEGEND_STYLE_SOURCE,
  },
  application_service: {
    fillColor: "#99ffff",
    strokeColor: "#2f3b4d",
    strokeWidth: 2,
    borderStyle: "solid",
    borderRadius: 999,
    fontSize: 20,
    fontWeight: 700,
    textAlign: "center",
    verticalAlign: "middle",
    writingMode: "horizontal-tb",
    rotation: 0,
    cornerIcon: "service",
    legendIconType: "service",
    opacity: 1,
    zIndexLayer: "node",
    styleSource: LEGEND_STYLE_SOURCE,
  },
  data_object: {
    fillColor: "#99ffff",
    strokeColor: "#2f3b4d",
    strokeWidth: 2,
    borderStyle: "solid",
    borderRadius: 0,
    fontSize: 20,
    fontWeight: 700,
    textAlign: "center",
    verticalAlign: "middle",
    writingMode: "horizontal-tb",
    rotation: 0,
    cornerIcon: "data",
    legendIconType: "data",
    opacity: 1,
    zIndexLayer: "node",
    styleSource: LEGEND_STYLE_SOURCE,
  },
  network_boundary: {
    fillColor: "#AFFFAF",
    strokeColor: "#2f3b4d",
    strokeWidth: 2,
    borderStyle: "solid",
    borderRadius: 0,
    fontSize: 20,
    fontWeight: 700,
    textAlign: "center",
    verticalAlign: "middle",
    writingMode: "horizontal-tb",
    rotation: 0,
    cornerIcon: "node",
    legendIconType: "node",
    opacity: 1,
    zIndexLayer: "node",
    styleSource: LEGEND_STYLE_SOURCE,
  },
  environment_zone: {
    fillColor: "#efd1e4",
    strokeColor: "#2f3b4d",
    strokeWidth: 1.5,
    borderStyle: "solid",
    borderRadius: 0,
    fontSize: 40,
    fontWeight: 700,
    textAlign: "left",
    verticalAlign: "bottom",
    writingMode: "horizontal-tb",
    rotation: 0,
    cornerIcon: "location",
    legendIconType: "location",
    opacity: 1,
    zIndexLayer: "container",
    styleSource: LEGEND_STYLE_SOURCE,
  },
  environment_segment: {
    fillColor: "transparent",
    strokeColor: "#7d8997",
    strokeWidth: 1.5,
    borderStyle: "dashed",
    borderRadius: 0,
    fontSize: 40,
    fontWeight: 700,
    textAlign: "right",
    verticalAlign: "top",
    writingMode: "horizontal-tb",
    rotation: 0,
    cornerIcon: "grouping",
    legendIconType: "grouping",
    opacity: 1,
    zIndexLayer: "container",
    styleSource: LEGEND_STYLE_SOURCE,
  },
  unknown: {
    fillColor: "#ffffff",
    strokeColor: "#7d8997",
    strokeWidth: 1.5,
    borderStyle: "solid",
    borderRadius: 0,
    fontSize: 18,
    fontWeight: 600,
    textAlign: "center",
    verticalAlign: "middle",
    writingMode: "horizontal-tb",
    rotation: 0,
    cornerIcon: "unknown",
    legendIconType: "unknown",
    opacity: 1,
    zIndexLayer: "node",
    styleSource: "generic fallback",
  },
});

function decodeXml(value = "") {
  return String(value)
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, code) => String.fromCharCode(Number.parseInt(code, 16)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

function escapeHtml(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function attrs(source = "") {
  const result = {};
  for (const match of source.matchAll(/\s([:\w.-]+)="([^"]*)"/g)) {
    result[match[1]] = decodeXml(match[2]);
  }
  return result;
}

function styleMap(style = "") {
  const result = {};
  for (const part of String(style).split(";")) {
    if (!part) continue;
    const [key, ...rest] = part.split("=");
    result[key] = rest.length ? rest.join("=") : true;
  }
  return result;
}

function number(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function drawioColor(value, fallback) {
  if (!value || value === "default") return fallback;
  if (value === "none") return "transparent";
  return value;
}

function styleRuleFor(drawioType) {
  return DRAWIO_ELEMENT_STYLE_MAP[drawioType] || DRAWIO_ELEMENT_STYLE_MAP.unknown;
}

function visualTypeFromAppType(appType, label = "") {
  const normalized = String(label || "");
  if (appType === "grouping") return "grouping";
  if (appType === "location") return "location";
  if (appType === "facility") return "facility";
  if (appType === "netw") return "communication_network";
  if (appType === "device") return "device";
  if (appType === "node") return normalized.includes("边界") ? "network_boundary" : "node";
  if (appType === "sysSw") return "system_software";
  if (["dataObj", "dataObject", "data", "passive"].includes(appType)) return "data_object";
  if (["func", "function", "appFunction"].includes(appType)) return "application_function";
  if (["serv", "service", "appService"].includes(appType)) return "application_service";
  if (/^(数据库|数据对象)$/.test(normalized)) return "data_object";
  if (appType === "comp") return "application_component";
  return "unknown";
}

function appTypeFill(appType, label = "") {
  return styleRuleFor(visualTypeFromAppType(appType, label)).fillColor;
}

function visualTypeFor(cell, label = "") {
  const style = cell.style || {};
  if (style.shape === "mxgraph.archimate3.actor") return "actor";
  return visualTypeFromAppType(style.appType || "", label);
}

function iconTypeFor(drawioType) {
  return {
    actor: "actor",
    grouping: "grouping",
    location: "location",
    facility: "facility",
    communication_network: "communication_network",
    device: "device",
    node: "node",
    system_software: "system_software",
    application_component: "application_component",
    application_function: "application_function",
    application_service: "application_service",
    data_object: "data_object",
    network_boundary: "node",
    environment_zone: "location",
    environment_segment: "grouping",
  }[drawioType] || "unknown";
}

function legendIconTypeFor(drawioType) {
  return styleRuleFor(drawioType).legendIconType || "unknown";
}

function cssToken(value = "") {
  return String(value || "unknown").replace(/[^a-z0-9_-]+/gi, "-").toLowerCase();
}

function textLines(value = "") {
  return decodeXml(value)
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<div[^>]*>/gi, "")
    .replace(/<[^>]+>/g, "")
    .split(/\n+/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function textFromValue(value = "") {
  return textLines(value).join("\n");
}

function parseCells(pageXml) {
  const cells = [];
  for (const match of pageXml.matchAll(/<mxCell\b([\s\S]*?)(?:\/>|>([\s\S]*?)<\/mxCell>)/g)) {
    const cellAttrs = attrs(match[1]);
    const inner = match[2] || "";
    const geometryMatch = inner.match(/<mxGeometry\b([^>]*)/) || match[0].match(/<mxGeometry\b([^>]*)/);
    const geometry = geometryMatch ? attrs(geometryMatch[1]) : {};
    const points = [...match[0].matchAll(/<mxPoint\b([^>]*)\/>/g)].map((point) => {
      const pointAttrs = attrs(point[1]);
      return {
        x: number(pointAttrs.x),
        y: number(pointAttrs.y),
        as: pointAttrs.as || "",
      };
    });
    cells.push({
      order: cells.length,
      id: cellAttrs.id || "",
      parent: cellAttrs.parent || "",
      value: cellAttrs.value || "",
      vertex: cellAttrs.vertex === "1",
      edge: cellAttrs.edge === "1",
      source: cellAttrs.source || "",
      target: cellAttrs.target || "",
      geometry,
      points,
      style: styleMap(cellAttrs.style || ""),
    });
  }
  return cells;
}

function extractPage(sourceXml) {
  const diagrams = [...sourceXml.matchAll(/<diagram\b([^>]*)>([\s\S]*?)<\/diagram>/g)].map((match, index) => ({
    index: index + 1,
    attrs: attrs(match[1]),
    body: match[2],
  }));
  const page = diagrams.find((item) => item.attrs.name === PAGE_NAME);
  if (!page) throw new Error(`Cannot find draw.io page "${PAGE_NAME}" in ${SOURCE_PATH}`);
  return page;
}

function rawGeometry(cell) {
  return {
    x: number(cell.geometry.x),
    y: number(cell.geometry.y),
    width: Math.max(1, number(cell.geometry.width)),
    height: Math.max(1, number(cell.geometry.height)),
  };
}

function absoluteGeometry(cell, cellMap) {
  const geometry = rawGeometry(cell);
  const parent = cellMap.get(cell.parent);
  if (!parent?.vertex) return geometry;
  const parentGeometry = absoluteGeometry(parent, cellMap);
  return {
    ...geometry,
    x: parentGeometry.x + geometry.x,
    y: parentGeometry.y + geometry.y,
  };
}

function vertexBounds(cell, cellMap) {
  const geometry = absoluteGeometry(cell, cellMap);
  return {
    minX: geometry.x,
    minY: geometry.y,
    maxX: geometry.x + geometry.width,
    maxY: geometry.y + geometry.height,
  };
}

function mergeBounds(bounds, next) {
  if (!next) return bounds;
  return {
    minX: Math.min(bounds.minX, next.minX),
    minY: Math.min(bounds.minY, next.minY),
    maxX: Math.max(bounds.maxX, next.maxX),
    maxY: Math.max(bounds.maxY, next.maxY),
  };
}

function buildVertexBounds(cells, cellMap) {
  let bounds = { minX: Infinity, minY: Infinity, maxX: 0, maxY: 0 };
  for (const cell of cells) {
    if (cell.vertex) bounds = mergeBounds(bounds, vertexBounds(cell, cellMap));
  }
  return bounds;
}

function pointBounds(points) {
  return points.reduce(
    (bounds, point) => mergeBounds(bounds, { minX: point.x, minY: point.y, maxX: point.x, maxY: point.y }),
    { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity },
  );
}

function isPointInsideBounds(point, bounds, margin = 64) {
  return (
    point.x >= bounds.minX - margin &&
    point.x <= bounds.maxX + margin &&
    point.y >= bounds.minY - margin &&
    point.y <= bounds.maxY + margin
  );
}

function isOutsideBounds(bounds, contentBounds, margin = 64) {
  return (
    bounds.maxX < contentBounds.minX - margin ||
    bounds.minX > contentBounds.maxX + margin ||
    bounds.maxY < contentBounds.minY - margin ||
    bounds.minY > contentBounds.maxY + margin
  );
}

function buildContentBounds(cells, cellMap, edges = []) {
  const vertexOnlyBounds = buildVertexBounds(cells, cellMap);
  let bounds = vertexOnlyBounds;
  for (const cell of edges) {
    for (const point of edgePoints(cell, cellMap)) {
      if (isPointInsideBounds(point, vertexOnlyBounds)) {
        bounds = mergeBounds(bounds, { minX: point.x, minY: point.y, maxX: point.x, maxY: point.y });
      }
    }
  }
  return bounds;
}

function buildCanvas(contentBounds, padding = CANVAS_PADDING) {
  const x = Math.floor(contentBounds.minX - padding);
  const y = Math.floor(contentBounds.minY - padding);
  return {
    x,
    y,
    width: Math.ceil(contentBounds.maxX - contentBounds.minX + padding * 2),
    height: Math.ceil(contentBounds.maxY - contentBounds.minY + padding * 2),
  };
}

function normalizeGeometry(geometry, canvas) {
  return {
    x: geometry.x - canvas.x,
    y: geometry.y - canvas.y,
    width: geometry.width,
    height: geometry.height,
  };
}

function cellCenter(cell, cellMap) {
  const geometry = absoluteGeometry(cell, cellMap);
  return {
    x: geometry.x + geometry.width / 2,
    y: geometry.y + geometry.height / 2,
  };
}

function anchor(cell, cellMap, xRatio, yRatio) {
  if (!cell) return null;
  const geometry = absoluteGeometry(cell, cellMap);
  return {
    x: geometry.x + geometry.width * number(xRatio, 0.5),
    y: geometry.y + geometry.height * number(yRatio, 0.5),
  };
}

function isPointNearCell(point, cell, cellMap, margin = 48) {
  const geometry = absoluteGeometry(cell, cellMap);
  return (
    point.x >= geometry.x - margin &&
    point.x <= geometry.x + geometry.width + margin &&
    point.y >= geometry.y - margin &&
    point.y <= geometry.y + geometry.height + margin
  );
}

function geometryPoint(cell, as) {
  return cell.points.find((point) => point.as === as) || null;
}

function edgeEndpoint(cell, cellMap, type) {
  const explicit = geometryPoint(cell, type === "source" ? "sourcePoint" : "targetPoint");
  const node = cellMap.get(type === "source" ? cell.source : cell.target);
  if (explicit && (!node || isPointNearCell(explicit, node, cellMap))) return explicit;
  const xRatio = cell.style[type === "source" ? "exitX" : "entryX"];
  const yRatio = cell.style[type === "source" ? "exitY" : "entryY"];
  if (node && xRatio !== undefined && yRatio !== undefined) return anchor(node, cellMap, xRatio, yRatio);
  return node ? cellCenter(node, cellMap) : null;
}

function rawEdgePoints(cell, cellMap) {
  const source = edgeEndpoint(cell, cellMap, "source");
  const target = edgeEndpoint(cell, cellMap, "target");
  return [
    ...(source ? [source] : []),
    ...cell.points.filter((point) => !["sourcePoint", "targetPoint"].includes(point.as)),
    ...(target ? [target] : []),
  ].filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y));
}

function hasOriginalWaypoints(cell) {
  return cell.points.some((point) => !["sourcePoint", "targetPoint"].includes(point.as));
}

function isOrthogonalStyle(cell) {
  const edgeStyle = String(cell.style.edgeStyle || "");
  return edgeStyle.includes("orthogonal") || edgeStyle.includes("elbow") || cell.style.elbow;
}

function nearlyEqual(a, b, epsilon = 0.5) {
  return Math.abs(a - b) <= epsilon;
}

function sideHint(style, prefix) {
  const x = Number(style[`${prefix}X`]);
  const y = Number(style[`${prefix}Y`]);
  if (Number.isFinite(x) && x <= 0.05) return "left";
  if (Number.isFinite(x) && x >= 0.95) return "right";
  if (Number.isFinite(y) && y <= 0.05) return "top";
  if (Number.isFinite(y) && y >= 0.95) return "bottom";
  return "";
}

function dedupeRoute(points) {
  const result = [];
  for (const point of points) {
    const last = result[result.length - 1];
    if (last && nearlyEqual(last.x, point.x) && nearlyEqual(last.y, point.y)) continue;
    result.push(point);
  }
  return result;
}

function orthogonalFallback(points, style) {
  if (points.length !== 2) return points;
  const [source, target] = points;
  if (nearlyEqual(source.x, target.x) || nearlyEqual(source.y, target.y)) return points;
  const sourceSide = sideHint(style, "exit");
  const targetSide = sideHint(style, "entry");
  const horizontalSide = ["left", "right"].includes(sourceSide) || ["left", "right"].includes(targetSide);
  const verticalSide = ["top", "bottom"].includes(sourceSide) || ["top", "bottom"].includes(targetSide);
  const preferHorizontalFirst = horizontalSide || (!verticalSide && Math.abs(source.x - target.x) >= Math.abs(source.y - target.y));
  if (preferHorizontalFirst) {
    const midX = (source.x + target.x) / 2;
    return dedupeRoute([source, { x: midX, y: source.y }, { x: midX, y: target.y }, target]);
  }
  const midY = (source.y + target.y) / 2;
  return dedupeRoute([source, { x: source.x, y: midY }, { x: target.x, y: midY }, target]);
}

function routedEdge(cell, cellMap) {
  const points = rawEdgePoints(cell, cellMap);
  if (points.length < 2) {
    return { points, routeKind: "unrenderable", orthogonal: false, unsupportedReason: "fewer_than_two_points" };
  }
  if (hasOriginalWaypoints(cell)) {
    return { points, routeKind: "original_waypoints", orthogonal: true, unsupportedReason: "" };
  }
  if (isOrthogonalStyle(cell)) {
    const routed = orthogonalFallback(points, cell.style);
    return {
      points: routed,
      routeKind: routed.length > 2 ? "orthogonal_fallback" : "orthogonal_straight",
      orthogonal: true,
      unsupportedReason: "",
    };
  }
  return { points, routeKind: "straight_fallback", orthogonal: false, unsupportedReason: "non_orthogonal_style_without_waypoints" };
}

function edgePoints(cell, cellMap) {
  return routedEdge(cell, cellMap).points;
}

function renderableEdges(cells, cellMap, contentBounds) {
  return cells.filter((cell) => {
    if (!cell.edge) return false;
    const points = edgePoints(cell, cellMap);
    if (points.length < 2) return false;
    return true;
  });
}

function edgePath(cell, cellMap, canvas) {
  const points = edgePoints(cell, cellMap);
  if (points.length < 2) return "";
  return points.map((point, index) => `${index ? "L" : "M"} ${point.x - canvas.x} ${point.y - canvas.y}`).join(" ");
}

function arrowMarker(arrow, position) {
  if (!arrow || arrow === "none") return "";
  const suffix = position === "start" ? "Start" : "";
  if (arrow === "block") return `basemapArrowBlock${suffix}`;
  if (arrow === "oval") return `basemapArrowOval${suffix}`;
  if (arrow === "open") return `basemapArrowOpen${suffix}`;
  return `basemapArrowOpen${suffix}`;
}

function dashArray(style, strokeWidth) {
  if (style.dashed !== "1") return "";
  const pattern = String(style.dashPattern || "")
    .trim()
    .split(/\s+/)
    .map((item) => Number(item))
    .filter((item) => Number.isFinite(item) && item > 0);
  if (!pattern.length) return "6 6";
  return pattern.map((item) => Math.max(2, item * strokeWidth * 3)).join(" ");
}

function fontStyle(style, rule = DRAWIO_ELEMENT_STYLE_MAP.unknown) {
  const value = number(style.fontStyle, 0);
  const hasExplicitFontStyle = style.fontStyle !== undefined;
  return {
    raw: hasExplicitFontStyle ? String(style.fontStyle) : "",
    weight: hasExplicitFontStyle ? (value & 1 ? "700" : "400") : String(rule.fontWeight || 600),
    italic: value & 2 ? "italic" : "normal",
    decoration: value & 4 ? "underline" : "none",
  };
}

function inferredFontSize(cell, label, drawioType) {
  const rule = styleRuleFor(drawioType);
  const explicit = Number(cell.style.fontSize);
  if (Number.isFinite(explicit)) return explicit;
  if (/^(IT|OT|L[1-4])$/.test(label)) return 42;
  if (/数据中心机房|传统数据中心|云数据中心|运维管理网|园区|分支机构|工厂/.test(label)) return Math.max(rule.fontSize, 32);
  if (cell.style.textDirection === "vertical-lr") return Math.max(20, Math.min(26, rule.fontSize));
  return rule.fontSize || 18;
}

function textModeFor(cell) {
  if (cell.style.textDirection === "vertical-lr") return "vertical";
  if (Number.isFinite(Number(cell.style.rotation)) && Number(cell.style.rotation) !== 0) return "rotated";
  const lines = textLines(cell.value);
  const label = textFromValue(cell.value);
  const geometry = rawGeometry(cell);
  const drawioType = visualTypeFor(cell, label);
  if (drawioType !== "actor" && label.length >= 4 && geometry.height >= geometry.width * 1.75) return "vertical";
  return lines.length > 1 ? "multiline" : "horizontal";
}

function nodeVisualProperties(cell) {
  const style = cell.style;
  const geometry = rawGeometry(cell);
  const label = textFromValue(cell.value);
  const drawioType = visualTypeFor(cell, label);
  const rule = styleRuleFor(drawioType);
  const fontSize = inferredFontSize(cell, label, drawioType);
  const font = fontStyle(style, rule);
  const rounded = style.rounded === "1" || rule.borderRadius > 0
    ? Math.min(rule.borderRadius || 18, Math.max(0, geometry.width / 5), Math.max(0, geometry.height / 2))
    : 0;
  const strokeWidth = Math.max(1, number(style.strokeWidth, rule.strokeWidth || 1.5));
  const borderStyle = style.dashed === "1" || rule.borderStyle === "dashed" ? "dashed" : "solid";
  const align = style.align || rule.textAlign || "center";
  const verticalAlign = style.verticalAlign || rule.verticalAlign || "middle";
  const justify = align === "left" ? "flex-start" : align === "right" ? "flex-end" : "center";
  const alignItems = verticalAlign === "top" ? "flex-start" : verticalAlign === "bottom" ? "flex-end" : "center";
  const fill = drawioColor(style.fillColor, rule.fillColor || appTypeFill(style.appType, label));
  const stroke = drawioColor(style.strokeColor, rule.strokeColor || "#2f3b4a");
  const textMode = textModeFor(cell);
  const writingMode = textMode === "vertical" ? "vertical-lr" : rule.writingMode || "horizontal-tb";
  const rotation = number(style.rotation, rule.rotation || 0);
  const iconSize = Math.max(8, Math.min(28, fontSize * 0.66, geometry.width * 0.18, geometry.height * 0.38));
  const iconOffset = Math.max(2, Math.min(9, fontSize * 0.2));
  const spacingTop = number(style.spacingTop, 2);
  const spacingRight = number(style.spacingRight, 2);
  const spacingBottom = number(style.spacingBottom, 2);
  const spacingLeft = number(style.spacingLeft, 2);
  return {
    drawioType,
    rule,
    fontSize,
    font,
    rounded,
    strokeWidth,
    borderStyle,
    align,
    verticalAlign,
    justify,
    alignItems,
    fill,
    stroke,
    color: drawioColor(style.fontColor, "#172033"),
    fontFamily: style.fontFamily || "Helvetica, Arial, sans-serif",
    textMode,
    writingMode,
    rotation,
    iconSize,
    iconOffset,
    spacingTop,
    spacingRight,
    spacingBottom,
    spacingLeft,
  };
}

function estimatedTextWidth(label, fontSize) {
  return Array.from(String(label || "")).reduce((total, char) => {
    const code = char.codePointAt(0) || 0;
    if (char === "\n") return total;
    if (char === " ") return total + fontSize * 0.35;
    return total + (code > 255 ? fontSize : fontSize * 0.58);
  }, 0);
}

function layoutLineCount(label, fontSize, availableWidth, hasExplicitBreak) {
  const lines = String(label || "").split("\n").filter(Boolean);
  if (hasExplicitBreak) return Math.max(1, lines.length);
  const width = Math.max(1, availableWidth);
  return Math.max(1, Math.ceil(estimatedTextWidth(label, fontSize) / width));
}

function labelLayoutFor(cell, zIndexLayer) {
  const props = nodeVisualProperties(cell);
  const geometry = rawGeometry(cell);
  const label = textFromValue(cell.value);
  const lines = textLines(cell.value);
  const hasExplicitBreak = lines.length > 1;
  const iconReserve = shouldRenderCornerIcon(iconTypeFor(props.drawioType), legendIconTypeFor(props.drawioType)) ? props.iconSize + props.iconOffset + 4 : 0;
  const spacingLeft = props.spacingLeft;
  const spacingRight = props.spacingRight;
  const spacingTop = props.spacingTop;
  const spacingBottom = props.spacingBottom;
  let x = spacingLeft;
  let y = spacingTop;
  let width = Math.max(1, geometry.width - spacingLeft - spacingRight);
  let height = Math.max(1, geometry.height - spacingTop - spacingBottom);

  if (zIndexLayer === "container") {
    if (props.textMode === "vertical") {
      width = Math.min(geometry.width, Math.max(34, props.fontSize * 1.55 + spacingLeft + spacingRight));
      height = Math.max(1, geometry.height - spacingTop - spacingBottom);
      if (props.align === "right") x = geometry.width - width - spacingRight;
      else if (props.align === "center") x = Math.max(0, (geometry.width - width) / 2);
      else x = spacingLeft;
      y = spacingTop;
    } else {
      height = Math.min(geometry.height, Math.max(28, props.fontSize * 1.42 + spacingTop + spacingBottom));
      width = Math.max(1, geometry.width - spacingLeft - spacingRight);
      x = spacingLeft;
      if (props.verticalAlign === "bottom") y = Math.max(0, geometry.height - height - spacingBottom);
      else if (props.verticalAlign === "middle") y = Math.max(0, (geometry.height - height) / 2);
      else y = spacingTop;
    }
  }

  let availableWidth = Math.max(1, width - (props.textMode === "vertical" ? 0 : iconReserve));
  const rawChars = Math.max(1, Array.from(label.replace(/\n/g, "")).length);
  const labelFontSize = props.textMode === "vertical"
    ? Math.max(12, Math.min(props.fontSize, Math.floor((height / rawChars) * 0.98)))
    : props.fontSize;
  const estimated = estimatedTextWidth(label.replace(/\n/g, ""), labelFontSize);
  const forceSingle = !hasExplicitBreak && props.textMode !== "vertical" && estimated <= availableWidth;
  const estimatedLineCount = layoutLineCount(label, labelFontSize, availableWidth, hasExplicitBreak);
  if (zIndexLayer === "container" && props.textMode !== "vertical" && !forceSingle && estimatedLineCount > 1) {
    height = Math.min(
      Math.max(1, geometry.height - spacingTop - spacingBottom),
      Math.max(height, estimatedLineCount * labelFontSize * 1.18 + spacingTop + spacingBottom),
    );
    if (props.verticalAlign === "bottom") y = Math.max(0, geometry.height - height - spacingBottom);
    else if (props.verticalAlign === "middle") y = Math.max(0, (geometry.height - height) / 2);
    else y = spacingTop;
    availableWidth = Math.max(1, width - iconReserve);
  }
  const overflowRisk = props.textMode === "vertical"
    ? estimatedTextWidth(label.replace(/\n/g, ""), labelFontSize) > height * 1.04
    : estimatedLineCount * labelFontSize * 1.16 > height;
  return {
    ...props,
    label,
    lines,
    labelFontSize,
    x,
    y,
    width,
    height,
    iconReserve,
    wrapMode: props.textMode === "vertical" ? "vertical" : forceSingle ? "single-line" : "multiline",
    overflowRisk,
    hasExplicitBreak,
  };
}

function labelClassFor(layout) {
  return [
    "basemap-node-label",
    layout.wrapMode === "vertical" ? "text-vertical" : "",
    layout.rotation ? "text-rotated" : "",
    layout.wrapMode === "single-line" ? "text-single-line" : "text-multiline",
  ].filter(Boolean).join(" ");
}

function labelStyle(cell, zIndexLayer) {
  const layout = labelLayoutFor(cell, zIndexLayer);
  return [
    `left:${layout.x}px`,
    `top:${layout.y}px`,
    `width:${layout.width}px`,
    `height:${layout.height}px`,
    `color:${layout.color}`,
    `font-family:${layout.fontFamily}`,
    `font-size:${layout.labelFontSize}px`,
    `font-weight:${layout.font.weight}`,
    `font-style:${layout.font.italic}`,
    `text-decoration:${layout.font.decoration}`,
    `text-align:${layout.align}`,
    `justify-content:${layout.justify}`,
    `align-items:${layout.alignItems}`,
    layout.wrapMode === "vertical" ? "writing-mode:vertical-lr" : "",
    layout.wrapMode === "vertical" ? "text-orientation:mixed" : "",
    layout.wrapMode === "single-line" ? "white-space:nowrap" : "white-space:normal",
    layout.iconReserve && layout.wrapMode !== "vertical" ? `padding-right:${layout.iconReserve}px` : "",
  ].filter(Boolean).join(";");
}

function objectTypeFor(cell, label) {
  const style = cell.style;
  const normalized = String(label || "");
  if (style.shape === "mxgraph.archimate3.actor") return "actor";
  if (style.appType === "location") return "environment_zone";
  if (style.appType === "grouping") return "environment_segment";
  if (normalized.includes("边界")) return "network_boundary";
  if (style.appType === "netw" && /互联网|外联网|广域网/.test(normalized)) return "external_network";
  if (["facility", "node", "device", "sysSw", "comp"].includes(style.appType || "")) return "information_object";
  return "unknown";
}

function nodeStyle(cell) {
  const props = nodeVisualProperties(cell);
  return [
    `background:${props.fill}`,
    `border:${props.strokeWidth}px ${props.borderStyle} ${props.stroke}`,
    `border-radius:${props.rounded}px`,
    `color:${props.color}`,
    `font-family:${props.fontFamily}`,
    `--basemap-symbol-size:${props.iconSize}px`,
    `--basemap-symbol-offset:${props.iconOffset}px`,
    props.rotation ? `transform:rotate(${props.rotation}deg)` : "",
    props.rotation ? "transform-origin:center center" : "",
  ].filter(Boolean).join(";");
}

function nodeTextStyle(cell) {
  const props = nodeVisualProperties(cell);
  return [
    `--basemap-symbol-size:${props.iconSize}px`,
    `--basemap-symbol-offset:${props.iconOffset}px`,
  ].filter(Boolean).join(";");
}

function renderActorMark(cell) {
  if (cell.style.shape !== "mxgraph.archimate3.actor") return "";
  return `<span class="basemap-actor-mark" aria-hidden="true"></span>`;
}

function iconSvg(type) {
  const stroke = "currentColor";
  const outline = `fill="none" stroke="${stroke}" stroke-width="1.2" stroke-miterlimit="10"`;
  const filled = `fill="${stroke}" stroke="none"`;
  const group = (content, transform = "translate(2.5 2.5)") => `<g transform="${transform}">${content}</g>`;
  if (type === "location") {
    return group(`<path d="M4.5 0 C2.56 0 0 1.51 0 4.5 C0 6.11 0.7 7.17 1.37 8.23 C2.61 10.18 3.85 11.99 4.5 15 C5.15 11.99 6.39 10.18 7.63 8.23 C8.3 7.17 9 6.11 9 4.5 C9 1.51 6.44 0 4.5 0 Z" ${outline}/><circle cx="4.5" cy="4.5" r="1.35" ${filled}/>`, "translate(5.5 2.5)");
  }
  if (type === "network") {
    return group(`<path d="M3.75 2.2 L10.5 2.2 L6.75 8.8 L0 8.8 Z" ${outline}/><ellipse cx="3.75" cy="2.2" rx="2.25" ry="2.2" ${filled}/><ellipse cx="10.5" cy="2.2" rx="2.25" ry="2.2" ${filled}/><ellipse cx="0" cy="8.8" rx="2.25" ry="2.2" ${filled}/><ellipse cx="6.75" cy="8.8" rx="2.25" ry="2.2" ${filled}/>`, "translate(4.1 4)");
  }
  if (type === "device") {
    return group(`<rect x="0" y="0" width="15" height="13.2" rx="1.5" ry="1.5" ${outline}/><path d="M1.5 13.2 L0 15 L15 15 L13.5 13.2" ${outline}/>`);
  }
  if (type === "system-software") {
    return group(`<ellipse cx="9.75" cy="5.25" rx="5.25" ry="5.25" ${outline}/><ellipse cx="7.35" cy="7.35" rx="7.35" ry="7.35" ${outline}/>`);
  }
  if (type === "component" || type === "artifact") {
    return group(`<rect x="4.25" y="0" width="9.75" height="15" ${outline}/><rect x="1" y="3.75" width="6.5" height="2.25" ${outline}/><rect x="1" y="9" width="6.5" height="2.25" ${outline}/>`);
  }
  if (type === "function") {
    return group(`<path d="M7.5 0 L15 3 L15 15 L7.5 12 L0 15 L0 3 Z" ${outline}/>`);
  }
  if (type === "service") {
    return group(`<path d="M10.5 0 C12.99 0 15 2.01 15 4.5 C15 6.99 12.99 9 10.5 9 L4.5 9 C2.01 9 0 6.99 0 4.5 C0 2.01 2.01 0 4.5 0 Z" ${outline}/>`, "translate(2.5 5.5)");
  }
  if (type === "data") {
    return group(`<path d="M0 0 L15 0 L15 9 L0 9 Z M0 1.8 L15 1.8" ${outline}/>`, "translate(2.5 5.5)");
  }
  if (type === "node") {
    return group(`<path d="M0 3.75 L3.75 0 L15 0 L15 11.25 L11.25 15 L0 15 Z M0 3.75 L11.25 3.75 L11.25 15 M15 0 L11.25 3.75" ${outline}/>`);
  }
  if (type === "grouping") {
    return group(`<path d="M0 3.3 L15 3.3 L15 11 L0 11 Z M0 3.3 L0 0 L11.25 0 L11.25 3.3" fill="none" stroke="${stroke}" stroke-width="1.2" stroke-miterlimit="10" stroke-dasharray="3 3"/>`, "translate(2.5 4)");
  }
  if (type === "facility") {
    return group(`<path d="M0 15 L0 0 L1.95 0 L1.95 10.5 L6.3 8.25 L6.3 10.5 L10.65 8.25 L10.65 10.5 L15 8.25 L15 15 Z" ${outline}/>`);
  }
  return "";
}

function renderArchimateCornerIconSvg(legendIconType) {
  const content = iconSvg(legendIconType);
  if (!content) return "";
  return `<svg class="basemap-corner-icon-svg" viewBox="0 0 20 20" aria-hidden="true" focusable="false">${content}</svg>`;
}

function shouldRenderCornerIcon(iconType, legendIconType) {
  return Boolean(iconType && legendIconType && !["unknown", "actor"].includes(iconType) && legendIconType !== "unknown");
}

function renderAppTypeMark(cell) {
  const label = textFromValue(cell.value);
  const drawioType = visualTypeFor(cell, label);
  const iconType = iconTypeFor(drawioType);
  const legendIconType = legendIconTypeFor(drawioType);
  if (!shouldRenderCornerIcon(iconType, legendIconType)) return "";
  return `<span class="basemap-corner-icon basemap-node-symbol" data-icon-type="${escapeHtml(iconType)}" data-legend-icon-type="${escapeHtml(legendIconType)}" data-app-type="${escapeHtml(cell.style.appType || "")}" aria-hidden="true">${renderArchimateCornerIconSvg(legendIconType)}</span>`;
}

function rectArea(geometry) {
  return Math.max(1, geometry.width) * Math.max(1, geometry.height);
}

function centerInside(outer, inner) {
  const centerX = inner.x + inner.width / 2;
  const centerY = inner.y + inner.height / 2;
  return (
    centerX > outer.x &&
    centerX < outer.x + outer.width &&
    centerY > outer.y &&
    centerY < outer.y + outer.height
  );
}

function containedVertexCount(cell, cells, cellMap) {
  if (!cell.vertex) return 0;
  const geometry = absoluteGeometry(cell, cellMap);
  const area = rectArea(geometry);
  return cells.filter((other) => {
    if (!other.vertex || other.id === cell.id) return false;
    if (other.parent === cell.id) return true;
    const otherGeometry = absoluteGeometry(other, cellMap);
    if (rectArea(otherGeometry) >= area * 0.82) return false;
    return centerInside(geometry, otherGeometry);
  }).length;
}

function zIndexLayerFor(cell, cells, cellMap, drawioType) {
  const rule = styleRuleFor(drawioType);
  if (rule.zIndexLayer === "container") return "container";
  const geometry = rawGeometry(cell);
  if (geometry.width >= 120 && geometry.height >= 75 && containedVertexCount(cell, cells, cellMap) > 0) return "container";
  return "node";
}

function renderNodeParts(cell, cells, cellMap, canvas, pageIndex) {
  const originalGeometry = absoluteGeometry(cell, cellMap);
  const geometry = normalizeGeometry(originalGeometry, canvas);
  const label = textFromValue(cell.value);
  const lines = textLines(cell.value);
  const objectType = objectTypeFor(cell, label);
  const drawioType = visualTypeFor(cell, label);
  const iconType = iconTypeFor(drawioType);
  const legendIconType = legendIconTypeFor(drawioType);
  const zIndexLayer = zIndexLayerFor(cell, cells, cellMap, drawioType);
  const left = geometry.x;
  const top = geometry.y;
  const labelHtml = lines.map((line) => escapeHtml(line)).join("<br />");
  const labelClass = labelClassFor(labelLayoutFor(cell, zIndexLayer));
  const labelInlineStyle = labelStyle(cell, zIndexLayer);
  const typeMarkClass = shouldRenderCornerIcon(iconType, legendIconType) ? " has-corner-icon has-app-type-mark" : "";
  const baseNode = `
    <div
      class="basemap-node basemap-node-${escapeHtml(objectType)} type-${escapeHtml(cssToken(drawioType))} icon-${escapeHtml(cssToken(iconType))} layer-${escapeHtml(zIndexLayer)}${zIndexLayer === "container" ? " is-container-node" : ""}${typeMarkClass}"
      data-mx-id="${escapeHtml(cell.id)}"
      data-mx-parent="${escapeHtml(cell.parent)}"
      data-label="${escapeHtml(label)}"
      data-drawio-type="${escapeHtml(drawioType)}"
      data-icon-type="${escapeHtml(iconType)}"
      data-legend-icon-type="${escapeHtml(legendIconType)}"
      data-z-index-layer="${escapeHtml(zIndexLayer)}"
      data-object-id=""
      data-object-type="${escapeHtml(objectType)}"
      data-object-code=""
      data-bind-status="unbound"
      data-source-page="${pageIndex}"
      data-mx-order="${cell.order}"
      role="button"
      tabindex="0"
      title="${escapeHtml(label ? `${label} · ${cell.id}` : cell.id)}"
      style="left:${left}px;top:${top}px;width:${geometry.width}px;height:${geometry.height}px;${nodeStyle(cell)}"
    >
      ${zIndexLayer === "container" ? "" : `${renderActorMark(cell)}<span class="${escapeHtml(labelClass)}" style="${escapeHtml(labelInlineStyle)}">${labelHtml}</span>${renderAppTypeMark(cell)}`}
    </div>
  `;
  if (zIndexLayer !== "container") return { container: "", node: baseNode, overlay: "" };
  const overlay = `
    <div
      class="basemap-node-label-overlay type-${escapeHtml(cssToken(drawioType))} icon-${escapeHtml(cssToken(iconType))}${typeMarkClass}"
      data-mx-id-label="${escapeHtml(cell.id)}"
      data-drawio-type="${escapeHtml(drawioType)}"
      data-icon-type="${escapeHtml(iconType)}"
      data-legend-icon-type="${escapeHtml(legendIconType)}"
      aria-hidden="true"
      style="left:${left}px;top:${top}px;width:${geometry.width}px;height:${geometry.height}px;${nodeTextStyle(cell)}"
    >
      ${renderActorMark(cell)}
      <span class="${escapeHtml(labelClass)}" style="${escapeHtml(labelInlineStyle)}">${labelHtml}</span>
      ${renderAppTypeMark(cell)}
    </div>
  `;
  return { container: baseNode, node: "", overlay };
}

function renderEdge(cell, cellMap, canvas) {
  const route = routedEdge(cell, cellMap);
  const d = route.points.map((point, index) => `${index ? "L" : "M"} ${point.x - canvas.x} ${point.y - canvas.y}`).join(" ");
  if (!d) return "";
  const stroke = drawioColor(cell.style.strokeColor, "#48586b");
  const dashed = cell.style.dashed === "1" ? " is-dashed" : "";
  const strokeWidth = Math.max(1, number(cell.style.strokeWidth, 1));
  const endMarker = arrowMarker(cell.style.endArrow, "end");
  const startMarker = arrowMarker(cell.style.startArrow, "start");
  const endArrow = endMarker ? ` marker-end="url(#${endMarker})"` : "";
  const startArrow = startMarker ? ` marker-start="url(#${startMarker})"` : "";
  const dash = dashArray(cell.style, strokeWidth);
  const dashAttr = dash ? ` stroke-dasharray="${escapeHtml(dash)}"` : "";
  return `<path class="basemap-edge basemap-edge-background${dashed}" data-mx-id="${escapeHtml(cell.id)}" data-mx-source="${escapeHtml(cell.source)}" data-mx-target="${escapeHtml(cell.target)}" data-edge-style="${escapeHtml(cell.style.edgeStyle || "")}" data-route-kind="${escapeHtml(route.routeKind)}" d="${d}" fill="none" stroke="${escapeHtml(stroke)}" stroke-width="${strokeWidth}"${dashAttr}${startArrow}${endArrow}></path>`;
}

function renderHtml(page, cells, edgesToRender, cellMap, canvas) {
  const edges = edgesToRender.map((cell) => renderEdge(cell, cellMap, canvas)).join("\n");
  const nodeParts = cells.filter((cell) => cell.vertex).map((cell) => renderNodeParts(cell, cells, cellMap, canvas, page.index));
  const containers = nodeParts.map((part) => part.container).filter(Boolean).join("\n");
  const nodes = nodeParts.map((part) => part.node).filter(Boolean).join("\n");
  const overlays = nodeParts.map((part) => part.overlay).filter(Boolean).join("\n");
  return `
<div class="environment-basemap" data-source="drawio" data-source-page="${page.index}" style="width:${canvas.width}px;height:${canvas.height}px;">
  <div class="environment-basemap-container-layer environment-basemap-business-container-layer" data-layer="businessContainerLayer">
    ${containers}
  </div>
  <svg class="environment-basemap-edges environment-basemap-background-edge-layer" data-layer="backgroundEdgeLayer" width="${canvas.width}" height="${canvas.height}" viewBox="0 0 ${canvas.width} ${canvas.height}" aria-hidden="true" focusable="false">
    <defs>
      <marker id="basemapArrowOpen" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="9" markerHeight="9" orient="auto"><path d="M 1 1 L 9 5 L 1 9" fill="none" stroke="#48586b" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"></path></marker>
      <marker id="basemapArrowOpenStart" viewBox="0 0 10 10" refX="1" refY="5" markerWidth="9" markerHeight="9" orient="auto"><path d="M 9 1 L 1 5 L 9 9" fill="none" stroke="#48586b" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"></path></marker>
      <marker id="basemapArrowBlock" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="9" markerHeight="9" orient="auto"><path d="M 1 1 L 9 5 L 1 9 Z" fill="#48586b" stroke="#48586b"></path></marker>
      <marker id="basemapArrowBlockStart" viewBox="0 0 10 10" refX="1" refY="5" markerWidth="9" markerHeight="9" orient="auto"><path d="M 9 1 L 1 5 L 9 9 Z" fill="#48586b" stroke="#48586b"></path></marker>
      <marker id="basemapArrowOval" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="8" markerHeight="8" orient="auto"><circle cx="5" cy="5" r="3" fill="#48586b" stroke="#48586b"></circle></marker>
      <marker id="basemapArrowOvalStart" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="8" markerHeight="8" orient="auto"><circle cx="5" cy="5" r="3" fill="#48586b" stroke="#48586b"></circle></marker>
    </defs>
    ${edges}
  </svg>
  <div class="environment-basemap-node-layer" data-layer="nodeLayer">
    ${nodes}
  </div>
  <div class="environment-basemap-label-layer environment-basemap-label-icon-layer" data-layer="labelIconLayer">
    ${overlays}
  </div>
</div>
`.trim();
}

function renderCss() {
  return `
.environment-basemap {
  position: relative;
  overflow: hidden;
  background: transparent;
  isolation: isolate;
}

.environment-basemap-container-layer,
.environment-basemap-edges,
.environment-basemap-node-layer,
.environment-basemap-label-layer {
  position: absolute;
  inset: 0;
}

.environment-basemap-container-layer {
  z-index: 10;
}

.environment-basemap-edges {
  z-index: 20;
  pointer-events: none;
}

.basemap-edge {
  stroke-linecap: round;
  stroke-linejoin: round;
  vector-effect: non-scaling-stroke;
}

.basemap-edge.is-dashed {
  stroke-dasharray: 6 12;
}

.environment-basemap-node-layer {
  z-index: 30;
}

.environment-basemap-label-layer {
  z-index: 40;
  pointer-events: none;
}

.basemap-node,
.basemap-node-label-overlay {
  position: absolute;
  box-sizing: border-box;
  display: block;
  overflow: hidden;
  letter-spacing: 0;
  user-select: none;
  overflow-wrap: normal;
  word-break: keep-all;
}

.basemap-node {
  cursor: pointer;
}

.basemap-node.layer-container {
  z-index: auto;
}

.basemap-node.layer-node {
  z-index: auto;
}

.basemap-node-label-overlay {
  z-index: auto;
  pointer-events: none;
  background: transparent !important;
  border-color: transparent !important;
}

.basemap-node:hover,
.basemap-node:focus-visible,
.basemap-node.is-selected {
  outline: 3px solid rgba(74, 144, 226, 0.55);
  outline-offset: 2px;
}

.basemap-node[data-bind-status="bound"],
.basemap-node[data-bind-status="candidate"],
.basemap-node[data-bind-status="ignored"] {
  opacity: 1;
  box-shadow: none;
}

.basemap-node-label {
  position: absolute;
  box-sizing: border-box;
  display: flex;
  z-index: 1;
  overflow: hidden;
  pointer-events: none;
  line-height: 1.12;
  overflow-wrap: normal;
  word-break: keep-all;
}

.basemap-node-label.text-vertical {
  line-height: 1.05;
}

.basemap-node-label.text-single-line {
  white-space: nowrap;
}

.basemap-node-label.text-multiline {
  white-space: normal;
  overflow-wrap: anywhere;
  word-break: break-word;
}

.basemap-node-label.text-vertical {
  white-space: nowrap;
  padding-right: 0 !important;
}

.basemap-corner-icon,
.basemap-node-symbol {
  position: absolute;
  right: var(--basemap-symbol-offset, 5px);
  top: var(--basemap-symbol-offset, 5px);
  z-index: 2;
  width: var(--basemap-symbol-size, 14px);
  height: var(--basemap-symbol-size, 14px);
  box-sizing: border-box;
  display: block;
  color: currentColor;
  pointer-events: none;
}

.basemap-corner-icon-svg {
  display: block;
  width: 100%;
  height: 100%;
  overflow: visible;
}

.type-grouping {
  border-style: dashed !important;
}

.type-location,
.type-environment-zone {
  background: #efd1e4;
}

.type-application-function,
.type-application-service {
  border-radius: 999px !important;
}

.basemap-actor-mark {
  position: absolute;
  left: 50%;
  top: 26%;
  width: 42%;
  height: 62%;
  transform: translateX(-50%);
  pointer-events: none;
}

.basemap-actor-mark::before {
  position: absolute;
  left: 50%;
  top: 0;
  width: 24%;
  aspect-ratio: 1;
  transform: translateX(-50%);
  border: 2px solid #2f3b4a;
  border-radius: 999px;
  background: #ffff99;
  content: "";
}

.basemap-actor-mark::after {
  position: absolute;
  left: 50%;
  top: 25%;
  width: 78%;
  height: 76%;
  transform: translateX(-50%);
  background:
    linear-gradient(#2f3b4a, #2f3b4a) 50% 0 / 2px 60% no-repeat,
    linear-gradient(#2f3b4a, #2f3b4a) 50% 23% / 100% 2px no-repeat,
    linear-gradient(58deg, transparent 47%, #2f3b4a 48% 52%, transparent 53%) 50% 100% / 64% 50% no-repeat,
    linear-gradient(-58deg, transparent 47%, #2f3b4a 48% 52%, transparent 53%) 50% 100% / 64% 50% no-repeat;
  content: "";
}
`.trim();
}

function countBy(items, keyFn) {
  const result = {};
  for (const item of items) {
    const key = keyFn(item) || "unknown";
    result[key] = (result[key] || 0) + 1;
  }
  return result;
}

function buildSemantic(page, cells, edgesToRender, cellMap, canvas, contentBounds) {
  const nodes = cells.filter((cell) => cell.vertex).map((cell) => {
    const original = absoluteGeometry(cell, cellMap);
    const normalized = normalizeGeometry(original, canvas);
    const raw = rawGeometry(cell);
    const label = textFromValue(cell.value);
    const drawioType = visualTypeFor(cell, label);
    const iconType = iconTypeFor(drawioType);
    const legendIconType = legendIconTypeFor(drawioType);
    const props = nodeVisualProperties(cell);
    const zIndexLayer = zIndexLayerFor(cell, cells, cellMap, drawioType);
    const layout = labelLayoutFor(cell, zIndexLayer);
    return {
      mxId: cell.id,
      parentMxId: cell.parent,
      label,
      drawioType,
      iconType,
      legendIconType,
      drawioObjectType: objectTypeFor(cell, label),
      objectType: objectTypeFor(cell, label),
      objectCode: "",
      x: normalized.x,
      y: normalized.y,
      rawX: raw.x,
      rawY: raw.y,
      width: normalized.width,
      height: normalized.height,
      originalGeometry: original,
      normalizedGeometry: normalized,
      fontSize: props.fontSize,
      labelFontSize: layout.labelFontSize,
      fontWeight: props.font.weight,
      fontColor: props.color,
      fontStyle: props.font,
      align: props.align,
      verticalAlign: props.verticalAlign,
      fillColor: props.fill,
      strokeColor: props.stroke,
      strokeWidth: props.strokeWidth,
      borderStyle: props.borderStyle,
      shape: cell.style.shape || "",
      rotation: props.rotation,
      textMode: props.textMode,
      textWrapMode: layout.wrapMode,
      textOverflowRisk: layout.overflowRisk,
      labelGeometry: {
        x: layout.x,
        y: layout.y,
        width: layout.width,
        height: layout.height,
      },
      zIndexLayer,
      styleRuleSource: props.rule.styleSource,
      style: cell.style,
      bindStatus: "unbound",
      order: cell.order,
    };
  });
  const edges = edgesToRender.map((cell) => {
    const route = routedEdge(cell, cellMap);
    const strokeWidth = Math.max(1, number(cell.style.strokeWidth, 1));
    return {
      mxId: cell.id,
      sourceMxId: cell.source,
      targetMxId: cell.target,
      edgeStyle: cell.style.edgeStyle || "",
      points: cell.points,
      renderedPoints: route.points.map((point) => ({
        x: point.x,
        y: point.y,
        normalizedX: point.x - canvas.x,
        normalizedY: point.y - canvas.y,
        as: point.as || "",
      })),
      orthogonal: route.orthogonal,
      routeKind: route.routeKind,
      dashed: cell.style.dashed === "1",
      startArrow: cell.style.startArrow || "",
      endArrow: cell.style.endArrow || "",
      strokeColor: drawioColor(cell.style.strokeColor, "#48586b"),
      strokeWidth,
      zIndexLayer: "backgroundEdgeLayer",
      unsupportedReason: route.unsupportedReason,
      style: cell.style,
      order: cell.order,
    };
  });
  const styleSummary = {
    drawioTypes: countBy(nodes, (node) => node.drawioType),
    iconTypes: countBy(nodes, (node) => node.iconType),
    legendIconTypes: countBy(nodes, (node) => node.legendIconType),
    zIndexLayers: countBy(nodes, (node) => node.zIndexLayer),
    textModes: countBy(nodes, (node) => node.textMode),
    overflowRiskNodes: nodes.filter((node) => node.textOverflowRisk).map((node) => ({ mxId: node.mxId, label: node.label, textMode: node.textMode, width: node.width, height: node.height, fontSize: node.fontSize })),
    unknownNodes: nodes.filter((node) => node.drawioType === "unknown").map((node) => ({ mxId: node.mxId, label: node.label, shape: node.shape, appType: node.style?.appType || "" })),
    unsupportedIconTypes: ["application_function", "application_service", "data_object"].filter((type) => !nodes.some((node) => node.iconType === type)),
    edgeRouteKinds: countBy(edges, (edge) => edge.routeKind),
    unsupportedEdges: edges.filter((edge) => edge.unsupportedReason).map((edge) => ({ mxId: edge.mxId, edgeStyle: edge.edgeStyle, reason: edge.unsupportedReason })),
    requiredStyleMapTypes: Object.keys(DRAWIO_ELEMENT_STYLE_MAP),
    legendStyleSource: LEGEND_STYLE_SOURCE,
  };
  return {
    source: {
      file: SOURCE_PATH,
      page: page.index,
      pageName: PAGE_NAME,
      generated_at: new Date().toISOString(),
      parser: "direct mxGraphModel parser; drawio CLI unavailable locally",
    },
    canvas: {
      x: canvas.x,
      y: canvas.y,
      width: canvas.width,
      height: canvas.height,
    },
    contentBounds: {
      minX: contentBounds.minX,
      minY: contentBounds.minY,
      maxX: contentBounds.maxX,
      maxY: contentBounds.maxY,
      padding: CANVAS_PADDING,
    },
    stats: {
      cells: cells.filter((cell) => cell.vertex || cell.edge).length,
      nodes: nodes.length,
      edges: edges.length,
      ignoredEdges: cells.filter((cell) => cell.edge).length - edges.length,
    },
    styleSummary,
    limitations: [
      "未调用官方 draw.io / diagrams.net 渲染器；本机未检测到 drawio 或 diagrams.net CLI。",
      "edgeStyle 自动路由不重新执行；按 source/target、entry/exit 和显式 mxPoint 生成 polyline/path，并保留 dashed、startArrow、endArrow、strokeColor、strokeWidth。",
      "对象区域外部端点保留在 semantic renderedPoints 中，但不参与 canvas contentBounds，避免外部箭头撑大白板。",
      "当前源页没有可靠出现 application_function、application_service、data_object 类型；不会凭标签臆造这些角标。",
      "角标复用 SAPD 元素图例页 SVG 路径逻辑，但未执行 diagrams.net 的运行时抗锯齿与主题色算法。",
    ],
    nodes,
    edges,
  };
}

function buildStyleFidelityReport(semantic) {
  const presentDrawioTypes = Object.keys(semantic.styleSummary.drawioTypes).sort();
  const presentIconTypes = Object.keys(semantic.styleSummary.iconTypes).sort();
  const requiredIconTypes = [
    "application_component",
    "application_function",
    "application_service",
    "data_object",
    "system_software",
    "device",
    "node",
    "communication_network",
    "facility",
    "location",
    "grouping",
    "actor",
  ];
  const iconRestoration = Object.fromEntries(requiredIconTypes.map((type) => {
    const present = presentIconTypes.includes(type);
    const drawioType = {
      application_component: "application_component",
      application_function: "application_function",
      application_service: "application_service",
      data_object: "data_object",
      system_software: "system_software",
      communication_network: "communication_network",
    }[type] || type;
    const rule = styleRuleFor(drawioType);
    const restored = rule.legendIconType !== "unknown" && (present || DRAWIO_ELEMENT_STYLE_MAP[drawioType]);
    return [type, {
      status: restored ? (present ? "restored" : "rule_ready_not_present_in_source") : "missing",
      drawioType,
      legendIconType: rule.legendIconType,
      styleSource: rule.styleSource,
    }];
  }));
  const unsupportedStyles = [
    "未执行 diagrams.net 官方 shape renderer，因此复杂边线自动避障和浏览器抗锯齿不会与原工具逐像素一致。",
    "edgeStyle 使用直接 renderer：原始 waypoint 优先；无 waypoint 的 orthogonal / elbow 使用直角 fallback；不执行 diagrams.net 自动避障。",
    ...semantic.styleSummary.unknownNodes.map((node) => `unknown node ${node.mxId}: ${node.label || "(空标签)"} shape=${node.shape || "(none)"} appType=${node.appType || "(none)"}`),
    ...semantic.styleSummary.unsupportedEdges.map((edge) => `unsupported edge ${edge.mxId}: ${edge.edgeStyle || "(none)"} ${edge.reason}`),
  ];
  return {
    generated_at: semantic.source.generated_at,
    source: semantic.source,
    legendStyleSource: LEGEND_STYLE_SOURCE,
    drawioElementStyleMap: DRAWIO_ELEMENT_STYLE_MAP,
    recognizedDrawioTypes: presentDrawioTypes,
    recognizedIconTypes: presentIconTypes,
    zIndexLayers: semantic.styleSummary.zIndexLayers,
    textModes: semantic.styleSummary.textModes,
    overflowRiskNodes: semantic.styleSummary.overflowRiskNodes,
    edgeRouteKinds: semantic.styleSummary.edgeRouteKinds,
    unsupportedEdges: semantic.styleSummary.unsupportedEdges,
    whiteboardBackgroundRendered: false,
    iconRestoration,
    fontRules: {
      priority: ["mxCell style.fontSize", "mxCell style.fontStyle", "mxCell style.align / verticalAlign / spacing", "mxCell style.textDirection / rotation", "container label box", "drawioElementStyleMap fallback"],
      largeLabels: "IT / OT / L1-L4 / 园区 / 分支机构 / 数据中心机房 / 传统数据中心 / 云数据中心 / 运维管理网使用更大字号和粗体。",
      verticalText: "textDirection=vertical-lr 使用 writing-mode: vertical-lr；窄矩形按 label box 显示，不用浏览器默认横排挤压。",
      singleLine: "无显式换行且估算宽度可容纳时使用 nowrap，避免短文本被拆行。",
      multiline: "显式换行或估算宽度过长时才允许 multiline，并限制在 label box 内。",
    },
    edgeRules: {
      waypointPriority: "mxPoint waypoints are rendered as source -> waypoints -> target polyline.",
      orthogonalFallback: "orthogonalEdgeStyle / elbowEdgeStyle without waypoints route as H-V-H or V-H-V polyline.",
      noCenterDiagonalDefault: "source-center to target-center diagonal is not used for orthogonal/elbow edges.",
      zIndexLayer: "All current edges render in backgroundEdgeLayer under nodes and label/icon overlays.",
    },
    layerRules: {
      background: "Viewer grid only; generated basemap background is transparent.",
      container: "large containers and grouped blocks render in businessContainerLayer.",
      edge: "SVG edges render in backgroundEdgeLayer above container fills and below ordinary nodes.",
      node: "ordinary business/object nodes render above edges.",
      labelIcon: "container labels and all corner icons render in label/icon overlay above edges.",
      interactionOverlay: "hover/focus/selected outline only; binding state does not recolor or gray nodes.",
    },
    contentBounds: semantic.contentBounds,
    canvas: semantic.canvas,
    stats: semantic.stats,
    unsupportedStyles,
  };
}

function renderStyleFidelityReportMarkdown(report) {
  const iconRows = Object.entries(report.iconRestoration)
    .map(([type, item]) => `| ${type} | ${item.status} | ${item.legendIconType} | ${item.styleSource} |`)
    .join("\n");
  const unsupported = report.unsupportedStyles.map((item) => `- ${item}`).join("\n");
  const overflowRows = report.overflowRiskNodes.length
    ? report.overflowRiskNodes.map((node) => `| ${node.mxId} | ${node.label} | ${node.textMode} | ${node.width}×${node.height} | ${node.fontSize} |`).join("\n")
    : "| 无 | 无 | 无 | 无 | 无 |";
  return `# Environment Basemap Style Fidelity Report

生成时间：${report.generated_at}

## 图例样式来源

${report.legendStyleSource}

## 已识别 drawioType

${report.recognizedDrawioTypes.join(", ")}

## 已识别 iconType

${report.recognizedIconTypes.join(", ")}

## Renderer 指标

\`\`\`json
${JSON.stringify({
  edgeRouteKinds: report.edgeRouteKinds,
  textModes: report.textModes,
  zIndexLayers: report.zIndexLayers,
  whiteboardBackgroundRendered: report.whiteboardBackgroundRendered,
  unsupportedEdges: report.unsupportedEdges.length,
  overflowRiskNodes: report.overflowRiskNodes.length,
}, null, 2)}
\`\`\`

## 角标还原

| iconType | 状态 | legendIconType | 样式来源 |
| --- | --- | --- | --- |
${iconRows}

## 字体规则

- 优先级：${report.fontRules.priority.join(" > ")}
- 大标签：${report.fontRules.largeLabels}
- 竖排文字：${report.fontRules.verticalText}
- 单行短文本：${report.fontRules.singleLine}
- 多行文本：${report.fontRules.multiline}

## 文本溢出风险节点

| mxId | label | textMode | size | fontSize |
| --- | --- | --- | --- | --- |
${overflowRows}

## 连线规则

- waypoint 优先：${report.edgeRules.waypointPriority}
- 正交 fallback：${report.edgeRules.orthogonalFallback}
- 默认行为：${report.edgeRules.noCenterDiagonalDefault}
- 图层：${report.edgeRules.zIndexLayer}

## 层级规则

- background：${report.layerRules.background}
- container：${report.layerRules.container}
- edge：${report.layerRules.edge}
- node：${report.layerRules.node}
- labelIcon：${report.layerRules.labelIcon}
- interactionOverlay：${report.layerRules.interactionOverlay}

## contentBounds

\`\`\`json
${JSON.stringify({ canvas: report.canvas, contentBounds: report.contentBounds, stats: report.stats }, null, 2)}
\`\`\`

## 仍无法还原的样式

${unsupported || "- 无 unknown 节点；仅保留官方 renderer / router 不可用限制。"}
`;
}

const sourceXml = fs.readFileSync(SOURCE_PATH, "utf8");
const page = extractPage(sourceXml);
const cells = parseCells(page.body);
const cellMap = new Map(cells.map((cell) => [cell.id, cell]));
const vertexBoundsForEdges = buildVertexBounds(cells, cellMap);
const edgesToRender = renderableEdges(cells, cellMap, vertexBoundsForEdges);
const contentBounds = buildContentBounds(cells, cellMap, edgesToRender);
const canvas = buildCanvas(contentBounds);
const semantic = buildSemantic(page, cells, edgesToRender, cellMap, canvas, contentBounds);
const styleFidelityReport = buildStyleFidelityReport(semantic);
const html = renderHtml(page, cells, edgesToRender, cellMap, canvas);
const css = renderCss();
const manifest = {
  title: PAGE_NAME,
  pageIndex: page.index,
  source: SOURCE_PATH,
  generatedFrom: semantic.source.parser,
  htmlPath: "./generated/environmentBasemap.html",
  cssPath: "./generated/environmentBasemap.css",
  semanticPath: "./generated/environmentBasemap.semantic.json",
  styleFidelityReportPath: "./generated/environmentBasemap.style-fidelity-report.json",
  fidelityReportPath: "./generated/environmentBasemap.fidelity-report.json",
  canvas,
  contentBounds: semantic.contentBounds,
  stats: semantic.stats,
  styleSummary: semantic.styleSummary,
  limitations: semantic.limitations,
};

fs.mkdirSync(OUTPUT_DIR, { recursive: true });
fs.writeFileSync(OUTPUT_HTML_PATH, html);
fs.writeFileSync(OUTPUT_CSS_PATH, css);
fs.writeFileSync(OUTPUT_SEMANTIC_PATH, `${JSON.stringify(semantic, null, 2)}\n`);
fs.writeFileSync(OUTPUT_STYLE_REPORT_JSON_PATH, `${JSON.stringify(styleFidelityReport, null, 2)}\n`);
fs.writeFileSync(OUTPUT_STYLE_REPORT_MD_PATH, renderStyleFidelityReportMarkdown(styleFidelityReport));
fs.writeFileSync(OUTPUT_FIDELITY_REPORT_JSON_PATH, `${JSON.stringify(styleFidelityReport, null, 2)}\n`);
fs.writeFileSync(OUTPUT_FIDELITY_REPORT_MD_PATH, renderStyleFidelityReportMarkdown(styleFidelityReport));
fs.writeFileSync(
  OUTPUT_JS_PATH,
  `// Generated by scripts/generate_environment_basemap_from_drawio.mjs from draw.io page "${PAGE_NAME}". Do not edit by hand.\n(function () {\n  window.sapdEnvironmentBasemapData = Object.freeze(${JSON.stringify(manifest, null, 2)});\n})();\n`,
);

console.log(JSON.stringify({ output: OUTPUT_HTML_PATH, css: OUTPUT_CSS_PATH, semantic: OUTPUT_SEMANTIC_PATH, manifest: OUTPUT_JS_PATH, styleFidelityReport: OUTPUT_STYLE_REPORT_JSON_PATH, fidelityReport: OUTPUT_FIDELITY_REPORT_JSON_PATH, title: PAGE_NAME, pageIndex: page.index, ...semantic.stats }, null, 2));
