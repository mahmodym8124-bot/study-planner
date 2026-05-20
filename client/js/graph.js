import * as d3 from 'd3';
import i18n from './i18n.js';

const NODE_COLORS = ['#2dd4bf', '#f59e0b', '#10b981', '#a78bfa'];

function hash(input = '') {
  return [...String(input)].reduce((acc, char) => acc + char.charCodeAt(0), 0);
}

function nodeColor(node = {}) {
  if (String(node.type || '').toLowerCase() === 'note') return NODE_COLORS[0];
  if (String(node.type || '').toLowerCase() === 'idea') return NODE_COLORS[1];
  return NODE_COLORS[hash(node.category || node.folder || node.status || node.title || node.id) % NODE_COLORS.length];
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function normalizeGraphPayload(payload = {}) {
  const rawNodes = Array.isArray(payload.nodes) ? payload.nodes : [];
  const rawEdges = Array.isArray(payload.edges) ? payload.edges : [];

  const nodes = rawNodes.map((entry) => {
    const data = entry.data || {};
    const title = entry.label || data.title || 'Untitled';
    const normalized = {
      ...entry,
      ...data,
      id: String(entry.id || data._id),
      _id: data._id || entry._id || entry.id,
      title,
      tags: Array.isArray(data.tags) ? data.tags : (Array.isArray(entry.tags) ? entry.tags : []),
      type: entry.type || data.type || 'note',
      thumbnail: data.thumbnail || entry.thumbnail || '',
      color: nodeColor({ ...entry, ...data, title })
    };
    return normalized;
  });

  const nodeMap = new Map(nodes.map((node) => [node.id, node]));
  const edges = rawEdges
    .map((edge, index) => {
      const sourceId = typeof edge.source === 'string' ? edge.source : edge.source?.id;
      const targetId = typeof edge.target === 'string' ? edge.target : edge.target?.id;
      const source = nodeMap.get(sourceId);
      const target = nodeMap.get(targetId);
      if (!source || !target || source.id === target.id) return null;
      return {
        id: edge.id || `${source.id}-${target.id}-${index}`,
        source,
        target,
        weight: Number(edge.weight || 1)
      };
    })
    .filter(Boolean);

  const degreeById = new Map(nodes.map((node) => [node.id, 0]));
  edges.forEach((edge) => {
    degreeById.set(edge.source.id, (degreeById.get(edge.source.id) || 0) + 1);
    degreeById.set(edge.target.id, (degreeById.get(edge.target.id) || 0) + 1);
  });
  const maxDegree = Math.max(...degreeById.values(), 1);
  nodes.forEach((node) => {
    node.degree = degreeById.get(node.id) || 0;
    node.size = clamp(24 + ((node.degree / maxDegree) * 40), 24, 64);
    node.radius = node.size / 2;
  });

  return { nodes, edges };
}

function createCollisionForce(nodes, padding = 6) {
  return function collide() {
    const tree = d3.quadtree(nodes, (d) => d.x, (d) => d.y);
    for (const node of nodes) {
      const radius = node.radius + padding;
      const xMin = node.x - radius;
      const xMax = node.x + radius;
      const yMin = node.y - radius;
      const yMax = node.y + radius;
      tree.visit((quad, x0, y0, x1, y1) => {
        if (!quad.data || quad.data === node) return x0 > xMax || x1 < xMin || y0 > yMax || y1 < yMin;
        const other = quad.data;
        let dx = node.x - other.x;
        let dy = node.y - other.y;
        const distance = Math.hypot(dx, dy) || 0.001;
        const minDistance = node.radius + other.radius + padding;
        if (distance < minDistance) {
          const adjustment = (minDistance - distance) * 0.08;
          dx = (dx / distance) * adjustment;
          dy = (dy / distance) * adjustment;
          node.x += dx;
          node.y += dy;
          other.x -= dx;
          other.y -= dy;
        }
        return x0 > xMax || x1 < xMin || y0 > yMax || y1 < yMin;
      });
    }
  };
}

function curvePath(link) {
  const sx = link.source.x;
  const sy = link.source.y;
  const tx = link.target.x;
  const ty = link.target.y;
  const mx = (sx + tx) / 2;
  const my = (sy + ty) / 2;
  const dx = tx - sx;
  const dy = ty - sy;
  const length = Math.hypot(dx, dy) || 1;
  const normalX = -dy / length;
  const normalY = dx / length;
  const curvature = clamp(length * 0.18, 20, 80);
  const cx = mx + (normalX * curvature);
  const cy = my + (normalY * curvature);
  return `M ${sx} ${sy} Q ${cx} ${cy} ${tx} ${ty}`;
}

function fileNameDate() {
  return new Date().toISOString().slice(0, 10);
}

export function createGraphExperience(container, payload, callbacks = {}) {
  const { onSelect, onCanvasClick } = callbacks;
  const parsed = normalizeGraphPayload(payload);
  const nodes = parsed.nodes.length ? parsed.nodes : [{
    id: 'placeholder',
    _id: 'placeholder',
    title: i18n.t('graph.placeholderNode'),
    type: 'note',
    tags: [],
    color: NODE_COLORS[0],
    degree: 0,
    size: 24,
    radius: 12
  }];
  const links = parsed.edges;
  const graphId = `kg-${Math.random().toString(16).slice(2, 10)}`;

  let width = Math.max(400, container.clientWidth || 400);
  let height = Math.max(420, container.clientHeight || 420);
  let hoveredNodeId = null;
  let selectedNodeId = null;
  let activeSearch = '';
  let searchMatchCount = 0;
  let currentTransform = d3.zoomIdentity;
  let resizeTimeout;

  container.innerHTML = '';
  const svg = d3.select(container)
    .append('svg')
    .attr('class', 'kg-svg')
    .attr('viewBox', `0 0 ${width} ${height}`)
    .attr('width', '100%')
    .attr('height', '100%');

  const defs = svg.append('defs');
  const gridPatternId = `${graphId}-dot-grid`;
  defs.append('pattern')
    .attr('id', gridPatternId)
    .attr('patternUnits', 'userSpaceOnUse')
    .attr('width', 40)
    .attr('height', 40)
    .append('circle')
    .attr('cx', 20)
    .attr('cy', 20)
    .attr('r', 1.1)
    .attr('fill', '#1e293b')
    .attr('opacity', 0.3);

  const vignetteId = `${graphId}-vignette`;
  const vignetteGradient = defs.append('radialGradient')
    .attr('id', vignetteId)
    .attr('cx', '50%')
    .attr('cy', '50%')
    .attr('r', '75%');
  vignetteGradient.append('stop').attr('offset', '0%').attr('stop-color', '#0f1115').attr('stop-opacity', 0);
  vignetteGradient.append('stop').attr('offset', '100%').attr('stop-color', '#000').attr('stop-opacity', 0.42);

  NODE_COLORS.forEach((color, index) => {
    const filter = defs.append('filter')
      .attr('id', `${graphId}-glow-${index}`)
      .attr('x', '-120%')
      .attr('y', '-120%')
      .attr('width', '340%')
      .attr('height', '340%');
    filter.append('feGaussianBlur')
      .attr('stdDeviation', 4)
      .attr('result', 'blurred');
    filter.append('feFlood')
      .attr('flood-color', color)
      .attr('flood-opacity', 0.6)
      .attr('result', 'color');
    filter.append('feComposite')
      .attr('in', 'color')
      .attr('in2', 'blurred')
      .attr('operator', 'in')
      .attr('result', 'glow');
    const merge = filter.append('feMerge');
    merge.append('feMergeNode').attr('in', 'glow');
    merge.append('feMergeNode').attr('in', 'SourceGraphic');
  });

  svg.append('rect')
    .attr('class', 'kg-background')
    .attr('x', 0)
    .attr('y', 0)
    .attr('width', width)
    .attr('height', height)
    .attr('fill', '#0f1115')
    .on('click', () => {
      selectedNodeId = null;
      updateVisualStates();
      onCanvasClick?.();
    });

  const gridLayer = svg.append('g').attr('class', 'kg-grid-layer');
  const gridRect = gridLayer.append('rect')
    .attr('x', -width)
    .attr('y', -height)
    .attr('width', width * 3)
    .attr('height', height * 3)
    .attr('fill', `url(#${gridPatternId})`);

  const graphLayer = svg.append('g').attr('class', 'kg-graph-layer');
  const edgeLayer = graphLayer.append('g').attr('class', 'kg-edge-layer');
  const nodeLayer = graphLayer.append('g').attr('class', 'kg-node-layer');
  svg.append('rect')
    .attr('class', 'kg-vignette')
    .attr('x', 0)
    .attr('y', 0)
    .attr('width', width)
    .attr('height', height)
    .attr('fill', `url(#${vignetteId})`)
    .attr('pointer-events', 'none');

  const noResults = svg.append('text')
    .attr('class', 'kg-no-results')
    .attr('x', width / 2)
    .attr('y', height / 2)
    .attr('text-anchor', 'middle')
    .attr('dy', '0.35em')
    .style('display', 'none')
    .text(i18n.t('graph.noNodesFound'));

  links.forEach((link, index) => {
    link.gradientId = `${graphId}-edge-gradient-${index}`;
    const gradient = defs.append('linearGradient')
      .attr('id', link.gradientId)
      .attr('gradientUnits', 'userSpaceOnUse');
    gradient.append('stop').attr('offset', '0%').attr('stop-color', link.source.color);
    gradient.append('stop').attr('offset', '100%').attr('stop-color', link.target.color);
    link.gradientSelection = gradient;
  });

  const edgeSelection = edgeLayer.selectAll('path')
    .data(links, (d) => d.id)
    .join('path')
    .attr('class', 'kg-edge')
    .attr('fill', 'none')
    .attr('stroke-width', (d) => clamp(1 + (d.weight * 0.2), 1.2, 2.8))
    .attr('stroke-linecap', 'round')
    .attr('stroke', (d) => `url(#${d.gradientId})`)
    .style('opacity', 0.15);

  const nodeSelection = nodeLayer.selectAll('g')
    .data(nodes, (d) => d.id)
    .join('g')
    .attr('class', 'kg-node')
    .style('cursor', 'pointer')
    .on('mouseenter', (_, node) => {
      hoveredNodeId = node.id;
      updateVisualStates();
    })
    .on('mouseleave', () => {
      hoveredNodeId = null;
      updateVisualStates();
    })
    .on('click', (event, node) => {
      event.stopPropagation();
      selectedNodeId = node.id;
      updateVisualStates();
      onSelect?.(node);
    });

  nodeSelection.append('circle')
    .attr('class', 'kg-node-selection')
    .attr('r', (d) => d.radius + 5)
    .attr('stroke-width', 2);

  nodeSelection.append('circle')
    .attr('class', 'kg-node-glow')
    .attr('r', (d) => d.radius + 2)
    .attr('stroke', (d) => d.color)
    .attr('stroke-width', 1.5)
    .attr('fill', 'none')
    .attr('filter', (d) => `url(#${graphId}-glow-${NODE_COLORS.indexOf(d.color) === -1 ? 0 : NODE_COLORS.indexOf(d.color)})`);

  nodeSelection.append('circle')
    .attr('class', 'kg-node-inner')
    .attr('r', (d) => d.radius)
    .attr('fill', (d) => d.color);

  nodeSelection.each(function setThumbnail(node) {
    if (!node.thumbnail) return;
    const clipId = `${graphId}-clip-${node.id.replace(/[^a-zA-Z0-9_-]/g, '')}`;
    defs.append('clipPath')
      .attr('id', clipId)
      .append('circle')
      .attr('r', node.radius)
      .attr('cx', 0)
      .attr('cy', 0);
    d3.select(this)
      .append('image')
      .attr('class', 'kg-node-thumb')
      .attr('x', -node.radius)
      .attr('y', -node.radius)
      .attr('width', node.radius * 2)
      .attr('height', node.radius * 2)
      .attr('preserveAspectRatio', 'xMidYMid slice')
      .attr('clip-path', `url(#${clipId})`)
      .attr('href', node.thumbnail);
  });

  nodeSelection.append('text')
    .attr('class', 'kg-node-initial')
    .attr('text-anchor', 'middle')
    .attr('dy', '0.35em')
    .text((d) => String(d.title || '?').trim().charAt(0).toUpperCase() || '?');

  const isMobile = window.matchMedia('(max-width: 768px)').matches;
  const simulation = d3.forceSimulation(nodes)
    .force('link', d3.forceLink(links).id((d) => d.id).distance((d) => clamp(130 - (d.weight * 8), 72, 160)).strength(0.25))
    .force('charge', d3.forceManyBody().strength(isMobile ? -140 : -220))
    .force('center', d3.forceCenter(width / 2, height / 2))
    .force('x', d3.forceX(width / 2).strength(isMobile ? 0.04 : 0.025))
    .force('y', d3.forceY(height / 2).strength(isMobile ? 0.04 : 0.025))
    .force('collision', isMobile ? null : createCollisionForce(nodes, 8))
    .velocityDecay(0.34)
    .alphaDecay(isMobile ? 0.1 : 0.06);

  const dragBehavior = d3.drag()
    .on('start', (event, node) => {
      if (!event.active) simulation.alphaTarget(0.22).restart();
      node.fx = node.x;
      node.fy = node.y;
    })
    .on('drag', (event, node) => {
      node.fx = event.x;
      node.fy = event.y;
    })
    .on('end', (event, node) => {
      if (!event.active) simulation.alphaTarget(0.05);
      node.fx = null;
      node.fy = null;
      requestAnimationFrame(() => simulation.alphaTarget(0));
    });

  nodeSelection.call(dragBehavior);

  const zoom = d3.zoom()
    .scaleExtent([0.45, 2.8])
    .on('zoom', (event) => {
      currentTransform = event.transform;
      graphLayer.attr('transform', currentTransform);
      gridLayer.attr('transform', `translate(${currentTransform.x * 0.22}, ${currentTransform.y * 0.22})`);
    });

  svg.call(zoom).on('dblclick.zoom', null);

  function updateVisualStates() {
    edgeSelection.style('opacity', (link) => {
      const isHovered = hoveredNodeId && (link.source.id === hoveredNodeId || link.target.id === hoveredNodeId);
      const searchActive = Boolean(activeSearch);
      if (searchActive && !(link.source.isMatch && link.target.isMatch)) return 0.04;
      if (isHovered) return 0.4;
      return 0.15;
    });

    nodeSelection
      .classed('is-selected', (node) => selectedNodeId === node.id)
      .classed('is-hovered', (node) => hoveredNodeId === node.id)
      .classed('is-dimmed', (node) => activeSearch && !node.isMatch)
      .style('opacity', (node) => (activeSearch && !node.isMatch ? 0.15 : 1));
  }

  function ticked() {
    nodeSelection.attr('transform', (node) => {
      const scale = hoveredNodeId === node.id ? 1.2 : 1;
      return `translate(${node.x},${node.y}) scale(${scale})`;
    });

    edgeSelection.attr('d', (link) => curvePath(link));
    links.forEach((link) => {
      if (link.gradientSelection) {
        link.gradientSelection
          .attr('x1', link.source.x)
          .attr('y1', link.source.y)
          .attr('x2', link.target.x)
          .attr('y2', link.target.y);
      }
    });
  }

  simulation.on('tick', ticked);
  updateVisualStates();

  function fitToScreen() {
    const minX = d3.min(nodes, (d) => d.x - d.radius) ?? 0;
    const maxX = d3.max(nodes, (d) => d.x + d.radius) ?? width;
    const minY = d3.min(nodes, (d) => d.y - d.radius) ?? 0;
    const maxY = d3.max(nodes, (d) => d.y + d.radius) ?? height;
    const graphWidth = Math.max(120, maxX - minX);
    const graphHeight = Math.max(120, maxY - minY);
    const margin = 80;
    const scale = clamp(Math.min((width - margin) / graphWidth, (height - margin) / graphHeight), 0.45, 2.2);
    const tx = (width / 2) - ((minX + maxX) / 2) * scale;
    const ty = (height / 2) - ((minY + maxY) / 2) * scale;
    const transform = d3.zoomIdentity.translate(tx, ty).scale(scale);
    svg.transition().duration(320).call(zoom.transform, transform);
  }

  function applySearch(query = '') {
    activeSearch = String(query || '').trim().toLowerCase();
    if (!activeSearch) {
      nodes.forEach((node) => { node.isMatch = false; });
      searchMatchCount = 0;
      noResults.style('display', 'none');
      updateVisualStates();
      return;
    }

    const matches = [];
    nodes.forEach((node) => {
      const haystack = [
        node.title,
        node.type,
        node._id,
        ...(node.tags || []),
        node.folder,
        node.status
      ].join(' ').toLowerCase();
      node.isMatch = haystack.includes(activeSearch);
      if (node.isMatch) matches.push(node);
    });

    searchMatchCount = matches.length;
    nodeSelection.classed('kg-node-pulse', false);
    if (matches.length) {
      const matchedNodes = nodeSelection.filter((node) => node.isMatch).classed('kg-node-pulse', true);
      requestAnimationFrame(() => {
        matchedNodes.classed('kg-node-pulse', true);
      });
      setTimeout(() => {
        matchedNodes.classed('kg-node-pulse', false);
      }, 820);
    }
    noResults.style('display', matches.length ? 'none' : 'block');
    updateVisualStates();
  }

  async function downloadPng() {
    const serializer = new XMLSerializer();
    const sourceSvg = svg.node();
    const serialized = serializer.serializeToString(sourceSvg);
    const withNs = serialized.includes('xmlns=')
      ? serialized
      : serialized.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');

    const blob = new Blob([withNs], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    try {
      const image = await new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = url;
      });
      const canvas = document.createElement('canvas');
      canvas.width = width * 2;
      canvas.height = height * 2;
      const context = canvas.getContext('2d');
      context.fillStyle = '#0f1115';
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      const link = document.createElement('a');
      link.href = canvas.toDataURL('image/png');
      link.download = `mindvault-graph-${fileNameDate()}.png`;
      link.click();
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  function onResize() {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
      width = Math.max(400, container.clientWidth || 400);
      height = Math.max(420, container.clientHeight || 420);
      const activeMobile = window.matchMedia('(max-width: 768px)').matches;
      svg.attr('viewBox', `0 0 ${width} ${height}`);
      svg.select('.kg-background').attr('width', width).attr('height', height);
      gridRect
        .attr('x', -width)
        .attr('y', -height)
        .attr('width', width * 3)
        .attr('height', height * 3);
      svg.select('.kg-vignette').attr('width', width).attr('height', height);
      noResults.attr('x', width / 2).attr('y', height / 2);
      simulation.force('center', d3.forceCenter(width / 2, height / 2));
      simulation.force('x', d3.forceX(width / 2).strength(activeMobile ? 0.04 : 0.025));
      simulation.force('y', d3.forceY(height / 2).strength(activeMobile ? 0.04 : 0.025));
      simulation.force('charge', d3.forceManyBody().strength(activeMobile ? -140 : -220));
      simulation.force('collision', activeMobile ? null : createCollisionForce(nodes, 8));
      simulation.alphaDecay(activeMobile ? 0.1 : 0.06);
      simulation.alpha(0.2).restart();
    }, 120);
  }

  window.addEventListener('resize', onResize, { passive: true });

  return {
    applySearch,
    zoomIn() {
      svg.transition().duration(220).call(zoom.scaleBy, 1.2);
    },
    zoomOut() {
      svg.transition().duration(220).call(zoom.scaleBy, 0.84);
    },
    resetView() {
      svg.transition().duration(260).call(zoom.transform, d3.zoomIdentity);
    },
    fitToScreen,
    downloadPng,
    destroy() {
      clearTimeout(resizeTimeout);
      window.removeEventListener('resize', onResize);
      simulation.stop();
      svg.interrupt();
      container.innerHTML = '';
    },
    getMatchCount() {
      return searchMatchCount;
    }
  };
}
