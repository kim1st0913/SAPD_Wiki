(function () {
  const components = (window.sapdComponents = window.sapdComponents || {});
  const utils = components.utils;

  const VIEWBOX = { width: 1200, height: 640 };

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

  function nodeClass(type = "") {
    return text(type).replaceAll("_", "-");
  }

  function distribute(rows, start, end) {
    if (rows.length <= 1) return rows.map(() => (start + end) / 2);
    const step = (end - start) / (rows.length - 1);
    return rows.map((_, index) => start + step * index);
  }

  function orderedBusinessNodes(nodes, type) {
    return list(nodes)
      .filter((node) => node.type === type && !node.isDecorative)
      .sort((a, b) => a.label.localeCompare(b.label, "zh-Hans-CN"));
  }

  function buildLayout(graphModel = {}) {
    const nodes = list(graphModel.nodes);
    const positions = new Map();
    const current = nodes.find((node) => node.isCurrent) || nodes.find((node) => node.type === "current_focus");
    if (current) positions.set(current.id, { x: 455, y: 318 });

    const viewTechnical = orderedBusinessNodes(nodes, "view_technical");
    viewTechnical.forEach((node) => positions.set(node.id, { x: 655, y: 128 }));

    const viewManagement = orderedBusinessNodes(nodes, "view_management");
    viewManagement.forEach((node) => positions.set(node.id, { x: 650, y: 440 }));

    const viewStandard = orderedBusinessNodes(nodes, "view_standard");
    viewStandard.forEach((node) => positions.set(node.id, { x: 312, y: 520 }));

    const scopes = orderedBusinessNodes(nodes, "scope");
    distribute(scopes, 62, 218).forEach((y, index) => positions.set(scopes[index].id, { x: 794, y }));

    const services = orderedBusinessNodes(nodes, "technical_service");
    distribute(services, 42, 280).forEach((y, index) => positions.set(services[index].id, { x: 930 + (index % 2) * 130, y }));

    const technicalLeaves = [...orderedBusinessNodes(nodes, "technical_module"), ...orderedBusinessNodes(nodes, "technical_measure")];
    distribute(technicalLeaves, 58, 264).forEach((y, index) => positions.set(technicalLeaves[index].id, { x: 1140, y }));

    orderedBusinessNodes(nodes, "management_function_root").forEach((node) => positions.set(node.id, { x: 770, y: 366 }));
    orderedBusinessNodes(nodes, "management_work_root").forEach((node) => positions.set(node.id, { x: 770, y: 492 }));
    orderedBusinessNodes(nodes, "management_process_root").forEach((node) => positions.set(node.id, { x: 770, y: 574 }));

    const layerY = new Map([
      ["决策层", 326],
      ["管理层", 382],
      ["执行层", 438],
      ["监督层", 494],
    ]);
    const layers = orderedBusinessNodes(nodes, "security_function_layer");
    layers.forEach((node, index) => positions.set(node.id, { x: 902, y: layerY.get(text(node.meta?.layer)) || 270 + index * 50 }));

    const functions = orderedBusinessNodes(nodes, "security_function");
    const functionSlots = distribute(functions, 318, 538);
    functions.forEach((node, index) => positions.set(node.id, { x: 1010 + (index % 2) * 130, y: functionSlots[index] }));

    const works = orderedBusinessNodes(nodes, "security_work");
    distribute(works, 494, 526).forEach((y, index) => positions.set(works[index].id, { x: 930 + (index % 2) * 96, y }));

    const l2Rows = orderedBusinessNodes(nodes, "process_l2");
    distribute(l2Rows, 572, 594).forEach((y, index) => positions.set(l2Rows[index].id, { x: 906, y }));

    const l3Rows = orderedBusinessNodes(nodes, "process_l3");
    distribute(l3Rows, 570, 598).forEach((y, index) => positions.set(l3Rows[index].id, { x: 1012, y }));

    const l4Rows = orderedBusinessNodes(nodes, "process_l4");
    distribute(l4Rows, 570, 598).forEach((y, index) => positions.set(l4Rows[index].id, { x: 1110, y }));

    const standards = orderedBusinessNodes(nodes, "standard_status");
    distribute(standards, 548, 586).forEach((y, index) => positions.set(standards[index].id, { x: 178 + index * 104, y }));

    nodes
      .filter((node) => node.isDecorative)
      .forEach((node) => positions.set(node.id, { x: node.meta?.x || 0, y: node.meta?.y || 0 }));

    return positions;
  }

  function edgePath(source, target, type = "") {
    const dx = Math.max(48, Math.abs(target.x - source.x) * 0.42);
    const direction = target.x >= source.x ? 1 : -1;
    const bend = type === "focus_to_standard_status" ? 34 : type === "decorative_link" ? 0 : 10;
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
    return `
      <g class="network-background-layer" aria-hidden="true">
        ${list(edges)
          .filter((edge) => edge.isDecorative)
          .map((edge) => renderEdge(edge, positions))
          .join("")}
        ${list(nodes)
          .filter((node) => node.isDecorative)
          .map((node) => {
            const position = positions.get(node.id);
            if (!position) return "";
            const radius = Math.max(2.4, Math.min(5.8, 2.4 + Number(node.weight || 1) * 0.9));
            return `<circle class="network-decorative-node" cx="${position.x}" cy="${position.y}" r="${radius}" />`;
          })
          .join("")}
      </g>
    `;
  }

  function nodeSize(node) {
    if (node.isCurrent) return { width: 224, height: 102, radius: 24 };
    if (node.type === "view_technical" || node.type === "view_management" || node.type === "view_standard") return { width: 122, height: 44, radius: 999 };
    if (node.type === "management_function_root" || node.type === "management_work_root" || node.type === "management_process_root") return { width: 112, height: 40, radius: 999 };
    if (node.type === "security_function_layer") return { width: 92, height: 34, radius: 999 };
    if (node.type === "technical_service") return { width: 116, height: 40, radius: 13 };
    if (node.type === "technical_module" || node.type === "technical_measure") return { width: 98, height: 32, radius: 12 };
    if (node.type === "security_function") return { width: 92, height: 34, radius: 12 };
    if (node.type === "process_l3" || node.type === "process_l4") return { width: 96, height: 36, radius: 12 };
    if (node.type === "standard_status" || node.type === "empty_state") return { width: 142, height: 42, radius: 14 };
    return { width: 126, height: 42, radius: 13 };
  }

  function renderNodeText(node, position, size) {
    if (node.isCurrent) {
      const code = text(node.meta?.code).trim();
      const tag = text(node.meta?.tag || "能力-关注点").trim();
      return `
        <text class="network-node-kicker" x="${position.x}" y="${position.y - 32}" text-anchor="middle">${escape(tag)}</text>
        <text class="network-node-title is-current" x="${position.x}" y="${position.y - 6}" text-anchor="middle">${escape(truncate(node.label, 18))}</text>
        ${code ? `<text class="network-node-code is-current" x="${position.x}" y="${position.y + 24}" text-anchor="middle">${escape(code)}</text>` : ""}
      `;
    }
    const label = truncate(node.label, node.type === "standard_status" ? 16 : node.type === "security_function" ? 8 : 12);
    const code = text(node.meta?.code || node.meta?.layer || "").trim();
    return `
      <text class="network-node-title" x="${position.x}" y="${position.y - (code ? 2 : -4)}" text-anchor="middle">${escape(label)}</text>
      ${code ? `<text class="network-node-code" x="${position.x}" y="${position.y + 14}" text-anchor="middle">${escape(truncate(code, 12))}</text>` : ""}
    `;
  }

  function renderNode(node, graphModel, positions) {
    const position = positions.get(node.id);
    if (!position || node.isDecorative) return "";
    const size = nodeSize(node);
    const x = position.x - size.width / 2;
    const y = position.y - size.height / 2;
    const titleParts = [node.label, node.meta?.code, node.meta?.layer, node.meta?.capability].map(text).filter(Boolean);
    return `
      <g class="network-node-wrap node-${escape(nodeClass(node.type))} ${node.isCurrent ? "is-current" : ""}" tabindex="0" data-graph-node-id="${escape(node.id)}" role="listitem" aria-label="${escape(titleParts.join("，"))}">
        <title>${escape(titleParts.join(" / "))}</title>
        ${incidentEdges(node.id, graphModel.edges, positions)}
        ${node.isCurrent ? `<circle class="network-node-halo" cx="${position.x}" cy="${position.y}" r="92" />` : ""}
        <rect class="network-node-shape" x="${x}" y="${y}" width="${size.width}" height="${size.height}" rx="${size.radius}" ry="${size.radius}" />
        ${renderNodeText(node, position, size)}
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

  function render({ graphModel } = {}) {
    const model = graphModel || { nodes: [], edges: [], groups: [], stats: {} };
    const nodes = list(model.nodes);
    const businessNodes = nodes.filter((node) => !node.isDecorative);
    if (!businessNodes.length) {
      return `<section class="local-relation-network-graph"><div class="preview-table-empty"><strong>暂无本地关联图谱</strong><span>当前关注点尚未形成可展示的关系投影。</span></div></section>`;
    }
    const positions = buildLayout(model);
    return `
      <section class="local-relation-network-graph" aria-label="本地关联摘要网络图">
        <header class="network-graph-head">
          <div>
            <h3>本地关联摘要</h3>
            <p>以当前关注点为中心，展示技术视角、管理视角和标准 / 框架映射的同源投影。</p>
          </div>
          ${renderLegend()}
        </header>
        <div class="network-graph-canvas" role="img" aria-label="当前关注点局部知识图谱网络">
          <svg viewBox="0 0 ${VIEWBOX.width} ${VIEWBOX.height}" preserveAspectRatio="xMidYMid meet" role="presentation">
            <defs>
              <radialGradient id="network-center-halo" cx="50%" cy="50%" r="62%">
                <stop offset="0%" stop-color="oklch(0.72 0.14 257 / 0.22)" />
                <stop offset="70%" stop-color="oklch(0.78 0.09 257 / 0.07)" />
                <stop offset="100%" stop-color="oklch(0.98 0.006 250 / 0)" />
              </radialGradient>
            </defs>
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
          </svg>
        </div>
      </section>
    `;
  }

  components.LocalRelationNetworkGraph = { render };
})();
