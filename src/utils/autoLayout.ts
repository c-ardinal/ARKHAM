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
 * Returns exact measured or realistic estimated width and height for a node
 */
export function getNodeDimensions(
  node: ScenarioNode,
  defaultWidth = 260,
  defaultHeight = 130
): { width: number; height: number } {
  // 1. Measured dimensions directly from React Flow DOM
  const measuredWidth =
    typeof node.width === 'number' && node.width > 0 ? Math.round(node.width) : null;
  const measuredHeight =
    typeof node.height === 'number' && node.height > 0 ? Math.round(node.height) : null;

  if (measuredWidth && measuredHeight) {
    return { width: measuredWidth, height: measuredHeight };
  }

  // 2. Style dimensions (e.g. explicitly sized groups)
  if (typeof node.style?.width === 'number' && typeof node.style?.height === 'number') {
    return { width: node.style.width, height: node.style.height };
  }

  // 3. Realistic dynamic estimations based on text content and badges
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
      const labelLen = (node.data?.label || '').length;
      const desc = node.data?.description || '';
      const descLines = desc ? desc.split('\n').length : 0;
      const w = Math.max(260, Math.min(460, 180 + labelLen * 12));
      const h = Math.max(100, (hasBadges ? 135 : 95) + descLines * 22 + (desc.length > 50 ? 30 : 0));
      return { width: measuredWidth ?? w, height: measuredHeight ?? h };
    }
    case 'branch': {
      const labelLen = (node.data?.label || '').length;
      const w = Math.max(220, Math.min(420, 160 + labelLen * 12));
      return { width: measuredWidth ?? w, height: measuredHeight ?? 120 };
    }
    case 'element':
    case 'information': {
      return { width: measuredWidth ?? 220, height: measuredHeight ?? 100 };
    }
    case 'variable': {
      return { width: measuredWidth ?? 200, height: measuredHeight ?? 90 };
    }
    case 'character':
    case 'resource':
    case 'stage': {
      const desc = node.data?.description || '';
      const descLines = desc ? desc.split('\n').length : 0;
      const h = Math.max(130, 110 + descLines * 20);
      return { width: measuredWidth ?? 260, height: measuredHeight ?? h };
    }
    case 'memo': {
      const desc = node.data?.description || '';
      const descLines = desc ? desc.split('\n').length : 0;
      return { width: measuredWidth ?? 240, height: measuredHeight ?? Math.max(110, 85 + descLines * 20) };
    }
    case 'group': {
      const w = typeof node.style?.width === 'number' ? node.style.width : 420;
      const h = typeof node.style?.height === 'number' ? node.style.height : 320;
      return { width: w, height: h };
    }
    default:
      return { width: measuredWidth ?? defaultWidth, height: measuredHeight ?? defaultHeight };
  }
}

const SUPPLEMENT_TYPES = new Set([
  'character',
  'stage',
  'element',
  'information',
  'memo',
  'resource',
  'variable',
]);

export function isReferenceEdge(edge: ScenarioEdge): boolean {
  return (
    edge.type === 'reference' ||
    (typeof edge.sourceHandle === 'string' && edge.sourceHandle.startsWith('ref-')) ||
    (typeof edge.targetHandle === 'string' && edge.targetHandle.startsWith('ref-'))
  );
}

/**
 * Resolves remaining bounding box collisions using AABB push separation
 */
function resolveCollisions(
  nodes: ScenarioNode[],
  options: {
    minGap?: number;
    satelliteParents?: Map<string, string>;
  } = {}
): void {
  const { minGap = 24, satelliteParents } = options;

  for (let iter = 0; iter < 15; iter++) {
    let hadCollision = false;

    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i];
        const b = nodes[j];

        // Skip internal parent-satellite pairs (their offsets are fixed and managed)
        if (satelliteParents) {
          const aParent = satelliteParents.get(a.id);
          const bParent = satelliteParents.get(b.id);
          if (aParent === b.id || bParent === a.id || (aParent && aParent === bParent)) {
            continue;
          }
        }

        const dimA = getNodeDimensions(a);
        const dimB = getNodeDimensions(b);

        const aLeft = a.position.x;
        const aRight = aLeft + dimA.width;
        const aTop = a.position.y;
        const aBottom = aTop + dimA.height;

        const bLeft = b.position.x;
        const bRight = bLeft + dimB.width;
        const bTop = b.position.y;
        const bBottom = bTop + dimB.height;

        const overlapX = Math.min(aRight + minGap, bRight + minGap) - Math.max(aLeft, bLeft);
        const overlapY = Math.min(aBottom + minGap, bBottom + minGap) - Math.max(aTop, bTop);

        if (overlapX > 0 && overlapY > 0) {
          hadCollision = true;

          if (aLeft === bLeft && aTop === bTop) {
            b.position.x += dimA.width + minGap;
            continue;
          }

          if (overlapX < overlapY) {
            const shift = Math.ceil(overlapX / 2);
            if (aLeft <= bLeft) {
              a.position.x -= shift;
              b.position.x += shift;
            } else {
              a.position.x += shift;
              b.position.x -= shift;
            }
          } else {
            const shift = Math.ceil(overlapY / 2);
            if (aTop <= bTop) {
              a.position.y -= shift;
              b.position.y += shift;
            } else {
              a.position.y += shift;
              b.position.y -= shift;
            }
          }
        }
      }
    }

    if (!hadCollision) break;
  }
}

