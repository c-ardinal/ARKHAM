/**
 * @module nodeAbsolutePosition
 * @description Pure utility for resolving the absolute position of a ReactFlow node
 * and computing the center coordinate used for camera navigation.
 *
 * Spec: ReactFlow populates `positionAbsolute` for nodes that live inside a parent
 * group.  When present it represents the true canvas coordinate; the plain
 * `position` property is relative to the parent.  We must therefore prefer
 * `positionAbsolute` so that jump-camera moves target the correct location.
 */

import type { ScenarioNode } from '../types';

/** Center coordinate returned by {@link getJumpTargetCenter}. */
export interface NodeCenter {
  cx: number;
  cy: number;
}

/**
 * Compute the canvas-space center of a node suitable for passing to ReactFlow's
 * `setCenter(cx, cy, ...)`.
 *
 * Priority for origin:
 * 1. `node.positionAbsolute` – set by ReactFlow for child nodes inside a group.
 * 2. `node.position` – fallback for top-level nodes or when positionAbsolute is
 *    not yet populated.
 *
 * Default dimensions when `width`/`height` are undefined: 150 × 50 (px).
 *
 * @param targetNode - The node to navigate to.
 * @returns The absolute canvas center `{ cx, cy }`.
 */
export function getJumpTargetCenter(targetNode: ScenarioNode): NodeCenter {
  const DEFAULT_WIDTH = 150;
  const DEFAULT_HEIGHT = 50;

  const origin = targetNode.positionAbsolute ?? targetNode.position;
  const width = targetNode.width ?? DEFAULT_WIDTH;
  const height = targetNode.height ?? DEFAULT_HEIGHT;

  return {
    cx: origin.x + width / 2,
    cy: origin.y + height / 2,
  };
}
