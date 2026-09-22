import dagre from 'dagre';
import type { ScenarioNode, ScenarioEdge } from '../types';

export interface LayoutOptions {
  direction?: 'TB' | 'LR';
  nodeWidth?: number;
  nodeHeight?: number;
  rankSep?: number;
  nodeSep?: number;
}

/**
 * Returns estimated width and height for a node based on its type and content
 */
function getNodeDimensions(node: ScenarioNode, defaultWidth = 240, defaultHeight = 120): { width: number; height: number } {
  if (typeof node.style?.width === 'number' && typeof node.style?.height === 'number') {
    return { width: node.style.width, height: node.style.height };
  }

  switch (node.type) {
    case 'event': {
      const hasBadges = Boolean(
        node.data?.timeCostMinutes ||
        node.data?.requiredItems?.length ||
        node.data?.acquiredItems?.length ||
        node.data?.variableOperations?.length ||
        node.data?.resourceCheck ||
        node.data?.sanCheck
      );
      return { width: 240, height: hasBadges ? 130 : 90 };
    }
    case 'branch':
      return { width: 200, height: 100 };
    case 'element':
    case 'information':
      return { width: 190, height: 80 };
    case 'variable':
      return { width: 180, height: 75 };
    case 'character':
    case 'resource':
    case 'stage':
      return { width: 180, height: 70 };
    case 'group': {
      const w = typeof node.style?.width === 'number' ? node.style.width : 360;
      const h = typeof node.style?.height === 'number' ? node.style.height : 280;
      return { width: w, height: h };
    }
    default:
      return { width: defaultWidth, height: defaultHeight };
  }
}

const SUPPLEMENT_TYPES = new Set(['character', 'stage', 'element', 'information', 'memo', 'resource', 'variable']);

export function isReferenceEdge(edge: ScenarioEdge): boolean {
  return (
    edge.type === 'reference' ||
    (typeof edge.sourceHandle === 'string' && edge.sourceHandle.startsWith('ref-')) ||
    (typeof edge.targetHandle === 'string' && edge.targetHandle.startsWith('ref-'))
  );
}

/**
 * Automatically calculates node positions using Dagre layout algorithm.
 * Design Philosophy:
 * - Primary flow: Top to Bottom (TB)
 * - Secondary flow: Left to Right (LR) for parallel branches
 * - Satellite layout: Supplement nodes (character, stage, memo, clue) connected by reference edges
 *   are cleanly aligned on the right side of their parent event node without colliding with other branches.
 */
