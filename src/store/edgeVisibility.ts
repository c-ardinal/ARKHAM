/**
 * @module edgeVisibility
 * @description Pure functions for computing edge visibility based on node hidden state.
 *
 * Spec: An edge must be hidden if either its source node or target node is hidden
 * or does not exist in the node list. Virtual edges (data.isVirtual: true) follow
 * the same rule as ordinary edges.
 *
 * Referential equality is preserved when the hidden value does not change, enabling
 * efficient memoisation at the call site.
 */

import type { ScenarioNode, ScenarioEdge } from '../types';

/**
 * Recompute the `hidden` property for every edge based on the current node list.
 *
 * @param nodes - Full list of scenario nodes (may include hidden nodes).
 * @param edges - Full list of scenario edges to update.
 * @returns A new array where each edge has `hidden` set correctly.
 *          If an edge's hidden value is unchanged the original object reference is
 *          returned (Object.is equality), avoiding unnecessary re-renders.
 */
export function recomputeEdgeVisibility(
  nodes: readonly ScenarioNode[],
  edges: readonly ScenarioEdge[],
): ScenarioEdge[] {
  const nodeMap = new Map<string, ScenarioNode>();
  for (const node of nodes) {
    nodeMap.set(node.id, node);
  }

  return edges.map((edge) => {
    const sourceNode = nodeMap.get(edge.source);
    const targetNode = nodeMap.get(edge.target);

    const shouldHide =
      sourceNode === undefined ||
      targetNode === undefined ||
      sourceNode.hidden === true ||
      targetNode.hidden === true;

    // Preserve referential equality when nothing changed
    if (edge.hidden === shouldHide) {
      return edge;
    }

    return { ...edge, hidden: shouldHide };
  });
}
