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
    typeof node.width === 'number' && node.width > 0
      ? Math.round(node.width)
      : typeof (node as any).measured?.width === 'number' && (node as any).measured.width > 0
      ? Math.round((node as any).measured.width)
      : null;
  const measuredHeight =
    typeof node.height === 'number' && node.height > 0
      ? Math.round(node.height)
      : typeof (node as any).measured?.height === 'number' && (node as any).measured.height > 0
      ? Math.round((node as any).measured.height)
      : null;

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
      const branches = node.data?.branches || [];
      const branchCount = Math.max(1, branches.length);
      const w = Math.max(240, Math.min(460, 160 + labelLen * 12));
      const h = Math.max(120, 90 + branchCount * 30);
      return { width: measuredWidth ?? w, height: measuredHeight ?? h };
    }
    case 'element':
    case 'information': {
      return { width: measuredWidth ?? 220, height: measuredHeight ?? 100 };
    }
    case 'variable': {
      return { width: measuredWidth ?? 200, height: measuredHeight ?? 90 };
    }
    case 'jump': {
      const labelLen = (node.data?.label || '').length;
      const w = Math.max(200, Math.min(380, 160 + labelLen * 10));
      return { width: measuredWidth ?? w, height: measuredHeight ?? 90 };
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
      const hasTable = desc.includes('|');
      const maxLineLen = desc ? desc.split('\n').reduce((m, l) => Math.max(m, l.length), 0) : 0;
      const w = Math.max(240, Math.min(520, hasTable ? 460 : Math.max(240, 120 + maxLineLen * 9)));
      const h = Math.max(110, Math.min(700, 85 + descLines * 20));
      return { width: measuredWidth ?? w, height: measuredHeight ?? h };
    }
    case 'group': {
      const w = typeof node.width === 'number' && node.width > 0
        ? node.width
        : typeof node.style?.width === 'number'
        ? node.style.width
        : 420;
      const h = typeof node.height === 'number' && node.height > 0
        ? node.height
        : typeof node.style?.height === 'number'
        ? node.style.height
        : 320;
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
 * Aligns upstream nodes along the exterior lane of a long skip edge.
 * When a node U has a skip edge to a far downstream node V (e.g. crossing an intermediate
 * subgraph T), and V is located on the outer perimeter (right or left of T),
 * this aligns U and its immediate pre-entry chain with V's column.
 * This turns a diagonal cross-cutting skip edge into a clean, straight vertical drop along
 * the outer edge of the graph, avoiding all intermediate node and edge crossings.
 */
function alignUpstreamForSkipEdges(
  nodes: ScenarioNode[],
  edges: ScenarioEdge[],
  options: {
    topLevelIdMap: Map<string, string>;
    parentSatellites: Map<string, ScenarioNode[]>;
    rankSep: number;
    nodeWidth: number;
    nodeHeight: number;
  }
): void {
  const { topLevelIdMap, parentSatellites, rankSep, nodeWidth, nodeHeight } = options;
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));

  // In-degree & out-degree for non-reference top-level edges
  const inEdgesMap = new Map<string, ScenarioEdge[]>();
  const outEdgesMap = new Map<string, ScenarioEdge[]>();
  for (const edge of edges) {
    if (isReferenceEdge(edge)) continue;
    const srcId = topLevelIdMap.get(edge.source);
    const tgtId = topLevelIdMap.get(edge.target);
    if (!srcId || !tgtId || srcId === tgtId) continue;

    if (!outEdgesMap.has(srcId)) outEdgesMap.set(srcId, []);
    outEdgesMap.get(srcId)!.push(edge);

    if (!inEdgesMap.has(tgtId)) inEdgesMap.set(tgtId, []);
    inEdgesMap.get(tgtId)!.push(edge);
  }

  interface SkipCandidate {
    edge: ScenarioEdge;
    sourceNode: ScenarioNode;
    targetNode: ScenarioNode;
  }

  const skipCandidates: SkipCandidate[] = [];

  for (const [srcId, outList] of outEdgesMap.entries()) {
    const u = nodeMap.get(srcId);
    if (!u) continue;

    for (const edge of outList) {
      const tgtId = topLevelIdMap.get(edge.target)!;
      const v = nodeMap.get(tgtId);
      if (!v) continue;

      const yDiff = v.position.y - u.position.y;
      if (yDiff > rankSep * 2.0) {
        const otherInEdges = (inEdgesMap.get(tgtId) || []).filter(
          (e) => topLevelIdMap.get(e.source) !== srcId
        );
        const hasLowerIncoming = otherInEdges.some((e) => {
          const s = nodeMap.get(topLevelIdMap.get(e.source) || '');
          return s && s.position.y > u.position.y + rankSep * 0.5;
        });

        const otherOutEdges = outList.filter(
          (e) => topLevelIdMap.get(e.target) !== tgtId
        );

        if (hasLowerIncoming && otherOutEdges.length > 0) {
          skipCandidates.push({ edge, sourceNode: u, targetNode: v });
        }
      }
    }
  }

  if (skipCandidates.length === 0) return;

  for (const { sourceNode: u, targetNode: v } of skipCandidates) {
    // Trace the upstream chain C starting from U that feeds into the intermediate graph.
    const otherOutTargets = (outEdgesMap.get(u.id) || [])
      .map((e) => topLevelIdMap.get(e.target)!)
      .filter((tgtId) => tgtId !== v.id);

    const chainIds: string[] = [u.id];

    let tEntryId: string | null = null;

    // Follow linear single-path nodes
    for (const nextId of otherOutTargets) {
      let currId: string | null = nextId;
      while (currId) {
        const currNode = nodeMap.get(currId);
        if (!currNode) break;

        const currIn: ScenarioEdge[] = inEdgesMap.get(currId) || [];
        const currOut: ScenarioEdge[] = outEdgesMap.get(currId) || [];

        if (currIn.length === 1 && currNode.position.y < v.position.y - rankSep) {
          chainIds.push(currId);
          if (currOut.length === 1) {
            const nextTgt: string = topLevelIdMap.get(currOut[0].target)!;
            const nextNode = nodeMap.get(nextTgt);
            const nextIn: ScenarioEdge[] = inEdgesMap.get(nextTgt) || [];
            const nextOut: ScenarioEdge[] = outEdgesMap.get(nextTgt) || [];
            const isDifferentChapter =
              typeof u.data?.chapter === 'number' &&
              typeof nextNode?.data?.chapter === 'number' &&
              nextNode.data.chapter !== u.data.chapter;
            const leadsToBranch = nextOut.some(
              (e) => nodeMap.get(topLevelIdMap.get(e.target) || '')?.type === 'branch'
            );

            if (
              nextIn.length > 1 ||
              nextOut.length > 1 ||
              nextNode?.type === 'branch' ||
              isDifferentChapter ||
              leadsToBranch
            ) {
              tEntryId = nextTgt;
              currId = null;
            } else {
              currId = nextTgt;
            }
          } else {
            currId = null;
          }
        } else {
          tEntryId = currId;
          currId = null;
        }
      }
    }

    const chainIdSet = new Set(chainIds);

    // Identify intermediate subgraph T (nodes reachable from tEntryId and strictly above V)
    const intermediateIds = new Set<string>();
    if (tEntryId) {
      const q = [tEntryId];
      while (q.length > 0) {
        const curr = q.shift()!;
        if (intermediateIds.has(curr)) continue;
        intermediateIds.add(curr);
        const outs = outEdgesMap.get(curr) || [];
        for (const e of outs) {
          const tgt = topLevelIdMap.get(e.target)!;
          if (tgt !== v.id && !intermediateIds.has(tgt) && !chainIdSet.has(tgt)) {
            const tNode = nodeMap.get(tgt);
            if (tNode && tNode.position.y < v.position.y - 40) {
              q.push(tgt);
            }
          }
        }
      }
    }

    const intermediateNodes = Array.from(intermediateIds)
      .map((id) => nodeMap.get(id)!)
      .filter(Boolean);

    if (intermediateNodes.length === 0) continue;

    const minX_T = Math.min(...intermediateNodes.map((n) => n.position.x));
    const maxX_T = Math.max(
      ...intermediateNodes.map((n) => n.position.x + getNodeDimensions(n, nodeWidth, nodeHeight).width)
    );
    const midX_T = (minX_T + maxX_T) / 2;

    const uDim = getNodeDimensions(u, nodeWidth, nodeHeight);
    const vDim = getNodeDimensions(v, nodeWidth, nodeHeight);
    const vCenterX = v.position.x + vDim.width / 2;
    const isTargetOnRight = vCenterX > midX_T;

    if (isTargetOnRight) {
      // Find any unrelated node to the right of U on similar Y levels (e.g. Dr. Hayes' room)
      const rightNeighbors = nodes.filter((n) => {
        if (chainIdSet.has(n.id) || intermediateIds.has(n.id) || n.id === v.id) return false;
        const yOverlap = Math.abs(n.position.y - u.position.y) < 800;
        return yOverlap && n.position.x > u.position.x;
      });
      const minRightNeighborX =
        rightNeighbors.length > 0
          ? Math.min(...rightNeighbors.map((n) => n.position.x))
          : Infinity;

      // Position the straight vertical line in the open corridor between maxX_T and minRightNeighborX
      let lineX: number;
      if (minRightNeighborX < Infinity) {
        lineX = Math.round((maxX_T + minRightNeighborX) / 2);
      } else {
        lineX = maxX_T + 120;
      }
      lineX = Math.max(lineX, maxX_T + 80);

      // 1. Align target V's top handle with lineX
      const newVx = Math.round(lineX - vDim.width / 2);
      const vShift = newVx - v.position.x;
      v.position.x = newVx;
      const vSats = parentSatellites.get(v.id) || [];
      vSats.forEach((s) => {
        s.position.x += vShift;
      });

      // 2. Align U's right handle with lineX
      const desiredUx =
        u.type === 'branch'
          ? Math.round(lineX - uDim.width)
          : Math.round(lineX - uDim.width / 2);

      const uShift = desiredUx - u.position.x;

      for (const cId of chainIds) {
        const cNode = nodeMap.get(cId)!;
        cNode.position.x += uShift;

        const sats = parentSatellites.get(cId) || [];
        sats.forEach((s) => {
          s.position.x += uShift;
        });
      }
    } else {
      // Symmetrical left-side corridor alignment
      const leftNeighbors = nodes.filter((n) => {
        if (chainIdSet.has(n.id) || intermediateIds.has(n.id) || n.id === v.id) return false;
        const yOverlap = Math.abs(n.position.y - u.position.y) < 800;
        return yOverlap && n.position.x < u.position.x;
      });
      const maxLeftNeighborRight =
        leftNeighbors.length > 0
          ? Math.max(
              ...leftNeighbors.map(
                (n) => n.position.x + getNodeDimensions(n, nodeWidth, nodeHeight).width
              )
            )
          : -Infinity;

      let lineX: number;
      if (maxLeftNeighborRight > -Infinity) {
        lineX = Math.round((minX_T + maxLeftNeighborRight) / 2);
      } else {
        lineX = minX_T - 120;
      }
      lineX = Math.min(lineX, minX_T - 80);

      const newVx = Math.round(lineX - vDim.width / 2);
      const vShift = newVx - v.position.x;
      v.position.x = newVx;
      const vSats = parentSatellites.get(v.id) || [];
      vSats.forEach((s) => {
        s.position.x += vShift;
      });

      const desiredUx =
        u.type === 'branch'
          ? Math.round(lineX)
          : Math.round(lineX - uDim.width / 2);

      const uShift = desiredUx - u.position.x;

      for (const cId of chainIds) {
        const cNode = nodeMap.get(cId)!;
        cNode.position.x += uShift;

        const sats = parentSatellites.get(cId) || [];
        sats.forEach((s) => {
          s.position.x += uShift;
        });
      }
    }


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

  // 2. BOTTOM-UP: Layout child nodes inside groups FIRST and compute accurate group bounds!
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
    if (children.length === 0) continue;

    let layoutedChildren: ScenarioNode[];
    if (children.length === 1) {
      const singleChild = children[0];
      layoutedChildren = [
        {
          ...singleChild,
          position: { x: 40, y: 50 },
        },
      ];
    } else {
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

      layoutedChildren = children.map((child) => {
        const pos = subG.node(child.id);
        if (!pos) return child;
        const dim = getNodeDimensions(child, nodeWidth, nodeHeight);
        return {
          ...child,
          position: {
            x: Math.round(pos.x - dim.width / 2),
            y: Math.round(pos.y - dim.height / 2),
          },
          width: dim.width,
          height: dim.height,
        };
      });

      // Ensure children inside group do not collide
      resolveCollisions(layoutedChildren, { minGap: 20 });
    }

    // Normalize padding inside group
    const minChildX = Math.min(...layoutedChildren.map((c) => c.position.x));
    const minChildY = Math.min(...layoutedChildren.map((c) => c.position.y));
    const shiftX = minChildX < 40 ? 40 - minChildX : 0;
    const shiftY = minChildY < 50 ? 50 - minChildY : 0;
    if (shiftX !== 0 || shiftY !== 0) {
      layoutedChildren.forEach((c) => {
        c.position.x += shiftX;
        c.position.y += shiftY;
      });
    }

    // Automatically expand parent group to encompass all children
    const maxX = Math.max(
      ...layoutedChildren.map((c) => c.position.x + getNodeDimensions(c, nodeWidth, nodeHeight).width)
    );
    const maxY = Math.max(
      ...layoutedChildren.map((c) => c.position.y + getNodeDimensions(c, nodeWidth, nodeHeight).height)
    );
    const requiredW = Math.max(400, maxX + 50);
    const requiredH = Math.max(280, maxY + 50);

    const groupNode = topLevelNodeMap.get(groupId);
    if (groupNode) {
      groupNode.style = {
        ...groupNode.style,
        width: requiredW,
        height: requiredH,
      };
      groupNode.width = requiredW;
      groupNode.height = requiredH;
    }

    updatedChildNodes.push(...layoutedChildren);
  }

  // 3. Layout top-level primary nodes (now knowing exact group dimensions)
  const dagreTopNodes = topLevelNodes.filter((n) => !satelliteParents.has(n.id));

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
      width: alloc.baseDim.width,
      height: alloc.baseDim.height,
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
        width: satDim.width,
        height: satDim.height,
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

  // Align upstream nodes for long-range skip edges to avoid crossing intermediate subgraphs
  alignUpstreamForSkipEdges(updatedTopLevelNodes, edges, {
    topLevelIdMap,
    parentSatellites,
    rankSep,
    nodeWidth,
    nodeHeight,
  });

  // Post-process collision separation for top-level nodes
  resolveCollisions(updatedTopLevelNodes, { minGap: 24, satelliteParents });

  // Normalize top-level nodes and associated sticky nodes to start at (80, 80)
  if (updatedTopLevelNodes.length > 0) {
    const minTopX = Math.min(...updatedTopLevelNodes.map((n) => n.position.x));
    const minTopY = Math.min(...updatedTopLevelNodes.map((n) => n.position.y));
    const shiftTopX = 80 - minTopX;
    const shiftTopY = 80 - minTopY;
    if (shiftTopX !== 0 || shiftTopY !== 0) {
      updatedTopLevelNodes.forEach((n) => {
        n.position.x += shiftTopX;
        n.position.y += shiftTopY;
      });
      stickyNodes.forEach((s) => {
        if (s.data?.targetNodeId) {
          const targetTop = updatedTopLevelNodes.find((n) => n.id === s.data.targetNodeId);
          if (targetTop) {
            s.position.x += shiftTopX;
            s.position.y += shiftTopY;
          }
        } else {
          s.position.x += shiftTopX;
          s.position.y += shiftTopY;
        }
      });
    }
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

    // 1. Check named branch routes first (including explicit 'false', 'true', etc.)
    for (const b of rawBranches) {
      if (
        sourceHandle === b.id ||
        sourceHandle === `${b.id}-left` ||
        sourceHandle === `${b.id}-right` ||
        (b.id === 'false' && (sourceHandle === 'else' || sourceHandle === 'else-left'))
      ) {
        const optimalHandle = isTargetOnLeft ? `${b.id}-left` : b.id;
        if (sourceHandle !== optimalHandle) {
          return { ...edge, sourceHandle: optimalHandle };
        }
        return edge;
      }
    }

    // 2. Check Else route (when node has an Else / Default route)
    if (
      sourceHandle === 'else' ||
      sourceHandle === 'else-left'
    ) {
      const optimalHandle = isTargetOnLeft ? 'else-left' : 'else';
      if (sourceHandle !== optimalHandle) {
        return { ...edge, sourceHandle: optimalHandle };
      }
      return edge;
    }

    // 3. Fallback for legacy 2-way bottom pins (true / false) when not explicitly in rawBranches
    if (sourceHandle === 'true' || sourceHandle === 'true-left') {
      const optimalHandle = isTargetOnLeft ? 'true-left' : 'true';
      if (sourceHandle !== optimalHandle) {
        return { ...edge, sourceHandle: optimalHandle };
      }
      return edge;
    }
    if (sourceHandle === 'false' || sourceHandle === 'false-left') {
      const optimalHandle = isTargetOnLeft ? 'false-left' : 'false';
      if (sourceHandle !== optimalHandle) {
        return { ...edge, sourceHandle: optimalHandle };
      }
      return edge;
    }

    return edge;
  });

  return {
    nodes: allResultNodes,
    edges: updatedEdges,
  };
}
