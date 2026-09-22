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

/**
 * Automatically calculates node positions using Dagre layout algorithm.
 * Design Philosophy:
 * - Primary flow: Top to Bottom (TB)
 * - Secondary flow: Left to Right (LR) for parallel branches
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

  // 1. Layout top-level nodes
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({
    rankdir: direction,
    nodesep: nodeSep,
    ranksep: rankSep,
    marginx: 80,
    marginy: 80,
  });

  topLevelNodes.forEach((node) => {
    const dim = getNodeDimensions(node, nodeWidth, nodeHeight);
    g.setNode(node.id, dim);
  });

  const topLevelIdSet = new Set(topLevelNodes.map((n) => n.id));
  const registeredEdges = new Set<string>();

  edges.forEach((edge) => {
    const srcTop = topLevelIdMap.get(edge.source);
    const tgtTop = topLevelIdMap.get(edge.target);

    if (srcTop && tgtTop && srcTop !== tgtTop && topLevelIdSet.has(srcTop) && topLevelIdSet.has(tgtTop)) {
      const edgeKey = `${srcTop}->${tgtTop}`;
      if (!registeredEdges.has(edgeKey)) {
        registeredEdges.add(edgeKey);
        g.setEdge(srcTop, tgtTop);
      }
    }
  });

  dagre.layout(g);

  const updatedTopLevelNodes = topLevelNodes.map((node) => {
    const pos = g.node(node.id);
    if (!pos) return node;

    const dim = getNodeDimensions(node, nodeWidth, nodeHeight);
    return {
      ...node,
      position: {
        x: Math.round(pos.x - dim.width / 2),
        y: Math.round(pos.y - dim.height / 2),
      },
    };
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
