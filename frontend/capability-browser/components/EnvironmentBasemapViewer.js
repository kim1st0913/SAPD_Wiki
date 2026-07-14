(function () {
  const components = (window.sapdComponents = window.sapdComponents || {});
  const display = window.sapdDisplay || {};

  const SVG_PATH = "./generated/environmentBasemap.svg?v=environment-basemap-svg-20260612-data-sharing-1";
  const SEMANTIC_PATH = "./generated/environmentBasemap.semantic.json";
  const DETAILS_PATH = "./generated/environmentBasemap.node-details.json";
  const MIN_SCALE = 0.05;
  const MAX_SCALE = 4;
  const FIT_PADDING = 0.92;
  const PAN_EDGE_GUARD = 72;
  const DETAIL_TYPE_LABELS = {
    environment_category: "归类节点",
    environment: "信息化环境",
    environment_container: "信息化环境",
    environment_segment: "环境子类",
    environment_object_category: "环境子类",
    information_object: "信息化对象",
    security_scope: "网络边界 / 作用域",
    network_boundary: "网络边界 / 作用域",
    communication_network: "图示 / 归类节点",
    internal_component: "内部组成元素",
    application_component: "信息化对象",
    system_software: "信息化对象",
    device: "信息化对象",
    node: "信息化对象",
    data_object: "信息化对象",
    actor: "角色",
    ignored: "图示 / 归类节点 / 外联环境",
    unknown: "未知类型",
  };
  const SOURCE_FIELD_LABELS = {
    informationObject: "信息化对象",
    informationEnvironment: "信息化环境",
    owningEnvironment: "所属信息化环境",
    owningSegment: "所属环境子类",
    environmentSegment: "环境子类",
    objectCategory: "环境子类",
    parentObject: "所属上级对象",
    scope: "作用域",
    securityService: "安全技术服务",
    securityModule: "安全技术模块",
    securityMeasure: "安全技术措施",
    securitySystemProduct: "安全系统 / 产品",
    securityModuleMeasure: "安全技术模块 / 措施",
    childInformationObject: "下属信息化对象",
    summary: "汇总统计",
    relatedObject: "关联对象",
    scopeName: "作用域名",
    directScopeGroups: "直接作用域与服务",
    inheritedScopeGroups: "继承关系",
    note: "说明",
  };

  const text = (value) => (value == null ? "" : String(value));
  const escapeHtml = (value) =>
    text(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");

  const stateByRoot = new WeakMap();

  function annotationValueAttrs(value) {
    const raw = text(value).trim();
    if (!raw) return "";
    const sharedAttrs = display.annotationValueAttrs?.({ escapeHtml, text }, raw);
    if (sharedAttrs) return sharedAttrs;
    const escaped = escapeHtml(raw);
    return ` data-annotation-value="true" data-copy-text="${escaped}" data-annotation-tooltip="${escaped}"`;
  }

  async function fetchText(url) {
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) throw new Error(`${url} HTTP ${response.status}`);
    return response.text();
  }

  async function fetchJson(url) {
    return JSON.parse(await fetchText(url));
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function objectBusinessKey(item) {
    if (!item) return "";
    const type = text(item.objectType || item.type).trim();
    const contextKey = text(item.objectContextKey || item.contextKey).trim();
    const code = text(item.objectCode || item.code).trim();
    const name = text(item.objectName || item.title || item.name || item.text).trim();
    const id = text(item.objectId || item.id).trim();
    if (type === "information_object" && contextKey) return `${type}:${contextKey}`;
    if (code) return `${type}:${code}`;
    if (name) return `${type}:${name}`;
    return `${type}:${id || JSON.stringify(item)}`;
  }

  function uniqueById(items) {
    const result = [];
    const seen = new Set();
    for (const item of items || []) {
      if (!item) continue;
      const key = objectBusinessKey(item);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      result.push(item);
    }
    return result;
  }

  function collectServices(detail) {
    const services = [];
    for (const mapping of detail?.directScopeGroups || detail?.scopeMappings || []) services.push(...(mapping.services || []));
    return uniqueById(services);
  }

  function collectModules(detail) {
    const modules = [];
    for (const mapping of detail?.directScopeGroups || detail?.scopeMappings || []) modules.push(...(mapping.modules || []));
    for (const service of collectServices(detail)) modules.push(...(service.modules || []));
    return uniqueById(modules);
  }

  function collectMeasures(detail) {
    const measures = [];
    for (const mapping of detail?.directScopeGroups || detail?.scopeMappings || []) measures.push(...(mapping.measures || []));
    for (const service of collectServices(detail)) measures.push(...(service.measures || []));
    for (const module of collectModules(detail)) measures.push(...(module.measures || []));
    return uniqueById(measures);
  }

  function splitScopeItem(scope) {
    if (!scope) return [];
    const code = text(scope.objectCode || scope.code).trim();
    if (code) return [scope];
    const label = text(scope.objectName || scope.title || scope.text || scope.name).trim();
    if (!label) return [scope];
    const parsed = label
      .split(/(?=I-[A-Z]{2}\b)/g)
      .map((chunk) => chunk.trim())
      .filter(Boolean)
      .map((chunk) => {
        const match = chunk.match(/^(I-[A-Z]{2})\s*(.+)$/);
        if (!match) return null;
        return {
          ...scope,
          objectId: match[1],
          objectCode: match[1],
          objectName: match[2].trim(),
        };
      })
      .filter(Boolean);
    return parsed.length ? parsed : [scope];
  }

  function collectScopes(detail) {
    return uniqueById((detail?.directScopeGroups || detail?.scopeMappings || []).flatMap((mapping) => splitScopeItem(mapping.scope)));
  }

  function collectSecuritySystems(detail) {
    const systems = [];
    for (const mapping of detail?.directScopeGroups || detail?.scopeMappings || []) systems.push(...(mapping.securitySystems || []), ...(mapping.systems || []));
    for (const service of collectServices(detail)) systems.push(...(service.securitySystems || []), ...(service.systems || []));
    for (const module of collectModules(detail)) systems.push(...(module.securitySystems || []), ...(module.systems || []));
    return uniqueById(systems);
  }

  function collectProducts(detail) {
    const products = [];
    for (const mapping of detail?.directScopeGroups || detail?.scopeMappings || []) products.push(...(mapping.products || []));
    for (const service of collectServices(detail)) products.push(...(service.products || []));
    for (const module of collectModules(detail)) products.push(...(module.products || []));
    return uniqueById(products);
  }

  function parseViewBox(svg) {
    const box = svg.viewBox?.baseVal;
    if (box?.width && box?.height) {
      return { x: box.x, y: box.y, width: box.width, height: box.height, source: "viewBox" };
    }
    const raw = text(svg.getAttribute("viewBox")).trim().split(/\s+/).map(Number);
    if (raw.length === 4 && raw.every(Number.isFinite) && raw[2] > 0 && raw[3] > 0) {
      return { x: raw[0], y: raw[1], width: raw[2], height: raw[3], source: "viewBox" };
    }
    const width = Number.parseFloat(svg.getAttribute("width")) || 1600;
    const height = Number.parseFloat(svg.getAttribute("height")) || 900;
    return { x: 0, y: 0, width, height, source: "fallback-size" };
  }

  function parseSvg(svgText) {
    const doc = new DOMParser().parseFromString(svgText, "image/svg+xml");
    const parserError = doc.querySelector("parsererror");
    if (parserError) throw new Error("environmentBasemap.svg 解析失败");
    const svg = doc.documentElement;
    const viewBox = parseViewBox(svg);
    svg.classList.add("basemap-lab-inline-svg");
    svg.removeAttribute("id");
    svg.setAttribute("role", "img");
    svg.setAttribute("aria-label", "信息化环境及对象底图官方 Draw.io SVG");
    svg.setAttribute("width", String(viewBox.width));
    svg.setAttribute("height", String(viewBox.height));
    svg.style.width = `${viewBox.width}px`;
    svg.style.height = `${viewBox.height}px`;
    svg.style.setProperty("color-scheme", "only light", "important");
    svg.style.setProperty("forced-color-adjust", "none", "important");
    return { svg: document.importNode(svg, true), viewBox };
  }

  function emptyVisibility() {
    return {
      loaded: false,
      inlineSvgCount: 0,
      svgClientWidth: 0,
      svgClientHeight: 0,
      svgRect: "0x0",
      firstPathOrRectCount: 0,
      visible: false,
    };
  }

  function viewerOptions(root) {
    return {
      fitPadding: FIT_PADDING,
    };
  }

  function createState(root) {
    return {
      options: viewerOptions(root),
      visibility: emptyVisibility(),
      semantic: null,
      detailsPayload: null,
      nodes: [],
      nodeByMxId: new Map(),
      detailsByMxId: new Map(),
      ignoredByMxId: new Map(),
      objectIdToMxIds: new Map(),
      hitStats: { ready: false, nodes: 0, bbox: 0, fallback: 0 },
      viewBox: null,
      scale: 1,
      x: 0,
      y: 0,
      fitScale: 1,
      error: "",
      selectedMxId: "",
      highlightedMxIds: new Set(),
      drag: null,
      suppressNextClick: false,
    };
  }

  function indexData(state, semantic, detailsPayload) {
    state.semantic = semantic;
    state.detailsPayload = detailsPayload;
    state.nodes = semantic?.nodes || [];
    state.nodeByMxId = new Map(state.nodes.map((node) => [node.mxId, node]));
    state.detailsByMxId = new Map(Object.entries(detailsPayload?.nodeDetailsByMxId || {}));
    state.ignoredByMxId = new Map((detailsPayload?.ignoredNodes || []).map((node) => [node.mxId, node]));
    state.objectIdToMxIds = new Map();
    for (const node of state.nodes) {
      if (!node.objectId) continue;
      const ids = state.objectIdToMxIds.get(node.objectId) || [];
      ids.push(node.mxId);
      state.objectIdToMxIds.set(node.objectId, ids);
    }
  }

  function measureVisibility(root) {
    const host = root.querySelector("[data-basemap-svg-host]");
    const inlineSvgs = host ? [...host.querySelectorAll(":scope > svg")] : [];
    const svg = inlineSvgs[0] || null;
    const rect = svg?.getBoundingClientRect?.();
    const visibility = {
      loaded: Boolean(svg),
      inlineSvgCount: inlineSvgs.length,
      svgClientWidth: Math.round(svg?.clientWidth || 0),
      svgClientHeight: Math.round(svg?.clientHeight || 0),
      svgRect: rect ? `${Math.round(rect.width)}x${Math.round(rect.height)}` : "0x0",
      firstPathOrRectCount: svg?.querySelectorAll?.("path, rect")?.length || 0,
      visible: false,
    };
    visibility.visible =
      visibility.loaded &&
      visibility.inlineSvgCount === 1 &&
      visibility.svgClientWidth > 0 &&
      visibility.svgClientHeight > 0 &&
      rect &&
      rect.width > 0 &&
      rect.height > 0;
    return visibility;
  }

  function isUsableFitBox(box, viewBox) {
    if (!box || !viewBox) return false;
    if (!Number.isFinite(box.x) || !Number.isFinite(box.y) || !Number.isFinite(box.width) || !Number.isFinite(box.height)) return false;
    if (box.width <= 0 || box.height <= 0) return false;
    if (box.width > viewBox.width * 1.08 || box.height > viewBox.height * 1.08) return false;
    return true;
  }

  function unionBoxes(boxes) {
    if (!boxes.length) return null;
    const minX = Math.min(...boxes.map((box) => box.x));
    const minY = Math.min(...boxes.map((box) => box.y));
    const maxX = Math.max(...boxes.map((box) => box.x + box.width));
    const maxY = Math.max(...boxes.map((box) => box.y + box.height));
    return { x: minX, y: minY, width: maxX - minX, height: maxY - minY, source: "svg-cell-bbox" };
  }

  function semanticContentBoundsInSvg(state) {
    const bounds = state?.semantic?.contentBounds;
    const canvas = state?.semantic?.canvas;
    const viewBox = state?.viewBox;
    if (!bounds || !viewBox) return null;
    const contentWidth = Math.max(Number(bounds.maxX) - Number(bounds.minX), 1);
    const contentHeight = Math.max(Number(bounds.maxY) - Number(bounds.minY), 1);
    if (canvas?.width && canvas?.height) {
      const scaleX = viewBox.width / Math.max(Number(canvas.width), 1);
      const scaleY = viewBox.height / Math.max(Number(canvas.height), 1);
      return {
        x: (Number(bounds.minX) - Number(canvas.x || 0)) * scaleX,
        y: (Number(bounds.minY) - Number(canvas.y || 0)) * scaleY,
        width: Math.max(contentWidth * scaleX, 1),
        height: Math.max(contentHeight * scaleY, 1),
        source: "semantic-content-bounds",
      };
    }
    return {
      x: viewBox.x || 0,
      y: viewBox.y || 0,
      width: Math.max(contentWidth * (viewBox.width / contentWidth), 1),
      height: Math.max(contentHeight * (viewBox.height / contentHeight), 1),
      source: "semantic-content-bounds",
    };
  }

  function measureSvgContentBounds(svg, state) {
    const viewBox = state?.viewBox;
    if (!svg || !viewBox) return null;
    const boxes = [...svg.querySelectorAll("[data-cell-id]")]
      .map((cell) => {
        const cellId = cell.getAttribute("data-cell-id");
        if (cellId === "0" || cellId === "1") return null;
        try {
          const box = cell.getBBox?.();
          return box ? { x: box.x, y: box.y, width: box.width, height: box.height } : null;
        } catch (_error) {
          return null;
        }
      })
      .filter((box) => isUsableFitBox(box, viewBox));
    const svgBounds = unionBoxes(boxes);
    if (isUsableFitBox(svgBounds, viewBox)) return svgBounds;
    const semanticBounds = semanticContentBoundsInSvg(state);
    if (isUsableFitBox(semanticBounds, viewBox)) return semanticBounds;
    return null;
  }

  function getFitBounds(state) {
    return state.viewBox || { x: 0, y: 0, width: 1600, height: 900, source: "fallback-size" };
  }

  function clampPanToBounds(root) {
    const state = stateByRoot.get(root);
    const viewport = root.querySelector("[data-basemap-lab-viewport]");
    if (!state || !viewport) return;
    const bounds = getFitBounds(state);
    const viewportWidth = viewport.clientWidth || 1;
    const viewportHeight = viewport.clientHeight || 1;
    const scaledWidth = bounds.width * state.scale;
    const scaledHeight = bounds.height * state.scale;

    const clampAxis = (viewportSize, scaledSize, minCoord, maxCoord, current) => {
      if (scaledSize <= viewportSize - PAN_EDGE_GUARD * 2) {
        return (viewportSize - scaledSize) / 2 - minCoord * state.scale;
      }
      const minTranslate = viewportSize - PAN_EDGE_GUARD - maxCoord * state.scale;
      const maxTranslate = PAN_EDGE_GUARD - minCoord * state.scale;
      return clamp(current, minTranslate, maxTranslate);
    };

    state.x = clampAxis(viewportWidth, scaledWidth, bounds.x, bounds.x + bounds.width, state.x);
    state.y = clampAxis(viewportHeight, scaledHeight, bounds.y, bounds.y + bounds.height, state.y);
  }

  function applyTransform(root) {
    const state = stateByRoot.get(root);
    const host = root.querySelector("[data-basemap-svg-host]");
    if (!state || !host) return;
    clampPanToBounds(root);
    host.style.transform = `translate(${state.x}px, ${state.y}px) scale(${state.scale})`;
    const inverseScale = 1 / Math.max(state.scale || 1, MIN_SCALE);
    host.style.setProperty("--basemap-hit-outline-width", `${2 * inverseScale}px`);
    host.style.setProperty("--basemap-hit-selected-width", `${3 * inverseScale}px`);
    host.style.setProperty("--basemap-hit-ring-width", `${4 * inverseScale}px`);
    positionPopover(root);
    updateStatus(root);
  }

  function fitToScreen(root) {
    const state = stateByRoot.get(root);
    const viewport = root.querySelector("[data-basemap-lab-viewport]");
    if (!state || !viewport) return;
    const bounds = getFitBounds(state);
    const viewportWidth = viewport.clientWidth || 1;
    const viewportHeight = viewport.clientHeight || 1;
    const scale = clamp(
      Math.min(viewportWidth / bounds.width, viewportHeight / bounds.height) * (state.options?.fitPadding || FIT_PADDING),
      MIN_SCALE,
      MAX_SCALE,
    );
    state.scale = scale;
    state.fitScale = scale;
    state.x = (viewportWidth - bounds.width * scale) / 2 - bounds.x * scale;
    state.y = (viewportHeight - bounds.height * scale) / 2 - bounds.y * scale;
    applyTransform(root);
  }

  function refitSoon(root) {
    if (!root?.isConnected) return;
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        if (root.isConnected) fitToScreen(root);
      });
    });
  }

  function refitAfterLayout(root) {
    refitSoon(root);
    window.setTimeout(() => {
      if (root?.isConnected) fitToScreen(root);
    }, 120);
    window.setTimeout(() => {
      if (root?.isConnected) fitToScreen(root);
    }, 360);
  }

  function zoomAt(root, nextScale, point) {
    const state = stateByRoot.get(root);
    const viewport = root.querySelector("[data-basemap-lab-viewport]");
    if (!state || !viewport) return;
    const scale = clamp(nextScale, MIN_SCALE, MAX_SCALE);
    const rect = viewport.getBoundingClientRect();
    const focusX = point?.x ?? rect.width / 2;
    const focusY = point?.y ?? rect.height / 2;
    const worldX = (focusX - state.x) / state.scale;
    const worldY = (focusY - state.y) / state.scale;
    state.scale = scale;
    state.x = focusX - worldX * scale;
    state.y = focusY - worldY * scale;
    applyTransform(root);
  }

  function setHostSize(root) {
    const state = stateByRoot.get(root);
    const host = root.querySelector("[data-basemap-svg-host]");
    const layer = root.querySelector("[data-basemap-hit-layer]");
    if (!state?.viewBox || !host) return;
    host.style.width = `${state.viewBox.width}px`;
    host.style.height = `${state.viewBox.height}px`;
    if (layer) {
      layer.style.width = `${state.viewBox.width}px`;
      layer.style.height = `${state.viewBox.height}px`;
    }
  }

  function getSvgCell(svg, mxId) {
    if (!svg || !mxId) return null;
    return [...svg.querySelectorAll("[data-cell-id]")].find((cell) => cell.getAttribute("data-cell-id") === mxId) || null;
  }

  function semanticFallbackBox(node, state) {
    const bounds = state?.semantic?.contentBounds;
    const viewBox = state?.viewBox;
    const original = node.originalGeometry;
    if (bounds && viewBox && original) {
      const contentWidth = Math.max(Number(bounds.maxX) - Number(bounds.minX), 1);
      const contentHeight = Math.max(Number(bounds.maxY) - Number(bounds.minY), 1);
      const scaleX = viewBox.width / contentWidth;
      const scaleY = viewBox.height / contentHeight;
      return {
        x: (Number(original.x || 0) - Number(bounds.minX || 0)) * scaleX,
        y: (Number(original.y || 0) - Number(bounds.minY || 0)) * scaleY,
        width: Math.max(Number(original.width || 1) * scaleX, 1),
        height: Math.max(Number(original.height || 1) * scaleY, 1),
        source: "semantic-content-bounds",
      };
    }
    const geometry = node.normalizedGeometry || node.originalGeometry || node;
    const x = Number(geometry.x ?? node.x ?? 0);
    const y = Number(geometry.y ?? node.y ?? 0);
    const width = Number(geometry.width ?? node.width ?? 1);
    const height = Number(geometry.height ?? node.height ?? 1);
    return { x, y, width: Math.max(width, 1), height: Math.max(height, 1), source: "semantic" };
  }

  function isUsableSvgBox(box, state) {
    if (!box || box.width <= 0 || box.height <= 0) return false;
    const viewBox = state?.viewBox;
    if (!viewBox) return true;
    if (box.width > viewBox.width * 1.05 || box.height > viewBox.height * 1.05) return false;
    if (box.x < viewBox.x - viewBox.width || box.y < viewBox.y - viewBox.height) return false;
    return true;
  }

  function bboxForNode(svg, node, state) {
    const cell = getSvgCell(svg, node.mxId);
    if (cell?.getBBox) {
      try {
        const box = cell.getBBox();
        if (isUsableSvgBox(box, state)) {
          return { x: box.x, y: box.y, width: box.width, height: box.height, source: "svg-getBBox" };
        }
      } catch (_error) {
        // Fall through to semantic geometry.
      }
    }
    return semanticFallbackBox(node, state);
  }

  function buildHitLayer(root) {
    const state = stateByRoot.get(root);
    const host = root.querySelector("[data-basemap-svg-host]");
    const svg = host?.querySelector(":scope > svg");
    if (!state || !host || !svg) return;
    let layer = root.querySelector("[data-basemap-hit-layer]");
    if (!layer) {
      layer = document.createElement("div");
      layer.className = "basemap-hit-layer";
      layer.setAttribute("data-basemap-hit-layer", "");
      host.append(layer);
    }
    layer.innerHTML = "";
    setHostSize(root);

    let bboxCount = 0;
    let fallbackCount = 0;
    const hitItems = state.nodes.map((node) => {
      const box = bboxForNode(svg, node, state);
      if (box.source === "svg-getBBox") bboxCount += 1;
      else fallbackCount += 1;
      return { node, box, area: Math.max(box.width, 1) * Math.max(box.height, 1) };
    });
    hitItems.sort((a, b) => b.area - a.area);
    hitItems.forEach(({ node, box }, index) => {
      const hit = document.createElement("button");
      hit.type = "button";
      hit.className = "basemap-hit-node";
      hit.dataset.mxId = node.mxId;
      hit.dataset.bindStatus = node.bindStatus || "";
      hit.dataset.objectId = node.objectId || "";
      hit.setAttribute("aria-label", `${node.label || node.mxId} ${node.bindStatus || ""}`);
      hit.style.left = `${box.x}px`;
      hit.style.top = `${box.y}px`;
      hit.style.width = `${Math.max(box.width, 6)}px`;
      hit.style.height = `${Math.max(box.height, 6)}px`;
      hit.style.zIndex = String(index + 1);
      if (node.bindStatus === "ignored") hit.classList.add("is-ignored");
      layer.append(hit);
    });
    state.hitStats = { ready: true, nodes: state.nodes.length, bbox: bboxCount, fallback: fallbackCount };
  }

  function collectHighlight(root, mxId) {
    const state = stateByRoot.get(root);
    const node = state?.nodeByMxId.get(mxId);
    const detail = state?.detailsByMxId.get(mxId);
    const highlighted = new Set(mxId ? [mxId] : []);
    const graphObjectIds = new Set();

    if (node?.objectId) graphObjectIds.add(node.objectId);
    if (detail?.objectId) graphObjectIds.add(detail.objectId);
    for (const objectId of graphObjectIds) {
      for (const relatedMxId of state.objectIdToMxIds.get(objectId) || []) highlighted.add(relatedMxId);
    }

    return { highlighted };
  }

  function applyHighlight(root) {
    const state = stateByRoot.get(root);
    if (!state) return;
    const hits = root.querySelectorAll(".basemap-hit-node");
    for (const hit of hits) {
      const mxId = hit.dataset.mxId || "";
      hit.classList.toggle("is-selected", state.selectedMxId === mxId);
      hit.classList.toggle("is-related", state.selectedMxId && state.highlightedMxIds.has(mxId) && state.selectedMxId !== mxId);
      hit.classList.toggle(
        "is-dimmed",
        Boolean(state.selectedMxId) &&
          !state.highlightedMxIds.has(mxId) &&
          hit.dataset.bindStatus !== "ignored",
      );
    }
  }

  function announceBasemapStatus(root, message) {
    const region = root.querySelector("[data-basemap-live-status]");
    const value = text(message).trim();
    if (!region || !value) return;
    region.textContent = "";
    window.setTimeout(() => {
      if (region.isConnected) region.textContent = value;
    }, 0);
  }

  function selectNode(root, mxId) {
    const state = stateByRoot.get(root);
    if (!state) return;
    const node = state.nodeByMxId.get(mxId);
    if (!node) return;
    state.selectedMxId = mxId;
    if (node.bindStatus === "ignored") {
      state.highlightedMxIds = new Set([mxId]);
    } else {
      const summary = collectHighlight(root, mxId);
      state.highlightedMxIds = summary.highlighted;
    }
    applyHighlight(root);
    updateStatus(root);
    updateDetail(root);
    announceBasemapStatus(root, `已定位 ${node.label || mxId}，详情已打开`);
  }

  function clearSelection(root) {
    const state = stateByRoot.get(root);
    if (!state?.selectedMxId) return;
    const selectedLabel = state.nodeByMxId.get(state.selectedMxId)?.label || state.selectedMxId;
    state.selectedMxId = "";
    state.highlightedMxIds = new Set();
    applyHighlight(root);
    updateStatus(root);
    updateDetail(root);
    announceBasemapStatus(root, `已清除 ${selectedLabel} 的定位状态`);
  }

  function renderStatus(root) {
    const state = stateByRoot.get(root) || createState();
    const visibility = state.visibility || emptyVisibility();
    const boundNodes = state.nodes.filter((node) => node.bindStatus === "bound").length;
    const ignoredNodes = state.nodes.filter((node) => node.bindStatus === "ignored").length;
    const chips = [
      ["SVG", visibility.loaded ? "ready" : "missing", visibility.loaded ? "is-ok" : "is-warn"],
      ["semantic", state.nodes.length ? "ready" : "pending", state.nodes.length ? "is-ok" : "is-warn"],
      ["details", state.detailsByMxId.size ? "ready" : "pending", state.detailsByMxId.size ? "is-ok" : "is-warn"],
      ["bound", boundNodes || "0", ""],
      ["ignored", ignoredNodes || "0", ""],
      ["zoom", `${Math.round((state.scale || 1) * 100)}%`, ""],
    ];
    if (state.error) chips.push(["error", state.error, "is-warn"]);
    return chips
      .map(
        ([label, value, className]) =>
          `<span class="environment-basemap-lab-status-pill ${className}"><small>${escapeHtml(label)}</small><strong>${escapeHtml(value)}</strong></span>`,
      )
      .join("");
  }

  function renderDebug(root) {
    const state = stateByRoot.get(root) || createState();
    const visibility = state.visibility || emptyVisibility();
    const viewBox = state.viewBox || {};
    const rows = [
      ["loaded", visibility.loaded],
      ["inlineSvgCount", visibility.inlineSvgCount],
      ["svgClientWidth", visibility.svgClientWidth],
      ["svgClientHeight", visibility.svgClientHeight],
      ["svgRect", visibility.svgRect],
      ["firstPathOrRectCount", visibility.firstPathOrRectCount],
      ["visible", visibility.visible],
      ["semanticNodes", state.nodes.length],
      ["hitNodes", state.hitStats.nodes],
      ["hitBBox", state.hitStats.bbox],
      ["hitFallback", state.hitStats.fallback],
      ["details", state.detailsByMxId.size],
      ["viewBox", viewBox.width ? `${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}` : "unknown"],
      ["transform", `translate(${Math.round(state.x)}px, ${Math.round(state.y)}px) scale(${state.scale.toFixed(4)})`],
    ];
    return rows.map(([label, value]) => `<span><b>${escapeHtml(label)}</b>${escapeHtml(value)}</span>`).join("");
  }

  function updateStatus(root) {
    const state = stateByRoot.get(root);
    if (!state) return;
    state.visibility = measureVisibility(root);
    const status = root.querySelector("[data-basemap-lab-status]");
    const debug = root.querySelector("[data-basemap-lab-debug]");
    if (status) status.innerHTML = renderStatus(root);
    if (debug) debug.innerHTML = renderDebug(root);
  }

  function chipClassForKind(kind) {
    if (kind === "service") return "relation-chip technical-chip service-chip";
    if (kind === "module") return "relation-chip technical-chip module-chip";
    if (kind === "measure") return "relation-chip technical-chip measure-chip";
    if (kind === "system") return "relation-chip system-chip";
    if (kind === "product") return "relation-chip environment-chip";
    if (kind === "environment") return "sapd-pill pill--environment";
    if (kind === "segment") return "sapd-pill pill--segment";
    if (kind === "object") return "sapd-pill pill--object";
    if (kind === "scope") return "sapd-pill pill--scope";
    if (kind === "ignored") return "sapd-pill pill--ignored";
    if (kind === "status") return "sapd-pill pill--status";
    return "sapd-pill pill--status";
  }

  function chipKindLabel(kind) {
    if (kind === "service") return "安全技术服务";
    if (kind === "module") return "安全技术模块";
    if (kind === "measure") return "安全技术措施";
    if (kind === "system") return "安全系统";
    if (kind === "product") return "产品";
    if (kind === "scope") return "作用域";
    if (kind === "environment") return "信息化环境";
    if (kind === "segment") return "环境子类";
    if (kind === "object") return "信息化对象";
    return "";
  }

  function renderChipContent(item, kind) {
    const label = [item.objectCode, item.objectName].map((value) => text(value).trim()).filter(Boolean).join(" ") || item.objectId;
    const kindLabel = chipKindLabel(kind);
    if (!kindLabel) return escapeHtml(label);
    const textClass = kind === "service" || kind === "module" || kind === "measure" ? "relation-chip-text" : "sapd-pill-text";
    if (kind === "service") return `<span class="${textClass}">${escapeHtml(label)}</span>`;
    return `<em>${escapeHtml(kindLabel)}</em><span class="${textClass}">${escapeHtml(label)}</span>`;
  }

  function chipScopeAttrs(item, kind) {
    if (kind === "service") return display.serviceScopeAttrs?.({ escapeHtml }, item) || "";
    if (kind !== "scope") return "";
    const scopeCode = display.serviceScopeCode?.(item);
    if (!scopeCode) return "";
    const escaped = escapeHtml(scopeCode);
    return ` data-scope="${escaped}" data-scope-palette="${escaped}"`;
  }

  function renderList(items, kind = "") {
    const unique = uniqueById(items);
    if (!unique.length) return `<span class="environment-basemap-lab-empty">暂无映射</span>`;
    const chipClass = chipClassForKind(kind);
    const kindLabel = chipKindLabel(kind);
    return `
      <div class="environment-basemap-lab-chips">
        ${unique
          .map((item) => {
            const label = [item.objectCode, item.objectName].map((value) => text(value).trim()).filter(Boolean).join(" ") || item.objectId;
            return `<span class="${chipClass}"${annotationValueAttrs([kindLabel, label].filter(Boolean).join(" | "))}${chipScopeAttrs(item, kind)}>${renderChipContent(item, kind)}</span>`;
          })
          .join("")}
      </div>
    `;
  }

  function hasRelationMappings(detail) {
    return Boolean(detail?.scopeMappings?.length);
  }

  function segmentNames(detail) {
    return new Set((detail?.segments || []).map((segment) => segment.objectName).filter(Boolean));
  }

  function findInheritedRelationDetail(root, detail) {
    if (hasRelationMappings(detail)) return detail;
    const state = stateByRoot.get(root);
    if (!state || !detail?.objectName) return detail;
    const currentSegments = segmentNames(detail);
    const candidates = [...state.detailsByMxId.values()].filter((candidate) => {
      if (candidate === detail || !hasRelationMappings(candidate)) return false;
      const children = candidate.childInformationObjects || [];
      return children.some((child) => child.objectName === detail.objectName || child.objectId === detail.objectId);
    });
    candidates.sort((a, b) => {
      const score = (candidate) => {
        let value = 0;
        if (candidate.environment?.objectId && candidate.environment.objectId === detail.environment?.objectId) value += 4;
        if (candidate.environment?.objectName && candidate.environment.objectName === detail.environment?.objectName) value += 3;
        for (const segment of candidate.segments || []) {
          if (currentSegments.has(segment.objectName)) value += 2;
        }
        return value;
      };
      return score(b) - score(a);
    });
    return candidates[0] || detail;
  }

  function renderModuleMeasureList(detail) {
    const modules = collectModules(detail);
    const measures = collectMeasures(detail);
    if (!modules.length && !measures.length) return `<span class="environment-basemap-lab-empty">暂无映射</span>`;
    const moduleHtml = modules.length ? renderList(modules, "module") : "";
    const measureHtml = measures.length ? renderList(measures, "measure") : "";
    return `${moduleHtml}${measureHtml}`;
  }

  function renderScopeGroup(group) {
    if (!group?.scope) return "";
    const scopeItem = {
      objectId: group.scope.objectId,
      objectCode: group.scope.objectCode,
      objectName: group.scope.objectName || group.scope.objectCode || "未命名作用域",
    };
    return `
      <section class="environment-basemap-scope-group">
        <header>
          <b>作用域</b>
          ${renderList([scopeItem], "scope")}
        </header>
        <div class="environment-basemap-scope-group-body">
          <div>
            <b>安全技术服务</b>
            ${renderList(group.services || [], "service")}
          </div>
          <div>
            <b>安全技术模块</b>
            ${renderList(group.modules || [], "module")}
          </div>
          <div>
            <b>安全技术措施</b>
            ${renderList(group.measures || [], "measure")}
          </div>
        </div>
      </section>
    `;
  }

  function renderScopeGroups(groups) {
    const list = groups || [];
    if (!list.length) return `<span class="environment-basemap-lab-empty">暂无直接关系</span>`;
    return `<div class="environment-basemap-scope-groups">${list.map(renderScopeGroup).join("")}</div>`;
  }

  function renderInheritedScopeGroups(detail) {
    const groups = detail?.inheritedScopeGroups || [];
    if (!groups.length) return "";
    return `
      <details class="environment-basemap-inherited-groups">
        <summary>查看继承关系（${escapeHtml(groups.length)} 个作用域组，${escapeHtml(detail?.summary?.inheritedServiceCount || 0)} 个服务）</summary>
        ${renderScopeGroups(groups)}
      </details>
    `;
  }

  function field(label, body) {
    return `<div class="environment-basemap-lab-field"><dt>${escapeHtml(label)}</dt><dd>${body}</dd></div>`;
  }

  function sourceField(key, body) {
    return field(SOURCE_FIELD_LABELS[key] || key, body);
  }

  function countedField(label, items, kind) {
    const rows = uniqueById(items || []);
    return field(`${label}（${rows.length}）`, renderList(rows, kind));
  }

  function typeLabel(detailType) {
    return DETAIL_TYPE_LABELS[detailType] || detailType || DETAIL_TYPE_LABELS.unknown;
  }

  function summaryValue(summary, key) {
    const value = Number(summary?.[key] || 0);
    return Number.isFinite(value) ? value : 0;
  }

  function renderSummary(summary, items) {
    const chips = items
      .map(([label, key]) => `<span><b>${escapeHtml(label)}</b>${summaryValue(summary, key)}</span>`)
      .join("");
    return chips ? `<div class="environment-basemap-lab-summary-grid">${chips}</div>` : `<span class="environment-basemap-lab-empty">暂无统计</span>`;
  }

  function renderNote(message) {
    if (!message) return "";
    return `<p class="environment-basemap-lab-info-note">${escapeHtml(message)}</p>`;
  }

  function valueText(value) {
    const cleaned = text(value).trim();
    return cleaned || "待补充";
  }

  function renderValue(value) {
    return `<span class="environment-basemap-lab-value">${escapeHtml(valueText(value))}</span>`;
  }

  function groupsToItems(groups, key) {
    return uniqueById((groups || []).flatMap((group) => group?.[key] || []));
  }

  function renderScopesFromGroups(groups) {
    return renderList(
      (groups || [])
        .map((group) => group?.scope)
        .filter(Boolean)
        .map((scope) => ({
          objectId: scope.objectId,
          objectCode: scope.objectCode,
          objectName: scope.objectName || scope.objectCode || "未命名作用域",
        })),
      "scope",
    );
  }

  function segmentLabel(detail) {
    return detail?.objectCategoryName || (detail?.segments || []).map((segment) => segment.objectName).filter(Boolean).join("、") || "";
  }

  function detailObjectName(node, detail) {
    return detail?.objectName || node?.objectName || node?.label || "未命名节点";
  }

  function renderDetailShell(status, node, detail, body, className = "") {
    return `
      <article class="environment-basemap-lab-detail-card ${className}">
        <header>
          <div>
            <span>${escapeHtml(status || typeLabel(detail?.detailType))}</span>
            <h3>${escapeHtml(node?.label || detail?.label || detail?.objectName || "未命名节点")}</h3>
          </div>
          <button type="button" data-basemap-lab-popover-close aria-label="关闭详情">×</button>
        </header>
        ${body}
      </article>
    `;
  }

  function renderEnvironmentContainerDetail(node, detail) {
    const body = `
      <dl>
        ${sourceField("informationEnvironment", renderValue(detail.environmentName || detailObjectName(node, detail)))}
        ${sourceField("environmentSegment", renderList(detail.segments || [], "segment"))}
        ${sourceField("summary", renderSummary(detail.summary, [["下属对象数量", "childInformationObjectCount"], ["作用域数量", "inheritedScopeCount"], ["服务数量", "inheritedServiceCount"], ["模块数量", "inheritedModuleCount"], ["措施数量", "inheritedMeasureCount"]]))}
        ${sourceField("note", escapeHtml("该节点按信息化环境容器展示，仅显示汇总，不展开安全技术服务 / 模块 / 措施明细。"))}
      </dl>
    `;
    return renderDetailShell("信息化环境", node, detail, body);
  }

  function renderEnvironmentSegmentDetail(node, detail) {
    const body = `
      <dl>
        ${sourceField("owningEnvironment", renderValue(detail.environmentName))}
        ${sourceField("childInformationObject", renderList(detail.childInformationObjects || [], "object"))}
        ${sourceField("summary", renderSummary(detail.summary, [["下属对象数量", "childInformationObjectCount"], ["作用域数量", "inheritedScopeCount"], ["服务数量", "inheritedServiceCount"], ["模块数量", "inheritedModuleCount"], ["措施数量", "inheritedMeasureCount"]]))}
        ${sourceField("note", escapeHtml("该节点按环境子类 / 对象类别展示，仅显示汇总，不展开安全技术服务 / 模块 / 措施明细。"))}
      </dl>
    `;
    return renderDetailShell("环境子类", node, detail, body);
  }

  function renderInformationObjectDetail(root, node, detail) {
    const scopes = collectScopes(detail);
    const services = collectServices(detail);
    const modules = collectModules(detail);
    const measures = collectMeasures(detail);
    const systemProducts = uniqueById([...collectSecuritySystems(detail), ...collectProducts(detail)]);
    const body = `
        <dl>
          ${sourceField("owningEnvironment", renderValue(detail.environmentName))}
          ${sourceField("owningSegment", renderValue(segmentLabel(detail)))}
          ${countedField("作用域", scopes, "scope")}
          ${countedField("安全技术服务", services, "service")}
          ${countedField("安全技术模块", modules, "module")}
          ${countedField("安全技术措施", measures, "measure")}
          ${countedField("安全系统 / 产品", systemProducts, "system")}
          ${renderInheritedScopeGroups(detail)}
        </dl>
    `;
    return renderDetailShell(detail.objectSubtype || "信息化对象", node, detail, body);
  }

  function renderBoundaryDetail(root, node, detail) {
    const scopes = collectScopes(detail);
    const services = collectServices(detail);
    const modules = collectModules(detail);
    const measures = collectMeasures(detail);
    const systemProducts = uniqueById([...collectSecuritySystems(detail), ...collectProducts(detail)]);
    const body = `
      <dl>
        ${sourceField("owningEnvironment", renderValue(detail.environmentName))}
        ${sourceField("relatedObject", renderValue(detail.objectName || node.objectName || node.label))}
        ${countedField("作用域", scopes, "scope")}
        ${countedField("安全技术服务", services, "service")}
        ${countedField("安全技术模块", modules, "module")}
        ${countedField("安全技术措施", measures, "measure")}
        ${countedField("安全系统 / 产品", systemProducts, "system")}
      </dl>
    `;
    return renderDetailShell("网络边界 / 作用域", node, detail, body);
  }

  function renderCommunicationNetworkDetail(root, node, detail) {
    const body = `
      ${renderNote("该节点按图示 / 归类节点展示，不绑定保护对象数据。")}
      <dl>
        ${sourceField("note", escapeHtml("不绑定保护对象数据。"))}
      </dl>
    `;
    return renderDetailShell("图示 / 归类节点", node, detail, body, "is-ignored");
  }

  function renderInternalComponentDetail(root, node, detail) {
    const body = `
      ${renderNote(detail.detailNote || "该元素为底图内部组成元素，未独立展开服务 / 模块 / 措施。")}
      <dl>
        ${sourceField("owningEnvironment", renderValue(detail.environmentName))}
        ${sourceField("owningSegment", renderValue(segmentLabel(detail)))}
      </dl>
    `;
    return renderDetailShell(typeLabel(detail.detailType), node, detail, body);
  }

  function renderActorDetail(node, detail) {
    const body = `
      ${renderNote("该节点已绑定信息化对象数据；因其为人员角色，仅展示绑定上下文，不展开保护对象的安全技术服务 / 模块 / 措施清单。")}
      <dl>
        ${sourceField("owningEnvironment", renderValue(detail.environmentName))}
        ${sourceField("owningSegment", renderValue(segmentLabel(detail)))}
        ${sourceField("note", escapeHtml("绑定对象为人员角色，服务 / 模块 / 措施不在此模板中展开。"))}
      </dl>
    `;
    return renderDetailShell("绑定数据", node, detail, body);
  }

  function renderUnknownDetail(node, detail) {
    const body = `
      ${renderNote("该节点暂未被准确分类，当前只展示已知绑定摘要。")}
      <dl>
        ${sourceField("owningEnvironment", renderValue(detail?.environmentName))}
      </dl>
    `;
    return renderDetailShell("待确认", node, detail, body);
  }

  function renderBoundDetail(root, node, detail) {
    switch (detail.detailType) {
      case "environment":
      case "environment_container":
        return renderEnvironmentContainerDetail(node, detail);
      case "environment_object_category":
      case "environment_segment":
        return renderEnvironmentSegmentDetail(node, detail);
      case "information_object":
      case "application_component":
      case "system_software":
      case "device":
      case "node":
      case "data_object":
        return renderInformationObjectDetail(root, node, detail);
      case "network_boundary":
      case "security_scope":
        return renderBoundaryDetail(root, node, detail);
      case "communication_network":
        return renderCommunicationNetworkDetail(root, node, detail);
      case "internal_component":
        return renderInternalComponentDetail(root, node, detail);
      case "actor":
        return renderActorDetail(node, detail);
      default:
        return renderUnknownDetail(node, detail);
    }
  }

  function renderIgnoredDetail(node, ignored) {
    const body = `
        <p>该节点为图示 / 归类节点 / 角色 / 外联环境，不绑定保护对象数据。</p>
        <dl>
          ${sourceField("note", escapeHtml(ignored?.bindingReason || node?.bindingReason || "不绑定保护对象数据。"))}
        </dl>
    `;
    return renderDetailShell(typeLabel(ignored?.detailType || "ignored"), node, ignored, body, "is-ignored");
  }

  function updateDetail(root) {
    const state = stateByRoot.get(root);
    const detailRoot = root.querySelector("[data-basemap-lab-popover]");
    if (!state || !detailRoot) return;
    if (!state.selectedMxId) {
      detailRoot.innerHTML = "";
      detailRoot.classList.add("is-hidden");
      return;
    }
    const node = state.nodeByMxId.get(state.selectedMxId);
    if (node?.bindStatus === "ignored") {
      detailRoot.innerHTML = renderIgnoredDetail(node, state.ignoredByMxId.get(state.selectedMxId));
      detailRoot.classList.remove("is-hidden");
      window.requestAnimationFrame(() => positionPopover(root));
      return;
    }
    const detail = state.detailsByMxId.get(state.selectedMxId);
    if (!detail) {
      detailRoot.innerHTML = renderDetailShell(
        "missing",
        node,
        { label: state.selectedMxId },
        "<p>该节点未在 node-details 中找到详情记录。</p>",
      );
      detailRoot.classList.remove("is-hidden");
      window.requestAnimationFrame(() => positionPopover(root));
      return;
    }
    detailRoot.innerHTML = renderBoundDetail(root, node || detail, detail);
    detailRoot.classList.remove("is-hidden");
    window.requestAnimationFrame(() => positionPopover(root));
  }

  function hitNodeForMxId(root, mxId) {
    if (!mxId) return null;
    return [...root.querySelectorAll(".basemap-hit-node")].find((hit) => hit.dataset.mxId === mxId) || null;
  }

  function positionPopover(root) {
    const state = stateByRoot.get(root);
    const popover = root.querySelector("[data-basemap-lab-popover]");
    const viewport = root.querySelector("[data-basemap-lab-viewport]");
    const hit = hitNodeForMxId(root, state?.selectedMxId || "");
    if (!state?.selectedMxId || !popover || !viewport || !hit || popover.classList.contains("is-hidden")) return;

    const viewportRect = viewport.getBoundingClientRect();
    const hitRect = hit.getBoundingClientRect();
    const targetX = hitRect.left + hitRect.width / 2 - viewportRect.left;
    const targetY = hitRect.top + hitRect.height / 2 - viewportRect.top;
    const viewportWidth = viewport.clientWidth || 1;
    const viewportHeight = viewport.clientHeight || 1;
    const margin = 14;
    const gap = 18;

    popover.classList.remove("is-left", "is-right", "is-above", "is-below");
    popover.style.left = "0px";
    popover.style.top = "0px";
    popover.style.visibility = "hidden";

    const rect = popover.getBoundingClientRect();
    const cardWidth = Math.min(rect.width || 380, viewportWidth - margin * 2);
    const cardHeight = Math.min(rect.height || 260, viewportHeight - margin * 2);
    let left = targetX + gap;
    let top = clamp(targetY - cardHeight / 2, margin, viewportHeight - cardHeight - margin);
    let placement = "is-right";

    if (targetX + gap + cardWidth > viewportWidth - margin && targetX - gap - cardWidth >= margin) {
      left = targetX - gap - cardWidth;
      placement = "is-left";
    } else if (targetX + gap + cardWidth > viewportWidth - margin) {
      left = clamp(targetX - cardWidth / 2, margin, viewportWidth - cardWidth - margin);
      if (targetY + gap + cardHeight <= viewportHeight - margin) {
        top = targetY + gap;
        placement = "is-below";
      } else {
        top = clamp(targetY - gap - cardHeight, margin, viewportHeight - cardHeight - margin);
        placement = "is-above";
      }
    }

    popover.style.left = `${Math.round(left)}px`;
    popover.style.top = `${Math.round(top)}px`;
    popover.style.setProperty("--arrow-y", `${Math.round(clamp(targetY - top, 18, cardHeight - 18))}px`);
    popover.style.setProperty("--arrow-x", `${Math.round(clamp(targetX - left, 18, cardWidth - 18))}px`);
    popover.classList.add(placement);
    popover.style.visibility = "visible";
  }

  async function loadResources(root) {
    const state = stateByRoot.get(root);
    const host = root.querySelector("[data-basemap-svg-host]");
    if (!state || !host) return;
    host.innerHTML = "";
    state.error = "";
    updateStatus(root);
    try {
      const [svgText, semantic, detailsPayload] = await Promise.all([
        fetchText(SVG_PATH),
        fetchJson(SEMANTIC_PATH),
        fetchJson(DETAILS_PATH),
      ]);
      const { svg, viewBox } = parseSvg(svgText);
      state.viewBox = viewBox;
      indexData(state, semantic, detailsPayload);
      host.append(svg);
      setHostSize(root);
      updateStatus(root);
      fitToScreen(root);
      try {
        buildHitLayer(root);
      } catch (hitError) {
        state.error = `hit layer 初始化失败：${hitError?.message || hitError}`;
      }
      updateDetail(root);
      updateStatus(root);
      window.requestAnimationFrame(() => {
        if (!root.isConnected) return;
        setHostSize(root);
        updateStatus(root);
        if (!root.querySelector(".basemap-hit-node")) {
          try {
            buildHitLayer(root);
          } catch (hitError) {
            state.error = `hit layer 初始化失败：${hitError?.message || hitError}`;
          }
        }
        if (!root.querySelector("[data-basemap-svg-host]")?.style.transform) fitToScreen(root);
        updateStatus(root);
      });
      refitAfterLayout(root);
    } catch (error) {
      state.error = error?.message || "资源加载失败";
      host.innerHTML = `
        <div class="environment-basemap-lab-missing">
          <strong>环境底图实验页资源加载失败</strong>
          <span>请检查 SVG、semantic JSON 和 node-details JSON 是否存在。</span>
          <small>${escapeHtml(state.error)}</small>
        </div>
      `;
      updateStatus(root);
      updateDetail(root);
    }
  }

  function isAppFullscreen(root) {
    return root?.classList?.contains("is-app-fullscreen");
  }

  function setAppFullscreen(root, enabled) {
    root?.classList?.toggle("is-app-fullscreen", Boolean(enabled));
    document.body.classList.toggle("environment-basemap-app-fullscreen-active", Boolean(enabled));
    root?.querySelector?.('[data-basemap-lab-action="fullscreen"]')?.setAttribute("aria-pressed", enabled ? "true" : "false");
    refitAfterLayout(root);
  }

  function toggleFullscreen(root) {
    const target = root.querySelector(".environment-basemap-lab-main") || root;
    if (document.fullscreenElement) {
      Promise.resolve(document.exitFullscreen?.()).finally(() => setAppFullscreen(root, false));
      return;
    }
    if (isAppFullscreen(root)) {
      setAppFullscreen(root, false);
      return;
    }
    const request = target.requestFullscreen?.();
    if (request && typeof request.then === "function") request.then(() => refitAfterLayout(root)).catch(() => setAppFullscreen(root, true));
    else setAppFullscreen(root, true);
  }

  function bindControls(root) {
    const viewport = root.querySelector("[data-basemap-lab-viewport]");
    if (!viewport) return;

    root.addEventListener("click", (event) => {
      const state = stateByRoot.get(root);
      const hitNode = event.target?.closest?.(".basemap-hit-node");
      const popover = event.target?.closest?.("[data-basemap-lab-popover]");
      const popoverClose = event.target?.closest?.("[data-basemap-lab-popover-close]");
      const action = event.target?.closest?.("[data-basemap-lab-action]")?.dataset?.basemapLabAction;
      if (state?.suppressNextClick) {
        state.suppressNextClick = false;
        if (!hitNode && !popover && !popoverClose && !action) return;
      }
      if (popoverClose) {
        clearSelection(root);
        return;
      }
      if (popover) return;
      if (action) {
        if (!state) return;
        if (action === "fit" || action === "reset") {
          fitToScreen(root);
        } else if (action === "zoom-in") {
          zoomAt(root, state.scale * 1.18);
        } else if (action === "zoom-out") {
          zoomAt(root, state.scale / 1.18);
        } else if (action === "fullscreen") {
          toggleFullscreen(root);
        }
        return;
      }
      if (hitNode) {
        event.stopPropagation();
        selectNode(root, hitNode.dataset.mxId || "");
        return;
      }
      if (event.target?.closest?.(".basemap-lab-viewport")) clearSelection(root);
    });

    viewport.addEventListener(
      "wheel",
      (event) => {
        if (event.target?.closest?.("[data-basemap-lab-popover]")) {
          event.stopPropagation();
          return;
        }
        event.preventDefault();
        const state = stateByRoot.get(root);
        if (!state) return;
        const rect = viewport.getBoundingClientRect();
        const factor = event.deltaY < 0 ? 1.08 : 1 / 1.08;
        zoomAt(root, state.scale * factor, { x: event.clientX - rect.left, y: event.clientY - rect.top });
      },
      { passive: false },
    );

    viewport.addEventListener("pointerdown", (event) => {
      if (event.button !== 0 || event.target?.closest?.("[data-basemap-lab-popover]")) return;
      if (event.target?.closest?.(".basemap-hit-node")) return;
      const state = stateByRoot.get(root);
      if (!state) return;
      viewport.setPointerCapture?.(event.pointerId);
      state.drag = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        x: state.x,
        y: state.y,
        moved: false,
      };
      clearSelection(root);
      viewport.classList.add("is-dragging");
    });

    viewport.addEventListener("pointermove", (event) => {
      const state = stateByRoot.get(root);
      const drag = state?.drag;
      if (!drag || drag.pointerId !== event.pointerId) return;
      const dx = event.clientX - drag.startX;
      const dy = event.clientY - drag.startY;
      if (Math.hypot(dx, dy) > 4) drag.moved = true;
      state.x = drag.x + event.clientX - drag.startX;
      state.y = drag.y + event.clientY - drag.startY;
      applyTransform(root);
    });

    const endDrag = (event) => {
      const state = stateByRoot.get(root);
      if (!state?.drag || state.drag.pointerId !== event.pointerId) return;
      if (state.drag.moved) state.suppressNextClick = true;
      state.drag = null;
      viewport.classList.remove("is-dragging");
    };
    viewport.addEventListener("pointerup", endDrag);
    viewport.addEventListener("pointercancel", endDrag);

    const observer = new ResizeObserver(() => {
      const state = stateByRoot.get(root);
      if (state?.viewBox) fitToScreen(root);
    });
    observer.observe(viewport);

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && root.isConnected && isAppFullscreen(root)) {
        setAppFullscreen(root, false);
        return;
      }
      if (event.key === "Escape" && root.isConnected) clearSelection(root);
    });
    document.addEventListener("fullscreenchange", () => {
      if (!root.isConnected) return;
      if (document.fullscreenElement) setAppFullscreen(root, false);
      else root.querySelector('[data-basemap-lab-action="fullscreen"]')?.setAttribute("aria-pressed", "false");
      refitAfterLayout(root);
    });
  }

  function render(options = {}) {
    const title = options.title == null ? "环境底图实验页" : options.title;
    const subtitle = options.subtitle == null
      ? "官方 Draw.io SVG 视觉层 + 透明命中层"
      : options.subtitle;
    const showStatus = options.showStatus !== false;
    const showTitle = options.showTitle !== false;
    const rootClass = "is-lab-2";
    const rootAttr = options.rootAttr || "data-environment-basemap-lab";
    const actionsLabel = options.actionsLabel || "环境底图工具";
    const toolbarLeading = options.toolbarLeading || null;
    const toolbarSearch = options.toolbarSearch || null;
    const actions = `
      <div class="environment-basemap-lab-actions" aria-label="${escapeHtml(actionsLabel)}">
        <button type="button" data-basemap-lab-action="fit">适应屏幕</button>
        <button type="button" data-basemap-lab-action="zoom-out" aria-label="缩小">−</button>
        <button type="button" data-basemap-lab-action="zoom-in" aria-label="放大">+</button>
        <button type="button" data-basemap-lab-action="reset">还原</button>
        <button type="button" data-basemap-lab-action="fullscreen">全屏</button>
      </div>
    `;
    const titleBlock = showTitle
      ? `
          <div>
            <h2>${escapeHtml(title)}</h2>
            ${subtitle ? `<p>${escapeHtml(subtitle)}</p>` : ""}
          </div>
        `
      : `<div class="environment-basemap-lab-title-spacer" aria-hidden="true"></div>`;
    const toolbarBody = toolbarSearch
      ? `
          <div class="environment-basemap-lab-head-tools is-action-side">
            ${actions}
          </div>
          <div class="environment-basemap-lab-head-tools is-search-side">
            ${toolbarSearch}
            ${showStatus ? `<div class="environment-basemap-lab-status" data-basemap-lab-status>${renderStatus({})}</div>` : ""}
          </div>
        `
      : `
          ${toolbarLeading || titleBlock}
          <div class="environment-basemap-lab-head-tools">
            ${showStatus ? `<div class="environment-basemap-lab-status" data-basemap-lab-status>${renderStatus({})}</div>` : ""}
            ${actions}
          </div>
        `;
    return `
      <section class="environment-basemap-lab-shell ${rootClass}" ${rootAttr}>
        <span class="sapd-visually-hidden" data-basemap-live-status role="status" aria-live="polite" aria-atomic="true"></span>
        <section class="environment-basemap-lab-main is-lab-view">
          <div class="environment-basemap-lab-toolbar page-local-search-toolbar ${toolbarSearch ? "has-toolbar-search" : ""}">
            ${toolbarBody}
          </div>
          <div class="basemap-lab-viewport" data-basemap-lab-viewport>
            <div class="basemap-svg-host" data-basemap-svg-host></div>
            <div class="basemap-node-popover is-hidden" data-basemap-lab-popover></div>
          </div>
        </section>
      </section>
    `;
  }

  async function mount(root) {
    if (!root) return;
    stateByRoot.set(root, createState(root));
    bindControls(root);
    await loadResources(root);
  }

  components.EnvironmentBasemapViewer = { render, mount };
})();
