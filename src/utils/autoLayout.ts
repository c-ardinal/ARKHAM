import dagre from 'dagre';
import type { ScenarioNode, ScenarioEdge } from '../types';

export interface LayoutOptions {
  direction?: 'LR' | 'TB';
  nodeWidth?: number;
  nodeHeight?: number;
}

/**
 * Automatically calculates neat node positions using Dagre layout algorithm.
 * Follows industry-standard narrative flow (default: Left-to-Right LR).
 */
export function getLayoutedElements(
  nodes: ScenarioNode[],
  edges: ScenarioEdge[],
  options: LayoutOptions = {}
): { nodes: ScenarioNode[]; edges: ScenarioEdge[] } {
  const { direction = 'LR', nodeWidth = 240, nodeHeight = 120 } = options;

  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));

  dagreGraph.setGraph({
    rankdir: direction,
    nodesep: 60,
    ranksep: 120,
    marginx: 50,
    marginy: 50,
  });

  // Sticky nodes are annotations and maintain their relative positions
  const layoutNodes = nodes.filter((n) => n.type !== 'sticky');
  const stickyNodes = nodes.filter((n) => n.type === 'sticky');

  layoutNodes.forEach((node) => {
    const width = typeof node.style?.width === 'number' ? node.style.width : nodeWidth;
    const height = typeof node.style?.height === 'number' ? node.style.height : nodeHeight;
    dagreGraph.setNode(node.id, { width, height });
  });

  const nodeIds = new Set(layoutNodes.map((n) => n.id));
  edges.forEach((edge) => {
    if (nodeIds.has(edge.source) && nodeIds.has(edge.target)) {
      dagreGraph.setEdge(edge.source, edge.target);
    }
  });

  dagre.layout(dagreGraph);

  const updatedLayoutNodes = layoutNodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    if (!nodeWithPosition) return node;

    const width = typeof node.style?.width === 'number' ? node.style.width : nodeWidth;
    const height = typeof node.style?.height === 'number' ? node.style.height : nodeHeight;

    return {
      ...node,
      position: {
        x: Math.round(nodeWithPosition.x - width / 2),
        y: Math.round(nodeWithPosition.y - height / 2),
      },
    };
  });

  return {
    nodes: [...updatedLayoutNodes, ...stickyNodes],
    edges,
  };
}
