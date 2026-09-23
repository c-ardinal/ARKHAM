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


export function isReferenceEdge(edge: ScenarioEdge): boolean {
  return (
    edge.type === 'reference' ||
    (typeof edge.sourceHandle === 'string' && edge.sourceHandle.startsWith('ref-')) ||
    (typeof edge.targetHandle === 'string' && edge.targetHandle.startsWith('ref-'))
  );
}

/**
 * Resolves the 0-based vertical index of a branch route from top to bottom.
 * 0 is the topmost route; larger indices represent lower routes.
 */
export function getRouteIndex(node: ScenarioNode, sourceHandle?: string | null): number {
  if (node.type !== 'branch') return 0;
  const branches = node.data?.branches || [];
  const handle = sourceHandle || '';

  // 1. Check named branch routes
  for (let i = 0; i < branches.length; i++) {
    const bId = branches[i].id;
    if (handle === bId || handle === `${bId}-left` || handle === `${bId}-right`) {
      return i;
    }
  }

  // 2. Check Else / False route (rendered at the very bottom)
  if (
    handle === 'else' ||
    handle === 'else-left' ||
    handle === 'false' ||
    handle === 'false-left'
  ) {
    return branches.length > 0 ? branches.length : 1;
  }

  // 3. Fallback for True (legacy / 2-branch)
  if (handle === 'true' || handle === 'true-left') {
    return 0;
  }

  return 0;
}

/**
 * Orders outgoing edges of a branch node for Dagre layout such that:
 * - Upper routes in the branch are placed on the OUTSIDE (far-left for left side, far-right for right side)
 * - Lower routes in the branch are placed on the INSIDE (near-center)
 * This guarantees zero crossing and zero overlap between branch edges and nodes.
 */