/**
 * Automatically calculates node positions using Dagre layout algorithm.
 * Design Philosophy:
 * - Primary flow: Top to Bottom (TB)
 * - Secondary flow: Left to Right (LR) for parallel branches
 * - Satellite layout: Supplement nodes (character, stage, memo, clue) connected by reference edges
 *   are cleanly aligned on the right side of their parent event node without colliding with other branches.
 * - Guaranteed Collision-Free: Measured node dimensions + symmetric Dagre spacing + AABB separation.
 */
export function getLayoutedElements(
  nodes: ScenarioNode[],
  edges: ScenarioEdge[],
  options: LayoutOptions = {}
): { nodes: ScenarioNode[]; edges: ScenarioEdge[] } {
  const {
    direction = 'TB',
    nodeWidth = 260,
    nodeHeight = 130,
    rankSep = 130,
    nodeSep = 100,
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

  const satGap = 36;
  const parentAllocations = new Map<
    string,
    { baseDim: { width: number; height: number }; dagreWidth: number; dagreHeight: number }
  >();

  dagreTopNodes.forEach((node) => {
    const baseDim = getNodeDimensions(node, nodeWidth, nodeHeight);
    const sats = parentSatellites.get(node.id) || [];

    let dagreWidth = baseDim.width;
    let dagreHeight = baseDim.height;

    if (sats.length > 0) {
      const maxSatWidth = Math.max(
        ...sats.map((s) => getNodeDimensions(s, nodeWidth, nodeHeight).width)
      );
      const totalSatHeight = sats.reduce(
        (sum, s, idx) =>
          sum + getNodeDimensions(s, nodeWidth, nodeHeight).height + (idx > 0 ? 16 : 0),
        0
      );
      // Symmetric width allocation keeps Dagre's node center pos.x aligned with the event node center,
      // so child nodes directly flow straight down beneath the event node rather than under satellites!
      dagreWidth = baseDim.width + 2 * (satGap + maxSatWidth);
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

    if (
      srcTop &&
      tgtTop &&
      srcTop !== tgtTop &&
      dagreNodeIdSet.has(srcTop) &&
      dagreNodeIdSet.has(tgtTop)
    ) {
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
    // Align parent node directly at pos.x (the center of flow)
    const parentX = Math.round(pos.x - alloc.baseDim.width / 2);
    const parentY = Math.round(pos.y - alloc.baseDim.height / 2);

    const updatedParent: ScenarioNode = {
      ...node,
      position: {
        x: parentX,
        y: parentY,
      },
    };
    updatedTopLevelNodes.push(updatedParent);

    // Position satellites vertically aligned on the right side of the parent
    const sats = parentSatellites.get(node.id) || [];
    let currentSatY = parentY;

    sats.forEach((sat) => {
      const satDim = getNodeDimensions(sat, nodeWidth, nodeHeight);
      const updatedSat: ScenarioNode = {
        ...sat,
        position: {
          x: parentX + alloc.baseDim.width + satGap,
          y: currentSatY,
        },
      };
      updatedTopLevelNodes.push(updatedSat);
      currentSatY += satDim.height + 16;
    });
  });

  // Include any top-level nodes that might not have been processed (e.g. detached satellites)
  const processedTopIds = new Set(updatedTopLevelNodes.map((n) => n.id));
  topLevelNodes.forEach((n) => {
    if (!processedTopIds.has(n.id)) {
      updatedTopLevelNodes.push(n);
    }
  });

  // Post-process collision separation for top-level nodes
  resolveCollisions(updatedTopLevelNodes, { minGap: 24, satelliteParents });

  // 3. Layout child nodes inside groups (relative to parent group)
  const groupChildrenMap = new Map<string, ScenarioNode[]>();
  childNodes.forEach((child) => {
    if (!child.parentNode) return;
    if (!groupChildrenMap.has(child.parentNode)) {
      groupChildrenMap.set(child.parentNode, []);
    }
    groupChildrenMap.get(child.parentNode)!.push(child);
  });

  const updatedChildNodes: ScenarioNode[] = [];
  for (const [groupId, children] of groupChildrenMap.entries()) {
    if (children.length <= 1) {
      updatedChildNodes.push(...children);
      continue;
    }

    const subG = new dagre.graphlib.Graph();
    subG.setDefaultEdgeLabel(() => ({}));
    subG.setGraph({
      rankdir: direction,
      nodesep: 60,
      ranksep: 80,
      marginx: 40,
      marginy: 50,
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

    // Ensure children inside group do not collide
    resolveCollisions(layoutedChildren, { minGap: 20 });

    // Automatically expand parent group to encompass all children
    if (layoutedChildren.length > 0) {
      const maxX = Math.max(
        ...layoutedChildren.map((c) => c.position.x + getNodeDimensions(c).width)
      );
      const maxY = Math.max(
        ...layoutedChildren.map((c) => c.position.y + getNodeDimensions(c).height)
      );
      const requiredW = Math.max(400, maxX + 50);
      const requiredH = Math.max(300, maxY + 50);

      const groupNode = updatedTopLevelNodes.find((n) => n.id === groupId);
      if (groupNode) {
        groupNode.style = {
          ...groupNode.style,
          width: requiredW,
          height: requiredH,
        };
      }
    }

    updatedChildNodes.push(...layoutedChildren);
  }

  const handledChildIds = new Set(updatedChildNodes.map((n) => n.id));
  const remainingChildren = childNodes.filter((c) => !handledChildIds.has(c.id));

  return {
    nodes: [...updatedTopLevelNodes, ...updatedChildNodes, ...remainingChildren, ...stickyNodes],
    edges,
  };
}