export function getLayoutedElements(
  nodes: ScenarioNode[],
  edges: ScenarioEdge[],
  options: LayoutOptions = {}
): { nodes: ScenarioNode[]; edges: ScenarioEdge[] } {
  const {
    direction = 'TB',
    nodeWidth = 240,
    nodeHeight = 120,
    rankSep = 110,
    nodeSep = 80,
  } = options;

  // Separate sticky notes (annotations) and flow nodes
  const stickyNodes = nodes.filter((n) => n.type === 'sticky');
  const flowNodes = nodes.filter((n) => n.type !== 'sticky');

  // Distinguish top-level nodes from child nodes inside groups
  const topLevelNodes = flowNodes.filter((n) => !n.parentNode);
  const childNodes = flowNodes.filter((n) => Boolean(n.parentNode));

  // Map to resolve an element ID to its top-level container/node
  const topLevelIdMap = new Map<string, string>();
  for (const n of topLevelNodes) {
    topLevelIdMap.set(n.id, n.id);
  }
  for (const n of childNodes) {
    if (n.parentNode) {
      topLevelIdMap.set(n.id, n.parentNode);
    }
  }

  // 1. Identify satellites connected via reference edges
  const satelliteParents = new Map<string, string>(); // satId -> parentId
  const parentSatellites = new Map<string, ScenarioNode[]>(); // parentId -> satNodes[]
  const topLevelNodeMap = new Map(topLevelNodes.map((n) => [n.id, n]));

  // Inspect reference edges among top-level nodes
  for (const edge of edges) {
    if (!isReferenceEdge(edge)) continue;
    const srcId = topLevelIdMap.get(edge.source);
    const tgtId = topLevelIdMap.get(edge.target);
    if (!srcId || !tgtId || srcId === tgtId) continue;

    const srcNode = topLevelNodeMap.get(srcId);
    const tgtNode = topLevelNodeMap.get(tgtId);
    if (!srcNode || !tgtNode) continue;

    let parent: ScenarioNode;
    let sat: ScenarioNode;

    if (SUPPLEMENT_TYPES.has(tgtNode.type || '') && !SUPPLEMENT_TYPES.has(srcNode.type || '')) {
      parent = srcNode;
      sat = tgtNode;
    } else if (SUPPLEMENT_TYPES.has(srcNode.type || '') && !SUPPLEMENT_TYPES.has(tgtNode.type || '')) {
      parent = tgtNode;
      sat = srcNode;
    } else {
      parent = srcNode;
      sat = tgtNode;
    }

    // Ensure sat is not already assigned and parent is not a satellite
    if (!satelliteParents.has(sat.id) && !satelliteParents.has(parent.id) && sat.id !== parent.id) {
      satelliteParents.set(sat.id, parent.id);
      if (!parentSatellites.has(parent.id)) {
        parentSatellites.set(parent.id, []);
      }
      parentSatellites.get(parent.id)!.push(sat);
    }
  }

  // Primary top-level nodes for Dagre (excluding satellites)
  const dagreTopNodes = topLevelNodes.filter((n) => !satelliteParents.has(n.id));

  // 2. Layout top-level primary nodes
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({
    rankdir: direction,
    nodesep: nodeSep,
    ranksep: rankSep,
    marginx: 80,
    marginy: 80,
  });

  const parentAllocations = new Map<string, { baseDim: { width: number; height: number }; dagreWidth: number; dagreHeight: number }>();

  dagreTopNodes.forEach((node) => {
    const baseDim = getNodeDimensions(node, nodeWidth, nodeHeight);
    const sats = parentSatellites.get(node.id) || [];

    let dagreWidth = baseDim.width;
    let dagreHeight = baseDim.height;

    if (sats.length > 0) {
      const maxSatWidth = Math.max(...sats.map((s) => getNodeDimensions(s, nodeWidth, nodeHeight).width));
      const totalSatHeight = sats.reduce(
        (sum, s, idx) => sum + getNodeDimensions(s, nodeWidth, nodeHeight).height + (idx > 0 ? 12 : 0),
        0
      );
      dagreWidth = baseDim.width + 36 + maxSatWidth;
      dagreHeight = Math.max(baseDim.height, totalSatHeight);
    }

    parentAllocations.set(node.id, { baseDim, dagreWidth, dagreHeight });
    g.setNode(node.id, { width: dagreWidth, height: dagreHeight });
  });

  const dagreNodeIdSet = new Set(dagreTopNodes.map((n) => n.id));
  const registeredEdges = new Set<string>();

  edges.forEach((edge) => {
    if (isReferenceEdge(edge)) return; // Reference edges are excluded from primary flow layout
    const srcTop = topLevelIdMap.get(edge.source);
    const tgtTop = topLevelIdMap.get(edge.target);

    if (srcTop && tgtTop && srcTop !== tgtTop && dagreNodeIdSet.has(srcTop) && dagreNodeIdSet.has(tgtTop)) {
      const edgeKey = `${srcTop}->${tgtTop}`;
      if (!registeredEdges.has(edgeKey)) {
        registeredEdges.add(edgeKey);
        g.setEdge(srcTop, tgtTop);
      }
    }
  });

  dagre.layout(g);

  // Position primary nodes and their satellites
  const updatedTopLevelNodes: ScenarioNode[] = [];

  dagreTopNodes.forEach((node) => {
    const pos = g.node(node.id);
    if (!pos) {
      updatedTopLevelNodes.push(node);
      return;
    }

    const alloc = parentAllocations.get(node.id)!;
    const boxLeft = Math.round(pos.x - alloc.dagreWidth / 2);
    const boxTop = Math.round(pos.y - alloc.dagreHeight / 2);

    // Parent primary node is aligned at top-left of its allocated box
    const updatedParent: ScenarioNode = {
      ...node,
      position: {
        x: boxLeft,
        y: boxTop,
      },
    };
    updatedTopLevelNodes.push(updatedParent);

    // Position satellites vertically aligned on the right side of the parent
    const sats = parentSatellites.get(node.id) || [];
    let currentSatY = boxTop;

    sats.forEach((sat) => {
      const satDim = getNodeDimensions(sat, nodeWidth, nodeHeight);
      const updatedSat: ScenarioNode = {
        ...sat,
        position: {
          x: boxLeft + alloc.baseDim.width + 36,
          y: currentSatY,
        },
      };
      updatedTopLevelNodes.push(updatedSat);
      currentSatY += satDim.height + 12;
    });
  });

  // Include any top-level nodes that might not have been processed (e.g. detached satellites)
  const processedTopIds = new Set(updatedTopLevelNodes.map((n) => n.id));
  topLevelNodes.forEach((n) => {
    if (!processedTopIds.has(n.id)) {
      updatedTopLevelNodes.push(n);
    }
  });

  // 2. Layout child nodes inside groups (relative to parent group)
  const groupChildrenMap = new Map<string, ScenarioNode[]>();
  childNodes.forEach((child) => {
    if (!child.parentNode) return;
    if (!groupChildrenMap.has(child.parentNode)) {
      groupChildrenMap.set(child.parentNode, []);
    }
    groupChildrenMap.get(child.parentNode)!.push(child);
  });

  const updatedChildNodes: ScenarioNode[] = [];
  for (const [, children] of groupChildrenMap.entries()) {
    if (children.length <= 1) {
      updatedChildNodes.push(...children);
      continue;
    }

    const subG = new dagre.graphlib.Graph();
    subG.setDefaultEdgeLabel(() => ({}));
    subG.setGraph({
      rankdir: direction,
      nodesep: 50,
      ranksep: 70,
      marginx: 30,
      marginy: 40,
    });

    const childIdSet = new Set(children.map((c) => c.id));
    children.forEach((child) => {
      const dim = getNodeDimensions(child, nodeWidth, nodeHeight);
      subG.setNode(child.id, dim);
    });

    edges.forEach((e) => {
      if (childIdSet.has(e.source) && childIdSet.has(e.target)) {
        subG.setEdge(e.source, e.target);
      }
    });

    dagre.layout(subG);

    const layoutedChildren = children.map((child) => {
      const pos = subG.node(child.id);
      if (!pos) return child;
      const dim = getNodeDimensions(child, nodeWidth, nodeHeight);
      return {
        ...child,
        position: {
          x: Math.round(pos.x - dim.width / 2),
          y: Math.round(pos.y - dim.height / 2),
        },
      };
    });

    updatedChildNodes.push(...layoutedChildren);
  }

  const handledChildIds = new Set(updatedChildNodes.map((n) => n.id));
  const remainingChildren = childNodes.filter((c) => !handledChildIds.has(c.id));

  return {
    nodes: [...updatedTopLevelNodes, ...updatedChildNodes, ...remainingChildren, ...stickyNodes],
    edges,
  };
}
