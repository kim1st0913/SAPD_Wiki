(function () {
  const components = (window.sapdComponents = window.sapdComponents || {});
  const utils = components.utils;

  const VIEWBOX = { x: 0, y: 0, width: 1680, height: 940 };

  function list(value) {
    if (utils?.list) return utils.list(value);
    return Array.isArray(value) ? value : [];
  }

  function text(value) {
    if (utils?.text) return utils.text(value);
    return value == null ? "" : String(value);
  }

  function escape(value) {
    if (utils?.escapeHtml) return utils.escapeHtml(value);
    return text(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }

  function truncate(value, length = 14) {
    const normalized = text(value).trim();
    return normalized.length > length ? `${normalized.slice(0, length - 1)}…` : normalized;
  }

  function labelLines(value, lineLength = 12, maxLines = 2) {
    const normalized = text(value).trim();
    if (!normalized) return [];
    const lines = [];
    for (let cursor = 0; cursor < normalized.length && lines.length < maxLines; cursor += lineLength) {
      lines.push(normalized.slice(cursor, cursor + lineLength));
    }
    if (normalized.length > lineLength * maxLines && lines.length) {
      lines[lines.length - 1] = `${lines[lines.length - 1].slice(0, Math.max(1, lineLength - 1))}…`;
    }
    return lines;
  }

  function nodeClass(type = "") {
    return text(type).replaceAll("_", "-");
  }

  function hashSeed(value) {
    return text(value)
      .split("")
      .reduce((hash, char) => (hash * 31 + char.charCodeAt(0)) >>> 0, 2166136261);
  }

  function nodeRadius(node = {}) {
    if (node.isCurrent) return 56;
    if (node.type === "view_technical" || node.type === "view_management" || node.type === "view_standard") return 26;
    if (node.type === "capability_overview") return 20;
    if (node.type === "focus_overview") return 12;
    if (node.type === "management_function_root" || node.type === "management_work_root" || node.type === "management_process_root") return 21;
    if (node.type === "security_function_layer") return 16;
    if (node.type === "scope") return 18;
    if (node.type === "technical_service") return 15;
    if (node.type === "technical_module" || node.type === "technical_measure") return 11;
    if (node.type === "security_function") return 13;
    if (node.type === "security_work" || node.type === "process_l2") return 14;
    if (node.type === "process_l3" || node.type === "process_l4") return 11;
    if (node.type === "standard_status") return 12;
    return 12;
  }

  function collisionRadius(node = {}) {
    const labelLength = Math.min(18, text(node.label).length);
    const labelSpace = node.isCurrent ? 34 : node.type?.startsWith("view_") ? 30 : 24 + labelLength * 1.8;
    return nodeRadius(node) + labelSpace;
  }

  function clampPositions(businessNodes, positions) {
    businessNodes.forEach((node) => {
      const position = positions.get(node.id);
      if (!position) return;
      const radius = collisionRadius(node);
      position.x = Math.max(radius, Math.min(VIEWBOX.width - radius, position.x));
      position.y = Math.max(radius, Math.min(VIEWBOX.height - radius, position.y));
    });
  }

  function groupKey(node = {}) {
    return text(node.group || node.type || "unknown").split(":")[0] || "unknown";
  }

  function stableSort(items) {
    return [...list(items)].sort((a, b) => text(a.label || a.id).localeCompare(text(b.label || b.id), "zh-Hans-CN"));
  }

  function graphDepths(current, businessNodes, liveEdges) {
    const depths = new Map();
    if (!current) return depths;
    const children = new Map();
    liveEdges.forEach((edge) => {
      if (!children.has(edge.source)) children.set(edge.source, []);
      children.get(edge.source).push(edge.target);
    });
    const queue = [current.id];
    depths.set(current.id, 0);
    for (let index = 0; index < queue.length; index += 1) {
      const source = queue[index];
      const nextDepth = (depths.get(source) || 0) + 1;
      stableSort(list(children.get(source)).map((id) => businessNodes.find((node) => node.id === id)).filter(Boolean)).forEach((node) => {
        if (depths.has(node.id)) return;
        depths.set(node.id, nextDepth);
        queue.push(node.id);
      });
    }
    return depths;
  }

  function idealLinkDistance(edge, nodesById, depths) {
    const source = nodesById.get(edge.source);
    const target = nodesById.get(edge.target);
    const depth = Math.max(depths.get(edge.source) || 0, depths.get(edge.target) || 1);
    if (source?.isCurrent || target?.isCurrent) return 210;
    if (source?.type?.startsWith("view_") || target?.type?.startsWith("view_")) return 148;
    if (depth <= 3) return 112;
    return 94;
  }

  function placeInitialNode({ node, parent, parentPosition, siblingIndex, siblingCount, depth, positions }) {
    const seed = hashSeed(`${parent?.id || "root"}:${node.id}:${siblingIndex}`);
    const goldenAngle = Math.PI * (3 - Math.sqrt(5));
    const evenAngle = siblingCount > 1 ? (Math.PI * 2 * siblingIndex) / siblingCount : 0;
    const seededRotation = ((hashSeed(parent?.id || "current") % 360) / 180) * Math.PI;
    const angle = siblingCount <= 4 ? seededRotation + evenAngle : seededRotation + siblingIndex * goldenAngle + (seed % 17) * 0.011;
    const radius = parent?.isCurrent ? 202 : parent?.type?.startsWith("view_") ? 144 : Math.max(84, 132 - depth * 9);
    const jitter = ((seed % 41) - 20) * 1.6;
    positions.set(node.id, {
      x: parentPosition.x + Math.cos(angle) * (radius + jitter),
      y: parentPosition.y + Math.sin(angle) * (radius + jitter),
    });
  }

  function seedInitialLayout({ current, businessNodes, liveEdges, nodesById, positions }) {
    const center = { x: VIEWBOX.width / 2, y: VIEWBOX.height / 2 };
    if (current) positions.set(current.id, { ...center });
    const childrenBySource = new Map();
    liveEdges.forEach((edge) => {
      const target = nodesById.get(edge.target);
      if (!target) return;
      if (!childrenBySource.has(edge.source)) childrenBySource.set(edge.source, []);
      childrenBySource.get(edge.source).push(target);
    });
    const queue = current ? [{ node: current, depth: 0 }] : [];
    const visited = new Set(current ? [current.id] : []);
    while (queue.length) {
      const { node, depth } = queue.shift();
      const parentPosition = positions.get(node.id);
      if (!parentPosition) continue;
      const children = stableSort(childrenBySource.get(node.id)).filter((child) => !visited.has(child.id));
      children.forEach((child, index) => {
        placeInitialNode({ node: child, parent: node, parentPosition, siblingIndex: index, siblingCount: children.length, depth: depth + 1, positions });
        visited.add(child.id);
        queue.push({ node: child, depth: depth + 1 });
      });
    }
    businessNodes.forEach((node, index) => {
      if (positions.has(node.id)) return;
      const seed = hashSeed(node.id || node.label || index);
      const angle = index * Math.PI * (3 - Math.sqrt(5)) + ((seed % 180) / 180) * Math.PI;
      const radius = 132 + (index % 7) * 20;
      positions.set(node.id, {
        x: center.x + Math.cos(angle) * radius,
        y: center.y + Math.sin(angle) * radius,
      });
    });
  }

  function settleCollisions(businessNodes, positions, fixedIds) {
    const maxIterations = businessNodes.length > 150 ? 24 : businessNodes.length > 100 ? 38 : 96;
    for (let iteration = 0; iteration < maxIterations; iteration += 1) {
      let moved = false;
      for (let a = 0; a < businessNodes.length; a += 1) {
        for (let b = a + 1; b < businessNodes.length; b += 1) {
          const left = businessNodes[a];
          const right = businessNodes[b];
          const leftPosition = positions.get(left.id);
          const rightPosition = positions.get(right.id);
          if (!leftPosition || !rightPosition) continue;
          let dx = rightPosition.x - leftPosition.x;
          let dy = rightPosition.y - leftPosition.y;
          let distance = Math.hypot(dx, dy);
          if (distance < 0.01) {
            const seed = hashSeed(`${left.id}:${right.id}:settle`);
            dx = Math.cos(seed) * 0.8;
            dy = Math.sin(seed) * 0.8;
            distance = 0.8;
          }
          const minimum = collisionRadius(left) + collisionRadius(right) + 22;
          if (distance >= minimum) continue;
          moved = true;
          const push = ((minimum - distance) / distance) * 0.54;
          const leftFixed = fixedIds.has(left.id);
          const rightFixed = fixedIds.has(right.id);
          const leftShare = leftFixed ? 0 : rightFixed ? 1 : 0.5;
          const rightShare = rightFixed ? 0 : leftFixed ? 1 : 0.5;
          leftPosition.x -= dx * push * leftShare;
          leftPosition.y -= dy * push * leftShare;
          rightPosition.x += dx * push * rightShare;
          rightPosition.y += dy * push * rightShare;
        }
      }
      clampPositions(businessNodes, positions);
      if (!moved) break;
    }
  }

  function buildLayout(graphModel = {}) {
    const nodes = list(graphModel.nodes);
    const edges = list(graphModel.edges);
    const businessNodes = nodes.filter((node) => !node.isDecorative);
    const nodesById = new Map(nodes.map((node) => [node.id, node]));
    const positions = new Map();
    const fixedIds = new Set();
    const current = nodes.find((node) => node.isCurrent) || nodes.find((node) => node.type === "current_focus");
    const liveEdges = edges.filter((edge) => !edge.isDecorative && nodesById.has(edge.source) && nodesById.has(edge.target));
    const depths = graphDepths(current, businessNodes, liveEdges);
    if (current) fixedIds.add(current.id);
    seedInitialLayout({ current, businessNodes, liveEdges, nodesById, positions });
    const velocities = new Map(businessNodes.map((node) => [node.id, { x: 0, y: 0 }]));
    const center = { x: VIEWBOX.width / 2, y: VIEWBOX.height / 2 };
    const layoutIterations = businessNodes.length > 150 ? 96 : businessNodes.length > 100 ? 150 : 320;
    for (let iteration = 0; iteration < layoutIterations; iteration += 1) {
      const progress = iteration / layoutIterations;
      const alpha = 0.15 * Math.pow(1 - progress, 1.35) + 0.004;
      liveEdges.forEach((edge) => {
        const source = positions.get(edge.source);
        const target = positions.get(edge.target);
        const sourceVelocity = velocities.get(edge.source);
        const targetVelocity = velocities.get(edge.target);
        if (!source || !target || !sourceVelocity || !targetVelocity) return;
        let dx = target.x - source.x;
        let dy = target.y - source.y;
        let distance = Math.hypot(dx, dy) || 1;
        const desired = idealLinkDistance(edge, nodesById, depths);
        const force = ((distance - desired) / distance) * alpha * 0.22;
        dx *= force;
        dy *= force;
        if (!fixedIds.has(edge.source)) {
          sourceVelocity.x += dx;
          sourceVelocity.y += dy;
        }
        if (!fixedIds.has(edge.target)) {
          targetVelocity.x -= dx;
          targetVelocity.y -= dy;
        }
      });
      for (let a = 0; a < businessNodes.length; a += 1) {
        for (let b = a + 1; b < businessNodes.length; b += 1) {
          const left = businessNodes[a];
          const right = businessNodes[b];
          const leftPosition = positions.get(left.id);
          const rightPosition = positions.get(right.id);
          const leftVelocity = velocities.get(left.id);
          const rightVelocity = velocities.get(right.id);
          if (!leftPosition || !rightPosition || !leftVelocity || !rightVelocity) continue;
          let dx = rightPosition.x - leftPosition.x;
          let dy = rightPosition.y - leftPosition.y;
          let distance = Math.hypot(dx, dy) || 1;
          const sameGroup = groupKey(left) === groupKey(right);
          const minimum = collisionRadius(left) + collisionRadius(right) + (sameGroup ? 34 : 24);
          if (distance < minimum) {
            const force = ((minimum - distance) / distance) * alpha * 1.08;
            dx *= force;
            dy *= force;
            if (!fixedIds.has(left.id)) {
              leftVelocity.x -= dx;
              leftVelocity.y -= dy;
            }
            if (!fixedIds.has(right.id)) {
              rightVelocity.x += dx;
              rightVelocity.y += dy;
            }
          } else if (distance < 310) {
            const force = (1 / distance) * alpha * (sameGroup ? 8 : 13);
            if (!fixedIds.has(left.id)) {
              leftVelocity.x -= dx * force;
              leftVelocity.y -= dy * force;
            }
            if (!fixedIds.has(right.id)) {
              rightVelocity.x += dx * force;
              rightVelocity.y += dy * force;
            }
          }
        }
      }
      businessNodes.forEach((node) => {
        const position = positions.get(node.id);
        const velocity = velocities.get(node.id);
        if (!position || !velocity) return;
        if (fixedIds.has(node.id)) return;
        velocity.x += (center.x - position.x) * 0.009 * alpha;
        velocity.y += (center.y - position.y) * 0.009 * alpha;
        const depth = depths.get(node.id);
        if (current && depth > 0) {
          const currentPosition = positions.get(current.id) || center;
          const dx = position.x - currentPosition.x;
          const dy = position.y - currentPosition.y;
          const distance = Math.hypot(dx, dy) || 1;
          const idealRadius = Math.min(300, 180 + depth * 38);
          const radialForce = ((idealRadius - distance) / distance) * 0.008 * alpha;
          velocity.x += dx * radialForce;
          velocity.y += dy * radialForce;
        }
        const padding = collisionRadius(node) + 26;
        if (position.x < padding) velocity.x += (padding - position.x) * 0.035 * alpha;
        if (position.x > VIEWBOX.width - padding) velocity.x -= (position.x - (VIEWBOX.width - padding)) * 0.035 * alpha;
        if (position.y < padding) velocity.y += (padding - position.y) * 0.035 * alpha;
        if (position.y > VIEWBOX.height - padding) velocity.y -= (position.y - (VIEWBOX.height - padding)) * 0.035 * alpha;
        velocity.x *= 0.8;
        velocity.y *= 0.8;
        position.x += velocity.x;
        position.y += velocity.y;
      });
    }
    settleCollisions(businessNodes, positions, fixedIds);
    clampPositions(businessNodes, positions);

    return positions;
  }

  function visibleViewBox(businessNodes, positions) {
    const visiblePositions = businessNodes.map((node) => positions.get(node.id)).filter(Boolean);
    if (!visiblePositions.length) return VIEWBOX;
    const bounds = visiblePositions.reduce(
      (box, position) => ({
        minX: Math.min(box.minX, position.x),
        minY: Math.min(box.minY, position.y),
        maxX: Math.max(box.maxX, position.x),
        maxY: Math.max(box.maxY, position.y),
      }),
      { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity },
    );
    const padding = 150;
    let x = Math.max(0, bounds.minX - padding);
    let y = Math.max(0, bounds.minY - padding);
    let width = Math.min(VIEWBOX.width - x, bounds.maxX - bounds.minX + padding * 2);
    let height = Math.min(VIEWBOX.height - y, bounds.maxY - bounds.minY + padding * 2);
    const aspect = VIEWBOX.width / VIEWBOX.height;
    width = Math.max(980, width);
    height = Math.max(560, height);
    if (width / height > aspect) {
      const nextHeight = width / aspect;
      y = Math.max(0, y - (nextHeight - height) / 2);
      height = nextHeight;
    } else {
      const nextWidth = height * aspect;
      x = Math.max(0, x - (nextWidth - width) / 2);
      width = nextWidth;
    }
    if (x + width > VIEWBOX.width) x = Math.max(0, VIEWBOX.width - width);
    if (y + height > VIEWBOX.height) y = Math.max(0, VIEWBOX.height - height);
    return {
      x: Math.round(x),
      y: Math.round(y),
      width: Math.round(Math.min(VIEWBOX.width, width)),
      height: Math.round(Math.min(VIEWBOX.height, height)),
    };
  }

  function layoutMetrics(businessNodes, positions, viewBox) {
    let overlaps = 0;
    let minGap = Infinity;
    for (let a = 0; a < businessNodes.length; a += 1) {
      for (let b = a + 1; b < businessNodes.length; b += 1) {
        const left = businessNodes[a];
        const right = businessNodes[b];
        const leftPosition = positions.get(left.id);
        const rightPosition = positions.get(right.id);
        if (!leftPosition || !rightPosition) continue;
        const gap = Math.hypot(rightPosition.x - leftPosition.x, rightPosition.y - leftPosition.y) - collisionRadius(left) - collisionRadius(right);
        minGap = Math.min(minGap, gap);
        if (gap < -1) overlaps += 1;
      }
    }
    return {
      overlaps,
      minGap: Number.isFinite(minGap) ? Math.round(minGap) : 0,
      viewBox: `${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`,
    };
  }

  function edgePath(source, target, type = "") {
    const dx = Math.max(48, Math.abs(target.x - source.x) * 0.42);
    const direction = target.x >= source.x ? 1 : -1;
    const bend = type === "focus_to_standard_status" ? 34 : type === "decorative_link" ? 0 : 6;
    return `M ${source.x} ${source.y} C ${source.x + dx * direction} ${source.y - bend}, ${target.x - dx * direction} ${target.y + bend}, ${target.x} ${target.y}`;
  }

  function edgeClass(edge) {
    return `network-edge ${edge.isDecorative ? "is-decorative" : "is-business"} edge-${nodeClass(edge.type)}`;
  }

  function renderEdge(edge, positions, extraClass = "") {
    const source = positions.get(edge.source);
    const target = positions.get(edge.target);
    if (!source || !target) return "";
    return `<path class="${escape(`${edgeClass(edge)} ${extraClass}`)}" d="${edgePath(source, target, edge.type)}" />`;
  }

  function incidentEdges(nodeId, edges, positions) {
    return list(edges)
      .filter((edge) => !edge.isDecorative && (edge.source === nodeId || edge.target === nodeId))
      .map((edge) => renderEdge(edge, positions, "node-hover-edge"))
      .join("");
  }

  function renderDecorative(nodes, edges, positions) {
    return "";
  }

  function renderNodeText(node, position, radius) {
    if (node.isCurrent) {
      const title = text(node.meta?.capability || node.label).trim();
      const code = text(node.meta?.capabilityCode || node.meta?.code).trim();
      const lines = labelLines(title, 8, 2);
      const startY = lines.length > 1 ? -9 : 1;
      return `
        <text class="network-node-title is-current" x="${position.x}" y="${position.y + startY}" text-anchor="middle">
          ${lines.map((line, index) => `<tspan x="${position.x}" dy="${index === 0 ? 0 : 16}">${escape(line)}</tspan>`).join("")}
        </text>
        ${code ? `<text class="network-node-code is-current" x="${position.x}" y="${position.y + 35}" text-anchor="middle">${escape(code)}</text>` : ""}
      `;
    }
    const labelLength = node.type === "standard_status" ? 14 : node.type === "security_function" ? 12 : 12;
    const label = truncate(node.label, labelLength);
    const isNearRightEdge = position.x > VIEWBOX.width - 260;
    const textX = isNearRightEdge ? position.x - radius - 6 : position.x + radius + 6;
    const anchor = isNearRightEdge ? "end" : "start";
    const lines = labelLines(label, 9, 2);
    return `
      <text class="network-node-title" x="${textX}" y="${position.y - (lines.length > 1 ? 4 : 0)}" text-anchor="${anchor}">
        ${lines.map((line, index) => `<tspan x="${textX}" dy="${index === 0 ? 0 : 12}">${escape(line)}</tspan>`).join("")}
      </text>
    `;
  }

  function renderNode(node, graphModel, positions) {
    const position = positions.get(node.id);
    if (!position || node.isDecorative) return "";
    const radius = nodeRadius(node);
    const titleParts = [node.label, node.meta?.code, node.meta?.layer, node.meta?.capability].map(text).filter(Boolean);
    return `
      <g class="network-node-wrap node-${escape(nodeClass(node.type))} ${node.isCurrent ? "is-current" : ""}" tabindex="0" data-graph-node-id="${escape(node.id)}" role="listitem" aria-label="${escape(titleParts.join("，"))}">
        <title>${escape(titleParts.join(" / "))}</title>
        ${incidentEdges(node.id, graphModel.edges, positions)}
        ${node.isCurrent ? `<circle class="network-node-halo" cx="${position.x}" cy="${position.y}" r="112" />` : ""}
        <circle class="network-node-shape" cx="${position.x}" cy="${position.y}" r="${radius}" />
        ${renderNodeText(node, position, radius)}
      </g>
    `;
  }

  function renderGroupLabels() {
    return "";
  }

  function renderLegend() {
    return `
      <div class="network-legend" aria-label="图例">
        <span><i class="legend-current"></i>当前关注点</span>
        <span><i class="legend-technical"></i>技术视角</span>
        <span><i class="legend-management"></i>管理视角</span>
        <span><i class="legend-standard"></i>标准 / 框架映射</span>
      </div>
    `;
  }

  function renderGraphNote(model = {}) {
    const stats = model.stats || {};
    if (stats.strategy === "category_structure") {
      return `<p class="network-graph-note">${escape(`L0 结构图：展示本分类下 ${stats.capabilityCount || 0} 个能力和 ${stats.focusCount || 0} 个关注点。`)}</p>`;
    }
    if (stats.strategy === "focus_mapping_overview") {
      return `<p class="network-graph-note">${escape(`L${stats.graphScope === "domain" ? "1" : "2"} 映射概览：展示 ${stats.focusCount || 0} 个关注点，以及作用域、安全技术服务、L2流程组、安全工作和标准 / 框架种类。`)}</p>`;
    }
    if (!stats.limited) return "";
    const technical = Number.isFinite(stats.technicalRowsTotal) && stats.technicalRowsTotal > stats.technicalRows ? `技术 ${stats.technicalRows}/${stats.technicalRowsTotal}` : "";
    const management = Number.isFinite(stats.managementRowsTotal) && stats.managementRowsTotal > stats.managementRows ? `管理 ${stats.managementRows}/${stats.managementRowsTotal}` : "";
    const parts = [technical, management].filter(Boolean).join("，");
    return `<p class="network-graph-note">${escape(parts ? `当前为高级节点概览图谱，已抽样展示：${parts}。切换到具体关注点可查看完整关系。` : "当前为高级节点概览图谱，切换到具体关注点可查看完整关系。")}</p>`;
  }

  function clampZoom(value) {
    return Math.max(0.55, Math.min(2.1, value));
  }

  function setViewport(canvas, x, y, zoom = Number(canvas?.dataset.zoom || 1)) {
    if (!canvas) return;
    const layer = canvas.querySelector(".network-pan-layer");
    if (!layer) return;
    const safeZoom = clampZoom(Number.isFinite(zoom) ? zoom : 1);
    canvas.dataset.panX = String(x);
    canvas.dataset.panY = String(y);
    canvas.dataset.zoom = String(safeZoom);
    layer.setAttribute("transform", `translate(${x} ${y}) scale(${safeZoom})`);
    canvas.querySelector("[data-network-zoom-value]")?.replaceChildren(document.createTextNode(`${Math.round(safeZoom * 100)}%`));
  }

  function setPan(canvas, x, y) {
    setViewport(canvas, x, y);
  }

  function stepZoom(canvas, direction) {
    if (!canvas) return;
    const currentZoom = clampZoom(Number(canvas.dataset.zoom || 1));
    const currentX = Number(canvas.dataset.panX || 0);
    const currentY = Number(canvas.dataset.panY || 0);
    if (direction === "reset") {
      setViewport(canvas, 0, 0, 1);
      return;
    }
    const nextZoom = clampZoom(direction === "in" ? currentZoom * 1.16 : currentZoom / 1.16);
    setViewport(canvas, currentX, currentY, nextZoom);
  }

  function bindGraphInteractions() {
    if (components.LocalRelationNetworkGraph?._panBound) return;
    components.LocalRelationNetworkGraph = components.LocalRelationNetworkGraph || {};
    components.LocalRelationNetworkGraph._panBound = true;
    document.addEventListener("click", (event) => {
      const action = event.target.closest?.("[data-network-zoom]");
      if (!action) return;
      const canvas = action.closest(".network-graph-canvas");
      if (!canvas) return;
      event.preventDefault();
      stepZoom(canvas, action.dataset.networkZoom);
    });
    document.addEventListener(
      "wheel",
      (event) => {
        const canvas = event.target.closest?.(".network-graph-canvas");
        if (!canvas || event.target.closest?.(".network-graph-actions")) return;
        event.preventDefault();
        stepZoom(canvas, event.deltaY < 0 ? "in" : "out");
      },
      { passive: false },
    );
    document.addEventListener("pointerdown", (event) => {
      const canvas = event.target.closest?.(".network-graph-canvas");
      if (!canvas || event.button !== 0) return;
      if (event.target.closest?.(".network-graph-actions")) return;
      event.preventDefault();
      const startX = event.clientX;
      const startY = event.clientY;
      const initialX = Number(canvas.dataset.panX || 0);
      const initialY = Number(canvas.dataset.panY || 0);
      canvas.classList.add("is-panning");
      canvas.setPointerCapture?.(event.pointerId);
      const onMove = (moveEvent) => {
        const scaleX = Number(canvas.dataset.viewboxWidth || VIEWBOX.width) / Math.max(1, canvas.clientWidth);
        const scaleY = Number(canvas.dataset.viewboxHeight || VIEWBOX.height) / Math.max(1, canvas.clientHeight);
        setPan(canvas, initialX + (moveEvent.clientX - startX) * scaleX, initialY + (moveEvent.clientY - startY) * scaleY);
      };
      const onUp = () => {
        canvas.classList.remove("is-panning");
        canvas.releasePointerCapture?.(event.pointerId);
        document.removeEventListener("pointermove", onMove);
        document.removeEventListener("pointerup", onUp);
        document.removeEventListener("pointercancel", onUp);
      };
      document.addEventListener("pointermove", onMove);
      document.addEventListener("pointerup", onUp, { once: true });
      document.addEventListener("pointercancel", onUp, { once: true });
    });
  }

  function render({ graphModel } = {}) {
    bindGraphInteractions();
    const model = graphModel || { nodes: [], edges: [], groups: [], stats: {} };
    const nodes = list(model.nodes);
    const businessNodes = nodes.filter((node) => !node.isDecorative);
    if (!businessNodes.length) {
      return `<section class="local-relation-network-graph"><div class="preview-table-empty"><strong>暂无本地关联图谱</strong><span>当前关注点尚未形成可展示的关系投影。</span></div></section>`;
    }
    const positions = buildLayout(model);
    const viewBox = visibleViewBox(businessNodes, positions);
    const metrics = layoutMetrics(businessNodes, positions, viewBox);
    return `
      <section class="local-relation-network-graph" aria-label="能力关系图谱">
        <header class="network-graph-head">
          <div>
            <h3>能力关系图谱</h3>
            <p>查看当前关注点关联的技术视角、管理视角和标准 / 框架映射。</p>
            ${renderGraphNote(model)}
          </div>
          ${renderLegend()}
        </header>
        <div class="network-graph-canvas" role="img" aria-label="当前关注点能力关系图谱" data-viewbox-width="${viewBox.width}" data-viewbox-height="${viewBox.height}" data-layout-overlaps="${metrics.overlaps}" data-layout-min-gap="${metrics.minGap}" data-business-nodes="${businessNodes.length}" data-layout-viewbox="${escape(metrics.viewBox)}" data-zoom="1" data-pan-x="0" data-pan-y="0">
          <div class="network-graph-actions" aria-label="图谱缩放控制">
            <button type="button" data-network-zoom="out" title="缩小图谱" aria-label="缩小图谱">−</button>
            <span data-network-zoom-value>100%</span>
            <button type="button" data-network-zoom="in" title="放大图谱" aria-label="放大图谱">+</button>
            <button type="button" data-network-zoom="reset" title="重置图谱视图" aria-label="重置图谱视图">1:1</button>
          </div>
          <svg viewBox="${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}" preserveAspectRatio="xMidYMid meet" role="presentation">
            <defs>
              <radialGradient id="network-center-halo" cx="50%" cy="50%" r="62%">
                <stop offset="0%" stop-color="oklch(0.72 0.14 257 / 0.22)" />
                <stop offset="70%" stop-color="oklch(0.78 0.09 257 / 0.07)" />
                <stop offset="100%" stop-color="oklch(0.98 0.006 250 / 0)" />
              </radialGradient>
            </defs>
            <g class="network-pan-layer" transform="translate(0 0)">
              ${renderDecorative(nodes, model.edges, positions)}
              <g class="network-business-edge-layer" aria-hidden="true">
                ${list(model.edges)
                  .filter((edge) => !edge.isDecorative)
                  .map((edge) => renderEdge(edge, positions))
                  .join("")}
              </g>
              ${renderGroupLabels()}
              <g class="network-node-layer" role="list">
                ${businessNodes.map((node) => renderNode(node, model, positions)).join("")}
              </g>
            </g>
          </svg>
        </div>
      </section>
    `;
  }

  components.LocalRelationNetworkGraph = { render };
})();