export function orderBranchOutgoingEdges(
  branchNode: ScenarioNode,
  outgoingEdges: ScenarioEdge[]
): ScenarioEdge[] {
  if (outgoingEdges.length <= 1) return outgoingEdges;

  // Map each edge to its route index (0 = topmost route, N = bottommost route / Else)
  const withIndex = outgoingEdges.map((edge) => ({
    edge,
    routeIndex: getRouteIndex(branchNode, edge.sourceHandle),
  }));

  withIndex.sort((a, b) => a.routeIndex - b.routeIndex);

  // Check if edges already have explicit left vs right handle designations
  const hasExplicitLeft = withIndex.some((item) =>
    item.edge.sourceHandle?.endsWith('-left')
  );
  const hasExplicitRight = withIndex.some(
    (item) => item.edge.sourceHandle && !item.edge.sourceHandle.endsWith('-left')
  );

  let leftItems: typeof withIndex;
  let rightItems: typeof withIndex;

  if (hasExplicitLeft && hasExplicitRight) {
    leftItems = withIndex.filter((item) => item.edge.sourceHandle?.endsWith('-left'));
    rightItems = withIndex.filter((item) => !item.edge.sourceHandle?.endsWith('-left'));
  } else {
    // Symmetrical split: earlier routes to left, later routes to right
    const numLeft = Math.floor(withIndex.length / 2);
    leftItems = withIndex.slice(0, numLeft);
    rightItems = withIndex.slice(numLeft);
  }

  // Left side: Higher routes (smaller routeIndex) on outside (far-left), lower routes on inside (near-center)
  leftItems.sort((a, b) => a.routeIndex - b.routeIndex);

  // Right side: Lower routes (larger routeIndex) on inside (near-center), higher routes on outside (far-right)
  rightItems.sort((a, b) => b.routeIndex - a.routeIndex);

  return [...leftItems.map((item) => item.edge), ...rightItems.map((item) => item.edge)];
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
 * Sorts nodes and flow edges in topological order, with branch outgoing edges ordered
 * according to orderBranchOutgoingEdges. This guarantees that Dagre receives nodes and edges
 * in optimal order from root to leaves, preventing downstream crossovers.
 */
export function orderNodesAndEdgesByFlow(
  nodes: ScenarioNode[],
  edges: ScenarioEdge[],
  nodeToTopLevelMap: Map<string, string>
): { orderedNodeIds: string[]; orderedEdges: ScenarioEdge[] } {
  const nodeIds = new Set(nodes.map((n) => n.id));

  // Map of outgoing edges grouped by source ID
  const outgoingMap = new Map<string, ScenarioEdge[]>();
  const inDegree = new Map<string, number>();
  nodeIds.forEach((id) => inDegree.set(id, 0));

  edges.forEach((edge) => {
    if (isReferenceEdge(edge)) return;
    const srcId = nodeToTopLevelMap.get(edge.source);
    const tgtId = nodeToTopLevelMap.get(edge.target);
    if (!srcId || !tgtId || srcId === tgtId) return;
    if (!nodeIds.has(srcId) || !nodeIds.has(tgtId)) return;

    if (!outgoingMap.has(srcId)) outgoingMap.set(srcId, []);
    outgoingMap.get(srcId)!.push(edge);
    inDegree.set(tgtId, (inDegree.get(tgtId) || 0) + 1);
  });

  // Re-order outgoing edges for branch nodes
  nodes.forEach((n) => {
    const outList = outgoingMap.get(n.id);
    if (n.type === 'branch' && outList && outList.length > 1) {
      outgoingMap.set(n.id, orderBranchOutgoingEdges(n, outList));
    }
  });

  // Initial roots (in-degree 0)
  const roots = nodes.filter((n) => inDegree.get(n.id) === 0);
  // Sort roots: start nodes first, then by chapter, then by y/x position
  roots.sort((a, b) => {
    const aStart = a.data?.isStart ? 1 : 0;
    const bStart = b.data?.isStart ? 1 : 0;
    if (aStart !== bStart) return bStart - aStart;
    const aChap = a.data?.chapter ?? 0;
    const bChap = b.data?.chapter ?? 0;
    if (aChap !== bChap) return aChap - bChap;
    if (a.position.y !== b.position.y) return a.position.y - b.position.y;
    return a.position.x - b.position.x;
  });

  const queue: string[] = roots.map((n) => n.id);
  const visited = new Set<string>();
  const orderedNodeIds: string[] = [];
  const orderedEdges: ScenarioEdge[] = [];
  const registeredEdgeKeys = new Set<string>();

  while (queue.length > 0) {
    const u = queue.shift()!;
    if (visited.has(u)) continue;
    visited.add(u);
    orderedNodeIds.push(u);

    const outList = outgoingMap.get(u) || [];
    outList.forEach((e) => {
      const tgtId = nodeToTopLevelMap.get(e.target)!;
      const edgeKey = `${u}->${tgtId}`;
      if (!registeredEdgeKeys.has(edgeKey)) {
        registeredEdgeKeys.add(edgeKey);
        orderedEdges.push(e);
      }
      const deg = (inDegree.get(tgtId) || 1) - 1;
      inDegree.set(tgtId, deg);
      if (deg <= 0 && !visited.has(tgtId)) {
        queue.push(tgtId);
      }
    });

    // If queue is empty but there are still unvisited nodes (e.g. cycle or disconnected component)
    if (queue.length === 0 && orderedNodeIds.length < nodes.length) {
      const remaining = nodes.filter((n) => !visited.has(n.id));
      remaining.sort((a, b) => (inDegree.get(a.id) || 0) - (inDegree.get(b.id) || 0));
      if (remaining.length > 0) {
        queue.push(remaining[0].id);
      }
    }
  }

  // Append any missed nodes
  nodes.forEach((n) => {
    if (!visited.has(n.id)) {
      orderedNodeIds.push(n.id);
    }
  });

  return { orderedNodeIds, orderedEdges };
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

    // In reference edges, the originating node is parent and referenced node is satellite
    const parent = srcNode;
    const sat = tgtNode;

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

  // Order nodes and edges by topological flow
  const { orderedNodeIds, orderedEdges } = orderNodesAndEdgesByFlow(
    dagreTopNodes,
    edges,
    topLevelIdMap
  );

  orderedNodeIds.forEach((nodeId) => {
    const node = topLevelNodeMap.get(nodeId)!;
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

  const registeredEdges = new Set<string>();
  orderedEdges.forEach((edge) => {
    const srcTop = topLevelIdMap.get(edge.source);
    const tgtTop = topLevelIdMap.get(edge.target);
    if (srcTop && tgtTop && srcTop !== tgtTop) {
      const edgeKey = `${srcTop}->${tgtTop}`;
      if (!registeredEdges.has(edgeKey)) {
        registeredEdges.add(edgeKey);
        g.setEdge(srcTop, tgtTop);
      }
    }
  });

  dagre.layout(g);

  // Sibling slot alignment for branch nodes:
  // Enforces that direct target siblings on the same rank follow the optimal left-to-right order
  const branchNodes = dagreTopNodes.filter((n) => n.type === 'branch');
  branchNodes.forEach((bn) => {
    const outgoing = edges.filter(
      (e) => !isReferenceEdge(e) && topLevelIdMap.get(e.source) === bn.id
    );
    const orderedEdges = orderBranchOutgoingEdges(bn, outgoing);
    const orderedTargetIds = orderedEdges
      .map((e) => topLevelIdMap.get(e.target)!)
      .filter(Boolean);

    // Group targets by layer/rank (y)
    const targets = orderedTargetIds
      .map((id) => ({ id, node: g.node(id) }))
      .filter((t) => t.node);
    if (targets.length <= 1) return;

    const yGroups = new Map<number, typeof targets>();
    targets.forEach((t) => {
      const roundedY = Math.round(t.node.y / 20) * 20;
      if (!yGroups.has(roundedY)) yGroups.set(roundedY, []);
      yGroups.get(roundedY)!.push(t);
    });

    yGroups.forEach((group) => {
      if (group.length <= 1) return;
      const sortedX = group.map((t) => t.node.x).sort((a, b) => a - b);
      group.forEach((t, idx) => {
        t.node.x = sortedX[idx];
      });
    });
  });

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
    const childIdMap = new Map(children.map((c) => [c.id, c.id]));
    const childEdges = edges.filter(
      (e) => !isReferenceEdge(e) && childIdSet.has(e.source) && childIdSet.has(e.target)
    );
    const { orderedNodeIds: childOrderedIds, orderedEdges: childOrderedEdges } =
      orderNodesAndEdgesByFlow(children, childEdges, childIdMap);

    const childNodeMap = new Map(children.map((c) => [c.id, c]));
    childOrderedIds.forEach((childId) => {
      const child = childNodeMap.get(childId)!;
      const dim = getNodeDimensions(child, nodeWidth, nodeHeight);
      subG.setNode(child.id, dim);
    });

    const registeredChildEdges = new Set<string>();
    childOrderedEdges.forEach((e) => {
      const k = `${e.source}->${e.target}`;
      if (!registeredChildEdges.has(k)) {
        registeredChildEdges.add(k);
        subG.setEdge(e.source, e.target);
      }
    });

    dagre.layout(subG);

    // Sibling slot alignment for branch nodes inside group
    const groupBranchNodes = children.filter((c) => c.type === 'branch');
    groupBranchNodes.forEach((bn) => {
      const outgoing = edges.filter(
        (e) => !isReferenceEdge(e) && e.source === bn.id && childIdSet.has(e.target)
      );
      const orderedEdges = orderBranchOutgoingEdges(bn, outgoing);
      const targets = orderedEdges
        .map((e) => ({ id: e.target, node: subG.node(e.target) }))
        .filter((t) => t.node);
      if (targets.length <= 1) return;

      const yGroups = new Map<number, typeof targets>();
      targets.forEach((t) => {
        const roundedY = Math.round(t.node.y / 20) * 20;
        if (!yGroups.has(roundedY)) yGroups.set(roundedY, []);
        yGroups.get(roundedY)!.push(t);
      });

      yGroups.forEach((group) => {
        if (group.length <= 1) return;
        const sortedX = group.map((t) => t.node.x).sort((a, b) => a - b);
        group.forEach((t, idx) => {
          t.node.x = sortedX[idx];
        });
      });
    });

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

  const allResultNodes: ScenarioNode[] = [
    ...updatedTopLevelNodes,
    ...updatedChildNodes,
    ...remainingChildren,
    ...stickyNodes,
  ];
  const resultMap = new Map<string, ScenarioNode>(allResultNodes.map((n) => [n.id, n]));

  // Helper to compute absolute center X of any node (including parent group offset if nested)
  const getAbsoluteCenterX = (nodeId: string): number | null => {
    const node = resultMap.get(nodeId);
    if (!node) return null;
    const dim = getNodeDimensions(node, nodeWidth, nodeHeight);
    let x = node.position.x + dim.width / 2;
    if (node.parentNode) {
      const parent = resultMap.get(node.parentNode);
      if (parent) {
        x += parent.position.x;
      }
    }
    return x;
  };

  // 4. Optimize multi-branch output pin directions (left vs right) based on layout positions
  // Prevents edges from cutting across the branch node body
  const updatedEdges: ScenarioEdge[] = edges.map((edge) => {
    if (isReferenceEdge(edge)) return edge;

    const sourceNode = resultMap.get(edge.source);
    if (!sourceNode || sourceNode.type !== 'branch') return edge;

    const rawBranches = sourceNode.data?.branches || [];
    // Only multi-branch configurations (2 or more routes) have dual left/right handles
    if (rawBranches.length < 2) return edge;

    const branchCenterX = getAbsoluteCenterX(edge.source);
    const targetCenterX = getAbsoluteCenterX(edge.target);
    if (branchCenterX === null || targetCenterX === null) return edge;

    // Target is located to the left of the branch node
    let isTargetOnLeft: boolean;
    if (Math.abs(targetCenterX - branchCenterX) > 5) {
      isTargetOnLeft = targetCenterX < branchCenterX;
    } else {
      const rIdx = getRouteIndex(sourceNode, edge.sourceHandle);
      const numLeft = Math.floor(rawBranches.length / 2);
      isTargetOnLeft = rIdx < numLeft;
    }
    const sourceHandle = edge.sourceHandle || '';

    // Check Else route
    if (
      sourceHandle === 'else' ||
      sourceHandle === 'else-left' ||
      sourceHandle === 'false' ||
      sourceHandle === 'false-left'
    ) {
      const optimalHandle = isTargetOnLeft ? 'else-left' : 'else';
      if (sourceHandle !== optimalHandle) {
        return { ...edge, sourceHandle: optimalHandle };
      }
      return edge;
    }

    // Check branch routes
    for (const b of rawBranches) {
      if (
        sourceHandle === b.id ||
        sourceHandle === `${b.id}-left` ||
        sourceHandle === `${b.id}-right`
      ) {
        const optimalHandle = isTargetOnLeft ? `${b.id}-left` : b.id;
        if (sourceHandle !== optimalHandle) {
          return { ...edge, sourceHandle: optimalHandle };
        }
        return edge;
      }
    }

    return edge;
  });

  return {
    nodes: allResultNodes,
    edges: updatedEdges,
  };
}
