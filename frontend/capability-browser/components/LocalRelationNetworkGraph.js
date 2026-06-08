(function () {
  const components = (window.sapdComponents = window.sapdComponents || {});
  const utils = components.utils;

  const VIEWBOX = { x: 0, y: 0, width: 2400, height: 1600 };

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
    const explicitRadius = Number(node.meta?.radius);
    if (Number.isFinite(explicitRadius) && explicitRadius > 0) return explicitRadius;
    const hierarchyDepth = Number(node.meta?.hierarchyDepth);
    if (Number.isFinite(hierarchyDepth)) {
      if (hierarchyDepth <= 0) return 62;
      if (hierarchyDepth === 1) return 34;
      if (hierarchyDepth === 2) return 24;
      return 16;
    }
    if (node.type === "current_capability") return 62;
    if (node.isCurrent) return 56;
    if (node.type === "focus_overview") return 30;
    if (node.type === "view_technical" || node.type === "view_management" || node.type === "view_standard") return 22;
    if (node.type === "capability_overview") return 22;
    if (node.type === "management_function_root" || node.type === "management_work_root" || node.type === "management_process_root") return 21;
    if (node.type === "security_function_layer") return 16;
    if (node.type === "scope") return 15;
    if (node.type === "technical_service") return 15;
    if (node.type === "technical_module" || node.type === "technical_measure") return 11;
    if (node.type === "security_function") return 13;
    if (node.type === "security_work" || node.type === "process_l2") return 15;
    if (node.type === "process_l3" || node.type === "process_l4") return 11;
    if (node.type === "standard_status") return 24;
    if (node.type === "standard_control") return 8;
    if (node.type === "environment_segment") return 18;
    if (node.type === "information_object") return 16;
    if (node.type === "information_environment") return 20;
    if (node.type === "security_system") return 13;
    if (node.type === "product") return 12;
    if (node.type === "capability" || node.type === "capability_focus") return 13;
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

  function isStructureStrategy(strategy) {
    return strategy === "category_structure" || strategy === "domain_structure";
  }

  function isLayeredRadialStrategy(strategy) {
    return isStructureStrategy(strategy) || strategy === "focus_mapping_overview";
  }

  function structureIdealRadius(strategy, depth) {
    if (!isLayeredRadialStrategy(strategy) || depth <= 0) return null;
    if (strategy === "focus_mapping_overview") {
      if (depth === 1) return 340;
      if (depth === 2) return 540;
      return 700;
    }
    if (depth === 1) return strategy === "category_structure" ? 270 : 255;
    if (depth === 2) return strategy === "category_structure" ? 455 : 430;
    return 540;
  }

  function idealLinkDistance(edge, nodesById, depths, strategy) {
    const source = nodesById.get(edge.source);
    const target = nodesById.get(edge.target);
    const depth = Math.max(depths.get(edge.source) || 0, depths.get(edge.target) || 1);
    if (isLayeredRadialStrategy(strategy)) {
      if (source?.isCurrent || target?.isCurrent) return strategy === "category_structure" ? 270 : 255;
      if (strategy === "focus_mapping_overview") return depth <= 2 ? 190 : 155;
      if (depth <= 2) return 160;
      return 120;
    }
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

  function polar(origin, angle, radius, offset = 0) {
    return {
      x: origin.x + Math.cos(angle) * (radius + offset),
      y: origin.y + Math.sin(angle) * (radius + offset),
    };
  }

  function spreadAngles(centerAngle, count, width, preferredAngles = []) {
    if (count <= 0) return [];
    if (preferredAngles.length >= count) return preferredAngles.slice(0, count).map((angle) => centerAngle + angle);
    if (count === 1) return [centerAngle];
    const safeWidth = Math.min(Math.PI * 0.74, Math.max(0.3, width));
    return Array.from({ length: count }, (_, index) => {
      const ratio = count <= 1 ? 0.5 : index / (count - 1);
      return centerAngle - safeWidth / 2 + safeWidth * ratio;
    });
  }

  function seedFocusMappingClusterLayout({ current, businessNodes, liveEdges, nodesById, positions }) {
    if (!current) return false;
    const center = { x: VIEWBOX.width / 2, y: VIEWBOX.height / 2 };
    positions.set(current.id, { ...center });
    const childrenBySource = new Map();
    liveEdges.forEach((edge) => {
      const target = nodesById.get(edge.target);
      if (!target) return;
      if (!childrenBySource.has(edge.source)) childrenBySource.set(edge.source, []);
      childrenBySource.get(edge.source).push(target);
    });
    const focusNodes = stableSort(childrenBySource.get(current.id)).filter((node) => node.type === "focus_overview");
    if (!focusNodes.length) return false;
    const placed = new Set([current.id]);
    const focusLoads = focusNodes.map((focusNode) => {
      const viewNodes = list(childrenBySource.get(focusNode.id));
      return viewNodes.reduce((total, viewNode) => total + 1 + list(childrenBySource.get(viewNode.id)).length, 0);
    });
    const largestFocusLoad = Math.max(0, ...focusLoads);
    const focusRadius = Math.min(390, 320 + focusNodes.length * 18 + Math.min(45, largestFocusLoad * 3));
    const focusRotation = focusNodes.length === 3 ? -Math.PI / 3 : -Math.PI / 2 - (focusNodes.length === 2 ? Math.PI / 10 : 0);
    focusNodes.forEach((focusNode, focusIndex) => {
      const focusAngle = focusRotation + (Math.PI * 2 * focusIndex) / focusNodes.length;
      const focusPosition = polar(center, focusAngle, focusRadius);
      positions.set(focusNode.id, focusPosition);
      placed.add(focusNode.id);

      const viewNodes = stableSort(childrenBySource.get(focusNode.id)).filter((node) => !placed.has(node.id));
      const preferred = viewNodes.length === 3 ? [-0.62, 0, 0.62] : viewNodes.length === 2 ? [-0.36, 0.36] : [];
      const viewAngles = spreadAngles(focusAngle, viewNodes.length, 1.26, preferred);
      viewNodes.forEach((viewNode, viewIndex) => {
        const seed = hashSeed(`${focusNode.id}:${viewNode.id}`);
        const viewAngle = viewAngles[viewIndex] ?? focusAngle;
        const leafNodes = stableSort(childrenBySource.get(viewNode.id)).filter((node) => !placed.has(node.id));
        const isStandardView = viewNode.type === "view_standard";
        const viewDistance = 210 + Math.min(40, leafNodes.length * 3) + (isStandardView ? 34 : 0);
        const viewPosition = polar(focusPosition, viewAngle, viewDistance, ((seed % 21) - 10) * 1.5);
        positions.set(viewNode.id, viewPosition);
        placed.add(viewNode.id);

        const leafWidth = Math.min(isStandardView ? Math.PI * 1.04 : Math.PI * 0.86, (isStandardView ? 0.62 : 0.46) + leafNodes.length * (isStandardView ? 0.2 : 0.16));
        const leafAngles = spreadAngles(viewAngle, leafNodes.length, leafWidth);
        leafNodes.forEach((leafNode, leafIndex) => {
          const leafSeed = hashSeed(`${viewNode.id}:${leafNode.id}`);
          const ring = (isStandardView ? 205 : 170) + (leafIndex % 3) * (isStandardView ? 36 : 30) + Math.floor(leafIndex / 3) * 4;
          positions.set(leafNode.id, polar(viewPosition, leafAngles[leafIndex] ?? viewAngle, ring, ((leafSeed % 19) - 9) * 1.5));
          placed.add(leafNode.id);
        });
      });
    });
    businessNodes.forEach((node, index) => {
      if (positions.has(node.id)) return;
      const seed = hashSeed(node.id || node.label || index);
      const angle = focusRotation + index * Math.PI * (3 - Math.sqrt(5)) + ((seed % 60) / 180) * Math.PI;
      positions.set(node.id, polar(center, angle, 570 + (index % 4) * 22));
    });
    return true;
  }

  function seedStructureStarLayout({ current, businessNodes, liveEdges, nodesById, positions, strategy }) {
    if (!current || !isLayeredRadialStrategy(strategy)) return false;
    if (strategy === "focus_mapping_overview") {
      return seedFocusMappingClusterLayout({ current, businessNodes, liveEdges, nodesById, positions });
    }
    const center = { x: VIEWBOX.width / 2, y: VIEWBOX.height / 2 };
    positions.set(current.id, { ...center });
    const childrenBySource = new Map();
    liveEdges.forEach((edge) => {
      const target = nodesById.get(edge.target);
      if (!target) return;
      if (!childrenBySource.has(edge.source)) childrenBySource.set(edge.source, []);
      childrenBySource.get(edge.source).push(target);
    });
    const firstRing = stableSort(childrenBySource.get(current.id));
    const firstRadius = strategy === "category_structure" ? 270 : 255;
    const secondRadius = strategy === "category_structure" ? 178 : 168;
    const thirdRadius = strategy === "focus_mapping_overview" ? 145 : 122;
    const rotation = -Math.PI / 2;
    const placed = new Set([current.id]);
    firstRing.forEach((node, index) => {
      const angle = rotation + (Math.PI * 2 * index) / Math.max(1, firstRing.length);
      const parentPosition = {
        x: center.x + Math.cos(angle) * firstRadius,
        y: center.y + Math.sin(angle) * firstRadius,
      };
      positions.set(node.id, parentPosition);
      placed.add(node.id);
      const children = stableSort(childrenBySource.get(node.id)).filter((child) => !placed.has(child.id));
      const spread = Math.min(Math.PI * 0.86, 0.34 + children.length * 0.12);
      children.forEach((child, childIndex) => {
        const ratio = children.length <= 1 ? 0.5 : childIndex / (children.length - 1);
        const childAngle = angle - spread / 2 + spread * ratio;
        const offset = ((hashSeed(`${node.id}:${child.id}`) % 29) - 14) * 1.2;
        const childPosition = {
          x: parentPosition.x + Math.cos(childAngle) * (secondRadius + offset),
          y: parentPosition.y + Math.sin(childAngle) * (secondRadius + offset),
        };
        positions.set(child.id, childPosition);
        placed.add(child.id);
        const grandchildren = stableSort(childrenBySource.get(child.id)).filter((grandchild) => !placed.has(grandchild.id));
        const grandchildSpread = Math.min(Math.PI * 0.72, 0.28 + grandchildren.length * 0.1);
        grandchildren.forEach((grandchild, grandchildIndex) => {
          const grandchildRatio = grandchildren.length <= 1 ? 0.5 : grandchildIndex / (grandchildren.length - 1);
          const grandchildAngle = childAngle - grandchildSpread / 2 + grandchildSpread * grandchildRatio;
          const grandchildOffset = ((hashSeed(`${child.id}:${grandchild.id}`) % 23) - 11) * 1.1;
          positions.set(grandchild.id, {
            x: childPosition.x + Math.cos(grandchildAngle) * (thirdRadius + grandchildOffset),
            y: childPosition.y + Math.sin(grandchildAngle) * (thirdRadius + grandchildOffset),
          });
          placed.add(grandchild.id);
        });
      });
    });
    businessNodes.forEach((node, index) => {
      if (positions.has(node.id)) return;
      const seed = hashSeed(node.id || node.label || index);
      const angle = rotation + index * Math.PI * (3 - Math.sqrt(5)) + ((seed % 90) / 180) * Math.PI;
      const radius = firstRadius + secondRadius + 70 + (index % 4) * 18;
      positions.set(node.id, {
        x: center.x + Math.cos(angle) * radius,
        y: center.y + Math.sin(angle) * radius,
      });
    });
    return true;
  }

  function seedInitialLayout({ current, businessNodes, liveEdges, nodesById, positions, strategy }) {
    if (seedStructureStarLayout({ current, businessNodes, liveEdges, nodesById, positions, strategy })) return;
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

  function settleCollisions(businessNodes, positions, fixedIds, strategy = "") {
    const maxIterations = strategy === "focus_mapping_overview" ? 120 : businessNodes.length > 150 ? 24 : businessNodes.length > 100 ? 38 : 96;
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
          const minimum = collisionRadius(left) + collisionRadius(right) + (strategy === "focus_mapping_overview" ? 38 : 22);
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
    const liveEdges = edges.filter((edge) => (!edge.isDecorative || edge.isLayoutOnly) && nodesById.has(edge.source) && nodesById.has(edge.target));
    const strategy = graphModel.stats?.strategy || "";
    const depths = graphDepths(current, businessNodes, liveEdges);
    if (current) fixedIds.add(current.id);
    seedInitialLayout({ current, businessNodes, liveEdges, nodesById, positions, strategy });
    if (strategy === "focus_mapping_overview") {
      businessNodes.forEach((node) => {
        const depth = depths.get(node.id);
        if (depth <= 1) fixedIds.add(node.id);
      });
    }
    const velocities = new Map(businessNodes.map((node) => [node.id, { x: 0, y: 0 }]));
    const center = { x: VIEWBOX.width / 2, y: VIEWBOX.height / 2 };
    const layoutIterations = strategy === "focus_mapping_overview" ? 180 : businessNodes.length > 150 ? 96 : businessNodes.length > 100 ? 150 : 320;
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
        const desired = idealLinkDistance(edge, nodesById, depths, strategy);
        const force = ((distance - desired) / distance) * alpha * (strategy === "focus_mapping_overview" ? 0.1 : 0.22);
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
          const minimum = collisionRadius(left) + collisionRadius(right) + (strategy === "focus_mapping_overview" ? (sameGroup ? 52 : 40) : (sameGroup ? 34 : 24));
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
        const centerPull = strategy === "focus_mapping_overview" ? 0.0006 : isLayeredRadialStrategy(strategy) ? 0.003 : 0.009;
        velocity.x += (center.x - position.x) * centerPull * alpha;
        velocity.y += (center.y - position.y) * centerPull * alpha;
        const depth = depths.get(node.id);
        if (current && depth > 0) {
          const currentPosition = positions.get(current.id) || center;
          const dx = position.x - currentPosition.x;
          const dy = position.y - currentPosition.y;
          const distance = Math.hypot(dx, dy) || 1;
          const structureRadius = structureIdealRadius(strategy, depth);
          const idealRadius = structureRadius || Math.min(540, 190 + depth * 72);
          const radialStrength = strategy === "focus_mapping_overview" ? 0.012 : structureRadius ? 0.028 : 0.008;
          const radialForce = ((idealRadius - distance) / distance) * radialStrength * alpha;
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
    settleCollisions(businessNodes, positions, fixedIds, strategy);
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

  function layoutMetrics(businessNodes, positions, viewBox, labelPlacements = new Map()) {
    let overlaps = 0;
    let minGap = Infinity;
    let labelOverlaps = 0;
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
    const labelBoxes = Array.from(labelPlacements.values()).map((placement) => placement.box).filter(Boolean);
    for (let a = 0; a < labelBoxes.length; a += 1) {
      for (let b = a + 1; b < labelBoxes.length; b += 1) {
        if (boxesOverlap(labelBoxes[a], labelBoxes[b], 0)) labelOverlaps += 1;
      }
    }
    return {
      overlaps,
      labelOverlaps,
      minGap: Number.isFinite(minGap) ? Math.round(minGap) : 0,
      viewBox: `${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`,
    };
  }

  function managementFunctionEdgeType(type = "") {
    return type === "management_function_root_to_layer" || type === "layer_to_function";
  }

  function boundaryPoint(source, target, radius = 0, direction = 1) {
    const dx = target.x - source.x;
    const dy = target.y - source.y;
    const distance = Math.hypot(dx, dy) || 1;
    return {
      x: source.x + (dx / distance) * radius * direction,
      y: source.y + (dy / distance) * radius * direction,
    };
  }

  function edgePath(source, target, type = "", sourceRadius = 0, targetRadius = 0) {
    if (managementFunctionEdgeType(type)) {
      const start = boundaryPoint(source, target, sourceRadius + 4, 1);
      const end = boundaryPoint(target, source, targetRadius + 4, 1);
      const deltaX = end.x - start.x;
      const deltaY = end.y - start.y;
      if (type === "layer_to_function" && Math.abs(deltaX) < 120) {
        const handle = Math.max(34, Math.abs(deltaY) * 0.42);
        const direction = deltaY >= 0 ? 1 : -1;
        return `M ${start.x} ${start.y} C ${start.x} ${start.y + handle * direction}, ${end.x} ${end.y - handle * direction}, ${end.x} ${end.y}`;
      }
      const dx = Math.max(28, Math.abs(deltaX) * 0.4);
      const direction = deltaX >= 0 ? 1 : -1;
      return `M ${start.x} ${start.y} C ${start.x + dx * direction} ${start.y}, ${end.x - dx * direction} ${end.y}, ${end.x} ${end.y}`;
    }
    const dx = Math.max(80, Math.abs(target.x - source.x) * 0.44);
    const direction = target.x >= source.x ? 1 : -1;
    const bend = type === "focus_to_standard_status" ? 34 : type === "decorative_link" ? 0 : 6;
    return `M ${source.x} ${source.y} C ${source.x + dx * direction} ${source.y - bend}, ${target.x - dx * direction} ${target.y + bend}, ${target.x} ${target.y}`;
  }

  function edgeClass(edge) {
    return `network-edge ${edge.isDecorative ? "is-decorative" : "is-business"} edge-${nodeClass(edge.type)}`;
  }

  function estimateLabelWidth(lines = []) {
    const maxLength = Math.max(1, ...list(lines).map((line) => text(line).length));
    return Math.min(170, Math.max(44, maxLength * 9.6));
  }

  function labelBox({ x, y, anchor, lines }) {
    const width = estimateLabelWidth(lines);
    const height = Math.max(12, lines.length * 12);
    const left = anchor === "end" ? x - width : anchor === "middle" ? x - width / 2 : x;
    const top = y - 10;
    return {
      left,
      top,
      right: left + width,
      bottom: top + height + 4,
      width,
      height,
    };
  }

  function boxesOverlap(a, b, gap = 0) {
    return a.left - gap < b.right && a.right + gap > b.left && a.top - gap < b.bottom && a.bottom + gap > b.top;
  }

  function circleIntersectsBox(center, radius, box, gap = 0) {
    const nearestX = Math.max(box.left - gap, Math.min(center.x, box.right + gap));
    const nearestY = Math.max(box.top - gap, Math.min(center.y, box.bottom + gap));
    return Math.hypot(center.x - nearestX, center.y - nearestY) < radius + gap;
  }

  function segmentIntersectsBox(start, end, box, gap = 0) {
    const expanded = {
      left: box.left - gap,
      top: box.top - gap,
      right: box.right + gap,
      bottom: box.bottom + gap,
    };
    const lineMinX = Math.min(start.x, end.x);
    const lineMaxX = Math.max(start.x, end.x);
    const lineMinY = Math.min(start.y, end.y);
    const lineMaxY = Math.max(start.y, end.y);
    if (lineMaxX < expanded.left || lineMinX > expanded.right || lineMaxY < expanded.top || lineMinY > expanded.bottom) return false;
    const samples = 8;
    for (let index = 0; index <= samples; index += 1) {
      const ratio = index / samples;
      const x = start.x + (end.x - start.x) * ratio;
      const y = start.y + (end.y - start.y) * ratio;
      if (x >= expanded.left && x <= expanded.right && y >= expanded.top && y <= expanded.bottom) return true;
    }
    return false;
  }

  function cubicPoint(start, controlA, controlB, end, ratio) {
    const inverse = 1 - ratio;
    const a = inverse * inverse * inverse;
    const b = 3 * inverse * inverse * ratio;
    const c = 3 * inverse * ratio * ratio;
    const d = ratio * ratio * ratio;
    return {
      x: start.x * a + controlA.x * b + controlB.x * c + end.x * d,
      y: start.y * a + controlA.y * b + controlB.y * c + end.y * d,
    };
  }

  function edgeIntersectsBox(edge, source, target, box, gap = 0) {
    const dx = Math.max(80, Math.abs(target.x - source.x) * 0.44);
    const direction = target.x >= source.x ? 1 : -1;
    const bend = edge.type === "focus_to_standard_status" ? 34 : edge.type === "decorative_link" ? 0 : 6;
    const controlA = { x: source.x + dx * direction, y: source.y - bend };
    const controlB = { x: target.x - dx * direction, y: target.y + bend };
    let previous = source;
    const samples = 18;
    for (let index = 1; index <= samples; index += 1) {
      const current = cubicPoint(source, controlA, controlB, target, index / samples);
      if (segmentIntersectsBox(previous, current, box, gap)) return true;
      previous = current;
    }
    return false;
  }

  function labelPlacementFromSide(position, radius, side, lines) {
    const sideOffset = side.includes("diagonal") ? 14 : 10;
    if (side === "right") return { x: position.x + radius + sideOffset, y: position.y, anchor: "start", lines };
    if (side === "left") return { x: position.x - radius - sideOffset, y: position.y, anchor: "end", lines };
    if (side === "top") return { x: position.x, y: position.y - radius - 15, anchor: "middle", lines };
    if (side === "bottom") return { x: position.x, y: position.y + radius + 17, anchor: "middle", lines };
    if (side === "top-right") return { x: position.x + radius + sideOffset, y: position.y - radius - 10, anchor: "start", lines };
    if (side === "top-left") return { x: position.x - radius - sideOffset, y: position.y - radius - 10, anchor: "end", lines };
    if (side === "bottom-right") return { x: position.x + radius + sideOffset, y: position.y + radius + 14, anchor: "start", lines };
    return { x: position.x - radius - sideOffset, y: position.y + radius + 14, anchor: "end", lines };
  }

  function defaultLabelSide(node, position, currentPosition, strategy = "") {
    const relativeX = currentPosition ? position.x - currentPosition.x : position.x - VIEWBOX.width / 2;
    const relativeY = currentPosition ? position.y - currentPosition.y : position.y - VIEWBOX.height / 2;
    const isL2FocusNode = strategy === "focus_mapping_overview" && node.type === "focus_overview";
    const verticalOutward = Math.abs(relativeX) < 58 && Math.abs(relativeY) > 130;
    const focusVertical = isL2FocusNode && Math.abs(relativeX) < 95;
    const hierarchyDepth = Number(node.meta?.hierarchyDepth);
    const isOuterLeaf = strategy === "focus_mapping_overview" && Number.isFinite(hierarchyDepth) && hierarchyDepth >= 3;
    if (node.type === "security_function_layer") return "top";
    if (isOuterLeaf && Math.abs(relativeY) > 70 && Math.abs(relativeY) > Math.abs(relativeX) * 0.42) return relativeY < 0 ? "top" : "bottom";
    if (focusVertical || verticalOutward) return relativeY < 0 ? "top" : "bottom";
    if (position.x > VIEWBOX.width - 260) return "left";
    if (position.x < 260) return "right";
    if (isL2FocusNode) return relativeX >= 0 ? "left" : "right";
    return relativeX < 0 ? "left" : "right";
  }

  function labelCandidates(node, position, radius, currentPosition, strategy = "") {
    const labelLength = node.type === "standard_status" ? 16 : node.type === "standard_control" ? 16 : node.type === "security_function" ? 15 : 14;
    const lines = labelLines(node.label, labelLength, 2);
    if (!lines.length) return [];
    const preferred = defaultLabelSide(node, position, currentPosition, strategy);
    const sides = [preferred, "right", "left", "top", "bottom", "top-right", "top-left", "bottom-right", "bottom-left"].filter((side, index, items) => items.indexOf(side) === index);
    return sides.map((side, index) => {
      const placement = labelPlacementFromSide(position, radius, side, lines);
      return {
        ...placement,
        side,
        box: labelBox(placement),
        preferredRank: index,
      };
    });
  }

  function labelPlacementScore(candidate, node, businessNodes, positions, edges, occupiedBoxes) {
    let score = candidate.preferredRank * 16;
    const overflowLeft = Math.max(0, -candidate.box.left);
    const overflowRight = Math.max(0, candidate.box.right - VIEWBOX.width);
    const overflowTop = Math.max(0, -candidate.box.top);
    const overflowBottom = Math.max(0, candidate.box.bottom - VIEWBOX.height);
    score += (overflowLeft + overflowRight + overflowTop + overflowBottom) * 5;
    businessNodes.forEach((other) => {
      if (other.id === node.id) return;
      const otherPosition = positions.get(other.id);
      if (!otherPosition) return;
      if (circleIntersectsBox(otherPosition, nodeRadius(other), candidate.box, 8)) score += 520;
    });
    occupiedBoxes.forEach((box) => {
      if (boxesOverlap(candidate.box, box, 6)) score += 360;
    });
    edges.forEach((edge) => {
      if (edge.isDecorative) return;
      const source = positions.get(edge.source);
      const target = positions.get(edge.target);
      if (!source || !target) return;
      if (!edgeIntersectsBox(edge, source, target, candidate.box, 10)) return;
      const incident = edge.source === node.id || edge.target === node.id;
      score += incident ? 160 : 320;
    });
    return score;
  }

  function buildLabelPlacements(model, businessNodes, positions) {
    const current = model.nodes?.find((item) => item.isCurrent) || model.nodes?.find((item) => item.type === "current_focus");
    const currentPosition = positions.get(current?.id);
    const strategy = model.stats?.strategy || "";
    const orderedNodes = [...businessNodes]
      .filter((node) => !node.isCurrent)
      .sort((a, b) => nodeRadius(b) - nodeRadius(a) || text(a.label || a.id).localeCompare(text(b.label || b.id), "zh-Hans-CN"));
    const placements = new Map();
    const occupiedBoxes = [];
    orderedNodes.forEach((node) => {
      const position = positions.get(node.id);
      if (!position) return;
      const radius = nodeRadius(node);
      const candidates = labelCandidates(node, position, radius, currentPosition, strategy);
      if (!candidates.length) return;
      const best = candidates.reduce((winner, candidate) => {
        const score = labelPlacementScore(candidate, node, businessNodes, positions, model.edges || [], occupiedBoxes);
        return !winner || score < winner.score ? { ...candidate, score } : winner;
      }, null);
      if (!best) return;
      placements.set(node.id, best);
      occupiedBoxes.push(best.box);
    });
    return placements;
  }

  function renderEdge(edge, positions, nodesById = new Map(), extraClass = "") {
    const source = positions.get(edge.source);
    const target = positions.get(edge.target);
    if (!source || !target) return "";
    const sourceRadius = managementFunctionEdgeType(edge.type) ? nodeRadius(nodesById.get(edge.source)) : 0;
    const targetRadius = managementFunctionEdgeType(edge.type) ? nodeRadius(nodesById.get(edge.target)) : 0;
    return `<path class="${escape(`${edgeClass(edge)} ${extraClass}`)}" d="${edgePath(source, target, edge.type, sourceRadius, targetRadius)}" />`;
  }

  function incidentEdges(nodeId, edges, positions, nodesById = new Map()) {
    return list(edges)
      .filter((edge) => !edge.isDecorative && (edge.source === nodeId || edge.target === nodeId))
      .map((edge) => renderEdge(edge, positions, nodesById, "node-hover-edge"))
      .join("");
  }

  function renderDecorative(nodes, edges, positions) {
    return "";
  }

  function renderNodeText(node, position, radius, currentPosition, strategy = "", placement = null) {
    if (node.isCurrent) {
      const code = text(node.meta?.currentCode || node.meta?.capabilityCode || node.meta?.code).trim();
      const title = text(node.meta?.currentTitle || node.meta?.capability || node.label).trim();
      const label = title || node.label;
      const lines = labelLines(label, 11, 2);
      return `
        <text class="network-node-title is-current" x="${position.x}" y="${position.y - (lines.length > 1 ? 3 : -3)}" text-anchor="middle">
          ${lines.map((line, index) => `<tspan x="${position.x}" dy="${index === 0 ? 0 : 13}">${escape(line)}</tspan>`).join("")}
        </text>
        ${code && code !== label ? `<text class="network-node-code" x="${position.x}" y="${position.y + 30}" text-anchor="middle">${escape(code)}</text>` : ""}
      `;
    }
    const isL2FocusNode = strategy === "focus_mapping_overview" && node.type === "focus_overview";
    const labelLength = node.type === "standard_status" ? 16 : node.type === "standard_control" ? 16 : node.type === "security_function" ? 15 : 14;
    const lines = labelLines(node.label, labelLength, 2);
    const relativeX = currentPosition ? position.x - currentPosition.x : position.x - VIEWBOX.width / 2;
    const relativeY = currentPosition ? position.y - currentPosition.y : position.y - VIEWBOX.height / 2;
    const isNearRightEdge = position.x > VIEWBOX.width - 260;
    const isNearLeftEdge = position.x < 260;
    const verticalOutward = Math.abs(relativeX) < 58 && Math.abs(relativeY) > 130;
    const focusVertical = isL2FocusNode && Math.abs(relativeX) < 95;
    if (node.type === "security_function_layer") {
      const safePlacement = placement || labelPlacementFromSide(position, radius, "top", lines);
      return `
        <text class="network-node-title" x="${safePlacement.x}" y="${safePlacement.y}" text-anchor="${safePlacement.anchor}">
          ${lines.map((line, index) => `<tspan x="${safePlacement.x}" dy="${index === 0 ? 0 : 12}">${escape(line)}</tspan>`).join("")}
        </text>
      `;
    }
    const anchor = focusVertical || verticalOutward ? "middle" : isL2FocusNode ? (relativeX >= 0 ? "end" : "start") : isNearRightEdge ? "end" : isNearLeftEdge ? "start" : relativeX < 0 ? "end" : "start";
    const textOffset = isL2FocusNode ? 15 : 8;
    const textX = focusVertical || verticalOutward ? position.x : anchor === "end" ? position.x - radius - textOffset : position.x + radius + textOffset;
    const textY = focusVertical
      ? position.y + (relativeY >= 0 ? -radius - 18 : radius + 16)
      : verticalOutward
        ? position.y + (relativeY < 0 ? -radius - 14 : radius + 12)
        : position.y;
    const safePlacement = placement || { x: textX, y: textY, anchor, lines };
    return `
      <text class="network-node-title" x="${safePlacement.x}" y="${safePlacement.y}" text-anchor="${safePlacement.anchor}">
        ${lines.map((line, index) => `<tspan x="${safePlacement.x}" dy="${index === 0 ? 0 : 12}">${escape(line)}</tspan>`).join("")}
      </text>
    `;
  }

  function renderNode(node, graphModel, positions, nodesById = new Map(), labelPlacements = new Map()) {
    const position = positions.get(node.id);
    if (!position || node.isDecorative) return "";
    const radius = nodeRadius(node);
    const currentPosition = positions.get(graphModel.nodes?.find((item) => item.isCurrent)?.id) || positions.get(graphModel.nodes?.find((item) => item.type === "current_focus")?.id);
    const strategy = graphModel.stats?.strategy || "";
    const titleParts = [node.label, node.meta?.code, node.meta?.layer, node.meta?.capability].map(text).filter(Boolean);
    const hierarchyDepth = Number(node.meta?.hierarchyDepth);
    const hierarchyClass = Number.isFinite(hierarchyDepth) ? `node-depth-${Math.max(0, Math.min(3, hierarchyDepth))}` : "";
    return `
      <g class="network-node-wrap node-${escape(nodeClass(node.type))} ${escape(hierarchyClass)} ${node.isCurrent ? "is-current" : ""}" tabindex="0" data-graph-node-id="${escape(node.id)}" role="listitem" aria-label="${escape(titleParts.join("，"))}">
        <title>${escape(titleParts.join(" / "))}</title>
        ${incidentEdges(node.id, graphModel.edges, positions, nodesById)}
        ${node.isCurrent ? `<circle class="network-node-halo" cx="${position.x}" cy="${position.y}" r="112" />` : ""}
        <circle class="network-node-shape" cx="${position.x}" cy="${position.y}" r="${radius}" />
        ${renderNodeText(node, position, radius, currentPosition, strategy, labelPlacements.get(node.id))}
      </g>
    `;
  }

  function renderGroupLabels() {
    return "";
  }

  function renderLegend(model = {}) {
    const legendItems = list(model.stats?.legendItems);
    if (legendItems.length) {
      return `
        <div class="network-legend" aria-label="图例">
          ${legendItems.map((item) => `<span><i class="${escape(item.className || "legend-current")}"></i>${escape(item.label || "")}</span>`).join("")}
        </div>
      `;
    }
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
    if (stats.note) return `<p class="network-graph-note">${escape(stats.note)}</p>`;
    if (stats.strategy === "category_structure") {
      return `<p class="network-graph-note">${escape(`L0 结构图：展示本分类下 ${stats.domainCount || 0} 个 L1 和 ${stats.capabilityCount || 0} 个 L2。`)}</p>`;
    }
    if (stats.strategy === "domain_structure") {
      return `<p class="network-graph-note">${escape(`L1 结构图：展示当前 L1 下 ${stats.capabilityCount || 0} 个 L2 和 ${stats.focusCount || 0} 个关注点。`)}</p>`;
    }
    if (stats.strategy === "focus_mapping_overview") {
      return `<p class="network-graph-note">${escape(`L2 映射概览：以当前 L2 能力为中心，第二层展示 ${stats.focusCount || 0} 个 L3 关注点，第三层展开技术视角、管理视角和标准 / 框架映射，第四层展示作用域、安全工作和标准 / 框架种类。`)}</p>`;
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
    const nodesById = new Map(nodes.map((node) => [node.id, node]));
    const businessNodes = nodes.filter((node) => !node.isDecorative);
    if (!businessNodes.length) {
      return `<section class="local-relation-network-graph"><div class="preview-table-empty"><strong>暂无本地关联图谱</strong><span>当前关注点尚未形成可展示的关系投影。</span></div></section>`;
    }
    const positions = buildLayout(model);
    const labelPlacements = buildLabelPlacements(model, businessNodes, positions);
    const viewBox = visibleViewBox(businessNodes, positions);
    const metrics = layoutMetrics(businessNodes, positions, viewBox, labelPlacements);
    const stats = model.stats || {};
    const title = stats.networkTitle || "能力关系图谱";
    const ariaLabel = stats.ariaLabel || "当前关注点能力关系图谱";
    return `
      <section class="local-relation-network-graph" aria-label="${escape(title)}">
        <header class="network-graph-head">
          <div>
            <h3>${escape(title)}</h3>
          </div>
          ${renderLegend(model)}
        </header>
        <div class="network-graph-canvas" role="img" aria-label="${escape(ariaLabel)}" data-viewbox-width="${viewBox.width}" data-viewbox-height="${viewBox.height}" data-layout-overlaps="${metrics.overlaps}" data-layout-label-overlaps="${metrics.labelOverlaps}" data-layout-min-gap="${metrics.minGap}" data-business-nodes="${businessNodes.length}" data-layout-viewbox="${escape(metrics.viewBox)}" data-zoom="1" data-pan-x="0" data-pan-y="0">
          <div class="network-graph-actions" aria-label="图谱缩放控制">
            <button type="button" data-network-zoom="out" title="缩小图谱" aria-label="缩小图谱">−</button>
            <span data-network-zoom-value>100%</span>
            <button type="button" data-network-zoom="in" title="放大图谱" aria-label="放大图谱">+</button>
            <button type="button" data-network-zoom="reset" title="重置图谱视图" aria-label="重置图谱视图">1:1</button>
          </div>
          <svg viewBox="${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}" preserveAspectRatio="xMidYMid meet" role="presentation">
            <defs>
              <radialGradient id="network-center-halo" cx="50%" cy="50%" r="62%">
                <stop offset="0%" stop-color="oklch(0.52 0.058 292 / 0.22)" />
                <stop offset="70%" stop-color="oklch(0.72 0.035 292 / 0.08)" />
                <stop offset="100%" stop-color="oklch(0.985 0.006 86 / 0)" />
              </radialGradient>
            </defs>
            <g class="network-pan-layer" transform="translate(0 0)">
              ${renderDecorative(nodes, model.edges, positions)}
              <g class="network-business-edge-layer" aria-hidden="true">
                ${list(model.edges)
                  .filter((edge) => !edge.isDecorative)
                  .map((edge) => renderEdge(edge, positions, nodesById))
                  .join("")}
              </g>
              ${renderGroupLabels()}
              <g class="network-node-layer" role="list">
                ${businessNodes.map((node) => renderNode(node, model, positions, nodesById, labelPlacements)).join("")}
              </g>
            </g>
          </svg>
        </div>
      </section>
    `;
  }

  components.LocalRelationNetworkGraph = { render };
})();
